import React from "react";

const acceptableUse = [
  "Misuse the QuickBooks API.",
  "Submit harmful or illegal data.",
  "Attempt to access QuickBooks modules outside the approved scopes.",
];

const responsibilities = [
  "Maintain control of your Intuit account credentials.",
  "Review any automated or AI-generated actions before execution.",
  "Notify us immediately of any suspected unauthorised access.",
];

export default function EndUserLicense() {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <header
        className="glass"
        style={{
          padding: "32px",
          borderRadius: "24px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.6)",
            fontSize: 12,
          }}
        >
          End User License Agreement
        </p>
        <h2
          style={{
            margin: "12px 0 16px",
            fontSize: "clamp(30px, 5vw, 44px)",
            fontWeight: 800,
            color: "white",
          }}
        >
          QuickBooks integration terms
        </h2>
        <p
          style={{
            margin: 0,
            color: "rgba(255, 255, 255, 0.75)",
            fontSize: 18,
            lineHeight: 1.6,
          }}
        >
          This agreement applies only to your use of the QuickBooks integration within our
          application. By authorising the connection, you agree to the terms below on behalf of your
          organisation.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 24,
        }}
      >
        <article
          className="glass"
          style={{
            padding: "24px",
            borderRadius: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <h3 style={{ margin: "0 0 10px", color: "white", fontSize: 20 }}>License</h3>
          <p style={{ margin: 0, color: "rgba(255, 255, 255, 0.75)", lineHeight: 1.6 }}>
            We grant you a non-exclusive, revocable license to use the QuickBooks integration for
            your organisation’s internal business tasks. You may not resell or redistribute the
            integration.
          </p>
        </article>

        <article
          className="glass"
          style={{
            padding: "24px",
            borderRadius: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <h3 style={{ margin: "0 0 10px", color: "white", fontSize: 20 }}>Use of QuickBooks data</h3>
          <p style={{ margin: 0, color: "rgba(255, 255, 255, 0.75)", lineHeight: 1.6 }}>
            You control when the QuickBooks connection is authorised or revoked. The integration uses
            your QuickBooks data only to perform the actions you initiate, such as retrieving or
            updating customers and accounts.
          </p>
        </article>
      </div>

      <article
        className="glass"
        style={{
          padding: "28px",
          borderRadius: "24px",
          border: "1px solid rgba(248, 113, 113, 0.35)",
          background:
            "linear-gradient(140deg, rgba(248, 113, 113, 0.2) 0%, rgba(248, 113, 113, 0.05) 70%)",
        }}
      >
        <h3 style={{ margin: "0 0 12px", color: "white", fontSize: 22 }}>Acceptable use</h3>
        <p style={{ margin: "0 0 12px", color: "rgba(255, 255, 255, 0.78)", lineHeight: 1.6 }}>
          You agree not to:
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            color: "rgba(255, 255, 255, 0.78)",
            lineHeight: 1.6,
          }}
        >
          {acceptableUse.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p style={{ marginTop: 12, color: "rgba(255, 255, 255, 0.78)" }}>
          We may suspend access if we detect abuse or a legal requirement to restrict usage.
        </p>
      </article>

      <article
        className="glass"
        style={{
          padding: "28px",
          borderRadius: "24px",
          border: "1px solid rgba(59, 130, 246, 0.35)",
          background:
            "linear-gradient(140deg, rgba(59, 130, 246, 0.2) 0%, rgba(14, 165, 233, 0.05) 70%)",
        }}
      >
        <h3 style={{ margin: "0 0 12px", color: "white", fontSize: 22 }}>Your responsibilities</h3>
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            color: "rgba(255, 255, 255, 0.78)",
            lineHeight: 1.7,
          }}
        >
          {responsibilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
        }}
      >
        <article
          className="glass"
          style={{ padding: "24px", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <h4 style={{ margin: "0 0 10px", color: "white", fontSize: 18 }}>Service availability</h4>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
            Some features depend on Intuit’s system availability. Temporary outages or delays from
            QuickBooks Online do not constitute a service failure.
          </p>
        </article>
        <article
          className="glass"
          style={{ padding: "24px", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <h4 style={{ margin: "0 0 10px", color: "white", fontSize: 18 }}>Ownership</h4>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
            You retain ownership of all your QuickBooks records. All application code, UI, and backend
            logic remain our property.
          </p>
        </article>
      </div>

      <article
        className="glass"
        style={{
          padding: "28px",
          borderRadius: "24px",
          border: "1px solid rgba(248, 113, 113, 0.35)",
          background:
            "linear-gradient(140deg, rgba(248, 113, 113, 0.2) 0%, rgba(248, 113, 113, 0.05) 70%)",
        }}
      >
        <h3 style={{ margin: "0 0 12px", color: "white", fontSize: 22 }}>Termination</h3>
        <p style={{ margin: 0, color: "rgba(255,255,255,0.78)", lineHeight: 1.6 }}>
          You may terminate use of the integration at any time by disconnecting via Intuit. We may
          terminate this agreement if you breach these terms. Upon termination, QuickBooks-related
          data will be deleted or anonymised except where legal retention is required.
        </p>
      </article>

      <article
        className="glass"
        style={{
          padding: "24px",
          borderRadius: "20px",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(15, 23, 42, 0.45)",
        }}
      >
        <h4 style={{ margin: "0 0 10px", color: "white", fontSize: 18 }}>Contact</h4>
        <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
          For questions about this agreement, email{" "}
          <a href="mailto:legal@businesspartner.ai" style={{ color: "#fda4af" }}>
            legal@businesspartner.ai
          </a>
          .
        </p>
      </article>

      <footer style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
        Effective 2025.
      </footer>
    </section>
  );
}

