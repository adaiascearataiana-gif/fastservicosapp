/* ============================================================
   Camada de dados — login, banco e arquivos (Supabase)
   Sem bibliotecas externas: usa a API REST/Auth/Storage direto.
   ============================================================ */
(function () {
  var CFG = window.IBNM.CFG;
  var CHAVE_SESSAO = 'ibnm.sessao.v1';
  var CHAVE_PERFIL = 'ibnm.perfil.v1';
  var CHAVE_ACESSO = 'ibnm.acesso.v1';

  function agora() { return Math.floor(Date.now() / 1000); }

  function traduzir(msg, status) {
    var m = String(msg || '').toLowerCase();
    if (m.indexOf('invalid login credentials') >= 0) return 'E-mail ou senha não conferem.';
    if (m.indexOf('user already registered') >= 0 || m.indexOf('already been registered') >= 0) return 'Este e-mail já tem cadastro. Use a opção "Entrar".';
    if (m.indexOf('email not confirmed') >= 0) return 'Falta confirmar seu e-mail. Confira sua caixa de entrada.';
    if (m.indexOf('password should be at least') >= 0) return 'A senha é muito curta. Use pelo menos 6 caracteres.';
    if (m.indexOf('unable to validate email') >= 0 || m.indexOf('invalid email') >= 0) return 'Digite um e-mail válido.';
    if (m.indexOf('jwt expired') >= 0 || m.indexOf('invalid jwt') >= 0) return 'Sua sessão expirou. Entre novamente.';
    if (m.indexOf('row-level security') >= 0 || m.indexOf('permission denied') >= 0) return 'Você não tem permissão para essa ação.';
    if (m.indexOf('could not find the function') >= 0 || m.indexOf('could not find the table') >= 0 || (m.indexOf('relation') >= 0 && m.indexOf('does not exist') >= 0)) return 'Esta parte do app ainda não foi ativada no banco de dados. Avise o administrador (rodar o arquivo sql/02-secoes-ebd.sql).';
    if (m.indexOf('payload too large') >= 0 || m.indexOf('exceeded the maximum allowed size') >= 0) return 'O arquivo é grande demais. Tente um arquivo menor.';
    if (m.indexOf('duplicate key') >= 0 || m.indexOf('already exists') >= 0) return 'Este registro já existe.';
    if (m.indexOf('provider is not enabled') >= 0) return 'O login com Google ainda não está ativado no servidor.';
    if (m.indexOf('failed to fetch') >= 0 || m.indexOf('networkerror') >= 0 || m.indexOf('load failed') >= 0) return 'Sem conexão com a internet. Verifique sua rede.';
    if (m.indexOf('rate limit') >= 0 || m.indexOf('too many requests') >= 0) return 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.';
    if (m.indexOf('signups not allowed') >= 0) return 'O cadastro está desativado no momento.';
    if (m.indexOf('user not found') >= 0) return 'Não encontramos uma conta com este e-mail.';
    return msg || ('Não foi possível concluir (erro ' + (status || '?') + ').');
  }

  /* ---------------- requisição base ---------------- */
  function req(caminho, opcoes) {
    opcoes = opcoes || {};
    var cab = Object.assign({ apikey: CFG.KEY }, opcoes.cabecalhos || {});
    var comToken = opcoes.usarToken !== false;
    if (comToken) {
      cab.Authorization = 'Bearer ' + ((Auth.sessao && Auth.sessao.access_token) ? Auth.sessao.access_token : CFG.KEY);
    }
    var corpo = opcoes.corpo;
    if (corpo !== undefined && corpo !== null && typeof corpo !== 'string' && !(corpo instanceof Blob) && !(corpo instanceof FormData)) {
      corpo = JSON.stringify(corpo);
      cab['Content-Type'] = cab['Content-Type'] || 'application/json';
    }
    return fetch(CFG.SUPABASE + caminho, {
      method: opcoes.metodo || 'GET',
      headers: cab,
      body: corpo === undefined ? undefined : corpo,
      cache: 'no-store'
    }).then(function (resp) {
      return resp.text().then(function (txt) {
        var dados = null;
        if (txt) { try { dados = JSON.parse(txt); } catch (e) { dados = txt; } }
        if (resp.status === 401 && opcoes.tentar !== false && Auth.sessao && Auth.sessao.refresh_token) {
          return Auth.renovar(true).then(function (ok) {
            if (!ok) throw comErro('Sua sessão expirou. Entre novamente.', 401, dados);
            var novas = Object.assign({}, opcoes, { tentar: false });
            return req(caminho, novas);
          });
        }
        if (!resp.ok) {
          var msg = (dados && (dados.message || dados.msg || dados.error_description || dados.error || dados.hint)) || '';
          throw comErro(traduzir(msg, resp.status), resp.status, dados);
        }
        return dados;
      });
    }, function () {
      throw comErro('Sem conexão com a internet. Verifique sua rede e tente novamente.', 0, null);
    });
  }

  function comErro(msg, status, dados) {
    var e = new Error(msg);
    e.status = status;
    e.dados = dados;
    e.rede = status === 0;
    return e;
  }

  /* ---------------- LOGIN ---------------- */
  var Auth = {
    sessao: null,
    perfil: null,
    acesso: null,      /* o que esta pessoa pode fazer: { principal, secoes[], ebd[], ebd_pendentes } */

    carregarSessao: function () {
      try {
        var s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null');
        if (s && s.access_token) {
          Auth.sessao = s;
          if (s.user) {
            try { Auth.perfil = JSON.parse(localStorage.getItem(CHAVE_PERFIL) || 'null'); } catch (e) {}
            try { Auth.acesso = arrumarAcesso(JSON.parse(localStorage.getItem(CHAVE_ACESSO) || 'null')); } catch (e) {}
          }
        }
      } catch (e) { Auth.sessao = null; }
      return Auth.sessao;
    },

    salvarSessao: function (s) {
      if (!s) return;
      if (s.expires_in && !s.expires_at) s.expires_at = agora() + Number(s.expires_in);
      Auth.sessao = s;
      try { localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); } catch (e) {}
    },

    limparSessao: function () {
      Auth.sessao = null;
      Auth.perfil = null;
      Auth.acesso = null;
      try {
        localStorage.removeItem(CHAVE_SESSAO);
        localStorage.removeItem(CHAVE_PERFIL);
        localStorage.removeItem(CHAVE_ACESSO);
      } catch (e) {}
    },

    logado: function () { return !!(Auth.sessao && Auth.sessao.access_token); },

    usuario: function () { return (Auth.sessao && Auth.sessao.user) || null; },

    /* ADM principal: faz tudo, cria seções e escolhe quem cuida de cada uma */
    ehAdm: function () { return !!(Auth.perfil && Auth.perfil.is_adm); },

    /* seções que o ADM principal liberou para esta pessoa (ex.: ['ebd', 'eventos']) */
    secoesAdm: function () { return (Auth.acesso && Auth.acesso.secoes) || []; },

    /* cuida desta seção? (o ADM principal cuida de todas) */
    temSecao: function (chave) { return Auth.ehAdm() || Auth.secoesAdm().indexOf(chave) >= 0; },

    /* tem alguma coisa para administrar? */
    temPainel: function () { return Auth.ehAdm() || Auth.secoesAdm().length > 0; },

    /* matrículas desta pessoa na Escola Bíblica: [{ id, sala_id, sala, papel, status }] */
    ebd: function () { return (Auth.acesso && Auth.acesso.ebd) || []; },

    professorDe: function (salaId) {
      return Auth.ebd().some(function (m) { return m.sala_id === salaId && m.papel === 'professor' && m.status === 'ativo'; });
    },

    ehProfessor: function () {
      return Auth.ebd().some(function (m) { return m.papel === 'professor' && m.status === 'ativo'; });
    },

    entrar: function (email, senha) {
      return req('/auth/v1/token?grant_type=password', {
        metodo: 'POST', usarToken: false,
        cabecalhos: { 'Content-Type': 'application/json' },
        corpo: { email: String(email || '').trim().toLowerCase(), password: senha }
      }).then(function (s) {
        Auth.salvarSessao(s);
        return s;
      });
    },

    cadastrar: function (email, senha, dados) {
      return req('/auth/v1/signup', {
        metodo: 'POST', usarToken: false,
        cabecalhos: { 'Content-Type': 'application/json' },
        corpo: {
          email: String(email || '').trim().toLowerCase(),
          password: senha,
          data: dados || {}
        }
      }).then(function (r) {
        if (r && r.access_token) { Auth.salvarSessao(r); return { logado: true, sessao: r }; }
        if (r && r.user && !r.access_token) return { logado: false, usuario: r.user };
        return { logado: false, usuario: null };
      });
    },

    google: function () {
      var destino = CFG.URL_APP;
      location.href = CFG.SUPABASE + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(destino);
    },

    recuperar: function (email) {
      return req('/auth/v1/recover', {
        metodo: 'POST', usarToken: false,
        cabecalhos: { 'Content-Type': 'application/json' },
        corpo: { email: String(email || '').trim().toLowerCase(), redirect_to: CFG.URL_APP }
      });
    },

    renovar: function (forcar) {
      if (!Auth.sessao || !Auth.sessao.refresh_token) return Promise.resolve(false);
      var vence = (Auth.sessao.expires_at || 0) * 1000;
      if (!forcar && vence && vence - Date.now() > 4 * 60 * 1000) return Promise.resolve(true);
      return req('/auth/v1/token?grant_type=refresh_token', {
        metodo: 'POST', usarToken: false,
        cabecalhos: { 'Content-Type': 'application/json' },
        corpo: { refresh_token: Auth.sessao.refresh_token }
      }).then(function (s) {
        if (!s || !s.access_token) return false;
        if (!s.user && Auth.sessao && Auth.sessao.user) s.user = Auth.sessao.user;
        Auth.salvarSessao(s);
        return true;
      }).catch(function () { return false; });
    },

    sair: function () {
      var s = Auth.sessao;
      Auth.limparSessao();
      if (s && s.access_token) {
        return fetch(CFG.SUPABASE + '/auth/v1/logout', {
          method: 'POST',
          headers: { apikey: CFG.KEY, Authorization: 'Bearer ' + s.access_token }
        }).catch(function () {});
      }
      return Promise.resolve();
    },

    trocarSenha: function (nova) {
      return req('/auth/v1/user', {
        metodo: 'PUT',
        cabecalhos: { 'Content-Type': 'application/json' },
        corpo: { password: nova }
      });
    },

    atualizarUsuario: function (dados) {
      return req('/auth/v1/user', {
        metodo: 'PUT',
        cabecalhos: { 'Content-Type': 'application/json' },
        corpo: dados
      });
    },

    /* tokens que voltam do Google no endereço (#access_token=...) */
    tratarRetorno: function () {
      var bruto = location.hash || '';
      if (bruto.indexOf('access_token=') < 0 && bruto.indexOf('error') < 0) return null;
      var p = new URLSearchParams(bruto.replace(/^#/, ''));
      var at = p.get('access_token');
      var erro = p.get('error_description') || p.get('error');
      if (at) {
        var s = {
          access_token: at,
          refresh_token: p.get('refresh_token') || '',
          expires_in: Number(p.get('expires_in') || 3600),
          token_type: p.get('token_type') || 'bearer'
        };
        Auth.salvarSessao(s);
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        return { ok: true };
      }
      if (erro) {
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        return { ok: false, erro: traduzir(decodeURIComponent(erro).replace(/\+/g, ' ')) };
      }
      return null;
    },

    /* busca o usuário do Google (o hash não traz os dados do perfil) */
    carregarUsuario: function () {
      if (!Auth.sessao) return Promise.resolve(null);
      if (Auth.sessao.user) return Promise.resolve(Auth.sessao.user);
      return req('/auth/v1/user').then(function (u) {
        if (u && u.id) {
          Auth.sessao.user = u;
          Auth.salvarSessao(Auth.sessao);
        }
        return u;
      }).catch(function () { return null; });
    }
  };

  /* ---------------- TABELAS ---------------- */
  function consulta(opcoes) {
    opcoes = opcoes || {};
    var q = new URLSearchParams();
    q.set('select', opcoes.select || '*');
    var f = opcoes.filtros || {};
    Object.keys(f).forEach(function (k) {
      var v = f[k];
      if (v === undefined || v === null || v === '') return;
      q.append(k, v);
    });
    if (opcoes.ordem) q.set('order', opcoes.ordem);
    if (opcoes.limite) q.set('limit', opcoes.limite);
    if (opcoes.offset) q.set('offset', opcoes.offset);
    return q.toString();
  }

  var Tabela = {
    listar: function (tabela, opcoes) {
      return req('/rest/v1/' + tabela + '?' + consulta(opcoes)).then(function (r) { return r || []; });
    },
    um: function (tabela, opcoes) {
      return Tabela.listar(tabela, Object.assign({}, opcoes, { limite: 1 })).then(function (r) { return r[0] || null; });
    },
    inserir: function (tabela, dados, opcoes) {
      opcoes = opcoes || {};
      var cab = { 'Content-Type': 'application/json', Prefer: 'return=representation' };
      if (opcoes.upsert) cab.Prefer = 'resolution=merge-duplicates,return=representation';
      var url = '/rest/v1/' + tabela + (opcoes.conflito ? '?on_conflict=' + encodeURIComponent(opcoes.conflito) : '');
      return req(url, { metodo: 'POST', cabecalhos: cab, corpo: dados }).then(function (r) { return (r && r[0]) || null; });
    },
    atualizar: function (tabela, filtros, dados) {
      return req('/rest/v1/' + tabela + '?' + consulta({ select: '*', filtros: filtros }), {
        metodo: 'PATCH',
        cabecalhos: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        corpo: dados
      }).then(function (r) { return (r && r[0]) || null; });
    },
    apagar: function (tabela, filtros) {
      return req('/rest/v1/' + tabela + '?' + consulta({ select: '*', filtros: filtros }), {
        metodo: 'DELETE',
        cabecalhos: { Prefer: 'return=representation' }
      });
    }
  };

  function rpc(nome, args) {
    return req('/rest/v1/rpc/' + nome, {
      metodo: 'POST',
      cabecalhos: { 'Content-Type': 'application/json' },
      corpo: args || {}
    });
  }

  /* ---------------- ARQUIVOS ---------------- */
  var Arquivos = {
    enviar: function (bucket, caminho, arquivo) {
      var token = (Auth.sessao && Auth.sessao.access_token) || CFG.KEY;
      return fetch(CFG.SUPABASE + '/storage/v1/object/' + bucket + '/' + caminho, {
        method: 'POST',
        headers: {
          apikey: CFG.KEY,
          Authorization: 'Bearer ' + token,
          /* sem "x-upsert": cada arquivo recebe um nome único, então o envio
             depende só da regra de INSERT do Storage (nunca de UPDATE). */
          'Content-Type': arquivo.type || 'application/octet-stream'
        },
        body: arquivo
      }).then(function (r) {
        if (!r.ok) {
          return r.text().then(function (t) {
            var d = null; try { d = JSON.parse(t); } catch (e) {}
            throw comErro(traduzir((d && (d.message || d.error)) || t, r.status), r.status, d);
          });
        }
        return r.json().catch(function () { return {}; });
      }, function () {
        throw comErro('Sem conexão para enviar o arquivo. Tente novamente.', 0, null);
      });
    },
    urlPublica: function (bucket, caminho) {
      return CFG.SUPABASE + '/storage/v1/object/public/' + bucket + '/' + caminho;
    },
    /* apaga um arquivo (se não der, tudo bem: o registro no banco é o que vale) */
    apagar: function (bucket, caminho) {
      if (!caminho) return Promise.resolve(false);
      var token = (Auth.sessao && Auth.sessao.access_token) || CFG.KEY;
      return fetch(CFG.SUPABASE + '/storage/v1/object/' + bucket + '/' + caminho, {
        method: 'DELETE',
        headers: { apikey: CFG.KEY, Authorization: 'Bearer ' + token }
      }).then(function (r) { return !!r.ok; }, function () { return false; });
    },
    /* baixa um arquivo privado e devolve um endereço temporário para mostrar na tela */
    baixar: function (bucket, caminho) {
      var token = (Auth.sessao && Auth.sessao.access_token) || CFG.KEY;
      return fetch(CFG.SUPABASE + '/storage/v1/object/authenticated/' + bucket + '/' + caminho, {
        headers: { apikey: CFG.KEY, Authorization: 'Bearer ' + token },
        cache: 'no-store'
      }).then(function (r) {
        if (!r.ok) throw comErro('Não foi possível abrir o arquivo.', r.status, null);
        return r.blob();
      }, function () {
        throw comErro('Sem conexão para abrir o arquivo.', 0, null);
      }).then(function (blob) { return URL.createObjectURL(blob); });
    },
    urlAssinada: function (bucket, caminho, segundos) {
      return req('/storage/v1/object/sign/' + bucket + '/' + caminho, {
        metodo: 'POST',
        cabecalhos: { 'Content-Type': 'application/json' },
        corpo: { expiresIn: segundos || 3600 }
      }).then(function (r) {
        if (r && r.signedURL) {
          var u = r.signedURL;
          return u.indexOf('http') === 0 ? u : CFG.SUPABASE + '/storage/v1' + u;
        }
        return null;
      });
    }
  };

  /* ---------------- PERMISSÕES ---------------- */
  function arrumarAcesso(a) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
    return {
      principal: !!a.principal,
      secoes: Array.isArray(a.secoes) ? a.secoes : [],
      ebd: Array.isArray(a.ebd) ? a.ebd : [],
      ebd_pendentes: Number(a.ebd_pendentes) || 0
    };
  }

  /* pergunta ao banco o que esta pessoa pode fazer (seções liberadas e salas da Escola Bíblica) */
  function carregarAcesso() {
    if (!Auth.logado()) { Auth.acesso = null; return Promise.resolve(null); }
    return rpc('ibnm_meu_acesso', {}).then(function (a) {
      Auth.acesso = arrumarAcesso(a) || { principal: false, secoes: [], ebd: [], ebd_pendentes: 0 };
      try { localStorage.setItem(CHAVE_ACESSO, JSON.stringify(Auth.acesso)); } catch (e) {}
      return Auth.acesso;
    }).catch(function () {
      /* sem internet (ou banco ainda sem a versão 1.1): fica com o que já estava salvo no aparelho */
      return Auth.acesso;
    });
  }

  /* ---------------- PERFIL ---------------- */
  function garantirPerfil() {
    if (!Auth.logado()) return Promise.resolve(null);
    return Auth.carregarUsuario().then(function (u) {
      if (!u || !u.id) return null;
      var uid = u.id;
      return Tabela.um('ibnm_perfis', { filtros: { id: 'eq.' + uid } }).then(function (p) {
        if (p) return p;
        var meta = u.user_metadata || {};
        var nome = meta.nome || meta.full_name || meta.name || (u.email ? String(u.email).split('@')[0] : '');
        return Tabela.inserir('ibnm_perfis', {
          id: uid,
          nome: nome,
          email: u.email || '',
          foto_url: meta.avatar_url || meta.picture || '',
          origem: (meta.provider === 'google' ? 'google' : 'email')
        }, { upsert: true, conflito: 'id' }).then(function () {
          return Tabela.um('ibnm_perfis', { filtros: { id: 'eq.' + uid } });
        });
      });
    }).then(function (perfil) {
      if (perfil) {
        Auth.perfil = perfil;
        try { localStorage.setItem(CHAVE_PERFIL, JSON.stringify(perfil)); } catch (e) {}
      }
      return carregarAcesso().then(function () { return perfil; });
    });
  }

  /* ---------------- CACHE (funcionar sem internet) ---------------- */
  var Cache = {
    pegar: function (chave) {
      try {
        var c = JSON.parse(localStorage.getItem('ibnm.cache.' + chave) || 'null');
        if (c && c.dados !== undefined) return c;
      } catch (e) {}
      return null;
    },
    guardar: function (chave, dados) {
      try {
        localStorage.setItem('ibnm.cache.' + chave, JSON.stringify({ em: Date.now(), dados: dados }));
      } catch (e) {}
    }
  };

  window.IBNM.DB = {
    Auth: Auth,
    Tabela: Tabela,
    rpc: rpc,
    Arquivos: Arquivos,
    garantirPerfil: garantirPerfil,
    carregarAcesso: carregarAcesso,
    Cache: Cache,
    req: req
  };
})();
