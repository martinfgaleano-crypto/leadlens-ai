-- 057_vault_company_domain_unique.sql
-- RUNTIME SCALE SAFETY V1 — Vault concurrency safety (Phase 8).
--
-- WHY: vault_companies dedup is application-level read-before-insert (findVaultCompanyByDomain
-- then createVaultCompany), backed only by a NON-unique index (029: vault_companies_domain_idx).
-- Safe under SERIAL accretion (the in-batch seenDomains guard + findByDomain), but NOT safe
-- once two accounts are researched concurrently: both can miss the read and both insert the
-- same canonical company -> duplicate rows. Bounded account concurrency is BLOCKED until a
-- DB-level uniqueness guarantee exists. This migration adds it.
--
-- SEMANTICS: domain is the canonical company identity key in Vault V1 (accretion normalizes
-- to lowercase + strips leading "www." before insert; same name / different domain stays two
-- companies; subsidiaries/brands with distinct domains stay distinct — Vault V1 §10). A
-- partial UNIQUE index on domain (WHERE domain IS NOT NULL) enforces exactly that contract.
-- No-domain companies remain unconstrained (they are never admitted to the registry anyway).
--
-- PRE-CHECK (read-only, 2026-08-30): 86 rows have a domain; 86 distinct normalized domains;
-- 0 duplicate normalized domains -> the unique index builds without a dedup step. If a future
-- apply finds duplicates, dedup (keep the oldest per domain) BEFORE creating the index.
--
-- ROLLBACK: DROP INDEX IF EXISTS vault_companies_domain_unique_idx;  (then optionally recreate
-- the plain 029 index if it was replaced — this migration KEEPS 029's index and only ADDS a
-- unique one, so rollback is a single DROP.)
--
-- FOUNDER ACTION REQUIRED: apply in the Supabase SQL editor (or `supabase db push`). NOT
-- applied by this environment. After apply, the paired code change (createVaultCompany ->
-- INSERT ... ON CONFLICT (domain) DO NOTHING/UPDATE) may be enabled; do NOT enable ON CONFLICT
-- before this index exists (Postgres requires a matching unique constraint).

CREATE UNIQUE INDEX IF NOT EXISTS vault_companies_domain_unique_idx
  ON vault_companies (domain)
  WHERE domain IS NOT NULL;
