/* ============================================================
 * dividends.js —— 分红记录（按持有人分卡，年度分块）
 * ------------------------------------------------------------
 * 数据来源：hkData.dividendSummary[holder][year][ccy]
 * 分页：使用 App.pagination（core.js）—— 样式全部走 dividends.css
 * ★ v3：查 dividendTypeMap 时用复合主键「编号@持有人」
 * ============================================================ */
(function (App) {
  'use strict';

  var TEN_CURRENCIES = ['USD', 'EUR', 'JPY', 'CHF', 'GBP', 'CAD', 'AUD', 'SGD', 'CNH', 'HKD'];

  var CURRENCY_LABELS = {
    'USD': '美元 USD',  'EUR': '欧元 EUR',  'JPY': '日元 JPY',
    'CHF': '瑞郎 CHF',  'GBP': '英镑 GBP',  'CAD': '加元 CAD',
    'AUD': '澳元 AUD',  'SGD': '新元 SGD',  'CNH': 'CNH',
    'HKD': '港元 HKD'
  };

  var YEARS_PER_PAGE = 5;
  var currentPage = 1;
  var pageSize = YEARS_PER_PAGE;

  /* ★ 复合主键查表工具 */
  function typeOf(f) {
    var map = App.hkData.dividendTypeMap || {};
    return map[App.hkData.tplKey(f.id, f.holder)];
  }

  function getHolderCurrencyValue(holder, ccy, rates) {
    var holdings = App.hkData.holdings;
    var total = 0;

    holdings.forEach(function (f) {
      if ((f.holder || '').toLowerCase() !== holder.toLowerCase()) return;
      if (f.currency !== ccy) return;
      if (typeOf(f) !== '分红') return;
      var rate = (ccy === 'HKD') ? 1 : (rates[ccy] || 1);
      total += (Number(f.value) || 0) * rate;
    });

    return total;
  }

  function getHolderTotalValue(holder, rates) {
    var holdings = App.hkData.holdings;
    var total = 0;

    holdings.forEach(function (f) {
      if ((f.holder || '').toLowerCase() !== holder.toLowerCase()) return;
      if (typeOf(f) !== '分红') return;
      var rate = (f.currency === 'HKD') ? 1 : (rates[f.currency] || 1);
      total += (Number(f.value) || 0) * rate;
    });

    return total;
  }

  function render() {
    var container = App.$('#dividendsList');
    var counter = App.$('#divCount');
    if (!container) return;

    var summary = App.hkData.dividendSummary || {};
    var rates = (App.fx && typeof App.fx.rates === 'function') ? App.fx.rates() : {};
    var holders = Object.keys(summary);

    if (!holders.length) {
      if (counter) counter.textContent = '0 条';
      container.innerHTML = '<div class="empty-hint">' +
        App.i18n.t('div.empty', '暂无分红记录，请导入 Excel') + '</div>';
      return;
    }

    var allYearsSet = {};
    holders.forEach(function (h) {
      Object.keys(summary[h]).forEach(function (y) { allYearsSet[y] = 1; });
    });
    var allYears = Object.keys(allYearsSet).sort(function (a, b) {
      return Number(b) - Number(a);
    });

    var totalPages = Math.max(1, Math.ceil(allYears.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var startIdx = (currentPage - 1) * pageSize;
    var pageYears = allYears.slice(startIdx, startIdx + pageSize);
    var pageYearSet = {};
    pageYears.forEach(function (y) { pageYearSet[y] = 1; });

    if (counter) counter.textContent =
      App.i18n.t('unit.yearData', '{n} 年数据').replace('{n}', pageYears.length);

    var html = '<div class="ds-grid">';

    holders.sort().forEach(function (holder) {
      var data = summary[holder] || {};
      var holderYears = Object.keys(data).sort(function (a, b) {
        return Number(b) - Number(a);
      });
      var pageHolderYears = holderYears.filter(function (y) { return pageYearSet[y]; });

      var totalAccHKD = 0;
      holderYears.forEach(function (y) {
        TEN_CURRENCIES.forEach(function (ccy) {
          var amt = data[y][ccy] || 0;
          if (amt > 0) {
            var rate = (ccy === 'HKD') ? 1 : (rates[ccy] || 1);
            totalAccHKD += amt * rate;
          }
        });
      });

      html += '<div class="ds-card">';
      html += '<div class="ds-holder">' +
        '<span class="ds-holder-name">👤 ' + holder.toUpperCase() + '</span>' +
        '<span class="ds-total-accumulated">' +
          App.i18n.t('div.accumulated', '累积分红') + '：' +
          '<span>' + App.utils.formatNumber(totalAccHKD) + ' HKD</span>' +
        '</span>' +
      '</div>';

      html += '<div class="ds-list">';

      if (pageHolderYears.length === 0) {
        html += '<div class="ds-empty-page">' +
          App.i18n.t('div.emptyPage', '该持有人暂无本页年份数据') + '</div>';
      } else {
        pageHolderYears.forEach(function (year) {
          var yearData = data[year] || {};

          var yearTotalHKD = 0;
          TEN_CURRENCIES.forEach(function (ccy) {
            var amt = yearData[ccy] || 0;
            if (amt > 0) {
              var rate = (ccy === 'HKD') ? 1 : (rates[ccy] || 1);
              yearTotalHKD += amt * rate;
            }
          });

          var holderValueHKD = getHolderTotalValue(holder, rates);
          var yearYield = holderValueHKD > 0 ? (yearTotalHKD / holderValueHKD * 100) : 0;

          var isLatest = (year === pageHolderYears[0]);

          html += '<div class="ds-year-block">';
          html += '<div class="ds-year-header" data-year="' + year + '">' +
            '<span class="ds-year-label">📅 ' + year + ' ' +
              App.i18n.t('div.year', '年') + '</span>' +
            '<span class="ds-year-arrow' + (isLatest ? ' open' : '') + '">▶</span>' +
            '<span class="ds-year-total">' +
              App.i18n.t('div.yearTotal', '年分红') + '：' +
              App.utils.formatNumber(yearTotalHKD) + ' HKD</span>' +
            '<span class="ds-year-yield">' +
              App.i18n.t('div.yearYield', '年收益') + '：' +
              (yearYield > 0 ? yearYield.toFixed(2) + '%' : '—') +
            '</span>' +
          '</div>';

          html += '<div class="ds-year-body' + (isLatest ? ' open' : '') + '">';
          html += '<div class="ds-header">' +
            '<span>' + App.i18n.t('div.colYear', '年度') + '</span>' +
            '<span>' + App.i18n.t('div.colCcy', '币种') + '</span>' +
            '<span>' + App.i18n.t('div.colAmount', '现金余额') + '</span>' +
            '<span>' + App.i18n.t('div.colYield', '收益率') + '</span>' +
          '</div>';

          TEN_CURRENCIES.forEach(function (ccy) {
            var amt = yearData[ccy] || 0;
            var currencyValHKD = getHolderCurrencyValue(holder, ccy, rates);
            var yieldPct = (currencyValHKD > 0 && amt > 0)
              ? (amt * (ccy === 'HKD' ? 1 : (rates[ccy] || 1)) / currencyValHKD * 100)
              : 0;

            var amtClass = amt === 0 ? 'ds-amount-zero' : 'ds-amount';
            var yieldDisplay = yieldPct > 0 ? yieldPct.toFixed(2) + '%' : '—';
            var yieldClass = yieldPct > 0 ? 'ds-yield' : 'ds-yield na';

            html += '<div class="ds-item">' +
              '<span class="ds-year-text">' + year + ' ' +
                App.i18n.t('div.year', '年') + '</span>' +
              '<span class="ds-ccy">' + (CURRENCY_LABELS[ccy] || ccy) + '</span>' +
              '<span class="' + amtClass + '">' +
                App.utils.formatNumber(amt) + ' ' + ccy + '</span>' +
              '<span class="' + yieldClass + '">' + yieldDisplay + '</span>' +
            '</div>';
          });

          html += '</div></div>';
        });
      }

      html += '</div></div>';
    });

    html += '</div>';
    html += App.pagination.render(currentPage, totalPages, 'div.page');

    container.innerHTML = html;

    App.$$('.ds-year-header', container).forEach(function (h) {
      h.addEventListener('click', function () {
        var block = h.parentElement;
        var body = block.querySelector('.ds-year-body');
        var arrow = h.querySelector('.ds-year-arrow');
        if (body) body.classList.toggle('open');
        if (arrow) arrow.classList.toggle('open');
      });
    });

    App.pagination.bind(container, currentPage, totalPages, function (newPage) {
      currentPage = newPage;
      render();
      var panel = App.$('.dividends-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  App.dividends = {
    init: function () {
      App.events.on('hkdatachange', function () {
        currentPage = 1;
        render();
      });
      App.events.on('fxchange', render);
      App.events.on('langchange', render);
      render();
    },
    render: render,
    resetPage: function () { currentPage = 1; render(); }
  };

})(window.App = window.App || {});