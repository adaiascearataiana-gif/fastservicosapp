/* Desktop renderer copy of the stable web service worker. */
const SW_VERSION = '4.0.23';
const CACHE_NAME = 'fast-servicos-' + SW_VERSION;
self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(n=>n.startsWith('fast-servicos-')&&n!==CACHE_NAME).map(n=>caches.delete(n)));
  await self.clients.claim();
})()));
self.addEventListener('message', e => { if(e.data&&e.data.type==='SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==self.location.origin)return;
  e.respondWith((async()=>{try{
    const x=await fetch(r,{cache:'no-store'});
    if(x.ok)caches.open(CACHE_NAME).then(c=>c.put(r,x.clone()));
    return x;
  }catch(err){return (await caches.open(CACHE_NAME)).match(r)||Response.error()}})());
});
