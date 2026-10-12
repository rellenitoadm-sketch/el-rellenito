-- ============================================================
-- El Rellenito — Inventario de producto terminado (por día)
-- Run this in Supabase SQL Editor. Safe to re-run.
--
-- La existencia es DIARIA: arranca en cero, se carga con la producción de la
-- mañana y se descuenta con cada pedido (web y mayorista). Llegar a cero NO
-- bloquea la venta: solo avisa al equipo. El interruptor Disponible/Agotado de
-- `products` sigue siendo manual y no se toca desde aquí.
--
-- Una sola tabla de movimientos es la fuente de verdad; el disponible del día
-- es la suma de `qty`. Son decenas de productos y decenas de movimientos al
-- día, así que no hace falta tabla cacheada ni trigger.
-- ============================================================

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),

  -- Día (hora de Caracas) al que afecta el movimiento. Un encargo para el
  -- jueves descuenta del jueves, no de hoy.
  day date not null,

  -- Sin FK y con copia del nombre: los productos se renombran y se borran, y el
  -- historial tiene que seguir legible.
  product_id text not null,
  product_name text,
  flavor_id uuid,
  flavor_name text,

  -- Positivo entra (producción, devolución); negativo sale (venta, merma).
  qty integer not null,

  kind text not null
    check (kind in ('produccion', 'venta', 'venta_mayorista', 'merma', 'ajuste', 'devolucion')),

  -- De qué pedido vino el movimiento, cuando vino de uno.
  order_id uuid,
  wholesale_order_id uuid,

  note text,
  actor text,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_day_idx on public.stock_movements (day);
create index if not exists stock_movements_day_product_idx on public.stock_movements (day, product_id);
create index if not exists stock_movements_order_idx on public.stock_movements (order_id);
create index if not exists stock_movements_wholesale_idx on public.stock_movements (wholesale_order_id);

-- Candado de idempotencia: un pedido descuenta UNA vez por línea, aunque el
-- cliente reenvíe, el servidor reintente o alguien reprocese. Lo mismo para la
-- devolución al cancelar. Los movimientos manuales (producción, merma, ajuste)
-- quedan fuera: ahí sí se puede registrar varias veces el mismo producto.
create unique index if not exists stock_movements_pedido_unico
  on public.stock_movements (
    kind,
    coalesce(order_id, wholesale_order_id),
    product_id,
    coalesce(flavor_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where kind in ('venta', 'venta_mayorista', 'devolucion');

-- Avisos ya mandados, para no repetir el mismo "se acabó" cada vez que entra un
-- pedido del producto agotado.
create table if not exists public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  product_id text not null,
  flavor_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists stock_alerts_unico
  on public.stock_alerts (
    day,
    product_id,
    coalesce(flavor_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Umbral de aviso por producto. 0 = avisar solo al llegar a cero.
alter table public.products
  add column if not exists low_stock_threshold integer not null default 0;

-- RLS activo y sin políticas: nadie entra con la clave pública; todo pasa por
-- el servidor con la service role, igual que en las tablas de pedidos.
alter table public.stock_movements enable row level security;
alter table public.stock_alerts enable row level security;
