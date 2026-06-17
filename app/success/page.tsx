"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const jobId = params.get("job_id");

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
        maxWidth: "520px",
        width: "100%",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px",
        padding: "3rem 2.5rem",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "3rem", marginBottom: "1.25rem" }}>✅</div>

        <h1 style={{
          color: "#f1f5f9",
          fontSize: "1.75rem",
          fontWeight: 700,
          margin: "0 0 0.75rem",
        }}>
          Payment confirmed
        </h1>

        <p style={{
          color: "#94a3b8",
          fontSize: "1.05rem",
          lineHeight: 1.6,
          margin: "0 0 2rem",
        }}>
          Your LeadLens batch has been created. We&rsquo;re reviewing your ICP and preparing your
          lead report. You&rsquo;ll receive it at the email you provided.
        </p>

        {jobId && (
          <div style={{
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: "8px",
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            textAlign: "left",
          }}>
            <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
              Job reference
            </div>
            <code style={{ color: "#a5b4fc", fontSize: "0.85rem", wordBreak: "break-all" }}>
              {jobId}
            </code>
          </div>
        )}

        {sessionId && (
          <div style={{
            color: "#475569",
            fontSize: "0.8rem",
            marginBottom: "2rem",
          }}>
            Checkout session:{" "}
            <code style={{ color: "#64748b" }}>
              {sessionId.slice(0, 24)}…
            </code>
          </div>
        )}

        <div style={{
          background: "rgba(34,197,94,0.06)",
          border: "1px solid rgba(34,197,94,0.15)",
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "2rem",
          fontSize: "0.875rem",
          color: "#86efac",
          lineHeight: 1.5,
        }}>
          This is a beta batch — your report is prepared manually and reviewed before delivery.
          Typical turnaround is 24–48 hours.
        </div>

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

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#94a3b8",
        fontFamily: "system-ui, sans-serif",
      }}>
        Loading…
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
