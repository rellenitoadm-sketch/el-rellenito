import https from 'node:https';
import type { ExchangeRates } from './rates';

// Tasas de fallback — usadas SOLO si todas las fuentes en vivo fallan Y no hay
// tasa guardada en la BD. Actualizadas al 2026-07-07 (valor publicado por el BCV).
const FALLBACK_RATES: Omit<ExchangeRates, 'updated_at'> = {
  bs_per_usd: 685.94, // BCV oficial Bs/USD (publicado 07-jul-2026)
  cop_per_usd: 3500,  // USD/COP de mercado (aprox.)
};

const FETCH_TIMEOUT_MS = 8000;

/**
 * Descarga la portada de bcv.org.ve y extrae la tasa USD oficial.
 *
 * Es la fuente PRIMARIA por requisito del cliente: la app debe reflejar el valor
 * casi al mismo tiempo que lo publica la página del BCV, sin esperar a que los
 * APIs de terceros (dolarapi, pydolarve) lo repliquen. Igual que la página,
 * devuelve el último valor PUBLICADO — cuya "fecha valor" puede ser el día hábil
 * siguiente (el BCV publica en la tarde la tasa que rige mañana).
 *
 * El certificado TLS de bcv.org.ve tiene la cadena incompleta y no pasa la
 * validación estándar de Node (UNABLE_TO_VERIFY_LEAF_SIGNATURE), por eso se usa
 * `rejectUnauthorized: false` SOLO para este host. El riesgo se acota con el
 * límite de sanidad del valor y con las fuentes de respaldo detrás.
 */
function fetchBcvHtml(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      'https://www.bcv.org.ve/',
      { rejectUnauthorized: false, timeout: FETCH_TIMEOUT_MS },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let html = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { html += c; });
        res.on('end', () => resolve(html));
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

/** Extrae el USD del HTML del BCV: <div id="dolar">… <strong>685,94270000</strong>. */
export function parseBcvUsd(html: string): number | null {
  const m = /id="dolar"[\s\S]{0,600}?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/.exec(html);
  if (!m) return null;
  // Formato venezolano: puntos de miles, coma decimal.
  const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function fetchBcvDirect(): Promise<number | null> {
  return parseBcvUsd(await fetchBcvHtml());
}

/** GET JSON con timeout y sin caché (una tasa cacheada una hora ya está vieja). */
async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Fuentes de la tasa BCV oficial, en orden de preferencia. Si una falla (caída,
 * timeout, formato raro), se intenta la siguiente → la tasa "nunca falla"
 * mientras al menos una responda con un valor sano.
 *
 * 1. bcv.org.ve directo — la fuente de verdad, sin retardo de intermediarios.
 * 2. dolarapi — replica el valor del BCV con algo de retraso.
 * 3. pydolarve — respaldo final; a veces va un día atrasado o no resuelve DNS.
 */
const BCV_SOURCES: { name: string; get: () => Promise<number | null> }[] = [
  { name: 'bcv.org.ve', get: fetchBcvDirect },
  {
    name: 'dolarapi',
    get: async () => Number((await fetchJson('https://ve.dolarapi.com/v1/dolares/oficial') as { promedio?: number })?.promedio),
  },
  {
    name: 'pydolarve',
    get: async () => Number((await fetchJson('https://pydolarve.org/api/v1/dollar?page=bcv') as { monitors?: { usd?: { price?: number } } })?.monitors?.usd?.price),
  },
];

/**
 * Fuentes de la tasa USD→COP, en orden de preferencia. La PRIMARIA es la TRM
 * oficial de Colombia (la Superintendencia Financiera la certifica día a día,
 * es el equivalente colombiano al valor que publica el BCV para el bolívar).
 * Las de mercado quedan como respaldo si el portal de datos abiertos no responde.
 *
 * 1. datos.gov.co (Superfinanciera) — TRM oficial, la fuente de verdad. El
 *    dataset `32sa-8pi3` expone `valor` (COP/USD) con su `vigenciadesde`; se
 *    pide la fila más reciente. La TRM del día hábil siguiente se certifica en
 *    la tarde y se mantiene fines de semana y feriados (igual que el BCV).
 * 2. open.er-api — tasa de mercado (algo distinta a la TRM), solo si falla el
 *    portal oficial.
 * 3. currency-api (jsDelivr) — respaldo final de mercado.
 */
const COP_SOURCES: { name: string; get: () => Promise<number | null> }[] = [
  {
    name: 'datos.gov.co (TRM oficial)',
    get: async () => {
      const rows = await fetchJson(
        'https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC',
      ) as { valor?: string | number }[];
      return Number(rows?.[0]?.valor);
    },
  },
  {
    name: 'open.er-api',
    get: async () => Number((await fetchJson('https://open.er-api.com/v6/latest/USD') as { rates?: { COP?: number } })?.rates?.COP),
  },
  {
    name: 'currency-api',
    get: async () => Number((await fetchJson('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json') as { usd?: { cop?: number } })?.usd?.cop),
  },
];

/** Recorre una lista de fuentes y devuelve el primer número que pase `valid`. */
async function fetchFromSources(
  label: string,
  sources: { name: string; get: () => Promise<number | null> }[],
  valid: (n: number) => boolean,
): Promise<number | null> {
  for (const src of sources) {
    try {
      const n = await src.get();
      if (n != null && Number.isFinite(n) && valid(n)) return n;
      console.warn(`[${label}] ${src.name} devolvió un valor sospechoso (${n}) — probando siguiente`);
    } catch (err) {
      console.warn(`[${label}] ${src.name} error:`, err instanceof Error ? err.message : err);
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

/** Consulta la TRM oficial (USD→COP) en vivo. Devuelve COP/USD o `null`. */
export async function fetchCopRate(): Promise<number | null> {
  // Sanity: el dólar en Colombia se mueve en miles de pesos (rango amplio por seguridad).
  return fetchFromSources('COP', COP_SOURCES, (cop) => cop >= 1000 && cop <= 20000);
}

export interface RefreshResult {
  rates: ExchangeRates;
  /**
   * true si AL MENOS una fuente en vivo respondió → el llamador debe persistir.
   * false = todo falló: `rates` es la tasa guardada (o el fallback) con su
   * `updated_at` ORIGINAL, para que el próximo request reintente en vivo en vez
   * de dar por fresca una tasa que no lo es.
   */
  live: boolean;
}

/**
 * Refresca BCV + COP en vivo, completando con la tasa guardada (`stored`) lo que
 * no responda. Nunca lanza: en el peor caso devuelve `stored` o el fallback.
 */
export async function refreshRates(stored: ExchangeRates | null): Promise<RefreshResult> {
  const [bs, cop] = await Promise.all([fetchBcvRate(), fetchCopRate()]);
  if (bs == null && cop == null) {
    return {
      rates: stored ?? { ...FALLBACK_RATES, updated_at: new Date().toISOString() },
      live: false,
    };
  }
  return {
    rates: {
      bs_per_usd: bs ?? stored?.bs_per_usd ?? FALLBACK_RATES.bs_per_usd,
      cop_per_usd: cop ?? stored?.cop_per_usd ?? FALLBACK_RATES.cop_per_usd,
      updated_at: new Date().toISOString(),
    },
    live: true,
  };
}
