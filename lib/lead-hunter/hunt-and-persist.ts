// ─── Lead Hunter production orchestration — run, persist, hand off ─────────────
//
// Ties the V1 facade to durable persistence and the authenticated job lifecycle:
//   authorized {contextId, version} → hunt (owner-scoped) → persist immutable
//   universe snapshot → research-ready candidates.
//
// Idempotent: the runId is deterministic (context + date), so re-invoking a
// completed run REUSES the persisted snapshot instead of re-hunting/duplicating.
// Fail-safe: a failed/incomplete discovery is persisted as a failed run (honest),
// never a fabricated completed universe.

import type { LeadCandidate } from "@/types";
import {
  huntFromConfirmedContext,
  type CandidateAccount,
  type CandidateAccountUniverse,
  type DiscoveryRunner,
  type HuntOptions,
} from "./candidate-universe";
import {
  type LeadHunterRunStore,
  type LeadHunterRunRecord,
} from "./run-store";
import type { ConfirmedContextStore, ContextSelector } from "@/lib/interpretation/confirmed-context-store";

export type LeadHunterRunResult =
  | { ok: true; runId: string; universe: CandidateAccountUniverse; created: boolean; reused: boolean }
  | { ok: false; reason: string };

/**
 * Run Lead Hunter for an authorized confirmed context and persist the resulting
 * universe as an immutable snapshot. Owner-scoped throughout.
 *
 *   • Missing / unauthorized context → refusal (never runs discovery).
 *   • Already-persisted runId → reuse (idempotent, no duplicate snapshot).
 *   • Discovery failure → persisted as a FAILED run; ok:true with universe.ok=false
 *     so the caller can see the honest coverage (no fabricated candidates).
 */
export async function runAndPersistLeadHunter(
  contextStore: ConfirmedContextStore,
  runStore: LeadHunterRunStore,
  userId: string,
  selector: ContextSelector,
  runner: DiscoveryRunner,
  opts: HuntOptions = {},
): Promise<LeadHunterRunResult> {
  const hunted = await huntFromConfirmedContext(contextStore, userId, selector, runner, {
    ...opts,
    runScope: opts.runScope ? `${userId}_${opts.runScope}` : userId,
  });
  if (!hunted.ok) return { ok: false, reason: hunted.reason };

  const universe = hunted.universe;

  // Idempotency: if this runId is already persisted for this owner, reuse it.
  const existing = await runStore.load(universe.runId, userId).catch(() => null);
  if (existing) return { ok: true, runId: universe.runId, universe: existing.universe, created: false, reused: true };

  const record: LeadHunterRunRecord = {
    runId: universe.runId,
    userId,
    status: universe.ok ? "completed" : "failed",
    contextRef: universe.contextRef,
    universe,
    createdAt: universe.generatedAt,
  };
  const { created } = await runStore.persist(record);
  return { ok: true, runId: universe.runId, universe, created, reused: !created };
}

/** Load a persisted universe (owner-scoped). */
export async function loadLeadHunterUniverse(
  runStore: LeadHunterRunStore,
  runId: string,
  userId: string,
): Promise<CandidateAccountUniverse | null> {
  const rec = await runStore.load(runId, userId);
  return rec?.universe ?? null;
}

// ─── Downstream Research handoff ──────────────────────────────────────────────

/** Candidates that may proceed to Research: identity-resolvable and in scope.
 *  EXCLUDED and IDENTITY_AMBIGUOUS candidates are held for exception handling —
 *  they never block the valid subset (§20). */
export function researchReadyCandidates(universe: CandidateAccountUniverse): CandidateAccount[] {
  return universe.candidates.filter((c) => c.status === "eligible" || c.status === "likely_eligible" || c.status === "needs_validation");
}

/**
 * Map research-ready candidates into LeadCandidate[] for the existing pipeline's
 * `candidatesOverride` seam (which SKIPS provider discovery and processes exactly
 * these). Discovery provenance is carried as source CONTEXT only — never as
 * Evidence. Research independently generates claims/Signals/Fit/Timing/Decision.
 */
export function toResearchCandidates(universe: CandidateAccountUniverse): LeadCandidate[] {
  return researchReadyCandidates(universe).map((c, i) => ({
    id: `${universe.runId}_cand_${i}`,
    company: c.identity.canonicalName,
    domain: c.identity.domain,
    website_url: c.identity.domain ? `https://${c.identity.domain}` : undefined,
    location: c.identity.country,
    country: c.identity.country ?? null,
    industry: c.identity.organizationType,
    source: "public_signal" as const,
    // Deliberately NOT mapped to source_url: discovery provenance is context,
    // never Evidence. Research must independently recover and accept a source.
    discovery_provenance: c.provenance.map((p) => ({ route: p.route, origin: p.origin, provider: p.provider, sourceUrl: p.sourceUrl })),
    // IDENTITY confidence only (not an opportunity/lead score): how sure we are
    // this is the right organization. Research owns Fit/Timing/Decision.
    confidence_score: c.identity.confidence === "verified" ? 0.8 : 0.5,
  }));
}
