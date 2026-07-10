import { NextRequest, NextResponse } from 'next/server';
import type { ExchangeRates } from '@/lib/rates';
import { refreshRates } from '@/lib/rates.server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Refresca la tasa BCV almacenada en `app_rates`.
 * Agendado por Vercel Cron (ver vercel.json) de LUNES a VIERNES a las 23:30 UTC
 * = 19:30 hora de Caracas, como RED DE SEGURIDAD. El refresco principal es el
 * cron de n8n que llama `/api/rates?refresh=1` cada 10 minutos (los crons del
 * plan Hobby de Vercel corren máximo una vez al día y sin hora garantizada).
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

  // Tasa guardada: completa lo que las fuentes en vivo no respondan.
  let stored: ExchangeRates | null = null;
  const { data } = await supabaseAdmin
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

  const { rates, live } = await refreshRates(stored);
  if (!live) {
    // Nada respondió: NO pisar la tasa guardada con el fallback.
    return NextResponse.json({ ok: false, error: 'Ninguna fuente en vivo respondió' }, { status: 502 });
  }

  const { error } = await supabaseAdmin.from('app_rates').upsert({
    id: 1,
    bs_per_usd: rates.bs_per_usd,
    cop_per_usd: rates.cop_per_usd,
    updated_at: rates.updated_at,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, bs_per_usd: rates.bs_per_usd, cop_per_usd: rates.cop_per_usd });
}
