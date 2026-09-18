/* ============================================================
 * guide-tip.js —— 执行规则提示卡片
 * ------------------------------------------------------------
 * · 弹出时机：首次访问延迟 600ms
 * · 记忆键：localStorage["guide-tip-date-v5"] = "YYYY-M-D"
 * · 勾选 → 写入今日日期 → 当天不再弹，明天照弹
 * · ✕ / 遮罩 / Esc → 只关本次，刷新又弹
 * · 光标感应 → 鼠标在卡片内移动时更新 --mx / --my
 * ============================================================ */
(function () {
  "use strict";

  var KEY = "guide-tip-date-v5";
  var mask = document.getElementById("guideTip");
  var card = document.getElementById("guideTipCard");
  var check = document.getElementById("guideTipCheck");
  if (!mask || !card) return;

  /* ---------- 今日日期字符串 ---------- */
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  /* ---------- 首次判断 ---------- */
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}

  if (saved !== today()) {
    setTimeout(function () {
      requestAnimationFrame(function () { mask.classList.add("on"); });
    }, 600);
  }

  /* ---------- 关闭 ---------- */
  function close() {
    mask.classList.remove("on");
  }

  /* ---------- 勾选 → 写入日期 + 关闭 ---------- */
  if (check) {
    check.addEventListener("change", function () {
      if (check.checked) {
        try { localStorage.setItem(KEY, today()); } catch (e) {}
        setTimeout(close, 180);
      }
    });
  }

  /* ---------- 只关本次的入口 ---------- */
  var btnX = document.getElementById("guideTipX");
  if (btnX) btnX.addEventListener("click", close);

  mask.addEventListener("click", function (e) {
    if (e.target === mask) close();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && mask.classList.contains("on")) close();
  });

  /* ---------- 光标感应 ---------- */
  card.addEventListener("pointermove", function (e) {
    var r = card.getBoundingClientRect();
    var x = ((e.clientX - r.left) / r.width  * 100).toFixed(2) + "%";
    var y = ((e.clientY - r.top ) / r.height * 100).toFixed(2) + "%";
    card.style.setProperty("--mx", x);
    card.style.setProperty("--my", y);
  });
})();