'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';
import RouteTracker, { type TrackerOrder } from '@/components/admin/RouteTracker';

/**
 * Pantalla de ruta del domiciliario (acceso directo / deep-link desde un pedido).
 * El flujo principal vive embebido en el panel de Reparto; esta página añade el
 * acceso por PIN para abrirla en el teléfono del domiciliario. El rastreo en sí
 * (mapa + GPS) lo hace el componente compartido RouteTracker.
 */
type Phase = 'checking' | 'login' | 'ready';

function parseDest(addr: string | null): { lat: number; lng: number } | null {
  if (!addr) return null;
  const m = addr.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
}
function cleanAddr(addr: string | null): string | null {
  if (!addr) return null;
  return addr.replace(/https?:\/\/\S+/, '').replace(/[·\s]+$/, '').trim() || null;
}

export default function DriverRoutePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('checking');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [order, setOrder] = useState<TrackerOrder | null>(null);

  // Verifica sesión de equipo en este teléfono.
  useEffect(() => {
    fetch('/api/admin/me')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(() => setPhase('ready'))
      .catch(() => setPhase('login'));
  }, []);

  // Carga el pedido si viene ?order=.
  useEffect(() => {
    if (phase !== 'ready') return;
    const op = new URLSearchParams(window.location.search).get('order');
    if (!op) return;
    let cancelled = false;
    fetch(`/api/admin/orders/${op}`)
      .then(r => (r.ok ? r.json() : null))
      .then((o: { customer_name?: string; delivery_address?: string | null } | null) => {
        if (cancelled || !o) return;
        setOrder({
          id: op,
          name: o.customer_name ?? 'Cliente',
          address: cleanAddr(o.delivery_address ?? null),
          dest: parseDest(o.delivery_address ?? null),
        });
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [phase]);

  const login = async () => {
    if (!pin.trim()) return;
    setLoggingIn(true);
    setPinError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      if (res.ok) { setPhase('ready'); setPin(''); }
      else {
        const e = await res.json().catch(() => ({})) as { error?: string };
        setPinError(e.error ?? 'Código incorrecto');
      }
    } catch { setPinError('Error de conexión'); } finally { setLoggingIn(false); }
  };

  if (phase === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--brand-orange)' }} />
      </div>
    );
  }

  if (phase === 'login') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg-main)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--brand-soft)' }}>
          <Lock className="w-6 h-6" style={{ color: 'var(--brand-deep)' }} />
        </div>
        <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Acceso domiciliario</h1>
        <p className="text-sm mb-5 text-center" style={{ color: 'var(--text-secondary)' }}>Ingresa el código del equipo para rastrear tu ruta.</p>
        <input
          type="password" inputMode="numeric" value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') login(); }}
          placeholder="Código" autoFocus
          className="field text-center text-lg tracking-widest mb-3" style={{ maxWidth: 220 }}
        />
        {pinError && <p className="text-xs mb-3" style={{ color: 'var(--destructive, #dc2626)' }}>{pinError}</p>}
        <button onClick={login} disabled={loggingIn || !pin.trim()} className="btn-gradient text-white font-bold px-8 py-3 rounded-2xl disabled:opacity-50">
          {loggingIn ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    );
  }

  // Listo: rastreador compartido (mismo flujo que el panel de Reparto).
  return (
    <div className="min-h-screen px-5 py-6" style={{ background: 'var(--bg-main)' }}>
      <div className="max-w-md mx-auto">
        <RouteTracker order={order} onExit={() => router.push('/admin/dashboard')} />
      </div>
    </div>
  );
}
