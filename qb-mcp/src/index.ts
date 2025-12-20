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

// Use production API by default, set QB_USE_SANDBOX=true for sandbox
const QB_API_BASE = process.env.QB_USE_SANDBOX === "true"
  ? "https://sandbox-quickbooks.api.intuit.com"
  : "https://quickbooks.api.intuit.com";

// Per-request context
type Ctx = { userId: string };
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
    const decoded = jwt.verify(token, SESSION_JWT_SECRET) as { userId?: string | number };
    if (!decoded?.userId) throw new Error("no userId");
    // Convert to string to support both legacy number IDs and new UUID IDs
    return { userId: String(decoded.userId) };
  } catch {
    if (!res.headersSent) {
      res.status(401).json({ error: "invalid_session" });
    }
    return null;
  }
}

async function refreshWithQbo(refresh_token: string, userId: string, realmId?: string | null) {
  console.log(`[refreshWithQbo] Attempting token refresh for user ${userId}`);
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
    console.error(`[refreshWithQbo] Refresh failed: ${resp.status} ${t}`);
    throw new Error(`QBO refresh failed: ${resp.status} ${t}`);
  }
  const data = (await resp.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  const now = Math.floor(Date.now() / 1000);
  const expires_at = data.expires_in ? now + data.expires_in : null;

  console.log(`[refreshWithQbo] Refresh successful, new token expires at ${expires_at}`);
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

  const base = `${QB_API_BASE}/v3/company/${row.realmId}/${endpoint}`;
  const url =
    base + (base.includes("?") ? `&minorversion=${MINOR_VERSION}` : `?minorversion=${MINOR_VERSION}`);

  const doFetch = async (accessToken: string) => {
    console.log(`[qbRequest] ${opts.method ?? "GET"} ${url}`);
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
    console.log(`[qbRequest] Response: ${resp.status} ${text.substring(0, 200)}`);
    if (!resp.ok) {
      // QuickBooks returns 401 for expired tokens, but sometimes 400 with error code 3100
      const isAuthError = resp.status === 401 ||
        (resp.status === 400 && text.includes("3100"));
      if (isAuthError && row.refresh_token) {
        console.log("[qbRequest] Auth error detected, will attempt refresh");
        return { needRefresh: true, text };
      }
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

  // -------------------- INVOICES --------------------

  server.tool(
    "list_invoices",
    "List invoices with pagination",
    paginationSchema.shape,
    async ({ startPosition, maxResults }) => {
      const sql = `SELECT * FROM Invoice ORDER BY Metadata.LastUpdatedTime DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const data: any = await qbQuery(sql);
      const invoices = data?.QueryResponse?.Invoice ?? [];
      return { content: [{ type: "text", text: JSON.stringify(invoices, null, 2) }] };
    }
  );

  server.tool(
    "get_invoice_by_id",
    "Fetch an invoice by ID",
    { invoiceId: z.string().min(1) },
    async ({ invoiceId }) => {
      const data: any = await qbRequest(`invoice/${invoiceId}`);
      const invoice = data?.Invoice ?? data;
      return { content: [{ type: "text", text: JSON.stringify(invoice, null, 2) }] };
    }
  );

  server.tool(
    "search_invoices",
    "Search invoices by customer, date range, or status",
    {
      startPosition: paginationSchema.shape.startPosition,
      maxResults: paginationSchema.shape.maxResults,
      customerId: z.string().optional().describe("Filter by customer ID"),
      customerName: z.string().optional().describe("Filter by customer name (partial match)"),
      startDate: z.string().optional().describe("Filter invoices from this date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("Filter invoices up to this date (YYYY-MM-DD)"),
      status: z.enum(["Paid", "Open", "Overdue", "Pending"]).optional().describe("Filter by balance status"),
    },
    async (params) => {
      const { customerId, customerName, startDate, endDate, status, startPosition, maxResults } = params;
      const esc = (s: string) => s.replace(/'/g, "\\'");
      const conditions: string[] = [];

      if (customerId) conditions.push(`CustomerRef = '${esc(customerId)}'`);
      if (customerName) conditions.push(`CustomerRef.name LIKE '%${esc(customerName)}%'`);
      if (startDate) conditions.push(`TxnDate >= '${startDate}'`);
      if (endDate) conditions.push(`TxnDate <= '${endDate}'`);
      if (status === "Paid") conditions.push("Balance = '0'");
      if (status === "Open") conditions.push("Balance > '0'");

      const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
      const sql = `SELECT * FROM Invoice${where} ORDER BY Metadata.LastUpdatedTime DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const data: any = await qbQuery(sql);
      const invoices = data?.QueryResponse?.Invoice ?? [];
      return { content: [{ type: "text", text: JSON.stringify(invoices, null, 2) }] };
    }
  );

  server.tool(
    "create_invoice",
    "Create a new invoice for a customer",
    {
      customerId: z.string().min(1).describe("The customer ID to invoice"),
      lineItems: z.array(z.object({
        description: z.string().optional(),
        amount: z.number().describe("Line total amount"),
        detailType: z.enum(["SalesItemLineDetail", "DescriptionOnly"]).default("SalesItemLineDetail"),
        itemId: z.string().optional().describe("Item/Service ID if SalesItemLineDetail"),
        quantity: z.number().optional(),
        unitPrice: z.number().optional(),
      })).min(1).describe("Invoice line items"),
      dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      txnDate: z.string().optional().describe("Transaction date (YYYY-MM-DD)"),
      privateNote: z.string().optional().describe("Internal memo"),
      customerMemo: z.string().optional().describe("Message to customer"),
    },
    async (input) => {
      const lines = input.lineItems.map((li, idx) => {
        const line: any = {
          Id: String(idx + 1),
          Amount: li.amount,
          DetailType: li.detailType,
        };
        if (li.detailType === "SalesItemLineDetail") {
          line.SalesItemLineDetail = {
            ItemRef: li.itemId ? { value: li.itemId } : undefined,
            Qty: li.quantity,
            UnitPrice: li.unitPrice,
          };
        }
        if (li.description) line.Description = li.description;
        return line;
      });

      const body: any = {
        CustomerRef: { value: input.customerId },
        Line: lines,
      };
      if (input.dueDate) body.DueDate = input.dueDate;
      if (input.txnDate) body.TxnDate = input.txnDate;
      if (input.privateNote) body.PrivateNote = input.privateNote;
      if (input.customerMemo) body.CustomerMemo = { value: input.customerMemo };

      const data: any = await qbRequest("invoice", { method: "POST", body });
      const created = data?.Invoice ?? data;
      return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
    }
  );

  server.tool(
    "update_invoice",
    "Update an existing invoice",
    {
      invoiceId: z.string().min(1),
      dueDate: z.string().optional().describe("New due date (YYYY-MM-DD)"),
      privateNote: z.string().optional(),
      customerMemo: z.string().optional(),
    },
    async (input) => {
      // Fetch existing for SyncToken
      const existing: any = await qbRequest(`invoice/${input.invoiceId}`);
      const inv = existing?.Invoice;
      if (!inv?.Id || inv.SyncToken === undefined) {
        throw new Error("Could not fetch existing invoice or SyncToken.");
      }

      const body: any = {
        Id: inv.Id,
        SyncToken: inv.SyncToken,
        sparse: true,
      };
      if (input.dueDate) body.DueDate = input.dueDate;
      if (input.privateNote) body.PrivateNote = input.privateNote;
      if (input.customerMemo) body.CustomerMemo = { value: input.customerMemo };

      const data: any = await qbRequest("invoice?operation=update", { method: "POST", body });
      const updated = data?.Invoice ?? data;
      return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    "delete_invoice",
    "Void/delete an invoice",
    { invoiceId: z.string().min(1) },
    async ({ invoiceId }) => {
      const existing: any = await qbRequest(`invoice/${invoiceId}`);
      const inv = existing?.Invoice;
      if (!inv?.Id || inv.SyncToken === undefined) {
        throw new Error("Could not fetch existing invoice or SyncToken.");
      }

      const body = { Id: inv.Id, SyncToken: inv.SyncToken };
      const data: any = await qbRequest("invoice?operation=delete", { method: "POST", body });
      return { content: [{ type: "text", text: JSON.stringify({ deleted: true, ...data }, null, 2) }] };
    }
  );

  server.tool(
    "send_invoice",
    "Email an invoice to the customer",
    {
      invoiceId: z.string().min(1),
      emailTo: z.string().email().optional().describe("Override recipient email"),
    },
    async ({ invoiceId, emailTo }) => {
      const endpoint = emailTo
        ? `invoice/${invoiceId}/send?sendTo=${encodeURIComponent(emailTo)}`
        : `invoice/${invoiceId}/send`;
      const data: any = await qbRequest(endpoint, { method: "POST" });
      const sent = data?.Invoice ?? data;
      return { content: [{ type: "text", text: JSON.stringify({ sent: true, ...sent }, null, 2) }] };
    }
  );

  server.tool(
    "get_invoice_pdf",
    "Get invoice PDF download URL",
    { invoiceId: z.string().min(1) },
    async ({ invoiceId }) => {
      const ctx = ctxStore.getStore();
      if (!ctx) throw new Error("Missing request context");
      const row = await getTokens(ctx.userId, "quickbooks");
      if (!row?.realmId) throw new Error("QuickBooks not connected");

      const pdfUrl = `${QB_API_BASE}/v3/company/${row.realmId}/invoice/${invoiceId}/pdf?minorversion=${MINOR_VERSION}`;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            invoiceId,
            pdfUrl,
            note: "Use Bearer token to download. URL valid with current access token.",
          }, null, 2)
        }]
      };
    }
  );

  // -------------------- PAYMENTS --------------------

  server.tool(
    "list_payments",
    "List received payments with pagination",
    paginationSchema.shape,
    async ({ startPosition, maxResults }) => {
      const sql = `SELECT * FROM Payment ORDER BY Metadata.LastUpdatedTime DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const data: any = await qbQuery(sql);
      const payments = data?.QueryResponse?.Payment ?? [];
      return { content: [{ type: "text", text: JSON.stringify(payments, null, 2) }] };
    }
  );

  server.tool(
    "get_payment_by_id",
    "Fetch a payment by ID",
    { paymentId: z.string().min(1) },
    async ({ paymentId }) => {
      const data: any = await qbRequest(`payment/${paymentId}`);
      const payment = data?.Payment ?? data;
      return { content: [{ type: "text", text: JSON.stringify(payment, null, 2) }] };
    }
  );

  server.tool(
    "create_payment",
    "Record a customer payment",
    {
      customerId: z.string().min(1).describe("Customer ID making the payment"),
      totalAmount: z.number().describe("Total payment amount"),
      paymentMethodRef: z.string().optional().describe("Payment method ID (Cash, Check, Credit Card, etc.)"),
      depositToAccountId: z.string().optional().describe("Account ID to deposit payment to"),
      invoiceIds: z.array(z.string()).optional().describe("Invoice IDs this payment applies to"),
      txnDate: z.string().optional().describe("Payment date (YYYY-MM-DD)"),
      privateNote: z.string().optional(),
    },
    async (input) => {
      const body: any = {
        CustomerRef: { value: input.customerId },
        TotalAmt: input.totalAmount,
      };
      if (input.paymentMethodRef) body.PaymentMethodRef = { value: input.paymentMethodRef };
      if (input.depositToAccountId) body.DepositToAccountRef = { value: input.depositToAccountId };
      if (input.txnDate) body.TxnDate = input.txnDate;
      if (input.privateNote) body.PrivateNote = input.privateNote;

      if (input.invoiceIds?.length) {
        body.Line = input.invoiceIds.map((invId) => ({
          Amount: input.totalAmount / input.invoiceIds!.length, // split evenly or adjust as needed
          LinkedTxn: [{ TxnId: invId, TxnType: "Invoice" }],
        }));
      }

      const data: any = await qbRequest("payment", { method: "POST", body });
      const created = data?.Payment ?? data;
      return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
    }
  );

  server.tool(
    "update_payment",
    "Update an existing payment",
    {
      paymentId: z.string().min(1),
      totalAmount: z.number().optional(),
      privateNote: z.string().optional(),
    },
    async (input) => {
      const existing: any = await qbRequest(`payment/${input.paymentId}`);
      const pay = existing?.Payment;
      if (!pay?.Id || pay.SyncToken === undefined) {
        throw new Error("Could not fetch existing payment or SyncToken.");
      }

      const body: any = {
        Id: pay.Id,
        SyncToken: pay.SyncToken,
        sparse: true,
      };
      if (input.totalAmount !== undefined) body.TotalAmt = input.totalAmount;
      if (input.privateNote) body.PrivateNote = input.privateNote;

      const data: any = await qbRequest("payment?operation=update", { method: "POST", body });
      const updated = data?.Payment ?? data;
      return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    "void_payment",
    "Void a payment",
    { paymentId: z.string().min(1) },
    async ({ paymentId }) => {
      const existing: any = await qbRequest(`payment/${paymentId}`);
      const pay = existing?.Payment;
      if (!pay?.Id || pay.SyncToken === undefined) {
        throw new Error("Could not fetch existing payment or SyncToken.");
      }

      const body = { Id: pay.Id, SyncToken: pay.SyncToken };
      const data: any = await qbRequest("payment?operation=delete", { method: "POST", body });
      return { content: [{ type: "text", text: JSON.stringify({ voided: true, ...data }, null, 2) }] };
    }
  );

  // -------------------- VENDORS --------------------

  server.tool(
    "list_vendors",
    "List vendors with pagination",
    paginationSchema.shape,
    async ({ startPosition, maxResults }) => {
      const sql = `SELECT * FROM Vendor ORDER BY Metadata.LastUpdatedTime DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const data: any = await qbQuery(sql);
      const vendors = data?.QueryResponse?.Vendor ?? [];
      return { content: [{ type: "text", text: JSON.stringify(vendors, null, 2) }] };
    }
  );

  server.tool(
    "get_vendor_by_id",
    "Fetch a vendor by ID",
    { vendorId: z.string().min(1) },
    async ({ vendorId }) => {
      const data: any = await qbRequest(`vendor/${vendorId}`);
      const vendor = data?.Vendor ?? data;
      return { content: [{ type: "text", text: JSON.stringify(vendor, null, 2) }] };
    }
  );

  server.tool(
    "search_vendors",
    "Search vendors by name or other criteria",
    {
      startPosition: paginationSchema.shape.startPosition,
      maxResults: paginationSchema.shape.maxResults,
      displayName: z.string().optional(),
      companyName: z.string().optional(),
      activeOnly: z.boolean().default(true),
    },
    async (params) => {
      const { displayName, companyName, activeOnly, startPosition, maxResults } = params;
      const esc = (s: string) => s.replace(/'/g, "\\'");
      const conditions: string[] = [];

      if (typeof activeOnly === "boolean") conditions.push(`Active = ${activeOnly ? "true" : "false"}`);
      if (displayName) conditions.push(`DisplayName LIKE '${esc(displayName)}%'`);
      if (companyName) conditions.push(`CompanyName LIKE '${esc(companyName)}%'`);

      const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
      const sql = `SELECT * FROM Vendor${where} ORDER BY Metadata.LastUpdatedTime DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const data: any = await qbQuery(sql);
      const vendors = data?.QueryResponse?.Vendor ?? [];
      return { content: [{ type: "text", text: JSON.stringify(vendors, null, 2) }] };
    }
  );

  server.tool(
    "create_vendor",
    "Create a new vendor",
    {
      displayName: z.string().min(1),
      companyName: z.string().optional(),
      givenName: z.string().optional(),
      familyName: z.string().optional(),
      primaryEmail: z.string().email().optional(),
      primaryPhone: z.string().optional(),
      notes: z.string().optional(),
    },
    async (input) => {
      const body: any = { DisplayName: input.displayName };
      if (input.companyName) body.CompanyName = input.companyName;
      if (input.givenName) body.GivenName = input.givenName;
      if (input.familyName) body.FamilyName = input.familyName;
      if (input.primaryEmail) body.PrimaryEmailAddr = { Address: input.primaryEmail };
      if (input.primaryPhone) body.PrimaryPhone = { FreeFormNumber: input.primaryPhone };
      if (input.notes) body.Notes = input.notes;

      const data: any = await qbRequest("vendor", { method: "POST", body });
      const created = data?.Vendor ?? data;
      return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
    }
  );

  server.tool(
    "update_vendor",
    "Update an existing vendor",
    {
      vendorId: z.string().min(1),
      displayName: z.string().optional(),
      companyName: z.string().optional(),
      primaryEmail: z.string().email().optional(),
      primaryPhone: z.string().optional(),
      notes: z.string().optional(),
    },
    async (input) => {
      const existing: any = await qbRequest(`vendor/${input.vendorId}`);
      const ven = existing?.Vendor;
      if (!ven?.Id || ven.SyncToken === undefined) {
        throw new Error("Could not fetch existing vendor or SyncToken.");
      }

      const body: any = {
        Id: ven.Id,
        SyncToken: ven.SyncToken,
        sparse: true,
      };
      if (input.displayName) body.DisplayName = input.displayName;
      if (input.companyName) body.CompanyName = input.companyName;
      if (input.primaryEmail) body.PrimaryEmailAddr = { Address: input.primaryEmail };
      if (input.primaryPhone) body.PrimaryPhone = { FreeFormNumber: input.primaryPhone };
      if (input.notes) body.Notes = input.notes;

      const data: any = await qbRequest("vendor?operation=update", { method: "POST", body });
      const updated = data?.Vendor ?? data;
      return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    "set_vendor_active",
    "Activate or deactivate a vendor",
    { vendorId: z.string().min(1), active: z.boolean() },
    async ({ vendorId, active }) => {
      const existing: any = await qbRequest(`vendor/${vendorId}`);
      const ven = existing?.Vendor;
      if (!ven?.Id || ven.SyncToken === undefined) {
        throw new Error("Could not fetch existing vendor or SyncToken.");
      }

      const body = {
        Id: ven.Id,
        SyncToken: ven.SyncToken,
        sparse: true,
        Active: active,
      };
      const data: any = await qbRequest("vendor?operation=update", { method: "POST", body });
      const updated = data?.Vendor ?? data;
      return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    }
  );

  // -------------------- BILLS --------------------

  server.tool(
    "list_bills",
    "List bills/payables with pagination",
    paginationSchema.shape,
    async ({ startPosition, maxResults }) => {
      const sql = `SELECT * FROM Bill ORDER BY Metadata.LastUpdatedTime DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const data: any = await qbQuery(sql);
      const bills = data?.QueryResponse?.Bill ?? [];
      return { content: [{ type: "text", text: JSON.stringify(bills, null, 2) }] };
    }
  );

  server.tool(
    "get_bill_by_id",
    "Fetch a bill by ID",
    { billId: z.string().min(1) },
    async ({ billId }) => {
      const data: any = await qbRequest(`bill/${billId}`);
      const bill = data?.Bill ?? data;
      return { content: [{ type: "text", text: JSON.stringify(bill, null, 2) }] };
    }
  );

  server.tool(
    "create_bill",
    "Create a bill from a vendor",
    {
      vendorId: z.string().min(1).describe("Vendor ID"),
      lineItems: z.array(z.object({
        amount: z.number(),
        description: z.string().optional(),
        accountId: z.string().optional().describe("Expense account ID"),
      })).min(1),
      dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      txnDate: z.string().optional().describe("Bill date (YYYY-MM-DD)"),
      privateNote: z.string().optional(),
    },
    async (input) => {
      const lines = input.lineItems.map((li, idx) => {
        const line: any = {
          Id: String(idx + 1),
          Amount: li.amount,
          DetailType: "AccountBasedExpenseLineDetail",
          AccountBasedExpenseLineDetail: {},
        };
        if (li.accountId) {
          line.AccountBasedExpenseLineDetail.AccountRef = { value: li.accountId };
        }
        if (li.description) line.Description = li.description;
        return line;
      });

      const body: any = {
        VendorRef: { value: input.vendorId },
        Line: lines,
      };
      if (input.dueDate) body.DueDate = input.dueDate;
      if (input.txnDate) body.TxnDate = input.txnDate;
      if (input.privateNote) body.PrivateNote = input.privateNote;

      const data: any = await qbRequest("bill", { method: "POST", body });
      const created = data?.Bill ?? data;
      return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
    }
  );

  server.tool(
    "update_bill",
    "Update an existing bill",
    {
      billId: z.string().min(1),
      dueDate: z.string().optional(),
      privateNote: z.string().optional(),
    },
    async (input) => {
      const existing: any = await qbRequest(`bill/${input.billId}`);
      const bill = existing?.Bill;
      if (!bill?.Id || bill.SyncToken === undefined) {
        throw new Error("Could not fetch existing bill or SyncToken.");
      }

      const body: any = {
        Id: bill.Id,
        SyncToken: bill.SyncToken,
        sparse: true,
      };
      if (input.dueDate) body.DueDate = input.dueDate;
      if (input.privateNote) body.PrivateNote = input.privateNote;

      const data: any = await qbRequest("bill?operation=update", { method: "POST", body });
      const updated = data?.Bill ?? data;
      return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    "pay_bill",
    "Record a bill payment",
    {
      vendorId: z.string().min(1).describe("Vendor ID"),
      billIds: z.array(z.string()).min(1).describe("Bill IDs to pay"),
      totalAmount: z.number().describe("Total payment amount"),
      paymentAccountId: z.string().describe("Bank account ID to pay from"),
      txnDate: z.string().optional().describe("Payment date (YYYY-MM-DD)"),
    },
    async (input) => {
      const body: any = {
        VendorRef: { value: input.vendorId },
        TotalAmt: input.totalAmount,
        APAccountRef: { value: input.paymentAccountId },
        Line: input.billIds.map((billId) => ({
          Amount: input.totalAmount / input.billIds.length,
          LinkedTxn: [{ TxnId: billId, TxnType: "Bill" }],
        })),
      };
      if (input.txnDate) body.TxnDate = input.txnDate;

      const data: any = await qbRequest("billpayment", { method: "POST", body });
      const created = data?.BillPayment ?? data;
      return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
    }
  );

  // -------------------- ITEMS/PRODUCTS --------------------

  server.tool(
    "list_items",
    "List products/services with pagination",
    paginationSchema.shape,
    async ({ startPosition, maxResults }) => {
      const sql = `SELECT * FROM Item ORDER BY Metadata.LastUpdatedTime DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const data: any = await qbQuery(sql);
      const items = data?.QueryResponse?.Item ?? [];
      return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
    }
  );

  server.tool(
    "get_item_by_id",
    "Fetch an item/product by ID",
    { itemId: z.string().min(1) },
    async ({ itemId }) => {
      const data: any = await qbRequest(`item/${itemId}`);
      const item = data?.Item ?? data;
      return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
    }
  );

  server.tool(
    "search_items",
    "Search items by name or type",
    {
      startPosition: paginationSchema.shape.startPosition,
      maxResults: paginationSchema.shape.maxResults,
      name: z.string().optional(),
      type: z.enum(["Inventory", "Service", "NonInventory"]).optional(),
      activeOnly: z.boolean().default(true),
    },
    async (params) => {
      const { name, type, activeOnly, startPosition, maxResults } = params;
      const esc = (s: string) => s.replace(/'/g, "\\'");
      const conditions: string[] = [];

      if (typeof activeOnly === "boolean") conditions.push(`Active = ${activeOnly ? "true" : "false"}`);
      if (name) conditions.push(`Name LIKE '${esc(name)}%'`);
      if (type) conditions.push(`Type = '${type}'`);

      const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
      const sql = `SELECT * FROM Item${where} ORDER BY Metadata.LastUpdatedTime DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const data: any = await qbQuery(sql);
      const items = data?.QueryResponse?.Item ?? [];
      return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
    }
  );

  server.tool(
    "create_item",
    "Create an inventory or service item",
    {
      name: z.string().min(1),
      type: z.enum(["Inventory", "Service", "NonInventory"]).default("Service"),
      description: z.string().optional(),
      unitPrice: z.number().optional().describe("Sales price"),
      purchaseCost: z.number().optional().describe("Purchase cost for inventory"),
      incomeAccountId: z.string().optional().describe("Income account ID"),
      expenseAccountId: z.string().optional().describe("Expense/COGS account ID"),
      assetAccountId: z.string().optional().describe("Inventory asset account ID (for Inventory type)"),
      qtyOnHand: z.number().optional().describe("Initial quantity for inventory items"),
      invStartDate: z.string().optional().describe("Inventory start date (YYYY-MM-DD)"),
    },
    async (input) => {
      const body: any = {
        Name: input.name,
        Type: input.type,
      };
      if (input.description) body.Description = input.description;
      if (input.unitPrice !== undefined) body.UnitPrice = input.unitPrice;
      if (input.purchaseCost !== undefined) body.PurchaseCost = input.purchaseCost;
      if (input.incomeAccountId) body.IncomeAccountRef = { value: input.incomeAccountId };
      if (input.expenseAccountId) body.ExpenseAccountRef = { value: input.expenseAccountId };
      if (input.assetAccountId) body.AssetAccountRef = { value: input.assetAccountId };
      if (input.qtyOnHand !== undefined) body.QtyOnHand = input.qtyOnHand;
      if (input.invStartDate) body.InvStartDate = input.invStartDate;

      const data: any = await qbRequest("item", { method: "POST", body });
      const created = data?.Item ?? data;
      return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
    }
  );

  server.tool(
    "update_item",
    "Update an existing item",
    {
      itemId: z.string().min(1),
      name: z.string().optional(),
      description: z.string().optional(),
      unitPrice: z.number().optional(),
      purchaseCost: z.number().optional(),
    },
    async (input) => {
      const existing: any = await qbRequest(`item/${input.itemId}`);
      const item = existing?.Item;
      if (!item?.Id || item.SyncToken === undefined) {
        throw new Error("Could not fetch existing item or SyncToken.");
      }

      const body: any = {
        Id: item.Id,
        SyncToken: item.SyncToken,
        sparse: true,
      };
      if (input.name) body.Name = input.name;
      if (input.description) body.Description = input.description;
      if (input.unitPrice !== undefined) body.UnitPrice = input.unitPrice;
      if (input.purchaseCost !== undefined) body.PurchaseCost = input.purchaseCost;

      const data: any = await qbRequest("item?operation=update", { method: "POST", body });
      const updated = data?.Item ?? data;
      return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    "set_item_active",
    "Activate or deactivate an item",
    { itemId: z.string().min(1), active: z.boolean() },
    async ({ itemId, active }) => {
      const existing: any = await qbRequest(`item/${itemId}`);
      const item = existing?.Item;
      if (!item?.Id || item.SyncToken === undefined) {
        throw new Error("Could not fetch existing item or SyncToken.");
      }

      const body = {
        Id: item.Id,
        SyncToken: item.SyncToken,
        sparse: true,
        Active: active,
      };
      const data: any = await qbRequest("item?operation=update", { method: "POST", body });
      const updated = data?.Item ?? data;
      return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    }
  );

  // -------------------- REPORTS --------------------

  server.tool(
    "get_profit_loss",
    "Get Profit and Loss report",
    {
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
      accountingMethod: z.enum(["Cash", "Accrual"]).optional().default("Accrual"),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.startDate) queryParams.set("start_date", params.startDate);
      if (params.endDate) queryParams.set("end_date", params.endDate);
      if (params.accountingMethod) queryParams.set("accounting_method", params.accountingMethod);

      const endpoint = `reports/ProfitAndLoss${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
      const data: any = await qbRequest(endpoint);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_balance_sheet",
    "Get Balance Sheet report",
    {
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
      accountingMethod: z.enum(["Cash", "Accrual"]).optional().default("Accrual"),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.startDate) queryParams.set("start_date", params.startDate);
      if (params.endDate) queryParams.set("end_date", params.endDate);
      if (params.accountingMethod) queryParams.set("accounting_method", params.accountingMethod);

      const endpoint = `reports/BalanceSheet${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
      const data: any = await qbRequest(endpoint);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_cash_flow",
    "Get Cash Flow statement",
    {
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.startDate) queryParams.set("start_date", params.startDate);
      if (params.endDate) queryParams.set("end_date", params.endDate);

      const endpoint = `reports/CashFlow${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
      const data: any = await qbRequest(endpoint);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_ar_aging",
    "Get Accounts Receivable Aging Summary",
    {
      reportDate: z.string().optional().describe("Report as of date (YYYY-MM-DD)"),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.reportDate) queryParams.set("report_date", params.reportDate);

      const endpoint = `reports/AgedReceivables${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
      const data: any = await qbRequest(endpoint);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_ap_aging",
    "Get Accounts Payable Aging Summary",
    {
      reportDate: z.string().optional().describe("Report as of date (YYYY-MM-DD)"),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.reportDate) queryParams.set("report_date", params.reportDate);

      const endpoint = `reports/AgedPayables${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
      const data: any = await qbRequest(endpoint);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_trial_balance",
    "Get Trial Balance report",
    {
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.startDate) queryParams.set("start_date", params.startDate);
      if (params.endDate) queryParams.set("end_date", params.endDate);

      const endpoint = `reports/TrialBalance${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
      const data: any = await qbRequest(endpoint);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
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
