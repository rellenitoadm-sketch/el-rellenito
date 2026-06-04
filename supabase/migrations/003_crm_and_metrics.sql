-- ============================================================
-- El Rellenito — CRM (customers) + page-visit metrics
-- Run this in Supabase SQL Editor (after 002).
-- ============================================================

-- ── CRM: one row per customer, keyed by WhatsApp number ──────
create table if not exists public.customers (
  whatsapp text primary key,
  name text,
  first_order_at timestamptz not null default now(),
  last_order_at timestamptz not null default now(),
  order_count integer not null default 0,
  total_spent_usd numeric not null default 0,
  last_zone text,
  notes text
);

alter table public.customers enable row level security;
-- No anon access — CRM is read/written server-side via service_role only.

-- Upsert helper: call on every confirmed order to maintain the CRM.
create or replace function public.upsert_customer(
  p_whatsapp text,
  p_name text,
  p_total_usd numeric,
  p_zone text
) returns void as $$
begin
  insert into public.customers (whatsapp, name, order_count, total_spent_usd, last_zone, last_order_at)
  values (p_whatsapp, p_name, 1, coalesce(p_total_usd, 0), p_zone, now())
  on conflict (whatsapp) do update set
    name = coalesce(excluded.name, public.customers.name),
    order_count = public.customers.order_count + 1,
    total_spent_usd = public.customers.total_spent_usd + coalesce(p_total_usd, 0),
    last_zone = coalesce(p_zone, public.customers.last_zone),
    last_order_at = now();
end;
$$ language plpgsql;

-- ── Metrics: lightweight page-visit log ──────────────────────
create table if not exists public.page_visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path text,
  referrer text,
  -- coarse day/hour for fast aggregation (peak-hours chart)
  visit_date date not null default (now() at time zone 'America/Caracas')::date,
  visit_hour smallint not null default extract(hour from (now() at time zone 'America/Caracas'))
);

create index if not exists page_visits_date_idx on public.page_visits (visit_date);
create index if not exists page_visits_hour_idx on public.page_visits (visit_hour);

alter table public.page_visits enable row level security;

-- Anyone can log a visit (insert only); reads happen server-side via service_role.
drop policy if exists "Public can log visits" on public.page_visits;
create policy "Public can log visits"
  on public.page_visits for insert
  to anon
  with check (true);
