/* 數值指令實驗室：KnX／KnY、CMP／ZCP、BIN／BCD／DIV／MUL、SFTL／ROL
   計算規則照本站 engine/plc_engine.py（三菱 FX3 程式手冊）。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function log(id, s) { var l = $(id); l.insertBefore(el('div', '', s), l.firstChild); }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }

  /* ================= 計算（和 engine 一樣） ================= */
  function wrap16(v) { return ((Math.trunc(v) + 0x8000) & 0xFFFF) - 0x8000; }
  function octName(k, i) { var s = i.toString(8); while (s.length < 3) s = '0' + s; return k + s; }
  function knRead(tab, start, digits) { var v = 0; for (var i = 0; i < digits * 4; i++) if (tab[start + i]) v |= 1 << i; return wrap16(v); }
  function knWrite(tab, start, digits, v) { for (var i = 0; i < digits * 4; i++) tab[start + i] = (v >> i) & 1; }
  function binOf(v) { var h = (v & 0xFFFF).toString(16).toUpperCase(); while (h.length < 4) h = '0' + h; return /^\d+$/.test(h) ? parseInt(h, 10) : null; }   // null：不是 BCD → M8067
  function bcdOf(v) { return v >= 0 && v <= 9999 ? wrap16(parseInt(String(v), 16)) : null; }
  function divOf(x, y) { if (y === 0) return null; var q = Math.trunc(x / y); return [wrap16(q), wrap16(x - q * y)]; }
  function mulOf(x, y) { var v = (x * y) >>> 0; return [wrap16(v & 0xFFFF), wrap16(v >>> 16)]; }
  function cmpOf(a, b) { return [a > b ? 1 : 0, a === b ? 1 : 0, a < b ? 1 : 0]; }
  function zcpOf(lo, hi, v) { return [v < lo ? 1 : 0, lo <= v && v <= hi ? 1 : 0, v > hi ? 1 : 0]; }
  function rolOf(v, n, left) { v &= 0xFFFF; n %= 16; return (left ? ((v << n) | (v >> (16 - n))) : ((v >> n) | (v << (16 - n)))) & 0xFFFF; }
  function bin16(v, n) { var s = ''; for (var i = (n || 16) - 1; i >= 0; i--) { s += (v >> i) & 1; if (i % 4 === 0 && i) s += ' '; } return s; }

  /* ================= 迷你 PLC（只做這頁用到的指令） ================= */
  function PLC(il) {
    this.code = il.trim().split('\n').map(function (l) { var p = l.trim().split(/\s+/); return { op: p[0], a: p.slice(1) }; });
    this.x = new Array(256).fill(0); this.y = new Array(256).fill(0); this.m = new Array(8512).fill(0); this.d = new Array(512).fill(0);
    this.pulse = []; this.scans = 0;
  }
  PLC.prototype.bit = function (s) {
    if (s === 'M8000') return 1; if (s === 'M8002') return this.scans === 0 ? 1 : 0;
    var k = s.charAt(0), n = s.slice(1);
    if (k === 'X') return this.x[parseInt(n, 8)]; if (k === 'Y') return this.y[parseInt(n, 8)]; if (k === 'M') return this.m[+n];
    return 0;
  };
  PLC.prototype.tab = function (k) { return { X: this.x, Y: this.y, M: this.m }[k]; };
  PLC.prototype.wget = function (s) {
    var m;
    if ((m = /^K([1-4])([XYM])(\d+)$/.exec(s))) return knRead(this.tab(m[2]), m[2] === 'M' ? +m[3] : parseInt(m[3], 8), +m[1]);
    if ((m = /^K(-?\d+)$/.exec(s))) return wrap16(+m[1]);
    if ((m = /^H([0-9A-Fa-f]+)$/.exec(s))) return wrap16(parseInt(m[1], 16));
    if ((m = /^D(\d+)$/.exec(s))) return this.d[+m[1]];
    throw new Error('bad word ' + s);
  };
  PLC.prototype.wset = function (s, v) {
    var m;
    if ((m = /^K([1-4])([YM])(\d+)$/.exec(s))) return knWrite(this.tab(m[2]), m[2] === 'M' ? +m[3] : parseInt(m[3], 8), +m[1], v);
    if ((m = /^D(\d+)$/.exec(s))) { this.d[+m[1]] = wrap16(v); return; }
    throw new Error('bad dest ' + s);
  };
  PLC.prototype.exec = function (op, a) {
    var me = this, m;
    if (op === 'MOV') me.wset(a[1], me.wget(a[0]));
    else if (op === 'BIN' || op === 'BCD') { var r = op === 'BIN' ? binOf(me.wget(a[0])) : bcdOf(me.wget(a[0])); if (r === null) me.m[8067] = 1; else me.wset(a[1], r); }
    else if (op === 'ADD' || op === 'SUB') me.wset(a[2], wrap16(me.wget(a[0]) + (op === 'ADD' ? 1 : -1) * me.wget(a[1])));
    else if (op === 'INC' || op === 'DEC') me.wset(a[0], wrap16(me.wget(a[0]) + (op === 'INC' ? 1 : -1)));
    else if (op === 'MUL' || op === 'DIV') {
      var n = +a[2].slice(1), x = me.wget(a[0]), yv = me.wget(a[1]), q = op === 'MUL' ? mulOf(x, yv) : divOf(x, yv);
      if (q === null) me.m[8067] = 1; else { me.d[n] = q[0]; me.d[n + 1] = q[1]; }
    } else if (op === 'CMP') { var c = cmpOf(me.wget(a[0]), me.wget(a[1])), mn = +a[2].slice(1); me.m[mn] = c[0]; me.m[mn + 1] = c[1]; me.m[mn + 2] = c[2]; }
    else if (op === 'ZCP') { var z = zcpOf(me.wget(a[0]), me.wget(a[1]), me.wget(a[2])), zn = +a[3].slice(1); me.m[zn] = z[0]; me.m[zn + 1] = z[1]; me.m[zn + 2] = z[2]; }
    else if (op === 'SFTL' || op === 'SFTR') {
      var st = me.tab(a[0].charAt(0)), s0 = a[0].charAt(0) === 'M' ? +a[0].slice(1) : parseInt(a[0].slice(1), 8), dt = me.tab(a[1].charAt(0)), d0 = a[1].charAt(0) === 'M' ? +a[1].slice(1) : parseInt(a[1].slice(1), 8);
      var n1 = +a[2].slice(1), n2 = +a[3].slice(1), bits = [], fill = [], i;
      for (i = 0; i < n1; i++) bits.push(dt[d0 + i]); for (i = 0; i < n2; i++) fill.push(st[s0 + i]);
      bits = op === 'SFTL' ? fill.concat(bits.slice(0, n1 - n2)) : bits.slice(n2).concat(fill);
      bits.forEach(function (v, k) { dt[d0 + k] = v; });
    } else if (op === 'ROL' || op === 'ROR') me.wset(a[0], rolOf(me.wget(a[0]), +a[1].slice(1), op === 'ROL'));
    else if (op === 'ZRST') { var k1 = a[0].charAt(0), lo = k1 === 'M' ? +a[0].slice(1) : parseInt(a[0].slice(1), 8), hi = k1 === 'M' ? +a[1].slice(1) : parseInt(a[1].slice(1), 8), tb = me.tab(k1); for (var j = lo; j <= hi; j++) tb[j] = 0; }
    else throw new Error('not here: ' + op);
  };
  var PFORMS = { MOVP: 1, BINP: 1, BCDP: 1, ADDP: 1, SUBP: 1, INCP: 1, DECP: 1, MULP: 1, DIVP: 1, CMPP: 1, ZCPP: 1, SFTLP: 1, SFTRP: 1, ROLP: 1, RORP: 1 };
  PLC.prototype.scan = function () {
    var me = this, acc = 0;
    this.code.forEach(function (c, i) {
      var op = c.op, a = c.a;
      if (op === 'LD') acc = me.bit(a[0]); else if (op === 'LDI') acc = me.bit(a[0]) ? 0 : 1;
      else if (op === 'AND') acc = acc & me.bit(a[0]); else if (op === 'ANI') acc = acc & (me.bit(a[0]) ? 0 : 1);
      else if (op === 'OUT') { var k = a[0].charAt(0); if (k === 'Y') me.y[parseInt(a[0].slice(1), 8)] = acc; else me.m[+a[0].slice(1)] = acc; }
      else if (PFORMS[op]) { var before = me.pulse[i] || 0; me.pulse[i] = acc; if (acc && !before) me.exec(op.slice(0, -1), a); }
      else if (acc) me.exec(op, a);
    });
    this.scans++;
  };
  /* 測試用：x 是一直 ON 的線性編號，跑 n 個掃描，讀回指定元件 */
  function runCase(c) {
    var p = new PLC(c.il); (c.x || []).forEach(function (i) { p.x[i] = 1; });
    for (var s = 0; s < (c.scans || 1); s++) p.scan();
    var out = {}; (c.read || []).forEach(function (r) { var k = r.charAt(0), n = r.slice(1); out[r] = k === 'D' ? p.d[+n] : k === 'Y' ? p.y[parseInt(n, 8)] : p.m[+n]; });
    return out;
  }

  /* ================= 畫位元格子 ================= */
  function bitsHTML(names, vals, opt) {
    opt = opt || {}; var h = '', n = names.length;
    for (var g = Math.ceil(n / 4) - 1; g >= 0; g--) {      // 高位在左
      h += '<span class="nibw"><span class="nib">';
      for (var i = Math.min(n, g * 4 + 4) - 1; i >= g * 4; i--) h += '<button type="button" class="bit' + (vals[i] ? ' on' : '') + (opt.y ? ' y' : '') + (opt.ro ? ' ro' : '') + (opt.flash && opt.flash[i] ? ' flash' : '') + '" data-i="' + i + '">' + (vals[i] ? 1 : 0) + '<small>' + names[i] + '</small></button>';
      h += '</span><span class="nl">' + (opt.lab ? opt.lab(g) : '') + '</span></span>';
    }
    return h;
  }

  /* ================= 1. 位數組合 ================= */
  var KX = new Array(64).fill(0);
  function kDraw() {
    var d = +$('kd').value, s = +$('ks').value, n = d * 4, names = [], vals = [];
    for (var i = 0; i < n; i++) { names.push(octName('X', s + i)); vals.push(KX[s + i]); }
    var name = 'K' + d + octName('X', s);
    $('kname').textContent = name;
    $('kbits').innerHTML = bitsHTML(names, vals, { lab: function (g) { return '第 ' + (g + 1) + ' 位數'; } });
    Array.prototype.forEach.call($('kbits').querySelectorAll('.bit'), function (b) { b.onclick = function () { KX[s + +b.dataset.i] ^= 1; kDraw(); }; });
    var v = knRead(KX, s, d);
    $('klist').textContent = names[0] + '～' + names[n - 1] + '（' + n + ' 點）';
    $('kval').textContent = v; $('khex').textContent = (v & 0xFFFF).toString(16).toUpperCase() + 'h　' + bin16(v & 0xFFFF, n);
    var jumps = []; for (var k = 1; k < n; k++) if (names[k - 1].slice(-1) === '7') jumps.push(names[k - 1] + ' 的下一個是 ' + names[k]);
    $('kwhy').innerHTML = (jumps.length ? '注意編號：' + jumps.join('、') + '，八進位沒有 8、9。' : '') +
      (d === 4 && v < 0 ? '　最高位（' + names[15] + '）是 1：16 位元帶正負號，D0 變成負數。' : '　值 ＝ 每個 ON 的位元的權重相加（最右邊是 1，往左 2、4、8…）。');
  }
  function kyDraw() {
    var v = wrap16(+$('ky').value || 0), Y = new Array(8).fill(0); knWrite(Y, 0, 2, v);
    var names = []; for (var i = 0; i < 8; i++) names.push(octName('Y', i));
    $('kybits').innerHTML = bitsHTML(names, Y, { y: 1, ro: 1 });
    var back = knRead(Y, 0, 2);
    $('kywhy').innerHTML = 'K2Y000 只有 8 個位元，只收得下 ' + v + ' 的低 8 位：' + bin16(v & 255, 8) + '（Y7～Y0）。' + (back !== v ? '<b>超過 255 或是負數的部分被丟掉了</b>，讀回來是 ' + back + '。' : '');
  }
  $('kd').onchange = $('ks').onchange = kDraw; $('kclr').onclick = function () { KX.fill(0); kDraw(); };
  $('ky').oninput = kyDraw;
  kDraw(); kyDraw();

  /* ================= 2. CMP／ZCP ================= */
  var CM = [0, 0, 0];
  function lamp(id, on, txt, err) { return '<span class="ml' + (err ? ' bad' : '') + (on ? ' on' : '') + '"' + (id ? ' id="' + id + '"' : '') + '><i></i>' + txt + '</span>'; }
  function cDraw() {
    var a = +$('c1').value, b = +$('c2').value;
    $('c1v').textContent = a; $('c2v').textContent = b;
    if ($('con').checked) CM = cmpOf(a, b);
    $('cm').innerHTML = lamp('', CM[0], 'M10　S1 &gt; S2') + lamp('', CM[1], 'M11　S1 = S2') + lamp('', CM[2], 'M12　S1 &lt; S2');
    $('cwhy').innerHTML = $('con').checked ? 'CMP K' + a + ' K' + b + ' M10：' + a + (a > b ? ' &gt; ' : a === b ? ' = ' : ' &lt; ') + b + '，所以 M1' + (a > b ? 0 : a === b ? 1 : 2) + ' ON，其他兩個 OFF。' : '<b>驅動條件 OFF：</b>M10～M12 停在最後一次的結果，拉 S1、S2 也不會變。';
  }
  function zDraw() {
    var lo = +$('zl').value, hi = +$('zh').value, v = +$('zs').value, Z = zcpOf(lo, hi, v);
    $('zsv').textContent = v;
    var X = function (t) { return 20 + Math.max(0, Math.min(100, t)) * 3.8; }, h = '';
    h += '<line x1="20" y1="40" x2="400" y2="40" stroke="var(--mute)" stroke-width="2"/>';
    h += '<rect x="20" y="30" width="' + (X(lo) - 20) + '" height="20" style="fill:var(--onbg)"/><rect x="' + X(lo) + '" y="30" width="' + (X(hi) - X(lo)) + '" height="20" fill="rgba(34,197,94,.25)"/><rect x="' + X(hi) + '" y="30" width="' + (400 - X(hi)) + '" height="20" fill="rgba(239,68,68,.15)"/>';
    [0, 25, 50, 75, 100].forEach(function (t) { h += '<line x1="' + X(t) + '" y1="44" x2="' + X(t) + '" y2="50" stroke="var(--mute)"/><text x="' + X(t) + '" y="64" text-anchor="middle">' + t + '</text>'; });
    h += '<text x="' + X(lo) + '" y="24" text-anchor="middle" style="fill:var(--on)">下限 ' + lo + '</text><text x="' + X(hi) + '" y="24" text-anchor="middle" style="fill:#dc2626">上限 ' + hi + '</text>';
    h += '<path d="M' + X(v) + ' 52 l-7 12 h14 z" fill="#f59e0b" stroke="#92400e"/><text x="' + X(v) + '" y="78" text-anchor="middle" style="font-weight:700">' + v + '</text>';
    $('zline').innerHTML = h;
    $('zm').innerHTML = lamp('', Z[0], 'M20　低於下限') + lamp('', Z[1], 'M21　下限～上限（含兩端）') + lamp('', Z[2], 'M22　高於上限');
    $('zwhy').innerHTML = (v === lo || v === hi ? '剛好等於' + (v === lo ? '下限' : '上限') + '，<b>算在區間內</b>，M21 ON。' : '') + (lo > hi ? '　下限比上限大：請照手冊讓下限 ≤ 上限。' : '');
  }
  $('c1').oninput = $('c2').oninput = $('con').onchange = cDraw;
  $('zl').oninput = $('zh').oninput = $('zs').oninput = zDraw;
  cDraw(); zDraw();

  /* ================= 3. BIN／BCD／DIV ================= */
  var BX = new Array(8).fill(0), WT = 3, WO = 6, BD0 = 0;
  function setDial() { BX.fill(0); knWrite(BX, 0, 1, WO); knWrite(BX, 4, 1, WT); }
  function bDraw(flash) {
    var names = []; for (var i = 0; i < 8; i++) names.push(octName('X', i));
    $('bxbits').innerHTML = bitsHTML(names, BX, { flash: flash, lab: function (g) { return g ? '十位' : '個位'; } });
    Array.prototype.forEach.call($('bxbits').querySelectorAll('.bit'), function (b) { b.onclick = function () { BX[+b.dataset.i] ^= 1; WO = knRead(BX, 0, 1); WT = knRead(BX, 4, 1); bDraw(); }; });
    $('wt').textContent = WT > 9 ? '?' : WT; $('wo').textContent = WO > 9 ? '?' : WO;
    var raw = knRead(BX, 0, 2), r = binOf(raw);
    if (r !== null) BD0 = r;
    $('bbin').textContent = BD0; $('bmov').textContent = raw;
    $('b8067a').classList.toggle('on', r === null);
    $('bwhy').innerHTML = r === null ? '有一位是 ' + (WT > 9 ? WT : WO) + '（' + bin16(WT > 9 ? WT : WO, 4) + '），不是 BCD：BIN 不轉換，D0 留在上一次的 ' + BD0 + '，M8067 ON。' :
      'X7～X0 ＝ ' + bin16(raw, 8) + '：每 4 個位元是一位十進位數（BCD）。BIN 轉成 ' + r + '；MOV 直接搬是把 8 個位元當二進位，得到 ' + raw + (raw !== r ? '，<b>錯了</b>。' : '（0～9 剛好一樣）。');
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-w]'), function (b) {
    b.onclick = function () { var w = b.dataset.w, k = +w.slice(1); if (w.charAt(0) === 't') WT = ((Math.min(WT, 9) + k) + 10) % 10; else WO = ((Math.min(WO, 9) + k) + 10) % 10; setDial(); bDraw(); };
  });
  function bdDraw() {
    var v = wrap16(+$('bd').value || 0), dk = +$('bdk').value, r = bcdOf(v), Y = new Array(16).fill(0);
    $('b8067b').classList.toggle('on', r === null);
    if (r !== null) knWrite(Y, 0, dk, r);
    var names = []; for (var i = 0; i < dk * 4; i++) names.push(octName('Y', i));
    $('bybits').innerHTML = bitsHTML(names, Y, { y: 1, ro: 1, lab: function (g) { return ['個位', '十位', '百位', '千位'][g]; } });
    var digs = '';
    for (var g = dk - 1; g >= 0; g--) { var nib = knRead(Y, g * 4, 1) & 15; digs += '<span class="' + (nib > 9 ? 'dark' : '') + '">' + (nib > 9 ? '8' : nib) + '</span>'; }
    $('bseg').innerHTML = digs;
    if (r === null) $('bdwhy').innerHTML = v + ' 超出 0～9999（或是負數）：BCD 不轉換，Y 不變，M8067 ON。';
    else {
      var lost = v >= Math.pow(10, dk);
      $('bdwhy').innerHTML = v + ' 的 BCD 是 ' + bin16(r & 0xFFFF, 16).replace(/^(0000 )+/, '') + '（每 4 位一個數字）。二進位卻是 ' + bin16(v, 16).replace(/^(0000 )+/, '') + '，直接 MOV 到七段就錯。' + (lost ? '　<b>K' + dk + 'Y000 只有 ' + dk + ' 位</b>，最高位被丟掉，七段只顯示後 ' + dk + ' 位。' : '');
    }
  }
  $('bd').oninput = $('bdk').onchange = bdDraw;
  function vDraw() {
    var a = wrap16(+$('v1').value || 0), b = wrap16(+$('v2').value || 0), op = $('vop').value, r = op === 'DIV' ? divOf(a, b) : mulOf(a, b);
    $('vl0').textContent = op === 'DIV' ? 'D10（商）' : 'D10（低 16 位）'; $('vl1').textContent = op === 'DIV' ? 'D11（餘數）' : 'D11（高 16 位）';
    $('v8067').classList.toggle('on', r === null);
    if (r === null) { $('vd10').textContent = '不變'; $('vd11').textContent = '不變'; $('vwhy').innerHTML = '除以 0：DIV 不執行，D10、D11 保持原值，M8067 ON。要先檢查除數。'; return; }
    $('vd10').textContent = r[0]; $('vd11').textContent = r[1];
    if (op === 'DIV') $('vwhy').innerHTML = a + ' ÷ ' + b + '：商 ' + r[0] + ' 放在 D10，餘數 ' + r[1] + ' 放在<b>下一個</b> D11。D11 不能再拿去做別的用途。' + (a < 0 || b < 0 ? '　負數時商往 0 的方向取整，餘數的正負跟被除數一樣。' : '');
    else { var full = a * b; $('vwhy').innerHTML = a + ' × ' + b + ' = ' + full + '，結果是 32 位元：低 16 位在 D10、高 16 位在 D11。' + (full > 32767 || full < -32768 ? '　超過 16 位元範圍，只看 D10 是錯的。' : '　沒超過 32767，只看 D10 就好，但 D11 一樣會被寫入。'); }
  }
  $('v1').oninput = $('v2').oninput = $('vop').onchange = vDraw;
  setDial(); bDraw(); bdDraw(); vDraw();

  /* ================= 4. 移位 ================= */
  var SH = { p: null, gen: 0, timer: null, n: 0, prevY: '' };
  function shIL() { return 'LD X000\n' + $('sop').value + ' ' + $('ssrc').value + ' Y000 K8 K1\nLD X002\nZRST Y000 Y007'; }
  function shNew() { var old = SH.p; shStop(); SH.p = new PLC(shIL()); if (old) for (var i = 0; i < 8; i++) SH.p.y[i] = old.y[i]; SH.n = 0; shDraw(); }
  function shStop() { SH.gen++; if (SH.timer) { clearInterval(SH.timer); SH.timer = null; } var hb = $('shold'); if (hb) hb.disabled = false; }
  function shScan(x0, x2) {
    var p = SH.p;
    p.x[0] = x0 ? 1 : 0; p.x[1] = $('sx1').checked ? 1 : 0; p.x[2] = x2 ? 1 : 0; p.scan();
    if (x0 && ($('sop').value === 'SFTL' || !SH.lastX0)) SH.n++;      // 這一圈有沒有推
    SH.lastX0 = x0 ? 1 : 0;
    shDraw(); return p.y.slice(0, 8).join('');
  }
  function shDraw() {
    var p = SH.p, names = []; for (var i = 0; i < 8; i++) names.push(octName('Y', i));
    $('sbits').innerHTML = bitsHTML(names, p.y.slice(0, 8), { y: 1, ro: 1 });
    $('scnt').textContent = SH.n;
  }
  function shHold(scans) {
    if (SH.timer) return;
    var g = ++SH.gen, k = 0, start = SH.n, op = $('sop').value;
    SH.shifts = 0;
    $('shold').disabled = true;
    SH.timer = setInterval(function () {
      if (g !== SH.gen) return;
      var before = SH.p.y.slice(0, 8).join(''), on = k < scans;
      shScan(on, false);
      if (on && (op === 'SFTL' || k === 0)) SH.shifts++;
      k++;
      if (k > scans) {
        clearInterval(SH.timer); SH.timer = null; $('shold').disabled = false;
        var msg = op === 'SFTL' ? '✖ SFTL：X0 按住 ' + scans + ' 個掃描，每個掃描都推一格，推了 ' + scans + ' 格，燈一下子就跑過去了。' : '✔ SFTLP：X0 按住 ' + scans + ' 個掃描，只在剛按下的那個掃描推一格。';
        say('ssay', msg, op === 'SFTL' ? 'bad' : 'ok'); log('slog', msg);
      }
    }, 100);
  }
  /* 測試用：同步跑，回傳 Y0～Y7 */
  function shRunSync(op, src, x1, scans, startY) {
    var p = new PLC('LD X000\n' + op + ' ' + src + ' Y000 K8 K1'); if (startY) startY.forEach(function (i) { p.y[i] = 1; });
    for (var k = 0; k <= scans; k++) { p.x[0] = k < scans ? 1 : 0; p.x[1] = x1 ? 1 : 0; p.scan(); }
    return p.y.slice(0, 8).join('');
  }
  $('shold').onclick = function () { shHold(5); };
  $('stap').onclick = function () { shStop(); $('shold').disabled = false; shScan(true, false); shScan(false, false); say('ssay', ''); };
  $('sclr').onclick = function () { shStop(); $('shold').disabled = false; shScan(false, true); SH.n = 0; shDraw(); say('ssay', 'ZRST Y000 Y007：8 個燈一次清掉。'); };
  $('sop').onchange = $('ssrc').onchange = shNew;
  $('sx1').onchange = shDraw;
  SH.p = new PLC(shIL()); shDraw();

  var RL = { d0: 1 };
  function rDraw(flash) {
    var names = []; for (var i = 0; i < 16; i++) names.push('b' + i);
    var vals = []; for (var j = 0; j < 16; j++) vals.push((RL.d0 >> j) & 1);
    $('rbits').innerHTML = bitsHTML(names, vals, { ro: 1 });
    $('rval').textContent = wrap16(RL.d0);
  }
  function rolStep() { RL.d0 = rolOf(RL.d0, 1, true); }
  $('rolp').onclick = function () { rolStep(); rDraw(); $('rwhy').innerHTML = 'ROLP 點一下轉一格：最高位 b15 掉出去會從 b0 回來，不從外面補。'; };
  $('rol5').onclick = function () { for (var i = 0; i < 5; i++) rolStep(); rDraw(); $('rwhy').innerHTML = '沒加 P 的 ROL：條件 ON 的 5 個掃描每個都轉一格，一下子轉了 5 格。'; };
  $('rreset').onclick = function () { RL.d0 = 1; rDraw(); $('rwhy').textContent = ''; };
  rDraw();

  /* ================= 分頁 ================= */
  var tabs = $('tabs');
  function stopAll() { shStop(); if ($('shold')) $('shold').disabled = false; }
  function show(t) {
    stopAll();
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['kn', 'cmp', 'bcd', 'sft'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  if (/^#(kn|cmp|bcd|sft)$/.test(location.hash)) show(location.hash.slice(1));

  window.DataLab = {
    wrap16: wrap16, octName: octName, knRead: knRead, knWrite: knWrite, binOf: binOf, bcdOf: bcdOf, divOf: divOf, mulOf: mulOf, cmpOf: cmpOf, zcpOf: zcpOf, rolOf: rolOf,
    PLC: PLC, runCase: runCase, shRunSync: shRunSync, shHold: shHold, shNew: shNew, SH: function () { return SH; }, show: show, stopAll: stopAll
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  var L = window.DataLab;
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function r(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function q(o) { var seen = {}; seen[o.ans] = 1; o.wrong = o.wrong.map(String).filter(function (w) { if (seen[w]) return false; seen[w] = 1; return true; }); return o; }
  function bin16(v, n) { var s = ''; for (var i = n - 1; i >= 0; i--) { s += (v >> i) & 1; if (i % 4 === 0 && i) s += ' '; } return s; }
  var KIND = [
    function () { var s = p1([0, 4, 8]), d = p1([1, 2]), a = L.octName('X', s), b = L.octName('X', s + d * 4 - 1); return q({ q: '<code>K' + d + L.octName('X', s) + '</code> 包含哪些輸入？', ans: a + '～' + b, wrong: [a + '～' + L.octName('X', s + d * 4), (s === 8 ? 'X8～X' + (8 + d * 4 - 1) + '（照十進位算）' : a + '～' + L.octName('X', s + d * 4 + 1)), a + '～' + L.octName('X', s + d * 8 - 1), a + ' 一個點'], ex: 'K' + d + ' 是 ' + d * 4 + ' 個位元；X 的編號是八進位，沒有 8、9。' }); },
    function () { var bits = [], v = 0; for (var i = 0; i < 8; i++) if (Math.random() < .4) { bits.push(L.octName('X', i)); v |= 1 << i; } if (!bits.length) { bits = ['X001']; v = 2; } return q({ q: '只有 ' + bits.join('、') + ' 是 ON，其他 OFF。<code>MOV K2X000 D0</code> 之後 D0 是？', ans: String(v), wrong: [v + 1, v * 2, bits.length, 255 - v, v >> 1], ex: '每個位元的權重：X0=1、X1=2、X2=4…X7=128，ON 的加起來：' + v + '。' }); },
    function () { var v = r(1, 255); return q({ q: '<code>MOV K' + v + ' K2Y000</code> 之後，Y7～Y0 是？', ans: bin16(v, 8), wrong: [bin16(255 - v, 8), bin16((v << 1) & 255, 8), bin16(v >> 1, 8), bin16(L.bcdOf(v % 100) & 255, 8)], ex: v + ' 的二進位，Y0 是最低位。' }); },
    function () { var t = r(1, 9), o = r(0, 9), v = t * 10 + o, raw = t * 16 + o; return q({ q: '兩位數指撥開關撥在 ' + v + '，接 X0～X7（BCD）。<code>MOV K2X000 D1</code> 讀到多少？', ans: String(raw), wrong: [v, L.binOf(raw), raw + 6, t + o], ex: 'MOV 把 X7～X0 的 ' + bin16(raw, 8) + ' 當二進位：' + raw + '。要用 BIN 才得到 ' + v + '。' }); },
    function () { var t = r(1, 9), o = r(0, 9), v = t * 10 + o; return q({ q: '指撥開關撥在 ' + v + '。<code>BIN K2X000 D0</code> 之後 D0 是？', ans: String(L.binOf(t * 16 + o)), wrong: [t * 16 + o, t + o, o * 10 + t, v * 2], ex: 'BIN 把每 4 個位元當一位十進位數：' + t + '、' + o + ' → ' + v + '。' }); },
    function () { var v = p1([36, 47, 25, 81, 59, 12]); var b = L.bcdOf(v); return q({ q: 'D0 = ' + v + '。<code>BCD D0 K2Y000</code> 之後，Y7～Y0 是？', ans: bin16(b, 8), wrong: [bin16(v, 8), bin16(b >> 1, 8), bin16(255 - b, 8), bin16(L.bcdOf(Math.floor(v / 10) + (v % 10) * 10), 8)], ex: '十位 ' + Math.floor(v / 10) + ' 和個位 ' + v % 10 + ' 各用 4 個位元：' + bin16(b, 8) + '。二進位的 ' + v + ' 是 ' + bin16(v, 8) + '，不一樣。' }); },
    function () { var v = p1([123, 456, 908, 250]); return q({ q: 'D0 = ' + v + '。<code>BCD D0 K2Y000</code>，接在 Y0～Y7 的兩位數七段顯示什麼？', ans: String(v % 100).padStart(2, '0'), wrong: [String(v), String(Math.floor(v / 10)), '全暗', '99'], ex: 'K2Y000 只有兩位數（8 個位元），百位被丟掉，只剩後兩位。三位數要 K3Y000。' }); },
    function () { return q({ q: '<code>BCD D0 K4Y000</code>，D0 = 12000（超過 9999）。結果？', ans: '不轉換，Y 不變，M8067 ON', wrong: ['Y 顯示 2000', 'Y 全部 OFF', 'Y 顯示 9999', 'PLC 停止'], ex: 'BCD 的 16 位元範圍是 0～9999，超過或負數時不轉換，運算錯誤旗標 M8067 ON。' }); },
    function () { var a = r(10, 60), b = r(2, 9), d = L.divOf(a, b); return q({ q: '<code>DIV K' + a + ' K' + b + ' D10</code> 之後，D11 是？', ans: String(d[1]), wrong: [d[0], 0, b, a - b, d[0] + 1], ex: '商 ' + d[0] + ' 放在 D10，餘數 ' + d[1] + ' 放在下一個 D11。' }); },
    function () { return q({ q: '<code>DIV D0 D1 D10</code>，執行時 D1 = 0。結果？', ans: 'D10、D11 不變，M8067 ON', wrong: ['D10 = 0', 'D10 = 32767', 'PLC 停止', 'D10 = D0'], ex: '除以 0 不執行，運算錯誤旗標 M8067 ON。D10 看起來沒變，容易以為算對了，要先檢查除數。' }); },
    function () { var a = p1([300, 500, 1000]), b = p1([300, 200, 100]), m = L.mulOf(a, b); return q({ q: '<code>MUL K' + a + ' K' + b + ' D0</code>（' + a * b + '）。結果放在哪？', ans: '32 位元：低位 D0、高位 D1', wrong: ['只放在 D0', '高位 D0、低位 D1', 'D0 和 D2', '超過 32767 時 M8067 ON 不執行'], ex: 'MUL 的結果一律是 32 位元，佔 D0、D1 兩個。這題 D0 = ' + m[0] + '、D1 = ' + m[1] + '。' }); },
    function () { var a = r(-10, 60), b = r(-10, 60); var c = L.cmpOf(a, b); var idx = c.indexOf(1); return q({ q: '<code>CMP K' + a + ' K' + b + ' M10</code>，哪一個 M ON？', ans: 'M1' + idx, wrong: ['M10', 'M11', 'M12', 'M10 和 M11', '都不 ON'], ex: a + (idx === 0 ? ' > ' : idx === 1 ? ' = ' : ' < ') + b + '：第一個大於 → M10、等於 → M11、小於 → M12。' }); },
    function () { var lo = p1([20, 30, 40]), hi = lo + 40, v = p1([lo, hi, lo - 1, hi + 1, lo + 10]), z = L.zcpOf(lo, hi, v), idx = z.indexOf(1); return q({ q: '<code>ZCP K' + lo + ' K' + hi + ' K' + v + ' M20</code>，哪一個 M ON？', ans: 'M2' + idx, wrong: ['M20', 'M21', 'M22', '都不 ON'], ex: '下限以下 M20、下限到上限（含兩端）M21、上限以上 M22。' + v + ' ' + (idx === 1 ? '在區間內（含兩端）' : idx === 0 ? '低於下限' : '高於上限') + '。' }); },
    function () { return q({ q: 'CMP 的驅動條件從 ON 變 OFF 之後，M10～M12 會？', ans: '保持最後一次的結果', wrong: ['全部 OFF', '全部 ON', '變成 M11 ON', '每個掃描亂跳'], ex: '條件 OFF 時 CMP 不執行，M 保持原狀。要清除用 ZRST M10 M12。' }); },
    function () { var n = p1([3, 5, 8]); var s = L.shRunSync('SFTL', 'X001', true, n); return q({ q: 'Y0～Y7 一開始全 OFF，X1 ON。<code>LD X000</code>、<code>SFTL X001 Y000 K8 K1</code>，X0 連續 ON ' + n + ' 個掃描。之後亮幾顆燈？', ans: String(s.split('').filter(function (c) { return c === '1'; }).length), wrong: [1, 0, 8, n + 1], ex: 'SFTL（連續型）在條件 ON 的每個掃描都推一格，' + n + ' 個掃描推了 ' + n + ' 次。用 SFTLP 只推 1 格。' }); },
    function () { var n = p1([3, 5, 8]); var s = L.shRunSync('SFTLP', 'X001', true, n); return q({ q: '同上，但改用 <code>SFTLP</code>，X0 連續 ON ' + n + ' 個掃描。之後亮幾顆燈？', ans: String(s.split('').filter(function (c) { return c === '1'; }).length), wrong: [n, 0, 8, 2], ex: 'SFTLP 只在條件剛變 ON 的那個掃描推一格。' }); },
    function () { var v = p1([1, 2, 4, 3, 5]), n = p1([1, 2, 3]); return q({ q: 'D0 = ' + v + '，執行一次 <code>ROLP D0 K' + n + '</code>。D0 變成？', ans: String(L.wrap16(L.rolOf(v, n, true))), wrong: [v, v + n, v >> n, L.wrap16(L.rolOf(v, n, false))], ex: '往左轉 ' + n + ' 格等於乘 ' + Math.pow(2, n) + '（最高位不掉出去時）。掉出去的位元會從 b0 回來。' }); },
    function () { return q({ q: 'D0 = -32768（只有最高位 b15 是 1）。<code>ROLP D0 K1</code> 之後 D0 是？', ans: '1', wrong: ['0', '-32768', '-1', '32767'], ex: 'ROL 是旋轉：b15 掉出去，從 b0 回來，所以變成 1。SFTL 才是從外面補位元。' }); }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) L.quiz = window.LabQuiz('dquiz', gen);
  L.quizGen = gen; L.quizKinds = KIND;
})();
