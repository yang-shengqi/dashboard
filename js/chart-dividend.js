/* ============================================================
 * chart-dividend.js —— 年度总分红柱状
 * ------------------------------------------------------------
 * ★ Y 轴宽度锁死 64px（与月度图一致，不再自动伸缩）
 * ★ Y 轴格式：万（1 位小数）
 * ★ 语言切换 → 重绘（图例 label 用了 i18n）
 * ============================================================ */
(function (App) {
  'use strict';

  function fmtAxis(v) {
    if (v === 0) return '0';
    return (v / 10000).toFixed(1) + '万';
  }

  function render() {
    var canvas = App.$('#dividendChart');
    if (!canvas) return;

    var summary = App.hkData.dividendSummary || {};
    var rates = (App.fx && App.fx.rates) ? App.fx.rates() : {};

    var yearMap = {};
    Object.keys(summary).forEach(function (holder) {
      var years = summary[holder];
      Object.keys(years).forEach(function (year) {
        var yd = years[year];
        Object.keys(yd).forEach(function (ccy) {
          var amt = yd[ccy] || 0;
          if (amt > 0) {
            var rate = (ccy === 'HKD') ? 1 : (rates[ccy] || 1);
            yearMap[year] = (yearMap[year] || 0) + amt * rate;
          }
        });
      });
    });

    var years = Object.keys(yearMap).sort();
    var values = years.map(function (y) { return yearMap[y]; });

    App.charts.create('dividendChart', canvas, function (t) {
      return {
        type: 'bar',
        data: {
          labels: years.map(function (y) { return y + ''; }),
          datasets: [{
            label: App.i18n.t('dividend.yearLabel', '年度分红'),
            data: values,
            backgroundColor: t['--chart-3'],
            borderRadius: 4,
            barThickness: 28
          }]
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  return ' ' + App.utils.formatNumber(ctx.parsed.y) + ' HKD';
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                display: true,
                color: t['--chart-axis'],
                font: { size: 11 },
                callback: fmtAxis,
                maxTicksLimit: 6
              },
              afterFit: function (scale) { scale.width = 64; }
            },
            x: { grid: { display: false } }
          }
        }
      };
    });
  }

  App.chartDividend = {
    init: function () {
      App.events.on('hkdatachange', render);
      App.events.on('fxchange', render);
      /* ★ 语言切换 → 重绘 */
      App.events.on('langchange', render);
      render();
    },
    render: render
  };

})(window.App = window.App || {});