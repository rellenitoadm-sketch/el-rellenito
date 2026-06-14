import { NextResponse } from 'next/server';
import { fetchBcvRate, getExchangeRates, type ExchangeRates } from '@/lib/rates';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// Dynamic: se evalúa la frescura de la tasa en cada request.
export const dynamic = 'force-dynamic';

const FALLBACK_COP_PER_USD = 4200;

/** Fecha (YYYY-MM-DD) de un instante en la zona horaria de Caracas. */
function caracasDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/**
 * Tasa de cambio para el sitio (vinculada globalmente vía CurrencyProvider →
 * toda conversión a Bs del catálogo, carrito y checkout).
 *
 * Estrategia auto-sanadora para que NUNCA falle y se actualice sola al valor de hoy:
 *   1. Lee la tasa guardada en `app_rates` (id=1).
 *   2. Si es de HOY (zona Caracas) → la sirve tal cual (estable durante el día, sin red).
 *   3. Si está vieja o no existe → consulta el BCV en vivo y la persiste.
 *   4. Si la consulta en vivo falla → sirve la última tasa conocida (aunque esté vieja),
 *      y solo si no hay ninguna, cae al fallback interno. El cliente nunca ve un error.
 *
 * El cron `/api/cron/refresh-rate` (L-V tras la publicación del BCV) sigue como
 * pre-calentamiento; este endpoint ya no depende de él para mantenerse al día.
 */
export async function GET() {
  const db = supabaseAdmin ?? supabase;

  // 1. Tasa guardada
  let stored: ExchangeRates | null = null;
  try {
    if (db) {
      const { data } = await db
        .from('app_rates')
        .select('bs_per_usd, cop_per_usd, updated_at')
        .eq('id', 1)
        .maybeSingle();
      if (data) {
        stored = {
          bs_per_usd: Number(data.bs_per_usd),
          cop_per_usd: Number(data.cop_per_usd),
          updated_at: data.updated_at,
        };
      }
    }
  } catch {
    /* sin DB → se intenta en vivo abajo */
  }

  // 2. ¿Es de hoy? → servir tal cual
  if (stored && caracasDay(new Date(stored.updated_at)) === caracasDay(new Date())) {
    return NextResponse.json(stored);
  }

  // 3. Vieja o inexistente → refrescar en vivo y persistir
  const liveBs = await fetchBcvRate();
  if (liveBs != null) {
    const fresh: ExchangeRates = {
      bs_per_usd: liveBs,
      cop_per_usd: stored?.cop_per_usd ?? FALLBACK_COP_PER_USD,
      updated_at: new Date().toISOString(),
    };
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('app_rates').upsert({
          id: 1,
          bs_per_usd: fresh.bs_per_usd,
          cop_per_usd: fresh.cop_per_usd,
          updated_at: fresh.updated_at,
        });
      } catch {
        /* persistir es best-effort; igual servimos el valor en vivo */
      }
    }
    return NextResponse.json(fresh);
  }

  // 4. La consulta en vivo falló → última tasa conocida o fallback interno
  if (stored) return NextResponse.json(stored);
  return NextResponse.json(await getExchangeRates());
}
