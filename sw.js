const CACHE_NAME = 'shopping-list-v6';
const ASSETS = [
  'https://aguiar2rogerio-pixel.github.io/MERCADO-INTELIGENTE/',
  'https://aguiar2rogerio-pixel.github.io/MERCADO-INTELIGENTE/index.html',
  'https://aguiar2rogerio-pixel.github.io/MERCADO-INTELIGENTE/manifest.json',
  'https://aguiar2rogerio-pixel.github.io/MERCADO-INTELIGENTE/icon-192x192.png',
  'https://aguiar2rogerio-pixel.github.io/MERCADO-INTELIGENTE/icon-512x512.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)
        ))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(response => response || fetch(e.request))
    );
});
