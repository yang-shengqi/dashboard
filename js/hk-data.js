/* ============================================================
 * hk-data.js —— 香港账户数据层 + Excel 解析
 * ============================================================ */
(function (App) {
  'use strict';

  var S = {
    holdings: [], masterTemplates: {},
    accountSummary: {}, accountTrend: {},
    bochkSummary: {}, externalAssets: [], schwabTrendData: {},
    dividendSummary: {}, dividendTypeMap: {}, currencyMinInvestMap: {},
    initialPrincipalCNY: 0, ready: false
  };

  var CURRENCY_MAP = {
    '港元': 'HKD', '港币': 'HKD',
    '美元': 'USD', '美金': 'USD',
    '欧元': 'EUR', '日元': 'JPY', '日圆': 'JPY',
    '英镑': 'GBP', '澳元': 'AUD', '澳币': 'AUD',
    '加元': 'CAD', '加币': 'CAD',
    '人民币': 'CNH', '离岸人民币': 'CNH',
    '新元': 'SGD', '新加坡元': 'SGD',
    '瑞郎': 'CHF', '瑞士法郎': 'CHF'
  };

  function currencyCode(row, colCode, colName) {
    var code = (row[colCode] || '').toString().trim();
    if (code) return code === 'CNY' ? 'CNH' : code;
    var name = (row[colName] || '').toString().trim();
    for (var k in CURRENCY_MAP) {
      if (name.indexOf(k) !== -1) return CURRENCY_MAP[k];
    }
    return 'USD';
  }

  function toNum(v) {
    if (v === undefined || v === null || v === '') return 0;
    var n = parseFloat(String(v).replace(/,/g, '').trim());
    return isNaN(n) ? 0 : n;
  }

  function lastNonZero(row) {
    for (var i = row.length - 1; i >= 0; i--) {
      var v = toNum(row[i]);
      if (v !== 0) return v;
    }
    return 0;
  }

  function normalizePct(v) {
    if (v === undefined || v === null || isNaN(v)) return 0;
    if (v === 0) return 0;
    if (Math.abs(v) < 1.5) return v * 100;
    return v;
  }

  /* ============================================================
   * G10：扫描所有 sheet，找"货币代码 | 偏离值"结构
   * ============================================================ */
  function parseG10(workbook) {
    var result = null;

    workbook.SheetNames.forEach(function (name) {
      if (result) return;
      var sh = workbook.Sheets[name];
      if (!sh) return;
      var r = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });

      var map = {};
      for (var i = 0; i < r.length; i++) {
        var code = (r[i][0] || '').toString().trim().toUpperCase();
        var dev  = parseFloat(r[i][1]);
        if (/^[A-Z]{3}$/.test(code) && !isNaN(dev)) map[code] = dev;
      }

      /* 至少要 5 个才算有效的 G10 表 */
      if (Object.keys(map).length >= 5) result = map;
    });

    return result;
  }

  /* ============================================================
   * 主解析
   * ============================================================ */
  function parseWorkbook(wb) {
    if (!wb || !wb.SheetNames || !wb.SheetNames.length) {
      return { ok: false, msg: '工作簿为空' };
    }

    var sheet1 = wb.Sheets[wb.SheetNames[0]];
    if (!sheet1) return { ok: false, msg: 'Sheet1 不存在' };

    var rows = XLSX.utils.sheet_to_json(sheet1, { header: 1, defval: '' });
    if (rows.length < 2) return { ok: false, msg: '表格行数不足' };

    var headerRow = 0;
    while (headerRow < rows.length && rows[headerRow].length === 0) headerRow++;
    if (headerRow >= rows.length) return { ok: false, msg: '找不到表头行' };

    var header = rows[headerRow];
    var col = {
      id: -1, name: -1, stock: -1, bond: -1, cash: -1, other: -1,
      ccyName: -1, ccyCode: -1, cost: -1, value: -1,
      holder: -1, dividendType: -1, top10: -1, minInvest: -1
    };
    var dividendCols = [];

    header.forEach(function (h, idx) {
      var text = (h || '').toString().trim();
      if (text.includes('编号')) col.id = idx;
      else if (text === '资料' || text === '名称' || text === '基金名称' || text === '产品名称') col.name = idx;
      else if (text.includes('股票')) col.stock = idx;
      else if (text.includes('债券')) col.bond = idx;
      else if (text.includes('现金')) col.cash = idx;
      else if (text.includes('其它') || text.includes('其他')) col.other = idx;
      else if (text.includes('货币名称')) col.ccyName = idx;
      else if (text.includes('货币代码') || text.includes('币种')) col.ccyCode = idx;
      else if (text.includes('本金') || text.includes('成本')) col.cost = idx;
      else if (text.includes('市值') || text.includes('现值')) col.value = idx;
      else if (text.includes('持有人') || text.includes('户名')) col.holder = idx;
      else if (text.includes('分红判断') || text.includes('仓位类型')) col.dividendType = idx;
      else if (text.includes('十大投资项目') || text.includes('十大持仓') || text.includes('前十大')) col.top10 = idx;
      else if (text.includes('最低投入金额') || text.includes('起投')) col.minInvest = idx;

      if (text.includes('分红')) {
        var m = text.match(/(\d{4})年(\d{1,2})月/);
        if (m) dividendCols.push({
          index: idx, year: parseInt(m[1], 10), month: parseInt(m[2], 10)
        });
      }
    });

    if (col.id === -1) return { ok: false, msg: '找不到"编号"列' };

    var dataRows = rows.slice(headerRow + 1);

    var newHoldings = [], newTemplates = {}, newDividendTypeMap = {};
    var newDividendSummary = {}, newMinInvestMap = {}, newAccountSummary = {};
    var newAccountTrend = {}, newBochkSummary = {}, newExternalAssets = [];
    var newSchwabTrend = {}, newInitialPrincipalCNY = 0, skipped = 0;

    dataRows.forEach(function (row) {
      var id = (row[col.id] || '').toString().trim();
      var name = (row[col.name] || '').toString().trim();
      if (!id) { skipped++; return; }
      if (!name) name = id;

      var holder = (row[col.holder] || '').toString().trim().toLowerCase() || 'unknown';
      var dtype = (row[col.dividendType] || '').toString().trim();

      /* HSBC 账户结单 */
      if (name.indexOf('账户结单') !== -1 || id === 'Net Position' || name.indexOf('账户净额') !== -1) {
        if (!newAccountSummary[holder]) {
          newAccountSummary[holder] = { hkdBalance: 0, foreignBalance: 0, investBalance: 0, netPosition: 0 };
        }
        if (!newAccountTrend[holder]) newAccountTrend[holder] = {};

        if (dtype.indexOf('港元结余') !== -1) newAccountSummary[holder].hkdBalance = lastNonZero(row);
        else if (dtype.indexOf('外币结余') !== -1) newAccountSummary[holder].foreignBalance = lastNonZero(row);
        else if (dtype.indexOf('投资结余') !== -1) newAccountSummary[holder].investBalance = lastNonZero(row);
        else if (dtype.indexOf('账户净额') !== -1 || id === 'Net Position') {
          newAccountSummary[holder].netPosition = lastNonZero(row);
          dividendCols.forEach(function (c) {
            var v = toNum(row[c.index]);
            if (v !== 0) newAccountTrend[holder][c.year + '-' + String(c.month).padStart(2, '0')] = v;
          });
        }
        return;
      }

      /* BOCHK */
      if (id === 'BOCHK') {
        if (!newBochkSummary[holder]) {
          newBochkSummary[holder] = { hkdCurrent: 0, hkdFixed: 0, usdCurrent: 0, usdFixed: 0 };
        }
        var costB = toNum(row[col.cost]);
        if (name.indexOf('港元活期') !== -1) newBochkSummary[holder].hkdCurrent = costB;
        else if (name.indexOf('港元定存') !== -1) newBochkSummary[holder].hkdFixed = costB;
        else if (name.indexOf('美元活期') !== -1) newBochkSummary[holder].usdCurrent = costB;
        else if (name.indexOf('美元定存') !== -1) newBochkSummary[holder].usdFixed = costB;
        return;
      }

      /* Schwab */
      if (id === 'Schwab') {
        var ccyS = currencyCode(row, col.ccyCode, col.ccyName) || 'USD';
        var costS = toNum(row[col.cost]);
        var valueS = 0, latest = '';
        dividendCols.forEach(function (c) {
          var v = toNum(row[c.index]);
          if (v > 0) {
            var k = c.year + '-' + String(c.month).padStart(2, '0');
            if (k > latest) { latest = k; valueS = v; }
          }
        });
        if (valueS === 0) valueS = costS;
        newExternalAssets.push({ id: 'Schwab', name: name, currency: ccyS, cost: costS, value: valueS, holder: holder });
        dividendCols.forEach(function (c) {
          var v = toNum(row[c.index]);
          if (v !== 0) newSchwabTrend[c.year + '-' + String(c.month).padStart(2, '0')] = v;
        });
        return;
      }

      /* 初始本金 */
      if (id === 'Cash') {
        if (dtype === '初始本金' || name.indexOf('初始本金') !== -1) {
          newInitialPrincipalCNY = toNum(row[col.cost]);
        }
        return;
      }

      /* 普通基金 */
      if (!id.startsWith('U')) { skipped++; return; }

      var stock = normalizePct(toNum(row[col.stock]));
      var bond  = normalizePct(toNum(row[col.bond]));
      var cash  = normalizePct(toNum(row[col.cash]));
      var other = normalizePct(toNum(row[col.other]));
      if (cash === 1 && stock === 0 && bond === 0 && other === 0) cash = 100;

      var ccy = currencyCode(row, col.ccyCode, col.ccyName);
      var costF = toNum(row[col.cost]);
      var valueF = toNum(row[col.value]);
      if (valueF === 0) valueF = costF;

      var top10 = col.top10 >= 0 ? (row[col.top10] || '').toString().trim() : '';

      if (!dtype) {
        if (name.indexOf('每月派息') !== -1 || name.indexOf('入息') !== -1 || name.indexOf('收益') !== -1) dtype = '分红';
        else if (name.indexOf('累积') !== -1) dtype = '不分红';
        else dtype = 'unclassified';
      }
      newDividendTypeMap[id] = dtype;

      var minInvest = col.minInvest >= 0 ? toNum(row[col.minInvest]) : 0;
      if (minInvest > 0) {
        if (!newMinInvestMap[ccy] || minInvest < newMinInvestMap[ccy]) newMinInvestMap[ccy] = minInvest;
      }

      var yearly = {};
      dividendCols.forEach(function (c) {
        var v = toNum(row[c.index]);
        if (v > 0) yearly[c.year] = (yearly[c.year] || 0) + v;
      });
      Object.keys(yearly).forEach(function (y) {
        if (!newDividendSummary[holder]) newDividendSummary[holder] = {};
        if (!newDividendSummary[holder][y]) newDividendSummary[holder][y] = {};
        if (!newDividendSummary[holder][y][ccy]) newDividendSummary[holder][y][ccy] = 0;
        newDividendSummary[holder][y][ccy] += yearly[y];
      });

      newTemplates[id] = { stock: stock, bond: bond, cash: cash, other: other };
      newHoldings.push({
        id: id, name: name, template: id, currency: ccy,
        cost: costF, value: valueF, top10: top10,
        dividendType: dtype, holder: holder
      });
    });

    /* ★★★ G10：用扫描函数替代原来的 Sheet2 硬编码 ★★★ */
    var g10 = parseG10(wb);
    console.log('[hk-data] G10 解析结果：', g10);

    /* 写入状态 */
    S.holdings = newHoldings;
    S.masterTemplates = newTemplates;
    S.dividendTypeMap = newDividendTypeMap;
    S.dividendSummary = newDividendSummary;
    S.currencyMinInvestMap = newMinInvestMap;
    S.accountSummary = newAccountSummary;
    S.accountTrend = newAccountTrend;
    S.bochkSummary = newBochkSummary;
    S.externalAssets = newExternalAssets;
    S.schwabTrendData = newSchwabTrend;
    S.initialPrincipalCNY = newInitialPrincipalCNY;
    S.ready = true;

    /* 交给 g10 模块 */
    if (g10 && App.g10 && typeof App.g10.setFromImport === 'function') {
      App.g10.setFromImport(g10);
    } else if (g10) {
      console.warn('[hk-data] App.g10 未就绪，G10 数据暂存');
      App.storage.setJSON('g10-data', g10);
    }

    App.events.emit('hkdatachange', {
      holdings: newHoldings.length,
      skipped: skipped,
      holders: Object.keys(newAccountSummary)
    });

    return {
      ok: true,
      holdings: newHoldings.length,
      skipped: skipped,
      holders: Object.keys(newAccountSummary),
      g10: g10 ? Object.keys(g10).length : 0
    };
  }

  function save() {
    App.storage.setJSON('hkdata', {
      holdings: S.holdings, masterTemplates: S.masterTemplates,
      accountSummary: S.accountSummary, accountTrend: S.accountTrend,
      bochkSummary: S.bochkSummary, externalAssets: S.externalAssets,
      schwabTrendData: S.schwabTrendData, dividendSummary: S.dividendSummary,
      dividendTypeMap: S.dividendTypeMap, currencyMinInvestMap: S.currencyMinInvestMap,
      initialPrincipalCNY: S.initialPrincipalCNY, savedAt: Date.now()
    });
  }

  function load() {
    var d = App.storage.getJSON('hkdata', null);
    if (!d) return false;
    S.holdings = d.holdings || [];
    S.masterTemplates = d.masterTemplates || {};
    S.accountSummary = d.accountSummary || {};
    S.accountTrend = d.accountTrend || {};
    S.bochkSummary = d.bochkSummary || {};
    S.externalAssets = d.externalAssets || [];
    S.schwabTrendData = d.schwabTrendData || {};
    S.dividendSummary = d.dividendSummary || {};
    S.dividendTypeMap = d.dividendTypeMap || {};
    S.currencyMinInvestMap = d.currencyMinInvestMap || {};
    S.initialPrincipalCNY = d.initialPrincipalCNY || 0;
    S.ready = true;
    App.events.emit('hkdatachange', { holdings: S.holdings.length, fromCache: true });
    return true;
  }

  function clear() {
    S.holdings = []; S.masterTemplates = {};
    S.accountSummary = {}; S.accountTrend = {};
    S.bochkSummary = {}; S.externalAssets = []; S.schwabTrendData = {};
    S.dividendSummary = {}; S.dividendTypeMap = {}; S.currencyMinInvestMap = {};
    S.initialPrincipalCNY = 0; S.ready = false;
    App.storage.remove('hkdata');
    App.events.emit('hkdatachange', { cleared: true });
  }

  App.hkData = {
    get holdings()             { return S.holdings; },
    get masterTemplates()      { return S.masterTemplates; },
    get accountSummary()       { return S.accountSummary; },
    get accountTrend()         { return S.accountTrend; },
    get bochkSummary()         { return S.bochkSummary; },
    get externalAssets()       { return S.externalAssets; },
    get schwabTrendData()      { return S.schwabTrendData; },
    get dividendSummary()      { return S.dividendSummary; },
    get dividendTypeMap()      { return S.dividendTypeMap; },
    get currencyMinInvestMap() { return S.currencyMinInvestMap; },
    get initialPrincipalCNY()  { return S.initialPrincipalCNY; },
    get ready()                { return S.ready; },
    parseWorkbook: parseWorkbook,
    parseG10: parseG10,
    save: save, load: load, clear: clear,
    toNum: toNum, normalizePct: normalizePct
  };

})(window.App = window.App || {});