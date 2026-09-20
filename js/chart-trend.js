/* ============================================================
 * chart-trend.js —— 多账户净额走势（读 hkData.accountTrend）
 * ------------------------------------------------------------
 * 本版修改：
 *   ★ create() 传入 ariaLabel + description
 *   ★ description 从数据实时生成（语言 / 区间 / 数据变都跟着变）
 *   ★ 其余计算逻辑、区间按钮、HTML 图例保持
 * ============================================================ */
(function (App) {
  'use strict';

  var SCHWAB_DATA_IN_USD = true;

  var SERIES = [
    { key: 'huang', i18n: 'trend.huang', color: '--chart-1', rgbVar: '--rgb-blue',   ccy: 'HKD' },
    { key: 'yang',  i18n: 'trend.yang',  color: '--chart-2', rgbVar: '--rgb-green',  ccy: 'HKD' },
    { key: 'us',    i18n: 'trend.us',    color: '--chart-3', rgbVar: '--rgb-orange', ccy: SCHWAB_DATA_IN_USD ? 'USD' : 'HKD' }
  ];

  var currentRange = 'all';

  /* ---------- 当前渲染数据快照（供 describe 用） ---------- */
  var lastSnapshot = {
    months: [],
    series: {}   /* key: { values: [], last: number|null } */
  };

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

  function sliceMonths(months, range) {
    if (range === 'all') return months;
    var n = (range === '1y') ? 12
          : (range === '3y') ? 36
          : 60;
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
        '<span class="trend-legend-dot" style="background:' + color + '" aria-hidden="true"></span>' +
        App.i18n.t(s.i18n, s.key.toUpperCase()) +
      '</span>';
    }).join('');
  }

  /* ---------- 生成描述文字 ---------- */
  function buildDescription() {
    var months = lastSnapshot.months;
    if (!months.length) return App.i18n.t('trend.title', '账户净额走势') + '：' + App.i18n.t('asset.empty', '暂无数据');

    var head = App.i18n.t('trend.title', '账户净额走势') + '，' +
               months.length + ' ' + App.i18n.t('g10.unit', '个') + '。';

    var parts = SERIES.map(function (s) {
      var snap = lastSnapshot.series[s.key] || {};
      var label = App.i18n.t(s.i18n, s.key.toUpperCase());
      var last = snap.last;
      if (last == null) return label + '：—';
      return label + '：' + App.utils.formatNumber(last) + ' HKD';
    });

    return head + parts.join('，') + '。';
  }

  /* ---------- 渲染主流程 ---------- */
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

    var allMonths = Object.keys(monthSet).sort();
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

    /* ★ 更新快照（供 describe 用） */
    lastSnapshot.months = months;
    SERIES.forEach(function (s) {
      var values = months.map(function (m) { return pickValue(s, m); });
      var lastVal = null;
      for (var i = values.length - 1; i >= 0; i--) {
        if (values[i] != null) { lastVal = values[i]; break; }
      }
      lastSnapshot.series[s.key] = { values: values, last: lastVal };
    });

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
    }, {
      ariaLabel: App.i18n.t('trend.title', '账户净额走势'),
      description: buildDescription
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
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });

        render();
      });

      btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
    });
  }

  App.chartTrend = {
    init: function () {
      App.events.on('hkdatachange', render);
      App.events.on('fxchange',     render);
      App.events.on('langchange',   render);

      bindRange();
      render();
    },
    render: render
  };

})(window.App = window.App || {});