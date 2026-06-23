-- ═══════════════════════════════════════════════════════════════════════════════
-- LeadLens — Delivery Packages Foundation (Sprint #2)
-- Stores downloadable lead packages generated from completed searches.
-- No delivery logic lives here — this is pure data storage for future use.
-- Service role only — customers access via signed URLs once file_url is set.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS delivery_packages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id    UUID        NOT NULL REFERENCES lead_searches(id) ON DELETE CASCADE,

  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'generating', 'ready', 'failed')),

  generated_at TIMESTAMPTZ,
  lead_count   INTEGER     NOT NULL DEFAULT 0,
  file_type    TEXT        NOT NULL DEFAULT 'csv'
                           CHECK (file_type IN ('csv', 'xlsx', 'json')),
  file_url     TEXT,       -- signed Supabase storage URL once generated
  error        TEXT,       -- set when status = 'failed'

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_packages_search_id
  ON delivery_packages (search_id);

CREATE INDEX IF NOT EXISTS idx_delivery_packages_status
  ON delivery_packages (status)
  WHERE status IN ('pending', 'generating');

DROP TRIGGER IF EXISTS delivery_packages_set_updated_at ON delivery_packages;
CREATE TRIGGER delivery_packages_set_updated_at
  BEFORE UPDATE ON delivery_packages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
