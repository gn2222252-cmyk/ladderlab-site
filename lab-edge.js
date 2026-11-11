/* 上升緣與下降緣實驗室：LDP／LDF／ANDP／ORP、PLS／PLF、ALT／ALTP、INC／INCP
   迷你 PLC 照本站 engine/plc_engine.py 的規則：每個邊緣接點、每個 PLS／PLF、每個脈衝型指令都在「自己那一行」記住上一次看到的值。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* ================= 迷你 PLC ================= */
  var CONTACT = { LD: 1, LDI: 1, AND: 1, ANI: 1, OR: 1, ORI: 1, LDP: 1, LDF: 1, ANDP: 1, ANDF: 1, ORP: 1, ORF: 1 };
  function parse(il) { return il.trim().split('\n').map(function (l) { var p = l.trim().split(/\s+/); return { op: p[0], a: p.slice(1) }; }); }
  /* 手冊的運算元限制（FX3S 程式手冊）：PLS／PLF 只能 Y、M，特殊 M（M8000 起）不行；ALT 只能 Y、M、S；邊緣接點 X、Y、M、S、T、C */
  function validate(il) {
    var err = [];
    parse(il).forEach(function (c, i) {
      var d = c.a[0] || '', k = d.charAt(0), n = +d.slice(1);
      if (c.op === 'PLS' || c.op === 'PLF') { if (k !== 'Y' && k !== 'M') err.push('第 ' + (i + 1) + ' 行：' + c.op + ' 只能接 Y、M'); else if (k === 'M' && n >= 8000) err.push('第 ' + (i + 1) + ' 行：' + c.op + ' 不能用特殊 M（' + d + '）'); }
      if ((c.op === 'ALT' || c.op === 'ALTP') && 'YMS'.indexOf(k) < 0) err.push('第 ' + (i + 1) + ' 行：' + c.op + ' 只能接 Y、M、S');
      if (/^(LD|AND|OR)[PF]$/.test(c.op) && 'XYMSTC'.indexOf(k) < 0) err.push('第 ' + (i + 1) + ' 行：' + c.op + ' 不能接 ' + d);
    });
    return err;
  }
  function PLC(il) { this.code = parse(il); this.v = {}; this.edge = []; this.pulse = []; this.scans = 0; this.trace = []; }
  PLC.prototype.get = function (d) { return this.v[d] ? 1 : 0; };
  PLC.prototype.scan = function (x) {
    var me = this, acc = 0, fresh = true, stack = [], tr = [];
    Object.keys(x || {}).forEach(function (k) { me.v[k] = x[k] ? 1 : 0; });
    function load(v) { if (!fresh) stack.push(acc); acc = v; fresh = false; }
    this.code.forEach(function (c, i) {
      var op = c.op, d = c.a[0], v, e;
      if (CONTACT[op]) {
        var base = op.replace(/[IPF]$/, ''), mode = op.slice(base.length);
        if (op === 'LDI' || op === 'ANI' || op === 'ORI') { base = { LDI: 'LD', ANI: 'AND', ORI: 'OR' }[op]; v = me.get(d) ? 0 : 1; }
        else if (mode === 'P' || mode === 'F') { var now = me.get(d), before = me.edge[i] || 0; me.edge[i] = now; v = mode === 'P' ? (now && !before ? 1 : 0) : (before && !now ? 1 : 0); }
        else v = me.get(d);
        if (base === 'LD') load(v); else if (base === 'AND') acc = acc & v; else acc = acc | v;
        tr[i] = { v: v };
        return;
      }
      if (op === 'ORB') { acc = stack.pop() | acc; tr[i] = {}; return; }
      if (op === 'ANB') { acc = stack.pop() & acc; tr[i] = {}; return; }
      var p = acc;
      if (op === 'OUT') me.v[d] = acc;
      else if (op === 'SET') { if (acc) me.v[d] = 1; }
      else if (op === 'RST') { if (acc) me.v[d] = 0; }
      else if (op === 'PLS' || op === 'PLF') { var b = me.pulse[i] || 0; me.pulse[i] = acc; me.v[d] = op === 'PLS' ? (acc && !b ? 1 : 0) : (b && !acc ? 1 : 0); p = me.v[d]; }
      else if (op === 'ALT' || op === 'INC' || op === 'DEC') { if (acc) e = 1; }
      else if (op === 'ALTP' || op === 'INCP' || op === 'DECP') { var b2 = me.pulse[i] || 0; me.pulse[i] = acc; if (acc && !b2) e = 1; p = e ? 1 : 0; }
      if (e) {
        var base2 = op.replace(/P$/, '');
        if (base2 === 'ALT') me.v[d] = me.get(d) ? 0 : 1;
        else me.v[d] = (me.v[d] || 0) + (base2 === 'INC' ? 1 : -1);
      }
      tr[i] = { p: p ? 1 : 0 };
      fresh = true;
    });
    this.trace = tr; this.scans++;
    return this;
  };
  /* 跑一串掃描：xs = 每一圈 X0 的值陣列，watch = 要記錄的元件 */
  function runSeq(il, xs, watch) {
    var p = new PLC(il), rows = [];
    xs.forEach(function (x) { p.scan({ X0: x }); var r = { X0: x }; watch.forEach(function (w) { r[w] = p.v[w] || 0; }); rows.push(r); });
    return { p: p, rows: rows };
  }
  function seq(onScans, offBefore, offAfter) { var a = [], i; for (i = 0; i < (offBefore || 0); i++) a.push(0); for (i = 0; i < onScans; i++) a.push(1); for (i = 0; i < (offAfter || 0); i++) a.push(0); return a; }

  /* ================= 共用畫圖 ================= */
  function ladderHTML(p, cur, names) {
    var h = '', rung = null, n = 0;
    function nm(d) { return names && names[d] ? d + ' ' + names[d] : d; }
    p.code.forEach(function (c, i) {
      var t = p.trace[i] || {};
      if (/^LD/.test(c.op)) { if (rung) h += rung + '</div>'; n++; rung = '<div class="rung' + (cur === n ? ' cur' : '') + '"><span class="no">' + n + '</span>'; }
      if (CONTACT[c.op]) {
        var sym = /I$/.test(c.op) ? '┤/' : /P$/.test(c.op) ? '┤↑' : /F$/.test(c.op) ? '┤↓' : '┤';
        rung += (/^(OR)/.test(c.op) ? '<span class="wr">∥</span>' : '<span class="wr">─</span>') + '<span class="ct' + (t.v ? ' on' : '') + '">' + sym + nm(c.a[0]) + '├</span>';
      } else if (c.op === 'ORB' || c.op === 'ANB') rung += '<span class="wr">' + c.op + '</span>';
      else rung += '<span class="wr">─</span><span class="cl' + (t.p ? ' on' : '') + '">( ' + esc(c.op === 'OUT' ? nm(c.a[0]) : c.op + ' ' + c.a.join(' ')) + ' )</span>';
    });
    if (rung) h += rung + '</div>';
    return h;
  }
  /* rows：每圈一筆；lanes：[[key, 標籤, 顏色]] */
  function timeline(svg, rows, lanes, N) {
    N = N || 24;
    var lw = 78, W = 440, rh = 22, H = lanes.length * rh + 18, cw = (W - lw - 4) / N, start = Math.max(0, rows.length - N), h = '';
    for (var c = 0; c <= N; c++) h += '<line x1="' + (lw + c * cw) + '" y1="2" x2="' + (lw + c * cw) + '" y2="' + (H - 14) + '" stroke="var(--line)" stroke-width="1"/>';
    lanes.forEach(function (ln, r) {
      var y = 4 + r * rh;
      h += '<text x="2" y="' + (y + 14) + '">' + esc(ln[1]) + '</text>';
      for (var i = start; i < rows.length; i++) if (rows[i][ln[0]]) h += '<rect x="' + (lw + (i - start) * cw + 1) + '" y="' + (y + 3) + '" width="' + (cw - 2) + '" height="14" rx="2" fill="' + ln[2] + '"/>';
    });
    h += '<text x="' + lw + '" y="' + (H - 2) + '">← 舊</text><text x="' + (W - 2) + '" y="' + (H - 2) + '" text-anchor="end">這一圈 →</text>';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.innerHTML = h;
  }
  /* 按住按鈕：滑鼠、觸控都可以 */
  function holdBtn(b, set) {
    function on(e) { e.preventDefault(); set(true); b.classList.add('on'); }
    function off() { set(false); b.classList.remove('on'); }
    b.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { b.addEventListener(t, off); });
    b.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); set(true); b.classList.add('on'); } });
    b.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') off(); });
  }

  /* ================= ① 一圈一圈看 ================= */
  var IL_TL = 'LDP X0\nOUT M10\nLDF X0\nOUT M11\nLD X0\nPLS M0\nLD X0\nPLF M1\nLD X0\nOUT Y0';
  var LANES_TL = [['X0', 'X0', '#15803d'], ['M10', 'LDP→M10', '#c2410c'], ['M11', 'LDF→M11', '#7c3aed'], ['M0', 'PLS M0', '#c2410c'], ['M1', 'PLF M1', '#7c3aed'], ['Y0', 'OUT Y0', '#0e7490']];
  var TL = { p: null, rows: [], x0: false, gen: 0, timer: null };
  function tlReset() { tlStop(); TL.p = new PLC(IL_TL); TL.rows = []; $('tn').textContent = 0; say('tsay', '按住 X0 或勾「一直按著」，再按「下一圈」。'); tlDraw(); }
  function tlStop() { TL.gen++; if (TL.timer) { clearInterval(TL.timer); TL.timer = null; } $('trun').textContent = '▶ 自動跑'; }
  function tlX() { return TL.x0 || $('tlatch').checked ? 1 : 0; }
  function tlStep(x) {
    var p = TL.p, v = x == null ? tlX() : x, prev = TL.rows.length ? TL.rows[TL.rows.length - 1].X0 : 0;
    p.scan({ X0: v });
    var r = { X0: v }; ['M10', 'M11', 'M0', 'M1', 'Y0'].forEach(function (k) { r[k] = p.v[k] || 0; }); TL.rows.push(r); if (TL.rows.length > 200) TL.rows.shift();
    $('tn').textContent = p.scans;
    if (v && !prev) say('tsay', '第 ' + p.scans + ' 圈：X0 剛變 ON（上升緣）。LDP 接點和 PLS M0 這一圈 ON。', 'ok');
    else if (v && prev) say('tsay', '第 ' + p.scans + ' 圈：X0 還按著，但已經不是「剛變 ON」了，LDP、PLS 都回到 OFF；只有 OUT Y0 還亮。');
    else if (!v && prev) say('tsay', '第 ' + p.scans + ' 圈：X0 剛放開（下降緣）。LDF 接點和 PLF M1 這一圈 ON。', 'ok');
    else say('tsay', '第 ' + p.scans + ' 圈：X0 一直是 OFF，沒有邊緣，全部 OFF。');
    tlDraw();
    return r;
  }
  function tlDraw() { $('tlad').innerHTML = ladderHTML(TL.p, null, { M10: '', M11: '' }); timeline($('tsvg'), TL.rows, LANES_TL); }
  holdBtn($('tx0'), function (v) { TL.x0 = v; });
  $('tstep').onclick = function () { tlStop(); tlStep(); };
  $('trun').onclick = function () { if (TL.timer) { tlStop(); return; } var g = ++TL.gen; TL.timer = setInterval(function () { if (g === TL.gen) tlStep(); }, 350); $('trun').textContent = '⏸ 暫停'; };
  $('treset').onclick = tlReset;
  tlReset();

  /* ================= ② 常見的坑 ================= */
  var A = { d0: 0, d1: 0, gen: 0, timer: null, p: null };
  function aRun(scans) {
    aStop();
    var p = A.p || (A.p = new PLC('LD X0\nINC D0\nLDP X0\nINC D1')), g = A.gen, k = 0, total = scans + 1;
    function tick() {
      if (g !== A.gen) return;
      for (var j = 0; j < 5 && k < total; j++, k++) p.scan({ X0: k < scans ? 1 : 0 });
      $('ad0').textContent = p.v.D0 || 0; $('ad1').textContent = p.v.D1 || 0;
      if (k < total) A.timer = setTimeout(tick, 16);
      else { A.timer = null; say('asay', '按住 ' + scans + ' 圈：LD X0 那行每一圈都 INC，加了 ' + scans + '；LDP 那行只在第一圈加 1。計數、換模式、步序加一，一定要用上升緣（LDP、PLS，或 INCP）。', 'ok'); }
    }
    tick();
  }
  function aStop() { A.gen++; if (A.timer) { clearTimeout(A.timer); A.timer = null; } }
  $('ainc').onclick = function () { aRun(100); };
  $('ainc2').onclick = function () { aRun(5); };
  $('aincr').onclick = function () { aStop(); A.p = null; $('ad0').textContent = 0; $('ad1').textContent = 0; say('asay', ''); };

  var AL = { p: null, rows: [], c0: 0, c1: 0 };
  function alReset() { AL.p = new PLC('LD X0\nALT Y0\nLD X0\nALTP Y1'); AL.rows = []; AL.c0 = AL.c1 = 0; alDraw(); say('alsay', ''); }
  function alDraw() {
    $('aly0').classList.toggle('on', !!AL.p.v.Y0); $('aly1').classList.toggle('on', !!AL.p.v.Y1);
    $('alc0').textContent = AL.c0; $('alc1').textContent = AL.c1;
    timeline($('altsvg'), AL.rows, [['X0', 'X0', '#15803d'], ['Y0', 'ALT Y0', '#c2410c'], ['Y1', 'ALTP Y1', '#0e7490']], 40);
  }
  function alPress(n) {
    var xs = [0].concat(seq(n, 0, 3));
    xs.forEach(function (x) { var b0 = AL.p.v.Y0 || 0, b1 = AL.p.v.Y1 || 0; AL.p.scan({ X0: x }); if ((AL.p.v.Y0 || 0) !== b0) AL.c0++; if ((AL.p.v.Y1 || 0) !== b1) AL.c1++; AL.rows.push({ X0: x, Y0: AL.p.v.Y0 || 0, Y1: AL.p.v.Y1 || 0 }); });
    if (AL.rows.length > 200) AL.rows.splice(0, AL.rows.length - 200);
    alDraw();
    say('alsay', '按住 ' + n + ' 圈：ALT Y0 反轉了 ' + n + ' 次，放開時停在 ' + (AL.p.v.Y0 ? 'ON' : 'OFF') + '（' + n + ' 是' + (n % 2 ? '奇' : '偶') + '數）。ALTP Y1 只在按下那一圈反轉一次。真實按鈕按多久每次都不一樣，ALT 的結果等於隨機。', n % 2 ? '' : 'bad');
  }
  $('altgo').onclick = function () { alPress(+$('altn').value); };
  $('altr').onclick = alReset;
  alReset();

  var PLSIL = { below: 'LD X0\nPLS M0\nLD M0\nINC D0', above: 'LD M0\nINC D0\nLD X0\nPLS M0' };
  function plsRun() {
    var il = PLSIL[$('plsord').value], r = runSeq(il, [0, 1, 1, 1, 0, 0], ['M0', 'D0']), rows = r.rows;
    $('plsil').textContent = il;
    var h = '<tr><th>圈</th>' + rows.map(function (x, i) { return '<th>' + (i + 1) + '</th>'; }).join('') + '</tr>';
    h += '<tr><th>X0</th>' + rows.map(function (x) { return '<td class="' + (x.X0 ? 'on' : '') + '">' + x.X0 + '</td>'; }).join('') + '</tr>';
    h += '<tr><th>M0</th>' + rows.map(function (x) { return '<td class="' + (x.M0 ? 'on' : '') + '">' + x.M0 + '</td>'; }).join('') + '</tr>';
    h += '<tr><th>D0</th>' + rows.map(function (x, i) { return '<td class="' + (i && x.D0 !== rows[i - 1].D0 ? 'on' : '') + '">' + x.D0 + '</td>'; }).join('') + '</tr>';
    $('plstab').innerHTML = h;
    var at = rows.map(function (x) { return x.D0; }).indexOf(1) + 1;
    say('plssay', $('plsord').value === 'below' ? '✔ X0 第 2 圈按下，D0 在第 ' + at + ' 圈就加 1：INC 那行在 PLS 下面，當圈就讀得到 M0。' : 'X0 第 2 圈按下，D0 到第 ' + at + ' 圈才加 1：讀 M0 的行在 PLS 上面，第 2 圈讀到的是上一圈的 0，下一圈才讀到 1。表上的 M0 是每圈結束時的值。', $('plsord').value === 'below' ? 'ok' : '');
    return rows;
  }
  $('plsgo').onclick = plsRun; $('plsord').onchange = plsRun;
  plsRun();

  /* ================= ③ 一個按鈕啟動／停止 ================= */
  var PR = {
    altp: { name: '✔ ALTP（一行）', il: 'LD X0\nALTP Y0' },
    pls: { name: '✔ PLS ＋ 自保持', il: 'LD X0\nPLS M0\nLD M0\nANI Y0\nLD Y0\nANI M0\nORB\nOUT Y0' },
    ldpalt: { name: '✔ LDP ＋ ALT', il: 'LDP X0\nALT Y0' },
    ldp: { name: '✔ LDP 邊緣接點 ＋ 自保持', il: 'LDP X0\nOUT M0\nLD M0\nANI Y0\nLD Y0\nANI M0\nORB\nOUT Y0' },
    bad: { name: '✖ 直接用 LD X0（沒有上升緣）', il: 'LD X0\nANI Y0\nLD Y0\nANI X0\nORB\nOUT Y0' }
  };
  var P = { p: null, rows: [], n: 0 };
  Object.keys(PR).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = PR[k].name; $('psel').appendChild(o); });
  function pReset() { var k = $('psel').value; P.p = new PLC(PR[k].il); P.rows = []; P.n = 0; $('pil').textContent = PR[k].il; P.p.scan({ X0: 0 }); pDraw(); say('psay', ''); }
  function pDraw() { $('py0').classList.toggle('on', !!P.p.v.Y0); $('pcnt').textContent = P.n; $('plad').innerHTML = ladderHTML(P.p); timeline($('psvg'), P.rows, [['X0', 'X0', '#15803d'], ['M0', 'M0', '#c2410c'], ['Y0', 'Y0', '#0e7490']], 48); }
  function pPress(hold) {
    hold = hold || 20; P.n++;
    var flips = 0;
    seq(hold, 0, 4).forEach(function (x) { var b = P.p.v.Y0 || 0; P.p.scan({ X0: x }); if ((P.p.v.Y0 || 0) !== b) flips++; P.rows.push({ X0: x, M0: P.p.v.M0 || 0, Y0: P.p.v.Y0 || 0 }); });
    if (P.rows.length > 300) P.rows.splice(0, P.rows.length - 300);
    pDraw();
    var bad = $('psel').value === 'bad';
    say('psay', bad ? '✖ 按住的 ' + hold + ' 圈裡，Y0 一直在切換（反轉了 ' + flips + ' 次），放開時停在 ' + (P.p.v.Y0 ? 'ON' : 'OFF') + '，每次按的時間一不同結果就不同。' : '第 ' + P.n + ' 次按：Y0 變成 ' + (P.p.v.Y0 ? 'ON（啟動）' : 'OFF（停止）') + '，整個按住期間只切換了 ' + flips + ' 次。', bad ? 'bad' : 'ok');
    return { y0: P.p.v.Y0 || 0, flips: flips };
  }
  $('psel').onchange = pReset; $('preset').onclick = pReset; $('pgo').onclick = function () { pPress(20); };
  pReset();

  /* ================= verify：用迷你 PLC 重算手冊／本站指令手冊的例子 ================= */
  function verify() {
    var probs = [], ok = function (c, s) { if (!c) probs.push(s); };
    var r;
    // 指令手冊 PLS：按住 50 圈只加 1，放開再按加到 2
    r = runSeq('LD X0\nPLS M0\nLD M0\nINC D0', seq(50, 0, 5).concat(seq(3)), ['D0']); ok(r.p.v.D0 === 2, 'PLS 例子：D0 應為 2');
    // PLF：按住時不加，放開那一圈加
    r = runSeq('LD X0\nPLF M0\nLD M0\nINC D0', seq(20), ['D0']); ok((r.p.v.D0 || 0) === 0, 'PLF：按住時 D0 應不變');
    r = runSeq('LD X0\nPLF M0\nLD M0\nINC D0', seq(20, 0, 1), ['D0']); ok(r.p.v.D0 === 1, 'PLF：放開那一圈 D0 應加 1');
    // LDP／LDF
    r = runSeq('LDP X0\nINC D0\nLDF X0\nINC D1', seq(50), ['D0', 'D1']); ok(r.p.v.D0 === 1 && !(r.p.v.D1), 'LDP：按住只加 1、LDF 不加');
    r = runSeq('LDP X0\nINC D0\nLDF X0\nINC D1', seq(50, 0, 1), ['D0', 'D1']); ok(r.p.v.D1 === 1, 'LDF：放開那一圈加 1');
    // INCP 與 LD+INC
    r = runSeq('LD X0\nINCP D0\nLD X0\nINC D1', seq(30), ['D0', 'D1']); ok(r.p.v.D0 === 1 && r.p.v.D1 === 30, 'INCP 只加 1、INC 每圈加');
    // ALTP 按兩次回到 OFF；ALT 按住 n 圈反轉 n 次
    r = runSeq('LD X0\nALTP Y0', seq(10, 0, 3).concat(seq(10, 0, 3)), ['Y0']); ok(!(r.p.v.Y0), 'ALTP 按兩次應 OFF');
    r = runSeq('LD X0\nALT Y0', seq(7), ['Y0']); ok(r.p.v.Y0 === 1, 'ALT 按住 7 圈應停在 ON');
    // 脈衝只 ON 一個掃描
    r = runSeq(IL_TL, seq(6, 2, 4), ['M10', 'M11', 'M0', 'M1', 'Y0']);
    var cnt = function (k) { return r.rows.filter(function (x) { return x[k]; }).length; };
    ok(cnt('M10') === 1 && cnt('M0') === 1 && cnt('M11') === 1 && cnt('M1') === 1 && cnt('Y0') === 6, '時間軸：脈衝各 1 圈、OUT 6 圈');
    ok(r.rows[2].M10 && r.rows[2].M0 && r.rows[8].M11 && r.rows[8].M1, '時間軸：上升緣在按下那圈、下降緣在放開那圈');
    // PLS 位置：下面當圈、上面下一圈（和掃描實驗室第 11 題一致）
    var b = runSeq(PLSIL.below, [0, 1, 1, 0], ['D0']).rows, a = runSeq(PLSIL.above, [0, 1, 1, 0], ['D0']).rows;
    ok(b[1].D0 === 1 && a[1].D0 === 0 && a[2].D0 === 1, 'PLS 位置：下面當圈、上面慢一圈');
    // 一個按鈕啟動／停止：三種好寫法按 1 次 ON、2 次 OFF
    ['altp', 'ldpalt', 'pls', 'ldp'].forEach(function (k) {
      var x = seq(20, 1, 4), r1 = runSeq(PR[k].il, x, ['Y0']), r2 = runSeq(PR[k].il, x.concat(seq(20, 0, 4)), ['Y0']);
      ok(r1.p.v.Y0 === 1 && !(r2.p.v.Y0), PR[k].name + '：按 1 次應 ON、按 2 次應 OFF');
    });
    var rb = runSeq(PR.bad.il, seq(20, 1, 4), ['Y0']), fl = 0; rb.rows.forEach(function (x, i) { if (i && x.Y0 !== rb.rows[i - 1].Y0) fl++; });
    ok(fl > 2, '錯的寫法：按住時應該一直切換');
    // 運算元限制
    ok(validate('LD X0\nPLS M8000').length === 1, 'PLS M8000 應被擋');
    ok(validate('LD X0\nPLS X1').length === 1, 'PLS X1 應被擋');
    ok(validate('LD X0\nALTP S20').length === 0 && validate('LD X0\nALTP D0').length === 1, 'ALT 運算元 Y、M、S');
    ok(validate(IL_TL).length === 0 && Object.keys(PR).every(function (k) { return validate(PR[k].il).length === 0; }), '頁面上的程式都合法');
    // 猜一猜每一種都產生得出 4 個不同選項，答案不在錯誤選項裡
    QK.forEach(function (f, i) { for (var t = 0; t < 10; t++) { var q = f(), all = [q.ans].concat(q.wrong); ok(new Set(all).size >= 4 && q.wrong.indexOf(q.ans) < 0 && q.ex, '猜一猜第 ' + (i + 1) + ' 種選項不足或重複'); } });
    return { ok: !probs.length, problems: probs };
  }

  /* ================= ④ 猜一猜（答案用迷你 PLC 算） ================= */
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function r(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function dq(ans, wrong) { var s = {}; s[ans] = 1; return wrong.map(String).filter(function (w) { if (s[w]) return false; s[w] = 1; return true; }); }
  var QK = [
    function () { var n = r(5, 40), on = runSeq('LDP X0\nOUT M10', seq(n), ['M10']).rows.filter(function (x) { return x.M10; }).length; var a = on + ' 圈'; return { q: 'X0 連續按住 ' + n + ' 個掃描。<code>LDP X0 → OUT M10</code>，M10 一共 ON 幾圈？', ans: a, wrong: dq(a, [n + ' 圈', (n - 1) + ' 圈', '0 圈', '2 圈']), ex: 'LDP 只在 X0 從 OFF 變 ON 的那一圈導通，按住多久都只有 1 圈。' }; },
    function () { var n = r(3, 9), rows = runSeq('LD X0\nPLF M1', seq(n, 0, 3), ['M1']).rows, at = rows.map(function (x) { return x.M1; }).indexOf(1) + 1; var a = '第 ' + at + ' 圈（放開的那一圈）'; return { q: 'X0 在第 1～' + n + ' 圈按著，第 ' + (n + 1) + ' 圈放開。<code>LD X0 → PLF M1</code>，M1 在哪一圈 ON？', ans: a, wrong: dq(a, ['第 1 圈（按下的那一圈）', '第 ' + n + ' 圈（放開前最後一圈）', '第 1～' + n + ' 圈都 ON', '不會 ON']), ex: 'PLF 抓下降緣：條件從 ON 變 OFF 的那一圈 ON 一次。' }; },
    function () { var ms = p1([500, 1000, 2000]), n = ms / 10, d = runSeq('LD X0\nINC D0', seq(n), ['D0']).p.v.D0; var a = String(d); return { q: '本站模擬器一圈 10 ms。<code>LD X0 → INC D0</code>，X0 按住 ' + ms / 1000 + ' 秒，D0 從 0 變成多少？', ans: a, wrong: dq(a, ['1', String(ms / 1000), String(d * 10), String(d / 2)]), ex: '條件 ON 的每一圈都 INC：' + ms + ' ms ÷ 10 ms = ' + n + ' 圈，加了 ' + n + ' 次。要按一次加一，用 LDP、PLS 或 INCP。' }; },
    function () { var n = r(10, 80), d = runSeq('LDP X0\nINC D0', seq(n), ['D0']).p.v.D0; var a = String(d); return { q: '<code>LDP X0 → INC D0</code>，X0 按住 ' + n + ' 圈再放開，D0 從 0 變成多少？', ans: a, wrong: dq(a, [String(n), '0', '2', String(n - 1)]), ex: '上升緣只有按下那一圈，所以只加 1。' }; },
    function () { var n = p1([6, 7, 10, 11, 15]), y = runSeq('LD X0\nALT Y0', seq(n), ['Y0']).p.v.Y0; var a = y ? 'ON' : 'OFF'; return { q: 'Y0 原本 OFF。<code>LD X0 → ALT Y0</code>，X0 剛好按住 ' + n + ' 圈再放開，Y0 是？', ans: a, wrong: dq(a, ['ON', 'OFF', '一直閃，放開後也繼續閃', 'PLC 報錯']), ex: 'ALT 每執行一次反轉一次，按住 ' + n + ' 圈就反轉 ' + n + ' 次，' + (n % 2 ? '奇數次停在 ON' : '偶數次回到 OFF') + '。實際按多久不固定，所以要用 ALTP 或上升緣。' }; },
    function () { var k = r(1, 5), xs = []; for (var i = 0; i < k; i++) xs = xs.concat(seq(r(5, 30), 0, 3)); var y = runSeq('LD X0\nALTP Y0', xs, ['Y0']).p.v.Y0; var a = y ? 'ON' : 'OFF'; return { q: 'Y0 原本 OFF。<code>LD X0 → ALTP Y0</code>，X0 按了 ' + k + ' 次（每次按住的時間都不一樣），Y0 是？', ans: a, wrong: dq(a, ['ON', 'OFF', '看最後一次按多久', '一直閃']), ex: 'ALTP 只在上升緣反轉一次，按 ' + k + ' 次反轉 ' + k + ' 次：' + (k % 2 ? '奇數次 ON' : '偶數次 OFF') + '，跟按多久無關。' }; },
    function () { var bad = p1([['PLS M8000', '不行：特殊 M（M8000 起）不能當 PLS 的對象'], ['PLS X1', '不行：PLS 只能接 Y、M'], ['PLS M0', '可以'], ['PLF Y3', '可以']]); var a = bad[1]; return { q: '<code>LD X0 → ' + bad[0] + '</code> 這樣寫可以嗎？', ans: a, wrong: dq(a, ['可以', '不行：PLS 只能接 Y、M', '不行：特殊 M（M8000 起）不能當 PLS 的對象', '不行：PLS 只能接 X']), ex: 'FX3S 程式手冊：PLS、PLF 的對象是 Y、M，特殊 M 不能用。' }; },
    function () { var below = Math.random() < .5, rows = runSeq(below ? PLSIL.below : PLSIL.above, [0, 1, 1, 0], ['D0']).rows, a = rows[1].D0 ? '按下的那一圈' : '按下的下一圈'; return { q: '程式：' + (below ? '第 1 行 LD X0 → PLS M0，第 2 行 LD M0 → INC D0' : '第 1 行 LD M0 → INC D0，第 2 行 LD X0 → PLS M0') + '。D0 在哪一圈加 1？', ans: a, wrong: dq(a, ['按下的那一圈', '按下的下一圈', '放開的那一圈', '按住的每一圈都加']), ex: below ? 'INC 那行在 PLS 下面，同一圈就讀到剛寫的 M0。' : '讀 M0 的行在 PLS 上面：按下那一圈它先讀到上一圈的 0，下一圈才讀到 1。只加一次，但慢一圈。' }; },
    function () { var a = '一樣，都只在按下那一圈導通'; return { q: '<code>LDP X0 → INC D0</code> 和 <code>LD X0 → PLS M0</code>、<code>LD M0 → INC D0</code>，效果有什麼不同？', ans: a, wrong: dq(a, ['LDP 按住會一直加', 'PLS 的寫法會加兩次', 'LDP 只能用在 X', 'PLS 的寫法放開才加']), ex: '指令手冊：LDP 的效果和「LD X0、PLS M0、LD M0」一樣，只是少用一個 M。' }; },
    function () { var a = 'PLF（下降緣）'; return { q: '想做「按鈕放開的那一刻才記錄一次」，用哪一個？', ans: a, wrong: dq(a, ['PLS（上升緣）', 'OUT', 'ALT', 'SET']), ex: 'PLF 在條件從 ON 變 OFF 的那一圈 ON 一次；也可以用 LDF 接點。' }; },
    function () { var a = '兩個 D 都加 1'; return { q: '同一個 X0 寫兩次：<code>LDP X0 → INC D0</code>、<code>LDP X0 → INC D1</code>。按一下 X0？', ans: a, wrong: dq(a, ['只有 D0 加 1，第二個被第一個吃掉', '只有 D1 加 1', '兩個都不加', 'D0 加 2']), ex: '每個邊緣接點自己記得上一次看到的值，各自都抓得到這一次邊緣。' }; },
    function () { var k = p1([1, 2, 3, 4]), xs = []; for (var i = 0; i < k; i++) xs = xs.concat(seq(20, 0, 4)); var y = runSeq(PR.pls.il, [0].concat(xs), ['Y0']).p.v.Y0, a = y ? 'ON' : 'OFF'; return { q: '一個按鈕啟動／停止：<code>LD X0 → PLS M0</code>，<code>LD M0 / ANI Y0 / LD Y0 / ANI M0 / ORB / OUT Y0</code>。Y0 原本 OFF，按了 ' + k + ' 次，Y0 是？', ans: a, wrong: dq(a, ['ON', 'OFF', '按住時一直閃', '永遠 ON 停不下來']), ex: '剛按下（M0 = 1）時：Y0 原本 OFF 就變 ON；原本 ON 則兩條路都斷，變 OFF。按 ' + k + ' 次切換 ' + k + ' 次。' }; },
    function () { var a = '按住期間一直切換，放開停在哪裡不一定'; return { q: '一個按鈕啟動／停止，寫成 <code>LD X0 / ANI Y0 / LD Y0 / ANI X0 / ORB / OUT Y0</code>（沒有上升緣），按一下會怎樣？', ans: a, wrong: dq(a, ['正常：按一下切換一次', 'Y0 永遠不會亮', 'Y0 亮了就停不下來', 'PLC 報錯']), ex: '沒有上升緣，按住的每一圈都在切換，結果等於看按了奇數圈還是偶數圈。' }; },
    function () { var a = 'Y、M、S'; return { q: 'ALT（ALTP）可以接哪些元件？', ans: a, wrong: dq(a, ['只有 Y', 'X、Y', 'D、T、C', 'Y、M']), ex: 'FX3 程式手冊：ALT 的對象是 Y、M、S。' }; },
    function () { var a = '用 ALTP，或 LDP X0 → ALT'; return { q: '想讓一個按鈕「按一下切換一次」，下面哪個寫法對？', ans: a, wrong: dq(a, ['LD X0 → ALT（連續型就可以）', 'LD X0 → OUT Y0', 'LDF X0 → OUT Y0', 'LD X0 → SET Y0']), ex: 'ALT 連續型在條件 ON 的每一圈都反轉；ALTP 或前面接上升緣，才是一按一切換（FX3 程式手冊 ALT）。' }; },
    function () { var latch = Math.random() < .5, a = latch ? '不會動作' : '會 ON 一圈'; return { q: 'PLC 從 STOP 切到 RUN 時，X0 已經按著。程式 <code>LD X0 → PLS ' + (latch ? 'M600（停電保持）' : 'M0（一般 M）') + '</code>，第一圈這個 M 會？', ans: a, wrong: dq(a, ['會 ON 一圈', '不會動作', '一直 ON', 'PLC 報錯']), ex: 'FX3 程式手冊：條件在 STOP→RUN 時已經 ON，一般 M 的 PLS 第一圈會動作一次；停電保持的 M（如 M600）不會。' }; },
    function () { var a = '可以'; return { q: 'PLS、PLF 可以寫在步進 STL 和 RET 之間嗎？', ans: a, wrong: dq(a, ['不行，步進裡只能用 LDP', '不行，會讓步序卡住', '只能寫在 S0 裡', '只能用 PLS，不能用 PLF']), ex: 'FX3 程式手冊：PLS、PLF 可以用在 STL～RET 之間。' }; },
    function () { var a = '下降緣指令一律不執行'; return { q: 'PLC 在 RUN 中寫入程式（RUN 中寫入），寫入的那一刻條件已經 ON 或已經 OFF，邊緣指令會怎樣？', ans: a, wrong: dq(a, ['上升緣、下降緣都不執行', '上升緣、下降緣都會執行一次', '上升緣一律不執行', 'PLC 會自動停機']), ex: 'FX3 程式手冊：RUN 中寫入時，條件已經 ON 的上升緣指令會執行，下降緣指令一律不執行。' }; }
  ];
  function gen() { return p1(QK)(); }

  /* ================= 分頁 ================= */
  var tabs = $('tabs');
  function stopAll() { tlStop(); aStop(); }
  function show(t) {
    stopAll();
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['tl', 'trap', 'prac', 'quiz'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  if (/^#(tl|trap|prac|quiz)$/.test(location.hash)) show(location.hash.slice(1));

  window.EdgeLab = { PLC: PLC, parse: parse, validate: validate, runSeq: runSeq, seq: seq, IL_TL: IL_TL, PLSIL: PLSIL, PR: PR, tlStep: tlStep, tlReset: tlReset, aRun: aRun, alPress: alPress, plsRun: plsRun, pPress: pPress, pReset: pReset, verify: verify, show: show, stopAll: stopAll, quizKinds: QK, quizGen: gen };
  if (window.LabQuiz) window.EdgeLab.quiz = window.LabQuiz('t-quiz', gen);
})();
