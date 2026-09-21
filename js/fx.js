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
 * 本版修改：
 *   ★ 删除 4 处不存在元素的绑定（#fxAddBtn / #fxExportBtn
 *     / #fxImportBtn / #fxFileInput）及配套的 addCurrency()
 *     —— HTML 里没有这些元素，绑定从未生效
 *   ★ 清理 console.log 调试输出（保留必要的 warn）
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

  /* preset 从 App.constants 读，与 core / hk-accounts 同源 */
  var R = App.constants.FALLBACK_RATES;

  var DEFAULT_CURRENCIES = [
    { code: 'USD', name: '美元',   preset: R.USD },
    { code: 'EUR', name: '欧元',   preset: R.EUR },
    { code: 'JPY', name: '日元',   preset: R.JPY },
    { code: 'CHF', name: '瑞郎',   preset: R.CHF },
    { code: 'GBP', name: '英镑',   preset: R.GBP },
    { code: 'CAD', name: '加元',   preset: R.CAD },
    { code: 'AUD', name: '澳元',   preset: R.AUD },
    { code: 'SGD', name: '新元',   preset: R.SGD },
    { code: 'CNH', name: '人民币', preset: R.CNH },
    { code: 'HKD', name: '港元',   preset: R.HKD }
  ];

  var collection = null;
  var autoRates  = {};
  var autoStatus = 'idle';
  var lastUpdate = null;
  var fetching   = false;

  /* ============================================================
   * 纯函数 —— 三级优先取生效汇率
   * ------------------------------------------------------------
   *   row         { code, manual, preset }
   *   autoRates   { USD: 7.9, ... }
   *
   * 规则（按顺序）：
   *   1. HKD 恒为 1
   *   2. manual > 0 → 用手动
   *   3. autoRates[code] > 0 → 用自动
   *   4. preset > 0 → 用预设
   *   5. 都没有 → 兜底 1
   * ============================================================ */
  function pickRate(row, autoRates) {
    if (!row) return 1;
    if (row.code === 'HKD') return 1;

    if (row.manual !== null && row.manual !== undefined && row.manual > 0) {
      return row.manual;
    }
    if (autoRates && autoRates[row.code] > 0) {
      return autoRates[row.code];
    }
    return row.preset || 1;
  }

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

  /* ============================================================
   * 拉取汇率 —— showTip 控制是否弹提示
   *   页面自动调用：fetchRates()      → 不弹
   *   点刷新按钮：  fetchRates(true)  → 弹
   * ============================================================ */
  function fetchRates(showTip) {
    if (fetching) {
      if (showTip) window.alert('⏳ 正在获取中，请稍候……');
      return Promise.resolve(false);
    }
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
        if (showTip) {
          window.alert('✅ 汇率已刷新（实时，更新 ' + updated + ' 个币种）');
        }
        return true;
      })
      .catch(function (err) {
        clearTimeout(timeoutId);
        console.warn('[fx] 所有 API 均失败：', err.message);
        autoStatus = Object.keys(autoRates).length > 0 ? 'cached' : 'failed';
        fetching = false;
        render();
        App.events.emit('fxchange', { source: 'fetch-failed' });
        if (showTip) {
          var fallbackTag = Object.keys(autoRates).length > 0 ? '缓存' : '预设';
          window.alert('⚠️ 汇率获取失败，已回退到' + fallbackTag + '汇率。');
        }
        return false;
      });
  }

  /* ============================================================
   * 同步 —— 三级优先级：手动 → 自动 → 预设
   * ============================================================ */
  function syncRates() {
    collection.all().forEach(function (r) {
      if (r.code === 'HKD') return;
      var effective = pickRate(r, autoRates);
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
        cnyRate = App.constants.DEFAULT_CNY_HKD;
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
    return pickRate(r, autoRates);
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

      /* ★ 手动输入框补 aria-label —— 屏幕阅读器能区分是哪种币 */
      var inputAria = r.code + ' ' + App.i18n.t('fx.title', '自动汇率');

      return '<div class="fx-card" data-code="' + r.code + '">' +
        '<div class="fx-card-head">' +
          '<span class="fx-code">' + App.utils.escapeHTML(r.code) + '</span>' +
          '<span class="fx-name">' + App.utils.escapeHTML(r.name || '') + '</span>' +
        '</div>' +
        '<div class="fx-auto" data-status="' + autoCls + '">' +
          '1 ' + r.code + ' = ' + autoText +
        '</div>' +
        '<div class="fx-input-row">' +
          '<input class="fx-input" type="number" step="0.0001" min="0" ' +
                 'value="' + displayVal.toFixed(4) + '" ' +
                 'data-code="' + r.code + '" ' +
                 'aria-label="' + App.utils.escapeHTML(inputAria) + '" ' +
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
    }

    /* ★ 点击「刷新汇率」→ 手动触发，弹提示 */
    var refreshBtn = App.$('#fxRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        fetchRates(true);
      });
    }

    var syncBtn = App.$('#fxSyncBtn');
    if (syncBtn) syncBtn.addEventListener('click', syncRates);

    collection.onChange(render);
  }

  /* ============================================================
   * 自测 —— 汇率三级优先逻辑
   * ============================================================ */
  function selfTest() {
    var fail = [];
    var eps = 0.001;
    var rates = { USD: 7.9 };

    /* --- 手动优先 --- */
    var r1 = pickRate({ code: 'USD', manual: 7.5, preset: 7.8 }, rates);
    if (Math.abs(r1 - 7.5) > eps)
      fail.push('手动优先：应 7.5，实际 ' + r1);

    /* --- 无手动 → 自动 --- */
    var r2 = pickRate({ code: 'USD', manual: null, preset: 7.8 }, rates);
    if (Math.abs(r2 - 7.9) > eps)
      fail.push('无手动 → 自动：应 7.9，实际 ' + r2);

    /* --- 无自动 → 预设 --- */
    var r3 = pickRate({ code: 'EUR', manual: null, preset: 9.1 }, {});
    if (Math.abs(r3 - 9.1) > eps)
      fail.push('无自动 → 预设：应 9.1，实际 ' + r3);

    /* --- 手动 = 0 → 视为无手动 --- */
    var r4 = pickRate({ code: 'USD', manual: 0, preset: 7.8 }, rates);
    if (Math.abs(r4 - 7.9) > eps)
      fail.push('手动 0 → 回落自动：应 7.9，实际 ' + r4);

    /* --- 手动 = undefined → 视为无手动 --- */
    var r5 = pickRate({ code: 'USD', manual: undefined, preset: 7.8 }, rates);
    if (Math.abs(r5 - 7.9) > eps)
      fail.push('手动 undefined → 回落自动：应 7.9，实际 ' + r5);

    /* --- HKD 恒为 1 --- */
    var r6 = pickRate({ code: 'HKD', manual: 9, preset: 9 }, rates);
    if (r6 !== 1)
      fail.push('HKD 应恒为 1，实际 ' + r6);

    /* --- 全空 → 兜底 1 --- */
    var r7 = pickRate({ code: 'XXX', manual: null, preset: 0 }, {});
    if (r7 !== 1)
      fail.push('无 preset 应兜底 1，实际 ' + r7);

    /* --- 手动负数 → 视为无手动 --- */
    var r8 = pickRate({ code: 'USD', manual: -1, preset: 7.8 }, rates);
    if (Math.abs(r8 - 7.9) > eps)
      fail.push('手动负数 → 回落自动：应 7.9，实际 ' + r8);

    return fail;
  }

  /* ============================================================
   * 对外
   * ============================================================ */
  App.fx = {

    requires: ['fxGrid', 'fxCount', 'fxUpdateTime', 'fxRefreshBtn', 'fxSyncBtn'],
    selfTest: selfTest,

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

      /* 语言切换 → 重渲染（更新"上次更新""获取中"等文字） */
      App.events.on('langchange', render);

      /* 页面自动拉取一次：不传参数 → 不弹提示 */
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