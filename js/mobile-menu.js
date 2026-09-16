/* ============================================================
 * mobile-menu.js —— 移动端抽屉菜单（只含导航锚点）
 * ------------------------------------------------------------
 * 依赖：core.js（App.$ / App.$$）
 * 只在 ≤860px 生效（三点按钮由 CSS 控制显隐）
 * ============================================================ */
(function (App) {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function () {
    var menu   = document.getElementById('mobileMenu');
    var toggle = document.getElementById('menuToggle');
    if (!menu || !toggle) {
      console.warn('[mobile-menu] 找不到 #mobileMenu 或 #menuToggle');
      return;
    }

    function open() {
      menu.classList.add('on');
      menu.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('mm-locked');
    }

    function close() {
      menu.classList.remove('on');
      menu.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('mm-locked');
    }

    function isOpen() { return menu.classList.contains('on'); }

    /* 三点按钮：开关 */
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      isOpen() ? close() : open();
    });

    /* 遮罩 & 关闭按钮 */
    App.$$('[data-mm-close]', menu).forEach(function (el) {
      el.addEventListener('click', close);
    });

    /* Esc */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) close();
    });

    /* 导航锚点：滚动 + 关闭抽屉 */
    App.$$('.mobile-menu__nav [data-scroll]', menu).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-scroll');
        var el = document.getElementById(id);
        if (!el) return;

        var OFFSET = 88;
        var startY = window.pageYOffset || document.documentElement.scrollTop;
        var targetY = el.getBoundingClientRect().top + startY - OFFSET;
        var dist = targetY - startY;
        var duration = Math.min(900, Math.max(350, Math.abs(dist) / 2));
        var t0 = null;

        function ease(t) {
          return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        function step(now) {
          if (t0 === null) t0 = now;
          var p = Math.min((now - t0) / duration, 1);
          window.scrollTo(0, startY + dist * ease(p));
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);

        App.$$('.mobile-menu__nav [data-scroll]', menu).forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');

        close();
      });
    });

    console.log('[mobile-menu] 初始化完成');
  });

})(window.App = window.App || {});