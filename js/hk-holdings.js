/* ============================================================
 * hk-holdings.js —— HSBC 基金持仓表
 * ------------------------------------------------------------
 * 依赖：core.js / hk-data.js / i18n.js / xlsx.full.min.js
 * 对外：App.hkHoldings.init() / render() / import()
 *       openExample() / closeExample()
 *
 * 本版修改：
 *   ★ 基金名单元格从可点击 <td> 改为 <td><button>
 *     —— 原 <td> 无 tabindex，键盘完全无法操作
 *       现在用原生 <button>，Tab 可到达、Enter/Space 可触发、
 *       屏幕阅读器识别为按钮
 *   ★ 弹窗接入 App.a11y.trapFocus —— 打开时焦点入内、Tab 循环、
 *     Esc 关闭、关闭后归还触发按钮
 *   ★ 弹窗加 role="dialog" + aria-modal + aria-labelledby
 *   ★ 图片弹窗加 role="dialog" + 键盘 Esc 关闭
 * ============================================================ */
(function (App) {
  'use strict';

  /* 弹窗焦点释放函数 */
  var releaseModal = null;
  var releaseImg   = null;

  /* ============================================================
   * 取当前生效汇率
   * ============================================================ */
  function getRates() {
    return (App.fx && typeof App.fx.rates === 'function') ? App.fx.rates() : {};
  }

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

      var costHKD  = toHKD(f.cost,  f.currency, rates);
      var valueHKD = toHKD(f.value, f.currency, rates);

      var costTitle  = App.i18n.t('hkHoldings.original', '原币种') + '：' +
                       App.utils.formatNumber(f.cost) + ' ' + f.currency;
      var valueTitle = App.i18n.t('hkHoldings.original', '原币种') + '：' +
                       App.utils.formatNumber(f.value) + ' ' + f.currency;

      /* ★ 基金名从 <td> 改为 <td><button>
         button 的 aria-label 说明点击会打开十大持仓 */
      var openAria = App.i18n.t('hkHoldings.openTop10', '查看十大持仓') +
                     '：' + f.name;

      return '<tr data-id="' + App.utils.escapeHTML(f.id) + '">' +
        '<td class="col-id">' + App.utils.escapeHTML(f.id) + '</td>' +
        '<td class="col-name-cell">' +
          '<button class="col-name" type="button" ' +
            'data-fund="' + App.utils.escapeHTML(f.id) + '" ' +
            'data-name="' + App.utils.escapeHTML(f.name) + '" ' +
            'data-top10="' + encodeURIComponent(f.top10 || '') + '" ' +
            'aria-label="' + App.utils.escapeHTML(openAria) + '">' +
            App.utils.escapeHTML(f.name) +
          '</button>' +
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

    App.$$('button.col-name', tbody).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-fund');
        var name = btn.getAttribute('data-name');
        var top10 = '';
        try { top10 = decodeURIComponent(btn.getAttribute('data-top10') || ''); }
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

    /* ★ 补模态语义 */
    var box = overlay.querySelector('.hk-modal-box');
    if (box) {
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', 'hkModalTitle');
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    /* ★ 焦点陷阱 */
    if (releaseModal) releaseModal();
    releaseModal = App.a11y.trapFocus(box || overlay, {
      initialFocus: '#hkModalClose',
      onEscape: closeTop10
    });
  }

  function closeTop10() {
    var overlay = App.$('#hkModalOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (releaseModal) { releaseModal(); releaseModal = null; }
  }

  /* ============================================================
   * 示范图片弹窗
   * ============================================================ */
  function openExample() {
    var m = App.$('#imgModal');
    if (!m) return;

    /* ★ 图片弹窗加 dialog 语义 */
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-label', App.i18n.t('imgModal.alt', '选择基金示范'));

    m.classList.add('open');
    document.body.style.overflow = 'hidden';

    if (releaseImg) releaseImg();
    releaseImg = App.a11y.trapFocus(m, {
      initialFocus: '.img-modal-close',
      onEscape: closeExample
    });
  }

  function closeExample() {
    var m = App.$('#imgModal');
    if (m) m.classList.remove('open');
    document.body.style.overflow = '';
    if (releaseImg) { releaseImg(); releaseImg = null; }
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

    /* Esc 关闭（当陷阱未生效时的兜底） */
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
      App.events.on('fxchange', render);
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