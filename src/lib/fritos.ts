/**
 * Servicio de fritos (venta individual): el cliente puede pedir su producto
 * frito y se cobra un recargo POR BANDEJA (por unidad). Solo aplica a productos
 * marcados con `cobra_frito` (por defecto Tequeños y Pasapalos). Los combos de
 * evento están exentos: su precio ya incluye el frito a $0.
 *
 * El recargo es COP-nativo (lo fijó el cliente en 2.000 COP). El USD es una
 * aproximación para clientes que pagan en dólares/bolívares; ajústalo aquí si
 * hace falta.
 */
export const FRITO_SURCHARGE = { usd: 0.8, cop: 2000 } as const;

/** Campos mínimos para saber si una línea lleva recargo de fritos. */
export interface FritoChoice {
  /** El producto admite servicio de fritos. */
  cobra_frito?: boolean | null;
  /** El cliente eligió fritos para esta línea. */
  fritos?: boolean | null;
}

/** ¿Esta línea lleva recargo de fritos? (admite fritos Y el cliente lo eligió). */
export function hasFrito(i: FritoChoice): boolean {
  return !!i.cobra_frito && !!i.fritos;
}

/** Recargo de fritos por unidad en USD (0 si no aplica). */
export function fritoUnitUsd(i: FritoChoice): number {
  return hasFrito(i) ? FRITO_SURCHARGE.usd : 0;
}

/** Recargo de fritos por unidad en COP (0 si no aplica). */
export function fritoUnitCop(i: FritoChoice): number {
  return hasFrito(i) ? FRITO_SURCHARGE.cop : 0;
}
