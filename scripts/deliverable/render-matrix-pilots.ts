// ─── Opportunity Case — Matrix/Canvas pilots (same data, two desktop layouts) ─
// The desktop signature representation: a recognizable framework with stable
// zones (not a vertical band stack). Two variants share the same Case data,
// semantics and palette; only the spatial organization differs:
//   A. Matrix-forward — a strict header + 3-cell row + 2-cell row + Decision band.
//   B. Canvas-forward — asymmetric zones with Evidence as a tall right anchor.
// Output: output/pilots/case-matrix-pilot-a.html / case-canvas-pilot-b.html
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const C = {
  frame1: "#0b1220", frame2: "#0c4a6e", intel: "#0284c7", accent: "#0ea5e9",
  evidence: "#0e7490", confirmed: "#15803d", validate: "#b45309", validateBg: "#fffbeb", validateBorder: "#fde9c8",
  bg: "#f5f7fa", surface: "#ffffff", surfaceAlt: "#f8fafc", border: "#e8edf3", borderSoft: "#edf1f6",
  text: "#0f172a", text2: "#475569", muted: "#94a3b8",
  prioBg: "#f0f9ff", prioBorder: "#bae6fd", prioColor: "#0369a1", prioDot: "#0284c7",
};

const CASE = {
  account: "Northstar Logistics", role: "Potential Customer", type: "Operations Expansion",
  geo: "United States · Midwest", industry: "Mid-market logistics",
  thesis: "Northstar is building out regional distribution — plausibly widening its supplier and tooling needs before it formalizes procurement, a window to engage ahead of an RFP.",
  fit: "Strong", timing: "Strong", evidence: "Moderate",
  changed: "Signed a regional distribution agreement", changedAge: "9d ago", changedCat: "Expansion",
  change2: "Posted 4 operations roles (12d)",
  whyNow: "Scaling distribution typically strains an existing supplier network before teams plan for it — the moment to enter is now, not after procurement closes.",
  evStrength: "Moderate", evSupport: "Corroborated · 2 independent sources", evLatest: "9d ago",
  evClaim: "A regional distribution agreement was announced and confirmed against a second source.",
  sources: [["Direct", "Regional distribution agreement", "9d", C.intel], ["Supporting", "Operations hiring (careers page)", "12d", C.confirmed]] as [string, string, string, string][],
  weakens: "No procurement event or vendor evaluation is confirmed — the case rests on fit and timing.",
  stillNeed: "Whether procurement is centralized at group level or decided regionally.",
  validateQ: "Confirm whether regional purchasing is centralized at group level.",
  validateHow: "One discovery call with operations, or a group-procurement lookup.",
  decision: "Prioritize",
  decWhy: "Recent, partly corroborated expansion with strong fit and an open timing window — engaging now precedes a likely RFP.",
  decNext: "Reach the operations lead before a formal procurement process forms.",
  decRevisit: "If no procurement signal appears within 30 days.",
};

const badge = `<span class="mx-badge">● ${CASE.decision}</span>`;
const strong = (v: string) => `<b style="color:${v === "Strong" ? "#0f172a" : v === "Moderate" ? "#475569" : "#94a3b8"}">${v}</b>`;

function header(): string {
  return `<div class="mx-head">
    <div class="mx-head-l">
      <div class="mx-role">${CASE.role} · ${CASE.type}</div>
      <div class="mx-acctrow"><h1 class="mx-acct">${CASE.account}</h1>${badge}</div>
      <div class="mx-sub">${CASE.industry} · ${CASE.geo}</div>
      <p class="mx-thesis">${CASE.thesis}</p>
    </div>
    <div class="mx-dims">
      <div><div class="mx-dk">Fit</div><div class="mx-dv">${strong(CASE.fit)}</div></div>
      <div><div class="mx-dk">Timing</div><div class="mx-dv">${strong(CASE.timing)}</div></div>
      <div><div class="mx-dk">Evidence</div><div class="mx-dv">${strong(CASE.evidence)}</div></div>
    </div>
  </div>`;
}
const zChanged = `<div class="mx-zlabel mx-zlabel-accent">What Changed</div>
  <div class="mx-change"><span class="mx-cdot"></span><span class="mx-cevent">${CASE.changed}</span></div>
  <div class="mx-cmeta">${CASE.changedAge} · <span class="mx-cat">${CASE.changedCat}</span></div>
  <div class="mx-c2">+ ${CASE.change2}</div>`;
const zWhy = `<div class="mx-zlabel">Why It Matters Now</div><p class="mx-body">${CASE.whyNow}</p>`;
const zEvidence = `<div class="mx-zlabel">Evidence</div>
  <div class="mx-evbar">${strong(CASE.evStrength)} · ${CASE.evSupport}</div>
  <div class="mx-evlatest">Latest ${CASE.evLatest}</div>
  <p class="mx-body mx-claim">${CASE.evClaim}</p>
  <div class="mx-srcs">${CASE.sources.map(([rel, label, age, col]) => `<div class="mx-src"><span class="mx-rel" style="color:${col}">${rel}</span><span class="mx-srcl">${label}</span><span class="mx-srca">${age}</span></div>`).join("")}</div>`;
const zWeakens = `<div class="mx-zlabel">What Could Change the Case</div>
  <p class="mx-body"><span class="mx-inl">Weakens</span> ${CASE.weakens}</p>
  <p class="mx-body"><span class="mx-inl">Still unknown</span> ${CASE.stillNeed}</p>`;
const zValidate = `<div class="mx-zlabel">What to Validate</div>
  <div class="mx-valrow"><span class="mx-crit">Decision-critical</span><span class="mx-valq">${CASE.validateQ}</span></div>
  <p class="mx-body mx-how"><span class="mx-inl">How</span> ${CASE.validateHow}</p>`;
const zDecision = `<div class="mx-decrow"><div class="mx-zlabel" style="margin:0">Decision</div><span class="mx-badge mx-badge-lg">● ${CASE.decision}</span></div>
  <div class="mx-decgrid"><div><div class="mx-dk">Why this decision</div><p class="mx-body">${CASE.decWhy}</p></div>
  <div><div class="mx-dk">Recommended next step</div><p class="mx-body">${CASE.decNext}</p><div class="mx-revisit">Revisit when: ${CASE.decRevisit}</div></div></div>`;

function pilotA(): string {
  // Matrix-forward: header → 3 equal cells → 2 equal cells → Decision band.
  return `<div class="mx-case mxA">
    ${header()}
    <div class="mxA-row3">
      <div class="mx-cell mx-signal">${zChanged}</div>
      <div class="mx-cell">${zWhy}</div>
      <div class="mx-cell mx-ev">${zEvidence}</div>
    </div>
    <div class="mxA-row2">
      <div class="mx-cell mx-unc">${zWeakens}</div>
      <div class="mx-cell mx-val">${zValidate}</div>
    </div>
    <div class="mx-cell mx-dec">${zDecision}</div>
  </div>`;
}
function pilotB(): string {
  // Canvas-forward: header → asymmetric (left case narrative + tall Evidence anchor) → Decision band.
  return `<div class="mx-case mxB">
    ${header()}
    <div class="mxB-grid">
      <div class="mxB-left">
        <div class="mx-cell mx-signal">${zChanged}</div>
        <div class="mx-cell">${zWhy}</div>
        <div class="mxB-riskrow">
          <div class="mx-cell mx-unc">${zWeakens}</div>
          <div class="mx-cell mx-val">${zValidate}</div>
        </div>
      </div>
      <div class="mx-cell mx-ev mxB-anchor">${zEvidence}</div>
    </div>
    <div class="mx-cell mx-dec">${zDecision}</div>
  </div>`;
}

const CSS = `
*{box-sizing:border-box}body{margin:0;background:${C.bg};color:${C.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1000px;margin:0 auto;padding:26px 20px 60px}
.tag{font-size:12px;color:${C.muted};margin:0 2px 12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.mx-case{background:${C.surface};border:1px solid ${C.border};border-radius:16px;overflow:hidden;box-shadow:0 18px 48px rgba(11,18,32,.10)}
/* header band */
.mx-head{background:linear-gradient(120deg,${C.frame1},#12314f 62%,${C.frame2});color:#fff;padding:20px 24px;display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}
.mx-role{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7dd3fc;margin-bottom:6px}
.mx-acctrow{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.mx-acct{font-size:24px;font-weight:800;letter-spacing:-.02em;margin:0}
.mx-sub{font-size:12px;color:#9fb6cf;margin-top:3px}
.mx-thesis{font-size:14px;line-height:1.5;color:#dce7f2;margin:12px 0 0;max-width:44rem;font-weight:400}
.mx-dims{display:flex;gap:22px;align-items:flex-start;flex-shrink:0}
.mx-dk{font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7f9bb8}
.mx-head .mx-dk{color:#7f9bb8}
.mx-dv{font-size:16px;line-height:1.2;color:#fff}
.mx-head .mx-dv b{color:#fff!important}
/* cells */
.mx-cell{padding:16px 20px;background:${C.surface};min-width:0}
.mx-zlabel{font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:${C.muted};margin:0 0 9px}
.mx-zlabel-accent{color:${C.intel}}
.mx-body{font-size:13.5px;line-height:1.55;color:${C.text};margin:0}
.mx-claim{color:${C.text2};margin-top:8px}
.mx-inl{font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:${C.muted};margin-right:6px}
.mx-change{display:flex;align-items:baseline;gap:9px}
.mx-cdot{width:9px;height:9px;border-radius:50%;background:${C.accent};flex-shrink:0;transform:translateY(2px)}
.mx-cevent{font-size:15px;font-weight:700;color:${C.text};line-height:1.3}
.mx-cmeta{font-size:11.5px;color:${C.muted};margin-top:5px;padding-left:18px}
.mx-cat{font-weight:700;color:${C.intel};text-transform:uppercase;letter-spacing:.04em;font-size:10px}
.mx-c2{font-size:12px;color:${C.text2};margin-top:8px;padding-left:18px}
.mx-evbar{font-size:12.5px;color:${C.text2}}
.mx-evlatest{font-size:11.5px;color:${C.muted};margin-top:2px}
.mx-srcs{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.mx-src{display:flex;align-items:baseline;gap:8px}
.mx-rel{font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;min-width:64px}
.mx-srcl{font-size:12.5px;color:${C.text};font-weight:600;min-width:0}
.mx-srca{font-size:10.5px;color:${C.muted};margin-left:auto}
.mx-valrow{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
.mx-crit{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${C.validate};background:${C.validateBg};border:1px solid ${C.validateBorder};border-radius:4px;padding:2px 6px}
.mx-valq{font-size:13.5px;font-weight:600;color:${C.text};line-height:1.45}
.mx-how{margin-top:8px;color:${C.text2}}
.mx-badge{display:inline-flex;align-items:center;gap:5px;background:${C.prioBg};border:1px solid ${C.prioBorder};color:${C.prioColor};border-radius:999px;padding:3px 11px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
.mx-head .mx-badge{background:rgba(125,211,252,.16);border-color:rgba(125,211,252,.3);color:#e0f2fe}
.mx-badge-lg{font-size:12px;padding:4px 13px}
.mx-signal{background:linear-gradient(180deg,#f7fcff,#fff 70%);border-left:3px solid ${C.accent}}
.mx-unc{background:${C.surfaceAlt}}
.mx-val{background:linear-gradient(180deg,${C.validateBg},#fff 85%)}
.mx-ev{background:#fbfeff}
.mx-decrow{display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.mx-decgrid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.mx-revisit{font-size:11px;color:${C.muted};margin-top:6px}
.mx-dec{background:${C.prioBg};border-top:2px solid ${C.prioBorder}}
/* Matrix-forward grid */
.mxA-row3{display:grid;grid-template-columns:1fr 1fr 1.15fr;border-top:1px solid ${C.borderSoft}}
.mxA-row3 .mx-cell+.mx-cell{border-left:1px solid ${C.borderSoft}}
.mxA-row2{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid ${C.borderSoft}}
.mxA-row2 .mx-cell+.mx-cell{border-left:1px solid ${C.borderSoft}}
.mx-dec{border-top:1px solid ${C.borderSoft}}
/* Canvas-forward grid */
.mxB-grid{display:grid;grid-template-columns:1.5fr 1fr;border-top:1px solid ${C.borderSoft}}
.mxB-left{display:flex;flex-direction:column;border-right:1px solid ${C.borderSoft}}
.mxB-left .mx-cell{border-bottom:1px solid ${C.borderSoft}}
.mxB-riskrow{display:grid;grid-template-columns:1fr 1fr}
.mxB-riskrow .mx-cell{border-bottom:none!important}
.mxB-riskrow .mx-cell+.mx-cell{border-left:1px solid ${C.borderSoft}}
.mxB-anchor{display:flex;flex-direction:column}
@media(max-width:1023px){
  .mxA-row3,.mxB-grid{grid-template-columns:1fr}
  .mxA-row3 .mx-cell+.mx-cell,.mxB-left .mx-cell{border-left:none;border-top:1px solid ${C.borderSoft}}
  .mxB-left{border-right:none}
}
`;

function page(v: "A" | "B"): string {
  const body = v === "A" ? pilotA() : pilotB();
  const label = v === "A" ? "Matrix Pilot A — Matrix-forward (3-cell + 2-cell + Decision band)" : "Canvas Pilot B — Canvas-forward (asymmetric zones, Evidence anchor)";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LeadLens Opportunity Case — ${v === "A" ? "Matrix" : "Canvas"} Pilot</title><style>${CSS}</style></head><body><div class="wrap"><div class="tag">${label}</div>${body}</div></body></html>`;
}

const dir = path.join(process.cwd(), "output", "pilots");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "case-matrix-pilot-a.html"), page("A"), "utf8");
writeFileSync(path.join(dir, "case-canvas-pilot-b.html"), page("B"), "utf8");
console.log("✅ Matrix/Canvas pilots written to output/pilots/case-matrix-pilot-a.html and case-canvas-pilot-b.html");
