// Block 9 same-six calibrated operating run. Internal observation only.
// Caps: 6 accounts, 2 active triggers/account, 24 searches, 12 extractions, 1 retry/provider failure.
import { loadEnvConfig } from "@next/env";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  assessTimingV2, compareSignalObservations, createMonitoringRun, createMonitoringTrigger,
  normalizeSignalEvent, temporalOutput, transitionQualification,
  type EventStatus, type MonitoringTrigger, type SignalCategory, type SignalObservation,
} from "@/lib/intelligence/signal-temporal";
import { assessEntityMatch, canonicalizeEvidence, type CanonicalEvidence } from "@/lib/intelligence/evidence-temporal";
import { deriveMonitoringPolicy, type GateDiagnostic } from "@/lib/intelligence/signal-benchmark";
import { braveProvider, tavilyProvider } from "@/lib/sources/access/providers";
import type { SearchProvider } from "@/lib/sources/access/provider-contract";
import { extractWithFallback } from "@/lib/sources/access/extractors";
import { resolvePublicationDate } from "@/lib/sources/access/date-resolver";
import type { QualificationState } from "@/lib/intelligence/research-quality";

loadEnvConfig(process.cwd());
const MAX_ACCOUNTS = 6, MAX_TRIGGERS = 2, MAX_QUERIES = 24, MAX_EXTRACTS = 12, MAX_RETRIES = 1, MAX_RESULTS = 5;
const hash = (value: string) => { let h = 2166136261; for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const gate = (name: GateDiagnostic["gate"], state: GateDiagnostic["state"], reason: string, evidence: string[], confidence: number): GateDiagnostic => ({ gate: name, state, reason, evidence, confidence });
const eventFrom = (value: string): { category: SignalCategory | null; status: EventStatus; reason: string } => {
  const s = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b(cancelad|cierre definitivo|cerro operaciones|liquidacion|inactiv)\b/.test(s)) return { category: /cancel/.test(s) ? "cancelled_expansion" : "closure", status: "completed", reason: "Explicit negative event phrase." };
  if (/\b(inaugur|abrio sus puertas|abrió sus puertas|nueva sede|nueva tienda|apertura)\b/.test(s)) return { category: /tienda/.test(s) ? "store_opening" : "new_location", status: /inaugur|abrio|abrió/.test(s) ? "completed" : "announced", reason: "Location/opening phrase." };
  if (/\b(expansion geografica|se expande|expande su presencia|entra al mercado|nueva ciudad)\b/.test(s)) return { category: "geographic_expansion", status: /planea|anuncia/.test(s) ? "planned" : "in_progress", reason: "Geographic expansion phrase." };
  if (/\b(acuerdo de distribucion|alianza estrategica|nuevo distribuidor|partnership|convenio comercial)\b/.test(s)) return { category: /distribu/.test(s) ? "distribution_agreement" : "partnership", status: "announced", reason: "Commercial agreement phrase." };
  if (/\b(lanza|lanzamiento|nueva linea de productos|amplia su portafolio)\b/.test(s)) return { category: "product_launch", status: "announced", reason: "Product launch phrase." };
  return { category: null, status: "unknown", reason: "No atomic event phrase." };
};

async function main() {
  const b7dir = join(process.cwd(), "ml/data/research-quality");
  const b7file = readdirSync(b7dir).filter((x) => /^amor-de-gea-block7-.*\.json$/.test(x)).sort().at(-1)!;
  const b7 = JSON.parse(readFileSync(join(b7dir, b7file), "utf8")) as { accounts: Array<{ account: string; domain: string; profile: { structural_score: number | null; segment: string | null }; qualification: { state: QualificationState }; dossier: { generated_at: string } }> };
  const b8path = join(process.cwd(), "ml/data/signal-temporal/amor-de-gea-block8-2026-07-30T12-50-20-362Z.json");
  const b8 = JSON.parse(readFileSync(b8path, "utf8")) as { summary: Record<string, number | string | null>; accounts: Array<{ domain: string; accepted_signals: SignalObservation[] }> };
  const accounts = b7.accounts.slice(0, MAX_ACCOUNTS); const cutoff = new Date().toISOString();
  const baselineCutoff = accounts[0].dossier.generated_at;
  const run = createMonitoringRun({ client_id: "amor-de-gea", source_cutoff: cutoff, baseline_cutoff: baselineCutoff, requested_from: baselineCutoff, query_cap: MAX_QUERIES, extraction_cap: MAX_EXTRACTS, trigger_cap_per_account: MAX_TRIGGERS });
  let searches = 0, extracts = 0, retries = 0, measuredCost = 0, costCalls = 0;
  const providers = [braveProvider, tavilyProvider];
  const health = await Promise.all(providers.map(async (provider) => ({ provider, health: await provider.health() })));
  const available = health.filter((x) => x.health.status === "available").map((x) => x.provider);
  if (!available.length) throw new Error("No calibrated provider available.");
  const execute = async (query: string, provider: SearchProvider) => {
    if (searches >= MAX_QUERIES) return { ok: false, error: "query_budget_exhausted", results: [], provider: "none", latency_ms: 0 };
    const started = Date.now(); let response = await provider.search({ query, region: "co", language: "es", max_results: MAX_RESULTS, query_type: "signal_specific", freshness_days: 730 }); searches++;
    if (response.cost_estimate_usd != null) { measuredCost += response.cost_estimate_usd; costCalls++; }
    if (!response.ok && retries < MAX_RETRIES && searches < MAX_QUERIES) {
      const fallback = available.find((p) => p.id !== provider.id);
      if (fallback) { retries++; response = await fallback.search({ query, region: "co", language: "es", max_results: MAX_RESULTS, query_type: "signal_specific", freshness_days: 730 }); searches++; provider = fallback; }
    }
    return { ...response, provider: provider.id, latency_ms: Date.now() - started };
  };
  const accountResults: Array<Record<string, unknown>> = [];
  for (const account of accounts) {
    const requested = [
      { category: "new_location" as const, statement: "Apertura o expansión física", why: "Ventana comercial concreta" },
      { category: "distribution_agreement" as const, statement: "Alianza o distribución nueva", why: "Acceso comprador o canal nuevo" },
    ];
    const triggers = requested.map((x) => createMonitoringTrigger({ account_id: account.domain, client_id: "amor-de-gea", category: x.category, statement: x.statement, baseline: baselineCutoff, why: x.why, created_at: cutoff, verified_name: account.account, verified_domain: account.domain, priority: "high" })!).slice(0, MAX_TRIGGERS);
    const queryPlan = [
      { trigger: triggers[0], family: "exact_name_signal_local", provider: braveProvider, query: `"${account.account}" (apertura OR "nueva sede" OR expansión) Colombia 2026` },
      { trigger: triggers[0], family: "site_official_signal", provider: tavilyProvider, query: `site:${account.domain} (apertura OR "nueva sede" OR expansión OR inauguración)` },
      { trigger: triggers[1], family: "exact_name_partner_local", provider: braveProvider, query: `"${account.account}" (alianza OR "acuerdo de distribución" OR "nuevo distribuidor") Colombia 2026` },
    ];
    const raw: Array<Record<string, unknown>> = [], candidates: Array<{ evidence: CanonicalEvidence; event: ReturnType<typeof eventFrom>; trigger: MonitoringTrigger; family: string; query: string }> = [];
    for (const plan of queryPlan) {
      const response = await execute(plan.query, available.find((p) => p.id === plan.provider.id) ?? available[0]);
      for (const result of response.results) {
        const entityConfidence = assessEntityMatch({ company: account.account, domain: account.domain, url: result.canonical_url, title: result.title, excerpt: result.snippet });
        const event = eventFrom(`${result.title ?? ""} ${result.snippet ?? ""}`);
        let publicationDate = result.published_date; let dateSource = publicationDate ? "provider" : "unknown";
        let extraction: Record<string, unknown> | null = null;
        if (entityConfidence >= .65 && event.category && !publicationDate && extracts < MAX_EXTRACTS) {
          const extracted = await extractWithFallback(result.canonical_url); extracts++;
          const resolved = resolvePublicationDate({ provider_date: result.published_date, html: extracted.content, url: result.canonical_url });
          publicationDate = resolved.date; dateSource = resolved.date_source;
          extraction = { ok: extracted.ok, extractor: extracted.extractor, fallback_used: extracted.fallback_used, error: extracted.error, date_source: resolved.date_source, date_conflict: resolved.conflict };
        }
        const insideWindow = !!publicationDate && Date.parse(publicationDate) >= Date.parse(baselineCutoff) - 7 * 86_400_000 && Date.parse(publicationDate) <= Date.parse(cutoff);
        const gates: GateDiagnostic[] = [
          gate("identity", entityConfidence >= .65 ? "pass" : "fail", entityConfidence >= .65 ? "Entity matched." : "Entity not verified.", [result.canonical_url], entityConfidence),
          gate("event", event.category ? "pass" : "fail", event.reason, [result.title ?? ""], event.category ? .8 : .85),
          gate("date", publicationDate ? "pass" : "fail", publicationDate ? `Resolved from ${dateSource}.` : "Publication/effective date missing.", [], publicationDate ? .75 : .9),
          gate("freshness", publicationDate ? insideWindow ? "pass" : "fail" : "insufficient_evidence", publicationDate ? insideWindow ? "Inside baseline window with overlap." : "Outside baseline window." : "No date.", [baselineCutoff, cutoff], .85),
          gate("materiality", event.category ? "insufficient_evidence" : "fail", event.category ? "Requires body-level magnitude assessment." : "No event.", [], .6),
          gate("source_quality", "pass", "Search result retained for bounded diagnostic.", [result.canonical_url], .6),
          gate("corroboration", "insufficient_evidence", "Single result; provider duplication is not corroboration.", [], .7),
          gate("counterevidence", "not_applicable", "Runs only after dated entity-safe candidate.", [], 1),
          gate("client_relevance", event.category ? "insufficient_evidence" : "not_applicable", "Requires event-specific commercial interpretation.", [], .5),
          gate("timing", entityConfidence >= .65 && !!event.category && !!publicationDate && insideWindow ? "pass" : "fail", "Timing requires identity, event, date and current window.", [], .8),
        ];
        raw.push({ query: plan.query, query_family: plan.family, provider: response.provider, url: result.canonical_url, title: result.title, published_date: result.published_date, resolved_date: publicationDate, entity_confidence: entityConfidence, event_category: event.category, event_status: event.status, extraction, gates, accepted_candidate: gates.filter((g) => ["identity", "event", "date", "freshness"].includes(g.gate)).every((g) => g.state === "pass") });
        if (gates.filter((g) => ["identity", "event", "date", "freshness"].includes(g.gate)).every((g) => g.state === "pass") && event.category) {
          candidates.push({ evidence: canonicalizeEvidence({ scope: "account", scope_key: account.domain, url: result.url, provider: result.provider, title: result.title, excerpt: result.snippet, publication_date: publicationDate, retrieved_at: result.retrieved_at, verified_at: cutoff, country: "Colombia", language: "es", entity_match: account.account, entity_match_confidence: entityConfidence, source_quality: .7, source_type: new URL(result.canonical_url).hostname.replace(/^www\./, "") === account.domain ? "official" : result.source_type }), event, trigger: plan.trigger, family: plan.family, query: plan.query });
        }
      }
    }
    const observations: SignalObservation[] = [];
    for (const candidate of candidates.slice(0, 2)) {
      const negativeQuery = `"${account.account}" "${candidate.event.category}" (cancelada OR cerrada OR retrasada OR inactiva)`;
      const counter = await execute(negativeQuery, braveProvider);
      const counterRelevant = counter.results.filter((r) => /\b(cancel|cerr|retras|inactiv)\b/i.test(`${r.title ?? ""} ${r.snippet ?? ""}`));
      const observation = normalizeSignalEvent({
        account_id: account.domain, client_id: "amor-de-gea", category: candidate.event.category!,
        event_statement: `${candidate.evidence.title ?? candidate.event.category}: ${(candidate.evidence.excerpt ?? "").slice(0, 240)}`,
        evidence: [candidate.evidence], event_status: candidate.event.status, detected_at: cutoff,
        market: "Colombia", segment: account.profile.segment, commercial_relevance: "medium", client_relevance: "plausible",
        materiality_dimensions: { account_significance: .6, event_magnitude: .55, strategic_relevance: .55, likely_persistence: .6 },
        counterevidence_state: counterRelevant.length ? "material" : "none_found_bounded", counterevidence_query: negativeQuery,
      });
      if (observation) observations.push(observation);
    }
    const primary = observations.sort((a, b) => b.confidence - a.confidence)[0] ?? null;
    const prior = b8.accounts.find((x) => x.domain === account.domain)?.accepted_signals?.[0] ?? null;
    const change = compareSignalObservations({ account_id: account.domain, monitoring_run_id: run.run_id, prior, current: primary, baseline_available: true, detected_at: cutoff });
    const structural = (account.profile.structural_score ?? 0) >= 70 ? "strong" : (account.profile.structural_score ?? 0) >= 55 ? "moderate" : "weak";
    const timing = assessTimingV2({ signal: primary, structural_relevance: structural, commercial_accessibility: "plausible" });
    const transition = transitionQualification({ account_id: account.domain, previous: account.qualification.state, timing, structural_relevance: structural, client_fit: "strong", critical_counterevidence: primary?.counterevidence_state === "critical", decisive_evidence: primary?.supporting_evidence_ids ?? [], confidence: primary?.confidence ?? .5 });
    const policies = triggers.map((trigger) => deriveMonitoringPolicy({ decision: transition.new_decision, trigger_review_horizon_days: trigger.expected_review_horizon_days, signal_decay_days: 365, account_importance: "medium", source_availability: raw.length ? "moderate" : "weak", evidence_gap: !primary, previous_change_frequency: "none", client_relevance: "strong", cost_state: costCalls ? "measured_low" : "not_measured" }));
    accountResults.push({ account: account.account, domain: account.domain, baseline_cutoff: baselineCutoff, triggers, query_plan: queryPlan.map((x) => ({ family: x.family, provider: x.provider.id, query: x.query })), raw_results: raw, signal_candidates: candidates.length, accepted_signals: observations, what_changed: change, timing, qualification_transition: transition, monitoring_policies: policies, output: temporalOutput({ type: primary ? "current_signal" : "no_current_signal", account_id: account.domain, signal_id: primary?.signal_id, evidence_ids: primary?.supporting_evidence_ids, trigger_id: triggers[0].trigger_id, qualification_transition_id: transition.transition_id }) });
  }
  run.status = searches >= MAX_QUERIES ? "completed" : "completed";
  const summary = {
    accounts: accountResults.length, searches, extracts, retries,
    raw_results: accountResults.reduce((s, a) => s + (a.raw_results as unknown[]).length, 0),
    accepted_evidence: accountResults.reduce((s, a) => s + (a.raw_results as Array<{ accepted_candidate: boolean }>).filter((x) => x.accepted_candidate).length, 0),
    rejected_evidence: accountResults.reduce((s, a) => s + (a.raw_results as Array<{ accepted_candidate: boolean }>).filter((x) => !x.accepted_candidate).length, 0),
    correct_entity_results: accountResults.reduce((s, a) => s + (a.raw_results as Array<{ entity_confidence: number }>).filter((x) => x.entity_confidence >= .65).length, 0),
    date_valid_results: accountResults.reduce((s, a) => s + (a.raw_results as Array<{ resolved_date: string | null }>).filter((x) => !!x.resolved_date).length, 0),
    event_valid_results: accountResults.reduce((s, a) => s + (a.raw_results as Array<{ event_category: string | null }>).filter((x) => !!x.event_category).length, 0),
    signal_candidates: accountResults.reduce((s, a) => s + Number(a.signal_candidates), 0),
    valid_signals: accountResults.reduce((s, a) => s + (a.accepted_signals as unknown[]).length, 0),
    material_changes: accountResults.filter((a) => !["unchanged", "first_seen", "unresolved"].includes((a.what_changed as { state: string }).state)).length,
    qualification_transitions: accountResults.filter((a) => { const q = a.qualification_transition as { previous_decision: string; new_decision: string }; return q.previous_decision !== q.new_decision; }).length,
    cost: costCalls ? { state: "measured", usd: Number(measuredCost.toFixed(6)) } : { state: "not_measured", reason: "Providers returned no cost estimate." },
  };
  const artifact = { block: 9, methodology_version: "signal-recovery-benchmark-v1", generated_at: cutoff, run, limits: { max_accounts: MAX_ACCOUNTS, max_triggers_per_account: MAX_TRIGGERS, max_queries: MAX_QUERIES, max_extracts: MAX_EXTRACTS, max_retries: MAX_RETRIES }, provider_health: health.map((x) => ({ provider: x.provider.id, status: x.health.status, reason: x.health.reason })), summary, block8_summary: b8.summary, accounts: accountResults };
  const dir = join(process.cwd(), "ml/data/signal-monitoring-operations"); mkdirSync(dir, { recursive: true });
  const path = join(dir, `amor-de-gea-block9-${cutoff.replace(/[:.]/g, "-")}.json`); writeFileSync(path, JSON.stringify(artifact, null, 2));

  let persistence: Record<string, unknown> = { state: "unavailable" };
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const errors: string[] = [];
    const runInsert = await db.from("intelligence_monitoring_runs").insert({ id: run.run_id, tenant_user_id: null, client_id: "amor-de-gea", baseline_cutoff: run.baseline_cutoff, source_cutoff: run.source_cutoff, requested_from: run.requested_from, requested_to: run.requested_to, limits_json: artifact.limits, execution_json: { summary, artifact_path: path.replace(`${process.cwd()}/`, "") }, provider_date_behavior: run.provider_date_behavior, operational_mode: "observation", status: "completed", ranking_impact: "off", report_impact: "off", methodology_version: "signal-recovery-benchmark-v1", completed_at: cutoff });
    if (runInsert.error && runInsert.error.code !== "23505") errors.push(`run:${runInsert.error.message}`);
    for (const account of accountResults) {
      for (const trigger of account.triggers as MonitoringTrigger[]) {
        const result = await db.from("intelligence_monitoring_triggers").insert({ id: trigger.trigger_id, tenant_user_id: null, client_id: "amor-de-gea", account_id: trigger.account_id, category: trigger.category, trigger_json: { ...trigger, monitoring_policy: (account.monitoring_policies as unknown[])[(account.triggers as MonitoringTrigger[]).indexOf(trigger)] }, baseline_cutoff: trigger.current_baseline, active_status: trigger.active_status, last_checked_at: cutoff, next_check_at: trigger.next_check_at, expires_at: trigger.expiry, methodology_version: "signal-recovery-benchmark-v1" });
        if (result.error && result.error.code !== "23505") errors.push(`trigger:${result.error.message}`);
      }
      for (const signal of account.accepted_signals as SignalObservation[]) {
        const result = await db.from("intelligence_signals").insert({ id: signal.signal_id, signal_key: signal.signal_key, tenant_user_id: null, client_id: "amor-de-gea", account_id: signal.account_id, monitoring_run_id: run.run_id, category: signal.category, normalized_event_type: signal.normalized_event_type, event_statement: signal.event_statement, event_status: signal.event_status, current_status: signal.current_status, prior_status: signal.prior_status, publication_date: signal.publication_date, effective_date: signal.effective_date, detected_at: signal.detected_at, first_observed: signal.first_observed, last_observed: signal.last_observed, claim_ids: signal.factual_claim_ids, supporting_evidence_ids: signal.supporting_evidence_ids, contradicting_evidence_ids: signal.contradicting_evidence_ids, provenance_json: { source_independence_state: signal.source_independence_state }, assessment_json: signal, operational_mode: "observation", review_state: "unreviewed", ranking_impact: "off", report_impact: "off", methodology_version: signal.methodology_version });
        if (result.error && result.error.code !== "23505") errors.push(`signal:${result.error.message}`);
      }
      const change = account.what_changed as { change_id: string; signal_key: string | null; state: string; methodology_version: string };
      const result = await db.from("intelligence_signal_changes").insert({ id: change.change_id, tenant_user_id: null, client_id: "amor-de-gea", account_id: account.domain, signal_key: change.signal_key, monitoring_run_id: run.run_id, change_state: change.state, change_json: account.what_changed, qualification_transition_json: account.qualification_transition, methodology_version: change.methodology_version });
      if (result.error && result.error.code !== "23505") errors.push(`change:${result.error.message}`);
    }
    persistence = { state: errors.length ? "partial" : "persisted", errors };
  }
  console.log(JSON.stringify({ artifact: path, summary, persistence }, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });
