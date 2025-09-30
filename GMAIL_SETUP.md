# Gmail Integration Setup Guide

This guide will help you set up the Gmail API integration for your Smart Assistant application.

## Prerequisites

1. A Google Cloud Platform (GCP) account
2. A Gmail account for testing
3. Basic understanding of OAuth2 flow

## Google Cloud Setup

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

### 2. Enable Gmail API

1. In the Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Gmail API"
3. Click on "Gmail API" and click **Enable**

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type (unless you have a Google Workspace account)
3. Fill in the required information:
   - **App name**: Smart Assistant
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Add scopes (you can do this later in step 4)
5. Add test users (your Gmail account) if using External user type

### 4. Create OAuth2 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Choose **Web application**
4. Configure:
   - **Name**: Gmail Integration
   - **Authorized JavaScript origins**: 
     - `http://localhost:5173` (for development)
     - Your production domain
   - **Authorized redirect URIs**:
     - `http://localhost:4001/oauth/gmail/callback` (for development)
     - Your production Gmail service URL + `/oauth/gmail/callback`
5. Download the JSON file or copy the Client ID and Client Secret

## Environment Configuration

### Gmail Service Environment Variables

Create a `.env` file in the `gmail` folder:

```env
# Gmail Service Configuration
PORT=4001
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173

# Gmail OAuth2 Configuration
GMAIL_CLIENT_ID=your_gmail_client_id_here
GMAIL_CLIENT_SECRET=your_gmail_client_secret_here
GMAIL_REDIRECT_URI=http://localhost:4001/oauth/gmail/callback

# Session Management
SESSION_SECRET=your_session_secret_here
```

### Frontend Environment Variables

Add to your frontend `.env` file:

```env
# Gmail API URL
VITE_GMAIL_API_URL=http://localhost:4001
```

## Required OAuth2 Scopes

The integration requests the following Gmail API scopes:

- `https://www.googleapis.com/auth/gmail.readonly` - Read emails
- `https://www.googleapis.com/auth/gmail.send` - Send emails
- `https://www.googleapis.com/auth/gmail.compose` - Compose emails
- `https://www.googleapis.com/auth/gmail.modify` - Mark as read/unread
- `https://www.googleapis.com/auth/userinfo.email` - User email address
- `https://www.googleapis.com/auth/userinfo.profile` - User profile info

## Features

### 1. Standalone Gmail Interface

- **OAuth2 Authentication**: Secure Google account connection
- **Inbox Management**: View, search, and organize emails
- **Email Composition**: Rich text editor with templates
- **Quick Filters**: Unread, starred, important, sent, drafts, etc.
- **Search Functionality**: Powerful Gmail search with query syntax
- **Message Actions**: Mark as read/unread, reply, forward
- **Email Templates**: Pre-built templates for common scenarios

### 2. Gmail via Chat Commands

Send emails and search directly from the AI chat interface:

#### Send Email Command
```
/email recipient@example.com Subject: Your subject here | Your email message content
```

**Examples:**
```
/email john@company.com Subject: Meeting Tomorrow | Hi John, just confirming our meeting at 2 PM tomorrow. Thanks!

/email team@startup.com Subject: Weekly Update | Here's this week's progress report...
```

#### Search Email Command
```
/search-email your search query
```

**Examples:**
```
/search-email unread
/search-email from:john@company.com
/search-email has:attachment
/search-email subject:invoice
/search-email newer_than:2d
```

### 3. Advanced Gmail Search Syntax

The integration supports Gmail's powerful search operators:

- `from:email@domain.com` - Emails from specific sender
- `to:email@domain.com` - Emails to specific recipient
- `subject:keyword` - Emails with keyword in subject
- `has:attachment` - Emails with attachments
- `is:unread` - Unread emails
- `is:starred` - Starred emails
- `is:important` - Important emails
- `newer_than:2d` - Emails newer than 2 days
- `older_than:1w` - Emails older than 1 week
- `in:sent` - Sent emails
- `in:drafts` - Draft emails

## UI/UX Features

### Design Highlights

- **Google Brand Colors**: Red, yellow, green gradient themes
- **Glass Morphism Design**: Modern translucent interface
- **Responsive Layout**: Works on desktop and mobile
- **Quick Actions**: Fast access to common operations
- **Email Templates**: Professional email templates
- **Real-time Search**: Instant search results
- **Message Threading**: Organized conversation view

### Interface Components

1. **Connection Screen**: Secure OAuth2 flow
2. **Inbox View**: Email list with filters and search
3. **Compose View**: Rich email editor with templates
4. **Message View**: Full email display with actions
5. **Search Results**: Filtered and organized results

### Status Indicators

- **🔴** Unread emails
- **⭐** Starred emails
- **📎** Has attachments
- **📤** Sent emails
- **📝** Draft emails

## Security Considerations

- **OAuth2 Flow**: Secure authentication without password storage
- **Token Management**: Refresh tokens for persistent access
- **Scope Limitation**: Only requests necessary permissions
- **HTTPS Required**: Production requires HTTPS for OAuth2
- **Rate Limiting**: API rate limiting to prevent abuse

## Development Setup

### 1. Start Gmail Service

```bash
cd gmail
npm run dev
```

The Gmail service will run on `http://localhost:4001`

### 2. Start Frontend

```bash
cd ui
npm run dev
```

The frontend will run on `http://localhost:5173`

### 3. Test Integration

1. Navigate to the Gmail tab in the frontend
2. Click "Connect Gmail Account"
3. Complete OAuth2 flow
4. Test sending emails and searching

## Production Deployment

### Environment Variables

Set these in your production environment:

```env
# Gmail Service
GMAIL_CLIENT_ID=your_production_client_id
GMAIL_CLIENT_SECRET=your_production_client_secret
GMAIL_REDIRECT_URI=https://yourdomain.com/oauth/gmail/callback
FRONTEND_ORIGIN=https://yourdomain.com

# Frontend
VITE_GMAIL_API_URL=https://your-gmail-service.vercel.app
```

### OAuth2 Configuration

Update your Google Cloud OAuth2 settings:

1. Add production domains to **Authorized JavaScript origins**
2. Add production callback URL to **Authorized redirect URIs**
3. Verify domain ownership if required
4. Submit for verification if using sensitive scopes

### Deployment Considerations

- **HTTPS Required**: Gmail API requires HTTPS in production
- **Domain Verification**: May be required for OAuth2
- **Rate Limits**: Monitor API usage and quotas
- **Token Storage**: Implement proper database storage for tokens
- **Error Handling**: Comprehensive error handling and logging

## Troubleshooting

### Common Issues

1. **"OAuth Error: redirect_uri_mismatch"**
   - Check that redirect URI in code matches Google Cloud Console
   - Ensure exact match including protocol (http/https)

2. **"Access blocked: This app's request is invalid"**
   - Verify OAuth consent screen is properly configured
   - Check that all required fields are filled
   - Ensure app is not in testing mode for external users

3. **"Insufficient permissions"**
   - Verify all required scopes are requested
   - Check that Gmail API is enabled in Google Cloud Console

4. **"Gmail service not connected"**
   - Check environment variables are set correctly
   - Verify Gmail service is running on correct port
   - Check network connectivity between services

### API Limits

- **Daily quota**: 1 billion quota units per day
- **Per-user rate limit**: 250 quota units per user per second
- **Batch requests**: Up to 100 requests per batch

### Best Practices

- **Token Refresh**: Implement automatic token refresh
- **Error Handling**: Graceful handling of API errors
- **Caching**: Cache frequently accessed data
- **Pagination**: Handle large result sets properly
- **Monitoring**: Monitor API usage and errors

## Support

For issues with:
- **Google APIs**: Check [Gmail API Documentation](https://developers.google.com/gmail/api)
- **OAuth2**: Review [Google OAuth2 Guide](https://developers.google.com/identity/protocols/oauth2)
- **Integration**: Check error messages and logs
- **UI Issues**: Check browser console for errors

---

Your Gmail integration is now ready! 📧✨

## Quick Start Checklist

- [ ] Create Google Cloud Project
- [ ] Enable Gmail API
- [ ] Configure OAuth consent screen
- [ ] Create OAuth2 credentials
- [ ] Set environment variables
- [ ] Start Gmail service
- [ ] Test OAuth flow
- [ ] Send test email
- [ ] Search emails
- [ ] Deploy to production 