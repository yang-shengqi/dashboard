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

  });

})(window.App = window.App || {});