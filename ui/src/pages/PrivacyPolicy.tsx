import React from "react";

const dataUses = [
  "Run the QuickBooks workflows you trigger.",
  "Maintain a stable connection to your QuickBooks company.",
  "Diagnose technical issues using anonymised logs.",
];

const dataAccess = [
  "Customer profiles",
  "Financial accounts",
  "Basic company metadata",
  "Any fields required to fulfil a specific user-initiated request",
];

const rights = [
  "Disconnect the QuickBooks integration at any time.",
  "Request deletion of stored QuickBooks-related data.",
  "Ask for a copy of any data we hold related to your QuickBooks connection.",
];

export default function PrivacyPolicy() {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <header
        className="glass"
        style={{
          padding: "32px",
          borderRadius: "24px",
          textAlign: "center",
          border: "1px solid rgba(255, 255, 255, 0.1)",
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
          Privacy Policy
        </p>
        <h2
          style={{
            margin: "12px 0 16px",
            fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 800,
            color: "white",
          }}
        >
          QuickBooks integration privacy notice
        </h2>
        <p
          style={{
            margin: 0,
            color: "rgba(255, 255, 255, 0.75)",
            fontSize: 18,
            lineHeight: 1.6,
          }}
        >
          This policy applies only to the QuickBooks integration used within our application. We
          access QuickBooks information only after you grant permission through Intuit’s OAuth flow,
          and we limit usage to the actions you explicitly request.
        </p>
      </header>

      <article
        className="glass"
        style={{
          padding: "28px",
          borderRadius: "24px",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          background:
            "linear-gradient(145deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.03) 60%)",
        }}
      >
        <h3 style={{ margin: "0 0 12px", color: "white", fontSize: 22 }}>How we use QuickBooks data</h3>
        <p style={{ margin: "0 0 12px", color: "rgba(255, 255, 255, 0.75)", lineHeight: 1.6 }}>
          Once connected, the app uses your QuickBooks data solely to perform the actions you request,
          such as retrieving customers, accounts, or related financial records.
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            color: "rgba(255, 255, 255, 0.75)",
            lineHeight: 1.6,
          }}
        >
          {dataUses.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

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
          <h3 style={{ margin: "0 0 12px", color: "white", fontSize: 20 }}>Data we access</h3>
          <p style={{ margin: "0 0 12px", color: "rgba(255, 255, 255, 0.75)", lineHeight: 1.6 }}>
            Depending on the workflows you choose to run, the integration may read or update:
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
            {dataAccess.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p style={{ marginTop: 12, color: "rgba(255,255,255,0.7)" }}>
            No other QuickBooks modules are accessed outside the scopes you explicitly approve.
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
          <h3 style={{ margin: "0 0 12px", color: "white", fontSize: 20 }}>OAuth tokens</h3>
          <p style={{ margin: 0, color: "rgba(255, 255, 255, 0.75)", lineHeight: 1.6 }}>
            We store Intuit-issued access and refresh tokens to maintain your authorised connection.
            These tokens stay in encrypted storage and are refreshed automatically only to keep your
            approved sessions active.
          </p>
        </article>
      </div>

      <article
        className="glass"
        style={{
          padding: "28px",
          borderRadius: "24px",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          background:
            "linear-gradient(145deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.03) 60%)",
        }}
      >
        <h3 style={{ margin: "0 0 12px", color: "white", fontSize: 22 }}>How we handle your information</h3>
        <p style={{ margin: "0 0 12px", color: "rgba(255, 255, 255, 0.75)", lineHeight: 1.6 }}>
          Your QuickBooks data is used only for the integration to function:
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.6,
          }}
        >
          {dataUses.map((item) => (
            <li key={`handle-${item}`}>{item}</li>
          ))}
        </ul>
        <p style={{ marginTop: 12, color: "rgba(255,255,255,0.75)" }}>
          We do not sell, share, or use QuickBooks data for advertising or unrelated analytics.
        </p>
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
          <h4 style={{ margin: "0 0 10px", color: "white", fontSize: 18 }}>Retention & deletion</h4>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
            We retain tokens and synced records only as long as needed to operate the integration or
            meet legal requirements. You can disconnect the QuickBooks app at any time through Intuit,
            and you can request deletion of stored data by emailing privacy@businesspartner.ai.
          </p>
        </article>
        <article
          className="glass"
          style={{ padding: "24px", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <h4 style={{ margin: "0 0 10px", color: "white", fontSize: 18 }}>Your rights</h4>
          <ul style={{ margin: 0, paddingLeft: 20, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
            {rights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>

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
          For any privacy questions, contact <a href="mailto:privacy@businesspartner.ai" style={{ color: "#93c5fd" }}>privacy@businesspartner.ai</a>.
        </p>
      </article>

      <footer style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
        Updated 2025.
      </footer>
    </section>
  );
}

