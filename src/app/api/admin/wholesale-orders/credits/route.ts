import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import { SETTLED_SHARE, caracasDate, isSettled, remainingShare, type WholesaleOrder } from '@/lib/wholesaleOrders';
import { attachPayments } from '@/lib/wholesaleOrders.server';

/**
 * Créditos: lo que cada mayorista debe hoy. Equipo o admin.
 *
 * Cuenta los pedidos ENTREGADOS que no están pagados del todo, de cualquier
 * fecha (Cobros solo arrastra 90 días). Un pedido sin entregar no es deuda
 * todavía; los de días pasados que nadie marcó entregados se cuentan aparte
 * (`unmarked`) para que alguien los revise.
 */
export interface ClientCredit {
  key: string;
  client_id: string | null;
  name: string;
  phone: string | null;
  route: string | null;
  owed_cop: number;
  owed_usd: number;
  /** Fecha de entrega del pedido abierto más viejo. */
  oldest: string;
  orders: WholesaleOrder[];
}

const CHUNK = 200;

export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  const db = supabaseAdmin;
  const today = caracasDate();

  const [openRes, unmarkedRes] = await Promise.all([
    db
      .from('wholesale_orders')
      .select('*')
      .eq('status', 'entregado')
      .lt('paid_share', SETTLED_SHARE)
      .order('delivery_date', { ascending: true })
      .limit(5000),
    db
      .from('wholesale_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'registrado')
      .lt('delivery_date', today),
  ]);
  if (openRes.error) return NextResponse.json({ error: 'No se pudieron leer los créditos' }, { status: 500 });

  const rows = openRes.data ?? [];
  const orders: WholesaleOrder[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    orders.push(...await attachPayments(db, rows.slice(i, i + CHUNK)));
  }

  const byClient = new Map<string, ClientCredit>();
  for (const o of orders) {
    // `paid_share` de la columna puede ir desfasado: mandan las filas de pago.
    if (isSettled(o.paid_share, o.total_cop)) continue;
    const key = o.client_id ?? `name:${o.client_name.trim().toLowerCase()}`;
    let c = byClient.get(key);
    if (!c) {
      c = {
        key,
        client_id: o.client_id,
        name: o.client_name,
        phone: o.client_phone,
        route: o.client_route,
        owed_cop: 0,
        owed_usd: 0,
        oldest: o.delivery_date,
        orders: [],
      };
      byClient.set(key, c);
    }
    const left = remainingShare(o.paid_share);
    c.owed_cop += left * o.total_cop;
    c.owed_usd += left * o.total_usd;
    if (o.delivery_date < c.oldest) c.oldest = o.delivery_date;
    c.orders.push(o);
  }

  const clients = [...byClient.values()].sort((a, b) => b.owed_cop - a.owed_cop);
  return NextResponse.json({
    today,
    clients,
    total_cop: clients.reduce((s, c) => s + c.owed_cop, 0),
    total_usd: clients.reduce((s, c) => s + c.owed_usd, 0),
    unmarked: unmarkedRes.count ?? 0,
  });
}
