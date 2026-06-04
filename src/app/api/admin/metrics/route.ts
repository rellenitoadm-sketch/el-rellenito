import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { mockStore } from '@/lib/mockStore';
import { visitStore } from '@/lib/visitStore';
import { requireRole } from '@/lib/adminAuth';

interface OrderLike {
  created_at: string;
  total_usd: number;
  status: string;
  items?: { name: string; qty: number }[];
}

function startOf(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function aggregate(orders: OrderLike[], visits: { hour: number; date: string }[]) {
  const today = startOf(0);
  const week = startOf(7);
  const month = startOf(30);

  const inRange = (iso: string, from: Date) => new Date(iso) >= from;
  const sum = (arr: OrderLike[]) => arr.reduce((s, o) => s + (o.total_usd || 0), 0);

  const todayO = orders.filter(o => inRange(o.created_at, today) && o.status !== 'cancelado');
  const weekO = orders.filter(o => inRange(o.created_at, week) && o.status !== 'cancelado');
  const monthO = orders.filter(o => inRange(o.created_at, month) && o.status !== 'cancelado');

  // Peak hours over last 30 days (orders count by hour 0..23)
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const o of monthO) {
    const caracas = new Date(new Date(o.created_at).getTime() - 4 * 60 * 60 * 1000);
    byHour[caracas.getUTCHours()]++;
  }

  // Top products (last 30 days)
  const productCount = new Map<string, number>();
  for (const o of monthO) {
    for (const it of o.items ?? []) {
      productCount.set(it.name, (productCount.get(it.name) ?? 0) + (it.qty || 1));
    }
  }
  const topProducts = [...productCount.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Status breakdown (last 30 days, incl. cancelled)
  const statusCount: Record<string, number> = {};
  for (const o of orders.filter(o => inRange(o.created_at, month))) {
    statusCount[o.status] = (statusCount[o.status] ?? 0) + 1;
  }

  // Visits
  const todayStr = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const visitsByHour = Array.from({ length: 24 }, () => 0);
  let visitsToday = 0;
  for (const v of visits) {
    visitsByHour[v.hour]++;
    if (v.date === todayStr) visitsToday++;
  }

  return {
    orders: {
      today: todayO.length, week: weekO.length, month: monthO.length,
      revenueToday: sum(todayO), revenueWeek: sum(weekO), revenueMonth: sum(monthO),
      avgTicket: monthO.length ? sum(monthO) / monthO.length : 0,
    },
    visits: { total: visits.length, today: visitsToday, byHour: visitsByHour },
    ordersByHour: byHour,
    topProducts,
    statusCount,
  };
}

export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseAdmin) {
    const orders = mockStore.getAll() as unknown as OrderLike[];
    const visits = visitStore.getAll();
    return NextResponse.json(aggregate(orders, visits));
  }

  const since = startOf(30).toISOString();
  const [ordersRes, visitsRes] = await Promise.all([
    supabaseAdmin.from('orders').select('created_at,total_usd,status,items').gte('created_at', since),
    supabaseAdmin.from('page_visits').select('visit_hour,visit_date').gte('created_at', since),
  ]);

  const orders = (ordersRes.data ?? []) as OrderLike[];
  const visits = (visitsRes.data ?? []).map((v: { visit_hour: number; visit_date: string }) => ({
    hour: v.visit_hour, date: v.visit_date,
  }));

  return NextResponse.json(aggregate(orders, visits));
}
