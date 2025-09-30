#!/usr/bin/env tsx

/**
 * Gmail Service API (Express)
 * - OAuth2 authentication with Gmail
 * - Send emails via Gmail API
 * - Query and search emails
 * - Email management functionality
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { google } from "googleapis";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { randomUUID } from "crypto";

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.join(__dirname, ".env") });

// ==== Env vars ====
const {
  PORT = "4001",
  NODE_ENV = "development",
  FRONTEND_ORIGIN = "http://localhost:5173",
  
  // Gmail OAuth2
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI = "http://localhost:4001/oauth/gmail/callback",
  
  // Session management
  SESSION_SECRET = "gmail-session-secret",
} = process.env;

if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
  throw new Error("Missing Gmail OAuth credentials in env");
}

// ==== Gmail OAuth2 Setup ====
const oauth2Client = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI
);

// In-memory token storage (replace with database in production)
const userTokens = new Map<string, any>();

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
app.use(express.json({ limit: "10mb" }));

// Healthcheck
app.get("/health", (_req, res) => res.json({ ok: true, env: NODE_ENV }));

// ==== OAuth: Gmail ====
app.get("/connect-gmail", async (_req, res) => {
  const state = randomUUID();
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: state,
    prompt: 'consent'
  });

  return res.redirect(authUrl);
});

app.get("/oauth/gmail/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    
    if (!code) {
      return res.redirect(`${FRONTEND_ORIGIN}?gmail=error`);
    }

    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens (use database in production)
    const userId = "user1"; // Replace with actual user ID system
    userTokens.set(userId, tokens);
    
    oauth2Client.setCredentials(tokens);

    return res.redirect(`${FRONTEND_ORIGIN}?gmail=connected`);
  } catch (err: any) {
    console.error("Gmail OAuth callback error:", err);
    return res.redirect(`${FRONTEND_ORIGIN}?gmail=error`);
  }
});

// ==== Gmail Status ====
app.get("/gmail-status", async (_req, res) => {
  try {
    const userId = "user1";
    const tokens = userTokens.get(userId);
    
    if (!tokens) {
      return res.json({ connected: false });
    }

    oauth2Client.setCredentials(tokens);
    
    // Test the connection by getting user profile
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    res.json({ 
      connected: true, 
      email: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal,
      threadsTotal: profile.data.threadsTotal
    });
  } catch (e) {
    console.error("Gmail status error:", e);
    res.json({ connected: false });
  }
});

// ==== Send Email ====
app.post("/gmail/send", async (req, res) => {
  try {
    const { to, subject, body, cc, bcc, attachments } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ error: "to, subject, and body are required" });
    }

    const userId = "user1";
    const tokens = userTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: "Gmail not connected" });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Create email message
    const emailLines = [];
    emailLines.push(`To: ${to}`);
    if (cc) emailLines.push(`Cc: ${cc}`);
    if (bcc) emailLines.push(`Bcc: ${bcc}`);
    emailLines.push(`Subject: ${subject}`);
    emailLines.push('Content-Type: text/html; charset=utf-8');
    emailLines.push('');
    emailLines.push(body);

    const email = emailLines.join('\r\n');
    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });

    res.json({
      success: true,
      messageId: result.data.id,
      threadId: result.data.threadId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Gmail send error:", error);
    res.status(500).json({ error: "Failed to send email", details: error.message });
  }
});

// ==== Get Emails ====
app.get("/gmail/messages", async (req, res) => {
  try {
    const { q, maxResults = 20, pageToken } = req.query;
    
    const userId = "user1";
    const tokens = userTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: "Gmail not connected" });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // List messages
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: q as string,
      maxResults: parseInt(maxResults as string),
      pageToken: pageToken as string,
    });

    if (!listResponse.data.messages) {
      return res.json({ messages: [], nextPageToken: null });
    }

    // Get detailed message data
    const messages = await Promise.all(
      listResponse.data.messages.slice(0, 10).map(async (message) => {
        const messageData = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full',
        });

        const headers = messageData.data.payload?.headers || [];
        const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        // Extract body
        let body = '';
        const extractBody = (part: any): string => {
          if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
            if (part.body?.data) {
              return Buffer.from(part.body.data, 'base64').toString();
            }
          }
          if (part.parts) {
            for (const subPart of part.parts) {
              const extracted = extractBody(subPart);
              if (extracted) return extracted;
            }
          }
          return '';
        };

        if (messageData.data.payload) {
          body = extractBody(messageData.data.payload);
        }

        return {
          id: messageData.data.id,
          threadId: messageData.data.threadId,
          snippet: messageData.data.snippet,
          from: getHeader('from'),
          to: getHeader('to'),
          subject: getHeader('subject'),
          date: getHeader('date'),
          body: body.substring(0, 1000), // Limit body size
          labels: messageData.data.labelIds || [],
          unread: messageData.data.labelIds?.includes('UNREAD') || false,
        };
      })
    );

    res.json({
      messages,
      nextPageToken: listResponse.data.nextPageToken,
      resultSizeEstimate: listResponse.data.resultSizeEstimate,
    });
  } catch (error: any) {
    console.error("Gmail messages error:", error);
    res.status(500).json({ error: "Failed to get messages", details: error.message });
  }
});

// ==== Search Emails ====
app.get("/gmail/search", async (req, res) => {
  try {
    const { query, maxResults = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const userId = "user1";
    const tokens = userTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: "Gmail not connected" });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query as string,
      maxResults: parseInt(maxResults as string),
    });

    if (!searchResponse.data.messages) {
      return res.json({ messages: [], total: 0 });
    }

    // Get message details
    const messages = await Promise.all(
      searchResponse.data.messages.map(async (message) => {
        const messageData = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        });

        const headers = messageData.data.payload?.headers || [];
        const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        return {
          id: messageData.data.id,
          threadId: messageData.data.threadId,
          snippet: messageData.data.snippet,
          from: getHeader('from'),
          to: getHeader('to'),
          subject: getHeader('subject'),
          date: getHeader('date'),
          unread: messageData.data.labelIds?.includes('UNREAD') || false,
        };
      })
    );

    res.json({
      messages,
      total: searchResponse.data.resultSizeEstimate || 0,
      query: query,
    });
  } catch (error: any) {
    console.error("Gmail search error:", error);
    res.status(500).json({ error: "Failed to search emails", details: error.message });
  }
});

// ==== Mark as Read/Unread ====
app.post("/gmail/messages/:messageId/mark", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { action } = req.body; // 'read' or 'unread'
    
    const userId = "user1";
    const tokens = userTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: "Gmail not connected" });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    if (action === 'read') {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
    } else if (action === 'unread') {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: ['UNREAD'],
        },
      });
    }

    res.json({ success: true, action, messageId });
  } catch (error: any) {
    console.error("Gmail mark error:", error);
    res.status(500).json({ error: "Failed to mark message", details: error.message });
  }
});

// ==== Get Labels ====
app.get("/gmail/labels", async (_req, res) => {
  try {
    const userId = "user1";
    const tokens = userTokens.get(userId);
    
    if (!tokens) {
      return res.status(401).json({ error: "Gmail not connected" });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const response = await gmail.users.labels.list({
      userId: 'me',
    });

    res.json({
      labels: response.data.labels || [],
    });
  } catch (error: any) {
    console.error("Gmail labels error:", error);
    res.status(500).json({ error: "Failed to get labels", details: error.message });
  }
});

// ==== Boot ====
const port = Number(PORT) || 4001;
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`[gmail-service] listening on http://localhost:${port}`);
    console.log(`[gmail-service] CORS allowed origin: ${FRONTEND_ORIGIN}`);
    console.log(
      `[gmail-service] endpoints: /connect-gmail, /oauth/gmail/callback, /gmail-status, /gmail/*`
    );
  });
}

// Export for Vercel
export default app; 