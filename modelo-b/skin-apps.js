/* ==========================================================================
   FAST — Modelo B · apoio aos apps (cliente, motorista, rotas, despesas, limpo)

   Este arquivo roda SÓ nas cópias de modelo-b/<app>/. Ele não altera função,
   dado ou sincronização. Faz três coisas pequenas:

     1. marca o <html> com a classe `modelo-b` (a skin CSS usa isso);
     2. troca os endereços de imagens que apontavam para arquivos que não
        existem no repositório (logo do motorista, ícones dos atalhos) pelos
        arquivos reais em /assets — o mesmo desenho, sem imagem quebrada;
     3. ajusta a cor da barra do navegador (meta theme-color) para o azul do
        Modelo B.

   Se qualquer coisa falhar, o app segue exatamente como está hoje.
   ========================================================================== */
(function () {
  'use strict';

  try { document.documentElement.classList.add('modelo-b'); } catch (e) {}

  var TROCAS = {
    'assets/app-motorista-512.png': 'assets/fast-motorista-512.png',
    'assets/app-motorista-192.png': 'assets/fast-motorista-512.png',
    'assets/gate-motorista-512.png': 'assets/fast-motorista-512.png',
    'assets/app-rotas-dia-512.png': 'assets/fast-rotas-512.png',
    'assets/app-rotas-dia-192.png': 'assets/fast-rotas-512.png',
    'assets/atalho-rotas-dia-192.png': 'assets/fast-rotas-512.png',
    'assets/app-despesas-512.png': 'assets/fast-despesas-512.png',
    'assets/app-despesas-192.png': 'assets/fast-despesas-512.png',
    'assets/atalho-despesas-192.png': 'assets/fast-despesas-512.png',
    'assets/app-cliente-512.png': 'assets/fast-cliente-512.png',
    'assets/app-limpo-512.png': 'assets/fast-servicos-icon-512.png',
    'assets/app-limpo-192.png': 'assets/fast-servicos-icon-192.png'
  };

  function trocarUrl(url) {
    if (!url) return null;
    for (var antigo in TROCAS) {
      if (Object.prototype.hasOwnProperty.call(TROCAS, antigo) && url.indexOf(antigo) !== -1) {
        return url.replace(antigo, TROCAS[antigo]);
      }
    }
    return null;
  }

  function corrigirImagens() {
    var lista;
    try {
      lista = document.querySelectorAll('img[src], link[rel="icon"][href]');
    } catch (e) { return; }

    Array.prototype.forEach.call(lista, function (el) {
      var ehLink = el.tagName === 'LINK';
      var atual = ehLink ? el.getAttribute('href') : el.getAttribute('src');
      var novo = trocarUrl(atual);
      if (!novo) return;
      try {
        if (ehLink) el.setAttribute('href', novo);
        else el.setAttribute('src', novo);
        el.setAttribute('data-mb-asset', '1');
      } catch (e) {}
    });
  }

  /* O login do app do Cliente usa um quadrado verde como logo (emoji).
     Aqui ele vira o ícone real do app — mesma tela, sem "tofu" em aparelhos
     que não têm a fonte de emoji. */
  function corrigirLogoCliente() {
    try {
      var alvo = document.querySelector('.login > div[style*="font-size:34px"]');
      if (!alvo || alvo.getAttribute('data-mb-logo') === '1') return;
      if (alvo.textContent.trim() !== '\uD83D\uDFE9') return;
      alvo.innerHTML = '<img class="mb-logo-img" src="../assets/fast-cliente-512.png" alt="Cliente FAST">';
      alvo.setAttribute('data-mb-logo', '1');
    } catch (e) {}
  }

  function corrigirTema() {
    try {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#1E3A8A');
    } catch (e) {}
  }

  function aplicar() {
    corrigirImagens();
    corrigirLogoCliente();
    corrigirTema();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicar, { once: true });
  } else {
    aplicar();
  }
  window.addEventListener('load', aplicar);
  setTimeout(aplicar, 1500);
  setTimeout(aplicar, 4000);
})();
