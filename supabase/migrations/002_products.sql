-- ============================================================
-- El Rellenito — Products table + image storage
-- Run this in Supabase SQL Editor (after 001).
-- ============================================================

create table if not exists public.products (
  id text primary key,
  name text not null,
  units text,
  description text default '',
  category text not null,
  type text not null default 'detal',          -- detal | mayorista | ambos
  price_usd numeric not null default 0,
  wholesale_price_usd numeric not null default 0,
  available boolean not null default true,
  image_url text,
  is_best_seller boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

-- Row Level Security
alter table public.products enable row level security;

-- Anyone can READ the catalog (public storefront).
drop policy if exists "Public can read products" on public.products;
create policy "Public can read products"
  on public.products for select
  to anon
  using (true);

-- Writes (insert/update/delete) are NOT granted to anon — the admin panel uses
-- the service_role key (server-side) which bypasses RLS.

-- ============================================================
-- Storage bucket for product images (public read)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Public read of objects in that bucket
drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
  on storage.objects for select
  to anon
  using (bucket_id = 'product-images');

-- Uploads happen server-side with the service_role key, so no anon insert policy.
