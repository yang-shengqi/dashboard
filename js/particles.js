/* ============================================================
 * 背景粒子星空 · 跟随主题四色
 * 依赖：gsap.min.js（必须先加载）
 * 四色来源：--chart-1 ~ --chart-4（tokens.css）
 * 切换皮肤：监听 data-skin 属性变化 + skinchange 事件
 *
 * 本版修改：
 *   ★ 注释明确 z-index 由 CSS 控制（meteor.css 中 #particleCanvas 为 1）
 *   ★ 探针元素的生命周期说明（长期存在，供颜色解析用）
 *   ★ 其余保持
 * ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('particleCanvas');
  if (!canvas || typeof gsap === 'undefined') return;

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var CONFIG = {
    particleCount: 150,
    speedRange: 0.03
  };

  /* 主题四色（tokens.css 里的 --chart-1 ~ --chart-4） */
  var THEME_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4'];

  /* 读不到变量时的兜底 */
  var FALLBACK = ['#0a84ff', '#30d158', '#ff9f0a', '#5e5ce6'];

  var W = 0, H = 0;
  var particles = [];

  /* ---------- 颜色归一化：把 CSS 变量解析成 rgb(...) ----------
   * 用隐藏探针元素让浏览器自己算完，再读回标准色值。
   * 探针长期存在，仅用于颜色解析，不影响布局。 */
  var probe = document.createElement('div');
  probe.style.display = 'none';
  probe.style.position = 'absolute';
  probe.style.color = 'transparent';
  document.body.appendChild(probe);

  function resolveColor(cssValue) {
    if (!cssValue) return '';
    probe.style.color = 'transparent';
    probe.style.color = cssValue;
    var computed = getComputedStyle(probe).color;
    return computed && computed !== 'rgba(0, 0, 0, 0)' ? computed : '';
  }

  function readThemeColors() {
    var cs = getComputedStyle(document.documentElement);
    var out = [];
    for (var i = 0; i < THEME_VARS.length; i++) {
      var raw = cs.getPropertyValue(THEME_VARS[i]).trim();
      var color = resolveColor('var(' + THEME_VARS[i] + ')');
      if (!color) color = resolveColor(raw);
      out.push(color || FALLBACK[i]);
    }
    return out;
  }

  /* ---------- 画布尺寸 ---------- */
  function resizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createParticles(CONFIG.particleCount);
    assignColors();
  }

  /* ---------- 生成粒子 ---------- */
  function createParticles(count) {
    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        radius: Math.random() * 1.6 + 0.4,
        alpha: Math.random() * 0.55 + 0.12,
        speedX: (Math.random() - 0.5) * CONFIG.speedRange,
        speedY: (Math.random() - 0.5) * CONFIG.speedRange,
        color: FALLBACK[i % FALLBACK.length]
      });
    }
  }

  /* ---------- 把四色轮流分给粒子 ---------- */
  function assignColors() {
    var palette = readThemeColors();
    for (var i = 0; i < particles.length; i++) {
      particles[i].color = palette[i % palette.length];
    }
  }

  /* ---------- 每帧绘制 ---------- */
  function drawParticles(dt) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.speedX * dt;
      p.y += p.speedY * dt;

      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;

      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- GSAP ticker 驱动 ---------- */
  gsap.ticker.add(function (time, deltaTime) {
    var dt = Math.min(deltaTime, 50);
    ctx.clearRect(0, 0, W, H);
    drawParticles(dt);
  });

  /* ---------- 主题/皮肤变化时刷新颜色 ---------- */
  function onThemeChange() {
    requestAnimationFrame(assignColors);
  }

  var App = window.App;
  if (App && App.events && typeof App.events.on === 'function') {
    App.events.on('skinchange', onThemeChange);
    if (App.events.on) App.events.on('themechange', onThemeChange);
    if (App.events.on) App.events.on('langchange', onThemeChange);
  }

  var opts = {
    attributes: true,
    attributeFilter: ['data-skin', 'data-theme', 'class', 'style']
  };
  new MutationObserver(onThemeChange).observe(document.documentElement, opts);

  /* ---------- 窗口尺寸变化 ---------- */
  window.addEventListener('resize', resizeCanvas);

  /* ---------- 启动 ---------- */
  resizeCanvas();
})();