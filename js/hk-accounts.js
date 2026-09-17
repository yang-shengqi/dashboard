/* ============================================================
 * hk-accounts.js —— 境外账户总览
 * ------------------------------------------------------------
 * 依赖：core.js / hk-data.js / i18n.js
 * 读：accountSummary / bochkSummary / externalAssets / initialPrincipalCNY
 * 汇率：App.fx.rates() + exchangeRateInput（CNY→HKD）
 *
 * 修正（2026-09-14）：
 *   ★ CNY→HKD 汇率持久化：输入后存 localStorage，刷新不回落 1.1000
 *   ★ 汇率兜底：fx 缺币种时用预设汇率，而非退化为 1
 *   ★ Schwab 市值兜底：externalAssets 取不到时用月度趋势最新月
 *   ★ 监听 langchange，切换语言时重渲染
 * ============================================================ */
(function (App) {
  'use strict';

  var RATE_KEY = 'cny-hkd-rate';

  var FALLBACK_RATES = {
    USD: 7.8430, EUR: 9.0969, JPY: 0.0511, CHF: 9.6059, GBP: 10.6100,
    CAD: 5.6551, AUD: 5.6240, SGD: 6.1908, CNH: 1.1694, HKD: 1.0000
  };

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
    return (!isNaN(saved) && saved > 0) ? saved : 1.1694;
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
      if (!holders[h]) holders[h] = { hsbc: 0, bochk: 0, schwab: 0 };
    }

    Object.keys(accounts).forEach(function (h) {
      ensure(h);
      var a = accounts[h] || {};
      holders[h].hsbc = Number(a.netPosition) || 0;
    });

    Object.keys(bochk).forEach(function (h) {
      ensure(h);
      var b = bochk[h] || {};
      holders[h].bochk =
        (Number(b.hkdCurrent) || 0) +
        (Number(b.hkdFixed)   || 0) +
        ((Number(b.usdCurrent) || 0) + (Number(b.usdFixed) || 0)) * rates.USD;
    });

    external.forEach(function (a) {
      var h = a.holder || 'unknown';
      ensure(h);
      var val = (Number(a.value) > 0) ? Number(a.value) : (Number(a.cost) || 0);
      holders[h].schwab += toHKD(val, a.currency, rates);
    });

    var list = Object.keys(holders).sort();

    if (!list.length) {
      grid.innerHTML = '<div class="empty-hint">' +
        App.i18n.t('hkAccounts.empty', '暂无账户数据') + '</div>';
      return;
    }

    var grand = overall.totalAssets || 1;

    grid.innerHTML = list.map(function (h) {
      var d = holders[h];
      var total = d.hsbc + d.bochk + d.schwab;
      var pct = grand > 0 ? (total / grand * 100) : 0;
      var initial = h.charAt(0).toUpperCase();

      return '<div class="holder-card">' +
        '<div class="holder-name">' +
          '<span class="avatar">' + initial + '</span>' +
          h.toUpperCase() +
          '<span class="badge-pct">' + pct.toFixed(1) + '%</span>' +
        '</div>' +
        '<div class="asset-row">' +
          '<span class="label"><span class="dot" style="background:var(--chart-2);"></span>HSBC 投资账户</span>' +
          '<span class="value">' + App.utils.formatNumber(d.hsbc) +
            ' <span class="cur">HKD</span></span>' +
        '</div>' +
        '<div class="asset-row">' +
          '<span class="label"><span class="dot" style="background:var(--chart-3);"></span>BOCHK 储蓄账户</span>' +
          '<span class="value">' + App.utils.formatNumber(d.bochk) +
            ' <span class="cur">HKD</span></span>' +
        '</div>' +
        '<div class="asset-row">' +
          '<span class="label"><span class="dot" style="background:var(--chart-1);"></span>Schwab 股票账户</span>' +
          '<span class="value">' +
            (d.schwab > 0
              ? App.utils.formatNumber(d.schwab) + ' <span class="cur">HKD</span>'
              : '<span class="placeholder">——</span>') +
          '</span>' +
        '</div>' +
        '<div class="holder-total">' +
          '<span class="label">' + App.i18n.t('hkAcc.subtotal', '小计') + '</span>' +
          '<span class="value">' + App.utils.formatNumber(total) +
            ' <span class="cur">HKD</span></span>' +
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

      /* ★ 语言切换 → 重渲染（持有人卡里的「小计」等） */
      App.events.on('langchange', render);

      render();
    },
    render: render,
    compute: compute,
    getRates: getRates
  };

})(window.App = window.App || {});