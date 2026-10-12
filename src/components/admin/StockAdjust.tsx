'use client';

import { useState } from 'react';
import { Loader2, Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { stockState, type StockRow } from '@/lib/inventory';
import { StockBadge } from './StockBadge';

type Kind = 'produccion' | 'merma' | 'ajuste';

const KINDS: { id: Kind; label: string; hint: string; Icon: React.ElementType }[] = [
  { id: 'produccion', label: 'Salió producción', hint: 'Suma lo que salió del horno', Icon: Plus },
  { id: 'merma', label: 'Merma', hint: 'Resta lo dañado, regalado o consumido', Icon: Minus },
  { id: 'ajuste', label: 'Corregir conteo', hint: 'Suma o resta para cuadrar (usa - para restar)', Icon: SlidersHorizontal },
];

/**
 * Existencia de hoy de un producto (una fila, o una por sabor) y el registro de
 * movimientos. Cada cambio queda como un movimiento en el historial del día.
 */
export default function StockAdjust({ rows, date, onRows }: {
  rows: StockRow[];
  date: string;
  /** Devuelve TODAS las filas del día ya actualizadas. */
  onRows: (all: StockRow[]) => void;
}) {
  const [target, setTarget] = useState(rows[0]?.key ?? '');
  const [kind, setKind] = useState<Kind>('produccion');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const row = rows.find(r => r.key === target) ?? rows[0];
  if (!row) return null;
  const active = KINDS.find(k => k.id === kind)!;

  const submit = async () => {
    const n = Math.trunc(Number(qty));
    if (!Number.isFinite(n) || n === 0) { setError('Escribe cuántas unidades.'); return; }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/inventory/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, kind, qty: n, note: note.trim() || null, product_id: row.product_id, flavor_id: row.flavor_id }),
      });
      const data = await res.json().catch(() => ({})) as { rows?: StockRow[]; error?: string };
      if (!res.ok || !data.rows) throw new Error(data.error ?? 'No se pudo registrar.');
      onRows(data.rows);
      setQty('');
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {rows.map(r => {
          const sel = r.key === row.key;
          return (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => setTarget(r.key)}
                aria-pressed={sel}
                className="w-full flex items-center gap-3 p-3 rounded-xl border text-left"
                style={sel ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)' } : { borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold truncate" style={{ color: 'var(--text-1)' }}>{r.name}</span>
                  <span className="block text-[11px] t-num" style={{ color: 'var(--text-3)' }}>
                    Producido {r.producido} · Vendido {r.vendido}{r.mermas ? ` · Merma ${r.mermas}` : ''}
                  </span>
                </span>
                <span className="text-right flex-shrink-0">
                  <span className="block text-[20px] font-bold t-num leading-none" style={{ color: 'var(--text-1)' }}>{r.disponible}</span>
                  <StockBadge state={stockState(r)} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div role="radiogroup" aria-label="Tipo de movimiento" className="grid grid-cols-3 gap-1.5">
        {KINDS.map(k => (
          <button
            key={k.id} type="button" role="radio" aria-checked={kind === k.id}
            onClick={() => setKind(k.id)}
            className="px-1.5 py-2 rounded-xl text-[12px] font-semibold border leading-tight"
            style={{ minHeight: 44, ...(kind === k.id ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand-deep)' } : { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }) }}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{active.hint}</p>

      <div className="grid grid-cols-[96px_1fr] gap-2">
        <input
          type="number" inputMode="numeric" step="1" value={qty} onChange={e => setQty(e.target.value)}
          placeholder="Uds." aria-label="Unidades" className="field t-num"
        />
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Nota (opcional)" aria-label="Nota" maxLength={200} className="field" />
      </div>
      {error && <p className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}
      <button type="button" onClick={submit} disabled={busy} className="btn btn-primary w-full justify-center" style={{ minHeight: 46 }}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <active.Icon className="w-4 h-4" />}
        Registrar en {row.name}
      </button>
    </div>
  );
}
