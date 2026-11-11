/* SubVI 實驗室：接線端配置、Required/Recommended/Optional、可重入 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function log(id, s) { var l = $(id); l.insertBefore(el('div', '', s), l.firstChild); }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }

  var tabs = $('tabs');
  function show(t) {
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['conn', 'req', 'reent'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* ================= 1. 接線端 ================= */
  var ITEMS = [
    { id: 'visaIn', lab: 'VISA resource name', dir: 'in', ty: 'ref', col: '#7c3aed' },
    { id: 'd', lab: 'D 編號', dir: 'in', ty: 'num', col: '#1e5bd7' },
    { id: 'n', lab: '字數', dir: 'in', ty: 'num', col: '#1e5bd7' },
    { id: 'errIn', lab: 'error in', dir: 'in', ty: 'err', col: '#a16207' },
    { id: 'visaOut', lab: 'VISA resource name out', dir: 'out', ty: 'ref', col: '#7c3aed' },
    { id: 'vals', lab: '讀到的值', dir: 'out', ty: 'num', col: '#1e5bd7' },
    { id: 'errOut', lab: 'error out', dir: 'out', ty: 'err', col: '#a16207' }
  ];
  var IB = {}; ITEMS.forEach(function (x) { IB[x.id] = x; });
  /* 4-2-2-4：外框 x 30～230、y 10～190 */
  var CELLS = [], PX = 30, PY = 10, CW = 50, PH = 180;
  [0, 1, 2, 3].forEach(function (r) { CELLS.push({ id: 'L' + r, col: 0, x: PX, y: PY + r * PH / 4, w: CW, h: PH / 4, side: 'L', name: '左邊第 ' + (r + 1) + ' 格' }); });
  [0, 1].forEach(function (r) { CELLS.push({ id: 'ML' + r, col: 1, x: PX + CW, y: PY + r * PH / 2, w: CW, h: PH / 2, side: 'L', name: '中間偏左' + (r ? '下' : '上') + '格' }); });
  [0, 1].forEach(function (r) { CELLS.push({ id: 'MR' + r, col: 2, x: PX + 2 * CW, y: PY + r * PH / 2, w: CW, h: PH / 2, side: 'R', name: '中間偏右' + (r ? '下' : '上') + '格' }); });
  [0, 1, 2, 3].forEach(function (r) { CELLS.push({ id: 'R' + r, col: 3, x: PX + 3 * CW, y: PY + r * PH / 4, w: CW, h: PH / 4, side: 'R', name: '右邊第 ' + (r + 1) + ' 格' }); });
  var CB = {}; CELLS.forEach(function (c) { CB[c.id] = c; });
  var GOOD = { visaIn: 'L0', d: 'L1', n: 'L2', errIn: 'L3', visaOut: 'R0', vals: 'R1', errOut: 'R3' };
  var C = { sel: null, map: {} };   // map：格子 id → 元件 id
  function cellOf(item) { for (var k in C.map) if (C.map[k] === item) return k; return null; }
  function cAssign(item, cell) {
    if (!IB[item] || !CB[cell]) return;
    var old = cellOf(item); if (old) delete C.map[old];
    C.map[cell] = item; C.sel = null; cDraw();
  }
  function cClear(cell) { delete C.map[cell]; cDraw(); }
  function cCheck() {
    var t = [], bad = 0;
    ITEMS.forEach(function (it) {
      var c = cellOf(it.id);
      if (!c) { t.push(['bad', it.lab + ' 還沒指定到格子：呼叫端接不到它。']); bad++; return; }
      var side = CB[c].side;
      if (it.dir === 'in' && side === 'R') { t.push(['bad', it.lab + ' 是輸入（控制元件），卻放在右半邊。']); bad++; }
      if (it.dir === 'out' && side === 'L') { t.push(['bad', it.lab + ' 是輸出（顯示元件），卻放在左半邊。']); bad++; }
      if (it.id === 'errIn' && c !== 'L3') { t.push(['bad', 'error in 習慣放在左下角（左邊第 4 格），現在在' + CB[c].name + '。']); bad++; }
      if (it.id === 'errOut' && c !== 'R3') { t.push(['bad', 'error out 習慣放在右下角（右邊第 4 格），現在在' + CB[c].name + '。']); bad++; }
      if (it.id === 'visaIn' && c !== 'L0') { t.push(['bad', 'VISA 參考的輸入習慣放在左上角，現在在' + CB[c].name + '。']); bad++; }
      if (it.id === 'visaOut' && c !== 'R0') { t.push(['bad', 'VISA 參考的輸出習慣放在右上角，現在在' + CB[c].name + '。']); bad++; }
    });
    if (!bad) t.push(['ok', '✔ 全部符合慣例：參考線和錯誤線在圖示上下各成一條直線，輸入在左、輸出在右。']);
    return { tips: t, bad: bad };
  }
  function cDraw() {
    // 元件清單
    $('citems').innerHTML = '';
    ITEMS.forEach(function (it) {
      var b = el('button', (C.sel === it.id ? 'here' : '') + (cellOf(it.id) ? ' used' : ''), '<i style="background:' + it.col + '"></i>' + it.lab + ' <small>' + (it.dir === 'in' ? '控制' : '顯示') + (cellOf(it.id) ? '・' + CB[cellOf(it.id)].name : '') + '</small>');
      b.type = 'button'; b.onclick = function () { C.sel = C.sel === it.id ? null : it.id; cDraw(); };
      $('citems').appendChild(b);
    });
    // 接線端
    var h = '';
    CELLS.forEach(function (c) {
      var it = IB[C.map[c.id]];
      h += '<g class="cell" data-c="' + c.id + '"><rect x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '" fill="' + (it ? it.col : 'var(--card)') + '" fill-opacity="' + (it ? .85 : 1) + '" stroke="#555" stroke-width="1.5"/>';
      if (it) h += '<text x="' + (c.x + c.w / 2) + '" y="' + (c.y + c.h / 2 + 4) + '" text-anchor="middle" style="fill:#fff;font-size:11px;font-weight:700">' + (it.dir === 'in' ? '入' : '出') + '</text>';
      h += '</g>';
    });
    h += '<rect x="' + PX + '" y="' + PY + '" width="' + 4 * CW + '" height="' + PH + '" fill="none" stroke="#111" stroke-width="2.5"/>';
    $('cpane').innerHTML = h;
    Array.prototype.forEach.call($('cpane').querySelectorAll('.cell'), function (g) {
      g.onclick = function () { var c = g.dataset.c; if (C.sel) cAssign(C.sel, c); else if (C.map[c]) cClear(c); };
    });
    // 呼叫端圖示
    var IX = 230, IY = 60, IW = 100, IH = 110, s = '';
    s += '<rect x="' + IX + '" y="' + IY + '" width="' + IW + '" height="' + IH + '" fill="#fff7d6" stroke="#333" stroke-width="2"/><text x="' + (IX + IW / 2) + '" y="' + (IY + 48) + '" text-anchor="middle" style="font-size:18px;font-weight:700;fill:#333">FX</text><text x="' + (IX + IW / 2) + '" y="' + (IY + 72) + '" text-anchor="middle" style="font-size:15px;fill:#333">READ D</text>';
    CELLS.forEach(function (c) {
      var it = IB[C.map[c.id]]; if (!it) return;
      var px, py, x2, y2, anchor, tx, ty;
      if (c.col === 0 || c.col === 3) {
        py = IY + (c.y - PY + c.h / 2) / PH * IH; px = c.col === 0 ? IX : IX + IW; x2 = c.col === 0 ? px - 60 : px + 60; y2 = py;
        anchor = c.col === 0 ? 'end' : 'start'; tx = c.col === 0 ? x2 - 4 : x2 + 4; ty = py + 4;
      } else {
        px = IX + (c.x - PX + c.w / 2) / (4 * CW) * IW; py = c.y === PY ? IY : IY + IH; x2 = px; y2 = c.y === PY ? py - 30 : py + 30;
        anchor = c.col === 1 ? 'end' : 'start'; tx = c.col === 1 ? px + 8 : px - 8; ty =c.y === PY ? y2 - 6 : y2 + 16;
      }
      s += '<line x1="' + px + '" y1="' + py + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + it.col + '" stroke-width="' + (it.ty === 'num' && it.id === 'vals' ? 5 : 3) + '"/>';
      s += '<circle cx="' + px + '" cy="' + py + '" r="4" fill="' + it.col + '"/>';
      s += '<text x="' + tx + '" y="' + ty + '" text-anchor="' + anchor + '" style="font-size:12px">' + it.lab + '</text>';
    });
    if (!Object.keys(C.map).length) s += '<text x="280" y="200" text-anchor="middle" class="mu" style="font-size:13px">還沒有任何接腳：這個 VI 放進別的方塊圖，什麼都接不了</text>';
    $('cicon').innerHTML = s;
    var r = cCheck();
    $('ctips').innerHTML = (C.sel ? '<li>已選「' + IB[C.sel].lab + '」，點右邊一格放上去。</li>' : '') + r.tips.map(function (t) { return '<li class="' + t[0] + '">' + t[1] + '</li>'; }).join('');
  }
  $('cauto').onclick = function () { C.map = {}; Object.keys(GOOD).forEach(function (k) { C.map[GOOD[k]] = k; }); C.sel = null; cDraw(); };
  $('cmess').onclick = function () {
    C.map = {}; C.sel = null;
    var cs = CELLS.map(function (c) { return c.id; });
    for (var i = cs.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = cs[i]; cs[i] = cs[j]; cs[j] = t; }
    ITEMS.forEach(function (it, i) { C.map[cs[i]] = it.id; }); cDraw();
  };
  $('cclear').onclick = function () { C.map = {}; C.sel = null; cDraw(); };
  cDraw();

  /* ================= 2. Required / Recommended / Optional ================= */
  var INS = [
    { id: 'raw', lab: '原始值', def: 0, set: 'req', wired: true, val: 250 },
    { id: 'gain', lab: '倍率', def: 1, set: 'rec', wired: false, val: 10 },
    { id: 'off', lab: '偏移', def: 0, set: 'opt', wired: false, val: -5 }
  ];
  var SETN = { req: 'Required', rec: 'Recommended', opt: 'Optional' };
  var RQ = { n: 0, last: {} };
  function rBuild() {
    $('rins').innerHTML = '';
    INS.forEach(function (x) {
      var d = el('div', 'inrow', '<div class="h"><b>' + x.lab + '</b><label><select data-k="set">' + Object.keys(SETN).map(function (k) { return '<option value="' + k + '"' + (k === x.set ? ' selected' : '') + '>' + SETN[k] + '</option>'; }).join('') + '</select></label>' +
        '<label class="check small"><input type="checkbox" data-k="wired"' + (x.wired ? ' checked' : '') + '> 有接線</label>' +
        '<label>傳 <input type="number" data-k="val" value="' + x.val + '" style="width:80px"></label></div>');
      d.id = 'rin-' + x.id;
      d.querySelector('[data-k=set]').onchange = function (e) { x.set = e.target.value; rDraw(); };
      d.querySelector('[data-k=wired]').onchange = function (e) { x.wired = e.target.checked; rDraw(); };
      d.querySelector('[data-k=val]').oninput = function (e) { x.val = +e.target.value || 0; };
      $('rins').appendChild(d);
    });
  }
  function rBroken() { return INS.filter(function (x) { return x.set === 'req' && !x.wired; }); }
  function arrowSVG(ok) {
    return ok ? '<svg viewBox="0 0 34 26"><path d="M2 4 L28 13 L2 22 Z" fill="#fff" stroke="#111" stroke-width="2"/></svg>可以執行'
      : '<svg viewBox="0 0 34 26"><path d="M2 4 L14 8 L11 13 L14 18 L2 22 Z M18 9 L28 13 L18 17 L21 13 Z" fill="#9ca3af" stroke="#111" stroke-width="2"/></svg><span style="color:#dc2626">執行箭頭斷了</span>';
  }
  function rDraw(use) {
    var br = rBroken();
    $('rarrow').innerHTML = arrowSVG(!br.length);
    $('rrun').disabled = false;
    INS.forEach(function (x) {
      var d = $('rin-' + x.id); d.className = 'inrow' + (!x.wired && x.set === 'req' ? ' miss' : use && use[x.id] ? ' dflt' : '');
      d.querySelector('[data-k=val]').disabled = !x.wired;
    });
    $('rch').innerHTML = '<b>換算.vi</b><br>' + INS.map(function (x) { return '<span class="' + x.set + '">' + x.lab + '</span>'; }).join('　') + '　→　結果';
    $('rsfp').innerHTML = INS.map(function (x) { return '<div class="' + (use && use[x.id] ? 'use' : '') + '">' + x.lab + '<b>' + x.def + '</b></div>'; }).join('');
    if (br.length) say('rsay', '✖ ' + br.map(function (x) { return x.lab; }).join('、') + ' 是 Required 卻沒接線：Error List 會列出「必要的輸入沒有接線」，VI 不能執行。', 'bad');
  }
  function rRun() {
    var br = rBroken(), use = {};
    if (br.length) { rDraw(); log('rlog', '按了執行，但箭頭是斷的，什麼都沒發生。先把 ' + br.map(function (x) { return x.lab; }).join('、') + ' 接上。'); return null; }
    RQ.n++;
    var v = {}, notes = [];
    INS.forEach(function (x) {
      if (x.wired) { v[x.id] = x.val; RQ.last[x.id] = x.val; }
      else {
        v[x.id] = x.def; use[x.id] = 1;
        notes.push(x.lab + '（' + SETN[x.set] + '）沒接 → 用預設值 ' + x.def + (RQ.last[x.id] != null && RQ.last[x.id] !== x.def ? '，不是上次傳的 ' + RQ.last[x.id] : ''));
      }
    });
    var out = v.raw * v.gain + v.off;
    $('rout').textContent = out;
    rDraw(use);
    log('rlog', '第 ' + RQ.n + ' 次執行：' + v.raw + ' × ' + v.gain + ' + ' + v.off + ' = ' + out + (notes.length ? '；' + notes.join('；') : ''));
    say('rsay', notes.length ? '✔ 可以執行。' + notes.join('；') + '。黃色就是被用上的預設值。' : '✔ 三個都有接，全部用呼叫端傳的值。', 'ok');
    return { out: out, used: use };
  }
  $('rrun').onclick = rRun;
  rBuild(); rDraw();

  /* ================= 3. 可重入 ================= */
  var N = 3, E = { timer: null, plan: null, now: 0 };
  /* 模擬兩個迴圈各呼叫 N 次。tie = 同時要求時誰先（'A'、'B' 或 undefined 用亂數） */
  function eSim(mode, D, tie) {
    var runs = [], loops = { A: { req: 0, left: N }, B: { req: 0, left: N } };
    if (mode === 'pre') {
      ['A', 'B'].forEach(function (k) { for (var i = 0; i < N; i++) runs.push({ loop: k, wS: i * D, s: i * D, e: (i + 1) * D, val: i + 1, clone: k }); });
      return { runs: runs, total: N * D, mode: mode };
    }
    var free = 0, cnt = 0;
    while (loops.A.left || loops.B.left) {
      var c = ['A', 'B'].filter(function (k) { return loops[k].left; });
      c.sort(function (a, b) { return loops[a].req - loops[b].req; });
      var k = c[0];
      if (c.length === 2 && loops.A.req === loops.B.req) k = tie || (Math.random() < .5 ? 'A' : 'B');
      var L = loops[k], s = Math.max(L.req, free);
      cnt++; runs.push({ loop: k, wS: L.req, s: s, e: s + D, val: cnt, clone: 'X' });
      free = s + D; L.req = s + D; L.left--;
    }
    return { runs: runs, total: free, mode: mode };
  }
  function eDraw() {
    var P = E.plan, D = +$('edur').value, max = 2 * N * D * 1.04, t = E.now, mode = P ? P.mode : $('emode').value;
    var h = '';
    ['A', 'B'].forEach(function (k) {
      h += '<div class="gl"><span>迴圈 ' + k + '</span><div class="gtrack">';
      if (P) P.runs.filter(function (r) { return r.loop === k; }).forEach(function (r) {
        if (r.s > r.wS && t > r.wS) h += '<span class="gbar wait" style="left:' + (r.wS / max * 100) + '%;width:' + ((Math.min(t, r.s) - r.wS) / max * 100) + '%">' + (t >= r.s ? '等' : '') + '</span>';
        if (t > r.s) h += '<span class="gbar run' + (k === 'B' ? ' b' : '') + '" style="left:' + (r.s / max * 100) + '%;width:' + ((Math.min(t, r.e) - r.s) / max * 100) + '%">' + (t >= r.e ? '#' + r.val : '') + '</span>';
      });
      h += (P ? '<span class="gcur" style="left:' + Math.min(100, t / max * 100) + '%"></span>' : '') + '</div></div>';
    });
    h += '<div class="gl"><span>時間</span><span style="font:13px ui-monospace,Consolas,monospace">' + Math.round(P ? Math.min(t, P.total) : 0) + ' ms</span></div>';
    $('egantt').innerHTML = h;
    // 記憶體
    var clones = mode === 'pre' ? [['A', 'A 呼叫點的那一份'], ['B', 'B 呼叫點的那一份']] : [['X', '只有一份（大家共用）']], mh = '';
    clones.forEach(function (c) {
      var done = P ? P.runs.filter(function (r) { return r.clone === c[0] && r.e <= t; }) : [], busy = P ? P.runs.filter(function (r) { return r.clone === c[0] && r.s <= t && t < r.e; })[0] : null;
      mh += '<div class="clone' + (busy ? ' busy' + busy.loop : '') + '"><b>慢讀.vi</b><small>' + c[1] + '</small>Shift Register<br><b class="sr">' + done.length + '</b><small>' + (busy ? '迴圈 ' + busy.loop + ' 在裡面' : '空著') + '</small></div>';
    });
    $('emem').innerHTML = mh;
    ['A', 'B'].forEach(function (k) { var g = P ? P.runs.filter(function (r) { return r.loop === k && r.e <= t; }).map(function (r) { return r.val; }) : []; $('eg' + k).textContent = g.length ? g.join(', ') : '–'; });
  }
  function eResult(P) {
    var D = P.runs[0].e - P.runs[0].s, wait = P.runs.reduce(function (a, r) { return a + (r.s - r.wS); }, 0);
    var gA = P.runs.filter(function (r) { return r.loop === 'A'; }).map(function (r) { return r.val; }).join(', '), gB = P.runs.filter(function (r) { return r.loop === 'B'; }).map(function (r) { return r.val; }).join(', ');
    if (P.mode === 'non') return ['兩個迴圈做完共 ' + P.total + ' ms（' + 2 * N + ' 次 × ' + D + ' ms，一次只能一個），排隊等了合計 ' + wait + ' ms。計數器只有一個：A 拿到 ' + gA + '、B 拿到 ' + gB + '，輪流往上加到 ' + 2 * N + '。', ''];
    return ['兩個迴圈同時跑，共 ' + P.total + ' ms，沒有人排隊。各自一份計數器：A 拿到 ' + gA + '、B 拿到 ' + gB + '。', 'ok'];
  }
  function eRun() {
    clearInterval(E.timer);
    var P = eSim($('emode').value, +$('edur').value); E.plan = P; E.now = 0;
    var step = 2 * N * (+$('edur').value) / 90;
    say('esay', '');
    E.timer = setInterval(function () {
      E.now += step; eDraw();
      if (E.now >= P.total) { clearInterval(E.timer); E.timer = null; E.now = P.total; eDraw(); var r = eResult(P); say('esay', r[0], r[1]); }
    }, 35);
  }
  $('erun').onclick = eRun;
  $('emode').onchange = $('edur').onchange = function () { clearInterval(E.timer); E.plan = null; E.now = 0; say('esay', ''); eDraw(); };
  eDraw();

  if (/^#(conn|req|reent)$/.test(location.hash)) show(location.hash.slice(1));
  window.SubviLab = {
    show: show,
    ITEMS: ITEMS, CELLS: CELLS, GOOD: GOOD, cAssign: cAssign, cClear: cClear, cCheck: cCheck, C: function () { return C; },
    INS: INS, rRun: rRun, rDraw: rDraw, rBroken: rBroken,
    eSim: eSim, eResult: eResult, eRun: eRun, E: function () { return E; },
    showAll: function (P) { clearInterval(E.timer); E.plan = P; E.now = P.total; eDraw(); }
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function r(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  var KIND = [
    function () {
      return { q: '把自己做的 VI 拖到別的方塊圖裡，圖示上卻沒有任何接腳可以接線。最可能的原因？', ans: '沒有把前面板元件指定到接線端的格子', wrong: ['沒有畫 Icon', 'VI 還沒存成 .llb', '前面板元件沒有標籤', '要先執行一次 SubVI'], ex: '接線端（Connector Pane）的格子決定哪些前面板元件是對外的端子；沒指定就接不到。Icon 只是外觀。' };
    },
    function () {
      var w = p1([['error out', '右下角'], ['error in', '左下角'], ['參考（refnum）的輸入', '左上角'], ['參考（refnum）的輸出', '右上角']]);
      return { q: '照 NI 的慣例，<b>' + w[0] + '</b> 放在接線端的哪裡？', ans: w[1], wrong: ['左上角', '右上角', '左下角', '右下角', '正中間'].filter(function (x) { return x !== w[1]; }), ex: '參考在上、錯誤在下，左進右出。這樣一串 SubVI 的參考線和錯誤線都是直線。' };
    },
    function () {
      return { q: 'SubVI 的「D 編號」設成 <b>Required</b>，呼叫端沒接線。會怎樣？', ans: '呼叫端的執行箭頭斷掉，不能執行', wrong: ['用預設值 0 執行', '執行時跳出錯誤對話框', '用上一次呼叫的值', 'LabVIEW 自動接一個常數'], ex: 'Required 就是「一定要接」，沒接就是編輯階段的錯誤，Error List 會列出來。' };
    },
    function () {
      var s = p1(['Recommended', 'Optional']);
      return { q: 'SubVI 的「倍率」設成 <b>' + s + '</b>，呼叫端沒接線。會怎樣？', ans: '可以執行，用倍率控制元件的預設值', wrong: ['執行箭頭斷掉', '用 0', '執行時跳錯誤', '用上一次呼叫傳的值'], ex: s + ' 的輸入可以不接，SubVI 用控制元件存檔時的預設值。' };
    },
    function () {
      var last = r(5, 9) * 10, def = p1([1, 2]);
      return { q: '「倍率」是 Recommended，SubVI 前面板存檔時的預設值是 ' + def + '。第一次呼叫有接線傳 ' + last + '，第二次呼叫沒接線。第二次 SubVI 用的倍率是？', ans: String(def), wrong: [String(last), '0', String(last + def), '隨機'], ex: '沒接線的輸入每次都用預設值，不會記住上一次呼叫傳的值。' };
    },
    function () {
      var a = r(2, 9) * 10, def = p1([1, 2, 5]), off = r(1, 9);
      return { q: '換算.vi：結果 ＝ 原始值 × 倍率 ＋ 偏移。呼叫端接了原始值 = ' + a + '、偏移 = ' + off + '，倍率沒接（預設值 ' + def + '）。結果是？', ans: String(a * def + off), wrong: [String(a + off), String(a * def), String(off), String((a + off) * def), String(a * 10 + off), String(a * def - off), String(a * (def + 1) + off)], ex: '倍率用預設值 ' + def + '：' + a + ' × ' + def + ' + ' + off + ' = ' + (a * def + off) + '。' };
    },
    function () {
      var s = p1([['Required', '粗體'], ['Recommended', '一般字體'], ['Optional', '淡色']]);
      return { q: '按 Ctrl+H 開 Context Help，指到 SubVI 上。設成 <b>' + s[0] + '</b> 的端子名稱顯示成？', ans: s[1], wrong: ['粗體', '一般字體', '淡色', '紅色', '加底線'].filter(function (x) { return x !== s[1]; }), ex: 'Required 粗體、Recommended 一般、Optional 淡色。看 Context Help 就知道哪些一定要接。' };
    },
    function () {
      var d = p1([100, 200, 500]), n = p1([2, 3, 4]);
      return { q: '兩個平行迴圈各呼叫同一個 SubVI ' + n + ' 次，SubVI 每次要 ' + d + ' ms。SubVI 是 <b>Non-reentrant（預設）</b>。兩個迴圈都做完大約要多久？', ans: 2 * n * d + ' ms', wrong: [n * d + ' ms', d + ' ms', 2 * d + ' ms', 4 * n * d + ' ms'], ex: '記憶體裡只有一份，一次只能一個呼叫者執行，' + 2 * n + ' 次排成一列：' + 2 * n + ' × ' + d + ' = ' + 2 * n * d + ' ms。' };
    },
    function () {
      var d = p1([100, 200, 500]), n = p1([2, 3, 4]);
      return { q: '同上（兩個迴圈各呼叫 ' + n + ' 次，每次 ' + d + ' ms），但 SubVI 改成 <b>Preallocated clone reentrant</b>。大約要多久？', ans: n * d + ' ms', wrong: [2 * n * d + ' ms', d + ' ms', (n + 1) * d + ' ms', 2 * d + ' ms'], ex: '每個呼叫位置各一份，兩個迴圈同時跑，互不等待：' + n + ' × ' + d + ' = ' + n * d + ' ms。' };
    },
    function () {
      var n = p1([2, 3, 4]);
      return { q: 'SubVI 裡有一個沒接初始值的 Shift Register，每呼叫一次加 1。它是 <b>Non-reentrant</b>，兩個平行迴圈各呼叫 ' + n + ' 次，全部做完後 Shift Register 裡是多少？', ans: String(2 * n), wrong: [String(n), '1', '0', String(n + 1)], ex: 'Non-reentrant 只有一份記憶，兩個迴圈的呼叫共用同一個計數器：' + n + ' + ' + n + ' = ' + 2 * n + '。' };
    },
    function () {
      var n = p1([2, 3, 4]);
      return { q: '同一個計數器 SubVI 改成 <b>Preallocated clone reentrant</b>，兩個平行迴圈各呼叫 ' + n + ' 次。迴圈 A 最後一次拿到的值是？', ans: String(n), wrong: [String(2 * n), String(2 * n - 1), '1', '不一定，看誰先'], ex: '每個呼叫位置一份，A 的那份只被 A 呼叫 ' + n + ' 次。' };
    },
    function () {
      return { q: 'FGV（功能型全域變數）要讓好幾個迴圈共用同一份資料，它的 Reentrancy 要設成？', ans: 'Non-reentrant', wrong: ['Preallocated clone reentrant', 'Shared clone reentrant', '哪一種都可以', '要設成 Inline'], ex: 'FGV 靠「記憶體裡只有一份、一次只讓一個進去」來共用資料又不被插隊。改成 reentrant，每個呼叫點各有一份，就不共用了。' };
    },
    function () {
      return { q: '一個很慢的 Non-reentrant SubVI 被兩個平行迴圈同時呼叫，最可能看到什麼現象？', ans: '兩個迴圈互相拖慢，輪流等', wrong: ['只有一個迴圈能呼叫成功，另一個出錯', 'VI 斷掉不能執行', '兩個迴圈速度都不受影響', 'LabVIEW 自動改成 reentrant'], ex: '一次只能一個進去，另一個在門口等，兩邊的迴圈時間都會被拉長。' };
    },
    function () {
      return { q: '「D 編號」是 SubVI 的<b>輸入</b>，接線端最好放在哪一邊？', ans: '左半邊', wrong: ['右半邊', '正上方中間', '哪裡都一樣，沒有慣例', '一定要在右下角'], ex: '輸入在左、輸出在右，和資料流從左往右的畫法一致。' };
    }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) window.SubviLab.quiz = window.LabQuiz('squiz', gen);
  window.SubviLab.quizGen = gen; window.SubviLab.quizKinds = KIND;
})();
