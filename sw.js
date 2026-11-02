/* FAST Serviços — Service Worker neutro (raiz)
   Não guarda cópia de nada: tudo vem sempre da internet (o FAST usa o fast-sw.js).
   Este arquivo existe só para os aparelhos que ainda têm o "sw.js" antigo registrado:
   ele assume o lugar, apaga os caches que um envio errado criou (app de músicas) e
   não interfere em mais nada. */
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    try {
      var ks = await caches.keys();
      await Promise.all(ks.filter(function (k) { return /mmibnm/i.test(k); }).map(function (k) { return caches.delete(k); }));
    } catch (er) {}
    try { await self.clients.claim(); } catch (er) {}
  })());
});
