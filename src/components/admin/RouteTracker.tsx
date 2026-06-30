'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigation, Play, Square, Pause, MapPin, AlertCircle, Satellite, Package, ArrowLeft, Pencil, CheckCircle2, Trash2, RefreshCw } from 'lucide-react';
import { haversineMeters, pathDistance, formatDistance, type RoutePoint } from '@/lib/routes';
import RouteMap from './RouteMap';

/**
 * Rastreador de ruta del domiciliario. Vive DENTRO de la app (panel de Reparto o
 * la pantalla /ruta) para que el domiciliario NO salga de la app mientras reparte.
 * Muestra un mapa con su posición en vivo + el destino, registra el recorrido GPS,
 * y recuerda quién es (no pide datos cada vez).
 *
 * Persistencia (FASE 2): la ruta activa se guarda en el dispositivo (localStorage)
 * y en el servidor. Si el domiciliario cierra la app o sale del panel, al volver
 * RECUPERA automáticamente la ruta y sigue rastreando. Puede ademas: marcar
 * entregado, finalizar, detener (seguir luego) o eliminar la ruta.
 */
export interface TrackerOrder {
  id: string;
  name: string;
  address: string | null;
  dest: { lat: number; lng: number } | null;
}

type Phase = 'idle' | 'tracking';
type DriverChoice = { id: string | null; name: string };

interface SavedActive {
  id: string;
  order: TrackerOrder | null;
  driver: DriverChoice;
}

const MIN_MOVE_M = 8;
const FLUSH_MS = 10000;
const DRIVER_KEY = 'rl_route_driver';
const ACTIVE_KEY = 'rl_active_route';

function loadSavedDriver(): DriverChoice | null {
  try {
    const raw = localStorage.getItem(DRIVER_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as DriverChoice;
    return d && typeof d.name === 'string' ? d : null;
  } catch { return null; }
}

function loadActive(): SavedActive | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as SavedActive;
    return a && typeof a.id === 'string' ? a : null;
  } catch { return null; }
}
function saveActive(a: SavedActive) {
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(a)); } catch { /* ignore */ }
}
function clearActive() {
  try { localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
}

interface RouteRowLite {
  id: string;
  driver?: string | null;
  driver_id?: string | null;
  order_id?: string | null;
  status?: string;
  points?: RoutePoint[] | null;
  started_at?: string | null;
  distance_m?: number | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
}

export default function RouteTracker({ order: orderProp, onExit }: { order?: TrackerOrder | null; onExit?: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [recovering, setRecovering] = useState(true);
  const [orderCtx, setOrderCtx] = useState<TrackerOrder | null>(orderProp ?? null);
  const [resumedDest, setResumedDest] = useState<{ lat: number; lng: number } | null>(null);

  const [activeDrivers, setActiveDrivers] = useState<DriverChoice[]>([]);
  const [driverChoice, setDriverChoice] = useState<DriverChoice>({ id: null, name: '' });
  const [customName, setCustomName] = useState('');
  const [editingDriver, setEditingDriver] = useState(false);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [pointCount, setPointCount] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [trail, setTrail] = useState<RoutePoint[]>([]);
  const [lastFix, setLastFix] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const watchIdRef = useRef<number | null>(null);
  const bufferRef = useRef<RoutePoint[]>([]);
  const allRef = useRef<RoutePoint[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const routeIdRef = useRef<string | null>(null);

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock) wakeLockRef.current = await nav.wakeLock.request('screen');
    } catch { /* no es crítico */ }
  }, []);

  const flush = useCallback(async () => {
    const id = routeIdRef.current;
    if (!id || bufferRef.current.length === 0) return;
    const batch = bufferRef.current;
    bufferRef.current = [];
    try {
      const res = await fetch('/api/route/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, points: batch }),
      });
      if (!res.ok) bufferRef.current = [...batch, ...bufferRef.current];
    } catch {
      bufferRef.current = [...batch, ...bufferRef.current];
    }
  }, []);

  const onPosition = useCallback((pos: GeolocationPosition) => {
    const p: RoutePoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: Date.now() };
    setLastFix({ lat: p.lat, lng: p.lng, acc: pos.coords.accuracy });
    const all = allRef.current;
    const prev = all[all.length - 1];
    if (prev && haversineMeters(prev, p) < MIN_MOVE_M) return;
    all.push(p);
    bufferRef.current.push(p);
    setPointCount(all.length);
    setDistanceM(pathDistance(all));
    setTrail([...all]);
  }, []);

  const onPosError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) setError('Permiso de ubicación denegado. Actívalo para rastrear la ruta.');
    else setError('No se pudo obtener la ubicación. Revisa el GPS.');
  }, []);

  const beginWatch = useCallback(() => {
    if (!('geolocation' in navigator)) { setError('Este dispositivo no tiene GPS disponible.'); return; }
    flushTimerRef.current = setInterval(flush, FLUSH_MS);
    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onPosError, {
      enableHighAccuracy: true, maximumAge: 4000, timeout: 20000,
    });
  }, [flush, onPosition, onPosError]);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null; }
    try { await wakeLockRef.current?.release(); } catch { /* ignore */ }
    wakeLockRef.current = null;
  }, []);

  // Carga domiciliarios y restaura el último elegido (no pedir datos cada vez).
  useEffect(() => {
    let cancelled = false;
    const saved = loadSavedDriver();
    if (saved) setDriverChoice(saved);
    fetch('/api/admin/drivers')
      .then(r => (r.ok ? r.json() : []))
      .then((data: { id: string; name: string; active: boolean }[]) => {
        if (cancelled || !Array.isArray(data)) return;
        const list = data.filter(d => d.active).map(d => ({ id: d.id, name: d.name }));
        setActiveDrivers(list);
        if (!saved && list.length) setDriverChoice(list[0]);
        if (!saved && !list.length) setEditingDriver(true);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, []);

  // Recuperación: al montar, si hay una ruta activa (por pedido o guardada en el
  // dispositivo) y sigue activa en el servidor, reanuda el rastreo sin pedir nada.
  const resumeRoute = useCallback((data: RouteRowLite, ord: TrackerOrder | null, drv: DriverChoice | null) => {
    const pts = (Array.isArray(data.points) ? data.points : []) as RoutePoint[];
    routeIdRef.current = data.id;
    allRef.current = [...pts];
    bufferRef.current = [];
    setTrail([...pts]);
    setPointCount(pts.length);
    setDistanceM(typeof data.distance_m === 'number' ? data.distance_m : pathDistance(pts));
    setStartedAt(data.started_at ? Date.parse(data.started_at) : Date.now());
    setNow(Date.now());
    if (ord) setOrderCtx(ord);
    if (!ord && data.dest_lat != null && data.dest_lng != null) setResumedDest({ lat: data.dest_lat, lng: data.dest_lng });
    if (drv) setDriverChoice(drv);
    else if (data.driver) setDriverChoice({ id: data.driver_id ?? null, name: data.driver });
    setPhase('tracking');
    requestWakeLock();
    beginWatch();
  }, [requestWakeLock, beginWatch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = loadActive();
        // 1) Si llegamos con un pedido, intenta reanudar SU ruta activa.
        if (orderProp?.id) {
          const r = await fetch(`/api/route/active?order_id=${encodeURIComponent(orderProp.id)}`);
          if (r.ok) {
            const d = await r.json() as RouteRowLite | null;
            if (!cancelled && d?.id) { resumeRoute(d, orderProp, null); setRecovering(false); return; }
          }
        }
        // 2) Si el dispositivo recuerda una ruta, reanúdala si sigue activa.
        if (saved?.id) {
          const r = await fetch(`/api/route/active?id=${encodeURIComponent(saved.id)}`);
          if (r.ok) {
            const d = await r.json() as RouteRowLite | null;
            if (!cancelled && d?.id) { resumeRoute(d, saved.order, saved.driver); setRecovering(false); return; }
          }
          clearActive(); // ya no existe / terminó
        }
      } catch { /* sin red: cae al inicio normal */ }
      if (!cancelled) setRecovering(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'tracking') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Reacquiere el wake lock al volver a la pantalla.
  useEffect(() => {
    if (phase !== 'tracking') return;
    const onVis = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase, requestWakeLock]);

  useEffect(() => () => { void stopTracking(); }, [stopTracking]);

  const effectiveName = customName.trim() || driverChoice.name || 'Domiciliario';
  const effectiveId = customName.trim() ? null : driverChoice.id;

  const persistDriver = () => {
    try { localStorage.setItem(DRIVER_KEY, JSON.stringify({ id: effectiveId, name: effectiveName })); } catch { /* ignore */ }
  };

  const start = async () => {
    setError('');
    if (!('geolocation' in navigator)) { setError('Este dispositivo no tiene GPS disponible.'); return; }
    persistDriver();
    setBusy(true);
    try {
      const res = await fetch('/api/route/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver: effectiveName,
          driver_id: effectiveId ?? undefined,
          order_id: orderCtx?.id ?? undefined,
          dest_lat: orderCtx?.dest?.lat,
          dest_lng: orderCtx?.dest?.lng,
        }),
      });
      if (!res.ok) { setError('No se pudo iniciar la ruta. Intenta de nuevo.'); return; }
      const data = await res.json() as { id: string };

      // Entrega de un pedido → marca "En camino".
      if (orderCtx?.id) {
        fetch(`/api/admin/orders/${orderCtx.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'en_camino' }),
        }).catch(() => { /* best-effort */ });
      }

      routeIdRef.current = data.id;
      allRef.current = [];
      bufferRef.current = [];
      setPointCount(0);
      setDistanceM(0);
      setTrail([]);
      setLastFix(null);
      setStartedAt(Date.now());
      setNow(Date.now());
      saveActive({ id: data.id, order: orderCtx, driver: { id: effectiveId, name: effectiveName } });
      setPhase('tracking');
      requestWakeLock();
      beginWatch();
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  // Termina la ruta (queda en el historial). Opcionalmente marca el pedido entregado.
  const finish = async (markDelivered = false) => {
    setBusy(true);
    await stopTracking();
    await flush();
    if (markDelivered && orderCtx?.id) {
      try {
        await fetch(`/api/admin/orders/${orderCtx.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'entregado' }),
        });
      } catch { /* ignore */ }
    }
    const id = routeIdRef.current;
    if (id) {
      try {
        await fetch('/api/route/end', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
      } catch { /* ignore */ }
    }
    clearActive();
    routeIdRef.current = null;
    setStartedAt(null);
    setPhase('idle');
    setBusy(false);
    onExit?.();
  };

  // Detener: deja de rastrear pero la ruta SIGUE activa (se reanuda al volver).
  const pause = async () => {
    setBusy(true);
    await stopTracking();
    await flush();
    setStartedAt(null);
    setPhase('idle');
    setBusy(false);
    onExit?.();
  };

  // Eliminar: borra la ruta (y devuelve el pedido a "por entregar").
  const cancelRoute = async () => {
    const msg = orderCtx?.id
      ? '¿Eliminar esta ruta? Se borra el recorrido y el pedido vuelve a "por entregar".'
      : '¿Eliminar esta ruta? Se borra el recorrido y no se podrá recuperar.';
    if (!confirm(msg)) return;
    setBusy(true);
    await stopTracking();
    const id = routeIdRef.current;
    if (id) {
      try {
        await fetch('/api/route/cancel', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
      } catch { /* ignore */ }
    }
    clearActive();
    routeIdRef.current = null;
    setStartedAt(null);
    setPhase('idle');
    setBusy(false);
    onExit?.();
  };

  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const dest = orderCtx?.dest ?? resumedDest;
  const distToDest = lastFix && dest
    ? haversineMeters({ lat: lastFix.lat, lng: lastFix.lng, t: 0 }, { lat: dest.lat, lng: dest.lng, t: 0 })
    : null;

  const mapRoutes = useMemo(() => [{
    id: routeIdRef.current ?? 'live',
    driver: effectiveName,
    status: 'active',
    color: '#FF5100',
    points: trail,
    dest: dest ?? null,
  }], [trail, effectiveName, dest]);

  // ── RECUPERANDO ──
  if (recovering && phase === 'idle') {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--brand)' }} />
        <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>Buscando tu ruta activa…</p>
      </div>
    );
  }

  // ── RASTREANDO ──
  if (phase === 'tracking') {
    return (
      <div className="pb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#16a34a' }} />
            <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: '#16a34a' }} />
          </span>
          <p className="text-sm font-bold uppercase tracking-wide" style={{ color: '#16a34a' }}>Rastreando ruta</p>
        </div>

        <p className="text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>{effectiveName}</p>
        {orderCtx?.name && (
          <p className="text-[13px] mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--text-2)' }}>
            <Package className="w-3.5 h-3.5" /> Entrega para {orderCtx.name}
          </p>
        )}

        {/* Mapa en vivo: tu posición + destino */}
        <div className="mt-3 mb-3">
          <RouteMap routes={mapRoutes} follow height={300} />
        </div>

        {dest && (
          <div className="mb-3 rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand)' }}>
            <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand-deep)' }} />
            <span className="text-[13px] font-semibold" style={{ color: 'var(--brand-deep)' }}>
              {distToDest != null ? `${formatDistance(distToDest)} al destino` : 'Calculando distancia al destino…'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat value={`${mm}:${ss}`} label="tiempo" />
          <Stat value={formatDistance(distanceM)} label="recorrido" />
          <Stat value={String(pointCount)} label="puntos" />
        </div>

        <div className="flex items-center justify-center gap-2 text-xs mb-3" style={{ color: lastFix ? '#16a34a' : 'var(--text-3)' }}>
          <Satellite className="w-4 h-4" />
          {lastFix ? <span>GPS activo · precisión ±{Math.round(lastFix.acc)} m</span> : <span>Buscando señal GPS…</span>}
        </div>
        {error && (
          <p className="mb-3 text-xs flex items-center justify-center gap-1 text-center" style={{ color: 'var(--danger)' }}>
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </p>
        )}

        <p className="text-[11px] text-center mb-3" style={{ color: 'var(--text-3)' }}>
          Mantén esta pantalla abierta mientras repartes para que el recorrido se registre.
        </p>

        {/* Entrega de pedido: acción principal = marcar entregado */}
        {orderCtx?.id && (
          <button onClick={() => finish(true)} disabled={busy} className="w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl disabled:opacity-60 mb-2" style={{ background: '#16a34a' }}>
            <CheckCircle2 className="w-5 h-5" /> Marcar entregado
          </button>
        )}

        <div className="grid grid-cols-2 gap-2 mb-2">
          <button onClick={pause} disabled={busy} className="flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl disabled:opacity-60" style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)' }}>
            <Pause className="w-4.5 h-4.5" /> Detener
          </button>
          <button onClick={() => finish(false)} disabled={busy} className="flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-2xl disabled:opacity-60" style={{ background: orderCtx?.id ? '#6b7280' : '#dc2626' }}>
            <Square className="w-4.5 h-4.5" /> Finalizar
          </button>
        </div>
        <button onClick={cancelRoute} disabled={busy} className="w-full flex items-center justify-center gap-1.5 text-[12.5px] font-semibold py-2 rounded-xl disabled:opacity-60" style={{ background: 'var(--danger-soft)', color: '#B91C1C' }}>
          <Trash2 className="w-3.5 h-3.5" /> Eliminar ruta
        </button>
        <p className="text-[11px] text-center mt-2" style={{ color: 'var(--text-3)' }}>
          Detener pausa el rastreo (la retomas al volver). Finalizar la cierra. Eliminar la borra.
        </p>
      </div>
    );
  }

  // ── INICIO (idle) ──
  const savedName = driverChoice.name && !editingDriver && !customName.trim();
  return (
    <div className="pb-6">
      {onExit && (
        <button onClick={onExit} className="inline-flex items-center gap-1.5 text-[13px] font-semibold mb-3" style={{ color: 'var(--text-2)' }}>
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
      )}
      <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-1)' }}>
        {orderCtx ? 'Entrega de pedido' : 'Ruta de reparto'}
      </h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>
        {orderCtx ? 'Confirma y empieza la entrega. Verás el mapa al destino.' : 'Empieza a rastrear tu recorrido en el mapa.'}
      </p>

      {orderCtx && (
        <div className="card p-4 mb-5">
          <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5 inline-flex items-center gap-1.5" style={{ color: 'var(--brand-deep)' }}>
            <Package className="w-3.5 h-3.5" /> Pedido a entregar
          </p>
          <p className="text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>{orderCtx.name}</p>
          {orderCtx.address && <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-2)' }}>{orderCtx.address}</p>}
          {orderCtx.dest ? (
            <p className="text-[11px] mt-1 inline-flex items-center gap-1" style={{ color: '#16a34a' }}>
              <MapPin className="w-3.5 h-3.5" /> Destino con ubicación GPS — verás el mapa
            </p>
          ) : (
            <p className="text-[11px] mt-1 inline-flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
              <MapPin className="w-3.5 h-3.5" /> Sin ubicación GPS exacta (guíate por la dirección)
            </p>
          )}
        </div>
      )}

      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-2)' }}>Domiciliario</p>

      {savedName ? (
        <div className="flex items-center justify-between gap-2 mb-6 card p-3">
          <span className="text-[15px] font-bold" style={{ color: 'var(--text-1)' }}>{driverChoice.name}</span>
          <button onClick={() => setEditingDriver(true)} className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: 'var(--brand-deep)' }}>
            <Pencil className="w-3.5 h-3.5" /> Cambiar
          </button>
        </div>
      ) : (
        <>
          {activeDrivers.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {activeDrivers.map(d => {
                const active = !customName.trim() && driverChoice.id === d.id && driverChoice.name === d.name;
                return (
                  <button
                    key={d.id ?? d.name}
                    onClick={() => { setDriverChoice(d); setCustomName(''); setEditingDriver(false); }}
                    className="py-3 rounded-2xl text-sm font-bold border transition-all"
                    style={active
                      ? { background: 'var(--gradient-button)', color: '#fff', borderColor: 'transparent' }
                      : { background: 'var(--surface)', color: 'var(--text-2)', borderColor: 'var(--border)' }}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          )}
          <input
            type="text" value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder={activeDrivers.length > 0 ? '…o escribe otro nombre' : 'Escribe tu nombre'}
            className="field mb-6"
          />
        </>
      )}

      {error && (
        <p className="mb-4 text-xs flex items-center gap-1" style={{ color: 'var(--danger)' }}>
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}

      <button onClick={start} disabled={busy} className="w-full flex items-center justify-center gap-2 btn-gradient text-white font-bold py-4 rounded-2xl disabled:opacity-60">
        <Play className="w-5 h-5" /> {orderCtx ? 'Iniciar entrega' : 'Iniciar ruta'}
      </button>
      <p className="text-[11px] text-center mt-3 flex items-center justify-center gap-1" style={{ color: 'var(--text-3)' }}>
        <Navigation className="w-3.5 h-3.5" /> Se pedirá permiso de ubicación al iniciar.
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card p-2.5 text-center">
      <p className="text-[18px] font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>{value}</p>
      <p className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{label}</p>
    </div>
  );
}
