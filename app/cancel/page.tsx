export default function CancelPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>
      <div style={{
        maxWidth: "480px",
        width: "100%",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "1.25rem",
        padding: "3rem 2.5rem",
        textAlign: "center",
        boxShadow: "0 4px 24px rgba(0,0,0,.06)",
      }}>
        <div style={{ fontSize: "2.75rem", marginBottom: "1.25rem" }}>↩</div>

        <h1 style={{
          color: "#0f172a",
          fontSize: "1.75rem",
          fontWeight: 800,
          letterSpacing: "-.02em",
          margin: "0 0 .75rem",
        }}>
          Checkout canceled
        </h1>

        <p style={{
          color: "#64748b",
          fontSize: "1rem",
          lineHeight: 1.65,
          margin: "0 0 2rem",
        }}>
          No payment was processed. You can return to LeadLens and start again
          whenever you&rsquo;re ready.
        </p>

        <a
          href="/demo-pipeline"
          style={{
            display: "inline-block",
            padding: ".875rem 2rem",
            background: "#0ea5e9",
            color: "#fff",
            borderRadius: ".75rem",
            textDecoration: "none",
            fontWeight: 700,
            fontSize: ".95rem",
            boxShadow: "0 4px 14px rgba(14,165,233,.3)",
            marginBottom: "1.5rem",
          }}
        >
          ← Return to LeadLens AI
        </a>

        <p style={{ color: "#94a3b8", fontSize: ".8rem", margin: 0 }}>
          Questions?{" "}
          <a href="mailto:martinfgaleano@gmail.com" style={{ color: "#0ea5e9" }}>
            martinfgaleano@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
