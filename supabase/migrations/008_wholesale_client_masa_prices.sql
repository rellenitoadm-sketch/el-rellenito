-- ============================================================
-- El Rellenito — Precio de masas por mayorista
-- Run this in Supabase SQL Editor. Safe to re-run.
--
-- Cada mayorista lleva las masas a un precio distinto (acordado por teléfono).
-- El domiciliario lo edita al registrar el pedido y queda guardado para la
-- próxima vez que le vendan a ese mismo mayorista.
-- ============================================================

alter table public.wholesale_clients
  add column if not exists masa_prices jsonb not null default '{}'::jsonb;

comment on column public.wholesale_clients.masa_prices is
  'Precio de masas acordado con este mayorista: { "<product_id>": { "usd": number|null, "cop": number|null } }. Solo aplica a productos categoría MASAS.';
