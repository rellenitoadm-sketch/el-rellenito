import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { productStore } from '@/lib/productStore';
import { isAuthorized } from '@/lib/adminAuth';
import type { Product } from '@/lib/products';

/** Update a product — staff or admin. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Partial<Product>;

  // Whitelist editable fields; coerce numbers.
  const patch: Partial<Product> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.units !== undefined) patch.units = body.units;
  if (body.description !== undefined) patch.description = body.description;
  if (body.category !== undefined) patch.category = body.category;
  if (body.type !== undefined) patch.type = body.type;
  if (body.price_usd !== undefined) patch.price_usd = Number(body.price_usd) || 0;
  if (body.wholesale_price_usd !== undefined) patch.wholesale_price_usd = Number(body.wholesale_price_usd) || 0;
  if (body.price_cop !== undefined) patch.price_cop = body.price_cop == null || (body.price_cop as unknown) === '' ? null : Number(body.price_cop) || null;
  if (body.wholesale_price_cop !== undefined) patch.wholesale_price_cop = body.wholesale_price_cop == null || (body.wholesale_price_cop as unknown) === '' ? null : Number(body.wholesale_price_cop) || null;
  if (body.limite_unidades_mayor !== undefined) patch.limite_unidades_mayor = body.limite_unidades_mayor == null || (body.limite_unidades_mayor as unknown) === '' ? 10 : Math.max(1, Math.round(Number(body.limite_unidades_mayor))) || 10;
  if (body.available !== undefined) patch.available = body.available;
  if (body.image_url !== undefined) patch.image_url = body.image_url;
  if (body.is_best_seller !== undefined) patch.is_best_seller = body.is_best_seller;
  if (body.cobra_frito !== undefined) patch.cobra_frito = !!body.cobra_frito;

  const db = supabaseAdmin ?? supabase;
  if (!db) {
    const updated = productStore.update(id, patch);
    if (!updated) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(updated);
  }
  const { data, error } = await db.from('products').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** Delete a product — staff or admin. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = supabaseAdmin ?? supabase;
  if (!db) {
    const ok = productStore.remove(id);
    if (!ok) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ success: true });
  }
  const { error } = await db.from('products').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
