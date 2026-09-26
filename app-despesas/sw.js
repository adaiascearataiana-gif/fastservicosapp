/* FAST Servicos - app Despesas - Service Worker persistente
   (neon4034; adotando a mesma estratégia de atualização via cache-rollback)
   ==========================================================================
   RESTAURA a instalabilidade do mini-app: o Chrome so dispara o
   beforeinstallprompt (botao "Instalar Despesas") quando existe uma
   Service Worker ATIVA, com handler de fetch, que PERMANECE registrada.
   O sw.js "healer" da 2.3.19 se auto-desregistrava no activate - a pagina
   ficava sem nenhuma Service Worker e o botao caia no aviso "toque em ...".
   Modelo network-first (igual ao r128 que sempre funcionou):
   - recursos: rede primeiro (cache:'no-store'); cache so como fallback
     quando a rede falha (offline).
   - activate: apaga caches antigos (fast-despesas-neon4034 e anteriores).
   - SEM self.unregister e SEM clients.navigate (nada de reload em loop).
*/
const CACHE='fast-despesas-neon4034';
const CORE=['./','./index.html','./manifest.webmanifest','../assets/app-despesas-192.png?v=neon4034','../assets/app-despesas-512.png?v=neon4034'];
const SHARE_CACHE='fast-despesas-share-neon4034';
const SHARE_KEY='/fastservicosapp/app-despesas/__fast-share__';
const SHARE_GET_URL='/fastservicosapp/app-despesas/__fast-share-get__';
const SHARE_TTL=300000;
const SHARE_MAX_ARQ=10;
const SHARE_MAX_MB=12;

self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).catch(()=>{})));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('fast-despesas-')&&k!==CACHE)||k===SHARE_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

function cacheShareAberto(){return caches.open(SHARE_CACHE)}
function guardarShare(pacote){return cacheShareAberto().then(c=>c.put(SHARE_KEY,new Response(JSON.stringify(pacote),{headers:{'Content-Type':'application/json'}})));}
function lerShare(){return cacheShareAberto().then(c=>c.match(SHARE_KEY).then(function(res){if(!res)return null;return res.json().then(function(pacote){if(!pacote||!pacote.ts||Date.now()-pacote.ts>SHARE_TTL)return null;return pacote;}).catch(()=>null);}));}
function apagarShare(){return cacheShareAberto().then(c=>c.delete(SHARE_KEY)).catch(()=>null)}
function urlDe(request,caminho){try{return new URL(caminho,request.url).toString()}catch(e){return caminho}}

self.addEventListener('fetch',function(event){
  var u; try{u=new URL(event.request.url)}catch(e){return}
  var caminho=u.pathname.replace(/\/+$/,'');

  if(event.request.method==='GET'&&caminho===SHARE_GET_URL){
    event.respondWith(lerShare().then(function(pacote){var corpo; if(pacote&&pacote.files&&pacote.files.length){ corpo=JSON.stringify({ok:true,ts:pacote.ts,files:pacote.files,item:pacote.files[0]||null}); } else { corpo=JSON.stringify({ok:false,item:null,files:[]}); } return new Response(corpo,{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}).catch(function(){ return new Response('{"ok":false,"item":null,"files":[]}',{status:200,headers:{'Content-Type':'application/json'}}); }));
    return;
  }

  if(event.request.method==='POST'&&(caminho==='/fastservicosapp/app-despesas'||u.searchParams.get('share')==='post')){
    event.respondWith(event.request.formData().then(function(data){var arquivos=[]; try{var fs=data.getAll('comprovante')||[]; for(var i=0;i<fs.length;i++){if(fs[i]&&fs[i].size>0)arquivos.push(fs[i]);} if(!arquivos.length){ data.forEach(function(v,k){if(v&&typeof v==='object'&&v.size>0&&v.name&&v.size<SHARE_MAX_MB*1024*1024)arquivos.push(v);}); } }catch(e){} arquivos=arquivos.slice(0,SHARE_MAX_ARQ); if(!arquivos.length){ return Response.redirect(urlDe(event.request,'./?share=1'),303); } var pacote={ts:Date.now(),files:[]}; var seq=Promise.resolve(); arquivos.forEach(function(f){seq=seq.then(function(){return blobParaBase64(f).then(function(b64){pacote.files.push({nome:f.name||'comprovante',mime:f.type||'application/octet-stream',tamanho:f.size,b64:b64});});});}); return seq.then(function(){return guardarShare(pacote);}).then(function(){return Response.redirect(urlDe(event.request,'./?share=1'),303);}).catch(function(){return Response.redirect(urlDe(event.request,'./?share=1'),303);}); }).catch(function(){ return Response.redirect(urlDe(event.request,'./?share=1'),303); }));
    return;
  }

  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(function(r){if(r&&r.ok)caches.open(CACHE).then(function(c){c.put(event.request,r.clone())}); return r;}).catch(function(){ return caches.match(event.request).then(function(hit){return hit||caches.match('./')}); })));
});

function blobParaBase64(blob){return new Promise(function(res,rej){ try{ var fr=new FileReaderSync(); res(fr.readAsDataURL(blob).split(',')[1]||''); }catch(e){ var fr2=new FileReader(); fr2.onload=function(){res((fr2.result||'').split(',')[1]||'')}; fr2.onerror=function(){rej(e)}; fr2.readAsDataURL(blob);} });}
