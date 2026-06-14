import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRates } from '@/lib/rates';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Refresca la tasa BCV almacenada en `app_rates`.
 * Agendado por Vercel Cron (ver vercel.json) de LUNES a VIERNES a las 23:30 UTC
 * = 19:30 hora de Caracas, cuando el BCV ya publicó el valor del día.
 *
 * Vercel Cron envía `Authorization: Bearer <CRON_SECRET>`. También se puede
 * disparar manualmente (o desde n8n) con ese header si CRON_SECRET está puesto.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 });
  }

  const live = await getExchangeRates(); // BCV en vivo (con fallback interno)
  const { error } = await supabaseAdmin.from('app_rates').upsert({
    id: 1,
    bs_per_usd: live.bs_per_usd,
    cop_per_usd: live.cop_per_usd,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, bs_per_usd: live.bs_per_usd, cop_per_usd: live.cop_per_usd });
}
