"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { commercialFlowQuery, parseCommercialFlowState, type CommercialFlowState } from "@/lib/commercial/customer-flow";
import { subscriptionCardFor, oneTimeCardFor } from "@/lib/commercial/plan-catalog";
import { C, font, focusRing } from "@/lib/commercial/theme";

function track(event: string, meta: Record<string, string> = {}) {
  try { void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, ...meta }), keepalive: true }); } catch { /* never block */ }
}
const priceStr = (n: number) => `$${n.toLocaleString("en-US")}`;

export default function CheckoutContinuePage() {
  const router = useRouter();
  const [flow, setFlow] = useState<CommercialFlowState | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [ctx, setCtx] = useState({ website: "", objective: "", market: "" });

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const f = parseCommercialFlowState(params);
      setFlow(f);
      const supabase = getSupabaseClient();
      if (!supabase) { setReady(true); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace(`/signup${commercialFlowQuery(f)}`); return; }
      if (!f) { router.replace("/pricing"); return; }
      track("checkout_continue_viewed", { kind: f.selection.kind });
      setReady(true);
    })();
  }, [router]);

  async function startCheckout() {
    if (!flow) return;
    setBusy(true); setError("");
    const supabase = getSupabaseClient();
    if (!supabase) { setError("Checkout is temporarily unavailable."); setBusy(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace(`/signup${commercialFlowQuery(flow)}`); return; }

    if (showContext && (ctx.website || ctx.objective || ctx.market)) track("company_context_provided");

    const auth = { authorization: `Bearer ${session.access_token}`, "content-type": "application/json" };
    const endpoint = flow.selection.kind === "subscription" ? "/api/billing/subscribe" : "/api/billing/checkout-one-time";
    const body = flow.selection.kind === "subscription"
      ? { plan_code: flow.selection.planCode, interval: flow.selection.interval }
      : { product_code: flow.selection.productCode };
    track("checkout_requested", { kind: flow.selection.kind });

    try {
      const res = await fetch(endpoint, { method: "POST", headers: auth, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.checkout_url) { track("checkout_created"); window.location.href = data.checkout_url; return; }
      setBusy(false);
      setError(res.status === 503
        ? "Checkout isn’t available in this environment yet. Please try again shortly."
        : "We couldn’t start checkout. Please try again.");
    } catch {
      setBusy(false);
      setError("Network issue — please check your connection and try again.");
    }
  }

  if (!ready) return <div style={{ ...shell, alignItems: "center", justifyContent: "center" }}><span style={{ color: C.muted, fontFamily: font }}>Loading…</span></div>;
  if (!flow) return null;

  const sel = flow.selection;
  const isSub = sel.kind === "subscription";
  const sub = sel.kind === "subscription" ? subscriptionCardFor(sel.planCode) : null;
  const one = sel.kind === "one_time" ? oneTimeCardFor(sel.productCode) : null;
  const name = isSub ? `LeadLens ${sub?.name}` : `LeadLens ${one?.name}`;
  const price = sel.kind === "subscription" ? (sel.interval === "month" ? sub?.priceMonth : sub?.priceYear) : one?.price;
  const cadence = sel.kind === "subscription" ? (sel.interval === "month" ? "Monthly · billed monthly" : "Annual · billed yearly") : "One-time";
  const headline = isSub ? sub?.headline : one?.headline;
  const body = isSub ? sub?.body : one?.body;
  const capacity = isSub ? sub?.capacity : one?.capacity;

  return (
    <div style={shell}>
      <header style={{ padding: "1.5rem 1.75rem", maxWidth: "40rem", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <Link href="/pricing" style={{ fontSize: ".82rem", fontWeight: 600, color: C.skyInk, textDecoration: "none" }}>← Change plan</Link>
      </header>
      <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 1.5rem 3rem" }}>
        <div style={{ width: "100%", maxWidth: "34rem" }}>
          <p style={{ fontSize: ".74rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.skyInk, margin: "0 0 .6rem" }}>Your selection</p>
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "1.1rem", padding: "1.6rem 1.6rem", boxShadow: "0 4px 24px rgba(15,23,42,.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-.02em", margin: 0 }}>{name}</h1>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{price != null ? priceStr(price) : ""}{sel.kind === "subscription" && <span style={{ fontSize: ".8rem", color: C.muted, fontWeight: 600 }}>/{sel.interval === "month" ? "mo" : "yr"}</span>}</div>
              </div>
            </div>
            <div style={{ fontSize: ".82rem", color: C.muted, marginTop: ".2rem" }}>{cadence}</div>
            <p style={{ fontSize: ".97rem", fontWeight: 700, color: C.ink, lineHeight: 1.45, margin: "1rem 0 .4rem" }}>{headline}</p>
            <p style={{ fontSize: ".9rem", color: C.sub, lineHeight: 1.6, margin: 0 }}>{body}</p>
            <div style={{ borderTop: `1px solid ${C.lineSoft}`, marginTop: "1.1rem", paddingTop: ".8rem", fontSize: ".84rem", color: C.body, fontWeight: 600 }}>{capacity}</div>
          </div>

          {/* Optional, skippable context — never blocks checkout, no research runs. */}
          <div style={{ marginTop: "1.1rem" }}>
            {!showContext ? (
              <button onClick={() => { setShowContext(true); track("company_context_started"); }} style={ghostBtn}>
                + Add company context (optional)
              </button>
            ) : (
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "1rem", padding: "1.2rem 1.3rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".7rem" }}>
                  <span style={{ fontSize: ".9rem", fontWeight: 700 }}>Help LeadLens understand your context</span>
                  <button onClick={() => { setShowContext(false); track("company_context_skipped"); }} style={{ background: "none", border: "none", color: C.muted, fontSize: ".8rem", fontWeight: 600, cursor: "pointer" }}>Skip for now</button>
                </div>
                <Field label="Company website" placeholder="acme.com" value={ctx.website} onChange={(v) => setCtx({ ...ctx, website: v })} />
                <Field label="What are you trying to achieve?" placeholder="e.g. find manufacturers expanding capacity" value={ctx.objective} onChange={(v) => setCtx({ ...ctx, objective: v })} />
                <Field label="Primary market" placeholder="e.g. US, South America" value={ctx.market} onChange={(v) => setCtx({ ...ctx, market: v })} />
                <p style={{ fontSize: ".76rem", color: C.muted, margin: ".4rem 0 0" }}>Optional — you can refine this after checkout.</p>
              </div>
            )}
          </div>

          {error && <div role="alert" style={{ marginTop: "1rem", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: ".85rem", borderRadius: ".6rem", padding: ".7rem .85rem" }}>{error}</div>}

          <button onClick={startCheckout} disabled={busy} className="ll-checkout-cta" style={{ marginTop: "1.3rem", width: "100%", padding: ".95rem 1rem", fontSize: "1rem", fontWeight: 700, fontFamily: font, color: "#fff", background: busy ? C.faint : C.sky, border: "none", borderRadius: ".75rem", cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "Starting secure checkout…" : "Continue to secure checkout"}
          </button>
          <p style={{ textAlign: "center", color: C.muted, fontSize: ".78rem", marginTop: ".85rem" }}>
            Billing securely processed by <strong style={{ color: C.sub }}>Lemon Squeezy</strong>. LeadLens never sees your card details.
          </p>
        </div>
      </main>
      <style>{`.ll-checkout-cta:focus-visible{outline:none;box-shadow:${focusRing}} .ll-ctx-input:focus-visible{outline:none;border-color:${C.sky};box-shadow:${focusRing}}`}</style>
    </div>
  );
}

const shell: React.CSSProperties = { minHeight: "100vh", background: C.bg, fontFamily: font, color: C.ink, display: "flex", flexDirection: "column" };
const ghostBtn: React.CSSProperties = { width: "100%", padding: ".75rem 1rem", fontSize: ".88rem", fontWeight: 600, fontFamily: font, color: C.skyInk, background: C.card, border: `1px dashed ${C.line}`, borderRadius: ".75rem", cursor: "pointer" };

function Field({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "block", marginBottom: ".7rem" }}>
      <span style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: C.body, marginBottom: ".3rem" }}>{label}</span>
      <input
        className="ll-ctx-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", padding: ".6rem .75rem", fontSize: ".9rem", fontFamily: font, color: C.ink, border: `1px solid ${C.line}`, borderRadius: ".55rem", outline: "none" }}
      />
    </label>
  );
}
