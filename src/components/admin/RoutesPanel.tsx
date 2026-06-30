'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, MapPin, Trash2, Radio, Route as RouteIcon, Clock, Plus, Users } from 'lucide-react';
import RouteMap, { type MapRoute } from './RouteMap';
import { formatDistance, type RoutePoint } from '@/lib/routes';

interface RouteRow {
  id: string;
  driver: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  distance_m: number;
  last_lat: number | null;
  last_lng: number | null;
  last_at: string | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
  points?: RoutePoint[] | null;
}

interface Driver { id: string; name: string; phone: string | null; active: boolean }

const PALETTE = ['#FF5100', '#2563eb', '#9333ea', '#0891b2', '#ca8a04'];
const POLL_MS = 6000;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtDuration(startIso: string, endIso: string | null): string {
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - new Date(startIso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
function destOf(r: RouteRow): { lat: number; lng: number } | null {
  return r.dest_lat != null && r.dest_lng != null ? { lat: r.dest_lat, lng: r.dest_lng } : null;
}

export default function RoutesPanel() {
  const [active, setActive] = useState<RouteRow[]>([]);
  const [history, setHistory] = useState<RouteRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteRow | null>(null);
  const [loading, setLoading] = useState(true);
  const firstLoad = useRef(true);

  // Domiciliarios
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [newDriver, setNewDriver] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addingDriver, setAddingDriver] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/admin/routes');
      if (res.ok) {
        const data = await res.json() as { active: RouteRow[]; history: RouteRow[] };
        setActive(data.active ?? []);
        setHistory(data.history ?? []);
      }
    } catch { /* ignore */ } finally {
      if (firstLoad.current) { setLoading(false); firstLoad.current = false; }
    }
  };

  const loadDrivers = async () => {
    try {
      const res = await fetch('/api/admin/drivers');
      if (res.ok) setDrivers(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    loadDrivers();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selectedId) { setSelectedRoute(null); return; }
    if (active.some(a => a.id === selectedId)) { setSelectedRoute(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/routes/${selectedId}`);
        if (res.ok && !cancelled) setSelectedRoute(await res.json());
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [selectedId, active]);

  const drawn: MapRoute[] = useMemo(() => {
    const out: MapRoute[] = active.map((r, i) => ({
      id: r.id,
      driver: r.driver,
      status: 'active',
      color: PALETTE[i % PALETTE.length],
      points: (r.points as RoutePoint[]) ?? [],
      dest: destOf(r),
    }));
    if (selectedRoute && !active.some(a => a.id === selectedRoute.id)) {
      out.push({
        id: selectedRoute.id,
        driver: selectedRoute.driver,
        status: selectedRoute.status,
        color: '#FF5100',
        points: (selectedRoute.points as RoutePoint[]) ?? [],
        dest: destOf(selectedRoute),
      });
    }
    return out;
  }, [active, selectedRoute]);

  const deleteRoute = async (r: RouteRow, isActive = false) => {
    const msg = isActive
      ? `¿Eliminar la ruta activa de ${r.driver}? Se detiene el rastreo, se borra el recorrido y, si era una entrega, el pedido vuelve a "por entregar".`
      : `¿Eliminar el recorrido de ${r.driver} del ${fmtDate(r.started_at)}? No se puede deshacer.`;
    if (!confirm(msg)) return;
    const prevA = active, prevH = history;
    setActive(curr => curr.filter(x => x.id !== r.id));
    setHistory(curr => curr.filter(x => x.id !== r.id));
    if (selectedId === r.id) setSelectedId(null);
    try {
      // Rutas activas: cancel (borra + revierte el pedido). Historial: delete simple.
      const res = isActive
        ? await fetch('/api/route/cancel', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: r.id }),
          })
        : await fetch(`/api/admin/routes/${r.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch { setActive(prevA); setHistory(prevH); }
  };

  const addDriver = async () => {
    const name = newDriver.trim();
    if (!name) return;
    setAddingDriver(true);
    try {
      const res = await fetch('/api/admin/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: newPhone.trim() || null }),
      });
      if (res.ok) { const created = await res.json() as Driver; setDrivers(curr => [...curr, created]); setNewDriver(''); setNewPhone(''); }
    } catch { /* ignore */ } finally { setAddingDriver(false); }
  };

  const toggleDriver = async (d: Driver) => {
    const prev = drivers;
    setDrivers(curr => curr.map(x => x.id === d.id ? { ...x, active: !x.active } : x));
    try {
      const res = await fetch(`/api/admin/drivers/${d.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !d.active }),
      });
      if (!res.ok) throw new Error();
    } catch { setDrivers(prev); }
  };

  const deleteDriver = async (d: Driver) => {
    if (!confirm(`¿Eliminar al domiciliario "${d.name}"?`)) return;
    const prev = drivers;
    setDrivers(curr => curr.filter(x => x.id !== d.id));
    try {
      const res = await fetch(`/api/admin/drivers/${d.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch { setDrivers(prev); }
  };

  return (
    <div className="pb-10">
      {/* Mapa */}
      <div data-tour="rutas-map" className="mb-3">
        <RouteMap routes={drawn} height={360} />
      </div>

      {/* Nota: este panel es solo de monitoreo. Las rutas las inician los
          domiciliarios desde el panel del equipo (pestaña "Reparto"). */}
      <p className="mb-5 text-[12px] leading-snug px-1" style={{ color: 'var(--text-3)' }}>
        Monitoreo en vivo del reparto. Los domiciliarios inician sus rutas desde la pestaña <b>Reparto</b> del equipo o desde un pedido.
      </p>

      {/* Domiciliarios en ruta */}
      <div data-tour="rutas-live" className="flex items-center justify-between mb-2">
        <h3 className="text-[12px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--brand-deep)' }}>
          <Radio className="w-3.5 h-3.5" /> En ruta ahora
        </h3>
        <button onClick={load} className="btn btn-ghost" style={{ padding: '6px 8px', border: '1px solid var(--border)' }} aria-label="Recargar">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>
      ) : active.length === 0 ? (
        <div className="card p-4 mb-5 text-[12.5px]" style={{ color: 'var(--text-2)' }}>
          Ningún domiciliario en ruta ahora. Aparecerán aquí en cuanto el equipo inicie un reparto.
        </div>
      ) : (
        <div className="space-y-2 mb-5">
          {active.map((r, i) => (
            <div key={r.id} className="card p-3.5 flex items-center gap-3" style={{ borderLeft: `3px solid ${PALETTE[i % PALETTE.length]}` }}>
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#16a34a' }} />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#16a34a' }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold" style={{ color: 'var(--text-1)' }}>
                  {r.driver}{destOf(r) ? ' · entrega' : ''}
                </p>
                <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                  Desde {fmtTime(r.started_at)} · {fmtDuration(r.started_at, null)} · {formatDistance(r.distance_m)}
                </p>
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded" style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)' }}>EN VIVO</span>
              <button
                onClick={() => deleteRoute(r, true)}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--danger-soft)', color: '#B91C1C' }}
                aria-label={`Eliminar ruta activa de ${r.driver}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Historial */}
      <h3 data-tour="rutas-history" className="text-[12px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-2)' }}>
        <RouteIcon className="w-3.5 h-3.5" /> Recorridos anteriores
      </h3>
      {history.length === 0 ? (
        <p className="text-[12px] px-1 mb-6" style={{ color: 'var(--text-3)' }}>Aún no hay recorridos guardados.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {history.map(r => {
            const sel = selectedId === r.id;
            return (
              <div
                key={r.id}
                className="card p-3.5 flex items-center gap-3 cursor-pointer transition-all"
                style={sel ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)' } : undefined}
                onClick={() => setSelectedId(sel ? null : r.id)}
              >
                <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: sel ? 'var(--brand)' : 'var(--text-3)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--text-1)' }}>{r.driver}</p>
                  <p className="text-[11.5px] inline-flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                    <Clock className="w-3 h-3" /> {fmtDate(r.started_at)} · {fmtDuration(r.started_at, r.ended_at)} · {formatDistance(r.distance_m)}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteRoute(r); }}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--danger-soft)', color: '#B91C1C' }}
                  aria-label={`Eliminar recorrido de ${r.driver}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Domiciliarios (registro) */}
      <h3 data-tour="rutas-drivers" className="text-[12px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-2)' }}>
        <Users className="w-3.5 h-3.5" /> Domiciliarios
      </h3>
      <div className="flex items-center gap-2 mb-3">
        <input value={newDriver} onChange={e => setNewDriver(e.target.value)} placeholder="Nombre" className="field flex-1" />
        <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Teléfono (opcional)" className="field" style={{ maxWidth: 150 }} />
        <button onClick={addDriver} disabled={addingDriver || !newDriver.trim()} className="btn btn-primary" style={{ minHeight: 44, padding: '10px 14px' }}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {drivers.length === 0 ? (
        <p className="text-[12px] px-1" style={{ color: 'var(--text-3)' }}>Sin domiciliarios registrados. Agrega el primero arriba.</p>
      ) : (
        <div className="space-y-1.5">
          {drivers.map(d => (
            <div key={d.id} className="card p-2.5 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium" style={{ color: d.active ? 'var(--text-1)' : 'var(--text-3)' }}>{d.name}</p>
                {d.phone && <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{d.phone}</p>}
              </div>
              <button
                onClick={() => toggleDriver(d)}
                className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                style={d.active ? { background: 'var(--success-soft)', color: '#15803D' } : { background: 'var(--surface-2)', color: 'var(--text-3)' }}
              >
                {d.active ? 'Activo' : 'Inactivo'}
              </button>
              <button onClick={() => deleteDriver(d)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--danger-soft)', color: '#B91C1C' }} aria-label={`Eliminar ${d.name}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
