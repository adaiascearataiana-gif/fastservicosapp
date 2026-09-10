/* FAST Servicos - Service Worker raiz PERSISTENTE
   (r135 / 2.3.20; r145 / 2.3.30 = SHARE TARGET Despesas)
   ==========================================================================
   PROPOSITO: tornar o APP FAST SERVIÇOS e o FAST MOTORISTA instaláveis de
   verdade. O Chrome só dispara o beforeinstallprompt (botão INSTALAR da
   CENTRAL DE DOWNLOADS) quando existe uma Service Worker ATIVA, com handler
   de fetch, que PERMANECE registrada. Até a 2.3.19 o app principal não
   registrava nenhuma SW (r132) e o motorista registrava o sw.js "healer",
   que se auto-desregistrava no activate — nenhuma das páginas era
   instalável pelo prompt nativo.

   Este SW é PERSISTENTE e NÃO faz o jogo do healer:
   - Sem self.unregister, sem clients.navigate, sem reload em loop.
   - network-first: rede sempre primeiro (cache:'no-store'); o cache só é
     usado como fallback quando a rede falha (offline). Assim, ao publicar
   uma nova versão no GitHub Pages, o usuário recebe a nova versão na
     próxima visita — o mesmo modelo r134 que já funciona nos mini-apps
     (ROTAS DO DIA, DESPESAS, CLIENTE FAST).
   - activate: apaga apenas caches antigos da raiz (fast-root-* anteriores).

   r145 SHARE TARGET (Despesas):
   - Quem instalou o DESPESAS pelo atalho raiz (manifest-despesas) também
     compartilha PDF/imagens com o app. O POST cai em /app-despesas/ — se
     a SW do mini-app estiver ativa, ela responde; se não, ESTA SW assume.
     As duas usam o MESMO cache de compartilhamento (o Cache Storage é
     por origem, então qualquer uma lê o que a outra gravou).
   - Endpoints: POST /fastservicosapp/app-despesas/ (grava + 303 p/
     ./?share=1) e GET /fastservicosapp/app-despesas/__fast-share-get__
     (devolve o comprovante guardado em JSON).
   ========================================================================== */
const CACHE='fast-root-r145';
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
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fast-root-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

/* ---------- r145: SHARE TARGET Despesas (mesmo cache do mini-app) ---------- */
const SHARE_CACHE='fast-despesas-share-r145';
const SHARE_KEY='/fastservicosapp/app-despesas/__fast-share__';
const SHARE_GET_URL='/fastservicosapp/app-despesas/__fast-share-get__';
const SHARE_TTL=120000; /* 2 minutos de validade */

function urlDe(request,caminho){
  try{return new URL(caminho,request.url).toString()}catch(e){return caminho}
}

self.addEventListener('fetch',function(event){
  var u;
  try{u=new URL(event.request.url)}catch(e){return}
  var caminho=u.pathname.replace(/\/+$/,'');

  /* Wrapper/app pede o comprovante guardado (GET especial). */
  if(event.request.method==='GET'&&caminho===SHARE_GET_URL){
    event.respondWith(
      caches.open(SHARE_CACHE).then(function(c){
        return c.match(SHARE_KEY).then(function(res){
          if(!res)return new Response('{"ok":false,"item":null}',{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
          return res.json().then(function(item){
            var valido=!!(item&&item.ts&&Date.now()-item.ts<=SHARE_TTL);
            var corpo=JSON.stringify({ok:valido,item:valido?item:null});
            return new Response(corpo,{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
          }).catch(function(){
            return new Response('{"ok":false,"item":null}',{status:200,headers:{'Content-Type':'application/json'}});
          });
        });
      })
    );
    return;
  }

  /* POST do Android (compartilhar com Despesas). */
  if(event.request.method==='POST'&&caminho==='/fastservicosapp/app-despesas'){
    event.respondWith(
      event.request.formData().then(function(data){
        var arquivos=[];
        try{
          var fs=data.getAll('comprovante')||[];
          for(var i=0;i<fs.length;i++){if(fs[i]&&fs[i].size>0)arquivos.push(fs[i]);}
          if(!arquivos.length){
            data.forEach(function(v,k){if(v&&typeof v==='object'&&v.size>0&&v.name&&v.size<12*1024*1024)arquivos.push(v);});
          }
        }catch(e){}
        if(!arquivos.length){
          return Response.redirect(urlDe(event.request,'/fastservicosapp/app-despesas/?share=1'),303);
        }
        var f=arquivos[0];
        var item={nome:f.name||'comprovante',mime:f.type||'application/octet-stream',tamanho:f.size,ts:Date.now(),b64:''};
        return new Promise(function(res){
          try{
            var fr=new FileReaderSync();
            item.b64=fr.readAsDataURL(f).split(',')[1]||'';
            res();
          }catch(e){
            var fr2=new FileReader();
            fr2.onload=function(){item.b64=(fr2.result||'').split(',')[1]||'';res()};
            fr2.onerror=function(){res()};
            fr2.readAsDataURL(f);
          }
        }).then(function(){
          return caches.open(SHARE_CACHE).then(function(c){
            return c.put(SHARE_KEY,new Response(JSON.stringify(item),{headers:{'Content-Type':'application/json'}}));
          });
        }).then(function(){
          return Response.redirect(urlDe(event.request,'/fastservicosapp/app-despesas/?share=1'),303);
        }).catch(function(){
          return Response.redirect(urlDe(event.request,'/fastservicosapp/app-despesas/?share=1'),303);
        });
      }).catch(function(){
        return Response.redirect(urlDe(event.request,'/fastservicosapp/app-despesas/?share=1'),303);
      })
    );
    return;
  }

  if(event.request.method!=='GET')return;
  event.respondWith(
    fetch(event.request,{cache:'no-store'}).then(function(r){
      if(r&&r.ok)caches.open(CACHE).then(function(c){c.put(event.request,r.clone())});
      return r;
    }).catch(function(){
      return caches.match(event.request).then(function(hit){return hit||caches.match('./')});
    })
  );
});
