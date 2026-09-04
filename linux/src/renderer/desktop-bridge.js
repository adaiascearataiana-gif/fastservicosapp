'use strict';
(function () {
  if (!window.fastDesktop) return;
  document.documentElement.classList.add('fast-linux-desktop');
  const style = document.createElement('style');
  style.textContent = `
    .fast-linux-desktop body{overscroll-behavior:none}
    #fastLinuxBadge{position:fixed;right:14px;bottom:14px;z-index:99991;background:linear-gradient(135deg,#082f49,#0f766e);color:#fff;border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:7px 11px;font:700 11px Inter,sans-serif;box-shadow:0 8px 24px rgba(2,6,23,.28);opacity:.9}
    @media(max-width:700px){#fastLinuxBadge{display:none}}
  `;
  document.head.appendChild(style);
  window.addEventListener('DOMContentLoaded', async () => {
    const badge = document.createElement('div'); badge.id = 'fastLinuxBadge'; badge.textContent = '● FAST LINUX · SEGURO'; document.body.appendChild(badge);
    try {
      const cfg = await window.fastDesktop.getConfig();
      window.FAST_DESKTOP_CONFIG = Object.freeze(cfg || {});
      if (cfg.supabaseUrl) localStorage.setItem('fast_desktop_supabase_url', cfg.supabaseUrl);
      if (cfg.supabaseAnonKey) localStorage.setItem('fast_desktop_supabase_anon_key', cfg.supabaseAnonKey);
      if (cfg.googleClientId) localStorage.setItem('fast_desktop_google_client_id', cfg.googleClientId);
      document.dispatchEvent(new CustomEvent('fast-desktop-ready', { detail: { configured: !!cfg.supabaseUrl } }));
    } catch (error) { console.error('[FAST Linux] configuração:', error); }
  });
  window.fastDesktop.onUpdateDownloaded(() => {
    if (typeof window.mostrarToast === 'function') window.mostrarToast('Nova versão baixada. Reinicie o FAST para atualizar.', 'sucesso');
  });
})();

