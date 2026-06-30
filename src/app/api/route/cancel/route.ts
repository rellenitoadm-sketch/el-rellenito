import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';

/**
 * Elimina una ruta (la borra por completo) y, si estaba ligada a un pedido en
 * camino, devuelve ese pedido a "confirmado" para que vuelva a aparecer en
 * "por entregar". Lo usa el domiciliario para cancelar una ruta. Equipo o admin.
 */
export async function POST(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({})) as { id?: string };
  const id = (body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'Falta el id de la ruta' }, { status: 400 });

  // Recupera el pedido ligado antes de borrar, para revertir su estado.
  const { data: route } = await supabaseAdmin
    .from('delivery_routes')
    .select('order_id')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabaseAdmin.from('delivery_routes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // El pedido vuelve a "por entregar" solo si seguía en camino (no si ya se entregó).
  if (route?.order_id) {
    await supabaseAdmin
      .from('orders')
      .update({ status: 'confirmado' })
      .eq('id', route.order_id)
      .eq('status', 'en_camino');
  }

  return NextResponse.json({ ok: true });
}
