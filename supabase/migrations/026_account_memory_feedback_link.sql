-- 026_account_memory_feedback_link.sql
-- Adds columns to account_memory so exclude_similar feedback can mark
-- accounts as do_not_show with an explicit reason and signal trail.
-- Additive only — no changes to RLS, existing columns, or indexes.
-- No personal data — company-level only.

ALTER TABLE account_memory
  ADD COLUMN IF NOT EXISTS company             TEXT,
  ADD COLUMN IF NOT EXISTS industry            TEXT,
  ADD COLUMN IF NOT EXISTS segment             TEXT,
  ADD COLUMN IF NOT EXISTS do_not_show_reason  TEXT,
  ADD COLUMN IF NOT EXISTS last_feedback_signal TEXT;
