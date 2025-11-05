# Housecall Pro Integration Setup Guide

This guide will walk you through setting up the Housecall Pro MCP server integration with your SmartAssistant.

## Overview

The Housecall Pro integration adds field service management capabilities to your AI assistant, including:
- Customer management (create, update, search)
- Job management and tracking
- Estimates and invoices
- Employee management
- Appointments scheduling
- Lead tracking
- And more!

## Prerequisites

1. A Housecall Pro account with API access
2. Your Housecall Pro API key
3. Existing SmartAssistant setup (Backend, UI)

**Note:** Unlike the QuickBooks integration, the Housecall Pro MCP is **stateless** and does NOT require Supabase or any database.

## Setup Steps

### 1. Get Your Housecall Pro API Key

1. Log in to your Housecall Pro account
2. Navigate to **Settings** > **Integrations** > **API**
3. Click **Generate New API Key**
4. Copy the API key (you'll need it in the next steps)
5. Store it securely - you won't be able to see it again!

### 2. Configure the HP MCP Server

1. Navigate to the `hp-mcp` folder:
   ```bash
   cd hp-mcp
   ```

2. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

3. Edit the `.env` file and add your configuration:
   ```env
   PORT=3002
   ALLOWED_ORIGIN=*
   HP_API_KEY=your_housecall_pro_api_key_here
   SESSION_JWT_SECRET=your_jwt_secret_here
   SESSION_JWT_ISSUER=backend
   ```

   **Important:** 
   - The `SESSION_JWT_SECRET` must match the one in your backend `.env`
   - The `SESSION_JWT_ISSUER` should match your backend (default: `backend`)
   - **NO Supabase needed!** This server is stateless

4. Install dependencies:
   ```bash
   npm install
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

   The server should start on http://localhost:3002

### 3. Configure the Backend

1. Navigate to the `backend` folder:
   ```bash
   cd ../backend
   ```

2. Add the following to your backend `.env` file:
   ```env
   MCP_HP_URL=http://localhost:3002/sse
   ```

   **For Production:**
   - After deploying hp-mcp to Vercel, update this URL to your deployed endpoint
   - Example: `MCP_HP_URL=https://your-hp-mcp.vercel.app/sse`

3. Restart your backend server to pick up the new configuration

### 4. Verify the Integration

1. Start all services:
   - HP MCP Server: `cd hp-mcp && npm run dev` (port 3002)
   - Backend: `cd backend && npm run dev` (port 4000)
   - UI: `cd ui && npm run dev` (port 5173)

2. Open your browser to http://localhost:5173

3. You should see the updated welcome message mentioning Housecall Pro capabilities

4. Try asking the AI assistant:
   - "List my Housecall Pro customers"
   - "Show me recent jobs"
   - "Get all estimates"
   - "List my employees"

## Available Features

### Customer Management
- Search and filter customers
- Create new customers
- Update customer information
- Manage customer addresses

### Job Management
- List and filter jobs by customer, employee, job type
- View job details
- Track job appointments
- Access job invoices

### Estimates & Invoices
- List estimates by customer or status
- View estimate details
- Access job invoices

### Employee Management
- List employees by role
- View employee details

### Leads
- Track leads and their sources
- Filter leads by status
- View lead details

### Other Features
- Job types management
- Checklists for jobs and estimates
- Application settings

## Usage Examples

### Basic Queries
```
"Show me all customers"
"Find customer John Doe"
"List jobs for customer ID abc123"
"Get all active employees"
"Show me pending estimates"
```

### Creating & Updating
```
"Create a new customer with email john@example.com"
"Add a new address for customer ID abc123"
"Update customer xyz789 phone number to 555-1234"
```

### Complex Queries
```
"Show me all jobs scheduled for next week"
"Find all invoices for customer John Smith"
"List all estimates with pending status"
"Get appointments for job ID job123"
```

## Deployment

### Deploy HP MCP Server to Vercel

1. Push your code to a Git repository (GitHub, GitLab, Bitbucket)

2. Import the project to Vercel:
   - Go to [Vercel Dashboard](https://vercel.com)
   - Click "New Project"
   - Import your repository
   - Set the **Root Directory** to `hp-mcp`
   - Add environment variables:
     - `HP_API_KEY`
     - `SESSION_JWT_SECRET`
     - `SESSION_JWT_ISSUER` (set to `backend`)
     - `ALLOWED_ORIGIN` (set to your frontend URL or *)

3. Deploy!

4. Update your backend `.env` with the production URL:
   ```env
   MCP_HP_URL=https://your-hp-mcp.vercel.app/sse
   ```

## Troubleshooting

### HP MCP Server won't start
- Verify all environment variables are set correctly
- Check that HP_API_KEY is valid
- Ensure port 3002 is available

### Backend can't connect to HP MCP
- Verify MCP_HP_URL is set correctly in backend .env
- Ensure HP MCP server is running
- Check that SESSION_JWT_SECRET matches between backend and HP MCP

### API calls failing
- Verify your Housecall Pro API key is valid and not expired
- Check Housecall Pro API status
- Review HP MCP server logs for detailed error messages

### AI assistant not using Housecall Pro tools
- Verify backend sees MCP_HP_URL environment variable
- Check backend logs for MCP connection errors
- Ensure you're asking relevant questions about field service tasks

## API Rate Limits

Housecall Pro has API rate limits. The default limits are:
- 120 requests per minute
- 10,000 requests per day

The MCP server does not implement rate limiting, so be mindful of your usage patterns.

## Security Best Practices

1. **Never commit** your `.env` files to version control
2. **Rotate** your Housecall Pro API key periodically
3. **Use environment variables** for all sensitive configuration
4. **Set ALLOWED_ORIGIN** appropriately in production (not *)
5. **Keep dependencies updated** with `npm update`

## Support & Resources

- [Housecall Pro API Documentation](https://docs.housecallpro.com/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Anthropic Claude Documentation](https://docs.anthropic.com/)

## Need Help?

If you encounter issues:
1. Check the logs of all three services (hp-mcp, backend, ui)
2. Verify all environment variables are set correctly
3. Ensure all services are running and accessible
4. Review the Housecall Pro API documentation for endpoint details

