/* ============================================================
 * main.js —— 页面入口（必须最后加载）
 * ============================================================ */
(function (App) {
  'use strict';

  function safeInit(name) {
    var mod = App[name];
    if (!mod || typeof mod.init !== 'function') {
      console.warn('[main] 模块未就绪：', name);
      return;
    }
    try {
      mod.init();
    } catch (e) {
      console.error('[main] 模块初始化失败：', name, e);
    }
  }

  App.utils.ready(function () {

    /* ★ fx 必须最先初始化：它创建汇率 collection，
          hkHoldings / hkAccounts / charts 等都依赖它 */
    safeInit('fx');

    safeInit('hkHoldings');
    safeInit('hkAccounts');
    safeInit('splitMonitor');
    safeInit('assetOverview');
    safeInit('dividends');
    safeInit('deviation');
    safeInit('rebalance');
    safeInit('compound');
    safeInit('g10');

    safeInit('chartTrend');
    safeInit('chartMonthly');
    safeInit('chartCompare');
    safeInit('chartDividend');
    safeInit('chartSchwab');

    /* ═══════════ 标题粒子 ═══════════ */
    (function () {
      var h1 = document.querySelector('#s-home h1');
      if (!h1) return;

      var COLS = [
        'var(--accent)',
        'var(--accent-2)',
        'var(--accent-violet)'
      ];

      for (var i = 0; i < 40; i++) {
        var p = document.createElement('span');
        p.className = 'h1-dust';
        p.setAttribute('aria-hidden', 'true');

        var size = 2 + Math.random() * 3.5;
        p.style.setProperty('--pc', COLS[Math.floor(Math.random() * 3)]);
        p.style.left   = (Math.random() * 100).toFixed(1) + '%';
        p.style.top    = (30 + Math.random() * 70).toFixed(1) + '%';
        p.style.width  = size.toFixed(1) + 'px';
        p.style.height = size.toFixed(1) + 'px';
        p.style.animationDuration = (6 + Math.random() * 8).toFixed(1) + 's';
        p.style.animationDelay    = (-Math.random() * 12).toFixed(1) + 's';

        h1.appendChild(p);
      }
    })();

  });

})(window.App = window.App || {});