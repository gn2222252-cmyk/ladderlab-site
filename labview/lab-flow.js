/* 資料流實驗室：資料流規則、平行與順序、線分叉、迴圈邊界 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function log(id, s) { var l = $(id); l.insertBefore(el('div', '', s), l.firstChild); }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function fmt(v) { return Array.isArray(v) ? '[' + v.join(', ') + ']' : String(+(+v).toFixed(3)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function pathD(x1, y1, x2, y2, xm) { xm = xm == null ? (x1 + x2) / 2 : xm; return 'M' + x1 + ' ' + y1 + ' H' + xm + ' V' + y2 + ' H' + x2; }
  /* 小球沿 path 移動；paths = [{p: SVGPathElement, txt}]，結束呼叫 cb */
  function balls(layer, paths, dur, cb) {
    var cs = paths.map(function (o) { var c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 7); c.setAttribute('class', 'ball'); layer.appendChild(c); return c; });
    var L = paths.map(function (o) { return o.p.getTotalLength(); }), t0 = null;
    function fr(ts) {
      if (t0 == null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      paths.forEach(function (o, i) { var pt = o.p.getPointAtLength(L[i] * k); cs[i].setAttribute('cx', pt.x); cs[i].setAttribute('cy', pt.y); });
      if (k < 1) requestAnimationFrame(fr); else { cs.forEach(function (c) { c.remove(); }); cb(); }
    }
    requestAnimationFrame(fr);
  }

  var tabs = $('tabs');
  function show(t) {
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['rule', 'par', 'branch', 'loop'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* ================= 1. 資料流規則 ================= */
  var NODES = [
    { id: 't1', k: 'ctl', lab: '溫度1', x: 10, y: 30, w: 76, h: 36, nin: 0, inp: 'ft1' },
    { id: 't2', k: 'ctl', lab: '溫度2', x: 10, y: 108, w: 76, h: 36, nin: 0, inp: 'ft2' },
    { id: 'add', k: 'fn', lab: '+', name: 'Add', x: 170, y: 48, w: 46, h: 58, nin: 2, f: function (a) { return a[0] + a[1]; } },
    { id: 'k05', k: 'cst', lab: '0.5', x: 168, y: 140, w: 52, h: 30, nin: 0, c: 0.5 },
    { id: 'mul', k: 'fn', lab: '×', name: '上面的 Multiply', x: 300, y: 68, w: 46, h: 58, nin: 2, f: function (a) { return a[0] * a[1]; } },
    { id: 'avg', k: 'ind', lab: '平均', x: 430, y: 79, w: 110, h: 36, nin: 1 },
    { id: 'sec', k: 'ctl', lab: '秒數', x: 10, y: 205, w: 76, h: 36, nin: 0, inp: 'fsec' },
    { id: 'k1000', k: 'cst', lab: '1000', x: 160, y: 255, w: 60, h: 30, nin: 0, c: 1000 },
    { id: 'mul2', k: 'fn', lab: '×', name: '下面的 Multiply', x: 300, y: 198, w: 46, h: 58, nin: 2, f: function (a) { return a[0] * a[1]; } },
    { id: 'msec', k: 'ind', lab: '毫秒', x: 430, y: 209, w: 110, h: 36, nin: 1 }
  ];
  var NB = {}; NODES.forEach(function (n) { NB[n.id] = n; });
  var WIRES = [['t1', 'add', 0], ['t2', 'add', 1], ['add', 'mul', 0], ['k05', 'mul', 1], ['mul', 'avg', 0], ['sec', 'mul2', 0], ['k1000', 'mul2', 1], ['mul2', 'msec', 0]];
  function outPt(n) { return [n.x + n.w, n.y + n.h / 2]; }
  function inPt(n, k) { return [n.x, n.y + n.h * (k + 1) / (n.nin + 1)]; }
  (function build() {
    var h = '<g id="fwires">';
    WIRES.forEach(function (w, i) { var a = outPt(NB[w[0]]), b = inPt(NB[w[1]], w[2]); h += '<path class="wire" id="fw' + i + '" d="' + pathD(a[0], a[1], b[0], b[1]) + '"/>'; });
    h += '</g>';
    NODES.forEach(function (n) {
      var cls = { ctl: 'ctl', ind: 'ind', fn: 'fn', cst: 'cst' }[n.k];
      h += '<g class="nd ' + cls + '" id="fn-' + n.id + '"><rect x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="' + (n.k === 'fn' ? 4 : 3) + '"/>';
      if (n.k === 'ctl' || n.k === 'ind') h += '<text x="' + (n.x + n.w / 2) + '" y="' + (n.y - 6) + '" text-anchor="middle">' + n.lab + '</text>';
      h += '<text class="nv" x="' + (n.x + n.w / 2) + '" y="' + (n.y + n.h / 2 + 6) + '" text-anchor="middle" style="' + (n.k === 'fn' ? 'font-size:24px' : '') + '">' + (n.k === 'fn' ? n.lab : '') + '</text>';
      if (n.k === 'fn') h += '<text class="badge" x="' + (n.x + n.w / 2) + '" y="' + (n.y + n.h + 15) + '" text-anchor="middle"></text>';
      h += '</g>';
    });
    h += '<g id="fvals"></g><g id="fballs"></g>';
    $('fsvg').innerHTML = h;
  })();
  var F;
  function fReset() {
    if (F) clearTimeout(F.timer);
    F = { st: {}, pend: [], wv: {}, beat: 0, busy: false, done: false, timer: null, flash: {} };
    NODES.forEach(function (n) { F.st[n.id] = { done: false, got: new Array(n.nin), val: null }; });
    $('flog').innerHTML = ''; say('fsay', '按「執行」或「一步一步」。');
    fDraw();
  }
  function inVal(n) { if (n.inp) return +$(n.inp).value || 0; return n.c; }
  function ready(n) { var s = F.st[n.id]; if (s.done) return false; for (var k = 0; k < n.nin; k++) if (s.got[k] === undefined) return false; return true; }
  /* 一拍。sync = true 時不播動畫（給測試與關掉 Highlight 時用） */
  function fBeat(sync, cb) {
    cb = cb || function () {};
    if (F.busy || F.done) { cb(); return false; }
    F.flash = {};
    if (F.pend.length) {
      var toks = F.pend; F.pend = []; F.beat++;
      var fin = function () {
        toks.forEach(function (t) { var w = WIRES[t.w]; F.st[w[1]].got[w[2]] = t.v; F.wv[t.w] = t.v; });
        log('flog', '第 ' + F.beat + ' 拍：資料沿線送達 → ' + toks.map(function (t) { var w = WIRES[t.w], d = NB[w[1]]; return fmt(t.v) + ' 到 ' + (d.name || d.lab) + (d.nin > 1 ? ' 的第 ' + (w[2] + 1) + ' 個輸入' : ''); }).join('、'));
        var waiting = NODES.filter(function (n) { var s = F.st[n.id]; if (s.done || n.nin < 2) return false; var c = s.got.filter(function (x) { return x !== undefined; }).length; return c > 0 && c < n.nin; });
        say('fsay', waiting.length ? waiting.map(function (n) { return n.name + ' 只收到 ' + F.st[n.id].got.filter(function (x) { return x !== undefined; }).length + ' / ' + n.nin + ' 個輸入，還不能執行，只能等。'; }).join(' ') : '');
        F.busy = false; fDraw(); cb();
      };
      if (sync) fin();
      else { F.busy = true; balls($('fballs'), toks.map(function (t) { return { p: $('fw' + t.w) }; }), $('fhl').checked ? 900 : 200, fin); }
      return true;
    }
    var R = NODES.filter(ready);
    if (!R.length) { F.done = true; say('fsay', '✔ 執行完畢：平均 = ' + fmt(F.st.avg.val) + '、毫秒 = ' + fmt(F.st.msec.val) + '。共 ' + F.beat + ' 拍。', 'ok'); fDraw(); cb(); return false; }
    F.beat++;
    R.forEach(function (n) {
      var s = F.st[n.id];
      s.val = n.k === 'fn' ? n.f(s.got) : n.k === 'ind' ? s.got[0] : inVal(n);
      s.done = true; F.flash[n.id] = 1;
      WIRES.forEach(function (w, i) { if (w[0] === n.id) F.pend.push({ w: i, v: s.val }); });
    });
    var src = R.filter(function (n) { return n.nin === 0; }).length;
    log('flog', '第 ' + F.beat + ' 拍：' + (src === R.length ? '沒有輸入的節點同時出發（' : '輸入到齊的節點執行（') + R.map(function (n) { return (n.name || n.lab) + (n.k === 'fn' ? ' = ' + fmt(F.st[n.id].val) : n.k === 'ind' ? ' 顯示 ' + fmt(F.st[n.id].val) : ''); }).join('、') + '）');
    if (src === R.length) say('fsay', '控制元件和常數本來就有值，一開始就同時把資料送出去。');
    else if (R.length > 1 && R.some(function (n) { return n.k === 'fn'; })) say('fsay', R.filter(function (n) { return n.k === 'fn'; }).map(function (n) { return n.name; }).join(' 和 ') + (R.filter(function (n) { return n.k === 'fn'; }).length > 1 ? ' 在同一拍執行：它們之間沒有線，誰先都可以。' : ' 的輸入都到齊了，執行。'));
    else if (R.length === 1 && R[0].k === 'fn') say('fsay', R[0].name + ' 的輸入終於到齊，現在才執行。');
    fDraw();
    if (sync) cb(); else { F.busy = true; F.timer = setTimeout(function () { F.busy = false; fDraw(); cb(); }, $('fhl').checked ? 650 : 120); }
    return true;
  }
  function fDraw() {
    NODES.forEach(function (n) {
      var g = $('fn-' + n.id), s = F.st[n.id], got = s.got.filter(function (x) { return x !== undefined; }).length;
      var c = 'nd ' + { ctl: 'ctl', ind: 'ind', fn: 'fn', cst: 'cst' }[n.k] + (F.flash[n.id] ? ' run' : s.done ? ' done' : got > 0 ? ' part' : '');
      g.setAttribute('class', c);
      var nv = g.querySelector('.nv');
      if (n.k === 'ctl' || n.k === 'cst') nv.textContent = fmt(inVal(n));
      else if (n.k === 'ind') nv.textContent = s.done ? fmt(s.val) : '';
      var b = g.querySelector('.badge'); if (b) b.textContent = !s.done && got > 0 ? '等待 ' + got + '/' + n.nin : '';
    });
    var hl = $('fhl').checked, vh = '';
    WIRES.forEach(function (w, i) {
      var p = $('fw' + i); p.setAttribute('class', 'wire' + (F.wv[i] !== undefined ? ' done' : ''));
      if (hl && F.wv[i] !== undefined) { var L = p.getTotalLength(), pt = p.getPointAtLength(L * 0.3), t = fmt(F.wv[i]), wd = t.length * 8 + 8; vh += '<rect class="wvbg" x="' + (pt.x - wd / 2) + '" y="' + (pt.y - 22) + '" width="' + wd + '" height="17" rx="4"/><text class="wv" x="' + pt.x + '" y="' + (pt.y - 9) + '" text-anchor="middle">' + t + '</text>'; }
    });
    $('fvals').innerHTML = vh;
    $('fstep').disabled = F.done; $('frun').disabled = F.done || F.running;
  }
  function fRun() {
    if (F.done || F.beat) fReset();
    if (!$('fhl').checked) { var k = 0; while (fBeat(true) && k++ < 50); return; }
    F.running = true; fDraw();
    (function go() { fBeat(false, function () { if (!F.done) F.timer = setTimeout(go, 250); else { F.running = false; fDraw(); } }); })();
  }
  $('frun').onclick = fRun;
  $('fstep').onclick = function () { if (!F.running) fBeat(false); };
  $('freset').onclick = fReset;
  ['ft1', 'ft2', 'fsec'].forEach(function (id) { $(id).oninput = fReset; });
  $('fhl').onchange = fDraw;
  fReset();

  /* ================= 2. 平行與順序 ================= */
  var PSC = [
    { k: 'wait', name: '① Wait 100 ms 和 讀 PLC，沒有連線', chain: false, plc: true },
    { k: 'chain', name: '② 讀 PLC →（錯誤線）→ 寫檔', chain: true, plc: true },
    { k: 'race', name: '③ 寫「開始」和 寫「結束」到記錄檔，沒有連線', chain: false, plc: false },
    { k: 'race2', name: '④ 同上，但用錯誤線把「開始」接到「結束」前面', chain: true, plc: false }
  ];
  var P = { k: 'wait', timer: null, tally: { ok: 0, bad: 0 }, last: null };
  function pTasks(k) {
    var plc = +$('pplc').value;
    if (k === 'wait') return [{ lab: 'Wait (ms)', d: 100, c: '' }, { lab: '讀 PLC', d: plc, c: 'b' }];
    if (k === 'chain') return [{ lab: '讀 PLC', d: plc, c: 'b' }, { lab: '寫檔', d: 40, c: 'c' }];
    return [{ lab: '寫「開始」', d: 10, c: '' }, { lab: '寫「結束」', d: 10, c: 'c' }];
  }
  /* 算出一次執行：平行時每個節點的開始時間由排程決定（這裡用亂數代表「不保證」） */
  function pPlan(k, rnd) {
    rnd = rnd || Math.random;
    var sc = PSC.filter(function (s) { return s.k === k; })[0], T = pTasks(k), t = 0;
    T.forEach(function (x) { if (sc.chain) { x.s = t; t += x.d; } else x.s = k === 'race' ? Math.floor(rnd() * 4) : 0; x.e = x.s + x.d; });
    var total = Math.max.apply(null, T.map(function (x) { return x.e; }));
    var order = T.slice().sort(function (a, b) { return a.s - b.s || (rnd() < .5 ? -1 : 1); }).map(function (x) { return x.lab; });
    return { T: T, total: total, order: order, chain: sc.chain };
  }
  function pDraw(plan, now) {
    var max = Math.max(plan ? plan.total : 100, 100) * 1.1, h = '';
    (plan ? plan.T : pTasks(P.k)).forEach(function (x) {
      var s = x.s || 0, e = plan ? Math.min(x.e, Math.max(s, now)) : s;
      h += '<div class="gl"><span>' + x.lab + '</span><div class="gtrack">' + (e > s ? '<span class="gbar ' + x.c + '" style="left:' + (s / max * 100) + '%;width:' + ((e - s) / max * 100) + '%">' + (e >= x.e ? x.d + ' ms' : '') + '</span>' : '') + (plan ? '<span class="gcur" style="left:' + Math.min(100, now / max * 100) + '%"></span>' : '') + '</div></div>';
    });
    h += '<div class="gl"><span>時間</span><span style="font:13px ui-monospace,Consolas,monospace">' + (plan ? Math.min(Math.round(now), plan.total) + ' ms' : '0 ms') + '</span></div>';
    $('pgantt').innerHTML = h;
  }
  function pResult(plan) {
    var sc = P.k;
    if (sc === 'wait') return ['總時間 ' + plan.total + ' ms ＝ 兩個裡面比較長的（' + plan.T.map(function (x) { return x.lab + ' ' + x.d + ' ms'; }).join('、') + '），不是相加的 ' + (plan.T[0].d + plan.T[1].d) + ' ms。', 'ok'];
    if (sc === 'chain') return ['總時間 ' + plan.total + ' ms ＝ ' + plan.T[0].d + ' ＋ ' + plan.T[1].d + '。錯誤線讓寫檔一定等讀 PLC 結束才開始，順序固定，但時間是相加的。', 'ok'];
    var txt = plan.order.map(function (o) { return o.replace('寫', ''); }).join(' → ');
    var good = plan.order[0] === '寫「開始」';
    if (sc === 'race2') return ['記錄檔：' + txt + '。有錯誤線，每次都一樣。', 'ok'];
    return ['記錄檔：' + txt + (good ? '。這次剛好對。' : '。順序反了！') + '沒有線，LabVIEW 不保證誰先。', good ? '' : 'bad'];
  }
  function pRun() {
    clearInterval(P.timer);
    var plan = pPlan(P.k), now = 0, max = plan.total;
    P.last = plan;
    P.timer = setInterval(function () {
      now += Math.max(2, max / 30); pDraw(plan, now);
      if (now >= max) { clearInterval(P.timer); P.timer = null; var r = pResult(plan); say('psay', r[0], r[1]); log('plog', r[0]); }
    }, 40);
  }
  function pRun10() {
    clearInterval(P.timer);
    var ok = 0, bad = 0, plan;
    for (var i = 0; i < 10; i++) { plan = pPlan(P.k); var r = pResult(plan); if (r[1] === 'bad') bad++; else ok++; log('plog', '第 ' + (i + 1) + ' 次：' + (P.k.indexOf('race') === 0 ? plan.order.join(' → ') : plan.total + ' ms')); }
    P.last = plan; pDraw(plan, plan.total);
    if (P.k === 'race') say('psay', '10 次裡「開始」在前 ' + ok + ' 次、「結束」在前 ' + bad + ' 次。' + (bad ? '只要可能出錯就是 bug，即使大部分時候是對的。' : '這 10 次都剛好對，但沒有任何保證；換一台電腦、多一個迴圈，結果就可能不同。'), bad ? 'bad' : '');
    else say('psay', '10 次結果都一樣：' + pResult(plan)[0], 'ok');
    return { ok: ok, bad: bad };
  }
  function pPick(k) {
    clearInterval(P.timer); P.k = k;
    Array.prototype.forEach.call($('pscn').children, function (b) { b.classList.toggle('here', b.dataset.k === k); });
    $('pplcw').hidden = !PSC.filter(function (s) { return s.k === k; })[0].plc;
    $('plog').innerHTML = ''; say('psay', ''); pDraw(null, 0);
  }
  PSC.forEach(function (s) { var b = el('button', '', s.name); b.type = 'button'; b.dataset.k = s.k; b.onclick = function () { pPick(s.k); }; $('pscn').appendChild(b); });
  $('prun').onclick = pRun; $('prun10').onclick = pRun10;
  $('pplc').oninput = function () { $('pplcv').textContent = $('pplc').value + ' ms'; pDraw(null, 0); };
  $('pplcv').textContent = $('pplc').value + ' ms';
  pPick('wait');

  /* ================= 3. 線分叉 ================= */
  (function build() {
    var h = '<path class="wire" id="bw0" d="M90 100 H160"/>' +
      '<path class="wire" id="bwA" d="M160 100 V45 H250"/><path class="wire" id="bwB" d="M160 100 V160 H420"/>' +
      '<path class="wire" d="M310 45 H420"/><circle cx="160" cy="100" r="6" fill="#e8820c"/>' +
      '<g class="nd ctl"><rect x="10" y="82" width="80" height="36" rx="3"/><text x="50" y="76" text-anchor="middle">陣列</text><text x="50" y="106" text-anchor="middle">[ ]</text></g>' +
      '<g class="nd fn" id="bop-n"><rect x="250" y="20" width="60" height="50" rx="4"/><text id="bopt" x="280" y="51" text-anchor="middle" style="font-size:14px">改</text></g>' +
      '<g class="nd ind"><rect x="420" y="27" width="80" height="36" rx="3"/><text x="460" y="20" text-anchor="middle">顯示 A</text></g>' +
      '<g class="nd ind"><rect x="420" y="142" width="80" height="36" rx="3"/><text x="460" y="194" text-anchor="middle">顯示 B</text></g>' +
      '<text x="168" y="125" style="font-size:13px" class="mu">分叉：各拿一份</text><g id="bballs"></g>';
    $('bsvg').innerHTML = h;
  })();
  var OPS = {
    rep: { t: 'Replace', f: function (a) { var b = a.slice(); if (b.length) b[0] = 99; return b; } },
    mul: { t: '× 10', f: function (a) { return a.map(function (x) { return x * 10; }); } },
    rev: { t: 'Reverse', f: function (a) { return a.slice().reverse(); } },
    del: { t: 'Delete', f: function (a) { return a.slice(1); } }
  };
  function bParse() { return $('barr').value.split(/[,，\s]+/).filter(function (s) { return s !== ''; }).map(Number).filter(function (x) { return !isNaN(x); }).slice(0, 10); }
  function arrHTML(a, ref) { return a.length ? a.map(function (x, i) { return '<span' + (ref && ref[i] !== x ? ' class="chg"' : '') + '>' + fmt(x) + '</span>'; }).join('') : '<span>空</span>'; }
  var BR = { busy: false };
  function bCompute() { var src = bParse(), op = $('bop').value; return { src: src, A: OPS[op].f(src.slice()), B: src.slice() }; }
  function bShow(r) {
    $('bA').innerHTML = arrHTML(r.A, r.src); $('bB').innerHTML = arrHTML(r.B, r.src);
    $('bA').className = $('bB').className = 'arrv'; void $('bA').offsetWidth; $('bA').className = $('bB').className = 'arrv in';
    say('bsay', '✔ A = ' + fmt(r.A) + '，B 還是 ' + fmt(r.B) + '，和控制元件的 ' + fmt(r.src) + ' 一樣。上面改的是自己那一份。', 'ok');
  }
  function bRun(sync) {
    var r = bCompute(); $('bopt').textContent = OPS[$('bop').value].t;
    if (sync) { bShow(r); return r; }
    if (BR.busy) return r; BR.busy = true; $('bA').innerHTML = $('bB').innerHTML = ''; say('bsay', '');
    balls($('bballs'), [{ p: $('bw0') }], 400, function () { balls($('bballs'), [{ p: $('bwA') }, { p: $('bwB') }], 700, function () { BR.busy = false; bShow(r); }); });
    return r;
  }
  $('brun').onclick = function () { bRun(false); };
  $('bop').onchange = function () { $('bopt').textContent = OPS[$('bop').value].t; };
  $('bopt').textContent = OPS[$('bop').value].t;
  $('bA').innerHTML = $('bB').innerHTML = '<span>–</span>';

  /* ================= 4. 迴圈的邊界 ================= */
  (function build() {
    var h = '<rect x="150" y="20" width="300" height="205" fill="none" stroke="#6b6b6b" stroke-width="8" rx="4"/><text x="160" y="14" style="font-size:13px">While Loop</text>' +
      // 外面的 Gain → 輸入通道
      '<g class="nd ctl"><rect x="8" y="60" width="66" height="34" rx="3"/><text x="41" y="54" text-anchor="middle" style="font-size:13px">外 Gain</text><text id="lsv-go" x="41" y="83" text-anchor="middle">3</text></g>' +
      '<path class="wire" d="M74 77 H143"/><rect x="143" y="70" width="14" height="14" fill="#e8820c" stroke="#92400e"/><text id="lsv-tun" x="128" y="66" text-anchor="middle" style="font-size:13px;font-weight:700">–</text>' +
      '<path class="wire" d="M157 77 H250"/>' +
      // i
      '<rect x="166" y="162" width="24" height="22" fill="none" stroke="#1e5bd7" stroke-width="2"/><text x="178" y="178" text-anchor="middle">i</text>' +
      '<path class="wire" style="stroke:#1e5bd7" d="M190 173 H220 V93 H250 M220 155 H250"/>' +
      // 裡面的 Gain
      '<g class="nd ctl"><rect x="166" y="120" width="44" height="28" rx="3"/><text id="lsv-gi" x="188" y="140" text-anchor="middle">3</text><text x="188" y="116" text-anchor="middle" style="font-size:12px">內 Gain</text></g>' +
      '<path class="wire" d="M210 134 H250"/>' +
      '<g class="nd fn" id="lmA"><rect x="250" y="62" width="40" height="44" rx="4"/><text x="270" y="91" text-anchor="middle" style="font-size:22px">×</text></g>' +
      '<g class="nd fn" id="lmB"><rect x="250" y="122" width="40" height="44" rx="4"/><text x="270" y="151" text-anchor="middle" style="font-size:22px">×</text></g>' +
      '<path class="wire" d="M290 84 H444 M320 84 V60 H340"/><path class="wire" d="M290 144 H340"/>' +
      '<g class="nd ind"><rect x="340" y="44" width="56" height="30" rx="3"/><text id="lsv-A" x="368" y="65" text-anchor="middle">0</text></g>' +
      '<g class="nd ind"><rect x="340" y="129" width="56" height="30" rx="3"/><text id="lsv-B" x="368" y="150" text-anchor="middle">0</text></g>' +
      // 輸出通道 → 結果
      '<rect x="443" y="77" width="14" height="14" fill="#e8820c" stroke="#92400e"/><path class="wire" d="M457 84 H478"/>' +
      '<g class="nd ind"><rect x="478" y="68" width="76" height="32" rx="3"/><text x="516" y="62" text-anchor="middle" style="font-size:13px">結果</text><text id="lsv-R" x="516" y="90" text-anchor="middle">0</text></g>' +
      // Stop
      '<g id="lstopIn"><g class="nd ctl"><rect x="340" y="186" width="56" height="28" rx="3"/><text x="368" y="205" text-anchor="middle" style="font-size:13px">STOP</text></g><path class="wire" style="stroke:#1f9d3a" d="M396 200 H418"/></g>' +
      '<g id="lstopOut"><g class="nd ctl"><rect x="8" y="186" width="56" height="28" rx="3"/><text x="36" y="205" text-anchor="middle" style="font-size:13px">STOP</text></g><path class="wire" style="stroke:#1f9d3a" d="M64 200 H143 M157 200 H418"/><rect x="143" y="193" width="14" height="14" fill="#1f9d3a" stroke="#14532d"/></g>' +
      '<circle cx="428" cy="200" r="10" fill="#dc2626" stroke="#7f1d1d" stroke-width="2"/><text x="428" y="205" text-anchor="middle" style="font-size:11px;fill:#fff">停</text>';
    $('lsvg').innerHTML = h;
  })();
  var L = { run: false, i: 0, tun: null, A: 0, B: 0, R: 0, stop: false, stopTun: null, timer: null, it: 0 };
  function flash(id) { var e = $(id); e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); setTimeout(function () { e.classList.remove('flash'); }, 300); }
  function lDraw() {
    var go = +$('lgos').value, gi = +$('lgis').value;
    $('lgo').textContent = go; $('lgi').textContent = gi;
    $('lA').textContent = L.A; $('lB').textContent = L.B; $('lR').textContent = L.R;
    $('lR').classList.toggle('stale', L.run);
    $('lsv-go').textContent = go; $('lsv-gi').textContent = gi; $('lsv-A').textContent = L.A; $('lsv-B').textContent = L.B; $('lsv-R').textContent = L.R;
    var t = $('lsv-tun'); t.textContent = L.tun == null ? '–' : L.tun; t.style.fill = L.run && L.tun !== go ? '#dc2626' : '';
    $('lstopIn').style.display = $('lout').checked ? 'none' : ''; $('lstopOut').style.display = $('lout').checked ? '' : 'none';
    $('lstop').classList.toggle('on', L.stop);
    $('lrun').disabled = L.run; $('labort').disabled = !L.run; $('lout').disabled = L.run;
    $('lmA').setAttribute('class', 'nd fn' + (L.run ? ' done' : '')); $('lmB').setAttribute('class', 'nd fn' + (L.run ? ' done' : ''));
  }
  function lStart() {
    if (L.run) return;
    L.run = true; L.i = 0; L.it = 0; L.tun = +$('lgos').value;
    var out = $('lout').checked;
    if (out) { L.stopTun = L.stop; L.stop = false; }
    log('llog', '開始：輸入通道讀進外面的 Gain = ' + L.tun + (out ? '，STOP 的通道讀進 ' + (L.stopTun ? 'True' : 'False') : '') + '。迴圈外的「結果」還是上次的 ' + L.R + '。');
    say('lsay', '執行中。拉「外面的 Gain」看看 A 有沒有跟著變。');
    lDraw();
    L.timer = setInterval(lTick, 600);
  }
  function lTick() {
    if (!L.run) return;
    var gi = +$('lgis').value, go = +$('lgos').value;
    L.A = L.i * L.tun; L.B = L.i * gi; flash('lA'); flash('lB');
    var stopNow;
    if ($('lout').checked) stopNow = L.stopTun;
    else { stopNow = L.stop; L.stop = false; }   // Latch：被讀到就彈回
    var note = go !== L.tun ? '（前面板的外面 Gain 已經是 ' + go + '，迴圈裡用的還是 ' + L.tun + '）' : '';
    log('llog', '第 ' + L.i + ' 圈：A = ' + L.i + ' × ' + L.tun + ' = ' + L.A + '，B = ' + L.i + ' × ' + gi + ' = ' + L.B + note);
    if (note) say('lsay', '外面的 Gain 改成 ' + go + ' 了，A 還是用 ' + L.tun + ' 在算：輸入通道只在迴圈開始前讀一次。', 'bad');
    else if ($('lout').checked && L.stopPressedOut) say('lsay', 'STOP 按了，可是迴圈讀的是通道裡開始時的 False，停不下來。只能按 Abort。', 'bad');
    L.it++;
    if (stopNow) { lEnd(); return; }
    L.i++;
    lDraw();
  }
  function lEnd() {
    clearInterval(L.timer); L.timer = null; L.run = false; L.stopPressedOut = false;
    var old = L.R; L.R = L.A; flash('lR');
    log('llog', '迴圈結束（跑了 ' + L.it + ' 圈），輸出通道現在才把最後的 A = ' + L.A + ' 送出去，「結果」從 ' + old + ' 變成 ' + L.R + '。');
    say('lsay', '✔ 迴圈停了，「結果」這時才更新成 ' + L.R + '。執行中它一直停在 ' + old + '。' + ($('lout').checked && L.it === 1 ? ' STOP 在開始前就是 True，所以 While Loop 只跑了 1 圈（While Loop 至少跑 1 圈）。' : ''), 'ok');
    lDraw();
  }
  function lStopBtn() {
    if ($('lout').checked && L.run) { L.stopPressedOut = true; L.stop = true; log('llog', '按了 STOP，但迴圈裡讀的是通道，看不到。'); say('lsay', 'STOP 按了，可是迴圈讀的是通道裡開始時的 ' + (L.stopTun ? 'True' : 'False') + '，停不下來。只能按 Abort。', 'bad'); lDraw(); return; }
    L.stop = true; lDraw();
  }
  function lAbort() {
    if (!L.run) return;
    clearInterval(L.timer); L.timer = null; L.run = false; L.stop = false; L.stopPressedOut = false;
    log('llog', 'Abort：整個 VI 立刻停止。輸出通道沒有送出，「結果」還是 ' + L.R + '。');
    say('lsay', 'Abort 是強制停止：迴圈後面的程式（輸出通道、「結果」、關閉檔案或 COM 埠）都不會執行。正常程式要讓迴圈自己停。', 'bad');
    lDraw();
  }
  $('lrun').onclick = lStart; $('lstop').onclick = lStopBtn; $('labort').onclick = lAbort;
  $('lgos').oninput = $('lgis').oninput = function () { lDraw(); if (L.run && +$('lgos').value !== L.tun) say('lsay', '前面板的外面 Gain = ' + $('lgos').value + '，可是通道裡還是 ' + L.tun + '。看下一圈的 A。', 'bad'); };
  $('lout').onchange = function () { L.stop = false; lDraw(); };
  lDraw();

  if (/^#(rule|par|branch|loop)$/.test(location.hash)) show(location.hash.slice(1));
  window.FlowLab = {
    show: show,
    fReset: fReset, fBeat: function () { return fBeat(true); }, fRunSync: function () { fReset(); var k = 0; while (fBeat(true) && k++ < 50); return F; }, F: function () { return F; },
    pPick: pPick, pPlan: pPlan, pRun10: pRun10, pResult: pResult,
    bCompute: bCompute, bRun: function () { return bRun(true); },
    lStart: lStart, lTick: lTick, lStop: lStopBtn, lAbort: lAbort, L: function () { return L; }
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function r(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  var KIND = [
    function () {
      return { q: 'Add 的 x 已經收到資料，y 還要等前面一個很慢的 SubVI 算完。這段時間 Add 會？', ans: '等，y 也到了才執行', wrong: ['先用 x 和 y 的預設值 0 算一次', '先算，等 y 到了再算一次', '跳過不執行', '用上一次執行時 y 的值算'], ex: '資料流規則：所有輸入都到齊才執行，而且每次執行只算一次。' };
    },
    function () {
      var a = r(10, 40), b = r(10, 40), k = p1([0.5, 2, 10]);
      return { q: '溫度1 = ' + a + '、溫度2 = ' + b + '，接到 Add，Add 的結果和常數 ' + k + ' 接到 Multiply，Multiply 接到顯示元件。顯示多少？', ans: String(+((a + b) * k).toFixed(3)), wrong: [String(+(a + b * k).toFixed(3)), String(a + b), String(+(a * b * k).toFixed(3)), String(+((a + b) / k).toFixed(3))], ex: '照線走：先 ' + a + ' + ' + b + ' = ' + (a + b) + '，再 × ' + k + '。節點擺的位置不影響順序。' };
    },
    function () {
      return { q: '方塊圖上有「讀 PLC」和「寫記錄檔」兩個節點，它們之間<b>沒有任何線</b>。哪一個先執行？', ans: '不一定，LabVIEW 不保證', wrong: ['左邊的先', '上面的先', '先放到方塊圖上的先', '一定同時開始、同時結束'], ex: '沒有線就沒有先後關係，LabVIEW 可以同時執行，也可能任何一個先。需要順序就用錯誤線或資料線串起來。' };
    },
    function () {
      var w = p1([50, 100, 200]), t = p1([30, 80, 150, 250]);
      return { q: '迴圈裡放 Wait ' + w + ' ms，旁邊是讀 PLC（約 ' + t + ' ms），兩者<b>沒有連線</b>。一圈大約多久？', ans: Math.max(w, t) + ' ms', wrong: [(w + t) + ' ms', Math.min(w, t) + ' ms', w + ' ms（Wait 說了算）', t + ' ms（讀 PLC 說了算）', Math.abs(w - t) + ' ms'], ex: '兩者平行執行，迴圈要等裡面每個節點都做完才進下一圈，所以一圈是比較長的那個：' + Math.max(w, t) + ' ms。' };
    },
    function () {
      var a = p1([30, 60, 90]), b = p1([20, 40, 50]);
      return { q: '讀 PLC（約 ' + a + ' ms）的 error out 接到寫檔（約 ' + b + ' ms）的 error in。兩個做完大約多久？', ans: (a + b) + ' ms', wrong: [Math.max(a, b) + ' ms', Math.min(a, b) + ' ms', Math.abs(a - b) + ' ms', '不一定，看誰先'], ex: '錯誤線讓寫檔要等讀 PLC 的 error out 送出（也就是讀 PLC 做完）才開始，所以是一個接一個：' + a + ' + ' + b + ' = ' + (a + b) + ' ms。' };
    },
    function () {
      var arr = [r(1, 9), r(1, 9), r(1, 9)];
      return { q: '陣列控制元件 [' + arr.join(', ') + '] 的線分叉成兩條：上面那條經過 Replace Array Subset 把第 0 個換成 99 接到顯示 A，下面那條直接接到顯示 B。顯示 B 是？', ans: '[' + arr.join(', ') + ']', wrong: ['[99, ' + arr[1] + ', ' + arr[2] + ']', '[99]', '空陣列', '看誰先執行，可能是兩種之一'], ex: '分叉時每條線拿到的都是自己的一份，上面改的不會影響下面。' };
    },
    function () {
      var a = r(2, 5), b = r(6, 9);
      return { q: 'Gain 控制元件在 While Loop <b>外面</b>，經過輸入通道接進迴圈。執行前 Gain = ' + a + '，執行中把它改成 ' + b + '。迴圈裡用的 Gain 是？', ans: '一直是 ' + a, wrong: ['下一圈就變成 ' + b, '迴圈裡會讀到 ' + a + ' 和 ' + b + ' 的平均', '迴圈會自動重新開始，改用 ' + b, '變成 0'], ex: '輸入通道在迴圈開始前就讀一次值，之後前面板怎麼改都進不來。要讀到新值，就把端子放進迴圈裡。' };
    },
    function () {
      return { q: '迴圈裡算出的值經過輸出通道（不是自動索引）接到迴圈外的顯示元件。迴圈執行中這個顯示元件會？', ans: '不動，還是上次的值，迴圈結束才更新', wrong: ['每一圈都更新', '每兩圈更新一次', '顯示 0，結束後才顯示', '會閃爍顯示每一圈的值'], ex: 'While Loop 是一個節點，要整個執行完才把輸出送出去。想在執行中看到值，就把顯示元件放進迴圈裡。' };
    },
    function () {
      return { q: 'Stop 按鈕的端子放在 While Loop 外面，經過通道接到條件端子（Stop if True）。執行時 Stop 是 False，執行中按下 Stop，會怎樣？', ans: '迴圈停不下來，只能 Abort', wrong: ['下一圈就停', '馬上停', '跑完目前這圈就停', '出現錯誤訊息'], ex: '通道只在開始前讀到 False，迴圈永遠看不到按鈕後來的變化。Stop 的端子一定要放在迴圈裡。' };
    },
    function () {
      return { q: 'Stop 按鈕的端子在 While Loop 外面，<b>執行前</b>它就已經是 True。While Loop 會跑幾圈？', ans: '1 圈', wrong: ['0 圈，一開始就不跑', '2 圈', '一直跑', '看電腦速度'], ex: 'While Loop 是先執行裡面的程式，每圈結束才檢查條件端子，所以至少跑 1 圈。第 0 圈結束看到 True 就停。' };
    },
    function () {
      return { q: '把兩個 Add 的輸出線接到同一個顯示元件，會怎樣？', ans: '斷線，VI 不能執行', wrong: ['顯示兩個值的和', '顯示後執行完的那個', '顯示先執行完的那個', '兩個值輪流顯示'], ex: '一個輸入只能有一個來源，LabVIEW 不知道要聽誰的，線會變成斷線（虛線加紅叉），執行箭頭也會斷掉。反過來一個輸出接很多輸入（分叉）就可以。' };
    },
    function () {
      return { q: '開了 Highlight Execution（燈泡）再執行，下面哪一個正確？', ans: '程式變慢，線上看得到流過的值', wrong: ['計算結果會不一樣', '平行的節點會改成固定順序', '只會執行到第一個節點就停', '程式跑得更快'], ex: 'Highlight Execution 是除錯用的慢動作，結果不變，只是讓你看清楚資料怎麼流。正式執行要關掉。' };
    }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) window.FlowLab.quiz = window.LabQuiz('qquiz', gen);
  window.FlowLab.quizGen = gen; window.FlowLab.quizKinds = KIND;
})();
