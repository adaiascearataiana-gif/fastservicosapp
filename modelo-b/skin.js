/* ==========================================================================
   FAST — Modelo B · ligação da skin com o app real
   Este arquivo NÃO altera regra de negócio, dados, sincronização ou permissões.
   Ele só cuida da aparência:

     1. liga a classe `modelo-b` no <html> (base da skin CSS);
     2. "pinta" alguns elementos estruturais (sidebar, cabeçalho, hero, painel
        de sincronização) com estilo inline + important — porque o app aplica
        essas cores por seletores muito específicos, ou por JavaScript, e sem
        isso elas venceriam a skin;
     3. mostra um selo discreto para voltar ao visual atual;
     4. guarda a escolha em localStorage (chave própria: fast_modelo_b).

   A pintura é reconciliada a cada mudança de tela: o que deixou de valer é
   removido na hora (sem "fantasmas" de aba ativa) e o que o app reescreveu
   por JavaScript é repintado.

   Se este arquivo falhar em qualquer ponto, o app continua funcionando
   exatamente como hoje — só não recebe o visual novo.
   ========================================================================== */
(function () {
  'use strict';

  var CHAVE = 'fast_modelo_b';
  var raiz = document.documentElement;

  try {
    if (localStorage.getItem(CHAVE) === 'off') return;
  } catch (e) {}

  raiz.classList.add('modelo-b');

  /* ------------------------------------------------------------------------
     Pintura dos elementos estruturais (só cor, borda, raio e sombra)
     ---------------------------------------------------------------------- */
  var AZUL = '#1E3A8A';
  var REGRAS = {
    '#proSidebar': {
      'background': '#FFFFFF',
      'background-image': 'none',
      'border-right': '1px solid #E9E9E2',
      'box-shadow': 'none',
      'color': '#2B3A4F'
    },
    'header.top-nav': {
      'background': 'rgba(250, 250, 248, .92)',
      'background-image': 'none',
      'border-bottom': '1px solid #E9E9E2',
      'box-shadow': 'none',
      'backdrop-filter': 'blur(14px) saturate(1.4)',
      'color': '#0D1726'
    },
    'header.top-nav .top-nav-brand': { 'color': '#0D1726' },
    'header.top-nav .global-search-input': {
      'background': '#FFFFFF',
      'color': '#0D1726',
      'border': '1px solid #DCDED4',
      'border-radius': '11px'
    },
    'header.top-nav .fx-upd-pill, header.top-nav .conn-status, header.top-nav .sync-neon': {
      'background': '#FFFFFF',
      'border': '1px solid #E9E9E2',
      'border-radius': '999px',
      'color': '#5E6B7E'
    },
    'header.top-nav .bell-btn': {
      'background': '#FFFFFF',
      'color': '#5E6B7E',
      'border': '1px solid #E9E9E2'
    },
    'header.top-nav .bell-btn i, header.top-nav .bell-btn svg': { 'color': '#5E6B7E' },
    'header.top-nav .fast-user-btn': { 'color': '#0D1726' },
    'header.top-nav .fast-user-avatar': {
      'background': 'linear-gradient(145deg, #24479F, #1E3A8A)',
      'color': '#FFFFFF'
    },
    'header.top-nav .fast-user-panel-head': {
      'background': 'linear-gradient(135deg, rgba(30, 58, 138, .10), rgba(5, 150, 105, .10))'
    },
    '.nav-dropdown-btn': {
      'background': 'linear-gradient(135deg, #24479F, #1E3A8A)',
      'color': '#FFFFFF',
      'border-radius': '11px'
    },
    '#proSidebar .pro-side-brand': {
      'border-bottom': '1px solid #E9E9E2',
      'background': 'transparent'
    },
    '#proSidebar .pro-side-section': { 'color': '#6B7789' },
    '#proSidebar .pro-side-btn': { 'color': '#5E6B7E', 'border-radius': '11px' },
    '#proSidebar .pro-side-btn.active': {
      'background': 'rgba(30, 58, 138, .09)',
      'color': AZUL,
      'box-shadow': 'inset 3px 0 0 ' + AZUL
    },
    '#proSidebar .pro-side-footer': {
      'border-top': '1px solid #E9E9E2',
      'background': '#F7F8F4'
    },
    '.pro-command-card': {
      'background': 'linear-gradient(140deg, #24479F 0%, #1E3A8A 55%, #17306F 100%)',
      'border-radius': '20px',
      'color': '#FFFFFF'
    },
    /* Painel de sincronização/erros (#f68Diag): o app troca a cor por
       JavaScript (vermelho quando falta login ou há erro). No Modelo B ele
       fica azul-marinho — o vermelho continua existindo no texto e nos
       ícones de alerta, sem cobrir a tela com um bloco vermelho. */
    '#f68Diag': {
      'background': '#0D1726',
      'background-image': 'linear-gradient(160deg, #17306F 0%, #0D1726 100%)',
      'color': '#FFFFFF',
      'border': '1px solid rgba(255, 255, 255, .12)',
      'border-radius': '18px',
      'box-shadow': '0 24px 60px -24px rgba(13, 23, 38, .75)',
      'max-height': '78vh',
      'overflow': 'auto'
    },
    '#f68Diag #f68Entrar': {
      'background': AZUL,
      'background-image': 'none',
      'color': '#FFFFFF',
      'border-radius': '11px'
    },
    '#f68Diag input': {
      'border': '1px solid #DCDED4',
      'border-radius': '11px'
    },
    '#f68Diag [data-f538="copiar"]': {
      'background': '#FFFFFF',
      'color': '#0D1726',
      'border-radius': '10px'
    },
    '#f68Diag [data-f538="limpar"]': {
      'background': '#2B3A4F',
      'color': '#FFFFFF',
      'border-radius': '10px'
    }
  };

  /* Estado aplicado por elemento: { propriedade: valor }.
     A cada passada comparamos o desejado com o que a skin aplicou e com o que
     está de fato no elemento (o app pode reescrever por JavaScript). O que
     não vale mais é removido — inclusive quando o app tira a classe .active
     de um botão e outro vira o ativo. */
  var estado = new Map();

  function pintar() {
    var desejado = new Map();

    Object.keys(REGRAS).forEach(function (seletor) {
      var elementos;
      try {
        elementos = document.querySelectorAll(seletor);
      } catch (e) {
        return;
      }
      Array.prototype.forEach.call(elementos, function (el) {
        var atual = desejado.get(el);
        if (!atual) {
          atual = {};
          desejado.set(el, atual);
        }
        var regras = REGRAS[seletor];
        Object.keys(regras).forEach(function (prop) {
          atual[prop] = regras[prop];
        });
      });
    });

    /* 1) remove o que a skin aplicou antes e não vale mais */
    estado.forEach(function (props, el) {
      var agora = desejado.get(el);
      Object.keys(props).forEach(function (prop) {
        if (!agora || !Object.prototype.hasOwnProperty.call(agora, prop)) {
          try { el.style.removeProperty(prop); } catch (e) {}
        }
      });
    });

    /* 2) aplica/repinta o que vale agora */
    desejado.forEach(function (props, el) {
      Object.keys(props).forEach(function (prop) {
        var valor = props[prop];
        var aplicado = '';
        try { aplicado = el.style.getPropertyValue(prop); } catch (e) {}
        var prioridade = '';
        try { prioridade = el.style.getPropertyPriority(prop); } catch (e) {}
        if (aplicado === valor && prioridade === 'important') return;
        try { el.style.setProperty(prop, valor, 'important'); } catch (e) {}
      });
    });

    estado = desejado;
  }

  /* ------------------------------------------------------------------------
     Selo do Modelo B
     ---------------------------------------------------------------------- */
  function montarSelo() {
    if (document.querySelector('.mb-badge') || !document.body) return;

    var selo = document.createElement('div');
    selo.className = 'mb-badge';
    selo.setAttribute('role', 'status');
    selo.innerHTML =
      '<span class="mb-dot" aria-hidden="true"></span>' +
      '<span><b>Modelo B</b> · visual novo</span>' +
      '<a href="../index.html">visual atual</a>' +
      '<button type="button" class="mb-close" aria-label="Ocultar selo">×</button>';

    selo.querySelector('.mb-close').addEventListener('click', function () {
      selo.remove();
    });
    document.body.appendChild(selo);
  }

  /* ------------------------------------------------------------------------
     Reprocessa quando o app redesenha telas (troca de aba, login, modais)
     ---------------------------------------------------------------------- */
  var agendado = 0;
  function agendar() {
    clearTimeout(agendado);
    agendado = setTimeout(function () {
      pintar();
      /* se o app reescreveu a classe do <html>, a skin é religada */
      try {
        if (!raiz.classList.contains('modelo-b') && localStorage.getItem(CHAVE) !== 'off') {
          raiz.classList.add('modelo-b');
        }
      } catch (e) {}
    }, 120);
  }

  function iniciar() {
    pintar();
    montarSelo();

    try {
      new MutationObserver(agendar).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-pro-tab']
      });
    } catch (e) {}

    document.addEventListener('click', agendar, true);
    window.addEventListener('load', agendar);
    setTimeout(agendar, 800);
    setTimeout(agendar, 2500);
    /* o painel de sincronização é reescrito pelo app a cada 2 s */
    setInterval(pintar, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }

  try {
    console.info(
      '%cFAST · Modelo B',
      'background:#1E3A8A;color:#fff;padding:2px 6px;border-radius:4px;font-weight:700',
      'visual aplicado. App, sincronização e apps continuam os mesmos arquivos.'
    );
  } catch (e) {}
})();
