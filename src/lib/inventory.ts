/**
 * Inventario de producto terminado, por día. Tipos y cuentas compartidas entre
 * las rutas de `/api/admin/inventory` y el panel del equipo. Sin dependencias
 * de servidor.
 *
 * La existencia de un día es la suma de los movimientos de ese día: la
 * producción entra en positivo y las ventas y mermas salen en negativo. Llegar
 * a cero no bloquea la venta (decisión del negocio): solo avisa.
 */

import { lineKey } from './wholesaleOrders';

export type StockKind = 'produccion' | 'venta' | 'venta_mayorista' | 'merma' | 'ajuste' | 'devolucion';

/** Movimientos que registra una persona a mano, y que puede deshacer. */
export const MANUAL_KINDS: StockKind[] = ['produccion', 'merma', 'ajuste'];

export interface StockLine {
  product_id: string;
  flavor_id: string | null;
  qty: number;
  name?: string | null;
}

export interface StockMovement {
  id: string;
  day: string;
  product_id: string;
  product_name: string | null;
  flavor_id: string | null;
  flavor_name: string | null;
  qty: number;
  kind: StockKind;
  order_id: string | null;
  wholesale_order_id: string | null;
  note: string | null;
  actor: string | null;
  created_at: string;
}

/** Una fila de la pantalla de inventario: un producto, o un sabor de un producto. */
export interface StockRow {
  key: string;
  product_id: string;
  flavor_id: string | null;
  name: string;
  category: string | null;
  producido: number;
  vendido: number;
  mermas: number;
  disponible: number;
  umbral: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Unidades: entero mayor que cero, o nada. */
export function cleanQty(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** El sabor es una columna uuid: lo que no lo sea entra como "sin sabor". */
export function cleanFlavorId(v: unknown): string | null {
  return typeof v === 'string' && UUID.test(v.trim()) ? v.trim() : null;
}

/**
 * Líneas de un pedido de la web. Sus ítems traen el sabor pegado al producto
 * (`producto::sabor`), que es como los guarda el carrito.
 */
export function parseWebItems(items: unknown): StockLine[] {
  if (!Array.isArray(items)) return [];
  const out: StockLine[] = [];
  for (const raw of items as Record<string, unknown>[]) {
    const id = typeof raw?.id === 'string' ? raw.id : '';
    if (!id) continue;
    const [productId, flavorPart] = id.split('::');
    const qty = cleanQty(raw?.qty);
    if (!productId || qty === 0) continue;
    out.push({
      product_id: productId,
      flavor_id: cleanFlavorId(flavorPart),
      qty,
      name: typeof raw?.name === 'string' ? raw.name : null,
    });
  }
  return merge(out);
}

/** Líneas de un pedido mayorista: ya vienen con producto y sabor separados. */
export function parseWholesaleItems(items: unknown): StockLine[] {
  if (!Array.isArray(items)) return [];
  const out: StockLine[] = [];
  for (const raw of items as Record<string, unknown>[]) {
    const productId = typeof raw?.product_id === 'string' ? raw.product_id : '';
    const qty = cleanQty(raw?.qty);
    if (!productId || qty === 0) continue;
    out.push({
      product_id: productId,
      flavor_id: cleanFlavorId(raw?.flavor_id),
      qty,
      name: typeof raw?.name === 'string' ? raw.name : null,
    });
  }
  return merge(out);
}

/** Dos líneas del mismo producto y sabor son una sola: el candado anti-doble es por línea. */
function merge(lines: StockLine[]): StockLine[] {
  const by = new Map<string, StockLine>();
  for (const l of lines) {
    const k = lineKey(l.product_id, l.flavor_id);
    const prev = by.get(k);
    if (prev) prev.qty += l.qty;
    else by.set(k, { ...l });
  }
  return [...by.values()];
}

export const stockKey = lineKey;

/** Suma los movimientos del día por producto y sabor. */
export function summarize(movements: StockMovement[]): Map<string, {
  producido: number; vendido: number; mermas: number; disponible: number;
}> {
  const by = new Map<string, { producido: number; vendido: number; mermas: number; disponible: number }>();
  for (const m of movements) {
    const k = stockKey(m.product_id, m.flavor_id);
    const row = by.get(k) ?? { producido: 0, vendido: 0, mermas: 0, disponible: 0 };
    const qty = Number(m.qty);
    row.disponible += qty;
    if (m.kind === 'produccion') row.producido += qty;
    else if (m.kind === 'venta' || m.kind === 'venta_mayorista') row.vendido += -qty;
    else if (m.kind === 'devolucion') row.vendido -= qty;
    else if (m.kind === 'merma') row.mermas += -qty;
    else if (m.kind === 'ajuste') row.producido += qty;
    by.set(k, row);
  }
  return by;
}

/** Nada cargado hoy no es "agotado": es que todavía no han cargado la producción. */
export function stockState(row: Pick<StockRow, 'producido' | 'disponible' | 'umbral'>): 'sin_cargar' | 'agotado' | 'bajo' | 'ok' {
  if (row.producido === 0 && row.disponible === 0) return 'sin_cargar';
  if (row.disponible <= 0) return 'agotado';
  if (row.disponible <= row.umbral) return 'bajo';
  return 'ok';
}

export const KIND_LABEL: Record<StockKind, string> = {
  produccion: 'Producción',
  venta: 'Venta web',
  venta_mayorista: 'Venta al mayor',
  merma: 'Merma',
  ajuste: 'Ajuste',
  devolucion: 'Devolución',
};
