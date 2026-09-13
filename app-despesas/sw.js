/* FAST Servicos - app Despesas - Service Worker persistente
   (r134; r144 = novos icones; r145 = SHARE TARGET unico arquivo;
    r243 (2.3.32) = SHARE TARGET MULTI-ARQUIVO: o app Despesas aparece na
    folha de compartilhamento do Android; ao compartilhar um ou VARIOS
    PDFs (boleto/comprovante) ou imagens (JPG/PNG) de dentro de qualquer
    app, TODOS os arquivos sao entregues ao formulario de despesa,
    anexados e lidos por OCR/IA com preenchimento automatico.)
   ==========================================================================
   RESTAURA a instalabilidade do mini-app: o Chrome so dispara o
   beforeinstallprompt (botao "Instalar Despesas") quando existe uma
   Service Worker ATIVA, com handler de fetch, que PERMANECE registrada.
   O sw.js "healer" da 2.3.19 se auto-desregistrava no activate - a pagina
   ficava sem nenhuma Service Worker e o botao caia no aviso "toque em ...".
   Modelo network-first (igual ao r128 que sempre funcionou):
   - recursos: rede primeiro (cache:'no-store'); cache so como fallback
     quando a rede falha (offline).
   - activate: apaga caches antigos (fast-despesas-r145 e anteriores).
   - SEM self.unregister e SEM clients.navigate (nada de reload em loop).

   r243 SHARE TARGET (como funciona):
   1. Android compartilha -> POST multipart na action "./" do manifest.
   2. O SW extrai TODOS os arquivos do formData, guarda
      {files:[{nome,mime,tamanho,b64}],ts} em cache de uso unico
      (fast-despesas-share-r243) e responde 303 para "./?share=1".
   3. O wrapper (index.html) carrega, ve ?share=1, busca a lista em
      fetch('./__fast-share-get__') (interceptado aqui) e repassa ao app
      principal dentro do iframe via postMessage (lista completa).
   4. O app anexa TODOS os comprovantes na despesa, roda OCR/IA
      imediatamente no principal e preenche os campos sozinho
      (RECEBEDOR->LOCAL, VALOR->valor, DATA->data) - so conferir e salvar.
   - O POST nunca vai a rede (GitHub Pages nao aceita POST).
   - Compat r145: se o wrapper antigo pedir, o item antigo (arquivo unico)
     continua disponivel no mesmo payload (campo "item" = primeiro arquivo). */
const CACHE='fast-despesas-r243';
const CORE=['./','./index.html','./manifest.webmanifest','../assets/atalho-despesas-192.png?v=r243','../assets/atalho-despesas-512.png?v=r243'];
const SHARE_CACHE='fast-despesas-share-r243';
const SHARE_KEY='/fastservicosapp/app-despesas/__fast-share__';
const SHARE_GET_URL='/fastservicosapp/app-despesas/__fast-share-get__';
const SHARE_TTL=300000; /* 5 minutos de validade (rede lenta / primeiro acesso) */
const SHARE_MAX_ARQ=10;   /* ate 10 comprovantes por compartilhamento */
const SHARE_MAX_MB=12;    /* 12MB por arquivo (limite do Android share) */

self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).catch(()=>{})));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>(k.startsWith('fast-despesas-')&&k!==CACHE)||k===SHARE_CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
)});

function cacheShareAberto(){return caches.open(SHARE_CACHE)}

/* Guarda a LISTA de comprovantes compartilhados (uso unico, TTL 5 min). */
function guardarShare(pacote){
  return cacheShareAberto().then(c=>c.put(SHARE_KEY,new Response(JSON.stringify(pacote),{headers:{'Content-Type':'application/json'}})));
}
/* Devolve o pacote guardado (ou null se expirou/nao existe). */
function lerShare(){
  return cacheShareAberto().then(c=>c.match(SHARE_KEY).then(function(res){
    if(!res)return null;
    return res.json().then(function(pacote){
      if(!pacote||!pacote.ts||Date.now()-pacote.ts>SHARE_TTL)return null;
      return pacote;
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

  /* (3) Wrapper pede a lista guardada (GET especial, uso unico). */
  if(event.request.method==='GET'&&caminho===SHARE_GET_URL){
    event.respondWith(
      lerShare().then(function(pacote){
        var corpo;
        if(pacote&&pacote.files&&pacote.files.length){
          /* formato novo r243 (lista) + campo "item" de compat r145 */
          corpo=JSON.stringify({ok:true,ts:pacote.ts,files:pacote.files,item:pacote.files[0]||null});
        }else{
          corpo=JSON.stringify({ok:false,item:null,files:[]});
        }
        return new Response(corpo,{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
      }).catch(function(){
        return new Response('{"ok":false,"item":null,"files":[]}',{status:200,headers:{'Content-Type':'application/json'}});
      })
    );
    return;
  }

  /* (1)+(2) POST do Android: guarda TODOS os arquivos + redireciona ?share=1 */
  if(event.request.method==='POST'&&(caminho==='/fastservicosapp/app-despesas'||u.searchParams.get('share')==='post')){
    event.respondWith(
      event.request.formData().then(function(data){
        var arquivos=[];
        try{
          var fs=data.getAll('comprovante')||[];
          for(var i=0;i<fs.length;i++){if(fs[i]&&fs[i].size>0)arquivos.push(fs[i]);}
          if(!arquivos.length){
            data.forEach(function(v,k){if(v&&typeof v==='object'&&v.size>0&&v.name&&v.size<SHARE_MAX_MB*1024*1024)arquivos.push(v);});
          }
        }catch(e){}
        arquivos=arquivos.slice(0,SHARE_MAX_ARQ);
        if(!arquivos.length){
          return Response.redirect(urlDe(event.request,'./?share=1'),303);
        }
        var pacote={ts:Date.now(),files:[]};
        var seq=Promise.resolve();
        arquivos.forEach(function(f){
          seq=seq.then(function(){
            return blobParaBase64(f).then(function(b64){
              pacote.files.push({nome:f.name||'comprovante',mime:f.type||'application/octet-stream',tamanho:f.size,b64:b64});
            });
          });
        });
        return seq.then(function(){
          return guardarShare(pacote);
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
