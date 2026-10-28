import { NextRequest, NextResponse } from 'next/server';
import { saveOrder, supabaseAdmin, type OrderInsert } from '@/lib/supabase';
import { checkRateLimit, recordFailure } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/getClientIp';
import { sendPushToAll } from '@/lib/push';
import { fireOrderEvent } from '@/lib/webhook';
import { parseWebItems } from '@/lib/inventory';
import { registerSaleSafely } from '@/lib/inventory.server';
import { caracasDate, isYmd } from '@/lib/wholesaleOrders';
import { createWebTicket } from '@/lib/tickets.server';

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
const money = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100000 ? v : null;
const isHttps = (v: unknown): v is string => typeof v === 'string' && /^https:\/\//.test(v) && v.length <= 600;

/**
 * Lo que llega del navegador NO es de fiar: antes se insertaba tal cual en la tabla,
 * así que alguien podía mandar `status: 'entregado'`, un total en 0 o columnas ajenas.
 * Aquí se toma solo lo permitido, el estado siempre arranca en "pendiente" y los
 * números se validan. Devuelve el pedido limpio o el motivo del rechazo.
 */
function sanitizeOrder(raw: Record<string, unknown>): OrderInsert | string {
  const name = str(raw.customer_name, 120);
  const whatsapp = str(raw.customer_whatsapp, 30);
  const payment = str(raw.payment_method, 40);
  if (!name || !whatsapp || !payment) return 'Faltan campos requeridos';

  if (!Array.isArray(raw.items) || raw.items.length === 0 || raw.items.length > 80) return 'El pedido no tiene productos válidos';
  let sum = 0;
  for (const it of raw.items as Record<string, unknown>[]) {
    const qty = it?.qty;
    const price = money(it?.price_usd);
    if (!it || typeof it.name !== 'string' || typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > 1000 || price === null) {
      return 'El pedido tiene un producto inválido';
    }
    sum += qty * price;
  }

  const total = money(raw.total_usd);
  if (total === null) return 'Total inválido';
  // El total puede ser mayor que la suma (recargo de fritura), nunca menor.
  if (total < sum - 0.05) return 'El total no coincide con los productos';

  const totalCop = raw.total_cop == null ? null : money(raw.total_cop);
  if (raw.total_cop != null && totalCop === null) return 'Total en COP inválido';

  const opt = (v: unknown) => (v == null ? null : money(v));
  return {
    customer_name: name,
    customer_whatsapp: whatsapp,
    delivery_type: str(raw.delivery_type, 20) ?? 'delivery',
    delivery_zone: str(raw.delivery_zone, 120),
    delivery_cost_cop: money(raw.delivery_cost_cop) ?? 0,
    delivery_address: str(raw.delivery_address, 600),
    items: raw.items as OrderInsert['items'],
    total_usd: total,
    total_cop: totalCop,
    currency_shown: str(raw.currency_shown, 10) ?? 'USD',
    payment_method: payment,
    notes: str(raw.notes, 600),
    status: 'pendiente',
    payment_proof_ref: str(raw.payment_proof_ref, 200),
    payment_proof_url: isHttps(raw.payment_proof_url) ? raw.payment_proof_url : null,
    is_wholesale: raw.is_wholesale === true,
    advance_pct: opt(raw.advance_pct),
    advance_usd: opt(raw.advance_usd),
    remaining_usd: opt(raw.remaining_usd),
    scheduled_date: isYmd(raw.scheduled_date) ? (raw.scheduled_date as string) : null,
    scheduled_time: str(raw.scheduled_time, 20),
  };
}

export async function POST(request: NextRequest) {
  try {
    // Throttle order spam per IP (bots / accidental double-submits at scale).
    const ip = getClientIp(request);
    if (!checkRateLimit(`order:${ip}`).allowed) {
      return NextResponse.json({ error: 'Demasiados pedidos seguidos. Espera un momento.' }, { status: 429 });
    }

    const raw = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
    const clean = sanitizeOrder(raw);
    if (typeof clean === 'string') return NextResponse.json({ error: clean }, { status: 400 });
    const body = clean;
    recordFailure(`order:${ip}`); // count this submission toward the per-IP cap

    const result = await saveOrder(body);
    if (!result) {
      return NextResponse.json({ error: 'Error al guardar el pedido' }, { status: 500 });
    }

    // Inventario: aparta las unidades desde que entra el pedido, aunque falte
    // verificar el pago. Un encargo para otro día descuenta de ESE día. Si algo
    // falla, el pedido igual queda guardado: vender nunca se bloquea.
    await registerSaleSafely(supabaseAdmin, {
      day: isYmd(body.scheduled_date) ? body.scheduled_date : caracasDate(),
      lines: parseWebItems(body.items),
      orderId: result.id,
      actor: body.customer_name,
    });

    // Ticket (factura) para reenviar al cliente. Si falla, el pedido sigue.
    const ticket = await createWebTicket(supabaseAdmin, result.id, body);

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

    // Webhook saliente para automatizaciones (n8n) — best-effort.
    await fireOrderEvent('order.created', {
      id: result.id,
      customer_name: body.customer_name,
      customer_whatsapp: body.customer_whatsapp,
      status: 'pendiente',
      total_usd: body.total_usd,
      total_cop: body.total_cop ?? null,
      currency_shown: body.currency_shown,
      is_wholesale: body.is_wholesale ?? false,
      delivery_type: body.delivery_type,
      delivery_zone: body.delivery_zone ?? null,
      delivery_address: body.delivery_address ?? null,
      payment_method: body.payment_method,
      scheduled_date: body.scheduled_date ?? null,
      scheduled_time: body.scheduled_time ?? null,
      items: body.items,
    });

    return NextResponse.json({ id: result.id, status: 'pendiente', ticket }, { status: 201 });
  } catch (err) {
    console.error('Orders API error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
