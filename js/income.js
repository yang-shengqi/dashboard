/* ============================================================
 * income.js —— CRS 年度报税参考（一年一页）
 * ------------------------------------------------------------
 * 表头 4 列：货币 | 分红 | 利息 | 差价
 *
 *   HSBC  分红  ← hkData.dividendSummary
 *   HSBC  利息  ← hkData.interestSummary['HSBC']
 *   BOCHK 利息  ← hkData.interestSummary['BOCHK']
 *   Schwab 全部 ← 页面上手填（localStorage）
 *
 * 表格视觉 100% 复用 dividends.css 的
 *   .ds-year-body / .ds-header / .ds-item
 * 与分红表完全一致，改 dividends.css 一处全局同步。
 *
 * 2026-09-19：
 *   ★ Schwab 输入框 change 后不再 render() —— 避免重绘导致失焦
 *   ★ 删掉无用变量 pageCount
 * ============================================================ */
(function (App) {
  'use strict';

  var SCHWAB_KEY = 'income-schwab-data';

  var HOLDERS = [
    { key: 'huang', label: 'HUANG' },
    { key: 'yang',  label: 'YANG'  }
  ];

  var ACCOUNT_ORDER = ['HSBC', 'BOCHK', 'Schwab'];

  var ACCOUNT_I18N = {
    'HSBC':   'income.account.hsbc',
    'BOCHK':  'income.account.bochk',
    'Schwab': 'income.account.schwab'
  };

  var ACCT_CCY = {
    'HSBC':   ['HKD','USD','EUR','JPY','GBP','CHF','CAD','AUD','SGD','CNH'],
    'BOCHK':  ['HKD','USD'],
    'Schwab': ['USD']
  };

  var currentPage = 1;

  /* ============================================================
   * 工具
   * ============================================================ */
  function T(key, fb) {
    if (App.i18n && typeof App.i18n.t === 'function') {
      var v = App.i18n.t(key, fb);
      if (v != null) return v;
    }
    return fb;
  }

  function fmt(n) {
    if (App.utils && App.utils.formatNumber) return App.utils.formatNumber(n);
    if (n == null || isNaN(n)) return '0.00';
    var p = Number(n).toFixed(2).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return p.join('.');
  }

  function loadSchwab() {
    var d = App.storage.getJSON(SCHWAB_KEY, {});
    return (d && typeof d === 'object') ? d : {};
  }
  function saveSchwab(d) {
    App.storage.setJSON(SCHWAB_KEY, d);
  }
  function schwabKey(holder, year, ccy) {
    return holder + '-' + year + '-' + ccy;
  }

  /* ============================================================
   * 收集
   * ============================================================ */
  function collect() {
    var map = {};

    function ensure(year, holder, account, ccy) {
      if (!map[year]) map[year] = {};
      if (!map[year][holder]) map[year][holder] = {};
      if (!map[year][holder][account]) map[year][holder][account] = {};
      if (!map[year][holder][account][ccy]) {
        map[year][holder][account][ccy] = {
          year: year, ccy: ccy,
          dividend: null, diff: null, interest: null
        };
      }
      return map[year][holder][account][ccy];
    }

    /* 1. HSBC 分红 */
    var divSum = (App.hkData && App.hkData.dividendSummary) || {};
    Object.keys(divSum).forEach(function (holder) {
      Object.keys(divSum[holder]).forEach(function (year) {
        Object.keys(divSum[holder][year]).forEach(function (ccy) {
          var v = Number(divSum[holder][year][ccy]) || 0;
          if (v > 0) ensure(year, holder, 'HSBC', ccy).dividend = v;
        });
      });
    });

    /* 2. 利息（带账户） */
    var intSum = (App.hkData && App.hkData.interestSummary) || {};
    Object.keys(intSum).forEach(function (holder) {
      Object.keys(intSum[holder]).forEach(function (account) {
        Object.keys(intSum[holder][account]).forEach(function (year) {
          Object.keys(intSum[holder][account][year]).forEach(function (ccy) {
            var v = Number(intSum[holder][account][year][ccy]) || 0;
            if (v > 0) ensure(year, holder, account, ccy).interest = v;
          });
        });
      });
    });

    /* 3. Schwab（localStorage 手填） */
    var sch = loadSchwab();
    Object.keys(sch).forEach(function (k) {
      var parts = k.split('-');
      if (parts.length !== 3) return;
      var holder = parts[0], year = parts[1], ccy = parts[2];
      var d = sch[k] || {};
      var t = ensure(year, holder, 'Schwab', ccy);
      if (d.dividend != null && d.dividend !== '') t.dividend = Number(d.dividend) || 0;
      if (d.diff     != null && d.diff     !== '') t.diff     = Number(d.diff)     || 0;
      if (d.interest != null && d.interest !== '') t.interest = Number(d.interest) || 0;
    });

    /* 4. 清理空记录（Schwab 空行保留，因为有输入框） */
    Object.keys(map).forEach(function (year) {
      Object.keys(map[year]).forEach(function (holder) {
        Object.keys(map[year][holder]).forEach(function (account) {
          Object.keys(map[year][holder][account]).forEach(function (ccy) {
            var r = map[year][holder][account][ccy];
            if (r.dividend == null && r.diff == null && r.interest == null) {
              if (account !== 'Schwab') {
                delete map[year][holder][account][ccy];
              }
            }
          });
          if (!Object.keys(map[year][holder][account]).length && account !== 'Schwab') {
            delete map[year][holder][account];
          }
        });
        if (!Object.keys(map[year][holder]).length) delete map[year][holder];
      });
      if (!Object.keys(map[year]).length) delete map[year];
    });

    return map;
  }

  /* ============================================================
   * 账户组
   * ------------------------------------------------------------
   * 结构：
   *   .income-acc-group          （外壳）
   *     .income-acc-head         （● HSBC 投资账户）
   *     .ds-year-body.open       （★ 复用的 padding 层，和分红表一致）
   *       .ds-header             （表头）
   *       .ds-item × N           （数据行）
   * ============================================================ */
  function renderAccountGroup(acct, rows, year, holder) {
    var acctLabel = T(ACCOUNT_I18N[acct], acct);
    var ccyList   = ACCT_CCY[acct] || [];
    var isSchwab  = (acct === 'Schwab');

    var html = '<div class="income-acc-group" data-acct="' + acct + '">';

    /* 组头：账户名 + 色点 */
    html += '<div class="income-acc-head">' +
      '<span class="income-acc-name">' + acctLabel + '</span>' +
    '</div>';

    /* ★ 表体包进 .ds-year-body.open —— padding 由它提供 */
    html += '<div class="ds-year-body open">';

    /* 表头：.ds-header（和分红表同一套） */
    html += '<div class="ds-header">' +
      '<span>' + T('income.col.ccy',      '货币') + '</span>' +
      '<span>' + T('income.col.dividend', '分红') + '</span>' +
      '<span>' + T('income.col.interest', '利息') + '</span>' +
      '<span>' + T('income.col.diff',     '差价') + '</span>' +
    '</div>';

    /* 数据行：.ds-item（和分红表同一套） */
    ccyList.forEach(function (ccy) {
      var r = rows[ccy];

      if (isSchwab) {
        var k = schwabKey(holder, year, ccy);
        var d = (r || {});
        var vDiv = d.dividend != null ? d.dividend : '';
        var vInt = d.interest != null ? d.interest : '';
        var vDif = d.diff     != null ? d.diff     : '';

        html += '<div class="ds-item income-schwab-row" data-key="' + k + '">' +
          '<span>' + ccy + '</span>' +
          '<span><input class="income-cell" type="number" step="0.01" ' +
              'data-field="dividend" value="' + vDiv + '" placeholder="—" /></span>' +
          '<span><input class="income-cell" type="number" step="0.01" ' +
              'data-field="interest" value="' + vInt + '" placeholder="—" /></span>' +
          '<span><input class="income-cell" type="number" step="0.01" ' +
              'data-field="diff" value="' + vDif + '" placeholder="—" /></span>' +
        '</div>';
      } else {
        var divCell = (r && r.dividend != null)
          ? fmt(r.dividend)
          : '<span class="num-dash">—</span>';
        var intCell = (r && r.interest != null)
          ? fmt(r.interest)
          : '<span class="num-dash">—</span>';
        var diffCell = (r && r.diff != null)
          ? '<span class="' + (r.diff < 0 ? 'num-neg' : '') + '">' + fmt(r.diff) + '</span>'
          : '<span class="num-dash">—</span>';

        html += '<div class="ds-item">' +
          '<span>' + ccy + '</span>' +
          '<span>' + divCell + '</span>' +
          '<span>' + intCell + '</span>' +
          '<span>' + diffCell + '</span>' +
        '</div>';
      }
    });

    html += '</div>';   /* 关 .ds-year-body */
    html += '</div>';   /* 关 .income-acc-group */
    return html;
  }

  /* ============================================================
   * 持有人卡片
   * ============================================================ */
  function renderHolderCard(holder, currentYear, map) {
    var byAcct = (map[currentYear] && map[currentYear][holder.key]) || {};

    var html = '<div class="ds-card">' +
      '<div class="ds-holder">' +
        '<span class="ds-holder-name">👤 ' + holder.label + '</span>' +
      '</div>' +
      '<div class="ds-list">';

    ACCOUNT_ORDER.forEach(function (acct) {
      html += renderAccountGroup(acct, byAcct[acct] || {}, currentYear, holder.key);
    });

    html += '</div></div>';
    return html;
  }

  /* ============================================================
   * 主渲染
   * ============================================================ */
  function render() {
    var container = App.$('#incomeList');
    var counter   = App.$('#incomeCount');
    var yearLabel = App.$('#incomeYearLabel');
    if (!container) return;

    var map = collect();
    var allYears = Object.keys(map).sort(function (a, b) {
      return Number(b) - Number(a);
    });

    if (!allYears.length) {
      allYears = [String(new Date().getFullYear())];
    }

    var totalPages = allYears.length;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var currentYear = allYears[currentPage - 1];

    if (yearLabel) {
      yearLabel.textContent = '📅 ' + currentYear + ' ' + T('div.year', '年');
    }
    if (counter) {
      counter.textContent =
        T('unit.yearData', '{n} 年数据').replace('{n}', totalPages);
    }

    var html = '<div class="ds-grid">';
    HOLDERS.forEach(function (h) {
      html += renderHolderCard(h, currentYear, map);
    });
    html += '</div>';
    html += App.pagination.render(currentPage, totalPages);

    container.innerHTML = html;

    bindSchwabInputs(container);

    App.pagination.bind(container, currentPage, totalPages, function (newPage) {
      currentPage = newPage;
      render();
      var panel = App.$('.income-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ============================================================
   * Schwab 输入
   * ------------------------------------------------------------
   * ★ 只存值，不 render() —— 保住焦点，输入不中断
   * ============================================================ */
  function bindSchwabInputs(container) {
    App.$$('.income-schwab-row', container).forEach(function (row) {
      var key = row.getAttribute('data-key');
      App.$$('input.income-cell[data-field]', row).forEach(function (inp) {
        inp.addEventListener('change', function () {
          var field = inp.getAttribute('data-field');
          var raw = inp.value.trim();
          var val = raw === '' ? null : Number(raw);

          var all = loadSchwab();
          if (!all[key]) all[key] = {};
          all[key][field] = val;
          saveSchwab(all);
          /* ★ 不 render() —— 保持焦点 */
        });

        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') inp.blur();
        });
      });
    });
  }

  /* ============================================================
   * 对外
   * ============================================================ */
  App.income = {
    init: function () {
      App.events.on('hkdatachange', render);
      App.events.on('langchange',   render);
      App.events.on('themechange',  render);
      App.events.on('skinchange',   render);
      render();
    },
    render: render,
    collect: collect
  };

})(window.App = window.App || {});