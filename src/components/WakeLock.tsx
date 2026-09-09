'use client';

import { useEffect, useRef } from 'react';

type WakeLockSentinel = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
};

/** Mantiene la pantalla encendida en toda la app (repartidores no deben perder la ruta). */
export default function WakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;

    let cancelled = false;
    const request = async () => {
      try {
        const lock = await nav.wakeLock!.request('screen');
        if (cancelled) { lock.release().catch(() => {}); return; }
        lockRef.current = lock;
      } catch { /* no crítico: permiso denegado, batería baja, etc. */ }
    };

    request();
    const onVis = () => { if (document.visibilityState === 'visible') request(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, []);

  return null;
}
