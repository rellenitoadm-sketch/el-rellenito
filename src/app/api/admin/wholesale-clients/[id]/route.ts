import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';

interface UpdateBody {
  name?: string;
  phone?: string | null;
  address?: string | null;
  route?: string | null;
  area?: string | null;
  notes?: string | null;
  active?: boolean;
}

/** Editar un cliente al mayor — SOLO admin. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as UpdateBody;

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  }

  // Solo campos permitidos (sin asignación masiva).
  const patch: UpdateBody & { updated_at: string } = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: 'El nombre no puede quedar vacío' }, { status: 400 });
    patch.name = name;
  }
  if (body.phone !== undefined) patch.phone = body.phone?.trim() || null;
  if (body.address !== undefined) patch.address = body.address?.trim() || null;
  if (body.route !== undefined) patch.route = body.route?.trim() || null;
  if (body.area !== undefined) patch.area = body.area?.trim() || null;
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;
  if (body.active !== undefined) patch.active = body.active;

  const { data, error } = await supabaseAdmin
    .from('wholesale_clients')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** Eliminar un cliente al mayor — SOLO admin. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  }

  const { error } = await supabaseAdmin.from('wholesale_clients').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
