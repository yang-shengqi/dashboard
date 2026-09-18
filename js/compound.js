/* ============================================================
 * compound.js —— 复利计算器（定投 + 单笔）
 * ------------------------------------------------------------
 * 依赖：core.js / i18n.js
 * 纯计算模块，不依赖数据
 * 对外：App.compound.init()
 * ★ 监听 langchange，切换语言时两个计算器都重渲染
 * ============================================================ */
(function (App) {
  'use strict';

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

  App.compound = {
    init: function () {
      bind();
      renderDCA();
      renderLump();

      /* ★ 语言切换 → 两个计算器都重渲染 */
      App.events.on('langchange', function () {
        renderDCA();
        renderLump();
      });
    },
    renderDCA: renderDCA,
    renderLump: renderLump
  };

})(window.App = window.App || {});