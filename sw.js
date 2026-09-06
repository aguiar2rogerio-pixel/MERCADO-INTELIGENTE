const CACHE_NAME = 'smart-shopping-v9';

// Arquivos exatamente como estão na raiz do seu repositório GitHub
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  './offline.html'
];

// Instalação tolerante a falhas (não quebra a instalação se 1 arquivo falhar)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Erro ao salvar asset individual:', asset, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Limpeza de caches antigos
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

// Estratégia de busca offline resiliente
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && e.request.url.startsWith(self.location.origin)) {
          const respClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, respClone));
        }
        return networkResponse;
      });
    }).catch(() => {
      // Se estiver offline em navegação de tela, entrega a aplicação principal
      if (e.request.mode === 'navigate') {
        return caches.match('./index.html').then((index) => index || caches.match('./offline.html'));
      }
    })
  );
});
