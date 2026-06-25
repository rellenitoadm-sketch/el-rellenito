import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';

/**
 * Sabores de un producto, CON su precio — SOLO admin. Se gestionan desde el
 * editor del producto (no hay catálogo global de sabores: cada sabor pertenece a
 * su producto y lleva su propio precio).
 *
 * GET ?product=ID → los sabores del producto (nombre + precios).
 * PUT → reemplaza el conjunto de sabores del producto por el enviado.
 *   `products.has_flavors` lo mantiene un trigger en la BD.
 */
interface FlavorInput {
  name?: string;
  price_usd?: number | null;
  price_cop?: number | null;
  wholesale_price_usd?: number | null;
  wholesale_price_cop?: number | null;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json([]);

  const productId = new URL(request.url).searchParams.get('product')?.trim();
  if (!productId) return NextResponse.json({ error: 'Falta el producto' }, { status: 400 });

  const { data: pf } = await supabaseAdmin
    .from('product_flavors')
    .select('flavor_id, sort_order, price_usd, price_cop, wholesale_price_usd, wholesale_price_cop')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (!pf || pf.length === 0) return NextResponse.json([]);

  const ids = pf.map(r => r.flavor_id);
  const { data: fl } = await supabaseAdmin.from('flavors').select('id, name').in('id', ids);
  const nameById = new Map((fl ?? []).map(f => [f.id, f.name]));

  const out = pf.map(r => ({
    flavor_id: r.flavor_id,
    name: nameById.get(r.flavor_id) ?? '',
    price_usd: r.price_usd,
    price_cop: r.price_cop,
    wholesale_price_usd: r.wholesale_price_usd,
    wholesale_price_cop: r.wholesale_price_cop,
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
    flavors?: FlavorInput[];
  };
  const productId = (body.product_id ?? '').trim();
  if (!productId) return NextResponse.json({ error: 'Falta el producto' }, { status: 400 });

  const incoming = (body.flavors ?? [])
    .map(f => ({ ...f, name: (f.name ?? '').trim() }))
    .filter(f => f.name);

  // Sabores actuales del producto (para limpiar los suyos: son por-producto).
  const { data: existing } = await supabaseAdmin
    .from('product_flavors')
    .select('flavor_id')
    .eq('product_id', productId);
  const oldFlavorIds = (existing ?? []).map(r => r.flavor_id);

  // 1) Quita las asignaciones actuales del producto.
  const delPf = await supabaseAdmin.from('product_flavors').delete().eq('product_id', productId);
  if (delPf.error) return NextResponse.json({ error: delPf.error.message }, { status: 500 });

  // 2) Borra los sabores que quedaron huérfanos (ya no los usa ningún producto).
  if (oldFlavorIds.length > 0) {
    const { data: stillUsed } = await supabaseAdmin
      .from('product_flavors')
      .select('flavor_id')
      .in('flavor_id', oldFlavorIds);
    const usedSet = new Set((stillUsed ?? []).map(r => r.flavor_id));
    const orphans = oldFlavorIds.filter(id => !usedSet.has(id));
    if (orphans.length > 0) {
      await supabaseAdmin.from('flavors').delete().in('id', orphans);
    }
  }

  // 3) Crea los sabores nuevos (uno por nombre) y sus asignaciones con precio.
  if (incoming.length > 0) {
    const { data: created, error: insFlavorsErr } = await supabaseAdmin
      .from('flavors')
      .insert(incoming.map((f, i) => ({ name: f.name, sort_order: i })))
      .select('id, name');
    if (insFlavorsErr || !created) {
      return NextResponse.json({ error: insFlavorsErr?.message ?? 'No se pudieron crear los sabores' }, { status: 500 });
    }

    const rows = incoming.map((f, i) => ({
      product_id: productId,
      flavor_id: created[i].id,
      available: true,
      sort_order: i,
      price_usd: num(f.price_usd),
      price_cop: num(f.price_cop),
      wholesale_price_usd: num(f.wholesale_price_usd),
      wholesale_price_cop: num(f.wholesale_price_cop),
    }));
    const insPf = await supabaseAdmin.from('product_flavors').insert(rows);
    if (insPf.error) return NextResponse.json({ error: insPf.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: incoming.length });
}
