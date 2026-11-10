'use client';

import { useEffect, useState } from 'react';
import {
  Banknote, Building2, Check, Coins, CreditCard, DollarSign, Loader2,
  Pencil, Plus, Smartphone, Trash2, Wallet, X,
} from 'lucide-react';
import { usePaymentMethods } from '../PaymentMethodsContext';
import type { PaymentMethod } from '@/lib/payments';

const ICONS: Record<string, React.ElementType> = { Smartphone, DollarSign, Coins, Building2, CreditCard, Banknote, Wallet };
const ICON_CHOICES = Object.keys(ICONS);

type Row = PaymentMethod & { active: boolean; sort_order: number };

/**
 * Métodos de pago que salen en los carritos (detal y al mayor): Pago Móvil,
 * Zelle, transferencias, etc. Solo admin — son cuentas bancarias.
 */
export default function PagosPanel() {
  const { reload } = usePaymentMethods();
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payment-methods');
      if (res.ok) setList(await res.json());
      else setError('No se pudieron cargar los métodos de pago.');
    } catch { setError('Error de conexión.'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const createOne = async () => {
    setCreating(true); setError('');
    try {
      const res = await fetch('/api/admin/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Nuevo método' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo crear');
      await load();
      await reload();
      setEditingId(data.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setCreating(false); }
  };

  const save = async (r: Row) => {
    setBusyId(r.id); setError('');
    try {
      const res = await fetch('/api/admin/payment-methods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, label: r.label, icon: r.icon, details: r.details, note: r.note ?? null, active: r.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      await load();
      await reload();
      setEditingId(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setBusyId(null); }
  };

  const del = async (r: Row) => {
    if (!confirm(`¿Eliminar "${r.label}"? Dejará de verse en los carritos.`)) return;
    setBusyId(r.id); setError('');
    try {
      const res = await fetch('/api/admin/payment-methods', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'No se pudo eliminar');
      await load();
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setBusyId(null); }
  };

  const setLocal = (id: string, patch: Partial<Row>) =>
    setList(l => l.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const setDetail = (id: string, key: string, value: string) =>
    setList(l => l.map(r => (r.id === id ? { ...r, details: { ...r.details, [key]: value } } : r)));
  const renameDetailKey = (id: string, oldKey: string, newKey: string) =>
    setList(l => l.map(r => {
      if (r.id !== id) return r;
      const entries = Object.entries(r.details).map(([k, v]) => [k === oldKey ? newKey : k, v] as [string, string]);
      return { ...r, details: Object.fromEntries(entries) };
    }));
  const removeDetail = (id: string, key: string) =>
    setList(l => l.map(r => {
      if (r.id !== id) return r;
      const rest = { ...r.details };
      delete rest[key];
      return { ...r, details: rest };
    }));
  const addDetail = (id: string) =>
    setList(l => l.map(r => (r.id === id ? { ...r, details: { ...r.details, '': '' } } : r)));

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--brand)' }} /></div>;

  return (
    <div className="pb-10 space-y-3">
      <div className="flex items-center justify-between" data-tour="pagos-intro">
        <div>
          <h2 className="text-[18px] font-extrabold" style={{ color: 'var(--text-1)' }}>Métodos de pago</h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>Lo que ve el cliente al pagar, en todos los carritos.</p>
        </div>
      </div>

      {error && <p className="text-[13px] font-semibold" style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="space-y-2.5" data-tour="pagos-list">
        {list.map(r => {
          const Icon = ICONS[r.icon] ?? Wallet;
          const editing = editingId === r.id;
          const busy = busyId === r.id;
          return (
            <div key={r.id} className="card p-3.5" style={!r.active ? { opacity: 0.55 } : undefined}>
              {!editing ? (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand-soft)' }}>
                    <Icon className="w-5 h-5" style={{ color: 'var(--brand)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>
                      {r.label} {!r.active && <span className="text-[11px] font-normal" style={{ color: 'var(--text-3)' }}>· oculto</span>}
                    </p>
                    {Object.keys(r.details).length > 0 ? (
                      <p className="text-[12px] truncate" style={{ color: 'var(--text-3)' }}>
                        {Object.entries(r.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </p>
                    ) : r.note ? (
                      <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>{r.note}</p>
                    ) : null}
                  </div>
                  <button onClick={() => setEditingId(r.id)} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }} aria-label={`Editar ${r.label}`}>
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex gap-2">
                    <input value={r.label} onChange={e => setLocal(r.id, { label: e.target.value })} placeholder="Nombre" className="field flex-1" />
                    <select value={r.icon} onChange={e => setLocal(r.id, { icon: e.target.value })} className="field" style={{ width: 92 }} aria-label="Icono">
                      {ICON_CHOICES.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Datos (banco, teléfono, cuenta…)</p>
                    {Object.entries(r.details).map(([k, v], i) => (
                      <div key={i} className="flex gap-1.5">
                        <input value={k} onChange={e => renameDetailKey(r.id, k, e.target.value)} placeholder="Campo (ej. Teléfono)" className="field" style={{ flex: '0 0 38%', fontSize: 12.5 }} />
                        <input value={v} onChange={e => setDetail(r.id, k, e.target.value)} placeholder="Valor" className="field flex-1" style={{ fontSize: 12.5 }} />
                        <button onClick={() => removeDetail(r.id, k)} className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center" style={{ background: 'var(--danger-soft)', color: '#B91C1C' }} aria-label="Quitar dato">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addDetail(r.id)} className="text-[12px] font-semibold inline-flex items-center gap-1" style={{ color: 'var(--brand-deep)' }}>
                      <Plus className="w-3.5 h-3.5" /> Agregar dato
                    </button>
                  </div>

                  <textarea value={r.note ?? ''} onChange={e => setLocal(r.id, { note: e.target.value })} rows={2} placeholder="Nota (opcional, ej. instrucciones de pago)" className="field resize-none" style={{ fontSize: 12.5 }} />

                  <label className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text-2)' }}>
                    <input type="checkbox" checked={r.active} onChange={e => setLocal(r.id, { active: e.target.checked })} className="w-4 h-4" />
                    Visible en los carritos
                  </label>

                  <div className="flex gap-2">
                    <button onClick={() => save(r)} disabled={busy} className="btn btn-primary flex-1 justify-center" style={{ minHeight: 44 }}>
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
                    </button>
                    <button onClick={() => { setEditingId(null); load(); }} className="btn btn-ghost" style={{ minHeight: 44, border: '1px solid var(--border)' }}>
                      <X className="w-4 h-4" />
                    </button>
                    <button onClick={() => del(r)} disabled={busy} className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--danger-soft)', color: '#B91C1C' }} aria-label={`Eliminar ${r.label}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={createOne} disabled={creating} className="btn btn-secondary w-full justify-center" data-tour="pagos-add" style={{ minHeight: 48 }}>
        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar método de pago
      </button>
    </div>
  );
}
