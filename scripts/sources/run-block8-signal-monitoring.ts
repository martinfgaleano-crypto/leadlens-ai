// Block 8 controlled monitoring pass. Same six accounts; observation only.
// Caps: 6 accounts, 3 triggers/account, 3 queries/trigger, 30 total queries, 12 extracts.
import { loadEnvConfig } from "@next/env";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assessTimingV2, compareSignalObservations, createMonitoringRun, createMonitoringTrigger,
  normalizeSignalEvent, planMonitoringQueries, temporalOutput, transitionQualification,
  type EventStatus, type MonitoringTrigger, type SignalCategory, type SignalObservation,
} from "@/lib/intelligence/signal-temporal";
import { canonicalizeEvidence, type CanonicalEvidence } from "@/lib/intelligence/evidence-temporal";
import { assessEvidenceCandidate, buildResearchProfile, type EvidenceCandidate, type QualificationState } from "@/lib/intelligence/research-quality";
import { braveProvider, serperProvider, tavilyProvider } from "@/lib/sources/access/providers";
import type { SearchProvider } from "@/lib/sources/access/provider-contract";
import { extractWithFallback } from "@/lib/sources/access/extractors";
import { resolvePublicationDate } from "@/lib/sources/access/date-resolver";

loadEnvConfig(process.cwd());
const MAX_ACCOUNTS = 6, MAX_TRIGGERS_ACCOUNT = 3, MAX_QUERIES_TRIGGER = 3;
const MAX_QUERIES = 30, MAX_EXTRACTS = 12, MAX_RETRIES = 2, MAX_RESULTS = 5;
const MAX_COST_USD = Number(process.env.BLOCK8_MONITORING_MAX_USD ?? "1.5");
if (!Number.isFinite(MAX_COST_USD) || MAX_COST_USD <= 0 || MAX_COST_USD > 3) throw new Error("BLOCK8_MONITORING_MAX_USD must be > 0 and <= 3.");

const categoryFrom = (text: string): { category: SignalCategory; status: EventStatus } | null => {
  const s = text.toLowerCase();
  if (/\b(cancel|canceló|cancelada|cerró|cierre|clausur|liquidaci[oó]n|inactiv)/.test(s)) return { category: /cancel/.test(s) ? "cancelled_expansion" : "closure", status: /cancel/.test(s) ? "cancelled" : "completed" };
  if (/\b(nueva sede|nueva tienda|apertura|abri[oó]|inaugur|new location)\b/.test(s)) return { category: /abr[ií]o|inaugur/.test(s) ? "store_opening" : "new_location", status: /abr[ií]o|inaugur/.test(s) ? "completed" : "announced" };
  if (/\b(expansi[oó]n|expand|nuev[oa] mercado|nueva ciudad)\b/.test(s)) return { category: "geographic_expansion", status: /planea|proyect|anunci/.test(s) ? "planned" : "in_progress" };
  if (/\b(alianza|partnership|acuerdo de distribuci[oó]n|convenio)\b/.test(s)) return { category: /distribuci/.test(s) ? "distribution_agreement" : "partnership", status: "announced" };
  if (/\b(lanzamiento|nuevo producto|nueva l[ií]nea|ampl[ií]a.*portafolio)\b/.test(s)) return { category: "product_launch", status: "completed" };
  if (/\b(contratando|vacante|hiring|gerente de compras|jefe de compras)\b/.test(s)) return { category: /compras/.test(s) ? "procurement_hiring" : "expansion_hiring", status: "in_progress" };
  return null;
};

async function main() {
  const dir = join(process.cwd(), "ml/data/research-quality");
  const filename = readdirSync(dir).filter((f) => /^amor-de-gea-block7-.*\.json$/.test(f)).sort().at(-1);
  if (!filename) throw new Error("Block 7 baseline artifact unavailable.");
  const baseline = JSON.parse(readFileSync(join(dir, filename), "utf8")) as {
    generated_at?: string;
    accounts: Array<{
      account: string; domain: string;
      profile: { structural_score: number | null; segment: string | null; likely_language: string | null; known_aliases?: string[] };
      qualification: { state: QualificationState };
      dossier: { generated_at: string };
      evidence_decisions: Array<{ accepted: boolean; candidate: EvidenceCandidate; entity_confidence: number; source_tier: "A" | "B" | "C" | "D" }>;
    }>;
  };
  const accounts = baseline.accounts.slice(0, MAX_ACCOUNTS);
  if (accounts.length !== 6) throw new Error(`Expected six Block 7 accounts; found ${accounts.length}.`);
  const persistedBaselineCutoff = baseline.generated_at ?? accounts[0]?.dossier.generated_at;
  if (!persistedBaselineCutoff || !Number.isFinite(Date.parse(persistedBaselineCutoff))) throw new Error("Block 7 persisted baseline cutoff is unavailable.");
  const sourceCutoff = new Date().toISOString();
  const run = createMonitoringRun({ client_id: "amor-de-gea", source_cutoff: sourceCutoff, baseline_cutoff: persistedBaselineCutoff, requested_from: persistedBaselineCutoff, query_cap: MAX_QUERIES, extraction_cap: MAX_EXTRACTS, trigger_cap_per_account: MAX_TRIGGERS_ACCOUNT });
  run.status = "running";
  const providers = [serperProvider, braveProvider, tavilyProvider];
  const health = await Promise.all(providers.map(async (provider) => ({ provider, health: await provider.health() })));
  const available = health.filter((x) => x.health.status === "available").map((x) => x.provider);
  if (!available.length) throw new Error(`No provider available: ${health.map((x) => `${x.provider.id}:${x.health.reason}`).join("; ")}`);
  let queriesExecuted = 0, extracts = 0, retries = 0, measuredCost = 0, costCalls = 0;
  const contribution: Record<string, { calls: number; results: number; errors: number }> = {};
  const execute = async (query: string, freshnessDays: number, preferred: SearchProvider) => {
    if (queriesExecuted >= MAX_QUERIES) return { results: [] as EvidenceCandidate[], error: "query_budget_exhausted", provider: "none" };
    let chosen = preferred;
    const call = async (p: SearchProvider) => {
      const stats = (contribution[p.id] ??= { calls: 0, results: 0, errors: 0 });
      const response = await p.search({ query, region: "co", language: "es", max_results: MAX_RESULTS, query_type: "signal_specific", freshness_days: freshnessDays });
      queriesExecuted++; stats.calls++; stats.results += response.results.length; if (!response.ok) stats.errors++;
      if (response.cost_estimate_usd != null) { measuredCost += response.cost_estimate_usd; costCalls++; }
      return response;
    };
    let response = await call(chosen);
    if (!response.ok && retries < MAX_RETRIES && queriesExecuted < MAX_QUERIES) {
      const fallback = available.find((p) => p.id !== chosen.id);
      if (fallback) { retries++; chosen = fallback; response = await call(chosen); }
    }
    return {
      results: response.results.map((r) => ({
        url: r.url, canonical_url: r.canonical_url, title: r.title, excerpt: r.snippet, provider: r.provider,
        source_type: r.source_type, publication_date: r.published_date, retrieved_at: r.retrieved_at,
      })), error: response.ok ? null : response.error ?? "provider_error", provider: chosen.id,
    };
  };
  const results: Array<Record<string, unknown>> = [];
  for (const account of accounts) {
    const baselineCutoff = account.dossier.generated_at || persistedBaselineCutoff;
    const requested: Array<{ category: SignalCategory; statement: string; why: string }> = [
      { category: "new_location", statement: "Detectar apertura o expansión física verificable.", why: "Puede crear una ventana comercial concreta." },
      { category: "distribution_agreement", statement: "Detectar nueva distribución, alianza o canal comprador.", why: "Puede ampliar acceso comercial para Amor de Gea." },
    ];
    const triggers = requested.map((x) => createMonitoringTrigger({
      account_id: account.domain, client_id: "amor-de-gea", category: x.category, statement: x.statement,
      baseline: baselineCutoff, why: x.why, created_at: sourceCutoff, verified_name: account.account,
      verified_domain: account.domain, priority: "high",
    })).filter((x): x is MonitoringTrigger => !!x).slice(0, MAX_TRIGGERS_ACCOUNT);
    const planned = triggers.flatMap((trigger) => planMonitoringQueries({
      trigger, verified_name: account.account, verified_domain: account.domain,
      aliases: account.profile.known_aliases, country: "Colombia", language: account.profile.likely_language ?? "es",
      prior_source_cutoff: baselineCutoff, now: sourceCutoff, max_queries: MAX_QUERIES_TRIGGER,
    }));
    const executed: Array<Record<string, unknown>> = [], candidates: Array<{ candidate: EvidenceCandidate; category: SignalCategory; status: EventStatus; trigger: MonitoringTrigger }> = [];
    const profile = buildResearchProfile({ company: account.account, domain: account.domain, country: "Colombia", segment: account.profile.segment, structural_score: account.profile.structural_score, known_evidence: [] });
    const seen = new Set<string>();
    for (const query of planned.filter((q) => q.accepted).slice(0, triggers.length)) {
      if (queriesExecuted >= MAX_QUERIES) break;
      const trigger = triggers.find((x) => x.trigger_id === query.trigger_id)!;
      const response = await execute(query.query, 730, available.find((p) => p.id === "brave") ?? available[0]);
      const decisions = response.results.map((candidate) => assessEvidenceCandidate(profile, candidate, seen));
      for (const decision of decisions) {
        if (!decision.accepted || !decision.candidate.publication_date) continue;
        const event = categoryFrom(`${decision.candidate.title ?? ""} ${decision.candidate.excerpt ?? ""}`);
        if (event) { candidates.push({ candidate: decision.candidate, category: event.category, status: event.status, trigger }); seen.add(decision.candidate.canonical_url); }
      }
      executed.push({ ...query, provider: response.provider, error: response.error, result_count: response.results.length, accepted_entity_dated_candidates: decisions.filter((d) => d.accepted && !!d.candidate.publication_date).length });
    }
    const observations: SignalObservation[] = [];
    const rejected: Array<Record<string, unknown>> = [];
    for (const item of candidates.slice(0, 3)) {
      if (extracts < MAX_EXTRACTS) {
        const extracted = await extractWithFallback(item.candidate.canonical_url); extracts++;
        if (extracted.ok && extracted.content) {
          const date = resolvePublicationDate({ provider_date: item.candidate.publication_date, html: extracted.content, url: item.candidate.canonical_url });
          item.candidate.publication_date = date.date;
          item.candidate.excerpt = extracted.content.slice(0, 3000);
        }
      }
      const counterQuery = `"${account.account}" "${item.category}" (cancelada OR cerrada OR retrasada OR inactiva)`;
      const counterResponse = await execute(counterQuery, 730, available.find((p) => p.id === "serper") ?? available[0]);
      const counter = counterResponse.results.filter((x) => categoryFrom(`${x.title ?? ""} ${x.excerpt ?? ""}`)?.status === "cancelled");
      const canonical = canonicalizeEvidence({
        scope: "account", scope_key: account.domain, url: item.candidate.url, provider: item.candidate.provider,
        title: item.candidate.title, excerpt: item.candidate.excerpt, publication_date: item.candidate.publication_date,
        retrieved_at: item.candidate.retrieved_at, verified_at: sourceCutoff, country: "Colombia", language: "es",
        entity_match: account.account, entity_match_confidence: .8, source_quality: .75,
        source_type: new URL(item.candidate.canonical_url).hostname.replace(/^www\./, "") === account.domain ? "official" : item.candidate.source_type,
      });
      const counterEvidence: CanonicalEvidence[] = counter.map((x) => canonicalizeEvidence({
        scope: "account", scope_key: account.domain, url: x.url, provider: x.provider, title: x.title,
        excerpt: x.excerpt, publication_date: x.publication_date, retrieved_at: x.retrieved_at,
        verified_at: sourceCutoff, country: "Colombia", language: "es", entity_match: account.account,
        entity_match_confidence: .75, source_quality: .7,
      }));
      const observation = normalizeSignalEvent({
        account_id: account.domain, client_id: "amor-de-gea", category: item.category,
        event_statement: `${item.candidate.title ?? item.category}: ${(item.candidate.excerpt ?? "").slice(0, 240)}`,
        evidence: [canonical], event_status: item.status, detected_at: sourceCutoff, market: "Colombia",
        segment: account.profile.segment, commercial_relevance: "medium", client_relevance: "plausible",
        materiality_dimensions: { account_significance: .6, event_magnitude: .6, strategic_relevance: .6, likely_persistence: .6 },
        counterevidence: counterEvidence, counterevidence_state: counterEvidence.length ? "material" : "none_found_bounded",
        counterevidence_query: counterQuery,
      });
      if (observation) observations.push(observation);
      else rejected.push({ url: item.candidate.canonical_url, reason: "unsupported_signal" });
    }
    const primary = observations.sort((a, b) => b.confidence - a.confidence)[0] ?? null;
    const change = compareSignalObservations({ account_id: account.domain, monitoring_run_id: run.run_id, prior: null, current: primary, baseline_available: true, detected_at: sourceCutoff });
    const timing = assessTimingV2({ signal: primary, structural_relevance: (account.profile.structural_score ?? 0) >= 70 ? "strong" : (account.profile.structural_score ?? 0) >= 55 ? "moderate" : "weak", commercial_accessibility: "plausible" });
    const transition = transitionQualification({
      account_id: account.domain, previous: account.qualification.state, timing,
      structural_relevance: (account.profile.structural_score ?? 0) >= 70 ? "strong" : (account.profile.structural_score ?? 0) >= 55 ? "moderate" : "weak",
      client_fit: "strong", critical_counterevidence: primary?.counterevidence_state === "critical",
      decisive_evidence: primary?.supporting_evidence_ids ?? [], confidence: primary?.confidence ?? .5,
    });
    const output = temporalOutput({
      type: primary ? change.state === "unchanged" ? "no_material_change" : "current_signal" : "no_current_signal",
      account_id: account.domain, signal_id: primary?.signal_id, evidence_ids: primary?.supporting_evidence_ids,
      trigger_id: triggers[0]?.trigger_id, qualification_transition_id: transition.transition_id,
    });
    results.push({ account: account.account, domain: account.domain, baseline_cutoff: baselineCutoff, triggers, planned_queries: planned, executed_queries: executed, signal_candidates: candidates.length, accepted_signals: observations, rejected_signals: rejected, what_changed: change, timing, qualification_transition: transition, output });
  }
  run.status = "completed";
  const artifact = {
    block: 8, generated_at: sourceCutoff, methodology_version: "signal-temporal-v2", baseline_artifact: filename,
    migration_043_applied: false, persistence: { local_immutable_artifact: true, database_signal_tables: "blocked_pending_explicit_migration_043_approval", migration_042_reuse: "source evidence, claims, states and dossiers remain authoritative baseline" },
    limits: { max_accounts: MAX_ACCOUNTS, max_triggers_per_account: MAX_TRIGGERS_ACCOUNT, max_queries_per_trigger: MAX_QUERIES_TRIGGER, max_queries: MAX_QUERIES, max_extracts: MAX_EXTRACTS, max_retries: MAX_RETRIES, max_cost_usd: MAX_COST_USD, no_llm: true, no_scheduler: true },
    run, summary: {
      accounts: results.length, triggers_checked: results.reduce((s, x) => s + (x.triggers as unknown[]).length, 0),
      queries_executed: queriesExecuted, extracts, retries, signal_candidates: results.reduce((s, x) => s + Number(x.signal_candidates), 0),
      accepted_signals: results.reduce((s, x) => s + (x.accepted_signals as unknown[]).length, 0),
      corroborated_signals: results.flatMap((x) => x.accepted_signals as SignalObservation[]).filter((s) => ["corroborated", "strongly_corroborated"].includes(s.corroboration_state)).length,
      accounts_with_material_change: results.filter((x) => !["unchanged", "first_seen", "unresolved"].includes((x.what_changed as { state: string }).state)).length,
      unchanged_or_no_current_signal: results.filter((x) => ["no_material_change", "no_current_signal"].includes((x.output as { type: string }).type)).length,
      qualification_transitions: results.filter((x) => { const q = x.qualification_transition as { previous_decision: string; new_decision: string }; return q.previous_decision !== q.new_decision; }).length,
      measured_cost_usd: costCalls ? Number(measuredCost.toFixed(6)) : null, cost_state: costCalls ? "measured" : "cost_not_measured",
    },
    provider_contribution: contribution, accounts: results,
  };
  const outDir = join(process.cwd(), "ml/data/signal-temporal"); mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `amor-de-gea-block8-${sourceCutoff.replace(/[:.]/g, "-")}.json`);
  writeFileSync(path, JSON.stringify(artifact, null, 2));
  console.log(JSON.stringify({ artifact: path, summary: artifact.summary }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
