/* ============================================================
   Telas do app (membro / visitante)
   ============================================================ */
(function () {
  var DB = window.IBNM.DB;
  var UI = window.IBNM.UI;
  var PIX = window.IBNM.PIX;
  var Auth = DB.Auth;

  var Estado = {
    config: null,
    devocionais: [],
    eventos: [],
    palavras: [],
    avisos: [],
    aniversariantes: [],
    pronto: false,
    offline: false
  };

  function config() { return Estado.config || {}; }
  function cfgPix() { return (config().pix) || {}; }
  function cfgOferta() { return (config().oferta) || {}; }
  function cfgRadio() { return (config().radio) || {}; }
  function cfgLinks() { return (config().links) || {}; }

  /* ============================================================
     CARREGAR DADOS (com cache para funcionar sem internet)
     ============================================================ */
  function carregarTudo() {
    var tarefas = [];

    tarefas.push(DB.Tabela.um('ibnm_config', { filtros: { chave: 'eq.igreja' } }).then(function (r) {
      if (r && r.valor) { Estado.config = r.valor; DB.Cache.guardar('config', r.valor); }
    }));

    tarefas.push(DB.Tabela.listar('ibnm_devocionais', { ordem: 'data.desc', limite: 40 }).then(function (r) {
      Estado.devocionais = r || [];
      DB.Cache.guardar('devocionais', Estado.devocionais);
    }));

    tarefas.push(DB.Tabela.listar('ibnm_eventos', { ordem: 'data.asc.nullslast', limite: 400 }).then(function (r) {
      Estado.eventos = r || [];
      DB.Cache.guardar('eventos', Estado.eventos);
    }));

    tarefas.push(DB.Tabela.listar('ibnm_palavras', { ordem: 'data.desc', limite: 40 }).then(function (r) {
      Estado.palavras = r || [];
      DB.Cache.guardar('palavras', Estado.palavras);
    }));

    tarefas.push(DB.Tabela.listar('ibnm_avisos', { ordem: 'criado_em.desc', limite: 20 }).then(function (r) {
      Estado.avisos = r || [];
      DB.Cache.guardar('avisos', Estado.avisos);
    }));

    if (Auth.logado()) {
      tarefas.push(DB.rpc('ibnm_aniversariantes', { p_mes: new Date().getMonth() + 1 }).then(function (r) {
        Estado.aniversariantes = r || [];
        DB.Cache.guardar('aniversariantes', Estado.aniversariantes);
      }).catch(function () {}));
    }

    return Promise.all(tarefas.map(function (p) { return p.catch(function () { return null; }); })).then(function () {
      Estado.pronto = true;
      Estado.offline = !Estado.config;
    }).catch(function () {
      Estado.offline = true;
    });
  }

  function usarCache() {
    var c = DB.Cache.pegar('config'); if (c) Estado.config = c.dados;
    var d = DB.Cache.pegar('devocionais'); if (d) Estado.devocionais = d.dados || [];
    var e = DB.Cache.pegar('eventos'); if (e) Estado.eventos = e.dados || [];
    var p = DB.Cache.pegar('palavras'); if (p) Estado.palavras = p.dados || [];
    var a = DB.Cache.pegar('avisos'); if (a) Estado.avisos = a.dados || [];
    var n = DB.Cache.pegar('aniversariantes'); if (n) Estado.aniversariantes = n.dados || [];
    Estado.pronto = true;
    Estado.offline = true;
  }

  /* ============================================================
     OCORRÊNCIAS DE EVENTOS (datas fixas + toda semana)
     ============================================================ */
  function ocorrencias(deISO, ateISO, lista) {
    var out = [];
    var de = UI.deISO(deISO), ate = UI.deISO(ateISO);
    (lista || Estado.eventos).forEach(function (ev) {
      if (ev.recorrente && ev.dia_semana !== null && ev.dia_semana !== undefined) {
        var d = new Date(de.getTime());
        while (d <= ate) {
          if (d.getDay() === Number(ev.dia_semana)) {
            out.push({ ev: ev, data: UI.iso(d), hora: ev.hora });
          }
          d.setDate(d.getDate() + 1);
        }
      } else if (ev.data) {
        var iso = String(ev.data).slice(0, 10);
        if (iso >= deISO && iso <= ateISO) out.push({ ev: ev, data: iso, hora: ev.hora });
      }
    });
    return ordenar(out);
  }

  function ordenar(lista) {
    return lista.slice().sort(function (a, b) {
      var x = a.data + (a.hora || '');
      var y = b.data + (b.hora || '');
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }

  function proximos(dias, quantos) {
    var hoje = UI.hojeISO();
    var fim = new Date(); fim.setDate(fim.getDate() + (dias || 45));
    var lista = ocorrencias(hoje, UI.iso(fim), Estado.eventos.filter(function (e) { return e.titulo; }));
    return lista.slice(0, quantos || 3);
  }

  function devocionalDeHoje() {
    var hoje = UI.hojeISO();
    var achou = Estado.devocionais.filter(function (d) { return String(d.data).slice(0, 10) === hoje; })[0];
    if (achou) return achou;
    var passados = Estado.devocionais.filter(function (d) { return String(d.data).slice(0, 10) <= hoje; });
    return passados[0] || Estado.devocionais[0] || null;
  }

  /* ============================================================
     COMPONENTES
     ============================================================ */
  function cartaoEvento(item, opcoes) {
    opcoes = opcoes || {};
    var ev = item.ev || item;
    var data = item.data || ev.data || '';
    var dc = UI.dataCurta(data);
    var hora = ev.hora ? UI.hora(ev.hora) : '';
    var cat = ev.categoria || 'programacao';
    var meta = [];
    if (hora) meta.push('🕘 ' + hora);
    if (ev.local) meta.push('📍 ' + ev.local);
    if (ev.recorrente) meta.push('🔁 toda semana');
    return '' +
      '<div class="evento" role="button" tabindex="0" data-evento="' + UI.esc(ev.id) + '" data-data="' + UI.esc(data) + '">' +
      '<div class="evento-data"><b>' + dc.dia + '</b><small>' + dc.mes + '</small></div>' +
      '<div class="evento-corpo">' +
      '<h4>' + UI.esc(ev.titulo || 'Evento') + '</h4>' +
      (ev.descricao && opcoes.comDescricao !== false ? '<p>' + UI.esc(ev.descricao) + '</p>' : '') +
      '<div class="evento-meta">' +
      '<span class="tag ' + cat + '">' + UI.catEm(cat) + ' ' + UI.esc(UI.catNome(cat)) + '</span>' +
      meta.map(function (m) { return '<span>' + UI.esc(m) + '</span>'; }).join('') +
      '</div></div>' +
      '<div class="evento-seta">›</div>' +
      '</div>';
  }

  function detalheEvento(id, data) {
    var ev = Estado.eventos.filter(function (e) { return String(e.id) === String(id); })[0];
    if (!ev) return;
    var quando = (UI.dataLonga(data || ev.data)) + (ev.hora ? ' às ' + UI.hora(ev.hora) : '');
    var html = '' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
      '<span class="tag ' + (ev.categoria || 'programacao') + '">' + UI.catEm(ev.categoria) + ' ' + UI.esc(UI.catNome(ev.categoria)) + '</span>' +
      (ev.recorrente ? '<span class="tag rec">🔁 toda semana</span>' : '') +
      '</div>' +
      '<div class="info-linha"><span class="ic">🗓️</span><div><b>Quando</b>' + UI.esc(UI.capitalizar(quando)) + '</div></div>' +
      (ev.local ? '<div class="info-linha"><span class="ic">📍</span><div><b>Onde</b>' + UI.esc(ev.local) + '</div></div>' : '') +
      (ev.descricao ? '<div class="prosa" style="margin-top:14px">' + UI.esc(ev.descricao) + '</div>' : '') +
      '<div class="folha-acoes" style="flex-wrap:wrap">' +
      '<button class="btn btn-sec" id="evIcs">📅 Adicionar na agenda do celular</button>' +
      '<button class="btn btn-fantasma" id="evComp">🔗 Compartilhar</button>' +
      '</div>';
    UI.abrirFolha({
      titulo: ev.titulo || 'Evento',
      sub: UI.dataLonga(data || ev.data),
      html: html,
      montar: function () {
        document.getElementById('evIcs').onclick = function () {
          UI.baixarICS({ id: ev.id, titulo: ev.titulo, descricao: ev.descricao, local: ev.local, data: data || ev.data, hora: ev.hora });
        };
        document.getElementById('evComp').onclick = function () {
          UI.compartilhar({
            titulo: ev.titulo,
            texto: ev.titulo + ' — ' + UI.dataLonga(data || ev.data) + (ev.hora ? ' às ' + UI.hora(ev.hora) : '') + (ev.local ? ' • ' + ev.local : ''),
            url: location.origin + location.pathname + '#/agenda'
          });
        };
      }
    });
  }

  function ligarEventos(raiz) {
    UI.$$('[data-evento]', raiz).forEach(function (el) {
      var abrir = function () { detalheEvento(el.getAttribute('data-evento'), el.getAttribute('data-data')); };
      el.addEventListener('click', abrir);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
    });
  }

  function vazio(emoji, titulo, texto) {
    return '<div class="vazio"><span class="em">' + emoji + '</span><b>' + UI.esc(titulo) + '</b>' + UI.esc(texto) + '</div>';
  }

  function enderecoCompleto() {
    var c = config();
    return [c.endereco, c.numero, c.bairro, c.cidade && (c.cidade + (c.uf ? '/' + c.uf : '')), c.cep ? 'CEP ' + c.cep : '']
      .filter(Boolean).join(', ');
  }

  /* ============================================================
     INÍCIO
     ============================================================ */
  function inicio() {
    var nome = Auth.perfil ? UI.primeiroNome(Auth.perfil.nome) : '';
    var saud = UI.saudacao() + (nome ? ', ' + UI.esc(nome) : '') + '!';
    var dev = devocionalDeHoje();
    var lista = proximos(45, 3);
    var avisos = Estado.avisos.slice(0, 3);
    var palavra = Estado.palavras[0];
    var radio = cfgRadio();
    var links = cfgLinks();
    var aniv = Estado.aniversariantes || [];

    var html = '';

    /* boas-vindas */
    html += '<section class="secao"><div class="card hero">' +
      '<div class="hero-emoji">⛪</div>' +
      '<h2>' + saud + '</h2>' +
      '<p>' + UI.esc(config().boas_vindas || 'Que bom ter você aqui! Acompanhe a vida da nossa igreja.') + '</p>' +
      (dev && dev.versiculo ? '<div class="hero-versiculo">“' + UI.esc(dev.versiculo) + '”<b>' + UI.esc(dev.referencia || '') + '</b></div>' : '') +
      (!Auth.logado() ? '<button class="btn btn-dourado btn-bloco mt14" id="heroEntrar">Entrar no app da igreja</button>' : '') +
      '</div></section>';

    /* atalhos */
    html += '<section class="secao"><div class="acoes">' +
      '<button class="acao" data-ir="#/devocional"><span class="acao-ic">📖</span><span>Devocional</span></button>' +
      '<button class="acao" data-ir="#/agenda"><span class="acao-ic">🗓️</span><span>Agenda</span></button>' +
      '<button class="acao" data-ir="#/palavra"><span class="acao-ic">💬</span><span>Palavra<br>pastoral</span></button>' +
      '<button class="acao destaque" data-ir="#/oferta"><span class="acao-ic">💚</span><span>Ofertar</span></button>' +
      '</div></section>';

    /* devocional do dia */
    html += '<section class="secao"><div class="sec-topo"><h3 class="sec-titulo">Devocional do dia</h3>' +
      '<button class="sec-link" data-ir="#/devocional">Ver todos</button></div>';
    if (dev) {
      html += '<div class="card card-clicavel" data-ir="#/devocional">' +
        '<span class="devocional-data">📖 ' + UI.esc(UI.dataBR(dev.data)) + '</span>' +
        '<h2 style="font-size:1.16rem;margin:10px 0 8px;line-height:1.32">' + UI.esc(dev.titulo || 'Devocional') + '</h2>' +
        (dev.versiculo ? '<div class="versiculo" style="margin:0">“' + UI.esc(dev.versiculo) + '”<b>' + UI.esc(dev.referencia || '') + '</b></div>' : '') +
        '<p class="prosa" style="margin:12px 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">' + UI.esc(dev.texto || '') + '</p>' +
        '<div class="mt10" style="color:var(--verde-2);font-weight:850;font-size:.84rem">Ler o devocional completo →</div>' +
        '</div>';
    } else {
      html += vazio('📖', 'Devocional em breve', 'Assim que o devocional do dia for publicado, ele aparece aqui.');
    }
    html += '</section>';

    /* próximos eventos */
    html += '<section class="secao"><div class="sec-topo"><h3 class="sec-titulo">Próximos encontros</h3>' +
      '<button class="sec-link" data-ir="#/agenda">Ver agenda</button></div>';
    if (lista.length) html += lista.map(function (i) { return cartaoEvento(i); }).join('');
    else html += vazio('🗓️', 'Nenhum evento marcado', 'As programações da igreja vão aparecer aqui.');
    html += '</section>';

    /* avisos */
    if (avisos.length) {
      html += '<section class="secao"><div class="sec-topo"><h3 class="sec-titulo">Avisos</h3></div>';
      html += avisos.map(function (a) {
        return '<div class="aviso ' + (a.urgencia === 'importante' ? 'urgente' : '') + '">' +
          '<span class="aviso-ic">' + (a.urgencia === 'importante' ? '📢' : '📌') + '</span>' +
          '<div><b>' + UI.esc(a.titulo) + '</b><p>' + UI.esc(a.texto) + '</p></div></div>';
      }).join('');
      html += '</section>';
    }

    /* palavra pastoral */
    if (palavra) {
      html += '<section class="secao"><div class="sec-topo"><h3 class="sec-titulo">Palavra pastoral</h3>' +
        '<button class="sec-link" data-ir="#/palavra">Ver todas</button></div>' +
        '<div class="card card-clicavel" data-palavra="' + UI.esc(palavra.id) + '">' +
        '<div class="palavra-card">' +
        (palavra.imagem ? '<img src="' + UI.esc(palavra.imagem) + '" alt="">' : '<div style="width:62px;height:62px;border-radius:14px;background:var(--verde-claro);display:grid;place-items:center;font-size:1.5rem;flex:none">📖</div>') +
        '<div><h4>' + UI.esc(palavra.titulo) + '</h4>' +
        '<p>' + UI.esc(palavra.resumo || String(palavra.texto || '').slice(0, 90) + '…') + '</p>' +
        '<small>' + UI.esc(palavra.autor || 'Pastor') + ' • ' + UI.esc(UI.dataBR(palavra.data)) + '</small></div>' +
        '</div></div></section>';
    }

    /* aniversariantes */
    if (aniv.length) {
      var mes = UI.MESES[new Date().getMonth()];
      html += '<section class="secao"><div class="sec-topo"><h3 class="sec-titulo">Aniversariantes de ' + mes + '</h3></div>' +
        '<div class="aniv">' + aniv.slice(0, 8).map(function (a) {
          return '<div class="aniv-item"><div class="aniv-dia">' + a.dia + '</div><div><b>' + UI.esc(UI.primeiroNome(a.nome)) + '</b><small>' + UI.esc(mes) + '</small></div></div>';
        }).join('') + '</div></section>';
    }

    /* redes e rádio */
    html += '<section class="secao"><div class="redes">';
    if (links.instagram) html += '<a class="rede ig" href="' + UI.esc(links.instagram) + '" target="_blank" rel="noopener">📸 Instagram</a>';
    if (links.youtube) html += '<a class="rede yt" href="' + UI.esc(links.youtube) + '" target="_blank" rel="noopener">▶️ YouTube</a>';
    html += '<button class="rede wa" data-ir="#/igreja">⛪ Nossa igreja</button>';
    html += '</div></section>';

    html += '<div class="rodape"><b>' + UI.esc(config().nome || 'Igreja Batista em Nova Metrópole') + '</b><br>' +
      UI.esc(enderecoCompleto() || 'Endereço no menu Nossa igreja') + '<br>Versão ' + window.IBNM.CFG.VERSAO + '</div>';

    return {
      html: html,
      montar: function (raiz) {
        ligarEventos(raiz);
        var he = document.getElementById('heroEntrar');
        if (he) he.onclick = function () { window.App.ir('#/entrar'); };
        UI.$$('[data-palavra]', raiz).forEach(function (el) {
          el.onclick = function () { abrirPalavra(el.getAttribute('data-palavra')); };
        });
      }
    };
  }

  /* ============================================================
     DEVOCIONAL
     ============================================================ */
  function devocional() {
    var dev = devocionalDeHoje();
    var html = '';
    if (!dev) {
      html = '<div class="detalhe-topo"><button class="voltar" data-ir="#/inicio">← Início</button></div>' +
        vazio('📖', 'Nenhum devocional publicado', 'O devocional do dia aparece aqui todas as manhãs.');
      return { html: html };
    }
    html += '<div class="detalhe-topo"><button class="voltar" data-ir="#/inicio">← Início</button>' +
      '<button class="voltar" id="devComp" style="margin-left:auto">🔗 Compartilhar</button></div>';
    html += '<article class="card devocional">' +
      '<span class="devocional-data">📖 ' + UI.esc(UI.dataLonga(dev.data)) + '</span>' +
      '<h1>' + UI.esc(dev.titulo || 'Devocional do dia') + '</h1>' +
      (dev.versiculo ? '<div class="versiculo">“' + UI.esc(dev.versiculo) + '”' + (dev.referencia ? '<b>' + UI.esc(dev.referencia) + '</b>' : '') + '</div>' : '') +
      '<div class="prosa">' + UI.esc(dev.texto || '') + '</div>' +
      (dev.autor ? '<div class="autor">✍️ ' + UI.esc(dev.autor) + '</div>' : '') +
      '</article>';

    var anteriores = Estado.devocionais.filter(function (d) { return String(d.id) !== String(dev.id); }).slice(0, 12);
    if (anteriores.length) {
      html += '<section class="secao mt20"><h3 class="sec-titulo mb10">Devocionais anteriores</h3>' +
        anteriores.map(function (d) {
          return '<div class="card card-clicavel" data-dev="' + UI.esc(d.id) + '" style="margin-bottom:8px">' +
            '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">' +
            '<div><b style="font-size:.9rem">' + UI.esc(d.titulo) + '</b>' +
            '<div class="small">' + UI.esc(UI.dataBR(d.data)) + (d.referencia ? ' • ' + UI.esc(d.referencia) : '') + '</div></div>' +
            '<span class="evento-seta">›</span></div></div>';
        }).join('') + '</section>';
    }

    return {
      html: html,
      montar: function (raiz) {
        document.getElementById('devComp').onclick = function () {
          UI.compartilhar({
            titulo: dev.titulo,
            texto: '📖 Devocional de hoje: ' + dev.titulo + (dev.versiculo ? ' — “' + dev.versiculo + '” ' + (dev.referencia || '') : ''),
            url: location.origin + location.pathname + '#/devocional'
          });
        };
        UI.$$('[data-dev]', raiz).forEach(function (el) {
          el.onclick = function () {
            var d = Estado.devocionais.filter(function (x) { return String(x.id) === String(el.getAttribute('data-dev')); })[0];
            if (!d) return;
            UI.abrirFolha({
              titulo: d.titulo,
              sub: UI.dataBR(d.data) + (d.referencia ? ' • ' + d.referencia : ''),
              html: (d.versiculo ? '<div class="versiculo">“' + UI.esc(d.versiculo) + '”<b>' + UI.esc(d.referencia || '') + '</b></div>' : '') +
                '<div class="prosa">' + UI.esc(d.texto) + '</div>' + (d.autor ? '<div class="autor">✍️ ' + UI.esc(d.autor) + '</div>' : '')
            });
          };
        });
      }
    };
  }

  /* ============================================================
     AGENDA
     ============================================================ */
  var Agenda = {
    aba: 'semana',
    ref: new Date()
  };

  function inicioDaSemana(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - x.getDay()); // começa no domingo
    return x;
  }

  function agenda() {
    var html = '<div class="agenda-abas">' +
      '<button data-aba="semana" class="' + (Agenda.aba === 'semana' ? 'on' : '') + '">📅 Semana</button>' +
      '<button data-aba="mes" class="' + (Agenda.aba === 'mes' ? 'on' : '') + '">🗓️ Mês</button>' +
      '</div>' +
      '<div id="agendaCorpo"></div>';

    return {
      html: html,
      montar: function (raiz) {
        UI.$$('[data-aba]', raiz).forEach(function (b) {
          b.onclick = function () {
            Agenda.aba = b.getAttribute('data-aba');
            if (Agenda.aba === 'mes') Agenda.ref = new Date();
            window.App.ir('#/agenda');
          };
        });
        desenharAgenda();
      }
    };
  }

  function desenharAgenda() {
    var corpo = document.getElementById('agendaCorpo');
    if (!corpo) return;
    if (Agenda.aba === 'mes') desenharMes(corpo);
    else desenharSemana(corpo);
  }

  function desenharSemana(corpo) {
    var ini = inicioDaSemana(Agenda.ref);
    var fim = new Date(ini.getTime()); fim.setDate(fim.getDate() + 6);
    var lista = ocorrencias(UI.iso(ini), UI.iso(fim));
    var hoje = UI.hojeISO();
    var html = '<div class="cal-topo"><b>' + ini.getDate() + ' a ' + fim.getDate() + ' de ' + UI.MESES[fim.getMonth()] + '</b>' +
      '<div class="cal-nav"><button data-nav="-1" aria-label="Semana anterior">‹</button><button data-nav="1" aria-label="Próxima semana">›</button></div></div>' +
      '<div class="card" style="padding:6px 14px">';
    for (var i = 0; i < 7; i++) {
      var d = new Date(ini.getTime()); d.setDate(d.getDate() + i);
      var iso = UI.iso(d);
      var itens = lista.filter(function (x) { return x.data === iso; });
      html += '<div class="semana-dia">' +
        '<div class="semana-nome ' + (iso === hoje ? 'hoje' : '') + '"><b>' + UI.DIAS_CURTOS[d.getDay()] + '</b><small>' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + (iso === hoje ? ' • hoje' : '') + '</small></div>' +
        '<div class="semana-itens">' +
        (itens.length ? itens.map(function (x) {
          return '<div class="semana-item" data-evento="' + UI.esc(x.ev.id) + '" data-data="' + iso + '">' +
            '<span class="h">' + (x.ev.hora ? UI.hora(x.ev.hora) : '—') + '</span>' +
            '<div style="min-width:0"><b>' + UI.esc(x.ev.titulo) + '</b>' +
            '<small>' + UI.catEm(x.ev.categoria) + ' ' + UI.esc(x.ev.local || UI.catNome(x.ev.categoria)) + '</small></div></div>';
        }).join('') : '<div class="semana-vazia">— sem programação</div>') +
        '</div></div>';
    }
    html += '</div>';
    if (!lista.length) {
      html += '<div class="mt14">' + vazio('🗓️', 'Semana sem eventos', 'Quando o administrador cadastrar as programações, elas aparecem aqui.') + '</div>';
    }
    html += '<div class="mt14 small txt-c">Toque em um evento para ver os detalhes e salvar no seu celular.</div>';
    corpo.innerHTML = html;
    ligarEventos(corpo);
    UI.$$('[data-nav]', corpo).forEach(function (b) {
      b.onclick = function () {
        Agenda.ref.setDate(Agenda.ref.getDate() + 7 * Number(b.getAttribute('data-nav')));
        desenharAgenda();
      };
    });
  }

  function desenharMes(corpo) {
    var ref = Agenda.ref;
    var primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
    var ultimo = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    var iniGrade = inicioDaSemana(primeiro);
    var fimGrade = new Date(inicioDaSemana(ultimo)); fimGrade.setDate(fimGrade.getDate() + 6);
    var lista = ocorrencias(UI.iso(primeiro), UI.iso(ultimo));
    var hoje = UI.hojeISO();

    var html = '<div class="cal-topo"><b>' + UI.MESES[ref.getMonth()] + ' de ' + ref.getFullYear() + '</b>' +
      '<div class="cal-nav"><button data-mes="-1" aria-label="Mês anterior">‹</button><button data-mes="1" aria-label="Próximo mês">›</button></div></div>' +
      '<div class="card"><div class="cal-grade">' +
      ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(function (d) { return '<div class="cal-cab">' + d + '</div>'; }).join('');
    var d = new Date(iniGrade.getTime());
    while (d <= fimGrade) {
      var iso = UI.iso(d);
      var doMes = d.getMonth() === ref.getMonth();
      var tem = lista.filter(function (x) { return x.data === iso; }).length;
      html += '<div class="cal-dia ' + (doMes ? '' : 'fora') + (tem ? ' tem' : '') + (iso === hoje ? ' hoje' : '') + '" ' +
        (tem ? 'data-dia="' + iso + '" role="button" tabindex="0"' : '') + '>' +
        d.getDate() + (tem ? '<span class="ponto"></span>' : '') + '</div>';
      d.setDate(d.getDate() + 1);
    }
    html += '</div><div class="cal-legenda"><span><i></i> dia com programação</span></div></div>';

    var seguintes = lista.filter(function (x) { return x.data >= hoje; }).slice(0, 6);
    if (seguintes.length) {
      html += '<section class="secao mt20"><h3 class="sec-titulo mb10">Programação do mês</h3>' +
        seguintes.map(function (i) { return cartaoEvento(i); }).join('') + '</section>';
    }

    corpo.innerHTML = html;
    ligarEventos(corpo);
    UI.$$('[data-mes]', corpo).forEach(function (b) {
      b.onclick = function () {
        Agenda.ref = new Date(ref.getFullYear(), ref.getMonth() + Number(b.getAttribute('data-mes')), 1);
        desenharAgenda();
      };
    });
    UI.$$('[data-dia]', corpo).forEach(function (el) {
      el.onclick = function () {
        var iso = el.getAttribute('data-dia');
        var itens = lista.filter(function (x) { return x.data === iso; });
        UI.abrirFolha({
          titulo: UI.capitalizar(UI.dataLonga(iso)),
          sub: itens.length + ' programação(ões)',
          html: itens.map(function (i) {
            return '<div class="evento" data-evento="' + UI.esc(i.ev.id) + '" data-data="' + iso + '" style="margin-bottom:8px">' +
              '<div class="evento-data"><b>' + (i.ev.hora ? UI.hora(i.ev.hora) : UI.catEm(i.ev.categoria)) + '</b><small>' + UI.esc(UI.catNome(i.ev.categoria)) + '</small></div>' +
              '<div class="evento-corpo"><h4>' + UI.esc(i.ev.titulo) + '</h4>' +
              (i.ev.local ? '<p>📍 ' + UI.esc(i.ev.local) + '</p>' : '') + '</div></div>';
          }).join(''),
          montar: function (raiz) {
            ligarEventos(raiz);
            UI.$$('[data-evento]', raiz).forEach(function (x) {
              x.addEventListener('click', function () { setTimeout(function () { detalheEvento(x.getAttribute('data-evento'), iso); }, 60); });
            });
          }
        });
      };
    });
  }

  /* ============================================================
     PROGRAMAÇÕES / ATIVIDADES
     ============================================================ */
  var Filtro = { cat: '' };

  function programacoes() {
    var cats = ['', 'culto', 'programacao', 'atividade', 'reuniao', 'especial'];
    var html = '<div class="detalhe-topo"><button class="voltar" data-ir="#/inicio">← Início</button></div>' +
      '<h2 style="font-size:1.2rem;margin:0 0 4px">Programações e atividades</h2>' +
      '<p class="small" style="margin:0 0 12px">Tudo o que acontece na nossa igreja.</p>' +
      '<div class="adm-abas" style="padding-bottom:6px">' +
      cats.map(function (c) {
        return '<button data-cat="' + c + '" class="' + (Filtro.cat === c ? 'on' : '') + '">' +
          (c ? UI.catEm(c) + ' ' + UI.catNome(c) : 'Todas') + '</button>';
      }).join('') + '</div><div id="progCorpo"></div>';
    return {
      html: html,
      montar: function (raiz) {
        UI.$$('[data-cat]', raiz).forEach(function (b) {
          b.onclick = function () {
            Filtro.cat = b.getAttribute('data-cat');
            window.App.ir('#/programacoes');
          };
        });
        desenharProgramacoes();
      }
    };
  }

  function desenharProgramacoes() {
    var corpo = document.getElementById('progCorpo');
    if (!corpo) return;
    var hoje = UI.hojeISO();
    var fim = new Date(); fim.setDate(fim.getDate() + 120);
    var lista = ocorrencias(hoje, UI.iso(fim)).filter(function (i) {
      return !Filtro.cat || i.ev.categoria === Filtro.cat;
    });
    if (!lista.length) {
      corpo.innerHTML = vazio('📅', 'Nada por aqui ainda', 'As programações cadastradas aparecem nesta lista.');
      return;
    }
    /* agrupa por semana */
    var grupos = {};
    lista.forEach(function (i) {
      var d = UI.deISO(i.data);
      var ini = inicioDaSemana(d);
      var k = UI.iso(ini);
      (grupos[k] = grupos[k] || []).push(i);
    });
    corpo.innerHTML = Object.keys(grupos).sort().map(function (k) {
      var d = UI.deISO(k);
      var fimS = new Date(d.getTime()); fimS.setDate(fimS.getDate() + 6);
      var titulo = k === UI.iso(inicioDaSemana(new Date())) ? 'Esta semana' :
        (d.getDate() + ' a ' + fimS.getDate() + ' de ' + UI.MESES[fimS.getMonth()]);
      return '<section class="secao"><h3 class="sec-titulo mb10">' + UI.esc(titulo) + '</h3>' +
        grupos[k].map(function (i) { return cartaoEvento(i, { comDescricao: false }); }).join('') + '</section>';
    }).join('');
    ligarEventos(corpo);
  }

  /* ============================================================
     PALAVRA PASTORAL
     ============================================================ */
  function abrirPalavra(id) {
    var p = Estado.palavras.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!p) return;
    UI.abrirFolha({
      titulo: p.titulo,
      sub: (p.autor || 'Pastor') + ' • ' + UI.dataBR(p.data),
      html: (p.imagem ? '<img src="' + UI.esc(p.imagem) + '" alt="" style="width:100%;border-radius:16px;margin-bottom:12px">' : '') +
        '<div class="prosa">' + UI.esc(p.texto) + '</div>' +
        '<div class="folha-acoes"><button class="btn btn-sec" id="palComp">🔗 Compartilhar</button></div>',
      montar: function () {
        document.getElementById('palComp').onclick = function () {
          UI.compartilhar({ titulo: p.titulo, texto: p.titulo + ' — ' + (p.autor || 'Pastor'), url: location.origin + location.pathname + '#/palavra' });
        };
      }
    });
  }

  function palavra() {
    var html = '<div class="detalhe-topo"><button class="voltar" data-ir="#/inicio">← Início</button></div>' +
      '<h2 style="font-size:1.2rem;margin:0 0 4px">Palavra pastoral</h2>' +
      '<p class="small" style="margin:0 0 14px">Mensagens do nosso pastor para você.</p>';
    if (!Estado.palavras.length) {
      html += vazio('💬', 'Nenhuma palavra publicada', 'As mensagens do pastor aparecem aqui.');
      return { html: html };
    }
    html += Estado.palavras.map(function (p) {
      return '<div class="card card-clicavel" data-palavra="' + UI.esc(p.id) + '" style="margin-bottom:9px">' +
        '<div class="palavra-card">' +
        (p.imagem ? '<img src="' + UI.esc(p.imagem) + '" alt="">' : '<div style="width:62px;height:62px;border-radius:14px;background:var(--verde-claro);display:grid;place-items:center;font-size:1.5rem;flex:none">📖</div>') +
        '<div style="min-width:0"><h4>' + UI.esc(p.titulo) + '</h4>' +
        '<p>' + UI.esc(p.resumo || String(p.texto || '').slice(0, 80) + '…') + '</p>' +
        '<small>' + UI.esc(p.autor || 'Pastor') + ' • ' + UI.esc(UI.dataBR(p.data)) + '</small></div>' +
        '</div></div>';
    }).join('');
    return {
      html: html,
      montar: function (raiz) {
        UI.$$('[data-palavra]', raiz).forEach(function (el) {
          el.onclick = function () { abrirPalavra(el.getAttribute('data-palavra')); };
        });
      }
    };
  }

  /* ============================================================
     OFERTA (PIX)
     ============================================================ */
  var Oferta = { valor: 0, tipo: '', registrada: null };

  function oferta() {
    var pix = cfgPix();
    var of = cfgOferta();
    if (of.ativa === false) {
      return {
        html: '<div class="detalhe-topo"><button class="voltar" data-ir="#/inicio">← Início</button></div>' +
          vazio('💚', 'Oferta indisponível', 'No momento a igreja não está recebendo ofertas pelo app.')
      };
    }
    var chaveOk = !!String(pix.chave || '').trim();
    var tipos = Array.isArray(of.tipos) && of.tipos.length ? of.tipos : ['Dízimo', 'Oferta', 'Missões', 'Outro'];
    if (!Oferta.tipo) Oferta.tipo = tipos[0];

    var html = '<div class="detalhe-topo"><button class="voltar" data-ir="#/inicio">← Início</button>' +
      '<button class="voltar" id="ofAjuda" style="margin-left:auto">❓ Como ofertar</button></div>' +
      '<div class="card" style="background:linear-gradient(150deg,#0b4a3a,#0f6b50);color:#fff;border:0">' +
      '<div style="font-size:1.6rem">💚</div>' +
      '<h2 style="margin:6px 0 4px;font-size:1.18rem">Ofertar pelo app</h2>' +
      '<p style="margin:0;font-size:.86rem;color:rgba(255,255,255,.86)">' + UI.esc(of.texto || pix.mensagem || 'Sua oferta ajuda a igreja a levar o evangelho e cuidar de pessoas.') + '</p>' +
      '</div>';

    if (!chaveOk) {
      html += '<div class="card mt14"><b>Chave PIX ainda não cadastrada</b>' +
        '<p class="small mt6">Peça ao administrador da igreja para cadastrar a chave PIX no painel do app. Enquanto isso, fale com a tesouraria.</p></div>';
      return { html: html };
    }

    /* valor e tipo */
    html += '<section class="secao mt14"><h3 class="sec-titulo mb10">1. Escolha o valor</h3><div class="card">' +
      '<div class="valores">' +
      [10, 20, 50, 100, 200, 0].map(function (v) {
        return v === 0
          ? '<button class="valor-chip ' + (Oferta.valor === 0 ? 'on' : '') + '" data-valor="0">Outro</button>'
          : '<button class="valor-chip ' + (Oferta.valor === v ? 'on' : '') + '" data-valor="' + v + '">' + UI.money(v).replace(',00', '') + '</button>';
      }).join('') + '</div>' +
      '<div class="linha" style="align-items:flex-end">' +
      '<div class="campo" style="flex:1;margin:0"><label>Valor (R$)</label>' +
      '<input id="ofValor" inputmode="decimal" placeholder="0,00" value="' + (Oferta.valor ? String(Oferta.valor).replace('.', ',') : '') + '"></div>' +
      (tipos.length > 1 ? '<div class="campo" style="flex:1;margin:0"><label>Tipo</label><select id="ofTipo">' +
        tipos.map(function (t) { return '<option ' + (Oferta.tipo === t ? 'selected' : '') + '>' + UI.esc(t) + '</option>'; }).join('') + '</select></div>' : '') +
      '</div></div></section>';

    /* pix */
    html += '<section class="secao"><h3 class="sec-titulo mb10">2. Pague com PIX</h3>' +
      '<div class="card pix-card">' +
      '<div class="pix-qr" id="pixQr"></div>' +
      '<p class="small" style="margin:0 0 10px">Abra o app do seu banco, escolha <b>PIX</b> e aponte a câmera para o código.</p>' +
      '<button class="btn btn-dourado btn-bloco" id="ofCopiar">📋 Copiar código PIX</button>' +
      '<div class="mt14"><div class="small mb6" style="font-weight:800;color:var(--muted)">Chave PIX da igreja</div>' +
      '<div class="pix-chave" id="pixChave">' + UI.esc(PIX.bonita(pix.chave, pix.tipo)) + '</div></div>' +
      '</div></section>';

    /* registrar oferta */
    html += '<section class="secao"><h3 class="sec-titulo mb10">3. Registre sua oferta</h3><div class="card">' +
      '<p class="small" style="margin:0 0 10px">Registrar ajuda a tesouraria a identificar seu depósito. É rápido e opcional.</p>';
    if (Auth.logado()) {
      html += '<button class="btn btn-primario btn-bloco" id="ofRegistrar">✅ Já ofertei — registrar</button>' +
        '<div class="mt10"><label class="rotulo" style="font-size:.78rem;font-weight:800">Comprovante (opcional)</label>' +
        '<input type="file" id="ofComprovante" accept="image/*,application/pdf" style="width:100%;font-size:.82rem;padding:9px;border:1px dashed #cfe0d6;border-radius:12px;background:#f9fcfb">' +
        '<div class="dica" style="font-size:.73rem;color:var(--muted);margin-top:4px">Foto ou PDF do comprovante do banco.</div></div>';
    } else {
      html += '<button class="btn btn-sec btn-bloco" data-ir="#/entrar">Entrar para registrar minha oferta</button>';
    }
    html += '</div></section>';

    /* histórico */
    if (Auth.logado()) {
      html += '<section class="secao"><h3 class="sec-titulo mb10">Minhas ofertas</h3><div class="card" id="minhasOfertas">' +
        '<div class="small">Carregando…</div></div></section>';
    }

    return {
      html: html,
      montar: function () {
        atualizarPix();
        UI.$$('[data-valor]').forEach(function (b) {
          b.onclick = function () {
            var v = Number(b.getAttribute('data-valor'));
            Oferta.valor = v;
            var inp = document.getElementById('ofValor');
            if (inp && v > 0) inp.value = String(v).replace('.', ',');
            if (v === 0 && inp) { inp.value = ''; setTimeout(function () { inp.focus(); }, 60); }
            UI.$$('[data-valor]').forEach(function (x) { x.classList.toggle('on', x === b); });
            atualizarPix();
          };
        });
        var inp = document.getElementById('ofValor');
        if (inp) inp.addEventListener('input', function () {
          Oferta.valor = UI.numero(inp.value);
          UI.$$('[data-valor]').forEach(function (x) { x.classList.toggle('on', Number(x.getAttribute('data-valor')) === Oferta.valor && Oferta.valor > 0); });
          atualizarPix();
        });
        var sel = document.getElementById('ofTipo');
        if (sel) sel.onchange = function () { Oferta.tipo = sel.value; };

        document.getElementById('ofCopiar').onclick = function () {
          var p = montarPixPayload();
          if (!p) return UI.toast('Cadastre a chave PIX primeiro.');
          UI.copiar(p, 'Código PIX copiado! Cole no seu banco.');
        };
        document.getElementById('ofAjuda').onclick = comoOfertar;

        var reg = document.getElementById('ofRegistrar');
        if (reg) reg.onclick = registrarOferta;
        if (Auth.logado()) carregarMinhasOfertas();
      }
    };
  }

  function montarPixPayload() {
    var pix = cfgPix();
    return PIX.montarPayload({
      chave: pix.chave,
      tipo: pix.tipo,
      nome: pix.nome || config().nome,
      cidade: pix.cidade || config().cidade,
      valor: Oferta.valor,
      descricao: pix.descricao || '',
      txid: 'IBNM' + (Auth.perfil ? String(Auth.perfil.id).replace(/-/g, '').slice(0, 12) : '')
    });
  }

  function atualizarPix() {
    var alvo = document.getElementById('pixQr');
    if (!alvo) return;
    var payload = montarPixPayload();
    var svg = PIX.qrSvg(payload, { nivel: 'M' });
    alvo.innerHTML = svg || '<div class="small" style="padding:30px 10px">Não foi possível gerar o QR Code.<br>Use o botão "Copiar código PIX".</div>';
  }

  function comoOfertar() {
    UI.abrirFolha({
      titulo: 'Como ofertar pelo app',
      sub: 'Em 3 passos simples',
      html: '<ol class="passos-oferta">' +
        '<li>Escolha o valor e o tipo da oferta nesta tela.</li>' +
        '<li>Abra o app do seu banco, toque em <b>PIX</b> e escolha <b>Ler QR Code</b> (ou <b>PIX copia e cola</b> e cole o código copiado aqui no app).</li>' +
        '<li>Confirme o pagamento no banco. Se quiser, volte aqui e toque em <b>Já ofertei — registrar</b> e envie o comprovante.</li>' +
        '</ol>' +
        '<div class="adm-aviso mt14">💡 O dinheiro vai direto para a conta da igreja. O app não guarda dados do seu cartão nem do seu banco.</div>'
    });
  }

  function registrarOferta() {
    var valor = Oferta.valor || UI.numero((document.getElementById('ofValor') || {}).value);
    if (!valor || valor <= 0) return UI.toast('Informe o valor da sua oferta.');
    var tipo = Oferta.tipo || 'Oferta';
    var botao = document.getElementById('ofRegistrar');
    if (botao) { botao.disabled = true; botao.textContent = 'Registrando…'; }
    DB.Tabela.inserir('ibnm_ofertas', {
      nome: (Auth.perfil && Auth.perfil.nome) || (Auth.usuario() || {}).email || '',
      valor: valor,
      tipo: tipo,
      status: 'pendente'
    }).then(function (of) {
      UI.toast('Oferta registrada. Deus abençoe! 💚');
      if (botao) { botao.disabled = false; botao.textContent = '✅ Já ofertei — registrar'; }
      carregarMinhasOfertas();
      var arq = (document.getElementById('ofComprovante') || {}).files;
      var arquivo = arq && arq[0];
      if (!arquivo || !of) return null;
      var ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase();
      var caminho = 'comprovantes/' + Auth.usuario().id + '/' + Date.now() + '.' + ext;
      return DB.Arquivos.enviar('igreja', caminho, arquivo).then(function () {
        return DB.Tabela.atualizar('ibnm_ofertas', { id: 'eq.' + of.id }, { comprovante_url: caminho });
      }).then(function () {
        UI.toast('Comprovante enviado. Obrigado!');
        carregarMinhasOfertas();
      }).catch(function () {
        UI.toast('Oferta registrada, mas o comprovante não subiu. Tente de novo depois.');
      });
    }).catch(function (e) {
      UI.toast(e.message || 'Não foi possível registrar agora.');
      if (botao) { botao.disabled = false; botao.textContent = '✅ Já ofertei — registrar'; }
    });
  }

  function carregarMinhasOfertas() {
    var alvo = document.getElementById('minhasOfertas');
    if (!alvo || !Auth.usuario()) return;
    DB.Tabela.listar('ibnm_ofertas', {
      filtros: { user_id: 'eq.' + Auth.usuario().id },
      ordem: 'criado_em.desc', limite: 12
    }).then(function (lista) {
      if (!lista.length) {
        alvo.innerHTML = '<div class="small">Você ainda não registrou ofertas por aqui.</div>';
        return;
      }
      alvo.innerHTML = '<div class="lista-minha">' + lista.map(function (o) {
        var d = new Date(o.criado_em);
        return '<div class="item"><div><b>' + UI.esc(o.tipo) + '</b>' +
          '<div class="small">' + d.toLocaleDateString('pt-BR') + (o.comprovante_url ? ' • 📎 comprovante' : '') + '</div></div>' +
          '<div style="text-align:right"><b>' + UI.money(o.valor) + '</b><br>' +
          '<span class="status-pill ' + o.status + '">' + (o.status === 'confirmado' ? 'confirmado' : 'aguardando') + '</span></div></div>';
      }).join('') + '</div>';
    }).catch(function () {
      alvo.innerHTML = '<div class="small">Não foi possível carregar suas ofertas agora.</div>';
    });
  }

  /* ============================================================
     ORAÇÃO
     ============================================================ */
  function oracao() {
    var html = '<div class="detalhe-topo"><button class="voltar" data-ir="#/inicio">← Início</button></div>' +
      '<div class="card" style="background:linear-gradient(150deg,#0b4a3a,#0f6b50);color:#fff;border:0">' +
      '<div style="font-size:1.6rem">🙏</div>' +
      '<h2 style="margin:6px 0 4px;font-size:1.18rem">Podemos orar com você?</h2>' +
      '<p style="margin:0;font-size:.86rem;color:rgba(255,255,255,.86)">Escreva o seu pedido. Nossa equipe de intercessão vai orar por você.</p>' +
      '</div>';

    if (!Auth.logado()) {
      html += '<div class="card mt14 txt-c"><b>Entre para enviar seu pedido</b>' +
        '<p class="small mt6">Assim conseguimos acompanhar e guardar o seu pedido com cuidado.</p>' +
        '<button class="btn btn-primario btn-bloco mt10" data-ir="#/entrar">Entrar ou criar conta</button></div>';
      return { html: html };
    }

    html += '<section class="secao mt14"><div class="card">' +
      '<div class="campo"><label>Seu pedido de oração</label>' +
      '<textarea id="orTexto" placeholder="Escreva aqui com as suas palavras…" style="min-height:130px"></textarea></div>' +
      '<label class="checkline"><input type="checkbox" id="orPrivado" checked> Manter em sigilo (só o pastor e a equipe veem)</label>' +
      '<button class="btn btn-primario btn-bloco" id="orEnviar">🙏 Enviar pedido</button>' +
      '<div id="orMsg"></div></div></section>' +
      '<section class="secao"><h3 class="sec-titulo mb10">Meus pedidos</h3><div id="orLista"><div class="small">Carregando…</div></div></section>';

    return {
      html: html,
      montar: function () {
        document.getElementById('orEnviar').onclick = function () {
          var txt = document.getElementById('orTexto').value.trim();
          var priv = document.getElementById('orPrivado').checked;
          var msg = document.getElementById('orMsg');
          if (txt.length < 5) { msg.innerHTML = '<div class="msg-erro">Escreva um pouco mais sobre o seu pedido.</div>'; return; }
          var b = this; b.disabled = true; b.textContent = 'Enviando…';
          DB.Tabela.inserir('ibnm_oracoes', {
            nome: (Auth.perfil && Auth.perfil.nome) || '',
            pedido: txt,
            privado: priv
          }).then(function () {
            msg.innerHTML = '<div class="msg-ok">Recebemos seu pedido. Estamos orando por você! 🙏</div>';
            document.getElementById('orTexto').value = '';
            b.disabled = false; b.textContent = '🙏 Enviar pedido';
            carregarOracoes();
          }).catch(function (e) {
            msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
            b.disabled = false; b.textContent = '🙏 Enviar pedido';
          });
        };
        carregarOracoes();
      }
    };
  }

  function carregarOracoes() {
    var alvo = document.getElementById('orLista');
    if (!alvo || !Auth.usuario()) return;
    DB.Tabela.listar('ibnm_oracoes', {
      filtros: { user_id: 'eq.' + Auth.usuario().id },
      ordem: 'criado_em.desc', limite: 30
    }).then(function (lista) {
      if (!lista.length) { alvo.innerHTML = vazio('🙏', 'Nenhum pedido ainda', 'Quando você enviar um pedido, ele aparece aqui.'); return; }
      alvo.innerHTML = lista.map(function (o) {
        var d = new Date(o.criado_em);
        return '<div class="oracao-item"><p>' + UI.esc(o.pedido) + '</p>' +
          '<small>' + d.toLocaleDateString('pt-BR') + ' • ' + (o.privado ? '🔒 em sigilo' : '👥 compartilhado') +
          ' • <b style="color:' + (o.status === 'atendido' ? 'var(--ok)' : 'var(--aviso)') + '">' + (o.status === 'atendido' ? 'atendido' : 'orando') + '</b></small>' +
          (o.resposta ? '<div class="oracao-resposta">💬 ' + UI.esc(o.resposta) + '</div>' : '') +
          '</div>';
      }).join('');
    }).catch(function () { alvo.innerHTML = '<div class="small">Não foi possível carregar seus pedidos agora.</div>'; });
  }

  /* ============================================================
     NOSSA IGREJA
     ============================================================ */
  function igreja() {
    var c = config();
    var links = cfgLinks();
    var horarios = Array.isArray(c.horarios) ? c.horarios : [];
    var endereco = enderecoCompleto();
    var mapa = links.maps || (endereco ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(endereco) : '');
    var wpp = String(c.whatsapp || '').replace(/\D/g, '');

    var html = '<div class="detalhe-topo"><button class="voltar" data-ir="#/inicio">← Início</button></div>' +
      '<div class="igreja-capa">' +
      '<h2>' + UI.esc(c.nome || 'Igreja Batista em Nova Metrópole') + '</h2>' +
      '<p>' + (c.pastor ? 'Pastor ' + UI.esc(c.pastor) : 'Uma igreja que ama pessoas') + '</p>' +
      '</div>';

    html += '<section class="secao mt14"><div class="card">';
    if (endereco) {
      html += '<div class="info-linha"><span class="ic">📍</span><div><b>Endereço</b>' + UI.esc(endereco) + '</div></div>';
    }
    if (c.telefone) html += '<div class="info-linha"><span class="ic">☎️</span><div><b>Telefone</b><a href="tel:' + UI.esc(String(c.telefone).replace(/[^\d+]/g, '')) + '">' + UI.esc(c.telefone) + '</a></div></div>';
    if (c.email) html += '<div class="info-linha"><span class="ic">✉️</span><div><b>E-mail</b><a href="mailto:' + UI.esc(c.email) + '">' + UI.esc(c.email) + '</a></div></div>';
    if (wpp) html += '<div class="info-linha"><span class="ic">💬</span><div><b>WhatsApp</b><a href="https://wa.me/55' + UI.esc(wpp.replace(/^55/, '')) + '" target="_blank" rel="noopener">Falar com a igreja</a></div></div>';
    if (mapa) html += '<div class="mt14"><a class="btn btn-sec btn-bloco" href="' + UI.esc(mapa) + '" target="_blank" rel="noopener">🗺️ Abrir no mapa</a></div>';
    html += '</div></section>';

    if (horarios.length) {
      html += '<section class="secao"><h3 class="sec-titulo mb10">Horários dos cultos</h3><div class="card">' +
        horarios.map(function (h) {
          return '<div class="horario"><b>' + UI.esc(h.dia) + ' — ' + UI.esc(h.titulo) + '</b><span>' + UI.esc(h.hora) + '</span></div>';
        }).join('') + '</div></section>';
    }

    html += '<section class="secao"><h3 class="sec-titulo mb10">Redes sociais</h3><div class="redes">' +
      (links.instagram ? '<a class="rede ig" href="' + UI.esc(links.instagram) + '" target="_blank" rel="noopener">📸 Instagram</a>' : '') +
      (links.youtube ? '<a class="rede yt" href="' + UI.esc(links.youtube) + '" target="_blank" rel="noopener">▶️ YouTube</a>' : '') +
      (links.facebook ? '<a class="rede" href="' + UI.esc(links.facebook) + '" target="_blank" rel="noopener">📘 Facebook</a>' : '') +
      (links.site ? '<a class="rede" href="' + UI.esc(links.site) + '" target="_blank" rel="noopener">🌐 Site</a>' : '') +
      '</div>' +
      (!links.instagram && !links.youtube ? '<div class="small mt10">Os links do Instagram e YouTube aparecem aqui quando o administrador cadastrar.</div>' : '') +
      '</section>';

    html += '<section class="secao"><div class="card"><b>Nossa missão</b>' +
      '<p class="small mt6" style="line-height:1.6">Amar a Deus sobre todas as coisas, amar ao próximo como a nós mesmos e fazer discípulos de Jesus Cristo, servindo a nossa comunidade em Nova Metrópole.</p></div></section>';

    return { html: html };
  }

  /* ============================================================
     MAIS
     ============================================================ */
  function mais() {
    var radio = cfgRadio();
    var adm = Auth.ehAdm();
    var itens = [];

    itens.push({ ic: '📅', t: 'Programações e atividades', s: 'Cultos, reuniões e encontros', ir: '#/programacoes' });
    itens.push({ ic: '💬', t: 'Palavra pastoral', s: 'Mensagens do pastor', ir: '#/palavra' });
    itens.push({ ic: '🙏', t: 'Pedido de oração', s: 'Estamos aqui para orar com você', ir: '#/oracao' });
    itens.push({ ic: '⛪', t: 'Nossa igreja', s: 'Endereço, horários e contatos', ir: '#/igreja' });
    if (radio.ativa) itens.push({ ic: '📻', t: radio.nome || 'Rádio da igreja', s: 'Ouça agora', acao: 'radio' });
    itens.push({ ic: '🔠', t: 'Tamanho da letra', s: 'Deixe o app mais confortável', acao: 'fonte' });
    itens.push({ ic: '❓', t: 'Como usar o app', s: 'Ajuda rápida e simples', ir: '#/ajuda' });
    if (Auth.logado()) itens.push({ ic: '👤', t: 'Meu perfil', s: 'Seus dados e senha', ir: '#/perfil' });
    else itens.push({ ic: '🔑', t: 'Entrar ou criar conta', s: 'Acesse todos os recursos', ir: '#/entrar' });
    if (adm) itens.push({ ic: '🛠️', t: 'Painel do administrador', s: 'Editar tudo no app', ir: '#/admin', destaque: true });

    var html = '<div class="detalhe-topo"><button class="voltar" data-ir="#/inicio">← Início</button></div>' +
      '<h2 style="font-size:1.2rem;margin:0 0 12px">Mais</h2><div class="menu-lista">' +
      itens.map(function (i) {
        return '<button class="menu-item" ' + (i.ir ? 'data-ir="' + i.ir + '"' : 'data-acao="' + i.acao + '"') + '>' +
          '<span class="ic">' + i.ic + '</span><span class="tx"><b>' + i.t + '</b><small>' + i.s + '</small></span>' +
          '<span class="seta">›</span></button>';
      }).join('') + '</div>' +
      '<div class="rodape">' + UI.esc(config().nome || 'IBNM') + '<br>Versão ' + window.IBNM.CFG.VERSAO + ' • feito com carinho</div>';

    return {
      html: html,
      montar: function (raiz) {
        UI.$$('[data-acao]', raiz).forEach(function (b) {
          b.onclick = function () {
            var a = b.getAttribute('data-acao');
            if (a === 'fonte') UI.escolherFonte();
            if (a === 'radio' && window.App) window.App.tocarRadio(true);
          };
        });
      }
    };
  }

  /* ============================================================
     AJUDA
     ============================================================ */
  function ajuda() {
    var html = '<div class="detalhe-topo"><button class="voltar" data-ir="#/mais">← Voltar</button></div>' +
      '<h2 style="font-size:1.2rem;margin:0 0 12px">Como usar o app</h2>' +
      '<div class="card"><div class="prosa" style="font-size:.9rem">' +
      '<p><b>1. Entre com seu e-mail ou com o Google.</b><br>Toque em <b>Mais › Entrar ou criar conta</b>. Se for a primeira vez, toque em <b>Criar conta</b> e preencha seus dados.</p>' +
      '<p><b>2. Ajuste o tamanho da letra.</b><br>Toque na letra <b>A</b> no topo da tela ou em <b>Mais › Tamanho da letra</b>. Escolha o que for mais confortável.</p>' +
      '<p><b>3. Veja a agenda.</b><br>Toque em <b>Agenda</b> e escolha entre <b>Semana</b> e <b>Mês</b>. Toque em um evento para ver os detalhes.</p>' +
      '<p><b>4. Oferte pelo app.</b><br>Toque em <b>Ofertar</b>, escolha o valor, abra o app do seu banco e use o <b>QR Code</b> ou o <b>código PIX</b> (botão copiar).</p>' +
      '<p><b>5. Instale na tela inicial.</b><br>No Chrome, toque nos três pontinhos <b>⋮</b> e escolha <b>Adicionar à tela inicial</b>. O app fica com ícone como os outros.</p>' +
      '</div></div>' +
      '<div class="card mt14"><b>Precisa de ajuda?</b><p class="small mt6">Fale com a secretaria da igreja' +
      (config().whatsapp ? ' pelo WhatsApp ' + UI.esc(config().whatsapp) : '') + '.</p></div>';
    return { html: html };
  }

  /* ============================================================
     LOGIN / CADASTRO
     ============================================================ */
  var LoginAba = 'entrar';

  function entrar() {
    if (Auth.logado()) {
      window.App.ir('#/perfil');
      return { html: '' };
    }
    var html = '<div class="login-tela">' +
      '<div class="login-capa">' +
      '<img src="icons/icon-192.png" alt="IBNM">' +
      '<h1>' + UI.esc(config().nome || 'Igreja Batista em Nova Metrópole') + '</h1>' +
      '<p>Acesse para acompanhar a vida da igreja</p>' +
      '</div>' +
      '<div class="card">' +
      '<div class="abas">' +
      '<button data-aba="entrar" class="' + (LoginAba === 'entrar' ? 'on' : '') + '">Entrar</button>' +
      '<button data-aba="criar" class="' + (LoginAba === 'criar' ? 'on' : '') + '">Criar conta</button>' +
      '</div>';

    if (LoginAba === 'entrar') {
      html += '<div class="campo"><label>E-mail</label><input id="lEmail" type="email" autocomplete="email" placeholder="seuemail@exemplo.com" inputmode="email"></div>' +
        '<div class="campo"><label>Senha</label><input id="lSenha" type="password" autocomplete="current-password" placeholder="Sua senha"></div>' +
        '<button class="btn btn-primario btn-bloco" id="lEntrar">Entrar</button>' +
        '<div class="txt-c mt6"><button class="link-fino" id="lEsqueci">Esqueci minha senha</button></div>' +
        '<div class="ou">ou</div>' +
        '<button class="btn-google" id="lGoogle">' +
        '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.8 6.1C12.2 13.2 17.6 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-2.8-.4-4.1H24v8.3h12.6c-.3 2.1-1.7 5.2-4.8 7.3l7.6 5.9c4.5-4.2 6.7-10.3 6.7-17.4Z"/><path fill="#FBBC05" d="M10.3 28.7a14.6 14.6 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1Z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.4-5.6l-7.6-5.9c-2.1 1.4-4.8 2.4-7.8 2.4-6.4 0-11.8-3.7-13.7-9.3l-7.8 6.1C6.4 42.6 14.6 48 24 48Z"/></svg>' +
        'Entrar com Google</button>' +
        '<div class="small txt-c mt10">Primeira vez? Toque em <b>Criar conta</b> acima.</div>';
    } else {
      html += '<div class="campo"><label>Nome completo *</label><input id="cNome" autocomplete="name" placeholder="Como quer ser chamado(a)"></div>' +
        '<div class="campo"><label>E-mail *</label><input id="cEmail" type="email" autocomplete="email" placeholder="seuemail@exemplo.com" inputmode="email"></div>' +
        '<div class="linha"><div class="campo"><label>Data de nascimento</label><input id="cNasc" type="date"></div>' +
        '<div class="campo"><label>WhatsApp</label><input id="cTel" type="tel" inputmode="tel" autocomplete="tel" placeholder="(85) 99999-9999"></div></div>' +
        '<div class="linha"><div class="campo curto"><label>CEP</label><input id="cCep" inputmode="numeric" maxlength="9" placeholder="00000-000"></div>' +
        '<div class="campo" style="flex:3"><label>Endereço</label><input id="cEnd" placeholder="Rua, avenida…"></div></div>' +
        '<div class="linha"><div class="campo curto"><label>Número</label><input id="cNum" inputmode="numeric"></div>' +
        '<div class="campo"><label>Bairro</label><input id="cBairro"></div></div>' +
        '<div class="campo"><label>Cidade/UF</label><input id="cCidade" placeholder="Caucaia/CE"></div>' +
        '<div class="campo"><label>Senha *</label><input id="cSenha" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres"></div>' +
        '<div class="campo"><label>Repita a senha *</label><input id="cSenha2" type="password" autocomplete="new-password"></div>' +
        '<label class="checkline"><input type="checkbox" id="cMostrarSenha"> Mostrar a senha</label>' +
        '<button class="btn btn-primario btn-bloco" id="cCriar">Criar minha conta</button>' +
        '<div class="small txt-c mt10">Já tem conta? Toque em <b>Entrar</b> acima.</div>';
    }

    html += '<div id="lMsg"></div>' +
      '</div>' +
      '<div class="txt-c mt14"><button class="link-fino" data-ir="#/inicio">Continuar sem entrar (ver igreja)</button></div>' +
      '</div>';

    return {
      html: html,
      montar: function (raiz) {
        UI.$$('[data-aba]', raiz).forEach(function (b) {
          b.onclick = function () { LoginAba = b.getAttribute('data-aba'); window.App.ir('#/entrar'); };
        });
        var msg = document.getElementById('lMsg');
        var avisar = function (t, ok) {
          if (!msg) return;
          msg.innerHTML = '<div class="' + (ok ? 'msg-ok' : 'msg-erro') + '">' + UI.esc(t) + '</div>';
        };

        var g = document.getElementById('lGoogle');
        if (g) g.onclick = function () {
          avisar('Abrindo o Google…');
          setTimeout(function () { Auth.google(); }, 120);
        };

        var btnE = document.getElementById('lEntrar');
        if (btnE) btnE.onclick = function () {
          var email = document.getElementById('lEmail').value.trim();
          var senha = document.getElementById('lSenha').value;
          if (!email || !senha) return avisar('Informe e-mail e senha.');
          btnE.disabled = true; btnE.textContent = 'Entrando…';
          Auth.entrar(email, senha).then(function () {
            return DB.garantirPerfil();
          }).then(function () {
            UI.toast('Bem-vindo(a)!');
            window.App.ir('#/inicio');
            window.App.atualizarTopo();
          }).catch(function (e) {
            avisar(e.message || 'Não foi possível entrar.');
            btnE.disabled = false; btnE.textContent = 'Entrar';
          });
        };

        var esq = document.getElementById('lEsqueci');
        if (esq) esq.onclick = function () {
          UI.abrirFolha({
            titulo: 'Recuperar a senha',
            sub: 'Enviaremos um link para o seu e-mail.',
            html: '<div class="campo"><label>Seu e-mail</label><input id="rEmail" type="email" inputmode="email" placeholder="seuemail@exemplo.com"></div>' +
              '<button class="btn btn-primario btn-bloco" id="rEnviar">Enviar link</button><div id="rMsg"></div>',
            montar: function () {
              document.getElementById('rEnviar').onclick = function () {
                var b = this, em = document.getElementById('rEmail').value.trim();
                var m = document.getElementById('rMsg');
                if (!em) return (m.innerHTML = '<div class="msg-erro">Digite seu e-mail.</div>');
                b.disabled = true; b.textContent = 'Enviando…';
                Auth.recuperar(em).then(function () {
                  m.innerHTML = '<div class="msg-ok">Se este e-mail estiver cadastrado, o link chegou na sua caixa de entrada (confira o spam).</div>';
                }).catch(function (e) {
                  m.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
                }).then(function () { b.disabled = false; b.textContent = 'Enviar link'; });
              };
            }
          });
        };

        var cep = document.getElementById('cCep');
        if (cep) cep.addEventListener('blur', function () {
          var d = cep.value.replace(/\D/g, '');
          if (d.length !== 8) return;
          cep.value = d.slice(0, 5) + '-' + d.slice(5);
          fetch('https://viacep.com.br/ws/' + d + '/json/')
            .then(function (r) { return r.json(); })
            .then(function (j) {
              if (!j || j.erro) return;
              var end = document.getElementById('cEnd');
              var bai = document.getElementById('cBairro');
              var cid = document.getElementById('cCidade');
              if (end && !end.value) end.value = j.logradouro || '';
              if (bai && !bai.value) bai.value = j.bairro || '';
              if (cid && !cid.value) cid.value = (j.localidade || '') + (j.uf ? '/' + j.uf : '');
              UI.toast('Endereço preenchido pelo CEP.');
            }).catch(function () {});
        });

        var mostrar = document.getElementById('cMostrarSenha');
        if (mostrar) mostrar.onchange = function () {
          ['cSenha', 'cSenha2'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.type = mostrar.checked ? 'text' : 'password';
          });
        };

        var btnC = document.getElementById('cCriar');
        if (btnC) btnC.onclick = function () {
          var nome = document.getElementById('cNome').value.trim();
          var email = document.getElementById('cEmail').value.trim();
          var nasc = document.getElementById('cNasc').value;
          var tel = document.getElementById('cTel').value.trim();
          var cepv = document.getElementById('cCep').value.trim();
          var end = document.getElementById('cEnd').value.trim();
          var num = document.getElementById('cNum').value.trim();
          var bai = document.getElementById('cBairro').value.trim();
          var cid = document.getElementById('cCidade').value.trim();
          var s1 = document.getElementById('cSenha').value;
          var s2 = document.getElementById('cSenha2').value;

          if (nome.length < 3) return avisar('Digite o seu nome completo.');
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return avisar('Digite um e-mail válido.');
          if (s1.length < 6) return avisar('A senha precisa de pelo menos 6 caracteres.');
          if (s1 !== s2) return avisar('As duas senhas não são iguais.');

          btnC.disabled = true; btnC.textContent = 'Criando sua conta…';
          Auth.cadastrar(email, s1, { nome: nome, nascimento: nasc || null })
            .then(function (r) {
              if (!r.logado) {
                avisar('Conta criada! Confirme o e-mail que enviamos para entrar.', true);
                return null;
              }
              return DB.garantirPerfil().then(function () {
                var extras = {
                  nome: nome,
                  telefone: tel,
                  nascimento: nasc || null,
                  cep: cepv,
                  endereco: end,
                  numero: num,
                  bairro: bai,
                  cidade: cid
                };
                Object.keys(extras).forEach(function (k) { if (!extras[k]) delete extras[k]; });
                return DB.Tabela.atualizar('ibnm_perfis', { id: 'eq.' + Auth.usuario().id }, extras);
              }).then(function () {
                return DB.garantirPerfil();
              }).then(function () {
                UI.toast('Conta criada. Que alegria ter você aqui! 🎉');
                window.App.ir('#/inicio');
                window.App.atualizarTopo();
              });
            })
            .catch(function (e) {
              avisar(e.message || 'Não foi possível criar a conta.');
              btnC.disabled = false; btnC.textContent = 'Criar minha conta';
            });
        };
      }
    };
  }

  /* ============================================================
     PERFIL
     ============================================================ */
  function perfil() {
    if (!Auth.logado()) {
      LoginAba = 'entrar';
      return entrar();
    }
    var p = Auth.perfil || {};
    var html = '<div class="detalhe-topo"><button class="voltar" data-ir="#/mais">← Voltar</button>' +
      '<button class="voltar" id="pSair" style="margin-left:auto;color:var(--vermelho);border-color:#f6cdc8;background:#fff8f7">Sair</button></div>' +
      '<div class="card" style="text-align:center">' +
      (p.foto_url ? '<img src="' + UI.esc(p.foto_url) + '" alt="" style="width:82px;height:82px;border-radius:50%;object-fit:cover;margin:0 auto 10px">' : '<div style="width:82px;height:82px;border-radius:50%;background:var(--verde-claro);display:grid;place-items:center;font-size:2rem;margin:0 auto 10px">👤</div>') +
      '<h2 style="margin:0;font-size:1.12rem">' + UI.esc(p.nome || 'Membro') + '</h2>' +
      '<div class="small">' + UI.esc(p.email || '') + '</div>' +
      (p.is_adm ? '<div class="selo mt10">🛠️ Administrador</div>' : '') +
      '</div>';

    html += '<section class="secao mt14"><h3 class="sec-titulo mb10">Meus dados</h3><div class="card">' +
      '<div class="campo"><label>Nome completo</label><input id="pNome" value="' + UI.esc(p.nome || '') + '"></div>' +
      '<div class="linha"><div class="campo"><label>WhatsApp</label><input id="pTel" type="tel" inputmode="tel" value="' + UI.esc(p.telefone || '') + '" placeholder="(85) 99999-9999"></div>' +
      '<div class="campo"><label>Data de nascimento</label><input id="pNasc" type="date" value="' + UI.esc(String(p.nascimento || '').slice(0, 10)) + '"></div></div>' +
      '<div class="linha"><div class="campo"><label>Aniversário de casamento</label><input id="pCas" type="date" value="' + UI.esc(String(p.casamento || '').slice(0, 10)) + '"></div>' +
      '<div class="campo"><label>Data de batismo</label><input id="pBat" type="date" value="' + UI.esc(String(p.batismo || '').slice(0, 10)) + '"></div></div>' +
      '<div class="dica" style="margin:-8px 0 12px">Opcionais. Usamos as datas para lembrar você com carinho.</div>' +
      '<div class="campo"><label>Ministério / onde serve</label><input id="pMin" value="' + UI.esc(p.ministerio || '') + '" placeholder="Ex.: Louvor, Infantil, Diaconia"></div>' +
      '<div class="linha"><div class="campo curto"><label>CEP</label><input id="pCep" inputmode="numeric" maxlength="9" value="' + UI.esc(p.cep || '') + '"></div>' +
      '<div class="campo" style="flex:3"><label>Endereço</label><input id="pEnd" value="' + UI.esc(p.endereco || '') + '"></div></div>' +
      '<div class="linha"><div class="campo curto"><label>Número</label><input id="pNum" value="' + UI.esc(p.numero || '') + '"></div>' +
      '<div class="campo"><label>Bairro</label><input id="pBairro" value="' + UI.esc(p.bairro || '') + '"></div></div>' +
      '<div class="campo"><label>Cidade/UF</label><input id="pCidade" value="' + UI.esc(p.cidade || '') + '"></div>' +
      '<button class="btn btn-primario btn-bloco" id="pSalvar">Salvar meus dados</button>' +
      '<div id="pMsg"></div></div></section>';

    html += '<section class="secao"><div class="menu-lista">' +
      '<button class="menu-item" data-acao="fonte"><span class="ic">🔠</span><span class="tx"><b>Tamanho da letra</b><small>Deixe o app do seu jeito</small></span><span class="seta">›</span></button>' +
      '<button class="menu-item" data-acao="senha"><span class="ic">🔒</span><span class="tx"><b>Trocar minha senha</b><small>Quando quiser</small></span><span class="seta">›</span></button>' +
      (p.is_adm ? '<button class="menu-item" data-ir="#/admin"><span class="ic">🛠️</span><span class="tx"><b>Painel do administrador</b><small>Editar o conteúdo do app</small></span><span class="seta">›</span></button>' : '') +
      '</div></section>';

    html += '<div class="rodape">Entrou com ' + UI.esc(p.origem === 'google' ? 'a conta Google' : 'e-mail e senha') + '<br>Versão ' + window.IBNM.CFG.VERSAO + '</div>';

    return {
      html: html,
      montar: function (raiz) {
        document.getElementById('pSair').onclick = function () {
          UI.confirmar('Sair do app', 'Você vai precisar entrar novamente para ver seus dados.', 'Sair', true).then(function (ok) {
            if (!ok) return;
            Auth.sair().then(function () {
              window.App.ir('#/inicio');
              window.App.atualizarTopo();
              UI.toast('Você saiu.');
            });
          });
        };
        document.getElementById('pSalvar').onclick = function () {
          var b = this;
          var msg = document.getElementById('pMsg');
          var dados = {
            nome: document.getElementById('pNome').value.trim(),
            telefone: document.getElementById('pTel').value.trim(),
            nascimento: document.getElementById('pNasc').value || null,
            casamento: document.getElementById('pCas').value || null,
            batismo: document.getElementById('pBat').value || null,
            ministerio: document.getElementById('pMin').value.trim(),
            cep: document.getElementById('pCep').value.trim(),
            endereco: document.getElementById('pEnd').value.trim(),
            numero: document.getElementById('pNum').value.trim(),
            bairro: document.getElementById('pBairro').value.trim(),
            cidade: document.getElementById('pCidade').value.trim()
          };
          if (!dados.nome) { msg.innerHTML = '<div class="msg-erro">O nome não pode ficar vazio.</div>'; return; }
          b.disabled = true; b.textContent = 'Salvando…';
          DB.Tabela.atualizar('ibnm_perfis', { id: 'eq.' + Auth.usuario().id }, dados).then(function () {
            return DB.garantirPerfil();
          }).then(function () {
            msg.innerHTML = '<div class="msg-ok">Dados salvos. Obrigado!</div>';
            window.App.atualizarTopo();
          }).catch(function (e) {
            msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
          }).then(function () {
            b.disabled = false; b.textContent = 'Salvar meus dados';
          });
        };
        UI.$$('[data-acao]', raiz).forEach(function (b) {
          b.onclick = function () {
            var a = b.getAttribute('data-acao');
            if (a === 'fonte') UI.escolherFonte();
            if (a === 'senha') trocarSenha();
          };
        });
      }
    };
  }

  function trocarSenha() {
    UI.abrirFolha({
      titulo: 'Trocar minha senha',
      sub: 'Escolha uma senha fácil de lembrar e difícil de adivinhar.',
      html: '<div class="campo"><label>Nova senha</label><input id="sNova" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres"></div>' +
        '<div class="campo"><label>Repita a nova senha</label><input id="sNova2" type="password" autocomplete="new-password"></div>' +
        '<button class="btn btn-primario btn-bloco" id="sOk">Salvar nova senha</button><div id="sMsg"></div>',
      montar: function () {
        document.getElementById('sOk').onclick = function () {
          var a = document.getElementById('sNova').value;
          var b = document.getElementById('sNova2').value;
          var m = document.getElementById('sMsg');
          if (a.length < 6) return (m.innerHTML = '<div class="msg-erro">Use pelo menos 6 caracteres.</div>');
          if (a !== b) return (m.innerHTML = '<div class="msg-erro">As senhas não são iguais.</div>');
          var bt = this; bt.disabled = true; bt.textContent = 'Salvando…';
          Auth.trocarSenha(a).then(function () {
            m.innerHTML = '<div class="msg-ok">Senha alterada com sucesso.</div>';
            setTimeout(UI.fecharFolha, 1200);
          }).catch(function (e) {
            m.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
            bt.disabled = false; bt.textContent = 'Salvar nova senha';
          });
        };
      }
    });
  }

  window.IBNM.Views = {
    Estado: Estado,
    carregarTudo: carregarTudo,
    usarCache: usarCache,
    inicio: inicio,
    devocional: devocional,
    agenda: agenda,
    programacoes: programacoes,
    palavra: palavra,
    oferta: oferta,
    oracao: oracao,
    igreja: igreja,
    mais: mais,
    ajuda: ajuda,
    entrar: entrar,
    perfil: perfil,
    ocorrencias: ocorrencias,
    proximos: proximos,
    devocionalDeHoje: devocionalDeHoje,
    cartaoEvento: cartaoEvento,
    enderecoCompleto: enderecoCompleto,
    config: config,
    vazio: vazio,
    detalheEvento: detalheEvento
  };
})();
