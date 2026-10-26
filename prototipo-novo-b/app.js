/* ==========================================================================
   FAST OS — Modelo B · protótipo (dados fictícios, sem backend)
   Interações: navegação entre 6 telas, tema claro/escuro persistido,
   paleta de comandos Ctrl+K, contadores animados, relógio, toasts,
   filtros visuais, tabelas responsivas (cartões no celular) e deep links.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================================================
     TEMA
     ========================================================================== */
  var THEME_KEY = 'proto_fast_b_theme';
  var themeToggle = $('#themeToggle');
  var themeMobile = $('#themeMobile');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var themeLabels = $$('.theme-label');

  function setTheme(theme, persist) {
    var dark = theme === 'dark';
    root.setAttribute('data-theme', dark ? 'dark' : 'light');

    themeLabels.forEach(function (label) {
      label.textContent = dark ? 'Tema claro' : 'Tema escuro';
    });
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
      themeToggle.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
    }
    if (themeMobile) {
      themeMobile.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
    }
    if (themeMeta) {
      themeMeta.setAttribute('content', dark ? '#080E1A' : '#FAFAF8');
    }
    if (persist) {
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {}
    }
  }

  function toggleTheme() {
    setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
  }

  setTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', false);
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  if (themeMobile) themeMobile.addEventListener('click', toggleTheme);

  /* ==========================================================================
     ORDENAÇÃO DE TELAS
     ========================================================================== */
  var VIEW_IDS = ['painel', 'entregas', 'rotas', 'motoristas', 'clientes', 'financeiro'];
  var VIEW_TITLES = {
    painel: 'Painel',
    entregas: 'Entregas',
    rotas: 'Rotas do dia',
    motoristas: 'Motoristas',
    clientes: 'Clientes',
    financeiro: 'Financeiro'
  };

  function isValidView(id) {
    return VIEW_IDS.indexOf(id) !== -1;
  }

  function go(id, options) {
    options = options || {};
    if (!isValidView(id)) id = 'painel';

    $$('.view').forEach(function (view) {
      view.classList.toggle('is-active', view.id === 'view-' + id);
    });

    $$('[data-view]').forEach(function (trigger) {
      var active = trigger.getAttribute('data-view') === id;
      trigger.classList.toggle('is-active', active);
      if (trigger.classList.contains('nav-item')) {
        if (active) trigger.setAttribute('aria-current', 'page');
        else trigger.removeAttribute('aria-current');
      }
    });

    document.title = VIEW_TITLES[id] + ' · FAST OS — Modelo B';
    animateCounters();

    if (options.hash !== false) {
      var target = '#' + id;
      if (window.location.hash !== target) {
        try { history.replaceState(null, '', target); }
        catch (e) { window.location.hash = id; }
      }
    }

    if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  }

  $$('[data-view]').forEach(function (trigger) {
    trigger.addEventListener('click', function (event) {
      if (trigger.tagName === 'A') event.preventDefault();
      go(trigger.getAttribute('data-view'));
    });
  });

  $$('[data-goto]').forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      go(trigger.getAttribute('data-goto'));
    });
  });

  /* ==========================================================================
     CONTADORES ANIMADOS
     ========================================================================== */
  var counted = new WeakSet();
  var numberFormaters = {};

  function getFormatter(decimals) {
    if (!numberFormaters[decimals]) {
      try {
        numberFormaters[decimals] = new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
      } catch (e) {
        numberFormaters[decimals] = null;
      }
    }
    return numberFormaters[decimals];
  }

  function formatNumber(value, decimals) {
    var formatter = getFormatter(decimals);
    if (formatter) return formatter.format(value);
    var fixed = value.toFixed(decimals);
    var parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts[0] + (parts[1] ? ',' + parts[1] : '');
  }

  function animateCounter(el, force) {
    if (!force && counted.has(el)) return;
    counted.add(el);

    var target = parseFloat(el.getAttribute('data-count'));
    if (!isFinite(target)) return;

    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';

    function render(value) {
      el.textContent = prefix + formatNumber(value, decimals) + suffix;
    }

    if (reducedMotion || !window.requestAnimationFrame) {
      render(target);
      return;
    }

    var duration = 850;
    var start = null;

    function step(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      render(target * eased);
      if (progress < 1) window.requestAnimationFrame(step);
      else render(target);
    }

    window.requestAnimationFrame(step);
  }

  function animateCounters() {
    $$('.view.is-active .num[data-count]').forEach(function (el) {
      animateCounter(el);
    });
  }

  /* ==========================================================================
     PERÍODO DO PAINEL (Hoje · Semana · Mês) — interação visual
     ========================================================================== */
  var PANEL_PERIODS = {
    hoje: {
      eyebrow: 'segunda-feira, 26 de outubro',
      sub: '<strong>47 entregas</strong> em 6 rotas · 3 veículos em movimento agora',
      bars: [76, 88, 82, 98, 92, 36, 94],
      note: ['vs. ontem · meta 52', 'na última semana', 'abaixo da média', 'outubro · por km']
    },
    semana: {
      eyebrow: 'semana de 20 a 26 de outubro',
      sub: '<strong>329 entregas</strong> em 42 rotas · média de 47 por dia útil',
      bars: [84, 90, 86, 97, 93, 42, 90],
      note: ['vs. semana anterior', 'na semana', 'média por parada', 'outubro · por km']
    },
    mes: {
      eyebrow: 'outubro de 2026 · acumulado',
      sub: '<strong>1.284 entregas</strong> no mês · meta de 1.200 já batida',
      bars: [70, 78, 74, 88, 84, 30, 96],
      note: ['meta de 1.200 batida', 'no mês', 'média do mês', 'média do mês']
    }
  };

  var currentPeriod = 'hoje';

  function setPanelPeriod(period) {
    var data = PANEL_PERIODS[period];
    if (!data) return;
    currentPeriod = period;

    $$('.seg button').forEach(function (button) {
      var active = button.getAttribute('data-period') === period;
      button.classList.toggle('is-on', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    var eyebrow = $('[data-period-label="eyebrow"]');
    if (eyebrow) eyebrow.textContent = data.eyebrow;

    var sub = $('[data-period-sub]');
    if (sub) sub.innerHTML = data.sub;

    var panel = $('#view-painel');
    if (panel) {
      $$('[data-kpi-label]', panel).forEach(function (label) {
        var parts = label.getAttribute('data-kpi-label').split('|');
        for (var i = 0; i < parts.length; i += 2) {
          if (parts[i] === period && parts[i + 1]) label.textContent = parts[i + 1];
        }
      });

      var notes = $$('.kpi-note', panel);
      notes.forEach(function (note, index) {
        if (data.note[index]) note.textContent = data.note[index];
      });

      var periodIndex = Math.max(0, ['hoje', 'semana', 'mes'].indexOf(period));
      $$('.num[data-count-period]', panel).forEach(function (el) {
        var values = el.getAttribute('data-count-period').split(' ');
        var value = values[periodIndex] || values[0];
        el.setAttribute('data-count', value);
        animateCounter(el, true);
      });
    }

    var bars = $$('#weeklyBars .bar-fill');
    if (bars.length) {
      bars.forEach(function (bar, index) {
        if (data.bars[index]) bar.style.height = data.bars[index] + '%';
      });
    }
  }

  $$('[data-period]').forEach(function (button) {
    button.addEventListener('click', function () {
      setPanelPeriod(button.getAttribute('data-period'));
    });
  });

  /* ==========================================================================
     RELÓGIO AO VIVO
     ========================================================================== */
  var clock = $('#clock');

  function pad2(value) {
    return (value < 10 ? '0' : '') + value;
  }

  function tickClock() {
    if (!clock) return;
    var now = new Date();
    clock.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
  }

  tickClock();
  if (clock) setInterval(tickClock, 1000);

  /* ==========================================================================
     TOASTS
     ========================================================================== */
  var toastHost = $('#toasts');

  function showToast(message, tone) {
    if (!toastHost || !message) return;

    while (toastHost.children.length >= 3) {
      toastHost.removeChild(toastHost.firstElementChild);
    }

    var toast = document.createElement('div');
    toast.className = 'toast' + (tone === 'warn' ? ' warn' : '');
    toast.innerHTML =
      '<span class="toast-ico"><svg class="ico" aria-hidden="true"><use href="#' +
      (tone === 'warn' ? 'i-alert' : 'i-check') +
      '"></use></svg></span><span></span>';
    toast.lastElementChild.textContent = message;
    toastHost.appendChild(toast);

    var removed = false;
    function remove() {
      if (removed) return;
      removed = true;
      toast.classList.add('out');
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 220);
    }

    toast.addEventListener('click', remove);
    setTimeout(remove, 3400);
  }

  $$('[data-demo]').forEach(function (el) {
    el.addEventListener('click', function () {
      var message = el.getAttribute('data-demo');
      showToast(message || 'Ação de demonstração — este protótipo não tem backend.');
    });
  });

  /* ==========================================================================
     TABELAS → CARTÕES NO CELULAR
     ========================================================================== */
  $$('.table').forEach(function (table) {
    var headers = $$('thead th', table).map(function (th) {
      return th.textContent.trim();
    });
    $$('tbody tr', table).forEach(function (row) {
      $$('td', row).forEach(function (cell, index) {
        if (headers[index]) cell.setAttribute('data-label', headers[index]);
      });
    });
  });

  /* ==========================================================================
     FILTROS E CONTROLES SEGMENTADOS (interação visual)
     ========================================================================== */
  $$('.chips').forEach(function (group) {
    var chips = $$('.chip', group);
    chips.forEach(function (chip) {
      chip.setAttribute('aria-pressed', chip.classList.contains('is-on') ? 'true' : 'false');
      chip.addEventListener('click', function () {
        chips.forEach(function (other) {
          other.classList.remove('is-on');
          other.setAttribute('aria-pressed', 'false');
        });
        chip.classList.add('is-on');
        chip.setAttribute('aria-pressed', 'true');
      });
    });
  });

  $$('.seg').forEach(function (seg) {
    var buttons = $$('button', seg);
    buttons.forEach(function (button) {
      button.setAttribute('aria-pressed', button.classList.contains('is-on') ? 'true' : 'false');
      /* Os botões com data-period têm comportamento próprio (troca de números). */
      if (button.hasAttribute('data-period')) return;
      button.addEventListener('click', function () {
        buttons.forEach(function (other) {
          other.classList.remove('is-on');
          other.setAttribute('aria-pressed', 'false');
        });
        button.classList.add('is-on');
        button.setAttribute('aria-pressed', 'true');
      });
    });
  });

  /* ==========================================================================
     PALETA DE COMANDOS (CTRL+K)
     ========================================================================== */
  var palette = $('#palette');
  var paletteInput = $('#paletteInput');
  var paletteList = $('#paletteList');
  var cmdTrigger = $('#cmdTrigger');
  var lastFocus = null;
  var currentActions = [];
  var selectedIndex = 0;

  var actions = [
    { group: 'Navegação', icon: 'i-grid', label: 'Ir para o Painel', hint: '01', keywords: 'painel inicio dashboard visao geral', run: function () { go('painel'); } },
    { group: 'Navegação', icon: 'i-package', label: 'Ir para Entregas', hint: '02', keywords: 'entregas pedidos encomendas', run: function () { go('entregas'); } },
    { group: 'Navegação', icon: 'i-route', label: 'Ir para Rotas do dia', hint: '03', keywords: 'rotas rota caminho trajeto', run: function () { go('rotas'); } },
    { group: 'Navegação', icon: 'i-users', label: 'Ir para Motoristas', hint: '04', keywords: 'motoristas equipe motorista', run: function () { go('motoristas'); } },
    { group: 'Navegação', icon: 'i-building', label: 'Ir para Clientes', hint: '05', keywords: 'clientes carteira comercial', run: function () { go('clientes'); } },
    { group: 'Navegação', icon: 'i-wallet', label: 'Ir para Financeiro', hint: '06', keywords: 'financeiro financeiro receitas despesas', run: function () { go('financeiro'); } },
    { group: 'Ações', icon: 'i-plus', label: 'Nova entrega', hint: 'AÇÃO', keywords: 'criar nova entrega cadastrar', run: function () { showToast('Nova entrega — formulário de demonstração.'); } },
    { group: 'Ações', icon: 'i-sparkles', label: 'Otimizar rotas com IA', hint: 'AÇÃO', keywords: 'otimizar rota inteligencia ia', run: function () { go('rotas'); showToast('Otimização simulada: −52 min e −18 km.'); } },
    { group: 'Ações', icon: 'i-download', label: 'Exportar relatório do dia', hint: 'AÇÃO', keywords: 'exportar relatorio baixar pdf', run: function () { showToast('Relatório do dia exportado (simulação).'); } },
    { group: 'Ações', icon: 'i-moon', label: 'Alternar tema claro/escuro', hint: 'TEMA', keywords: 'tema escuro claro dark light', run: toggleTheme }
  ];

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function renderPalette(query) {
    var q = String(query || '').trim().toLowerCase();

    currentActions = actions.filter(function (action) {
      var haystack = (action.label + ' ' + action.keywords + ' ' + action.group).toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
    selectedIndex = 0;

    if (!currentActions.length) {
      paletteList.innerHTML = '<p class="pal-empty">Nenhum comando encontrado para “' + escapeHtml(q) + '”.</p>';
      return;
    }

    var html = '';
    var lastGroup = '';

    currentActions.forEach(function (action, index) {
      if (action.group !== lastGroup) {
        html += '<div class="pal-group">' + action.group + '</div>';
        lastGroup = action.group;
      }
      var selected = index === 0;
      html +=
        '<button type="button" role="option" aria-selected="' + (selected ? 'true' : 'false') +
        '" class="pal-item' + (selected ? ' sel' : '') + '" data-index="' + index + '">' +
        '<span class="ico-wrap" aria-hidden="true"><svg class="ico"><use href="#' + action.icon + '"></use></svg></span>' +
        '<span>' + action.label + '</span>' +
        '<span class="hint">' + action.hint + '</span>' +
        '</button>';
    });

    paletteList.innerHTML = html;
  }

  function openPalette() {
    if (!palette) return;
    lastFocus = document.activeElement;
    palette.classList.add('open');
    palette.setAttribute('aria-hidden', 'false');
    document.body.classList.add('palette-open');
    if (cmdTrigger) cmdTrigger.setAttribute('aria-expanded', 'true');
    if (paletteInput) paletteInput.value = '';
    renderPalette('');
    setTimeout(function () { if (paletteInput) paletteInput.focus(); }, 30);
  }

  function closePalette() {
    if (!palette || !palette.classList.contains('open')) return;
    palette.classList.remove('open');
    palette.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('palette-open');
    if (cmdTrigger) cmdTrigger.setAttribute('aria-expanded', 'false');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function updateSelection(nextIndex) {
    if (!currentActions.length) return;
    selectedIndex = Math.max(0, Math.min(nextIndex, currentActions.length - 1));
    $$('.pal-item', paletteList).forEach(function (item, index) {
      var selected = index === selectedIndex;
      item.classList.toggle('sel', selected);
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    var selectedItem = $('.pal-item.sel', paletteList);
    if (selectedItem) selectedItem.scrollIntoView({ block: 'nearest' });
  }

  function runAction(index) {
    var action = currentActions[index];
    if (!action) return;
    closePalette();
    action.run();
  }

  if (cmdTrigger) {
    cmdTrigger.setAttribute('aria-haspopup', 'dialog');
    cmdTrigger.setAttribute('aria-expanded', 'false');
    cmdTrigger.addEventListener('click', openPalette);
  }

  if (palette) {
    palette.addEventListener('click', function (event) {
      if (event.target === palette) closePalette();
    });
  }

  if (paletteInput) {
    paletteInput.addEventListener('input', function () {
      renderPalette(paletteInput.value);
    });
    paletteInput.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        updateSelection(selectedIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        updateSelection(selectedIndex - 1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        runAction(selectedIndex);
      }
    });
  }

  if (paletteList) {
    paletteList.addEventListener('click', function (event) {
      var item = event.target.closest('.pal-item');
      if (!item) return;
      runAction(parseInt(item.getAttribute('data-index'), 10));
    });
  }

  document.addEventListener('keydown', function (event) {
    var key = String(event.key).toLowerCase();

    if ((event.ctrlKey || event.metaKey) && key === 'k') {
      event.preventDefault();
      openPalette();
      return;
    }

    if (event.key === 'Escape') {
      closePalette();
      return;
    }

    if (!palette || !palette.classList.contains('open')) return;

    /* Mantém o foco dentro do diálogo ao navegar com Tab. */
    if (event.key === 'Tab') {
      var focusables = $$('button, input', palette).filter(function (el) {
        return el.offsetParent !== null;
      });
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  /* ==========================================================================
     INICIALIZAÇÃO (deep link) E MICRO-SIMULAÇÃO AO VIVO
     ========================================================================== */
  var initialView = window.location.hash.replace('#', '');
  go(isValidView(initialView) ? initialView : 'painel', { hash: false, scroll: false });

  window.addEventListener('hashchange', function () {
    var id = window.location.hash.replace('#', '');
    if (isValidView(id)) go(id, { hash: false, scroll: false });
  });

  var livePill = $('.live-pill');
  if (livePill) {
    var liveMessages = [
      '3 veículos em movimento agora',
      'Rota 03 · 14 min até a próxima janela',
      'Sincronia com a nuvem: em dia',
      'Nenhum documento vencendo esta semana'
    ];
    var liveIndex = 0;
    setInterval(function () {
      liveIndex = (liveIndex + 1) % liveMessages.length;
      livePill.setAttribute('title', liveMessages[liveIndex]);
    }, 6000);
  }
})();
