import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import {
  CARRYOVER_DAYS,
  MAX_AHEAD_DAYS,
  SETTLED_SHARE,
  addDays,
  caracasDate,
  isYmd,
} from '@/lib/wholesaleOrders';
import {
  OrderInputError,
  attachPayments,
  cleanText,
  getStoredRates,
  priceItems,
  toOrder,
} from '@/lib/wholesaleOrders.server';
import { parseWholesaleItems } from '@/lib/inventory';
import { registerSaleSafely } from '@/lib/inventory.server';
import { createWholesaleTicket } from '@/lib/tickets.server';
import type { Json } from '@/lib/database.types';

/**
 * Pedidos mayoristas de un día + lo que quedó abierto de días anteriores.
 * Equipo o admin. `?date=YYYY-MM-DD` (por defecto, hoy en Venezuela).
 *
 * `carryover` arrastra los pedidos viejos que siguen pendientes (sin entregar o
 * sin cobrar del todo) y también los que se cobraron HOY aunque ya quedaran
 * saldados: si no, el cobro desaparecía de la caja del día y nadie podía
 * deshacerlo si se marcó por error.
 */
export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  const db = supabaseAdmin;

  const param = request.nextUrl.searchParams.get('date');
  const date = isYmd(param) ? param : caracasDate();
  const today = caracasDate();

  const [dayRes, openRes, paidTodayRes, upcomingRes, rates] = await Promise.all([
    db.from('wholesale_orders').select('*').eq('delivery_date', date).order('created_at', { ascending: true }),
    db
      .from('wholesale_orders')
      .select('*')
      .neq('status', 'cancelado')
      .lt('delivery_date', date)
      .gte('delivery_date', addDays(date, -CARRYOVER_DAYS))
      .lt('paid_share', SETTLED_SHARE)
      .order('delivery_date', { ascending: true }),
    db.from('wholesale_payments').select('order_id').eq('collected_on', today),
    db
      .from('wholesale_orders')
      .select('delivery_date')
      .eq('status', 'registrado')
      .gt('delivery_date', date)
      .lte('delivery_date', addDays(date, MAX_AHEAD_DAYS)),
    getStoredRates(db),
  ]);
  if (dayRes.error) return NextResponse.json({ error: dayRes.error.message }, { status: 500 });
  if (openRes.error) return NextResponse.json({ error: openRes.error.message }, { status: 500 });

  const dayRows = dayRes.data ?? [];
  const carryRows = openRes.data ?? [];
  const known = new Set([...dayRows, ...carryRows].map(r => r.id));
  const paidTodayIds = [...new Set((paidTodayRes.data ?? []).map(p => p.order_id))].filter(id => !known.has(id));
  if (paidTodayIds.length > 0) {
    const { data } = await db
      .from('wholesale_orders')
      .select('*')
      .in('id', paidTodayIds)
      .neq('status', 'cancelado')
      .lt('delivery_date', date);
    carryRows.push(...(data ?? []));
  }
  carryRows.sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));

  const [orders, carryover] = await Promise.all([
    attachPayments(db, dayRows),
    attachPayments(db, carryRows),
  ]);

  // Cuántos pedidos ya hay planificados para días siguientes.
  const upcoming = new Map<string, number>();
  for (const row of upcomingRes.data ?? []) {
    upcoming.set(row.delivery_date, (upcoming.get(row.delivery_date) ?? 0) + 1);
  }

  return NextResponse.json({
    date,
    today,
    rates,
    orders,
    carryover,
    upcoming: [...upcoming.entries()].map(([d, count]) => ({ date: d, count })).sort((a, b) => a.date.localeCompare(b.date)),
  });
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
  const today = caracasDate();
  if (deliveryDate < today) return NextResponse.json({ error: 'Esa fecha ya pasó. Elige hoy o un día siguiente.' }, { status: 400 });
  if (deliveryDate > addDays(today, MAX_AHEAD_DAYS)) {
    return NextResponse.json({ error: 'Esa fecha está demasiado lejos. Revísala.' }, { status: 400 });
  }

  const { data: client } = await supabaseAdmin
    .from('wholesale_clients')
    .select('id, name, phone, address, route, active')
    .eq('id', clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: 'Ese mayorista no existe.' }, { status: 400 });
  if (!client.active) return NextResponse.json({ error: `${client.name} está inactivo.` }, { status: 400 });

  // Dos domiciliarios pueden recibir la misma llamada: se avisa antes de duplicar.
  if (body.allow_duplicate !== true) {
    const { data: dup } = await supabaseAdmin
      .from('wholesale_orders')
      .select('id, driver_name')
      .eq('client_id', client.id)
      .eq('delivery_date', deliveryDate)
      .neq('status', 'cancelado')
      .limit(1);
    if (dup && dup.length > 0) {
      return NextResponse.json(
        {
          error: `Ya hay un pedido de ${client.name} para ese día${dup[0].driver_name ? ` (lo lleva ${dup[0].driver_name})` : ''}.`,
          duplicate: true,
        },
        { status: 409 },
      );
    }
  }

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

    // Inventario: el pedido aparta las unidades del día en que se entrega.
    await registerSaleSafely(supabaseAdmin, {
      day: deliveryDate,
      lines: parseWholesaleItems(priced.items),
      wholesaleOrderId: data.id,
      actor: cleanText(body.created_by, 80),
    });

    const ticket = await createWholesaleTicket(supabaseAdmin, data);
    return NextResponse.json({ ...toOrder(data), ticket_code: ticket?.code ?? null }, { status: 201 });
  } catch (e) {
    if (e instanceof OrderInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: 'No se pudo guardar el pedido.' }, { status: 500 });
  }
}
