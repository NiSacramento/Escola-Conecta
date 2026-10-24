
const CACHE_NAME = 'escola-conecta-shell-v3';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './img/logo-escola-conecta.png',
  './img-gestos/A.png',
  './img-gestos/B.png',
  './img-gestos/I.png',
  './img-gestos/L.png',
  './img-gestos/N.png',
  './img-gestos/O.png',
  './img-gestos/P.png',
  './img-gestos/U.png',
  './ia-model/model.json',
  './ia-model/metadata.json',
  './ia-model/weights.bin'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Não armazenar respostas da API nem de outros domínios.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;

        return fetch(request)
          .then(response => {
            if (response && response.ok) {
              const copia = response.clone();

              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, copia));
            }

            return response;
          })
          .catch(() => {
            if (request.mode === 'navigate') {
              return caches.match('./index.html');
            }

            return Promise.reject(
              new Error('Recurso indisponível offline.')
            );
          });
      })
  );
});
