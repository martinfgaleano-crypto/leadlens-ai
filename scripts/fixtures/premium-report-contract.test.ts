// Unit tests: premium-intelligence-contract (assembly, required fields, honesty).
import { assemblePremiumReport, toRecommendation } from "@/lib/reports/premium-intelligence-contract";
import { classifyBuyerSegment, computeStructuralScores, selectAccounts, buildMarketLandscape, type RankedAccount } from "@/lib/discovery/market-to-account";
let p = 0, f = 0; const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

const mk = (name: string, sector: string, vis: string, base: number): RankedAccount => { const seg = classifyBuyerSegment(name, sector); return { company: name, domain: name.length % 2 ? `${name.replace(/\s/g,"").toLowerCase()}.com` : null, sector, visibility: vis, segment: seg, scores: computeStructuralScores({ segment: seg, visibility: vis as never, hasDomain: true, baseScore: base, daysOld: null, corroboration: "low", isChannelOnly: true }) }; };
const universe = [mk("Ser Saludable", "tienda saludable", "emerging", 72), mk("Luna Verde", "tienda natural", "emerging", 61), mk("GHL Hoteles", "hotel", "obvious", 69), mk("Spa Zen", "spa", "emerging", 55), mk("Distrialimentos", "distribuidor", "emerging", 58)];
const shortlist = selectAccounts(universe, 4, 2);
const landscape = buildMarketLandscape(universe, { shortlisted: shortlist.length, validation_candidates: 1, dynamic_opportunities: 0 });
const candidates = [{ company: "GHL Hoteles", domain: "ghlhoteles.com", date: null, corroboration: "low", fact: "informe sostenibilidad 2024", verdict: "investigar", org_type: "private_company", materiality: "medium" }];

const rep = assemblePremiumReport({
  metadata: { client_name: "Amor de Gea", client_description: "Marca de bienestar", offering: "infusiones y botánicos", target_market: "Bienestar", region: "Cali · Valle del Cauca" },
  landscape, ranked: universe, candidates, manifest: { operating_mode: "full_discovery", delivery_decision: "do_not_deliver", status: "insufficient_dynamic_opportunities", ran_at: "2026-07-24T18:00:00Z", dynamic_opportunity_count: 0 }, shortlist,
});

// Required top-level sections
for (const k of ["metadata", "executive_brief", "market_landscape", "company_universe", "structural_ranking", "dossiers", "portfolio_strategy", "evidence_quality", "methodology", "delivery"] as const)
  t(`sección presente: ${k}`, (rep as any)[k] != null);

// Separate dimensions (not one score)
const acc = rep.structural_ranking[0];
t("dimensiones separadas (fit/timing/evidence distintos campos)", !!acc.market_fit && !!acc.opportunity_timing && !!acc.evidence_strength && !!acc.commercial_accessibility && !!acc.strategic_value);
t("cada dimensión tiene explicación + confianza", !!acc.market_fit.explanation && !!acc.market_fit.confidence);
t("timing bajo marca missing_info", rep.structural_ranking.some(a => a.opportunity_timing.score < 40 && a.opportunity_timing.missing_info));

// Honesty gate: channel-only never act_now
t("NINGUNA cuenta channel-only → act_now", rep.structural_ranking.every(a => a.recommendation !== "act_now"));
t("toRecommendation: channel-only nunca act_now", toRecommendation("act_now", 90, 90, true) !== "act_now");
t("toRecommendation: fit+timing+evidence reales → act_now", toRecommendation("act_now", 80, 70, false) === "act_now");

// Universe + dossiers + delivery honesty
t("company_universe cubre todo el universo", rep.company_universe.length === universe.length);
t("dossiers = shortlist", rep.dossiers.length === shortlist.length);
t("dossier sin evidencia/dominio → complete=false", rep.dossiers.some(d => !d.complete));
t("delivery do_not_deliver cuando 0 dynamic", rep.delivery.decision === "do_not_deliver");
t("delivery headline sin código técnico crudo", !/insufficient_dynamic|harness|provider/i.test(rep.delivery.headline));
t("evidence_quality cuenta undated", rep.evidence_quality.undated >= 1);
t("methodology separa hecho vs inferencia", !!rep.methodology.facts_vs_inference);

console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
