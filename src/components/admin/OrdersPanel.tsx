'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  RefreshCw, Package, CheckCircle, Truck, XCircle, Clock, CalendarDays,
  Receipt, ImageIcon, BadgeCheck, Banknote, X, Bell, BellOff, AlertCircle, Trash2, MapPin,
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

const VIEWS: { id: View; label: string; query: string }[] = [
  { id: 'hoy', label: 'Hoy', query: '' },
  { id: 'mayor', label: 'Al Mayor', query: '?wholesale=true' },
  { id: 'historial', label: 'Historial 30d', query: '?days=30' },
];

export default function OrdersPanel({ role }: { role: StaffRole | null }) {
  const [view, setView] = useState<View>('hoy');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  // ── Alertas de pedidos nuevos ──
  // El sonido, el push al celular y el badge los maneja el provider global
  // <StaffAlerts/> (así funcionan también en el catálogo, no sólo aquí). Este
  // botón sólo conmuta el interruptor compartido.
  const [alertsOn, setAlertsOn] = useState<boolean>(() => {
    try { return localStorage.getItem('rl_admin_alerts') === '1'; } catch { return false; }
  });
  const [toast, setToast] = useState('');

  // Sincroniza el icono si el estado cambia desde el provider.
  useEffect(() => {
    const sync = () => {
      try { setAlertsOn(localStorage.getItem('rl_admin_alerts') === '1'); } catch { /* ignore */ }
    };
    window.addEventListener('rl-alerts-changed', sync);
    return () => window.removeEventListener('rl-alerts-changed', sync);
  }, []);

  const toggleAlerts = () => {
    // Delegar al provider: pide permiso, suscribe push y desbloquea el audio.
    window.dispatchEvent(new Event(alertsOn ? 'rl-disable-alerts' : 'rl-enable-alerts'));
  };

  // Auto-descartar el toast de error.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Cerrar el visor de comprobante con Escape.
  useEffect(() => {
    if (!zoomImg) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomImg(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomImg]);

  const load = useCallback(async (v: View, silent = false) => {
    if (!silent) setLoading(true);
    const q = VIEWS.find(x => x.id === v)!.query;
    try {
      const res = await fetch(`/api/admin/orders${q}`);
      if (res.ok) setOrders(await res.json());
      else if (!silent) setOrders([]);
    } catch { if (!silent) setOrders([]); } finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { load(view); }, [view, load]);

  // Auto-actualización cada 25s (sin spinner) para detectar pedidos nuevos.
  useEffect(() => {
    const t = setInterval(() => { load(view, true); }, 25000);
    return () => clearInterval(t);
  }, [view, load]);

  const updateStatus = async (id: string, status: string) => {
    // Confirmación antes de una acción destructiva.
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
      setOrders(prev); // revierte si falla
      setToast('No se pudo actualizar el pedido. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setBusyId(null);
    }
  };

  // Eliminar un pedido — SOLO admin (la ruta también lo exige en el servidor).
  const deleteOrder = async (id: string) => {
    if (!confirm('¿Eliminar este pedido de forma permanente? Esta acción no se puede deshacer.')) return;
    const prev = orders;
    setBusyId(id);
    setOrders(curr => curr.filter(o => o.id !== id));
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setOrders(prev); // revierte si falla
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

      {/* CTA para activar alertas (sirve como gesto que habilita audio + permiso de notificación) */}
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
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>Aparecerán aquí en cuanto lleguen.</p>
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
            // For pending orders the approval CTA already covers 'confirmado',
            // so drop it from the secondary buttons (computed once).
            const followUps = (NEXT_STEPS[order.status] ?? []).filter(s => !(isPending && s === 'confirmado'));

            return (
              <div key={order.id} className="card p-4">
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
                        <CalendarDays className="w-3 h-3" /> {order.scheduled_date} {order.scheduled_time ?? ''}
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

                {/* Status + actions */}
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  <span className="chip" style={{ background: meta.bg, color: meta.fg }}>
                    <StatusIcon className="w-3 h-3" /> {meta.label}
                  </span>
                </div>

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
        El cliente no adjuntó comprobante. Verifica el pago por WhatsApp antes de aprobar.
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
