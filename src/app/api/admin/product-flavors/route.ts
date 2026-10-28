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
  /** Sabor ya existente de este producto: se actualiza en vez de recrearse. */
  flavor_id?: string;
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

  // Sabores actuales del producto.
  const { data: existing } = await supabaseAdmin
    .from('product_flavors')
    .select('flavor_id')
    .eq('product_id', productId);
  const currentIds = new Set((existing ?? []).map(r => r.flavor_id));

  // Los sabores que ya existen CONSERVAN su id (si no, el inventario del día y su
  // historial —que se llevan por sabor— quedarían huérfanos con cada guardado).
  const keep = incoming.filter(f => f.flavor_id && currentIds.has(f.flavor_id));
  const keepIds = new Set(keep.map(f => f.flavor_id as string));
  const fresh = incoming.filter(f => !(f.flavor_id && currentIds.has(f.flavor_id)));
  const removedIds = [...currentIds].filter(id => !keepIds.has(id));

  const prices = (f: FlavorInput) => ({
    price_usd: num(f.price_usd),
    price_cop: num(f.price_cop),
    wholesale_price_usd: num(f.wholesale_price_usd),
    wholesale_price_cop: num(f.wholesale_price_cop),
  });

  // 1) Sabores que siguen: actualiza nombre, orden y precios.
  for (const f of keep) {
    const i = incoming.indexOf(f);
    const r1 = await supabaseAdmin.from('flavors').update({ name: f.name, sort_order: i }).eq('id', f.flavor_id as string);
    if (r1.error) return NextResponse.json({ error: r1.error.message }, { status: 500 });
    const r2 = await supabaseAdmin.from('product_flavors')
      .update({ sort_order: i, available: true, ...prices(f) })
      .eq('product_id', productId).eq('flavor_id', f.flavor_id as string);
    if (r2.error) return NextResponse.json({ error: r2.error.message }, { status: 500 });
  }

  // 2) Sabores quitados: se sueltan del producto y se borran si ningún otro los usa.
  if (removedIds.length > 0) {
    const delPf = await supabaseAdmin.from('product_flavors').delete().eq('product_id', productId).in('flavor_id', removedIds);
    if (delPf.error) return NextResponse.json({ error: delPf.error.message }, { status: 500 });
    const { data: stillUsed } = await supabaseAdmin.from('product_flavors').select('flavor_id').in('flavor_id', removedIds);
    const usedSet = new Set((stillUsed ?? []).map(r => r.flavor_id));
    const orphans = removedIds.filter(id => !usedSet.has(id));
    if (orphans.length > 0) await supabaseAdmin.from('flavors').delete().in('id', orphans);
  }

  // 3) Sabores nuevos: uno por uno, para que cada uno quede con su id y su precio.
  for (const f of fresh) {
    const i = incoming.indexOf(f);
    const { data: created, error: insFlavorErr } = await supabaseAdmin
      .from('flavors')
      .insert({ name: f.name, sort_order: i })
      .select('id')
      .single();
    if (insFlavorErr || !created) {
      return NextResponse.json({ error: insFlavorErr?.message ?? 'No se pudieron crear los sabores' }, { status: 500 });
    }
    const insPf = await supabaseAdmin.from('product_flavors').insert({
      product_id: productId, flavor_id: created.id, available: true, sort_order: i, ...prices(f),
    });
    if (insPf.error) return NextResponse.json({ error: insPf.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: incoming.length });
}
