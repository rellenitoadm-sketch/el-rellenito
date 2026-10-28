'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, Receipt, RefreshCw, ShoppingBag, Store, Users } from 'lucide-react';
import TicketsPanel from './TicketsPanel';
import CrmPanel from './CrmPanel';
import { useOnboarding } from '../Onboarding';
import { fmtUsd, ticketNumber, type Ticket } from '@/lib/tickets';

type Sub = 'resumen' | 'tickets' | 'clientes';

interface Totals { count: number; usd: number }
interface Data { tickets: Ticket[]; totals: { today: Totals; week: Totals; month: Totals } }

/** Día (YYYY-MM-DD) en hora de Caracas, igual que el servidor. */
const dayKey = (iso: string) => new Date(new Date(iso).getTime() - 4 * 3600_000).toISOString().slice(0, 10);

/**
 * Sección "Ventas": todo lo vendido en un solo lugar.
 * Resumen (cuánto se vendió y qué), Tickets (cada ticket emitido) y Clientes.
 */
export default function VentasPanel({ isAdmin }: { isAdmin: boolean }) {
  const [sub, setSub] = useState<Sub>('resumen');
  const { maybeStart } = useOnboarding();

  useEffect(() => {
    const which = sub === 'tickets' ? 'adminTickets' : sub === 'clientes' ? 'adminCrm' : null;
    if (!which) return;
    const t = setTimeout(() => maybeStart(which), 650);
    return () => clearTimeout(t);
  }, [sub, maybeStart]);

  const subs: { id: Sub; label: string; Icon: React.ElementType }[] = [
    { id: 'resumen', label: 'Resumen', Icon: BarChart3 },
    { id: 'tickets', label: 'Tickets', Icon: Receipt },
    ...(isAdmin ? [{ id: 'clientes' as Sub, label: 'Clientes', Icon: Users }] : []),
  ];

  return (
    <div>
      <div className="grid gap-2 mb-5" style={{ gridTemplateColumns: `repeat(${subs.length}, 1fr)` }} role="tablist" aria-label="Secciones de ventas">
        {subs.map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={sub === id}
            onClick={() => setSub(id)}
            className="flex items-center justify-center gap-2 rounded-2xl text-[15px] font-bold"
            style={{ minHeight: 56, ...(sub === id ? { background: '#1A1A1A', color: '#fff' } : { background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }) }}
          >
            <Icon className="w-5 h-5" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {sub === 'resumen' && <Resumen onOpenTickets={() => setSub('tickets')} />}
      {sub === 'tickets' && <TicketsPanel />}
      {sub === 'clientes' && isAdmin && <CrmPanel />}
    </div>
  );
}

function Resumen({ onOpenTickets }: { onOpenTickets: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let off = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/tickets?range=mes');
        if (!res.ok) throw new Error();
        const json = await res.json() as Data;
        if (!off) { setData(json); setError(false); }
      } catch {
        if (!off) setError(true);
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => { off = true; };
  }, [reload]);

  const stats = useMemo(() => {
    const tickets = data?.tickets ?? [];
    let detal = 0, mayor = 0, nDetal = 0, nMayor = 0;
    const products = new Map<string, number>();
    const byDay = new Map<string, number>();
    for (const t of tickets) {
      if (t.kind === 'mayor') { mayor += t.total_usd; nMayor++; } else { detal += t.total_usd; nDetal++; }
      for (const i of t.items) products.set(i.name, (products.get(i.name) ?? 0) + i.qty);
      const k = dayKey(t.created_at);
      byDay.set(k, (byDay.get(k) ?? 0) + t.total_usd);
    }
    const days: { label: string; usd: number }[] = [];
    for (let n = 6; n >= 0; n--) {
      const d = new Date(now - 4 * 3600_000 - n * 86400_000).toISOString().slice(0, 10);
      days.push({ label: new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'short', timeZone: 'UTC' }), usd: byDay.get(d) ?? 0 });
    }
    const top = [...products.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { detal, mayor, nDetal, nMayor, days, top, peak: Math.max(...days.map(d => d.usd), 1) };
  }, [data, now]);

  const exportCsv = () => {
    const rows = [['Ticket', 'Fecha', 'Cliente', 'Teléfono', 'Tipo', 'Unidades', 'Total USD', 'Total COP']];
    for (const t of data?.tickets ?? []) {
      rows.push([ticketNumber(t.number), t.created_at.slice(0, 16).replace('T', ' '), t.customer_name, t.customer_phone ?? '', t.kind === 'mayor' ? 'Mayor' : 'Detal', String(t.items.reduce((s, i) => s + i.qty, 0)), t.total_usd.toFixed(2), String(Math.round(t.total_cop))]);
    }
    const csv = '﻿' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `ventas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (error) {
    return (
      <div className="card text-center py-12 px-6">
        <p className="text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>No se pudieron cargar las ventas</p>
        <p className="text-[12px] mt-1 mb-4" style={{ color: 'var(--text-3)' }}>Revisa la conexión. Si sigue, falta la migración 007 en Supabase.</p>
        <button onClick={() => setReload(n => n + 1)} className="btn btn-primary" style={{ minHeight: 48 }}>Reintentar</button>
      </div>
    );
  }
  if (!data) return <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--brand)' }} /></div>;

  const big = (label: string, t: Totals, accent?: boolean) => (
    <div className="rounded-2xl p-4" style={accent ? { background: '#1A1A1A', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
      <p className="text-[12px] font-semibold" style={{ opacity: 0.7 }}>{label}</p>
      <p className="text-[26px] font-extrabold t-num leading-tight mt-1">{fmtUsd(t.usd)}</p>
      <p className="text-[12px]" style={{ opacity: 0.7 }}>{t.count} {t.count === 1 ? 'venta' : 'ventas'}</p>
    </div>
  );

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-extrabold" style={{ color: 'var(--text-1)' }}>Ventas</h2>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="btn btn-secondary" style={{ minHeight: 48 }}><Download className="w-4 h-4" /> Excel</button>
          <button onClick={() => setReload(n => n + 1)} className="btn btn-secondary" style={{ minHeight: 48, minWidth: 48 }} aria-label="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">{big('Hoy', data.totals.today, true)}</div>
        {big('Últimos 7 días', data.totals.week)}
        {big('Últimos 30 días', data.totals.month)}
      </div>

      <div className="card p-4">
        <h3 className="text-[14px] font-bold mb-3" style={{ color: 'var(--text-1)' }}>Últimos 7 días</h3>
        <div className="flex items-end gap-2" style={{ height: 120 }}>
          {stats.days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
              <span className="text-[10px] t-num" style={{ color: 'var(--text-3)' }}>{d.usd > 0 ? `$${Math.round(d.usd)}` : ''}</span>
              <div className="w-full rounded-t-lg" style={{ height: `${Math.max(4, (d.usd / stats.peak) * 80)}%`, background: i === 6 ? '#1A1A1A' : 'var(--brand)' }} />
              <span className="text-[11px] capitalize" style={{ color: 'var(--text-2)' }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <ShoppingBag className="w-5 h-5 mb-1.5" style={{ color: 'var(--brand)' }} aria-hidden />
          <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Detal (30 días)</p>
          <p className="text-[20px] font-extrabold t-num" style={{ color: 'var(--text-1)' }}>{fmtUsd(stats.detal)}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{stats.nDetal} tickets</p>
        </div>
        <div className="card p-4">
          <Store className="w-5 h-5 mb-1.5" style={{ color: 'var(--info)' }} aria-hidden />
          <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Al mayor (30 días)</p>
          <p className="text-[20px] font-extrabold t-num" style={{ color: 'var(--text-1)' }}>{fmtUsd(stats.mayor)}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{stats.nMayor} tickets</p>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-[14px] font-bold mb-3" style={{ color: 'var(--text-1)' }}>Lo más vendido (30 días)</h3>
        {stats.top.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>Aún no hay ventas en este periodo.</p>
        ) : (
          <ol className="space-y-2">
            {stats.top.map(([name, qty], i) => (
              <li key={name} className="flex items-center gap-3 text-[14px]">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ background: i === 0 ? '#1A1A1A' : 'var(--surface-2)', color: i === 0 ? '#fff' : 'var(--text-2)' }}>{i + 1}</span>
                <span className="flex-1 truncate" style={{ color: 'var(--text-1)' }}>{name}</span>
                <span className="font-bold t-num" style={{ color: 'var(--brand)' }}>{qty} uds</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <button onClick={onOpenTickets} className="btn btn-primary w-full justify-center" style={{ minHeight: 56, fontSize: 16 }}>
        <Receipt className="w-5 h-5" /> Ver todos los tickets
      </button>
    </div>
  );
}
