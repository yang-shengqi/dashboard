/* ============================================================
 * rebalance.js —— HSBC 基金最低起投 / 再平衡建议
 * ------------------------------------------------------------
 * 渲染目标：
 *   <tbody id="rebalanceBody">  表体（表头在 HTML 里）
 *   <span id="rebBuyTip">       右上角提示（{n} 动态替换）
 *
 * 数据：
 *   - hkData.currencyMinInvestMap      每币种最低起投额（原币种）
 *   - App.deviation.compute()          每币种目标占比、当前市值（HKD）、偏离
 *   - hkData.accountSummary[holder]    持有人现金池（HKD）
 *        = hkdBalance + foreignBalance（HSBC 港元结余 + 外币结余）
 *
 * 建议逻辑（每持有人独立，按行顺序消耗现金）：
 *   needHKD = 目标金额 − 当前市值（HKD）
 *   - needHKD ≤ 0                       → "—"
 *   - minHKD > 0 且 needHKD < minHKD     → "—"
 *   - 剩余现金 < needHKD                 → "—"
 *   - 否则 → 显示买入 min(need, 剩余现金)，并从剩余现金中扣除
 *
 * 右上角提示「根据当下投资账户余额可购买 N 只基金」：
 *   统计 HUANG + YANG 两列里状态为 buy 的格子，按币种去重。
 *   文案里的 {n} 走 i18n 模板。
 *
 * ★ 监听 themechange —— 因为 theme.js 会调 i18n.refresh()，
 *   把 #rebBuyTip 的 textContent 重置成字典原文（含 {n}），
 *   必须重渲染一次才能把 {n} 替换回真实数字。
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

  var FALLBACK_RATE = {
    USD: 7.8470, EUR: 9.0758, JPY: 0.0493, CHF: 9.6495, GBP: 10.6170,
    CAD: 5.6539, AUD: 5.5565, SGD: 6.1324, CNH: 1.1635, HKD: 1
  };

  /* ---------- 工具 ---------- */
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

  /* ---------- 持有人现金池（HKD）= 港元结余 + 外币结余 ---------- */
  function cashPool(holder) {
    var acc = App.hkData.accountSummary || {};
    var key = Object.keys(acc).filter(function (k) {
      return k.toLowerCase() === holder.toLowerCase();
    })[0];
    var a = key ? acc[key] : {};
    return (Number(a.hkdBalance) || 0) + (Number(a.foreignBalance) || 0);
  }

  /* ---------- 拿 deviation 结果 ---------- */
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

  /* ---------- 状态 ---------- */
  function statusOf(row) {
    if (!row)                          return { cls: 'ok',    text: T('reb.status.ok',    '合规') };
    if (row.over && row.deviation > 0) return { cls: 'over',  text: T('reb.status.over',  '超配') };
    if (row.over && row.deviation < 0) return { cls: 'under', text: T('reb.status.under', '少配') };
    return                                    { cls: 'ok',    text: T('reb.status.ok',    '合规') };
  }

  /* ---------- 按顺序分配现金（每持有人独立，买一个扣一笔） ---------- */
  function allocate(ctx) {
    var out = { huang: {}, yang: {} };

    HOLDERS.forEach(function (h) {
      var cash = ctx.cash[h.key] || 0;

      CCY_ORDER.forEach(function (code) {
        /* HKD 不参与建议 */
        if (code === 'HKD') { out[h.key][code] = { cls: 'dash', text: '—' }; return; }

        var row = ctx.needs.rows[code];
        if (!row) { out[h.key][code] = { cls: 'dash', text: '—' }; return; }

        var need   = row.target * ctx.needs.total - (Number(row.amountHKD) || 0);
        var minHKD = (Number(ctx.minMap[code]) || 0) * (ctx.rates[code] || 1);

        /* 已达标 / 超配 */
        if (need <= 0) { out[h.key][code] = { cls: 'dash', text: '—' }; return; }

        /* 未达最低起投 */
        if (minHKD > 0 && need < minHKD) {
          out[h.key][code] = { cls: 'dash', text: '—' };
          return;
        }

        /* 资金判断 */
        var buyable = Math.min(need, cash);
        if (buyable <= 0 || (minHKD > 0 && buyable < minHKD)) {
          out[h.key][code] = { cls: 'dash', text: '—' };
          return;
        }

        out[h.key][code] = { cls: 'buy', text: fmt(buyable) + ' HKD' };
        cash -= buyable;   /* ★ 关键：买完扣掉，后面的币种用剩下的钱 */
      });
    });

    return out;
  }

  /* ---------- 统计「可购买 N 只基金」 ---------- */
  function countBuyable(alloc) {
    /* 去重：同一币种，任意持有人能买 → 计 1 只 */
    var buySet = {};
    HOLDERS.forEach(function (h) {
      Object.keys(alloc[h.key] || {}).forEach(function (code) {
        if (alloc[h.key][code].cls === 'buy') buySet[code] = 1;
      });
    });
    return Object.keys(buySet).length;
  }

  /* ---------- 单行（<tr>） ---------- */
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
      var adv = ctx.alloc[h.key][code] || { cls: 'dash', text: '—' };
      return '<td class="col-advice num ' + adv.cls + '">' + adv.text + '</td>';
    }).join('');

    return '<tr>' +
      '<td class="col-code">'                   + cn       + '</td>' +
      '<td class="col-min num">'                + minText  + '</td>' +
      '<td class="col-hkd num">'                + hkdText  + '</td>' +
      '<td class="col-status ' + st.cls + '">'  + st.text  + '</td>' +
      cells +
    '</tr>';
  }

  /* ---------- 渲染 ---------- */
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

    var ctx = {
      minMap: minMap,
      rates:  getRates(),
      needs:  computeNeeds(),
      cash:   {
        huang: cashPool('huang'),
        yang:  cashPool('yang')
      }
    };
    ctx.alloc = allocate(ctx);

    tbody.innerHTML = CCY_ORDER.map(function (code) {
      return buildRow(code, ctx);
    }).join('');

    /* ---------- 右上角提示：根据当下投资账户余额可购买 N 只基金 ---------- */
    var tip = App.$('#rebBuyTip');
    if (tip) {
      var n = countBuyable(ctx.alloc);
      var tpl = T('reb.tip.buyCount', '根据当下投资账户余额可购买 {n} 只基金');
      tip.textContent = tpl.replace('{n}', n);
    }
  }

  App.rebalance = {
    init: function () {
      App.events.on('hkdatachange', render);
      App.events.on('fxchange',     render);
      App.events.on('langchange',   render);
      /* ★ theme.js 会调 i18n.refresh() 把 #rebBuyTip 重置为字典原文（含 {n}），
            必须监听 themechange 再渲染一次，否则 {n} 会露出来 */
      App.events.on('themechange',  render);
      render();
    },
    render: render
  };

})(window.App = window.App || {});