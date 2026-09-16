/* ============================================================
 * nav.js —— 顶栏进度条 + 返回顶部
 * （原 initTabs 已移除：胶囊切换由 nav-scroll.js 统一处理）
 * ============================================================ */
(function (App) {
  'use strict';

  function initScroll() {
    var navProgress = document.getElementById('navProgress');
    var toTop = document.getElementById('toTop');
    var ringFill = document.getElementById('ringFill');
    var CIRC = 2 * Math.PI * 21;

    if (ringFill) {
      ringFill.setAttribute('stroke-dasharray', CIRC.toFixed(2));
      ringFill.setAttribute('stroke-dashoffset', CIRC.toFixed(2));
    }

    var ticking = false;

    function update() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var top = doc.scrollTop;
      var p = max > 0 ? Math.min(1, Math.max(0, top / max)) : 0;

      if (ringFill) {
        ringFill.setAttribute('stroke-dashoffset', (CIRC * (1 - p)).toFixed(2));
      }
      if (navProgress) {
        navProgress.style.width = (p * 100).toFixed(2) + '%';
      }
      if (toTop) {
        toTop.classList.toggle('on', top > 300);
      }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    if (toTop) {
      toTop.addEventListener('click', function () {
        var startY = window.pageYOffset || document.documentElement.scrollTop;
        if (startY <= 0) return;

        var duration = Math.min(1200, Math.max(600, startY / 3));
        var startTime = null;

        function step(now) {
          if (startTime === null) startTime = now;
          var elapsed = now - startTime;
          var progress = Math.min(elapsed / duration, 1);
          var ease = 1 - Math.pow(1 - progress, 3);
          window.scrollTo(0, Math.round(startY * (1 - ease)));
          if (progress < 1) requestAnimationFrame(step);
          else window.scrollTo(0, 0);
        }
        requestAnimationFrame(step);
      });
    }

    update();
  }

  App.utils.ready(function () {
    initScroll();
  });

})(window.App = window.App || {});