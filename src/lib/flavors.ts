/**
 * Sabores configurables por producto (#7). Un sabor es global (tabla `flavors`)
 * y se asigna a productos vía `product_flavors`. El cliente elige cantidades por
 * sabor en el modal del producto.
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
