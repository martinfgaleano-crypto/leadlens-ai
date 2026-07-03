// ─── Source Engine type skeletons v0 (NO implementation) ─────────────────────
// Contracts for the future account/signal discovery engine. Nothing here runs;
// no adapters exist yet. See docs/strategy/SOURCE_ENGINE_ARCHITECTURE.md.
//
// Account-level ONLY: these types intentionally have no fields for personal
// names, emails, phones, or personal LinkedIn. Adding such fields violates the
// product boundary — the source engine discovers companies, never people.

import type { SignalRole, SourceType } from "@/types";

/** Reliability tier per source adapter — new sources start "unproven" and are
 *  never customer-facing until internally evaluated. */
export type SourceReliability = "high" | "medium" | "low" | "unproven";

/** A discovery source adapter (news, public registries, company-level job
 *  posting aggregates, corporate sites, sector directories, licensed data). */
export interface AccountDiscoverySource {
  id: string;
  label: string;
  source_type: SourceType;
  regions: string[];               // region codes this adapter covers
  reliability: SourceReliability;
  tos_safe: boolean;               // must be true to ever run — no gray scraping
  customer_facing: boolean;        // false until it passes internal QA sampling
}

/** A discovered company candidate — account-level evidence only. */
export interface SourceCandidate {
  company: string;
  domain?: string;
  industry?: string;
  region?: string;
  /** Account-level evidence text (e.g. "opened second plant in Medellín"). */
  evidence_summary: string;
  /** Structured date from the source, or null. NEVER extracted from free text,
   *  NEVER invented — Signal Date v0 rule. Null ⇒ freshness "unknown". */
  signal_date: string | null;
  source_id: string;               // AccountDiscoverySource.id
  source_url_host?: string;        // hostname only — never full tracking URLs
}

/** A classified signal extracted from a candidate's evidence. */
export interface SignalExtractionResult {
  claim: string;
  signal_role: SignalRole;         // timing_signal vs context_only vs unknown
  signal_date: string | null;      // structured or null — same rule as above
  source_id: string;
}

/** A bounded discovery execution — same job pattern as monitor runs. */
export interface DiscoveryRun {
  id: string;
  icp_id?: string;
  region: string;
  source_ids: string[];
  status: "processing" | "completed" | "failed";
  candidates_found: number;
  created_at: string;
}

/** Vault-style reuse: previously discovered candidates served from cache
 *  before re-querying sources (same principle as vault_leads today). */
export interface DiscoveryCacheEntry {
  candidate: SourceCandidate;
  discovered_at: string;
  reuse_count: number;
}
