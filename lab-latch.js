/* 自保持與互鎖實驗室：停止優先／啟動優先、SET／RST 先後、常閉停止鈕、正反轉互鎖、猜一猜
   小型掃描機：每一圈先讀 X 的影像，再由上往下執行，Y 寫了就生效（後面的行讀得到），
   和本站模擬器 engine/plc_engine.py 的做法相同（已用相同的按鈕序列對照過）。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function distinct(ans, list) { var seen = {}; seen[ans] = 1; return list.filter(function (w) { if (seen[w]) return false; seen[w] = 1; return true; }); }
  function say(id, t, cls) { $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); $(id).textContent = t; }

  /* =====================================================================
     小型 PLC：LD LDI AND ANI OR ORI ANB ORB OUT SET RST
     ===================================================================== */
  function dev(s) { var m = /^([XYM])0*(\d+)$/.exec(s); return m ? m[1] + m[2] : s; }
  function parseIL(text) {
    return text.trim().split(/\n/).map(function (l) { var w = l.trim().split(/\s+/); return { op: w[0], d: w[1] ? dev(w[1]) : null }; }).filter(function (i) { return i.op; });
  }
  function get(img, d) { return d[0] === 'X' ? !!img.X[d] : !!img.Y[d]; }
  /* 一圈：x = {X0: true, ...}；img.Y 保留上一圈的值。回傳每一個指令執行時接點是否閉合（畫圖用） */
  function scan(prog, img, x) {
    img.X = {}; Object.keys(x).forEach(function (k) { img.X[k] = !!x[k]; });
    var acc = false, stack = [], fresh = true, closed = [];
    prog.forEach(function (ins, i) {
      var v = ins.d ? get(img, ins.d) : false;
      switch (ins.op) {
        case 'LD': case 'LDI': if (!fresh) stack.push(acc); acc = ins.op === 'LD' ? v : !v; fresh = false; closed[i] = acc; break;
        case 'AND': closed[i] = v; acc = acc && v; break;
        case 'ANI': closed[i] = !v; acc = acc && !v; break;
        case 'OR': closed[i] = v; acc = acc || v; break;
        case 'ORI': closed[i] = !v; acc = acc || !v; break;
        case 'ORB': acc = stack.pop() || acc; break;
        case 'ANB': acc = stack.pop() && acc; break;
        case 'OUT': img.Y[ins.d] = acc; closed[i] = acc; fresh = true; stack = []; break;
        case 'SET': if (acc) img.Y[ins.d] = true; closed[i] = acc; fresh = true; stack = []; break;
        case 'RST': if (acc) img.Y[ins.d] = false; closed[i] = acc; fresh = true; stack = []; break;
      }
    });
    return closed;
  }
  /* 測試用：steps = [{x:{X0:1}, n:3}, …]，回傳每個 Y 每一圈的 0/1 字串 */
  function runTrace(il, steps, ys) {
    var prog = parseIL(il), img = { X: {}, Y: {} }, out = {};
    ys.forEach(function (y) { out[y] = ''; });
    steps.forEach(function (s) { for (var k = 0; k < s.n; k++) { scan(prog, img, s.x); ys.forEach(function (y) { out[y] += img.Y[y] ? '1' : '0'; }); } });
    return out;
  }

  /* ---------- 梯形圖：把一條條 rung 畫出來（串聯、並聯區塊、線圈／SET／RST） ---------- */
  function rungsOf(prog) {
    var rungs = [], cur = [];
    prog.forEach(function (ins, i) { cur.push({ ins: ins, i: i }); if (/^(OUT|SET|RST)$/.test(ins.op)) { rungs.push(cur); cur = []; } });
    return rungs;
  }
  /* 段：每段是並聯的幾條分支，每條分支是串聯的接點 */
  function segments(rung) {
    var segs = [], orSeen = false;
    rung.forEach(function (c) {
      var op = c.ins.op;
      if (op === 'LD' || op === 'LDI') { segs.push([[c]]); orSeen = false; }
      else if (op === 'AND' || op === 'ANI') { if (orSeen || segs[segs.length - 1].length > 1) { segs.push([[c]]); orSeen = false; } else segs[segs.length - 1][0].push(c); }
      else if (op === 'OR' || op === 'ORI') {
        if (segs.length > 1) { var merged = []; segs.forEach(function (s) { merged = merged.concat(s[0]); }); segs = [[merged]]; }
        segs[0].push([c]); orSeen = true;
      }
    });
    return segs;
  }
  function drawLadder(svg, prog, closed, img) {
    var rungs = rungsOf(prog), y = 18, s = '', CW = 72, X0 = 30, COILX = 560;
    rungs.forEach(function (r) {
      var segs = segments(r), outs = r.filter(function (c) { return /^(OUT|SET|RST)$/.test(c.ins.op); }), x = X0, maxB = 1;
      segs.forEach(function (sg) { maxB = Math.max(maxB, sg.length); });
      var yc = y + 26;
      s += '<line class="w" x1="20" y1="' + yc + '" x2="' + X0 + '" y2="' + yc + '"/>';
      segs.forEach(function (sg) {
        var len = Math.max.apply(null, sg.map(function (b) { return b.length; }));
        sg.forEach(function (b, bi) {
          var by = yc + bi * 40, bx = x;
          b.forEach(function (c) {
            var on = !!closed[c.i], nc = /I$/.test(c.ins.op);
            s += '<line class="w" x1="' + bx + '" y1="' + by + '" x2="' + (bx + 22) + '" y2="' + by + '"/>';
            s += '<rect class="ctf' + (on ? ' on' : '') + '" x="' + (bx + 22) + '" y="' + (by - 13) + '" width="24" height="26"/>';
            s += '<line class="ct' + (on ? ' on' : '') + '" x1="' + (bx + 24) + '" y1="' + (by - 13) + '" x2="' + (bx + 24) + '" y2="' + (by + 13) + '"/><line class="ct' + (on ? ' on' : '') + '" x1="' + (bx + 44) + '" y1="' + (by - 13) + '" x2="' + (bx + 44) + '" y2="' + (by + 13) + '"/>';
            if (nc) s += '<line class="ct' + (on ? ' on' : '') + '" x1="' + (bx + 20) + '" y1="' + (by + 13) + '" x2="' + (bx + 48) + '" y2="' + (by - 13) + '"/>';
            s += '<text x="' + (bx + 34) + '" y="' + (by - 17) + '" text-anchor="middle">' + c.ins.d + '</text>';
            s += '<line class="w" x1="' + (bx + 46) + '" y1="' + by + '" x2="' + (bx + CW) + '" y2="' + by + '"/>';
            bx += CW;
          });
          if (bx < x + len * CW) s += '<line class="w" x1="' + bx + '" y1="' + by + '" x2="' + (x + len * CW) + '" y2="' + by + '"/>';
        });
        if (sg.length > 1) { s += '<line class="w" x1="' + x + '" y1="' + yc + '" x2="' + x + '" y2="' + (yc + (sg.length - 1) * 40) + '"/><line class="w" x1="' + (x + len * CW) + '" y1="' + yc + '" x2="' + (x + len * CW) + '" y2="' + (yc + (sg.length - 1) * 40) + '"/>'; }
        x += len * CW;
      });
      s += '<line class="w" x1="' + x + '" y1="' + yc + '" x2="' + COILX + '" y2="' + yc + '"/>';
      outs.forEach(function (o) {
        var yv = img.Y[o.ins.d], on = o.ins.op === 'OUT' ? yv : closed[o.i];
        if (o.ins.op === 'OUT') s += '<ellipse class="coilf' + (yv ? ' on' : '') + '" cx="' + (COILX + 30) + '" cy="' + yc + '" rx="18" ry="13"/><path class="ct coil' + (yv ? ' on' : '') + '" d="M' + (COILX + 18) + ' ' + (yc - 13) + ' q-10 13 0 26 M' + (COILX + 42) + ' ' + (yc - 13) + ' q10 13 0 26"/><text x="' + (COILX + 30) + '" y="' + (yc - 17) + '" text-anchor="middle">' + o.ins.d + '</text>';
        else s += '<rect class="coilf' + (on ? ' on' : '') + '" x="' + COILX + '" y="' + (yc - 13) + '" width="80" height="26"/><rect class="ct coil' + (on ? ' on' : '') + '" x="' + COILX + '" y="' + (yc - 13) + '" width="80" height="26" fill="none"/><text x="' + (COILX + 40) + '" y="' + (yc + 5) + '" text-anchor="middle">' + o.ins.op + ' ' + o.ins.d + '</text>';
      });
      s += '<text class="il" x="' + X0 + '" y="' + (yc + (maxB - 1) * 40 + 30) + '">' + r.map(function (c) { return c.ins.op + (c.ins.d ? ' ' + c.ins.d : ''); }).join(' / ') + '</text>';
      y += maxB * 40 + 34;
    });
    svg.setAttribute('viewBox', '0 0 680 ' + (y + 4));
    svg.innerHTML = '<line class="rail" x1="20" y1="8" x2="20" y2="' + (y - 6) + '"/><line class="rail" x1="660" y1="8" x2="660" y2="' + (y - 6) + '"/>' + s;
  }

  /* ---------- 時間軸 ---------- */
  function timeline(cv, hist, lanes) {
    var dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 600, H = cv.clientHeight || 150;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#0b0f14'; c.fillRect(0, 0, W, H);
    var L = 46, N = 150, lh = (H - 8) / lanes.length, h = hist.slice(-N);
    c.font = '11px ui-monospace,Consolas,monospace';
    lanes.forEach(function (ln, i) {
      var top = 4 + i * lh + 3, bot = top + lh - 8;
      c.fillStyle = '#9aa7b5'; c.textAlign = 'right'; c.fillText(ln.name, L - 6, (top + bot) / 2 + 4);
      c.strokeStyle = '#263241'; c.beginPath(); c.moveTo(L, bot); c.lineTo(W - 4, bot); c.stroke();
      c.strokeStyle = ln.color; c.lineWidth = 2; c.beginPath();
      h.forEach(function (r, k) { var x1 = L + k / N * (W - L - 4), x2 = L + (k + 1) / N * (W - L - 4), y = r[ln.key] ? top : bot; if (k) c.lineTo(x1, y); else c.moveTo(x1, y); c.lineTo(x2, y); });
      c.stroke(); c.lineWidth = 1;
    });
  }

  /* ---------- 掃描迴圈（一次只跑一個分頁） ---------- */
  var LOOP = { id: 0, t: null };
  function stopLoop() { LOOP.id++; if (LOOP.t) clearInterval(LOOP.t); LOOP.t = null; }
  function startLoop(fn) { stopLoop(); var my = LOOP.id; LOOP.t = setInterval(function () { if (my === LOOP.id) fn(); }, 40); }
  function holdButton(btn, set) {
    function on(e) { e.preventDefault(); set(true); btn.classList.add('on'); }
    function off() { set(false); btn.classList.remove('on'); }
    btn.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, off); });
    btn.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) on(e); });
    btn.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') off(); });
  }

  /* ---------- 分頁 ---------- */
  var TABS = ['hold', 'nc', 'fr'];
  function show(t) {
    stopLoop();
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    TABS.forEach(function (k) { $('t-' + k).hidden = k !== t; });
    if (t === 'hold') startHold(); else if (t === 'nc') startNc(); else startFr();
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* =====================================================================
     1. 自保持：誰優先
     ===================================================================== */
  var HOLD = {
    stop: { name: '自保持，停止優先（課程第 4 課）', il: 'LD X000\nOR Y000\nANI X001\nOUT Y000', both: false },
    start: { name: '自保持，啟動優先（啟動並聯在最外面）', il: 'LDI X001\nAND Y000\nOR X000\nOUT Y000', both: true },
    setrst: { name: 'SET／RST，RST 寫在後面', il: 'LD X000\nSET Y000\nLD X001\nRST Y000', both: false },
    rstset: { name: 'SET／RST，SET 寫在後面', il: 'LD X001\nRST Y000\nLD X000\nSET Y000', both: true },
    none: { name: '對照：拿掉 Y0 自己的接點（沒有自保持）', il: 'LD X000\nANI X001\nOUT Y000', both: false }
  };
  $('hsel').innerHTML = Object.keys(HOLD).map(function (k) { return '<option value="' + k + '">' + HOLD[k].name + '</option>'; }).join('');
  var H = { x0: false, x1: false, both: false, img: null, hist: [], prev: {} };
  function startHold() {
    var key = $('hsel').value, prog = parseIL(HOLD[key].il);
    H.img = { X: {}, Y: {} }; H.hist = []; H.prev = {}; H.prevY0 = false; say('hsay', '');
    startLoop(function () {
      var x = { X0: H.x0 || H.both, X1: H.x1 || H.both }, closed = scan(prog, H.img, x), y0 = !!H.img.Y.Y0;
      H.hist.push({ X0: x.X0, X1: x.X1, Y0: y0 }); if (H.hist.length > 400) H.hist.splice(0, 100);
      drawLadder($('hld'), prog, closed, H.img);
      $('hm').className = 'motor' + (y0 ? ' f' : '');
      timeline($('htl'), H.hist, [{ name: 'X0', key: 'X0', color: '#ffd84d' }, { name: 'X1', key: 'X1', color: '#f472b6' }, { name: 'Y0', key: 'Y0', color: '#4ade80' }]);
      var p = H.prev;
      if (x.X0 && x.X1 && !(p.X0 && p.X1)) say('hsay', '兩個一起按：Y0 ' + (y0 ? 'ON。這種寫法是「啟動優先」。' : 'OFF。這種寫法是「停止優先」。') + (key === 'setrst' || key === 'rstset' ? '兩行都成立，' + (key === 'setrst' ? 'RST' : 'SET') + ' 寫在後面，蓋掉前面那行。' : ''), y0 ? 'bad' : 'ok');
      else if (!x.X0 && p.X0 && !x.X1 && y0) say('hsay', '放開啟動，Y0 還是 ON：' + (key.indexOf('set') >= 0 || key === 'rstset' ? 'SET 會一直保持到 RST。' : '電改走 Y0 自己的接點，自保持。'), 'ok');
      else if (!x.X0 && p.X0 && !x.X1 && !y0 && H.prevY0) say('hsay', '放開啟動，Y0 就 OFF 了：放開就停＝沒有自保持。' + (key === 'none' ? '這個程式沒有和 X0 並聯的 Y0 接點（OR Y000），按鈕一放開，電就沒有路可以繞回來。把 OR Y000 加回去，放開後才會繼續 ON。' : '和 X0 並聯的 Y0 接點沒有接上，電沒有路可以繞回來。'), 'bad');
      else if (x.X1 && !p.X1 && !x.X0 && !y0) say('hsay', '按停止：Y0 OFF。放開停止也不會再亮，要重新按啟動。');
      H.prev = x; H.prevY0 = y0;
    });
  }
  $('hsel').onchange = startHold;
  holdButton($('hx0'), function (v) { H.x0 = v; });
  holdButton($('hx1'), function (v) { H.x1 = v; });
  holdButton($('hboth'), function (v) { H.both = v; });

  /* =====================================================================
     2. 停止鈕接常閉
     ===================================================================== */
  var NCP = { and: 'LD X000\nOR Y000\nAND X001\nOUT Y000', ani: 'LD X000\nOR Y000\nANI X001\nOUT Y000' };
  /* 現場：停止鈕接常閉→沒按時 X1 ON；接常開→按下才 ON；線斷了→永遠 OFF */
  function fieldX1(field, pressed, cut) { if (cut) return false; return field === 'nc' ? !pressed : pressed; }
  /* 純函式：用掃描機跑一遍，回傳 {start 能啟動, stop 按停止會停, cut 斷線時會停} */
  function evalCombo(field, prog) {
    var p = parseIL(NCP[prog]);
    function run(seq) { var img = { X: {}, Y: {} }; seq.forEach(function (s) { for (var k = 0; k < s.n; k++) scan(p, img, { X0: s.x0, X1: fieldX1(field, s.stop, s.cut) }); }); return !!img.Y.Y0; }
    var start = run([{ x0: true, stop: false, cut: false, n: 3 }, { x0: false, stop: false, cut: false, n: 3 }]);
    var stop = !run([{ x0: true, stop: false, cut: false, n: 3 }, { x0: false, stop: false, cut: false, n: 3 }, { x0: false, stop: true, cut: false, n: 3 }]);
    var cut = !run([{ x0: true, stop: false, cut: false, n: 3 }, { x0: false, stop: false, cut: false, n: 3 }, { x0: false, stop: false, cut: true, n: 3 }]);
    return { start: start, stop: start && stop, cut: start && cut };
  }
  var N = { x0: false, stop: false, img: null, hist: [], prev: {} };
  function drawMx() {
    var f = $('nfield').value, pg = $('nprog').value, h = '<tr><th>現場</th><th>程式</th><th>能啟動</th><th>按停止會停</th><th>斷線時會停</th></tr>';
    [['nc', 'and'], ['nc', 'ani'], ['no', 'ani'], ['no', 'and']].forEach(function (c) {
      var r = evalCombo(c[0], c[1]), cur = c[0] === f && c[1] === pg;
      function cell(v) { return '<td class="' + (v ? 'ok' : 'bad') + (cur ? ' cur' : '') + '">' + (v ? '✔' : '✖') + '</td>'; }
      h += '<tr><td' + (cur ? ' class="cur"' : '') + '>' + (c[0] === 'nc' ? '常閉' : '常開') + '</td><td' + (cur ? ' class="cur"' : '') + '>' + (c[1] === 'and' ? 'AND X1' : 'ANI X1') + '</td>' + cell(r.start) + cell(r.stop) + cell(r.cut) + '</tr>';
    });
    $('nmx').innerHTML = h;
  }
  function startNc() {
    var f = $('nfield').value, pg = $('nprog').value, prog = parseIL(NCP[pg]), r = evalCombo(f, pg);
    N.img = { X: {}, Y: {} }; N.hist = []; N.prev = {};
    drawMx();
    var msg = f === 'nc' && pg === 'and' ? '正確（課程 A9）：常閉停止鈕平常 X1 是 ON，程式用 AND X1。按停止或線斷了，X1 都變 OFF，馬達停。' :
      f === 'no' && pg === 'ani' ? '一般停止鈕的寫法（第 4 課）：常開按鈕平常 X1 OFF，程式用 ANI X1。能用，但線斷了按停止沒反應。急停、重要的停止要改接常閉。' :
      f === 'nc' && pg === 'ani' ? '接錯了：常閉停止鈕平常 X1 就是 ON，ANI X1 一直斷開，按啟動也轉不起來。' :
      '接錯了：常開停止鈕平常 X1 是 OFF，AND X1 一直斷開，馬達轉不起來。';
    say('nsay', msg, r.start && r.cut ? 'ok' : r.start ? '' : 'bad');
    startLoop(function () {
      var x1 = fieldX1(f, N.stop, $('ncut').checked), x = { X0: N.x0, X1: x1 }, closed = scan(prog, N.img, x), y0 = !!N.img.Y.Y0;
      N.hist.push({ X0: x.X0, X1: x1, Y0: y0 }); if (N.hist.length > 400) N.hist.splice(0, 100);
      drawLadder($('nld'), prog, closed, N.img);
      $('nlamp').className = 'lamp' + (x1 ? ' on' : ''); $('nm').className = 'motor' + (y0 ? ' f' : '');
      timeline($('ntl'), N.hist, [{ name: 'X0', key: 'X0', color: '#ffd84d' }, { name: 'X1', key: 'X1', color: '#f472b6' }, { name: 'Y0', key: 'Y0', color: '#4ade80' }]);
    });
  }
  $('nfield').onchange = startNc; $('nprog').onchange = startNc;
  holdButton($('nx0'), function (v) { N.x0 = v; });
  holdButton($('nx1'), function (v) { N.stop = v; });

  /* =====================================================================
     3. 正反轉互鎖
     ===================================================================== */
  var FR = [
    'LD X000\nOR Y000\nANI X002\nOUT Y000\nLD X001\nOR Y001\nANI X002\nOUT Y001',
    'LD X000\nOR Y000\nANI X002\nANI Y001\nOUT Y000\nLD X001\nOR Y001\nANI X002\nANI Y000\nOUT Y001',
    'LD X000\nOR Y000\nANI X002\nANI X001\nANI Y001\nOUT Y000\nLD X001\nOR Y001\nANI X002\nANI X000\nANI Y000\nOUT Y001'
  ];
  var F = { x0: false, x1: false, x2: false, both: false, img: null, hist: [], prev: {} };
  function startFr() {
    var mode = +$('fsel').value, prog = parseIL(FR[mode]);
    F.img = { X: {}, Y: {} }; F.hist = []; F.prev = { Y0: false, Y1: false }; say('fsay', '');
    startLoop(function () {
      var x = { X0: F.x0 || F.both, X1: F.x1 || F.both, X2: F.x2 }, closed = scan(prog, F.img, x), y0 = !!F.img.Y.Y0, y1 = !!F.img.Y.Y1, p = F.prev;
      F.hist.push({ X0: x.X0, X1: x.X1, X2: x.X2, Y0: y0, Y1: y1 }); if (F.hist.length > 400) F.hist.splice(0, 100);
      drawLadder($('fld'), prog, closed, F.img);
      $('fy0').className = 'lamp' + (y0 ? ' on' : ''); $('fy1').className = 'lamp' + (y1 ? ' on' : '');
      $('fm').className = 'motor' + (y0 && y1 ? ' short' : y0 ? ' f' : y1 ? ' r' : '');
      $('fwarn').hidden = !(y0 && y1);
      timeline($('ftl'), F.hist, [{ name: 'X0', key: 'X0', color: '#ffd84d' }, { name: 'X1', key: 'X1', color: '#f472b6' }, { name: 'X2', key: 'X2', color: '#9ca3af' }, { name: 'Y0', key: 'Y0', color: '#4ade80' }, { name: 'Y1', key: 'Y1', color: '#60a5fa' }]);
      if (y0 && y1 && !(p.Y0 && p.Y1)) say('fsay', '沒有互鎖：正轉、反轉都自保持住了，兩個輸出同時 ON。這就是第 9 課說的短路，所以一定要互鎖（而且實機還要硬體互鎖）。', 'bad');
      else if (p.Y0 && !y0 && y1) say('fsay', '按反轉：按鈕互鎖 ANI X1 先切掉正轉，同一圈下面那行看到 Y0 已經 OFF，反轉就 ON 了。', 'ok');
      else if (y0 && x.X1 && !p.X1 && !y1) say('fsay', mode === 1 ? '正轉中按反轉：反轉那行被 ANI Y0 擋住，沒反應。要先按停止 X2，再按反轉。' : '', mode === 1 ? '' : '');
      else if (x.X0 && x.X1 && !y0 && !y1 && !(p.X0 && p.X1)) say('fsay', mode === 2 ? '從停止狀態正反一起按：按鈕互鎖讓兩行都斷開，兩個都不動。' : '一起按：上面那行先算，正轉先 ON，下面那行看到 Y0 已經 ON，被擋住。', 'ok');
      else if (x.X0 && x.X1 && y0 && !y1 && !(p.X0 && p.X1) && mode === 1) say('fsay', '從停止狀態正反一起按：正轉那行寫在上面先算，Y0 ON；反轉那行看到 Y0 已經 ON，被 ANI Y0 擋住。', 'ok');
      F.prev = { X0: x.X0, X1: x.X1, Y0: y0, Y1: y1 };
    });
  }
  $('fsel').onchange = startFr;
  holdButton($('fx0'), function (v) { F.x0 = v; });
  holdButton($('fx1'), function (v) { F.x1 = v; });
  holdButton($('fx2'), function (v) { F.x2 = v; });
  holdButton($('fboth'), function (v) { F.both = v; });

  /* =====================================================================
     4. 猜一猜（答案由掃描機算出來）
     ===================================================================== */
  var ON = { true: 'ON', false: 'OFF' };
  function after(il, seq, y) { var t = runTrace(il, seq, [y]); return t[y].slice(-1) === '1'; }
  var GENS = [
    function () { var a = 'ON，靠 Y0 自己的接點保持'; return { q: '<code>LD X0 / OR Y0 / ANI X1 / OUT Y0</code>：按一下 X0 再放開，Y0 是？', ans: a, wrong: distinct(a, ['OFF，放開就熄', '閃爍', 'ON，因為 X1 是常閉按鈕']), ex: '自保持：啟動放開後，電從並聯的 Y0 接點繞回來。' }; },
    function () { var a = 'OFF，而且放開停止也不會再亮'; return { q: '同一個自保持，Y0 正在 ON，按一下 X1（停止）再放開，Y0 是？', ans: a, wrong: distinct(a, ['放開停止後又亮起來', '按住時 OFF，放開又 ON', '一直 ON，停止無效']), ex: '按停止時 Y0 自己的接點也跟著斷了，放開停止也接不回來，要重新按啟動。' }; },
    function () {
      var k = pickOne(['stop', 'start']), il = HOLD[k].il, v = after(il, [{ x: { X0: 1, X1: 1 }, n: 3 }], 'Y0'), a = ON[v];
      return { q: '<code>' + il.replace(/\n/g, ' / ').replace(/00(\d)/g, '$1') + '</code>，X0 和 X1 <b>同時按住</b>，Y0 是？', ans: a, wrong: distinct(a, ['ON', 'OFF', '每一圈 ON、OFF 交替', '不一定，看誰先按']), ex: v ? '啟動優先：X0 並聯在最外面，繞過停止。' : '停止優先：ANI X1 串在最後，擋住整條。' };
    },
    function () {
      var k = pickOne(['setrst', 'rstset']), il = HOLD[k].il, v = after(il, [{ x: { X0: 1, X1: 1 }, n: 3 }], 'Y0'), a = ON[v];
      return { q: '<code>' + il.replace(/\n/g, ' / ').replace(/00(\d)/g, '$1') + '</code>，X0、X1 同時按住，Y0 是？', ans: a, wrong: distinct(a, ['ON', 'OFF', '每一圈 ON、OFF 交替', '執行錯誤']), ex: '兩行都成立，掃描由上往下，寫在後面的 ' + (k === 'setrst' ? 'RST' : 'SET') + ' 蓋掉前面的。' };
    },
    function () { var a = 'AND X1（常開接點）'; return { q: '停止鈕在現場接<b>常閉</b>，程式的自保持迴路要用哪個接點串停止？', ans: a, wrong: distinct(a, ['ANI X1（常閉接點）', 'OR X1', '不用串，接線已經處理了']), ex: '課程 A9：現場常閉 ≠ 程式常閉。常閉按鈕平常 X1 是 ON，程式用常開接點讀它。' }; },
    function () { var r = evalCombo('nc', 'ani'), a = r.start ? '可以啟動' : '按啟動也轉不起來'; return { q: '停止鈕現場接常閉，程式卻寫 <code>LD X0 / OR Y0 / ANI X1 / OUT Y0</code>，會？', ans: a, wrong: distinct(a, ['可以啟動', '按啟動也轉不起來', '啟動後停不下來', '一直在轉']), ex: '常閉按鈕平常 X1 就是 ON，ANI X1 一直斷開。' }; },
    function () { var a = '馬達停下來'; return { q: '停止鈕接常閉、程式用 AND X1，馬達運轉中停止鈕的電線斷了，會？', ans: a, wrong: distinct(a, ['馬達照轉', '馬達反轉', 'PLC 報錯當機']), ex: '斷線讓 X1 變 OFF，和按下停止一樣。這就是重要停止要接常閉的原因。' }; },
    function () { var a = 'ANI Y1'; return { q: '正轉 Y0、反轉 Y1。正轉那一行要串上哪個接點做互鎖？', ans: a, wrong: distinct(a, ['ANI Y0', 'AND Y1', 'OR Y1']), ex: '正轉串反轉的常閉接點（/Y1），反轉串正轉的常閉接點（/Y0）。' }; },
    function () {
      var v0 = after(FR[0], [{ x: { X0: 1, X1: 1 }, n: 3 }, { x: {}, n: 2 }], 'Y0'), v1 = after(FR[0], [{ x: { X0: 1, X1: 1 }, n: 3 }, { x: {}, n: 2 }], 'Y1'), a = v0 && v1 ? 'Y0、Y1 都 ON（危險）' : 'Y0 ON';
      return { q: '正反轉各自保持，但<b>沒有互鎖</b>。從停止狀態同時按正轉、反轉再放開，結果？', ans: a, wrong: distinct(a, ['Y0、Y1 都 ON（危險）', '兩個都 OFF', '只有 Y0 ON', '只有 Y1 ON']), ex: '兩行都自保持住，正反轉同時通電會短路。' };
    },
    function () {
      var v = after(FR[1], [{ x: { X0: 1 }, n: 2 }, { x: {}, n: 2 }, { x: { X1: 1 }, n: 3 }], 'Y1'), a = v ? '反轉立刻 ON' : '沒反應，要先按停止';
      return { q: '有輸出互鎖（ANI Y1／ANI Y0）的正反轉，正轉中直接按反轉，會？', ans: a, wrong: distinct(a, ['反轉立刻 ON', '沒反應，要先按停止', '正轉、反轉都 ON', '正轉停，反轉也不動']), ex: '反轉那行被 ANI Y0 擋住。要直接換向，可以再加按鈕互鎖（但實機換向前通常還要考慮延遲）。' };
    },
    function () {
      var y0 = after(FR[2], [{ x: { X0: 1 }, n: 2 }, { x: {}, n: 2 }, { x: { X1: 1 }, n: 2 }], 'Y0'), y1 = after(FR[2], [{ x: { X0: 1 }, n: 2 }, { x: {}, n: 2 }, { x: { X1: 1 }, n: 2 }], 'Y1');
      var a = !y0 && y1 ? '正轉 OFF，反轉 ON' : 'Y0 ' + ON[y0] + '，Y1 ' + ON[y1];
      return { q: '輸出互鎖＋按鈕互鎖（正轉那行多了 ANI X1，反轉那行多了 ANI X0），正轉中按反轉，會？', ans: a, wrong: distinct(a, ['正轉 OFF，反轉 ON', '沒反應，要先按停止', '正轉、反轉都 ON', '兩個都 OFF，要再按一次']), ex: 'ANI X1 先切掉正轉；同一圈下面那行看到 Y0 已經 OFF，反轉就 ON。' };
    },
    function () { var a = '要，正反轉接觸器還要加硬體互鎖'; return { q: '程式已經寫了 ANI Y1／ANI Y0 互鎖，實機上還需要其他互鎖嗎？', ans: a, wrong: distinct(a, ['不用，程式互鎖就夠了', '不用，PLC 會自動檢查', '只有 LabVIEW 下命令時才需要']), ex: '第 9 課：程式不是唯一的保護；ANI Y000 看的是 PLC 輸出，不是接觸器真的放開了。' }; },
    function () { var a = 'Y0 自己的常開接點'; return { q: '自保持迴路裡，和啟動按鈕 X0 並聯的是？', ans: a, wrong: distinct(a, ['停止按鈕 X1 的常閉接點', 'Y0 的常閉接點', '另一個啟動按鈕']), ex: '線圈自己的接點並聯在按鈕上，放開後電從自己的接點繞回來。' }; },
    function () { var a = '後寫的那一行'; return { q: '同一個 Y0 被 SET 和 RST 兩行同時成立，最後 Y0 聽誰的？', ans: a, wrong: distinct(a, ['先寫的那一行', '永遠聽 SET', '永遠聽 RST', '每圈輪流']), ex: '掃描由上往下，後面那行再寫一次就蓋掉前面的結果。' }; }
  ];
  function gen() { return pickOne(GENS)(); }

  /* ---------- 初始化 ---------- */
  show(/^#(hold|nc|fr)$/.test(location.hash) ? location.hash.slice(1) : 'hold');
  window.addEventListener('resize', function () { /* 下一圈會重畫 */ });
  window.LatchLab = {
    parseIL: parseIL, scan: scan, runTrace: runTrace, fieldX1: fieldX1, evalCombo: evalCombo, HOLD: HOLD, NCP: NCP, FR: FR,
    show: show, stopLoop: stopLoop, GENS: GENS, gen: gen, quiz: window.LabQuiz ? window.LabQuiz('lquiz', gen) : null
  };
})();
