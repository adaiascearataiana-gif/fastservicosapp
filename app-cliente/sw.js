const C='cliente-fast-r117',A=['./','./index.html','./manifest.webmanifest','../assets/fast-servicos-icon-192.png','../assets/fast-servicos-icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(x=>x.addAll(A).catch(()=>{})));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('cliente-fast-')&&x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r.ok)caches.open(C).then(x=>x.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request)))});
