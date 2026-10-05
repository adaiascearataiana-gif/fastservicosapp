/* =====================================================================
   FAST — RASTREIO DE MERCADORIA (app Cliente, página rastreio.html e o site)
   Consulta pública e segura: função "rastrear" do banco (só devolve o
   necessário para acompanhar a entrega — sem valores nem dados do cliente).
   Uso:  fastRastreio.montar(elemento, { codigo: 'ABC12' })
   Para o site: POST https://yhxuplhohhetzloxvgku.supabase.co/rest/v1/rpc/rastrear
                corpo {"p_codigo":"ABC12"} com o cabeçalho apikey (chave pública).
   ===================================================================== */
(function () {
  'use strict';
  var W = window;
  if (W.fastRastreio) return;
  var URL_RPC = 'https://yhxuplhohhetzloxvgku.supabase.co/rest/v1/rpc/rastrear';
  var CHAVE = 'sb_publishable_jlsorkXci3_0Hla7gt8z1g_pe6zOT19';

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function limpar(t) { return String(t || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1'); }
  function dataBR(v) {
    if (!v) return '';
    var s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { var p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
    var d = new Date(s); if (isNaN(d)) return s;
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.toLocaleDateString('pt-BR') + ', às ' + p(d.getHours()) + 'h' + p(d.getMinutes()) + 'min';
  }
  function etapa(r) {
    var dia = String(r.status_dia || '').toUpperCase(), rota = String(r.status_rota || '').toUpperCase();
    if (r.concluida_em || /CONCLU|ENTREG/.test(dia) || /CONCLU|ENTREG/.test(rota)) return 4;
    if (r.chegada_em || /CHEG/.test(dia)) return 3;
    if (/ROTA|CAMINHO|SAIU/.test(dia) || /ROTA|CAMINHO|SAIU/.test(rota)) return 2;
    return 1;
  }
  async function consultar(codigo) {
    var r = await fetch(URL_RPC, { method: 'POST', headers: { 'apikey': CHAVE, 'Authorization': 'Bearer ' + CHAVE, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_codigo: limpar(codigo) }) });
    if (r.status === 404) throw new Error('O rastreio ainda não foi ativado no sistema.');
    if (!r.ok) throw new Error('Não foi possível consultar agora (' + r.status + '). Tente de novo em instantes.');
    var t = await r.text(); return t ? JSON.parse(t) : null;
  }
  var css = document.createElement('style');
  css.textContent = [
    '.frs{font-family:inherit}.frs-f{display:flex;gap:8px}.frs-f input{flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:12px;padding:12px 14px;font:800 18px/1.1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase}',
    '.frs-f button{border:0;border-radius:12px;padding:0 18px;font-weight:800;font-size:15px;background:#0f766e;color:#fff;min-height:48px}',
    '.frs-r{margin-top:14px}.frs-er{color:#b91c1c;font-weight:700;margin-top:10px}.frs-mut{color:#64748b;font-size:13px}',
    '.frs-cod{display:inline-block;font:800 13px ui-monospace,monospace;letter-spacing:.1em;background:#ccfbf1;color:#0f766e;border-radius:999px;padding:4px 10px;margin-bottom:8px}',
    '.frs-dest{font-size:18px;font-weight:800;margin:2px 0 4px}',
    '.frs-tl{list-style:none;margin:14px 0 0;padding:0}.frs-tl li{position:relative;padding:0 0 16px 30px;color:#94a3b8;font-weight:700}',
    '.frs-tl li:before{content:"";position:absolute;left:6px;top:4px;width:12px;height:12px;border-radius:50%;background:#e2e8f0;border:2px solid #cbd5e1}',
    '.frs-tl li:after{content:"";position:absolute;left:12px;top:20px;bottom:0;width:2px;background:#e2e8f0}.frs-tl li:last-child:after{display:none}',
    '.frs-tl li.ok{color:#0f172a}.frs-tl li.ok:before{background:#10b981;border-color:#10b981}.frs-tl li.ok:after{background:#10b981}',
    '.frs-tl li.agora:before{box-shadow:0 0 0 5px rgba(16,185,129,.25)}.frs-tl small{display:block;font-weight:500;color:#64748b}'
  ].join('\n');
  document.head.appendChild(css);

  function montar(el, op) {
    if (!el) return;
    op = op || {};
    el.classList.add('frs');
    el.innerHTML = '<div class="frs-f"><input type="text" inputmode="text" autocomplete="off" maxlength="14" placeholder="Código (ex.: 7KQ2M)" aria-label="Código de rastreio"><button type="button">Rastrear</button></div><div class="frs-r"></div>';
    var inp = el.querySelector('input'), bt = el.querySelector('button'), res = el.querySelector('.frs-r');
    async function buscar() {
      var c = limpar(inp.value);
      if (c.length < 5) { res.innerHTML = '<div class="frs-er">Digite o código de rastreio (5 ou mais letras e números).</div>'; return; }
      bt.disabled = true; res.innerHTML = '<div class="frs-mut">Procurando…</div>';
      try {
        var r = await consultar(c);
        if (!r) { res.innerHTML = '<div class="frs-er">Código ' + esc(c) + ' não encontrado. Confira as letras e números.</div>'; return; }
        var e = etapa(r);
        var passos = [
          ['Pedido registrado', r.data ? 'Programado para ' + dataBR(r.data) : ''],
          ['A caminho', r.motorista ? 'Motorista ' + r.motorista : ''],
          ['Chegou ao destino', r.chegada_em ? dataBR(r.chegada_em) : ''],
          ['Entregue', r.concluida_em ? dataBR(r.concluida_em) : '']
        ];
        res.innerHTML = '<span class="frs-cod">📦 ' + esc(r.codigo) + '</span>' +
          '<div class="frs-dest">' + esc(r.destino || 'Destino') + '</div>' +
          (r.origem ? '<div class="frs-mut">Saindo de ' + esc(r.origem) + '</div>' : '') +
          '<ul class="frs-tl">' + passos.map(function (p, i) { var n = i + 1; return '<li class="' + (n <= e ? 'ok' : '') + (n === e ? ' agora' : '') + '">' + esc(p[0]) + (n <= e && p[1] ? '<small>' + esc(p[1]) + '</small>' : '') + '</li>'; }).join('') + '</ul>' +
          (r.atualizado_em ? '<div class="frs-mut">Atualizado em ' + dataBR(r.atualizado_em) + '</div>' : '');
        try { var u = new URL(location.href); u.searchParams.set(op.param || 'c', c); history.replaceState(null, '', u.toString()); } catch (er) {}
      } catch (er) { res.innerHTML = '<div class="frs-er">' + esc(er.message) + '</div>'; }
      finally { bt.disabled = false; }
    }
    bt.onclick = buscar;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') buscar(); });
    var inicial = op.codigo || (function () { try { return new URL(location.href).searchParams.get(op.param || 'c'); } catch (e) { return ''; } })();
    if (inicial) { inp.value = limpar(inicial); buscar(); }
    return { buscar: function (c) { inp.value = limpar(c); return buscar(); } };
  }
  W.fastRastreio = { montar: montar, consultar: consultar, limpar: limpar };
})();
