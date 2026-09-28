(function () {
  'use strict';
  function init() {
    var box = document.getElementById('empDataBox');
    var tabs = box && box.querySelector('.emp-tabs');
    if (!tabs || tabs.querySelector('[data-emptab="datavalid"]')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'emp-tab ripple';
    button.dataset.emptab = 'datavalid';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', 'false');
    button.innerHTML = '<i class="fa-solid fa-id-card-clip"></i> Datavalid';
    var next = tabs.querySelector('[data-emptab="brevo"]');
    tabs.insertBefore(button, next);
    var panel = document.createElement('div');
    panel.id = 'emptabDatavalid';
    panel.className = 'emp-tab-content';
    panel.setAttribute('role', 'tabpanel');
    panel.hidden = true;
    panel.innerHTML = '<div class="emp-section"><div class="emp-section-title"><i class="fa-solid fa-id-card-clip"></i> Verificação de motoristas · Datavalid</div>'+
      '<p class="emp-sql-info">O Datavalid ainda não está contratado nem conectado. Nenhum documento é consultado automaticamente em bases oficiais. Até a integração ser configurada no servidor, confira os documentos e decida cada cadastro na seção Motoristas.</p>'+
      '<p id="fastDatavalidConnection" role="status" style="padding:12px;border:1px solid #f59e0b;border-radius:12px;background:#fffbeb;color:#92400e;font-weight:700">Integração oficial: não conectada · Análise manual ativa</p>'+
      '<div id="fastDatavalidCounts" role="status" style="display:flex;flex-wrap:wrap;gap:10px;margin:18px 0"></div>'+
      '<p class="emp-sql-info">A aprovação manual aparece no cadastro do motorista e é sincronizada pelo mecanismo já existente do FAST quando a sincronização estiver disponível. A aprovação manual não equivale à validação oficial de identidade.</p>'+
      '<button type="button" class="emp-btn-primary ripple" id="fastDatavalidOpen"><i class="fa-solid fa-users-viewfinder"></i> Analisar cadastros em Motoristas</button></div>';
    box.querySelector('#emptabBrevo').before(panel);
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      box.querySelectorAll('.emp-tab').forEach(function (tab) {
        var selected = tab === button;
        tab.classList.toggle('active', selected);
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      });
      box.querySelectorAll('.emp-tab-content').forEach(function (item) {
        item.hidden = item !== panel;
        item.classList.toggle('active', item === panel);
      });
      render();
    }, true);
    document.getElementById('fastDatavalidOpen').addEventListener('click', function () {
      if (typeof window.fecharEmpOverlay === 'function') window.fecharEmpOverlay();
      var shortcut = document.querySelector('[data-v2-go="motoristas"]');
      if (shortcut) shortcut.click();
      else if (typeof window.mostrarSecao === 'function') window.mostrarSecao('motoristas');
    });
  }
  function render() {
    var target = document.getElementById('fastDatavalidCounts');
    if (!target) return;
    var list = ((window.bancoDados || {}).motoristas || []).filter(function (m) { return m.origem === 'FAST Motorista' || m.aprovacaoStatus; });
    var groups = [
      ['Novos', function (s) { return !s || /novo/i.test(s); }],
      ['Em análise', function (s) { return /processo|análise|analise/i.test(s); }],
      ['Aprovados manualmente', function (s) { return /aprovado/i.test(s); }],
      ['Negados', function (s) { return /negado/i.test(s); }]
    ];
    target.replaceChildren();
    groups.forEach(function (group) {
      var card = document.createElement('div');
      card.style.cssText = 'flex:1 1 125px;border:1px solid var(--border);border-radius:12px;padding:12px;background:var(--bg-card)';
      var count = list.filter(function (m) { return group[1](String(m.aprovacaoStatus || (m.status === 'Ativo' ? 'Motorista aprovado' : m.status) || '')); }).length;
      var strong = document.createElement('strong');
      strong.style.cssText = 'display:block;font-size:24px';
      strong.textContent = count;
      card.append(strong, document.createTextNode(group[0]));
      target.appendChild(card);
    });
  }
  window.fastDatavalidRefresh = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
