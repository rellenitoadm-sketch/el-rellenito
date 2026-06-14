import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { mockStore } from '@/lib/mockStore';
import { requireRole } from '@/lib/adminAuth';

interface OrderLike {
  customer_name: string;
  customer_whatsapp: string;
  total_usd: number;
  created_at: string;
  delivery_zone: string | null;
  status: string;
}

export interface CustomerRow {
  whatsapp: string;
  name: string;
  order_count: number;
  total_spent_usd: number;
  last_order_at: string;
  last_zone: string | null;
}

/** Derive CRM rows from orders (works in mock mode and as a fallback). */
function deriveFromOrders(orders: OrderLike[]): CustomerRow[] {
  const map = new Map<string, CustomerRow>();
  for (const o of orders) {
    if (o.status === 'cancelado') continue;
    const key = o.customer_whatsapp?.trim();
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.order_count += 1;
      existing.total_spent_usd += o.total_usd || 0;
      if (new Date(o.created_at) > new Date(existing.last_order_at)) {
        existing.last_order_at = o.created_at;
        existing.last_zone = o.delivery_zone;
        existing.name = o.customer_name || existing.name;
      }
    } else {
      map.set(key, {
        whatsapp: key,
        name: o.customer_name || 'Cliente',
        order_count: 1,
        total_spent_usd: o.total_usd || 0,
        last_order_at: o.created_at,
        last_zone: o.delivery_zone,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.total_spent_usd - a.total_spent_usd);
}

export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(deriveFromOrders(mockStore.getAll() as unknown as OrderLike[]));
  }

  // Prefer the maintained customers table; fall back to deriving from orders.
  const { data: customers } = await supabaseAdmin
    .from('customers')
    .select('*')
    .order('total_spent_usd', { ascending: false });

  if (customers && customers.length > 0) {
    return NextResponse.json(customers);
  }

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('customer_name,customer_whatsapp,total_usd,created_at,delivery_zone,status');
  return NextResponse.json(deriveFromOrders((orders ?? []) as OrderLike[]));
}

/** Eliminar un cliente del CRM por su WhatsApp — SOLO admin. */
export async function DELETE(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const whatsapp = new URL(request.url).searchParams.get('whatsapp')?.trim();
  if (!whatsapp) {
    return NextResponse.json({ error: 'Falta el WhatsApp del cliente' }, { status: 400 });
  }

  // Sin tabla customers (modo mock): el CRM se deriva de pedidos, no hay fila que borrar.
  if (!supabaseAdmin) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabaseAdmin.from('customers').delete().eq('whatsapp', whatsapp);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
