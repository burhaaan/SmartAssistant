const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export interface SMSMessage {
  sid: string;
  to: string;
  from: string;
  body: string;
  status: string;
  direction: 'inbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  dateCreated: string;
  dateSent?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface SendSMSResponse {
  success: boolean;
  messageSid: string;
  to: string;
  status: string;
  timestamp: string;
}

export interface SMSHistoryResponse {
  messages: SMSMessage[];
}

export class SMSService {
  static async sendSMS(to: string, message: string): Promise<SendSMSResponse> {
    const response = await fetch(`${API_BASE_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, message }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send SMS');
    }

    return response.json();
  }

  static async getSMSStatus(messageSid: string): Promise<SMSMessage> {
    const response = await fetch(`${API_BASE_URL}/sms/status/${messageSid}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get SMS status');
    }

    return response.json();
  }

  static async getSMSHistory(limit: number = 20): Promise<SMSHistoryResponse> {
    const response = await fetch(`${API_BASE_URL}/sms/history?limit=${limit}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get SMS history');
    }

    return response.json();
  }

  // Helper function to format phone numbers for display
  static formatPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const number = cleaned.slice(1);
      return `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
    }
    
    if (cleaned.length === 10) {
      return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    
    return phoneNumber; // Return as-is if not a standard US number
  }

  // Helper function to validate phone numbers
  static validatePhoneNumber(phoneNumber: string): boolean {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // US phone numbers: 10 digits or 11 digits starting with 1
    if (cleaned.length === 10) return true;
    if (cleaned.length === 11 && cleaned.startsWith('1')) return true;
    
    // International numbers: 7-15 digits
    if (cleaned.length >= 7 && cleaned.length <= 15) return true;
    
    return false;
  }

  // Helper function to extract names/labels for phone numbers
  static getContactName(phoneNumber: string): string {
    // This could be enhanced to integrate with a contacts database
    const contacts: Record<string, string> = JSON.parse(
      localStorage.getItem('sms_contacts') || '{}'
    );
    return contacts[phoneNumber] || '';
  }

  // Helper function to save contact names
  static saveContactName(phoneNumber: string, name: string): void {
    const contacts: Record<string, string> = JSON.parse(
      localStorage.getItem('sms_contacts') || '{}'
    );
    if (name.trim()) {
      contacts[phoneNumber] = name.trim();
    } else {
      delete contacts[phoneNumber];
    }
    localStorage.setItem('sms_contacts', JSON.stringify(contacts));
  }
} 