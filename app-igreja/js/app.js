/* ============================================================
   Inicialização, navegação e player da rádio
   ============================================================ */
(function () {
  var DB = window.IBNM.DB;
  var UI = window.IBNM.UI;
  var Views = window.IBNM.Views;
  var Auth = DB.Auth;
  var CFG = window.IBNM.CFG;

  var ROTAS = {
    inicio: function () { return Views.inicio(); },
    devocional: function () { return Views.devocional(); },
    agenda: function () { return Views.agenda(); },
    programacoes: function () { return Views.programacoes(); },
    palavra: function () { return Views.palavra(); },
    oferta: function () { return Views.oferta(); },
    oracao: function () { return Views.oracao(); },
    igreja: function () { return Views.igreja(); },
    mais: function () { return Views.mais(); },
    ajuda: function () { return Views.ajuda(); },
    entrar: function () { return Views.entrar(); },
    perfil: function () { return Views.perfil(); },
    admin: function () { return window.IBNM.Admin ? window.IBNM.Admin.tela() : { html: '' }; }
  };

  var App = {
    rotaAtual: 'inicio',
    instalou: null
  };

  /* ---------------- topo ---------------- */
  function atualizarTopo() {
    var saud = document.getElementById('saudacao');
    var ig = document.getElementById('topoIgreja');
    var nome = Auth.perfil ? UI.primeiroNome(Auth.perfil.nome) : '';
    if (saud) saud.textContent = UI.saudacao() + (nome ? ', ' + nome : '!');
    if (ig) ig.textContent = (Views.config().nome || CFG.NOME);
    document.title = (Views.config().sigla || CFG.SIGLA) + ' • ' + (Views.config().nome || CFG.NOME);
  }

  /* ---------------- navegação ---------------- */
  function ir(rota) {
    if (!rota) return;
    if (location.hash === rota) { render(); return; }
    location.hash = rota;
  }

  function rotaLimpa() {
    var h = (location.hash || '').replace(/^#\/?/, '').split('?')[0].split('/')[0];
    return ROTAS[h] ? h : 'inicio';
  }

  function render() {
    var rota = rotaLimpa();
    App.rotaAtual = rota;
    var tela = document.getElementById('tela');
    if (!tela) return;
    var v;
    try {
      v = ROTAS[rota]();
    } catch (e) {
      console.error(e);
      tela.innerHTML = '<div class="vazio"><span class="em">😕</span><b>Algo deu errado</b>Recarregue o app e tente de novo.</div>';
      return;
    }
    tela.innerHTML = v.html || '';
    if (typeof v.montar === 'function') {
      try { v.montar(tela); } catch (e) { console.error(e); }
    }
    atualizarMenu(rota);
    atualizarTopo();
    aplicarRadio();
    if (rota !== 'admin') window.scrollTo(0, 0);
    if (rota === 'mais') mostrarBannerInstalar();
    UI.animarEntrada(tela);
  }

  function atualizarMenu(rota) {
    var mapa = { inicio: 'inicio', devocional: 'devocional', agenda: 'agenda', programacoes: 'mais', palavra: 'mais', oferta: 'oferta', oracao: 'mais', igreja: 'mais', mais: 'mais', ajuda: 'mais', entrar: 'mais', perfil: 'mais', admin: 'mais' };
    var ativo = mapa[rota] || 'inicio';
    UI.$$('#menu button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-rota') === ativo);
    });
  }

  /* ---------------- rádio ---------------- */
  var radioEl = null;

  function cfgRadio() { return Views.config().radio || {}; }

  function aplicarRadio() {
    var r = cfgRadio();
    var barra = document.getElementById('radioBar');
    var btnTopo = document.getElementById('btnRadio');
    if (!barra) return;
    var ligada = !!r.ativa && !!r.url;
    if (btnTopo) btnTopo.hidden = !ligada;
    var fechada = sessionStorage.getItem('ibnm.radio.fechada') === '1';
    if (!ligada || fechada) { barra.hidden = true; return; }
    barra.hidden = false;
    var nome = document.getElementById('radioNome');
    var capa = document.getElementById('radioCapa');
    var st = document.getElementById('radioStatus');
    if (nome) nome.textContent = r.nome || 'Rádio da igreja';
    if (capa) {
      if (r.capa) { capa.src = r.capa; capa.hidden = false; } else { capa.hidden = true; }
    }
    if (st) st.innerHTML = (r.ao_vivo ? '<span class="ao-vivo"></span> Ao vivo agora' : (r.mensagem || 'Ouça a rádio da igreja'));
    var audio = document.getElementById('radioAudio');
    if (audio && audio.getAttribute('src') !== r.url) {
      audio.setAttribute('src', r.url);
      audio.pause();
    }
    atualizarBotaoRadio();
  }

  function atualizarBotaoRadio() {
    var audio = document.getElementById('radioAudio');
    var b = document.getElementById('radioPlay');
    if (!b) return;
    var tocando = audio && !audio.paused;
    b.innerHTML = tocando
      ? '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>';
    b.setAttribute('aria-label', tocando ? 'Pausar rádio' : 'Tocar rádio');
  }

  function tocarRadio(forcar) {
    var r = cfgRadio();
    if (!r.url) { UI.toast('A rádio ainda não está configurada.'); return; }
    if (!r.ativa && !forcar) { UI.toast('A rádio está desligada.'); return; }
    var audio = document.getElementById('radioAudio');
    if (!audio) return;
    if (audio.paused) {
      var p = audio.play();
      if (p && p.catch) p.catch(function () { UI.toast('Não foi possível tocar agora. Verifique sua internet.'); });
    } else {
      audio.pause();
    }
    setTimeout(atualizarBotaoRadio, 250);
  }

  /* ---------------- instalar no celular ---------------- */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    App.instalou = e;
    if (App.rotaAtual === 'mais') mostrarBannerInstalar();
  });

  function mostrarBannerInstalar() {
    if (!App.instalou) return;
    if (sessionStorage.getItem('ibnm.banner.fechado') === '1') return;
    if (document.getElementById('bannerInstalar')) return;
    var tela = document.getElementById('tela');
    if (!tela) return;
    var div = document.createElement('div');
    div.id = 'bannerInstalar';
    div.className = 'banner-instalar';
    div.innerHTML = '<div style="font-size:1.4rem">📲</div>' +
      '<div style="flex:1;min-width:0"><b>Instalar o app no celular</b>' +
      '<small>Fica com ícone na tela inicial, igual a um aplicativo.</small></div>' +
      '<button class="btn btn-dourado btn-pequeno" id="bInstalar">Instalar</button>' +
      '<button class="mini" id="bFechar" aria-label="Fechar">✕</button>';
    tela.appendChild(div);
    document.getElementById('bInstalar').onclick = function () {
      if (!App.instalou) return;
      App.instalou.prompt();
      App.instalou.userChoice.then(function () { App.instalou = null; div.remove(); });
    };
    document.getElementById('bFechar').onclick = function () {
      sessionStorage.setItem('ibnm.banner.fechado', '1');
      div.remove();
    };
  }

  /* ---------------- recarregar dados ---------------- */
  function recarregar() {
    Views.usarCache();
    return Views.carregarTudo().then(function () {
      render();
    });
  }

  /* ---------------- início ---------------- */
  function aplicarRedes() {
    var links = Views.config().links || {};
    var faixa = document.getElementById('faixaRedes');
    var ig = document.getElementById('linkInsta');
    var yt = document.getElementById('linkYoutube');
    if (!faixa || !ig || !yt) return;
    if (links.instagram) { ig.href = links.instagram; ig.hidden = false; } else { ig.hidden = true; }
    if (links.youtube) { yt.href = links.youtube; yt.hidden = false; } else { yt.hidden = true; }
    faixa.hidden = !(links.instagram || links.youtube);
  }

  function aplicarConfig() {
    atualizarTopo();
    aplicarRedes();
    aplicarRadio();
    if (document.getElementById('tela')) render();
  }

  function iniciar() {
    UI.aplicarFonte(UI.fonteAtual());
    Auth.carregarSessao();

    /* volta do login com Google */
    var retorno = Auth.tratarRetorno();
    if (retorno && retorno.ok === false) {
      setTimeout(function () { UI.toast(retorno.erro || 'Não foi possível entrar com o Google.'); }, 700);
    }

    /* primeira pintura com o que estiver salvo */
    Views.usarCache();
    atualizarTopo();
    aplicarRedes();
    render();

    var pronto = Auth.logado()
      ? DB.garantirPerfil().catch(function () { return null; }).then(function () { return Auth.renovar(false); })
      : Promise.resolve(null);

    pronto.then(function () {
      return Views.carregarTudo();
    }).then(function () {
      if (retorno && retorno.ok) UI.toast('Bem-vindo(a)! Você entrou com o Google.');
      render();
      atualizarTopo();
      aplicarRedes();
      aplicarRadio();
      estadoOffline(navigator.onLine === false);
    }).catch(function () {
      estadoOffline(true);
    });

    /* mantém a sessão viva */
    setInterval(function () { if (Auth.logado()) Auth.renovar(false); }, 4 * 60 * 1000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && Auth.logado()) Auth.renovar(false);
    });

    /* links internos */
    document.addEventListener('click', function (ev) {
      var alvo = ev.target.closest ? ev.target.closest('[data-ir]') : null;
      if (alvo) {
        ev.preventDefault();
        ir(alvo.getAttribute('data-ir'));
      }
    });

    /* menu inferior */
    UI.$$('#menu button').forEach(function (b) {
      b.onclick = function () { ir(b.getAttribute('data-rota')); };
    });

    var bFonte = document.getElementById('btnFonte');
    if (bFonte) bFonte.onclick = UI.escolherFonte;

    var bOfertar = document.getElementById('btnOfertar');
    if (bOfertar) bOfertar.onclick = function () { ir('#/oferta'); };

    var bRadioTopo = document.getElementById('btnRadio');
    if (bRadioTopo) bRadioTopo.onclick = function () { tocarRadio(true); };

    var play = document.getElementById('radioPlay');
    if (play) play.onclick = function () { tocarRadio(true); };

    var fecharRadio = document.getElementById('radioX');
    if (fecharRadio) fecharRadio.onclick = function () {
      sessionStorage.setItem('ibnm.radio.fechada', '1');
      var barra = document.getElementById('radioBar');
      if (barra) barra.hidden = true;
      var a = document.getElementById('radioAudio');
      if (a) a.pause();
    };

    window.addEventListener('online', function () { estadoOffline(false); recarregar(); });
    window.addEventListener('offline', function () { estadoOffline(true); });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register(CFG.PASTA_APP + 'sw.js', { scope: CFG.PASTA_APP }).catch(function () {});
      });
    }
  }

  function estadoOffline(sim) {
    var el = document.getElementById('offline');
    if (!el) return;
    el.hidden = !sim;
  }

  App.ir = ir;
  App.render = render;
  App.atualizarTopo = atualizarTopo;
  App.recarregar = recarregar;
  App.aplicarConfig = aplicarConfig;
  App.aplicarRadio = aplicarRadio;
  App.tocarRadio = tocarRadio;
  App.iniciar = iniciar;
  window.App = App;

  /* começa */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  window.addEventListener('hashchange', render);
})();
