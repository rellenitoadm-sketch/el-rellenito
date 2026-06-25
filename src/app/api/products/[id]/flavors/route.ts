import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import type { Flavor } from '@/lib/flavors';

/**
 * Sabores DISPONIBLES de un producto (para el modal del cliente).
 * Lectura pública vía el cliente del servidor; devuelve solo sabores activos y
 * marcados como disponibles para ese producto, en su orden configurado.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = supabaseAdmin ?? supabase;
  if (!db) return NextResponse.json([] as Flavor[]);

  const { data: pf } = await db
    .from('product_flavors')
    .select('flavor_id, sort_order')
    .eq('product_id', id)
    .eq('available', true);

  if (!pf || pf.length === 0) return NextResponse.json([] as Flavor[]);

  const orderById = new Map(pf.map(r => [r.flavor_id, r.sort_order]));
  const ids = pf.map(r => r.flavor_id);

  const { data: fl } = await db
    .from('flavors')
    .select('id, name, active')
    .in('id', ids)
    .eq('active', true);

  const out: Flavor[] = (fl ?? [])
    .map(f => ({ id: f.id, name: f.name }))
    .sort((a, b) =>
      (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0) ||
      a.name.localeCompare(b.name, 'es'),
    );

  return NextResponse.json(out);
}
