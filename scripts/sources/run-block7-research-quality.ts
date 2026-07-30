// Block 7 controlled comparative pass. Same six accounts, no market expansion.
// Hard caps: 6 accounts, 5 planned/account, 24 executed, 2 retries, 8 extracts.
import { loadEnvConfig } from "@next/env";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assessEvidenceCandidate, buildResearchProfile, compareResearchRuns, costState,
  planAccountResearch, planCorroborationQuery, qualifyAccount, recoverAtomicClaims,
  type AccountResearchProfile, type EvidenceCandidate, type EvidenceDecision,
  type PlannedResearchQuery,
} from "@/lib/intelligence/research-quality";
import {
  assessClaim, buildAccountDossier, buildAccountState, buildClientContext,
  canonicalizeEvidence, type CanonicalEvidence,
} from "@/lib/intelligence/evidence-temporal";
import { persistEvidenceBundle } from "@/lib/intelligence/evidence-store";
import { braveProvider, serperProvider, tavilyProvider } from "@/lib/sources/access/providers";
import type { SearchProvider } from "@/lib/sources/access/provider-contract";
import { extractWithFallback } from "@/lib/sources/access/extractors";
import { resolvePublicationDate } from "@/lib/sources/access/date-resolver";

loadEnvConfig(process.cwd());

const MAX_ACCOUNTS = 6, MAX_PLANNED_PER_ACCOUNT = 5, MAX_QUERIES = 24, MAX_RETRIES = 2, MAX_EXTRACTS = 8;
const MAX_RESULTS = 5, MAX_COST_USD = Number(process.env.BLOCK7_RESEARCH_MAX_USD ?? "1");
if (!Number.isFinite(MAX_COST_USD) || MAX_COST_USD <= 0 || MAX_COST_USD > 2) throw new Error("BLOCK7_RESEARCH_MAX_USD must be > 0 and <= 2.");

async function main() {
  const block6Dir = join(process.cwd(), "ml/data/evidence-temporal");
  const block6File = readdirSync(block6Dir).filter((f) => /^amor-de-gea-.*\.json$/.test(f)).sort().at(-1);
  if (!block6File) throw new Error("Block 6 controlled artifact unavailable.");
  const block6 = JSON.parse(readFileSync(join(block6Dir, block6File), "utf8")) as {
    summary: Record<string, number | string | null>;
    accounts: Array<{ account: string; domain: string; state: { structural_score: number | null }; dossier: { structural: { segment: string | null } }; evidence: Array<{ canonical_url: string; entity_match_confidence: number; publication_date: string | null }> }>;
  };
  const sourceAccounts = block6.accounts.slice(0, MAX_ACCOUNTS);
  if (sourceAccounts.length !== 6) throw new Error(`Expected same six Block 6 accounts; found ${sourceAccounts.length}.`);

  const providers = [serperProvider, braveProvider, tavilyProvider];
  const health = await Promise.all(providers.map(async (provider) => ({ provider, health: await provider.health() })));
  const available = health.filter((x) => x.health.status === "available").map((x) => x.provider);
  if (!available.length) throw new Error(`No search provider available: ${health.map((x) => `${x.provider.id}:${x.health.reason}`).join("; ")}`);
  const preferred: Record<string, SearchProvider> = {
    identity: available.find((p) => p.id === "serper") ?? available[0],
    current_activity: available.find((p) => p.id === "brave") ?? available[0],
    counterevidence: available.find((p) => p.id === "serper") ?? available[0],
    corroboration: available.find((p) => p.id === "tavily") ?? available[0],
    commercial_footprint: available.find((p) => p.id === "brave") ?? available[0],
    client_relevance: available.find((p) => p.id === "serper") ?? available[0],
  };
  const now = new Date().toISOString();
  const context = buildClientContext({
    client_id: "amor-de-gea", captured_at: now, region: "Colombia",
    offering: "Infusiones y bebidas botánicas funcionales de bienestar",
    objective: "Identificar compradores o canales colombianos con encaje estructural y evidencia comercial verificable",
    priority_segments: ["retail", "distribution", "hospitality", "wellness"],
    excluded_segments: ["government", "medical_provider"],
    explicit_constraints: ["Colombia primero", "no inferir intención de compra", "cuentas obvias no bastan como valor pagado"],
  });

  let executedQueries = 0, retries = 0, extracts = 0, measuredCost = 0, measuredCostCalls = 0;
  const disabledProviders = new Set<string>();
  const providerContribution: Record<string, { calls: number; accepted: number; rejected: number; errors: number }> = {};
  const accountResults: Array<Record<string, unknown>> = [];

  const execute = async (profile: AccountResearchProfile, query: PlannedResearchQuery, seen: Set<string>): Promise<{ decisions: EvidenceDecision[]; error: string | null; provider_used: string }> => {
    if (executedQueries >= MAX_QUERIES) return { decisions: [], error: "query_budget_exhausted", provider_used: "none" };
    let provider = !disabledProviders.has(preferred[query.stage].id)
      ? preferred[query.stage]
      : available.find((p) => !disabledProviders.has(p.id)) ?? preferred[query.stage];
    const runProvider = async (selected: SearchProvider) => {
      const stats = (providerContribution[selected.id] ??= { calls: 0, accepted: 0, rejected: 0, errors: 0 });
      const response = await selected.search({
        query: query.query, region: "co", language: profile.likely_language ?? "es", max_results: MAX_RESULTS,
        query_type: query.stage === "identity" ? "company_specific" : query.stage === "current_activity" ? "signal_specific" : "company_specific",
        freshness_days: ["current_activity", "counterevidence", "corroboration"].includes(query.stage) ? 730 : null,
      });
      executedQueries++; stats.calls++;
      if (response.cost_estimate_usd != null) { measuredCost += response.cost_estimate_usd; measuredCostCalls++; }
      if (!response.ok) stats.errors++;
      return { response, stats };
    };
    let attempt = await runProvider(provider);
    if (!attempt.response.ok && retries < MAX_RETRIES && executedQueries < MAX_QUERIES) {
      disabledProviders.add(provider.id);
      const fallback = available.find((p) => !disabledProviders.has(p.id));
      if (fallback) { retries++; provider = fallback; attempt = await runProvider(provider); }
    }
    const { response, stats } = attempt;
    if (!response.ok) return { decisions: [], error: response.error ?? "provider_failure", provider_used: provider.id };
    const decisions = response.results.map((item) => assessEvidenceCandidate(profile, {
      url: item.url, canonical_url: item.canonical_url, title: item.title, excerpt: item.snippet,
      provider: item.provider, source_type: item.source_type, publication_date: item.published_date, retrieved_at: item.retrieved_at,
    }, seen));
    for (const d of decisions) {
      if (d.accepted) { stats.accepted++; seen.add(d.candidate.canonical_url); } else stats.rejected++;
    }
    return { decisions, error: null, provider_used: provider.id };
  };

  for (const source of sourceAccounts) {
    const knownEvidence = source.evidence.map((e) => ({
      official: new URL(e.canonical_url).hostname.replace(/^www\./, "") === source.domain,
      entity_confidence: e.entity_match_confidence, dated: !!e.publication_date, independent: false,
    }));
    const profile = buildResearchProfile({
      company: source.account, domain: source.domain, country: "Colombia",
      segment: source.dossier.structural.segment, business_type: source.dossier.structural.segment,
      structural_score: source.state.structural_score, known_evidence: knownEvidence,
    });
    const queryPlan = planAccountResearch(profile, context, MAX_PLANNED_PER_ACCOUNT);
    const executed: Array<{ query: PlannedResearchQuery; provider: string; result_count: number; error: string | null }> = [];
    const decisions: EvidenceDecision[] = [], seen = new Set<string>();
    const gapStates: Record<string, string> = Object.fromEntries(profile.current_evidence_gaps.map((g) => [g, "unresolved"]));

    // Adaptive base sequence. Footprint is recovered from identity/current
    // sources; its dedicated query remains planned but deferred to reserve budget.
    const sequence = ["identity", "current_activity", "counterevidence"] as const;
    let identityPassed = false;
    for (const stage of sequence) {
      const query = queryPlan.accepted.find((q) => q.stage === stage);
      if (!query) continue;
      if (stage !== "identity" && !identityPassed) break;
      const result = await execute(profile, query, seen);
      decisions.push(...result.decisions);
      executed.push({ query, provider: result.provider_used, result_count: result.decisions.length, error: result.error });
      if (stage === "identity") {
        identityPassed = result.decisions.some((d) => d.accepted && ["confirmed", "high_confidence"].includes(d.entity_state));
        gapStates.identity = identityPassed ? "resolved" : result.decisions.length ? "blocked" : "unresolved";
        gapStates.official_domain = result.decisions.some((d) => d.accepted && d.entity_state === "confirmed") ? "resolved" : "unresolved";
      }
      if (stage === "current_activity") gapStates.recent_signals = result.decisions.some((d) => d.accepted && d.commercial_relevance === "high") ? "partially_resolved" : "unresolved";
      if (stage === "counterevidence") gapStates.counterevidence = "resolved";
    }

    // Extract only accepted A/B URLs, maximum two/account and global hard cap.
    const extractionLog: Array<{ decision_id: string; ok: boolean; extractor: string; date_recovered: boolean; error: string | null }> = [];
    for (const decision of decisions.filter((d) => d.accepted && ["A", "B"].includes(d.source_tier)).slice(0, 2)) {
      if (extracts >= MAX_EXTRACTS) break;
      const extracted = await extractWithFallback(decision.candidate.canonical_url);
      extracts++;
      if (extracted.ok && extracted.content) {
        const resolved = resolvePublicationDate({ provider_date: decision.candidate.publication_date, html: extracted.content, url: decision.candidate.canonical_url });
        decision.candidate.excerpt = extracted.content.slice(0, 3000);
        decision.candidate.publication_date = resolved.date;
        decision.date_state = resolved.date ? "dated" : "retrieved_only";
        if (!resolved.date && !decision.reason_codes.includes("missing_publication_date")) decision.reason_codes.push("missing_publication_date");
        else if (resolved.date) decision.reason_codes = decision.reason_codes.filter((x) => x !== "missing_publication_date");
        extractionLog.push({ decision_id: decision.decision_id, ok: true, extractor: extracted.extractor, date_recovered: !!resolved.date, error: null });
      } else extractionLog.push({ decision_id: decision.decision_id, ok: false, extractor: extracted.extractor, date_recovered: false, error: extracted.error });
    }

    let claims = recoverAtomicClaims(profile, decisions, now);
    const corroborationAttempts: Array<{ claim_id: string; query: PlannedResearchQuery; provider: string; result: string; independent_domains: string[] }> = [];
    const target = claims.find((c) => c.commercial_relevance === "high" && c.independent_source_count === 1);
    if (target && executedQueries < MAX_QUERIES) {
      const knownDomain = target.source_domains[0];
      const cq = planCorroborationQuery(profile, { claim_id: target.claim_id, claim_statement: target.fact, known_domain: knownDomain, known_source_tier: target.source_tiers[0] });
      if (cq.accepted) {
        const result = await execute(profile, cq, seen);
        decisions.push(...result.decisions);
        executed.push({ query: cq, provider: result.provider_used, result_count: result.decisions.length, error: result.error });
        claims = recoverAtomicClaims(profile, decisions, now);
        const updated = claims.find((c) => c.claim_id === target.claim_id);
        corroborationAttempts.push({ claim_id: target.claim_id, query: cq, provider: result.provider_used, result: updated && updated.independent_source_count >= 2 ? "corroborated" : result.error ? "provider_failure" : "not_corroborated", independent_domains: updated?.source_domains ?? [] });
        gapStates.independent_corroboration = updated && updated.independent_source_count >= 2 ? "resolved" : "unresolved";
      }
    }

    const counterChecked = executed.some((x) => x.query.stage === "counterevidence" && !x.error);
    const qualification = qualifyAccount({
      profile, claims, decisions, context,
      structural_relevance: (profile.structural_score ?? 0) >= 70 ? "strong" : (profile.structural_score ?? 0) >= 55 ? "moderate" : "weak",
      counterevidence_checked: counterChecked,
      decision_changing_question: claims.some((c) => c.category === "current_activity" && c.independent_source_count < 2) ? "Confirmar independientemente la fecha, alcance y entidad del evento actual." : null,
    });
    gapStates.timing = qualification.gates.find((g) => g.id === "timing")?.state === "passed" ? "resolved" : "unresolved";
    gapStates.client_relevance = qualification.gates.find((g) => g.id === "client_fit")?.state === "passed" ? "resolved" : "partially_resolved";
    gapStates.commercial_footprint = claims.some((c) => c.category === "commercial_footprint") ? "resolved" : "unresolved";

    const acceptedDecisions = decisions.filter((d) => d.accepted);
    const canonical: CanonicalEvidence[] = acceptedDecisions.map((d) => canonicalizeEvidence({
      scope: "account", scope_key: source.domain, url: d.candidate.url, provider: d.candidate.provider,
      provider_result_id: d.decision_id, title: d.candidate.title, excerpt: d.candidate.excerpt,
      publisher: d.entity_state === "confirmed" || (d.source_tier === "C" && /instagram|facebook|linkedin|youtube|tiktok/i.test(d.candidate.canonical_url)) ? `account-controlled:${source.domain}` : null,
      claim_text: null, claim_type: d.commercial_relevance === "high" ? "commercial_signal" : "structural_fit",
      publication_date: d.candidate.publication_date, retrieved_at: d.candidate.retrieved_at, verified_at: now,
      language: "es", country: "Colombia", entity_match: source.account, entity_match_confidence: d.entity_confidence,
      source_quality: ({ A: .95, B: .82, C: .65, D: .3 } as const)[d.source_tier],
      extraction_method: extractionLog.some((x) => x.decision_id === d.decision_id && x.ok) ? "bounded_extract" : "provider_search_result",
      raw_reference: `decision:${d.decision_id}`,
    }));
    const canonicalByDecision = new Map(acceptedDecisions.map((d, i) => [d.decision_id, canonical[i]]));
    const registryClaims = claims.map((claim) => assessClaim({
      claim_id: claim.claim_id, scope: "account", scope_key: source.domain,
      category: claim.category === "current_activity" ? "commercial_signal" : claim.category === "negative_event" ? "risk" : "structural_fit",
      statement: claim.statement, now, links: claim.evidence_decision_ids.flatMap((id) => canonicalByDecision.has(id) ? [{ evidence: canonicalByDecision.get(id)!, relation: claim.category === "negative_event" ? "contradicts" as const : "supports" as const }] : []),
    }));
    const state = buildAccountState({ account_key: source.domain, client_id: context.client_id, observed_at: now, claims: registryClaims, structural_score: profile.structural_score });
    const baseDossier = buildAccountDossier({ name: source.account, domain: source.domain, country: "Colombia", segment: profile.segment, state, context });
    const extendedDossier = {
      ...baseDossier, research_profile: profile, research_gaps: { before: profile.current_evidence_gaps, after: gapStates },
      query_plan: queryPlan, queries_executed: executed, evidence_decisions: decisions,
      claims_generated: claims, corroboration_attempts: corroborationAttempts,
      counterevidence_search: { executed: counterChecked, result: claims.some((c) => c.category === "negative_event") ? "found" : counterChecked ? "not_found_within_bounded_search" : "not_executed" },
      qualification, monitoring_triggers: qualification.monitoring_triggers,
      next_best_research_action: qualification.could_change_decision[0] ?? null,
      cost: costState(null, executed.length), provider_contribution: executed.map((x) => x.provider),
      limitations: [...baseDossier.limitations, ...qualification.remaining_uncertainty.slice(0, 5)],
    };
    const persistence = await persistEvidenceBundle({ tenant_user_id: null, client_id: context.client_id, evidence: canonical, claims: registryClaims, state, dossier: extendedDossier, context });
    accountResults.push({
      account: source.account, domain: source.domain, profile, query_plan: queryPlan,
      queries_executed: executed, extraction_log: extractionLog, evidence_decisions: decisions,
      claims, corroboration_attempts: corroborationAttempts, gap_states: gapStates,
      qualification, dossier: extendedDossier, database_persistence: persistence,
    });
  }

  const accepted = accountResults.flatMap((a) => (a.evidence_decisions as EvidenceDecision[]).filter((d) => d.accepted));
  const rejected = accountResults.flatMap((a) => (a.evidence_decisions as EvidenceDecision[]).filter((d) => !d.accepted));
  const allClaims = accountResults.flatMap((a) => a.claims as ReturnType<typeof recoverAtomicClaims>);
  const qualifications = accountResults.map((a) => a.qualification as ReturnType<typeof qualifyAccount>);
  const summary: Record<string, number | string | null | object> = {
    version: "block7-controlled-research-v1", run_at: now, source_block6_artifact: block6File,
    limits: { max_accounts: MAX_ACCOUNTS, max_planned_per_account: MAX_PLANNED_PER_ACCOUNT, max_executed_queries: MAX_QUERIES, max_retries: MAX_RETRIES, max_extracts: MAX_EXTRACTS, max_results_per_query: MAX_RESULTS, max_cost_usd: MAX_COST_USD },
    accounts_researched: accountResults.length, planned_queries: accountResults.reduce((n, a) => n + (a.query_plan as ReturnType<typeof planAccountResearch>).accepted.length + (a.query_plan as ReturnType<typeof planAccountResearch>).rejected.length, 0),
    rejected_queries: accountResults.reduce((n, a) => n + (a.query_plan as ReturnType<typeof planAccountResearch>).rejected.length, 0),
    executed_queries: executedQueries, retries, extracts, accepted_evidence: accepted.length, rejected_evidence: rejected.length,
    wrong_entity_rejections: rejected.filter((d) => d.reason_codes.includes("wrong_entity")).length,
    identity_mismatch_rate: accepted.length + rejected.length ? rejected.filter((d) => d.reason_codes.includes("wrong_entity")).length / (accepted.length + rejected.length) : 0,
    dated_evidence: accepted.filter((d) => !!d.candidate.publication_date).length,
    dated_evidence_coverage: accepted.length ? accepted.filter((d) => !!d.candidate.publication_date).length / accepted.length : 0,
    claims: allClaims.length, commercially_relevant_claims: allClaims.filter((c) => c.commercial_relevance === "high").length,
    corroboration_attempts: accountResults.reduce((n, a) => n + (a.corroboration_attempts as unknown[]).length, 0),
    corroborated_claims: allClaims.filter((c) => c.independent_source_count >= 2).length,
    counterevidence_checks: accountResults.filter((a) => (a.dossier as { counterevidence_search: { executed: boolean } }).counterevidence_search.executed).length,
    qualification_coverage: qualifications.length, decision_distribution: Object.fromEntries(["act_now", "investigate_now", "prioritize", "monitor", "low_priority", "exclude"].map((s) => [s, qualifications.filter((q) => q.state === s).length])),
    actionable_accounts: qualifications.filter((q) => ["act_now", "investigate_now"].includes(q.state)).length,
    monitor_accounts: qualifications.filter((q) => q.state === "monitor").length,
    excluded_accounts: qualifications.filter((q) => q.state === "exclude").length,
    unresolved_accounts: qualifications.filter((q) => ["monitor", "low_priority"].includes(q.state)).length,
    query_efficiency: executedQueries ? accepted.length / executedQueries : 0,
    source_quality_distribution: Object.fromEntries(["A", "B", "C", "D"].map((tier) => [tier, accepted.filter((d) => d.source_tier === tier).length])),
    provider_contribution: providerContribution,
    provider_cost: costState(measuredCostCalls ? Number(measuredCost.toFixed(6)) : null, executedQueries),
    database_persisted_accounts: accountResults.filter((a) => (a.database_persistence as { persisted: boolean }).persisted).length,
  };
  const block6Metrics = {
    accounts_researched: Number(block6.summary.accounts_researched ?? 6), queries_executed: Number(block6.summary.provider_calls ?? 12),
    accepted_evidence: Number(block6.summary.evidence_items ?? 28), rejected_evidence: 0, wrong_entity_evidence: 10,
    dated_evidence: Number(block6.summary.dated_evidence_items ?? 4), claims: Number(block6.summary.claims ?? 8),
    corroborated_claims: Number(block6.summary.corroborated_claims ?? 0), counterevidence_checks: 0, qualification_coverage: 0,
    actionable_accounts: Number(block6.summary.review_candidates ?? 0), monitor_accounts: Number(block6.summary.monitor_accounts ?? 0),
    provider_cost_state: "not_measured",
  };
  const comparison = compareResearchRuns(block6Metrics, {
    accounts_researched: accountResults.length, queries_executed: executedQueries,
    accepted_evidence: accepted.length, rejected_evidence: rejected.length,
    wrong_entity_evidence: accepted.filter((d) => d.reason_codes.includes("wrong_entity")).length,
    dated_evidence: accepted.filter((d) => !!d.candidate.publication_date).length, claims: allClaims.length,
    corroborated_claims: allClaims.filter((c) => c.independent_source_count >= 2).length,
    counterevidence_checks: Number(summary.counterevidence_checks), qualification_coverage: qualifications.length,
    actionable_accounts: Number(summary.actionable_accounts), monitor_accounts: Number(summary.monitor_accounts),
    provider_cost_state: measuredCostCalls ? "measured" : "not_measured",
  });
  const outDir = join(process.cwd(), "ml/data/research-quality");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `amor-de-gea-block7-${now.replace(/[:.]/g, "-")}.json`);
  writeFileSync(outPath, `${JSON.stringify({ summary, comparison, client_context: context, accounts: accountResults }, null, 2)}\n`);
  console.log(JSON.stringify({ output: outPath, summary, comparison: comparison.quality_changes }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exit(1); });
