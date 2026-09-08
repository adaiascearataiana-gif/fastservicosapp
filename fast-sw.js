/* FAST Servicos - Service Worker raiz PERSISTENTE (r135 / 2.3.20)
   ==========================================================================
   PROPOSITO: tornar o APP FAST SERVIÇOS e o FAST MOTORISTA instaláveis de
   verdade. O Chrome só dispara o beforeinstallprompt (botão INSTALAR da
   CENTRAL DE DOWNLOADS) quando existe uma Service Worker ATIVA, com handler
   de fetch, que PERMANECE registrada. Ate a 2.3.19 o app principal nao
   registrava nenhuma SW (r132) e o motorista registrava o sw.js "healer",
   que se auto-desregistrava no activate — nenhuma das paginas era
   instalável pelo prompt nativo.

   Este SW é PERSISTENTE e NAO faz o jogo do healer:
   - Sem self.unregister, sem clients.navigate, sem reload em loop.
   - network-first: rede sempre primeiro (cache:'no-store'); o cache só é
     usado como fallback quando a rede falha (offline). Assim, ao publicar
   uma nova versao no GitHub Pages, o usuario recebe a nova versao na
   proxima visita — o mesmo modelo r134 que ja funciona nos mini-apps
   (ROTAS DO DIA, DESPESAS, CLIENTE FAST).
   - activate: apaga apenas caches antigos da raiz (fast-root-* anteriores).
   ========================================================================== */
const CACHE='fast-root-r135';
const CORE=[
  './',
  './index.html',
  './motorista.html',
  './manifest.webmanifest',
  './manifest-motorista.webmanifest',
  './v2-ui.css',
  './v2-ui.js',
  './assets/fast-servicos-icon-192.png',
  './assets/fast-servicos-icon-512.png'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).catch(()=>{})));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fast-root-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r&&r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request).then(hit=>hit||caches.match('./'))))});
