/* ============================================================
   Barra de cima: data completa, hora (com segundos) e clima
   O clima vem do serviço gratuito Open-Meteo (sem cadastro).
   ============================================================ */
(function () {
  var CFG = window.IBNM.CFG;
  var UI = window.IBNM.UI;

  var CHAVE = 'ibnm.clima.v1';
  var BUSCAR_A_CADA = 20 * 60 * 1000;      /* procura clima novo a cada 20 minutos */
  var VALE_ATE = 3 * 60 * 60 * 1000;       /* depois de 3 horas sem atualizar, não mostra mais */

  /* códigos de tempo (padrão mundial WMO): [ícone de dia, descrição, ícone de noite] */
  var TEMPO = {
    0: ['☀️', 'Céu limpo', '🌙'],
    1: ['🌤️', 'Poucas nuvens', '🌙'],
    2: ['⛅', 'Parcialmente nublado', '☁️'],
    3: ['☁️', 'Nublado'],
    45: ['🌫️', 'Neblina'], 48: ['🌫️', 'Neblina'],
    51: ['🌦️', 'Garoa fraca'], 53: ['🌦️', 'Garoa'], 55: ['🌧️', 'Garoa forte'],
    56: ['🌧️', 'Garoa gelada'], 57: ['🌧️', 'Garoa gelada'],
    61: ['🌧️', 'Chuva fraca'], 63: ['🌧️', 'Chuva'], 65: ['🌧️', 'Chuva forte'],
    66: ['🌧️', 'Chuva gelada'], 67: ['🌧️', 'Chuva gelada'],
    71: ['❄️', 'Neve fraca'], 73: ['❄️', 'Neve'], 75: ['❄️', 'Neve forte'], 77: ['❄️', 'Neve'],
    80: ['🌦️', 'Pancadas de chuva'], 81: ['🌧️', 'Pancadas de chuva'], 82: ['⛈️', 'Pancadas fortes'],
    85: ['❄️', 'Neve'], 86: ['❄️', 'Neve'],
    95: ['⛈️', 'Trovoada'], 96: ['⛈️', 'Trovoada com granizo'], 99: ['⛈️', 'Trovoada com granizo']
  };

  var clima = null;
  var buscando = false;
  var ultimoDia = '';
  var ultimaHora = -1;
  var relogio = null;

  function dois(n) { return (n < 10 ? '0' : '') + n; }
  function el(id) { return document.getElementById(id); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }

  function lugar() {
    var base = CFG.CLIMA || {};
    var daIgreja = {};
    try { daIgreja = (window.IBNM.Views.config().clima) || {}; } catch (e) {}
    var lat = Number(daIgreja.lat), lon = Number(daIgreja.lon);
    var usarIgreja = isFinite(lat) && isFinite(lon) && (lat !== 0 || lon !== 0) && daIgreja.lat !== '' && daIgreja.lat !== undefined;
    return {
      api: base.api || 'https://api.open-meteo.com/v1/forecast',
      lat: usarIgreja ? lat : base.lat,
      lon: usarIgreja ? lon : base.lon,
      cidade: (usarIgreja && daIgreja.cidade) || base.cidade || '',
      fuso: base.fuso || 'America/Fortaleza'
    };
  }

  function descricao(c) {
    var t = TEMPO[c.c] || ['🌡️', 'Tempo'];
    return { icone: (c.dia === false && t[2]) ? t[2] : t[0], texto: t[1] };
  }

  /* ---------------- relógio ---------------- */
  function tique() {
    var d = new Date();
    var hm = el('topoHM'), sg = el('topoSeg'), dt = el('topoData');
    if (hm) hm.textContent = dois(d.getHours()) + ':' + dois(d.getMinutes());
    if (sg) sg.textContent = ':' + dois(d.getSeconds());
    var dia = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
    if (dia !== ultimoDia) {
      ultimoDia = dia;
      var txt = UI.dataExtenso(d);
      if (dt) dt.textContent = txt.charAt(0).toUpperCase() + txt.slice(1);
      var caixa = el('topoTempo');
      if (caixa) caixa.setAttribute('aria-label', 'Hoje é ' + txt + '. Toque para ver o clima.');
    }
    if (d.getHours() !== ultimaHora) {
      /* virou a hora: a saudação pode mudar (bom dia / boa tarde / boa noite) */
      if (ultimaHora !== -1 && window.App && window.App.atualizarTopo) { try { window.App.atualizarTopo(); } catch (e) {} }
      ultimaHora = d.getHours();
    }
  }

  function agendar() {
    clearTimeout(relogio);
    relogio = setTimeout(function () { tique(); agendar(); }, 1000 - (Date.now() % 1000) + 4);
  }

  /* ---------------- clima ---------------- */
  function lerSalvo() {
    try {
      var c = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (c && typeof c.t === 'number' && c.em) return c;
    } catch (e) {}
    return null;
  }

  function pintarClima() {
    var caixa = el('topoClima');
    if (!caixa) return;
    var valido = clima && (Date.now() - clima.em) < VALE_ATE;
    if (!valido) {
      caixa.innerHTML = '<span class="tt-desc">' + (navigator.onLine === false ? 'Sem internet para ver o clima' : 'Buscando o clima…') + '</span>';
      caixa.classList.add('sem');
      return;
    }
    var d = descricao(clima);
    caixa.classList.remove('sem');
    caixa.innerHTML = '<span class="tt-ic" aria-hidden="true">' + d.icone + '</span><b>' + Math.round(clima.t) + '°C</b>' +
      '<span class="tt-desc">' + UI.esc(d.texto) + (clima.cidade ? '<span class="tt-cidade"> · ' + UI.esc(clima.cidade) + '</span>' : '') + '</span>';
  }

  function buscarClima(forcar) {
    if (buscando) return Promise.resolve(clima);
    if (!forcar && clima && (Date.now() - clima.em) < BUSCAR_A_CADA) return Promise.resolve(clima);
    if (navigator.onLine === false || typeof fetch !== 'function') { pintarClima(); return Promise.resolve(clima); }
    var l = lugar();
    if (!isFinite(Number(l.lat)) || !isFinite(Number(l.lon))) return Promise.resolve(clima);
    var url = l.api + '?latitude=' + encodeURIComponent(l.lat) + '&longitude=' + encodeURIComponent(l.lon) +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m' +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&forecast_days=1&timezone=' + encodeURIComponent(l.fuso);
    buscando = true;
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      return r && r.ok ? r.json() : null;
    }).then(function (j) {
      var a = j && j.current;
      if (!a || num(a.temperature_2m) === null) return clima;
      var dia = (j && j.daily) || {};
      var primeiro = function (lista) { return Array.isArray(lista) ? num(lista[0]) : null; };
      clima = {
        t: a.temperature_2m,
        s: num(a.apparent_temperature),
        u: num(a.relative_humidity_2m),
        v: num(a.wind_speed_10m),
        c: Number(a.weather_code) || 0,
        dia: a.is_day !== 0,
        max: primeiro(dia.temperature_2m_max),
        min: primeiro(dia.temperature_2m_min),
        chuva: primeiro(dia.precipitation_probability_max),
        cidade: l.cidade,
        em: Date.now()
      };
      try { localStorage.setItem(CHAVE, JSON.stringify(clima)); } catch (e) {}
      return clima;
    }).catch(function () {
      return clima;
    }).then(function (c) {
      buscando = false;
      pintarClima();
      return c;
    });
  }

  function linha(icone, rotulo, valor) {
    return '<div class="info-linha"><span class="ic">' + icone + '</span><div><b>' + rotulo + '</b>' + valor + '</div></div>';
  }

  function abrirDetalhes() {
    var d = new Date();
    var data = UI.dataExtenso(d);
    var html = '<div class="clima-agora">';
    var valido = clima && (Date.now() - clima.em) < VALE_ATE;
    if (valido) {
      var ds = descricao(clima);
      var quando = new Date(clima.em);
      html += '<div class="clima-grande"><span aria-hidden="true">' + ds.icone + '</span><div><b>' + Math.round(clima.t) + '°C</b>' +
        '<small>' + UI.esc(ds.texto) + '</small></div></div>' +
        (clima.s !== null ? linha('🌡️', 'Sensação térmica', Math.round(clima.s) + '°C') : '') +
        (clima.max !== null && clima.min !== null ? linha('📈', 'Hoje', 'Máxima ' + Math.round(clima.max) + '°C • mínima ' + Math.round(clima.min) + '°C') : '') +
        (clima.chuva !== null ? linha('☔', 'Chance de chuva hoje', Math.round(clima.chuva) + '%') : '') +
        (clima.u !== null ? linha('💧', 'Umidade do ar', Math.round(clima.u) + '%') : '') +
        (clima.v !== null ? linha('🍃', 'Vento', Math.round(clima.v) + ' km/h') : '') +
        '<div class="small mt10">Atualizado às ' + dois(quando.getHours()) + ':' + dois(quando.getMinutes()) +
        (clima.cidade ? ' • ' + UI.esc(clima.cidade) : '') + ' • fonte: Open-Meteo</div>';
    } else {
      html += '<div class="vazio"><span class="em">🌡️</span><b>Clima indisponível agora</b>Confira sua internet e toque em atualizar.</div>';
    }
    html += '</div><div class="folha-acoes"><button class="btn btn-sec" id="climaAtualizar">🔄 Atualizar</button>' +
      '<button class="btn btn-primario" id="climaFechar">Fechar</button></div>';
    UI.abrirFolha({
      titulo: data.charAt(0).toUpperCase() + data.slice(1),
      sub: 'Clima agora' + (lugar().cidade ? ' em ' + lugar().cidade : ''),
      html: html,
      montar: function () {
        var f = el('climaFechar'); if (f) f.onclick = UI.fecharFolha;
        var a = el('climaAtualizar');
        if (a) a.onclick = function () {
          a.disabled = true; a.textContent = 'Atualizando…';
          buscarClima(true).then(function () { abrirDetalhes(); });
        };
      }
    });
  }

  /* ---------------- barra encolhe ao rolar ----------------
     Rolando a tela para baixo somem a saudação e os botões e ficam só a data, a hora e o clima
     (sobra mais espaço para ler). Voltando ao começo, a barra aparece inteira de novo.
     A altura que some vira uma "margem" do mesmo tamanho, então a tela não dá pulo. */
  var compacto = false, medindo = false;
  var ENCOLHE_EM = 130, ABRE_EM = 36;
  function ajustarBarra() {
    medindo = false;
    var topo = el('topo');
    if (!topo) return;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (!compacto && y > ENCOLHE_EM) {
      var antes = topo.offsetHeight;
      topo.classList.add('compacto');
      topo.style.marginBottom = Math.max(0, antes - topo.offsetHeight) + 'px';
      compacto = true;
    } else if (compacto && y < ABRE_EM) {
      topo.classList.remove('compacto');
      topo.style.marginBottom = '';
      compacto = false;
    }
  }
  function aoRolar() {
    if (medindo) return;
    medindo = true;
    (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(ajustarBarra);
  }

  /* ---------------- início ---------------- */
  function iniciar() {
    clima = lerSalvo();
    tique();
    agendar();
    pintarClima();
    setTimeout(function () { buscarClima(false); }, 900);
    setInterval(function () { if (!document.hidden) buscarClima(false); }, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      tique(); agendar(); buscarClima(false);
    });
    window.addEventListener('online', function () { buscarClima(true); });
    window.addEventListener('offline', pintarClima);
    var caixa = el('topoTempo');
    if (caixa) caixa.onclick = abrirDetalhes;
    window.addEventListener('scroll', aoRolar, { passive: true });
  }

  window.IBNM.Topo = {
    iniciar: iniciar,
    tique: tique,
    buscarClima: buscarClima,
    climaAtual: function () { return clima; },
    TEMPO: TEMPO
  };
})();
