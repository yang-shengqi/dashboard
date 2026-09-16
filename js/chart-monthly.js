/* ============================================================
 * chart-monthly.js —— HSBC 月度市值合计柱状
 * ------------------------------------------------------------
 * ★ Y 轴宽度锁死 64px（与分红图一致）
 * ★ Y 轴格式：万（1 位小数）
 * ============================================================ */
(function (App) {
  'use strict';

  function fmtAxis(v) {
    if (v === 0) return '0';
    return (v / 10000).toFixed(1) + '万';
  }

  function render() {
    var canvas = App.$('#monthlyChart');
    if (!canvas) return;

    var trend = App.hkData.accountTrend || {};

    var monthSet = {};
    Object.keys(trend).forEach(function (h) {
      Object.keys(trend[h]).forEach(function (m) { monthSet[m] = 1; });
    });
    var months = Object.keys(monthSet).sort();

    var data = months.map(function (m) {
      var sum = 0;
      Object.keys(trend).forEach(function (h) {
        var v = Number(trend[h][m]);
        if (!isNaN(v)) sum += v;
      });
      return sum;
    });

    App.charts.create('monthlyChart', canvas, function (t) {
      return {
        type: 'bar',
        data: {
          labels: months,
          datasets: [{
            label: App.i18n.t('monthly.label', 'HSBC 市值'),
            data: data,
            backgroundColor: t['--chart-1'],
            borderRadius: 3,
            barPercentage: 0.4,
            categoryPercentage: 0.7
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
              beginAtZero: true,
              ticks: {
                display: true,
                color: t['--chart-axis'],
                font: { size: 11 },
                callback: fmtAxis,
                maxTicksLimit: 6
              },
              afterFit: function (scale) { scale.width = 64; }
            }
          }
        }
      };
    });
  }

  App.chartMonthly = {
    init: function () {
      App.events.on('hkdatachange', render);
      render();
    },
    render: render
  };

})(window.App = window.App || {});