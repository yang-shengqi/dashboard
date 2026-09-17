/* ============================================================
 * exec-acc.js —— 执行规则 · 单开手风琴
 * ============================================================ */
(function () {
  'use strict';
  var acc = document.getElementById('execAcc');
  if (!acc) return;
  var items = [].slice.call(acc.querySelectorAll('.exec-acc__item'));
  if (!items.length) return;

  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function panel(it){ return it.querySelector('.exec-acc__a'); }
  function trigger(it){ return it.querySelector('.exec-acc__q'); }

  function collapse(it){
    var p = panel(it); if (!p) return;
    if (it.classList.contains('on') && p.style.maxHeight === 'none'){
      p.style.maxHeight = p.scrollHeight + 'px';
    }
    it.classList.remove('on');
    trigger(it).setAttribute('aria-expanded','false');
    void p.offsetHeight;
    p.style.maxHeight = '0px';
  }
  function expand(it){
    var p = panel(it); if (!p) return;
    it.classList.add('on');
    trigger(it).setAttribute('aria-expanded','true');
    if (reduce){ p.style.maxHeight = 'none'; return; }
    p.style.maxHeight = p.scrollHeight + 'px';
  }

  items.forEach(function(it){
    var q = trigger(it), p = panel(it);
    if (p) p.style.maxHeight = '0px';
    q.addEventListener('click', function(){
      var wasOn = it.classList.contains('on');
      items.forEach(collapse);
      if (!wasOn) expand(it);
    });
    if (p) p.addEventListener('transitionend', function(e){
      if (e.propertyName !== 'max-height') return;
      if (it.classList.contains('on')) p.style.maxHeight = 'none';
    });
  });

  if (items[0]) requestAnimationFrame(function(){ expand(items[0]); });

  var rt;
  window.addEventListener('resize', function(){
    clearTimeout(rt);
    rt = setTimeout(function(){
      items.forEach(function(it){
        if (it.classList.contains('on')){
          var p = panel(it); if (p) p.style.maxHeight = 'none';
        }
      });
    }, 150);
  });
})();