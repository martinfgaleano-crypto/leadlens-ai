// ─── Live discovery handoff — confirmed context → canonical LeadSearchCriteria ─
//
// This is the seam that lets a durable, user-CONFIRMED commercial context become
// the input to LeadLens's real discovery entry point. The canonical discovery
// configuration object is `LeadSearchCriteria` (consumed by publicSignalProvider
// → runCompanyFirstDiscovery). This module maps a ConfirmedCommercialContextV1
// into that criteria — reusing adaptConfirmedContext (no second pipeline) — and
// exposes a server-side gate that loads an authorized persisted context and
// produces the criteria.
//
// BOUNDARIES:
//   • No raw prose. Criteria are built ONLY from the structured confirmed
//     context — never from rawInput / model output.
//   • No query generation here. buying_signals carries WATCH families (what to
//     look for); provider queries are still owned inside discovery.
//   • No evidence / fit / timing / decision. Signal hypotheses stay configuration;
//     exclusions stay negative-targeting configuration, not counterevidence.
//   • Only persisted (therefore confirmed) context can reach this path.

import type { LeadSearchCriteria, MarketRegion, OutputLanguage, PlanType } from "@/types";
import type { ConfirmedCommercialContextV1 } from "./confirmed-commercial-context";
import { adaptConfirmedContext } from "./execution-context-adapter";
import {
  loadConfirmedContext,
  type ConfirmedContextStore,
  type ContextSelector,
  type ConfirmedContextRecord,
} from "./confirmed-context-store";

const clean = (s: string | undefined | null): string => (s ?? "").trim().replace(/\s+/g, " ");
const dedupe = <T,>(xs: T[]): T[] => Array.from(new Set(xs));

/** Map a loose region key (Stage A / canonical derived_region) into the pipeline
 *  MarketRegion enum. Anything ambiguous or multi-region → "global". */
function toMarketRegion(key: string | null | undefined): MarketRegion | undefined {
  switch (clean(key).toLowerCase()) {
    case "latin_america": return "latin_america";
    case "north_america": return "north_america";
    case "europe": return "europe";
    case "asia":
    case "asia_pacific": return "asia";
    case "": return undefined;
    default: return "global";
  }
}

export interface DiscoveryHandoffOptions {
  /** Language for output; sourced from the interpretation at confirm time. */
  outputLanguage?: OutputLanguage;
  plan?: PlanType;
  leadCount?: number;
}

/**
 * Pure mapping: ConfirmedCommercialContextV1 → canonical LeadSearchCriteria.
 * Returns null only if the confirmed context is (defensively) not executable —
 * which should not happen for a persisted, confirmed context.
 */
export function confirmedContextToDiscoveryCriteria(
  ctx: ConfirmedCommercialContextV1,
  opts: DiscoveryHandoffOptions = {},
): LeadSearchCriteria | null {
  const adapted = adaptConfirmedContext(ctx);
  if (!adapted.ok) return null;
  const cc = adapted.execution.commercialContext;
  const t = ctx.targetAccountProfile;

  return {
    target_industries: dedupe((t.industries ?? []).map(clean).filter(Boolean)),
    target_company_size: t.size?.band ? [clean(t.size.band)] : [],
    target_job_titles: [], // Stage A never owns titles (stakeholder hypotheses are optional, not targeting).
    target_geography: cc.target_countries,
    excluded_industries: dedupe([
      ...adapted.execution.hardExclusions,
      ...(t.exclusions ?? []).map(clean),
    ]).filter(Boolean),
    // WATCH configuration: which event classes discovery should look for. These
    // are hypotheses, never observed signals.
    buying_signals: dedupe(adapted.execution.watchSignalFamilies.map(String)),
    disqualification_criteria: dedupe([
      ...adapted.execution.hardExclusions,
      ...adapted.execution.strongNegatives,
    ]).filter(Boolean),
    offer_summary: cc.offer,
    value_proposition: clean(cc.commercial_goal) || clean(cc.problem_solved),
    tone: "consultative",
    plan: opts.plan ?? "standard",
    lead_count: opts.leadCount ?? 10,
    output_language: opts.outputLanguage,
    target_market_region: toMarketRegion(cc.derived_region),
    // Self-serve real path is always fail-closed real discovery.
    require_real_discovery: true,
    sender_company_description: cc.company_description || undefined,
  };
}

/** Stable lineage carried alongside a prepared discovery config, so a job / an
 *  Opportunity Case can record which confirmed context version produced it. */
export interface DiscoveryContextRef {
  contextId: string;
  version: number;
}

export type PrepareDiscoveryResult =
  | { ok: true; criteria: LeadSearchCriteria; ref: DiscoveryContextRef }
  | { ok: false; reason: string };

/**
 * SERVER-SIDE gate: load an authorized, persisted (therefore confirmed) context
 * version for this owner, and produce the canonical discovery criteria.
 *
 *   confirmed persisted context → load (owner-scoped) → adapt → LeadSearchCriteria
 *
 * Fails safe: if no authorized context exists, it returns an error and NEVER
 * falls back to raw prose. Because only confirmed contexts are ever persisted,
 * an unconfirmed / unsupported / blocked interpretation can never reach here.
 */
export async function prepareDiscoveryFromContext(
  store: ConfirmedContextStore,
  userId: string,
  selector: ContextSelector,
  opts: DiscoveryHandoffOptions = {},
): Promise<PrepareDiscoveryResult> {
  const record: ConfirmedContextRecord | null = await loadConfirmedContext(store, userId, selector);
  if (!record) return { ok: false, reason: "context_not_found" };

  const criteria = confirmedContextToDiscoveryCriteria(record.context, opts);
  if (!criteria) return { ok: false, reason: "not_executable" };

  return { ok: true, criteria, ref: { contextId: record.contextId, version: record.version } };
}
