/* ============================================================
 * nav-scroll.js —— 顶部 pills 锚点滚动 + 滚动高亮 + skip-link
 * ------------------------------------------------------------
 * 滚动高亮改用「判定线」算法：取最后一个顶部越过导航底边的区。
 * 比 IntersectionObserver 在窄检测带下稳定，不会跳错。
 * ============================================================ */
(function () {
  'use strict';

  var btns = document.querySelectorAll('[data-scroll]');
  var skipLinks = document.querySelectorAll('.skip-link');

  if (!btns.length && !skipLinks.length) return;

  var OFFSET = 88;   // 与 CSS 的 scroll-margin-top 保持一致

  /* ---------- 自定义缓动滚动 ---------- */
  function smoothScrollTo(targetY, onDone) {
    var startY = window.pageYOffset || document.documentElement.scrollTop;
    var dist = targetY - startY;
    if (Math.abs(dist) < 1) {
      if (typeof onDone === 'function') onDone();
      return;
    }

    var duration = Math.min(900, Math.max(350, Math.abs(dist) / 2));
    var startTime = null;

    function ease(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(now) {
      if (startTime === null) startTime = now;
      var elapsed = now - startTime;
      var p = Math.min(elapsed / duration, 1);
      window.scrollTo(0, startY + dist * ease(p));
      if (p < 1) requestAnimationFrame(step);
      else if (typeof onDone === 'function') onDone();
    }
    requestAnimationFrame(step);
  }

  function scrollToId(id, onDone) {
    var el = document.getElementById(id);
    if (!el) return;
    var targetY = el.getBoundingClientRect().top +
                  (window.pageYOffset || document.documentElement.scrollTop) -
                  OFFSET;
    smoothScrollTo(targetY, onDone);
  }

  /* ---------- 收集锚点（去重，不依赖顺序） ---------- */
  var targets = [];
  btns.forEach(function (b) {
    var id = b.getAttribute('data-scroll');
    var el = document.getElementById(id);
    if (el && !targets.some(function (t) { return t.el === el; })) {
      targets.push({ el: el });
    }
  });

  /* ---------- 高亮控制 ---------- */
  var currentId = null;
  var locked = false;   // 点击滚动期间锁定，避免中途闪烁

  function setActive(id) {
    if (id === currentId) return;
    currentId = id;
    document.querySelectorAll('[data-scroll]').forEach(function (x) {
      x.classList.toggle('active', x.getAttribute('data-scroll') === id);
    });
  }

  /* 判定线算法：取「顶部越过判定线」的元素中位置最靠下的那个 */
  function updateActive() {
    if (locked || !targets.length) return;

    var y = window.pageYOffset || document.documentElement.scrollTop;
    var line = y + OFFSET + 4;      // 判定线：导航底边往下 4px

    var current = null;
    var maxTop = -Infinity;

    targets.forEach(function (t) {
      var top = t.el.getBoundingClientRect().top + y;
      if (top <= line && top > maxTop) {
        maxTop = top;
        current = t;
      }
    });

    if (!current) current = targets[0];
    setActive(current.el.id);
  }

  /* ---------- scroll / resize 节流 ---------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      updateActive();
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* ---------- 点击滚动 ---------- */
  document.querySelectorAll('.pills [data-scroll]').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-scroll');
      if (!document.getElementById(id)) return;

      locked = true;
      setActive(id);
      scrollToId(id, function () {
        locked = false;
        updateActive();
      });
    });
  });

  /* ---------- skip-link：平滑滚动 + 焦点转移 ---------- */
  skipLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href') || '';
      var id = href.replace(/^#/, '');
      if (!id) return;

      var el = document.getElementById(id);
      if (!el) return;

      e.preventDefault();

      var hadTabindex = el.hasAttribute('tabindex');
      if (!hadTabindex) el.setAttribute('tabindex', '-1');

      scrollToId(id, function () {
        el.focus({ preventScroll: true });
        if (!hadTabindex) {
          el.addEventListener('blur', function once() {
            el.removeAttribute('tabindex');
            el.removeEventListener('blur', once);
          });
        }
      });

      if (history.replaceState) {
        history.replaceState(null, '', '#' + id);
      }
    });
  });

  /* ---------- 初始化 ---------- */
  updateActive();
})();