/* ============================================================
 * chart-schwab.js —— Schwab 月度市值趋势
 * ------------------------------------------------------------
 * 读：hkData.schwabTrendData（USD）
 * 转 HKD：App.fx.rates().USD
 * ★ Y 轴宽度锁死 64px（与其它图一致）
 * ============================================================ */
(function (App) {
  'use strict';

  function fmtAxis(v) {
    if (v === 0) return '0';
    return (v / 10000).toFixed(1) + '万';
  }

  function render() {
    var canvas = App.$('#schwabTrendCanvas');
    if (!canvas) return;

    var data = App.hkData.schwabTrendData || {};
    var rates = (App.fx && App.fx.rates) ? App.fx.rates() : {};
    var usdRate = rates['USD'] || 7.85;

    var months = Object.keys(data).sort();
    var values = months.map(function (m) { return (Number(data[m]) || 0) * usdRate; });

    App.charts.create('schwabTrendChart', canvas, function (t) {
      return {
        type: 'bar',
        data: {
          labels: months,
          datasets: [{
            label: 'Schwab',
            data: values,
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
            y: {
              beginAtZero: true,
              ticks: {
                display: true,
                color: t['--chart-axis'],
                font: { size: 11 },
                callback: fmtAxis
              },
              /* ★ Y 轴宽度锁死，避免自动伸缩 */
              afterFit: function (scale) { scale.width = 64; }
            },
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
            }
          }
        }
      };
    });
  }

  App.chartSchwab = {
    init: function () {
      App.events.on('hkdatachange', render);
      App.events.on('fxchange', render);
      render();
    },
    render: render
  };

})(window.App = window.App || {});