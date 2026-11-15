/* ============================================================
   ESCOLA BÍBLICA DOMINICAL
   Salas, cadastro de aluno/professor, materiais, fotos,
   chamada (presença) e fotos do relatório.

   Quem pode o quê (o banco confere tudo de novo):
     ADM da Escola Bíblica -> tudo, em todas as salas
     Professor(a)          -> só a própria sala
     Aluno(a)              -> vê a sala, os materiais e a própria frequência
   ============================================================ */
(function () {
  var DB = window.IBNM.DB;
  var UI = window.IBNM.UI;
  var Auth = DB.Auth;
  var Views = window.IBNM.Views;
  var Secoes = window.IBNM.Secoes;

  var ICONES = ['📘', '📗', '📙', '📕', '🔥', '🎒', '🧸', '👶', '🧒', '👨‍👩‍👧', '👵', '🕊️', '✝️', '🎵', '🌱', '⭐'];
  var Abas = { principal: 'salas', sala: {}, gestao: 'domingo' };

  function E() { return Views.Estado; }
  function secao() { return Secoes.porChave('ebd'); }
  function cfg() { return E().ebdConfig || {}; }
  function salas(todas) {
    var l = E().ebdSalas || [];
    return todas ? l : l.filter(function (s) { return s.ativo; });
  }
  function sala(id) { return (E().ebdSalas || []).filter(function (s) { return s.id === id; })[0] || null; }
  function resumo(id) {
    return (E().ebdResumo || []).filter(function (r) { return r.sala_id === id; })[0] || { alunos: 0, professores: '' };
  }
  function adm() { return Auth.logado() && Auth.temSecao('ebd'); }
  function gestor(id) { return adm() || (Auth.logado() && Auth.professorDe(id)); }
  function minha(id) { return Auth.ebd().filter(function (m) { return m.sala_id === id; })[0] || null; }
  function ativa() { var s = secao(); return !!s && (s.ativo || adm()); }
  function papelNome(m) {
    if (m.papel === 'professor') return m.status === 'pendente' ? 'Professor(a) — aguardando aprovação' : 'Professor(a)';
    return 'Aluno(a)';
  }
  function carregando(caixa) { caixa.innerHTML = '<div class="esqueleto" style="height:110px"></div>'; }
  function erro(caixa, e) { caixa.innerHTML = '<div class="msg-erro">' + UI.esc((e && e.message) || 'Não foi possível carregar.') + '</div>'; }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

  /* busca de novo salas, resumo e permissões e redesenha a tela */
  function atualizar(semDesenhar) {
    return Views.carregarSecoes().then(function () {
      return Auth.logado() ? DB.carregarAcesso() : null;
    }).then(function () {
      if (!semDesenhar && window.App) window.App.render();
    });
  }

  /* ============================================================
     PARTICIPAR (aluno ou professor escolhe a sala)
     ============================================================ */
  function participar(salaId, papelInicial) {
    if (!Auth.logado()) { window.App.ir('#/entrar'); return; }
    var lista = salas(adm());
    if (!lista.length) { UI.toast('As salas ainda não foram cadastradas.'); return; }
    UI.abrirFolha({
      titulo: 'Participar da Escola Bíblica',
      sub: 'Escolha como você participa e a sua sala.',
      html: UI.escolha('pbPapel', 'Eu sou', [['aluno', 'Aluno(a)'], ['professor', 'Professor(a)']], papelInicial || 'aluno') +
        UI.escolha('pbSala', 'Minha sala', lista.map(function (s) { return [s.id, s.nome + (s.faixa ? ' — ' + s.faixa : '')]; }), salaId || lista[0].id) +
        '<div class="adm-aviso" id="pbAviso"></div>' +
        '<div class="folha-acoes"><button class="btn btn-sec" id="pbCancelar">Cancelar</button>' +
        '<button class="btn btn-primario" id="pbOk">Confirmar</button></div><div id="pbMsg"></div>',
      montar: function () {
        var papel = document.getElementById('pbPapel');
        var aviso = function () {
          document.getElementById('pbAviso').innerHTML = papel.value === 'professor'
            ? 'O pedido de <b>professor(a)</b> precisa ser aprovado por quem cuida da Escola Bíblica. Você recebe o acesso à chamada assim que for aprovado.'
            : 'Como <b>aluno(a)</b> você entra na hora. Seu nome, WhatsApp e data de nascimento ficam visíveis para quem ensina na sala.';
        };
        papel.onchange = aviso; aviso();
        document.getElementById('pbCancelar').onclick = UI.fecharFolha;
        document.getElementById('pbOk').onclick = function () {
          var b = this, msg = document.getElementById('pbMsg');
          b.disabled = true; b.textContent = 'Enviando…';
          DB.rpc('ibnm_ebd_matricular', { p_sala: document.getElementById('pbSala').value, p_papel: papel.value }).then(function (m) {
            UI.fecharFolha();
            UI.toast(m && m.status === 'pendente' ? 'Pedido enviado. Aguarde a aprovação.' : 'Pronto! Você está na sala.');
            return atualizar();
          }).catch(function (e) {
            msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
            b.disabled = false; b.textContent = 'Confirmar';
          });
        };
      }
    });
  }

  function sairDaSala(m) {
    UI.confirmar('Sair da sala', 'Você deixa de aparecer na lista desta sala. Seu histórico de presença fica guardado.', 'Sair', true).then(function (ok) {
      if (!ok) return;
      DB.rpc('ibnm_ebd_sair', { p_matricula: m.id }).then(function () {
        UI.toast('Você saiu da sala.');
        return atualizar();
      }).catch(function (e) { UI.toast(e.message); });
    });
  }

  /* cartão "minha participação" (usado aqui e no perfil) */
  function cartaoParticipacao() {
    if (!ativa()) return '';
    if (!Auth.logado()) {
      return '<div class="card"><b>Participe da Escola Bíblica</b>' +
        '<p class="small mt6">Entre no app para se cadastrar como aluno(a) ou professor(a) de uma sala.</p>' +
        '<button class="btn btn-primario btn-bloco mt10" data-ir="#/entrar">Entrar ou criar conta</button></div>';
    }
    var minhas = Auth.ebd();
    var html = '<div class="card"><b>Minha participação</b>';
    if (!minhas.length) {
      html += '<p class="small mt6">Você ainda não está em nenhuma sala.</p>' +
        '<button class="btn btn-primario btn-bloco mt10" data-ebd-participar="">🎓 Quero participar</button>';
    } else {
      html += '<div class="menu-lista mt10">' + minhas.map(function (m) {
        return '<button class="menu-item" data-ir="#/ebd/sala/' + m.sala_id + '"><span class="ic">' + UI.esc(m.icone || '📘') + '</span>' +
          '<span class="tx"><b>' + UI.esc(m.sala) + '</b><small>' + papelNome(m) + '</small></span><span class="seta">›</span></button>';
      }).join('') + '</div>' +
        '<button class="link-fino mt6" data-ebd-participar="">Entrar em outra sala ou trocar</button>';
    }
    return html + '</div>';
  }

  function ligarParticipacao(raiz) {
    UI.$$('[data-ebd-participar]', raiz).forEach(function (b) {
      b.onclick = function () { participar(b.getAttribute('data-ebd-participar') || null, b.getAttribute('data-papel') || null); };
    });
  }

  /* ============================================================
     TELA PRINCIPAL   (#/ebd)
     ============================================================ */
  function telaPrincipal() {
    var s = secao();
    var volta = '<div class="detalhe-topo"><button class="voltar" data-ir="#/inicio">← Início</button></div>';
    if (!s) {
      return { html: volta + Views.vazio('🎓', 'Escola Bíblica Dominical', 'Esta parte do app ainda não está disponível. Verifique sua internet ou fale com o administrador.') };
    }
    if (!ativa()) {
      return { html: volta + Views.vazio('🎓', 'Escola Bíblica Dominical', 'Esta seção está desativada no momento.') };
    }
    var c = cfg();
    var html = volta +
      '<div class="card hero secao-capa"><div class="hero-emoji">' + UI.esc(s.icone || '🎓') + '</div>' +
      '<h2>' + UI.esc(s.nome) + '</h2>' +
      '<p>' + UI.esc(c.aviso || 'Venha estudar a Bíblia com a gente. Escolha a sua sala e participe.') + '</p>' +
      ((c.horario || c.tema || c.revista) ? '<div class="hero-versiculo" style="font-style:normal">' +
        (c.horario ? '🕘 ' + UI.esc(c.horario) + '<br>' : '') +
        (c.tema ? '📖 Tema: ' + UI.esc(c.tema) + '<br>' : '') +
        (c.revista ? '📕 Revista: ' + UI.esc(c.revista) : '') + '</div>' : '') +
      (!s.ativo ? '<div class="selo mt10">Desativada — só você vê</div>' : '') + '</div>';

    if (adm()) {
      var pend = (Auth.acesso && Auth.acesso.ebd_pendentes) || 0;
      html += '<button class="menu-item mt14 destaque-adm" data-ir="#/ebd/gestao"><span class="ic">🛡️</span>' +
        '<span class="tx"><b>Gerenciar a Escola Bíblica</b><small>Relatório do domingo, salas, professores e dados' +
        (pend ? ' • <b class="destaque-dourado">' + plural(pend, 'pedido aguardando', 'pedidos aguardando') + '</b>' : '') +
        '</small></span><span class="seta">›</span></button>';
    }

    html += '<div class="mt14">' + cartaoParticipacao() + '</div>';

    var abas = [['salas', '🏫 Salas'], ['materiais', '📚 Materiais'], ['fotos', '🖼️ Fotos'], ['mural', '📌 Mural']];
    html += '<div class="agenda-abas abas-rolam mt14">' + abas.map(function (a) {
      return '<button data-aba-ebd="' + a[0] + '" class="' + (Abas.principal === a[0] ? 'on' : '') + '">' + a[1] + '</button>';
    }).join('') + '</div><div id="ebdCorpo"></div>';

    return {
      html: html,
      montar: function (raiz) {
        ligarParticipacao(raiz);
        var corpo = document.getElementById('ebdCorpo');
        var abrir = function (qual) {
          Abas.principal = qual;
          UI.$$('[data-aba-ebd]', raiz).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-aba-ebd') === qual); });
          if (qual === 'materiais') Secoes.materiais(corpo, s, {});
          else if (qual === 'fotos') Secoes.fotos(corpo, s, {});
          else if (qual === 'mural') Secoes.mural(corpo, s);
          else corpo.innerHTML = listaSalas();
        };
        UI.$$('[data-aba-ebd]', raiz).forEach(function (b) { b.onclick = function () { abrir(b.getAttribute('data-aba-ebd')); }; });
        abrir(Abas.principal);
      }
    };
  }

  function listaSalas() {
    var lista = salas(adm());
    if (!lista.length) {
      return Views.vazio('🏫', 'Salas em breve', adm() ? 'Toque em "Gerenciar a Escola Bíblica" para cadastrar as salas.' : 'Assim que as salas forem cadastradas, elas aparecem aqui.');
    }
    return '<div class="menu-lista">' + lista.map(function (s) {
      var r = resumo(s.id);
      var linha1 = [s.faixa, s.local].filter(Boolean).join(' • ');
      var linha2 = [r.professores ? '👩‍🏫 ' + r.professores : '', plural(r.alunos || 0, 'aluno', 'alunos')].filter(Boolean).join(' • ');
      var m = minha(s.id);
      return '<button class="menu-item sala-item" data-ir="#/ebd/sala/' + s.id + '"><span class="ic">' + UI.esc(s.icone || '📘') + '</span>' +
        '<span class="tx"><b>' + UI.esc(s.nome) + (!s.ativo ? ' <span class="badge-off">oculta</span>' : '') +
        (m ? ' <span class="badge-on">' + (m.papel === 'professor' ? (m.status === 'pendente' ? 'pedido enviado' : 'você ensina') : 'sua sala') + '</span>' : '') + '</b>' +
        (linha1 ? '<small>' + UI.esc(linha1) + '</small>' : '') +
        '<small>' + UI.esc(linha2) + '</small></span><span class="seta">›</span></button>';
    }).join('') + '</div>';
  }

  /* ============================================================
     TELA DA SALA   (#/ebd/sala/<id>)
     ============================================================ */
  function telaSala(id) {
    var s = sala(id);
    var sec = secao();
    var volta = '<div class="detalhe-topo"><button class="voltar" data-ir="#/ebd">← Escola Bíblica</button></div>';
    if (!s || !sec || (!s.ativo && !adm())) {
      return { html: volta + Views.vazio('🏫', 'Sala não encontrada', 'Ela pode ter sido removida ou você está sem internet.') };
    }
    var r = resumo(id), m = minha(id), g = gestor(id);
    var html = volta +
      '<div class="card sala-capa"><div class="sala-capa-ic">' + UI.esc(s.icone || '📘') + '</div><div class="tx">' +
      '<h2>' + UI.esc(s.nome) + (!s.ativo ? ' <span class="badge-off">oculta</span>' : '') + '</h2>' +
      ([s.faixa, s.local].filter(Boolean).length ? '<div class="small">' + UI.esc([s.faixa, s.local].filter(Boolean).join(' • ')) + '</div>' : '') +
      (s.descricao ? '<p>' + UI.esc(s.descricao) + '</p>' : '') +
      '<div class="evento-meta"><span>👩‍🏫 ' + UI.esc(r.professores || 'Professor(a) a definir') + '</span><span>👥 ' + plural(r.alunos || 0, 'aluno', 'alunos') + '</span></div>' +
      '</div></div>';

    if (!Auth.logado()) {
      html += '<button class="btn btn-primario btn-bloco mt10" data-ir="#/entrar">Entrar para participar desta sala</button>';
    } else if (m) {
      html += '<div class="card mt10 sala-minha"><div><b>' + papelNome(m) + '</b>' +
        '<div class="small">' + (m.status === 'pendente' ? 'Assim que aprovarem, a chamada aparece aqui.' : (g ? 'Você cuida desta sala.' : 'Você faz parte desta sala.')) + '</div></div>' +
        '<button class="mini perigo" id="salaSair">Sair</button></div>';
    } else {
      html += '<div class="grid2 mt10"><button class="btn btn-primario" data-ebd-participar="' + id + '" data-papel="aluno">Sou aluno(a)</button>' +
        '<button class="btn btn-sec" data-ebd-participar="' + id + '" data-papel="professor">Sou professor(a)</button></div>';
    }

    var abas = [['materiais', '📚 Materiais'], ['fotos', '🖼️ Fotos']];
    if (g) abas = [['chamada', '📋 Chamada'], ['alunos', '👥 Alunos'], ['relatorios', '📷 Relatórios']].concat(abas);
    else if (m && m.papel === 'aluno' && m.status === 'ativo') abas.push(['frequencia', '✅ Frequência']);
    var aba = Abas.sala[id];
    if (!aba || !abas.some(function (a) { return a[0] === aba; })) aba = abas[0][0];

    html += '<div class="agenda-abas abas-rolam mt14">' + abas.map(function (a) {
      return '<button data-aba-sala="' + a[0] + '" class="' + (aba === a[0] ? 'on' : '') + '">' + a[1] + '</button>';
    }).join('') + '</div><div id="salaCorpo"></div>';

    return {
      html: html,
      montar: function (raiz) {
        ligarParticipacao(raiz);
        var sair = document.getElementById('salaSair');
        if (sair) sair.onclick = function () { sairDaSala(m); };
        var corpo = document.getElementById('salaCorpo');
        var abrir = function (qual) {
          Abas.sala[id] = qual;
          UI.$$('[data-aba-sala]', raiz).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-aba-sala') === qual); });
          if (qual === 'chamada') chamadas(corpo, s);
          else if (qual === 'alunos') alunos(corpo, s);
          else if (qual === 'relatorios') relatorios(corpo, s);
          else if (qual === 'frequencia') frequencia(corpo, s, m);
          else if (qual === 'fotos') Secoes.fotos(corpo, sec, { salaId: id });
          else Secoes.materiais(corpo, sec, { salaId: id });
        };
        UI.$$('[data-aba-sala]', raiz).forEach(function (b) { b.onclick = function () { abrir(b.getAttribute('data-aba-sala')); }; });
        abrir(aba);
      }
    };
  }

  /* ---------------- frequência do próprio aluno ---------------- */
  function frequencia(corpo, s, m) {
    carregando(corpo);
    Promise.all([
      DB.Tabela.listar('ibnm_ebd_presencas', { filtros: { matricula_id: 'eq.' + m.id }, limite: 400 }),
      DB.Tabela.listar('ibnm_ebd_aulas', { select: 'id,data,tema', filtros: { sala_id: 'eq.' + s.id }, ordem: 'data.desc', limite: 120 })
    ]).then(function (r) {
      var porAula = {};
      r[0].forEach(function (p) { porAula[p.aula_id] = !!p.presente; });
      var aulas = r[1].filter(function (a) { return porAula.hasOwnProperty(a.id); });
      if (!aulas.length) { corpo.innerHTML = Views.vazio('✅', 'Nenhuma chamada ainda', 'Quando o(a) professor(a) fizer a chamada, a sua presença aparece aqui.'); return; }
      var tri = UI.trimestre();
      var doTri = aulas.filter(function (a) { return String(a.data) >= tri.inicio && String(a.data) <= tri.fim; });
      var base = doTri.length ? doTri : aulas;
      var pres = base.filter(function (a) { return porAula[a.id]; }).length;
      var pct = Math.round(pres * 100 / base.length);
      corpo.innerHTML = '<div class="card freq-card"><div class="freq-num">' + pct + '%</div><div><b>' + plural(pres, 'presença', 'presenças') + ' em ' + plural(base.length, 'aula', 'aulas') + '</b>' +
        '<div class="small">' + (doTri.length ? UI.esc(tri.nome) : 'Todas as aulas registradas') + '</div>' +
        '<div class="barra"><i style="width:' + pct + '%"></i></div></div></div>' +
        '<div class="card mt10">' + aulas.map(function (a) {
          return '<div class="horario"><div><b>' + UI.dataBR(a.data) + '</b>' + (a.tema ? '<div class="small">' + UI.esc(a.tema) + '</div>' : '') + '</div>' +
            '<span class="' + (porAula[a.id] ? 'freq-sim' : 'freq-nao') + '">' + (porAula[a.id] ? '✔ Presente' : '✖ Faltou') + '</span></div>';
        }).join('') + '</div>';
    }).catch(function (e) { erro(corpo, e); });
  }

  /* ============================================================
     ALUNOS E PROFESSORES DA SALA
     ============================================================ */
  function alunos(corpo, s) {
    carregando(corpo);
    var tri = UI.trimestre();
    Promise.all([
      DB.Tabela.listar('ibnm_ebd_matriculas', { filtros: { sala_id: 'eq.' + s.id }, ordem: 'nome.asc', limite: 600 }),
      DB.Tabela.listar('ibnm_ebd_aulas', { select: 'id,data', filtros: { sala_id: 'eq.' + s.id, data: 'gte.' + tri.inicio }, ordem: 'data.asc', limite: 60 })
    ]).then(function (r) {
      var lista = r[0], aulas = r[1];
      var buscaPres = aulas.length
        ? DB.Tabela.listarTudo('ibnm_ebd_presencas', { filtros: { aula_id: 'in.(' + aulas.map(function (a) { return a.id; }).join(',') + ')' }, ordem: 'aula_id.asc,matricula_id.asc' })
        : Promise.resolve([]);
      return buscaPres.then(function (pres) {
        var freq = {};
        pres.forEach(function (p) {
          var f = freq[p.matricula_id] || (freq[p.matricula_id] = { sim: 0, total: 0 });
          f.total++; if (p.presente) f.sim++;
        });
        desenharAlunos(corpo, s, lista, freq, tri);
      });
    }).catch(function (e) { erro(corpo, e); });
  }

  function desenharAlunos(corpo, s, lista, freq, tri) {
    var profs = lista.filter(function (m) { return m.papel === 'professor' && m.status !== 'inativo'; });
    var ativos = lista.filter(function (m) { return m.papel === 'aluno' && m.status === 'ativo'; });
    var inativos = lista.filter(function (m) { return m.papel === 'aluno' && m.status !== 'ativo'; });
    var recarregar = function () { atualizar(true); alunos(corpo, s); };

    var linhaAluno = function (m) {
      var f = freq[m.id];
      var extras = [];
      if (!m.user_id) extras.push('sem conta no app');
      if (m.responsavel) extras.push('resp.: ' + m.responsavel);
      if (m.nascimento) extras.push('🎂 ' + UI.dataBR(m.nascimento).slice(0, 5));
      var zap = UI.whats(m.telefone, 'Olá, ' + UI.primeiroNome(m.nome) + '! Sentimos sua falta na Escola Bíblica. 😊');
      return '<div class="adm-item pessoa"><span class="avatar">' + UI.esc(UI.iniciais(m.nome)) + '</span><div class="tx"><b>' + UI.esc(m.nome) + '</b>' +
        (extras.length ? '<small>' + UI.esc(extras.join(' • ')) + '</small>' : '') +
        (f ? '<small>Presença no trimestre: <strong>' + f.sim + ' de ' + f.total + '</strong></small>' : '') + '</div>' +
        '<div class="acoes-mini">' + (zap ? '<a class="mini ok" href="' + UI.esc(zap) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
        '<button class="mini" data-al-ed="' + m.id + '">Editar</button></div></div>';
    };

    var html = '<h3 class="sec-titulo mb10">Quem ensina</h3><div class="adm-lista">' +
      (profs.length ? profs.map(function (m) {
        return '<div class="adm-item pessoa"><span class="avatar prof">' + UI.esc(UI.iniciais(m.nome)) + '</span><div class="tx"><b>' + UI.esc(m.nome) + '</b>' +
          '<small>' + (m.status === 'pendente' ? '<span class="status-pill pendente">aguardando aprovação</span>' : 'Professor(a)') + '</small></div>' +
          (adm() ? '<div class="acoes-mini">' + (m.status === 'pendente' ? '<button class="mini ok" data-pf-ok="' + m.id + '">Aprovar</button>' : '') +
            '<button class="mini perigo" data-pf-rem="' + m.id + '">' + (m.status === 'pendente' ? 'Recusar' : 'Remover') + '</button></div>' : '') + '</div>';
      }).join('') : '<div class="vazio" style="padding:14px">Nenhum professor definido para esta sala.</div>') + '</div>' +
      (adm() ? '<button class="btn btn-sec btn-bloco mt10" id="pfNovo">➕ Definir professor(a)</button>' : '') +

      '<div class="sec-topo mt20"><h3 class="sec-titulo">Alunos (' + ativos.length + ')</h3></div>' +
      '<button class="btn btn-primario btn-bloco mb10" id="alNovo">➕ Adicionar aluno</button>' +
      '<div class="adm-aviso">Quem tem conta no app entra sozinho na sala. Use o botão acima para crianças e pessoas <b>sem conta no app</b>.</div>' +
      '<div class="adm-lista">' + (ativos.length ? ativos.map(linhaAluno).join('') : Views.vazio('👥', 'Nenhum aluno ainda', 'Adicione os alunos ou peça para se cadastrarem pelo app.')) + '</div>' +
      (inativos.length ? '<details class="mt14"><summary class="small forte">Inativos (' + inativos.length + ')</summary><div class="adm-lista mt10">' + inativos.map(linhaAluno).join('') + '</div></details>' : '') +
      '<div class="small mt14">Frequência contada no ' + UI.esc(tri.nome) + '.</div>';
    corpo.innerHTML = html;

    var de = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
    document.getElementById('alNovo').onclick = function () { editorAluno(s, null, recarregar); };
    UI.$$('[data-al-ed]', corpo).forEach(function (b) { b.onclick = function () { editorAluno(s, de(b.getAttribute('data-al-ed')), recarregar); }; });
    UI.$$('[data-pf-ok]', corpo).forEach(function (b) {
      b.onclick = function () {
        DB.Tabela.atualizar('ibnm_ebd_matriculas', { id: 'eq.' + b.getAttribute('data-pf-ok') }, { status: 'ativo' }).then(function () {
          UI.toast('Professor(a) aprovado(a).'); recarregar();
        }).catch(function (e) { UI.toast(e.message); });
      };
    });
    UI.$$('[data-pf-rem]', corpo).forEach(function (b) {
      b.onclick = function () {
        var m = de(b.getAttribute('data-pf-rem'));
        UI.confirmar('Remover professor(a)', (m ? m.nome : 'Esta pessoa') + ' deixa de cuidar desta sala.', 'Remover', true).then(function (ok) {
          if (!ok) return;
          DB.Tabela.atualizar('ibnm_ebd_matriculas', { id: 'eq.' + m.id }, { status: 'inativo' }).then(function () {
            UI.toast('Removido(a).'); recarregar();
          }).catch(function (e) { UI.toast(e.message); });
        });
      };
    });
    var pfNovo = document.getElementById('pfNovo');
    if (pfNovo) pfNovo.onclick = function () { definirProfessor(s, lista, recarregar); };
  }

  function editorAluno(s, m, aoSalvar) {
    m = m || {};
    UI.abrirFolha({
      titulo: m.id ? 'Editar aluno' : 'Adicionar aluno',
      sub: s.nome,
      html: UI.campo('alNome', 'Nome completo', m.nome || '') +
        '<div class="linha">' + UI.campo('alNasc', 'Nascimento', String(m.nascimento || '').slice(0, 10), 'date') +
        UI.campo('alTel', 'WhatsApp', m.telefone || '', 'tel', 'inputmode="tel" placeholder="(85) 99999-9999"') + '</div>' +
        UI.campo('alResp', 'Responsável (para crianças)', m.responsavel || '') +
        UI.area('alObs', 'Observações', m.observacao || '', 'Só quem cuida da sala vê.', 70) +
        (m.id ? UI.liga('alAtivo', 'Aluno ativo', 'Desligue se a pessoa parou de frequentar (o histórico fica guardado).', m.status === 'ativo') : '') +
        '<div class="folha-acoes"><button class="btn btn-sec" id="alCancelar">Cancelar</button>' +
        '<button class="btn btn-primario" id="alSalvar">Salvar</button></div>' +
        (m.id ? '<button class="btn btn-perigo btn-bloco mt10" id="alExcluir">🗑️ Excluir da sala (apaga as presenças)</button>' : '') +
        '<div id="alMsg"></div>',
      montar: function () {
        document.getElementById('alCancelar').onclick = UI.fecharFolha;
        document.getElementById('alSalvar').onclick = function () {
          var b = this, msg = document.getElementById('alMsg');
          var dados = {
            nome: UI.val('alNome'), nascimento: UI.val('alNasc') || null, telefone: UI.val('alTel'),
            responsavel: UI.val('alResp'), observacao: UI.val('alObs')
          };
          if (dados.nome.length < 2) { msg.innerHTML = '<div class="msg-erro">Digite o nome do aluno.</div>'; return; }
          if (m.id) dados.status = UI.marcado('alAtivo') ? 'ativo' : 'inativo';
          else dados.sala_id = s.id;
          b.disabled = true; b.textContent = 'Salvando…';
          (m.id ? DB.Tabela.atualizar('ibnm_ebd_matriculas', { id: 'eq.' + m.id }, dados) : DB.Tabela.inserir('ibnm_ebd_matriculas', dados)).then(function () {
            UI.fecharFolha(); UI.toast('Aluno salvo.'); if (aoSalvar) aoSalvar();
          }).catch(function (e) {
            msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
            b.disabled = false; b.textContent = 'Salvar';
          });
        };
        var ex = document.getElementById('alExcluir');
        if (ex) ex.onclick = function () {
          if (ex.getAttribute('data-certeza') !== '1') { ex.setAttribute('data-certeza', '1'); ex.textContent = 'Toque de novo para confirmar a exclusão'; return; }
          ex.disabled = true;
          DB.Tabela.apagar('ibnm_ebd_matriculas', { id: 'eq.' + m.id }).then(function () {
            UI.fecharFolha(); UI.toast('Aluno excluído da sala.'); if (aoSalvar) aoSalvar();
          }).catch(function (e) { document.getElementById('alMsg').innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>'; ex.disabled = false; });
        };
      }
    });
  }

  /* o ADM da Escola Bíblica procura a pessoa pelo nome e define como professor(a) */
  function definirProfessor(s, listaDaSala, aoSalvar) {
    UI.abrirFolha({
      titulo: 'Definir professor(a)',
      sub: s.nome,
      html: UI.campo('pfBusca', 'Procure pelo nome', '', 'search', 'placeholder="Digite pelo menos 2 letras" autocomplete="off"', 'A pessoa precisa ter conta no app.') +
        '<div id="pfLista" class="adm-lista"></div><div id="pfMsg"></div>' +
        '<div class="folha-acoes"><button class="btn btn-sec" id="pfFechar">Fechar</button></div>',
      montar: function () {
        document.getElementById('pfFechar').onclick = UI.fecharFolha;
        var campo = document.getElementById('pfBusca'), caixa = document.getElementById('pfLista'), espera = null, pedido = 0;
        var procurar = function () {
          var termo = campo.value.trim();
          if (termo.length < 2) { caixa.innerHTML = ''; return; }
          var meu = ++pedido;
          DB.rpc('ibnm_ebd_buscar_pessoas', { p_termo: termo }).then(function (r) {
            if (meu !== pedido) return;
            r = Array.isArray(r) ? r : [];
            caixa.innerHTML = r.length ? r.map(function (p) {
              return '<div class="adm-item pessoa"><span class="avatar">' + UI.esc(UI.iniciais(p.nome)) + '</span><div class="tx"><b>' + UI.esc(p.nome || '(sem nome)') + '</b></div>' +
                '<div class="acoes-mini"><button class="mini ok" data-pf-esc="' + p.id + '">Escolher</button></div></div>';
            }).join('') : '<div class="vazio" style="padding:14px">Ninguém encontrado com esse nome.</div>';
            UI.$$('[data-pf-esc]', caixa).forEach(function (b) {
              b.onclick = function () {
                var uid = b.getAttribute('data-pf-esc');
                var ja = (listaDaSala || []).filter(function (x) { return x.user_id === uid; })[0];
                b.disabled = true;
                (ja ? DB.Tabela.atualizar('ibnm_ebd_matriculas', { id: 'eq.' + ja.id }, { papel: 'professor', status: 'ativo' })
                  : DB.Tabela.inserir('ibnm_ebd_matriculas', { sala_id: s.id, user_id: uid, papel: 'professor', status: 'ativo' })).then(function () {
                  UI.fecharFolha(); UI.toast('Professor(a) definido(a).'); if (aoSalvar) aoSalvar();
                }).catch(function (e) {
                  document.getElementById('pfMsg').innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>'; b.disabled = false;
                });
              };
            });
          }).catch(function (e) { caixa.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>'; });
        };
        campo.oninput = function () { clearTimeout(espera); espera = setTimeout(procurar, 350); };
        campo.focus();
      }
    });
  }

  /* ============================================================
     CHAMADA
     ============================================================ */
  function textoResumo(s, a) {
    var aus = Math.max(0, (a.matriculados || 0) - (a.presentes || 0));
    return '📋 Escola Bíblica — ' + s.nome + '\n' +
      '📅 ' + UI.dataBR(a.data) + '\n' +
      'Matriculados: ' + (a.matriculados || 0) + '\nPresentes: ' + (a.presentes || 0) + '\nAusentes: ' + aus + '\n' +
      'Visitantes: ' + (a.visitantes || 0) + '\nBíblias: ' + (a.biblias || 0) + '\nRevistas: ' + (a.revistas || 0) + '\n' +
      'Oferta: ' + UI.money(a.oferta) + (a.tema ? '\nTema: ' + a.tema : '') + (a.observacao ? '\nObs.: ' + a.observacao : '');
  }

  function compartilharTexto(titulo, texto) {
    if (navigator.share) { navigator.share({ title: titulo, text: texto }).catch(function () {}); return; }
    UI.copiar(texto, 'Resumo copiado. Cole no WhatsApp.');
  }

  function chamadas(corpo, s) {
    carregando(corpo);
    DB.Tabela.listar('ibnm_ebd_aulas', { filtros: { sala_id: 'eq.' + s.id }, ordem: 'data.desc', limite: 60 }).then(function (lista) {
      var dom = UI.ultimoDomingo();
      var feita = lista.some(function (a) { return String(a.data).slice(0, 10) === dom; });
      var html = '<button class="btn btn-primario btn-bloco" id="chNova">📋 ' + (feita ? 'Corrigir a chamada de ' : 'Fazer a chamada de ') + UI.dataBR(dom).slice(0, 5) + '</button>' +
        '<div class="small txt-c mt6 mb14">Domingo mais recente. Dentro da chamada você pode escolher outra data.</div>';
      if (!lista.length) {
        html += Views.vazio('📋', 'Nenhuma chamada registrada', 'Faça a primeira chamada desta sala.');
      } else {
        html += '<div class="adm-lista">' + lista.map(function (a) {
          return '<div class="adm-item"><div class="evento-data"><b>' + UI.dataCurta(a.data).dia + '</b><small>' + UI.dataCurta(a.data).mes + '</small></div>' +
            '<div class="tx"><b>' + (a.presentes || 0) + ' de ' + (a.matriculados || 0) + ' presentes</b>' +
            '<small>' + UI.esc([a.tema, plural(a.visitantes || 0, 'visitante', 'visitantes'), 'oferta ' + UI.money(a.oferta)].filter(Boolean).join(' • ')) + '</small></div>' +
            '<div class="acoes-mini"><button class="mini" data-ch-ab="' + UI.esc(String(a.data).slice(0, 10)) + '">Abrir</button>' +
            '<button class="mini ok" data-ch-env="' + a.id + '">Enviar</button>' +
            '<button class="mini perigo" data-ch-del="' + a.id + '">Excluir</button></div></div>';
        }).join('') + '</div>';
      }
      corpo.innerHTML = html;
      var de = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      document.getElementById('chNova').onclick = function () { chamada(corpo, s, dom); };
      UI.$$('[data-ch-ab]', corpo).forEach(function (b) { b.onclick = function () { chamada(corpo, s, b.getAttribute('data-ch-ab')); }; });
      UI.$$('[data-ch-env]', corpo).forEach(function (b) { b.onclick = function () { compartilharTexto('Chamada — ' + s.nome, textoResumo(s, de(b.getAttribute('data-ch-env')))); }; });
      UI.$$('[data-ch-del]', corpo).forEach(function (b) {
        b.onclick = function () {
          var a = de(b.getAttribute('data-ch-del'));
          UI.confirmar('Excluir chamada', 'A chamada de ' + UI.dataBR(a.data) + ' e as presenças desse dia serão apagadas.', 'Excluir', true).then(function (ok) {
            if (!ok) return;
            DB.Tabela.apagar('ibnm_ebd_aulas', { id: 'eq.' + a.id }).then(function () { UI.toast('Chamada excluída.'); chamadas(corpo, s); })
              .catch(function (e) { UI.toast(e.message); });
          });
        };
      });
    }).catch(function (e) { erro(corpo, e); });
  }

  function chaveRascunho(s, data) { return 'ibnm.chamada.' + s.id + '.' + data; }

  function contador(id, rotulo, valor) {
    return '<div class="contador"><span>' + rotulo + '</span><div><button type="button" data-menos="' + id + '" aria-label="Diminuir ' + rotulo + '">−</button>' +
      '<input id="' + id + '" type="number" inputmode="numeric" min="0" value="' + (Number(valor) || 0) + '" aria-label="' + rotulo + '">' +
      '<button type="button" data-mais="' + id + '" aria-label="Aumentar ' + rotulo + '">+</button></div></div>';
  }

  function chamada(corpo, s, data) {
    data = data || UI.ultimoDomingo();
    carregando(corpo);
    Promise.all([
      DB.Tabela.listar('ibnm_ebd_matriculas', { filtros: { sala_id: 'eq.' + s.id, papel: 'eq.aluno' }, ordem: 'nome.asc', limite: 600 }),
      DB.Tabela.listar('ibnm_ebd_aulas', { filtros: { sala_id: 'eq.' + s.id, data: 'eq.' + data }, limite: 1 })
    ]).then(function (r) {
      var aula = r[1][0] || null;
      return (aula ? DB.Tabela.listarTudo('ibnm_ebd_presencas', { filtros: { aula_id: 'eq.' + aula.id }, ordem: 'matricula_id.asc' }) : Promise.resolve([]))
        .then(function (pres) { desenharChamada(corpo, s, data, r[0], aula, pres); });
    }).catch(function (e) { erro(corpo, e); });
  }

  function desenharChamada(corpo, s, data, todos, aula, pres) {
    var marcado = {}, tinha = {};
    pres.forEach(function (p) { marcado[p.matricula_id] = !!p.presente; tinha[p.matricula_id] = true; });
    var lista = todos.filter(function (m) { return m.status === 'ativo' || tinha[m.id]; });
    var campos = aula || { tema: '', professor: (Auth.perfil && Auth.perfil.nome) || '', visitantes: 0, biblias: 0, revistas: 0, oferta: 0, observacao: '' };

    /* rascunho guardado no aparelho (se a internet cair no meio da chamada, nada se perde) */
    var rasc = null;
    try { rasc = JSON.parse(localStorage.getItem(chaveRascunho(s, data)) || 'null'); } catch (e) {}
    if (rasc && rasc.marcado) {
      marcado = rasc.marcado;
      campos = Object.assign({}, campos, rasc.campos || {});
    }

    var html = '<div class="detalhe-topo" data-editando="1"><button class="voltar" id="chVoltar">← Chamadas</button></div>' +
      '<div class="card">' +
      UI.campo('chData', 'Data da aula', data, 'date', 'max="' + UI.hojeISO() + '"') +
      (aula ? '<div class="msg-ok" style="margin:0 0 12px">Esta chamada já foi salva. Você está corrigindo.</div>' : '') +
      (rasc ? '<div class="adm-aviso">Recuperamos as marcações que você não tinha terminado de salvar.</div>' : '') +
      '<div class="chamada-topo"><div><b id="chPres">0</b> presentes de <b>' + lista.length + '</b></div>' +
      '<button class="mini" id="chTodos" type="button">Marcar todos</button></div>' +
      (lista.length ? '<div class="chamada-lista">' + lista.map(function (m) {
        var sim = !!marcado[m.id];
        return '<label class="chamada-item' + (sim ? ' on' : '') + '"><input type="checkbox" data-pres="' + m.id + '"' + (sim ? ' checked' : '') + '>' +
          '<span class="avatar">' + UI.esc(UI.iniciais(m.nome)) + '</span>' +
          '<span class="tx"><b>' + UI.esc(m.nome) + '</b>' + (m.status !== 'ativo' ? '<small>inativo</small>' : '') + '</span>' +
          '<span class="marca" aria-hidden="true"></span></label>';
      }).join('') + '</div>' : Views.vazio('👥', 'Nenhum aluno na lista', 'Adicione os alunos para fazer a chamada.')) +
      '<button class="link-fino mt6" id="chNovoAluno" type="button">➕ Adicionar aluno que não está na lista</button></div>' +

      '<div class="card mt10">' +
      UI.campo('chTema', 'Tema / lição do dia', campos.tema || '', 'text', 'placeholder="Ex.: Lição 7 — O bom samaritano"') +
      UI.campo('chProf', 'Quem ensinou', campos.professor || '') +
      '<div class="contadores">' + contador('chVis', 'Visitantes', campos.visitantes) + contador('chBib', 'Bíblias', campos.biblias) + contador('chRev', 'Revistas', campos.revistas) + '</div>' +
      UI.campo('chOferta', 'Oferta da sala (R$)', Number(campos.oferta) ? String(Number(campos.oferta).toFixed(2)).replace('.', ',') : '', 'text', 'inputmode="decimal" placeholder="0,00"') +
      UI.area('chObs', 'Observações', campos.observacao || '', '', 70) + '</div>' +
      '<button class="btn btn-primario btn-bloco mt14" id="chSalvar">💾 Salvar chamada</button><div id="chMsg"></div>';
    corpo.innerHTML = html;
    UI.rolarAte(corpo);

    var caixas = function () { return UI.$$('[data-pres]', corpo); };
    var lerCampos = function () {
      return {
        tema: UI.val('chTema'), professor: UI.val('chProf'),
        visitantes: Math.max(0, parseInt(UI.val('chVis'), 10) || 0),
        biblias: Math.max(0, parseInt(UI.val('chBib'), 10) || 0),
        revistas: Math.max(0, parseInt(UI.val('chRev'), 10) || 0),
        oferta: Math.max(0, UI.numero(UI.val('chOferta'))),
        observacao: UI.val('chObs')
      };
    };
    var contar = function () {
      var n = caixas().filter(function (c) { return c.checked; }).length;
      document.getElementById('chPres').textContent = n;
      var bt = document.getElementById('chTodos');
      if (bt) bt.textContent = (n === caixas().length && n > 0) ? 'Desmarcar todos' : 'Marcar todos';
    };
    var guardar = function () {
      var m = {};
      caixas().forEach(function (c) { m[c.getAttribute('data-pres')] = c.checked; });
      try { localStorage.setItem(chaveRascunho(s, data), JSON.stringify({ marcado: m, campos: lerCampos(), em: Date.now() })); } catch (e) {}
    };
    caixas().forEach(function (c) {
      c.onchange = function () { c.parentNode.classList.toggle('on', c.checked); contar(); guardar(); };
    });
    UI.$$('input,textarea', corpo).forEach(function (el) { if (!el.hasAttribute('data-pres') && el.id !== 'chData') el.addEventListener('input', guardar); });
    UI.$$('[data-mais],[data-menos]', corpo).forEach(function (b) {
      b.onclick = function () {
        var alvo = document.getElementById(b.getAttribute('data-mais') || b.getAttribute('data-menos'));
        alvo.value = Math.max(0, (parseInt(alvo.value, 10) || 0) + (b.hasAttribute('data-mais') ? 1 : -1));
        guardar();
      };
    });
    document.getElementById('chTodos').onclick = function () {
      var todosMarcados = caixas().length > 0 && caixas().every(function (c) { return c.checked; });
      caixas().forEach(function (c) { c.checked = !todosMarcados; c.parentNode.classList.toggle('on', c.checked); });
      contar(); guardar();
    };
    document.getElementById('chVoltar').onclick = function () { chamadas(corpo, s); };
    document.getElementById('chData').onchange = function () { if (this.value) chamada(corpo, s, this.value); };
    document.getElementById('chNovoAluno').onclick = function () { guardar(); editorAluno(s, null, function () { atualizar(true); chamada(corpo, s, data); }); };
    contar();

    document.getElementById('chSalvar').onclick = function () {
      var b = this, msg = document.getElementById('chMsg');
      var presencas = caixas().map(function (c) { return { m: c.getAttribute('data-pres'), p: c.checked }; });
      guardar();
      b.disabled = true; b.textContent = 'Salvando…';
      DB.rpc('ibnm_ebd_salvar_chamada', { p_sala: s.id, p_data: data, p_dados: lerCampos(), p_presencas: presencas }).then(function (a) {
        try { localStorage.removeItem(chaveRascunho(s, data)); } catch (e) {}
        a = a || {};
        corpo.innerHTML = '<div class="card txt-c"><div style="font-size:2rem">✅</div>' +
          '<h3 style="margin:6px 0 2px">Chamada salva</h3>' +
          '<div class="small">' + UI.esc(s.nome) + ' • ' + UI.dataBR(a.data || data) + '</div>' +
          '<div class="chamada-total"><div><b>' + (a.presentes || 0) + '</b><small>presentes</small></div>' +
          '<div><b>' + Math.max(0, (a.matriculados || 0) - (a.presentes || 0)) + '</b><small>ausentes</small></div>' +
          '<div><b>' + (a.visitantes || 0) + '</b><small>visitantes</small></div></div>' +
          '<button class="btn btn-dourado btn-bloco mt14" id="chEnviar">📤 Enviar resumo (WhatsApp)</button>' +
          '<button class="btn btn-sec btn-bloco mt10" id="chFoto">📷 Enviar foto do relatório</button>' +
          '<button class="btn btn-fantasma btn-bloco mt10" id="chFim">← Voltar para as chamadas</button></div>';
        document.getElementById('chEnviar').onclick = function () { compartilharTexto('Chamada — ' + s.nome, textoResumo(s, a)); };
        document.getElementById('chFoto').onclick = function () { enviarRelatorio(s, a.data || data, function () { Abas.sala[s.id] = 'relatorios'; window.App.render(); }); };
        document.getElementById('chFim').onclick = function () { chamadas(corpo, s); };
        UI.toast('Chamada salva.');
        atualizar(true);
      }).catch(function (e) {
        msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + (e.rede ? ' Suas marcações ficaram guardadas neste aparelho.' : '') + '</div>';
        b.disabled = false; b.textContent = '💾 Salvar chamada';
      });
    };
  }

  /* ============================================================
     FOTOS DO RELATÓRIO (arquivo privado: só ADM da EBD e professor da sala)
     s = sala, ou null para o relatório geral
     ============================================================ */
  function enviarRelatorio(s, data, aoSalvar) {
    UI.abrirFolha({
      titulo: 'Foto do relatório',
      sub: s ? s.nome : 'Relatório geral da Escola Bíblica',
      html: '<div class="campo"><label for="rlArq">Foto do relatório ou da caderneta</label><input type="file" id="rlArq" accept="image/*">' +
        '<div class="dica">Tire a foto com boa luz. O app diminui o arquivo sem perder a leitura.</div></div>' +
        '<div class="linha">' + UI.campo('rlData', 'Data', data || UI.ultimoDomingo(), 'date') + '</div>' +
        UI.campo('rlTitulo', 'Descrição (opcional)', '', 'text', 'placeholder="Ex.: Relatório da classe"') +
        '<div class="folha-acoes"><button class="btn btn-sec" id="rlCancelar">Cancelar</button>' +
        '<button class="btn btn-primario" id="rlEnviar">Enviar</button></div><div id="rlMsg"></div>',
      montar: function () {
        document.getElementById('rlCancelar').onclick = UI.fecharFolha;
        document.getElementById('rlEnviar').onclick = function () {
          var b = this, msg = document.getElementById('rlMsg');
          var arq = (document.getElementById('rlArq').files || [])[0];
          if (!arq) { msg.innerHTML = '<div class="msg-erro">Escolha a foto do relatório.</div>'; return; }
          b.disabled = true; b.textContent = 'Enviando…';
          var caminho = 'ebd/relatorios/' + (s ? s.id : 'geral') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
          UI.reduzirImagem(arq, 2000, 0.85).then(function (blob) {
            return DB.Arquivos.enviar('igreja', caminho, blob);
          }).then(function () {
            return DB.Tabela.inserir('ibnm_ebd_relatorios', {
              sala_id: s ? s.id : null, data: UI.val('rlData') || UI.hojeISO(), titulo: UI.val('rlTitulo'), caminho: caminho
            });
          }).then(function () {
            UI.fecharFolha(); UI.toast('Relatório enviado.'); if (aoSalvar) aoSalvar();
          }).catch(function (e) {
            msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
            b.disabled = false; b.textContent = 'Enviar';
          });
        };
      }
    });
  }

  /* desenha a lista de fotos de relatório; as imagens são baixadas com a senha do usuário */
  function listaRelatorios(caixa, lista, aoMudar) {
    if (!lista.length) { caixa.innerHTML = Views.vazio('📷', 'Nenhuma foto de relatório', 'Envie a foto do relatório ou da caderneta de chamada.'); return; }
    caixa.innerHTML = '<div class="relatorios">' + lista.map(function (r) {
      var nome = r.sala_id ? ((sala(r.sala_id) || {}).nome || 'Sala') : 'Relatório geral';
      return '<div class="relatorio" data-rl="' + r.id + '"><button class="relatorio-img" data-rl-ver="' + r.id + '" aria-label="Abrir relatório"><span>📷</span></button>' +
        '<div class="tx"><b>' + UI.dataBR(r.data) + ' — ' + UI.esc(nome) + '</b>' +
        '<small>' + UI.esc([r.titulo, r.autor ? 'por ' + r.autor : ''].filter(Boolean).join(' • ')) + '</small>' +
        '<div class="acoes-mini mt6" style="justify-content:flex-start"><button class="mini" data-rl-ver="' + r.id + '">Abrir</button>' +
        '<button class="mini perigo" data-rl-del="' + r.id + '">Excluir</button></div></div></div>';
    }).join('') + '</div>';
    var enderecos = {};
    var de = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
    lista.forEach(function (r) {
      DB.Arquivos.baixar('igreja', r.caminho).then(function (url) {
        enderecos[r.id] = url;
        var alvo = caixa.querySelector('.relatorio[data-rl="' + r.id + '"] .relatorio-img');
        if (alvo) alvo.innerHTML = '<img src="' + url + '" alt="Relatório de ' + UI.dataBR(r.data) + '">';
      }).catch(function () {});
    });
    UI.$$('[data-rl-ver]', caixa).forEach(function (b) {
      b.onclick = function () {
        var r = de(b.getAttribute('data-rl-ver'));
        if (enderecos[r.id]) { UI.verImagem(enderecos[r.id], 'Relatório de ' + UI.dataBR(r.data)); return; }
        UI.toast('Abrindo…');
        DB.Arquivos.baixar('igreja', r.caminho).then(function (url) { enderecos[r.id] = url; UI.verImagem(url, 'Relatório de ' + UI.dataBR(r.data)); })
          .catch(function (e) { UI.toast(e.message); });
      };
    });
    UI.$$('[data-rl-del]', caixa).forEach(function (b) {
      b.onclick = function () {
        var r = de(b.getAttribute('data-rl-del'));
        UI.confirmar('Excluir foto do relatório', 'A foto será apagada.', 'Excluir', true).then(function (ok) {
          if (!ok) return;
          DB.Tabela.apagar('ibnm_ebd_relatorios', { id: 'eq.' + r.id }).then(function () {
            DB.Arquivos.apagar('igreja', r.caminho);
            UI.toast('Foto excluída.'); if (aoMudar) aoMudar();
          }).catch(function (e) { UI.toast(e.message); });
        });
      };
    });
  }

  function relatorios(corpo, s) {
    carregando(corpo);
    DB.Tabela.listar('ibnm_ebd_relatorios', { filtros: { sala_id: 'eq.' + s.id }, ordem: 'data.desc,criado_em.desc', limite: 60 }).then(function (lista) {
      corpo.innerHTML = '<button class="btn btn-primario btn-bloco" id="rlNovo">📷 Enviar foto do relatório</button>' +
        '<div class="adm-aviso mt14">Estas fotos são reservadas: só quem cuida da Escola Bíblica e os professores desta sala conseguem ver.</div>' +
        '<div id="rlLista"></div>';
      var recarregar = function () { relatorios(corpo, s); };
      document.getElementById('rlNovo').onclick = function () { enviarRelatorio(s, null, recarregar); };
      listaRelatorios(document.getElementById('rlLista'), lista, recarregar);
    }).catch(function (e) { erro(corpo, e); });
  }

  /* ============================================================
     GESTÃO DA ESCOLA BÍBLICA   (#/ebd/gestao) — só o ADM da seção
     ============================================================ */
  function telaGestao() {
    var volta = '<div class="detalhe-topo"><button class="voltar" data-ir="#/ebd">← Escola Bíblica</button></div>';
    if (!Auth.logado()) { window.App.ir('#/entrar'); return { html: '' }; }
    if (!adm() || !secao()) {
      return { html: volta + Views.vazio('🔒', 'Área de quem cuida da Escola Bíblica', 'Peça ao ADM principal para liberar esta seção para você.') };
    }
    var pend = (Auth.acesso && Auth.acesso.ebd_pendentes) || 0;
    var abas = [['domingo', '📊 Domingo'], ['salas', '🏫 Salas'], ['professores', '👩‍🏫 Professores' + (pend ? ' (' + pend + ')' : '')], ['dados', '⚙️ Dados']];
    var html = volta +
      '<div class="adm-topo"><span class="adm-ic">🎓</span><div><b>Gestão da Escola Bíblica</b>' +
      '<small>Relatório do domingo, salas, professores e informações gerais.</small></div></div>' +
      '<div class="adm-abas">' + abas.map(function (a) {
        return '<button data-aba-gestao="' + a[0] + '" class="' + (Abas.gestao === a[0] ? 'on' : '') + '">' + a[1] + '</button>';
      }).join('') + '</div><div id="gestaoCorpo"></div>';
    return {
      html: html,
      montar: function (raiz) {
        var corpo = document.getElementById('gestaoCorpo');
        var abrir = function (qual) {
          Abas.gestao = qual;
          UI.$$('[data-aba-gestao]', raiz).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-aba-gestao') === qual); });
          if (qual === 'salas') gestaoSalas(corpo);
          else if (qual === 'professores') gestaoProfessores(corpo);
          else if (qual === 'dados') gestaoDados(corpo);
          else gestaoDomingo(corpo, null);
        };
        UI.$$('[data-aba-gestao]', raiz).forEach(function (b) { b.onclick = function () { abrir(b.getAttribute('data-aba-gestao')); }; });
        abrir(Abas.gestao);
      }
    };
  }

  /* ---------------- relatório geral do domingo ---------------- */
  function semCifrao(v) { return UI.money(v).replace(/^R\$\s*/, ''); }
  function gestaoDomingo(corpo, data) {
    data = data || UI.ultimoDomingo();
    carregando(corpo);
    Promise.all([
      DB.Tabela.listar('ibnm_ebd_aulas', { filtros: { data: 'eq.' + data }, limite: 200 }),
      DB.Tabela.listar('ibnm_ebd_relatorios', { filtros: { data: 'eq.' + data }, ordem: 'criado_em.desc', limite: 60 })
    ]).then(function (r) {
      var aulas = r[0], fotos = r[1];
      var porSala = {};
      aulas.forEach(function (a) { porSala[a.sala_id] = a; });
      var lista = salas(true).filter(function (s) { return s.ativo || porSala[s.id]; });
      var tot = { mat: 0, pres: 0, vis: 0, bib: 0, rev: 0, of: 0, feitas: 0 };
      lista.forEach(function (s) {
        var a = porSala[s.id];
        if (!a) return;
        tot.feitas++; tot.mat += a.matriculados || 0; tot.pres += a.presentes || 0; tot.vis += a.visitantes || 0;
        tot.bib += a.biblias || 0; tot.rev += a.revistas || 0; tot.of += Number(a.oferta) || 0;
      });
      var html = '<div class="card">' + UI.campo('gdData', 'Domingo', data, 'date', 'max="' + UI.hojeISO() + '"') +
        '<div class="chamada-total dois"><div><b>' + tot.pres + '</b><small>presentes</small></div>' +
        '<div><b>' + Math.max(0, tot.mat - tot.pres) + '</b><small>ausentes</small></div>' +
        '<div><b>' + tot.vis + '</b><small>visitantes</small></div>' +
        '<div><b>' + UI.money(tot.of) + '</b><small>oferta</small></div></div>' +
        '<div class="small txt-c mt6">' + tot.feitas + ' de ' + lista.length + ' salas já fizeram a chamada • ' + tot.bib + ' Bíblias • ' + tot.rev + ' revistas</div></div>' +
        '<div class="tabela-rola mt10"><table class="tabela"><thead><tr><th>Sala</th><th title="Matriculados">Mat</th><th title="Presentes">Pres</th><th title="Ausentes">Aus</th><th title="Visitantes">Vis</th><th title="Bíblias">Bíb</th><th title="Revistas">Rev</th><th>Oferta R$</th></tr></thead><tbody>' +
        lista.map(function (s) {
          var a = porSala[s.id];
          if (!a) return '<tr class="sem"><td><b>' + UI.esc(s.nome) + '</b></td><td colspan="7">chamada ainda não feita</td></tr>';
          return '<tr><td><b>' + UI.esc(s.nome) + '</b></td><td>' + (a.matriculados || 0) + '</td><td>' + (a.presentes || 0) + '</td><td>' +
            Math.max(0, (a.matriculados || 0) - (a.presentes || 0)) + '</td><td>' + (a.visitantes || 0) + '</td><td>' + (a.biblias || 0) + '</td><td>' + (a.revistas || 0) + '</td><td>' + semCifrao(a.oferta) + '</td></tr>';
        }).join('') +
        '<tr class="total"><td><b>Total</b></td><td>' + tot.mat + '</td><td>' + tot.pres + '</td><td>' + Math.max(0, tot.mat - tot.pres) + '</td><td>' + tot.vis + '</td><td>' + tot.bib + '</td><td>' + tot.rev + '</td><td>' + semCifrao(tot.of) + '</td></tr>' +
        '</tbody></table></div><div class="tabela-dica">Arraste a tabela para o lado para ver tudo →</div>' +
        '<button class="btn btn-dourado btn-bloco mt14" id="gdEnviar">📤 Enviar relatório geral (WhatsApp)</button>' +
        '<div class="sec-topo mt20"><h3 class="sec-titulo">Fotos de relatório deste dia</h3></div>' +
        '<button class="btn btn-sec btn-bloco mb10" id="gdFoto">📷 Enviar foto do relatório geral</button><div id="gdFotos"></div>';
      corpo.innerHTML = html;
      UI.arrumarAbas(corpo);
      document.getElementById('gdData').onchange = function () { if (this.value) gestaoDomingo(corpo, this.value); };
      document.getElementById('gdEnviar').onclick = function () {
        var txt = '📊 Escola Bíblica Dominical — ' + UI.dataBR(data) + '\n\n' + lista.map(function (s) {
          var a = porSala[s.id];
          return a ? '• ' + s.nome + ': ' + (a.presentes || 0) + ' presentes de ' + (a.matriculados || 0) + ', ' + (a.visitantes || 0) + ' visit., oferta ' + UI.money(a.oferta)
            : '• ' + s.nome + ': chamada não feita';
        }).join('\n') + '\n\nTOTAL: ' + tot.pres + ' presentes, ' + Math.max(0, tot.mat - tot.pres) + ' ausentes, ' + tot.vis + ' visitantes\n' +
          'Bíblias: ' + tot.bib + ' • Revistas: ' + tot.rev + '\nOferta: ' + UI.money(tot.of);
        compartilharTexto('Relatório da Escola Bíblica', txt);
      };
      var recarregar = function () { gestaoDomingo(corpo, data); };
      document.getElementById('gdFoto').onclick = function () { enviarRelatorio(null, data, recarregar); };
      listaRelatorios(document.getElementById('gdFotos'), fotos, recarregar);
    }).catch(function (e) { erro(corpo, e); });
  }

  /* ---------------- salas ---------------- */
  function gestaoSalas(corpo) {
    var lista = salas(true);
    corpo.innerHTML = '<button class="btn btn-primario btn-bloco" id="gsNova">➕ Nova sala</button>' +
      '<div class="adm-aviso mt14">As salas <b>ocultas</b> não aparecem para os membros. Edite os exemplos, ative as que a igreja tem e exclua as outras.</div>' +
      '<div class="adm-lista">' + (lista.length ? lista.map(function (s) {
        var r = resumo(s.id);
        return '<div class="adm-item"><span class="avatar sala">' + UI.esc(s.icone || '📘') + '</span><div class="tx"><b>' + UI.esc(s.nome) + ' ' +
          (s.ativo ? '<span class="badge-on">ativa</span>' : '<span class="badge-off">oculta</span>') + '</b>' +
          '<small>' + UI.esc([s.faixa, s.local, plural(r.alunos || 0, 'aluno', 'alunos')].filter(Boolean).join(' • ')) + '</small></div>' +
          '<div class="acoes-mini"><button class="mini" data-gs-ed="' + s.id + '">Editar</button>' +
          '<button class="mini" data-gs-at="' + s.id + '">' + (s.ativo ? 'Ocultar' : 'Ativar') + '</button>' +
          '<button class="mini" data-ir="#/ebd/sala/' + s.id + '">Abrir</button></div></div>';
      }).join('') : Views.vazio('🏫', 'Nenhuma sala', 'Crie a primeira sala da Escola Bíblica.')) + '</div>';
    var recarregar = function () { atualizar(true).then(function () { gestaoSalas(corpo); }); };
    document.getElementById('gsNova').onclick = function () { editorSala(null, recarregar); };
    UI.$$('[data-gs-ed]', corpo).forEach(function (b) { b.onclick = function () { editorSala(sala(b.getAttribute('data-gs-ed')), recarregar); }; });
    UI.$$('[data-gs-at]', corpo).forEach(function (b) {
      b.onclick = function () {
        var s = sala(b.getAttribute('data-gs-at'));
        DB.Tabela.atualizar('ibnm_ebd_salas', { id: 'eq.' + s.id }, { ativo: !s.ativo }).then(function () {
          UI.toast(s.ativo ? 'Sala ocultada.' : 'Sala ativada.'); recarregar();
        }).catch(function (e) { UI.toast(e.message); });
      };
    });
  }

  function editorSala(s, aoSalvar) {
    s = s || {};
    var icone = s.icone || ICONES[0];
    UI.abrirFolha({
      titulo: s.id ? 'Editar sala' : 'Nova sala',
      html: UI.campo('gsNome', 'Nome da sala', s.nome || '', 'text', 'placeholder="Ex.: Adultos, Jovens, Primários"') +
        '<div class="linha">' + UI.campo('gsFaixa', 'Para quem é', s.faixa || '', 'text', 'placeholder="Ex.: 12 a 17 anos"') +
        UI.campo('gsLocal', 'Onde se reúne', s.local || '', 'text', 'placeholder="Ex.: Sala 2"') + '</div>' +
        UI.area('gsDesc', 'Descrição (opcional)', s.descricao || '', '', 70) +
        '<div class="campo"><label>Ícone</label><div class="icones" id="gsIcones">' + ICONES.map(function (i) {
          return '<button type="button" class="' + (i === icone ? 'on' : '') + '" data-ic="' + i + '">' + i + '</button>';
        }).join('') + '</div></div>' +
        UI.campo('gsOrdem', 'Ordem na lista', s.ordem === undefined ? 100 : s.ordem, 'number', 'inputmode="numeric"', 'Número menor aparece primeiro.') +
        UI.liga('gsAtivo', 'Sala ativa', 'Aparece para os membros e aceita cadastro de alunos.', s.id ? !!s.ativo : true) +
        '<div class="folha-acoes"><button class="btn btn-sec" id="gsCancelar">Cancelar</button>' +
        '<button class="btn btn-primario" id="gsSalvar">Salvar</button></div>' +
        (s.id ? '<button class="btn btn-perigo btn-bloco mt10" id="gsExcluir">🗑️ Excluir sala (apaga alunos e chamadas)</button>' : '') +
        '<div id="gsMsg"></div>',
      montar: function (raiz) {
        UI.$$('[data-ic]', raiz).forEach(function (b) {
          b.onclick = function () {
            icone = b.getAttribute('data-ic');
            UI.$$('[data-ic]', raiz).forEach(function (x) { x.classList.toggle('on', x === b); });
          };
        });
        document.getElementById('gsCancelar').onclick = UI.fecharFolha;
        document.getElementById('gsSalvar').onclick = function () {
          var b = this, msg = document.getElementById('gsMsg');
          var dados = {
            nome: UI.val('gsNome'), faixa: UI.val('gsFaixa'), local: UI.val('gsLocal'), descricao: UI.val('gsDesc'),
            icone: icone, ordem: parseInt(UI.val('gsOrdem'), 10) || 100, ativo: UI.marcado('gsAtivo')
          };
          if (dados.nome.length < 2) { msg.innerHTML = '<div class="msg-erro">Dê um nome para a sala.</div>'; return; }
          b.disabled = true; b.textContent = 'Salvando…';
          (s.id ? DB.Tabela.atualizar('ibnm_ebd_salas', { id: 'eq.' + s.id }, dados) : DB.Tabela.inserir('ibnm_ebd_salas', dados)).then(function () {
            UI.fecharFolha(); UI.toast('Sala salva.'); if (aoSalvar) aoSalvar();
          }).catch(function (e) {
            msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
            b.disabled = false; b.textContent = 'Salvar';
          });
        };
        var ex = document.getElementById('gsExcluir');
        if (ex) ex.onclick = function () {
          if (ex.getAttribute('data-certeza') !== '1') { ex.setAttribute('data-certeza', '1'); ex.textContent = 'Toque de novo para excluir de vez'; return; }
          ex.disabled = true;
          DB.Tabela.apagar('ibnm_ebd_salas', { id: 'eq.' + s.id }).then(function () {
            UI.fecharFolha(); UI.toast('Sala excluída.'); if (aoSalvar) aoSalvar();
          }).catch(function (e) { document.getElementById('gsMsg').innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>'; ex.disabled = false; });
        };
      }
    });
  }

  /* ---------------- professores ---------------- */
  function gestaoProfessores(corpo) {
    carregando(corpo);
    DB.Tabela.listar('ibnm_ebd_matriculas', { filtros: { papel: 'eq.professor', status: 'neq.inativo' }, ordem: 'nome.asc', limite: 400 }).then(function (lista) {
      var pend = lista.filter(function (m) { return m.status === 'pendente'; });
      var html = '';
      if (pend.length) {
        html += '<h3 class="sec-titulo mb10">Pedidos aguardando (' + pend.length + ')</h3><div class="adm-lista mb14">' + pend.map(function (m) {
          return '<div class="adm-item pessoa"><span class="avatar prof">' + UI.esc(UI.iniciais(m.nome)) + '</span><div class="tx"><b>' + UI.esc(m.nome) + '</b>' +
            '<small>quer ensinar em <b>' + UI.esc((sala(m.sala_id) || {}).nome || 'sala') + '</b></small></div>' +
            '<div class="acoes-mini"><button class="mini ok" data-gp-ok="' + m.id + '">Aprovar</button><button class="mini perigo" data-gp-rem="' + m.id + '">Recusar</button></div></div>';
        }).join('') + '</div>';
      }
      html += '<h3 class="sec-titulo mb10">Professores por sala</h3>' + (salas(true).length ? salas(true).map(function (s) {
        var daSala = lista.filter(function (m) { return m.sala_id === s.id && m.status === 'ativo'; });
        return '<div class="card mb10" style="padding:13px"><div class="sec-topo" style="margin:0 0 8px"><b>' + UI.esc(s.icone || '📘') + ' ' + UI.esc(s.nome) + '</b>' +
          '<button class="mini" data-gp-novo="' + s.id + '">➕ Definir</button></div>' +
          (daSala.length ? daSala.map(function (m) {
            return '<div class="horario"><b>' + UI.esc(m.nome) + '</b><button class="mini perigo" data-gp-rem="' + m.id + '">Remover</button></div>';
          }).join('') : '<div class="small">Nenhum professor definido.</div>') + '</div>';
      }).join('') : Views.vazio('🏫', 'Cadastre as salas primeiro', 'Depois você define quem ensina em cada uma.'));
      corpo.innerHTML = html;
      var recarregar = function () { atualizar(true).then(function () { gestaoProfessores(corpo); }); };
      var de = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      UI.$$('[data-gp-ok]', corpo).forEach(function (b) {
        b.onclick = function () {
          DB.Tabela.atualizar('ibnm_ebd_matriculas', { id: 'eq.' + b.getAttribute('data-gp-ok') }, { status: 'ativo' }).then(function () {
            UI.toast('Professor(a) aprovado(a).'); recarregar();
          }).catch(function (e) { UI.toast(e.message); });
        };
      });
      UI.$$('[data-gp-rem]', corpo).forEach(function (b) {
        b.onclick = function () {
          var m = de(b.getAttribute('data-gp-rem'));
          UI.confirmar(m.status === 'pendente' ? 'Recusar pedido' : 'Remover professor(a)', m.nome + ' não vai cuidar desta sala.', m.status === 'pendente' ? 'Recusar' : 'Remover', true).then(function (ok) {
            if (!ok) return;
            DB.Tabela.atualizar('ibnm_ebd_matriculas', { id: 'eq.' + m.id }, { status: 'inativo' }).then(function () { UI.toast('Feito.'); recarregar(); })
              .catch(function (e) { UI.toast(e.message); });
          });
        };
      });
      UI.$$('[data-gp-novo]', corpo).forEach(function (b) {
        b.onclick = function () {
          var s = sala(b.getAttribute('data-gp-novo'));
          DB.Tabela.listar('ibnm_ebd_matriculas', { filtros: { sala_id: 'eq.' + s.id }, limite: 600 }).then(function (daSala) {
            definirProfessor(s, daSala, recarregar);
          }).catch(function (e) { UI.toast(e.message); });
        };
      });
    }).catch(function (e) { erro(corpo, e); });
  }

  /* ---------------- dados gerais ---------------- */
  function gestaoDados(corpo) {
    var c = cfg();
    corpo.innerHTML = '<div class="adm-aviso">Estas informações aparecem no topo da tela da Escola Bíblica.</div>' +
      '<div class="card">' +
      UI.campo('gcHorario', 'Dia e horário', c.horario || '', 'text', 'placeholder="Ex.: Domingos, às 9h"') +
      UI.campo('gcTema', 'Tema do trimestre', c.tema || '') +
      UI.campo('gcRevista', 'Revista / material usado', c.revista || '') +
      UI.area('gcAviso', 'Mensagem de boas-vindas', c.aviso || '', 'Uma frase curta convidando as pessoas.', 70) +
      '</div><button class="btn btn-primario btn-bloco mt14" id="gcSalvar">💾 Salvar</button><div id="gcMsg"></div>';
    document.getElementById('gcSalvar').onclick = function () {
      var b = this, msg = document.getElementById('gcMsg');
      var novo = Object.assign({}, c, { horario: UI.val('gcHorario'), tema: UI.val('gcTema'), revista: UI.val('gcRevista'), aviso: UI.val('gcAviso') });
      b.disabled = true; b.textContent = 'Salvando…';
      DB.Tabela.atualizar('ibnm_config', { chave: 'eq.ebd' }, { valor: novo }).then(function (r) {
        if (!r) throw new Error('Não foi possível salvar. Confira se você ainda cuida desta seção.');
        E().ebdConfig = novo;
        DB.Cache.guardar('ebdConfig', novo);
        msg.innerHTML = '<div class="msg-ok">Dados salvos.</div>';
        UI.toast('Salvo!');
      }).catch(function (e) {
        msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
      }).then(function () { b.disabled = false; b.textContent = '💾 Salvar'; });
    };
  }

  /* ============================================================
     CADASTRO NOVO: "Sou aluno(a) / professor(a)"  (usado em views.js)
     ============================================================ */
  function camposCadastro() {
    var lista = salas(false);
    if (!ativa() || !lista.length) return '';
    return '<div class="campo"><label for="cEbdPapel">Escola Bíblica Dominical</label><select id="cEbdPapel">' +
      '<option value="">Não participo / escolho depois</option><option value="aluno">Sou aluno(a)</option><option value="professor">Sou professor(a)</option></select></div>' +
      '<div class="campo" id="cEbdSalaBox" hidden><label for="cEbdSala">Qual é a sua sala?</label><select id="cEbdSala">' +
      lista.map(function (s) { return '<option value="' + s.id + '">' + UI.esc(s.nome + (s.faixa ? ' — ' + s.faixa : '')) + '</option>'; }).join('') +
      '</select><div class="dica" id="cEbdDica"></div></div>';
  }

  function ligarCadastro() {
    var papel = document.getElementById('cEbdPapel'), box = document.getElementById('cEbdSalaBox');
    if (!papel || !box) return;
    papel.onchange = function () {
      box.hidden = !papel.value;
      document.getElementById('cEbdDica').textContent = papel.value === 'professor'
        ? 'O pedido de professor(a) passa pela aprovação de quem cuida da Escola Bíblica.'
        : 'Seu nome, WhatsApp e data de nascimento ficam visíveis para quem ensina na sala.';
    };
  }

  /* o que a pessoa marcou no formulário de cadastro (lido ANTES de criar a conta, enquanto a tela existe) */
  function escolhaCadastro() {
    var papel = document.getElementById('cEbdPapel'), salaEl = document.getElementById('cEbdSala');
    if (!papel || !papel.value || !salaEl || !salaEl.value) return null;
    return { papel: papel.value, sala: salaEl.value };
  }

  /* chamado logo depois de criar a conta; nunca atrapalha o cadastro se der erro */
  function matricularDoCadastro(escolha) {
    escolha = escolha || escolhaCadastro();
    if (!escolha) return Promise.resolve(null);
    return DB.rpc('ibnm_ebd_matricular', { p_sala: escolha.sala, p_papel: escolha.papel }).catch(function () { return null; });
  }

  /* ============================================================
     ROTAS
     ============================================================ */
  function tela() {
    var p = (location.hash || '').replace(/^#\/?/, '').split('?')[0].split('/');
    if (p[1] === 'sala' && p[2]) return telaSala(decodeURIComponent(p[2]));
    if (p[1] === 'gestao') return telaGestao();
    return telaPrincipal();
  }

  window.IBNM.EBD = {
    tela: tela,
    ativa: ativa,
    participar: participar,
    cartaoParticipacao: cartaoParticipacao,
    ligarParticipacao: ligarParticipacao,
    camposCadastro: camposCadastro,
    ligarCadastro: ligarCadastro,
    escolhaCadastro: escolhaCadastro,
    matricularDoCadastro: matricularDoCadastro,
    papelNome: papelNome,
    atualizar: atualizar
  };
})();
