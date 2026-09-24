/* FAST Serviços — Service Worker de atualização estável.
   Não mantém cache do HTML e não força reload/navegação no activate.
   Isso evita o loop em que o app atualiza, o SW recarrega a página e a
   página volta a registrar/ativar o SW novamente. */
var FAST_SW_VERSION = 'fast-stable-4.0.18';

self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (key) {
        return /^(fast|cliente|motorista|app)[-_.]/i.test(key) || key.indexOf('fast') !== -1
          ? caches.delete(key)
          : Promise.resolve();
      }));
    } catch (error) {
      // A limpeza é apenas uma otimização; não impede o app de abrir.
    }
    try { await self.clients.claim(); } catch (error) {}
  })());
});

// Rede direta: o HTML e updates.json sempre vêm com cache-busting próprio.
self.addEventListener('fetch', function () {});
