import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import type { Json } from '@/lib/database.types';

/** Inicia una ruta para un domiciliario. Requiere sesión de equipo o admin. */
export async function POST(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({})) as {
    driver?: string; note?: string; order_id?: string; driver_id?: string; dest_lat?: number; dest_lng?: number;
  };
  const driver = (body.driver ?? '').trim() || 'Domiciliario';
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  const { data, error } = await supabaseAdmin
    .from('delivery_routes')
    .insert([{
      driver,
      status: 'active',
      points: [] as unknown as Json,
      note: body.note?.trim() || null,
      order_id: body.order_id?.trim() || null,
      driver_id: body.driver_id?.trim() || null,
      dest_lat: num(body.dest_lat),
      dest_lng: num(body.dest_lng),
    }])
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
