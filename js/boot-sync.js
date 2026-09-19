/* ============================================================
 * boot-sync.js —— 启动后同步 & 兜底
 * 1. 单笔计算器「初始本金」← HSBC 基金持仓的 HKD 市值合计
 * 2. 页面加载完成后强制触发 fxchange，让所有依赖汇率的模块重算
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. 单笔计算器同步 ---------- */
  var input = document.getElementById('lumpPrincipal');
  var src   = document.getElementById('hkHoldingsTotal');

  if (input && src) {
    var userEdited = false;
    input.addEventListener('input', function () { userEdited = true; });

    var parseNum = function (txt) {
      if (txt == null) return 0;
      var n = parseFloat(String(txt).replace(/[^\d.\-]/g, ''));
      return isNaN(n) ? 0 : n;
    };

    var sync = function () {
      if (userEdited) return;
      var v = parseNum(src.textContent);
      if (v <= 0) return;
      var rounded = Math.round(v);
      if (String(rounded) === input.value) return;
      input.value = rounded;
      input.dispatchEvent(new Event('input',  { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    new MutationObserver(sync).observe(src, {
      childList: true, characterData: true, subtree: true
    });

    window.addEventListener('load', function () { setTimeout(sync, 400); });
  }

  /* ---------- 2. fxchange 兜底 ---------- */
  var fire = function () {
    if (window.App && App.events && typeof App.events.emit === 'function') {
      try { App.events.emit('fxchange', { source: 'boot' }); } catch (e) {}
    }
  };
  window.addEventListener('load', function () {
    setTimeout(fire, 500);
    setTimeout(fire, 2000);
  });
})();