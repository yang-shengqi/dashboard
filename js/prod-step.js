/* ============================================================
 * prod-step.js —— 六步骤条流动线（canvas）
 * ------------------------------------------------------------
 * 本版修改：无（保留原样）
 * ============================================================ */
(function () {
  'use strict';

  var wrap   = document.getElementById('prodStep');
  var canvas = document.getElementById('prodStepCanvas');
  if (!wrap || !canvas) return;

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var items = Array.prototype.slice.call(
    wrap.querySelectorAll('.prod-step__items li')
  );
  var COUNT = items.length;
  if (!COUNT) return;

  var HEIGHT = 45, H_MAX = 35, DOT_R = 8, LINE_W = 4, W_MOD = 0.3;
  var RISE = 1, FALL = 2;
  var FALLBACK = 'rgb(255,255,255)';

  var probe = document.createElement('span');
  probe.style.cssText =
    'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;';
  document.body.appendChild(probe);

  function toRgb(color) {
    if (!color) return null;
    probe.style.color = '';
    probe.style.color = color;
    var out = getComputedStyle(probe).color;
    return /^rgba?\(/.test(out) ? out : null;
  }

  var COLOR = FALLBACK;

  function syncColor() {
    var raw = getComputedStyle(wrap)
      .getPropertyValue('--prod-step-color').trim();
    var rgb = toRgb(raw);
    if (rgb) COLOR = rgb;
  }

  var W = 0, dpr = 0, sections = [], current = -1;
  var rafId = null;
  var inView = true;
  var pageVisible = !document.hidden;

  function easeOutQuad(p) { return 1 - (1 - p) * (1 - p); }

  function buildSections() {
    var sw = W / COUNT;
    sections = items.map(function (_, i) {
      var start = i * sw;
      return {
        start: start,
        end: start + sw,
        width: sw,
        hMod: 0,
        progress: 0,
        dot: { x: start + sw / 2, y: HEIGHT }
      };
    });
  }

  function setup() {
    var cs = getComputedStyle(wrap);
    var padL = parseFloat(cs.paddingLeft) || 0;
    var padR = parseFloat(cs.paddingRight) || 0;
    var nextW = Math.max(320, Math.round(wrap.clientWidth - padL - padR));
    var nextDpr = Math.min(window.devicePixelRatio || 1, 2);

    if (nextW === W && nextDpr === dpr) return;

    W = nextW;
    dpr = nextDpr;

    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(55 * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = '55px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildSections();
  }

  function draw(s) {
    var wMod = s.width * W_MOD;
    var topY = HEIGHT - s.hMod;

    ctx.beginPath();
    ctx.moveTo(s.start, HEIGHT);
    ctx.bezierCurveTo(s.start + wMod, HEIGHT,
                      s.start + wMod, topY,
                      s.start + s.width / 2, topY);
    ctx.bezierCurveTo(s.end - wMod, topY,
                      s.end - wMod, HEIGHT,
                      s.end, HEIGHT);
    ctx.lineWidth   = LINE_W;
    ctx.strokeStyle = COLOR;
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = COLOR;
    ctx.arc(s.dot.x, s.dot.y, DOT_R, 0, Math.PI * 2);
    ctx.fill();
  }

  function update(s, active) {
    s.progress = active
      ? Math.min(s.progress + RISE, H_MAX)
      : Math.max(s.progress - FALL, 0);

    var d = easeOutQuad(s.progress / H_MAX);
    s.hMod  = H_MAX * d;
    s.dot.y = HEIGHT - H_MAX * d;
  }

  function frame() {
    rafId = null;
    if (!inView || !pageVisible) return;

    ctx.clearRect(0, 0, W, 55);

    var animating = false;
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      update(s, i === current);
      if (s.progress > 0 && s.progress < H_MAX) animating = true;
      draw(s);
    }

    if (animating) requestFrame();
  }

  function requestFrame() {
    if (rafId !== null) return;
    if (!inView || !pageVisible) return;
    rafId = requestAnimationFrame(frame);
  }

  function setCurrent(i) {
    if (i === current) return;
    current = i;
    items.forEach(function (li, k) {
      li.classList.toggle('active', k === i);
    });
    requestFrame();
  }

  wrap.addEventListener('mousemove', function (e) {
    var rect = wrap.getBoundingClientRect();
    var sw   = rect.width / COUNT;
    var idx  = Math.floor((e.clientX - rect.left) / sw);
    idx = Math.max(0, Math.min(COUNT - 1, idx));
    setCurrent(idx);
  });

  wrap.addEventListener('mouseleave', function () { setCurrent(-1); });

  function onThemeChange() { syncColor(); requestFrame(); }

  var mo = new MutationObserver(onThemeChange);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-theme', 'data-skin', 'data-mode']
  });
  if (document.body) {
    mo.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-skin', 'data-mode']
    });
  }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', onThemeChange);
    else if (mq.addListener) mq.addListener(onThemeChange);
  }
  var App = window.App;
  if (App && App.events && typeof App.events.on === 'function') {
    App.events.on('themechange', onThemeChange);
    App.events.on('skinchange',  onThemeChange);
  }

  document.addEventListener('visibilitychange', function () {
    pageVisible = !document.hidden;
    if (pageVisible) requestFrame();
  });

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) requestFrame();
    }, { rootMargin: '120px' }).observe(wrap);
  }

  function onResize() { setup(); requestFrame(); }
  if (window.ResizeObserver) {
    new ResizeObserver(onResize).observe(wrap);
  } else {
    window.addEventListener('resize', onResize, { passive: true });
  }

  setup();
  syncColor();
  requestFrame();
})();