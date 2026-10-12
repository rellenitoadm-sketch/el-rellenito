import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { sendPushToAll } from './push';
import {
  MANUAL_KINDS,
  stockKey,
  summarize,
  type StockKind,
  type StockLine,
  type StockMovement,
  type StockRow,
} from './inventory';

type Db = SupabaseClient<Database>;
type MovementRow = Database['public']['Tables']['stock_movements']['Row'];
type MovementInsert = Database['public']['Tables']['stock_movements']['Insert'];

/** Clave duplicada: el movimiento de ese pedido ya estaba registrado. */
const DUPLICATE = '23505';

function toMovement(r: MovementRow): StockMovement {
  return {
    id: r.id,
    day: r.day,
    product_id: r.product_id,
    product_name: r.product_name,
    flavor_id: r.flavor_id,
    flavor_name: r.flavor_name,
    qty: Number(r.qty),
    kind: r.kind as StockKind,
    order_id: r.order_id,
    wholesale_order_id: r.wholesale_order_id,
    note: r.note,
    actor: r.actor,
    created_at: r.created_at,
  };
}

/**
 * Inserta movimientos uno por uno y deja pasar los duplicados. El índice único
 * de la migración 006 es el que garantiza que un pedido descuente una sola vez:
 * si se insertara el lote completo, un solo choque tumbaría las demás líneas.
 */
async function insertIgnoringDuplicates(db: Db, rows: MovementInsert[]): Promise<number> {
  let written = 0;
  for (const row of rows) {
    const { error } = await db.from('stock_movements').insert(row);
    if (!error) written += 1;
    else if (error.code !== DUPLICATE) throw new Error(error.message);
  }
  return written;
}

interface SaleArgs {
  day: string;
  lines: StockLine[];
  orderId?: string | null;
  wholesaleOrderId?: string | null;
  actor?: string | null;
}

/** Descuenta las líneas de un pedido. Repetirlo no descuenta de nuevo. */
export async function recordSale(db: Db, args: SaleArgs): Promise<void> {
  const kind: StockKind = args.wholesaleOrderId ? 'venta_mayorista' : 'venta';
  const rows: MovementInsert[] = args.lines.map(l => ({
    day: args.day,
    product_id: l.product_id,
    product_name: l.name ?? null,
    flavor_id: l.flavor_id,
    qty: -Math.abs(l.qty),
    kind,
    order_id: args.orderId ?? null,
    wholesale_order_id: args.wholesaleOrderId ?? null,
    actor: args.actor ?? null,
  }));
  await insertIgnoringDuplicates(db, rows);
}

/**
 * Devuelve al inventario lo que un pedido había descontado (se canceló). No
 * borra la venta: deja la devolución al lado, para que el historial del día
 * cuente lo que de verdad pasó.
 */
export async function releaseSale(db: Db, args: SaleArgs): Promise<void> {
  const rows: MovementInsert[] = args.lines.map(l => ({
    day: args.day,
    product_id: l.product_id,
    product_name: l.name ?? null,
    flavor_id: l.flavor_id,
    qty: Math.abs(l.qty),
    kind: 'devolucion',
    order_id: args.orderId ?? null,
    wholesale_order_id: args.wholesaleOrderId ?? null,
    note: 'Pedido cancelado',
    actor: args.actor ?? null,
  }));
  await insertIgnoringDuplicates(db, rows);
}

/**
 * Un pedido que vuelve de "cancelado" tiene que descontar otra vez: se quitan
 * sus devoluciones y la venta original vuelve a mandar.
 */
export async function reapplySale(db: Db, ids: { orderId?: string | null; wholesaleOrderId?: string | null }): Promise<void> {
  let q = db.from('stock_movements').delete().eq('kind', 'devolucion');
  q = ids.orderId ? q.eq('order_id', ids.orderId) : q.eq('wholesale_order_id', ids.wholesaleOrderId ?? '');
  const { error } = await q;
  if (error) throw new Error(error.message);
}

/** Borra todos los movimientos de un pedido (se editaron sus ítems o su fecha). */
export async function clearOrderMovements(
  db: Db,
  ids: { orderId?: string | null; wholesaleOrderId?: string | null },
): Promise<void> {
  const q = db.from('stock_movements').delete();
  const { error } = ids.orderId
    ? await q.eq('order_id', ids.orderId)
    : await q.eq('wholesale_order_id', ids.wholesaleOrderId ?? '');
  if (error) throw new Error(error.message);
}

/** Movimientos de un día, del más nuevo al más viejo. */
export async function dayMovements(db: Db, day: string): Promise<StockMovement[]> {
  const { data, error } = await db
    .from('stock_movements')
    .select('*')
    .eq('day', day)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toMovement);
}

interface CatalogEntry {
  product_id: string;
  flavor_id: string | null;
  name: string;
  category: string | null;
  umbral: number;
  sort: number;
}

/**
 * Productos y sabores disponibles, que son las filas que se cuentan. Los
 * productos de solo retiro (`type` detal/mayorista) también se producen, así
 * que no se filtra por tipo: se filtra por disponible.
 */
export async function loadCatalog(db: Db): Promise<CatalogEntry[]> {
  const [{ data: products, error: pErr }, { data: pf }, { data: flavors }] = await Promise.all([
    db.from('products').select('id, name, category, available, has_flavors, low_stock_threshold').eq('available', true),
    db.from('product_flavors').select('product_id, flavor_id, available, sort_order').eq('available', true),
    db.from('flavors').select('id, name, active').eq('active', true),
  ]);
  if (pErr) throw new Error(pErr.message);

  const flavorName = new Map((flavors ?? []).map(f => [f.id, f.name]));
  const byProduct = new Map<string, { flavor_id: string; sort: number }[]>();
  for (const row of pf ?? []) {
    if (!flavorName.has(row.flavor_id)) continue;
    const list = byProduct.get(row.product_id) ?? [];
    list.push({ flavor_id: row.flavor_id, sort: row.sort_order ?? 0 });
    byProduct.set(row.product_id, list);
  }

  const out: CatalogEntry[] = [];
  for (const p of products ?? []) {
    const umbral = Number(p.low_stock_threshold ?? 0);
    const sabores = byProduct.get(p.id) ?? [];
    if (p.has_flavors && sabores.length > 0) {
      // Con sabores se cuenta por sabor: el de queso y el de jamón salen del
      // horno por separado y se acaban por separado.
      for (const s of sabores.sort((a, b) => a.sort - b.sort)) {
        out.push({
          product_id: p.id,
          flavor_id: s.flavor_id,
          name: `${p.name} · ${flavorName.get(s.flavor_id)}`,
          category: p.category,
          umbral,
          sort: s.sort,
        });
      }
    } else {
      out.push({ product_id: p.id, flavor_id: null, name: p.name, category: p.category, umbral, sort: 0 });
    }
  }
  return out;
}

/**
 * Estado del día: una fila por producto (o sabor) con lo producido, lo vendido,
 * las mermas y lo que queda. Incluye lo que ya no está en el catálogo pero tuvo
 * movimientos ese día, para que ningún movimiento quede invisible.
 */
export async function dayStock(db: Db, day: string): Promise<{ rows: StockRow[]; movements: StockMovement[] }> {
  const [catalog, movements] = await Promise.all([loadCatalog(db), dayMovements(db, day)]);
  const totals = summarize(movements);

  const rows: StockRow[] = catalog.map(c => {
    const t = totals.get(stockKey(c.product_id, c.flavor_id));
    return {
      key: stockKey(c.product_id, c.flavor_id),
      product_id: c.product_id,
      flavor_id: c.flavor_id,
      name: c.name,
      category: c.category,
      producido: t?.producido ?? 0,
      vendido: t?.vendido ?? 0,
      mermas: t?.mermas ?? 0,
      disponible: t?.disponible ?? 0,
      umbral: c.umbral,
    };
  });

  const known = new Set(rows.map(r => r.key));
  for (const m of movements) {
    const key = stockKey(m.product_id, m.flavor_id);
    if (known.has(key)) continue;
    known.add(key);
    const t = totals.get(key);
    rows.push({
      key,
      product_id: m.product_id,
      flavor_id: m.flavor_id,
      name: m.product_name ?? m.product_id,
      category: null,
      producido: t?.producido ?? 0,
      vendido: t?.vendido ?? 0,
      mermas: t?.mermas ?? 0,
      disponible: t?.disponible ?? 0,
      umbral: 0,
    });
  }

  return { rows, movements };
}

/**
 * Avisa al equipo de lo que se acabó por un pedido. Solo avisa de productos que
 * ya tenían producción cargada ese día — si no, cada mañana avisaría de todo— y
 * una sola vez por producto y día: el aviso se "reserva" en `stock_alerts` y
 * solo manda el push quien gana esa carrera.
 */
export async function alertIfEmpty(db: Db, day: string, lines: StockLine[]): Promise<void> {
  if (lines.length === 0) return;
  const { rows } = await dayStock(db, day);
  const affected = new Set(lines.map(l => stockKey(l.product_id, l.flavor_id)));

  for (const row of rows) {
    if (!affected.has(row.key)) continue;
    if (row.producido <= 0) continue;
    if (row.disponible > row.umbral) continue;

    const { error } = await db.from('stock_alerts').insert({
      day,
      product_id: row.product_id,
      flavor_id: row.flavor_id,
    });
    if (error) continue; // ya avisado (o no se pudo): no se repite el push

    await sendPushToAll({
      title: row.disponible <= 0 ? '📦 Se acabó' : '📦 Queda poco',
      body: row.disponible <= 0
        ? `${row.name}: no queda nada para hoy.`
        : `${row.name}: quedan ${row.disponible}.`,
      tag: `stock-${row.key}-${day}`,
      url: '/admin/dashboard',
    }).catch(() => { /* el aviso es best-effort */ });
  }
}

/** Descuenta y avisa, sin tumbar nunca la venta si el inventario falla. */
export async function registerSaleSafely(db: Db | null, args: SaleArgs): Promise<void> {
  if (!db || args.lines.length === 0) return;
  try {
    await recordSale(db, args);
    await alertIfEmpty(db, args.day, args.lines);
  } catch (err) {
    // Vender nunca se bloquea por el inventario: queda el rastro en el log.
    console.warn('Inventario (descuento):', err instanceof Error ? err.message : err);
  }
}

export const isManualKind = (kind: string): boolean => (MANUAL_KINDS as string[]).includes(kind);
