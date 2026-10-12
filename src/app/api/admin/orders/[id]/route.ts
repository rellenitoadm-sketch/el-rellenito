import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { mockStore } from '@/lib/mockStore';
import { isAuthorized, requireRole } from '@/lib/adminAuth';
import { fireOrderEvent } from '@/lib/webhook';
import { parseWebItems } from '@/lib/inventory';
import { reapplySale, releaseSale } from '@/lib/inventory.server';
import { caracasDate, isYmd } from '@/lib/wholesaleOrders';

// Only these status values may be set, and only via this endpoint.
const VALID_STATUSES = ['pendiente', 'confirmado', 'en_camino', 'entregado', 'cancelado'] as const;
type Status = (typeof VALID_STATUSES)[number];

/** Detalle de un pedido (para la página del domiciliario) — equipo o admin. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const db = supabaseAdmin ?? supabase;
  if (!db) {
    const o = mockStore.getAll().find(r => r.id === id);
    return o ? NextResponse.json(o) : NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }
  const { data, error } = await db.from('orders').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { status?: string };

  // Whitelist: only an allowed status value gets through (no mass-assignment).
  if (!body.status || !VALID_STATUSES.includes(body.status as Status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }
  const patch = { status: body.status as Status };

  const db = supabaseAdmin ?? supabase;

  if (!db) {
    mockStore.updateStatus(id, patch.status);
    return NextResponse.json({ id, ...patch });
  }

  // Estado anterior: decide si el inventario tiene que devolver las unidades
  // (se canceló) o volver a descontarlas (se revivió un pedido cancelado).
  const { data: antes } = await db
    .from('orders')
    .select('status, items, scheduled_date')
    .eq('id', id)
    .maybeSingle();

  const { data: updated, error } = await db
    .from('orders')
    .update(patch)
    .eq('id', id)
    .select('id, customer_name, customer_whatsapp, status, total_usd, total_cop, is_wholesale, delivery_zone, scheduled_date, scheduled_time')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // El inventario nunca tumba el cambio de estado: si falla, queda en el log.
  if (supabaseAdmin && antes && antes.status !== patch.status) {
    try {
      if (patch.status === 'cancelado') {
        await releaseSale(supabaseAdmin, {
          day: isYmd(antes.scheduled_date) ? antes.scheduled_date : caracasDate(),
          lines: parseWebItems(antes.items),
          orderId: id,
        });
      } else if (antes.status === 'cancelado') {
        await reapplySale(supabaseAdmin, { orderId: id });
      }
    } catch (err) {
      console.warn('Inventario (cambio de estado):', err instanceof Error ? err.message : err);
    }
  }

  // Webhook saliente para automatizaciones (n8n): WhatsApp de "en camino",
  // "cancelado", etc. según el nuevo estado. Best-effort.
  await fireOrderEvent('order.status_changed', {
    id,
    status: patch.status,
    customer_name: updated?.customer_name,
    customer_whatsapp: updated?.customer_whatsapp,
    total_usd: updated?.total_usd,
    total_cop: updated?.total_cop ?? null,
    is_wholesale: updated?.is_wholesale ?? undefined,
    delivery_zone: updated?.delivery_zone ?? null,
    scheduled_date: updated?.scheduled_date ?? null,
    scheduled_time: updated?.scheduled_time ?? null,
  });

  return NextResponse.json({ success: true });
}

/** Eliminar un pedido — SOLO admin (no el equipo). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = supabaseAdmin ?? supabase;

  if (!db) {
    mockStore.remove(id);
    return NextResponse.json({ success: true });
  }

  const { error } = await db.from('orders').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
