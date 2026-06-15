import { NextRequest, NextResponse } from 'next/server';
import { saveOrder, supabaseAdmin, type OrderInsert } from '@/lib/supabase';
import { checkRateLimit, recordFailure } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/getClientIp';
import { sendPushToAll } from '@/lib/push';

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

    // Avisar al equipo: notificación push al celular (aunque la app esté cerrada).
    // El badge muestra el total de pedidos por verificar. Best-effort.
    try {
      let count = 1;
      if (supabaseAdmin) {
        const { count: pending } = await supabaseAdmin
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pendiente');
        if (typeof pending === 'number' && pending > 0) count = pending;
      }
      const total = `$${Number(body.total_usd).toFixed(2)}`;
      await sendPushToAll({
        title: '🛎️ Nuevo pedido — El Rellenito',
        body: `${body.customer_name} · ${total}${body.is_wholesale ? ' · Al mayor' : ''}`,
        tag: `order-${result.id}`,
        url: '/admin/dashboard',
        count,
      });
    } catch (err) {
      console.warn('Push notify:', err);
    }

    return NextResponse.json({ id: result.id, status: 'pendiente' }, { status: 201 });
  } catch (err) {
    console.error('Orders API error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
