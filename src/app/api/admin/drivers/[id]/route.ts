import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';

interface Body { name?: string; phone?: string | null; active?: boolean }

/** Editar un domiciliario — SOLO admin. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Body;
  const patch: Body = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: 'El nombre no puede quedar vacío' }, { status: 400 });
    patch.name = name;
  }
  if (body.phone !== undefined) patch.phone = body.phone?.trim() || null;
  if (body.active !== undefined) patch.active = body.active;

  const { data, error } = await supabaseAdmin.from('drivers').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** Eliminar un domiciliario — SOLO admin. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const { id } = await params;
  const { error } = await supabaseAdmin.from('drivers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
