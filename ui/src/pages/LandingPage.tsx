import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: "calc(100vh - 60px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "60px 24px",
        background: "linear-gradient(180deg, #212121 0%, #1a1a2e 100%)",
      }}
    >
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .feature-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 28px;
          transition: all 0.3s ease;
        }
        .feature-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-4px);
        }
        .cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          background: linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%);
          color: white;
          text-decoration: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(16, 163, 127, 0.3);
        }
        .cta-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(16, 163, 127, 0.4);
        }
        .integration-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 100px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
        }
      `}</style>

      {/* Hero Section */}
      <div
        style={{
          textAlign: "center",
          maxWidth: 800,
          marginBottom: 80,
          animation: "slideUp 0.6s ease-out",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
            padding: "10px 20px",
            background: "rgba(16, 163, 127, 0.1)",
            border: "1px solid rgba(16, 163, 127, 0.2)",
            borderRadius: 100,
          }}
        >
          <span style={{ fontSize: 14, color: "#10a37f", fontWeight: 500 }}>
            AI-Powered Business Assistant
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(36px, 6vw, 56px)",
            fontWeight: 800,
            color: "white",
            margin: "0 0 20px",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          Your Business Tools,{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #10a37f 0%, #34d399 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            All in One Place
          </span>
        </h1>

        <p
          style={{
            fontSize: 18,
            color: "rgba(255, 255, 255, 0.6)",
            margin: "0 0 36px",
            lineHeight: 1.6,
            maxWidth: 600,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Connect QuickBooks, Housecall Pro, Gmail, and SMS in one intelligent
          assistant. Ask questions in plain English and get instant insights.
        </p>

        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/login" className="cta-btn">
            Get Started
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Integration Badges */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 40,
          }}
        >
          <span className="integration-badge">
            <span style={{ fontSize: 16 }}>📊</span> QuickBooks
          </span>
          <span className="integration-badge">
            <span style={{ fontSize: 16 }}>🏠</span> Housecall Pro
          </span>
          <span className="integration-badge">
            <span style={{ fontSize: 16 }}>📧</span> Gmail
          </span>
          <span className="integration-badge">
            <span style={{ fontSize: 16 }}>📱</span> SMS
          </span>
        </div>
      </div>

      {/* Features Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
          maxWidth: 1000,
          width: "100%",
          marginBottom: 80,
        }}
      >
        {/* QuickBooks */}
        <div className="feature-card">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "rgba(16, 163, 127, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
              fontSize: 24,
            }}
          >
            📊
          </div>
          <h3
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "white",
              margin: "0 0 12px",
            }}
          >
            QuickBooks Integration
          </h3>
          <p
            style={{
              fontSize: 14,
              color: "rgba(255, 255, 255, 0.6)",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Invoices, Payments, Customers, Vendors, Bills, Profit & Loss Reports,
            Balance Sheets, and Items/Products — all accessible via natural language.
          </p>
        </div>

        {/* Housecall Pro */}
        <div className="feature-card">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "rgba(245, 158, 11, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
              fontSize: 24,
            }}
          >
            🏠
          </div>
          <h3
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "white",
              margin: "0 0 12px",
            }}
          >
            Housecall Pro Integration
          </h3>
          <p
            style={{
              fontSize: 14,
              color: "rgba(255, 255, 255, 0.6)",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Jobs, Appointments, Estimates, Customers, Employees, Invoices, and
            Scheduling — manage your field service business effortlessly.
          </p>
        </div>

        {/* Communication */}
        <div className="feature-card">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "rgba(234, 67, 53, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
              fontSize: 24,
            }}
          >
            💬
          </div>
          <h3
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "white",
              margin: "0 0 12px",
            }}
          >
            Email & SMS
          </h3>
          <p
            style={{
              fontSize: 14,
              color: "rgba(255, 255, 255, 0.6)",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Send and receive emails, search your inbox, send SMS messages to
            customers — all from one unified interface.
          </p>
        </div>
      </div>

      {/* How It Works */}
      <div
        style={{
          textAlign: "center",
          maxWidth: 800,
          marginBottom: 60,
        }}
      >
        <h2
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "white",
            margin: "0 0 16px",
          }}
        >
          How It Works
        </h2>
        <p
          style={{
            fontSize: 16,
            color: "rgba(255, 255, 255, 0.6)",
            margin: "0 0 40px",
          }}
        >
          Just ask in plain English — no complex menus or dashboards to navigate.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            textAlign: "left",
          }}
        >
          {[
            {
              query: '"Show me all unpaid invoices from this month"',
              source: "QuickBooks",
            },
            {
              query: '"What jobs are scheduled for tomorrow?"',
              source: "Housecall Pro",
            },
            {
              query: '"Send a reminder email to John about his appointment"',
              source: "Gmail",
            },
            {
              query: '"Text the customer that we\'re on our way"',
              source: "SMS",
            },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 20px",
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: 12,
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(16, 163, 127, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10a37f",
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    color: "white",
                    fontSize: 15,
                    fontStyle: "italic",
                  }}
                >
                  {item.query}
                </p>
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: "rgba(255, 255, 255, 0.4)",
                  background: "rgba(255, 255, 255, 0.05)",
                  padding: "4px 10px",
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              >
                {item.source}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div
        style={{
          textAlign: "center",
          padding: "48px",
          background: "rgba(16, 163, 127, 0.08)",
          borderRadius: 24,
          border: "1px solid rgba(16, 163, 127, 0.15)",
          maxWidth: 600,
          width: "100%",
        }}
      >
        <h2
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "white",
            margin: "0 0 12px",
          }}
        >
          Ready to Get Started?
        </h2>
        <p
          style={{
            fontSize: 16,
            color: "rgba(255, 255, 255, 0.6)",
            margin: "0 0 24px",
          }}
        >
          Sign in to connect your accounts and start asking questions.
        </p>
        <Link to="/login" className="cta-btn">
          Sign In Now
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
