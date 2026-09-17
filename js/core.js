/* ============================================================
 * core.js —— 地基（业务模块之前加载）
 * 命名空间 / DOM / 存储 / 状态 / 工具 / CSS 变量读取
 * ============================================================ */
(function (App) {
  'use strict';

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
   * ----------------------------------------------------------
   * 注意：getComputedStyle 每次调用都会触发样式计算，
   * 所以画图表时请用 cssVars() 批量读，不要循环调 cssVar()。
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
   * ----------------------------------------------------------
   * App.storage.get('theme') === localStorage['console-theme']
   * 前缀若修改，theme-init.js 里的 key 需同步修改。
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
   * 四、状态中心（仅内存，不负责持久化）
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
   * 五、事件总线（模块间通信，避免互相直接调用）
   * ----------------------------------------------------------
   * App.events.on('themechange', fn)
   * App.events.emit('themechange', { theme: 'dark' })
   * ========================================================== */
  App.events = {
    on: function (name, fn) {
      document.addEventListener(name, function (e) {
        fn(e.detail);
      });
    },

    emit: function (name, detail) {
      document.dispatchEvent(new CustomEvent(name, { detail: detail }));
    }
  };

  /* ==========================================================
   * 六、通用工具（纯函数，无副作用）
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

    /* 等 DOM 就绪后执行；已就绪则立即执行 */
    ready: function (fn) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
      } else {
        fn();
      }
    },

    /* 是否偏好减少动效 */
    reducedMotion: function () {
      return window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    /* 1234567.89 -> "1,234,567.89" */
    formatNumber: function (x) {
      if (x === undefined || x === null || isNaN(x)) return '0';
      var parts = Number(x).toFixed(2).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    },

    /* 防 XSS 转义 */
    escapeHTML: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /* 平滑滚动 */
    scrollTo: function (top, behavior) {
      window.scrollTo({
        top: top,
        behavior: behavior || (App.utils.reducedMotion() ? 'auto' : 'smooth')
      });
    },

    /* --------------------------------------------------------
     * USD → HKD 生效汇率（手动 → 自动 → 预设 三级结果）
     * --------------------------------------------------------
     * core.js 加载时 App.fx 还不存在，所以只能调用时现取。
     * 兜底 7.8：仅在 App.fx 未就绪 / 取到无效值时使用。
     * 供 chart-trend / chart-schwab / chart-compare 共用。
     * ------------------------------------------------------ */
    usdToHkd: function () {
      var r = 0;
      try {
        if (App.fx && typeof App.fx.rate === 'function') {
          r = App.fx.rate('USD');
        }
      } catch (e) { r = 0; }

      /* rate() 在 collection 未就绪时返回 1，要挡掉 */
      if (r > 0 && r !== 1) return r;

      if (!_usdRateWarned) {
        _usdRateWarned = true;
        console.warn('[core] 未取到 USD→HKD 生效汇率，暂用兜底 7.8，请检查 App.fx.rate 是否就绪。');
      }
      return 7.8;
    }
  };

})(window.App = window.App || {});