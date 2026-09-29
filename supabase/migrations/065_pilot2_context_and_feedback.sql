-- 065 — Pilot 2 durable Customer Context + Pilot feedback (forward-only; founder-applied).
-- Admin/pilot-scoped data written only by the server (service role). RLS is enabled with NO anon/
-- authenticated policies → deny by default; the service role bypasses RLS for server-side reads/writes.
-- Rollback note: drop table pilot_feedback; drop table pilot_customer_context;  (both are additive, no
-- dependency from existing tables). Idempotent via IF NOT EXISTS so re-apply is safe.

-- ── Durable Customer Context (guided or AI-assisted; versioned; provenance-aware) ──
create table if not exists public.pilot_customer_context (
  id                 uuid primary key default gen_random_uuid(),
  pilot_id           text        not null,                    -- e.g. "amor-de-gea"
  pilot_number       integer     not null default 2,
  customer_ref       text,                                    -- optional customer/tenant reference
  schema_version     integer     not null default 1,
  context            jsonb       not null,                    -- full CustomerContextIntake (the truth)
  bounded_summary    text,                                    -- deterministic ≤600-char interpretation input
  source             text        not null default 'guided',   -- 'guided' | 'ai_assisted'
  confirmation_state text        not null default 'draft',    -- 'draft' | 'confirmed'
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists pilot_customer_context_pilot_idx on public.pilot_customer_context (pilot_id, pilot_number, updated_at desc);
alter table public.pilot_customer_context enable row level security;

-- ── Durable Pilot feedback (per-tier, per-account, per-route; learning classification) ──
create table if not exists public.pilot_feedback (
  id                     uuid primary key default gen_random_uuid(),
  pilot_id               text        not null,
  pilot_number           integer     not null default 2,
  overall_rating         integer,                             -- 1..5
  per_tier               jsonb,                               -- {preview,brief,portfolio,premium} ratings + incremental value
  route_feedback         jsonb,                               -- [{route, verdict, note}]
  account_feedback       jsonb,                               -- [{account, verdict, correction}]
  buyer_feedback         text,
  timing_feedback        text,
  dependency_usefulness  integer,
  missing_information    text,
  willingness_to_pay     text,
  free_text              text,
  learning_class         text,                                -- PRODUCT_VALIDATED | CANONICAL_IMPROVEMENT | CUSTOMER_SPECIFIC | RESEARCH_ERROR | CUSTOMER_CORRECTION | OUT_OF_SCOPE | NEEDS_MORE_EVIDENCE
  status                 text        not null default 'draft', -- 'draft' | 'received' | 'reviewed' | 'incorporated'
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists pilot_feedback_pilot_idx on public.pilot_feedback (pilot_id, pilot_number, updated_at desc);
alter table public.pilot_feedback enable row level security;

-- No anon/authenticated policies → default-deny. Server writes use the service role (bypasses RLS).
