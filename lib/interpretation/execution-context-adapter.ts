// ─── Execution Context Adapter — Stage A → canonical Stage B commercial context ─
//
// This is the ONE seam that turns a user-CONFIRMED commercial context into the
// canonical structured configuration LeadLens intelligence execution already
// consumes. It is the boundary the previous phase documented but did not build
// (see `EXECUTION_ADAPTER_BOUNDARY` in confirmed-commercial-context.ts).
//
// It maps ConfirmedCommercialContextV1 → the EXISTING canonical
// CommercialContextInput / CommercialContext (lib/commercial/commercial-context).
// It does NOT invent a second downstream pipeline, and it reuses the canonical
// normalizer rather than re-implementing country/region logic.
//
// TRUTH BOUNDARIES (enforced here + by tests):
//   • NO raw prose dependency. The adapter reads only STRUCTURED confirmed
//     context — it never touches rawInputRef. Once confirmed, Stage B never
//     depends on the user's original sentence.
//   • NO query generation. Provider queries are owned downstream
//     (Discovery / Lead Hunter / Research), never here (§29).
//   • NO evidence / signal / fact / fit / timing / decision. Signal hypotheses
//     become WATCH CONFIGURATION (families to look for), never observations.
//   • NO provider, NO LLM, NO network, NO persistence, NO account discovery.
//   • Unsupported / ambiguous / degenerate context is REJECTED, not executed.

import type { ConfirmedCommercialContextV1 } from "./confirmed-commercial-context";
import { confirmInterpretation, type ConfirmationOptions } from "./confirmed-commercial-context";
import type { CompanyInterpretationV1 } from "./company-interpretation";
import type { SignalFamily } from "@/lib/discovery/needs-map";
import type { CommercialContext, CommercialContextInput } from "@/lib/commercial/commercial-context";
import { normalizeCommercialContext } from "@/lib/commercial/commercial-context";

/** Stable identity + version so Account Memory can later distinguish "the account
 *  changed" from "the customer's commercial context changed" (§26). */
export interface ExecutionContextRef {
  contextId: string;
  version: number;
  effectiveFrom: string; // ISO
  supersedes?: { contextId: string; version: number };
}

export interface AdaptedExecutionContext {
  /** THE canonical downstream commercial context (normalized) that Discovery /
   *  Research already consumes. This is the primary output. */
  commercialContext: CommercialContext;
  /** The canonical pre-normalization input, for callers that re-normalize or
   *  persist the raw mapping. */
  commercialContextInput: CommercialContextInput;
  /** Signal families to WATCH — hypotheses about what to look for, never observed
   *  signals. Downstream turns these into queries; the adapter does not. */
  watchSignalFamilies: SignalFamily[];
  /** Hard negative targeting (exclude). Configuration, NOT counterevidence. */
  hardExclusions: string[];
  /** Soft/strong negative targeting. Configuration, NOT counterevidence. */
  strongNegatives: string[];
  /** Stable context identity + version for cause attribution downstream. */
  ref: ExecutionContextRef;
  /** Provenance roll-up so downstream never mistakes user context for evidence. */
  provenanceSummary: string;
  illustrative?: boolean;
}

export type AdapterResult =
  | { ok: true; execution: AdaptedExecutionContext }
  | { ok: false; reason: string; missing: string[] };

const clean = (s: string | undefined | null): string => (s ?? "").trim().replace(/\s+/g, " ");
const dedupe = <T,>(xs: T[]): T[] => Array.from(new Set(xs));
const joinNonEmpty = (xs: (string | undefined)[]): string =>
  dedupe(xs.map((x) => clean(x)).filter(Boolean)).join(", ");

/** A single, consistent regionKey across all geographies, or undefined when they
 *  disagree (canonical normalizeCommercialContext still derives a region from the
 *  countries themselves). */
function singleRegionKey(ctx: ConfirmedCommercialContextV1): string | undefined {
  const keys = dedupe(
    (ctx.targetAccountProfile.geographies ?? [])
      .map((g) => clean(g.regionKey))
      .filter(Boolean),
  );
  return keys.length === 1 ? keys[0] : undefined;
}

/** Who the customer is trying to reach, as a single descriptor string. Built only
 *  from user-stated / user-confirmed descriptors — never invented. Empty is a
 *  legitimate value when the target is discovery-required (Discovery determines
 *  the universe). */
function buyerDescriptor(ctx: ConfirmedCommercialContextV1): string {
  const t = ctx.targetAccountProfile;
  return joinNonEmpty([...(t.organizationTypes ?? []), ...(t.industries ?? [])]);
}

/** What the company does to solve the buyer's problem. Honest mapping from
 *  capabilities → structural/required opportunity conditions; never fabricated. */
function problemSolved(ctx: ConfirmedCommercialContextV1): string {
  const caps = ctx.companyProfile.capabilities.map((c) => c.value);
  if (caps.some((c) => clean(c))) return joinNonEmpty(caps);
  const structural = ctx.opportunityConditions
    .filter((c) => c.type === "structural" || c.effect === "required")
    .map((c) => c.description);
  return joinNonEmpty(structural);
}

function mapToCommercialInput(ctx: ConfirmedCommercialContextV1): CommercialContextInput {
  const offer = joinNonEmpty(ctx.companyProfile.offers.map((o) => o.value.label));
  return {
    company_description: clean(ctx.companyProfile.companyDescription?.value),
    offer,
    buyer: buyerDescriptor(ctx),
    problem_solved: problemSolved(ctx),
    target_countries: (ctx.targetAccountProfile.geographies ?? []).map((g) => clean(g.label)).filter(Boolean),
    commercial_goal: clean(ctx.objective.description),
    target_market_region: singleRegionKey(ctx) ?? null,
  };
}

/**
 * The Stage A → Stage B doorway. Maps a CONFIRMED commercial context into the
 * canonical execution commercial context, or REFUSES.
 *
 * Refusal is defensive: by construction a ConfirmedCommercialContextV1 already
 * passed the confirmation gate (supported objective, no blockers, execution-
 * ready). The adapter re-checks the *resulting* canonical context so a degenerate
 * confirmed context (empty goal, or an undefined target that is not legitimately
 * discovery-required) can never silently reach real research.
 */
export function adaptConfirmedContext(ctx: ConfirmedCommercialContextV1): AdapterResult {
  const missing: string[] = [];

  if (ctx.schemaVersion !== "1") missing.push("schema_version");

  const input = mapToCommercialInput(ctx);

  if (!clean(input.commercial_goal)) missing.push("commercial_goal");

  // Target must be usable: a buyer descriptor OR a legitimate discovery-required
  // universe (LeadLens would discover it). An undefined target that is NOT
  // discovery-required is not executable.
  const discoveryRequired = ctx.targetAccountProfile.definitionStatus === "discovery_required";
  if (!clean(input.buyer) && !discoveryRequired) missing.push("target_definition");

  if (missing.length > 0) {
    return { ok: false, reason: "not_executable", missing };
  }

  const commercialContext = normalizeCommercialContext(input);

  const watchSignalFamilies = dedupe(ctx.signalHypotheses.map((h) => h.family));
  const hardExclusions = dedupe([
    ...ctx.disqualifiers.filter((d) => d.severity === "exclude").map((d) => clean(d.rule)),
    ...(ctx.targetAccountProfile.exclusions ?? []).map(clean),
  ]).filter(Boolean);
  const strongNegatives = dedupe(
    ctx.disqualifiers.filter((d) => d.severity === "strong_negative").map((d) => clean(d.rule)),
  ).filter(Boolean);

  const execution: AdaptedExecutionContext = {
    commercialContext,
    commercialContextInput: input,
    watchSignalFamilies,
    hardExclusions,
    strongNegatives,
    ref: {
      contextId: ctx.contextId,
      version: ctx.version,
      effectiveFrom: ctx.effectiveFrom,
      supersedes: ctx.supersedes,
    },
    provenanceSummary: ctx.provenanceSummary,
    illustrative: ctx.illustrative,
  };
  return { ok: true, execution };
}

/**
 * Convenience end-to-end doorway: confirm an interpretation, then adapt it into
 * canonical execution context. Any confirmation failure (unsupported objective,
 * open blocker, not confirmable, not execution-ready, truth-boundary violation)
 * short-circuits into an adapter refusal — so an unconfirmed / ambiguous
 * interpretation can never reach execution config.
 */
export function adaptInterpretation(
  interp: CompanyInterpretationV1,
  opts: ConfirmationOptions,
): AdapterResult {
  const confirmed = confirmInterpretation(interp, opts);
  if (!confirmed.ok) return { ok: false, reason: confirmed.reason, missing: confirmed.missing };
  return adaptConfirmedContext(confirmed.context);
}
