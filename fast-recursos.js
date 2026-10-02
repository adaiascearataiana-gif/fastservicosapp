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
    '.frx-cx{background:var(--card-bg,#fff);color:var(--text-main,#0f172a);width:100%;max-width:760px;max-height:92vh;display:flex;flex-direction:column;border-radius:20px 20px 0 0;box-shadow:0 20px 60px rgba(0,0,0,.35);font-family:inherit}',
    '@media(min-width:720px){.frx-cx{border-radius:20px}}',
    '.frx-hd{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--border,#e2e8f0)}',
    '.frx-hd h3{margin:0;font-size:17px;font-weight:800;flex:1}',
    '.frx-x{border:1px solid var(--border,#e2e8f0);background:transparent;color:inherit;border-radius:10px;width:40px;height:40px;font-size:18px;cursor:pointer}',
    '.frx-bd{padding:14px 18px;overflow:auto;flex:1}',
    '.frx-ft{padding:12px 18px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--border,#e2e8f0);display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
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
    try { ov.setAttribute('popover', 'manual'); ov.style.cssText += ';margin:0;border:0;width:100vw;height:100vh;max-width:none;max-height:none;'; } catch (e) {}
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
      ref.parentNode.insertBefore(b, ref.nextSibling);
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
    try { d.setAttribute('popover', 'manual'); d.style.cssText = 'margin:0;border:0;width:100vw;height:100vh;max-width:none;max-height:none;'; } catch (e) {}
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
      '<button type="button" class="frx-tool" data-a="bkp">☁️ Backup no Drive<span>' + (ult ? 'último: ' + new Date(ult).toLocaleDateString('pt-BR') : 'semanal, automático') + '</span></button>' +
      '</div>' + (cfgFalta ? '<p class="frx-muted" style="margin-top:8px">⚠️ Falta rodar o SQL da tabela fast_config para a tabela de preços e o PIX valerem em todos os aparelhos.</p>' : '');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#frxTools [data-a]'); if (!b) return;
    var a = b.getAttribute('data-a');
    if (a === 'busca') W.fastBuscaCompleta();
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

  /* ---------------- câmera ao vivo: garante que a imagem comece a rodar ----------------
     O código original liga a câmera mas não manda o vídeo "tocar"; com economia de
     bateria/dados o Chrome deixa parado e mostra só o símbolo ▶ cinza. */
  function tocarCamera(v) {
    if (!v || !v.srcObject || !v.paused) return;
    v.muted = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    try { var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  ['loadedmetadata', 'loadeddata', 'canplay'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (e.target && e.target.id === 'fastCameraAoVivoVideo') tocarCamera(e.target); }, true);
  });
  document.addEventListener('click', function (e) { if (e.target && e.target.id === 'fastCameraAoVivoVideo') tocarCamera(e.target); }, true);
  setInterval(function () { var v = document.getElementById('fastCameraAoVivoVideo'); if (v) tocarCamera(v); }, 700);

  /* ---------------- ciclo: injeta botões quando as telas são redesenhadas ---------------- */
  var tPainel = 0;
  function rodada() {
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
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true }); else iniciar();
  W.addEventListener('load', function () { setTimeout(rodada, 1500); });
  setInterval(function () { try { painelFerramentas(); } catch (e) {} }, 60000);
})();
