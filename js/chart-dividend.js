/* ============================================================
 * chart-dividend.js —— 年度总分红柱状
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

  var lastSnapshot = { years: [], total: 0, latest: 0 };

  function buildDescription() {
    if (!lastSnapshot.years.length) {
      return App.i18n.t('dividend.yearLabel', '年度分红') + '：' + App.i18n.t('asset.empty', '暂无数据');
    }
    return App.i18n.t('dividend.yearLabel', '年度分红') + '，' +
      lastSnapshot.years.length + ' ' + App.i18n.t('div.year', '年') + '，' +
      App.i18n.t('div.accumulated', '累积分红') + '：' +
      App.utils.formatNumber(lastSnapshot.total) + ' HKD，' +
      App.i18n.t('div.yearTotal', '年分红') + '：' +
      App.utils.formatNumber(lastSnapshot.latest) + ' HKD。';
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

    lastSnapshot.years = years;
    lastSnapshot.total = values.reduce(function (s, v) { return s + v; }, 0);
    lastSnapshot.latest = values.length ? values[values.length - 1] : 0;

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
    }, {
      ariaLabel: App.i18n.t('dividend.yearLabel', '年度分红'),
      description: buildDescription
    });
  }

  App.chartDividend = {
    init: function () {
      App.events.on('hkdatachange', render);
      App.events.on('fxchange', render);
      App.events.on('langchange', render);
      render();
    },
    render: render
  };

})(window.App = window.App || {});