// ─── Provider-limited deep-pipeline validation ───────────────────────────────
// When ALL search providers are exhausted (2026-07-22: Anthropic usage-limit,
// Brave 402, Serper no-credits, Tavily 432; only Firecrawl+Supabase alive),
// this harness validates the FULL deep-validation gate sequence on REAL
// evidence WITHOUT search: direct corporate newsrooms (fresh_extraction via
// Firecrawl/Tavily-extract fallback chain) + previously discovered URLs with
// provenance (reused_verified_evidence). Every candidate is labeled with its
// evidence origin; the run is labeled provider_limited. Nothing here fakes a
// fresh search or full coverage — it proves the intelligence layer E2E.
// Run: npx tsx scripts/sources/provider-limited-validation.ts
// Output: ml/data/company-first/provider-limited-<ts>.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
for (const f of [".env", ".env.local"]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
import { extractWithFallback } from "@/lib/sources/access/extractors";
import { resolvePublicationDate } from "@/lib/sources/access/date-resolver";
import { classifySignalKind } from "@/lib/discovery/event-vs-metric";
import { classifyMateriality } from "@/lib/discovery/materiality";
import { classifyOrganization } from "@/lib/discovery/organization-type";
import { assessEntityRole } from "@/lib/discovery/entity-role";
import { classifyDirection } from "@/lib/discovery/sentiment";
import { assessCommercialFit, requiredOperationTerms } from "@/lib/discovery/commercial-fit";
import { assessCounterevidence, applyCounterevidence } from "@/lib/discovery/counterevidence";
import { adversarialReview } from "@/lib/discovery/adversarial-review";
import { scoreOpportunityV2, corroborationTier } from "@/lib/discovery/quality-rubric";
import { companyNameInText } from "@/lib/discovery/company-first-discovery";
import { nameDomainMatch } from "@/lib/discovery/corporate-identity";
import { VERTICAL_PACKS, packNeedsMap } from "@/lib/discovery/vertical-packs";
import type { ICP, LeadSearchCriteria } from "@/types";

// Evidence set: corporate newsrooms verified alive by HTTP (fresh_extraction,
// PRIMARY corporate sources) + one previously discovered third-party page with
// provenance (reused_verified_evidence, found via Serper probe 2026-07-21).
const EVIDENCE: Array<{ company: string; domain: string; url: string; origin: "fresh_extraction" | "reused_verified_evidence"; source_kind: "primary_corporate" | "third_party" }> = [
  { company: "Coordinadora", domain: "coordinadora.com", url: "https://coordinadora.com/blog/", origin: "fresh_extraction", source_kind: "primary_corporate" },
  { company: "TCC", domain: "tcc.com.co", url: "https://tcc.com.co/blog/", origin: "fresh_extraction", source_kind: "primary_corporate" },
  { company: "Colombina", domain: "colombina.com", url: "https://colombina.com/es/noticias", origin: "fresh_extraction", source_kind: "primary_corporate" },
  { company: "Olímpica", domain: "olimpica.com", url: "https://olimpica.com/noticias", origin: "fresh_extraction", source_kind: "primary_corporate" },
  { company: "Falabella de Colombia", domain: "falabella.com.co", url: "https://www.rcrindustrialflooring.com/es/proyectos/cedi-falabella-cota", origin: "reused_verified_evidence", source_kind: "third_party" },
];

const icp: ICP = { target_industries: ["operadores logísticos y retail con centros de distribución"], target_titles: [], company_size_range: "mediana-grande", pain_points: ["capacidad de bodega", "eficiencia de picking"], disqualifiers: ["entidades públicas", "medios"], ideal_signals: ["nuevo centro de distribución", "ampliación de capacidad", "automatización"] };
const criteria = { target_industries: icp.target_industries, target_geography: ["Colombia"], target_market_region: "latin_america", output_language: "es", target_company_size: ["mediana", "grande"], buying_signals: ["nuevo centro de distribución", "ampliación de bodegas", "automatización", "inversión en supply chain"], disqualification_criteria: ["entidades públicas", "medios", "directorios"], offer_summary: "automatización de bodegas y software logístico", value_proposition: "aumenta capacidad y eficiencia del centro de distribución", target_job_titles: [] } as unknown as LeadSearchCriteria;

async function main() {
  const pack = VERTICAL_PACKS.find((p) => p.id === "logistics_automation")!;
  const needs = packNeedsMap(pack, icp, criteria);
  const opTerms = requiredOperationTerms(needs);
  const productTerms = ["automatización", "bodegas", "logístico", "capacidad", "eficiencia", "inventario"];
  const results: unknown[] = [];
  let extractions = 0, ok = 0;

  for (const ev of EVIDENCE) {
    console.log(`\n═══ ${ev.company} [${ev.origin}/${ev.source_kind}] ${ev.url}`);
    const ext = await extractWithFallback(ev.url).catch((e) => ({ ok: false as const, content: "", extractor: "none", fallback_used: false, error: String(e) }));
    extractions++;
    const content = (ext.content ?? "").slice(0, 20_000);
    if (!ext.ok || content.length < 200) { console.log("  extracción falló — sin evidencia utilizable (honesto: se descarta)"); results.push({ ...ev, outcome: "extraction_failed" }); continue; }
    ok++;
    const hay = content.toLowerCase();
    const resolved = resolvePublicationDate({ provider_date: null, html: content, url: ev.url });
    const org = classifyOrganization({ name: ev.company });
    const idScore = Math.min(85, nameDomainMatch(ev.company, ev.domain));
    const assoc = companyNameInText(ev.company, content);
    const sig = classifySignalKind(hay);
    const role = assessEntityRole(ev.company, hay);
    const dir = classifyDirection(hay, {});
    const mat = classifyMateriality(hay);
    const fit = assessCommercialFit({ needs, company: ev.company, sector: null, content: hay, event_keyword: mat.matched, disqualifiers: criteria.disqualification_criteria ?? [], product_terms: productTerms, required_operation_terms: opTerms });
    const daysOld = resolved.date ? Math.round((Date.now() - new Date(resolved.date).getTime()) / 86_400_000) : null;
    const corr = corroborationTier(ev.source_kind === "third_party" ? 1 : 0, ev.source_kind === "primary_corporate", idScore);
    const isTrigger = sig.kind === "corporate_event" || sig.kind === "operational_change" || sig.kind === "strategic_decision";
    const rub = scoreOpportunityV2({ corporate_identity_confidence: idScore, icp_fit_score: fit.score, operational_fit: fit.operational_fit, signal_association_ok: assoc && role.is_account, materiality: mat.level, corroboration: corr, causal_thesis_specific: isTrigger && mat.level !== "low", days_old: daysOld, has_next_step: true, hard_blockers: fit.hard_blockers });
    const ce = assessCounterevidence({ content: hay, event_summary: content.slice(0, 120), days_old: daysOld, operational_fit: fit.operational_fit, corroboration: corr });
    const adj = applyCounterevidence(rub.verdict, rub.score, ce);
    const adv = adversarialReview({ company: ev.company, identity_confidence: idScore, domain: ev.domain, organization_eligible: org.eligible_for_icp, entity_role_is_account: role.is_account, signal_association_ok: assoc && role.is_account, materiality: mat.level, operational_fit: fit.operational_fit, commercial_fit_score: fit.score, causal_thesis_specific: isTrigger && mat.level !== "low", corroboration: corr, days_old: daysOld, has_next_step: true, counterevidence: ce, generator_verdict: adj.verdict });
    const row = {
      ...ev, run_mode: "provider_limited",
      extractor: ext.extractor, date: resolved.date, date_source: resolved.date_source, days_old: daysOld,
      org_type: org.organization_type, org_eligible: org.eligible_for_icp,
      identity_confidence: idScore, association_word_boundary: assoc,
      signal_kind: sig.kind, signal_matched: sig.matched, entity_role: role.role, is_account: role.is_account,
      direction: dir.direction, materiality: mat.level, materiality_matched: mat.matched,
      commercial_fit: fit.score, operational_fit: fit.operational_fit, hard_blockers: fit.hard_blockers,
      corroboration: corr, rubric_score: adj.score, generator_verdict: adj.verdict,
      counterevidence: ce.counterevidence, thesis_risk: ce.thesis_risk, unresolved: ce.unresolved_questions.slice(0, 2),
      adversarial: adv.verdict, adversarial_objections: adv.objections.slice(0, 3),
      final: adv.verdict === "reject" ? "rechazar" : adj.verdict,
    };
    results.push(row);
    console.log(`  fecha=${row.date ?? "?"} (${row.date_source}) · ${row.signal_kind} · rol=${row.entity_role} · mat=${row.materiality} · fit=${row.commercial_fit}(op:${row.operational_fit}) · corr=${row.corroboration}`);
    console.log(`  rubric=${row.rubric_score} → ${row.generator_verdict} · adversarial=${row.adversarial} → FINAL: ${row.final}${row.hard_blockers.length ? ` · blockers=${row.hard_blockers.join(",")}` : ""}`);
  }

  mkdirSync("ml/data/company-first", { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  writeFileSync(`ml/data/company-first/provider-limited-${stamp}.json`, JSON.stringify({ run_mode: "provider_limited", providers_down: ["anthropic", "brave", "serper", "tavily"], ran_at: new Date().toISOString(), icp: "logistics_automation", extractions, extraction_ok: ok, results }, null, 2));
  console.log(`\nwritten: ml/data/company-first/provider-limited-${stamp}.json (extracciones ${ok}/${extractions})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
