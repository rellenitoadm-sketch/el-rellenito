import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import type { PricedFlavor } from '@/lib/flavors';

/**
 * Sabores DISPONIBLES de un producto (para el modal del cliente), CON su precio.
 * Lectura pública vía el cliente del servidor; devuelve solo sabores activos y
 * marcados como disponibles para ese producto, en su orden configurado. Cada
 * sabor incluye su precio propio (null = usar el precio del producto base).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = supabaseAdmin ?? supabase;
  if (!db) return NextResponse.json([] as PricedFlavor[]);

  const { data: pf } = await db
    .from('product_flavors')
    .select('flavor_id, sort_order, price_usd, price_cop, wholesale_price_usd, wholesale_price_cop')
    .eq('product_id', id)
    .eq('available', true);

  if (!pf || pf.length === 0) return NextResponse.json([] as PricedFlavor[]);

  const byId = new Map(pf.map(r => [r.flavor_id, r]));
  const ids = pf.map(r => r.flavor_id);

  const { data: fl } = await db
    .from('flavors')
    .select('id, name, active')
    .in('id', ids)
    .eq('active', true);

  const out: PricedFlavor[] = (fl ?? [])
    .map(f => {
      const row = byId.get(f.id);
      return {
        id: f.id,
        name: f.name,
        price_usd: row?.price_usd ?? null,
        price_cop: row?.price_cop ?? null,
        wholesale_price_usd: row?.wholesale_price_usd ?? null,
        wholesale_price_cop: row?.wholesale_price_cop ?? null,
      };
    })
    .sort((a, b) =>
      (byId.get(a.id)?.sort_order ?? 0) - (byId.get(b.id)?.sort_order ?? 0) ||
      a.name.localeCompare(b.name, 'es'),
    );

  return NextResponse.json(out);
}
