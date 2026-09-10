/* FAST Servicos - app Despesas - Service Worker persistente
   (r134; r144 = novos icones; r145 (2.3.30) = SHARE TARGET: o app Despesas
   aparece na folha de compartilhamento do Android; ao compartilhar um PDF
   (boleto/comprovante) ou imagem (JPG/PNG) de dentro de qualquer app, o
   arquivo e entregue ao formulario de despesa, anexado e lido por OCR/IA.)
   ==========================================================================
   RESTAURA a instalabilidade do mini-app: o Chrome so dispara o
   beforeinstallprompt (botao "Instalar Despesas") quando existe uma
   Service Worker ATIVA, com handler de fetch, que PERMANECE registrada.
   O sw.js "healer" da 2.3.19 se auto-desregistrava no activate - a pagina
   ficava sem nenhuma Service Worker e o botao caia no aviso "toque em ...".
   Modelo network-first (igual ao r128 que sempre funcionou):
   - recursos: rede primeiro (cache:'no-store'); cache so como fallback
     quando a rede falha (offline).
   - activate: apaga caches antigos (fast-despesas-r128 e anteriores).
   - SEM self.unregister e SEM clients.navigate (nada de reload em loop).

   r145 SHARE TARGET (como funciona):
   1. Android compartilha -> POST multipart na action "./" do manifest.
   2. O SW extrai o arquivo do formData, guarda {nome,mime,tamanho,b64,ts}
      em cache de uso unico (fast-despesas-share-r145) e responde 303 para
      "./?share=1".
   3. O wrapper (index.html) carrega, ve ?share=1, busca o arquivo em
      fetch('./__fast-share-get__') (interceptado aqui) e repassa ao app
      principal dentro do iframe via postMessage.
   4. O app anexa o comprovante na despesa e roda OCR/IA imediatamente
      (RECEBEDOR->LOCAL, VALOR->valor, DATA->data).
   - O POST nunca vai a rede (GitHub Pages nao aceita POST). */
const CACHE='fast-despesas-r145';
const CORE=['./','./index.html','./manifest.webmanifest','../assets/atalho-despesas-192.png?v=r145','../assets/atalho-despesas-512.png?v=r145'];
const SHARE_CACHE='fast-despesas-share-r145';
const SHARE_KEY='/fastservicosapp/app-despesas/__fast-share__';
const SHARE_GET_URL='/fastservicosapp/app-despesas/__fast-share-get__';
const SHARE_TTL=120000; /* 2 minutos de validade */

self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).catch(()=>{})));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>(k.startsWith('fast-despesas-')&&k!==CACHE)||k===SHARE_CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
)});

function cacheShareAberto(){return caches.open(SHARE_CACHE)}

/* Guarda o comprovante compartilhado (uso unico, com TTL de 2 min). */
function guardarShare(item){
  return cacheShareAberto().then(c=>c.put(SHARE_KEY,new Response(JSON.stringify(item),{headers:{'Content-Type':'application/json'}})));
}
/* Devolve o comprovante guardado (ou null se expirou/nao existe). */
function lerShare(){
  return cacheShareAberto().then(c=>c.match(SHARE_KEY).then(function(res){
    if(!res)return null;
    return res.json().then(function(item){
      if(!item||!item.ts||Date.now()-item.ts>SHARE_TTL)return null;
      return item;
    }).catch(()=>null);
  }));
}
function apagarShare(){return cacheShareAberto().then(c=>c.delete(SHARE_KEY)).catch(()=>null)}

function urlDe(request,caminho){
  try{return new URL(caminho,request.url).toString()}catch(e){return caminho}
}

self.addEventListener('fetch',function(event){
  var u;
  try{u=new URL(event.request.url)}catch(e){return}
  var caminho=u.pathname.replace(/\/+$/,'');

  /* (3) Wrapper pede o comprovante guardado (GET especial, uso unico). */
  if(event.request.method==='GET'&&caminho===SHARE_GET_URL){
    event.respondWith(
      lerShare().then(function(item){
        var corpo=JSON.stringify({ok:!!item,item:item?{nome:item.nome,mime:item.mime,tamanho:item.tamanho,b64:item.b64}:null});
        return new Response(corpo,{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
      }).catch(function(){
        return new Response('{"ok":false,"item":null}',{status:200,headers:{'Content-Type':'application/json'}});
      })
    );
    return;
  }

  /* (1)+(2) POST do Android: guarda arquivo + redireciona com ?share=1 */
  if(event.request.method==='POST'&&(caminho==='/fastservicosapp/app-despesas'||u.searchParams.get('share')==='post')){
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
          return Response.redirect(urlDe(event.request,'./?share=1'),303);
        }
        var f=arquivos[0];
        var item={nome:f.name||'comprovante',mime:f.type||'application/octet-stream',tamanho:f.size,ts:Date.now(),b64:''};
        return blobParaBase64(f).then(function(b64){
          item.b64=b64;
          return guardarShare(item);
        }).then(function(){
          return Response.redirect(urlDe(event.request,'./?share=1'),303);
        }).catch(function(){
          return Response.redirect(urlDe(event.request,'./?share=1'),303);
        });
      }).catch(function(){
        return Response.redirect(urlDe(event.request,'./?share=1'),303);
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

function blobParaBase64(blob){
  return new Promise(function(res,rej){
    try{
      var fr=new FileReaderSync();
      res(fr.readAsDataURL(blob).split(',')[1]||'');
    }catch(e){
      var fr2=new FileReader();
      fr2.onload=function(){res((fr2.result||'').split(',')[1]||'')};
      fr2.onerror=function(){rej(e)};
      fr2.readAsDataURL(blob);
    }
  });
}
