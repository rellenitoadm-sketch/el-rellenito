'use client';

import { useEffect, useState } from 'react';
import { Navigation, Package, MapPin, RefreshCw, Truck, Phone, MessageCircle, Map as MapIcon } from 'lucide-react';
import RouteTracker from './RouteTracker';
import RouteHistory from './RouteHistory';
import { normalizeWhatsAppNumber } from '@/lib/whatsapp';
import { useRouteTracking, type TrackerOrder } from '../RouteTracking';

/**
 * Panel de Reparto (equipo y admin). Aquí el domiciliario INICIA y RASTREA sus
 * rutas SIN salir de la app: el rastreador (con mapa) se monta dentro del propio
 * panel. El panel admin "Rutas" es solo monitoreo.
 */
interface DeliverableOrder {
  id: string;
  customer_name: string;
  delivery_zone: string | null;
  delivery_address: string | null;
  delivery_type?: string;
  status: string;
  customer_whatsapp?: string | null;
  items?: { name: string; qty: number }[];
  total_usd?: number;
}

function addrText(addr: string | null): string {
  if (!addr) return '';
  return addr.replace(/https?:\/\/\S+/, '').replace(/[·\s]+$/, '').trim();
}
function parseDest(addr: string | null): { lat: number; lng: number } | null {
  if (!addr) return null;
  const m = addr.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
}
function toTrackerOrder(o: DeliverableOrder): TrackerOrder {
  return { id: o.id, name: o.customer_name, address: addrText(o.delivery_address) || null, dest: parseDest(o.delivery_address) };
}

export default function RepartoPanel() {
  const { tracking: routeLive, hasRoute } = useRouteTracking();
  const [orders, setOrders] = useState<DeliverableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<{ order: TrackerOrder | null } | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/admin/orders?days=7');
      if (res.ok) {
        const data = await res.json() as DeliverableOrder[];
        setOrders(
          (Array.isArray(data) ? data : []).filter(
            o => (o.status === 'confirmado' || o.status === 'en_camino') && o.delivery_type !== 'retiro',
          ),
        );
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  // Rastreo corriendo: abre el mapa directo. Si el domiciliario lo detuvo, no
  // se le reabre solo: queda el botón para retomar.
  useEffect(() => {
    if (routeLive) setTracking({ order: null });
  }, [routeLive]);

  useEffect(() => {
    if (tracking) return; // no recargar mientras se rastrea
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [tracking]);

  const exitTracking = () => {
    setTracking(null);
    load();
  };

  // Rastreo embebido: el domiciliario NO sale del panel.
  if (tracking) {
    return <RouteTracker order={tracking.order} onExit={exitTracking} />;
  }

  const porEntregar = orders.filter(o => o.status === 'confirmado');
  const enCamino = orders.filter(o => o.status === 'en_camino');

  return (
    <div className="pb-10">
      {/* Ruta activa pausada: retomar donde se dejó */}
      {hasRoute && !routeLive && (
        <button
          onClick={() => setTracking({ order: null })}
          className="w-full mb-3 flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[14px] font-bold"
          style={{ background: 'var(--info-soft)', color: '#1D4ED8', border: '1px solid #93c5fd' }}
        >
          <Navigation className="w-4.5 h-4.5" /> Reanudar tu ruta activa
        </button>
      )}

      {/* Ruta libre */}
      <button
        data-tour="reparto-start"
        onClick={() => setTracking({ order: null })}
        className="w-full mb-2 flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[15px] font-bold text-white"
        style={{ background: 'var(--brand)' }}
      >
        <Navigation className="w-5 h-5" /> Iniciar ruta de reparto
      </button>
      <p className="text-[12px] mb-6 px-1 leading-snug" style={{ color: 'var(--text-3)' }}>
        Abre el rastreo GPS aquí mismo, sin salir del panel. Mantén la pantalla abierta mientras repartes.
      </p>

      {/* Resumen del día */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl p-4" style={{ background: '#1A1A1A', color: '#fff' }}>
          <Package className="w-5 h-5 mb-1" aria-hidden />
          <p className="text-[28px] font-extrabold t-num leading-none">{porEntregar.length}</p>
          <p className="text-[12px] mt-1" style={{ opacity: 0.75 }}>por entregar</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--info-soft)', color: '#1D4ED8' }}>
          <Truck className="w-5 h-5 mb-1" aria-hidden />
          <p className="text-[28px] font-extrabold t-num leading-none">{enCamino.length}</p>
          <p className="text-[12px] mt-1">en camino</p>
        </div>
      </div>

      {/* Por entregar */}
      <div data-tour="reparto-pending" className="flex items-center justify-between mb-2">
        <h3 className="text-[12px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
          <Package className="w-3.5 h-3.5" /> Pedidos por entregar
        </h3>
        <button onClick={load} className="btn btn-ghost" style={{ padding: '6px 8px', border: '1px solid var(--border)' }} aria-label="Recargar">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>
      ) : orders.length === 0 ? (
        <div className="card p-4 text-[13px]" style={{ color: 'var(--text-2)' }}>
          No hay pedidos confirmados a domicilio por ahora. Cuando apruebes un pago a domicilio en <b>Pedidos</b>, aparecerá aquí para repartir.
        </div>
      ) : (
        <div className="space-y-3">
          {[...enCamino, ...porEntregar].map(o => (
            <OrderCard key={o.id} o={o} onGo={() => setTracking({ order: toTrackerOrder(o) })} />
          ))}
        </div>
      )}

      <div className="mt-8">
        <RouteHistory days={7} title="Mis recorridos (7 días)" />
      </div>
    </div>
  );
}

/** Tarjeta de un pedido a domicilio: lo que el domiciliario necesita sin abrir otra pantalla. */
function OrderCard({ o, onGo }: { o: DeliverableOrder; onGo: () => void }) {
  const addr = addrText(o.delivery_address);
  const dest = parseDest(o.delivery_address);
  const phone = normalizeWhatsAppNumber(o.customer_whatsapp ?? '');
  const enCamino = o.status === 'en_camino';
  const units = (o.items ?? []).reduce((s, i) => s + i.qty, 0);
  const mapsHref = dest
    ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`
    : addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}` : null;
  const tile = 'flex-1 flex items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold';

  return (
    <div className="card p-4" style={enCamino ? { borderColor: '#93c5fd' } : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[16px] font-extrabold truncate" style={{ color: 'var(--text-1)' }}>{o.customer_name}</p>
          {(o.delivery_zone || addr) && (
            <p className="text-[13px] mt-0.5 inline-flex items-start gap-1" style={{ color: 'var(--text-2)' }}>
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden /> <span>{[o.delivery_zone, addr].filter(Boolean).join(' · ')}</span>
            </p>
          )}
        </div>
        {enCamino && <span className="text-[11px] font-bold px-2 py-1 rounded flex-shrink-0" style={{ background: 'var(--info-soft)', color: '#1D4ED8' }}>EN CAMINO</span>}
      </div>

      {(units > 0 || o.total_usd != null) && (
        <p className="text-[12.5px] mt-2" style={{ color: 'var(--text-3)' }}>
          {units > 0 ? `${units} uds` : ''}{units > 0 && o.total_usd != null ? ' · ' : ''}{o.total_usd != null ? `$${o.total_usd.toFixed(2)}` : ''}
        </p>
      )}

      <div className="flex gap-2 mt-3">
        {phone && (
          <>
            <a href={`tel:+${phone}`} className={tile} style={{ minHeight: 48, background: 'var(--surface-2)', color: 'var(--text-1)' }} aria-label={`Llamar a ${o.customer_name}`}>
              <Phone className="w-4 h-4" aria-hidden /> Llamar
            </a>
            <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" className={tile} style={{ minHeight: 48, background: 'rgba(37,211,102,0.14)', color: '#15803D' }} aria-label={`WhatsApp a ${o.customer_name}`}>
              <MessageCircle className="w-4 h-4" aria-hidden /> WhatsApp
            </a>
          </>
        )}
        {mapsHref && (
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={tile} style={{ minHeight: 48, background: 'var(--info-soft)', color: '#1D4ED8' }} aria-label="Cómo llegar en Google Maps">
            <MapIcon className="w-4 h-4" aria-hidden /> Cómo llegar
          </a>
        )}
      </div>

      <button onClick={onGo} className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl text-[15px] font-bold" style={{ minHeight: 52, background: enCamino ? 'var(--info-soft)' : 'var(--brand)', color: enCamino ? '#1D4ED8' : '#fff' }}>
        <Navigation className="w-5 h-5" aria-hidden /> {enCamino ? 'Reanudar entrega' : 'Entregar'}
      </button>
    </div>
  );
}
