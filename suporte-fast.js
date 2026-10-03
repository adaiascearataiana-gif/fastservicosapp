/* =====================================================================
   FAST — CENTRAL DE ATENDIMENTO (apps Cliente e Motorista)
   Conteúdo (contatos, horário, avisos, perguntas) é editado no PAINEL.
   Atendimentos: o usuário abre um chamado e conversa com a empresa; a
   empresa responde pelo PAINEL (Ferramentas FAST → Central de Suporte).
   Configuração (antes de carregar este arquivo):
     window.FAST_SUPORTE_CFG = { origem:'cliente'|'motorista',
       token:fn, nome:fn, email:fn, contato:fn }
   ===================================================================== */
(function () {
  'use strict';
  var W = window;
  if (W.__fastSuporte) return;
  W.__fastSuporte = true;

  var URL_REST = 'https://yhxuplhohhetzloxvgku.supabase.co/rest/v1';
  var CHAVE_PUB = 'sb_publishable_jlsorkXci3_0Hla7gt8z1g_pe6zOT19';
  var CFG = W.FAST_SUPORTE_CFG || {};
  var ORIGEM = CFG.origem === 'motorista' ? 'motorista' : 'cliente';
  var K_CHAVES = 'fast_suporte_chaves_' + ORIGEM;

  function chama(fn, pad) { try { var v = typeof fn === 'function' ? fn() : fn; return v == null ? pad : v; } catch (e) { return pad; } }
  function token() { return chama(CFG.token, '') || ''; }
  function cab() { var t = token(); return { 'apikey': CHAVE_PUB, 'Authorization': 'Bearer ' + (t || CHAVE_PUB), 'Content-Type': 'application/json' }; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function chaves() { try { return JSON.parse(localStorage.getItem(K_CHAVES) || '[]') || []; } catch (e) { return []; } }
  function guardarChave(k) { var l = chaves(); if (l.indexOf(k) < 0) l.unshift(k); try { localStorage.setItem(K_CHAVES, JSON.stringify(l.slice(0, 50))); } catch (e) {} }
  function novaChave() { var a = new Uint8Array(16); try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256); } return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function quando(s) { try { var d = new Date(s); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  async function rpc(nome, corpo) {
    var r = await fetch(URL_REST + '/rpc/' + nome, { method: 'POST', headers: cab(), body: JSON.stringify(corpo || {}) });
    if (!r.ok) { var t = ''; try { t = await r.text(); } catch (e) {} throw new Error(r.status === 404 ? 'A central de atendimento ainda não foi ativada.' : ('Falha (' + r.status + ') ' + t.slice(0, 120))); }
    var tx = await r.text(); return tx ? JSON.parse(tx) : null;
  }
  async function conteudo() {
    try { var r = await fetch(URL_REST + '/suporte_conteudo?select=dados&id=eq.1', { headers: cab(), cache: 'no-store' }); if (!r.ok) return {}; var j = await r.json(); return (j[0] && j[0].dados) || {}; } catch (e) { return {}; }
  }
  async function meus() { return (await rpc('suporte_meus', { p_chaves: chaves() })) || []; }

  /* ---------------- estilos ---------------- */
  var st = document.createElement('style');
  st.textContent = [
    '#fsupBtn{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9990;border:0;border-radius:999px;padding:12px 16px;font:800 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#fff;background:linear-gradient(135deg,#2563eb,#7c3aed);box-shadow:0 10px 24px rgba(37,99,235,.35);display:flex;align-items:center;gap:8px}',
    '#fsupBtn .n{background:#ef4444;border-radius:999px;min-width:20px;height:20px;padding:0 6px;font-size:12px;display:inline-grid;place-items:center}',
    '#fsup{position:fixed;inset:0;z-index:9995;background:rgba(15,23,42,.55);display:none;align-items:flex-end;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}',
    '#fsup.on{display:flex}#fsup .cx{background:#fff;color:#0f172a;width:100%;max-width:640px;height:92vh;height:calc(100dvh - 20px);border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden}',
    '@media(min-width:700px){#fsup{align-items:center}#fsup .cx{border-radius:20px;height:min(760px,92vh)}}',
    '#fsup .hd{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #e2e8f0}#fsup .hd b{flex:1;font-size:17px}',
    '#fsup .x{border:1px solid #e2e8f0;background:#fff;border-radius:10px;width:40px;height:40px;font-size:18px}',
    '#fsup .bd{flex:1;overflow:auto;padding:14px 16px}#fsup .ft{padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid #e2e8f0;display:flex;gap:8px}',
    '#fsup .av{background:#fef3c7;color:#78350f;border-radius:12px;padding:10px 12px;margin-bottom:12px;font-weight:600;white-space:pre-wrap}',
    '#fsup .ct{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:10px}',
    '#fsup .ct a{display:flex;align-items:center;justify-content:center;gap:6px;min-height:48px;border-radius:12px;text-decoration:none;font-weight:800;color:#fff;background:#2563eb}',
    '#fsup .ct a.wa{background:#22c55e;color:#052e16}#fsup .ct a.em{background:#0f172a}',
    '#fsup .hr{color:#475569;font-size:13px;margin-bottom:12px}#fsup h4{margin:14px 0 8px;font-size:15px}',
    '#fsup details{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:6px}#fsup summary{font-weight:700;cursor:pointer}#fsup details p{margin:8px 0 0;color:#334155;white-space:pre-wrap}',
    '#fsup .ch{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;align-items:center;cursor:pointer}',
    '#fsup .tag{font-size:11px;font-weight:800;border-radius:999px;padding:3px 8px;background:#e0e7ff;color:#3730a3}#fsup .tag.r{background:#dcfce7;color:#166534}#fsup .tag.f{background:#f1f5f9;color:#475569}',
    '#fsup .msg{max-width:85%;padding:9px 12px;border-radius:14px;margin:6px 0;white-space:pre-wrap;line-height:1.35}#fsup .msg small{display:block;opacity:.6;font-size:11px;margin-top:3px}',
    '#fsup .msg.u{margin-left:auto;background:#2563eb;color:#fff;border-bottom-right-radius:4px}#fsup .msg.e{background:#f1f5f9;border-bottom-left-radius:4px}',
    '#fsup input,#fsup textarea,#fsup select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:12px;padding:11px 12px;font-size:16px;font-family:inherit}',
    '#fsup .bt{border:0;border-radius:12px;padding:12px 16px;font-weight:800;font-size:15px;background:#2563eb;color:#fff;min-height:48px}#fsup .bt.s{background:#fff;color:#0f172a;border:1px solid #cbd5e1}',
    '#fsup .mut{color:#64748b;font-size:13px}#fsup .er{color:#b91c1c;font-weight:700;margin:8px 0}'
  ].join('\n');
  document.head.appendChild(st);

  var btn = document.createElement('button');
  btn.id = 'fsupBtn'; btn.type = 'button'; btn.innerHTML = '🎧 Atendimento <span class="n" hidden></span>';
  var ov = document.createElement('div'); ov.id = 'fsup';
  ov.innerHTML = '<div class="cx" role="dialog" aria-modal="true"><div class="hd"><button type="button" class="x" data-voltar hidden aria-label="Voltar">←</button><b>Central de Atendimento</b><button type="button" class="x" data-fechar aria-label="Fechar">✕</button></div><div class="bd"></div><div class="ft" hidden></div></div>';
  function montar() { if (!document.body) return setTimeout(montar, 200); document.body.appendChild(btn); document.body.appendChild(ov); }
  montar();
  // o botão só aparece com o usuário dentro do app (depois do login)
  function visibilidade() { btn.style.display = chama(CFG.visivel, true) ? 'flex' : 'none'; }
  visibilidade(); setInterval(visibilidade, 1500);

  var corpo = ov.querySelector('.bd'), rodape = ov.querySelector('.ft'), voltar = ov.querySelector('[data-voltar]');
  var tela = 'inicio', atual = null, timer = 0, dados = { c: {}, lista: [] };

  function abrir() { ov.classList.add('on'); inicio(); }
  function fechar() { ov.classList.remove('on'); clearInterval(timer); }
  btn.onclick = abrir;
  ov.querySelector('[data-fechar]').onclick = fechar;
  voltar.onclick = function () { inicio(); };
  W.fastAbrirAtendimento = abrir;

  async function inicio() {
    tela = 'inicio'; atual = null; voltar.hidden = true; rodape.hidden = true; clearInterval(timer);
    corpo.innerHTML = '<p class="mut">Carregando…</p>';
    var c = await conteudo(); dados.c = c;
    var lista = []; var erro = '';
    try { lista = await meus(); } catch (e) { erro = e.message; }
    dados.lista = lista;
    var tel = String(c.whatsapp || '').replace(/\D/g, '');
    var h = '';
    if (c.aviso) h += '<div class="av">📢 ' + esc(c.aviso) + '</div>';
    h += '<div class="ct">' +
      (tel ? '<a class="wa" target="_blank" rel="noopener" href="https://wa.me/' + (tel.length <= 11 ? '55' + tel : tel) + '?text=' + encodeURIComponent('Olá! Sou ' + (chama(CFG.nome, '') || (ORIGEM === 'motorista' ? 'motorista' : 'cliente')) + ' e preciso de atendimento.') + '">💬 WhatsApp</a>' : '') +
      (c.telefone ? '<a href="tel:' + esc(String(c.telefone).replace(/[^\d+]/g, '')) + '">📞 Ligar</a>' : '') +
      (c.email ? '<a class="em" href="mailto:' + esc(c.email) + '">✉️ E-mail</a>' : '') + '</div>';
    if (c.horario) h += '<div class="hr">🕒 ' + esc(c.horario) + '</div>';
    if (c.mensagem) h += '<p style="white-space:pre-wrap">' + esc(c.mensagem) + '</p>';
    h += '<h4>Meus atendimentos</h4>';
    if (erro) h += '<p class="er">' + esc(erro) + '</p>';
    h += lista.length ? lista.map(function (x) {
      var tag = x.status === 'fechado' ? '<span class="tag f">Encerrado</span>' : x.status === 'respondido' ? '<span class="tag r">Respondido</span>' : '<span class="tag">Aguardando</span>';
      return '<div class="ch" data-ch="' + esc(x.chave) + '"><div><b>' + esc(x.assunto || 'Atendimento') + '</b><div class="mut">' + quando(x.atualizado_em) + (x.nao_lidas_usuario ? ' · <b style="color:#dc2626">' + x.nao_lidas_usuario + ' nova(s)</b>' : '') + '</div></div>' + tag + '</div>';
    }).join('') : '<p class="mut">Você ainda não abriu nenhum atendimento.</p>';
    h += '<button type="button" class="bt" data-novo style="width:100%;margin-top:8px">➕ Novo atendimento</button>';
    var faq = Array.isArray(c.perguntas) ? c.perguntas.filter(function (p) { return p && p.pergunta; }) : [];
    var pub = faq.filter(function (p) { return !p.para || p.para === 'todos' || p.para === ORIGEM; });
    if (pub.length) h += '<h4>Perguntas frequentes</h4>' + pub.map(function (p) { return '<details><summary>' + esc(p.pergunta) + '</summary><p>' + esc(p.resposta || '') + '</p></details>'; }).join('');
    corpo.innerHTML = h;
    atualizarSelo(lista);
  }
  function novo() {
    tela = 'novo'; voltar.hidden = false; rodape.hidden = false; clearInterval(timer);
    var assuntos = (Array.isArray(dados.c.assuntos) && dados.c.assuntos.length) ? dados.c.assuntos : (ORIGEM === 'motorista' ? ['Rota / entrega', 'Pagamento', 'Aplicativo', 'Documentos', 'Outro'] : ['Entrega', 'Pagamento / cobrança', 'Fotos / comprovante', 'Aplicativo', 'Outro']);
    corpo.innerHTML = '<h4 style="margin-top:0">Novo atendimento</h4><label class="mut">Assunto</label><select data-as>' + assuntos.map(function (a) { return '<option>' + esc(a) + '</option>'; }).join('') + '</select>' +
      '<label class="mut" style="display:block;margin-top:10px">Mensagem</label><textarea data-tx rows="6" maxlength="2000" placeholder="Conte o que aconteceu…"></textarea><div class="er" data-er></div>';
    rodape.innerHTML = '<button type="button" class="bt s" data-cancelar style="flex:1">Cancelar</button><button type="button" class="bt" data-enviar-novo style="flex:2">Enviar</button>';
  }
  async function conversa(chave) {
    tela = 'conversa'; atual = chave; voltar.hidden = false; rodape.hidden = false;
    rodape.innerHTML = '<textarea data-resp rows="1" maxlength="2000" placeholder="Escreva sua mensagem…" style="flex:1;min-height:48px"></textarea><button type="button" class="bt" data-resp-env>Enviar</button>';
    await desenharConversa();
    clearInterval(timer); timer = setInterval(function () { if (ov.classList.contains('on') && tela === 'conversa' && !document.hidden) desenharConversa(true); }, 15000);
    try { await rpc('suporte_lidas', { p_chave: chave }); } catch (e) {}
  }
  async function desenharConversa(silencioso) {
    try { dados.lista = await meus(); } catch (e) { if (!silencioso) corpo.innerHTML = '<p class="er">' + esc(e.message) + '</p>'; return; }
    var x = dados.lista.filter(function (c) { return c.chave === atual; })[0]; if (!x) return;
    var fim = corpo.scrollTop + corpo.clientHeight >= corpo.scrollHeight - 30;
    corpo.innerHTML = '<div class="mut" style="margin-bottom:8px"><b>' + esc(x.assunto || 'Atendimento') + '</b> · aberto em ' + quando(x.criado_em) + '</div>' +
      (x.mensagens || []).map(function (m) { return '<div class="msg ' + (m.autor === 'empresa' ? 'e' : 'u') + '">' + esc(m.texto) + '<small>' + (m.autor === 'empresa' ? 'FAST · ' : '') + quando(m.criado_em) + '</small></div>'; }).join('') +
      (x.status === 'fechado' ? '<p class="mut" style="text-align:center">Atendimento encerrado. Se precisar, escreva de novo que ele é reaberto.</p>' : '');
    if (fim || !silencioso) corpo.scrollTop = corpo.scrollHeight;
  }
  ov.addEventListener('click', async function (e) {
    var t = e.target;
    var ch = t.closest && t.closest('[data-ch]'); if (ch) { conversa(ch.getAttribute('data-ch')); return; }
    if (t.closest && t.closest('[data-novo]')) { novo(); return; }
    if (t.closest && t.closest('[data-cancelar]')) { inicio(); return; }
    if (t.closest && t.closest('[data-enviar-novo]')) {
      var tx = (corpo.querySelector('[data-tx]') || {}).value || '', as = (corpo.querySelector('[data-as]') || {}).value || '';
      var er = corpo.querySelector('[data-er]');
      if (tx.trim().length < 3) { er.textContent = 'Escreva a mensagem.'; return; }
      var b = t.closest('[data-enviar-novo]'); b.disabled = true; b.textContent = 'Enviando…';
      var k = novaChave();
      try {
        await rpc('suporte_abrir', { p_chave: k, p_origem: ORIGEM, p_nome: String(chama(CFG.nome, '')).slice(0, 120), p_contato: String(chama(CFG.contato, '')).slice(0, 60), p_email: String(chama(CFG.email, '')).slice(0, 120), p_assunto: as.slice(0, 120), p_texto: tx.trim().slice(0, 2000) });
        guardarChave(k); conversa(k);
      } catch (e2) { er.textContent = e2.message; b.disabled = false; b.textContent = 'Enviar'; }
      return;
    }
    if (t.closest && t.closest('[data-resp-env]')) {
      var ta = rodape.querySelector('[data-resp]'), v = (ta.value || '').trim(); if (!v || !atual) return;
      var b2 = t.closest('[data-resp-env]'); b2.disabled = true;
      try { await rpc('suporte_enviar', { p_chave: atual, p_texto: v.slice(0, 2000) }); ta.value = ''; await desenharConversa(); } catch (e3) { alert(e3.message); }
      b2.disabled = false;
    }
  });

  function atualizarSelo(lista) {
    var n = (lista || []).reduce(function (s, x) { return s + (Number(x.nao_lidas_usuario) || 0); }, 0);
    var el = btn.querySelector('.n'); el.hidden = !n; el.textContent = n;
  }
  async function verificar() { if (document.hidden || !chaves().length && !chama(CFG.email, '')) return; try { atualizarSelo(await meus()); } catch (e) {} }
  setTimeout(verificar, 4000); setInterval(verificar, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) verificar(); });
})();
