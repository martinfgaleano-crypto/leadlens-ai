-- ═══════════════════════════════════════════════════════════════════════════════
-- LeadLens — Fix onboarding_requests nullable columns (Phase 17 hotfix)
-- ideal_customer was created NOT NULL in 016 but the public form marks it
-- optional. Make it nullable so submissions succeed without it.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE onboarding_requests
  ALTER COLUMN ideal_customer DROP NOT NULL;
