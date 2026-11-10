-- ============================================================
-- El Rellenito — Métodos de pago editables desde el panel
-- Run this in Supabase SQL Editor. Safe to re-run.
--
-- Antes vivían fijos en código (lib/payments.ts). El admin ahora los edita
-- desde Ventas → Pagos (número de Pago Móvil, cuentas, etc.) sin tocar código.
-- Se sembra con los datos que ya estaban en código, con Pago Móvil YA
-- actualizado al dato nuevo (2026-11-09): Provincial, cédula 29.649.099,
-- 0412-339-3602.
-- ============================================================

create table if not exists public.payment_methods (
  id text primary key,
  label text not null,
  icon text not null default 'Wallet',
  -- { "Banco": "...", "Teléfono": "...", ... } — se muestra tal cual, en orden.
  details jsonb not null default '{}'::jsonb,
  note text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists payment_methods_touch_updated_at on public.payment_methods;
create trigger payment_methods_touch_updated_at
  before update on public.payment_methods
  for each row execute function public.touch_updated_at();

alter table public.payment_methods enable row level security;

insert into public.payment_methods (id, label, icon, details, note, sort_order) values
  ('pago_movil', 'Pago Móvil', 'Smartphone',
    '{"Banco": "Banco Provincial (0108)", "Teléfono": "0412-339-3602", "C.I.": "V-29.649.099", "Titular": "Nahomy Parada"}', null, 0),
  ('zelle', 'Zelle', 'DollarSign',
    '{"Email": "8012274203", "Titular": "Sandra Zambrano-Sanchez", "Banco": "Regions Bank"}', null, 1),
  ('binance', 'Binance / USDT', 'Coins',
    '{"Usuario": "panchoelmillonario", "ID": "1061511313", "Correo": "kiliansc@gmail.com"}',
    'Enviar captura del comprobante por WhatsApp', 2),
  ('transferencia_ve', 'Transferencia VE', 'Building2',
    '{"Banco": "Banco Provincial", "Cuenta": "0108-0070-65-0100478228", "Tipo": "Corriente", "C.I.": "29.649.099", "Titular": "Nahomy Parada"}', null, 3),
  ('bancolombia', 'Bancolombia', 'CreditCard',
    '{"Cuenta": "82400014851", "Tipo": "Ahorros", "Documento": "176.277.226", "Titular": "Kilian Vega"}', null, 4),
  ('efectivo', 'Efectivo', 'Banknote', '{}',
    'Paga directamente al domiciliario en la entrega', 5)
on conflict (id) do nothing;

-- Sin políticas: lectura pública la hace la ruta /api/payment-methods con
-- service_role (igual que /api/products); solo el service role escribe.
