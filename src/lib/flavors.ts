/**
 * Sabores configurables por producto. Cada sabor pertenece a un producto vía
 * `product_flavors` y lleva su PROPIO precio (un "Tequeño Normal" tiene Queso a
 * 16.000 y Tocineta a 19.000). El cliente elige cantidades por sabor en el modal.
 */
export interface Flavor {
  id: string;
  name: string;
}

/** Sabor tal como se ofrece en un producto concreto (disponibilidad + orden). */
export interface ProductFlavor extends Flavor {
  available: boolean;
  sort_order: number;
}

/**
 * Sabor con su precio propio. Cada campo de precio es opcional: `null` significa
 * "usar el precio del producto base". Los precios viven en `product_flavors`
 * (el mismo nombre de sabor cuesta distinto en productos distintos).
 */
export interface PricedFlavor extends Flavor {
  price_usd: number | null;
  price_cop: number | null;
  wholesale_price_usd: number | null;
  wholesale_price_cop: number | null;
}
