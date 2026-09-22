/* ============================================================
 * core.js —— 地基（业务模块之前加载）
 * 命名空间 / 常量 / DOM / 存储 / 状态 / 工具 / CSS 变量读取
 * ------------------------------------------------------------
 * 本版新增：
 *   ★ App.a11y —— 无障碍工具（焦点陷阱 / 图表语义）
 *     后续 hk-holdings.js / mobile-menu.js / guide-tip.js 会用
 * ============================================================ */
(function (App) {
  'use strict';

  /* ==========================================================
   * 〇、全局常量（唯一定义处）
   * ----------------------------------------------------------
   * ★ 汇率兜底：fx.js / hk-accounts.js / core.usdToHkd 全从这里读
   * ★ 改这一处，三处同步
   * ========================================================== */
  App.constants = {
    /* 币种兜底汇率（1 外币 = ? HKD） */
    FALLBACK_RATES: {
      USD: 7.8470,
      EUR: 9.0758,
      JPY: 0.0493,
      CHF: 9.6495,
      GBP: 10.6170,
      CAD: 5.6539,
      AUD: 5.5565,
      SGD: 6.1324,
      CNH: 1.1635,
      HKD: 1.0000
    },
    /* CNY→HKD 缺省汇率（本金换算用） */
    DEFAULT_CNY_HKD: 1.1694
  };

  /* ==========================================================
   * 一、DOM 助手
   * ========================================================== */
  App.$ = function (sel, root) {
    return (root || document).querySelector(sel);
  };

  App.$$ = function (sel, root) {
    return Array.prototype.slice.call(
      (root || document).querySelectorAll(sel)
    );
  };

  /* ==========================================================
   * 二、CSS 变量读取
   * ========================================================== */
  App.cssVar = function (name, root) {
    return getComputedStyle(root || document.documentElement)
      .getPropertyValue(name)
      .trim();
  };

  App.cssVars = function (names, root) {
    var cs = getComputedStyle(root || document.documentElement);
    var out = {};
    for (var i = 0; i < names.length; i++) {
      out[names[i]] = cs.getPropertyValue(names[i]).trim();
    }
    return out;
  };

  /* ==========================================================
   * 三、本地存储（统一前缀）
   * ========================================================== */
  var PREFIX = 'console-';

  App.storage = {
    get: function (key, fallback) {
      try {
        var v = localStorage.getItem(PREFIX + key);
        return v === null ? fallback : v;
      } catch (e) {
        return fallback;
      }
    },

    set: function (key, value) {
      try {
        localStorage.setItem(PREFIX + key, value);
      } catch (e) {}
    },

    remove: function (key) {
      try {
        localStorage.removeItem(PREFIX + key);
      } catch (e) {}
    },

    getJSON: function (key, fallback) {
      var raw = App.storage.get(key, null);
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },

    setJSON: function (key, value) {
      try {
        App.storage.set(key, JSON.stringify(value));
      } catch (e) {}
    },

    /* ★ 裸 key 读写（不走前缀）—— 用于历史上直接写死的 key */
    rawGet: function (key, fallback) {
      try {
        var v = localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch (e) {
        return fallback;
      }
    },

    rawSet: function (key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {}
    }
  };

  /* ==========================================================
   * 四、状态中心（仅内存）
   * ========================================================== */
  var _state = {};

  App.store = {
    get: function (key, fallback) {
      return Object.prototype.hasOwnProperty.call(_state, key)
        ? _state[key]
        : fallback;
    },

    set: function (key, value) {
      _state[key] = value;
      return value;
    },

    has: function (key) {
      return Object.prototype.hasOwnProperty.call(_state, key);
    },

    all: function () {
      var out = {};
      for (var k in _state) {
        if (Object.prototype.hasOwnProperty.call(_state, k)) out[k] = _state[k];
      }
      return out;
    },

    clear: function () {
      _state = {};
    }
  };

  /* ==========================================================
   * 五、事件总线
   * ----------------------------------------------------------
   * ★ on() 返回「解绑函数」，供组件生命周期清理使用
   *   （countdown-widget.js 依赖此返回值）
   * ========================================================== */
  App.events = {
    on: function (name, fn) {
      var handler = function (e) { fn(e.detail); };
      document.addEventListener(name, handler);
      /* ★ 返回解绑函数 */
      return function off() {
        document.removeEventListener(name, handler);
      };
    },

    emit: function (name, detail) {
      document.dispatchEvent(new CustomEvent(name, { detail: detail }));
    }
  };

  /* ==========================================================
   * 六、通用工具
   * ========================================================== */
  var _usdRateWarned = false;

  App.utils = {
    debounce: function (fn, wait) {
      var t = null;
      return function () {
        var args = arguments, self = this;
        clearTimeout(t);
        t = setTimeout(function () {
          fn.apply(self, args);
        }, wait);
      };
    },

    throttle: function (fn, wait) {
      var last = 0, timer = null;
      return function () {
        var args = arguments, self = this;
        var now = Date.now();
        var remain = wait - (now - last);
        if (remain <= 0) {
          clearTimeout(timer);
          timer = null;
          last = now;
          fn.apply(self, args);
        } else if (!timer) {
          timer = setTimeout(function () {
            last = Date.now();
            timer = null;
            fn.apply(self, args);
          }, remain);
        }
      };
    },

    ready: function (fn) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
      } else {
        fn();
      }
    },

    reducedMotion: function () {
      return window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    formatNumber: function (x) {
      if (x === undefined || x === null || isNaN(x)) return '0';
      var parts = Number(x).toFixed(2).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    },

    escapeHTML: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    scrollTo: function (top, behavior) {
      window.scrollTo({
        top: top,
        behavior: behavior || (App.utils.reducedMotion() ? 'auto' : 'smooth')
      });
    },

    usdToHkd: function () {
      var r = 0;
      try {
        if (App.fx && typeof App.fx.rate === 'function') {
          r = App.fx.rate('USD');
        }
      } catch (e) { r = 0; }

      if (r > 0 && r !== 1) return r;

      if (!_usdRateWarned) {
        _usdRateWarned = true;
        console.warn('[core] 未取到 USD→HKD 生效汇率，暂用兜底 ' +
          App.constants.FALLBACK_RATES.USD + '，请检查 App.fx.rate 是否就绪。');
      }
      /* ★ 兜底值从 App.constants 读，不再写死 */
      return App.constants.FALLBACK_RATES.USD;
    }
  };

  /* ==========================================================
   * 七、无障碍工具（★ 本版新增）
   * ----------------------------------------------------------
   * 后续被以下模块调用：
   *   hk-holdings.js  —— 弹窗焦点陷阱 + 模态语义
   *   mobile-menu.js  —— 抽屉焦点陷阱
   *   guide-tip.js    —— 提示卡焦点陷阱
   *   charts.js       —— canvas 图表的 role="img" + aria-label
   *   chart-*.js      —— 图表数据文字替代（.sr-only 隐藏段落）
   * ========================================================== */
  var FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  App.a11y = {

    /* ----------------------------------------------------------
     * 焦点陷阱
     * ----------------------------------------------------------
     * @param {HTMLElement} container  陷阱作用域（通常弹窗面板）
     * @param {Object}     [opts]
     * @param {HTMLElement|string} [opts.initialFocus]
     *        打开时自动聚焦的元素（元素或选择器），省略则聚焦第一个可聚焦元素
     * @param {HTMLElement} [opts.returnFocus]
     *        释放时归还焦点的元素，默认 = 调用时的 document.activeElement
     * @param {Function}   [opts.onEscape]
     *        按 Esc 时的回调（通常是 close()）
     * @returns {Function} release —— 解除陷阱并把焦点归还
     * ---------------------------------------------------------- */
    trapFocus: function (container, opts) {
      if (!container) return function () {};
      opts = opts || {};

      var previous = opts.returnFocus || document.activeElement;

      function getFocusable() {
        var list = App.$$(FOCUSABLE, container);
        return list.filter(function (el) {
          /* 排除隐藏元素：display:none 的 offset 为 0 且无 client rects */
          return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        });
      }

      function onKeydown(e) {
        if (e.key === 'Escape') {
          if (typeof opts.onEscape === 'function') {
            e.stopPropagation();
            opts.onEscape(e);
          }
          return;
        }
        if (e.key !== 'Tab') return;

        var list = getFocusable();
        if (!list.length) { e.preventDefault(); return; }

        var first = list[0];
        var last  = list[list.length - 1];
        var active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || !container.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !container.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      document.addEventListener('keydown', onKeydown, true);

      /* 初始聚焦：延后一帧，等弹窗过渡开始（display 切换的元素 offsetParent 需要下一帧） */
      var init = opts.initialFocus;
      if (typeof init === 'string') init = container.querySelector(init);
      if (!init) init = getFocusable()[0];
      if (init) {
        requestAnimationFrame(function () {
          if (init && typeof init.focus === 'function') init.focus();
        });
      }

      /* 返回 release */
      return function release() {
        document.removeEventListener('keydown', onKeydown, true);
        if (previous && typeof previous.focus === 'function') {
          /* 同样延后一帧，避免与关闭动画打架 */
          requestAnimationFrame(function () { previous.focus(); });
        }
      };
    },

    /* ----------------------------------------------------------
     * 给 canvas 图表补无障碍语义
     * ----------------------------------------------------------
     * 做法：
     *   1. canvas 自身 aria-hidden="true"（纯视觉元素）
     *   2. 父容器 role="img" + aria-label（屏幕阅读器读到 label）
     *
     * @param {string|HTMLCanvasElement} target  canvas 元素或 id
     * @param {string} label  概述文字（例："多账户净额走势，近 12 个月"）
     * ---------------------------------------------------------- */
    labelChart: function (target, label) {
      var canvas = (typeof target === 'string')
        ? document.getElementById(target)
        : target;
      if (!canvas || !label) return;

      var host = canvas.parentElement || canvas;
      host.setAttribute('role', 'img');
      host.setAttribute('aria-label', label);
      canvas.setAttribute('aria-hidden', 'true');
    },

    /* ----------------------------------------------------------
     * 给图表追加文字替代（隐藏段落）
     * ----------------------------------------------------------
     * 用于把图表里的关键数据点读给屏幕阅读器。
     * 同一个 canvas 反复调用只更新文字，不会重复插入。
     *
     * @param {string|HTMLCanvasElement} target
     * @param {string} text  数据描述文本
     * ---------------------------------------------------------- */
    describeChart: function (target, text) {
      var canvas = (typeof target === 'string')
        ? document.getElementById(target)
        : target;
      if (!canvas || !text) return;

      var host = canvas.parentElement || canvas;
      var descId = 'chart-desc-' + (canvas.id || 'x');
      var el = document.getElementById(descId);

      if (!el) {
        el = document.createElement('p');
        el.id = descId;
        el.className = 'sr-only';
        host.appendChild(el);
      }
      el.textContent = text;

      /* 关联到 role="img" 的父容器 */
      if (host.getAttribute('role') === 'img') {
        host.setAttribute('aria-describedby', descId);
      }
    }
  };

  /* ==========================================================
   * 八、通用分页（dividends.js / income.js 共用）
   * ----------------------------------------------------------
   *   CSS 类名全部在 dividends.css（全局唯一样式源）
   *
   *   本模块只负责：
   *     1. 生成分页 HTML（render）
   *     2. 绑定点击 → 回调（bind）
   *   滚动到哪里、怎么重绘，由调用方在 onChange 里决定。
   *
   *   i18n key：'page.tpl'（fallback：'第 {cur} / {total} 页'）
   * ========================================================== */
  App.pagination = {

    MAX_VISIBLE: 7,     /* 最多同时显示几个数字按钮 */

    render: function (cur, total, pageKey) {
      if (total <= 1) return '';

      var MAX   = App.pagination.MAX_VISIBLE;
      var items = [];

      if (total <= MAX) {
        for (var i = 1; i <= total; i++) items.push(i);
      } else {
        var left  = Math.max(1, cur - 2);
        var right = Math.min(total, cur + 2);
        if (left > 1) { items.push(1); if (left > 2) items.push('...'); }
        for (var j = left; j <= right; j++) items.push(j);
        if (right < total) {
          if (right < total - 1) items.push('...');
          items.push(total);
        }
      }

      var html = '<div class="pagination-wrap"><div class="pagination">';

      html += (cur > 1)
        ? '<button class="page-btn page-arrow" data-page="prev">‹</button>'
        : '<span class="page-btn page-arrow disabled">‹</span>';

      items.forEach(function (it) {
        if (it === '...') {
          html += '<span class="page-ellipsis">…</span>';
        } else {
          var active = (it === cur) ? ' active' : '';
          html += '<button class="page-btn' + active +
                  '" data-page="' + it + '">' + it + '</button>';
        }
      });

      html += (cur < total)
        ? '<button class="page-btn page-arrow" data-page="next">›</button>'
        : '<span class="page-btn page-arrow disabled">›</span>';

      var key = pageKey || 'page.tpl';
      var tpl = App.i18n && typeof App.i18n.t === 'function'
        ? App.i18n.t(key, '第 {cur} / {total} 页')
        : '第 {cur} / {total} 页';

      html += '</div><div class="page-info">' +
        tpl.replace('{cur}', cur).replace('{total}', total) +
        '</div></div>';

      return html;
    },

    bind: function (container, cur, total, onChange) {
      App.$$('.page-btn[data-page]', container).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var p = btn.getAttribute('data-page');
          var newPage = cur;
          if (p === 'prev')      newPage = Math.max(1, cur - 1);
          else if (p === 'next') newPage = Math.min(total, cur + 1);
          else                   newPage = parseInt(p, 10);

          if (newPage !== cur && typeof onChange === 'function') {
            onChange(newPage);
          }
        });
      });
    }
  };

  /* ==========================================================
   * 九、自测（core 专用）
   * ========================================================== */
  App.selfTestCore = function () {
    var fail = [];
    var u = App.utils;
    var R = App.constants.FALLBACK_RATES;

    /* --- formatNumber --- */
    if (u.formatNumber(1234.56) !== '1,234.56')
      fail.push('formatNumber(1234.56) → ' + u.formatNumber(1234.56));
    if (u.formatNumber(0) !== '0.00')
      fail.push('formatNumber(0) → ' + u.formatNumber(0));
    if (u.formatNumber(1000000) !== '1,000,000.00')
      fail.push('formatNumber(1000000) → ' + u.formatNumber(1000000));
    if (u.formatNumber(null) !== '0')
      fail.push('formatNumber(null) → ' + u.formatNumber(null));
    if (u.formatNumber(-1234.5) !== '-1,234.50')
      fail.push('formatNumber(-1234.5) → ' + u.formatNumber(-1234.5));

    /* --- escapeHTML --- */
    if (u.escapeHTML('<b>') !== '&lt;b&gt;')
      fail.push('escapeHTML("<b>") → ' + u.escapeHTML('<b>'));

    /* --- 常量完整性 --- */
    if (R.USD !== 7.8470) fail.push('FALLBACK_RATES.USD 被误改 → ' + R.USD);
    if (R.CNH !== 1.1635) fail.push('FALLBACK_RATES.CNH 被误改 → ' + R.CNH);
    if (R.HKD !== 1.0000) fail.push('FALLBACK_RATES.HKD 被误改 → ' + R.HKD);
    if (App.constants.DEFAULT_CNY_HKD !== 1.1694)
      fail.push('DEFAULT_CNY_HKD 被误改 → ' + App.constants.DEFAULT_CNY_HKD);

    /* --- a11y 存在性 --- */
    if (!App.a11y) fail.push('App.a11y 未定义');
    if (App.a11y && typeof App.a11y.trapFocus !== 'function')
      fail.push('App.a11y.trapFocus 不是函数');
    if (App.a11y && typeof App.a11y.labelChart !== 'function')
      fail.push('App.a11y.labelChart 不是函数');

    return fail;
  };

})(window.App = window.App || {});