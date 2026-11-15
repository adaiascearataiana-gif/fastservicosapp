/* ============================================================
   SEÇÕES — páginas criadas pelo ADM principal (Jovens, Missões…)
   Cada seção tem mural, materiais e fotos. A Escola Bíblica usa
   os mesmos blocos (js/ebd.js), separando por sala.
   ============================================================ */
(function () {
  var DB = window.IBNM.DB;
  var UI = window.IBNM.UI;
  var Auth = DB.Auth;
  var Views = window.IBNM.Views;

  var TIPOS_MATERIAL = {
    link: { nome: 'Link', ic: '🔗' },
    video: { nome: 'Vídeo', ic: '▶️' },
    pdf: { nome: 'PDF / arquivo', ic: '📄' },
    imagem: { nome: 'Imagem', ic: '🖼️' },
    texto: { nome: 'Texto', ic: '📝' }
  };

  var abaDaSecao = {};

  function E() { return Views.Estado; }
  function todas() { return E().secoes || []; }
  function porChave(chave) { return todas().filter(function (s) { return s.chave === chave; })[0] || null; }
  function doApp() { return todas().filter(function (s) { return s.tipo !== 'painel'; }); }
  function doPainel() { return todas().filter(function (s) { return s.tipo === 'painel'; }); }
  function visiveis() { return doApp().filter(function (s) { return s.ativo; }); }
  function rota(s) { return s.tipo === 'ebd' ? '#/ebd' : '#/secao/' + s.chave; }
  function salas() { return E().ebdSalas || []; }
  function nomeSala(id) {
    var s = salas().filter(function (x) { return x.id === id; })[0];
    return s ? s.nome : '';
  }

  /* quem pode publicar: ADM da seção; na Escola Bíblica, também o professor da sala */
  function podeNaSecao(secao) { return !!secao && Auth.logado() && Auth.temSecao(secao.chave); }
  function podeNoItem(secao, salaId) {
    if (podeNaSecao(secao)) return true;
    return !!(secao && secao.tipo === 'ebd' && salaId && Auth.professorDe(salaId));
  }
  function salasQuePublica(secao) {
    if (!secao || secao.tipo !== 'ebd') return [];
    if (podeNaSecao(secao)) return salas();
    return salas().filter(function (s) { return Auth.professorDe(s.id); });
  }
  function podeAlgo(secao) { return podeNaSecao(secao) || salasQuePublica(secao).length > 0; }

  function pastaDe(secao, salaId) { return 'secoes/' + secao.chave + '/' + (salaId || 'geral'); }
  function nomeArquivo(ext) { return Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext; }
  function dataHora(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
  }
  function erro(caixa, e) {
    caixa.innerHTML = '<div class="msg-erro">' + UI.esc((e && e.message) || 'Não foi possível carregar.') + '</div>';
  }
  function carregando(caixa) { caixa.innerHTML = '<div class="esqueleto" style="height:110px"></div>'; }

  /* campo "de qual sala" (só aparece na Escola Bíblica) */
  function campoSala(secao, atual, fixa) {
    if (!secao || secao.tipo !== 'ebd') return '';
    var lista = salasQuePublica(secao);
    var opcoes = [];
    if (podeNaSecao(secao)) opcoes.push(['', 'Todas as salas']);
    lista.forEach(function (s) { opcoes.push([s.id, s.nome]); });
    if (!opcoes.length) return '';
    var valor = atual !== undefined && atual !== null ? atual : (fixa || opcoes[0][0]);
    return UI.escolha('ctSala', 'Para qual sala?', opcoes, valor || '');
  }
  function salaEscolhida(secao) {
    if (!secao || secao.tipo !== 'ebd') return null;
    var el = document.getElementById('ctSala');
    return el && el.value ? el.value : null;
  }

  /* ============================================================
     MURAL
     ============================================================ */
  function mural(caixa, secao) {
    carregando(caixa);
    var pode = podeNaSecao(secao);
    DB.Tabela.listar('ibnm_secao_posts', {
      filtros: { secao_id: 'eq.' + secao.id }, ordem: 'fixado.desc,criado_em.desc', limite: 60
    }).then(function (lista) {
      var html = pode ? '<button class="btn btn-primario btn-bloco mb14" id="muNovo">➕ Novo recado no mural</button>' : '';
      if (!lista.length) {
        html += Views.vazio('📌', 'Mural vazio', pode ? 'Escreva o primeiro recado desta seção.' : 'Os recados desta seção vão aparecer aqui.');
      } else {
        html += lista.map(function (p) {
          var link = UI.link(p.link);
          return '<article class="post' + (p.fixado ? ' fixado' : '') + '">' +
            '<div class="post-topo"><b>' + UI.esc(p.titulo || 'Recado') + '</b>' +
            (p.fixado ? '<span class="tag rec">📌 fixado</span>' : '') +
            (!p.publicado ? '<span class="badge-off">oculto</span>' : '') + '</div>' +
            (p.imagem ? '<img class="post-img" src="' + UI.esc(p.imagem) + '" alt="" loading="lazy" data-ver="' + UI.esc(p.imagem) + '">' : '') +
            (p.texto ? '<p class="post-texto">' + UI.esc(p.texto) + '</p>' : '') +
            (link ? '<a class="btn btn-fantasma btn-pequeno mt10" href="' + UI.esc(link) + '" target="_blank" rel="noopener">🔗 Abrir link</a>' : '') +
            '<small class="post-meta">' + UI.esc(p.autor || 'Liderança') + ' • ' + dataHora(p.criado_em) + '</small>' +
            (pode ? '<div class="acoes-mini mt10"><button class="mini" data-mu-ed="' + p.id + '">Editar</button>' +
              '<button class="mini perigo" data-mu-del="' + p.id + '">Excluir</button></div>' : '') +
            '</article>';
        }).join('');
      }
      caixa.innerHTML = html;
      var novo = document.getElementById('muNovo');
      if (novo) novo.onclick = function () { editorPost(secao, null, function () { mural(caixa, secao); }); };
      UI.$$('[data-ver]', caixa).forEach(function (im) { im.onclick = function () { UI.verImagem(im.getAttribute('data-ver'), 'Imagem do recado'); }; });
      UI.$$('[data-mu-ed]', caixa).forEach(function (b) {
        b.onclick = function () {
          var p = lista.filter(function (x) { return x.id === b.getAttribute('data-mu-ed'); })[0];
          editorPost(secao, p, function () { mural(caixa, secao); });
        };
      });
      UI.$$('[data-mu-del]', caixa).forEach(function (b) {
        b.onclick = function () {
          UI.confirmar('Excluir recado', 'O recado sai do mural para todos.', 'Excluir', true).then(function (ok) {
            if (!ok) return;
            DB.Tabela.apagar('ibnm_secao_posts', { id: 'eq.' + b.getAttribute('data-mu-del') }).then(function () {
              UI.toast('Recado excluído.'); mural(caixa, secao);
            }).catch(function (e) { UI.toast(e.message); });
          });
        };
      });
    }).catch(function (e) { erro(caixa, e); });
  }

  function editorPost(secao, p, aoSalvar) {
    p = p || {};
    var imagem = p.imagem || '';
    UI.abrirFolha({
      titulo: p.id ? 'Editar recado' : 'Novo recado',
      sub: secao.nome,
      html: UI.campo('muTitulo', 'Título', p.titulo || '') +
        UI.area('muTexto', 'Texto', p.texto || '', '', 120) +
        UI.campo('muLink', 'Link (opcional)', p.link || '', 'url', 'placeholder="https://…"') +
        '<div class="campo"><label>Imagem (opcional)</label><input type="file" id="muArq" accept="image/*">' +
        '<div class="dica" id="muImgInfo">' + (imagem ? 'Já tem uma imagem. Escolha outra para trocar.' : 'Foto ou cartaz do recado.') + '</div></div>' +
        UI.liga('muFixo', 'Fixar no topo', 'Fica sempre em primeiro lugar no mural.', !!p.fixado) +
        UI.liga('muPub', 'Publicado', 'Desligue para guardar como rascunho.', p.publicado !== false) +
        '<div class="folha-acoes"><button class="btn btn-sec" id="muCancelar">Cancelar</button>' +
        '<button class="btn btn-primario" id="muSalvar">Salvar</button></div><div id="muMsg"></div>',
      montar: function () {
        document.getElementById('muCancelar').onclick = UI.fecharFolha;
        document.getElementById('muSalvar').onclick = function () {
          var b = this, msg = document.getElementById('muMsg');
          var dados = {
            titulo: UI.val('muTitulo'), texto: UI.val('muTexto'), link: UI.link(UI.val('muLink')),
            fixado: UI.marcado('muFixo'), publicado: UI.marcado('muPub')
          };
          if (!dados.titulo && !dados.texto) { msg.innerHTML = '<div class="msg-erro">Escreva um título ou um texto.</div>'; return; }
          b.disabled = true; b.textContent = 'Salvando…';
          var arq = (document.getElementById('muArq').files || [])[0];
          var subir = arq ? UI.reduzirImagem(arq, 1600, 0.82).then(function (blob) {
            var caminho = pastaDe(secao, null) + '/' + nomeArquivo('jpg');
            return DB.Arquivos.enviar('igreja-publico', caminho, blob).then(function () {
              imagem = DB.Arquivos.urlPublica('igreja-publico', caminho);
            });
          }) : Promise.resolve();
          subir.then(function () {
            dados.imagem = imagem;
            if (p.id) return DB.Tabela.atualizar('ibnm_secao_posts', { id: 'eq.' + p.id }, dados);
            dados.secao_id = secao.id;
            return DB.Tabela.inserir('ibnm_secao_posts', dados);
          }).then(function () {
            UI.fecharFolha(); UI.toast('Recado salvo.'); if (aoSalvar) aoSalvar();
          }).catch(function (e) {
            msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>';
            b.disabled = false; b.textContent = 'Salvar';
          });
        };
      }
    });
  }

  /* ============================================================
     MATERIAIS
     opcoes.salaId  -> mostra os da sala + os de todas as salas
     ============================================================ */
  function materiais(caixa, secao, opcoes) {
    opcoes = opcoes || {};
    carregando(caixa);
    DB.Tabela.listar('ibnm_secao_materiais', {
      filtros: { secao_id: 'eq.' + secao.id }, ordem: 'data.desc.nullslast,criado_em.desc', limite: 300
    }).then(function (lista) {
      if (opcoes.salaId) lista = lista.filter(function (m) { return !m.sala_id || m.sala_id === opcoes.salaId; });
      var podeCriar = opcoes.salaId ? podeNoItem(secao, opcoes.salaId) : podeAlgo(secao);
      var html = podeCriar ? '<button class="btn btn-primario btn-bloco mb14" id="mtNovo">➕ Novo material</button>' : '';
      if (!lista.length) {
        html += Views.vazio('📚', 'Nenhum material ainda', podeCriar ? 'Publique a lição, um vídeo, um PDF ou um link.' : 'Lições, vídeos e arquivos vão aparecer aqui.');
      } else {
        html += '<div class="materiais">' + lista.map(function (m) {
          var t = TIPOS_MATERIAL[m.tipo] || TIPOS_MATERIAL.link;
          var yt = m.tipo === 'video' ? UI.youtubeId(m.url) : '';
          var detalhes = [t.nome];
          if (m.data) detalhes.push(UI.dataBR(m.data));
          if (secao.tipo === 'ebd') detalhes.push(m.sala_id ? (nomeSala(m.sala_id) || 'Sala') : 'Todas as salas');
          return '<div class="material">' +
            '<button class="material-abre" data-mt="' + m.id + '">' +
            (yt ? '<img class="mat-capa" src="https://i.ytimg.com/vi/' + yt + '/mqdefault.jpg" alt="" loading="lazy">' : '<span class="mat-ic">' + t.ic + '</span>') +
            '<span class="tx"><b>' + UI.esc(m.titulo || t.nome) + (!m.publicado ? ' <span class="badge-off">oculto</span>' : '') + '</b>' +
            (m.descricao ? '<small>' + UI.esc(m.descricao) + '</small>' : '') +
            '<small class="mat-meta">' + UI.esc(detalhes.join(' • ')) + '</small></span><span class="seta">›</span></button>' +
            (podeNoItem(secao, m.sala_id) ? '<div class="acoes-mini"><button class="mini" data-mt-ed="' + m.id + '">Editar</button>' +
              '<button class="mini perigo" data-mt-del="' + m.id + '">Excluir</button></div>' : '') +
            '</div>';
        }).join('') + '</div>';
      }
      caixa.innerHTML = html;
      var de = function (id) { return lista.filter(function (x) { return x.id === id; })[0]; };
      var recarregar = function () { materiais(caixa, secao, opcoes); };
      var novo = document.getElementById('mtNovo');
      if (novo) novo.onclick = function () { editorMaterial(secao, null, opcoes.salaId, recarregar); };
      /* sem internet (ou vídeo sem capa): mostra o ícone no lugar da imagem quebrada */
      UI.$$('img.mat-capa', caixa).forEach(function (img) {
        img.onerror = function () {
          var ic = document.createElement('span');
          ic.className = 'mat-ic';
          ic.textContent = TIPOS_MATERIAL.video.ic;
          if (img.parentNode) img.parentNode.replaceChild(ic, img);
        };
      });
      UI.$$('[data-mt]', caixa).forEach(function (b) { b.onclick = function () { abrirMaterial(de(b.getAttribute('data-mt'))); }; });
      UI.$$('[data-mt-ed]', caixa).forEach(function (b) { b.onclick = function () { editorMaterial(secao, de(b.getAttribute('data-mt-ed')), opcoes.salaId, recarregar); }; });
      UI.$$('[data-mt-del]', caixa).forEach(function (b) {
        b.onclick = function () {
          UI.confirmar('Excluir material', 'O material deixa de aparecer para todos.', 'Excluir', true).then(function (ok) {
            if (!ok) return;
            DB.Tabela.apagar('ibnm_secao_materiais', { id: 'eq.' + b.getAttribute('data-mt-del') }).then(function () {
              UI.toast('Material excluído.'); recarregar();
            }).catch(function (e) { UI.toast(e.message); });
          });
        };
      });
    }).catch(function (e) { erro(caixa, e); });
  }

  function abrirMaterial(m) {
    if (!m) return;
    var link = UI.link(m.url);
    if (m.tipo === 'imagem' && link) { UI.verImagem(link, m.titulo || 'Imagem'); return; }
    if (m.tipo !== 'texto' && link && !m.texto) { window.open(link, '_blank', 'noopener'); return; }
    UI.abrirFolha({
      titulo: m.titulo || 'Material',
      sub: m.descricao || '',
      html: (m.texto ? '<div class="prosa">' + UI.esc(m.texto) + '</div>' : '') +
        '<div class="folha-acoes">' +
        (link ? '<a class="btn btn-sec" href="' + UI.esc(link) + '" target="_blank" rel="noopener">🔗 Abrir link</a>' : '') +
        '<button class="btn btn-primario" id="mtFechar">Fechar</button></div>',
      montar: function () { document.getElementById('mtFechar').onclick = UI.fecharFolha; }
    });
  }

  function editorMaterial(secao, m, salaFixa, aoSalvar) {
    m = m || {};
    var tipos = Object.keys(TIPOS_MATERIAL).map(function (k) { return [k, TIPOS_MATERIAL[k].ic + ' ' + TIPOS_MATERIAL[k].nome]; });
    UI.abrirFolha({
      titulo: m.id ? 'Editar material' : 'Novo material',
      sub: secao.nome,
      html: UI.campo('mtTitulo', 'Título', m.titulo || '', 'text', 'placeholder="Ex.: Lição 5 — A fé de Abraão"') +
        UI.escolha('mtTipo', 'Tipo', tipos, m.tipo || 'link') +
        '<div id="mtBlocoLink">' + UI.campo('mtUrl', 'Link', m.url || '', 'url', 'placeholder="https://…"', 'Cole o link (YouTube, Google Drive, site…).') +
        '<div class="campo"><label>…ou envie um arquivo (PDF ou imagem)</label><input type="file" id="mtArq" accept="application/pdf,image/*">' +
        '<div class="dica">Até 15 MB. Para arquivos maiores, use um link do Google Drive.</div></div></div>' +
        UI.area('mtTexto', 'Texto (opcional)', m.texto || '', 'Resumo da lição, perguntas para a semana, versículo para decorar…', 110) +
        UI.campo('mtDesc', 'Descrição curta (opcional)', m.descricao || '') +
        '<div class="linha">' + UI.campo('mtData', 'Data (opcional)', String(m.data || '').slice(0, 10), 'date') + '</div>' +
        campoSala(secao, m.id ? (m.sala_id || '') : undefined, salaFixa) +
        UI.liga('mtPub', 'Publicado', 'Desligue para deixar guardado sem aparecer.', m.publicado !== false) +
        '<div class="folha-acoes"><button class="btn btn-sec" id="mtCancelar">Cancelar</button>' +
        '<button class="btn btn-primario" id="mtSalvar">Salvar</button></div><div id="mtMsg"></div>',
      montar: function () {
        var tipo = document.getElementById('mtTipo');
        var ajustar = function () { document.getElementById('mtBlocoLink').hidden = tipo.value === 'texto'; };
        tipo.onchange = ajustar; ajustar();
        document.getElementById('mtCancelar').onclick = UI.fecharFolha;
        document.getElementById('mtSalvar').onclick = function () {
          var b = this, msg = document.getElementById('mtMsg');
          var avisar = function (t) { msg.innerHTML = '<div class="msg-erro">' + UI.esc(t) + '</div>'; };
          var sala = salaEscolhida(secao);
          var dados = {
            titulo: UI.val('mtTitulo'), tipo: tipo.value, url: UI.link(UI.val('mtUrl')), texto: UI.val('mtTexto'),
            descricao: UI.val('mtDesc'), data: UI.val('mtData') || null, publicado: UI.marcado('mtPub'), sala_id: sala
          };
          var arq = tipo.value === 'texto' ? null : (document.getElementById('mtArq').files || [])[0];
          if (!dados.titulo) return avisar('Dê um título ao material.');
          if (tipo.value === 'texto' && !dados.texto) return avisar('Escreva o texto do material.');
          if (tipo.value !== 'texto' && !dados.url && !arq) return avisar('Cole um link ou escolha um arquivo.');
          if (arq && arq.size > 15 * 1024 * 1024) return avisar('O arquivo passa de 15 MB. Use um link do Google Drive.');
          if (tipo.value === 'texto') dados.url = '';
          b.disabled = true; b.textContent = arq ? 'Enviando arquivo…' : 'Salvando…';
          var subir = Promise.resolve();
          if (arq) {
            var ehImagem = /^image\//.test(arq.type || '');
            subir = (ehImagem ? UI.reduzirImagem(arq, 1800, 0.85) : Promise.resolve(arq)).then(function (blob) {
              var ext = ehImagem ? 'jpg' : ((arq.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf');
              var caminho = pastaDe(secao, sala) + '/' + nomeArquivo(ext);
              return DB.Arquivos.enviar('igreja-publico', caminho, blob).then(function () {
                dados.url = DB.Arquivos.urlPublica('igreja-publico', caminho);
                if (ehImagem && tipo.value !== 'imagem' && tipo.value !== 'pdf') dados.tipo = 'imagem';
              });
            });
          }
          subir.then(function () {
            if (m.id) return DB.Tabela.atualizar('ibnm_secao_materiais', { id: 'eq.' + m.id }, dados);
            dados.secao_id = secao.id;
            return DB.Tabela.inserir('ibnm_secao_materiais', dados);
          }).then(function () {
            UI.fecharFolha(); UI.toast('Material salvo.'); if (aoSalvar) aoSalvar();
          }).catch(function (e) {
            avisar(e.message);
            b.disabled = false; b.textContent = 'Salvar';
          });
        };
      }
    });
  }

  /* ============================================================
     FOTOS
     ============================================================ */
  function fotos(caixa, secao, opcoes) {
    opcoes = opcoes || {};
    if (!Auth.logado()) {
      caixa.innerHTML = '<div class="vazio"><span class="em">🔒</span><b>Fotos só para quem entrou no app</b>' +
        'Para cuidar da privacidade de todos (principalmente das crianças), as fotos aparecem depois do login.' +
        '<div class="mt14"><button class="btn btn-primario" data-ir="#/entrar">Entrar ou criar conta</button></div></div>';
      return;
    }
    carregando(caixa);
    DB.Tabela.listar('ibnm_secao_fotos', {
      filtros: { secao_id: 'eq.' + secao.id }, ordem: 'data.desc,criado_em.desc', limite: 240
    }).then(function (lista) {
      if (opcoes.salaId) lista = lista.filter(function (f) { return f.sala_id === opcoes.salaId; });
      var podeCriar = opcoes.salaId ? podeNoItem(secao, opcoes.salaId) : podeAlgo(secao);
      var html = podeCriar ? '<button class="btn btn-primario btn-bloco mb14" id="ftNovo">📷 Enviar fotos</button>' : '';
      if (!lista.length) {
        html += Views.vazio('🖼️', 'Nenhuma foto ainda', podeCriar ? 'Envie as fotos da aula ou do encontro.' : 'As fotos dos encontros vão aparecer aqui.');
      } else {
        var grupos = [], atual = null;
        lista.forEach(function (f) {
          var chave = String(f.data || '').slice(0, 10) + '|' + (f.sala_id || '');
          if (!atual || atual.chave !== chave) { atual = { chave: chave, data: f.data, sala: f.sala_id, itens: [] }; grupos.push(atual); }
          atual.itens.push(f);
        });
        html += grupos.map(function (g) {
          var titulo = UI.dataBR(g.data) + (secao.tipo === 'ebd' && !opcoes.salaId && g.sala ? ' • ' + UI.esc(nomeSala(g.sala)) : '');
          return '<div class="galeria-data">' + titulo + '</div><div class="galeria">' + g.itens.map(function (f) {
            return '<button class="foto" data-ft="' + f.id + '" aria-label="' + UI.esc(f.legenda || 'Abrir foto') + '">' +
              '<img src="' + UI.esc(f.miniatura || f.url) + '" alt="' + UI.esc(f.legenda || '') + '" loading="lazy"></button>';
          }).join('') + '</div>';
        }).join('');
      }
      caixa.innerHTML = html;
      var recarregar = function () { fotos(caixa, secao, opcoes); };
      var novo = document.getElementById('ftNovo');
      if (novo) novo.onclick = function () { enviarFotos(secao, opcoes.salaId, recarregar); };
      UI.$$('[data-ft]', caixa).forEach(function (b) {
        b.onclick = function () {
          var f = lista.filter(function (x) { return x.id === b.getAttribute('data-ft'); })[0];
          if (!f) return;
          var pode = podeNoItem(secao, f.sala_id);
          UI.verImagem(f.url, f.legenda || 'Foto',
            '<div class="small mt10">' + UI.dataBR(f.data) + (f.autor ? ' • enviada por ' + UI.esc(f.autor) : '') + '</div>' +
            (pode ? '<button class="btn btn-perigo btn-bloco mt10" id="ftApagar">🗑️ Excluir esta foto</button>' : ''),
            function () {
              var a = document.getElementById('ftApagar');
              if (a) a.onclick = function () {
                if (a.getAttribute('data-certeza') !== '1') { a.setAttribute('data-certeza', '1'); a.textContent = 'Toque de novo para excluir'; return; }
                a.disabled = true; a.textContent = 'Excluindo…';
                DB.Tabela.apagar('ibnm_secao_fotos', { id: 'eq.' + f.id }).then(function () {
                  if (f.caminho) {
                    DB.Arquivos.apagar('igreja-publico', f.caminho);
                    DB.Arquivos.apagar('igreja-publico', f.caminho.replace(/\.jpg$/, '-p.jpg'));
                  }
                  UI.fecharFolha(); UI.toast('Foto excluída.'); recarregar();
                }).catch(function (e) { UI.toast(e.message); a.disabled = false; a.textContent = '🗑️ Excluir esta foto'; });
              };
            });
        };
      });
    }).catch(function (e) { erro(caixa, e); });
  }

  function enviarFotos(secao, salaFixa, aoSalvar) {
    UI.abrirFolha({
      titulo: 'Enviar fotos',
      sub: secao.nome,
      html: '<div class="campo"><label for="ftArqs">Escolha as fotos</label><input type="file" id="ftArqs" accept="image/*" multiple>' +
        '<div class="dica">Pode escolher várias de uma vez. O app diminui as fotos antes de enviar.</div></div>' +
        UI.campo('ftLegenda', 'Legenda (opcional)', '', 'text', 'placeholder="Ex.: Aula sobre a criação"') +
        '<div class="linha">' + UI.campo('ftData', 'Data', UI.hojeISO(), 'date') + '</div>' +
        campoSala(secao, undefined, salaFixa) +
        '<div class="adm-aviso">Envie apenas fotos que as pessoas (e os pais das crianças) aceitam que apareçam no app.</div>' +
        '<div class="folha-acoes"><button class="btn btn-sec" id="ftCancelar">Cancelar</button>' +
        '<button class="btn btn-primario" id="ftEnviar">Enviar</button></div><div id="ftMsg"></div>',
      montar: function () {
        document.getElementById('ftCancelar').onclick = UI.fecharFolha;
        document.getElementById('ftEnviar').onclick = function () {
          var b = this, msg = document.getElementById('ftMsg');
          var lista = Array.prototype.slice.call(document.getElementById('ftArqs').files || []);
          if (!lista.length) { msg.innerHTML = '<div class="msg-erro">Escolha pelo menos uma foto.</div>'; return; }
          if (lista.length > 30) { msg.innerHTML = '<div class="msg-erro">Envie no máximo 30 fotos por vez.</div>'; return; }
          var sala = salaEscolhida(secao);
          var legenda = UI.val('ftLegenda'), data = UI.val('ftData') || UI.hojeISO();
          var enviadas = 0, falhas = 0;
          b.disabled = true;
          var proxima = function (i) {
            if (i >= lista.length) return Promise.resolve();
            b.textContent = 'Enviando ' + (i + 1) + ' de ' + lista.length + '…';
            var base = pastaDe(secao, sala) + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
            var grande = base + '.jpg', pequena = base + '-p.jpg';
            return UI.reduzirImagem(lista[i], 1600, 0.82).then(function (blob) {
              return DB.Arquivos.enviar('igreja-publico', grande, blob);
            }).then(function () {
              return UI.reduzirImagem(lista[i], 480, 0.7).then(function (mini) {
                return DB.Arquivos.enviar('igreja-publico', pequena, mini).then(function () { return true; }, function () { return false; });
              });
            }).then(function (temMini) {
              return DB.Tabela.inserir('ibnm_secao_fotos', {
                secao_id: secao.id, sala_id: sala,
                url: DB.Arquivos.urlPublica('igreja-publico', grande),
                miniatura: temMini ? DB.Arquivos.urlPublica('igreja-publico', pequena) : '',
                caminho: grande, legenda: legenda, data: data
              });
            }).then(function () { enviadas++; }, function (e) { falhas++; msg.innerHTML = '<div class="msg-erro">' + UI.esc(e.message) + '</div>'; })
              .then(function () { return proxima(i + 1); });
          };
          proxima(0).then(function () {
            if (enviadas && !falhas) { UI.fecharFolha(); UI.toast(enviadas === 1 ? 'Foto enviada.' : enviadas + ' fotos enviadas.'); }
            else { b.disabled = false; b.textContent = 'Enviar'; if (enviadas) UI.toast(enviadas + ' enviada(s), ' + falhas + ' com erro.'); }
            if (enviadas && aoSalvar) aoSalvar();
          });
        };
      }
    });
  }

  /* ============================================================
     PÁGINA DE UMA SEÇÃO LIVRE   (#/secao/<chave>)
     ============================================================ */
  function tela() {
    var partes = (location.hash || '').replace(/^#\/?/, '').split('?')[0].split('/');
    var secao = porChave(decodeURIComponent(partes[1] || ''));
    var volta = '<div class="detalhe-topo"><button class="voltar" data-ir="#/inicio">← Início</button></div>';

    if (!secao || secao.tipo === 'painel') {
      return { html: volta + Views.vazio('🗂️', 'Seção não encontrada', 'Ela pode ter sido removida ou você está sem internet.') };
    }
    if (secao.tipo === 'ebd') { window.App.ir('#/ebd'); return { html: '' }; }
    var adm = podeNaSecao(secao);
    if (!secao.ativo && !adm) {
      return { html: volta + Views.vazio('🗂️', 'Seção indisponível', 'Esta seção está desativada no momento.') };
    }

    var aba = abaDaSecao[secao.chave] || 'mural';
    var abas = [['mural', '📌 Mural'], ['materiais', '📚 Materiais'], ['fotos', '🖼️ Fotos']];
    var html = volta +
      '<div class="card hero secao-capa"><div class="hero-emoji">' + UI.esc(secao.icone || '📁') + '</div>' +
      '<h2>' + UI.esc(secao.nome) + '</h2>' +
      (secao.descricao ? '<p>' + UI.esc(secao.descricao) + '</p>' : '') +
      (!secao.ativo ? '<div class="selo mt10">Desativada — só você vê</div>' : '') +
      (adm ? '<div class="selo mt10">🛡️ Você cuida desta seção</div>' : '') + '</div>' +
      '<div class="agenda-abas abas-rolam mt14">' + abas.map(function (a) {
        return '<button data-aba-secao="' + a[0] + '" class="' + (aba === a[0] ? 'on' : '') + '">' + a[1] + '</button>';
      }).join('') + '</div><div id="secaoCorpo"></div>';

    return {
      html: html,
      montar: function (raiz) {
        var corpo = document.getElementById('secaoCorpo');
        var abrir = function (qual) {
          abaDaSecao[secao.chave] = qual;
          UI.$$('[data-aba-secao]', raiz).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-aba-secao') === qual); });
          if (qual === 'materiais') materiais(corpo, secao, {});
          else if (qual === 'fotos') fotos(corpo, secao, {});
          else mural(corpo, secao);
        };
        UI.$$('[data-aba-secao]', raiz).forEach(function (b) { b.onclick = function () { abrir(b.getAttribute('data-aba-secao')); }; });
        abrir(aba);
      }
    };
  }

  /* atalhos das seções para a tela inicial e o menu "Mais" */
  function atalhos() {
    return visiveis().filter(function (s) { return s.no_inicio !== false; }).map(function (s) {
      return { ic: s.icone || '📁', nome: s.nome, descricao: s.descricao || '', ir: rota(s), chave: s.chave, tipo: s.tipo };
    });
  }

  window.IBNM.Secoes = {
    tela: tela,
    todas: todas,
    doApp: doApp,
    doPainel: doPainel,
    visiveis: visiveis,
    porChave: porChave,
    rota: rota,
    atalhos: atalhos,
    mural: mural,
    materiais: materiais,
    fotos: fotos,
    podeNaSecao: podeNaSecao,
    TIPOS_MATERIAL: TIPOS_MATERIAL
  };
})();
