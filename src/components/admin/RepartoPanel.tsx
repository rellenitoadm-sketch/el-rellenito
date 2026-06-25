'use client';

import { useEffect, useState } from 'react';
import { Navigation, Package, MapPin, RefreshCw, Truck, Bike } from 'lucide-react';

/**
 * Panel de Reparto (equipo y admin). Aquí el domiciliario INICIA sus rutas:
 * una ruta libre o la entrega de un pedido concreto. El panel admin "Rutas" es
 * solo monitoreo; el registro/arranque de rutas vive aquí, en el flujo del equipo.
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

export default function RepartoPanel() {
  const [orders, setOrders] = useState<DeliverableOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch('/api/admin/orders');
      if (res.ok) {
        const data = await res.json() as DeliverableOrder[];
        // Pedidos a domicilio listos para repartir: confirmados o ya en camino,
        // que no sean retiro en local.
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
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const porEntregar = orders.filter(o => o.status === 'confirmado');
  const enCamino = orders.filter(o => o.status === 'en_camino');

  return (
    <div className="pb-10">
      {/* Ruta libre */}
      <a
        href="/ruta"
        className="w-full mb-2 flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[15px] font-bold text-white"
        style={{ background: 'var(--brand)' }}
      >
        <Navigation className="w-5 h-5" /> Iniciar ruta de reparto
      </a>
      <p className="text-[12px] mb-6 px-1 leading-snug" style={{ color: 'var(--text-3)' }}>
        Abre el rastreo GPS de tu recorrido. Elige tu nombre y mantén la pantalla abierta mientras repartes.
      </p>

      {/* En camino ahora */}
      {enCamino.length > 0 && (
        <>
          <h3 className="text-[12px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2" style={{ color: 'var(--brand-deep)' }}>
            <Truck className="w-3.5 h-3.5" /> En camino
          </h3>
          <div className="space-y-2 mb-6">
            {enCamino.map(o => (
              <a key={o.id} href={`/ruta?order=${o.id}`} className="card p-3.5 flex items-center gap-3">
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
              </a>
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
              <a key={o.id} href={`/ruta?order=${o.id}`} className="card p-3.5 flex items-center gap-3">
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
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
