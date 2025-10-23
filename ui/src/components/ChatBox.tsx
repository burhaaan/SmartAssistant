import React, { useState, useEffect, useRef } from "react";
import { sendChatMessage, checkQboStatus } from "../services/api";
import { redirectToQboConnect } from "../services/api";
import { voiceService } from "../services/voiceService";
import { ttsService } from "../services/ttsService";
import { SMSService } from "../services/smsService";
import { GmailService } from "../services/gmailService";


type Msg = { role: "user" | "assistant" | "system"; text: string };

export default function ChatBox() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Hi! I'm your AI business partner. I can help with:\n\n📊 QuickBooks data & customer management\n📱 Send SMS messages (just ask me naturally, like \"send a message 'hi' to +1234567890\")\n📧 Send emails (use natural language or `/email recipient@example.com Subject: Your subject | Your message`)\n🔍 Search emails using `/search-email your search query`\n🎯 Business analysis and insights\n\nWhat would you like to do today? 🚀",
    },
  ]);
  const [input, setInput] = useState("");
  const [qboConnected, setQboConnected] = useState<boolean>(
    localStorage.getItem("qboConnected") === "true"
  );
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  // Voice output states
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const [isPausedTTS, setIsPausedTTS] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);

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
        // Small delay to let the message render
        setTimeout(() => {
          handlePlayTTS(messages.length - 1, lastMessage.text);
        }, 500);
      }
    }
  }, [messages, autoPlayEnabled, loading]);

  // On load: handle ?qbo=connected|error and always verify with backend
  useEffect(() => {
    const url = new URL(window.location.href);

    // success
    if (url.searchParams.get("qbo") === "connected") {
      setQboConnected(true);
      localStorage.setItem("qboConnected", "true");
      url.searchParams.delete("qbo");
      window.history.replaceState({}, document.title, url.pathname);
    }

    // error
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
        // On error, clear the local flag so UI doesn't show stale "Connected"
        setQboConnected(false);
        localStorage.removeItem("qboConnected");
        console.error("Status check failed:", err?.message || err);
      }
    }
    fetchStatus();
  }, []);

  async function handleSend() {
    if (!input.trim()) return;
    setError(null);

    const userMsg: Msg = { role: "user", text: input };
    setMessages((m) => [...m, userMsg]);
    const originalInput = input;
    setInput("");
    setLoading(true);

    try {
      // Check if this is an SMS command
      const smsMatch = originalInput.match(/^\/sms\s+(\+?[\d\s\-\(\)]+)\s+(.+)$/i);
      
      // Check if this is an email command
      const emailMatch = originalInput.match(/^\/email\s+([^\s]+)\s+Subject:\s*(.+?)\s*\|\s*(.+)$/i);
      
      // Check if this is an email search command
      const searchEmailMatch = originalInput.match(/^\/search-email\s+(.+)$/i);
      
      if (smsMatch) {
        const [, phoneNumber, message] = smsMatch;
        
        try {
          const response = await SMSService.sendSMS(phoneNumber.trim(), message.trim());
          const reply = `✅ SMS sent successfully to ${SMSService.formatPhoneNumber(response.to)}!\n\nMessage: "${message.trim()}"\nStatus: ${response.status}\nMessage ID: ${response.messageSid}`;
          setMessages((m) => [...m, { role: "assistant", text: reply }]);
        } catch (smsErr: any) {
          const reply = `❌ Failed to send SMS to ${phoneNumber}: ${smsErr.message}`;
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
          const reply = `✅ Email sent successfully to ${recipient}!\n\nSubject: "${subject.trim()}"\nMessage ID: ${response.messageId}\nTimestamp: ${response.timestamp}`;
          setMessages((m) => [...m, { role: "assistant", text: reply }]);
        } catch (emailErr: any) {
          const reply = `❌ Failed to send email to ${recipient}: ${emailErr.message}`;
          setMessages((m) => [...m, { role: "assistant", text: reply }]);
        }
      } else if (searchEmailMatch) {
        const [, searchQuery] = searchEmailMatch;
        
        try {
          const response = await GmailService.searchEmails(searchQuery.trim(), 5);
          let reply = `🔍 Found ${response.total} emails matching "${searchQuery.trim()}":\n\n`;
          
          if (response.messages.length === 0) {
            reply += "No emails found matching your search.";
          } else {
            response.messages.forEach((msg, index) => {
              reply += `${index + 1}. **${msg.subject || "(No Subject)"}**\n`;
              reply += `   From: ${GmailService.formatEmailAddress(msg.from)}\n`;
              reply += `   Date: ${GmailService.formatDate(msg.date)}\n`;
              reply += `   Preview: ${GmailService.truncateText(msg.snippet, 80)}\n\n`;
            });
          }
          
          setMessages((m) => [...m, { role: "assistant", text: reply }]);
        } catch (searchErr: any) {
          const reply = `❌ Failed to search emails: ${searchErr.message}`;
          setMessages((m) => [...m, { role: "assistant", text: reply }]);
        }
      } else {
        // Regular chat message
        const response = await sendChatMessage(userMsg.text);
        const reply = (response?.reply as string) || "No response";
        setMessages((m) => [...m, { role: "assistant", text: reply }]);
      }
    } catch (err: any) {
      const msg = err?.message || "Something went wrong.";
      setError(msg);
      // also show it in the chat stream for visibility
      setMessages((m) => [...m, { role: "system", text: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    setRedirecting(true);
    redirectToQboConnect();
  }

  function handleQuickInsert(text: string) {
    setInput(text);
  }

  // Voice recording functions
  function handleVoiceToggle() {
    if (!voiceService.isSupported()) {
      setVoiceError("Speech recognition is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    setVoiceError(null);

    const success = voiceService.toggleRecording({
      onTranscript: (transcript: string, isFinal: boolean) => {
        if (isFinal) {
          // Add final transcript to input, preserving existing text
          setInput(prev => prev + (prev ? " " : "") + transcript.trim());
          setInterimTranscript("");
        } else {
          // Show interim transcript for real-time feedback
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

    if (!success) {
      setVoiceError("Failed to start/stop voice recording. Please try again.");
    }
  }

  // TTS functions
  function handlePlayTTS(messageIndex: number, text: string) {
    if (!ttsService.isSupported()) {
      return;
    }

    // Stop current playback if any
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
      onPause: () => {
        setIsPausedTTS(true);
      },
      onResume: () => {
        setIsPausedTTS(false);
      },
      onError: () => {
        setPlayingMessageIndex(null);
        setIsPausedTTS(false);
      }
    });
  }

  function handlePauseTTS() {
    if (ttsService.isCurrentlyPlaying()) {
      ttsService.pause();
    }
  }

  function handleResumeTTS() {
    if (ttsService.isCurrentlyPaused()) {
      ttsService.resume();
    }
  }

  function handleStopTTS() {
    ttsService.stop();
    setPlayingMessageIndex(null);
    setIsPausedTTS(false);
  }

  const pill = (text: string, onClick: () => void, icon?: string) => (
    <button
      onClick={onClick}
      className="glass"
      style={{
        padding: "10px 16px",
        borderRadius: "20px",
        color: "white",
        fontSize: 13,
        fontWeight: 500,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.08))";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))";
      }}
    >
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {text}
    </button>
  );

  return (
    <div
      className="glass"
      style={{
        borderRadius: 24,
        padding: 24,
        color: "white",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      }}
    >
      {/* Enhanced header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
          justifyContent: "space-between",
          paddingBottom: 16,
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "16px",
              background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              boxShadow: "0 8px 20px rgba(139, 92, 246, 0.3)",
            }}
          >
            🤖
          </div>
          <div>
            <div style={{ 
              fontWeight: 700, 
              fontSize: 16,
              letterSpacing: "-0.01em",
              background: "linear-gradient(135deg, #ffffff 0%, #e879f9 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}>
              Claude Assistant
            </div>
            <div style={{ 
              fontSize: 13, 
              color: "rgba(255, 255, 255, 0.6)",
              fontWeight: 400,
              marginTop: 2,
            }}>
              Your AI Business Partner
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Global TTS Controls */}
          {playingMessageIndex !== null && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: "10px",
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22c55e",
                animation: "recordingPulse 1s infinite",
              }} />
              <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 500 }}>
                Speaking
              </span>
              <button
                onClick={handleStopTTS}
                style={{
                  background: "rgba(239, 68, 68, 0.2)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: "6px",
                  padding: "2px 6px",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: 10,
                  marginLeft: 4,
                }}
                title="Stop speaking"
              >
                ⏹️
              </button>
            </div>
          )}

          {/* Auto-play toggle */}
          <button
            onClick={() => setAutoPlayEnabled(!autoPlayEnabled)}
            className="glass"
            style={{
              padding: "8px 12px",
              borderRadius: "10px",
              fontSize: 12,
              fontWeight: 500,
              border: `1px solid ${autoPlayEnabled ? "rgba(34, 197, 94, 0.4)" : "rgba(255,255,255,0.15)"}`,
              background: autoPlayEnabled 
                ? "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))"
                : "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
              color: autoPlayEnabled ? "#22c55e" : "rgba(255, 255, 255, 0.8)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            title={autoPlayEnabled ? "Disable auto-play" : "Enable auto-play"}
          >
            <span style={{ fontSize: 14 }}>🔊</span>
            <span>{autoPlayEnabled ? "Auto" : "Manual"}</span>
          </button>

          <div
            title={qboConnected ? "QuickBooks connected" : "Not connected"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: "12px",
              border: `1px solid ${qboConnected ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              background: `${qboConnected ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)"}`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: qboConnected ? "#22c55e" : "#ef4444",
                boxShadow: `0 0 12px ${
                  qboConnected ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)"
                }`,
                animation: "pulseSlow 2s infinite",
              }}
            />
            <span style={{ 
              fontSize: 12, 
              color: "rgba(255, 255, 255, 0.9)",
              fontWeight: 500,
            }}>
              {qboConnected ? "Connected" : "Disconnected"}
            </span>
          </div>

          {qboConnected ? (
            <button
              onClick={() => {
                localStorage.removeItem("qboConnected");
                setQboConnected(false);
              }}
              className="glass"
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                fontSize: 12,
                fontWeight: 500,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
                color: "rgba(255, 255, 255, 0.8)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              title="Dev: clear local flag"
            >
              Clear flag
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={redirecting}
              style={{
                padding: "10px 16px",
                borderRadius: "12px",
                border: "none",
                color: "white",
                fontSize: 13,
                fontWeight: 600,
                background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
                boxShadow: "0 8px 20px rgba(139, 92, 246, 0.4)",
                cursor: "pointer",
                opacity: redirecting ? 0.7 : 1,
                transition: "all 0.2s ease",
              }}
            >
              {redirecting ? "Redirecting…" : "Connect QuickBooks"}
            </button>
          )}
        </div>
      </div>

      {/* Voice features info */}
      {/* <div style={{ 
        display: "flex", 
        gap: 12, 
        flexWrap: "wrap", 
        marginBottom: 20,
        alignItems: "center",
      }}>
        <div style={{
          padding: "8px 12px",
          borderRadius: "12px",
          background: "rgba(34, 197, 94, 0.1)",
          border: "1px solid rgba(34, 197, 94, 0.2)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>🎤</span>
          <span style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.8)" }}>
            {voiceService.isSupported() ? "Voice input ready" : "Voice input not supported"}
          </span>
        </div>
        
        <div style={{
          padding: "8px 12px",
          borderRadius: "12px",
          background: ttsService.isSupported() 
            ? "rgba(34, 197, 94, 0.1)" 
            : "rgba(239, 68, 68, 0.1)",
          border: `1px solid ${ttsService.isSupported() 
            ? "rgba(34, 197, 94, 0.2)" 
            : "rgba(239, 68, 68, 0.2)"}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>🔊</span>
          <span style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.8)" }}>
            {ttsService.isSupported() ? "Voice output ready" : "Voice output not supported"}
          </span>
        </div>
      </div> */}

      {/* Enhanced chat area */}
      <div
        ref={listRef}
        className="glass"
        style={{
          height: 450,
          borderRadius: "18px",
          padding: 20,
          overflowY: "auto",
          background: "rgba(0, 0, 0, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(10px)",
        }}
      >
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const isSystem = m.role === "system";
          const isPlaying = playingMessageIndex === i;
          const canPlayTTS = !isUser && !isSystem && ttsService.isSupported();
          
          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
                margin: "16px 0",
                animation: "fadeInUp 0.3s ease-out",
              }}
            >
              <div style={{ 
                display: "flex", 
                flexDirection: isUser ? "row-reverse" : "row",
                alignItems: "flex-end",
                gap: 8,
                maxWidth: "85%",
              }}>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    padding: "14px 18px",
                    borderRadius: isUser ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
                    color: "white",
                    fontSize: 14,
                    lineHeight: 1.5,
                    background: isSystem
                      ? "rgba(255, 193, 7, 0.15)"
                      : isUser
                      ? "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)"
                      : isPlaying 
                      ? "rgba(34, 197, 94, 0.1)"
                      : "rgba(255, 255, 255, 0.08)",
                    border: isSystem 
                      ? "1px solid rgba(255, 193, 7, 0.3)" 
                      : isUser 
                      ? "none" 
                      : isPlaying
                      ? "1px solid rgba(34, 197, 94, 0.3)"
                      : "1px solid rgba(255, 255, 255, 0.1)",
                    boxShadow: isUser
                      ? "0 8px 20px rgba(139, 92, 246, 0.25)"
                      : isSystem 
                      ? "0 4px 12px rgba(255, 193, 7, 0.2)"
                      : isPlaying
                      ? "0 4px 12px rgba(34, 197, 94, 0.3)"
                      : "0 4px 12px rgba(0, 0, 0, 0.2)",
                    backdropFilter: !isUser ? "blur(10px)" : "none",
                    transition: "all 0.3s ease",
                  }}
                >
                  {!isUser && !isSystem && (
                    <div style={{ 
                      fontSize: 11, 
                      color: isPlaying ? "rgba(34, 197, 94, 0.8)" : "rgba(255, 255, 255, 0.6)", 
                      marginBottom: 6,
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}>
                      Assistant
                      {isPlaying && (
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}>
                          <div style={{
                            width: 4,
                            height: 4,
                            borderRadius: "50%",
                            background: "#22c55e",
                            animation: "recordingPulse 1s infinite",
                          }} />
                          <span style={{ fontSize: 10 }}>Speaking...</span>
                        </div>
                      )}
                    </div>
                  )}
                  {m.text}
                </div>

                {/* TTS Controls for assistant messages */}
                {canPlayTTS && (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    opacity: 0.7,
                  }}>
                    {!isPlaying ? (
                      <button
                        onClick={() => handlePlayTTS(i, m.text)}
                        style={{
                          background: "rgba(255, 255, 255, 0.1)",
                          border: "1px solid rgba(255, 255, 255, 0.2)",
                          borderRadius: "8px",
                          padding: "6px 8px",
                          color: "white",
                          cursor: "pointer",
                          fontSize: 12,
                          transition: "all 0.2s ease",
                          backdropFilter: "blur(10px)",
                        }}
                        title="Play message"
                        onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = "0.8"}
                      >
                        ▶️
                      </button>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {!isPausedTTS ? (
                          <button
                            onClick={handlePauseTTS}
                            style={{
                              background: "rgba(34, 197, 94, 0.2)",
                              border: "1px solid rgba(34, 197, 94, 0.4)",
                              borderRadius: "8px",
                              padding: "6px 8px",
                              color: "#22c55e",
                              cursor: "pointer",
                              fontSize: 12,
                              transition: "all 0.2s ease",
                              backdropFilter: "blur(10px)",
                            }}
                            title="Pause"
                          >
                            ⏸️
                          </button>
                        ) : (
                          <button
                            onClick={handleResumeTTS}
                            style={{
                              background: "rgba(34, 197, 94, 0.2)",
                              border: "1px solid rgba(34, 197, 94, 0.4)",
                              borderRadius: "8px",
                              padding: "6px 8px",
                              color: "#22c55e",
                              cursor: "pointer",
                              fontSize: 12,
                              transition: "all 0.2s ease",
                              backdropFilter: "blur(10px)",
                            }}
                            title="Resume"
                          >
                            ▶️
                          </button>
                        )}
                        <button
                          onClick={handleStopTTS}
                          style={{
                            background: "rgba(239, 68, 68, 0.2)",
                            border: "1px solid rgba(239, 68, 68, 0.4)",
                            borderRadius: "8px",
                            padding: "6px 8px",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: 12,
                            transition: "all 0.2s ease",
                            backdropFilter: "blur(10px)",
                          }}
                          title="Stop"
                        >
                          ⏹️
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Recording indicator */}
        {isRecording && (
          <div style={{ 
            display: "flex", 
            gap: 8, 
            alignItems: "center", 
            padding: "12px 20px",
            justifyContent: "flex-start",
            background: "rgba(34, 197, 94, 0.1)",
            borderRadius: "12px",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            marginBottom: 8,
          }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#22c55e",
                animation: "recordingPulse 1s infinite",
              }}
            />
            <span style={{ 
              fontSize: 13, 
              color: "#22c55e",
              fontWeight: 600,
            }}>
              🎤 Listening... {interimTranscript && `"${interimTranscript}"`}
            </span>
          </div>
        )}

        {loading && (
          <div style={{ 
            display: "flex", 
            gap: 8, 
            alignItems: "center", 
            padding: "12px 20px",
            justifyContent: "flex-start",
          }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#8b5cf6",
                animation: "bounceDots 1.4s infinite ease-in-out both",
              }}
            />
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#8b5cf6",
                animation: "bounceDots 1.4s infinite ease-in-out both",
                animationDelay: "0.16s",
              }}
            />
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#8b5cf6",
                animation: "bounceDots 1.4s infinite ease-in-out both",
                animationDelay: "0.32s",
              }}
            />
            <span style={{ 
              fontSize: 13, 
              color: "rgba(255, 255, 255, 0.7)",
              marginLeft: 8,
              fontWeight: 500,
            }}>
              Assistant is thinking...
            </span>
          </div>
        )}
      </div>

      {/* Enhanced error banner */}
      {error && (
        <div
          className="glass"
          style={{
            marginTop: 16,
            padding: "14px 18px",
            borderRadius: "16px",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(255, 255, 255, 0.05))",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div>
              <strong style={{ 
                color: "#ef4444", 
                fontSize: 13,
                fontWeight: 600,
              }}>
                Error:
              </strong>
              <span style={{ 
                color: "rgba(255, 255, 255, 0.9)", 
                marginLeft: 8,
                fontSize: 13,
              }}>
                {error}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Voice error banner */}
      {voiceError && (
        <div
          className="glass"
          style={{
            marginTop: 16,
            padding: "12px 16px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 193, 7, 0.3)",
            background: "linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(255, 255, 255, 0.05))",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>🎤</span>
            <span style={{ 
              color: "rgba(255, 255, 255, 0.9)", 
              fontSize: 12,
            }}>
              {voiceError}
            </span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ 
        display: "flex", 
        gap: 12, 
        flexWrap: "wrap", 
        marginTop: 16,
        alignItems: "center",
      }}>
        <div style={{ 
          fontSize: 12, 
          color: "rgba(255, 255, 255, 0.6)", 
          fontWeight: 500,
          marginRight: 8,
        }}>
          Quick Actions:
        </div>
        {pill("📊 Show customers", () => handleQuickInsert("Show me all customers"))}
        {pill("📱 SMS command", () => handleQuickInsert("/sms +1 Hello! This is a test message"), "💬")}
        {pill("📧 Email command", () => handleQuickInsert("/email recipient@example.com Subject: Hello | Your message here"), "✉️")}
        {pill("🔍 Search emails", () => handleQuickInsert("/search-email unread"), "🔎")}
        {pill("💰 Recent invoices", () => handleQuickInsert("Show me recent invoices"))}
        {pill("📈 Sales summary", () => handleQuickInsert("Give me a sales summary for this month"))}
      </div>

      {/* Enhanced input row */}
      <div
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "1fr auto auto auto",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div style={{ position: "relative" }}>
          <input
            value={input + (interimTranscript ? (input ? " " : "") + interimTranscript : "")}
            onChange={(e) => {
              // Only update if not recording or if the change is not from interim transcript
              if (!isRecording) {
                setInput(e.target.value);
              }
            }}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={isRecording ? "Listening..." : "Ask me anything about your business..."}
            disabled={loading}
            className="glass"
            style={{
              width: "100%",
              padding: "16px 20px",
              paddingRight: "50px", // Make room for voice button
              borderRadius: "16px",
              border: `1px solid ${isRecording ? "rgba(34, 197, 94, 0.4)" : "rgba(255, 255, 255, 0.15)"}`,
              background: isRecording 
                ? "rgba(34, 197, 94, 0.1)" 
                : "rgba(0, 0, 0, 0.3)",
              color: "white",
              fontSize: 14,
              outline: "none",
              transition: "all 0.2s ease",
              backdropFilter: "blur(10px)",
              boxShadow: isRecording 
                ? "0 0 20px rgba(34, 197, 94, 0.3)" 
                : "none",
            }}
          />
          
          {/* Interim transcript styling */}
          {interimTranscript && (
            <div style={{
              position: "absolute",
              right: "60px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: 12,
              pointerEvents: "none",
              fontStyle: "italic",
            }}>
              {interimTranscript}
            </div>
          )}
        </div>
        
        {/* Voice button */}
        <button
          onClick={handleVoiceToggle}
          disabled={loading}
          className="glass"
          style={{
            padding: "14px 16px",
            borderRadius: "14px",
            border: `1px solid ${isRecording ? "rgba(34, 197, 94, 0.4)" : "rgba(255, 255, 255, 0.15)"}`,
            background: isRecording 
              ? "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))"
              : "linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))",
            color: isRecording ? "#22c55e" : "rgba(255, 255, 255, 0.8)",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 16,
            transition: "all 0.2s ease",
            opacity: loading ? 0.5 : 1,
            animation: isRecording ? "pulseSlow 1.5s infinite" : "none",
            boxShadow: isRecording ? "0 0 20px rgba(34, 197, 94, 0.4)" : "none",
          }}
          title={isRecording ? "Stop recording" : "Start voice input"}
        >
          🎤
        </button>
        
        <button
          onClick={() => {
            setMessages([{ 
              role: "assistant", 
              text: "Chat cleared! I'm ready to help you with your business questions. What would you like to know? 🎯" 
            }]);
            setError(null);
          }}
          disabled={loading}
          className="glass"
          style={{
            padding: "14px 16px",
            borderRadius: "14px",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))",
            color: "rgba(255, 255, 255, 0.8)",
            cursor: "pointer",
            fontSize: 16,
            transition: "all 0.2s ease",
            opacity: loading ? 0.5 : 1,
          }}
          title="Clear chat"
        >
          🧹
        </button>
        
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            padding: "14px 20px",
            borderRadius: "14px",
            border: "none",
            color: "white",
            fontSize: 14,
            fontWeight: 600,
            background: loading || !input.trim() 
              ? "rgba(139, 92, 246, 0.4)" 
              : "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
            boxShadow: loading || !input.trim() 
              ? "none" 
              : "0 8px 20px rgba(139, 92, 246, 0.4)",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            opacity: loading || !input.trim() ? 0.6 : 1,
            transition: "all 0.2s ease",
            transform: loading ? "scale(0.98)" : "scale(1)",
          }}
          title="Send message"
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
