const CACHE_NAME = 'smart-shopping-v2'; // Mudamos para v2 para forçar a limpeza do cache antigo
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Instala o Service Worker e guarda os arquivos novos no cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting()) // Força o SW novo a se tornar ativo imediatamente
  );
});

// Limpa os caches antigos (deleta a "versão velha" do aplicativo)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // Assume o controle da página na hora
  );
});

// Responde com o cache, mas busca na rede se houver internet
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
