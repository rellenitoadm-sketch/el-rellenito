import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { productStore } from '@/lib/productStore';
import { isAuthorized } from '@/lib/adminAuth';
import { slugify } from '@/lib/slugify';
import type { Product } from '@/lib/products';

/** Public read — all products (the client filters by availability/type). */
export async function GET() {
  const db = supabaseAdmin ?? supabase;
  if (!db) {
    return NextResponse.json(productStore.getAll());
  }
  const { data, error } = await db.from('products').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** Create a product — staff or admin. */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as Partial<Product> | null;
  if (!body || !body.name || !body.category) {
    return NextResponse.json({ error: 'Faltan campos requeridos (nombre, categoría)' }, { status: 400 });
  }

  const numOrNull = (v: unknown): number | null =>
    v == null || v === '' ? null : Number(v) || null;

  const row: Omit<Product, 'id'> = {
    name: body.name,
    units: body.units ?? null,
    description: body.description ?? '',
    category: body.category,
    type: body.type ?? 'detal',
    price_usd: Number(body.price_usd) || 0,
    wholesale_price_usd: Number(body.wholesale_price_usd ?? body.price_usd) || 0,
    price_cop: numOrNull(body.price_cop),
    wholesale_price_cop: numOrNull(body.wholesale_price_cop),
    available: body.available ?? true,
    image_url: body.image_url ?? null,
    is_best_seller: body.is_best_seller ?? false,
  };

  const db = supabaseAdmin ?? supabase;
  if (!db) {
    return NextResponse.json(productStore.insert(row), { status: 201 });
  }

  // products.id is a TEXT slug (not auto-generated) → derive a unique one.
  // Fetch all existing ids that share the base in ONE query, then pick the
  // first free suffix in memory (avoids a sequential SELECT per candidate).
  const baseId = body.id?.trim() || slugify(body.name);
  const { data: existing } = await db
    .from('products')
    .select('id')
    .like('id', `${baseId}%`);
  const taken = new Set((existing ?? []).map(r => r.id));
  let id = baseId;
  for (let n = 2; taken.has(id); n++) id = `${baseId}-${n}`;

  const { data, error } = await db.from('products').insert([{ id, ...row }]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
