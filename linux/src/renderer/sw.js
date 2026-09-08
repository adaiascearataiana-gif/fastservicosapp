/* ==========================================================================
   FAST Serviços — sw.js "HEALER" (r133 / 2.3.19)
   Este Service Worker NÃO faz cache de NADA. Ele existe por UM motivo:
   substituir em todos os aparelhos o sw.js antigo (2.3.x) que servia página
   velha do cache e travava o app na versão antiga ("fica na 12").

   O que ele faz:
   1) INSTAL: apaga TODOS os caches antigos (fast-*) e assume o controle logo.
   2) ACTIVATE: apaga caches de novo, desregistra a si mesmo e recarrega as
      abas abertas para que a página venha 100% da rede (versão nova).
   3) FETCH: passagem direta à rede — nunca intercepta, nunca cacheia.
   ========================================================================== */
var FAST_HEAL_TAG = 'fast-healer-2.3.19';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    /* 1) apaga TODOS os caches conhecidos do app (de qualquer versão antiga) */
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) {
        if (/^(fast|cliente|motorista|app)[-_.]/i.test(k) || k.indexOf('fast') !== -1) {
          return caches.delete(k);
        }
        return Promise.resolve();
      }));
    } catch (err) { /* ignore */ }

    /* 2) assume todas as abas sem esperar reload */
    try { await self.clients.claim(); } catch (err) { /* ignore */ }

    /* 3) recarrega as abas abertas (bypass de qualquer página antiga no ar) */
    try {
      var cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      cs.forEach(function (c) {
        try { c.navigate(c.url.split('#')[0]); } catch (err) { /* ignore */ }
      });
    } catch (err) { /* ignore */ }

    /* 4) desregistra a si mesmo: nenhum SW controla o app daqui em diante */
    try {
      var regs = await self.registration.getRegistrations ? [] : [];
    } catch (err) { /* ignore */ }
    try { await self.registration.unregister(); } catch (err) { /* ignore */ }
  })());
});

/* fetch: passagem direta — nada de cache, nada de interceptação */
self.addEventListener('fetch', function (e) {
  /* intencionalmente vazio: o navegador fala direto com a rede */
});
