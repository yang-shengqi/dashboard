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
        console.warn('[core] 未取到 USD→HKD 生效汇率，暂用兜底 7.8，请检查 App.fx.rate 是否就绪。');
      }
      return 7.8;
    }
  };

})(window.App = window.App || {});