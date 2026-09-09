'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Navigation } from 'lucide-react';
import { haversineMeters, pathDistance, type RoutePoint } from '@/lib/routes';

/**
 * Rastreo GPS a nivel de APP. Vive en el layout, no en una pantalla: así el
 * recorrido sigue registrándose aunque el domiciliario cambie de pestaña, abra
 * un pedido o navegue por la tienda. Antes el watch moría al desmontar la
 * pantalla de ruta y el recorrido quedaba con huecos (líneas rectas) mientras
 * el panel seguía mostrando "EN VIVO".
 */
export interface TrackerOrder {
  id: string;
  name: string;
  address: string | null;
  dest: { lat: number; lng: number } | null;
}
export interface DriverChoice { id: string | null; name: string }

interface SavedActive {
  id: string;
  order: TrackerOrder | null;
  driver: DriverChoice;
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

const MIN_MOVE_M = 8;
const FLUSH_MS = 10000;
/** Sin fix nuevo por más de esto, el watch se considera muerto y se recrea. */
const STALE_FIX_MS = 45000;
const WATCHDOG_MS = 15000;
/** Aunque no se mueva, avisa al servidor que sigue vivo. */
const HEARTBEAT_MS = 60000;
const DRIVER_KEY = 'rl_route_driver';
const ACTIVE_KEY = 'rl_active_route';

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
export function loadSavedDriver(): DriverChoice | null {
  try {
    const raw = localStorage.getItem(DRIVER_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as DriverChoice;
    return d && typeof d.name === 'string' ? d : null;
  } catch { return null; }
}
export function saveDriver(d: DriverChoice) {
  try { localStorage.setItem(DRIVER_KEY, JSON.stringify(d)); } catch { /* ignore */ }
}

interface TrackingValue {
  /** El GPS está corriendo ahora. */
  tracking: boolean;
  /** Hay una ruta abierta en el servidor (aunque el rastreo esté detenido). */
  hasRoute: boolean;
  recovering: boolean;
  routeId: string | null;
  order: TrackerOrder | null;
  driver: DriverChoice;
  startedAt: number | null;
  points: RoutePoint[];
  distanceM: number;
  lastFix: { lat: number; lng: number; acc: number; t: number } | null;
  error: string;
  start: (driver: DriverChoice, order: TrackerOrder | null) => Promise<boolean>;
  resume: () => void;
  finish: (markDelivered?: boolean) => Promise<void>;
  pause: () => Promise<void>;
  cancel: () => Promise<void>;
  resumeForOrder: (order: TrackerOrder) => Promise<boolean>;
  setScreenOpen: (open: boolean) => void;
}

const Ctx = createContext<TrackingValue | null>(null);

export function useRouteTracking(): TrackingValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRouteTracking fuera de RouteTrackingProvider');
  return v;
}

export default function RouteTrackingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [tracking, setTracking] = useState(false);
  const [recovering, setRecovering] = useState(true);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackerOrder | null>(null);
  const [driver, setDriver] = useState<DriverChoice>({ id: null, name: '' });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [distanceM, setDistanceM] = useState(0);
  const [lastFix, setLastFix] = useState<{ lat: number; lng: number; acc: number; t: number } | null>(null);
  const [error, setError] = useState('');
  const [screenOpen, setScreenOpen] = useState(false);

  const routeIdRef = useRef<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const bufferRef = useRef<RoutePoint[]>([]);
  const allRef = useRef<RoutePoint[]>([]);
  const lastFixAtRef = useRef(0);
  const lastFixRef = useRef<{ lat: number; lng: number } | null>(null);

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
    lastFixAtRef.current = p.t;
    lastFixRef.current = { lat: p.lat, lng: p.lng };
    setLastFix({ lat: p.lat, lng: p.lng, acc: pos.coords.accuracy, t: p.t });
    setError('');
    const all = allRef.current;
    const prev = all[all.length - 1];
    if (prev && haversineMeters(prev, p) < MIN_MOVE_M) return;
    all.push(p);
    bufferRef.current.push(p);
    setDistanceM(pathDistance(all));
    setPoints([...all]);
  }, []);

  const onPosError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) setError('Permiso de ubicación denegado. Actívalo para rastrear la ruta.');
    else setError('Señal GPS débil. Reintentando…');
  }, []);

  const startWatch = useCallback(() => {
    if (!('geolocation' in navigator)) { setError('Este dispositivo no tiene GPS disponible.'); return; }
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    lastFixAtRef.current = Date.now();
    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onPosError, {
      enableHighAccuracy: true, maximumAge: 4000, timeout: 20000,
    });
  }, [onPosition, onPosError]);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
  }, []);

  // Envío periódico de los puntos acumulados.
  useEffect(() => {
    if (!tracking) return;
    const t = setInterval(flush, FLUSH_MS);
    return () => { clearInterval(t); };
  }, [tracking, flush]);

  // Vigilante: algunos navegadores dejan de emitir posiciones en silencio (pantalla
  // bloqueada, app en segundo plano). Si no llega un fix nuevo, recrea el watch.
  useEffect(() => {
    if (!tracking) return;
    const t = setInterval(() => {
      if (Date.now() - lastFixAtRef.current > STALE_FIX_MS) startWatch();
    }, WATCHDOG_MS);
    return () => clearInterval(t);
  }, [tracking, startWatch]);

  // Latido: mantiene "en vivo" en el panel aunque el domiciliario esté detenido,
  // y distingue "parado" de "app cerrada".
  useEffect(() => {
    if (!tracking) return;
    const t = setInterval(() => {
      const id = routeIdRef.current;
      const fix = lastFixRef.current;
      if (!id) return;
      fetch('/api/route/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, alive: true, lat: fix?.lat, lng: fix?.lng }),
      }).catch(() => { /* best-effort */ });
    }, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [tracking]);

  // Al volver a primer plano, reanuda el watch de inmediato (no espera al vigilante).
  useEffect(() => {
    if (!tracking) return;
    const onVis = () => { if (document.visibilityState === 'visible') { startWatch(); void flush(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [tracking, startWatch, flush]);

  // Último intento de enviar lo pendiente si cierran la app.
  useEffect(() => {
    if (!tracking) return;
    const onHide = () => {
      const id = routeIdRef.current;
      if (!id || bufferRef.current.length === 0) return;
      const body = JSON.stringify({ id, points: bufferRef.current });
      if (navigator.sendBeacon?.('/api/route/ping', new Blob([body], { type: 'application/json' }))) {
        bufferRef.current = [];
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [tracking]);

  const adopt = useCallback((data: RouteRowLite, ord: TrackerOrder | null, drv: DriverChoice | null) => {
    const pts = (Array.isArray(data.points) ? data.points : []) as RoutePoint[];
    routeIdRef.current = data.id;
    allRef.current = [...pts];
    bufferRef.current = [];
    setRouteId(data.id);
    setPoints([...pts]);
    setDistanceM(typeof data.distance_m === 'number' ? data.distance_m : pathDistance(pts));
    setStartedAt(data.started_at ? Date.parse(data.started_at) : Date.now());
    const dest = data.dest_lat != null && data.dest_lng != null ? { lat: data.dest_lat, lng: data.dest_lng } : null;
    const nextOrder = ord ?? (dest ? { id: data.order_id ?? '', name: '', address: null, dest } : null);
    setOrder(nextOrder);
    if (drv) setDriver(drv);
    else if (data.driver) setDriver({ id: data.driver_id ?? null, name: data.driver });
    saveActive({ id: data.id, order: nextOrder, driver: drv ?? { id: data.driver_id ?? null, name: data.driver ?? '' } });
    setTracking(true);
    startWatch();
  }, [startWatch]);

  // Recuperación al cargar la app: solo en dispositivos que recuerdan una ruta.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = loadActive();
      if (!saved?.id) { setRecovering(false); return; }
      try {
        const r = await fetch(`/api/route/active?id=${encodeURIComponent(saved.id)}`);
        if (r.ok) {
          const d = await r.json() as RouteRowLite | null;
          if (!cancelled && d?.id) { adopt(d, saved.order, saved.driver); setRecovering(false); return; }
          if (!cancelled) clearActive();
        }
      } catch { /* sin red: se reintenta al recargar */ }
      if (!cancelled) setRecovering(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    stopWatch();
    clearActive();
    routeIdRef.current = null;
    allRef.current = [];
    bufferRef.current = [];
    setTracking(false);
    setRouteId(null);
    setStartedAt(null);
    setPoints([]);
    setDistanceM(0);
    setLastFix(null);
    setOrder(null);
  }, [stopWatch]);

  const start = useCallback(async (drv: DriverChoice, ord: TrackerOrder | null): Promise<boolean> => {
    setError('');
    if (!('geolocation' in navigator)) { setError('Este dispositivo no tiene GPS disponible.'); return false; }
    saveDriver(drv);
    try {
      const res = await fetch('/api/route/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver: drv.name,
          driver_id: drv.id ?? undefined,
          order_id: ord?.id ?? undefined,
          dest_lat: ord?.dest?.lat,
          dest_lng: ord?.dest?.lng,
        }),
      });
      if (!res.ok) { setError('No se pudo iniciar la ruta. Intenta de nuevo.'); return false; }
      const data = await res.json() as { id: string };

      if (ord?.id) {
        fetch(`/api/admin/orders/${ord.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'en_camino' }),
        }).catch(() => { /* best-effort */ });
      }

      routeIdRef.current = data.id;
      allRef.current = [];
      bufferRef.current = [];
      setRouteId(data.id);
      setDriver(drv);
      setOrder(ord);
      setPoints([]);
      setDistanceM(0);
      setLastFix(null);
      setStartedAt(Date.now());
      saveActive({ id: data.id, order: ord, driver: drv });
      setTracking(true);
      startWatch();
      return true;
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      return false;
    }
  }, [startWatch]);

  const resumeForOrder = useCallback(async (ord: TrackerOrder): Promise<boolean> => {
    try {
      const r = await fetch(`/api/route/active?order_id=${encodeURIComponent(ord.id)}`);
      if (!r.ok) return false;
      const d = await r.json() as RouteRowLite | null;
      if (!d?.id) return false;
      adopt(d, ord, null);
      return true;
    } catch { return false; }
  }, [adopt]);

  const finish = useCallback(async (markDelivered = false) => {
    stopWatch();
    await flush();
    const ord = order;
    if (markDelivered && ord?.id) {
      try {
        await fetch(`/api/admin/orders/${ord.id}`, {
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
    reset();
  }, [order, flush, reset, stopWatch]);

  // Detener: para el GPS pero la ruta sigue abierta (se retoma al volver).
  const pause = useCallback(async () => {
    stopWatch();
    await flush();
    setTracking(false);
  }, [flush, stopWatch]);

  const resume = useCallback(() => {
    if (!routeIdRef.current) return;
    setTracking(true);
    startWatch();
  }, [startWatch]);

  const cancel = useCallback(async () => {
    stopWatch();
    const id = routeIdRef.current;
    if (id) {
      try {
        await fetch('/api/route/cancel', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
      } catch { /* ignore */ }
    }
    reset();
  }, [reset, stopWatch]);

  const value: TrackingValue = {
    tracking, hasRoute: routeId !== null, recovering, routeId, order, driver, startedAt,
    points, distanceM, lastFix, error,
    start, resume, finish, pause, cancel, resumeForOrder, setScreenOpen,
  };

  // Aviso flotante: el rastreo sigue corriendo aunque el domiciliario esté en
  // otra pantalla. Un toque lo devuelve al mapa.
  const showPill = tracking && !screenOpen && !pathname.startsWith('/ruta');

  return (
    <Ctx.Provider value={value}>
      {children}
      {showPill && (
        <button
          onClick={() => router.push('/ruta')}
          className="fixed left-1/2 -translate-x-1/2 bottom-4 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-[13px] font-bold shadow-lg"
          style={{ background: '#16a34a' }}
        >
          <Navigation className="w-4 h-4" /> Rastreando tu ruta · volver
        </button>
      )}
    </Ctx.Provider>
  );
}
