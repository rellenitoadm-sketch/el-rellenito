import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import { addDays, caracasDate } from '@/lib/wholesaleOrders';
import { ensureTicket, toTicket } from '@/lib/tickets.server';

const RANGE_DAYS: Record<string, number> = { hoy: 0, semana: 6, mes: 29 };

/** Inicio del día en Caracas (UTC-4, sin horario de verano) como timestamp. */
function dayStart(ymd: string): string {
  return `${ymd}T00:00:00-04:00`;
}

/**
 * Tickets emitidos + totales vendidos (hoy / 7 días / 30 días).
 * Equipo o admin. Filtros: `q` (nombre, teléfono o nº), `range` (hoy|semana|mes|todo),
 * `kind` (detal|mayor).
 */
export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  const db = supabaseAdmin;

  const params = request.nextUrl.searchParams;
  const range = params.get('range') ?? 'hoy';
  const kind = params.get('kind');
  // Fuera comas, paréntesis y comodines: el texto va dentro de un filtro `or()`.
  const q = (params.get('q') ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 60);
  const today = caracasDate();

  // Ticket de un pedido concreto (botón "Ver ticket" en las listas de pedidos).
  const byOrder = params.get('order_id');
  const byWholesale = params.get('wholesale_order_id');
  if (byOrder || byWholesale) {
    const { data } = await db.from('tickets').select('*')
      .eq(byOrder ? 'order_id' : 'wholesale_order_id', (byOrder ?? byWholesale) as string)
      .limit(1).maybeSingle();
    return NextResponse.json({ ticket: data ? toTicket(data) : null });
  }

  let list = db.from('tickets').select('*').order('created_at', { ascending: false }).limit(300);
  if (range in RANGE_DAYS) list = list.gte('created_at', dayStart(addDays(today, -RANGE_DAYS[range])));
  if (kind === 'detal' || kind === 'mayor') list = list.eq('kind', kind);
  if (q) {
    const digits = q.replace(/\D/g, '');
    const parts = [`customer_name.ilike.%${q}%`, `customer_phone.ilike.%${q}%`];
    if (digits && digits.length <= 9) parts.push(`number.eq.${Number(digits)}`);
    list = list.or(parts.join(','));
  }

  const [listRes, totalsRes] = await Promise.all([
    list,
    db.from('tickets').select('total_usd, created_at').gte('created_at', dayStart(addDays(today, -29))),
  ]);
  if (listRes.error) return NextResponse.json({ error: listRes.error.message }, { status: 500 });

  const weekStart = dayStart(addDays(today, -6));
  const todayStart = dayStart(today);
  const totals = { today: { count: 0, usd: 0 }, week: { count: 0, usd: 0 }, month: { count: 0, usd: 0 } };
  for (const r of totalsRes.data ?? []) {
    const usd = Number(r.total_usd);
    const at = new Date(r.created_at).getTime();
    totals.month.count++; totals.month.usd += usd;
    if (at >= new Date(weekStart).getTime()) { totals.week.count++; totals.week.usd += usd; }
    if (at >= new Date(todayStart).getTime()) { totals.today.count++; totals.today.usd += usd; }
  }

  return NextResponse.json({ tickets: (listRes.data ?? []).map(toTicket), totals });
}

/** Crea el ticket de un pedido que no lo tiene (pedidos anteriores a los tickets). */
export async function POST(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const ref = typeof body.order_id === 'string' ? { order_id: body.order_id }
    : typeof body.wholesale_order_id === 'string' ? { wholesale_order_id: body.wholesale_order_id }
    : null;
  if (!ref) return NextResponse.json({ error: 'Falta el pedido.' }, { status: 400 });

  const ticket = await ensureTicket(supabaseAdmin, ref);
  if (!ticket) return NextResponse.json({ error: 'No se pudo crear el ticket.' }, { status: 500 });
  return NextResponse.json({ ticket }, { status: 201 });
}
