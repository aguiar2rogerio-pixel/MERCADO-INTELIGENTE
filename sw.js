const CACHE_NAME = 'smart-shopping-list-v7';
const ASSETS = [
  './',
  './index.html',
  './offline.html',
  './styles.css?v=7',
  './app.js?v=6',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png'
];

const NETWORK_TIMEOUT = 8000; // ms

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => {
        console.log('SW instalado e assets em cache');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('Erro no install do SW (assets não foram todos baixados):', err);
        // Falha na instalação: não chama skipWaiting. O SW antigo permanece ativo.
      })
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
    }).then(() => {
      console.log('SW ativado - caches antigos removidos');
      return self.clients.claim();
    })
  );
});

function fetchWithTimeout(request, timeout = NETWORK_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('network-timeout'));
    }, timeout);

    fetch(request).then(response => {
      clearTimeout(timer);
      resolve(response);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) {
    return;
  }

  // Prioriza tratar navegações (página) separadamente para garantir fallback index/offline
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetchWithTimeout(e.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const respClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, respClone));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match('/index.html').then(cached => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // Demais GETs: network-first com timeout, depois cache, por fim offline.html quando aplicável
  e.respondWith(
    fetchWithTimeout(e.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const respClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, respClone));
        }
        return networkResponse;
      })
      .catch(() =>
        caches.match(e.request).then(cached => cached || caches.match('/offline.html'))
      )
  );
});
