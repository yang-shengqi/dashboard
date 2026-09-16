/* ============================================================
 * nav-scroll.js —— 顶部 pills 锚点滚动 + 滚动高亮
 * ------------------------------------------------------------
 * 用自定义 rAF 缓动代替 scrollIntoView({behavior:'smooth'})，
 * 绕过「系统关闭动画 / prefers-reduced-motion」导致的秒跳。
 * 选择器扩为全局 [data-scroll]，覆盖顶部 pills + 移动端抽屉。
 * ============================================================ */
(function () {
  'use strict';

  var btns = document.querySelectorAll('[data-scroll]');
  if (!btns.length) return;

  /* 顶部固定导航高度，滚到目标时留出空间 */
  var OFFSET = 88;

  /* ---------- 自定义缓动滚动 ---------- */
  function smoothScrollTo(targetY) {
    var startY = window.pageYOffset || document.documentElement.scrollTop;
    var dist = targetY - startY;
    if (Math.abs(dist) < 1) return;

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
    }
    requestAnimationFrame(step);
  }

  /* ---------- 收集锚点 ---------- */
  var targets = [];
  btns.forEach(function (b) {
    var id = b.getAttribute('data-scroll');
    var el = document.getElementById(id);
    if (el) targets.push({ btn: b, el: el });
  });

  /* ---------- 点击滚动（顶部 pills 的按钮） ---------- */
  document.querySelectorAll('.pills [data-scroll]').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-scroll');
      var el = document.getElementById(id);
      if (!el) return;

      var targetY = el.getBoundingClientRect().top +
                    (window.pageYOffset || document.documentElement.scrollTop) -
                    OFFSET;

      smoothScrollTo(targetY);

      document.querySelectorAll('.pills [data-scroll]').forEach(function (x) {
        x.classList.remove('active');
      });
      b.classList.add('active');
    });
  });

  /* ---------- 滚动高亮 ---------- */
  if (targets.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      var best = null;
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (!best || e.boundingClientRect.top < best.boundingClientRect.top) {
            best = e;
          }
        }
      });
      if (best) {
        var id = best.target.id;
        document.querySelectorAll('[data-scroll]').forEach(function (x) {
          x.classList.toggle('active', x.getAttribute('data-scroll') === id);
        });
      }
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });

    targets.forEach(function (t) { io.observe(t.el); });
  }
})();