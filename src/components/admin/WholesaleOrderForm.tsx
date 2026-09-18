'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X, Minus, Plus, Store, MapPin, Phone, Layers, Trash2, Save } from 'lucide-react';
import type { Product } from '@/lib/products';
import { useProductModal } from '@/components/ProductModal';
import type { DriverChoice } from '@/components/RouteTracking';
import { routeLabel } from '@/lib/wholesaleRoutes';
import {
  MAX_AHEAD_DAYS,
  addDays,
  formatCop,
  formatUsd,
  formatVes,
  formatYmd,
  lineKey,
  normalizeSearch,
  orderTotals,
  wholesaleUnitPrices,
  type StoredRates,
  type WholesaleOrder,
} from '@/lib/wholesaleOrders';

interface ClientLite {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  route: string | null;
  active: boolean;
}

interface Line {
  key: string;
  product_id: string;
  flavor_id: string | null;
  name: string;
  qty: number;
  unit_usd: number;
  unit_cop: number;
}

interface Props {
  me: DriverChoice | null;
  today: string;
  rates: StoredRates | null;
  editing: WholesaleOrder | null;
  onSaved: (order: WholesaleOrder) => void;
  onCancelEdit: () => void;
}

const MAX_RESULTS = 12;
const DRAFT_KEY = 'rl_wo_draft';

interface Draft {
  client: ClientLite | null;
  date: string;
  lines: Line[];
  notes: string;
}

/**
 * El pedido a medio escribir sobrevive a cambiar de pestaña o a que el teléfono
 * cierre la app durante la llamada: se guarda en el propio teléfono.
 */
function loadDraft(today: string): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d || !Array.isArray(d.lines)) return null;
    return { ...d, date: d.date && d.date >= today ? d.date : today };
  } catch { return null; }
}
function writeDraft(d: Draft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore */ }
}

/** Al editar, el panel monta el formulario con `key` del pedido: el estado arranca con sus datos. */
export default function WholesaleOrderForm({ me, today, rates, editing, onSaved, onCancelEdit }: Props) {
  const modal = useProductModal();
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clientQuery, setClientQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  // Al editar mandan los datos del pedido; si no, lo que quedó a medio escribir.
  const [draft] = useState<Draft | null>(() => (editing ? null : loadDraft(today)));
  const [client, setClient] = useState<ClientLite | null>(() => (editing
    ? {
      id: editing.client_id ?? '',
      name: editing.client_name,
      phone: editing.client_phone,
      address: editing.client_address,
      route: editing.client_route,
      active: true,
    }
    : draft?.client ?? null));
  const [date, setDate] = useState(editing?.delivery_date ?? draft?.date ?? today);
  const [lines, setLines] = useState<Line[]>(() => (editing
    ? editing.items.map(i => ({ ...i, key: lineKey(i.product_id, i.flavor_id) }))
    : draft?.lines ?? []));
  const [notes, setNotes] = useState(editing?.notes ?? draft?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/wholesale-clients')
      .then(r => (r.ok ? r.json() : []))
      .then((data: ClientLite[]) => setClients(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch('/api/products')
      .then(r => (r.ok ? r.json() : []))
      .then((data: Product[]) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Guarda lo escrito en este teléfono mientras el pedido no se haya guardado.
  useEffect(() => {
    if (editing) return;
    const empty = !client && lines.length === 0 && !notes.trim();
    writeDraft(empty ? null : { client, date, lines, notes });
  }, [editing, client, date, lines, notes]);

  const copRate = rates?.cop_per_usd ?? 0;

  const clientResults = useMemo(() => {
    const q = normalizeSearch(clientQuery.trim());
    if (!q) return [];
    const digits = q.replace(/\D/g, '');
    return clients
      .filter(c => c.active && (
        normalizeSearch(c.name).includes(q) ||
        (digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits)) ||
        normalizeSearch(c.address ?? '').includes(q)
      ))
      .slice(0, 8);
  }, [clients, clientQuery]);

  const productResults = useMemo(() => {
    const q = normalizeSearch(productQuery.trim());
    if (!q) return [];
    return products
      .filter(p => p.available && p.type !== 'detal' && (
        normalizeSearch(p.name).includes(q) || normalizeSearch(p.units ?? '').includes(q)
      ))
      .slice(0, MAX_RESULTS);
  }, [products, productQuery]);

  const addLine = (line: Omit<Line, 'key'>) => {
    const key = lineKey(line.product_id, line.flavor_id);
    setLines(curr => {
      const existing = curr.find(l => l.key === key);
      if (existing) return curr.map(l => (l.key === key ? { ...l, qty: l.qty + line.qty } : l));
      return [...curr, { ...line, key }];
    });
  };

  const addProduct = (p: Product) => {
    const base = { wholesale_price_usd: p.wholesale_price_usd, wholesale_price_cop: p.wholesale_price_cop ?? null };
    if (!p.has_flavors) {
      addLine({ product_id: p.id, flavor_id: null, name: p.name, qty: 1, ...wholesaleUnitPrices(base, null, copRate) });
      return;
    }
    modal.open(
      p,
      ({ flavor, quantity }) => {
        if (flavor) {
          addLine({
            product_id: p.id,
            flavor_id: flavor.id,
            name: `${p.name} · ${flavor.name}`,
            qty: quantity ?? 1,
            ...wholesaleUnitPrices(base, flavor, copRate),
          });
        } else {
          addLine({ product_id: p.id, flavor_id: null, name: p.name, qty: 1, ...wholesaleUnitPrices(base, null, copRate) });
        }
      },
      {
        priceOverride: { price_usd: p.wholesale_price_usd, price_cop: p.wholesale_price_cop },
        allowFlavors: true,
        wholesale: true,
      },
    );
  };

  const setQty = (key: string, qty: number) =>
    setLines(curr => curr.map(l => (l.key === key ? { ...l, qty: Math.max(0, Math.floor(qty) || 0) } : l)));
  const removeLine = (key: string) => setLines(curr => curr.filter(l => l.key !== key));

  const totals = orderTotals(lines);
  const units = lines.reduce((s, l) => s + l.qty, 0);
  const dateLocked = !!editing?.driver_name;

  const reset = () => {
    setClient(null);
    setClientQuery('');
    setProductQuery('');
    setLines([]);
    setNotes('');
    setDate(today);
    writeDraft(null);
  };

  const save = async (allowDuplicate = false) => {
    setError('');
    if (!client) { setError('Elige el mayorista.'); return; }
    if (lines.length === 0) { setError('Agrega al menos un producto.'); return; }
    if (lines.some(l => l.qty <= 0)) { setError('Cada producto necesita al menos 1 unidad.'); return; }
    setSaving(true);
    const items = lines.map(l => ({ product_id: l.product_id, flavor_id: l.flavor_id, qty: l.qty }));
    try {
      const res = editing
        ? await fetch(`/api/admin/wholesale-orders/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit', items, notes, ...(dateLocked ? {} : { delivery_date: date }) }),
        })
        : await fetch('/api/admin/wholesale-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: client.id,
            delivery_date: date,
            items,
            notes,
            created_by: me?.name ?? null,
            ...(allowDuplicate ? { allow_duplicate: true } : {}),
          }),
        });
      const data = await res.json().catch(() => ({})) as WholesaleOrder & { error?: string; duplicate?: boolean };
      // Ya existe un pedido de ese mayorista ese día: se guarda solo si lo confirman.
      if (res.status === 409 && data.duplicate && !allowDuplicate) {
        setSaving(false);
        if (confirm(`${data.error}\n\n¿Guardar este pedido igual?`)) await save(true);
        return;
      }
      if (!res.ok) { setError(data.error ?? 'No se pudo guardar. Intenta de nuevo.'); return; }
      if (!editing) reset();
      onSaved(data);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const label = 'text-[12px] font-bold uppercase tracking-widest mb-2';

  return (
    <div className="pb-6 space-y-5">
      {editing && (
        <div className="card p-3 flex items-center justify-between gap-2" style={{ background: 'var(--info-soft)' }}>
          <p className="text-[13px] font-semibold" style={{ color: '#1D4ED8' }}>Editando pedido de {editing.client_name}</p>
          <button onClick={onCancelEdit} className="text-[12px] font-semibold" style={{ color: '#1D4ED8' }}>Cancelar</button>
        </div>
      )}

      {/* Mayorista */}
      <section>
        <h3 className={label} style={{ color: 'var(--brand-deep)' }}>Mayorista</h3>
        {client ? (
          <div className="card p-3.5 flex items-start gap-3">
            <Store className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--brand)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>{client.name}</p>
              {client.phone && (
                <p className="text-[12px] mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                  <Phone className="w-3 h-3" /> {client.phone}
                </p>
              )}
              {client.address && (
                <p className="text-[12px] mt-0.5 flex items-start gap-1" style={{ color: 'var(--text-2)' }}>
                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /> <span>{client.address}</span>
                </p>
              )}
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>{routeLabel(client.route)}</p>
            </div>
            {!editing && (
              <button onClick={() => { setClient(null); setClientQuery(''); }} className="text-[12px] font-semibold flex-shrink-0" style={{ color: 'var(--brand-deep)' }}>
                Cambiar
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-3)' }} />
              <label htmlFor="wo-client" className="sr-only">Buscar mayorista</label>
              <input id="wo-client" value={clientQuery} onChange={e => setClientQuery(e.target.value)}
                placeholder="Nombre, teléfono o dirección…" className="field" style={{ paddingLeft: '2.25rem' }} autoComplete="off" />
            </div>
            {clientQuery.trim() && (
              <div className="mt-2 space-y-1.5">
                {clientResults.map(c => (
                  <button key={c.id} onClick={() => { setClient(c); setClientQuery(''); }} className="card w-full text-left p-3">
                    <p className="text-[13.5px] font-semibold" style={{ color: 'var(--text-1)' }}>{c.name}</p>
                    <p className="text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>
                      {[c.phone, c.address].filter(Boolean).join(' · ')}
                    </p>
                  </button>
                ))}
                {clientResults.length === 0 && (
                  <p className="text-[12.5px] px-1 py-2" style={{ color: 'var(--text-2)' }}>
                    No aparece ningún mayorista activo con ese nombre. Pídele al administrador que lo agregue en <b>Mayoristas</b>.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Fecha: hoy o cualquier día planeado */}
      <section>
        <h3 className={label} style={{ color: 'var(--brand-deep)' }}>Día de entrega</h3>
        <div className="flex gap-2">
          <label htmlFor="wo-date" className="sr-only">Día de entrega</label>
          <input
            id="wo-date" type="date" value={date} disabled={dateLocked}
            min={today} max={addDays(today, MAX_AHEAD_DAYS)}
            onChange={e => { if (e.target.value) setDate(e.target.value); }}
            className="field flex-1 t-num" style={{ minHeight: 48 }}
          />
          {date !== today && !dateLocked && (
            <button onClick={() => setDate(today)} className="btn btn-ghost whitespace-nowrap"
              style={{ minHeight: 48, border: '1px solid var(--border)' }}>
              Hoy
            </button>
          )}
        </div>
        <p className="text-[12px] mt-1.5 capitalize" style={{ color: 'var(--text-3)' }}>
          {formatYmd(date)}
          {date === today ? ' · hoy' : date === addDays(today, 1) ? ' · mañana' : ''}
        </p>
        {dateLocked && (
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--text-3)' }}>Lo lleva {editing?.driver_name}: suéltalo para cambiar la fecha.</p>
        )}
      </section>

      {/* Productos */}
      <section>
        <h3 className={label} style={{ color: 'var(--brand-deep)' }}>Productos al mayor</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-3)' }} />
          <label htmlFor="wo-product" className="sr-only">Buscar producto</label>
          <input id="wo-product" value={productQuery} onChange={e => setProductQuery(e.target.value)}
            placeholder="Buscar producto…" className="field" style={{ paddingLeft: '2.25rem' }} autoComplete="off" />
        </div>
        {productQuery.trim() && (
          <div className="mt-2 space-y-1.5">
            {productResults.map(p => {
              const prices = wholesaleUnitPrices(
                { wholesale_price_usd: p.wholesale_price_usd, wholesale_price_cop: p.wholesale_price_cop ?? null }, null, copRate,
              );
              return (
                <div key={p.id} className="card p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold" style={{ color: 'var(--text-1)' }}>{p.name}</p>
                    <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                      {p.units ? `${p.units} · ` : ''}
                      {p.has_flavors ? 'Desde ' : ''}{formatCop(prices.unit_cop)} · {formatUsd(prices.unit_usd)}
                    </p>
                  </div>
                  <button onClick={() => addProduct(p)} className="btn btn-brand-soft flex-shrink-0" style={{ minHeight: 44, padding: '8px 12px' }}>
                    {p.has_flavors ? <><Layers className="w-4 h-4" /> Sabores</> : <><Plus className="w-4 h-4" /> Agregar</>}
                  </button>
                </div>
              );
            })}
            {productResults.length === 0 && (
              <p className="text-[12.5px] px-1 py-2" style={{ color: 'var(--text-3)' }}>Ningún producto al mayor con ese nombre.</p>
            )}
          </div>
        )}

        {lines.length > 0 && (
          <div className="mt-3 space-y-2">
            {lines.map(l => (
              <div key={l.key} className="card p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold" style={{ color: 'var(--text-1)' }}>{l.name}</p>
                    <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{formatCop(l.unit_cop)} c/u · {formatUsd(l.unit_usd)}</p>
                  </div>
                  <button onClick={() => removeLine(l.key)} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--danger-soft)', color: '#B91C1C' }} aria-label={`Quitar ${l.name}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setQty(l.key, l.qty - 1)} className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }} aria-label="Una unidad menos">
                      <Minus className="w-4 h-4" />
                    </button>
                    <label htmlFor={`qty-${l.key}`} className="sr-only">Unidades de {l.name}</label>
                    <input id={`qty-${l.key}`} inputMode="numeric" value={l.qty === 0 ? '' : String(l.qty)}
                      onChange={e => setQty(l.key, Number(e.target.value.replace(/\D/g, '')))}
                      className="field text-center t-num" style={{ width: 76, minHeight: 44 }} />
                    <button onClick={() => setQty(l.key, l.qty + 1)} className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }} aria-label="Una unidad más">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[14px] font-bold t-num" style={{ color: 'var(--text-1)' }}>{formatCop(l.qty * l.unit_cop)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Notas */}
      <section>
        <label htmlFor="wo-notes" className={`block ${label}`} style={{ color: 'var(--brand-deep)' }}>Notas</label>
        <textarea id="wo-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Opcional: hora, referencia, lo que pidió el cliente…" className="field resize-none" />
      </section>

      {/* Totales */}
      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--text-2)' }}>
            Total · {lines.length} {lines.length === 1 ? 'producto' : 'productos'} · {units} unid.
          </p>
          <p className="text-[22px] font-bold t-num" style={{ color: 'var(--text-1)' }}>{formatCop(totals.total_cop)}</p>
        </div>
        <p className="text-[12px] text-right t-num" style={{ color: 'var(--text-3)' }}>
          {formatUsd(totals.total_usd)}{rates ? ` · ${formatVes(totals.total_usd * rates.bs_per_usd)}` : ''}
        </p>
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>Los precios se confirman con el catálogo al guardar.</p>
      </div>

      {error && <p className="text-[13px] font-semibold" style={{ color: 'var(--danger)' }}>{error}</p>}

      <button onClick={() => save()} disabled={saving} className="btn btn-primary w-full" style={{ minHeight: 52, fontSize: 15 }}>
        <Save className="w-5 h-5" /> {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar pedido'}
      </button>
      {!editing && lines.length > 0 && (
        <button onClick={reset} className="w-full text-[12.5px] font-semibold inline-flex items-center justify-center gap-1" style={{ color: 'var(--text-3)' }}>
          <X className="w-3.5 h-3.5" /> Vaciar formulario
        </button>
      )}
    </div>
  );
}
