create extension if not exists pgcrypto;

create table if not exists public.reven_events (
  id text primary key,
  source text not null check (source in ('razorpay_test', 'razorpay_live_import')),
  source_event_id text unique,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pipeline_results (
  id text primary key,
  run_id text not null,
  event_id text not null references public.reven_events(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists pipeline_results_event_created_idx
  on public.pipeline_results(event_id, created_at desc);

create table if not exists public.scorecard_runs (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reven_settings (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  razorpay_event_id text primary key,
  event_type text not null,
  payload_hash text not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.recovery_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id text references public.reven_events(id) on delete set null,
  external_reference text,
  action text not null,
  status text not null check (status in ('prepared', 'completed', 'failed', 'refused')),
  amount_recovered numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.reven_events enable row level security;
alter table public.pipeline_results enable row level security;
alter table public.scorecard_runs enable row level security;
alter table public.reven_settings enable row level security;
alter table public.webhook_events enable row level security;
alter table public.recovery_attempts enable row level security;

-- No anon/authenticated policies are created. Only the backend service-role key
-- can access these tables. Never expose that key to the Vercel frontend.
