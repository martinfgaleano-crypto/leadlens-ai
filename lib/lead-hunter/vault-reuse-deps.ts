// ─── Production Vault-reuse deps — read-only neutral identity projection ────────
//
// Supplies VaultReuseDeps.fetchNeutralIdentities for the productive Hybrid Candidate
// Universe. Reads the GLOBAL vault_companies registry SERVER-SIDE only, selecting
// EXCLUSIVELY the approved neutral identity columns:
//
//     name, domain, country, region
//
// It deliberately does NOT select `industry` (customer-ICP-derived, §4), source
// status, observation counts, timestamps, or any customer-relative column, so no
// other tenant's Commercial Context can travel with a candidate. The read is
// idempotent and side-effect free — it never writes, reserves, or advances an
// observation (§25). Fail-closed: any misconfiguration or query error yields [] so a
// customer discovery run is never broken by Vault unavailability (§24).
//
// Not exercised by unit tests (it needs a live Supabase client), mirroring
// discovery-runner.ts. Its projection contract is enforced by the neutral-projection
// and gate tests over vault-identity-reuse.ts + vault-reuse-config.ts.

import type { NeutralVaultIdentity, VaultReuseDeps } from "./vault-identity-reuse";

/** Minimal structural view of the server Supabase client used for the read. */
export interface VaultReadClient {
  from(table: string): {
    select(columns: string): {
      limit(n: number): Promise<{ data: unknown; error: unknown }>;
    };
  };
}

/** Bounded ceiling on rows fetched per run. The global registry is small; this only
 * caps a pathological table. Geography filtering + the 40-candidate budget are applied
 * downstream by selectVaultReuseCandidates. */
export const VAULT_REUSE_FETCH_LIMIT = 1000;

interface NeutralRow { name?: unknown; domain?: unknown; country?: unknown; region?: unknown }

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

export function createVaultReuseDeps(db: VaultReadClient | null): VaultReuseDeps {
  return {
    async fetchNeutralIdentities(_geographies: string[]): Promise<NeutralVaultIdentity[]> {
      if (!db) return [];
      try {
        // Column-narrowed projection: ONLY neutral public identity fields leave the DB.
        const { data, error } = await db
          .from("vault_companies")
          .select("name, domain, country, region")
          .limit(VAULT_REUSE_FETCH_LIMIT);
        if (error || !Array.isArray(data)) return [];
        return (data as NeutralRow[]).map((r) => ({
          name: str(r.name),
          domain: str(r.domain),
          country: str(r.country),
          region: str(r.region),
        }));
      } catch {
        return []; // fail-closed
      }
    },
  };
}
