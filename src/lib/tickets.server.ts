import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from './database.types';
import {
  newTicketCode,
  ticketItemsFromWeb,
  ticketItemsFromWholesale,
  type Ticket,
  type TicketItem,
  type TicketKind,
  type TicketMeta,
} from './tickets';
import type { OrderInsert } from './supabase';

type Db = SupabaseClient<Database>;

interface NewTicket {
  kind: TicketKind;
  order_id?: string | null;
  wholesale_order_id?: string | null;
  customer_name: string;
  customer_phone: string | null;
  items: TicketItem[];
  total_usd: number;
  total_cop: number;
  payment_method: string | null;
  meta: TicketMeta;
}

/** Inserta con un código nuevo; reintenta si por azar choca con otro. */
async function insertTicket(db: Db, t: NewTicket): Promise<Ticket | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from('tickets')
      .insert({
        code: newTicketCode(),
        kind: t.kind,
        order_id: t.order_id ?? null,
        wholesale_order_id: t.wholesale_order_id ?? null,
        customer_name: t.customer_name,
        customer_phone: t.customer_phone,
        items: t.items as unknown as Json,
        total_usd: t.total_usd,
        total_cop: t.total_cop,
        payment_method: t.payment_method,
        meta: t.meta as unknown as Json,
      })
      .select('*')
      .single();
    if (!error) return toTicket(data);
    if (error.code !== '23505') {
      console.warn('Ticket insert:', error.message);
      return null;
    }
  }
  return null;
}

export function toTicket(row: Database['public']['Tables']['tickets']['Row']): Ticket {
  return {
    ...row,
    kind: row.kind === 'mayor' ? 'mayor' : 'detal',
    items: (row.items ?? []) as unknown as TicketItem[],
    meta: (row.meta ?? {}) as unknown as TicketMeta,
    total_usd: Number(row.total_usd),
    total_cop: Number(row.total_cop),
  };
}

/** Ticket de un pedido de la web (detal o mayor por la tienda). Nunca lanza. */
export async function createWebTicket(db: Db | null, orderId: string, o: OrderInsert): Promise<Ticket | null> {
  if (!db) return null;
  try {
    const t = await insertTicket(db, {
      kind: o.is_wholesale ? 'mayor' : 'detal',
      order_id: orderId,
      customer_name: o.customer_name,
      customer_phone: o.customer_whatsapp,
      items: ticketItemsFromWeb(o.items),
      total_usd: Number(o.total_usd),
      total_cop: Number(o.total_cop ?? 0),
      payment_method: o.payment_method,
      meta: {
        delivery_type: o.delivery_type,
        delivery_zone: o.delivery_zone,
        delivery_address: o.delivery_address,
        date: o.scheduled_date ?? null,
        time: o.scheduled_time ?? null,
        notes: o.notes,
        advance_usd: o.advance_usd ?? null,
        remaining_usd: o.remaining_usd ?? null,
      },
    });
    return t;
  } catch (e) {
    console.warn('Ticket (web):', e);
    return null;
  }
}

type WholesaleRow = Database['public']['Tables']['wholesale_orders']['Row'];

/** Ticket de un pedido mayorista registrado por teléfono. Nunca lanza. */
export async function createWholesaleTicket(db: Db, o: WholesaleRow): Promise<Ticket | null> {
  try {
    const t = await insertTicket(db, {
      kind: 'mayor',
      wholesale_order_id: o.id,
      customer_name: o.client_name,
      customer_phone: o.client_phone,
      items: ticketItemsFromWholesale(o.items),
      total_usd: Number(o.total_usd),
      total_cop: Number(o.total_cop),
      payment_method: null,
      meta: {
        delivery_address: o.client_address,
        date: o.delivery_date,
        route: o.client_route,
        notes: o.notes,
      },
    });
    return t;
  } catch (e) {
    console.warn('Ticket (mayorista):', e);
    return null;
  }
}

export async function getTicketByCode(db: Db, code: string): Promise<Ticket | null> {
  const { data } = await db.from('tickets').select('*').eq('code', code).maybeSingle();
  return data ? toTicket(data) : null;
}

/**
 * Ticket de un pedido que ya existía (de antes de esta función) o cuyo ticket
 * no se pudo crear. Si ya tiene uno, devuelve ese: no se duplican.
 */
export async function ensureTicket(
  db: Db,
  ref: { order_id: string } | { wholesale_order_id: string },
): Promise<Ticket | null> {
  const col = 'order_id' in ref ? 'order_id' : 'wholesale_order_id';
  const id = 'order_id' in ref ? ref.order_id : ref.wholesale_order_id;
  const { data: existing } = await db.from('tickets').select('*').eq(col, id).limit(1).maybeSingle();
  if (existing) return toTicket(existing);

  if ('order_id' in ref) {
    const { data: row } = await db.from('orders').select('*').eq('id', id).maybeSingle();
    return row ? createWebTicket(db, id, row as unknown as OrderInsert) : null;
  }
  const { data: row } = await db.from('wholesale_orders').select('*').eq('id', id).maybeSingle();
  return row ? createWholesaleTicket(db, row) : null;
}
