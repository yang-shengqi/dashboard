/* ============================================================
 * data.js —— 数据容器
 * ------------------------------------------------------------
 * 依赖：core.js（App.storage / App.events / App.utils）
 * 职责：管理"集合"（一组同结构记录），提供增删改查 + 聚合
 *       不关心业务字段，只关心"记录"这个抽象
 * 对外：
 *   App.data.create(name, options)          建集合
 *   App.data.get(name)                      取集合引用
 *   App.data.remove(name)                   删集合
 *   collection.set(records)                 替换全部
 *   collection.all()                        取全部（浅拷贝）
 *   collection.find(fn) / findOne(fn)       查
 *   collection.add(record) / addMany(arr)   增
 *   collection.update(fn, patch)            改
 *   collection.remove(fn)                   删
 *   collection.where(fn) / sort(field,dir)  过滤排序
 *   collection.sum(field) / avg(field)      聚合
 *   collection.groupBy(field)               分组
 *   collection.persist() / load()           持久化
 *   collection.onChange(fn)                 变更订阅
 * 事件：name 变更时派发 'datachange'，detail = { name }
 *
 * 本版修改：无（保留原样）
 * ============================================================ */
(function (App) {
  'use strict';

  var registry = {};   /* { name: collection } */

  /* ============================================================
   * 内部：创建一个集合
   * ============================================================ */
  function makeCollection(name, options) {
    options = options || {};

    var key = options.key || 'id';              /* 主键字段名 */
    var persistKey = 'data-' + name;            /* 存档键名 */
    var records = [];                           /* 数据本体 */
    var listeners = [];                         /* 变更订阅者 */

    /* ---------- 内部：通知 ---------- */
    function notify(type) {
      listeners.forEach(function (fn) {
        try { fn(records, type); } catch (e) {
          console.warn('[data] listener error for', name, e);
        }
      });
      App.events.emit('datachange', { name: name, type: type });
    }

    /* ---------- 内部：找主键索引 ---------- */
    function indexOfKey(k) {
      for (var i = 0; i < records.length; i++) {
        if (records[i] && records[i][key] === k) return i;
      }
      return -1;
    }

    /* ============================================================
     * 集合 API
     * ============================================================ */
    var api = {

      /* ---------- 元信息 ---------- */
      name: name,
      key: key,

      /* ---------- 替换全部 ---------- */
      set: function (list) {
        records = Array.isArray(list) ? list.slice() : [];
        notify('set');
        if (options.autoPersist) api.persist();
        return api;
      },

      /* ---------- 取全部（浅拷贝，防外部乱改内部数组） ---------- */
      all: function () {
        return records.slice();
      },

      /* ---------- 数量 ---------- */
      count: function () {
        return records.length;
      },

      /* ---------- 查：过滤出符合条件的记录 ---------- */
      find: function (predicate) {
        if (typeof predicate !== 'function') return [];
        return records.filter(predicate);
      },

      /* ---------- 查：取第一条 ---------- */
      findOne: function (predicate) {
        if (typeof predicate !== 'function') return null;
        for (var i = 0; i < records.length; i++) {
          if (predicate(records[i], i)) return records[i];
        }
        return null;
      },

      /* ---------- 查：按主键 ---------- */
      byKey: function (k) {
        var idx = indexOfKey(k);
        return idx === -1 ? null : records[idx];
      },

      /* ---------- 增：单条 ---------- */
      add: function (record) {
        if (!record) return null;
        records.push(record);
        notify('add');
        if (options.autoPersist) api.persist();
        return record;
      },

      /* ---------- 增：多条 ---------- */
      addMany: function (list) {
        if (!Array.isArray(list)) return 0;
        var n = 0;
        list.forEach(function (r) {
          if (r) { records.push(r); n++; }
        });
        if (n > 0) {
          notify('add');
          if (options.autoPersist) api.persist();
        }
        return n;
      },

      /* ---------- 改：对符合条件的所有记录打补丁 ---------- */
      update: function (predicate, patch) {
        if (typeof predicate !== 'function' || !patch) return 0;
        var n = 0;
        records.forEach(function (r) {
          if (predicate(r)) {
            Object.keys(patch).forEach(function (k) { r[k] = patch[k]; });
            n++;
          }
        });
        if (n > 0) {
          notify('update');
          if (options.autoPersist) api.persist();
        }
        return n;
      },

      /* ---------- 改：按主键替换 ---------- */
      replace: function (k, patch) {
        var idx = indexOfKey(k);
        if (idx === -1) return false;
        records[idx] = Object.assign({}, records[idx], patch);
        notify('update');
        if (options.autoPersist) api.persist();
        return true;
      },

      /* ---------- 删：对符合条件的所有记录 ---------- */
      remove: function (predicate) {
        if (typeof predicate !== 'function') return 0;
        var before = records.length;
        records = records.filter(function (r) { return !predicate(r); });
        var n = before - records.length;
        if (n > 0) {
          notify('remove');
          if (options.autoPersist) api.persist();
        }
        return n;
      },

      /* ---------- 删：按主键 ---------- */
      removeByKey: function (k) {
        var idx = indexOfKey(k);
        if (idx === -1) return false;
        records.splice(idx, 1);
        notify('remove');
        if (options.autoPersist) api.persist();
        return true;
      },

      /* ---------- 清空 ---------- */
      clear: function () {
        records = [];
        notify('clear');
        if (options.autoPersist) api.persist();
      },

      /* ---------- 过滤（返回新集合，不动原数据） ---------- */
      where: function (predicate) {
        return api.find(predicate);
      },

      /* ---------- 排序（返回新数组，不动原数据） ---------- */
      sort: function (field, dir) {
        var sign = dir === 'desc' ? -1 : 1;
        return records.slice().sort(function (a, b) {
          var va = a[field], vb = b[field];
          if (va === vb) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          return va > vb ? sign : -sign;
        });
      },

      /* ---------- 聚合：求和 ---------- */
      sum: function (field) {
        return records.reduce(function (s, r) {
          var v = Number(r[field]);
          return s + (isNaN(v) ? 0 : v);
        }, 0);
      },

      /* ---------- 聚合：平均值 ---------- */
      avg: function (field) {
        if (records.length === 0) return 0;
        return api.sum(field) / records.length;
      },

      /* ---------- 聚合：最大 / 最小 ---------- */
      max: function (field) {
        if (!records.length) return null;
        return records.reduce(function (m, r) {
          var v = Number(r[field]);
          if (isNaN(v)) return m;
          return m === null || v > m ? v : m;
        }, null);
      },

      min: function (field) {
        if (!records.length) return null;
        return records.reduce(function (m, r) {
          var v = Number(r[field]);
          if (isNaN(v)) return m;
          return m === null || v < m ? v : m;
        }, null);
      },

      /* ---------- 聚合：分组 ---------- */
      /* groupBy('currency') → { USD: [...], HKD: [...] } */
      groupBy: function (field) {
        var out = {};
        records.forEach(function (r) {
          var k = r[field];
          if (!out[k]) out[k] = [];
          out[k].push(r);
        });
        return out;
      },

      /* ---------- 持久化 ---------- */
      persist: function () {
        App.storage.setJSON(persistKey, records);
      },

      load: function () {
        var saved = App.storage.getJSON(persistKey, null);
        if (saved && Array.isArray(saved)) {
          records = saved;
          notify('load');
        }
        return api;
      },

      /* ---------- 变更订阅 ---------- */
      onChange: function (fn) {
        if (typeof fn === 'function') listeners.push(fn);
        return function () {                       /* 返回取消订阅函数 */
          var i = listeners.indexOf(fn);
          if (i !== -1) listeners.splice(i, 1);
        };
      }
    };

    return api;
  }

  /* ============================================================
   * 对外
   * ============================================================ */
  App.data = {

    /* 建集合。已存在则返回旧的 */
    create: function (name, options) {
      if (registry[name]) return registry[name];
      registry[name] = makeCollection(name, options);
      return registry[name];
    },

    /* 取集合（不存在返回 null） */
    get: function (name) {
      return registry[name] || null;
    },

    /* 删集合 */
    remove: function (name) {
      delete registry[name];
    },

    /* 列出所有集合名 */
    list: function () {
      return Object.keys(registry);
    },

    /* 全部持久化（一般不用，autoPersist 会自动） */
    persistAll: function () {
      Object.keys(registry).forEach(function (n) {
        registry[n].persist();
      });
    },

    /* 全部从存档恢复 */
    loadAll: function () {
      Object.keys(registry).forEach(function (n) {
        registry[n].load();
      });
    }
  };

})(window.App = window.App || {});