(function () {
  'use strict';
  var scheduled = false;
  var style = document.createElement('style');
  style.textContent = '@media (max-width:900px){main .tab-content.active .table-container{overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;overflow-y:auto!important;min-height:0}main .tab-content.active .table-container thead th{position:sticky!important;top:0!important;z-index:2}}';
  document.head.appendChild(style);

  function update() {
    scheduled = false;
    var compact = window.innerWidth <= 900;
    var bottom = window.visualViewport
      ? window.visualViewport.offsetTop + window.visualViewport.height
      : window.innerHeight;
    var exclusive = document.body.classList.contains('fast-exclusive-app');
    if (!exclusive) {
      var dock = document.querySelector('nav.bottom-nav.fast-dock, nav.bottom-nav');
      if (dock && getComputedStyle(dock).display !== 'none') {
        bottom = Math.min(bottom, dock.getBoundingClientRect().top);
      }
    }
    var inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fast-safe-bottom')) || 0;
    if (exclusive) bottom -= inset;
    document.querySelectorAll('main .tab-content .table-container').forEach(function (table) {
      if (!compact || !table.closest('.tab-content.active')) {
        table.style.removeProperty('height');
        table.style.removeProperty('max-height');
        return;
      }
      var rect = table.getBoundingClientRect();
      if (rect.top < 0 || rect.top > bottom - 160) return;
      var height = Math.floor(bottom - rect.top - 4);
      if (height < 160) return;
      var pixels = height + 'px';
      if (table.style.height !== pixels) table.style.setProperty('height', pixels, 'important');
      if (table.style.maxHeight !== pixels) table.style.setProperty('max-height', pixels, 'important');
    });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule, {passive:true});
  if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule, {passive:true});
  document.addEventListener('click', schedule);
  document.addEventListener('touchend', schedule, {passive:true});
})();
