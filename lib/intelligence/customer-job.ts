// ─── Multi-pass Customer Intelligence Job (customer-job-v1) ───────────────────
//
// A customer intelligence job is the durable, resumable orchestration around a
// SINGLE customer objective that ACCUMULATES qualified accounts across many
// discovery+research passes, instead of the old run→discover→qualify→END shape.
//
// Each pass: Vault-first → external discovery for one route/query family → Vault
// write-through of EVERY discovered canonical company → union+dedup into the
// accumulated candidate universe (skipping already-known and rejection-memory) →
// research+qualify the NEW candidates → accumulate qualified → adapt the next
// pass from observed yield. The loop stops at the target, at reasonable
// exhaustion, or at the budget — never at an arbitrary pass count.
//
// This module is PURE orchestration over injected seams (CustomerJobDeps), so it
// is deterministic and fully unit-testable with doubles; the real Vault, discovery
// and research bindings live in customer-job-production.ts. It is generic — no
// Amor de Gea / pilot specifics. It never lowers a truth bar: qualification is
// owned by the injected `qualify` seam (the real research pipeline), and this
// module only unions, dedups, remembers and schedules.

export type JobStatus =
  | "queued" | "running" | "waiting_provider"
  | "partial" | "complete" | "failed_recoverable" | "failed_terminal";

export type AccountDecision = "prioritize" | "validate" | "monitor" | "hold";

/** Canonical dedup key: domain (lowercased, sans www) when present, else the
 *  normalized company name. Deterministic and stable across passes. */
export function canonicalKey(company: string, domain?: string | null): string {
  const d = (domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (d) return `d:${d}`;
  const n = company.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return `n:${n}`;
}

export interface DiscoveredCompany {
  company: string;
  domain: string | null;
  country: string | null;
  industry: string | null;
  sourceUrl?: string | null;
  signalDate?: string | null;
  signalType?: string | null;
  opportunityKind?: string | null;
  channelEvidenceGrade?: string | null;
  channelProofType?: string | null;
}

export interface CanonicalCandidate {
  key: string;
  company: string;
  domain: string | null;
  country: string | null;
  industry: string | null;
  route: string;
  origin: "external" | "vault" | "prior_pass";
  firstSeenPass: number;
  lastSeenPass: number;
  researched: boolean;
  /** Best validated discovery evidence retained across pass persistence/resume. */
  sourceUrl?: string | null;
  signalDate?: string | null;
  signalType?: string | null;
  opportunityKind?: string | null;
  channelEvidenceGrade?: string | null;
  channelProofType?: string | null;
}

export interface QualifiedAccount {
  key: string;
  company: string;
  domain: string | null;
  route: string;
  decision: AccountDecision;
  fit: string | null;
  timing: string | null;
  evidenceCount: number;
  qualifiedAtPass: number;
  hasSource?: boolean;
  hasValidatedDate?: boolean;
  currentActionabilityBasis?: boolean;
  commercialMechanismVerified?: boolean;
  accessPathIdentified?: boolean;
  counterevidenceMaterial?: boolean;
}

export interface RejectionMemoryEntry {
  key: string;
  company: string;
  reason: string;       // e.g. WRONG_COMPANY_TYPE, NOT_BUYER, INSUFFICIENT_EVIDENCE
  pass: number;
}

export interface QueryFamilyRecord {
  route: string;
  queryFamilyId: string;
  pass: number;
  rawResults: number;
  newCandidates: number;
  qualifiedAdded: number;
  status: "productive" | "low_yield" | "exhausted";
}

export interface RouteYield {
  route: string;
  passes: number;
  rawCandidates: number;
  uniqueCandidates: number;
  qualified: number;
}

export interface PassRecord {
  passId: number;
  route: string;
  queryFamilyId: string;
  providersAttempted: string[];
  vaultHits: number;
  newCandidates: number;
  qualifiedAdditions: number;
  costUsd: number;
  startedAt: string;
  completedAt: string;
  yield: number;               // qualifiedAdditions / max(1, newCandidates)
  nextStrategy: string;
}

export interface TierReadiness {
  target: number; actual: number; full: boolean;
  capacityReady?: boolean;
  actionabilityRequired?: boolean;
  actionabilityReady?: boolean;
  evidenceQualifiedPrioritize?: number;
  deliveryReady?: boolean;
  reasonCodes?: string[];
}

export interface CustomerJobState {
  jobId: string;
  customer: string;
  objective: string;
  contextVersion: number | string;
  geography: string;
  requestedTier: string;
  targetCount: number;
  milestones: number[];
  status: JobStatus;
  passesCompleted: number;
  candidates: CanonicalCandidate[];
  qualified: QualifiedAccount[];
  rejectionMemory: RejectionMemoryEntry[];
  queryHistory: QueryFamilyRecord[];
  passHistory: PassRecord[];
  routeYield: Record<string, RouteYield>;
  providerState: Record<string, string>;
  spendUsd: number;
  vault: { discovered: number; existingReused: number; newInserted: number; rejectedNonAccount: number; vaultFirstMatches?: number };
  tierReadiness: Record<string, TierReadiness>;
  actionabilityEscalation?: import("@/lib/intelligence/actionability-escalation").ActionabilityEscalationState;
  createdAt: string;
  updatedAt: string;
}

function requestedTierReadiness(state: CustomerJobState): TierReadiness | undefined {
  const normalized = state.requestedTier.toLowerCase();
  const name = normalized === "intelligence" || normalized === "portfolio" ? "Portfolio"
    : normalized === "premium" ? "Premium" : normalized === "brief" ? "Brief" : "Preview";
  return state.tierReadiness[name];
}

export function customerJobDeliveryReady(state: CustomerJobState): boolean {
  const readiness = requestedTierReadiness(state);
  return readiness?.deliveryReady ?? readiness?.full ?? false;
}

export interface PassSpec {
  passId: number;
  route: string;
  queryFamilyId: string;
  queries: string[];
  geoCluster?: string | null;
}

export interface DiscoverResult {
  discovered: DiscoveredCompany[];
  providersAttempted: string[];
  providerState: Record<string, string>;
  rawResults: number;
  costUsd: number;
}

export interface QualifyResult {
  qualified: QualifiedAccount[];
  rejected: RejectionMemoryEntry[];
  /** Candidates intentionally deferred by a bounded research seam. They remain
   *  unresearched and must be retried on a later pass instead of disappearing. */
  deferredKeys?: string[];
  /** Actual provider/LLM spend incurred by qualification. */
  costUsd?: number;
}

export interface CustomerJobDeps {
  now?: () => Date;
  /** Vault-first: eligible prior accounts for this route/geo from the company registry. */
  vaultFirst: (spec: PassSpec, state: CustomerJobState) => Promise<DiscoveredCompany[]>;
  /** External discovery for the pass's query family. */
  discover: (spec: PassSpec, state: CustomerJobState) => Promise<DiscoverResult>;
  /** Vault write-through for ALL discovered canonical companies (admission-gated upstream). */
  vaultWriteThrough: (companies: DiscoveredCompany[], pass: number) => Promise<{ evaluated: number; new_companies: number; existing_rediscovered: number; rejected_non_account: number }>;
  /** Research + qualify the NEW candidates only → qualified + rejections. Owns the truth bar. */
  qualify: (candidates: CanonicalCandidate[], state: CustomerJobState) => Promise<QualifyResult>;
  /** Durable persistence after each pass (best-effort — a failure marks failed_recoverable). */
  save?: (state: CustomerJobState) => Promise<void>;
}

export interface RunJobOptions {
  maxPasses?: number;        // hard guard against runaway (default 24)
  budgetUsd?: number;        // cumulative provider budget ceiling (default 20)
  minYieldToContinueRoute?: number; // route marked exhausted below this (default 0)
  /** Vault-selection policy (§2): when false, Vault-first hits do NOT seed the
   *  customer-facing candidate/selection pool — the shortlist is driven by fresh
   *  external discovery, and Vault stays inventory/dedup/memory. Default true
   *  (back-compat). Set from resolveVaultSelectionPolicy(vaultCount). */
  vaultAsSelectionSource?: boolean;
}

const DEFAULT_MILESTONES = [2, 6, 12, 18];

export function newCustomerJobState(init: {
  jobId: string; customer: string; objective: string; contextVersion: number | string;
  geography: string; requestedTier?: string; targetCount?: number; milestones?: number[];
  now?: () => Date;
}): CustomerJobState {
  const nowIso = (init.now ?? (() => new Date()))().toISOString();
  const target = init.targetCount ?? 18;
  const milestones = init.milestones ?? DEFAULT_MILESTONES;
  return {
    jobId: init.jobId, customer: init.customer, objective: init.objective,
    contextVersion: init.contextVersion, geography: init.geography,
    requestedTier: init.requestedTier ?? "premium", targetCount: target, milestones,
    status: "queued", passesCompleted: 0, candidates: [], qualified: [], rejectionMemory: [],
    queryHistory: [], passHistory: [], routeYield: {}, providerState: {}, spendUsd: 0,
    vault: { discovered: 0, existingReused: 0, newInserted: 0, rejectedNonAccount: 0 },
    tierReadiness: tierReadinessFor([], milestones),
    createdAt: nowIso, updatedAt: nowIso,
  };
}

/** Tier readiness from a qualified count against the milestone ladder. */
export function tierReadinessFor(qualified: QualifiedAccount[], milestones: number[]): Record<string, TierReadiness> {
  const names = ["Preview", "Brief", "Portfolio", "Premium"];
  const out: Record<string, TierReadiness> = {};
  milestones.forEach((target, i) => {
    const name = names[i] ?? `Tier${target}`;
    const actual = Math.min(qualified.length, target);
    const capacityReady = qualified.length >= target;
    const actionabilityRequired = name === "Portfolio" || name === "Premium";
    const evidenceQualifiedPrioritize = qualified.filter((q) => q.decision === "prioritize"
      && q.fit?.toLowerCase() === "strong" && q.commercialMechanismVerified === true
      && q.hasSource === true && q.evidenceCount > 0
      && (q.hasValidatedDate === true || q.currentActionabilityBasis === true)
      && q.counterevidenceMaterial !== true).length;
    const actionabilityReady = !actionabilityRequired || evidenceQualifiedPrioritize > 0;
    const reasonCodes = [
      ...(!capacityReady ? ["CAPACITY_INSUFFICIENT"] : []),
      ...(!actionabilityReady ? ["ACTIONABILITY_RESEARCH_REQUIRED"] : []),
    ];
    out[name] = { target, actual, full: capacityReady && actionabilityReady, capacityReady, actionabilityRequired, actionabilityReady, evidenceQualifiedPrioritize, deliveryReady: capacityReady && actionabilityReady, reasonCodes };
  });
  return out;
}

/** A query family is "novel" for this job when it has not already been run. §25 */
export function isQueryFamilyNovel(state: CustomerJobState, route: string, queryFamilyId: string): boolean {
  return !state.queryHistory.some((q) => q.route === route && q.queryFamilyId === queryFamilyId);
}

/** Adaptive pass selection (§23/§26): from the remaining planned passes, drop
 *  already-run families and families on a route already marked exhausted, then
 *  order by observed route yield — higher-yielding routes first, untested routes
 *  before known low-yield ones. Returns the next spec, or null when none remain. */
export function selectNextPass(state: CustomerJobState, plan: PassSpec[]): PassSpec | null {
  const exhaustedRoutes = new Set(
    Object.values(state.routeYield)
      .filter((r) => r.passes >= 2 && r.qualified === 0 && r.uniqueCandidates === 0)
      .map((r) => r.route),
  );
  const remaining = plan.filter((p) =>
    isQueryFamilyNovel(state, p.route, p.queryFamilyId) && !exhaustedRoutes.has(p.route),
  );
  if (!remaining.length) return null;
  const routeScore = (route: string): number => {
    const y = state.routeYield[route];
    if (!y) return 1; // untested route: neutral-high priority
    if (y.qualified > 0) return 2 + y.qualified; // productive route: prioritize
    if (y.uniqueCandidates > 0) return 1;         // some candidates: keep testing
    return 0;                                     // seen nothing yet: lowest
  };
  return [...remaining].sort((a, b) => routeScore(b.route) - routeScore(a.route))[0];
}

function upsertRouteYield(state: CustomerJobState, route: string, patch: { raw: number; unique: number; qualified: number }): void {
  const y = state.routeYield[route] ?? { route, passes: 0, rawCandidates: 0, uniqueCandidates: 0, qualified: 0 };
  y.passes += 1;
  y.rawCandidates += patch.raw;
  y.uniqueCandidates += patch.unique;
  y.qualified += patch.qualified;
  state.routeYield[route] = y;
}

/** Execute ONE pass against the injected seams, mutating and returning the state.
 *  Exported so a driver can step a job pass-by-pass (and persist between steps). */
export async function runOnePass(state: CustomerJobState, spec: PassSpec, deps: CustomerJobDeps, opts: RunJobOptions = {}): Promise<CustomerJobState> {
  const now = () => (deps.now ?? (() => new Date()))();
  const startedAt = now().toISOString();
  state.status = "running";

  // 1. Vault-first + external discovery.
  const [vaultHitsRaw, disc] = await Promise.all([
    deps.vaultFirst(spec, state).catch(() => [] as DiscoveredCompany[]),
    deps.discover(spec, state).catch((): DiscoverResult => ({ discovered: [], providersAttempted: [], providerState: {}, rawResults: 0, costUsd: 0 })),
  ]);
  state.providerState = { ...state.providerState, ...disc.providerState };
  state.spendUsd = Number((state.spendUsd + (disc.costUsd || 0)).toFixed(6));

  // 2. Vault write-through of EVERY discovered canonical company (§8). Vault-first
  //    hits are already in Vault, so only externally-discovered ones are written.
  if (disc.discovered.length) {
    try {
      const m = await deps.vaultWriteThrough(disc.discovered, spec.passId);
      state.vault.discovered += m.evaluated;
      state.vault.newInserted += m.new_companies;
      state.vault.existingReused += m.existing_rediscovered;
      state.vault.rejectedNonAccount += m.rejected_non_account;
    } catch { /* Vault write-through is best-effort; never breaks the job (§25) */ }
  }
  // Vault-first matches are a distinct metric from write-through rediscovery (§6.2):
  // they are Vault records SURFACED for possible selection, not companies re-observed
  // by fresh discovery. Track them separately; do not fold into existingReused.
  state.vault.vaultFirstMatches = (state.vault.vaultFirstMatches ?? 0) + vaultHitsRaw.length;

  // 3. Union + dedup into the accumulated candidate universe (§38/§39: extend,
  //    never replace). Skip already-known keys and rejection-memory keys (§42).
  // Vault-selection policy (§2): below the milestone, Vault-first does NOT seed the
  // customer-facing selection pool — the shortlist is driven by fresh external
  // discovery. Vault is still used for dedup + research memory (write-through above).
  const vaultForSelection = opts.vaultAsSelectionSource === false ? [] : vaultHitsRaw;
  const known = new Map(state.candidates.map((c) => [c.key, c]));
  const rejected = new Set(state.rejectionMemory.map((r) => r.key));
  const union: Array<{ c: DiscoveredCompany; origin: "external" | "vault" }> = [
    ...vaultForSelection.map((c) => ({ c, origin: "vault" as const })),
    ...disc.discovered.map((c) => ({ c, origin: "external" as const })),
  ];
  let newCount = 0;
  const newCandidates: CanonicalCandidate[] = [];
  for (const { c, origin } of union) {
    const key = canonicalKey(c.company, c.domain);
    const prior = known.get(key);
    if (prior) {
      prior.lastSeenPass = spec.passId;
      // A later rediscovery may carry stronger validated event/channel evidence.
      // Preserve it rather than letting first-seen directory provenance shadow it.
      if (c.sourceUrl && (!prior.sourceUrl || (c.signalDate && !prior.signalDate))) prior.sourceUrl = c.sourceUrl;
      if (c.signalDate && (!prior.signalDate || c.signalDate > prior.signalDate)) { prior.signalDate = c.signalDate; prior.signalType = c.signalType ?? prior.signalType; }
      if (c.opportunityKind) prior.opportunityKind = c.opportunityKind;
      if (c.channelEvidenceGrade) prior.channelEvidenceGrade = c.channelEvidenceGrade;
      if (c.channelProofType) prior.channelProofType = c.channelProofType;
      continue;
    }        // dedup (§38)
    if (rejected.has(key)) continue;                                  // rejection memory (§42)
    const cand: CanonicalCandidate = {
      key, company: c.company, domain: c.domain, country: c.country, industry: c.industry,
      route: spec.route, origin, firstSeenPass: spec.passId, lastSeenPass: spec.passId, researched: false,
      sourceUrl: c.sourceUrl ?? null, signalDate: c.signalDate ?? null, signalType: c.signalType ?? null,
      opportunityKind: c.opportunityKind ?? null, channelEvidenceGrade: c.channelEvidenceGrade ?? null,
      channelProofType: c.channelProofType ?? null,
    };
    known.set(key, cand);
    state.candidates.push(cand);
    newCandidates.push(cand);
    newCount++;
  }

  // 4. Research + qualify the bounded backlog (§41). New candidates can exceed a
  //    per-pass research ceiling; deferred candidates remain unresearched and are
  //    retried on the next pass rather than silently disappearing.
  let qualifiedAdditions = 0;
  let qualificationCostUsd = 0;
  const researchQueue = state.candidates.filter((c) => !c.researched && !rejected.has(c.key));
  if (researchQueue.length) {
    const result = await deps.qualify(researchQueue, state).catch((): QualifyResult => ({ qualified: [], rejected: [], deferredKeys: researchQueue.map((c) => c.key), costUsd: 0 }));
    const { qualified, rejected: rej } = result;
    qualificationCostUsd = result.costUsd || 0;
    state.spendUsd = Number((state.spendUsd + qualificationCostUsd).toFixed(6));
    const haveQ = new Set(state.qualified.map((q) => q.key));
    for (const q of qualified) {
      if (haveQ.has(q.key)) continue;                                 // never double-count (§39)
      haveQ.add(q.key);
      state.qualified.push(q);
      qualifiedAdditions++;
    }
    const haveR = new Set(state.rejectionMemory.map((r) => r.key));
    for (const r of rej) if (!haveR.has(r.key)) { haveR.add(r.key); state.rejectionMemory.push(r); }
    const deferred = new Set(result.deferredKeys ?? []);
    for (const c of state.candidates) if (researchQueue.some((n) => n.key === c.key) && !deferred.has(c.key)) c.researched = true;
  }

  // 5. Record pass + query-family + route yield + tier readiness.
  const passYield = Number((qualifiedAdditions / Math.max(1, newCount)).toFixed(3));
  const familyStatus: QueryFamilyRecord["status"] = qualifiedAdditions > 0 ? "productive" : newCount > 0 ? "low_yield" : "exhausted";
  state.queryHistory.push({ route: spec.route, queryFamilyId: spec.queryFamilyId, pass: spec.passId, rawResults: disc.rawResults, newCandidates: newCount, qualifiedAdded: qualifiedAdditions, status: familyStatus });
  upsertRouteYield(state, spec.route, { raw: disc.rawResults, unique: newCount, qualified: qualifiedAdditions });
  const nextStrategy = deriveNextStrategy(state, spec, { newCount, qualifiedAdditions });
  state.passHistory.push({
    passId: spec.passId, route: spec.route, queryFamilyId: spec.queryFamilyId,
    providersAttempted: disc.providersAttempted, vaultHits: vaultHitsRaw.length,
    newCandidates: newCount, qualifiedAdditions, costUsd: Number(((disc.costUsd || 0) + qualificationCostUsd).toFixed(6)),
    startedAt, completedAt: now().toISOString(), yield: passYield, nextStrategy,
  });
  state.passesCompleted += 1;
  state.tierReadiness = tierReadinessFor(state.qualified, state.milestones);
  state.status = customerJobDeliveryReady(state) ? "complete" : "partial";
  state.updatedAt = now().toISOString();

  if (deps.save) { try { await deps.save(state); } catch { state.status = "failed_recoverable"; } }
  return state;
}

function deriveNextStrategy(state: CustomerJobState, spec: PassSpec, pass: { newCount: number; qualifiedAdditions: number }): string {
  if (state.qualified.length >= state.targetCount) return "target reached — stop broad discovery, shift to depth/QA";
  if (pass.qualifiedAdditions > 0) return `route '${spec.route}' productive (+${pass.qualifiedAdditions}) — allocate another family`;
  if (pass.newCount > 0) return `route '${spec.route}' produced candidates but 0 qualified — try a different family/geo before abandoning`;
  return `route '${spec.route}' family '${spec.queryFamilyId}' empty — deprioritize this route`;
}

/** Run the whole job to a stop condition (§57/§115): target reached, no productive
 *  passes remain, budget exhausted, or the hard maxPasses guard. */
export async function runCustomerJob(state: CustomerJobState, plan: PassSpec[], deps: CustomerJobDeps, opts: RunJobOptions = {}): Promise<CustomerJobState> {
  const maxPasses = opts.maxPasses ?? 24;
  const budget = opts.budgetUsd ?? 20;
  let guard = 0;
  while (guard < maxPasses) {
    guard++;
    if (customerJobDeliveryReady(state)) { state.status = "complete"; break; }
    if (state.spendUsd >= budget) { state.status = "partial"; break; }
    const spec = selectNextPass(state, plan);
    if (!spec) { state.status = customerJobDeliveryReady(state) ? "complete" : "partial"; break; }
    await runOnePass(state, spec, deps, opts);
  }
  state.updatedAt = (deps.now ?? (() => new Date()))().toISOString();
  return state;
}
