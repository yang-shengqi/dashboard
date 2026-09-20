/* ============================================================
 * asset-overview.js —— 债券/股票/现金/其它 配置占比
 * ------------------------------------------------------------
 * 严格对齐原版：
 *   1. 每个分项 = Σ(该基金 HKD 值 × 模板百分比)
 *   2. 分母 = 4 个分项之和（不是总市值）
 *   3. 显示为中心对称条形：中线在 50%
 *
 * 本版修改：
 *   ★ 条形图补 .sr-only 文字替代
 *   ★ value=0 且有 cost → 用 cost（与 split-monitor / deviation 口径统一）
 *     —— 原代码缺此兜底，首屏未导入时可能少算
 * ============================================================ */
(function (App) {
  'use strict';

  function compute() {
    var holdings  = App.hkData.holdings || [];
    var templates = App.hkData.masterTemplates || {};
    var rates = (App.fx && App.fx.rates) ? App.fx.rates() : {};

    var abs = { stock: 0, bond: 0, cash: 0, other: 0 };

    holdings.forEach(function (f) {
      var effectiveValue = Number(f.value) || 0;
      /* ★ 本版新增：与 split-monitor 口径统一 */
      if (effectiveValue === 0 && Number(f.cost) !== 0) {
        effectiveValue = Number(f.cost);
      }
      if (effectiveValue <= 0) return;

      var tpl = templates[f.template];
      if (!tpl) return;

      var rate = (f.currency === 'HKD') ? 1 : (rates[f.currency] || 1);
      var hkdValue = effectiveValue * rate;

      abs.stock += hkdValue * (tpl.stock / 100);
      abs.bond  += hkdValue * (tpl.bond  / 100);
      abs.cash  += hkdValue * (tpl.cash  / 100);
      abs.other += hkdValue * (tpl.other / 100);
    });

    var totalAsset = abs.stock + abs.bond + abs.cash + abs.other;
    var pct = { stock: 0, bond: 0, cash: 0, other: 0 };
    if (totalAsset > 0.0001) {
      pct.stock = abs.stock / totalAsset * 100;
      pct.bond  = abs.bond  / totalAsset * 100;
      pct.cash  = abs.cash  / totalAsset * 100;
      pct.other = abs.other / totalAsset * 100;
    }

    return { pct: pct, abs: abs, total: totalAsset };
  }

  function render() {
    var container = App.$('#assetBarsContainer');
    var legend    = App.$('#assetLegend');
    if (!container) return;

    var r = compute();

    if (r.total === 0) {
      container.innerHTML = '<div class="empty-hint">' +
        App.i18n.t('asset.empty', '暂无数据，请导入 Excel') + '</div>';
      if (legend) legend.innerHTML = '';
      return;
    }

    var labels = [
      { key: 'stock', name: App.i18n.t('asset.stock', '股票'), color: '--chart-4' },
      { key: 'bond',  name: App.i18n.t('asset.bond',  '债券'), color: '--chart-2' },
      { key: 'cash',  name: App.i18n.t('asset.cash',  '现金'), color: '--chart-3' },
      { key: 'other', name: App.i18n.t('asset.other', '其它'), color: '--chart-5' }
    ];

    container.innerHTML = labels.map(function (l) {
      var val = r.pct[l.key] || 0;
      var absVal = Math.abs(val);
      var displayWidth = Math.min(absVal, 150);
      var isPos = val >= 0;
      var color = isPos ? ('var(' + l.color + ')') : 'var(--state-fail)';

      var dirStyle = isPos
        ? 'margin-left:50%;width:' + displayWidth + '%;'
        : 'margin-right:50%;width:' + displayWidth + '%;';

      return '<div class="ao-row">' +
        '<span class="ao-label">' + l.name + '</span>' +
        '<div class="ao-bar" aria-hidden="true">' +
          '<div class="ao-mid"></div>' +
          '<div class="ao-fill" style="' + dirStyle + 'background:' + color + ';"></div>' +
        '</div>' +
        '<span class="ao-val">' + val.toFixed(2) + '%</span>' +
      '</div>';
    }).join('');

    if (legend) {
      legend.innerHTML = labels.map(function (l) {
        return '<span class="legend-item">' +
          '<span class="legend-dot" style="background:var(' + l.color + ');" aria-hidden="true"></span>' +
          l.name + ' ' + (r.pct[l.key] || 0).toFixed(2) + '%</span>';
      }).join('');
    }

    /* ★ 条形图补文字替代 */
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label',
      App.i18n.t('asset.header', '债券 60% / 股票 35% / 现金其它 5%') + '。' +
      labels.map(function (l) {
        return l.name + ' ' + (r.pct[l.key] || 0).toFixed(2) + '%';
      }).join('，') + '。');
  }

  App.assetOverview = {
    init: function () {
      App.events.on('hkdatachange', render);
      App.events.on('fxchange', render);
      App.events.on('langchange', render);
      render();
    },
    render: render,
    compute: compute
  };

})(window.App = window.App || {});