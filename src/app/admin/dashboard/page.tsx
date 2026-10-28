'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogOut, ShoppingBag, Boxes, BarChart3, Store, Truck, Bike, ClipboardList, Receipt } from 'lucide-react';
import OrdersPanel from '@/components/admin/OrdersPanel';
import ProductsPanel from '@/components/admin/ProductsPanel';
import MetricsPanel from '@/components/admin/MetricsPanel';
import WholesaleClientsPanel from '@/components/admin/WholesaleClientsPanel';
import RoutesPanel from '@/components/admin/RoutesPanel';
import RepartoPanel from '@/components/admin/RepartoPanel';
import WholesaleOrdersPanel from '@/components/admin/WholesaleOrdersPanel';
import VentasPanel from '@/components/admin/VentasPanel';
import { useOnboarding } from '@/components/Onboarding';
import type { StaffRole } from '@/lib/adminAuth';

type Tab = 'pedidos' | 'productos' | 'reparto' | 'pedidosMayoristas' | 'ventas' | 'metricas' | 'mayoristas' | 'rutas';

interface TabDef {
  id: Tab;
  label: string;
  Icon: React.ElementType;
  adminOnly?: boolean;
  /** Solo el equipo (no el administrador): el reparto lo hacen los domiciliarios;
      el admin lo monitorea desde "Rutas". */
  staffOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: 'pedidos', label: 'Pedidos', Icon: ShoppingBag },
  { id: 'productos', label: 'Productos', Icon: Boxes },
  { id: 'reparto', label: 'Reparto', Icon: Bike, staffOnly: true },
  { id: 'pedidosMayoristas', label: 'Pedidos al mayor', Icon: ClipboardList },
  { id: 'ventas', label: 'Ventas', Icon: Receipt },
  { id: 'metricas', label: 'Métricas', Icon: BarChart3, adminOnly: true },
  { id: 'mayoristas', label: 'Clientes mayor', Icon: Store, adminOnly: true },
  { id: 'rutas', label: 'Rutas', Icon: Truck, adminOnly: true },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [role, setRole] = useState<StaffRole | null>(null);
  const [tab, setTab] = useState<Tab>('pedidos');
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState(false);
  const { maybeStart } = useOnboarding();

  // Verifica la sesión con reintentos. SOLO expulsa a Home si el servidor dice
  // 401/403 (no autorizado). Un fallo de RED (móvil con señal lenta) reintenta
  // en vez de mandar al usuario a Home a mitad de trabajo — este era el origen
  // del "se sale solo / me manda al inicio".
  const checkAuth = useCallback(async () => {
    setAuthError(false);
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch('/api/admin/me', { cache: 'no-store' });
        if (res.status === 401 || res.status === 403) { router.replace('/'); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { role: StaffRole };
        setRole(data.role);
        setReady(true);
        return;
      } catch {
        // Backoff creciente antes de reintentar (0.6s, 1.2s, 1.8s).
        if (attempt < 3) await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    setAuthError(true); // Agotados los reintentos: mostrar "reintentar", NO expulsar.
  }, [router]);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  // Tutorial general del panel la primera vez que entra (distinto admin/equipo:
  // el de admin presenta las 4 secciones, el de equipo solo Pedidos/Productos).
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => maybeStart(role === 'admin' ? 'admin' : 'adminStaff'), 700);
    return () => clearTimeout(t);
  }, [ready, role, maybeStart]);

  // Tutorial DETALLADO al abrir cada sección por primera vez. (Pedidos ya va
  // incluido en el tutorial general, que parte en esa pestaña.)
  useEffect(() => {
    if (!ready) return;
    // El tour de Productos se guarda con clave por rol (scope), para que el equipo
    // lo vea aunque el administrador ya haya visto el suyo en este mismo dispositivo.
    const which = tab === 'productos' ? 'adminInventario'
      : tab === 'reparto' ? 'adminReparto'
      : tab === 'metricas' ? 'adminMetricas'
      : tab === 'mayoristas' ? 'adminMayoristas'
      : tab === 'rutas' ? 'adminRutas'
      : null;
    if (!which) return;
    const scope = which === 'adminInventario' ? (role ?? undefined) : undefined;
    const t = setTimeout(() => maybeStart(which, scope), 650);
    return () => clearTimeout(t);
  }, [tab, ready, role, maybeStart]);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/');
  };

  const tabs = TABS.filter(t => (!t.adminOnly || role === 'admin') && (!t.staffOnly || role !== 'admin'));

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: 'var(--bg)' }}>
        {authError ? (
          <>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>No pudimos cargar el panel</p>
            <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Revisa tu conexión. Tu sesión sigue activa.</p>
            <button onClick={checkAuth} className="btn-gradient text-white font-bold px-5 py-2.5 rounded-xl">Reintentar</button>
          </>
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
        )}
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
        <div className="flex items-center gap-2.5" data-tour="admin-title">
          <div className="w-11 h-11 rounded-full overflow-hidden shadow-sm" style={{ background: '#fff' }}>
            <Image src="/logo-circle.png" alt="" width={44} height={44} className="object-cover w-full h-full" />
          </div>
          <div>
            <h1 className="text-[16px] font-extrabold" style={{ color: 'var(--text-1)' }}>Panel El Rellenito</h1>
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              {role === 'admin' ? 'Administrador' : 'Equipo'}
            </p>
          </div>
        </div>
        <button onClick={logout} data-tour="admin-logout" className="btn btn-ghost" style={{ padding: '8px', color: 'var(--text-2)' }} aria-label="Cerrar sesión">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Menú: todos los botones a la vista, grandes y con icono */}
      <nav aria-label="Secciones del panel" className="px-3 pt-4 pb-1 max-w-2xl mx-auto">
        <div data-tour="admin-tabs" className="grid grid-cols-4 gap-2">
          {tabs.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-center transition-all active:scale-95"
                style={{ minHeight: 84, ...(active
                  ? { background: '#1A1A1A', color: '#fff', boxShadow: '0 4px 14px rgba(0,0,0,0.22)' }
                  : { background: 'var(--surface)', color: 'var(--text-1)', border: '1px solid var(--border)' }) }}
              >
                <Icon className="w-7 h-7" strokeWidth={active ? 2.4 : 2} style={active ? undefined : { color: 'var(--brand)' }} aria-hidden />
                <span className="text-[12.5px] font-bold leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-8" data-tour="admin-content">
        <h2 className="text-[22px] font-extrabold mb-4" style={{ color: 'var(--text-1)' }}>{tabs.find(t => t.id === tab)?.label}</h2>
        {tab === 'pedidos' && <OrdersPanel role={role} />}
        {tab === 'productos' && <ProductsPanel />}
        {tab === 'reparto' && role !== 'admin' && <RepartoPanel />}
        {tab === 'pedidosMayoristas' && <WholesaleOrdersPanel isAdmin={role === 'admin'} />}
        {tab === 'ventas' && <VentasPanel isAdmin={role === 'admin'} />}
        {tab === 'metricas' && role === 'admin' && <MetricsPanel />}
        {tab === 'mayoristas' && role === 'admin' && <WholesaleClientsPanel />}
        {tab === 'rutas' && role === 'admin' && <RoutesPanel />}
      </div>
    </div>
  );
}
