/* 看圖說答案：CLAD 程式判讀練習 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function A(a) { return '[' + a.join(', ') + ']'; }
  function roundEven(x) { var f = Math.floor(x), d = x - f; if (d > 0.5) return f + 1; if (d < 0.5) return f; return f % 2 === 0 ? f : f + 1; }

  /* ---------- 方塊圖的零件 ---------- */
  function Lp(id, x, y, w, h, kind) { return { k: 'loop', id: id, x: x, y: y, w: w, h: h, kind: kind }; }
  function Cs(id, x, y, w, h, label) { return { k: 'case', id: id, x: x, y: y, w: w, h: h, label: label }; }
  function Sq(id, x, y, w, h, n) { return { k: 'seq', id: id, x: x, y: y, w: w, h: h, n: n }; }
  function Nd(id, role, t, x, y, w, h, txt, lab) { return { k: 'node', id: id, role: role, t: t, x: x, y: y, w: w, h: h, txt: txt, lab: lab }; }
  function Wr(id, t, p) { return { k: 'wire', id: id, t: t, p: p }; }
  function Tn(id, x, y, t, idx) { return { k: 'tun', id: id, x: x, y: y, t: t, idx: idx }; }
  function Sr(id, xl, xr, y, t) { return { k: 'sr', id: id, xl: xl, xr: xr, y: y, t: t }; }
  function Tx(x, y, s, size, col) { return { k: 'txt', x: x, y: y, s: s, size: size, col: col }; }
  var COL = { d: '#e8820c', i: '#1e5bd7', u: '#1e5bd7', b: '#16a34a', s: '#db2777', e: '#a16207', n: '#6b7280' };
  function col(t) { return COL[t.charAt(0)] || '#555'; }
  function wid(t) { return t.charAt(1) === 'a' ? 5 : t.charAt(0) === 'e' ? 4 : 2.5; }
  function midOf(p) {
    var segs = [], L = 0, i;
    for (i = 0; i + 3 < p.length; i += 2) { var l = Math.abs(p[i + 2] - p[i]) + Math.abs(p[i + 3] - p[i + 1]); segs.push(l); L += l; }
    var h = L / 2;
    for (i = 0; i < segs.length; i++) { if (h <= segs[i]) { var k = segs[i] ? h / segs[i] : 0; return [p[i * 2] + (p[i * 2 + 2] - p[i * 2]) * k, p[i * 2 + 1] + (p[i * 2 + 3] - p[i * 2 + 1]) * k]; } h -= segs[i]; }
    return [p[0], p[1]];
  }
  function bubble(x, y, s) { s = String(s); var w = Math.max(18, s.length * 7 + 8); return '<g class="bub"><rect x="' + (x - w / 2) + '" y="' + (y - 19) + '" width="' + w + '" height="15" rx="4"/><text x="' + x + '" y="' + (y - 8) + '" text-anchor="middle">' + esc(s) + '</text></g>'; }
  function txtLines(x, cy, s, extra) {
    var ls = String(s).split('\n'), h = '';
    ls.forEach(function (ln, i) { h += '<text x="' + x + '" y="' + (cy + 4 + (i - (ls.length - 1) / 2) * 14) + '" text-anchor="middle"' + (extra || '') + '>' + esc(ln) + '</text>'; });
    return h;
  }
  function render(q, v, hl) {
    v = v || {}; hl = hl || [];
    var H = function (id) { return hl.indexOf(id) >= 0 ? ' class="hl"' : ''; };
    var S = '', W = '', T = '', N = '', X = '', B = '';
    q.dg.forEach(function (it) {
      if (it.k === 'loop') {
        S += '<g' + H(it.id) + '><rect x="' + it.x + '" y="' + it.y + '" width="' + it.w + '" height="' + it.h + '" fill="none" stroke="#6b6b6b" stroke-width="6" rx="3"/></g>';
        if (it.kind === 'for') S += '<rect x="' + (it.x + 6) + '" y="' + (it.y + 6) + '" width="22" height="18" fill="#fff" stroke="#1e5bd7" stroke-width="2"/><text x="' + (it.x + 17) + '" y="' + (it.y + 19) + '" text-anchor="middle">N</text>';
        else S += '<circle cx="' + (it.x + it.w - 18) + '" cy="' + (it.y + it.h - 16) + '" r="9" fill="#dc2626" stroke="#7f1d1d" stroke-width="2"/><rect x="' + (it.x + it.w - 21) + '" y="' + (it.y + it.h - 19) + '" width="6" height="6" fill="#fff"/>';
        S += '<rect x="' + (it.x + 6) + '" y="' + (it.y + it.h - 26) + '" width="20" height="18" fill="#fff" stroke="#1e5bd7" stroke-width="2"/><text x="' + (it.x + 16) + '" y="' + (it.y + it.h - 13) + '" text-anchor="middle">i</text>';
        S += '<text x="' + (it.x + it.w - 4) + '" y="' + (it.y - 5) + '" text-anchor="end" style="font-size:10px;fill:#6b6b6b">' + (it.kind === 'for' ? 'For Loop' : 'While Loop') + '</text>';
      } else if (it.k === 'case') {
        S += '<g' + H(it.id) + '><rect x="' + it.x + '" y="' + it.y + '" width="' + it.w + '" height="' + it.h + '" fill="none" stroke="#6b6b6b" stroke-width="5"/></g>' +
          '<rect x="' + (it.x + it.w / 2 - 80) + '" y="' + (it.y - 10) + '" width="160" height="20" fill="#ececec" stroke="#6b6b6b"/><text x="' + (it.x + it.w / 2) + '" y="' + (it.y + 4) + '" text-anchor="middle">' + esc(it.label) + '</text>' +
          '<rect x="' + (it.x - 6) + '" y="' + (it.y + it.h / 2 - 9) + '" width="12" height="18" fill="#fff" stroke="#1e5bd7" stroke-width="2"/><text x="' + it.x + '" y="' + (it.y + it.h / 2 + 4) + '" text-anchor="middle">?</text>';
      } else if (it.k === 'seq') {
        S += '<g' + H(it.id) + '><rect x="' + it.x + '" y="' + it.y + '" width="' + it.w + '" height="' + it.h + '" fill="none" stroke="#8b5e3c" stroke-width="7" stroke-dasharray="6 3"/></g>';
        for (var f = 1; f < it.n; f++) { var fx = it.x + it.w * f / it.n; S += '<line x1="' + fx + '" y1="' + it.y + '" x2="' + fx + '" y2="' + (it.y + it.h) + '" stroke="#8b5e3c" stroke-width="5" stroke-dasharray="6 3"/>'; }
      } else if (it.k === 'wire') {
        var pts = []; for (var i = 0; i < it.p.length; i += 2) pts.push(it.p[i] + ',' + it.p[i + 1]);
        W += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + col(it.t) + '" stroke-width="' + wid(it.t) + '"/>';
        if (v.hasOwnProperty(it.id)) { var m = midOf(it.p); B += bubble(m[0], m[1], v[it.id]); }
      } else if (it.k === 'tun') {
        T += '<rect x="' + (it.x - 5) + '" y="' + (it.y - 6) + '" width="10" height="12" fill="' + (it.idx ? '#fff' : col(it.t)) + '" stroke="' + col(it.t) + '" stroke-width="2"/>' + (it.idx ? '<text x="' + it.x + '" y="' + (it.y + 4) + '" text-anchor="middle" style="font-size:9px;fill:' + col(it.t) + '">[]</text>' : '');
      } else if (it.k === 'sr') {
        T += '<rect x="' + (it.xl - 7) + '" y="' + (it.y - 9) + '" width="14" height="18" fill="#fff" stroke="' + col(it.t) + '" stroke-width="2"/><text x="' + it.xl + '" y="' + (it.y + 4) + '" text-anchor="middle" style="font-size:10px;fill:' + col(it.t) + '">▼</text>' +
          '<rect x="' + (it.xr - 7) + '" y="' + (it.y - 9) + '" width="14" height="18" fill="#fff" stroke="' + col(it.t) + '" stroke-width="2"/><text x="' + it.xr + '" y="' + (it.y + 4) + '" text-anchor="middle" style="font-size:10px;fill:' + col(it.t) + '">▲</text>';
        if (v.hasOwnProperty(it.id)) B += bubble(it.xl, it.y - 10, 'SR=' + v[it.id]);
      } else if (it.k === 'node') {
        var c = col(it.t), arr = it.t.charAt(1) === 'a', st;
        if (it.role === 'f') st = 'fill="#fff7d6" stroke="#c58b00" stroke-width="2"';
        else if (it.role === 's') st = 'fill="#e0ecff" stroke="#1e40af" stroke-width="2"';
        else if (it.role === 'lv') st = 'fill="#fff" stroke="' + c + '" stroke-width="2" stroke-dasharray="4 2"';
        else st = 'fill="#fff" stroke="' + c + '" stroke-width="' + (it.role === 'k' ? 1.5 : it.role === 'i' ? 3.5 : 2.5) + (arr && it.role !== 'k' ? '" stroke-dasharray="0' : '') + '"';
        N += '<g' + H(it.id) + '><rect x="' + it.x + '" y="' + it.y + '" width="' + it.w + '" height="' + it.h + '" rx="' + (it.role === 'f' || it.role === 's' ? 3 : 2) + '" ' + st + '/>';
        var tx = it.role === 'i' ? (v.hasOwnProperty('#' + it.id) ? v['#' + it.id] : '') : it.txt;
        var fs = Math.min(12, Math.floor((it.w - 4) / (Math.max(1, String(tx).length) * 0.62)));
        N += txtLines(it.x + it.w / 2, it.y + it.h / 2, tx, it.role === 'f' ? ' style="font-weight:700;fill:#6b4b00"' : it.role === 'i' ? ' style="font-weight:700;font-size:' + fs + 'px"' : it.role === 'k' || it.role === 'c' ? ' style="fill:' + (it.t.charAt(0) === 's' ? '#9d174d' : '#222') + '"' : '');
        if (it.lab) N += '<text x="' + (it.x + it.w / 2) + '" y="' + (it.y - 4) + '" text-anchor="middle" style="font-size:11px;fill:#444">' + esc(it.lab) + '</text>';
        N += '</g>';
      } else if (it.k === 'txt') {
        X += '<text x="' + it.x + '" y="' + it.y + '" style="font-size:' + (it.size || 11) + 'px;fill:' + (it.col || '#444') + '">' + esc(it.s) + '</text>';
      }
    });
    return S + W + T + N + X + B;
  }

  /* ---------- 共用的迴圈骨架：框 x 120～330、y 20～190 ---------- */
  var LX = 120, LY = 20, LW = 210, LH = 170, IX = 146, IY = 175;   // i 端子輸出點
  function iters(n, fn) { var a = []; for (var i = 0; i < n; i++) a.push(fn(i)); return a; }

  /* ================= 題庫 ================= */
  var TOPICS = { loop: 'For／While 迴圈與通道', sr: 'Shift Register', cs: 'Case 結構', arr: '陣列函式', str: '字串函式', num: '數值轉換與捨入', bool: '布林與比較', err: '錯誤叢集', lv: 'Local Variable', seq: 'Sequence 與資料流' };
  var Q = [];

  /* ---- 迴圈與通道 ---- */
  Q.push({ id: 'loop-autoidx-n', topic: 'loop',
    q: 'N 接 10，輸入陣列 [3, 6, 9, 12] 用自動索引通道接進 For Loop。執行後「結果」顯示什麼？',
    opts: ['[4, 7, 10, 13]', '[4, 7, 10, 13, 1, 1, 1, 1, 1, 1]', '[13]', '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]'], a: 0,
    ex: 'N 和自動索引的陣列同時存在時，圈數取較小的那個：min(10, 4) = 4 圈。每圈取一個元素加 1，輸出的自動索引通道把 4 個結果組成陣列。',
    dg: [Lp('L0', LX, LY, LW, LH, 'for'), Nd('k10', 'k', 'i', 70, 26, 34, 20, '10'), Wr('wn', 'i', [104, 36, 126, 36]),
      Nd('arr', 'k', 'ia', 4, 92, 84, 24, '[3,6,9,12]'), Wr('wa', 'ia', [88, 104, 120, 104]), Tn('ta', 120, 104, 'ia', true), Wr('wx', 'i', [125, 104, 210, 104]),
      Nd('k1', 'k', 'i', 160, 138, 24, 20, '1'), Wr('w1', 'i', [184, 148, 196, 148, 196, 120, 210, 120]), Nd('add', 'f', 'i', 210, 92, 34, 36, '+'),
      Wr('wr', 'i', [244, 110, 330, 110]), Tn('tr', 330, 110, 'ia', true), Wr('wo', 'ia', [335, 110, 352, 110]), Nd('res', 'i', 'ia', 352, 98, 64, 24, '', '結果')],
    steps: [{ t: 'N 是 10，可是自動索引的陣列只有 4 個元素。兩者都有時取較小的：這個迴圈只跑 4 圈。', v: { wn: 10, wa: '[3,6,9,12]' }, hl: ['L0'] }]
      .concat(iters(4, function (i) { var x = [3, 6, 9, 12][i]; return { t: '第 i = ' + i + ' 圈：通道取出第 ' + i + ' 個元素 ' + x + '，加 1 得到 ' + (x + 1) + '。', v: { wx: x, w1: 1, wr: x + 1 }, hl: ['add'] }; }))
      .concat([{ t: '迴圈結束，輸出的自動索引通道把每一圈的結果排成陣列。', v: { wo: '[4,7,10,13]', '#res': '[4,7,10,13]' }, hl: ['res'] }]),
    calc: function () { var a = [3, 6, 9, 12], n = Math.min(10, a.length), r = []; for (var i = 0; i < n; i++) r.push(a[i] + 1); return A(r); } });

  Q.push({ id: 'loop-while-ge', topic: 'loop',
    q: 'While Loop 的條件端子是 Stop if True，接「i ≥ 3」。這個迴圈跑幾圈？',
    opts: ['4 圈', '3 圈', '5 圈', '停不下來'], a: 0,
    ex: 'While Loop 先執行裡面的程式，每圈最後才看條件。i = 0、1、2 時 i ≥ 3 是 False，繼續；i = 3 那圈結束時是 True，停。i 從 0 到 3，共 4 圈。',
    dg: [Lp('L0', LX, LY, LW, LH, 'while'), Wr('wi', 'i', [IX, IY, 180, IY, 180, 123, 220, 123]), Nd('k3', 'k', 'i', 186, 148, 24, 20, '3'), Wr('w3', 'i', [210, 158, 214, 158, 214, 137, 220, 137]),
      Nd('ge', 'f', 'i', 220, 110, 40, 40, '≥'), Wr('wb', 'b', [260, 130, 290, 130, 290, 174, 303, 174])],
    steps: iters(4, function (i) { return { t: '第 ' + (i + 1) + ' 圈（i = ' + i + '）：' + i + ' ≥ 3 是 ' + (i >= 3 ? 'True → 這圈結束後停止' : 'False → 繼續下一圈'), v: { wi: i, w3: 3, wb: i >= 3 ? 'T' : 'F' }, hl: ['ge'] }; })
      .concat([{ t: '共跑了 4 圈（i = 0、1、2、3）。i 從 0 開始，條件在每圈的最後才檢查。', v: {}, hl: ['L0'] }]),
    calc: function () { var i = 0, n = 0, stop; do { n++; stop = i >= 3; i++; } while (!stop); return n + ' 圈'; } });

  Q.push({ id: 'loop-idx-out', topic: 'loop',
    q: 'For Loop 的 N 接 3，迴圈裡把 i × 2 接到<b>自動索引</b>的輸出通道。執行後「結果」顯示什麼？',
    opts: ['[0, 2, 4]', '[2, 4, 6]', '[0, 2, 4, 6]', '4'], a: 0,
    ex: 'i 從 0 開始到 N − 1：0、1、2。每圈的 i × 2 是 0、2、4，自動索引通道把它們組成陣列。',
    dg: [Lp('L0', LX, LY, LW, LH, 'for'), Nd('k3', 'k', 'i', 70, 26, 34, 20, '3'), Wr('wn', 'i', [104, 36, 126, 36]),
      Wr('wi', 'i', [IX, IY, 196, IY, 196, 120, 210, 120]), Nd('k2', 'k', 'i', 160, 86, 24, 20, '2'), Wr('w2', 'i', [184, 96, 196, 96, 196, 104, 210, 104]),
      Nd('mul', 'f', 'i', 210, 92, 34, 36, '×'), Wr('wr', 'i', [244, 110, 330, 110]), Tn('tr', 330, 110, 'ia', true), Wr('wo', 'ia', [335, 110, 352, 110]), Nd('res', 'i', 'ia', 352, 98, 64, 24, '', '結果')],
    steps: [{ t: 'N = 3，所以 i 依序是 0、1、2。', v: { wn: 3 }, hl: ['L0'] }]
      .concat(iters(3, function (i) { return { t: 'i = ' + i + '：' + i + ' × 2 = ' + i * 2, v: { wi: i, w2: 2, wr: i * 2 }, hl: ['mul'] }; }))
      .concat([{ t: '迴圈結束，自動索引通道輸出 [0, 2, 4]。', v: { wo: '[0,2,4]', '#res': '[0,2,4]' }, hl: ['res'] }]),
    calc: function () { return A(iters(3, function (i) { return i * 2; })); } });

  Q.push({ id: 'loop-last-out', topic: 'loop',
    q: 'For Loop 的 N 接 4，迴圈裡把 i + 10 接到<b>一般（非索引）</b>的輸出通道。執行後「結果」顯示什麼？',
    opts: ['13', '14', '10', '[10, 11, 12, 13]'], a: 0,
    ex: '一般的輸出通道只送出最後一圈的值。最後一圈 i = 3，3 + 10 = 13。',
    dg: [Lp('L0', LX, LY, LW, LH, 'for'), Nd('k4', 'k', 'i', 70, 26, 34, 20, '4'), Wr('wn', 'i', [104, 36, 126, 36]),
      Wr('wi', 'i', [IX, IY, 196, IY, 196, 120, 210, 120]), Nd('k10', 'k', 'i', 156, 86, 30, 20, '10'), Wr('w2', 'i', [186, 96, 196, 96, 196, 104, 210, 104]),
      Nd('add', 'f', 'i', 210, 92, 34, 36, '+'), Wr('wr', 'i', [244, 110, 330, 110]), Tn('tr', 330, 110, 'i', false), Wr('wo', 'i', [335, 110, 352, 110]), Nd('res', 'i', 'i', 352, 98, 54, 24, '', '結果')],
    steps: [{ t: 'N = 4，i = 0～3。', v: { wn: 4 }, hl: ['L0'] }]
      .concat(iters(4, function (i) { return { t: 'i = ' + i + '：' + i + ' + 10 = ' + (i + 10) + '（通道只記住最新的）', v: { wi: i, w2: 10, wr: i + 10 }, hl: ['add'] }; }))
      .concat([{ t: '迴圈結束，一般通道送出最後一圈的 13。', v: { wo: 13, '#res': 13 }, hl: ['res'] }]),
    calc: function () { var r; for (var i = 0; i < 4; i++) r = i + 10; return String(r); } });

  /* ---- Shift Register ---- */
  function srDg(N, init, op, opK, lab) {
    var d = [Lp('L0', LX, LY, LW, LH, 'for'), Nd('kN', 'k', 'i', 70, 26, 34, 20, String(N)), Wr('wn', 'i', [104, 36, 126, 36]), Sr('S0', 120, 330, 104, 'i')];
    if (init != null) d.push(Nd('k0', 'k', 'i', 60, 94, 30, 20, String(init)), Wr('w0', 'i', [90, 104, 113, 104]));
    d.push(Wr('wsl', 'i', [127, 104, 210, 104]), Nd('op', 'f', 'i', 210, 92, 34, 36, op), Wr('wsum', 'i', [244, 110, 300, 110, 300, 104, 323, 104]), Wr('wout', 'i', [337, 104, 356, 104]), Nd('res', 'i', 'i', 356, 92, 54, 24, '', lab));
    if (opK === 'i') d.push(Wr('wi', 'i', [IX, IY, 196, IY, 196, 120, 210, 120]));
    else d.push(Nd('kk', 'k', 'i', 160, 140, 24, 20, String(opK)), Wr('wk', 'i', [184, 150, 196, 150, 196, 120, 210, 120]));
    return d;
  }
  Q.push({ id: 'sr-sum', topic: 'sr',
    q: 'Shift Register 初始化為 0，每圈加上 i，For Loop 跑 4 圈。執行後「總和」顯示什麼？',
    opts: ['6', '10', '4', '0'], a: 0,
    ex: 'i 是 0、1、2、3：0 + 0 + 1 + 2 + 3 = 6。容易選 10 的原因是把 i 當成從 1 開始。',
    dg: srDg(4, 0, '+', 'i', '總和'),
    steps: [{ t: '迴圈開始前，左邊的 Shift Register 拿到初始值 0。', v: { w0: 0, S0: 0, wn: 4 }, hl: ['L0'] }]
      .concat(iters(4, function (i) { var s = i * (i - 1) / 2; return { t: 'i = ' + i + '：SR 裡的 ' + s + ' + ' + i + ' = ' + (s + i) + '，存回右邊的 Shift Register，下一圈從左邊出來。', v: { wsl: s, wi: i, wsum: s + i, S0: s + i }, hl: ['op'] }; }))
      .concat([{ t: '迴圈結束，右邊 Shift Register 的最後值 6 送出去。', v: { wout: 6, '#res': 6 }, hl: ['res'] }]),
    calc: function () { var s = 0; for (var i = 0; i < 4; i++) s += i; return String(s); } });

  Q.push({ id: 'sr-uninit', topic: 'sr',
    q: '<b>沒有接初始值</b>的 Shift Register，每圈加 1，For Loop 跑 3 圈。VI 開著不關、連續按兩次執行。<b>第二次</b>執行完「計數」顯示什麼？',
    opts: ['6', '3', '0', '4'], a: 0,
    ex: '沒接初始值的 Shift Register 會記住上次執行結束時的值（VI 留在記憶體裡的期間）。第一次從預設值 0 開始，跑完是 3；第二次從 3 開始，再加 3 次變 6。',
    dg: srDg(3, null, '+', 1, '計數'),
    steps: [{ t: '第一次執行：沒有初始值，Shift Register 從 I32 的預設值 0 開始。', v: { S0: 0, wn: 3 }, hl: ['L0'] }]
      .concat(iters(3, function (i) { return { t: '第一次、i = ' + i + '：' + i + ' + 1 = ' + (i + 1), v: { wsl: i, wk: 1, wsum: i + 1, S0: i + 1 }, hl: ['op'] }; }))
      .concat([{ t: '第一次結束：計數 = 3。Shift Register 沒被初始化，3 留在裡面。', v: { wout: 3, '#res': 3, S0: 3 }, hl: ['res'] }])
      .concat(iters(3, function (i) { return { t: '第二次、i = ' + i + '：從上次留下的值繼續，' + (3 + i) + ' + 1 = ' + (4 + i), v: { wsl: 3 + i, wk: 1, wsum: 4 + i, S0: 4 + i, '#res': 3 }, hl: ['op'] }; }))
      .concat([{ t: '第二次結束：計數 = 6。要每次都從 0 開始，就把常數 0 接到左邊的 Shift Register。', v: { wout: 6, '#res': 6, S0: 6 }, hl: ['res'] }]),
    calc: function () { var s = 0, run, i; for (run = 0; run < 2; run++) for (i = 0; i < 3; i++) s += 1; return String(s); } });

  Q.push({ id: 'sr-double', topic: 'sr',
    q: 'Shift Register 初始化為 1，每圈乘以 2，For Loop 跑 5 圈。執行後「結果」顯示什麼？',
    opts: ['32', '16', '64', '10'], a: 0,
    ex: '1 → 2 → 4 → 8 → 16 → 32，乘了 5 次 2，等於 2 的 5 次方。',
    dg: srDg(5, 1, '×', 2, '結果'),
    steps: [{ t: '初始值 1 進入 Shift Register。', v: { w0: 1, S0: 1, wn: 5 }, hl: ['L0'] }]
      .concat(iters(5, function (i) { var s = Math.pow(2, i); return { t: 'i = ' + i + '：' + s + ' × 2 = ' + s * 2, v: { wsl: s, wk: 2, wsum: s * 2, S0: s * 2 }, hl: ['op'] }; }))
      .concat([{ t: '5 圈後是 32。', v: { wout: 32, '#res': 32 }, hl: ['res'] }]),
    calc: function () { var s = 1; for (var i = 0; i < 5; i++) s *= 2; return String(s); } });

  /* ---- Case ---- */
  function caseDg(t, val, lab, header, lines, outLab) {
    var d = [Cs('C0', 140, 40, 200, 140, header), Nd('sel', 'c', t, 10, 98, 64, 24, val, lab), Wr('ws', t, [74, 110, 134, 110])];
    lines.forEach(function (ln, i) { d.push(Tx(160, 74 + i * 26, ln, 12, '#333')); });
    d.push(Tn('to', 340, 110, 's', false), Wr('wo', 's', [345, 110, 356, 110]), Nd('res', 'i', 's', 356, 98, 58, 24, '', outLab));
    return d;
  }
  Q.push({ id: 'case-default', topic: 'cs',
    q: '整數「狀態」= 3 接到 Case 選擇器。Case 有三頁：「0」輸出「停止」、「1, 2」輸出「運轉」、「Default」輸出「異常」。「文字」顯示什麼？',
    opts: ['"異常"', '"運轉"', '"停止"', '空字串'], a: 0,
    ex: '3 不在 0、1、2 裡，沒有對到任何一頁，就走 Default。',
    dg: caseDg('i', '3', '狀態', '頁：0｜1, 2｜Default', ['0 → "停止"', '1, 2 → "運轉"', 'Default → "異常"'], '文字'),
    steps: [{ t: '選擇器收到 3。', v: { ws: 3 }, hl: ['C0'] }, { t: '依序比對頁籤：0 不符、1, 2 不符 → 走 Default。', v: { ws: 3 }, hl: ['C0'] }, { t: 'Default 頁輸出「異常」。', v: { ws: 3, wo: '異常', '#res': '異常' }, hl: ['res'] }],
    calc: function () { var s = 3; return s === 0 ? '"停止"' : s === 1 || s === 2 ? '"運轉"' : '"異常"'; } });

  Q.push({ id: 'case-dbl', topic: 'cs',
    q: 'DBL 控制元件的值 2.6 接到 Case 選擇器（選擇器出現轉型點）。頁：「2」輸出「B」、「3」輸出「C」、「Default」輸出「?」。「文字」顯示什麼？',
    opts: ['"C"', '"B"', '"?"', 'VI 不能執行'], a: 0,
    ex: '浮點數接到 Case 選擇器時，先捨入成最接近的整數：2.6 → 3，所以走「3」那一頁。',
    dg: caseDg('d', '2.6', '值', '頁：2｜3｜Default', ['2 → "B"', '3 → "C"', 'Default → "?"'], '文字'),
    steps: [{ t: '選擇器收到 DBL 2.6，先捨入成整數 3。', v: { ws: '2.6→3' }, hl: ['C0'] }, { t: '3 對到「3」那一頁，輸出「C」。', v: { ws: '2.6→3', wo: 'C', '#res': 'C' }, hl: ['res'] }],
    calc: function () { var s = roundEven(2.6); return s === 2 ? '"B"' : s === 3 ? '"C"' : '"?"'; } });

  Q.push({ id: 'case-str', topic: 'cs',
    q: '字串「Stop」接到 Case 選擇器。頁：「"stop"」輸出「停止」、「Default」輸出「繼續」。Case 沒有勾選不分大小寫。「文字」顯示什麼？',
    opts: ['"繼續"', '"停止"', '空字串', 'VI 不能執行'], a: 0,
    ex: '字串選擇器預設<b>分大小寫</b>：「Stop」和「stop」不一樣，對不到就走 Default。',
    dg: caseDg('s', 'Stop', '命令', '頁："stop"｜Default', ['"stop" → "停止"', 'Default → "繼續"'], '文字'),
    steps: [{ t: '選擇器收到字串「Stop」。', v: { ws: 'Stop' }, hl: ['C0'] }, { t: '「Stop」≠「stop」（大寫 S 不同），走 Default，輸出「繼續」。', v: { ws: 'Stop', wo: '繼續', '#res': '繼續' }, hl: ['res'] }],
    calc: function () { return 'Stop' === 'stop' ? '"停止"' : '"繼續"'; } });

  /* ---- 陣列函式 ---- */
  function fnDg(ins, fn, out) {   // ins: [[id,t,txt,lab]], fn: [txt, w, h], out: [t, lab]
    var d = [], n = ins.length, fy = 105 - fn[2] / 2;
    ins.forEach(function (x, i) {
      var y = 40 + i * (130 / Math.max(1, n - 1 || 1)) - (n === 1 ? -65 : 0), ty = fy + fn[2] * (i + 1) / (n + 1);
      d.push(Nd(x[0], x[4] || 'k', x[1], 10, y - 12, x[5] || 90, 24, x[2], x[3]));
      d.push(Wr('w' + x[0], x[1], [10 + (x[5] || 90), y, 150, y, 150, ty, 200, ty]));
    });
    d.push(Nd('fn', 'f', 'n', 200, fy, fn[1], fn[2], fn[0]));
    d.push(Wr('wo', out[0], [200 + fn[1], 105, 330, 105]), Nd('res', 'i', out[0], 330, 93, 84, 24, '', out[1]));
    return d;
  }
  function fnSteps(inV, fnTxt, outV) { return [{ t: '輸入同時到齊。', v: inV, hl: ['fn'] }, { t: fnTxt, v: Object.assign({ wo: outV, '#res': outV }, inV), hl: ['fn', 'res'] }]; }
  Q.push({ id: 'arr-index', topic: 'arr',
    q: 'Index Array：陣列 [10, 20, 30, 40]，index 接 2。輸出顯示什麼？',
    opts: ['30', '20', '40', '[30]'], a: 0,
    ex: '索引從 0 開始：第 0 個是 10、第 1 個是 20、第 2 個是 30。',
    dg: fnDg([['a', 'ia', '[10,20,30,40]', '陣列'], ['ix', 'i', '2', 'index']], ['Index\nArray', 70, 60], ['i', '元素']),
    steps: fnSteps({ wa: '[10,20,30,40]', wix: 2 }, '索引 2（從 0 數）是 30。', 30),
    calc: function () { return String([10, 20, 30, 40][2]); } });
  Q.push({ id: 'arr-build', topic: 'arr',
    q: 'Build Array 上面接陣列 [1, 2]、下面接數值 3。輸出顯示什麼？',
    opts: ['[1, 2, 3]', '[3, 1, 2]', '[1, 2]', '[[1, 2], [3]]'], a: 0,
    ex: '一維陣列和一個元素接進 Build Array，元素會接到陣列後面，輸出還是一維陣列。輸入由上到下就是排列順序。',
    dg: fnDg([['a', 'ia', '[1,2]', '陣列'], ['e', 'i', '3', '元素']], ['Build\nArray', 60, 60], ['ia', '輸出']),
    steps: fnSteps({ wa: '[1,2]', we: 3 }, '上面的陣列在前、下面的 3 接在後面：[1, 2, 3]。', '[1,2,3]'),
    calc: function () { return A([1, 2].concat([3])); } });
  Q.push({ id: 'arr-delete', topic: 'arr',
    q: 'Delete From Array：陣列 [5, 6, 7, 8]，index 1，length 1。「array w/ subset deleted」輸出什麼？',
    opts: ['[5, 7, 8]', '[6]', '[5, 6, 8]', '[6, 7, 8]'], a: 0,
    ex: '從索引 1 開始刪 1 個，刪掉的是 6，剩下 [5, 7, 8]。被刪的 [6] 從另一個輸出「deleted portion」出來。',
    dg: fnDg([['a', 'ia', '[5,6,7,8]', '陣列'], ['ix', 'i', '1', 'index'], ['ln', 'i', '1', 'length']], ['Delete\nFrom\nArray', 64, 70], ['ia', '剩下的陣列']),
    steps: fnSteps({ wa: '[5,6,7,8]', wix: 1, wln: 1 }, '從第 1 個（6）開始刪 1 個：剩 [5, 7, 8]。', '[5,7,8]'),
    calc: function () { var a = [5, 6, 7, 8]; a.splice(1, 1); return A(a); } });
  Q.push({ id: 'arr-subset', topic: 'arr',
    q: 'Array Subset：陣列 [10, 20, 30, 40, 50]，index 1，length 3。輸出什麼？',
    opts: ['[20, 30, 40]', '[10, 20, 30]', '[20, 30, 40, 50]', '[30, 40, 50]'], a: 0,
    ex: '從索引 1（20）開始取 3 個：20、30、40。',
    dg: fnDg([['a', 'ia', '[10,...,50]', '陣列'], ['ix', 'i', '1', 'index'], ['ln', 'i', '3', 'length']], ['Array\nSubset', 64, 70], ['ia', '子陣列']),
    steps: fnSteps({ wa: '[10,20,30,40,50]', wix: 1, wln: 3 }, '從第 1 個開始拿 3 個：[20, 30, 40]。', '[20,30,40]'),
    calc: function () { return A([10, 20, 30, 40, 50].slice(1, 1 + 3)); } });
  Q.push({ id: 'arr-index-oor', topic: 'arr',
    q: 'Index Array：I32 陣列 [1, 2, 3]，index 接 5（超出範圍）。輸出顯示什麼？',
    opts: ['0', '3', '錯誤，VI 停止', '1'], a: 0,
    ex: '索引超出範圍時，Index Array 不會出錯，而是輸出該元素型別的預設值，數值就是 0。',
    dg: fnDg([['a', 'ia', '[1,2,3]', '陣列'], ['ix', 'i', '5', 'index']], ['Index\nArray', 70, 60], ['i', '元素']),
    steps: fnSteps({ wa: '[1,2,3]', wix: 5 }, '陣列只有索引 0～2，5 超出範圍 → 輸出 I32 的預設值 0。', 0),
    calc: function () { var a = [1, 2, 3], v = a[5]; return String(v === undefined ? 0 : v); } });

  /* ---- 字串 ---- */
  Q.push({ id: 'str-concat', topic: 'str',
    q: '字串常數「D」和 Number To Decimal String(100) 依序接到 Concatenate Strings。輸出什麼？',
    opts: ['"D100"', '"D 100"', '"100D"', '"D100.000000"'], a: 0,
    ex: 'Number To Decimal String 把整數 100 變成「100」，不加空白、不帶小數。Concatenate Strings 依輸入由上到下直接相接：「D」+「100」。',
    dg: [Nd('d', 'k', 's', 10, 40, 40, 24, 'D'), Nd('n', 'k', 'i', 10, 120, 44, 24, '100'), Nd('cv', 'f', 'n', 90, 110, 80, 44, 'Num To\nDec Str'),
      Wr('wn', 'i', [54, 132, 90, 132]), Wr('wd', 's', [50, 52, 220, 52, 220, 92, 240, 92]), Wr('wc', 's', [170, 132, 220, 132, 220, 112, 240, 112]),
      Nd('cat', 'f', 'n', 240, 80, 60, 44, 'Concat'), Wr('wo', 's', [300, 102, 330, 102]), Nd('res', 'i', 's', 330, 90, 84, 24, '', '字串')],
    steps: [{ t: '100 經過 Number To Decimal String 變成字串「100」。', v: { wn: 100, wc: '100' }, hl: ['cv'] }, { t: 'Concatenate：上面的「D」在前、下面的「100」在後。', v: { wd: 'D', wc: '100', wo: 'D100', '#res': 'D100' }, hl: ['cat', 'res'] }],
    calc: function () { return '"' + 'D' + String(100) + '"'; } });
  Q.push({ id: 'str-len', topic: 'str',
    q: 'String Length 接字串常數「LabVIEW」。輸出什麼？',
    opts: ['7', '6', '8', '"LabVIEW"'], a: 0,
    ex: 'L、a、b、V、I、E、W，共 7 個字元。',
    dg: fnDg([['s', 's', 'LabVIEW', '字串']], ['String\nLength', 64, 50], ['i', 'length']),
    steps: fnSteps({ ws: 'LabVIEW' }, '數字元：7 個。', 7),
    calc: function () { return String('LabVIEW'.length); } });
  Q.push({ id: 'str-subset', topic: 'str',
    q: 'String Subset：字串「ABCDEFG」，offset 2，length 3。輸出什麼？',
    opts: ['"CDE"', '"BCD"', '"BC"', '"CDEFG"'], a: 0,
    ex: 'offset 從 0 算：A 是 0、B 是 1、C 是 2。從 C 開始拿 3 個字元：CDE。',
    dg: fnDg([['s', 's', 'ABCDEFG', '字串'], ['of', 'i', '2', 'offset'], ['ln', 'i', '3', 'length']], ['String\nSubset', 64, 70], ['s', 'substring']),
    steps: fnSteps({ ws: 'ABCDEFG', wof: 2, wln: 3 }, 'offset 2 是 C，拿 3 個字元：CDE。', 'CDE'),
    calc: function () { return '"' + 'ABCDEFG'.substr(2, 3) + '"'; } });

  /* ---- 數值 ---- */
  Q.push({ id: 'num-round', topic: 'num',
    q: 'Round To Nearest 接 DBL 常數 2.5。輸出什麼？',
    opts: ['2', '3', '2.5', '0'], a: 0,
    ex: '剛好 .5 時捨入到偶數（銀行家捨入）：2.5 → 2、3.5 → 4。不是四捨五入。',
    dg: fnDg([['x', 'd', '2.5', 'x']], ['Round To\nNearest', 76, 50], ['d', '結果']),
    steps: fnSteps({ wx: 2.5 }, '2.5 離 2 和 3 一樣近 → 選偶數 2。', 2),
    calc: function () { return String(roundEven(2.5)); } });
  Q.push({ id: 'num-qr', topic: 'num',
    q: 'Quotient &amp; Remainder：x = 17、y = 5。「x-y*floor(x/y)」（餘數）輸出什麼？',
    opts: ['2', '3', '3.4', '5'], a: 0,
    ex: 'floor(17 / 5) = 3，17 − 5 × 3 = 2。3 是另一個輸出（商）。',
    dg: fnDg([['x', 'i', '17', 'x'], ['y', 'i', '5', 'y']], ['Quotient\n& Rem', 70, 60], ['i', '餘數']),
    steps: fnSteps({ wx: 17, wy: 5 }, '17 ÷ 5 = 3 餘 2，餘數輸出 2。', 2),
    calc: function () { var x = 17, y = 5; return String(x - y * Math.floor(x / y)); } });
  Q.push({ id: 'num-u8', topic: 'num',
    q: '兩個 U8 常數 255 和 1 接到 Add，輸出也是 U8。輸出什麼？',
    opts: ['0', '256', '255', '錯誤，VI 停止'], a: 0,
    ex: 'U8 只能放 0～255。255 + 1 超過上限就繞回 0，不會出錯。',
    dg: fnDg([['x', 'u', '255 (U8)', 'x'], ['y', 'u', '1 (U8)', 'y']], ['+', 40, 50], ['u', 'U8 結果']),
    steps: fnSteps({ wx: 255, wy: 1 }, '255 + 1 = 256，超出 U8 範圍，繞回 0。', 0),
    calc: function () { return String((255 + 1) & 255); } });
  Q.push({ id: 'num-div', topic: 'num',
    q: '兩個 I32 常數 7 和 2 接到 Divide（÷）。輸出什麼？',
    opts: ['3.5', '3', '4', '3 餘 1'], a: 0,
    ex: 'Divide 的輸出一律是浮點數（DBL），所以整數相除也會得到 3.5。要整數商用 Quotient &amp; Remainder。',
    dg: fnDg([['x', 'i', '7', 'x'], ['y', 'i', '2', 'y']], ['÷', 40, 50], ['d', 'x/y']),
    steps: fnSteps({ wx: 7, wy: 2 }, 'Divide 輸出 DBL（橘色線）：7 ÷ 2 = 3.5。', 3.5),
    calc: function () { return String(7 / 2); } });

  /* ---- 布林與比較 ---- */
  Q.push({ id: 'bool-and-not', topic: 'bool',
    q: '（5 &gt; 3）AND NOT（2 = 2）。布林顯示元件顯示什麼？',
    opts: ['False', 'True', '1', 'VI 不能執行'], a: 0,
    ex: '5 > 3 是 True；2 = 2 是 True，NOT 之後變 False。True AND False = False。',
    dg: [Nd('k5', 'k', 'i', 10, 24, 30, 20, '5'), Nd('k3', 'k', 'i', 10, 56, 30, 20, '3'), Nd('gt', 'f', 'n', 80, 30, 36, 40, '>'),
      Wr('w5', 'i', [40, 34, 60, 34, 60, 43, 80, 43]), Wr('w3', 'i', [40, 66, 60, 66, 60, 57, 80, 57]),
      Nd('k2a', 'k', 'i', 10, 124, 30, 20, '2'), Nd('k2b', 'k', 'i', 10, 156, 30, 20, '2'), Nd('eq', 'f', 'n', 80, 130, 36, 40, '='),
      Wr('w2a', 'i', [40, 134, 60, 134, 60, 143, 80, 143]), Wr('w2b', 'i', [40, 166, 60, 166, 60, 157, 80, 157]),
      Nd('not', 'f', 'n', 150, 136, 40, 28, 'NOT'), Wr('weq', 'b', [116, 150, 150, 150]),
      Nd('and', 'f', 'n', 240, 80, 44, 40, 'AND'), Wr('wgt', 'b', [116, 50, 220, 50, 220, 92, 240, 92]), Wr('wnot', 'b', [190, 150, 220, 150, 220, 108, 240, 108]),
      Wr('wo', 'b', [284, 100, 330, 100]), Nd('res', 'i', 'b', 330, 88, 70, 24, '', '結果')],
    steps: [{ t: '兩個比較同時執行：5 > 3 → True；2 = 2 → True。', v: { w5: 5, w3: 3, w2a: 2, w2b: 2, wgt: 'T', weq: 'T' }, hl: ['gt', 'eq'] },
      { t: 'NOT True = False。', v: { wgt: 'T', weq: 'T', wnot: 'F' }, hl: ['not'] },
      { t: 'True AND False = False。', v: { wgt: 'T', wnot: 'F', wo: 'F', '#res': 'False' }, hl: ['and', 'res'] }],
    calc: function () { return ((5 > 3) && !(2 === 2)) ? 'True' : 'False'; } });
  Q.push({ id: 'bool-select', topic: 'bool',
    q: 'Select：s 接「7 &gt; 5」，t 接字串「高」，f 接字串「低」。輸出什麼？',
    opts: ['"高"', '"低"', 'True', '"高低"'], a: 0,
    ex: 's 是 True 就輸出 t 那一端，False 輸出 f。7 > 5 是 True → 「高」。',
    dg: [Nd('k7', 'k', 'i', 10, 70, 30, 20, '7'), Nd('k5', 'k', 'i', 10, 102, 30, 20, '5'), Nd('gt', 'f', 'n', 70, 76, 36, 40, '>'),
      Wr('w7', 'i', [40, 80, 56, 80, 56, 89, 70, 89]), Wr('w5', 'i', [40, 112, 56, 112, 56, 103, 70, 103]),
      Nd('kt', 'k', 's', 120, 24, 40, 22, '高', 't'), Nd('kf', 'k', 's', 120, 160, 40, 22, '低', 'f'),
      Nd('sel', 'f', 'n', 220, 76, 50, 60, 'Select'), Wr('wt', 's', [160, 35, 200, 35, 200, 88, 220, 88]), Wr('wb', 'b', [106, 96, 150, 96, 150, 106, 220, 106]), Wr('wf', 's', [160, 171, 200, 171, 200, 124, 220, 124]),
      Wr('wo', 's', [270, 106, 330, 106]), Nd('res', 'i', 's', 330, 94, 70, 24, '', '輸出')],
    steps: [{ t: '7 > 5 → True。', v: { w7: 7, w5: 5, wb: 'T' }, hl: ['gt'] }, { t: 'Select 的 s 是 True → 輸出 t 那一端的「高」。', v: { wb: 'T', wt: '高', wf: '低', wo: '高', '#res': '高' }, hl: ['sel', 'res'] }],
    calc: function () { return 7 > 5 ? '"高"' : '"低"'; } });
  Q.push({ id: 'bool-streq', topic: 'bool',
    q: 'Equal? 比較字串「abc」和「ABC」。輸出什麼？',
    opts: ['False', 'True', '"abc"', '0'], a: 0,
    ex: '字串比較分大小寫，a 和 A 的字元碼不同，所以不相等。',
    dg: fnDg([['x', 's', 'abc', 'x'], ['y', 's', 'ABC', 'y']], ['=', 40, 50], ['b', 'x = y?']),
    steps: fnSteps({ wx: 'abc', wy: 'ABC' }, '"abc" 和 "ABC" 字元碼不同 → False。', 'False'),
    calc: function () { return 'abc' === 'ABC' ? 'True' : 'False'; } });

  /* ---- 錯誤叢集 ---- */
  Q.push({ id: 'err-merge', topic: 'err',
    q: 'Merge Errors 由上到下接三個錯誤叢集：① 沒有錯誤、② 錯誤 code 7、③ 錯誤 code 42。輸出的 error out 的 code 是？',
    opts: ['7', '42', '0', '49'], a: 0,
    ex: 'Merge Errors 由上往下找，輸出<b>第一個</b>有錯誤（status = True）的叢集。①沒有錯，②是第一個錯誤：code 7。',
    dg: fnDg([['e1', 'e', 'no error', '①'], ['e2', 'e', 'code 7', '②'], ['e3', 'e', 'code 42', '③']], ['Merge\nErrors', 64, 70], ['e', 'error out']),
    steps: [{ t: '三個錯誤叢集同時進來。', v: { we1: 'OK', we2: '7', we3: '42' }, hl: ['fn'] }, { t: '由上往下：① 沒錯誤、② 有錯誤 → 輸出 ② 的 code 7。後面的 ③ 不看。', v: { we1: 'OK', we2: '7', we3: '42', wo: 'code 7', '#res': 'code 7' }, hl: ['fn', 'res'] }],
    calc: function () { var es = [0, 7, 42]; for (var i = 0; i < es.length; i++) if (es[i]) return String(es[i]); return '0'; } });
  Q.push({ id: 'err-chain', topic: 'err',
    q: 'Open/Create/Replace File 要打開一個不存在的檔案（operation = open），回傳錯誤 code 7。錯誤線接著經過 Read from Text File、Close File。最後 error out 的 code 是？',
    opts: ['7', '0', '每個節點各加一個錯誤', '看 Close File 有沒有成功'], a: 0,
    ex: '錯誤沿著錯誤線傳下去。Read from Text File 收到有錯的 error in 不會執行，原錯誤照傳；Close File 也把原本的錯誤傳出去。最後看到的還是 code 7，這樣才知道問題出在開檔。',
    dg: [Nd('open', 's', 'n', 10, 70, 80, 50, 'Open\nFile'), Nd('read', 's', 'n', 130, 70, 80, 50, 'Read\nText'), Nd('close', 's', 'n', 250, 70, 70, 50, 'Close\nFile'),
      Wr('we1', 'e', [90, 110, 130, 110]), Wr('we2', 'e', [210, 110, 250, 110]), Wr('wo', 'e', [320, 110, 340, 110]), Nd('res', 'i', 'e', 340, 98, 74, 24, '', 'error out'),
      Tx(10, 150, '檔案不存在', 11, '#a16207')],
    steps: [{ t: 'Open 找不到檔案，error out：status True、code 7。', v: { we1: 'code 7' }, hl: ['open'] },
      { t: 'Read from Text File 看到 error in 有錯，不讀檔，把錯誤照傳。', v: { we1: 'code 7', we2: 'code 7' }, hl: ['read'] },
      { t: 'Close File 也把原本的錯誤傳出去：code 7。', v: { we1: 'code 7', we2: 'code 7', wo: 'code 7', '#res': 'code 7' }, hl: ['close', 'res'] }],
    calc: function () { var e = 7; /* Read、Close 收到有錯的 error in：照傳原錯誤 */ return String(e); } });

  /* ---- Local Variable ---- */
  Q.push({ id: 'lv-race', topic: 'lv',
    q: '方塊圖上有兩段<b>互相沒有連線</b>的程式：一段把 5 寫進 x 的 Local Variable，另一段把 10 寫進 x 的 Local Variable。執行後 x 是多少？',
    opts: ['不一定（5 或 10）', '5', '10', '15'], a: 0,
    ex: '兩個寫入之間沒有資料流關係，誰先執行不保證，最後寫的那個贏。這就是競爭條件（race condition），結果可能每次不同。',
    dg: [Nd('k5', 'k', 'i', 40, 50, 30, 22, '5'), Nd('l1', 'lv', 'i', 140, 48, 70, 26, 'x（寫）'), Wr('w5', 'i', [70, 61, 140, 61]),
      Nd('k10', 'k', 'i', 40, 140, 30, 22, '10'), Nd('l2', 'lv', 'i', 140, 138, 70, 26, 'x（寫）'), Wr('w10', 'i', [70, 151, 140, 151]),
      Nd('x', 'i', 'i', 300, 92, 60, 26, '', 'x')],
    steps: [{ t: '兩段同時可以執行，沒有線決定先後。', v: { w5: 5, w10: 10 }, hl: ['l1', 'l2'] },
      { t: '如果先寫 5 再寫 10 → x = 10。', v: { w5: 5, w10: 10, '#x': 10 }, hl: ['l2'] },
      { t: '如果先寫 10 再寫 5 → x = 5。兩種都可能，所以答案是「不一定」。', v: { w5: 5, w10: 10, '#x': 5 }, hl: ['l1'] }],
    calc: function () { return '不一定（5 或 10）'; } });
  Q.push({ id: 'lv-chain', topic: 'lv',
    q: '顯示元件 Count 執行前顯示 3。方塊圖：讀取 Count 的 Local Variable → 加 1 → 寫入 Count 的 Local Variable。執行後 Count 顯示多少？',
    opts: ['4', '3', '1', '不一定'], a: 0,
    ex: '這裡的讀和寫之間有線（讀 → +1 → 寫），順序由資料流決定，不會亂：讀到 3，加 1，寫回 4。只有一個地方寫，就沒有競爭。',
    dg: [Nd('lr', 'lv', 'i', 20, 90, 80, 26, 'Count（讀）'), Wr('wr', 'i', [100, 103, 150, 103]), Nd('k1', 'k', 'i', 110, 140, 24, 20, '1'), Wr('w1', 'i', [134, 150, 140, 150, 140, 119, 150, 119]),
      Nd('add', 'f', 'n', 150, 90, 36, 40, '+'), Wr('wa', 'i', [186, 110, 230, 110]), Nd('lw', 'lv', 'i', 230, 97, 80, 26, 'Count（寫）'), Nd('cnt', 'i', 'i', 340, 30, 60, 24, '', 'Count')],
    steps: [{ t: '執行前 Count = 3。讀取 Local Variable 拿到 3。', v: { wr: 3, '#cnt': 3 }, hl: ['lr'] }, { t: '3 + 1 = 4。', v: { wr: 3, w1: 1, wa: 4, '#cnt': 3 }, hl: ['add'] }, { t: '寫入 Local Variable：Count 變 4。', v: { wr: 3, wa: 4, '#cnt': 4 }, hl: ['lw', 'cnt'] }],
    calc: function () { var c = 3; c = c + 1; return String(c); } });

  /* ---- Sequence 與資料流 ---- */
  Q.push({ id: 'seq-tick', topic: 'seq',
    q: 'Flat Sequence 三格：第 1 格讀 Tick Count 得到 t0，第 2 格 Wait (ms) 100，第 3 格再讀 Tick Count 得到 t1。框外 t1 − t0 顯示大約多少？',
    opts: ['約 100 ms（至少 100）', '0 ms', '不一定，可能是負數', '約 200 ms'], a: 0,
    ex: 'Flat Sequence 一格做完才做下一格，所以兩次 Tick Count 中間一定隔著 100 ms 的 Wait，結果大約是 100（可能多一點點）。',
    dg: [Sq('S0', 20, 40, 300, 110, 3), Nd('t0', 'f', 'n', 40, 75, 60, 40, 'Tick\nCount'), Nd('k100', 'k', 'i', 125, 60, 40, 20, '100'), Nd('wt', 'f', 'n', 130, 95, 60, 40, 'Wait\n(ms)'),
      Wr('w100', 'i', [145, 80, 145, 95]), Nd('t1', 'f', 'n', 240, 75, 60, 40, 'Tick\nCount'),
      Wr('wt0', 'u', [100, 95, 112, 95, 112, 170, 330, 170, 330, 120, 340, 120]), Wr('wt1', 'u', [300, 95, 340, 95]), Nd('sub', 'f', 'n', 340, 85, 30, 50, '−'), Wr('wo', 'u', [370, 110, 380, 110, 380, 160, 388, 160]), Nd('res', 'i', 'u', 350, 160, 60, 24, '', 'ms')],
    steps: [{ t: '第 1 格：讀 Tick Count，假設是 5000。', v: { wt0: 5000 }, hl: ['t0'] }, { t: '第 2 格：Wait 100 ms。第 1 格不做完，這格不會開始。', v: { wt0: 5000, w100: 100 }, hl: ['wt'] },
      { t: '第 3 格：再讀一次 Tick Count，大約 5100。', v: { wt0: 5000, wt1: 5100 }, hl: ['t1'] }, { t: 't1 − t0 ≈ 100 ms。', v: { wt0: 5000, wt1: 5100, wo: 100, '#res': '≈100' }, hl: ['sub', 'res'] }],
    calc: function () { return '約 100 ms（至少 100）'; } });
  Q.push({ id: 'seq-parallel', topic: 'seq',
    q: '常數 1 接到顯示元件 A，常數 2 接到顯示元件 B，兩段之間沒有任何線。執行時哪一個先被寫入？',
    opts: ['不一定', 'A 先（在上面）', 'B 先（在下面）', '一定同時'], a: 0,
    ex: '沒有線就沒有先後關係，LabVIEW 不保證順序。位置在上面或左邊都不代表先執行。',
    dg: [Nd('k1', 'k', 'i', 60, 50, 30, 22, '1'), Wr('w1', 'i', [90, 61, 240, 61]), Nd('a', 'i', 'i', 240, 49, 60, 24, '', 'A'),
      Nd('k2', 'k', 'i', 60, 140, 30, 22, '2'), Wr('w2', 'i', [90, 151, 240, 151]), Nd('b', 'i', 'i', 240, 139, 60, 24, '', 'B')],
    steps: [{ t: '兩段都沒有輸入要等，都可以立刻執行。', v: { w1: 1, w2: 2 }, hl: ['a', 'b'] }, { t: '可能 A 先、可能 B 先，也可能看起來同時。題目問「哪一個先」，答案只能是不一定。', v: { w1: 1, w2: 2, '#a': 1, '#b': 2 }, hl: [] }],
    calc: function () { return '不一定'; } });

  /* ---------- 驗證 ---------- */
  function verify() { return Q.map(function (q) { var c = q.calc(); return { id: q.id, calc: c, ans: q.opts[q.a], ok: c === q.opts[q.a] && new Set(q.opts).size === 4 }; }); }

  /* ---------- 錯題紀錄 ---------- */
  var WKEY = 'll_lv_coderead_wrong';
  function getWrong() { try { var a = JSON.parse(localStorage.getItem(WKEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function setWrong(a) { try { localStorage.setItem(WKEY, JSON.stringify(a)); } catch (e) { } }
  function addWrong(id) { var a = getWrong(); if (a.indexOf(id) < 0) { a.push(id); setWrong(a); } }
  function delWrong(id) { setWrong(getWrong().filter(function (x) { return x !== id; })); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------- 分頁 ---------- */
  var tabs = $('tabs');
  function stopAll() { aStop(); xStopTimer(); }
  function show(t) {
    stopAll();
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['prac', 'exam'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
    if (t === 'exam' && X.on) xResume();
    if (t === 'prac') pDraw();
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* ---------- 動畫解說 ---------- */
  var AN = { q: null, k: -1, timer: null, gen: 0 };
  function aStop() { AN.gen++; if (AN.timer) { clearTimeout(AN.timer); AN.timer = null; } if ($('aplay')) $('aplay').textContent = '▶ 播放'; }
  function aShow(k) {
    var q = AN.q; if (!q) return;
    AN.k = Math.max(-1, Math.min(q.steps.length - 1, k));
    var st = AN.k >= 0 ? q.steps[AN.k] : null;
    $('psvg').innerHTML = render(q, st ? st.v : {}, st ? st.hl : []);
    $('atxt').textContent = st ? st.t : '按「播放」或「下一步」，看資料怎麼流。';
    $('acnt').textContent = (AN.k + 1) + ' / ' + q.steps.length;
    $('aprev').disabled = AN.k < 0; $('anext').disabled = AN.k >= q.steps.length - 1;
  }
  function aPlay() {
    if (AN.timer) { aStop(); return; }
    var g = ++AN.gen; if (AN.k >= AN.q.steps.length - 1) AN.k = -1;
    $('aplay').textContent = '⏸ 暫停';
    (function tick() {
      if (g !== AN.gen) return;
      aShow(AN.k + 1);
      if (AN.k >= AN.q.steps.length - 1) { AN.timer = null; $('aplay').textContent = '▶ 重播'; return; }
      AN.timer = setTimeout(tick, 1500);
    })();
  }
  $('aplay').onclick = aPlay; $('aprev').onclick = function () { aStop(); aShow(AN.k - 1); }; $('anext').onclick = function () { aStop(); aShow(AN.k + 1); };

  /* ---------- 練習模式 ---------- */
  var P = { list: [], pos: 0, order: null, picked: null };
  (function () {
    var s = $('ptopic');
    s.appendChild(el('option', '', '全部（' + Q.length + ' 題）')).value = 'all';
    Object.keys(TOPICS).forEach(function (k) { var n = Q.filter(function (q) { return q.topic === k; }).length; var o = el('option', '', TOPICS[k] + '（' + n + '）'); o.value = k; s.appendChild(o); });
    s.appendChild(el('option', '', '我錯過的題目')).value = 'wrong';
  })();
  function pFilter() {
    var t = $('ptopic').value, w = getWrong();
    P.list = Q.map(function (q, i) { return i; }).filter(function (i) { return t === 'all' ? true : t === 'wrong' ? w.indexOf(Q[i].id) >= 0 : Q[i].topic === t; });
    P.pos = 0; pLoad();
  }
  function pLoad() { aStop(); P.order = null; P.picked = null; pDraw(); }
  function pDraw() {
    var box = $('popts');
    if (!P.list.length) {
      $('pno').textContent = '這個分類沒有題目'; $('ptag').textContent = ''; $('pq').textContent = $('ptopic').value === 'wrong' ? '目前沒有錯題紀錄。到測驗模式考一次吧。' : '';
      $('psvg').innerHTML = ''; box.innerHTML = ''; say('psay', ''); $('panim').hidden = true; return;
    }
    var qi = P.list[P.pos], q = Q[qi];
    $('psvg').setAttribute('viewBox', '0 0 420 210');
    if (!P.order) P.order = shuffle(q.opts.map(function (o, i) { return i; }));
    $('pno').textContent = '第 ' + (P.pos + 1) + ' / ' + P.list.length + ' 題'; $('ptag').textContent = TOPICS[q.topic];
    $('pq').innerHTML = q.q;
    box.innerHTML = '';
    P.order.forEach(function (oi) {
      var b = el('button', '', esc(q.opts[oi])); b.type = 'button';
      if (P.picked != null) { if (oi === q.a) b.className = 'right'; else if (oi === P.picked) b.className = 'wrong'; }
      b.onclick = function () { pPick(oi); }; box.appendChild(b);
    });
    if (P.picked == null) { say('psay', ''); $('panim').hidden = true; AN.q = q; $('psvg').innerHTML = render(q, {}, []); }
    else { $('panim').hidden = false; if (AN.q !== q) { AN.q = q; aShow(-1); } else aShow(AN.k); }
    $('pprev').disabled = P.pos <= 0; $('pnext').disabled = P.pos >= P.list.length - 1;
  }
  function pPick(oi) {
    if (P.picked != null) return;
    var q = Q[P.list[P.pos]]; P.picked = oi; AN.q = q; AN.k = -1;
    var ok = oi === q.a;
    if (ok) delWrong(q.id); else addWrong(q.id);
    say('psay', (ok ? '✔ 答對！' : '✖ 答案是 ' + esc(q.opts[q.a]) + '。') + q.ex, ok ? 'ok' : 'bad');
    pDraw(); aShow(-1);
    return ok;
  }
  function pGoto(id) { $('ptopic').value = 'all'; pFilter(); var i = Q.map(function (q) { return q.id; }).indexOf(id); var p = P.list.indexOf(i); if (p >= 0) { P.pos = p; pLoad(); } }
  $('ptopic').onchange = pFilter;
  $('pprev').onclick = function () { if (P.pos > 0) { P.pos--; pLoad(); } };
  $('pnext').onclick = function () { if (P.pos < P.list.length - 1) { P.pos++; pLoad(); } };
  $('prand').onclick = function () { if (P.list.length) { P.pos = Math.floor(Math.random() * P.list.length); pLoad(); } };

  /* ---------- 測驗模式 ---------- */
  var X = { on: false, qs: [], pos: 0, picks: [], orders: [], t0: 0, el: 0, timer: null, gen: 0 };
  function xStopTimer() { X.gen++; if (X.timer) { clearInterval(X.timer); X.timer = null; X.el += Date.now() - X.t0; } }
  function xResume() { xStopTimer(); X.t0 = Date.now(); var g = X.gen; X.timer = setInterval(function () { if (g !== X.gen) return; xTime(); }, 250); xTime(); }
  function mmss(ms) { var s = Math.floor(ms / 1000); return (s < 600 ? '0' : '') + Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + s % 60; }
  function xTime() { $('xtime').textContent = mmss(X.el + (X.timer ? Date.now() - X.t0 : 0)); }
  function xStart(ids) {
    xStopTimer();
    var pool = ids || shuffle(Q.map(function (q, i) { return i; })).slice(0, 10);
    X = { on: true, qs: pool, pos: 0, picks: pool.map(function () { return null; }), orders: pool.map(function (qi) { return shuffle(Q[qi].opts.map(function (o, i) { return i; })); }), t0: Date.now(), el: 0, timer: null, gen: X.gen + 1 };
    $('xstart').hidden = true; $('xend').hidden = true; $('xrun').hidden = false;
    xDraw(); xResume();
  }
  function xDraw() {
    var qi = X.qs[X.pos], q = Q[qi];
    $('xno').textContent = '第 ' + (X.pos + 1) + ' / ' + X.qs.length + ' 題';
    $('xbar').style.width = (X.pos / X.qs.length * 100) + '%';
    $('xsvg').setAttribute('viewBox', '0 0 420 210'); $('xsvg').innerHTML = render(q, {}, []);
    $('xq').innerHTML = q.q;
    var box = $('xopts'); box.innerHTML = '';
    X.orders[X.pos].forEach(function (oi) { var b = el('button', X.picks[X.pos] === oi ? 'pick' : '', esc(q.opts[oi])); b.type = 'button'; b.onclick = function () { X.picks[X.pos] = oi; xDraw(); }; box.appendChild(b); });
    $('xnext').disabled = X.picks[X.pos] == null; $('xnext').textContent = X.pos === X.qs.length - 1 ? '交卷' : '下一題 ▶';
  }
  function xNext() { if (X.picks[X.pos] == null) return; if (X.pos < X.qs.length - 1) { X.pos++; xDraw(); } else xFinish(); }
  function xFinish() {
    xStopTimer(); X.on = false;
    var wrong = [], score = 0;
    X.qs.forEach(function (qi, k) { var q = Q[qi]; if (X.picks[k] === q.a) { score++; delWrong(q.id); } else { wrong.push(k); addWrong(q.id); } });
    $('xrun').hidden = true; $('xend').hidden = false;
    $('xscore').textContent = '得分 ' + score + ' / ' + X.qs.length + '，用時 ' + mmss(X.el);
    $('xwrong').innerHTML = '';
    if (!wrong.length) $('xwrong').appendChild(el('li', '', '全對！'));
    wrong.forEach(function (k) {
      var q = Q[X.qs[k]], li = el('li', '', '<b>' + TOPICS[q.topic] + '</b>：' + q.q + '<br>你選 ' + esc(q.opts[X.picks[k]]) + '，答案 <b>' + esc(q.opts[q.a]) + '</b> ');
      var b = el('button', '', '看動畫解說'); b.type = 'button'; b.onclick = function () { show('prac'); pGoto(q.id); pPick(X.picks[k]); }; li.appendChild(b);
      $('xwrong').appendChild(li);
    });
    xHist();
    return { score: score, wrong: wrong.map(function (k) { return Q[X.qs[k]].id; }) };
  }
  function xHist() { var n = getWrong().length; $('xhist').textContent = n ? '目前記錄的錯題：' + n + ' 題（練習模式選「我錯過的題目」）。' : ''; }
  $('xgo').onclick = function () { xStart(); }; $('xagain').onclick = function () { xStart(); };
  $('xnext').onclick = xNext;
  $('xquit').onclick = function () { xStopTimer(); X.on = false; $('xrun').hidden = true; $('xstart').hidden = false; xHist(); };
  xHist();

  pFilter();
  if (/^#(prac|exam)$/.test(location.hash)) show(location.hash.slice(1));
  window.CodeReadLab = {
    Q: Q, TOPICS: TOPICS, verify: verify, render: render, show: show, stopAll: stopAll,
    pFilter: pFilter, pPick: pPick, pGoto: pGoto, P: function () { return P; }, aShow: aShow, AN: function () { return AN; },
    xStart: xStart, xPick: function (oi) { X.picks[X.pos] = oi; xDraw(); }, xNext: xNext, xFinish: xFinish, X: function () { return X; },
    getWrong: getWrong, WKEY: WKEY
  };
})();
