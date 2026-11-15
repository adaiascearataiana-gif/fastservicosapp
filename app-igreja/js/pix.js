/* ============================================================
   PIX — gera o código "copia e cola" e o QR Code (offline)
   ============================================================ */
(function () {
  function tlv(id, valor) {
    var tam = String(valor).length;
    return id + ('0' + tam).slice(-2) + valor;
  }

  function crc16(texto) {
    var crc = 0xFFFF;
    for (var i = 0; i < texto.length; i++) {
      crc ^= texto.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
      }
    }
    return ('000' + crc.toString(16).toUpperCase()).slice(-4);
  }

  function semAcento(txt) {
    return String(txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function normaliza(txt) {
    return semAcento(txt).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function limparChave(chave, tipo) {
    var c = String(chave || '').trim();
    if (!c) return '';
    var t = semAcento(String(tipo || '')).toLowerCase();
    if (t.indexOf('telefone') >= 0 || t.indexOf('celular') >= 0 || t.indexOf('whats') >= 0) {
      var d = c.replace(/\D/g, '');
      if (d.length <= 11) d = '55' + d;
      return '+' + d;
    }
    if (t.indexOf('cpf') >= 0 || t.indexOf('cnpj') >= 0) return c.replace(/\D/g, '');
    if (t.indexOf('email') >= 0 || t.indexOf('e-mail') >= 0) return c.toLowerCase();
    return c;
  }

  function validar(chave, tipo) {
    var c = String(chave || '').trim();
    if (!c) return 'Informe a chave PIX da igreja.';
    var t = semAcento(String(tipo || '')).toLowerCase();
    if (t.indexOf('telefone') >= 0 || t.indexOf('celular') >= 0) {
      var d = c.replace(/\D/g, '');
      if (d.length < 10 || d.length > 13) return 'O telefone da chave PIX deve ter DDD + número (ex.: 85999998888).';
      return '';
    }
    if (t.indexOf('cpf') >= 0) return c.replace(/\D/g, '').length === 11 ? '' : 'O CPF deve ter 11 números.';
    if (t.indexOf('cnpj') >= 0) return c.replace(/\D/g, '').length === 14 ? '' : 'O CNPJ deve ter 14 números.';
    if (t.indexOf('email') >= 0) return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) ? '' : 'Digite um e-mail válido para a chave PIX.';
    if (t.indexOf('aleat') >= 0) return c.length >= 30 ? '' : 'A chave aleatória costuma ter 36 caracteres.';
    return '';
  }

  function montarPayload(cfg) {
    cfg = cfg || {};
    var chave = limparChave(cfg.chave, cfg.tipo);
    if (!chave) return '';
    var nome = (normaliza(cfg.nome) || 'IGREJA').slice(0, 25);
    var cidade = (normaliza(cfg.cidade) || 'BRASIL').slice(0, 15);
    var mai = tlv('00', 'br.gov.bcb.pix') + tlv('01', chave);
    if (cfg.descricao) mai += tlv('02', normaliza(cfg.descricao).slice(0, 40));
    var p = tlv('00', '01');
    p += tlv('26', mai);
    p += tlv('52', '0000');
    p += tlv('53', '986');
    var valor = Number(String(cfg.valor || '').replace(',', '.'));
    if (valor > 0) p += tlv('54', valor.toFixed(2));
    p += tlv('58', 'BR');
    p += tlv('59', nome);
    p += tlv('60', cidade);
    var txid = String(cfg.txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
    p += tlv('62', tlv('05', txid));
    p += '6304';
    return p + crc16(p);
  }

  function qrSvg(texto, opcoes) {
    opcoes = opcoes || {};
    if (!texto || typeof window.qrcode !== 'function') return '';
    var qr;
    try {
      qr = window.qrcode(0, opcoes.nivel || 'M');
      qr.addData(texto);
      qr.make();
    } catch (e) {
      return '';
    }
    var n = qr.getModuleCount();
    var calado = 2;
    var total = n + calado * 2;
    var caminho = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) caminho += 'M' + (c + calado) + ' ' + (r + calado) + 'h1v1h-1z';
      }
    }
    var cor = opcoes.cor || '#0d2b22';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total +
      '" shape-rendering="crispEdges" role="img" aria-label="QR Code para pagamento por PIX">' +
      '<rect width="' + total + '" height="' + total + '" fill="#ffffff"/>' +
      '<path d="' + caminho + '" fill="' + cor + '"/>' +
      '</svg>';
  }

  /* Formata a chave só para mostrar na tela (não altera o que é enviado) */
  function bonita(chave, tipo) {
    var c = String(chave || '');
    var t = semAcento(String(tipo || '')).toLowerCase();
    if (t.indexOf('cpf') >= 0) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (t.indexOf('cnpj') >= 0) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (t.indexOf('telefone') >= 0 || t.indexOf('celular') >= 0) {
      var d = c.replace(/\D/g, '');
      if (d.length === 13 && d.slice(0, 2) === '55') d = d.slice(2);
      if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
      if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
      return c;
    }
    return c;
  }

  window.IBNM.PIX = {
    crc16: crc16,
    limparChave: limparChave,
    validar: validar,
    montarPayload: montarPayload,
    qrSvg: qrSvg,
    bonita: bonita
  };
})();
