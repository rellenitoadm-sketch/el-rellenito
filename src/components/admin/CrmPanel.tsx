'use client';

import { useEffect, useState, useMemo } from 'react';
import { RefreshCw, Search, Users, MessageCircle, Crown } from 'lucide-react';

interface CustomerRow {
  whatsapp: string;
  name: string;
  order_count: number;
  total_spent_usd: number;
  last_order_at: string;
  last_zone: string | null;
}

export default function CrmPanel() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/customers');
      if (res.ok) setRows(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q) || r.whatsapp.includes(q));
  }, [rows, search]);

  const totalRevenue = rows.reduce((s, r) => s + r.total_spent_usd, 0);

  return (
    <div className="pb-10">
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="card p-3.5">
          <Users className="w-4 h-4 mb-1.5" style={{ color: 'var(--text-3)' }} />
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Clientes</p>
          <p className="text-[20px] font-bold mt-0.5 t-num" style={{ color: 'var(--text-1)' }}>{rows.length}</p>
        </div>
        <div className="card p-3.5" style={{ background: 'var(--brand-soft)' }}>
          <Crown className="w-4 h-4 mb-1.5" style={{ color: 'var(--brand-deep)' }} />
          <p className="text-[11px]" style={{ color: 'var(--brand-deep)' }}>Valor total</p>
          <p className="text-[20px] font-bold mt-0.5 t-num" style={{ color: 'var(--brand-deep)' }}>${totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente o teléfono…" className="field" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <button onClick={load} className="btn btn-ghost" style={{ padding: '10px', border: '1px solid var(--border)' }} aria-label="Recargar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-14 px-6">
          <Users className="w-9 h-9 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>Sin clientes todavía</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>Se registran automáticamente con cada pedido.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c, i) => (
            <div key={c.whatsapp} className="card p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold"
                style={{ background: i === 0 ? 'var(--brand)' : 'var(--surface-2)', color: i === 0 ? '#fff' : 'var(--text-2)' }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text-1)' }}>{c.name}</p>
                  {i === 0 && <Crown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />}
                </div>
                <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{c.whatsapp}{c.last_zone ? ` · ${c.last_zone}` : ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[13px] font-bold t-num" style={{ color: 'var(--brand)' }}>${c.total_spent_usd.toFixed(2)}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{c.order_count} {c.order_count === 1 ? 'pedido' : 'pedidos'}</p>
              </div>
              <a
                href={`https://wa.me/${c.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(37,211,102,0.12)', color: '#1faa52' }}
                aria-label="WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
