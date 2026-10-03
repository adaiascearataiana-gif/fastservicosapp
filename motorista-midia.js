/* =====================================================================
   FAST Motorista — MÚSICA E VÍDEOS
   • Música: abre o app que o motorista já usa (Spotify, Deezer, YouTube Music,
     Amazon Music) ou a playlist dele. A música continua tocando com o FAST
     Motorista na frente (o áudio é do app de música, não depende do FAST).
   • YouTube: vídeo dentro do app SÓ COM O CARRO PARADO. Se o GPS indicar
     movimento, o vídeo pausa sozinho (assistir dirigindo é proibido e perigoso).
   ===================================================================== */
(function () {
  'use strict';
  var W = window;
  if (W.__fastMidia) return;
  W.__fastMidia = true;
  var CFG = W.FAST_MIDIA_CFG || {};
  var K = 'fast_mot_midia_v1';
  var VEL_LIMITE = 2.8;   // m/s (~10 km/h)

  function ler() { try { return JSON.parse(localStorage.getItem(K) || '{}') || {}; } catch (e) { return {}; } }
  function gravar(v) { try { localStorage.setItem(K, JSON.stringify(v)); } catch (e) {} }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function visivel() { try { return typeof CFG.visivel === 'function' ? !!CFG.visivel() : true; } catch (e) { return true; } }
  function abrirExterno(url) {
    // no app Android, links de fora abrem o aplicativo correspondente (Spotify, Deezer, YouTube…)
    var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }
  var APPS = [
    { id: 'spotify', nome: 'Spotify', cor: '#1db954', url: 'https://open.spotify.com/' },
    { id: 'deezer', nome: 'Deezer', cor: '#a238ff', url: 'https://www.deezer.com/br/' },
    { id: 'ytmusic', nome: 'YouTube Music', cor: '#ff0033', url: 'https://music.youtube.com/' },
    { id: 'amazon', nome: 'Amazon Music', cor: '#00a8e1', url: 'https://music.amazon.com.br/' }
  ];
  function tipoLink(u) {
    u = String(u || '');
    if (/spotify\.com|spotify:/.test(u)) return 'Spotify';
    if (/deezer\.(com|page\.link)/.test(u)) return 'Deezer';
    if (/music\.youtube\.com/.test(u)) return 'YouTube Music';
    if (/youtu\.?be/.test(u)) return 'YouTube';
    if (/amazon\./.test(u)) return 'Amazon Music';
    return 'link';
  }
  function idYoutube(u) {
    u = String(u || '').trim();
    var m = u.match(/[?&]list=([\w-]+)/); var lista = m ? m[1] : '';
    m = u.match(/youtu\.be\/([\w-]{6,})/) || u.match(/[?&]v=([\w-]{6,})/) || u.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/);
    return { video: m ? m[1] : '', lista: lista };
  }

  /* ---------------- estilos e botão ---------------- */
  var st = document.createElement('style');
  st.textContent = [
    '#fmidBtn{position:fixed;right:16px;bottom:calc(140px + env(safe-area-inset-bottom,0px));z-index:9990;border:0;border-radius:999px;width:52px;height:52px;font-size:24px;color:#fff;background:linear-gradient(135deg,#16a34a,#0ea5e9);box-shadow:0 10px 24px rgba(22,163,74,.35)}',
    '#fmid{position:fixed;inset:0;z-index:9996;background:rgba(15,23,42,.55);display:none;align-items:flex-end;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}',
    '#fmid.on{display:flex}#fmid .cx{background:#fff;color:#0f172a;width:100%;max-width:640px;max-height:calc(100dvh - 20px);border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden}',
    '@media(min-width:700px){#fmid{align-items:center}#fmid .cx{border-radius:20px}}',
    '#fmid .hd{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #e2e8f0}#fmid .hd b{flex:1;font-size:17px}',
    '#fmid .x{border:1px solid #e2e8f0;background:#fff;border-radius:10px;width:40px;height:40px;font-size:18px}',
    '#fmid .bd{overflow:auto;padding:14px 16px calc(16px + env(safe-area-inset-bottom,0px))}#fmid h4{margin:6px 0 8px;font-size:15px}',
    '#fmid .apps{display:grid;grid-template-columns:1fr 1fr;gap:8px}#fmid .apps button{border:0;border-radius:14px;min-height:56px;font-weight:800;font-size:15px;color:#fff}',
    '#fmid .pl{display:flex;gap:8px;margin-top:10px}#fmid input{flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:12px;padding:11px 12px;font-size:16px}',
    '#fmid .bt{border:0;border-radius:12px;padding:12px 14px;font-weight:800;background:#0f172a;color:#fff;min-height:48px}#fmid .bt.g{background:#16a34a}#fmid .bt.s{background:#fff;color:#0f172a;border:1px solid #cbd5e1}',
    '#fmid .mut{color:#64748b;font-size:13px}#fmid .al{background:#fef3c7;color:#78350f;border-radius:12px;padding:10px 12px;font-weight:600;margin:8px 0;font-size:13px}',
    '#fmid .vid{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:14px;overflow:hidden;margin-top:10px}#fmid .vid iframe{position:absolute;inset:0;width:100%;height:100%;border:0}',
    '#fmid .trava{position:absolute;inset:0;background:rgba(15,23,42,.92);color:#fff;display:none;align-items:center;justify-content:center;text-align:center;padding:16px;font-weight:800;font-size:16px}#fmid .trava.on{display:flex}'
  ].join('\n');
  document.head.appendChild(st);
  var btn = document.createElement('button'); btn.id = 'fmidBtn'; btn.type = 'button'; btn.title = 'Música e vídeos'; btn.textContent = '🎵';
  var ov = document.createElement('div'); ov.id = 'fmid';
  ov.innerHTML = '<div class="cx" role="dialog" aria-modal="true"><div class="hd"><b>🎵 Música e vídeos</b><button type="button" class="x" data-f aria-label="Fechar">✕</button></div><div class="bd"></div></div>';
  function montar() { if (!document.body) return setTimeout(montar, 200); document.body.appendChild(btn); document.body.appendChild(ov); }
  montar();
  setInterval(function () { btn.style.display = visivel() ? 'block' : 'none'; }, 1500);
  var corpo = ov.querySelector('.bd');

  /* ---------------- movimento (GPS) ---------------- */
  var geo = null, ultimo = null, emMovimento = false;
  function ligarGPS() {
    if (geo != null || !navigator.geolocation) return;
    try {
      geo = navigator.geolocation.watchPosition(function (p) {
        var v = p.coords.speed;
        if ((v == null || isNaN(v)) && ultimo) {
          var dt = (p.timestamp - ultimo.t) / 1000;
          if (dt > 0.5) {
            var R = 6371000, toR = Math.PI / 180, dLat = (p.coords.latitude - ultimo.la) * toR, dLon = (p.coords.longitude - ultimo.lo) * toR;
            var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(ultimo.la * toR) * Math.cos(p.coords.latitude * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            v = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / dt;
          }
        }
        ultimo = { la: p.coords.latitude, lo: p.coords.longitude, t: p.timestamp };
        if (v != null && !isNaN(v)) definirMovimento(v > VEL_LIMITE);
      }, function () {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
    } catch (e) {}
  }
  function desligarGPS() { if (geo != null) { try { navigator.geolocation.clearWatch(geo); } catch (e) {} geo = null; ultimo = null; } }
  function definirMovimento(m) {
    emMovimento = m;
    var tr = corpo.querySelector('.trava'); if (tr) tr.classList.toggle('on', m);
    if (m) pausarVideo();
  }
  function pausarVideo() {
    var f = corpo.querySelector('.vid iframe');
    if (f && f.contentWindow) { try { f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*'); } catch (e) {} }
  }

  /* ---------------- telas ---------------- */
  function desenhar() {
    var c = ler();
    var h = '<h4>Ouvir música</h4><p class="mut" style="margin:0 0 8px">Abre o seu app de música. Ela continua tocando enquanto você usa o FAST Motorista.</p>' +
      '<div class="apps">' + APPS.map(function (a) { return '<button type="button" data-app="' + a.id + '" style="background:' + a.cor + '">' + a.nome + '</button>'; }).join('') + '</div>' +
      '<h4 style="margin-top:16px">Minha playlist</h4>' +
      (c.playlist ? '<button type="button" class="bt g" data-tocar style="width:100%">▶ Tocar minha playlist (' + esc(tipoLink(c.playlist)) + ')</button>' : '<p class="mut" style="margin:0">No app de música, abra a playlist → <b>Compartilhar</b> → <b>Copiar link</b> e cole aqui:</p>') +
      '<div class="pl"><input data-pl placeholder="Cole o link da playlist" value="' + esc(c.playlist || '') + '"><button type="button" class="bt s" data-salvar-pl>Salvar</button></div>' +
      '<h4 style="margin-top:18px">YouTube</h4>' +
      '<div class="al">⚠️ Vídeo só com o veículo <b>parado</b>. Em movimento, o vídeo pausa sozinho — assistir dirigindo é proibido e perigoso.</div>' +
      '<div class="pl"><input data-yt placeholder="Cole o link do vídeo ou playlist do YouTube" value="' + esc(c.youtube || '') + '"><button type="button" class="bt" data-ver>Ver</button></div>' +
      '<div class="vid" hidden><iframe allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><div class="trava">🚗 Vídeo pausado:<br>o veículo está em movimento</div></div>' +
      '<div class="pl"><button type="button" class="bt s" data-abrir-yt style="flex:1">Abrir o app do YouTube</button></div>';
    corpo.innerHTML = h;
  }
  function abrirPainel() { ov.classList.add('on'); desenhar(); }
  function fecharPainel() { pausarVideo(); var f = corpo.querySelector('.vid iframe'); if (f) f.src = 'about:blank'; ov.classList.remove('on'); desligarGPS(); }
  btn.onclick = abrirPainel;
  ov.querySelector('[data-f]').onclick = fecharPainel;
  ov.addEventListener('click', function (e) {
    var t = e.target, c = ler();
    var app = t.getAttribute && t.getAttribute('data-app');
    if (app) { var a = APPS.filter(function (x) { return x.id === app; })[0]; if (a) abrirExterno(a.url); return; }
    if (t.hasAttribute('data-salvar-pl')) { c.playlist = (corpo.querySelector('[data-pl]').value || '').trim(); gravar(c); desenhar(); return; }
    if (t.hasAttribute('data-tocar') && c.playlist) { abrirExterno(c.playlist); return; }
    if (t.hasAttribute('data-abrir-yt')) {
      if (emMovimento) { alert('Com o veículo em movimento, abra o YouTube só depois de parar.'); return; }
      abrirExterno('https://www.youtube.com/'); return;
    }
    if (t.hasAttribute('data-ver')) {
      var link = (corpo.querySelector('[data-yt]').value || '').trim(); c.youtube = link; gravar(c);
      var y = idYoutube(link); if (!y.video && !y.lista) { alert('Cole um link de vídeo do YouTube.'); return; }
      var src = 'https://www.youtube-nocookie.com/embed/' + (y.video ? y.video + '?' : 'videoseries?list=' + y.lista + '&') + 'enablejsapi=1&playsinline=1&rel=0';
      var box = corpo.querySelector('.vid'); box.hidden = false; box.querySelector('iframe').src = src;
      ligarGPS(); definirMovimento(emMovimento);
    }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pausarVideo(); });
  W.fastAbrirMidia = abrirPainel;
})();
