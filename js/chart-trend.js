/* ============================================================
 * chart-trend.js —— 多账户净额走势（读 hkData.accountTrend）
 * ------------------------------------------------------------
 * 数据：accountTrend[holder][YYYY-MM] = value  (HKD)
 *       schwabTrendData[YYYY-MM]     = value  (USD)  ← 需换算成 HKD
 * 汇率：App.utils.usdToHkd()
 * ★ Y 轴宽度锁死 64px（与其它图一致）
 * ★ 曲线下方带同色渐变填充（跟随皮肤）
 * ============================================================ */
(function (App) {
  'use strict';

  /* Schwab 原始数据是否为美元。若以后 hk-data 已换算，改成 false 即可 */
  var SCHWAB_DATA_IN_USD = true;

  var SERIES = [
    { key: 'huang', i18n: 'trend.huang', color: '--chart-1', rgbVar: '--rgb-blue',   ccy: 'HKD' },
    { key: 'yang',  i18n: 'trend.yang',  color: '--chart-2', rgbVar: '--rgb-green',  ccy: 'HKD' },
    { key: 'us',    i18n: 'trend.us',    color: '--chart-3', rgbVar: '--rgb-orange', ccy: SCHWAB_DATA_IN_USD ? 'USD' : 'HKD' }
  ];

  /* 读取 CSS 变量里的 "R G B" 三通道，如 "10 132 255" */
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

  function render() {
    var canvas = App.$('#trendChart');
    if (!canvas) return;

    var trend  = App.hkData.accountTrend    || {};
    var schwab = App.hkData.schwabTrendData || {};

    var monthSet = {};
    Object.keys(trend).forEach(function (h) {
      Object.keys(trend[h]).forEach(function (m) { monthSet[m] = 1; });
    });
    Object.keys(schwab).forEach(function (m) { monthSet[m] = 1; });

    var months = Object.keys(monthSet).sort();

    var dataMap = {
      huang: trend.huang || {},
      yang:  trend.yang  || {},
      us:    schwab
    };

    /* ★ 一次性取汇率，本图所有 USD 系列共用 */
    var usdRate = App.utils.usdToHkd();

    /* 取值 + 按币种换算 */
    function pickValue(series, month) {
      var v = dataMap[series.key][month];
      if (v === undefined || v === null || v === '') return null;
      var n = Number(v);
      if (isNaN(n)) return null;
      return series.ccy === 'USD' ? n * usdRate : n;
    }

    /* 预读三条线的 RGB 分量，用于生成渐变 */
    var rgbCache = {};
    SERIES.forEach(function (s) { rgbCache[s.key] = readRGB(s.rgbVar); });

    App.charts.create('trendChart', canvas, function (t) {
      var datasets = SERIES.map(function (s) {
        var color = t[s.color];       // 线条色（来自主题变量）
        var rgb   = rgbCache[s.key];  // 同色系的 RGB 三通道

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
            legend: {
              display: true,
              position: 'top',
              align: 'end',
              labels: {
                usePointStyle: true,
                boxWidth: 8,
                boxHeight: 8,
                padding: 14
              }
            },
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

  App.chartTrend = {
    init: function () {
      App.events.on('hkdatachange', render);
      /* ★ 汇率刷新 / 同步后重绘 */
      App.events.on('fxchange', render);
      render();
    },
    render: render
  };

})(window.App = window.App || {});