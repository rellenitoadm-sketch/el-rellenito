// Service worker mínimo para que la PWA sea instalable.
// No cachea de forma agresiva (evita servir assets viejos tras un deploy).
const CACHE = 'rellenito-shell-v1';

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
