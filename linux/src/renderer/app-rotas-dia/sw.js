/* FAST Servicos - app Rotas do Dia - Service Worker persistente (r134; r240 = novos icones)
   RESTAURA a instalabilidade do mini-app: o Chrome so dispara o
   beforeinstallprompt (botao "Instalar Rotas do Dia") quando existe uma
   Service Worker ATIVA, com handler de fetch, que PERMANECE registrada.
   O sw.js "healer" da 2.3.19 se auto-desregistrava no activate - a pagina
   ficava sem nenhuma Service Worker e o botao caia no aviso "toque em ...".
   Modelo network-first (igual ao r128 que sempre funcionou):
   - recursos: rede primeiro (cache:'no-store'); cache so como fallback
     quando a rede falha (offline).
   - activate: apaga caches antigos (fast-rotas-dia-r128 e anteriores).
   - SEM self.unregister e SEM clients.navigate (nada de reload em loop). */
const CACHE='fast-rotas-dia-r240';
const CORE=['./','./index.html','./manifest.webmanifest','../assets/atalho-rotas-dia-192.png?v=r240','../assets/atalho-rotas-dia-512.png?v=r240'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).catch(()=>{})));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fast-rotas-dia-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r&&r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request).then(hit=>hit||caches.match('./'))))});
