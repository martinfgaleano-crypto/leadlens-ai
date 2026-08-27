// ─── Automated Lead Hunter V1 — confirmed context → candidate account universe ─
//
// Turns a user-CONFIRMED commercial context into a defensible CandidateAccount
// Universe WITHOUT founder-by-founder selection. It is a deterministic, bounded,
// inspectable facade over the existing discovery engine (runCompanyFirstDiscovery
// / buildCompanyUniverse). It plans discovery, runs bounded multi-route discovery
// through an injected runner, resolves identity, deduplicates, classifies
// structural eligibility, assesses coverage/gaps, and hands a stable universe to
// downstream Research.
//
// TRUTH BOUNDARIES (enforced by types + tests):
//   • Discovery ≠ Evidence. A candidate's provenance (which route/provider found
//     it) is NOT evidence, and multiple discovery origins are NOT corroboration.
//   • Signal hypotheses are WATCH hints for Research — never observed Signals.
//   • Lead Hunter emits NO Fit / Timing / What-Changed / Decision / account rank.
//   • Candidate statuses are distinct from Opportunity Case Decisions and from
//     HOT/WARM/COLD. There is no opaque numeric lead score.
//   • Low public footprint is never a poor-opportunity claim — only a coverage note.

import type { SignalFamily } from "@/lib/discovery/needs-map";
import type { ConfirmedCommercialContextV1 } from "@/lib/interpretation/confirmed-commercial-context";
import {
  loadConfirmedContext,
  type ConfirmedContextStore,
  type ContextSelector,
} from "@/lib/interpretation/confirmed-context-store";

// ─── Candidate model ──────────────────────────────────────────────────────────

/** First-pass structural status. NOT an Opportunity Decision, NOT HOT/WARM/COLD. */
export type CandidateStatus =
  | "eligible"           // in scope, identity resolved
  | "likely_eligible"    // plausibly in scope; identity or an attribute is soft
  | "needs_validation"   // a required attribute is unknown (unknown ≠ fail)
  | "excluded"           // matched a hard exclusion with sufficient certainty
  | "identity_ambiguous"; // could not be pinned to one canonical organization

/** How a candidate was DISCOVERED. Discovery provenance — never Evidence. */
export interface DiscoveryProvenance {
  route: string;
  origin: string;         // vertical_seed | dynamic_enumeration | named_seed | …
  provider?: string;
  sourceUrl?: string;
  discoveredName: string; // the name as first observed
  discoveredAt: string;
}

export interface CandidateIdentity {
  canonicalName: string;
  domain?: string;
  country?: string;
  organizationType?: string;
  aliases?: string[];
  confidence: "verified" | "plausible" | "ambiguous";
}

export interface CandidateAccount {
  identity: CandidateIdentity;
  status: CandidateStatus;
  statusReason: string;
  /** Multiple discovery origins collapsed here — NOT independent evidence. */
  provenance: DiscoveryProvenance[];
  /** Handoff hints for Research (configuration, never observations). */
  opportunityConditionIds: string[];
  watchSignalFamilies: SignalFamily[];
  openQualificationQuestions: string[];
}

// ─── Discovery plan ───────────────────────────────────────────────────────────

export type DiscoveryRouteKind =
  | "industry_category"
  | "geo_category"
  | "named_account_expansion"
  | "partner_channel"
  | "expansion_signal"
  | "source_ecosystem";

export interface DiscoveryRoute { id: string; kind: DiscoveryRouteKind; label: string; }

export interface DiscoveryBudget {
  maxRoutes: number;
  maxProviderCalls: number;
  maxCandidatesPerRoute: number;
  maxExtractions: number;
  maxRetries: number;
  timeoutMs: number;
}

/** Bounded technical budget (NOT a commercial/pricing limit). */
export const DEFAULT_DISCOVERY_BUDGET: DiscoveryBudget = {
  maxRoutes: 6,
  maxProviderCalls: 24,
  maxCandidatesPerRoute: 25,
  maxExtractions: 12,
  maxRetries: 1,
  timeoutMs: 60_000,
};

export interface DiscoveryPlan {
  contextRef: { contextId: string; version: number };
  objectiveType: string;
  targetRelationship: string;
  organizationTypes: string[];
  industries: string[];
  geographies: string[];
  businessModel?: string;
  routes: DiscoveryRoute[];
  exclusions: string[];
  namedAccountSeeds: string[];
  /** Signal families to WATCH downstream — discovery hints, not observations. */
  watchSignalFamilies: SignalFamily[];
  budget: DiscoveryBudget;
  planGaps: DiscoveryGapType[];
}

// ─── Coverage / gaps ──────────────────────────────────────────────────────────

export type DiscoveryGapType =
  | "low_public_footprint"
  | "provider_unavailable"
  | "sparse_geographic_coverage"
  | "identity_ambiguity"
  | "insufficient_target_definition"
  | "no_viable_source_ecosystem"
  | "candidate_volume_too_low"
  | "candidate_volume_too_noisy";

export interface DiscoveryGap { type: DiscoveryGapType; detail: string; }

export interface CoverageSummary {
  operatingMode: string;
  providersAvailable: string[];
  providersFailed: string[];
  routesAttempted: number;
  candidatesDiscovered: number;
  candidatesUnique: number;
  eligible: number;
  likelyEligible: number;
  needsValidation: number;
  excluded: number;
  identityAmbiguous: number;
  duplicateRate: number;
  gaps: DiscoveryGap[];
}

/** Explicit human-review exception classes (§53). Normal runs produce none. */
export type ReviewClass =
  | "identity_ambiguity"
  | "uncertain_hard_exclusion"
  | "provider_anomaly"
  | "unsupported_target_type"
  | "repeated_zero_yield";

export interface CandidateAccountUniverse {
  runId: string;
  contextRef: { contextId: string; version: number };
  generatedAt: string;
  plan: DiscoveryPlan;
  candidates: CandidateAccount[];
  coverage: CoverageSummary;
  reviewRequired: ReviewClass[];
  /** false = discovery could not complete (all providers down / no viable route);
   *  candidates is then empty — never fabricated. */
  ok: boolean;
  failureReason?: DiscoveryGapType;
}

// ─── Discovery runner port (the existing engine, or a test double) ─────────────

export interface RawDiscoveredOrg {
  name: string;
  domain?: string;
  country?: string;
  organizationType?: string;
  industry?: string;
  origin: string;
  provider: string;
  route: string;
  sourceUrl?: string;
  confidence: "verified" | "plausible";
}

export interface DiscoveryRunOutput {
  orgs: RawDiscoveredOrg[];
  providersAvailable: string[];
  providersFailed: string[];
  operatingMode: string;
}

export type DiscoveryRunner = (plan: DiscoveryPlan) => Promise<DiscoveryRunOutput>;

// ─── Planning (pure, deterministic) ───────────────────────────────────────────

const norm = (s: string): string => s.trim().toLowerCase();
const clean = (s: string | undefined | null): string => (s ?? "").trim().replace(/\s+/g, " ");

function routesForObjective(objectiveType: string, relationship: string, hasNamedSeeds: boolean, discoveryRequired: boolean): DiscoveryRoute[] {
  const routes: DiscoveryRoute[] = [];
  const add = (kind: DiscoveryRouteKind, label: string) => routes.push({ id: `route_${kind}`, kind, label });

  if (relationship === "partner") {
    add("partner_channel", "Distributors / channel / partner organizations");
    add("geo_category", "Partner organizations by region");
  } else if (objectiveType === "advisory_opportunities") {
    add("expansion_signal", "Organizations showing expansion / market-entry activity");
    add("industry_category", "Advisory-relevant organization types");
  } else {
    add("industry_category", "Organizations by industry / type");
    add("geo_category", "Organizations by geography + category");
  }
  if (discoveryRequired) add("expansion_signal", "Change/expansion discovery surfacing organizations");
  if (hasNamedSeeds) add("named_account_expansion", "Expand from user-supplied seed accounts");
  add("source_ecosystem", "Directories / associations / company lists");
  // Dedupe by id and bound by budget.maxRoutes elsewhere.
  const seen = new Set<string>();
  return routes.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/** Deterministic DiscoveryPlan from a confirmed context. Pure — no I/O. */
export function planDiscovery(ctx: ConfirmedCommercialContextV1, budget: DiscoveryBudget = DEFAULT_DISCOVERY_BUDGET): DiscoveryPlan {
  const t = ctx.targetAccountProfile;
  const organizationTypes = (t.organizationTypes ?? []).map(clean).filter(Boolean);
  const industries = (t.industries ?? []).map(clean).filter(Boolean);
  const geographies = (t.geographies ?? []).map((g) => clean(g.label)).filter(Boolean);
  const namedAccountSeeds = (t.namedAccounts ?? []).map(clean).filter(Boolean);
  const discoveryRequired = t.definitionStatus === "discovery_required";
  const exclusions = Array.from(new Set([
    ...ctx.disqualifiers.filter((d) => d.severity === "exclude").map((d) => clean(d.rule)),
    ...(t.exclusions ?? []).map(clean),
  ])).filter(Boolean);
  const watchSignalFamilies = Array.from(new Set(ctx.signalHypotheses.map((h) => h.family)));

  const planGaps: DiscoveryGapType[] = [];
  const targetDefined = organizationTypes.length > 0 || industries.length > 0 || namedAccountSeeds.length > 0 || discoveryRequired;
  if (!targetDefined) planGaps.push("insufficient_target_definition");

  const routes = routesForObjective(ctx.objective.type, ctx.objective.targetRelationship, namedAccountSeeds.length > 0, discoveryRequired)
    .slice(0, budget.maxRoutes);

  return {
    contextRef: { contextId: ctx.contextId, version: ctx.version },
    objectiveType: ctx.objective.type,
    targetRelationship: ctx.objective.targetRelationship,
    organizationTypes, industries, geographies,
    businessModel: ctx.companyProfile.businessModel?.value,
    routes, exclusions, namedAccountSeeds, watchSignalFamilies, budget, planGaps,
  };
}

// ─── Classification (pure, deterministic — no numeric score) ──────────────────

function matchesExclusion(org: { industry?: string; organizationType?: string; country?: string; name: string }, exclusions: string[]): { excluded: boolean; certain: boolean; rule?: string } {
  for (const ex of exclusions) {
    const e = norm(ex);
    const hay = [org.industry, org.organizationType, org.name].map((x) => norm(x ?? "")).join(" ");
    if (hay.includes(e)) return { excluded: true, certain: true, rule: ex };
    // Geography exclusion depends on a known country; unknown → not certain.
    if (org.country && norm(org.country).includes(e)) return { excluded: true, certain: true, rule: ex };
  }
  return { excluded: false, certain: true };
}

// ─── Identity resolution + dedup ──────────────────────────────────────────────

/** Canonical key: domain when present, else normalized name + country. Same name
 *  in different countries → different keys (not merged); same name, no domain, in
 *  ambiguous form → flagged identity_ambiguous rather than silently qualified. */
function canonicalKey(org: RawDiscoveredOrg): string {
  if (org.domain) return `d:${norm(org.domain)}`;
  return `n:${norm(org.name)}|${norm(org.country ?? "")}`;
}

interface Grouped { key: string; orgs: RawDiscoveredOrg[]; }

function groupByIdentity(orgs: RawDiscoveredOrg[]): Grouped[] {
  const map = new Map<string, RawDiscoveredOrg[]>();
  for (const o of orgs) {
    const k = canonicalKey(o);
    (map.get(k) ?? map.set(k, []).get(k)!).push(o);
  }
  return Array.from(map.entries()).map(([key, orgs]) => ({ key, orgs }));
}

/** Same normalized name resolving to MULTIPLE domains (different entities) →
 *  each is its own candidate, but flagged ambiguous when a name-only variant also
 *  exists (can't tell which the user means). */
function ambiguousNames(orgs: RawDiscoveredOrg[]): Set<string> {
  const nameToDomains = new Map<string, Set<string>>();
  const nameHasBare = new Map<string, boolean>();
  for (const o of orgs) {
    const n = norm(o.name);
    if (o.domain) (nameToDomains.get(n) ?? nameToDomains.set(n, new Set()).get(n)!).add(norm(o.domain));
    else nameHasBare.set(n, true);
  }
  const out = new Set<string>();
  nameToDomains.forEach((domains, n) => {
    // Multiple distinct domains for the same name AND a bare (domainless) mention
    // → we cannot pin the bare one; mark the name ambiguous.
    if (domains.size >= 2 && nameHasBare.get(n)) out.add(n);
  });
  // A purely bare name that appears with conflicting countries is also ambiguous.
  const bareCountries = new Map<string, Set<string>>();
  for (const o of orgs) if (!o.domain) (bareCountries.get(norm(o.name)) ?? bareCountries.set(norm(o.name), new Set()).get(norm(o.name))!).add(norm(o.country ?? ""));
  bareCountries.forEach((cs, n) => { if (cs.size >= 2) out.add(n); });
  return out;
}

function classifyGroup(g: Grouped, plan: DiscoveryPlan, ambiguous: Set<string>, discoveredAt: string): CandidateAccount {
  const primary = g.orgs.find((o) => o.domain) ?? g.orgs[0];
  const name = primary.name;
  const domain = primary.domain;
  const country = primary.country ?? g.orgs.find((o) => o.country)?.country;
  const orgType = primary.organizationType ?? g.orgs.find((o) => o.organizationType)?.organizationType;
  const aliases = Array.from(new Set(g.orgs.map((o) => o.name).filter((n) => n !== name)));

  const provenance: DiscoveryProvenance[] = g.orgs.map((o) => ({
    route: o.route, origin: o.origin, provider: o.provider, sourceUrl: o.sourceUrl,
    discoveredName: o.name, discoveredAt,
  }));

  const excl = matchesExclusion({ industry: primary.industry, organizationType: orgType, country, name }, plan.exclusions);
  let status: CandidateStatus;
  let statusReason: string;
  const openQ: string[] = [];

  if (excl.excluded && excl.certain) {
    status = "excluded";
    statusReason = `Hard exclusion matched: ${excl.rule}`;
  } else if (ambiguous.has(norm(name)) || !domain && g.orgs.every((o) => !o.domain) && !country) {
    status = "identity_ambiguous";
    statusReason = "Could not resolve to one canonical organization (no domain and ambiguous name).";
    openQ.push("Confirm which organization this refers to.");
  } else if (domain) {
    // Identity resolved. Eligible when it plausibly fits target descriptors; if a
    // required descriptor is unknown, hold as needs_validation (unknown ≠ fail).
    const knowsType = !!orgType || !!primary.industry;
    if (knowsType) { status = "eligible"; statusReason = "Identity resolved; structurally in scope."; }
    else { status = "needs_validation"; statusReason = "Identity resolved; organization type/industry unconfirmed."; openQ.push("Confirm industry / organization type."); }
  } else {
    // No domain but a plausible single identity → likely_eligible (structurally
    // plausible, low public footprint is not a rejection).
    status = "likely_eligible";
    statusReason = "Structurally plausible; identity not yet domain-verified (possibly low public footprint).";
    openQ.push("Resolve canonical domain / legal entity.");
  }

  const identityConfidence: CandidateIdentity["confidence"] =
    status === "identity_ambiguous" ? "ambiguous" : domain ? "verified" : "plausible";

  return {
    identity: { canonicalName: name, domain, country, organizationType: orgType, aliases: aliases.length ? aliases : undefined, confidence: identityConfidence },
    status, statusReason,
    provenance,
    opportunityConditionIds: [], // populated by hunt() from plan context
    watchSignalFamilies: plan.watchSignalFamilies,
    openQualificationQuestions: openQ,
  };
}

// Discovery timestamps are passed per invocation; no module-global mutable run state.

// ─── Hunt (orchestration) ─────────────────────────────────────────────────────

export interface HuntOptions {
  now?: () => Date;
  opportunityConditionIds?: string[];
  runScope?: string;
}

function safeRunScope(value: string | undefined): string {
  if (!value) return "unscoped";
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "unscoped";
}

export async function hunt(plan: DiscoveryPlan, runner: DiscoveryRunner, opts: HuntOptions = {}): Promise<CandidateAccountUniverse> {
  const now = (opts.now ?? (() => new Date()))();
  const discoveredAt = now.toISOString();
  const runId = `lh_${plan.contextRef.contextId}_v${plan.contextRef.version}_${now.toISOString().slice(0, 10)}_${safeRunScope(opts.runScope)}`;
  const base = { runId, contextRef: plan.contextRef, generatedAt: now.toISOString(), plan };

  // Insufficient target → do not run providers; honest failure.
  if (plan.planGaps.includes("insufficient_target_definition")) {
    return { ...base, candidates: [], ok: false, failureReason: "insufficient_target_definition",
      reviewRequired: ["unsupported_target_type"],
      coverage: emptyCoverage("stopped", [], [], [{ type: "insufficient_target_definition", detail: "Target universe is undefined and not discovery-required." }]) };
  }

  let out: DiscoveryRunOutput;
  try {
    out = await runner(plan);
  } catch {
    return { ...base, candidates: [], ok: false, failureReason: "provider_unavailable",
      reviewRequired: ["provider_anomaly"],
      coverage: emptyCoverage("stopped", [], [], [{ type: "provider_unavailable", detail: "Discovery runner failed." }]) };
  }

  // All providers failed / nothing usable → honest failure, no fabricated accounts.
  if (out.providersAvailable.length === 0 || out.operatingMode === "stopped") {
    return { ...base, candidates: [], ok: false, failureReason: "provider_unavailable",
      reviewRequired: ["provider_anomaly"],
      coverage: emptyCoverage("stopped", out.providersAvailable, out.providersFailed, [{ type: "provider_unavailable", detail: "No providers available for discovery." }]) };
  }

  const orgs = out.orgs.filter((o) => clean(o.name));
  const ambiguous = ambiguousNames(orgs);
  const groups = groupByIdentity(orgs);
  const candidates = groups.map((g) => {
    const c = classifyGroup(g, plan, ambiguous, discoveredAt);
    c.opportunityConditionIds = opts.opportunityConditionIds ?? [];
    return c;
  });

  const counts = {
    eligible: candidates.filter((c) => c.status === "eligible").length,
    likelyEligible: candidates.filter((c) => c.status === "likely_eligible").length,
    needsValidation: candidates.filter((c) => c.status === "needs_validation").length,
    excluded: candidates.filter((c) => c.status === "excluded").length,
    identityAmbiguous: candidates.filter((c) => c.status === "identity_ambiguous").length,
  };
  const inScope = candidates.filter((c) => c.status !== "excluded");
  const duplicateRate = orgs.length ? 1 - candidates.length / orgs.length : 0;

  const gaps: DiscoveryGap[] = [];
  if (out.providersFailed.length) gaps.push({ type: "provider_unavailable", detail: `Providers unavailable: ${out.providersFailed.join(", ")}.` });
  if (counts.identityAmbiguous > 0) gaps.push({ type: "identity_ambiguity", detail: `${counts.identityAmbiguous} candidate(s) need identity validation.` });
  if (inScope.length < 3) gaps.push({ type: "candidate_volume_too_low", detail: `Only ${inScope.length} in-scope candidate(s) discovered.` });
  if (plan.geographies.length === 0) gaps.push({ type: "sparse_geographic_coverage", detail: "No geography constraint; coverage is broad and unverified." });
  if (inScope.every((c) => c.identity.confidence !== "verified") && inScope.length > 0) gaps.push({ type: "low_public_footprint", detail: "No candidate reached domain-verified identity." });

  const reviewRequired: ReviewClass[] = [];
  if (counts.identityAmbiguous > 0) reviewRequired.push("identity_ambiguity");
  if (out.providersFailed.length && out.providersAvailable.length < 2) reviewRequired.push("provider_anomaly");
  if (inScope.length === 0) reviewRequired.push("repeated_zero_yield");

  const coverage: CoverageSummary = {
    operatingMode: out.operatingMode,
    providersAvailable: out.providersAvailable,
    providersFailed: out.providersFailed,
    routesAttempted: plan.routes.length,
    candidatesDiscovered: orgs.length,
    candidatesUnique: candidates.length,
    ...counts,
    duplicateRate: Math.round(duplicateRate * 100) / 100,
    gaps,
  };

  return { ...base, candidates, coverage, reviewRequired, ok: true };
}

function emptyCoverage(mode: string, avail: string[], failed: string[], gaps: DiscoveryGap[]): CoverageSummary {
  return {
    operatingMode: mode, providersAvailable: avail, providersFailed: failed,
    routesAttempted: 0, candidatesDiscovered: 0, candidatesUnique: 0,
    eligible: 0, likelyEligible: 0, needsValidation: 0, excluded: 0, identityAmbiguous: 0,
    duplicateRate: 0, gaps,
  };
}

// ─── Owner-scoped entry from confirmed context ────────────────────────────────

export type HuntFromContextResult =
  | { ok: true; universe: CandidateAccountUniverse }
  | { ok: false; reason: string };

/**
 * Load an authorized, persisted (therefore confirmed) context version for this
 * owner and hunt its candidate universe. Owner-scoped (tenant isolation): the
 * store only returns rows owned by userId. Fails safe when the context is missing
 * — never runs discovery on unconfirmed/absent context.
 */
export async function huntFromConfirmedContext(
  store: ConfirmedContextStore,
  userId: string,
  selector: ContextSelector,
  runner: DiscoveryRunner,
  opts: HuntOptions = {},
): Promise<HuntFromContextResult> {
  let record;
  try {
    record = await loadConfirmedContext(store, userId, selector);
  } catch {
    return { ok: false, reason: "store_unavailable" };
  }
  if (!record) return { ok: false, reason: "context_not_found" };

  const plan = planDiscovery(record.context);
  const conditionIds = record.context.opportunityConditions.map((c) => c.id);
  const universe = await hunt(plan, runner, { ...opts, opportunityConditionIds: conditionIds });
  return { ok: true, universe };
}
