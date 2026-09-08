(function(){
  'use strict';
  /* ==========================================================================
     r133 / v2.3.19 — CORRECAO DA CAUSA RAIZ DO "FICA NA 12"
     Este pacote visual (v2-ui.js) rodava com VERSION='2.3.12' fixa no codigo e
     REGRAVAVA a versao do aplicativo em toda abertura (meta fast-app-version,
     fast-latest-update, fast-app-changelog, menu, splash e tela de acesso).
     Resultado: o app detectava a versao nova online, recarregava, e era
     rebaixado para 2.3.12 de novo — loop infinito de atualizacao.
     A partir da 2.3.19 a versao vem SEMPRE do proprio HTML (meta fast-app-version)
     e este pacote nunca mais sobrescreve nenhuma versao, changelog ou label.
     ========================================================================== */
  function currentVersion(){
    var m=document.querySelector('meta[name="fast-app-version"]');
    return (m && m.content) ? m.content : '2.3.21';
  }
  var MIGRATION_KEY='fast_v2_migration_complete',CHECKPOINT_KEY='fast_v2_pre_migration_checkpoint';
  var commands=[
    ['central','Centro de Opera\u00e7\u00f5es','Vis\u00e3o geral e prioridades','fa-table-cells-large'],
    ['rotasDia','Rotas do Dia','Execu\u00e7\u00e3o, fotos e conclus\u00e3o','fa-calendar-day'],
    ['rotas','Rotas e Servi\u00e7os','Hist\u00f3rico geral de viagens','fa-route'],
    ['rastreamento','Mapa e Rastreamento','Motoristas e ETA ao vivo','fa-location-dot'],
    ['clientes','Clientes','Cadastros e hist\u00f3rico','fa-building-user'],
    ['motoristas','Motoristas','Equipe de entrega','fa-id-card'],
    ['despesas','Despesas','Lan\u00e7amentos financeiros','fa-receipt'],
    ['dashboard','Dashboard','Indicadores e an\u00e1lises','fa-chart-pie'],
    ['dre','DRE','Resultado financeiro','fa-chart-line'],
    ['configuracoes','Configura\u00e7\u00f5es','Integra\u00e7\u00f5es, seguran\u00e7a e backup','fa-sliders']
  ];
  function safeSnapshot(){
    if(localStorage.getItem(MIGRATION_KEY)==='1')return;
    try{
      var data={},keys=[];for(var i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));
      keys.forEach(function(k){if(k!==CHECKPOINT_KEY)data[k]=localStorage.getItem(k)});
      localStorage.setItem(CHECKPOINT_KEY,JSON.stringify({versionBefore:document.querySelector('meta[name="fast-app-version"]')?.content||'',createdAt:new Date().toISOString(),keys:keys.length,data:data}));
      localStorage.setItem(MIGRATION_KEY,'1');localStorage.setItem('fast_v2_installed_at',new Date().toISOString());
    }catch(e){console.warn('[FAST 2.0] checkpoint local n\u00e3o conclu\u00eddo:',e)}
  }
  function go(id){closePalette();if(typeof window.proIr==='function')window.proIr(id);else if(typeof window.trocarAba==='function')window.trocarAba(null,id)}
  function toast(text){var t=document.getElementById('fastV2Toast');if(!t)return;t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(function(){t.classList.remove('show')},2200)}
  function closePalette(){document.getElementById('fastV2Palette')?.classList.remove('show');document.body.style.overflow=''}
  function openPalette(){var p=document.getElementById('fastV2Palette');if(!p)return;p.classList.add('show');document.body.style.overflow='hidden';var q=document.getElementById('fastV2Query');q.value='';renderCommands('');setTimeout(function(){q.focus()},30)}
  function renderCommands(term){var host=document.getElementById('fastV2Commands'),q=String(term||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');var rows=commands.filter(function(x){return (x[1]+' '+x[2]).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q)});host.innerHTML=rows.length?rows.map(function(x){return '<button class="fast-v2-command" data-v2-go="'+x[0]+'"><i class="fa-solid '+x[3]+'"></i><span>'+x[1]+'<small>'+x[2]+'</small></span><i class="fa-solid fa-arrow-right"></i></button>'}).join(''):'<div class="fast-v2-command-empty">Nenhum comando encontrado.</div>'}
  function install(){
    var VERSION=currentVersion(); /* versao real do HTML — nunca fixa neste pacote */
    safeSnapshot();document.body.classList.add('fast-v2');document.documentElement.dataset.fastVersion=VERSION;
    var old=localStorage.getItem('fast_v2_density');if(old==='compact')document.body.classList.add('fast-v2-compact');
    /* r127/v2.3.11: nunca duplicar - se o launcher/palette/toast ja existirem no DOM
       (snapshot assado ou injecao anterior), apenas rebinda em vez de injetar outra copia. */
    var existing=document.getElementById('fastV2Launcher');
    if(!existing){
    document.body.insertAdjacentHTML('beforeend','<button class="fast-v2-launcher" id="fastV2Launcher" aria-label="Abrir central r\u00e1pida" title="Central r\u00e1pida (Ctrl+K)"><i class="fa-solid fa-bolt"></i></button><div class="fast-v2-palette" id="fastV2Palette" role="dialog" aria-modal="true" aria-label="Central r\u00e1pida"><div class="fast-v2-palette-box"><div class="fast-v2-palette-head"><i class="fa-solid fa-magnifying-glass"></i><input id="fastV2Query" placeholder="Ir para uma \u00e1rea ou executar uma a\u00e7\u00e3o..."><kbd>ESC</kbd></div><div class="fast-v2-command-list" id="fastV2Commands"></div><div style="display:flex;gap:8px;padding:10px 14px;border-top:1px solid #dbe4ef"><button class="btn-secondary" data-v2-action="density"><i class="fa-solid fa-table-cells"></i> Alternar densidade</button><button class="btn-secondary" data-v2-action="focus"><i class="fa-solid fa-expand"></i> Modo foco</button><button class="btn-secondary" data-v2-go="configuracoes"><i class="fa-solid fa-shield-halved"></i> Seguran\u00e7a</button></div></div></div><div class="fast-v2-toast" id="fastV2Toast" style="pointer-events:none;"></div>');
    renderCommands('');
    } /* fim if(!existing) */
    document.getElementById('fastV2Launcher').onclick=openPalette;
    document.getElementById('fastV2Query').oninput=function(){renderCommands(this.value)};
    document.addEventListener('click',function(e){var g=e.target.closest('[data-v2-go]'),a=e.target.closest('[data-v2-action]');if(g)go(g.dataset.v2Go);if(a&&a.dataset.v2Action==='density'){document.body.classList.toggle('fast-v2-compact');localStorage.setItem('fast_v2_density',document.body.classList.contains('fast-v2-compact')?'compact':'comfortable');toast('Densidade da interface atualizada.')}if(a&&a.dataset.v2Action==='focus'){document.body.classList.toggle('fast-v2-focus');closePalette();toast(document.body.classList.contains('fast-v2-focus')?'Modo foco ativado.':'Modo foco desativado.')}if(e.target.id==='fastV2Palette')closePalette()});
    document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette()}if(e.key==='Escape')closePalette()});
    /* r133/v2.3.19: FIM DA REGRAVACAO DE VERSAO.
       Este pacote NAO toca mais em: meta fast-app-version, meta fast-latest-update,
       meta fast-app-changelog, navMenuVersao, fastSplashVersion, fastGateVersionNum.
       Todos esses pontos sao de responsabilidade EXCLUSIVA do index.html oficial,
       que ja traz a versao correta gravada na fonte. Qualquer regravação aqui
       rebaixaria o app apos a atualizacao — exatamente o bug do "fica na 12". */
    window.fastV2={version:VERSION,open:openPalette,restoreCheckpoint:function(){var c=JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||'null');if(!c||!c.data)return false;Object.keys(c.data).forEach(function(k){localStorage.setItem(k,c.data[k])});location.reload();return true}};
    setTimeout(function(){toast('FAST Servi\u00e7os '+VERSION+' pronto para operar.')},900);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
