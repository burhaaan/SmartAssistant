import React, { useState, useEffect, useRef } from "react";
import { SMSService, SMSMessage, SendSMSResponse } from "../services/smsService";

interface Contact {
  phoneNumber: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: string;
}

export default function SMSInterface() {
  const [selectedContact, setSelectedContact] = useState<string>("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showNewContact, setShowNewContact] = useState(false);
  const [messageHistory, setMessageHistory] = useState<SMSMessage[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load message history and contacts on mount
  useEffect(() => {
    loadMessageHistory();
    loadContacts();
  }, []);

  // Filter messages for selected contact
  useEffect(() => {
    if (selectedContact) {
      const contactMessages = messageHistory.filter(
        msg => msg.to === selectedContact || msg.from === selectedContact
      );
      setMessages(contactMessages);
    } else {
      setMessages([]);
    }
  }, [selectedContact, messageHistory]);

  async function loadMessageHistory() {
    try {
      const history = await SMSService.getSMSHistory(50);
      setMessageHistory(history.messages);
    } catch (err: any) {
      console.error("Failed to load message history:", err);
    }
  }

  function loadContacts() {
    const savedContacts = JSON.parse(localStorage.getItem('sms_contacts') || '{}');
    const contactList: Contact[] = Object.entries(savedContacts).map(([phone, name]) => ({
      phoneNumber: phone,
      name: name as string,
    }));
    
    // Add contacts from message history
    messageHistory.forEach(msg => {
      const phone = msg.direction === 'outbound-api' ? msg.to : msg.from;
      if (!contactList.find(c => c.phoneNumber === phone)) {
        contactList.push({
          phoneNumber: phone,
          name: SMSService.getContactName(phone) || SMSService.formatPhoneNumber(phone),
          lastMessage: msg.body.substring(0, 50) + (msg.body.length > 50 ? '...' : ''),
          lastMessageTime: msg.dateCreated,
        });
      }
    });

    setContacts(contactList);
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !selectedContact) return;
    
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response: SendSMSResponse = await SMSService.sendSMS(selectedContact, newMessage);
      
      // Add the sent message to local state immediately
      const sentMessage: SMSMessage = {
        sid: response.messageSid,
        to: selectedContact,
        from: "You", // Will be replaced by actual number from backend
        body: newMessage,
        status: response.status,
        direction: 'outbound-api',
        dateCreated: response.timestamp,
      };
      
      setMessages(prev => [...prev, sentMessage]);
      setNewMessage("");
      setSuccess("Message sent successfully!");
      
      // Reload history to get updated data
      await loadMessageHistory();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to send message");
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  }

  function handleAddContact() {
    if (!newContactPhone.trim()) return;
    
    if (!SMSService.validatePhoneNumber(newContactPhone)) {
      setError("Please enter a valid phone number");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const formattedPhone = newContactPhone.replace(/\D/g, '');
    let finalPhone = formattedPhone;
    
    if (formattedPhone.length === 10) {
      finalPhone = '+1' + formattedPhone;
    } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
      finalPhone = '+' + formattedPhone;
    }

    SMSService.saveContactName(finalPhone, newContactName || SMSService.formatPhoneNumber(finalPhone));
    
    const newContact: Contact = {
      phoneNumber: finalPhone,
      name: newContactName || SMSService.formatPhoneNumber(finalPhone),
    };
    
    setContacts(prev => [...prev.filter(c => c.phoneNumber !== finalPhone), newContact]);
    setSelectedContact(finalPhone);
    setNewContactPhone("");
    setNewContactName("");
    setShowNewContact(false);
  }

  function formatMessageTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 48) {
      return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  return (
    <div
      className="glass"
      style={{
        borderRadius: 24,
        overflow: "hidden",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        height: "600px",
        display: "flex",
        flexDirection: "column" as const,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(0, 0, 0, 0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "16px",
              background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              boxShadow: "0 8px 20px rgba(16, 185, 129, 0.3)",
            }}
          >
            📱
          </div>
          <div>
            <div style={{
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: "-0.01em",
              background: "linear-gradient(135deg, #ffffff 0%, #10b981 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}>
              SMS Messages
            </div>
            <div style={{
              fontSize: 13,
              color: "rgba(255, 255, 255, 0.6)",
              fontWeight: 400,
              marginTop: 2,
            }}>
              Send and manage text messages
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Contacts Sidebar */}
        <div
          style={{
            width: "300px",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(0, 0, 0, 0.1)",
            display: "flex",
            flexDirection: "column" as const,
          }}
        >
          {/* Add Contact Button */}
          <div style={{ padding: "16px" }}>
            <button
              onClick={() => setShowNewContact(!showNewContact)}
              className="glass"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))",
                color: "#10b981",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
              }}
            >
              <span>+</span>
              {showNewContact ? "Cancel" : "New Contact"}
            </button>
          </div>

          {/* Add Contact Form */}
          {showNewContact && (
            <div
              style={{
                padding: "0 16px 16px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <input
                type="text"
                placeholder="Phone number"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                className="glass"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  background: "rgba(0, 0, 0, 0.3)",
                  color: "white",
                  fontSize: 14,
                  outline: "none",
                  marginBottom: 8,
                }}
              />
              <input
                type="text"
                placeholder="Name (optional)"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                className="glass"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  background: "rgba(0, 0, 0, 0.3)",
                  color: "white",
                  fontSize: 14,
                  outline: "none",
                  marginBottom: 8,
                }}
              />
              <button
                onClick={handleAddContact}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Add Contact
              </button>
            </div>
          )}

          {/* Contacts List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {contacts.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "rgba(255, 255, 255, 0.5)",
                  fontSize: 14,
                }}
              >
                No contacts yet. Add one to start messaging!
              </div>
            ) : (
              contacts.map((contact) => (
                <div
                  key={contact.phoneNumber}
                  onClick={() => setSelectedContact(contact.phoneNumber)}
                  className="glass"
                  style={{
                    padding: "12px 16px",
                    borderRadius: "12px",
                    margin: "4px 0",
                    cursor: "pointer",
                    border: `1px solid ${
                      selectedContact === contact.phoneNumber
                        ? "rgba(16, 185, 129, 0.4)"
                        : "rgba(255, 255, 255, 0.1)"
                    }`,
                    background: selectedContact === contact.phoneNumber
                      ? "rgba(16, 185, 129, 0.1)"
                      : "rgba(255, 255, 255, 0.05)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: "white",
                      marginBottom: 4,
                    }}
                  >
                    {contact.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255, 255, 255, 0.6)",
                      marginBottom: 2,
                    }}
                  >
                    {SMSService.formatPhoneNumber(contact.phoneNumber)}
                  </div>
                  {contact.lastMessage && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(255, 255, 255, 0.5)",
                      }}
                    >
                      {contact.lastMessage}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" as const }}>
          {!selectedContact ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255, 255, 255, 0.5)",
                fontSize: 16,
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
                <div>Select a contact to start messaging</div>
              </div>
            </div>
          ) : (
            <>
              {/* Selected Contact Header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "rgba(0, 0, 0, 0.1)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 16, color: "white" }}>
                  {contacts.find(c => c.phoneNumber === selectedContact)?.name || 
                   SMSService.formatPhoneNumber(selectedContact)}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)" }}>
                  {SMSService.formatPhoneNumber(selectedContact)}
                </div>
              </div>

              {/* Messages */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "16px 20px",
                  background: "rgba(0, 0, 0, 0.1)",
                }}
              >
                {messages.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      color: "rgba(255, 255, 255, 0.5)",
                      fontSize: 14,
                      marginTop: "20px",
                    }}
                  >
                    No messages yet. Send the first one!
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isOutbound = msg.direction === 'outbound-api';
                    return (
                      <div
                        key={msg.sid || index}
                        style={{
                          display: "flex",
                          justifyContent: isOutbound ? "flex-end" : "flex-start",
                          marginBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "70%",
                            padding: "12px 16px",
                            borderRadius: isOutbound
                              ? "18px 18px 4px 18px"
                              : "18px 18px 18px 4px",
                            background: isOutbound
                              ? "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)"
                              : "rgba(255, 255, 255, 0.1)",
                            color: "white",
                            fontSize: 14,
                            lineHeight: 1.4,
                          }}
                        >
                          <div>{msg.body}</div>
                          <div
                            style={{
                              fontSize: 11,
                              color: isOutbound
                                ? "rgba(255, 255, 255, 0.8)"
                                : "rgba(255, 255, 255, 0.6)",
                              marginTop: 4,
                              textAlign: "right",
                            }}
                          >
                            {formatMessageTime(msg.dateCreated)}
                            {isOutbound && (
                              <span style={{ marginLeft: 4 }}>
                                {msg.status === 'delivered' ? '✓✓' : 
                                 msg.status === 'sent' ? '✓' : 
                                 msg.status === 'failed' ? '✗' : '⏳'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div
                style={{
                  padding: "16px 20px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "rgba(0, 0, 0, 0.1)",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "end" }}>
                  <div style={{ flex: 1 }}>
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type your message..."
                      disabled={loading}
                      className="glass"
                      style={{
                        width: "100%",
                        minHeight: "44px",
                        maxHeight: "120px",
                        padding: "12px 16px",
                        borderRadius: "16px",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        background: "rgba(0, 0, 0, 0.3)",
                        color: "white",
                        fontSize: 14,
                        outline: "none",
                        resize: "none",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={loading || !newMessage.trim()}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "14px",
                      border: "none",
                      background: loading || !newMessage.trim()
                        ? "rgba(16, 185, 129, 0.4)"
                        : "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                      color: "white",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: loading || !newMessage.trim() ? "not-allowed" : "pointer",
                      opacity: loading || !newMessage.trim() ? 0.6 : 1,
                      transition: "all 0.2s ease",
                      minWidth: "60px",
                    }}
                  >
                    {loading ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div
          className="glass"
          style={{
            position: "absolute",
            bottom: "20px",
            left: "20px",
            right: "20px",
            padding: "12px 16px",
            borderRadius: "12px",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(255, 255, 255, 0.05))",
            color: "#ef4444",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>⚠️</span>
          {error}
        </div>
      )}

      {success && (
        <div
          className="glass"
          style={{
            position: "absolute",
            bottom: "20px",
            left: "20px",
            right: "20px",
            padding: "12px 16px",
            borderRadius: "12px",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(255, 255, 255, 0.05))",
            color: "#10b981",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>✅</span>
          {success}
        </div>
      )}
    </div>
  );
} 