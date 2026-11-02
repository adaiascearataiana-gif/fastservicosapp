/* ============================================================
   MM IBNM — recursos para o culto (v0.4.0)
   1) Setlist do culto: músicas + hinos, em ordem, com
      "◀ Anterior | 2 de 6 | Próxima ▶"
   2) Tom do culto: o ADM define o tom de cada item; todos
      abrem já transpostos (cada um ainda pode mudar só para si)
   3) Modo projetor: letra grande, sem acordes, por estrofe
   4) Metrônomo e afinador
   5) Modo escuro (claro / escuro / automático)
============================================================ */
(function(){
'use strict';
const H = () => window.HINOS||[];
const hino = n => H().find(x=>x.n===+n);
const e = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const adm = () => { try{ return !!ehAdmin(); }catch(_){ return false; } };

/* ---------------- estilos ---------------- */
const css=`
.sl-nav{display:flex;align-items:stretch;gap:6px;margin:0 0 12px}
.sl-nav button{border:1px solid var(--verde-med);background:#fff;color:var(--verde-escuro);font-weight:800;font-size:13px;border-radius:10px;padding:8px 10px;min-height:42px;cursor:pointer;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sl-nav button:disabled{opacity:.35;cursor:default}
.sl-nav .mid{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 6px;font-size:11px;color:#789;font-weight:700;line-height:1.25;text-align:center}
.sl-nav .mid b{font-size:15px;color:var(--verde-escuro)}
.sl-acts{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
.sl-acts button{border:1px solid #c9ced6;background:#fff;color:var(--verde-escuro);font-weight:700;font-size:13px;border-radius:10px;height:38px;padding:0 12px;cursor:pointer}
.sl-acts button.gold{border-color:var(--dourado-esc);background:#fffbea}
.tom-culto{display:inline-block;background:var(--dourado);color:#3a2f00;font-size:10.5px;font-weight:800;border-radius:10px;padding:1px 7px;margin-left:6px;vertical-align:middle}
.sl-item .s-ic{font-size:15px;font-weight:900}
.sl-item .ord{font-size:11px;color:#789;font-weight:800;min-width:16px;text-align:center}
.sl-tom{font-size:11px;font-weight:800;color:#8a6a00;background:#fffbea;border:1px solid #efe1a5;border-radius:8px;padding:2px 7px;flex:none}
.pl-ed{border:1px solid #dde;border-radius:10px;padding:6px;max-height:260px;overflow:auto}
.pl-ed .it{display:flex;align-items:center;gap:6px;padding:6px 4px;border-bottom:1px solid #eef1ef;font-size:13.5px;color:var(--verde-escuro)}
.pl-ed .it:last-child{border:0}
.pl-ed .it .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.pl-ed .it button{border:1px solid #c9ced6;background:#fff;border-radius:7px;min-width:30px;height:30px;font-weight:800;color:var(--verde-escuro)}
.pl-ed .it .st{font-size:12px;font-weight:800;min-width:34px;text-align:center;color:#8a6a00}
.pl-add{display:flex;gap:6px;margin-top:8px}
.pl-ed .it{flex-wrap:wrap}
.pl-ed .it .nm{flex:1 1 0;min-width:0;white-space:normal;overflow:visible}
.pl-ed .it .ord{flex:none}
#modalBox .row2 input[type=date]{min-width:0;width:100%;box-sizing:border-box}
#modalBox .row2>.field{min-width:0}
.pl-busca{position:relative}
.pl-busca input{width:100%}
.pl-sug{display:flex;flex-direction:column;gap:4px;margin-top:6px;max-height:260px;overflow:auto}
.pl-sug:empty{display:none}
.pl-sug button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:1px solid #dfe7e3;background:#fff;border-radius:10px;padding:8px 10px;color:var(--verde-escuro)}
.pl-sug button:active{background:#eef6f2}
.pl-sug button.ja{opacity:.55}
.pl-sug .ic{font-size:18px}
.pl-sug .nmh{flex:none;min-width:40px;height:30px;border-radius:8px;background:var(--verde-escuro);color:#fff;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;padding:0 6px}
.pl-sug .tx{flex:1;min-width:0;display:flex;flex-direction:column}
.pl-sug .tx b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-sug .tx small{font-size:11.5px;color:#6b8378}
.pl-sug i{font-style:normal;font-size:11.5px;font-weight:800;color:var(--verde-med);white-space:nowrap}
.pl-sug .nada{font-size:12.5px;color:#9aa;padding:6px 4px}
.pl-tabs{display:flex;gap:6px;margin:0 0 12px}
.pl-tabs button{flex:1;height:42px;border-radius:12px;border:1px solid var(--verde-med);background:#fff;color:var(--verde-escuro);font-weight:800;font-size:13.5px}
.pl-tabs button.on{background:var(--verde-med);color:#fff}
.pl-tabs button i{font-style:normal;color:var(--dourado)}
.pl-eu{background:#fff8dc;border:1px solid #f0d97a;border-radius:12px;padding:10px 12px;font-size:13.5px;color:#5a4700;margin-bottom:12px}
.pl-dica{font-size:12.5px;color:#556;background:#eef6f2;border-radius:10px;padding:8px 10px;margin:-4px 0 10px}
.sl-ok{display:inline-block;font-size:10.5px;font-weight:800;color:#1c6b47;background:#e1f4ea;border-radius:8px;padding:1px 6px;margin-left:2px}
.pl-proxcard{cursor:pointer;border-left:5px solid var(--dourado)}
.pl-proxcard p{font-size:13.5px;color:#445;margin:2px 0 6px}
.pl-proxcard .lk{font-weight:800;color:var(--verde-med);font-size:13.5px}
.sl-yt{display:inline-flex;align-items:center;height:38px;padding:0 12px;border-radius:10px;background:#c4302b;color:#fff;font-weight:800;font-size:13px;text-decoration:none}
.pl-add select,.pl-add input{flex:1;min-width:0;padding:9px 10px;border:1px solid #ccd;border-radius:8px;font-size:14px}
.pl-add button{border:0;background:var(--verde-med);color:#fff;font-weight:800;border-radius:8px;padding:0 12px}
/* eventos da playlist */
.pl-ev{border:1px solid #dde;border-radius:10px;margin-bottom:8px;background:#fff;overflow:hidden}
.pl-ev.on{border-color:var(--verde-med);box-shadow:0 0 0 2px rgba(26,122,86,.12)}
.pl-ev-head{display:flex;align-items:center;gap:6px;padding:8px;flex-wrap:wrap}
.pl-ev-head .chev{border:1px solid #c9ced6;background:#f4f6f7;border-radius:7px;width:30px;height:30px;font-weight:900;color:var(--verde-escuro);flex:none}
.pl-ev-head .n{font-size:11px;font-weight:900;color:#789;width:16px;text-align:center;flex:none}
.pl-ev-head input.pl-ev-nome{flex:1;min-width:110px;padding:8px 9px;border:1px solid #ccd;border-radius:8px;font-size:14px;font-weight:700}
.pl-ev-head input.pl-ev-data{width:142px;padding:8px 9px;border:1px solid #ccd;border-radius:8px;font-size:13px;flex:none}
.pl-ev-qt{font-size:11px;font-weight:800;color:#8a6a00;background:#fffbea;border:1px solid #efe1a5;border-radius:8px;padding:2px 6px;flex:none}
.pl-ev-btns{display:flex;gap:4px;flex:none}
.pl-ev-btns button{border:1px solid #c9ced6;background:#fff;border-radius:7px;min-width:30px;height:30px;font-weight:800;color:var(--verde-escuro);cursor:pointer}
.pl-ev-btns button.rm{color:#c0392b}
.pl-ev-body{padding:0 8px 10px}
.pl-ev-body .field{margin-top:8px}
.pl-ev-add{width:100%;border:1.5px dashed var(--verde-med);background:#f2f9f6;color:var(--verde-escuro);font-weight:800;border-radius:10px;padding:11px;font-size:14px;cursor:pointer}
.pl-evv{border:1px solid #e3e8e5;border-left:4px solid var(--verde-med);border-radius:10px;padding:8px 10px;margin-bottom:10px;background:#fff}
.pl-evv.ok{border-left-color:#1c6b47;background:#f3fbf6}
.pl-evv-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}
.pl-evv-h .nn{font-size:11px;font-weight:900;color:#fff;background:var(--verde-med);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex:none}
.pl-evv-h b{font-size:14.5px;color:var(--verde-escuro);letter-spacing:.02em}
.pl-evv-h .dt{font-size:13px;font-weight:800;color:var(--verde-med);background:#eef6f2;border-radius:8px;padding:2px 7px}
.pl-evv-h .tag{font-size:11px;font-weight:800;color:#1c6b47;background:#e1f4ea;border-radius:8px;padding:2px 7px}
.pl-evv-h .mv{display:flex;gap:4px;margin-left:auto}
.pl-evv-h .mv button{border:1px solid #c9ced6;background:#fff;border-radius:7px;min-width:30px;height:30px;font-weight:800;color:var(--verde-escuro);cursor:pointer}
.pl-evv-vazio{font-size:12.5px;color:#9aa;padding:4px 2px 6px}
.pl-evv-ft{font-size:11.5px;color:#789;font-weight:700;margin-top:6px}
.pl-ev-todo{margin-top:8px;width:100%;border:1.5px solid #ea580c;background:#fff7ed;color:#c2410c;font-weight:900;border-radius:10px;min-height:44px;font-size:14.5px;letter-spacing:.6px;cursor:pointer}
.pl-ev-todo:active{background:#ffedd5;transform:translateY(1px)}
.pl-ev-ok{margin-top:8px;width:100%;border:1.5px solid #1c6b47;background:#e1f4ea;color:#1c6b47;font-weight:900;border-radius:10px;min-height:44px;font-size:14.5px;letter-spacing:.4px;display:flex;align-items:center;justify-content:center;text-align:center}
.pl-ev-done:active{background:#cdeede}
/* projetor */
.proj{position:fixed;inset:0;z-index:12000;background:#05110d;color:#f4f1e8;display:flex;flex-direction:column;user-select:none;-webkit-user-select:none}
.proj .bar{display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 6px;font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;color:#9fb8ad}
.proj .bar .tt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.proj .bar button{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#fff;border-radius:9px;height:36px;min-width:40px;font-size:15px;font-weight:700;padding:0 10px}
.proj .tela{flex:1;display:flex;align-items:center;justify-content:center;padding:4vh 6vw;text-align:center;overflow:hidden}
.proj .txt{white-space:pre-line;line-height:1.3;font-family:'Trebuchet MS','Segoe UI',system-ui,sans-serif;font-weight:700}
.proj .txt .rot{display:block;font-size:.42em;color:#f1c40f;letter-spacing:.08em;margin-bottom:.5em;font-weight:800}
.proj .txt.capa{color:#f1c40f}
.proj .rod{display:flex;justify-content:space-between;align-items:center;padding:6px 14px calc(12px + env(safe-area-inset-bottom,0px));font-family:'Segoe UI',system-ui,sans-serif;color:#7d968b;font-size:13px}
.proj .dots{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;flex:1}
.proj .dots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.22)}
.proj .dots i.on{background:#f1c40f}
/* ferramentas */
.ferr .big{font-size:54px;font-weight:900;text-align:center;color:var(--verde-escuro);line-height:1;margin:6px 0 2px;font-variant-numeric:tabular-nums}
.ferr .sub{text-align:center;font-size:12px;color:#789;margin-bottom:10px}
.ferr .linha{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:8px 0}
.ferr .linha button{border:1px solid #c9ced6;background:#f4f6f7;border-radius:10px;min-width:48px;height:42px;font-weight:800;font-size:15px;color:var(--verde-escuro);padding:0 12px}
.ferr .linha button.on{background:var(--verde-med);border-color:var(--verde-med);color:#fff}
.ferr .linha button.play{background:var(--dourado);border-color:var(--dourado-esc);color:#3a2f00;min-width:120px}
.ferr input[type=range]{width:100%;accent-color:var(--verde-med)}
.ferr .beats{display:flex;justify-content:center;gap:10px;margin:10px 0}
.ferr .beats i{width:18px;height:18px;border-radius:50%;background:#dfe6e2;transition:background .05s}
.ferr .beats i.on{background:var(--verde-med)}
.ferr .beats i.on.ac{background:var(--dourado)}
.ferr .tabs{display:flex;gap:6px;margin-bottom:10px}
.ferr .tabs button{flex:1;height:40px;border-radius:10px;border:1px solid var(--verde-med);background:#fff;color:var(--verde-escuro);font-weight:800}
.ferr .tabs button.on{background:var(--verde-med);color:#fff}
.afin .nota{font-size:64px;font-weight:900;text-align:center;color:var(--verde-escuro);line-height:1;margin-top:6px}
.afin .nota small{font-size:22px;color:#789}
.afin .med{position:relative;height:46px;margin:14px 6px 6px;border-radius:10px;background:linear-gradient(90deg,#f6d6d1,#fff5d6 40%,#d9f2e4 50%,#fff5d6 60%,#f6d6d1)}
.afin .med .c{position:absolute;left:50%;top:-4px;bottom:-4px;width:2px;background:var(--verde-escuro)}
.afin .med .p{position:absolute;top:4px;bottom:4px;width:6px;margin-left:-3px;border-radius:3px;background:#c0392b;left:50%;transition:left .08s}
.afin .med .p.ok{background:var(--verde-med)}
.afin .info{text-align:center;font-size:13px;color:#667;min-height:1.4em}
.afin-inst{width:100%;height:42px;border-radius:10px;border:1px solid #cfdad4;background:#fff;font-size:14.5px;font-weight:700;color:var(--verde-escuro);padding:0 10px;margin-bottom:8px}
.afin-cordas{display:flex;gap:6px;justify-content:center}
.afin-cordas button{flex:1;max-width:62px;border:2px solid #cfdad4;background:#fff;border-radius:12px;padding:4px 0 6px;font-size:20px;font-weight:900;color:var(--verde-escuro);line-height:1.05;display:flex;flex-direction:column;align-items:center}
.afin-cordas button small{font-size:10px;font-weight:800;color:#8a9}
.afin-cordas button i{font-style:normal;font-size:10px;color:#8a9;font-weight:700}
.afin-cordas button.alvo{border-color:var(--dourado-esc)}
.afin-cordas button.on{background:#fde4df;border-color:#c0392b}
.afin-cordas button.ok{background:#d9f2e4;border-color:var(--verde-med)}
.metro-pill{position:fixed;right:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9998;display:flex;align-items:center;gap:6px;background:var(--verde-escuro);color:#fff;border-radius:999px;padding:6px 6px 6px 12px;box-shadow:0 6px 18px rgba(0,0,0,.3);font-weight:800;font-size:14px}
.metro-pill .lt{width:10px;height:10px;border-radius:50%;background:#2a4}
.metro-pill .lt.on{background:#f1c40f}
.metro-pill button{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:999px;height:32px;min-width:32px;font-weight:800}
/* tema */
.tema-opts{display:flex;gap:6px}
.tema-opts button{flex:1;height:40px;border-radius:10px;border:1px solid var(--verde-med);background:#fff;color:var(--verde-escuro);font-weight:700;font-size:13px}
.tema-opts button.on{background:var(--verde-med);color:#fff}
/* modo escuro: inverte a área de conteúdo e as janelas, mantendo fotos/vídeos com as cores reais */
html.escuro body,html.escuro .app-shell{background:#0e1613}
html.escuro .content,html.escuro .modal,html.escuro .cc-sheet{filter:invert(.92) hue-rotate(180deg)}
html.escuro .content img:not(.cc-intro img),html.escuro .content iframe,html.escuro .content video,html.escuro .modal img,html.escuro .content .s-ic,html.escuro .cc-sheet img{filter:invert(1) hue-rotate(180deg)}
html.escuro .cc-intro img{opacity:.92}
html.escuro .watermark{opacity:.04}
`;
const st=document.createElement('style'); st.id='ibnmCulto'; st.textContent=css; document.head.appendChild(st);

/* ================= 5) TEMA ================= */
const TEMA_KEY='ibnm_tema';
function temaAtual(){ return localStorage.getItem(TEMA_KEY)||'claro'; }
const mq=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null;
function aplicarTema(){
  const t=temaAtual(); const escuro = t==='escuro' || (t==='auto' && mq && mq.matches);
  document.documentElement.classList.toggle('escuro',escuro);
  const m=document.querySelector('meta[name=theme-color]'); if(m) m.setAttribute('content', escuro?'#07241b':'#0b3d2e');
}
window.definirTema=function(t){ localStorage.setItem(TEMA_KEY,t); aplicarTema(); if(typeof go==='function' && document.querySelector('.tema-opts')) go('perfil'); };
if(mq && mq.addEventListener) mq.addEventListener('change',aplicarTema);
aplicarTema();
function cardTema(){
  const t=temaAtual(); const b=(v,l)=>'<button class="'+(t===v?'on':'')+'" onclick="definirTema(\''+v+'\')">'+l+'</button>';
  return '<div class="card"><h3>🌙 Aparência</h3><p style="font-size:12.5px;color:#556;margin-bottom:8px">O modo escuro cansa menos a vista em cultos à noite e no palco.</p><div class="tema-opts">'+b('claro','☀️ Claro')+b('escuro','🌙 Escuro')+b('auto','📱 Do celular')+'</div></div>';
}
if(typeof ROTAS!=='undefined' && ROTAS.perfil){
  const _p=ROTAS.perfil;
  ROTAS.perfil=function(){ const html=_p.apply(this,arguments); const i=html.lastIndexOf('</div>'); return i>=0? html.slice(0,i)+cardTema()+html.slice(i) : html+cardTema(); };
}

/* ================= 1) SETLIST DO CULTO ================= */
const pad2=n=>String(n).padStart(2,'0');
const hojeISO=()=>{ const d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); };
function normSl(x,chave){ if(!x||!Array.isArray(x.itens)||!x.itens.length) return null;
  return {inicio:String(x.inicio||'').slice(0,10),fim:String(x.fim||'').slice(0,10),itens:x.itens.filter(existe),tons:x.tons||{},youtube:x.youtube||'',
    eventos:(Array.isArray(x.eventos)&&x.eventos.length)? x.eventos : null,chave}; }
/* qual: (vazio) = esta semana · 'prox' = próxima semana.
   A da próxima semana vira "esta semana" sozinha quando chega a data de início. */
function setlist(qual){
  const C=(typeof APP_CFG!=='undefined'&&APP_CFG)||{};
  const a=normSl(C.setlist,'setlist'), p=normSl(C.setlist_prox,'setlist_prox');
  const pVale = p && p.inicio && p.inicio<=hojeISO();
  if(qual==='prox') return pVale? null : p;
  if(pVale) return p;
  if(a) return a;
  const pl=(typeof DB!=='undefined'&&DB.playlist)||{};
  if(pl.publicada && pl.musicas && pl.musicas.length) return {inicio:pl.inicio,fim:pl.fim,itens:pl.musicas.filter(existe),tons:{},youtube:'',eventos:(Array.isArray(pl.eventos)&&pl.eventos.length)?pl.eventos:null,chave:'setlist'};
  return null;
}
window.setlistDe=setlist;
/* de qual lista é este item (para "Anterior/Próxima" e tom do culto) */
function listaDe(id){
  id=String(id); const ctx=window.__slCtx; const at=setlist(), px=setlist('prox');
  const tem=l=>l&&l.itens.indexOf(id)>=0;
  if(ctx==='prox' && tem(px)) return px;
  if(tem(at)) return at;
  if(tem(px)) return px;
  return null;
}
function existe(id){ id=String(id); if(id.indexOf('cc:')===0) return !!hino(id.slice(3)); return !!(DB.musicas||[]).find(m=>m.id===id); }
function info(id){
  id=String(id);
  if(id.indexOf('cc:')===0){ const h=hino(id.slice(3)); return {hino:true,ic:'📖',t:h?h.n+' · '+h.titulo:'Hino '+id.slice(3),s:'Cantor Cristão'+(h&&h.ritmo?' · '+h.ritmo:''),tom:h?h.tom:''}; }
  const m=(DB.musicas||[]).find(x=>x.id===id)||{}; return {hino:false,ic:'🎵',t:m.titulo||'(música removida)',s:m.artista||'',tom:''};
}
window.abrirItem=function(id,ctx){ id=String(id); if(ctx!==undefined) window.__slCtx=ctx; if(id.indexOf('cc:')===0){ if(window.cantorAbrir) cantorAbrir(+id.slice(3)); } else abrirMusica(id,'cifra'); };
function rotuloSemitom(v){ return v? (v>0?'+':'')+v : ''; }
function disponivel(id){
  if(String(id).indexOf('cc:')===0) return '<span class="sl-ok">letra · cifra</span>';
  const m=(DB.musicas||[]).find(x=>x.id===id)||{}; const t=[];
  if(m.cifra) t.push('cifra'); if(m.letra) t.push('letra'); if((m.audios&&m.audios.length)||m.youtube) t.push('áudio');
  return t.length? '<span class="sl-ok">'+t.join(' · ')+'</span>' : '';
}
function linhaItem(id,i,sl,ctx){
  const f=info(id); const v=(sl.tons||{})[id]||0;
  let tom='';
  if(v && f.hino && window.Cantor){ try{ const h=hino(id.slice(3)); tom='Tom '+Cantor.keyInfo(h,v).key; }catch(_){} }
  else if(v) tom='Tom '+rotuloSemitom(v);
  return '<div class="song-row sl-item" onclick="abrirItem(\''+id+'\',\''+(ctx||'')+'\')"><span class="ord">'+(i+1)+'</span><div class="s-ic">'+f.ic+'</div><div style="flex:1;min-width:0"><div class="s-nm">'+e(f.t)+'</div><div class="s-ar">'+e(f.s)+' '+disponivel(id)+'</div></div>'+(tom?'<span class="sl-tom">'+e(tom)+'</span>':'')+'</div>';
}
function cardSetlist(sl,titulo,ctx){
  ctx=ctx||'';
  return '<div class="card"><h3>'+titulo+'</h3>'+sl.itens.map((id,i)=>linhaItem(id,i,sl,ctx)).join('')+
    '<div class="sl-acts" style="margin:10px 0 0"><button class="gold" onclick="abrirItem(\''+sl.itens[0]+'\',\''+ctx+'\')">▶ Começar pelo 1º</button><button onclick="projetarSetlist(\''+ctx+'\')">📺 Projetar tudo</button>'+
    (sl.youtube?'<a class="sl-yt" href="'+e(sl.youtube)+'" target="_blank" rel="noopener">▶ Playlist no YouTube</a>':'')+'</div></div>';
}

/* ================= EVENTOS DA PLAYLIST ================= */
const evtUid=()=> 'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const pad2b=n=>String(n).padStart(2,'0');
function isoShift(iso,n){ if(!iso) return ''; const p=String(iso).slice(0,10).split('-').map(Number); if(p.length!==3||!p[0]) return '';
  const t=new Date(p[0],p[1]-1,p[2]+n); return t.getFullYear()+'-'+pad2b(t.getMonth()+1)+'-'+pad2b(t.getDate()); }
function dataBR(iso){ const p=String(iso||'').slice(0,10).split('-'); return (p.length===3)? p[2]+'/'+p[1] : ''; }
function dataBRAno(iso){ const p=String(iso||'').slice(0,10).split('-'); return (p.length===3)? p[2]+'/'+p[1]+'/'+p[0] : ''; }
const DIAS=['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO'];
function diaSemana(iso){ if(!iso) return ''; const p=String(iso).slice(0,10).split('-').map(Number); if(p.length!==3||!p[0]) return '';
  return DIAS[new Date(p[0],p[1]-1,p[2]).getDay()]; }
/* modelo de eventos da semana anterior: mesmos nomes, datas +7 dias quando caem na semana alvo */
function seedEventos(evs,ini,fim){
  if(!Array.isArray(evs)||!evs.length||!ini||!fim) return null;
  const out=JSON.parse(JSON.stringify(evs));
  out.forEach(x=>{ x.id=evtUid(); x.concluido=false; x.concluido_em=null;
    x.itens=Array.isArray(x.itens)? x.itens.filter(existe):[];
    if(x.data){ for(let k=0;k<6 && (x.data<ini||x.data>fim);k++) x.data=isoShift(x.data,7); if(x.data<ini||x.data>fim) x.data=''; }
    else x.data='';
    x.nome=String(x.nome||'CULTO'); });
  return out;
}
function packSl(sl,evs){
  const itens=[]; (evs||[]).forEach(x=>(x.itens||[]).forEach(id=>{ if(itens.indexOf(id)<0) itens.push(id); }));
  return {inicio:sl.inicio,fim:sl.fim,itens:evs? itens : (sl.itens||[]).slice(),tons:Object.assign({},sl.tons||{}),youtube:sl.youtube||'',
    eventos:evs? evs : (sl.eventos||null)};
}
/* linha do histórico "músicas já cantadas" (tabela musicas_cantadas) */
function linhaCantada(id,ev,sl){
  const v=(sl.tons||{})[id]||0;
  const data=dataBRAno(ev.data)||dataBRAno(sl.inicio);
  const dia=diaSemana(ev.data)||diaSemana(sl.inicio);
  const evento=String(ev.nome||'EVENTO').trim()||'EVENTO';
  if(String(id).indexOf('cc:')===0){
    const h=hino(id.slice(3)); let tom='';
    if(v&&h&&window.Cantor){ try{ tom=Cantor.keyInfo(h,v).key; }catch(_){} }
    return {data,dia,evento,musica:(h?h.titulo:'Hino '+id.slice(3))+' - '+id.slice(3),artista:'Cantor Cristão',tom,web:''};
  }
  const m=(DB.musicas||[]).find(x=>x.id===id)||{};
  return {data,dia,evento,musica:m.titulo||'',artista:m.artista||'',tom:v?rotuloSemitom(v):'',web:m.youtube||''};
}
/* Grava os eventos do setlist em "Músicas já cantadas" (idempotente):
   só insere música+data que ainda não existe. Chamado automaticamente a
   cada salvamento da playlist e também pelo concluirEvento. */
let _gravandoEv=false;
async function gravarEventos(sl){
  if(!sl||!Array.isArray(sl.eventos)||!sl.eventos.length) return 0;
  if(_gravandoEv) return 0;
  _gravandoEv=true;
  try{
    const normC=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const ex=await sb.from('musicas_cantadas').select('musica,data').limit(10000);
    if(ex.error) throw ex.error;
    const tem=new Set((ex.data||[]).map(r=>normC(r.musica)+'|'+String(r.data||'').trim()));
    const rows=[];
    (sl.eventos||[]).forEach(ev=>{
      if(!ev||!(ev.itens||[]).length) return;
      ev.itens.forEach(id=>{
        const r=linhaCantada(id,ev,sl);
        if(!r.musica||!r.data) return;
        const k=normC(r.musica)+'|'+String(r.data).trim();
        if(tem.has(k)) return;
        tem.add(k);
        rows.push(r);
      });
    });
    if(!rows.length) return 0;
    const ult=await sb.from('musicas_cantadas').select('ordem').order('ordem',{ascending:false}).limit(1);
    if(ult.error) throw ult.error;
    const base=(ult.data&&ult.data[0]&&typeof ult.data[0].ordem==='number')? ult.data[0].ordem : 0;
    rows.forEach((r,k)=>{ r.ordem=base+k+1; });
    const {error}=await sb.from('musicas_cantadas').insert(rows);
    if(error) throw error;
    try{ if(typeof cloudCantadas==='function') await cloudCantadas(); }catch(_){}
    return rows.length;
  }finally{ _gravandoEv=false; }
}
/* ADM encerra o evento: grava as músicas em musicas_cantadas e marca como concluído */
window.concluirEvento=async function(ctx,i){
  if(!adm()) return;
  const sl=setlist(ctx==='prox'?'prox':'');
  if(!sl||!Array.isArray(sl.eventos)||!sl.eventos[i]) return;
  const ev=sl.eventos[i];
  if(ev.concluido) return;
  if(!(ev.itens||[]).length) return toast('Este evento não tem músicas.');
  const nm=String(ev.nome||'EVENTO').trim()||'EVENTO';
  if(!window.confirm('Encerrar o evento "'+nm+'"'+(ev.data?' em '+dataBR(ev.data):'')+'?\n\nAs '+ev.itens.length+' música(s) serão enviadas automaticamente para "Músicas já cantadas".\n(Ação só pode ser desfeita pelo ADM)')) return;
  const rows=ev.itens.map(id=>linhaCantada(id,ev,sl)).filter(r=>r.musica);
  if(!rows.length) return toast('Nada para registrar.');
  let gravadas=0;
  try{
    gravadas=await gravarEventos({inicio:sl.inicio,fim:sl.fim,tons:sl.tons||{},eventos:[ev]});
  }catch(err){ return toast('Erro ao gravar no histórico: '+(err.message||err)); }
  ev.concluido=true; ev.concluido_em=new Date().toISOString();
  const evs=JSON.parse(JSON.stringify(sl.eventos));
  await salvarConfig(sl.chave||'setlist',packSl(sl,evs));
  if(typeof cloudCantadas==='function'){ try{ await cloudCantadas(); }catch(_){} }
  if(gravadas) toast('🎉 Evento "'+nm+'" concluído! '+gravadas+' música(s) no histórico.');
  else toast(rows[0]&&rows[0].data ? '🎉 Evento "'+nm+'" concluído! Já constava no histórico.' : '⚠️ Evento "'+nm+'" concluído, mas sem data para registrar.');
  redesenhar();
};
/* ADM: reordenar eventos direto na visualização */
let _plReord=false, _plReordEvs=null, _plReordCtx='';
window.plReordenar=function(ctx){
  if(!adm()) return;
  if(_plReord && _plReordCtx===ctx){
    const sl=setlist(ctx==='prox'?'prox':''); if(!sl) { _plReord=false; return redesenhar(); }
    const evs=JSON.parse(JSON.stringify(_plReordEvs||sl.eventos||[]));
    salvarConfig(sl.chave||'setlist',packSl(sl,evs)).then(()=>{ _plReord=false; _plReordEvs=null; toast('Ordem dos eventos salva!'); redesenhar(); });
    return;
  }
  const sl=setlist(ctx==='prox'?'prox':''); if(!sl||!sl.eventos||!sl.eventos.length) return;
  _plReord=true; _plReordCtx=ctx; _plReordEvs=JSON.parse(JSON.stringify(sl.eventos));
  redesenhar();
};
window.plReordMov=function(i,d){
  const j=i+d; if(!_plReordEvs||j<0||j>=_plReordEvs.length) return;
  const a=_plReordEvs; [a[i],a[j]]=[a[j],a[i]]; redesenhar();
};
function cardEventos(sl,titulo,ctx){
  ctx=ctx||''; const a=adm();
  const evs=(_plReord&&_plReordCtx===ctx&&_plReordEvs)? _plReordEvs : (sl.eventos||[]);
  let h='<div class="card"><h3>'+titulo+'</h3>';
  evs.forEach((ev,i)=>{
    const done=!!ev.concluido;
    h+='<div class="pl-evv'+(done?' ok':'')+'"><div class="pl-evv-h"><span class="nn">'+(i+1)+'</span>'+
      '<b>'+e(String(ev.nome||'EVENTO').trim()||'EVENTO')+'</b>'+
      (ev.data?'<span class="dt">'+dataBR(ev.data)+'</span>':'')+
      (done?'<span class="tag">✅ Concluído</span>':'')+
      (_plReord&&_plReordCtx===ctx? '<span class="mv"><button onclick="plReordMov('+i+',-1)" aria-label="Subir evento">↑</button><button onclick="plReordMov('+i+',1)" aria-label="Descer evento">↓</button></span>':'')+
      '</div><div>';
    h+=(ev.itens&&ev.itens.length)? ev.itens.map((id,k)=>linhaItem(id,k,sl,ctx)).join('') : '<p class="pl-evv-vazio">Nenhuma música neste evento ainda.</p>';
    h+='</div>';
    if(a && !(_plReord&&_plReordCtx===ctx)){
      h+= done
        ? '<div class="pl-ev-ok">✅ EVENTO CONCLUÍDO - HISTÓRICO ENVIADO</div>'
        : '<button class="pl-ev-todo" onclick="concluirEvento(\''+ctx+'\','+i+')">CONCLUIR EVENTO</button>';
    }
    h+='</div>';
  });
  h+='</div>';
  if(a){
    h+='<div class="sl-acts" style="margin-top:12px">'+
      '<button onclick="modalPlaylist(\''+(ctx==='prox'?'prox':'')+'\')">➕ Adicionar evento</button>'+
      '<button class="'+(_plReord&&_plReordCtx===ctx?'gold':'')+'" onclick="plReordenar(\''+(ctx==='prox'?'prox':'')+'\')">'+((_plReord&&_plReordCtx===ctx)?'✅ Salvar ordem dos eventos':'↕ Reorganizar eventos')+'</button>'+
      '</div>';
    if(_plReord&&_plReordCtx===ctx) h+='<div class="pl-dica">Toque em ↑ e ↓ para mudar a ordem e depois em <b>Salvar ordem dos eventos</b>.</div>';
  }
  return h;
}
function cardSetlistSmart(sl,titulo,ctx){ return (sl.eventos&&sl.eventos.length)? cardEventos(sl,titulo,ctx) : cardSetlist(sl,titulo,ctx); }

if(typeof ROTAS!=='undefined'){
  let abaPl='';
  ROTAS.playlist=function(arg){
    if(arg==='prox'||arg==='atual') abaPl=arg==='prox'?'prox':'';
    const a=adm(); const at=setlist(), px=setlist('prox'); const prox=abaPl==='prox';
    const sl=prox? px : at;
    const tabs='<div class="pl-tabs"><button class="'+(!prox?'on':'')+'" onclick="go(\'playlist\',\'atual\')">📅 Esta semana</button><button class="'+(prox?'on':'')+'" onclick="go(\'playlist\',\'prox\')">🗓️ Próxima semana'+(px?' <i>●</i>':'')+'</button></div>';
    const bt=a?'<button class="mini-btn" style="margin-bottom:14px" onclick="modalPlaylist(\''+(prox?'prox':'')+'\')">✏️ '+(prox?'Montar playlist da próxima semana':'Montar / editar playlist desta semana')+'</button>':'';
    const topo='<div class="page-ttl">📅 Playlist</div>'+tabs+bt;
    if(!sl||!sl.itens.length) return '<div class="page">'+topo+'<div class="empty"><div class="big">🎼</div>'+(prox?'A playlist da próxima semana ainda não foi publicada.':'Nenhuma playlist publicada para esta semana.')+'</div></div>';
    /* título usa a 1ª e a última data dos eventos (se houver) */
    const _dts=(sl.eventos||[]).map(x=>String(x.data||'').slice(0,10)).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
    const _dt1=_dts.length? _dts[0] : sl.inicio, _dt2=_dts.length? _dts[_dts.length-1] : sl.fim;
    const eu=escaladoNoPeriodo(sl);
    return '<div class="page">'+topo+'<div class="semana-badge"><div class="lbl">'+(prox?'PLAYLIST DA PRÓXIMA SEMANA':'PLAYLIST DA SEMANA')+'</div><div class="dt">'+fmtData(_dt1)+' - '+fmtData(_dt2)+'</div></div>'+
      (eu?'<div class="pl-eu">📍 Você está escalado(a) neste período'+(eu!==true?' — '+e(eu):'')+'. Toque nas músicas para ver letra, cifra e áudio.</div>':'')+
      cardSetlistSmart(sl,(sl.eventos&&sl.eventos.length)? 'Eventos da semana ('+sl.itens.length+' música(s)/hino(s))' : 'Ordem do culto ('+sl.itens.length+')',prox?'prox':'')+'</div>';
  };
  if(ROTAS.inicio){
    const _ini=ROTAS.inicio;
    ROTAS.inicio=function(){
      let html=_ini.apply(this,arguments); const sl=setlist();
      const k=html.indexOf('<div class="card"><h3>Músicas da playlist</h3>');
      if(k>=0){ const fim=html.lastIndexOf('</div>'); html=html.slice(0,k)+(sl?cardSetlistSmart(sl,'Ordem do culto'):'')+html.slice(fim); }
      else if(sl){ const fim=html.lastIndexOf('</div>'); html=html.slice(0,fim)+cardSetlistSmart(sl,'Ordem do culto')+html.slice(fim); }
      const px=setlist('prox');
      if(px){ const eu=escaladoNoPeriodo(px); const fim=html.lastIndexOf('</div>');
        html=html.slice(0,fim)+'<div class="card pl-proxcard" onclick="go(\'playlist\',\'prox\')"><h3>🗓️ Playlist da próxima semana</h3><p>'+fmtData(px.inicio)+' - '+fmtData(px.fim)+' · '+px.itens.length+' música(s)/hino(s)'+(eu?'<br><b>📍 Você está escalado(a) — já pode ensaiar!</b>':'')+'</p><span class="lk">Ver letras e cifras ›</span></div>'+html.slice(fim); }
      return html;
    };
  }
}

/* escalados entre as datas da playlist */
function linhasNoPeriodo(sl){
  const out=[]; try{ const E=escalaAtiva(); if(!E||!E.linhas) return out;
    E.linhas.forEach((l,i)=>{ const inf=window.__escLinhaInfo? __escLinhaInfo(i) : null; if(!inf||!inf.dt) return;
      const iso=inf.dt.getFullYear()+'-'+pad2(inf.dt.getMonth()+1)+'-'+pad2(inf.dt.getDate());
      if(iso>=sl.inicio && iso<=sl.fim) out.push(l); }); }catch(_){}
  return out;
}
function escaladosNoPeriodo(sl){ const ls=linhasNoPeriodo(sl); return (DB.usuarios||[]).filter(u=>ls.some(l=>colsDoUsuarioNaLinha(l,u).length)); }
function escaladoNoPeriodo(sl){
  const u=(typeof usuarioAtual==='function')&&usuarioAtual(); if(!u||!sl) return false;
  for(const l of linhasNoPeriodo(sl)){ const c=colsDoUsuarioNaLinha(l,u); if(c.length) return c.map(x=>String(x).toLowerCase().replace(/(^|\s)(\S)/g,(m,a,b)=>a+b.toUpperCase())).join(', '); }
  return false;
}
/* ---- editor da playlist (ADM): músicas + hinos com busca, ordem, tom e link do YouTube ---- */
let _ed=null;
const semAc = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function proxSemana(){ const d=new Date(); const w=(d.getDay()+6)%7; const s=new Date(d); s.setDate(d.getDate()-w+7); const f=new Date(s); f.setDate(s.getDate()+6);
  const iso=x=>x.getFullYear()+'-'+pad2(x.getMonth()+1)+'-'+pad2(x.getDate()); return [iso(s),iso(f)]; }
window.modalPlaylist=function(qual){
  const prox=qual==='prox';
  const pl=DB.playlist||{};
  let sl=setlist(prox?'prox':'');
  if(!sl){ const [a,b]=prox?proxSemana():[String(pl.inicio||'').slice(0,10),String(pl.fim||'').slice(0,10)]; sl={inicio:a,fim:b,itens:[],tons:{},youtube:''}; }
  const ini=String(sl.inicio||'').slice(0,10), fim=String(sl.fim||'').slice(0,10);
  /* eventos: os desta playlist; se vazios, herda da outra semana (nomes salvos, datas +7) */
  let evs=sl.eventos? JSON.parse(JSON.stringify(sl.eventos)) : null;
  if(!evs){ const outro=setlist(prox?'':'prox'); if(outro&&outro.eventos) evs=seedEventos(outro.eventos,ini,fim); }
  if(!evs && sl.itens.length) evs=[{id:evtUid(),nome:'CULTO',data:'',itens:sl.itens.slice(),concluido:false}];
  if(!evs) evs=[];
  _ed={qual:prox?'prox':'',inicio:ini,fim:fim,evs,tons:Object.assign({},sl.tons),youtube:sl.youtube||'',chave:sl.chave||(prox?'setlist_prox':'setlist'),
    aberto: evs.length? evs[0].id : null};
  abrirModal('<h3>'+(prox?'🗓️ Playlist da próxima semana':'📅 Playlist desta semana')+'</h3>'+
    (prox?'<p class="pl-dica">Ao publicar, quem está escalado entre as datas abaixo recebe a notificação e já pode ver letras, cifras e áudios.</p>':'')+
    '<div class="row2"><div class="field"><label>Início</label><input type="date" id="plIni" value="'+_ed.inicio+'"></div><div class="field"><label>Fim</label><input type="date" id="plFim" value="'+_ed.fim+'"></div></div>'+
    '<div class="pl-dica">📌 <b>Eventos da semana</b> — dê o nome (CULTO, EBD, ANIVERSÁRIO…), escolha a data, busque as músicas com o evento aberto e reordene com ↑↓. Ao salvar, os nomes ficam guardados e já aparecem na próxima playlist.</div>'+
    '<div id="plEvts"></div>'+
    '<button type="button" class="pl-ev-add" onclick="plEvAdd()">➕ Adicionar evento</button>'+
    '<div class="field"><label>▶️ Playlist do YouTube (opcional)</label><input id="plYt" type="url" inputmode="url" placeholder="Cole aqui o link da playlist do YouTube" value="'+e(_ed.youtube)+'"></div>'+
    (prox?'<label class="check-inline" style="color:var(--verde-escuro)"><input type="checkbox" id="plTodos"> Avisar também todos os membros</label>':'')+
    '<div class="modal-acts"><button class="btn btn-dark" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="plPub" onclick="publicarPlaylist()">📢 Publicar</button></div>');
  renderEvts();
};
function evAberto(){ return (_ed&&Array.isArray(_ed.evs))? (_ed.evs.find(x=>x.id===_ed.aberto)||null) : null; }
function jaNoEv(id){ const ev=evAberto(); return !!ev && ev.itens.indexOf(String(id))>=0; }
function renderEvts(){
  const box=document.getElementById('plEvts'); if(!box||!_ed) return;
  if(!_ed.evs.length){ box.innerHTML='<p style="font-size:13px;color:#9aa;padding:6px 2px">Nenhum evento ainda — toque em <b>Adicionar evento</b>.</p>'; return; }
  box.innerHTML=_ed.evs.map((ev,i)=>{
    const on=_ed.aberto===ev.id;
    return '<div class="pl-ev'+(on?' on':'')+'"><div class="pl-ev-head">'+
      '<button type="button" class="chev" onclick="plEvAbre(\''+ev.id+'\')" aria-label="Abrir evento">'+(on?'▾':'▸')+'</button>'+
      '<span class="n">'+(i+1)+'</span>'+
      '<input class="pl-ev-nome" type="text" placeholder="Nome do evento (CULTO, EBD…)" value="'+e(ev.nome||'')+'" oninput="plEvNome(\''+ev.id+'\',this.value)">'+
      '<input class="pl-ev-data" type="date" value="'+e(ev.data||'')+'" onchange="plEvData(\''+ev.id+'\',this.value)">'+
      '<span class="pl-ev-qt" id="qt-'+ev.id+'">'+(ev.itens||[]).length+' música(s)</span>'+
      '<span class="pl-ev-btns">'+
        '<button type="button" onclick="plEvMov(\''+ev.id+'\',-1)" aria-label="Subir evento">↑</button>'+
        '<button type="button" onclick="plEvMov(\''+ev.id+'\',1)" aria-label="Descer evento">↓</button>'+
        '<button type="button" class="rm" onclick="plEvDel(\''+ev.id+'\')" aria-label="Remover evento">✕</button>'+
      '</span></div>'+
      (on? '<div class="pl-ev-body">'+
        '<div class="pl-ed" id="plLista"></div>'+
        '<div class="field pl-busca"><label>🎵 Músicas do ministério</label><input id="plMusQ" type="search" autocomplete="off" placeholder="Digite o nome da música ou do artista" oninput="plSugMus()" onkeydown="plEnter(event,\'mus\')" onblur="setTimeout(()=>{const b=document.getElementById(\'plMusSug\'); if(b) b.innerHTML=\'\';},200)"><div class="pl-sug" id="plMusSug"></div></div>'+
        '<div class="field pl-busca"><label>📖 Hinos do Cantor Cristão</label><input id="plHinoQ" type="search" autocomplete="off" placeholder="Digite o número ou o nome do hino" oninput="plSugHino()" onkeydown="plEnter(event,\'hino\')" onblur="setTimeout(()=>{const b=document.getElementById(\'plHinoSug\'); if(b) b.innerHTML=\'\';},200)"><div class="pl-sug" id="plHinoSug"></div></div>'+
      '</div>' : '')+
    '</div>';
  }).join('');
  renderLista();
}
window.plEvAbre=function(id){ _ed.aberto=(_ed.aberto===id? null : id); renderEvts(); };
window.plEvAdd=function(){
  const ev={id:evtUid(),nome:'CULTO',data:'',itens:[],concluido:false};
  _ed.evs.push(ev); _ed.aberto=ev.id; renderEvts();
  const inp=document.querySelector('#plEvts .pl-ev.on .pl-ev-nome');
  if(inp){ inp.focus(); inp.select(); }
};
window.plEvNome=function(id,v){ const ev=_ed.evs.find(x=>x.id===id); if(ev) ev.nome=v; };
window.plEvData=function(id,v){ const ev=_ed.evs.find(x=>x.id===id); if(ev) ev.data=v; };
window.plEvMov=function(id,d){
  const i=_ed.evs.findIndex(x=>x.id===id), j=i+d;
  if(i<0||j<0||j>=_ed.evs.length) return;
  const a=_ed.evs; [a[i],a[j]]=[a[j],a[i]]; renderEvts();
};
window.plEvDel=function(id){
  const i=_ed.evs.findIndex(x=>x.id===id); if(i<0) return;
  const ev=_ed.evs[i];
  if((ev.itens||[]).length && !window.confirm('Remover o evento "'+(ev.nome||'EVENTO')+'" e as músicas dele da playlist?')) return;
  _ed.evs.splice(i,1);
  if(_ed.aberto===id) _ed.aberto=_ed.evs.length? _ed.evs[0].id : null;
  renderEvts();
};
function renderLista(){
  const box=document.getElementById('plLista'); if(!box) return;
  const ev=evAberto(); if(!ev) return;
  box.innerHTML=(ev.itens||[]).map((id,i)=>{ const f=info(id); const v=_ed.tons[id]||0;
    return '<div class="it"><span>'+(i+1)+'. '+f.ic+'</span><span class="nm">'+e(f.t)+'</span><span style="flex-basis:100%;height:0"></span>'+
      '<button type="button" onclick="plTom('+i+',-1)" aria-label="Baixar tom">−</button><span class="st">'+(v?rotuloSemitom(v):'tom')+'</span><button type="button" onclick="plTom('+i+',1)" aria-label="Subir tom">+</button>'+
      '<button type="button" onclick="plMov('+i+',-1)" aria-label="Subir na ordem">↑</button><button type="button" onclick="plMov('+i+',1)" aria-label="Descer na ordem">↓</button><button type="button" onclick="plDel('+i+')" aria-label="Remover" style="color:#c0392b">✕</button></div>'; }).join('')
    || '<p style="font-size:13px;color:#9aa;padding:8px">Busque abaixo e toque na música ou no hino para adicionar.</p>';
  const qt=document.getElementById('qt-'+ev.id); if(qt) qt.textContent=(ev.itens||[]).length+' música(s)';
}
window.plTom=function(i,d){ const ev=evAberto(); if(!ev) return; const id=ev.itens[i]; let v=(((((_ed.tons[id]||0)+d)%12)+12)%12); if(v>6) v-=12; if(v) _ed.tons[id]=v; else delete _ed.tons[id]; renderLista(); };
window.plMov=function(i,d){ const ev=evAberto(); if(!ev) return; const j=i+d; if(j<0||j>=ev.itens.length) return; const a=ev.itens; [a[i],a[j]]=[a[j],a[i]]; renderLista(); };
window.plDel=function(i){ const ev=evAberto(); if(!ev) return; const id=ev.itens.splice(i,1)[0]; delete _ed.tons[id]; renderLista(); };
function plAdd(id){
  const ev=evAberto();
  if(!ev) return toast('Abra um evento (toque ▸ nele) para adicionar música.');
  if(ev.itens.includes(id)){ toast('Já está neste evento.'); return; }
  ev.itens.push(id); renderLista(); toast('Adicionado: '+info(id).t);
}
/* busca de músicas do ministério (título ou artista) */
function achaMus(q){
  q=semAc(q); if(!q) return [];
  const ts=q.split(/\s+/);
  return (DB.musicas||[]).filter(m=>{ const t=semAc(m.titulo+' '+(m.artista||'')); return ts.every(x=>t.includes(x)); })
    .sort((a,b)=>(semAc(a.titulo).startsWith(q)?0:1)-(semAc(b.titulo).startsWith(q)?0:1)||a.titulo.localeCompare(b.titulo,'pt')).slice(0,8);
}
/* busca de hinos (número ou título) */
function achaHino(q){
  q=String(q||'').trim(); if(!q) return [];
  const H=(window.HINOS||[]).filter(h=>!h.missing);
  if(/^\d+$/.test(q)){ const ex=H.filter(h=>String(h.n)===q), ini=H.filter(h=>String(h.n).startsWith(q)&&String(h.n)!==q); return ex.concat(ini).slice(0,8); }
  const n=semAc(q), ts=n.split(/\s+/);
  return H.filter(h=>{ const t=semAc(h.titulo); return ts.every(x=>t.includes(x)); })
    .sort((a,b)=>(semAc(a.titulo).startsWith(n)?0:1)-(semAc(b.titulo).startsWith(n)?0:1)||a.n-b.n).slice(0,8);
}
let _sug={mus:[],hino:[]};
window.plSugMus=function(){
  const q=document.getElementById('plMusQ').value, box=document.getElementById('plMusSug'); _sug.mus=achaMus(q);
  box.innerHTML=!q.trim()?'':(_sug.mus.length? _sug.mus.map((m,i)=>'<button type="button" onmousedown="event.preventDefault()" class="'+(jaNoEv(m.id)?'ja':'')+'" onclick="plEscolhe(\'mus\','+i+')"><span class="ic">🎵</span><span class="tx"><b>'+e(m.titulo)+'</b><small>'+e(m.artista||'')+(m.cifra?' · cifra ✓':'')+'</small></span>'+(jaNoEv(m.id)?'<i>na lista</i>':'<i>+ adicionar</i>')+'</button>').join('') : '<div class="nada">Nenhuma música cadastrada com esse nome.</div>');
};
window.plSugHino=function(){
  const q=document.getElementById('plHinoQ').value, box=document.getElementById('plHinoSug'); _sug.hino=achaHino(q);
  box.innerHTML=!q.trim()?'':(_sug.hino.length? _sug.hino.map((h,i)=>{ const id='cc:'+h.n; return '<button type="button" onmousedown="event.preventDefault()" class="'+(jaNoEv(id)?'ja':'')+'" onclick="plEscolhe(\'hino\','+i+')"><span class="nmh">'+h.n+'</span><span class="tx"><b>'+e(h.titulo)+'</b><small>Tom '+e(h.tom||'—')+(h.ritmo?' · '+e(h.ritmo):'')+'</small></span>'+(jaNoEv(id)?'<i>na lista</i>':'<i>+ adicionar</i>')+'</button>'; }).join('') : '<div class="nada">Nenhum hino encontrado.</div>');
};
window.plEscolhe=function(tipo,i){
  if(tipo==='mus'){ const m=_sug.mus[i]; if(!m) return; plAdd(m.id); const q=document.getElementById('plMusQ'); q.value=''; plSugMus(); q.focus(); }
  else { const h=_sug.hino[i]; if(!h) return; plAdd('cc:'+h.n); const q=document.getElementById('plHinoQ'); q.value=''; plSugHino(); q.focus(); }
};
window.plEnter=function(ev,tipo){ if(ev.key==='Enter'){ ev.preventDefault(); if((_sug[tipo]||[]).length) plEscolhe(tipo,0); } };
/* compatibilidade com chamadas antigas */
window._plData=function(){};
window.plAddMus=function(){}; window.plAddHino=function(){};
function linkYoutube(v){ v=String(v||'').trim(); if(!v) return ''; if(!/^https?:\/\//i.test(v)) v='https://'+v; return /(^https?:\/\/)?([a-z0-9-]+\.)*(youtube\.com|youtu\.be)\//i.test(v)? v : null; }
window.publicarPlaylist=async function(){
  _ed.inicio=document.getElementById('plIni').value; _ed.fim=document.getElementById('plFim').value;
  const yt=linkYoutube(document.getElementById('plYt').value);
  if(!_ed.inicio||!_ed.fim) return toast('Informe início e fim.');
  if(_ed.fim<_ed.inicio) return toast('A data final está antes da inicial.');
  if(yt===null) return toast('O link precisa ser do YouTube (youtube.com ou youtu.be).');
  const evs=(_ed.evs||[]).map(x=>({id:x.id||evtUid(),nome:String(x.nome||'').trim()||'EVENTO',data:String(x.data||'').slice(0,10),
    itens:(x.itens||[]).slice(),concluido:!!x.concluido,concluido_em:x.concluido_em||null}));
  const itens=[];
  evs.forEach(x=>x.itens.forEach(id=>{ if(itens.indexOf(id)<0) itens.push(id); }));
  if(!itens.length) return toast('Adicione ao menos um evento com música ou hino.');
  const bt=document.getElementById('plPub'); if(bt){ bt.disabled=true; bt.textContent='Publicando…'; }
  const dados={inicio:_ed.inicio,fim:_ed.fim,itens,tons:Object.assign({},_ed.tons),youtube:yt||'',eventos:evs};
  if(_ed.qual==='prox'){
    await salvarConfig('setlist_prox',dados);
    const todos=!!(document.getElementById('plTodos')||{}).checked;
    const alvos=escaladosNoPeriodo(dados); const ids=new Set(alvos.map(u=>u.id));
    const txt='Culto de '+fmtData(_ed.inicio)+' a '+fmtData(_ed.fim)+': '+itens.length+' música(s)/hino(s) com letra e cifra já estão no app.';
    if(alvos.length) notificarTodos('🎼','Playlist da próxima semana',txt+' Você está escalado(a) — já pode ensaiar!',u=>ids.has(u.id),{link:'go:playlist:prox',popup:true});
    if(todos) notificarTodos('🗓️','Playlist da próxima semana',txt,u=>!ids.has(u.id),{link:'go:playlist:prox'});
    fecharModal();
    toast(alvos.length? 'Publicada! '+alvos.length+' escalado(s) avisado(s).' : (todos?'Publicada e todos avisados.':'Publicada. Ninguém da escala encontrado nessas datas.'));
    go('playlist','prox'); return;
  }
  const mus=itens.filter(id=>String(id).indexOf('cc:')!==0);
  const reg={inicio:_ed.inicio,fim:_ed.fim,musicas:mus,publicada:true,updated_at:new Date().toISOString()};
  /* grava sem criar linha nova (evita o erro "duplicate key ... playlist_pkey") */
  let error=null;
  try{
    const ult=await sb.from('playlist').select('id').order('updated_at',{ascending:false}).limit(1);
    if(ult.data && ult.data.length){ ({error}=await sb.from('playlist').update(reg).eq('id',ult.data[0].id)); }
    else { ({error}=await sb.from('playlist').insert(reg)); }
  }catch(err){ error=err; }
  if(error){ if(bt){ bt.disabled=false; bt.textContent='📢 Publicar'; } return toast('Erro: '+(error.message||error)); }
  DB.playlist={inicio:_ed.inicio,fim:_ed.fim,musicas:mus,publicada:true,eventos:evs};
  await salvarConfig('setlist',dados);
  /* se a "esta semana" vinha da lista da próxima semana que já começou, ela foi substituída */
  if(_ed.chave==='setlist_prox') await salvarConfig('setlist_prox',{});
  notificarTodos('📅','PLAYLIST DISPONÍVEL','A ordem do culto ('+fmtData(_ed.inicio)+' - '+fmtData(_ed.fim)+') já está no app. Confira!',null,{link:'go:playlist'});
  fecharModal(); toast('Playlist publicada e todos notificados!'); go('playlist','atual');
};
/* ADM: quando a semana da "próxima playlist" chega, ela passa a ser a desta semana */
async function promoverProxima(){
  try{ if(!(window.ehAdminReal? ehAdminReal() : adm())) return; const C=APP_CFG||{}; const p=normSl(C.setlist_prox,'setlist_prox');
    if(p && p.inicio && p.inicio<=hojeISO()){ await salvarConfig('setlist',{inicio:p.inicio,fim:p.fim,itens:p.itens,tons:p.tons,youtube:p.youtube,eventos:p.eventos||null}); await salvarConfig('setlist_prox',{}); }
  }catch(_){}
}
if(typeof iniciarApp==='function'){ const _ia2=iniciarApp; window.iniciarApp=iniciarApp=function(){ _ia2.apply(this,arguments); setTimeout(promoverProxima,1500); }; }
setInterval(promoverProxima,10*60*1000);

/* ================= 2) TOM DO CULTO ================= */
window.tomCulto=function(id){ const sl=listaDe(id); return sl&&sl.tons? (sl.tons[String(id)]||0) : 0; };
window.fixarTomCulto=async function(id,v){
  if(!adm()) return; const sl=listaDe(id); if(!sl) return toast('Monte a playlist primeiro.');
  const tons=Object.assign({},sl.tons); if(v) tons[id]=v; else delete tons[id];
  await salvarConfig(sl.chave||'setlist',{inicio:sl.inicio,fim:sl.fim,itens:sl.itens,tons,youtube:sl.youtube||'',eventos:sl.eventos||null});
  toast(v?'Tom do culto salvo. Todos abrem neste tom.':'Tom do culto: original.'); setTimeout(redesenhar,50);
};
function redesenhar(){ const y=scrollY; try{ if(typeof _viewAtual==='function') _viewAtual(); }catch(_){} scrollTo(0,y); }

/* ---- barra "Anterior | 2 de 6 | Próxima" + ações, nas telas de música e hino ---- */
function blocoCulto(id){
  const sl=listaDe(id); let h=''; const cx=sl&&sl.chave==='setlist_prox'&&setlist('prox')?'prox':'';
  if(sl){ const i=sl.itens.indexOf(String(id));
    if(i>=0){ const p=sl.itens[i-1], n=sl.itens[i+1];
      h+='<div class="sl-nav"><button '+(p?'onclick="abrirItem(\''+p+'\',\''+cx+'\')"':'disabled')+'>◀ '+(p?e(info(p).t):'Início')+'</button>'+
        '<div class="mid"><b>'+(i+1)+' de '+sl.itens.length+'</b>'+(cx?'próx. semana':'no culto')+'</div>'+
        '<button '+(n?'onclick="abrirItem(\''+n+'\',\''+cx+'\')"':'disabled')+'>'+(n?e(info(n).t):'Fim')+' ▶</button></div>'; } }
  h+='<div class="sl-acts"><button onclick="projetar(\''+id+'\')">📺 Projetar letra</button><button onclick="abrirFerramentas()">🎛 Metrônomo / afinador</button>';
  if(adm() && sl && sl.itens.indexOf(String(id))>=0) h+='<button class="gold" onclick="fixarTomAtual(\''+id+'\')">📌 Usar este tom no culto</button>';
  h+='</div>';
  return h;
}
window.fixarTomAtual=function(id){
  let v=0;
  if(String(id).indexOf('cc:')===0){ try{ const p=JSON.parse(localStorage.getItem('ibnm_cc_prefs')||'{}'); const n=String(id).slice(3); v=(p.tr&&n in p.tr)? p.tr[n] : tomCulto(id); }catch(_){} }
  else { try{ const t=JSON.parse(localStorage.getItem('ibnm_mus_tr')||'{}'); v=(id in t)? t[id] : tomCulto(id); }catch(_){} }
  fixarTomCulto(String(id),v);
};
/* música */
if(typeof renderMusica==='function'){
  const _rm=renderMusica;
  window.renderMusica=renderMusica=function(){ const html=_rm.apply(this,arguments); setTimeout(posMusica,0); return html; };
}
function posMusica(){
  const c=document.getElementById('content'); if(!c||typeof musicaAberta==='undefined'||!musicaAberta) return;
  const head=c.querySelector('.song-head'); if(!head||c.querySelector('.sl-nav,.sl-acts')) return;
  head.insertAdjacentHTML('afterend',blocoCulto(musicaAberta));
}
/* hino (chamado pelo cantor.js ao abrir) */
window.ccPosHino=function(n){
  const c=document.getElementById('content'); if(!c) return;
  const tools=c.querySelector('.cc-tools'); if(!tools||c.querySelector('.sl-acts')) return;
  tools.insertAdjacentHTML('beforebegin',blocoCulto('cc:'+n));
};

/* ================= 3) MODO PROJETOR ================= */
const ehLinhaAcordes=l=>{ const t=l.trim().split(/\s+/).filter(Boolean); return t.length>0 && t.every(x=>/^\(?[A-G](#|b)?[a-zA-Z0-9º°+#()\-]*(\/[A-G](#|b)?)?\)?$/.test(x)||/^[|/.\-x]+$/.test(x)); };
const CLITICOS=/^(me|te|se|nos|vos|lhe|lhes|o|a|os|as|lo|la|los|las|no|na|nos|nas|mo|ma|to|ta|lho|lha)$/i;
function limpaHino(l){
  l=l.replace(/\[[^\]]*\]/g,'').replace(/(\S)\s*-\s+(?=\S)/g,'$1').replace(/(\S)\s+-\s*(?=\S)/g,'$1');
  /* junta sílabas separadas ("divi-nal" → "divinal"), mas mantém "dá-nos", "vê-lo" */
  l=l.replace(/([A-Za-zÀ-ÿ]+)-([A-Za-zÀ-ÿ]+)/g,(m,a,b)=>CLITICOS.test(b)?m:a+b);
  return l.replace(/-(?=[\s,.;:!?]|$)/g,'').replace(/\s+/g,' ').trim();
}
function slidesHino(n){
  const h=hino(n); if(!h) return [];
  let getLine=(pi,li)=>h.partes[pi].linhas[li]; try{ if(window.Cantor&&Cantor.getLine) getLine=(pi,li)=>Cantor.getLine(h,pi,li); }catch(_){}
  const ps=h.partes.map((p,pi)=>({tipo:p.tipo,txt:p.linhas.map((l,li)=>limpaHino(getLine(pi,li))).join('\n')}));
  const coro=ps.find(p=>p.tipo==='coro');
  const out=[{capa:true,txt:h.n+'\n'+h.titulo}]; let k=0;
  /* canta-se o coro depois de cada estrofe */
  ps.forEach((p,i)=>{
    if(p.tipo==='coro'){ out.push({rot:'Coro',txt:p.txt}); return; }
    out.push({rot:String(++k),txt:p.txt});
    const prox=ps[i+1];
    if(coro && !(prox && prox.tipo==='coro')) out.push({rot:'Coro',txt:coro.txt});
  });
  return out;
}
function slidesMusica(id){
  const m=(DB.musicas||[]).find(x=>x.id===id); if(!m) return [];
  let txt=m.letra||'';
  if(!txt.trim() && m.cifra){ const d=document.createElement('div'); d.innerHTML=/<[a-z]/i.test(m.cifra)?m.cifra:e(m.cifra).replace(/\n/g,'<br>'); d.style.cssText='position:absolute;left:-9999px;white-space:pre-wrap'; document.body.appendChild(d); txt=d.innerText; d.remove();
    txt=txt.split('\n').filter(l=>!ehLinhaAcordes(l) && !/^\s*intro(du[cç][aã]o)?\s*[:\-–]/i.test(l)).map(l=>l.replace(/\[[^\]]*\]/g,'')).join('\n'); }
  const blocos=txt.replace(/\r/g,'').split(/\n\s*\n/).map(b=>b.split('\n').map(x=>x.trim()).filter(Boolean)).filter(b=>b.length);
  const out=[{capa:true,txt:m.titulo+(m.artista?'\n'+m.artista:'')}];
  blocos.forEach(b=>{ const r=b[0].match(/^\[(.+)\]$/); if(r&&b.length>1) out.push({rot:r[1],txt:b.slice(1).join('\n')}); else for(let i=0;i<b.length;i+=6) out.push({txt:b.slice(i,i+6).join('\n')}); });
  if(out.length===1) out.push({txt:'(letra não cadastrada)'});
  return out;
}
function slidesDe(id){ id=String(id); return id.indexOf('cc:')===0? slidesHino(+id.slice(3)) : slidesMusica(id); }
let PJ=null;
window.projetar=function(id){ abrirProjetor([{id,slides:slidesDe(id)}]); };
window.projetarSetlist=function(ctx){ const sl=setlist(ctx==='prox'?'prox':''); if(!sl) return; abrirProjetor(sl.itens.map(id=>({id,slides:slidesDe(id)}))); };
function abrirProjetor(grupos){
  fecharProjetor();
  const flat=[]; grupos.forEach(g=>g.slides.forEach((s,i)=>flat.push(Object.assign({titulo:info(g.id).t,ini:i===0},s))));
  if(!flat.length) return;
  const el=document.createElement('div'); el.className='proj'; el.setAttribute('role','dialog');
  el.innerHTML='<div class="bar"><span class="tt"></span><button class="fm" aria-label="Diminuir letra">A−</button><button class="fp" aria-label="Aumentar letra">A+</button><button class="fs" aria-label="Tela cheia">⛶</button><button class="x" aria-label="Fechar">✕</button></div><div class="tela"><div class="txt"></div></div><div class="rod"><span class="pos"></span><span class="dots"></span><span>toque ▶</span></div>';
  document.body.appendChild(el);
  PJ={el,flat,i:0,esc:parseFloat(localStorage.getItem('ibnm_proj_esc')||'1')};
  el.querySelector('.x').onclick=fecharProjetor;
  el.querySelector('.fs').onclick=()=>{ try{ document.fullscreenElement? document.exitFullscreen() : el.requestFullscreen(); }catch(_){} };
  el.querySelector('.fm').onclick=ev=>{ ev.stopPropagation(); PJ.esc=Math.max(.5,PJ.esc-.1); localStorage.setItem('ibnm_proj_esc',PJ.esc); mostra(); };
  el.querySelector('.fp').onclick=ev=>{ ev.stopPropagation(); PJ.esc=Math.min(2,PJ.esc+.1); localStorage.setItem('ibnm_proj_esc',PJ.esc); mostra(); };
  el.querySelector('.tela').onclick=ev=>{ (ev.clientX<innerWidth*.33)? anda(-1) : anda(1); };
  let x0=null; el.addEventListener('touchstart',ev=>{ x0=ev.touches[0].clientX; },{passive:true});
  el.addEventListener('touchend',ev=>{ if(x0==null) return; const dx=ev.changedTouches[0].clientX-x0; if(Math.abs(dx)>50){ anda(dx<0?1:-1); ev.preventDefault(); } x0=null; });
  document.addEventListener('keydown',teclas);
  addEventListener('resize',mostra);
  try{ if('wakeLock' in navigator) navigator.wakeLock.request('screen').then(w=>{ if(PJ) PJ.wl=w; }).catch(()=>{}); }catch(_){}
  mostra();
}
function teclas(ev){ if(!PJ) return; if(['ArrowRight','ArrowDown','PageDown',' ','Enter'].includes(ev.key)){ ev.preventDefault(); anda(1); } else if(['ArrowLeft','ArrowUp','PageUp','Backspace'].includes(ev.key)){ ev.preventDefault(); anda(-1); } else if(ev.key==='Escape') fecharProjetor(); }
function anda(d){ if(!PJ) return; const j=PJ.i+d; if(j<0||j>=PJ.flat.length) return; PJ.i=j; mostra(); }
function mostra(){
  if(!PJ||!PJ.el.isConnected){ fecharProjetor(); return; }
  const s=PJ.flat[PJ.i], t=PJ.el.querySelector('.txt'), tela=PJ.el.querySelector('.tela');
  PJ.el.querySelector('.tt').textContent=s.titulo;
  PJ.el.querySelector('.pos').textContent=(PJ.i+1)+'/'+PJ.flat.length;
  PJ.el.querySelector('.dots').innerHTML=PJ.flat.length<=30? PJ.flat.map((_,k)=>'<i class="'+(k===PJ.i?'on':'')+'"></i>').join('') : '';
  t.className='txt'+(s.capa?' capa':'');
  t.innerHTML=(s.rot?'<span class="rot">'+e(s.rot)+'</span>':'')+e(s.txt);
  /* ajusta o tamanho para caber na tela */
  let fs=Math.min(innerWidth*.075, innerHeight*.09)*PJ.esc; const maxW=tela.clientWidth*.98, maxH=tela.clientHeight*.96;
  t.style.fontSize=fs+'px';
  for(let k=0;k<40 && (t.scrollWidth>maxW||t.scrollHeight>maxH) && fs>12;k++){ fs*=.93; t.style.fontSize=fs+'px'; }
}
function fecharProjetor(){
  if(!PJ) return; try{ if(PJ.wl) PJ.wl.release(); }catch(_){} try{ if(document.fullscreenElement) document.exitFullscreen(); }catch(_){}
  document.removeEventListener('keydown',teclas); removeEventListener('resize',mostra);
  if(PJ.el.isConnected) PJ.el.remove(); PJ=null;
}
window.fecharProjetor=fecharProjetor;
/* botão VOLTAR do Android fecha o projetor */

/* ================= 4) METRÔNOMO E AFINADOR ================= */
const MT={bpm:+(localStorage.getItem('ibnm_bpm')||80),comp:+(localStorage.getItem('ibnm_comp')||4),on:false,ctx:null,prox:0,beat:0,timer:0,taps:[]};
function ctx(){ if(!MT.ctx){ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null; MT.ctx=new AC(); } if(MT.ctx.state==='suspended') MT.ctx.resume(); return MT.ctx; }
function clique(t,acento){ const c=MT.ctx, o=c.createOscillator(), g=c.createGain(); o.frequency.value=acento?1600:1000; g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(acento?.9:.55,t+.002); g.gain.exponentialRampToValueAtTime(.0001,t+.06); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+.07); }
function agenda(){
  const c=MT.ctx; if(!c||!MT.on) return;
  while(MT.prox < c.currentTime+.12){
    const b=MT.beat, quando=MT.prox;
    clique(quando, b===0 && MT.comp>1);
    setTimeout(()=>pisca(b), Math.max(0,(quando-c.currentTime)*1000));
    MT.prox += 60/MT.bpm; MT.beat=(MT.beat+1)%MT.comp;
  }
  MT.timer=setTimeout(agenda,25);
}
function pisca(b){
  document.querySelectorAll('.ferr .beats i').forEach((i,k)=>i.classList.toggle('on',k===b));
  const lt=document.querySelector('.metro-pill .lt'); if(lt){ lt.classList.add('on'); setTimeout(()=>lt.classList.remove('on'),90); }
}
function metroPlay(){ if(!ctx()) return toast('Seu navegador não tem áudio para o metrônomo.'); if(MT.on) return; MT.on=true; MT.beat=0; MT.prox=MT.ctx.currentTime+.06; agenda(); pilula(); }
function metroStop(){ MT.on=false; clearTimeout(MT.timer); document.querySelectorAll('.ferr .beats i').forEach(i=>i.classList.remove('on')); pilula(); }
function setBpm(v){ MT.bpm=Math.max(30,Math.min(250,Math.round(v))); localStorage.setItem('ibnm_bpm',MT.bpm); const b=document.querySelector('.ferr .big'); if(b) b.textContent=MT.bpm; const r=document.getElementById('mtRange'); if(r) r.value=MT.bpm; pilula(); }
function tap(){ const t=performance.now(); MT.taps=MT.taps.filter(x=>t-x<3000); MT.taps.push(t); if(MT.taps.length>=2){ const d=[]; for(let i=1;i<MT.taps.length;i++) d.push(MT.taps[i]-MT.taps[i-1]); setBpm(60000/(d.reduce((a,b)=>a+b,0)/d.length)); } }
function pilula(){
  let p=document.querySelector('.metro-pill');
  const aberto=!!document.querySelector('.ferr');
  if(!MT.on||aberto){ if(p) p.remove(); return; }
  if(!p){ p=document.createElement('div'); p.className='metro-pill'; document.body.appendChild(p); }
  p.innerHTML='<span class="lt"></span><span onclick="abrirFerramentas()" style="cursor:pointer">♩ '+MT.bpm+'</span><button aria-label="Parar metrônomo">■</button>';
  p.querySelector('button').onclick=metroStop;
}
/* afinador */
const AF={on:false,stream:null,an:null,buf:null,raf:0,ref:+(localStorage.getItem('ibnm_a4')||440)};
const NOMES=['Dó','Dó#','Ré','Ré#','Mi','Fá','Fá#','Sol','Sol#','Lá','Lá#','Si'], CIF=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
/* instrumentos do afinador: cordas da mais grave para a mais aguda (número MIDI) */
const INSTRUMENTOS={
  cromatico:{nm:'Cromático (qualquer nota)',cordas:[]},
  violao:{nm:'Violão',cordas:[40,45,50,55,59,64]},
  baixo4:{nm:'Contrabaixo · 4 cordas',cordas:[28,33,38,43]},
  baixo5:{nm:'Contrabaixo · 5 cordas',cordas:[23,28,33,38,43]}
};
AF.inst=localStorage.getItem('ibnm_afin_inst')||'violao';
const nomeMidi=m=>CIF[((m%12)+12)%12]+(Math.floor(m/12)-1);
const freqMidi=m=>AF.ref*Math.pow(2,(m-69)/12);
function tocarReferencia(m){ const c=ctx(); if(!c) return; const t=c.currentTime+.02, f=freqMidi(m);
  [[1,.5],[2,.25],[3,.12]].forEach(([k,a])=>{ const o=c.createOscillator(), g=c.createGain(); o.type='triangle'; o.frequency.value=f*k; g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(a*.6,t+.01); g.gain.exponentialRampToValueAtTime(.0001,t+2.2); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+2.3); }); }
window.afinTocar=function(m){ AF.alvo=m; tocarReferencia(m); document.querySelectorAll('.afin-cordas button').forEach(b=>b.classList.toggle('alvo',+b.dataset.m===m)); };
function autoCorr(b,sr){
  let rms=0; for(let i=0;i<b.length;i++) rms+=b[i]*b[i]; rms=Math.sqrt(rms/b.length); if(rms<.012) return -1;
  let r1=0,r2=b.length-1; const th=.2; for(let i=0;i<b.length/2;i++) if(Math.abs(b[i])<th){ r1=i; break; } for(let i=1;i<b.length/2;i++) if(Math.abs(b[b.length-i])<th){ r2=b.length-i; break; }
  const x=b.slice(r1,r2), n=x.length, c=new Float32Array(n);
  for(let i=0;i<n;i++) for(let j=0;j<n-i;j++) c[i]+=x[j]*x[j+i];
  let d=0; while(d<n-1&&c[d]>c[d+1]) d++;
  let mx=-1,mp=-1; for(let i=d;i<n;i++) if(c[i]>mx){ mx=c[i]; mp=i; }
  if(mp<=0) return -1; let T0=mp; const a=c[T0-1]||0,bb=c[T0],cc=c[T0+1]||0, A=(a+cc-2*bb)/2, B=(cc-a)/2; if(A) T0=T0-B/(2*A);
  return sr/T0;
}
async function afinLiga(){
  if(AF.on) return; const c=ctx(); if(!c) return toast('Seu navegador não tem áudio.');
  try{ AF.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}}); }
  catch(_){ const i=document.querySelector('.afin .info'); if(i) i.textContent='Permita o uso do microfone para afinar.'; return; }
  const src=c.createMediaStreamSource(AF.stream); AF.an=c.createAnalyser(); AF.an.fftSize=8192; src.connect(AF.an); AF.buf=new Float32Array(AF.an.fftSize); AF.red=new Float32Array(AF.an.fftSize/4); AF.on=true; loopAfin();
  const b=document.getElementById('afBtn'); if(b){ b.textContent='■ Parar'; }
}
function afinDesliga(){ AF.on=false; clearTimeout(AF.raf); try{ AF.stream&&AF.stream.getTracks().forEach(t=>t.stop()); }catch(_){} AF.stream=null; const b=document.getElementById('afBtn'); if(b) b.textContent='🎤 Começar'; }
let _ultFreq=[];
function loopAfin(){
  if(!AF.on) return;
  const box=document.querySelector('.afin'); if(!box){ afinDesliga(); return; }
  AF.an.getFloatTimeDomainData(AF.buf);
  for(let i=0;i<AF.red.length;i++){ const j=i*4; AF.red[i]=(AF.buf[j]+AF.buf[j+1]+AF.buf[j+2]+AF.buf[j+3])/4; }
  const f=autoCorr(AF.red,MT.ctx.sampleRate/4);
  if(f>25&&f<1500){ _ultFreq.push(f); if(_ultFreq.length>5) _ultFreq.shift(); const fm=_ultFreq.slice().sort((a,b)=>a-b)[Math.floor(_ultFreq.length/2)];
    const n=12*Math.log2(fm/AF.ref)+69; const cordas=(INSTRUMENTOS[AF.inst]||{}).cordas||[];
    /* com instrumento escolhido: compara com a corda mais próxima (ou a corda tocada no botão) */
    let r=Math.round(n);
    if(cordas.length){ r = (AF.alvo!=null && Math.abs(n-AF.alvo)<3.5) ? AF.alvo : cordas.reduce((a,b)=>Math.abs(b-n)<Math.abs(a-n)?b:a); }
    const cents=Math.round((n-r)*100), nome=((r%12)+12)%12, oit=Math.floor(r/12)-1;
    document.querySelectorAll('.afin-cordas button').forEach(b=>{ const on=+b.dataset.m===r; b.classList.toggle('on',on); b.classList.toggle('ok',on&&Math.abs(cents)<=5); });
    box.querySelector('.nota').innerHTML=CIF[nome]+'<small>'+oit+'</small>';
    const longe=Math.abs(n-r)>1.5;
    box.querySelector('.info').textContent=(cordas.length?'Corda '+(cordas.length-cordas.indexOf(r))+' · ':'')+NOMES[nome]+' · '+fm.toFixed(1)+' Hz · '+(longe?'muito longe: ':'')+(cents>0?'+':'')+Math.max(-999,Math.min(999,cents))+' cents'+(Math.abs(cents)<=5?' ✔ afinado':(cents<0?' (aperte / suba)':' (afrouxe / desça)'));
    const p=box.querySelector('.med .p'); p.style.left=(50+Math.max(-50,Math.min(50,cents)))+'%'; p.classList.toggle('ok',Math.abs(cents)<=5);
  }
  AF.raf=setTimeout(loopAfin,70);
}
let abaFerr='metro';
window.abrirFerramentas=function(aba){
  if(aba) abaFerr=aba;
  document.querySelectorAll('.cc-sheet-bg.ferr-bg').forEach(b=>b.remove());
  const bg=document.createElement('div'); bg.className='cc-sheet-bg ferr-bg';
  const metro='<div class="big">'+MT.bpm+'</div><div class="sub">batidas por minuto</div>'+
    '<input type="range" id="mtRange" min="30" max="250" value="'+MT.bpm+'">'+
    '<div class="linha"><button data-d="-5">−5</button><button data-d="-1">−1</button><button id="mtTap">TAP</button><button data-d="1">+1</button><button data-d="5">+5</button></div>'+
    '<div class="beats">'+Array.from({length:MT.comp},(_,k)=>'<i class="'+(k===0?'ac':'')+'"></i>').join('')+'</div>'+
    '<div class="linha">'+[2,3,4,6].map(c=>'<button class="cp '+(MT.comp===c?'on':'')+'" data-c="'+c+'">'+c+'/'+(c===6?8:4)+'</button>').join('')+'</div>'+
    '<div class="linha"><button class="play" id="mtPlay">'+(MT.on?'■ Parar':'▶ Tocar')+'</button></div>'+
    '<p class="sub">Toque TAP no ritmo da música para achar o andamento. O metrônomo continua tocando com esta janela fechada.</p>';
  const inst=INSTRUMENTOS[AF.inst]||INSTRUMENTOS.cromatico;
  const selInst='<select id="afInst" class="afin-inst">'+Object.keys(INSTRUMENTOS).map(k=>'<option value="'+k+'" '+(AF.inst===k?'selected':'')+'>'+INSTRUMENTOS[k].nm+'</option>').join('')+'</select>';
  const cordasHtml=inst.cordas.length? '<div class="afin-cordas">'+inst.cordas.map((m,i)=>'<button type="button" data-m="'+m+'" onclick="afinTocar('+m+')"><small>'+(inst.cordas.length-i)+'ª</small>'+nomeMidi(m).replace(/\d+$/,'')+'<i>'+nomeMidi(m).replace(/^\D+/,'')+'</i></button>').join('')+'</div><p class="sub" style="margin:4px 0 0">Toque numa corda para ouvir a nota de referência.</p>' : '';
  const afin=selInst+cordasHtml+'<div class="afin"><div class="nota">—</div><div class="med"><span class="c"></span><span class="p"></span></div><div class="info">Toque em Começar e toque uma corda ou cante uma nota.</div></div>'+
    '<div class="linha"><button class="play" id="afBtn">'+(AF.on?'■ Parar':'🎤 Começar')+'</button></div>'+
    '<div class="linha"><button id="afM">−</button><button disabled style="opacity:1">Lá = '+AF.ref+' Hz</button><button id="afP">+</button></div>'+
    '<p class="sub">Violão: Mi Lá Ré Sol Si Mi (E A D G B E) · Contrabaixo 4: Mi Lá Ré Sol (E A D G) · Contrabaixo 5: Si Mi Lá Ré Sol (B E A D G)</p>';
  bg.innerHTML='<div class="cc-sheet ferr" role="dialog" aria-modal="true"><h3>🎛 Ferramentas do músico</h3><div class="tabs"><button class="'+(abaFerr==='metro'?'on':'')+'" data-a="metro">Metrônomo</button><button class="'+(abaFerr==='afin'?'on':'')+'" data-a="afin">Afinador</button></div>'+(abaFerr==='metro'?metro:afin)+'<div class="row"><button class="pri" id="ferrX">Fechar</button></div></div>';
  document.body.appendChild(bg);
  const fechar=()=>{ afinDesliga(); bg.remove(); pilula(); };
  bg.addEventListener('click',ev=>{ if(ev.target===bg) fechar(); });
  bg.querySelector('#ferrX').onclick=fechar;
  bg.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{ afinDesliga(); abrirFerramentas(b.dataset.a); });
  if(abaFerr==='metro'){
    bg.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>setBpm(MT.bpm+(+b.dataset.d)));
    bg.querySelector('#mtRange').oninput=ev=>setBpm(+ev.target.value);
    bg.querySelector('#mtTap').onclick=tap;
    bg.querySelectorAll('.cp').forEach(b=>b.onclick=()=>{ MT.comp=+b.dataset.c; localStorage.setItem('ibnm_comp',MT.comp); MT.beat=0; abrirFerramentas(); });
    bg.querySelector('#mtPlay').onclick=()=>{ MT.on?metroStop():metroPlay(); bg.querySelector('#mtPlay').textContent=MT.on?'■ Parar':'▶ Tocar'; };
  } else {
    bg.querySelector('#afBtn').onclick=()=>{ AF.on?afinDesliga():afinLiga(); };
    bg.querySelector('#afInst').onchange=ev=>{ AF.inst=ev.target.value; AF.alvo=null; localStorage.setItem('ibnm_afin_inst',AF.inst); const ligado=AF.on; abrirFerramentas('afin'); if(ligado) setTimeout(afinLiga,50); };
    bg.querySelector('#afM').onclick=()=>{ AF.ref=Math.max(430,AF.ref-1); localStorage.setItem('ibnm_a4',AF.ref); abrirFerramentas(); };
    bg.querySelector('#afP').onclick=()=>{ AF.ref=Math.min(450,AF.ref+1); localStorage.setItem('ibnm_a4',AF.ref); abrirFerramentas(); };
  }
  pilula();
  /* se o botão VOLTAR do Android remover a janela, desliga o microfone */
  const obs=new MutationObserver(()=>{ if(!bg.isConnected){ afinDesliga(); pilula(); obs.disconnect(); } }); obs.observe(document.body,{childList:true});
};

/* ---------- menu: ferramentas e aparência ---------- */
if(typeof MENU!=='undefined' && Array.isArray(MENU) && !MENU.find(m=>m.id==='ferramentas')){
  const k=MENU.findIndex(m=>m.id==='perfil');
  MENU.splice(k>=0?k:MENU.length,0,{id:'ferramentas',ic:'🎛️',nm:'Metrônomo e afinador'});
  ROTAS.ferramentas=function(){ setTimeout(()=>abrirFerramentas(),30); return ROTAS.inicio(); };
}
if(typeof _booted!=='undefined' && _booted){ try{ montaMenu(); }catch(_){} }

/* ---------- automático: ao salvar a playlist, cada evento já é
   registrado em "Músicas já cantadas" no seu respectivo dia ---------- */
(function(){
  try{
    if(typeof window==='undefined'||typeof window.salvarConfig!=='function') return;
    const _sc=window.salvarConfig;
    const novo=function(chave,valor){
      const r=_sc.apply(this,arguments);
      try{
        if((chave==='setlist'||chave==='setlist_prox')&&valor&&Array.isArray(valor.eventos)&&valor.eventos.length){
          setTimeout(()=>{
            Promise.resolve(r)
              .then(()=>gravarEventos(valor))
              .then(n=>{ if(n>0&&typeof toast==='function') toast(n+' música(s) nova(s) já em "Músicas já cantadas"'); })
              .catch(()=>{});
          },0);
        }
      }catch(_){}
      return r;
    };
    window.salvarConfig=novo;
    try{ salvarConfig=novo; }catch(_){}
  }catch(_){}
})();
})();
