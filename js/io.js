/* ============================================================
 * io.js —— 导入导出
 * ------------------------------------------------------------
 * 依赖：core.js / xlsx.full.min.js（第三方，仅 XLSX 功能需要）
 * 对外：
 *   App.io.exportCSV / exportJSON / exportXLSX
 *   App.io.importCSV / importJSON / importXLSX
 *   App.io.exportCollection / importToCollection
 *
 * 本版修改：无（保留原样）
 * ============================================================ */
(function (App) {
  'use strict';

  /* ---------- 触发下载 ---------- */
  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 200);
  }

  /* ---------- 读文件 ---------- */
  function readFile(file, asText) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      if (asText) r.readAsText(file, 'utf-8');
      else        r.readAsArrayBuffer(file);
    });
  }

  /* ---------- 日期后缀 ---------- */
  function dateStamp() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* ---------- 归一化列定义 ---------- */
  function normalizeColumns(rows, columns) {
    if (Array.isArray(columns) && columns.length) {
      return columns.map(function (c) {
        return typeof c === 'string'
          ? { key: c, label: c }
          : { key: c.key, label: c.label || c.key };
      });
    }
    if (!rows.length) return [];
    return Object.keys(rows[0]).map(function (k) {
      return { key: k, label: k };
    });
  }

  /* ============================================================
   * 二、CSV —— 导出
   * ============================================================ */
  function escapeCSV(v) {
    if (v === undefined || v === null) return '';
    var s = String(v);
    if (/[",\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function toCSVText(rows, columns) {
    var cols = normalizeColumns(rows, columns);
    if (!cols.length) return '';

    var head = cols.map(function (c) { return escapeCSV(c.label); }).join(',');
    var body = rows.map(function (row) {
      return cols.map(function (c) { return escapeCSV(row[c.key]); }).join(',');
    }).join('\r\n');

    /* \uFEFF 是 BOM，让 Excel 正确识别 UTF-8 */
    return '\uFEFF' + head + '\r\n' + body;
  }

  /* ============================================================
   * 三、CSV —— 解析
   * ============================================================ */
  function parseCSVText(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;

    while (i < text.length) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; }
          else                     { inQuotes = false; i++; }
        } else {
          field += c; i++;
        }
      } else {
        if (c === '"')         { inQuotes = true; i++; }
        else if (c === ',')    { row.push(field); field = ''; i++; }
        else if (c === '\r')   { i++; }
        else if (c === '\n')   {
          row.push(field);
          rows.push(row);
          row = []; field = '';
          i++;
        }
        else                   { field += c; i++; }
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function csvToObjects(text, options) {
    options = options || {};
    var matrix = parseCSVText(text);
    if (matrix.length < 2) return [];

    var headers = matrix[0];
    var objects = [];

    for (var i = 1; i < matrix.length; i++) {
      var row = matrix[i];
      if (row.length === 1 && row[0] === '') continue;   /* 跳空行 */

      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        var v = row[j] !== undefined ? row[j] : '';
        if (options.autoNumber && v !== '' && !isNaN(v)) v = Number(v);
        obj[headers[j]] = v;
      }
      objects.push(obj);
    }
    return objects;
  }

  /* ============================================================
   * 四、对外 API
   * ============================================================ */
  App.io = {

    /* 导出 CSV */
    exportCSV: function (rows, filename, columns) {
      if (!Array.isArray(rows)) return;
      var text = toCSVText(rows, columns);
      if (!text) return;
      var name = filename || ('export-' + dateStamp() + '.csv');
      download(new Blob([text], { type: 'text/csv;charset=utf-8;' }), name);
    },

    /* 导入 CSV */
    importCSV: function (file, options) {
      return readFile(file, true).then(function (text) {
        return csvToObjects(text, options);
      });
    },

    /* 导出 JSON */
    exportJSON: function (data, filename) {
      var text = JSON.stringify(data, null, 2);
      var name = filename || ('export-' + dateStamp() + '.json');
      download(new Blob([text], { type: 'application/json;charset=utf-8;' }), name);
    },

    /* 导入 JSON */
    importJSON: function (file) {
      return readFile(file, true).then(function (text) {
        return JSON.parse(text);
      });
    },

    /* 导出 Excel */
    exportXLSX: function (rows, filename, sheetName, columns) {
      if (typeof XLSX === 'undefined') {
        console.warn('[io] XLSX 库未加载');
        return;
      }
      if (!Array.isArray(rows)) return;

      var cols = normalizeColumns(rows, columns);
      if (!cols.length) return;

      var matrix = [cols.map(function (c) { return c.label; })];
      rows.forEach(function (row) {
        matrix.push(cols.map(function (c) { return row[c.key]; }));
      });

      var ws = XLSX.utils.aoa_to_sheet(matrix);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');

      var name = filename || ('export-' + dateStamp() + '.xlsx');
      XLSX.writeFile(wb, name);
    },

    /* 导入 Excel */
    importXLSX: function (file, options) {
      if (typeof XLSX === 'undefined') {
        return Promise.reject(new Error('XLSX 库未加载'));
      }
      options = options || {};

      return readFile(file, false).then(function (buffer) {
        var data = new Uint8Array(buffer);
        var wb = XLSX.read(data, { type: 'array' });

        var sheetName = options.sheet || wb.SheetNames[0];
        var sheet = wb.Sheets[sheetName];
        if (!sheet) return [];

        var matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (matrix.length < 2) return [];

        var headers = matrix[0];
        var objects = [];

        for (var i = 1; i < matrix.length; i++) {
          var row = matrix[i];
          var empty = row.every(function (v) { return v === '' || v === null || v === undefined; });
          if (empty) continue;

          var obj = {};
          for (var j = 0; j < headers.length; j++) {
            var h = headers[j];
            if (!h) continue;
            var v = row[j] !== undefined ? row[j] : '';
            if (options.autoNumber && v !== '' && !isNaN(v)) v = Number(v);
            obj[h] = v;
          }
          objects.push(obj);
        }
        return objects;
      });
    },

    /* 便捷：直接把集合导出 */
    exportCollection: function (collection, filename, format, columns) {
      if (!collection) return;
      var rows = collection.all();
      var name = filename || (collection.name + '-' + dateStamp());

      switch (format) {
        case 'json':
          App.io.exportJSON(rows, name + '.json');
          break;
        case 'xlsx':
          App.io.exportXLSX(rows, name + '.xlsx', collection.name, columns);
          break;
        case 'csv':
        default:
          App.io.exportCSV(rows, name + '.csv', columns);
      }
    },

    /* 便捷：导入到集合 */
    importToCollection: function (file, collection, format, options) {
      if (!file || !collection) return Promise.reject(new Error('参数缺失'));

      var fmt = format || (file.name.split('.').pop() || '').toLowerCase();
      var task;

      if (fmt === 'json')      task = App.io.importJSON(file);
      else if (fmt === 'xlsx' || fmt === 'xls') task = App.io.importXLSX(file, options);
      else                     task = App.io.importCSV(file, options);

      return task.then(function (result) {
        var rows = Array.isArray(result) ? result : (result.rows || []);
        collection.set(rows);
        return rows;
      });
    },

    /* 底层工具，暴露给高级用法 */
    _toCSVText: toCSVText,
    _parseCSVText: parseCSVText,
    _download: download
  };

})(window.App = window.App || {});