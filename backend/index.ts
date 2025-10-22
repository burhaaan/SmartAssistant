#!/usr/bin/env ts-node

/**
 * Backend API (Express)
 * - OAuth broker for QuickBooks
 * - Token store (Supabase)
 * - Chat proxy to Anthropic Messages API with MCP connector
 * - SMS integration with Twilio
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import { fetch } from "undici";
import { getTokens, upsertTokens } from "./src/db.js"; // uses Supabase
import twilio from "twilio";

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.join(__dirname, ".env") });

// ==== Env vars ====
const {
  PORT = "4000",
  NODE_ENV = "development",
  FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173",

  // Anthropic
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022",
  ANTHROPIC_BETA = "mcp-client-2025-04-04",

  // JWT
  SESSION_JWT_SECRET,
  SESSION_JWT_AUDIENCE = "mcp",
  SESSION_JWT_ISSUER = "backend",
  SESSION_TTL_SECONDS = "3600",

  // QuickBooks OAuth
  QB_CLIENT_ID,
  QB_CLIENT_SECRET,
  QB_REDIRECT_URI = "http://localhost:4000/oauth/qbo/callback",
  QB_SCOPE = "com.intuit.quickbooks.accounting",

  // MCP QuickBooks (remote server)
  MCP_QBO_URL,

  // Twilio
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,

  // Gmail Service URL
  GMAIL_SERVICE_URL = process.env.GMAIL_SERVICE_URL || "http://localhost:4001",
} = process.env;

if (!ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY in env");
if (!SESSION_JWT_SECRET) throw new Error("Missing SESSION_JWT_SECRET in env");
if (!QB_CLIENT_ID || !QB_CLIENT_SECRET)
  throw new Error("Missing QuickBooks OAuth creds in env");
if (!MCP_QBO_URL) throw new Error("Missing MCP_QBO_URL in env");
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  console.warn("Warning: Twilio credentials missing. SMS features will be disabled.");
}

// ==== Initialize Twilio ====
const twilioClient = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN 
  ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

// ==== Helpers (Supabase-backed) ====
async function isQboConnected(userId: number) {
  const row = await getTokens(userId, "quickbooks");
  if (!row?.access_token) return false;
  if (row.expires_at && Number(row.expires_at) <= Math.floor(Date.now() / 1000))
    return false;
  return true;
}

// ==== Gmail Helper Functions (via Gmail Service) ====
async function getGmailMessages(maxResults: number = 5, query?: string) {
  const params = new URLSearchParams();
  if (query) params.append('q', query);
  params.append('maxResults', maxResults.toString());

  const url = `${GMAIL_SERVICE_URL}/gmail/messages?${params}`;
  console.log('[Gmail API] Fetching messages from:', url);
  
  const response = await fetch(url, {
    credentials: 'include',
  });

  console.log('[Gmail API] Messages response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Gmail API] Messages error response:', errorText);
    throw new Error(`Failed to get Gmail messages: ${response.status}`);
  }

  const data = await response.json() as any;
  console.log('[Gmail API] Messages data:', data);
  return data.messages || [];
}

async function searchGmailMessages(query: string, maxResults: number = 5) {
  const params = new URLSearchParams({ query, maxResults: maxResults.toString() });
  
  const response = await fetch(`${GMAIL_SERVICE_URL}/gmail/search?${params}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to search Gmail messages');
  }

  const data = await response.json() as any;
  return data.messages || [];
}

async function sendGmailMessage(to: string, subject: string, body: string) {
  const response = await fetch(`${GMAIL_SERVICE_URL}/gmail/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ to, subject, body }),
  });

  if (!response.ok) {
    throw new Error('Failed to send Gmail message');
  }

  return response.json() as any;
}

// ==== Express app ====
const app = express();

app.set("trust proxy", 1);
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);
app.use(express.json({ limit: "1mb" }));

// Healthcheck
app.get("/health", (_req, res) => res.json({ ok: true, env: NODE_ENV }));

// ==== OAuth: QuickBooks ====
app.get("/connect-qbo", async (_req, res) => {
  const state = randomUUID();
  const authUrl =
    "https://appcenter.intuit.com/connect/oauth2" +
    `?client_id=${encodeURIComponent(QB_CLIENT_ID!)}` +
    `&redirect_uri=${encodeURIComponent(QB_REDIRECT_URI!)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(QB_SCOPE!)}` +
    `&state=${encodeURIComponent(state)}`;
  return res.redirect(authUrl);
});

app.get("/oauth/qbo/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const realmId = req.query.realmId ? String(req.query.realmId) : undefined;

    if (!code) return res.redirect(`${FRONTEND_ORIGIN}?qbo=error`);

    const tokenResp = await fetch(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString(
              "base64"
            ),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body:
          `grant_type=authorization_code` +
          `&code=${encodeURIComponent(code)}` +
          `&redirect_uri=${encodeURIComponent(QB_REDIRECT_URI!)}`,
      }
    );

    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      console.error("QBO token exchange failed:", tokenResp.status, t);
      return res.redirect(`${FRONTEND_ORIGIN}?qbo=error`);
    }

    const data = (await tokenResp.json()) as {
      access_token: string;
      refresh_token?: string | null;
      expires_in?: number | null;
    };

    const now = Math.floor(Date.now() / 1000);
    const expires_at = data.expires_in ? now + data.expires_in : null;

    // Persist to Supabase
    await upsertTokens({
      userId: 1,
      provider: "quickbooks",
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      realmId,
      expires_at,
    });

    return res.redirect(`${FRONTEND_ORIGIN}?qbo=connected`);
  } catch (err: any) {
    console.error("OAuth callback error:", err);
    return res.redirect(`${FRONTEND_ORIGIN}?qbo=error`);
  }
});

// ==== QBO Status ====
app.get("/qbo-status", async (_req, res) => {
  try {
    const connected = await isQboConnected(1);
    res.json({ connected });
  } catch (e) {
    console.error("qbo-status error:", e);
    res.status(500).json({ connected: false });
  }
});

// ==== Gmail Status (from Gmail Service) ====
async function isGmailConnected() {
  try {
    console.log('[Gmail Check] Checking Gmail connection at:', GMAIL_SERVICE_URL);
    const response = await fetch(`${GMAIL_SERVICE_URL}/gmail-status`, {
      credentials: 'include',
    });
    console.log('[Gmail Check] Status response status:', response.status);
    const data = await response.json() as any;
    console.log('[Gmail Check] Status response data:', data);
    return data.connected || false;
  } catch (e) {
    console.error('[Gmail Check] Error checking Gmail connection:', e);
    return false;
  }
}

// ==== SMS Endpoints ====
app.post("/sms/send", async (req, res) => {
  try {
    const { to, message } = req.body as { to?: string; message?: string };
    
    if (!to || !message) {
      return res.status(400).json({ error: "to and message are required" });
    }

    if (!twilioClient) {
      return res.status(503).json({ error: "SMS service not configured" });
    }

    // Basic phone number validation and formatting
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    let formattedPhone = to.replace(/\D/g, ''); // Remove non-digits
    
    if (formattedPhone.length === 10) {
      formattedPhone = '+1' + formattedPhone; // US number
    } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
      formattedPhone = '+' + formattedPhone;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    if (!phoneRegex.test(formattedPhone)) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    const twilioMessage = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    res.json({
      success: true,
      messageSid: twilioMessage.sid,
      to: formattedPhone,
      status: twilioMessage.status,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("SMS send error:", error);
    
    // Handle Twilio specific errors
    if (error.code) {
      return res.status(400).json({ 
        error: `Twilio Error ${error.code}: ${error.message}`,
        code: error.code 
      });
    }
    
    res.status(500).json({ error: "Failed to send SMS" });
  }
});

app.get("/sms/status/:messageSid", async (req, res) => {
  try {
    const { messageSid } = req.params;
    
    if (!twilioClient) {
      return res.status(503).json({ error: "SMS service not configured" });
    }

    const message = await twilioClient.messages(messageSid).fetch();
    
    res.json({
      sid: message.sid,
      status: message.status,
      to: message.to,
      from: message.from,
      body: message.body,
      dateCreated: message.dateCreated,
      dateSent: message.dateSent,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
    });
  } catch (error: any) {
    console.error("SMS status check error:", error);
    res.status(500).json({ error: "Failed to get SMS status" });
  }
});

app.get("/sms/history", async (req, res) => {
  try {
    if (!twilioClient) {
      return res.status(503).json({ error: "SMS service not configured" });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const messages = await twilioClient.messages.list({ limit });
    
    const messageHistory = messages.map(msg => ({
      sid: msg.sid,
      to: msg.to,
      from: msg.from,
      body: msg.body,
      status: msg.status,
      direction: msg.direction,
      dateCreated: msg.dateCreated,
      dateSent: msg.dateSent,
    }));

    res.json({ messages: messageHistory });
  } catch (error: any) {
    console.error("SMS history error:", error);
    res.status(500).json({ error: "Failed to get SMS history" });
  }
});

// ==== Chat proxy: Anthropic ====
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body as { message?: string };
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    const connected = await isQboConnected(1);
    if (!connected) {
      return res
        .status(400)
        .json({ error: "QuickBooks not connected for userId=1" });
    }

    const sessionJwt = jwt.sign(
      { userId: 1, iat: Math.floor(Date.now() / 1000) },
      SESSION_JWT_SECRET!,
      {
        algorithm: "HS256",
        audience: SESSION_JWT_AUDIENCE,
        issuer: SESSION_JWT_ISSUER,
        expiresIn: Number(SESSION_TTL_SECONDS) || 3600,
      }
    );

    // Check Gmail connection
    console.log('[Chat] Checking Gmail connection for user message:', message.substring(0, 50));
    const gmailConnected = await isGmailConnected();
    console.log('[Chat] Gmail connected status:', gmailConnected);

    // inside /chat handler, right before fetch(...)
    const body: any = {
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,

      // ✅ system belongs here (top-level), not inside messages[]
      system:
        "You are a business assistant. Use QuickBooks MCP tools for accounting tasks. " +
        (gmailConnected 
          ? "You also have access to Gmail tools to read, search, and send emails. When users ask about emails, use the Gmail tools."
          : "Gmail is not connected - inform the user they need to connect Gmail to access email features."),

      messages: [{ role: "user", content: message }],

      // ✅ Anthropic MCP URL config
      // Make sure MCP_QBO_URL ends with /sse, e.g. https://smart-assistant-qb-mcp.vercel.app/sse
      mcp_servers: [
        {
          type: "url",
          name: "quickbooks",
          url: MCP_QBO_URL!,
          // this becomes Authorization: Bearer <token> to your MCP server
          authorization_token: sessionJwt,
        },
      ],
    };

    // Add Gmail tools if connected
    if (gmailConnected) {
      body.tools = [
        {
          name: "get_latest_emails",
          description: "Get the latest emails from Gmail inbox. Use this when users ask about recent emails, latest messages, or inbox.",
          input_schema: {
            type: "object",
            properties: {
              max_results: {
                type: "number",
                description: "Maximum number of emails to retrieve (default 5, max 20)",
                default: 5
              },
              query: {
                type: "string",
                description: "Optional Gmail search query (e.g., 'is:unread', 'from:example@email.com')"
              }
            }
          }
        },
        {
          name: "search_emails",
          description: "Search emails in Gmail using Gmail search syntax. Use this when users want to find specific emails.",
          input_schema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Gmail search query (supports operators like from:, to:, subject:, is:unread, has:attachment, etc.)"
              },
              max_results: {
                type: "number",
                description: "Maximum number of results (default 5, max 20)"
              }
            },
            required: ["query"]
          }
        },
        {
          name: "send_email",
          description: "Send an email via Gmail. Use this when users want to send an email.",
          input_schema: {
            type: "object",
            properties: {
              to: {
                type: "string",
                description: "Recipient email address"
              },
              subject: {
                type: "string",
                description: "Email subject line"
              },
              body: {
                type: "string",
                description: "Email body content"
              }
            },
            required: ["to", "subject", "body"]
          }
        }
      ];
    }

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": ANTHROPIC_BETA!,
      },
      body: JSON.stringify(body),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      console.error("Anthropic error:", anthropicResp.status, errText);
      return res
        .status(502)
        .json({ error: "Anthropic request failed", detail: errText });
    }

    const data = (await anthropicResp.json()) as any;

    // Handle tool use (Gmail tools)
    console.log('[Chat] Stop reason:', data.stop_reason, 'Gmail connected:', gmailConnected);
    if (data.stop_reason === "tool_use" && gmailConnected) {
      const toolUse = data.content?.find((c: any) => c.type === "tool_use");
      console.log('[Chat] Tool use found:', toolUse?.name);
      
      if (toolUse) {
        let toolResult: any;
        
        try {
          console.log('[Chat] Executing tool:', toolUse.name, 'with input:', toolUse.input);
          switch (toolUse.name) {
            case "get_latest_emails":
              console.log('[Chat] Fetching latest emails...');
              const emails = await getGmailMessages(
                toolUse.input.max_results || 5,
                toolUse.input.query
              );
              console.log('[Chat] Got emails:', emails.length);
              toolResult = { emails };
              break;
              
            case "search_emails":
              console.log('[Chat] Searching emails...');
              const searchResults = await searchGmailMessages(
                toolUse.input.query,
                toolUse.input.max_results || 5
              );
              console.log('[Chat] Search results:', searchResults.length);
              toolResult = { emails: searchResults };
              break;
              
            case "send_email":
              console.log('[Chat] Sending email...');
              const sendResult = await sendGmailMessage(
                toolUse.input.to,
                toolUse.input.subject,
                toolUse.input.body
              );
              console.log('[Chat] Email sent:', sendResult);
              toolResult = { success: true, messageId: sendResult.messageId, threadId: sendResult.threadId };
              break;
              
            default:
              console.log('[Chat] Unknown tool:', toolUse.name);
              toolResult = { error: "Unknown tool" };
          }
        } catch (error: any) {
          console.error('[Chat] Tool execution error:', error);
          toolResult = { error: error.message };
        }

        // Send tool result back to Claude for final response
        const followUpBody = {
          model: ANTHROPIC_MODEL,
          max_tokens: 1024,
          system: body.system,
          messages: [
            { role: "user", content: message },
            { role: "assistant", content: data.content },
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(toolResult),
                },
              ],
            },
          ],
          tools: body.tools,
        };

        const followUpResp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(followUpBody),
        });

        if (followUpResp.ok) {
          const followUpData = (await followUpResp.json()) as any;
          const finalReply = Array.isArray(followUpData?.content)
            ? followUpData.content
                .filter((c: any) => c?.type === "text" && typeof c?.text === "string")
                .map((c: any) => c.text)
                .join("\n")
            : "";
          return res.json({ reply: finalReply || "(no text response)" });
        }
      }
    }

    const reply = Array.isArray(data?.content)
      ? data.content
          .filter((c: any) => c?.type === "text" && typeof c?.text === "string")
          .map((c: any) => c.text)
          .join("\n")
      : "";

    return res.json({ reply: reply || "(no text response)" });
  } catch (err: any) {
    console.error("Chat error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ⚠️ Debug only (remove in prod)
app.get("/debug/qbo-tokens", async (_req, res) => {
  try {
    const row = await getTokens(1, "quickbooks");
    res.json(row || {});
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "debug_error" });
  }
});

// ==== Boot ====
const port = Number(PORT) || 4000;
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`[backend] listening on http://localhost:${port}`);
    console.log(`[backend] CORS allowed origin: ${FRONTEND_ORIGIN}`);
    console.log(
      `[backend] endpoints: /connect-qbo, /oauth/qbo/callback, /qbo-status, /chat, /sms/*`
    );
  });
}

// 👇 export for Vercel
export default app;
