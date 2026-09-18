/* ============================================================
 * i18n.js —— 中英文切换
 * ------------------------------------------------------------
 * 依赖：core.js（App.storage / App.events / App.$）
 *       i18n-dict.js（App.i18nDict）
 * 对外：App.i18n.lang() / set('en') / toggle() / t(key) / refresh()
 * 事件：切换后派发 langchange，detail = { lang: 'zh' | 'en' }
 * ============================================================ */
(function (App) {
  'use strict';

  var KEY = 'lang';               /* 存档键名：console-lang */
  var FALLBACK = 'zh';            /* 找不到语言时用哪个 */

  /* ---------- 内部：取当前语言 ---------- */
  function currentLang() {
    var l = App.storage.get(KEY, null);
    if (l === 'zh' || l === 'en') return l;

    /* 没存档，按浏览器语言猜 */
    var nav = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
    return nav.indexOf('zh') === 0 ? 'zh' : 'en';
  }

  /* ---------- 内部：取字典 ---------- */
  function dict(lang) {
    return (App.i18nDict && App.i18nDict[lang]) || (App.i18nDict && App.i18nDict[FALLBACK]) || {};
  }

  /* ---------- 内部：把某语言应用到整个 DOM ---------- */
  function apply(lang) {
    var d = dict(lang);

    /* 1. 设置 <html lang>（CSS 用 [lang^="zh"] 做高亮） */
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN');

    /* 2. 文字：<span data-i18n="key"> */
    App.$$('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (d[key] != null) el.textContent = d[key];
    });

    /* 3. aria-label：<button data-i18n-aria="key"> */
    App.$$('[data-i18n-aria]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria');
      if (d[key] != null) el.setAttribute('aria-label', d[key]);
    });

    /* 4. title：<div data-i18n-title="key"> */
    App.$$('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      if (d[key] != null) el.setAttribute('title', d[key]);
    });

    /* 5. placeholder：<input data-i18n-ph="key"> */
    App.$$('[data-i18n-ph]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-ph');
      if (d[key] != null) el.setAttribute('placeholder', d[key]);
    });

    /* 6. alt：<img data-i18n-alt="key"> —— ★ 新增 */
    App.$$('[data-i18n-alt]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-alt');
      if (d[key] != null) el.setAttribute('alt', d[key]);
    });
  }

  /* ============================================================
   * 对外 API
   * ============================================================ */
  App.i18n = {

    /* 当前语言：'zh' | 'en' */
    lang: function () {
      return currentLang();
    },

    /* 手动设置并持久化 */
    set: function (lang) {
      if (lang !== 'zh' && lang !== 'en') return;
      App.storage.set(KEY, lang);
      apply(lang);
      App.events.emit('langchange', { lang: lang });
    },

    /* 中 ↔ 英 */
    toggle: function () {
      App.i18n.set(App.i18n.lang() === 'zh' ? 'en' : 'zh');
    },

    /* JS 里取词：App.i18n.t('btn.new') */
    t: function (key, fallback) {
      var d = dict(currentLang());
      return d[key] != null ? d[key] : (fallback != null ? fallback : key);
    },

    /* 重新扫一遍 DOM（动态插入内容后调用，theme.js 也用它） */
    refresh: function () {
      apply(currentLang());
    },

    /* 初始化 */
    init: function () {
      apply(currentLang());
    }
  };

  /* ---------- 绑定语言按钮 ---------- */
  App.utils.ready(function () {
    var btn = App.$('#langBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        App.i18n.toggle();
      });
    }
    App.i18n.init();
  });

})(window.App = window.App || {});