import { NextRequest, NextResponse } from 'next/server';
import { saveOrder, supabaseAdmin, type OrderInsert } from '@/lib/supabase';
import { checkRateLimit, recordFailure } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/getClientIp';

export async function POST(request: NextRequest) {
  try {
    // Throttle order spam per IP (bots / accidental double-submits at scale).
    const ip = getClientIp(request);
    if (!checkRateLimit(`order:${ip}`).allowed) {
      return NextResponse.json({ error: 'Demasiados pedidos seguidos. Espera un momento.' }, { status: 429 });
    }

    const body = await request.json() as OrderInsert;

    // Basic validation
    if (!body.customer_name || !body.customer_whatsapp || !body.items || !body.payment_method) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }
    recordFailure(`order:${ip}`); // count this submission toward the per-IP cap

    const result = await saveOrder(body);
    if (!result) {
      return NextResponse.json({ error: 'Error al guardar el pedido' }, { status: 500 });
    }

    // Maintain the CRM (best-effort, non-blocking for the customer).
    if (supabaseAdmin && body.status !== 'cancelado') {
      supabaseAdmin
        .rpc('upsert_customer', {
          p_whatsapp: body.customer_whatsapp,
          p_name: body.customer_name,
          p_total_usd: body.total_usd,
          p_zone: body.delivery_zone ?? '',
        })
        .then(({ error }) => { if (error) console.warn('CRM upsert:', error.message); });
    }

    return NextResponse.json({ id: result.id, status: 'pendiente' }, { status: 201 });
  } catch (err) {
    console.error('Orders API error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
