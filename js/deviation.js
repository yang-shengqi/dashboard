/* ============================================================
 * deviation.js —— 货币偏离
 * ------------------------------------------------------------
 * 1. 本金 / 市值 显示【原币种】，同时附 HKD
 * 2. 占比基于 HKD
 * 3. HKD 并入 USD（目标篮子里没有 HKD）
 * 4. 8 列：货币 / 本金 / 市值 / 目标 / 实际 / 偏离 / 进度 / 状态
 * 事件：hkdatachange / fxchange / langchange
 * 自测：App.deviation.selfTest()
 *
 * 本版修改：无（保留原样）
 * ============================================================ */
(function (App) {
  'use strict';

  var CURRENCY_LIST = ['USD', 'EUR', 'JPY', 'CHF', 'GBP', 'CAD', 'AUD', 'SGD', 'CNH', 'HKD'];

  var TARGETS = [
    { code: 'USD', target: 0.35 },
    { code: 'EUR', target: 0.20 },
    { code: 'JPY', target: 0.15 },
    { code: 'CHF', target: 0.05 },
    { code: 'GBP', target: 0.05 },
    { code: 'CAD', target: 0.05 },
    { code: 'AUD', target: 0.05 },
    { code: 'SGD', target: 0.05 },
    { code: 'CNH', target: 0.05 }
  ];

  var STORAGE_KEY = 'deviation-threshold';
  var threshold = 5;

  /* ============================================================
   * 计算核（纯函数）
   * ============================================================ */
  function calcDev(amountHKD, totalHKD, target) {
    var pct = totalHKD > 0 ? (amountHKD / totalHKD) : 0;
    return pct - target;
  }

  function isOver(dev, thr) {
    return Math.abs(dev) > thr;
  }

  /* ============================================================
   * 自测
   * ============================================================ */
  function selfTest() {
    var fail = [];
    var eps = 1e-9;

    if (Math.abs(calcDev(350, 1000, 0.35) - 0) > eps)
      fail.push('calcDev(350/1000, 0.35) 应=0，实际 ' + calcDev(350, 1000, 0.35));

    if (Math.abs(calcDev(400, 1000, 0.35) - 0.05) > eps)
      fail.push('calcDev(400/1000, 0.35) 应=0.05，实际 ' + calcDev(400, 1000, 0.35));

    if (Math.abs(calcDev(300, 1000, 0.35) + 0.05) > eps)
      fail.push('calcDev(300/1000, 0.35) 应=-0.05，实际 ' + calcDev(300, 1000, 0.35));

    if (Math.abs(calcDev(0, 0, 0.35) + 0.35) > eps)
      fail.push('calcDev 总分母 0 应=-0.35，实际 ' + calcDev(0, 0, 0.35));

    if (isOver(0.04, 0.05) !== false)
      fail.push('isOver(4%, 5%) 应=false');
    if (isOver(0.06, 0.05) !== true)
      fail.push('isOver(6%, 5%) 应=true');
    if (isOver(-0.06, 0.05) !== true)
      fail.push('isOver(-6%, 5%) 应=true');
    if (isOver(0.05, 0.05) !== false)
      fail.push('isOver(恰好 5%) 应=false（不超过）');

    return fail;
  }

  /* ============================================================
   * 阈值持久化
   * ============================================================ */
  function loadThreshold() {
    var v = parseFloat(App.storage.get(STORAGE_KEY, '5'));
    if (isNaN(v) || v < 1 || v > 15) v = 5;
    threshold = v;
  }

  function setThreshold(v) {
    v = parseFloat(v);
    if (isNaN(v)) v = 5;
    if (v < 1) v = 1;
    if (v > 15) v = 15;
    threshold = v;
    App.storage.set(STORAGE_KEY, String(v));
    render();
  }

  /* ============================================================
   * 计算全部
   * ============================================================ */
  function compute() {
    var holdings = App.hkData.holdings || [];
    var rates = (App.fx && App.fx.rates) ? App.fx.rates() : {};

    var totalHKD = 0;
    var currencyHKD     = {};
    var currencyCost    = {};
    var currencyValue   = {};
    var currencyCostHKD = {};
    var currencyValueHKD= {};

    CURRENCY_LIST.forEach(function (c) {
      currencyHKD[c] = 0;
      currencyCost[c] = 0;
      currencyValue[c] = 0;
      currencyCostHKD[c] = 0;
      currencyValueHKD[c] = 0;
    });

    holdings.forEach(function (f) {
      var ccy = f.currency || 'USD';
      var cost = Number(f.cost) || 0;
      var value = Number(f.value) || 0;
      if (value === 0 && cost !== 0) value = cost;
      if (value <= 0) return;

      var rate = (ccy === 'HKD') ? 1 : (rates[ccy] || 1);
      var hkdValue = value * rate;
      var hkdCost  = cost * rate;

      totalHKD += hkdValue;
      currencyHKD[ccy]      += hkdValue;
      currencyCost[ccy]     += cost;
      currencyValue[ccy]    += value;
      currencyCostHKD[ccy]  += hkdCost;
      currencyValueHKD[ccy] += hkdValue;
    });

    var adjusted = Object.assign({}, currencyHKD);
    if (adjusted['HKD'] > 0) {
      adjusted['USD'] = (adjusted['USD'] || 0) + adjusted['HKD'];
      adjusted['HKD'] = 0;
    }

    var thr = threshold / 100;
    var rows = TARGETS.map(function (t) {
      var amountHKD = adjusted[t.code] || 0;
      var pct = totalHKD > 0 ? amountHKD / totalHKD : 0;
      var dev = calcDev(amountHKD, totalHKD, t.target);
      return {
        code: t.code,
        target: t.target,
        actual: pct,
        deviation: dev,
        amountHKD: amountHKD,
        cost:    currencyCost[t.code]     || 0,
        value:   currencyValue[t.code]    || 0,
        costHKD: currencyCostHKD[t.code]  || 0,
        valueHKD:currencyValueHKD[t.code] || 0,
        over: isOver(dev, thr)
      };
    });

    var hkdRow = {
      code: 'HKD',
      cost: currencyCost['HKD'] || 0,
      value: currencyValue['HKD'] || 0,
      costHKD: currencyCostHKD['HKD'] || 0,
      valueHKD: currencyValueHKD['HKD'] || 0
    };

    return { rows: rows, hkdRow: hkdRow, total: totalHKD, threshold: threshold };
  }

  /* ============================================================
   * 渲染
   * ============================================================ */
  function render() {
    var container = App.$('#deviationBody');
    var badge = App.$('#deviationBadge');
    if (!container) return;

    var r = compute();

    if (r.total === 0) {
      container.innerHTML = '<div class="empty-hint">' +
        App.i18n.t('dev.empty', '暂无持仓数据') + '</div>';
      if (badge) badge.innerHTML = '';
      return;
    }

    var html = '<div class="dev-head" role="row">' +
      '<span role="columnheader">' + App.i18n.t('dev.th.currency', '货币') + '</span>' +
      '<span role="columnheader">' + App.i18n.t('dev.th.cost', '初始本金') + '</span>' +
      '<span role="columnheader">' + App.i18n.t('dev.th.value', '当下市值') + '</span>' +
      '<span role="columnheader">' + App.i18n.t('dev.th.target', '目标占比') + '</span>' +
      '<span role="columnheader">' + App.i18n.t('dev.th.actual', '实际占比') + '</span>' +
      '<span role="columnheader">' + App.i18n.t('dev.th.dev', '偏离值') + '</span>' +
      '<span role="columnheader">' + App.i18n.t('dev.th.bar', '进度条') + '</span>' +
      '<span role="columnheader">' + App.i18n.t('dev.th.status', '状态') + '</span>' +
    '</div>';

    html += r.rows.map(function (row) {
      var devPct = (row.deviation * 100).toFixed(2);
      var sign = row.deviation > 0 ? '+' : '';
      var cls = row.over ? 'over' : 'ok';
      var icon = row.over ? '🔴' : '🟢';
      var statusText = row.over
        ? App.i18n.t('dev.over', '超限')
        : App.i18n.t('dev.ok', '合规');
      var barWidth = Math.min(row.actual * 100, 100);
      var targetLeft = row.target * 100;

      var costCell =
        '<div class="ccy-main">' + App.utils.formatNumber(row.cost) + ' ' + row.code + '</div>' +
        '<div class="ccy-sub">≈ ' + App.utils.formatNumber(row.costHKD) + ' HKD</div>';
      var valueCell =
        '<div class="ccy-main">' + App.utils.formatNumber(row.value) + ' ' + row.code + '</div>' +
        '<div class="ccy-sub">≈ ' + App.utils.formatNumber(row.valueHKD) + ' HKD</div>';

      return '<div class="dev-row ' + cls + '" role="row">' +
        '<span class="dev-code" role="cell">' + row.code + '</span>' +
        '<span class="dev-cost" role="cell">' + costCell + '</span>' +
        '<span class="dev-value" role="cell">' + valueCell + '</span>' +
        '<span class="dev-target" role="cell">' + (row.target * 100).toFixed(0) + '%</span>' +
        '<span class="dev-actual" role="cell">' + (row.actual * 100).toFixed(2) + '%</span>' +
        '<span class="dev-dev" role="cell">' + sign + devPct + '%</span>' +
        '<div class="dev-bar" role="cell" aria-label="' +
          App.utils.escapeHTML(row.code + ' ' + App.i18n.t('dev.th.actual', '实际占比') +
            ' ' + (row.actual * 100).toFixed(2) + '%，' +
            App.i18n.t('dev.th.target', '目标') + ' ' + (row.target * 100).toFixed(0) + '%，' +
            App.i18n.t('dev.th.dev', '偏离') + ' ' + sign + devPct + '%') + '">' +
          '<div class="dev-bar-fill" style="width:' + barWidth + '%"></div>' +
          '<div class="dev-bar-mark" style="left:' + targetLeft + '%"></div>' +
        '</div>' +
        '<span class="dev-status" role="cell" aria-label="' + App.utils.escapeHTML(statusText) + '">' +
          '<span aria-hidden="true">' + icon + '</span>' +
        '</span>' +
      '</div>';
    }).join('');

    var h = r.hkdRow;
    if (h.value > 0 || h.valueHKD > 0) {
      html += '<div class="dev-row hkd-note" role="row">' +
        '<span class="dev-code" role="cell">HKD</span>' +
        '<span class="dev-cost" role="cell">' +
          '<div class="ccy-main">' + App.utils.formatNumber(h.cost) + ' HKD</div>' +
        '</span>' +
        '<span class="dev-value" role="cell">' +
          '<div class="ccy-main">' + App.utils.formatNumber(h.value) + ' HKD</div>' +
        '</span>' +
        '<span class="dev-target" role="cell">' + App.i18n.t('dev.mergeUsd', '并入 USD') + '</span>' +
        '<span class="dev-actual" role="cell">—</span>' +
        '<span class="dev-dev" role="cell">—</span>' +
        '<div class="dev-bar" role="cell"><div class="dev-bar-fill" style="width:0"></div></div>' +
        '<span class="dev-status" role="cell">⚪</span>' +
      '</div>';
    }

    container.innerHTML = html;

    if (badge) {
      var overCount = r.rows.filter(function (x) { return x.over; }).length;
      var okCount = r.rows.length - overCount;
      badge.innerHTML = '<span class="ok">🟢 ' + App.i18n.t('dev.ok', '合规') + ' ' + okCount + ' ' + App.i18n.t('dev.unit', '项') + '</span> ' +
                        '<span class="over">🔴 ' + App.i18n.t('dev.over', '超限') + ' ' + overCount + ' ' + App.i18n.t('dev.unit', '项') + '</span>';
    }

    var slider = App.$('#devThreshold');
    var display = App.$('#devThresholdDisplay');
    if (slider) slider.value = threshold;
    if (display) display.textContent = threshold + '%';
  }

  /* ============================================================
   * 对外
   * ============================================================ */
  App.deviation = {
    requires: ['deviationBody', 'deviationBadge', 'devThreshold', 'devThresholdDisplay'],
    selfTest: selfTest,
    init: function () {
      loadThreshold();

      var slider = App.$('#devThreshold');
      var display = App.$('#devThresholdDisplay');
      if (slider) {
        slider.value = threshold;
        /* ★ 滑块补 aria */
        slider.setAttribute('aria-valuemin', '1');
        slider.setAttribute('aria-valuemax', '15');
        slider.setAttribute('aria-valuenow', String(threshold));
        slider.setAttribute('aria-valuetext', threshold + '%');

        slider.addEventListener('input', function () {
          var v = parseFloat(slider.value);
          if (display) display.textContent = v + '%';
          slider.setAttribute('aria-valuenow', String(v));
          slider.setAttribute('aria-valuetext', v + '%');
          setThreshold(v);
        });
      }
      if (display) display.textContent = threshold + '%';

      App.events.on('hkdatachange', render);
      App.events.on('fxchange', render);
      App.events.on('langchange', render);

      render();
    },
    render: render,
    compute: compute,
    setThreshold: setThreshold,
    getThreshold: function () { return threshold; }
  };

})(window.App = window.App || {});