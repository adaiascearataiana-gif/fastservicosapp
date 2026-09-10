'use strict';
(function () {
  if (!window.fastDesktop) return;
  document.documentElement.classList.add('fast-linux-desktop');
  const style = document.createElement('style');
  style.textContent = `
    .fast-linux-desktop body{overscroll-behavior:none}
    #fastLinuxBadge{position:fixed;right:14px;bottom:14px;z-index:99991;background:linear-gradient(135deg,#082f49,#0f766e);color:#fff;border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:7px 11px;font:700 11px Inter,sans-serif;box-shadow:0 8px 24px rgba(2,6,23,.28);opacity:.9}
    @media(max-width:700px){#fastLinuxBadge{display:none}}
    /* r145: botão de atualizar pelo terminal (só no desktop Linux) */
    #fastUpdateTerminalBtn{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.28);border-radius:10px;padding:9px 14px;font:700 12.5px Inter,system-ui,sans-serif;color:#fff;cursor:pointer;background:linear-gradient(135deg,#059669,#10b981);box-shadow:0 8px 22px rgba(5,150,105,.32);}
    #fastUpdateTerminalBtn:hover{filter:brightness(1.08)}
    #fastUpdateTerminalBtn.fast-terminal-anim{animation:fastTermPulse 1.1s ease-in-out infinite}
    @keyframes fastTermPulse{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.45)}50%{box-shadow:0 0 0 9px rgba(16,185,129,0)}}
    /* r145: aviso compacto de nova versão acima da barra inferior (desktop) */
    #fastDesktopUpdateBanner{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(64px + env(safe-area-inset-bottom,0px));z-index:99992;display:none;align-items:center;gap:10px;max-width:min(94vw,430px);border:1px solid rgba(255,255,255,.30);border-radius:14px;padding:11px 13px;color:#fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);box-shadow:0 14px 38px rgba(49,46,129,.42);font:600 12.5px Inter,system-ui,sans-serif;cursor:pointer}
    #fastDesktopUpdateBanner small{display:block;font-weight:500;opacity:.92;margin-top:2px}
    #fastDesktopUpdateBanner .fast-upd-x{flex:0 0 auto;width:26px;height:26px;border-radius:8px;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px}
  `;
  document.head.appendChild(style);

  function toast(msg, tipo) {
    try { if (typeof window.mostrarToast === 'function') { window.mostrarToast(msg, tipo || 'success'); return; } } catch (e) { }
    try { if (typeof mostrarToast === 'function') { mostrarToast(msg, tipo || 'success'); return; } } catch (e) { }
    console.log('[FAST Linux] ' + msg);
  }

  // Navega até a área de ATUALIZAÇÕES (Configurações → Deploy & Auto-Atualização),
  // replicando o padrão do balão r118 (proIr('configuracoes') + #fastDeployInfo).
  function irParaAreaAtualizacoes() {
    try {
      if (typeof window.proIr === 'function') window.proIr('configuracoes');
      else if (typeof window.trocarAba === 'function') window.trocarAba(null, 'configuracoes');
    } catch (e) { }
    setTimeout(function () {
      var alvo = document.getElementById('fastDeployInfo');
      if (alvo) {
        alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        alvo.style.boxShadow = '0 0 0 3px var(--accent,#6366f1),0 12px 30px rgba(79,70,229,.22)';
        setTimeout(function () { alvo.style.boxShadow = ''; }, 2600);
      }
    }, 300);
  }

  // Abre o terminal que executa a atualização ao vivo. Mostra o estado no
  // botão enquanto o terminal abre (feedback imediato no app).
  function abrirTerminalAtualizacao(btn) {
    var old = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.classList.add('fast-terminal-anim'); btn.innerHTML = '<i class="fa-solid fa-terminal"></i> Abrindo terminal…'; }
    window.fastDesktop.openUpdateTerminal().then(function (res) {
      if (res && res.ok) {
        toast('Terminal de atualização aberto — siga as etapas na tela preta.', 'success');
      } else {
        toast('Não encontrei um terminal instalado: ' + (res && res.error || 'instale gnome-terminal/konsole/xterm.'), 'error');
        if (btn) { btn.disabled = false; btn.classList.remove('fast-terminal-anim'); btn.innerHTML = old; }
      }
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.classList.remove('fast-terminal-anim'); btn.innerHTML = old; }
    });
  }

  // Cria/atualiza o botão "ATUALIZAR PELO TERMINAL" ao lado do botão
  // "Verificar Atualizações" no card Deploy & Auto-Atualização. Âncora:
  // o primeiro <button> dentro de #fastDeployInfo é o "Verificar
  // Atualizações" — o host entra na mesma linha dele.
  function montarBotaoTerminal() {
    if (document.getElementById('fastUpdateTerminalBtn')) return;
    var verificar = document.querySelector('#fastDeployInfo button');
    var host = verificar ? verificar.parentElement : document.getElementById('fastDeployInfo');
    if (!host) return;
    var b = document.createElement('button');
    b.id = 'fastUpdateTerminalBtn';
    b.type = 'button';
    b.innerHTML = '<i class="fa-solid fa-terminal"></i> ATUALIZAR PELO TERMINAL';
    b.onclick = function (ev) { ev.preventDefault(); abrirTerminalAtualizacao(b); };
    host.appendChild(b);
  }

  // Banner discreto "NOVA VERSÃO DISPONÍVEL" no desktop — clique leva à
  // área de ATUALIZAÇÕES (onde fica o botão do terminal).
  function mostrarBannerNovaVersao(versao) {
    var banner = document.getElementById('fastDesktopUpdateBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'fastDesktopUpdateBanner';
      banner.setAttribute('role', 'status');
      banner.innerHTML = '<i class="fa-solid fa-cloud-arrow-down" style="font-size:17px"></i>' +
        '<span style="flex:1"><b>NOVA VERSÃO DISPONÍVEL</b><small id="fastDesktopUpdateBannerTxt">Atualize pelo terminal</small></span>' +
        '<i class="fa-solid fa-chevron-right"></i><span class="fast-upd-x" role="button" aria-label="Fechar">\u2715</span>';
      banner.onclick = function () { irParaAreaAtualizacoes(); };
      var x = banner.querySelector('.fast-upd-x');
      if (x) x.onclick = function (ev) { ev.stopPropagation(); banner.style.display = 'none'; };
      document.body.appendChild(banner);
    }
    var txt = banner.querySelector('#fastDesktopUpdateBannerTxt');
    if (txt && versao) txt.textContent = 'Nova versão ' + versao + ' — clique para atualizar pelo terminal';
    banner.style.display = 'flex';
    montarBotaoTerminal();
  }

  window.addEventListener('DOMContentLoaded', async () => {
    // Badge do rodapé: usa o estático do HTML se existir (idempotente).
    if (!document.getElementById('fastLinuxBadge')) {
      const badge = document.createElement('div'); badge.id = 'fastLinuxBadge'; badge.textContent = '\u25cf FAST LINUX \u00b7 SEGURO'; document.body.appendChild(badge);
    }
    // r145: botão do terminal já disponível na área de ATUALIZAÇÕES
    montarBotaoTerminal();
    try {
      const cfg = await window.fastDesktop.getConfig();
      window.FAST_DESKTOP_CONFIG = Object.freeze(cfg || {});
      if (cfg.supabaseUrl) localStorage.setItem('fast_desktop_supabase_url', cfg.supabaseUrl);
      if (cfg.supabaseAnonKey) localStorage.setItem('fast_desktop_supabase_anon_key', cfg.supabaseAnonKey);
      if (cfg.googleClientId) localStorage.setItem('fast_desktop_google_client_id', cfg.googleClientId);
      document.dispatchEvent(new CustomEvent('fast-desktop-ready', { detail: { configured: !!cfg.supabaseUrl } }));
    } catch (error) { console.error('[FAST Linux] configura\u00e7\u00e3o:', error); }
  });

  // ------------------------------------------------------------------
  // r145: eventos de atualização vindos do processo principal
  // ------------------------------------------------------------------
  // (a) Há uma versão nova publicada → banner discreto + botão pronto.
  window.fastDesktop.onUpdateAvailable(function (version) {
    mostrarBannerNovaVersao(version);
    toast('Nova versão ' + (version || '?') + ' disponível! Abra a área de ATUALIZAÇÕES ou clique no aviso.', 'info');
  });

  // (b) O usuário clicou na NOTIFICAÇÃO NATIVA do sistema → leva à área
  //     de ATUALIZAÇÕES com destaque.
  window.fastDesktop.onGoToUpdateArea(function () {
    mostrarBannerNovaVersao(null);
    irParaAreaAtualizacoes();
  });

  // (c) electron-updater terminou de baixar em segundo plano (AppImage).
  window.fastDesktop.onUpdateDownloaded(function () {
    toast('Nova versão baixada em segundo plano. Reinicie o FAST para atualizar.', 'sucesso');
  });

  // (d) r145: no desktop Linux, o botão azul de "atualização suspensa"
  //     (r139) abre o TERMINAL de atualização em vez de jogar o usuário
  //     para o site no navegador externo. Intercepta o clique ANTES do
  //     handler original (que faria location.href → navegador externo).
  document.addEventListener('click', function (ev) {
    var tag = ev.target && ev.target.closest ? ev.target.closest('#fastUpdateSuspendedTag') : null;
    if (!tag) return;
    var x = ev.target.classList ? ev.target.classList.contains('fast-suspended-x') : false;
    if (x) return; // X continua descartando o aviso normalmente
    ev.preventDefault();
    ev.stopPropagation();
    montarBotaoTerminal();
    var btn = document.getElementById('fastUpdateTerminalBtn');
    if (btn) { abrirTerminalAtualizacao(btn); }
  }, true);

  // (e) r145: o modal manual "Nova versao disponivel > Atualizar agora"
  //     (#fastUpdateConfirmOk, r2) também abriria o site no navegador
  //     externo. No desktop Linux ele abre o terminal ao vivo.
  document.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest('#fastUpdateConfirmOk') : null;
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    var modal = document.getElementById('fastUpdateConfirmModal');
    if (modal) modal.style.display = 'none';
    montarBotaoTerminal();
    var tbtn = document.getElementById('fastUpdateTerminalBtn');
    if (tbtn) { abrirTerminalAtualizacao(tbtn); }
  }, true);
})();
