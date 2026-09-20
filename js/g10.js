/* ============================================================
 * g10.js —— G10 购买力偏离度
 * ------------------------------------------------------------
 * 数据来源（优先级）：
 *   1. 内存 data（本次会话已导入）
 *   2. localStorage['console-g10-data']
 *   3. 空
 * 对外：App.g10.init() / render() / setFromImport(map) / data
 *
 * 本版修改：
 *   ★ 清掉所有 console.log 调试输出
 *   ★ 卡片顶部彩条补 role 语义；卡片补 aria-label
 *   ★ 卡片内所有色点补 aria-hidden
 * ============================================================ */
(function (App) {
  'use strict';

  var FLAG_BASE = 'images/flags/';

  var META = {
    USD: { name: '美元',     flag: 'us' },
    EUR: { name: '欧元',     flag: 'eu' },
    JPY: { name: '日元',     flag: 'jp' },
    GBP: { name: '英镑',     flag: 'gb' },
    CHF: { name: '瑞郎',     flag: 'ch' },
    CAD: { name: '加元',     flag: 'ca' },
    AUD: { name: '澳元',     flag: 'au' },
    NZD: { name: '纽元',     flag: 'nz' },
    SEK: { name: '瑞典克朗', flag: 'se' },
    NOK: { name: '挪威克朗', flag: 'no' }
  };

  var DEFAULT_ORDER = ['USD','EUR','JPY','GBP','CHF','CAD','AUD','NZD','SEK','NOK'];
  var STORAGE_KEY = 'g10-data';
  var MAX_ABS   = 30;
  var THRESHOLD = 5;

  var data = [];

  function classify(dev) {
    if (dev >  THRESHOLD) return 'over';
    if (dev < -THRESHOLD) return 'under';
    return 'fair';
  }

  function markPositions() {
    var offset = (THRESHOLD / MAX_ABS) * 50;
    return { left: (50 - offset).toFixed(3), right: (50 + offset).toFixed(3) };
  }

  function render() {
    var grid = App.$('#g10Grid');
    var meta = App.$('#g10Count');
    if (!grid) return;

    if (meta) meta.textContent = data.length + ' ' + App.i18n.t('g10.unit', '个经济体');

    if (!data.length) {
      grid.innerHTML = '<div class="empty-hint">' +
        App.i18n.t('g10.empty', '暂无数据，请导入 Excel') + '</div>';
      return;
    }

    var mk = markPositions();

    grid.innerHTML = data.map(function (r) {
      var m = META[r.code] || {};
      var name = m.name || r.name || r.code;
      var flagCode = m.flag || (r.code || '').toLowerCase();

      var dev = Number(r.deviation) || 0;
      var cls = classify(dev);
      var sign = dev > 0 ? '+' : '';
      var abs = Math.min(Math.abs(dev), MAX_ABS);
      var fillPct = (abs / MAX_ABS) * 50;

      var fillStyle = dev >= 0
        ? 'left:50%;width:' + fillPct + '%;'
        : 'right:50%;width:' + fillPct + '%;';

      var statusText = {
        over:  App.i18n.t('g10.over',  '高估'),
        under: App.i18n.t('g10.under', '低估'),
        fair:  App.i18n.t('g10.fair',  '均衡')
      }[cls];

      var flagHtml = '<img class="g10-flag-img" ' +
        'src="' + FLAG_BASE + flagCode + '.png" ' +
        'alt="" ' +
        'loading="lazy" ' +
        'onerror="this.style.display=\'none\'">';

      /* ★ 卡片整体 aria-label */
      var cardAria = r.code + ' ' + name + ' ' + sign + dev.toFixed(1) + '%，' + statusText;

      return '<div class="g10-card" aria-label="' + App.utils.escapeHTML(cardAria) + '">' +
        '<div class="g10-top">' +
          flagHtml +
          '<span class="g10-dev ' + cls + '" aria-hidden="true">' + sign + dev.toFixed(1) + '%</span>' +
        '</div>' +
        '<div class="g10-code">' + App.utils.escapeHTML(r.code) + '</div>' +
        '<div class="g10-name">' + App.utils.escapeHTML(name) + '</div>' +
        '<div class="g10-status-row">' +
          '<span class="g10-status ' + cls + '">' + statusText + '</span>' +
        '</div>' +
        '<div class="g10-bar" aria-hidden="true">' +
          '<span class="g10-bar-mid"></span>' +
          '<span class="g10-bar-mark" style="left:' + mk.left + '%;"></span>' +
          '<span class="g10-bar-mark" style="left:' + mk.right + '%;"></span>' +
          '<span class="g10-bar-fill ' + cls + '" style="' + fillStyle + '"></span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function setFromImport(map) {
    if (!map || typeof map !== 'object') return;

    data = DEFAULT_ORDER.map(function (code) {
      var m = META[code] || { name: code };
      return {
        code: code,
        name: m.name,
        deviation: (map[code] !== undefined && map[code] !== null)
          ? Number(map[code]) : 0
      };
    });
    App.storage.setJSON(STORAGE_KEY, data);
    render();
  }

  App.g10 = {
    init: function () {
      var saved = App.storage.getJSON(STORAGE_KEY, null);
      if (saved && Array.isArray(saved) && saved.length) {
        data = saved;
      }
      render();
      App.events.on('langchange', render);
    },
    render: render,
    setFromImport: setFromImport,
    get data() { return data.slice(); }
  };

})(window.App = window.App || {});