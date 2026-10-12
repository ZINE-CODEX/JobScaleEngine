-- JobScale database schema
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- ---------------------------------------------------------------
-- 1. Licensed sponsors (filled daily by sync-sponsors.js)
-- ---------------------------------------------------------------
create table if not exists public.sponsors (
  company_name    text primary key,          -- name exactly as on the Home Office register
  normalized_name text not null,             -- lowercase, no "Ltd"/"Limited", used for matching
  routes          text[] not null default '{}', -- e.g. {'Skilled Worker'}
  last_seen       timestamptz not null default now()
);
create index if not exists sponsors_normalized_name_idx on public.sponsors (normalized_name);

-- ---------------------------------------------------------------
-- 2. Verified jobs (filled by sync-jobs.js)
-- ---------------------------------------------------------------
create table if not exists public.jobs (
  id                      uuid primary key default gen_random_uuid(),
  job_title               text not null,
  company_name            text not null,
  location                text,
  raw_description         text,
  application_link        text not null unique,   -- used as the upsert key (prevents duplicates)
  source                  text default 'adzuna',
  sector                  text,
  job_type                text default 'Full-Time',
  extracted_salary        numeric default 0,
  salary_is_estimated     boolean default false,
  meets_salary_threshold  boolean default false,  -- general Skilled Worker salary threshold
  is_new_entrant_eligible boolean default false,  -- lower "new entrant" threshold (recent graduates)
  visa_category           text,
  status                  text not null default 'active',
  date_verified           timestamptz not null default now(),
  created_at              timestamptz not null default now()
);
create index if not exists jobs_status_verified_idx on public.jobs (status, date_verified desc);
create index if not exists jobs_sector_idx on public.jobs (sector);

-- ---------------------------------------------------------------
-- 3. Email alert subscribers (written by the footer form)
-- ---------------------------------------------------------------
create table if not exists public.user_alerts (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  status      text not null default 'active',
  alert_name  text not null default 'Daily Newsletter',
  created_at  timestamptz not null default now(),
  unique (email, alert_name)
);

-- ---------------------------------------------------------------
-- 4. Cleanup function (called by sync-jobs.js): expire jobs not re-verified in 14 days
-- ---------------------------------------------------------------
create or replace function public.expire_old_jobs()
returns void
language sql
as $$
  update public.jobs
  set status = 'expired'
  where status = 'active'
    and date_verified < now() - interval '14 days';
$$;

-- ---------------------------------------------------------------
-- 5. Row Level Security
-- The website uses the public anon key, so lock everything down and
-- open only what the site needs. Sync scripts use the service-role key,
-- which bypasses RLS.
-- ---------------------------------------------------------------
alter table public.sponsors    enable row level security;
alter table public.jobs        enable row level security;
alter table public.user_alerts enable row level security;

drop policy if exists "Anyone can read active jobs" on public.jobs;
create policy "Anyone can read active jobs"
  on public.jobs for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists "Anyone can subscribe" on public.user_alerts;
create policy "Anyone can subscribe"
  on public.user_alerts for insert
  to anon, authenticated
  with check (true);

grant select on public.jobs        to anon, authenticated;
grant insert on public.user_alerts to anon, authenticated;
