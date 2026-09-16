/* ============================================================
 * meteor.js —— 背景流星
 * ------------------------------------------------------------
 * 每隔 0.8~2 秒生成一颗流星，最多同时存在 12 颗。
 * 每颗飞完由 animationend 自动销毁。
 * ============================================================ */
(function () {
  'use strict';

  /* ---- 可调参数 ---- */
  var MIN_GAP        = 800;    // 两颗流星最小间隔（ms）
  var MAX_GAP        = 2000;   // 两颗流星最大间隔（ms）
  var MAX_CONCURRENT = 12;     // 同时存在的上限
  var DUR_MIN        = 10;     // 飞行时长下界（秒）
  var DUR_MAX        = 2.2;    // 飞行时长上界（秒）
  var LEN_MIN        = 10;     // 最短尾巴（px）
  var LEN_MAX        = 30;     // 最长尾巴（px）

  /* ---- 状态 ---- */
  var active = 0;

  function spawn() {
    if (active >= MAX_CONCURRENT || document.hidden) {
      schedule();
      return;
    }

    var el = document.createElement('div');
    el.className = 'meteor';
    el.setAttribute('aria-hidden', 'true');

    var startX = 30 + Math.random() * 80;   // 30% ~ 110% 宽
    var startY = -15 + Math.random() * 45;  // -15% ~ 30% 高
    el.style.left = startX + 'vw';
    el.style.top  = startY + 'vh';

    var len = LEN_MIN + Math.random() * (LEN_MAX - LEN_MIN);
    var dur = DUR_MIN + Math.random() * (DUR_MAX - DUR_MIN);
    el.style.setProperty('--len', len.toFixed(0) + 'px');
    el.style.animationDuration = dur.toFixed(2) + 's';

    document.body.appendChild(el);
    active++;

    el.addEventListener('animationend', function () {
      active--;
      if (el.parentNode) el.parentNode.removeChild(el);
    });

    schedule();
  }

  function schedule() {
    var gap = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
    setTimeout(spawn, gap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
})();