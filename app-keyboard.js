(function () {
  'use strict';
  // Tab / Shift+Tab use the browser's native focus order on every platform.
  // Only the login field has a single unambiguous action for Enter.
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing || event.repeat || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    var id = event.target && event.target.id;
    if (id === 'senha' && document.body.contains(document.getElementById('auth'))) {
      var clientAuth = document.getElementById('auth');
      if (!clientAuth.classList.contains('hide') && typeof window.entrar === 'function') {
        event.preventDefault(); window.entrar();
      }
    } else if (id === 'motPwd') {
      var driverLogin = document.getElementById('motEntrarBtn');
      if (driverLogin && driverLogin.getClientRects().length && !driverLogin.disabled) {
        event.preventDefault(); driverLogin.click();
      }
    }
  });
})();
