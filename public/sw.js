// Service worker de la PWA: instalable, offline básico y notificaciones push.
// No cachea de forma agresiva (evita servir assets viejos tras un deploy).
const CACHE = 'rellenito-shell-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first con fallback a caché sólo si falla la red (offline básico).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Guarda una copia del documento/asset para usar offline.
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || Response.error())),
  );
});

// ─── Notificaciones push (nuevos pedidos) ──────────────────────────────────
// Llega aunque la app esté CERRADA: el navegador despierta el SW y muestra la
// burbuja del sistema, fija el badge en el icono y avisa a las pestañas abiertas
// (para que suene el "ding" si el equipo está dentro de la app).
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }

  const title = data.title || '🛎️ Nuevo pedido — El Rellenito';
  const body = data.body || 'Tienes un nuevo pedido por verificar.';
  const tag = data.tag || 'nuevo-pedido';
  const url = data.url || '/admin/dashboard';
  const count = Number(data.count) || 1;

  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [120, 60, 120],
      data: { url },
    });

    // Badge numérico sobre el icono de la app (Android/desktop; iOS 16.4+ PWA).
    if ('setAppBadge' in self.navigator) {
      try { await self.navigator.setAppBadge(count); } catch { /* no soportado */ }
    }

    // Avisar a las pestañas abiertas para que reproduzcan el sonido.
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const c of clients) c.postMessage({ type: 'new-order', count, body });
  })());
});

// Tocar la notificación abre/enfoca el panel y limpia el badge.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin/dashboard';

  event.waitUntil((async () => {
    if ('clearAppBadge' in self.navigator) {
      try { await self.navigator.clearAppBadge(); } catch { /* ignore */ }
    }
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const c of clients) {
      if ('focus' in c) {
        try { await c.navigate(url); } catch { /* algunas plataformas no permiten navigate */ }
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
