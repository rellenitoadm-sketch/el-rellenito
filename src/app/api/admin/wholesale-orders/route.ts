import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import { SETTLED_SHARE, caracasDate, isYmd } from '@/lib/wholesaleOrders';
import {
  OrderInputError,
  attachPayments,
  cleanText,
  getStoredRates,
  priceItems,
  toOrder,
} from '@/lib/wholesaleOrders.server';
import type { Json } from '@/lib/database.types';

/**
 * Pedidos mayoristas de un día + saldos pendientes de días anteriores.
 * Equipo o admin. `?date=YYYY-MM-DD` (por defecto, hoy en Venezuela).
 */
export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const param = request.nextUrl.searchParams.get('date');
  const date = isYmd(param) ? param : caracasDate();

  const [dayRes, debtRes, rates] = await Promise.all([
    supabaseAdmin
      .from('wholesale_orders')
      .select('*')
      .eq('delivery_date', date)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('wholesale_orders')
      .select('*')
      .eq('status', 'entregado')
      .lt('delivery_date', date)
      .lt('paid_share', SETTLED_SHARE)
      .order('delivery_date', { ascending: true }),
    getStoredRates(supabaseAdmin),
  ]);
  if (dayRes.error) return NextResponse.json({ error: dayRes.error.message }, { status: 500 });
  if (debtRes.error) return NextResponse.json({ error: debtRes.error.message }, { status: 500 });

  const [orders, debts] = await Promise.all([
    attachPayments(supabaseAdmin, dayRes.data ?? []),
    attachPayments(supabaseAdmin, debtRes.data ?? []),
  ]);

  return NextResponse.json({ date, today: caracasDate(), rates, orders, debts });
}

/** Registrar un pedido tomado por teléfono. Equipo o admin. */
export async function POST(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const clientId = typeof body.client_id === 'string' ? body.client_id : '';
  const deliveryDate = body.delivery_date;
  if (!clientId) return NextResponse.json({ error: 'Elige el mayorista.' }, { status: 400 });
  if (!isYmd(deliveryDate)) return NextResponse.json({ error: 'Fecha de entrega inválida.' }, { status: 400 });

  const { data: client } = await supabaseAdmin
    .from('wholesale_clients')
    .select('id, name, phone, address, route, active')
    .eq('id', clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: 'Ese mayorista no existe.' }, { status: 400 });
  if (!client.active) return NextResponse.json({ error: `${client.name} está inactivo.` }, { status: 400 });

  try {
    const rates = await getStoredRates(supabaseAdmin);
    const priced = await priceItems(supabaseAdmin, body.items, rates?.cop_per_usd ?? null);
    const { data, error } = await supabaseAdmin
      .from('wholesale_orders')
      .insert({
        client_id: client.id,
        client_name: client.name,
        client_phone: client.phone,
        client_address: client.address,
        client_route: client.route,
        delivery_date: deliveryDate,
        items: priced.items as unknown as Json,
        total_usd: priced.total_usd,
        total_cop: priced.total_cop,
        notes: cleanText(body.notes),
        created_by: cleanText(body.created_by, 80),
      })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(toOrder(data), { status: 201 });
  } catch (e) {
    if (e instanceof OrderInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: 'No se pudo guardar el pedido.' }, { status: 500 });
  }
}
