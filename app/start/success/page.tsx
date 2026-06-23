"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const PLAN_LABELS: Record<string, { label: string; leads: string; price: string }> = {
  starter:  { label: "Starter",  leads: "25 leads",  price: "$29"  },
  standard: { label: "Standard", leads: "50 leads",  price: "$97"  },
  pro:      { label: "Pro",      leads: "100 leads", price: "$197" },
};

function SuccessContent() {
  const sp    = useSearchParams();
  const id    = sp.get("id")    ?? "";
  const plan  = sp.get("plan")  ?? "standard";
  const leads = sp.get("leads") ?? "50";
  const email = sp.get("email") ?? "";

  const planInfo = PLAN_LABELS[plan] ?? { label: plan, leads: `${leads} leads`, price: "" };

  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* Brand */}
        <div style={S.brandRow}>
          <div style={S.logoMark}>L</div>
          <span style={S.brandName}>LeadLens</span>
        </div>

        {/* Icon */}
        <div style={S.iconWrap}>
          <div style={S.icon}>✓</div>
        </div>

        <h1 style={S.h1}>Your LeadLens request is confirmed.</h1>
        <p style={S.body}>
          We have everything we need to get started. Our team will prepare
          your lead list and deliver it within <strong>48 hours</strong>.
        </p>

        {/* Order summary */}
        <div style={S.summaryBox}>
          <div style={S.summaryTitle}>Order Summary</div>
          <div style={S.summaryRow}>
            <span style={S.summaryKey}>Plan</span>
            <span style={S.summaryVal}>{planInfo.label} — {planInfo.leads}</span>
          </div>
          {planInfo.price && (
            <div style={S.summaryRow}>
              <span style={S.summaryKey}>Price</span>
              <span style={S.summaryVal}>{planInfo.price} · collected at delivery</span>
            </div>
          )}
          {email && (
            <div style={S.summaryRow}>
              <span style={S.summaryKey}>Delivery email</span>
              <span style={{ ...S.summaryVal, wordBreak: "break-all" as const }}>{email}</span>
            </div>
          )}
          <div style={S.summaryRow}>
            <span style={S.summaryKey}>Expected delivery</span>
            <span style={{ ...S.summaryVal, color: "#10b981", fontWeight: 700 }}>Within 48 hours</span>
          </div>
          {id && (
            <div style={{ ...S.summaryRow, borderBottom: "none", paddingBottom: 0 }}>
              <span style={S.summaryKey}>Reference ID</span>
              <span style={{ ...S.summaryVal, fontFamily: "monospace", fontSize: "0.72rem" }}>{id}</span>
            </div>
          )}
        </div>

        {/* What happens next */}
        <div style={S.steps}>
          <div style={S.stepsTitle}>What happens next</div>
          <div style={S.step}>
            <div style={S.stepNum}>1</div>
            <div style={S.stepText}>
              <strong>Our team reviews your targeting</strong>
              <br />We check your buyer profile and targeting criteria to make sure the list will hit the mark.
            </div>
          </div>
          <div style={S.step}>
            <div style={S.stepNum}>2</div>
            <div style={S.stepText}>
              <strong>We build and verify your lead list</strong>
              <br />Every lead is sourced and validated — name, title, company, email, and buyer signals included.
            </div>
          </div>
          <div style={S.step}>
            <div style={S.stepNum}>3</div>
            <div style={S.stepText}>
              <strong>Your list is delivered</strong>
              <br />
              {email
                ? <>Sent to <strong>{email}</strong>. Payment is confirmed at the time of delivery.</>
                : <>Sent to the email you provided. Payment is confirmed at the time of delivery.</>
              }
            </div>
          </div>
        </div>

        {/* Support note */}
        <div style={S.supportNote}>
          Need to make changes or have a question?{" "}
          <strong>Reply to your confirmation email</strong> or contact us directly at{" "}
          <a href="mailto:support@leadlensai.com" style={{ color: "#0ea5e9", textDecoration: "none" }}>
            support@leadlensai.com
          </a>
        </div>

        {/* Action */}
        <a href="/start" style={S.anotherBtn}>Submit another request</a>

      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        color: "#64748b", fontFamily: "-apple-system,sans-serif", fontSize: "0.9rem" }}>
        Loading…
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    background: "#f8fafc",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    padding: "1.5rem 1rem 4rem",
  } as React.CSSProperties,
  card: {
    width: "100%",
    maxWidth: 520,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "1.25rem",
    padding: "2rem 1.75rem",
    boxShadow: "0 4px 32px rgba(0,0,0,0.06)",
    marginTop: "1rem",
  } as React.CSSProperties,
  brandRow: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" } as React.CSSProperties,
  logoMark: {
    width: 32, height: 32,
    background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
    borderRadius: 8, color: "#fff", fontWeight: 800, fontSize: "1rem",
    display: "flex", alignItems: "center", justifyContent: "center",
  } as React.CSSProperties,
  brandName: { fontWeight: 800, fontSize: "1rem", color: "#0f172a", letterSpacing: "-0.02em" } as React.CSSProperties,
  iconWrap: { display: "flex", justifyContent: "center", marginBottom: "1.25rem" } as React.CSSProperties,
  icon: {
    width: 64, height: 64, borderRadius: "50%",
    background: "linear-gradient(135deg,#10b981,#059669)",
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "1.75rem", fontWeight: 800,
  } as React.CSSProperties,
  h1: {
    color: "#0f172a", fontSize: "1.4rem", fontWeight: 800,
    margin: "0 0 0.625rem", letterSpacing: "-0.025em", textAlign: "center" as const,
  } as React.CSSProperties,
  body: {
    color: "#475569", fontSize: "0.875rem", lineHeight: 1.6,
    margin: "0 0 1.5rem", textAlign: "center" as const,
  } as React.CSSProperties,
  summaryBox: {
    background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.875rem",
    padding: "1rem 1.125rem", marginBottom: "1.5rem",
  } as React.CSSProperties,
  summaryTitle: {
    fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8",
    textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: "0.625rem",
  } as React.CSSProperties,
  summaryRow: {
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
    gap: "0.75rem", paddingBottom: "0.5rem", marginBottom: "0.5rem",
    borderBottom: "1px solid #f1f5f9",
  } as React.CSSProperties,
  summaryKey: { fontSize: "0.78rem", color: "#64748b", flexShrink: 0 } as React.CSSProperties,
  summaryVal: { fontSize: "0.82rem", color: "#0f172a", fontWeight: 600, textAlign: "right" as const } as React.CSSProperties,
  steps: {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.875rem",
    padding: "1.125rem", marginBottom: "1.25rem",
  } as React.CSSProperties,
  stepsTitle: {
    fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8",
    textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: "0.875rem",
  } as React.CSSProperties,
  step: { display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.875rem" } as React.CSSProperties,
  stepNum: {
    width: 24, height: 24, borderRadius: "50%", background: "#0ea5e9",
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "0.72rem", fontWeight: 800, flexShrink: 0, marginTop: 1,
  } as React.CSSProperties,
  stepText: { fontSize: "0.82rem", color: "#374151", lineHeight: 1.55 } as React.CSSProperties,
  supportNote: {
    background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "0.625rem",
    padding: "0.875rem 1rem", fontSize: "0.8rem", color: "#0369a1",
    lineHeight: 1.55, marginBottom: "1.25rem",
  } as React.CSSProperties,
  anotherBtn: {
    display: "block", padding: "0.8rem 1rem",
    background: "transparent", color: "#64748b", border: "1px solid #e2e8f0",
    borderRadius: "0.625rem", fontWeight: 600, fontSize: "0.875rem",
    textDecoration: "none", textAlign: "center" as const, fontFamily: "inherit",
  } as React.CSSProperties,
};
