/* ============================================================
 * main.js —— 页面入口（必须最后加载）
 * ------------------------------------------------------------
 * 2026-09-18：新增启动自检 —— 关键 DOM 元素缺一个就警告，
 *             避免「某区块被删掉但页面照常打开」这种静默故障。
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

  /* ============================================================
   * ★ 关键元素自检
   * ------------------------------------------------------------
   * 任何一项缺失，控制台立刻报黄字并列出名字。
   * 新增区块时，把它的 id 加进下面的清单即可。
   * ============================================================ */
  function selfCheck() {
    var REQUIRED = [
      /* ---------- 区块锚点（导航 data-scroll 的目标） ---------- */
      's-home',
      's-fx',
      's-accounts',
      's-allocation',
      's-ppp',
      's-dividends',
      's-notice',
      's-rebalance',

      /* ---------- 自动汇率 ---------- */
      'fxGrid',
      'fxCount',
      'fxUpdateTime',
      'fxRefreshBtn',
      'fxSyncBtn',

      /* ---------- HSBC 基金持仓 ---------- */
      'hkHoldingsBody',
      'hkHoldingsTotal',
      'hkHoldingsCount',
      'hkImportBtn',
      'hkFileInput',
      'hkClearBtn',

      /* ---------- 账户总览 ---------- */
      'hkAccountsGrid',
      'principalCNYDisplay',
      'principalHKDDisplay',
      'totalAssetsDisplay',
      'marketValueDisplay',
      'cashBalanceDisplay',
      'profitDisplay',
      'hsbcMarketValue',
      'schwabMarketValue',
      'hsbcCashValue',
      'bochkCashValue',
      'exchangeRateInput',

      /* ---------- 分红 / 配置占比 ---------- */
      'splitBarDividend',
      'splitBarAccumulate',
      'splitBarContainer',
      'splitBadge',
      'splitDividendValue',
      'splitAccumulateValue',
      'splitDividendPct',
      'splitAccumulatePct',
      'splitSummary',
      'assetBarsContainer',
      'assetLegend',

      /* ---------- 货币偏离 ---------- */
      'deviationBody',
      'deviationBadge',
      'devThreshold',
      'devThresholdDisplay',

      /* ---------- 分红记录 ---------- */
      'dividendsList',
      'divCount',

      /* ---------- ★ 再平衡建议（曾经丢过的那块） ---------- */
      'rebalanceBody',
      'rebBuyTip',

      /* ---------- G10 购买力偏离度 ---------- */
      'g10Grid',
      'g10Count',

      /* ---------- 图表 canvas ---------- */
      'compareChart',
      'trendChart',
      'dividendChart',
      'monthlyChart',
      'schwabTrendCanvas',

      /* ---------- 复利计算器 ---------- */
      'dcaMonthly',
      'dcaRate',
      'dcaYears',
      'dcaResult',
      'dcaInput',
      'dcaProfit',
      'lumpPrincipal',
      'lumpRate',
      'lumpYears',
      'lumpResult',
      'lumpProfit',

      /* ---------- 顶栏 / 交互 ---------- */
      'langBtn',
      'themeBtn',
      'skinBtn',
      'skinMenu',
      'musicBtn',
      'bgm',
      'menuToggle',
      'mobileMenu',
      'navProgress',
      'toTop',
      'ringFill',

      /* ---------- 弹窗 ---------- */
      'hkModalOverlay',
      'hkModalTitle',
      'hkModalBody',
      'hkModalClose',
      'imgModal',

      /* ---------- 执行规则提示卡 ---------- */
      'guideTip',
      'guideTipCard',
      'guideTipX',
      'guideTipCheck',

      /* ---------- 步骤条 ---------- */
      'prodStep',
      'prodStepCanvas'
    ];

    var missing = REQUIRED.filter(function (id) {
      return !document.getElementById(id);
    });

    if (missing.length) {
      console.warn(
        '%c[自检] ⚠️ 缺失 ' + missing.length + ' 个关键元素：',
        'color:#ff9f0a;font-weight:bold;font-size:13px'
      );
      console.warn(missing.join('\n'));
      console.warn(
        '%c↑ 上面这些 id 在 HTML 里找不到，' +
        '对应模块会静默失效。请检查 hk-account-dashboard.html。',
        'color:#ff9f0a'
      );
    } else {
      console.log(
        '%c[自检] 关键元素齐全 ✓ (' + REQUIRED.length + ' 项)',
        'color:#30d158;font-weight:bold;font-size:13px'
      );
    }

    return missing;
  }

  App.utils.ready(function () {

    /* ★ 第一步：自检，先把缺失名单打到控制台 */
    selfCheck();

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
