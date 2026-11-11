/* 異常處理實驗室：異常鎖住、0.5 秒閃爍（M8013 與兩個計時器）、蜂鳴器靜音、首發異常碼、猜一猜
   小型掃描機（每圈 10 ms）：先讀 X，再由上往下執行，寫了就生效；M8013 = 開機後時間 % 1000 < 500；
   OUT T 那一行累加時間。做法和本站模擬器 engine/plc_engine.py 相同，已用相同的輸入序列對照過。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function distinct(ans, list) { var seen = {}; seen[ans] = 1; return list.filter(function (w) { if (seen[w]) return false; seen[w] = 1; return true; }); }
  function say(id, t, cls) { $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); $(id).textContent = t; }
  var SCAN = 10;

  /* =====================================================================
     小型 PLC
     ===================================================================== */
  function dev(s) { var m = /^([XYMTDK])0*(\d+)$/.exec(s); return m ? m[1] + m[2] : s; }
  function parseIL(text) {
    return text.trim().split(/\n/).map(function (l) { var w = l.trim().split(/\s+/); return { op: w[0], a: w[1] ? dev(w[1]) : null, b: w[2] ? dev(w[2]) : null }; }).filter(function (i) { return i.op && i.op[0] !== ';'; });
  }
  function newState() { return { X: {}, Y: {}, M: {}, T: {}, Tacc: {}, D: {}, clock: 0, scans: 0 }; }
  function bit(st, d) {
    var k = d[0], n = +d.slice(1);
    if (k === 'M' && n === 8000) return true;
    if (k === 'M' && n === 8002) return st.scans === 0;
    if (k === 'M' && n === 8013) return st.clock % 1000 < 500;
    if (k === 'T') return !!st.T[d];
    return !!st[k][d];
  }
  function word(st, d) { return d[0] === 'K' ? +d.slice(1) : st.D[d] || 0; }
  var CMP = /^(LD|AND|OR)(=|<>|>=|<=|>|<)$/;
  function cmp(op, x, y) { return op === '=' ? x === y : op === '<>' ? x !== y : op === '>' ? x > y : op === '<' ? x < y : op === '>=' ? x >= y : x <= y; }
  /* 一圈。x = {X0: true …}。回傳每個指令的導通狀態（畫圖用） */
  function scan(prog, st, x, dt) {
    st.X = {}; Object.keys(x).forEach(function (k) { st.X[k] = !!x[k]; });
    var acc = false, stack = [], fresh = true, closed = [];
    prog.forEach(function (ins, i) {
      var op = ins.op, m = CMP.exec(op), v;
      if (m) { v = cmp(m[2], word(st, ins.a), word(st, ins.b)); op = m[1]; }
      else if (/^(LD|LDI|AND|ANI|OR|ORI)$/.test(op)) v = bit(st, ins.a);
      switch (op) {
        case 'LD': case 'LDI': if (!fresh) stack.push(acc); acc = op === 'LDI' ? !v : v; fresh = false; closed[i] = acc; break;
        case 'AND': closed[i] = v; acc = acc && v; break;
        case 'ANI': closed[i] = !v; acc = acc && !v; break;
        case 'OR': closed[i] = v; acc = acc || v; break;
        case 'ORI': closed[i] = !v; acc = acc || !v; break;
        case 'ORB': acc = stack.pop() || acc; break;
        case 'ANB': acc = stack.pop() && acc; break;
        case 'OUT':
          if (ins.a[0] === 'T') {
            var k = +ins.b.slice(1), unit = 100;
            if (acc) { st.Tacc[ins.a] = (st.Tacc[ins.a] || 0) + dt; st.T[ins.a] = Math.floor(st.Tacc[ins.a] / unit) >= k; }
            else { st.Tacc[ins.a] = 0; st.T[ins.a] = false; }
          } else st[ins.a[0]][ins.a] = acc;
          closed[i] = acc; fresh = true; stack = []; break;
        case 'SET': if (acc) st[ins.a[0]][ins.a] = true; closed[i] = acc; fresh = true; stack = []; break;
        case 'RST': if (acc) { if (ins.a[0] === 'D') st.D[ins.a] = 0; else st[ins.a[0]][ins.a] = false; } closed[i] = acc; fresh = true; stack = []; break;
        case 'MOV': if (acc) st.D[ins.b] = word(st, ins.a); closed[i] = acc; fresh = true; stack = []; break;
      }
    });
    st.scans++; st.clock += dt;
    return closed;
  }
  function val(st, k) { return k[0] === 'D' ? String(st.D[k] || 0) : bit(st, k) ? '1' : '0'; }
  /* 測試用：steps = [{x:{X0:1}, n:圈數}]；回傳每個元件每一圈的值（位元是 0/1 字串，D 用逗號分隔） */
  function runTrace(il, steps, keys) {
    var prog = parseIL(il), st = newState(), out = {};
    keys.forEach(function (k) { out[k] = []; });
    steps.forEach(function (s) { for (var i = 0; i < s.n; i++) { scan(prog, st, s.x, SCAN); keys.forEach(function (k) { out[k].push(val(st, k)); }); } });
    keys.forEach(function (k) { out[k] = k[0] === 'D' ? out[k].join(',') : out[k].join(''); });
    return out;
  }
  function last(il, steps, k) { var t = runTrace(il, steps, [k]); return k[0] === 'D' ? t[k].split(',').pop() : t[k].slice(-1); }

  /* ---------- 梯形圖 ---------- */
  var OUTS = /^(OUT|SET|RST|MOV)$/;
  function rungsOf(prog) {
    var rungs = [], cur = [], seenOut = false;
    prog.forEach(function (ins, i) {
      var isLd = /^LD/.test(ins.op);
      if (isLd && seenOut) { rungs.push(cur); cur = []; seenOut = false; }
      cur.push({ ins: ins, i: i }); if (OUTS.test(ins.op)) seenOut = true;
    });
    if (cur.length) rungs.push(cur);
    return rungs;
  }
  function segments(rung) {
    var segs = [], orSeen = false;
    rung.forEach(function (c) {
      var op = c.ins.op.replace(/[=<>]+$/, '');
      if (OUTS.test(c.ins.op)) return;
      if (op === 'LD' || op === 'LDI') { segs.push([[c]]); orSeen = false; }
      else if (op === 'AND' || op === 'ANI') { if (orSeen || segs[segs.length - 1].length > 1) { segs.push([[c]]); orSeen = false; } else segs[segs.length - 1][0].push(c); }
      else if (op === 'OR' || op === 'ORI') {
        if (segs.length > 1) { var merged = []; segs.forEach(function (s) { merged = merged.concat(s[0]); }); segs = [[merged]]; }
        segs[0].push([c]); orSeen = true;
      }
    });
    return segs;
  }
  function cw(c) { return CMP.test(c.ins.op) ? 120 : 72; }
  function drawLadder(svg, prog, closed, st) {
    var rungs = rungsOf(prog), y = 18, s = '', X0 = 30, COILX = 500;
    rungs.forEach(function (r) {
      var segs = segments(r), outs = r.filter(function (c) { return OUTS.test(c.ins.op); }), x = X0, maxB = 1;
      segs.forEach(function (sg) { maxB = Math.max(maxB, sg.length); });
      var rows = Math.max(maxB, outs.length), yc = y + 26;
      s += '<line class="w" x1="20" y1="' + yc + '" x2="' + X0 + '" y2="' + yc + '"/>';
      segs.forEach(function (sg) {
        var len = Math.max.apply(null, sg.map(function (b) { return b.reduce(function (t, c) { return t + cw(c); }, 0); }));
        sg.forEach(function (b, bi) {
          var by = yc + bi * 40, bx = x;
          b.forEach(function (c) {
            var on = !!closed[c.i], w = cw(c);
            if (CMP.test(c.ins.op)) {
              s += '<line class="w" x1="' + bx + '" y1="' + by + '" x2="' + (bx + 6) + '" y2="' + by + '"/><rect class="ctf' + (on ? ' on' : '') + '" x="' + (bx + 6) + '" y="' + (by - 12) + '" width="108" height="24"/><rect class="ct' + (on ? ' on' : '') + '" x="' + (bx + 6) + '" y="' + (by - 12) + '" width="108" height="24" fill="none"/>';
              s += '<text x="' + (bx + 60) + '" y="' + (by + 4) + '" text-anchor="middle">' + c.ins.op.replace(/^(LD|AND|OR)/, '') + ' ' + c.ins.a + ' ' + c.ins.b + '</text><line class="w" x1="' + (bx + 114) + '" y1="' + by + '" x2="' + (bx + w) + '" y2="' + by + '"/>';
            } else {
              var nc = /I$/.test(c.ins.op);
              s += '<line class="w" x1="' + bx + '" y1="' + by + '" x2="' + (bx + 22) + '" y2="' + by + '"/><rect class="ctf' + (on ? ' on' : '') + '" x="' + (bx + 22) + '" y="' + (by - 13) + '" width="24" height="26"/>';
              s += '<line class="ct' + (on ? ' on' : '') + '" x1="' + (bx + 24) + '" y1="' + (by - 13) + '" x2="' + (bx + 24) + '" y2="' + (by + 13) + '"/><line class="ct' + (on ? ' on' : '') + '" x1="' + (bx + 44) + '" y1="' + (by - 13) + '" x2="' + (bx + 44) + '" y2="' + (by + 13) + '"/>';
              if (nc) s += '<line class="ct' + (on ? ' on' : '') + '" x1="' + (bx + 20) + '" y1="' + (by + 13) + '" x2="' + (bx + 48) + '" y2="' + (by - 13) + '"/>';
              s += '<text x="' + (bx + 34) + '" y="' + (by - 17) + '" text-anchor="middle">' + c.ins.a + '</text><line class="w" x1="' + (bx + 46) + '" y1="' + by + '" x2="' + (bx + w) + '" y2="' + by + '"/>';
            }
            bx += w;
          });
          if (bx < x + len) s += '<line class="w" x1="' + bx + '" y1="' + by + '" x2="' + (x + len) + '" y2="' + by + '"/>';
        });
        if (sg.length > 1) s += '<line class="w" x1="' + x + '" y1="' + yc + '" x2="' + x + '" y2="' + (yc + (sg.length - 1) * 40) + '"/><line class="w" x1="' + (x + len) + '" y1="' + yc + '" x2="' + (x + len) + '" y2="' + (yc + (sg.length - 1) * 40) + '"/>';
        x += len;
      });
      s += '<line class="w" x1="' + x + '" y1="' + yc + '" x2="' + COILX + '" y2="' + yc + '"/>';
      if (outs.length > 1) s += '<line class="w" x1="' + COILX + '" y1="' + yc + '" x2="' + COILX + '" y2="' + (yc + (outs.length - 1) * 40) + '"/>';
      outs.forEach(function (o, k) {
        var oy = yc + k * 40, ins = o.ins, on;
        if (ins.op === 'OUT' && ins.a[0] !== 'T') {
          on = bit(st, ins.a);
          s += '<line class="w" x1="' + COILX + '" y1="' + oy + '" x2="' + (COILX + 20) + '" y2="' + oy + '"/><ellipse class="coilf' + (on ? ' on' : '') + '" cx="' + (COILX + 40) + '" cy="' + oy + '" rx="18" ry="13"/><path class="ct coil' + (on ? ' on' : '') + '" d="M' + (COILX + 28) + ' ' + (oy - 13) + ' q-10 13 0 26 M' + (COILX + 52) + ' ' + (oy - 13) + ' q10 13 0 26"/><text x="' + (COILX + 40) + '" y="' + (oy - 17) + '" text-anchor="middle">' + ins.a + '</text>';
        } else {
          on = !!closed[o.i];
          var label = ins.op === 'OUT' ? ins.a + ' ' + ins.b + '（' + Math.floor((st.Tacc[ins.a] || 0) / 100) + '）' : ins.op + ' ' + ins.a + (ins.b ? ' ' + ins.b : '');
          s += '<line class="w" x1="' + COILX + '" y1="' + oy + '" x2="' + (COILX + 10) + '" y2="' + oy + '"/><rect class="coilf' + (on ? ' on' : '') + '" x="' + (COILX + 10) + '" y="' + (oy - 13) + '" width="140" height="26"/><rect class="ct coil' + (on ? ' on' : '') + '" x="' + (COILX + 10) + '" y="' + (oy - 13) + '" width="140" height="26" fill="none"/><text x="' + (COILX + 80) + '" y="' + (oy + 5) + '" text-anchor="middle">' + label + '</text>';
        }
      });
      s += '<text class="il" x="' + X0 + '" y="' + (yc + (rows - 1) * 40 + 30) + '">' + r.map(function (c) { return c.ins.op + (c.ins.a ? ' ' + c.ins.a : '') + (c.ins.b ? ' ' + c.ins.b : ''); }).join(' / ') + '</text>';
      y += rows * 40 + 34;
    });
    svg.setAttribute('viewBox', '0 0 680 ' + (y + 4));
    svg.innerHTML = '<line class="rail" x1="20" y1="8" x2="20" y2="' + (y - 6) + '"/><line class="rail" x1="660" y1="8" x2="660" y2="' + (y - 6) + '"/>' + s;
  }

  /* ---------- 時間軸 ---------- */
  function timeline(cv, hist, lanes, N) {
    var dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 600, H = cv.clientHeight || 160;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#0b0f14'; c.fillRect(0, 0, W, H);
    var L = 60, lh = (H - 20) / lanes.length, h = hist.slice(-N);
    c.font = '11px ui-monospace,Consolas,monospace';
    lanes.forEach(function (ln, i) {
      var top = 4 + i * lh + 3, bot = top + lh - 8;
      c.fillStyle = '#9aa7b5'; c.textAlign = 'right'; c.fillText(ln.name, L - 6, (top + bot) / 2 + 4);
      c.strokeStyle = '#263241'; c.beginPath(); c.moveTo(L, bot); c.lineTo(W - 4, bot); c.stroke();
      c.strokeStyle = ln.color; c.lineWidth = 2; c.beginPath();
      h.forEach(function (r, k) { var x1 = L + k / N * (W - L - 4), x2 = L + (k + 1) / N * (W - L - 4), y = r[ln.key] ? top : bot; if (k) c.lineTo(x1, y); else c.moveTo(x1, y); c.lineTo(x2, y); });
      c.stroke(); c.lineWidth = 1;
    });
    c.fillStyle = '#9aa7b5'; c.textAlign = 'left'; c.fillText('← ' + (N * SCAN / 1000) + ' 秒 →', L, H - 4);
  }

  /* ---------- 掃描迴圈（一次只跑一個分頁；每 20 ms 跑兩圈＝即時） ---------- */
  var LOOP = { id: 0, t: null };
  function stopLoop() { LOOP.id++; if (LOOP.t) clearInterval(LOOP.t); LOOP.t = null; }
  function startLoop(fn) { stopLoop(); var my = LOOP.id; LOOP.t = setInterval(function () { if (my === LOOP.id) { fn(); fn(true); } }, 20); }
  function holdButton(btn, set) {
    function on(e) { e.preventDefault(); set(true); btn.classList.add('on'); }
    function off() { set(false); btn.classList.remove('on'); }
    btn.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, off); });
    btn.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) on(e); });
    btn.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') off(); });
  }
  function toggle(btn, label, get, set) {
    function paint() { btn.classList.toggle('on', get()); btn.textContent = label + '：' + (get() ? 'ON' : 'OFF'); }
    btn.onclick = function () { set(!get()); paint(); }; paint(); return paint;
  }

  /* ---------- 分頁 ---------- */
  var TABS = ['lat', 'fl', 'bz', 'ff'];
  function show(t) {
    stopLoop();
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    TABS.forEach(function (k) { $('t-' + k).hidden = k !== t; });
    ({ lat: startLat, fl: startFl, bz: startBz, ff: startFf })[t]();
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* =====================================================================
     1. 異常要鎖住
     ===================================================================== */
  var LAT = {
    none: { name: '沒有鎖住：LD X1 / OUT Y0', il: 'LD X001\nOUT Y000' },
    set: { name: 'SET 鎖住，X3 復歸（E11 的寫法）', il: 'LD X001\nSET M0\nLD X003\nRST M0\nLD M0\nOUT Y000' },
    self: { name: '自保持鎖住，X3 復歸', il: 'LD X001\nOR M0\nANI X003\nOUT M0\nLD M0\nOUT Y000' }
  };
  $('lsel').innerHTML = Object.keys(LAT).map(function (k) { return '<option value="' + k + '">' + LAT[k].name + '</option>'; }).join('');
  var La = { pulse: 0, x1: false, x3: false };
  function startLat() {
    var key = $('lsel').value, prog = parseIL(LAT[key].il), st = newState(), hist = [], prev = {};
    say('lsay', '');
    startLoop(function (draw) {
      if (La.pulse > 0) La.pulse -= SCAN;
      var x = { X1: La.x1 || La.pulse > 0, X3: La.x3 }, closed = scan(prog, st, x, SCAN), y0 = bit(st, 'Y0');
      hist.push({ X1: x.X1, X3: x.X3, Y0: y0 }); if (hist.length > 1200) hist.splice(0, 400);
      if (prev.X1 && !x.X1) say('lsay', y0 ? '異常訊號已經消失，Y0 還亮著：被鎖住了，要按 X3 復歸。' : '異常訊號一消失，燈就跟著熄了，只亮了一下。這種寫法看不出發生過異常。', y0 ? 'ok' : 'bad');
      if (prev.X3 && !x.X3 && y0 && key !== 'none') say('lsay', '異常原因還在就按復歸：放開後下一圈又鎖住了（課程 C4）。要先排除原因再復歸。', 'bad');
      else if (x.X3 && !prev.X3 && !x.X1 && key !== 'none') say('lsay', '按 X3 復歸：異常已排除，鎖住的 M0 清掉，燈熄。');
      prev = x;
      if (!draw) return;
      drawLadder($('lld'), prog, closed, st); $('lr').className = 'r' + (y0 ? ' on' : '');
      timeline($('ltl'), hist, [{ name: 'X1 異常', key: 'X1', color: '#f472b6' }, { name: 'X3 復歸', key: 'X3', color: '#9ca3af' }, { name: 'Y0 紅燈', key: 'Y0', color: '#ef4444' }], 500);
    });
  }
  $('lsel').onchange = startLat;
  $('lpulse').onclick = function () { La.pulse = 100; };
  holdButton($('lx1'), function (v) { La.x1 = v; });
  holdButton($('lx3'), function (v) { La.x3 = v; });

  /* =====================================================================
     2. 0.5 秒閃爍
     ===================================================================== */
  var FL_IL = 'LD X000\nAND M8013\nOUT Y000\nLD X000\nANI T1\nOUT T0 K5\nLD T0\nOUT T1 K5\nLD T0\nOUT Y001';
  var Fl = { x0: false };
  var flPaint = toggle($('fx0'), 'X0 開關', function () { return Fl.x0; }, function (v) { Fl.x0 = v; });
  function startFl() {
    var prog = parseIL(FL_IL), st = newState(), hist = [], prev = false, onAt = 0;
    say('fsay', '');
    startLoop(function (draw) {
      var x = { X0: Fl.x0 }, closed = scan(prog, st, x, SCAN), y0 = bit(st, 'Y0'), y1 = bit(st, 'Y1');
      hist.push({ X0: x.X0, M: bit(st, 'M8013'), Y0: y0, Y1: y1 }); if (hist.length > 1200) hist.splice(0, 400);
      if (x.X0 && !prev) onAt = st.clock;
      if (x.X0 && st.clock - onAt === 1500) say('fsay', '看時間軸：Y1（計時器）從 X0 打開那一刻起，先熄 0.5 秒再亮 0.5 秒；Y0 跟著 M8013，打開時正好在 M8013 的哪一段，第一次亮的長短就不一樣。');
      prev = x.X0;
      if (!draw) return;
      drawLadder($('fld'), prog, closed, st);
      $('fy0').className = 'lamp y' + (y0 ? ' on' : ''); $('fy1').className = 'lamp y' + (y1 ? ' on' : '');
      timeline($('ftl'), hist, [{ name: 'X0', key: 'X0', color: '#ffd84d' }, { name: 'M8013', key: 'M', color: '#9ca3af' }, { name: 'Y0', key: 'Y0', color: '#facc15' }, { name: 'Y1', key: 'Y1', color: '#60a5fa' }], 400);
    });
  }

  /* =====================================================================
     3. 蜂鳴器靜音
     ===================================================================== */
  var BZ = {
    common: 'LD X001\nSET M0\nLD M0\nAND X002\nSET M1\nLD X003\nANI X001\nRST M0\nRST M1\nLD M0\nAND M8013\nOUT Y000\nLD M0\nANI M1\nOUT Y002',
    e22: 'LD X001\nSET M0\nLD M0\nAND X002\nSET M1\nLD M1\nANI X001\nRST M0\nRST M1\nLD M1\nAND M8013\nOUT Y000\nLD M0\nANI M1\nOUT Y002'
  };
  var Bz = { x1: false, x2: false, x3: false };
  var bzPaint = toggle($('bx1'), 'X1 過載', function () { return Bz.x1; }, function (v) { Bz.x1 = v; });
  function startBz() {
    var key = $('bsel').value, prog = parseIL(BZ[key]), st = newState(), hist = [], p = {};
    say('bsay', '');
    startLoop(function (draw) {
      var x = { X1: Bz.x1, X2: Bz.x2, X3: Bz.x3 }, closed = scan(prog, st, x, SCAN), y0 = bit(st, 'Y0'), y2 = bit(st, 'Y2'), m0 = bit(st, 'M0'), m1 = bit(st, 'M1');
      hist.push({ X1: x.X1, X2: x.X2, X3: x.X3, Y0: y0, Y2: y2 }); if (hist.length > 1200) hist.splice(0, 400);
      if (m0 && !p.m0) say('bsay', key === 'common' ? '過載：M0 鎖住，紅燈閃、蜂鳴器響。' : '過載：M0 鎖住，蜂鳴器響（E22：BZ 響）。', 'bad');
      else if (m1 && !p.m1) say('bsay', key === 'common' ? '按靜音：蜂鳴器停，紅燈繼續閃，提醒異常還沒處理。' : '按 PB3：蜂鳴器停、故障燈開始閃（E22）。', 'ok');
      else if (!m0 && p.m0) say('bsay', key === 'common' ? '原因排除後按復歸：燈熄，回到正常。' : '過載排除（TH 復歸）：故障燈熄、恢復（E22）。', 'ok');
      else if (x.X3 && !p.X3 && m0 && key === 'common') say('bsay', x.X1 ? '過載還在，按復歸沒用：復歸條件有 ANI X1。' : '');
      else if (!x.X1 && p.X1 && m0) say('bsay', key === 'common' ? '過載已經排除，但燈還在閃：常見做法要人按復歸確認，燈才熄。' + (m1 ? '' : '蜂鳴器也還在響，先按靜音或直接按復歸。') : '過載排除了，但還沒按 PB3，故障燈沒有熄（本頁照題意：按過 PB3、TH 復歸後才熄）。');
      p = { m0: m0, m1: m1, X1: x.X1, X3: x.X3 };
      if (!draw) return;
      drawLadder($('bld'), prog, closed, st);
      $('br').className = 'r' + (y0 ? ' on' : ''); $('bbz').className = 'bz' + (y2 ? ' on' : '');
      timeline($('btl'), hist, [{ name: 'X1 過載', key: 'X1', color: '#f472b6' }, { name: 'X2 靜音', key: 'X2', color: '#9ca3af' }, { name: 'X3 復歸', key: 'X3', color: '#9ca3af' }, { name: 'Y0 燈', key: 'Y0', color: '#ef4444' }, { name: 'Y2 BZ', key: 'Y2', color: '#facc15' }], 500);
    });
  }
  $('bsel').onchange = function () { Bz.x1 = false; bzPaint(); startBz(); };
  holdButton($('bx2'), function (v) { Bz.x2 = v; });
  holdButton($('bx3'), function (v) { Bz.x3 = v; });

  /* =====================================================================
     4. 首發異常（課程 C4）
     ===================================================================== */
  var FF = {
    c4: 'LD M8002\nMOV K0 D220\nRST M3\nLD X000\nAND= D220 K0\nMOV K10 D220\nLD X001\nAND= D220 K0\nMOV K20 D220\nLD> D220 K0\nSET M3\nLD X002\nANI X000\nANI X001\nRST M3\nMOV K0 D220\nLD M3\nOUT Y000',
    raw: 'LD M8002\nMOV K0 D220\nRST M3\nLD X000\nMOV K10 D220\nLD X001\nMOV K20 D220\nLD> D220 K0\nSET M3\nLD X002\nANI X000\nANI X001\nRST M3\nMOV K0 D220\nLD M3\nOUT Y000'
  };
  var Ff = { x0: false, x1: false, x2: false, order: [] };
  var ff0 = toggle($('ffx0'), 'X0 軸逾時', function () { return Ff.x0; }, function (v) { Ff.x0 = v; if (v) Ff.order.push(10); });
  var ff1 = toggle($('ffx1'), 'X1 氣缸逾時', function () { return Ff.x1; }, function (v) { Ff.x1 = v; if (v) Ff.order.push(20); });
  function startFf() {
    var key = $('fsel2').value, prog = parseIL(FF[key]), st = newState(), p = {};
    Ff.order = []; say('ffsay', '');
    startLoop(function (draw) {
      var x = { X0: Ff.x0, X1: Ff.x1, X2: Ff.x2 }, closed = scan(prog, st, x, SCAN), d = st.D.D220 || 0, m3 = bit(st, 'M3');
      if (d !== p.d) {
        if (d === 0 && p.d) say('ffsay', 'Reset：兩個異常都排除了，M3 和 D220 一起清掉。', 'ok');
        else if (d && Ff.order.length >= 2 && d !== Ff.order[0]) say('ffsay', '第一個發生的是 ' + Ff.order[0] + '，D220 卻變成 ' + d + '：後面那一行每圈都寫，蓋掉了首發異常碼。維修人員會找錯原因。', 'bad');
        else if (d) say('ffsay', 'D220 = ' + d + '，M3 警報鎖住。', 'ok');
      } else if (x.X0 && x.X1 && !(p.X0 && p.X1) && key === 'c4') say('ffsay', '兩個都發生了，D220 還是 ' + d + '：D220 已經不是 0，後面的異常不覆蓋。', 'ok');
      if (x.X2 && !p.X2 && (x.X0 || x.X1)) say('ffsay', '異常還沒排除，Reset 沒用：復歸條件是 ANI X0、ANI X1。', 'bad');
      p = { d: d, X0: x.X0, X1: x.X1, X2: x.X2 };
      if (!draw) return;
      drawLadder($('ffld'), prog, closed, st);
      $('ffd').textContent = d; $('ffm').className = 'lamp' + (m3 ? ' on' : '');
    });
  }
  $('fsel2').onchange = function () { Ff.x0 = Ff.x1 = false; ff0(); ff1(); startFf(); };
  holdButton($('ffx2'), function (v) { Ff.x2 = v; });

  /* =====================================================================
     5. 猜一猜（能算的答案都用掃描機算）
     ===================================================================== */
  var P = { x: { X1: 1 }, n: 10 }, Z = { x: {}, n: 20 };
  var GENS = [
    function () { var v = last(LAT.none.il, [P, Z], 'Y0'), a = v === '1' ? 'ON' : 'OFF，只亮了一下'; return { q: '<code>LD X1 / OUT Y0</code>，異常訊號 X1 只 ON 了 0.1 秒就消失。之後 Y0 是？', ans: a, wrong: distinct(a, ['ON', 'OFF，只亮了一下', '閃爍', '要按復歸才熄']), ex: '沒有鎖住，燈跟著訊號走，訊號一消失燈就熄。' }; },
    function () { var v = last(LAT.set.il, [P, Z], 'Y0'), a = v === '1' ? 'ON，要按 X3 才熄' : 'OFF'; return { q: '<code>LD X1 / SET M0 / LD X3 / RST M0 / LD M0 / OUT Y0</code>，X1 只 ON 了 0.1 秒。之後 Y0 是？', ans: a, wrong: distinct(a, ['ON，要按 X3 才熄', 'OFF', '閃爍', 'ON 0.1 秒後自己熄']), ex: 'SET 把異常鎖在 M0，訊號消失也保持，按 X3 才清。' }; },
    function () {
      var v = last(LAT.set.il, [P, { x: { X1: 1, X3: 1 }, n: 5 }, { x: { X1: 1 }, n: 5 }], 'Y0'), a = v === '1' ? '又亮起來（異常還在，又鎖住）' : '熄滅';
      return { q: '同一個 SET 鎖住的程式，異常 X1 還一直 ON 時按 X3 復歸再放開，Y0？', ans: a, wrong: distinct(a, ['又亮起來（異常還在，又鎖住）', '熄滅', '開始閃爍', '永遠熄滅，要重新開機']), ex: '課程 C4：故障條件仍在，程式會再次記錄故障。要先排除原因再復歸。' };
    },
    function () { var a = '1 秒，0.5 秒 ON、0.5 秒 OFF'; return { q: 'M8013 的週期是？', ans: a, wrong: distinct(a, ['0.1 秒，0.05 秒 ON、0.05 秒 OFF', '1 分鐘', '2 秒，1 秒 ON、1 秒 OFF']), ex: 'M8013 是 1 秒時脈；M8012 才是 100 ms。' }; },
    function () {
      var t = runTrace(FL_IL, [{ x: { X0: 1 }, n: 300 }], ['Y1']).Y1, first = t.indexOf('1'), a = ((first + 1) * SCAN / 1000) + ' 秒後';
      return { q: 'E6 的解法 <code>LD X0 / ANI T1 / OUT T0 K5 / LD T0 / OUT T1 K5 / LD T0 / OUT Y0</code>，打開 X0 後燈第一次亮是？（每圈 10 ms）', ans: a, wrong: distinct(a, ['一打開就亮', '1 秒後', '0.1 秒後', '5 秒後']), ex: '先由 T0 數 0.5 秒（K5 × 100 ms），T0 到了燈才亮。' };
    },
    function () { var a = '兩個計時器互相重置'; return { q: '練習題 E6 不准用 M8013，要做 0.5 秒閃爍，用什麼？', ans: a, wrong: distinct(a, ['一個計數器', 'SET／RST 各一行', 'M8002']), ex: 'T0 數熄的時間、T1 數亮的時間，T1 到了用 ANI T1 斷掉 T0，重新一輪。' }; },
    function () { var a = '打開時第一次亮的長短不一定'; return { q: '用 <code>LD X0 / AND M8013 / OUT Y0</code> 做閃爍，和 E6 的兩個計時器比，有什麼不同？', ans: a, wrong: distinct(a, ['M8013 比較慢', 'M8013 要重新開機才會動', '完全沒差']), ex: 'M8013 開機就在跑，和 X0 什麼時候打開無關；計時器從 X0 打開那一刻才開始數。' }; },
    function () {
      var seq = [{ x: { X1: 1 }, n: 20 }, { x: { X1: 1, X2: 1 }, n: 3 }, { x: { X1: 1 }, n: 3 }], y2 = last(BZ.common, seq, 'Y2'), m0 = last(BZ.common, seq, 'M0');
      var a = 'BZ ' + (y2 === '1' ? '響' : '停') + '，異常' + (m0 === '1' ? '還鎖著（燈繼續閃）' : '清掉了');
      return { q: '常見做法：過載中按一下靜音 X2，結果？', ans: a, wrong: distinct(a, ['BZ 停，異常還鎖著（燈繼續閃）', 'BZ 停，異常清掉了', 'BZ 響，異常還鎖著（燈繼續閃）', 'BZ 響，異常清掉了']), ex: '靜音只關蜂鳴器（M1），異常 M0 還在，燈繼續閃提醒還沒處理。' };
    },
    function () {
      var seq = [{ x: { X1: 1 }, n: 20 }, { x: { X1: 1, X2: 1 }, n: 3 }, { x: {}, n: 20 }], m0 = last(BZ.common, seq, 'M0'), a = m0 === '1' ? '還在閃，要按復歸 X3 才熄' : '自己熄了';
      return { q: '常見做法：靜音後把過載排除（X1 OFF），還沒按復歸，紅燈？', ans: a, wrong: distinct(a, ['還在閃，要按復歸 X3 才熄', '自己熄了', '變成一直亮', '蜂鳴器又響起來']), ex: '要人按復歸確認，避免沒人注意到發生過異常。' };
    },
    function () {
      var seq = [{ x: { X1: 1 }, n: 20 }, { x: { X1: 1, X2: 1 }, n: 3 }, { x: {}, n: 20 }], m0 = last(BZ.e22, seq, 'M0'), a = m0 === '1' ? '繼續閃' : '熄，恢復';
      return { q: 'E22 的過載規定：按 PB3 之後，TH 復歸（過載排除），PL4 故障燈？', ans: a, wrong: distinct(a, ['繼續閃', '熄，恢復', '一直亮', '要重新開機']), ex: 'E22：按 PB3 BZ 停、PL4 閃；門全開且 TH 復歸後 PL4 熄、恢復（本頁省略門的條件）。' };
    },
    function () { var a = 'LD M0 / AND M8013 / OUT Y2'; return { q: '想讓蜂鳴器 Y2 在異常 M0 時「斷續響」（響 0.5 秒停 0.5 秒），怎麼寫？', ans: a, wrong: distinct(a, ['LD M0 / OUT Y2', 'LD M0 / AND M8002 / OUT Y2', 'LD M0 / SET Y2']), ex: 'E22 的提示：BZ 用 M0 AND M8013，就和閃爍燈一樣。' }; },
    function () {
      var first = pickOne([['X0', 10], ['X1', 20]]), other = first[0] === 'X0' ? 'X1' : 'X0', x1 = {}, x2 = {}; x1[first[0]] = 1; x2.X0 = 1; x2.X1 = 1;
      var d = last(FF.c4, [{ x: {}, n: 2 }, { x: x1, n: 5 }, { x: x2, n: 5 }], 'D220'), a = d;
      return { q: '課程 C4（AND= D220 K0），' + first[0] + ' 先發生，接著 ' + other + ' 也發生。D220 是？', ans: a, wrong: distinct(a, ['10', '20', '30', '0']), ex: 'D220 為 0 才寫入，第一個寫進去之後，後面的不覆蓋。' };
    },
    function () {
      var d = last(FF.raw, [{ x: {}, n: 2 }, { x: { X0: 1 }, n: 5 }, { x: { X0: 1, X1: 1 }, n: 5 }], 'D220'), a = d;
      return { q: '把 C4 的 AND= D220 K0 拿掉：X0（碼 10）先發生，接著 X1（碼 20）也發生，兩個都還在。D220 是？', ans: a, wrong: distinct(a, ['10', '20', '30', '0']), ex: '每圈都寫，寫在後面的 X1 那一行蓋掉前面的，首發的 10 不見了。' };
    },
    function () {
      var d = last(FF.c4, [{ x: {}, n: 2 }, { x: { X0: 1 }, n: 5 }, { x: { X0: 1, X2: 1 }, n: 5 }, { x: { X0: 1 }, n: 5 }], 'D220'), a = d;
      return { q: '課程 C4：X0 軸逾時（碼 10）還沒排除就按 Reset X2，D220 是？', ans: a, wrong: distinct(a, ['0', '10', '20', '-1']), ex: 'Reset 的條件有 ANI X0、ANI X1，原因沒排除，復歸沒有作用。' };
    },
    function () { var a = '異常訊號常常只出現一下，不鎖住就看不到'; return { q: '為什麼異常要用 SET 或自保持「鎖住」？', ans: a, wrong: distinct(a, ['SET 比 OUT 快', '不鎖住 PLC 會當機', 'OUT 不能接燈']), ex: 'E11：逾時就 SET M3 記下異常，按復歸才清。' }; }
  ];
  function gen() { return pickOne(GENS)(); }

  /* ---------- 初始化 ---------- */
  show(/^#(lat|fl|bz|ff)$/.test(location.hash) ? location.hash.slice(1) : 'lat');
  window.AlarmLab = {
    parseIL: parseIL, scan: scan, newState: newState, runTrace: runTrace, LAT: LAT, FL_IL: FL_IL, BZ: BZ, FF: FF,
    show: show, stopLoop: stopLoop, GENS: GENS, gen: gen, quiz: window.LabQuiz ? window.LabQuiz('aquiz', gen) : null
  };
})();
