/* ============================================================
 * charts.js —— Chart.js 封装
 * ------------------------------------------------------------
 * 本版修改：
 *   ★ create() 新增第 4 参数 opts，支持：
 *       { ariaLabel, description }
 *     —— 自动调 App.a11y.labelChart() + describeChart()，
 *        让 canvas 图表对屏幕阅读器可读
 *   ★ rebuild 时同步更新描述文字（数据变了描述也变）
 *   ★ 其余（按需加载、全局 tooltip 默认、keyboard 屏蔽）保持
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

  /* ============================================================
   * ★ create —— 第 4 参数 opts 支持无障碍
   * ------------------------------------------------------------
   * @param {string}   id
   * @param {HTMLCanvasElement} canvas
   * @param {Function} factory  (tokens) => config
   * @param {Object}   [opts]
   *   opts.ariaLabel    屏幕阅读器读到的图表标题（role=img 的 label）
   *   opts.description  数据文字替代（.sr-only 段落），
   *                     可以是字符串或 () => string
   * ============================================================ */
  function create(id, canvas, factory, opts) {
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
      /* ★ 更新 opts，让描述文字跟着数据走 */
      entry.opts = opts || entry.opts || null;
      rebuild(entry);
      return;
    }
    entry = { id: id, canvas: canvas, factory: factory, instance: null, opts: opts || null };
    registry.push(entry);
    rebuild(entry);
  }

  /* ============================================================
   * 应用无障碍语义
   * ============================================================ */
  function applyA11y(entry) {
    if (!entry || !entry.canvas || !entry.opts) return;
    var opts = entry.opts;

    if (opts.ariaLabel) {
      App.a11y.labelChart(entry.canvas, opts.ariaLabel);
    }

    var desc = opts.description;
    if (typeof desc === 'function') {
      try { desc = desc(); } catch (e) { desc = ''; }
    }
    if (desc) {
      App.a11y.describeChart(entry.canvas, desc);
    }
  }

  function rebuild(entry) {
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

    /* ★ 画完后补无障碍语义 */
    applyA11y(entry);
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