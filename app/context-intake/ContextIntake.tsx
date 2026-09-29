"use client";
import { useMemo, useState } from "react";

// Customer Context Intake — reusable product surface. Two modes (guided / AI-assisted) resolve into ONE
// canonical intake object (leadlens.customer_context.intake.v1) that maps to ConfirmedCommercialContextV1.
// The 600-char interpret cap (interpret-config MAX_INPUT_CHARS) is respected: the FULL structured context is
// captured here; only a concise objective summary (≤600 chars) is passed into Stage-A interpretation, with
// the rest persisted structurally as constraints. No fabrication — unknown fields stay unknown.

const C = { ink: "#0f172a", sub: "#334155", muted: "#64748b", line: "#e2e8f0", faint: "#f8fafc", cobalt: "#0284c7", ok: "#047857", warn: "#b45309" };
const box: React.CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px", marginBottom: 14, background: "#fff" };
const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 };
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
const btn = (a: boolean): React.CSSProperties => ({ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 8, cursor: "pointer", border: "none", background: a ? C.cobalt : C.faint, color: a ? "#fff" : C.sub });
const tag = (bg: string): React.CSSProperties => ({ display: "inline-block", fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: bg, color: "#fff", marginLeft: 6 });

// Guided field spec: [key, label, requirement, conditional-hint]
const FIELDS: Array<[string, string, "REQUIRED" | "OPTIONAL" | "CONDITIONAL"]> = [
  ["company", "Company name + website", "REQUIRED"],
  ["offering", "What you sell (product/service + format)", "REQUIRED"],
  ["objective", "Commercial objective (in your words)", "REQUIRED"],
  ["target_market", "Target market(s) you want to enter", "REQUIRED"],
  ["ideal_customer", "Ideal customer / who you sell to", "REQUIRED"],
  ["success", "What success means", "REQUIRED"],
  ["current_markets", "Current markets", "OPTIONAL"],
  ["exclude", "Accounts to exclude", "OPTIONAL"],
  ["capacity", "Production capacity", "CONDITIONAL"],
  ["moq", "MOQ / minimum order", "CONDITIONAL"],
  ["price", "Unit / wholesale price (kept internal)", "OPTIONAL"],
  ["packaging", "Packaging + shipping constraints", "CONDITIONAL"],
  ["certifications", "Certifications / documentation held", "CONDITIONAL"],
  ["customization", "Customization limits", "OPTIONAL"],
  ["channels", "Current + preferred / avoided channels", "OPTIONAL"],
  ["timeline", "Commercial timeline", "OPTIONAL"],
  ["competitors", "Known competitors", "OPTIONAL"],
];
const REQUIRED = FIELDS.filter((f) => f[2] === "REQUIRED").map((f) => f[0]);

const AI_PROMPT = `You are helping me prepare a Customer Context for LeadLens (a commercial-intelligence product). Help me organize what I ALREADY know about my own business — do not invent anything.
Rules: (1) interview me a few questions at a time, starting with what I sell, my objective in my words, and the market I want to enter; (2) only record what I actually tell you — if I don't know something, mark it UNKNOWN, never guess capacity/MOQ/price/margin/certifications/customers/competitors; (3) label each statement OBSERVED_FACT / CUSTOMER_CONFIRMED / CUSTOMER_ESTIMATE / CUSTOMER_ASSUMPTION / UNKNOWN; (4) list my unknowns and assumptions at the end; (5) if I'm entering a new market or exporting, ask how my constraints change there (packaging/freight, minimum shipment economics, documentation) but still never invent regulatory or buyer facts — mark them UNKNOWN or "requires validation"; (6) do not add companies, buyers, volumes, prices or compliance conclusions I did not give you.
Output: (a) a short human-readable summary, and (b) a single fenced json block with keys: company, offering, objective, target_market, ideal_customer, success, current_markets, exclude, capacity, moq, price, packaging, certifications, customization, channels, timeline, competitors, unknowns[], assumptions[]. Leave fields empty where unknown.`;

export default function ContextIntake() {
  const [mode, setMode] = useState<"guided" | "ai">("guided");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const [pasted, setPasted] = useState("");
  const [parseErr, setParseErr] = useState("");
  const [copied, setCopied] = useState(false);

  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));
  const missing = REQUIRED.filter((k) => !(vals[k] ?? "").trim());
  const shownFields = showAll ? FIELDS : FIELDS.filter((f) => f[2] === "REQUIRED");

  // Concise objective summary for Stage-A interpretation (≤600 chars) — the rest persists as constraints.
  const summary = useMemo(() => {
    const s = [vals.offering, vals.objective && `Objective: ${vals.objective}`, vals.target_market && `Target market: ${vals.target_market}`, vals.ideal_customer && `Ideal customer: ${vals.ideal_customer}`, vals.exclude && `Exclude: ${vals.exclude}`].filter(Boolean).join(". ");
    return s.length > 600 ? s.slice(0, 597) + "…" : s;
  }, [vals]);

  function parsePaste() {
    setParseErr("");
    const m = pasted.match(/```json\s*([\s\S]*?)```/) ?? pasted.match(/(\{[\s\S]*\})/);
    if (!m) { setParseErr("No JSON block found. Paste the fenced ```json block your AI produced."); return; }
    try {
      const obj = JSON.parse(m[1]);
      const next: Record<string, string> = {};
      for (const [k] of FIELDS) { const val = obj[k]; if (val != null && val !== "") next[k] = typeof val === "string" ? val : JSON.stringify(val); }
      setVals((s) => ({ ...s, ...next }));
      setMode("guided"); setShowAll(true);
    } catch (e) { setParseErr("Invalid JSON — check the pasted block. " + (e instanceof Error ? e.message : "")); }
  }

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: C.ink, maxWidth: 760, margin: "0 auto", padding: "24px 16px 60px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.cobalt }}>LeadLens · Customer Context</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", margin: "4px 0 4px" }}>Tell LeadLens about your business</h1>
      <p style={{ fontSize: 13.5, color: C.muted, margin: "0 0 16px" }}>The more we know, the sharper the intelligence. Answer what you can — &ldquo;I don&rsquo;t know&rdquo; is a valid answer, and we never invent facts.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button style={btn(mode === "guided")} onClick={() => setMode("guided")}>Guided</button>
        <button style={btn(mode === "ai")} onClick={() => setMode("ai")}>Prepare with your AI</button>
      </div>

      {mode === "ai" && (
        <div style={box}>
          <div style={{ ...label, fontSize: 14 }}>1 · Copy this into ChatGPT, Claude, or Gemini</div>
          <textarea readOnly value={AI_PROMPT} style={{ ...input, height: 150, fontFamily: "ui-monospace,monospace", fontSize: 11.5 }} />
          <button style={{ ...btn(false), marginTop: 8 }} onClick={() => { navigator.clipboard?.writeText(AI_PROMPT).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {}); }}>{copied ? "Copied ✓" : "Copy prompt"}</button>
          <div style={{ ...label, fontSize: 14, marginTop: 16 }}>2 · Paste your AI&rsquo;s result here</div>
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste the summary + the ```json block your AI produced…" style={{ ...input, height: 130 }} />
          {parseErr && <div style={{ color: C.warn, fontSize: 12.5, marginTop: 6 }}>{parseErr}</div>}
          <button style={{ ...btn(true), marginTop: 8 }} onClick={parsePaste}>Parse &amp; review</button>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>We&rsquo;ll show what we parsed so you can edit and confirm — nothing is used until you approve it.</div>
        </div>
      )}

      {mode === "guided" && (
        <div style={box}>
          {shownFields.map(([k, lab, req]) => (
            <div key={k} style={{ marginBottom: 12 }}>
              <label style={label}>{lab}<span style={tag(req === "REQUIRED" ? C.cobalt : req === "CONDITIONAL" ? C.warn : C.muted)}>{req}</span></label>
              <textarea value={vals[k] ?? ""} onChange={(e) => set(k, e.target.value)} rows={k === "objective" || k === "offering" ? 2 : 1} style={{ ...input, resize: "vertical" }} placeholder={req === "OPTIONAL" || req === "CONDITIONAL" ? "Optional — leave blank if unknown" : ""} />
            </div>
          ))}
          {!showAll && <button style={btn(false)} onClick={() => setShowAll(true)}>+ Add capacity, MOQ, packaging, economics &amp; more (optional)</button>}
        </div>
      )}

      <div style={box}>
        <div style={{ ...label, fontSize: 14 }}>Review</div>
        {missing.length > 0
          ? <div style={{ color: C.warn, fontSize: 13 }}>Missing required: {missing.map((k) => FIELDS.find((f) => f[0] === k)?.[1]).join(", ")}</div>
          : <div style={{ color: C.ok, fontSize: 13, fontWeight: 700 }}>✓ All required fields present</div>}
        <div style={{ ...label, marginTop: 12 }}>Objective summary sent to interpretation ({summary.length}/600 chars)</div>
        <div style={{ fontSize: 12.5, color: C.sub, background: C.faint, borderRadius: 8, padding: "8px 10px", whiteSpace: "pre-wrap" }}>{summary || "—"}</div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>The full context (capacity, MOQ, packaging, certifications, economics) is kept as structured constraints and never truncated; only this concise objective goes into Stage-A interpretation.</div>
        <button disabled={missing.length > 0} style={{ ...btn(missing.length === 0), marginTop: 12, opacity: missing.length > 0 ? 0.5 : 1, cursor: missing.length > 0 ? "not-allowed" : "pointer" }} onClick={() => { /* wire-up: persist canonical context + run — pilot surface */ }}>Confirm context</button>
      </div>
    </div>
  );
}
