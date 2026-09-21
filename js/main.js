/* ============================================================
 * main.js —— 页面入口（必须最后加载）
 * ------------------------------------------------------------
 * 自检 96 项（NAV_ANCHORS 含 s-exec）
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
   * 关键元素自检
   * ------------------------------------------------------------
   * 分组：
   *   A. 导航锚点   —— 顶栏 pills / 移动端抽屉里的 id
   *   B. 纯区块锚点 —— 不在导航里，但作为滚动定位目标存在
   *   C. 组件 id    —— 各模块渲染容器、控件、弹窗等
   *   D. 无障碍     —— skip-link 等
   * ============================================================ */
  function selfCheck() {

    /* ---------- A. 导航锚点 ---------- */
    var NAV_ANCHORS = [
      's-home',
      's-exec',
      's-fx',
      's-accounts',
      's-allocation',
      's-ppp',
      's-dividends',
      's-income'
    ];

    /* ---------- B. 纯区块锚点 ---------- */
    var SECTION_ANCHORS = [
      's-rebalance',
      's-notice'
    ];

    /* ---------- C. 组件 id ---------- */
    var COMPONENTS = [
      /* 自动汇率 */
      'fxGrid', 'fxCount', 'fxUpdateTime', 'fxRefreshBtn', 'fxSyncBtn',

      /* HSBC 基金持仓 */
      'hkHoldingsBody', 'hkHoldingsTotal', 'hkHoldingsCount',
      'hkImportBtn', 'hkFileInput', 'hkClearBtn',

      /* 账户总览 */
      'hkAccountsGrid', 'principalCNYDisplay', 'principalHKDDisplay',
      'totalAssetsDisplay', 'marketValueDisplay', 'cashBalanceDisplay',
      'profitDisplay', 'hsbcMarketValue', 'schwabMarketValue',
      'hsbcCashValue', 'bochkCashValue', 'exchangeRateInput',

      /* 分红 / 配置占比 */
      'splitBarDividend', 'splitBarAccumulate', 'splitBarContainer',
      'splitBadge', 'splitDividendValue', 'splitAccumulateValue',
      'splitDividendPct', 'splitAccumulatePct', 'splitSummary',
      'assetBarsContainer', 'assetLegend',

      /* 货币偏离 */
      'deviationBody', 'deviationBadge', 'devThreshold', 'devThresholdDisplay',

      /* 分红记录 */
      'dividendsList', 'divCount',

      /* 再平衡建议 */
      'rebalanceBody', 'rebBuyTip',

      /* CRS 报税参考 */
      'incomeList', 'incomeCount', 'incomeYearLabel',

      /* G10 */
      'g10Grid', 'g10Count',

      /* 图表 canvas */
      'compareChart', 'trendChart', 'dividendChart',
      'monthlyChart', 'schwabTrendCanvas',

      /* 复利计算器 */
      'dcaMonthly', 'dcaRate', 'dcaYears',
      'dcaResult', 'dcaInput', 'dcaProfit',
      'lumpPrincipal', 'lumpRate', 'lumpYears',
      'lumpResult', 'lumpProfit',

      /* 顶栏 / 交互 */
      'langBtn', 'themeBtn', 'skinBtn', 'skinMenu',
      'musicBtn', 'bgm', 'menuToggle', 'mobileMenu',
      'navProgress', 'toTop', 'ringFill',

      /* 弹窗 */
      'hkModalOverlay', 'hkModalTitle', 'hkModalBody',
      'hkModalClose', 'imgModal',

      /* 执行规则提示卡 */
      'guideTip', 'guideTipCard', 'guideTipX', 'guideTipCheck',

      /* 步骤条 */
      'prodStep', 'prodStepCanvas'
    ];

    /* ---------- D. 无障碍 ---------- */
    var A11Y = [
      'skipLink'
    ];

    var REQUIRED = NAV_ANCHORS.concat(SECTION_ANCHORS, COMPONENTS, A11Y);

    /* ---------- 检查 1：DOM 存在性 ---------- */
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

    /* ---------- 检查 2：导航 data-scroll ↔ REQUIRED 对账 ---------- */
    var scrollTargets = [];
    App.$$('[data-scroll]').forEach(function (el) {
      var id = el.getAttribute('data-scroll');
      if (id && scrollTargets.indexOf(id) === -1) scrollTargets.push(id);
    });

    var brokenScroll = scrollTargets.filter(function (id) {
      return !document.getElementById(id);
    });
    if (brokenScroll.length) {
      console.warn(
        '%c[自检] ⚠️ 导航 data-scroll 指向不存在的区块：',
        'color:#ff9f0a;font-weight:bold;font-size:13px'
      );
      console.warn(brokenScroll.join('\n'));
    }

    var uncoveredScroll = scrollTargets.filter(function (id) {
      return REQUIRED.indexOf(id) === -1;
    });
    if (uncoveredScroll.length) {
      console.warn(
        '%c[自检] ⚠️ 导航指向的 id 不在自检清单里：',
        'color:#ff9f0a;font-weight:bold;font-size:13px'
      );
      console.warn(uncoveredScroll.join('\n'));
    }

    return {
      missing: missing,
      brokenScroll: brokenScroll,
      uncoveredScroll: uncoveredScroll
    };
  }

  /* ============================================================
   * 计算模块自测
   * ============================================================ */
  function runSelfTests() {
    var all = [];
    var tested = 0;
    var modList = [];

    Object.keys(App).forEach(function (key) {
      var mod = App[key];
      if (!mod || typeof mod.selfTest !== 'function') return;

      tested++;
      modList.push(key);

      try {
        var r = mod.selfTest();
        if (Array.isArray(r) && r.length) {
          r.forEach(function (msg) {
            all.push('[' + key + '] ' + msg);
          });
        }
      } catch (e) {
        all.push('[' + key + '] 抛错：' + e.message);
      }
    });

    if (typeof App.selfTestCore === 'function') {
      tested++;
      modList.push('core');
      try {
        var cf = App.selfTestCore();
        cf.forEach(function (msg) { all.push('[core] ' + msg); });
      } catch (e) {
        all.push('[core] 抛错：' + e.message);
      }
    }

    if (all.length) {
      console.warn(
        '%c[自测] ⚠️ ' + all.length + ' 项不符（共 ' + tested + ' 个模块）：',
        'color:#ff9f0a;font-weight:bold;font-size:13px'
      );
      console.warn(all.join('\n'));
    } else {
      console.log(
        '%c[自测] 全部通过 ✓ (' + tested + ' 个模块：' + modList.join(', ') + ')',
        'color:#30d158;font-weight:bold;font-size:13px'
      );
    }

    return all;
  }

  /* ============================================================
   * 启动
   * ============================================================ */
  App.utils.ready(function () {

    selfCheck();

    runSelfTests();

    /* fx 必须最先初始化 */
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

    safeInit('income');

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