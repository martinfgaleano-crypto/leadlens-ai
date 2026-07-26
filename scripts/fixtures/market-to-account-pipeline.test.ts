// Unit tests: market-to-account-pipeline-v1 (staged, deterministic, reason codes).
import { runStagedPipeline, type StageExecutors, type VerifiedCompany, type DeepResearchResult } from "@/lib/discovery/market-to-account-pipeline";
let p = 0, f = 0; const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

// Deterministic stub universe: retail (high fit), hotel, spa, a distributor, plus
// a non-verified junk name, plus a low-fit-but-"recent" account.
const universe: VerifiedCompany[] = [
  { company: "Ser Saludable", sector: "tienda saludable", domain: "sersaludable.com", visibility: "emerging", baseScore: 78, verified: true },
  { company: "Luna Verde", sector: "tienda natural", domain: "lunaverde.com", visibility: "emerging", baseScore: 62, verified: true },
  { company: "GHL Hoteles", sector: "hotel", domain: "ghlhoteles.com", visibility: "obvious", baseScore: 69, verified: true },
  { company: "Spa Zen", sector: "spa wellness", domain: "spazen.com", visibility: "emerging", baseScore: 55, verified: true },
  { company: "Distrinaturales", sector: "distribuidor productos naturales", domain: "distrinaturales.com", visibility: "emerging", baseScore: 60, verified: true },
  { company: "Basura SA", sector: "directorio", domain: null, visibility: "unknown", baseScore: 20, verified: false },
];
const stub = (deep?: DeepResearchResult[]): StageExecutors => ({
  discoverAndVerify: async () => universe,
  deepResearch: deep ? async (sl) => deep.filter(d => sl.some(a => a.company === d.company)) : undefined,
  now: (() => { let n = 0; return () => (n += 5); })(),
  costOf: (s) => (s === "discover_verify" ? 0.1 : 0.01),
});

(async () => {
  const art = await runStagedPipeline({ offering: "infusiones y botánicos de bienestar", region: "Valle del Cauca", shortlist_size: 4, per_segment_cap: 2 }, stub());

  // Stages present
  t("etapa segments poblada", art.segments.length >= 3);
  t("queries_by_segment por segmento", Object.keys(art.queries_by_segment).length === art.segments.length && art.queries_by_segment[art.segments[0]].length > 0);
  t("discovered=6, verified=5, classified=5", art.discovered_companies === 6 && art.verified_companies === 5 && art.classified_companies === 5);

  // Structural ranking: separate scores; high fit + low timing (no deep research)
  const ser = art.structural_ranking.find(a => a.company === "Ser Saludable")!;
  t("high fit + low timing (sin deep research)", ser.scores.fit >= 60 && ser.scores.timing < 40);
  t("scores separados (fit≠timing)", ser.scores.fit !== ser.scores.timing);
  t("channel-only nunca act_now en ranking", art.structural_ranking.every(a => a.scores.actionability !== "act_now"));

  // Shortlist deterministic + diverse
  t("shortlist ≤ tamaño pedido", art.shortlist.length <= 4);
  t("shortlist diversa (≥2 segmentos)", new Set(art.shortlist.map(a => a.segment.primarySegment)).size >= 2);

  // Deep research only on shortlist + honest incomplete when not run
  t("deep_research requested = shortlist", art.deep_research_status.requested === art.shortlist.length);
  t("sin deepResearch → todos incomplete", art.deep_research_status.incomplete === art.shortlist.length && art.deep_research_status.complete === 0);

  // Reason codes
  t("Basura SA → excluded_from_universe", (art.reason_codes["Basura SA"] ?? []).includes("excluded_from_universe"));
  t("verificadas → included_in_universe", (art.reason_codes["Ser Saludable"] ?? []).includes("included_in_universe"));
  t("shortlisted / not_shortlisted marcados", Object.values(art.reason_codes).some(v => v.includes("shortlisted")) && Object.values(art.reason_codes).some(v => v.includes("not_shortlisted")));
  t("no_current_timing en shortlist sin timing", art.shortlist.every(a => (art.reason_codes[a.company] ?? []).includes("no_current_timing")));
  t("insufficient_evidence cuando corroboración débil", art.shortlist.some(a => (art.reason_codes[a.company] ?? []).includes("insufficient_evidence")));

  // Metrics per stage
  t("cost_by_stage poblado", (art.cost_by_stage["discover_verify"] ?? 0) > 0);
  t("duration_by_stage poblado", Object.keys(art.duration_by_stage).length >= 5);

  // Deep research provided for one account → complete + timing
  const art2 = await runStagedPipeline({ offering: "infusiones botánicas", region: "Valle del Cauca", shortlist_size: 4, per_segment_cap: 2 },
    stub([{ company: "Ser Saludable", complete: true, hasTiming: true, hasEvidence: true, daysOld: 30, corroboration: "medium", note: "apertura reciente" }]));
  t("deep research completa 1 cuenta", art2.deep_research_status.complete >= 1);
  t("signal_coverage cuenta timing", art2.signal_coverage.with_timing >= 1);
  t("evidence_coverage corroborated", art2.evidence_coverage.corroborated >= 1);

  // Deterministic replay: same inputs → identical structural ranking order
  const a = await runStagedPipeline({ offering: "infusiones botánicas", region: "Valle", shortlist_size: 4, per_segment_cap: 2 }, stub());
  const b = await runStagedPipeline({ offering: "infusiones botánicas", region: "Valle", shortlist_size: 4, per_segment_cap: 2 }, stub());
  t("replay determinista (ranking idéntico)", JSON.stringify(a.structural_ranking.map(x => x.company)) === JSON.stringify(b.structural_ranking.map(x => x.company)));
  t("replay determinista (shortlist idéntica)", JSON.stringify(a.shortlist.map(x => x.company)) === JSON.stringify(b.shortlist.map(x => x.company)));

  console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
})();
