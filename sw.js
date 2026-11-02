/* Service Worker - Ministério de Música IBNM */
const CACHE = 'mmibnm-v37';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './hinos.js',
  './cantor.js',
  './academia.js',
  './melhorias.js',
  './culto.js',
  './escala.js',
  './membros.js',
  './cantadas.js',
  './temp-acervo.js',
  './avisos.js',
  './central.js',
  './telegram.js',
  './cifras.js',
  './vozes.js',
  './cores.js',
  './push.js',
  './tour.js',
  './sync.js',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE && k !== 'ibnm-fotos'; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Fotos de perfil do Supabase: guardadas no celular (não baixam de novo a cada abertura).
  if (/supabase\.co$/.test(url.hostname) && url.pathname.indexOf('/storage/v1/object/public/fotos/') >= 0) {
    e.respondWith(caches.open('ibnm-fotos').then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (r) { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; });
      });
    }));
    return;
  }
  // Supabase (dados) / CDNs externas: sempre a rede.
  if (url.origin !== location.origin) return;

  // Abrir o app: rede primeiro; sem internet, usa a cópia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (r) {
        const cp = r.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', cp); });
        return r;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  // Imagens das intros: não mudam, então cache primeiro.
  if (url.pathname.indexOf('/cc-intro/') >= 0) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (r) {
        if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); }
        return r;
      });
    }));
    return;
  }

  // Scripts e demais arquivos: responde na hora com o que tem guardado
  // e busca a versão nova em segundo plano (na próxima abertura já vem atualizado).
  e.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        const rede = fetch(req).then(function (r) {
          if (r && r.ok) c.put(req, r.clone());
          return r;
        }).catch(function () { return hit; });
        return hit || rede;
      });
    })
  );
});

/* ===== Notificações na barra do celular (Web Push) ===== */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'MM IBNM', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    // app aberto na tela: ele mesmo mostra o aviso (som/janela)
    if (cs.some(function (c) { return c.visibilityState === 'visible'; })) return;
    return self.registration.showNotification(d.title || 'Ministério de Música IBNM', {
      body: d.body || '', icon: 'icon-192.png', badge: 'favicon-32.png',
      tag: d.id ? 'ibnm-' + d.id : undefined, renotify: true, vibrate: [80, 40, 80],
      data: { link: d.link || '' }
    });
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var link = (e.notification.data && e.notification.data.link) || '';
  var url = './' + (link ? '?n=' + encodeURIComponent(link) : '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) { var c = cs[i]; if ('focus' in c) { c.postMessage({ tipo: 'abrir', link: link }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
