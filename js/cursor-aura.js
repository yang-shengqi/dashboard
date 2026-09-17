/* ============================================================
 * cursor-aura.js
 * 星空鼠标跟随粒子 v2
 *   · 颜色：读取 tokens.css 的 --rgb-* 通道，四皮肤自动切换
 *   · 速度：dt 归一化，高刷屏与 60Hz 一致
 *   · 痕迹：destination-out 低透明度擦除，产生彗尾
 *   · 聚焦：柔光晕 + 脉冲光环 + 十字准星
 *   · 状态：悬停可点→十字伸长+偏绿；悬停输入框→I-beam；
 *           点击→沿移动方向拉成椭圆的波
 * ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  canvas.style.pointerEvents = 'none';

  /* ---------- 1. 读取主题色通道 ---------- */
  var CHANNELS = ['--rgb-blue', '--rgb-green', '--rgb-orange',
                  '--rgb-violet', '--rgb-red', '--rgb-gold'];

  var FALLBACK = [
    { r: 10,  g: 132, b: 255 },   // blue   = accent   → coreColor
    { r: 48,  g: 209, b: 88  },   // green  = accent-2 → hotColor
    { r: 255, g: 159, b: 10  },
    { r: 94,  g: 92,  b: 230 },
    { r: 255, g: 69,  b: 58  },
    { r: 212, g: 168, b: 67  }
  ];

  var palette  = FALLBACK.slice();
  var coreColor = FALLBACK[0];     // 主色（蓝）
  var hotColor  = FALLBACK[1];     // 悬停可点时的偏色（绿）

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    var out = [];
    for (var i = 0; i < CHANNELS.length; i++) {
      var v = cs.getPropertyValue(CHANNELS[i]).trim();
      if (!v) continue;
      var p = v.split(/[\s,]+/).map(Number);
      if (p.length >= 3 && !isNaN(p[0]) && !isNaN(p[1]) && !isNaN(p[2])) {
        out.push({ r: p[0] | 0, g: p[1] | 0, b: p[2] | 0 });
      }
    }
    if (out.length) {
      palette   = out;
      coreColor = out[0];
      hotColor  = out[1] || out[0];
    }
  }
  readPalette();

  if (window.MutationObserver) {
    new MutationObserver(readPalette).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-skin']
    });
  }

  function rgba(c, a) {
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  // 颜色插值：c1 → c2，t 从 0 到 1
  function lerpColor(c1, c2, t) {
    return {
      r: Math.round(c1.r + (c2.r - c1.r) * t),
      g: Math.round(c1.g + (c2.g - c1.g) * t),
      b: Math.round(c1.b + (c2.b - c1.b) * t)
    };
  }

  /* ---------- 2. 尺寸 ---------- */
  var W = 0, H = 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    var rect = canvas.getBoundingClientRect();
    W = rect.width  || window.innerWidth;
    H = rect.height || window.innerHeight;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ---------- 3. 鼠标 / 触摸 + 移动方向 ---------- */
  var mouse = { x: 0, y: 0, active: false };

  // 移动方向（单位向量，平滑过）
  var moveDir = { x: 1, y: 0 };
  var lastMX = null, lastMY = null;

  function trackDir(x, y) {
    if (lastMX === null) { lastMX = x; lastMY = y; return; }
    var dx = x - lastMX;
    var dy = y - lastMY;
    lastMX = x; lastMY = y;

    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.5) return;                 // 几乎没动，忽略

    var nx = dx / d, ny = dy / d;
    moveDir.x += (nx - moveDir.x) * 0.15;  // 平滑，避免抖动
    moveDir.y += (ny - moveDir.y) * 0.15;

    var ml = Math.sqrt(moveDir.x * moveDir.x + moveDir.y * moveDir.y);
    if (ml > 0.001) { moveDir.x /= ml; moveDir.y /= ml; }
  }

  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
    trackDir(e.clientX, e.clientY);
  }, { passive: true });

  window.addEventListener('mouseleave', function () {
    mouse.active = false;
    pressingTarget = 0;
  });
  window.addEventListener('mouseenter', function () { mouse.active = true; });

  window.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (!t) return;
    mouse.x = t.clientX;
    mouse.y = t.clientY;
    mouse.active = true;
    trackDir(t.clientX, t.clientY);
  }, { passive: true });

  window.addEventListener('touchend', function () { mouse.active = false; }, { passive: true });

  /* ---------- 3.5 悬停状态（三态） ---------- */
  var CLICKABLE = 'a[href], button, input, select, textarea, label, ' +
                  '[role="button"], .click-text, .col-name, ' +
                  '.exec-acc__q, .totop, .pill, .icon-btn, .skin-item';

  var INPUTLIKE = 'input, textarea, [contenteditable="true"]';

  var hoverState = 'normal';       // 'normal' | 'clickable' | 'input'

  document.addEventListener('mouseover', function (e) {
    var t = e.target;
    if (!t || !t.closest) { hoverState = 'normal'; return; }

    if (t.closest(INPUTLIKE))       hoverState = 'input';
    else if (t.closest(CLICKABLE))  hoverState = 'clickable';
    else                            hoverState = 'normal';
  }, { passive: true });

  /* ---------- 3.6 点击状态 ---------- */
  var clickWave = -1;              // -1 = 无波，>=0 = 波进行中
  var pressing = 0;
  var pressingTarget = 0;

  window.addEventListener('mousedown', function () {
    clickWave = 0;
    pressingTarget = 1;
  });
  window.addEventListener('mouseup', function () {
    pressingTarget = 0;
  });

  /* ---------- 4. 粒子 ---------- */
  var particles = [];
  var MAX            = 460;
  var SPAWN_INTERVAL = 34;
  var spawnTimer = 0;

  function spawn() {
    var a  = Math.random() * Math.PI * 2;
    var sp = Math.random() * 0.85 + 0.18;
    var c  = palette[(Math.random() * palette.length) | 0];
    particles.push({
      x: mouse.x + (Math.random() - 0.5) * 12,
      y: mouse.y + (Math.random() - 0.5) * 12,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: Math.random() * 1.0 + 0.5,
      life: 1,
      color: c
    });
  }

  /* ---------- 5. 聚焦点 ---------- */
  var coreAlpha = 0;
  var elapsed   = 0;
  var hotCross  = 0;
  var ibeam     = 0;

  function drawCore(k, dt) {
    var target = mouse.active ? 1 : 0;
    coreAlpha += (target - coreAlpha) * Math.min(1, 0.12 * k);
    if (coreAlpha < 0.01) return;

    var x = mouse.x, y = mouse.y;
    var a = coreAlpha;

    var isClick = hoverState === 'clickable' ? 1 : 0;
    var isInput = hoverState === 'input'     ? 1 : 0;

    hotCross += (isClick - hotCross) * Math.min(1, 0.18 * k);
    ibeam    += (isInput - ibeam)    * Math.min(1, 0.22 * k);
    pressing += (pressingTarget - pressing) * Math.min(1, 0.30 * k);

    // ① 柔光晕
    var R = 90;
    var g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0,    rgba(coreColor, 0.16 * a));
    g.addColorStop(0.12, rgba(coreColor, 0.10 * a));
    g.addColorStop(0.35, rgba(coreColor, 0.04 * a));
    g.addColorStop(0.70, rgba(coreColor, 0.012 * a));
    g.addColorStop(1,    rgba(coreColor, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();

    // ② 脉冲光环
    var period = 1800;
    var ph = (elapsed % period) / period;
    if (ph < 0.72) {
      var pp = ph / 0.72;
      var rr = 7 + pp * 34;
      ctx.globalAlpha = (1 - pp) * 0.55 * a;
      ctx.strokeStyle = rgba(coreColor, 1);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ★ ③ 点击波：沿移动方向拉成椭圆
    if (clickWave >= 0) {
      clickWave += dt / 520;
      if (clickWave >= 1) {
        clickWave = -1;
      } else {
        var cw = clickWave;
        var wr = 5 + cw * 52;              // 短轴半径
        var stretch = 1 + cw * 0.9;        // 沿移动方向拉长 1 → 1.9
        var ang = Math.atan2(moveDir.y, moveDir.x);

        ctx.globalAlpha = (1 - cw) * (1 - cw) * 0.75 * a;
        ctx.strokeStyle = rgba(coreColor, 1);
        ctx.lineWidth = 2.2 - cw * 1.4;

        ctx.beginPath();
        // ellipse(x, y, 半径X, 半径Y, 旋转角, ...)
        // 半径X = 长轴（沿 ang 方向），半径Y = 短轴
        ctx.ellipse(x, y, wr * stretch, wr, ang, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ④ 呼吸核心（按住时收缩）
    var breathe = 2.6 + Math.sin(elapsed / 380) * 0.7;
    breathe *= (1 - pressing * 0.35);

    var g2 = ctx.createRadialGradient(x, y, 0, x, y, breathe * 3.2);
    g2.addColorStop(0,   rgba(coreColor, 0.95 * a));
    g2.addColorStop(0.5, rgba(coreColor, 0.35 * a));
    g2.addColorStop(1,   rgba(coreColor, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(x, y, breathe * 3.2, 0, Math.PI * 2);
    ctx.fill();

    // ★ ⑤ 十字准星（颜色随 hotCross 从主色偏到 accent-2）
    var crossAlpha = a * (1 - ibeam);
    if (crossAlpha > 0.01) {
      var crossColor = lerpColor(coreColor, hotColor, hotCross);  // ← 颜色插值

      var cross = 8  + hotCross * 7;
      var gap   = 2.5 + hotCross * 1.5;

      ctx.globalAlpha = crossAlpha;
      ctx.strokeStyle = rgba(crossColor, 0.95);
      ctx.lineWidth   = 1.4 + hotCross * 0.5;
      ctx.lineCap     = 'round';

      ctx.beginPath();
      ctx.moveTo(x, y - gap);   ctx.lineTo(x, y - cross);
      ctx.moveTo(x, y + gap);   ctx.lineTo(x, y + cross);
      ctx.moveTo(x - gap, y);   ctx.lineTo(x - cross, y);
      ctx.moveTo(x + gap, y);   ctx.lineTo(x + cross, y);
      ctx.stroke();

      ctx.globalAlpha = crossAlpha * 0.9;
      ctx.fillStyle = rgba(crossColor, 1);
      ctx.beginPath();
      ctx.arc(x, y, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // ⑥ I-beam
    var beamAlpha = a * ibeam;
    if (beamAlpha > 0.01) {
      var bh = 11;
      ctx.globalAlpha = beamAlpha;
      ctx.strokeStyle = rgba(coreColor, 0.95);
      ctx.lineWidth   = 1.4;
      ctx.lineCap     = 'round';

      ctx.beginPath();
      ctx.moveTo(x, y - bh);
      ctx.lineTo(x, y + bh);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x - 3, y - bh); ctx.lineTo(x + 3, y - bh);
      ctx.moveTo(x - 3, y + bh); ctx.lineTo(x + 3, y + bh);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  /* ---------- 6. 主循环 ---------- */
  var last = 0;
  var ERASE = 0.085;

  function loop(t) {
    if (!last) last = t;
    var dt = Math.min(t - last, 50);
    last = t;
    var k = dt / 16.667;
    elapsed += dt;

    var erase = 1 - Math.pow(1 - ERASE, k);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,' + erase + ')';
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';

    if (mouse.active) {
      spawnTimer += dt;
      while (spawnTimer > SPAWN_INTERVAL) {
        spawnTimer -= SPAWN_INTERVAL;
        spawn();
      }
    }

    if (particles.length > MAX) {
      particles.splice(0, particles.length - MAX);
    }

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];

      if (mouse.active) {
        var dx = mouse.x - p.x;
        var dy = mouse.y - p.y;
        var d2 = dx * dx + dy * dy;
        var f = 7 / (d2 + 2200) * k;
        p.vx += dx * f;
        p.vy += dy * f;
      }

      p.x += p.vx * k;
      p.y += p.vy * k;

      var damp = Math.pow(0.991, k);
      p.vx *= damp;
      p.vy *= damp;

      p.life -= 0.0035 * k;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = p.life * 0.85;
      ctx.fillStyle   = rgba(p.color, 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    drawCore(k, dt);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();