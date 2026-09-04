(function(){
  'use strict';
  var VERSION='2.0.1',MIGRATION_KEY='fast_v2_migration_complete',CHECKPOINT_KEY='fast_v2_pre_migration_checkpoint';
  var commands=[
    ['central','Centro de Operações','Visão geral e prioridades','fa-table-cells-large'],
    ['rotasDia','Rotas do Dia','Execução, fotos e conclusão','fa-calendar-day'],
    ['rotas','Rotas e Serviços','Histórico geral de viagens','fa-route'],
    ['rastreamento','Mapa e Rastreamento','Motoristas e ETA ao vivo','fa-location-dot'],
    ['clientes','Clientes','Cadastros e histórico','fa-building-user'],
    ['motoristas','Motoristas','Equipe de entrega','fa-id-card'],
    ['despesas','Despesas','Lançamentos financeiros','fa-receipt'],
    ['dashboard','Dashboard','Indicadores e análises','fa-chart-pie'],
    ['dre','DRE','Resultado financeiro','fa-chart-line'],
    ['configuracoes','Configurações','Integrações, segurança e backup','fa-sliders']
  ];
  function safeSnapshot(){
    if(localStorage.getItem(MIGRATION_KEY)==='1')return;
    try{
      var data={},keys=[];for(var i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));
      keys.forEach(function(k){if(k!==CHECKPOINT_KEY)data[k]=localStorage.getItem(k)});
      localStorage.setItem(CHECKPOINT_KEY,JSON.stringify({versionBefore:document.querySelector('meta[name="fast-app-version"]')?.content||'',createdAt:new Date().toISOString(),keys:keys.length,data:data}));
      localStorage.setItem(MIGRATION_KEY,'1');localStorage.setItem('fast_v2_installed_at',new Date().toISOString());
    }catch(e){console.warn('[FAST 2.0] checkpoint local não concluído:',e)}
  }
  function go(id){closePalette();if(typeof window.proIr==='function')window.proIr(id);else if(typeof window.trocarAba==='function')window.trocarAba(null,id)}
  function toast(text){var t=document.getElementById('fastV2Toast');if(!t)return;t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(function(){t.classList.remove('show')},2200)}
  function closePalette(){document.getElementById('fastV2Palette')?.classList.remove('show');document.body.style.overflow=''}
  function openPalette(){var p=document.getElementById('fastV2Palette');if(!p)return;p.classList.add('show');document.body.style.overflow='hidden';var q=document.getElementById('fastV2Query');q.value='';renderCommands('');setTimeout(function(){q.focus()},30)}
  function renderCommands(term){var host=document.getElementById('fastV2Commands'),q=String(term||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');var rows=commands.filter(function(x){return (x[1]+' '+x[2]).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q)});host.innerHTML=rows.length?rows.map(function(x){return '<button class="fast-v2-command" data-v2-go="'+x[0]+'"><i class="fa-solid '+x[3]+'"></i><span>'+x[1]+'<small>'+x[2]+'</small></span><i class="fa-solid fa-arrow-right"></i></button>'}).join(''):'<div class="fast-v2-command-empty">Nenhum comando encontrado.</div>'}
  function install(){
    safeSnapshot();document.body.classList.add('fast-v2');document.documentElement.dataset.fastVersion=VERSION;
    var old=localStorage.getItem('fast_v2_density');if(old==='compact')document.body.classList.add('fast-v2-compact');
    document.body.insertAdjacentHTML('beforeend','<button class="fast-v2-launcher" id="fastV2Launcher" aria-label="Abrir central rápida" title="Central rápida (Ctrl+K)"><i class="fa-solid fa-bolt"></i></button><div class="fast-v2-palette" id="fastV2Palette" role="dialog" aria-modal="true" aria-label="Central rápida"><div class="fast-v2-palette-box"><div class="fast-v2-palette-head"><i class="fa-solid fa-magnifying-glass"></i><input id="fastV2Query" placeholder="Ir para uma área ou executar uma ação..."><kbd>ESC</kbd></div><div class="fast-v2-command-list" id="fastV2Commands"></div><div style="display:flex;gap:8px;padding:10px 14px;border-top:1px solid #dbe4ef"><button class="btn-secondary" data-v2-action="density"><i class="fa-solid fa-table-cells"></i> Alternar densidade</button><button class="btn-secondary" data-v2-action="focus"><i class="fa-solid fa-expand"></i> Modo foco</button><button class="btn-secondary" data-v2-go="configuracoes"><i class="fa-solid fa-shield-halved"></i> Segurança</button></div></div></div><div class="fast-v2-toast" id="fastV2Toast"></div>');
    renderCommands('');
    document.getElementById('fastV2Launcher').onclick=openPalette;
    document.getElementById('fastV2Query').oninput=function(){renderCommands(this.value)};
    document.addEventListener('click',function(e){var g=e.target.closest('[data-v2-go]'),a=e.target.closest('[data-v2-action]');if(g)go(g.dataset.v2Go);if(a&&a.dataset.v2Action==='density'){document.body.classList.toggle('fast-v2-compact');localStorage.setItem('fast_v2_density',document.body.classList.contains('fast-v2-compact')?'compact':'comfortable');toast('Densidade da interface atualizada.')}if(a&&a.dataset.v2Action==='focus'){document.body.classList.toggle('fast-v2-focus');closePalette();toast(document.body.classList.contains('fast-v2-focus')?'Modo foco ativado.':'Modo foco desativado.')}if(e.target.id==='fastV2Palette')closePalette()});
    document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette()}if(e.key==='Escape')closePalette()});
    var meta=document.querySelector('meta[name="fast-app-version"]');if(meta)meta.content=VERSION;
    var latest=document.querySelector('meta[name="fast-latest-update"]');if(latest)latest.content='FAST Serviços 2.0.1: lugares repetidos consolidados automaticamente, com backup preventivo e sincronização corrigida.';
    var changes=document.querySelector('meta[name="fast-app-changelog"]');if(changes)changes.content=JSON.stringify([
      {type:'melhorado',text:'2.0.1: histórico e Rotas do Dia atribuídos ao motorista ADAÍAS, com backup preventivo dos registros anteriores.'},
      {type:'corrigido',text:'2.0.1: lugares repetidos são consolidados pelo nome mesmo quando chegam do Supabase com IDs diferentes.'},
      {type:'melhorado',text:'2.0.1: limpeza preserva endereço, bairro, telefone, histórico de uso e cria backup preventivo local.'},
      {type:'novo',text:'2.0.0: interface completamente redesenhada como central de operações logística.'},
      {type:'novo',text:'2.0.0: Central Rápida com busca de áreas pelo botão flutuante ou Ctrl+K.'},
      {type:'novo',text:'2.0.0: modos Foco e Compacto para adaptar o espaço de trabalho.'},
      {type:'melhorado',text:'2.0.0: navegação, cartões, formulários, tabelas e telas mobile reconstruídos com o novo sistema visual.'},
      {type:'melhorado',text:'2.0.0: migração preserva dados existentes e cria ponto de restauração local antes da primeira abertura.'},
      {type:'corrigido',text:'2.0.0: mantém a correção do fechamento e layout da Central de Notificações da r102.'}
    ]);
    var menu=document.getElementById('navMenuVersao');if(menu)menu.textContent='Versão 2.0.1';
    var splash=document.getElementById('fastSplashVersion');if(splash)splash.textContent='2.0.1';
    var gate=document.getElementById('fastGateVersionNum');if(gate)gate.textContent='2.0.1';
    window.fastV2={version:VERSION,open:openPalette,restoreCheckpoint:function(){var c=JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||'null');if(!c||!c.data)return false;Object.keys(c.data).forEach(function(k){localStorage.setItem(k,c.data[k])});location.reload();return true}};
    setTimeout(function(){toast('FAST Serviços 2.0.1 pronto para operar.')},900);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
