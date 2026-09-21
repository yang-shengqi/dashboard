/* ============================================================
 * split-monitor.js —— 分红 / 不分红仓位监控
 * ------------------------------------------------------------
 * 严格对齐原版 calculatePortfolio 的逻辑：
 *   1. 只遍历 holdings（不含 Cash/BOCHK/Schwab）
 *   2. 如果 value=0 且有 cost → 用 cost
 *   3. 转 HKD
 *   4. 按 dividendTypeMap 分类；未分类按名字猜
 *   5. 分母 = 所有 holdings 的 HKD 之和
 * 复合主键：编号@持有人
 *
 * 本版修改：
 *   ★ 条形图补 .sr-only 文字替代 —— 屏幕阅读器读到占比数据
 * ============================================================ */
(function (App) {
  'use strict';

  function typeOf(f) {
    var map = App.hkData.dividendTypeMap || {};
    return map[App.hkData.tplKey(f.id, f.holder)];
  }

  function compute() {
    var holdings  = App.hkData.holdings || [];
    var templates = App.hkData.masterTemplates || {};
    var rates = (App.fx && App.fx.rates) ? App.fx.rates() : {};

    var dividendTotal = 0;
    var accumulateTotal = 0;
    var total = 0;

    holdings.forEach(function (f) {
      var effectiveValue = Number(f.value) || 0;
      if (effectiveValue === 0 && Number(f.cost) !== 0) {
        effectiveValue = Number(f.cost);
      }
      if (effectiveValue <= 0) return;

      var tpl = templates[f.template];
      if (!tpl) return;

      var rate = (f.currency === 'HKD') ? 1 : (rates[f.currency] || 1);
      var hkdValue = effectiveValue * rate;
      total += hkdValue;

      var type = typeOf(f) || 'unclassified';
      if (type === '分红' || type === 'dividend') {
        dividendTotal += hkdValue;
      } else if (type === '不分红' || type === '累积' || type === 'accumulate') {
        accumulateTotal += hkdValue;
      } else {
        if (f.name.indexOf('每月派息') !== -1 ||
            f.name.indexOf('入息') !== -1 ||
            f.name.indexOf('收益') !== -1) {
          dividendTotal += hkdValue;
        } else {
          accumulateTotal += hkdValue;
        }
      }
    });

    return {
      total: total,
      dividend: dividendTotal,
      accumulate: accumulateTotal
    };
  }

  function render() {
    var barD  = App.$('#splitBarDividend');
    var barA  = App.$('#splitBarAccumulate');
    var valD  = App.$('#splitDividendValue');
    var valA  = App.$('#splitAccumulateValue');
    var pctD  = App.$('#splitDividendPct');
    var pctA  = App.$('#splitAccumulatePct');
    var sum   = App.$('#splitSummary');
    var badge = App.$('#splitBadge');

    if (!barD && !barA) return;

    var r = compute();

    if (r.total === 0) {
      if (badge) { badge.textContent = App.i18n.t('split.pending', '⏳ 请导入数据'); badge.className = 'badge'; }
      if (barD) { barD.style.width = '0%'; barD.textContent = ''; }
      if (barA) { barA.style.width = '0%'; barA.textContent = ''; }
      if (valD) valD.textContent = '-- HKD';
      if (valA) valA.textContent = '-- HKD';
      if (pctD) pctD.textContent = App.i18n.t('split.currentPct', '当前占比：') + '--%';
      if (pctA) pctA.textContent = App.i18n.t('split.currentPct', '当前占比：') + '--%';
      if (sum) sum.textContent = App.i18n.t('split.empty', '请导入数据以查看分红/不分红仓位监控');
      return;
    }

    var pD = r.dividend / r.total * 100;
    var pA = r.accumulate / r.total * 100;
    var targetD = 70, targetA = 30;
    var devD = pD - targetD;
    var devA = pA - targetA;
    var ok = Math.abs(devD) <= 5 && Math.abs(devA) <= 5;

    if (barD) { barD.style.width = pD + '%'; barD.textContent = '分红 ' + pD.toFixed(2) + '%'; }
    if (barA) { barA.style.width = pA + '%'; barA.textContent = '不分红 ' + pA.toFixed(2) + '%'; }
    if (valD) valD.textContent = App.utils.formatNumber(r.dividend) + ' HKD';
    if (valA) valA.textContent = App.utils.formatNumber(r.accumulate) + ' HKD';
    if (pctD) pctD.textContent = App.i18n.t('split.currentPct', '当前占比：') + pD.toFixed(2) + '% ' +
      '(' + App.i18n.t('split.target', '目标') + ' 70%)  ' +
      App.i18n.t('split.dev', '偏差') + ' ' + (devD > 0 ? '+' : '') + devD.toFixed(2) + '%';
    if (pctA) pctA.textContent = App.i18n.t('split.currentPct', '当前占比：') + pA.toFixed(2) + '% ' +
      '(' + App.i18n.t('split.target', '目标') + ' 30%)  ' +
      App.i18n.t('split.dev', '偏差') + ' ' + (devA > 0 ? '+' : '') + devA.toFixed(2) + '%';

    if (badge) {
      if (ok) { badge.textContent = App.i18n.t('split.ok', '✅ 合规（偏差 ≤5%）'); badge.className = 'badge ok'; }
      else    { badge.textContent = App.i18n.t('split.warn', '⚠️ 偏离超限（请关注）'); badge.className = 'badge warn'; }
    }

    if (sum) {
      sum.innerHTML =
        '<span class="legend-inline"><span class="dot" style="background:var(--chart-2);" aria-hidden="true"></span>' +
        App.i18n.t('split.dividend', '分红仓位') + ' ' + pD.toFixed(2) + '%</span>' +
        '<span class="legend-inline"><span class="dot" style="background:var(--chart-1);" aria-hidden="true"></span>' +
        App.i18n.t('split.accumulate', '不分红仓位') + ' ' + pA.toFixed(2) + '%</span>';
    }

    /* ★ 条形图补文字替代 —— 屏幕阅读器能读到占比与偏差 */
    var barContainer = App.$('#splitBarContainer');
    if (barContainer) {
      var status = ok ? App.i18n.t('split.ok', '✅ 合规（偏差 ≤5%）')
                      : App.i18n.t('split.warn', '⚠️ 偏离超限（请关注）');
      barContainer.setAttribute('role', 'img');
      barContainer.setAttribute('aria-label',
        App.i18n.t('split.header', '分红 70% / 不分红 30%') + '。' +
        App.i18n.t('split.dividend', '分红仓位') + ' ' + pD.toFixed(2) + '%，' +
        App.i18n.t('split.dev', '偏差') + ' ' + (devD > 0 ? '+' : '') + devD.toFixed(2) + '%。' +
        App.i18n.t('split.accumulate', '不分红仓位') + ' ' + pA.toFixed(2) + '%，' +
        App.i18n.t('split.dev', '偏差') + ' ' + (devA > 0 ? '+' : '') + devA.toFixed(2) + '%。' +
        status);
    }
  }

  App.splitMonitor = {
    init: function () {
      App.events.on('hkdatachange', render);
      App.events.on('fxchange', render);
      App.events.on('langchange', render);
      render();
    },
    render: render,
    compute: compute
  };

})(window.App = window.App || {});