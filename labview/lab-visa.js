/* VISA 實驗室：鮑率與波形、VISA Read 返回條件、Bytes at Port */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function log(id, s) { var l = $(id); l.insertBefore(el('div', '', s), l.firstChild); }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function hex2(v) { return (v < 16 ? '0' : '') + v.toString(16).toUpperCase(); }
  function ms(x, d) { return (+x.toFixed(d == null ? 3 : d)) + ' ms'; }
  var CTL = { 0: 'NUL', 2: 'STX', 3: 'ETX', 5: 'ENQ', 6: 'ACK', 9: 'TAB', 10: 'LF', 13: 'CR', 21: 'NAK' };
  function nm(c) { return CTL[c] || (c >= 33 && c < 127 ? String.fromCharCode(c).replace('&', '&amp;').replace('<', '&lt;') : c === 32 ? '空格' : hex2(c) + 'h'); }
  function isCtl(c) { return c < 33 || c >= 127; }
  function chip(c, sub, cls, tag) { return '<' + (tag || 'span') + ' class="chip' + (isCtl(c) ? ' ctl' : '') + (cls ? ' ' + cls : '') + '"' + (tag === 'button' ? ' type="button"' : '') + '>' + nm(c) + (sub != null ? '<small>' + sub + '</small>' : '') + '</' + (tag || 'span') + '>'; }
  function empty() { return '<span class="chip empty"></span>'; }
  function codes(s) { var a = []; for (var i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 0x7F); return a; }
  function fxSum(body) { var s = 0; for (var i = 0; i < body.length; i++) s += body.charCodeAt(i); return hex2(s & 0xFF); }
  function fxFrame(body) { return '\x02' + body + '\x03' + fxSum(body + '\x03'); }
  var READ_D100 = fxFrame('010C802'), REPLY_1234 = fxFrame('D204');   // 課程用的讀 D100 封包、PLC 回 1234

  var tabs = $('tabs');
  function show(t) {
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['baud', 'read', 'bap'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* ================= 序列框架的計算（給動畫與測試共用） ================= */
  function bitsPerChar(c) { return 1 + c.data + (c.par === 'N' ? 0 : 1) + c.stop; }
  function charMs(c) { return bitsPerChar(c) * 1000 / c.baud; }
  function parityBit(v, c) { var ones = 0; for (var i = 0; i < c.data; i++) ones += (v >> i) & 1; return c.par === 'E' ? ones % 2 : 1 - ones % 2; }
  function frame(v, c) {   // 回傳 [{b, lab}]
    var f = [{ b: 0, lab: '起' }];
    for (var i = 0; i < c.data; i++) f.push({ b: (v >> i) & 1, lab: 'D' + i });
    if (c.par !== 'N') f.push({ b: parityBit(v, c), lab: 'P' });
    for (var s = 0; s < c.stop; s++) f.push({ b: 1, lab: '停' });
    return f;
  }
  function stream(list, c) { var bits = [], starts = []; list.forEach(function (v) { starts.push(bits.length); frame(v, c).forEach(function (x) { bits.push(x.b); }); }); return { bits: bits, starts: starts }; }
  /* 接收端：看到 1→0 的下降邊緣，等半個位元確認是起始位元，之後每隔一個位元（用接收端自己的鮑率）在正中間取樣 */
  function decode(bits, sC, rC) {
    var Ts = 1000 / sC.baud, Tr = 1000 / rC.baud, out = [], edges = [];
    function lv(t) { var k = Math.floor(t / Ts + 1e-9); return k < 0 || k >= bits.length ? 1 : bits[k]; }
    for (var k = 0; k < bits.length; k++) if (bits[k] === 0 && (k === 0 || bits[k - 1] === 1)) edges.push(k * Ts);
    var tc = -1;
    for (var e = 0; e < edges.length; e++) {
      var t0 = edges[e]; if (t0 <= tc) continue;
      if (lv(t0 + Tr / 2) !== 0) continue;   // 雜訊，不是真的起始位元
      var smp = [{ t: t0 + Tr / 2, b: 0, lab: '起' }], v = 0, n = 1;
      for (var i = 0; i < rC.data; i++, n++) { var b = lv(t0 + (n + 0.5) * Tr); v |= b << i; smp.push({ t: t0 + (n + 0.5) * Tr, b: b, lab: 'D' + i }); }
      var perr = false;
      if (rC.par !== 'N') { var pb = lv(t0 + (n + 0.5) * Tr); perr = pb !== parityBit(v, rC); smp.push({ t: t0 + (n + 0.5) * Tr, b: pb, lab: 'P', bad: perr }); n++; }
      var ts = t0 + (n + 0.5) * Tr, sb = lv(ts), ferr = sb !== 1;
      smp.push({ t: ts, b: sb, lab: '停', bad: ferr });
      out.push({ v: v, perr: perr, ferr: ferr, t0: t0, smp: smp });
      tc = ts;
    }
    return out;
  }

  /* ================= 1. 鮑率與波形 ================= */
  var PKT = [
    ['ENQ（問 PLC 在不在）', '\x05'],
    ['讀 D100 一個字（課程封包）', READ_D100],
    ['PLC 回 D100 = 1234', REPLY_1234],
    ['ACK', '\x06'],
    ['文字儀器的一行 +23.51\\r\\n', '+23.51\r\n'],
    ['自己打…', null]
  ];
  var A = { sel: 0, bit: -1, timer: null };
  function mkCfg(id, pre) {
    $(id).innerHTML = '<label>鮑率 <select id="' + pre + 'baud"><option>9600</option><option>19200</option><option>115200</option></select></label>' +
      '<label>資料位元 <select id="' + pre + 'data"><option>7</option><option>8</option></select></label>' +
      '<label>同位 <select id="' + pre + 'par"><option value="N">None</option><option value="E" selected>Even</option><option value="O">Odd</option></select></label>' +
      '<label>停止位元 <select id="' + pre + 'stop"><option>1</option><option>2</option></select></label>';
  }
  mkCfg('cfgS', 'as'); mkCfg('cfgR', 'ar');
  function cfg(pre) { return { baud: +$(pre + 'baud').value, data: +$(pre + 'data').value, par: $(pre + 'par').value, stop: +$(pre + 'stop').value }; }
  function cname(c) { return c.baud + ' ' + c.data + c.par + c.stop; }
  PKT.forEach(function (p, i) { var o = el('option', '', p[0]); o.value = i; $('apkt').appendChild(o); });
  function parseCustom(s) {
    return s.replace(/<(STX|ETX|ENQ|ACK|NAK|CR|LF)>/gi, function (m, k) { return String.fromCharCode({ STX: 2, ETX: 3, ENQ: 5, ACK: 6, NAK: 21, CR: 13, LF: 10 }[k.toUpperCase()]); })
      .replace(/\\r/g, '\r').replace(/\\n/g, '\n').replace(/\\x([0-9a-f]{2})/gi, function (m, h) { return String.fromCharCode(parseInt(h, 16)); }).slice(0, 24);
  }
  function aText() { var p = PKT[+$('apkt').value]; return p[1] != null ? p[1] : parseCustom($('acust').value); }
  function aCompute() {
    var s = cfg('as'), r = $('asame').checked ? s : cfg('ar'), list = codes(aText()), st = stream(list, s);
    return { s: s, r: r, list: list, st: st, rx: decode(st.bits, s, r) };
  }
  function aSyncR() {
    var same = $('asame').checked;
    ['baud', 'data', 'par', 'stop'].forEach(function (k) { var e = $('ar' + k); if (same) e.value = $('as' + k).value; e.disabled = same; });
  }
  function aDraw() {
    aSyncR();
    $('acustw').hidden = PKT[+$('apkt').value][1] != null;
    var R = aCompute(), s = R.s, n = R.list.length; A.R = R;
    if (A.sel >= n) A.sel = 0;
    var bpc = bitsPerChar(s), cm = charMs(s);
    $('abits').textContent = bpc + ' 個'; $('achar').textContent = ms(cm); $('apkms').textContent = ms(cm * n, 2); $('acps').textContent = Math.floor(s.baud / bpc) + ' 個字元';
    $('aform').innerHTML = '1 起始 ＋ ' + s.data + ' 資料 ＋ ' + (s.par === 'N' ? 0 : 1) + ' 同位 ＋ ' + s.stop + ' 停止 ＝ ' + bpc + ' 位元；' + bpc + ' ÷ ' + s.baud + ' bps ＝ ' + ms(cm) + '／字元；' + n + ' 個字元 × ' + ms(cm) + ' ＝ ' + ms(cm * n, 2) + '。';
    var h = ''; R.list.forEach(function (c, i) { h += chip(c, hex2(c) + 'h', i === A.sel ? 'sel' : '', 'button'); }); $('asent').innerHTML = h || empty();
    Array.prototype.forEach.call($('asent').children, function (b, i) { b.onclick = function () { aStop(); A.sel = i; A.bit = -1; aDraw(); }; });
    aWave(R);
    // 接收結果
    var ok = R.rx.length === n, rh = '';
    R.rx.forEach(function (x, i) { var bad = x.perr || x.ferr, same = R.list[i] === x.v; if (bad || !same) ok = false; rh += chip(x.v, x.perr ? '同位錯' : x.ferr ? '框架錯' : hex2(x.v) + 'h', bad ? 'bad' : same ? 'got' : 'bad'); });
    $('arecv').innerHTML = rh || empty();
    if (!n) say('asay', '');
    else if (ok) say('asay', '✔ 接收端（' + cname(R.r) + '）切出來的 ' + n + ' 個字元和送出的一樣。', 'ok');
    else {
      var pe = R.rx.filter(function (x) { return x.perr; }).length, fe = R.rx.filter(function (x) { return x.ferr; }).length;
      say('asay', '✖ 送出 ' + cname(s) + '、接收 ' + cname(R.r) + '：送了 ' + n + ' 個字元，接收端切出 ' + R.rx.length + ' 個' + (pe ? '，同位錯誤 ' + pe + ' 個' : '') + (fe ? '，停止位元不是 1（框架錯誤）' + fe + ' 個' : '') + (pe || fe ? '' : '，內容不一樣（亂碼）') + '。', 'bad');
    }
  }
  function aWave(R) {
    var svg = $('awave'), s = R.s, n = R.list.length;
    if (!n) { svg.innerHTML = '<text x="20" y="90">（沒有字元）</text>'; $('awhy').textContent = ''; return; }
    var v = R.list[A.sel], f = frame(v, s), Ts = 1000 / s.baud, t0 = R.st.starts[A.sel] * Ts, nb = f.length;
    var ws = t0 - Ts * 0.8, we = t0 + (nb + 0.8) * Ts, W = 640, L = 14, X = function (t) { return L + (t - ws) / (we - ws) * (W - 2 * L); };
    var HI = 62, LO = 112, g = '';
    // 位元格子
    f.forEach(function (x, i) {
      var a = X(t0 + i * Ts), b = X(t0 + (i + 1) * Ts), on = i === A.bit;
      var col = x.lab === '起' ? 'rgba(220,38,38,.10)' : x.lab === 'P' ? 'rgba(124,58,237,.12)' : x.lab === '停' ? 'rgba(22,163,74,.12)' : 'color-mix(in srgb, var(--on) 7%, transparent)';
      g += '<rect x="' + a + '" y="30" width="' + (b - a) + '" height="100" fill="' + (on ? 'rgba(245,158,11,.35)' : col) + '" stroke="#9ca3af" stroke-width=".5"/>';
      g += '<text x="' + (a + b) / 2 + '" y="22" text-anchor="middle">' + x.lab + '</text>';
      g += '<text x="' + (a + b) / 2 + '" y="148" text-anchor="middle" class="mu">' + (i <= A.bit || A.bit < 0 ? x.b : '') + '</text>';
    });
    // 波形線（播放時只畫到目前的位元）
    var lim = A.bit < 0 ? nb : A.bit + 1, pts = [], y = function (b) { return b ? HI : LO; };
    pts.push([X(ws), HI]);
    for (var i = 0; i < lim; i++) { var a = X(t0 + i * Ts), b = X(t0 + (i + 1) * Ts), yy = y(f[i].b); pts.push([a, pts[pts.length - 1][1]]); pts.push([a, yy]); pts.push([b, yy]); }
    if (lim === nb) pts.push([X(we), HI]);
    g += '<polyline points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1]; }).join(' ') + '" fill="none" style="stroke:var(--on)" stroke-width="3"/>';
    g += '<text x="2" y="' + (HI + 4) + '" class="mu">1</text><text x="2" y="' + (LO + 4) + '" class="mu">0</text>';
    // 接收端取樣點
    if (A.bit < 0) R.rx.forEach(function (x) { x.smp.forEach(function (p) { if (p.t >= ws && p.t <= we) g += '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + y(p.b) + '" r="5" fill="' + (p.bad ? '#dc2626' : '#16a34a') + '" stroke="#fff" stroke-width="1.5"><title>接收端取樣 ' + p.lab + ' = ' + p.b + '</title></circle>'; }); });
    g += '<text x="' + (W - L) + '" y="168" text-anchor="end" class="mu">一格 ' + ms(Ts) + '，這個字元共 ' + ms(nb * Ts) + '</text>';
    svg.innerHTML = g;
    var bin = ''; for (var k = s.data - 1; k >= 0; k--) bin += (v >> k) & 1;
    $('awhy').innerHTML = '「' + nm(v) + '」＝ ' + hex2(v) + 'h ＝ 二進位 ' + bin + '。線上先送最低位 D0，所以從左到右讀是反過來的。' +
      (s.par === 'N' ? '' : '資料裡有 ' + (bin.split('1').length - 1) + ' 個 1，' + (s.par === 'E' ? '偶' : '奇') + '同位要讓 1 的總數變成' + (s.par === 'E' ? '偶' : '奇') + '數，所以同位位元是 ' + parityBit(v, s) + '。') +
      ($('asame').checked ? '' : '　圓點是接收端的取樣位置（紅色＝同位或停止位元不對）。');
  }
  function aStep() {
    var R = A.R; if (!R || !R.list.length) return;
    var nb = bitsPerChar(R.s);
    A.bit++;
    if (A.bit >= nb) { A.bit = -1; if (A.timer) { if (A.sel < R.list.length - 1) { A.sel++; A.bit = 0; } else aStop(); } }
    aDraw();
  }
  function aStop() { clearInterval(A.timer); A.timer = null; $('aplay').textContent = '▶ 一個位元一個位元送'; }
  $('aplay').onclick = function () { if (A.timer) { aStop(); A.bit = -1; aDraw(); return; } A.bit = -1; A.timer = setInterval(aStep, 280); $('aplay').textContent = '⏸ 停'; aStep(); };
  $('astep').onclick = function () { aStop(); aStep(); };
  Array.prototype.forEach.call(document.querySelectorAll('#cfgS select,#cfgR select,#apkt,#asame'), function (e) { e.onchange = function () { aStop(); A.bit = -1; aDraw(); }; });
  $('acust').oninput = function () { A.sel = 0; aDraw(); };
  aDraw();

  /* ================= 2. VISA Read 什麼時候返回 ================= */
  var RESP = [
    ['D100 = 1234（8 個，含校驗）', REPLY_1234],
    ['ACK（1 個）', '\x06'],
    ['NAK（1 個，PLC 說命令不對）', '\x15'],
    ['文字儀器：+23.51\\r\\n（8 個）', '+23.51\r\n'],
    ['沒有回應（線沒接、設定不對）', '']
  ];
  RESP.forEach(function (p, i) { var o = el('option', '', p[0]); o.value = i; $('rresp').appendChild(o); });
  var RSC = [
    { name: '① 課程寫法：byte count 8，終止字元關', set: { resp: 0, count: 8, ten: false, term: 10, tmo: 2000 } },
    { name: '② byte count 算太多：填 10，PLC 只回 8 個', set: { resp: 0, count: 10, ten: false, term: 10, tmo: 2000 } },
    { name: '③ byte count 算太少：填 4（之後按「再 Read 一次」）', set: { resp: 0, count: 4, ten: false, term: 10, tmo: 2000 } },
    { name: '④ 開終止字元、設成 ETX，byte count 100', set: { resp: 0, count: 100, ten: true, term: 3, tmo: 2000 } },
    { name: '⑤ 文字儀器：終止字元 \\n，byte count 100', set: { resp: 3, count: 100, ten: true, term: 10, tmo: 2000 } },
    { name: '⑥ 讀 8 個，可是 PLC 回 NAK', set: { resp: 2, count: 8, ten: false, term: 10, tmo: 500 } },
    { name: '⑦ PLC 沒回應', set: { resp: 4, count: 8, ten: false, term: 10, tmo: 2000 } }
  ];
  var RD = null, RDELAY = 15;
  RSC.forEach(function (s, i) { var b = el('button', '', s.name); b.type = 'button'; b.dataset.i = i; b.onclick = function () { rScn(i); }; $('rscn').appendChild(b); });
  function rOpts() { return { resp: RESP[+$('rresp').value][1], baud: +$('rbaud').value, count: Math.max(1, Math.min(200, Math.floor(+$('rcount').value) || 1)), ten: $('rten').checked, term: +$('rterm').value, tmo: +$('rtmo').value }; }
  /* 一次 VISA Read：arr 是 [{c, t, rd}]，rd = 被第幾次 Read 拿走（-1 = 還沒） */
  function readOnce(arr, tStart, o, k) {
    var got = [], left = arr.filter(function (x) { return x.rd < 0; });
    for (var i = 0; i < left.length; i++) {
      var x = left[i], tb = Math.max(x.t, tStart);
      if (tb > tStart + o.tmo) break;
      x.rd = k; got.push(x);
      var full = got.length >= o.count, term = o.ten && x.c === o.term;
      if (full || term) return { k: k, tStart: tStart, t: tb, why: term && full ? 'both' : term ? 'term' : 'count', got: got, err: 0 };
    }
    return { k: k, tStart: tStart, t: tStart + o.tmo, why: 'timeout', got: got, err: -1073807339 };
  }
  function rNew() {
    clearInterval(RD && RD.timer);
    var o = rOpts(), cm = 10000 / o.baud, list = codes(o.resp);
    RD = { o: o, cm: cm, arr: list.map(function (c, i) { return { c: c, t: RDELAY + (i + 1) * cm, rd: -1 }; }), reads: [], tNow: 0, timer: null };
    RD.reads.push(readOnce(RD.arr, 0, o, 0));
    $('rlog').innerHTML = '';
    log('rlog', 't = 0：VISA Write 送完命令，VISA Read 開始等（byte count ' + o.count + '、終止字元 ' + (o.ten ? nm(o.term) : '關') + '、timeout ' + o.tmo + ' ms）');
    rDraw();
  }
  function rEvents() {
    var ev = [];
    RD.arr.forEach(function (x) { ev.push(x.t); }); RD.reads.forEach(function (r) { ev.push(r.t); });
    return ev.filter(function (t) { return t > RD.tNow + 1e-9; }).sort(function (a, b) { return a - b; });
  }
  function rStep() {
    var ev = rEvents(); if (!ev.length) { rStopPlay(); return false; }
    var t = ev[0], prev = RD.tNow; RD.tNow = t;
    RD.arr.forEach(function (x, i) { if (x.t > prev && x.t <= t) log('rlog', 't = ' + ms(x.t, 2) + '：第 ' + (i + 1) + ' 個位元組「' + nm(x.c) + '」進到接收緩衝區'); });
    RD.reads.forEach(function (r) { if (r.t > prev && r.t <= t) log('rlog', 't = ' + ms(r.t, 2) + '：<b>第 ' + (r.k + 1) + ' 次 VISA Read 返回</b>（' + WHY[r.why] + '），拿到 ' + r.got.length + ' 個' + (r.err ? '，錯誤 ' + r.err : '')); });
    rDraw(); return true;
  }
  var WHY = { count: '拿滿 byte count', term: '收到終止字元', both: '拿滿 byte count，也剛好是終止字元', timeout: '逾時' };
  function rAgain() {
    var last = RD.reads[RD.reads.length - 1];
    if (RD.tNow < last.t) { say('rsay', '上一次 Read 還沒返回，先按「下一個事件」。'); return; }
    var r = readOnce(RD.arr, RD.tNow, RD.o, RD.reads.length); RD.reads.push(r);
    log('rlog', 't = ' + ms(RD.tNow, 2) + '：第 ' + RD.reads.length + ' 次 VISA Read 開始（緩衝區裡已經有 ' + RD.arr.filter(function (x) { return x.rd < 0 || x.rd === r.k; }).filter(function (x) { return x.t <= RD.tNow; }).length + ' 個）');
    if (r.t <= RD.tNow) log('rlog', 't = ' + ms(r.t, 2) + '：<b>第 ' + RD.reads.length + ' 次 VISA Read 立刻返回</b>（' + WHY[r.why] + '），拿到 ' + r.got.length + ' 個');
    rDraw();
  }
  function rDraw() {
    var t = RD.tNow, o = RD.o, h;
    $('rt').textContent = +t.toFixed(2);
    h = RD.arr.filter(function (x) { return x.t > t; }).map(function (x) { return chip(x.c, null, 'wire'); }).join('');
    $('rwire').innerHTML = h || empty();
    h = RD.arr.filter(function (x) { if (x.t > t) return false; if (x.rd < 0) return true; return RD.reads[x.rd].t > t; }).map(function (x) { return chip(x.c, null, Math.abs(x.t - t) < 1e-9 ? 'in' : ''); }).join('');
    $('rbuf').innerHTML = h || empty();
    var rh = '';
    RD.reads.forEach(function (r) {
      var done = r.t <= t, n = r.got.filter(function (x) { return x.t <= t; }).length, termSeen = o.ten && r.got.some(function (x) { return x.t <= t && x.c === o.term; });
      rh += '<div class="box" style="margin-top:8px"><h3>第 ' + (r.k + 1) + ' 次 VISA Read：' + (done ? '已返回' : '等待中（已等 ' + ms(t - r.tStart, 2) + '）') + '</h3>';
      rh += '<div class="cond"><span class="' + (done && (r.why === 'count' || r.why === 'both') ? 'hit' : '') + '">① byte count：' + (done ? r.got.length : n) + ' / ' + o.count + '</span>' +
        '<span class="' + (done && (r.why === 'term' || r.why === 'both') ? 'hit' : '') + '">② 終止字元 ' + (o.ten ? nm(o.term) + (termSeen ? ' ✓' : '') : '（關）') + '</span>' +
        '<span class="' + (done && r.why === 'timeout' ? 'miss' : '') + '">③ timeout ' + o.tmo + ' ms</span></div>';
      if (done) rh += '<div class="lbl">read buffer（' + r.got.length + ' 個）' + (r.err ? '　<b style="color:#dc2626">error ' + r.err + '（逾時）</b>' : '') + '</div><div class="slots">' + (r.got.length ? r.got.map(function (x) { return chip(x.c, null, 'got' + (Math.abs(r.t - t) < 1e-9 ? ' in' : '')); }).join('') : empty()) + '</div>';
      rh += '</div>';
    });
    $('rreads').innerHTML = rh;
    var last = RD.reads[RD.reads.length - 1], ev = rEvents();
    $('rstep').disabled = !ev.length; $('rplay').disabled = !ev.length; $('ragain').disabled = t < last.t;
    if (t < last.t) {
      var nx = ev[0];
      say('rsay', nx === last.t && last.why === 'timeout' && !RD.arr.some(function (x) { return x.t > t && x.t <= nx; }) ? '接下來沒有任何位元組會進來，VISA Read 只能一直等到 ' + o.tmo + ' ms 逾時。' : '');
    } else {
      var rest = RD.arr.filter(function (x) { return x.rd < 0; }).length, r2 = last;
      if (r2.why === 'timeout') say('rsay', '✖ 逾時，錯誤 -1073807339。' + (r2.got.length ? '時間到之前已經收到的 ' + r2.got.length + ' 個也一起交回來，但程式通常會因為錯誤把這筆當成失敗。' : '一個位元組都沒收到。') + (o.count > r2.got.length && r2.got.length ? ' 原因：byte count 比對方實際回的多。' : ''), 'bad');
      else if (rest) say('rsay', '⚠ Read 返回了，但緩衝區還留著 ' + rest + ' 個位元組（' + RD.arr.filter(function (x) { return x.rd < 0; }).map(function (x) { return nm(x.c); }).join(' ') + '）。下一次 Read 會先拿到它們。按「再 Read 一次」看看。', 'bad');
      else say('rsay', '✔ 第 ' + (r2.k + 1) + ' 次 Read 在 t = ' + ms(r2.t, 2) + ' 返回（' + WHY[r2.why] + '），緩衝區沒有剩。', 'ok');
    }
    $('rplay').textContent = RD.timer ? '⏸ 暫停' : '▶ 播放';
  }
  function rStopPlay() { if (RD && RD.timer) { clearInterval(RD.timer); RD.timer = null; } }
  function rScn(i) {
    var s = RSC[i].set;
    $('rresp').value = s.resp; $('rcount').value = s.count; $('rten').checked = s.ten; $('rterm').value = s.term; $('rtmo').value = s.tmo;
    Array.prototype.forEach.call($('rscn').children, function (b) { b.classList.toggle('here', +b.dataset.i === i); });
    rNew(); rPlay();
  }
  function rPlay() { if (RD.timer) { rStopPlay(); rDraw(); return; } RD.timer = setInterval(function () { if (!rStep()) rDraw(); }, 450); rDraw(); }
  $('rgo').onclick = function () { rNew(); rPlay(); };
  $('rplay').onclick = rPlay; $('rstep').onclick = function () { rStopPlay(); rStep(); }; $('ragain').onclick = function () { rAgain(); };
  Array.prototype.forEach.call(document.querySelectorAll('#rresp,#rbaud,#rcount,#rten,#rterm,#rtmo'), function (e) { e.onchange = function () { Array.prototype.forEach.call($('rscn').children, function (b) { b.classList.remove('here'); }); rNew(); }; });
  rScn(0); rStopPlay(); RD.tNow = 0; rDraw();

  /* ================= 3. Bytes at Port ================= */
  var PDELAY = 15, P = { timer: null };
  $('pdel').textContent = PDELAY;
  function pCompute(w, baud) {
    var cm = 10000 / baud, list = codes(REPLY_1234), arr = list.map(function (c, i) { return { c: c, t: PDELAY + (i + 1) * cm }; });
    var n = arr.filter(function (x) { return x.t <= w; }).length;
    return { arr: arr, n: n, got: arr.slice(0, n), late: arr.slice(n), cm: cm };
  }
  function pDraw() {
    var w = +$('pwait').value, R = pCompute(w, +$('pbaud').value), MAX = 40;
    $('pwaitv').textContent = w + ' ms'; $('pn').textContent = R.n;
    var h = '';
    R.arr.forEach(function (x) { if (x.t <= MAX) h += '<span class="tk' + (x.t <= w ? ' got' : '') + '" style="left:' + (x.t / MAX * 100).toFixed(2) + '%"></span>'; });
    h += '<span class="cur" style="left:' + (w / MAX * 100) + '%"></span>';
    [0, 10, 20, 30, 40].forEach(function (t) { h += '<span class="ax" style="left:' + Math.min(96, Math.max(4, t / MAX * 100)) + '%">' + t + ' ms</span>'; });
    $('pbar').innerHTML = h;
    $('pgot').innerHTML = R.got.length ? R.got.map(function (x) { return chip(x.c, null, 'got'); }).join('') : empty();
    $('plate').innerHTML = R.late.length ? R.late.map(function (x) { return chip(x.c, null, 'wire'); }).join('') : empty();
    if (!R.n) say('psay', 'Bytes at Port = 0：PLC 的回應還沒開始進來，這一刻緩衝區是空的，沒東西可拿。這一圈白跑，回應會留到下一圈。', 'bad');
    else if (R.n < R.arr.length) say('psay', '✖ 只拿到 ' + R.n + ' / ' + R.arr.length + ' 個：半個封包。' + (R.got.some(function (x) { return x.c === 3; }) ? '有 ETX 但校驗還沒到，' : '連 ETX 都還沒到，') + '檢查一定失敗；剩下的 ' + R.late.length + ' 個會混進下一次讀到的資料。', 'bad');
    else say('psay', '✔ 這次 Wait 夠長，8 個都到了。但這只對「這一次的速度」成立；換成 ' + ($('pbaud').value === '9600' ? '更慢的回應' : '9600 bps') + '，同樣的 Wait 可能就不夠。', 'ok');
  }
  function pPlay() {
    if (P.timer) { clearInterval(P.timer); P.timer = null; $('pplay').textContent = '▶ 從 0 ms 掃到 40 ms'; return; }
    $('pwait').value = 0; pDraw(); $('pplay').textContent = '⏸ 停';
    P.timer = setInterval(function () { var v = +$('pwait').value + 1; if (v > 40) { pPlay(); return; } $('pwait').value = v; pDraw(); }, 160);
  }
  $('pwait').oninput = pDraw; $('pbaud').onchange = pDraw; $('pplay').onclick = pPlay;
  pDraw();

  if (/^#(baud|read|bap)$/.test(location.hash)) show(location.hash.slice(1));
  window.VisaLab = {
    show: show, bitsPerChar: bitsPerChar, charMs: charMs, parityBit: parityBit, frame: frame, stream: stream, decode: decode, fxFrame: fxFrame,
    aCompute: aCompute, aDraw: aDraw, aStep: aStep, A: function () { return A; },
    readOnce: readOnce, rNew: rNew, rStep: rStep, rAgain: rAgain, rScn: function (i) { rScn(i); rStopPlay(); rDraw(); }, RD: function () { return RD; },
    pCompute: pCompute, pDraw: pDraw, REPLY_1234: REPLY_1234, READ_D100: READ_D100
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  var V = window.VisaLab;
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function f3(x) { return String(+x.toFixed(3)); }
  var FMT = [{ s: '7E1', data: 7, par: 'E', stop: 1 }, { s: '8N1', data: 8, par: 'N', stop: 1 }, { s: '7E2', data: 7, par: 'E', stop: 2 }, { s: '8E1', data: 8, par: 'E', stop: 1 }, { s: '7N1', data: 7, par: 'N', stop: 1 }];
  var KIND = [
    function () {
      var f = p1(FMT), c = { baud: 9600, data: f.data, par: f.par, stop: f.stop }, b = V.bitsPerChar(c);
      return { q: '序列設定 <b>' + f.s + '</b>（' + f.data + ' 個資料位元、' + (f.par === 'N' ? '無同位' : '偶同位') + '、' + f.stop + ' 個停止位元）。線上每個字元總共幾個位元？', ans: b + ' 個', wrong: [f.data + ' 個', (b - 1) + ' 個', (b + 1) + ' 個', '8 個', '11 個', '9 個'], ex: '別忘了起始位元：1 ＋ ' + f.data + ' ＋ ' + (f.par === 'N' ? 0 : 1) + ' ＋ ' + f.stop + ' ＝ ' + b + '。' };
    },
    function () {
      var baud = p1([9600, 19200, 115200]), f = p1(FMT), c = { baud: baud, data: f.data, par: f.par, stop: f.stop }, b = V.bitsPerChar(c), t = V.charMs(c);
      return { q: '<b>' + baud + ' bps、' + f.s + '</b>。送一個字元（字元之間沒有空檔）大約要多久？', ans: f3(t) + ' ms', wrong: [f3(f.data * 1000 / baud) + ' ms', f3(1000 / baud) + ' ms', f3(t * 10) + ' ms', f3(t / 10) + ' ms', f3(8000 / baud * 2) + ' ms'], ex: b + ' 個位元 ÷ ' + baud + ' bps ＝ ' + f3(t) + ' ms。' };
    },
    function () {
      var n = p1([8, 11, 12, 20, 52]), baud = p1([9600, 19200]), t = n * 10 * 1000 / baud;
      return { q: '<b>' + baud + ' bps、7E1</b>，PLC 一口氣回了 <b>' + n + '</b> 個字元（中間沒有空檔）。從第一個起始位元到最後一個停止位元大約多久？', ans: f3(t) + ' ms', wrong: [f3(n * 8 * 1000 / baud) + ' ms', f3(n * 7 * 1000 / baud) + ' ms', f3(t / 10) + ' ms', f3(t * 10) + ' ms', n + ' ms'], ex: '7E1 一個字元 10 個位元：' + n + ' × 10 ÷ ' + baud + ' ＝ ' + f3(t) + ' ms。這只是線上傳輸的時間，PLC 處理命令還要另外算。' };
    },
    function () {
      var c = p1([['0', 0x30], ['1', 0x31], ['A', 0x41], ['C', 0x43], ['8', 0x38], ['ENQ', 0x05], ['ETX', 0x03], ['7', 0x37]]), v = c[1], ones = 0;
      for (var i = 0; i < 7; i++) ones += (v >> i) & 1;
      var p = V.parityBit(v, { data: 7, par: 'E' });
      return { q: '7E1（偶同位）送字元「' + c[0] + '」（' + v.toString(16).toUpperCase() + 'h）。同位位元是？', ans: String(p), wrong: [String(1 - p), '不用送同位位元', '和最高位元一樣', '固定是 1'], ex: v.toString(16).toUpperCase() + 'h 的 7 個資料位元裡有 ' + ones + ' 個 1。偶同位要讓 1 的總數（含同位位元）是偶數，所以同位位元是 ' + p + '。' };
    },
    function () {
      var n = p1([8, 12, 16]), k = p1([n - 4, n + 2, n]);
      var ans = k === n ? '收到第 ' + n + ' 個就返回，沒有錯誤' : k < n ? '收到 ' + k + ' 個就返回，剩下 ' + (n - k) + ' 個留在緩衝區' : '等到逾時，回錯誤 -1073807339';
      return { q: '終止字元<b>關閉</b>，VISA Read 的 byte count 填 <b>' + k + '</b>，PLC 回了 <b>' + n + '</b> 個字元（之後不再送）。VISA Read 會？', ans: ans, wrong: ['收到第 ' + n + ' 個就返回，沒有錯誤', '收到 ' + (n - 4) + ' 個就返回，剩下 4 個留在緩衝區', '等到逾時，回錯誤 -1073807339', '立刻返回，拿到 0 個', '收到 ' + n + ' 個後自動補空白到 ' + k + ' 個'], ex: '終止字元關閉時，只剩「拿滿 byte count」和「逾時」兩個條件。' + (k === n ? '剛好拿滿就返回。' : k < n ? '拿滿 ' + k + ' 個就走，其餘留給下一次 Read。' : '永遠湊不滿 ' + k + ' 個，只能等到逾時。') };
    },
    function () {
      return { q: 'VISA Read 開了終止字元並設成 <b>ETX（0x03）</b>，byte count 100。PLC 回 <b>STX D204 ETX D D</b>（8 個，最後 2 個是校驗）。這次 Read 拿到幾個？', ans: '6 個（到 ETX 為止），校驗 2 個留在緩衝區', wrong: ['8 個，全部', '5 個（不含 ETX）', '等到逾時，因為不到 100 個', '7 個'], ex: '收到終止字元就返回，而且終止字元本身也會回傳：STX、D、2、0、4、ETX 共 6 個。後面的校驗字元留到下一次 Read，造成錯位。所以 FX 協定在本課程關掉終止字元、用 byte count。' };
    },
    function () {
      return { q: '文字型儀器每次回一行 <b>+23.51\\r\\n</b>（8 個字元）。VISA Read 開啟終止字元 \\n（0x0A），byte count 填 100。結果？', ans: '拿到 8 個（含 \\r\\n）就返回', wrong: ['拿到 6 個（不含 \\r\\n）', '拿到 7 個（到 \\r 為止）', '等到逾時，因為不到 100 個', '拿到 100 個'], ex: '收到終止字元 \\n 就返回，終止字元本身也包含在回傳裡；\\r 不是設定的終止字元，照樣當一般資料。要拿掉結尾可以再用 Trim Whitespace 之類的函式。' };
    },
    function () {
      return { q: 'VISA Read 回傳錯誤 <b>-1073807339</b>，這是什麼意思？', ans: '逾時：時間到了還沒湊滿條件', wrong: ['COM 埠被別的程式占用', '同位錯誤', 'byte count 是負數', 'VISA 資源名稱打錯'], ex: '-1073807339 是 VISA 的逾時錯誤。可能是對方沒接、兩邊序列設定不一樣、封包錯讓對方不回、或 byte count 比對方實際回的多。' };
    },
    function () {
      var w = p1([3, 5, 7]), n = Math.floor(w / (10000 / 9600));
      return { q: '9600 bps、7E1。PLC 開始回 8 個字元之後的第 <b>' + w + ' ms</b>，程式讀 Bytes at Port，大約會是多少？', ans: String(n), wrong: [String(n + 1), String(n - 1), '8', '0', String(w)], ex: '一個字元約 1.04 ms，' + w + ' ms 內只完整收到 ' + n + ' 個。這時拿 Bytes at Port 去 Read，就只拿到半個封包。' };
    },
    function () {
      var x = p1([['送出端 9600、接收端 19200', '鮑率'], ['送出端 7E1、接收端 7N1', '同位'], ['送出端 7E1、接收端 8N1', '資料位元與同位']]);
      return { q: '兩邊序列設定不一樣：<b>' + x[0] + '</b>（其他都相同）。接收端會？', ans: '切出來的資料不對，可能是亂碼或同位、框架錯誤', wrong: ['自動偵測並改成對方的設定', '照樣收到正確資料，只是比較慢', '只有第一個字元錯，後面就正常', '電腦會跳出「設定不同」的提示'], ex: x[1] + '不同，接收端照自己的設定切位元，切出來的就不是對方送的字元。序列埠不會自動對齊設定，四個參數兩邊一定要手動設成一樣。' };
    }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) V.quiz = window.LabQuiz('vquiz', gen);
  V.quizGen = gen; V.quizKinds = KIND;
})();
