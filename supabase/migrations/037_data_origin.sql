-- ─── 037: Production data isolation — explicit data origin on vault_signals ───
-- Additive + fail-closed. The signal is the entity that enters the selector, so
-- the origin contract lives here (not duplicated on companies/sources).
-- Unknown or unverifiable origin is NEVER production-eligible:
--   default data_origin = 'legacy_unknown', production_eligible = false.
-- Only explicit, traceable production data may set production_eligible = true.

ALTER TABLE vault_signals
  ADD COLUMN IF NOT EXISTS data_origin TEXT NOT NULL DEFAULT 'legacy_unknown'
    CHECK (data_origin IN ('production','benchmark','demo','fixture','synthetic','internal_qa','legacy_unknown')),
  ADD COLUMN IF NOT EXISTS production_eligible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origin_reason TEXT,
  ADD COLUMN IF NOT EXISTS origin_version TEXT;

-- Eligibility invariant: only production data can be production-eligible.
ALTER TABLE vault_signals
  ADD CONSTRAINT vault_signals_origin_eligibility
  CHECK (production_eligible = false OR data_origin = 'production');

-- ── Backfill: demo/seed data (isolated, never deleted) ──
UPDATE vault_signals s SET
  data_origin = 'demo', production_eligible = false,
  origin_reason = 'backfill origin-v1: [DEMO] marker or example.com seed source',
  origin_version = 'origin-v1'
WHERE s.data_origin = 'legacy_unknown' AND (
  s.signal_summary ILIKE '%[DEMO]%'
  OR EXISTS (SELECT 1 FROM vault_sources src WHERE src.id = s.source_id
             AND (src.source_title ILIKE '%[DEMO]%' OR src.source_url ILIKE '%example.com%'))
  OR EXISTS (SELECT 1 FROM vault_companies c WHERE c.id = s.company_id
             AND c.name ILIKE 'Demo Company%')
);

-- ── Backfill: real provider-search observations with recorded provenance ──
UPDATE vault_signals s SET
  data_origin = 'production', production_eligible = true,
  origin_reason = 'backfill origin-v1: provider_search observation with recorded provenance',
  origin_version = 'origin-v1'
WHERE s.data_origin = 'legacy_unknown'
  AND EXISTS (SELECT 1 FROM vault_sources src WHERE src.id = s.source_id
              AND src.raw_metadata->>'source_mode' = 'provider_search_observation');

-- Everything else stays legacy_unknown / production_eligible=false (fail-closed).

CREATE INDEX IF NOT EXISTS idx_vault_signals_prod_eligible
  ON vault_signals (production_eligible) WHERE production_eligible = true;
