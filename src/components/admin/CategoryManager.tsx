'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Trash2, Plus, Check } from 'lucide-react';
import { useCategories, type CategoryMeta } from '../CategoriesContext';

/**
 * Gestión de categorías para admin/staff: crear, renombrar, cambiar emoji,
 * activar/desactivar y eliminar (si no hay productos usándola).
 */
export default function CategoryManager({ onClose }: { onClose: () => void }) {
  const { reload } = useCategories();
  const [list, setList] = useState<CategoryMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/categories');
      if (res.ok) setList(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const setLocal = (key: string, patch: Partial<CategoryMeta>) =>
    setList(l => l.map(c => (c.key === key ? { ...c, ...patch } : c)));

  const save = async (c: CategoryMeta) => {
    setBusyKey(c.key); setError('');
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: c.key, label: c.label, emoji: c.emoji, active: c.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setBusyKey(null); }
  };

  const del = async (c: CategoryMeta) => {
    if (!confirm(`¿Eliminar la categoría "${c.label}"?`)) return;
    setBusyKey(c.key); setError('');
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: c.key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al eliminar');
      setList(l => l.filter(x => x.key !== c.key));
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setBusyKey(null); }
  };

  const create = async () => {
    if (!newLabel.trim()) { setError('Escribe el nombre de la categoría'); return; }
    setCreating(true); setError('');
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim(), emoji: newEmoji.trim() || '🍽️' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo crear');
      setNewLabel(''); setNewEmoji('');
      await load(); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Gestionar categorías"
        initial={{ y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
        style={{ background: 'var(--surface)', maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>Categorías</h3>
          <button onClick={onClose} className="p-1" style={{ color: 'var(--text-3)' }}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {/* Crear nueva */}
          <div className="p-2.5 rounded-xl border" style={{ background: 'var(--brand-soft)', borderColor: 'var(--brand)' }}>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--brand-deep)' }}>Nueva categoría</p>
            <div className="flex gap-2">
              <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="🍽️" maxLength={4} className="field text-center" style={{ width: 56 }} aria-label="Emoji" />
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nombre" className="field flex-1" aria-label="Nombre" />
              <button onClick={create} disabled={creating} className="btn btn-primary flex-shrink-0" style={{ minWidth: 44 }} aria-label="Crear categoría">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>
          ) : (
            list.map(c => (
              <div key={c.key} className="flex items-center gap-2 p-2 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', opacity: c.active ? 1 : 0.55 }}>
                <input
                  value={c.emoji}
                  onChange={e => setLocal(c.key, { emoji: e.target.value })}
                  maxLength={4}
                  className="field text-center"
                  style={{ width: 48, padding: '6px 4px' }}
                  aria-label={`Emoji de ${c.label}`}
                />
                <input
                  value={c.label}
                  onChange={e => setLocal(c.key, { label: e.target.value })}
                  className="field flex-1"
                  style={{ padding: '6px 10px' }}
                  aria-label={`Nombre de ${c.label}`}
                />
                <button
                  onClick={() => setLocal(c.key, { active: !c.active })}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md flex-shrink-0"
                  style={c.active
                    ? { background: 'var(--success-soft)', color: '#15803D' }
                    : { background: 'var(--surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}
                  title={c.active ? 'Visible' : 'Oculta'}
                >
                  {c.active ? 'Visible' : 'Oculta'}
                </button>
                <button onClick={() => save(c)} disabled={busyKey === c.key} className="p-2 rounded-lg flex-shrink-0" style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)' }} aria-label="Guardar">
                  {busyKey === c.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button onClick={() => del(c)} disabled={busyKey === c.key} className="p-2 rounded-lg flex-shrink-0" style={{ background: 'var(--danger-soft)', color: '#B91C1C' }} aria-label="Eliminar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
          <p className="text-[11px] pt-1" style={{ color: 'var(--text-3)' }}>
            Cambia el emoji o el nombre y toca ✓ para guardar. &quot;Oculta&quot; la quita del catálogo sin borrarla. No se puede eliminar una categoría con productos.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
