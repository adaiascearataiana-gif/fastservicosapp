/* =====================================================================
   FAST — RECURSOS NOVOS (carregado depois de fast-4067.js)
   3  Alerta de rota atrasada            15 Galeria de fotos por rota
   6  Avisar cliente / acompanhamento    18 Bloqueio por PIN
   8  Ficha (histórico) do cliente       20 Backup semanal no Google Drive
   9  Tabela de preços por destino       22 Indicadores no Centro de Operações
   10 Cobrança de pendentes (WhatsApp+PIX) 24 Busca completa
   11 Fechamento do período + PDF
   ===================================================================== */
(function () {
  'use strict';
  var W = window;
  if (W.__fastRecursos) return;
  W.__fastRecursos = true;

  var LINK_CLIENTE = 'https://adaiascearataiana-gif.github.io/fastservicosapp/app-cliente/';

  /* ---------------- utilidades ---------------- */
  function $(id) { return document.getElementById(id); }
  function bd() { try { return bancoDados || {}; } catch (e) { return {}; } }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function moeda(n) { return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function num(v) {
    if (typeof v === 'number') return v;
    try { if (typeof fastParseMoeda === 'function') return fastParseMoeda(v) || 0; } catch (e) {}
    var s = String(v || '').replace(/[^\d,.-]/g, ''); if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    return Number(s) || 0;
  }
  function dataBR(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : (iso || '—'); }
  function hojeISO(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function aviso(msg, tipo) { try { if (typeof mostrarNotificacao === 'function') { mostrarNotificacao(msg, tipo || 'success'); return; } } catch (e) {} try { console.log(msg); } catch (e) {} }
  function token() { try { return W.fastObterTokenSupabase ? W.fastObterTokenSupabase() : null; } catch (e) { return null; } }
  function cab(extra) {
    var h = { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' };
    var t = token(); h['Authorization'] = 'Bearer ' + (t || SUPABASE_KEY);
    return Object.assign(h, extra || {});
  }
  function pago(r) { return /receb|pago/i.test(String(r && r.status || '')); }
  function rotas() { return (bd().rotas || []).filter(function (r) { return r && !r.teste; }); }
  function acharCliente(nome) {
    var n = norm(nome);
    return (bd().clientes || []).filter(function (c) { return c && (norm(c.nome) === n || norm(c.apelido) === n); })[0] || null;
  }
  function telefoneDe(nome) {
    var c = acharCliente(nome); if (!c) return '';
    var t = String(c.whatsapp || c.telefone || c.celular || '').replace(/\D/g, '');
    if (!t) return '';
    if (t.length <= 11) t = '55' + t;
    return t;
  }
  function abrirWhats(tel, texto) {
    var url = 'https://wa.me/' + (tel || '') + '?text=' + encodeURIComponent(texto);
    try { W.open(url, '_blank'); } catch (e) { location.href = url; }
  }

  /* ---------------- janela (modal) própria ---------------- */
  var css = document.createElement('style');
  css.id = 'fast-recursos-css';
  css.textContent = [
    '.frx-ov{position:fixed;inset:0;z-index:2147482000;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center;padding:0}',
    '@media(min-width:720px){.frx-ov{align-items:center;padding:20px}}',
    '.frx-cx{background:var(--card-bg,#fff);color:var(--text-main,#0f172a);width:100%;max-width:760px;max-height:88vh;max-height:calc(100dvh - 24px);display:flex;flex-direction:column;border-radius:20px 20px 0 0;box-shadow:0 20px 60px rgba(0,0,0,.35);font-family:inherit}',
    '@media(min-width:720px){.frx-cx{border-radius:20px}}',
    '.frx-hd{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--border,#e2e8f0)}',
    '.frx-hd h3{margin:0;font-size:17px;font-weight:800;flex:1}',
    '.frx-x{border:1px solid var(--border,#e2e8f0);background:transparent;color:inherit;border-radius:10px;width:40px;height:40px;font-size:18px;cursor:pointer}',
    '.frx-bd{padding:14px 18px;overflow:auto;flex:1}',
    '.frx-ft{flex:0 0 auto;padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--border,#e2e8f0);display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;background:inherit;border-radius:0 0 20px 20px}',
    '.frx-hd{flex:0 0 auto}.frx-bd{min-height:0}',
    '@media(max-width:560px){.frx-ft .frx-btn{flex:1 1 auto}}',
    '.frx-btn{border:0;border-radius:12px;padding:11px 16px;font-weight:700;font-size:14px;cursor:pointer;background:#4f46e5;color:#fff;min-height:44px}',
    '.frx-btn.sec{background:transparent;color:inherit;border:1px solid var(--border,#cbd5e1)}',
    '.frx-btn.ok{background:#16a34a}.frx-btn.wa{background:#22c55e;color:#052e16}.frx-btn.pq{padding:7px 10px;min-height:36px;font-size:13px}',
    '.frx-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:12px}',
    '.frx-kpi{border:1px solid var(--border,#e2e8f0);border-radius:14px;padding:10px 12px}.frx-kpi small{display:block;font-size:11px;font-weight:700;opacity:.7;text-transform:uppercase}.frx-kpi b{font-size:17px}',
    '.frx-tb{width:100%;border-collapse:collapse;font-size:13px}.frx-tb th,.frx-tb td{padding:8px 6px;border-bottom:1px solid var(--border,#e2e8f0);text-align:left;vertical-align:top}.frx-tb th{font-size:11px;text-transform:uppercase;opacity:.7}',
    '.frx-wrap{overflow-x:auto}.frx-in{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--border,#cbd5e1);background:var(--input-bg,#fff);color:inherit;font-size:15px}',
    '.frx-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}.frx-row>label{font-size:12px;font-weight:700;opacity:.75}',
    '.frx-muted{opacity:.7;font-size:12px}.frx-pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;background:#fef3c7;color:#92400e}',
    '.frx-fotos{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}.frx-fotos figure{margin:0;border-radius:12px;overflow:hidden;border:1px solid var(--border,#e2e8f0);background:#0001;aspect-ratio:1;display:grid;place-items:center;cursor:pointer}.frx-fotos img{width:100%;height:100%;object-fit:cover}',
    '#frxTools{margin:0 0 16px}#frxTools .frx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}',
    '#frxTools .frx-tool{border:1px solid var(--border,#e2e8f0);background:var(--card-bg,#fff);color:inherit;border-radius:14px;padding:12px;text-align:left;font-weight:700;font-size:14px;cursor:pointer;min-height:56px}',
    '#frxTools .frx-tool{display:block!important;text-align:left!important;white-space:normal!important;line-height:1.3}',
    '#frxTools .frx-tool span{display:block!important;font-size:11px;font-weight:600;opacity:.65;margin-top:3px}',
    '.frx-precohint{font-size:11px;font-weight:700;color:#16a34a;margin-top:4px}',
    '.frx-av{margin-left:6px}',
    '#frxEnvios{margin:0 0 14px}.frx-env{border:2px dashed #22c55e;border-radius:18px;padding:14px;margin-bottom:10px;background:var(--card-bg,#fff)}',
    '.frx-env-hd{font-weight:800;font-size:16px;margin-bottom:6px}.frx-env-lista{margin:0 0 8px;padding-left:18px;font-size:13px}.frx-env-lista li{margin:2px 0}',
    '.frx-env-fotos{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;align-items:center}.frx-env-fotos img{width:58px;height:58px;object-fit:cover;border-radius:10px;border:1px solid var(--border,#e2e8f0)}',
    '.frx-env-bt{display:flex;gap:8px;flex-wrap:wrap}.frx-env-bt .frx-btn{flex:1 1 auto}',
    '#frxPin{position:fixed;inset:0;z-index:2147483600;background:linear-gradient(160deg,#0f172a,#1e293b);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}',
    '#frxPin .c{width:min(340px,92vw);text-align:center;color:#fff}#frxPin h2{margin:6px 0 4px;font-size:20px}#frxPin p{margin:0 0 14px;opacity:.75;font-size:14px}',
    '#frxPin .dots{display:flex;gap:12px;justify-content:center;margin:12px 0 18px}#frxPin .dots i{width:14px;height:14px;border-radius:50%;border:2px solid #fff;display:block}#frxPin .dots i.on{background:#fff}',
    '#frxPin .kp{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}#frxPin .kp button{height:64px;border-radius:18px;border:0;background:#ffffff1f;color:#fff;font-size:24px;font-weight:700}',
    '#frxPin .err{color:#fca5a5;min-height:20px;font-size:13px;margin-top:10px}#frxPin .lk{background:none;border:0;color:#c7d2fe;margin-top:12px;font-size:13px;text-decoration:underline}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(css);

  function janela(titulo, corpo, botoes) {
    var ov = document.createElement('div'); ov.className = 'frx-ov';
    ov.innerHTML = '<div class="frx-cx" role="dialog" aria-modal="true"><div class="frx-hd"><h3></h3><button type="button" class="frx-x" aria-label="Fechar">✕</button></div><div class="frx-bd"></div><div class="frx-ft"></div></div>';
    ov.querySelector('h3').textContent = titulo;
    var b = ov.querySelector('.frx-bd'); if (typeof corpo === 'string') b.innerHTML = corpo; else b.appendChild(corpo);
    var ft = ov.querySelector('.frx-ft');
    (botoes || []).forEach(function (bt) {
      var e = document.createElement('button'); e.type = 'button'; e.className = 'frx-btn ' + (bt.cls || ''); e.textContent = bt.txt;
      e.onclick = function () { bt.fn(fechar, ov); }; ft.appendChild(e);
    });
    if (!botoes || !botoes.length) ft.style.display = 'none';
    function fechar() { ov.remove(); }
    ov.querySelector('.frx-x').onclick = fechar;
    ov.addEventListener('click', function (e) { if (e.target === ov) fechar(); });
    ov.style.setProperty('visibility', 'visible', 'important');
    try { ov.setAttribute('popover', 'manual'); ov.style.cssText += ';margin:0;border:0;width:100vw;height:100vh;height:100dvh;max-width:none;max-height:none;padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box;'; } catch (e) {}
    document.body.appendChild(ov);
    try { if (ov.showPopover) ov.showPopover(); } catch (e) {}
    return { el: ov, corpo: b, fechar: fechar };
  }

  /* ---------------- configurações compartilhadas (tabela fast_config) ---------------- */
  var CFG_LOCAL = 'fast68_config_v1';
  var CFG = (function () { try { return JSON.parse(localStorage.getItem(CFG_LOCAL) || '{}') || {}; } catch (e) { return {}; } })();
  var cfgFalta = false;
  function cfgGravarLocal() { try { localStorage.setItem(CFG_LOCAL, JSON.stringify(CFG)); } catch (e) {} }
  async function cfgCarregar() {
    if (!token() || !navigator.onLine) return;
    try {
      var r = await fetch(SUPABASE_URL + '/fast_config?select=chave,valor,updated_at', { headers: cab(), cache: 'no-store' });
      if (r.status === 404) { cfgFalta = true; return; }
      if (!r.ok) return;
      cfgFalta = false;
      (await r.json()).forEach(function (l) { CFG[l.chave] = l.valor; });
      cfgGravarLocal();
    } catch (e) {}
  }
  async function cfgSalvar(chave, valor) {
    CFG[chave] = valor; cfgGravarLocal();
    try {
      var r = await fetch(SUPABASE_URL + '/fast_config', { method: 'POST', headers: cab({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify([{ chave: chave, valor: valor, updated_at: new Date().toISOString() }]) });
      if (r.status === 404) { cfgFalta = true; aviso('Salvo só neste aparelho. Rode o SQL da tabela fast_config para valer em todos.', 'warning'); }
      return r.ok;
    } catch (e) { return false; }
  }
  setTimeout(cfgCarregar, 6000);
  setInterval(cfgCarregar, 5 * 60000);

  /* =====================================================================
     9) TABELA DE PREÇOS POR DESTINO
     ===================================================================== */
  function sugestoesPreco() {
    var m = {};
    function add(dest, valor, data) {
      var k = norm(dest), v = Number(valor) || 0; if (!k || v <= 0) return;
      var e = m[k] || (m[k] = { destino: String(dest).trim(), usos: 0, valores: {}, ultimo: '', ultimoValor: 0 });
      e.usos++; e.valores[v] = (e.valores[v] || 0) + 1;
      if (String(data || '') >= e.ultimo) { e.ultimo = String(data || ''); e.ultimoValor = v; }
    }
    rotas().forEach(function (r) { String(r.destino || '').split(/\s*\|\s*|\s*;\s*/).length === 1 && add(r.destino, r.valor, r.data); });
    var seq = bd().sequencias || {};
    Object.keys(seq).forEach(function (d) { (seq[d] || []).forEach(function (it) { if (it && !it.rotaId) add(it.destino, it.valor, d); }); });
    Object.keys(m).forEach(function (k) {
      var e = m[k], melhor = 0, vezes = -1;
      Object.keys(e.valores).forEach(function (v) { var n = e.valores[v]; if (n > vezes || (n === vezes && Number(v) === e.ultimoValor)) { vezes = n; melhor = Number(v); } });
      e.valor = melhor;
    });
    return m;
  }
  function tabelaPrecos() {
    var sug = sugestoesPreco(), man = (CFG.precos_destino && typeof CFG.precos_destino === 'object') ? CFG.precos_destino : {};
    var t = {};
    Object.keys(sug).forEach(function (k) { t[k] = { destino: sug[k].destino, valor: sug[k].valor, usos: sug[k].usos, manual: false }; });
    Object.keys(man).forEach(function (k) { var x = man[k]; if (!x) return; t[k] = { destino: x.destino || (t[k] && t[k].destino) || k, valor: Number(x.valor) || 0, usos: t[k] ? t[k].usos : 0, manual: true }; });
    return t;
  }
  function precoDe(destino) { var k = norm(destino); if (!k) return 0; var t = tabelaPrecos()[k]; return t ? t.valor : 0; }
  W.fastPrecoDestino = precoDe;

  W.fastTabelaPrecos = function () {
    var t = tabelaPrecos();
    var chaves = Object.keys(t).sort(function (a, b) { return (t[b].usos - t[a].usos) || t[a].destino.localeCompare(t[b].destino, 'pt-BR'); });
    var div = document.createElement('div');
    div.innerHTML = '<p class="frx-muted" style="margin:0 0 10px">Preços sugeridos pelo valor mais cobrado de cada destino nas rotas já cadastradas. Mude o que quiser — o valor entra sozinho ao digitar o destino numa rota nova.</p>' +
      '<div class="frx-row"><input class="frx-in" id="frxPrecoBusca" placeholder="Buscar destino…"></div>' +
      '<div class="frx-row"><input class="frx-in" id="frxNovoDest" placeholder="Novo destino" style="flex:2;min-width:140px"><input class="frx-in" id="frxNovoVal" inputmode="decimal" placeholder="R$ 0,00" style="flex:1;min-width:90px"><button type="button" class="frx-btn pq" id="frxNovoAdd">Adicionar</button></div>' +
      '<div class="frx-wrap"><table class="frx-tb"><thead><tr><th>Destino</th><th>Usos</th><th style="width:120px">Valor</th><th></th></tr></thead><tbody id="frxPrecoBody"></tbody></table></div>';
    var edits = {};
    function desenhar() {
      var q = norm(($('frxPrecoBusca') || {}).value || '');
      $('frxPrecoBody').innerHTML = chaves.filter(function (k) { return !q || k.indexOf(q) >= 0; }).slice(0, 400).map(function (k) {
        var e = t[k], v = edits[k] != null ? edits[k] : e.valor;
        return '<tr><td>' + esc(e.destino) + (e.manual ? ' <span class="frx-pill">editado</span>' : '') + '</td><td>' + (e.usos || 0) + '</td>' +
          '<td><input class="frx-in" data-k="' + esc(k) + '" inputmode="decimal" value="' + esc(v ? v.toFixed(2).replace('.', ',') : '') + '" style="padding:7px 8px"></td>' +
          '<td>' + (e.manual ? '<button type="button" class="frx-btn sec pq" data-r="' + esc(k) + '" title="Voltar ao valor sugerido">↺</button>' : '') + '</td></tr>';
      }).join('') || '<tr><td colspan="4" class="frx-muted">Nenhum destino.</td></tr>';
    }
    var j = janela('💲 Tabela de preços por destino', div, [
      { txt: 'Fechar', cls: 'sec', fn: function (f) { f(); } },
      { txt: 'Salvar', cls: 'ok', fn: async function (f) {
        var man = Object.assign({}, CFG.precos_destino || {});
        Object.keys(edits).forEach(function (k) { man[k] = { destino: t[k] ? t[k].destino : k, valor: edits[k] }; });
        await cfgSalvar('precos_destino', man); aviso('Tabela de preços salva.'); f();
      } }
    ]);
    desenhar();
    $('frxPrecoBusca').oninput = desenhar;
    j.corpo.addEventListener('input', function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-k'); if (k != null) edits[k] = num(e.target.value); });
    j.corpo.addEventListener('click', async function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-r'); if (k == null) return;
      var man = Object.assign({}, CFG.precos_destino || {}); delete man[k];
      await cfgSalvar('precos_destino', man); t = tabelaPrecos(); delete edits[k]; desenhar();
    });
    $('frxNovoAdd').onclick = function () {
      var d = ($('frxNovoDest').value || '').trim(), v = num($('frxNovoVal').value); if (!d || !v) { aviso('Informe destino e valor.', 'warning'); return; }
      var k = norm(d); if (!t[k]) { t[k] = { destino: d, valor: v, usos: 0, manual: true }; chaves.unshift(k); }
      edits[k] = v; $('frxNovoDest').value = ''; $('frxNovoVal').value = ''; desenhar();
    };
  };

  // preenche o valor sozinho ao digitar o destino (só se o valor estiver vazio/zerado)
  var CAMPOS_PRECO = [['txtDestino', 'txtValorRota'], ['seqDestino', 'seqValor'], ['editTxtDestino', 'editTxtValorRota']];
  function aplicarPreco(idDest, idVal) {
    var d = $(idDest), v = $(idVal); if (!d || !v) return;
    if (num(v.value) > 0) return;
    var p = precoDe(d.value); if (!p) return;
    v.value = moeda(p);
    try { v.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    var h = v.parentNode.querySelector('.frx-precohint');
    if (!h) { h = document.createElement('div'); h.className = 'frx-precohint'; (v.closest('div') || v.parentNode).appendChild(h); }
    h.textContent = '✓ Preço da tabela para ' + d.value.trim();
    setTimeout(function () { if (h) h.remove(); }, 6000);
  }
  document.addEventListener('change', function (e) { CAMPOS_PRECO.forEach(function (c) { if (e.target && e.target.id === c[0]) aplicarPreco(c[0], c[1]); }); }, true);
  document.addEventListener('focusout', function (e) { CAMPOS_PRECO.forEach(function (c) { if (e.target && e.target.id === c[0]) setTimeout(function () { aplicarPreco(c[0], c[1]); }, 120); }); }, true);

  /* =====================================================================
     8) FICHA DO CLIENTE   |   10) COBRANÇA DE PENDENTES
     ===================================================================== */
  function rotasDoCliente(nome) { var n = norm(nome); return rotas().filter(function (r) { return norm(r.cliente) === n; }); }
  function textoCobranca(nome, pend) {
    var pix = CFG.pix || {};
    var linhas = pend.slice().sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); }).slice(0, 20).map(function (r) {
      return '• ' + dataBR(r.data) + ' — ' + (r.destino || r.origem || 'serviço') + ': ' + moeda(r.valor);
    });
    var total = pend.reduce(function (s, r) { return s + (Number(r.valor) || 0); }, 0);
    return 'Olá ' + nome + '! Tudo bem? 😊\n\nSegue o resumo dos serviços da FAST em aberto:\n' + linhas.join('\n') +
      (pend.length > 20 ? '\n… e mais ' + (pend.length - 20) + ' serviço(s)' : '') +
      '\n\n*Total: ' + moeda(total) + '*' +
      (pix.chave ? '\n\nPIX: ' + pix.chave + (pix.nome ? ' (' + pix.nome + ')' : '') : '') +
      '\n\nQualquer dúvida, é só chamar. Obrigado!';
  }
  W.fastFichaCliente = function (nome) {
    var rs = rotasDoCliente(nome).sort(function (a, b) { return String(b.data || '').localeCompare(String(a.data || '')); });
    var tot = 0, rec = 0, pen = 0, dests = {};
    rs.forEach(function (r) { var v = Number(r.valor) || 0; tot += v; if (pago(r)) rec += v; else pen += v; var d = String(r.destino || '').trim(); if (d) dests[d] = (dests[d] || 0) + 1; });
    var top = Object.keys(dests).sort(function (a, b) { return dests[b] - dests[a]; }).slice(0, 3);
    var c = acharCliente(nome) || {};
    var pend = rs.filter(function (r) { return !pago(r); });
    var html = '<div class="frx-muted" style="margin-bottom:10px">' + esc([c.whatsapp || c.telefone, c.email].filter(Boolean).join(' • ') || 'Sem contato cadastrado') + '</div>' +
      '<div class="frx-kpis">' +
      '<div class="frx-kpi"><small>Rotas</small><b>' + rs.length + '</b></div>' +
      '<div class="frx-kpi"><small>Faturado</small><b>' + moeda(tot) + '</b></div>' +
      '<div class="frx-kpi"><small>Recebido</small><b>' + moeda(rec) + '</b></div>' +
      '<div class="frx-kpi"><small>A receber</small><b style="color:#dc2626">' + moeda(pen) + '</b></div>' +
      '<div class="frx-kpi"><small>Ticket médio</small><b>' + moeda(rs.length ? tot / rs.length : 0) + '</b></div>' +
      '<div class="frx-kpi"><small>Cliente desde</small><b>' + (rs.length ? dataBR(rs[rs.length - 1].data) : '—') + '</b></div>' +
      '</div>' +
      (top.length ? '<p class="frx-muted">Destinos mais usados: <b>' + top.map(esc).join(', ') + '</b></p>' : '') +
      '<div class="frx-wrap"><table class="frx-tb"><thead><tr><th>Data</th><th>Destino</th><th>Pagamento</th><th>Valor</th></tr></thead><tbody>' +
      rs.slice(0, 60).map(function (r) { return '<tr><td>' + dataBR(r.data) + '</td><td>' + esc(r.destino || '—') + '</td><td>' + (pago(r) ? '✅ Recebido' : '<span class="frx-pill">Pendente</span>') + '</td><td>' + moeda(r.valor) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' + (rs.length > 60 ? '<p class="frx-muted">Mostrando as 60 mais recentes de ' + rs.length + '.</p>' : '');
    var bts = [{ txt: 'Fechar', cls: 'sec', fn: function (f) { f(); } },
      { txt: '📲 Enviar acompanhamento', cls: 'sec', fn: function () { abrirWhats(telefoneDe(nome), 'Olá ' + nome + '! Acompanhe suas entregas e o histórico com a FAST pelo app: ' + LINK_CLIENTE); } }];
    if (pend.length) bts.push({ txt: '💬 Cobrar ' + moeda(pen), cls: 'wa', fn: function () { abrirWhats(telefoneDe(nome), textoCobranca(nome, pend)); } });
    janela('👤 ' + nome, html, bts);
  };

  W.fastCobranca = function () {
    var porCli = {};
    rotas().forEach(function (r) { if (pago(r)) return; var k = norm(r.cliente); if (!k) return; var e = porCli[k] || (porCli[k] = { nome: r.cliente, total: 0, rotas: [], antiga: '9999' }); e.total += Number(r.valor) || 0; e.rotas.push(r); if (String(r.data || '') < e.antiga) e.antiga = String(r.data || ''); });
    var lista = Object.keys(porCli).map(function (k) { return porCli[k]; }).filter(function (e) { return e.total > 0; }).sort(function (a, b) { return b.total - a.total; });
    var total = lista.reduce(function (s, e) { return s + e.total; }, 0);
    var pix = CFG.pix || {};
    var html = '<div class="frx-kpis"><div class="frx-kpi"><small>A receber</small><b style="color:#dc2626">' + moeda(total) + '</b></div><div class="frx-kpi"><small>Clientes devendo</small><b>' + lista.length + '</b></div></div>' +
      '<div class="frx-row"><label style="width:100%">Chave PIX que vai na mensagem</label><input class="frx-in" id="frxPixChave" placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória" value="' + esc(pix.chave || '') + '" style="flex:2;min-width:180px"><input class="frx-in" id="frxPixNome" placeholder="Nome do recebedor" value="' + esc(pix.nome || '') + '" style="flex:1;min-width:120px"><button type="button" class="frx-btn pq" id="frxPixSalvar">Salvar PIX</button></div>' +
      '<div class="frx-wrap"><table class="frx-tb"><thead><tr><th>Cliente</th><th>Rotas</th><th>Desde</th><th>Total</th><th></th></tr></thead><tbody>' +
      (lista.map(function (e, i) {
        return '<tr><td><b>' + esc(e.nome) + '</b>' + (telefoneDe(e.nome) ? '' : '<div class="frx-muted">sem WhatsApp</div>') + '</td><td>' + e.rotas.length + '</td><td>' + dataBR(e.antiga) + '</td><td><b>' + moeda(e.total) + '</b></td>' +
          '<td style="white-space:nowrap"><button type="button" class="frx-btn wa pq" data-cob="' + i + '">💬 Cobrar</button> <button type="button" class="frx-btn sec pq" data-fic="' + i + '">Ficha</button></td></tr>';
      }).join('') || '<tr><td colspan="5" class="frx-muted">Nenhum valor pendente. 🎉</td></tr>') +
      '</tbody></table></div>';
    var j = janela('💰 Cobrança de pendentes', html, [{ txt: 'Fechar', cls: 'sec', fn: function (f) { f(); } }]);
    j.corpo.addEventListener('click', function (e) {
      var a = e.target.getAttribute('data-cob'), b = e.target.getAttribute('data-fic');
      if (a != null) { var x = lista[+a]; abrirWhats(telefoneDe(x.nome), textoCobranca(x.nome, x.rotas)); }
      if (b != null) W.fastFichaCliente(lista[+b].nome);
    });
    $('frxPixSalvar').onclick = async function () { await cfgSalvar('pix', { chave: $('frxPixChave').value.trim(), nome: $('frxPixNome').value.trim() }); aviso('Chave PIX salva.'); };
  };

  // botão "Histórico" em cada cliente da aba Clientes
  function botoesClientes() {
    var tb = $('tabelaClientesBody'); if (!tb) return;
    tb.querySelectorAll('input.cli-sel-linha[data-cli-nome]').forEach(function (cb) {
      var tr = cb.closest('tr'); if (!tr || tr.querySelector('.frx-cli')) return;
      var td = tr.children[1] || tr.children[0];
      var b = document.createElement('button'); b.type = 'button'; b.className = 'frx-btn sec pq frx-cli'; b.style.marginTop = '6px';
      b.textContent = '📊 Histórico'; b.onclick = function (ev) { ev.stopPropagation(); W.fastFichaCliente(cb.getAttribute('data-cli-nome')); };
      td.appendChild(b);
    });
  }

  /* =====================================================================
     6) AVISAR CLIENTE (acompanhamento) — botão em cada card das Rotas do Dia
     ===================================================================== */
  function itemSeq(id) {
    var seq = bd().sequencias || {}, f = null;
    Object.keys(seq).some(function (d) { return (seq[d] || []).some(function (x) { if (x && String(x.id) === String(id)) { f = x; return true; } return false; }); });
    return f;
  }
  function botoesAvisar() {
    document.querySelectorAll('.seq-item[data-item-id]').forEach(function (card) {
      if (card.querySelector('.frx-av')) return;
      var ref = card.querySelector('.btn-whatsapp'); if (!ref) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn-secondary frx-av'; b.style.cssText = 'padding:8px 12px;font-size:13px';
      b.innerHTML = '📲 Avisar cliente';
      b.onclick = function (ev) {
        ev.stopPropagation();
        var it = itemSeq(card.getAttribute('data-item-id')); if (!it) return;
        var concl = /CONCLU/i.test(String(it.status || ''));
        var txt = concl
          ? 'Olá ' + (it.cliente || '') + '! ✅ Sua entrega para ' + (it.destino || 'o destino') + ' foi concluída pela FAST.' + (it.dataConclusao ? ' (' + new Date(it.dataConclusao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ')' : '') + '\nVeja o histórico e as entregas no app: ' + LINK_CLIENTE
          : 'Olá ' + (it.cliente || '') + '! 🚚 Sua entrega para ' + (it.destino || 'o destino') + ' está a caminho com a FAST' + (it.motorista ? ' (motorista ' + it.motorista + ')' : '') + '.\nAcompanhe em tempo real pelo app: ' + LINK_CLIENTE;
        abrirWhats(telefoneDe(it.cliente), txt);
      };
      ref.parentNode.appendChild(b);
    });
  }

  /* =====================================================================
     15) GALERIA DE FOTOS POR ROTA (clique na coluna Imagem / Fotos)
     ===================================================================== */
  async function urlFoto(ref) {
    try { if (typeof resolverFotoParaURL === 'function') return await resolverFotoParaURL(ref); } catch (e) {}
    return /^(data:|https?:|blob:)/.test(ref) ? ref : null;
  }
  async function linkPastaDrive(rota) {
    try {
      if (typeof abrirDBFotos !== 'function') return '';
      var db = await abrirDBFotos();
      var led = await new Promise(function (res) { try { var q = db.transaction('driveLedger', 'readonly').objectStore('driveLedger').getAll(); q.onsuccess = function () { res(q.result || []); }; q.onerror = function () { res([]); }; } catch (e) { res([]); } });
      var ids = {}; ids[String(rota.id)] = 1;
      var seq = bd().sequencias || {}; Object.keys(seq).forEach(function (d) { (seq[d] || []).forEach(function (it) { if (it && String(it.rotaId) === String(rota.id)) ids[String(it.id)] = 1; }); });
      var e = led.filter(function (x) { return ids[String(x.itemId || '')] && (x.driveFolderLink || x.driveFolderId); })[0];
      return e ? (e.driveFolderLink || 'https://drive.google.com/drive/folders/' + encodeURIComponent(e.driveFolderId)) : '';
    } catch (e) { return ''; }
  }
  W.fastGaleriaRota = async function (id) {
    var r = (bd().rotas || []).filter(function (x) { return String(x.id) === String(id); })[0]; if (!r) return;
    try { if (W.fastReconciliarFotos) W.fastReconciliarFotos(); } catch (e) {}
    var fotos = (Array.isArray(r.fotos) ? r.fotos : (r.foto ? [r.foto] : [])).filter(Boolean);
    var div = document.createElement('div');
    div.innerHTML = '<p class="frx-muted" style="margin:0 0 10px">' + esc(r.cliente || '') + ' · ' + esc(r.destino || '') + ' · ' + dataBR(r.data) + '</p>' +
      (fotos.length ? '<div class="frx-fotos">' + fotos.map(function (f, i) { return '<figure data-i="' + i + '"><span class="frx-muted">carregando…</span></figure>'; }).join('') + '</div>' : '<p>Nenhuma foto nesta rota ainda.</p>');
    var urls = [];
    var pasta = await linkPastaDrive(r);
    var bts = [{ txt: 'Fechar', cls: 'sec', fn: function (f) { f(); } }];
    if (pasta) bts.push({ txt: '📁 Abrir pasta no Drive', cls: 'sec', fn: function () { W.open(pasta, '_blank'); } });
    if (fotos.length) bts.push({ txt: '⬇️ Baixar todas', cls: 'ok', fn: function () {
      urls.forEach(function (u, i) { if (!u) return; setTimeout(function () { var a = document.createElement('a'); a.href = u; a.download = (r.cliente || 'rota') + ' - ' + dataBR(r.data).replace(/\//g, '-') + ' - Foto ' + (i + 1) + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); }, i * 400); });
    } });
    var j = janela('🖼️ Fotos da rota (' + fotos.length + ')', div, bts);
    fotos.forEach(function (f, i) {
      urlFoto(f).then(function (u) {
        urls[i] = u;
        var fig = j.corpo.querySelector('figure[data-i="' + i + '"]'); if (!fig) return;
        fig.innerHTML = u ? '<img alt="Foto ' + (i + 1) + '" src="' + esc(u) + '">' : '<span class="frx-muted" style="padding:6px;text-align:center">Ainda subindo para o Drive</span>';
      });
    });
    j.corpo.addEventListener('click', function (e) {
      var fig = e.target.closest && e.target.closest('figure'); if (!fig) return;
      var u = urls[+fig.getAttribute('data-i')]; if (!u) return;
      janela('Foto ' + (+fig.getAttribute('data-i') + 1), '<img src="' + esc(u) + '" style="width:100%;border-radius:12px">', [{ txt: 'Fechar', cls: 'sec', fn: function (f) { f(); } }]);
    });
  };
  document.addEventListener('click', function (e) {
    var cel = e.target.closest && e.target.closest('#tabelaRotasBody td.f63-img, #fastRelatorioRotasBody tr td:nth-child(9)');
    if (!cel) return;
    var tr = cel.closest('tr'); if (!tr) return;
    var id = tr.getAttribute('data-rota-id');
    if (!id) { var b = tr.querySelector('[onclick*="abrirModalEditarRota("]'); var m = b && String(b.getAttribute('onclick')).match(/abrirModalEditarRota\('([^']+)'/); id = m && m[1]; }
    if (id) { e.preventDefault(); e.stopPropagation(); W.fastGaleriaRota(id); }
  }, true);

  /* =====================================================================
     11) FECHAMENTO DO PERÍODO + PDF
     ===================================================================== */
  function segunda(d) { var x = new Date(d); var w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return x; }
  function dadosPeriodo(de, ate) {
    var rs = rotas().filter(function (r) { var d = String(r.data || '').slice(0, 10); return d >= de && d <= ate; });
    var ds = (bd().despesas || []).filter(function (d) { var x = String(d.data || '').slice(0, 10); return x >= de && x <= ate; });
    var de2 = (bd().despesasEmpresa || []).filter(function (d) { var x = String(d.data || d.vencimento || '').slice(0, 10); return x >= de && x <= ate; });
    var fat = 0, rec = 0, porCli = {}, porDia = {};
    rs.forEach(function (r) { var v = Number(r.valor) || 0; fat += v; if (pago(r)) rec += v; var c = r.cliente || '—'; (porCli[c] = porCli[c] || { n: 0, v: 0 }); porCli[c].n++; porCli[c].v += v; var d = String(r.data).slice(0, 10); (porDia[d] = porDia[d] || { n: 0, v: 0 }); porDia[d].n++; porDia[d].v += v; });
    var desp = ds.reduce(function (s, d) { return s + (Number(d.valor) || 0); }, 0) + de2.reduce(function (s, d) { return s + (Number(d.valor) || 0); }, 0);
    return { rs: rs, fat: fat, rec: rec, pen: fat - rec, desp: desp, lucro: fat - desp, porCli: porCli, porDia: porDia, nDesp: ds.length + de2.length };
  }
  function htmlFechamento(de, ate, x) {
    var cl = Object.keys(x.porCli).sort(function (a, b) { return x.porCli[b].v - x.porCli[a].v; });
    var di = Object.keys(x.porDia).sort();
    return '<div class="frx-kpis">' +
      '<div class="frx-kpi"><small>Serviços</small><b>' + x.rs.length + '</b></div>' +
      '<div class="frx-kpi"><small>Faturado</small><b>' + moeda(x.fat) + '</b></div>' +
      '<div class="frx-kpi"><small>Recebido</small><b>' + moeda(x.rec) + '</b></div>' +
      '<div class="frx-kpi"><small>A receber</small><b>' + moeda(x.pen) + '</b></div>' +
      '<div class="frx-kpi"><small>Despesas</small><b>' + moeda(x.desp) + '</b></div>' +
      '<div class="frx-kpi"><small>Resultado</small><b style="color:' + (x.lucro >= 0 ? '#16a34a' : '#dc2626') + '">' + moeda(x.lucro) + '</b></div></div>' +
      '<h4 style="margin:12px 0 6px">Por cliente</h4><div class="frx-wrap"><table class="frx-tb"><thead><tr><th>Cliente</th><th>Serviços</th><th>Valor</th></tr></thead><tbody>' +
      cl.map(function (c) { return '<tr><td>' + esc(c) + '</td><td>' + x.porCli[c].n + '</td><td>' + moeda(x.porCli[c].v) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<h4 style="margin:12px 0 6px">Por dia</h4><div class="frx-wrap"><table class="frx-tb"><thead><tr><th>Dia</th><th>Serviços</th><th>Valor</th></tr></thead><tbody>' +
      di.map(function (d) { return '<tr><td>' + dataBR(d) + '</td><td>' + x.porDia[d].n + '</td><td>' + moeda(x.porDia[d].v) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function imprimir(titulo, html) {
    var doc = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(titulo) + '</title><style>body{font-family:Arial,sans-serif;color:#111;margin:24px}h1{font-size:20px}h4{margin:16px 0 6px}.frx-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.frx-kpi{border:1px solid #ccc;border-radius:8px;padding:8px}.frx-kpi small{display:block;font-size:10px;text-transform:uppercase;color:#555}.frx-kpi b{font-size:15px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}th{font-size:10px;text-transform:uppercase;color:#555}</style></head><body><h1>FAST SERVIÇOS — ' + esc(titulo) + '</h1>' + html + '<p style="font-size:10px;color:#777;margin-top:20px">Gerado em ' + new Date().toLocaleString('pt-BR') + '</p></body></html>';
    var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(doc); f.contentDocument.close();
    setTimeout(function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { aviso('Este app não permite imprimir. Abra pelo navegador para gerar o PDF.', 'warning'); } setTimeout(function () { f.remove(); }, 60000); }, 400);
  }
  W.fastFechamentoPeriodo = function () {
    var hoje = new Date(), de = hojeISO(segunda(hoje)), ate = hojeISO(hoje);
    var div = document.createElement('div');
    div.innerHTML = '<div class="frx-row"><button type="button" class="frx-btn sec pq" data-p="hoje">Hoje</button><button type="button" class="frx-btn sec pq" data-p="semana">Esta semana</button><button type="button" class="frx-btn sec pq" data-p="semanaant">Semana passada</button><button type="button" class="frx-btn sec pq" data-p="mes">Este mês</button></div>' +
      '<div class="frx-row"><label>De</label><input type="date" class="frx-in" id="frxDe" style="flex:1;min-width:130px"><label>até</label><input type="date" class="frx-in" id="frxAte" style="flex:1;min-width:130px"></div><div id="frxFechBody"></div>';
    var j = janela('🧾 Fechamento do período', div, [
      { txt: 'Fechar', cls: 'sec', fn: function (f) { f(); } },
      { txt: '💬 Resumo no WhatsApp', cls: 'sec', fn: function () {
        var x = dadosPeriodo($('frxDe').value, $('frxAte').value);
        abrirWhats('', '*Fechamento FAST — ' + dataBR($('frxDe').value) + ' a ' + dataBR($('frxAte').value) + '*\nServiços: ' + x.rs.length + '\nFaturado: ' + moeda(x.fat) + '\nRecebido: ' + moeda(x.rec) + '\nA receber: ' + moeda(x.pen) + '\nDespesas: ' + moeda(x.desp) + '\n*Resultado: ' + moeda(x.lucro) + '*');
      } },
      { txt: '📄 Gerar PDF', cls: 'ok', fn: function () {
        var a = $('frxDe').value, b = $('frxAte').value;
        imprimir('Fechamento ' + dataBR(a) + ' a ' + dataBR(b), htmlFechamento(a, b, dadosPeriodo(a, b)));
      } }
    ]);
    function desenhar() { $('frxFechBody').innerHTML = htmlFechamento($('frxDe').value, $('frxAte').value, dadosPeriodo($('frxDe').value, $('frxAte').value)); }
    $('frxDe').value = de; $('frxAte').value = ate; desenhar();
    $('frxDe').onchange = desenhar; $('frxAte').onchange = desenhar;
    j.corpo.addEventListener('click', function (e) {
      var p = e.target.getAttribute && e.target.getAttribute('data-p'); if (!p) return;
      var h = new Date(), a, b = hojeISO(h);
      if (p === 'hoje') a = b;
      if (p === 'semana') a = hojeISO(segunda(h));
      if (p === 'semanaant') { var s = segunda(h); s.setDate(s.getDate() - 7); a = hojeISO(s); var f = new Date(s); f.setDate(f.getDate() + 6); b = hojeISO(f); }
      if (p === 'mes') a = b.slice(0, 8) + '01';
      $('frxDe').value = a; $('frxAte').value = b; desenhar();
    });
  };

  /* =====================================================================
     3) ALERTA DE ROTA ATRASADA (Rotas do Dia de hoje)
     ===================================================================== */
  var ALERTA_KEY = 'fast68_alertas_atraso';
  function checarAtrasos() {
    if (typeof W.fastEstadoPrazoRota !== 'function') return;
    var hoje = hojeISO(), lista = (bd().sequencias || {})[hoje] || [];
    var ja = {}; try { ja = JSON.parse(localStorage.getItem(ALERTA_KEY) || '{}'); } catch (e) {}
    if (ja.dia !== hoje) ja = { dia: hoje, ids: {} };
    var novos = [];
    lista.forEach(function (it) {
      if (!it || it.teste || ja.ids[it.id]) return;
      var rota = it.rotaId ? (bd().rotas || []).filter(function (r) { return String(r.id) === String(it.rotaId); })[0] : null;
      var st; try { st = W.fastEstadoPrazoRota(it, rota, hoje); } catch (e) { return; }
      if (st && st.classe === 'vermelho') { ja.ids[it.id] = 1; novos.push(it); }
    });
    try { localStorage.setItem(ALERTA_KEY, JSON.stringify(ja)); } catch (e) {}
    if (!novos.length) return;
    var txt = novos.length === 1 ? '⏰ Rota atrasada: ' + (novos[0].cliente || '') + ' → ' + (novos[0].destino || '') : '⏰ ' + novos.length + ' rotas do dia estão atrasadas';
    aviso(txt, 'warning');
    try { if (W.Notification && Notification.permission === 'granted') new Notification('FAST — rota atrasada', { body: txt.replace('⏰ ', '') }); } catch (e) {}
  }
  setInterval(checarAtrasos, 120000);
  W.addEventListener('load', function () { setTimeout(checarAtrasos, 15000); });

  /* =====================================================================
     20) BACKUP SEMANAL NO GOOGLE DRIVE (dados, sem as fotos)
     ===================================================================== */
  var PASTA_BKP = 'FAST - Backups semanais', bkpRodando = false;
  function driveTk() {
    try {
      var exp = Number(localStorage.getItem('fast_drive_access_token_expires_at') || 0);
      var t = sessionStorage.getItem('fast_drive_access_token') || localStorage.getItem('fast_drive_access_token') || '';
      return t && (!exp || Date.now() < exp) ? t : '';
    } catch (e) { return ''; }
  }
  async function gapi(url, opt, tk) { opt = opt || {}; opt.headers = Object.assign({ Authorization: 'Bearer ' + tk }, opt.headers || {}); var r = await fetch(url, opt); if (!r.ok) throw new Error('Drive ' + r.status); return r.json(); }
  async function backupSemanal(forcar) {
    if (bkpRodando) return;
    var tk = driveTk(); if (!tk || !navigator.onLine) { if (forcar) aviso('Google Drive não conectado neste aparelho.', 'warning'); return; }
    try { var ult = Number(localStorage.getItem('fast68_bkp_check') || 0); if (!forcar && Date.now() - ult < 6 * 3600000) return; } catch (e) {}
    bkpRodando = true;
    try {
      localStorage.setItem('fast68_bkp_check', String(Date.now()));
      var pai = localStorage.getItem('fast_drive_folder_id') || ((bd().integracoes || {}).googleDrive || {}).folderId || '';
      var q = "name='" + PASTA_BKP + "' and mimeType='application/vnd.google-apps.folder' and trashed=false" + (pai ? " and '" + pai + "' in parents" : '');
      var j = await gapi('https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id)&q=' + encodeURIComponent(q), {}, tk);
      var pasta = j.files && j.files[0] && j.files[0].id;
      if (!pasta) pasta = (await gapi('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pai ? { name: PASTA_BKP, mimeType: 'application/vnd.google-apps.folder', parents: [pai] } : { name: PASTA_BKP, mimeType: 'application/vnd.google-apps.folder' }) }, tk)).id;
      var lst = await gapi('https://www.googleapis.com/drive/v3/files?spaces=drive&orderBy=createdTime desc&fields=files(id,name,createdTime)&q=' + encodeURIComponent("'" + pasta + "' in parents and trashed=false"), {}, tk);
      var arqs = lst.files || [];
      if (!forcar && arqs[0] && Date.now() - Date.parse(arqs[0].createdTime) < 7 * 86400000) { localStorage.setItem('fast68_bkp_ultimo', arqs[0].createdTime); return; }
      var dados = JSON.stringify(bd(), function (k, v) { return (typeof v === 'string' && v.length > 2000 && /^data:/.test(v)) ? '[foto]' : v; });
      var nome = 'FAST-backup-' + hojeISO() + '.json', bdr = 'frxbkp' + Date.now();
      var corpo = '--' + bdr + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: nome, parents: [pasta] }) + '\r\n--' + bdr + '\r\nContent-Type: application/json\r\n\r\n' + dados + '\r\n--' + bdr + '--';
      await gapi('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + bdr }, body: corpo }, tk);
      localStorage.setItem('fast68_bkp_ultimo', new Date().toISOString());
      // mantém só os 8 mais recentes
      for (var i = 7; i < arqs.length; i++) { try { await fetch('https://www.googleapis.com/drive/v3/files/' + arqs[i].id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }); } catch (e) {} }
      if (forcar) aviso('Backup salvo no Google Drive (' + PASTA_BKP + ').');
    } catch (e) { if (forcar) aviso('Não foi possível salvar o backup agora: ' + e.message, 'error'); }
    finally { bkpRodando = false; }
  }
  W.fastBackupAgora = function () { return backupSemanal(true); };
  setInterval(function () { backupSemanal(false); }, 30 * 60000);
  W.addEventListener('load', function () { setTimeout(function () { backupSemanal(false); }, 60000); });

  /* =====================================================================
     18) BLOQUEIO POR PIN (alternativa à biometria)
     ===================================================================== */
  var PIN_KEY = 'fast68_pin_v1', saiuEm = 0, pinAberto = false;
  function pinCfg() { try { return JSON.parse(localStorage.getItem(PIN_KEY) || 'null'); } catch (e) { return null; } }
  async function hashPin(pin, sal) {
    var dados = new TextEncoder().encode(sal + ':' + pin);
    var h = await crypto.subtle.digest('SHA-256', dados);
    return Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function tecladoPin(titulo, sub, aoConfirmar, permitirSair) {
    if (pinAberto) return; pinAberto = true;
    var d = document.createElement('div'); d.id = 'frxPin';
    d.innerHTML = '<div class="c"><div style="font-size:42px">🔒</div><h2></h2><p></p><div class="dots"></div><div class="kp"></div><div class="err"></div>' + (permitirSair ? '<button class="lk" type="button" id="frxPinSair">Esqueci o PIN — entrar com e-mail e senha</button>' : '<button class="lk" type="button" id="frxPinCanc">Cancelar</button>') + '</div>';
    d.querySelector('h2').textContent = titulo; d.querySelector('p').textContent = sub;
    try { d.setAttribute('popover', 'manual'); d.style.cssText = 'margin:0;border:0;width:100vw;height:100vh;height:100dvh;max-width:none;max-height:none;'; } catch (e) {}
    d.style.setProperty('visibility', 'visible', 'important');
    document.body.appendChild(d); try { if (d.showPopover) d.showPopover(); } catch (e) {}
    var digitado = '', tam = 6;
    var dots = d.querySelector('.dots'), kp = d.querySelector('.kp'), err = d.querySelector('.err');
    function pintar() { dots.innerHTML = ''; for (var i = 0; i < Math.max(4, digitado.length); i++) { var x = document.createElement('i'); if (i < digitado.length) x.className = 'on'; dots.appendChild(x); } }
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'OK', '0', '⌫'].forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = k;
      b.onclick = async function () {
        err.textContent = '';
        if (k === '⌫') digitado = digitado.slice(0, -1);
        else if (k === 'OK') {
          if (digitado.length < 4) { err.textContent = 'Use de 4 a 6 números.'; return; }
          var r = await aoConfirmar(digitado);
          if (r === true) { fechar(); return; }
          err.textContent = r || 'PIN incorreto.'; digitado = '';
        } else if (digitado.length < tam) digitado += k;
        pintar();
      };
      kp.appendChild(b);
    });
    function fechar() { pinAberto = false; d.remove(); }
    var sair = d.querySelector('#frxPinSair');
    if (sair) sair.onclick = function () { try { localStorage.removeItem(PIN_KEY); localStorage.removeItem('fast_supa_session'); } catch (e) {} location.reload(); };
    var canc = d.querySelector('#frxPinCanc'); if (canc) canc.onclick = fechar;
    pintar();
  }
  function travarPin() {
    var c = pinCfg(); if (!c || !c.hash || pinAberto) return;
    var erros = 0;
    tecladoPin('FAST', 'Digite seu PIN para continuar', async function (pin) {
      if (await hashPin(pin, c.sal) === c.hash) return true;
      erros++; if (erros >= 5) { await new Promise(function (r) { setTimeout(r, 30000); }); erros = 0; return 'Muitas tentativas. Tente de novo.'; }
      return 'PIN incorreto.';
    }, true);
  }
  W.fastConfigurarPin = function () {
    var c = pinCfg();
    var html = '<p>' + (c ? '✅ O bloqueio por PIN está <b>ativado</b> neste aparelho.' : 'Com o PIN, o app pede uma senha numérica rápida ao abrir e ao voltar depois de alguns minutos — útil onde a biometria não funciona.') + '</p>' +
      '<div class="frx-row"><label style="width:100%">Pedir o PIN depois de ficar fora do app por</label><select class="frx-in" id="frxPinTempo"><option value="0">Imediatamente</option><option value="1">1 minuto</option><option value="2">2 minutos</option><option value="5">5 minutos</option><option value="15">15 minutos</option></select></div>';
    var bts = [{ txt: 'Fechar', cls: 'sec', fn: function (f) { f(); } }];
    if (c) bts.push({ txt: 'Desativar PIN', cls: 'sec', fn: function (f) { localStorage.removeItem(PIN_KEY); aviso('PIN desativado.'); f(); } });
    bts.push({ txt: c ? 'Trocar PIN' : 'Criar PIN', cls: 'ok', fn: function (f) {
      var tempo = Number($('frxPinTempo').value) || 0; f();
      var primeiro = null;
      tecladoPin('Novo PIN', 'Escolha de 4 a 6 números', async function (pin) {
        if (!primeiro) { primeiro = pin; setTimeout(function () { var p = document.querySelector('#frxPin p'); if (p) p.textContent = 'Digite o mesmo PIN de novo'; }, 0); return 'Confirme o PIN'; }
        if (pin !== primeiro) { primeiro = null; return 'Os PINs não conferem. Comece de novo.'; }
        var sal = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(PIN_KEY, JSON.stringify({ sal: sal, hash: await hashPin(pin, sal), minutos: tempo }));
        aviso('PIN ativado neste aparelho.'); return true;
      }, false);
    } });
    var j = janela('🔢 Bloqueio por PIN', html, bts);
    if (c) $('frxPinTempo').value = String(c.minutos || 0);
    $('frxPinTempo').onchange = function () { var x = pinCfg(); if (x) { x.minutos = Number(this.value) || 0; localStorage.setItem(PIN_KEY, JSON.stringify(x)); } };
  };
  document.addEventListener('visibilitychange', function () {
    var c = pinCfg(); if (!c) return;
    if (document.hidden) { saiuEm = Date.now(); return; }
    if (saiuEm && Date.now() - saiuEm >= (Number(c.minutos) || 0) * 60000) travarPin();
    saiuEm = 0;
  });
  function pinAoAbrir() { var c = pinCfg(); if (c && token()) travarPin(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(pinAoAbrir, 300); }, { once: true }); else setTimeout(pinAoAbrir, 300);

  /* =====================================================================
     24) BUSCA COMPLETA (rotas, rotas do dia, clientes, motoristas, despesas)
     ===================================================================== */
  W.fastBuscaCompleta = function () {
    var div = document.createElement('div');
    div.innerHTML = '<input class="frx-in" id="frxBusca" placeholder="Cliente, destino, motorista, despesa, data (dd/mm)…" autocomplete="off"><div id="frxBuscaRes" style="margin-top:10px"></div>';
    var j = janela('🔍 Buscar em tudo', div, [{ txt: 'Fechar', cls: 'sec', fn: function (f) { f(); } }]);
    var res = [];
    function buscar() {
      var q = norm($('frxBusca').value); res = [];
      if (q.length < 2) { $('frxBuscaRes').innerHTML = '<p class="frx-muted">Digite pelo menos 2 letras.</p>'; return; }
      function bate() { for (var i = 0; i < arguments.length; i++) if (norm(arguments[i]).indexOf(q) >= 0) return true; return false; }
      rotas().slice().sort(function (a, b) { return String(b.data || '').localeCompare(String(a.data || '')); }).forEach(function (r) {
        if (bate(r.cliente, r.origem, r.destino, r.descricao, dataBR(r.data))) res.push({ t: 'Rota', i: '🚚', a: r.cliente, b: dataBR(r.data) + ' · ' + (r.origem || '') + ' → ' + (r.destino || '') + ' · ' + moeda(r.valor), go: function () { if (typeof abrirModalEditarRota === 'function') abrirModalEditarRota(String(r.id)); } });
      });
      var seq = bd().sequencias || {};
      Object.keys(seq).sort().reverse().forEach(function (d) { (seq[d] || []).forEach(function (it) {
        if (it && !it.rotaId && bate(it.cliente, it.destino, it.motorista, dataBR(d))) res.push({ t: 'Rota do dia', i: '📅', a: it.cliente, b: dataBR(d) + ' · ' + (it.destino || '') + (it.motorista ? ' · ' + it.motorista : ''), go: function () { try { trocarAba(null, 'rotasDia'); var dp = $('dpDataSequencia'); if (dp) { dp.value = d; dp.dispatchEvent(new Event('change', { bubbles: true })); } } catch (e) {} } });
      }); });
      (bd().clientes || []).forEach(function (c) { if (c && bate(c.nome, c.apelido, c.telefone, c.whatsapp, c.email, c.doc)) res.push({ t: 'Cliente', i: '👤', a: c.nome, b: [c.whatsapp || c.telefone, c.email].filter(Boolean).join(' · '), go: function () { W.fastFichaCliente(c.nome); } }); });
      (bd().motoristas || []).forEach(function (m) { if (m && bate(m.nome, m.cpf, m.telefone, m.placa)) res.push({ t: 'Motorista', i: '🪪', a: m.nome, b: [m.telefone, m.placa].filter(Boolean).join(' · '), go: function () { try { trocarAba(null, 'motoristas'); } catch (e) {} } }); });
      (bd().despesas || []).forEach(function (x) { if (x && bate(x.descricao, x.local, x.categoria, dataBR(x.data))) res.push({ t: 'Despesa', i: '🧾', a: x.descricao || x.categoria, b: dataBR(x.data) + ' · ' + moeda(x.valor), go: function () { try { trocarAba(null, 'despesas'); } catch (e) {} } }); });
      (bd().destinos || []).forEach(function (x) { if (x && bate(x.nome, x.bairro, x.endereco)) res.push({ t: 'Lugar', i: '📍', a: x.nome, b: [x.bairro, x.endereco].filter(Boolean).join(' · '), go: function () { try { trocarAba(null, 'lugares'); } catch (e) {} } }); });
      var tot = res.length; res = res.slice(0, 80);
      $('frxBuscaRes').innerHTML = (res.map(function (x, i) { return '<div data-i="' + i + '" style="display:flex;gap:10px;padding:10px 4px;border-bottom:1px solid var(--border,#e2e8f0);cursor:pointer"><div style="font-size:20px">' + x.i + '</div><div style="min-width:0"><div style="font-weight:700">' + esc(x.a || '—') + ' <span class="frx-muted">· ' + x.t + '</span></div><div class="frx-muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.b || '') + '</div></div></div>'; }).join('') || '<p class="frx-muted">Nada encontrado.</p>') + (tot > 80 ? '<p class="frx-muted">Mostrando 80 de ' + tot + '. Refine a busca.</p>' : '');
    }
    $('frxBusca').oninput = buscar; buscar(); setTimeout(function () { $('frxBusca').focus(); }, 80);
    $('frxBuscaRes').addEventListener('click', function (e) { var el = e.target.closest('[data-i]'); if (!el) return; var x = res[+el.getAttribute('data-i')]; j.fechar(); if (x && x.go) x.go(); });
  };

  /* =====================================================================
     22) INDICADORES + painel de ferramentas no Centro de Operações
     ===================================================================== */
  function kpisHtml() {
    var h = hojeISO(), mes = h.slice(0, 7), ant = (function () { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return hojeISO(d).slice(0, 7); })();
    var fm = 0, fa = 0, rec = 0, hj = 0, cli = {};
    rotas().forEach(function (r) { var d = String(r.data || ''), v = Number(r.valor) || 0; if (d.slice(0, 7) === mes) { fm += v; cli[r.cliente] = (cli[r.cliente] || 0) + v; } if (d.slice(0, 7) === ant) fa += v; if (!pago(r)) rec += v; if (d.slice(0, 10) === h) hj++; });
    var top = Object.keys(cli).sort(function (a, b) { return cli[b] - cli[a]; }).slice(0, 3);
    var varc = fa ? Math.round((fm - fa) / fa * 100) : 0;
    return '<div class="frx-kpis" style="margin-bottom:10px">' +
      '<div class="frx-kpi"><small>Faturamento do mês</small><b>' + moeda(fm) + '</b>' + (fa ? '<div class="frx-muted">' + (varc >= 0 ? '▲ ' : '▼ ') + Math.abs(varc) + '% vs mês passado</div>' : '') + '</div>' +
      '<div class="frx-kpi"><small>A receber (total)</small><b style="color:#dc2626">' + moeda(rec) + '</b></div>' +
      '<div class="frx-kpi"><small>Rotas hoje</small><b>' + hj + '</b></div>' +
      '<div class="frx-kpi"><small>Top clientes do mês</small><b style="font-size:13px">' + (top.map(esc).join('<br>') || '—') + '</b></div></div>';
  }
  function painelFerramentas() {
    var aba = $('central'); if (!aba) return;
    var box = $('frxTools');
    if (!box) {
      box = document.createElement('div'); box.id = 'frxTools'; box.className = 'card';
      var alvo = aba.querySelector('.card') || aba.firstElementChild;
      if (alvo && alvo.nextSibling) aba.insertBefore(box, alvo.nextSibling); else aba.appendChild(box);
    }
    var ult = ''; try { ult = localStorage.getItem('fast68_bkp_ultimo') || ''; } catch (e) {}
    box.innerHTML = '<div style="font-weight:800;font-size:16px;margin-bottom:10px">⚙️ Ferramentas FAST</div>' + kpisHtml() +
      '<div class="frx-grid">' +
      '<button type="button" class="frx-tool" data-a="busca">🔍 Buscar em tudo<span>clientes, rotas, despesas…</span></button>' +
      '<button type="button" class="frx-tool" data-a="cob">💰 Cobrança<span>pendentes + WhatsApp + PIX</span></button>' +
      '<button type="button" class="frx-tool" data-a="fech">🧾 Fechamento<span>dia, semana, mês + PDF</span></button>' +
      '<button type="button" class="frx-tool" data-a="preco">💲 Tabela de preços<span>valor por destino</span></button>' +
      '<button type="button" class="frx-tool" data-a="pin">🔢 Bloqueio por PIN<span>' + (pinCfg() ? 'ativado' : 'desativado') + '</span></button>' +
      '<button type="button" class="frx-tool" data-a="sup">🎧 Central de Suporte<span>' + (SUP.abertos ? SUP.abertos + ' aguardando resposta' : 'clientes e motoristas') + '</span></button>' +
      '<button type="button" class="frx-tool" data-a="diag">🩺 Sincronização<span>login, tempo real, fotos</span></button>' +
      '<button type="button" class="frx-tool" data-a="conf">🔎 Conferir rotas<span>somas erradas, repetidas, teste</span></button>' +
      '<button type="button" class="frx-tool" data-a="bkp">☁️ Backup no Drive<span>' + (ult ? 'último: ' + new Date(ult).toLocaleDateString('pt-BR') : 'semanal, automático') + '</span></button>' +
      '</div>' + (cfgFalta ? '<p class="frx-muted" style="margin-top:8px">⚠️ Falta rodar o SQL da tabela fast_config para a tabela de preços e o PIX valerem em todos os aparelhos.</p>' : '');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#frxTools [data-a]'); if (!b) return;
    var a = b.getAttribute('data-a');
    if (a === 'busca') W.fastBuscaCompleta();
    if (a === 'conf') W.fastConferirRotas();
    if (a === 'sup') W.fastCentralSuporte();
    if (a === 'diag' && W.fastDiagnosticoSync) W.fastDiagnosticoSync();
    if (a === 'cob') W.fastCobranca();
    if (a === 'fech') W.fastFechamentoPeriodo();
    if (a === 'preco') W.fastTabelaPrecos();
    if (a === 'pin') W.fastConfigurarPin();
    if (a === 'bkp') W.fastBackupAgora().then(painelFerramentas);
  });

  /* ---------------- PADRÃO DE CAMPOS LADO A LADO (Adicionar rota e Filtros) ----------------
     Mesmo arranjo da janela Editar Rota:
       Cliente | Origem · Destino | Data · Tipo | Qtd · Valor(− +) · Pagamento | Status pag. · Status rota */
  (function () {
    var st = document.createElement('style');
    st.textContent = [
      '.f68g{display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr))!important;gap:10px!important;grid-template-areas:none!important}',
      '.f68g>*{grid-column:1/-1!important;grid-area:auto!important;min-width:0;margin:0!important}',
      '.f68g>.g6{grid-column:span 6!important}.f68g>.g4{grid-column:span 4!important}.f68g>.g2{grid-column:span 2!important}',
      '.f68g>.g6>label,.f68g>.g4>label,.f68g>.g2>label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}',
      '.f68g input,.f68g select{width:100%!important;min-width:0!important;box-sizing:border-box}',
      '.f68g .g2 input{text-align:center;padding-left:4px!important;padding-right:4px!important}',
      '.f68g .gv>div{gap:4px!important}.f68g .gv input{flex:1 1 auto;padding-left:8px!important;padding-right:4px!important}',
      '.f68g .gv .fast-step-btn{flex:0 0 34px;width:34px!important;min-width:34px!important;padding:0!important;display:grid;place-items:center}',
      '.f68g .g4 select,.f68g .g6 select{padding-left:8px!important;padding-right:20px!important}',
      '@media(max-width:380px){.f68g>div>label{font-size:11px!important}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
    function bloco(grid, id) { var e = document.getElementById(id); if (!e) return null; while (e && e.parentNode !== grid) e = e.parentNode; return e; }
    function rot(el, t) { var l = el && el.querySelector('label'); if (l && !l.querySelector('input')) l.textContent = t; }
    function ordenar(grid, lista) {
      var ref = lista[0];
      for (var i = 1; i < lista.length; i++) { if (!lista[i]) continue; grid.insertBefore(lista[i], ref.nextSibling); ref = lista[i]; }
    }
    // estilos em linha com prioridade máxima: o app tem regras próprias (ordem, áreas e
    // largura dos campos no celular) que venceriam uma folha de estilo comum
    function fixar(grid) {
      var assin = (grid.clientWidth >= 760 ? 'L' : 'S') + grid.children.length;
      if (grid.__frxAssin === assin) return;
      grid.__frxAssin = assin;
      var imp = function (el, k, v) { el.style.setProperty(k, v, 'important'); };
      imp(grid, 'display', 'grid'); imp(grid, 'grid-template-columns', 'repeat(12,minmax(0,1fr))'); imp(grid, 'grid-template-areas', 'none'); imp(grid, 'gap', '10px');
      var largo = (grid.clientWidth || 0) >= 760;     // PAINEL no computador: campos mais compactos
      Array.prototype.forEach.call(grid.children, function (el, i) {
        var n = largo ? el.getAttribute('data-gd') : el.getAttribute('data-gm');
        var span = n ? 'span ' + n : (el.classList.contains('g6') ? 'span 6' : el.classList.contains('g4') ? 'span 4' : el.classList.contains('g2') ? 'span 2' : '1 / -1');
        imp(el, 'grid-area', 'auto');          // primeiro: "grid-area" zera a coluna
        imp(el, 'grid-row', 'auto'); imp(el, 'grid-column', span); imp(el, 'order', String(i));
        imp(el, 'min-width', '0'); imp(el, 'width', 'auto'); imp(el, 'max-width', 'none');
      });
    }
    function formAdicionar() {
      var f = document.getElementById('formRota'); var g = f && f.querySelector('.grid-form');
      if (!g || g.classList.contains('f68g')) return;
      var b = {}; ['txtCliente', 'txtOrigem', 'txtDestino', 'containerDestinosExtrasRota', 'dpDataRota', 'cbTipoVolume', 'txtQtdMercadorias', 'txtValorRota', 'cbPagamento', 'cbStatusRota', 'cbStatusExecucao'].forEach(function (id) { b[id] = bloco(g, id); });
      if (!b.txtCliente || !b.txtOrigem || !b.txtDestino || !b.dpDataRota || !b.txtValorRota) return;
      ordenar(g, [b.txtCliente, b.txtOrigem, b.txtDestino, b.containerDestinosExtrasRota, b.dpDataRota, b.cbTipoVolume, b.txtQtdMercadorias, b.txtValorRota, b.cbPagamento, b.cbStatusRota, b.cbStatusExecucao]);
      [b.txtOrigem, b.txtDestino, b.dpDataRota, b.cbTipoVolume, b.cbStatusRota, b.cbStatusExecucao].forEach(function (e) { if (e) e.classList.add('g6'); });
      if (b.txtQtdMercadorias) b.txtQtdMercadorias.classList.add('g2');
      b.txtValorRota.classList.add('g6', 'gv');
      if (b.cbPagamento) b.cbPagamento.classList.add('g4');
      rot(b.txtQtdMercadorias, 'Qtd.'); rot(b.cbPagamento, 'Pagamento:'); rot(b.cbStatusRota, 'Status pag.:'); rot(b.cbStatusExecucao, 'Status rota:');
      // celular | computador
      var sp = { txtCliente: [12, 4], txtOrigem: [6, 4], txtDestino: [6, 4], dpDataRota: [6, 3], cbTipoVolume: [6, 3], txtQtdMercadorias: [2, 2], txtValorRota: [6, 4], cbPagamento: [4, 4], cbStatusRota: [6, 4], cbStatusExecucao: [6, 4] };
      Object.keys(sp).forEach(function (k) { if (b[k]) { b[k].setAttribute('data-gm', sp[k][0]); b[k].setAttribute('data-gd', sp[k][1]); } });
      g.classList.add('f68g'); fixar(g);
    }
    function filtros(grid, ids) {
      if (!grid || grid.classList.contains('f68g')) return;
      var b = {}; Object.keys(ids).forEach(function (k) { b[k] = bloco(grid, ids[k]); });
      if (!b.cli || !b.ori || !b.des || !b.ini || !b.fim) return;
      ordenar(grid, [b.cli, b.ori, b.des, b.ini, b.fim, b.tipo, b.pag, b.exec]);
      [b.ori, b.des, b.ini, b.fim].forEach(function (e) { e.classList.add('g6'); });
      [b.tipo, b.pag, b.exec].forEach(function (e) { if (e) e.classList.add('g4'); });
      rot(b.cli, 'Cliente:'); rot(b.ori, 'Origem:'); rot(b.des, 'Destino:'); rot(b.ini, 'Data inicial:'); rot(b.fim, 'Data final:');
      rot(b.tipo, 'Tipo:'); rot(b.pag, 'Pagamento:'); rot(b.exec, 'Status:');
      var sp = { cli: [12, 4], ori: [6, 4], des: [6, 4], ini: [6, 3], fim: [6, 3], tipo: [4, 2], pag: [4, 2], exec: [4, 2] };
      Object.keys(sp).forEach(function (k) { if (b[k]) { b[k].setAttribute('data-gm', sp[k][0]); b[k].setAttribute('data-gd', sp[k][1]); } });
      grid.classList.add('f68g'); fixar(grid);
    }
    function arrumar() {
      document.querySelectorAll('.f68g').forEach(function (g) { try { fixar(g); } catch (e) {} });
      // "Esta rota é TESTE" não quebra letra por letra
      ['chkRotaTeste', 'editChkRotaTeste'].forEach(function (id) { var c = document.getElementById(id), l = c && c.closest('label'); if (l) { l.style.setProperty('flex', '0 0 auto', 'important'); l.style.setProperty('white-space', 'nowrap', 'important'); } });
      try { formAdicionar(); } catch (e) {}
      try { var c = document.querySelector('.fast-filtros-rotas .grid-form'); filtros(c, { cli: 'filtroNome', ori: 'filtroRotaOrigem', des: 'filtroRotaDestino', ini: 'filtroDataInicio', fim: 'filtroDataFim', tipo: 'filtroTipoVolume', pag: 'filtroStatus', exec: 'filtroStatusRota' }); } catch (e) {}
      try { var r = document.querySelector('.fast-route-report-filters'); filtros(r, { cli: 'fastRelFiltroCliente', ori: 'fastRelFiltroOrigem', des: 'fastRelFiltroDestino', ini: 'fastRelFiltroInicio', fim: 'fastRelFiltroFim', tipo: 'fastRelFiltroTipo', pag: 'fastRelFiltroStatus', exec: 'fastRelFiltroExec' }); } catch (e) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrumar, { once: true }); else arrumar();
    W.addEventListener('load', function () { arrumar(); setTimeout(arrumar, 1500); });
    var tRz = 0; W.addEventListener('resize', function () { clearTimeout(tRz); tRz = setTimeout(arrumar, 200); });
    setInterval(arrumar, 3000);
  })();

  /* ---------------- CAMPOS DE NÚMERO: ao tocar, ficam vazios para digitar o novo ----------------
     Vale para quantidade, valor (R$), desconto, salário, km… em todo o sistema.
     Se sair sem digitar nada, volta o número que estava. Não vale para telefone,
     CEP, documentos e número de endereço (esses a gente costuma só corrigir). */
  var NAO_LIMPAR = /(telefone|whats|celular|fone|cep|cpf|cnpj|rg\b|motoristarg|cnh|rntrc|renavam|placa|numero$|ano$|pin|senha|cartao|agencia|conta|documento|codigo|search|busca|filtro)/i;
  function campoNumerico(el) {
    if (!el || el.tagName !== 'INPUT' || el.readOnly || el.disabled) return false;
    var id = String(el.id || '') + ' ' + String(el.name || '') + ' ' + String(el.className || '');
    if ([el.id, el.name].some(function (x) { return x && NAO_LIMPAR.test(String(x)); })) return false;
    if (/(telefone|whats|celular|cep|cpf|cnpj|placa|senha|pin)/i.test(String(el.className || '') + ' ' + (el.getAttribute('placeholder') || ''))) return false;
    if (el.type === 'number') return true;
    var foco = el.getAttribute('onfocus') || '', inp = el.getAttribute('oninput') || '';
    if (/fastMoeda/.test(foco + inp)) return true;
    if (/(^|[\s_-])(qtd|quant|valor|preco|desconto|multa|salario|km|litros?)/i.test(id) && /numeric|decimal/.test(el.getAttribute('inputmode') || '')) return true;
    return false;
  }
  function vazioOuZero(v) { var t = String(v || '').trim(); return !t; }
  document.addEventListener('focusin', function (e) {
    var el = e.target; if (!campoNumerico(el)) return;
    if (el.hasAttribute('data-num-anterior')) return;
    if (vazioOuZero(el.value)) return;
    el.setAttribute('data-num-anterior', el.value);
    el.value = '';
  }, true);
  // "blur" na captura roda ANTES das rotinas do próprio campo (ex.: formatar R$),
  // então o número antigo volta antes de qualquer formatação
  document.addEventListener('blur', function (e) {
    var el = e.target; if (!el || el.tagName !== 'INPUT' || !el.hasAttribute('data-num-anterior')) return;
    var ant = el.getAttribute('data-num-anterior'); el.removeAttribute('data-num-anterior');
    if (String(el.value).trim() === '') {
      el.value = ant;
      try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (er) {}
    }
  }, true);

  /* ---------------- EDITAR ROTA → reflete em TUDO (Rotas do Dia, relatório, lista) ----------------
     O FAST já levava a edição para a Rota do Dia ligada, exceto quando ela estava
     CONCLUÍDA. Agora qualquer campo editado (cliente, origem, destino, valor, qtd.,
     descrição) vai também para a Rota do Dia concluída — mantendo status, horário
     e fotos — e o relatório é redesenhado na hora. Nos outros aparelhos, a mudança
     chega pela sincronização e o relatório se atualiza sozinho. */
  function propagarEdicao(id) {
    var r = (bd().rotas || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (!r) return false;
    var seq = bd().sequencias || {}, mudou = false;
    Object.keys(seq).forEach(function (d) {
      (seq[d] || []).forEach(function (it) {
        if (!it || it.agrupado) return;
        var liga = (it.rotaId != null && String(it.rotaId) === String(id)) || (it.rotaId == null && String(it.id) === String(id));
        if (!liga) return;
        var novo = { cliente: r.cliente || '', origem: r.origem || '', destino: r.destino || '', valor: Number(r.valor) || 0, qtdMercadorias: Number(r.qtdMercadorias) || 1, obs: r.descricao || '' };
        Object.keys(novo).forEach(function (k) {
          if (String(it[k] == null ? '' : it[k]) !== String(novo[k])) { it[k] = novo[k]; mudou = true; }
        });
        if (mudou) { it.updatedAt = new Date().toISOString(); }
      });
    });
    return mudou;
  }
  function redesenharTudo() {
    try { if (typeof renderizarSequencia === 'function') renderizarSequencia(); } catch (e) {}
    try { if (typeof W.fastRelatorioRotasRender === 'function') W.fastRelatorioRotasRender(); } catch (e) {}
  }
  function instalarEdicaoTotal() {
    var f = W.salvarEdicaoRotaModal;
    if (typeof f !== 'function' || f.__frx) return;
    var g = function () {
      var id = ($('editRotaId') || {}).value;
      var r = f.apply(this, arguments);
      try {
        if (id && propagarEdicao(id)) { try { salvarStorage(); } catch (e) {} }
        setTimeout(redesenharTudo, 150);
      } catch (e) {}
      return r;
    };
    g.__frx = true; W.salvarEdicaoRotaModal = g;
    try { var form = $('formEditarRota') || ($('editRotaId') && $('editRotaId').form); if (form && form.getAttribute('onsubmit') && form.getAttribute('onsubmit').indexOf('salvarEdicaoRotaModal') >= 0) form.onsubmit = function (ev) { return W.salvarEdicaoRotaModal(ev); }; } catch (e) {}
  }
  W.addEventListener('load', function () { setTimeout(instalarEdicaoTotal, 1000); });
  setInterval(instalarEdicaoTotal, 5000);
  // dados que mudaram (aqui ou vindos de outro aparelho) → relatório redesenhado
  var refRotas = null, refSeq = null, tRel = 0;
  setInterval(function () {
    var b = bd();
    if (b.rotas === refRotas && b.sequencias === refSeq) return;
    var primeira = refRotas === null;
    refRotas = b.rotas; refSeq = b.sequencias;
    if (primeira) return;
    var corpo = $('fastRelatorioRotasBody');
    if (corpo && corpo.offsetParent) { clearTimeout(tRel); tRel = setTimeout(function () { try { W.fastRelatorioRotasRender(); } catch (e) {} }, 300); }
  }, 2000);
  // salvou algo neste aparelho (Rotas do Dia, edição, foto) → relatório atualizado
  (function () {
    var t = 0;
    function ligar() {
      var f = W.salvarStorage; if (typeof f !== 'function' || f.__frxRel) return;
      var g = function () { var r = f.apply(this, arguments); clearTimeout(t); t = setTimeout(function () { var c = $('fastRelatorioRotasBody'); if (c && c.offsetParent) { try { W.fastRelatorioRotasRender(); } catch (e) {} } }, 500); return r; };
      Object.keys(f).forEach(function (k) { try { g[k] = f[k]; } catch (e) {} });
      g.__frxRel = true; W.salvarStorage = g;
    }
    W.addEventListener('load', function () { setTimeout(ligar, 1500); });
    setInterval(ligar, 5000);
  })();

  /* ---------------- ENVIAR FOTOS (WhatsApp) ----------------
     1) No app Android 5.0.2+, o "compartilhar" do navegador não existe dentro do app:
        aqui ele passa a usar o compartilhamento do próprio Android (FASTCompartilhar),
        então todos os botões "Enviar Fotos" (uma rota, agrupada ou várias) funcionam.
     2) Nenhuma etapa de preparo pode travar o botão em "Preparando…": cada foto tem
        tempo-limite; se o carimbo do destino demorar, vai a foto sem carimbo. */
  function comLimite(prom, ms, valorSeEstourar) {
    return new Promise(function (res) {
      var feito = false;
      var t = setTimeout(function () { if (!feito) { feito = true; res(valorSeEstourar); } }, ms);
      Promise.resolve(prom).then(function (v) { if (!feito) { feito = true; clearTimeout(t); res(v); } }, function () { if (!feito) { feito = true; clearTimeout(t); res(valorSeEstourar); } });
    });
  }
  function instalarLimitesFotos() {
    var c = W.fastCarimbarDestino;
    if (typeof c === 'function' && !c.__frx) {
      var c2 = function (file) { return comLimite(c.apply(this, arguments), 10000, file); };
      c2.__frx = true; W.fastCarimbarDestino = c2;
    }
    var r = W.resolverFotoParaFile;
    if (typeof r === 'function' && !r.__frx) {
      var r2 = function () { return comLimite(r.apply(this, arguments), 25000, null); };
      r2.__frx = true; W.resolverFotoParaFile = r2;
    }
  }
  W.addEventListener('load', function () { instalarLimitesFotos(); setTimeout(instalarLimitesFotos, 2500); });
  setInterval(instalarLimitesFotos, 6000);

  (function () {
    var ponte = W.FASTCompartilhar;
    if (!ponte || typeof ponte.compartilhar !== 'function') return;
    try { if (typeof ponte.disponivel === 'function' && !ponte.disponivel()) return; } catch (e) {}
    var pend = {};
    W.fastCompartilharResultado = function (id, ok, msg) {
      var p = pend[id]; if (!p) return; delete pend[id];
      if (ok) p.res(); else { var e = new Error(msg || 'Não foi possível compartilhar'); p.rej(e); }
    };
    function paraBase64(file) {
      return new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onload = function () { res(String(fr.result || '').split(',')[1] || ''); };
        fr.onerror = function () { rej(fr.error || new Error('leitura')); };
        fr.readAsDataURL(file);
      });
    }
    function canShare(d) { return !!(d && ((d.files && d.files.length) || d.text || d.url)); }
    async function share(d) {
      d = d || {};
      var arqs = [];
      var lista = Array.prototype.slice.call(d.files || []);
      for (var i = 0; i < lista.length; i++) {
        var f = lista[i];
        arqs.push({ nome: f.name || ('foto_' + (i + 1) + '.jpg'), tipo: f.type || 'image/jpeg', base64: await paraBase64(f) });
      }
      var texto = [d.text || '', d.url || ''].filter(Boolean).join('\n');
      if (!arqs.length) { location.href = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(texto || d.title || ''); return; }
      var id = 'c' + Date.now() + Math.random().toString(36).slice(2, 7);
      return new Promise(function (res, rej) {
        pend[id] = { res: res, rej: rej };
        try { ponte.compartilhar(JSON.stringify({ texto: texto, arquivos: arqs }), id); }
        catch (e) { delete pend[id]; rej(e); return; }
        setTimeout(function () { if (pend[id]) { delete pend[id]; res(); } }, 30000);
      });
    }
    try { Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true }); } catch (e) { try { navigator.share = share; } catch (er) {} }
    try { Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true }); } catch (e) { try { navigator.canShare = canShare; } catch (er) {} }
    W.__fastShareNativo = true;
  })();

  /* =====================================================================
     AGRUPAR = só para ENVIAR AS FOTOS JUNTAS
     Não cria mais uma "rota" (sem Concluir, Navegar etc.): sobe um card de envio
     no topo das Rotas do Dia, com as fotos de todas as rotas escolhidas e a
     legenda com cada destino. As rotas continuam normais, cada uma no seu card.
     ===================================================================== */
  var ENV_KEY = 'envios_agrupados';
  function envios() { var e = CFG[ENV_KEY]; return (e && typeof e === 'object') ? e : {}; }
  function dataSeqAtual() { return ($('dpDataSequencia') || {}).value || hojeISO(); }
  function itemPorId(data, id) { return ((bd().sequencias || {})[data] || []).filter(function (x) { return x && String(x.id) === String(id); })[0] || null; }
  function fotosDoItem(it) {
    try {
      var r = it && it.rotaId != null ? (bd().rotas || []).filter(function (x) { return String(x.id) === String(it.rotaId); })[0] : null;
      if (typeof W.obterFotosDoItem === 'function') return (W.obterFotosDoItem(it, r) || []).filter(Boolean);
    } catch (e) {}
    return [].concat(it && it.fotos || []).filter(Boolean);
  }
  async function salvarEnvios(obj) {
    // limpa grupos com mais de 7 dias
    var lim = hojeISO(new Date(Date.now() - 7 * 86400000));
    Object.keys(obj).forEach(function (k) { if (!obj[k] || String(obj[k].data || '') < lim) delete obj[k]; });
    await cfgSalvar(ENV_KEY, obj);
    desenharEnvios(true);
  }
  function criarEnvioAgrupado() {
    var data = dataSeqAtual(), lista = (bd().sequencias || {})[data] || [];
    var idx = Array.prototype.slice.call(document.querySelectorAll('.seq-checkbox:checked')).map(function (cb) { return Number(cb.value); })
      .filter(function (i, p, a) { return Number.isInteger(i) && lista[i] && a.indexOf(i) === p; });
    if (idx.length < 2) { aviso('Selecione pelo menos 2 rotas para juntar as fotos.', 'warning'); return; }
    var ids = idx.map(function (i) { return String(lista[i].id); });
    var obj = Object.assign({}, envios());
    var id = 'env_' + Date.now().toString(36);
    obj[id] = { id: id, data: data, itens: ids, criadoEm: new Date().toISOString() };
    salvarEnvios(obj);
    try { if (typeof limparSelecaoSeq === 'function') limparSelecaoSeq(); else document.querySelectorAll('.seq-checkbox:checked').forEach(function (c) { c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); }); } catch (e) {}
    try { if (typeof fecharModalAgrupar === 'function') fecharModalAgrupar(); } catch (e) {}
    var nf = ids.reduce(function (s2, x) { return s2 + fotosDoItem(itemPorId(data, x)).length; }, 0);
    aviso('Fotos de ' + ids.length + ' rotas juntas (' + nf + ' fotos) no card de envio, no topo das Rotas do Dia.');
    setTimeout(function () { var el = $('frxEnvios'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300);
  }
  async function enviarGrupo(g, btn) {
    var html = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = 'Preparando…'; }
    try {
      var arquivos = [], pares = [], n = 0;
      for (var a = 0; a < g.itens.length; a++) {
        var it = itemPorId(g.data, g.itens[a]); if (!it) continue;
        var refs = fotosDoItem(it);
        for (var b2 = 0; b2 < refs.length; b2++) {
          var dest = (W.fastFotoDestino ? W.fastFotoDestino(it, refs[b2], '') : '') || it.destino || 'Destino';
          var f = W.resolverFotoParaFile ? await W.resolverFotoParaFile(refs[b2], 'foto_' + (n + 1) + '.jpg') : null;
          if (!f) continue;
          if (W.fastCarimbarDestino) f = await W.fastCarimbarDestino(f, dest);
          n++;
          var nome = String(dest).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) + ' ' + n + '.jpg';
          try { f = new File([f], nome, { type: f.type || 'image/jpeg' }); } catch (e) {}
          arquivos.push(f); pares.push({ destino: dest });
          if (btn) btn.innerHTML = 'Preparando ' + n + '…';
        }
      }
      if (!arquivos.length) { aviso('Essas rotas ainda não têm fotos.', 'warning'); return; }
      var legenda = W.fastLegendaLista ? W.fastLegendaLista(pares) : pares.map(function (p, i) { return 'Foto ' + (i + 1) + ': ' + p.destino; }).join('\n');
      var pode = false; try { pode = !!(navigator.share && navigator.canShare && navigator.canShare({ files: arquivos })); } catch (e) {}
      if (pode) {
        if (btn) btn.innerHTML = 'Enviando ' + arquivos.length + ' fotos…';
        try { await navigator.share({ files: arquivos, title: 'Fotos das entregas', text: legenda }); }
        catch (e) { if (!(e && e.name === 'AbortError')) throw e; return; }
        aviso('As ' + arquivos.length + ' fotos foram enviadas juntas, com a legenda de cada destino.');
      } else {
        arquivos.forEach(function (f2, i) { setTimeout(function () { var u = URL.createObjectURL(f2), l = document.createElement('a'); l.href = u; l.download = f2.name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 3000); }, i * 300); });
        abrirWhats('', legenda);
        aviso(arquivos.length + ' fotos baixadas com o nome do destino. Anexe no WhatsApp que abriu.');
      }
    } catch (e) { aviso('Não foi possível enviar as fotos: ' + ((e && e.message) || e), 'error'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = html; } }
  }
  var assinaturaEnvios = '';
  function desenharEnvios(forcar) {
    var cont = $('containerSequencia'); if (!cont) return;
    var data = dataSeqAtual();
    var grupos = Object.keys(envios()).map(function (k) { return envios()[k]; }).filter(function (g) { return g && g.data === data; })
      .sort(function (a, b) { return String(b.criadoEm).localeCompare(String(a.criadoEm)); });
    var caixa = $('frxEnvios');
    var sig = data + '|' + JSON.stringify(grupos) + '|' + grupos.map(function (g) { return g.itens.map(function (x) { var it = itemPorId(data, x); return it ? fotosDoItem(it).length + (it.destino || '') : '-'; }).join(','); }).join(';');
    if (!grupos.length) { if (caixa) caixa.remove(); assinaturaEnvios = ''; return; }
    if (caixa && caixa.parentNode === cont && cont.firstChild === caixa && sig === assinaturaEnvios && !forcar) return;
    assinaturaEnvios = sig;
    if (!caixa) { caixa = document.createElement('div'); caixa.id = 'frxEnvios'; }
    if (cont.firstChild !== caixa) cont.insertBefore(caixa, cont.firstChild);
    caixa.innerHTML = grupos.map(function (g) {
      var linhas = [], total = 0;
      g.itens.forEach(function (x) { var it = itemPorId(data, x); if (!it) return; var nf = fotosDoItem(it).length; total += nf; linhas.push('<li><b>' + esc(it.destino || '—') + '</b> <span class="frx-muted">· ' + esc(it.cliente || '') + ' · ' + nf + ' foto(s)</span></li>'); });
      return '<div class="frx-env" data-g="' + esc(g.id) + '"><div class="frx-env-hd">📦 Envio agrupado <span class="frx-muted">· ' + linhas.length + ' rotas · ' + total + ' fotos</span></div>' +
        '<ul class="frx-env-lista">' + (linhas.join('') || '<li class="frx-muted">As rotas deste grupo foram removidas.</li>') + '</ul>' +
        '<div class="frx-env-fotos" data-fotos="' + esc(g.id) + '"></div>' +
        '<div class="frx-env-bt"><button type="button" class="frx-btn wa" data-env="' + esc(g.id) + '">💬 Enviar todas as fotos</button><button type="button" class="frx-btn sec" data-desf="' + esc(g.id) + '">Desfazer</button></div></div>';
    }).join('');
    grupos.forEach(function (g) {
      var alvo = caixa.querySelector('[data-fotos="' + g.id + '"]'); if (!alvo) return;
      var refs = []; g.itens.forEach(function (x) { var it = itemPorId(data, x); if (it) fotosDoItem(it).forEach(function (r) { if (refs.indexOf(r) < 0) refs.push(r); }); });
      refs.slice(0, 12).forEach(function (r) {
        var im = document.createElement('img'); im.alt = ''; alvo.appendChild(im);
        urlFoto(r).then(function (u) { if (u) im.src = u; else im.remove(); });
      });
      if (refs.length > 12) { var mais = document.createElement('span'); mais.className = 'frx-muted'; mais.textContent = '+' + (refs.length - 12); alvo.appendChild(mais); }
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#frxEnvios [data-env], #frxEnvios [data-desf]'); if (!b) return;
    var gid = b.getAttribute('data-env') || b.getAttribute('data-desf'), g = envios()[gid]; if (!g) return;
    if (b.hasAttribute('data-env')) enviarGrupo(g, b);
    else { var obj = Object.assign({}, envios()); delete obj[gid]; salvarEnvios(obj); aviso('Envio agrupado desfeito. As rotas continuam normais.'); }
  });
  // "Enviar Fotos" com várias rotas selecionadas: tudo num ÚNICO envio (antes abria
  // o WhatsApp uma vez para cada foto)
  function enviarSelecionadasJuntas(btn) {
    var data = dataSeqAtual(), lista = (bd().sequencias || {})[data] || [];
    var idx = Array.prototype.slice.call(document.querySelectorAll('.seq-checkbox:checked')).map(function (cb) { return Number(cb.value); })
      .filter(function (i, p2, a2) { return Number.isInteger(i) && lista[i] && a2.indexOf(i) === p2; });
    if (!idx.length) { aviso('Selecione as rotas para enviar as fotos.', 'warning'); return; }
    return enviarGrupo({ data: data, itens: idx.map(function (i) { return String(lista[i].id); }) }, btn && btn.tagName ? btn : null);
  }
  function instalarAgrupar() {
    var es = W.enviarFotosSelecionadasWhatsApp;
    if (typeof es === 'function' && !es.__frx) {
      var es2 = function (btn) { return enviarSelecionadasJuntas(btn || (W.event && W.event.target && W.event.target.closest && W.event.target.closest('button'))); };
      es2.__frx = true; W.enviarFotosSelecionadasWhatsApp = es2;
    }
    if (W.confirmarAgrupamento && W.confirmarAgrupamento.__frx && W.abrirModalAgrupar && W.abrirModalAgrupar.__frx) return;
    var f1 = function () { criarEnvioAgrupado(); }; f1.__frx = true;
    W.confirmarAgrupamento = f1;
    var f2 = function () { criarEnvioAgrupado(); }; f2.__frx = true;
    W.abrirModalAgrupar = f2;
  }
  W.addEventListener('load', function () { setTimeout(instalarAgrupar, 1500); setTimeout(instalarAgrupar, 4000); });
  setInterval(instalarAgrupar, 6000);
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'dpDataSequencia') setTimeout(function () { desenharEnvios(true); }, 300); }, true);

  /* ---------------- PUXAR A ÚLTIMA ROTA DO CLIENTE: sempre uma rota INDIVIDUAL ----------------
     Ao escolher o cliente, o FAST preenche os campos com a última rota dele. Ele
     podia pegar um card AGRUPADO antigo — que guarda a SOMA das rotas (ex.: Qtd. 4,
     valor somado e "Centro, Japão, Austrália…") — e trazer esses totais para a rota
     nova. Agora só rotas individuais servem de modelo; a soma fica só nos totais
     do cliente (relatório, ficha, fechamento). */
  function nomeChave(v) { try { return destNormalizarNome(v); } catch (e) { return norm(v); } }
  function ehAgrupado(it) { return !!(it && (it.agrupado || Array.isArray(it.itensOriginais) || Array.isArray(it.rotasOriginais) || Array.isArray(it.itensAgrupados))); }
  function ultimaIndividual(nome) {
    var k = nomeChave(nome); if (!k) return null;
    var cands = [];
    (bd().rotas || []).forEach(function (r) { if (r && !r.teste && !ehAgrupado(r) && nomeChave(r.cliente) === k) cands.push({ o: r, data: String(r.data || ''), id: Number(r.id) || 0 }); });
    var seqs = bd().sequencias || {};
    Object.keys(seqs).forEach(function (d) { (seqs[d] || []).forEach(function (it) { if (it && !it.teste && !ehAgrupado(it) && nomeChave(it.cliente) === k) cands.push({ o: Object.assign({ data: d }, it), data: d, id: Number(String(it.id).replace(/\D/g, '').slice(0, 13)) || 0 }); }); });
    if (!cands.length) return null;
    cands.sort(function (a, b) { return a.data !== b.data ? b.data.localeCompare(a.data) : b.id - a.id; });
    var base = Object.assign({}, cands[0].o);
    ['origem', 'destino', 'qtdMercadorias', 'descricao', 'obs', 'motorista', 'pagamento'].forEach(function (f) {
      if (base[f] == null || base[f] === '') { for (var i = 1; i < cands.length; i++) { var v = cands[i].o[f]; if (v != null && v !== '') { base[f] = v; break; } } }
    });
    if (!(Number(base.valor) > 0)) { for (var j = 1; j < cands.length; j++) { if (Number(cands[j].o.valor) > 0) { base.valor = Number(cands[j].o.valor); break; } } }
    return base;
  }
  function instalarUltimaIndividual() {
    if (W.obterUltimaRotaCliente && W.obterUltimaRotaCliente.__frx && W.preencherPreviewRota && W.preencherPreviewRota.__frx) return;
    var o = function (nome) { return ultimaIndividual(nome); }; o.__frx = true;
    W.obterUltimaRotaCliente = o; W.fastUltimaRotaCompleta = o;
    var p = function (nomeCliente) {
      var idEd = String(($('seqItemId') || {}).value || '').trim();
      if (idEd) {
        var dd = ($('dpDataSequencia') || {}).value || '';
        var existe = ((bd().sequencias || {})[dd] || []).some(function (i) { return i && String(i.id) === idEd; });
        if (existe) { try { atualizarPreviewAba2(); } catch (e) {} return; }
        $('seqItemId').value = '';
      }
      var u = ultimaIndividual(nomeCliente);
      if (!u) { try { atualizarPreviewAba2(); } catch (e) {} return; }
      var set = function (id, v) { var el = $(id); if (el) el.value = v == null ? '' : v; };
      set('seqOrigem', u.origem || '');
      set('seqDestino', u.destino || '');
      var qtd = u.qtdMercadorias != null && u.qtdMercadorias !== '' ? u.qtdMercadorias : (u.qtdVolumes || 1);
      set('seqQtdDestino', qtd);
      var valor = Number(u.valor) || 0;
      try { fastSetMoeda('seqValorDestino', valor); } catch (e) {}
      try { fastSetMoeda('seqValor', valor); } catch (e) {}
      set('seqQtdVolumes', qtd);
      set('seqObs', u.descricao || u.obs || u.observacao || '');
      var mot = $('seqMotorista');
      if (mot && u.motorista) { var alvo = nomeChave(u.motorista), ok = false; Array.prototype.forEach.call(mot.options, function (op) { if (!ok && (nomeChave(op.value) === alvo || nomeChave(op.text) === alvo)) { mot.value = op.value; ok = true; } }); }
      try { atualizarPreviewAba2(); } catch (e) {}
    };
    p.__frx = true; W.preencherDadosClienteSeq = p;
    // Aba Rotas: a pré-visualização puxava o LOTE inteiro do último lançamento (ex.: as 4
    // rotas Centro, Japão, Austrália e Brasil, com o valor somado). Agora puxa só a última
    // rota, individual, com a quantidade e o valor dela.
    var pv = W.preencherPreviewRota;
    if (typeof pv === 'function' && !pv.__frx) {
      var pv2 = function (nome) {
        var k = nomeChave(nome), lista = (bd().rotas || []).filter(function (r) { return r && !r.teste && !ehAgrupado(r) && nomeChave(r.cliente) === k; });
        if (!lista.length) return pv.apply(this, arguments);
        lista.sort(function (a, b) { var d = String(b.data || '').localeCompare(String(a.data || '')); return d || (Number(b.id) || 0) - (Number(a.id) || 0); });
        var u = lista[0], orig = W.obterRotasDoCliente;
        W.obterRotasDoCliente = function () { return [u]; };
        try { return pv.apply(this, arguments); } finally { W.obterRotasDoCliente = orig; }
      };
      pv2.__frx = true; W.preencherPreviewRota = pv2;
    }
  }
  W.addEventListener('load', function () { setTimeout(instalarUltimaIndividual, 1200); setTimeout(instalarUltimaIndividual, 3500); });
  setInterval(instalarUltimaIndividual, 6000);

  /* =====================================================================
     CONFERIR ROTAS — procura o que pode estar somando errado no painel de
     Rotas e no Relatório: rotas de TESTE, rotas "juntadas" que repetem
     outras, rotas repetidas e Qtd. copiada para todas as rotas de um lote.
     ===================================================================== */
  function auditarRotas() {
    var rs = (bd().rotas || []).filter(Boolean), out = { teste: [], compostas: [], repetidas: [], qtdLote: [] };
    rs.forEach(function (r) { if (r.teste) out.teste.push(r); });
    var reais = rs.filter(function (r) { return !r.teste; });
    // rotas com vários destinos num campo só que repetem rotas individuais do mesmo dia
    reais.forEach(function (r) {
      var partes = String(r.destino || '').split(/\s*[,;|]\s*|\s+\+\s+/).map(function (x) { return norm(x); }).filter(Boolean);
      if (partes.length < 2) return;
      var irmas = reais.filter(function (o) { return o !== r && norm(o.cliente) === norm(r.cliente) && String(o.data) === String(r.data) && partes.indexOf(norm(o.destino)) >= 0; });
      if (irmas.length >= 2) out.compostas.push({ r: r, irmas: irmas });
    });
    // repetidas: mesmo cliente, data, origem, destino e valor
    var vistos = {};
    reais.slice().sort(function (a2, b2) { return (Number(a2.id) || 0) - (Number(b2.id) || 0); }).forEach(function (r) {
      var k = [norm(r.cliente), r.data, norm(r.origem), norm(r.destino), Number(r.valor) || 0].join('|');
      if (vistos[k]) out.repetidas.push({ r: r, original: vistos[k] }); else vistos[k] = r;
    });
    // lote (mesmo cliente, data e origem, criadas juntas) em que TODAS têm Qtd. = nº de rotas do lote
    var lotes = {};
    reais.forEach(function (r) { var k = [norm(r.cliente), r.data, norm(r.origem)].join('|'); (lotes[k] = lotes[k] || []).push(r); });
    Object.keys(lotes).forEach(function (k) {
      var l = lotes[k].slice().sort(function (a2, b2) { return (Number(a2.id) || 0) - (Number(b2.id) || 0); });
      var grupo = [l[0]];
      for (var i = 1; i <= l.length; i++) {
        var r = l[i];
        if (r && Math.abs((Number(r.id) || 0) - (Number(grupo[grupo.length - 1].id) || 0)) < 5000) { grupo.push(r); continue; }
        if (grupo.length >= 2 && grupo.every(function (x) { return Number(x.qtdMercadorias) === grupo.length; })) out.qtdLote.push(grupo.slice());
        if (r) grupo = [r];
      }
    });
    return out;
  }
  W.fastAuditarRotas = auditarRotas;
  W.fastConferirRotas = function () {
    var a = auditarRotas(), soma = function (l) { return l.reduce(function (t, r) { return t + (Number(r.valor) || 0); }, 0); };
    var linha = function (r, extra) {
      return '<div style="border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:10px 12px;margin:6px 0">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>' + esc(r.cliente || '—') + ' → ' + esc(r.destino || '—') + '</b><b>' + moeda(r.valor) + '</b></div>' +
        '<div class="frx-muted">' + dataBR(r.data) + (extra ? ' · ' + extra : '') + '</div>' +
        '<div style="display:flex;gap:6px;margin-top:8px"><button type="button" class="frx-btn sec pq" data-ver="' + esc(r.id) + '">Ver</button><button type="button" class="frx-btn pq" style="background:#dc2626" data-exc="' + esc(r.id) + '">Excluir</button></div></div>';
    };
    var tabela = function (corpo) { return corpo; };
    var html = '';
    var nada = !a.teste.length && !a.compostas.length && !a.repetidas.length && !a.qtdLote.length;
    if (nada) html = '<p style="font-size:16px">✅ Nada somando errado. Todas as ' + (bd().rotas || []).length + ' rotas são individuais, sem repetições, sem rotas de teste e sem Qtd. copiada.</p>';
    if (a.compostas.length) html += '<h4 style="margin:6px 0">🔁 Rotas que juntam outras (' + a.compostas.length + ') — somam ' + moeda(soma(a.compostas.map(function (x) { return x.r; }))) + ' a mais</h4><p class="frx-muted">Têm vários destinos num campo só e repetem rotas individuais do mesmo dia.</p>' +
      tabela(a.compostas.map(function (x) { return linha(x.r, 'repete: ' + x.irmas.map(function (o) { return esc(o.destino) + ' (' + moeda(o.valor) + ')'; }).join(', ')); }).join(''));
    if (a.repetidas.length) html += '<h4 style="margin:12px 0 6px">📄 Rotas repetidas (' + a.repetidas.length + ') — somam ' + moeda(soma(a.repetidas.map(function (x) { return x.r; }))) + ' a mais</h4><p class="frx-muted">Mesmo cliente, data, origem, destino e valor de outra rota. Confira antes de excluir: pode ser um serviço feito duas vezes.</p>' +
      tabela(a.repetidas.map(function (x) { return linha(x.r, 'igual à rota de ' + dataBR(x.original.data)); }).join(''));
    if (a.teste.length) html += '<h4 style="margin:12px 0 6px">🧪 Rotas de TESTE (' + a.teste.length + ') — somam ' + moeda(soma(a.teste)) + ' nos totais</h4><p class="frx-muted">Rotas marcadas como teste entram no relatório e no painel de Rotas até serem apagadas.</p>' + tabela(a.teste.map(function (r) { return linha(r); }).join('')) +
      '<div style="margin:6px 0 12px"><button type="button" class="frx-btn pq" style="background:#dc2626" data-limpateste="1">Apagar as ' + a.teste.length + ' rotas de teste</button></div>';
    if (a.qtdLote.length) html += '<h4 style="margin:12px 0 6px">🔢 Qtd. copiada para todas as rotas de um lançamento (' + a.qtdLote.length + ')</h4><p class="frx-muted">Ex.: 4 destinos lançados juntos e cada rota ficou com Qtd. 4 (o total), em vez da quantidade de cada uma.</p>' +
      a.qtdLote.map(function (g, gi) { return tabela(g.map(function (r) { return linha(r, 'Qtd. ' + r.qtdMercadorias); }).join('')) + '<div style="margin:6px 0 12px"><button type="button" class="frx-btn ok pq" data-qtd="' + gi + '">Deixar Qtd. 1 em cada uma destas ' + g.length + ' rotas</button></div>'; }).join('');
    var j = janela('🔎 Conferir rotas', html, [{ txt: 'Fechar', cls: 'sec', fn: function (f) { f(); } }]);
    j.corpo.addEventListener('click', function (e) {
      var v = e.target.getAttribute('data-ver'), x = e.target.getAttribute('data-exc'), q = e.target.getAttribute('data-qtd');
      if (v) { j.fechar(); try { abrirModalEditarRota(String(v)); } catch (er) {} }
      if (x) { j.fechar(); try { deletarRota(String(x)); } catch (er) {} }
      if (e.target.getAttribute('data-limpateste')) {
        try {
          var b2 = bd(), ids = {}; a.teste.forEach(function (r) { ids[String(r.id)] = 1; try { if (typeof W.fastLixeiraGuardar === 'function') W.fastLixeiraGuardar(r.data || '', null, r); } catch (er) {} });
          if (!Array.isArray(b2.rotasExcluidas)) b2.rotasExcluidas = [];
          Object.keys(ids).forEach(function (k) { if (b2.rotasExcluidas.indexOf(k) < 0) b2.rotasExcluidas.push(k); });
          b2.rotas = (b2.rotas || []).filter(function (r) { return !(r && ids[String(r.id)]); });
          var sq = b2.sequencias || {};
          Object.keys(sq).forEach(function (d) { sq[d] = (sq[d] || []).filter(function (it) { return !(it && it.rotaId != null && ids[String(it.rotaId)]); }); });
          salvarStorage(); try { renderizar(); } catch (er) {} try { renderizarSequencia(); } catch (er) {} try { W.fastRelatorioRotasRender(); } catch (er) {}
          aviso(a.teste.length + ' rota(s) de teste apagada(s). Ficam na lixeira, se precisar recuperar.');
        } catch (er) {}
        e.target.disabled = true; e.target.textContent = '✓ Apagadas';
      }
      if (q != null) {
        a.qtdLote[+q].forEach(function (r) { r.qtdMercadorias = 1; r.updatedAt = new Date().toISOString(); });
        try { salvarStorage(); } catch (er) {}
        try { renderizar(); } catch (er) {}
        e.target.disabled = true; e.target.textContent = '✓ Ajustado';
      }
    });
  };


  /* =====================================================================
     ROTAS DO DIA SEM "PISCAR" (botões no lugar)
     A lista era redesenhada a cada sincronização — mesmo sem nada mudar — e o
     botão "Avisar cliente" entrava um instante depois, empurrando os outros.
     Agora: (1) só redesenha quando algo mudou de verdade; (2) enquanto você edita
     uma rota (ou digita), o redesenho espera você terminar; (3) os botões extras
     entram no mesmo instante, sempre no fim, sem mexer nos outros; (4) a tela
     não pula de posição.
     ===================================================================== */
  var ultimaAcao = 0;
  ['pointerdown', 'keydown', 'change'].forEach(function (ev) { document.addEventListener(ev, function () { ultimaAcao = Date.now(); }, true); });
  function editandoAgora() {
    try {
      if (String(($('seqItemId') || {}).value || '').trim()) return true;
      var m = $('modalSequencia'); if (m && m.classList.contains('active')) return true;
      var er = $('modalEditarRota'); if (er && getComputedStyle(er).display !== 'none' && er.offsetParent !== null) return true;
      var a = document.activeElement;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest && a.closest('#rotasDia') && !a.closest('.rd-filter-driver,#fastFiltroSeqStatusWrap') && a.type !== 'checkbox' && a.type !== 'date') return true;
    } catch (e) {}
    return false;
  }
  function assinaturaLista() {
    try {
      var d = ($('dpDataSequencia') || {}).value || '';
      var filtros = Array.prototype.map.call(document.querySelectorAll('#rotasDia .rd-filter-driver select, #rotasDia #fastFiltroSeqStatus, #rotasDia input[type=search]'), function (x) { return x.value; }).join('|');
      var itens = ((bd().sequencias || {})[d] || []).map(function (it) {
        if (!it) return '';
        var o = Object.assign({}, it); delete o.updatedAt; delete o.ultimaModificacao;
        return JSON.stringify(o);
      }).join('\n');
      return d + '#' + filtros + '#' + hsh(itens) + '#' + itens.length;
    } catch (e) { return String(Math.random()); }
  }
  function hsh(t) { var h = 0; for (var i = 0; i < t.length; i++) { h = ((h << 5) - h + t.charCodeAt(i)) | 0; } return String(h); }
  var sigLista = '', esperandoRender = false;
  function instalarListaEstavel() {
    var f = W.renderizarSequencia;
    if (typeof f !== 'function' || f.__frxEst) return;
    var g = function () {
      var cont = $('containerSequencia');
      var porUsuario = Date.now() - ultimaAcao < 1200 || W.__frxForcarLista === true;
      W.__frxForcarLista = false;
      // 1) editando: espera terminar (salvar/fechar), depois redesenha uma vez só
      if (!porUsuario && editandoAgora()) {
        if (!esperandoRender) {
          esperandoRender = true;
          var t = setInterval(function () { if (!editandoAgora()) { clearInterval(t); esperandoRender = false; g(); } }, 400);
        }
        return;
      }
      // 2) nada mudou: não redesenha (era isso que fazia os botões piscarem)
      var sig = assinaturaLista();
      if (!porUsuario && sig === sigLista && cont && cont.children.length) return;
      // 3) redesenha mantendo a posição da tela
      var y = W.scrollY;
      var r = f.apply(this, arguments);
      sigLista = sig;
      try { botoesAvisar(); } catch (e) {}
      try { desenharEnvios(true); } catch (e) {}
      if (!porUsuario && Math.abs(W.scrollY - y) > 2) { try { W.scrollTo(0, y); } catch (e) {} }
      return r;
    };
    Object.keys(f).forEach(function (k) { try { g[k] = f[k]; } catch (e) {} });
    g.__frxEst = true; W.renderizarSequencia = g;
  }
  instalarListaEstavel();
  W.addEventListener('load', function () { instalarListaEstavel(); setTimeout(instalarListaEstavel, 1500); setTimeout(instalarListaEstavel, 4000); });
  setInterval(instalarListaEstavel, 5000);

  /* ---------------- ROTAS DO DIA: botões do formulário ----------------
     Carregar | Marcar Todos
     Agrupar  | Desmembrar Rotas
     LIMPAR   | Salvar e Adicionar Outra                                  */
  function limparFormSeq() {
    try {
      var f = $('formModalSeq'); if (f) f.reset();
      try { limparDestinosExtras(); } catch (e) {}
      var ce = $('containerCamposExtras'); if (ce) ce.innerHTML = '';
      ['seqItemId', 'seqQtdDestino', 'seqValorDestino'].forEach(function (id) { var el = $(id); if (el) el.value = ''; });
      var t = $('modalSeqTitulo'); if (t) t.innerHTML = '<i class="fa-solid fa-calendar-plus"></i> Criação de rotas';
      var ls = $('listaSugestoesSeq'); if (ls) { ls.innerHTML = ''; ls.style.display = 'none'; }
      try { atualizarPreviewAba2(); } catch (e) {}
      var c = $('seqCliente'); if (c) c.focus();
    } catch (e) {}
  }
  W.fastLimparFormSeq = limparFormSeq;
  function arrumarBotoesSeq() {
    var form = $('formModalSeq'); if (!form) return;
    var grid = form.querySelector('.rd-actions-grid'); if (!grid) return;
    var agr = grid.querySelector('[onclick*="abrirModalAgrupar"]'), desm = grid.querySelector('[onclick*="desmembrarRotas"]');
    if (agr && desm && agr.nextElementSibling !== desm) { grid.insertBefore(desm, agr.nextSibling); }
    if (desm) { desm.style.removeProperty('grid-column'); desm.style.setProperty('grid-column', 'auto', 'important'); }
    var acoes = grid.parentNode, salvar = acoes && acoes.querySelector('button[type=submit]');
    if (salvar && !acoes.querySelector('.frx-limpar-seq')) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn-secondary ripple frx-limpar-seq';
      // (o "\u200B" impede outra rotina antiga de esconder botões chamados só "Limpar")
      b.innerHTML = '<i class="fa-solid fa-eraser"></i> Limpar\u200B';
      b.onclick = limparFormSeq;
      acoes.insertBefore(b, salvar);
    }
    if (salvar && !acoes.__frxFlex) {
      acoes.__frxFlex = true;
      var linha = document.createElement('div'); linha.className = 'frx-linha-salvar';
      linha.style.cssText = 'display:grid;grid-template-columns:1fr 2fr;gap:10px;width:100%;margin-top:10px';
      var lp = acoes.querySelector('.frx-limpar-seq');
      acoes.insertBefore(linha, salvar); linha.appendChild(lp); linha.appendChild(salvar);
      [lp, salvar].forEach(function (x) { x.style.setProperty('width', '100%', 'important'); x.style.setProperty('min-height', '48px', 'important'); x.style.setProperty('margin', '0', 'important'); });
    }
  }
  W.addEventListener('load', function () { arrumarBotoesSeq(); setTimeout(arrumarBotoesSeq, 1500); });
  setInterval(arrumarBotoesSeq, 4000);

  /* ---------------- SUGESTÕES nos filtros (só o nome já cadastrado) ---------------- */
  var CAMPOS_SUG = {
    filtroSeqCliente: 'cliente', filtroSeqOrigem: 'origem', filtroSeqDestino: 'destino',
    filtroRotaOrigem: 'origem', filtroRotaDestino: 'destino',
    fastRelFiltroCliente: 'cliente', fastRelFiltroOrigem: 'origem', fastRelFiltroDestino: 'destino',
    // edição de rota (aba Rotas), editor rápido das Rotas do Dia e destino do Adicionar rota
    editTxtCliente: 'cliente', editTxtOrigem: 'origem', editTxtDestino: 'destino',
    f66eCli: 'cliente', f66eOri: 'origem', f66eDes: 'destino', txtDestino: 'destino'
  };
  function tipoCampo(el) {
    if (!el || el.tagName !== 'INPUT') return '';
    if (CAMPOS_SUG[el.id]) return CAMPOS_SUG[el.id];
    // destinos extras (Adicionar rota e Rotas do Dia) e o destino principal das Rotas do Dia
    if (el.classList && (el.classList.contains('destino-extra-input') || el.classList.contains('destino-extra-rota-input') || el.classList.contains('seq-destino-input'))) return 'destino';
    return '';
  }
  var cacheSug = { em: 0, d: null };
  function valoresSug() {
    if (cacheSug.d && Date.now() - cacheSug.em < 15000) return cacheSug.d;
    var m = { cliente: {}, origem: {}, destino: {} };
    function add(t, v) { v = String(v == null ? '' : v).trim(); if (!v || v === '-' || /[,;|]/.test(v)) return; var k = norm(v); if (!k) return; var e = m[t][k] || (m[t][k] = { n: 0, nomes: {} }); e.n++; e.nomes[v] = (e.nomes[v] || 0) + 1; }
    (bd().rotas || []).forEach(function (r) { if (!r || r.teste) return; add('cliente', r.cliente); add('origem', r.origem); add('destino', r.destino); });
    var sq = bd().sequencias || {}; Object.keys(sq).forEach(function (d) { (sq[d] || []).forEach(function (it) { if (!it || ehAgrupado(it)) return; add('cliente', it.cliente); add('origem', it.origem); add('destino', it.destino); }); });
    (bd().clientes || []).forEach(function (c) { if (c) add('cliente', c.nome); });
    (bd().destinos || []).forEach(function (x) { if (x) add('destino', x.nome); });
    var out = {};
    Object.keys(m).forEach(function (t) {
      out[t] = Object.keys(m[t]).map(function (k) { var e = m[t][k], melhor = Object.keys(e.nomes).sort(function (a2, b2) { return e.nomes[b2] - e.nomes[a2]; })[0]; return { k: k, nome: melhor, n: e.n }; });
    });
    cacheSug = { em: Date.now(), d: out };
    return out;
  }
  var caixaSug = null, campoSug = null;
  function fecharSug() { if (caixaSug) caixaSug.style.display = 'none'; }
  function mostrarSug(inp) {
    var tipo = tipoCampo(inp); if (!tipo) return;
    var q = norm(inp.value);
    if (!q) { fecharSug(); return; }
    var lista = valoresSug()[tipo].filter(function (x) { return x.k.indexOf(q) >= 0 && x.k !== q; })
      .sort(function (a2, b2) { var pa = a2.k.indexOf(q) === 0 ? 0 : 1, pb = b2.k.indexOf(q) === 0 ? 0 : 1; return pa - pb || b2.n - a2.n || a2.nome.localeCompare(b2.nome, 'pt-BR'); }).slice(0, 8);
    if (!lista.length) { fecharSug(); return; }
    if (!caixaSug) {
      caixaSug = document.createElement('div'); caixaSug.className = 'suggestions-list frx-sug';
      caixaSug.style.cssText = 'position:absolute;z-index:100050;left:0;right:0;top:100%;display:none;max-height:260px';
      caixaSug.addEventListener('mousedown', function (e) { e.preventDefault(); });
      caixaSug.addEventListener('click', function (e) {
        var it = e.target.closest && e.target.closest('[data-v]'); if (!it || !campoSug) return;
        campoSug.value = it.getAttribute('data-v'); fecharSug();
        try { campoSug.dispatchEvent(new Event('input', { bubbles: true })); campoSug.dispatchEvent(new Event('change', { bubbles: true })); } catch (er) {}
      });
    }
    var pai = inp.parentNode; if (getComputedStyle(pai).position === 'static') pai.style.position = 'relative';
    if (caixaSug.parentNode !== pai) pai.appendChild(caixaSug);
    campoSug = inp;
    caixaSug.innerHTML = lista.map(function (x) { return '<div class="suggestion-item" role="option" data-v="' + esc(x.nome) + '">' + esc(x.nome) + '</div>'; }).join('');
    caixaSug.style.display = 'block';
  }
  document.addEventListener('input', function (e) { if (tipoCampo(e.target)) mostrarSug(e.target); }, true);
  document.addEventListener('focusin', function (e) { if (tipoCampo(e.target) && e.target.value) mostrarSug(e.target); }, true);
  document.addEventListener('focusout', function (e) { var inp = e.target; if (tipoCampo(inp)) setTimeout(function () { if (campoSug === inp && document.activeElement !== inp) fecharSug(); }, 150); }, true);

  /* ---------------- BOTÕES FUNCIONAM NO PRIMEIRO TOQUE, COM O TECLADO ABERTO ----------------
     Ao tocar num botão com o teclado aberto, o campo perdia o foco ANTES do clique:
     o teclado fechava, a tela se reajustava e o botão "fugia" do dedo — o toque se
     perdia e era preciso tocar de novo. Agora o toque no botão não tira o foco do
     campo (a tela não se mexe), o botão funciona na hora e, se for de salvar/
     concluir, o teclado fecha logo depois. */
  function campoDeTexto(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName !== 'INPUT') return false;
    return /^(text|search|email|tel|number|password|url|)$/i.test(el.type || '');
  }
  function alvoBotao(t) {
    var b = t && t.closest && t.closest('button, [role="button"], .btn-primary, .btn-secondary, .btn-success, .btn-danger, .btn-warning, .btn-whatsapp, .frx-btn');
    if (!b) return null;
    if (b.closest('.suggestions-list, .frx-sug, #frxPin')) return null;      // listas de sugestão já cuidam disso
    if (b.tagName === 'INPUT' || b.tagName === 'LABEL') return null;
    return b;
  }
  function segurarFoco(e) {
    var ativo = document.activeElement;
    if (!campoDeTexto(ativo)) return;
    var b = alvoBotao(e.target);
    if (!b || b.disabled || b.contains(ativo)) return;
    e.preventDefault();   // não deixa o campo perder o foco agora (a tela não se mexe)
  }
  document.addEventListener('pointerdown', segurarFoco, true);
  document.addEventListener('mousedown', segurarFoco, true);
  // No clique (antes da ação do botão), o campo é confirmado: formatação, valor
  // digitado e "mudou" rodam primeiro — e o teclado fecha em seguida.
  document.addEventListener('click', function (e) {
    var b = alvoBotao(e.target); if (!b || b.disabled) return;
    var a2 = document.activeElement;
    if (campoDeTexto(a2) && !b.contains(a2)) { try { a2.blur(); } catch (er) {} }
  }, true);

  /* =====================================================================
     CENTRAL DE SUPORTE (PAINEL) — responde os atendimentos dos apps Cliente e
     Motorista e edita o que eles veem (contatos, horário, aviso, perguntas).
     ===================================================================== */
  var SUP = { abertos: 0, ultimoAviso: 0, falta: false };
  async function supGet(caminho) {
    var r = await fetch(SUPABASE_URL + '/' + caminho, { headers: cab(), cache: 'no-store' });
    if (r.status === 404) { SUP.falta = true; throw new Error('Falta rodar o SQL da Central de Atendimento no Supabase.'); }
    if (!r.ok) throw new Error('Sem permissão ou falha (' + r.status + ').');
    return r.json();
  }
  async function supEnviar(metodo, caminho, corpo, prefer) {
    var r = await fetch(SUPABASE_URL + '/' + caminho, { method: metodo, headers: cab({ 'Prefer': prefer || 'return=minimal' }), body: JSON.stringify(corpo) });
    if (!r.ok) { var t = ''; try { t = await r.text(); } catch (e) {} throw new Error('Falha (' + r.status + ') ' + t.slice(0, 120)); }
  }
  async function supContar() {
    if (!token() || !navigator.onLine) return;
    try {
      var l = await supGet('suporte_chamados?select=id,nao_lidas_empresa,status&or=(status.eq.aberto,nao_lidas_empresa.gt.0)&limit=200');
      var n = l.filter(function (x) { return x.nao_lidas_empresa > 0 || x.status === 'aberto'; }).length;
      var novas = l.reduce(function (t, x) { return t + (x.nao_lidas_empresa || 0); }, 0);
      if (novas > SUP.ultimoAviso) aviso('🎧 Nova mensagem na Central de Suporte (' + novas + ').', 'info');
      SUP.ultimoAviso = novas; SUP.abertos = n;
      var sp = document.querySelector('#frxTools [data-a="sup"] span'); if (sp) sp.textContent = n ? n + ' aguardando resposta' : 'clientes e motoristas';
    } catch (e) {}
  }
  setTimeout(supContar, 9000); setInterval(function () { if (!document.hidden) supContar(); }, 60000);
  function quandoBR(s2) { try { var d = new Date(s2); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

  W.fastCentralSuporte = function () {
    var div = document.createElement('div');
    div.innerHTML = '<div class="frx-row"><button type="button" class="frx-btn pq" data-aba="at">Atendimentos</button><button type="button" class="frx-btn sec pq" data-aba="ct">O que aparece nos apps</button></div><div id="frxSupCorpo"></div>';
    var j = janela('🎧 Central de Suporte', div, [{ txt: 'Fechar', cls: 'sec', fn: function (f) { clearInterval(tSup); f(); } }]);
    var corpoS = $('frxSupCorpo'), filtro = 'abertos', tSup = 0, atual = null;
    function abas(qual) { div.querySelectorAll('[data-aba]').forEach(function (b2) { b2.className = 'frx-btn pq' + (b2.getAttribute('data-aba') === qual ? '' : ' sec'); }); }
    async function lista() {
      abas('at'); atual = null; clearInterval(tSup);
      corpoS.innerHTML = '<p class="frx-muted">Carregando…</p>';
      try {
        var l = await supGet('suporte_chamados?select=*&order=atualizado_em.desc&limit=150' + (filtro === 'abertos' ? '&status=neq.fechado' : ''));
        corpoS.innerHTML = '<div class="frx-row"><button type="button" class="frx-btn ' + (filtro === 'abertos' ? '' : 'sec ') + 'pq" data-f="abertos">Em andamento</button><button type="button" class="frx-btn ' + (filtro === 'todos' ? '' : 'sec ') + 'pq" data-f="todos">Todos</button></div>' +
          (l.map(function (x) {
            var tag = x.status === 'fechado' ? '✔️ Encerrado' : x.status === 'respondido' ? '💬 Respondido' : '🟡 Aguardando';
            return '<div data-c="' + x.id + '" style="border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:10px 12px;margin:6px 0;cursor:pointer">' +
              '<div style="display:flex;justify-content:space-between;gap:8px"><b>' + (x.origem === 'motorista' ? '🚚 ' : '👤 ') + esc(x.nome || 'Sem nome') + '</b><span class="frx-muted">' + tag + '</span></div>' +
              '<div>' + esc(x.assunto || '') + (x.nao_lidas_empresa ? ' <span class="frx-pill" style="background:#fee2e2;color:#991b1b">' + x.nao_lidas_empresa + ' nova(s)</span>' : '') + '</div>' +
              '<div class="frx-muted">' + esc([x.email, x.contato].filter(Boolean).join(' · ')) + ' · ' + quandoBR(x.atualizado_em) + '</div></div>';
          }).join('') || '<p class="frx-muted">Nenhum atendimento ' + (filtro === 'abertos' ? 'em andamento' : '') + '.</p>');
      } catch (e) { corpoS.innerHTML = '<p style="color:#b91c1c;font-weight:700">' + esc(e.message) + '</p>'; }
    }
    async function conversa(id) {
      atual = id;
      try {
        var c = (await supGet('suporte_chamados?select=*&id=eq.' + id))[0]; if (!c) return lista();
        var m = await supGet('suporte_mensagens?select=*&chamado_id=eq.' + id + '&order=id.asc');
        corpoS.innerHTML = '<div class="frx-row"><button type="button" class="frx-btn sec pq" data-voltar>← Voltar</button>' + (c.status !== 'fechado' ? '<button type="button" class="frx-btn sec pq" data-encerrar>Encerrar atendimento</button>' : '') + '</div>' +
          '<div style="margin-bottom:8px"><b>' + (c.origem === 'motorista' ? '🚚 Motorista ' : '👤 Cliente ') + esc(c.nome || '') + '</b><div class="frx-muted">' + esc([c.assunto, c.email, c.contato].filter(Boolean).join(' · ')) + '</div></div>' +
          '<div id="frxSupMsgs" style="max-height:46vh;overflow:auto">' + m.map(function (x) {
            var emp = x.autor === 'empresa';
            return '<div style="max-width:85%;margin:6px 0;' + (emp ? 'margin-left:auto;background:#4f46e5;color:#fff' : 'background:#f1f5f9;color:#0f172a') + ';padding:9px 12px;border-radius:14px;white-space:pre-wrap">' + esc(x.texto) + '<div style="font-size:11px;opacity:.7;margin-top:3px">' + (emp ? 'FAST · ' : '') + quandoBR(x.criado_em) + '</div></div>';
          }).join('') + '</div>' +
          '<textarea class="frx-in" id="frxSupResp" rows="3" maxlength="2000" placeholder="Responder…" style="margin-top:8px"></textarea>' +
          '<div class="frx-row" style="margin-top:8px"><button type="button" class="frx-btn ok" data-responder style="flex:1">Enviar resposta</button></div>';
        var cx = $('frxSupMsgs'); if (cx) cx.scrollTop = cx.scrollHeight;
        if (c.nao_lidas_empresa) { try { await supEnviar('PATCH', 'suporte_chamados?id=eq.' + id, { nao_lidas_empresa: 0 }); } catch (e) {} supContar(); }
        clearInterval(tSup); tSup = setInterval(function () { var ta = $('frxSupResp'); if (atual === id && !(ta && ta.value) && document.body.contains(corpoS)) conversa(id); }, 20000);
        corpoS.__chamado = c;
      } catch (e) { corpoS.innerHTML = '<p style="color:#b91c1c;font-weight:700">' + esc(e.message) + '</p>'; }
    }
    async function conteudoTela() {
      abas('ct'); atual = null; clearInterval(tSup);
      corpoS.innerHTML = '<p class="frx-muted">Carregando…</p>';
      var c = {};
      try { var l = await supGet('suporte_conteudo?select=dados&id=eq.1'); c = (l[0] && l[0].dados) || {}; } catch (e) { corpoS.innerHTML = '<p style="color:#b91c1c;font-weight:700">' + esc(e.message) + '</p>'; return; }
      var perguntas = Array.isArray(c.perguntas) ? c.perguntas.slice() : [];
      function campo(id, rot, v, tipo) { return '<label class="frx-muted" style="display:block;margin-top:10px">' + rot + '</label>' + (tipo === 'area' ? '<textarea class="frx-in" id="' + id + '" rows="3">' + esc(v || '') + '</textarea>' : '<input class="frx-in" id="' + id + '" value="' + esc(v || '') + '">'); }
      function desenharPerg() {
        $('frxSupPerg').innerHTML = perguntas.map(function (p2, i) {
          return '<div style="border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:10px;margin:6px 0"><input class="frx-in" data-pq="' + i + '" placeholder="Pergunta" value="' + esc(p2.pergunta || '') + '">' +
            '<textarea class="frx-in" data-pr="' + i + '" rows="2" placeholder="Resposta" style="margin-top:6px">' + esc(p2.resposta || '') + '</textarea>' +
            '<div class="frx-row" style="margin:6px 0 0"><select class="frx-in" data-pp="' + i + '" style="flex:1"><option value="todos">Para todos</option><option value="cliente">Só clientes</option><option value="motorista">Só motoristas</option></select><button type="button" class="frx-btn sec pq" data-prm="' + i + '">Remover</button></div></div>';
        }).join('') || '<p class="frx-muted">Nenhuma pergunta ainda.</p>';
        perguntas.forEach(function (p2, i) { var sl = corpoS.querySelector('[data-pp="' + i + '"]'); if (sl) sl.value = p2.para || 'todos'; });
      }
      corpoS.innerHTML = '<p class="frx-muted" style="margin:0">Isto aparece na Central de Atendimento dos apps Cliente e Motorista.</p>' +
        campo('frxSupAviso', '📢 Aviso em destaque (deixe vazio para não mostrar)', c.aviso, 'area') +
        campo('frxSupWa', '💬 WhatsApp de atendimento (com DDD)', c.whatsapp) +
        campo('frxSupTel', '📞 Telefone para ligar', c.telefone) +
        campo('frxSupEmail', '✉️ E-mail', c.email) +
        campo('frxSupHor', '🕒 Horário de atendimento', c.horario || 'Segunda a sábado, das 8h às 18h') +
        campo('frxSupMsg', 'Mensagem de boas-vindas', c.mensagem, 'area') +
        campo('frxSupAss', 'Assuntos para escolher (um por linha; vazio = padrão)', (c.assuntos || []).join('\n'), 'area') +
        '<h4 style="margin:14px 0 4px">Perguntas frequentes</h4><div id="frxSupPerg"></div><button type="button" class="frx-btn sec pq" data-padd>➕ Adicionar pergunta</button>' +
        '<div class="frx-row" style="margin-top:14px"><button type="button" class="frx-btn ok" data-salvar-ct style="flex:1">Salvar o que aparece nos apps</button></div>';
      desenharPerg();
      corpoS.__perguntas = perguntas; corpoS.__desenharPerg = desenharPerg;
    }
    j.corpo.addEventListener('input', function (e) {
      var pg = corpoS.__perguntas; if (!pg) return;
      var a2 = e.target.getAttribute('data-pq'), b2 = e.target.getAttribute('data-pr');
      if (a2 != null) pg[+a2].pergunta = e.target.value; if (b2 != null) pg[+b2].resposta = e.target.value;
    });
    j.corpo.addEventListener('change', function (e) { var pg = corpoS.__perguntas, c2 = e.target.getAttribute('data-pp'); if (pg && c2 != null) pg[+c2].para = e.target.value; });
    j.corpo.addEventListener('click', async function (e) {
      var t = e.target;
      var ab = t.getAttribute('data-aba'); if (ab === 'at') return lista(); if (ab === 'ct') return conteudoTela();
      var f2 = t.getAttribute('data-f'); if (f2) { filtro = f2; return lista(); }
      var c3 = t.closest && t.closest('[data-c]'); if (c3) return conversa(c3.getAttribute('data-c'));
      if (t.hasAttribute('data-voltar')) return lista();
      if (t.hasAttribute('data-padd')) { corpoS.__perguntas.push({ pergunta: '', resposta: '', para: 'todos' }); return corpoS.__desenharPerg(); }
      var rm = t.getAttribute('data-prm'); if (rm != null) { corpoS.__perguntas.splice(+rm, 1); return corpoS.__desenharPerg(); }
      if (t.hasAttribute('data-encerrar') && atual) { try { await supEnviar('PATCH', 'suporte_chamados?id=eq.' + atual, { status: 'fechado', atualizado_em: new Date().toISOString() }); aviso('Atendimento encerrado.'); lista(); } catch (er) { aviso(er.message, 'error'); } return; }
      if (t.hasAttribute('data-responder') && atual) {
        var ta = $('frxSupResp'), v = (ta.value || '').trim(); if (!v) return;
        t.disabled = true;
        try {
          var c4 = corpoS.__chamado || {};
          await supEnviar('POST', 'suporte_mensagens', [{ chamado_id: Number(atual), autor: 'empresa', texto: v.slice(0, 2000) }]);
          await supEnviar('PATCH', 'suporte_chamados?id=eq.' + atual, { status: 'respondido', atualizado_em: new Date().toISOString(), nao_lidas_empresa: 0, nao_lidas_usuario: (Number(c4.nao_lidas_usuario) || 0) + 1 });
          ta.value = ''; conversa(atual);
        } catch (er) { aviso(er.message, 'error'); t.disabled = false; }
        return;
      }
      if (t.hasAttribute('data-salvar-ct')) {
        var val = function (id) { return (($(id) || {}).value || '').trim(); };
        var dados = { aviso: val('frxSupAviso'), whatsapp: val('frxSupWa'), telefone: val('frxSupTel'), email: val('frxSupEmail'), horario: val('frxSupHor'), mensagem: val('frxSupMsg'),
          assuntos: val('frxSupAss').split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
          perguntas: (corpoS.__perguntas || []).filter(function (p3) { return p3 && String(p3.pergunta || '').trim(); }) };
        t.disabled = true;
        try { await supEnviar('POST', 'suporte_conteudo', [{ id: 1, dados: dados, updated_at: new Date().toISOString() }], 'resolution=merge-duplicates,return=minimal'); aviso('Salvo. Já aparece nos apps Cliente e Motorista.'); }
        catch (er) { aviso(er.message, 'error'); }
        t.disabled = false;
      }
    });
    lista();
  };

  /* ---------------- NAVEGAR: Mapa do FAST, Google Maps ou Waze (com "usar sempre") ---------------- */
  function instalarNavegar() {
    var f = W.navAbrirGpsDropdown;
    if (typeof W.fastNavegar !== 'function' || (f && f.__frx)) return;
    var g = function (ev, destino) { try { if (ev && ev.stopPropagation) ev.stopPropagation(); } catch (e) {} W.fastNavegar(destino); };
    g.__frx = true; W.navAbrirGpsDropdown = g;
  }
  W.addEventListener('load', function () { instalarNavegar(); setTimeout(instalarNavegar, 2000); });
  setInterval(instalarNavegar, 5000);

  /* ---------------- câmera ao vivo: garante que a imagem comece a rodar ----------------
     O código original liga a câmera mas não manda o vídeo "tocar"; com economia de
     bateria/dados o Chrome deixa parado e mostra só o símbolo ▶ cinza. */
  var POSTER_VAZIO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  function tocarCamera(v) {
    if (v && !v.getAttribute('poster')) v.setAttribute('poster', POSTER_VAZIO);   // sem o "▶" cinza do Android
    if (!v || !v.srcObject || !v.paused) return;
    v.muted = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    try { var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  ['loadedmetadata', 'loadeddata', 'canplay'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (e.target && e.target.id === 'fastCameraAoVivoVideo') tocarCamera(e.target); }, true);
  });
  document.addEventListener('click', function (e) { if (e.target && e.target.id === 'fastCameraAoVivoVideo') tocarCamera(e.target); }, true);
  setInterval(function () { var v = document.getElementById('fastCameraAoVivoVideo'); if (v) tocarCamera(v); }, 700);

  /* No app Android 5.0.1+, o botão Câmera abre a câmera do PRÓPRIO celular (mais rápida e
     confiável que a câmera ao vivo dentro do app). A foto volta direto para a rota. */
  function versaoApk() {
    var m = String(navigator.userAgent || '').match(/FASTAndroid\/(\d+)\.(\d+)\.(\d+)/);
    return m ? (+m[1]) * 10000 + (+m[2]) * 100 + (+m[3]) : 0;
  }
  function instalarCameraNativa() {
    var f = W.abrirCameraAoVivo;
    if (typeof f !== 'function' || f.__frxNativa) return;
    var g = function (dataSel, index, fallbackId) {
      if (versaoApk() >= 50001) {
        var inp = fallbackId ? document.getElementById(fallbackId) : null;
        if (inp) { inp.click(); return; }
      }
      return f.apply(this, arguments);
    };
    g.__frxNativa = true; g.__f68 = true; W.abrirCameraAoVivo = g;
  }
  // instala por último (depois do arquivo de sincronização), para ficar por cima dele
  W.addEventListener('load', function () { setTimeout(instalarCameraNativa, 1200); setTimeout(instalarCameraNativa, 3000); });
  setInterval(instalarCameraNativa, 5000);

  /* ---------------- ciclo: injeta botões quando as telas são redesenhadas ---------------- */
  var tPainel = 0;
  function rodada() {
    try { desenharEnvios(false); } catch (e) {}
    try { botoesClientes(); } catch (e) {}
    try { botoesAvisar(); } catch (e) {}
    if (!$('frxTools')) { clearTimeout(tPainel); tPainel = setTimeout(function () { try { painelFerramentas(); } catch (e) {} }, 400); }
  }
  // atualiza os indicadores ao abrir o Centro de Operações
  document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[onclick*="central"],[data-pro-tab="central"]'); if (t) setTimeout(function () { try { painelFerramentas(); } catch (er) {} }, 300); }, true);
  var obs = null;
  function iniciar() {
    rodada();
    if (!obs && W.MutationObserver) {
      var pend = 0;
      obs = new MutationObserver(function (muts) {
        // ignora mudanças feitas por este próprio arquivo
        for (var i = 0; i < muts.length; i++) { var t = muts[i].target; if (t && t.closest && (t.closest('#frxTools') || t.closest('.frx-ov') || t.closest('#frxPin'))) continue; clearTimeout(pend); pend = setTimeout(rodada, 250); return; }
      });
      // só observa as áreas onde estes botões entram (antes era a página inteira,
      // o que rodava a cada mudança mínima da tela)
      var observados = [];
      var ligarObs = function () {
        ['containerSequencia', 'tabelaClientesBody', 'central'].forEach(function (id) {
          var el = $(id); if (el && observados.indexOf(el) < 0) { observados.push(el); obs.observe(el, { childList: true, subtree: id !== 'central' }); }
        });
      };
      ligarObs(); setTimeout(ligarObs, 2000); setTimeout(ligarObs, 6000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true }); else iniciar();
  W.addEventListener('load', function () { setTimeout(rodada, 1500); });
  setInterval(function () { try { if (!document.hidden && $('frxTools') && $('frxTools').offsetParent) painelFerramentas(); } catch (e) {} }, 15000);
  [4000, 10000, 20000].forEach(function (t) { setTimeout(function () { try { painelFerramentas(); } catch (e) {} }, t); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(function () { try { painelFerramentas(); } catch (e) {} }, 800); });
})();
