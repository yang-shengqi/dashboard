/* ============================================================
 * rebalance.js —— 再平衡建议
 * ------------------------------------------------------------
 * 读：hkData.currencyMinInvestMap + deviation 结果
 * ★ 监听 langchange，切换语言时重渲染
 * ============================================================ */
(function (App) {
  'use strict';

  function render() {
    var container = App.$('#rebalanceBody');
    if (!container) return;

    if (!App.deviation || !App.deviation.compute) {
      container.innerHTML = '<div class="empty-hint">' +
        App.i18n.t('reb.needDeviation', '请先加载货币偏离模块') + '</div>';
      return;
    }

    var result = App.deviation.compute();
    if (result.total === 0) {
      container.innerHTML = '<div class="empty-hint">' +
        App.i18n.t('reb.empty', '暂无持仓数据') + '</div>';
      return;
    }

    var minMap = App.hkData.currencyMinInvestMap || {};

    var html = '<div class="reb-head">' +
      '<span>' + App.i18n.t('reb.th.currency', '货币') + '</span>' +
      '<span>' + App.i18n.t('reb.th.min', '最低起投') + '</span>' +
      '<span>' + App.i18n.t('reb.th.action', '建议') + '</span>' +
    '</div>';

    html += result.rows.map(function (r) {
      var need = r.target * result.total - r.amount;
      var minInvest = minMap[r.code] || 0;

      var action, cls;
      if (need > 0 && (minInvest === 0 || need >= minInvest)) {
        action = App.i18n.t('reb.buy', '买入') + ' ' + App.utils.formatNumber(need);
        cls = 'buy';
      } else if (need > 0) {
        action = App.i18n.t('reb.belowMin', '未达最低起投') +
          '（' + App.utils.formatNumber(minInvest) + '）';
        cls = 'muted';
      } else {
        action = App.i18n.t('reb.over', '超配，无需买入');
        cls = 'muted';
      }

      return '<div class="reb-row">' +
        '<span class="reb-code">' + r.code + '</span>' +
        '<span class="reb-min">' + (minInvest ? App.utils.formatNumber(minInvest) : '—') + '</span>' +
        '<span class="reb-action ' + cls + '">' + action + '</span>' +
      '</div>';
    }).join('');

    container.innerHTML = html;
  }

  App.rebalance = {
    init: function () {
      App.events.on('hkdatachange', render);
      App.events.on('fxchange', render);

      /* ★ 语言切换 → 重渲染 */
      App.events.on('langchange', render);

      render();
    },
    render: render
  };

})(window.App = window.App || {});