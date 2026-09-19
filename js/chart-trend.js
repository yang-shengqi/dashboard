/* ============================================================
 * chart-trend.js —— 多账户净额走势（读 hkData.accountTrend）
 * ------------------------------------------------------------
 * 数据：accountTrend[holder][YYYY-MM] = value  (HKD)
 *       schwabTrendData[YYYY-MM]     = value  (USD)  ← 需换算成 HKD
 * 汇率：App.utils.usdToHkd()
 * ★ Y 轴宽度锁死 64px（与其它图一致）
 * ★ 曲线下方带同色渐变填充（跟随皮肤）
 * ★ 语言切换 → 重绘（图例用了 i18n）
 *
 * 2026-09-19 改版：
 *   ★ 关闭 Chart.js 自带图例 → 用 HTML 图例（左上对齐）
 *   ★ 时间区间切换（右上对齐）：近 1 年 / 近 3 年 / 近 5 年 / 全部
 * ============================================================ */
(function (App) {
  'use strict';

  var SCHWAB_DATA_IN_USD = true;

  var SERIES = [
    { key: 'huang', i18n: 'trend.huang', color: '--chart-1', rgbVar: '--rgb-blue',   ccy: 'HKD' },
    { key: 'yang',  i18n: 'trend.yang',  color: '--chart-2', rgbVar: '--rgb-green',  ccy: 'HKD' },
    { key: 'us',    i18n: 'trend.us',    color: '--chart-3', rgbVar: '--rgb-orange', ccy: SCHWAB_DATA_IN_USD ? 'USD' : 'HKD' }
  ];

  /* 当前时间区间：'all' | '5y' | '3y' | '1y' */
  var currentRange = 'all';

  function readRGB(name) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    var p = v.split(/\s+/).map(Number);
    return (p.length === 3 && p.every(function (n) { return !isNaN(n); }))
      ? p
      : [128, 128, 128];
  }

  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  }

  /* ---------- 按区间裁剪月份（保留最近 N 个月） ---------- */
  function sliceMonths(months, range) {
    if (range === 'all') return months;
    var n = (range === '1y') ? 12
          : (range === '3y') ? 36
          : 60;                       /* 5y */
    return months.length > n ? months.slice(-n) : months;
  }

  /* ---------- HTML 图例（左上） ---------- */
  function renderLegend() {
    var el = App.$('#trendLegend');
    if (!el) return;

    var t = App.charts.tokens();

    el.innerHTML = SERIES.map(function (s) {
      var color = t[s.color] || 'var(' + s.color + ')';
      return '<span class="trend-legend-item">' +
        '<span class="trend-legend-dot" style="background:' + color + '"></span>' +
        App.i18n.t(s.i18n, s.key.toUpperCase()) +
      '</span>';
    }).join('');
  }

  /* ---------- 渲染主流程 ---------- */
  function render() {
    var canvas = App.$('#trendChart');
    if (!canvas) return;

    var trend  = App.hkData.accountTrend    || {};
    var schwab = App.hkData.schwabTrendData || {};

    /* 收集所有出现的月份 */
    var monthSet = {};
    Object.keys(trend).forEach(function (h) {
      Object.keys(trend[h]).forEach(function (m) { monthSet[m] = 1; });
    });
    Object.keys(schwab).forEach(function (m) { monthSet[m] = 1; });

    var allMonths = Object.keys(monthSet).sort();

    /* ★ 按当前区间裁剪 */
    var months = sliceMonths(allMonths, currentRange);

    var dataMap = {
      huang: trend.huang || {},
      yang:  trend.yang  || {},
      us:    schwab
    };

    var usdRate = App.utils.usdToHkd();

    function pickValue(series, month) {
      var v = dataMap[series.key][month];
      if (v === undefined || v === null || v === '') return null;
      var n = Number(v);
      if (isNaN(n)) return null;
      return series.ccy === 'USD' ? n * usdRate : n;
    }

    var rgbCache = {};
    SERIES.forEach(function (s) { rgbCache[s.key] = readRGB(s.rgbVar); });

    /* ★ 先画 HTML 图例（每次 render 都刷新，跟随语言） */
    renderLegend();

    App.charts.create('trendChart', canvas, function (t) {
      var datasets = SERIES.map(function (s) {
        var color = t[s.color];
        var rgb   = rgbCache[s.key];

        return {
          label: App.i18n.t(s.i18n, s.key.toUpperCase()),
          data: months.map(function (m) { return pickValue(s, m); }),
          borderColor: color,
          borderWidth: 2,
          tension: 0.32,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBorderWidth: 2,
          pointHoverBorderColor: '#fff',
          pointHoverBackgroundColor: color,
          fill: true,
          backgroundColor: function (ctx) {
            var chart = ctx.chart;
            var area  = chart.chartArea;
            if (!area) return 'transparent';
            var g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
            g.addColorStop(0,    rgba(rgb, .28));
            g.addColorStop(.55,  rgba(rgb, .10));
            g.addColorStop(1,    rgba(rgb, 0));
            return g;
          },
          spanGaps: false
        };
      });

      return {
        type: 'line',
        data: { labels: months, datasets: datasets },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: {
            /* ★ 关闭 Chart.js 自带图例 —— 用 HTML 图例替代 */
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  if (ctx.parsed.y == null) return null;
                  return ' ' + ctx.dataset.label + '：' +
                    App.utils.formatNumber(ctx.parsed.y) + ' HKD';
                }
              }
            }
          },
          scales: {
            x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
            y: {
              ticks: {
                callback: function (v) {
                  var a = Math.abs(v);
                  if (a >= 10000) return (v / 10000).toFixed(0) + '万';
                  if (a >= 1000)  return (v / 1000).toFixed(0) + 'k';
                  return String(v);
                }
              },
              afterFit: function (scale) { scale.width = 64; }
            }
          }
        }
      };
    });
  }

  /* ---------- 绑定时间区间按钮 ---------- */
  function bindRange() {
    var wrap = App.$('#trendRange');
    if (!wrap) return;

    App.$$('.range-btn', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var r = btn.getAttribute('data-range');
        if (!r || r === currentRange) return;
        currentRange = r;

        App.$$('.range-btn', wrap).forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });

        render();
      });
    });
  }

  App.chartTrend = {
    init: function () {
      App.events.on('hkdatachange', render);
      App.events.on('fxchange',     render);
      /* ★ 语言切换 → 重绘（图例 label 用了 i18n） */
      App.events.on('langchange',   render);

      bindRange();
      render();
    },
    render: render
  };

})(window.App = window.App || {});