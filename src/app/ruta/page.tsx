'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigation, Play, Square, Loader2, MapPin, AlertCircle, Lock, Satellite, Package } from 'lucide-react';
import { haversineMeters, pathDistance, formatDistance, type RoutePoint } from '@/lib/routes';

type Phase = 'checking' | 'login' | 'idle' | 'tracking';
type DriverChoice = { id: string | null; name: string };

const MIN_MOVE_M = 8;
const FLUSH_MS = 10000;

interface OrderInfo {
  name: string;
  address: string | null;
  dest: { lat: number; lng: number } | null;
}

/** Extrae las coordenadas del cliente del enlace de mapa guardado en el pedido. */
function parseDest(addr: string | null): { lat: number; lng: number } | null {
  if (!addr) return null;
  const m = addr.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
}
function cleanAddr(addr: string | null): string | null {
  if (!addr) return null;
  return addr.replace(/https?:\/\/\S+/, '').replace(/[·\s]+$/, '').trim() || null;
}

export default function DriverRoutePage() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeDrivers, setActiveDrivers] = useState<DriverChoice[]>([]);
  const [driverChoice, setDriverChoice] = useState<DriverChoice>({ id: null, name: '' });
  const [customName, setCustomName] = useState('');

  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);

  const [routeId, setRouteId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [pointCount, setPointCount] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [lastFix, setLastFix] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const watchIdRef = useRef<number | null>(null);
  const bufferRef = useRef<RoutePoint[]>([]);
  const allRef = useRef<RoutePoint[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const routeIdRef = useRef<string | null>(null);

  // Verifica sesión de equipo en este teléfono.
  useEffect(() => {
    fetch('/api/admin/me')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(() => setPhase('idle'))
      .catch(() => setPhase('login'));
  }, []);

  // Al entrar (autenticado): carga domiciliarios y, si viene ?order=, el pedido.
  useEffect(() => {
    if (phase !== 'idle') return;
    let cancelled = false;

    fetch('/api/admin/drivers')
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; name: string; active: boolean }[]) => {
        if (cancelled || !Array.isArray(data)) return;
        const list = data.filter(d => d.active).map(d => ({ id: d.id, name: d.name }));
        setActiveDrivers(list);
        if (list.length) setDriverChoice(list[0]);
      })
      .catch(() => { /* ignore */ });

    const op = new URLSearchParams(window.location.search).get('order');
    if (op) {
      setOrderId(op);
      fetch(`/api/admin/orders/${op}`)
        .then(r => r.ok ? r.json() : null)
        .then((o: { customer_name?: string; delivery_address?: string | null } | null) => {
          if (cancelled || !o) return;
          setOrderInfo({
            name: o.customer_name ?? 'Cliente',
            address: cleanAddr(o.delivery_address ?? null),
            dest: parseDest(o.delivery_address ?? null),
          });
        })
        .catch(() => { /* ignore */ });
    }
    return () => { cancelled = true; };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'tracking') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const login = async () => {
    if (!pin.trim()) return;
    setLoggingIn(true);
    setPinError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      if (res.ok) { setPhase('idle'); setPin(''); }
      else {
        const e = await res.json().catch(() => ({})) as { error?: string };
        setPinError(e.error ?? 'Código incorrecto');
      }
    } catch { setPinError('Error de conexión'); } finally { setLoggingIn(false); }
  };

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
  }, []);

  const onPosError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) setError('Permiso de ubicación denegado. Actívalo para rastrear la ruta.');
    else setError('No se pudo obtener la ubicación. Revisa el GPS.');
  }, []);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null; }
    try { await wakeLockRef.current?.release(); } catch { /* ignore */ }
    wakeLockRef.current = null;
  }, []);

  const effectiveName = customName.trim() || driverChoice.name || 'Domiciliario';
  const effectiveId = customName.trim() ? null : driverChoice.id;

  const start = async () => {
    setError('');
    if (!('geolocation' in navigator)) { setError('Este dispositivo no tiene GPS disponible.'); return; }
    try {
      const res = await fetch('/api/route/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver: effectiveName,
          driver_id: effectiveId ?? undefined,
          order_id: orderId ?? undefined,
          dest_lat: orderInfo?.dest?.lat,
          dest_lng: orderInfo?.dest?.lng,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) { setPhase('login'); return; }
        setError('No se pudo iniciar la ruta. Intenta de nuevo.');
        return;
      }
      const data = await res.json() as { id: string };

      // Si es una entrega de un pedido, marca el pedido como "En camino".
      if (orderId) {
        fetch(`/api/admin/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'en_camino' }),
        }).catch(() => { /* best-effort */ });
      }

      routeIdRef.current = data.id;
      allRef.current = [];
      bufferRef.current = [];
      setRouteId(data.id);
      setPointCount(0);
      setDistanceM(0);
      setLastFix(null);
      setStartedAt(Date.now());
      setNow(Date.now());
      setPhase('tracking');
      requestWakeLock();
      watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onPosError, {
        enableHighAccuracy: true, maximumAge: 4000, timeout: 20000,
      });
      flushTimerRef.current = setInterval(flush, FLUSH_MS);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    }
  };

  const finish = async () => {
    await stopTracking();
    await flush();
    const id = routeIdRef.current;
    if (id) {
      try {
        await fetch('/api/route/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
      } catch { /* ignore */ }
    }
    routeIdRef.current = null;
    setRouteId(null);
    setStartedAt(null);
    setPhase('idle');
  };

  useEffect(() => {
    if (phase !== 'tracking') return;
    const onVis = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase, requestWakeLock]);

  useEffect(() => () => { void stopTracking(); }, [stopTracking]);

  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const driverList: DriverChoice[] = activeDrivers;

  // ── cargando ──
  if (phase === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--brand-orange)' }} />
      </div>
    );
  }

  // ── PIN ──
  if (phase === 'login') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg-main)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--brand-soft)' }}>
          <Lock className="w-6 h-6" style={{ color: 'var(--brand-deep)' }} />
        </div>
        <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Acceso domiciliario</h1>
        <p className="text-sm mb-5 text-center" style={{ color: 'var(--text-secondary)' }}>Ingresa el código del equipo para rastrear tu ruta.</p>
        <input
          type="password" inputMode="numeric" value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') login(); }}
          placeholder="Código" autoFocus
          className="field text-center text-lg tracking-widest mb-3" style={{ maxWidth: 220 }}
        />
        {pinError && <p className="text-xs mb-3" style={{ color: 'var(--destructive, #dc2626)' }}>{pinError}</p>}
        <button onClick={login} disabled={loggingIn || !pin.trim()} className="btn-gradient text-white font-bold px-8 py-3 rounded-2xl disabled:opacity-50">
          {loggingIn ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    );
  }

  // ── rastreando ──
  if (phase === 'tracking') {
    return (
      <div className="min-h-screen flex flex-col px-6 py-8" style={{ background: 'var(--bg-main)' }}>
        <div className="flex items-center gap-2 mb-6">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#16a34a' }} />
            <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: '#16a34a' }} />
          </span>
          <p className="text-sm font-bold uppercase tracking-wide" style={{ color: '#16a34a' }}>Rastreando ruta</p>
        </div>

        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{effectiveName}</p>
        {orderInfo && (
          <p className="text-[13px] mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <Package className="w-3.5 h-3.5" /> Entrega para {orderInfo.name}
          </p>
        )}

        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-6xl font-black tabular-nums mb-2" style={{ color: 'var(--brand-orange)' }}>{mm}:{ss}</p>
          <div className="flex gap-6 mt-2">
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatDistance(distanceM)}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>recorrido</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{pointCount}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>puntos</p>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-2 text-xs" style={{ color: lastFix ? '#16a34a' : 'var(--text-muted)' }}>
            <Satellite className="w-4 h-4" />
            {lastFix ? <span>GPS activo · precisión ±{Math.round(lastFix.acc)} m</span> : <span>Buscando señal GPS…</span>}
          </div>
          {error && (
            <p className="mt-3 text-xs flex items-center gap-1 text-center" style={{ color: 'var(--destructive, #dc2626)' }}>
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
        </div>

        <p className="text-[11px] text-center mb-3" style={{ color: 'var(--text-muted)' }}>
          Mantén esta pantalla abierta mientras repartes para que el recorrido se registre.
        </p>
        <button onClick={finish} className="w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl" style={{ background: '#dc2626' }}>
          <Square className="w-5 h-5" /> Finalizar ruta
        </button>
      </div>
    );
  }

  // ── inicio (idle) ──
  return (
    <div className="min-h-screen flex flex-col px-6 py-10" style={{ background: 'var(--bg-main)' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'var(--brand-soft)' }}>
        <Navigation className="w-6 h-6" style={{ color: 'var(--brand-deep)' }} />
      </div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        {orderInfo ? 'Entrega de pedido' : 'Ruta de reparto'}
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        {orderInfo ? 'Confirma quién eres y empieza la entrega.' : 'Elige quién eres y empieza a rastrear el recorrido.'}
      </p>

      {orderInfo && (
        <div className="card p-4 mb-6">
          <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5 inline-flex items-center gap-1.5" style={{ color: 'var(--brand-deep)' }}>
            <Package className="w-3.5 h-3.5" /> Pedido a entregar
          </p>
          <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{orderInfo.name}</p>
          {orderInfo.address && <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{orderInfo.address}</p>}
          {orderInfo.dest ? (
            <p className="text-[11px] mt-1 inline-flex items-center gap-1" style={{ color: '#16a34a' }}>
              <MapPin className="w-3.5 h-3.5" /> Destino con ubicación GPS
            </p>
          ) : (
            <p className="text-[11px] mt-1 inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <MapPin className="w-3.5 h-3.5" /> Sin ubicación GPS exacta (guíate por la dirección)
            </p>
          )}
        </div>
      )}

      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>Domiciliario</p>
      {driverList.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {driverList.map(d => {
            const active = !customName.trim() && driverChoice.id === d.id && driverChoice.name === d.name;
            return (
              <button
                key={d.id ?? d.name}
                onClick={() => { setDriverChoice(d); setCustomName(''); }}
                className="py-3 rounded-2xl text-sm font-bold border transition-all"
                style={active
                  ? { background: 'var(--gradient-button)', color: '#fff', borderColor: 'transparent' }
                  : { background: 'var(--surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
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
        placeholder={driverList.length > 0 ? '…o escribe otro nombre' : 'Escribe tu nombre'}
        className="field mb-6"
      />

      {error && (
        <p className="mb-4 text-xs flex items-center gap-1" style={{ color: 'var(--destructive, #dc2626)' }}>
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}

      <button onClick={start} className="w-full flex items-center justify-center gap-2 btn-gradient text-white font-bold py-4 rounded-2xl mt-auto">
        <Play className="w-5 h-5" /> {orderInfo ? 'Iniciar entrega' : 'Iniciar ruta'}
      </button>
      <p className="text-[11px] text-center mt-3 flex items-center justify-center gap-1" style={{ color: 'var(--text-muted)' }}>
        <MapPin className="w-3.5 h-3.5" /> Se pedirá permiso de ubicación al iniciar.
      </p>
    </div>
  );
}
