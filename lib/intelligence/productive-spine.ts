import { createHash } from "node:crypto";
import type { LeadLensReport, LeadCandidate, PipelineInput, PlanType, ProcessedLead } from "@/types";
import type { ConfirmedContextStore, ContextSelector } from "@/lib/interpretation/confirmed-context-store";
import { buildDiscoveryJobInput } from "@/lib/interpretation/confirmed-context-execution";
import type { DiscoveryRunner } from "@/lib/lead-hunter/candidate-universe";
import type { LeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import { loadLeadHunterUniverse, runAndPersistLeadHunter, toResearchCandidates } from "@/lib/lead-hunter/hunt-and-persist";
import { synthesizeCase } from "@/lib/monitor/canonical-case";
import { isMaterialEventClaim } from "@/lib/intelligence/evidence-materiality";
import { classifyRunCoverage } from "@/lib/intelligence/account-deep-research";
import { selectPortfolioAdmission } from "@/lib/intelligence/portfolio-admission";
import type { IntelligenceRunRecord, IntelligenceRunStore } from "./productive-spine-store";
import type { DiscoveryBudget } from "@/lib/lead-hunter/candidate-universe";
import type { IntelligenceRunTrace } from "@/lib/intelligence/run-trace";
import { buildAccountRunTrace, buildRunFailureTrace } from "@/lib/intelligence/run-trace-wiring";
import { deriveAccountActionabilityFunnel, summarizeActionabilityFunnel } from "@/lib/intelligence/actionability-funnel";
import { bindVerifiedClaimToSources } from "@/lib/intelligence/claim-provenance";

export interface StartIntelligenceRunInput {
  userId: string;
  context: ContextSelector;
  plan: PlanType;
  clientId?: string;
  idempotencyKey?: string;
  deliveryLimit: number;
  researchLimit: number;
}

export interface ProductiveSpineDeps {
  contextStore: ConfirmedContextStore;
  leadHunterStore: LeadHunterRunStore;
  runStore: IntelligenceRunStore;
  discoveryRunner: DiscoveryRunner;
  pipeline: (input: PipelineInput) => Promise<LeadLensReport>;
  now?: () => Date;
  // Optional runtime-observability sink. Receives one IntelligenceRunTrace per
  // researched account (and one run-level failure trace when a run fails before
  // research). Emission is best-effort and NEVER alters the run outcome (§39).
  onAccountTrace?: (trace: IntelligenceRunTrace) => void;
  // Whether this run used real providers. Only the caller knows; defaults to
  // "controlled" so a doubled run is never mislabeled as live evidence.
  traceProvenance?: "live" | "controlled";
  /** Bounded account-research concurrency (default 1 = serial). Env-gated at the route so
   * production stays serial until a live A/B validates the parallel path. */
  researchConcurrency?: number;
  // Optional Vault accretion sink. Receives the discovered candidate companies so
  // valid, customer-INDEPENDENT company facts can accumulate durably. Best-effort:
  // any error is swallowed and NEVER alters the Intelligence run (§30). Only public
  // facts are passed — no Fit/Timing/Decision/customer context (§4/§5).
  onDiscoveredCompanies?: (companies: Array<{ name: string; domain: string | null; country?: string | null; industry?: string | null }>) => void | Promise<void>;
  // Optional Vault RESEARCH accretion sink. Receives the researched accounts projected
  // to UNIVERSAL factual events (verified_public_signal claims + their sources), over ALL
  // researched accounts regardless of Case outcome (§3). Best-effort/failure-isolated
  // (§18). Carries no Fit/Timing/Decision/thesis/customer context (§5/§22).
  onResearchedAccounts?: (accounts: Array<{
    company: { name: string; domain: string | null; country?: string | null; industry?: string | null };
    events: Array<{ event_type: string | null; claim: string; event_date: string | null; source_url: string | null; corroborating_domains?: number | null }>;
  }>) => void | Promise<void>;
}

export type StartIntelligenceRunResult =
  | { ok: true; run: IntelligenceRunRecord; reused: boolean }
  | { ok: false; reason: string; runId?: string };

export async function enqueueIntelligenceRun(
  input: StartIntelligenceRunInput,
  deps: Pick<ProductiveSpineDeps, "contextStore" | "runStore" | "now">,
): Promise<StartIntelligenceRunResult> {
  const runId = intelligenceRunId(input);
  const existing = await deps.runStore.load(runId, input.userId);
  if (existing) return { ok: true, run: existing, reused: true };
  const built = await buildDiscoveryJobInput(deps.contextStore, input.userId, input.context, { plan: input.plan });
  if (!built.ok) return { ok: false, reason: built.reason, runId };
  const now = (deps.now ?? (() => new Date()))().toISOString();
  const run: IntelligenceRunRecord = {
    runId, userId: input.userId, contextRef: built.input.contextRef, clientId: input.clientId ?? null,
    plan: input.plan, status: "processing", stage: "queued", leadHunterRunId: null,
    report: null, failureCode: null, attempt: 1, executionGeneration: 0, deliveryLimit: input.deliveryLimit,
    researchLimit: input.researchLimit, createdAt: now, updatedAt: now,
  };
  const created = await deps.runStore.create(run);
  if (!created.created) {
    const raced = await deps.runStore.load(runId, input.userId);
    if (raced) return { ok: true, run: raced, reused: true };
    return { ok: false, reason: "run_creation_race", runId };
  }
  return { ok: true, run, reused: false };
}

export async function executeIntelligenceRun(
  runId: string,
  userId: string,
  deps: ProductiveSpineDeps,
): Promise<StartIntelligenceRunResult> {
  const record = await deps.runStore.load(runId, userId);
  if (!record) return { ok: false, reason: "run_not_found", runId };
  if (record.status === "completed") return { ok: true, run: record, reused: true };
  const stale = record.status === "processing" && Date.now() - new Date(record.updatedAt).getTime() > 15 * 60_000;
  const generation = await deps.runStore.claim(runId, userId, record.status === "failed" ? ["failed"] : ["processing"], stale);
  if (generation === null) return { ok: true, run: record, reused: true };
  const input: StartIntelligenceRunInput = {
    userId, context: record.contextRef, plan: record.plan, clientId: record.clientId ?? undefined,
    deliveryLimit: record.deliveryLimit, researchLimit: record.researchLimit,
  };
  // Carry the claimed generation so every authoritative write in this execution fences on
  // it — a stale/superseded executor can never overwrite this attempt's result (§19).
  return runIntelligenceExecution(input, deps, { ...record, executionGeneration: generation }, runId);
}

export function intelligenceRunId(input: Pick<StartIntelligenceRunInput, "userId" | "context" | "idempotencyKey">): string {
  const stable = `${input.userId}|${input.context.contextId}|${input.context.version ?? "latest"}|${input.idempotencyKey ?? "initial"}`;
  return `intel_${createHash("sha256").update(stable).digest("hex").slice(0, 32)}`;
}

/** One productive server-side chain. The only browser-controlled inputs are
 * references and technical presentation limits; candidates/evidence/decisions
 * are resolved or produced behind this boundary. */
export async function startIntelligenceRun(
  input: StartIntelligenceRunInput,
  deps: ProductiveSpineDeps,
): Promise<StartIntelligenceRunResult> {
  const queued = await enqueueIntelligenceRun(input, deps);
  if (!queued.ok || queued.run.status === "completed") return queued;
  return executeIntelligenceRun(queued.run.runId, input.userId, deps);
}

async function runIntelligenceExecution(
  input: StartIntelligenceRunInput,
  deps: ProductiveSpineDeps,
  initial: IntelligenceRunRecord,
  runId: string,
): Promise<StartIntelligenceRunResult> {
  const existing = initial;

  const built = await buildDiscoveryJobInput(deps.contextStore, input.userId, input.context, { plan: input.plan });
  if (!built.ok) return { ok: false, reason: built.reason, runId };
  // Exact version is resolved once and frozen. A later V2 cannot alter this run.
  const contextRef = built.input.contextRef;
  const now = (deps.now ?? (() => new Date()))();
  let run: IntelligenceRunRecord = existing;
  const runStartedMs = Date.now();
  const contextRefSafe = typeof contextRef === "string" ? contextRef : ((contextRef as { contextId?: string }).contextId ?? "context");

  if (existing.status === "failed") run = { ...run, attempt: run.attempt + 1 };

  const saveStage = async (stage: IntelligenceRunRecord["stage"], patch: Partial<IntelligenceRunRecord> = {}) => {
    run = { ...run, ...patch, stage, status: "processing", failureCode: null, updatedAt: (deps.now ?? (() => new Date()))().toISOString() };
    // Fenced write: if this executor's generation was superseded (a newer attempt reclaimed
    // the run), save() returns false → abort cleanly so we never overwrite the newer attempt.
    if (!(await deps.runStore.save(run))) throw new StaleExecutorError();
  };

  try {
    await saveStage("lead_hunter");
    let leadHunterRunId = run.leadHunterRunId;
    let persistedUniverse = leadHunterRunId
      ? await loadLeadHunterUniverse(deps.leadHunterStore, leadHunterRunId, input.userId)
      : null;
    if (!persistedUniverse) {
      const hunted = await runAndPersistLeadHunter(
        deps.contextStore, deps.leadHunterStore, input.userId, contextRef,
        deps.discoveryRunner, { now: () => new Date(run.createdAt), runScope: `${runId}_a${run.attempt}`, budget: runDiscoveryBudget(input.plan) },
      );
      if (!hunted.ok || !hunted.universe.ok) throw new Error(hunted.ok ? (hunted.universe.failureReason ?? "lead_hunter_failed") : hunted.reason);
      leadHunterRunId = hunted.runId;
      persistedUniverse = await loadLeadHunterUniverse(deps.leadHunterStore, hunted.runId, input.userId);
    }
    if (!leadHunterRunId) throw new Error("lead_hunter_run_unavailable");
    run.leadHunterRunId = leadHunterRunId;
    await saveStage("research", { leadHunterRunId });

    // Mandatory reload proves Research consumes durable Lead Hunter output, not
    // the transient return value and not an independent discovery path.
    if (!persistedUniverse) throw new Error("persisted_universe_unavailable");
    const candidates = toResearchCandidates(persistedUniverse);
    if (candidates.length === 0) throw new Error("no_research_ready_candidates");

    // Vault accretion (best-effort, failure-isolated): valid discovered companies
    // accumulate as reusable universal facts. NEVER passes customer-relative fields,
    // and a failure here can never alter the Intelligence run (§30).
    if (deps.onDiscoveredCompanies) {
      try {
        await deps.onDiscoveredCompanies(candidates.map((c) => ({ name: c.company, domain: c.domain ?? null, country: c.country ?? c.location ?? null, industry: c.industry ?? null })));
      } catch { /* Vault accretion must never break a run */ }
    }

    const researchLimit = Math.min(candidates.length, Math.max(input.deliveryLimit, input.researchLimit));
    let researchedLeads: ProcessedLead[] = [];
    const researchStartedMs = Date.now();
    const report = await deps.pipeline({
      onboardingData: built.input.onboardingData,
      plan: input.plan,
      jobId: runId,
      criteriaOverride: built.input.criteria,
      icpOverride: built.input.icp,
      candidatesOverride: candidates,
      researchCandidateLimit: researchLimit,
      // The productive spine needs the bounded EVALUATED set to synthesize
      // canonical Monitor/Hold Cases. Tier limits are applied below only to
      // actionable Prioritize/Validate accounts; they must not erase continuity.
      deliveryLimit: researchLimit,
      decisionOnly: true,
      researchConcurrency: deps.researchConcurrency ?? 1,
      onResearchComplete: (leads) => { researchedLeads = leads; },
    });

    const researchMs = Date.now() - researchStartedMs;
    await saveStage("case_synthesis");
    const caseSynthStartedMs = Date.now();
    // Real per-account case-synthesis timing (RUNTIME ATTRIBUTION V1) — measured per lead,
    // never a run-total divided by N. Case synthesis is deterministic and fast; this is a
    // truthful (if small) per-account component, not fabricated precision.
    const caseSynthMsByLead = new Map<string, number>();
    report.canonical_cases = report.processed_leads.flatMap((lead) => {
      const s = Date.now();
      const item = canonicalCaseForLead(lead);
      caseSynthMsByLead.set(lead.id, Date.now() - s);
      return item ? [item] : [];
    });
    // Canonical Case is the customer-truth authority. Research prose is generated
    // before deterministic event validation and may describe a plausible event
    // that did not survive temporal/materiality gates. Reconcile presentation
    // only; never mutate score, ranking or the canonical Decision.
    for (const lead of report.processed_leads) {
      const canonical = report.canonical_cases.find(item => item.lead_id === lead.id) ?? null;
      reconcileLeadNarrativeWithCanonicalCase(lead, canonical);
      const ranked = report.ranked_opportunities?.find(item => item.lead_id === lead.id);
      if (ranked?.decision && canonical && canonicalMissingEvent(canonical.reasons)) {
        ranked.decision.why_now = lead.enrichment.why_now ?? "No current dated material event was validated.";
        ranked.decision.why_this_quarter = "No quarter-level urgency is evidenced by a validated current event.";
        ranked.decision.evidence_grounded = false;
      }
    }
    run.researchAudit = researchedLeads.map(lead => {
      const c = report.canonical_cases?.find(item => item.lead_id === lead.id);
      return {
        company: lead.candidate.company, domain: lead.candidate.domain ?? null,
        country: lead.candidate.country ?? lead.candidate.location ?? null,
        category: lead.qualification.category, fitScore: lead.qualification.fit_score,
        signalDate: lead.candidate.signal_date ?? null, sourceUrl: lead.candidate.source_url ?? null,
        signalType: lead.candidate.signal_type ?? null,
        researchConfidence: lead.enrichment.research_confidence ?? null,
        accountResearch: lead.enrichment.account_research ?? null,
        evidenceClaims: (lead.enrichment.evidence_discipline ?? []).map(claim => {
          const supporting_sources = bindVerifiedClaimToSources({ claim: claim.claim, type: claim.type, date: claim.date ?? null, telemetry: lead.enrichment.account_research });
          return { type: claim.type, claim: claim.claim, date: claim.date ?? null,
            source_url: supporting_sources[0]?.url ?? null, source_id: supporting_sources[0]?.source_id ?? null, supporting_sources };
        }),
        risks: lead.enrichment.opportunity_risks ?? [],
        nextQuestion: lead.enrichment.next_best_question ?? null,
        qcStatus: lead.outreach.qc_status ?? null,
        canonicalDecision: c?.decision ?? "hold", reasons: c?.reasons ?? ["case_missing"],
        actionability: deriveAccountActionabilityFunnel(lead, c?.decision ?? null, c?.reasons ?? ["case_missing"]),
      };
    });
    // Emit one runtime-observability trace per researched account from the REAL
    // telemetry + measured durations, over ALL researched accounts (before the
    // deliverable filter). Best-effort; never affects the run outcome (§39).
    if (deps.onAccountTrace) emitAccountTraces(runId, contextRefSafe, researchedLeads, report.canonical_cases ?? [], caseSynthMsByLead, deps.onAccountTrace, deps.traceProvenance ?? "controlled");
    // Vault RESEARCH accretion (best-effort, failure-isolated, §18): project ALL
    // researched accounts (before the deliverable filter, §3) to UNIVERSAL factual events
    // — only verified_public_signal claims with a source. NO Fit/Timing/Decision/customer
    // context is ever passed. A failure here can never alter the run (§18).
    if (deps.onResearchedAccounts) {
      try {
        await deps.onResearchedAccounts(researchedLeads.map((lead) => ({
          company: { name: lead.candidate.company, domain: lead.candidate.domain ?? null, country: lead.candidate.country ?? lead.candidate.location ?? null, industry: lead.candidate.industry ?? null },
          events: (lead.enrichment.evidence_discipline ?? [])
            .filter((claim) => claim.type === "verified_public_signal" && Boolean(lead.candidate.source_url) && isMaterialEventClaim(claim.claim))
            .map((claim) => ({
              event_type: lead.candidate.signal_type ?? null,
              claim: claim.claim,
              event_date: claim.date ?? null,
              source_url: lead.candidate.source_url ?? null,
              corroborating_domains: lead.enrichment.account_research?.corroborating_domains ?? null,
            })),
        })));
      } catch { /* Vault accretion must never break a run */ }
    }
    // DECISION-FIRST PORTFOLIO: the customer result is a portfolio of evaluated
    // accounts, not only "strong" ones. Prioritize/Validate (attention now) AND
    // Monitor + eligible Hold (worth remembering + reevaluating) are all retained,
    // so account continuity (Account Memory), What-Changed, and Portfolio
    // Intelligence see the full evaluated set. Only NON-account noise is dropped:
    // structural rejects (qc FAILED — wrong entity / invalid identity, §4-§6) and
    // DISCARD-tier candidates. Failure honesty (§4) is preserved via a SEPARATE
    // strong-opportunity count below — never inferred from portfolio size.
    // Strong count (Prioritize/Validate ONLY) is computed here — never the full
    // portfolio size — so a Monitor/Hold-only run is an honest abstention, not
    // "opportunities found" (§4, failure honesty).
    const admitted = selectPortfolioAdmission(
      report.canonical_cases.map(c => ({ lead_id: c.lead_id, decision: c.decision })),
      report.processed_leads.map(l => ({ id: l.id, qc_status: l.outreach?.qc_status ?? null, category: l.qualification?.category ?? null })),
    );
    const decisionById = new Map(report.canonical_cases.map((c) => [c.lead_id, c.decision] as const));
    const rankedIds = (report.ranked_opportunities ?? []).map((item) => item.lead_id);
    const fallbackIds = report.canonical_cases.map((item) => item.lead_id);
    const strongIds = new Set([...rankedIds, ...fallbackIds]
      .filter((id, index, all) => all.indexOf(id) === index)
      .filter((id) => admitted.portfolioIds.has(id) && (decisionById.get(id) === "prioritize" || decisionById.get(id) === "validate"))
      .slice(0, input.deliveryLimit));
    const portfolioIds = new Set(Array.from(admitted.portfolioIds).filter((id) => {
      const decision = decisionById.get(id);
      return decision === "monitor" || decision === "hold" || strongIds.has(id);
    }));
    const strongCount = strongIds.size;
    report.canonical_cases = report.canonical_cases.filter(c => portfolioIds.has(c.lead_id));
    report.processed_leads = report.processed_leads.filter(lead => portfolioIds.has(lead.id));
    report.ranked_opportunities = (report.ranked_opportunities ?? []).filter(item => portfolioIds.has(item.lead_id));
    report.total_leads = report.processed_leads.length;
    report.hot_count = report.processed_leads.filter(lead => lead.qualification.category === "HOT").length;
    report.warm_count = report.processed_leads.filter(lead => lead.qualification.category === "WARM").length;
    report.cold_count = report.processed_leads.filter(lead => lead.qualification.category === "COLD").length;
    report.discard_count = report.processed_leads.filter(lead => lead.qualification.category === "DISCARD").length;
    report.avg_score = report.processed_leads.length ? Math.round(report.processed_leads.reduce((sum, lead) => sum + lead.qualification.fit_score, 0) / report.processed_leads.length * 10) / 10 : 0;
    if (report.report_intelligence) report.report_intelligence.companies_selected = report.processed_leads.length;
    // Failure honesty: classify run-level coverage from the REAL per-account telemetry so a
    // degraded/insufficient run is not reported as a healthy "no strong opportunity" (§4).
    const coverageState = classifyRunCoverage(researchedLeads.map((lead) => lead.enrichment.account_research ?? null));
    const actionabilityFunnel = summarizeActionabilityFunnel((run.researchAudit ?? []).flatMap((item) => item.actionability ? [item.actionability] : []));
    const commercialOutcome = strongCount > 0 ? "completed_with_opportunities"
      : coverageState === "insufficient" ? "completed_insufficient_coverage" : "completed_no_strong_opportunity";
    (report as LeadLensReport & { _intelligence_run?: unknown })._intelligence_run = {
      kind: "productive_intelligence_spine_v1", contextRef, leadHunterRunId,
      stage: "report", researched: researchLimit, delivered: strongCount, portfolioAccounts: report.processed_leads.length,
      discoveryProvenanceIsEvidence: false, firstReview: true,
      coverageState, commercialOutcome, actionabilityFunnel,
    };

    run = { ...run, coverageState, status: "completed", stage: "report", report, failureCode: null, updatedAt: (deps.now ?? (() => new Date()))().toISOString() };
    // Fenced finalize: a stale executor cannot overwrite a newer attempt's completed result.
    if (!(await deps.runStore.save(run))) return { ok: true, run, reused: true };
    return { ok: true, run, reused: false };
  } catch (error) {
    // A superseded executor aborts silently — it must not write a failure over the newer
    // attempt that reclaimed the run (§18/§24).
    if (error instanceof StaleExecutorError) return { ok: true, run, reused: true };
    const code = safeFailureCode(error);
    // A run that failed before/without account research still finalizes ONE bounded
    // trace so no diagnostics are lost (§22). Best-effort; never rethrows.
    if (deps.onAccountTrace) {
      try {
        const failureClass = /timeout/i.test(code) ? "timeout" : /provider|lead_hunter|discovery/i.test(code) ? "provider" : /candidate/i.test(code) ? "discovery" : "case_synthesis";
        deps.onAccountTrace(buildRunFailureTrace({ runId, contextRefSafe, failure_class: failureClass, provenance: deps.traceProvenance ?? "controlled" }));
      } catch { /* telemetry must never break failure handling */ }
    }
    run = { ...run, status: "failed", failureCode: code, updatedAt: (deps.now ?? (() => new Date()))().toISOString() };
    await deps.runStore.save(run).catch(() => {});
    return { ok: false, reason: code, runId };
  }
}

function runDiscoveryBudget(plan: PlanType): DiscoveryBudget {
  if (plan === "sample") return { maxRoutes: 4, maxProviderCalls: 20, maxCandidatesPerRoute: 15, maxExtractions: 12, maxRetries: 0, timeoutMs: 120_000 };
  if (plan === "starter") return { maxRoutes: 5, maxProviderCalls: 40, maxCandidatesPerRoute: 24, maxExtractions: 24, maxRetries: 1, timeoutMs: 180_000 };
  if (plan === "standard") return { maxRoutes: 6, maxProviderCalls: 64, maxCandidatesPerRoute: 36, maxExtractions: 40, maxRetries: 1, timeoutMs: 240_000 };
  return { maxRoutes: 6, maxProviderCalls: 90, maxCandidatesPerRoute: 48, maxExtractions: 60, maxRetries: 1, timeoutMs: 270_000 };
}

function strength(score: number): "Strong" | "Moderate" | "Limited" {
  return score >= 7 ? "Strong" : score >= 4 ? "Moderate" : "Limited";
}

/** A primary source may be attached only to claims Research classified as
 * externally verified. Context inference, weak inference and missing evidence
 * must never inherit the candidate's primary URL merely because they appear in
 * the same analyst response. This is conservative until the Research contract
 * carries a validated source id for every individual claim. */
export function evidenceClaimSourceUrl(type: string, primaryUrl: string | null | undefined): string | null {
  return type === "verified_public_signal" ? (primaryUrl ?? null) : null;
}

export function canonicalCaseForLead(lead: ProcessedLead): NonNullable<LeadLensReport["canonical_cases"]>[number] | null {
  if (lead.outreach.qc_status === "FAILED") return null;
  const c = lead.candidate;
  const e = lead.enrichment;
  // A verified_public_signal claim is only a MATERIAL dated event when its text is a real
  // corporate change, not a static company fact/metric (§3/§6). A validated event date on
  // the candidate (set upstream ONLY from a deterministically validated event, §7) is an
  // independent, trustworthy material-event indicator; the loose evidence_discipline claim
  // is the fallback and must pass the same materiality gate.
  const hasValidatedEvent = Boolean(c.signal_date);
  const signalDate = c.signal_date ?? null;
  const sourceHost = (() => { try { return c.source_url ? new URL(c.source_url).hostname : null; } catch { return null; } })();
  const ar = e.account_research;
  const telemetryConfirmsEvent = ar
    ? (ar.validated_events ?? []).some((event) => event.materiality_valid && event.event_date === signalDate)
    : true; // compatibility for older persisted/controlled records without deep telemetry
  const verifiedSignal = Boolean(hasValidatedEvent && signalDate && sourceHost && telemetryConfirmsEvent);
  const evidenceStrength = sourceHost ? (e.research_confidence >= 0.75 ? "Strong" : "Moderate") : "Limited";
  // Preserve independent support computed during Account Deep Research (previously
  // hardcoded false, discarding real corroboration). The Research corroboration loop
  // already required a DISTINCT origin (host !== primary) corroborating the SAME
  // primary event, so primary + >=1 corroborating domain = >=2 distinct origins
  // (CLAUDE.md independence rule). Credited only when the Case rests on a material
  // event (claim-relative, §13/§15) — never on a static or unverified signal.
  const independentSupportNew = verifiedSignal
    && ar?.corroboration_attempted === true
    && (ar?.corroborating_domains ?? 0) >= 1;
  const canonical = synthesizeCase({
    accountId: c.company,
    identityVerified: Boolean(c.domain),
    fromUniverse: true,
    signalKind: verifiedSignal ? (c.signal_type ?? "corporate_event") : null,
    signalDate,
    dateConfidence: verifiedSignal ? "high" : signalDate ? "medium" : "none",
    sourceHost,
    materialEvent: verifiedSignal,
    hasMaterialCounter: e.account_research?.counterevidence_material_found === true
      || (e.opportunity_risks ?? []).some((risk) => /cancel|contradict|insolven|third.party|terceriz/i.test(risk)),
    openDecisionCritical: e.next_best_question ? [e.next_best_question] : [],
    priorFit: strength(lead.qualification.fit_score),
    priorTiming: verifiedSignal ? "Moderate" : "Limited",
    priorEvidence: evidenceStrength,
    independentSupportNew,
    hasPostReviewEvent: false,
    geographyConfirmed: Boolean(c.country || c.location),
    regionRequired: false,
  });
  return {
    lead_id: lead.id, account_id: c.company, decision: canonical.decision,
    decision_source: canonical.decisionSource, verdict_status: canonical.verdictStatus,
    reasons: canonical.reasons, fit: canonical.fit, timing: canonical.timing,
    evidence: canonical.evidence, first_review: true,
  };
}

/** Keep pre-validation analyst prose from contradicting the canonical Case.
 * This is a presentation reconciliation, not a Decision/scoring override. */
export function reconcileLeadNarrativeWithCanonicalCase(
  lead: ProcessedLead,
  canonical: NonNullable<LeadLensReport["canonical_cases"]>[number] | null,
): void {
  if (!canonical) return;
  const noCurrentEvent = canonicalMissingEvent(canonical.reasons);
  if (!noCurrentEvent) return;
  lead.enrichment.why_now = "No current dated material event was validated. The account may fit structurally, but there is no verified reason to act now rather than monitor for a new trigger.";
  lead.enrichment.buying_window_reason = "No buying window is inferred without a validated current material event.";
}

function canonicalMissingEvent(reasons: string[]): boolean {
  return reasons.some(reason => /(?:^|_)no_(?:current_)?event$|no_material_event|no_valid_date/.test(reason));
}

// Emit one run-trace per researched account from REAL execution telemetry + REAL
// measured durations. Best-effort: any error here is swallowed so a telemetry fault
// can never change the run outcome (§39). Only safe references are used (§24).
function emitAccountTraces(
  runId: string, contextRefSafe: string,
  researchedLeads: ProcessedLead[], cases: NonNullable<LeadLensReport["canonical_cases"]>,
  caseSynthMsByLead: Map<string, number>,
  onAccountTrace: (trace: IntelligenceRunTrace) => void, provenance: "live" | "controlled",
): void {
  // Per-account attribution (RUNTIME ATTRIBUTION V1): each account's wall clock and stage
  // durations come from ITS OWN telemetry (provider_ops real per-op durations) + ITS OWN
  // measured case-synthesis time — never the whole-run elapsed divided by N.
  for (const lead of researchedLeads) {
    try {
      const c = cases.find((item) => item.lead_id === lead.id) ?? null;
      onAccountTrace(buildAccountRunTrace({
        runId,
        accountId: lead.candidate.domain ?? lead.candidate.company,
        contextRefSafe,
        telemetry: lead.enrichment.account_research ?? null,
        decision: c?.decision ?? null,
        caseCompleted: Boolean(c),
        // A genuine structural QC rejection (never a provider/processing failure, §6).
        structural_disqualifier: lead.outreach.qc_status === "FAILED",
        // No synthetic per-account research time: real per-op durations come from the
        // telemetry's provider_ops inside buildAccountRunTrace. 0 = "not separately
        // measurable" for legacy telemetry without per-op timing (honest, not divided).
        research_stage_ms: 0,
        case_synthesis_ms: caseSynthMsByLead.get(lead.id) ?? 0,
        provenance,
      }));
    } catch { /* telemetry must never break a run */ }
  }
}

/** Thrown when a fenced write finds this executor's generation superseded — the executor
 *  aborts cleanly rather than overwriting the newer attempt (RUNTIME SCALE SAFETY V1 §19). */
class StaleExecutorError extends Error {
  constructor() { super("stale_executor"); this.name = "StaleExecutorError"; }
}

function safeFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "intelligence_run_failed";
}
