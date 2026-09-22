(function () {
  'use strict';
  function isMoney(input) {
    if (!input || input.tagName !== 'INPUT' || input.disabled || input.readOnly || input.type === 'hidden') return false;
    return /(?:valor|salario|capitalSocial|desconto|multa|preco|custo)/i.test(input.id || '') &&
      (/R\$/.test((input.placeholder || '') + (input.value || '')) || input.classList.contains('seq-valor-input'));
  }
  document.addEventListener('pointerdown', function (event) {
    var input = event.target.closest && event.target.closest('input');
    if (!isMoney(input) || input.dataset.fastMoneyTapped === '1') return;
    if (!input.value.trim()) return;
    input.dataset.fastMoneyTapped = '1';
    input.value = '';
  }, true);
  document.addEventListener('focusout', function (event) {
    if (event.target && event.target.dataset) delete event.target.dataset.fastMoneyTapped;
  }, true);
})();
