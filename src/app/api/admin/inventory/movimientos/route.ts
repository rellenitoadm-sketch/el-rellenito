import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import { caracasDate, isYmd } from '@/lib/wholesaleOrders';
import { cleanText } from '@/lib/wholesaleOrders.server';
import { cleanFlavorId, stockKey } from '@/lib/inventory';
import { alertIfEmpty, dayStock } from '@/lib/inventory.server';

const MAX_QTY = 100_000;

/**
 * Registra un movimiento suelto del día. Equipo o admin, con los mismos permisos.
 * - `produccion`: salió más del horno. Siempre suma.
 * - `merma`: se dañó, se regaló o se consumió en la casa. Siempre resta.
 * - `ajuste`: corrección de conteo; puede sumar o restar (`qty` con signo).
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

  const kind = body.kind === 'ajuste' || body.kind === 'produccion' ? body.kind : 'merma';
  const productId = typeof body.product_id === 'string' ? body.product_id.trim() : '';
  if (!productId) return NextResponse.json({ error: 'Elige el producto.' }, { status: 400 });
  const flavorId = cleanFlavorId(body.flavor_id);

  const raw = Math.floor(Number(body.qty));
  if (!Number.isFinite(raw) || raw === 0 || Math.abs(raw) > MAX_QTY) {
    return NextResponse.json({ error: 'Escribe cuántas unidades.' }, { status: 400 });
  }
  // La merma siempre resta y la producción siempre suma, aunque lleguen con el
  // signo cambiado; el ajuste es el único que respeta el signo que le mandan.
  const qty = kind === 'merma' ? -Math.abs(raw) : kind === 'produccion' ? Math.abs(raw) : raw;

  try {
    const { rows } = await dayStock(db, date);
    const key = stockKey(productId, flavorId);
    const fila = rows.find(r => r.key === key);

    const { error } = await db.from('stock_movements').insert({
      day: date,
      product_id: productId,
      product_name: fila?.name ?? null,
      flavor_id: flavorId,
      qty,
      kind,
      note: cleanText(body.note),
      actor: cleanText(body.actor, 80),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Una merma también puede dejar un producto en cero: avisa igual que una venta.
    if (qty < 0) await alertIfEmpty(db, date, [{ product_id: productId, flavor_id: flavorId, qty: -qty }]);

    const fresco = await dayStock(db, date);
    return NextResponse.json({ date, today: caracasDate(), rows: fresco.rows, movements: fresco.movements }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo registrar' }, { status: 500 });
  }
}
