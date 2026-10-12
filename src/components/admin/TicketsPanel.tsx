'use client';

import { useEffect, useState } from 'react';
import { Receipt, RefreshCw, Search, Store, ShoppingBag } from 'lucide-react';
import TicketSheet from './TicketSheet';
import { fmtTicketDate, fmtUsd, ticketNumber, type Ticket } from '@/lib/tickets';

type Range = 'hoy' | 'semana' | 'mes' | 'todo';
type Kind = '' | 'detal' | 'mayor';
interface Totals { count: number; usd: number }
interface Data { tickets: Ticket[]; totals: { today: Totals; week: Totals; month: Totals } }

const RANGES: { id: Range; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: '7 días' },
  { id: 'mes', label: '30 días' },
  { id: 'todo', label: 'Todos' },
];
const KINDS: { id: Kind; label: string }[] = [
  { id: '', label: 'Todos' },
  { id: 'detal', label: 'Detal' },
  { id: 'mayor', label: 'Al mayor' },
];

export default function TicketsPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');
  const [range, setRange] = useState<Range>('hoy');
  const [kind, setKind] = useState<Kind>('');
  const [open, setOpen] = useState<Ticket | null>(null);
  const [reload, setReload] = useState(0);

  // Espera un momento al escribir para no pedir al servidor por cada letra.
  useEffect(() => {
    let off = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ range, ...(kind && { kind }), ...(q.trim() && { q: q.trim() }) });
        const res = await fetch(`/api/admin/tickets?${qs}`);
        if (!res.ok) throw new Error();
        const json = await res.json() as Data;
        if (!off) { setData(json); setError(false); }
      } catch {
        if (!off) setError(true);
      } finally {
        if (!off) setLoading(false);
      }
    }, q ? 300 : 0);
    return () => { off = true; clearTimeout(t); };
  }, [q, range, kind, reload]);

  const stat = (label: string, t: Totals | undefined, accent?: boolean) => (
    <div className="card p-3" style={accent ? { background: 'var(--brand-soft)' } : undefined}>
      <p className="text-[11px]" style={{ color: accent ? 'var(--brand-deep)' : 'var(--text-3)' }}>{label}</p>
      <p className="text-[18px] font-bold t-num mt-0.5" style={{ color: accent ? 'var(--brand-deep)' : 'var(--text-1)' }}>{fmtUsd(t?.usd ?? 0)}</p>
      <p className="text-[11px]" style={{ color: accent ? 'var(--brand-deep)' : 'var(--text-3)' }}>{t?.count ?? 0} tickets</p>
    </div>
  );

  const chip = (active: boolean) => ({
    background: active ? 'var(--brand)' : 'var(--surface-2)',
    color: active ? '#fff' : 'var(--text-2)',
  });

  return (
    <div className="pb-10">
      <div className="grid grid-cols-3 gap-2 mb-4" data-tour="tk-stats">
        {stat('Hoy', data?.totals.today, true)}
        {stat('7 días', data?.totals.week)}
        {stat('30 días', data?.totals.month)}
      </div>

      <div className="flex items-center gap-2 mb-2.5" data-tour="tk-search">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-3)' }} aria-hidden />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cliente, teléfono o nº de ticket…" aria-label="Buscar ticket" className="field" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <button onClick={() => setReload(n => n + 1)} className="btn btn-ghost" style={{ padding: '10px', minWidth: 44, minHeight: 44, border: '1px solid var(--border)' }} aria-label="Recargar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-none mb-4" data-tour="tk-filters">
        {RANGES.map(r => (
          <button key={r.id} onClick={() => setRange(r.id)} aria-pressed={range === r.id} className="px-3 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap" style={chip(range === r.id)}>{r.label}</button>
        ))}
        <span className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} aria-hidden />
        {KINDS.map(k => (
          <button key={k.id} onClick={() => setKind(k.id)} aria-pressed={kind === k.id} className="px-3 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap" style={chip(kind === k.id)}>{k.label}</button>
        ))}
      </div>

      <div data-tour="tk-list">
        {error ? (
          <div className="card text-center py-12 px-6">
            <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>No se pudieron cargar los tickets</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>¿Ya corriste la migración 007 en Supabase?</p>
          </div>
        ) : !data ? (
          <div className="flex justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>
        ) : data.tickets.length === 0 ? (
          <div className="card text-center py-14 px-6">
            <Receipt className="w-9 h-9 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
            <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>Sin tickets en este filtro</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>Cada pedido nuevo genera su ticket automáticamente.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.tickets.map(t => (
              <li key={t.id}>
                <button onClick={() => setOpen(t)} className="card w-full p-3.5 flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: t.kind === 'mayor' ? 'var(--info-soft)' : 'var(--brand-soft)', color: t.kind === 'mayor' ? 'var(--info)' : 'var(--brand-deep)' }}>
                    {t.kind === 'mayor' ? <Store className="w-4 h-4" aria-label="Al mayor" /> : <ShoppingBag className="w-4 h-4" aria-label="Detal" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text-1)' }}>{t.customer_name}</p>
                    <p className="text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>
                      {`${ticketNumber(t.number)} · ${fmtTicketDate(t.created_at)} · ${t.items.reduce((s, i) => s + i.qty, 0)} uds`}
                    </p>
                  </div>
                  <p className="text-[14px] font-bold t-num flex-shrink-0" style={{ color: 'var(--brand)' }}>{fmtUsd(t.total_usd)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && <TicketSheet source={{ ticket: open }} onClose={() => setOpen(null)} />}
    </div>
  );
}
