(function () {
  'use strict';
  var lastFocus;
  function prepareGuide() {
    if (document.getElementById('fastDesktopGuide')) return;
    var style = document.createElement('style');
    style.textContent = '.fast-desktop-guide-link{appearance:none;border:0;background:transparent;color:var(--accent,#4f46e5);text-decoration:underline;text-underline-offset:3px;cursor:pointer;font:inherit;font-weight:800;padding:3px 0;text-align:left}.fast-desktop-guide-link:focus-visible{outline:3px solid #f59e0b;outline-offset:3px;border-radius:4px}#fastDesktopGuide{border:1px solid #dbe4ef;border-radius:18px;max-width:min(540px,calc(100vw - 28px));width:100%;max-height:calc(100vh - 32px);overflow:auto;padding:24px;background:#fff;color:#1e293b;box-shadow:0 20px 65px #0f172a70}#fastDesktopGuide::backdrop{background:#0f172a9c}#fastDesktopGuide h2{font-size:21px;margin:0 0 12px}#fastDesktopGuide li{margin:10px 0;line-height:1.55}#fastDesktopGuide .fast-guide-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}#fastDesktopGuide code{overflow-wrap:anywhere}';
    document.head.appendChild(style);
    var dialog = document.createElement('dialog');
    dialog.id = 'fastDesktopGuide';
    dialog.setAttribute('aria-labelledby', 'fastGuideTitle');
    dialog.innerHTML = '<h2 id="fastGuideTitle"></h2><p id="fastGuideIntro"></p><ol id="fastGuideSteps"></ol><div class="fast-guide-actions"><button type="button" class="btn-primary" id="fastGuideDownload"><i class="fa-solid fa-download"></i> Baixar instalador</button><button type="button" class="btn-secondary" id="fastGuideClose">Fechar</button></div>';
    document.body.appendChild(dialog);
    dialog.querySelector('#fastGuideClose').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () { if (lastFocus && lastFocus.isConnected) lastFocus.focus(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  }
  window.fastAbrirGuiaDesktop = function (platform) {
    prepareGuide();
    var linux = platform === 'linux';
    var dialog = document.getElementById('fastDesktopGuide');
    lastFocus = document.activeElement;
    dialog.querySelector('#fastGuideTitle').textContent = linux ? 'Instalar o FAST no Linux' : 'Instalar o FAST no Windows';
    dialog.querySelector('#fastGuideIntro').textContent = 'Baixe a versão para seu computador. Seus dados existentes não são apagados ao abrir estas instruções.';
    var steps = linux ? [
      'Clique em Baixar instalador para obter o arquivo FAST-Servicos-Linux-x86_64.AppImage.',
      'Abra a pasta Downloads, clique com o botão direito no arquivo e permita executá-lo como programa nas propriedades. Se preferir o terminal: cd ~/Downloads && chmod +x FAST-Servicos-Linux-x86_64.AppImage',
      'Abra o arquivo com dois cliques. Pelo terminal: ./FAST-Servicos-Linux-x86_64.AppImage',
      'Se o sistema avisar que falta FUSE, instale a dependência indicada pelo seu sistema e tente novamente. No Ubuntu/Debian compatível: sudo apt install libfuse2.'
    ] : [
      'Clique em Baixar instalador para obter FAST-Servicos-Windows-x64-Instalador.exe.',
      'Abra o arquivo na pasta Downloads e siga as etapas do instalador.',
      'Depois, abra FAST Serviços pelo menu Iniciar ou pelo atalho criado na área de trabalho.'
    ];
    var list = dialog.querySelector('#fastGuideSteps');
    list.replaceChildren();
    steps.forEach(function (line) { var li = document.createElement('li'); li.textContent = line; list.appendChild(li); });
    dialog.querySelector('#fastGuideDownload').onclick = function () { window.fastBaixarDesktop(platform); };
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('#fastGuideClose').focus();
  };

  // Tab e Shift+Tab permanecem sob o controle nativo do navegador: isso
  // preserva a ordem visual, a acessibilidade e campos criados dinamicamente.
  // Enter confirma formulários de um único envio sem disparar ações destrutivas.
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    var el = event.target;
    if (!el || !el.matches || !el.matches('input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]),select')) return;
    if (el.id === 'fastGatePwd' && typeof window.fastGateDoLogin === 'function') {
      event.preventDefault(); window.fastGateDoLogin(); return;
    }
    var form = el.closest('form');
    if (!form) return;
    var submits = Array.from(form.querySelectorAll('button[type=submit],input[type=submit]')).filter(function (button) {
      return !button.disabled && button.getClientRects().length && !button.closest('[hidden],[aria-hidden="true"]');
    });
    if (submits.length !== 1) return;
    var button = submits[0];
    if (/excluir|apagar|remover|resetar|restaurar/i.test(button.textContent || button.value || '')) return;
    event.preventDefault();
    if (typeof form.requestSubmit === 'function') form.requestSubmit(button); else button.click();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prepareGuide);
  else prepareGuide();
})();
