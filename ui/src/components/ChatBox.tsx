import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { sendChatMessage, checkQboStatus, disconnectQbo, redirectToQboConnect } from "../services/api";
import { voiceService } from "../services/voiceService";
import { ttsService } from "../services/ttsService";
import { SMSService } from "../services/smsService";
import { GmailService } from "../services/gmailService";
import { useAuth } from "../contexts/AuthContext";

type Msg = { role: "user" | "assistant" | "system"; text: string };

export default function ChatBox() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [qboConnected, setQboConnected] = useState<boolean>(
    localStorage.getItem("qboConnected") === "true"
  );
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Voice output states
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const [isPausedTTS, setIsPausedTTS] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Cleanup voice recording and TTS on unmount
  useEffect(() => {
    return () => {
      if (voiceService.isCurrentlyRecording()) {
        voiceService.stopRecording();
      }
      if (ttsService.isCurrentlyPlaying()) {
        ttsService.stop();
      }
    };
  }, []);

  // Auto-play new assistant messages if enabled
  useEffect(() => {
    if (autoPlayEnabled && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant" && !loading) {
        setTimeout(() => {
          handlePlayTTS(messages.length - 1, lastMessage.text);
        }, 500);
      }
    }
  }, [messages, autoPlayEnabled, loading]);

  // On load: handle ?qbo=connected|error and always verify with backend
  useEffect(() => {
    const url = new URL(window.location.href);

    if (url.searchParams.get("qbo") === "connected") {
      setQboConnected(true);
      localStorage.setItem("qboConnected", "true");
      url.searchParams.delete("qbo");
      window.history.replaceState({}, document.title, url.pathname);
    }

    if (url.searchParams.get("qbo") === "error") {
      setQboConnected(false);
      localStorage.removeItem("qboConnected");
      setError("QuickBooks connection failed. Please try again.");
      url.searchParams.delete("qbo");
      window.history.replaceState({}, document.title, url.pathname);
    }

    async function fetchStatus() {
      try {
        const status = await checkQboStatus();
        if (status.connected) {
          setQboConnected(true);
          localStorage.setItem("qboConnected", "true");
        } else {
          setQboConnected(false);
          localStorage.removeItem("qboConnected");
        }
      } catch (err: any) {
        setQboConnected(false);
        localStorage.removeItem("qboConnected");
        console.error("Status check failed:", err?.message || err);
      }
    }
    fetchStatus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  async function handleSend() {
    if (!input.trim()) return;
    setError(null);

    const userMsg: Msg = { role: "user", text: input };
    setMessages((m) => [...m, userMsg]);
    const originalInput = input;
    setInput("");
    setLoading(true);

    try {
      const smsMatch = originalInput.match(/^\/sms\s+(\+?[\d\s\-\(\)]+)\s+(.+)$/i);
      const emailMatch = originalInput.match(/^\/email\s+([^\s]+)\s+Subject:\s*(.+?)\s*\|\s*(.+)$/i);
      const searchEmailMatch = originalInput.match(/^\/search-email\s+(.+)$/i);

      if (smsMatch) {
        const [, phoneNumber, message] = smsMatch;
        try {
          const response = await SMSService.sendSMS(phoneNumber.trim(), message.trim());
          const reply = `SMS sent successfully to ${SMSService.formatPhoneNumber(response.to)}!\n\nMessage: "${message.trim()}"\nStatus: ${response.status}`;
          setMessages((m) => [...m, { role: "assistant", text: reply }]);
        } catch (smsErr: any) {
          const reply = `Failed to send SMS to ${phoneNumber}: ${smsErr.message}`;
          setMessages((m) => [...m, { role: "assistant", text: reply }]);
        }
      } else if (emailMatch) {
        const [, recipient, subject, body] = emailMatch;
        try {
          const response = await GmailService.sendEmail({
            to: recipient.trim(),
            subject: subject.trim(),
            body: body.trim(),
          });
          const reply = `Email sent successfully to ${recipient}!\n\nSubject: "${subject.trim()}"`;
          setMessages((m) => [...m, { role: "assistant", text: reply }]);
        } catch (emailErr: any) {
          const reply = `Failed to send email to ${recipient}: ${emailErr.message}`;
          setMessages((m) => [...m, { role: "assistant", text: reply }]);
        }
      } else if (searchEmailMatch) {
        const [, searchQuery] = searchEmailMatch;
        try {
          const response = await GmailService.searchEmails(searchQuery.trim(), 5);
          let reply = `Found ${response.total} emails matching "${searchQuery.trim()}":\n\n`;

          if (response.messages.length === 0) {
            reply += "No emails found matching your search.";
          } else {
            response.messages.forEach((msg, index) => {
              reply += `${index + 1}. **${msg.subject || "(No Subject)"}**\n`;
              reply += `   From: ${GmailService.formatEmailAddress(msg.from)}\n`;
              reply += `   Date: ${GmailService.formatDate(msg.date)}\n\n`;
            });
          }

          setMessages((m) => [...m, { role: "assistant", text: reply }]);
        } catch (searchErr: any) {
          const reply = `Failed to search emails: ${searchErr.message}`;
          setMessages((m) => [...m, { role: "assistant", text: reply }]);
        }
      } else {
        const response = await sendChatMessage(userMsg.text);
        const reply = (response?.reply as string) || "No response";
        setMessages((m) => [...m, { role: "assistant", text: reply }]);
      }
    } catch (err: any) {
      const msg = err?.message || "Something went wrong.";
      setError(msg);
      setMessages((m) => [...m, { role: "system", text: `Error: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    setRedirecting(true);
    redirectToQboConnect();
  }

  function handleVoiceToggle() {
    if (!voiceService.isSupported()) {
      setVoiceError("Speech recognition is not supported in this browser.");
      return;
    }

    setVoiceError(null);

    voiceService.toggleRecording({
      onTranscript: (transcript: string, isFinal: boolean) => {
        if (isFinal) {
          setInput(prev => prev + (prev ? " " : "") + transcript.trim());
          setInterimTranscript("");
        } else {
          setInterimTranscript(transcript);
        }
      },
      onError: (errorMsg: string) => {
        setVoiceError(errorMsg);
        setIsRecording(false);
        setInterimTranscript("");
      },
      onStart: () => {
        setIsRecording(true);
        setInterimTranscript("");
      },
      onEnd: () => {
        setIsRecording(false);
        setInterimTranscript("");
      }
    });
  }

  function handlePlayTTS(messageIndex: number, text: string) {
    if (!ttsService.isSupported()) return;

    if (playingMessageIndex !== null) {
      ttsService.stop();
    }

    setPlayingMessageIndex(messageIndex);
    setIsPausedTTS(false);

    ttsService.speak(text, {
      onStart: () => {
        setPlayingMessageIndex(messageIndex);
        setIsPausedTTS(false);
      },
      onEnd: () => {
        setPlayingMessageIndex(null);
        setIsPausedTTS(false);
      },
      onPause: () => setIsPausedTTS(true),
      onResume: () => setIsPausedTTS(false),
      onError: () => {
        setPlayingMessageIndex(null);
        setIsPausedTTS(false);
      }
    });
  }

  function handleStopTTS() {
    ttsService.stop();
    setPlayingMessageIndex(null);
    setIsPausedTTS(false);
  }

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      background: "#212121",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        .message-enter {
          animation: fadeIn 0.3s ease-out;
        }
        textarea:focus {
          outline: none;
        }
        textarea::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 40;
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s ease;
        }
        .sidebar-overlay.open {
          opacity: 1;
          visibility: visible;
        }
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: 280px;
          background: #171717;
          z-index: 50;
          transform: translateX(-100%);
          transition: transform 0.3s ease;
          display: flex;
          flex-direction: column;
        }
        .sidebar.open {
          transform: translateX(0);
        }
        @media (min-width: 768px) {
          .sidebar {
            position: relative;
            transform: translateX(0);
            width: 260px;
            flex-shrink: 0;
          }
          .sidebar-overlay {
            display: none;
          }
          .mobile-menu-btn {
            display: none !important;
          }
        }
      `}</style>

      {/* Sidebar Overlay (mobile) */}
      <div
        className={`sidebar-overlay ${showSidebar ? 'open' : ''}`}
        onClick={() => setShowSidebar(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${showSidebar ? 'open' : ''}`}>
        <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <button
            onClick={() => {
              setMessages([]);
              setShowSidebar(false);
            }}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "white",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 18 }}>+</span>
            New chat
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
          <div style={{ padding: "8px 12px", fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
            Connections
          </div>

          {/* QuickBooks Status */}
          <div style={{
            padding: "12px 16px",
            borderRadius: 8,
            margin: "4px 8px",
            background: qboConnected ? "rgba(16, 163, 127, 0.1)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${qboConnected ? "rgba(16, 163, 127, 0.3)" : "rgba(255,255,255,0.1)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: qboConnected ? "#10a37f" : "#6b7280",
              }} />
              <span style={{ fontSize: 13, color: "white", fontWeight: 500 }}>QuickBooks</span>
            </div>

            {qboConnected ? (
              <button
                onClick={async () => {
                  setDisconnecting(true);
                  try {
                    await disconnectQbo();
                    localStorage.removeItem("qboConnected");
                    setQboConnected(false);
                  } catch (err: any) {
                    setError(err?.message || "Failed to disconnect");
                  } finally {
                    setDisconnecting(false);
                  }
                }}
                disabled={disconnecting}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#ef4444",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: disconnecting ? "not-allowed" : "pointer",
                  opacity: disconnecting ? 0.6 : 1,
                }}
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={redirecting}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "#10a37f",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: redirecting ? "not-allowed" : "pointer",
                  opacity: redirecting ? 0.6 : 1,
                }}
              >
                {redirecting ? "Connecting..." : "Connect"}
              </button>
            )}
          </div>

          {/* Settings */}
          <div style={{ padding: "8px 12px", fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500, marginTop: 16 }}>
            Settings
          </div>

          {/* Auto-play toggle */}
          <button
            onClick={() => setAutoPlayEnabled(!autoPlayEnabled)}
            style={{
              width: "calc(100% - 16px)",
              margin: "4px 8px",
              padding: "12px 16px",
              borderRadius: 8,
              border: "none",
              background: autoPlayEnabled ? "rgba(16, 163, 127, 0.1)" : "rgba(255,255,255,0.05)",
              color: "white",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.2s",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>🔊</span>
              Auto-play responses
            </span>
            <div style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              background: autoPlayEnabled ? "#10a37f" : "rgba(255,255,255,0.2)",
              position: "relative",
              transition: "all 0.2s",
            }}>
              <div style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "white",
                position: "absolute",
                top: 2,
                left: autoPlayEnabled ? 18 : 2,
                transition: "all 0.2s",
              }} />
            </div>
          </button>
        </div>

        {/* User section */}
        <div style={{
          padding: 16,
          borderTop: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#10a37f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 12,
              fontWeight: 600,
            }}>
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <span style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.8)",
              maxWidth: 120,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {user?.email || "User"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "none",
              background: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}>
        {/* Header */}
        <header style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#212121",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setShowSidebar(true)}
              style={{
                padding: 8,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <span style={{ color: "white", fontSize: 16, fontWeight: 500 }}>
              Business Partner
            </span>
          </div>

          {playingMessageIndex !== null && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 6,
              background: "rgba(16, 163, 127, 0.1)",
              border: "1px solid rgba(16, 163, 127, 0.3)",
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#10a37f",
                animation: "pulse 1s infinite",
              }} />
              <span style={{ fontSize: 12, color: "#10a37f" }}>Speaking</span>
              <button
                onClick={handleStopTTS}
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: "none",
                  background: "rgba(239, 68, 68, 0.2)",
                  color: "#ef4444",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Stop
              </button>
            </div>
          )}
        </header>

        {/* Messages */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {messages.length === 0 ? (
            <div style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: "#10a37f",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}>
                <span style={{ fontSize: 24 }}>🤖</span>
              </div>
              <h2 style={{
                color: "white",
                fontSize: 24,
                fontWeight: 600,
                margin: "0 0 8px",
                textAlign: "center",
              }}>
                How can I help you today?
              </h2>
              <p style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 14,
                margin: 0,
                textAlign: "center",
                maxWidth: 400,
              }}>
                I can help with QuickBooks, Housecall Pro, Gmail, and SMS.
              </p>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
                marginTop: 32,
                width: "100%",
                maxWidth: 600,
              }}>
                {[
                  { icon: "📊", text: "Show my profit and loss" },
                  { icon: "👥", text: "List all customers" },
                  { icon: "📋", text: "Show unpaid invoices" },
                  { icon: "💰", text: "What's my account balance?" },
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(suggestion.text);
                      inputRef.current?.focus();
                    }}
                    style={{
                      padding: "16px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.03)",
                      color: "rgba(255,255,255,0.8)",
                      fontSize: 13,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{suggestion.icon}</span>
                    {suggestion.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 768, margin: "0 auto", padding: "24px 16px" }}>
              {messages.map((m, i) => {
                const isUser = m.role === "user";
                const isSystem = m.role === "system";
                const isPlaying = playingMessageIndex === i;
                const canPlayTTS = !isUser && !isSystem && ttsService.isSupported();

                return (
                  <div
                    key={i}
                    className="message-enter"
                    style={{
                      padding: "24px 0",
                      borderBottom: i < messages.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                    }}
                  >
                    <div style={{
                      display: "flex",
                      gap: 16,
                      alignItems: "flex-start",
                    }}>
                      {/* Avatar */}
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: isUser ? "50%" : 8,
                        background: isUser ? "#5436DA" : isSystem ? "#ef4444" : "#10a37f",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {isUser ? (
                          <span style={{ color: "white", fontSize: 12, fontWeight: 600 }}>
                            {user?.email?.[0]?.toUpperCase() || "U"}
                          </span>
                        ) : isSystem ? (
                          <span style={{ fontSize: 14 }}>⚠️</span>
                        ) : (
                          <span style={{ fontSize: 14 }}>🤖</span>
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "rgba(255,255,255,0.9)",
                          marginBottom: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}>
                          {isUser ? "You" : isSystem ? "System" : "Assistant"}
                          {isPlaying && (
                            <span style={{
                              fontSize: 11,
                              color: "#10a37f",
                              fontWeight: 500,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}>
                              <span style={{
                                width: 4,
                                height: 4,
                                borderRadius: "50%",
                                background: "#10a37f",
                                animation: "pulse 1s infinite",
                              }} />
                              Speaking
                            </span>
                          )}
                        </div>
                        <div style={{
                          color: isSystem ? "#fca5a5" : "rgba(255,255,255,0.85)",
                          fontSize: 15,
                          lineHeight: 1.7,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}>
                          {m.text}
                        </div>

                        {/* TTS Button */}
                        {canPlayTTS && (
                          <div style={{ marginTop: 12 }}>
                            {!isPlaying ? (
                              <button
                                onClick={() => handlePlayTTS(i, m.text)}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 6,
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  background: "transparent",
                                  color: "rgba(255,255,255,0.5)",
                                  fontSize: 12,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  transition: "all 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = "rgba(255,255,255,0.8)";
                                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                                }}
                              >
                                <span>🔊</span>
                                Play
                              </button>
                            ) : (
                              <button
                                onClick={handleStopTTS}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 6,
                                  border: "1px solid rgba(16, 163, 127, 0.3)",
                                  background: "rgba(16, 163, 127, 0.1)",
                                  color: "#10a37f",
                                  fontSize: 12,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <span>⏹️</span>
                                Stop
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Recording indicator */}
              {isRecording && (
                <div style={{
                  padding: "16px 0",
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#5436DA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <span style={{ color: "white", fontSize: 12, fontWeight: 600 }}>
                      {user?.email?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                  <div style={{
                    padding: "12px 16px",
                    borderRadius: 8,
                    background: "rgba(16, 163, 127, 0.1)",
                    border: "1px solid rgba(16, 163, 127, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#10a37f",
                      animation: "pulse 1s infinite",
                    }} />
                    <span style={{ color: "#10a37f", fontSize: 14 }}>
                      Listening... {interimTranscript && `"${interimTranscript}"`}
                    </span>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {loading && (
                <div style={{
                  padding: "24px 0",
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "#10a37f",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 14 }}>🤖</span>
                  </div>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "8px 0",
                  }}>
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.4)",
                          animation: `bounce 1.4s ${i * 0.16}s infinite ease-in-out both`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            margin: "0 16px 16px",
            padding: "12px 16px",
            borderRadius: 8,
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#fca5a5",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span>⚠️</span>
            {error}
            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                color: "#fca5a5",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Input Area */}
        <div style={{
          padding: "16px",
          background: "#212121",
          borderTop: messages.length > 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
          flexShrink: 0,
        }}>
          <div style={{
            maxWidth: 768,
            margin: "0 auto",
          }}>
            <div style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              padding: "12px 16px",
              borderRadius: 16,
              background: "#2f2f2f",
              border: "1px solid rgba(255,255,255,0.1)",
            }}>
              {/* Voice button */}
              <button
                onClick={handleVoiceToggle}
                disabled={loading}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: "none",
                  background: isRecording ? "rgba(16, 163, 127, 0.2)" : "transparent",
                  color: isRecording ? "#10a37f" : "rgba(255,255,255,0.5)",
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
                title={isRecording ? "Stop recording" : "Start voice input"}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </button>

              {/* Input */}
              <textarea
                ref={inputRef}
                value={input + (interimTranscript ? (input ? " " : "") + interimTranscript : "")}
                onChange={(e) => {
                  if (!isRecording) {
                    setInput(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message Business Partner..."
                disabled={loading}
                rows={1}
                style={{
                  flex: 1,
                  resize: "none",
                  border: "none",
                  background: "transparent",
                  color: "white",
                  fontSize: 15,
                  lineHeight: 1.5,
                  padding: "4px 0",
                  maxHeight: 200,
                  overflow: "auto",
                }}
              />

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: "none",
                  background: input.trim() ? "#10a37f" : "rgba(255,255,255,0.1)",
                  color: input.trim() ? "white" : "rgba(255,255,255,0.3)",
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>

            <p style={{
              textAlign: "center",
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              marginTop: 8,
              marginBottom: 0,
            }}>
              Business Partner can make mistakes. Consider checking important information.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
