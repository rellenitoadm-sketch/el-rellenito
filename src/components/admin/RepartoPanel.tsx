'use client';

import { useEffect, useState } from 'react';
import { Navigation, Package, MapPin, RefreshCw, Truck, Bike } from 'lucide-react';
import RouteTracker, { type TrackerOrder } from './RouteTracker';

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
  const [orders, setOrders] = useState<DeliverableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<{ order: TrackerOrder | null } | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/admin/orders');
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

  useEffect(() => {
    if (tracking) return; // no recargar mientras se rastrea
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [tracking]);

  // Rastreo embebido: el domiciliario NO sale del panel.
  if (tracking) {
    return (
      <RouteTracker
        order={tracking.order}
        onExit={() => { setTracking(null); load(); }}
      />
    );
  }

  const porEntregar = orders.filter(o => o.status === 'confirmado');
  const enCamino = orders.filter(o => o.status === 'en_camino');

  return (
    <div className="pb-10">
      {/* Ruta libre */}
      <button
        onClick={() => setTracking({ order: null })}
        className="w-full mb-2 flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[15px] font-bold text-white"
        style={{ background: 'var(--brand)' }}
      >
        <Navigation className="w-5 h-5" /> Iniciar ruta de reparto
      </button>
      <p className="text-[12px] mb-6 px-1 leading-snug" style={{ color: 'var(--text-3)' }}>
        Abre el rastreo GPS aquí mismo, sin salir del panel. Mantén la pantalla abierta mientras repartes.
      </p>

      {/* En camino ahora */}
      {enCamino.length > 0 && (
        <>
          <h3 className="text-[12px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2" style={{ color: 'var(--brand-deep)' }}>
            <Truck className="w-3.5 h-3.5" /> En camino
          </h3>
          <div className="space-y-2 mb-6">
            {enCamino.map(o => (
              <button key={o.id} onClick={() => setTracking({ order: toTrackerOrder(o) })} className="w-full text-left card p-3.5 flex items-center gap-3">
                <Bike className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text-1)' }}>{o.customer_name}</p>
                  {(o.delivery_zone || addrText(o.delivery_address)) && (
                    <p className="text-[12px] truncate" style={{ color: 'var(--text-3)' }}>
                      {o.delivery_zone || addrText(o.delivery_address)}
                    </p>
                  )}
                </div>
                <span className="text-[11px] font-bold px-2 py-1 rounded flex-shrink-0" style={{ background: 'var(--info-soft)', color: '#1D4ED8' }}>Reanudar</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Por entregar */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[12px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
          <Package className="w-3.5 h-3.5" /> Pedidos por entregar
        </h3>
        <button onClick={load} className="btn btn-ghost" style={{ padding: '6px 8px', border: '1px solid var(--border)' }} aria-label="Recargar">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>
      ) : porEntregar.length === 0 ? (
        <div className="card p-4 text-[12.5px]" style={{ color: 'var(--text-2)' }}>
          No hay pedidos confirmados a domicilio por ahora. Cuando apruebes un pago a domicilio en <b>Pedidos</b>, aparecerá aquí para repartir.
        </div>
      ) : (
        <div className="space-y-2">
          {porEntregar.map(o => {
            const addr = addrText(o.delivery_address);
            return (
              <button key={o.id} onClick={() => setTracking({ order: toTrackerOrder(o) })} className="w-full text-left card p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand-soft)' }}>
                  <Navigation className="w-4 h-4" style={{ color: 'var(--brand-deep)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text-1)' }}>{o.customer_name}</p>
                  {(o.delivery_zone || addr) && (
                    <p className="text-[12px] inline-flex items-center gap-1 truncate" style={{ color: 'var(--text-3)' }}>
                      <MapPin className="w-3 h-3 flex-shrink-0" /> {o.delivery_zone || addr}
                    </p>
                  )}
                </div>
                <span className="text-[12px] font-bold px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{ background: 'var(--brand)', color: '#fff' }}>Entregar</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
