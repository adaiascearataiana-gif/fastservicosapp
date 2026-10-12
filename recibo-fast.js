/* FAST · RECIBO DE PAGAMENTO (5.3.2) — usado pelo FAST e pelo app do Cliente.
   fastRecibo.abrir(dados)  → tela com o recibo + Imprimir/PDF, Salvar imagem e Compartilhar
   fastRecibo.png(dados)    → Promise<Blob> (imagem do recibo, para enviar no WhatsApp)
   dados = { numero, emitido_em, empresa:{nome,documento,telefone,endereco,logo,chave},
             cliente:{nome,email,telefone}, itens:[{data,origem,destino,valor}], total, forma, referencia, observacao } */
(function (W) {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function brl(v) { return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function dbr(v) { var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[3] + '/' + m[2] + '/' + m[1]; var d = new Date(v); return isNaN(d) ? String(v || '') : d.toLocaleDateString('pt-BR'); }
  function dhr(v) { var d = new Date(v); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR') + ' às ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  // valor por extenso (reais e centavos)
  function extenso(v) {
    var u = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    var d = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    var c = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    function ate999(n) { if (n === 100) return 'cem'; var p = []; if (n >= 100) { p.push(c[Math.floor(n / 100)]); n %= 100; } if (n >= 20) { p.push(d[Math.floor(n / 10)]); n %= 10; if (n) p.push(u[n]); } else if (n) p.push(u[n]); return p.join(' e '); }
    function int(n) { if (!n) return 'zero'; var mil = Math.floor(n / 1000), r = n % 1000, p = []; if (mil) p.push(mil === 1 ? 'mil' : ate999(mil) + ' mil'); if (r) p.push(ate999(r)); return p.join(r && (r < 100 || r % 100 === 0) ? ' e ' : ' '); }
    v = Math.round((Number(v) || 0) * 100); var r = Math.floor(v / 100), ct = v % 100, t = [];
    if (r) t.push(int(r) + (r === 1 ? ' real' : ' reais')); if (ct) t.push(int(ct) + (ct === 1 ? ' centavo' : ' centavos'));
    return t.join(' e ') || 'zero real';
  }
  function html(x) {
    var e = x.empresa || {}, cl = x.cliente || {}, it = x.itens || [];
    return '<div class="frc-doc">' +
      '<div class="frc-top">' + (e.logo ? '<img class="frc-logo" src="' + esc(e.logo) + '" alt="Logo" crossorigin="anonymous">' : '<div class="frc-logo frc-sem">FAST</div>') +
        '<div class="frc-emp"><b>' + esc(e.nome || 'FAST Serviços') + '</b>' + (e.documento ? '<span>CNPJ/CPF: ' + esc(e.documento) + '</span>' : '') + (e.telefone ? '<span>' + esc(e.telefone) + '</span>' : '') + (e.endereco ? '<span>' + esc(e.endereco) + '</span>' : '') + '</div>' +
        '<div class="frc-num"><small>RECIBO</small><b>Nº ' + esc(x.numero || '') + '</b><span>' + dhr(x.emitido_em) + '</span></div></div>' +
      '<div class="frc-valor">' + brl(x.total) + '</div>' +
      '<p class="frc-txt">Recebemos de <b>' + esc(cl.nome || '') + '</b> a importância de <b>' + brl(x.total) + '</b> (' + esc(extenso(x.total)) + '), referente aos serviços de entrega/coleta abaixo, pagos via <b>' + esc(x.forma || 'PIX') + '</b>.</p>' +
      '<table class="frc-tab"><thead><tr><th>Data</th><th>Serviço</th><th style="text-align:right">Valor</th></tr></thead><tbody>' +
        it.map(function (i) { return '<tr><td>' + dbr(i.data) + '</td><td>' + esc([i.origem, i.destino].filter(Boolean).join(' → ')) + '</td><td style="text-align:right">' + brl(i.valor) + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td colspan="2">Total</td><td style="text-align:right">' + brl(x.total) + '</td></tr></tfoot></table>' +
      (x.referencia ? '<p class="frc-ref">Referência do pagamento: ' + esc(x.referencia) + '</p>' : '') + (x.observacao ? '<p class="frc-ref">' + esc(x.observacao) + '</p>' : '') +
      '<div class="frc-ass"><div></div><span>' + esc(e.nome || 'FAST Serviços') + '</span></div>' +
      '<p class="frc-rod">Documento emitido pelo sistema FAST · ' + dhr(x.emitido_em) + '</p></div>';
  }
  var CSS = '.frc-doc{background:#fff;color:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:22px;border-radius:14px}' +
    '.frc-top{display:flex;align-items:center;gap:12px;border-bottom:2px solid #0f766e;padding-bottom:12px}.frc-logo{width:64px;height:64px;object-fit:contain;border-radius:12px}.frc-sem{display:grid;place-items:center;background:#0f766e;color:#fff;font-weight:900}' +
    '.frc-emp{flex:1;display:flex;flex-direction:column;font-size:12px;color:#475569}.frc-emp b{font-size:16px;color:#0f172a}.frc-num{text-align:right;display:flex;flex-direction:column;font-size:12px;color:#475569}.frc-num small{font-weight:900;letter-spacing:2px;color:#0f766e}.frc-num b{font-size:15px;color:#0f172a}' +
    '.frc-valor{margin:16px 0 8px;font-size:30px;font-weight:900;color:#0f766e;text-align:center}.frc-txt{font-size:14px;line-height:1.55}.frc-tab{width:100%!important;min-width:0!important;border-collapse:collapse;font-size:13px;margin-top:10px;table-layout:fixed}.frc-tab th,.frc-tab td{white-space:normal}.frc-tab th{background:#f1f5f9;text-align:left;padding:7px}.frc-tab td{padding:7px;border-bottom:1px solid #eef2f6;overflow-wrap:anywhere;vertical-align:top}.frc-tab th:first-child,.frc-tab td:first-child{width:96px;white-space:nowrap}.frc-tab th:last-child,.frc-tab td:last-child{width:30%;white-space:nowrap}.frc-emp span{overflow-wrap:anywhere}.frc-doc{box-sizing:border-box;padding:18px}.frc-tab tfoot td{font-weight:900;border-top:2px solid #0f172a}' +
    '.frc-ref{font-size:12px;color:#64748b;margin:8px 0 0}.frc-ass{margin:34px auto 6px;width:70%;text-align:center}.frc-ass div{border-top:1px solid #0f172a;margin-bottom:4px}.frc-ass span{font-size:13px;font-weight:700}.frc-rod{text-align:center;font-size:11px;color:#94a3b8;margin-top:14px}' +
    '#frcOv{position:fixed;inset:0;z-index:2147483600;background:#0b1220;display:flex;flex-direction:column}#frcOv .frc-area{flex:1;overflow:auto;padding:14px}#frcOv .frc-bar{display:flex;gap:8px;justify-content:center;padding:12px 12px calc(12px + env(safe-area-inset-bottom,0px));background:#111;flex-wrap:wrap}' +
    '#frcOv .frc-bar button{border:0;border-radius:999px;padding:11px 16px;font:800 14px system-ui,sans-serif;background:#1f2937;color:#fff}#frcOv .frc-bar button.v{background:#16a34a}' +
    '@media print{body>*:not(#frcOv){display:none!important}#frcOv{position:static;background:#fff}#frcOv .frc-bar{display:none}#frcOv .frc-area{padding:0;overflow:visible}}';
  function css() { if (!document.getElementById('frcCss')) { var s = document.createElement('style'); s.id = 'frcCss'; s.textContent = CSS; document.head.appendChild(s); } }
  function carregarImg(u) { return new Promise(function (ok) { if (!u) return ok(null); var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = u; }); }
  async function png(x) {
    var e = x.empresa || {}, cl = x.cliente || {}, it = x.itens || [], W0 = 900, lin = 34, H = 560 + it.length * lin + 80;
    var cv = document.createElement('canvas'); cv.width = W0; cv.height = H; var g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W0, H);
    var logo = await carregarImg(e.logo);
    if (logo) { var k = Math.min(90 / logo.width, 90 / logo.height); g.drawImage(logo, 40, 30, logo.width * k, logo.height * k); }
    else { g.fillStyle = '#0f766e'; g.fillRect(40, 30, 90, 90); g.fillStyle = '#fff'; g.font = '900 26px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('FAST', 85, 84); }
    g.textAlign = 'left'; g.fillStyle = '#0f172a'; g.font = '800 26px system-ui,sans-serif'; g.fillText(e.nome || 'FAST Serviços', 150, 58);
    g.font = '18px system-ui,sans-serif'; g.fillStyle = '#475569'; var yy = 84;
    [e.documento ? 'CNPJ/CPF: ' + e.documento : '', e.telefone || '', e.endereco || ''].filter(Boolean).forEach(function (t) { g.fillText(t.slice(0, 60), 150, yy); yy += 22; });
    g.textAlign = 'right'; g.fillStyle = '#0f766e'; g.font = '900 18px system-ui,sans-serif'; g.fillText('RECIBO', W0 - 40, 50);
    g.fillStyle = '#0f172a'; g.font = '800 22px system-ui,sans-serif'; g.fillText('Nº ' + (x.numero || ''), W0 - 40, 78); g.font = '16px system-ui,sans-serif'; g.fillStyle = '#475569'; g.fillText(dhr(x.emitido_em), W0 - 40, 100);
    var y = Math.max(yy, 130) + 10; g.fillStyle = '#0f766e'; g.fillRect(40, y, W0 - 80, 3);
    y += 64; g.textAlign = 'center'; g.font = '900 46px system-ui,sans-serif'; g.fillText(brl(x.total), W0 / 2, y);
    y += 40; g.textAlign = 'left'; g.fillStyle = '#0f172a'; g.font = '19px system-ui,sans-serif';
    var frase = 'Recebemos de ' + (cl.nome || '') + ' a importância de ' + brl(x.total) + ' (' + extenso(x.total) + '), referente aos serviços abaixo, pagos via ' + (x.forma || 'PIX') + '.';
    var pal = frase.split(' '), l = ''; pal.forEach(function (p) { var t = l ? l + ' ' + p : p; if (g.measureText(t).width > W0 - 80) { g.fillText(l, 40, y); y += 28; l = p; } else l = t; }); if (l) { g.fillText(l, 40, y); y += 28; }
    y += 16; g.fillStyle = '#f1f5f9'; g.fillRect(40, y, W0 - 80, 36); g.fillStyle = '#0f172a'; g.font = '800 17px system-ui,sans-serif'; g.fillText('Data', 52, y + 24); g.fillText('Serviço', 190, y + 24); g.textAlign = 'right'; g.fillText('Valor', W0 - 52, y + 24); y += 36;
    g.font = '17px system-ui,sans-serif';
    it.forEach(function (i) { g.textAlign = 'left'; g.fillStyle = '#0f172a'; g.fillText(dbr(i.data), 52, y + 24); var s0 = [i.origem, i.destino].filter(Boolean).join(' → '); while (g.measureText(s0).width > 520 && s0.length > 4) s0 = s0.slice(0, -2); g.fillText(s0, 190, y + 24); g.textAlign = 'right'; g.fillText(brl(i.valor), W0 - 52, y + 24); g.fillStyle = '#eef2f6'; g.fillRect(40, y + lin, W0 - 80, 1); y += lin; });
    g.fillStyle = '#0f172a'; g.fillRect(40, y + 2, W0 - 80, 2); g.font = '900 19px system-ui,sans-serif'; g.textAlign = 'left'; g.fillText('Total', 52, y + 30); g.textAlign = 'right'; g.fillText(brl(x.total), W0 - 52, y + 30); y += 48;
    if (x.referencia) { g.textAlign = 'left'; g.fillStyle = '#64748b'; g.font = '15px system-ui,sans-serif'; g.fillText('Referência do pagamento: ' + x.referencia, 40, y + 10); y += 24; }
    y += 50; g.fillStyle = '#0f172a'; g.fillRect(W0 * 0.2, y, W0 * 0.6, 1); g.textAlign = 'center'; g.font = '700 17px system-ui,sans-serif'; g.fillText(e.nome || 'FAST Serviços', W0 / 2, y + 24);
    g.fillStyle = '#94a3b8'; g.font = '14px system-ui,sans-serif'; g.fillText('Documento emitido pelo sistema FAST', W0 / 2, y + 52);
    var cv2 = document.createElement('canvas'); cv2.width = W0; cv2.height = Math.min(H, y + 76); cv2.getContext('2d').drawImage(cv, 0, 0);
    return await new Promise(function (ok) { cv2.toBlob(ok, 'image/png'); });
  }
  async function compartilhar(x) {
    var b = await png(x), nome = 'Recibo_FAST_' + String(x.numero || '').replace(/\W+/g, '_') + '.png', f = new File([b], nome, { type: 'image/png' });
    try { if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [f] }))) { await navigator.share({ files: [f], text: 'Recibo FAST nº ' + (x.numero || '') + ' — ' + brl(x.total) }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    baixar(x, b);
  }
  async function baixar(x, b) {
    b = b || await png(x); var nome = 'Recibo_FAST_' + String(x.numero || '').replace(/\W+/g, '_') + '.png';
    if (/FASTAndroid/i.test(navigator.userAgent || '') && navigator.share) { try { await navigator.share({ files: [new File([b], nome, { type: 'image/png' })] }); return; } catch (e) { return; } }
    var u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  function abrir(x) {
    css(); var ov = document.getElementById('frcOv'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'frcOv';
    ov.innerHTML = '<div class="frc-area">' + html(x) + '</div><div class="frc-bar"><button type="button" data-p>🖨 Imprimir / PDF</button><button type="button" data-b>⬇ Salvar imagem</button><button type="button" class="v" data-c>⤴ Compartilhar</button><button type="button" data-x>✕ Fechar</button></div>';
    document.body.appendChild(ov);
    ov.querySelector('[data-x]').onclick = function () { ov.remove(); };
    ov.querySelector('[data-p]').onclick = function () { W.print(); };
    ov.querySelector('[data-b]').onclick = function () { baixar(x); };
    ov.querySelector('[data-c]').onclick = function () { compartilhar(x); };
  }
  W.fastRecibo = { abrir: abrir, png: png, html: html, extenso: extenso };
})(window);
