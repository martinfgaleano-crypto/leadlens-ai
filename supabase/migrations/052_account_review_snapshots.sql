-- Account Memory V1.1 — durable per-review canonical Case snapshots.
-- Generated only; DO NOT apply automatically. Founder approval required before apply.
-- Immutable append-only store: one row per (review, account). Holds ONLY canonical
-- structured intelligence (no rendered UI/prose). Used to load the predecessor
-- review and diff the Living Opportunity Case. Owner-scoped, RLS-on.
--
-- Rollback:
--   drop table if exists public.account_review_snapshots;
--
create table if not exists public.account_review_snapshots(
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,  -- authorized owner (null = unlinked/legacy)
  client_key text not null,             -- stable client/subject identity
  account_id text not null,             -- stable canonical account identity (not display name)
  review_id text not null,              -- stable review identity (job id) — never a clock
  context_version text not null,        -- commercial objective/criteria lineage
  reviewed_at timestamptz not null,     -- evaluation time (ordering only)
  snapshot jsonb not null,              -- canonical AccountReviewSnapshot (no prose)
  fingerprint text not null,            -- idempotency: identical intelligence ⇒ identical
  created_at timestamptz not null default now(),
  -- Idempotency: re-viewing / retrying a completed review re-upserts the same row.
  unique nulls not distinct (owner_user_id, client_key, account_id, review_id)
);

-- Predecessor lookup: latest prior accepted review for (owner, client, account)
-- strictly before the current reviewed_at — one indexed range scan, no N+1.
create index if not exists idx_ars_lineage on public.account_review_snapshots(owner_user_id, client_key, account_id, reviewed_at desc);
create index if not exists idx_ars_review  on public.account_review_snapshots(review_id);

alter table public.account_review_snapshots enable row level security;
-- Owner-only read; writes go through the service role in the server action.
drop policy if exists ars_owner_read on public.account_review_snapshots;
create policy ars_owner_read on public.account_review_snapshots
  for select using (auth.uid() = owner_user_id);
