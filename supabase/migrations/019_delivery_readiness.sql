-- ═══════════════════════════════════════════════════════════════════════════════
-- LeadLens — Delivery Readiness + Processing State (Sprint #2)
-- Adds delivery_ready, processing_ready, and trigger source tracking to
-- lead_searches so the pipeline can mark searches ready-for-export and
-- track how/when processing was initiated.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE lead_searches
  ADD COLUMN IF NOT EXISTS delivery_ready            BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_ready_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_ready          BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS processing_trigger_source TEXT;
  -- processing_trigger_source values: 'dashboard' | 'admin' | 'webhook' | 'manual'

CREATE INDEX IF NOT EXISTS idx_lead_searches_delivery_ready
  ON lead_searches (delivery_ready)
  WHERE delivery_ready = true;

CREATE INDEX IF NOT EXISTS idx_lead_searches_processing_ready
  ON lead_searches (processing_ready)
  WHERE processing_ready = true;
