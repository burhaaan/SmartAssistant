import React, { useMemo } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import ChatBox from "./components/ChatBox";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import EndUserLicense from "./pages/EndUserLicense";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./components/AuthPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import "./styles/global.css";

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#212121",
          color: "white",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid rgba(255, 255, 255, 0.1)",
              borderTop: "3px solid #10a37f",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: "rgba(255, 255, 255, 0.6)" }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Link
        to="/login"
        style={{
          padding: "8px 16px",
          borderRadius: "8px",
          background: "#10a37f",
          color: "white",
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 500,
          transition: "all 0.2s ease",
        }}
      >
        Sign In
      </Link>
    );
  }

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span
        style={{
          fontSize: 13,
          color: "rgba(255, 255, 255, 0.6)",
          maxWidth: 140,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {user.email}
      </span>
      <button
        onClick={handleLogout}
        style={{
          padding: "8px 14px",
          borderRadius: "8px",
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "rgba(255, 255, 255, 0.7)",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        Sign Out
      </button>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const { user } = useAuth();

  // If on login page and already authenticated, redirect to home
  if (location.pathname === "/login" && user) {
    return <Navigate to="/" replace />;
  }

  // For chat page, use full-screen layout without header/footer
  const isChatPage = location.pathname === "/" && user;

  if (isChatPage) {
    return (
      <ProtectedRoute>
        <ChatBox />
      </ProtectedRoute>
    );
  }

  // For other pages (login, privacy, eula), use standard layout
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#212121",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @keyframes pulseSlow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
      `}</style>

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "#212121",
        }}
      >
        <Link
          to="/"
          style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "8px",
              background: "#10a37f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: "12px",
            }}
          >
            BP
          </div>
          <span
            style={{
              color: "white",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Business Partner
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <nav style={{ display: "flex", gap: 8 }}>
            {[
              { to: "/privacy", label: "Privacy" },
              { to: "/eula", label: "EULA" },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  color: location.pathname === link.to ? "white" : "rgba(255, 255, 255, 0.6)",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  transition: "all 0.2s ease",
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <UserMenu />
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/eula" element={<EndUserLicense />} />
        </Routes>
      </main>
    </div>
  );
}
