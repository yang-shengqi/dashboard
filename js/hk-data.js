/* ============================================================
 * hk-data.js —— 香港账户数据层 + Excel 解析
 * ------------------------------------------------------------
 * ★ v3 改动（2026-09-19）：
 *   1. 复合主键：masterTemplates / dividendTypeMap 的 key
 *      从「编号」改为「编号@持有人」，避免同一基金被两个
 *      持有人分别持有时后行静默覆盖前行。
 *   2. 存储版本升到 hk_data_v3，旧 key 自动迁移。
 *   3. 新增公式求值 resolveFormulas()：Excel 里 =X+Y+Z 这类
 *      公式单元格，若 XLSX 未读到缓存值，则在前端解析成数字，
 *      修复账户净额走势图「公式月缺一个点」的问题。
 *   4. 新增重复行检测：同一「编号@持有人」出现多行时告警。
 *
 * ★ 保留 v2 行为：
 *   save() / load() / clear() 直接读写 localStorage，
 *   带容量保护、失败提示、旧 key 自动迁移。
 *   interestSummary：分红判断 = 利息的行，按编号读入。
 * ============================================================ */
(function (App) {
  'use strict';

  var S = {
    holdings: [], masterTemplates: {},
    accountSummary: {}, accountTrend: {},
    bochkSummary: {}, externalAssets: [], schwabTrendData: {},
    dividendSummary: {}, dividendTypeMap: {}, currencyMinInvestMap: {},
    interestSummary: {},
    initialPrincipalCNY: 0, ready: false
  };

  /* ============================================================
   * ★ 复合主键：编号 + 持有人
   *   同一个 U 编号可被 huang / yang 各自持有，
   *   他们的资产分配、分红类型必须互不干扰。
   * ============================================================ */
  function tplKey(id, holder) {
    return String(id) + '@' + String(holder || 'unknown');
  }

  /* ============================================================
   * ★ 存储层：v3
   * ============================================================ */
  var HK_KEY = 'hk_data_v3';
  var HK_OLD_KEYS = ['hk_data_v2', 'hkdata', 'console-data-hkdata'];

  function writeStorage(obj) {
    var json;
    try { json = JSON.stringify(obj); }
    catch (e) {
      console.error('[hk-data] 序列化失败：', e);
      window.alert('⚠️ 数据序列化失败：' + (e.message || e.name || '未知错误'));
      return false;
    }

    try {
      localStorage.setItem(HK_KEY, json);
      HK_OLD_KEYS.forEach(function (k) {
        try { localStorage.removeItem(k); } catch (e) {}
      });
      return true;
    } catch (e) {
      console.error('[hk-data] localStorage 写入失败：', e);
      var isQuota = e && (
        e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22 || e.code === 1014
      );
      if (isQuota) {
        window.alert('⚠️ 浏览器本地缓存已满，数据无法保存。\n请点击「清空数据」后重新导入，或清理浏览器缓存。');
      } else {
        window.alert('⚠️ 数据保存失败：' + (e.message || e.name || '未知错误'));
      }
      return false;
    }
  }

  /* ============================================================
   * ★ 旧格式（单编号 key）→ 复合主键，就地改写 d
   *   幂等：已含 @ 的数据原样返回。
   * ============================================================ */
  function migrateToCompoundKey(d) {
    if (!d || !Array.isArray(d.holdings) || !d.holdings.length) return d;

    var need = d.holdings.some(function (f) {
      return f && f.template && String(f.template).indexOf('@') === -1;
    });
    if (!need) return d;   /* 已是新格式 */

    var oldTpl  = d.masterTemplates  || {};
    var oldType = d.dividendTypeMap  || {};
    var newTpl  = {};
    var newType = {};

    d.holdings.forEach(function (f) {
      var k = tplKey(f.id, f.holder);

      /* 模板：旧 key 可能是编号，也可能是老的 template 字段值 */
      var oldTplVal = oldTpl[f.template] || oldTpl[f.id];
      if (oldTplVal) newTpl[k] = oldTplVal;

      /* 类型：旧 key 是编号 */
      if (oldType[f.id] !== undefined) newType[k] = oldType[f.id];

      f.template = k;
    });

    d.masterTemplates  = newTpl;
    d.dividendTypeMap  = newType;

    console.log('[hk-data] 已迁移到复合主键（编号@持有人）');
    return d;
  }

  function readStorage() {
    /* 1. 当前版本 */
    try {
      var raw = localStorage.getItem(HK_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && d.holdings) return migrateToCompoundKey(d);
      }
    } catch (e) {
      console.warn('[hk-data] 新 key 读取失败：', e);
    }

    /* 2. 旧版本 key */
    for (var i = 0; i < HK_OLD_KEYS.length; i++) {
      try {
        var raw2 = localStorage.getItem(HK_OLD_KEYS[i]);
        if (raw2) {
          var d2 = JSON.parse(raw2);
          if (d2 && d2.holdings) {
            console.log('[hk-data] 从旧 key 迁移：' + HK_OLD_KEYS[i]);
            d2 = migrateToCompoundKey(d2);
            writeStorage(d2);
            return d2;
          }
        }
      } catch (e) {}
    }

    return null;
  }

  function removeAllKeys() {
    try { localStorage.removeItem(HK_KEY); } catch (e) {}
    HK_OLD_KEYS.forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  }

  /* ============================================================
   * 币种 / 数值工具
   * ============================================================ */
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
    /* ★ 公式字符串：resolveFormulas 应已处理；未处理成功则返回 0 */
    if (typeof v === 'string' && v.trim().charAt(0) === '=') return 0;
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
   * ★ 公式求值（只支持 + / - 与单元格引用、数字）
   * ------------------------------------------------------------
   * Excel 列字母 → 0-based 索引：A=0, B=1, ..., Z=25, AA=26
   * Excel 行号（1-based）→ 矩阵行索引（0-based）= 行号 - 1
   * ============================================================ */
  function colToIndex(col) {
    var n = 0;
    for (var i = 0; i < col.length; i++) {
      n = n * 26 + (col.charCodeAt(i) - 64);
    }
    return n - 1;
  }

  function cellRefToPos(ref) {
    var m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref);
    if (!m) return null;
    return { col: colToIndex(m[1]), row: parseInt(m[2], 10) - 1 };
  }

  /* 求单个公式：返回数字，或 null（不支持 / 依赖未解出） */
  function evalSimpleFormula(expr, matrix) {
    var s = String(expr).replace(/\s+/g, '');
    if (!s) return null;

    var i = 0;
    var total = 0;
    var sign = 1;

    while (i < s.length) {
      var ch = s.charAt(i);

      if (ch === '+') { sign = 1;  i++; continue; }
      if (ch === '-') { sign = -1; i++; continue; }

      var rest = s.substring(i);

      /* 单元格引用 */
      var mRef = /^\$?([A-Z]+)\$?(\d+)/.exec(rest);
      if (mRef) {
        var pos = cellRefToPos(mRef[0]);
        if (!pos) return null;
        var rowArr = matrix[pos.row];
        var raw = rowArr ? rowArr[pos.col] : 0;
        /* 引用的还是未解出的公式 → 本轮放弃 */
        if (typeof raw === 'string' && raw.charAt(0) === '=') return null;
        var v = (raw === undefined || raw === null || raw === '')
          ? 0
          : parseFloat(String(raw).replace(/,/g, ''));
        if (isNaN(v)) v = 0;
        total += sign * v;
        i += mRef[0].length;
        sign = 1;
        continue;
      }

      /* 数字 */
      var mNum = /^\d+(\.\d+)?/.exec(rest);
      if (mNum) {
        total += sign * parseFloat(mNum[0]);
        i += mNum[0].length;
        sign = 1;
        continue;
      }

      /* 出现 * / ( ) 等不支持符号 → 放弃（保留原字符串） */
      return null;
    }

    return total;
  }

  /* 迭代解析整个矩阵里的公式（最多 20 轮，处理公式引用公式） */
  function resolveFormulas(matrix) {
    var MAX_ITER = 20;
    var resolvedCount = 0;

    for (var iter = 0; iter < MAX_ITER; iter++) {
      var pending = 0;

      for (var r = 0; r < matrix.length; r++) {
        var row = matrix[r];
        if (!row) continue;
        for (var c = 0; c < row.length; c++) {
          var v = row[c];
          if (typeof v === 'string' && v.charAt(0) === '=') {
            var result = evalSimpleFormula(v.substring(1), matrix);
            if (result !== null) {
              row[c] = result;
              resolvedCount++;
            } else {
              pending++;
            }
          }
        }
      }

      if (pending === 0) break;
    }

    if (resolvedCount > 0) {
      console.log('[hk-data] 公式求值：成功解出 ' + resolvedCount + ' 个单元格');
    }
    return matrix;
  }

  /* ============================================================
   * G10 解析
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

    /* ★ 先解析公式（原地改写 rows），再走后续业务解析 */
    resolveFormulas(rows);

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

      var m = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
      if (m) {
        var yy = parseInt(m[1], 10);
        var mm = parseInt(m[2], 10);
        if (yy >= 2000 && mm >= 1 && mm <= 12) {
          dividendCols.push({ index: idx, year: yy, month: mm });
        }
      }
    });

    console.log('[hk-data] 识别到分红列:', dividendCols);
    if (col.id === -1) return { ok: false, msg: '找不到"编号"列' };

    var dataRows = rows.slice(headerRow + 1);

    var newHoldings = [], newTemplates = {}, newDividendTypeMap = {};
    var newDividendSummary = {}, newMinInvestMap = {}, newAccountSummary = {};
    var newAccountTrend = {}, newBochkSummary = {}, newExternalAssets = [];
    var newSchwabTrend = {}, newInitialPrincipalCNY = 0, skipped = 0;
    var newInterestSummary = {};

    dataRows.forEach(function (row) {
      var id = (row[col.id] || '').toString().trim();
      var name = (row[col.name] || '').toString().trim();
      if (!id) { skipped++; return; }
      if (!name) name = id;

      var holder = (row[col.holder] || '').toString().trim().toLowerCase() || 'unknown';
      var dtype = (row[col.dividendType] || '').toString().trim();

      /* ========================================================
       * ★ 1. BOCHK 结余（提前处理）
       * ======================================================== */
      if (id === 'BOCHK') {
        if (!newBochkSummary[holder]) {
          newBochkSummary[holder] = { hkdCurrent: 0, hkdFixed: 0, usdCurrent: 0, usdFixed: 0 };
        }
        var costB = toNum(row[col.cost]);
        if (name.indexOf('港元活期') !== -1) newBochkSummary[holder].hkdCurrent = costB;
        else if (name.indexOf('港元定存') !== -1) newBochkSummary[holder].hkdFixed = costB;
        else if (name.indexOf('美元活期') !== -1) newBochkSummary[holder].usdCurrent = costB;
        else if (name.indexOf('美元定存') !== -1) newBochkSummary[holder].usdFixed = costB;

        if (dtype !== '利息') return;
      }

      /* ========================================================
       * ★ 2. 利息行（任何账户）
       * ======================================================== */
      if (dtype === '利息') {
        var acctI = id;
        var ccyI = currencyCode(row, col.ccyCode, col.ccyName) || 'HKD';
        var yearlyI = {};
        dividendCols.forEach(function (c) {
          var v = toNum(row[c.index]);
          if (v > 0) yearlyI[c.year] = (yearlyI[c.year] || 0) + v;
        });
        Object.keys(yearlyI).forEach(function (y) {
          if (!newInterestSummary[holder])                 newInterestSummary[holder] = {};
          if (!newInterestSummary[holder][acctI])          newInterestSummary[holder][acctI] = {};
          if (!newInterestSummary[holder][acctI][y])       newInterestSummary[holder][acctI][y] = {};
          if (!newInterestSummary[holder][acctI][y][ccyI]) newInterestSummary[holder][acctI][y][ccyI] = 0;
          newInterestSummary[holder][acctI][y][ccyI] += yearlyI[y];
        });
        return;
      }

      /* ========================================================
       * ★ 3. HSBC 账户结单
       * ======================================================== */
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

      /* ========================================================
       * ★ 4. Schwab
       * ======================================================== */
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

      /* ========================================================
       * ★ 5. 初始本金
       * ======================================================== */
      if (id === 'Cash') {
        if (dtype === '初始本金' || name.indexOf('初始本金') !== -1) {
          newInitialPrincipalCNY = toNum(row[col.cost]);
        }
        return;
      }

      /* ========================================================
       * ★ 6. 普通基金
       * ======================================================== */
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

      /* ★ 复合主键：编号@持有人 */
      var tKey = tplKey(id, holder);

      newDividendTypeMap[tKey] = dtype;

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

      newTemplates[tKey] = { stock: stock, bond: bond, cash: cash, other: other };
      newHoldings.push({
        id: id, name: name,
        template: tKey,            /* ★ 复合键 */
        currency: ccy,
        cost: costF, value: valueF, top10: top10,
        dividendType: dtype, holder: holder
      });
    });

    /* ============================================================
     * ★ 重复行检测：同一 (编号@持有人) 出现多行
     * ------------------------------------------------------------
     * 这才是真正的冲突（比如 Excel 手滑复制了一行）。
     * 不同持有人持有同一编号，是合法的。
     * ============================================================ */
    (function checkDup() {
      var seen = {};
      var dup = [];
      newHoldings.forEach(function (f) {
        if (seen[f.template]) dup.push(f.id + '@' + f.holder);
        seen[f.template] = 1;
      });
      if (dup.length) {
        console.warn(
          '%c[hk-data] ⚠️ 同一「编号@持有人」出现多行，后行覆盖前行：',
          'color:#ff9f0a;font-weight:bold',
          dup
        );
      }
    })();

    var g10 = parseG10(wb);
    console.log('[hk-data] G10 解析结果：', g10);

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
    S.interestSummary = newInterestSummary;
    S.ready = true;

    if (g10 && App.g10 && typeof App.g10.setFromImport === 'function') {
      App.g10.setFromImport(g10);
    } else if (g10) {
      console.warn('[hk-data] App.g10 未就绪，G10 数据暂存');
      try {
        localStorage.setItem('g10-data', JSON.stringify(g10));
      } catch (e) {}
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
    var payload = {
      holdings: S.holdings, masterTemplates: S.masterTemplates,
      accountSummary: S.accountSummary, accountTrend: S.accountTrend,
      bochkSummary: S.bochkSummary, externalAssets: S.externalAssets,
      schwabTrendData: S.schwabTrendData, dividendSummary: S.dividendSummary,
      dividendTypeMap: S.dividendTypeMap, currencyMinInvestMap: S.currencyMinInvestMap,
      interestSummary: S.interestSummary,
      initialPrincipalCNY: S.initialPrincipalCNY, savedAt: Date.now()
    };
    var ok = writeStorage(payload);
    if (ok) {
      console.log('[hk-data] ✅ 已保存到 localStorage：', HK_KEY,
                  '（' + S.holdings.length + ' 只基金）');
    }
    return ok;
  }

  function load() {
    var d = readStorage();
    if (!d) {
      console.log('[hk-data] 未找到本地缓存');
      return false;
    }
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
    S.interestSummary = d.interestSummary || {};
    S.initialPrincipalCNY = d.initialPrincipalCNY || 0;
    S.ready = true;
    console.log('[hk-data] ✅ 已从本地缓存恢复：' + S.holdings.length + ' 只基金');
    App.events.emit('hkdatachange', { holdings: S.holdings.length, fromCache: true });
    return true;
  }

  function clear() {
    S.holdings = []; S.masterTemplates = {};
    S.accountSummary = {}; S.accountTrend = {};
    S.bochkSummary = {}; S.externalAssets = []; S.schwabTrendData = {};
    S.dividendSummary = {}; S.dividendTypeMap = {}; S.currencyMinInvestMap = {};
    S.interestSummary = {};
    S.initialPrincipalCNY = 0; S.ready = false;
    removeAllKeys();
    console.log('[hk-data] 已清空所有本地缓存');
    App.events.emit('hkdatachange', { cleared: true });
  }

  /* ============================================================
   * 自测 —— 数值解析 / 百分比归一化 / 复合主键 / 公式求值
   * ============================================================ */
  function selfTest() {
    var fail = [];
    var eps = 0.01;

    /* ---- toNum ---- */
    if (toNum('123') !== 123)
      fail.push('toNum("123") 应=123，实际 ' + toNum('123'));

    if (Math.abs(toNum('1,234.56') - 1234.56) > eps)
      fail.push('toNum("1,234.56") 应=1234.56，实际 ' + toNum('1,234.56'));

    if (toNum('=A1+B1') !== 0)
      fail.push('toNum 公式字符串应=0，实际 ' + toNum('=A1+B1'));

    if (toNum(null) !== 0)
      fail.push('toNum(null) 应=0，实际 ' + toNum(null));

    if (toNum('abc') !== 0)
      fail.push('toNum("abc") 应=0，实际 ' + toNum('abc'));

    /* ---- normalizePct ---- */
    if (normalizePct(0) !== 0)
      fail.push('normalizePct(0) 应=0');
    if (Math.abs(normalizePct(0.988) - 98.8) > eps)
      fail.push('normalizePct(0.988) 应=98.8，实际 ' + normalizePct(0.988));
    if (Math.abs(normalizePct(1.2) - 120) > eps)
      fail.push('normalizePct(1.2) 应=120（<1.5 视作小数），实际 ' + normalizePct(1.2));

    /* ---- tplKey ---- */
    if (tplKey('U63330', 'huang') !== 'U63330@huang')
      fail.push('tplKey 应为 U63330@huang，实际 ' + tplKey('U63330', 'huang'));
    if (tplKey('U63330', 'yang') !== 'U63330@yang')
      fail.push('tplKey 应为 U63330@yang，实际 ' + tplKey('U63330', 'yang'));
    if (tplKey('U63330', '') !== 'U63330@unknown')
      fail.push('tplKey 空持有人应为 @unknown，实际 ' + tplKey('U63330', ''));

    /* ---- 公式求值 ---- */
    var matrix = [
      ['A', 'B', 'C'],
      [10,  20,  '=A2+B2'],       /* C2 = 30 */
      ['=C2+5', 0, '=A2-B2']      /* A3 = 35, C3 = -10 */
    ];
    resolveFormulas(matrix);
    if (Math.abs(matrix[1][2] - 30) > eps)
      fail.push('公式 =A2+B2 应=30，实际 ' + matrix[1][2]);
    if (Math.abs(matrix[2][0] - 35) > eps)
      fail.push('公式 =C2+5 应=35，实际 ' + matrix[2][0]);
    if (Math.abs(matrix[2][2] - (-10)) > eps)
      fail.push('公式 =A2-B2 应=-10，实际 ' + matrix[2][2]);

    return fail;
  }

  /* ============================================================
   * 对外
   * ============================================================ */
  App.hkData = {
    requires: [
      'hkHoldingsBody', 'hkHoldingsTotal', 'hkHoldingsCount',
      'hkImportBtn', 'hkFileInput', 'hkClearBtn',
      'hkAccountsGrid', 'principalCNYDisplay', 'principalHKDDisplay',
      'totalAssetsDisplay', 'marketValueDisplay', 'cashBalanceDisplay',
      'profitDisplay', 'hsbcMarketValue', 'schwabMarketValue',
      'hsbcCashValue', 'bochkCashValue', 'exchangeRateInput'
    ],
    selfTest: selfTest,

    /* ★ 复合主键工具，供 dividends / split-monitor 等复用 */
    tplKey: tplKey,

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
    get interestSummary()      { return S.interestSummary; },
    get initialPrincipalCNY()  { return S.initialPrincipalCNY; },
    get ready()                { return S.ready; },
    parseWorkbook: parseWorkbook,
    parseG10: parseG10,
    save: save, load: load, clear: clear,
    toNum: toNum, normalizePct: normalizePct,
    resolveFormulas: resolveFormulas
  };

})(window.App = window.App || {});