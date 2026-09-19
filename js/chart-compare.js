/* ============================================================
 * chart-compare.js —— HSBC vs Schwab 双柱对比
 * ------------------------------------------------------------
 * ★ Schwab 原始数据为 USD，统一换算为 HKD 后再画
 * 汇率：App.utils.usdToHkd()
 * ★ Y 轴宽度锁死 64px（与其它图一致）
 *
 * 2026-09-19 改版：
 *   ★ 关闭 Chart.js 自带图例 → 用 HTML 图例（左上对齐）
 *   ★ 「月度对比」由 HTML 推到最右（同一行）
 * ============================================================ */
(function (App) {
  'use strict';

  /* 图例定义（与数据集顺序一致） */
  var SERIES = [
    { label: 'HSBC',   color: '--chart-1' },
    { label: 'Schwab', color: '--chart-3' }
  ];

  /* ---------- HTML 图例（左上） ---------- */
  function renderLegend() {
    var el = App.$('#compareLegend');
    if (!el) return;

    var t = App.charts.tokens();

    el.innerHTML = SERIES.map(function (s) {
      var color = t[s.color] || 'var(' + s.color + ')';
      return '<span class="compare-legend-item">' +
        '<span class="compare-legend-dot" style="background:' + color + '"></span>' +
        s.label +
      '</span>';
    }).join('');
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

    /* HSBC 三条 holder 按月求和（本就为 HKD） */
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

    /* ★ Schwab 按月换算 USD→HKD */
    var usdRate = App.utils.usdToHkd();
    var schwabData = months.map(function (m) {
      var raw = schwab[m];
      if (raw === undefined || raw === null || raw === '') return null;
      var v = Number(raw);
      if (isNaN(v)) return null;
      return v * usdRate;
    });

    /* ★ 先画 HTML 图例 */
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
            /* ★ 关闭 Chart.js 自带图例 —— 用 HTML 图例替代 */
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

  App.chartCompare = {
    init: function () {
      App.events.on('hkdatachange', render);
      /* ★ 汇率刷新 / 同步后重绘 */
      App.events.on('fxchange', render);
      /* ★ 语言切换 → 重绘 */
      App.events.on('langchange', render);
      render();
    },
    render: render
  };

})(window.App = window.App || {});