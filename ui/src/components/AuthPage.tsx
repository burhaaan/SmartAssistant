import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else {
        navigate("/");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `
          radial-gradient(ellipse at top left, rgba(147, 51, 234, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at top right, rgba(236, 72, 153, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at bottom left, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
          linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 40%, #16213e 100%)
        `,
        padding: 16,
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: 200px 0; }
        }
        .gradient-text {
          background: linear-gradient(135deg, #ffffff 0%, #e879f9 50%, #8b5cf6 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          background-size: 200% 200%;
          animation: shimmer 3s ease-in-out infinite;
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .auth-input {
          width: 100%;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(0, 0, 0, 0.3);
          color: white;
          font-size: 15px;
          outline: none;
          transition: all 0.2s ease;
        }
        .auth-input:focus {
          border-color: rgba(139, 92, 246, 0.6);
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }
        .auth-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        .auth-btn {
          width: 100%;
          padding: 14px 24px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .auth-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(139, 92, 246, 0.3);
        }
        .auth-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>

      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 24,
          padding: 40,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 20,
              fontWeight: 700,
              color: "white",
              boxShadow: "0 8px 24px rgba(139, 92, 246, 0.3)",
            }}
          >
            BP
          </div>
          <h1
            className="gradient-text"
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            Welcome Back
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: 15,
            }}
          >
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  color: "rgba(255, 255, 255, 0.8)",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Email
              </label>
              <input
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  color: "rgba(255, 255, 255, 0.8)",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Password
              </label>
              <input
                type="password"
                className="auth-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#fca5a5",
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? "Please wait..." : "Sign In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
