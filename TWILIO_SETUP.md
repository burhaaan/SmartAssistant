# Twilio SMS Integration Setup Guide

This guide will help you set up the Twilio SMS integration for your Smart Assistant application.

## Prerequisites

1. A Twilio account (sign up at [twilio.com](https://www.twilio.com))
2. A verified phone number for sending SMS messages

## Twilio Configuration

### 1. Get Your Twilio Credentials

1. Log in to your [Twilio Console](https://console.twilio.com/)
2. From the dashboard, copy your:
   - **Account SID**
   - **Auth Token**

### 2. Get a Twilio Phone Number

1. In the Twilio Console, go to **Phone Numbers** > **Manage** > **Buy a number**
2. Purchase a phone number with SMS capabilities
3. Copy the phone number (format: +1234567890)

### 3. Configure Environment Variables

Add the following variables to your backend `.env` file:

```env
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

Replace the placeholder values with your actual Twilio credentials.

## Features

### 1. Standalone SMS Interface

- **Tab Navigation**: Switch between AI Chat and SMS Messages
- **Contact Management**: Add and save contacts with names
- **Message History**: View all sent and received messages
- **Real-time Status**: See delivery status with visual indicators
- **Phone Number Formatting**: Automatic formatting for US numbers

### 2. SMS via Chat Commands

You can send SMS messages directly from the AI chat interface using commands:

```
/sms +1234567890 Hello! This is a test message from the AI assistant.
```

**Command Format:**
- Start with `/sms`
- Space, then phone number (with or without country code)
- Space, then your message

**Examples:**
```
/sms +1-555-123-4567 Meeting reminder: Tomorrow at 2 PM
/sms 5551234567 Your order has been shipped!
/sms +447123456789 International message example
```

### 3. Smart Phone Number Handling

The system automatically:
- Validates phone number formats
- Adds country codes (defaults to +1 for 10-digit US numbers)
- Formats numbers for display: `+1 (555) 123-4567`
- Handles international numbers

## UI/UX Features

### Design Highlights

- **Glass Morphism Design**: Modern translucent interface
- **Gradient Accents**: Teal/cyan gradients for SMS branding
- **Responsive Layout**: Works on desktop and mobile
- **Real-time Updates**: Live message status indicators
- **Contact Persistence**: Saves contact names locally
- **Message Threading**: Organized by contact conversations

### Status Indicators

- **⏳** Sending/Queued
- **✓** Sent
- **✓✓** Delivered
- **✗** Failed

### Visual Cues

- **Green Theme**: SMS interface uses teal/cyan branding
- **Message Bubbles**: Distinct styling for sent vs received
- **Sidebar Navigation**: Easy contact switching
- **Form Validation**: Real-time phone number validation

## Error Handling

The system handles various error scenarios:

1. **Invalid Phone Numbers**: Shows validation errors
2. **Twilio API Errors**: Displays specific error codes and messages
3. **Network Issues**: Graceful fallback with retry options
4. **Missing Configuration**: Clear warnings when Twilio isn't configured

## Security Considerations

- Phone numbers are validated before sending
- API credentials are server-side only
- Rate limiting prevents spam
- Error messages don't expose sensitive data

## Testing

### Test SMS Functionality

1. Ensure your Twilio credentials are configured
2. Start the backend server: `npm run dev`
3. Start the frontend: `npm run dev`
4. Navigate to the SMS tab
5. Add a contact with your verified phone number
6. Send a test message

### Test Chat Commands

1. Go to the AI Chat tab
2. Type: `/sms +your_phone_number Test message from chat!`
3. Press Enter
4. Check your phone for the message

## Troubleshooting

### Common Issues

1. **"SMS service not configured"**
   - Check that all Twilio environment variables are set
   - Restart the backend server after adding credentials

2. **"Invalid phone number format"**
   - Use international format: +1234567890
   - Or use 10 digits for US numbers: 1234567890

3. **Messages not sending**
   - Verify your Twilio account is active
   - Check that your Twilio phone number has SMS capabilities
   - Ensure recipient number is verified (for trial accounts)

4. **"Twilio Error 21608"**
   - The recipient phone number is not verified (trial account limitation)
   - Add the number to your verified list in Twilio Console

## Production Deployment

### Environment Variables

Make sure to set these in your production environment:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_production_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Scaling Considerations

- Monitor SMS usage and costs in Twilio Console
- Implement rate limiting for production use
- Consider message queuing for high volume
- Set up webhooks for delivery status updates

## Cost Management

- **Twilio Pricing**: ~$0.0075 per SMS in the US
- **Trial Account**: $15 free credit
- **Production**: Monitor usage in Twilio Console
- **Optimization**: Batch messages when possible

## Support

For issues with:
- **Twilio**: Check [Twilio Documentation](https://www.twilio.com/docs/sms)
- **Integration**: Review error messages and logs
- **UI Issues**: Check browser console for errors

---

Your SMS integration is now ready! 📱✨ 