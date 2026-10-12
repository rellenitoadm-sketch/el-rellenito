import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import { caracasDate, isYmd } from '@/lib/wholesaleOrders';
import { cleanText } from '@/lib/wholesaleOrders.server';
import { cleanFlavorId, stockKey, stockState } from '@/lib/inventory';
import { dayStock } from '@/lib/inventory.server';
import type { Database } from '@/lib/database.types';

type MovementInsert = Database['public']['Tables']['stock_movements']['Insert'];

const MAX_LINES = 400;
const MAX_QTY = 100_000;

/**
 * Inventario de producto terminado de un día: lo producido, lo vendido, las
 * mermas y lo que queda. Equipo o admin, con los mismos permisos.
 */
export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const param = request.nextUrl.searchParams.get('date');
  const date = isYmd(param) ? param : caracasDate();

  try {
    const { rows, movements } = await dayStock(supabaseAdmin, date);
    const resumen = {
      agotados: rows.filter(r => stockState(r) === 'agotado').length,
      bajos: rows.filter(r => stockState(r) === 'bajo').length,
      sinCargar: rows.filter(r => stockState(r) === 'sin_cargar').length,
      producido: rows.reduce((s, r) => s + r.producido, 0),
      vendido: rows.reduce((s, r) => s + r.vendido, 0),
      mermas: rows.reduce((s, r) => s + r.mermas, 0),
      disponible: rows.reduce((s, r) => s + r.disponible, 0),
    };
    return NextResponse.json({ date, today: caracasDate(), rows, movements, resumen });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo leer el inventario' }, { status: 500 });
  }
}

/**
 * Carga la producción del día. Se manda el total que salió del horno por
 * producto, no lo que se agrega: el servidor registra solo la diferencia contra
 * lo ya cargado, así guardar dos veces la misma planilla no duplica nada.
 */
export async function POST(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  const db = supabaseAdmin;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const date = body.date;
  if (!isYmd(date)) return NextResponse.json({ error: 'Fecha inválida.' }, { status: 400 });
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: 'No hay nada que cargar.' }, { status: 400 });
  }
  if (body.lines.length > MAX_LINES) {
    return NextResponse.json({ error: 'Demasiadas líneas en una sola carga.' }, { status: 400 });
  }
  const actor = cleanText(body.actor, 80);

  // Objetivo por producto/sabor: lo que el equipo dice que se produjo hoy.
  const target = new Map<string, { product_id: string; flavor_id: string | null; qty: number }>();
  for (const raw of body.lines as Record<string, unknown>[]) {
    const productId = typeof raw?.product_id === 'string' ? raw.product_id.trim() : '';
    if (!productId) return NextResponse.json({ error: 'Producto inválido.' }, { status: 400 });
    const qty = Math.floor(Number(raw?.qty));
    if (!Number.isFinite(qty) || qty < 0 || qty > MAX_QTY) {
      return NextResponse.json({ error: 'Las unidades deben ser un número entero de 0 en adelante.' }, { status: 400 });
    }
    const flavorId = cleanFlavorId(raw?.flavor_id);
    target.set(stockKey(productId, flavorId), { product_id: productId, flavor_id: flavorId, qty });
  }

  try {
    const { rows } = await dayStock(db, date);
    const yaCargado = new Map(rows.map(r => [r.key, r.producido]));
    const nombre = new Map(rows.map(r => [r.key, r.name]));

    const inserts: MovementInsert[] = [];
    for (const [key, line] of target) {
      const delta = line.qty - (yaCargado.get(key) ?? 0);
      if (delta === 0) continue;
      inserts.push({
        day: date,
        product_id: line.product_id,
        product_name: nombre.get(key) ?? null,
        flavor_id: line.flavor_id,
        qty: delta,
        kind: 'produccion',
        actor,
      });
    }

    if (inserts.length > 0) {
      const { error } = await db.from('stock_movements').insert(inserts);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const fresco = await dayStock(db, date);
    return NextResponse.json({ date, guardados: inserts.length, rows: fresco.rows, movements: fresco.movements }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo cargar la producción' }, { status: 500 });
  }
}
