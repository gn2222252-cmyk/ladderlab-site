/* 步進實驗室：STL 單一流程、換步那一圈、並行合流、停電
   模擬規則照本站 engine/plc_engine.py 的步進實作（三菱 FX3 程式手冊第 35 章）：
   作用中的步：整段照常執行，段內 SET S（或 OUT S）會在這段結束時關掉自己；
   剛離開的步：下一圈「斷電執行一次」，OUT 線圈和計時器變 OFF；之後整段跳過。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function log(id, s) { var l = $(id); l.insertBefore(el('div', '', s), l.firstChild); }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  var DT = 100;   // 一掃描 100 ms（為了看得清楚）
  var OUTOPS = { OUT: 1, SET: 1, RST: 1, ZRST: 1 };

  /* ================= 迷你 PLC ================= */
  function parse(il) {
    return il.trim().split('\n').map(function (ln) { var p = ln.trim().split(/\s+/); return { op: p[0], a: p.slice(1) }; });
  }
  function PLC(il) {
    this.src = il; this.code = parse(il);
    this.x = {}; this.y = {}; this.m = {}; this.s = {}; this.ran = {}; this.t = {}; this.ton = {};
    this.scans = 0; this.ms = 0; this.trace = [];
  }
  PLC.prototype.dev = function (d) {
    var k = d.charAt(0), n = d.slice(1);
    if (d === 'M8000') return 1;
    if (d === 'M8002') return this.scans === 0 ? 1 : 0;
    if (k === 'X') return this.x[n] ? 1 : 0;
    if (k === 'Y') return this.y[n] ? 1 : 0;
    if (k === 'M') return this.m[n] ? 1 : 0;
    if (k === 'S') return this.s[n] ? 1 : 0;
    if (k === 'T') return this.ton[n] ? 1 : 0;
    return 0;
  };
  PLC.prototype.scan = function () {
    var me = this, acc = 0, state = null, group = [], mode = 0, leave = false, tr = [];
    function close() { if (state !== null && leave) group.forEach(function (k) { me.s[k] = 0; }); state = null; group = []; mode = 0; leave = false; }
    function putS(n, v) { me.s[n] = v ? 1 : 0; if (v && mode === 1) leave = true; }
    this.code.forEach(function (c, i) {
      var op = c.op, a = c.a;
      if (op === 'STL') {
        var n = +a[0].slice(1), joins = i > 0 && me.code[i - 1].op === 'STL';
        if (joins && state !== null) group = group.concat([n]); else { close(); group = [n]; }
        state = n;
        if (group.every(function (k) { return me.s[k]; })) { group.forEach(function (k) { me.ran[k] = 1; }); mode = 1; acc = 1; }
        else if (group.some(function (k) { return me.ran[k]; })) { group.forEach(function (k) { me.ran[k] = 0; }); mode = 2; acc = 0; }
        else { mode = 3; acc = 0; }
        tr[i] = { mode: mode, group: group.slice() };
        return;
      }
      if (op === 'RET' || op === 'END') { close(); acc = 0; tr[i] = { ret: 1 }; return; }
      if (mode === 3) { tr[i] = { skip: 1 }; return; }
      if (mode === 2 && OUTOPS[op]) acc = 0;
      if (op === 'LD') acc = me.dev(a[0]);
      else if (op === 'LDI') acc = me.dev(a[0]) ? 0 : 1;
      else if (op === 'AND') acc = acc & me.dev(a[0]);
      else if (op === 'ANI') acc = acc & (me.dev(a[0]) ? 0 : 1);
      else if (op === 'OUT') {
        var d = a[0], k = d.charAt(0), n2 = d.slice(1);
        if (k === 'Y') me.y[n2] = acc; else if (k === 'M') me.m[n2] = acc;
        else if (k === 'S') { if (acc) putS(+n2, 1); }   // OUT S：條件成立時轉移，不會把目標清掉

        else if (k === 'T') { var pre = +a[1].slice(1) * 100; if (acc) { me.t[n2] = (me.t[n2] || 0) + DT; me.ton[n2] = me.t[n2] >= pre ? 1 : 0; } else { me.t[n2] = 0; me.ton[n2] = 0; } }
      } else if (op === 'SET' && acc) {
        var d2 = a[0]; if (d2.charAt(0) === 'S') putS(+d2.slice(1), 1); else me.y[d2.slice(1)] = 1;
      } else if (op === 'RST' && acc) {
        var d3 = a[0]; if (d3.charAt(0) === 'S') me.s[+d3.slice(1)] = 0; else if (d3.charAt(0) === 'T') { me.t[d3.slice(1)] = 0; me.ton[d3.slice(1)] = 0; } else me.y[d3.slice(1)] = 0;
      } else if (op === 'ZRST' && acc) {
        var lo = +a[0].slice(1), hi = +a[1].slice(1); for (var q = lo; q <= hi; q++) me.s[q] = 0;
      }
      tr[i] = { acc: acc, mode: mode };
    });
    close();
    this.trace = tr; this.scans++; this.ms += DT;
  };
  PLC.prototype.active = function () { var me = this; return Object.keys(this.s).filter(function (k) { return me.s[k]; }).map(Number).sort(function (a, b) { return a - b; }); };
  /* 停電：FX3S 的 S0～S127 保持，其他全部歸零，M8002 重新 ON 一圈 */
  PLC.prototype.powerCycle = function () {
    var keep = {}, me = this; Object.keys(this.s).forEach(function (k) { if (+k <= 127 && me.s[k]) keep[k] = 1; });
    this.y = {}; this.m = {}; this.t = {}; this.ton = {}; this.ran = {}; this.s = keep; this.scans = 0; this.trace = [];
  };

  /* ================= 畫圖 ================= */
  function devCls(p, d) { return p.dev(d) ? ' on' : ''; }
  function ladder(box, p, names) {
    var h = '', rung = null, code = p.code, tr = p.trace;
    function flush() { if (rung) { h += '<div class="rg' + (rung.dim ? ' dim' : '') + '">' + rung.parts.join('<span class="wr">─</span>') + '</div>'; rung = null; } }
    function nm(d) { return names && names[d] ? d + ' ' + names[d] : d; }
    code.forEach(function (c, i) {
      var t = tr[i] || {}, a = c.a;
      if (c.op === 'STL') {
        flush();
        if (code[i + 1] && code[i + 1].op === 'STL') return;          // 連續的 STL：合流，等最後一個一起畫
        var join = t.group && t.group.length > 1, st = t.mode === 1 ? ' on' : t.mode === 2 && !join ? ' off1' : '';
        var title = join ? 'STL ' + t.group.map(function (k) { return 'S' + k; }).join('・STL ') + '（合流）' : 'STL ' + a[0] + (names && names[a[0]] ? '　' + names[a[0]] : '');
        h += '<div class="stl' + st + '">' + title + (t.mode === 1 ? '　（執行中）' : join ? '　（要兩步都作用才執行）' : t.mode === 2 ? '　（剛離開：斷電執行一次）' : '') + '</div>';
        return;
      }
      if (c.op === 'RET') { flush(); h += '<div class="ret">RET</div>'; return; }
      var dim = t.skip || t.mode === 3;
      if (c.op === 'LD' || c.op === 'LDI') { flush(); rung = { parts: [], dim: dim }; }
      if (!rung) rung = { parts: [], dim: dim };
      if (c.op === 'LD' || c.op === 'AND') rung.parts.push('<span class="ct' + (!dim && p.dev(a[0]) ? ' on' : '') + '">┤' + nm(a[0]) + '├</span>');
      else if (c.op === 'LDI' || c.op === 'ANI') rung.parts.push('<span class="ct' + (!dim && !p.dev(a[0]) ? ' on' : '') + '">┤/' + nm(a[0]) + '├</span>');
      else {
        var lbl = c.op === 'OUT' ? nm(a[0]) + (a[1] ? ' ' + a[1] : '') : c.op + ' ' + a.join(' ');
        if (c.op === 'OUT' && a[0].charAt(0) === 'S') lbl = 'OUT ' + a[0];
        rung.parts.push('<span class="cl' + (!dim && t.acc ? ' on' : '') + '">( ' + lbl + ' )</span>');
      }
    });
    flush();
    box.innerHTML = h;
  }
  /* SFC：steps = [{s, x, y, lab, init}]，links = [[x1,y1,x2,y2]]，trs = [{x,y,lab}]，dbl = [[x1,x2,y]]，jumps = [{x,y,to}] */
  function sfc(svg, L, p) {
    var h = '', act = p.active();
    (L.links || []).forEach(function (l) { h += '<path class="ln" d="M' + l.join(' ').replace(/^(\S+ \S+) /, '$1 L') + '"/>'; });
    (L.dbl || []).forEach(function (d) { h += '<line class="dbl" x1="' + d[0] + '" y1="' + d[2] + '" x2="' + d[1] + '" y2="' + d[2] + '"/><line class="dbl" x1="' + d[0] + '" y1="' + (d[2] + 4) + '" x2="' + d[1] + '" y2="' + (d[2] + 4) + '"/>'; });
    (L.trs || []).forEach(function (t) { h += '<line class="tr" x1="' + (t.x - 9) + '" y1="' + t.y + '" x2="' + (t.x + 9) + '" y2="' + t.y + '"/><text class="tl" x="' + (t.x + 13) + '" y="' + (t.y + 4) + '">' + t.lab + '</text>'; });
    (L.jumps || []).forEach(function (j) { h += '<path class="ln" d="M' + j.x + ' ' + j.y + ' l0 10"/><path d="M' + (j.x - 6) + ' ' + (j.y + 10) + ' l6 8 l6 -8 z" fill="#6b7280"/><text x="' + (j.x + 10) + '" y="' + (j.y + 20) + '">' + j.to + '</text>'; });
    L.steps.forEach(function (s) {
      var n = +s.s.slice(1), on = act.indexOf(n) >= 0;
      h += '<g class="stp' + (s.init ? ' init' : '') + (on ? ' on' : '') + '">' + (s.init ? '<rect class="o" x="' + (s.x - 40) + '" y="' + (s.y - 17) + '" width="80" height="34"/>' : '') +
        '<rect class="i" x="' + (s.x - 36) + '" y="' + (s.y - 13) + '" width="72" height="26"/><text x="' + s.x + '" y="' + (s.y + 4) + '" text-anchor="middle">' + s.s + '</text>' +
        (s.lab ? '<text class="tl" x="' + (s.lab2 ? s.x - 42 : s.x + 44) + '" y="' + (s.y + 4) + '"' + (s.lab2 ? ' text-anchor="end"' : '') + '>' + s.lab + '</text>' : '') + '</g>';
    });
    svg.setAttribute('viewBox', '0 0 ' + L.w + ' ' + L.h); svg.innerHTML = h;
  }
  function timeline(svg, hist, rows) {
    var N = 80, rh = 18, lw = 44, W = 420, H = rows.length * rh + 6, cw = (W - lw - 4) / N, h = '';
    rows.forEach(function (r, ri) {
      var y = 4 + ri * rh;
      h += '<text x="2" y="' + (y + 12) + '">' + r[1] + '</text><line x1="' + lw + '" y1="' + (y + 15) + '" x2="' + (W - 2) + '" y2="' + (y + 15) + '" stroke="var(--line)"/>';
      var start = Math.max(0, hist.length - N);
      for (var i = start; i < hist.length; i++) if (hist[i][r[0]]) h += '<rect x="' + (lw + (i - start) * cw) + '" y="' + (y + 3) + '" width="' + (cw + .3) + '" height="12" fill="' + (r[0].charAt(0) === 'S' ? '#facc15' : '#ef4444') + '"/>';
    });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.innerHTML = h;
  }
  function snap(p, rows) { var o = {}; rows.forEach(function (r) { o[r[0]] = p.dev(r[0]); }); return o; }

  /* ================= 共用的「跑一個程式」 ================= */
  function Runner(cfg) { this.cfg = cfg; this.gen = 0; this.timer = null; this.reset(); }
  Runner.prototype.reset = function () {
    this.stop(); this.p = new PLC(this.cfg.il()); this.hist = []; this.press = {}; this.prevAct = '';
    if (this.cfg.logId) $(this.cfg.logId).innerHTML = '';
    if (this.cfg.sayId) say(this.cfg.sayId, '');
    this.draw();
  };
  Runner.prototype.stop = function () { this.gen++; if (this.timer) { clearInterval(this.timer); this.timer = null; } if (this.cfg.runBtn) $(this.cfg.runBtn).textContent = '▶ 執行'; };
  Runner.prototype.step = function () {
    var p = this.p, me = this;
    Object.keys(this.press).forEach(function (k) { p.x[k] = me.press[k] > 0 ? 1 : 0; if (me.press[k] > 0) me.press[k]--; });
    var before = p.active().join(',');
    p.scan();
    this.hist.push(snap(p, this.cfg.rows));
    var after = p.active().join(',');
    if (before !== after && this.cfg.logId) log(this.cfg.logId, (p.ms / 1000).toFixed(1) + ' s：作用中的步 ' + (before ? 'S' + before.split(',').join('、S') : '（無）') + ' → ' + (after ? 'S' + after.split(',').join('、S') : '（無）'));
    if (this.cfg.onScan) this.cfg.onScan(this, before, after);
    this.draw();
  };
  Runner.prototype.run = function () {
    if (this.timer) { this.stop(); return; }
    var me = this, g = ++this.gen;
    this.timer = setInterval(function () { if (g !== me.gen) return; me.step(); }, DT);
    if (this.cfg.runBtn) $(this.cfg.runBtn).textContent = '⏸ 暫停';
  };
  Runner.prototype.pulse = function (k, n) { this.press[k] = n || 3; this.draw(); };
  Runner.prototype.draw = function () {
    var c = this.cfg, p = this.p;
    if (c.sfcId) sfc($(c.sfcId), c.layout(), p);
    if (c.ladId) ladder($(c.ladId), p, c.names);
    if (c.tlId) timeline($(c.tlId), this.hist, c.rows);
    if (c.scanId) $(c.scanId).textContent = p.scans;
    if (c.timeId) $(c.timeId).textContent = (p.ms / 1000).toFixed(1);
    if (c.ioId) {
      var me = this, io = $(c.ioId);
      if (!io.dataset.built) {
        io.dataset.built = 1;
        (c.ins || []).forEach(function (x) { var b = el('button', 'inb', x[1]); b.type = 'button'; b.dataset.x = x[0]; b.onclick = function () { me.pulse(x[0]); if (!me.timer) { me.step(); } }; io.appendChild(b); });
        (c.outs || []).forEach(function (y) { var s = el('span', 'lamp2', '<i></i>' + y[1]); s.dataset.y = y[0]; io.appendChild(s); });
      }
      Array.prototype.forEach.call(io.querySelectorAll('[data-x]'), function (b) { b.classList.toggle('on', !!(me.press[b.dataset.x] > 0 || p.x[b.dataset.x])); });
      Array.prototype.forEach.call(io.querySelectorAll('[data-y]'), function (s) { s.classList.toggle('on', !!p.y[s.dataset.y]); });
    }
    if (c.onDraw) c.onDraw(this);
  };

  /* ================= 1. 單一流程 ================= */
  var IL_FLOW = 'LD M8002\nSET S0\nSTL S0\nLD X3\nRST Y1\nLD X0\nSET S20\nSTL S20\nOUT Y0\nLD X1\nSET S21\nSTL S21\nSET Y1\nOUT T0 K10\nLD T0\nSET S22\nSTL S22\nOUT Y2\nLD X2\nOUT S0\nRET';
  var NAMES_FLOW = { S0: '待機', S20: '輸送', S21: '推出', S22: '蓋章', X0: '啟動', X1: '到位', X2: '蓋完', X3: '推桿收', Y0: '輸送帶', Y1: '推桿', Y2: '蓋章', T0: '1秒' };
  function linLayout(ids, labs, trs, w) {
    var L = { w: w || 300, h: 70 + ids.length * 60, steps: [], links: [], trs: [], jumps: [] }, x = 80;
    ids.forEach(function (s, i) { var y = 30 + i * 60; L.steps.push({ s: s, x: x, y: y, lab: labs[i], init: i === 0 }); if (i < ids.length - 1) { L.links.push([x, y + 13, x, y + 47]); L.trs.push({ x: x, y: y + 30, lab: trs[i] }); } });
    var ly = 30 + (ids.length - 1) * 60; L.links.push([x, ly + 13, x, ly + 26]); L.trs.push({ x: x, y: ly + 24, lab: trs[ids.length - 1] }); L.jumps.push({ x: x, y: ly + 28, to: ids[0] });
    L.h = ly + 60; return L;
  }
  var RF = new Runner({
    il: function () { return IL_FLOW; }, names: NAMES_FLOW,
    layout: function () { return linLayout(['S0', 'S20', 'S21', 'S22'], ['待機（X3 收推桿）', 'OUT Y0 輸送帶', 'SET Y1 推桿、T0 1 秒', 'OUT Y2 蓋章'], ['X0 啟動', 'X1 到位', 'T0', 'X2 蓋完']); },
    rows: [['S0', 'S0'], ['S20', 'S20'], ['S21', 'S21'], ['S22', 'S22'], ['Y0', 'Y0'], ['Y1', 'Y1'], ['Y2', 'Y2']],
    ins: [['0', 'X0 啟動'], ['1', 'X1 到位'], ['2', 'X2 蓋完'], ['3', 'X3 推桿收']], outs: [['0', 'Y0 輸送帶'], ['1', 'Y1 推桿'], ['2', 'Y2 蓋章']],
    sfcId: 'fsfc', ladId: 'flad', tlId: 'ftl', ioId: 'fio', scanId: 'fscan', timeId: 'ftime', logId: 'flog', sayId: 'fsay', runBtn: 'frun',
    onScan: function (r, b, a) {
      var p = r.p;
      if (b === a) return;
      if (a === '22') say('fsay', '進 S22：S21 的 T0 歸零了，但推桿 Y1 還伸著。它是用 SET 打開的，離開 S21 不會自己關。');
      else if (a === '0' && p.y[1]) say('fsay', '回到 S0：Y0、Y2 都是 OUT，離開步就 OFF；Y1 是 SET，還亮著。在待機按 X3 才會 RST Y1。');
      else if (a === '21') say('fsay', '進 S21：SET Y1 推桿伸出，T0 開始數 1 秒。S20 的 Y0 在下一圈「斷電執行一次」時變 OFF。');
      else if (a === '20') say('fsay', '進 S20：OUT Y0 輸送帶走，等 X1。X0 只寫在 S0 裡，現在再按 X0 沒有作用。');
    },
    onDraw: function (r) { if (r.p.scans && !r.p.active().length) say('fsay', ''); }
  });
  $('frun').onclick = function () { RF.run(); }; $('fstep').onclick = function () { RF.stop(); RF.step(); }; $('freset').onclick = function () { RF.reset(); };

  /* ================= 2. 換步的那一圈 ================= */
  var IL_SCAN = {
    ok: 'LD M8002\nSET S0\nSTL S0\nLD X0\nSET S20\nSTL S20\nOUT Y0\nOUT T0 K3\nLD T0\nSET S21\nSTL S21\nOUT Y1\nOUT T1 K3\nLD T1\nSET S22\nSTL S22\nOUT Y2\nLD X0\nOUT S0\nRET',
    fwd: 'LD M8002\nSET S0\nSTL S0\nLD X0\nSET S20\nSTL S20\nOUT Y0\nOUT T0 K3\nLD T0\nSET S21\nSTL S21\nOUT Y1\nOUT T0 K3\nLD T0\nSET S22\nSTL S22\nOUT Y2\nLD X0\nOUT S0\nRET',
    e12: 'LD M8002\nSET S0\nSTL S0\nLD M8000\nSET S20\nSTL S20\nOUT Y0\nOUT T0 K3\nLD T0\nSET S21\nSTL S21\nOUT Y1\nOUT T0 K3\nLD T0\nOUT S20\nRET'
  };
  function scanLayout() {
    var e = $('sprog').value === 'e12';
    if (e) {
      var L = { w: 300, h: 210, steps: [{ s: 'S0', x: 80, y: 30, lab: '', init: true }, { s: 'S20', x: 80, y: 90, lab: 'OUT Y0、T0' }, { s: 'S21', x: 80, y: 150, lab: 'OUT Y1、T0' }],
        links: [[80, 43, 80, 77], [80, 103, 80, 137], [80, 163, 80, 176]], trs: [{ x: 80, y: 60, lab: 'M8000' }, { x: 80, y: 120, lab: 'T0' }, { x: 80, y: 172, lab: 'T0' }], jumps: [{ x: 80, y: 178, to: 'S20' }] };
      return L;
    }
    return linLayout(['S0', 'S20', 'S21', 'S22'], ['', 'OUT Y0、T0', 'OUT Y1、' + ($('sprog').value === 'fwd' ? 'T0 ⚠' : 'T1'), 'OUT Y2'], ['X0', 'T0', $('sprog').value === 'fwd' ? 'T0' : 'T1', 'X0']);
  }
  var SROWS = [['S0', 'S0'], ['S20', 'S20'], ['S21', 'S21'], ['S22', 'S22'], ['Y0', 'Y0'], ['Y1', 'Y1'], ['Y2', 'Y2']];
  var RS = new Runner({
    il: function () { return IL_SCAN[$('sprog').value]; },
    layout: scanLayout, rows: SROWS, sfcId: 'ssfc', ladId: 'slad', sayId: 'ssay',
    onScan: function (r, b, a) { sRow(r); },
    onDraw: function (r) { if (!r.p.scans) $('stab').innerHTML = sHead(); }
  });
  function sHead() { return '<tr><th>掃描</th><th>X0</th><th>T0</th><th>S0</th><th>S20</th><th>S21</th><th>S22</th><th>Y0</th><th>Y1</th><th>Y2</th><th>這一圈</th></tr>'; }
  function sRow(r) {
    var p = r.p, tr = p.trace, ran = {}, off = {};
    p.code.forEach(function (c, i) { if (c.op === 'STL' && tr[i]) { tr[i].group.forEach(function (k) { if (tr[i].mode === 1) ran[k] = 1; if (tr[i].mode === 2) off[k] = 1; }); } });
    var note = [], ks = Object.keys(ran);
    if (ks.length > 1) note.push('S' + ks.join('、S') + ' 這一圈都執行了');
    Object.keys(off).forEach(function (k) { note.push('S' + k + ' 斷電執行一次'); });
    function cell(k) { var n = +k.slice(1), v = p.s[n] ? 1 : 0; return '<td class="' + (ran[n] ? 'on' : off[n] ? 'off1' : '') + '">' + v + (ran[n] ? '●' : '') + '</td>'; }
    var row = '<tr><td>' + p.scans + '</td><td>' + (p.x[0] ? 1 : 0) + '</td><td>' + (p.t[0] || 0) + (p.ton[0] ? '✓' : '') + '</td>' + cell('S0') + cell('S20') + cell('S21') + cell('S22') +
      ['0', '1', '2'].map(function (k) { return '<td class="' + (p.y[k] ? 'y1' : '') + '">' + (p.y[k] ? 1 : 0) + '</td>'; }).join('') + '<td style="text-align:left">' + note.join('；') + '</td></tr>';
    var t = $('stab'); if (!t.innerHTML) t.innerHTML = sHead();
    t.insertAdjacentHTML('beforeend', row);
    var rows = t.querySelectorAll('tr'); if (rows.length > 41) rows[1].remove();
    sVerdict(r);
  }
  function sVerdict(r) {
    var p = r.p, prog = $('sprog').value, h = r.hist, act = p.active().join(',');
    if (prog === 'ok' && act === '22') say('ssay', '✔ 正常：每一步都停滿 3 個掃描。往上看表格，換步那一圈兩步都標了 ●（同時作用），下一圈前一步斷電執行一次，它的 Y 才變 0。', 'ok');
    else if (prog === 'fwd' && act === '22') {
      var s21 = h.filter(function (o) { return o.S21; }).length;
      say('ssay', '✖ S21 本來要停 0.3 秒（3 個掃描），結果' + (s21 ? '只停了 ' + s21 + ' 個掃描' : '連一個掃描都沒停住：同一圈進了 S21 又跳到 S22') + '。換步那一圈 T0 線圈沒斷、現在值沒歸零，S21 一進來 T0 已經數完。看表格裡 S20、S21 在同一圈都標了 ●。', 'bad');
    } else if (prog === 'e12' && p.scans > 8 && act === '20' && p.y[0] && p.y[1]) say('ssay', '✖ 卡住了：每一圈 S20 數完 T0 → 換 S21 → S21 看到 T0 還是 ON → 又跳回 S20，T0 線圈從來沒斷過、永遠不歸零。Y0、Y1 一直同時亮，燈不會輪流。', 'bad');
  }
  $('sstep').onclick = function () { RS.step(); };
  $('sstep5').onclick = function () { for (var i = 0; i < 5; i++) RS.step(); };
  $('sx0').onclick = function () { RS.pulse('0', 1); RS.step(); };
  $('sreset').onclick = function () { RS.reset(); };
  $('sprog').onchange = function () { RS.reset(); };

  /* ================= 3. 並行與合流 ================= */
  var IL_PAR = 'LD M8002\nSET S0\nSTL S0\nLD X0\nSET S20\nSET S30\nSTL S20\nOUT Y0\nOUT T0 K15\nLD T0\nSET S21\nSTL S21\nOUT Y1\nOUT T1 K10\nLD T1\nSET S22\nSTL S30\nOUT Y2\nOUT T2 K40\nLD T2\nSET S31\nSTL S22\nSTL S31\nSET S40\nSTL S40\nOUT Y3\nOUT T3 K10\nLD T3\nOUT S0\nRET';
  function parLayout() {
    return { w: 340, h: 345,
      steps: [{ s: 'S0', x: 160, y: 25, init: true }, { s: 'S20', x: 80, y: 105, lab: 'A 下降', lab2: 1 }, { s: 'S21', x: 80, y: 165, lab: 'A 夾取', lab2: 1 }, { s: 'S22', x: 80, y: 225, lab: '等待', lab2: 1 },
        { s: 'S30', x: 240, y: 105, lab: 'B 移動' }, { s: 'S31', x: 240, y: 225, lab: '等待' }, { s: 'S40', x: 160, y: 290, lab: '放行' }],
      links: [[160, 38, 160, 72], [80, 76, 80, 92], [240, 76, 240, 92], [80, 118, 80, 152], [80, 178, 80, 212], [240, 118, 240, 212], [80, 238, 80, 256], [240, 238, 240, 256], [160, 260, 160, 277], [160, 303, 160, 312]],
      dbl: [[60, 260, 72], [60, 260, 256]], trs: [{ x: 160, y: 60, lab: 'X0' }, { x: 80, y: 135, lab: 'T0' }, { x: 80, y: 195, lab: 'T1' }, { x: 240, y: 165, lab: 'T2' }, { x: 160, y: 270, lab: '' }, { x: 160, y: 310, lab: 'T3' }],
      jumps: [{ x: 160, y: 312, to: 'S0' }] };
  }
  var RP = new Runner({
    il: function () { return IL_PAR; }, names: { S0: '待機', S20: 'A 下降', S21: 'A 夾取', S30: 'B 移動', S40: '放行', X0: '啟動' },
    layout: parLayout, rows: [['S20', 'S20'], ['S21', 'S21'], ['S22', 'S22'], ['S30', 'S30'], ['S31', 'S31'], ['S40', 'S40'], ['Y0', 'Y0'], ['Y2', 'Y2'], ['Y3', 'Y3']],
    ins: [['0', 'X0 啟動']], outs: [['0', 'Y0 A 下降'], ['1', 'Y1 A 夾取'], ['2', 'Y2 B 移動'], ['3', 'Y3 放行']],
    sfcId: 'psfc', ladId: 'plad', tlId: 'ptl', ioId: 'pio', scanId: 'pscan', timeId: 'ptime', logId: 'plog', sayId: 'psay', runBtn: 'prun',
    onScan: function (r, b, a) {
      if (b === a) return;
      if (a === '20,30') say('psay', 'SET S20、SET S30：兩條流程同時開始，SFC 上兩格一起亮。');
      else if (a === '22,30') say('psay', 'A 邊做完，停在等待步 S22。合流那一段（STL S22、STL S31）要兩步都作用才執行，現在 S31 還沒到，只能等 B。');
      else if (a === '40') say('psay', '✔ B 也到了 S31：STL S22、STL S31 都成立，SET S40，換步時 S22、S31 一起關掉。這就是並行合流。', 'ok');
    }
  });
  $('prun').onclick = function () { RP.run(); }; $('pstep').onclick = function () { RP.stop(); RP.step(); }; $('preset').onclick = function () { RP.reset(); };

  /* ================= 4. 停電與 M8002 ================= */
  function ilPower() {
    var n = +$('wn').value, a = n, b = n + 1, c = n + 2, head;
    if ($('wm').value === 'bad') head = 'LD M8002\nSET S0';
    else if ($('wm').value === 'ani') head = 'LD M8002\nANI S' + a + '\nANI S' + b + '\nANI S' + c + '\nSET S0';
    else head = 'LD M8002\nZRST S0 S127\nSET S0';
    return head + '\nSTL S0\nLD X0\nSET S' + a + '\nSTL S' + a + '\nOUT Y0\nLD X1\nSET S' + b + '\nSTL S' + b + '\nOUT Y1\nLD X2\nSET S' + c + '\nSTL S' + c + '\nOUT Y2\nLD X3\nOUT S0\nRET';
  }
  var RW = new Runner({
    il: ilPower,
    layout: function () { var n = +$('wn').value; return linLayout(['S0', 'S' + n, 'S' + (n + 1), 'S' + (n + 2)], ['待機', 'OUT Y0', 'OUT Y1', 'OUT Y2'], ['X0', 'X1', 'X2', 'X3']); },
    rows: [], ins: [['0', 'X0'], ['1', 'X1'], ['2', 'X2'], ['3', 'X3']], outs: [['0', 'Y0'], ['1', 'Y1'], ['2', 'Y2']],
    sfcId: 'wsfc', ladId: 'wlad', ioId: 'wio', scanId: 'wscan', logId: 'wlog', sayId: 'wsay', runBtn: 'wrun'
  });
  function wPower() {
    var before = RW.p.active();
    RW.stop(); RW.p.powerCycle(); RW.press = {};
    var kept = RW.p.active();
    log('wlog', '⚡ 停電。停電前作用的步：' + (before.length ? 'S' + before.join('、S') : '無') + '；FX3S 保持 S0～S127，復電時還在：' + (kept.length ? 'S' + kept.join('、S') : '無'));
    RW.step();
    var now = RW.p.active();
    log('wlog', '復電第一圈（M8002 ON）之後作用的步：' + (now.length ? 'S' + now.join('、S') : '無'));
    if (now.length > 1) say('wsay', '✖ 兩步同時作用：S' + now.join('、S') + '。停電前的步保持住了，M8002 又 SET S0。之後兩條都會動，機器亂掉。', 'bad');
    else if ($('wm').value === 'zrst') say('wsay', '✔ 從頭來：M8002 那一圈 ZRST 清掉所有步，再 SET S0，只剩待機。', 'ok');
    else if (+$('wn').value === 140 && before.some(function (k) { return k >= 128; })) say('wsay', 'S140 這些步不保持，停電後就沒了，M8002 SET S0 回到待機。停電前做到哪裡記不住。', '');
    else if (now.length === 1 && before.join() === now.join()) say('wsay', '✔ 接著做：保持住的步復電後繼續作用，M8002 那一圈因為有步在作用，沒有 SET S0。', 'ok');
    else say('wsay', '復電後作用的步：S' + now.join('、S'));
    return now;
  }
  $('wrun').onclick = function () { RW.run(); }; $('wpow').onclick = wPower; $('wreset').onclick = function () { RW.reset(); };
  $('wm').onchange = $('wn').onchange = function () { RW.reset(); };

  /* ================= 分頁 ================= */
  var tabs = $('tabs'), RUN = { flow: RF, scan: RS, par: RP, pwr: RW };
  function stopAll() { Object.keys(RUN).forEach(function (k) { RUN[k].stop(); }); }
  function show(t) {
    stopAll();
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    Object.keys(RUN).forEach(function (k) { $('t-' + k).hidden = k !== t; });
    RUN[t].draw();
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  if (/^#(flow|scan|par|pwr)$/.test(location.hash)) show(location.hash.slice(1));

  /* 測試用：跑 n 個掃描，按鍵用 {掃描號: 'X0'} 表示（按一掃描） */
  function runSync(il, n, presses) {
    var p = new PLC(il), out = [];
    for (var i = 0; i < n; i++) { p.x = {}; if (presses && presses[i]) presses[i].split(',').forEach(function (x) { p.x[x.slice(1)] = 1; }); p.scan(); out.push({ act: p.active().join(','), y: [0, 1, 2, 3].map(function (k) { return p.y[k] ? 1 : 0; }).join('') }); }
    return { p: p, trace: out };
  }
  window.StlLab = { PLC: PLC, parse: parse, runSync: runSync, IL_FLOW: IL_FLOW, IL_SCAN: IL_SCAN, IL_PAR: IL_PAR, ilPower: ilPower, RF: RF, RS: RS, RP: RP, RW: RW, wPower: wPower, show: show, stopAll: stopAll };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function q(o) { var seen = {}; seen[o.ans] = 1; o.wrong = o.wrong.filter(function (w) { if (seen[w]) return false; seen[w] = 1; return true; }); return o; }
  var KIND = [
    function () { return q({ q: 'S20 換到 S21 的那一個掃描，S20 和 S21 的狀態是？', ans: '兩步同時作用一個掃描', wrong: ['S20 先關，下一圈 S21 才開', '兩步都不作用一個掃描', 'S21 要等 S20 的輸出全部 OFF 才開', '看程式裡誰寫在前面'], ex: '換步的那一圈，前後兩步會同時作用，所以不能同時 ON 的輸出要加互鎖。' }); },
    function () { var w = p1([['OUT Y1', '自動 OFF'], ['SET Y1', '保持 ON，要 RST 才關']]); return q({ q: '步裡寫 <b>' + w[0] + '</b>，離開這一步之後 Y1 會？', ans: w[1], wrong: ['自動 OFF', '保持 ON，要 RST 才關', '閃一下再 OFF', '要等 RET 才 OFF'], ex: '離開步時，步裡 OUT 的輸出自動 OFF；SET 的會保持，要在別的地方 RST。' }); },
    function () { return q({ q: '相鄰的 S21、S22 都寫 OUT T0，可能發生什麼事？', ans: '換步時 T0 沒歸零，下一步一進來可能立刻換步（或卡住）', wrong: ['完全沒問題', 'T0 會自動分成兩個計時器', 'PLC 會自動把 T0 改成 T1', '程式寫不進去'], ex: '轉移那一圈計時器線圈不會斷，現在值不歸零。相鄰步要用不同的計時器。' }); },
    function () { return q({ q: 'S21 和 S23 中間隔著 S22（不相鄰），兩步都用 T0，可以嗎？', ans: '可以，不相鄰的步可以共用', wrong: ['不行，整個程式 T0 只能出現一次', '不行，一定會卡住', '只能在並行分支裡共用', '要改用 OUT T0 K0'], ex: '問題只出在相鄰步的轉移那一圈；中間隔一步，T0 在進下一個用它的步之前已經歸零。' }); },
    function () { return q({ q: '下面哪一個<b>不能</b>當 STL 後面的第一個指令？', ans: 'MPS', wrong: ['LD', 'SET', 'OUT', 'LDI'], ex: '手冊規定 STL 後第一個指令不能是 MPS。' }); },
    function () { return q({ q: '步進區寫完，回到一般階梯之前一定要寫？', ans: 'RET', wrong: ['END', 'MCR', 'STL S0', 'RST S0'], ex: 'RET 告訴 PLC 步進區結束；沒有 RET 程式寫不進去。RET 後面的一般階梯每圈都算，急停、互鎖寫在這裡。' }); },
    function () { return q({ q: '並行分支的兩條流程分別停在 S22、S31，要兩邊都到才往下。三菱 FX 的指令表怎麼寫？', ans: 'STL S22、STL S31 連續寫，接著寫轉移', wrong: ['LD S22、AND S31、SET S40', 'STL S22 底下 SET S40，STL S31 底下也 SET S40', 'MPS 分兩條再 ANB', 'OUT S22、OUT S31'], ex: '連續兩個 STL 中間不夾指令，就是並行合流：兩步都作用才執行，離開時一起關。' }); },
    function () { return q({ q: '並行分支：A 邊 2 秒做完、B 邊 5 秒做完，合流後的步什麼時候開始？', ans: '約 5 秒後（兩邊都到）', wrong: ['約 2 秒後（先到的那邊）', '約 7 秒後（兩邊加起來）', '一開始就開始', '看哪一邊寫在程式前面'], ex: '合流要兩條都到等待步才成立，先到的那邊在等待步等。' }); },
    function () { return q({ q: 'FX3S 的狀態元件 S，停電保持的範圍是？', ans: 'S0～S127', wrong: ['S0～S9', 'S500～S899', 'S128～S255', '全部都不保持'], ex: 'FX3S：S0～S127 停電保持（S0～S9 是初始步），S128～S255 一般。S500～S899 是 FX3U 檢定題常用的範圍，不能照抄到 FX3S。' }); },
    function () { var s = p1(['S21', 'S22', 'S25']); return q({ q: 'FX3S 程式開頭只寫 LD M8002 → SET S0。停電前停在 ' + s + '，復電後作用的步是？', ans: 'S0 和 ' + s + ' 兩步同時作用', wrong: ['只有 S0', '只有 ' + s, '沒有任何步', '從 S20 重新開始'], ex: s + ' 在停電保持範圍，復電後還在；M8002 又 SET S0，兩步同時作用。' }); },
    function () { return q({ q: '要「復電後從頭來」，開機那一圈比較好的寫法是？', ans: 'M8002 先 ZRST 清掉所有步，再 SET S0', wrong: ['M8002 SET S0 就好', 'M8002 RST S0', '什麼都不寫', 'M8002 SET S20'], ex: '先清步再進初始步，就不會和保持住的步同時作用。要接著做，則在 SET S0 前面加「沒有步在作用」的條件。' }); },
    function () { return q({ q: '往回跳（例如最後一步回 S0），要和 GX Works2 的 SFC 轉出來的寫法一致，用？', ans: 'OUT S0', wrong: ['SET S0', 'RST S0', 'STL S0', 'JMP S0'], ex: '往下一步用 SET S，往回跳、跳步用 OUT S，GX Works2 把 SFC 的跳躍轉成指令表就是 OUT S。SET S0 在 FX 上也會動，但和 SFC 不一致。' }); },
    function () { return q({ q: '急停寫在步進區的某一步裡，會有什麼問題？', ans: '只有那一步作用時急停才有效', wrong: ['沒有問題，任何時候都有效', '程式寫不進去', '急停會讓所有步同時作用', '急停只在 M8002 那一圈有效'], ex: '不作用的步整段不執行。急停、互鎖要寫在 RET 後面的一般階梯，每圈都算。' }); },
    function () { return q({ q: '一個並行或選擇分支，最多可以分幾條？', ans: '8 條', wrong: ['2 條', '4 條', '16 條', '沒有限制'], ex: '並行或選擇分支最多 8 條，一個初始步底下的分支合計不超過 16 條（手冊 35.1.10 節）。' }); },
    function () { return q({ q: '開機時要進入初始步 S0，通常怎麼寫？', ans: 'LD M8002 → SET S0', wrong: ['LD M8000 → SET S0', 'STL S0 寫在最前面就會自己作用', 'LD X0 → OUT S0', '不用寫，S0 開機自動作用'], ex: 'M8002 是 RUN 後第一圈 ON，用它 SET 初始步。沒寫的話開機沒有任何步作用，機器永遠不會動。' }); }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) window.StlLab.quiz = window.LabQuiz('squiz', gen);
  window.StlLab.quizGen = gen; window.StlLab.quizKinds = KIND;
})();
