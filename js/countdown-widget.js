/* ============================================================
 * countdown-widget.js —— 2035 倒计时自定义元素
 * 颜色走 CSS 变量，自动跟随主题/皮肤
 * 中英文：自己读 App.i18n.lang()，监听 langchange 事件重绘
 * （Shadow DOM 内文字 i18n.js 扫不到，必须组件内部自理）
 * ============================================================ */
(function () {
  'use strict';

  if (customElements.get('countdown-2035')) return;

  /* ---------- 文案表 ---------- */
  var STRINGS = {
    zh: {
      badge:   '⏳ 2025年1月1日起计时',
      sub:     '倒计时只是静态计算，变量会压缩窗口期。',
      days:    '天',
      hours:   '时',
      minutes: '分',
      seconds: '秒',
      elapsed: '已流逝',
      live:    '实时'
    },
    en: {
      badge:   '⏳ Counting from Jan 1, 2025',
      sub:     'The countdown is only a static calculation — variables will compress the window.',
      days:    'Days',
      hours:   'Hours',
      minutes: 'Min',
      seconds: 'Sec',
      elapsed: 'Elapsed',
      live:    'Live'
    }
  };

  /* ---------- 取当前语言 ---------- */
  function getLang() {
    var app = window.App;
    if (app && app.i18n && typeof app.i18n.lang === 'function') {
      var l = app.i18n.lang();
      if (l === 'en' || l === 'zh') return l;
    }
    return 'zh';
  }

  /* ---------- 取词 ---------- */
  function t(lang, key) {
    var pack = STRINGS[lang] || STRINGS.zh;
    return pack[key] != null ? pack[key] : key;
  }

  /* ---------- 日期行（中英结构不同，单独拼） ---------- */
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
      this.start  = new Date('2025-01-01T00:00:00+08:00').getTime();
      this.total  = this.target - this.start;
      this.attachShadow({ mode: 'open' });
      this.timer = null;
      this._offLang = null;
    }

    connectedCallback() {
      this.render();
      this.tick();
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => this.tick(), 1000);
      this._bindLang();
    }

    disconnectedCallback() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      this._unbindLang();
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
          :host-context([data-theme="dark"]) .hero .date .gold { color: var(--gold); }
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
            font-size: 34px; font-weight: 700;
            color: var(--text); line-height: 1.1;
            font-variant-numeric: tabular-nums;
          }
          .item .num.glow { color: var(--accent); }
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
            height: 100%; width: 0%;
            background: linear-gradient(90deg, var(--accent), var(--gold-ink));
            transition: width .6s var(--ease);
          }
          :host-context([data-theme="dark"]) .progress-wrap .bar {
            background: linear-gradient(90deg, var(--accent), var(--gold));
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
        <div class="card" data-lang="${lang}">
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
        this.daysEl.textContent = this.hoursEl.textContent =
        this.minutesEl.textContent = this.secondsEl.textContent = '00';
        this.barEl.style.width = '100%';
        this.percentEl.textContent = '100.00%';
      } else {
        const s = Math.floor(diff / 1000);
        this.daysEl.textContent    = String(Math.floor(s / 86400)).padStart(2, '0');
        this.hoursEl.textContent   = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
        this.minutesEl.textContent = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        this.secondsEl.textContent = String(s % 60).padStart(2, '0');

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