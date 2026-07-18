import { NextRequest, NextResponse } from 'next/server';
import type { ExchangeRates } from '@/lib/rates';
import { refreshRates } from '@/lib/rates.server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// Dynamic: se evalúa la frescura de la tasa en cada request.
export const dynamic = 'force-dynamic';

/** Día hábil (L-V) y hora (0-23) de `now` en la zona horaria dada. */
function diaHoraEn(now: Date, timeZone: string): { diaBancario: boolean; h: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  return { diaBancario: wd !== 'Sat' && wd !== 'Sun', h };
}

/**
 * Vida útil de la tasa guardada, según las ventanas de publicación de las dos
 * fuentes oficiales. Se abre una ventana corta (10 min) mientras cualquiera de
 * las dos pueda cambiar; fuera de ellas el valor no se mueve → 6 h de vida, para
 * no castigar visitantes ni a los portales con refrescos inútiles.
 *
 * - BCV (Bs/USD): publica días bancarios (L-V) al cierre de las mesas de cambio:
 *   nunca antes de ~16:00 VET y casi siempre entre 16:27 y 19:35 VET (verificado
 *   contra snapshots de archive.org y Finanzas Digital, jul-2026). Margen:
 *   L-V 15:00–21:00 Caracas.
 * - TRM (COP/USD): la Superintendencia Financiera certifica la TRM del día hábil
 *   siguiente en la tarde (habitualmente después de ~18:00 COT). Margen:
 *   L-V 17:00–21:00 Bogotá. El cron de n8n refresca a ese ritmo, así que este
 *   camino casi nunca lo paga un visitante; queda como red de auto-sanación.
 */
function freshWindowMs(now: Date): number {
  const ve = diaHoraEn(now, 'America/Caracas');
  const co = diaHoraEn(now, 'America/Bogota');
  const bcvWindow = ve.diaBancario && ve.h >= 15 && ve.h < 21;
  const trmWindow = co.diaBancario && co.h >= 17 && co.h < 21;
  return bcvWindow || trmWindow ? 10 * 60 * 1000 : 6 * 60 * 60 * 1000;
}

/** Refresca BCV + COP en vivo y persiste SOLO si alguna fuente respondió. */
async function refreshLive(stored: ExchangeRates | null): Promise<ExchangeRates> {
  const { rates, live } = await refreshRates(stored);
  if (live && supabaseAdmin) {
    try {
      await supabaseAdmin.from('app_rates').upsert({
        id: 1,
        bs_per_usd: rates.bs_per_usd,
        cop_per_usd: rates.cop_per_usd,
        updated_at: rates.updated_at,
      });
    } catch {
      /* persistir es best-effort; igual servimos el valor en vivo */
    }
  }
  return rates;
}

/**
 * Tasa de cambio para el sitio (vinculada globalmente vía CurrencyProvider →
 * toda conversión a Bs del catálogo, carrito y checkout).
 *
 * Estrategia auto-sanadora para que NUNCA falle y siga al BCV casi en tiempo real:
 *   0. `?refresh=1` → fuerza una consulta en vivo, ignora la tasa guardada y la
 *      persiste. Lo usan el botón "Recargar tasa" del panel admin y el cron de
 *      n8n (cada 10 min en la ventana de publicación del BCV, ver arriba).
 *   1. Lee la tasa guardada en `app_rates` (id=1).
 *   2. Si sigue fresca según la ventana → la sirve tal cual (rápido, sin red).
 *   3. Si está vieja o no existe → consulta en vivo y la persiste.
 *   4. Si la consulta en vivo falla → sirve la última tasa conocida (aunque esté
 *      vieja) SIN refrescar su updated_at, para que el próximo request reintente.
 *      Solo si no hay ninguna guardada cae al fallback interno. El cliente nunca
 *      ve un error.
 */
export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';
  const db = supabaseAdmin ?? supabase;

  // 1. Tasa guardada (también en el refresh forzado: completa lo que falle en vivo)
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

  // 2. ¿Fresca y sin refresh forzado? → servir tal cual
  const ageMs = stored ? Date.now() - new Date(stored.updated_at).getTime() : Infinity;
  if (!forceRefresh && stored && ageMs < freshWindowMs(new Date())) {
    return NextResponse.json(stored);
  }

  // 3./4. Vieja, inexistente o refresh forzado → en vivo (nunca falla: cae a stored/fallback)
  return NextResponse.json(await refreshLive(stored));
}
