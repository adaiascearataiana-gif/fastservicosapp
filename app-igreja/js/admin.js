/* ============================================================
   PAINEL DO ADMINISTRADOR — edita todo o conteúdo do app
   ============================================================ */
(function () {
  var DB = window.IBNM.DB;
  var UI = window.IBNM.UI;
  var Auth = DB.Auth;
  var Views = window.IBNM.Views;

  var Adm = { aba: 'igreja' };

  function estado() { return Views.Estado; }
  function cfg() { return estado().config || {}; }

  function salvarConfig(parcial) {
    var atual = Object.assign({}, cfg(), parcial || {});
    return DB.Tabela.atualizar('ibnm_config', { chave: 'eq.igreja' }, { valor: atual }).then(function () {
      estado().config = atual;
      DB.Cache.guardar('config', atual);
      if (window.App && window.App.aplicarConfig) window.App.aplicarConfig();
      return atual;
    });
  }

  /* ---------- pequenos construtores de campo ---------- */
  function campo(id, rotulo, valor, tipo, extra, dica) {
    return '<div class="campo"><label for="' + id + '">' + rotulo + '</label>' +
      '<input id="' + id + '" type="' + (tipo || 'text') + '" value="' + UI.esc(valor || '') + '" ' + (extra || '') + '>' +
      (dica ? '<div class="dica">' + dica + '</div>' : '') + '</div>';
  }
  function area(id, rotulo, valor, dica, altura) {
    return '<div class="campo"><label for="' + id + '">' + rotulo + '</label>' +
      '<textarea id="' + id + '" style="min-height:' + (altura || 120) + 'px">' + UI.esc(valor || '') + '</textarea>' +
      (dica ? '<div class="dica">' + dica + '</div>' : '') + '</div>';
  }
  function ligaSwitch(id, rotulo, sub, ligado) {
    return '<div class="switch"><div class="sw-tx"><b>' + rotulo + '</b><small>' + sub + '</small></div>' +
      '<input type="checkbox" id="' + id + '" ' + (ligado ? 'checked' : '') + '></div>';
  }

  function dataInput(v) { return String(v || '').slice(0, 10); }

  function enviarImagem(arquivo, pasta, aoEnviar) {
    var ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase();
    var caminho = pasta + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
    UI.toast('Enviando imagem…');
    DB.Arquivos.enviar('igreja-publico', caminho, arquivo).then(function () {
      aoEnviar(DB.Arquivos.urlPublica('igreja-publico', caminho));
      UI.toast('Imagem enviada.');
    }).catch(function (e) {
      UI.toast(e.message || 'Não foi possível enviar a imagem.');
    });
  }

  /* ============================================================
     TELA PRINCIPAL
     ============================================================ */
  function admin() {
    if (!Auth.logado()) {
      window.App.ir('#/entrar');
      return { html: '' };
    }
    if (!Auth.ehAdm()) {
      return {
        html: '<div class="detalhe-topo"><button class="voltar" data-ir="#/mais">← Voltar</button></div>' +
          Views.vazio('🔒', 'Área do administrador', 'Sua conta não tem permissão de administrador. Fale com a liderança da igreja.')
      };
    }

    var abas = [
      ['igreja', '⛪ Igreja'],
      ['pix', '💚 PIX e oferta'],
      ['radio', '📻 Rádio'],
      ['devocional', '📖 Devocional'],
      ['eventos', '📅 Agenda'],
      ['palavra', '💬 Palavra'],
      ['avisos', '📌 Avisos'],
      ['oracoes', '🙏 Orações'],
      ['ofertas', '💰 Ofertas'],
      ['membros', '👥 Membros']
    ];

    var html = '<div class="detalhe-topo"><button class="voltar" data-ir="#/mais">← Voltar</button></div>' +
      '<div class="adm-topo"><span class="adm-ic">🛠️</span><div><b>Painel do administrador</b>' +
      '<small>Tudo que você escrever aqui aparece no app.</small></div></div>' +
      '<div class="adm-abas">' + abas.map(function (a) {
        return '<button data-adm="' + a[0] + '" class="' + (Adm.aba === a[0] ? 'on' : '') + '">' + a[1] + '</button>';
      }).join('') + '</div><div id="admCorpo"></div>';

    return {
      html: html,
      montar: function (raiz) {
        UI.$$('[data-adm]', raiz).forEach(function (b) {
          b.onclick = function () {
            Adm.aba = b.getAttribute('data-adm');
            window.App.ir('#/admin');
          };
        });
        abrirAba();
      }
    };
  }

  function abrirAba() {
    var corpo = document.getElementById('admCorpo');
    if (!corpo) return;
    corpo.innerHTML = '<div class="esqueleto" style="height:120px"></div>';
    var fn = {
      igreja: abaIgreja,
      pix: abaPix,
      radio: abaRadio,
      devocional: abaDevocional,
      eventos: abaEventos,
      palavra: abaPalavra,
      avisos: abaAvisos,
      oracoes: abaOracoes,
      ofertas: abaOfertas,
      membros: abaMembros
    }[Adm.aba] || abaIGrejaErro;
    fn(corpo);
  }

  function abaIGrejaErro(corpo) { corpo.innerHTML = '<div class="vazio">Escolha uma aba acima.</div>'; }

  /* ============================================================
     IGREJA
     ============================================================ */
  function abaIgreja(corpo) {
    var c = cfg();
    var links = c.links || {};
    var horarios = Array.isArray(c.horarios) ? c.horarios : [];

    corpo.innerHTML =
      '<div class="adm-aviso">Preencha os dados da igreja. Eles aparecem na tela inicial, no menu <b>Nossa igreja</b> e nos botões de contato.</div>' +
      '<div class="card">' +
      campo('igNome', 'Nome da igreja', c.nome || '', 'text', '', 'Ex.: Igreja Batista em Nova Metrópole') +
      '<div class="linha">' + campo('igSigla', 'Sigla', c.sigla || '', 'text') + campo('igPastor', 'Pastor', c.pastor || '') + '</div>' +
      area('igBoas', 'Mensagem de boas-vindas (tela inicial)', c.boas_vindas || '', 'Uma frase curta e acolhedora.', 80) +
      '<div class="linha"><div class="campo" style="flex:3">' + '<label>Endereço</label><input id="igEnd" value="' + UI.esc(c.endereco || '') + '" placeholder="Rua, avenida…"></div>' +
      '<div class="campo curto"><label>Número</label><input id="igNum" value="' + UI.esc(c.numero || '') + '"></div></div>' +
      '<div class="linha">' + campo('igBairro', 'Bairro', c.bairro || '') + campo('igCidade', 'Cidade', c.cidade || '') + campo('igUf', 'UF', c.uf || '', 'text', 'maxlength="2"') + '</div>' +
      '<div class="linha">' + campo('igCep', 'CEP', c.cep || '', 'text', 'inputmode="numeric" maxlength="9"') + campo('igTel', 'Telefone', c.telefone || '', 'tel', 'inputmode="tel"') + '</div>' +
      '<div class="linha">' + campo('igWpp', 'WhatsApp', c.whatsapp || '', 'tel', 'inputmode="tel"', 'Com DDD. Ex.: 85999998888') + campo('igEmail', 'E-mail', c.email || '', 'email') + '</div>' +
      '</div>' +

      '<section class="secao"><h3 class="sec-titulo mb10">Horários dos cultos</h3><div class="card">' +
      '<div id="listaHorarios">' + horarios.map(function (h, i) { return linhaHorario(h, i); }).join('') + '</div>' +
      '<button class="btn btn-sec btn-bloco mt10" id="addHorario">➕ Adicionar horário</button></div></section>' +

      '<section class="secao"><h3 class="sec-titulo mb10">Redes sociais e links</h3><div class="card">' +
      campo('igInsta', 'Instagram (link completo)', links.instagram || '', 'url', 'placeholder="https://instagram.com/suaigreja"') +
      campo('igYoutube', 'YouTube (link completo)', links.youtube || '', 'url', 'placeholder="https://youtube.com/@suaigreja"') +
      campo('igFace', 'Facebook (opcional)', links.facebook || '', 'url') +
      campo('igSite', 'Site (opcional)', links.site || '', 'url') +
      campo('igMaps', 'Link do mapa (opcional)', links.maps || '', 'url', 'placeholder="https://maps.google.com/…"', 'Se ficar vazio, usamos o endereço acima.') +
      '</div></section>' +

      '<button class="btn btn-primario btn-bloco" id="igSalvar">💾 Salvar dados da igreja</button>' +
      '<div id="igMsg"></div>';

    var addBtn = document.getElementById('addHorario');
    addBtn.onclick = function () {
      var lista = document.getElementById('listaHorarios');
      var div = document.createElement('div');
      div.innerHTML = linhaHorario({ dia: '', hora: '', titulo: '' }, lista.children.length);
      lista.appendChild(div.firstChild);
      ligarLinhaHorario(lista.lastChild);
    };
    UI.$$('.horario-edit', corpo).forEach(ligarLinhaHorario);

    document.getElementById('igSalvar').onclick = function () {
      var b = this;
      var horariosNovos = UI.$$('.horario-edit').map(function (l) {
        var ins = UI.$$('input', l);
        return { dia: ins[0].value.trim(), hora: ins[1].value.trim(), titulo: ins[2].value.trim() };
      }).filter(function (h) { return h.dia || h.titulo; });

      var novo = {
        nome: document.getElementById('igNome').value.trim(),
        sigla: document.getElementById('igSigla').value.trim(),
        pastor: document.getElementById('igPastor').value.trim(),
        boas_vindas: document.getElementById('igBoas').value.trim(),
        endereco: document.getElementById('igEnd').value.trim(),
        numero: document.getElementById('igNum').value.trim(),
        bairro: document.getElementById('igBairro').value.trim(),
        cidade: document.getElementById('igCidade').value.trim(),
        uf: document.getElementById('igUf').value.trim().toUpperCase(),
        cep: document.getElementById('igCep').value.trim(),
        telefone: document.getElementById('igTel').value.trim(),
        whatsapp: document.getElementById('igWpp').value.trim(),
        email: document.getElementById('igEmail').value.trim(),
        horarios: horariosNovos,
        links: {
          instagram: document.getElementById('igInsta').value.trim(),
          youtube: document.getElementById('igYoutube').value.trim(),
          facebook: document.getElementById('igFace').value.trim(),
          site: document.getElementById('igSite').value.trim(),
          maps: document.getElementById('igMaps').value.trim()
        }
      };
      b.disabled = true; b.textContent = 'Salvando…';
      salvarConfig(novo).then(function () {
        document.getElementById('igMsg').innerHTML = '<div class="msg-ok">Dados da igreja salvos.</div>';
        UI.toast('Salvo!');
      }).catch(function (e) {
        document.getElementById('igMsg').innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
      }).then(function () { b.disabled = false; b.textContent = '💾 Salvar dados da igreja'; });
    };
  }

  function linhaHorario(h, i) {
    return '<div class="horario-edit">' +
      '<input class="curto" value="' + UI.esc(h.dia || '') + '" placeholder="Domingo">' +
      '<input class="curto" value="' + UI.esc(h.hora || '') + '" placeholder="18:00">' +
      '<input value="' + UI.esc(h.titulo || '') + '" placeholder="Culto de Celebração">' +
      '<button type="button" class="x" title="Remover">✕</button></div>';
  }

  function ligarLinhaHorario(el) {
    var x = el.querySelector('.x');
    if (x) x.onclick = function () { el.remove(); };
  }

  /* ============================================================
     PIX E OFERTA
     ============================================================ */
  function abaPix(corpo) {
    var c = cfg();
    var pix = c.pix || {};
    var of = c.oferta || {};
    var tipos = Array.isArray(of.tipos) ? of.tipos.join(', ') : 'Dízimo, Oferta, Missões';
    var tiposPix = [['telefone', 'Telefone / celular'], ['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['email', 'E-mail'], ['aleatoria', 'Chave aleatória']];

    corpo.innerHTML =
      '<div class="adm-aviso">A chave PIX fica visível para quem abre o app. Confira com atenção antes de salvar. O QR Code é gerado automaticamente com o nome e a cidade abaixo.</div>' +
      '<div class="card">' +
      '<div class="campo"><label for="pxTipo">Tipo da chave</label><select id="pxTipo">' +
      tiposPix.map(function (t) { return '<option value="' + t[0] + '" ' + (pix.tipo === t[0] ? 'selected' : '') + '>' + t[1] + '</option>'; }).join('') +
      '</select></div>' +
      campo('pxChave', 'Chave PIX da igreja', pix.chave || '', 'text', 'placeholder="Ex.: 85999998888 ou igreja@email.com"', 'Digite só a chave, sem espaços.') +
      campo('pxNome', 'Nome do recebedor (como no banco)', pix.nome || '', 'text', 'maxlength="25"', 'Máximo 25 letras. Aparece no QR Code.') +
      campo('pxCidade', 'Cidade do recebedor', pix.cidade || '', 'text', 'maxlength="15"', 'Máximo 15 letras. Ex.: CAUCAIA') +
      area('pxMsg', 'Mensagem na tela de oferta', pix.mensagem || '', '', 70) +
      '<div class="linha">' + campo('ofTipos', 'Tipos de oferta (separados por vírgula)', tipos, 'text') + '</div>' +
      ligaSwitch('ofAtiva', 'Receber ofertas pelo app', 'Se desligar, a tela de oferta avisa que está indisponível.', of.ativa !== false) +
      '</div>' +
      '<button class="btn btn-primario btn-bloco mt14" id="pxSalvar">💾 Salvar PIX e oferta</button>' +
      '<div id="pxResultado"></div>';

    document.getElementById('pxSalvar').onclick = function () {
      var b = this;
      var tipo = document.getElementById('pxTipo').value;
      var chave = document.getElementById('pxChave').value.trim();
      var erro = window.IBNM.PIX.validar(chave, tipo);
      var res = document.getElementById('pxResultado');
      if (erro) { res.innerHTML = '<div class="msg-erro">' + UI.esc(erro) + '</div>'; return; }

      var novoPix = {
        chave: chave,
        tipo: tipo,
        nome: document.getElementById('pxNome').value.trim(),
        cidade: document.getElementById('pxCidade').value.trim(),
        mensagem: document.getElementById('pxMsg').value.trim()
      };
      var novaOferta = Object.assign({}, of, {
        ativa: document.getElementById('ofAtiva').checked,
        tipos: document.getElementById('ofTipos').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean)
      });

      b.disabled = true; b.textContent = 'Salvando…';
      salvarConfig({ pix: novoPix, oferta: novaOferta }).then(function () {
        var payload = window.IBNM.PIX.montarPayload({
          chave: novoPix.chave, tipo: novoPix.tipo, nome: novoPix.nome || cfg().nome,
          cidade: novoPix.cidade || cfg().cidade, valor: 0
        });
        res.innerHTML = '<div class="msg-ok">Chave PIX salva com sucesso.</div>' +
          '<div class="card mt14 pix-card"><div class="pix-qr">' + window.IBNM.PIX.qrSvg(payload, {}) + '</div>' +
          '<div class="pix-chave">' + UI.esc(window.IBNM.PIX.bonita(novoPix.chave, novoPix.tipo)) + '</div>' +
          '<div class="small mt10">Confira se o QR Code abre a conta certa antes de divulgar.</div></div>';
        UI.toast('PIX salvo!');
      }).catch(function (e) {
        res.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
      }).then(function () { b.disabled = false; b.textContent = '💾 Salvar PIX e oferta'; });
    };
  }

  /* ============================================================
     RÁDIO (ligar quando quiser)
     ============================================================ */
  function abaRadio(corpo) {
    var r = cfg().radio || {};
    corpo.innerHTML =
      '<div class="adm-aviso">A rádio já está pronta no app, mas <b>desligada</b>. Quando você tiver o link da rádio, cole abaixo e ligue a chave. Na hora aparece um player para todos os membros. Para desligar depois, é só desativar.</div>' +
      '<div class="card">' +
      ligaSwitch('rdAtiva', 'Rádio da igreja ligada', 'Mostra o player no app para todos.', !!r.ativa) +
      ligaSwitch('rdVivo', 'Marcar como "ao vivo"', 'Exibe o selo vermelho de transmissão ao vivo.', !!r.ao_vivo) +
      campo('rdNome', 'Nome da rádio', r.nome || 'Rádio IBNM') +
      campo('rdUrl', 'Link do áudio (stream)', r.url || '', 'url', 'placeholder="https://…"', 'Aceita link .mp3, .m3u8 ou de rádio online (Icecast/Shoutcast).') +
      campo('rdCapa', 'Imagem da rádio (link)', r.capa || '', 'url', 'placeholder="https://…/capa.jpg"') +
      area('rdMsg', 'Mensagem da rádio', r.mensagem || '', '', 70) +
      '</div>' +
      '<button class="btn btn-primario btn-bloco mt14" id="rdSalvar">💾 Salvar rádio</button>' +
      '<div id="rdMsgBox"></div>' +
      (r.ativa && r.url ? '<div class="mt20"><button class="btn btn-dourado btn-bloco" id="rdTestar">▶️ Testar agora</button></div>' : '');

    document.getElementById('rdSalvar').onclick = function () {
      var b = this;
      var novo = {
        ativa: document.getElementById('rdAtiva').checked,
        ao_vivo: document.getElementById('rdVivo').checked,
        nome: document.getElementById('rdNome').value.trim() || 'Rádio IBNM',
        url: document.getElementById('rdUrl').value.trim(),
        capa: document.getElementById('rdCapa').value.trim(),
        mensagem: document.getElementById('rdMsg').value.trim()
      };
      var box = document.getElementById('rdMsgBox');
      if (novo.ativa && !novo.url) {
        box.innerHTML = '<div class="msg-erro">Para ligar a rádio, informe o link do áudio.</div>';
        return;
      }
      b.disabled = true; b.textContent = 'Salvando…';
      salvarConfig({ radio: novo }).then(function () {
        box.innerHTML = '<div class="msg-ok">Rádio ' + (novo.ativa ? 'ligada' : 'desligada') + '. ' +
          (novo.ativa ? 'O player já aparece no app.' : 'Nada aparece para os membros.') + '</div>';
        if (window.App && window.App.aplicarRadio) window.App.aplicarRadio();
      }).catch(function (e) {
        box.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
      }).then(function () { b.disabled = false; b.textContent = '💾 Salvar rádio'; });
    };

    var t = document.getElementById('rdTestar');
    if (t) t.onclick = function () { window.App.tocarRadio(true); };
  }

  /* ============================================================
     DEVOCIONAL
     ============================================================ */
  function abaDevocional(corpo) {
    DB.Tabela.listar('ibnm_devocionais', { ordem: 'data.desc', limite: 60 }).then(function (lista) {
      estado().devocionais = lista || [];
      corpo.innerHTML =
        '<button class="btn btn-primario btn-bloco" id="dvNovo">➕ Escrever devocional</button>' +
        '<div class="adm-aviso mt14">O devocional com a data de <b>hoje</b> aparece em destaque na tela inicial. Se não houver devocional de hoje, o app mostra o mais recente.</div>' +
        '<div class="adm-lista mt14">' + (lista.length ? lista.map(function (d) {
          return '<div class="adm-item"><div class="tx"><b>' + UI.esc(d.titulo || '(sem título)') + '</b>' +
            '<small>' + UI.dataBR(d.data) + (d.referencia ? ' • ' + UI.esc(d.referencia) : '') +
            ' • ' + (d.publicado ? '<span class="badge-on">publicado</span>' : '<span class="badge-off">oculto</span>') + '</small></div>' +
            '<div class="acoes-mini">' +
            '<button class="mini" data-edit-dv="' + d.id + '">Editar</button>' +
            '<button class="mini " data-pub-dv="' + d.id + '">' + (d.publicado ? 'Ocultar' : 'Publicar') + '</button>' +
            '<button class="mini perigo" data-del-dv="' + d.id + '">Excluir</button>' +
            '</div></div>';
        }).join('') : Views.vazio('📖', 'Nenhum devocional', 'Toque no botão acima para escrever o primeiro.')) + '</div>';

      document.getElementById('dvNovo').onclick = function () { editorDevocional(null); };
      UI.$$('[data-edit-dv]', corpo).forEach(function (b) {
        b.onclick = function () {
          editorDevocional(estado().devocionais.filter(function (x) { return String(x.id) === b.getAttribute('data-edit-dv'); })[0]);
        };
      });
      UI.$$('[data-pub-dv]', corpo).forEach(function (b) {
        b.onclick = function () {
          var d = estado().devocionais.filter(function (x) { return String(x.id) === b.getAttribute('data-pub-dv'); })[0];
          DB.Tabela.atualizar('ibnm_devocionais', { id: 'eq.' + d.id }, { publicado: !d.publicado }).then(function () {
            UI.toast(d.publicado ? 'Devocional ocultado.' : 'Devocional publicado!');
            window.App.recarregar();
          });
        };
      });
      UI.$$('[data-del-dv]', corpo).forEach(function (b) {
        b.onclick = function () {
          UI.confirmar('Excluir devocional', 'Esta ação não pode ser desfeita.', 'Excluir', true).then(function (ok) {
            if (!ok) return;
            DB.Tabela.apagar('ibnm_devocionais', { id: 'eq.' + b.getAttribute('data-del-dv') }).then(function () {
              UI.toast('Devocional excluído.');
              window.App.recarregar();
            });
          });
        };
      });
    }).catch(function (e) {
      corpo.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
    });
  }

  function editorDevocional(d) {
    d = d || {};
    var hoje = UI.hojeISO();
    UI.abrirFolha({
      titulo: d.id ? 'Editar devocional' : 'Novo devocional',
      sub: 'Escreva com calma. O texto aparece exatamente como aqui.',
      html:
        '<div class="linha">' + campo('dvData', 'Data', dataInput(d.data) || hoje, 'date') +
        campo('dvAutor', 'Autor', d.autor || 'Pastor') + '</div>' +
        campo('dvTitulo', 'Título', d.titulo || '', 'text', 'placeholder="Ex.: A esperança que não decepciona"') +
        area('dvVersiculo', 'Versículo', d.versiculo || '', 'Texto bíblico do dia.', 70) +
        campo('dvRef', 'Referência', d.referencia || '', 'text', 'placeholder="Ex.: Isaías 40:31"') +
        area('dvTexto', 'Mensagem', d.texto || '', 'Pode escrever vários parágrafos.', 170) +
        ligaSwitch('dvPub', 'Publicar agora', 'Se desligar, fica salvo mas ninguém vê.', d.publicado !== false) +
        '<div class="folha-acoes"><button class="btn btn-sec" id="dvCancelar">Cancelar</button>' +
        '<button class="btn btn-primario" id="dvSalvar">Salvar</button></div>' +
        '<div id="dvMsg"></div>',
      montar: function () {
        document.getElementById('dvCancelar').onclick = UI.fecharFolha;
        document.getElementById('dvSalvar').onclick = function () {
          var b = this, msg = document.getElementById('dvMsg');
          var dados = {
            data: document.getElementById('dvData').value || hoje,
            titulo: document.getElementById('dvTitulo').value.trim(),
            versiculo: document.getElementById('dvVersiculo').value.trim(),
            referencia: document.getElementById('dvRef').value.trim(),
            texto: document.getElementById('dvTexto').value.trim(),
            autor: document.getElementById('dvAutor').value.trim(),
            publicado: document.getElementById('dvPub').checked
          };
          if (!dados.titulo) { msg.innerHTML = '<div class="msg-erro">Dê um título ao devocional.</div>'; return; }
          if (!dados.texto) { msg.innerHTML = '<div class="msg-erro">Escreva a mensagem do devocional.</div>'; return; }
          b.disabled = true; b.textContent = 'Salvando…';
          var acao = d.id
            ? DB.Tabela.atualizar('ibnm_devocionais', { id: 'eq.' + d.id }, dados)
            : DB.Tabela.inserir('ibnm_devocionais', dados, { upsert: true, conflito: 'data' });
          acao.then(function () {
            UI.fecharFolha();
            UI.toast('Devocional salvo.');
            window.App.recarregar();
          }).catch(function (e) {
            msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
            b.disabled = false; b.textContent = 'Salvar';
          });
        };
      }
    });
  }

  /* ============================================================
     EVENTOS
     ============================================================ */
  function abaEventos(corpo) {
    DB.Tabela.listar('ibnm_eventos', { ordem: 'data.asc.nullslast', limite: 200 }).then(function (lista) {
      estado().eventos = lista || [];
      corpo.innerHTML =
        '<button class="btn btn-primario btn-bloco" id="evNovo">➕ Adicionar culto ou programação</button>' +
        '<div class="adm-aviso mt14">Use <b>toda semana</b> para os cultos fixos (domingo, quarta…). Use <b>data única</b> para eventos especiais, congressos e atividades.</div>' +
        '<div class="adm-lista mt14">' + (lista.length ? lista.map(function (e) {
          var quando = e.recorrente
            ? 'Toda ' + UI.DIAS[e.dia_semana || 0]
            : UI.dataBR(e.data);
          return '<div class="adm-item"><div class="tx"><b>' + UI.esc(e.titulo) + '</b>' +
            '<small>' + quando + (e.hora ? ' • ' + UI.hora(e.hora) : '') + ' • ' + UI.esc(UI.catNome(e.categoria)) +
            ' • ' + (e.publicado ? '<span class="badge-on">publicado</span>' : '<span class="badge-off">oculto</span>') + '</small></div>' +
            '<div class="acoes-mini">' +
            '<button class="mini" data-edit-ev="' + e.id + '">Editar</button>' +
            '<button class="mini" data-pub-ev="' + e.id + '">' + (e.publicado ? 'Ocultar' : 'Publicar') + '</button>' +
            '<button class="mini perigo" data-del-ev="' + e.id + '">Excluir</button>' +
            '</div></div>';
        }).join('') : Views.vazio('📅', 'Nenhum evento', 'Cadastre os cultos da semana e as programações da igreja.')) + '</div>';

      document.getElementById('evNovo').onclick = function () { editorEvento(null); };
      UI.$$('[data-edit-ev]', corpo).forEach(function (b) {
        b.onclick = function () {
          editorEvento(estado().eventos.filter(function (x) { return String(x.id) === b.getAttribute('data-edit-ev'); })[0]);
        };
      });
      UI.$$('[data-pub-ev]', corpo).forEach(function (b) {
        b.onclick = function () {
          var e = estado().eventos.filter(function (x) { return String(x.id) === b.getAttribute('data-pub-ev'); })[0];
          DB.Tabela.atualizar('ibnm_eventos', { id: 'eq.' + e.id }, { publicado: !e.publicado }).then(function () {
            UI.toast(e.publicado ? 'Evento ocultado.' : 'Evento publicado!');
            window.App.recarregar();
          });
        };
      });
      UI.$$('[data-del-ev]', corpo).forEach(function (b) {
        b.onclick = function () {
          UI.confirmar('Excluir evento', 'Esta ação não pode ser desfeita.', 'Excluir', true).then(function (ok) {
            if (!ok) return;
            DB.Tabela.apagar('ibnm_eventos', { id: 'eq.' + b.getAttribute('data-del-ev') }).then(function () {
              UI.toast('Evento excluído.');
              window.App.recarregar();
            });
          });
        };
      });
    }).catch(function (e) { corpo.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>'; });
  }

  function editorEvento(ev) {
    ev = ev || {};
    var recorrente = !!ev.recorrente;
    var cats = [['culto', 'Culto'], ['programacao', 'Programação'], ['atividade', 'Atividade'], ['reuniao', 'Reunião'], ['especial', 'Especial']];

    UI.abrirFolha({
      titulo: ev.id ? 'Editar evento' : 'Novo evento',
      sub: 'Preencha e salve. Ele já aparece na agenda.',
      html:
        campo('evTitulo', 'Título', ev.titulo || '', 'text', 'placeholder="Ex.: Culto de Celebração"') +
        '<div class="campo"><label>Tipo</label><select id="evCat">' +
        cats.map(function (c) { return '<option value="' + c[0] + '" ' + (ev.categoria === c[0] ? 'selected' : '') + '>' + c[1] + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="switch"><div class="sw-tx"><b>Repete toda semana</b><small>Marque para os cultos fixos.</small></div>' +
        '<input type="checkbox" id="evRec" ' + (recorrente ? 'checked' : '') + '></div>' +
        '<div id="evDataBox" ' + (recorrente ? 'hidden' : '') + '>' + campo('evData', 'Data', dataInput(ev.data) || UI.hojeISO(), 'date') + '</div>' +
        '<div id="evSemanaBox" ' + (recorrente ? '' : 'hidden') + '><div class="campo"><label>Dia da semana</label><select id="evDia">' +
        UI.DIAS.map(function (d, i) { return '<option value="' + i + '" ' + (Number(ev.dia_semana) === i ? 'selected' : '') + '>' + UI.capitalizar(d) + '</option>'; }).join('') +
        '</select></div></div>' +
        '<div class="linha">' + campo('evHora', 'Hora de início', String(ev.hora || '').slice(0, 5), 'time') + campo('evHoraFim', 'Hora de término (opcional)', String(ev.hora_fim || '').slice(0, 5), 'time') + '</div>' +
        campo('evLocal', 'Local', ev.local || '', 'text', 'placeholder="Ex.: Templo da IBNM"') +
        area('evDesc', 'Descrição', ev.descricao || '', 'Uma frase que ajude as pessoas a entender.', 90) +
        ligaSwitch('evPub', 'Publicar agora', 'Se desligar, fica salvo mas ninguém vê.', ev.publicado !== false) +
        '<div class="folha-acoes"><button class="btn btn-sec" id="evCancelar">Cancelar</button>' +
        '<button class="btn btn-primario" id="evSalvar">Salvar</button></div><div id="evMsg"></div>',
      montar: function () {
        var rec = document.getElementById('evRec');
        rec.onchange = function () {
          document.getElementById('evDataBox').hidden = rec.checked;
          document.getElementById('evSemanaBox').hidden = !rec.checked;
        };
        document.getElementById('evCancelar').onclick = UI.fecharFolha;
        document.getElementById('evSalvar').onclick = function () {
          var b = this, msg = document.getElementById('evMsg');
          var dados = {
            titulo: document.getElementById('evTitulo').value.trim(),
            categoria: document.getElementById('evCat').value,
            recorrente: rec.checked,
            data: rec.checked ? null : (document.getElementById('evData').value || UI.hojeISO()),
            dia_semana: rec.checked ? Number(document.getElementById('evDia').value) : null,
            hora: document.getElementById('evHora').value || null,
            hora_fim: document.getElementById('evHoraFim').value || null,
            local: document.getElementById('evLocal').value.trim(),
            descricao: document.getElementById('evDesc').value.trim(),
            publicado: document.getElementById('evPub').checked
          };
          if (!dados.titulo) { msg.innerHTML = '<div class="msg-erro">Dê um nome ao evento.</div>'; return; }
          b.disabled = true; b.textContent = 'Salvando…';
          var acao = ev.id
            ? DB.Tabela.atualizar('ibnm_eventos', { id: 'eq.' + ev.id }, dados)
            : DB.Tabela.inserir('ibnm_eventos', dados);
          acao.then(function () {
            UI.fecharFolha();
            UI.toast('Evento salvo.');
            window.App.recarregar();
          }).catch(function (e) {
            msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
            b.disabled = false; b.textContent = 'Salvar';
          });
        };
      }
    });
  }

  /* ============================================================
     PALAVRA PASTORAL
     ============================================================ */
  function abaPalavra(corpo) {
    DB.Tabela.listar('ibnm_palavras', { ordem: 'data.desc', limite: 60 }).then(function (lista) {
      estado().palavras = lista || [];
      corpo.innerHTML =
        '<button class="btn btn-primario btn-bloco" id="paNovo">➕ Escrever palavra pastoral</button>' +
        '<div class="adm-aviso mt14">A palavra mais recente aparece na tela inicial. As demais ficam em <b>Palavra pastoral</b>.</div>' +
        '<div class="adm-lista mt14">' + (lista.length ? lista.map(function (p) {
          return '<div class="adm-item"><div class="tx"><b>' + UI.esc(p.titulo || '(sem título)') + '</b>' +
            '<small>' + UI.esc(p.autor || 'Pastor') + ' • ' + UI.dataBR(p.data) +
            ' • ' + (p.publicado ? '<span class="badge-on">publicado</span>' : '<span class="badge-off">oculto</span>') + '</small></div>' +
            '<div class="acoes-mini"><button class="mini" data-edit-pa="' + p.id + '">Editar</button>' +
            '<button class="mini" data-pub-pa="' + p.id + '">' + (p.publicado ? 'Ocultar' : 'Publicar') + '</button>' +
            '<button class="mini perigo" data-del-pa="' + p.id + '">Excluir</button></div></div>';
        }).join('') : Views.vazio('💬', 'Nenhuma palavra', 'Escreva a primeira mensagem pastoral.')) + '</div>';

      document.getElementById('paNovo').onclick = function () { editorPalavra(null); };
      UI.$$('[data-edit-pa]', corpo).forEach(function (b) {
        b.onclick = function () { editorPalavra(estado().palavras.filter(function (x) { return String(x.id) === b.getAttribute('data-edit-pa'); })[0]); };
      });
      UI.$$('[data-pub-pa]', corpo).forEach(function (b) {
        b.onclick = function () {
          var p = estado().palavras.filter(function (x) { return String(x.id) === b.getAttribute('data-pub-pa'); })[0];
          DB.Tabela.atualizar('ibnm_palavras', { id: 'eq.' + p.id }, { publicado: !p.publicado }).then(function () {
            UI.toast(p.publicado ? 'Palavra ocultada.' : 'Palavra publicada!');
            window.App.recarregar();
          });
        };
      });
      UI.$$('[data-del-pa]', corpo).forEach(function (b) {
        b.onclick = function () {
          UI.confirmar('Excluir palavra', 'Esta ação não pode ser desfeita.', 'Excluir', true).then(function (ok) {
            if (!ok) return;
            DB.Tabela.apagar('ibnm_palavras', { id: 'eq.' + b.getAttribute('data-del-pa') }).then(function () {
              UI.toast('Palavra excluída.');
              window.App.recarregar();
            });
          });
        };
      });
    }).catch(function (e) { corpo.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>'; });
  }

  function editorPalavra(p) {
    p = p || {};
    UI.abrirFolha({
      titulo: p.id ? 'Editar palavra pastoral' : 'Nova palavra pastoral',
      html:
        campo('paTitulo', 'Título', p.titulo || '') +
        '<div class="linha">' + campo('paAutor', 'Autor', p.autor || 'Pastor') + campo('paData', 'Data', dataInput(p.data) || UI.hojeISO(), 'date') + '</div>' +
        area('paResumo', 'Resumo (aparece na lista)', p.resumo || '', 'Uma ou duas frases.', 70) +
        area('paTexto', 'Mensagem completa', p.texto || '', '', 180) +
        campo('paImagem', 'Imagem (link, opcional)', p.imagem || '', 'url') +
        '<div class="mt10"><label class="rotulo" style="font-size:.78rem;font-weight:800">Ou envie uma imagem do celular</label>' +
        '<input type="file" accept="image/*" id="paFile" style="width:100%;padding:9px;border:1px dashed #cfe0d6;border-radius:12px;font-size:.82rem"></div>' +
        ligaSwitch('paPub', 'Publicar agora', '', p.publicado !== false) +
        '<div class="folha-acoes"><button class="btn btn-sec" id="paCancelar">Cancelar</button>' +
        '<button class="btn btn-primario" id="paSalvar">Salvar</button></div><div id="paMsg"></div>',
      montar: function () {
        var f = document.getElementById('paFile');
        f.onchange = function () {
          if (!f.files || !f.files[0]) return;
          enviarImagem(f.files[0], 'palavras', function (url) { document.getElementById('paImagem').value = url; });
        };
        document.getElementById('paCancelar').onclick = UI.fecharFolha;
        document.getElementById('paSalvar').onclick = function () {
          var b = this, msg = document.getElementById('paMsg');
          var dados = {
            titulo: document.getElementById('paTitulo').value.trim(),
            autor: document.getElementById('paAutor').value.trim(),
            data: document.getElementById('paData').value || UI.hojeISO(),
            resumo: document.getElementById('paResumo').value.trim(),
            texto: document.getElementById('paTexto').value.trim(),
            imagem: document.getElementById('paImagem').value.trim(),
            publicado: document.getElementById('paPub').checked
          };
          if (!dados.titulo || !dados.texto) { msg.innerHTML = '<div class="msg-erro">Título e mensagem são obrigatórios.</div>'; return; }
          b.disabled = true; b.textContent = 'Salvando…';
          var acao = p.id ? DB.Tabela.atualizar('ibnm_palavras', { id: 'eq.' + p.id }, dados) : DB.Tabela.inserir('ibnm_palavras', dados);
          acao.then(function () {
            UI.fecharFolha(); UI.toast('Palavra salva.'); window.App.recarregar();
          }).catch(function (e) {
            msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
            b.disabled = false; b.textContent = 'Salvar';
          });
        };
      }
    });
  }

  /* ============================================================
     AVISOS
     ============================================================ */
  function abaAvisos(corpo) {
    DB.Tabela.listar('ibnm_avisos', { ordem: 'criado_em.desc', limite: 60 }).then(function (lista) {
      estado().avisos = lista || [];
      corpo.innerHTML =
        '<button class="btn btn-primario btn-bloco" id="avNovo">➕ Criar aviso</button>' +
        '<div class="adm-aviso mt14">Os avisos aparecem na tela inicial. Use <b>importante</b> para o que precisa de atenção.</div>' +
        '<div class="adm-lista mt14">' + (lista.length ? lista.map(function (a) {
          return '<div class="adm-item"><div class="tx"><b>' + UI.esc(a.titulo) + '</b>' +
            '<small>' + UI.esc(String(a.texto || '').slice(0, 80)) + (a.expira_em ? ' • até ' + UI.dataBR(a.expira_em) : '') +
            ' • ' + (a.publicado ? '<span class="badge-on">publicado</span>' : '<span class="badge-off">oculto</span>') + '</small></div>' +
            '<div class="acoes-mini"><button class="mini" data-edit-av="' + a.id + '">Editar</button>' +
            '<button class="mini" data-pub-av="' + a.id + '">' + (a.publicado ? 'Ocultar' : 'Publicar') + '</button>' +
            '<button class="mini perigo" data-del-av="' + a.id + '">Excluir</button></div></div>';
        }).join('') : Views.vazio('📌', 'Nenhum aviso', 'Crie o primeiro aviso da igreja.')) + '</div>';

      document.getElementById('avNovo').onclick = function () { editorAviso(null); };
      UI.$$('[data-edit-av]', corpo).forEach(function (b) {
        b.onclick = function () { editorAviso(estado().avisos.filter(function (x) { return String(x.id) === b.getAttribute('data-edit-av'); })[0]); };
      });
      UI.$$('[data-pub-av]', corpo).forEach(function (b) {
        b.onclick = function () {
          var a = estado().avisos.filter(function (x) { return String(x.id) === b.getAttribute('data-pub-av'); })[0];
          DB.Tabela.atualizar('ibnm_avisos', { id: 'eq.' + a.id }, { publicado: !a.publicado }).then(function () {
            UI.toast(a.publicado ? 'Aviso ocultado.' : 'Aviso publicado!');
            window.App.recarregar();
          });
        };
      });
      UI.$$('[data-del-av]', corpo).forEach(function (b) {
        b.onclick = function () {
          UI.confirmar('Excluir aviso', 'Esta ação não pode ser desfeita.', 'Excluir', true).then(function (ok) {
            if (!ok) return;
            DB.Tabela.apagar('ibnm_avisos', { id: 'eq.' + b.getAttribute('data-del-av') }).then(function () {
              UI.toast('Aviso excluído.'); window.App.recarregar();
            });
          });
        };
      });
    }).catch(function (e) { corpo.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>'; });
  }

  function editorAviso(a) {
    a = a || {};
    UI.abrirFolha({
      titulo: a.id ? 'Editar aviso' : 'Novo aviso',
      html:
        campo('avTitulo', 'Título', a.titulo || '') +
        area('avTexto', 'Texto do aviso', a.texto || '', '', 110) +
        '<div class="campo"><label>Prioridade</label><select id="avUrg">' +
        '<option value="normal" ' + (a.urgencia !== 'importante' ? 'selected' : '') + '>Normal</option>' +
        '<option value="importante" ' + (a.urgencia === 'importante' ? 'selected' : '') + '>Importante (destaque)</option>' +
        '</select></div>' +
        campo('avExpira', 'Mostrar até (opcional)', dataInput(a.expira_em), 'date') +
        ligaSwitch('avPub', 'Publicar agora', '', a.publicado !== false) +
        '<div class="folha-acoes"><button class="btn btn-sec" id="avCancelar">Cancelar</button>' +
        '<button class="btn btn-primario" id="avSalvar">Salvar</button></div><div id="avMsg"></div>',
      montar: function () {
        document.getElementById('avCancelar').onclick = UI.fecharFolha;
        document.getElementById('avSalvar').onclick = function () {
          var b = this, msg = document.getElementById('avMsg');
          var dados = {
            titulo: document.getElementById('avTitulo').value.trim(),
            texto: document.getElementById('avTexto').value.trim(),
            urgencia: document.getElementById('avUrg').value,
            expira_em: document.getElementById('avExpira').value || null,
            publicado: document.getElementById('avPub').checked
          };
          if (!dados.titulo) { msg.innerHTML = '<div class="msg-erro">Dê um título ao aviso.</div>'; return; }
          b.disabled = true; b.textContent = 'Salvando…';
          var acao = a.id ? DB.Tabela.atualizar('ibnm_avisos', { id: 'eq.' + a.id }, dados) : DB.Tabela.inserir('ibnm_avisos', dados);
          acao.then(function () { UI.fecharFolha(); UI.toast('Aviso salvo.'); window.App.recarregar(); })
            .catch(function (e) {
              msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
              b.disabled = false; b.textContent = 'Salvar';
            });
        };
      }
    });
  }

  /* ============================================================
     PEDIDOS DE ORAÇÃO (admin)
     ============================================================ */
  function abaOracoes(corpo) {
    DB.Tabela.listar('ibnm_oracoes', { ordem: 'criado_em.desc', limite: 200 }).then(function (lista) {
      corpo.innerHTML = '<div class="adm-aviso">Os pedidos marcados como <b>em sigilo</b> são vistos apenas por você (administrador). Ninguém mais no app tem acesso.</div>' +
        '<div class="adm-lista">' + (lista.length ? lista.map(function (o) {
          var d = new Date(o.criado_em);
          return '<div class="adm-item" style="flex-direction:column;align-items:stretch">' +
            '<div style="display:flex;gap:8px;justify-content:space-between;align-items:flex-start">' +
            '<b>' + UI.esc(o.nome || 'Membro') + '</b>' +
            '<small style="white-space:nowrap">' + d.toLocaleDateString('pt-BR') + '</small></div>' +
            '<p style="margin:6px 0;font-size:.86rem;white-space:pre-wrap;line-height:1.5">' + UI.esc(o.pedido) + '</p>' +
            (o.resposta ? '<div class="oracao-resposta">💬 ' + UI.esc(o.resposta) + '</div>' : '') +
            '<div class="acoes-mini" style="justify-content:flex-start;margin-top:8px">' +
            '<button class="mini ' + (o.status === 'atendido' ? 'ok' : '') + '" data-resp="' + o.id + '">' + (o.status === 'atendido' ? '✔ Atendido' : 'Responder / marcar atendido') + '</button>' +
            '<button class="mini perigo" data-del-or="' + o.id + '">Excluir</button></div>' +
            '</div>';
        }).join('') : Views.vazio('🙏', 'Nenhum pedido', 'Os pedidos enviados pelos membros chegam aqui.')) + '</div>';

      UI.$$('[data-resp]', corpo).forEach(function (b) {
        b.onclick = function () {
          var o = lista.filter(function (x) { return String(x.id) === b.getAttribute('data-resp'); })[0];
          UI.abrirFolha({
            titulo: 'Responder pedido',
            sub: o.nome || 'Membro',
            html: '<div class="card" style="background:#f8fbf9;margin-bottom:12px"><div style="font-size:.86rem;white-space:pre-wrap">' + UI.esc(o.pedido) + '</div></div>' +
              area('orResp', 'Resposta / observação (opcional)', o.resposta || '', 'Aparece só para a pessoa e para você.', 100) +
              ligaSwitch('orAtendido', 'Marcar como atendido', 'A pessoa vê "atendido" no app.', o.status === 'atendido') +
              '<div class="folha-acoes"><button class="btn btn-sec" id="orCancelar">Cancelar</button>' +
              '<button class="btn btn-primario" id="orSalvar">Salvar</button></div><div id="orMsg"></div>',
            montar: function () {
              document.getElementById('orCancelar').onclick = UI.fecharFolha;
              document.getElementById('orSalvar').onclick = function () {
                var bt = this, msg = document.getElementById('orMsg');
                bt.disabled = true; bt.textContent = 'Salvando…';
                DB.Tabela.atualizar('ibnm_oracoes', { id: 'eq.' + o.id }, {
                  resposta: document.getElementById('orResp').value.trim(),
                  status: document.getElementById('orAtendido').checked ? 'atendido' : 'orando'
                }).then(function () { UI.fecharFolha(); UI.toast('Pedido atualizado.'); abrirAba(); })
                  .catch(function (e) { msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>'; bt.disabled = false; bt.textContent = 'Salvar'; });
              };
            }
          });
        };
      });
      UI.$$('[data-del-or]', corpo).forEach(function (b) {
        b.onclick = function () {
          UI.confirmar('Excluir pedido', 'O pedido será apagado.', 'Excluir', true).then(function (ok) {
            if (!ok) return;
            DB.Tabela.apagar('ibnm_oracoes', { id: 'eq.' + b.getAttribute('data-del-or') }).then(function () { UI.toast('Pedido excluído.'); abrirAba(); });
          });
        };
      });
    }).catch(function (e) { corpo.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>'; });
  }

  /* ============================================================
     OFERTAS (admin)
     ============================================================ */
  function abaOfertas(corpo) {
    DB.Tabela.listar('ibnm_ofertas', { ordem: 'criado_em.desc', limite: 300 }).then(function (lista) {
      var pend = lista.filter(function (o) { return o.status !== 'confirmado'; });
      var total = lista.filter(function (o) { return o.status === 'confirmado'; }).reduce(function (s, o) { return s + Number(o.valor || 0); }, 0);
      var totalPend = pend.reduce(function (s, o) { return s + Number(o.valor || 0); }, 0);

      corpo.innerHTML =
        '<div class="grid2 mb14">' +
        '<div class="card" style="padding:13px"><div class="small">Confirmadas</div><b style="font-size:1.1rem;color:var(--ok)">' + UI.money(total) + '</b></div>' +
        '<div class="card" style="padding:13px"><div class="small">Aguardando</div><b style="font-size:1.1rem;color:var(--aviso)">' + UI.money(totalPend) + '</b></div>' +
        '</div>' +
        '<div class="adm-aviso">Quando o dinheiro cair na conta, toque em <b>Confirmar</b>. O membro vê o status atualizado no app.</div>' +
        '<div class="adm-lista">' + (lista.length ? lista.map(function (o) {
          var d = new Date(o.criado_em);
          return '<div class="adm-item"><div class="tx"><b>' + UI.esc(o.nome || 'Membro') + ' — ' + UI.money(o.valor) + '</b>' +
            '<small>' + UI.esc(o.tipo) + ' • ' + d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
            ' • <span class="status-pill ' + o.status + '">' + (o.status === 'confirmado' ? 'confirmado' : 'aguardando') + '</span></small></div>' +
            '<div class="acoes-mini">' +
            (o.comprovante_url ? '<button class="mini" data-comp="' + o.id + '">📎 Ver</button>' : '') +
            (o.status !== 'confirmado' ? '<button class="mini ok" data-conf="' + o.id + '">Confirmar</button>' : '') +
            '<button class="mini perigo" data-del-of="' + o.id + '">Excluir</button></div></div>';
        }).join('') : Views.vazio('💰', 'Nenhuma oferta registrada', 'As ofertas feitas pelo app aparecem aqui.')) + '</div>';

      UI.$$('[data-conf]', corpo).forEach(function (b) {
        b.onclick = function () {
          DB.Tabela.atualizar('ibnm_ofertas', { id: 'eq.' + b.getAttribute('data-conf') }, { status: 'confirmado', confirmado_em: new Date().toISOString() })
            .then(function () { UI.toast('Oferta confirmada.'); abrirAba(); });
        };
      });
      UI.$$('[data-del-of]', corpo).forEach(function (b) {
        b.onclick = function () {
          UI.confirmar('Excluir oferta', 'O registro será apagado (o dinheiro não é afetado).', 'Excluir', true).then(function (ok) {
            if (!ok) return;
            DB.Tabela.apagar('ibnm_ofertas', { id: 'eq.' + b.getAttribute('data-del-of') }).then(function () { UI.toast('Registro excluído.'); abrirAba(); });
          });
        };
      });
      UI.$$('[data-comp]', corpo).forEach(function (b) {
        var o = lista.filter(function (x) { return String(x.id) === b.getAttribute('data-comp'); })[0];
        b.onclick = function () {
          UI.abrirFolha({ titulo: 'Comprovante', sub: (o.nome || '') + ' • ' + UI.money(o.valor), html: '<div class="small">Abrindo arquivo…</div>' });
          DB.Arquivos.urlAssinada('igreja', o.comprovante_url, 3600).then(function (url) {
            if (!url) { UI.toast('Não foi possível abrir o comprovante.'); return; }
            var ehPdf = /\.pdf$/i.test(o.comprovante_url);
            var conteudo = document.getElementById('folhaConteudo');
            if (conteudo) {
              conteudo.innerHTML = ehPdf
                ? '<a class="btn btn-primario btn-bloco" href="' + UI.esc(url) + '" target="_blank" rel="noopener">📄 Abrir PDF do comprovante</a>'
                : '<img src="' + UI.esc(url) + '" alt="Comprovante" style="width:100%;border-radius:14px"><a class="btn btn-sec btn-bloco mt10" href="' + UI.esc(url) + '" target="_blank" rel="noopener">Abrir em tamanho grande</a>';
            }
          }).catch(function () { UI.toast('Link do comprovante expirou. Tente de novo.'); });
        };
      });
    }).catch(function (e) { corpo.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>'; });
  }

  /* ============================================================
     MEMBROS
     ============================================================ */
  function abaMembros(corpo) {
    DB.Tabela.listar('ibnm_perfis', { ordem: 'nome.asc', limite: 500 }).then(function (lista) {
      var mes = new Date().getMonth() + 1;
      var aniversariantes = lista.filter(function (p) {
        return p.nascimento && Number(String(p.nascimento).slice(5, 7)) === mes;
      });
      corpo.innerHTML =
        '<div class="grid2 mb14">' +
        '<div class="card" style="padding:13px"><div class="small">Pessoas no app</div><b style="font-size:1.3rem">' + lista.length + '</b></div>' +
        '<div class="card" style="padding:13px"><div class="small">Aniversariantes do mês</div><b style="font-size:1.3rem">' + aniversariantes.length + '</b></div>' +
        '</div>' +
        '<div class="campo"><label>Buscar pessoa</label><input id="mbBusca" placeholder="Nome ou e-mail"></div>' +
        '<div class="adm-aviso">Para dar acesso de administrador a alguém de confiança, toque em <b>Tornar ADM</b>. Essa pessoa poderá editar todo o conteúdo do app.</div>' +
        '<div class="adm-lista" id="mbLista">' + lista.map(function (p) { return linhaMembro(p); }).join('') + '</div>';

      var busca = document.getElementById('mbBusca');
      busca.oninput = function () {
        var q = busca.value.toLowerCase().trim();
        UI.$$('.adm-item', document.getElementById('mbLista')).forEach(function (el) {
          el.hidden = q && el.getAttribute('data-busca').indexOf(q) < 0;
        });
      };
      ligarMembros(lista);
    }).catch(function (e) { corpo.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>'; });
  }

  function linhaMembro(p) {
    var nasc = p.nascimento ? UI.dataBR(p.nascimento) : 'sem data';
    return '<div class="adm-item" data-busca="' + UI.esc(((p.nome || '') + ' ' + (p.email || '')).toLowerCase()) + '">' +
      '<div class="tx"><b>' + UI.esc(p.nome || '(sem nome)') + (p.is_adm ? ' <span class="selo" style="padding:1px 6px">ADM</span>' : '') + '</b>' +
      '<small>' + UI.esc(p.email || '') + ' • 🎂 ' + nasc + (p.telefone ? ' • ' + UI.esc(p.telefone) : '') + '</small></div>' +
      '<div class="acoes-mini"><button class="mini ' + (p.is_adm ? 'perigo' : '') + '" data-adm-toogle="' + p.id + '" data-adm-atual="' + (p.is_adm ? '1' : '0') + '">' +
      (p.is_adm ? 'Remover ADM' : 'Tornar ADM') + '</button></div></div>';
  }

  function ligarMembros(lista) {
    UI.$$('[data-adm-toogle]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-adm-toogle');
        var atual = b.getAttribute('data-adm-atual') === '1';
        if (String(id) === String(Auth.usuario().id)) { UI.toast('Você não pode remover o seu próprio acesso.'); return; }
        UI.confirmar(atual ? 'Remover administrador' : 'Tornar administrador',
          atual ? 'Esta pessoa deixa de editar o conteúdo do app.' : 'Esta pessoa poderá editar todo o conteúdo do app.',
          atual ? 'Remover' : 'Tornar ADM', atual).then(function (ok) {
            if (!ok) return;
            DB.Tabela.atualizar('ibnm_perfis', { id: 'eq.' + id }, { is_adm: !atual }).then(function () {
              UI.toast('Permissão atualizada.');
              abrirAba();
            }).catch(function (e) { UI.toast(e.message); });
          });
      };
    });
  }

  window.IBNM.Admin = { tela: admin, abrirAba: abrirAba };
})();
