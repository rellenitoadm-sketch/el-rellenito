import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';

/**
 * Devuelve la ruta ACTIVA que el domiciliario debe recuperar al volver a la app.
 * Se busca por `id` (la que el dispositivo recuerda) o por `order_id` (al reanudar
 * la entrega de un pedido). Responde la fila completa (con puntos) o `null` si ya
 * no hay ninguna activa. Equipo o admin.
 */
export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json(null);

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get('id') ?? '').trim();
  const orderId = (searchParams.get('order_id') ?? '').trim();
  if (!id && !orderId) return NextResponse.json(null);

  const cols = 'id, driver, driver_id, order_id, status, points, started_at, distance_m, dest_lat, dest_lng, last_lat, last_lng, last_at';
  let query = supabaseAdmin.from('delivery_routes').select(cols).eq('status', 'active');
  query = id ? query.eq('id', id) : query.eq('order_id', orderId);

  const { data, error } = await query
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}
