import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';

/**
 * Listado de rutas para el panel admin:
 * - `active`: rutas en curso CON sus puntos (para dibujar el recorrido en vivo).
 * - `history`: rutas terminadas, solo metadatos (livianas), las 50 más recientes.
 */
export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ active: [], history: [] });

  const [{ data: active }, { data: history }] = await Promise.all([
    supabaseAdmin
      .from('delivery_routes')
      .select('*')
      .eq('status', 'active')
      .order('started_at', { ascending: false }),
    supabaseAdmin
      .from('delivery_routes')
      .select('id, driver, status, started_at, ended_at, distance_m, last_lat, last_lng, last_at')
      .eq('status', 'done')
      .order('started_at', { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({ active: active ?? [], history: history ?? [] });
}
