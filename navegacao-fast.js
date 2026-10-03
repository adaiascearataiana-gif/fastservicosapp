/* =====================================================================
   FAST — NAVEGAR (PAINEL/FAST/ROTAS e app Motorista)
   Ao tocar em "Navegar": escolha entre o Mapa do FAST, Google Maps ou Waze,
   com a opção "usar sempre". Depois abre direto no escolhido (dá para trocar
   no aviso que aparece, ou nas configurações do Motorista).
   ===================================================================== */
(function () {
  'use strict';
  var W = window;
  if (W.fastNavegar) return;
  var K = 'fast_nav_padrao_v1';
  var OPCOES = { fast: '🗺️ Mapa do FAST', google: 'Google Maps', waze: 'Waze' };

  function padrao() { try { return localStorage.getItem(K) || ''; } catch (e) { return ''; } }
  function definirPadrao(v) { try { if (v) localStorage.setItem(K, v); else localStorage.removeItem(K); } catch (e) {} }
  W.fastNavPadrao = padrao; W.fastNavDefinirPadrao = definirPadrao;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function coords(t) { var m = String(t || '').match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/); return m ? { lat: +m[1], lng: +m[2] } : null; }
  function enderecoDe(destino) {
    // se o destino é um "Lugar" cadastrado no FAST, usa o endereço completo dele
    try {
      var n = function (v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };
      var l = ((W.bancoDados || {}).destinos || []).filter(function (x) { return x && n(x.nome) === n(destino); })[0];
      if (l && (l.endereco || l.bairro)) return [l.endereco, l.bairro, l.cidade].filter(Boolean).join(', ');
    } catch (e) {}
    return destino;
  }
  function abrirExterno(url) { var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
  function urlGoogle(d) { var c = coords(d); return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(c ? c.lat + ',' + c.lng : enderecoDe(d)); }
  function urlWaze(d) { var c = coords(d); return c ? 'https://waze.com/ul?ll=' + c.lat + ',' + c.lng + '&navigate=yes' : 'https://waze.com/ul?q=' + encodeURIComponent(enderecoDe(d)) + '&navigate=yes'; }

  /* ---------------- estilos ---------------- */
  var st = document.createElement('style');
  st.textContent = [
    '#fnavEsc{position:fixed;inset:0;z-index:2147482500;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}',
    '#fnavEsc .cx{background:#fff;color:#0f172a;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))}',
    '@media(min-width:700px){#fnavEsc{align-items:center}#fnavEsc .cx{border-radius:20px}}',
    '#fnavEsc h3{margin:0 0 4px;font-size:17px}#fnavEsc .d{color:#475569;font-size:14px;margin-bottom:12px;word-break:break-word}',
    '#fnavEsc .op{display:block;width:100%;min-height:54px;border:0;border-radius:14px;margin:8px 0;font-weight:800;font-size:16px;color:#fff}',
    '#fnavEsc .sem{display:flex;align-items:center;gap:10px;margin:12px 2px 4px;font-weight:600;font-size:14px}#fnavEsc .sem input{width:22px;height:22px}',
    '#fnavEsc .cn{display:block;width:100%;min-height:46px;border:1px solid #cbd5e1;background:#fff;border-radius:12px;font-weight:700;margin-top:8px}',
    '#fnavToast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(90px + env(safe-area-inset-bottom,0px));z-index:2147482600;background:#0f172a;color:#fff;border-radius:999px;padding:10px 14px;font:600 14px system-ui,sans-serif;display:flex;gap:10px;align-items:center;box-shadow:0 10px 24px rgba(0,0,0,.3)}',
    '#fnavToast button{background:#fff;color:#0f172a;border:0;border-radius:999px;padding:6px 12px;font-weight:800}',
    '#fnavMapa{position:fixed;inset:0;z-index:2147482400;background:#0f172a;display:flex;flex-direction:column;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}',
    '#fnavMapa .top{background:#0f172a;color:#fff;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px;display:flex;gap:10px;align-items:center}',
    '#fnavMapa .top b{flex:1;font-size:15px;line-height:1.3}#fnavMapa .top small{display:block;font-weight:600;opacity:.75}',
    '#fnavMapa .x{border:0;border-radius:10px;width:42px;height:42px;font-size:18px;background:#1e293b;color:#fff}',
    '#fnavMapa .m{flex:1;min-height:0}#fnavMapa .passo{background:#1d4ed8;color:#fff;padding:10px 14px;font-weight:800;font-size:16px}',
    '#fnavMapa .bx{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:#0f172a}#fnavMapa .bx button{flex:1;min-height:46px;border:0;border-radius:12px;font-weight:800}',
    '#fnavMapa .msg{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);background:#fff;color:#0f172a;border-radius:14px;padding:14px 16px;font-weight:700;z-index:500;max-width:80%;text-align:center}'
  ].join('\n');
  document.head.appendChild(st);

  /* ---------------- escolha ---------------- */
  function escolher(destino) {
    var v = document.getElementById('fnavEsc'); if (v) v.remove();
    var d = document.createElement('div'); d.id = 'fnavEsc';
    d.innerHTML = '<div class="cx"><h3>Navegar até</h3><div class="d">' + esc(destino) + '</div>' +
      '<button type="button" class="op" data-o="fast" style="background:#4f46e5">' + OPCOES.fast + '</button>' +
      '<button type="button" class="op" data-o="google" style="background:#1a73e8">Google Maps</button>' +
      '<button type="button" class="op" data-o="waze" style="background:#33ccff;color:#06283d">Waze</button>' +
      '<label class="sem"><input type="checkbox" data-sempre> Usar sempre esta opção</label>' +
      '<button type="button" class="cn" data-c>Cancelar</button></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.hasAttribute('data-c')) { d.remove(); return; }
      var o = e.target.getAttribute('data-o'); if (!o) return;
      if (d.querySelector('[data-sempre]').checked) definirPadrao(o);
      d.remove(); executar(o, destino);
    });
  }
  function aviso(o, destino) {
    var t = document.getElementById('fnavToast'); if (t) t.remove();
    t = document.createElement('div'); t.id = 'fnavToast';
    t.innerHTML = '<span>Abrindo no ' + esc(OPCOES[o].replace('🗺️ ', '')) + '</span><button type="button">Trocar</button>';
    document.body.appendChild(t);
    t.querySelector('button').onclick = function () { t.remove(); definirPadrao(''); escolher(destino); };
    setTimeout(function () { if (t.parentNode) t.remove(); }, 5000);
  }
  function executar(o, destino) {
    if (o === 'google') abrirExterno(urlGoogle(destino));
    else if (o === 'waze') abrirExterno(urlWaze(destino));
    else mapaFast(destino);
  }
  W.fastNavegar = function (destino) {
    destino = String(destino || '').trim();
    if (!destino) { alert('Esta rota não tem destino.'); return; }
    var p = padrao();
    if (p && OPCOES[p]) { aviso(p, destino); executar(p, destino); return; }
    escolher(destino);
  };

  /* ---------------- MAPA DO FAST (OpenStreetMap + rota) ---------------- */
  function carregarLeaflet() {
    if (W.L && W.L.map) return Promise.resolve();
    return new Promise(function (res, rej) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
      var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      s.onload = function () { res(); }; s.onerror = function () { rej(new Error('Sem internet para carregar o mapa.')); }; document.head.appendChild(s);
    });
  }
  function posicaoAtual() {
    return new Promise(function (res) {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(function (p) { res({ lat: p.coords.latitude, lng: p.coords.longitude }); }, function () { res(null); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
    });
  }
  async function geocodificar(destino, perto) {
    var c = coords(destino); if (c) return c;
    var q = enderecoDe(destino);
    var u = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&accept-language=pt-BR&q=' + encodeURIComponent(q);
    if (perto) u += '&viewbox=' + (perto.lng - 0.6) + ',' + (perto.lat + 0.6) + ',' + (perto.lng + 0.6) + ',' + (perto.lat - 0.6);
    var r = await fetch(u); var j = await r.json();
    if (!j[0] && perto) { r = await fetch(u.replace(/&viewbox=[^&]*/, '')); j = await r.json(); }
    return j[0] ? { lat: +j[0].lat, lng: +j[0].lon, nome: j[0].display_name } : null;
  }
  function instrucao(s) {
    var m = s.maneuver || {}, nome = s.name ? ' na ' + s.name : '';
    var dir = { left: 'à esquerda', right: 'à direita', 'slight left': 'levemente à esquerda', 'slight right': 'levemente à direita', 'sharp left': 'acentuadamente à esquerda', 'sharp right': 'acentuadamente à direita', straight: 'em frente', uturn: 'retorne' }[m.modifier] || '';
    if (m.type === 'depart') return 'Siga' + nome;
    if (m.type === 'arrive') return 'Você chegou ao destino';
    if (m.type === 'roundabout' || m.type === 'rotary') return 'Na rotatória, pegue a ' + (m.exit || 1) + 'ª saída' + nome;
    if (m.modifier === 'uturn') return 'Faça o retorno' + nome;
    if (m.modifier === 'straight') return 'Siga em frente' + nome;
    return (m.type === 'turn' || m.type === 'end of road' || m.type === 'fork' ? 'Vire ' : 'Mantenha-se ') + dir + nome;
  }
  function distTxt(m) { return m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m / 10) * 10 + ' m'; }
  function tempoTxt(s) { var min = Math.round(s / 60); return min >= 60 ? Math.floor(min / 60) + ' h ' + (min % 60) + ' min' : min + ' min'; }
  function metros(a, b) { var R = 6371000, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r; var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2); return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }

  async function mapaFast(destino) {
    var v = document.getElementById('fnavMapa'); if (v) v.remove();
    var tela = document.createElement('div'); tela.id = 'fnavMapa';
    tela.innerHTML = '<div class="top"><b>' + esc(destino) + '<small data-info>Localizando…</small></b><button type="button" class="x" data-fx aria-label="Fechar">✕</button></div>' +
      '<div class="passo" data-passo hidden></div><div class="m" style="position:relative"><div data-m style="position:absolute;inset:0"></div></div>' +
      '<div class="bx"><button type="button" data-g style="background:#1a73e8;color:#fff">Google Maps</button><button type="button" data-w style="background:#33ccff;color:#06283d">Waze</button></div>';
    document.body.appendChild(tela);
    var info = tela.querySelector('[data-info]'), passoEl = tela.querySelector('[data-passo]'), caixa = tela.querySelector('[data-m]').parentNode;
    var vigia = null, mapa = null, eu = null, linha = null, passos = [], ultimaRota = 0, alvo = null;
    function fechar() { if (vigia != null) try { navigator.geolocation.clearWatch(vigia); } catch (e) {} tela.remove(); }
    tela.querySelector('[data-fx]').onclick = fechar;
    tela.querySelector('[data-g]').onclick = function () { abrirExterno(urlGoogle(destino)); };
    tela.querySelector('[data-w]').onclick = function () { abrirExterno(urlWaze(destino)); };
    function falha(t) { var m = document.createElement('div'); m.className = 'msg'; m.textContent = t; caixa.appendChild(m); info.textContent = ''; }
    try { await carregarLeaflet(); } catch (e) { return falha(e.message); }
    var L = W.L;
    var pos = await posicaoAtual();
    try { alvo = await geocodificar(destino, pos); } catch (e) { alvo = null; }
    mapa = L.map(tela.querySelector('[data-m]'), { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
    if (!alvo) { mapa.setView(pos ? [pos.lat, pos.lng] : [-3.73, -38.52], 13); return falha('Não encontrei "' + destino + '" no mapa. Use Google Maps ou Waze.'); }
    L.marker([alvo.lat, alvo.lng]).addTo(mapa).bindPopup(esc(destino));
    async function rota(de) {
      ultimaRota = Date.now();
      try {
        var r = await fetch('https://router.project-osrm.org/route/v1/driving/' + de.lng + ',' + de.lat + ';' + alvo.lng + ',' + alvo.lat + '?overview=full&geometries=geojson&steps=true');
        var j = await r.json(); var rt = j.routes && j.routes[0]; if (!rt) throw 0;
        var pts = rt.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
        if (linha) linha.setLatLngs(pts); else linha = L.polyline(pts, { color: '#2563eb', weight: 6, opacity: .85 }).addTo(mapa);
        passos = (rt.legs[0] && rt.legs[0].steps || []).map(function (s) { return { txt: instrucao(s), lat: s.maneuver.location[1], lng: s.maneuver.location[0] }; });
        info.textContent = distTxt(rt.distance) + ' · ' + tempoTxt(rt.duration);
        return pts;
      } catch (e) { info.textContent = 'Rota indisponível agora — veja o destino no mapa'; return null; }
    }
    if (pos) {
      eu = L.circleMarker([pos.lat, pos.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(mapa);
      var pts = await rota(pos);
      if (pts) mapa.fitBounds(L.latLngBounds(pts), { padding: [30, 30] }); else mapa.fitBounds(L.latLngBounds([[pos.lat, pos.lng], [alvo.lat, alvo.lng]]), { padding: [40, 40] });
      try {
        vigia = navigator.geolocation.watchPosition(function (p) {
          var a = { lat: p.coords.latitude, lng: p.coords.longitude };
          eu.setLatLng([a.lat, a.lng]);
          var prox = passos.filter(function (s) { return metros(a, s) > 25; })[0];
          if (prox) { passoEl.hidden = false; passoEl.textContent = '➜ ' + prox.txt + ' · ' + distTxt(metros(a, prox)); }
          if (metros(a, alvo) < 40) { passoEl.hidden = false; passoEl.textContent = '🏁 Você chegou ao destino'; }
          if (Date.now() - ultimaRota > 45000) rota(a);
        }, function () {}, { enableHighAccuracy: true, maximumAge: 3000 });
      } catch (e) {}
    } else {
      mapa.setView([alvo.lat, alvo.lng], 15);
      info.textContent = 'Ative a localização para ver a rota até o destino';
    }
  }
  W.fastMapaFast = mapaFast;

  /* app Motorista: "Abrir rotas no mapa" das configurações passa a usar esta escolha */
  setInterval(function () {
    var sel = document.getElementById('mpMapa'); if (!sel || sel.__fnav) return;
    sel.__fnav = true;
    sel.innerHTML = '<option value="perguntar">Perguntar sempre</option><option value="fast">Mapa do FAST</option><option value="google">Google Maps</option><option value="waze">Waze</option>';
    sel.value = padrao() || 'perguntar';
    sel.addEventListener('change', function () { definirPadrao(sel.value === 'perguntar' ? '' : sel.value); });
  }, 1000);
})();
