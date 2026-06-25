'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Check, RefreshCw, Save } from 'lucide-react';

interface FlavorRow { id: string; name: string; active: boolean; sort_order: number }
interface AssignRow { id: string; name: string; active: boolean; assigned: boolean; available: boolean; sort_order: number }
interface ProductLite { id: string; name: string; category: string; has_flavors?: boolean }

export default function FlavorsPanel() {
  const [flavors, setFlavors] = useState<FlavorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const [products, setProducts] = useState<ProductLite[]>([]);
  const [selected, setSelected] = useState('');
  const [assign, setAssign] = useState<AssignRow[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const loadFlavors = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/flavors');
      if (res.ok) setFlavors(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { loadFlavors(); }, []);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.ok ? r.json() : [])
      .then((data: ProductLite[]) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => { /* ignore */ });
  }, []);

  const productOptions = useMemo(
    () => [...products].sort((a, b) =>
      (a.category || '').localeCompare(b.category || '', 'es') || a.name.localeCompare(b.name, 'es'),
    ),
    [products],
  );

  const addFlavor = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch('/api/admin/flavors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) { const created = await res.json() as FlavorRow; setFlavors(curr => [...curr, created]); setNewName(''); }
    } catch { /* ignore */ } finally { setAdding(false); }
  };

  const patchFlavor = async (id: string, patch: Partial<FlavorRow>) => {
    const prev = flavors;
    setFlavors(curr => curr.map(f => f.id === id ? { ...f, ...patch } : f));
    try {
      const res = await fetch(`/api/admin/flavors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch { setFlavors(prev); }
  };

  const renameFlavor = (f: FlavorRow) => {
    const name = window.prompt('Nuevo nombre del sabor:', f.name)?.trim();
    if (name && name !== f.name) patchFlavor(f.id, { name });
  };

  const deleteFlavor = async (f: FlavorRow) => {
    if (!confirm(`¿Eliminar el sabor "${f.name}"? Se quitará de todos los productos.`)) return;
    const prev = flavors;
    setFlavors(curr => curr.filter(x => x.id !== f.id));
    try {
      const res = await fetch(`/api/admin/flavors/${f.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch { setFlavors(prev); }
  };

  const loadAssign = async (productId: string) => {
    if (!productId) { setAssign([]); return; }
    setLoadingAssign(true);
    setSavedOk(false);
    try {
      const res = await fetch(`/api/admin/product-flavors?product=${encodeURIComponent(productId)}`);
      if (res.ok) setAssign(await res.json());
    } catch { /* ignore */ } finally { setLoadingAssign(false); }
  };

  const onSelectProduct = (id: string) => { setSelected(id); loadAssign(id); };

  const toggleAssigned = (id: string) =>
    setAssign(curr => curr.map(a => a.id === id ? { ...a, assigned: !a.assigned } : a));
  const toggleAvailable = (id: string) =>
    setAssign(curr => curr.map(a => a.id === id ? { ...a, available: !a.available } : a));

  const saveAssign = async () => {
    if (!selected) return;
    setSavingAssign(true);
    setSavedOk(false);
    try {
      const rows = assign
        .filter(a => a.assigned)
        .map((a, i) => ({ flavor_id: a.id, available: a.available, sort_order: i }));
      const res = await fetch('/api/admin/product-flavors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: selected, flavors: rows }),
      });
      if (res.ok) {
        setSavedOk(true);
        setProducts(curr => curr.map(p => p.id === selected ? { ...p, has_flavors: rows.some(r => r.available) } : p));
      }
    } catch { /* ignore */ } finally { setSavingAssign(false); }
  };

  return (
    <div className="pb-10 space-y-7">
      {/* Sección A: sabores globales */}
      <section>
        <h3 className="text-[12px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--brand-deep)' }}>Sabores</h3>

        <div className="flex items-center gap-2 mb-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addFlavor(); }}
            placeholder="Nuevo sabor (ej. Queso, Bocadillo y Queso)…"
            className="field flex-1"
          />
          <button onClick={addFlavor} disabled={adding || !newName.trim()} className="btn btn-primary" style={{ minHeight: 44, padding: '10px 14px' }}>
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>
        ) : flavors.length === 0 ? (
          <p className="text-[12.5px] px-1" style={{ color: 'var(--text-3)' }}>Aún no hay sabores. Agrega el primero arriba.</p>
        ) : (
          <div className="space-y-1.5">
            {flavors.map(f => (
              <div key={f.id} className="card p-2.5 flex items-center gap-2">
                <span className="flex-1 text-[13.5px] font-medium" style={{ color: f.active ? 'var(--text-1)' : 'var(--text-3)' }}>
                  {f.name}{!f.active && ' (oculto)'}
                </span>
                <button
                  onClick={() => patchFlavor(f.id, { active: !f.active })}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                  style={f.active
                    ? { background: 'var(--success-soft)', color: '#15803D' }
                    : { background: 'var(--surface-2)', color: 'var(--text-3)' }}
                  title={f.active ? 'Activo (visible)' : 'Oculto'}
                >
                  {f.active ? 'Activo' : 'Oculto'}
                </button>
                <button onClick={() => renameFlavor(f)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }} aria-label={`Editar ${f.name}`}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deleteFlavor(f)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--danger-soft)', color: '#B91C1C' }} aria-label={`Eliminar ${f.name}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sección B: asignar sabores a un producto */}
      <section>
        <h3 className="text-[12px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--brand-deep)' }}>Asignar sabores a un producto</h3>

        <select
          value={selected}
          onChange={e => onSelectProduct(e.target.value)}
          className="field mb-3"
        >
          <option value="">Elige un producto…</option>
          {productOptions.map(p => (
            <option key={p.id} value={p.id}>{p.category} · {p.name}{p.has_flavors ? '  ✓' : ''}</option>
          ))}
        </select>

        {!selected ? (
          <p className="text-[12.5px] px-1" style={{ color: 'var(--text-3)' }}>Elige un producto para configurar sus sabores.</p>
        ) : loadingAssign ? (
          <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>
        ) : flavors.length === 0 ? (
          <p className="text-[12.5px] px-1" style={{ color: 'var(--text-3)' }}>Primero crea sabores arriba.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              {assign.map(a => (
                <div key={a.id} className="card p-2.5 flex items-center gap-2.5">
                  <button
                    onClick={() => toggleAssigned(a.id)}
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={a.assigned
                      ? { background: 'var(--brand)', color: '#fff' }
                      : { background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                    aria-label={a.assigned ? `Quitar ${a.name}` : `Ofrecer ${a.name}`}
                    aria-pressed={a.assigned}
                  >
                    {a.assigned && <Check className="w-4 h-4" />}
                  </button>
                  <span className="flex-1 text-[13.5px]" style={{ color: a.assigned ? 'var(--text-1)' : 'var(--text-3)' }}>
                    {a.name}{!a.active && ' (sabor oculto)'}
                  </span>
                  {a.assigned && (
                    <button
                      onClick={() => toggleAvailable(a.id)}
                      className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                      style={a.available
                        ? { background: 'var(--success-soft)', color: '#15803D' }
                        : { background: 'var(--warning-soft)', color: '#B45309' }}
                    >
                      {a.available ? 'Disponible' : 'Agotado'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={saveAssign}
              disabled={savingAssign}
              className="btn btn-primary w-full mt-3 disabled:opacity-60"
              style={{ minHeight: 46 }}
            >
              {savingAssign ? <RefreshCw className="w-4 h-4 animate-spin" /> : savedOk ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {savingAssign ? 'Guardando…' : savedOk ? 'Guardado' : 'Guardar sabores del producto'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
