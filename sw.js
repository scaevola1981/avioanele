// Service Worker pentru Jocul de Avioane 8x8 (PWA)
const CACHE_NAME = 'avioane-v22';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css?v=22',
  './game.js?v=22',
  './sound.js?v=22',
  './manifest.json',
  './public/icon-192.png',
  './public/icon-512.png',
  './public/apple-touch-icon.png',
  './public/favicon.png',
  './public/icon.png'
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

  // Pentru documentul principal (navigare/HTML), folosește ÎNTOTDEAUNA rețeaua proaspătă (no-cache)
  // pentru ca actualizările să apară instantaneu fără refresh manual!
  if (event.request.mode === 'navigate' || event.request.destination === 'document' || event.request.url.includes('index.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Pentru restul fișierelor: Network First cu no-cache și fallback la cache offline
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
