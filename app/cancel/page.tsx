import { Suspense } from "react";

export default function CancelPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0f1e",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        maxWidth: "480px",
        width: "100%",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px",
        padding: "3rem 2.5rem",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "3rem", marginBottom: "1.25rem" }}>↩</div>

        <h1 style={{
          color: "#f1f5f9",
          fontSize: "1.75rem",
          fontWeight: 700,
          margin: "0 0 0.75rem",
        }}>
          Checkout canceled
        </h1>

        <p style={{
          color: "#94a3b8",
          fontSize: "1.05rem",
          lineHeight: 1.6,
          margin: "0 0 2.5rem",
        }}>
          No payment was processed. You can return to LeadLens and start again whenever you&rsquo;re ready.
        </p>

        <a
          href="/demo-pipeline"
          style={{
            display: "inline-block",
            padding: "0.75rem 1.75rem",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.95rem",
          }}
        >
          ← Return to LeadLens
        </a>
      </div>
    </div>
  );
}
