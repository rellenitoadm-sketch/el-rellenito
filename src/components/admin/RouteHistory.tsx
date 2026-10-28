'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Clock, MapPin, Package, RefreshCw, Route as RouteIcon, Trash2, AlertCircle } from 'lucide-react';
import RouteMap, { type MapRoute } from './RouteMap';
import { formatDistance, type RoutePoint } from '@/lib/routes';

interface HistoryRow {
  id: string;
  driver: string;
  started_at: string;
  ended_at: string | null;
  distance_m: number;
  note: string | null;
  customer: string | null;
}

interface Detail {
  id: string;
  driver: string;
  status: string;
  points: RoutePoint[] | null;
  dest_lat: number | null;
  dest_lng: number | null;
}

const COLOR = '#FF5100';

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA'); // YYYY-MM-DD en hora local
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const key = dayOf(iso);
  if (key === dayOf(new Date().toISOString())) return 'Hoy';
  if (key === dayOf(new Date(Date.now() - 86400_000).toISOString())) return 'Ayer';
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}
function duration(a: string, b: string | null): string {
  const mins = Math.max(0, Math.round(((b ? new Date(b).getTime() : Date.now()) - new Date(a).getTime()) / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * Recorridos terminados, agrupados por día. Al tocar uno se abre el mapa JUSTO debajo
 * (antes el mapa quedaba arriba, fuera de pantalla, y parecía que no pasaba nada).
 * Lo usan el panel del administrador (con borrar) y el del equipo (solo ver).
 */
export default function RouteHistory({ days = 7, canDelete = false, title = 'Recorridos anteriores' }: { days?: number; canDelete?: boolean; title?: string }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailState, setDetailState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const res = await fetch(`/api/route/history?days=${days}`);
        if (!res.ok) throw new Error();
        const data = await res.json() as HistoryRow[];
        if (!off) { setRows(Array.isArray(data) ? data : []); setError(false); }
      } catch {
        if (!off) setError(true);
      }
    })();
    return () => { off = true; };
  }, [days, reload]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailState('loading');
    setDetail(null);
    try {
      const res = await fetch(`/api/route/history?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error();
      setDetail(await res.json() as Detail);
      setDetailState('idle');
    } catch {
      setDetailState('error');
    }
  }, []);

  const toggle = (id: string) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    void loadDetail(id);
  };

  const remove = async (r: HistoryRow) => {
    if (!confirm(`¿Eliminar el recorrido de ${r.driver} del ${dayLabel(r.started_at)}? No se puede deshacer.`)) return;
    const prev = rows;
    setRows(curr => (curr ?? []).filter(x => x.id !== r.id));
    if (openId === r.id) { setOpenId(null); setDetail(null); }
    try {
      const res = await fetch(`/api/admin/routes/${r.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch { setRows(prev); }
  };

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: HistoryRow[] }[] = [];
    for (const r of rows ?? []) {
      const key = dayOf(r.started_at);
      const g = out.find(x => x.key === key);
      if (g) g.items.push(r); else out.push({ key, label: dayLabel(r.started_at), items: [r] });
    }
    return out;
  }, [rows]);

  const mapRoutes: MapRoute[] = useMemo(() => {
    if (!detail) return [];
    return [{
      id: detail.id,
      driver: detail.driver,
      status: detail.status,
      color: COLOR,
      points: Array.isArray(detail.points) ? detail.points : [],
      dest: detail.dest_lat != null && detail.dest_lng != null ? { lat: detail.dest_lat, lng: detail.dest_lng } : null,
    }];
  }, [detail]);

  const noPoints = detailState === 'idle' && detail != null && mapRoutes[0]?.points.length === 0;

  return (
    <section data-tour="rutas-history">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
          <RouteIcon className="w-4 h-4" /> {title}
        </h3>
        <button onClick={() => setReload(n => n + 1)} className="btn btn-ghost" style={{ minWidth: 44, minHeight: 44, border: '1px solid var(--border)' }} aria-label="Recargar recorridos">
          <RefreshCw className={`w-4 h-4 ${rows === null && !error ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error ? (
        <div className="card p-4 text-[13px]" style={{ color: 'var(--text-2)' }}>
          No se pudieron cargar los recorridos. <button onClick={() => setReload(n => n + 1)} className="font-bold underline" style={{ color: 'var(--brand-deep)' }}>Reintentar</button>
        </div>
      ) : rows === null ? (
        <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>
      ) : rows.length === 0 ? (
        <p className="text-[13px] px-1 py-2" style={{ color: 'var(--text-3)' }}>Aún no hay recorridos terminados en los últimos {days} días.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <div key={g.key}>
              <p className="text-[12px] font-bold capitalize mb-1.5 px-1" style={{ color: 'var(--text-3)' }}>{g.label}</p>
              <div className="space-y-2">
                {g.items.map(r => {
                  const open = openId === r.id;
                  return (
                    <div key={r.id} className="card overflow-hidden" style={open ? { borderColor: 'var(--brand)' } : undefined}>
                      <div className="flex items-center">
                        <button
                          onClick={() => toggle(r.id)}
                          aria-expanded={open}
                          className="flex-1 min-w-0 p-3.5 flex items-center gap-3 text-left"
                          style={{ minHeight: 64 }}
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: open ? 'var(--brand)' : 'var(--brand-soft)', color: open ? '#fff' : 'var(--brand-deep)' }}>
                            <MapPin className="w-5 h-5" aria-hidden />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-bold truncate" style={{ color: 'var(--text-1)' }}>
                              {r.driver}{r.customer ? ` · entrega a ${r.customer}` : ''}
                            </p>
                            <p className="text-[12px] inline-flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                              <Clock className="w-3 h-3" aria-hidden /> {timeOf(r.started_at)}{r.ended_at ? `–${timeOf(r.ended_at)}` : ''} · {duration(r.started_at, r.ended_at)} · {formatDistance(r.distance_m)}
                            </p>
                          </div>
                          <ChevronDown className="w-5 h-5 flex-shrink-0 transition-transform" style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : undefined }} aria-hidden />
                        </button>
                        {canDelete && (
                          <button onClick={() => remove(r)} className="w-12 self-stretch flex items-center justify-center" style={{ color: '#B91C1C' }} aria-label={`Eliminar recorrido de ${r.driver}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {open && (
                        <div className="px-3.5 pb-3.5">
                          {detailState === 'loading' && (
                            <div className="flex items-center justify-center gap-2 py-10 text-[13px]" style={{ color: 'var(--text-3)' }}>
                              <RefreshCw className="w-4 h-4 animate-spin" /> Cargando recorrido…
                            </div>
                          )}
                          {detailState === 'error' && (
                            <div className="py-6 text-center text-[13px]" style={{ color: 'var(--text-2)' }}>
                              <AlertCircle className="w-5 h-5 mx-auto mb-1" style={{ color: '#B91C1C' }} />
                              No se pudo cargar este recorrido.
                              <button onClick={() => loadDetail(r.id)} className="block mx-auto mt-2 btn btn-secondary" style={{ minHeight: 44 }}>Reintentar</button>
                            </div>
                          )}
                          {noPoints && (
                            <div className="py-6 text-center text-[13px]" style={{ color: 'var(--text-2)' }}>
                              <AlertCircle className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--text-3)' }} />
                              Este recorrido no guardó puntos de GPS (el teléfono no dio ubicación).
                            </div>
                          )}
                          {detail && detailState === 'idle' && !noPoints && (
                            <>
                              <RouteMap routes={mapRoutes} height={280} />
                              <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                                <div className="rounded-xl py-2" style={{ background: 'var(--surface-2)' }}><p className="text-[15px] font-bold t-num" style={{ color: 'var(--text-1)' }}>{duration(r.started_at, r.ended_at)}</p><p className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>duración</p></div>
                                <div className="rounded-xl py-2" style={{ background: 'var(--surface-2)' }}><p className="text-[15px] font-bold t-num" style={{ color: 'var(--text-1)' }}>{formatDistance(r.distance_m)}</p><p className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>recorrido</p></div>
                                <div className="rounded-xl py-2" style={{ background: 'var(--surface-2)' }}><p className="text-[15px] font-bold t-num" style={{ color: 'var(--text-1)' }}>{mapRoutes[0]?.points.length ?? 0}</p><p className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>puntos GPS</p></div>
                              </div>
                              <p className="text-[11px] mt-2 px-0.5" style={{ color: 'var(--text-3)' }}>Línea sólida: recorrido registrado. Punteada: tramo sin señal, estimado por calles.</p>
                            </>
                          )}
                          {r.note && <p className="text-[12px] mt-2 inline-flex items-center gap-1" style={{ color: 'var(--text-2)' }}><Package className="w-3.5 h-3.5" /> {r.note}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
