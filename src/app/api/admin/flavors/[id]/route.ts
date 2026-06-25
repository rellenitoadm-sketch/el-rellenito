import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';

interface Body { name?: string; active?: boolean; sort_order?: number }

/** Editar un sabor — SOLO admin. */
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
  if (body.active !== undefined) patch.active = body.active;
  if (body.sort_order !== undefined) patch.sort_order = body.sort_order;

  const { data, error } = await supabaseAdmin.from('flavors').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** Eliminar un sabor (se quita de todos los productos) — SOLO admin. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const { id } = await params;
  const { error } = await supabaseAdmin.from('flavors').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
