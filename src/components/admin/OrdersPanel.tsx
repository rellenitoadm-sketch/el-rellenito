'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  RefreshCw, Package, CheckCircle, Truck, XCircle, Clock, CalendarDays,
  Receipt, ImageIcon, BadgeCheck, Banknote, X,
} from 'lucide-react';

interface Order {
  id: string;
  customer_name: string;
  customer_whatsapp: string;
  delivery_zone: string | null;
  delivery_address: string | null;
  delivery_type?: string;
  items: { name: string; qty: number; price_usd: number }[];
  total_usd: number;
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

export default function OrdersPanel() {
  const [view, setView] = useState<View>('hoy');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  const load = useCallback(async (v: View) => {
    setLoading(true);
    const q = VIEWS.find(x => x.id === v)!.query;
    try {
      const res = await fetch(`/api/admin/orders${q}`);
      if (res.ok) setOrders(await res.json());
      else setOrders([]);
    } catch { setOrders([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(view); }, [view, load]);

  const updateStatus = async (id: string, status: string) => {
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
      setOrders(prev); // revert on failure
    } finally {
      setBusyId(null);
    }
  };

  const totalSum = orders.reduce((s, o) => s + (o.total_usd || 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pendiente').length;

  return (
    <div>
      {/* Sub-view switch */}
      <div className="flex gap-1.5 mb-4">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all"
            style={view === v.id
              ? { background: 'var(--brand-soft)', color: 'var(--brand-deep)', border: '1px solid var(--brand)' }
              : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            {v.label}
          </button>
        ))}
        <button onClick={() => load(view)} className="ml-auto btn btn-ghost" style={{ padding: '8px' }} aria-label="Actualizar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <KPI label="Pedidos" value={String(orders.length)} color="var(--text-1)" />
        <KPI label="Por verificar" value={String(pendingCount)} color="#B45309" />
        <KPI label="Total" value={`$${totalSum.toFixed(2)}`} color="var(--brand)" />
      </div>

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
                    {(addrText || mapsUrl) && (
                      <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-2)' }}>
                        {addrText && <span>{addrText} </span>}
                        {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: 'var(--brand)' }}>Ver ubicación</a>}
                      </p>
                    )}
                    {order.scheduled_date && (
                      <p className="text-[12px] mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--text-2)' }}>
                        <CalendarDays className="w-3 h-3" /> {order.scheduled_date} {order.scheduled_time ?? ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[16px] font-bold t-num" style={{ color: 'var(--text-1)' }}>${order.total_usd.toFixed(2)}</p>
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
                          className="text-[12px] px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
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
              </div>
            );
          })}
        </div>
      )}

      {/* Image lightbox */}
      {zoomImg && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setZoomImg(null)}
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
