-- Run this in your Supabase SQL editor

create table batch_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending', -- pending | processing | completed | error
  payment_status text default 'unpaid',   -- unpaid | paid
  onboarding jsonb not null,
  customer_email text not null,
  stripe_session_id text,
  icp jsonb,
  raw_leads jsonb default '[]',
  processed_leads jsonb default '[]',
  report_summary jsonb,
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Index for status polling
create index batch_jobs_status_idx on batch_jobs(status);
create index batch_jobs_email_idx on batch_jobs(customer_email);

-- RLS: disable for now (server-only access via service role)
alter table batch_jobs disable row level security;
