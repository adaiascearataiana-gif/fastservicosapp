/* FAST Servicos - app Cliente FAST - Service Worker persistente (r243)
   RESTAURA a instalabilidade do mini-app: o Chrome so dispara o
   beforeinstallprompt quando existe uma Service Worker ATIVA, com handler
   de fetch, que PERMANECE registrada. O sw.js "healer" da 2.3.19 se
   auto-desregistrava no activate - a pagina ficava sem nenhuma Service
   Worker e a instalacao nao era oferecida.
   Modelo network-first (igual ao r243 que sempre funcionou):
   - recursos: rede primeiro (cache:'no-store'); cache so como fallback
     quando a rede falha (offline).
   - activate: apaga caches antigos (cliente-fast-r243 e anteriores).
   - SEM self.unregister e SEM clients.navigate (nada de reload em loop). */
const C='cliente-fast-r243',A=['./','./index.html','./manifest.webmanifest','../assets/fast-servicos-icon-192.png','../assets/fast-servicos-icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(x=>x.addAll(A).catch(()=>{})));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('cliente-fast-')&&x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r.ok)caches.open(C).then(x=>x.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request)))});
