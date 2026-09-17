/* ============================================================
 * theme-init.js —— 防首屏闪烁（放 <head>，不加 defer）
 * 只做一件事：尽早把 data-theme 写到 <html> 上。
 * key 与 core.js 的 PREFIX 保持一致（console-）。
 * ============================================================ */
(function () {
  'use strict';
  try {
    var t = localStorage.getItem('console-theme');
    if (!t) {
      t = window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();