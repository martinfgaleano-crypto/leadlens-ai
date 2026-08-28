---
name: leadlens-migration-safe
description: Safely create or reconcile a Supabase migration for LeadLens without ever editing an applied migration or auto-applying to production. Invoke whenever the task adds/changes anything under supabase/migrations/, needs a new table/column, or reconciles a live-schema drift.
---

# leadlens-migration-safe

Migrations are **forward-only** and **founder-applied**. This environment cannot (and must not) apply DDL to production.

## Rules
- **Never edit an already-numbered/applied migration.** Fixes go in a NEW higher-numbered migration (e.g. a stray/incorrect live table → a guarded `054` that only touches it when it's the wrong shape and empty).
- **Never auto-apply.** No `supabase db push/reset`, no `psql ... drop/alter` against production (the guard blocks these). Prepare the SQL file only.
- **Owner isolation + RLS** on any customer-scoped table; server-only writes; immutable/append-only where the domain requires it (add an `update/delete` trigger if immutability matters).
- **Guarded destructive steps:** any `drop`/reshape must be wrapped in a `do $$ … $$` guard that refuses when the table has rows or is already canonical (never drop data).

## Procedure
1. Audit existing migrations + the live schema **read-only**: `node scripts/accept-confirmed-context.mjs` / `npm run probe:supabase` (or a bespoke read-only probe). Determine whether a table exists and matches the canonical shape.
2. If a change is truly needed, add the smallest new `supabase/migrations/NNN_*.sql` (never modify a prior one). Include the rollback note, indexes, RLS, and any immutability trigger.
3. Provide the founder a copy-pasteable SQL block and the exact apply step (Supabase SQL editor or `supabase db push`), then a re-check command to confirm.
4. In the report: state **MIGRATION CREATED vs APPLIED** separately; if unapplied, `FOUNDER ACTION REQUIRED` and do NOT call persistence "operational/live".

## Output
A single new migration file + a read-only acceptance/probe result + an explicit applied/not-applied status. Never claim a live DB change you did not verify read-only.
