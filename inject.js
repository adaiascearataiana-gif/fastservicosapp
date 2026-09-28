
<!-- FAST ajustes solicitados: camera, drive, salvar, balao -->
<script id="fast-ajustes-extra">
(function(){
  'use strict';

  /* 1) CAMERA EM TEMPO REAL - mais nitidez (alta resolucao + foco continuo) */
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && !navigator.mediaDevices.__fastPatched) {
      var _orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function(constraints){
        try {
          constraints = constraints || {};
          if (constraints.video) {
            var v = (typeof constraints.video === 'object') ? constraints.video : {};
            if (v.facingMode == null) v.facingMode = { ideal: 'environment' };
            if (v.width == null)  v.width  = { ideal: 1920 };
            if (v.height == null) v.height = { ideal: 1080 };
            if (v.frameRate == null) v.frameRate = { ideal: 30 };
            v.advanced = (v.advanced || []).concat([{ focusMode: 'continuous' }]);
            constraints.video = v;
          }
        } catch(e){}
        return _orig(constraints);
      };
      navigator.mediaDevices.__fastPatched = true;
    }
  } catch(e){}

  /* 2) GOOGLE DRIVE - reconectar sozinho ao abrir (silencioso) */
  (function(){
    var CLIENT_KEY='fast_drive_client_id', TOKEN_KEY='fast_drive_access_token',
        EXP_KEY='fast_drive_access_token_expires_at',
        SCOPE='https://www.googleapis.com/auth/drive.file';
    function tokenValido(){
      try{ var t=sessionStorage.getItem(TOKEN_KEY)||localStorage.getItem(TOKEN_KEY)||'';
        var e=Number(localStorage.getItem(EXP_KEY)||0);
        if(t && (!e || Date.now()<e)) return true; }catch(_){}
      return false;
    }
    function salvar(t,exp){ try{ sessionStorage.setItem(TOKEN_KEY,t); localStorage.setItem(TOKEN_KEY,t);
      localStorage.setItem(EXP_KEY,String(Date.now()+Math.max(60,Number(exp)||3600)*1000-60000)); }catch(_){}
    }
    function tentarSilencioso(){
      var cid=''; try{ cid=localStorage.getItem(CLIENT_KEY)||''; }catch(_){}
      if(!cid || !/\.apps\.googleusercontent\.com$/.test(cid)) return;
      if(tokenValido()) return;
      if(!(window.google&&google.accounts&&google.accounts.oauth2)) return;
      try{
        var tc=google.accounts.oauth2.initTokenClient({
          client_id:cid, scope:SCOPE, prompt:'',
          callback:function(resp){
            if(resp&&resp.access_token){ salvar(resp.access_token,resp.expires_in);
              if(window.fastDriveSincronizarPendentes) try{window.fastDriveSincronizarPendentes();}catch(_){} }
          },
          error_callback:function(){}
        });
        tc.requestAccessToken({prompt:''});
      }catch(_){}
    }
    function agendar(){ var n=0, iv=setInterval(function(){ n++;
      if(window.google&&google.accounts&&google.accounts.oauth2){ clearInterval(iv); tentarSilencioso(); }
      else if(n>40){ clearInterval(iv); } }, 500); }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',agendar,{once:true}); else agendar();
    window.addEventListener('online', tentarSilencioso);
    window.addEventListener('pageshow', function(){ setTimeout(tentarSilencioso, 800); });
  })();

  /* 3) BALAO FLUTUANTE - nao ficar travado a esquerda (recentraliza) */
  (function(){
    try{
      var salvo=localStorage.getItem('floatingBoxPos');
      if(salvo){ var p=JSON.parse(salvo);
        if(!p || typeof p.x!=='number' || p.x < Math.max(40, window.innerWidth*0.15)){
          localStorage.removeItem('floatingBoxPos');
        }
      }
    }catch(_){ try{localStorage.removeItem('floatingBoxPos');}catch(e){} }
    function centralizar(box){ if(!box) return;
      box.style.transform=''; box.style.left=''; box.style.top=''; box.style.bottom='';
    }
    function fixar(){
      ['floatingSelectBox','floatingClientesBox','floatingRastBox','floatingMotoristasBox'].forEach(function(id){
        var b=document.getElementById(id); if(!b) return;
        var L=parseInt(b.style.left||'',10);
        if(!isNaN(L) && L < Math.max(40, window.innerWidth*0.15)) centralizar(b);
      });
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fixar,{once:true}); else fixar();
    setInterval(fixar, 1500);
  })();

  /* 4) BOTOES SALVAR (ROTA e DESPESA) - salvar de onde estiver */
  (function(){
    function bind(formId){
      var form=document.getElementById(formId); if(!form || form.__fastSaveBound) return;
      var btn=form.querySelector('button[type="submit"]'); if(!btn) return;
      form.__fastSaveBound=true;
      btn.addEventListener('pointerup', function(ev){
        ev.preventDefault();
        if(typeof form.requestSubmit==='function') form.requestSubmit(); else form.submit();
      }, true);
    }
    function bindAll(){ bind('formModalSeq'); bind('formDespesa'); }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bindAll,{once:true}); else bindAll();
    setInterval(bindAll, 2000);
  })();

  /* 5) EVITAR TELAS PISCANDO / abertura automatica de Configuracoes no boot */
  (function(){
    var inicio=Date.now(), usuarioTocou=false;
    document.addEventListener('pointerdown', function(){ usuarioTocou=true; }, true);
    function proteger(nome){
      var orig=window[nome]; if(typeof orig!=='function' || orig.__fastGuard) return;
      var g=function(){
        try{
          var args=arguments, alvo=args[args.length-1];
          var ehConfig = (String(alvo||'').indexOf('config')>=0);
          if(ehConfig && !usuarioTocou && (Date.now()-inicio)<4000){ return; }
        }catch(e){}
        return orig.apply(this, arguments);
      };
      g.__fastGuard=true; try{ window[nome]=g; }catch(e){}
    }
    function aplicar(){ proteger('proIr'); proteger('trocarAba'); }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',aplicar,{once:true}); else aplicar();
  })();

})();
</script>
