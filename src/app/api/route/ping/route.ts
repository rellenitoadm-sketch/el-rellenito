import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import { pathDistance, type RoutePoint } from '@/lib/routes';
import type { Json } from '@/lib/database.types';

/** Agrega puntos GPS al recorrido de una ruta activa. Equipo o admin. */
export async function POST(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({})) as { id?: string; points?: RoutePoint[] };
  const id = (body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'Falta el id de la ruta' }, { status: 400 });

  // Limpia los puntos entrantes (descarta coordenadas inválidas).
  const incoming = Array.isArray(body.points) ? body.points : [];
  const clean: RoutePoint[] = incoming
    .filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map(p => ({ lat: p.lat, lng: p.lng, t: Number.isFinite(p.t) ? p.t : Date.now() }));
  if (clean.length === 0) return NextResponse.json({ ok: true, added: 0 });

  const { data: route, error: readErr } = await supabaseAdmin
    .from('delivery_routes')
    .select('points, distance_m, status')
    .eq('id', id)
    .single();

  if (readErr || !route) return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 });
  if (route.status !== 'active') {
    return NextResponse.json({ error: 'La ruta ya no está activa' }, { status: 409 });
  }

  const existing = (route.points as unknown as RoutePoint[]) ?? [];
  const merged = [...existing, ...clean];
  // Distancia añadida: desde el último punto previo hasta los nuevos.
  const tail = existing.length ? [existing[existing.length - 1], ...clean] : clean;
  const increment = pathDistance(tail);
  const last = clean[clean.length - 1];

  const { error: writeErr } = await supabaseAdmin
    .from('delivery_routes')
    .update({
      points: merged as unknown as Json,
      distance_m: (route.distance_m ?? 0) + increment,
      last_lat: last.lat,
      last_lng: last.lng,
      last_at: new Date(last.t).toISOString(),
    })
    .eq('id', id);

  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, added: clean.length, total: merged.length });
}
