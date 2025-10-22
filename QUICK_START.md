# Quick Start Guide - Smart Assistant

## Setup Gmail AI Integration (Natural Language Queries)

### Step 1: Set Environment Variables

Add to `backend/.env`:

```env
# Gmail OAuth2 Credentials
GMAIL_CLIENT_ID=your_gmail_client_id_here
GMAIL_CLIENT_SECRET=your_gmail_client_secret_here
GMAIL_REDIRECT_URI=http://localhost:4000/oauth/gmail/callback
```

### Step 2: Connect Gmail to Backend

1. Start your backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Visit this URL in your browser:
   ```
   http://localhost:4000/connect-gmail-backend
   ```

3. Complete the Google OAuth flow

4. You'll be redirected back to your app with `?gmail=connected`

### Step 3: Test Natural Language Queries

1. Start your frontend:
   ```bash
   cd ui
   npm run dev
   ```

2. Go to the AI Chat tab

3. Try these queries:
   ```
   "what are my 5 latest emails?"
   "show me unread emails"
   "find emails from john@company.com"
   "search for emails about the project"
   ```

## How It Works

When you ask Gmail questions in natural language:

1. ✅ Your message goes to Claude AI
2. ✅ Claude decides to use Gmail tools
3. ✅ Backend fetches data from Gmail API
4. ✅ Claude formats it naturally
5. ✅ You get a beautiful, conversational response

## Two Gmail Modes

### 1. Natural Language (AI-Powered) ✨

**Connect via:** `http://localhost:4000/connect-gmail-backend`

**Examples:**
- "what are my latest emails?"
- "find emails from sarah"
- "show me unread messages"

**Advantages:**
- Natural conversation
- No syntax to remember
- Intelligent formatting
- Context-aware responses

### 2. Slash Commands (Direct)

**Connect via:** Gmail tab in UI or `http://localhost:4001/connect-gmail`

**Examples:**
- `/email recipient@example.com Subject: Hello | Message`
- `/search-email is:unread`

**Advantages:**
- Faster for exact queries
- Direct control
- No AI interpretation needed

## What You Get

### Natural Language Email Queries

**Ask anything:**
```
"what are my 5 latest emails?"
"show me important messages"
"find emails with attachments"
"search for emails from last week"
```

### Intelligent Responses

Claude formats emails beautifully:
```
Here are your 5 latest emails:

1. **Project Update** from john@company.com
   Received 2 hours ago
   "Hi team, here's the latest..."

2. **Meeting Reminder** from calendar@google.com
   ...
```

### Gmail Search Operators

Claude understands natural language and translates to Gmail syntax:
- "unread emails" → `is:unread`
- "emails from john" → `from:john@company.com`
- "emails with attachments" → `has:attachment`

## Common Issues

### "Gmail not connected"

**Solution:** Connect Gmail via backend OAuth:
```
http://localhost:4000/connect-gmail-backend
```

### Only slash commands work, not natural language

**Reason:** Gmail is connected to gmail service but not backend

**Solution:** Connect via:
```
http://localhost:4000/connect-gmail-backend
```

### Backend not running

**Solution:**
```bash
cd backend
npm run dev
```

Should see: `[backend] listening on http://localhost:4000`

## Full Feature Set

Your Smart Assistant now has:

- 🤖 **AI Chat** with QuickBooks integration
- 📱 **SMS Messages** via Twilio
- 📧 **Gmail** with natural language queries
- 🎯 **Business Analytics** via QuickBooks
- 🔍 **Smart Search** across all platforms

## Next Steps

1. ✅ Connect Gmail to backend for AI queries
2. ✅ Try natural language email queries
3. ✅ Explore the standalone Gmail UI
4. ✅ Use SMS features
5. ✅ Connect QuickBooks for business data

## Support

- **Gmail Setup:** See `GMAIL_SETUP.md`
- **AI Integration:** See `GMAIL_AI_INTEGRATION.md`
- **SMS Setup:** See `TWILIO_SETUP.md`

---

🚀 You're all set! Start asking your AI assistant about emails in natural language!

