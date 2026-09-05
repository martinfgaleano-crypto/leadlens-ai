"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { subscriptionCardFor, oneTimeCardFor } from "@/lib/commercial/plan-catalog";
import { isSubscriptionPlanCode } from "@/lib/entitlements/plan-config";
import { C, font, focusRing } from "@/lib/commercial/theme";

function track(event: string, meta: Record<string, string> = {}) {
  try { void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, ...meta }), keepalive: true }); } catch { /* never block */ }
}

interface View { title: string; sub: string; planName: string; meta: string[]; cta: string; href: string; }

export default function SuccessPage() {
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const kind = p.get("kind");
    if (kind === "subscription" && isSubscriptionPlanCode(p.get("plan_code"))) {
      const card = subscriptionCardFor(p.get("plan_code")!);
      const interval = p.get("billing_interval") === "year" ? "Annual" : "Monthly";
      track("purchase_confirmed", { kind: "subscription", plan_code: p.get("plan_code")! });
      setView({
        title: "Your monitoring workspace is ready.",
        sub: "Payment confirmed. Set up the accounts you want LeadLens to keep under observation.",
        planName: `LeadLens ${card?.name ?? "Monitor"}`,
        meta: [interval, "Workspace active", card?.capacity ?? ""].filter(Boolean),
        cta: "Set up monitored accounts", href: "/dashboard",
      });
    } else {
      const card = oneTimeCardFor(p.get("product_code") ?? "");
      track("purchase_confirmed", { kind: "one_time", product_code: p.get("product_code") ?? "" });
      setView({
        title: "Your LeadLens analysis is ready.",
        sub: "Payment confirmed. Tell LeadLens what to evaluate and your intelligence run will begin.",
        planName: `LeadLens ${card?.name ?? "Intelligence"}`,
        meta: ["Purchase confirmed", card?.capacity ?? ""].filter(Boolean),
        cta: "Start your analysis", href: "/activate",
      });
    }
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font, color: C.ink, display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "1.5rem 1.75rem", maxWidth: "40rem", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-.02em", color: C.ink, textDecoration: "none" }}>LeadLens</Link>
      </header>
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <div style={{ width: "100%", maxWidth: "30rem", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.skySoft, color: C.skyInk, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", marginBottom: "1.4rem" }} aria-hidden>✓</div>
          <h1 style={{ fontSize: "1.7rem", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.2, margin: 0 }}>{view?.title ?? "Payment confirmed."}</h1>
          <p style={{ color: C.sub, fontSize: "1rem", lineHeight: 1.6, margin: ".8rem 0 0" }}>{view?.sub ?? ""}</p>

          {view && (
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "1rem", padding: "1.25rem 1.4rem", margin: "1.8rem 0", textAlign: "left" }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>{view.planName}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: ".6rem" }}>
                {view.meta.map((m, i) => (
                  <span key={i} style={{ fontSize: ".76rem", fontWeight: 600, color: C.sub, background: C.bg, border: `1px solid ${C.line}`, borderRadius: "1rem", padding: ".2rem .65rem" }}>{m}</span>
                ))}
              </div>
            </div>
          )}

          <Link href={view?.href ?? "/dashboard"} className="ll-success-cta" style={{ display: "inline-block", textDecoration: "none", padding: ".9rem 1.8rem", fontSize: ".98rem", fontWeight: 700, color: "#fff", background: C.sky, borderRadius: ".75rem" }}>
            {view?.cta ?? "Continue"}
          </Link>
          <div style={{ marginTop: "1.1rem" }}>
            <Link href="/dashboard" style={{ color: C.muted, fontSize: ".82rem", fontWeight: 600, textDecoration: "none" }}>Go to dashboard</Link>
          </div>
        </div>
      </main>
      <style>{`.ll-success-cta:focus-visible{outline:none;box-shadow:${focusRing}}`}</style>
    </div>
  );
}
