/*
  FAST Serviços — Service Worker (v4.0.15)
  ============================================================
  Reescrito em 19/09/2026 para resolver o app ficando "preso"
  numa versão antiga mesmo depois de um novo deploy.

  Estratégia:
  - Páginas HTML (navegação): SEMPRE busca da rede primeiro.
    Só usa o que está guardado se estiver sem internet. Isso
    impede que uma versão antiga fique "grudada" no aparelho.
  - Arquivos estáticos (CSS/JS/imagens/ícones): busca da rede
    e guarda uma cópia; se a rede falhar, usa a cópia guardada.
    Assim o app funciona offline sem travar em versões velhas.
  - self.skipWaiting() + clients.claim(): a nova versão assume
    o controle IMEDIATAMENTE, sem precisar fechar todas as abas
    e sem precisar de um segundo carregamento.
  - Cada versão publicada usa um nome de cache diferente
    (CACHE_NAME abaixo); ao ativar, todo cache de versões
    antigas é apagado automaticamente.
  ============================================================
*/

const SW_VERSION = '4.0.15';
const CACHE_NAME = 'fast-servicos-' + SW_VERSION;

self.addEventListener('install', (event) => {
  // Assume o controle assim que possível, sem esperar as abas antigas fecharem.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Apaga qualquer cache de versão anterior.
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((nome) => nome.startsWith('fast-servicos-') && nome !== CACHE_NAME)
          .map((nome) => caches.delete(nome))
      );
      // Assume o controle de todas as abas abertas agora mesmo.
      await self.clients.claim();
    })()
  );
});

// Permite que o próprio app peça pra essa versão assumir na hora
// (usado pelo fluxo de "Atualizar agora" dentro do app).
self.addEventListener('message', (event) => {
  if (event && event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // não mexe em pedidos para outros domínios (ex.: Supabase)

  // Navegação de página (abrir o app, trocar de rota, recarregar) —
  // rede primeiro, cache só como reserva se estiver offline.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      (async () => {
        try {
          const resposta = await fetch(req, { cache: 'no-store' });
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, resposta.clone());
          return resposta;
        } catch (erro) {
          const cache = await caches.open(CACHE_NAME);
          const salvo = await cache.match(req);
          return salvo || Response.error();
        }
      })()
    );
    return;
  }

  // Demais arquivos (CSS, JS, imagens, ícones): rede primeiro,
  // com cópia salva para funcionar offline se a rede falhar.
  event.respondWith(
    (async () => {
      try {
        const resposta = await fetch(req);
        if (resposta && resposta.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, resposta.clone());
        }
        return resposta;
      } catch (erro) {
        const cache = await caches.open(CACHE_NAME);
        const salvo = await cache.match(req);
        if (salvo) return salvo;
        throw erro;
      }
    })()
  );
});
