-- Precio propio por sabor (#7 rediseño). Cada relleno de un producto puede tener
-- su propio precio: un "Tequeño Normal" tiene Queso a 16.000 y Tocineta a 19.000.
-- NULL en cualquier campo = usar el precio del producto base.
alter table public.product_flavors
  add column if not exists price_usd numeric,
  add column if not exists price_cop numeric,
  add column if not exists wholesale_price_usd numeric,
  add column if not exists wholesale_price_cop numeric;
