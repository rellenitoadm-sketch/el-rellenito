import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/adminAuth';
import { listCategories, createCategory, updateCategory, deleteCategory } from '@/lib/categories';

export const dynamic = 'force-dynamic';

/** Admin/staff: lista TODAS las categorías (incluye inactivas) para gestionarlas. */
export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await listCategories(true));
}

/** Crear categoría. */
export async function POST(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { label?: string; emoji?: string } | null;
  if (!body?.label?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  const result = await createCategory(body.label, body.emoji ?? '🍽️');
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}

/** Editar categoría (label / emoji / orden / activo). */
export async function PATCH(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as
    | { key?: string; label?: string; emoji?: string; sort_order?: number; active?: boolean }
    | null;
  if (!body?.key) return NextResponse.json({ error: 'Falta la categoría' }, { status: 400 });
  const result = await updateCategory(body.key, body);
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}

/** Eliminar categoría (bloquea si hay productos usándola). */
export async function DELETE(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { key?: string } | null;
  if (!body?.key) return NextResponse.json({ error: 'Falta la categoría' }, { status: 400 });
  const result = await deleteCategory(body.key);
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
