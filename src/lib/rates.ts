export interface ExchangeRates {
  bs_per_usd: number;
  cop_per_usd: number;
  updated_at: string;
}

// Tasas de fallback — actualizadas al 2026-05-29
// BCV: https://pydolarve.org/api/v1/dollar?page=bcv → monitors.usd.price
const FALLBACK_RATES: ExchangeRates = {
  bs_per_usd: 535.28, // Tasa BCV real (Bs/USD)
  cop_per_usd: 4200,  // Tasa COP/USD aproximada
  updated_at: new Date().toISOString(),
};

/**
 * Fuentes de la tasa BCV oficial, en orden de preferencia. Si la primera falla
 * (caída, timeout, formato raro), se intenta la siguiente → resiliencia: la tasa
 * "nunca falla" mientras al menos una fuente responda con un valor sano.
 */
const BCV_SOURCES: { name: string; url: string; pick: (data: unknown) => unknown }[] = [
  {
    name: 'pydolarve',
    url: 'https://pydolarve.org/api/v1/dollar?page=bcv',
    pick: (d) => (d as { monitors?: { usd?: { price?: number } } })?.monitors?.usd?.price,
  },
  {
    name: 'dolarapi',
    url: 'https://ve.dolarapi.com/v1/dolares/oficial',
    pick: (d) => (d as { promedio?: number })?.promedio,
  },
];

/**
 * Consulta la tasa BCV en vivo, probando varias fuentes en orden.
 * Devuelve el número Bs/USD de la primera fuente sana, o `null` si todas fallan.
 * NO aplica fallback interno — el llamador decide (servir la última tasa conocida
 * en vez de pisarla con un valor por defecto).
 */
export async function fetchBcvRate(): Promise<number | null> {
  for (const src of BCV_SOURCES) {
    try {
      const res = await fetch(src.url, { next: { revalidate: 3600 } });
      if (!res.ok) {
        console.warn(`[BCV] ${src.name} HTTP ${res.status} — probando siguiente fuente`);
        continue;
      }
      const bs = Number(src.pick(await res.json()));
      // Sanity check: la tasa BCV no puede ser menor a 100 Bs/USD hoy.
      if (Number.isFinite(bs) && bs >= 100) return bs;
      console.warn(`[BCV] ${src.name} devolvió un valor sospechoso (${bs}) — probando siguiente`);
    } catch (err) {
      console.warn(`[BCV] ${src.name} error:`, err);
    }
  }
  console.warn('[BCV] Ninguna fuente respondió — se conserva la última tasa conocida');
  return null;
}

export async function getExchangeRates(): Promise<ExchangeRates> {
  const bs_per_usd = await fetchBcvRate();
  if (bs_per_usd == null) {
    console.warn('[BCV] Usando tasa de fallback:', FALLBACK_RATES.bs_per_usd, 'Bs/USD.');
    return FALLBACK_RATES;
  }
  return {
    bs_per_usd,
    cop_per_usd: FALLBACK_RATES.cop_per_usd,
    updated_at: new Date().toISOString(),
  };
}

/**
 * COP efectivo de un precio: usa el COP explícito fijado por el cliente si existe;
 * si no, lo deriva de USD × tasa. (USD y COP son precios independientes.)
 */
export function toCop(usd: number, cop: number | null | undefined, rates: ExchangeRates): number {
  return cop != null ? cop : Math.round(usd * rates.cop_per_usd);
}

/**
 * Cantidad mínima del mismo producto que activa la tarifa al mayor.
 * cantidad >= WHOLESALE_MIN_QTY → conmuta de los campos detal a los `wholesale_*`.
 */
export const WHOLESALE_MIN_QTY = 10;

/** Estructura espejo mínima para calcular precios efectivos por cantidad. */
export interface MirrorPrices {
  price_usd: number;
  wholesale_price_usd: number;
  price_cop?: number | null;
  wholesale_price_cop?: number | null;
}

/** ¿La cantidad activa la tarifa al mayor? (>= 10 del mismo producto) */
export function isWholesaleQty(qty: number): boolean {
  return qty >= WHOLESALE_MIN_QTY;
}

/** USD efectivo por unidad según la cantidad (detal o mayor). */
export function unitUsd(p: MirrorPrices, qty: number): number {
  return isWholesaleQty(qty) ? p.wholesale_price_usd : p.price_usd;
}

/** COP efectivo por unidad según la cantidad. COP fijado o derivado de USD × tasa. */
export function unitCop(p: MirrorPrices, qty: number, rates: ExchangeRates): number {
  return isWholesaleQty(qty)
    ? toCop(p.wholesale_price_usd, p.wholesale_price_cop, rates)
    : toCop(p.price_usd, p.price_cop, rates);
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
