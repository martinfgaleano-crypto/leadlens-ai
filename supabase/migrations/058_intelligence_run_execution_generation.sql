-- 058_intelligence_run_execution_generation.sql
-- EXECUTION FENCING + VAULT CONCURRENCY SAFETY V1 (Phase 13/14) — late-writer fencing prep.
--
-- WHY: the atomic run claim (c4830bd) prevents two INITIAL executors, but after a 15-min
-- stale reclaim, Attempt 1 can resume and its save()/finalize (an unconditional UPDATE …
-- WHERE job_id/user_id) can overwrite Attempt 2's newer result. There is no execution
-- generation to fence writes on. The run's `attempt` lives inside report_json (JSONB) and is
-- not a clean top-level CAS target — fencing on it risks halting the failed-retry save path.
--
-- WHAT: a top-level integer generation column the claim can atomically bump and set, and that
-- every authoritative save/finalize can fence on (WHERE execution_generation = <my gen>). A
-- stale executor holding an older generation then no-ops instead of overwriting.
--
-- ADDITIVE + BACKWARD-COMPATIBLE: nullable-with-default; existing rows and non-intelligence
-- snapshot_reports rows are unaffected (default 0). No RLS/immutability change. snapshot_reports
-- is server-role/owner-scoped already.
--
-- ROLLBACK: ALTER TABLE snapshot_reports DROP COLUMN IF EXISTS execution_generation;
--
-- FOUNDER ACTION REQUIRED: apply in the Supabase SQL editor (or `supabase db push`). NOT
-- applied by this environment. The paired fencing CODE (claim bumps+returns generation; save/
-- finalize fence on it) is DEFERRED to the follow-up sprint and must land only AFTER this
-- column exists — implementing the fence before the column would break the save path.

ALTER TABLE snapshot_reports
  ADD COLUMN IF NOT EXISTS execution_generation integer NOT NULL DEFAULT 0;
