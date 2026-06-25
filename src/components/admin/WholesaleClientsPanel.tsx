'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  RefreshCw, Search, Users, MessageCircle, Trash2, Plus, Pencil, X,
  MapPin, Phone, CalendarDays,
} from 'lucide-react';

interface WClient {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  route: string | null;
  area: string | null;
  notes: string | null;
  active: boolean;
}

/** Rutas de reparto: clave guardada → etiqueta y zona que muestra el panel. */
const ROUTES: { value: string; label: string; area: string }[] = [
  { value: 'lun_jue', label: 'Lunes y Jueves', area: 'Barrancas / Puente Real' },
  { value: 'mie_sab', label: 'Miércoles y Sábado', area: 'Palo Gordo / Las Vegas' },
];

function routeLabel(route: string | null): string {
  return ROUTES.find(r => r.value === route)?.label ?? 'Sin ruta asignada';
}

/** Número listo para wa.me: solo dígitos; un 0 inicial (VE) se cambia por 58. */
function waNumber(phone: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('0')) d = '58' + d.slice(1);
  return d;
}

type Draft = Partial<WClient> & { id?: string };

export default function WholesaleClientsPanel() {
  const [rows, setRows] = useState<WClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null); // null = cerrado
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/wholesale-clients');
      if (res.ok) setRows(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.phone ?? '').includes(q) ||
      (r.address ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  // Agrupar por ruta, respetando el orden de ROUTES y dejando "sin ruta" al final.
  const groups = useMemo(() => {
    const order = [...ROUTES.map(r => r.value), '__none__'];
    const byRoute = new Map<string, WClient[]>();
    for (const c of filtered) {
      const key = c.route && ROUTES.some(r => r.value === c.route) ? c.route : '__none__';
      const arr = byRoute.get(key) ?? [];
      arr.push(c);
      byRoute.set(key, arr);
    }
    return order
      .filter(k => byRoute.has(k))
      .map(k => ({ key: k, items: byRoute.get(k)!, label: k === '__none__' ? 'Sin ruta asignada' : routeLabel(k) }));
  }, [filtered]);

  const deleteClient = async (c: WClient) => {
    if (!confirm(`¿Eliminar a ${c.name} de la cartera? Esta acción no se puede deshacer.`)) return;
    const prev = rows;
    setRows(curr => curr.filter(r => r.id !== c.id));
    try {
      const res = await fetch(`/api/admin/wholesale-clients/${c.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setRows(prev); // revierte si falla
    }
  };

  const openNew = () => { setFormError(''); setDraft({ route: 'lun_jue', active: true }); };
  const openEdit = (c: WClient) => { setFormError(''); setDraft({ ...c }); };

  const save = async () => {
    if (!draft) return;
    const name = (draft.name ?? '').trim();
    if (!name) { setFormError('El nombre es obligatorio.'); return; }
    setSaving(true);
    setFormError('');
    const isEdit = !!draft.id;
    // Asigna la zona automáticamente según la ruta elegida.
    const area = ROUTES.find(r => r.value === draft.route)?.area ?? null;
    const payload = {
      name,
      phone: draft.phone ?? null,
      address: draft.address ?? null,
      route: draft.route ?? null,
      area,
      notes: draft.notes ?? null,
      active: draft.active ?? true,
    };
    try {
      const res = await fetch(
        isEdit ? `/api/admin/wholesale-clients/${draft.id}` : '/api/admin/wholesale-clients',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: string };
        setFormError(e.error ?? 'No se pudo guardar. Intenta de nuevo.');
        return;
      }
      const saved = await res.json() as WClient;
      setRows(curr => isEdit
        ? curr.map(r => (r.id === saved.id ? saved : r))
        : [...curr, saved],
      );
      setDraft(null);
    } catch {
      setFormError('Error de conexión. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-10">
      {/* Stats */}
      <div data-tour="mayoristas-stats" className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="card p-3.5">
          <Users className="w-4 h-4 mb-1.5" style={{ color: 'var(--text-3)' }} />
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Clientes</p>
          <p className="text-[20px] font-bold mt-0.5 t-num" style={{ color: 'var(--text-1)' }}>{rows.length}</p>
        </div>
        {ROUTES.map(r => (
          <div key={r.value} className="card p-3.5">
            <CalendarDays className="w-4 h-4 mb-1.5" style={{ color: 'var(--text-3)' }} />
            <p className="text-[11px] leading-tight" style={{ color: 'var(--text-3)' }}>{r.label}</p>
            <p className="text-[20px] font-bold mt-0.5 t-num" style={{ color: 'var(--text-1)' }}>
              {rows.filter(c => c.route === r.value).length}
            </p>
          </div>
        ))}
      </div>

      {/* Search + add */}
      <div className="flex items-center gap-2 mb-3">
        <div data-tour="mayoristas-search" className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, teléfono o dirección…" className="field" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <button onClick={load} className="btn btn-ghost" style={{ padding: '10px', minWidth: 44, minHeight: 44, border: '1px solid var(--border)' }} aria-label="Recargar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button data-tour="mayoristas-add" onClick={openNew} className="btn btn-primary" style={{ padding: '10px 14px', minHeight: 44 }}>
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {/* List grouped by route */}
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>
      ) : groups.length === 0 ? (
        <div className="card text-center py-14 px-6">
          <Users className="w-9 h-9 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>Sin clientes en la cartera</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>Agrega el primero con el botón “Nuevo”.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(g => (
            <div key={g.key}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-[12px] font-bold uppercase tracking-widest" style={{ color: 'var(--brand-deep)' }}>{g.label}</h3>
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>{g.items.length}</span>
              </div>
              <div className="space-y-2">
                {g.items.map(c => {
                  const wa = waNumber(c.phone);
                  return (
                    <div key={c.id} className="card p-3.5">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold mt-0.5"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] font-semibold" style={{ color: 'var(--text-1)' }}>{c.name}</p>
                          {c.phone && (
                            <p className="text-[11.5px] mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                              <Phone className="w-3 h-3" /> {c.phone}
                            </p>
                          )}
                          {c.address && (
                            <p className="text-[11.5px] mt-0.5 flex items-start gap-1" style={{ color: 'var(--text-2)' }}>
                              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /> <span>{c.address}</span>
                            </p>
                          )}
                          {c.notes && (
                            <p className="text-[11px] mt-1 italic" style={{ color: 'var(--accent-deep, var(--text-3))' }}>{c.notes}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          {wa && (
                            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"
                              className="w-9 h-9 rounded-full flex items-center justify-center"
                              style={{ background: 'rgba(37,211,102,0.12)', color: '#1faa52' }} aria-label="WhatsApp">
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                          <button onClick={() => openEdit(c)} className="w-9 h-9 rounded-full flex items-center justify-center"
                            style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }} aria-label={`Editar ${c.name}`} title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteClient(c)} className="w-9 h-9 rounded-full flex items-center justify-center"
                            style={{ background: 'var(--danger-soft)', color: '#B91C1C' }} aria-label={`Eliminar ${c.name}`} title="Eliminar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => !saving && setDraft(null)} />
          <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden" style={{ background: 'var(--surface)', maxHeight: '92vh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>{draft.id ? 'Editar cliente' : 'Nuevo cliente al mayor'}</h2>
              <button onClick={() => !saving && setDraft(null)} className="p-1" style={{ color: 'var(--text-3)' }} aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-4 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 130px)' }}>
              <div>
                <label htmlFor="wc-name" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>Nombre *</label>
                <input id="wc-name" value={draft.name ?? ''} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Nombre del cliente o negocio" className="field" />
              </div>
              <div>
                <label htmlFor="wc-phone" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>Teléfono</label>
                <input id="wc-phone" type="tel" inputMode="tel" value={draft.phone ?? ''} onChange={e => setDraft({ ...draft, phone: e.target.value })} placeholder="0414-0000000" className="field" />
              </div>
              <div>
                <label htmlFor="wc-address" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>Dirección</label>
                <textarea id="wc-address" value={draft.address ?? ''} onChange={e => setDraft({ ...draft, address: e.target.value })} placeholder="Calle, sector, punto de referencia…" rows={2} className="field resize-none" />
              </div>
              <div>
                <label htmlFor="wc-route" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>Ruta / día de entrega</label>
                <select id="wc-route" value={draft.route ?? ''} onChange={e => setDraft({ ...draft, route: e.target.value || null })} className="field">
                  <option value="">Sin ruta asignada</option>
                  {ROUTES.map(r => (
                    <option key={r.value} value={r.value}>{r.label} · {r.area}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="wc-notes" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>Notas</label>
                <input id="wc-notes" value={draft.notes ?? ''} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Opcional" className="field" />
              </div>
              {formError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{formError}</p>}
            </div>
            <div className="px-4 py-3 border-t flex gap-2" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setDraft(null)} disabled={saving} className="btn btn-ghost flex-1" style={{ minHeight: 44, border: '1px solid var(--border)' }}>Cancelar</button>
              <button onClick={save} disabled={saving} className="btn btn-primary flex-1" style={{ minHeight: 44 }}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
