/* ============================================================
 * theme.js —— 白天 / 黑夜
 * 依赖：core.js
 * 对外：App.theme.get() / set('dark') / toggle() / followSystem()
 * 事件：切换后派发 themechange
 * ============================================================ */
(function (App) {
  'use strict';

  var KEY = 'theme';
  var root = document.documentElement;
  var media = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  /* ---------- 内部：应用主题 ---------- */
  function apply(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (persist) App.storage.set(KEY, theme);

    /* 同步 <html lang> 之外的辅助属性，留给样式钩子 */
    root.setAttribute('data-theme-source', persist ? 'user' : 'system');

    App.events.emit('themechange', { theme: theme });

    /* 若 i18n 已加载，让它刷新一次（更新 aria-label 等） */
    if (App.i18n && typeof App.i18n.refresh === 'function') {
      App.i18n.refresh();
    }
  }

  /* ---------- 对外 ---------- */
  App.theme = {

    get: function () {
      return root.getAttribute('data-theme') || 'light';
    },

    /* 用户手动切换，写入存档 */
    set: function (theme) {
      if (theme !== 'dark' && theme !== 'light') return;
      apply(theme, true);
    },

    toggle: function () {
      App.theme.set(App.theme.get() === 'dark' ? 'light' : 'dark');
    },

    /* 跟随系统：不写存档，系统变就跟着变 */
    followSystem: function () {
      if (!media) return;
      var sync = function () {
        var hasUserChoice = App.storage.get(KEY, null) !== null;
        if (!hasUserChoice) {
          apply(media.matches ? 'dark' : 'light', false);
        }
      };
      if (media.addEventListener) {
        media.addEventListener('change', sync);
      } else if (media.addListener) {
        media.addListener(sync); /* 旧 Safari */
      }
      sync();
    },

    /* 初始化：兜底（theme-init.js 已在 head 跑过，这里保证一致） */
    init: function () {
      var saved = App.storage.get(KEY, null);
      if (saved === 'dark' || saved === 'light') {
        apply(saved, false);
      } else if (!root.getAttribute('data-theme')) {
        apply(media && media.matches ? 'dark' : 'light', false);
      }
      App.theme.followSystem();
    }
  };

  /* ---------- 绑定顶栏按钮 ---------- */
  App.utils.ready(function () {
    var btn = App.$('#themeBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        App.theme.toggle();
      });
    }
    App.theme.init();
  });

})(window.App = window.App || {});