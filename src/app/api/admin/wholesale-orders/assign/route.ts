import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import { cleanText } from '@/lib/wholesaleOrders.server';

const MAX_IDS = 100;
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Un domiciliario se lleva pedidos. Equipo o admin.
 * Body: `{ ids, driver_id, driver_name, from_driver_name? }`.
 *
 * Solo toma pedidos sin entregar que nadie lleva; con `from_driver_name` toma los
 * que lleva esa persona (quitárselos es explícito). La condición va en el UPDATE,
 * así que si dos domiciliarios tocan "Llevar" a la vez solo uno se queda cada pedido.
 */
export async function POST(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string' && UUID.test(x)) : [];
  const driverName = cleanText(body.driver_name, 80);
  const driverId = typeof body.driver_id === 'string' && UUID.test(body.driver_id) ? body.driver_id : null;
  const fromDriver = cleanText(body.from_driver_name, 80);

  if (ids.length === 0 || ids.length > MAX_IDS) return NextResponse.json({ error: 'Elige los pedidos a llevar.' }, { status: 400 });
  if (!driverName) return NextResponse.json({ error: 'Indica quién lleva los pedidos.' }, { status: 400 });

  let query = supabaseAdmin
    .from('wholesale_orders')
    .update({ driver_id: driverId, driver_name: driverName, assigned_at: new Date().toISOString() })
    .in('id', ids)
    .eq('status', 'registrado');
  query = fromDriver ? query.eq('driver_name', fromDriver) : query.is('driver_name', null);

  const { data, error } = await query.select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const updated = (data ?? []).map(r => r.id);
  const missed = ids.filter(id => !updated.includes(id));
  if (missed.length === 0) return NextResponse.json({ updated });

  const { data: others } = await supabaseAdmin
    .from('wholesale_orders')
    .select('id, client_name, driver_name, status')
    .in('id', missed);
  return NextResponse.json(
    { error: 'Algunos pedidos ya no estaban disponibles.', updated, conflicts: others ?? [] },
    { status: 409 },
  );
}
