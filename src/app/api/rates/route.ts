import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRates, type ExchangeRates } from '@/lib/rates';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// Dynamic: se evalúa la frescura de la tasa en cada request.
export const dynamic = 'force-dynamic';

/** Fecha (YYYY-MM-DD) de un instante en la zona horaria de Caracas. */
function caracasDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/** Refresca BCV + COP en vivo y los persiste (best-effort). */
async function refreshLive(): Promise<ExchangeRates> {
  const fresh = await getExchangeRates(); // consulta BCV y COP en vivo, con fallback interno
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
  return fresh;
}

/**
 * Tasa de cambio para el sitio (vinculada globalmente vía CurrencyProvider →
 * toda conversión a Bs del catálogo, carrito y checkout).
 *
 * Estrategia auto-sanadora para que NUNCA falle y se actualice sola al valor de hoy:
 *   0. `?refresh=1` → fuerza una consulta en vivo (BCV + COP), ignora el caché del día
 *      y la persiste. Lo usa el botón "Recargar tasa" del panel admin.
 *   1. Lee la tasa guardada en `app_rates` (id=1).
 *   2. Si es de HOY (zona Caracas) → la sirve tal cual (estable durante el día, sin red).
 *   3. Si está vieja o no existe → consulta BCV + COP en vivo y la persiste.
 *   4. Si la consulta en vivo falla → sirve la última tasa conocida (aunque esté vieja),
 *      y solo si no hay ninguna, cae al fallback interno. El cliente nunca ve un error.
 *
 * El cron `/api/cron/refresh-rate` (L-V tras la publicación del BCV) sigue como
 * pre-calentamiento; este endpoint ya no depende de él para mantenerse al día.
 */
export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';
  const db = supabaseAdmin ?? supabase;

  // 0. Recarga manual forzada → siempre el valor más reciente, sin caché del día.
  if (forceRefresh) {
    return NextResponse.json(await refreshLive());
  }

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

  // 3. Vieja o inexistente → refrescar en vivo (BCV + COP) y persistir.
  // refreshLive() nunca falla: si las fuentes en vivo caen, usa el fallback interno.
  return NextResponse.json(await refreshLive());
}
