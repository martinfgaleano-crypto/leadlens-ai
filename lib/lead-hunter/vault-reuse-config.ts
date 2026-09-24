// ─── Hybrid Candidate Universe — Vault-reuse rollout + thin-universe policy ─────
//
// Governs WHEN the neutral Vault identity-reuse lane (lib/lead-hunter/vault-
// identity-reuse.ts) contributes to a productive Candidate Universe. Two orthogonal
// gates, both must pass:
//
//   1. ROLLOUT (reversible feature flag, env-driven):
//        OFF               — default; reuse never runs (original behavior, no DB read).
//        CANARY            — reuse runs ONLY for explicitly authorized context ids.
//        ELIGIBLE_FALLBACK — reuse runs for any context (post-acceptance).
//
//   2. THIN-UNIVERSE SUFFICIENCY (per-run, measured pre-Research):
//        reuse is considered ONLY when fresh Discovery did not already yield enough
//        canonical, domain-verified, geography-matched operating identities for the
//        run's tier. It is NOT triggered by low raw result counts, a missing event,
//        or an all-Hold Decision distribution — only by insufficient candidate
//        coverage (§10).
//
// The sufficiency signal is the strongest pre-Research qualification available at the
// runner boundary: DISTINCT canonical (domain) identities whose country matches the
// customer's requested geography. It is candidate COVERAGE, never target-validity,
// Fit, Timing or Decision — those are established downstream by Research (§11).

import type { DiscoveryPlan, DiscoveryRunOutput } from "./candidate-universe";
import { geographyMatches } from "./vault-identity-reuse";

export type VaultReuseMode = "OFF" | "CANARY" | "ELIGIBLE_FALLBACK";

export interface VaultReuseConfig {
  mode: VaultReuseMode;
  /** Context ids allowed to run reuse while mode = CANARY. Ignored otherwise. */
  canaryContextIds: Set<string>;
  /** CONTROLLED PRODUCTION ROLLOUT (Intelligence V1 freeze): lowercased geography tokens the reuse
   *  fallback is restricted to under mode = ELIGIBLE_FALLBACK. Non-empty → reuse fires ONLY when the
   *  run's target geography matches one of these (the accepted commercial envelope, e.g. "colombia").
   *  Empty → unchanged behavior (any geography), used by the isolated acceptance harness. Set in prod
   *  via VAULT_REUSE_ELIGIBLE_GEOS so ELIGIBLE_FALLBACK never activates in untested markets (§11-§13). */
  eligibleGeographies: Set<string>;
}

/** Tier-aware coverage sufficiency thresholds (distinct domain-verified, geography-
 * matched fresh identities at/above which fresh Discovery is considered adequate and
 * reuse stays OFF). Tier is derived from the technical discovery budget, mirroring
 * defaultDiscoveryRunner. These are coverage FLOORS, NOT commercial account caps.
 *
 * The floor must exceed the tier's DELIVERY target with headroom for the observed DISCARD
 * rate, otherwise reuse never fires to top up a large order even when fresh coverage cannot
 * fill it (the Portfolio 9/12 defect: fresh yielded 10, the old `intelligence` floor was 10,
 * so 10>=10 read as "sufficient" and the Vault fallback — which held 60+ eligible Colombia
 * companies — was never reached). Delivery targets: Preview 2, Brief 6, Portfolio 12, Premium
 * 18; measured DISCARD ≈ 10%, so floors carry ~2 companies of headroom. Split standard/pro so
 * a 12-company order isn't forced to over-collect for 18. */
export const FRESH_COVERAGE_SUFFICIENCY = { preview: 6, brief: 8, standard: 14, pro: 20 } as const;

function tierFromBudget(plan: DiscoveryPlan): keyof typeof FRESH_COVERAGE_SUFFICIENCY {
  const calls = plan.budget.maxProviderCalls;
  return calls <= 24 ? "preview" : calls <= 48 ? "brief" : calls <= 80 ? "standard" : "pro";
}

export function resolveVaultReuseConfig(env: NodeJS.ProcessEnv = process.env): VaultReuseConfig {
  const raw = (env.VAULT_REUSE_MODE ?? "OFF").trim().toUpperCase();
  const mode: VaultReuseMode =
    raw === "ELIGIBLE_FALLBACK" ? "ELIGIBLE_FALLBACK" : raw === "CANARY" ? "CANARY" : "OFF";
  const canaryContextIds = new Set(
    (env.VAULT_REUSE_CANARY_CONTEXTS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const eligibleGeographies = new Set(
    (env.VAULT_REUSE_ELIGIBLE_GEOS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return { mode, canaryContextIds, eligibleGeographies };
}

/** True when the run's target geography matches the controlled rollout allowlist. Case-insensitive
 *  containment either way (allowlist "colombia" matches a plan geography label "Colombia"). */
function planGeographyEligible(config: VaultReuseConfig, plan: DiscoveryPlan): boolean {
  if (config.eligibleGeographies.size === 0) return true; // unscoped (acceptance harness / not configured)
  const allow = Array.from(config.eligibleGeographies);
  return (plan.geographies ?? []).some((g) => {
    const label = String(g ?? "").trim().toLowerCase();
    if (!label) return false;
    return allow.some((a) => label.includes(a) || a.includes(label));
  });
}

/** Rollout gate only (does not consider sufficiency). CONTROLLED PRODUCTION ROLLOUT: ELIGIBLE_FALLBACK
 *  is additionally scoped to the eligible-geography allowlist when one is configured, so a global flag
 *  never activates reuse outside the accepted commercial envelope. */
export function vaultReuseEnabledForPlan(config: VaultReuseConfig, plan: DiscoveryPlan): boolean {
  if (config.mode === "ELIGIBLE_FALLBACK") return planGeographyEligible(config, plan);
  if (config.mode === "CANARY") return config.canaryContextIds.has(plan.contextRef.contextId) && planGeographyEligible(config, plan);
  return false;
}

/** Distinct canonical (domain) fresh identities whose country matches the requested
 * geography. Pre-Research candidate COVERAGE — not target-validity. Event-first and
 * account-first fresh orgs both count; reuse/memory origins are excluded so the
 * measure reflects only what FRESH Discovery produced. */
export function freshDomainVerifiedCoverage(out: DiscoveryRunOutput, plan: DiscoveryPlan): number {
  const seen = new Set<string>();
  for (const o of out.orgs) {
    if (o.origin.startsWith("vault") || o.origin.startsWith("context_memory")) continue;
    if (!o.domain) continue;
    if (plan.geographies.length > 0 && !geographyMatches({ name: o.name, domain: o.domain, country: o.country ?? null, region: null }, plan.geographies)) continue;
    seen.add(o.domain.trim().toLowerCase());
  }
  return seen.size;
}

export function freshCoverageIsSufficient(out: DiscoveryRunOutput, plan: DiscoveryPlan): boolean {
  return freshDomainVerifiedCoverage(out, plan) >= FRESH_COVERAGE_SUFFICIENCY[tierFromBudget(plan)];
}

/** Combined gate for withVaultReuse: reuse only when the rollout allows this plan AND
 * fresh coverage is insufficient. Returns false (→ no Vault read, original behavior)
 * whenever either condition fails. */
export function makeVaultReuseGate(
  config: VaultReuseConfig,
): (out: DiscoveryRunOutput, plan: DiscoveryPlan) => boolean {
  return (out, plan) => vaultReuseEnabledForPlan(config, plan) && !freshCoverageIsSufficient(out, plan);
}
