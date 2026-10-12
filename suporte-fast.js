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

  /* ---------- 5.3.3: no app instalado, todo “compartilhar” abre a gaveta de apps do Android ---------- */
  (function () {
    if (W.__fastShareNativo) return;
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
      if (!arqs.length && !texto) texto = d.title || '';
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

  /* ---------- 5.2.7: imagens no atendimento + visualizador (Salvar / Compartilhar) ---------- */
  var URL_BASE = URL_REST.replace(/\/rest\/v1$/, '');
  function comprimir(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), img = new Image();
      img.onload = function () { try { var m = 1600, e = Math.min(1, m / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * e); c.height = Math.round(img.naturalHeight * e); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); c.toBlob(function (b) { b ? res(b) : rej(new Error('imagem')); }, 'image/jpeg', 0.82); } catch (er) { rej(er); } };
      img.onerror = function () { URL.revokeObjectURL(u); rej(new Error('Formato de imagem não suportado')); }; img.src = u;
    });
  }
  async function subirImagem(file) {
    var b = await comprimir(file), nome = ORIGEM + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.jpg';
    var t = token();
    var r = await fetch(URL_BASE + '/storage/v1/object/suporte/' + nome, { method: 'POST', headers: { 'apikey': CHAVE_PUB, 'Authorization': 'Bearer ' + (t || CHAVE_PUB), 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: b });
    if (!r.ok) throw new Error('Não foi possível enviar a imagem (' + r.status + ').');
    return URL_BASE + '/storage/v1/object/public/suporte/' + nome;
  }
  W.fastSuporteSubirImagem = subirImagem;
  // 5.3.1: chamar a FAST direto no WhatsApp (número cadastrado no PAINEL → Central de Suporte → Conteúdo)
  W.fastSuporteWhatsApp = async function (assunto) {
    var c = (dados && dados.c && dados.c.whatsapp) ? dados.c : await conteudo();
    var tel = String((c && c.whatsapp) || '').replace(/\D/g, '');
    if (!tel) { alert('A FAST ainda não cadastrou o WhatsApp de atendimento. Use o Atendimento pelo app 🎧.'); return; }
    if (tel.length <= 11) tel = '55' + tel;
    var nome = chama(CFG.nome, ''), email = chama(CFG.email, '');
    var txt = 'Olá, FAST! Aqui é ' + (nome || (ORIGEM === 'motorista' ? 'um motorista' : 'um cliente')) + (ORIGEM === 'motorista' ? ' (motorista)' : ' (cliente)') + (email ? ' — ' + email : '') + '.' + (assunto ? '\nAssunto: ' + assunto : '') + '\nPreciso de ajuda com: ';
    W.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(txt), '_blank');
  };
  // texto da mensagem: "[img]https://..." vira miniatura
  function textoMsg(t) {
    var s0 = String(t || ''), m = s0.match(/\[img\](https?:\/\/\S+)/);
    if (!m) return esc(s0);
    var resto = s0.replace(m[0], '').trim();
    return (resto ? esc(resto) + '<br>' : '') + '<img src="' + esc(m[1]) + '" data-ver="' + esc(m[1]) + '" alt="Imagem" style="max-width:220px;max-height:220px;border-radius:10px;margin-top:4px;cursor:pointer;display:block">';
  }
  function ehApp() { return /FASTAndroid/i.test(navigator.userAgent || ''); }
  async function arquivoDe(url, nome) { var r = await fetch(url, { cache: 'force-cache' }); var b = await r.blob(); return new File([b], nome || 'imagem.jpg', { type: b.type || 'image/jpeg' }); }
  async function compartilharImg(url, nome) {
    try { var f = await arquivoDe(url, nome); if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [f] }))) { await navigator.share({ files: [f] }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { if (navigator.share) { await navigator.share({ url: url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    W.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(url), '_blank');
  }
  async function salvarImg(url, nome) {
    if (ehApp()) { compartilharImg(url, nome); return; }   // no app instalado, a gaveta tem "Salvar na galeria / Drive"
    try { var f = await arquivoDe(url, nome), u = URL.createObjectURL(f), a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); }
    catch (e) { W.open(url + (url.indexOf('?') < 0 ? '?' : '&') + 'download=' + encodeURIComponent(nome || 'imagem.jpg'), '_blank'); }
  }
  // tela cheia com SALVAR (esquerda) e COMPARTILHAR (direita), centralizados na barra escura
  W.fastVerImagem = function (url, nome) {
    var v = document.getElementById('fastVisor');
    if (!v) {
      v = document.createElement('div'); v.id = 'fastVisor';
      v.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#000;display:none;flex-direction:column';
      v.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;min-height:0;position:relative"><button type="button" data-fx style="position:absolute;top:calc(10px + env(safe-area-inset-top,0px));right:12px;width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:22px">✕</button><img data-im style="max-width:100%;max-height:100%;object-fit:contain"></div>' +
        '<div style="display:flex;justify-content:center;gap:16px;padding:14px 14px calc(14px + env(safe-area-inset-bottom,0px));background:#111">' +
        '<button type="button" data-sv style="display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px;background:#1f2937;color:#fff;font:800 15px system-ui,sans-serif;white-space:nowrap">⬇ Salvar imagem</button>' +
        '<button type="button" data-sh style="display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px;background:#16a34a;color:#fff;font:800 15px system-ui,sans-serif;white-space:nowrap">⤴ Compartilhar</button></div>';
      document.body.appendChild(v);
      v.querySelector('[data-fx]').onclick = function () { v.style.display = 'none'; };
      v.querySelector('[data-sv]').onclick = function () { salvarImg(v.dataset.url, v.dataset.nome); };
      v.querySelector('[data-sh]').onclick = function () { compartilharImg(v.dataset.url, v.dataset.nome); };
    }
    v.dataset.url = url; v.dataset.nome = nome || ('FAST_' + Date.now() + '.jpg');
    v.querySelector('[data-im]').src = url; v.style.display = 'flex';
  };

  /* ---------------- estilos ---------------- */
  var st = document.createElement('style');
  st.textContent = [
    '#fsupBtn{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9990;border:0;border-radius:999px;padding:12px 16px;font:800 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#fff;background:linear-gradient(135deg,#2563eb,#7c3aed);box-shadow:0 10px 24px rgba(37,99,235,.35);display:flex;align-items:center;gap:8px}',
    '#fsupBtn .n{background:#ef4444;border-radius:999px;min-width:20px;height:20px;padding:0 6px;font-size:12px;display:inline-grid;place-items:center}',
    '#fsupBtn .n[hidden]{display:none!important}#fsupBtn.topo{position:relative;right:auto;bottom:auto;z-index:auto;width:44px;height:44px;padding:0;border-radius:12px;background:rgba(255,255,255,.18);box-shadow:none;font-size:0;color:transparent;display:grid;place-items:center}#fsupBtn.topo::before{content:"🎧";font-size:20px;line-height:1;display:block;color:#fff;margin:0;padding:0;transform:translateY(3px)}#fsupBtn.topo .n{position:absolute;top:-5px;right:-5px;font-size:11px;min-width:18px;height:18px;line-height:18px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff}',
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
  // 5.2.8: se o app tiver um lugar no topo (#fsupSlot), o botão vai para lá, ao lado do menu
  (function topo(n) { var sl = document.getElementById('fsupSlot'); if (sl) { sl.appendChild(btn); btn.classList.add('topo'); btn.title = 'Atendimento'; return; } if (n < 40) setTimeout(function () { topo(n + 1); }, 250); })(0);
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
    if (tel) h += '<button type="button" data-wa style="width:100%;min-height:50px;border:0;border-radius:14px;background:linear-gradient(135deg,#128c7e,#25d366);color:#fff;font:800 16px system-ui,sans-serif;margin-bottom:10px;cursor:pointer">💬 Chamar a FAST no WhatsApp</button>';
    h += '<div class="ct">' +
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
    rodape.innerHTML = '<button type="button" class="bt s" data-wa title="Chamar no WhatsApp" style="flex:0 0 48px;padding:0;font-size:20px">💬</button><button type="button" class="bt s" data-anexo title="Enviar imagem da galeria" style="flex:0 0 48px;padding:0;font-size:20px">📎</button><input type="file" accept="image/*" data-anexo-in hidden><textarea data-resp rows="1" maxlength="2000" placeholder="Escreva sua mensagem…" style="flex:1;min-height:48px"></textarea><button type="button" class="bt" data-resp-env>Enviar</button>';
    var ai = rodape.querySelector('[data-anexo-in]');
    ai.onchange = async function () {
      var f = ai.files && ai.files[0]; ai.value = ''; if (!f || !atual) return;
      var b = rodape.querySelector('[data-anexo]'); b.disabled = true; b.textContent = '⏳';
      try { var u = await subirImagem(f); var leg = (rodape.querySelector('[data-resp]').value || '').trim(); await rpc('suporte_enviar', { p_chave: atual, p_texto: ((leg ? leg + ' ' : '') + '[img]' + u).slice(0, 2000) }); rodape.querySelector('[data-resp]').value = ''; await desenharConversa(); }
      catch (e) { alert(e.message || e); }
      b.disabled = false; b.textContent = '📎';
    };
    await desenharConversa();
    clearInterval(timer); timer = setInterval(function () { if (ov.classList.contains('on') && tela === 'conversa' && !document.hidden) desenharConversa(true); }, 15000);
    try { await rpc('suporte_lidas', { p_chave: chave }); } catch (e) {}
  }
  async function desenharConversa(silencioso) {
    try { dados.lista = await meus(); } catch (e) { if (!silencioso) corpo.innerHTML = '<p class="er">' + esc(e.message) + '</p>'; return; }
    var x = dados.lista.filter(function (c) { return c.chave === atual; })[0]; if (!x) return;
    var fim = corpo.scrollTop + corpo.clientHeight >= corpo.scrollHeight - 30;
    corpo.innerHTML = '<div class="mut" style="margin-bottom:8px"><b>' + esc(x.assunto || 'Atendimento') + '</b> · aberto em ' + quando(x.criado_em) + '</div>' +
      (x.mensagens || []).map(function (m) { return '<div class="msg ' + (m.autor === 'empresa' ? 'e' : 'u') + '">' + textoMsg(m.texto) + '<small>' + (m.autor === 'empresa' ? 'FAST · ' : '') + quando(m.criado_em) + '</small></div>'; }).join('') +
      (x.status === 'fechado' ? '<p class="mut" style="text-align:center">Atendimento encerrado. Se precisar, escreva de novo que ele é reaberto.</p>' : '');
    if (fim || !silencioso) corpo.scrollTop = corpo.scrollHeight;
  }
  ov.addEventListener('click', async function (e) {
    var t = e.target;
    var vi = t.closest && t.closest('[data-ver]'); if (vi) { W.fastVerImagem(vi.getAttribute('data-ver')); return; }
    if (t.closest && t.closest('[data-wa]')) { var at = (dados.lista || []).filter(function (x) { return x.chave === atual; })[0]; W.fastSuporteWhatsApp(at && at.assunto); return; }
    if (t.closest && t.closest('[data-anexo]')) { var inp = rodape.querySelector('[data-anexo-in]'); if (inp) inp.click(); return; }
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
