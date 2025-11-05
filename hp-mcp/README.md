# Housecall Pro MCP Server

This is an MCP (Model Context Protocol) server that provides AI agents with access to Housecall Pro API for field service management.

## Features

The server exposes the following Housecall Pro capabilities:

### Customers
- `list_customers` - List/search customers with pagination and filters
- `get_customer` - Get a specific customer by ID
- `create_customer` - Create a new customer
- `update_customer` - Update an existing customer
- `get_customer_addresses` - Get all addresses for a customer
- `get_customer_address` - Get a specific address
- `create_customer_address` - Create a new address for a customer

### Jobs
- `list_jobs` - List jobs with pagination and filters
- `get_job` - Get a specific job by ID

### Job Appointments
- `list_job_appointments` - List appointments for a job

### Job Invoices
- `list_job_invoices` - List invoices for a job

### Estimates
- `list_estimates` - List estimates with pagination and filters
- `get_estimate` - Get a specific estimate by ID

### Employees
- `list_employees` - List employees with pagination and filters
- `get_employee` - Get a specific employee by ID

### Job Types
- `list_job_types` - List job types with pagination
- `get_job_type` - Get a specific job type by ID

### Leads
- `list_leads` - List leads with pagination and filters
- `get_lead` - Get a specific lead by ID

### Lead Sources
- `list_lead_sources` - List all lead sources

### Checklists
- `list_checklists` - List checklists for jobs or estimates

### Application
- `get_application` - Get application info for the company
- `enable_application` - Enable the application for the company
- `disable_application` - Disable the application for the company

## Architecture

This server is **STATELESS** - it does NOT use a database or Supabase. Instead:
- The backend creates a short-lived JWT (15 minutes) specifically for this MCP server
- The JWT includes audience `"housecallpro-mcp"` and is validated on each request
- The server uses only the `HP_API_KEY` from environment to call Housecall Pro
- No token storage or database lookups are performed

This is different from the QuickBooks MCP which requires OAuth and database token storage.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `env.example` to `.env` and configure:
```bash
cp env.example .env
```

3. Set the following environment variables in `.env`:
```
HP_API_KEY=your_housecall_pro_api_key
SESSION_JWT_SECRET=your_jwt_secret (must match backend)
SESSION_JWT_ISSUER=backend (must match backend)
PORT=3002
ALLOWED_ORIGIN=*
```

**Note:** No Supabase configuration needed - this server is stateless!

## Development

Run the development server with hot reload:
```bash
npm run dev
```

## Production

Build and run:
```bash
npm run build
npm start
```

## Deployment

This server is configured for Vercel deployment with the included `vercel.json`.

## API Endpoints

- `GET /` - Health check
- `GET /sse` - SSE endpoint for MCP connection (requires JWT auth)
- `POST /messages` - Message handler for MCP (requires JWT auth)

## Authentication

The server requires a JWT token in the `Authorization` header or `X-Session` header. The JWT must:
- Be signed with `SESSION_JWT_SECRET`
- Contain a `userId` claim

## Integration with Backend

The backend should configure this MCP server in the `mcp_servers` array:

```javascript
mcp_servers: [
  {
    type: "url",
    name: "housecallpro",
    url: process.env.MCP_HP_URL, // e.g., http://localhost:3002/sse
    authorization_token: sessionJwt,
  }
]
```

## Getting a Housecall Pro API Key

1. Log in to your Housecall Pro account
2. Navigate to Settings > Integrations > API
3. Generate a new API key
4. Copy the key and add it to your `.env` file

## API Documentation

Full Housecall Pro API documentation: https://docs.housecallpro.com/

