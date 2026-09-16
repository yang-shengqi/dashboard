/* ============================================================
 * charts.js —— Chart.js 封装
 * ------------------------------------------------------------
 * 本次修复（2026-09-14）：
 *   ★ 禁用 canvas 键盘焦点（tabindex=-1）
 *     Chart.js v3+ 默认给 canvas 加 tabindex，复制文字时 canvas
 *     抢焦点，浏览器自动滚动到 canvas，造成"跳到底部"
 *   ★ Chart.js 只响应鼠标/触摸，不响应键盘
 *   ★ canvas 上阻止键盘事件冒泡（双保险）
 * ============================================================ */
(function (App) {
  'use strict';

  /* 顶部设置 Chart.js 全局默认（tooltip 黑色） */
  if (typeof Chart !== 'undefined' && Chart.defaults && Chart.defaults.plugins) {
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

  var TOKEN_NAMES = [
    '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
    '--chart-grid', '--chart-axis', '--chart-text', '--chart-bg',
    '--state-ok', '--state-warn', '--state-fail',
    '--accent', '--accent-2', '--accent-3', '--accent-violet'
  ];

  var registry = [];

  function tokens() {
    return App.cssVars(TOKEN_NAMES);
  }

  /* ★ 只允许鼠标/触摸事件，不要键盘事件 */
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

      /* ★ 不响应键盘，避免复制文字时抢焦点 */
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

    /* ★ 禁用 canvas 键盘焦点 —— 防止复制文字时抢焦点跳页 */
    canvas.setAttribute('tabindex', '-1');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.outline = 'none';

    /* ★ 阻止 canvas 上的键盘事件冒泡（双保险） */
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
    if (typeof Chart === 'undefined') {
      console.warn('[charts] Chart.js 未加载');
      return;
    }
    var t = tokens();
    var config = entry.factory(t) || {};
    config.options = merge(defaults(t), config.options || {});

    /* ★ 即使用户配置覆盖了 options，也把 events 白名单强制回去 */
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