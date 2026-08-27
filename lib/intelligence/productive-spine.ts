import { createHash } from "node:crypto";
import type { LeadLensReport, LeadCandidate, PipelineInput, PlanType, ProcessedLead } from "@/types";
import type { ConfirmedContextStore, ContextSelector } from "@/lib/interpretation/confirmed-context-store";
import { buildDiscoveryJobInput } from "@/lib/interpretation/confirmed-context-execution";
import type { DiscoveryRunner } from "@/lib/lead-hunter/candidate-universe";
import type { LeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import { loadLeadHunterUniverse, runAndPersistLeadHunter, toResearchCandidates } from "@/lib/lead-hunter/hunt-and-persist";
import { synthesizeCase } from "@/lib/monitor/canonical-case";
import type { IntelligenceRunRecord, IntelligenceRunStore } from "./productive-spine-store";
import type { DiscoveryBudget } from "@/lib/lead-hunter/candidate-universe";

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
    report: null, failureCode: null, attempt: 1, deliveryLimit: input.deliveryLimit,
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
  const claimed = await deps.runStore.claim(runId, userId, record.status === "failed" ? ["failed"] : ["processing"], stale);
  if (!claimed) return { ok: true, run: record, reused: true };
  const input: StartIntelligenceRunInput = {
    userId, context: record.contextRef, plan: record.plan, clientId: record.clientId ?? undefined,
    deliveryLimit: record.deliveryLimit, researchLimit: record.researchLimit,
  };
  return runIntelligenceExecution(input, deps, record, runId);
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

  if (existing.status === "failed") run = { ...run, attempt: run.attempt + 1 };

  const saveStage = async (stage: IntelligenceRunRecord["stage"], patch: Partial<IntelligenceRunRecord> = {}) => {
    run = { ...run, ...patch, stage, status: "processing", failureCode: null, updatedAt: (deps.now ?? (() => new Date()))().toISOString() };
    await deps.runStore.save(run);
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

    const researchLimit = Math.min(candidates.length, Math.max(input.deliveryLimit, input.researchLimit));
    let researchedLeads: ProcessedLead[] = [];
    const report = await deps.pipeline({
      onboardingData: built.input.onboardingData,
      plan: input.plan,
      jobId: runId,
      criteriaOverride: built.input.criteria,
      icpOverride: built.input.icp,
      candidatesOverride: candidates,
      researchCandidateLimit: researchLimit,
      deliveryLimit: input.deliveryLimit,
      deliveryQualityFloor: "warm",
      decisionOnly: true,
      onResearchComplete: (leads) => { researchedLeads = leads; },
    });

    await saveStage("case_synthesis");
    report.canonical_cases = report.processed_leads.flatMap((lead) => {
      const item = canonicalCaseForLead(lead);
      return item ? [item] : [];
    });
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
        evidenceClaims: (lead.enrichment.evidence_discipline ?? []).map(claim => ({
          type: claim.type, claim: claim.claim, date: claim.date ?? null,
          source_url: lead.candidate.source_url ?? null,
        })),
        risks: lead.enrichment.opportunity_risks ?? [],
        nextQuestion: lead.enrichment.next_best_question ?? null,
        qcStatus: lead.outreach.qc_status ?? null,
        canonicalDecision: c?.decision ?? "hold", reasons: c?.reasons ?? ["case_missing"],
      };
    });
    // WARM is not enough for customer delivery. The canonical Case owns the
    // commercial truth: Monitor/Hold research remains counted but is not
    // presented as a strong opportunity result.
    const deliverableIds = new Set(report.canonical_cases.filter(c => c.decision === "prioritize" || c.decision === "validate").map(c => c.lead_id));
    report.canonical_cases = report.canonical_cases.filter(c => deliverableIds.has(c.lead_id));
    report.processed_leads = report.processed_leads.filter(lead => deliverableIds.has(lead.id));
    report.ranked_opportunities = (report.ranked_opportunities ?? []).filter(item => deliverableIds.has(item.lead_id));
    report.total_leads = report.processed_leads.length;
    report.hot_count = report.processed_leads.filter(lead => lead.qualification.category === "HOT").length;
    report.warm_count = report.processed_leads.filter(lead => lead.qualification.category === "WARM").length;
    report.cold_count = report.processed_leads.filter(lead => lead.qualification.category === "COLD").length;
    report.discard_count = report.processed_leads.filter(lead => lead.qualification.category === "DISCARD").length;
    report.avg_score = report.processed_leads.length ? Math.round(report.processed_leads.reduce((sum, lead) => sum + lead.qualification.fit_score, 0) / report.processed_leads.length * 10) / 10 : 0;
    if (report.report_intelligence) report.report_intelligence.companies_selected = report.processed_leads.length;
    (report as LeadLensReport & { _intelligence_run?: unknown })._intelligence_run = {
      kind: "productive_intelligence_spine_v1", contextRef, leadHunterRunId,
      stage: "report", researched: researchLimit, delivered: report.processed_leads.length,
      discoveryProvenanceIsEvidence: false, firstReview: true,
      commercialOutcome: report.processed_leads.length > 0 ? "completed_with_opportunities" : "completed_no_strong_opportunity",
    };

    run = { ...run, status: "completed", stage: "report", report, failureCode: null, updatedAt: (deps.now ?? (() => new Date()))().toISOString() };
    await deps.runStore.save(run);
    return { ok: true, run, reused: false };
  } catch (error) {
    const code = safeFailureCode(error);
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

function canonicalCaseForLead(lead: ProcessedLead): NonNullable<LeadLensReport["canonical_cases"]>[number] | null {
  if (lead.outreach.qc_status === "FAILED") return null;
  const c = lead.candidate;
  const e = lead.enrichment;
  const datedClaim = e.evidence_discipline?.find((claim) => claim.type === "verified_public_signal" && claim.date);
  const signalDate = c.signal_date ?? datedClaim?.date ?? null;
  const sourceHost = (() => { try { return c.source_url ? new URL(c.source_url).hostname : null; } catch { return null; } })();
  const verifiedSignal = Boolean(signalDate && sourceHost && datedClaim);
  const evidenceStrength = sourceHost ? (e.research_confidence >= 0.75 ? "Strong" : "Moderate") : "Limited";
  const canonical = synthesizeCase({
    accountId: c.company,
    identityVerified: Boolean(c.domain),
    fromUniverse: true,
    signalKind: verifiedSignal ? (c.signal_type ?? "corporate_event") : null,
    signalDate,
    dateConfidence: verifiedSignal ? "high" : signalDate ? "medium" : "none",
    sourceHost,
    materialEvent: verifiedSignal,
    hasMaterialCounter: (e.opportunity_risks ?? []).some((risk) => /cancel|contradict|insolven|third.party|terceriz/i.test(risk)),
    openDecisionCritical: e.next_best_question ? [e.next_best_question] : [],
    priorFit: strength(lead.qualification.fit_score),
    priorTiming: verifiedSignal ? "Moderate" : "Limited",
    priorEvidence: evidenceStrength,
    independentSupportNew: false,
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

function safeFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "intelligence_run_failed";
}
