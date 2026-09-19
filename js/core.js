/* ============================================================
 * core.js —— 地基（业务模块之前加载）
 * 命名空间 / 常量 / DOM / 存储 / 状态 / 工具 / CSS 变量读取
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
   * 七、通用分页（dividends.js / income.js 共用）
   * ----------------------------------------------------------
   *   CSS 类名全部在 dividends.css（全局唯一样式源）：
   *     .pagination-wrap  .pagination  .page-btn  .page-info
   *     .page-ellipsis    .page-arrow   .disabled .active
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

    /* ---------- 生成 HTML ----------
       cur    当前页
       total  总页数
       pageKey  i18n key（默认 'page.tpl'）
    */
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

    /* ---------- 绑定点击 ----------
       container  分页 DOM 的父容器（含分页 HTML）
       cur        当前页（用于判断是否真的换页）
       total      总页数
       onChange   回调 (newPage) —— 调用方负责更新页码 + 重绘 + 滚动
    */
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
   * 八、自测（core 专用）
   * ----------------------------------------------------------
   * main.js 启动时调 App.selfTestCore()，返回不符项数组。
   * 空数组 = 全部通过。
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

    return fail;
  };

})(window.App = window.App || {});