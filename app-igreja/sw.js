/* Service Worker — app da Igreja Batista em Nova Metrópole
   Guarda o app no celular para abrir rápido e funcionar sem internet. */
var VERSAO = '1.1.0';   /* igual ao número em js/config.js e nos ?v= do index.html */
var CACHE = 'ibnm-app-' + VERSAO;
var V = '?v=' + VERSAO;
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css' + V,
  './vendor/qrcode.js' + V,
  './js/config.js' + V,
  './js/db.js' + V,
  './js/pix.js' + V,
  './js/ui.js' + V,
  './js/views.js' + V,
  './js/secoes.js' + V,
  './js/ebd.js' + V,
  './js/admin.js' + V,
  './js/topo.js' + V,
  './js/app.js' + V,
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo.png',
  './icons/logo-claro.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL).catch(function () {});
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then(function (chaves) {
      return Promise.all(chaves.filter(function (k) {
        return k.indexOf('ibnm-app-') === 0 && k !== CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (evento) {
  var req = evento.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* banco de dados, login, arquivos enviados e clima: sempre direto na rede */
  if (url.hostname.indexOf('supabase.co') >= 0 || url.pathname.indexOf('/auth/v1') >= 0 ||
      url.pathname.indexOf('/rest/v1') >= 0 || url.pathname.indexOf('/storage/v1') >= 0) return;
  /* tudo que vem de outro site (clima, capas de vídeo, fotos) o navegador resolve sozinho */
  if (url.origin !== location.origin) return;

  /* páginas: rede primeiro, cache se estiver sem internet */
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0) {
    evento.respondWith(
      fetch(req).then(function (resp) {
        var copia = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); });
        return resp;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  /* arquivos do app: cache primeiro */
  evento.respondWith(
    caches.match(req).then(function (cacheado) {
      if (cacheado) return cacheado;
      return fetch(req).then(function (resp) {
        if (resp && resp.status === 200 && url.origin === location.origin) {
          var copia = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copia); });
        }
        return resp;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
