/* ============================================================
 * rebalance.js —— HSBC 基金最低起投 / 再平衡建议
 * ------------------------------------------------------------
 * 渲染目标：
 *   <tbody id="rebalanceBody">  表体（表头在 HTML 里）
 *   <span id="rebBuyTip">       右上角提示（{n} 动态替换）
 *
 * 算法：每持有人独立，按 CCY_ORDER 顺序消耗现金
 *   needHKD = 目标金额 − 当前市值（HKD）
 *   - needHKD ≤ 0                       → "—"
 *   - minHKD > 0 且 needHKD < minHKD     → "—"
 *   - 剩余现金 < minHKD                  → "—"
 *   - 否则 → 买入 min(need, 剩余现金)，并从剩余现金中扣除
 *
 * 本版修改：
 *   ★ 表体行补 role="row" / role="cell"
 *   ★ 「买入 X HKD」补 aria-label —— 屏幕阅读器能读到建议
 * ============================================================ */
(function (App) {
  'use strict';

  var CCY_ORDER = ['USD', 'EUR', 'JPY', 'CHF', 'GBP', 'CAD', 'AUD', 'SGD', 'CNH', 'HKD'];

  var CCY_CN = {
    USD: '美元', EUR: '欧元', JPY: '日元', CHF: '瑞郎', GBP: '英镑',
    CAD: '加元', AUD: '澳元', SGD: '新元', CNH: '人民币', HKD: '港元'
  };

  var HOLDERS = [
    { key: 'huang', label: 'HUANG' },
    { key: 'yang',  label: 'YANG'  }
  ];

  var FALLBACK_RATE = App.constants.FALLBACK_RATES;

  /* ============================================================
   * 纯函数：单个持有人的现金分配
   * ============================================================ */
  function allocateForHolder(cash, needs, minMap, rates) {
    var out = {};

    CCY_ORDER.forEach(function (code) {
      if (code === 'HKD') {
        out[code] = { cls: 'dash', amount: 0 };
        return;
      }

      var row = needs.rows[code];
      if (!row) {
        out[code] = { cls: 'dash', amount: 0 };
        return;
      }

      var need = row.target * needs.total - (Number(row.amountHKD) || 0);
      var minHKD = (Number(minMap[code]) || 0) * (rates[code] || 1);

      if (need <= 0) {
        out[code] = { cls: 'dash', amount: 0 };
        return;
      }

      if (minHKD > 0 && need < minHKD) {
        out[code] = { cls: 'dash', amount: 0 };
        return;
      }

      var buyable = Math.min(need, cash);
      if (buyable <= 0 || (minHKD > 0 && buyable < minHKD)) {
        out[code] = { cls: 'dash', amount: 0 };
        return;
      }

      out[code] = { cls: 'buy', amount: buyable };
      cash -= buyable;
    });

    return out;
  }

  /* ============================================================
   * 自测
   * ============================================================ */
  function selfTest() {
    var fail = [];
    var eps = 0.01;
    var rates = { USD: 1, EUR: 1, JPY: 1, CHF: 1, GBP: 1,
                  CAD: 1, AUD: 1, SGD: 1, CNH: 1, HKD: 1 };

    var r1 = allocateForHolder(
      5000,
      { total: 10000, rows: { USD: { target: 0.5, amountHKD: 3000 } } },
      {},
      rates
    );
    if (r1.USD.cls !== 'buy' || Math.abs(r1.USD.amount - 2000) > eps)
      fail.push('测试1：USD 应 buy/2000，实际 ' + r1.USD.cls + '/' + r1.USD.amount);

    var r2 = allocateForHolder(
      1000,
      { total: 10000, rows: { USD: { target: 0.5, amountHKD: 3000 } } },
      {},
      rates
    );
    if (r2.USD.cls !== 'buy' || Math.abs(r2.USD.amount - 1000) > eps)
      fail.push('测试2：USD 应 buy/1000，实际 ' + r2.USD.cls + '/' + r2.USD.amount);

    var r3 = allocateForHolder(
      500,
      { total: 10000, rows: { USD: { target: 0.5, amountHKD: 3000 } } },
      { USD: 800 },
      rates
    );
    if (r3.USD.cls !== 'dash')
      fail.push('测试3：未达最低 800，USD 应 dash，实际 ' + r3.USD.cls);

    var r4 = allocateForHolder(
      5000,
      { total: 10000, rows: { USD: { target: 0.3, amountHKD: 5000 } } },
      {},
      rates
    );
    if (r4.USD.cls !== 'dash')
      fail.push('测试4：已达标，USD 应 dash，实际 ' + r4.USD.cls);

    var r5 = allocateForHolder(
      1500,
      { total: 10000, rows: {
          USD: { target: 0.2, amountHKD: 0 },
          EUR: { target: 0.2, amountHKD: 0 }
      } },
      {},
      rates
    );
    if (r5.USD.cls !== 'buy' || Math.abs(r5.USD.amount - 1500) > eps)
      fail.push('测试5：USD 应吃光 1500，实际 ' + r5.USD.cls + '/' + r5.USD.amount);
    if (r5.EUR.cls !== 'dash')
      fail.push('测试5：EUR 应无现金 → dash，实际 ' + r5.EUR.cls);

    var r6 = allocateForHolder(
      5000,
      { total: 10000, rows: { HKD: { target: 0.5, amountHKD: 0 } } },
      {},
      rates
    );
    if (r6.HKD.cls !== 'dash')
      fail.push('测试6：HKD 应始终 dash，实际 ' + r6.HKD.cls);

    var r7 = allocateForHolder(
      7000,
      { total: 10000, rows: { USD: { target: 0.5, amountHKD: 0 } } },
      { USD: 1000 },
      { USD: 7.85 }
    );
    if (r7.USD.cls !== 'dash')
      fail.push('测试7：need 5000 < minHKD 7850，USD 应 dash，实际 ' + r7.USD.cls);

    return fail;
  }

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
    if (App.utils && typeof App.utils.formatNumber === 'function') {
      return App.utils.formatNumber(n);
    }
    if (n == null || isNaN(n)) return '0.00';
    var p = Number(n).toFixed(2).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return p.join('.');
  }

  function getRates() {
    var live = (App.fx && typeof App.fx.rates === 'function') ? App.fx.rates() : {};
    var out = {};
    CCY_ORDER.forEach(function (c) {
      var v = live[c];
      out[c] = (typeof v === 'number' && v > 0) ? v : (FALLBACK_RATE[c] || 1);
    });
    out.HKD = 1;
    return out;
  }

  function cashPool(holder) {
    var acc = App.hkData.accountSummary || {};
    var key = Object.keys(acc).filter(function (k) {
      return k.toLowerCase() === holder.toLowerCase();
    })[0];
    var a = key ? acc[key] : {};
    return (Number(a.hkdBalance) || 0) + (Number(a.foreignBalance) || 0);
  }

  function computeNeeds() {
    var out = { total: 0, rows: {} };
    if (!App.deviation || typeof App.deviation.compute !== 'function') return out;
    var dev;
    try { dev = App.deviation.compute(); } catch (e) { return out; }
    if (!dev || !dev.total) return out;
    out.total = dev.total;
    (dev.rows || []).forEach(function (r) { out.rows[r.code] = r; });
    return out;
  }

  function statusOf(row) {
    if (!row)                          return { cls: 'ok',    text: T('reb.status.ok',    '合规') };
    if (row.over && row.deviation > 0) return { cls: 'over',  text: T('reb.status.over',  '超配') };
    if (row.over && row.deviation < 0) return { cls: 'under', text: T('reb.status.under', '少配') };
    return                                    { cls: 'ok',    text: T('reb.status.ok',    '合规') };
  }

  function adviceText(adv) {
    if (!adv || adv.cls === 'dash' || adv.amount <= 0) {
      return { cls: 'dash', text: '—', aria: '' };
    }
    var money = fmt(adv.amount) + ' HKD';
    return { cls: 'buy', text: money, aria: money };
  }

  function countBuyable(alloc) {
    var buySet = {};
    HOLDERS.forEach(function (h) {
      Object.keys(alloc[h.key] || {}).forEach(function (code) {
        if (alloc[h.key][code].cls === 'buy' && alloc[h.key][code].amount > 0) {
          buySet[code] = 1;
        }
      });
    });
    return Object.keys(buySet).length;
  }

  function buildRow(code, ctx) {
    var min    = Number(ctx.minMap[code]) || 0;
    var rate   = ctx.rates[code] || 1;
    var minHKD = min * rate;

    var minText = min > 0
      ? fmt(min) + ' ' + code
      : '<span class="muted">' + T('reb.minUnset', '未设定') + '</span>';
    var hkdText = min > 0 ? '≈ ' + fmt(minHKD) + ' HKD' : '—';
    var cn = CCY_CN[code] ? (CCY_CN[code] + ' ' + code) : code;

    var row = ctx.needs.rows[code];
    var st  = statusOf(row);

    var cells = HOLDERS.map(function (h) {
      var adv = adviceText(ctx.alloc[h.key][code]);
      var ariaAttr = adv.aria
        ? ' aria-label="' + App.utils.escapeHTML(h.label + '：' + adv.aria) + '"'
        : '';
      return '<td class="col-advice num ' + adv.cls + '" role="cell"' + ariaAttr + '>' + adv.text + '</td>';
    }).join('');

    return '<tr role="row">' +
      '<td class="col-code" role="cell">'                 + cn       + '</td>' +
      '<td class="col-min num" role="cell">'              + minText  + '</td>' +
      '<td class="col-hkd num" role="cell">'              + hkdText  + '</td>' +
      '<td class="col-status ' + st.cls + '" role="cell">' + st.text + '</td>' +
      cells +
    '</tr>';
  }

  function render() {
    var tbody = App.$('#rebalanceBody');
    if (!tbody) return;

    var minMap   = App.hkData.currencyMinInvestMap || {};
    var holdings = App.hkData.holdings || [];

    if (!holdings.length && !Object.keys(minMap).length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-hint">' +
        T('reb.empty', '暂无持仓数据') + '</td></tr>';
      var tipEmpty = App.$('#rebBuyTip');
      if (tipEmpty) tipEmpty.textContent = '';
      return;
    }

    var rates = getRates();
    var needs = computeNeeds();

    var alloc = {
      huang: allocateForHolder(cashPool('huang'), needs, minMap, rates),
      yang:  allocateForHolder(cashPool('yang'),  needs, minMap, rates)
    };

    tbody.innerHTML = CCY_ORDER.map(function (code) {
      return buildRow(code, {
        minMap: minMap,
        rates:  rates,
        needs:  needs,
        alloc:  alloc
      });
    }).join('');

    var tip = App.$('#rebBuyTip');
    if (tip) {
      var n = countBuyable(alloc);
      var tpl = T('reb.tip.buyCount', '根据当下投资账户余额可购买 {n} 只基金');
      tip.textContent = tpl.replace('{n}', n);
    }
  }

  App.rebalance = {
    requires: ['rebalanceBody', 'rebBuyTip'],
    selfTest: selfTest,
    init: function () {
      App.events.on('hkdatachange', render);
      App.events.on('fxchange',     render);
      App.events.on('langchange',   render);
      /* theme.js 会调 i18n.refresh() 把 #rebBuyTip 重置为字典原文（含 {n}），
         必须监听 themechange 再渲染一次，否则 {n} 会露出来 */
      App.events.on('themechange',  render);
      render();
    },
    render: render
  };

})(window.App = window.App || {});