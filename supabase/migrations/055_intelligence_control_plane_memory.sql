-- Durable, append-only canonical memory for Admin Intelligence capability and
-- launch-readiness evaluations. Global internal telemetry: service-role only.

create table if not exists public.intelligence_control_plane_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  trigger_type text not null,
  trigger_ref text,
  control_plane_version text not null,
  launch_readiness_version text not null,
  capability_score integer check (capability_score between 0 and 100),
  launch_readiness_score integer not null check (launch_readiness_score between 0 and 100),
  launch_readiness_level text not null check (launch_readiness_level in ('not_ready','internal_pilot','guided_beta','limited_launch','launch_ready')),
  confidence text not null check (confidence in ('low','medium','high')),
  source_data_cutoff timestamptz,
  capability_state_counts jsonb not null,
  blocker_count integer not null default 0 check (blocker_count >= 0),
  snapshot jsonb not null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists intelligence_control_plane_observed_idx
  on public.intelligence_control_plane_snapshots (observed_at desc);

alter table public.intelligence_control_plane_snapshots enable row level security;

-- Deliberately no anon/authenticated policies. Admin APIs use the service role;
-- customer sessions cannot read maturity history or internal blockers.
