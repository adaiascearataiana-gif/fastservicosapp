#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
r140 / v2.3.25 — Launcher (Central Rapida ⚡) arrastavel e sempre visivel.

1) <style id="r140-launcher-drag">: z-index 2147481000 (acima da barra inferior
   9990-9998, das setas de rolagem 9999 e do botao de atualizacao suspensa
   999999; abaixo da paleta 2147482000 e do toast 2147482500), touch-action:none,
   neutralizacao das ancoras right/bottom quando ha posicao arrastada (classe
   fast-drag-pinned) e visual de arrasto.
2) <script id="r140-launcher-drag-js"> no fim do body: pointer events (com
   fallback mouse/touch), limiar de 8px (toque = abre a paleta como sempre;
   arrasto = move), persistencia em localStorage (fastV2LauncherPos), clamp no
   viewport (visualViewport), restauracao no boot, re-clamp em resize/giro,
   segurar ~500ms sem mover devolve ao canto padrao, wrapper do onclick para
   nao abrir a paleta apos um arrasto, contextmenu suprimido no botao.
3) Bump 2.3.24 -> 2.3.25 em todos os marcadores + 3 entradas de changelog.
"""
import re, sys, hashlib

SRC = 'index.html'
DATA = '2026-09-08T21:50:00-03:00'
DATA_PT = '08/09/2026 21:50'

s = open(SRC, encoding='utf-8').read()
orig_len = len(s)
changes = []

def rep_once(old, new, desc):
    global s
    c = s.count(old)
    if c != 1:
        print('FALHOU (count=%d): %s' % (c, desc)); sys.exit(1)
    s = s.replace(old, new, 1)
    changes.append(desc)

# ============================================================
# A) CSS r140
# ============================================================
STYLE = '''<style id="r140-launcher-drag">
/* r140 / 2.3.25 — Central Rapida (botao ⚡) ARRASTAVEL e SEMPRE VISIVEL.
   1) z-index 2147481000: acima da barra inferior fixa (9990-9998), das setas
      de rolagem (9999) e do botao de atualizacao suspensa (999999) — nunca
      mais fica escondido atras de nada. Abaixo da paleta da Central Rapida
      (2147482000) e do toast (2147482500).
   2) touch-action:none: o toque no botao nunca rola a pagina — vira arrasto.
   3) position:fixed !important vence o .ripple { position:relative } do CSS
      interno (mesma especificidade, mas !important + seletor ID garantem a
      fixacao) \u2014 sem isso o botao escorregava para fora da tela.
   4) .fast-drag-pinned (so existe quando ha posicao arrastada gravada):
      neutraliza as ancoras fixas right/bottom (v2-ui.css e overrides mobile
      right:14px/bottom:88px e desktop bottom:128px) e libera o left/top
      inline gravado pelo arrasto (inline !important vence tudo). */
#fastV2Launcher {
  position: fixed !important;
  z-index: 2147481000 !important;
  touch-action: none !important;
  -webkit-user-select: none !important; user-select: none !important;
  -webkit-touch-callout: none !important;
}
#fastV2Launcher.fast-drag-pinned {
  position: fixed !important;
  right: auto !important; bottom: auto !important;
  left: auto !important;  top: auto !important;
}
#fastV2Launcher.fast-dragging {
  cursor: grabbing !important;
  transform: scale(1.08) !important;
  box-shadow: 0 22px 55px rgba(7,17,31,.5) !important;
  transition: none !important;
  will-change: left, top;
}
@media print { #fastV2Launcher { display: none !important; } }
</style>
'''

# ============================================================
# B) JS r140
# ============================================================
SCRIPT = '''<script id="r140-launcher-drag-js">
(function(){
  'use strict';
  /* r140 / 2.3.25 — Central Rapida (botao ⚡) arrastavel.
     • Toque curto (menos de ~8px de movimento): abre a Central Rapida
       exatamente como antes (onclick do v2-ui.js preservado).
     • Arraste: o botao segue o dedo/mouse para QUALQUER ponto da tela; a
       posicao fica gravada no aparelho (localStorage) e volta na proxima
       abertura. Nunca sai da tela (clamp com margem de seguranca e
       visualViewport, que respeita teclado aberto no celular).
     • Segurar ~meio segundo SEM mover: devolve o botao ao canto padrao
       (apaga a posicao salva).
     • z-index 2147481000: acima da barra inferior e das setas de rolagem —
       nao fica mais escondido atras de nada. */
  var KEY = 'fastV2LauncherPos';
  var THRESH = 8;    /* px — abaixo disso e toque, acima e arrasto */
  var MARGIN = 6;    /* px de folga das bordas da tela */
  var HOLD_RESET = 500; /* ms segurando sem mover -> volta ao canto padrao */

  function el(){ return document.getElementById('fastV2Launcher'); }
  function readPos(){
    try{
      var o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if(o && typeof o.left === 'number' && typeof o.top === 'number') return o;
    }catch(e){}
    return null;
  }
  function savePos(l, t){
    try{ localStorage.setItem(KEY, JSON.stringify({left:Math.round(l), top:Math.round(t), at:Date.now()})); }catch(e){}
  }
  function clearPos(){ try{ localStorage.removeItem(KEY); }catch(e){} }
  function viewW(){
    var v = window.visualViewport;
    return Math.round(v && v.width ? v.width : (window.innerWidth || document.documentElement.clientWidth));
  }
  function viewH(){
    var v = window.visualViewport;
    return Math.round(v && v.height ? v.height : (window.innerHeight || document.documentElement.clientHeight));
  }
  function applyPos(left, top){
    var b = el(); if(!b) return;
    var w = b.offsetWidth || 50, h = b.offsetHeight || 50;
    var l = Math.max(MARGIN, Math.min(left, viewW() - w - MARGIN));
    var t = Math.max(MARGIN, Math.min(top,  viewH() - h - MARGIN));
    b.classList.add('fast-drag-pinned');
    b.style.setProperty('left', Math.round(l) + 'px', 'important');
    b.style.setProperty('top',  Math.round(t) + 'px', 'important');
  }
  function restore(){
    var p = readPos();
    if(!p) return;              /* sem posicao salva -> canto padrao original */
    applyPos(p.left, p.top);
  }
  function toastRapido(msg){
    try{
      var t = document.getElementById('fastV2Toast');
      if(t){
        t.textContent = msg; t.classList.add('show');
        clearTimeout(t._timer);
        t._timer = setTimeout(function(){ t.classList.remove('show'); }, 2200);
      }
    }catch(e){}
  }
  function resetDefault(){
    var b = el(); if(!b) return;
    clearPos();
    b.classList.remove('fast-drag-pinned');
    try{ b.style.removeProperty('left'); b.style.removeProperty('top'); }catch(e){}
    toastRapido('Botão da Central Rápida voltou ao canto padrão.');
  }
  function suppressNextClick(b){
    /* o clique nativo que vem DEPOIS de um arrasto nao deve abrir a paleta */
    try{
      b.dataset.dragged = '1';
      setTimeout(function(){ try{ b.dataset.dragged = '0'; }catch(e){} }, 450);
    }catch(e){}
  }

  /* ---------- nucleo do gesto ---------- */
  var st = null;
  function begin(id, x, y){
    var b = el(); if(!b) return;
    st = { id:id, x0:x, y0:y, drag:false, t0:Date.now(), w:b.offsetWidth||50, h:b.offsetHeight||50 };
    b.classList.add('fast-drag-ready');
  }
  function move(id, x, y){
    if(!st || st.id !== id) return;
    var b = el(); if(!b) return;
    var dx = x - st.x0, dy = y - st.y0;
    if(!st.drag){
      if(dx*dx + dy*dy < THRESH*THRESH) return;  /* ainda pode ser toque */
      st.drag = true;
      b.classList.add('fast-dragging');
    }
    applyPos(x - st.w/2, y - st.h/2);
  }
  function end(id){
    if(!st || st.id !== id) return;
    var b = el(), wasDrag = st.drag, held = Date.now() - st.t0;
    st = null;
    if(!b) return;
    b.classList.remove('fast-drag-ready');
    b.classList.remove('fast-dragging');
    if(wasDrag){
      var r = b.getBoundingClientRect();
      savePos(r.left, r.top);
      suppressNextClick(b);
      return;
    }
    if(held >= HOLD_RESET){
      suppressNextClick(b);
      resetDefault();
    }
    /* toque curto: nao interferir — o clique abre a Central Rapida */
  }
  function cancel(id){
    if(!st || st.id !== id) return;
    var b = el(), wasDrag = st.drag;
    st = null;
    if(!b) return;
    b.classList.remove('fast-drag-ready');
    b.classList.remove('fast-dragging');
    if(wasDrag){
      var r = b.getBoundingClientRect();
      savePos(r.left, r.top);
      suppressNextClick(b);
    }
  }

  function bind(){
    var b = el(); if(!b) return;
    if(b.dataset.r140bind === '1'){ restore(); return; }
    b.dataset.r140bind = '1';
    /* long-press em celular nao abre menu de contexto no botao */
    b.addEventListener('contextmenu', function(e){ e.preventDefault(); }, false);
    if(window.PointerEvent){
      b.addEventListener('pointerdown', function(e){
        if(e.button !== undefined && e.button !== 0) return;
        try{ b.setPointerCapture(e.pointerId); }catch(x){}
        begin(e.pointerId, e.clientX, e.clientY);
      }, false);
      b.addEventListener('pointermove', function(e){
        move(e.pointerId, e.clientX, e.clientY);
        if(st && st.drag && e.cancelable) e.preventDefault();
      }, false);
      b.addEventListener('pointerup', function(e){
        try{ b.releasePointerCapture(e.pointerId); }catch(x){}
        end(e.pointerId);
      }, false);
      b.addEventListener('pointercancel', function(e){ cancel(e.pointerId); }, false);
    } else {
      /* fallback: navegadores sem Pointer Events */
      b.addEventListener('mousedown', function(e){
        if(e.button !== 0) return;
        begin('m', e.clientX, e.clientY); e.preventDefault();
      }, false);
      document.addEventListener('mousemove', function(e){ move('m', e.clientX, e.clientY); }, false);
      document.addEventListener('mouseup',   function(e){ end('m'); }, false);
      b.addEventListener('touchstart', function(e){
        if(e.touches.length === 1) begin('t' + e.touches[0].identifier, e.touches[0].clientX, e.touches[0].clientY);
      }, {passive:true});
      document.addEventListener('touchmove', function(e){
        if(st && e.touches.length === 1){
          move('t' + e.touches[0].identifier, e.touches[0].clientX, e.touches[0].clientY);
          if(st && st.drag && e.cancelable) e.preventDefault();
        }
      }, {passive:false});
      document.addEventListener('touchend', function(e){
        if(e.changedTouches.length) end('t' + e.changedTouches[0].identifier);
      }, false);
      document.addEventListener('touchcancel', function(e){
        if(e.changedTouches.length) cancel('t' + e.changedTouches[0].identifier);
      }, false);
    }
    /* wrapper do onclick (v2-ui.js): clique so abre a paleta quando NAO foi arrasto */
    (function(){
      var orig = b.onclick;
      b.onclick = function(e){
        if(this.dataset.dragged === '1'){
          this.dataset.dragged = '0';
          try{ if(e) e.preventDefault(); }catch(x){}
          return;
        }
        if(typeof orig === 'function') return orig.call(this, e);
      };
    })();
    restore();
  }

  /* ---------- re-clamp em giro de tela / resize / teclado ---------- */
  function reclamp(){
    var p = readPos();
    if(!p) return;
    applyPos(p.left, p.top);
  }
  var rzT = null;
  function onResize(){ clearTimeout(rzT); rzT = setTimeout(reclamp, 120); }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  if(window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

  /* ---------- boot ---------- */
  function boot(){
    bind();
    /* r127/v2-ui podem recriar o launcher — observa e rebinda o arrasto */
    try{
      new MutationObserver(function(muts){
        for(var i = 0; i < muts.length; i++){
          var m = muts[i];
          for(var j = 0; j < m.addedNodes.length; j++){
            if(m.addedNodes[j] && m.addedNodes[j].id === 'fastV2Launcher'){ bind(); return; }
          }
        }
      }).observe(document.body, {childList:true, subtree:false});
    }catch(e){}
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 80); }, {once:true});
  } else { setTimeout(boot, 80); }
  /* layout final (v2-ui.css aplicado): reconfere a posicao salva */
  window.addEventListener('load', function(){ setTimeout(restore, 150); });
})();
</script>
'''

# ============================================================
# 1) INSERCOES
# ============================================================
btn_anchor = '<button class="fast-v2-launcher ripple" id="fastV2Launcher"'
rep_once(btn_anchor, STYLE + btn_anchor, 'style r140 antes do botao launcher')

end_anchor = '</body></html>'
j = s.rfind(end_anchor)
if j < 0:
    print('FALHOU: fim do body nao encontrado'); sys.exit(1)
s = s[:j] + SCRIPT + s[j:]
changes.append('script r140 no fim do body')

# dica no tooltip do botao
rep_once('title="Central rápida (Ctrl+K)"',
         'title="Central rápida (Ctrl+K) · segure e arraste para mover"',
         'tooltip do launcher')

# ============================================================
# 2) BUMP DE VERSAO 2.3.24 -> 2.3.25
# ============================================================
rep_once('<html lang="pt-BR" class="fast-linux-desktop" data-fast-version="2.3.24">',
         '<html lang="pt-BR" class="fast-linux-desktop" data-fast-version="2.3.25">',
         'data-fast-version')
rep_once('<meta name="fast-app-version" content="2.3.24">',
         '<meta name="fast-app-version" content="2.3.25">',
         'meta fast-app-version')
rep_once('<meta name="fast-app-changelog-immediate" content="2.3.24">',
         '<meta name="fast-app-changelog-immediate" content="2.3.25">',
         'meta fast-app-changelog-immediate')
rep_once('<meta name="fast-app-date" content="2026-09-08T18:20:00-03:00">',
         '<meta name="fast-app-date" content="%s">' % DATA,
         'meta fast-app-date')

n = s.count('?v=2.3.24"') + s.count("?v=2.3.24'")
s = s.replace('?v=2.3.24"', '?v=2.3.25"').replace("?v=2.3.24'", "?v=2.3.25'")
changes.append('cache-busts ?v= (%d)' % n)

rep_once('<span id="fastSplashVersion">2.3.24</span>',
         '<span id="fastSplashVersion">2.3.25</span>', 'fastSplashVersion')
rep_once('<span id="fastGateVersionNum">2.3.24</span>',
         '<span id="fastGateVersionNum">2.3.25</span>', 'fastGateVersionNum')
rep_once('<div class="nav-menu-footer-ver" id="navMenuVersao">Versão 2.3.24</div>',
         '<div class="nav-menu-footer-ver" id="navMenuVersao">Versão 2.3.25</div>', 'navMenuVersao')
rep_once('<span id="fastVersaoLabel" style="color:var(--accent);font-weight:800;">2.3.24</span>',
         '<span id="fastVersaoLabel" style="color:var(--accent);font-weight:800;">2.3.25</span>', 'fastVersaoLabel')
rep_once('<div id="fastVersaoOnlineLabel" style="font-size:12px;color:var(--text-muted);text-align:right;">Online: <strong>2.3.24</strong>',
         '<div id="fastVersaoOnlineLabel" style="font-size:12px;color:var(--text-muted);text-align:right;">Online: <strong>2.3.25</strong>', 'fastVersaoOnlineLabel')
rep_once('<div id="fastWhatsNewVer" style="font-size:19px;font-weight:800;line-height:1.2;">Versão 2.3.24</div>',
         '<div id="fastWhatsNewVer" style="font-size:19px;font-weight:800;line-height:1.2;">Versão 2.3.25</div>', 'fastWhatsNewVer')
rep_once("if(m) m.content='2.3.24';", "if(m) m.content='2.3.25';", 'r91 fast-app-version')
rep_once("if(d) d.content='2026-09-08T18:20:00-03:00';", "if(d) d.content='%s';" % DATA, 'r91 fast-app-date')
rep_once('FAST Serviços 2.3.24 pronto para operar.', 'FAST Serviços 2.3.25 pronto para operar.', 'toast do body')
rep_once("versao:'2.3.24' }", "versao:'2.3.25' }", 'telemetria')

LATEST_NEW = ('2.3.25: O botao rapido da Central Rapida (raio) agora flutua LIVRE: '
              'arraste com o dedo para qualquer canto da tela e a posicao fica gravada no aparelho; '
              'ele nunca mais fica escondido atras da barra inferior (camada propria acima da barra e das setas de rolagem); '
              'o toque normal continua abrindo a Central Rapida e segurar sem mover por meio segundo devolve o botao ao canto padrao.')
rep_once('<meta name="fast-latest-update" content="2.3.24: Desfazer obedece de verdade (merge por carimbo de hora — comando mais recente vence), fim das rotas marcando CONCLUiDA sem comando (status de pagamento nunca afeta execucao), botoes SUBIR/DESCER movidos para a tabela Relatorio Consolidado (setas compactas antes do numero) e removidos dos cards, e grade de 2 colunas nos botoes dos cards no celular.">',
         '<meta name="fast-latest-update" content="%s">' % LATEST_NEW,
         'meta fast-latest-update (head)')

m = re.search(r"var l=document\.querySelector\('meta\[name=\"fast-latest-update\"\]'\);\n    if\(l\) l\.content='2\.3\.24: [^']*';", s)
if not m:
    print('FALHOU: r91 latest-update nao encontrado'); sys.exit(1)
s = s.replace(m.group(0),
    "var l=document.querySelector('meta[name=\"fast-latest-update\"]');\n    if(l) l.content='%s';" % LATEST_NEW, 1)
changes.append('r91 latest-update')

# ============================================================
# 3) CHANGELOG — 3 entradas 2.3.25 no topo
# ============================================================
entries = [
    ("novo", "2.3.25 (08/09/2026): botao rapido da Central Rapida (raio ⚡) agora ARRASTAVEL — segure e leve o botao para qualquer ponto da tela; a posicao escolhida fica gravada no aparelho e volta na proxima abertura do app."),
    ("melhorado", "2.3.25 (08/09/2026): o botao rapido nunca mais fica escondido atras da barra inferior fixa — agora flutua em camada propria, acima da barra, das setas de rolagem e de todos os botoes flutuantes, em qualquer tela do app."),
    ("melhorado", "2.3.25 (08/09/2026): toque curto no botao continua abrindo a Central Rapida normalmente; segurar o botao sem mover por cerca de meio segundo devolve ele ao canto padrao (apaga a posicao salva)."),
]
def enc(t):
    return t.replace('&','&amp;').replace('"','&quot;').replace('<','&lt;').replace('>','&gt;')
new_items = ','.join('{&quot;type&quot;:&quot;%s&quot;,&quot;text&quot;:&quot;%s&quot;}' % (ty, enc(tx)) for ty, tx in entries)

cl_anchor = '<meta name="fast-app-changelog" content="[{&quot;type&quot;:&quot;corrigido&quot;,&quot;text&quot;:&quot;2.3.24 (08/09/2026): BUG DEFINITIVO'
rep_once(cl_anchor,
    '<meta name="fast-app-changelog" content="[' + new_items + ',{&quot;type&quot;:&quot;corrigido&quot;,&quot;text&quot;:&quot;2.3.24 (08/09/2026): BUG DEFINITIVO',
    '3 entradas 2.3.25 no topo do changelog')

# ============================================================
# 4) fastUpdatesBody gravado — itens 2.3.25 (runtime repopula igual)
# ============================================================
body_start = s.find('<div class="fast-updates-panel-body" id="fastUpdatesBody">')
tail_anchor = 'reabre o aviso.</div></div></div></div>'
body_end = s.find(tail_anchor, body_start)
if body_start < 0 or body_end < 0:
    print('FALHOU: fastUpdatesBody nao delimitado (%d,%d)' % (body_start, body_end)); sys.exit(1)
body_end += len(tail_anchor)

def fup_item(ty, tx):
    tmap = {'novo':      ('Novo',      '#16a34a', 'rgba(22,163,74,0.10)',  'fa-circle-plus'),
            'melhorado': ('Melhorado', '#2563eb', 'rgba(37,99,235,0.10)', 'fa-arrow-up'),
            'corrigido': ('Corrigido', '#d97706', 'rgba(217,119,6,0.10)', 'fa-wrench')}
    lab, col, bg, ico = tmap[ty]
    return ('<div class="fup-item"><div class="fup-item-dot" style="background:%s;"><i class="fa-solid %s" style="color:%s;"></i></div>'
            '<div class="fup-item-content"><span class="fup-item-badge" style="color:%s;background:%s;">%s</span>'
            '<div class="fup-item-text">%s</div></div></div>') % (bg, ico, col, col, bg, lab, tx)
new_block = ('<div class="fast-updates-panel-body" id="fastUpdatesBody">'
             '<div class="fup-version-header"><div class="fup-version-row"><i class="fa-solid fa-sparkles"></i> <span>Versão 2.3.25</span></div>'
             '<div class="fup-date-row"><i class="fa-solid fa-clock"></i> <span>Lançada em %s</span></div></div>' % DATA_PT
             + fup_item(*entries[0]) + fup_item(*entries[1]) + fup_item(*entries[2])
             + '</div>')
s = s[:body_start] + new_block + s[body_end:]
changes.append('fastUpdatesBody com itens 2.3.25')

# ============================================================
# 5) AUTO-VERIFICACAO antes de gravar
# ============================================================
if s.count('2.3.25') < 20:
    print('ALERTA: poucas marcas 2.3.25 (%d)' % s.count('2.3.25'))
mcl = re.search(r'name="fast-app-changelog" content="([^"]*)"', s)
import html as _h
arr = _h.unescape(mcl.group(1))
import json as _j
data = _j.loads(arr)  # excecao se invalido
top3 = [x['text'][:8] for x in data[:3]]
assert all(t == '2.3.25 (' for t in top3), top3
assert s.count('r140-launcher-drag') == 2   # style + js
assert '</body></html>' in s[-40:]

open(SRC, 'w', encoding='utf-8').write(s)
print('OK — %d alteracoes. Tamanho %d -> %d (+%d bytes)' % (len(changes), orig_len, len(s), len(s) - orig_len))
for c in changes: print('  + ' + c)
print('changelog JSON valido com %d itens; topo=%s' % (len(data), top3))
print('SHA-256:', hashlib.sha256(open(SRC, 'rb').read()).hexdigest())
