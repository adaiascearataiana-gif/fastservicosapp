/* FAST 5.3.9 — COLAR ENDEREÇO
   Reconhecimento local de endereços brasileiros copiados do WhatsApp.
   Nenhum texto é enviado a serviço externo. A leitura da área de transferência
   só acontece após um toque explícito no botão; há colagem manual como reserva. */
(function () {
  'use strict';

  function texto(v) { return String(v == null ? '' : v); }
  function spaces(v) { return texto(v).replace(/\s+/g, ' ').trim(); }
  function semAcentos(v) { return texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function limparLinha(v) {
    return spaces(texto(v)
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/^\s*\[?\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-–—]?\s*[^:\n]{1,60}:\s*/,'')
      .replace(/[*_~`]/g, '')
      .replace(/^[\s•◦▪▫\-–—>]+/,'')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/^["'“”]+|["'“”]+$/g, ''));
  }
  function rotulo(linha, nomes) {
    var re = new RegExp('^(?:' + nomes + ')\\s*[:：=\\-–]\\s*(.*)$', 'i');
    var m = linha.match(re);
    return m ? spaces(m[1]) : null;
  }
  function acharCep(v) {
    var m = texto(v).match(/\b(?:cep\s*[:：=]?\s*)?(\d{5})-?(\d{3})\b/i);
    return m ? m[1] + '-' + m[2] : '';
  }
  function removerCep(v) {
    return spaces(texto(v).replace(/\bcep\s*[:：=]?\s*\d{5}-?\d{3}\b/ig, '').replace(/\b\d{5}-?\d{3}\b/g, '').replace(/[,\s]+$/,'').replace(/^[,\s]+/,''));
  }
  function acharCidade(v) {
    var m = texto(v).match(/\b([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.-]{1,50}?)\s*[-\/]\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i);
    return m ? spaces(m[1]) + ' - ' + m[2].toUpperCase() : '';
  }
  function removerCidade(v) {
    return spaces(texto(v).replace(/\b[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.-]{1,50}?\s*[-\/]\s*(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/ig, '').replace(/[,\s]+$/,''));
  }
  var TIPOS = '(?:rua|r\\.|avenida|av\\.?|travessa|tv\\.?|rodovia|rod\\.?|estrada|est\\.?|alameda|al\\.?|praça|praca|largo|via|viela|vila|quadra|conjunto|residencial|logradouro)';
  function pareceRua(v) { return new RegExp('\\b' + TIPOS + '\\b', 'i').test(semAcentos(v).replace(/\./g, '')) || new RegExp('\\b' + TIPOS + '\\b', 'i').test(v); }
  function pareceComplemento(v) { return /^(casa|apto?\.?|apartamento|bloco|quadra|lote|fundos|sala|loja|andar|km)\b/i.test(semAcentos(v)); }
  function limparPontas(v) { return spaces(texto(v).replace(/^[\s,;:-]+|[\s,;:-]+$/g, '')); }

  // Exposto para os campos de cadastro: não duplica um número já presente.
  function juntarNumero(endereco, numero) {
    var e = limparPontas(endereco), n = spaces(numero);
    if (!n) return e;
    var escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(?:^|[,\\s])(?:n[º°.u]?|n[úu]mero|num\\.?|casa)?\\s*[:.]?\\s*' + escaped + '(?:\\s|$|,)', 'i');
    if (re.test(e)) return e;
    return e ? e + ', ' + n : n;
  }
  function separarNumero(endereco) {
    var e = spaces(endereco), numero = '';
    var m = e.match(/(?:,\s*|\s+)(?:n[º°.u]?|n[úu]mero|num\.?|casa)\s*[:.]?\s*(\d{1,6}[A-Za-z]?(?:\s*[-\/]\s*\d{1,6})?|s\/?n\b|sem\s+n[úu]mero\b)/i);
    if (!m) m = e.match(/,\s*(\d{1,6}[A-Za-z]?(?:\s*[-\/]\s*\d{1,6})?)\s*(?=\s*(?:,|[-–—]|$))/);
    if (!m) m = e.match(/\b(s\/?n|sem\s+n[úu]mero)\b/i);
    if (m) {
      numero = spaces(m[1]);
      e = limparPontas(e.slice(0, m.index) + ' ' + e.slice(m.index + m[0].length));
    }
    return { logradouro: e, numero: numero };
  }

  function reconhecer(entrada) {
    var original = texto(entrada).replace(/\r\n?/g, '\n').slice(0, 6000);
    // Rótulos no meio da linha ("Rua X, 123 - Bairro: Centro") viram linhas próprias.
    original = original.replace(/[,;\-–—]?\s*\b(bairro|n[úu]mero|numero|cep|complemento|refer[êe]ncia|cidade)\s*[:：=]\s*/gi, '\n$1: ');
    var linhas = original.split('\n').map(limparLinha).filter(Boolean);
    var out = { logradouro: '', numero: '', bairro: '', complemento: '', referencia: '', cidadeUf: '', cep: '', destino: '', avisos: [] };
    var endLinhas = [], candidatos = [], soltos = [];
    var reNum = /^(?:n[º°.u]|n[úu]mero|numero|num\.?|casa)\s*[:：=.\-]?\s*(.+)$/i;
    var reBairro = /^(?:bairro|b\.?º?|setor|distrito)\s*[:：=.\-]\s*(.+)$/i;
    var reComp = /^(?:complemento|comp\.?)\s*[:：=.\-]\s*(.+)$/i;
    var reRef = /^(?:refer[êe]ncia|ponto\s+de\s+refer[êe]ncia|pr[óo]ximo\s+a|perto\s+de)\s*[:：=.\-]?\s*(.+)$/i;
    var reCidade = /^(?:cidade|munic[íi]pio|cidade\/uf)\s*[:：=.\-]\s*(.+)$/i;
    var reCep = /^cep\s*[:：=.\-]?\s*(.+)$/i;
    var reEnd = /^(?:endere[çc]o|end\.?|logradouro)\s*[:：=.\-]\s*(.+)$/i;
    var reIgnore = /^(?:bom\s+dia|boa\s+tarde|boa\s+noite|oi|ol[áa]|cliente|nome|contato|telefone|fone|whatsapp|celular|obs(?:erva[çc][ãa]o)?|pedido|valor|entregar|coletar)\b/i;

    linhas.forEach(function (linha) {
      var m;
      if ((m = linha.match(reNum))) { out.numero = spaces(m[1]); return; }
      if ((m = linha.match(reBairro))) { out.bairro = spaces(m[1]); return; }
      if ((m = linha.match(reComp))) { out.complemento = spaces(m[1]); return; }
      if ((m = linha.match(reRef))) { out.referencia = spaces(m[1]); return; }
      if ((m = linha.match(reCidade))) { out.cidadeUf = spaces(m[1]); return; }
      if ((m = linha.match(reCep))) { out.cep = acharCep(m[1]) || spaces(m[1]); return; }
      if ((m = linha.match(reEnd))) { if (m[1]) endLinhas.push(m[1]); return; }
      if (reIgnore.test(semAcentos(linha))) return;
      if (/^\d{1,6}[A-Za-z]?$/.test(linha)) { soltos.push(linha); return; }
      if (pareceRua(linha) || /,/.test(linha)) candidatos.push(linha);
      else soltos.push(linha);
    });

    var cep = out.cep || acharCep(original);
    out.cep = cep;
    var cidade = out.cidadeUf || acharCidade(original);
    out.cidadeUf = cidade;
    var bruto = endLinhas.length ? endLinhas.join(', ') : (candidatos[0] || '');
    if (!bruto && soltos.length) bruto = soltos[0];
    bruto = removerCidade(removerCep(bruto));

    // Número explicitado no próprio texto: "Rua X, nº 123" / "Rua X - S/N".
    var numExtraido = separarNumero(bruto);
    if (!out.numero && numExtraido.numero) out.numero = numExtraido.numero;
    if (numExtraido.numero) bruto = numExtraido.logradouro;
    if (!out.numero && soltos.length && /^\d{1,6}[A-Za-z]?$/.test(soltos[0])) out.numero = soltos.shift();

    var partes = bruto.split(/\s+[-–—]\s+|[,;]\s*/).map(limparPontas).filter(Boolean);
    // "Rua X 123" sem vírgula: só infere no primeiro trecho (a via), quando há
    // nome depois do tipo. Não confunde o bairro/cidade que vem depois do hífen.
    if (!out.numero && partes.length) {
      var via = partes[0], mt = via.match(/\s+(\d{1,6}[A-Za-z]?)\s*$/);
      if (mt && pareceRua(via) && spaces(via.slice(0, mt.index)).split(/\s+/).length >= 3) {
        out.numero = mt[1]; partes[0] = limparPontas(via.slice(0, mt.index));
      }
    }
    out.logradouro = partes.shift() || '';
    if (!out.bairro) {
      while (partes.length) {
        var p = partes[0];
        if (pareceComplemento(p)) { out.complemento = out.complemento ? out.complemento + ', ' + p : p; partes.shift(); continue; }
        if (acharCidade(p) || /^(?:fortaleza|caucaia|maracana[úu]|eusebio|aquiraz|itaitinga|pacatuba|s[ãa]o\s+gon[çc]alo)\b/i.test(semAcentos(p)) && partes.length > 1) { partes.shift(); continue; }
        out.bairro = partes.shift(); break;
      }
    } else {
      partes.forEach(function (p) { if (pareceComplemento(p) && !out.complemento) out.complemento = p; });
    }
    if (!out.logradouro && out.bairro && pareceRua(out.bairro)) { out.logradouro = out.bairro; out.bairro = ''; }
    if (!out.bairro) {
      var bairroSolto = soltos.filter(function (x) { return !/^\d/.test(x) && !pareceComplemento(x) && x.length > 2; })[0];
      if (bairroSolto) out.bairro = bairroSolto;
    }
    if (!out.complemento) {
      var sobra = soltos.filter(function (x) { return pareceComplemento(x); })[0];
      if (sobra) out.complemento = sobra;
    }
    if (/^s\/?n$/i.test(out.numero)) out.numero = 'S/N';
    if (/^sem\s+n[úu]mero$/i.test(out.numero)) out.numero = 'S/N';
    out.logradouro = limparPontas(out.logradouro);
    out.bairro = limparPontas(out.bairro);
    out.numero = spaces(out.numero);
    out.complemento = limparPontas(out.complemento);
    out.referencia = limparPontas(out.referencia);
    out.cidadeUf = limparPontas(out.cidadeUf);
    out.destino = montar(out);
    if (!out.logradouro) out.avisos.push('Não identifiquei a rua/avenida. Cole a mensagem ou preencha o endereço.');
    if (!out.numero) out.avisos.push('Número não identificado — preencha ou use S/N.');
    if (!out.bairro) out.avisos.push('Bairro não identificado — confira antes de salvar.');
    return out;
  }

  function montar(c) {
    c = c || {};
    var e = juntarNumero(c.logradouro || '', c.numero || '');
    if (c.complemento) e = e ? e + ', ' + c.complemento : c.complemento;
    if (c.bairro) e = e ? e + ' - ' + c.bairro : c.bairro;
    if (c.cidadeUf) e = e ? e + ', ' + c.cidadeUf : c.cidadeUf;
    return limparPontas(e);
  }

  var API = { reconhecer: reconhecer, montar: montar, juntarNumero: juntarNumero, separarNumero: separarNumero };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  var W = window, D = document;
  W.FastEndereco = API;

  function el(id) { return D.getElementById(id); }
  function toast(msg, tipo) { try { if (typeof W.mostrarToast === 'function') W.mostrarToast(msg, tipo || 'info'); } catch (e) {} }
  function areaDo(inp) {
    try { return typeof W.fast538DestinoRotasMontar === 'function' ? W.fast538DestinoRotasMontar(inp) : (inp.__f538area || null); } catch (e) { return inp.__f538area || null; }
  }
  function setArea(inp, c) {
    var a = areaDo(inp); if (!a) return;
    var end = a.querySelector('.f538-dest-end'), num = a.querySelector('.f538-dest-num'), bai = a.querySelector('.f538-dest-bai');
    if (end) end.value = API.juntarNumero(c.logradouro, c.numero) + (c.complemento ? ', ' + c.complemento : '');
    if (num) num.value = c.numero || '';
    if (bai) bai.value = c.bairro || '';
    a.dataset.fastEnderecoObj = JSON.stringify({ logradouro: c.logradouro || '', numero: c.numero || '', bairro: c.bairro || '', complemento: c.complemento || '', cidadeUf: c.cidadeUf || '', cep: c.cep || '', referencia: c.referencia || '' });
    try { if (typeof W.fast538DestinoRotasAtualizar === 'function') W.fast538DestinoRotasAtualizar(inp, true); } catch (e) {}
  }
  function destinoVazio(grupo) {
    var principal, extras, adicionar;
    if (grupo === 'seq') { principal = el('seqDestino'); extras = '#containerDestinosExtras .destino-extra-input'; adicionar = W.adicionarDestinoExtra; }
    else if (grupo === 'rota') { principal = el('txtDestino'); extras = '#containerDestinosExtrasRota .destino-extra-rota-input'; adicionar = W.adicionarDestinoExtraRota; }
    else if (grupo === 'edit') return el('editTxtDestino');
    else return null;
    if (principal && !principal.value.trim()) return principal;
    var vazio = Array.prototype.find.call(D.querySelectorAll(extras), function (i) { return !i.value.trim(); });
    if (vazio) return vazio;
    if (typeof adicionar === 'function') adicionar();
    var todos = D.querySelectorAll(extras); return todos[todos.length - 1] || principal;
  }
  function aplicar(grupo, c) {
    var destino = API.montar(c);
    if (grupo === 'destino') {
      var nome = el('editDestinoNome'), end = el('editDestinoEndereco'), num = el('editDestinoNumero'), bai = el('editDestinoBairro');
      if (nome && !nome.value.trim()) nome.value = destino;
      if (end) end.value = API.juntarNumero(c.logradouro, c.numero) + (c.complemento ? ', ' + c.complemento : '');
      if (num) num.value = c.numero || '';
      if (bai) bai.value = c.bairro || '';
      [nome, end, num, bai].forEach(function (i) { if (i) i.dispatchEvent(new Event('input', { bubbles: true })); });
      return;
    }
    var inp = destinoVazio(grupo); if (!inp) return;
    inp.value = destino;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    setArea(inp, c);
    try { if (grupo === 'seq' && typeof W.atualizarPreviewAba2 === 'function') W.atualizarPreviewAba2(); } catch (e) {}
    try { if (grupo === 'rota' && typeof W.atualizarPreviewAba1 === 'function') W.atualizarPreviewAba1(); } catch (e) {}
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
  }

  var modal = null, alvoGrupo = '', ultimoFoco = null, tParse = 0;
  function fechar() {
    if (modal) modal.remove(); modal = null;
    D.removeEventListener('keydown', teclas, true);
    try { if (ultimoFoco && D.contains(ultimoFoco)) ultimoFoco.focus(); } catch (e) {}
  }
  function teclas(e) {
    if (!modal) return;
    if (e.key === 'Escape') { e.preventDefault(); fechar(); return; }
    if (e.key !== 'Tab') return;
    var f = modal.querySelectorAll('button:not([disabled]),textarea,input');
    if (!f.length) return;
    var primeiro = f[0], ultimo = f[f.length - 1];
    if (e.shiftKey && D.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && D.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  }
  function campos() {
    return {
      logradouro: el('fastColarEndereco').value.trim(), numero: el('fastColarNumero').value.trim(),
      bairro: el('fastColarBairro').value.trim(), complemento: el('fastColarComplemento').value.trim(),
      cidadeUf: el('fastColarCidade').value.trim(), cep: el('fastColarCep').value.trim(), referencia: ''
    };
  }
  function previa() {
    if (!modal) return;
    var c = campos(), p = el('fastColarPreview');
    p.textContent = API.montar(c) || 'O endereço reconhecido aparecerá aqui.';
    var faltas = []; if (!c.numero) faltas.push('número'); if (!c.bairro) faltas.push('bairro');
    el('fastColarFaltas').textContent = faltas.length ? 'Confira: ' + faltas.join(' e ') + '. Você pode corrigir antes de usar.' : '';
  }
  function reconhecerTexto(manual) {
    if (!modal) return;
    var raw = el('fastColarTexto').value, c = API.reconhecer(raw);
    el('fastColarEndereco').value = c.logradouro;
    el('fastColarNumero').value = c.numero;
    el('fastColarBairro').value = c.bairro;
    el('fastColarComplemento').value = c.complemento;
    el('fastColarCidade').value = c.cidadeUf;
    el('fastColarCep').value = c.cep;
    var st = el('fastColarStatus');
    st.textContent = c.logradouro ? (c.avisos.length ? c.avisos.join(' ') : 'Endereço reconhecido. Confira os campos antes de usar.') : (manual ? 'Texto lido. Preencha os campos abaixo.' : 'Não foi possível ler automaticamente. Toque no campo abaixo e cole a mensagem.');
    st.className = 'fast-colar-status' + (c.logradouro && !c.avisos.length ? ' ok' : '');
    previa();
  }
  function abrir(grupo, raw, origem) {
    if (modal) fechar();
    alvoGrupo = grupo; ultimoFoco = D.activeElement;
    modal = D.createElement('div');
    modal.className = 'fast-colar-overlay';
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'fastColarTitulo');
    modal.innerHTML =
      '<div class="fast-colar-box">' +
        '<div class="fast-colar-head"><h3 id="fastColarTitulo">📋 COLAR ENDEREÇO</h3><button type="button" class="fast-colar-x" data-fechar aria-label="Fechar">✕</button></div>' +
        '<p class="fast-colar-ajuda">Copie a mensagem do WhatsApp e toque em COLAR ENDEREÇO. O FAST separa rua, número e bairro para você conferir.</p>' +
        '<label for="fastColarTexto">Mensagem copiada</label>' +
        '<textarea id="fastColarTexto" rows="3" placeholder="Cole aqui: Rua Exemplo, 123 - Centro&#10;Número: 123&#10;Bairro: Centro"></textarea>' +
        '<div class="fast-colar-acoes-top"><button type="button" class="btn-secondary" data-reconhecer>Reconhecer texto</button><span id="fastColarStatus" class="fast-colar-status" role="status" aria-live="polite"></span></div>' +
        '<div class="fast-colar-grid">' +
          '<div class="fast-colar-full"><label for="fastColarEndereco">Endereço (rua/avenida)</label><input id="fastColarEndereco" type="text" autocomplete="off" placeholder="Rua Exemplo"></div>' +
          '<div><label for="fastColarNumero">Número</label><input id="fastColarNumero" type="text" autocomplete="off" placeholder="123 ou S/N"></div>' +
          '<div><label for="fastColarBairro">Bairro</label><input id="fastColarBairro" type="text" autocomplete="off" placeholder="Centro"></div>' +
          '<div class="fast-colar-full"><label for="fastColarComplemento">Complemento</label><input id="fastColarComplemento" type="text" autocomplete="off" placeholder="Casa A, Bloco 2, Apto 101..."></div>' +
          '<div><label for="fastColarCidade">Cidade/UF</label><input id="fastColarCidade" type="text" autocomplete="off" placeholder="Fortaleza - CE"></div>' +
          '<div><label for="fastColarCep">CEP</label><input id="fastColarCep" type="text" inputmode="numeric" autocomplete="off" placeholder="60000-000"></div>' +
        '</div>' +
        '<div id="fastColarPreview" class="fast-colar-preview"></div><div id="fastColarFaltas" class="fast-colar-faltas"></div>' +
        '<div class="fast-colar-acoes"><button type="button" class="btn-secondary" data-fechar>Cancelar</button><button type="button" class="btn-primary" data-usar>Usar endereço</button></div>' +
      '</div>';
    D.body.appendChild(modal);
    D.addEventListener('keydown', teclas, true);
    modal.addEventListener('click', function (e) { if (e.target === modal || e.target.closest('[data-fechar]')) fechar(); });
    modal.querySelector('[data-reconhecer]').addEventListener('click', function () { reconhecerTexto(true); });
    modal.querySelector('[data-usar]').addEventListener('click', function () {
      var c = campos();
      if (!c.logradouro) { el('fastColarStatus').textContent = 'Informe a rua/avenida antes de usar.'; el('fastColarEndereco').focus(); return; }
      aplicar(alvoGrupo, c); fechar(); toast('Endereço preenchido. Confira e salve a rota.', 'success');
    });
    el('fastColarTexto').value = raw || '';
    ['fastColarEndereco', 'fastColarNumero', 'fastColarBairro', 'fastColarComplemento', 'fastColarCidade', 'fastColarCep'].forEach(function (id) { el(id).addEventListener('input', previa); });
    el('fastColarTexto').addEventListener('input', function () { clearTimeout(tParse); tParse = setTimeout(function () { reconhecerTexto(true); }, 350); });
    if (raw) reconhecerTexto(false);
    else { el('fastColarStatus').textContent = origem === 'manual' ? 'Toque no campo e cole a mensagem do WhatsApp.' : 'Não consegui acessar a área de transferência. Cole a mensagem no campo abaixo.'; }
    setTimeout(function () { try { (raw ? el('fastColarEndereco') : el('fastColarTexto')).focus(); } catch (e) {} }, 40);
    previa();
  }
  function colar(grupo, botao) {
    if (botao) botao.disabled = true;
    var prom;
    try { prom = W.navigator.clipboard && W.navigator.clipboard.readText ? W.navigator.clipboard.readText() : Promise.reject(new Error('clipboard indisponível')); }
    catch (e) { prom = Promise.reject(e); }
    Promise.resolve(prom).then(function (raw) { abrir(grupo, texto(raw).trim(), 'clipboard'); }, function () { abrir(grupo, '', 'manual'); }).finally(function () { if (botao) botao.disabled = false; });
  }
  W.fastColarEndereco = colar;

  function estilo() {
    if (el('fast-colar-css')) return;
    var s = D.createElement('style'); s.id = 'fast-colar-css';
    s.textContent = '.fast-colar-btn{min-height:42px;border:1px solid #16a34a!important;background:rgba(22,163,74,.1)!important;color:#15803d!important;font-weight:800!important;gap:7px}.fast-colar-overlay{position:fixed;inset:0;z-index:2147483200;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:14px;overflow:auto}.fast-colar-box{width:min(560px,100%);max-height:calc(100dvh - 28px);overflow:auto;background:var(--bg-card,#fff);color:var(--text,#0f172a);border-radius:18px;padding:18px;box-shadow:0 18px 60px rgba(0,0,0,.35)}.fast-colar-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.fast-colar-head h3{margin:0;font-size:18px}.fast-colar-x{border:0;background:transparent;color:inherit;font-size:20px;min-width:40px;min-height:40px;cursor:pointer}.fast-colar-ajuda{font-size:13px;line-height:1.45;opacity:.8;margin:8px 0 12px}.fast-colar-box label{display:block;font-size:12px;font-weight:800;margin:0 0 5px}.fast-colar-box textarea,.fast-colar-box input{width:100%;box-sizing:border-box;border:1px solid var(--border,#cbd5e1);border-radius:10px;background:var(--bg-input,#fff);color:inherit;padding:10px 12px;font:inherit;min-height:42px}.fast-colar-box textarea{resize:vertical;min-height:82px}.fast-colar-acoes-top{display:flex;align-items:center;gap:10px;margin:8px 0 14px;flex-wrap:wrap}.fast-colar-status{font-size:12px;line-height:1.4;flex:1;min-width:180px;color:#92400e}.fast-colar-status.ok{color:#15803d}.fast-colar-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fast-colar-full{grid-column:1/-1}.fast-colar-preview{margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(22,163,74,.1);font-size:13px;font-weight:700;line-height:1.45}.fast-colar-faltas{font-size:12px;color:#92400e;margin-top:6px;min-height:16px}.fast-colar-acoes{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}.fast-colar-acoes button{min-height:44px}@media(max-width:420px){.fast-colar-grid{grid-template-columns:1fr}.fast-colar-full{grid-column:auto}.fast-colar-box{padding:14px}.fast-colar-acoes{flex-direction:column-reverse}.fast-colar-acoes button{width:100%}}body.dark-mode .fast-colar-status,body.dark-mode .fast-colar-faltas,[data-theme="dark"] .fast-colar-status,[data-theme="dark"] .fast-colar-faltas{color:#fcd34d}body.dark-mode .fast-colar-status.ok,[data-theme="dark"] .fast-colar-status.ok{color:#86efac}body.dark-mode .fast-colar-btn,[data-theme="dark"] .fast-colar-btn{color:#86efac!important}';
    D.head.appendChild(s);
  }
  function montarBotoes() {
    estilo();
    [['seq', 'fastColarEnderecoSeq'], ['rota', 'fastColarEnderecoRota'], ['edit', 'fastColarEnderecoEdit'], ['destino', 'fastColarEnderecoDestino']].forEach(function (cfg) {
      var b = el(cfg[1]); if (!b || b.__fastColar) return;
      b.__fastColar = true; b.classList.add('fast-colar-btn');
      b.addEventListener('click', function () { colar(cfg[0], b); });
    });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', montarBotoes); else montarBotoes();
  W.addEventListener('load', montarBotoes);
})();
