import type { AccountDossier, AccountState, CanonicalEvidence, ClaimAssessment, ClientContext } from "./evidence-temporal";

type Result<T> = { data: T | null; error: { message: string } | null };
type Query = {
  upsert(value: unknown, options?: Record<string, unknown>): { select(columns: string): { single(): Promise<Result<unknown>>; maybeSingle(): Promise<Result<unknown>> } };
  insert(value: unknown): { select(columns: string): { single(): Promise<Result<unknown>> } };
  select(columns: string): {
    eq(column: string, value: unknown): Query["select"];
    is(column: string, value: null): Query["select"];
    order(column: string, options?: Record<string, unknown>): { limit(n: number): { maybeSingle(): Promise<Result<unknown>> } };
  };
};
export type EvidenceDb = { from(table: string): Query };

async function configuredDb(): Promise<EvidenceDb | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient() as unknown as EvidenceDb;
}
const fail = (message: string) => ({ ok: false as const, persisted: false as const, reason: message });

export async function persistEvidenceBundle(input: {
  tenant_user_id: string | null; client_id: string | null; evidence: CanonicalEvidence[];
  claims: ClaimAssessment[]; state: AccountState; dossier: AccountDossier; context?: ClientContext | null;
  db?: EvidenceDb | null;
}): Promise<{ ok: boolean; persisted: boolean; reason: string | null }> {
  const db = input.db === undefined ? await configuredDb() : input.db;
  if (!db) return fail("Supabase unavailable; migration 042 data was not promoted.");
  try {
    for (const e of input.evidence) {
      const { error } = await db.from("intelligence_evidence").upsert({
        id: e.evidence_id, tenant_user_id: input.tenant_user_id, client_id: input.client_id,
        scope: e.scope, scope_key: e.scope_key, source_url: e.url, canonical_url: e.canonical_url,
        domain: e.domain, publisher: e.publisher, source_type: e.source_type, provider: e.provider,
        provider_result_id: e.provider_result_id, title: e.title, excerpt: e.excerpt,
        claim_text: e.claim_text, claim_type: e.claim_type, publication_date: e.publication_date,
        publication_date_state: e.publication_date_state, publication_date_confidence: e.publication_date_confidence,
        retrieved_at: e.retrieved_at, verified_at: e.verified_at, language: e.language, country: e.country,
        entity_match: e.entity_match, entity_match_confidence: e.entity_match_confidence,
        source_quality: e.source_quality, duplicate_cluster_id: e.duplicate_cluster_id,
        syndicated_from: e.syndicated_from, contradiction_group_id: e.contradiction_group_id,
        extraction_method: e.extraction_method, methodology_version: e.methodology_version,
        raw_reference: e.raw_reference, supersedes_evidence_id: e.supersedes_evidence_id,
      }, { onConflict: "id", ignoreDuplicates: true }).select("id").maybeSingle();
      if (error) return fail(`Evidence persistence failed: ${error.message}`);
    }
    for (const c of input.claims) {
      const { error } = await db.from("intelligence_claims").upsert({
        id: c.claim_id, tenant_user_id: input.tenant_user_id, client_id: input.client_id,
        scope: c.scope, scope_key: c.scope_key, category: c.category, statement: c.statement,
        valid_from: c.time_scope.valid_from, valid_until: c.time_scope.valid_until,
        independent_source_count: c.independent_source_count, source_diversity: c.source_diversity,
        support_count: c.support_count, contradiction_count: c.contradiction_count,
        confidence: c.confidence, freshness: c.freshness, corroboration_state: c.corroboration_state,
        prior_claim_id: c.prior_claim_id, change_reason: c.change_reason, methodology_version: c.methodology_version,
      }, { onConflict: "id", ignoreDuplicates: true }).select("id").maybeSingle();
      if (error) return fail(`Claim persistence failed: ${error.message}`);
      for (const link of c.links) {
        const result = await db.from("intelligence_claim_evidence").upsert({
          claim_id: c.claim_id, evidence_id: link.evidence.evidence_id, relation: link.relation,
          semantic_compatibility: link.semantic_compatibility ?? 1, time_compatible: link.time_compatible ?? true,
        }, { onConflict: "claim_id,evidence_id,relation", ignoreDuplicates: true }).select("claim_id").maybeSingle();
        if (result.error) return fail(`Claim-evidence persistence failed: ${result.error.message}`);
      }
    }
    if (input.context) {
      const result = await db.from("intelligence_client_contexts").upsert({
        tenant_user_id: input.tenant_user_id, client_id: input.context.client_id,
        context_json: input.context, context_fingerprint: JSON.stringify(input.context),
        captured_at: input.context.captured_at,
      }, { onConflict: "tenant_user_id,client_id,context_fingerprint", ignoreDuplicates: true }).select("id").maybeSingle();
      if (result.error) return fail(`Client context persistence failed: ${result.error.message}`);
    }
    const stateResult = await db.from("intelligence_account_states").upsert({
      id: input.state.state_id, tenant_user_id: input.tenant_user_id, client_id: input.client_id,
      account_key: input.state.account_key, observed_at: input.state.observed_at,
      fingerprint: input.state.fingerprint, structural_score: input.state.structural_score,
      timing_state: input.state.timing_state, corroborated_claims: input.state.corroborated_claims,
      contradicted_claims: input.state.contradicted_claims, claim_ids: input.state.claims.map((c) => c.claim_id),
      material_changes: input.state.material_changes, methodology_version: input.state.methodology_version,
    }, { onConflict: "id", ignoreDuplicates: true }).select("id").maybeSingle();
    if (stateResult.error) return fail(`Account state persistence failed: ${stateResult.error.message}`);
    const dossierResult = await db.from("intelligence_dossiers").upsert({
      id: input.dossier.dossier_id, tenant_user_id: input.tenant_user_id, client_id: input.client_id,
      account_key: input.dossier.account_key, account_state_id: input.state.state_id,
      dossier_json: input.dossier, internal_only: true, methodology_version: input.dossier.methodology_version,
      generated_at: input.dossier.generated_at,
    }, { onConflict: "id", ignoreDuplicates: true }).select("id").maybeSingle();
    if (dossierResult.error) return fail(`Dossier persistence failed: ${dossierResult.error.message}`);
    return { ok: true, persisted: true, reason: null };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unknown persistence failure.");
  }
}
