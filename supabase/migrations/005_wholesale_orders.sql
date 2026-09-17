-- ============================================================
-- El Rellenito — Pedidos mayoristas por teléfono + cobros
-- Run this in Supabase SQL Editor. Safe to re-run.
--
-- Los domiciliarios registran pedidos que los mayoristas hacen por llamada,
-- escogen cuáles llevan, los entregan y al final del día marcan quién pagó.
-- Va aparte de `orders`: ahí `status` significa verificación de pago web y el
-- alta dispara push, webhook y CRM.
-- ============================================================

create table if not exists public.wholesale_orders (
  id uuid primary key default gen_random_uuid(),

  -- Se guarda copia del mayorista: si el admin lo edita o lo borra, el pedido
  -- y su deuda siguen legibles.
  client_id uuid references public.wholesale_clients(id) on delete set null,
  client_name text not null,
  client_phone text,
  client_address text,
  client_route text,

  delivery_date date not null,
  -- [{ product_id, flavor_id?, name, qty, unit_usd, unit_cop }]
  items jsonb not null default '[]'::jsonb,
  total_usd numeric not null,
  total_cop numeric not null,

  -- "En ruta" no es un estado: lo es tener driver_name.
  status text not null default 'registrado'
    check (status in ('registrado', 'entregado', 'cancelado')),

  -- Sin FK: el admin puede borrar domiciliarios y el nombre es lo que se muestra.
  driver_id uuid,
  driver_name text,
  assigned_at timestamptz,
  delivered_at timestamptz,

  -- Fracción del pedido ya cobrada (0..1). Se recalcula tras cada pago para que
  -- la lista de saldos pendientes no tenga que sumar todos los pagos.
  paid_share numeric(12, 8) not null default 0,

  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wholesale_orders_delivery_date_idx on public.wholesale_orders (delivery_date);
create index if not exists wholesale_orders_status_paid_share_idx on public.wholesale_orders (status, paid_share);
create index if not exists wholesale_orders_client_id_idx on public.wholesale_orders (client_id);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists wholesale_orders_touch_updated_at on public.wholesale_orders;
create trigger wholesale_orders_touch_updated_at
  before update on public.wholesale_orders
  for each row execute function public.touch_updated_at();

alter table public.wholesale_orders enable row level security;

-- Una fila por cada marca del cierre del día (pagó todo / abonó / no pagó).
create table if not exists public.wholesale_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.wholesale_orders(id) on delete cascade,
  collected_on date not null,
  outcome text not null check (outcome in ('pagado', 'abono', 'no_pago')),
  currency text check (currency in ('COP', 'VES', 'USD')),
  amount numeric not null default 0,
  -- Bs por USD usados al registrar un pago en bolívares.
  rate_ves numeric,
  -- Fracción del pedido que cubre este pago. COP se mide contra total_cop y
  -- USD/VES contra total_usd: son listas de precio distintas, no conversiones.
  share numeric(12, 8) not null default 0,
  driver_id uuid,
  driver_name text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists wholesale_payments_order_id_idx on public.wholesale_payments (order_id);
create index if not exists wholesale_payments_collected_on_idx on public.wholesale_payments (collected_on);

alter table public.wholesale_payments enable row level security;

-- Sin políticas: solo el service role (rutas /api/admin/*) lee y escribe.
