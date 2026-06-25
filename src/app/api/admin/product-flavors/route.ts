import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';

/**
 * Asignación de sabores a un producto — SOLO admin.
 * GET ?product=ID → todos los sabores con su estado de asignación para ese producto.
 * PUT → reemplaza el conjunto de sabores asignados al producto.
 *   El flag products.has_flavors lo mantiene un trigger en la BD.
 */
export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json([]);

  const productId = new URL(request.url).searchParams.get('product')?.trim();
  if (!productId) return NextResponse.json({ error: 'Falta el producto' }, { status: 400 });

  const [{ data: flavors }, { data: pf }] = await Promise.all([
    supabaseAdmin.from('flavors').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabaseAdmin.from('product_flavors').select('flavor_id, available, sort_order').eq('product_id', productId),
  ]);

  const byId = new Map((pf ?? []).map(r => [r.flavor_id, r]));
  const out = (flavors ?? []).map(f => ({
    id: f.id,
    name: f.name,
    active: f.active,
    assigned: byId.has(f.id),
    available: byId.get(f.id)?.available ?? true,
    sort_order: byId.get(f.id)?.sort_order ?? 0,
  }));
  return NextResponse.json(out);
}

export async function PUT(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const body = await request.json().catch(() => ({})) as {
    product_id?: string;
    flavors?: { flavor_id: string; available?: boolean; sort_order?: number }[];
  };
  const productId = (body.product_id ?? '').trim();
  if (!productId) return NextResponse.json({ error: 'Falta el producto' }, { status: 400 });

  const rows = (body.flavors ?? [])
    .filter(f => f && f.flavor_id)
    .map((f, i) => ({
      product_id: productId,
      flavor_id: f.flavor_id,
      available: f.available ?? true,
      sort_order: f.sort_order ?? i,
    }));

  // Reemplaza el conjunto: borra los actuales e inserta los nuevos.
  const del = await supabaseAdmin.from('product_flavors').delete().eq('product_id', productId);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });

  if (rows.length > 0) {
    const ins = await supabaseAdmin.from('product_flavors').insert(rows);
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, count: rows.length });
}
