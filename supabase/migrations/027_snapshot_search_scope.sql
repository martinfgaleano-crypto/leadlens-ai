-- 027_snapshot_search_scope.sql
-- Adds search_id to snapshot_reports so pipeline runs can be scoped to the same
-- lead_search / Monthly Monitor series.
--
-- Purpose: enables safe previous-snapshot comparison in "What Changed Since Last
-- Report" (Phase 2). Without this column, getPreviousCompletedSnapshot must return
-- null to avoid cross-customer or cross-search comparisons.
--
-- Design decisions:
--   - Nullable: existing rows keep NULL (treated as "unscoped" by query logic).
--   - ON DELETE SET NULL: if a lead_search is deleted, the snapshot row is
--     preserved for audit/history; search_id becomes NULL (safe fallback).
--   - Composite index on (search_id, created_at DESC): supports the "latest
--     completed snapshot for this search" query efficiently.
--   - No RLS change: snapshot_reports is backend-only; service role key used.

ALTER TABLE snapshot_reports
  ADD COLUMN IF NOT EXISTS search_id UUID REFERENCES lead_searches(id) ON DELETE SET NULL;

-- Supports: .eq("search_id", id).eq("status","completed").order("created_at",{desc}).limit(1)
CREATE INDEX IF NOT EXISTS snapshot_reports_search_id_created_idx
  ON snapshot_reports (search_id, created_at DESC)
  WHERE search_id IS NOT NULL;
