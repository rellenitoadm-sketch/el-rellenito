'use client';

import { useEffect, useMemo, useState } from 'react';
import { Navigation, Play, Square, Pause, MapPin, AlertCircle, Satellite, Package, ArrowLeft, Pencil, CheckCircle2, Trash2, RefreshCw } from 'lucide-react';
import { haversineMeters, formatDistance } from '@/lib/routes';
import { useRouteTracking, loadSavedDriver, type TrackerOrder, type DriverChoice } from '../RouteTracking';
import RouteMap from './RouteMap';
import { useOnboarding } from '../Onboarding';

/**
 * Pantalla del domiciliario (panel de Reparto y /ruta). Solo dibuja: el GPS y el
 * envío de puntos viven en RouteTrackingProvider (layout), para que el recorrido
 * NO se corte al cambiar de pantalla.
 */
export default function RouteTracker({ order: orderProp, onExit }: { order?: TrackerOrder | null; onExit?: () => void }) {
  const { maybeStart } = useOnboarding();
  const t = useRouteTracking();

  const [activeDrivers, setActiveDrivers] = useState<DriverChoice[]>([]);
  const [driverChoice, setDriverChoice] = useState<DriverChoice>({ id: null, name: '' });
  const [customName, setCustomName] = useState('');
  const [editingDriver, setEditingDriver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [lookingForOrder, setLookingForOrder] = useState(!!orderProp?.id);

  const { setScreenOpen } = t;
  useEffect(() => {
    setScreenOpen(true);
    return () => setScreenOpen(false);
  }, [setScreenOpen]);

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

  // Ruta abierta pero con el GPS detenido: al abrir esta pantalla se retoma.
  const { hasRoute, resume } = t;
  useEffect(() => {
    if (hasRoute) resume();
  }, [hasRoute, resume]);

  // Si llegamos desde un pedido, reanuda SU ruta activa si existe.
  const { tracking, resumeForOrder } = t;
  useEffect(() => {
    if (!orderProp?.id || tracking || hasRoute) { setLookingForOrder(false); return; }
    let cancelled = false;
    (async () => {
      await resumeForOrder(orderProp);
      if (!cancelled) setLookingForOrder(false);
    })();
    return () => { cancelled = true; };
  }, [orderProp, tracking, hasRoute, resumeForOrder]);

  useEffect(() => {
    if (!t.tracking) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [t.tracking]);

  const recovering = t.recovering || lookingForOrder;

  useEffect(() => {
    if (recovering || t.tracking) return;
    const id = setTimeout(() => maybeStart('routeStart'), 500);
    return () => clearTimeout(id);
  }, [recovering, t.tracking, maybeStart]);

  useEffect(() => {
    if (!t.tracking) return;
    const id = setTimeout(() => maybeStart('routeLive'), 700);
    return () => clearTimeout(id);
  }, [t.tracking, maybeStart]);

  const orderCtx = t.tracking ? t.order : (orderProp ?? null);
  const effectiveName = t.tracking
    ? (t.driver.name || 'Domiciliario')
    : (customName.trim() || driverChoice.name || 'Domiciliario');
  const effectiveId = customName.trim() ? null : driverChoice.id;

  const dest = orderCtx?.dest ?? null;
  const distToDest = t.lastFix && dest
    ? haversineMeters({ lat: t.lastFix.lat, lng: t.lastFix.lng, t: 0 }, { lat: dest.lat, lng: dest.lng, t: 0 })
    : null;

  const mapRoutes = useMemo(() => [{
    id: t.routeId ?? 'live',
    driver: effectiveName,
    status: 'active',
    color: '#FF5100',
    points: t.points,
    dest,
  }], [t.routeId, t.points, effectiveName, dest]);

  const start = async () => {
    // Con una ruta ya abierta se retoma, nunca se abre una segunda.
    if (t.hasRoute) { t.resume(); return; }
    setBusy(true);
    await t.start({ id: effectiveId, name: effectiveName }, orderProp ?? null);
    setBusy(false);
  };

  const finish = async (markDelivered = false) => {
    setBusy(true);
    await t.finish(markDelivered);
    setBusy(false);
    onExit?.();
  };

  const pause = async () => {
    setBusy(true);
    await t.pause();
    setBusy(false);
    onExit?.();
  };

  const cancelRoute = async () => {
    const msg = orderCtx?.id
      ? '¿Eliminar esta ruta? Se borra el recorrido y el pedido vuelve a "por entregar".'
      : '¿Eliminar esta ruta? Se borra el recorrido y no se podrá recuperar.';
    if (!confirm(msg)) return;
    setBusy(true);
    await t.cancel();
    setBusy(false);
    onExit?.();
  };

  const elapsed = t.startedAt ? Math.max(0, Math.floor((now - t.startedAt) / 1000)) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const fixAge = t.lastFix ? Math.floor((now - t.lastFix.t) / 1000) : null;

  // ── RECUPERANDO ──
  if (recovering && !t.tracking) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--brand)' }} />
        <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>Buscando tu ruta activa…</p>
      </div>
    );
  }

  // ── RASTREANDO ──
  if (t.tracking) {
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
        <div className="mt-3 mb-3" data-tour="route-map">
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

        <div className="grid grid-cols-3 gap-2 mb-3" data-tour="route-stats">
          <Stat value={`${mm}:${ss}`} label="tiempo" />
          <Stat value={formatDistance(t.distanceM)} label="recorrido" />
          <Stat value={String(t.points.length)} label="puntos" />
        </div>

        <div className="flex items-center justify-center gap-2 text-xs mb-3" style={{ color: fixAge != null && fixAge < 60 ? '#16a34a' : 'var(--text-3)' }}>
          <Satellite className="w-4 h-4" />
          {t.lastFix
            ? <span>{fixAge != null && fixAge < 60 ? `GPS activo · precisión ±${Math.round(t.lastFix.acc)} m` : `Última señal hace ${Math.floor((fixAge ?? 0) / 60)} min`}</span>
            : <span>Buscando señal GPS…</span>}
        </div>
        {t.error && (
          <p className="mb-3 text-xs flex items-center justify-center gap-1 text-center" style={{ color: 'var(--danger)' }}>
            <AlertCircle className="w-3.5 h-3.5" /> {t.error}
          </p>
        )}

        <p className="text-[11px] text-center mb-3" style={{ color: 'var(--text-3)' }}>
          El recorrido se sigue registrando aunque cambies de pantalla. Mantén la app abierta y la pantalla encendida.
        </p>

        {/* Entrega de pedido: acción principal = marcar entregado */}
        {orderCtx?.id && (
          <button onClick={() => finish(true)} disabled={busy} className="w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl disabled:opacity-60 mb-2" style={{ background: '#16a34a' }}>
            <CheckCircle2 className="w-5 h-5" /> Marcar entregado
          </button>
        )}

        <div className="grid grid-cols-2 gap-2 mb-2" data-tour="route-actions">
          <button onClick={pause} disabled={busy} className="flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl disabled:opacity-60" style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)' }}>
            <Pause className="w-4.5 h-4.5" /> Detener
          </button>
          <button onClick={() => finish(false)} disabled={busy} className="flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-2xl disabled:opacity-60" style={{ background: orderCtx?.id ? '#6b7280' : '#dc2626' }}>
            <Square className="w-4.5 h-4.5" /> Finalizar
          </button>
        </div>
        <button onClick={cancelRoute} disabled={busy} data-tour="route-delete" className="w-full flex items-center justify-center gap-1.5 text-[12.5px] font-semibold py-2 rounded-xl disabled:opacity-60" style={{ background: 'var(--danger-soft)', color: '#B91C1C' }}>
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

      <div data-tour="route-driver">
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
      </div>

      {t.error && (
        <p className="mb-4 text-xs flex items-center gap-1" style={{ color: 'var(--danger)' }}>
          <AlertCircle className="w-3.5 h-3.5" /> {t.error}
        </p>
      )}

      <button onClick={start} disabled={busy} data-tour="route-start" className="w-full flex items-center justify-center gap-2 btn-gradient text-white font-bold py-4 rounded-2xl disabled:opacity-60">
        <Play className="w-5 h-5" /> {t.hasRoute ? 'Reanudar rastreo' : orderCtx ? 'Iniciar entrega' : 'Iniciar ruta'}
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
