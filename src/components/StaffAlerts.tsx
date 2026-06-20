'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Orquestador GLOBAL de alertas para el equipo (admin/staff). Se monta en toda
 * la app (catálogo incluido), pero permanece inerte para los clientes: sólo se
 * activa si `/api/admin/me` confirma una sesión válida.
 *
 * Cuando está activo y las alertas encendidas:
 *  - Suscribe el dispositivo a Web Push → el celular recibe la burbuja de "nuevo
 *    pedido" aunque la app esté CERRADA (lo entrega el service worker).
 *  - Suena un "ding" ante un pedido nuevo en CUALQUIER pantalla (también si el
 *    equipo está sólo viendo el catálogo).
 *  - Pinta el badge numérico sobre el icono de la app.
 *
 * Encender/apagar se dispara con los eventos `rl-enable-alerts` / `rl-disable-alerts`
 * (el botón de campana del panel admin). El estado vive en localStorage.
 */

const FLAG = 'rl_admin_alerts';
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function alertsOn(): boolean {
  try { return localStorage.getItem(FLAG) === '1'; } catch { return false; }
}

interface LiteOrder { id: string; status: string; customer_name: string; total_usd: number }

export default function StaffAlerts() {
  const pathname = usePathname();
  const authedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  // ── Sonido (doble "ding" generado por código, sin archivo) ──
  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      try {
        const AC = window.AudioContext
          || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioRef.current = new AC();
      } catch { /* sin audio */ }
    }
    audioRef.current?.resume().catch(() => {});
  }, []);

  const beep = useCallback(() => {
    ensureAudio();
    const ctx = audioRef.current;
    if (!ctx) return;
    [0, 0.18].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 880 : 1175;
      osc.connect(gain); gain.connect(ctx.destination);
      const start = ctx.currentTime + t;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
      osc.start(start); osc.stop(start + 0.16);
    });
  }, [ensureAudio]);

  const setBadge = useCallback((n: number) => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    try {
      if (n > 0) nav.setAppBadge?.(n);
      else nav.clearAppBadge?.();
    } catch { /* no soportado */ }
  }, []);

  // ── Suscripción Web Push (sólo si hay permiso de notificación) ──
  const subscribePush = useCallback(async () => {
    if (!VAPID_PUBLIC || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
        });
      }
      await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
    } catch { /* push opcional; el sonido en-app igual funciona */ }
  }, []);

  // ── Encender / apagar (desde el botón de campana, gesto del usuario) ──
  const enable = useCallback(async () => {
    ensureAudio(); // desbloquea el audio dentro del gesto
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch { /* ignore */ }
    try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
    await subscribePush();
    beep(); // confirma que el sonido funciona
    window.dispatchEvent(new Event('rl-alerts-changed'));
  }, [ensureAudio, beep, subscribePush]);

  const disable = useCallback(async () => {
    try { localStorage.setItem(FLAG, '0'); } catch { /* ignore */ }
    setBadge(0);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/admin/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
    } catch { /* ignore */ }
    window.dispatchEvent(new Event('rl-alerts-changed'));
  }, [setBadge]);

  // ── Sondeo de pedidos nuevos (cubre el caso "app abierta") ──
  const poll = useCallback(async () => {
    if (!authedRef.current || !alertsOn()) return;
    try {
      const res = await fetch('/api/admin/orders');
      if (!res.ok) return;
      const orders = await res.json() as LiteOrder[];
      const pending = orders.filter(o => o.status === 'pendiente');
      if (seeded.current) {
        const fresh = pending.filter(o => !knownIds.current.has(o.id));
        if (fresh.length > 0) {
          beep();
          setBadge(pending.length);
          // Fallback en primer plano si la pestaña está oculta (por si el push tardó).
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted'
              && document.visibilityState !== 'visible') {
            const o = fresh[0];
            try {
              new Notification('🛎️ Nuevo pedido — El Rellenito', {
                body: `${o.customer_name} · $${o.total_usd.toFixed(2)}`,
                icon: '/icon-192.png', tag: `order-${o.id}`,
              });
            } catch { /* ignore */ }
          }
        }
      }
      orders.forEach(o => knownIds.current.add(o.id));
      seeded.current = true;
    } catch { /* ignore */ }
  }, [beep, setBadge]);

  // ── Activación: sólo si hay sesión de equipo ──
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    const cleanups: Array<() => void> = [];

    // Punto único de registro del service worker (app-wide). Lo necesitan tanto
    // el push de pedidos como la instalación de la PWA (PwaInstall solo observa).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    (async () => {
      try {
        const res = await fetch('/api/admin/me');
        if (!res.ok || cancelled) return; // cliente → queda inerte
        authedRef.current = true;

        if (alertsOn()) subscribePush();

        // Desbloquear audio en el primer gesto de ESTA carga de página.
        const unlock = () => ensureAudio();
        window.addEventListener('pointerdown', unlock, { once: true });
        cleanups.push(() => window.removeEventListener('pointerdown', unlock));

        // Mensajes del SW (push recibido con la app abierta) → sonar.
        const onMsg = (e: MessageEvent) => {
          if (e.data?.type === 'new-order' && alertsOn()) {
            beep();
            setBadge(Number(e.data.count) || 1);
          }
        };
        navigator.serviceWorker?.addEventListener('message', onMsg);
        cleanups.push(() => navigator.serviceWorker?.removeEventListener('message', onMsg));

        poll();
        interval = setInterval(poll, 20000);
      } catch { /* sin red → inerte */ }
    })();

    const onEnable = () => { void enable(); };
    const onDisable = () => { void disable(); };
    window.addEventListener('rl-enable-alerts', onEnable);
    window.addEventListener('rl-disable-alerts', onDisable);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      cleanups.forEach(fn => fn());
      window.removeEventListener('rl-enable-alerts', onEnable);
      window.removeEventListener('rl-disable-alerts', onDisable);
    };
  }, [poll, enable, disable, subscribePush, ensureAudio, beep, setBadge]);

  // Al entrar al panel, el equipo "ve" los pedidos → limpiar el badge.
  useEffect(() => {
    if (authedRef.current && pathname?.startsWith('/admin')) setBadge(0);
  }, [pathname, setBadge]);

  return null;
}
