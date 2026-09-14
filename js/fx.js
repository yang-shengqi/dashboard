/* ============================================================
 * fx.js —— 汇率模块（自动获取 + 手动覆盖）
 * ------------------------------------------------------------
 * 依赖：core.js / data.js / io.js / i18n.js
 * 数据字段：{ code, name, manual, preset }
 *   manual = null → 用自动汇率
 *   manual = 数字 → 用手动值覆盖
 * 对外：
 *   App.fx.init() / list() / render()
 *   App.fx.rate(code) / rates() / refresh() / sync()
 * 事件：fxchange
 *
 * 修正（2026-09-14）：
 *   ★ sync() 不再强依赖自动汇率成功 —— 用 手动→自动→预设 三级
 *   ★ sync() 同时写入 CNY→HKD 输入框（本金汇率）
 *   ★ 3 个 API 主备链，任一成功即可
 *   ★ 失败时也允许同步（用预设值），不再卡死
 *   ★ fetchRates 成功/失败后都主动 emit('fxchange')
 *     通知所有依赖汇率的模块重算（修复 hk-holdings 首次渲染取不到汇率）
 *   ★ 监听 langchange，切换语言时重渲染（更新"上次更新"等文字）
 * ============================================================ */
(function (App) {
  'use strict';

  var COLLECTION_NAME = 'fx';
  var CACHE_KEY       = 'fx-auto-cache';
  var TIMEOUT         = 8000;

  /* ---------- 3 个 API 主备链（依次尝试） ---------- */
  var API_LIST = [
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/hkd.json',
    'https://latest.currency-api.pages.dev/v1/currencies/hkd.json',
    'https://api.frankfurter.app/latest?from=HKD'
  ];

  var DEFAULT_CURRENCIES = [
    { code: 'USD', name: '美元',   preset: 7.8470 },
    { code: 'EUR', name: '欧元',   preset: 9.0758 },
    { code: 'JPY', name: '日元',   preset: 0.0493 },
    { code: 'CHF', name: '瑞郎',   preset: 9.6495 },
    { code: 'GBP', name: '英镑',   preset: 10.6170 },
    { code: 'CAD', name: '加元',   preset: 5.6539 },
    { code: 'AUD', name: '澳元',   preset: 5.5565 },
    { code: 'SGD', name: '新元',   preset: 6.1324 },
    { code: 'CNH', name: '人民币', preset: 1.1635 },
    { code: 'HKD', name: '港元',   preset: 1.0000 }
  ];

  var collection = null;
  var autoRates  = {};
  var autoStatus = 'idle';
  var lastUpdate = null;
  var fetching   = false;

  /* ============================================================
   * 缓存
   * ============================================================ */
  function saveCache() {
    App.storage.setJSON(CACHE_KEY, {
      rates: autoRates, status: autoStatus, updatedAt: lastUpdate
    });
  }

  function loadCache() {
    var c = App.storage.getJSON(CACHE_KEY, null);
    if (c && c.rates) {
      autoRates  = c.rates;
      autoStatus = c.status || 'idle';
      lastUpdate = c.updatedAt || null;
    }
  }

  /* ============================================================
   * 拉取汇率 —— 3 个 API 依次尝试
   * ============================================================ */
  function tryOneApi(url, controller) {
    return fetch(url, { signal: controller.signal })
      .then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      })
      .then(function (data) {
        var updated = 0;

        if (data && data.hkd && typeof data.hkd === 'object') {
          Object.keys(data.hkd).forEach(function (lower) {
            var v = data.hkd[lower];
            if (v > 0) {
              autoRates[lower.toUpperCase()] = 1 / v;
              updated++;
            }
          });
        }
        else if (data && data.rates && typeof data.rates === 'object') {
          Object.keys(data.rates).forEach(function (code) {
            var v = data.rates[code];
            if (v > 0) {
              autoRates[code] = 1 / v;
              updated++;
            }
          });
        }

        if (updated === 0) throw new Error('无有效数据');
        return updated;
      });
  }

  function fetchRates() {
    if (fetching) return Promise.resolve(false);
    fetching = true;
    autoStatus = 'pending';
    render();

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, TIMEOUT);

    var chain = Promise.reject(new Error('开始尝试'));
    API_LIST.forEach(function (url) {
      chain = chain.catch(function () {
        return tryOneApi(url, controller);
      });
    });

    return chain
      .then(function (updated) {
        clearTimeout(timeoutId);
        autoStatus = 'success';
        lastUpdate = Date.now();
        saveCache();
        fetching = false;
        render();
        App.events.emit('fxchange', { source: 'fetch' });
        console.log('[fx] 自动汇率成功，更新 ' + updated + ' 个币种');
        return true;
      })
      .catch(function (err) {
        clearTimeout(timeoutId);
        console.warn('[fx] 所有 API 均失败：', err.message);
        autoStatus = Object.keys(autoRates).length > 0 ? 'cached' : 'failed';
        fetching = false;
        render();
        App.events.emit('fxchange', { source: 'fetch-failed' });
        return false;
      });
  }

  /* ============================================================
   * 同步 —— 三级优先级：手动 → 自动 → 预设
   * ============================================================ */
  function syncRates() {
    collection.all().forEach(function (r) {
      if (r.code === 'HKD') return;
      var effective;
      if (r.manual !== null && r.manual !== undefined && r.manual > 0) {
        effective = r.manual;
      } else if (autoRates[r.code] && autoRates[r.code] > 0) {
        effective = autoRates[r.code];
      } else {
        effective = r.preset || 1;
      }
      collection.replace(r.code, { manual: effective });
    });

    var exchangeInput = App.$('#exchangeRateInput');
    if (exchangeInput) {
      var cnhRow = collection.byKey('CNH');
      var cnyRate;
      if (cnhRow && cnhRow.manual !== null && cnhRow.manual !== undefined && cnhRow.manual > 0) {
        cnyRate = cnhRow.manual;
      } else if (autoRates['CNH'] && autoRates['CNH'] > 0) {
        cnyRate = autoRates['CNH'];
      } else if (cnhRow) {
        cnyRate = cnhRow.preset;
      } else {
        cnyRate = 1.1;
      }
      exchangeInput.value = cnyRate.toFixed(4);
      exchangeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    App.events.emit('fxchange', { source: 'sync' });

    var tag = autoStatus === 'success' ? '实时' :
              (autoStatus === 'cached' ? '缓存' : '预设');
    window.alert('✅ 汇率已同步（来源：' + tag + '）');
  }

  /* ============================================================
   * 取某币种当前"生效"汇率
   * ============================================================ */
  function currentRate(r) {
    if (r.code === 'HKD') return 1;
    if (r.manual !== null && r.manual !== undefined && r.manual > 0) return r.manual;
    if (autoRates[r.code]) return autoRates[r.code];
    return r.preset || 1;
  }

  /* ============================================================
   * 渲染
   * ============================================================ */
  function render() {
    var grid    = App.$('#fxGrid');
    var countEl = App.$('#fxCount');
    var timeEl  = App.$('#fxUpdateTime');
    if (!grid || !collection) return;

    if (countEl) {
      countEl.textContent = collection.count() + ' ' + App.i18n.t('fx.unit', '种');
    }

    if (timeEl) {
      if (lastUpdate) {
        var d = new Date(lastUpdate);
        var pad = function (n) { return String(n).padStart(2, '0'); };
        timeEl.textContent = App.i18n.t('fx.updated', '上次更新') + ' ' +
          pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      } else {
        timeEl.textContent = App.i18n.t('fx.notUpdated', '未更新');
      }
    }

    grid.innerHTML = collection.all().map(function (r) {
      var isHKD = r.code === 'HKD';
      var autoVal = autoRates[r.code];
      var manualVal = (r.manual !== null && r.manual !== undefined && r.manual > 0)
        ? r.manual : null;
      var displayVal = manualVal !== null ? manualVal : (autoVal || r.preset || 0);
      var preset = r.preset || 0;

      var autoText, autoCls;
      if (isHKD) {
        autoText = '1.0000 ' + App.i18n.t('fx.base', '(基准)');
        autoCls = 'preset';
      } else if (autoStatus === 'pending') {
        autoText = App.i18n.t('fx.loading', '获取中...');
        autoCls = 'pending';
      } else if (autoStatus === 'success' && autoVal) {
        autoText = autoVal.toFixed(4) + ' ' + App.i18n.t('fx.live', '(实时)');
        autoCls = 'success';
      } else if ((autoStatus === 'failed' || autoStatus === 'cached') && autoVal) {
        autoText = autoVal.toFixed(4) + ' ' + App.i18n.t('fx.cached', '(缓存)');
        autoCls = 'preset';
      } else if (autoStatus === 'failed') {
        autoText = App.i18n.t('fx.failed', '获取失败');
        autoCls = 'failed';
      } else if (autoVal) {
        autoText = autoVal.toFixed(4);
        autoCls = 'preset';
      } else {
        autoText = '—';
        autoCls = 'pending';
      }

      return '<div class="fx-card" data-code="' + r.code + '">' +
        '<div class="fx-card-head">' +
          '<span class="fx-code">' + App.utils.escapeHTML(r.code) + '</span>' +
          '<span class="fx-name">' + App.utils.escapeHTML(r.name || '') + '</span>' +
          (isHKD ? '' : '<button class="fx-del" data-act="delete" data-code="' +
             App.utils.escapeHTML(r.code) + '" title="删除">✕</button>') +
        '</div>' +
        '<div class="fx-auto" data-status="' + autoCls + '">' +
          '1 ' + r.code + ' = ' + autoText +
        '</div>' +
        '<div class="fx-input-row">' +
          '<input class="fx-input" type="number" step="0.0001" min="0" ' +
                 'value="' + displayVal.toFixed(4) + '" ' +
                 'data-code="' + r.code + '" ' +
                 (isHKD ? 'disabled' : '') + ' />' +
          '<span class="fx-unit">HKD</span>' +
        '</div>' +
        '<div class="fx-base">' +
          App.i18n.t('fx.preset', '默认') + ' ' + preset.toFixed(4) +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ============================================================
   * 事件
   * ============================================================ */
  function bind() {
    var grid = App.$('#fxGrid');

    if (grid) {
      grid.addEventListener('input', function (e) {
        var inp = e.target;
        if (!inp.classList || !inp.classList.contains('fx-input')) return;
        var code = inp.getAttribute('data-code');
        var v = parseFloat(inp.value);
        collection.replace(code, { manual: (!isNaN(v) && v > 0) ? v : null });
      });

      grid.addEventListener('blur', function (e) {
        var inp = e.target;
        if (!inp.classList || !inp.classList.contains('fx-input')) return;
        if (inp.disabled) return;
        var code = inp.getAttribute('data-code');
        var r = collection.byKey(code);
        if (!r) return;
        var v = parseFloat(inp.value);
        if (isNaN(v) || v <= 0) {
          var fallback = autoRates[code] || r.preset || 1;
          inp.value = fallback.toFixed(4);
          collection.replace(code, { manual: null });
        }
      }, true);

      grid.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act="delete"]');
        if (!btn) return;
        var code = btn.getAttribute('data-code');
        var msg = App.i18n.t('fx.confirmDelete', '确认删除 {code}？')
                        .replace('{code}', code);
        if (window.confirm(msg)) collection.removeByKey(code);
      });
    }

    var refreshBtn = App.$('#fxRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', fetchRates);

    var syncBtn = App.$('#fxSyncBtn');
    if (syncBtn) syncBtn.addEventListener('click', syncRates);

    var addBtn = App.$('#fxAddBtn');
    if (addBtn) addBtn.addEventListener('click', addCurrency);

    var exportBtn = App.$('#fxExportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var rows = collection.all().map(function (r) {
          return { code: r.code, name: r.name, rate: currentRate(r) };
        });
        App.io.exportCSV(rows, null, [
          { key: 'code', label: '币种代码' },
          { key: 'name', label: '币种名称' },
          { key: 'rate', label: '汇率' }
        ]);
      });
    }

    var importBtn = App.$('#fxImportBtn');
    var fileInput = App.$('#fxFileInput');
    if (importBtn && fileInput) {
      importBtn.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) {
          App.io.importToCollection(fileInput.files[0], collection, null, { autoNumber: true })
            .then(function () {
              collection.all().forEach(function (r) {
                if (r.rate !== undefined) {
                  collection.replace(r.code, { manual: r.rate, preset: r.rate });
                }
              });
              App.events.emit('fxchange', { source: 'import' });
            })
            .catch(function (e) {
              window.alert('导入失败：' + e.message);
            });
        }
        fileInput.value = '';
      });
    }

    collection.onChange(render);
  }

  /* ============================================================
   * 新增币种
   * ============================================================ */
  function addCurrency() {
    var code = window.prompt(App.i18n.t('fx.promptCode', '请输入币种代码（3 位字母）'));
    if (!code) return;
    code = code.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      window.alert(App.i18n.t('fx.badCode', '币种代码必须是 3 位字母'));
      return;
    }
    if (collection.byKey(code)) {
      window.alert(App.i18n.t('fx.dupCode', '该币种已存在'));
      return;
    }
    var name = window.prompt(App.i18n.t('fx.promptName', '请输入币种名称'), code);
    if (name === null) return;

    collection.add({ code: code, name: name || code, manual: null, preset: 1 });
  }

  /* ============================================================
   * 对外
   * ============================================================ */
  App.fx = {

    init: function () {
      collection = App.data.create(COLLECTION_NAME, {
        key: 'code',
        autoPersist: true
      });
      collection.load();

      var presetMap = {};
      DEFAULT_CURRENCIES.forEach(function (c) {
        presetMap[c.code] = c;
      });

      if (collection.count() === 0) {
        collection.set(DEFAULT_CURRENCIES.map(function (c) {
          return { code: c.code, name: c.name, manual: null, preset: c.preset };
        }));
      } else {
        collection.all().forEach(function (r) {
          var def = presetMap[r.code];
          if (!def) return;
          if (!r.preset || r.preset <= 0) {
            collection.replace(r.code, {
              preset: def.preset,
              name:   r.name || def.name
            });
          }
        });
      }

      loadCache();
      bind();
      render();

      /* ★ 语言切换 → 重渲染（更新"上次更新""获取中"等文字） */
      App.events.on('langchange', render);

      fetchRates();
    },

    list: function () { return collection; },
    render: render,
    refresh: fetchRates,
    sync: syncRates,

    rate: function (code) {
      var r = collection && collection.byKey(code);
      return r ? currentRate(r) : 1;
    },

    rates: function () {
      var out = {};
      if (!collection) return out;
      collection.all().forEach(function (r) { out[r.code] = currentRate(r); });
      return out;
    }
  };

})(window.App = window.App || {});