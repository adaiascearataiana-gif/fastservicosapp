/* =====================================================================
   FAST 4.0.67 — SINCRONIZAÇÃO SEGURA ENTRE APARELHOS + CARDS DO BACKUP
   ---------------------------------------------------------------------
   Carregar no FINAL do index.html, logo antes do fechamento do body,
   com uma tag script apontando para fast-4067.js?v=1

   O que corrige:
   1) O envio para a nuvem APAGAVA do Supabase tudo que o aparelho ainda
      não tinha baixado. Ex.: rota inserida no navegador + abrir o app ao
      mesmo tempo -> o app apagava a rota nova da nuvem. Agora só sai da
      nuvem o que foi EXCLUÍDO de verdade (lápide) ou o que este aparelho
      já conhecia e o usuário removeu.
   2) Rotas do Dia: itens com ID repetido (item que mudou de dia) ou ID
      de texto ("rdd_...") faziam o banco RECUSAR o envio inteiro.
   3) Download limitado a 1000 registros por tabela (limite do Supabase).
      Agora baixa tudo, em páginas.
   4) Despesas e rotas editadas em outro aparelho eram sobrescritas pela
      cópia antiga local. Agora vale a edição feita de verdade.
   5) TEMPO REAL: conexão aberta com o Supabase Realtime. Quando um
      aparelho salva, os outros são avisados na hora e puxam em ~1-3 s.
      Sem conexão em tempo real, verificação leve a cada 10 s.
   7) ECONOMIA DE TRÁFEGO: baixa só as linhas alteradas (incremental) e
      deixa clientes/destinos/motoristas para a sincronização de 10 min.
   6) Envio imediato (~0,3 s após salvar) e só do que mudou (delta), sem
      reenviar o banco inteiro a cada sincronização.
   7) Aviso claro quando o aparelho está sem login no banco.
   8) Seção "Backup e restauração" em cards separados e espaçados.
   ===================================================================== */
(function () {
  'use strict';
  var W = window;
  if (W.__fast4067) return;
  W.__fast4067 = true;

  var BASE_KEY = 'fast4067_base_v1';
  var VERSAO = 'v24';
  function versaoApp() { try { return (document.querySelector('meta[name="fast-app-version"]') || {}).content || VERSAO; } catch (e) { return VERSAO; } }
  var DIAG = W.__f68Diag = { erro: '', erroEm: 0, envio: 0, baixou: 0 };
  function falha(txt) { DIAG.erro = String(txt).slice(0, 160); DIAG.erroEm = Date.now(); try { painel(true); } catch (e) {} }
  var PAGINA = 1000;
  var LOTE_ENVIO = 150;
  var LOTE_DEL = 50;

  function pronto() {
    return typeof supabaseHeaders === 'function' && typeof SUPABASE_URL === 'string' &&
      typeof bancoDados !== 'undefined';
  }
  function token() {
    try { return typeof W.fastObterTokenSupabase === 'function' ? W.fastObterTokenSupabase() : null; } catch (e) { return null; }
  }
  /* ---------------- login no banco: renova sozinho antes de vencer ---------------- */
  function sessao() { try { return JSON.parse(localStorage.getItem('fast_supa_session') || 'null'); } catch (e) { return null; } }
  var renovando = null;
  function renovarLogin(forcar) {
    var s = sessao();
    if (!s || !s.refresh_token) { DIAG.login = 'sem-sessao'; return Promise.resolve(false); }
    if (!forcar && token() && s.expires_at && s.expires_at - Date.now() > 5 * 60000) return Promise.resolve(true);
    if (renovando) return renovando;
    renovando = (async function () {
      try {
        var base = String(SUPABASE_URL).replace(/\/rest\/v1\/?$/, '');
        var r = await fetch(base + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
          body: JSON.stringify({ refresh_token: s.refresh_token })
        });
        var d = {}; try { d = await r.json(); } catch (e) {}
        if (!r.ok || !d.access_token) { DIAG.login = 'recusado'; return false; }
        var atual = sessao() || {};
        atual.access_token = d.access_token;
        atual.refresh_token = d.refresh_token || s.refresh_token;
        atual.expires_at = Date.now() + (Number(d.expires_in) || 3600) * 1000;
        localStorage.setItem('fast_supa_session', JSON.stringify(atual));
        DIAG.login = 'ok';
        return true;
      } catch (e) { return false; }
      finally { setTimeout(function () { renovando = null; }, 0); }
    })();
    return renovando;
  }
  W.fastRenovarLoginBanco = function () { return renovarLogin(true); };
  setInterval(function () { if (navigator.onLine) renovarLogin(false); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && navigator.onLine) renovarLogin(false); });

  function hsh(s) {
    try { if (typeof fastChecksum === 'function') return fastChecksum(s); } catch (e) {}
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }
  function setStr(arr) {
    var s = new Set();
    (Array.isArray(arr) ? arr : []).forEach(function (x) { if (x != null && x !== '') s.add(String(x)); });
    return s;
  }

  /* ---------------- leitura paginada (sem limite de 1000) ---------------- */
  async function getTudo(tabela, campos, filtro) {
    var saida = [], de = 0;
    for (var volta = 0; volta < 300; volta++) {
      var r = await fetch(SUPABASE_URL + '/' + tabela + '?select=' + campos + (filtro ? '&' + filtro : '') + '&order=id.asc', {
        method: 'GET',
        headers: supabaseHeaders({ 'Range-Unit': 'items', 'Range': de + '-' + (de + PAGINA - 1) })
      });
      if (r.status === 416) break;
      if (r.status === 401) renovarLogin(true);
      if (!r.ok) { falha('Download de ' + tabela + ' recusado (HTTP ' + r.status + ')'); throw new Error('GET ' + tabela + ': HTTP ' + r.status); }
      var linhas = await r.json();
      saida = saida.concat(linhas);
      if (linhas.length < PAGINA) break;
      de += PAGINA;
    }
    return saida;
  }

  /* ---------------- download INCREMENTAL (economiza o limite de tráfego) ----------------
     Guarda uma cópia da tabela no aparelho (IndexedDB) e, a cada sincronização,
     baixa só as linhas alteradas desde a última vez (updated_at). Exclusões são
     detectadas pela contagem. Cópia completa no máximo a cada 30 min. */
  var CACHE = {}, IDB = null, COMPLETA_MS = 30 * 60 * 1000, SOBREPOR_MS = 2 * 60 * 1000;
  function idb() {
    if (IDB) return IDB;
    IDB = new Promise(function (res) {
      try {
        var q = indexedDB.open('fast4068_cache', 1);
        q.onupgradeneeded = function () { q.result.createObjectStore('c'); };
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return IDB;
  }
  async function idbLer(k) {
    var db = await idb(); if (!db) return null;
    return new Promise(function (res) {
      try { var q = db.transaction('c', 'readonly').objectStore('c').get(k); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }
      catch (e) { res(null); }
    });
  }
  async function idbGravar(k, v) {
    var db = await idb(); if (!db) return;
    try { db.transaction('c', 'readwrite').objectStore('c').put(v, k); } catch (e) {}
  }
  function quando(v) {
    if (v == null || v === '') return 0;
    var x = Date.parse(v);
    if (isNaN(x)) x = Date.parse(String(v).replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
    return isNaN(x) ? 0 : x;
  }
  async function contar(tabela) {
    try {
      var r = await fetch(SUPABASE_URL + '/' + tabela + '?select=id&limit=1', { method: 'GET', cache: 'no-store', headers: supabaseHeaders({ 'Prefer': 'count=exact' }) });
      if (!r.ok) return null;
      var cr = r.headers.get('content-range') || '', n = parseInt(cr.split('/')[1], 10);
      return isNaN(n) ? null : n;
    } catch (e) { return null; }
  }
  async function getInc(tabela) {
    var chaveC = String(SUPABASE_URL) + '|' + tabela;
    var c = CACHE[tabela] || await idbLer(chaveC);
    var agora = Date.now();
    var completa = !c || !c.rows || agora - (c.full || 0) > COMPLETA_MS || restaurando();
    if (!completa) {
      var desde = new Date(Math.max(0, (c.wm || 0) - SOBREPOR_MS)).toISOString();
      var novos = await getTudo(tabela, '*', 'updated_at=gte.' + encodeURIComponent(desde));
      novos.forEach(function (r) { c.rows[String(r.id)] = r; c.wm = Math.max(c.wm || 0, quando(r.updated_at)); });
      var total = await contar(tabela), qtd = Object.keys(c.rows).length;
      if (total != null && total !== qtd) {
        var ids = new Set((await getTudo(tabela, 'id')).map(function (r) { return String(r.id); }));
        Object.keys(c.rows).forEach(function (k) { if (!ids.has(k)) delete c.rows[k]; });
        if (ids.size !== Object.keys(c.rows).length) completa = true;   // faltou alguma linha: refaz tudo
      }
    }
    if (completa) {
      var todas = await getTudo(tabela, '*');
      c = { rows: {}, wm: 0, full: agora };
      todas.forEach(function (r) { c.rows[String(r.id)] = r; c.wm = Math.max(c.wm, quando(r.updated_at)); });
    }
    CACHE[tabela] = c;
    idbGravar(chaveC, c);
    return Object.keys(c.rows).map(function (k) { return c.rows[k]; });
  }

  /* ---------------- base: o que este aparelho já sincronizou ---------------- */
  function lerBase() {
    try { var b = JSON.parse(localStorage.getItem(BASE_KEY) || 'null'); return b && b.r ? b : null; } catch (e) { return null; }
  }
  function camposRota(r) {
    var o = rotaToSupabase(r);
    delete o.updated_at; delete o.whatsapp_message_id; delete o.origem_importacao;
    return hsh(JSON.stringify(o));
  }
  function camposDesp(d) {
    var o = despesaToSupabase(d);
    delete o.updated_at;
    return hsh(JSON.stringify(o));
  }
  function hSeq(l) {
    var o = Object.assign({}, l); delete o.updated_at;
    // tabela sem as colunas novas (SQL r101 pendente): compara só o que a nuvem guarda
    try { if (W.r101ColunasFaltando && typeof r101LinhasLegado === 'function') o = r101LinhasLegado([o])[0]; } catch (e) {}
    return hsh(JSON.stringify(o));
  }
  function linhasSeq() { try { return semRepetidos(sequenciasToRows(bancoDados.sequencias || {})); } catch (e) { return []; } }
  function restaurando() { try { return !!restaurandoBackup; } catch (e) { return false; } }

  /* ---------------- estado conhecido da nuvem (para enviar só o que mudou) ---------------- */
  // N = { r:{id:hash}, d:{id:hash}, s:{id:hash}, sr:{id:rota_id} } — preenchido a cada download
  var N = null;
  function fotoNuvem(nuvem) {
    try {
      var n = { r: {}, d: {}, s: {}, sr: {} };
      (nuvem.rotas || []).forEach(function (x) { if (x && x.id != null) n.r[String(x.id)] = camposRota(x); });
      (nuvem.despesas || []).forEach(function (x) { if (x && x.id != null) n.d[String(x.id)] = camposDesp(x); });
      sequenciasToRows(nuvem.sequencias || {}).forEach(function (l) { if (l && l.id != null) { n.s[String(l.id)] = hSeq(l); n.sr[String(l.id)] = l.rota_id; } });
      N = n;
    } catch (e) { N = null; }
  }
  // envia se difere do que a nuvem tem; sem foto da nuvem, compara com a base
  function precisa(id, h, k) {
    if (restaurando()) return true;
    id = String(id);
    if (N) {
      // Fora da sincronização completa: linha que sumiu da nuvem e que este
      // aparelho já tinha enviado sem mudar = provavelmente excluída em outro
      // aparelho. Não reenvia (não "ressuscita"); a completa resolve pelas lápides.
      if (N[k][id] === undefined && !W.__f68Pesada_on) {
        var bb = lerBase();
        if (bb && bb[k] && bb[k][id] === h) return false;
      }
      return N[k][id] !== h;
    }
    var b = lerBase();
    return !(b && b[k] && b[k][id] === h);
  }
  var recentes = {};               // ids que ESTE aparelho acabou de gravar (filtra o eco do tempo real)
  function marcarRecente(tabela, ids) {
    var m = recentes[tabela] || (recentes[tabela] = {}), t = Date.now();
    ids.forEach(function (i) { m[String(i)] = t; });
    W.__f68Enviados = (W.__f68Enviados || 0) + ids.length;
  }
  function ehEco(tabela, id) {
    var t = recentes[tabela] && recentes[tabela][String(id)];
    return !!t && Date.now() - t < 10000;
  }
  function salvarBase() {
    try {
      var b = { r: {}, d: {}, s: {}, em: Date.now() };
      (bancoDados.rotas || []).forEach(function (r) { if (r && r.id != null) b.r[String(r.id)] = camposRota(r); });
      (bancoDados.despesas || []).forEach(function (d) { if (d && d.id != null) b.d[String(d.id)] = camposDesp(d); });
      var seq = bancoDados.sequencias || {};
      linhasSeq().forEach(function (l) { b.s[String(l.id)] = hSeq(l); });
      localStorage.setItem(BASE_KEY, JSON.stringify(b));
    } catch (e) {
      // sem espaço: sem base, só lápides apagam da nuvem (modo mais seguro)
      try { localStorage.removeItem(BASE_KEY); } catch (_) {}
    }
  }

  /* ---------------- IDs: numéricos, estáveis e únicos ---------------- */
  function idValido(v) { var n = Number(v); return isFinite(n) && n > 0 && Math.floor(n) === n; }
  function todosIds() {
    var u = new Set();
    (bancoDados.rotas || []).forEach(function (r) { if (r) u.add(String(r.id)); });
    (bancoDados.despesas || []).forEach(function (d) { if (d) u.add(String(d.id)); });
    var seq = bancoDados.sequencias || {};
    Object.keys(seq).forEach(function (dt) { (seq[dt] || []).forEach(function (it) { if (it) u.add(String(it.id)); }); });
    return u;
  }
  function novoId(usados) {
    var id = Date.now();
    while (usados.has(String(id))) id++;
    usados.add(String(id));
    return id;
  }
  function carimbo(it) {
    var t = function (v) { var x = Date.parse(v || ''); return isNaN(x) ? 0 : x; };
    return Math.max(t(it.statusUpdatedAt), t(it.updatedAt), t(it.dataConclusao), t(it.chegadaEm));
  }

  // Rotas do Dia: corrige IDs inválidos e remove o mesmo item repetido em dias diferentes
  function arrumarSequencias() {
    var seq = bancoDados.sequencias || {}, mudou = false, usados = todosIds();
    Object.keys(seq).forEach(function (dt) {
      (seq[dt] || []).forEach(function (it) {
        if (!it) return;
        if (!idValido(it.id)) {
          var n = Number(it.id);
          it.id = (isFinite(n) && n > 0 && !usados.has(String(Math.floor(n)))) ? Math.floor(n) : novoId(usados);
          usados.add(String(it.id));
          mudou = true;
        }
      });
    });
    var melhor = new Map();
    Object.keys(seq).sort().forEach(function (dt) {
      (seq[dt] || []).forEach(function (it) {
        if (!it) return;
        var k = String(it.id), cur = melhor.get(k);
        if (!cur) { melhor.set(k, { dt: dt, it: it }); return; }
        var a = carimbo(cur.it), b = carimbo(it);
        if (b > a || (b === a && dt >= cur.dt)) melhor.set(k, { dt: dt, it: it });
      });
    });
    Object.keys(seq).forEach(function (dt) {
      var arr = seq[dt] || [];
      var novo = arr.filter(function (it) { if (!it) return false; var m = melhor.get(String(it.id)); return m && m.dt === dt && m.it === it; });
      if (novo.length !== arr.length) { seq[dt] = novo; mudou = true; }
    });
    return mudou;
  }
  function arrumarLista(lista, ligarSeq) {
    var mudou = false, usados = todosIds();
    (lista || []).forEach(function (x) {
      if (!x || idValido(x.id)) return;
      var antigo = String(x.id);
      x.id = novoId(usados); mudou = true;
      if (ligarSeq) {
        var seq = bancoDados.sequencias || {};
        Object.keys(seq).forEach(function (dt) { (seq[dt] || []).forEach(function (it) { if (it && String(it.rotaId) === antigo) it.rotaId = x.id; }); });
      }
    });
    return mudou;
  }
  function gravarLocal() {
    try { localStorage.setItem('banco_gestao_local', JSON.stringify(bancoDados)); } catch (e) {}
  }

  /* ---------------- envio em lotes, sem IDs repetidos ---------------- */
  function semRepetidos(linhas) {
    var m = new Map();
    linhas.forEach(function (l) { if (l && l.id != null && isFinite(Number(l.id))) m.set(String(l.id), l); });
    return Array.from(m.values());
  }
  async function enviarLotes(tabela, linhas, legado, flag) {
    for (var i = 0; i < linhas.length; i += LOTE_ENVIO) {
      var lote = linhas.slice(i, i + LOTE_ENVIO);
      if (legado && W[flag]) lote = legado(lote);
      var r = await fetch(SUPABASE_URL + '/' + tabela, {
        method: 'POST',
        headers: supabaseHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(lote)
      });
      if (!r.ok) {
        var t = await r.text();
        if (legado && !W[flag] && typeof ehErroDeColunaSupabase === 'function' && ehErroDeColunaSupabase(r.status, t)) {
          W[flag] = true; i -= LOTE_ENVIO; continue;
        }
        if (r.status === 401) renovarLogin(true);
        falha('Envio de ' + tabela + ' recusado (HTTP ' + r.status + ') ' + String(t).slice(0, 80));
        throw new Error('POST ' + tabela + ': HTTP ' + r.status + ' — ' + String(t).slice(0, 300));
      }
      marcarRecente(tabela, lote.map(function (l) { return l.id; }));
    }
  }
  async function apagar(tabela, ids) {
    for (var i = 0; i < ids.length; i += LOTE_DEL) {
      var lote = ids.slice(i, i + LOTE_DEL);
      await fetch(SUPABASE_URL + '/' + tabela + '?id=in.(' + lote.join(',') + ')', {
        method: 'DELETE', headers: supabaseHeaders({ 'Prefer': 'return=minimal' })
      });
      marcarRecente(tabela, lote);
    }
  }
  // Só apaga da nuvem: lápide (excluído em qualquer aparelho) OU algo que este
  // aparelho já tinha sincronizado e o usuário removeu. Registro novo de outro
  // aparelho NUNCA é apagado.
  async function limparNuvem(tabela, locais, lapides, conhecidos, campoRota, rotasBloq, k) {
    if (!token()) return;
    var nuvem;
    if (N && k && !restaurando()) {
      nuvem = Object.keys(N[k]).map(function (id) { var o = { id: id }; if (campoRota) o[campoRota] = N.sr[id]; return o; });
    } else {
      nuvem = await getTudo(tabela, campoRota ? 'id,' + campoRota : 'id');
    }
    var del = [];
    nuvem.forEach(function (r) {
      var k = String(r.id);
      if (locais.has(k)) return;
      var bloqRota = rotasBloq && r[campoRota] != null && rotasBloq.has(String(r[campoRota]));
      if (lapides.has(k) || (conhecidos && conhecidos[k]) || bloqRota) del.push(r.id);
    });
    if (del.length) {
      await apagar(tabela, del);
      if (N && k) del.forEach(function (id) { delete N[k][String(id)]; if (N.sr) delete N.sr[String(id)]; });
    }
  }

  function legadoRotas(lote) {
    var cols = (typeof R101_ROTAS_COLS_LEGADO !== 'undefined') ? R101_ROTAS_COLS_LEGADO : ['whatsapp_message_id', 'origem_importacao'];
    return lote.map(function (p) { var c = Object.assign({}, p); cols.forEach(function (k) { delete c[k]; }); delete c.fotos_refs; return c; });
  }
  function legadoSeq(lote) {
    return (typeof r101LinhasLegado === 'function') ? r101LinhasLegado(lote) : lote;
  }

  async function syncRotas() {
    if (arrumarLista(bancoDados.rotas, true)) gravarLocal();
    var locais = bancoDados.rotas || [], hs = {};
    var mud = locais.filter(function (r) { if (!r || r.id == null) return false; var h = camposRota(r); hs[String(r.id)] = h; return precisa(r.id, h, 'r'); });
    var agoraIso = new Date().toISOString();
    var linhas = semRepetidos(mud.map(rotaToSupabase)).map(function (l) { l.updated_at = agoraIso; return l; });
    if (linhas.length) {
      await enviarLotes('rotas', linhas, legadoRotas, 'r101RotasColunasFaltando');
      if (N) linhas.forEach(function (l) { N.r[String(l.id)] = hs[String(l.id)]; });
    }
    var base = lerBase();
    await limparNuvem('rotas', setStr(locais.map(function (r) { return r.id; })), setStr(bancoDados.rotasExcluidas), base && base.r, null, null, 'r');
  }
  async function syncDespesas() {
    if (arrumarLista(bancoDados.despesas, false)) gravarLocal();
    var locais = bancoDados.despesas || [], hs = {};
    var mud = locais.filter(function (d) { if (!d || d.id == null) return false; var h = camposDesp(d); hs[String(d.id)] = h; return precisa(d.id, h, 'd'); });
    var agoraIso = new Date().toISOString();
    var linhas = semRepetidos(mud.map(despesaToSupabase)).map(function (l) { l.updated_at = agoraIso; return l; });
    if (linhas.length) {
      await enviarLotes('despesas', linhas);
      if (N) linhas.forEach(function (l) { N.d[String(l.id)] = hs[String(l.id)]; });
    }
    var base = lerBase();
    await limparNuvem('despesas', setStr(locais.map(function (d) { return d.id; })), setStr(bancoDados.despesasExcluidas), base && base.d, null, null, 'd');
  }
  async function syncSequencias() {
    if (arrumarSequencias()) gravarLocal();
    var todas = linhasSeq(), hs = {};
    var linhas = todas.filter(function (l) { var h = hSeq(l); hs[String(l.id)] = h; return precisa(l.id, h, 's'); });
    if (linhas.length) {
      await enviarLotes('sequencias_itens', linhas, legadoSeq, 'r101ColunasFaltando');
      if (N) linhas.forEach(function (l) { N.s[String(l.id)] = hs[String(l.id)]; N.sr[String(l.id)] = l.rota_id; });
    }
    var base = lerBase();
    var bloq = new Set([].concat(bancoDados.seqRotasExcluidas || [], bancoDados.rotasExcluidas || []).map(String));
    await limparNuvem('sequencias_itens', setStr(todas.map(function (l) { return l.id; })), setStr(bancoDados.seqItensExcluidos), base && base.s, 'rota_id', bloq, 's');
  }

  /* ---------------- merge em 3 vias (edição do outro aparelho vence) ---------------- */
  var CAMPOS_ROTA = ['cliente', 'origem', 'destino', 'data', 'tipoVolume', 'qtdMercadorias', 'pagamento', 'status', 'statusExecucao', 'valor', 'descricao'];
  function mapaPorId(arr) { var m = {}; (arr || []).forEach(function (x) { if (x && x.id != null) m[String(x.id)] = x; }); return m; }
  function tresVias(local, nuvem, res) {
    var base = lerBase();
    if (!base || !token() || !res || !nuvem) return;
    function ajustar(lista, baseMap, locArr, nuvArr, hashFn, combinar) {
      if (!Array.isArray(lista)) return;
      var lm = mapaPorId(locArr), nm = mapaPorId(nuvArr);
      for (var i = 0; i < lista.length; i++) {
        var x = lista[i]; if (!x) continue;
        var k = String(x.id), bh = baseMap[k], l = lm[k], c = nm[k];
        if (!bh || !l || !c) continue;
        var hl, hc;
        try { hl = hashFn(l); hc = hashFn(c); } catch (e) { continue; }
        // aqui ninguém mexeu localmente desde a última sincronização, mas a nuvem mudou
        if (hl === bh && hc !== bh) lista[i] = combinar(x, c);
      }
    }
    ajustar(res.rotas, base.r || {}, local.rotas, nuvem.rotas, camposRota, function (x, c) {
      var y = Object.assign({}, x);
      CAMPOS_ROTA.forEach(function (k) { if (c[k] !== undefined) y[k] = c[k]; });
      if (Array.isArray(c.fotos)) { y.fotos = c.fotos.slice(); y.fotosDoDia = []; }   // fotos próprias vindas de outro aparelho
      if (c.updatedAt) y.updatedAt = c.updatedAt;
      return y;
    });
    ajustar(res.despesas, base.d || {}, local.despesas, nuvem.despesas, camposDesp, function (x, c) {
      return Object.assign({}, x, c);
    });
    // Rotas do Dia: se ESTE aparelho não mexeu no item desde a última sincronização
    // e outro aparelho mudou (cliente, destino, valor, motorista...), adota a versão
    // da nuvem. Antes valia sempre "o local ganha" e a edição do outro não chegava.
    try {
      var bs = base.s || {};
      var hl = {}, hc = {}, nuvIt = {};
      sequenciasToRows(local.sequencias || {}).forEach(function (l) { hl[String(l.id)] = hSeq(l); });
      sequenciasToRows(nuvem.sequencias || {}).forEach(function (l) { hc[String(l.id)] = hSeq(l); });
      Object.keys(nuvem.sequencias || {}).forEach(function (d) { (nuvem.sequencias[d] || []).forEach(function (it) { if (it) nuvIt[String(it.id)] = { d: d, it: it }; }); });
      var seqRes = res.sequencias || {};
      Object.keys(seqRes).forEach(function (d) {
        var arr = seqRes[d] || [];
        for (var i = 0; i < arr.length; i++) {
          var x = arr[i]; if (!x) continue;
          var k = String(x.id), bh = bs[k];
          if (!bh || !hl[k] || !hc[k] || hl[k] !== bh || hc[k] === bh) continue;
          var c = nuvIt[k]; if (!c) continue;
          // adota a nuvem, mas NUNCA troca um valor/motorista/horário preenchido por vazio
          // (a nuvem pode não ter essas colunas e devolvê-las zeradas)
          var y = Object.assign({}, x, c.it);
          ['valor', 'motorista', 'motoristaId', 'chegadaEm', 'dataConclusao', 'obs'].forEach(function (f) {
            var cv = c.it[f], lv = x[f];
            if ((cv == null || cv === '' || (f === 'valor' && !Number(cv))) && lv != null && lv !== '' && !(f === 'valor' && !Number(lv))) y[f] = lv;
          });
          var fu = []; [].concat(Array.isArray(c.it.fotos) ? c.it.fotos : [], Array.isArray(x.fotos) ? x.fotos : []).forEach(function (f) { if (f && fu.indexOf(f) < 0) fu.push(f); });
          var bloq = [].concat(c.it.fotosExcluidas || [], x.fotosExcluidas || []).map(String);
          y.fotos = fu.filter(function (f) { return bloq.indexOf(String(f)) < 0; });
          if (y.fotos.length && !y.foto) y.foto = y.fotos[0];
          if (c.d === d) arr[i] = y;
          else { arr.splice(i, 1); i--; (seqRes[c.d] = seqRes[c.d] || []).push(y); }
        }
      });
    } catch (e) { console.warn('FAST 3 vias (dia):', e); }
  }

  /* ---------------- instalação das correções ---------------- */
  function instalarSync() {
    if (!pronto() || W.__f67SyncOk) return !!W.__f67SyncOk;
    try {
      W.supabaseGetRotas = async function () { return (await getInc('rotas')).map(supabaseToRota); };
      W.supabaseGetDespesas = async function () { return (await getInc('despesas')).map(supabaseToDespesa); };
      W.supabaseGetSequencias = async function () { return rowsToSequencias(await getInc('sequencias_itens')); };

      // sincronização LEVE: só rotas, despesas e Rotas do Dia; o resto (clientes,
      // destinos, motoristas...) vai na sincronização completa, a cada 10 min.
      var baixOrig = W.baixarDaNuvem;
      if (typeof baixOrig === 'function' && !baixOrig.__f68) {
        var bx = async function () {
          if (W.__f68Leve && W.__f68Chaves) {
            var tres = await Promise.all([W.supabaseGetRotas(), W.supabaseGetDespesas(), W.supabaseGetSequencias()]);
            var copia = {};
            W.__f68Chaves.forEach(function (k) {
              if (k === 'rotas' || k === 'despesas' || k === 'sequencias') return;
              try { copia[k] = JSON.parse(JSON.stringify(bancoDados[k] !== undefined ? bancoDados[k] : null)); } catch (e) { copia[k] = bancoDados[k]; }
              if (copia[k] === null) delete copia[k];
            });
            copia.rotas = tres[0]; copia.despesas = tres[1]; copia.sequencias = tres[2];
            return copia;
          }
          var r = await baixOrig.apply(this, arguments);
          if (r && typeof r === 'object') { W.__f68Chaves = Object.keys(r); W.__f68Pesada = Date.now(); }
          return r;
        };
        bx.__f68 = true; W.baixarDaNuvem = bx;
      }
      W.supabaseSyncRotas = syncRotas;
      W.supabaseSyncDespesas = syncDespesas;
      W.supabaseSyncSequencias = syncSequencias;

      var mergeOrig = W.mergeDados;
      if (typeof mergeOrig === 'function' && !mergeOrig.__f67) {
        var m = function (local, nuvem) {
          try { if (nuvem) fotoNuvem(nuvem); } catch (e) {}
          var res = mergeOrig.apply(this, arguments);
          try { tresVias(local, nuvem, res); } catch (e) { console.warn('f67 merge:', e); }
          return res;
        };
        m.__f67 = true; W.mergeDados = m;
      }
      var envOrig = W.enviarParaNuvem;
      if (typeof envOrig === 'function' && !envOrig.__f67) {
        var e = async function () {
          var inicio = Date.now();
          var r;
          if (W.__f68Leve) { await syncRotas(); await syncDespesas(); await syncSequencias(); r = true; }
          else r = await envOrig.apply(this, arguments);
          if (r) { salvarBase(); W.__f67UltimoEnvio = inicio; }
          return r;
        };
        e.__f67 = true; W.enviarParaNuvem = e;
      }
      var syncOrig = W.sincronizarAgora;
      if (typeof syncOrig === 'function' && !syncOrig.__f68) {
        W.__f68SyncOrig = syncOrig;
        var sw = function () { return pedir('sync'); };
        sw.__f68 = true; W.sincronizarAgora = sw;
      }
      W.__f67SyncOk = true;
      console.info('FAST 5.0.0: sincronização segura + tempo real ativa.');
    } catch (err) { console.warn('FAST 4.0.67: falha ao instalar', err); }
    return !!W.__f67SyncOk;
  }

  /* ---------------- lápides (exclusões) viajam junto com o aviso ---------------- */
  var LAPS = ['rotasExcluidas', 'despesasExcluidas', 'seqItensExcluidos', 'seqRotasExcluidas'];
  var lapConh = null;
  function lapAtual() { var o = {}; LAPS.forEach(function (k) { o[k] = setStr(bancoDados[k]); }); return o; }
  function lapNovas() {
    if (!lapConh) return null;
    var o = {}, tem = false;
    LAPS.forEach(function (k) {
      var n = []; setStr(bancoDados[k]).forEach(function (v) { if (!lapConh[k].has(v)) n.push(v); });
      if (n.length) { o[k] = n.slice(-300); tem = true; }
    });
    return tem ? o : null;
  }
  function aplicarLapides(ex) {
    if (!ex || typeof ex !== 'object') return;
    LAPS.forEach(function (k) {
      var l = ex[k]; if (!Array.isArray(l) || !l.length) return;
      if (!Array.isArray(bancoDados[k])) bancoDados[k] = [];
      var tem = setStr(bancoDados[k]);
      l.forEach(function (v) { v = String(v); if (!tem.has(v)) { bancoDados[k].push(v); tem.add(v); } if (lapConh) lapConh[k].add(v); });
    });
  }
  async function subirLapides(novas) {
    try {
      if (typeof R106_COLECOES === 'undefined' || typeof r106GetColecao !== 'function' || typeof r106SyncColecao !== 'function') return;
      if (typeof r106DetectarModos === 'function') await r106DetectarModos();
      for (var k in novas) {
        var cfg = R106_COLECOES.filter(function (c) { return c.chave === k; })[0];
        if (!cfg) continue;
        var u = setStr(await r106GetColecao(cfg));
        setStr(bancoDados[k]).forEach(function (v) { u.add(v); });
        var arr = Array.from(u);
        await r106SyncColecao(cfg, arr);
        bancoDados[k] = arr;
      }
    } catch (e) { console.warn('FAST: lápides sobem na próxima sincronização completa', e); }
  }

  /* ---------------- fila única: envio rápido e sincronização completa ---------------- */
  // Nunca rodam ao mesmo tempo; pedidos repetidos viram um só.
  var PESADA_MS = 10 * 60 * 1000;
  var forcarPesada = false, colHash = null, ultPesadaForcada = 0;
  var COLS = ['clientes', 'destinos', 'motoristas', 'rh', 'despesasEmpresa', 'clientesExcluidos', 'destinosExcluidos', 'motoristasExcluidos', 'rhExcluidos', 'despesasEmpresaExcluidas'];
  function hashColecoes() {
    try { return hsh(JSON.stringify(COLS.map(function (k) { return bancoDados[k] || null; }))); } catch (e) { return null; }
  }
  var assinaturaBase = null;
  var querPush = false, querSync = false, syncRemota = false, rodando = null;
  function pedir(tipo, remota) {
    if (tipo === 'push') querPush = true; else { querSync = true; if (remota) syncRemota = true; else syncRemota = false; }
    if (!rodando) rodando = bomba().finally(function () { rodando = null; });
    return rodando;
  }
  async function bomba() {
    await Promise.resolve();
    while (querPush || querSync) {
      if (querPush) {
        querPush = false;
        if (!N) { querSync = true; continue; }      // ainda não conhece a nuvem: faz a completa
        await empurrar();
      } else {
        querSync = false;
        var remota = syncRemota; syncRemota = false;
        await completa(remota);
      }
      // registra como a nuvem ficou logo após o NOSSO trabalho, para a
      // verificação de reserva só reagir a mudanças de OUTROS aparelhos
      // clientes, destinos, motoristas, funcionários ou despesas da empresa mudaram
      // neste aparelho? então vai a sincronização COMPLETA agora (e avisa os outros)
      if (!querPush && !querSync && colHash !== null && W.__frxSalvouLocal && Date.now() - ultPesadaForcada > 20000 && (W.__frxSalvouLocal = false, hashColecoes() !== colHash)) {
        ultPesadaForcada = Date.now(); forcarPesada = true; querSync = true; continue;
      }
      if (!querPush && !querSync) { try { var sg = await assinatura(); if (sg) assinaturaBase = sg; } catch (e) {} }
    }
  }
  async function empurrar() {
    if (!pronto() || !token() || !navigator.onLine) return;
    var inicio = Date.now();
    W.__f68Enviados = 0;
    var novas = lapNovas();
    try {
      await syncRotas(); await syncDespesas(); await syncSequencias();
      salvarBase(); W.__f67UltimoEnvio = inicio; W.__fastSyncFim = Date.now();
      DIAG.envio = Date.now(); if (DIAG.erro && Date.now() - DIAG.erroEm > 2000) DIAG.erro = '';
      if (novas) {
        LAPS.forEach(function (k) { (novas[k] || []).forEach(function (v) { lapConh[k].add(String(v)); }); });
        gravarLocal();
      }
      if (W.__f68Enviados > 0 || novas) avisarOutros(novas);
      if (novas) subirLapides(novas);
      try { if (typeof atualizarStatusSync === 'function') atualizarStatusSync('ok', 'Sincronizado ✓ (Supabase)'); } catch (e) {}
    } catch (e) {
      console.warn('FAST: envio rápido falhou, tentando a sincronização completa', e);
      querSync = true;
    }
  }
  async function completa(remota) {
    var f = W.__f68SyncOrig;
    if (typeof f !== 'function') return;
    W.__f68Enviados = 0;
    // O embrulho 4.0.66 (dentro do index) recusa rodar se esta marca estiver ligada.
    // Quem controla a fila agora é este arquivo, então liberamos antes de chamar.
    W.__fastSyncRodando = false;
    var pedirPesada = forcarPesada; forcarPesada = false;
    W.__f68Leve = !pedirPesada && !!(W.__f68Chaves && W.__f68Pesada && Date.now() - W.__f68Pesada < PESADA_MS && !restaurando());
    W.__f68Pesada_on = !W.__f68Leve;
    W.__f68LeveUltima = W.__f68Leve;
    var novas = W.__f68Leve ? lapNovas() : null;
    var okSync = false;
    var inicioSync = Date.now();
    try { await f(); okSync = true; DIAG.baixou = Date.now(); if (DIAG.erro && DIAG.erroEm < inicioSync) DIAG.erro = ''; } catch (e) { console.warn('FAST sync:', e); falha('Sincronização: ' + (e && e.message || e)); }
    finally { W.__f68Pesada_on = false; W.__f68Leve = false; W.__fastSyncFim = Date.now(); }
    if (okSync) { reconciliarFotos(); recuperarValores(); }
    if (okSync && !W.__f68LeveUltima) colHash = hashColecoes();   // só a completa sincroniza essas listas
    if (okSync && !W.__f68LeveUltima) lapConh = lapAtual();          // completa: lápides já unidas com a nuvem
    if (novas) { subirLapides(novas); LAPS.forEach(function (k) { (novas[k] || []).forEach(function (v) { if (lapConh) lapConh[k].add(String(v)); }); }); }
    // avisa os outros só se havia mudança DESTE aparelho (evita pingue-pongue)
    if (!remota && pedirPesada && okSync) avisarOutros(novas, true);
    else if (!remota && (W.__f68Enviados > 0 || novas)) avisarOutros(novas);
  }
  function sincronizar(remota) { pedir('sync', remota); }

  /* ---------------- envio logo após salvar ---------------- */
  var pendenteDesde = 0, ultimaTentativa = 0, tPush = 0;
  function instalarSalvar() {
    var f = W.salvarStorage;
    if (typeof f !== 'function' || f.__f67) return;
    var g = function () {
      var r = f.apply(this, arguments);
      if (!pendenteDesde) pendenteDesde = Date.now();
      W.__frxSalvouLocal = true;
      reconciliarLogo();
      clearTimeout(tPush);
      tPush = setTimeout(function () {
        if (!navigator.onLine) return;
        pedir('push');
      }, 300);
      return r;
    };
    Object.keys(f).forEach(function (k) { try { g[k] = f[k]; } catch (e) {} });
    g.__f67 = true; W.salvarStorage = g;
  }
  // rede de segurança: se algo salvo não subiu em 8 s, faz a sincronização completa
  setInterval(function () {
    if (!pendenteDesde) return;
    if ((W.__f67UltimoEnvio || 0) >= pendenteDesde) { pendenteDesde = 0; return; }
    if (!navigator.onLine || rodando) return;
    if (Date.now() - pendenteDesde < 8000 || Date.now() - ultimaTentativa < 8000) return;
    ultimaTentativa = Date.now();
    sincronizar(false);
  }, 1000);

  /* ---------------- TEMPO REAL (Supabase Realtime via WebSocket) ---------------- */
  var APARELHO = (function () {
    try { var k = 'fast4068_aparelho', v = localStorage.getItem(k); if (!v) { v = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem(k, v); } return v; }
    catch (e) { return 'a' + Math.random().toString(36).slice(2, 10); }
  })();
  var TOP_AVISO = 'realtime:fast-sync-aviso', TOP_DB = 'realtime:fast-sync-db';
  var TABS_RT = ['rotas', 'despesas', 'sequencias_itens'];
  var RT = { ws: null, ref: 0, joins: {}, hb: 0, falhas: 0, aberto: false, avisoOk: false, dbOk: false, tok: null, prox: 0 };
  function chave() { try { return SUPABASE_KEY; } catch (e) { return null; } }
  function rtUrl() {
    return String(SUPABASE_URL).replace(/\/rest\/v1\/?$/, '').replace(/^http/, 'ws') +
      '/realtime/v1/websocket?apikey=' + encodeURIComponent(chave()) + '&vsn=1.0.0';
  }
  function rtMandar(topic, event, payload) {
    if (!RT.ws || RT.ws.readyState !== 1) return false;
    var ref = String(++RT.ref);
    var jr = event === 'phx_join' ? ref : (RT.joins[topic] || null);
    if (event === 'phx_join') RT.joins[topic] = ref;
    try { RT.ws.send(JSON.stringify({ topic: topic, event: event, payload: payload, ref: ref, join_ref: jr })); return true; } catch (e) { return false; }
  }
  function rtEntrar() {
    var tk = token();
    RT.tok = tk;
    var p1 = { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [], private: false } };
    var p2 = { config: { broadcast: { self: false }, presence: { key: '' }, private: false,
      postgres_changes: TABS_RT.map(function (t) { return { event: '*', schema: 'public', table: t }; }) } };
    if (tk) { p1.access_token = tk; p2.access_token = tk; }
    rtMandar(TOP_AVISO, 'phx_join', p1);
    rtMandar(TOP_DB, 'phx_join', p2);
  }
  function rtConectar() {
    if (RT.ws || !pronto() || !chave() || !navigator.onLine || !('WebSocket' in W)) return;
    if (Date.now() < RT.prox) return;
    var ws;
    try { ws = new WebSocket(rtUrl()); } catch (e) { rtAgendar(); return; }
    RT.ws = ws; RT.joins = {};
    ws.onopen = function () {
      RT.aberto = true; RT.falhas = 0;
      rtEntrar();
      clearInterval(RT.hb);
      RT.hb = setInterval(function () { rtMandar('phoenix', 'heartbeat', {}); }, 25000);
    };
    ws.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m) return;
      if (m.event === 'phx_reply' && m.payload) {
        var ok = m.payload.status === 'ok';
        if (m.topic === TOP_AVISO && m.ref === RT.joins[TOP_AVISO]) RT.avisoOk = ok;
        if (m.topic === TOP_DB && m.ref === RT.joins[TOP_DB]) RT.dbOk = ok;
        return;
      }
      if (m.event === 'system' && m.topic === TOP_DB && m.payload && m.payload.status === 'error') { RT.dbOk = false; return; }
      if (m.event === 'phx_error' || m.event === 'phx_close') {
        if (m.topic === TOP_AVISO) RT.avisoOk = false;
        if (m.topic === TOP_DB) RT.dbOk = false;
        return;
      }
      if (m.event === 'broadcast' && m.topic === TOP_AVISO) {
        var p = m.payload && m.payload.payload;
        if (p && p.de !== APARELHO) { try { if (p.excl) aplicarLapides(p.excl); } catch (e) {} if (p.pesada) forcarPesada = true; remoto(); }
        return;
      }
      if (m.event === 'postgres_changes' && m.topic === TOP_DB) {
        var d = (m.payload && m.payload.data) || {};
        var rec = d.record || d.old_record || {};
        if (rec.id != null && ehEco(d.table, rec.id)) return;   // eco do que este aparelho gravou
        remoto();
      }
    };
    ws.onclose = function () {
      clearInterval(RT.hb);
      RT.ws = null; RT.aberto = false; RT.avisoOk = false; RT.dbOk = false;
      rtAgendar();
    };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  }
  function rtAgendar() {
    RT.falhas++;
    var espera = Math.min(15000, 500 * Math.pow(2, Math.min(RT.falhas, 5)));
    RT.prox = Date.now() + espera;
    setTimeout(rtConectar, espera + 50);
  }
  function rtConectado() { return RT.aberto && (RT.avisoOk || RT.dbOk); }
  var tRemoto = 0;
  function remoto() {
    clearTimeout(tRemoto);
    tRemoto = setTimeout(function () { sincronizar(true); }, 120);
  }
  function avisarOutros(excl, pesada) {
    var pl = { de: APARELHO, t: Date.now() };
    if (pesada) pl.pesada = 1;
    if (excl) pl.excl = excl;
    rtMandar(TOP_AVISO, 'broadcast', { type: 'broadcast', event: 'mudou', payload: pl });
  }
  // mantém a conexão viva e o login atualizado
  setInterval(function () {
    if (!RT.ws) { rtConectar(); return; }
    var t = token();
    if (RT.aberto && t && t !== RT.tok) {
      RT.tok = t;
      rtMandar(TOP_AVISO, 'access_token', { access_token: t });
      rtMandar(TOP_DB, 'access_token', { access_token: t });
    }
  }, 5000);
  W.addEventListener('online', function () { RT.prox = 0; rtConectar(); });
  W.fastTempoReal = function () { return { conectado: rtConectado(), aviso: RT.avisoOk, banco: RT.dbOk, aparelho: APARELHO }; };

  /* ---------------- verificação leve (reserva do tempo real) ---------------- */
  var checando = false, avisouSemLogin = false, ultimaChecagem = 0;
  async function assinatura() {
    var partes = await Promise.all(TABS_RT.map(async function (t) {
      var r = await fetch(SUPABASE_URL + '/' + t + '?select=updated_at&order=updated_at.desc.nullslast&limit=1', {
        method: 'GET', cache: 'no-store', headers: supabaseHeaders({ 'Prefer': 'count=exact' })
      });
      if (r.status === 401) { renovarLogin(true); return null; }
      if (!r.ok) { falha('Verificação recusada pelo banco (HTTP ' + r.status + ')'); return null; }
      var j = await r.json();
      return (r.headers.get('content-range') || '') + '|' + (j[0] ? j[0].updated_at : '');
    }));
    if (partes.indexOf(null) >= 0) return null;
    return partes.join('#');
  }
  async function checar(forcar) {
    if (checando || document.hidden || !navigator.onLine || !pronto()) return;
    // com tempo real ativo, a verificação vira só reserva (a cada 15 s)
    if (!forcar && Date.now() - ultimaChecagem < (rtConectado() ? 60000 : 10000)) return;
    if (!token()) { await renovarLogin(true); }
    if (!token()) {
      if (!avisouSemLogin) {
        avisouSemLogin = true;
        try { mostrarToastSync('Este aparelho está sem login no banco de dados, então rotas e despesas não sincronizam. Saia e entre de novo com e-mail e senha.', 'error'); } catch (e) {}
      }
      return;
    }
    if (rodando) return;
    checando = true; ultimaChecagem = Date.now();
    try {
      var sig = await assinatura();
      if (!sig) return;
      if (rodando) return;                       // a fila registra a base ao terminar
      if (assinaturaBase === null) { assinaturaBase = sig; return; }
      if (sig !== assinaturaBase) { assinaturaBase = sig; sincronizar(true); }
    } catch (e) {} finally { checando = false; }
  }
  setInterval(function () { checar(false); }, 3000);
  function voltou() {
    if (document.hidden) return;
    RT.prox = 0; rtConectar();
    setTimeout(function () { checar(true); }, 200);
  }
  document.addEventListener('visibilitychange', voltou);
  W.addEventListener('focus', voltou);
  W.addEventListener('online', function () { setTimeout(function () { checar(true); }, 500); });

  /* ---------------- cards da seção Backup e restauração ---------------- */
  var css = document.createElement('style');
  css.id = 'fast-4067-backup-cards';
  css.textContent = [
    '.fast-security-backup-content.f67{display:flex;flex-direction:column;gap:14px}',
    '.fast-security-backup-content.f67 > .fast-security-section-desc{margin:0!important}',
    '.fast-security-backup-content.f67 #infoUltimoBackup .backup-info{display:inline-flex;align-items:center;gap:8px;margin:0;padding:8px 14px;border-radius:999px;background:color-mix(in srgb,var(--accent,#4f46e5) 9%,transparent);color:var(--text,#1f2937);font-size:14px;font-weight:600}',
    '.fast-security-backup-content.f67 #infoUltimoBackup .bi-icon{width:auto;height:auto;background:none;color:var(--accent,#4f46e5);font-size:16px}',
    '.f67-grid{display:grid;grid-template-columns:1fr;gap:14px}',
    '@media(min-width:900px){.f67-grid{grid-template-columns:1fr 1fr}}',
    '.f67-card{--k:#4f46e5;position:relative;display:flex;flex-direction:column;gap:10px;padding:18px 18px 18px 22px;border-radius:16px;background:var(--card-bg,var(--bg-card,#fff));border:1px solid var(--border,#e2e8f0);overflow:hidden}',
    '.f67-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--k)}',
    '.f67-card[data-k="exp"]{--k:#0f9d76}.f67-card[data-k="imp"]{--k:#d97706}.f67-card[data-k="pts"]{--k:#4f46e5}.f67-card[data-k="html"]{--k:#475569}',
    '.f67-card > .config-label{display:flex!important;align-items:center;gap:12px;margin:0!important;text-transform:none!important;letter-spacing:0!important;font-size:16px!important;font-weight:700!important;color:var(--text,#111827)!important;line-height:1.25}',
    '.f67-card > .config-label > i{flex:0 0 40px;width:40px;height:40px;display:grid;place-items:center;border-radius:12px;font-size:17px;color:var(--k);background:color-mix(in srgb,var(--k) 13%,transparent)}',
    '.f67-card > .config-desc{margin:0!important;font-size:14px;line-height:1.5;color:var(--text-muted,#64748b)}',
    '.f67-card[data-k="imp"] > .config-desc{padding:10px 12px;border-radius:10px;background:color-mix(in srgb,#d97706 9%,transparent)}',
    '.f67-card .kbd-hint{display:inline-flex;margin-left:6px;vertical-align:middle}',
    '.f67-card > button,.f67-card .config-btn-row > button{width:100%;min-height:48px;margin:4px 0 0!important;padding:12px 16px!important;border-radius:12px!important;justify-content:center;font-size:15px!important}',
    '.f67-card .config-btn-row{display:grid!important;grid-template-columns:1fr 1fr;gap:10px;margin:0!important}',
    '@media(max-width:420px){.f67-card .config-btn-row{grid-template-columns:1fr}}',
    '.f67-card > button:focus-visible,.f67-card .config-btn-row > button:focus-visible{outline:3px solid var(--k);outline-offset:2px}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(css);

  function cardsBackup() {
    var sec = document.querySelector('.fast-security-backup-content');
    if (!sec || sec.classList.contains('f67')) return;
    var blocos = Array.prototype.filter.call(sec.children, function (el) {
      return el.tagName === 'DIV' && el.querySelector(':scope > .config-label');
    });
    if (!blocos.length) return;
    var grid = document.createElement('div');
    grid.className = 'f67-grid';
    blocos.forEach(function (el) {
      var t = (el.querySelector(':scope > .config-label').textContent || '').toLowerCase();
      el.classList.add('f67-card');
      el.dataset.k = /exportar/.test(t) ? 'exp' : /restaurar dados/.test(t) ? 'imp' : /pontos/.test(t) ? 'pts' : 'html';
      grid.appendChild(el);
    });
    Array.prototype.forEach.call(sec.querySelectorAll(':scope > .config-divider'), function (d) { d.remove(); });
    sec.appendChild(grid);
    sec.classList.add('f67');
  }

  /* ---------------- FOTOS: Google Drive no app (sem tela de login do Google) ----------------
     O Google bloqueia a tela de login dentro de aplicativos. O FAST já tem a
     "conexão permanente" (função google-drive-token no Supabase), mas cada
     aparelho só a usava se ELE MESMO tivesse feito a conexão. Agora qualquer
     aparelho logado no banco pede o acesso ao servidor e esvazia a fila de fotos. */
  var DRV = { estado: '', ultima: 0, pend: -1, falhas: 0 };
  function driveToken() {
    try {
      var exp = Number(localStorage.getItem('fast_drive_access_token_expires_at') || 0);
      var t = sessionStorage.getItem('fast_drive_access_token') || localStorage.getItem('fast_drive_access_token') || '';
      return t && (!exp || Date.now() < exp) ? t : '';
    } catch (e) { return ''; }
  }
  async function fotosNaFila() {
    try {
      if (typeof abrirDBFotos !== 'function') return -1;
      var db = await abrirDBFotos();
      return await new Promise(function (res) {
        // percorre a fila sem carregar tudo de uma vez (fila grande deixava o app lento)
        try {
          var st = db.transaction('driveQueue', 'readonly').objectStore('driveQueue'), n = 0, achou = '';
          var cur = st.openCursor();
          cur.onsuccess = function () {
            var c = cur.result;
            if (!c) { DRV.erroFoto = achou; res(n); return; }
            n++;
            if (!achou && c.value && c.value.ultimoErro) achou = c.value.ultimoErro + ' (' + (c.value.tentativas || 0) + ' tentativa(s))';
            c.continue();
          };
          cur.onerror = function () { res(-1); };
        } catch (e) { res(-1); }
      });
    } catch (e) { return -1; }
  }
  var driveRodando = false;
  async function garantirDrive(forcar) {
    if (driveRodando || !navigator.onLine || !token()) return;
    driveRodando = true;
    try {
      DRV.pend = await fotosNaFila();
      if (driveToken()) {
        DRV.estado = 'conectado'; DRV.falhas = 0;
        if (DRV.pend > 0 && typeof W.fastDriveSincronizarPendentes === 'function') { try { await W.fastDriveSincronizarPendentes(); } catch (e) {} DRV.pend = await fotosNaFila(); }
        return;
      }
      var espera = Math.min(15 * 60000, 60000 * Math.pow(2, DRV.falhas));     // 1, 2, 4... até 15 min
      if (!forcar && Date.now() - DRV.ultima < espera) return;
      DRV.ultima = Date.now();
      if (typeof W.fastDriveRenovarServidor !== 'function') { DRV.estado = 'função de conexão não encontrada'; return; }
      try { if (localStorage.getItem('fast_drive_servidor') !== '1') localStorage.setItem('fast_drive_servidor', '1'); } catch (e) {}
      var ok = false;
      try { ok = await W.fastDriveRenovarServidor(); } catch (e) {}
      if (ok || driveToken()) {
        DRV.estado = 'conectado (permanente)'; DRV.falhas = 0;
        if (DRV.pend > 0 && typeof W.fastDriveSincronizarPendentes === 'function') { try { await W.fastDriveSincronizarPendentes(); } catch (e) {} DRV.pend = await fotosNaFila(); }
      } else {
        DRV.falhas++;
        DRV.estado = 'NÃO conectado — faça a conexão permanente uma vez pelo navegador';
      }
    } finally { driveRodando = false; }
  }
  W.fastGarantirDrive = function () { return garantirDrive(true); };
  setInterval(function () { garantirDrive(false); }, 30000);
  W.addEventListener('load', function () { setTimeout(function () { garantirDrive(true); }, 5000); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(function () { garantirDrive(false); }, 1500); });
  // foto escolhida: tenta subir na hora
  (function () {
    var tEnf = 0;
    function embrulharEnfileirar() {
      var f = W.fastDriveEnfileirarArquivos;
      if (typeof f !== 'function' || f.__f68) return;
      var g = async function () {
        var args = Array.prototype.slice.call(arguments);
        // guarda os BYTES da foto (no app, a referência ao arquivo da galeria
        // pode deixar de ser legível depois, e o envio falha com "Failed to fetch")
        try {
          var lista = Array.from(args[0] || []);
          args[0] = await Promise.all(lista.map(async function (a) {
            try {
              var buf = await a.arrayBuffer();
              return new File([buf], a.name || 'foto.jpg', { type: a.type || 'image/jpeg', lastModified: a.lastModified || Date.now() });
            } catch (e) { return a; }
          }));
        } catch (e) {}
        var tIni = Date.now() - 1000, item = args[1], qtd = (args[0] || []).length;
        var refs = (item && Array.isArray(item.fotos)) ? item.fotos.slice(-qtd) : [];
        var r = await f.apply(this, args);
        try { await ligarRefs(item, refs, tIni); } catch (e) {}
        clearTimeout(tEnf); tEnf = setTimeout(function () { garantirDrive(true); }, 800);
        return r;
      };
      g.__f68 = true; W.fastDriveEnfileirarArquivos = g;
    }
    embrulharEnfileirar();
    W.addEventListener('load', function () { embrulharEnfileirar(); setTimeout(embrulharEnfileirar, 2000); });
    setInterval(embrulharEnfileirar, 5000);
  })();

  /* ---------------- FOTOS ENTRE APARELHOS ----------------
     A foto fica guardada no aparelho que a tirou ("idb:...") e uma cópia vai para
     o Google Drive. Aqui registramos no banco (tabela fotos_drive) qual arquivo do
     Drive corresponde a cada foto; os outros aparelhos baixam do Drive quando não
     têm a foto. O download sai do Google, não do limite de tráfego do Supabase. */
  var MAPA_KEY = 'fast68_fila_ref', PUB_KEY = 'fast68_fotos_pub';
  function lerJSON(k, pad) { try { return JSON.parse(localStorage.getItem(k) || '') || pad; } catch (e) { return pad; } }
  function gravarJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  async function lerStore(nome) {
    if (typeof abrirDBFotos !== 'function') return [];
    var db = await abrirDBFotos();
    return new Promise(function (res) {
      try { var q = db.transaction(nome, 'readonly').objectStore(nome).getAll(); q.onsuccess = function () { res(Array.isArray(q.result) ? q.result : []); }; q.onerror = function () { res([]); }; }
      catch (e) { res([]); }
    });
  }
  async function ligarRefs(item, refs, tIni) {
    if (!item || !refs.length) return;
    var fila = await lerStore('driveQueue');
    var mapa = lerJSON(MAPA_KEY, {});
    var novos = fila.filter(function (r) {
      return r && String(r.itemId || '') === String(item.id) && !r.fotoRef && !mapa[r.id] && Date.parse(r.criadoEm || 0) >= tIni;
    }).sort(function (a, b) { return String(a.id) < String(b.id) ? -1 : 1; });
    novos.forEach(function (r, i) {
      var m = String(r.id).match(/^drive_\d+_(\d+)_/);
      var idx = m ? Number(m[1]) : i;
      var ref = refs[idx];
      if (ref && /^idb:/.test(ref)) mapa[r.id] = ref;
    });
    var ks = Object.keys(mapa); if (ks.length > 3000) ks.slice(0, ks.length - 3000).forEach(function (k) { delete mapa[k]; });
    gravarJSON(MAPA_KEY, mapa);
  }
  var publicando = false;
  async function publicarFotos() {
    if (publicando || !token() || !navigator.onLine || !pronto()) return;
    publicando = true;
    try {
      var led = await lerStore('driveLedger');
      var mapa = lerJSON(MAPA_KEY, {}), pub = lerJSON(PUB_KEY, {});
      var linhas = [];
      led.forEach(function (e) {
        if (!e || !e.driveId || pub[e.id]) return;
        var ref = e.fotoRef || mapa[e.id];
        if (!ref || !/^idb:/.test(ref)) return;
        linhas.push({ ref: ref, drive_id: e.driveId, item_id: String(e.itemId || ''), nome: String(e.nome || '').slice(0, 200), _id: e.id });
      });
      for (var i = 0; i < linhas.length; i += 100) {
        var lote = linhas.slice(i, i + 100);
        var r = await fetch(SUPABASE_URL + '/fotos_drive', {
          method: 'POST', headers: supabaseHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify(lote.map(function (l) { return { ref: l.ref, drive_id: l.drive_id, item_id: l.item_id, nome: l.nome }; }))
        });
        if (!r.ok) { DRV.fotosTabela = r.status === 404 ? 'falta' : 'erro ' + r.status; break; }
        DRV.fotosTabela = 'ok';
        lote.forEach(function (l) { pub[l._id] = 1; });
        gravarJSON(PUB_KEY, pub);
      }
    } catch (e) {} finally { publicando = false; }
  }
  setInterval(function () { if (!document.hidden) publicarFotos(); }, 20000);
  W.addEventListener('load', function () { setTimeout(publicarFotos, 8000); });

  var faltas = {}, buscando = {};
  function blobParaDataURL(b) {
    return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(b); });
  }
  async function fotoDoDrive(chave) {
    var ref = 'idb:' + chave;
    if (faltas[ref] && Date.now() - faltas[ref] < 15000) return null;
    if (buscando[ref]) return buscando[ref];
    buscando[ref] = (async function () {
      try {
        if (!token() || !navigator.onLine) return null;
        var r = await fetch(SUPABASE_URL + '/fotos_drive?select=drive_id&ref=eq.' + encodeURIComponent(ref) + '&limit=1', { headers: supabaseHeaders() });
        if (!r.ok) { faltas[ref] = Date.now(); return null; }
        var j = await r.json();
        if (!j[0] || !j[0].drive_id) { faltas[ref] = Date.now(); return null; }
        var tk = driveToken();
        if (!tk) { await garantirDrive(true); tk = driveToken(); }
        if (!tk) { faltas[ref] = Date.now(); return null; }
        var d = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(j[0].drive_id) + '?alt=media', { headers: { Authorization: 'Bearer ' + tk } });
        if (!d.ok) { faltas[ref] = Date.now(); return null; }
        var b64 = await blobParaDataURL(await d.blob());
        try { if (typeof guardarFotoIndexedDB === 'function') await guardarFotoIndexedDB(chave, b64); } catch (e) {}
        return b64;
      } catch (e) { faltas[ref] = Date.now(); return null; }
      finally { setTimeout(function () { delete buscando[ref]; }, 0); }
    })();
    return buscando[ref];
  }
  // Foto que ainda não tinha subido para o Drive quando a tela foi desenhada: tenta de
  // novo a cada 15 s (consulta em lote) e redesenha as telas assim que ela chega.
  var buscandoFaltas = false;
  setInterval(async function () {
    if (buscandoFaltas || !token() || !navigator.onLine || document.hidden) return;
    var agora = Date.now(), refs = Object.keys(faltas).filter(function (r) { return agora - faltas[r] < 30 * 60000; }).slice(0, 40);
    if (!refs.length) return;
    buscandoFaltas = true;
    try {
      var lista = refs.map(function (r) { return '"' + r.replace(/"/g, '') + '"'; }).join(',');
      var q = await fetch(SUPABASE_URL + '/fotos_drive?select=ref&ref=in.(' + encodeURIComponent(lista) + ')', { headers: supabaseHeaders() });
      if (!q.ok) return;
      var achadas = (await q.json()).map(function (x) { return x.ref; });
      var ok = 0;
      for (var i = 0; i < achadas.length; i++) {
        delete faltas[achadas[i]];
        if (await fotoDoDrive(achadas[i].replace(/^idb:/, ''))) ok++;
      }
      if (ok) {
        try { if (typeof renderizarSequencia === 'function') { W.__frxForcarLista = true; renderizarSequencia(); } } catch (e) {}
        try { if (typeof W.renderizarGaleriaEdicaoRota === 'function' && document.getElementById('modalEditarRota') && getComputedStyle(document.getElementById('modalEditarRota')).display !== 'none') W.renderizarGaleriaEdicaoRota(); } catch (e) {}
      }
    } catch (e) {} finally { buscandoFaltas = false; }
  }, 15000);

  function instalarFotos() {
    var f = W.obterFotoIndexedDB;
    if (typeof f !== 'function' || f.__f68) return;
    var g = async function (chave) {
      var local = await f.apply(this, arguments);
      if (local) return local;
      return fotoDoDrive(String(chave));
    };
    g.__f68 = true; W.obterFotoIndexedDB = g;
    W.__f68ObterLocal = f;
  }

  /* Fotos ANTIGAS (tiradas antes da v11): procura no registro de envios deste
     aparelho o arquivo do Drive que JÁ É dessa foto e registra o vínculo — sem
     criar cópia (uma única imagem no Drive, na pasta da rota). Cópias criadas
     pela v12 na pasta "_FAST sincronização de fotos" são trocadas pelo original
     e vão para a lixeira do Drive. */
  var OK_KEY = 'fast68_fotos_ok2', migrando = false;
  function itensComFotos() {
    var lista = [];
    try {
      var seq = bancoDados.sequencias || {};
      Object.keys(seq).forEach(function (dt) { (seq[dt] || []).forEach(function (it) { if (it && Array.isArray(it.fotos) && it.fotos.length) lista.push({ id: it.id, fotos: it.fotos }); }); });
      (bancoDados.rotas || []).forEach(function (r) { var pr = r ? proprias(r) : []; if (pr.length) lista.push({ id: r.id, fotos: pr }); });
    } catch (e) {}
    return lista;
  }
  function numeroDoNome(n) { var m = String(n || '').match(/Foto\s*(\d+)/i); return m ? Number(m[1]) : 0; }
  async function migrarFotosAntigas() {
    if (migrando || !token() || !navigator.onLine || !pronto()) return;
    if (DRV.fotosTabela === 'falta') return;
    migrando = true;
    try {
      var ok = lerJSON(OK_KEY, {});
      var led = (await lerStore('driveLedger')).filter(function (e) { return e && e.driveId; });
      if (!led.length) { DRV.antigas = 'em dia'; return; }
      var porItem = {};
      led.forEach(function (e) { var k = String(e.itemId || ''); (porItem[k] = porItem[k] || []).push(e); });
      var mapa = lerJSON(MAPA_KEY, {});
      var achados = [];   // {ref, drive_id, item}
      itensComFotos().forEach(function (it) {
        var es = porItem[String(it.id)] || [];
        if (!es.length) return;
        it.fotos.forEach(function (ref, idx) {
          if (typeof ref !== 'string' || !/^idb:/.test(ref) || ok[ref]) return;
          // 1) vínculo exato (envio já sabia qual foto era)
          var e = es.filter(function (x) { return x.fotoRef === ref || mapa[x.id] === ref; })[0];
          // 2) pela numeração "Foto NN" — só quando a quantidade bate (nenhuma foto apagada depois)
          if (!e && es.length === it.fotos.length) e = es.filter(function (x) { return numeroDoNome(x.nome) === idx + 1; })[0];
          if (e) achados.push({ ref: ref, drive_id: e.driveId, item_id: String(it.id), nome: String(e.nome || '').slice(0, 200) });
          else ok[ref] = 1;   // não há como saber qual arquivo é: fica só neste aparelho (sem cópia)
        });
      });
      gravarJSON(OK_KEY, ok);
      if (!achados.length) { DRV.antigas = 'em dia'; return; }
      achados = achados.slice(0, 50);
      var lista = achados.map(function (x) { return '"' + x.ref.replace(/"/g, '') + '"'; }).join(',');
      var r = await fetch(SUPABASE_URL + '/fotos_drive?select=ref,drive_id,nome&ref=in.(' + encodeURIComponent(lista) + ')', { headers: supabaseHeaders() });
      if (!r.ok) { if (r.status === 404) DRV.fotosTabela = 'falta'; return; }
      var existentes = {}; (await r.json()).forEach(function (x) { existentes[x.ref] = x; });
      var gravar = [], lixo = [];
      achados.forEach(function (a) {
        var ex = existentes[a.ref];
        if (!ex) gravar.push(a);
        else if (ex.nome === 'sincronizacao' && ex.drive_id !== a.drive_id) { gravar.push(a); lixo.push(ex.drive_id); }
        else ok[a.ref] = 1;
      });
      if (gravar.length) {
        var up = await fetch(SUPABASE_URL + '/fotos_drive', {
          method: 'POST', headers: supabaseHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify(gravar)
        });
        if (!up.ok) return;
        gravar.forEach(function (a) { ok[a.ref] = 1; });
        DRV.antigasEnviadas = (DRV.antigasEnviadas || 0) + gravar.length;
      }
      gravarJSON(OK_KEY, ok);
      // cópias antigas da v12 vão para a lixeira do Drive (o original continua)
      var tk = driveToken();
      if (tk) for (var i = 0; i < lixo.length; i++) {
        try { await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(lixo[i]), { method: 'PATCH', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }); } catch (e) {}
      }
      DRV.antigas = achados.length < 50 ? 'em dia' : 'enviando';
    } catch (e) {} finally { migrando = false; }
  }
  var ultMigr = 0;
  setInterval(function () { if (document.hidden) return; if (DRV.antigas === 'em dia' && Date.now() - ultMigr < 600000) return; ultMigr = Date.now(); migrarFotosAntigas(); }, 90000);
  W.addEventListener('load', function () { setTimeout(migrarFotosAntigas, 20000); });

  /* ---------------- diagnóstico das FOTOS (o que acontece ao escolher uma imagem) ---------------- */
  var FT = { abriu: 0, escolheu: 0, qtd: -1, tipos: '', msg: '', msgEm: 0, erroJs: '', idb: '' };
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.tagName === 'INPUT' && t.type === 'file' && /image/.test(t.accept || '')) FT.abriu = Date.now();
  }, true);
  // inputs abertos por código (botões Câmera/Galeria) também passam por aqui
  try {
    var clickOrig = HTMLInputElement.prototype.click;
    if (!clickOrig.__f68) {
      var novoClick = function () { try { if (this.type === 'file' && /image/.test(this.accept || '')) FT.abriu = Date.now(); } catch (e) {} return clickOrig.apply(this, arguments); };
      novoClick.__f68 = true; HTMLInputElement.prototype.click = novoClick;
    }
  } catch (e) {}
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'INPUT' || t.type !== 'file' || !/image/.test(t.accept || '')) return;
    FT.escolheu = Date.now();
    FT.qtd = t.files ? t.files.length : 0;
    FT.tipos = Array.prototype.map.call(t.files || [], function (f) { return (f.type || '?') + ' ' + Math.round((f.size || 0) / 1024) + 'KB'; }).join(', ');
    FT.msg = ''; FT.erroJs = '';
    setTimeout(function () { try { painel(true); } catch (e) {} }, 2500);
  }, true);
  W.addEventListener('error', function (e) { if (Date.now() - FT.escolheu < 20000) FT.erroJs = String((e && e.message) || 'erro'); });
  W.addEventListener('unhandledrejection', function (e) { if (Date.now() - FT.escolheu < 20000) FT.erroJs = String((e && e.reason && (e.reason.message || e.reason)) || 'erro'); });
  function ligarFeedbackFoto() {
    var f = W.mostrarFeedbackFoto;
    if (typeof f !== 'function' || f.__f68) return;
    var g = function (id, msg) { try { FT.msg = String(msg || ''); FT.msgEm = Date.now(); } catch (e) {} return f.apply(this, arguments); };
    g.__f68 = true; W.mostrarFeedbackFoto = g;
  }
  async function checarIDB() {
    try {
      if (typeof abrirDBFotos !== 'function') { FT.idb = 'função ausente'; return; }
      var db = await abrirDBFotos();
      var n = await new Promise(function (res) { try { var q = db.transaction('fotosBase64', 'readonly').objectStore('fotosBase64').count(); q.onsuccess = function () { res(q.result); }; q.onerror = function () { res(-1); }; } catch (e) { res(-1); } });
      FT.idb = n >= 0 ? 'ok (' + n + ' foto(s) guardadas neste aparelho)' : 'ERRO ao ler';
    } catch (e) { FT.idb = 'ERRO: ' + ((e && e.message) || e); }
  }
  W.addEventListener('load', function () { setTimeout(checarIDB, 3000); });
  setInterval(checarIDB, 30000);
  // voltou da galeria/câmera sem que a imagem chegasse: mostra o quadro
  document.addEventListener('visibilitychange', function () {
    if (document.hidden || !FT.abriu) return;
    var abriu = FT.abriu;
    setTimeout(function () { if (FT.abriu === abriu && FT.escolheu < abriu && Date.now() - abriu < 5 * 60000) { try { painel(true); } catch (e) {} } }, 3000);
  });

  /* ---------------- CÂMERA: quando o app não libera a câmera ao vivo ----------------
     O ROTAS recusa a câmera ao vivo ("Permission denied"). O código original então
     tentava abrir a câmera do celular, mas DEPOIS do aviso — e o Android só abre a
     câmera/galeria logo após um toque, então nada acontecia. Agora: aparece um botão
     para abrir a câmera do celular (com toque), e das próximas vezes vai direto nela. */
  var CAM_KEY = 'fast68_cam_ao_vivo_negada', ultimoFallback = null;
  function abrirCameraDoCelular(id) {
    var inp = id ? document.getElementById(id) : null;
    if (inp) { inp.click(); return true; }
    return false;
  }
  function avisoCamera(id) {
    var velho = document.getElementById('f68CamAviso'); if (velho) velho.remove();
    var d = document.createElement('div'); d.id = 'f68CamAviso';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px';
    d.innerHTML = '<div style="background:#fff;color:#111;border-radius:16px;padding:20px;max-width:380px;width:100%;font:15px/1.45 system-ui,sans-serif">' +
      '<b style="font-size:17px">A câmera está bloqueada para este app</b>' +
      '<p style="margin:8px 0 6px">Para tirar foto direto daqui, libere a permissão de <b>Câmera</b> do app nas configurações do celular (Configurações → Apps → este app → Permissões → Câmera → Permitir) e abra o app de novo.</p>' +
      '<p style="margin:0 0 14px;color:#475569">Enquanto isso, você pode escolher a foto pela galeria.</p>' +
      '<button type="button" id="f68CamAbrir" style="width:100%;min-height:48px;border:0;border-radius:12px;background:#4f46e5;color:#fff;font-weight:700;font-size:16px">🖼️ Escolher foto</button>' +
      '<button type="button" id="f68CamFechar" style="width:100%;min-height:44px;margin-top:8px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#111;font-size:15px">Cancelar</button></div>';
    try { d.setAttribute('popover', 'manual'); } catch (e) {}
    document.body.appendChild(d);
    try { if (d.showPopover) d.showPopover(); } catch (e) {}
    document.getElementById('f68CamAbrir').addEventListener('click', function () { d.remove(); abrirCameraDoCelular(id); });
    document.getElementById('f68CamFechar').addEventListener('click', function () { d.remove(); });
  }
  function instalarCamera() {
    var f = W.abrirCameraAoVivo;
    if (typeof f === 'function' && !f.__f68) {
      var g = function (dataSel, index, fallbackId) {
        ultimoFallback = fallbackId || null;
        // sempre tenta a câmera ao vivo: assim que a permissão for liberada, ela funciona
        return f.apply(this, arguments);
      };
      g.__f68 = true; W.abrirCameraAoVivo = g;
    }
    var a = W.alert;
    if (typeof a === 'function' && !a.__f68) {
      var al = function (msg) {
        if (/^Não foi possível acessar a câmera do aparelho/.test(String(msg || ''))) {
          try { localStorage.setItem(CAM_KEY, '1'); } catch (e) {}
          var id = ultimoFallback;
          setTimeout(function () { avisoCamera(id); }, 50);
          return;
        }
        return a.apply(this, arguments);
      };
      al.__f68 = true; W.alert = al;
    }
  }
  // se um dia a câmera ao vivo for liberada, volta a usá-la
  try {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' }).then(function (st) {
        function ver() { if (st.state === 'granted') { try { localStorage.removeItem(CAM_KEY); } catch (e) {} } }
        ver(); st.onchange = ver;
      }).catch(function () {});
    }
  } catch (e) {}

  /* ---------------- EDITAR ROTA: campos lado a lado ----------------
     Cliente
     Origem | Destino
     Data | Tipo de volume
     Qtd. volumes | Valor (com − +) | Forma de pag.
     Status de pagamento | Status da rota                         */
  (function () {
    var css = document.createElement('style');
    css.id = 'f68-editar-rota';
    css.textContent = [
      '#modalEditarRota .grid-form.f68er{display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr))!important;gap:10px 10px!important}',
      '#modalEditarRota .grid-form.f68er>*{grid-column:1/-1!important;min-width:0;margin:0!important}',
      '#modalEditarRota .grid-form.f68er>.f68-meia{grid-column:span 6!important}',
      '#modalEditarRota .grid-form.f68er>.f68-qtd{grid-column:span 2!important}',
      '#modalEditarRota .grid-form.f68er>.f68-val{grid-column:span 6!important}',
      '#modalEditarRota .grid-form.f68er>.f68-pag{grid-column:span 4!important}',
      '#modalEditarRota .grid-form.f68er label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}',
      '#modalEditarRota .grid-form.f68er input,#modalEditarRota .grid-form.f68er select{width:100%!important;min-width:0!important;box-sizing:border-box}',
      '#modalEditarRota .grid-form.f68er .f68-qtd input{text-align:center;padding-left:4px!important;padding-right:4px!important}',
      '#modalEditarRota .grid-form.f68er .f68-val>div{gap:4px!important}',
      '#modalEditarRota .grid-form.f68er .f68-val input{flex:1 1 auto;padding-left:8px!important;padding-right:4px!important}',
      '#modalEditarRota .grid-form.f68er .f68-val .fast-step-btn{flex:0 0 34px;width:34px!important;min-width:34px!important;padding:0!important;display:grid;place-items:center}',
      '#modalEditarRota .grid-form.f68er .f68-pag select{padding-left:8px!important;padding-right:20px!important}',
      '@media(max-width:380px){#modalEditarRota .grid-form.f68er label{font-size:11px!important}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(css);
    function campo(id) { var e = document.getElementById(id); return e ? e.closest('#modalEditarRota .grid-form > *') : null; }
    function rotulo(box, txt) { var l = box && box.querySelector('label'); if (l) l.textContent = txt; }
    function arrumar() {
      var grid = document.querySelector('#modalEditarRota .grid-form');
      if (!grid || grid.classList.contains('f68er')) return;
      var ori = campo('editTxtOrigem'), des = campo('editTxtDestino'), dat = campo('editDpDataRota'), tip = campo('editCbTipoVolume'),
        qtd = campo('editTxtQtdMercadorias'), val = campo('editTxtValorRota'), pag = campo('editCbPagamento'),
        stp = campo('editCbStatusRota'), str = campo('editCbStatusExecucao');
      if (!ori || !des || !dat || !tip || !qtd || !val || !pag || !stp || !str) return;
      // ordem: depois do cliente, na sequência pedida
      var ref = ori;
      [des, dat, tip, qtd, val, pag, stp, str].forEach(function (el) { ref.parentNode.insertBefore(el, ref.nextSibling); ref = el; });
      [ori, des, dat, tip, stp, str].forEach(function (el) { el.classList.add('f68-meia'); });
      qtd.classList.add('f68-qtd'); val.classList.add('f68-val'); pag.classList.add('f68-pag');
      rotulo(qtd, 'Qtd.'); rotulo(val, 'Valor (R$):'); rotulo(pag, 'Pagamento:');
      rotulo(stp, 'Status de pagamento:'); rotulo(str, 'Status da rota:'); rotulo(tip, 'Tipo de volume:');
      grid.classList.add('f68er');
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrumar, { once: true }); else arrumar();
    W.addEventListener('load', function () { arrumar(); setTimeout(arrumar, 1500); });
    setInterval(arrumar, 3000);
  })();

  /* ---------------- RELATÓRIO DE ROTAS: contar as fotos tiradas nas Rotas do Dia ----------------
     O relatório só contava as fotos gravadas na própria rota. As fotos tiradas pelo
     card das Rotas do Dia ficam no item do dia (ligado à rota por rotaId) — agora
     entram na contagem, no total "Fotos" e no botão "Abrir fotos" do Drive. */
  var idxSeq = { ref: null, em: 0, mapa: {} };
  function itensDaRota(id) {
    var seq = bancoDados.sequencias || {};
    if (idxSeq.ref !== seq || Date.now() - idxSeq.em > 3000) {
      var m = {};
      Object.keys(seq).forEach(function (d) {
        (seq[d] || []).forEach(function (it) { if (it && it.rotaId != null) { var k = String(it.rotaId); (m[k] = m[k] || []).push(it); } });
      });
      idxSeq = { ref: seq, em: Date.now(), mapa: m };
    }
    return idxSeq.mapa[String(id)] || [];
  }
  function instalarRelatorio() {
    var f = W.fastRelatorioDriveInfo;
    if (typeof f !== 'function' || f.__f68) return;
    var g = function (rota, mapa) {
      var base = f.apply(this, arguments);
      try {
        var itens = itensDaRota(rota && rota.id);
        if (!itens.length) return base;
        var ids = {}; ids[String(rota.id)] = 1;
        itens.forEach(function (it) { ids[String(it.id)] = 1; });
        var vistas = {}, total = 0;
        var todas = [].concat(Array.isArray(rota.fotos) ? rota.fotos : (rota.foto ? [rota.foto] : []));
        itens.forEach(function (it) { if (Array.isArray(it.fotos)) todas = todas.concat(it.fotos); });
        todas.forEach(function (x) { if (x && !vistas[x]) { vistas[x] = 1; total++; } });
        var led = ((mapa && mapa.ledger) || []).filter(function (x) { return ids[String(x.itemId || '')]; });
        var q = ((mapa && mapa.queue) || []).filter(function (x) { return ids[String(x.itemId || '')]; });
        var link = base.link || '';
        if (!link) {
          var pasta = led.filter(function (x) { return x.driveFolderLink || x.driveFolderId; })[0];
          if (pasta) link = pasta.driveFolderLink || ('https://drive.google.com/drive/folders/' + encodeURIComponent(pasta.driveFolderId));
          else { var arq = led.filter(function (x) { return x.link; })[0]; if (arq) link = arq.link; }
        }
        return { total: Math.max(total, base.total || 0), enviados: led.length, pendentes: q.length, link: link };
      } catch (e) { return base; }
    };
    g.__f68 = true; W.fastRelatorioDriveInfo = g;
  }

  /* ---------------- FOTOS DO ROTAS → ROTA DO PAINEL (e relatório) ----------------
     Foto inserida numa Rota do Dia aparece na rota ligada a ela (aba Rotas, coluna
     Imagem, janela Editar Rota e relatório), em qualquer aparelho. As fotos tiradas
     direto na rota também passam a sincronizar (coluna fotos_refs da tabela rotas). */
  function fotosDe(r) { return Array.isArray(r.fotos) ? r.fotos : (r.foto ? [r.foto] : []); }
  function proprias(r) {
    var dia = Array.isArray(r.fotosDoDia) ? r.fotosDoDia : [];
    return fotosDe(r).filter(function (f) { return typeof f === 'string' && f && dia.indexOf(f) < 0; });
  }
  function instalarFotosRota() {
    var t = W.rotaToSupabase;
    if (typeof t === 'function' && !t.__f68) {
      var t2 = function (r) {
        var row = t.apply(this, arguments);
        try { row.fotos_refs = proprias(r || {}).filter(function (f) { return /^(idb:|https?:)/.test(f); }); } catch (e) {}
        return row;
      };
      t2.__f68 = true; W.rotaToSupabase = t2;
    }
    var v = W.supabaseToRota;
    if (typeof v === 'function' && !v.__f68) {
      var v2 = function (row) {
        var r = v.apply(this, arguments);
        try { if (row && Array.isArray(row.fotos_refs) && row.fotos_refs.length) { r.fotos = row.fotos_refs.slice(); r.fotosDoDia = []; } } catch (e) {}
        return r;
      };
      v2.__f68 = true; W.supabaseToRota = v2;
    }
  }
  var tRedesenho = 0;
  function redesenharRotas() {
    clearTimeout(tRedesenho);
    tRedesenho = setTimeout(function () {
      try { if (typeof W.renderizar === 'function') W.renderizar(); } catch (e) {}
      try { if (typeof W.fastRelatorioRotasRender === 'function') W.fastRelatorioRotasRender(); } catch (e) {}
      try {
        var m = document.getElementById('modalEditarRota'), idEl = document.getElementById('editRotaId');
        if (m && idEl && idEl.value && getComputedStyle(m).display !== 'none' && typeof W.renderizarGaleriaEdicaoRota === 'function') {
          var rr = (bancoDados.rotas || []).filter(function (x) { return String(x.id) === String(idEl.value); })[0];
          if (rr) W.renderizarGaleriaEdicaoRota(rr);
        }
      } catch (e) {}
    }, 250);
  }
  function reconciliarFotos() {
    try {
      var seq = bancoDados.sequencias || {}, dia = {};
      Object.keys(seq).sort().forEach(function (d) {
        (seq[d] || []).forEach(function (it) {
          if (!it || it.rotaId == null) return;
          var k = String(it.rotaId), a = dia[k] || (dia[k] = []);
          fotosDe(it).forEach(function (f) { if (f && a.indexOf(f) < 0) a.push(f); });
        });
      });
      var mudou = false;
      (bancoDados.rotas || []).forEach(function (r) {
        if (!r) return;
        var d = dia[String(r.id)] || [], prev = Array.isArray(r.fotosDoDia) ? r.fotosDoDia : [];
        if (!d.length && !prev.length) return;
        var novo = proprias(r);
        d.forEach(function (f) { if (novo.indexOf(f) < 0) novo.push(f); });
        if (JSON.stringify(novo) !== JSON.stringify(fotosDe(r)) || JSON.stringify(d) !== JSON.stringify(prev)) {
          r.fotos = novo; r.foto = novo[0] || ''; r.fotosDoDia = d.slice(); mudou = true;
        }
      });
      if (mudou) { gravarLocal(); redesenharRotas(); }
      return mudou;
    } catch (e) { return false; }
  }
  W.fastReconciliarFotos = reconciliarFotos;
  var tRec = 0;
  function reconciliarLogo() { clearTimeout(tRec); tRec = setTimeout(reconciliarFotos, 300); }
  setInterval(reconciliarFotos, 15000);

  /* ---------------- FOTOS DO MOTORISTA: um único aparelho processa cada foto ----------------
     Vários aparelhos abertos buscavam as mesmas fotos pendentes do motorista ao mesmo
     tempo e podiam gravar a foto duas vezes (e mandar duas cópias ao Drive). Agora o
     aparelho "reserva" a foto no banco antes; só quem conseguiu reservar processa.
     E espera a Rota do Dia chegar ao aparelho (até 2 min), para a foto entrar na rota
     certa — e daí na rota do PAINEL e no relatório. */
  (function () {
    var f0 = W.fetch;
    if (typeof f0 !== 'function' || f0.__f68) return;
    var vistoEm = {};
    function temItem(id) {
      try {
        var seq = bancoDados.sequencias || {};
        return Object.keys(seq).some(function (d) { return (seq[d] || []).some(function (x) { return x && String(x.id) === String(id); }); });
      } catch (e) { return false; }
    }
    var fx = async function (input, init) {
      var url = typeof input === 'string' ? input : ((input && input.url) || '');
      var metodo = String((init && init.method) || 'GET').toUpperCase();
      if (metodo !== 'GET' || url.indexOf('/motorista_fotos?') < 0 || url.indexOf('processado=eq.false') < 0) return f0.apply(this, arguments);
      var r = await f0.apply(this, arguments);
      if (!r.ok) return r;
      var linhas; try { linhas = await r.clone().json(); } catch (e) { return r; }
      if (!Array.isArray(linhas) || !linhas.length) return r;
      var base = url.split('/motorista_fotos')[0], cab = Object.assign({}, (init && init.headers) || {});
      cab['Prefer'] = 'return=representation'; cab['Content-Type'] = 'application/json';
      var minhas = [];
      for (var i = 0; i < linhas.length; i++) {
        var l = linhas[i]; if (!l || l.id == null) continue;
        var k = String(l.id); if (!vistoEm[k]) vistoEm[k] = Date.now();
        if (l.item_id != null && !temItem(l.item_id) && Date.now() - vistoEm[k] < 120000) continue;   // a rota ainda não chegou aqui
        try {
          var c = await f0(base + '/motorista_fotos?id=eq.' + encodeURIComponent(l.id) + '&processado=eq.false', { method: 'PATCH', headers: cab, body: JSON.stringify({ processado: true }) });
          if (c.ok) { var j = await c.json(); if (Array.isArray(j) && j.length) minhas.push(l); }
        } catch (e) {}
      }
      return new Response(JSON.stringify(minhas), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    fx.__f68 = true; W.fetch = fx;
  })();

  /* ---------------- downloads dos APKs sempre do arquivo mais novo ----------------
     O link levava "?v=4.0.66" fixo: o celular podia reaproveitar um APK antigo
     guardado. Agora cada download pede o arquivo atual. */
  (function () {
    function ligar() {
      var f = W.fastUrlAndroid;
      if (typeof f !== 'function' || f.__f68) return;
      var g = function () { var u = f.apply(this, arguments); return u + (u.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now(); };
      g.__f68 = true; W.fastUrlAndroid = g;
    }
    ligar(); W.addEventListener('load', function () { ligar(); setTimeout(ligar, 2000); });
  })();

  /* ---------------- RECUPERAR valores zerados das Rotas do Dia ----------------
     Procura o valor certo de cada item zerado: na rota ligada a ele e nas cópias
     de segurança que o próprio FAST guarda no aparelho (snapshots, autobackup,
     última versão boa). Só preenche onde está 0 — nunca altera valor existente. */
  var mapaValores = null;
  function coletarValores(banco, quando, m) {
    try {
      if (typeof banco === 'string') banco = JSON.parse(banco);
      if (banco && banco.data && !banco.sequencias) banco = banco.data;
      if (typeof banco === 'string') banco = JSON.parse(banco);
      var seq = banco && banco.sequencias; if (!seq) return;
      Object.keys(seq).forEach(function (d) {
        (seq[d] || []).forEach(function (it) {
          if (!it || it.id == null || !(Number(it.valor) > 0)) return;
          var k = String(it.id), e = m[k];
          if (!e || quando >= e.t) m[k] = { v: Number(it.valor), t: quando };
        });
      });
    } catch (e) {}
  }
  async function montarMapaValores() {
    var m = {};
    try { coletarValores(localStorage.getItem('fast_autobackup'), Date.parse(localStorage.getItem('fast_autobackup_data') || 0) || 1, m); } catch (e) {}
    try { var lkg = JSON.parse(localStorage.getItem('fastapp_last_known_good') || 'null'); if (lkg) coletarValores(lkg, Number(lkg.savedAt) || 2, m); } catch (e) {}
    try {
      var db = await new Promise(function (res) { try { var q = indexedDB.open('fastapp_enterprise_db'); q.onsuccess = function () { res(q.result); }; q.onerror = function () { res(null); }; } catch (e) { res(null); } });
      if (db) {
        var nomes = Array.prototype.slice.call(db.objectStoreNames);
        for (var i = 0; i < nomes.length; i++) {
          if (!/snapshot|state/i.test(nomes[i])) continue;
          var lst = await new Promise(function (res) { try { var q = db.transaction(nomes[i], 'readonly').objectStore(nomes[i]).getAll(); q.onsuccess = function () { res(q.result || []); }; q.onerror = function () { res([]); }; } catch (e) { res([]); } });
          lst.forEach(function (x) { coletarValores(x, Number(x && (x.savedAt || x.criadoEm || x.ts)) || 3, m); });
        }
      }
    } catch (e) {}
    return m;
  }
  var recuperando = false;
  async function recuperarValores() {
    if (recuperando) return 0;
    recuperando = true;
    try {
      var seq = bancoDados.sequencias || {}, zerados = [];
      Object.keys(seq).forEach(function (d) { (seq[d] || []).forEach(function (it) { if (it && !(Number(it.valor) > 0)) zerados.push(it); }); });
      if (!zerados.length) return 0;
      if (!mapaValores) mapaValores = await montarMapaValores();
      var rotasPorId = {}; (bancoDados.rotas || []).forEach(function (r) { if (r) rotasPorId[String(r.id)] = r; });
      var n = 0;
      zerados.forEach(function (it) {
        var v = 0, e = mapaValores[String(it.id)];
        if (e && e.v > 0) v = e.v;
        else if (it.rotaId != null && rotasPorId[String(it.rotaId)] && Number(rotasPorId[String(it.rotaId)].valor) > 0) v = Number(rotasPorId[String(it.rotaId)].valor);
        if (v > 0) { it.valor = v; n++; }
      });
      if (n) {
        try { if (typeof salvarStorage === 'function') salvarStorage(); else gravarLocal(); } catch (e) { gravarLocal(); }
        try { if (typeof renderizarSequencia === 'function') renderizarSequencia(); } catch (e) {}
        try { if (typeof mostrarToastSync === 'function') mostrarToastSync('Valores das Rotas do Dia recuperados: ' + n + ' item(ns).', 'success'); } catch (e) {}
        DIAG.valoresRecuperados = (DIAG.valoresRecuperados || 0) + n;
      }
      return n;
    } catch (e) { return 0; } finally { recuperando = false; }
  }
  W.fastRecuperarValores = recuperarValores;
  W.addEventListener('load', function () { setTimeout(recuperarValores, 6000); });
  setInterval(recuperarValores, 60000);

  /* ---------------- painel de diagnóstico (aparece 25 s ao abrir e quando há erro) ---------------- */
  function hora(t) { if (!t) return '—'; var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2); }
  var tPainel = 0;
  function painel(mostrar) {
    if (!document.body) return;
    var el = document.getElementById('f68Diag');
    if (!el) {
      el = document.createElement('div'); el.id = 'f68Diag';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;inset:auto 10px calc(10px + env(safe-area-inset-bottom,0px)) 10px;z-index:2147483000;max-width:460px;width:auto;height:auto;margin:0 auto;padding:10px 14px;border:0;border-radius:12px;font:13px/1.45 system-ui,sans-serif;color:#fff;background:rgba(17,24,39,.94);box-shadow:0 6px 24px rgba(0,0,0,.35);overflow:visible';
      // camada do topo (fica por cima até da tela de login)
      try { el.setAttribute('popover', 'manual'); } catch (e) {}
      ['visibility', 'opacity', 'pointer-events'].forEach(function (k, i) { el.style.setProperty(k, ['visible', '1', 'auto'][i], 'important'); });
      el.innerHTML = '<div id="f68DiagTxt"></div><div id="f68DiagLogin"></div>';
      el.addEventListener('click', function (ev) { if (ev.target.closest && ev.target.closest('#f68DiagLogin')) return; esconderPainel(el); });
      document.body.appendChild(el);
    }
    var tk = !!token(), rt = rtConectado();
    var linhas = [
      '<b>FAST ' + versaoApp() + ' · Sincronização</b> — toque para fechar',
      (tk ? '✅' : '❌') + ' Login no banco: ' + (tk ? 'sim' :
        (DIAG.login === 'sem-sessao' ? 'NÃO — entre NESTE app com e-mail e senha' :
         DIAG.login === 'recusado' ? 'NÃO — login venceu; saia e entre de novo com e-mail e senha' : 'renovando…')),
      (rt ? '✅' : '⚠️') + ' Tempo real: ' + (rt ? 'conectado' : 'desconectado (verificando a cada 10 s)'),
      '⬆️ Último envio: ' + hora(DIAG.envio) + ' · ⬇️ Última leitura: ' + hora(DIAG.baixou),
      (driveToken() ? '✅' : '📷') + ' Google Drive (fotos): ' + (driveToken() ? 'conectado' : (DRV.estado || 'verificando…')) +
        (DRV.pend >= 0 ? ' · ' + DRV.pend + ' foto(s) na fila' : '')
    ];
    linhas.push('🗂️ Armazenamento de fotos: ' + (FT.idb || 'verificando…'));
    if (FT.abriu || FT.escolheu) {
      var sel = FT.escolheu >= FT.abriu && FT.escolheu
        ? (FT.qtd > 0 ? '✅ ' + FT.qtd + ' imagem(ns) recebida(s) às ' + hora(FT.escolheu) + ' (' + FT.tipos.slice(0, 60) + ')' : '❌ a seleção voltou VAZIA às ' + hora(FT.escolheu))
        : '⚠️ galeria/câmera aberta às ' + hora(FT.abriu) + ', mas o app NÃO devolveu a imagem';
      linhas.push('📎 Última foto: ' + sel);
      if (FT.msg && FT.msgEm >= FT.escolheu) linhas.push('💬 ' + FT.msg.replace(/[<>&]/g, '').slice(0, 120));
      if (FT.erroJs) linhas.push('<span style="color:#fca5a5">⛔ Erro ao processar: ' + FT.erroJs.replace(/[<>&]/g, '').slice(0, 140) + '</span>');
    }
    if (DRV.antigasEnviadas) linhas.push('🖼️ Fotos antigas ligadas ao Drive (sem cópia): ' + DRV.antigasEnviadas + (DRV.antigas === 'em dia' ? ' (concluído)' : ' (continuando…)'));
    if (DRV.fotosTabela === 'falta') linhas.push('<span style="color:#fde68a">🖼️ Fotos entre aparelhos: falta rodar o SQL da tabela fotos_drive</span>');
    if (DRV.pend > 0 && DRV.erroFoto) linhas.push('<span style="color:#fde68a">📷 Erro da foto: ' + DRV.erroFoto.replace(/[<>&]/g, '').slice(0, 160) + '</span>');
    if (DIAG.erro) linhas.push('<span style="color:#fca5a5">⛔ ' + DIAG.erro.replace(/[<>&]/g, '') + '</span>');
    document.getElementById('f68DiagTxt').innerHTML = linhas.join('<br>');
    formLogin(!tk && DIAG.login === 'sem-sessao');
    el.style.background = DIAG.erro || !tk ? 'rgba(127,29,29,.95)' : 'rgba(17,24,39,.94)';
    if (mostrar) {
      mostrarPainel(el);
      clearTimeout(tPainel);
      tPainel = setTimeout(function () { if (!DIAG.erro && token()) esconderPainel(el); }, 25000);
    }
  }
  // Mini-apps (Rotas do Dia, Despesas) não têm tela de login própria: quando o
  // aparelho guarda os dados separados do app principal, entra-se por aqui uma vez.
  function formLogin(mostrar) {
    var box = document.getElementById('f68DiagLogin');
    if (!box) return;
    if (!mostrar) { if (box.innerHTML) box.innerHTML = ''; return; }
    if (box.innerHTML) return;   // já está na tela (não apaga o que foi digitado)
    var est = 'width:100%;box-sizing:border-box;margin:6px 0 0;padding:10px 12px;border-radius:10px;border:1px solid #cbd5e1;font-size:15px;color:#111;background:#fff';
    box.innerHTML =
      '<div style="margin-top:8px;font-weight:600">Entrar no banco (uma vez neste app)</div>' +
      '<input id="f68Email" type="email" autocomplete="username" placeholder="E-mail da conta FAST" style="' + est + '">' +
      '<input id="f68Senha" type="password" autocomplete="current-password" placeholder="Senha" style="' + est + '">' +
      '<button id="f68Entrar" type="button" style="width:100%;margin-top:8px;min-height:44px;border:0;border-radius:10px;font-weight:700;font-size:15px;background:#22c55e;color:#06210f">Entrar</button>' +
      '<div id="f68LoginMsg" style="margin-top:6px"></div>';
    document.getElementById('f68Entrar').addEventListener('click', entrarBanco);
  }
  async function entrarBanco() {
    var em = (document.getElementById('f68Email') || {}).value || '', se = (document.getElementById('f68Senha') || {}).value || '';
    var msg = document.getElementById('f68LoginMsg');
    if (!em.trim() || !se) { if (msg) msg.textContent = 'Preencha e-mail e senha.'; return; }
    if (msg) msg.textContent = 'Entrando…';
    try {
      var base = String(SUPABASE_URL).replace(/\/rest\/v1\/?$/, '');
      var r = await fetch(base + '/auth/v1/token?grant_type=password', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
        body: JSON.stringify({ email: em.trim(), password: se })
      });
      var d = {}; try { d = await r.json(); } catch (e) {}
      if (!r.ok || !d.access_token) { if (msg) msg.textContent = 'Não entrou: ' + (d.error_description || d.msg || d.error || ('HTTP ' + r.status)); return; }
      localStorage.setItem('fast_supa_session', JSON.stringify({
        access_token: d.access_token, refresh_token: d.refresh_token,
        expires_at: Date.now() + (Number(d.expires_in) || 3600) * 1000, user: d.user || null
      }));
      // A "senha central" (4.0.66) compara a versão da senha guardada no aparelho com
      // a do servidor e, se forem diferentes, APAGA o login — por isso ele "voltava".
      // Quem acabou de entrar com a senha atual está com a versão certa: registramos.
      try {
        var meta = (d.user && d.user.user_metadata) || {};
        localStorage.setItem('fast_senha_versao', String(meta.senha_alterada_em || ''));
        localStorage.removeItem('fast_senha_mudou');
      } catch (e) {}
      DIAG.login = 'ok';
      var box = document.getElementById('f68DiagLogin'); if (box) box.innerHTML = '';
      painel(true);
      sincronizar(false);
      setTimeout(function () { garantirDrive(true); }, 1500);
    } catch (e) { if (msg) msg.textContent = 'Sem conexão. Tente de novo.'; }
  }
  function painelAberto(el) { try { if (el.showPopover) return el.matches(':popover-open'); } catch (e) {} return el.style.display !== 'none'; }
  function mostrarPainel(el) {
    try { if (el.showPopover) { if (!el.matches(':popover-open')) el.showPopover(); return; } } catch (e) {}
    el.style.display = 'block';
  }
  function esconderPainel(el) {
    try { if (el.hidePopover) { if (el.matches(':popover-open')) el.hidePopover(); return; } } catch (e) {}
    el.style.display = 'none';
  }
  W.fastDiagnosticoSync = function () { painel(true); };
  setInterval(function () { try { var el = document.getElementById('f68Diag'); if (el && painelAberto(el)) painel(false); } catch (e) {} }, 2000);
  // abre sozinho só quando há algo a resolver (sem login, erro, ou fotos presas sem Drive);
  // com tudo certo fica escondido — dá para abrir em Ferramentas FAST → Sincronização
  W.addEventListener('load', function () { setTimeout(function () {
    if (!token() || DIAG.erro || (!driveToken() && DRV.pend > 0)) painel(true);
  }, 6000); });
  var stOrig = null;
  function ligarStatus() {
    var f = W.atualizarStatusSync;
    if (typeof f !== 'function' || f.__f68) return;
    var g = function (tipo, msg) {
      try { if (tipo === 'error') falha(msg || 'Erro na sincronização'); } catch (e) {}
      return f.apply(this, arguments);
    };
    g.__f68 = true; W.atualizarStatusSync = g;
  }

  /* ---------------- partida ---------------- */
  function tudo() { instalarSync(); instalarSalvar(); cardsBackup(); rtConectar(); ligarStatus(); instalarFotos(); ligarFeedbackFoto(); instalarCamera(); instalarRelatorio(); instalarFotosRota(); reconciliarLogo(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tudo, { once: true }); else tudo();
  W.addEventListener('load', function () { tudo(); setTimeout(tudo, 1500); setTimeout(tudo, 3500); });
  setInterval(cardsBackup, 2000);
})();
