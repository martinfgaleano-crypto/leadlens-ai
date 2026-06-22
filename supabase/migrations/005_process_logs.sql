-- 005_process_logs.sql
-- Adds processing log columns to lead_searches.
-- These are written by the auto-processing pipeline and are admin-visible.
-- RLS is unchanged — customers can read these fields but they only contain
-- timestamps and counts, not internal notes.

ALTER TABLE lead_searches
  ADD COLUMN IF NOT EXISTS process_started_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS process_finished_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS process_duration_ms      INTEGER,
  ADD COLUMN IF NOT EXISTS process_generated_count  INTEGER,
  ADD COLUMN IF NOT EXISTS process_duplicates_skipped INTEGER,
  ADD COLUMN IF NOT EXISTS process_error_message    TEXT;
