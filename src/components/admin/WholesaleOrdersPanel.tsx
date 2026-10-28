'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, RefreshCw, UserRound, X, Check, Pencil, Ban, Undo2,
  PackagePlus, ListChecks, Wallet, Truck, MapPin, Square, SquareCheck,
  Navigation, Play, CalendarClock, AlertTriangle, Receipt,
} from 'lucide-react';
import { loadSavedDriver, saveDriver, useRouteTracking, type DriverChoice } from '@/components/RouteTracking';
import { formatDistance } from '@/lib/routes';
import { routeLabel } from '@/lib/wholesaleRoutes';
import TicketSheet from './TicketSheet';
import {
  MAX_AHEAD_DAYS,
  addDays,
  caracasDate,
  formatCop,
  formatUsd,
  formatYmd,
  paymentState,
  sameDriver,
  type StoredRates,
  type WholesaleOrder,
} from '@/lib/wholesaleOrders';
import WholesaleOrderForm from './WholesaleOrderForm';
import WholesaleCollections from './WholesaleCollections';

type View = 'nuevo' | 'dia' | 'cobros';
type Filter = 'todos' | 'sin' | 'mios' | 'entregados';

interface DayData {
  date: string;
  today: string;
  rates: StoredRates | null;
  orders: WholesaleOrder[];
  /** Pedidos de días anteriores que siguen abiertos (sin entregar o sin cobrar). */
  carryover: WholesaleOrder[];
  upcoming: { date: string; count: number }[];
}

const POLL_MS = 30000;
const PREVIEW_LINES = 3;

type DayResult = { data: DayData } | { data?: undefined; error: string; status?: number };

async function fetchDay(date: string): Promise<DayResult> {
  try {
    const res = await fetch(`/api/admin/wholesale-orders?date=${date}`);
    const body = await res.json().catch(() => ({})) as DayData & { error?: string };
    if (!res.ok) return { error: body.error ?? 'No se pudieron cargar los pedidos.', status: res.status };
    return { data: body };
  } catch {
    return { error: 'Error de conexión.' };
  }
}

/**
 * Pedidos mayoristas por teléfono (equipo y admin): registrar, repartir entre
 * domiciliarios, entregar y hacer el cierre de cobros del día.
 */
export default function WholesaleOrdersPanel({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const track = useRouteTracking();
  const [view, setView] = useState<View>('dia');
  const [ticketFor, setTicketFor] = useState<string | null>(null);
  const [date, setDate] = useState(() => caracasDate());
  const [data, setData] = useState<DayData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<WholesaleOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [routeBusy, setRouteBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);

  // El panel solo se monta en el navegador (tras validar la sesión), así que puede leer localStorage al iniciar.
  const [me, setMe] = useState<DriverChoice | null>(() => loadSavedDriver());
  const [drivers, setDrivers] = useState<DriverChoice[]>([]);
  const [identityOpen, setIdentityOpen] = useState(false);

  useEffect(() => {
    fetch('/api/admin/drivers')
      .then(r => (r.ok ? r.json() : []))
      .then((rows: { id: string; name: string; active: boolean }[]) =>
        setDrivers(Array.isArray(rows) ? rows.filter(d => d.active).map(d => ({ id: d.id, name: d.name })) : []))
      .catch(() => {});
  }, []);

  const apply = useCallback((r: DayResult, quiet: boolean) => {
    if (r.data) {
      const body = r.data;
      setLoadError('');
      setData(body);
      setSelected(curr => new Set([...curr].filter(id => body.orders.some(o => o.id === id))));
    } else if (!quiet || r.status) {
      setLoadError(r.error);
    }
  }, []);

  const load = useCallback(async (d: string, quiet = false) => apply(await fetchDay(d), quiet), [apply]);

  // Al cambiar de fecha rápido, una respuesta vieja no debe pisar la del día que se está viendo.
  useEffect(() => {
    let cancelled = false;
    fetchDay(date).then(r => { if (!cancelled) apply(r, false); });
    return () => { cancelled = true; };
  }, [date, apply]);

  const refresh = async () => {
    setRefreshing(true);
    await load(date);
    setRefreshing(false);
  };
  const loading = !loadError && (!data || data.date !== date);

  // Otros domiciliarios toman y entregan pedidos desde sus teléfonos.
  useEffect(() => {
    if (view === 'nuevo') return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(date, true); }, POLL_MS);
    return () => clearInterval(t);
  }, [view, date, load]);

  const today = data?.today ?? caracasDate();
  const orders = useMemo(() => data?.orders ?? [], [data]);
  const carryover = useMemo(() => data?.carryover ?? [], [data]);
  /** Pedidos de días pasados que nadie marcó entregado: se quedarían invisibles. */
  const stale = useMemo(() => carryover.filter(o => o.status === 'registrado'), [carryover]);

  // El aviso flotante de rastreo sobra aquí: esta pantalla ya muestra la ruta.
  const { setScreenOpen } = track;
  useEffect(() => {
    if (view !== 'dia') return;
    setScreenOpen(true);
    return () => setScreenOpen(false);
  }, [view, setScreenOpen]);

  useEffect(() => {
    if (!track.tracking) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [track.tracking]);

  const replaceOrder = (o: WholesaleOrder) => {
    setData(curr => curr && {
      ...curr,
      orders: o.delivery_date === curr.date
        ? (curr.orders.some(x => x.id === o.id) ? curr.orders.map(x => (x.id === o.id ? o : x)) : [...curr.orders, o])
        : curr.orders.filter(x => x.id !== o.id),
      carryover: curr.carryover.map(x => (x.id === o.id ? o : x)),
    });
  };

  const counts = useMemo(() => ({
    todos: orders.length,
    sin: orders.filter(o => o.status === 'registrado' && !o.driver_name).length,
    mios: me ? orders.filter(o => o.status !== 'cancelado' && sameDriver(me, o)).length : 0,
    entregados: orders.filter(o => o.status === 'entregado').length,
  }), [orders, me]);

  const mineOpen = useMemo(
    () => (me ? orders.filter(o => o.status === 'registrado' && sameDriver(me, o)).length : 0),
    [orders, me],
  );

  const visible = useMemo(() => {
    const list = orders.filter(o => {
      if (filter === 'sin') return o.status === 'registrado' && !o.driver_name;
      if (filter === 'mios') return !!me && o.status !== 'cancelado' && sameDriver(me, o);
      if (filter === 'entregados') return o.status === 'entregado';
      return true;
    });
    const rank = (o: WholesaleOrder) => (o.status === 'registrado' ? 0 : o.status === 'entregado' ? 1 : 2);
    return [...list].sort((a, b) => rank(a) - rank(b));
  }, [orders, filter, me]);

  const toggle = (id: string, set: React.Dispatch<React.SetStateAction<Set<string>>>) =>
    set(curr => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const act = async (o: WholesaleOrder, action: string, confirmText?: string, extra?: Record<string, unknown>) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/wholesale-orders/${o.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Entregar un pedido que nadie tomó deja constancia de quién lo llevó.
        body: JSON.stringify({
          action,
          ...extra,
          ...(action === 'deliver' && me ? { driver_id: me.id, driver_name: me.name } : {}),
        }),
      });
      const body = await res.json().catch(() => ({})) as WholesaleOrder & { error?: string };
      if (!res.ok) { setNotice({ tone: 'error', text: body.error ?? 'No se pudo actualizar.' }); load(date, true); return; }
      replaceOrder(body);
    } catch {
      setNotice({ tone: 'error', text: 'Error de conexión.' });
    } finally {
      setBusy(false);
    }
  };

  const takeSelected = async () => {
    if (!me) { setIdentityOpen(true); return; }
    const chosen = orders.filter(o => selected.has(o.id) && o.status === 'registrado' && !sameDriver(me, o));
    if (chosen.length === 0) { setSelected(new Set()); return; }
    const free = chosen.filter(o => !o.driver_name);
    const heldBy = new Map<string, string[]>();
    for (const o of chosen) {
      if (!o.driver_name) continue;
      heldBy.set(o.driver_name, [...(heldBy.get(o.driver_name) ?? []), o.id]);
    }
    if (heldBy.size > 0) {
      const names = [...heldBy.keys()].join(' y ');
      const n = chosen.length - free.length;
      if (!confirm(`${n === 1 ? 'Un pedido lo lleva' : `${n} pedidos los lleva`} ${names}. ¿Te ${n === 1 ? 'lo' : 'los'} llevas tú?`)) return;
    }

    setBusy(true);
    setNotice(null);
    const calls: { ids: string[]; from_driver_name?: string }[] = [];
    if (free.length) calls.push({ ids: free.map(o => o.id) });
    for (const [name, ids] of heldBy) calls.push({ ids, from_driver_name: name });

    let conflicts: { client_name: string; driver_name: string | null; status: string }[] = [];
    try {
      for (const c of calls) {
        const res = await fetch('/api/admin/wholesale-orders/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...c, driver_id: me.id, driver_name: me.name }),
        });
        if (res.status === 409) {
          const body = await res.json().catch(() => ({})) as { conflicts?: typeof conflicts };
          conflicts = [...conflicts, ...(body.conflicts ?? [])];
        } else if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          setNotice({ tone: 'error', text: body.error ?? 'No se pudieron asignar los pedidos.' });
        }
      }
      if (conflicts.length) {
        setNotice({
          tone: 'error',
          text: `No se pudo tomar: ${conflicts.map(c => `${c.client_name}${c.driver_name ? ` (lo lleva ${c.driver_name})` : c.status !== 'registrado' ? ` (${c.status})` : ''}`).join(', ')}.`,
        });
      } else {
        setNotice({ tone: 'ok', text: `Llevas ${chosen.length} ${chosen.length === 1 ? 'pedido' : 'pedidos'} más.` });
      }
      setSelected(new Set());
      await load(date, true);
    } catch {
      setNotice({ tone: 'error', text: 'Error de conexión.' });
    } finally {
      setBusy(false);
    }
  };

  // Rastreo GPS del reparto, desde la misma lista de pedidos.
  const startRoute = async () => {
    if (!me) { setIdentityOpen(true); return; }
    setRouteBusy(true);
    setNotice(null);
    const ok = await track.start(me, null);
    setRouteBusy(false);
    if (!ok) setNotice({ tone: 'error', text: 'No se pudo iniciar la ruta. Revisa el permiso de ubicación.' });
  };

  const finishRoute = async () => {
    if (!confirm('¿Finalizar la ruta? Se cierra el recorrido y deja de rastrear.')) return;
    setRouteBusy(true);
    const closed = await track.finish(false);
    setRouteBusy(false);
    if (!closed) setNotice({ tone: 'error', text: 'No se pudo finalizar la ruta. Revisa la conexión e intenta de nuevo.' });
  };

  const chooseIdentity = (d: DriverChoice) => {
    saveDriver(d);
    setMe(d);
    setIdentityOpen(false);
  };

  const routeSeconds = track.startedAt ? Math.max(0, Math.floor((now - track.startedAt) / 1000)) : 0;
  const routeClock = `${String(Math.floor(routeSeconds / 60)).padStart(2, '0')}:${String(routeSeconds % 60).padStart(2, '0')}`;

  const selectable = (o: WholesaleOrder) => o.status === 'registrado' && !(me && sameDriver(me, o));
  const selectedCount = orders.filter(o => selected.has(o.id) && selectable(o)).length;

  const tabs: { id: View; label: string; Icon: React.ElementType; badge?: number }[] = [
    { id: 'nuevo', label: 'Nuevo', Icon: PackagePlus },
    { id: 'dia', label: 'Del día', Icon: ListChecks, badge: orders.filter(o => o.status !== 'cancelado').length },
    { id: 'cobros', label: 'Cobros', Icon: Wallet },
  ];

  return (
    <div className={selectedCount > 0 && view === 'dia' ? 'pb-28' : 'pb-10'}>
      {ticketFor && <TicketSheet source={{ wholesaleOrderId: ticketFor }} onClose={() => setTicketFor(null)} />}
      {/* Quién soy + fecha */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button onClick={() => setIdentityOpen(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-semibold"
          style={{ background: me ? 'var(--surface-2)' : 'var(--warning-soft)', color: me ? 'var(--text-1)' : '#B45309', minHeight: 40 }}>
          <UserRound className="w-4 h-4" />
          {me ? <>Eres: {me.name} <span style={{ color: 'var(--brand-deep)' }}>· cambiar</span></> : '¿Quién eres?'}
        </button>
        <button onClick={refresh} className="btn btn-ghost" style={{ padding: '8px', minWidth: 40, minHeight: 40, border: '1px solid var(--border)' }} aria-label="Recargar">
          <RefreshCw className={`w-4 h-4 ${loading || refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {view === 'dia' && (
        <>
          <div className="card p-1.5 mb-2 flex items-center justify-between">
            <button onClick={() => setDate(d => addDays(d, -1))} className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ color: 'var(--text-2)' }} aria-label="Día anterior">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              {/* Tocar la fecha abre el calendario del teléfono: cualquier día, no solo hoy y mañana. */}
              <div className="relative inline-block">
                <p className="text-[14px] font-bold capitalize" style={{ color: 'var(--text-1)' }}>{formatYmd(date)}</p>
                <input
                  type="date" value={date} aria-label="Elegir día"
                  min={addDays(today, -365)} max={addDays(today, MAX_AHEAD_DAYS)}
                  onChange={e => { if (e.target.value) setDate(e.target.value); }}
                  onClick={e => { try { e.currentTarget.showPicker?.(); } catch { /* el navegador decide */ } }}
                  className="absolute inset-0 w-full h-full opacity-0"
                />
              </div>
              {date === today
                ? <p className="text-[11px] font-semibold" style={{ color: 'var(--brand-deep)' }}>Hoy</p>
                : <button onClick={() => setDate(today)} className="text-[11px] font-semibold" style={{ color: 'var(--brand-deep)' }}>Volver a hoy</button>}
            </div>
            <button onClick={() => setDate(d => addDays(d, 1))} className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ color: 'var(--text-2)' }} aria-label="Día siguiente">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {(data?.upcoming.length ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none mb-3 -mx-1 px-1">
              <span className="text-[11.5px] font-semibold inline-flex items-center gap-1 whitespace-nowrap" style={{ color: 'var(--text-3)' }}>
                <CalendarClock className="w-3.5 h-3.5" /> Próximos:
              </span>
              {data?.upcoming.map(u => (
                <button key={u.date} onClick={() => setDate(u.date)}
                  className="rounded-full px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap border capitalize"
                  style={{ background: 'var(--surface)', color: 'var(--text-2)', borderColor: 'var(--border)' }}>
                  {formatYmd(u.date)} · {u.count}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-3 gap-1.5 mb-4" role="tablist">
        {tabs.map(t => {
          const active = view === t.id;
          return (
            <button key={t.id} role="tab" aria-selected={active}
              // Los cobros son siempre el cierre de hoy, no el del día que se esté mirando.
              onClick={() => { setView(t.id); setNotice(null); if (t.id === 'cobros') setDate(today); }}
              className="rounded-2xl py-2.5 text-[13px] font-bold inline-flex items-center justify-center gap-1.5 border"
              style={active
                ? { background: 'var(--brand)', color: '#fff', borderColor: 'transparent' }
                : { background: 'var(--surface)', color: 'var(--text-2)', borderColor: 'var(--border)' }}>
              <t.Icon className="w-4 h-4" /> {t.label}
              {t.badge ? <span className="text-[11px] opacity-90">({t.badge})</span> : null}
            </button>
          );
        })}
      </div>

      {notice && (
        <div className="card p-3 mb-3 flex items-start gap-2" style={{ background: notice.tone === 'ok' ? 'var(--success-soft)' : 'var(--danger-soft)' }}>
          <p className="text-[12.5px] font-semibold flex-1" style={{ color: notice.tone === 'ok' ? '#15803D' : '#B91C1C' }}>{notice.text}</p>
          <button onClick={() => setNotice(null)} aria-label="Cerrar aviso" style={{ color: 'var(--text-3)' }}><X className="w-4 h-4" /></button>
        </div>
      )}

      {loadError && view !== 'nuevo' && (
        <p className="card p-4 text-[13px] mb-3" style={{ color: 'var(--danger)' }}>{loadError}</p>
      )}

      {view === 'nuevo' && (
        <WholesaleOrderForm
          key={editing?.id ?? 'nuevo'}
          me={me}
          today={today}
          rates={data?.rates ?? null}
          editing={editing}
          onCancelEdit={() => { setEditing(null); setView('dia'); }}
          onSaved={o => {
            setNotice({ tone: 'ok', text: editing ? `Pedido de ${o.client_name} actualizado.` : `Pedido de ${o.client_name} guardado.` });
            if (!editing) setTicketFor(o.id); // recién guardado: el ticket queda listo para mandar
            setEditing(null);
            setView('dia');
            if (o.delivery_date === date) replaceOrder(o); else setDate(o.delivery_date);
          }}
        />
      )}

      {view === 'cobros' && data && (
        <WholesaleCollections
          today={today}
          orders={data.orders}
          carryover={data.carryover}
          rates={data.rates}
          me={me}
          onOrderChange={replaceOrder}
          onNeedIdentity={() => setIdentityOpen(true)}
        />
      )}

      {view === 'dia' && (
        loading && !data ? (
          <div className="flex justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>
        ) : (
          <>
            {/* Rastreo GPS del reparto, sin salir de la lista */}
            <div className="mb-3">
              {track.tracking ? (
                <div className="card p-3.5" style={{ background: 'var(--success-soft)', borderColor: '#86EFAC' }}>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#16a34a' }} />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#16a34a' }} />
                    </span>
                    <p className="text-[13.5px] font-bold" style={{ color: '#15803D' }}>Ruta en curso</p>
                    <p className="text-[12px] t-num ml-auto" style={{ color: '#15803D' }}>{routeClock} · {formatDistance(track.distanceM)}</p>
                  </div>
                  <p className="text-[12px] mt-1" style={{ color: '#15803D' }}>
                    {mineOpen > 0
                      ? `Te ${mineOpen === 1 ? 'queda 1 pedido' : `quedan ${mineOpen} pedidos`} por entregar.`
                      : 'Entregaste todos tus pedidos: ya puedes finalizar.'}
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-2.5">
                    <button onClick={() => router.push('/ruta')} className="rounded-xl text-[13px] font-bold inline-flex items-center justify-center gap-1.5"
                      style={{ background: 'var(--surface)', color: '#15803D', border: '1px solid #86EFAC', minHeight: 44 }}>
                      <MapPin className="w-4 h-4" /> Ver mapa
                    </button>
                    <button onClick={finishRoute} disabled={routeBusy} className="rounded-xl text-[13px] font-bold text-white inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ background: '#16a34a', minHeight: 44 }}>
                      <Check className="w-4 h-4" /> Finalizar ruta
                    </button>
                  </div>
                </div>
              ) : track.hasRoute ? (
                <button onClick={() => track.resume()} className="w-full rounded-2xl px-4 py-3.5 text-[14px] font-bold inline-flex items-center justify-center gap-2"
                  style={{ background: 'var(--info-soft)', color: '#1D4ED8', border: '1px solid #93C5FD' }}>
                  <Navigation className="w-4.5 h-4.5" /> Reanudar tu ruta
                </button>
              ) : (
                <button onClick={startRoute} disabled={routeBusy} className="w-full rounded-2xl px-4 py-3.5 text-[14.5px] font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: 'var(--brand)' }}>
                  <Play className="w-5 h-5" />
                  {routeBusy ? 'Iniciando…' : mineOpen > 0 ? `Iniciar ruta · ${mineOpen} ${mineOpen === 1 ? 'pedido' : 'pedidos'}` : 'Iniciar ruta'}
                </button>
              )}
              {track.error && <p className="text-[12px] mt-1.5" style={{ color: 'var(--danger)' }}>{track.error}</p>}
            </div>

            {/* Pedidos viejos que nadie cerró: si no, se pierden de vista */}
            {date === today && stale.length > 0 && (
              <div className="card p-3.5 mb-3" style={{ background: 'var(--warning-soft)', borderColor: '#FCD34D' }}>
                <p className="text-[12.5px] font-bold inline-flex items-center gap-1.5 mb-2" style={{ color: '#B45309' }}>
                  <AlertTriangle className="w-4 h-4" /> Sin entregar de días anteriores · {stale.length}
                </p>
                <div className="space-y-2">
                  {stale.map(o => (
                    <div key={o.id} className="rounded-xl p-2.5" style={{ background: 'var(--surface)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text-1)' }}>{o.client_name}</p>
                          <p className="text-[11.5px] capitalize" style={{ color: 'var(--text-3)' }}>
                            {formatYmd(o.delivery_date)}{o.driver_name ? ` · lo lleva ${o.driver_name}` : ' · sin asignar'}
                          </p>
                        </div>
                        <p className="text-[13px] font-bold t-num flex-shrink-0" style={{ color: 'var(--text-1)' }}>{formatCop(o.total_cop)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <button disabled={busy} onClick={() => act(o, 'deliver')}
                          className="rounded-xl px-3 text-[12.5px] font-bold text-white inline-flex items-center gap-1 disabled:opacity-50"
                          style={{ background: '#16a34a', minHeight: 40 }}>
                          <Check className="w-4 h-4" /> Entregado
                        </button>
                        <IconButton disabled={busy} label="Pasar a hoy"
                          onClick={() => act(o, 'edit', `¿Pasar el pedido de ${o.client_name} a hoy?`, { delivery_date: today })}>
                          <CalendarClock className="w-4 h-4" />
                        </IconButton>
                        <IconButton disabled={busy} label="Cancelar" danger
                          onClick={() => act(o, 'cancel', `¿Cancelar el pedido de ${o.client_name}?`)}>
                          <Ban className="w-4 h-4" />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-1.5 overflow-x-auto scrollbar-none mb-3 -mx-1 px-1">
              {([
                ['todos', 'Todos'], ['sin', 'Sin asignar'], ['mios', 'Míos'], ['entregados', 'Entregados'],
              ] as [Filter, string][]).map(([id, text]) => (
                <button key={id} onClick={() => setFilter(id)} className="rounded-full px-3 py-2 text-[12.5px] font-semibold whitespace-nowrap border"
                  style={filter === id
                    ? { background: 'var(--brand-soft)', color: 'var(--brand-deep)', borderColor: 'var(--brand)' }
                    : { background: 'var(--surface)', color: 'var(--text-2)', borderColor: 'var(--border)' }}>
                  {text} · {counts[id]}
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <div className="card text-center py-12 px-6">
                <Truck className="w-9 h-9 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>
                  {orders.length === 0 ? 'Sin pedidos mayoristas para esta fecha' : 'Nada en este filtro'}
                </p>
                {orders.length === 0 && (
                  <button onClick={() => setView('nuevo')} className="btn btn-primary mt-4" style={{ minHeight: 44 }}>
                    <PackagePlus className="w-4 h-4" /> Registrar pedido
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {visible.map(o => {
                  const mine = !!me && sameDriver(me, o);
                  const canSelect = selectable(o);
                  const isSelected = selected.has(o.id) && canSelect;
                  const open = expanded.has(o.id);
                  const lines = open ? o.items : o.items.slice(0, PREVIEW_LINES);
                  const pay = paymentState(o);
                  const hasPayments = o.payments.length > 0;
                  return (
                    <div key={o.id} className="card p-3.5"
                      style={{
                        ...(o.status === 'cancelado' ? { opacity: 0.55 } : {}),
                        ...(isSelected ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)' } : {}),
                      }}>
                      <div className="flex items-start gap-2.5">
                        {canSelect ? (
                          <button onClick={() => toggle(o.id, setSelected)} className="w-11 h-11 -ml-1.5 -mt-1.5 flex items-center justify-center flex-shrink-0"
                            aria-label={isSelected ? `Quitar ${o.client_name} de la selección` : `Seleccionar ${o.client_name}`} aria-pressed={isSelected}>
                            {isSelected
                              ? <SquareCheck className="w-6 h-6" style={{ color: 'var(--brand)' }} />
                              : <Square className="w-6 h-6" style={{ color: 'var(--text-3)' }} />}
                          </button>
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>{o.client_name}</p>
                            <p className="text-[14px] font-bold t-num flex-shrink-0" style={{ color: 'var(--text-1)' }}>{formatCop(o.total_cop)}</p>
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[11.5px] flex items-start gap-1 min-w-0" style={{ color: 'var(--text-3)' }}>
                              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span className="truncate">{o.client_address || routeLabel(o.client_route)}</span>
                            </p>
                            <p className="text-[11px] t-num flex-shrink-0" style={{ color: 'var(--text-3)' }}>{formatUsd(o.total_usd)}</p>
                          </div>

                          <ul className="mt-2 space-y-0.5">
                            {lines.map(i => (
                              <li key={`${i.product_id}::${i.flavor_id ?? ''}`} className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>
                                <span className="font-bold t-num" style={{ color: 'var(--text-1)' }}>{i.qty} ×</span> {i.name}
                              </li>
                            ))}
                          </ul>
                          {o.items.length > PREVIEW_LINES && (
                            <button onClick={() => toggle(o.id, setExpanded)} className="text-[12px] font-semibold mt-0.5" style={{ color: 'var(--brand-deep)' }}>
                              {open ? 'Ver menos' : `+${o.items.length - PREVIEW_LINES} más`}
                            </button>
                          )}
                          {o.notes && <p className="text-[12px] mt-1 italic" style={{ color: 'var(--text-3)' }}>{o.notes}</p>}

                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {o.status === 'cancelado' ? (
                              <Chip bg="var(--surface-2)" fg="var(--text-3)">Cancelado</Chip>
                            ) : o.driver_name ? (
                              <Chip bg={mine ? 'var(--brand-soft)' : 'var(--info-soft)'} fg={mine ? 'var(--brand-deep)' : '#1D4ED8'}>
                                <Truck className="w-3 h-3" /> {mine ? 'Lo llevas tú' : `Lo lleva ${o.driver_name}`}
                              </Chip>
                            ) : (
                              <Chip bg="var(--warning-soft)" fg="#B45309">Sin asignar</Chip>
                            )}
                            {o.status === 'entregado' && (
                              <>
                                <Chip bg="var(--success-soft)" fg="#15803D"><Check className="w-3 h-3" /> Entregado</Chip>
                                <Chip
                                  bg={pay === 'pagado' ? 'var(--success-soft)' : pay === 'abonado' ? 'var(--warning-soft)' : 'var(--surface-2)'}
                                  fg={pay === 'pagado' ? '#15803D' : pay === 'abonado' ? '#B45309' : 'var(--text-3)'}>
                                  {pay === 'pagado' ? 'Pagado' : pay === 'abonado' ? 'Abonó' : 'Por cobrar'}
                                </Chip>
                              </>
                            )}
                            {o.status !== 'cancelado' && (
                              <button onClick={() => setTicketFor(o.id)} data-tour="wo-ticket"
                                className="rounded-full px-2.5 text-[11px] font-bold inline-flex items-center gap-1"
                                style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)', minHeight: 28 }}>
                                <Receipt className="w-3 h-3" /> Ticket
                              </button>
                            )}
                          </div>

                          {o.status === 'registrado' && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              <button disabled={busy} onClick={() => act(o, 'deliver')}
                                className="rounded-xl px-3 text-[12.5px] font-bold text-white inline-flex items-center gap-1 disabled:opacity-50"
                                style={{ background: '#16a34a', minHeight: 40 }}>
                                <Check className="w-4 h-4" /> Entregado
                              </button>
                              <IconButton disabled={busy || hasPayments} label="Editar" onClick={() => { setEditing(o); setView('nuevo'); }}>
                                <Pencil className="w-4 h-4" />
                              </IconButton>
                              {o.driver_name && (
                                <IconButton disabled={busy} label="Soltar" onClick={() => act(o, 'release', `¿Soltar el pedido de ${o.client_name}? Queda sin asignar.`)}>
                                  <Undo2 className="w-4 h-4" />
                                </IconButton>
                              )}
                              <IconButton disabled={busy || hasPayments} label="Cancelar" danger onClick={() => act(o, 'cancel', `¿Cancelar el pedido de ${o.client_name}?`)}>
                                <Ban className="w-4 h-4" />
                              </IconButton>
                            </div>
                          )}
                          {o.status === 'entregado' && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              <button onClick={() => setView('cobros')} className="rounded-xl px-3 text-[12.5px] font-bold inline-flex items-center gap-1"
                                style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)', minHeight: 40 }}>
                                <Wallet className="w-4 h-4" /> Cobro
                              </button>
                              {!hasPayments && (
                                <IconButton disabled={busy} label="No entregado" onClick={() => act(o, 'undeliver', `¿Marcar el pedido de ${o.client_name} como NO entregado?`)}>
                                  <Undo2 className="w-4 h-4" />
                                </IconButton>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )
      )}

      {/* Barra para llevarse los pedidos seleccionados */}
      {view === 'dia' && selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pt-3" style={{ background: 'linear-gradient(to top, var(--bg) 70%, transparent)' }}>
          <div className="max-w-2xl mx-auto flex gap-2">
            <button onClick={() => setSelected(new Set())} className="btn btn-ghost" style={{ minHeight: 52, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              Quitar
            </button>
            <button onClick={takeSelected} disabled={busy} className="btn btn-primary flex-1" style={{ minHeight: 52, fontSize: 15 }}>
              <Truck className="w-5 h-5" /> {busy ? 'Asignando…' : `Llevar ${selectedCount} ${selectedCount === 1 ? 'pedido' : 'pedidos'}`}
            </button>
          </div>
        </div>
      )}

      {identityOpen && (
        <IdentitySheet
          drivers={drivers}
          current={me}
          isAdmin={isAdmin}
          onClose={() => setIdentityOpen(false)}
          onChoose={chooseIdentity}
        />
      )}
    </div>
  );
}

function Chip({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: {
  label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="rounded-xl px-3 text-[12.5px] font-semibold inline-flex items-center gap-1 disabled:opacity-40"
      style={{ background: danger ? 'var(--danger-soft)' : 'var(--surface-2)', color: danger ? '#B91C1C' : 'var(--text-2)', minHeight: 40 }}>
      {children} {label}
    </button>
  );
}

function IdentitySheet({ drivers, current, isAdmin, onClose, onChoose }: {
  drivers: DriverChoice[];
  current: DriverChoice | null;
  isAdmin: boolean;
  onClose: () => void;
  onChoose: (d: DriverChoice) => void;
}) {
  const [custom, setCustom] = useState('');
  const options = isAdmin ? [...drivers, { id: null, name: 'Administrador' }] : drivers;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden" style={{ background: 'var(--surface)' }}
        role="dialog" aria-modal="true" aria-label="¿Quién eres?">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>¿Quién eres?</h2>
          <button onClick={onClose} className="p-1" style={{ color: 'var(--text-3)' }} aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-4 py-4 space-y-3">
          <p className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>
            Se guarda en este teléfono. Así se sabe quién lleva cada pedido y quién anotó cada cobro.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {options.map(d => {
              const active = !!current && current.name === d.name && current.id === d.id;
              return (
                <button key={d.id ?? d.name} onClick={() => onChoose(d)} className="py-3 rounded-2xl text-[13.5px] font-bold border"
                  style={active
                    ? { background: 'var(--brand)', color: '#fff', borderColor: 'transparent' }
                    : { background: 'var(--surface)', color: 'var(--text-1)', borderColor: 'var(--border)' }}>
                  {d.name}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <label htmlFor="who-custom" className="sr-only">Otro nombre</label>
            <input id="who-custom" value={custom} onChange={e => setCustom(e.target.value)} placeholder="…o escribe tu nombre" className="field flex-1" />
            <button disabled={!custom.trim()} onClick={() => onChoose({ id: null, name: custom.trim() })} className="btn btn-primary" style={{ minHeight: 44 }}>
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
