/* ==========================================================================
   FAST//OS — protótipo de interface (dados fictícios, sem backend)
   Interações: navegação entre views, tema, paleta de comandos, contadores,
   relógio, toasts e rótulos de tabela para o mobile.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------- Tema claro/escuro ---------- */
  var themeLabel = $('#themeLabel');
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    if (themeLabel) themeLabel.textContent = t === 'dark' ? 'Tema claro' : 'Tema escuro';
    try { localStorage.setItem('proto_fast_theme', t); } catch (e) {}
  }
  try {
    var saved = localStorage.getItem('proto_fast_theme');
    if (saved) applyTheme(saved);
  } catch (e) {}
  $('#themeToggle').addEventListener('click', function () {
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ---------- Navegação ---------- */
  var views = $$('.view');
  function go(viewId) {
    views.forEach(function (v) { v.classList.toggle('is-active', v.id === 'view-' + viewId); });
    $$('[data-view]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-view') === viewId); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    animateCounters();
  }
  $$('[data-view]').forEach(function (btn) {
    btn.addEventListener('click', function () { go(btn.getAttribute('data-view')); });
  });
  $$('[data-goto]').forEach(function (btn) {
    btn.addEventListener('click', function () { go(btn.getAttribute('data-goto')); });
  });

  /* ---------- Rótulos para tabelas virarem cartões no mobile ---------- */
  $$('.table').forEach(function (table) {
    var labels = $$('thead th', table).map(function (th) { return th.textContent.trim(); });
    $$('tbody tr', table).forEach(function (tr) {
      $$('td', tr).forEach(function (td, i) { if (labels[i]) td.setAttribute('data-label', labels[i]); });
    });
  });

  /* ---------- Contadores animados ---------- */
  var counted = new WeakSet();
  function animateCounters() {
    $$('.bignum').forEach(function (el) {
      if (counted.has(el)) return;
      counted.add(el);
      var target = parseFloat(el.getAttribute('data-count'));
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var group = el.getAttribute('data-group') === '1';
      var start = null, duration = 900;
      function fmt(n) {
        var v = n.toFixed(decimals);
        if (group) v = v.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return prefix + v.replace('.', ',') + suffix;
      }
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased);
        if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(target);
      }
      requestAnimationFrame(step);
    });
  }
  animateCounters();

  /* ---------- Relógio ---------- */
  var clock = $('#clock');
  function tick() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    clock.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  tick(); setInterval(tick, 1000);

  /* ---------- Toasts ---------- */
  var toasts = $('#toasts');
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    toasts.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 260); }, 2800);
  }
  $$('[data-demo]').forEach(function (b) {
    b.addEventListener('click', function () {
      toast('Ação de demonstração — este protótipo não tem backend.');
    });
  });
  $$('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('.chip').forEach(function (x) { x.classList.remove('is-on'); });
      c.classList.add('is-on');
    });
  });

  /* ---------- Paleta de comandos (Ctrl+K) ---------- */
  var palette = $('#palette');
  var input = $('#paletteInput');
  var list = $('#paletteList');
  var actions = [
    { label: 'Ir para o Painel', hint: '01', run: function () { go('painel'); } },
    { label: 'Ir para Entregas', hint: '02', run: function () { go('entregas'); } },
    { label: 'Ir para Rotas do dia', hint: '03', run: function () { go('rotas'); } },
    { label: 'Ir para Motoristas', hint: '04', run: function () { go('motoristas'); } },
    { label: 'Ir para Clientes', hint: '05', run: function () { go('clientes'); } },
    { label: 'Ir para Financeiro', hint: '06', run: function () { go('financeiro'); } },
    { label: 'Alternar tema claro/escuro', hint: 'TEMA', run: function () { $('#themeToggle').click(); } },
    { label: 'Nova entrega', hint: 'AÇÃO', run: function () { toast('Ação de demonstração — sem backend.'); } }
  ];
  var selIndex = 0, current = actions.slice();

  function render(filter) {
    var q = (filter || '').toLowerCase();
    current = actions.filter(function (a) { return a.label.toLowerCase().indexOf(q) !== -1; });
    selIndex = 0;
    list.innerHTML = current.map(function (a, i) {
      return '<li><button data-i="' + i + '" class="' + (i === 0 ? 'sel' : '') + '">' +
        a.label + '<small>' + a.hint + '</small></button></li>';
    }).join('') || '<li style="padding:14px;color:var(--faint);font:500 11px IBM Plex Mono">Nenhum comando encontrado</li>';
  }
  function openPalette() {
    palette.classList.add('open'); palette.setAttribute('aria-hidden', 'false');
    input.value = ''; render(''); setTimeout(function () { input.focus(); }, 30);
  }
  function closePalette() {
    palette.classList.remove('open'); palette.setAttribute('aria-hidden', 'true');
  }
  $('#cmdTrigger').addEventListener('click', openPalette);
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    if (e.key === 'Escape') closePalette();
  });
  palette.addEventListener('click', function (e) { if (e.target === palette) closePalette(); });
  input.addEventListener('input', function () { render(input.value); });
  input.addEventListener('keydown', function (e) {
    var btns = $$('button', list);
    if (e.key === 'ArrowDown') { selIndex = Math.min(selIndex + 1, btns.length - 1); }
    else if (e.key === 'ArrowUp') { selIndex = Math.max(selIndex - 1, 0); }
    else if (e.key === 'Enter') {
      var a = current[selIndex];
      if (a) { closePalette(); a.run(); }
      return;
    } else { return; }
    e.preventDefault();
    btns.forEach(function (b, i) { b.classList.toggle('sel', i === selIndex); });
    if (btns[selIndex]) btns[selIndex].scrollIntoView({ block: 'nearest' });
  });
  list.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var a = current[parseInt(b.getAttribute('data-i'), 10)];
    if (a) { closePalette(); a.run(); }
  });

  /* ---------- Micro-simulação de "tempo real" ---------- */
  var ticker = [
    'Rota 03 · 14 min até a próxima janela',
    '3 veículos em movimento agora',
    'Sincronia com a nuvem: em dia · 11:42',
    'Nenhum documento vencendo esta semana'
  ];
  var liveEl = $('.live');
  var ti = 0;
  setInterval(function () {
    ti = (ti + 1) % ticker.length;
    liveEl.title = ticker[ti];
  }, 5000);
})();
