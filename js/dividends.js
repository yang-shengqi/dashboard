/* ============================================================
 * dividends.js —— 分红记录（按持有人分卡，年度分块）
 * ------------------------------------------------------------
 * 数据来源：hkData.dividendSummary[holder][year][ccy]
 * 分页：使用 App.pagination（core.js）—— 样式全部走 dividends.css
 * 复合主键：编号@持有人
 *
 * 本版修改：
 *   ★ 货币列跟随语言：
 *       中文 → 「美元 USD」
 *       英文 → 「USD」
 *   ★ 年份折叠头是 <button>（键盘可达）
 *   ★ getHolderTotalValue / getHolderCurrencyValue 补 value=0 → cost 兜底
 * ============================================================ */
(function (App) {
  'use strict';

  var TEN_CURRENCIES = ['USD', 'EUR', 'JPY', 'CHF', 'GBP', 'CAD', 'AUD', 'SGD', 'CNH', 'HKD'];

  /* 中文货币名（英文只用代码） */
  var CURRENCY_CN = {
    'USD': '美元',  'EUR': '欧元',  'JPY': '日元',
    'CHF': '瑞郎',  'GBP': '英镑',  'CAD': '加元',
    'AUD': '澳元',  'SGD': '新元',  'CNH': '人民币',
    'HKD': '港元'
  };

  /* ★ 跟随语言的货币标签 */
  function ccyLabel(ccy) {
    var lang = (window.App && App.i18n && typeof App.i18n.lang === 'function')
      ? App.i18n.lang() : 'zh';

    if (lang === 'en') {
      return ccy;                          /* 英文：只显示代码 */
    }
    return CURRENCY_CN[ccy] || ccy;
  }

  var YEARS_PER_PAGE = 5;
  var currentPage = 1;
  var pageSize = YEARS_PER_PAGE;

  function typeOf(f) {
    var map = App.hkData.dividendTypeMap || {};
    return map[App.hkData.tplKey(f.id, f.holder)];
  }

  /* value=0 且有 cost → 用 cost */
  function effectiveValue(f) {
    var v = Number(f.value) || 0;
    if (v === 0 && Number(f.cost) !== 0) v = Number(f.cost);
    return v;
  }

  function getHolderCurrencyValue(holder, ccy, rates) {
    var holdings = App.hkData.holdings;
    var total = 0;

    holdings.forEach(function (f) {
      if ((f.holder || '').toLowerCase() !== holder.toLowerCase()) return;
      if (f.currency !== ccy) return;
      if (typeOf(f) !== '分红') return;
      var rate = (ccy === 'HKD') ? 1 : (rates[ccy] || 1);
      total += effectiveValue(f) * rate;
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
      total += effectiveValue(f) * rate;
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
          var yearLabel = year + ' ' + App.i18n.t('div.year', '年');

          html += '<div class="ds-year-block">';
          html += '<button class="ds-year-header" type="button" ' +
            'data-year="' + year + '" ' +
            'aria-expanded="' + (isLatest ? 'true' : 'false') + '" ' +
            'aria-controls="div-year-body-' + holder + '-' + year + '">' +
            '<span class="ds-year-label">📅 ' + yearLabel + '</span>' +
            '<span class="ds-year-arrow' + (isLatest ? ' open' : '') + '" aria-hidden="true">▶</span>' +
            '<span class="ds-year-total">' +
              App.i18n.t('div.yearTotal', '年分红') + '：' +
              App.utils.formatNumber(yearTotalHKD) + ' HKD</span>' +
            '<span class="ds-year-yield">' +
              App.i18n.t('div.yearYield', '年收益') + '：' +
              (yearYield > 0 ? yearYield.toFixed(2) + '%' : '—') +
            '</span>' +
          '</button>';

          html += '<div class="ds-year-body' + (isLatest ? ' open' : '') + '" ' +
            'id="div-year-body-' + holder + '-' + year + '">';
          html += '<div class="ds-header" role="row">' +
            '<span role="columnheader">' + App.i18n.t('div.colYear', '年度') + '</span>' +
            '<span role="columnheader">' + App.i18n.t('div.colCcy', '币种') + '</span>' +
            '<span role="columnheader">' + App.i18n.t('div.colAmount', '分红金额') + '</span>' +
            '<span role="columnheader">' + App.i18n.t('div.colYield', '收益率') + '</span>' +
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

            /* ★ 货币标签跟随语言 */
            var label = ccyLabel(ccy);

            html += '<div class="ds-item" role="row">' +
              '<span class="ds-year-text" role="cell">' + yearLabel + '</span>' +
              '<span class="ds-ccy" role="cell">' + label + '</span>' +
              '<span class="' + amtClass + '" role="cell">' +
                App.utils.formatNumber(amt) + ' ' + ccy + '</span>' +
              '<span class="' + yieldClass + '" role="cell">' + yieldDisplay + '</span>' +
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

    /* 年份折叠：<button> 事件 */
    App.$$('.ds-year-header', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var block = btn.parentElement;
        var body = block.querySelector('.ds-year-body');
        var arrow = btn.querySelector('.ds-year-arrow');
        var isOpen = body && body.classList.contains('open');

        if (body) body.classList.toggle('open');
        if (arrow) arrow.classList.toggle('open');
        btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
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