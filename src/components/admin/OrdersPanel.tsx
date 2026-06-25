'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  RefreshCw, Package, CheckCircle, Truck, XCircle, Clock, CalendarDays,
  Receipt, ImageIcon, BadgeCheck, Banknote, X, Bell, BellOff, AlertCircle, Trash2, MapPin, Search, Navigation,
} from 'lucide-react';
import type { StaffRole } from '@/lib/adminAuth';

interface Order {
  id: string;
  customer_name: string;
  customer_whatsapp: string;
  delivery_zone: string | null;
  delivery_address: string | null;
  delivery_type?: string;
  items: { name: string; qty: number; price_usd: number }[];
  total_usd: number;
  total_cop?: number | null;
  currency_shown?: string;
  payment_method: string;
  payment_proof_ref?: string | null;
  payment_proof_url?: string | null;
  status: string;
  created_at: string;
  is_wholesale?: boolean;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  advance_usd?: number | null;
  remaining_usd?: number | null;
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string; Icon: React.ElementType }> = {
  pendiente:  { label: 'Pago por verificar', bg: 'var(--warning-soft)', fg: '#B45309', Icon: Clock },
  confirmado: { label: 'Pago aprobado',      bg: 'var(--success-soft)', fg: '#15803D', Icon: BadgeCheck },
  en_camino:  { label: 'En camino',          bg: 'var(--info-soft)',    fg: '#1D4ED8', Icon: Truck },
  entregado:  { label: 'Entregado',          bg: 'var(--surface-2)',    fg: 'var(--text-2)', Icon: CheckCircle },
  cancelado:  { label: 'Cancelado',          bg: 'var(--danger-soft)',  fg: '#B91C1C', Icon: XCircle },
};

// Next-step actions allowed from each status (simple state machine).
const NEXT_STEPS: Record<string, string[]> = {
  pendiente:  ['confirmado', 'cancelado'],
  confirmado: ['en_camino', 'entregado', 'cancelado'],
  en_camino:  ['entregado', 'cancelado'],
  entregado:  [],
  cancelado:  [],
};

const STEP_LABEL: Record<string, string> = {
  en_camino: '🛵 En camino',
  entregado: '✓ Entregado',
  cancelado: 'Cancelar',
};

type View = 'hoy' | 'mayor' | 'historial';
type RangeDays = '30' | '90' | 'all';
const PAGE = 40;

const VIEWS: { id: View; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'mayor', label: 'Al Mayor' },
  { id: 'historial', label: 'Historial' },
];

const RANGES: { id: RangeDays; label: string }[] = [
  { id: '30', label: '30 días' },
  { id: '90', label: '90 días' },
  { id: 'all', label: 'Todo' },
];

/** Fecha y hora exactas del pedido (ej. "24 jun, 2:45 p. m."). */
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function OrdersPanel({ role }: { role: StaffRole | null }) {
  const [view, setView] = useState<View>('hoy');
  const [rangeDays, setRangeDays] = useState<RangeDays>('30');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  // ── Alertas de pedidos nuevos (las maneja el provider global StaffAlerts) ──
  const [alertsOn, setAlertsOn] = useState<boolean>(() => {
    try { return localStorage.getItem('rl_admin_alerts') === '1'; } catch { return false; }
  });
  const [toast, setToast] = useState('');

  useEffect(() => {
    const sync = () => {
      try { setAlertsOn(localStorage.getItem('rl_admin_alerts') === '1'); } catch { /* ignore */ }
    };
    window.addEventListener('rl-alerts-changed', sync);
    return () => window.removeEventListener('rl-alerts-changed', sync);
  }, []);

  const toggleAlerts = () => {
    window.dispatchEvent(new Event(alertsOn ? 'rl-disable-alerts' : 'rl-enable-alerts'));
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!zoomImg) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomImg(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomImg]);

  // Debounce de la búsqueda (solo aplica en Historial).
  useEffect(() => {
    const t = setTimeout(() => setAppliedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const buildQuery = (v: View, off: number): string => {
    const p = new URLSearchParams();
    if (v === 'mayor') {
      p.set('wholesale', 'true');
    } else if (v === 'historial') {
      if (rangeDays === 'all') p.set('range', 'all'); else p.set('days', rangeDays);
      if (appliedSearch.trim()) p.set('q', appliedSearch.trim());
      p.set('limit', String(PAGE));
      p.set('offset', String(off));
    }
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  const load = useCallback(async (v: View, off = 0, append = false, silent = false) => {
    if (!silent && !append) setLoading(true);
    if (append) setLoadingMore(true);
    try {
      const res = await fetch(`/api/admin/orders${buildQuery(v, off)}`);
      if (res.ok) {
        const data = await res.json() as Order[];
        setOrders(prev => append ? [...prev, ...data] : data);
        if (v === 'historial') {
          setHasMore(data.length === PAGE);
          setOffset(off + data.length);
        } else {
          setHasMore(false);
        }
      } else if (!append) {
        setOrders([]);
      }
    } catch {
      if (!append) setOrders([]);
    } finally {
      if (!silent && !append) setLoading(false);
      if (append) setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays, appliedSearch]);

  // Recargar al cambiar de vista, rango o búsqueda.
  useEffect(() => { setOffset(0); load(view, 0, false); }, [view, rangeDays, appliedSearch, load]);

  // Auto-actualización cada 25s (sin spinner) — solo en vistas "vivas", no en historial.
  useEffect(() => {
    if (view === 'historial') return;
    const t = setInterval(() => { load(view, 0, false, true); }, 25000);
    return () => clearInterval(t);
  }, [view, load]);

  const updateStatus = async (id: string, status: string) => {
    if (status === 'cancelado' && !confirm('¿Cancelar este pedido? Esta acción no se puede deshacer.')) return;
    const prev = orders;
    setBusyId(id);
    setOrders(curr => curr.map(o => o.id === id ? { ...o, status } : o));
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setOrders(prev);
      setToast('No se pudo actualizar el pedido. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm('¿Eliminar este pedido de forma permanente? Esta acción no se puede deshacer.')) return;
    const prev = orders;
    setBusyId(id);
    setOrders(curr => curr.filter(o => o.id !== id));
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setOrders(prev);
      setToast('No se pudo eliminar el pedido. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setBusyId(null);
    }
  };

  const totalSum = orders.reduce((s, o) => s + (o.total_usd || 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pendiente').length;

  return (
    <div>
      {/* Sub-view switch */}
      <div className="flex gap-1.5 mb-4" data-tour="orders-views">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className="px-3 py-1.5 min-h-11 rounded-lg text-[12.5px] font-semibold transition-all"
            style={view === v.id
              ? { background: 'var(--brand-soft)', color: 'var(--brand-deep)', border: '1px solid var(--brand)' }
              : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            {v.label}
          </button>
        ))}
        <button
          onClick={toggleAlerts}
          data-tour="orders-alerts"
          className="ml-auto btn btn-ghost"
          style={{ padding: '8px', minWidth: 44, minHeight: 44, color: alertsOn ? 'var(--brand)' : 'var(--text-3)' }}
          aria-label={alertsOn ? 'Alertas activadas' : 'Activar alertas de pedidos'}
          title={alertsOn ? 'Alertas activadas (sonido + notificación)' : 'Activar alertas de pedidos nuevos'}
        >
          {alertsOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
        </button>
        <button onClick={() => load(view)} className="btn btn-ghost" style={{ padding: '8px', minWidth: 44, minHeight: 44 }} aria-label="Actualizar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Controles del Historial: rango + búsqueda */}
      {view === 'historial' && (
        <div className="mb-4 space-y-2.5">
          <div className="flex gap-1.5">
            {RANGES.map(r => (
              <button
                key={r.id}
                onClick={() => setRangeDays(r.id)}
                className="px-3 py-1.5 min-h-10 rounded-lg text-[12px] font-semibold transition-all"
                style={rangeDays === r.id
                  ? { background: 'var(--brand)', color: '#fff' }
                  : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-3)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o teléfono…"
              className="field"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>
        </div>
      )}

      {/* CTA para activar alertas */}
      {!alertsOn && (
        <button
          onClick={toggleAlerts}
          className="w-full mb-4 flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[13px] font-semibold"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)', border: '1px solid var(--brand)' }}
        >
          <Bell className="w-4 h-4" /> Activar alertas de pedidos nuevos (sonido + notificación al celular)
        </button>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2.5 mb-5" data-tour="orders-kpis">
        <KPI label="Pedidos" value={String(orders.length)} color="var(--text-1)" />
        <KPI label="Por verificar" value={String(pendingCount)} color="#B45309" />
        <KPI label="Total" value={`$${totalSum.toFixed(2)}`} color="var(--brand)" />
      </div>

      <div data-tour="orders-list">
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-16 px-6">
          <Package className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>No hay pedidos</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
            {view === 'historial' ? 'Prueba con otro rango o búsqueda.' : 'Aparecerán aquí en cuanto lleguen.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map(order => {
            const meta = STATUS_META[order.status] ?? STATUS_META.pendiente;
            const StatusIcon = meta.Icon;
            const mapsUrl = order.delivery_address?.match(/https?:\/\/\S+/)?.[0] ?? null;
            const addrText = order.delivery_address?.replace(/https?:\/\/\S+/, '').replace(/[·\s]+$/, '').trim() ?? '';
            const isCash = order.payment_method === 'efectivo';
            const isPending = order.status === 'pendiente';
            const busy = busyId === order.id;
            const followUps = (NEXT_STEPS[order.status] ?? []).filter(s => !(isPending && s === 'confirmado'));

            return (
              <div key={order.id} className="card p-4">
                {/* Meta: N° de pedido + fecha/hora exacta · estado a la derecha */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-[11px] font-mono" style={{ color: 'var(--text-3)' }}>
                    #{order.id.slice(-6).toUpperCase()} · {fmtDateTime(order.created_at)}
                  </span>
                  <span className="chip flex-shrink-0" style={{ background: meta.bg, color: meta.fg }}>
                    <StatusIcon className="w-3 h-3" /> {meta.label}
                  </span>
                </div>

                {/* Badges: mayor / moneda */}
                {(order.is_wholesale || order.currency_shown) && (
                  <div className="flex items-center gap-1.5 mb-2">
                    {order.is_wholesale && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)' }}>
                        AL MAYOR
                      </span>
                    )}
                    {order.currency_shown && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                        {order.currency_shown}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>{order.customer_name}</p>
                    <a
                      href={`https://wa.me/${order.customer_whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[12px] underline" style={{ color: 'var(--text-3)' }}
                    >
                      {order.customer_whatsapp}
                    </a>
                    {order.delivery_zone && <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-2)' }}>📍 {order.delivery_zone}</p>}
                    {addrText && (
                      <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-2)' }}>{addrText}</p>
                    )}
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-[12px] font-semibold px-2.5 py-1 rounded-lg"
                        style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)' }}
                      >
                        <MapPin className="w-3.5 h-3.5" /> Ver mapa
                      </a>
                    )}
                    {order.scheduled_date && (
                      <p className="text-[12px] mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--text-2)' }}>
                        <CalendarDays className="w-3 h-3" /> Agendado: {order.scheduled_date} {order.scheduled_time ?? ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[16px] font-bold t-num" style={{ color: 'var(--text-1)' }}>${order.total_usd.toFixed(2)}</p>
                    {order.total_cop != null && order.total_cop > 0 && (
                      <p className="text-[11px] t-num" style={{ color: 'var(--text-3)' }}>COP {Math.round(order.total_cop).toLocaleString('es-CO')}</p>
                    )}
                    <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{order.payment_method}</p>
                    {order.advance_usd != null && order.advance_usd > 0 && (
                      <p className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>Anticipo ${order.advance_usd.toFixed(2)}</p>
                    )}
                  </div>
                </div>

                <div className="text-[12px] mb-3 space-y-0.5 rounded-md p-2" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                  {order.items?.map((item, i) => <p key={i}>{item.qty}× {item.name}</p>)}
                </div>

                {/* Payment proof block */}
                <PaymentProof order={order} isCash={isCash} onZoom={setZoomImg} />

                {/* Primary approval CTA for pending orders */}
                {isPending && (
                  <button
                    onClick={() => updateStatus(order.id, 'confirmado')}
                    disabled={busy}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl text-[14px] transition-all disabled:opacity-60"
                    style={{ background: 'var(--success, #16A34A)' }}
                  >
                    {busy
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : <BadgeCheck className="w-4.5 h-4.5" />}
                    {isCash ? 'Confirmar pedido (pago en efectivo)' : 'Aprobar pago'}
                  </button>
                )}

                {/* Follow-up transitions */}
                {followUps.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {followUps.map(s => {
                      const danger = s === 'cancelado';
                      return (
                        <button
                          key={s}
                          onClick={() => updateStatus(order.id, s)}
                          disabled={busy}
                          className="text-[12px] px-3 py-1.5 min-h-11 rounded-lg font-medium transition-colors disabled:opacity-50"
                          style={danger
                            ? { background: 'var(--danger-soft)', color: '#B91C1C', border: '1px solid transparent' }
                            : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                        >
                          {STEP_LABEL[s] ?? STATUS_META[s]?.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Iniciar ruta de entrega (pedidos a domicilio confirmados / en camino) */}
                {(order.status === 'confirmado' || order.status === 'en_camino') && order.delivery_type !== 'retiro' && (
                  <a
                    href={`/ruta?order=${order.id}`}
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 text-[13px] font-bold py-2.5 rounded-xl transition-colors"
                    style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)', border: '1px solid var(--brand)' }}
                  >
                    <Navigation className="w-4 h-4" /> Iniciar ruta de entrega
                  </a>
                )}

                {/* Eliminar pedido — solo admin */}
                {role === 'admin' && (
                  <div className="mt-3 pt-3 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={() => deleteOrder(order.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 min-h-11 rounded-lg transition-colors disabled:opacity-50"
                      style={{ background: 'var(--danger-soft)', color: '#B91C1C' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar pedido
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Paginación del historial */}
          {view === 'historial' && hasMore && (
            <button
              onClick={() => load(view, offset, true)}
              disabled={loadingMore}
              className="w-full mt-1 py-3 rounded-xl text-[13px] font-semibold transition-colors disabled:opacity-60"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              {loadingMore ? 'Cargando…' : 'Cargar más'}
            </button>
          )}
        </div>
      )}
      </div>

      {/* Image lightbox */}
      {zoomImg && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setZoomImg(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Comprobante de pago"
        >
          <button
            onClick={() => setZoomImg(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white"
            style={{ background: 'rgba(255,255,255,0.15)' }}
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomImg} alt="Comprobante de pago" className="max-w-full max-h-full rounded-lg object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Toast de error */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[130] w-[calc(100%-2rem)] max-w-sm">
          <div className="flex items-start gap-2 rounded-xl px-4 py-3 shadow-lg" role="alert" aria-live="assertive" style={{ background: '#7F1D1D', color: '#fff' }}>
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="text-[13px] flex-1">{toast}</p>
            <button onClick={() => setToast('')} aria-label="Cerrar" className="flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentProof({
  order, isCash, onZoom,
}: {
  order: Order;
  isCash: boolean;
  onZoom: (url: string) => void;
}) {
  if (isCash) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
        <Banknote className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-3)' }} />
        Pago en efectivo — se cobra al entregar. No requiere comprobante.
      </div>
    );
  }

  const hasRef = !!order.payment_proof_ref;
  const hasImg = !!order.payment_proof_url;

  if (!hasRef && !hasImg) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: 'var(--warning-soft)', color: '#B45309' }}>
        <Receipt className="w-4 h-4 flex-shrink-0" />
        El cliente no adjuntó comprobante. Verifica el pago antes de aprobar.
      </div>
    );
  }

  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--surface-2)' }}>
      <p className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
        <Receipt className="w-3.5 h-3.5" /> Comprobante de pago
      </p>
      {hasRef && (
        <p className="text-[13px]" style={{ color: 'var(--text-1)' }}>
          Referencia: <span className="font-bold font-mono">{order.payment_proof_ref}</span>
        </p>
      )}
      {hasImg && (
        <button
          onClick={() => onZoom(order.payment_proof_url!)}
          className="relative w-full h-28 rounded-lg overflow-hidden border group"
          style={{ borderColor: 'var(--border)' }}
        >
          <Image src={order.payment_proof_url!} alt="Comprobante" fill className="object-cover" sizes="400px" unoptimized />
          <span className="absolute inset-0 flex items-center justify-center gap-1 text-white text-[12px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <ImageIcon className="w-4 h-4" /> Ver comprobante
          </span>
        </button>
      )}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-[20px] font-bold mt-0.5 t-num" style={{ color }}>{value}</p>
    </div>
  );
}
