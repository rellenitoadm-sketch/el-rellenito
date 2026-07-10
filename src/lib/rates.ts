import { type FritoChoice, fritoUnitUsd, fritoUnitCop } from './fritos';

export interface ExchangeRates {
  bs_per_usd: number;
  cop_per_usd: number;
  updated_at: string;
}

// La consulta de tasas en vivo (BCV directo + APIs de respaldo) vive en
// `rates.server.ts`: usa node:https y NO puede importarse desde componentes
// cliente. Este módulo queda solo con tipos y helpers puros de precios.

/**
 * COP efectivo de un precio: usa el COP explícito fijado por el cliente si existe;
 * si no, lo deriva de USD × tasa. (USD y COP son precios independientes.)
 */
export function toCop(usd: number, cop: number | null | undefined, rates: ExchangeRates): number {
  return cop != null ? cop : Math.round(usd * rates.cop_per_usd);
}

/**
 * Cantidad mínima POR DEFECTO que activa la tarifa al mayor. Cada producto puede
 * sobreescribirla con `limite_unidades_mayor`; este valor es el fallback cuando no
 * está definido. cantidad >= umbral → conmuta de los campos detal a los `wholesale_*`.
 */
export const WHOLESALE_MIN_QTY = 10;

/** Estructura espejo mínima para calcular precios efectivos por cantidad. */
export interface MirrorPrices {
  price_usd: number;
  wholesale_price_usd: number;
  price_cop?: number | null;
  wholesale_price_cop?: number | null;
  /** Umbral mayorista propio del producto; si falta, se usa WHOLESALE_MIN_QTY. */
  limite_unidades_mayor?: number | null;
}

/** Umbral mayorista efectivo de un producto (su valor propio o el default global). */
export function wholesaleThreshold(p: Pick<MirrorPrices, 'limite_unidades_mayor'>): number {
  const lim = p.limite_unidades_mayor;
  return lim != null && lim > 0 ? lim : WHOLESALE_MIN_QTY;
}

/**
 * ¿La cantidad activa la tarifa al mayor? Compara contra el umbral indicado
 * (default global `WHOLESALE_MIN_QTY` si no se pasa uno).
 */
export function isWholesaleQty(qty: number, limit: number = WHOLESALE_MIN_QTY): boolean {
  return qty >= limit;
}

/** USD efectivo por unidad según la cantidad (detal o mayor). */
export function unitUsd(p: MirrorPrices, qty: number): number {
  return isWholesaleQty(qty, wholesaleThreshold(p)) ? p.wholesale_price_usd : p.price_usd;
}

/** COP efectivo por unidad según la cantidad. COP fijado o derivado de USD × tasa. */
export function unitCop(p: MirrorPrices, qty: number, rates: ExchangeRates): number {
  return isWholesaleQty(qty, wholesaleThreshold(p))
    ? toCop(p.wholesale_price_usd, p.wholesale_price_cop, rates)
    : toCop(p.price_usd, p.price_cop, rates);
}

/** Nombre amigable de cada moneda (para mensajes al cliente). */
export const CURRENCY_NAME: Record<'USD' | 'COP' | 'BS', string> = {
  USD: 'USD',
  COP: 'pesos',
  BS: 'bolívares',
};

/**
 * ¿El producto tiene precio NATIVO en la moneda activa?
 * - USD y BS dependen del precio en USD (los bolívares se derivan del USD).
 * - COP depende del precio en COP fijado por el cliente.
 * Si no lo tiene, el producto queda BLOQUEADO en esa moneda: NO se convierte
 * desde la otra. USD y COP son mercados independientes.
 */
export function isPricedIn(
  p: { price_usd?: number | null; price_cop?: number | null },
  currency: 'USD' | 'COP' | 'BS',
): boolean {
  return currency === 'COP' ? p.price_cop != null : p.price_usd != null;
}

/**
 * Totales del carrito en la moneda activa, contando SOLO los ítems con precio
 * nativo en esa moneda. Los bloqueados se devuelven en `blockedIds` y NO suman.
 * Incluye el recargo de fritos por bandeja de las líneas que lo lleven.
 */
export function cartTotals<T extends MirrorPrices & FritoChoice & { id: string; quantity: number }>(
  items: T[],
  currency: 'USD' | 'COP' | 'BS',
  rates: ExchangeRates,
): { totalUsd: number; totalCop: number; blockedIds: string[] } {
  let totalUsd = 0;
  let totalCop = 0;
  const blockedIds: string[] = [];
  for (const i of items) {
    if (!isPricedIn(i, currency)) {
      blockedIds.push(i.id);
      continue;
    }
    totalUsd += (unitUsd(i, i.quantity) + fritoUnitUsd(i)) * i.quantity;
    totalCop += (unitCop(i, i.quantity, rates) + fritoUnitCop(i)) * i.quantity;
  }
  return { totalUsd, totalCop, blockedIds };
}

/**
 * Formatea un monto en la moneda elegida.
 * - USD: el valor en dólares.
 * - COP: el precio en COP fijado por el cliente (`cop`); si no se pasa, se deriva de USD × tasa.
 * - Bs: SIEMPRE se deriva de USD × tasa BCV (Bs solo existe como conversión del USD).
 */
export function formatPrice(
  usd: number,
  rates: ExchangeRates,
  currency: 'USD' | 'COP' | 'BS',
  cop?: number | null,
): string {
  switch (currency) {
    case 'USD':
      return `$${usd.toFixed(2)}`;
    case 'COP':
      return `$${Math.round(toCop(usd, cop, rates)).toLocaleString('es-CO')}`;
    case 'BS': {
      const bs = usd * rates.bs_per_usd;
      return `Bs. ${Math.round(bs).toLocaleString('es-VE')}`;
    }
  }
}
