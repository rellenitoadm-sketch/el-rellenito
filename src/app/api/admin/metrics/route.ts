import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { visitStore } from '@/lib/visitStore';
import { requireRole } from '@/lib/adminAuth';

/**
 * Las ventas (ingresos, top productos, detal vs. mayor) ya viven en
 * `/api/admin/tickets` — ésa es la única fuente de verdad, porque cubre
 * ambos tipos de pedido. Este endpoint quedó solo para visitas a la
 * página, que no es un dato de venta.
 */
function startOf(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function aggregate(visits: { hour: number; date: string }[]) {
  const todayStr = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const visitsByHour = Array.from({ length: 24 }, () => 0);
  let visitsToday = 0;
  for (const v of visits) {
    visitsByHour[v.hour]++;
    if (v.date === todayStr) visitsToday++;
  }
  return { visits: { total: visits.length, today: visitsToday, byHour: visitsByHour } };
}

export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(aggregate(visitStore.getAll()));
  }

  const since = startOf(30).toISOString();
  const visitsRes = await supabaseAdmin.from('page_visits').select('visit_hour,visit_date').gte('created_at', since);
  const visits = (visitsRes.data ?? []).map((v: { visit_hour: number; visit_date: string }) => ({
    hour: v.visit_hour, date: v.visit_date,
  }));

  return NextResponse.json(aggregate(visits));
}
