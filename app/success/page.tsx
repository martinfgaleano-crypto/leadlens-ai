"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { subscriptionCardFor, oneTimeCardFor } from "@/lib/commercial/plan-catalog";
import { isSubscriptionPlanCode } from "@/lib/entitlements/plan-config";
import { C, font, focusRing } from "@/lib/commercial/theme";

function track(event: string, meta: Record<string, string> = {}) {
  try { void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, ...meta }), keepalive: true }); } catch { /* never block */ }
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Phase = "confirming" | "ready" | "pending";
interface Selection { isSub: boolean; planName: string; meta: string[]; cta: string; href: string; sub: string; }

export default function SuccessPage() {
  const [phase, setPhase] = useState<Phase>("confirming");
  const [sel, setSel] = useState<Selection | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const kind = p.get("kind");
    const isSub = kind === "subscription" && isSubscriptionPlanCode(p.get("plan_code"));
    if (isSub) {
      const card = subscriptionCardFor(p.get("plan_code")!);
      const interval = p.get("billing_interval") === "year" ? "Annual" : "Monthly";
      setSel({ isSub: true, planName: `LeadLens ${card?.name ?? "Monitor"}`, meta: [interval, card?.capacity ?? ""].filter(Boolean), cta: "Set up monitored accounts", href: "/dashboard", sub: "Set up the accounts you want LeadLens to keep under observation." });
    } else {
      const card = oneTimeCardFor(p.get("product_code") ?? "");
      setSel({ isSub: false, planName: `LeadLens ${card?.name ?? "Intelligence"}`, meta: [card?.capacity ?? ""].filter(Boolean), cta: "Start your analysis", href: "/activate", sub: "Tell LeadLens what to evaluate and your intelligence run will begin." });
    }
    track("purchase_returned", kind ? { kind } : {});
  }, []);

  // Confirm real fulfillment against server-authoritative billing state (the webhook grants
  // asynchronously — never claim "ready" before the server has observed it). Bounded, no infinite loop.
  const confirm = useCallback(async (selection: Selection): Promise<boolean> => {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    try {
      const res = await fetch("/api/billing/state", { headers: { authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) return false;
      const s = await res.json();
      return selection.isSub ? s.access_source === "subscription" : ((s.credits_remaining ?? 0) > 0 || s.access_source === "one_time" || s.access_source === "internal");
    } catch { return false; }
  }, []);

  useEffect(() => {
    if (!sel) return;
    let cancelled = false;
    (async () => {
      const schedule = [0, 1500, 2500, 3500, 5000]; // ~12.5s total, bounded
      for (const wait of schedule) {
        if (cancelled) return;
        if (wait) await delay(wait);
        if (await confirm(sel)) { if (!cancelled) { setPhase("ready"); track("purchase_confirmed", { kind: sel.isSub ? "subscription" : "one_time" }); } return; }
      }
      if (!cancelled) { setPhase("pending"); track("fulfillment_pending"); }
    })();
    return () => { cancelled = true; };
  }, [sel, confirm]);

  const recheck = async () => {
    if (!sel) return;
    setPhase("confirming");
    const ok = await confirm(sel);
    setPhase(ok ? "ready" : "pending");
    if (ok) track("purchase_confirmed", { kind: sel.isSub ? "subscription" : "one_time", recheck: "1" });
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font, color: C.ink, display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "1.5rem 1.75rem", maxWidth: "40rem", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-.02em", color: C.ink, textDecoration: "none" }}>LeadLens</Link>
      </header>
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <div style={{ width: "100%", maxWidth: "30rem", textAlign: "center" }}>
          {phase === "confirming" && (
            <>
              <div style={{ width: 48, height: 48, borderRadius: "50%", border: `3px solid ${C.line}`, borderTopColor: C.sky, margin: "0 auto 1.3rem", animation: "ll-spin .8s linear infinite" }} />
              <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-.02em", margin: 0 }}>Confirming your LeadLens access…</h1>
              <p style={{ color: C.sub, fontSize: ".95rem", margin: ".7rem 0 0" }}>Your payment was received. We&apos;re verifying your access — this takes a few seconds.</p>
            </>
          )}

          {phase === "ready" && sel && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.skySoft, color: C.skyInk, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", marginBottom: "1.4rem" }} aria-hidden>✓</div>
              <h1 style={{ fontSize: "1.7rem", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.2, margin: 0 }}>{sel.isSub ? "Your monitoring workspace is ready." : "Your LeadLens analysis is ready."}</h1>
              <p style={{ color: C.sub, fontSize: "1rem", lineHeight: 1.6, margin: ".8rem 0 0" }}>{sel.sub}</p>
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "1rem", padding: "1.25rem 1.4rem", margin: "1.8rem 0", textAlign: "left" }}>
                <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>{sel.planName}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: ".6rem" }}>
                  {sel.meta.map((m, i) => <span key={i} style={{ fontSize: ".76rem", fontWeight: 600, color: C.sub, background: C.bg, border: `1px solid ${C.line}`, borderRadius: "1rem", padding: ".2rem .65rem" }}>{m}</span>)}
                </div>
              </div>
              <Link href={sel.href} className="ll-cta" style={{ display: "inline-block", textDecoration: "none", padding: ".9rem 1.8rem", fontSize: ".98rem", fontWeight: 700, color: "#fff", background: C.sky, borderRadius: ".75rem" }}>{sel.cta}</Link>
            </>
          )}

          {phase === "pending" && sel && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.skySoft, color: C.skyInk, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", marginBottom: "1.4rem" }} aria-hidden>✓</div>
              <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.2, margin: 0 }}>Payment received — finishing setup</h1>
              <p style={{ color: C.sub, fontSize: "1rem", lineHeight: 1.6, margin: ".8rem 0 1.6rem" }}>
                We&apos;ve received your payment for <strong style={{ color: C.ink }}>{sel.planName}</strong> and are finalizing your access. This usually completes within a minute.
              </p>
              <button onClick={recheck} className="ll-cta" style={{ fontFamily: font, cursor: "pointer", border: "none", padding: ".85rem 1.7rem", fontSize: ".95rem", fontWeight: 700, color: "#fff", background: C.sky, borderRadius: ".75rem" }}>Check again</button>
              <div style={{ marginTop: "1rem" }}>
                <Link href={sel.href} style={{ color: C.muted, fontSize: ".82rem", fontWeight: 600, textDecoration: "none" }}>Continue anyway →</Link>
              </div>
            </>
          )}

          {phase !== "confirming" && (
            <div style={{ marginTop: "1.1rem" }}>
              <Link href="/dashboard" style={{ color: C.muted, fontSize: ".82rem", fontWeight: 600, textDecoration: "none" }}>Go to dashboard</Link>
            </div>
          )}
        </div>
      </main>
      <style>{`@keyframes ll-spin{to{transform:rotate(360deg)}} .ll-cta:focus-visible{outline:none;box-shadow:${focusRing}}`}</style>
    </div>
  );
}
