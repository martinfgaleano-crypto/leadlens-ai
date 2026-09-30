import type { AccountDecision, QualifiedAccount } from "@/lib/intelligence/customer-job";
import { isEvidenceQualifiedPrioritize, type IntelligenceTier } from "@/lib/intelligence/advanced-tier-readiness";

export type EscalationStatus = "queued" | "running" | "success" | "exhausted" | "provider_capacity" | "budget_reached";
export type EscalationTrack = "deepen_existing" | "actionability_first_discovery";

export interface ActionabilityCandidate {
  key: string;
  company: string;
  track: EscalationTrack;
  queryFamily: string;
  provider: string | null;
  account: QualifiedAccount | null;
  rejectionReason?: string | null;
}

export interface ActionabilityEscalationState {
  version: "actionability-research-escalation-v1";
  jobId: string;
  tier: IntelligenceTier;
  reason: "ZERO_EVIDENCE_QUALIFIED_PRIORITIZE";
  status: EscalationStatus;
  pass: number;
  maxPasses: number;
  budgetUsd: number;
  spendUsd: number;
  queries: string[];
  queryFamilies: string[];
  providersAttempted: string[];
  providerFailures: string[];
  accountsDeepened: number;
  accountsDiscovered: number;
  mechanismsVerified: number;
  accessPathsIdentified: number;
  currentTimingSignals: number;
  prioritizeFound: number;
  candidates: ActionabilityCandidate[];
  rejectionReasons: Record<string, number>;
  stopCondition: string | null;
}

export interface EscalationPassResult {
  candidates: ActionabilityCandidate[];
  queries: string[];
  queryFamilies: string[];
  providersAttempted: string[];
  providerFailures?: string[];
  costUsd: number;
}

export interface ActionabilityEscalationDeps {
  deepenExisting: (state: ActionabilityEscalationState) => Promise<EscalationPassResult>;
  discoverActionable: (state: ActionabilityEscalationState) => Promise<EscalationPassResult>;
  save?: (state: ActionabilityEscalationState) => Promise<void>;
}

export function newActionabilityEscalation(input: { jobId: string; tier: IntelligenceTier; maxPasses?: number; budgetUsd?: number }): ActionabilityEscalationState {
  return {
    version: "actionability-research-escalation-v1", jobId: input.jobId, tier: input.tier,
    reason: "ZERO_EVIDENCE_QUALIFIED_PRIORITIZE", status: "queued", pass: 0,
    maxPasses: input.maxPasses ?? 4, budgetUsd: input.budgetUsd ?? 5, spendUsd: 0,
    queries: [], queryFamilies: [], providersAttempted: [], providerFailures: [],
    accountsDeepened: 0, accountsDiscovered: 0, mechanismsVerified: 0,
    accessPathsIdentified: 0, currentTimingSignals: 0, prioritizeFound: 0,
    candidates: [], rejectionReasons: {}, stopCondition: null,
  };
}

function uniquePush(target: string[], values: string[]): void {
  for (const value of values) if (value && !target.includes(value)) target.push(value);
}

function absorb(state: ActionabilityEscalationState, result: EscalationPassResult, track: EscalationTrack): void {
  state.spendUsd = Number((state.spendUsd + result.costUsd).toFixed(6));
  uniquePush(state.queries, result.queries);
  uniquePush(state.queryFamilies, result.queryFamilies);
  uniquePush(state.providersAttempted, result.providersAttempted);
  uniquePush(state.providerFailures, result.providerFailures ?? []);
  const known = new Set(state.candidates.map((c) => c.key));
  for (const candidate of result.candidates) {
    if (known.has(candidate.key)) continue;
    known.add(candidate.key);
    state.candidates.push(candidate);
    if (track === "deepen_existing") state.accountsDeepened++;
    else state.accountsDiscovered++;
    const account = candidate.account;
    if (account?.commercialMechanismVerified) state.mechanismsVerified++;
    if (account?.accessPathIdentified) state.accessPathsIdentified++;
    if (account?.hasValidatedDate || account?.currentActionabilityBasis) state.currentTimingSignals++;
    if (account && isEvidenceQualifiedPrioritize(account)) state.prioritizeFound++;
    if (candidate.rejectionReason) state.rejectionReasons[candidate.rejectionReason] = (state.rejectionReasons[candidate.rejectionReason] ?? 0) + 1;
  }
}

/** Bounded, resumable two-track escalation. It never creates or promotes a
 * decision; both seams must return accounts already evaluated by the canonical
 * Intelligence pipeline. */
export async function runActionabilityEscalation(state: ActionabilityEscalationState, deps: ActionabilityEscalationDeps): Promise<ActionabilityEscalationState> {
  state.status = "running";
  while (state.pass < state.maxPasses && state.spendUsd < state.budgetUsd && state.prioritizeFound === 0) {
    const track: EscalationTrack = state.pass % 2 === 0 ? "deepen_existing" : "actionability_first_discovery";
    const result = await (track === "deepen_existing" ? deps.deepenExisting(state) : deps.discoverActionable(state));
    state.pass++;
    absorb(state, result, track);
    if (deps.save) await deps.save(state);
    if (result.providersAttempted.length > 0 && (result.providerFailures ?? []).length === result.providersAttempted.length && result.candidates.length === 0) {
      state.status = "provider_capacity";
      state.stopCondition = "ALL_ATTEMPTED_PROVIDERS_FAILED";
      break;
    }
  }
  if (state.prioritizeFound > 0) { state.status = "success"; state.stopCondition = "EVIDENCE_QUALIFIED_PRIORITIZE_FOUND"; }
  else if (state.spendUsd >= state.budgetUsd) { state.status = "budget_reached"; state.stopCondition = "ESCALATION_BUDGET_REACHED"; }
  else if (state.status === "running") { state.status = "exhausted"; state.stopCondition = "BOUNDED_PLAN_EXHAUSTED"; }
  if (deps.save) await deps.save(state);
  return state;
}

export function decisionCounts(candidates: ActionabilityCandidate[]): Record<AccountDecision, number> {
  const out: Record<AccountDecision, number> = { prioritize: 0, validate: 0, monitor: 0, hold: 0 };
  for (const c of candidates) if (c.account) out[c.account.decision]++;
  return out;
}
