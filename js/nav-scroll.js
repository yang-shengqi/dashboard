/* ============================================================
 * nav-scroll.js —— 顶部 pills 锚点滚动 + 滚动高亮 + skip-link
 * ------------------------------------------------------------
 * 用自定义 rAF 缓动代替 scrollIntoView({behavior:'smooth'})，
 * 绕过「系统关闭动画 / prefers-reduced-motion」导致的秒跳。
 *
 * 本版修改：
 *   ★ 新增 .skip-link 支持 —— 键盘用户 Tab 到跳过链接，
 *     回车后平滑滚到目标并转移焦点（不靠 URL #hash）
 * ============================================================ */
(function () {
  'use strict';

  var btns = document.querySelectorAll('[data-scroll]');
  var skipLinks = document.querySelectorAll('.skip-link');

  if (!btns.length && !skipLinks.length) return;

  /* 顶部固定导航高度，滚到目标时留出空间 */
  var OFFSET = 88;

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
      if (!document.getElementById(id)) return;

      scrollToId(id);

      document.querySelectorAll('.pills [data-scroll]').forEach(function (x) {
        x.classList.remove('active');
      });
      b.classList.add('active');
    });
  });

  /* ---------- ★ skip-link：平滑滚动 + 焦点转移 ---------- */
  skipLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href') || '';
      var id = href.replace(/^#/, '');
      if (!id) return;

      var el = document.getElementById(id);
      if (!el) return;

      e.preventDefault();

      /* 目标可聚焦（若本来不可聚焦，临时加 tabindex） */
      var hadTabindex = el.hasAttribute('tabindex');
      if (!hadTabindex) el.setAttribute('tabindex', '-1');

      scrollToId(id, function () {
        el.focus({ preventScroll: true });
        /* 焦点转移完成后移除临时 tabindex（保持 DOM 干净） */
        if (!hadTabindex) {
          el.addEventListener('blur', function once() {
            el.removeAttribute('tabindex');
            el.removeEventListener('blur', once);
          });
        }
      });

      /* 更新 URL hash（不触发原生跳转） */
      if (history.replaceState) {
        history.replaceState(null, '', '#' + id);
      }
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