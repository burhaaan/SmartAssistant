import React, { useState, useEffect, useRef } from "react";
import { GmailService, GmailMessage, SendEmailRequest, GmailStatus } from "../services/gmailService";

type ViewMode = 'inbox' | 'compose' | 'search' | 'message';

export default function GmailInterface() {
  const [viewMode, setViewMode] = useState<ViewMode>('inbox');
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>({ connected: false });
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Compose form state
  const [composeForm, setComposeForm] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
  });
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GmailMessage[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkGmailStatus();
    
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('gmail') === 'connected') {
      setSuccess('Gmail connected successfully!');
      setTimeout(() => setSuccess(null), 3000);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      checkGmailStatus();
    } else if (urlParams.get('gmail') === 'error') {
      setError('Failed to connect Gmail. Please try again.');
      setTimeout(() => setError(null), 5000);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (gmailStatus.connected && viewMode === 'inbox') {
      loadMessages();
    }
  }, [gmailStatus.connected, viewMode]);

  async function checkGmailStatus() {
    try {
      const status = await GmailService.checkStatus();
      setGmailStatus(status);
    } catch (err) {
      console.error('Failed to check Gmail status:', err);
    }
  }

  async function loadMessages(query?: string) {
    if (!gmailStatus.connected) return;
    
    setLoading(true);
    try {
      const response = await GmailService.getMessages(query || activeFilter, 20);
      setMessages(response.messages);
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmail() {
    if (!composeForm.to.trim() || !composeForm.subject.trim() || !composeForm.body.trim()) {
      setError('Please fill in all required fields (To, Subject, Body)');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!GmailService.isValidEmail(composeForm.to)) {
      setError('Please enter a valid email address');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setLoading(true);
    try {
      const emailData: SendEmailRequest = {
        to: composeForm.to,
        subject: composeForm.subject,
        body: composeForm.body,
        cc: composeForm.cc || undefined,
        bcc: composeForm.bcc || undefined,
      };

      await GmailService.sendEmail(emailData);
      setSuccess('Email sent successfully!');
      setComposeForm({ to: '', cc: '', bcc: '', subject: '', body: '' });
      setViewMode('inbox');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await GmailService.searchEmails(searchQuery, 20);
      setSearchResults(response.messages);
      setViewMode('search');
    } catch (err: any) {
      setError(err.message || 'Failed to search emails');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickFilter(query: string, label: string) {
    setActiveFilter(query);
    setViewMode('inbox');
    await loadMessages(query);
  }

  async function handleMarkAsRead(messageId: string, currentlyUnread: boolean) {
    try {
      await GmailService.markMessage(messageId, currentlyUnread ? 'read' : 'unread');
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, unread: !currentlyUnread } : msg
      ));
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(prev => prev ? { ...prev, unread: !currentlyUnread } : null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update message');
      setTimeout(() => setError(null), 3000);
    }
  }

  function handleUseTemplate(template: any) {
    setComposeForm({
      ...composeForm,
      subject: template.subject,
      body: template.body,
    });
    setViewMode('compose');
  }

  function formatMessageDate(dateString: string): string {
    return GmailService.formatDate(dateString);
  }

  const quickFilters = GmailService.getQuickSearchQueries();
  const emailTemplates = GmailService.getEmailTemplates();

  if (!gmailStatus.connected) {
    return (
      <div
        className="glass"
        style={{
          borderRadius: 24,
          padding: 40,
          textAlign: "center",
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          minHeight: "400px",
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "24px",
            background: "linear-gradient(135deg, #ea4335 0%, #fbbc04 50%, #34a853 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            marginBottom: 24,
            boxShadow: "0 12px 24px rgba(234, 67, 53, 0.3)",
          }}
        >
          📧
        </div>
        
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 800,
            background: "linear-gradient(135deg, #ffffff 0%, #ea4335 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: 12,
          }}
        >
          Connect Gmail
        </h2>
        
        <p
          style={{
            margin: 0,
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: 16,
            maxWidth: "400px",
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          Connect your Gmail account to send emails, manage your inbox, and search through your messages with AI assistance.
        </p>

        <button
          onClick={() => GmailService.connectGmail()}
          style={{
            padding: "16px 32px",
            borderRadius: "16px",
            border: "none",
            background: "linear-gradient(135deg, #ea4335 0%, #fbbc04 100%)",
            color: "white",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 12px 24px rgba(234, 67, 53, 0.4)",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 16px 32px rgba(234, 67, 53, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 12px 24px rgba(234, 67, 53, 0.4)";
          }}
        >
          <span>🔗</span>
          Connect Gmail Account
        </button>

        <div
          style={{
            marginTop: 24,
            padding: "12px 16px",
            borderRadius: "12px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            fontSize: 12,
            color: "rgba(255, 255, 255, 0.6)",
          }}
        >
          🔒 Secure OAuth2 authentication • Read-only access • No passwords stored
        </div>
      </div>
    );
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
        height: "700px",
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "16px",
                background: "linear-gradient(135deg, #ea4335 0%, #fbbc04 50%, #34a853 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                boxShadow: "0 8px 20px rgba(234, 67, 53, 0.3)",
              }}
            >
              📧
            </div>
            <div>
              <div style={{
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: "-0.01em",
                background: "linear-gradient(135deg, #ffffff 0%, #ea4335 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}>
                Gmail
              </div>
              <div style={{
                fontSize: 13,
                color: "rgba(255, 255, 255, 0.6)",
                fontWeight: 400,
                marginTop: 2,
              }}>
                {gmailStatus.email} • {gmailStatus.messagesTotal} messages
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* View Mode Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setViewMode('inbox')}
                className="glass"
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border: `1px solid ${viewMode === 'inbox' ? "rgba(234, 67, 53, 0.4)" : "rgba(255, 255, 255, 0.15)"}`,
                  background: viewMode === 'inbox' 
                    ? "rgba(234, 67, 53, 0.15)" 
                    : "rgba(255, 255, 255, 0.05)",
                  color: viewMode === 'inbox' ? "#ea4335" : "rgba(255, 255, 255, 0.8)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                📥 Inbox
              </button>
              <button
                onClick={() => setViewMode('compose')}
                className="glass"
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border: `1px solid ${viewMode === 'compose' ? "rgba(234, 67, 53, 0.4)" : "rgba(255, 255, 255, 0.15)"}`,
                  background: viewMode === 'compose' 
                    ? "rgba(234, 67, 53, 0.15)" 
                    : "rgba(255, 255, 255, 0.05)",
                  color: viewMode === 'compose' ? "#ea4335" : "rgba(255, 255, 255, 0.8)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                ✏️ Compose
              </button>
            </div>

            {/* Search Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="glass"
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  background: "rgba(0, 0, 0, 0.3)",
                  color: "white",
                  fontSize: 12,
                  outline: "none",
                  width: "200px",
                }}
              />
              <button
                onClick={handleSearch}
                disabled={!searchQuery.trim()}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "none",
                  background: searchQuery.trim() 
                    ? "linear-gradient(135deg, #ea4335 0%, #fbbc04 100%)"
                    : "rgba(255, 255, 255, 0.1)",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: searchQuery.trim() ? "pointer" : "not-allowed",
                  opacity: searchQuery.trim() ? 1 : 0.5,
                }}
              >
                🔍
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <div
          style={{
            width: "250px",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(0, 0, 0, 0.1)",
            padding: "16px",
            overflowY: "auto",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.8)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              Quick Filters
            </div>
            {quickFilters.map((filter) => (
              <button
                key={filter.query}
                onClick={() => handleQuickFilter(filter.query, filter.label)}
                className="glass"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: `1px solid ${activeFilter === filter.query ? "rgba(234, 67, 53, 0.4)" : "rgba(255, 255, 255, 0.1)"}`,
                  background: activeFilter === filter.query 
                    ? "rgba(234, 67, 53, 0.1)" 
                    : "rgba(255, 255, 255, 0.05)",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  textAlign: "left" as const,
                }}
              >
                <span>{filter.icon}</span>
                {filter.label}
              </button>
            ))}
          </div>

          {viewMode === 'compose' && (
            <div>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.8)",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
                Email Templates
              </div>
              {emailTemplates.map((template, index) => (
                <button
                  key={index}
                  onClick={() => handleUseTemplate(template)}
                  className="glass"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "white",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    marginBottom: 4,
                    textAlign: "left" as const,
                  }}
                >
                  📝 {template.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" as const }}>
          {viewMode === 'compose' && (
            <div style={{ padding: "20px", flex: 1, overflowY: "auto" }}>
              <h3 style={{
                margin: "0 0 20px 0",
                fontSize: 18,
                fontWeight: 700,
                color: "white",
              }}>
                Compose Email
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>
                <input
                  type="email"
                  placeholder="To: recipient@example.com"
                  value={composeForm.to}
                  onChange={(e) => setComposeForm({ ...composeForm, to: e.target.value })}
                  className="glass"
                  style={{
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    background: "rgba(0, 0, 0, 0.3)",
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
                
                <div style={{ display: "flex", gap: 12 }}>
                  <input
                    type="email"
                    placeholder="Cc (optional)"
                    value={composeForm.cc}
                    onChange={(e) => setComposeForm({ ...composeForm, cc: e.target.value })}
                    className="glass"
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      background: "rgba(0, 0, 0, 0.3)",
                      color: "white",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  <input
                    type="email"
                    placeholder="Bcc (optional)"
                    value={composeForm.bcc}
                    onChange={(e) => setComposeForm({ ...composeForm, bcc: e.target.value })}
                    className="glass"
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      background: "rgba(0, 0, 0, 0.3)",
                      color: "white",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                </div>
                
                <input
                  type="text"
                  placeholder="Subject"
                  value={composeForm.subject}
                  onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                  className="glass"
                  style={{
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    background: "rgba(0, 0, 0, 0.3)",
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
                
                <textarea
                  placeholder="Write your email..."
                  value={composeForm.body}
                  onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                  className="glass"
                  style={{
                    minHeight: "300px",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    background: "rgba(0, 0, 0, 0.3)",
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                    resize: "vertical" as const,
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                  }}
                />
                
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setViewMode('inbox')}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "12px",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      background: "rgba(255, 255, 255, 0.05)",
                      color: "rgba(255, 255, 255, 0.8)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={loading}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "12px",
                      border: "none",
                      background: loading 
                        ? "rgba(234, 67, 53, 0.4)"
                        : "linear-gradient(135deg, #ea4335 0%, #fbbc04 100%)",
                      color: "white",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? "Sending..." : "Send Email"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {(viewMode === 'inbox' || viewMode === 'search') && (
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {loading && (
                <div style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "rgba(255, 255, 255, 0.6)",
                }}>
                  Loading emails...
                </div>
              )}

              {!loading && (viewMode === 'inbox' ? messages : searchResults).length === 0 && (
                <div style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "rgba(255, 255, 255, 0.5)",
                }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                  <div>No emails found</div>
                </div>
              )}

              {(viewMode === 'inbox' ? messages : searchResults).map((message) => (
                <div
                  key={message.id}
                  onClick={() => {
                    setSelectedMessage(message);
                    setViewMode('message');
                    if (message.unread) {
                      handleMarkAsRead(message.id, true);
                    }
                  }}
                  className="glass"
                  style={{
                    padding: "16px 20px",
                    borderRadius: "12px",
                    marginBottom: 8,
                    cursor: "pointer",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    background: message.unread 
                      ? "rgba(234, 67, 53, 0.05)" 
                      : "rgba(255, 255, 255, 0.03)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = message.unread 
                      ? "rgba(234, 67, 53, 0.1)" 
                      : "rgba(255, 255, 255, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = message.unread 
                      ? "rgba(234, 67, 53, 0.05)" 
                      : "rgba(255, 255, 255, 0.03)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: message.unread ? "#ea4335" : "transparent",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{
                      fontWeight: message.unread ? 700 : 600,
                      fontSize: 14,
                      color: "white",
                      flex: 1,
                    }}>
                      {GmailService.formatEmailAddress(message.from)}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: "rgba(255, 255, 255, 0.6)",
                      flexShrink: 0,
                    }}>
                      {formatMessageDate(message.date)}
                    </div>
                  </div>
                  
                  <div style={{
                    fontWeight: message.unread ? 600 : 500,
                    fontSize: 14,
                    color: "white",
                    marginBottom: 4,
                  }}>
                    {message.subject || "(No Subject)"}
                  </div>
                  
                  <div style={{
                    fontSize: 13,
                    color: "rgba(255, 255, 255, 0.7)",
                    lineHeight: 1.4,
                  }}>
                    {GmailService.truncateText(message.snippet, 120)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'message' && selectedMessage && (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
              <div style={{ marginBottom: 16 }}>
                <button
                  onClick={() => setViewMode('inbox')}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "rgba(255, 255, 255, 0.8)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: 16,
                  }}
                >
                  ← Back to Inbox
                </button>
              </div>

              <div
                className="glass"
                style={{
                  padding: "24px",
                  borderRadius: "16px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "rgba(255, 255, 255, 0.03)",
                }}
              >
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{
                    margin: "0 0 12px 0",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "white",
                    lineHeight: 1.3,
                  }}>
                    {selectedMessage.subject || "(No Subject)"}
                  </h2>
                  
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 8,
                  }}>
                    <div style={{
                      fontSize: 14,
                      color: "rgba(255, 255, 255, 0.9)",
                      fontWeight: 600,
                    }}>
                      From: {GmailService.formatEmailAddress(selectedMessage.from)}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: "rgba(255, 255, 255, 0.6)",
                    }}>
                      {new Date(selectedMessage.date).toLocaleString()}
                    </div>
                  </div>
                  
                  <div style={{
                    fontSize: 14,
                    color: "rgba(255, 255, 255, 0.8)",
                  }}>
                    To: {selectedMessage.to}
                  </div>
                </div>

                <div style={{
                  fontSize: 14,
                  color: "rgba(255, 255, 255, 0.9)",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap" as const,
                }}>
                  {selectedMessage.body ? 
                    GmailService.stripHtmlTags(selectedMessage.body) : 
                    selectedMessage.snippet
                  }
                </div>

                <div style={{
                  marginTop: 20,
                  paddingTop: 20,
                  borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                  display: "flex",
                  gap: 12,
                }}>
                  <button
                    onClick={() => handleMarkAsRead(selectedMessage.id, selectedMessage.unread)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "10px",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      background: "rgba(255, 255, 255, 0.05)",
                      color: "rgba(255, 255, 255, 0.8)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Mark as {selectedMessage.unread ? 'Read' : 'Unread'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setComposeForm({
                        ...composeForm,
                        to: GmailService.getEmailAddress(selectedMessage.from),
                        subject: selectedMessage.subject.startsWith('Re:') 
                          ? selectedMessage.subject 
                          : `Re: ${selectedMessage.subject}`,
                        body: `\n\n--- Original Message ---\nFrom: ${selectedMessage.from}\nDate: ${selectedMessage.date}\nSubject: ${selectedMessage.subject}\n\n${selectedMessage.snippet}`,
                      });
                      setViewMode('compose');
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(135deg, #ea4335 0%, #fbbc04 100%)",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Reply
                  </button>
                </div>
              </div>
            </div>
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
            border: "1px solid rgba(34, 197, 94, 0.3)",
            background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(255, 255, 255, 0.05))",
            color: "#22c55e",
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