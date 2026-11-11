/* 計時器與計數器實驗室：一般計時器、積算計時器、計數器與停電保持、掃描順序、猜一猜
   計時器、計數器的動作和本站模擬器 engine/plc_engine.py 相同：OUT T 那一行執行時才累加時間、更新接點；
   OUT C 只在上升緣加 1，現在值到設定值就停。元件範圍照課程 A2、A3 與停電保持那一課（FX3S 硬體手冊 4.5 節）。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function distinct(ans, list) { var seen = {}; seen[ans] = 1; return list.filter(function (w) { if (seen[w]) return false; seen[w] = 1; return true; }); }
  function say(id, t, cls) { $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); $(id).textContent = t; }

  /* ---------- 計時器、計數器（純函式，給測試用） ---------- */
  /* FX3S：T0～T31 100 ms；T32～T62 100 ms（M8028 ON 時 10 ms）；T63～T127 1 ms；T128～T131 1 ms 積算；T132～T137 100 ms 積算 */
  function timerUnit(n, m8028) {
    if (n <= 31) return { unit: 100, keep: false };
    if (n <= 62) return { unit: m8028 ? 10 : 100, keep: false };
    if (n <= 127) return { unit: 1, keep: false };
    if (n <= 131) return { unit: 1, keep: true };
    if (n <= 137) return { unit: 100, keep: true };
    return null;
  }
  function newTimer(n, k, m8028) { var u = timerUnit(n, m8028); return { n: n, k: k, unit: u.unit, keep: u.keep, acc: 0, on: false }; }
  function timerStep(t, coil, dt) {
    if (coil) { t.acc = Math.min(t.acc + dt, 32767 * t.unit); t.on = Math.floor(t.acc / t.unit) >= t.k; }
    else if (!t.keep) { t.acc = 0; t.on = false; }
    return t;
  }
  function timerCur(t) { return Math.floor(t.acc / t.unit); }
  /* 畫面上的現在值：到設定值以後只寫「到了」，不顯示超過設定值的數字（實機是否繼續往上數，本頁不下結論） */
  function curText(t) { var v = timerCur(t); return v >= t.k ? t.k + '（到了）' : String(v); }
  function timerRst(t) { t.acc = 0; t.on = false; }
  function newCounter(n, k) { return { n: n, k: Math.max(1, k), val: 0, on: false, prev: false }; }
  function counterStep(c, coil) {
    if (coil && !c.prev && c.val < c.k) c.val++;
    c.prev = coil; c.on = c.val >= c.k; return c;
  }
  function counterRst(c) { c.val = 0; c.on = false; }
  /* FX3S 停電保持：T128～T137、C16～C31（停電保持那一課的表） */
  function latched(kind, n) { return kind === 'T' ? n >= 128 && n <= 137 : n >= 16 && n <= 31; }
  function powerCycle(list) {
    list.forEach(function (o) {
      var kind = o.unit ? 'T' : 'C';
      if (latched(kind, o.n)) return;
      if (kind === 'T') timerRst(o); else counterRst(o);
    });
  }

  /* ---------- 梯形圖 ---------- */
  function ladder(svg, rows, curRow) {
    var H = 22 + rows.length * 50, s = '';
    svg.setAttribute('viewBox', '0 0 640 ' + H);
    s += '<line class="rail" x1="20" y1="8" x2="20" y2="' + (H - 8) + '"/><line class="rail" x1="620" y1="8" x2="620" y2="' + (H - 8) + '"/>';
    rows.forEach(function (r, i) {
      var y = 36 + i * 50, flow = r.on;
      if (curRow === i) s += '<g class="cur"><rect x="24" y="' + (y - 24) + '" width="592" height="46" rx="4"/></g>';
      s += '<line class="w on" x1="20" y1="' + y + '" x2="96" y2="' + y + '"/>';
      s += '<rect class="ctf' + (r.on ? ' on' : '') + '" x="96" y="' + (y - 14) + '" width="22" height="28"/>';
      s += '<line class="ct' + (r.on ? ' on' : '') + '" x1="98" y1="' + (y - 14) + '" x2="98" y2="' + (y + 14) + '"/><line class="ct' + (r.on ? ' on' : '') + '" x1="116" y1="' + (y - 14) + '" x2="116" y2="' + (y + 14) + '"/>';
      s += '<text class="lab" x="107" y="' + (y - 18) + '" text-anchor="middle">' + r.c + '</text>';
      s += '<line class="w' + (flow ? ' on' : '') + '" x1="118" y1="' + y + '" x2="' + (r.box ? 420 : 500) + '" y2="' + y + '"/>';
      if (r.box) {
        s += '<rect class="ct' + (r.out ? ' on' : '') + '" x="420" y="' + (y - 16) + '" width="190" height="32" rx="3"/><text class="lab" x="430" y="' + (y + 5) + '">' + r.box + '</text>';
        if (r.val != null) s += '<text class="val" x="600" y="' + (y + 5) + '" text-anchor="end">' + r.val + '</text>';
        s += '<line class="w" x1="610" y1="' + y + '" x2="620" y2="' + y + '"/>';
      } else {
        s += '<path class="ct' + (r.out ? ' on' : '') + '" d="M512 ' + (y - 14) + ' q-12 14 0 28 M548 ' + (y - 14) + ' q12 14 0 28"/><text class="lab" x="530" y="' + (y - 18) + '" text-anchor="middle">' + r.coil + '</text>';
        s += '<line class="w' + (flow ? ' on' : '') + '" x1="500" y1="' + y + '" x2="510" y2="' + y + '"/><line class="w" x1="550" y1="' + y + '" x2="620" y2="' + y + '"/>';
      }
    });
    svg.innerHTML = s;
  }

  /* ---------- 時間軸 ---------- */
  function timeline(cv, hist, W, lanes) {
    var dpr = window.devicePixelRatio || 1, Wc = cv.clientWidth || 600, Hc = cv.clientHeight || 170;
    cv.width = Math.round(Wc * dpr); cv.height = Math.round(Hc * dpr);
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#0b0f14'; c.fillRect(0, 0, Wc, Hc);
    var L = 70, R = 8, n = lanes.length, lh = (Hc - 22) / n, tEnd = hist.length ? hist[hist.length - 1].t : 0, t0 = Math.max(0, tEnd - W);
    function X(t) { return L + (t - t0) / W * (Wc - L - R); }
    c.font = '11px ui-monospace,Consolas,monospace';
    lanes.forEach(function (ln, i) {
      var top = 6 + i * lh, bot = top + lh - 6;
      c.fillStyle = '#9aa7b5'; c.textAlign = 'right'; c.fillText(ln.name, L - 6, (top + bot) / 2 + 4);
      c.strokeStyle = '#263241'; c.beginPath(); c.moveTo(L, bot); c.lineTo(Wc - R, bot); c.stroke();
      if (ln.max) { var yk = bot - (bot - top); c.setLineDash([4, 4]); c.beginPath(); c.moveTo(L, yk); c.lineTo(Wc - R, yk); c.stroke(); c.setLineDash([]); c.textAlign = 'left'; c.fillText('K' + ln.max, L + 2, yk + 11); }
      c.strokeStyle = ln.color; c.lineWidth = 2; c.beginPath();
      var first = true;
      hist.forEach(function (h) {
        if (h.t < t0) return;
        var v = ln.get(h), y = ln.max ? bot - Math.min(v / ln.max, 1.05) * (bot - top) : (v ? top + 2 : bot);
        if (first) { c.moveTo(X(h.t), y); first = false; } else c.lineTo(X(h.t), y);
      });
      c.stroke(); c.lineWidth = 1;
    });
    c.fillStyle = '#9aa7b5'; c.textAlign = 'left'; c.fillText(fmtMs(t0), L, Hc - 4); c.textAlign = 'right'; c.fillText(fmtMs(t0 + W), Wc - R, Hc - 4);
  }
  function fmtMs(ms) { return ms >= 1000 ? (ms / 1000).toFixed(2) + ' s' : ms.toFixed(ms < 10 ? 1 : 0) + ' ms'; }

  /* ---------- 迴圈管理：同時只跑一個分頁的計時器 ---------- */
  var LOOP = { id: 0, timer: null };
  function stopLoop() { LOOP.id++; if (LOOP.timer) { clearInterval(LOOP.timer); LOOP.timer = null; } }
  function startLoop(fn) {
    stopLoop();
    var my = LOOP.id, last = performance.now();
    LOOP.timer = setInterval(function () {
      if (my !== LOOP.id) return;
      var now = performance.now(), dt = Math.min(now - last, 100); last = now;
      fn(dt);
    }, 20);
  }
  function holdButton(btn, set) {
    function on(e) { e.preventDefault(); set(true); btn.classList.add('on'); }
    function off() { set(false); btn.classList.remove('on'); }
    btn.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, off); });
    btn.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) on(e); });
    btn.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') off(); });
  }

  /* ---------- 分頁 ---------- */
  var TABS = ['t', 'a', 'c', 's'];
  function show(t) {
    stopLoop(); S.auto && clearInterval(S.auto); S.auto = null;
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    TABS.forEach(function (k) { $('t-' + k).hidden = k !== t; });
    if (t === 't') startT(); else if (t === 'a') startA(); else if (t === 'c') startC(); else drawS();
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* =====================================================================
     1. 一般計時器
     ===================================================================== */
  var T = { x: false, tm: null, hist: [], t: 0, onAt: null };
  function tConf() {
    var v = $('tsel').value, k = Math.max(1, Math.min(32767, Math.floor(Number($('tk').value)) || 1));
    var n = v === '0' ? 0 : v === '63' ? 63 : 32;
    return { n: n, k: k, m8028: v === '32b', name: 'T' + n };
  }
  function tReset() { var c = tConf(); T.tm = newTimer(c.n, c.k, c.m8028); T.hist = []; T.t = 0; T.onAt = null; T.cfg = c; }
  function tDraw() {
    var c = T.cfg, x = T.x || $('tlock').checked, tm = T.tm;
    ladder($('tld'), [{ c: 'X0', on: x, box: 'OUT ' + c.name + ' K' + c.k, out: x, val: curText(tm) }, { c: c.name, on: tm.on, coil: 'Y0', out: tm.on }]);
    var real = c.k * tm.unit;
    $('tst').innerHTML = '<div>單位<b>' + tm.unit + ' ms</b></div><div>K' + c.k + ' 代表<b>' + fmtMs(real) + '</b></div><div>現在值<b>' + curText(tm) + '</b></div><div>' + c.name + ' 接點<b>' + (tm.on ? 'ON' : 'OFF') + '</b></div>';
    timeline($('ttl'), T.hist, Math.max(real * 2.5, 30), [
      { name: 'X0', color: '#ffd84d', get: function (h) { return h.x; } },
      { name: '現在值', color: '#60a5fa', max: c.k, get: function (h) { return Math.min(h.cur, c.k); } },
      { name: c.name + ' 接點', color: '#4ade80', get: function (h) { return h.on; } }]);
  }
  function startT() {
    tReset(); tDraw(); say('tsay', '');
    var prevX = false;
    startLoop(function (dtReal) {
      var dt = dtReal / Number($('tslow').value), x = T.x || $('tlock').checked, tm = T.tm, wasOn = tm.on, before = curText(tm);
      if (x && !prevX) T.onAt = T.t;
      timerStep(tm, x, dt); T.t += dt;
      T.hist.push({ t: T.t, x: x, cur: timerCur(tm), on: tm.on });
      if (T.hist.length > 4000) T.hist.splice(0, 1000);
      if (!wasOn && tm.on) say('tsay', '現在值到 ' + tm.k + '，' + T.cfg.name + ' 接點 ON，Y0 亮。從按下 X0 算起約 ' + fmtMs(T.t - T.onAt) + '（' + tm.k + ' × ' + tm.unit + ' ms）。' + (tm.unit * tm.k < 200 && Number($('tslow').value) === 1 ? '畫面每 20 ms 才更新一次，這麼短的時間看不清楚，可以選「放慢 100 倍」。' : ''), 'ok');
      if (!x && prevX && before !== '0') say('tsay', 'X0 放開：線圈斷電，現在值從 ' + before + ' 立刻歸零' + (wasOn ? '，接點也打開。' : '，還沒數到 ' + tm.k + '，下次要從 0 重新數。'), wasOn ? '' : 'bad');
      prevX = x;
      tDraw();
    });
  }
  holdButton($('tx0'), function (v) { T.x = v; });
  ['tsel', 'tk'].forEach(function (id) { $(id).addEventListener('change', function () { if (!$('t-t').hidden) startT(); }); });

  /* =====================================================================
     2. 積算計時器
     ===================================================================== */
  var A = { x: false, rst: false, t: 0, hist: [], powered: true };
  function aReset() { A.t0 = newTimer(0, 50); A.t132 = newTimer(132, 50); A.hist = []; A.t = 0; A.powered = true; }
  aReset();
  function aDraw() {
    var x = A.x && A.powered;
    ladder($('ald'), [
      { c: 'X0', on: x, box: 'OUT T0 K50', out: x, val: curText(A.t0) },
      { c: 'X0', on: x, box: 'OUT T132 K50', out: x, val: curText(A.t132) },
      { c: 'T0', on: A.t0.on, coil: 'Y0', out: A.t0.on },
      { c: 'T132', on: A.t132.on, coil: 'Y1', out: A.t132.on },
      { c: 'X1', on: A.rst, box: 'RST T132', out: A.rst }]);
    $('ald').classList.toggle('off-all', !A.powered);
    $('apw').textContent = A.powered ? '' : '停電中…';
    $('ast').innerHTML = '<div>T0 現在值（一般）<b>' + curText(A.t0) + '</b></div><div>T132 現在值（積算）<b>' + curText(A.t132) + '</b></div><div>Y0<b>' + (A.t0.on ? 'ON' : 'OFF') + '</b></div><div>Y1<b>' + (A.t132.on ? 'ON' : 'OFF') + '</b></div>';
    timeline($('atl'), A.hist, 12000, [
      { name: 'X0', color: '#ffd84d', get: function (h) { return h.x; } },
      { name: 'T0', color: '#60a5fa', max: 50, get: function (h) { return h.a; } },
      { name: 'T132', color: '#f472b6', max: 50, get: function (h) { return h.b; } }]);
  }
  function startA() {
    aDraw(); var prevX = false;
    startLoop(function (dt) {
      if (!A.powered) return;
      var x = A.x;
      timerStep(A.t0, x, dt); timerStep(A.t132, x, dt);
      if (A.rst) { timerRst(A.t132); A.rst = false; say('asay', 'RST T132：積算計時器的現在值和接點一起清掉。'); }
      A.t += dt; A.hist.push({ t: A.t, x: x, a: Math.min(timerCur(A.t0), 50), b: Math.min(timerCur(A.t132), 50) });
      if (A.hist.length > 5000) A.hist.splice(0, 1000);
      if (prevX && !x) say('asay', '放開 X0：T0 歸零，T132 停在 ' + curText(A.t132) + '。' + (A.t132.on ? '已經到設定值，接點保持 ON，要 RST 才會清。' : '再按 X0，T132 會從 ' + timerCur(A.t132) + ' 接著數。'));
      prevX = x; aDraw();
    });
  }
  holdButton($('ax0'), function (v) { A.x = v; });
  $('ax1').onclick = function () { A.rst = true; };
  $('apow').onclick = function () {
    if (!A.powered) return;
    var before0 = timerCur(A.t0), before132 = curText(A.t132);
    A.powered = false; A.x = false; $('ax0').classList.remove('on'); aDraw();
    var my = LOOP.id;
    setTimeout(function () {
      if (my !== LOOP.id) return;
      powerCycle([A.t0, A.t132]); A.powered = true; aDraw();
      say('asay', '復電：T0 ' + (before0 ? '從 ' + Math.min(before0, 50) + ' 變成 0' : '是 0') + '（一般計時器停電歸零）；T132 還是 ' + before132 + '（T128～T137 停電保持）。', 'ok');
    }, 1200);
  };

  /* =====================================================================
     3. 計數器
     ===================================================================== */
  var C = { x: false, pulse: 0, rst: false, t: 0, hist: [], powered: true };
  function cReset() { C.c0 = newCounter(0, 5); C.c16 = newCounter(16, 5); C.hist = []; C.t = 0; C.powered = true; }
  cReset();
  function cDraw() {
    var x = (C.x || C.pulse > 0) && C.powered;
    ladder($('cld'), [
      { c: 'X0', on: x, box: 'OUT C0 K5', out: x, val: C.c0.val },
      { c: 'X0', on: x, box: 'OUT C16 K5', out: x, val: C.c16.val },
      { c: 'C0', on: C.c0.on, coil: 'Y0', out: C.c0.on },
      { c: 'C16', on: C.c16.on, coil: 'Y1', out: C.c16.on },
      { c: 'X1', on: C.rst, box: 'RST C0', out: C.rst },
      { c: 'X1', on: C.rst, box: 'RST C16', out: C.rst }]);
    $('cld').classList.toggle('off-all', !C.powered);
    $('cst').innerHTML = '<div>C0 現在值（一般）<b>' + C.c0.val + ' / 5</b></div><div>C16 現在值（停電保持）<b>' + C.c16.val + ' / 5</b></div><div>Y0<b>' + (C.c0.on ? 'ON' : 'OFF') + '</b></div><div>Y1<b>' + (C.c16.on ? 'ON' : 'OFF') + '</b></div>';
    timeline($('ctl'), C.hist, 10000, [
      { name: 'X0', color: '#ffd84d', get: function (h) { return h.x; } },
      { name: 'C0', color: '#60a5fa', max: 5, get: function (h) { return h.a; } },
      { name: 'C16', color: '#f472b6', max: 5, get: function (h) { return h.b; } }]);
  }
  function startC() {
    cDraw(); var prevX = false, held = 0;
    startLoop(function (dt) {
      if (!C.powered) return;
      var x = C.x || C.pulse > 0, b0 = C.c0.val;
      if (C.pulse > 0) C.pulse -= dt;
      counterStep(C.c0, x); counterStep(C.c16, x);
      if (C.rst) { counterRst(C.c0); counterRst(C.c16); C.rst = false; say('csay', 'RST：C0、C16 現在值歸零，接點打開。'); }
      C.t += dt; C.hist.push({ t: C.t, x: x, a: C.c0.val, b: C.c16.val });
      if (C.hist.length > 5000) C.hist.splice(0, 1000);
      if (x && !prevX) say('csay', b0 < 5 ? '上升緣：X0 由 OFF 變 ON，C0、C16 各加 1 → ' + C.c0.val + (C.c0.on ? '，到設定值，接點 ON。' : '。') : '又來一個脈衝，但現在值已經是 5（設定值），不再增加，接點保持 ON。', b0 < 5 ? 'ok' : '');
      held = x ? held + dt : 0;
      if (x && prevX && held > 1000 && held - dt <= 1000) say('csay', '一直按著已經超過 1 秒，現在值沒有再加：計數器只看 OFF → ON 的那一下。');
      prevX = x; cDraw();
    });
  }
  holdButton($('cx0'), function (v) { C.x = v; });
  $('cpulse').onclick = function () { C.pulse = 150; };
  $('cx1').onclick = function () { C.rst = true; };
  $('cpow').onclick = function () {
    if (!C.powered) return;
    var b0 = C.c0.val, b16 = C.c16.val;
    C.powered = false; C.x = false; C.pulse = 0; $('cx0').classList.remove('on'); cDraw();
    var my = LOOP.id;
    setTimeout(function () {
      if (my !== LOOP.id) return;
      powerCycle([C.c0, C.c16]); C.c0.on = C.c0.val >= C.c0.k; C.c16.on = C.c16.val >= C.c16.k; C.powered = true; cDraw();
      say('csay', '復電：C0 從 ' + b0 + ' 變成 0（C0～C15 停電歸零）；C16 還是 ' + b16 + '（C16～C31 停電保持）。', 'ok');
    }, 1200);
  };

  /* =====================================================================
     4. 掃描順序
     ===================================================================== */
  var PROG = {
    A: [{ src: 'X0', out: 'T0' }, { src: 'T0', out: 'Y0' }],
    B: [{ src: 'T0', out: 'Y0' }, { src: 'X0', out: 'T0' }]
  };
  var S = { auto: null };
  function sReset() {
    S.scan = 1; S.row = 0;
    ['A', 'B'].forEach(function (k) { S[k] = { tm: newTimer(0, 3), y0: false, yAt: 0 }; $('slog' + k).innerHTML = ''; });
    say('ssay', ''); drawS();
  }
  /* 純函式：執行一行。回傳那一行的說明 */
  function execRow(st, row, dt) {
    if (row.out === 'T0') { timerStep(st.tm, true, dt); return 'OUT T0 K3：現在值 ' + curText(st.tm) + '，接點 ' + (st.tm.on ? 'ON' : 'OFF'); }
    st.y0 = st.tm.on; return '讀 T0 接點 = ' + (st.tm.on ? 'ON' : 'OFF') + ' → Y0 ' + (st.y0 ? 'ON' : 'OFF');
  }
  /* 純函式：跑到 Y0 ON 是第幾圈（給測試和猜一猜用） */
  function scanWhenOn(order, k) {
    var st = { tm: newTimer(0, k), y0: false };
    for (var s = 1; s <= 50; s++) { for (var r = 0; r < order.length; r++) execRow(st, order[r], 100); if (st.y0) return s; }
    return -1;
  }
  function drawS() {
    if (S.scan == null) { S.scan = 1; S.row = 0; ['A', 'B'].forEach(function (k) { S[k] = { tm: newTimer(0, 3), y0: false, yAt: 0 }; }); }
    ['A', 'B'].forEach(function (k) {
      var st = S[k], rows = PROG[k].map(function (r) { return r.out === 'T0' ? { c: 'X0', on: true, box: 'OUT T0 K3', out: true, val: curText(st.tm) } : { c: 'T0', on: st.tm.on, coil: 'Y0', out: st.y0 }; });
      ladder($('sld' + k), rows, S.row);
    });
    $('sscan').textContent = '第 ' + S.scan + ' 圈，下一步要算第 ' + (S.row + 1) + ' 行（X0 一直 ON）';
  }
  function sStep() {
    ['A', 'B'].forEach(function (k) {
      var st = S[k], msg = execRow(st, PROG[k][S.row], S.row === 0 ? 100 : 100);
      var d = document.createElement('div'); d.textContent = '第 ' + S.scan + ' 圈第 ' + (S.row + 1) + ' 行：' + msg;
      if (PROG[k][S.row].out === 'Y0' && st.y0 && !st.yAt) { st.yAt = S.scan; d.className = 'hi'; }
      $('slog' + k).appendChild(d); $('slog' + k).scrollTop = 1e6;
    });
    S.row++;
    if (S.row >= 2) { S.row = 0; S.scan++; }
    drawS();
    if (S.A.yAt && S.B.yAt) {
      say('ssay', 'A 在第 ' + S.A.yAt + ' 圈 Y0 就 ON；B 到第 ' + S.B.yAt + ' 圈才 ON，慢一圈。B 的第 1 行讀 T0 時，這一圈的 OUT T0 還沒算到，拿到的是上一圈的舊值。', 'ok');
      if (S.auto) { clearInterval(S.auto); S.auto = null; }
      return false;
    }
    return true;
  }
  $('sstep').onclick = function () { if (S.A.yAt && S.B.yAt) return; sStep(); };
  $('sauto').onclick = function () {
    if (S.auto) return;
    if (S.A.yAt && S.B.yAt) sReset();
    S.auto = setInterval(function () { if ($('t-s').hidden || !sStep()) { clearInterval(S.auto); S.auto = null; } }, 650);
  };
  $('sreset').onclick = function () { if (S.auto) { clearInterval(S.auto); S.auto = null; } sReset(); };

  window.addEventListener('resize', function () { if (!$('t-t').hidden) tDraw(); else if (!$('t-a').hidden) aDraw(); else if (!$('t-c').hidden) cDraw(); });

  /* =====================================================================
     5. 猜一猜
     ===================================================================== */
  function sec(ms) { return ms >= 1000 ? (ms / 1000) + ' 秒' : ms + ' ms'; }
  var GENS = [
    function () {
      var o = pickOne([[0, false, 'T0'], [10, false, 'T10'], [63, false, 'T63'], [100, false, 'T100'], [40, true, 'T40（M8028 ON）'], [40, false, 'T40（M8028 OFF）']]), k = pickOne([5, 10, 30, 50]);
      var u = timerUnit(o[0], o[1]).unit, ans = sec(k * u);
      return { q: 'FX3S 寫 <b>OUT ' + o[2] + ' K' + k + '</b>，線圈一直 ON，多久之後接點 ON？', ans: ans, wrong: distinct(ans, [sec(k * 100), sec(k * 10), sec(k * 1), sec(k * 1000), k + ' 秒']), ex: o[2] + ' 的單位是 ' + u + ' ms，K' + k + ' × ' + u + ' ms = ' + ans + '。T0～T31 100 ms；T32～T62 100 ms（M8028 ON 時 10 ms）；T63～T127 1 ms。' };
    },
    function () {
      var v = rint(5, 25), ans = '0';
      return { q: 'OUT T0 K30，X0 按住到現在值 ' + v + ' 時放開。T0 的現在值變成？', ans: ans, wrong: distinct(ans, [String(v), '30', String(v - 1), String(30 - v)]), ex: '一般計時器線圈一斷電，現在值立刻歸零。' };
    },
    function () {
      var v = rint(5, 25), ans = String(v);
      return { q: 'OUT T132 K50（積算型），X0 按住到現在值 ' + v + ' 時放開。T132 的現在值變成？', ans: ans, wrong: distinct(ans, ['0', '50', String(v + 1), String(50 - v)]), ex: '積算計時器線圈斷電時現在值保留，下次接著數，要 RST 才歸零。' };
    },
    function () {
      var ans = 'RST T132';
      return { q: '積算計時器 T132 數到一半，要讓它從 0 重新數，要寫？', ans: ans, wrong: distinct(ans, ['把 X0 放開', 'OUT T132 K0', '停電再復電', 'PLF T132']), ex: '積算型放開線圈或停電都不會歸零，只有 RST 會。' };
    },
    function () {
      var ans = 'T128～T137';
      return { q: 'FX3S 的積算計時器（斷電也不歸零）是哪些編號？', ans: ans, wrong: distinct(ans, ['T0～T31', 'T63～T127', 'T246～T255', 'T32～T62']), ex: 'FX3S：T128～T131（1 ms）、T132～T137（100 ms）。T246～T255 是 FX3U 的。' };
    },
    function () {
      var s = pickOne([2, 3, 5]), ans = '1';
      return { q: 'OUT C0 K5，C0 原本是 0。X0 按住不放 ' + s + ' 秒，C0 的現在值？', ans: ans, wrong: distinct(ans, ['0', String(s), String(s * 10), '5']), ex: '計數器只在線圈由 OFF 變 ON 的那一下加 1，按住不會一直加。' };
    },
    function () {
      var n = rint(6, 12), ans = '5，接點 ON';
      return { q: 'OUT C0 K5，C0 原本是 0。X0 一下一下按了 ' + n + ' 次，C0 的現在值和接點？', ans: ans, wrong: distinct(ans, [n + '，接點 ON', (n - 5) + '，接點 OFF', '0，接點 OFF', '5，接點 OFF']), ex: '16 位元計數器到設定值後現在值停在 5，後面的脈衝不再增加，接點保持 ON，要 RST 才歸零。' };
    },
    function () {
      var n = pickOne([3, 8, 12, 15, 16, 20, 31]), v = rint(1, 4), keep = latched('C', n), ans = keep ? String(v) : '0';
      return { q: 'FX3S 的 C' + n + ' 現在值是 ' + v + '，停電再復電後是？', ans: ans, wrong: distinct(ans, ['0', String(v), String(v + 1), '32767']), ex: 'FX3S：C0～C15 停電歸零，C16～C31 停電保持。C' + n + (keep ? ' 是保持型。' : ' 是一般型。') };
    },
    function () {
      var n = pickOne([0, 20, 63, 130, 135]), v = rint(5, 20), keep = latched('T', n), ans = keep ? String(v) : '0';
      return { q: 'FX3S 的 T' + n + ' 現在值是 ' + v + '（線圈還 ON），停電再復電後是？', ans: ans, wrong: distinct(ans, ['0', String(v), String(v * 10), '32767']), ex: 'FX3S 只有 T128～T137（積算型）停電保持，其他計時器歸零。' };
    },
    function () {
      var ans = 'C16～C31';
      return { q: 'FX3S 哪些計數器停電後還記得現在值？', ans: ans, wrong: distinct(ans, ['C0～C15', 'C100～C199', 'C235～C255', '全部都會']), ex: 'C0～C15 一般、C16～C31 停電保持。C100～C199 是 FX3U 的保持範圍。' };
    },
    function () {
      var k = pickOne([3, 5, 10]), a = scanWhenOn(PROG.A, k), b = scanWhenOn(PROG.B, k), up = Math.random() < .5, ans = '第 ' + (up ? b : a) + ' 圈';
      return { q: '假設一圈 100 ms，X0 從第 1 圈起一直 ON，程式是' + (up ? '「第 1 行 LD T0、OUT Y0；第 2 行 LD X0、OUT T0 K' + k + '」（接點在上面）' : '「第 1 行 LD X0、OUT T0 K' + k + '；第 2 行 LD T0、OUT Y0」（接點在下面）') + '。Y0 第一次 ON 是第幾圈？', ans: ans,
        wrong: distinct(ans, ['第 ' + a + ' 圈', '第 ' + b + ' 圈', '第 ' + (a - 1) + ' 圈', '第 ' + (b + 1) + ' 圈', '第 1 圈']),
        ex: '每圈執行 OUT T0 時加 100 ms，第 ' + a + ' 圈數到 K' + k + '。接點寫在下面，同一圈就讀得到；寫在上面，要等下一圈（第 ' + b + ' 圈）。' };
    },
    function () {
      var ans = '32767';
      return { q: 'FX3S 16 位元計數器的設定值最大是？', ans: ans, wrong: distinct(ans, ['65535', '9999', '32768', '255']), ex: '16 位元有號數最大 32767。' };
    },
    function () {
      var ans = '把設定值寫成暫存器，例如 OUT T0 D100';
      return { q: '機台的吸附時間要讓操作員在觸控面板上改，計時器的設定值怎麼寫？', ans: ans, wrong: distinct(ans, ['只能寫 K 常數，改時間要改程式', '改用積算計時器', '改用計數器 C']), ex: '課程 A2：設定值也可以寫 D100，用暫存器當設定值。' };
    }
  ];
  function gen() { return pickOne(GENS)(); }

  /* ---------- 初始化 ---------- */
  sReset();
  show(/^#(t|a|c|s)$/.test(location.hash) ? location.hash.slice(1) : 't');
  window.TimerLab = {
    timerUnit: timerUnit, newTimer: newTimer, timerStep: timerStep, timerCur: timerCur, timerRst: timerRst,
    newCounter: newCounter, counterStep: counterStep, counterRst: counterRst, latched: latched, powerCycle: powerCycle,
    scanWhenOn: scanWhenOn, PROG: PROG, show: show, stopLoop: stopLoop, GENS: GENS, gen: gen,
    quiz: window.LabQuiz ? window.LabQuiz('tquiz', gen) : null
  };
})();
