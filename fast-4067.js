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
      if (!r.ok) throw new Error('GET ' + tabela + ': HTTP ' + r.status);
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
  function hSeq(l) { var o = Object.assign({}, l); delete o.updated_at; return hsh(JSON.stringify(o)); }
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
    return lote.map(function (p) { var c = Object.assign({}, p); cols.forEach(function (k) { delete c[k]; }); return c; });
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
      if (c.updatedAt) y.updatedAt = c.updatedAt;
      return y;
    });
    ajustar(res.despesas, base.d || {}, local.despesas, nuvem.despesas, camposDesp, function (x, c) {
      return Object.assign({}, x, c);
    });
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
      console.info('FAST 4.0.67: sincronização segura + tempo real ativa.');
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
    W.__f68Leve = !!(W.__f68Chaves && W.__f68Pesada && Date.now() - W.__f68Pesada < PESADA_MS && !restaurando());
    W.__f68Pesada_on = !W.__f68Leve;
    W.__f68LeveUltima = W.__f68Leve;
    var novas = W.__f68Leve ? lapNovas() : null;
    var okSync = false;
    try { await f(); okSync = true; } catch (e) { console.warn('FAST sync:', e); }
    finally { W.__f68Pesada_on = false; W.__f68Leve = false; W.__fastSyncFim = Date.now(); }
    if (okSync && !W.__f68LeveUltima) lapConh = lapAtual();          // completa: lápides já unidas com a nuvem
    if (novas) { subirLapides(novas); LAPS.forEach(function (k) { (novas[k] || []).forEach(function (v) { if (lapConh) lapConh[k].add(String(v)); }); }); }
    // avisa os outros só se havia mudança DESTE aparelho (evita pingue-pongue)
    if (!remota && (W.__f68Enviados > 0 || novas)) avisarOutros(novas);
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
      clearTimeout(tPush);
      tPush = setTimeout(function () { if (navigator.onLine) pedir('push'); }, 300);
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
        if (p && p.de !== APARELHO) { try { if (p.excl) aplicarLapides(p.excl); } catch (e) {} remoto(); }
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
  function avisarOutros(excl) {
    var pl = { de: APARELHO, t: Date.now() };
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
      if (!r.ok) return null;
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

  /* ---------------- partida ---------------- */
  function tudo() { instalarSync(); instalarSalvar(); cardsBackup(); rtConectar(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tudo, { once: true }); else tudo();
  W.addEventListener('load', function () { tudo(); setTimeout(tudo, 1500); setTimeout(tudo, 3500); });
  setInterval(cardsBackup, 2000);
})();
