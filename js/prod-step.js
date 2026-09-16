(function () {
  'use strict';

  const wrap   = document.getElementById('prodStep');
  const canvas = document.getElementById('prodStepCanvas');
  if (!wrap || !canvas) return;

  const ctx   = canvas.getContext('2d');
  const items = Array.from(wrap.querySelectorAll('.prod-step__items li'));
  const COUNT = items.length;

  /* ===== 可调参数 ===== */
  const HEIGHT = 45;
  const H_MAX  = 35;
  const DOT_R  = 8;
  const LINE_W = 4;
  const W_MOD  = 0.3;
  const RISE   = 1;
  const FALL   = 2;
  const FALLBACK = 'rgb(255,255,255)';
  /* =================== */

  /* ===== 颜色规范化：把任意格式转成 rgb()，canvas 才吃 ===== */
  const probe = document.createElement('span');
  probe.style.cssText =
    'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;';
  document.body.appendChild(probe);

  function toRgb(color) {
    if (!color) return null;
    probe.style.color = '';
    probe.style.color = color;
    const out = getComputedStyle(probe).color;
    // 设了没生效时会保留上一个值或空，用 rgb 前缀校验
    return /^rgba?\(/.test(out) ? out : null;
  }

  /* ===== 读主题色 ===== */
  let COLOR = FALLBACK;

  function syncColor() {
    const raw = getComputedStyle(wrap)
      .getPropertyValue('--prod-step-color')
      .trim();

    const rgb = toRgb(raw);
    if (rgb && rgb !== COLOR) COLOR = rgb;
  }
  /* =================== */

  let W = 0, dpr = 0, sections = [], current = -1, frame = 0;

  const easeOutQuad = p => 1 - (1 - p) * (1 - p);

  function buildSections() {
    const sw = W / COUNT;
    sections = items.map((_, i) => {
      const start = i * sw;
      return {
        start,
        end: start + sw,
        width: sw,
        hMod: 0,
        progress: 0,
        dot: { x: start + sw / 2, y: HEIGHT }
      };
    });
  }

  function setup() {
    const cs   = getComputedStyle(wrap);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const nextW   = Math.max(320, Math.round(wrap.clientWidth - padL - padR));
    const nextDpr = window.devicePixelRatio || 1;

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
    const wMod = s.width * W_MOD;
    const topY = HEIGHT - s.hMod;

    ctx.beginPath();
    ctx.moveTo(s.start, HEIGHT);
    ctx.bezierCurveTo(s.start + wMod, HEIGHT, s.start + wMod, topY, s.start + s.width / 2, topY);
    ctx.bezierCurveTo(s.end - wMod, topY, s.end - wMod, HEIGHT, s.end, HEIGHT);
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

    const d = easeOutQuad(s.progress / H_MAX);
    s.hMod  = H_MAX * d;
    s.dot.y = HEIGHT - H_MAX * d;
  }

  function loop() {
    // 兜底轮询：每 40 帧查一次，防止漏掉没监听到的变化
    if (frame++ % 40 === 0) syncColor();

    ctx.clearRect(0, 0, W, 55);
    sections.forEach((s, i) => {
      update(s, i === current);
      draw(s);
    });
    requestAnimationFrame(loop);
  }

  function setCurrent(i) {
    if (i === current) return;
    current = i;
    items.forEach((li, k) => li.classList.toggle('active', k === i));
  }

  wrap.addEventListener('mousemove', e => {
    const rect = wrap.getBoundingClientRect();
    const sw   = rect.width / COUNT;
    let idx = Math.floor((e.clientX - rect.left) / sw);
    idx = Math.max(0, Math.min(COUNT - 1, idx));
    setCurrent(idx);
  });

  wrap.addEventListener('mouseleave', () => setCurrent(-1));

  /* ===== 主题变化监听：切皮肤/切明暗时立刻同步 ===== */
  function watchTheme() {
    const mo = new MutationObserver(() => syncColor());

    // 皮肤/主题一般改在这两处的 class 或 data-* 属性上
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

    // 系统明暗切换
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener?.('change', syncColor);
    }
  }
  /* ================================================ */

  setup();
  syncColor();
  watchTheme();
  loop();

  if (window.ResizeObserver) {
    new ResizeObserver(setup).observe(wrap);
  } else {
    window.addEventListener('resize', setup, { passive: true });
  }
})();