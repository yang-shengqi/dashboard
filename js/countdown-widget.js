/* ============================================================
 * countdown-widget.js —— 2035 倒计时自定义元素
 * ------------------------------------------------------------
 * 本版修改：
 *   ★ 起始日 2025-01-01 → 2025-12-01
 *     （与 uptime.js 的「自 2025-12-01 起运行」一致）
 *   ★ badge 文案同步改为「2025年12月1日起计时」
 *   ★ :host-context([data-theme="dark"]) → :host(.dark)
 *     —— :host-context 在 Safari 不支持，深色下金句/进度条不变色
 *     改为由 JS 监听 <html data-theme> 给 host 加/去 .dark 类
 * ============================================================ */
(function () {
  'use strict';

  if (customElements.get('countdown-2035')) return;

  var STRINGS = {
    zh: {
      badge:   '⏳ 2025年12月1日起计时',
      sub:     '倒计时只是静态计算，变量会压缩窗口期。',
      days:    '天',
      hours:   '时',
      minutes: '分',
      seconds: '秒',
      elapsed: '已流逝',
      live:    '实时'
    },
    en: {
      badge:   '⏳ Counting from Dec 1, 2025',
      sub:     'The countdown is only a static calculation — variables will compress the window.',
      days:    'Days',
      hours:   'Hours',
      minutes: 'Min',
      seconds: 'Sec',
      elapsed: 'Elapsed',
      live:    'Live'
    }
  };

  function getLang() {
    var app = window.App;
    if (app && app.i18n && typeof app.i18n.lang === 'function') {
      var l = app.i18n.lang();
      if (l === 'en' || l === 'zh') return l;
    }
    return 'zh';
  }

  function t(lang, key) {
    var pack = STRINGS[lang] || STRINGS.zh;
    return pack[key] != null ? pack[key] : key;
  }

  function dateLine(lang) {
    if (lang === 'en') {
      return 'Until <span class="gold">Jan 1, 2035</span>';
    }
    return '距离 <span class="gold">2035</span> 年 <span class="gold">1</span> 月 <span class="gold">1</span> 日';
  }

  class Countdown2035 extends HTMLElement {
    constructor() {
      super();
      this.target = new Date('2035-01-01T00:00:00+08:00').getTime();
      /* ★ 起始日与 uptime.js 对齐 */
      this.start  = new Date('2025-12-01T00:00:00+08:00').getTime();
      this.total  = this.target - this.start;
      this.attachShadow({ mode: 'open' });
      this.timer = null;
      this._offLang = null;
      this._themeObserver = null;
    }

    connectedCallback() {
      this.render();
      this.tick();
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => this.tick(), 1000);
      this._bindLang();
      this._trackTheme();
    }

    disconnectedCallback() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      this._unbindLang();
      this._untrackTheme();
    }

    /* ---------- 监听语言切换 ---------- */
    _bindLang() {
      this._unbindLang();
      var app = window.App;
      if (!app || !app.events || typeof app.events.on !== 'function') return;
      var self = this;
      this._offLang = app.events.on('langchange', function () {
        self.render();
        self.tick();
      });
    }

    _unbindLang() {
      if (typeof this._offLang === 'function') {
        try { this._offLang(); } catch (e) { /* ignore */ }
      }
      this._offLang = null;
    }

    /* ---------- ★ 监听 <html data-theme> 给 host 打 .dark 类 ---------- */
    _trackTheme() {
      var self = this;
      function sync() {
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        self.classList.toggle('dark', isDark);
      }
      this._themeSync = sync;
      sync();

      if (window.MutationObserver) {
        this._themeObserver = new MutationObserver(sync);
        this._themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme']
        });
      }
    }

    _untrackTheme() {
      if (this._themeObserver) {
        this._themeObserver.disconnect();
        this._themeObserver = null;
      }
      this._themeSync = null;
    }

    /* ---------- 写数字：值变才更新 + 触发脉冲 ---------- */
    _set(el, value) {
      if (!el) return;
      if (el.textContent === value) return;
      el.textContent = value;
      el.classList.remove('pulse');
      void el.offsetWidth;
      el.classList.add('pulse');
    }

    /* ---------- 渲染 ---------- */
    render() {
      var lang = getLang();

      this.shadowRoot.innerHTML = `
        <style>
          :host { display:block; font-family:var(--font-sans); width:100%; box-sizing:border-box; margin:0; }
          .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--r-lg);
            padding: 30px 36px 34px;
            color: var(--text);
            box-sizing: border-box;
            width: 100%;
            margin-bottom: 16px;
            backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
            -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
            box-shadow: var(--shadow), inset 0 1px 0 var(--glass-hi);
            transition: border-color var(--dur-mid) var(--ease);
          }
          .card:hover { border-color: var(--border-2); }

          .header {
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid var(--border); padding-bottom: 12px;
            margin-bottom: 22px; flex-wrap: wrap; gap: 8px;
          }
          .logo { font-size:17px; font-weight:700; color: var(--text); }
          .logo span { color: var(--accent); }
          .badge {
            font-size:11.5px; color: var(--text-3);
            background: var(--surface-3);
            padding: 2px 12px; border-radius: var(--r-full);
            border: 1px solid var(--border);
          }
          .hero { text-align: center; margin-bottom: 24px; }
          .hero .date { font-size: 26px; font-weight: 700; color: var(--text); }
          .hero .date .gold { color: var(--gold-ink); }
          /* ★ 深色主题由 :host(.dark) 触发（JS 加类），兼容 Safari */
          :host(.dark) .hero .date .gold { color: var(--gold); }
          .hero .sub { font-size: 12.5px; color: var(--text-faint); margin-top: 4px; }

          .grid {
            display: grid; grid-template-columns: repeat(4, 1fr);
            gap: 12px; margin-bottom: 20px;
          }
          .item {
            background: var(--surface-2); border: 1px solid var(--border);
            border-radius: var(--r-sm); padding: 14px 4px 12px; text-align: center;
            transition: border-color var(--dur-mid) var(--ease),
                        transform var(--dur-mid) var(--ease);
          }
          .item:hover { border-color: var(--border-2); transform: translateY(-2px); }

          .item .num {
            display: inline-block;
            font-size: 34px; font-weight: 700;
            color: var(--text); line-height: 1.1;
            font-variant-numeric: tabular-nums;
            transition: color .3s var(--ease);
            will-change: transform, filter;
          }
          .item .num.glow {
            color: var(--accent);
            text-shadow:
              0 0 18px rgb(var(--rgb-blue) / .50),
              0 0 36px rgb(var(--rgb-blue) / .22);
          }
          .item .num.pulse {
            animation: numPulse .55s cubic-bezier(.22,1,.36,1);
          }
          @keyframes numPulse {
            0%   { transform: scale(1);    filter: brightness(1);    }
            30%  { transform: scale(1.14); filter: brightness(1.35); }
            100% { transform: scale(1);    filter: brightness(1);    }
          }
          .item .lbl {
            font-size: 11px; color: var(--text-faint);
            letter-spacing: 1.5px; margin-top: 4px;
            text-transform: uppercase;
          }

          .progress-wrap { margin-bottom: 16px; }
          .progress-wrap .info {
            display: flex; justify-content: space-between;
            font-size: 11.5px; color: var(--text-muted); margin-bottom: 6px;
          }
          .progress-wrap .track {
            width: 100%; height: 4px;
            background: var(--surface-3); border-radius: var(--r-full);
            overflow: hidden; border: 1px solid var(--border);
          }
          .progress-wrap .bar {
            position: relative;
            height: 100%; width: 0%;
            background: linear-gradient(90deg, var(--accent), var(--gold-ink));
            transition: width .6s var(--ease);
            overflow: hidden;
            animation: barBreath 3s ease-in-out infinite;
          }
          /* ★ 深色主题由 :host(.dark) 触发 */
          :host(.dark) .progress-wrap .bar {
            background: linear-gradient(90deg, var(--accent), var(--gold));
          }
          @keyframes barBreath {
            0%, 100% { box-shadow: 0 0 0    rgb(var(--rgb-blue) / 0); }
            50%      { box-shadow: 0 0 12px rgb(var(--rgb-blue) / .55); }
          }
          .progress-wrap .bar::after {
            content: "";
            position: absolute;
            top: 0; bottom: 0; left: 0;
            width: 80%;
            background: linear-gradient(90deg,
              transparent,
              rgba(255, 255, 255, .85) 50%,
              transparent);
            animation: barShine 3.5s linear infinite;
            pointer-events: none;
          }
          @keyframes barShine {
            0%   { transform: translateX(-120%); }
            100% { transform: translateX(320%); }
          }

          .footer {
            display: flex; justify-content: space-between; align-items: center;
            padding-top: 14px; border-top: 1px solid var(--border);
            font-size: 11.5px; color: var(--text-faint);
          }
          .footer .live { display: flex; align-items: center; gap: 6px; color: var(--accent); }
          .footer .dot {
            display: inline-block; width: 6px; height: 6px; border-radius: 50%;
            background: var(--accent); animation: pulse 1.4s ease-in-out infinite;
          }
          @keyframes pulse {
            0%,100% { opacity: 1; transform: scale(1); }
            50%     { opacity: .3; transform: scale(.7); }
          }

          @media (prefers-reduced-motion: reduce) {
            .item .num.pulse,
            .progress-wrap .bar,
            .progress-wrap .bar::after,
            .footer .dot { animation: none !important; }
          }

          @media (max-width: 600px) {
            .card { padding: 22px 16px 26px; }
            .hero .date { font-size: 20px; }
            .grid { gap: 8px; }
            .item .num { font-size: 24px; }
          }
          @media (max-width: 400px) {
            .grid { grid-template-columns: 1fr 1fr; }
          }
        </style>
        <div class="card" data-lang="${lang}" role="group" aria-label="${t(lang, 'badge')}">
          <div class="header">
            <span class="logo">FINAL·<span>DEFENSE</span></span>
            <span class="badge">${t(lang, 'badge')}</span>
          </div>
          <div class="hero">
            <div class="date">${dateLine(lang)}</div>
            <div class="sub">${t(lang, 'sub')}</div>
          </div>
          <div class="grid">
            <div class="item"><div class="num glow" id="days">00</div><div class="lbl">${t(lang, 'days')}</div></div>
            <div class="item"><div class="num" id="hours">00</div><div class="lbl">${t(lang, 'hours')}</div></div>
            <div class="item"><div class="num" id="minutes">00</div><div class="lbl">${t(lang, 'minutes')}</div></div>
            <div class="item"><div class="num" id="seconds">00</div><div class="lbl">${t(lang, 'seconds')}</div></div>
          </div>
          <div class="progress-wrap">
            <div class="info"><span>${t(lang, 'elapsed')}</span><span id="percent">0.00%</span></div>
            <div class="track"><div class="bar" id="bar"></div></div>
          </div>
          <div class="footer">
            <span class="live"><span class="dot"></span> ${t(lang, 'live')}</span>
            <span id="currentTime">--:--:--</span>
          </div>
        </div>`;

      this.daysEl    = this.shadowRoot.getElementById('days');
      this.hoursEl   = this.shadowRoot.getElementById('hours');
      this.minutesEl = this.shadowRoot.getElementById('minutes');
      this.secondsEl = this.shadowRoot.getElementById('seconds');
      this.barEl     = this.shadowRoot.getElementById('bar');
      this.percentEl = this.shadowRoot.getElementById('percent');
      this.timeEl    = this.shadowRoot.getElementById('currentTime');
    }

    /* ---------- 每秒更新 ---------- */
    tick() {
      const now = Date.now();
      const diff = this.target - now;

      if (diff <= 0) {
        this._set(this.daysEl,    '00');
        this._set(this.hoursEl,   '00');
        this._set(this.minutesEl, '00');
        this._set(this.secondsEl, '00');
        this.barEl.style.width = '100%';
        this.percentEl.textContent = '100.00%';
      } else {
        const s = Math.floor(diff / 1000);
        this._set(this.daysEl,    String(Math.floor(s / 86400)).padStart(2, '0'));
        this._set(this.hoursEl,   String(Math.floor((s % 86400) / 3600)).padStart(2, '0'));
        this._set(this.minutesEl, String(Math.floor((s % 3600) / 60)).padStart(2, '0'));
        this._set(this.secondsEl, String(s % 60).padStart(2, '0'));

        const elapsed = Math.max(0, Math.min(now - this.start, this.total));
        const percent = (elapsed / this.total * 100).toFixed(2);
        this.barEl.style.width = percent + '%';
        this.percentEl.textContent = percent + '%';
      }

      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      this.timeEl.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }
  }

  customElements.define('countdown-2035', Countdown2035);
})();