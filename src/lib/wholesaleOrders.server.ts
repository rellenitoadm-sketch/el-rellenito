import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import {
  lineKey,
  orderTotals,
  wholesaleUnitPrices,
  type StoredRates,
  type WholesaleOrder,
  type WholesaleOrderItem,
  type WholesalePayment,
} from './wholesaleOrders';

type Db = SupabaseClient<Database>;
type OrderRow = Database['public']['Tables']['wholesale_orders']['Row'];
type PaymentRow = Database['public']['Tables']['wholesale_payments']['Row'];

/** Error de datos del formulario: la ruta lo devuelve como 400 con su mensaje. */
export class OrderInputError extends Error {}

const MAX_LINES = 100;
const MAX_QTY = 100_000;

export async function getStoredRates(db: Db): Promise<StoredRates | null> {
  const { data } = await db.from('app_rates').select('bs_per_usd, cop_per_usd').eq('id', 1).maybeSingle();
  if (!data) return null;
  return { bs_per_usd: Number(data.bs_per_usd), cop_per_usd: Number(data.cop_per_usd) };
}

/**
 * Convierte las líneas del formulario en ítems con precio de catálogo. Los
 * precios que mande el navegador se ignoran: un teléfono con el catálogo viejo
 * en caché no puede guardar un pedido con precios equivocados.
 */
export async function priceItems(
  db: Db,
  raw: unknown,
  copPerUsd: number | null,
): Promise<{ items: WholesaleOrderItem[]; total_usd: number; total_cop: number }> {
  if (!Array.isArray(raw) || raw.length === 0) throw new OrderInputError('Agrega al menos un producto.');
  if (raw.length > MAX_LINES) throw new OrderInputError('Demasiados productos en un solo pedido.');

  const merged = new Map<string, { product_id: string; flavor_id: string | null; qty: number }>();
  for (const line of raw as Record<string, unknown>[]) {
    const productId = typeof line?.product_id === 'string' ? line.product_id.trim() : '';
    const flavorId = typeof line?.flavor_id === 'string' && line.flavor_id.trim() ? line.flavor_id.trim() : null;
    const qty = Number(line?.qty);
    if (!productId) throw new OrderInputError('Producto inválido.');
    if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_QTY) {
      throw new OrderInputError('Las unidades deben ser un número entero mayor que cero.');
    }
    const key = lineKey(productId, flavorId);
    const prev = merged.get(key);
    merged.set(key, { product_id: productId, flavor_id: flavorId, qty: (prev?.qty ?? 0) + qty });
  }
  const lines = [...merged.values()];

  const productIds = [...new Set(lines.map(l => l.product_id))];
  const { data: products, error: pErr } = await db
    .from('products')
    .select('id, name, type, available, has_flavors, wholesale_price_usd, wholesale_price_cop')
    .in('id', productIds);
  if (pErr) throw new Error(pErr.message);
  const productById = new Map((products ?? []).map(p => [p.id, p]));

  const flavoredIds = (products ?? []).filter(p => p.has_flavors).map(p => p.id);
  const { data: pfRows } = flavoredIds.length
    ? await db
      .from('product_flavors')
      .select('product_id, flavor_id, available, price_usd, price_cop, wholesale_price_usd, wholesale_price_cop')
      .in('product_id', flavoredIds)
      .eq('available', true)
    : { data: [] };
  const flavorIds = [...new Set((pfRows ?? []).map(r => r.flavor_id))];
  const { data: flavorRows } = flavorIds.length
    ? await db.from('flavors').select('id, name').in('id', flavorIds).eq('active', true)
    : { data: [] };
  const flavorName = new Map((flavorRows ?? []).map(f => [f.id, f.name]));
  // Solo cuentan los sabores disponibles en el producto Y activos en el catálogo.
  const pfByKey = new Map(
    (pfRows ?? []).filter(r => flavorName.has(r.flavor_id)).map(r => [lineKey(r.product_id, r.flavor_id), r]),
  );
  const productHasFlavors = new Set((pfRows ?? []).filter(r => flavorName.has(r.flavor_id)).map(r => r.product_id));

  const items: WholesaleOrderItem[] = [];
  for (const line of lines) {
    const p = productById.get(line.product_id);
    if (!p) throw new OrderInputError('Uno de los productos ya no existe. Recarga el catálogo.');
    if (!p.available) throw new OrderInputError(`${p.name} no está disponible.`);
    if (p.type === 'detal') throw new OrderInputError(`${p.name} no se vende al mayor.`);

    let flavor = null;
    let name = p.name;
    if (line.flavor_id) {
      flavor = pfByKey.get(lineKey(p.id, line.flavor_id)) ?? null;
      if (!flavor) throw new OrderInputError(`Ese sabor de ${p.name} ya no está disponible.`);
      name = `${p.name} · ${flavorName.get(line.flavor_id)}`;
    } else if (productHasFlavors.has(p.id)) {
      throw new OrderInputError(`Elige el sabor de ${p.name}.`);
    }

    const needsRate = (flavor
      ? (flavor.wholesale_price_cop ?? flavor.price_cop ?? p.wholesale_price_cop)
      : p.wholesale_price_cop) == null;
    if (needsRate && !copPerUsd) {
      throw new OrderInputError(`${p.name} no tiene precio en pesos y no hay tasa guardada para convertirlo.`);
    }

    const prices = wholesaleUnitPrices(p, flavor, copPerUsd ?? 0);
    if (!(prices.unit_usd > 0) && !(prices.unit_cop > 0)) {
      throw new OrderInputError(`${name} no tiene precio al mayor.`);
    }
    items.push({ product_id: p.id, flavor_id: line.flavor_id, name, qty: line.qty, ...prices });
  }

  const totals = orderTotals(items);
  if (totals.total_usd <= 0 || totals.total_cop <= 0) throw new OrderInputError('El pedido quedó en cero.');
  return { items, ...totals };
}

/**
 * Suma los pagos del pedido y guarda el resultado en `paid_share`. Devuelve la
 * suma sin recortar, para detectar dos cobros registrados a la vez.
 */
export async function recomputePaidShare(db: Db, orderId: string): Promise<number> {
  const { data } = await db.from('wholesale_payments').select('share').eq('order_id', orderId);
  const sum = (data ?? []).reduce((s, r) => s + Number(r.share), 0);
  const paid = Math.min(1, Math.round(sum * 1e8) / 1e8);
  await db.from('wholesale_orders').update({ paid_share: paid }).eq('id', orderId);
  return sum;
}

function toPayment(r: PaymentRow): WholesalePayment {
  return {
    id: r.id,
    order_id: r.order_id,
    collected_on: r.collected_on,
    outcome: r.outcome as WholesalePayment['outcome'],
    currency: r.currency as WholesalePayment['currency'],
    amount: Number(r.amount),
    rate_ves: r.rate_ves == null ? null : Number(r.rate_ves),
    share: Number(r.share),
    driver_id: r.driver_id,
    driver_name: r.driver_name,
    note: r.note,
    created_at: r.created_at,
  };
}

export function toOrder(r: OrderRow, payments: WholesalePayment[] = []): WholesaleOrder {
  return {
    id: r.id,
    client_id: r.client_id,
    client_name: r.client_name,
    client_phone: r.client_phone,
    client_address: r.client_address,
    client_route: r.client_route,
    delivery_date: r.delivery_date,
    items: (Array.isArray(r.items) ? r.items : []) as unknown as WholesaleOrderItem[],
    total_usd: Number(r.total_usd),
    total_cop: Number(r.total_cop),
    status: r.status as WholesaleOrder['status'],
    driver_id: r.driver_id,
    driver_name: r.driver_name,
    assigned_at: r.assigned_at,
    delivered_at: r.delivered_at,
    paid_share: Number(r.paid_share),
    notes: r.notes,
    created_by: r.created_by,
    created_at: r.created_at,
    payments,
  };
}

/** Pedidos con sus pagos, en una consulta de pagos para todos. */
export async function attachPayments(db: Db, rows: OrderRow[]): Promise<WholesaleOrder[]> {
  if (rows.length === 0) return [];
  const { data } = await db
    .from('wholesale_payments')
    .select('*')
    .in('order_id', rows.map(r => r.id))
    .order('created_at', { ascending: true });
  const byOrder = new Map<string, WholesalePayment[]>();
  for (const p of data ?? []) {
    const list = byOrder.get(p.order_id) ?? [];
    list.push(toPayment(p));
    byOrder.set(p.order_id, list);
  }
  return rows.map(r => toOrder(r, byOrder.get(r.id) ?? []));
}

export async function loadOrder(db: Db, id: string): Promise<WholesaleOrder | null> {
  const { data } = await db.from('wholesale_orders').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const [order] = await attachPayments(db, [data]);
  return order;
}

/** Texto limpio y acotado, o null. */
export function cleanText(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
