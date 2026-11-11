import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import { addDays, caracasDate } from '@/lib/wholesaleOrders';

/**
 * Ventas al mayor por motorizado. Solo admin.
 * `?days=1|7|30` (por defecto 30), contados en hora de Caracas hasta hoy.
 *
 * - Vendido: pedidos no cancelados con fecha de entrega en el periodo que lleva
 *   ese motorizado (`driver_name`). Incluye los que aún no entregó.
 * - Cobrado: cobros del periodo (`collected_on`) que marcó ese motorizado, en
 *   pesos: fracción cobrada (`share`) × total en pesos del pedido. Puede ser de
 *   pedidos de días anteriores (saldos que se arrastran).
 */
export interface DriverSales {
  name: string;
  orders: number;
  delivered: number;
  units: number;
  sold_cop: number;
  sold_usd: number;
  collected_cop: number;
}

const DAYS = [1, 7, 30];

function units(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((s: number, i) => {
    const q = Number((i as { qty?: unknown })?.qty);
    return s + (Number.isFinite(q) && q > 0 ? q : 0);
  }, 0);
}

export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  const db = supabaseAdmin;

  const asked = Number(request.nextUrl.searchParams.get('days'));
  const days = DAYS.includes(asked) ? asked : 30;
  const today = caracasDate();
  const from = addDays(today, -(days - 1));

  const [ordersRes, paymentsRes] = await Promise.all([
    db
      .from('wholesale_orders')
      .select('driver_name, status, items, total_cop, total_usd')
      .neq('status', 'cancelado')
      .gte('delivery_date', from)
      .lte('delivery_date', today)
      .limit(5000),
    db
      .from('wholesale_payments')
      .select('order_id, driver_name, share')
      .gte('collected_on', from)
      .lte('collected_on', today)
      .gt('share', 0)
      .limit(5000),
  ]);
  if (ordersRes.error || paymentsRes.error) {
    return NextResponse.json({ error: 'No se pudieron leer los pedidos' }, { status: 500 });
  }

  const byName = new Map<string, DriverSales>();
  const row = (raw: string) => {
    const name = raw.trim();
    const key = name.toLowerCase();
    let r = byName.get(key);
    if (!r) {
      r = { name, orders: 0, delivered: 0, units: 0, sold_cop: 0, sold_usd: 0, collected_cop: 0 };
      byName.set(key, r);
    }
    return r;
  };

  let unassigned = 0;
  for (const o of ordersRes.data ?? []) {
    if (!o.driver_name?.trim()) { unassigned++; continue; }
    const r = row(o.driver_name);
    r.orders++;
    if (o.status === 'entregado') r.delivered++;
    r.units += units(o.items);
    r.sold_cop += Number(o.total_cop) || 0;
    r.sold_usd += Number(o.total_usd) || 0;
  }

  // Cobros: el total en pesos del pedido (puede ser de antes del periodo).
  const payments = paymentsRes.data ?? [];
  const ids = [...new Set(payments.map(p => p.order_id))];
  const totals = new Map<string, { cop: number; driver: string | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from('wholesale_orders')
      .select('id, total_cop, driver_name')
      .in('id', ids.slice(i, i + 200));
    if (error) return NextResponse.json({ error: 'No se pudieron leer los cobros' }, { status: 500 });
    for (const o of data ?? []) totals.set(o.id, { cop: Number(o.total_cop) || 0, driver: o.driver_name });
  }
  for (const p of payments) {
    const order = totals.get(p.order_id);
    const who = p.driver_name?.trim() || order?.driver?.trim();
    if (!order || !who) continue;
    row(who).collected_cop += (Number(p.share) || 0) * order.cop;
  }

  const drivers = [...byName.values()].sort((a, b) => b.sold_cop - a.sold_cop || b.sold_usd - a.sold_usd);
  return NextResponse.json({ days, from, to: today, drivers, unassigned });
}
