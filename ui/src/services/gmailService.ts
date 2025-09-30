const GMAIL_API_BASE_URL = import.meta.env.VITE_GMAIL_API_URL || "http://localhost:4001";

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body?: string;
  labels: string[];
  unread: boolean;
}

export interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  attachments?: any[];
}

export interface SendEmailResponse {
  success: boolean;
  messageId: string;
  threadId: string;
  timestamp: string;
}

export interface GmailMessagesResponse {
  messages: GmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface GmailSearchResponse {
  messages: GmailMessage[];
  total: number;
  query: string;
}

export interface GmailStatus {
  connected: boolean;
  email?: string;
  messagesTotal?: number;
  threadsTotal?: number;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
  color?: {
    textColor: string;
    backgroundColor: string;
  };
}

export class GmailService {
  static async checkStatus(): Promise<GmailStatus> {
    const response = await fetch(`${GMAIL_API_BASE_URL}/gmail-status`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to check Gmail status');
    }

    return response.json();
  }

  static async connectGmail(): Promise<void> {
    window.location.href = `${GMAIL_API_BASE_URL}/connect-gmail`;
  }

  static async sendEmail(emailData: SendEmailRequest): Promise<SendEmailResponse> {
    const response = await fetch(`${GMAIL_API_BASE_URL}/gmail/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send email');
    }

    return response.json();
  }

  static async getMessages(
    query?: string,
    maxResults: number = 20,
    pageToken?: string
  ): Promise<GmailMessagesResponse> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    params.append('maxResults', maxResults.toString());
    if (pageToken) params.append('pageToken', pageToken);

    const response = await fetch(`${GMAIL_API_BASE_URL}/gmail/messages?${params}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get messages');
    }

    return response.json();
  }

  static async searchEmails(query: string, maxResults: number = 10): Promise<GmailSearchResponse> {
    const params = new URLSearchParams({
      query,
      maxResults: maxResults.toString(),
    });

    const response = await fetch(`${GMAIL_API_BASE_URL}/gmail/search?${params}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to search emails');
    }

    return response.json();
  }

  static async markMessage(messageId: string, action: 'read' | 'unread'): Promise<void> {
    const response = await fetch(`${GMAIL_API_BASE_URL}/gmail/messages/${messageId}/mark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to mark message');
    }
  }

  static async getLabels(): Promise<GmailLabel[]> {
    const response = await fetch(`${GMAIL_API_BASE_URL}/gmail/labels`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get labels');
    }

    const data = await response.json();
    return data.labels;
  }

  // Helper functions
  static formatEmailAddress(email: string): string {
    // Extract name and email from "Name <email@domain.com>" format
    const match = email.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      const [, name, emailAddr] = match;
      return name.trim().replace(/"/g, '') || emailAddr;
    }
    return email;
  }

  static getEmailAddress(email: string): string {
    // Extract just the email address from "Name <email@domain.com>" format
    const match = email.match(/<(.+?)>/);
    return match ? match[1] : email;
  }

  static formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  static truncateText(text: string, maxLength: number = 100): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  static stripHtmlTags(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static parseEmailList(emailString: string): string[] {
    // Parse comma-separated email list
    return emailString
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
  }

  // Predefined search queries for quick access
  static getQuickSearchQueries() {
    return [
      { label: 'Unread', query: 'is:unread', icon: '📬' },
      { label: 'Starred', query: 'is:starred', icon: '⭐' },
      { label: 'Important', query: 'is:important', icon: '🔴' },
      { label: 'Sent', query: 'in:sent', icon: '📤' },
      { label: 'Drafts', query: 'in:drafts', icon: '📝' },
      { label: 'Today', query: 'newer_than:1d', icon: '📅' },
      { label: 'This Week', query: 'newer_than:7d', icon: '📆' },
      { label: 'Has Attachment', query: 'has:attachment', icon: '📎' },
    ];
  }

  // Email templates for common use cases
  static getEmailTemplates() {
    return [
      {
        name: 'Meeting Request',
        subject: 'Meeting Request - [Topic]',
        body: `Hi [Name],

I hope this email finds you well. I would like to schedule a meeting to discuss [topic/purpose].

Would you be available for a [duration] meeting sometime next week? I'm flexible with timing and can accommodate your schedule.

Please let me know what works best for you.

Best regards,
[Your Name]`,
      },
      {
        name: 'Follow Up',
        subject: 'Following up on [Topic]',
        body: `Hi [Name],

I wanted to follow up on our previous conversation regarding [topic].

[Specific follow-up content]

Please let me know if you have any questions or if there's anything else I can help with.

Best regards,
[Your Name]`,
      },
      {
        name: 'Thank You',
        subject: 'Thank you for [Reason]',
        body: `Hi [Name],

Thank you for [specific reason]. I really appreciate [what you appreciate].

[Additional context or next steps]

Looking forward to [future interaction/collaboration].

Best regards,
[Your Name]`,
      },
    ];
  }
} 