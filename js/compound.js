/* ============================================================
 * compound.js —— 复利计算器（定投 + 单笔）
 * ------------------------------------------------------------
 * 依赖：core.js / i18n.js
 * 纯计算模块，不依赖数据
 * 对外：App.compound.init()
 * 事件：langchange（重渲染）
 * 自测：App.compound.selfTest()
 *
 * 本版修改：无（保留原样）
 * ============================================================ */
(function (App) {
  'use strict';

  /* ============================================================
   * 计算核（纯函数）
   * ============================================================ */
  function futureValueDCA(pmt, annualRate, years) {
    if (pmt <= 0 || years <= 0) return { fv: 0, input: 0, profit: 0 };
    var r = annualRate / 100 / 12;
    var n = years * 12;
    var fv = (r === 0) ? pmt * n : pmt * ((Math.pow(1 + r, n) - 1) / r);
    var input = pmt * n;
    return { fv: fv, input: input, profit: fv - input };
  }

  function futureValueLump(pv, annualRate, years) {
    if (pv <= 0 || years <= 0) return { fv: 0, profit: 0 };
    var fv = pv * Math.pow(1 + annualRate / 100, years);
    return { fv: fv, profit: fv - pv };
  }

  /* ============================================================
   * 自测
   * ============================================================ */
  function selfTest() {
    var fail = [];
    var eps = 0.01;

    var r1 = futureValueLump(1000, 10, 1);
    if (Math.abs(r1.fv - 1100) > eps)
      fail.push('单笔 1000×10%×1年 应=1100，实际 ' + r1.fv.toFixed(2));

    var r2 = futureValueLump(1000, 10, 2);
    if (Math.abs(r2.fv - 1210) > eps)
      fail.push('单笔 1000×10%×2年 应=1210，实际 ' + r2.fv.toFixed(2));

    var r3 = futureValueLump(1000, 0, 5);
    if (Math.abs(r3.fv - 1000) > eps)
      fail.push('单笔 1000×0%×5年 应=1000，实际 ' + r3.fv.toFixed(2));

    var r4 = futureValueLump(1000, -50, 1);
    if (Math.abs(r4.fv - 500) > eps)
      fail.push('单笔 1000×-50%×1年 应=500，实际 ' + r4.fv.toFixed(2));

    var r5 = futureValueLump(0, 10, 10);
    if (r5.fv !== 0)
      fail.push('单笔本金 0 应=0，实际 ' + r5.fv);

    var r6 = futureValueLump(1000, 10, 0);
    if (r6.fv !== 0)
      fail.push('单笔年数 0 应=0，实际 ' + r6.fv);

    var d1 = futureValueDCA(1000, 0, 1);
    if (Math.abs(d1.fv - 12000) > eps)
      fail.push('定投 1000/月×0%×1年 应=12000，实际 ' + d1.fv.toFixed(2));
    if (Math.abs(d1.input - 12000) > eps)
      fail.push('定投总投入 应=12000，实际 ' + d1.input.toFixed(2));
    if (Math.abs(d1.profit) > eps)
      fail.push('定投 0% 总收益 应=0，实际 ' + d1.profit.toFixed(2));

    var d2 = futureValueDCA(0, 10, 10);
    if (d2.fv !== 0)
      fail.push('定投月投 0 应=0，实际 ' + d2.fv);

    var d3 = futureValueDCA(1000, 10, 0);
    if (d3.fv !== 0)
      fail.push('定投年数 0 应=0，实际 ' + d3.fv);

    var d4 = futureValueDCA(1000, 10, 10);
    if (d4.fv <= d4.input)
      fail.push('定投 10% 10 年 终值应 > 总投入');

    return fail;
  }

  /* ============================================================
   * DOM 渲染
   * ============================================================ */
  function num(id, fallback) {
    var el = App.$(id);
    if (!el) return fallback;
    var v = parseFloat(el.value);
    return isNaN(v) ? fallback : v;
  }

  function setHTML(id, html) {
    var el = App.$(id);
    if (el) el.innerHTML = html;
  }

  function setText(id, text) {
    var el = App.$(id);
    if (el) el.textContent = text;
  }

  function renderDCA() {
    var pmt   = num('#dcaMonthly', 0);
    var rate  = num('#dcaRate', 0);
    var years = num('#dcaYears', 0);

    if (pmt <= 0 || years <= 0) {
      setHTML('#dcaResult', '—');
      setText('#dcaInput', '—');
      setText('#dcaProfit', '—');
      return;
    }

    var r = futureValueDCA(pmt, rate, years);
    setHTML('#dcaResult', App.utils.formatNumber(r.fv) +
             ' <span class="c-result-unit">HKD</span>');
    setText('#dcaInput', App.utils.formatNumber(r.input));
    setText('#dcaProfit', App.utils.formatNumber(r.profit));
  }

  function renderLump() {
    var pv    = num('#lumpPrincipal', 0);
    var rate  = num('#lumpRate', 0);
    var years = num('#lumpYears', 0);

    if (pv <= 0 || years <= 0) {
      setHTML('#lumpResult', '—');
      setText('#lumpProfit', '—');
      return;
    }

    var r = futureValueLump(pv, rate, years);
    setHTML('#lumpResult', App.utils.formatNumber(r.fv) +
             ' <span class="c-result-unit">HKD</span>');
    setText('#lumpProfit', App.utils.formatNumber(r.profit));
  }

  function bind() {
    ['#dcaMonthly', '#dcaRate', '#dcaYears'].forEach(function (sel) {
      var el = App.$(sel);
      if (el) el.addEventListener('input', renderDCA);
    });
    ['#lumpPrincipal', '#lumpRate', '#lumpYears'].forEach(function (sel) {
      var el = App.$(sel);
      if (el) el.addEventListener('input', renderLump);
    });
  }

  /* ============================================================
   * 对外
   * ============================================================ */
  App.compound = {
    requires: [
      'dcaMonthly', 'dcaRate', 'dcaYears',
      'dcaResult', 'dcaInput', 'dcaProfit',
      'lumpPrincipal', 'lumpRate', 'lumpYears',
      'lumpResult', 'lumpProfit'
    ],
    selfTest: selfTest,
    init: function () {
      bind();
      renderDCA();
      renderLump();

      App.events.on('langchange', function () {
        renderDCA();
        renderLump();
      });
    },
    renderDCA: renderDCA,
    renderLump: renderLump
  };

})(window.App = window.App || {});