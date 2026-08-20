// ─── Client Opportunity Canvas — two client-level pilots (light, canvas-like) ─
// The signature LeadLens surface is CLIENT-level: the customer using LeadLens is
// the subject; discovered opportunities live INSIDE the canvas. Light composition
// (navy only for text + thin rules; blue as a precise accent). Two variants:
//   C. Structured Client Canvas — Where-to-Focus dominant + supporting column.
//   D. Opportunity Landscape Canvas — spatial zones around a central field.
// Output: output/pilots/client-canvas-pilot-c.html / -pilot-d.html
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const C = {
  navy: "#0b1220", ink: "#0f172a", ink2: "#475569", muted: "#94a3b8",
  intel: "#0284c7", intelSoft: "#e8f4fc", accent: "#0ea5e9",
  evidence: "#0e7490", confirmed: "#15803d", amber: "#b45309", amberBg: "#fffbeb", amberBorder: "#fde9c8",
  bg: "#f6f7f9", surface: "#ffffff", surfaceAlt: "#fafbfc", border: "#e6ebf1", borderSoft: "#eef2f6",
  prio: "#0284c7", val: "#d97706", mon: "#64748b", hold: "#94a3b8",
};

const CLIENT = {
  name: "Asteron Systems",
  objective: "Find enterprise accounts where operational expansion creates a credible near-term software opportunity.",
  market: "United States · Enterprise logistics & operations software",
  generated: "Generated Aug 2026",
  evaluated: 5,
};
type Dec = "Prioritize" | "Validate" | "Monitor" | "Hold";
const DOT: Record<Dec, string> = { Prioritize: C.prio, Validate: C.val, Monitor: C.mon, Hold: C.hold };
const OPPS: { rank: number; name: string; type: string; dec: Dec; fit: string; timing: string; evid: string; changed: string; fresh: string }[] = [
  { rank: 1, name: "Northstar Logistics", type: "Operations Expansion", dec: "Prioritize", fit: "Strong", timing: "Strong", evid: "Moderate", changed: "Signed a regional distribution agreement", fresh: "9d" },
  { rank: 2, name: "FreshRoute Foods", type: "Operations Expansion", dec: "Validate", fit: "Strong", timing: "Moderate", evid: "Moderate", changed: "Opened two new distribution sites", fresh: "14d" },
  { rank: 3, name: "Vantage Freight Co.", type: "Technology Modernization", dec: "Validate", fit: "Moderate", timing: "Moderate", evid: "Limited", changed: "Posted a systems-modernization RFI", fresh: "18d" },
  { rank: 4, name: "Atlas Clinics Group", type: "Facility Expansion", dec: "Monitor", fit: "Moderate", timing: "Limited", evid: "Limited", changed: "Announced two new clinic locations", fresh: "21d" },
  { rank: 5, name: "Bergen Retail Group", type: "New Business", dec: "Hold", fit: "Limited", timing: "Limited", evid: "Limited", changed: "No dated operational signal", fresh: "—" },
];
const READ = "Two accounts merit attention now on recent, corroborated operational expansion; two more need validation of category or procurement scope. The strongest pattern is regional distribution build-outs creating near-term tooling needs.";
const PATTERNS = ["3 of 5 accounts show operational expansion in the last 30 days.", "Distribution build-outs are the dominant trigger.", "Healthcare facility growth is early — no sourcing signal yet."];
const COVERAGE = [["4 / 5", "with dated evidence"], ["2", "independently corroborated"], ["9d", "latest evidence"]];
const VALIDATE = [
  ["Northstar Logistics", "Is regional purchasing centralized at group level?"],
  ["FreshRoute Foods", "Do the new sites touch the target category?"],
  ["Vantage Freight Co.", "Is the RFI tied to a funded initiative?"],
];
const strong = (v: string) => `<b style="color:${v === "Strong" ? C.ink : v === "Moderate" ? C.ink2 : C.muted}">${v}</b>`;

function clientHeader(compact = false): string {
  return `<div class="cc-head">
    <div class="cc-brandline"><span class="cc-logo">Lead<span style="color:${C.intel}">Lens</span></span><span class="cc-kick">Account Opportunity Intelligence</span></div>
    <h1 class="cc-client">${CLIENT.name}</h1>
    <div class="cc-objwrap">
      <div class="cc-obj"><span class="cc-objk">Objective</span> ${CLIENT.objective}</div>
      ${compact ? "" : `<div class="cc-metarow"><span>${CLIENT.market}</span><span class="cc-dot2">·</span><span><b>${CLIENT.evaluated}</b> opportunities evaluated</span><span class="cc-dot2">·</span><span>${CLIENT.generated}</span></div>`}
    </div>
  </div>`;
}
function oppTile(o: typeof OPPS[number], focus = false): string {
  return `<div class="cc-opp${focus ? " cc-opp-focus" : ""}">
    <div class="cc-opp-top">
      <span class="cc-rank">${o.rank}</span>
      <span class="cc-opp-name">${o.name}</span>
      <span class="cc-pill" style="color:${DOT[o.dec]};border-color:${DOT[o.dec]}33;background:${DOT[o.dec]}0f"><span class="cc-pdot" style="background:${DOT[o.dec]}"></span>${o.dec}</span>
    </div>
    <div class="cc-opp-type">${o.type}</div>
    <div class="cc-opp-ftE"><span>Fit ${strong(o.fit)}</span><span>Timing ${strong(o.timing)}</span><span>Evidence ${strong(o.evid)}</span></div>
    <div class="cc-opp-chg"><span class="cc-chgdot"></span>${o.changed}${o.fresh !== "—" ? `<span class="cc-fresh">${o.fresh}</span>` : ""}</div>
  </div>`;
}
const leadRead = `<div class="cc-read"><div class="cc-read-k">LeadLens Read</div><p class="cc-read-t">${READ}</p></div>`;
const changing = `<div class="cc-zk">What's changing</div><ul class="cc-list">${PATTERNS.map((p) => `<li>${p}</li>`).join("")}</ul>`;
const coverage = `<div class="cc-zk">Evidence coverage</div><div class="cc-cov">${COVERAGE.map(([n, l]) => `<div><span class="cc-covn">${n}</span><span class="cc-covl">${l}</span></div>`).join("")}</div>`;
const validate = `<div class="cc-zk">What to validate</div><ul class="cc-vlist">${VALIDATE.map(([a, q]) => `<li><span class="cc-va">${a}</span><span class="cc-vq">${q}</span></li>`).join("")}</ul>`;

function pilotC(): string {
  // Structured Client Canvas: header → LeadLens Read → [Where to Focus (2/3) | supporting (1/3)]
  return `<div class="cc-canvas">
    ${clientHeader()}
    ${leadRead}
    <div class="cc-body cc-bodyC">
      <div class="cc-focus">
        <div class="cc-zk cc-zk-lg">Where to focus <span class="cc-zk-sub">· Opportunity landscape</span></div>
        <div class="cc-opps">${OPPS.map((o, i) => oppTile(o, i === 0)).join("")}</div>
      </div>
      <aside class="cc-side">
        <div class="cc-scard">${changing}</div>
        <div class="cc-scard">${coverage}</div>
        <div class="cc-scard cc-scard-amber">${validate}</div>
      </aside>
    </div>
  </div>`;
}
function pilotD(): string {
  // Opportunity Landscape Canvas: header → objective band → zones (focus + market / evidence + validate) → LeadLens Read closure
  return `<div class="cc-canvas">
    ${clientHeader(true)}
    <div class="cc-gridD">
      <div class="cc-zone cc-zone-focus">
        <div class="cc-zk cc-zk-lg">Where to focus</div>
        <div class="cc-opps">${OPPS.map((o, i) => oppTile(o, i === 0)).join("")}</div>
      </div>
      <div class="cc-zone">${changing}</div>
      <div class="cc-zone">${coverage}</div>
      <div class="cc-zone cc-zone-amber">${validate}</div>
    </div>
    ${leadRead}
  </div>`;
}

const CSS = `
*{box-sizing:border-box}body{margin:0;background:${C.bg};color:${C.ink};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:26px 20px 60px}
.tag{font-size:12px;color:${C.muted};margin:0 2px 14px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.cc-canvas{background:${C.surface};border:1px solid ${C.border};border-top:3px solid ${C.navy};border-radius:10px;padding:26px 30px 30px;box-shadow:0 10px 40px rgba(15,23,42,.06)}
/* client header */
.cc-brandline{display:flex;align-items:baseline;gap:12px;margin-bottom:14px}
.cc-logo{font-size:15px;font-weight:800;color:${C.navy}}
.cc-kick{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${C.muted}}
.cc-client{font-size:34px;font-weight:800;letter-spacing:-.025em;color:${C.navy};margin:0}
.cc-objwrap{margin-top:10px}
.cc-obj{font-size:14.5px;color:${C.ink2};line-height:1.5;max-width:48rem}
.cc-objk{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:${C.intel};margin-right:8px}
.cc-metarow{display:flex;gap:8px;flex-wrap:wrap;font-size:12px;color:${C.muted};margin-top:8px}
.cc-metarow b{color:${C.ink2}}
.cc-dot2{color:${C.border}}
/* LeadLens Read */
.cc-read{margin:22px 0 20px;padding:2px 0 2px 18px;border-left:3px solid ${C.intel}}
.cc-read-k{font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:${C.intel};margin-bottom:6px}
.cc-read-t{font-size:16px;line-height:1.55;color:${C.ink};margin:0;max-width:52rem;font-weight:450}
/* body layouts */
.cc-bodyC{display:grid;grid-template-columns:1.9fr 1fr;gap:26px;align-items:start}
.cc-zk{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};margin:0 0 12px}
.cc-zk-lg{font-size:12px;color:${C.ink}}
.cc-zk-sub{color:${C.muted};font-weight:700}
.cc-opps{display:flex;flex-direction:column;gap:10px}
/* opportunity tiles */
.cc-opp{border:1px solid ${C.border};border-radius:10px;padding:13px 15px;background:${C.surface};transition:border-color .15s}
.cc-opp-focus{border-color:${C.intel}55;background:linear-gradient(180deg,${C.intelSoft}55,#fff 60%)}
.cc-opp-top{display:flex;align-items:center;gap:10px}
.cc-rank{font-size:12px;font-weight:800;color:${C.muted};width:16px;flex-shrink:0}
.cc-opp-focus .cc-rank{color:${C.intel}}
.cc-opp-name{font-size:15.5px;font-weight:800;color:${C.ink};letter-spacing:-.01em;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cc-pill{display:inline-flex;align-items:center;gap:5px;border:1px solid;border-radius:999px;padding:2px 10px;font-size:10.5px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;white-space:nowrap}
.cc-pdot{width:6px;height:6px;border-radius:50%}
.cc-opp-type{font-size:11.5px;color:${C.muted};margin:3px 0 0;padding-left:26px;font-weight:600}
.cc-opp-ftE{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;color:${C.ink2};margin:9px 0 0;padding-left:26px}
.cc-opp-chg{display:flex;align-items:center;gap:8px;font-size:12.5px;color:${C.ink2};margin:9px 0 0;padding-left:26px}
.cc-chgdot{width:6px;height:6px;border-radius:50%;background:${C.accent};flex-shrink:0}
.cc-fresh{font-size:11px;color:${C.muted};margin-left:auto;font-weight:600}
/* supporting column / zones */
.cc-side{display:flex;flex-direction:column;gap:14px}
.cc-scard{border:1px solid ${C.border};border-radius:10px;padding:15px 16px;background:${C.surfaceAlt}}
.cc-scard-amber{background:${C.amberBg};border-color:${C.amberBorder}}
.cc-list{margin:0;padding-left:16px;font-size:12.5px;color:${C.ink2};line-height:1.6}
.cc-cov{display:flex;gap:20px;flex-wrap:wrap}
.cc-covn{display:block;font-size:20px;font-weight:800;color:${C.evidence}}
.cc-covl{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:${C.muted};font-weight:700}
.cc-vlist{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:9px}
.cc-vlist li{display:flex;flex-direction:column;gap:1px}
.cc-va{font-size:11px;font-weight:800;color:${C.amber}}
.cc-vq{font-size:12.5px;color:${C.ink};line-height:1.4}
/* Pilot D grid */
.cc-gridD{display:grid;grid-template-columns:1.7fr 1fr;grid-auto-rows:min-content;gap:16px;margin:18px 0}
.cc-zone{border:1px solid ${C.border};border-radius:10px;padding:16px 18px;background:${C.surfaceAlt}}
.cc-zone-focus{grid-row:span 2;background:${C.surface}}
.cc-zone-amber{background:${C.amberBg};border-color:${C.amberBorder}}
@media(max-width:1023px){.cc-bodyC,.cc-gridD{grid-template-columns:1fr}.cc-zone-focus{grid-row:auto}}
@media(max-width:560px){.cc-canvas{padding:20px 16px}.cc-client{font-size:26px}}
`;
function page(v: "C" | "D"): string {
  const body = v === "C" ? pilotC() : pilotD();
  const label = v === "C" ? "Pilot C — Structured Client Canvas (Where-to-Focus dominant + supporting column)" : "Pilot D — Opportunity Landscape Canvas (spatial zones)";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LeadLens Client Opportunity Canvas — Pilot ${v}</title><style>${CSS}</style></head><body><div class="wrap"><div class="tag">${label}</div>${body}</div></body></html>`;
}
const dir = path.join(process.cwd(), "output", "pilots");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "client-canvas-pilot-c.html"), page("C"), "utf8");
writeFileSync(path.join(dir, "client-canvas-pilot-d.html"), page("D"), "utf8");
console.log("✅ Client Canvas pilots → output/pilots/client-canvas-pilot-c.html and client-canvas-pilot-d.html");
