# Gmail AI Integration - Natural Language Email Access

## Overview

This guide explains how the Gmail integration works with Claude AI to enable natural language queries like "what are my 5 latest emails" instead of just slash commands.

## How It Works

### Architecture

```
User: "what are my 5 latest emails?"
    ↓
Frontend (ChatBox)
    ↓
Backend (/chat endpoint)
    ↓
Claude AI + Gmail Tools
    ↓
Gmail API
    ↓
Response formatted by Claude
    ↓
User receives natural language response
```

### Two Ways to Use Gmail

1. **Slash Commands** (Direct, no AI)
   - `/email recipient@example.com Subject: Hello | Message body`
   - `/search-email unread`
   - Frontend directly calls Gmail service API

2. **Natural Language** (AI-powered)
   - "show me my latest emails"
   - "search for emails from john about the project"
   - "send an email to jane about tomorrow's meeting"
   - Backend gives Claude AI access to Gmail tools

## Implementation Details

### Backend Integration

#### 1. Gmail Tool Definitions

The backend defines three tools that Claude can use:

```typescript
tools: [
  {
    name: "get_latest_emails",
    description: "Get the latest emails from Gmail inbox",
    input_schema: {
      type: "object",
      properties: {
        max_results: { type: "number", default: 5 },
        query: { type: "string" }
      }
    }
  },
  {
    name: "search_emails",
    description: "Search emails using Gmail search syntax",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", required: true },
        max_results: { type: "number", default: 5 }
      },
      required: ["query"]
    }
  },
  {
    name: "send_email",
    description: "Send an email via Gmail",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", required: true },
        subject: { type: "string", required: true },
        body: { type: "string", required: true }
      },
      required: ["to", "subject", "body"]
    }
  }
]
```

#### 2. System Prompt

Claude is instructed to use Gmail tools:

```
"You are a business assistant. Use QuickBooks MCP tools for accounting tasks. 
You also have access to Gmail tools to read, search, and send emails. 
When users ask about emails, use the Gmail tools."
```

#### 3. Tool Execution Flow

1. User sends natural language message
2. Claude decides if it needs Gmail tools
3. Claude calls appropriate tool (e.g., `get_latest_emails`)
4. Backend executes Gmail API call
5. Result is sent back to Claude
6. Claude formats response in natural language
7. User receives formatted answer

### Helper Functions

```typescript
async function getGmailMessages(userId, maxResults, query?) {
  // Fetches emails from Gmail API
  // Returns array of email objects with:
  // - id, from, to, subject, date, snippet, unread
}

async function searchGmailMessages(userId, query, maxResults) {
  // Search emails using Gmail query syntax
  // Supports operators: from:, to:, subject:, is:unread, etc.
}

async function sendGmailMessage(userId, to, subject, body) {
  // Sends email via Gmail API
  // Returns messageId and threadId
}
```

## Example Queries

### Natural Language (AI-powered)

**View Latest Emails:**
```
"what are my 5 latest emails?"
"show me my recent messages"
"do I have any new emails?"
```

**Search Emails:**
```
"find emails from john@company.com"
"search for emails about the project"
"show me unread emails from last week"
"find emails with attachments from sarah"
```

**Send Emails:**
```
"send an email to jane@company.com about tomorrow's meeting"
"compose an email to the team with the weekly update"
```

### Claude's Response Example

**User:** "what are my 5 latest emails?"

**Claude's Process:**
1. Recognizes this is a Gmail query
2. Calls `get_latest_emails` tool with `max_results: 5`
3. Receives email data from Gmail API
4. Formats it naturally

**Claude's Response:**
```
Here are your 5 latest emails:

1. **Project Update** from john@company.com
   Received 2 hours ago
   "Hi team, here's the latest on the project..."

2. **Meeting Reminder** from calendar@google.com
   Received 5 hours ago
   "Your meeting starts in 1 hour..."

3. **Invoice #1234** from billing@supplier.com
   Received yesterday
   "Please find attached your invoice..."

4. **Newsletter** from newsletter@tech.com
   Received 2 days ago
   "This week's top tech stories..."

5. **LinkedIn Connection** from notifications@linkedin.com
   Received 3 days ago
   "You have 3 new connection requests..."
```

## Gmail Search Syntax Support

Claude can interpret natural language and use Gmail's advanced search operators:

| User Query | Gmail Query Claude Uses |
|-----------|------------------------|
| "unread emails" | `is:unread` |
| "emails from john" | `from:john@company.com` |
| "emails with attachments" | `has:attachment` |
| "recent emails about project" | `subject:project newer_than:7d` |
| "important emails" | `is:important` |

## Setup Requirements

### 1. Environment Variables

Add to `backend/.env`:

```env
# Gmail OAuth2 (same credentials as gmail service)
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REDIRECT_URI=http://localhost:4000/oauth/gmail/callback
```

### 2. Connect Gmail

The backend needs Gmail OAuth tokens to access your emails. Two options:

**Option A: Use Backend OAuth (Recommended for AI queries)**

Visit: `http://localhost:4000/connect-gmail-backend`

This stores tokens in the main backend so Claude can access Gmail.

**Option B: Use Gmail Service OAuth (For standalone Gmail UI)**

Visit: `http://localhost:4001/connect-gmail`

This is for the dedicated Gmail UI interface.

> **Note:** For AI queries to work, you need to connect via the backend (Option A). The frontend Gmail UI uses the separate gmail service.

### 3. Test Natural Language Queries

1. Connect Gmail via backend OAuth
2. Go to AI Chat tab
3. Type: "what are my latest emails?"
4. Claude will use Gmail tools to fetch and display your emails

## Advantages of AI Integration

### Natural Language Understanding

**Instead of:**
```
/search-email from:john@company.com subject:project newer_than:7d
```

**You can say:**
```
"find recent emails from john about the project"
```

### Contextual Responses

Claude formats responses naturally and can:
- Summarize email content
- Extract key information
- Provide email counts and statistics
- Suggest follow-up actions

### Multi-step Operations

Claude can handle complex queries:

```
"check if I have any unread emails from my boss and 
summarize the most important one"
```

Claude will:
1. Search for unread emails from boss
2. Identify the most important one
3. Summarize its content
4. Present it clearly

## Limitations

1. **Rate Limits**: Gmail API has usage limits
2. **Token Expiry**: OAuth tokens may need refresh
3. **Complex Queries**: Very complex multi-step operations may require multiple interactions
4. **Email Content**: Only metadata and snippets are fetched for performance

## Troubleshooting

### "Gmail not connected"

- Run: `http://localhost:4000/connect-gmail-backend`
- Complete OAuth flow
- Check `backend/.env` has Gmail credentials

### "Failed to get emails"

- Check Gmail API is enabled in Google Cloud Console
- Verify OAuth scopes include `gmail.readonly`
- Check console logs for detailed errors

### Natural language queries not working

- Ensure backend is running (port 4000)
- Check that QuickBooks is also connected (required for chat)
- Verify ANTHROPIC_API_KEY is set
- Check backend logs for tool execution

### Only slash commands work

- This means Gmail OAuth is connected to gmail service (port 4001) but not backend (port 4000)
- Connect via: `http://localhost:4000/connect-gmail-backend`

## Production Considerations

### Token Storage

Current implementation uses in-memory storage:
```typescript
const gmailTokens = new Map<string, any>();
```

For production:
- Use database storage (Supabase, PostgreSQL, etc.)
- Implement token refresh logic
- Handle multiple users properly

### Security

- Store tokens encrypted
- Implement proper user authentication
- Use HTTPS in production
- Rotate OAuth credentials regularly

### Performance

- Cache frequently accessed emails
- Implement pagination for large result sets
- Consider background sync for real-time updates
- Monitor API quota usage

## Advanced Features

### Custom Filters

You can extend the tools to support custom filters:

```typescript
{
  name: "get_important_unread_emails",
  description: "Get important unread emails",
  // ...
}
```

### Email Analysis

Claude can analyze email patterns:

```
"how many emails did I receive this week?"
"who emails me the most?"
"what are my most common email subjects?"
```

### Smart Compose

Claude can help compose emails:

```
"draft a professional email declining a meeting invitation"
```

## Summary

The Gmail AI integration transforms email access from rigid commands to natural conversation. By giving Claude AI access to Gmail tools, users can:

- Query emails naturally
- Get intelligently formatted responses
- Handle complex email operations
- Receive contextual suggestions

This provides a much better user experience than memorizing slash commands or Gmail search syntax! 📧🤖✨

