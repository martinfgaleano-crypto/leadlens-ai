-- 012_source_weights.sql
-- Source weight configuration table.
-- Controls which sources are active and how leads are allocated across them.
-- Admin-writable via service role. No customer access.

CREATE TABLE IF NOT EXISTS source_weights (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT        NOT NULL UNIQUE,
  weight      NUMERIC     NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 10),
  active      BOOLEAN     NOT NULL DEFAULT false,
  priority    INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_weights_source_name_idx ON source_weights (source_name);
CREATE INDEX IF NOT EXISTS source_weights_active_idx      ON source_weights (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS source_weights_priority_idx    ON source_weights (priority);

INSERT INTO source_weights (source_name, weight, active, priority) VALUES
  ('apollo',           1.0,  true,  1),
  ('google_maps',      0.5,  false, 2),
  ('linkedin',         0.7,  false, 3),
  ('directories',      0.4,  false, 4),
  ('crunchbase',       0.5,  false, 5),
  ('manual',           1.0,  false, 6)
ON CONFLICT (source_name) DO NOTHING;
