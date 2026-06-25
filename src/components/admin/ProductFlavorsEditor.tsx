'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Candy, Check } from 'lucide-react';
import type { ProductType } from '@/lib/products';

/**
 * Gestión de los sabores de UN producto, con su precio, dentro del editor.
 * Cada sabor pertenece a este producto (ej. "Tequeño Normal" → Queso 16.000,
 * Tocineta 19.000). Si el producto no tiene sabores, se vende normal con su
 * precio base; si tiene, la tarjeta muestra "Desde" y el cliente elige en el modal.
 */
interface Row {
  name: string;
  price_usd: string;
  price_cop: string;
  wholesale_price_usd: string;
  wholesale_price_cop: string;
}

interface ApiFlavor {
  name: string;
  price_usd: number | null;
  price_cop: number | null;
  wholesale_price_usd: number | null;
  wholesale_price_cop: number | null;
}

const emptyRow = (): Row => ({ name: '', price_usd: '', price_cop: '', wholesale_price_usd: '', wholesale_price_cop: '' });
const s = (n: number | null): string => (n == null ? '' : String(n));

export default function ProductFlavorsEditor({ productId, type }: { productId: string; type: ProductType }) {
  const showWholesale = type === 'mayorista' || type === 'ambos';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/product-flavors?product=${encodeURIComponent(productId)}`)
      .then(r => (r.ok ? r.json() : []))
      .then((data: ApiFlavor[]) => {
        if (cancelled) return;
        setRows(
          Array.isArray(data) && data.length > 0
            ? data.map(f => ({
                name: f.name,
                price_usd: s(f.price_usd),
                price_cop: s(f.price_cop),
                wholesale_price_usd: s(f.wholesale_price_usd),
                wholesale_price_cop: s(f.wholesale_price_cop),
              }))
            : [],
        );
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [productId]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => { setRows(rs => [...rs, emptyRow()]); setSaved(false); };
  const removeRow = (i: number) => { setRows(rs => rs.filter((_, idx) => idx !== i)); setSaved(false); };

  const save = async () => {
    const clean = rows.filter(r => r.name.trim());
    setSaving(true); setError(''); setSaved(false);
    const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
    try {
      const res = await fetch('/api/admin/product-flavors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          flavors: clean.map(r => ({
            name: r.name.trim(),
            price_usd: numOrNull(r.price_usd),
            price_cop: numOrNull(r.price_cop),
            wholesale_price_usd: showWholesale ? numOrNull(r.wholesale_price_usd) : null,
            wholesale_price_cop: showWholesale ? numOrNull(r.wholesale_price_cop) : null,
          })),
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'No se pudo guardar'); }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar los sabores');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Candy className="w-4 h-4" style={{ color: 'var(--brand)' }} />
        <span className="text-[13px] font-bold" style={{ color: 'var(--text-1)' }}>Sabores (opcional)</span>
      </div>
      <p className="text-[11px] mb-3 leading-snug" style={{ color: 'var(--text-3)' }}>
        Si este producto se pide eligiendo sabor (ej. Queso, Bocadillo, Tocineta), agrégalos aquí con su precio.
        La tarjeta mostrará “Desde” y el cliente elige en el modal. Déjalo vacío para venderlo normal con su precio base.
      </p>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--brand)' }} /></div>
      ) : (
        <>
          {rows.length === 0 && (
            <p className="text-[12px] mb-2" style={{ color: 'var(--text-3)' }}>Sin sabores. Este producto se vende normal.</p>
          )}
          <div className="space-y-2.5">
            {rows.map((r, i) => (
              <div key={i} className="rounded-lg border p-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={r.name}
                    onChange={e => { update(i, { name: e.target.value }); setSaved(false); }}
                    placeholder="Nombre del sabor (ej. Bocadillo y Queso)"
                    className="field flex-1"
                    aria-label="Nombre del sabor"
                  />
                  <button
                    onClick={() => removeRow(i)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--danger-soft)', color: '#B91C1C' }}
                    aria-label={`Quitar sabor ${r.name || i + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <PriceInput label="$ Detal" prefix="$" value={r.price_usd} onChange={v => { update(i, { price_usd: v }); setSaved(false); }} />
                  <PriceInput label="COP Detal" prefix="COP" value={r.price_cop} onChange={v => { update(i, { price_cop: v }); setSaved(false); }} />
                  {showWholesale && (
                    <>
                      <PriceInput label="$ Mayor" prefix="$" value={r.wholesale_price_usd} onChange={v => { update(i, { wholesale_price_usd: v }); setSaved(false); }} />
                      <PriceInput label="COP Mayor" prefix="COP" value={r.wholesale_price_cop} onChange={v => { update(i, { wholesale_price_cop: v }); setSaved(false); }} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addRow}
            className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12.5px] font-semibold border"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--brand-deep)' }}
          >
            <Plus className="w-4 h-4" /> Agregar sabor
          </button>

          {error && <p className="text-[11px] mt-2" style={{ color: 'var(--danger)' }}>{error}</p>}

          <button
            onClick={save}
            disabled={saving}
            className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-bold disabled:opacity-60"
            style={saved ? { background: 'var(--success-soft)', color: '#15803D' } : { background: 'var(--brand)', color: '#fff' }}
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando sabores…</>
              : saved ? <><Check className="w-4 h-4" /> Sabores guardados</>
              : 'Guardar sabores'}
          </button>
        </>
      )}
    </div>
  );
}

function PriceInput({ label, prefix, value, onChange }: { label: string; prefix: string; value: string; onChange: (v: string) => void }) {
  const padLeft = prefix === 'COP' ? '3.25rem' : '1.75rem';
  return (
    <div>
      <label className="text-[10.5px] font-semibold block mb-0.5" style={{ color: 'var(--text-3)' }}>{label}</label>
      <div className="relative">
        <span className={`absolute ${prefix === 'COP' ? 'left-2.5 text-[11px]' : 'left-3 text-[14px]'} top-1/2 -translate-y-1/2 font-bold pointer-events-none z-10`} style={{ color: 'var(--text-3)' }}>{prefix}</span>
        <input
          type="number" inputMode="decimal" step="0.01" value={value}
          onChange={e => onChange(e.target.value)}
          aria-label={label}
          className="field" style={{ paddingLeft: padLeft }}
        />
      </div>
    </div>
  );
}
