/* ============================================================
 * uptime.js —— 运行天数计时器（起始日 2025-12-01）
 * ------------------------------------------------------------
 * 本版修改：无（保留原样）
 * ============================================================ */
(function () {
  'use strict';

  var START = new Date('2025-12-01T00:00:00+08:00').getTime();
  var d = document.getElementById('uptimeDays');
  if (!d) return;

  var h = document.getElementById('uptimeHours');
  var m = document.getElementById('uptimeMinutes');
  var s = document.getElementById('uptimeSeconds');

  var pad = function (n) { return String(n).padStart(2, '0'); };

  function tick() {
    var diff = Date.now() - START;
    if (diff < 0) diff = 0;
    var totalSec = Math.floor(diff / 1000);
    d.textContent = Math.floor(totalSec / 86400);
    h.textContent = pad(Math.floor((totalSec % 86400) / 3600));
    m.textContent = pad(Math.floor((totalSec % 3600) / 60));
    s.textContent = pad(totalSec % 60);
  }

  tick();
  setInterval(tick, 1000);
})();