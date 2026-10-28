import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import { closeStaleRoutes, customerNamesByOrder } from '@/lib/routes.server';

/**
 * Recorridos terminados — equipo o admin.
 * - `?id=…` → una ruta completa (con todos sus puntos) para dibujarla en el mapa.
 * - sin `id` → lista liviana de los últimos `days` días (equipo: máx. 14; admin: máx. 90).
 */
export async function GET(request: NextRequest) {
  const role = requireRole(request, 'admin', 'staff');
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  const db = supabaseAdmin;

  const sp = request.nextUrl.searchParams;
  const id = (sp.get('id') ?? '').trim();

  if (id) {
    const { data, error } = await db
      .from('delivery_routes')
      .select('id, driver, status, started_at, ended_at, distance_m, points, dest_lat, dest_lng, last_lat, last_lng, last_at, note, order_id')
      .eq('id', id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 });
    return NextResponse.json(data);
  }

  await closeStaleRoutes(db);

  const isAdmin = role === 'admin';
  const maxDays = isAdmin ? 90 : 14;
  const days = Math.min(Math.max(parseInt(sp.get('days') ?? '7', 10) || 7, 1), maxDays);
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const { data, error } = await db
    .from('delivery_routes')
    .select('id, driver, status, started_at, ended_at, distance_m, note, order_id, dest_lat, dest_lng')
    .eq('status', 'done')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(150);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const names = await customerNamesByOrder(db, (data ?? []).map(r => r.order_id ?? ''));
  return NextResponse.json((data ?? []).map(r => ({
    ...r,
    customer: r.order_id ? names.get(String(r.order_id)) ?? null : null,
  })));
}
