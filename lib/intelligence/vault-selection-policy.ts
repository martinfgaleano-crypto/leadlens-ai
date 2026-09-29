// ─── Vault Selection Policy (vault-selection-policy-v1) ───────────────────────
//
// Central instruction (§2): Vault is NOT the customer shortlist. Until the Vault
// holds a large, useful inventory, the customer-facing SELECTION must be driven by
// fresh EXTERNAL discovery — Vault stays an inventory / deduplication / research-
// memory layer, not the default source of accounts. Above the milestone, the wider
// stored inventory can legitimately become a candidate-generation source (still
// subject to freshness / evidence / decision standards, which this policy never
// relaxes).
//
// This module is the single, configurable place that decides that behavior. It does
// NOT change identity, evidence, or decision quality — only WHERE customer-facing
// candidates may originate. Pure and deterministic.

export const VAULT_SELECTION_THRESHOLD_DEFAULT = 5000;

export type VaultSelectionMode = "inventory_only" | "candidate_source";

export interface VaultSelectionPolicy {
  mode: VaultSelectionMode;
  threshold: number;
  vaultCount: number;
  /** Whether Vault records may seed the customer-facing candidate/selection pool.
   *  false below the milestone: Vault is used only for dedup + research memory, and
   *  a Vault company reaches the shortlist ONLY when independently rediscovered by
   *  fresh external evidence. */
  vaultAsSelectionSource: boolean;
  reason: string;
}

/** Resolve the policy from the live Vault company count and optional env overrides.
 *  VAULT_SELECTION_MODE forces a mode ("inventory_only" | "candidate_source");
 *  VAULT_SELECTION_THRESHOLD overrides the milestone. Precedence: explicit mode >
 *  threshold comparison. */
export function resolveVaultSelectionPolicy(
  vaultCount: number,
  env: { VAULT_SELECTION_THRESHOLD?: string; VAULT_SELECTION_MODE?: string } = {},
): VaultSelectionPolicy {
  const parsed = Number(env.VAULT_SELECTION_THRESHOLD);
  const threshold = Number.isFinite(parsed) && parsed > 0 ? parsed : VAULT_SELECTION_THRESHOLD_DEFAULT;
  const override = env.VAULT_SELECTION_MODE === "candidate_source" || env.VAULT_SELECTION_MODE === "inventory_only"
    ? (env.VAULT_SELECTION_MODE as VaultSelectionMode)
    : null;
  const mode: VaultSelectionMode = override ?? (vaultCount >= threshold ? "candidate_source" : "inventory_only");
  const vaultAsSelectionSource = mode === "candidate_source";
  const reason = override
    ? `explicit VAULT_SELECTION_MODE=${override}`
    : vaultAsSelectionSource
      ? `Vault (${vaultCount}) ≥ ${threshold} milestone → wider inventory may seed candidates (freshness/evidence still enforced)`
      : `Vault (${vaultCount}) < ${threshold} milestone → inventory/dedup/memory only; shortlist driven by fresh external discovery`;
  return { mode, threshold, vaultCount, vaultAsSelectionSource, reason };
}
