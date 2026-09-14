/* ============================================================
 * chart-trend.js —— 多账户净额走势（读 hkData.accountTrend）
 * ------------------------------------------------------------
 * 数据：accountTrend[holder][YYYY-MM] = value
 * ★ Y 轴宽度锁死 64px（与其它图一致）
 * ============================================================ */
(function (App) {
  'use strict';

  var SERIES = [
    { key: 'huang', i18n: 'trend.huang', color: '--chart-1' },
    { key: 'yang',  i18n: 'trend.yang',  color: '--chart-2' },
    { key: 'us',    i18n: 'trend.us',    color: '--chart-3' }
  ];

  function render() {
    var canvas = App.$('#trendChart');
    if (!canvas) return;

    var trend = App.hkData.accountTrend || {};
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

    App.charts.create('trendChart', canvas, function (t) {
      var datasets = SERIES.map(function (s) {
        var color = t[s.color];
        return {
          label: App.i18n.t(s.i18n, s.key.toUpperCase()),
          data: months.map(function (m) {
            var v = dataMap[s.key][m];
            return (v === undefined || v === null) ? null : Number(v);
          }),
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 1.8,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0,
          spanGaps: false
        };
      });

      return {
        type: 'line',
        data: { labels: months, datasets: datasets },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: true, position: 'top', align: 'end' },
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
              /* ★ Y 轴宽度锁死，避免自动伸缩 */
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
      render();
    },
    render: render
  };

})(window.App = window.App || {});