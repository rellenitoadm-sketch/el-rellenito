import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';

/** Finaliza una ruta activa. Equipo o admin. */
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

  const { error } = await supabaseAdmin
    .from('delivery_routes')
    .update({ status: 'done', ended_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'active');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
