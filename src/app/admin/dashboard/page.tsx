'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogOut, ShoppingBag, Boxes, BarChart3, Users } from 'lucide-react';
import OrdersPanel from '@/components/admin/OrdersPanel';
import ProductsPanel from '@/components/admin/ProductsPanel';
import MetricsPanel from '@/components/admin/MetricsPanel';
import CrmPanel from '@/components/admin/CrmPanel';
import type { StaffRole } from '@/lib/adminAuth';

type Tab = 'pedidos' | 'productos' | 'metricas' | 'crm';

interface TabDef {
  id: Tab;
  label: string;
  Icon: React.ElementType;
  adminOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: 'pedidos', label: 'Pedidos', Icon: ShoppingBag },
  { id: 'productos', label: 'Productos', Icon: Boxes },
  { id: 'metricas', label: 'Métricas', Icon: BarChart3, adminOnly: true },
  { id: 'crm', label: 'Clientes', Icon: Users, adminOnly: true },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [role, setRole] = useState<StaffRole | null>(null);
  const [tab, setTab] = useState<Tab>('pedidos');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch('/api/admin/me')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data: { role: StaffRole }) => { setRole(data.role); setReady(true); })
      .catch(() => router.replace('/'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/');
  };

  const tabs = TABS.filter(t => !t.adminOnly || role === 'admin');

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b backdrop-blur-md"
        style={{ background: 'rgba(255,255,255,0.9)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-11 h-11 rounded-full overflow-hidden shadow-sm" style={{ background: '#fff' }}>
            <Image src="/logo-circle.png" alt="" width={44} height={44} className="object-cover w-full h-full" />
          </div>
          <div>
            <h1 className="text-[14px] font-bold" style={{ color: 'var(--text-1)' }}>Panel El Rellenito</h1>
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              {role === 'admin' ? 'Administrador' : 'Equipo'}
            </p>
          </div>
        </div>
        <button onClick={logout} className="btn btn-ghost" style={{ padding: '8px', color: 'var(--text-2)' }} aria-label="Cerrar sesión">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="sticky top-[60px] z-20 px-3 py-2 border-b backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.9)', borderColor: 'var(--border)' }}>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none max-w-2xl mx-auto">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all"
              style={tab === id
                ? { background: 'var(--brand)', color: '#fff' }
                : { background: 'var(--surface-2)', color: 'var(--text-2)' }}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-5">
        {tab === 'pedidos' && <OrdersPanel />}
        {tab === 'productos' && <ProductsPanel />}
        {tab === 'metricas' && role === 'admin' && <MetricsPanel />}
        {tab === 'crm' && role === 'admin' && <CrmPanel />}
      </div>
    </div>
  );
}
