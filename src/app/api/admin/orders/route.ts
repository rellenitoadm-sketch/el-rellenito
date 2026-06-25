import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { mockStore } from '@/lib/mockStore';
import { isAuthorized } from '@/lib/adminAuth';

const PAGE_MAX = 100;

/**
 * Listado de pedidos para el panel admin.
 * - `wholesale=true` → pedidos al mayor.
 * - `range=all` → historial COMPLETO (sin tope de días).
 * - `days=N` → últimos N días.
 * - (sin nada) → pedidos de hoy (al detal).
 * - `q` → búsqueda por nombre o teléfono del cliente.
 * - `limit`/`offset` → paginación (para el historial).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const wholesale = searchParams.get('wholesale') === 'true';
  const range = searchParams.get('range'); // 'all' | null
  const days = parseInt(searchParams.get('days') ?? '0', 10);
  const q = (searchParams.get('q') ?? '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '0', 10) || 0, PAGE_MAX);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

  // Prefer the service_role client (bypasses RLS); fall back to anon.
  const db = supabaseAdmin ?? supabase;

  if (!db) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orders = mockStore.getAll() as any[];
    if (wholesale) {
      orders = orders.filter(o => o.is_wholesale === true);
    } else if (range === 'all') {
      // sin filtro de fecha
    } else if (days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      cutoff.setHours(0, 0, 0, 0);
      orders = orders.filter(o => new Date(o.created_at) >= cutoff);
    } else {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      orders = orders.filter(o => !o.is_wholesale && new Date(o.created_at) >= startOfToday);
    }
    if (q) {
      const s = q.toLowerCase();
      orders = orders.filter(o =>
        (o.customer_name || '').toLowerCase().includes(s) || (o.customer_whatsapp || '').includes(q),
      );
    }
    orders = orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (limit > 0) orders = orders.slice(offset, offset + limit);
    return NextResponse.json(orders);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db.from('orders').select('*').order('created_at', { ascending: false });

  if (wholesale) {
    query = query.eq('is_wholesale', true);
  } else if (range === 'all') {
    // historial completo, sin filtro de fecha
  } else if (days > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    query = query.gte('created_at', cutoff.toISOString());
  } else {
    query = query.gte('created_at', today.toISOString()).neq('is_wholesale', true);
  }

  if (q) {
    // Sanea para el filtro PostgREST (evita romper la sintaxis de .or()).
    const safe = q.replace(/[,()%*]/g, ' ').trim();
    if (safe) query = query.or(`customer_name.ilike.%${safe}%,customer_whatsapp.ilike.%${safe}%`);
  }

  if (limit > 0) query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
