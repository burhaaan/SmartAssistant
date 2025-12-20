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

dotenv.config();

// Per-request context
type Ctx = { userId: string };
const ctxStore = new AsyncLocalStorage<Ctx>();

const PORT = Number(process.env.PORT || 3002);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const SESSION_JWT_SECRET = process.env.SESSION_JWT_SECRET!;
const SESSION_JWT_ISSUER = process.env.SESSION_JWT_ISSUER || "backend";
if (!SESSION_JWT_SECRET) throw new Error("Missing SESSION_JWT_SECRET");
const HP_API_KEY = process.env.HP_API_KEY!;
if (!HP_API_KEY) throw new Error("Missing HP_API_KEY");

// Stateless auth: validate short-lived JWT with audience "housecallpro-mcp"
function requireSession(req: express.Request, res: express.Response): { userId: string } | null {
  const rawHeader =
    (req.headers["authorization"] as string) ||
    (req.headers["x-session"] as string) ||
    "";

  const raw = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const token = raw.toLowerCase().startsWith("bearer ")
    ? raw.slice(7)
    : raw;

  try {
    const decoded = jwt.verify(token, SESSION_JWT_SECRET, {
      audience: "housecallpro-mcp",
      issuer: SESSION_JWT_ISSUER,
    }) as { userId?: string | number };

    if (!decoded?.userId) throw new Error("no userId");
    return { userId: String(decoded.userId) };
  } catch {
    if (!res.headersSent) {
      res.status(401).json({ error: "invalid_session" });
    }
    return null;
  }
}

async function hpRequest(
  endpoint: string,
  opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: any; params?: Record<string, any> } = {}
) {
  const ctx = ctxStore.getStore();
  if (!ctx) throw new Error("Missing request context");

  // Build URL with query parameters
  let url = `https://api.housecallpro.com${endpoint}`;
  if (opts.params) {
    const params = new URLSearchParams();
    Object.entries(opts.params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(`${key}[]`, String(v)));
      } else if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const resp = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${HP_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Housecall Pro API error: ${resp.status} ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

// ----- Zod Schemas -----
const paginationSchema = z.object({
  page: z.number().int().min(1).default(1).describe("Current page (1-based)"),
  page_size: z.number().int().min(1).max(100).default(10).describe("Results per page (1-100)"),
});

// Customers
const customerSearchSchema = z.object({
  q: z.string().optional().describe("Search query for customer name, email, mobile number, or address"),
  page: paginationSchema.shape.page,
  page_size: paginationSchema.shape.page_size,
  sort_by: z.enum(["created_at", "updated_at"]).default("created_at").optional(),
  sort_direction: z.enum(["asc", "desc"]).default("desc").optional(),
  location_ids: z.array(z.string()).optional().describe("Filter by location IDs"),
  expand: z.array(z.enum(["attachments", "do_not_service"])).optional(),
});

const customerCreateSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  mobile_number: z.string().optional(),
  home_number: z.string().optional(),
  work_number: z.string().optional(),
  notifications_enabled: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  lead_source: z.string().optional(),
});

const customerUpdateSchema = z.object({
  customer_id: z.string().min(1),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  mobile_number: z.string().optional(),
  home_number: z.string().optional(),
  work_number: z.string().optional(),
  notifications_enabled: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  lead_source: z.string().optional(),
});

const addressCreateSchema = z.object({
  street: z.string().optional(),
  street_line_2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
});

// Jobs
const jobSearchSchema = z.object({
  page: paginationSchema.shape.page,
  page_size: paginationSchema.shape.page_size,
  customer_id: z.string().optional(),
  address_id: z.string().optional(),
  employee_id: z.string().optional(),
  job_type_id: z.string().optional(),
  status: z.string().optional(),
  sort_by: z.enum(["created_at", "updated_at", "scheduled_at"]).default("created_at").optional(),
  sort_direction: z.enum(["asc", "desc"]).default("desc").optional(),
});

// Employees
const employeeSearchSchema = z.object({
  page: paginationSchema.shape.page,
  page_size: paginationSchema.shape.page_size,
  role: z.string().optional(),
  active: z.boolean().optional(),
});

// Estimates
const estimateSearchSchema = z.object({
  page: paginationSchema.shape.page,
  page_size: paginationSchema.shape.page_size,
  customer_id: z.string().optional(),
  status: z.string().optional(),
  sort_by: z.enum(["created_at", "updated_at"]).default("created_at").optional(),
  sort_direction: z.enum(["asc", "desc"]).default("desc").optional(),
});

// Job Types
const jobTypeSearchSchema = z.object({
  page: paginationSchema.shape.page,
  page_size: paginationSchema.shape.page_size,
});

// Leads
const leadSearchSchema = z.object({
  page: paginationSchema.shape.page,
  page_size: paginationSchema.shape.page_size,
  status: z.string().optional(),
  source_id: z.string().optional(),
});

// ─── MCP server (TOOLS) ───────────────────────────────────────────────────────
function createMcpServer() {
  const server = new McpServer({ name: "housecallpro", version: "1.0.0", capabilities: { tools: {} } });

  // -------------------- CUSTOMERS --------------------

  server.tool(
    "list_customers",
    "List/search Housecall Pro customers with pagination and filters",
    customerSearchSchema.shape,
    async (params: any) => {
      const data = await hpRequest("/customers", { params });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_customer",
    "Get a specific customer by ID",
    { customer_id: z.string().min(1) },
    async ({ customer_id }) => {
      const data = await hpRequest(`/customers/${customer_id}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_customer",
    "Create a new customer (at least one of first_name, last_name, email, mobile_number, home_number, work_number required)",
    customerCreateSchema.shape,
    async (input) => {
      const data = await hpRequest("/customers", { method: "POST", body: input });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_customer",
    "Update an existing customer",
    customerUpdateSchema.shape,
    async (input) => {
      const { customer_id, ...body } = input as any;
      const data = await hpRequest(`/customers/${customer_id}`, { method: "PUT", body });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_customer_addresses",
    "Get all addresses for a customer",
    {
      customer_id: z.string().min(1),
      page: paginationSchema.shape.page,
      page_size: paginationSchema.shape.page_size,
    },
    async ({ customer_id, page, page_size }) => {
      const data = await hpRequest(`/customers/${customer_id}/addresses`, {
        params: { page, page_size },
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_customer_address",
    "Get a specific address for a customer",
    {
      customer_id: z.string().min(1),
      address_id: z.string().min(1),
    },
    async ({ customer_id, address_id }) => {
      const data = await hpRequest(`/customers/${customer_id}/addresses/${address_id}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_customer_address",
    "Create a new address for a customer",
    {
      customer_id: z.string().min(1),
      ...addressCreateSchema.shape,
    },
    async (input) => {
      const { customer_id, ...body } = input as any;
      const data = await hpRequest(`/customers/${customer_id}/addresses`, {
        method: "POST",
        body,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // -------------------- JOBS --------------------

  server.tool(
    "list_jobs",
    "List jobs with pagination and filters",
    jobSearchSchema.shape,
    async (params) => {
      const data = await hpRequest("/jobs", { params });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_job",
    "Get a specific job by ID",
    { job_id: z.string().min(1) },
    async ({ job_id }) => {
      const data = await hpRequest(`/jobs/${job_id}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_job",
    "Create a new job for a customer",
    {
      customer_id: z.string().min(1).describe("Customer ID"),
      address_id: z.string().optional().describe("Address ID for the job location"),
      job_type_id: z.string().optional().describe("Job type ID"),
      note: z.string().optional().describe("Job notes"),
      lead_source: z.string().optional().describe("Lead source"),
      tags: z.array(z.string()).optional().describe("Job tags"),
      assigned_employee_ids: z.array(z.string()).optional().describe("Employee IDs to assign"),
    },
    async (input) => {
      const data = await hpRequest("/jobs", { method: "POST", body: input });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_job",
    "Update an existing job",
    {
      job_id: z.string().min(1),
      note: z.string().optional().describe("Job notes"),
      tags: z.array(z.string()).optional().describe("Job tags"),
      job_type_id: z.string().optional().describe("Job type ID"),
    },
    async (input) => {
      const { job_id, ...body } = input;
      const data = await hpRequest(`/jobs/${job_id}`, { method: "PUT", body });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_job_status",
    "Update the status of a job (e.g., scheduled, in_progress, complete, canceled)",
    {
      job_id: z.string().min(1),
      status: z.enum(["unscheduled", "scheduled", "in_progress", "complete", "canceled"]).describe("New job status"),
    },
    async ({ job_id, status }) => {
      const data = await hpRequest(`/jobs/${job_id}`, { method: "PUT", body: { work_status: status } });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "cancel_job",
    "Cancel a job",
    {
      job_id: z.string().min(1),
      cancellation_reason: z.string().optional().describe("Reason for cancellation"),
    },
    async ({ job_id, cancellation_reason }) => {
      const body: any = { work_status: "canceled" };
      if (cancellation_reason) body.cancellation_reason = cancellation_reason;
      const data = await hpRequest(`/jobs/${job_id}`, { method: "PUT", body });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // -------------------- JOB APPOINTMENTS --------------------

  server.tool(
    "list_job_appointments",
    "List appointments for a job",
    {
      job_id: z.string().min(1),
      page: paginationSchema.shape.page,
      page_size: paginationSchema.shape.page_size,
    },
    async ({ job_id, page, page_size }) => {
      const data = await hpRequest(`/jobs/${job_id}/appointments`, {
        params: { page, page_size },
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_appointment",
    "Schedule a new appointment for a job",
    {
      job_id: z.string().min(1).describe("Job ID to schedule"),
      scheduled_start: z.string().describe("Start time in ISO 8601 format (e.g., 2024-01-15T09:00:00Z)"),
      scheduled_end: z.string().describe("End time in ISO 8601 format"),
      employee_ids: z.array(z.string()).optional().describe("Employee IDs to assign to this appointment"),
      arrival_window_minutes: z.number().optional().describe("Arrival window in minutes"),
      note: z.string().optional().describe("Appointment notes"),
    },
    async (input) => {
      const { job_id, ...body } = input;
      const data = await hpRequest(`/jobs/${job_id}/appointments`, { method: "POST", body });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_appointment",
    "Reschedule or update an appointment",
    {
      job_id: z.string().min(1),
      appointment_id: z.string().min(1),
      scheduled_start: z.string().optional().describe("New start time in ISO 8601 format"),
      scheduled_end: z.string().optional().describe("New end time in ISO 8601 format"),
      employee_ids: z.array(z.string()).optional().describe("Employee IDs to assign"),
      note: z.string().optional().describe("Appointment notes"),
    },
    async (input) => {
      const { job_id, appointment_id, ...body } = input;
      const data = await hpRequest(`/jobs/${job_id}/appointments/${appointment_id}`, { method: "PUT", body });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "cancel_appointment",
    "Cancel an appointment",
    {
      job_id: z.string().min(1),
      appointment_id: z.string().min(1),
    },
    async ({ job_id, appointment_id }) => {
      const data = await hpRequest(`/jobs/${job_id}/appointments/${appointment_id}`, { method: "DELETE" });
      return { content: [{ type: "text", text: JSON.stringify({ canceled: true, ...data }, null, 2) }] };
    }
  );

  server.tool(
    "assign_employee_to_appointment",
    "Assign a technician/employee to an appointment",
    {
      job_id: z.string().min(1),
      appointment_id: z.string().min(1),
      employee_ids: z.array(z.string()).min(1).describe("Employee IDs to assign"),
    },
    async ({ job_id, appointment_id, employee_ids }) => {
      const data = await hpRequest(`/jobs/${job_id}/appointments/${appointment_id}`, {
        method: "PUT",
        body: { employee_ids },
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // -------------------- JOB INVOICES --------------------

  server.tool(
    "list_job_invoices",
    "List invoices for a job",
    {
      job_id: z.string().min(1),
      page: paginationSchema.shape.page,
      page_size: paginationSchema.shape.page_size,
    },
    async ({ job_id, page, page_size }) => {
      const data = await hpRequest(`/jobs/${job_id}/invoices`, {
        params: { page, page_size },
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_invoice",
    "Get a specific invoice by ID",
    { invoice_id: z.string().min(1) },
    async ({ invoice_id }) => {
      const data = await hpRequest(`/invoices/${invoice_id}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_invoice",
    "Create an invoice for a job",
    {
      job_id: z.string().min(1).describe("Job ID to invoice"),
      line_items: z.array(z.object({
        name: z.string().describe("Item name"),
        description: z.string().optional(),
        quantity: z.number().default(1),
        unit_price: z.number().describe("Price per unit in cents"),
      })).optional().describe("Line items for the invoice"),
      note: z.string().optional().describe("Invoice notes"),
      due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
    },
    async (input) => {
      const { job_id, ...body } = input;
      const data = await hpRequest(`/jobs/${job_id}/invoices`, { method: "POST", body });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "send_invoice",
    "Send an invoice to the customer via email",
    {
      invoice_id: z.string().min(1),
      email_to: z.string().email().optional().describe("Override recipient email"),
      message: z.string().optional().describe("Custom message to include"),
    },
    async ({ invoice_id, email_to, message }) => {
      const body: any = {};
      if (email_to) body.email = email_to;
      if (message) body.message = message;
      const data = await hpRequest(`/invoices/${invoice_id}/send`, { method: "POST", body });
      return { content: [{ type: "text", text: JSON.stringify({ sent: true, ...data }, null, 2) }] };
    }
  );

  server.tool(
    "record_payment",
    "Record a payment on an invoice",
    {
      invoice_id: z.string().min(1),
      amount: z.number().describe("Payment amount in cents"),
      payment_method: z.enum(["cash", "check", "credit_card", "other"]).default("other"),
      note: z.string().optional().describe("Payment note"),
      paid_at: z.string().optional().describe("Payment date (ISO 8601)"),
    },
    async (input) => {
      const { invoice_id, ...body } = input;
      const data = await hpRequest(`/invoices/${invoice_id}/payments`, { method: "POST", body });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // -------------------- ESTIMATES --------------------

  server.tool(
    "list_estimates",
    "List estimates with pagination and filters",
    estimateSearchSchema.shape,
    async (params) => {
      const data = await hpRequest("/estimates", { params });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_estimate",
    "Get a specific estimate by ID",
    { estimate_id: z.string().min(1) },
    async ({ estimate_id }) => {
      const data = await hpRequest(`/estimates/${estimate_id}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_estimate",
    "Create a new estimate for a customer",
    {
      customer_id: z.string().min(1).describe("Customer ID"),
      address_id: z.string().optional().describe("Address ID"),
      job_type_id: z.string().optional().describe("Job type ID"),
      note: z.string().optional().describe("Estimate notes"),
      line_items: z.array(z.object({
        name: z.string().describe("Item name"),
        description: z.string().optional(),
        quantity: z.number().default(1),
        unit_price: z.number().describe("Price per unit in cents"),
      })).optional().describe("Line items for the estimate"),
    },
    async (input) => {
      const data = await hpRequest("/estimates", { method: "POST", body: input });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_estimate",
    "Update an existing estimate",
    {
      estimate_id: z.string().min(1),
      note: z.string().optional().describe("Updated notes"),
      line_items: z.array(z.object({
        name: z.string().describe("Item name"),
        description: z.string().optional(),
        quantity: z.number().default(1),
        unit_price: z.number().describe("Price per unit in cents"),
      })).optional().describe("Updated line items"),
    },
    async (input) => {
      const { estimate_id, ...body } = input;
      const data = await hpRequest(`/estimates/${estimate_id}`, { method: "PUT", body });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "convert_estimate_to_job",
    "Convert an approved estimate to a job",
    {
      estimate_id: z.string().min(1).describe("Estimate ID to convert"),
    },
    async ({ estimate_id }) => {
      // First get the estimate details
      const estimate = await hpRequest(`/estimates/${estimate_id}`);
      // Create a job from the estimate data
      const jobData = {
        customer_id: (estimate as any).customer_id,
        address_id: (estimate as any).address_id,
        job_type_id: (estimate as any).job_type_id,
        note: `Converted from estimate ${estimate_id}. ${(estimate as any).note || ""}`,
      };
      const job = await hpRequest("/jobs", { method: "POST", body: jobData });
      return { content: [{ type: "text", text: JSON.stringify({ converted: true, estimate_id, job }, null, 2) }] };
    }
  );

  // -------------------- EMPLOYEES --------------------

  server.tool(
    "list_employees",
    "List employees with pagination and filters",
    employeeSearchSchema.shape,
    async (params) => {
      const data = await hpRequest("/employees", { params });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_employee",
    "Get a specific employee by ID",
    { employee_id: z.string().min(1) },
    async ({ employee_id }) => {
      const data = await hpRequest(`/employees/${employee_id}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // -------------------- JOB TYPES --------------------

  server.tool(
    "list_job_types",
    "List job types with pagination",
    jobTypeSearchSchema.shape,
    async (params) => {
      const data = await hpRequest("/job_types", { params });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_job_type",
    "Get a specific job type by ID",
    { job_type_id: z.string().min(1) },
    async ({ job_type_id }) => {
      const data = await hpRequest(`/job_types/${job_type_id}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // -------------------- LEADS --------------------

  server.tool(
    "list_leads",
    "List leads with pagination and filters",
    leadSearchSchema.shape,
    async (params) => {
      const data = await hpRequest("/leads", { params });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_lead",
    "Get a specific lead by ID",
    { lead_id: z.string().min(1) },
    async ({ lead_id }) => {
      const data = await hpRequest(`/leads/${lead_id}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // -------------------- LEAD SOURCES --------------------

  server.tool(
    "list_lead_sources",
    "List all lead sources",
    paginationSchema.shape,
    async (params) => {
      const data = await hpRequest("/lead_sources", { params });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // -------------------- CHECKLISTS --------------------

  server.tool(
    "list_checklists",
    "List checklists for jobs or estimates (provide at least one job_uuid or estimate_uuid)",
    {
      page: paginationSchema.shape.page,
      page_size: paginationSchema.shape.page_size,
      job_uuids: z.array(z.string()).optional(),
      estimate_uuids: z.array(z.string()).optional(),
    },
    async (params) => {
      const data = await hpRequest("/checklists", { params });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // -------------------- APPLICATION --------------------

  server.tool(
    "get_application",
    "Get application info for the company",
    {},
    async () => {
      const data = await hpRequest("/application");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "enable_application",
    "Enable the application for the company",
    {},
    async () => {
      const data = await hpRequest("/application/enable", { method: "POST" });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "disable_application",
    "Disable the application for the company",
    {},
    async () => {
      const data = await hpRequest("/application/disable", { method: "POST" });
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

  app.get("/", (_req, res) => res.json({ ok: true, service: "housecallpro-mcp" }));

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
    console.log(`Housecall Pro MCP on http://localhost:${PORT}  (SSE: /sse, messages: /messages)`);
  });
}

export default app;

