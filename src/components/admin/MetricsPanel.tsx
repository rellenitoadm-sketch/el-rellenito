'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, TrendingUp, Eye, ShoppingBag, DollarSign } from 'lucide-react';

interface Metrics {
  orders: {
    today: number; week: number; month: number;
    revenueToday: number; revenueWeek: number; revenueMonth: number;
    avgTicket: number;
  };
  visits: { total: number; today: number; byHour: number[] };
  ordersByHour: number[];
  topProducts: { name: string; qty: number }[];
  statusCount: Record<string, number>;
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', confirmado: 'Confirmado', en_camino: 'En camino',
  entregado: 'Entregado', cancelado: 'Cancelado',
};

export default function MetricsPanel() {
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/metrics');
      if (res.ok) setM(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>;
  if (!m) return <p className="text-center py-16 text-[13px]" style={{ color: 'var(--text-3)' }}>No se pudieron cargar las métricas.</p>;

  const peakOrders = Math.max(...m.ordersByHour, 1);
  const peakVisits = Math.max(...m.visits.byHour, 1);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <h2 className="t-h3" style={{ color: 'var(--text-1)' }}>Resumen</h2>
        <button onClick={load} className="btn btn-ghost" style={{ padding: '7px', minWidth: 44, minHeight: 44 }} aria-label="Actualizar"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Revenue cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <BigStat Icon={DollarSign} label="Ingresos hoy" value={`$${m.orders.revenueToday.toFixed(2)}`} accent />
        <BigStat Icon={ShoppingBag} label="Pedidos hoy" value={String(m.orders.today)} />
        <BigStat Icon={TrendingUp} label="Ingresos 30d" value={`$${m.orders.revenueMonth.toFixed(2)}`} />
        <BigStat Icon={DollarSign} label="Ticket promedio" value={`$${m.orders.avgTicket.toFixed(2)}`} />
      </div>

      {/* Visits */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Eye className="w-4 h-4" style={{ color: 'var(--brand)' }} />
          <p className="text-[13px] font-semibold" style={{ color: 'var(--text-1)' }}>Visitas a la página</p>
        </div>
        <div className="flex gap-5 mb-3">
          <div><p className="text-[22px] font-bold t-num" style={{ color: 'var(--text-1)' }}>{m.visits.today}</p><p className="text-[11px]" style={{ color: 'var(--text-3)' }}>hoy</p></div>
          <div><p className="text-[22px] font-bold t-num" style={{ color: 'var(--text-2)' }}>{m.visits.total}</p><p className="text-[11px]" style={{ color: 'var(--text-3)' }}>total (30d)</p></div>
        </div>
        <HourChart data={m.visits.byHour} peak={peakVisits} color="var(--brand)" />
      </div>

      {/* Peak hours (orders) */}
      <div className="card p-4">
        <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-1)' }}>Horas pico de pedidos</p>
        <p className="text-[11px] mb-3" style={{ color: 'var(--text-3)' }}>Últimos 30 días · hora de Venezuela</p>
        <HourChart data={m.ordersByHour} peak={peakOrders} color="#7C3AED" />
      </div>

      {/* Top products */}
      <div className="card p-4">
        <p className="text-[13px] font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Productos más vendidos (30d)</p>
        {m.topProducts.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Aún no hay datos suficientes.</p>
        ) : (
          <div className="space-y-2">
            {(() => { const max = m.topProducts[0].qty || 1; return m.topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="text-[12px] font-bold w-4" style={{ color: 'var(--text-3)' }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[12.5px] truncate" style={{ color: 'var(--text-2)' }}>{p.name}</span>
                      <span className="text-[12px] font-bold ml-2" style={{ color: 'var(--brand)' }}>{p.qty}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(p.qty / max) * 100}%`, background: 'var(--brand)' }} />
                    </div>
                  </div>
                </div>
            )); })()}
          </div>
        )}
      </div>

      {/* Status breakdown */}
      <div className="card p-4">
        <p className="text-[13px] font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Estados de pedidos (30d)</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(m.statusCount).length === 0
            ? <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Sin pedidos en el rango.</p>
            : Object.entries(m.statusCount).map(([s, n]) => (
              <div key={s} className="px-3 py-1.5 rounded-lg text-[12px]" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                {STATUS_LABELS[s] ?? s}: <strong>{n}</strong>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function BigStat({ Icon, label, value, accent }: { Icon: React.ElementType; label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-3.5" style={accent ? { background: 'var(--brand-soft)' } : undefined}>
      <Icon className="w-4 h-4 mb-1.5" style={{ color: accent ? 'var(--brand-deep)' : 'var(--text-3)' }} />
      <p className="text-[11px] font-medium" style={{ color: accent ? 'var(--brand-deep)' : 'var(--text-3)' }}>{label}</p>
      <p className="text-[20px] font-bold mt-0.5 t-num" style={{ color: accent ? 'var(--brand-deep)' : 'var(--text-1)' }}>{value}</p>
    </div>
  );
}

function HourChart({ data, peak, color }: { data: number[]; peak: number; color: string }) {
  const total = data.reduce((a, b) => a + b, 0);
  const peakHour = data.indexOf(Math.max(...data, 0));
  return (
    <div
      className="flex items-end gap-[2px] h-16"
      role="img"
      aria-label={total === 0
        ? 'Sin datos por hora todavía.'
        : `Distribución por hora (0–23 h). Hora pico: ${peakHour}:00 con ${data[peakHour]}. Total: ${total}.`}
    >
      {data.map((v, h) => (
        <div key={h} aria-hidden="true" className="flex-1 flex flex-col items-center justify-end h-full" title={`${h}:00 — ${v}`}>
          <div
            className="w-full rounded-t-sm transition-all"
            style={{ height: `${Math.max((v / peak) * 100, v > 0 ? 8 : 2)}%`, background: v > 0 ? color : 'var(--surface-2)', opacity: v > 0 ? 1 : 0.5 }}
          />
          {h % 6 === 0 && <span className="text-[8px] mt-0.5" style={{ color: 'var(--text-3)' }}>{h}</span>}
        </div>
      ))}
    </div>
  );
}
