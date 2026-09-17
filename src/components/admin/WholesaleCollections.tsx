'use client';

import { useState } from 'react';
import { Check, CircleDollarSign, HandCoins, Ban, Undo2, X, ClipboardCheck, Clock } from 'lucide-react';
import type { DriverChoice } from '@/components/RouteTracking';
import {
  CURRENCY_LABEL,
  amountFor,
  formatAmount,
  formatCop,
  formatUsd,
  formatVes,
  formatYmd,
  isSettled,
  remainingShare,
  shareOf,
  type PaymentCurrency,
  type PaymentOutcome,
  type StoredRates,
  type WholesaleOrder,
} from '@/lib/wholesaleOrders';

interface Props {
  date: string;
  today: string;
  orders: WholesaleOrder[];
  debts: WholesaleOrder[];
  rates: StoredRates | null;
  me: DriverChoice | null;
  onOrderChange: (order: WholesaleOrder) => void;
  onNeedIdentity: () => void;
}

interface SheetState {
  order: WholesaleOrder;
  outcome: 'pagado' | 'abono';
}

const CURRENCIES: PaymentCurrency[] = ['COP', 'VES', 'USD'];

/** Pesos y bolívares se anotan enteros; dólares admiten centavos. */
function parseAmount(raw: string, currency: PaymentCurrency): number {
  if (currency === 'USD') return Number(raw.replace(',', '.').replace(/[^\d.]/g, '')) || 0;
  return Number(raw.replace(/\D/g, '')) || 0;
}

export default function WholesaleCollections({ date, today, orders, debts, rates, me, onOrderChange, onNeedIdentity }: Props) {
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const dayRows = orders.filter(o => o.status !== 'cancelado');
  const rows = [...dayRows, ...debts];

  // Resumen del cierre: lo cobrado hoy separado por moneda (así se cuenta la caja).
  const collectedToday: Record<PaymentCurrency, number> = { COP: 0, VES: 0, USD: 0 };
  for (const o of rows) {
    for (const p of o.payments) {
      if (p.collected_on === today && p.currency && p.amount > 0) collectedToday[p.currency] += p.amount;
    }
  }
  const pendingCop = rows.reduce((s, o) => s + remainingShare(o.paid_share) * o.total_cop, 0);
  const reviewed = rows.filter(o => isSettled(o.paid_share, o.total_cop) || o.payments.some(p => p.collected_on === today)).length;

  const record = async (order: WholesaleOrder, body: Record<string, unknown>) => {
    if (!me) { onNeedIdentity(); return false; }
    setBusyId(order.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/admin/wholesale-orders/${order.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, driver_id: me.id, driver_name: me.name }),
      });
      const data = await res.json().catch(() => ({})) as WholesaleOrder & { error?: string };
      if (!res.ok) { setRowError({ id: order.id, message: data.error ?? 'No se pudo guardar.' }); return false; }
      onOrderChange(data);
      return true;
    } catch {
      setRowError({ id: order.id, message: 'Error de conexión.' });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const undo = async (order: WholesaleOrder, paymentId: string) => {
    if (!confirm('¿Deshacer esta marca del cierre?')) return;
    setBusyId(order.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/admin/wholesale-orders/${order.id}/payments/${paymentId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({})) as WholesaleOrder & { error?: string };
      if (!res.ok) { setRowError({ id: order.id, message: data.error ?? 'No se pudo deshacer.' }); return; }
      onOrderChange(data);
    } catch {
      setRowError({ id: order.id, message: 'Error de conexión.' });
    } finally {
      setBusyId(null);
    }
  };

  const renderRow = (o: WholesaleOrder, isDebt: boolean) => {
    const settled = isSettled(o.paid_share, o.total_cop);
    const remaining = remainingShare(o.paid_share);
    const todayMarks = o.payments.filter(p => p.collected_on === today);
    const olderPaid = o.payments.filter(p => p.collected_on !== today && p.share > 0);
    const noPagoToday = todayMarks.some(p => p.outcome === 'no_pago');
    const busy = busyId === o.id;

    const chip = settled
      ? { text: 'Pagado', bg: 'var(--success-soft)', fg: '#15803D' }
      : o.status !== 'entregado'
        ? { text: 'Sin entregar', bg: 'var(--surface-2)', fg: 'var(--text-3)' }
        : o.paid_share > 0
          ? { text: 'Abonó', bg: 'var(--warning-soft)', fg: '#B45309' }
          : noPagoToday
            ? { text: 'No pagó', bg: 'var(--danger-soft)', fg: '#B91C1C' }
            : { text: 'Por cobrar', bg: 'var(--brand-soft)', fg: 'var(--brand-deep)' };

    return (
      <div key={o.id} className="card p-3.5" style={settled ? { opacity: 0.85 } : undefined}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>{o.client_name}</p>
            <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              {isDebt ? `Entrega del ${formatYmd(o.delivery_date)}` : `${o.items.length} ${o.items.length === 1 ? 'producto' : 'productos'}`}
              {o.driver_name ? ` · Lo llevó ${o.driver_name}` : ''}
            </p>
          </div>
          <span className="text-[11px] font-bold px-2 py-1 rounded flex-shrink-0" style={{ background: chip.bg, color: chip.fg }}>{chip.text}</span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <p style={{ color: 'var(--text-3)' }}>Total</p>
            <p className="font-bold t-num text-[14px]" style={{ color: 'var(--text-1)' }}>{formatCop(o.total_cop)}</p>
            <p className="t-num" style={{ color: 'var(--text-3)' }}>{formatUsd(o.total_usd)}</p>
          </div>
          {!settled && (
            <div className="text-right">
              <p style={{ color: 'var(--text-3)' }}>Saldo</p>
              <p className="font-bold t-num text-[14px]" style={{ color: o.paid_share > 0 ? '#B45309' : 'var(--text-1)' }}>
                {formatCop(remaining * o.total_cop)}
              </p>
              <p className="t-num" style={{ color: 'var(--text-3)' }}>
                {formatUsd(remaining * o.total_usd)}{rates ? ` · ${formatVes(remaining * o.total_usd * rates.bs_per_usd)}` : ''}
              </p>
            </div>
          )}
        </div>

        {olderPaid.length > 0 && (
          <p className="text-[11.5px] mt-2" style={{ color: 'var(--text-3)' }}>
            Abonos anteriores: {olderPaid.map(p => `${formatAmount(p.amount, p.currency ?? 'COP')} (${formatYmd(p.collected_on)})`).join(', ')}
          </p>
        )}

        {todayMarks.length > 0 && (
          <div className="mt-2 space-y-1">
            {todayMarks.map(p => (
              <div key={p.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: 'var(--surface-2)' }}>
                {p.outcome === 'no_pago'
                  ? <Ban className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#B91C1C' }} />
                  : <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#15803D' }} />}
                <p className="text-[12px] flex-1 min-w-0" style={{ color: 'var(--text-2)' }}>
                  {p.outcome === 'no_pago' ? 'No pagó' : `${p.outcome === 'pagado' ? 'Pagó' : 'Abonó'} ${formatAmount(p.amount, p.currency ?? 'COP')}`}
                  {p.driver_name ? ` · ${p.driver_name}` : ''}
                </p>
                <button onClick={() => undo(o, p.id)} disabled={busy} className="inline-flex items-center gap-1 text-[11.5px] font-semibold flex-shrink-0 disabled:opacity-50"
                  style={{ color: 'var(--text-2)', minHeight: 32 }}>
                  <Undo2 className="w-3.5 h-3.5" /> Deshacer
                </button>
              </div>
            ))}
          </div>
        )}

        {!settled && (
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            <button disabled={busy} onClick={() => (me ? setSheet({ order: o, outcome: 'pagado' }) : onNeedIdentity())}
              className="rounded-xl text-[12.5px] font-bold text-white inline-flex items-center justify-center gap-1 disabled:opacity-50"
              style={{ background: '#16a34a', minHeight: 44 }}>
              <CircleDollarSign className="w-4 h-4" /> Pagó todo
            </button>
            <button disabled={busy} onClick={() => (me ? setSheet({ order: o, outcome: 'abono' }) : onNeedIdentity())}
              className="rounded-xl text-[12.5px] font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
              style={{ background: 'var(--warning-soft)', color: '#B45309', minHeight: 44 }}>
              <HandCoins className="w-4 h-4" /> Abonó
            </button>
            <button disabled={busy || noPagoToday} onClick={() => record(o, { outcome: 'no_pago' })}
              className="rounded-xl text-[12.5px] font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
              style={{ background: 'var(--danger-soft)', color: '#B91C1C', minHeight: 44 }}>
              <Ban className="w-4 h-4" /> No pagó
            </button>
          </div>
        )}

        {rowError?.id === o.id && (
          <p className="text-[12px] font-semibold mt-2" style={{ color: 'var(--danger)' }}>{rowError.message}</p>
        )}
      </div>
    );
  };

  const sortRows = (list: WholesaleOrder[]) =>
    [...list].sort((a, b) => Number(isSettled(a.paid_share, a.total_cop)) - Number(isSettled(b.paid_share, b.total_cop)));

  return (
    <div className="pb-10">
      {date !== today && (
        <div className="card p-3 mb-3 flex items-start gap-2" style={{ background: 'var(--info-soft)' }}>
          <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#1D4ED8' }} />
          <p className="text-[12.5px]" style={{ color: '#1D4ED8' }}>
            Viendo pedidos del {formatYmd(date)}. Los cobros que anotes quedan con fecha de hoy ({formatYmd(today)}).
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="card p-3.5">
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Cobrado hoy</p>
          <p className="text-[16px] font-bold t-num mt-0.5" style={{ color: '#15803D' }}>{formatCop(collectedToday.COP)}</p>
          {collectedToday.VES > 0 && <p className="text-[12.5px] font-semibold t-num" style={{ color: '#15803D' }}>{formatVes(collectedToday.VES)}</p>}
          {collectedToday.USD > 0 && <p className="text-[12.5px] font-semibold t-num" style={{ color: '#15803D' }}>{formatUsd(collectedToday.USD)}</p>}
        </div>
        <div className="card p-3.5">
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Por cobrar</p>
          <p className="text-[16px] font-bold t-num mt-0.5" style={{ color: 'var(--text-1)' }}>{formatCop(pendingCop)}</p>
          <p className="text-[12px] mt-1 inline-flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
            <ClipboardCheck className="w-3.5 h-3.5" /> Revisados {reviewed} de {rows.length}
          </p>
        </div>
      </div>

      <h3 className="text-[12px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--brand-deep)' }}>
        Pedidos del {formatYmd(date)}
      </h3>
      {dayRows.length === 0 ? (
        <p className="card p-4 text-[12.5px] mb-5" style={{ color: 'var(--text-3)' }}>No hay pedidos mayoristas para esta fecha.</p>
      ) : (
        <div className="space-y-2 mb-5">{sortRows(dayRows).map(o => renderRow(o, false))}</div>
      )}

      {debts.length > 0 && (
        <>
          <h3 className="text-[12px] font-bold uppercase tracking-widest mb-2" style={{ color: '#B45309' }}>
            Saldos de días anteriores · {debts.length}
          </h3>
          <div className="space-y-2">{sortRows(debts).map(o => renderRow(o, true))}</div>
        </>
      )}

      {sheet && (
        <PaymentSheet
          state={sheet}
          rates={rates}
          busy={busyId === sheet.order.id}
          error={rowError?.id === sheet.order.id ? rowError.message : ''}
          onClose={() => { setSheet(null); setRowError(null); }}
          onConfirm={async body => { if (await record(sheet.order, body)) setSheet(null); }}
        />
      )}
    </div>
  );
}

function PaymentSheet({ state, rates, busy, error, onClose, onConfirm }: {
  state: SheetState;
  rates: StoredRates | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (body: { outcome: PaymentOutcome; currency: PaymentCurrency; amount?: number; rate_ves?: number }) => void;
}) {
  const { order, outcome } = state;
  const [currency, setCurrency] = useState<PaymentCurrency>('COP');
  const [rawAmount, setRawAmount] = useState('');
  const [rawRate, setRawRate] = useState(rates ? String(Math.round(rates.bs_per_usd * 100) / 100) : '');

  const rate = currency === 'VES' ? Number(rawRate.replace(',', '.')) || 0 : null;
  const remaining = remainingShare(order.paid_share);
  const fullAmount = amountFor(remaining, currency, order, rate);
  const amount = outcome === 'pagado' ? fullAmount : parseAmount(rawAmount, currency);
  const leftShare = Math.max(0, remaining - shareOf(amount, currency, order, rate));
  const ratePending = currency === 'VES' && !(rate && rate >= 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden" style={{ background: 'var(--surface)' }}
        role="dialog" aria-modal="true" aria-label={outcome === 'pagado' ? 'Registrar pago completo' : 'Registrar abono'}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>{outcome === 'pagado' ? 'Pagó todo' : 'Abonó'}</h2>
            <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>{order.client_name}</p>
          </div>
          <button onClick={() => !busy && onClose()} className="p-1" style={{ color: 'var(--text-3)' }} aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div>
            <p className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>Moneda</p>
            <div className="grid grid-cols-3 gap-1.5">
              {CURRENCIES.map(c => (
                <button key={c} onClick={() => { setCurrency(c); setRawAmount(''); }}
                  className="rounded-xl text-[13px] font-bold border"
                  style={{ minHeight: 44, ...(currency === c
                    ? { background: 'var(--brand)', color: '#fff', borderColor: 'transparent' }
                    : { background: 'var(--surface)', color: 'var(--text-2)', borderColor: 'var(--border)' }) }}>
                  {CURRENCY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          {currency === 'VES' && (
            <div>
              <label htmlFor="pay-rate" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>Tasa (Bs por dólar)</label>
              <input id="pay-rate" inputMode="decimal" value={rawRate} onChange={e => setRawRate(e.target.value)} className="field t-num" />
            </div>
          )}

          {outcome === 'pagado' ? (
            <div className="card p-3" style={{ background: 'var(--success-soft)' }}>
              <p className="text-[12px]" style={{ color: '#15803D' }}>Saldo que cobró</p>
              <p className="text-[22px] font-bold t-num" style={{ color: '#15803D' }}>{ratePending ? '—' : formatAmount(fullAmount, currency)}</p>
            </div>
          ) : (
            <div>
              <label htmlFor="pay-amount" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>
                Monto abonado en {CURRENCY_LABEL[currency].toLowerCase()}
              </label>
              <input id="pay-amount" inputMode={currency === 'USD' ? 'decimal' : 'numeric'} value={rawAmount}
                onChange={e => setRawAmount(e.target.value)} placeholder={currency === 'USD' ? '0.00' : '0'} className="field t-num text-[18px]" autoFocus />
              <p className="text-[12px] mt-1.5 t-num" style={{ color: 'var(--text-3)' }}>
                Saldo actual: {ratePending ? '—' : formatAmount(fullAmount, currency)}
                {amount > 0 && !ratePending ? ` · Queda: ${formatCop(leftShare * order.total_cop)}` : ''}
              </p>
            </div>
          )}

          {error && <p className="text-[12.5px] font-semibold" style={{ color: 'var(--danger)' }}>{error}</p>}
        </div>

        <div className="px-4 py-3 border-t flex gap-2" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} disabled={busy} className="btn btn-ghost flex-1" style={{ minHeight: 44, border: '1px solid var(--border)' }}>Cancelar</button>
          <button
            disabled={busy || ratePending || (outcome === 'abono' && amount <= 0)}
            onClick={() => onConfirm({
              outcome,
              currency,
              ...(outcome === 'abono' ? { amount } : {}),
              ...(currency === 'VES' && rate ? { rate_ves: rate } : {}),
            })}
            className="btn btn-primary flex-1" style={{ minHeight: 44 }}>
            {busy ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
