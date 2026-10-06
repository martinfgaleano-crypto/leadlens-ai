#!/usr/bin/env node
/**
 * Bounded MRU closure render (cost $0, NO re-research, NO decision change).
 *
 * Renders the four V2.4 tiers from the LATEST VALID CANONICAL Pilot 2 foundation
 * (the 6-account customer job, decisions already baked in) with the canonical
 * Market Research Universe attached to `reportJson.market_research_universe` so
 * the Premium tier surfaces the independently-researched market layer.
 *
 * It does NOT re-derive decisions, re-run eligibility, promote, fill capacity or
 * manufacture corroboration — research truth is shown exactly as persisted. The
 * SELECTED portfolio (6 accounts) and the RESEARCHED MARKET UNIVERSE remain
 * distinct populations.
 *
 * The Pilot-2-specific input/output paths live HERE (operational script); the
 * production wiring (institutional-assembler → canonical-intelligence-delivery →
 * tier-composer → presentation-model → renderer) carries any report's MRU
 * generically.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { loadEnv } from "./lib/load-env.mjs";
Object.assign(process.env, loadEnv(process.cwd()));

const SRC = process.env.PILOT2_MRU_SRC || "output/pilot2/2026-09-30-account18-market-v2";
const MRU_PATH = process.env.PILOT2_MRU_PATH || "output/pilot2/2026-09-30-market-universe-v2/market-research-universe.json";
const OUT = process.env.PILOT2_MRU_OUT || "output/pilot2/2026-10-03-mru-closure";
const SUFFIX = process.env.PILOT2_FILE_SUFFIX || ""; // e.g. "_FINAL" for the closure directory
mkdirSync(OUT, { recursive: true });

const { assembleInstitutionalReport } = await import("@/lib/reports/institutional-assembler");
const { fromInstitutionalReport } = await import("@/lib/deliverable/adapters");
const { fromDeliverableViewModel } = await import("@/lib/delivery-system/delivery-document");
const { toPresentationModel } = await import("@/lib/delivery-system/presentation-model");
const { renderPdfBuffer } = await import("@/lib/delivery-system/renderers/pdf");
const { resolveReportExperience } = await import("@/lib/products/report-experience");
const { premiumContextFromEnvelope } = await import("@/lib/intelligence/premium/premium-production");
const { validateMarketResearchUniverse } = await import("@/lib/intelligence/market-research-universe");

const merged = JSON.parse(readFileSync(`${SRC}/pilot2-merged-report.json`, "utf8"));
const reportJson: any = merged.reportJson;
const meta = merged.meta;

// Attach the canonical Market Research Universe (validated, read-only) to the
// report. This is the ONLY mutation of the foundation; decisions are untouched.
const mru = JSON.parse(readFileSync(MRU_PATH, "utf8"));
const mruErrors = validateMarketResearchUniverse(mru);
if (mruErrors.length) throw new Error(`MRU failed validation: ${mruErrors.join("; ")}`);
reportJson.market_research_universe = mru;
console.log(`MRU attached: ${mru.universe_id} (sources=${mru.market_sources.length}, routes=${mru.route_research.length}, mechanisms_verified=${mru.coverage.mechanisms_verified}, access_verified=${mru.coverage.access_verified})`);

const premiumContext = premiumContextFromEnvelope(reportJson._premium_context);

const institutional = assembleInstitutionalReport(reportJson, meta);
const intel: any = institutional.intelligence;
console.log(`institutional dossiers: ${institutional.account_dossiers.length}`);
console.log(`intelligence.market_research_universe present: ${Boolean(intel?.market_research_universe)}`);

const capacity: Record<string, number> = { Preview: 2, Brief: 6, Portfolio: 12, Premium: 18 };
const TIERS: Array<[string, string, string]> = [
  ["preview", "Preview", "preview_launch_v0"],
  ["brief", "Brief", "brief_launch_v0"],
  ["intelligence", "Portfolio", "intelligence_launch_v0"],
  ["premium", "Premium", "premium_launch_v0"],
];

function countPages(buf: Buffer): number {
  // Count PDF page objects ("/Type /Page" but not "/Type /Pages").
  const s = buf.toString("latin1");
  const m = s.match(/\/Type\s*\/Page(?![s])/g);
  return m ? m.length : 0;
}

const rows: any[] = [];
for (const [tier, label, code] of TIERS) {
  const experience = resolveReportExperience(code, "en");
  const vm = fromInstitutionalReport(institutional, experience);
  const doc = { ...fromDeliverableViewModel(vm), premiumContext: tier === "premium" ? premiumContext : null };
  const pm = toPresentationModel(doc as any, tier as any, "pdf");
  const scoped: any = (pm as any).document?.intelligence ?? null;
  const ev = scoped?.evidence_coverage ?? null;
  const pdf = await renderPdfBuffer(pm as any);
  const pdfPath = `${OUT}/LeadLens_AmorDeGea_Pilot2_${label}${SUFFIX}.pdf`;
  writeFileSync(pdfPath, pdf);
  const accounts = (pm as any).document?.accounts?.length ?? 0;
  const dist: Record<string, number> = { prioritize: 0, validate: 0, monitor: 0, hold: 0 };
  for (const a of (pm as any).document?.accounts ?? []) dist[a.decision] = (dist[a.decision] ?? 0) + 1;
  const row = {
    tier, label, pdf: pdfPath, bytes: pdf.length, pages: countPages(pdf),
    selected: accounts, capacity: capacity[label],
    decisions: dist,
    sourced: ev ? `${ev.usable_source}/${ev.denominator}` : "n/a",
    dated: ev ? `${ev.validated_date}/${ev.denominator}` : "n/a",
    commercial_mechanism: ev ? `${ev.commercial_mechanism}/${ev.denominator}` : "n/a",
    verified_access: ev ? `${ev.verified_access}/${ev.denominator}` : "n/a",
    corroborated: ev ? `${ev.corroborated}/${ev.denominator}` : "n/a",
    mru_in_tier: Boolean(scoped?.market_research_universe),
    mru_market_verified_mechanisms: scoped?.market_research_universe?.coverage?.mechanisms_verified ?? null,
    mru_market_verified_access: scoped?.market_research_universe?.coverage?.access_verified ?? null,
  };
  rows.push(row);
  console.log(`ok ${label.padEnd(10)} selected=${accounts}/${capacity[label]} bytes=${pdf.length} pages=${row.pages} mru_in_tier=${row.mru_in_tier} dist=${JSON.stringify(dist)}`);
}
writeFileSync(`${OUT}/closure-metrics.json`, JSON.stringify({
  generated_at: new Date().toISOString(),
  source_foundation: SRC,
  mru_source: MRU_PATH,
  mru_universe_id: mru.universe_id,
  mru_coverage: mru.coverage,
  selected_portfolio_population: institutional.account_dossiers.length,
  market_research_universe_population: mru.population?.population_size ?? null,
  tiers: rows,
}, null, 2));
console.log(`\nwrote ${OUT}/closure-metrics.json`);

// Reproducibility: copy the canonical report JSON + the Market Research Universe
// artifact into the closure directory so the four PDFs can be regenerated from it.
try {
  copyFileSync(`${SRC}/pilot2-merged-report.json`, `${OUT}/canonical-report.json`);
  copyFileSync(MRU_PATH, `${OUT}/market-research-universe.json`);
  console.log(`copied canonical report + MRU into ${OUT}`);
} catch (e) { console.log("artifact copy skipped:", e instanceof Error ? e.message : e); }
console.log("done");
