/* ============================================================
 * charts.js —— Chart.js 封装
 * ------------------------------------------------------------
 * 2026-09-14：禁用 canvas 键盘焦点，防止复制文字时跳页。
 * 2026-09-18：Chart.js 改为按需加载，首屏不再下载
 *             chart.umd.min.js，第一次画图时才加载。
 *             配合 HTML 里删掉 <script src="js/chart.umd.min.js">。
 * ============================================================ */
(function (App) {
  'use strict';

  var TOKEN_NAMES = [
    '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
    '--chart-grid', '--chart-axis', '--chart-text', '--chart-bg',
    '--state-ok', '--state-warn', '--state-fail',
    '--accent', '--accent-2', '--accent-3', '--accent-violet'
  ];

  var registry = [];

  /* ★ 按需加载 Chart.js（全站只加载一次） */
  var _chartLoading = null;

  function ensureChart(cb) {
    if (typeof Chart !== 'undefined') { cb(); return; }

    if (!_chartLoading) {
      _chartLoading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'js/chart.umd.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    _chartLoading.then(cb, function () {
      console.warn('[charts] Chart.js 加载失败');
    });
  }

  /* ★ 顶部设置 Chart.js 全局默认（tooltip 黑色） */
  function applyGlobalDefaults() {
    if (typeof Chart === 'undefined' ||
        !Chart.defaults || !Chart.defaults.plugins) return;

    var gTip = Chart.defaults.plugins.tooltip;
    gTip.backgroundColor = 'rgba(0, 0, 0, 0.78)';
    gTip.titleColor      = '#ffffff';
    gTip.bodyColor       = '#ffffff';
    gTip.footerColor     = '#ffffff';
    gTip.borderColor     = 'rgba(255, 255, 255, 0.10)';
    gTip.borderWidth     = 1;
    gTip.padding         = 12;
    gTip.cornerRadius    = 8;
    gTip.displayColors   = true;
    gTip.boxPadding      = 4;
    gTip.titleFont       = { size: 12, weight: '600' };
    gTip.bodyFont        = { size: 12 };
  }

  applyGlobalDefaults();

  function tokens() {
    return App.cssVars(TOKEN_NAMES);
  }

  var MOUSE_EVENTS = [
    'mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'
  ];

  function defaults(t) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: App.utils.reducedMotion()
        ? false
        : { duration: 420, easing: 'easeOutCubic' },
      interaction: { mode: 'index', intersect: false },
      events: MOUSE_EVENTS,

      plugins: {
        legend: {
          display: true,
          labels: {
            color: t['--chart-text'],
            boxWidth: 12,
            boxHeight: 12,
            padding: 12
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.78)',
          titleColor:      '#ffffff',
          bodyColor:       '#ffffff',
          footerColor:     '#ffffff',
          borderColor:     'rgba(255, 255, 255, 0.10)',
          borderWidth:     1,
          padding:         12,
          cornerRadius:    8,
          displayColors:   true,
          boxPadding:      4,
          titleFont:       { size: 12, weight: '600' },
          bodyFont:        { size: 12 }
        }
      },

      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: t['--chart-axis'], font: { size: 11 } }
        },
        y: {
          grid: { color: t['--chart-grid'], drawTicks: false },
          border: { display: false },
          ticks: { color: t['--chart-axis'], font: { size: 11 } }
        }
      }
    };
  }

  function merge(target, source) {
    if (!source) return target;
    for (var key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      var sv = source[key];
      var tv = target[key];
      if (sv && typeof sv === 'object' && !Array.isArray(sv) &&
          tv && typeof tv === 'object' && !Array.isArray(tv)) {
        merge(tv, sv);
      } else {
        target[key] = sv;
      }
    }
    return target;
  }

  function find(id) {
    for (var i = 0; i < registry.length; i++) {
      if (registry[i].id === id) return registry[i];
    }
    return null;
  }

  function create(id, canvas, factory) {
    if (!canvas) {
      console.warn('[charts] canvas 为空：', id);
      return;
    }

    canvas.setAttribute('tabindex', '-1');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.outline = 'none';

    if (!canvas.__noKeyboardBound) {
      canvas.addEventListener('keydown', function (e) {
        e.stopPropagation();
      }, true);
      canvas.addEventListener('keypress', function (e) {
        e.stopPropagation();
      }, true);
      canvas.addEventListener('focus', function () {
        canvas.blur();
      });
      canvas.__noKeyboardBound = true;
    }

    var entry = find(id);
    if (entry) {
      entry.factory = factory;
      rebuild(entry);
      return;
    }
    entry = { id: id, canvas: canvas, factory: factory, instance: null };
    registry.push(entry);
    rebuild(entry);
  }

  function rebuild(entry) {
    /* ★ 原来这里直接 return，现在改成「等库加载完再画」 */
    if (typeof Chart === 'undefined') {
      ensureChart(function () {
        applyGlobalDefaults();
        rebuild(entry);
      });
      return;
    }

    var t = tokens();
    var config = entry.factory(t) || {};
    config.options = merge(defaults(t), config.options || {});
    config.options.events = MOUSE_EVENTS;

    if (entry.instance) {
      entry.instance.destroy();
      entry.instance = null;
    }

    entry.instance = new Chart(entry.canvas.getContext('2d'), config);
  }

  function redrawAll() {
    registry.forEach(rebuild);
  }

  function destroy(id) {
    var entry = find(id);
    if (!entry) return;
    if (entry.instance) entry.instance.destroy();
    registry.splice(registry.indexOf(entry), 1);
  }

  App.charts = {
    create: create,
    redrawAll: redrawAll,
    destroy: destroy,
    tokens: tokens
  };

  App.events.on('themechange', redrawAll);
  App.events.on('skinchange', redrawAll);

})(window.App = window.App || {});