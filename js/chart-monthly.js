/* ============================================================
 * chart-monthly.js —— HSBC 月度市值合计柱状
 * ------------------------------------------------------------
 * 本版修改：
 *   ★ create() 传入 ariaLabel + description
 *   ★ description 从数据生成
 * ============================================================ */
(function (App) {
  'use strict';

  var lastSnapshot = { months: [], last: null, total: 0 };

  function fmtAxis(v) {
    if (v === 0) return '0';
    return (v / 10000).toFixed(1) + '万';
  }

  function buildDescription() {
    if (!lastSnapshot.months.length) {
      return App.i18n.t('monthly.title', 'HSBC 月度市值') + '：' + App.i18n.t('asset.empty', '暂无数据');
    }
    return App.i18n.t('monthly.title', 'HSBC 月度市值') + '，' +
      lastSnapshot.months.length + ' ' + App.i18n.t('g10.unit', '个') + '，' +
      App.i18n.t('dev.th.value', '当下市值') + '：' +
      App.utils.formatNumber(lastSnapshot.last) + ' HKD。';
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

    /* ★ 快照 */
    lastSnapshot.months = months;
    lastSnapshot.last = data.length ? data[data.length - 1] : 0;
    lastSnapshot.total = data.reduce(function (s, v) { return s + v; }, 0);

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
    }, {
      ariaLabel: App.i18n.t('monthly.title', 'HSBC 月度市值'),
      description: buildDescription
    });
  }

  App.chartMonthly = {
    init: function () {
      App.events.on('hkdatachange', render);
      App.events.on('langchange', render);
      render();
    },
    render: render
  };

})(window.App = window.App || {});