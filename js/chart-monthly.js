/* ============================================================
 * chart-monthly.js —— HSBC 月度市值合计柱状
 * ------------------------------------------------------------
 * Y 轴单位跟随语言：中文「万」/ 英文「k/M/B」
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

  function fmtAxis(v) {
    return fmtAxisNum(v, 1);
  }

  var lastSnapshot = { months: [], last: null, total: 0 };

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