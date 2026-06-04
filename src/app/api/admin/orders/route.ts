import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { mockStore } from '@/lib/mockStore';
import { isAuthorized } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const wholesale = searchParams.get('wholesale') === 'true';
  const days = parseInt(searchParams.get('days') ?? '0', 10);

  // Prefer the service_role client (bypasses RLS); fall back to anon.
  const db = supabaseAdmin ?? supabase;

  if (!db) {
    let orders = mockStore.getAll();
    if (wholesale) {
      orders = orders.filter(o => o.is_wholesale === true);
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
    return NextResponse.json(orders.reverse());
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db.from('orders').select('*').order('created_at', { ascending: false });

  if (wholesale) {
    query = query.eq('is_wholesale', true);
  } else if (days > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    query = query.gte('created_at', cutoff.toISOString());
  } else {
    query = query.gte('created_at', today.toISOString()).neq('is_wholesale', true);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
