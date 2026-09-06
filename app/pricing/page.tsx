"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { C, font, focusRing } from "@/lib/commercial/theme";
import { oneTimeCards, subscriptionCards, annualSavingLabel, type SubscriptionCard, type OneTimeCard } from "@/lib/commercial/plan-catalog";
import { commercialFlowQuery, safeCustomerReturnPath, type CommercialFlowState, type BillingInterval, type CommercialPath } from "@/lib/commercial/customer-flow";

function track(event: string, meta: Record<string, string> = {}) {
  try { void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, ...meta }), keepalive: true }); } catch { /* never block */ }
}

export default function PricingPage() {
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [path, setPath] = useState<CommercialPath | null>(null);
  const subs = useMemo(() => subscriptionCards(), []);
  const oneTime = useMemo(() => oneTimeCards(), []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const cp = p.get("commercial_path");
    setPath(cp === "one_time" || cp === "ongoing" ? cp : null);
    track("pricing_viewed", cp ? { commercial_path: cp } : {});
  }, []);

  function go(state: CommercialFlowState) {
    if (state.selection.kind === "subscription") track("plan_selected", { kind: "subscription", plan_code: state.selection.planCode, billing_interval: state.selection.interval });
    else track("plan_selected", { kind: "one_time", product_code: state.selection.productCode });
    router.push(`/signup${commercialFlowQuery(state)}`);
  }

  function selectSub(card: SubscriptionCard) {
    go({ selection: { kind: "subscription", planCode: card.planCode, interval }, commercial_path: path, source_cta: "pricing", locale: "en", return_to: safeCustomerReturnPath("/checkout/continue") });
  }
  function selectOneTime(card: OneTimeCard) {
    go({ selection: { kind: "one_time", productCode: card.productCode }, commercial_path: path, source_cta: "pricing", locale: "en", return_to: safeCustomerReturnPath("/checkout/continue") });
  }

  const ongoing = (
    <section aria-labelledby="ongoing-h" style={{ marginBottom: "3.5rem" }}>
      <SectionHead id="ongoing-h" eyebrow="Ongoing intelligence" title="Keep commercial priorities current" sub="The full LeadLens system, working continuously across your accounts." />
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.9rem" }}>
        <IntervalToggle interval={interval} onChange={setInterval} />
      </div>
      <div className="ll-pr-grid ll-pr-grid-3">
        {subs.map((c) => <SubCard key={c.planCode} card={c} interval={interval} onSelect={() => selectSub(c)} />)}
      </div>
    </section>
  );

  const project = (
    <section aria-labelledby="onetime-h" style={{ marginBottom: "2rem" }}>
      <SectionHead id="onetime-h" eyebrow="For a specific project" title="Need intelligence once, not ongoing?" sub="Bounded, point-in-time Account Opportunity Intelligence. Buy exactly what the decision needs." />
      <div className="ll-pr-grid ll-pr-grid-4">
        {oneTime.map((c) => <OneTimeCardView key={c.productCode} card={c} onSelect={() => selectOneTime(c)} />)}
      </div>
    </section>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font, color: C.ink }}>
      <header style={{ padding: "1.5rem 1.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: "76rem", margin: "0 auto", boxSizing: "border-box" }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-.02em", color: C.ink, textDecoration: "none" }}>LeadLens</Link>
        <Link href="/login" style={{ fontSize: ".85rem", fontWeight: 600, color: C.skyInk, textDecoration: "none" }}>Sign in</Link>
      </header>

      <main style={{ maxWidth: "76rem", margin: "0 auto", padding: "1rem 1.5rem 4rem" }}>
        <div style={{ textAlign: "center", maxWidth: "40rem", margin: "0 auto 3rem" }}>
          <h1 style={{ fontSize: "clamp(1.7rem,4.2vw,2.4rem)", fontWeight: 800, letterSpacing: "-.025em", lineHeight: 1.14, margin: 0 }}>Choose the intelligence you need</h1>
          <p style={{ color: C.sub, fontSize: "1.02rem", lineHeight: 1.6, margin: ".85rem 0 0" }}>
            Every plan meets the same standard of evidence. What changes is scope, depth, frequency and portfolio size — never integrity.
          </p>
        </div>

        {/* Pre-orient by the customer's chosen path; ongoing is the default primary. */}
        {path === "one_time" ? <>{project}{ongoing}</> : <>{ongoing}{project}</>}

        <p style={{ textAlign: "center", color: C.muted, fontSize: ".82rem", marginTop: "1rem" }}>
          Prices in USD. You&apos;ll create an account before checkout — no charge until you confirm. Billing securely processed by Lemon Squeezy.
        </p>
      </main>

      <style>{`
        .ll-pr-grid { display: grid; gap: 1.1rem; }
        .ll-pr-grid-3 { grid-template-columns: repeat(3, 1fr); max-width: 62rem; margin: 0 auto; }
        .ll-pr-grid-4 { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 900px) { .ll-pr-grid-3, .ll-pr-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 560px) { .ll-pr-grid-3, .ll-pr-grid-4 { grid-template-columns: 1fr !important; } }
        .ll-plan-btn { transition: background .15s, box-shadow .15s, border-color .15s, transform .15s; }
        .ll-plan-btn:hover { transform: translateY(-1px); }
        .ll-plan-btn:focus-visible { outline: none; box-shadow: ${focusRing}; }
        .ll-card:focus-within { border-color: ${C.sky}; }
      `}</style>
    </div>
  );
}

function SectionHead({ id, eyebrow, title, sub }: { id: string; eyebrow: string; title: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: "1.6rem" }}>
      <p style={{ fontSize: ".74rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.skyInk, margin: "0 0 .55rem" }}>{eyebrow}</p>
      <h2 id={id} style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-.02em", margin: 0 }}>{title}</h2>
      <p style={{ color: C.sub, fontSize: ".97rem", lineHeight: 1.55, margin: ".55rem auto 0", maxWidth: "34rem" }}>{sub}</p>
    </div>
  );
}

function IntervalToggle({ interval, onChange }: { interval: BillingInterval; onChange: (i: BillingInterval) => void }) {
  const opt = (val: BillingInterval, label: string) => (
    <button
      role="tab" aria-selected={interval === val} onClick={() => onChange(val)}
      className="ll-plan-btn"
      style={{
        fontFamily: font, cursor: "pointer", border: "none", borderRadius: ".55rem", padding: ".5rem 1.1rem",
        fontSize: ".85rem", fontWeight: 700, background: interval === val ? C.card : "transparent",
        color: interval === val ? C.ink : C.sub, boxShadow: interval === val ? "0 1px 3px rgba(0,0,0,.08)" : "none",
      }}
    >{label}</button>
  );
  return (
    <div role="tablist" aria-label="Billing interval" style={{ display: "inline-flex", gap: ".25rem", background: "#eef2f6", border: `1px solid ${C.line}`, borderRadius: ".7rem", padding: ".25rem" }}>
      {opt("month", "Monthly")}
      {opt("year", "Annual")}
    </div>
  );
}

function priceStr(n: number) { return `$${n.toLocaleString("en-US")}`; }

function SubCard({ card, interval, onSelect }: { card: SubscriptionCard; interval: BillingInterval; onSelect: () => void }) {
  const price = interval === "month" ? card.priceMonth : card.priceYear;
  const saving = interval === "year" ? annualSavingLabel(card.priceMonth, card.priceYear) : "";
  return (
    <div className="ll-card" style={{ position: "relative", background: C.card, border: `1px solid ${card.featured ? C.sky : C.line}`, borderRadius: "1.05rem", padding: "1.6rem 1.4rem", display: "flex", flexDirection: "column", gap: ".7rem", boxShadow: card.featured ? "0 12px 32px rgba(2,132,199,.12)" : "none" }}>
      {card.featured && <span style={{ position: "absolute", top: "-.7rem", left: "1.4rem", background: C.sky, color: "#fff", fontSize: ".66rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: ".2rem .6rem", borderRadius: "1rem" }}>Most chosen</span>}
      <h3 style={{ fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-.01em", margin: 0 }}>{card.name}</h3>
      <div style={{ display: "flex", alignItems: "baseline", gap: ".35rem" }}>
        <span style={{ fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-.02em" }}>{priceStr(price)}</span>
        <span style={{ color: C.muted, fontSize: ".85rem", fontWeight: 600 }}>/{interval === "month" ? "mo" : "yr"}</span>
      </div>
      <div style={{ minHeight: "1rem", fontSize: ".76rem", fontWeight: 600, color: C.skyInk }}>{saving}</div>
      <p style={{ fontSize: ".95rem", fontWeight: 700, color: C.ink, lineHeight: 1.4, margin: 0 }}>{card.headline}</p>
      <p style={{ fontSize: ".88rem", color: C.sub, lineHeight: 1.55, margin: 0, flex: 1 }}>{card.body}</p>
      <div style={{ borderTop: `1px solid ${C.lineSoft}`, paddingTop: ".7rem", fontSize: ".82rem", color: C.body }}>
        <div style={{ fontWeight: 700 }}>{card.capacity}</div>
        <div style={{ color: C.muted, fontSize: ".76rem", marginTop: ".15rem" }}>{card.creditsNote}</div>
      </div>
      <button onClick={onSelect} className="ll-plan-btn" style={{ marginTop: ".4rem", fontFamily: font, cursor: "pointer", border: "none", borderRadius: ".65rem", padding: ".7rem 1rem", fontSize: ".92rem", fontWeight: 700, color: "#fff", background: card.featured ? C.sky : C.ink }}>
        Start {card.name}
      </button>
    </div>
  );
}

function OneTimeCardView({ card, onSelect }: { card: OneTimeCard; onSelect: () => void }) {
  return (
    <div className="ll-card" style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: ".95rem", padding: "1.35rem 1.2rem", display: "flex", flexDirection: "column", gap: ".55rem" }}>
      <h3 style={{ fontSize: "1.02rem", fontWeight: 800, margin: 0 }}>{card.name}</h3>
      <div style={{ display: "flex", alignItems: "baseline", gap: ".3rem" }}>
        <span style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-.02em" }}>{priceStr(card.price)}</span>
        <span style={{ color: C.muted, fontSize: ".76rem", fontWeight: 600 }}>one-time</span>
      </div>
      <p style={{ fontSize: ".86rem", fontWeight: 700, color: C.ink, lineHeight: 1.4, margin: 0 }}>{card.headline}</p>
      <p style={{ fontSize: ".82rem", color: C.sub, lineHeight: 1.5, margin: 0, flex: 1 }}>{card.body}</p>
      <div style={{ fontSize: ".77rem", color: C.muted, borderTop: `1px solid ${C.lineSoft}`, paddingTop: ".55rem" }}>{card.capacity}</div>
      <button onClick={onSelect} className="ll-plan-btn" style={{ marginTop: ".3rem", fontFamily: font, cursor: "pointer", border: `1px solid ${C.ink}`, background: "transparent", color: C.ink, borderRadius: ".6rem", padding: ".6rem 1rem", fontSize: ".86rem", fontWeight: 700 }}>
        Choose {card.name}
      </button>
    </div>
  );
}
