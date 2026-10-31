const CACHE_NAME = 'escola-conecta-shell-v4';

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
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith('escola-conecta-shell-') && key !== CACHE_NAME)
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

  // Nunca intercepta nem armazena respostas da API ou de outros domínios.
  if (url.origin !== self.location.origin) return;

  const caminho = url.pathname.toLowerCase();
  const rotasDinamicas = [
    '/login',
    '/cadastro',
    '/recuperar-senha',
    '/configuracoes',
    '/progresso',
    '/admin'
  ];

  if (rotasDinamicas.some(rota => caminho === rota || caminho.startsWith(rota + '/'))) {
    // Network-only: progresso, alunos e demais dados devem vir sempre do servidor.
    event.respondWith(fetch(new Request(request, { cache: 'no-store' })));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(new Request(request, { cache: 'no-store' }))
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first somente para arquivos estáticos conhecidos pelo tipo de recurso.
  const recursoEstatico =
    ['style', 'script', 'image', 'font'].includes(request.destination) ||
    /\.(css|js|png|jpe?g|svg|webp|ico|woff2?|json|bin)$/i.test(caminho);

  if (!recursoEstatico) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (response && response.ok) {
          const copia = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copia));
        }
        return response;
      });
    })
  );
});
