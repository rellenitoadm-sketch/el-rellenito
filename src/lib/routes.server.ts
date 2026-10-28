import type { SupabaseClient } from '@supabase/supabase-js';

/** Una ruta "activa" sin señal por más de esto se da por terminada (teléfono apagado o app cerrada). */
export const STALE_ROUTE_MS = 3 * 3600_000;

/**
 * Cierra las rutas que quedaron "activas" para siempre (el domiciliario cerró la app o
 * perdió el teléfono sin finalizar). Se guardan como terminadas con su última señal como
 * hora de fin, para que aparezcan en el historial en vez de quedar como fantasmas
 * "SIN SEÑAL" en el panel. Devuelve cuántas cerró.
 */
export async function closeStaleRoutes(db: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_ROUTE_MS).toISOString();
  const { data } = await db
    .from('delivery_routes')
    .select('id, started_at, last_at')
    .eq('status', 'active')
    .or(`last_at.lt.${cutoff},and(last_at.is.null,started_at.lt.${cutoff})`)
    .limit(50);
  const rows = data ?? [];
  await Promise.all(rows.map(r =>
    db.from('delivery_routes')
      .update({ status: 'done', ended_at: r.last_at ?? r.started_at })
      .eq('id', r.id)
      .eq('status', 'active'),
  ));
  return rows.length;
}

/** Nombre del cliente de cada pedido ligado a una ruta (para mostrar "Entrega a …"). */
export async function customerNamesByOrder(db: SupabaseClient, orderIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data } = await db.from('orders').select('id, customer_name').in('id', ids);
  return new Map((data ?? []).map(o => [String(o.id), String(o.customer_name ?? '')]));
}
