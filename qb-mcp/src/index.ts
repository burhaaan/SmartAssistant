#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { fetch } from "undici";
import { AsyncLocalStorage } from "node:async_hooks";

import { getTokens, upsertTokens } from "./db.js";

dotenv.config();

const PORT = Number(process.env.PORT || 3001);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const SESSION_JWT_SECRET = process.env.SESSION_JWT_SECRET!;
if (!SESSION_JWT_SECRET) throw new Error("Missing SESSION_JWT_SECRET");
const QB_CLIENT_ID = process.env.QB_CLIENT_ID!;
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET!;
const MINOR_VERSION = Number(process.env.QB_MINOR_VERSION || 75);

// Per-request context
type Ctx = { userId: number };
const ctxStore = new AsyncLocalStorage<Ctx>();

function requireSession(req: express.Request, res: express.Response): Ctx | null {
  const rawHeader =
    (req.headers["authorization"] as string) ||
    (req.headers["x-session"] as string) ||
    "";

  const raw = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const token = raw.toLowerCase().startsWith("bearer ")
    ? raw.slice(7)
    : raw;

  try {
    const decoded = jwt.verify(token, SESSION_JWT_SECRET) as { userId?: number };
    if (!decoded?.userId) throw new Error("no userId");
    return { userId: decoded.userId };
  } catch {
    if (!res.headersSent) {
      res.status(401).json({ error: "invalid_session" });
    }
    return null;
  }
}

async function refreshWithQbo(refresh_token: string, userId: number, realmId?: string | null) {
  const resp = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`QBO refresh failed: ${resp.status} ${t}`);
  }
  const data = (await resp.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  const now = Math.floor(Date.now() / 1000);
  const expires_at = data.expires_in ? now + data.expires_in : null;

  await upsertTokens({
    userId,
    provider: "quickbooks",
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refresh_token,
    realmId: realmId ?? null,
    expires_at,
  });
}

async function qbRequest(
  endpoint: string,
  opts: { method?: "GET" | "POST"; body?: any } = {}
) {
  const ctx = ctxStore.getStore();
  if (!ctx) throw new Error("Missing request context");

  const row = await getTokens(ctx.userId, "quickbooks");
  if (!row?.access_token || !row?.realmId) throw new Error("QuickBooks not connected");

  const base = `https://sandbox-quickbooks.api.intuit.com/v3/company/${row.realmId}/${endpoint}`;
  const url =
    base + (base.includes("?") ? `&minorversion=${MINOR_VERSION}` : `?minorversion=${MINOR_VERSION}`);

  const doFetch = async (accessToken: string) => {
    const resp = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await resp.text();
    if (!resp.ok) {
      if (resp.status === 401 && row.refresh_token) return { needRefresh: true, text };
      throw new Error(`QBO error: ${resp.status} ${text}`);
    }
    return JSON.parse(text || "{}");
  };

  let result = await doFetch(row.access_token);
  if (result?.needRefresh) {
    await refreshWithQbo(row.refresh_token!, ctx.userId, row.realmId);
    const latest = await getTokens(ctx.userId, "quickbooks");
    if (!latest?.access_token) throw new Error("Refresh succeeded but no access token");
    result = await doFetch(latest.access_token);
    if (result?.needRefresh) throw new Error("Unauthorized after refresh");
  }
  return result;
}

async function qbQuery(sql: string) {
  const q = encodeURIComponent(sql);
  return qbRequest(`query?query=${q}`, { method: "GET" });
}

// ----- Helpers: entity fetch for SyncToken (needed for sparse update) -----
async function getCustomerRaw(id: string) {
  const data = await qbRequest(`customer/${id}`, { method: "GET" });
  return (data as any)?.Customer;
}
async function getAccountRaw(id: string) {
  const data = await qbRequest(`account/${id}`, { method: "GET" });
  return (data as any)?.Account;
}

// ----- Mappers -----
function mapCustomerInputToQBO(input: any) {
  const qbo: any = {};
  if (input.displayName) qbo.DisplayName = input.displayName;
  if (input.companyName) qbo.CompanyName = input.companyName;
  if (input.title) qbo.Title = input.title;
  if (input.givenName) qbo.GivenName = input.givenName;
  if (input.middleName) qbo.MiddleName = input.middleName;
  if (input.familyName) qbo.FamilyName = input.familyName;
  if (input.suffix) qbo.Suffix = input.suffix;
  if (typeof input.taxExempt === "boolean") qbo.Taxable = !input.taxExempt;
  if (input.notes) qbo.Notes = input.notes;

  if (input.primaryEmail) qbo.PrimaryEmailAddr = { Address: input.primaryEmail };
  if (input.primaryPhone) qbo.PrimaryPhone = { FreeFormNumber: input.primaryPhone };
  if (input.mobilePhone) qbo.Mobile = { FreeFormNumber: input.mobilePhone };
  if (input.fax) qbo.Fax = { FreeFormNumber: input.fax };

  if (input.billAddr) {
    const b = input.billAddr;
    qbo.BillAddr = {
      Line1: b.line1,
      Line2: b.line2,
      City: b.city,
      CountrySubDivisionCode: b.countrySubDivisionCode,
      PostalCode: b.postalCode,
      Country: b.country,
    };
  }
  if (input.shipAddr) {
    const s = input.shipAddr;
    qbo.ShipAddr = {
      Line1: s.line1,
      Line2: s.line2,
      City: s.city,
      CountrySubDivisionCode: s.countrySubDivisionCode,
      PostalCode: s.postalCode,
      Country: s.country,
    };
  }
  return qbo;
}

function mapAccountInputToQBO(input: any) {
  const qbo: any = {};
  if (input.name) qbo.Name = input.name;
  if (input.description) qbo.Description = input.description;
  if (input.accountType) qbo.AccountType = input.accountType; // e.g. "Bank", "Income", "Expense"
  if (input.accountSubType) qbo.AccountSubType = input.accountSubType; // e.g. "Checking"
  if (typeof input.active === "boolean") qbo.Active = input.active;
  if (input.classification) qbo.Classification = input.classification; // "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"
  // ParentRef, SubAccount, FullyQualifiedName etc. can be added as needed
  return qbo;
}

// ----- Zod Schemas -----
const paginationSchema = z.object({
  startPosition: z.number().int().min(1).default(1).describe("Query start position (1-based)"),
  maxResults: z.number().int().min(1).max(1000).default(50).describe("Max results (1-1000)"),
});

// Customers
const customerCreateSchema = z.object({
  displayName: z.string().min(1),
  title: z.string().optional(),
  givenName: z.string().optional(),
  middleName: z.string().optional(),
  familyName: z.string().optional(),
  suffix: z.string().optional(),
  companyName: z.string().optional(),
  primaryEmail: z.string().email().optional(),
  primaryPhone: z.string().optional(),
  mobilePhone: z.string().optional(),
  fax: z.string().optional(),
  notes: z.string().optional(),
  taxExempt: z.boolean().optional(),
  billAddr: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      countrySubDivisionCode: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  shipAddr: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      countrySubDivisionCode: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});

const customerUpdateSchema = customerCreateSchema.extend({
  customerId: z.string().min(1),
  sparse: z.boolean().default(true),
});

const customerSearchSchema = z.object({
  startPosition: paginationSchema.shape.startPosition,
  maxResults: paginationSchema.shape.maxResults,
  displayName: z.string().optional(),
  companyName: z.string().optional(),
  givenName: z.string().optional(),
  familyName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  activeOnly: z.boolean().default(true),
  orderBy: z.enum(["Id", "DisplayName", "Metadata.LastUpdatedTime"]).default("Metadata.LastUpdatedTime"),
  sort: z.enum(["ASC", "DESC"]).default("DESC"),
});

// Accounts
const accountCreateSchema = z.object({
  name: z.string().min(1),
  accountType: z.string().min(1).describe("QBO AccountType, e.g. Bank, Income, Expense"),
  accountSubType: z.string().optional().describe("QBO AccountSubType, e.g. Checking"),
  description: z.string().optional(),
  classification: z
    .enum(["Asset", "Liability", "Equity", "Revenue", "Expense"])
    .optional(),
  active: z.boolean().optional(),
});

const accountUpdateSchema = accountCreateSchema.extend({
  accountId: z.string().min(1),
  sparse: z.boolean().default(true),
});

const accountSearchSchema = z.object({
  startPosition: paginationSchema.shape.startPosition,
  maxResults: paginationSchema.shape.maxResults,
  name: z.string().optional(),
  accountType: z.string().optional(),
  accountSubType: z.string().optional(),
  classification: z.enum(["Asset", "Liability", "Equity", "Revenue", "Expense"]).optional(),
  activeOnly: z.boolean().default(true),
  orderBy: z.enum(["Id", "Name", "FullyQualifiedName", "Metadata.LastUpdatedTime"]).default("Metadata.LastUpdatedTime"),
  sort: z.enum(["ASC", "DESC"]).default("DESC"),
});

// ─── MCP server (TOOLS) ───────────────────────────────────────────────────────
function createMcpServer() {
  const server = new McpServer({ name: "quickbooks", version: "1.0.0", capabilities: { tools: {} } });

  // -------------------- CUSTOMERS --------------------

  server.tool(
    "get_customer_by_id",
    "Fetch a QuickBooks customer by ID",
    { customerId: z.string().min(1) },
    async ({ customerId }) => {
      const data: any = await qbRequest(`customer/${customerId}`);
      const customer = data?.Customer ?? data;
      return { content: [{ type: "text", text: JSON.stringify(customer, null, 2) }] };
    }
  );

  server.tool(
    "list_customers",
    "List customers using the QBO query endpoint (paged)",
    paginationSchema.shape,
    async ({ startPosition, maxResults }) => {
      const sql = `SELECT * FROM Customer ORDER BY Metadata.LastUpdatedTime DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const data: any = await qbQuery(sql);
      const customers = data?.QueryResponse?.Customer ?? [];
      return { content: [{ type: "text", text: JSON.stringify(customers, null, 2) }] };
    }
  );

  server.tool(
    "search_customers",
    "Search customers by name/email/phone/active with pagination",
    customerSearchSchema.shape,
    async (params) => {
      const {
        displayName, companyName, givenName, familyName, email, phone,
        activeOnly, startPosition, maxResults, orderBy, sort
      } = params as z.infer<typeof customerSearchSchema>;

      const esc = (s: string) => s.replace(/'/g, "\\'");
      const conditions: string[] = [];
      if (typeof activeOnly === "boolean") conditions.push(`Active = ${activeOnly ? "true" : "false"}`);
      if (displayName) conditions.push(`DisplayName LIKE '${esc(displayName)}%'`);
      if (companyName) conditions.push(`CompanyName LIKE '${esc(companyName)}%'`);
      if (givenName) conditions.push(`GivenName LIKE '${esc(givenName)}%'`);
      if (familyName) conditions.push(`FamilyName LIKE '${esc(familyName)}%'`);
      if (email) conditions.push(`PrimaryEmailAddr.Address LIKE '${esc(email)}%'`);
      if (phone) conditions.push(`PrimaryPhone.FreeFormNumber LIKE '${esc(phone)}%'`);

      const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
      const sql = `SELECT * FROM Customer${where} ORDER BY ${orderBy} ${sort} STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const data: any = await qbQuery(sql);
      const customers = data?.QueryResponse?.Customer ?? [];
      return { content: [{ type: "text", text: JSON.stringify(customers, null, 2) }] };
    }
  );

  server.tool(
    "create_customer",
    "Create a new QuickBooks customer",
    customerCreateSchema.shape,
    async (input) => {
      const body = mapCustomerInputToQBO(input);
      const data: any = await qbRequest("customer", { method: "POST", body });
      const created = data?.Customer ?? data;
      return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
    }
  );

  server.tool(
    "update_customer",
    "Update an existing QuickBooks customer (sparse by default)",
    customerUpdateSchema.shape,
    async (input) => {
      const { customerId, sparse = true, ...patch } = input as any;
      const existing = await getCustomerRaw(customerId);
      if (!existing?.Id || existing.SyncToken === undefined) {
        throw new Error("Could not fetch existing customer or SyncToken.");
      }
      const body = {
        Id: existing.Id,
        SyncToken: existing.SyncToken,
        ...(sparse ? { sparse: true } : {}),
        ...mapCustomerInputToQBO(patch),
      };
      const data: any = await qbRequest("customer?operation=update", { method: "POST", body });
      const updated = data?.Customer ?? data;
      return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    "set_customer_active",
    "Activate or deactivate a customer (Active=true/false)",
    { customerId: z.string().min(1), active: z.boolean() },
    async ({ customerId, active }) => {
      const existing = await getCustomerRaw(customerId);
      if (!existing?.Id || existing.SyncToken === undefined) {
        throw new Error("Could not fetch existing customer or SyncToken.");
      }
      const body = {
        Id: existing.Id,
        SyncToken: existing.SyncToken,
        sparse: true,
        Active: active,
      };
      const data: any = await qbRequest("customer?operation=update", { method: "POST", body });
      const updated = data?.Customer ?? data;
      return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    "get_customer_by_display_name",
    "Fetch a single customer by exact DisplayName",
    { displayName: z.string().min(1) },
    async ({ displayName }) => {
      const safe = displayName.replace(/'/g, "\\'");
      const sql = `SELECT * FROM Customer WHERE DisplayName = '${safe}'`;
      const data: any = await qbQuery(sql);
      const customers = data?.QueryResponse?.Customer ?? [];
      const hit = customers[0] ?? null;
      return { content: [{ type: "text", text: JSON.stringify(hit, null, 2) }] };
    }
  );

  // -------------------- ACCOUNTS --------------------

  server.tool(
    "get_account_by_id",
    "Fetch a QuickBooks account by ID",
    { accountId: z.string().min(1) },
    async ({ accountId }) => {
      const data: any = await qbRequest(`account/${accountId}`);
      const account = data?.Account ?? data;
      return { content: [{ type: "text", text: JSON.stringify(account, null, 2) }] };
    }
  );

  server.tool(
    "list_accounts",
    "List accounts (paged) ordered by last update time",
    paginationSchema.shape,
    async ({ startPosition, maxResults }) => {
      const sql = `SELECT * FROM Account ORDER BY Metadata.LastUpdatedTime DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const data: any = await qbQuery(sql);
      const accounts = data?.QueryResponse?.Account ?? [];
      return { content: [{ type: "text", text: JSON.stringify(accounts, null, 2) }] };
    }
  );

  server.tool(
    "search_accounts",
    "Search accounts by name/type/subtype/classification/active with pagination",
    accountSearchSchema.shape,
    async (params) => {
      const {
        name, accountType, accountSubType, classification, activeOnly,
        startPosition, maxResults, orderBy, sort
      } = params as z.infer<typeof accountSearchSchema>;

      const esc = (s: string) => s.replace(/'/g, "\\'");
      const conditions: string[] = [];
      if (typeof activeOnly === "boolean") conditions.push(`Active = ${activeOnly ? "true" : "false"}`);
      if (name) conditions.push(`Name LIKE '${esc(name)}%'`);
      if (accountType) conditions.push(`AccountType = '${esc(accountType)}'`);
      if (accountSubType) conditions.push(`AccountSubType = '${esc(accountSubType)}'`);
      if (classification) conditions.push(`Classification = '${classification}'`);

      const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
      const sql = `SELECT * FROM Account${where} ORDER BY ${orderBy} ${sort} STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const data: any = await qbQuery(sql);
      const accounts = data?.QueryResponse?.Account ?? [];
      return { content: [{ type: "text", text: JSON.stringify(accounts, null, 2) }] };
    }
  );

  server.tool(
    "create_account",
    "Create a new QuickBooks account",
    accountCreateSchema.shape,
    async (input) => {
      const body = mapAccountInputToQBO(input);
      const data: any = await qbRequest("account", { method: "POST", body });
      const created = data?.Account ?? data;
      return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
    }
  );

  server.tool(
    "update_account",
    "Update an existing QuickBooks account (sparse by default)",
    accountUpdateSchema.shape,
    async (input) => {
      const { accountId, sparse = true, ...patch } = input as any;
      const existing = await getAccountRaw(accountId);
      if (!existing?.Id || existing.SyncToken === undefined) {
        throw new Error("Could not fetch existing account or SyncToken.");
      }
      const body = {
        Id: existing.Id,
        SyncToken: existing.SyncToken,
        ...(sparse ? { sparse: true } : {}),
        ...mapAccountInputToQBO(patch),
      };
      const data: any = await qbRequest("account?operation=update", { method: "POST", body });
      const updated = data?.Account ?? data;
      return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    "set_account_active",
    "Activate or deactivate an account (Active=true/false)",
    { accountId: z.string().min(1), active: z.boolean() },
    async ({ accountId, active }) => {
      const existing = await getAccountRaw(accountId);
      if (!existing?.Id || existing.SyncToken === undefined) {
        throw new Error("Could not fetch existing account or SyncToken.");
      }
      const body = {
        Id: existing.Id,
        SyncToken: existing.SyncToken,
        sparse: true,
        Active: active,
      };
      const data: any = await qbRequest("account?operation=update", { method: "POST", body });
      const updated = data?.Account ?? data;
      return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    "get_account_by_name",
    "Fetch a single account whose Name matches exactly",
    { name: z.string().min(1) },
    async ({ name }) => {
      const safe = name.replace(/'/g, "\\'");
      const sql = `SELECT * FROM Account WHERE Name = '${safe}'`;
      const data: any = await qbQuery(sql);
      const accounts = data?.QueryResponse?.Account ?? [];
      const hit = accounts[0] ?? null;
      return { content: [{ type: "text", text: JSON.stringify(hit, null, 2) }] };
    }
  );

  return server;
}

// ─── Express with SSE/messages ────────────────────────────────────────────────
function createApp() {
  const app = express();
  app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
  app.use(helmet());
  app.use(express.json());

  const activeTransports = new Map<string, any>();

  app.get("/", (_req, res) => res.json({ ok: true, service: "quickbooks-mcp" }));

  app.get("/sse", async (req, res) => {
    const sess = requireSession(req, res);
    if (!sess) return;

    try {
      // IMPORTANT: Do NOT set headers here. SSEServerTransport will set them.
      const server = createMcpServer();
      const transport = new SSEServerTransport("/messages", res);

      const sessionId = transport.sessionId || "default";
      activeTransports.set(sessionId, transport);

      res.on("close", () => {
        activeTransports.delete(sessionId);
      });

      await new Promise<void>((resolve, reject) => {
        ctxStore.run(sess, async () => {
          try {
            await server.connect(transport);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    } catch (err) {
      console.error("SSE error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "sse_failed" });
      } else {
        try { res.end(); } catch {}
      }
    }
  });

  app.post("/messages", async (req, res) => {
    const sess = requireSession(req, res);
    if (!sess) return;

    const sessionId = (req.query.sessionId as string) || "default";
    const transport = activeTransports.get(sessionId);
    if (!transport) return res.status(400).json({ error: "no_active_transport" });

    await new Promise<void>((resolve, reject) => {
      ctxStore.run(sess, async () => {
        try {
          await transport.handlePostMessage(req, res, req.body);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  });

  return app;
}

const app = createApp();

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`MCP on http://localhost:${PORT}  (SSE: /sse, messages: /messages)`);
  });
}

export default app;
