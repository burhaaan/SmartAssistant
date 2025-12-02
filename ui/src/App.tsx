import React, { useMemo, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import ChatBox from "./components/ChatBox";
import SMSInterface from "./components/SMSInterface";
import GmailInterface from "./components/GmailInterface";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import EndUserLicense from "./pages/EndUserLicense";
import "./styles/global.css";

const navLinks = [
  { to: "/", label: "Product" },
  { to: "/privacy", label: "Privacy" },
  { to: "/eula", label: "EULA" },
];

export default function App() {
  const location = useLocation();
  const activePath = useMemo(() => {
    if (location.pathname === "/") return "/";
    if (location.pathname.startsWith("/privacy")) return "/privacy";
    if (location.pathname.startsWith("/eula")) return "/eula";
    return "/";
  }, [location.pathname]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `
          radial-gradient(ellipse at top left, rgba(147, 51, 234, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at top right, rgba(236, 72, 153, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at bottom left, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
          linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 40%, #16213e 100%)
        `,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "10%",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(147, 51, 234, 0.1) 0%, transparent 70%)",
          borderRadius: "50%",
          animation: "float 6s ease-in-out infinite",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          right: "15%",
          width: "200px",
          height: "200px",
          background: "radial-gradient(circle, rgba(236, 72, 153, 0.08) 0%, transparent 70%)",
          borderRadius: "50%",
          animation: "float 8s ease-in-out infinite reverse",
          zIndex: 0,
        }}
      />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        @keyframes pulseSlow { 
          0%, 100% { transform: scale(1); opacity: 1; } 
          50% { transform: scale(1.05); opacity: 0.9; } 
        }
        @keyframes shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: 200px 0; }
        }
        .glass {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .glass:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
        }
        .gradient-text {
          background: linear-gradient(135deg, #ffffff 0%, #e879f9 50%, #8b5cf6 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          background-size: 200% 200%;
          animation: shimmer 3s ease-in-out infinite;
        }
        .card-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 
            0 20px 40px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        .top-nav-link {
          color: rgba(255, 255, 255, 0.65);
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 999px;
          transition: all 0.2s ease;
        }
        .top-nav-link.active {
          color: #0f172a;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
        }
        .top-nav-link:hover:not(.active) {
          color: rgba(255, 255, 255, 0.9);
        }
      `}</style>

      <header
        className="glass"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <Link
          to="/"
          style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "12px",
              background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: "14px",
              boxShadow: "0 8px 20px rgba(139, 92, 246, 0.3)",
            }}
            aria-hidden
          >
            BP
          </div>
          <div>
            <h1
              className="gradient-text"
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Business Partner
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "rgba(255, 255, 255, 0.6)",
                fontWeight: 400,
              }}
            >
              AI-powered business assistant
            </p>
          </div>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <nav style={{ display: "flex", gap: 8 }}>
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`top-nav-link${activePath === link.to ? " active" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              background: "rgba(34, 197, 94, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.2)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 8px rgba(34, 197, 94, 0.5)",
                animation: "pulseSlow 2s infinite",
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: "rgba(255, 255, 255, 0.9)",
                fontWeight: 500,
              }}
            >
              Online
            </span>
          </div>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          padding: "0 16px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ width: "100%", maxWidth: "1200px", padding: "32px 0 48px" }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/eula" element={<EndUserLicense />} />
          </Routes>
        </div>
      </main>

      <footer
        style={{
          padding: "16px 24px",
          textAlign: "center",
          color: "rgba(255, 255, 255, 0.5)",
          fontSize: 12,
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          background: "rgba(0, 0, 0, 0.2)",
          position: "relative",
          zIndex: 1,
        }}
      >
        Powered by AI  Built with  for your business success
      </footer>
    </div>
  );
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState<"chat" | "sms" | "gmail">("chat");

  return (
    <>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <h2
          className="gradient-text"
          style={{
            margin: 0,
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            marginBottom: 12,
          }}
        >
          Welcome to your AI Dashboard
        </h2>
        <p
          style={{
            margin: 0,
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: 18,
            fontWeight: 400,
            maxWidth: "600px",
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.6,
          }}
        >
          Your intelligent business companion with AI chat, SMS, and Gmail integration 
        </p>
      </div>

      <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
        <div
          className="glass"
          style={{
            display: "flex",
            borderRadius: "16px",
            padding: "6px",
            background: "rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            gap: 6,
          }}
        >
          {[
            { key: "chat", label: "AI Chat", emoji: "", gradient: "#8b5cf6, #ec4899" },
            { key: "sms", label: "SMS", emoji: "", gradient: "#10b981, #06b6d4" },
            { key: "gmail", label: "Gmail", emoji: "", gradient: "#ea4335, #fbbc04" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "chat" | "sms" | "gmail")}
              className="glass"
              style={{
                padding: "12px 24px",
                borderRadius: "12px",
                border: "none",
                background:
                  activeTab === tab.key
                    ? `linear-gradient(135deg, ${tab.gradient})`
                    : "transparent",
                color: activeTab === tab.key ? "white" : "rgba(255, 255, 255, 0.7)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow:
                  activeTab === tab.key ? `0 8px 20px rgba(0, 0, 0, 0.4)` : "none",
              }}
            >
              <span aria-hidden>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 24,
          maxWidth: activeTab === "sms" || activeTab === "gmail" ? "1200px" : "900px",
          margin: "0 auto",
        }}
      >
        <div className="card-hover">
          {activeTab === "chat" ? (
            <ChatBox />
          ) : activeTab === "sms" ? (
            <SMSInterface />
          ) : (
            <GmailInterface />
          )}
        </div>
      </div>
    </>
  );
}
