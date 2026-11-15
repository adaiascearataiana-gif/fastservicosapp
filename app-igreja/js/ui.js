/* ============================================================
   Utilitários de tela: textos, datas, avisos, janelas e letras
   ============================================================ */
(function () {
  var UI = {};

  UI.$ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  UI.$$ = function (sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); };

  UI.esc = function (v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  };

  /* ---------- datas ---------- */
  UI.DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  UI.DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  UI.MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  UI.hojeISO = function () {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  UI.iso = function (d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  UI.deISO = function (iso) {
    if (!iso) return null;
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return null;
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  };

  UI.dataBR = function (iso) {
    var d = UI.deISO(iso);
    if (!d) return '—';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  };

  UI.dataCurta = function (iso) {
    var d = UI.deISO(iso);
    if (!d) return { dia: '—', mes: '' };
    return { dia: String(d.getDate()).padStart(2, '0'), mes: UI.MESES[d.getMonth()].slice(0, 3).toUpperCase() };
  };

  UI.dataLonga = function (iso) {
    var d = UI.deISO(iso);
    if (!d) return '';
    return UI.DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + UI.MESES[d.getMonth()];
  };

  UI.hora = function (h) {
    if (!h) return '';
    var p = String(h).split(':');
    var hh = p[0];
    var mm = p[1] || '00';
    return mm === '00' ? hh + 'h' : hh + 'h' + mm;
  };

  UI.money = function (n) {
    return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  UI.numero = function (v) {
    if (v === null || v === undefined || v === '') return 0;
    var s = String(v).replace(/[^\d,.-]/g, '');
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.indexOf(',') >= 0) s = s.replace(',', '.');
    return Number(s) || 0;
  };

  UI.primeiroNome = function (nome) {
    var n = String(nome || '').trim();
    if (!n) return '';
    return n.split(/\s+/)[0];
  };

  UI.saudacao = function () {
    var h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  UI.capitalizar = function (t) {
    return String(t || '').replace(/(^|\s)([a-zà-ú])/g, function (m, a, b) { return a + b.toUpperCase(); });
  };

  /* ---------- categorias de eventos ---------- */
  UI.CATEGORIAS = {
    culto: { nome: 'Culto', em: '⛪' },
    programacao: { nome: 'Programação', em: '📅' },
    atividade: { nome: 'Atividade', em: '🤝' },
    reuniao: { nome: 'Reunião', em: '👥' },
    especial: { nome: 'Especial', em: '✨' }
  };
  UI.catNome = function (c) { return (UI.CATEGORIAS[c] || UI.CATEGORIAS.programacao).nome; };
  UI.catEm = function (c) { return (UI.CATEGORIAS[c] || UI.CATEGORIAS.programacao).em; };

  /* ---------- avisos rápidos ---------- */
  var tToast;
  UI.toast = function (msg, ms) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(tToast);
    tToast = setTimeout(function () { el.classList.remove('on'); }, ms || 2800);
  };

  /* ---------- janela (folha) ---------- */
  var folhaAtual = null;
  UI.fecharFolha = function () {
    var m = document.getElementById('modal');
    if (!m) return;
    m.hidden = true;
    m.innerHTML = '';
    document.body.style.overflow = '';
    folhaAtual = null;
  };

  UI.abrirFolha = function (opcoes) {
    opcoes = opcoes || {};
    var m = document.getElementById('modal');
    if (!m) return;
    m.className = 'modal' + (opcoes.caixa ? ' caixa' : '');
    m.innerHTML =
      '<div class="folha" role="dialog" aria-modal="true">' +
      (opcoes.caixa ? '' : '<div class="puxador"></div>') +
      (opcoes.titulo ? '<h3>' + UI.esc(opcoes.titulo) + '</h3>' : '') +
      (opcoes.sub ? '<p class="sub">' + UI.esc(opcoes.sub) + '</p>' : '') +
      '<div id="folhaConteudo">' + (opcoes.html || '') + '</div>' +
      '</div>';
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    folhaAtual = opcoes;
    m.onclick = function (ev) {
      if (ev.target === m && opcoes.fecharFora !== false) UI.fecharFolha();
    };
    if (typeof opcoes.montar === 'function') {
      setTimeout(function () { opcoes.montar(document.getElementById('folhaConteudo')); }, 0);
    }
    return document.getElementById('folhaConteudo');
  };

  UI.confirmar = function (titulo, texto, rotuloOk, perigo) {
    return new Promise(function (resolver) {
      UI.abrirFolha({
        caixa: true, fecharFora: false, titulo: titulo,
        html: '<p style="margin:0 0 4px;color:var(--muted);font-size:.9rem;line-height:1.5">' + UI.esc(texto) + '</p>' +
          '<div class="folha-acoes">' +
          '<button class="btn btn-sec" id="cfNao">Cancelar</button>' +
          '<button class="btn ' + (perigo ? 'btn-perigo' : 'btn-primario') + '" id="cfSim">' + UI.esc(rotuloOk || 'Confirmar') + '</button>' +
          '</div>'
      });
      document.getElementById('cfNao').onclick = function () { UI.fecharFolha(); resolver(false); };
      document.getElementById('cfSim').onclick = function () { UI.fecharFolha(); resolver(true); };
    });
  };

  /* ---------- tamanho da letra ---------- */
  var FONTES = ['Pequeno', 'Normal', 'Grande', 'Muito grande'];
  UI.fonteAtual = function () {
    var n = Number(localStorage.getItem('ibnm.fonte') || 2);
    return (n >= 1 && n <= 4) ? n : 2;
  };
  UI.aplicarFonte = function (n) {
    n = Math.min(4, Math.max(1, Number(n) || 2));
    document.documentElement.setAttribute('data-fonte', String(n));
    try { localStorage.setItem('ibnm.fonte', String(n)); } catch (e) {}
    return n;
  };
  UI.escolherFonte = function () {
    var atual = UI.fonteAtual();
    var html = '<div class="vazio" style="padding:14px 12px;margin-bottom:12px"><b style="font-size:1.1rem">Escolha o tamanho da letra</b>' +
      '<span style="display:block;margin-top:6px">Este texto muda na hora. Escolha o que ficar mais confortável.</span></div>' +
      '<div class="grid2" style="gap:8px">' +
      FONTES.map(function (nome, i) {
        var n = i + 1;
        return '<button class="btn ' + (n === atual ? 'btn-primario' : 'btn-sec') + '" data-fonte="' + n + '" style="min-height:56px;font-size:' + (0.8 + n * 0.08) + 'rem">' +
          nome + '<br><small style="font-weight:700;opacity:.8">' + (n === 1 ? 'menor' : n === 4 ? 'maior' : 'Aa') + '</small></button>';
      }).join('') +
      '</div>';
    var corpo = UI.abrirFolha({
      titulo: 'Tamanho da letra',
      sub: 'Deixe o app do seu jeito.',
      html: html
    });
    UI.$$('[data-fonte]', corpo || document).forEach(function (b) {
      b.onclick = function () {
        var n = UI.aplicarFonte(b.getAttribute('data-fonte'));
        UI.toast('Letra ' + FONTES[n - 1].toLowerCase());
        UI.fecharFolha();
      };
    });
  };

  /* ---------- compartilhar ---------- */
  UI.compartilhar = function (dados) {
    var texto = [dados.texto, dados.url].filter(Boolean).join(' ');
    if (navigator.share) {
      navigator.share({ title: dados.titulo || 'IBNM', text: dados.texto || '', url: dados.url || location.href })
        .catch(function () {});
      return;
    }
    UI.copiar(texto);
  };

  UI.copiar = function (texto, aviso) {
    var fazer = function () { UI.toast(aviso || 'Copiado! Cole no seu banco.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(fazer, function () { copiaAntiga(texto); fazer(); });
    } else {
      copiaAntiga(texto); fazer();
    }
  };

  function copiaAntiga(texto) {
    try {
      var t = document.createElement('textarea');
      t.value = texto;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      document.body.removeChild(t);
    } catch (e) {}
  }

  /* ---------- agenda do celular (.ics) ---------- */
  UI.baixarICS = function (ev) {
    var d = UI.deISO(ev.data || ev._data);
    if (!d) return;
    var h = (ev.hora || '08:00').slice(0, 5).split(':');
    var inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(h[0]), Number(h[1] || 0));
    var fim = new Date(inicio.getTime() + 2 * 60 * 60 * 1000);
    var f = function (dt) {
      return dt.getFullYear() + String(dt.getMonth() + 1).padStart(2, '0') + String(dt.getDate()).padStart(2, '0') +
        'T' + String(dt.getHours()).padStart(2, '0') + String(dt.getMinutes()).padStart(2, '0') + '00';
    };
    var esc = function (t) { return String(t || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); };
    var ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//IBNM//App//PT\r\nCALSCALE:GREGORIAN\r\nBEGIN:VEVENT\r\n' +
      'UID:' + (ev.id || Date.now()) + '@ibnm\r\n' +
      'DTSTAMP:' + f(new Date()) + 'Z\r\n' +
      'DTSTART:' + f(inicio) + '\r\n' +
      'DTEND:' + f(fim) + '\r\n' +
      'SUMMARY:' + esc(ev.titulo || 'Evento da igreja') + '\r\n' +
      'DESCRIPTION:' + esc(ev.descricao || '') + '\r\n' +
      'LOCATION:' + esc(ev.local || '') + '\r\n' +
      'END:VEVENT\r\nEND:VCALENDAR';
    var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'evento-ibnm.ics';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1500);
    UI.toast('Arquivo da agenda gerado.');
  };

  /* ---------- ícones ---------- */
  UI.icone = {
    inicio: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></svg>',
    agenda: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h3M13 14h3M8 17.5h3"/></svg>',
    devocional: '<svg viewBox="0 0 24 24"><path d="M12 6.5C9.5 4.8 6.5 4.3 3.5 4.8v13.4c3-.5 6 0 8.5 1.8 2.5-1.8 5.5-2.3 8.5-1.8V4.8c-3-.5-6 0-8.5 1.7Z"/><path d="M12 6.5v13.5"/></svg>',
    oferta: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-9.6a4.2 4.2 0 0 1 7.5-2.5 4.2 4.2 0 0 1 7.5 2.5c0 5-7.5 9.6-7.5 9.6Z"/></svg>',
    mais: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    som: '<svg viewBox="0 0 24 24"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>'
  };

  UI.animarEntrada = function (el) {
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    requestAnimationFrame(function () {
      el.style.transition = 'opacity .28s ease, transform .28s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
  };

  window.IBNM.UI = UI;
})();
