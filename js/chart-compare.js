/* ============================================================
 * chart-compare.js —— HSBC vs Schwab 双柱对比
 * ------------------------------------------------------------
 * Y 轴单位跟随语言：中文「万/亿」/ 英文「k/M/B」
 * ============================================================ */
(function (App) {
  'use strict';

  /* ---------- Y 轴数字格式化：跟随语言换单位 ---------- */
  function fmtAxisNum(v, decimals) {
    if (v === 0) return '0';
    var d = (decimals == null) ? 0 : decimals;
    var lang = (window.App && App.i18n && typeof App.i18n.lang === 'function')
      ? App.i18n.lang() : 'zh';
    var a = Math.abs(v);
    var sign = v < 0 ? '-' : '';

    if (lang === 'en') {
      if (a >= 1e9) return sign + (a / 1e9).toFixed(d) + 'B';
      if (a >= 1e6) return sign + (a / 1e6).toFixed(d) + 'M';
      if (a >= 1e3) return sign + (a / 1e3).toFixed(d) + 'k';
      return String(v);
    }
    if (a >= 1e8) return sign + (a / 1e8).toFixed(d) + '亿';
    if (a >= 1e4) return sign + (a / 1e4).toFixed(d) + '万';
    if (a >= 1e3) return sign + (a / 1e3).toFixed(d) + 'k';
    return String(v);
  }

  var SERIES = [
    { label: 'HSBC',   color: '--chart-1' },
    { label: 'Schwab', color: '--chart-3' }
  ];

  var lastSnapshot = { months: 0, hsbcLast: null, schwabLast: null };

  function renderLegend() {
    var el = App.$('#compareLegend');
    if (!el) return;

    var t = App.charts.tokens();

    el.innerHTML = SERIES.map(function (s) {
      var color = t[s.color] || 'var(' + s.color + ')';
      return '<span class="compare-legend-item">' +
        '<span class="compare-legend-dot" style="background:' + color + '" aria-hidden="true"></span>' +
        s.label +
      '</span>';
    }).join('');
  }

  function buildDescription() {
    if (!lastSnapshot.months) {
      return App.i18n.t('compare.title', 'HSBC vs Schwab') + '：' + App.i18n.t('asset.empty', '暂无数据');
    }
    return App.i18n.t('compare.title', 'HSBC vs Schwab') + '，' +
      lastSnapshot.months + ' ' + App.i18n.t('g10.unit', '个') + '。' +
      'HSBC：' + App.utils.formatNumber(lastSnapshot.hsbcLast) + ' HKD，' +
      'Schwab：' + App.utils.formatNumber(lastSnapshot.schwabLast) + ' HKD。';
  }

  function render() {
    var canvas = App.$('#compareChart');
    if (!canvas) return;

    var trend  = App.hkData.accountTrend    || {};
    var schwab = App.hkData.schwabTrendData || {};

    var monthSet = {};
    Object.keys(trend).forEach(function (h) {
      Object.keys(trend[h]).forEach(function (m) { monthSet[m] = 1; });
    });
    Object.keys(schwab).forEach(function (m) { monthSet[m] = 1; });
    var months = Object.keys(monthSet).sort();

    var hsbcData = months.map(function (m) {
      var sum = 0, has = false;
      Object.keys(trend).forEach(function (h) {
        var raw = trend[h][m];
        if (raw === undefined || raw === null || raw === '') return;
        var v = Number(raw);
        if (isNaN(v)) return;
        sum += v; has = true;
      });
      return has ? sum : null;
    });

    var usdRate = App.utils.usdToHkd();
    var schwabData = months.map(function (m) {
      var raw = schwab[m];
      if (raw === undefined || raw === null || raw === '') return null;
      var v = Number(raw);
      if (isNaN(v)) return null;
      return v * usdRate;
    });

    lastSnapshot.months = months.length;
    lastSnapshot.hsbcLast = (function () {
      for (var i = hsbcData.length - 1; i >= 0; i--) if (hsbcData[i] != null) return hsbcData[i];
      return 0;
    })();
    lastSnapshot.schwabLast = (function () {
      for (var i = schwabData.length - 1; i >= 0; i--) if (schwabData[i] != null) return schwabData[i];
      return 0;
    })();

    renderLegend();

    App.charts.create('compareChart', canvas, function (t) {
      return {
        type: 'bar',
        data: {
          labels: months,
          datasets: [
            {
              label: 'HSBC',
              data: hsbcData,
              backgroundColor: t['--chart-1'],
              borderRadius: 3,
              barPercentage: 0.8,
              categoryPercentage: 0.7
            },
            {
              label: 'Schwab',
              data: schwabData,
              backgroundColor: t['--chart-3'],
              borderRadius: 3,
              barPercentage: 0.8,
              categoryPercentage: 0.7
            }
          ]
        },
        options: {
          plugins: {
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
            x: {
              ticks: {
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 12,
                callback: function (v, i) {
                  var label = this.getLabelForValue(v);
                  if (!label) return '';
                  var parts = label.split('-');
                  if (parts[1] === '01' || i === 0) return parts[0];
                  return '';
                }
              }
            },
            y: {
              ticks: {
                callback: function (v) { return fmtAxisNum(v, 0); }
              },
              afterFit: function (scale) { scale.width = 64; }
            }
          }
        }
      };
    }, {
      ariaLabel: App.i18n.t('compare.title', 'HSBC vs Schwab'),
      description: buildDescription
    });
  }

  App.chartCompare = {
    init: function () {
      App.events.on('hkdatachange', render);
      App.events.on('fxchange', render);
      App.events.on('langchange', render);
      render();
    },
    render: render
  };

})(window.App = window.App || {});