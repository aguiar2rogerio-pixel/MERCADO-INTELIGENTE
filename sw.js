const CACHE_NAME = 'smart-shopping-v8';

// Recursos com caminhos relativos corretos para o GitHub Pages
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=7',
  './app.js?v=6',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  './offline.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] Erro ao salvar assets:', err))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia Cache-First: Abre rápido offline e não trava no timeout
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const respClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, respClone));
        }
        return networkResponse;
      });
    }).catch(() => {
      // Fallback relativo para subpastas do GitHub Pages
      if (e.request.mode === 'navigate') {
        return caches.match('./index.html').then((index) => index || caches.match('./offline.html'));
      }
    })
  );
});
