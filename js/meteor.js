/* ============================================================
 * meteor.js —— 背景星点 + 四色流星（Canvas，自包含）
 * ------------------------------------------------------------
 * 挂载策略：
 *   1) 有 <canvas id="fx">           → 直接用
 *   2) 有 <canvas id="meteorCanvas"> → 用这个
 *   3) 都没有                        → 自己建一个 #fx 挂到 body
 * 因此 HTML 无需任何改动。
 *
 * 特性：
 *   ★ 流星：速度随机 / 大小随机（长度·粗细·头部光晕统一缩放）/ 四色随机
 *   ★ 星点：缓慢呼吸
 *   ★ 系统「减弱动态效果」只降频，不禁掉流星
 *   ★ 颜色解析失败回退 FALLBACK，不变黑隐形
 * ============================================================ */
(function () {
  'use strict';

  if (window.__meteorRunning) return;
  window.__meteorRunning = true;

  /* ---- 找 / 建 canvas ---- */
  var canvas = document.getElementById('fx') ||
               document.getElementById('meteorCanvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'fx';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;left:0;top:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:1;';
    (document.body || document.documentElement).appendChild(canvas);
  } else {
    canvas.style.pointerEvents = 'none';
    var cs0 = getComputedStyle(canvas);
    if (cs0.position === 'static') {
      canvas.style.position = 'fixed';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '1';
    }
  }

  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  /* ============================================================
   * 可调参数
   * ============================================================ */
  var MIN_GAP        = 220;    // 两颗流星最小间隔（ms）—— 越小越密
  var MAX_GAP        = 780;    // 最大间隔
  var MAX_CONCURRENT = 14;     // 同屏上限
  var SPEED_MIN      = 4;      // 速度下界
  var SPEED_MAX      = 8;     // 速度上界
  var LEN_MIN        = 160;    // 尾巴最短
  var LEN_MAX        = 400;    // 尾巴最长
  var SCALE_MIN      = 0.25;   // 大小缩放下界（越小越迷你）
  var SCALE_MAX      = 1;    // 大小缩放上界（越大越粗壮）

  /* ---- 四色来源：主题变量名不同就改这一行 ---- */
  var COLOR_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4'];
  var FALLBACK   = ['#60a5fa', '#34d399', '#a78bfa', '#fbbf24'];

  /* ============================================================
   * 状态
   * ============================================================ */
  var W = 0, H = 0, DPR = 1;
  var stars = [], meteors = [];
  var palette = [];
  var rafId = null;
  var last = performance.now();
  var lastSpawn = 0, gap = MIN_GAP;

  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
   * 任意 CSS 颜色 → RGB（带哨兵回退）
   * ============================================================ */
  var SENTINEL = '#010203';
  var _cvs = null, _cx = null;
  function toRGB(str, fb) {
    if (!_cvs) {
      _cvs = document.createElement('canvas');
      _cvs.width = _cvs.height = 1;
      _cx = _cvs.getContext('2d');
    }
    _cx.fillStyle = SENTINEL;
    _cx.fillStyle = str;
    if (_cx.fillStyle === SENTINEL || _cx.fillStyle === 'rgb(1, 2, 3)') {
      _cx.fillStyle = fb;
    }
    _cx.fillRect(0, 0, 1, 1);
    var d = _cx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    palette = COLOR_VARS.map(function (name, i) {
      var v = cs.getPropertyValue(name).trim();
      return toRGB(v || FALLBACK[i], FALLBACK[i]);
    });
  }

  /* ============================================================
   * 尺寸
   * ============================================================ */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildStars();
    readPalette();
  }

  /* ---- 星点 ---- */
  function buildStars() {
    var count = Math.round((W * H) / 18000);
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.0 + 0.25,
        base: Math.random() * 0.40 + 0.10,
        tw: Math.random() * Math.PI * 2,
        sp: Math.random() * 0.01 + 0.003
      });
    }
  }

  function starColor() {
    return document.documentElement.getAttribute('data-theme') === 'light'
      ? '20,32,55' : '255,255,255';
  }

  /* ============================================================
   * 生成一颗流星
   *   速度随机 / 大小随机（scale 统一缩放）/ 颜色四选一
   * ============================================================ */
  function spawn() {
    if (meteors.length >= MAX_CONCURRENT || !palette.length) return;

    /* 速度随机 */
    var speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);

    /* 大小随机：一个系数带动长度 / 粗细 / 头部光晕 */
    var scale = SCALE_MIN + Math.random() * (SCALE_MAX - SCALE_MIN);

    meteors.push({
      x: W * (0.30 + Math.random() * 0.90),
      y: -70 - Math.random() * H * 0.25,
      vx: -speed,
      vy: speed * (0.58 + Math.random() * 0.24),

      len:   (LEN_MIN + Math.random() * (LEN_MAX - LEN_MIN)) * scale,
      width: (1.2 + Math.random() * 1.0) * scale,
      headR: 9 * scale,                       // 头部光晕半径

      life: 1,
      decay: 0.0012 + Math.random() * 0.0010, // 存活时长随机
      ci: Math.floor(Math.random() * palette.length)   // 颜色四选一
    });
  }

  function schedule(now) {
    if (now - lastSpawn >= gap) {
      spawn();
      lastSpawn = now;
      gap = REDUCED
        ? (MIN_GAP * 3 + Math.random() * (MAX_GAP - MIN_GAP) * 3)
        : (MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP));
    }
  }

  /* ============================================================
   * 主循环
   * ============================================================ */
  function frame(now) {
    rafId = requestAnimationFrame(frame);
    var dt = Math.min(now - last, 48);
    last = now;
    var k = dt / 16.67;

    ctx.clearRect(0, 0, W, H);

    /* 星点 */
    var srgb = starColor();
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.tw += s.sp * k;
      var a = s.base + Math.sin(s.tw) * 0.26;
      if (a <= 0.02) continue;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 6.2832);
      ctx.fillStyle = 'rgba(' + srgb + ',' + a.toFixed(3) + ')';
      ctx.fill();
    }

    /* 生成流星 */
    schedule(now);

    /* 绘制流星 */
    for (var j = meteors.length - 1; j >= 0; j--) {
      var m = meteors[j];
      m.x += m.vx * k;
      m.y += m.vy * k;
      m.life -= m.decay * k;

      if (m.life <= 0 || m.y > H + 200 || m.x < -400) {
        meteors.splice(j, 1);
        continue;
      }

      var c = palette[m.ci] || palette[0];
      var rgb = c.r + ',' + c.g + ',' + c.b;
      var al = m.life;

      var hyp = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || 1;
      var tailX = m.x - m.vx / hyp * m.len;
      var tailY = m.y - m.vy / hyp * m.len;

      /* 拖尾：本色高亮 → 本色淡出 */
      var g = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      g.addColorStop(0,    'rgba(' + rgb + ',' + (al * 0.98).toFixed(3) + ')');
      g.addColorStop(0.18, 'rgba(' + rgb + ',' + (al * 0.55).toFixed(3) + ')');
      g.addColorStop(0.55, 'rgba(' + rgb + ',' + (al * 0.16).toFixed(3) + ')');
      g.addColorStop(1,    'rgba(' + rgb + ',0)');

      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.strokeStyle = g;
      ctx.lineWidth = m.width;
      ctx.lineCap = 'round';
      ctx.stroke();

      /* 头部：白核 + 本色外圈，半径随大小变 */
      var hR = m.headR || 14;
      var hg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, hR);
      hg.addColorStop(0,    'rgba(255,255,255,' + (al * 0.9).toFixed(3) + ')');
      hg.addColorStop(0.35, 'rgba(' + rgb + ',' + (al * 0.55).toFixed(3) + ')');
      hg.addColorStop(1,    'rgba(' + rgb + ',0)');
      ctx.beginPath();
      ctx.arc(m.x, m.y, hR, 0, 6.2832);
      ctx.fillStyle = hg;
      ctx.fill();
    }
  }

  /* ============================================================
   * 事件绑定
   * ============================================================ */
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', resize, { passive: true });

  /* 切主题 / 切皮肤时重读四色 */
  if (window.MutationObserver) {
    new MutationObserver(readPalette).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-skin', 'class']
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    } else {
      last = performance.now();
      if (rafId === null) rafId = requestAnimationFrame(frame);
    }
  });

  /* ============================================================
   * 启动
   * ============================================================ */
  resize();
  lastSpawn = performance.now();
  rafId = requestAnimationFrame(frame);

  window.__refreshStars = readPalette;   // 兼容主题脚本的调用
})();
