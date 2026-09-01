"use client";
// ─── Customer Activation V1 — the authenticated front-of-funnel ───────────────
// Raw commercial intent → typed Stage-A interpretation → bounded clarification →
// explicit confirmation → REAL frozen Intelligence run → durable /results/[runId].
// Pure glue over already-proven contracts: it adds NO Intelligence semantics.
//   - requestInterpretation / confirmAndStartIntelligence (lib/interpretation/interpret-client)
//   - /results/[runId] owns the durable processing → completed → brief → Monitor experience.
// Stage A only interprets the customer's own words; it never implies research ran.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  requestInterpretation, confirmAndStartIntelligence, type PublicInterpretation,
} from "@/lib/interpretation/interpret-client";

type Locale = "en" | "es" | "pt" | "ja";
type Phase = "intent" | "review" | "starting";
const MAX_CLARIFICATIONS = 3; // hard ceiling (§12): only genuine high-impact ambiguity

// Deterministic telemetry (§27/§44): fire-and-forget; never blocks the customer,
// never carries raw commercial text — only the event name + coarse meta.
function track(event: string, meta: Record<string, string> = {}) {
  void fetch("/api/events", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, meta }),
  }).catch(() => null);
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "1.1rem 1.25rem" };
const label: React.CSSProperties = { fontSize: ".68rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#0284c7", margin: "0 0 .5rem" };
const li: React.CSSProperties = { display: "flex", gap: ".5rem", alignItems: "flex-start", color: "#0f172a", fontSize: ".85rem", lineHeight: 1.45, padding: ".12rem 0" };
const Dot = () => <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "#0ea5e9", flexShrink: 0, marginTop: ".42rem" }} />;

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: ".9rem" }}>
      <p style={label}>{title}</p>
      <div>{items.map((t, i) => <div key={i} style={li}><Dot />{t}</div>)}</div>
    </div>
  );
}

export default function ActivatePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("intent");
  const [input, setInput] = useState("");
  const [locale, setLocale] = useState<Locale>("en");
  const [interp, setInterp] = useState<PublicInterpretation | null>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [clarification, setClarification] = useState("");
  const [clarifyTurns, setClarifyTurns] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const startedRef = useRef(false);            // idempotency guard (§19): one run per confirm
  const contextIdRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const session = supabase ? (await supabase.auth.getSession()).data.session : null;
        setAuthed(Boolean(session));
        if (session) track("activation_started");
      } catch { setAuthed(false); }
    })();
  }, []);

  const interpret = useCallback(async (clarifyText?: string) => {
    setBusy(true); setError("");
    const res = await requestInterpretation(input, clarifyText, locale);
    setBusy(false);
    if (!res.ok) {
      setError(res.rateLimited ? "Too many requests — please wait a moment and try again." : "We couldn't read that just now. Please try again.");
      return;
    }
    setInterp(res.interpretation);
    setConfirmationToken(res.confirmationToken);
    setPhase("review");
    track("interpretation_generated", { status: res.interpretation.status });
    if (res.interpretation.status === "needs_clarification") track("clarification_requested");
  }, [input, locale]);

  const onClarify = useCallback(async () => {
    if (clarifyTurns >= MAX_CLARIFICATIONS) return;
    setClarifyTurns((n) => n + 1);
    const text = clarification.trim();
    setClarification("");
    await interpret(text || undefined);
  }, [clarification, clarifyTurns, interpret]);

  const confirmAndRun = useCallback(async () => {
    if (!confirmationToken || startedRef.current) return;
    startedRef.current = true;
    setBusy(true); setPhase("starting"); setError("");
    if (!contextIdRef.current) contextIdRef.current = `ctx_${(crypto.randomUUID?.() ?? String(Date.now())).replace(/-/g, "")}`;
    track("context_confirmed");
    const started = await confirmAndStartIntelligence(confirmationToken, contextIdRef.current);
    if (!started.ok) {
      startedRef.current = false; setBusy(false); setPhase("review");
      if (started.reason === "signin_required") { window.location.assign("/login?next=/activate"); return; }
      setError(started.reason === "confirmation_failed" ? "We couldn't confirm that interpretation. Please review and try again." : "We couldn't start the run. Please try again in a moment.");
      return;
    }
    track("intelligence_run_started");
    window.location.assign(`/results/${started.runId}`);
  }, [confirmationToken]);

  const editIntent = () => { setPhase("intent"); setInterp(null); setConfirmationToken(null); setClarifyTurns(0); startedRef.current = false; contextIdRef.current = null; };

  if (authed === false) {
    return (
      <Shell>
        <div style={card}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 .5rem", color: "#0f172a" }}>Sign in to start</h1>
          <p style={{ color: "#64748b", fontSize: ".9rem", margin: "0 0 1rem" }}>Your intelligence run is private to your account.</p>
          <Link href="/login?next=/activate" style={primaryBtn}>Sign in →</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: "0 0 .3rem" }}>Start an opportunity run</h1>
      <p style={{ color: "#64748b", fontSize: ".9rem", margin: "0 0 1.2rem", maxWidth: "40rem" }}>
        Tell LeadLens what you're trying to accomplish commercially. You'll see exactly what LeadLens understood before anything runs.
      </p>
      {error && <div style={{ ...card, borderColor: "#fca5a5", color: "#b91c1c", marginBottom: "1rem" }}>{error}</div>}

      {phase === "intent" && (
        <div style={card}>
          <label htmlFor="intent" style={label}>What are you trying to accomplish?</label>
          <textarea id="intent" value={input} onChange={(e) => setInput(e.target.value)} rows={4} maxLength={600}
            placeholder="e.g. We sell factory automation equipment to US food & beverage manufacturers that have recently expanded or retooled their plants."
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 10, padding: ".8rem 1rem", fontSize: "1rem", lineHeight: 1.5, fontFamily: "inherit", minHeight: "7rem", resize: "vertical" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: ".8rem", gap: ".75rem", flexWrap: "wrap" }}>
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} aria-label="Language" style={{ padding: ".5rem .6rem", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: ".85rem" }}>
              <option value="en">English</option><option value="es">Español</option><option value="pt">Português</option><option value="ja">日本語</option>
            </select>
            <button type="button" onClick={() => interpret()} disabled={busy || input.trim().length < 12} style={{ ...primaryBtn, opacity: busy || input.trim().length < 12 ? .6 : 1 }}>
              {busy ? "Reading…" : "See what LeadLens understands →"}
            </button>
          </div>
        </div>
      )}

      {phase === "review" && interp && (
        <>
          {interp.status === "unsupported_objective" ? (
            <div style={{ ...card, borderColor: "#fcd34d" }}>
              <p style={label}>Outside LeadLens's scope</p>
              <p style={{ color: "#0f172a", fontSize: ".9rem", lineHeight: 1.5 }}>{interp.unsupportedReason ?? "This objective isn't something LeadLens evaluates today."}</p>
              <button type="button" onClick={editIntent} style={{ ...secondaryBtn, marginTop: ".9rem" }}>← Revise</button>
            </div>
          ) : (
            <>
              <div style={card}>
                <p style={label}>What LeadLens understood</p>
                {interp.told.summary && <p style={{ color: "#0f172a", fontSize: ".92rem", lineHeight: 1.5, margin: "0 0 .3rem" }}>{interp.told.summary}</p>}
                <Section title="What you told LeadLens" items={[interp.told.offer ? `Offer: ${interp.told.offer}` : "", ...interp.told.target.map((t) => `Target: ${t}`), ...interp.told.geographies.map((g) => `Where: ${g}`), ...interp.told.exclusions.map((x) => `Exclude: ${x}`)].filter(Boolean)} />
                <Section title="What LeadLens inferred (not yet verified)" items={[interp.inferred.objectiveLabel ? `Objective: ${interp.inferred.objectiveLabel}` : "", interp.inferred.businessModel ?? "", ...interp.inferred.opportunityConditions].filter(Boolean)} />
                <Section title="What would make an account interesting" items={interp.inferred.signalsToWatch} />
                <Section title="What LeadLens would investigate" items={interp.targetMode === "discovery_required" ? [...interp.discovery.needs, ...interp.discovery.candidateOrgTypes.map((o) => `Investigate: ${o}`)] : interp.inferred.routesToEvaluate} />
                <Section title="Still to define" items={interp.gaps} />
                <p style={{ color: "#94a3b8", fontSize: ".72rem", marginTop: ".9rem", lineHeight: 1.4 }}>{interp.disclosure}</p>
              </div>

              {interp.status === "needs_clarification" && interp.clarification.question && clarifyTurns < MAX_CLARIFICATIONS ? (
                <div style={{ ...card, marginTop: "1rem" }}>
                  <p style={label}>One thing to clarify</p>
                  <p style={{ color: "#0f172a", fontSize: ".9rem", margin: "0 0 .6rem" }}>{interp.clarification.question}</p>
                  <textarea value={clarification} onChange={(e) => setClarification(e.target.value)} rows={2} maxLength={400}
                    style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 8, padding: ".6rem .8rem", fontSize: ".9rem", fontFamily: "inherit" }} />
                  <div style={{ display: "flex", gap: ".6rem", marginTop: ".7rem", flexWrap: "wrap" }}>
                    <button type="button" onClick={onClarify} disabled={busy || !clarification.trim()} style={{ ...primaryBtn, opacity: busy || !clarification.trim() ? .6 : 1 }}>{busy ? "Reading…" : "Answer →"}</button>
                    <button type="button" onClick={editIntent} style={secondaryBtn}>← Edit</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: ".7rem", marginTop: "1rem", flexWrap: "wrap" }}>
                  <button type="button" onClick={confirmAndRun} disabled={busy || !confirmationToken} style={{ ...primaryBtn, opacity: busy || !confirmationToken ? .6 : 1 }}>
                    Confirm & run intelligence →
                  </button>
                  <button type="button" onClick={editIntent} style={secondaryBtn}>← Edit</button>
                </div>
              )}
              {clarifyTurns >= MAX_CLARIFICATIONS && interp.status === "needs_clarification" && (
                <p style={{ color: "#94a3b8", fontSize: ".78rem", marginTop: ".6rem" }}>You can confirm with what LeadLens has, or edit your description for a sharper read.</p>
              )}
            </>
          )}
        </>
      )}

      {phase === "starting" && (
        <div style={card}>
          <p style={{ color: "#0f172a", fontSize: ".95rem", fontWeight: 700 }}>Starting your intelligence run…</p>
          <p style={{ color: "#64748b", fontSize: ".85rem", marginTop: ".4rem" }}>This can take a few minutes. You'll be taken to your run — you can leave and come back to it anytime.</p>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: "#f4f7fb", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "2.2rem 1.1rem 3rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: ".6rem", marginBottom: "1.4rem" }}>
          <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0b1220" }}>Lead<span style={{ color: "#0284c7" }}>Lens</span></span>
          <Link href="/dashboard" style={{ color: "#94a3b8", fontSize: ".78rem", textDecoration: "none" }}>Dashboard</Link>
        </div>
        {children}
      </div>
    </main>
  );
}

const primaryBtn: React.CSSProperties = { minHeight: 44, border: 0, borderRadius: 10, padding: ".65rem 1.1rem", background: "#0ea5e9", color: "#fff", fontWeight: 800, fontFamily: "inherit", cursor: "pointer", textDecoration: "none", display: "inline-block" };
const secondaryBtn: React.CSSProperties = { minHeight: 44, border: "1px solid #cbd5e1", borderRadius: 10, padding: ".55rem 1rem", background: "#fff", color: "#334155", fontWeight: 700, fontFamily: "inherit", cursor: "pointer" };
