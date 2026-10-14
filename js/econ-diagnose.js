/* ============================================================
 * econ-diagnose.js —— 经济数据趋势 + 真实性检验 v5.1
 *
 *  v5.1 改动：
 *   - 新增 03 数据总览（风险环+滑块 / 矛盾+协同环 / 四维半圆）
 *   - 原 03-06 顺延为 04-07
 * ============================================================ */
(function () {
'use strict';

function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function isNum(v){ return v!==null && v!==undefined && v!=='' && !isNaN(v); }
function fmt(v,d){ d=(d==null)?1:d; return isNum(v)?Number(v).toFixed(d):'—'; }
function clamp(v,lo,hi){ return Math.max(lo, Math.min(hi, v)); }
function mean(a){ return a.length? a.reduce(function(s,x){return s+x;},0)/a.length : NaN; }
function stdev(a){ if(a.length<2) return 0; var m=mean(a);
  return Math.sqrt(a.reduce(function(s,x){ return s+(x-m)*(x-m); },0)/(a.length-1)); }

var LS_KEY = 'econ_v4_data';

/* ============================================================
 * 徽章 / 吐司
 * ============================================================ */
var badgeTipEl = null;
function badge(text){
  if(!text) return '';
  return '<span class="info-badge" data-tip="'+esc(text)+'" tabindex="0" role="button" aria-label="说明">?</span>';
}
function closestBadge(t){
  while(t && t !== document){
    if(t.classList && t.classList.contains('info-badge')) return t;
    t = t.parentNode;
  }
  return null;
}
function showBadgeTip(el){
  var text = el.getAttribute('data-tip');
  if(!text) return;
  if(!badgeTipEl) badgeTipEl = document.getElementById('badgeTip');
  if(!badgeTipEl) return;
  badgeTipEl.textContent = text;
  badgeTipEl.classList.add('show');
  var r = el.getBoundingClientRect();
  var tw = badgeTipEl.offsetWidth, th = badgeTipEl.offsetHeight;
  var left = r.left + r.width/2 - tw/2;
  var top = r.top - th - 10;
  if(left < 8) left = 8;
  if(left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
  if(top < 8) top = r.bottom + 10;
  badgeTipEl.style.left = left + 'px';
  badgeTipEl.style.top  = top + 'px';
}
function hideBadgeTip(){
  if(badgeTipEl) badgeTipEl.classList.remove('show');
}

var toastEl = null, toastTimer = null;
function showToast(msg){
  if(!toastEl) toastEl = document.getElementById('toast');
  if(!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 2200);
}

/* ============================================================
 * 指标解释文案（徽章悬停内容）
 * ============================================================ */
var TIPS = {
  pmi: '采购经理指数，对企业采购经理的月度调查。50 是荣枯线：高于 50 说明多数企业认为生意在扩张，低于 50 说明在收缩。',
  gdp: '国内生产总值比去年同期增长了多少，衡量整体经济增速最常用的指标。',
  ppi: '工业生产者出厂价格指数。反映工厂出厂的东西涨价还是降价，PPI 为负说明工业品在降价。',
  cpi: '居民消费价格指数。反映老百姓买东西涨价还是降价，通常用来衡量通货膨胀。',
  m1m2: '狭义货币与广义货币增速之差。正值说明企业愿意把钱拿出来用（活期），负值说明企业把钱存成定期、不愿投资。',
  tax: '税收收入今年以来累计比去年同期增长多少。税收增长通常应与经济增长同步，长期背离值得警惕。',
  retail: '社会消费品零售总额同比增速。反映居民消费的冷热。',
  m2: '广义货币供应量同比增速。反映市场上钱的总量增长快慢。',
  power: '全国发电量比去年同期增长多少。发电量很难造假，是检验经济增长真实性的硬指标之一。',
  freight: '全国铁路货运量比去年同期增长多少。货物运得多说明经济活跃，也是难以修饰的实物指标。',
  cement: '全国水泥产量比去年同期增长多少。水泥用于基建和房地产，产量能反映真实建设活动。',
  conflict_trend: '把各项矛盾检验的结果合成一个 0–100 的分数，分数越高说明数据内部矛盾越多、越不可信。',
  anchor_trend: '官方 GDP 增速减去实物量增速（发电/货运/水泥）。长期为正且较大，说明 GDP 可能虚高。',
  anchor: '用发电量、铁路货运量、水泥产量这些"做不了假"的实物指标，对照官方 GDP 增速是否可信。',
  kq: '克强指数 = 0.4×发电量 + 0.25×铁路货运 + 0.35×中长期贷款。用它和官方 GDP 对照，看是否吻合。',
  tax_elast: '税收增速 ÷ 名义 GDP 增速。正常情况下两者应接近（弹性约 1），长期偏离说明产出可能被高估。',
  def: '名义 GDP 与实际 GDP 之差即"隐含平减指数"，应与 PPI/CPI 加权结果一致。不一致说明数据口径有问题。',
  ic: '固定资产投资增速与社会消费品零售增速的差。差值过大说明投资数据可能虚报（投资是地方虚报高发区）。',
  mm: 'M2 增速与名义 GDP 增速的差。钱印了很多但经济没起来（差值大），说明货币没流到实体经济。',
  dim_pmi: '来自 PMI。衡量企业对当前经营环境的整体感受，是最直接的景气信号。',
  dim_gdp: '来自 GDP 同比。不只看增速高低，也看它是否处在健康区间。',
  dim_ppi_cpi: '来自 PPI-CPI 剪刀差。看利润在上游（工厂）和下游（消费端）之间怎么分，剪刀差越大越失衡。',
  dim_m1m2: '来自 M1-M2 剪刀差。看企业愿不愿意动用资金，是经济活力的先行信号。'
};

/* ============================================================
 * 字段定义
 * ============================================================ */
var MAIN = [
  {k:'pmi', n:'PMI', good:'up', unit:''},
  {k:'gdp', n:'GDP同比', good:'up', unit:'%'},
  {k:'ppi', n:'PPI同比', good:null, unit:'%'},
  {k:'cpi', n:'CPI同比', good:null, unit:'%'}
];
var OTHER = [
  {k:'m1m2', n:'M1-M2剪刀差', good:'up', unit:'pp'},
  {k:'tax', n:'税收累计同比', good:'up', unit:'%'},
  {k:'retail', n:'社零同比', good:'up', unit:'%'},
  {k:'fai', n:'固投同比', good:'up', unit:'%'},
  {k:'m2', n:'M2同比', good:null, unit:'%'},
  {k:'export', n:'出口同比', good:'up', unit:'%'}
];
var FISCAL = [
  {k:'fiscal_rev', n:'财政收入同比', good:null, unit:'%'},
  {k:'fiscal_exp', n:'财政支出同比', good:null, unit:'%'}
];
var ANCHOR = [
  {k:'power', n:'发电量同比', good:'up', unit:'%'},
  {k:'freight', n:'铁路货运量同比', good:'up', unit:'%'},
  {k:'cement', n:'水泥产量同比', good:'up', unit:'%'}
];
var ALL = MAIN.concat(OTHER, ANCHOR, FISCAL, [
  {k:'nom', n:'名义GDP同比', good:null, unit:'%'},
  {k:'ppi_cpi', n:'PPI-CPI', good:null, unit:'pp'},
  {k:'elec', n:'工业用电量同比', good:'up', unit:'%'},
  {k:'loan', n:'中长期贷款同比', good:'up', unit:'%'}
]);

[MAIN, OTHER, ANCHOR, FISCAL].forEach(function(group){
  group.forEach(function(d){
    if(TIPS[d.k]) d.tip = TIPS[d.k];
  });
});

var HDR = {
  pmi:/pmi/i, gdp:/gdp|国内生产总值/i, nom:/名义|nominal/i,
  m1m2:/m1\s*[-–—]\s*m2|m1m2/i,
  ppi_cpi:/ppi\s*[-–—]\s*cpi|cpi\s*[-–—]\s*ppi/i,
  fiscal_rev:/财政收入|财政预算收入/i,
  fiscal_exp:/财政支出|财政预算支出/i,
  power:/发电/i,
  elec:/用电|电力消费/i,
  freight:/货运|铁路/i,
  cement:/水泥/i,
  tax:/税收|财政/i,
  loan:/中长期贷款/i,
  m2:/^m2|货币供应/i,
  retail:/社零|社会消费品|零售/i,
  fai:/固投|固定资产投资/i,
  export:/出口|进出口/i,
  ppi:/ppi/i,
  cpi:/cpi/i
};

function fieldOf(h){
  var s = String(h||'').trim();
  if(!s) return null;
  if(/时间|月份|日期|^date$|^month$|季度/i.test(s)) return 'time';
  var order = ['nom','m1m2','ppi_cpi','fiscal_rev','fiscal_exp','power','elec','freight','cement','tax','loan',
  'm2','retail','fai','export','pmi','gdp','ppi','cpi'];
  for(var i=0;i<order.length;i++){
    var k = order[i];
    if(HDR[k] && HDR[k].test(s)) return k;
  }
  return null;
}
function mapCols(cells){
  var m={}, used={};
  cells.forEach(function(h,i){
    var f = fieldOf(h);
    if(f && !used[f]){ m[i]=f; used[f]=1; }
  });
  return m;
}

/* ============================================================
 * 解析
 * ============================================================ */
function detectSep(lines){
  var t=0,c=0,p=0;
  lines.slice(0,6).forEach(function(l){
    t+=(l.match(/\t/g)||[]).length;
    c+=(l.match(/,/g)||[]).length;
    p+=(l.match(/\|/g)||[]).length;
  });
  if(t>=c && t>=p && t>0) return '\t';
  if(p>=c && p>0) return '|';
  return ',';
}
function splitRow(line, sep){
  if(sep==='\t') return line.split('\t').map(function(x){ return x.trim(); });
  if(sep==='|'){
    var s = line.trim();
    if(s.charAt(0)==='|') s = s.slice(1);
    if(s.charAt(s.length-1)==='|') s = s.slice(0,-1);
    return s.split('|').map(function(x){ return x.trim(); });
  }
  var out=[], cur='', q=false;
  for(var i=0;i<line.length;i++){
    var ch = line[i];
    if(ch==='"'){ q=!q; continue; }
    if(ch===',' && !q){ out.push(cur); cur=''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(function(x){ return x.trim(); });
}

function normTime(s){
  if(s==null) return '';
  if(typeof s === 'number' && s > 20000 && s < 80000){
    var d = new Date((s - 25569) * 86400000);
    if(!isNaN(d.getTime()))
      return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
  }
  var str = String(s).trim();
  var m2 = str.match(/^(\d{4})[-\/.](\d{1,2})/);
  if(m2) return m2[1]+'-'+String(m2[2]).padStart(2,'0');
  var m3 = str.match(/(\d{4})\s*年\s*(\d{1,2})/);
  if(m3) return m3[1]+'-'+String(m3[2]).padStart(2,'0');
  var m4 = str.match(/^(\d{4})(\d{2})$/);
  if(m4) return m4[1]+'-'+m4[2];
  return '';
}

function parse(text){
  var lines = text.split(/\r?\n/).filter(function(l){ return l.trim()!==''; });
  if(lines.length < 2) throw new Error('没有数据行');
  var sep = detectSep(lines);
  var hi=0, hm={}, hc=0;
  for(var i=0;i<Math.min(lines.length,6);i++){
    var m = mapCols(splitRow(lines[i], sep));
    var c = Object.keys(m).length;
    if(c > hc){ hi=i; hm=m; hc=c; }
  }
  if(hc < 2) throw new Error('表头识别失败：没找到「时间/PMI/GDP」等关键词');

  var rows=[], skip=0;
  for(var j=hi+1;j<lines.length;j++){
    var cs = splitRow(lines[j], sep);
    if(cs.every(function(c){ return c===''; })) continue;
    var r = {time:''};
    ALL.forEach(function(d){ r[d.k] = null; });
    Object.keys(hm).forEach(function(k){
      var idx = Number(k), f = hm[k], raw = cs[idx];
      if(raw===undefined||raw===''||raw==='—'||raw==='-'||raw==='/') return;
      if(f==='time'){ r.time = normTime(raw); return; }
      var v = parseFloat(String(raw).replace(/[%（）(),]/g,''));
      if(!isNaN(v)) r[f] = v;
    });
    if(r.time) rows.push(r); else skip++;
  }
  if(!rows.length) throw new Error('没有有效数据行');
  rows.sort(function(a,b){ return a.time < b.time ? -1 : 1; });
  rows.forEach(function(r){
    if(!isNum(r.ppi_cpi) && isNum(r.ppi) && isNum(r.cpi))
      r.ppi_cpi = +(r.ppi - r.cpi).toFixed(1);
  });
  return {rows:rows, skip:skip};
}

/* ============================================================
 * 状态
 * ============================================================ */
var DATA=[], YEAR='auto', YPAGE=0, YPER=5;

function save(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(DATA)); }catch(e){} }
function load(){ try{ return JSON.parse(localStorage.getItem(LS_KEY))||[]; }catch(e){ return []; } }

var RANGE = 'all';
var RANGES = [
  {k:'1y',  n:'近1年', years:1},
  {k:'3y',  n:'近3年', years:3},
  {k:'5y',  n:'近5年', years:5},
  {k:'all', n:'全部', years:null}
];
function rangeRows(rows){
  var def = RANGES.filter(function(r){ return r.k===RANGE; })[0];
  if(!def || !def.years) return rows;
  if(!rows.length) return rows;
  var lastT = rows[rows.length-1].time;
  var lastY = parseInt(lastT.slice(0,4),10);
  var minY  = lastY - def.years + 1;
  return rows.filter(function(r){
    return parseInt(r.time.slice(0,4),10) >= minY;
  });
}

/* ============================================================
 * 数据表
 * ============================================================ */
function latestYear(){
  var y = '';
  DATA.forEach(function(r){ var t=r.time.slice(0,4); if(t>y) y=t; });
  return y || 'all';
}
function renderTable(){
  var cols = MAIN.concat(OTHER, ANCHOR);
  $('#tbl thead').innerHTML = '<tr><th>时间</th>' + cols.map(function(d){
    return '<th>'+esc(d.n)+(d.unit?'('+d.unit+')':'')+'</th>';
  }).join('') + '</tr>';

  if(!DATA.length){
    $('#tbl tbody').innerHTML = '<tr><td colspan="'+(cols.length+1)+'" class="na" '
      + 'style="text-align:center;padding:30px;">暂无数据</td></tr>';
    $('#ytabs').innerHTML = '';
    return;
  }
  if(YEAR === 'auto') YEAR = latestYear();
  var list = YEAR==='all' ? DATA : DATA.filter(function(r){ return r.time.slice(0,4)===YEAR; });
  $('#tbl tbody').innerHTML = list.slice().reverse().map(function(r){
    return '<tr><td>'+esc(r.time)+'</td>' + cols.map(function(d){
      return isNum(r[d.k]) ? '<td>'+fmt(r[d.k])+'</td>' : '<td class="na">—</td>';
    }).join('') + '</tr>';
  }).join('');
  renderYTabs();
}
function renderYTabs(){
  var box = $('#ytabs');
  var ys={}, list=[];
  DATA.forEach(function(r){ var y=r.time.slice(0,4); if(!ys[y]){ ys[y]=1; list.push(y); } });
  list.sort().reverse();
  if(list.length<=1){ box.innerHTML=''; return; }
  var cnt = {};
  list.forEach(function(y){ cnt[y]=DATA.filter(function(r){return r.time.slice(0,4)===y;}).length; });
  var pages = Math.ceil(list.length/YPER);
  YPAGE = clamp(YPAGE, 0, pages-1);
  var page = list.slice(YPAGE*YPER, YPAGE*YPER+YPER);
  box.innerHTML =
    '<button class="year-tab year-nav-btn" data-nav="p"'+(YPAGE<=0?' disabled':'')+' aria-label="上一组">‹</button>'
    + '<button class="year-tab '+(YEAR==='all'?'active':'')+'" data-y="all">全部('+DATA.length+')</button>'
    + page.map(function(y){
        return '<button class="year-tab '+(YEAR===y?'active':'')+'" data-y="'+y+'">'+y+'('+cnt[y]+')</button>';
      }).join('')
    + '<button class="year-tab year-nav-btn" data-nav="n"'+(YPAGE>=pages-1?' disabled':'')+' aria-label="下一组">›</button>';

  $$('.year-tab', box).forEach(function(b){
    b.addEventListener('click', function(){
      var nav = b.getAttribute('data-nav');
      if(nav==='p'){ if(YPAGE>0){ YPAGE--; renderYTabs(); } return; }
      if(nav==='n'){ if(YPAGE<pages-1){ YPAGE++; renderYTabs(); } return; }
      var y = b.getAttribute('data-y');
      if(y){ YEAR=y; renderTable(); }
    });
  });
}

/* ============================================================
 * 趋势卡
 * ============================================================ */
function deltaClass(good, diff){
  if(diff===0 || diff===null) return 'fl';
  if(!good) return 'fl';
  if(good==='up') return diff>0?'up':'dn';
  if(good==='down') return diff<0?'up':'dn';
  return 'fl';
}

var trendTipEl = null;
function getTrendTip(){
  if(!trendTipEl) trendTipEl = document.getElementById('tooltip');
  return trendTipEl;
}
function bindTrendHover(container){
  var tip = getTrendTip();
  if(!tip) return;
  var root = container || document;

  $$('.chart-card, .big', root).forEach(function(card){
    if(card.__hoverBound) return;
    var svg = card.querySelector('svg');
    if(!svg) return;
    var dots = $$('circle[data-time]', svg);
    if(dots.length < 1) return;
    card.__hoverBound = true;

    var vb = (svg.getAttribute('viewBox')||'0 0 700 200').split(/\s+/).map(Number);
    var vbW = vb[2] || 700;
    var pts = dots.map(function(d){
      return {
        el: d,
        cx: parseFloat(d.getAttribute('cx')),
        time: d.getAttribute('data-time')||'',
        val: d.getAttribute('data-val')||'',
        label: d.getAttribute('data-label')||'',
        unit: d.getAttribute('data-unit')||''
      };
    });

    var hide = function(){
      tip.classList.remove('show');
      card.classList.remove('is-hovering');
    };

    card.addEventListener('mousemove', function(e){
      var rect = svg.getBoundingClientRect();
      if(!rect.width) return;
      var mx = (e.clientX - rect.left) / rect.width * vbW;
      var best = null, bestD = Infinity;
      for(var i=0;i<pts.length;i++){
        var dd = Math.abs(pts[i].cx - mx);
        if(dd < bestD){ bestD = dd; best = pts[i]; }
      }
      if(!best){ hide(); return; }

      var label = best.label.replace(/\s*%\s*$/,'');
      var num = Number(best.val);
      var valStr = isNaN(num) ? best.val : num.toFixed(1);
      var unit = best.unit || '';

      tip.innerHTML = '<b>'+esc(best.time)+'</b> · '+esc(label)+'：'+valStr+unit;
      tip.classList.add('show');
      card.classList.add('is-hovering');

      var tw = tip.offsetWidth;
      var left = e.clientX + 14;
      if(left + tw > window.innerWidth - 8) left = e.clientX - tw - 14;
      if(left < 8) left = 8;
      var top = e.clientY - 34;
      if(top < 8) top = e.clientY + 20;
      tip.style.left = left + 'px';
      tip.style.top  = top + 'px';
    });

    card.addEventListener('mouseleave', hide);
    card.addEventListener('blur', hide);
  });
}

function renderTrendCard(def, rows, container){
  var pts = rows.filter(function(r){ return isNum(r[def.k]); })
    .map(function(r){ return {t:r.time, v:r[def.k]}; });
  var card = document.createElement('div');
  card.className = 'chart-card';

  var titleHtml = esc(def.n) + badge(def.tip);

  if(pts.length < 2){
    card.innerHTML = '<div class="ct"><span>'+titleHtml+'</span>'
      + '<span class="range">数据不足</span></div>'
      + '<div style="font-size:12px;color:var(--text-3);padding:10px 0;">至少需要 2 期数据</div>';
    container.appendChild(card);
    return;
  }

  var vals = pts.map(function(p){return p.v;});
  var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  var pad = (mx-mn)<0.01 ? 1 : (mx-mn)*0.15;
  var y0 = mn-pad, y1 = mx+pad;

  var W=700, H=200, pl=56, pr=16, pt=16, pb=34;
  var iw = W-pl-pr, ih = H-pt-pb, n = pts.length;
  var xo = function(i){ return pl + (i/(n-1))*iw; };
  var yo = function(v){ return pt + (1-(v-y0)/(y1-y0))*ih; };
  var d = pts.map(function(p,i){
    return (i===0?'M':'L') + xo(i).toFixed(1) + ',' + yo(p.v).toFixed(1);
  }).join(' ');

  var showDots = n<=40;
  var dots = pts.map(function(p,i){
    var cx = xo(i).toFixed(1), cy = yo(p.v).toFixed(1);
    var attrs = ' data-time="'+esc(p.t)+'"'
      + ' data-val="'+p.v+'"'
      + ' data-label="'+esc(def.n)+'"'
      + ' data-unit="'+esc(def.unit||'')+'"';
    return showDots
      ? '<circle cx="'+cx+'" cy="'+cy+'" r="3.2" fill="var(--accent)"'+attrs+'/>'
      : '<circle cx="'+cx+'" cy="'+cy+'" r="10" fill="transparent"'+attrs+'/>';
  }).join('');

  var gl = '';
  [0,0.5,1].forEach(function(f){
    var v = y1-f*(y1-y0), y = pt+f*ih;
    gl += '<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#cdd2da" stroke-width="1"/>'
      + '<text x="'+(pl-8)+'" y="'+(y+4)+'" font-size="11" fill="#9aa3b5" text-anchor="end">'+v.toFixed(1)+'</text>';
  });

  var li=[], ly='', yc=0;
  pts.forEach(function(p,i){
    var y = p.t.slice(0,4);
    if(i===0 || y!==ly){ if(yc%2===0) li.push(i); yc++; ly=y; }
  });
  var xl = li.map(function(i){
    return '<text x="'+xo(i).toFixed(1)+'" y="'+(H-8)+'" font-size="11" fill="#9aa3b5" '
      + 'text-anchor="middle">'+pts[i].t.slice(0,4)+'</text>';
  }).join('');

  var last = pts[pts.length-1], prev = pts[pts.length-2];
  var d1 = last.v - prev.v, c1 = deltaClass(def.good, d1);
  var yAgo = null;
  var ty = String(parseInt(last.t.slice(0,4),10)-1) + '-' + last.t.slice(5);
  for(var k=pts.length-1;k>=0;k--){ if(pts[k].t===ty){ yAgo=pts[k]; break; } }
  var d2 = yAgo ? last.v - yAgo.v : null;
  var c2 = yAgo ? deltaClass(def.good, d2) : 'fl';

  function arrow(v){ return v>0?'↑':(v<0?'↓':'−'); }
  function pct(v){ return v===null ? '—' : (Math.abs(v).toFixed(1) + (def.unit||'')); }

  card.innerHTML =
    '<div class="ct"><span>'+titleHtml+'</span>'
    + '<span class="range">'+mn.toFixed(1)+' ~ '+mx.toFixed(1)+'</span></div>'
    + '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+gl
    + '<path d="'+d+'" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    + dots + xl + '</svg>'
    + '<div style="display:flex;gap:8px;font-size:12px;">'
    + '<div style="flex:1;padding:6px 10px;border-radius:9px;box-shadow:var(--sh-in-xs);'
      + 'display:flex;justify-content:space-between;gap:6px;font-variant-numeric:tabular-nums;">'
      + '<span style="color:var(--text-3);font-size:11.5px;">较上期</span>'
      + '<span class="'+c1+'" style="font-weight:600;">'+arrow(d1)+' '+pct(d1)+'</span></div>'
    + '<div style="flex:1;padding:6px 10px;border-radius:9px;box-shadow:var(--sh-in-xs);'
      + 'display:flex;justify-content:space-between;gap:6px;font-variant-numeric:tabular-nums;">'
      + '<span style="color:var(--text-3);font-size:11.5px;">去年同期</span>'
      + '<span class="'+c2+'" style="font-weight:600;">'+(d2===null?'—':arrow(d2)+' '+pct(d2))+'</span></div>'
    + '</div>';
  container.appendChild(card);
}

/* ============================================================
 * 财政双线图
 * ============================================================ */
function renderFiscalChart(boxId, rows){
  var box = $('#'+boxId);
  if(!box) return;
  box.innerHTML = '';

  var pts = rows.filter(function(r){
    return isNum(r.fiscal_rev) || isNum(r.fiscal_exp);
  }).map(function(r){
    return {
      t: r.time,
      rev: isNum(r.fiscal_rev) ? r.fiscal_rev : null,
      exp: isNum(r.fiscal_exp) ? r.fiscal_exp : null
    };
  });

  if(pts.length < 2){
    box.innerHTML = '<div class="empty" style="grid-column:1/-1;">财政数据不足 2 期。</div>';
    return;
  }

  var card = document.createElement('div');
  card.className = 'chart-card';
  card.style.gridColumn = '1/-1';

  var allVals = [];
  pts.forEach(function(p){
    if(p.rev!==null) allVals.push(p.rev);
    if(p.exp!==null) allVals.push(p.exp);
  });
  var mn = Math.min.apply(null, allVals), mx = Math.max.apply(null, allVals);
  var pad = (mx-mn)<0.01 ? 1 : (mx-mn)*0.15;
  var y0 = mn-pad, y1 = mx+pad;

  var W=1360, H=280, pl=64, pr=24, pt=20, pb=40;
  var iw = W-pl-pr, ih = H-pt-pb, n = pts.length;
  var xo = function(i){ return pl + (i/(n-1))*iw; };
  var yo = function(v){ return pt + (1-(v-y0)/(y1-y0))*ih; };

  var revPts = [];
  pts.forEach(function(p,i){ if(p.rev!==null) revPts.push({i:i, v:p.rev}); });
  var dRev = revPts.map(function(p,idx){
    return (idx===0?'M':'L') + xo(p.i).toFixed(1) + ',' + yo(p.v).toFixed(1);
  }).join(' ');

  var expPts = [];
  pts.forEach(function(p,i){ if(p.exp!==null) expPts.push({i:i, v:p.exp}); });
  var dExp = expPts.map(function(p,idx){
    return (idx===0?'M':'L') + xo(p.i).toFixed(1) + ',' + yo(p.v).toFixed(1);
  }).join(' ');

  var dotsRev = revPts.map(function(p){
    return '<circle cx="'+xo(p.i).toFixed(1)+'" cy="'+yo(p.v).toFixed(1)+'" r="7" fill="transparent"'
      + ' data-time="'+esc(pts[p.i].t)+'" data-val="'+p.v+'" data-label="财政收入同比" data-unit="%"'
      + ' style="cursor:pointer"></circle>';
  }).join('');
  var dotsExp = expPts.map(function(p){
    return '<circle cx="'+xo(p.i).toFixed(1)+'" cy="'+yo(p.v).toFixed(1)+'" r="7" fill="transparent"'
      + ' data-time="'+esc(pts[p.i].t)+'" data-val="'+p.v+'" data-label="财政支出同比" data-unit="%"'
      + ' style="cursor:pointer"></circle>';
  }).join('');

  var gl = '';
  [0, 0.25, 0.5, 0.75, 1].forEach(function(f){
    var v = y1-f*(y1-y0), y = pt+f*ih;
    gl += '<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#cdd2da" stroke-width="1"/>'
      + '<text x="'+(pl-10)+'" y="'+(y+4)+'" font-size="12" fill="#9aa3b5" text-anchor="end">'+v.toFixed(1)+'</text>';
  });

  var zeroY = yo(0);
  if(zeroY >= pt && zeroY <= pt+ih){
    gl += '<line x1="'+pl+'" y1="'+zeroY.toFixed(1)+'" x2="'+(W-pr)+'" y2="'+zeroY.toFixed(1)+'" '
      + 'stroke="#9aa3b5" stroke-width="1.5" stroke-dasharray="4 4" opacity=".6"/>';
  }

  var li=[], ly='', yrc=0;
  pts.forEach(function(p,i){
    var y = p.t.slice(0,4);
    if(i===0||y!==ly){ if(yrc%2===0) li.push(i); yrc++; ly=y; }
  });
  var xl = li.map(function(i){
    return '<text x="'+xo(i).toFixed(1)+'" y="'+(H-10)+'" font-size="12" fill="#9aa3b5" '
      + 'text-anchor="middle">'+pts[i].t.slice(0,4)+'</text>';
  }).join('');

  function calcDelta(key){
    var series = pts.filter(function(p){ return p[key]!==null; });
    if(series.length < 2) return {d1:null, d2:null};
    var lastP = series[series.length-1];
    var prevP = series[series.length-2];
    var d1 = lastP[key] - prevP[key];
    var ty = String(parseInt(lastP.t.slice(0,4),10)-1) + '-' + lastP.t.slice(5);
    var yAgo = null;
    for(var i=series.length-1;i>=0;i--){
      if(series[i].t === ty){ yAgo = series[i]; break; }
    }
    var d2 = yAgo ? lastP[key] - yAgo[key] : null;
    return {d1:d1, d2:d2};
  }

  var revDelta = calcDelta('rev');
  var expDelta = calcDelta('exp');

  function deltaRow(name, delta){
    function arrow(v){
      if(v===null) return '—';
      if(v>0) return '↑';
      if(v<0) return '↓';
      return '−';
    }
    function cls(v){
      if(v===null) return 'fl';
      if(v>0) return 'up';
      if(v<0) return 'dn';
      return 'fl';
    }
    function txt(v){
      return v===null ? '—' : (Math.abs(v).toFixed(1) + '%');
    }
    var c1 = cls(delta.d1);
    var c2 = cls(delta.d2);
    return '<div style="display:flex;gap:8px;font-size:12px;">'
      + '<div style="flex:1;padding:6px 10px;border-radius:9px;box-shadow:var(--sh-in-xs);'
        + 'display:flex;justify-content:space-between;gap:6px;font-variant-numeric:tabular-nums;">'
        + '<span style="color:var(--text-3);font-size:11.5px;">'+esc(name)+' · 较上期</span>'
        + '<span class="'+c1+'" style="font-weight:600;">'+arrow(delta.d1)+' '+txt(delta.d1)+'</span></div>'
      + '<div style="flex:1;padding:6px 10px;border-radius:9px;box-shadow:var(--sh-in-xs);'
        + 'display:flex;justify-content:space-between;gap:6px;font-variant-numeric:tabular-nums;">'
        + '<span style="color:var(--text-3);font-size:11.5px;">'+esc(name)+' · 去年同期</span>'
        + '<span class="'+c2+'" style="font-weight:600;">'+arrow(delta.d2)+' '+txt(delta.d2)+'</span></div>'
    + '</div>';
  }

  card.innerHTML =
    '<div class="ct" style="display:flex;align-items:center;justify-content:space-between;">'
      + '<div style="display:flex;align-items:center;gap:18px;font-size:12.5px;font-weight:500;color:var(--text-2);">'
        + '<span style="display:inline-flex;align-items:center;gap:5px;">'
          + '<i style="width:14px;height:3px;border-radius:2px;background:#ef6b6b;"></i>财政收入同比</span>'
        + '<span style="display:inline-flex;align-items:center;gap:5px;">'
          + '<i style="width:14px;height:3px;border-radius:2px;background:#5b8def;"></i>财政支出同比</span>'
      + '</div>'
      + '<span class="range">'+(mn.toFixed(1))+' ~ '+(mx.toFixed(1))+'</span>'
    + '</div>'
    + '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+gl
    + '<path d="'+dRev+'" fill="none" stroke="#ef6b6b" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<path d="'+dExp+'" fill="none" stroke="#5b8def" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>'
    + dotsRev + dotsExp + xl + '</svg>'
    + '<div style="display:flex;flex-direction:column;gap:6px;margin-top:10px;">'
      + deltaRow('财政收入', revDelta)
      + deltaRow('财政支出', expDelta)
    + '</div>';

  box.appendChild(card);
  bindTrendHover(box);
}

function renderTrendGroup(defs, boxId, rows){
  var box = $('#'+boxId);
  if(!box) return;
  box.innerHTML = '';
  var shown = rows.length>120 ? rows.slice(-120) : rows;
  var any = false;
  defs.forEach(function(d){
    var has = shown.filter(function(r){ return isNum(r[d.k]); }).length;
    if(has < 2) return;
    any = true;
    renderTrendCard(d, shown, box);
  });
  if(!any){
    box.innerHTML = '<div class="empty" style="grid-column:1/-1;">该组指标暂无足够数据。</div>';
    return;
  }
  bindTrendHover(box);
}

/* ============================================================
 * 矛盾检测
 * ============================================================ */
function pairGap(rows, a, b){
  var o=[];
  rows.forEach(function(r){
    if(isNum(r[a]) && isNum(r[b])) o.push({t:r.time, gap:r[a]-r[b], a:r[a], b:r[b]});
  });
  return o;
}

function checkAnchor(rows){
  var pts=[];
  rows.forEach(function(r){
    if(!isNum(r.gdp)) return;
    var a=[];
    if(isNum(r.power)) a.push(r.power);
    if(isNum(r.freight)) a.push(r.freight);
    if(isNum(r.cement)) a.push(r.cement);
    if(!a.length) return;
    var m = mean(a);
    pts.push({t:r.time, gdp:r.gdp, anchor:m, gap:r.gdp-m});
  });
  if(pts.length < 6) return {k:'anchor', n:'实物锚背离', lv:'skip',
    msg:'实物量（发电/货运/水泥）不足 6 期，无法判断。'};

  var gaps = pts.map(function(p){ return p.gap; });
  var rg = mean(gaps.slice(-6));
  var pers=0, mx=0, dir=0;
  gaps.forEach(function(g){
    if(Math.abs(g)>2){
      var d = g>0 ? 1 : -1;
      if(d===dir) pers++; else pers=1; dir=d;
      if(pers>mx) mx=pers;
    } else { pers=0; dir=0; }
  });

  var lv='ok', msg='';
  if(rg > 3 && mx >= 4){
    lv='fail';
    msg='GDP 持续高于实物量（近 6 期均差 +'+fmt(rg)+'，最长连续 '+mx+' 期）。'
      + '官方增速高于发电/货运/水泥——产值虚报的典型形态。';
  } else if(rg > 2){
    lv='warn';
    msg='GDP 略高于实物量（近 6 期均差 +'+fmt(rg)+'），需持续观察。';
  } else if(rg < -3 && mx >= 4){
    lv='warn';
    msg='GDP 持续低于实物量（近 6 期均差 '+fmt(rg)+'，最长连续 '+mx+' 期）。'
      + '官方增速低于实物——可能口径保守，或实物量高估，不是虚报。';
  } else if(rg < -2){
    lv='warn';
    msg='GDP 略低于实物量（近 6 期均差 '+fmt(rg)+'）。';
  } else {
    msg='GDP 与实物量基本同步（近 6 期均差 '+fmt(rg)+'）。';
  }
  return {k:'anchor', n:'实物锚背离', lv:lv, msg:msg,
    ev:'全期均差 '+fmt(mean(gaps))+' ｜ 近6期 '+fmt(rg)+' ｜ 最长连续 '+mx+' 期',
    pts:pts};
}

function checkKeqiang(rows){
  var pts=[];
  rows.forEach(function(r){
    if(!isNum(r.gdp)) return;
    var a=[], w=[];
    if(isNum(r.power)){ a.push(r.power); w.push(.40); }
    if(isNum(r.freight)){ a.push(r.freight); w.push(.25); }
    if(isNum(r.loan)){ a.push(r.loan); w.push(.35); }
    if(a.length < 2) return;
    var ws = w.reduce(function(x,y){return x+y;},0);
    var kq = a.reduce(function(s,v,i){ return s + v*w[i]; },0)/ws;
    pts.push({t:r.time, gap:r.gdp-kq});
  });
  if(pts.length < 6) return {k:'kq', n:'克强指数 vs GDP', lv:'skip',
    msg:'构成克强指数的指标不足（需发电量/货运/中长期贷款中至少两项）。'};

  var g = mean(pts.slice(-6).map(function(p){ return p.gap; }));
  var lv='ok', msg='';
  if(Math.abs(g) > 2.5){ lv='fail';
    msg='GDP 与克强指数背离 '+fmt(g)+' 个百分点。'+(g>0?'GDP 偏高。':'GDP 偏低。'); }
  else if(Math.abs(g) > 1.5){ lv='warn'; msg='GDP 与克强指数差 '+fmt(g)+' 个百分点。'; }
  else msg='GDP 与克强指数基本吻合（差 '+fmt(g)+'）。';
  return {k:'kq', n:'克强指数 vs GDP', lv:lv, msg:msg,
    ev:'0.4×发电量 + 0.25×货运 + 0.35×中长期贷款 ｜ 近6期差 '+fmt(g),
    pts:pts};
}

function checkTax(rows){
  var pts=[];
  rows.forEach(function(r){
    if(isNum(r.tax) && isNum(r.nom)){
      if(Math.abs(r.nom) > 50) return;
      if(Math.abs(r.nom) < 0.5) return;
      pts.push({t:r.time, e:r.tax/r.nom, tax:r.tax, nom:r.nom});
    }
  });
  if(pts.length < 6) return {k:'tax', n:'税收-GDP 弹性', lv:'skip',
    msg:'税收或名义 GDP 数据不足（需至少 6 期）。'};

  var recent = pts.slice(-6);
  var sorted = recent.map(function(p){ return p.e; }).sort(function(a,b){ return a-b; });
  var mid = Math.floor(sorted.length / 2);
  var e = (sorted.length % 2 === 0)
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];

  var detail = recent.map(function(p){
    return p.t+': '+fmt(p.tax)+'/'+fmt(p.nom)+'='+fmt(p.e,2);
  }).join(' ｜ ');

  var lv='ok', msg='';
  if(e < 0.5 || e > 1.6){
    lv='fail';
    msg='税收弹性 '+fmt(e,2)+'，严重偏离常态 [0.8, 1.2]。'
      + (e < 0.5 ? '税收增速远低于产出——产出可能被高估。' : '税收增速远超产出。');
  } else if(e < 0.8 || e > 1.2){
    lv='warn';
    msg='税收弹性 '+fmt(e,2)+'，偏离常态，建议结合减税政策判断。';
  } else {
    msg='税收弹性 '+fmt(e,2)+'，处于正常区间。';
  }
  return {k:'tax', n:'税收-GDP 弹性', lv:lv, msg:msg,
    ev:'近6期中位弹性 = '+fmt(e,2)+' ｜ 常态 [0.8, 1.2]\n逐期：'+detail};
}

function checkDeflator(rows){
  var pts=[];
  rows.forEach(function(r){
    if(isNum(r.gdp) && isNum(r.nom) && isNum(r.ppi) && isNum(r.cpi)){
      var imp = r.nom - r.gdp, ref = r.ppi*.7 + r.cpi*.3;
      pts.push({t:r.time, gap:imp-ref});
    }
  });
  if(pts.length < 6) return {k:'def', n:'平减指数一致性', lv:'skip',
    msg:'需要名义GDP/实际GDP/PPI/CPI 四项。'};
  var g = mean(pts.slice(-6).map(function(p){ return p.gap; }));
  var lv='ok', msg='';
  if(Math.abs(g) > 2.5){ lv='fail'; msg='隐含平减与 PPI/CPI 加权偏离 '+fmt(g)+' 个百分点。'; }
  else if(Math.abs(g) > 1.5){ lv='warn'; msg='隐含平减与价格指标偏离 '+fmt(g)+'。'; }
  else msg='平减指数与价格指标基本一致（差 '+fmt(g)+'）。';
  return {k:'def', n:'平减指数一致性', lv:lv, msg:msg,
    ev:'隐含平减 = 名义−实际 ｜ 参考 = 0.7×PPI+0.3×CPI ｜ 近6期差 '+fmt(g)};
}

function checkInvCons(rows){
  var pts = pairGap(rows, 'fai', 'retail');
  if(pts.length < 6) return {k:'ic', n:'投资-消费背离', lv:'skip', msg:'固投或社零数据不足。'};
  var g = mean(pts.slice(-6).map(function(p){ return p.gap; }));
  var lv='ok', msg='';
  if(g > 8){ lv='warn'; msg='固投持续大幅高于社零 '+fmt(g)+' 个百分点。投资是地方虚报高发区。'; }
  else if(g < -8){ lv='warn'; msg='社零持续大幅高于固投 '+fmt(Math.abs(g))+' 个百分点。'; }
  else msg='投资与消费差距 '+fmt(g)+' 个百分点，属常态。';
  return {k:'ic', n:'投资-消费背离', lv:lv, msg:msg,
    ev:'近6期平均 (固投−社零) = '+fmt(g)+' 个百分点'};
}

function checkMoney(rows){
  var pts = pairGap(rows, 'm2', 'nom');
  if(pts.length < 6) return {k:'mm', n:'货币-实体一致性', lv:'skip', msg:'M2 或名义 GDP 数据不足。'};
  var g = mean(pts.slice(-6).map(function(p){ return p.gap; }));
  var lv='ok', msg='';
  if(Math.abs(g) > 6){ lv='warn'; msg='M2 与名义 GDP 增速差 '+fmt(g)+' 个百分点，货币与实体脱节。'; }
  else msg='M2 与名义 GDP 增速差 '+fmt(g)+'，大体匹配。';
  return {k:'mm', n:'货币-实体一致性', lv:lv, msg:msg,
    ev:'近6期平均 (M2−名义GDP) = '+fmt(g)+' 个百分点'};
}

function runChecks(rows){
  return [
    checkAnchor(rows),
    checkKeqiang(rows),
    checkTax(rows),
    checkDeflator(rows),
    checkInvCons(rows),
    checkMoney(rows)
  ];
}

function riskScore(checks){
  var done = checks.filter(function(c){ return c.lv !== 'skip'; });
  if(!done.length) return {score:null, lv:'unknown', n:0, total:checks.length};
  var w = {fail:100, warn:45, ok:0};
  var s = Math.round(mean(done.map(function(c){ return w[c.lv]; })));
  return {
    score:s,
    lv: s>=60 ? 'high' : (s>=25 ? 'mid' : 'low'),
    n: done.length,
    total: checks.length
  };
}

function conflictSeries(rows){
  var out=[];
  for(var t=5;t<rows.length;t++){
    var sub = rows.slice(Math.max(0,t-11), t+1);
    var sc=[];
    ['power','freight','cement'].forEach(function(k){
      var a = pairGap(sub, 'gdp', k);
      if(a.length>=3) sc.push(Math.abs(mean(a.map(function(p){return p.gap;}))));
    });
    var tx=[];
    sub.forEach(function(r){
      if(isNum(r.tax) && isNum(r.nom) && Math.abs(r.nom)>0.5) tx.push(Math.abs(r.tax/r.nom - 1));
    });
    if(tx.length>=3) sc.push(mean(tx)*3);
    if(!sc.length) continue;
    var v = clamp(mean(sc)*20, 0, 100);
    out.push({t:rows[t].time, v:v});
  }
  return out;
}

var CHECK_TIPS = {
  anchor: TIPS.anchor,
  kq: TIPS.kq,
  tax: TIPS.tax_elast,
  def: TIPS.def,
  ic: TIPS.ic,
  mm: TIPS.mm
};

function renderConflict(rows, checks, risk){
  var box = $('#conflictBox');
  var col = {fail:'var(--fail)', warn:'var(--warn)', ok:'var(--ok)', skip:'var(--mid)'};
  var st = risk.lv==='high' ? col.fail : (risk.lv==='mid' ? col.warn : col.ok);
  var circ = 2*Math.PI*50;
  var off = risk.score==null ? circ : circ*(1-risk.score/100);

  var title = risk.lv==='high' ? '检测到多重矛盾 · 数据可信度低'
    : risk.lv==='mid' ? '存在部分矛盾 · 需谨慎对待'
    : risk.lv==='low' ? '各项交叉检验基本自洽' : '数据不足';
  var desc = risk.score==null ? '有效检测项不足，无法给出综合判断。'
    : '基于 '+risk.n+' 项可用交叉检验（'+(risk.total-risk.n)+' 项因数据缺失跳过）。'
      + '矛盾指数 '+risk.score+'/100。分数越高，官方数据内部或与实物量的矛盾越多。';

  var html = '<div class="card" style="margin-bottom:16px;"><div class="verdict">'
    + '<div class="vring"><svg viewBox="0 0 120 120">'
    + '<circle class="bgc" cx="60" cy="60" r="50"/>'
    + '<circle class="fgc" cx="60" cy="60" r="50" stroke="'+st+'" stroke-dasharray="'+circ
      + '" stroke-dashoffset="'+circ+'" data-off="'+off+'"/>'
    + '</svg><div class="vl"><span class="n" style="color:'+st+';">'
      + (risk.score==null?'—':risk.score)+'</span><span class="l">矛盾指数</span></div></div>'
    + '<div class="vtxt"><div class="ti" style="color:'+st+';">'+title+'</div>'
    + '<div class="de">'+desc+'</div></div></div></div>';

  html += '<div class="big-grid">';

  var cs = conflictSeries(rows);
  if(cs.length >= 3){
    var W=560,H=200,pl=42,pr=14,pt=14,pb=26, iw=W-pl-pr, ih=H-pt-pb, n=cs.length;
    var xo = function(i){ return pl + (i/(n-1))*iw; };
    var yo = function(v){ return pt + (1-v/100)*ih; };
    var d = cs.map(function(p,i){
      return (i===0?'M':'L') + xo(i).toFixed(1) + ',' + yo(p.v).toFixed(1);
    }).join(' ');
    var dots = cs.map(function(p,i){
      var c = p.v>=60 ? 'var(--fail)' : (p.v>=25 ? 'var(--warn)' : 'var(--ok)');
      return '<circle cx="'+xo(i).toFixed(1)+'" cy="'+yo(p.v).toFixed(1)+'" r="3" fill="'+c+'"'
        + ' data-time="'+esc(p.t)+'" data-val="'+p.v+'" data-label="矛盾指数" data-unit=""></circle>';
    }).join('');
    var gl = '';
    [0,25,50,75,100].forEach(function(v){
      var y = yo(v);
      gl += '<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#cdd2da" stroke-width="1"/>'
        + '<text x="'+(pl-6)+'" y="'+(y+3)+'" font-size="10" fill="#9aa3b5" text-anchor="end">'+v+'</text>';
    });
    var yl='', ly='';
    cs.forEach(function(p,i){
      var y = p.t.slice(0,4);
      if(i===0||y!==ly){ yl += '<text x="'+xo(i).toFixed(1)+'" y="'+(H-8)+'" font-size="10" '
        + 'fill="#9aa3b5" text-anchor="middle">'+y+'</text>'; ly=y; }
    });
    html += '<div class="big">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">'
        + '<div style="font-size:14px;font-weight:600;color:var(--text);">矛盾指数走势'
          + badge(TIPS.conflict_trend) + '</div>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--text-3);line-height:1.6;margin-bottom:10px;">'
        + 'GDP 与实物量的背离强度 + 税收弹性偏离。'
      + '</div>'
      + '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+gl
      + '<path d="'+d+'" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>'
        + dots + yl + '</svg>'
          + '<div class="chart-legend">'
            + '<span class="lg-item"><i class="lg-dot ok"></i>绿 &lt;25</span>'
            + '<span class="lg-sep">·</span>'
            + '<span class="lg-item"><i class="lg-dot warn"></i>黄 25–60</span>'
            + '<span class="lg-sep">·</span>'
            + '<span class="lg-item"><i class="lg-dot fail"></i>红 ≥60</span>'
          + '</div>'
          + '</div>';
  }

  var ac = checks.filter(function(c){ return c.k==='anchor'; })[0];
  if(ac && ac.pts && ac.pts.length >= 3){
    var W2=560,H2=200,pl2=42,pr2=14,pt2=14,pb2=26, iw2=W2-pl2-pr2, ih2=H2-pt2-pb2, n2=ac.pts.length;
    var vs = ac.pts.map(function(p){return p.gap;});
    var mn2 = Math.min.apply(null, vs.concat([-3])), mx2 = Math.max.apply(null, vs.concat([3]));
    var pd = (mx2-mn2)*.15; mn2 -= pd; mx2 += pd;
    var xo2 = function(i){ return pl2 + (i/(n2-1))*iw2; };
    var yo2 = function(v){ return pt2 + (1-(v-mn2)/(mx2-mn2))*ih2; };
    var d2 = ac.pts.map(function(p,i){
      return (i===0?'M':'L') + xo2(i).toFixed(1) + ',' + yo2(p.gap).toFixed(1);
    }).join(' ');
    var dots2 = ac.pts.map(function(p,i){
      var c = Math.abs(p.gap)>2.5 ? 'var(--fail)' : (Math.abs(p.gap)>1.5 ? 'var(--warn)' : 'var(--ok)');
      return '<circle cx="'+xo2(i).toFixed(1)+'" cy="'+yo2(p.gap).toFixed(1)+'" r="3" fill="'+c+'"'
        + ' data-time="'+esc(p.t)+'" data-val="'+p.gap+'" data-label="实物锚背离" data-unit="pp"></circle>';
    }).join('');
    var gl2 = '';
    [mn2,(mn2+mx2)/2,mx2].forEach(function(v){
      var y = yo2(v);
      gl2 += '<line x1="'+pl2+'" y1="'+y+'" x2="'+(W2-pr2)+'" y2="'+y+'" stroke="#cdd2da" stroke-width="1"/>'
        + '<text x="'+(pl2-6)+'" y="'+(y+3)+'" font-size="10" fill="#9aa3b5" text-anchor="end">'+v.toFixed(1)+'</text>';
    });
    gl2 += '<line x1="'+pl2+'" y1="'+yo2(0)+'" x2="'+(W2-pr2)+'" y2="'+yo2(0)+'" '
      + 'stroke="var(--accent)" stroke-dasharray="4 4" stroke-width="1.2" opacity=".5"/>';
    var yl2='', ly2='';
    ac.pts.forEach(function(p,i){
      var y = p.t.slice(0,4);
      if(i===0||y!==ly2){ yl2 += '<text x="'+xo2(i).toFixed(1)+'" y="'+(H2-8)+'" font-size="10" '
        + 'fill="#9aa3b5" text-anchor="middle">'+y+'</text>'; ly2=y; }
    });
    html += '<div class="big">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">'
        + '<div style="font-size:14px;font-weight:600;color:var(--text);">实物锚背离走势'
          + badge(TIPS.anchor_trend) + '</div>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--text-3);line-height:1.6;margin-bottom:10px;">'
        + '纵轴 = 官方 GDP 增速 − 实物量增速。'
      + '</div>'
      + '<svg viewBox="0 0 '+W2+' '+H2+'" preserveAspectRatio="none">'+gl2
      + '<path d="'+d2+'" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>'
      + dots2 + yl2 + '</svg>'
        + '<div class="chart-legend">'
          + '<span class="lg-item"><i class="lg-dot fail"></i>正值 = GDP 高于实物<span class="lg-sub">（虚报嫌疑）</span></span>'
          + '<span class="lg-item"><i class="lg-dot ok"></i>负值 = GDP 低于实物</span>'
        + '</div>'
        + '</div>';
  }

  html += '</div>';

  html += '<div class="check-grid">';
  checks.forEach(function(c){
    var lv = c.lv;
    var tag = lv==='ok' ? '自洽' : (lv==='warn' ? '关注' : (lv==='fail' ? '异常' : '跳过'));
    html += '<div class="check">'
      + '<div class="ch"><span class="cn"><span class="dot '+lv+'"></span>'+esc(c.n)
        + badge(CHECK_TIPS[c.k]) + '</span>'
      + '<span class="tag '+lv+'">'+tag+'</span></div>'
      + '<div class="cm">'+esc(c.msg)+'</div>'
      + (c.ev ? '<div class="ce">'+esc(c.ev)+'</div>' : '')
      + '</div>';
  });
  html += '</div>';

  box.innerHTML = html;

  bindTrendHover(box);

  requestAnimationFrame(function(){
    var fg = box.querySelector('.fgc');
    if(fg) fg.style.strokeDashoffset = fg.getAttribute('data-off');
  });
}

/* ============================================================
 * 协同性检测
 * ============================================================ */
function coordSync(rows){
  var hits = [];
  var valid = 0;
  rows.forEach(function(r){
    var flags = [];
    if(isNum(r.gdp) && isNum(r.power))
      flags.push({k:'D1', on:(r.gdp - r.power) > 2.0});
    if(isNum(r.gdp) && isNum(r.freight))
      flags.push({k:'D2', on:(r.gdp - r.freight) > 2.0});
    if(isNum(r.tax) && isNum(r.nom) && Math.abs(r.nom) > 0.5)
      flags.push({k:'D3', on:(r.tax / r.nom) < 0.6});
    if(isNum(r.nom) && isNum(r.m2))
      flags.push({k:'D4', on:(r.nom - r.m2) > 2.0});

    if(flags.length < 3) return;
    valid++;
    var on = flags.filter(function(f){ return f.on; });
    if(on.length >= 3){
      hits.push({ t:r.time, dims:on.map(function(f){ return f.k; }).join('、') });
    }
  });

  if(valid < 6) return {k:'sync', n:'多指标同步背离', lv:'skip',
    msg:'有效时点不足 6 个，无法判断同步背离。'};

  var ratio = hits.length / valid;
  var lv, score;
  if(ratio >= 0.25){ lv='fail'; score=100; }
  else if(ratio >= 0.10){ lv='warn'; score=55; }
  else { lv='ok'; score=20; }

  var msg;
  if(lv==='fail') msg='协同背离时点占比 '+Math.round(ratio*100)+'%——多项指标长期同向偏离，符合系统性失真的广度特征。';
  else if(lv==='warn') msg='协同背离时点占比 '+Math.round(ratio*100)+'%，存在一定同步迹象。';
  else msg='协同背离时点占比 '+Math.round(ratio*100)+'%，各项背离零散、未成系统。';

  var ev = '有效时点 '+valid+' 个，其中 '+hits.length+' 个命中 ≥3 项同向背离';
  if(hits.length){
    ev += '\n例：' + hits.slice(-4).map(function(h){
      return h.t + ' 命中 ' + h.dims;
    }).join(' ｜ ');
  }

  return {k:'sync', n:'多指标同步背离', lv:lv, msg:msg, ev:ev, score:score};
}

function coordPersist(rows){
  var pts = [];
  rows.forEach(function(r){
    var g = [];
    if(isNum(r.gdp) && isNum(r.power)) g.push(Math.abs(r.gdp - r.power));
    if(isNum(r.gdp) && isNum(r.freight)) g.push(Math.abs(r.gdp - r.freight));
    if(!g.length) return;
    pts.push({ t:r.time, v:mean(g) });
  });

  if(pts.length < 20) return {k:'persist', n:'背离持续性', lv:'skip',
    msg:'有效时点不足 20 个，无法判断持续性。', veto:true};

  var recent = pts.slice(-12);
  var prev   = pts.slice(-24, -12);
  var rAvg = mean(recent.map(function(p){ return p.v; }));
  var pAvg = mean(prev.map(function(p){ return p.v; }));

  var run = 0, maxRun = 0;
  pts.forEach(function(p){
    if(p.v > 2.0){ run++; if(run > maxRun) maxRun = run; }
    else run = 0;
  });

  var lv, score, trend, veto=false;
  if(rAvg > 2.0 && rAvg > pAvg + 0.5){
    lv='fail'; score=100; trend='扩大';
  } else if(rAvg > 2.0 && Math.abs(rAvg - pAvg) < 0.5){
    lv='warn'; score=75; trend='持续高位';
  } else if(rAvg < pAvg - 0.5){
    lv='ok'; score=30; trend='收窄'; veto=true;
  } else {
    lv='ok'; score=0; trend='正常'; veto=true;
  }

  var msg = '近12期均差 '+fmt(rAvg)+' ｜ 前12期均差 '+fmt(pAvg)+' ｜ 趋势：'+trend+'。';
  if(lv==='fail') msg += '背离在扩大——系统性失真的时间特征。';
  else if(lv==='warn') msg += '背离持续高位，需警惕。';
  else if(trend==='收窄') msg += '背离在收窄，未见持续恶化。';
  else msg += '未见持续背离。';

  var ev = '近12期均差 '+fmt(rAvg)+' ｜ 前12期均差 '+fmt(pAvg)
    + ' ｜ 最长连续背离 '+maxRun+' 期';

  return {k:'persist', n:'背离持续性', lv:lv, msg:msg, ev:ev,
    score:score, trend:trend, veto:veto};
}

function coordFiscal(rows){
  var pts = [];
  rows.forEach(function(r){
    if(isNum(r.tax) && isNum(r.nom) && Math.abs(r.nom) > 0.5){
      pts.push({ t:r.time, e:r.tax / r.nom });
    }
  });
  if(pts.length < 6) return {k:'fiscal', n:'财政-产出协同', lv:'skip',
    msg:'税收或名义 GDP 数据不足 6 期。'};

  var recent = pts.slice(-12).map(function(p){ return p.e; });
  var sorted = recent.slice().sort(function(a,b){ return a-b; });
  var mid = Math.floor(sorted.length/2);
  var med = (sorted.length % 2 === 0)
    ? (sorted[mid-1] + sorted[mid]) / 2
    : sorted[mid];

  var lv, score;
  if(med < 0.4 || med > 1.8){ lv='fail'; score=100; }
  else if(med < 0.7 || med > 1.4){ lv='warn'; score=55; }
  else { lv='ok'; score=20; }

  var dir = med < 1 ? '税收增速低于产出' : '税收增速高于产出';
  var msg;
  if(lv==='fail') msg='近12期税收弹性中位数 '+fmt(med,2)+'，严重偏离常态——'+dir+'，产出未获税收同步支撑。';
  else if(lv==='warn') msg='近12期税收弹性中位数 '+fmt(med,2)+'，中度偏离常态 [0.7, 1.4]。';
  else msg='近12期税收弹性中位数 '+fmt(med,2)+'，处于正常区间。';

  return {k:'fiscal', n:'财政-产出协同', lv:lv, msg:msg,
    ev:'近12期弹性中位数 '+fmt(med,2)+' ｜ 正常区间 [0.7, 1.4]', score:score};
}

function coordMoney(rows){
  var pts = [];
  rows.forEach(function(r){
    if(isNum(r.m2) && isNum(r.nom))
      pts.push({ t:r.time, gap:r.m2 - r.nom });
  });
  if(pts.length < 6) return {k:'money', n:'货币-产出协同', lv:'skip',
    msg:'M2 或名义 GDP 数据不足 6 期。'};

  var recent = pts.slice(-12);
  var g = mean(recent.map(function(p){ return p.gap; }));
  var abs = Math.abs(g);

  var lv, score;
  if(abs > 6){ lv='fail'; score=100; }
  else if(abs > 3){ lv='warn'; score=50; }
  else { lv='ok'; score=20; }

  var msg;
  if(lv==='fail') msg='近12期平均 (M2 − 名义GDP) = '+fmt(g)+' pp，长期单方向偏离——货币与实体脱节明显。';
  else if(lv==='warn') msg='近12期平均 (M2 − 名义GDP) = '+fmt(g)+' pp，温和偏离。';
  else msg='近12期平均 (M2 − 名义GDP) = '+fmt(g)+' pp，货币与实体大体匹配。';

  return {k:'money', n:'货币-产出协同', lv:lv, msg:msg,
    ev:'近12期平均 (M2 − 名义GDP) = '+fmt(g)+' pp', score:score};
}

function renderCoord(rows){
  var box = $('#coordBox');
  if(!box) return;

  if(!rows.length){
    box.innerHTML = '<div class="empty">导入数据后自动生成。</div>';
    return;
  }

  var checks = [ coordSync(rows), coordPersist(rows),
                 coordFiscal(rows), coordMoney(rows) ];
  var W = {sync:0.40, persist:0.30, fiscal:0.18, money:0.12};

  var sumW = 0, sumS = 0, veto = false;
  checks.forEach(function(c){
    if(c.lv === 'skip') return;
    var w = W[c.k] || 0;
    sumW += w;
    sumS += w * c.score;
    if(c.k === 'persist' && c.veto) veto = true;
  });

  var total = sumW ? Math.round(sumS / sumW) : null;
  var vetoed = false;
  if(total !== null && veto && total > 59){ total = 59; vetoed = true; }

  var lv, title, color;
  if(total === null){
    lv='skip'; title='数据不足'; color='var(--mid)';
  } else if(total >= 60){
    lv='fail'; title='疑似系统性背离'; color='var(--fail)';
  } else if(total >= 25){
    lv='warn'; title='存在协同迹象'; color='var(--warn)';
  } else {
    lv='ok'; title='未发现系统性协同'; color='var(--ok)';
  }

  var desc = total === null
    ? '有效检测项不足，无法给出协同性判断。'
    : (total >= 60
        ? '多个独立检验同向、持续、协同偏离，符合系统性数据失真的特征。'
        : total >= 25
          ? '部分检验出现同向背离，但持续性或广度不足，需继续观察。'
          : '各项检验的偏离零散、方向不一，未见系统性协同迹象。');

  var circ = 2 * Math.PI * 50;
  var off = total === null ? circ : circ * (1 - total / 100);

  var html = '<div class="coord-summary-card"><div class="coord-summary-head">'
    + '<div class="coord-summary-title '+lv+'">'+title+'</div>'
    + '<div class="coord-summary-sub">协同性异常度 · 基于 '+checks.filter(function(c){return c.lv!=='skip';}).length
      + ' 项可用检测</div></div>'
    + '<div class="coord-summary-body">'
    + '<div class="coord-gauge-wrap"><div class="coord-gauge">'
    + '<svg viewBox="0 0 120 120">'
    + '<circle class="cg-bg" cx="60" cy="60" r="50"/>'
    + '<circle class="cg-fg" cx="60" cy="60" r="50" stroke="'+color
      + '" stroke-dasharray="'+circ+'" stroke-dashoffset="'+circ
      + '" data-off="'+off+'"/>'
    + '</svg><div class="cg-val"><span class="n" style="color:'+color+';">'
      + (total === null ? '—' : total)
      + '</span><span class="l">协同性异常度</span></div></div></div>'
    + '<div class="coord-summary-desc">'+desc
      + (vetoed ? '<br><span style="color:var(--warn);">⚠ 因持续性不足（背离未扩大），总分被限制在 59 以内。</span>' : '')
      + '</div></div>'
    + '<div class="coord-note">协同性异常 ≠ 已证实造假。但多项官方数据长期同向背离，是苏联式数据失真的典型指纹。</div>'
    + '</div>';

  html += '<div class="check-grid">';
  checks.forEach(function(c){
    var lvv = c.lv;
    var tag = lvv==='ok' ? '正常' : (lvv==='warn' ? '关注' : (lvv==='fail' ? '异常' : '跳过'));
    html += '<div class="check">'
      + '<div class="ch"><span class="cn"><span class="dot '+lvv+'"></span>'+esc(c.n)+'</span>'
      + '<span class="tag '+lvv+'">'+tag+'</span></div>'
      + '<div class="cm">'+esc(c.msg)+'</div>'
      + (c.ev ? '<div class="ce">'+esc(c.ev)+'</div>' : '')
      + '</div>';
  });
  html += '</div>';

  var concl = [];
  if(total === null){
    concl.push({c:'warn', t:'有效检测项不足，无法给出协同性判断。'});
  } else {
    var top = checks.filter(function(c){ return c.lv!=='skip'; })
      .sort(function(a,b){ return (b.score||0)-(a.score||0); })[0];
    concl.push({c: lv==='fail'?'fail':(lv==='warn'?'warn':'ok'),
      t:'<strong>协同性异常度 '+total+'/100</strong> —— '+title+'。'});
    if(top) concl.push({c:'info',
      t:'得分主要来自 <strong>'+esc(top.n)+'</strong>：'+esc(top.msg)});
    var p = checks.filter(function(c){ return c.k==='persist'; })[0];
    if(p && p.lv!=='skip')
      concl.push({c:'info', t:'② 背离持续性：'+esc(p.msg)});
    if(vetoed)
      concl.push({c:'warn', t:'注意：因背离未持续扩大，已触发封顶规则，总分不代表已构成系统性背离。'});
  }
  concl.push({c:'info', t:'协同性异常 ≠ 已证实造假，但多项官方数据长期同向背离，是苏联式数据失真的典型指纹。'});

  html += '<div class="concl" style="margin-top:16px;"><h3>📋 协同性结论</h3><ul>'
    + concl.map(function(c){ return '<li class="i-'+c.c+'">'+c.t+'</li>'; }).join('')
    + '</ul></div>';

  box.innerHTML = html;

  requestAnimationFrame(function(){
    var fg = box.querySelector('.cg-fg');
    if(fg) fg.style.strokeDashoffset = fg.getAttribute('data-off');
  });
}

/* ============================================================
 * 综合分析
 * ============================================================ */
function pickLast(rows, key){
  for(var i=rows.length-1;i>=0;i--){
    if(isNum(rows[i][key])) return {v:rows[i][key], t:rows[i].time};
  }
  return {v:null, t:''};
}
function buildAnalysis(rows){
  if(!rows.length) return null;
  var last = rows[rows.length-1];
  var pmi = pickLast(rows,'pmi').v;
  var gdp = pickLast(rows,'gdp').v;
  var ppi = pickLast(rows,'ppi').v;
  var cpi = pickLast(rows,'cpi').v;
  var m1m2 = pickLast(rows,'m1m2').v;
  var nom = pickLast(rows,'nom').v;
  var ppi_cpi = (isNum(ppi) && isNum(cpi)) ? +(ppi-cpi).toFixed(1)
    : pickLast(rows,'ppi_cpi').v;

  function anchorScore(def, v){
    if(!isNum(v) || !def) return null;
    if(def.t==='lin') return clamp((v-def.lo)/(def.hi-def.lo)*100, 0, 100);
    return null;
  }
  var dims = [
    {k:'pmi', n:'景气度', c:'var(--c1)', prior:.30, v:pmi, a:{t:'lin',lo:40,hi:60}},
    {k:'gdp', n:'增长质量', c:'var(--c2)', prior:.25, v:gdp, a:{t:'lin',lo:-2,hi:8}},
    {k:'ppi_cpi', n:'利润分配', c:'var(--c3)', prior:.25, v:ppi_cpi, a:null},
    {k:'m1m2', n:'钱流预期', c:'var(--c4)', prior:.20, v:m1m2, a:{t:'lin',lo:-6,hi:6}}
  ];
  var totalW = 0;
  dims.forEach(function(d){
    if(!isNum(d.v)){ d.val = null; return; }
    var s = d.a ? anchorScore(d.a, d.v)
      : (d.k==='ppi_cpi' ? clamp(100 - Math.abs(d.v)*25, 0, 100) : 50);
    d.val = clamp(s, 0, 100);
    totalW += d.prior;
  });
  if(totalW > 0){
    dims.forEach(function(d){
      d.showW = d.val!==null ? Math.round((d.prior/totalW)*100) : 0;
    });
  } else dims.forEach(function(d){ d.showW = 0; });

  var comp=0, ws=0;
  dims.forEach(function(d){ if(d.val!==null){ comp += d.val*d.prior; ws += d.prior; } });
  comp = ws ? Math.round(comp/ws) : null;

  var wDev = dims.filter(function(d){ return d.val!==null; })
    .map(function(d){ return Math.abs(d.prior-0.25); });
  var devPct = wDev.length ? Math.round(mean(wDev)*100) : null;

  return {
    last:last, pmi:pmi, gdp:gdp, ppi:ppi, cpi:cpi, ppi_cpi:ppi_cpi,
    m1m2:m1m2, nom:nom, dims:dims, comp:comp, devPct:devPct
  };
}

var DIM_TIPS = {
  pmi: TIPS.dim_pmi,
  gdp: TIPS.dim_gdp,
  ppi_cpi: TIPS.dim_ppi_cpi,
  m1m2: TIPS.dim_m1m2
};

function renderAnalysis(rows, checks, risk){
  var box = $('#analysisBox');
  var a = buildAnalysis(rows);
  if(!a){ box.innerHTML = '<div class="empty">数据不足，无法生成综合分析。</div>'; return; }

  var html = '';

  if(risk.lv==='high'){
    html += '<div class="warn-banner"><span class="ic">⚠</span>'
      + '<div><b>数据存在多重矛盾。</b>下方景气诊断结果仅供参考，'
      + '不应作为真实经济判断的依据。</div></div>';
  } else if(risk.lv==='mid'){
    html += '<div class="warn-banner"><span class="ic">⚑</span>'
      + '<div>数据存在部分矛盾。下方结论可作参考，但需结合矛盾检测一并判断。</div></div>';
  }

  var circ = Math.PI*40;
  var dimsHtml = a.dims.map(function(d){
    var labelHtml = esc(d.n) + badge(DIM_TIPS[d.k]);
    if(d.val===null){
      return '<div class="dim"><div class="ring"><svg viewBox="0 0 100 56">'
        + '<path class="rbg" d="M 10 50 A 40 40 0 0 1 90 50"/></svg>'
        + '<div class="vl" style="font-size:14px;color:var(--text-3);">—</div></div>'
        + '<div class="lb">'+labelHtml+'</div><div class="sc">数据缺失</div></div>';
    }
    var off = circ*(1-d.val/100);
    var adj = d.a ? clamp((d.v-d.a.lo)/(d.a.hi-d.a.lo)*100, 0, 100) : 50;
    return '<div class="dim"><div class="ring"><svg viewBox="0 0 100 56">'
      + '<path class="rbg" d="M 10 50 A 40 40 0 0 1 90 50"/>'
      + '<path class="rfg" d="M 10 50 A 40 40 0 0 1 90 50" stroke="'+d.c
        + '" stroke-dasharray="'+circ+'" stroke-dashoffset="'+circ+'" data-off="'+off+'"/></svg>'
      + '<div class="vl">'+Math.round(d.val)+'</div></div>'
      + '<div class="lb">'+labelHtml+'</div>'
      + '<div class="sc">绝对 '+Math.round(adj)+' · 权重 '+d.showW+'%</div></div>';
  }).join('');

  html += '<div class="card" style="margin-bottom:16px;">'
    + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;'
      + 'margin-bottom:16px;flex-wrap:wrap;">'
    + '<div style="font-size:14px;font-weight:600;">四维参考信号'
      + (a.comp!==null ? ' · 综合 '+a.comp : '')+'</div>'
    + '<div style="font-size:12px;color:var(--text-3);">模型合成评分，非真实经济数据</div>'
    + '</div>'
    + '<div class="dims">'+dimsHtml+'</div></div>';

  var pval = a.ppi_cpi;
  var ppiPct = isNum(pval) ? clamp(50 + pval*12, 4, 96) : 50;
  var pdesc = !isNum(pval) ? '价格数据不足。'
    : pval>1.5 ? '上游利润丰厚，下游承压，结构性矛盾突出。'
    : pval>0.5 ? '上游略占优势，利润分配向上游倾斜。'
    : pval<-1 ? '剪刀差明显为负，成本压力缓解，但需警惕通缩。'
    : pval<-0.5 ? '下游利润改善，成本压力缓解。'
    : '上下游利润均衡。';

  var c1 = !isNum(a.m1m2) ? {s:'warn',t:'数据缺失'}
    : (a.m1m2>0 ? {s:'ok',t:'已转正'} : (a.m1m2>-0.5 ? {s:'warn',t:'收窄中'} : {s:'fail',t:'未改善'}));
  var c2 = !isNum(pval) ? {s:'warn',t:'数据缺失'}
    : (pval<0 ? {s:'ok',t:'已转负'} : (pval<0.5 ? {s:'warn',t:'收窄中'} : {s:'fail',t:'未改善'}));
  var c3 = (isNum(a.pmi)&&isNum(pval)&&a.pmi>52&&pval<0.5) ? {s:'ok',t:'利润跑赢产出'}
    : ((isNum(a.pmi)&&isNum(pval)&&a.pmi>52&&pval>=0.5) ? {s:'fail',t:'增产不增收'} : {s:'warn',t:'待判断'});
  var c4 = !isNum(a.m1m2) ? {s:'warn',t:'数据缺失'}
    : (a.m1m2>-0.5 ? {s:'ok',t:'预期改善'} : {s:'fail',t:'预期偏弱'});
  var pass = [c1,c2,c3,c4].filter(function(c){ return c.s==='ok'; }).length;

  var chain = [
    {n:1,name:'意愿',s:c1.s,t:c1.t},
    {n:2,name:'空间',s:c2.s,t:c2.t},
    {n:3,name:'结果',s:c3.s,t:c3.t},
    {n:4,name:'落地',s:c4.s,t:c4.t}
  ];
  var chainNodes = chain.map(function(it,i){
    var line = i<3 ? '<span class="cl-line '+(it.s==='ok'?'ok':'')+'"></span>' : '';
    return '<div class="cn '+it.s+'"><span class="cd">'+it.n+'</span>'
      + '<span class="cl">'+it.name+'</span></div>'+line;
  }).join('');

  var chainMeaning = {
    '意愿': 'M1-M2 剪刀差：反映企业愿不愿意动用资金',
    '空间': 'PPI-CPI 剪刀差：反映成本端有无宽松空间',
    '结果': 'PMI × 利润分配：反映增产是否增收',
    '落地': 'M1-M2 边际变化：反映预期是否落到实体'
  };
  var chainRight = chain.map(function(it){
    return '<div class="cr-row cr-'+it.s+'">'
      + '<span class="cr-num">'+it.n+'</span>'
      + '<span class="cr-body">'
        + '<span class="cr-name">'+esc(it.name)+'：'+esc(it.t)+'</span>'
        + '<span class="cr-desc">'+esc(chainMeaning[it.name]||'')+'</span>'
      + '</span>'
    + '</div>';
  }).join('');

  var pfRow = function(label, v){
    if(!isNum(v)) return '<div class="pf-row"><span class="k">'+label+'</span>'
      + '<div style="flex:1;font-size:12px;color:var(--text-3);">暂无</div></div>';
    var p = clamp((v+6)/12*100, 3, 97);
    var col = v>2 ? 'var(--fail)' : (v>0 ? 'var(--warn)' : (v>-2 ? 'var(--mid)' : '#5b8def'));
    return '<div class="pf-row"><span class="k">'+label+'</span><div class="tr">'
      + '<i class="z" style="left:50%"></i>'
      + '<i class="d" style="left:'+p+'%;background:'+col+';"></i></div>'
      + '<span class="v">'+fmt(v)+'%</span></div>';
  };

  html += '<div class="grid3" style="margin-bottom:16px;">'

    + '<div class="panel"><div class="ph"><span class="pt">💰 利润分配</span>'
    + '<span class="pm">'+(isNum(pval)?fmt(pval)+'pp':'—')+'</span></div>'
    + '<div class="pb"><div style="padding:12px 14px;border-radius:12px;box-shadow:var(--sh-in-xs);margin-bottom:12px;">'
    + '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-3);margin-bottom:6px;">'
    + '<span>下游</span><span>上游</span></div>'
    + '<div style="position:relative;height:6px;border-radius:3px;background:var(--bg);box-shadow:var(--sh-in-xs);">'
    + '<i style="position:absolute;left:50%;top:-3px;width:2px;height:12px;margin-left:-1px;'
      + 'background:var(--text-3);opacity:.5;"></i>'
    + '<i style="position:absolute;top:50%;transform:translate(-50%,-50%);left:'+ppiPct
      + '%;width:13px;height:13px;border-radius:50%;background:'
      + (pval>1.5?'var(--fail)':(pval>.5?'var(--warn)':(pval<-.5?'var(--ok)':'var(--mid)')))
      + ';border:2px solid var(--bg);"></i>'
    + '</div></div><div style="font-size:13px;line-height:1.65;">'+esc(pdesc)+'</div></div></div>'

    + '<div class="panel"><div class="ph"><span class="pt">🌡️ 通胀 / 通缩</span>'
    + '<span class="pm">'+(isNum(a.ppi)&&isNum(a.cpi)?'有数据':'—')+'</span></div>'
    + '<div class="pb"><div style="padding:12px 14px;border-radius:12px;box-shadow:var(--sh-in-xs);margin-bottom:12px;">'
    + '<div style="font-size:12px;color:var(--text-3);text-align:center;letter-spacing:.06em;margin-bottom:8px;">'
    + '← 通缩 · 通胀 →</div>'
    + pfRow('上游 PPI', a.ppi) + pfRow('下游 CPI', a.cpi) + '</div>'
    + '<div style="font-size:13px;line-height:1.65;">M1-M2 为 '+fmt(a.m1m2)
      + '；方向性判断，不构成点预测。</div></div></div>'

    + '</div>'

    + '<div class="grid3" style="margin-bottom:16px;">'

      + '<div class="panel panel-vcenter"><div class="ph"><span class="pt">🔗 传导链条</span>'
      + '<span class="pm">'+pass+'/4</span></div>'
      + '<div class="pb pb-center">'
        + '<div class="chain-verdict" style="margin-bottom:16px;">'
          + (pass>=3 ? '传导链条基本通畅。' : (pass>=2 ? '传导链条部分断裂。' : '传导链条严重断裂。'))
        + '</div>'
        + '<div class="chain">'+chainNodes+'</div>'
      + '</div></div>'

      + '<div class="panel"><div class="ph"><span class="pt">📋 环节含义</span>'
      + '<span class="pm">4 环节</span></div>'
      + '<div class="pb"><div class="chain-right">'+chainRight+'</div></div></div>'

    + '</div>';

  var wtHtml = a.dims.filter(function(d){ return d.val!==null; }).map(function(d){
    return '<div class="wt"><span class="n">'+esc(d.n)+'</span>'
      + '<span class="b"><i style="width:'+d.showW+'%"></i></span>'
      + '<span class="v">'+d.showW+'%</span></div>';
  }).join('');
  var wtNote = a.devPct===null ? '权重由先验设定。'
    : (a.devPct<12 ? '权重接近等权（偏离 '+a.devPct+'%）。'
    : '权重偏离等权 '+a.devPct+'%。');

  html += '<div class="panel" style="margin-bottom:16px;">'
    + '<div class="ph"><span class="pt">⚖️ 权重来源</span>'
    + '<span class="pm">'+(a.devPct===null?'先验':'偏离 '+a.devPct+'%')+'</span></div>'
    + '<div class="pb">'+wtHtml+'<div class="note">'+esc(wtNote)+'</div></div></div>';

  var concl = [];
  if(risk.lv==='high'){
    concl.push({c:'fail', t:'<strong>数据可信度低。</strong>矛盾指数 '+risk.score
      + '/100，多项交叉检验发现系统性偏离。下面的景气判断请勿采信。'});
  } else if(risk.lv==='mid'){
    concl.push({c:'warn', t:'<strong>数据存在部分矛盾。</strong>矛盾指数 '+risk.score
      + '/100。部分检验未通过，景气判断需谨慎。'});
  } else if(risk.lv==='low'){
    concl.push({c:'ok', t:'<strong>数据交叉检验基本自洽。</strong>矛盾指数 '+risk.score
      + '/100。'});
  }
  if(a.gdp!==null){
    concl.push({c:'info', t:'最新一期（'+esc(a.last.time)+'）GDP 同比 <strong>'
      + fmt(a.gdp)+'%</strong>'
      + (isNum(a.pmi) ? '，PMI '+fmt(a.pmi)+(a.pmi>=50?'（荣枯线上）':'（荣枯线下）') : '')+'。'});
  }
  if(isNum(a.ppi_cpi)){
    concl.push({c:Math.abs(a.ppi_cpi)>1.5?'warn':'info',
      t:'PPI-CPI 剪刀差 <strong>'+fmt(a.ppi_cpi)+'pp</strong>：'
      + (a.ppi_cpi>1.5 ? '上游对下游挤压明显。'
        : (a.ppi_cpi<-1 ? '下游成本压力缓解，但需防通缩。' : '上下游相对均衡。'))});
  }
  if(isNum(a.m1m2)){
    concl.push({c:a.m1m2>-0.5?'ok':'warn',
      t:'M1-M2 剪刀差 <strong>'+fmt(a.m1m2)+'pp</strong>：'
      + (a.m1m2>0 ? '企业资金活化意愿较强。'
        : (a.m1m2>-0.5 ? '资金活化偏弱，但未恶化。' : '企业定期化倾向明显。'))});
  }
  concl.push({c:'info', t:'以上结论基于 <strong>'+rows.length
    + '</strong> 期观测。矛盾检测看"数据能不能信"，四维评分看"如果可信，处于什么状态"——两者不可混用。'});

  html += '<div class="concl"><h3>📋 自动结论</h3><ul>'
    + concl.map(function(c){ return '<li class="i-'+c.c+'">'+c.t+'</li>'; }).join('')
    + '</ul></div>';

  box.innerHTML = html;

  requestAnimationFrame(function(){
    $$('.rfg', box).forEach(function(el,i){
      setTimeout(function(){ el.style.strokeDashoffset = el.getAttribute('data-off'); }, 100+i*80);
    });
  });
}

/* ============================================================
 * 03 数据总览
 * ============================================================ */
function riskTotal(rows){
  var checks = runChecks(rows);
  var risk = riskScore(checks);

  var coords = [ coordSync(rows), coordPersist(rows),
                 coordFiscal(rows), coordMoney(rows) ];
  var W = {sync:0.40, persist:0.30, fiscal:0.18, money:0.12};
  var sumW = 0, sumS = 0, veto = false;
  coords.forEach(function(c){
    if(c.lv === 'skip') return;
    var w = W[c.k] || 0;
    sumW += w;
    sumS += w * c.score;
    if(c.k === 'persist' && c.veto) veto = true;
  });
  var coordTotal = sumW ? Math.round(sumS / sumW) : null;
  var vetoed = false;
  if(coordTotal !== null && veto && coordTotal > 59){ coordTotal = 59; vetoed = true; }

  var rs = risk.score;
  var cs = coordTotal;
  var total;
  if(rs == null && cs == null) total = null;
  else if(rs == null) total = cs;
  else if(cs == null) total = rs;
  else total = Math.round(rs * 0.4 + cs * 0.6);

  return {
    risk: risk,
    riskScore: rs,
    coordScore: cs,
    coordVetoed: vetoed,
    total: total,
    checks: checks,
    coords: coords
  };
}

function renderOverview(rows){
  var box = $('#overviewBox');
  if(!box) return;

  if(!rows.length){
    box.innerHTML = '<div class="empty">导入数据后自动生成。</div>';
    return;
  }

  var rt = riskTotal(rows);
  var total = rt.total;
  var circ = 2 * Math.PI * 50;

  /* ============ 第一行：真实性风险总览（1×2）============ */
  var lv, title, color;
  if(total === null){
    lv = 'skip'; title = '数据不足'; color = 'var(--mid)';
  } else if(total >= 60){
    lv = 'fail'; title = '数据真实性风险高'; color = 'var(--fail)';
  } else if(total >= 25){
    lv = 'warn'; title = '数据真实性风险中等'; color = 'var(--warn)';
  } else {
    lv = 'ok'; title = '数据真实性风险低'; color = 'var(--ok)';
  }

  var riskDesc = total === null
    ? '有效检测项不足，无法给出真实性判断。'
    : (total >= 60
        ? '多项独立检验同向、持续偏离，符合系统性数据失真特征。'
        : total >= 25
          ? '部分检验出现偏离，但方向或持续性不足，需谨慎对待。'
          : '各项交叉检验基本自洽，未见系统性偏离。');

  var off = total === null ? circ : circ * (1 - total / 100);
  var dotPos = total === null ? 0 : clamp(total, 0, 100);

  var html = '<div class="ov-row ov-row-2">';

  /* 左卡：单色环 + 右侧文字 */
  html += '<div class="ov-cell">'
    + '<div class="ov-cell-title">真实性风险总览</div>'
    + '<div class="ov-risk-left">'
    +   '<div class="ov-cell-gauge">'
    +     '<svg viewBox="0 0 120 120">'
    +       '<circle class="cg-bg" cx="60" cy="60" r="50"/>'
    +       '<circle class="cg-fg" cx="60" cy="60" r="50" stroke="'+color
              + '" stroke-dasharray="'+circ+'" stroke-dashoffset="'+circ
              + '" data-off="'+off+'"/>'
    +     '</svg>'
    +     '<div class="cg-val"><span class="n" style="color:'+color+';">'
    +       (total === null ? '—' : total)
    +     '</span><span class="l">风险度</span></div>'
    +   '</div>'
    +   '<div class="ov-risk-txt">'
    +     '<div class="t" style="color:'+color+';">'+esc(title)+'</div>'
    +   '</div>'
    + '</div>'
    + '</div>';

  /* 右卡：滑块 + 描述 */
  html += '<div class="ov-cell">'
    + '<div class="ov-cell-title">风险区位置</div>'
    + '<div style="display:flex;align-items:center;gap:14px;">'
    +   '<div class="ov-slider" style="flex:1;">'
    +     '<i class="tick" style="left:25%;"></i>'
    +     '<i class="tick" style="left:60%;"></i>'
    +     '<i class="dot" style="left:'+dotPos+'%;background:'+color+';"></i>'
    +   '</div>'
    + '</div>'
    + '<div class="ov-slider-ticks"><span>0</span><span>25</span><span>60</span><span>100</span></div>'
    + '<div class="ov-cell-note">'+esc(riskDesc)+'<br>'
    +   '由矛盾指数（40%）与协同性异常度（60%）合成。风险越高，官方数据内部矛盾越多、越系统。'
    + '</div>'
    + '</div>';

  html += '</div>';

  /* ============ 第二行：分项指标（1×2）============ */
  var rs = rt.riskScore;
  var cs = rt.coordScore;

  function duoColor(score){
    if(score == null) return 'var(--mid)';
    if(score >= 60) return 'var(--fail)';
    if(score >= 25) return 'var(--warn)';
    return 'var(--ok)';
  }

  var rsColor = duoColor(rs), csColor = duoColor(cs);
  var duoOffR = rs == null ? circ : circ * (1 - rs/100);
  var duoOffC = cs == null ? circ : circ * (1 - cs/100);

  var doneChecks = rt.checks.filter(function(c){ return c.lv !== 'skip'; });
  var failChecks = doneChecks.filter(function(c){ return c.lv === 'fail'; });
  var warnChecks = doneChecks.filter(function(c){ return c.lv === 'warn'; });
  var failNames = failChecks.map(function(c){ return c.n; }).join('、');
  var rsDesc;
  if(rs == null) rsDesc = '有效检测项不足。';
  else {
    rsDesc = doneChecks.length + ' 项交叉检验中有 ' + failChecks.length + ' 项异常、' + warnChecks.length + ' 项关注。';
    if(failNames) rsDesc += ' 异常项：' + failNames + '。';
  }

  var doneCoords = rt.coords.filter(function(c){ return c.lv !== 'skip'; });
  var failCoords = doneCoords.filter(function(c){ return c.lv === 'fail'; });
  var syncC = rt.coords.filter(function(c){ return c.k === 'sync'; })[0];
  var persistC = rt.coords.filter(function(c){ return c.k === 'persist'; })[0];
  var csDesc;
  if(cs == null) csDesc = '有效检测项不足。';
  else {
    csDesc = doneCoords.length + ' 项检测中 ' + failCoords.length + ' 项异常。';
    if(syncC && syncC.lv !== 'skip' && syncC.ev){
      var mRatio = syncC.ev.match(/其中 (\d+) 个/);
      var mValid = syncC.ev.match(/有效时点 (\d+) 个/);
      if(mRatio && mValid){
        var ratio = Math.round(parseInt(mRatio[1],10) / parseInt(mValid[1],10) * 100);
        csDesc += ' 多指标同步背离占比 ' + ratio + '%（' + mRatio[1] + ' 个时点命中 ≥3 项同向）。';
      }
    }
    if(persistC && persistC.trend){
      csDesc += ' 背离持续性：' + persistC.trend + '。';
    }
    if(rt.coordVetoed) csDesc += ' 因背离未扩大，总分已封顶。';
  }

  html += '<div class="ov-row ov-row-2">';

  /* 左卡：矛盾（半圆 + /100） */
  html += '<div class="ov-cell">'
    + '<div class="ov-cell-title">矛盾指数</div>'
    + '<div class="ov-cell-gauge-wrap">'
    +   '<div class="ov-cell-half" style="max-width:150px;">'
    +     '<svg viewBox="0 0 100 56">'
    +       '<path class="rbg" d="M 10 50 A 40 40 0 0 1 90 50"/>'
    +       '<path class="rfg" d="M 10 50 A 40 40 0 0 1 90 50" stroke="'+rsColor
              + '" stroke-dasharray="'+(Math.PI*40)+'" stroke-dashoffset="'+(Math.PI*40)+'"'
              + ' data-off="'+(Math.PI*40*(1-(rs==null?0:rs)/100))+'"/>'
    +     '</svg>'
    +     '<div class="vl" style="color:'+rsColor+';">'
    +       (rs == null ? '—' : rs)
    +       '<span style="font-size:12px;color:var(--text-2);font-weight:500;margin-left:1px;">/100</span>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="ov-cell-note">'+esc(rsDesc)+'</div>'
    + '</div>';

  /* 右卡：协同（半圆 + /100） */
  html += '<div class="ov-cell">'
    + '<div class="ov-cell-title">协同性检测</div>'
    + '<div class="ov-cell-gauge-wrap">'
    +   '<div class="ov-cell-half" style="max-width:150px;">'
    +     '<svg viewBox="0 0 100 56">'
    +       '<path class="rbg" d="M 10 50 A 40 40 0 0 1 90 50"/>'
    +       '<path class="rfg" d="M 10 50 A 40 40 0 0 1 90 50" stroke="'+csColor
              + '" stroke-dasharray="'+(Math.PI*40)+'" stroke-dashoffset="'+(Math.PI*40)+'"'
              + ' data-off="'+(Math.PI*40*(1-(cs==null?0:cs)/100))+'"/>'
    +     '</svg>'
    +     '<div class="vl" style="color:'+csColor+';">'
    +       (cs == null ? '—' : cs)
    +       '<span style="font-size:12px;color:var(--text-2);font-weight:500;margin-left:1px;">/100</span>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="ov-cell-note">'+esc(csDesc)+'</div>'
    + '</div>';

  html += '</div>';

  /* ============ 第三行：四维参考信号（1×4）============ */
  var a = buildAnalysis(rows);
  if(a){
    var comp = a.comp;
    var dimsCirc = Math.PI * 40;

    html += '<div class="ov-row ov-row-4">';

    a.dims.forEach(function(d){
      var cellColor = d.c;
      var halfHtml;
      if(d.val === null){
        halfHtml = '<div class="ov-cell-half"><svg viewBox="0 0 100 56">'
          + '<path class="rbg" d="M 10 50 A 40 40 0 0 1 90 50"/></svg>'
          + '<div class="vl" style="font-size:14px;color:var(--text-3);">—</div></div>';
      } else {
        var doff = dimsCirc * (1 - d.val/100);
        halfHtml = '<div class="ov-cell-half"><svg viewBox="0 0 100 56">'
          + '<path class="rbg" d="M 10 50 A 40 40 0 0 1 90 50"/>'
          + '<path class="rfg" d="M 10 50 A 40 40 0 0 1 90 50" stroke="'+cellColor
            + '" stroke-dasharray="'+dimsCirc+'" stroke-dashoffset="'+dimsCirc
            + '" data-off="'+doff+'"/></svg>'
          + '<div class="vl">'+Math.round(d.val)+'</div></div>';
      }

      var shortNote = '';
      if(d.val !== null){
        if(d.k === 'pmi'){
          shortNote = d.v >= 50 ? '荣枯线附近偏上' : '荣枯线附近偏下';
        } else if(d.k === 'gdp'){
          shortNote = d.v >= 6 ? '增速偏强' : (d.v >= 4 ? '增速中性' : '增速偏弱');
        } else if(d.k === 'ppi_cpi'){
          shortNote = Math.abs(d.v) > 1.5 ? '上下游失衡' : '相对均衡';
        } else if(d.k === 'm1m2'){
          shortNote = d.v > 0 ? '资金活化较强' : '资金活化不足';
        }
      } else {
        shortNote = '数据缺失';
      }

      html += '<div class="ov-cell">'
        + '<div class="ov-cell-gauge-wrap">'
        +   halfHtml
        +   '<div class="ov-cell-title" style="margin-top:8px;margin-bottom:0;text-align:center;">'+esc(d.n)+'</div>'
        + '</div>'
        + '<div class="ov-cell-note">'+esc(shortNote)+'</div>'
        + '</div>';
    });

    html += '</div>';

    /* 裸灰色小字说明（无容器） */
    html += '<div class="ov-bare-note">'
      + '⚠ 四维评分反映的是"经济景气状态"，不是数据真伪——与上方风险区无关，请勿混用。'
      + '</div>';
  }

  box.innerHTML = html;

  requestAnimationFrame(function(){
    $$('.cg-fg, .rfg', box).forEach(function(el){
      el.style.strokeDashoffset = el.getAttribute('data-off');
    });
  });
}function renderRangeTabs(){
  var box = document.getElementById('rangeTabs');
  if(!box) return;
  box.innerHTML = RANGES.map(function(r){
    return '<button data-r="'+r.k+'" class="'+(RANGE===r.k?'active':'')+'">'+r.n+'</button>';
  }).join('');
  Array.prototype.slice.call(box.querySelectorAll('button')).forEach(function(b){
    b.addEventListener('click', function(){
      RANGE = b.getAttribute('data-r');
      analyze(DATA);
      b.blur();
    });
  });
}

/* ============================================================
 * 主流程
 * ============================================================ */
function analyze(rows){
  var checks = runChecks(rows);
  var risk = riskScore(checks);
  renderTable();
  renderRangeTabs();
  renderOverview(rows);
  var r = rangeRows(rows);
  renderTrendGroup(MAIN, 'gMain', r);
  renderTrendGroup(OTHER, 'gOther', r);
  renderTrendGroup(ANCHOR, 'gAnchor', r);
  renderFiscalChart('gFiscal', r);
  renderConflict(rows, checks, risk);
  renderCoord(rows);
  renderAnalysis(rows, checks, risk);
  return risk;
}

/* ============================================================
 * 事件
 * ============================================================ */
$('#run').addEventListener('click', function(){
  var t = $('#paste').value, st = $('#status');
  if(!t.trim()){ st.innerHTML = '<span class="err">请先粘贴数据</span>'; return; }
  try{
    var res = parse(t);
    DATA = res.rows;
    YEAR = 'auto'; YPAGE = 0;
    save();
    var risk = analyze(DATA);
    st.innerHTML = '<span class="ok">已解析 '+res.rows.length+' 期数据</span>'
      + (res.skip ? '（跳过 '+res.skip+' 行）' : '')
      + (risk.score!==null ? ' · 矛盾指数 '+risk.score+'/100' : '');
    showToast('已解析 '+res.rows.length+' 期数据');
    $('#s-table').scrollIntoView({behavior:'smooth', block:'start'});
  }catch(e){
    st.innerHTML = '<span class="err">'+esc(e.message||String(e))+'</span>';
  }
});

$('#demo').addEventListener('click', function(){
  if(typeof BUILTIN === 'string' && BUILTIN){
    $('#paste').value = BUILTIN;
    $('#run').click();
  }
});

$('#clear').addEventListener('click', function(){
  if(!confirm('清空所有数据？')) return;
  DATA = []; YEAR = 'auto'; YPAGE = 0;
  save();
  $('#paste').value = '';
  $('#status').textContent = '已清空。';
  renderTable();
  ['gMain','gOther','gAnchor','gFiscal'].forEach(function(id){ $('#'+id).innerHTML=''; });
  $('#overviewBox').innerHTML = '<div class="empty">导入数据后自动生成。</div>';
  $('#conflictBox').innerHTML = '<div class="empty">导入数据后自动生成。</div>';
  $('#coordBox').innerHTML = '<div class="empty">导入数据后自动生成。</div>';
  $('#analysisBox').innerHTML = '<div class="empty">导入数据后自动生成。</div>';
  showToast('已清空');
});

$$('.pill[data-scroll]').forEach(function(b){
  b.addEventListener('click', function(){
    $$('.pill').forEach(function(x){ x.classList.remove('active'); });
    b.classList.add('active');
    var el = document.getElementById(b.getAttribute('data-scroll'));
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  });
});

function readFile(file){
  var st = $('#status');
  var name = (file.name||'').toLowerCase();
  st.innerHTML = '正在读取 <b>'+esc(file.name)+'</b>…';

  if(/\.(xlsx|xls)$/.test(name)){
    if(typeof XLSX === 'undefined'){
      st.innerHTML = '<span class="err">SheetJS 未加载，请确认 xlsx.full.min.js 与 index.html 同目录。</span>';
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, { type:'array', cellDates:false });
        var ws = wb.Sheets[wb.SheetNames[0]];
        if(!ws) throw new Error('工作簿无工作表');

        var matrix = XLSX.utils.sheet_to_json(ws, {
          header:1, raw:true, defval:'', blankrows:false
        });
        if(!matrix.length) throw new Error('工作表为空');

        var headerRow = 0;
        for(var i=0;i<Math.min(matrix.length,8);i++){
          var row = matrix[i].map(function(c){ return String(c==null?'':c); });
          if(row.some(function(c){ return /时间|月份|日期|^date|^month/i.test(c); })){
            headerRow = i; break;
          }
        }

        var lines = [];
        for(var r=headerRow; r<matrix.length; r++){
          var cells = matrix[r].map(function(c){
            if(c===null || c===undefined) return '';
            if(typeof c === 'number'){
              if(c > 18262 && c < 80000){
                var d = new Date((c - 25569) * 86400000);
                if(!isNaN(d.getTime()))
                  return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
              }
              return String(c);
            }
            return String(c).replace(/\t/g,' ');
          });
          while(cells.length && cells[cells.length-1]==='') cells.pop();
          if(cells.length) lines.push(cells.join('\t'));
        }

        $('#paste').value = lines.join('\n');
        $('#run').click();
      }catch(err){
        st.innerHTML = '<span class="err">Excel 解析失败：'+esc(err.message||String(err))+'</span>';
      }
    };
    reader.onerror = function(){ st.innerHTML = '<span class="err">文件读取失败</span>'; };
    reader.readAsArrayBuffer(file);
    return;
  }

  var tr = new FileReader();
  tr.onload = function(e){
    $('#paste').value = e.target.result;
    $('#run').click();
  };
  tr.onerror = function(){ st.innerHTML = '<span class="err">文件读取失败</span>'; };
  tr.readAsText(file, 'utf-8');
}

$('#fileInput').addEventListener('change', function(e){
  if(e.target.files[0]) readFile(e.target.files[0]);
  e.target.value = '';
});
var dz = $('#dropZone');
if(dz){
  ['dragenter','dragover'].forEach(function(ev){
    dz.addEventListener(ev, function(e){
      e.preventDefault(); e.stopPropagation();
      dz.classList.add('over');
    });
  });
  ['dragleave','drop'].forEach(function(ev){
    dz.addEventListener(ev, function(e){
      e.preventDefault(); e.stopPropagation();
      dz.classList.remove('over');
    });
  });
  dz.addEventListener('drop', function(e){
    var f = e.dataTransfer.files[0];
    if(f) readFile(f);
  });
  dz.addEventListener('click', function(e){
    if(e.target.closest('label')) return;
    $('#fileInput').click();
  });
}

var _rt;
window.addEventListener('resize', function(){
  clearTimeout(_rt);
  _rt = setTimeout(function(){
    if(DATA.length){
      renderTrendGroup(MAIN, 'gMain', DATA);
      renderTrendGroup(OTHER, 'gOther', DATA);
      renderTrendGroup(ANCHOR, 'gAnchor', DATA);
    }
  }, 250);
});

document.addEventListener('mouseover', function(e){
  var el = closestBadge(e.target);
  if(el) showBadgeTip(el);
});
document.addEventListener('mouseout', function(e){
  var el = closestBadge(e.target);
  if(el) hideBadgeTip();
});
document.addEventListener('focusin', function(e){
  var el = closestBadge(e.target);
  if(el) showBadgeTip(el);
});
document.addEventListener('focusout', function(e){
  var el = closestBadge(e.target);
  if(el) hideBadgeTip();
});
window.addEventListener('scroll', hideBadgeTip, { passive:true });

(function init(){
  var saved = load();
  if(saved.length){
    DATA = saved;
    analyze(DATA);
    $('#status').innerHTML = '<span class="ok">已加载本地保存的 '+DATA.length+' 期数据。</span>';
  } else if(typeof BUILTIN === 'string' && BUILTIN){
    try{
      var res = parse(BUILTIN);
      DATA = res.rows;
      YEAR = 'auto'; YPAGE = 0;
      analyze(DATA);
      $('#status').innerHTML = '<span class="ok">已加载内置数据库 '+DATA.length+' 期。</span>';
    }catch(e){
      renderTable();
    }
  } else {
    renderTable();
  }
})();

})();