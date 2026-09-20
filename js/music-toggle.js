/* ============================================================
 * music-toggle.js —— 顶栏音乐开关（12 首随机 · 快捷键版）
 * ------------------------------------------------------------
 * 本版修改：
 *   ★ 存储键统一走 App.storage（自动加 console- 前缀）
 *   ★ 旧裸 key 'bgm-on' 首次读取时自动迁移，不丢用户设置
 *   ★ 键盘快捷键（← 上一首 / → 下一首 / M 播放暂停）保留
 * ============================================================ */
(function () {
  'use strict';

  var KEY = 'bgm-on';

  /* ★ 迁移旧裸 key → console-bgm-on */
  (function migrate() {
    try {
      if (!window.App || !App.storage) return;
      var oldVal = App.storage.rawGet(KEY, null);
      var newVal = App.storage.get(KEY, null);
      if (oldVal !== null && newVal === null) {
        App.storage.set(KEY, oldVal);
        try { localStorage.removeItem(KEY); } catch (e) {}
      }
    } catch (e) {}
  })();

  function storeGet(key, fallback) {
    if (window.App && App.storage) return App.storage.get(key, fallback);
    try { return localStorage.getItem('console-' + key) || fallback; }
    catch (e) { return fallback; }
  }
  function storeSet(key, val) {
    if (window.App && App.storage) { App.storage.set(key, val); return; }
    try { localStorage.setItem('console-' + key, val); } catch (e) {}
  }

  var LIST = [
    'music/bgm01.mp3',
    'music/bgm02.mp3',
    'music/bgm03.mp3',
    'music/bgm04.mp3',
    'music/bgm05.mp3',
    'music/bgm06.mp3',
    'music/bgm07.mp3',
    'music/bgm08.mp3',
    'music/bgm09.mp3',
    'music/bgm10.mp3',
    'music/bgm11.mp3',
    'music/bgm12.mp3'
  ];

  var btn   = document.getElementById('musicBtn');
  var audio = document.getElementById('bgm');
  if (!btn || !audio) return;

  audio.removeAttribute('src');
  audio.loop    = false;
  audio.volume  = 0.8;
  audio.preload = 'none';

  var idx = 0;

  function sync() {
    var playing = !audio.paused && !audio.ended;
    btn.classList.toggle('playing', playing);
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }

  function save(on) {
    storeSet(KEY, on ? '1' : '0');
  }

  function loadTrack(i) {
    idx = i;
    audio.src = LIST[i];
    audio.load();
  }

  function play() {
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
  }

  function switchTo(i) {
    var wasPlaying = !audio.paused;
    loadTrack(i);
    if (wasPlaying) play();
  }

  audio.addEventListener('ended', function () {
    var next;
    do {
      next = Math.floor(Math.random() * LIST.length);
    } while (LIST.length > 1 && next === idx);
    loadTrack(next);
    play();
  });

  audio.addEventListener('play',    sync);
  audio.addEventListener('pause',   sync);
  audio.addEventListener('playing', sync);

  btn.addEventListener('click', function () {
    if (audio.paused) {
      play();
      save(true);
    } else {
      audio.pause();
      save(false);
    }
  });

  var wantPlay = true;
  if (storeGet(KEY, '1') === '0') wantPlay = false;

  loadTrack(0);
  audio.pause();

  function firstGesture(e) {
    if (e && e.target && btn.contains(e.target)) return;

    if (wantPlay && audio.paused) play();

    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('keydown',     firstGesture);
    window.removeEventListener('touchstart',  firstGesture);
  }

  window.addEventListener('pointerdown', firstGesture, { passive: true });
  window.addEventListener('keydown',     firstGesture, { passive: true });
  window.addEventListener('touchstart',  firstGesture, { passive: true });

  /* ===== 键盘快捷键：← 上一首，→ 下一首，M 播放/暂停 ===== */
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      switchTo((idx + 1) % LIST.length);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      switchTo((idx - 1 + LIST.length) % LIST.length);
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      if (audio.paused) { play(); save(true); }
      else              { audio.pause(); save(false); }
    }
  });

  sync();
})();