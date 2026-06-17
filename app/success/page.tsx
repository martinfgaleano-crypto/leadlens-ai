"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SuccessContent() {
  const params = useSearchParams();
  const jobId    = params.get("job_id");
  const orderId  = params.get("order_id");    // Lemon Squeezy
  const checkoutId = params.get("checkout_id"); // Lemon Squeezy alternate

  const refCode = jobId ?? orderId ?? checkoutId;

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
        maxWidth: "520px",
        width: "100%",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "1.25rem",
        padding: "3rem 2.5rem",
        textAlign: "center",
        boxShadow: "0 4px 24px rgba(0,0,0,.06)",
      }}>
        <div style={{ fontSize: "2.75rem", marginBottom: "1.25rem" }}>✅</div>

        <h1 style={{
          color: "#0f172a",
          fontSize: "1.75rem",
          fontWeight: 800,
          letterSpacing: "-.02em",
          margin: "0 0 .75rem",
        }}>
          Payment received
        </h1>

        <p style={{
          color: "#64748b",
          fontSize: "1rem",
          lineHeight: 1.65,
          margin: "0 0 1.75rem",
        }}>
          Your LeadLens beta batch has been created. We will review your order
          and prepare your lead report within 24–48 hours.
        </p>

        {refCode && (
          <div style={{
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: ".75rem",
            padding: ".875rem 1rem",
            marginBottom: "1.5rem",
            textAlign: "left",
          }}>
            <div style={{ color: "#64748b", fontSize: ".75rem", fontWeight: 600, marginBottom: ".25rem", textTransform: "uppercase", letterSpacing: ".05em" }}>
              Order reference
            </div>
            <code style={{ color: "#0284c7", fontSize: ".85rem", wordBreak: "break-all" }}>
              {refCode}
            </code>
          </div>
        )}

        <div style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: ".75rem",
          padding: "1rem 1.125rem",
          marginBottom: "2rem",
          fontSize: ".875rem",
          color: "#15803d",
          lineHeight: 1.55,
          textAlign: "left",
        }}>
          <strong>What happens next:</strong> your report is prepared manually
          and reviewed before delivery. You will receive it at the email you
          provided. Nothing is sent automatically on your behalf.
        </div>

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

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh",
        background: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#64748b",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        fontSize: "1rem",
      }}>
        Loading…
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
