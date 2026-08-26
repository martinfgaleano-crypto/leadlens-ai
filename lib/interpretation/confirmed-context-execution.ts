// ─── Confirmed context → real discovery execution (server-side orchestration) ──
//
// This is the operational seam that lets an AUTHENTICATED self-serve customer run
// real LeadLens discovery from a durable, confirmed commercial context — WITHOUT
// founder translation and WITHOUT the customer's raw prose becoming the execution
// contract.
//
//   authorized {contextId, version} → load (owner-scoped) → prepareDiscovery →
//   LeadSearchCriteria + server-derived OnboardingData + ICP override → pipeline.
//
// The pipeline already honors criteriaOverride + icpOverride and SKIPS prose ICP
// inference when both are supplied — so discovery runs from the structured
// confirmed context, not from any textarea or model response.
//
// BOUNDARIES:
//   • Server resolves the canonical context. The browser only names a
//     {contextId, version}; it never supplies a trusted context object.
//   • No raw prose. OnboardingData is DERIVED from the confirmed context.
//   • Fail-safe. Missing / unauthorized / unexecutable / store-unavailable all
//     return an explicit refusal and NEVER fall back to prose.
//   • No provider/LLM here — the injected pipeline owns Stage B.

import type { ICP, LeadSearchCriteria, OnboardingData, PlanType, OutputLanguage } from "@/types";
import {
  loadConfirmedContext,
  type ConfirmedContextStore,
  type ContextSelector,
  type ConfirmedContextRecord,
} from "./confirmed-context-store";
import { confirmedContextToDiscoveryCriteria } from "./discovery-handoff";

const clean = (s: string | undefined | null): string => (s ?? "").trim().replace(/\s+/g, " ");

export interface DiscoveryExecutionInput {
  onboardingData: OnboardingData;
  criteria: LeadSearchCriteria;
  icp: ICP;
  plan: PlanType;
  contextRef: { contextId: string; version: number };
}

export type BuildResult =
  | { ok: true; input: DiscoveryExecutionInput }
  | { ok: false; reason: string };

export interface ExecutionOptions {
  plan?: PlanType;
  leadCount?: number;
  outputLanguage?: OutputLanguage;
  /** Authenticated customer email, from the session — never from the context. */
  contactEmail?: string;
  companyName?: string;
}

/** ICP synthesized from criteria — identical to the shape publicSignalProvider
 *  builds, so downstream discovery behaves the same as the existing path. */
function icpFromCriteria(criteria: LeadSearchCriteria): ICP {
  return {
    target_industries: criteria.target_industries ?? [],
    target_titles: criteria.target_job_titles ?? [],
    company_size_range: (criteria.target_company_size ?? []).join(", "),
    pain_points: [],
    disqualifiers: criteria.disqualification_criteria ?? [],
    ideal_signals: criteria.buying_signals ?? [],
    exclusions_explicit: criteria.excluded_industries ?? [],
  };
}

/** OnboardingData derived from the CONFIRMED CONTEXT (server-side) — never from
 *  the customer's raw textarea. Geography is aligned to the criteria so the
 *  pipeline's geography contract holds. */
function onboardingFromContext(
  record: ConfirmedContextRecord,
  criteria: LeadSearchCriteria,
  opts: ExecutionOptions,
): OnboardingData {
  const ctx = record.context;
  const description = clean(ctx.companyProfile.companyDescription?.value);
  return {
    company_name: clean(opts.companyName) || clean(record.clientId) || "Customer",
    company_description: description || clean(criteria.offer_summary),
    offer_description: clean(criteria.offer_summary),
    value_proposition: clean(criteria.value_proposition),
    target_customer_description: (criteria.target_industries ?? []).join(", "),
    tone: "consultative",
    contact_email: clean(opts.contactEmail),
    output_language: opts.outputLanguage,
    target_market_region: criteria.target_market_region,
    // Authoritative geography must equal the criteria the pipeline received.
    target_countries: criteria.target_geography.length ? criteria.target_geography : undefined,
  };
}

/**
 * Build the validated PipelineInput bundle from an authorized confirmed context.
 * Owner-scoped; returns a refusal (never throws for the not-found / not-ready
 * cases) so the caller can fail safe. A store error IS surfaced as a refusal
 * with reason "store_unavailable" — discovery must never proceed on prose.
 */
export async function buildDiscoveryJobInput(
  store: ConfirmedContextStore,
  userId: string,
  selector: ContextSelector,
  opts: ExecutionOptions = {},
): Promise<BuildResult> {
  let record: ConfirmedContextRecord | null;
  try {
    record = await loadConfirmedContext(store, userId, selector);
  } catch {
    return { ok: false, reason: "store_unavailable" };
  }
  if (!record) return { ok: false, reason: "context_not_found" };

  const criteria = confirmedContextToDiscoveryCriteria(record.context, {
    outputLanguage: opts.outputLanguage,
    plan: opts.plan,
    leadCount: opts.leadCount,
  });
  if (!criteria) return { ok: false, reason: "not_executable" };

  const icp = icpFromCriteria(criteria);
  const onboardingData = onboardingFromContext(record, criteria, opts);

  return {
    ok: true,
    input: {
      onboardingData,
      criteria,
      icp,
      plan: opts.plan ?? "standard",
      contextRef: { contextId: record.contextId, version: record.version },
    },
  };
}

/** The pipeline surface this seam depends on (subset of runLeadLensPipeline). */
export type PipelineRunner<R> = (input: {
  onboardingData: OnboardingData;
  plan: PlanType;
  criteriaOverride: LeadSearchCriteria;
  icpOverride: ICP;
  jobId?: string;
}) => Promise<R>;

export type ExecuteResult<R> =
  | { ok: true; report: R; contextRef: { contextId: string; version: number } }
  | { ok: false; reason: string };

/**
 * Full seam: authorize → load → adapt → run existing discovery pipeline with the
 * structured overrides (prose ICP inference is skipped). The pipeline is injected
 * so this is testable without providers, and so the same orchestration serves the
 * real route and the tests. Any failure short-circuits BEFORE the pipeline runs.
 */
export async function runDiscoveryFromConfirmedContext<R>(
  store: ConfirmedContextStore,
  userId: string,
  selector: ContextSelector,
  opts: ExecutionOptions,
  runPipeline: PipelineRunner<R>,
  jobId?: string,
): Promise<ExecuteResult<R>> {
  const built = await buildDiscoveryJobInput(store, userId, selector, opts);
  if (!built.ok) return { ok: false, reason: built.reason };

  const report = await runPipeline({
    onboardingData: built.input.onboardingData,
    plan: built.input.plan,
    criteriaOverride: built.input.criteria,
    icpOverride: built.input.icp,
    jobId,
  });
  return { ok: true, report, contextRef: built.input.contextRef };
}
