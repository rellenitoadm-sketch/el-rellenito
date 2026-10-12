-- ============================================================
-- El Rellenito — Tickets (facturas) de pedidos
-- Run this in Supabase SQL Editor. Safe to re-run.
--
-- Cada pedido (web `orders` o mayorista por teléfono `wholesale_orders`)
-- genera un ticket con copia congelada de lo vendido. El cliente lo abre con
-- /t/<code> (código aleatorio, sin login); el equipo los ve en el panel.
-- ============================================================

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  code text not null unique,
  kind text not null check (kind in ('detal', 'mayor')),

  order_id uuid references public.orders(id) on delete set null,
  wholesale_order_id uuid references public.wholesale_orders(id) on delete set null,

  customer_name text not null,
  customer_phone text,
  -- [{ name, qty, unit_usd, unit_cop }]
  items jsonb not null default '[]'::jsonb,
  total_usd numeric not null,
  total_cop numeric not null default 0,
  payment_method text,
  -- Detalles que cambian por tipo: entrega, abono/saldo, fecha, etc.
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tickets_created_at_idx on public.tickets (created_at desc);
create index if not exists tickets_order_id_idx on public.tickets (order_id);
create index if not exists tickets_wholesale_order_id_idx on public.tickets (wholesale_order_id);

-- Solo service_role (el servidor) lee y escribe. Sin políticas = anon bloqueado.
alter table public.tickets enable row level security;
