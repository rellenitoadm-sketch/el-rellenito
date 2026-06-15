export interface ExchangeRates {
  bs_per_usd: number;
  cop_per_usd: number;
  updated_at: string;
}

// Tasas de fallback — usadas SOLO si todas las fuentes en vivo fallan.
// Actualizadas al 2026-06-14 con el valor oficial vigente:
//   BCV oficial:  https://ve.dolarapi.com/v1/dolares/oficial → promedio (= BCV del día)
//   COP de mercado: https://open.er-api.com/v6/latest/USD     → rates.COP
const FALLBACK_RATES: ExchangeRates = {
  bs_per_usd: 587.41, // BCV oficial Bs/USD (14-jun-2026)
  cop_per_usd: 3500,  // USD/COP de mercado (aprox.)
  updated_at: new Date().toISOString(),
};

/**
 * Fuentes de la tasa BCV oficial, en orden de preferencia. Si la primera falla
 * (caída, timeout, formato raro), se intenta la siguiente → resiliencia: la tasa
 * "nunca falla" mientras al menos una fuente responda con un valor sano.
 *
 * `ve.dolarapi.com/oficial` (campo `promedio`) replica EXACTAMENTE el valor que
 * publica el BCV (verificado contra la cuenta oficial del banco). Va primero.
 * `pydolarve` queda de respaldo: a veces va un día atrasado o no resuelve por DNS.
 */
const BCV_SOURCES: { name: string; url: string; pick: (data: unknown) => unknown }[] = [
  {
    name: 'dolarapi',
    url: 'https://ve.dolarapi.com/v1/dolares/oficial',
    pick: (d) => (d as { promedio?: number })?.promedio,
  },
  {
    name: 'pydolarve',
    url: 'https://pydolarve.org/api/v1/dollar?page=bcv',
    pick: (d) => (d as { monitors?: { usd?: { price?: number } } })?.monitors?.usd?.price,
  },
];

/**
 * Fuentes de la tasa USD→COP de mercado, en orden de preferencia. Es SOLO
 * informativa (se muestra en el panel admin junto al BCV); no afecta los precios
 * de los productos, que se fijan en COP de forma independiente.
 */
const COP_SOURCES: { name: string; url: string; pick: (data: unknown) => unknown }[] = [
  {
    name: 'open.er-api',
    url: 'https://open.er-api.com/v6/latest/USD',
    pick: (d) => (d as { rates?: { COP?: number } })?.rates?.COP,
  },
  {
    name: 'currency-api',
    url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    pick: (d) => (d as { usd?: { cop?: number } })?.usd?.cop,
  },
];

/** Recorre una lista de fuentes y devuelve el primer número que pase `valid`. */
async function fetchFromSources(
  label: string,
  sources: { name: string; url: string; pick: (data: unknown) => unknown }[],
  valid: (n: number) => boolean,
): Promise<number | null> {
  for (const src of sources) {
    try {
      const res = await fetch(src.url, { next: { revalidate: 3600 } });
      if (!res.ok) {
        console.warn(`[${label}] ${src.name} HTTP ${res.status} — probando siguiente fuente`);
        continue;
      }
      const n = Number(src.pick(await res.json()));
      if (Number.isFinite(n) && valid(n)) return n;
      console.warn(`[${label}] ${src.name} devolvió un valor sospechoso (${n}) — probando siguiente`);
    } catch (err) {
      console.warn(`[${label}] ${src.name} error:`, err);
    }
  }
  console.warn(`[${label}] Ninguna fuente respondió — se conserva la última tasa conocida`);
  return null;
}

/**
 * Consulta la tasa BCV en vivo. Devuelve Bs/USD de la primera fuente sana, o
 * `null` si todas fallan (el llamador conserva la última tasa conocida).
 */
export async function fetchBcvRate(): Promise<number | null> {
  // Sanity: la tasa BCV no puede ser menor a 100 Bs/USD hoy.
  return fetchFromSources('BCV', BCV_SOURCES, (bs) => bs >= 100);
}

/**
 * Consulta la tasa USD→COP de mercado en vivo. Devuelve COP/USD o `null`.
 */
export async function fetchCopRate(): Promise<number | null> {
  // Sanity: el dólar en Colombia se mueve en miles de pesos (rango amplio por seguridad).
  return fetchFromSources('COP', COP_SOURCES, (cop) => cop >= 1000 && cop <= 20000);
}

export async function getExchangeRates(): Promise<ExchangeRates> {
  const [bs_live, cop_live] = await Promise.all([fetchBcvRate(), fetchCopRate()]);
  if (bs_live == null) {
    console.warn('[BCV] Usando tasa de fallback:', FALLBACK_RATES.bs_per_usd, 'Bs/USD.');
  }
  if (cop_live == null) {
    console.warn('[COP] Usando tasa de fallback:', FALLBACK_RATES.cop_per_usd, 'COP/USD.');
  }
  return {
    bs_per_usd: bs_live ?? FALLBACK_RATES.bs_per_usd,
    cop_per_usd: cop_live ?? FALLBACK_RATES.cop_per_usd,
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
 */
export function cartTotals<T extends MirrorPrices & { id: string; quantity: number }>(
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
    totalUsd += unitUsd(i, i.quantity) * i.quantity;
    totalCop += unitCop(i, i.quantity, rates) * i.quantity;
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
