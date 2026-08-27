import { createHash } from "node:crypto";
import type { LeadLensReport, LeadCandidate, PipelineInput, PlanType, ProcessedLead } from "@/types";
import type { ConfirmedContextStore, ContextSelector } from "@/lib/interpretation/confirmed-context-store";
import { buildDiscoveryJobInput } from "@/lib/interpretation/confirmed-context-execution";
import type { DiscoveryRunner } from "@/lib/lead-hunter/candidate-universe";
import type { LeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import { loadLeadHunterUniverse, runAndPersistLeadHunter, toResearchCandidates } from "@/lib/lead-hunter/hunt-and-persist";
import { synthesizeCase } from "@/lib/monitor/canonical-case";
import type { IntelligenceRunRecord, IntelligenceRunStore } from "./productive-spine-store";

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
  const runId = intelligenceRunId(input);
  const existing = await deps.runStore.load(runId, input.userId);
  if (existing?.status === "completed") return { ok: true, run: existing, reused: true };

  const built = await buildDiscoveryJobInput(deps.contextStore, input.userId, input.context, { plan: input.plan });
  if (!built.ok) return { ok: false, reason: built.reason, runId };
  // Exact version is resolved once and frozen. A later V2 cannot alter this run.
  const contextRef = built.input.contextRef;
  const now = (deps.now ?? (() => new Date()))();
  let run: IntelligenceRunRecord = existing ?? {
    runId, userId: input.userId, contextRef, clientId: input.clientId ?? null,
    plan: input.plan, status: "processing", stage: "lead_hunter", leadHunterRunId: null,
    report: null, failureCode: null, attempt: 1, createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
  if (!existing) {
    const created = await deps.runStore.create(run);
    if (!created.created) {
      const raced = await deps.runStore.load(runId, input.userId);
      if (raced?.status === "completed") return { ok: true, run: raced, reused: true };
      if (raced) run = raced;
    }
  }

  if (existing?.status === "failed") run = { ...run, attempt: run.attempt + 1 };

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
        deps.discoveryRunner, { now: () => new Date(run.createdAt), runScope: `${runId}_a${run.attempt}` },
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
    const report = await deps.pipeline({
      onboardingData: built.input.onboardingData,
      plan: input.plan,
      jobId: runId,
      criteriaOverride: built.input.criteria,
      icpOverride: built.input.icp,
      candidatesOverride: candidates,
      researchCandidateLimit: researchLimit,
      deliveryLimit: input.deliveryLimit,
      decisionOnly: true,
    });

    await saveStage("case_synthesis");
    report.canonical_cases = report.processed_leads.flatMap((lead) => {
      const item = canonicalCaseForLead(lead);
      return item ? [item] : [];
    });
    (report as LeadLensReport & { _intelligence_run?: unknown })._intelligence_run = {
      kind: "productive_intelligence_spine_v1", contextRef, leadHunterRunId,
      stage: "report", researched: researchLimit, delivered: report.processed_leads.length,
      discoveryProvenanceIsEvidence: false, firstReview: true,
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
