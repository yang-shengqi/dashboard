/* ============================================================
 * music-toggle.js —— 顶栏音乐开关
 * 点击：播放 / 暂停；默认循环
 * 记忆上次状态：上次开着 → 本次首次交互后自动续播
 * ============================================================ */
(function () {
  'use strict';

  var KEY = 'bgm-on';

  var btn = document.getElementById('musicBtn');
  var audio = document.getElementById('bgm');
  if (!btn || !audio) return;

  audio.loop = true;
  audio.volume = 0.8;   // 0~1，自己调音量

  function sync() {
    var playing = !audio.paused;
    btn.classList.toggle('playing', playing);
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }

  function save(on) {
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
  }

  function load() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }

  function play() {
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
  }

  /* 记住上次开关状态：默认「开」 */
  var wantPlay = true;
  var saved = localStorage.getItem(KEY);
  if (saved === '0') wantPlay = false;

  btn.addEventListener('click', function () {
    if (audio.paused) {
      play();
      save(true);
    } else {
      audio.pause();
      save(false);
    }
  });

  audio.addEventListener('play',  sync);
  audio.addEventListener('pause', sync);
  audio.addEventListener('ended', sync);

  /* 首次交互后自动播（如果上次是开着的） */
  function firstGesture() {
    if (wantPlay && audio.paused) play();
    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('keydown',     firstGesture);
    window.removeEventListener('touchstart',  firstGesture);
  }
  window.addEventListener('pointerdown', firstGesture, { passive: true });
  window.addEventListener('keydown',     firstGesture, { passive: true });
  window.addEventListener('touchstart',  firstGesture, { passive: true });

  sync();
})();