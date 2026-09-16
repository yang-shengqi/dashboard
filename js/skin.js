/* ============================================================
 * skin.js —— 皮肤切换
 * ------------------------------------------------------------
 * 依赖：core.js / skin-dict.js
 * 对外：App.skin.get() / set('ocean') / list()
 * 事件：切换后派发 skinchange，detail = { skin: 'ocean' }
 * ============================================================ */
(function (App) {
  'use strict';

  var KEY = 'skin';         /* 存档键名：console-skin */
  var FALLBACK = 'default';
  var root = document.documentElement;

  /* ---------- 内部：校验一个 id 是否合法 ---------- */
  function isValid(id) {
    return App.skinDict.some(function (s) { return s.id === id; });
  }

  /* ---------- 内部：取当前皮肤 ---------- */
  function current() {
    var s = App.storage.get(KEY, null);
    return (s && isValid(s)) ? s : FALLBACK;
  }

  /* ---------- 内部：应用 ---------- */
  function apply(id) {
    root.setAttribute('data-skin', id);
    App.events.emit('skinchange', { skin: id });
  }

  /* ---------- 内部：取显示名（跟随语言） ---------- */
  function label(skin) {
    var lang = App.i18n ? App.i18n.lang() : 'zh';
    return (skin.name && skin.name[lang]) || skin.id;
  }

  /* ---------- 内部：渲染菜单 ---------- */
  function renderMenu() {
    var menu = App.$('#skinMenu');
    if (!menu) return;

    var cur = current();

    menu.innerHTML = App.skinDict.map(function (s) {
      var active = s.id === cur ? ' active' : '';
      return '<button class="skin-item' + active + '" data-skin="' + s.id + '" type="button">' +
               '<span class="swatch" data-skin="' + s.id + '"></span>' +
               '<span class="skin-name">' + label(s) + '</span>' +
             '</button>';
    }).join('');

    App.$$('.skin-item', menu).forEach(function (btn) {
      btn.addEventListener('click', function () {
        App.skin.set(btn.getAttribute('data-skin'));
        closeMenu();
      });
    });
  }

  /* ---------- 内部：菜单开关 ---------- */
  function openMenu()  { var m = App.$('#skinMenu'); if (m) m.classList.add('open'); }
  function closeMenu() { var m = App.$('#skinMenu'); if (m) m.classList.remove('open'); }
  function toggleMenu(){ var m = App.$('#skinMenu'); if (m) m.classList.toggle('open'); }

  /* ============================================================
   * 对外 API
   * ============================================================ */
  App.skin = {

    list: function () { return App.skinDict.slice(); },

    get: current,

    set: function (id) {
      if (!isValid(id)) return;
      App.storage.set(KEY, id);
      apply(id);
      renderMenu();
    },

    init: function () {
      apply(current());
      renderMenu();
    }
  };

  /* ---------- 绑定按钮和外部点击 ---------- */
  App.utils.ready(function () {
    var btn = App.$('#skinBtn');
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleMenu();
      });
    }

    document.addEventListener('click', function (e) {
      var picker = App.$('.skin-picker');
      if (picker && !picker.contains(e.target)) closeMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });

    App.skin.init();
  });

  /* ---------- 语言切换时，刷新菜单文字 ---------- */
  App.events.on('langchange', function () {
    renderMenu();
  });

})(window.App = window.App || {});