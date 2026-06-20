-- ═══════════════════════════════════════════════════════════════════════════════
-- LeadLens — SaaS Foundation v1 Schema
-- Run this in Supabase SQL Editor: supabase.com → Project → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── updated_at trigger function ──────────────────────────────────────────────
-- Safe to run multiple times (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── orders ───────────────────────────────────────────────────────────────────
-- Canonical record of every purchase. Created by Lemon Squeezy webhook.

CREATE TABLE IF NOT EXISTS orders (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_order_id TEXT        UNIQUE,           -- Lemon Squeezy order ID
  payment_provider  TEXT        NOT NULL DEFAULT 'lemon_squeezy',
  provider_event_id TEXT,                         -- LS webhook event ID (for dedup)
  customer_email    TEXT        NOT NULL,
  customer_name     TEXT,
  plan              TEXT        NOT NULL,          -- sample | starter | standard | pro
  amount_cents      INTEGER     NOT NULL,          -- 700 | 2900 | 7900 | 14900
  currency          TEXT        NOT NULL DEFAULT 'USD',
  status            TEXT        NOT NULL DEFAULT 'paid',
  -- paid | refunded | disputed | cancelled
  intake_status     TEXT        NOT NULL DEFAULT 'pending',
  -- pending | received | complete
  delivery_status   TEXT        NOT NULL DEFAULT 'pending',
  -- pending | in_progress | delivered | failed
  checkout_id       TEXT,
  raw_payload       JSONB,                         -- full provider webhook payload
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_external_order_id_idx ON orders(external_order_id);
CREATE INDEX IF NOT EXISTS orders_customer_email_idx    ON orders(customer_email);
CREATE INDEX IF NOT EXISTS orders_status_idx            ON orders(status);
CREATE INDEX IF NOT EXISTS orders_delivery_status_idx   ON orders(delivery_status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx        ON orders(created_at DESC);

DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── customer_intakes ─────────────────────────────────────────────────────────
-- Customer targeting brief. Arrives after order, by email or form.

CREATE TABLE IF NOT EXISTS customer_intakes (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                   UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_email             TEXT        NOT NULL,
  -- Denormalized key fields for filtering/querying
  company_name               TEXT        NOT NULL,
  target_industry            TEXT,
  target_geography           TEXT,
  preferred_tone             TEXT        NOT NULL DEFAULT 'direct',
  output_language            TEXT        NOT NULL DEFAULT 'en',
  -- Full OnboardingData as JSONB (drives the pipeline)
  onboarding_data            JSONB       NOT NULL,
  -- Extended intake fields not in OnboardingData
  website                    TEXT,
  target_company_size        TEXT,
  buyer_titles               TEXT[],
  exclusions                 TEXT,
  existing_customer_examples TEXT,
  notes                      TEXT,
  clarity_score              INTEGER,               -- 1–10 admin assessment
  status                     TEXT        NOT NULL DEFAULT 'pending',
  -- pending | processing | ready | error
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_intakes_order_id_idx ON customer_intakes(order_id);
CREATE INDEX IF NOT EXISTS customer_intakes_email_idx    ON customer_intakes(customer_email);
CREATE INDEX IF NOT EXISTS customer_intakes_status_idx   ON customer_intakes(status);

DROP TRIGGER IF EXISTS customer_intakes_set_updated_at ON customer_intakes;
CREATE TRIGGER customer_intakes_set_updated_at
  BEFORE UPDATE ON customer_intakes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── jobs ─────────────────────────────────────────────────────────────────────
-- Pipeline execution unit. One order → one job.

CREATE TABLE IF NOT EXISTS jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID        NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  intake_id     UUID        REFERENCES customer_intakes(id) ON DELETE SET NULL,
  plan          TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'awaiting_intake',
  -- pending | awaiting_intake | intake_received | queued
  -- processing | completed | error | delivered
  progress      INTEGER     NOT NULL DEFAULT 0,    -- 0–100
  report_id     UUID,                              -- set after report created
  error_message TEXT,
  admin_approved BOOLEAN    NOT NULL DEFAULT FALSE,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jobs_order_id_idx   ON jobs(order_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx     ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs(created_at DESC);

DROP TRIGGER IF EXISTS jobs_set_updated_at ON jobs;
CREATE TRIGGER jobs_set_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── reports ──────────────────────────────────────────────────────────────────
-- Stores completed pipeline output. job.report_id points here.

CREATE TABLE IF NOT EXISTS reports (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  order_id         UUID        NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  plan             TEXT        NOT NULL,
  lead_count       INTEGER     NOT NULL,
  report_json      JSONB       NOT NULL,            -- full LeadLensReport
  csv_content      TEXT,                            -- pre-generated CSV string
  markdown_content TEXT,                            -- pre-generated Markdown string
  status           TEXT        NOT NULL DEFAULT 'ready',
  -- pending | ready | delivered
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS reports_job_id_idx ON reports(job_id);
CREATE INDEX IF NOT EXISTS reports_order_id_idx      ON reports(order_id);
CREATE INDEX IF NOT EXISTS reports_status_idx        ON reports(status);

DROP TRIGGER IF EXISTS reports_set_updated_at ON reports;
CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── job_events ───────────────────────────────────────────────────────────────
-- Immutable audit trail for every state change.

CREATE TABLE IF NOT EXISTS job_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  order_id   UUID        REFERENCES orders(id) ON DELETE SET NULL,
  event_type TEXT        NOT NULL,
  -- created | intake_requested | intake_received | queued
  -- pipeline_started | pipeline_completed | admin_approved
  -- delivered | error | note_added | status_changed | refunded
  message    TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- no updated_at: events are immutable
);

CREATE INDEX IF NOT EXISTS job_events_job_id_idx    ON job_events(job_id);
CREATE INDEX IF NOT EXISTS job_events_order_id_idx  ON job_events(order_id);
CREATE INDEX IF NOT EXISTS job_events_created_at_idx ON job_events(created_at DESC);

-- ─── admin_notes ──────────────────────────────────────────────────────────────
-- Internal admin notes per order or job.

CREATE TABLE IF NOT EXISTS admin_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID        REFERENCES orders(id) ON DELETE CASCADE,
  job_id     UUID        REFERENCES jobs(id) ON DELETE CASCADE,
  note       TEXT        NOT NULL,
  created_by TEXT        NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- immutable: no updated_at
);

CREATE INDEX IF NOT EXISTS admin_notes_order_id_idx ON admin_notes(order_id);
CREATE INDEX IF NOT EXISTS admin_notes_job_id_idx   ON admin_notes(job_id);

-- ─── RLS (disabled — server-only via service role key) ────────────────────────
-- Enable RLS only when customer auth is added in Phase F.

ALTER TABLE orders           DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_intakes DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs             DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports          DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_events       DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notes      DISABLE ROW LEVEL SECURITY;

-- ─── Keep backward-compatible batch_jobs if it exists ─────────────────────────
-- The existing in-memory job-store may reference batch_jobs.
-- This table is kept as a fallback; new code uses the jobs table above.

CREATE TABLE IF NOT EXISTS batch_jobs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  status            TEXT        NOT NULL DEFAULT 'pending',
  payment_status    TEXT                  DEFAULT 'unpaid',
  onboarding        JSONB       NOT NULL,
  customer_email    TEXT        NOT NULL,
  stripe_session_id TEXT,
  icp               JSONB,
  raw_leads         JSONB       DEFAULT '[]',
  processed_leads   JSONB       DEFAULT '[]',
  report_summary    JSONB,
  error_message     TEXT,
  plan              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

ALTER TABLE batch_jobs DISABLE ROW LEVEL SECURITY;
