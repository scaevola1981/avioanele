// Service Worker pentru Jocul de Avioane 8x8 (PWA)
const CACHE_NAME = 'avioane-v14';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css?v=14',
  './game.js?v=14',
  './sound.js?v=14',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Caching partial assets:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Allow PeerJS and external CDN traffic to pass through network
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  // Pe localhost nu interceptăm deloc pentru a preveni cache vechi în timpul testării
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    return;
  }
  // Strategie Network-First cu fallback la cache (ideal pentru jocuri web PWA)
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});
