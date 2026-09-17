/* ============================================================
 * hk-holdings.js —— HSBC 基金持仓表
 * ------------------------------------------------------------
 * 依赖：core.js / hk-data.js / i18n.js / xlsx.full.min.js
 * 对外：App.hkHoldings.init() / render() / import()
 *       openExample() / closeExample()
 * ------------------------------------------------------------
 * 核心：所有市值统一转 HKD 显示（HKD 是本币）
 * ============================================================ */
(function (App) {
  'use strict';

  /* ============================================================
   * 内部：取当前生效汇率
   * ============================================================ */
  function getRates() {
    return (App.fx && typeof App.fx.rates === 'function') ? App.fx.rates() : {};
  }

  /* 把任意币种金额转成 HKD */
  function toHKD(amount, ccy, rates) {
    var rate = (ccy === 'HKD') ? 1 : (rates[ccy] || 1);
    return (Number(amount) || 0) * rate;
  }

  /* ============================================================
   * 渲染表格
   * ============================================================ */
  function render() {
    var tbody = App.$('#hkHoldingsBody');
    var count = App.$('#hkHoldingsCount');
    var totalEl = App.$('#hkHoldingsTotal');
    if (!tbody) return;

    var holdings = App.hkData.holdings;
    var templates = App.hkData.masterTemplates;
    var rates = getRates();

    if (count) count.textContent = holdings.length + ' ' + App.i18n.t('hk.unit', '只');

    /* 合计：★ 转 HKD 后相加 */
    if (totalEl) {
      var totalHKD = 0;
      holdings.forEach(function (f) {
        totalHKD += toHKD(f.value, f.currency, rates);
      });
      totalEl.textContent = App.utils.formatNumber(totalHKD);
    }

    if (!holdings.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-hint">' +
        App.i18n.t('hkHoldings.empty', '暂无数据，请点击「导入 Excel」') + '</td></tr>';
      return;
    }

    tbody.innerHTML = holdings.map(function (f) {
      var tpl = templates[f.template] || { stock: 0, bond: 0, cash: 0, other: 0 };

      /* 资产标签 */
      var assetTags = [
        { key: 'stock', label: App.i18n.t('hk.asset.stock', '股'),  v: tpl.stock },
        { key: 'bond',  label: App.i18n.t('hk.asset.bond',  '债'),  v: tpl.bond },
        { key: 'cash',  label: App.i18n.t('hk.asset.cash',  '现'),  v: tpl.cash },
        { key: 'other', label: App.i18n.t('hk.asset.other', '其'),  v: tpl.other }
      ].filter(function (x) { return Math.abs(x.v) > 0.01; })
       .map(function (x) {
         return '<span class="hk-tag hk-tag-' + x.key + '">' +
                x.label + ' ' + x.v.toFixed(1) + '%</span>';
       }).join('');

      var isDiv = (f.dividendType === '分红');
      var typeBadge = '<span class="hk-type ' + (isDiv ? 'div' : 'acc') + '">' +
        (isDiv ? App.i18n.t('hk.div', '分红') : App.i18n.t('hk.acc', '累积')) +
        '</span>';

      /* ★ 本金 / 市值 → 转 HKD */
      var costHKD  = toHKD(f.cost,  f.currency, rates);
      var valueHKD = toHKD(f.value, f.currency, rates);

      /* 原币种值作为 tooltip 附带展示 */
      var costTitle  = App.i18n.t('hkHoldings.original', '原币种') + '：' +
                       App.utils.formatNumber(f.cost) + ' ' + f.currency;
      var valueTitle = App.i18n.t('hkHoldings.original', '原币种') + '：' +
                       App.utils.formatNumber(f.value) + ' ' + f.currency;

      return '<tr data-id="' + App.utils.escapeHTML(f.id) + '">' +
        '<td class="col-id">' + App.utils.escapeHTML(f.id) + '</td>' +
        '<td class="col-name" data-fund="' + App.utils.escapeHTML(f.id) + '" ' +
            'data-name="' + App.utils.escapeHTML(f.name) + '" ' +
            'data-top10="' + encodeURIComponent(f.top10 || '') + '">' +
          App.utils.escapeHTML(f.name) +
        '</td>' +
        '<td class="col-ccy">' + App.utils.escapeHTML(f.currency) + '</td>' +
        '<td class="col-cost num" title="' + App.utils.escapeHTML(costTitle) + '">' +
          App.utils.formatNumber(costHKD) +
        '</td>' +
        '<td class="col-value num" title="' + App.utils.escapeHTML(valueTitle) + '">' +
          App.utils.formatNumber(valueHKD) +
        '</td>' +
        '<td class="col-asset">' + assetTags + ' ' + typeBadge + '</td>' +
      '</tr>';
    }).join('');

    App.$$('td.col-name', tbody).forEach(function (td) {
      td.addEventListener('click', function () {
        var id = td.getAttribute('data-fund');
        var name = td.getAttribute('data-name');
        var top10 = '';
        try { top10 = decodeURIComponent(td.getAttribute('data-top10') || ''); }
        catch (e) {}
        openTop10(id, name, top10);
      });
    });
  }

  /* ============================================================
   * 十大持仓弹窗
   * ============================================================ */
  function openTop10(id, name, text) {
    var overlay = App.$('#hkModalOverlay');
    var title = App.$('#hkModalTitle');
    var body = App.$('#hkModalBody');
    if (!overlay || !title || !body) return;

    title.textContent = id + ' — ' + name;

    if (text) {
      var html = text.replace(/<br\s*\/?>/gi, '\n')
                     .replace(/\n{3,}/g, '\n\n');
      body.textContent = html;
    } else {
      body.innerHTML = '<span class="empty-hint">' +
        App.i18n.t('hkHoldings.noTop10', '该基金暂无十大持仓数据') + '</span>';
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeTop10() {
    var overlay = App.$('#hkModalOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ============================================================
   * 示范图片弹窗
   * ============================================================ */
  function openExample() {
    var m = App.$('#imgModal');
    if (m) m.classList.add('open');
  }

  function closeExample() {
    var m = App.$('#imgModal');
    if (m) m.classList.remove('open');
  }

  /* ============================================================
   * 导入 Excel
   * ============================================================ */
  function importFile() {
    var input = App.$('#hkFileInput');
    if (input) input.click();
  }

  function handleFile(file) {
    if (!file) return;
    if (typeof XLSX === 'undefined') {
      window.alert('❌ XLSX 库未加载');
      return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        var res = App.hkData.parseWorkbook(wb);

        if (res.ok) {
          App.hkData.save();
          window.alert('✅ 导入成功：' + res.holdings + ' 只基金，持有人 ' +
            res.holders.join(' / '));
        } else {
          window.alert('❌ 导入失败：' + (res.msg || '未知错误'));
        }
      } catch (err) {
        window.alert('❌ 解析出错：' + err.message);
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ============================================================
   * 绑定事件
   * ============================================================ */
  function bind() {
    var importBtn = App.$('#hkImportBtn');
    if (importBtn) importBtn.addEventListener('click', importFile);

    var fileInput = App.$('#hkFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (file) handleFile(file);
        fileInput.value = '';
      });
    }

    var clearBtn = App.$('#hkClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (window.confirm('确认清空所有数据？')) App.hkData.clear();
      });
    }

    var closeBtn = App.$('#hkModalClose');
    var overlay = App.$('#hkModalOverlay');
    if (closeBtn) closeBtn.addEventListener('click', closeTop10);
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeTop10();
      });
    }

    var imgModal = App.$('#imgModal');
    if (imgModal) {
      imgModal.addEventListener('click', closeExample);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeTop10();
        closeExample();
      }
    });
  }

  /* ============================================================
   * 对外
   * ============================================================ */
  App.hkHoldings = {
    init: function () {
      bind();

      App.events.on('hkdatachange', render);

      /* ★ 汇率同步 → 重算（表内所有 HKD 折算跟着变） */
      App.events.on('fxchange', render);

      /* ★ 语言切换 → 重渲染（表头「只」、行内文字） */
      App.events.on('langchange', render);

      if (!App.hkData.ready) {
        App.hkData.load();
      }

      render();
    },
    render: render,
    import: importFile,
    openExample: openExample,
    closeExample: closeExample
  };

})(window.App = window.App || {});