'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Phone, RefreshCw, Search } from 'lucide-react';
import {
  formatAmount,
  formatCop,
  formatUsd,
  formatYmd,
  normalizeSearch,
  remainingShare,
  type WholesaleOrder,
} from '@/lib/wholesaleOrders';
import { routeLabel } from '@/lib/wholesaleRoutes';
import { useOnboarding } from '../Onboarding';

interface ClientCredit {
  key: string;
  client_id: string | null;
  name: string;
  phone: string | null;
  route: string | null;
  owed_cop: number;
  owed_usd: number;
  oldest: string;
  orders: WholesaleOrder[];
}

interface CreditsData {
  today: string;
  clients: ClientCredit[];
  total_cop: number;
  total_usd: number;
  unmarked: number;
}

/** Los créditos, o el mensaje de error para mostrar. */
async function fetchCredits(): Promise<CreditsData | string> {
  try {
    const res = await fetch('/api/admin/wholesale-orders/credits');
    const body = await res.json().catch(() => ({})) as CreditsData & { error?: string };
    return res.ok ? body : body.error ?? 'No se pudieron cargar los créditos.';
  } catch {
    return 'Error de conexión.';
  }
}

/** Días entre dos fechas YYYY-MM-DD. */
const daysBetween = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000));

/**
 * Créditos: cuánto debe cada mayorista, sumando todos sus pedidos entregados
 * sin pagar del todo. Solo lectura; los cobros se marcan en "Cobros".
 */
export default function WholesaleCredits({ onGoToCobros }: { onGoToCobros: () => void }) {
  const [data, setData] = useState<CreditsData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const apply = useCallback((r: CreditsData | string) => {
    if (typeof r === 'string') { setError(r); return; }
    setData(r);
    setError('');
  }, []);

  const load = async () => {
    setLoading(true);
    apply(await fetchCredits());
    setLoading(false);
  };

  useEffect(() => {
    let off = false;
    fetchCredits().then(r => { if (!off) apply(r); });
    return () => { off = true; };
  }, [apply]);

  // El tutorial arranca cuando ya hay datos: así existen los elementos que resalta.
  const { maybeStart } = useOnboarding();
  const ready = data !== null;
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => maybeStart('adminCreditos'), 650);
    return () => clearTimeout(t);
  }, [ready, maybeStart]);

  const shown = useMemo(() => {
    const q = normalizeSearch(query.trim());
    const list = data?.clients ?? [];
    return q ? list.filter(c => normalizeSearch(c.name).includes(q)) : list;
  }, [data, query]);

  if (error) {
    return (
      <div className="card p-4">
        <p className="text-[13px]" style={{ color: 'var(--danger)' }}>{error}</p>
        <button onClick={load} className="mt-2 text-[13px] font-semibold" style={{ color: 'var(--brand-deep)' }}>Reintentar</button>
      </div>
    );
  }
  if (!data) {
    return <div className="flex justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>;
  }

  const orderCount = data.clients.reduce((s, c) => s + c.orders.length, 0);

  return (
    <div className="pb-10">
      <div className="card p-4 mb-3" data-tour="cr-total">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Total en créditos</p>
            <p className="text-[22px] font-extrabold t-num" style={{ color: 'var(--text-1)' }}>{formatCop(data.total_cop)}</p>
            <p className="text-[12px] t-num" style={{ color: 'var(--text-3)' }}>{formatUsd(data.total_usd)}</p>
          </div>
          <button onClick={load} className="btn btn-ghost" style={{ padding: 8, minWidth: 40, minHeight: 40, border: '1px solid var(--border)' }} aria-label="Recargar créditos">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-[12px] mt-2" style={{ color: 'var(--text-2)' }}>
          {data.clients.length} {data.clients.length === 1 ? 'cliente debe' : 'clientes deben'} · {orderCount} {orderCount === 1 ? 'pedido' : 'pedidos'} entregados sin pagar completo
        </p>
      </div>

      {data.unmarked > 0 && (
        <div className="card p-3 mb-3 flex items-start gap-2" style={{ background: 'var(--warning-soft)' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#B45309' }} />
          <p className="text-[12.5px]" style={{ color: '#B45309' }}>
            {data.unmarked} {data.unmarked === 1 ? 'pedido de días pasados no está marcado' : 'pedidos de días pasados no están marcados'} como entregado. No se cuentan aquí hasta marcarlos.
          </p>
        </div>
      )}

      {data.clients.length > 4 && (
        <label className="relative block mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} aria-hidden />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente" className="field" style={{ paddingLeft: 36 }} aria-label="Buscar cliente" />
        </label>
      )}

      {data.clients.length === 0 ? (
        <p className="card p-4 text-[13px]" data-tour="cr-list" style={{ color: 'var(--text-3)' }}>Nadie debe nada. Todos los pedidos entregados están pagados.</p>
      ) : shown.length === 0 ? (
        <p className="card p-4 text-[13px]" style={{ color: 'var(--text-3)' }}>Ningún cliente con ese nombre debe.</p>
      ) : (
        <div className="space-y-2" data-tour="cr-list">
          {shown.map(c => {
            const isOpen = open === c.key;
            const age = daysBetween(c.oldest, data.today);
            return (
              <div key={c.key} className="card overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : c.key)} className="w-full text-left p-3.5 flex items-start gap-2" aria-expanded={isOpen}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--text-1)' }}>{c.name}</p>
                    <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                      {c.orders.length} {c.orders.length === 1 ? 'pedido' : 'pedidos'} · debe desde {formatYmd(c.oldest)}
                      {age > 0 ? ` (${age} ${age === 1 ? 'día' : 'días'})` : ' (hoy)'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[15px] font-bold t-num" style={{ color: age > 7 ? '#B91C1C' : 'var(--text-1)' }}>{formatCop(c.owed_cop)}</p>
                    <p className="text-[11px] t-num" style={{ color: 'var(--text-3)' }}>{formatUsd(c.owed_usd)}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 flex-shrink-0 mt-1 transition-transform" style={{ color: 'var(--text-3)', transform: isOpen ? 'rotate(180deg)' : undefined }} aria-hidden />
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3.5 space-y-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    {(c.phone || c.route) && (
                      <p className="text-[12px] pt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: 'var(--text-2)' }}>
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--brand-deep)' }}>
                            <Phone className="w-3.5 h-3.5" /> {c.phone}
                          </a>
                        )}
                        {c.route && <span>{routeLabel(c.route)}</span>}
                      </p>
                    )}
                    {c.orders.map(o => {
                      const left = remainingShare(o.paid_share);
                      const paid = o.payments.filter(p => p.share > 0);
                      return (
                        <div key={o.id} className="rounded-xl p-2.5" style={{ background: 'var(--surface-2)' }}>
                          <div className="flex items-baseline gap-2">
                            <p className="text-[12.5px] font-semibold flex-1 capitalize" style={{ color: 'var(--text-1)' }}>{formatYmd(o.delivery_date)}</p>
                            <p className="text-[13px] font-bold t-num" style={{ color: 'var(--text-1)' }}>{formatCop(left * o.total_cop)}</p>
                          </div>
                          <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                            Total {formatCop(o.total_cop)}{o.driver_name ? ` · Lo llevó ${o.driver_name}` : ''}
                          </p>
                          {paid.length > 0 && (
                            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-2)' }}>
                              Abonos: {paid.map(p => `${formatAmount(p.amount, p.currency ?? 'COP')} (${formatYmd(p.collected_on)}${p.driver_name ? `, ${p.driver_name}` : ''})`).join(', ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <button onClick={onGoToCobros} className="text-[12.5px] font-semibold pt-1" style={{ color: 'var(--brand-deep)', minHeight: 32 }}>
                      Marcar un pago en Cobros →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
