/* ============================================================
 * hk-accounts.js —— 境外账户总览
 * ------------------------------------------------------------
 * 依赖：core.js / hk-data.js / i18n.js
 * 读：accountSummary / bochkSummary / externalAssets / initialPrincipalCNY
 * 汇率：App.fx.rates() + exchangeRateInput（CNY→HKD）
 *
 * 修正（2026-09-17）：
 *   ★ 每个账户包成 .acc-group 背景块（汇总 + 明细同组）
 *   ★ 颜色全部走 CSS 类，随皮肤、主题自动换色
 *   ★ 明细行金额为 0 时不显示
 *
 * 修正（2026-09-19）：
 *   ★ FALLBACK_RATES.CNH 与 fx.js 对齐（1.1694 → 1.1635）
 *     避免首屏几百毫秒内 CNY→HKD 换算与汇率面板不一致
 * ============================================================ */
(function (App) {
  'use strict';

  var RATE_KEY = 'cny-hkd-rate';

  /* ★ 从 App.constants 读，与 core / fx 同源 */
  var FALLBACK_RATES = App.constants.FALLBACK_RATES;

  function T(key, fallback) {
    if (App.i18n && typeof App.i18n.t === 'function') {
      return App.i18n.t(key, fallback);
    }
    return fallback;
  }

  /* ============================================================
   * 一、汇率
   * ============================================================ */
  function getRates() {
    var live = (App.fx && typeof App.fx.rates === 'function') ? App.fx.rates() : {};
    var out = {};
    Object.keys(FALLBACK_RATES).forEach(function (code) {
      var v = live[code];
      out[code] = (typeof v === 'number' && v > 0) ? v : FALLBACK_RATES[code];
    });
    out.HKD = 1;
    return out;
  }

  function toHKD(amount, ccy, rates) {
    var rate = (ccy === 'HKD') ? 1 : (rates[ccy] || FALLBACK_RATES[ccy] || 1);
    return (Number(amount) || 0) * rate;
  }

  function getExchangeRate() {
    var input = App.$('#exchangeRateInput');
    if (input) {
      var v = parseFloat(input.value);
      if (!isNaN(v) && v > 0) return v;
    }
    var saved = parseFloat(App.storage.get(RATE_KEY, ''));
    return (!isNaN(saved) && saved > 0) ? saved : App.constants.DEFAULT_CNY_HKD;
  }

  function restoreExchangeRate() {
    var input = App.$('#exchangeRateInput');
    if (!input) return;
    var saved = parseFloat(App.storage.get(RATE_KEY, ''));
    if (!isNaN(saved) && saved > 0) {
      input.value = saved.toFixed(4);
    }
  }

  function saveExchangeRate() {
    var input = App.$('#exchangeRateInput');
    if (!input) return;
    var v = parseFloat(input.value);
    if (!isNaN(v) && v > 0) App.storage.set(RATE_KEY, String(v));
  }

  /* ============================================================
   * 二、主计算
   * ============================================================ */
  function compute() {
    var rates    = getRates();
    var accounts = App.hkData.accountSummary || {};
    var bochk    = App.hkData.bochkSummary || {};
    var external = App.hkData.externalAssets || [];

    var hsbcMarket = 0, hsbcCash = 0, bochkCash = 0, schwabMarket = 0;

    Object.keys(accounts).forEach(function (h) {
      var a = accounts[h] || {};
      hsbcMarket += Number(a.investBalance) || 0;
      hsbcCash   += (Number(a.hkdBalance) || 0) + (Number(a.foreignBalance) || 0);
    });

    Object.keys(bochk).forEach(function (h) {
      var b = bochk[h] || {};
      bochkCash +=
        (Number(b.hkdCurrent) || 0) +
        (Number(b.hkdFixed)   || 0) +
        ((Number(b.usdCurrent) || 0) + (Number(b.usdFixed) || 0)) * rates.USD;
    });

    external.forEach(function (a) {
      var val = (Number(a.value) > 0) ? Number(a.value) : (Number(a.cost) || 0);
      schwabMarket += toHKD(val, a.currency, rates);
    });

    if (schwabMarket === 0) {
      var trend  = App.hkData.schwabTrendData || {};
      var months = Object.keys(trend).sort();
      if (months.length) {
        var latest = months[months.length - 1];
        var usdVal = Number(trend[latest]);
        if (!isNaN(usdVal) && usdVal > 0) schwabMarket = usdVal * rates.USD;
      }
    }

    var marketValue = hsbcMarket + schwabMarket;
    var cashBalance = hsbcCash + bochkCash;
    var totalAssets = marketValue + cashBalance;

    var principalCNY = Number(App.hkData.initialPrincipalCNY) || 0;
    var exchangeRate = getExchangeRate();
    var principalHKD = principalCNY * exchangeRate;
    var profit       = totalAssets - principalHKD;

    return {
      principalCNY: principalCNY,
      exchangeRate: exchangeRate,
      principalHKD: principalHKD,
      hsbcMarket:   hsbcMarket,
      schwabMarket: schwabMarket,
      hsbcCash:     hsbcCash,
      bochkCash:    bochkCash,
      marketValue:  marketValue,
      cashBalance:  cashBalance,
      totalAssets:  totalAssets,
      profit:       profit
    };
  }

  /* ============================================================
   * 三、渲染
   * ============================================================ */
  function render() {
    var r = compute();

    var pCny = App.$('#principalCNYDisplay');
    var pHkd = App.$('#principalHKDDisplay');
    if (pCny) pCny.textContent = App.utils.formatNumber(r.principalCNY);
    if (pHkd) pHkd.textContent = App.utils.formatNumber(r.principalHKD);

    var totalEl  = App.$('#totalAssetsDisplay');
    var mktEl    = App.$('#marketValueDisplay');
    var cashEl   = App.$('#cashBalanceDisplay');
    var profitEl = App.$('#profitDisplay');

    if (totalEl) totalEl.textContent = App.utils.formatNumber(r.totalAssets);
    if (mktEl)   mktEl.textContent   = App.utils.formatNumber(r.marketValue);
    if (cashEl)  cashEl.textContent  = App.utils.formatNumber(r.cashBalance);

    if (profitEl) {
      profitEl.textContent =
        (r.profit >= 0 ? '+' : '') + App.utils.formatNumber(r.profit);
      profitEl.className =
        'value-number ' + (r.profit >= 0 ? 'positive' : 'negative');
    }

    var hm = App.$('#hsbcMarketValue');
    var sm = App.$('#schwabMarketValue');
    var hc = App.$('#hsbcCashValue');
    var bc = App.$('#bochkCashValue');

    if (hm) hm.innerHTML = App.utils.formatNumber(r.hsbcMarket)   + ' <span class="cur">HKD</span>';
    if (sm) sm.innerHTML = App.utils.formatNumber(r.schwabMarket) + ' <span class="cur">HKD</span>';
    if (hc) hc.innerHTML = App.utils.formatNumber(r.hsbcCash)     + ' <span class="cur">HKD</span>';
    if (bc) bc.innerHTML = App.utils.formatNumber(r.bochkCash)    + ' <span class="cur">HKD</span>';

    renderHolders(r);
  }

  /* ============================================================
   * 四、持有人分组卡
   * ------------------------------------------------------------
   * 结构：
   *   ┌ .acc-group ────────────────────┐
   *   │ ● HSBC 投资账户   349,950.92   │  ← 汇总行（彩色）
   *   │   HSBC 港元结余       490.61   │  ← 明细行（灰）
   *   │   HSBC 外币结余     8,076.51   │
   *   │   HSBC 投资结余   341,383.80   │
   *   └────────────────────────────────┘
   *   ┌ .acc-group ────────────────────┐
   *   │ ● BOCHK 储蓄账户   60,432.86   │
   *   │   ...                          │
   *   └────────────────────────────────┘
   *   ...
   *   ──────────────
   *   小计
   * ============================================================ */
  function renderHolders(overall) {
    var grid = App.$('#hkAccountsGrid');
    if (!grid) return;

    var accounts = App.hkData.accountSummary || {};
    var bochk    = App.hkData.bochkSummary || {};
    var external = App.hkData.externalAssets || [];
    var rates    = getRates();

    var holders = {};

    function ensure(h) {
      if (!holders[h]) {
        holders[h] = {
          hsbc: 0, bochk: 0, schwab: 0,
          hkdBalance: 0, foreignBalance: 0, investBalance: 0,
          bochkParts: { hkdCurrent: 0, hkdFixed: 0, usdCurrent: 0, usdFixed: 0 }
        };
      }
    }

    /* ---- HSBC ---- */
    Object.keys(accounts).forEach(function (h) {
      ensure(h);
      var a = accounts[h] || {};
      holders[h].hkdBalance     = Number(a.hkdBalance)     || 0;
      holders[h].foreignBalance = Number(a.foreignBalance) || 0;
      holders[h].investBalance  = Number(a.investBalance)  || 0;
      holders[h].hsbc = Number(a.netPosition) ||
        (holders[h].hkdBalance + holders[h].foreignBalance + holders[h].investBalance);
    });

    /* ---- BOCHK ---- */
    Object.keys(bochk).forEach(function (h) {
      ensure(h);
      var b = bochk[h] || {};
      var hkdCur = Number(b.hkdCurrent) || 0;
      var hkdFix = Number(b.hkdFixed)   || 0;
      var usdCur = (Number(b.usdCurrent) || 0) * rates.USD;
      var usdFix = (Number(b.usdFixed)   || 0) * rates.USD;

      holders[h].bochkParts = {
        hkdCurrent: hkdCur,
        hkdFixed:   hkdFix,
        usdCurrent: usdCur,
        usdFixed:   usdFix
      };
      holders[h].bochk = hkdCur + hkdFix + usdCur + usdFix;
    });

    /* ---- Schwab ---- */
    external.forEach(function (a) {
      var h = a.holder || 'unknown';
      ensure(h);
      var val = (Number(a.value) > 0) ? Number(a.value) : (Number(a.cost) || 0);
      holders[h].schwab += toHKD(val, a.currency, rates);
    });

    var list = Object.keys(holders).sort();

    if (!list.length) {
      grid.innerHTML = '<div class="empty-hint">' +
        T('hkAccounts.empty', '暂无账户数据') + '</div>';
      return;
    }

    var grand = overall.totalAssets || 1;

    /* ---- 行构造器 ---- */
    function fmt(n) { return App.utils.formatNumber(n); }

    function summaryRow(mod, label, amount, isZero) {
      return '<div class="asset-row asset-row--' + mod + '">' +
        '<span class="label"><span class="dot"></span>' + label + '</span>' +
        '<span class="value">' +
          (isZero
            ? '<span class="placeholder">——</span>'
            : fmt(amount) + ' <span class="cur">HKD</span>') +
        '</span>' +
      '</div>';
    }

    function detailRow(label, amount) {
      return '<div class="asset-row asset-row--detail">' +
        '<span class="label">' + label + '</span>' +
        '<span class="value">' + fmt(amount) + ' <span class="cur">HKD</span></span>' +
      '</div>';
    }

    /* ★ 把一个账户的汇总 + 明细包进同一个背景块 */
    function group(mod, label, amount, isZero, rows) {
      var head = summaryRow(mod, label, amount, isZero);
      var body = rows.length
        ? '<div class="asset-detail-group">' + rows.join('') + '</div>'
        : '';
      return '<div class="acc-group">' + head + body + '</div>';
    }

    grid.innerHTML = list.map(function (h) {
      var d = holders[h];
      var total = d.hsbc + d.bochk + d.schwab;
      var pct = grand > 0 ? (total / grand * 100) : 0;
      var initial = h.charAt(0).toUpperCase();

      /* HSBC 明细（为 0 不显示） */
      var hsbcRows = [];
      if (d.hkdBalance > 0)     hsbcRows.push(detailRow(T('hkAcc.hkdBal',     'HSBC 港元结余'), d.hkdBalance));
      if (d.foreignBalance > 0) hsbcRows.push(detailRow(T('hkAcc.foreignBal', 'HSBC 外币结余'), d.foreignBalance));
      if (d.investBalance > 0)  hsbcRows.push(detailRow(T('hkAcc.invBal',     'HSBC 投资结余'), d.investBalance));

      /* BOCHK 明细（为 0 不显示） */
      var bp = d.bochkParts || {};
      var bochkRows = [];
      var bochkHkd = bp.hkdCurrent + bp.hkdFixed;   /* 港元：活期 + 定存 */
      var bochkUsd = bp.usdCurrent + bp.usdFixed;   /* 美元：活期 + 定存 */
      if (bochkHkd > 0) bochkRows.push(detailRow(T('hkAcc.bochkHkd', 'BOCHK 港元现金'), bochkHkd));
      if (bochkUsd > 0) bochkRows.push(detailRow(T('hkAcc.bochkUsd', 'BOCHK 美元现金'), bochkUsd));

      return '<div class="holder-card">' +

        '<div class="holder-name">' +
          '<span class="avatar">' + initial + '</span>' +
          h.toUpperCase() +
          '<span class="badge-pct">' + pct.toFixed(1) + '%</span>' +
        '</div>' +

        group('hsbc',   T('hkAcc.hsbcInv', 'HSBC 投资账户'),  d.hsbc,   false,          hsbcRows)  +
        group('bochk',  T('hkAcc.bochk',   'BOCHK 储蓄账户'), d.bochk,  false,          bochkRows) +
        group('schwab', T('hkAcc.schwab',  'Schwab 股票账户'), d.schwab, d.schwab <= 0, [])        +

        '<div class="holder-total">' +
          '<span class="label">' + T('hkAcc.subtotal', '小计') + '</span>' +
          '<span class="value">' + fmt(total) + ' <span class="cur">HKD</span></span>' +
        '</div>' +

      '</div>';
    }).join('');
  }

  /* ============================================================
   * 五、对外
   * ============================================================ */
  App.hkAccounts = {
    init: function () {
      restoreExchangeRate();

      var input = App.$('#exchangeRateInput');
      if (input) {
        var onChange = function () {
          saveExchangeRate();
          render();
        };
        input.addEventListener('input',  onChange);
        input.addEventListener('change', onChange);
      }

      App.events.on('hkdatachange', render);
      App.events.on('fxchange', render);
      App.events.on('langchange', render);

      render();
    },
    render: render,
    compute: compute,
    getRates: getRates
  };

})(window.App = window.App || {});