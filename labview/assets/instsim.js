/* InstSim：模擬儀器引擎（「新儀器怎麼接入」的課文與練習台共用）
   window.InstSim = { list(), open(id, cfg), terminal(container, opts), bytesView(container, bytes, opts), verify(), sample(id), util }
   - 邏輯部分（list／open／verify／sample／util）不碰 DOM，可以在 node 跑：require 這個檔會拿到同一個物件。
   - 時間是虛擬的：session.tick(ms) 才會前進，read() 會自己把時間往前推到讀完或逾時，所以結果可以重現。
   - 所有儀器資料集中在 INSTRUMENTS 這一張表。verified:false 的值是依印象填的，等查證後在這裡改。 */
(function (root) {
  'use strict';

  /* ====================================================================== 小工具 */
  function toBytes(x) { var a = [], i; if (typeof x === 'string') { for (i = 0; i < x.length; i++) a.push(x.charCodeAt(i) & 255); return a; } for (i = 0; i < (x || []).length; i++) a.push(x[i] & 255); return a; }
  function toText(b) { var s = '', i; for (i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s; }
  function h2(n) { return (n < 16 ? '0' : '') + (n & 255).toString(16).toUpperCase(); }
  function hex(b) { return b.map(h2).join(' '); }
  function parseHex(s) { var t = String(s).replace(/0x/gi, '').replace(/[\s,:]+/g, ''); if (!t.length || t.length % 2 || /[^0-9a-f]/i.test(t)) return null; var a = [], i; for (i = 0; i < t.length; i += 2) a.push(parseInt(t.substr(i, 2), 16)); return a; }
  function lrc(b) { var s = 0, i; for (i = 0; i < b.length; i++) s += b[i]; return (-s) & 255; }
  function crc16(b) { var c = 0xFFFF, i, j; for (i = 0; i < b.length; i++) { c ^= b[i]; for (j = 0; j < 8; j++) c = (c & 1) ? (c >>> 1) ^ 0xA001 : c >>> 1; } return c; }
  function asciiFrame(b) { return ':' + b.concat([lrc(b)]).map(h2).join('') + '\r\n'; }
  function rtuFrame(b) { var c = crc16(b); return b.concat([c & 255, c >> 8]); }
  function mbap(tid, unit, pdu) { return [tid >> 8, tid & 255, 0, 0, (pdu.length + 1) >> 8, (pdu.length + 1) & 255, unit].concat(pdu); }
  function rng32(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { return (r() + r() + r() + r() - 2) * 1.73; }
  function sci(v) { var s = Math.abs(v).toExponential(8).toUpperCase(), m = /^(.*)E([+-])(\d+)$/.exec(s); return (v < 0 ? '-' : '+') + m[1] + 'E' + m[2] + (m[3].length < 2 ? '0' : '') + m[3]; }
  function i16(v) { return ((Math.round(v) % 65536) + 65536) % 65536; }

  /* LabVIEW 字串函式的近似（給「把原始資料變成數字」用） */
  function dec(s) { var m = /^[+-]?\d+/.exec(s); return m ? parseInt(m[0], 10) : 0; }                       // Decimal String To Number
  function fract(s) { var m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s); return m ? parseFloat(m[0]) : 0; }   // Fract/Exp String To Number
  function hexNum(s) { var m = /^[0-9A-Fa-f]+/.exec(s); return m ? parseInt(m[0], 16) : 0; }                 // Hexadecimal String To Number
  function scan(str, fmt) {                                                                                 // Scan From String（%d %f %s %Ns %x）
    var si = 0, fi = 0, out = [], c, m, w, t, rest, mm;
    while (fi < fmt.length) {
      c = fmt.charAt(fi);
      if (c === '%') {
        m = /^%(\d*)(\.\d+)?([dfsxeg%])/.exec(fmt.slice(fi)); if (!m) return { ok: false, values: out, err: '格式字串看不懂' };
        fi += m[0].length; w = m[1] ? +m[1] : 0; t = m[3];
        if (t === '%') { if (str.charAt(si) !== '%') return { ok: false, values: out, err: '對不到 %' }; si++; continue; }
        while (si < str.length && /\s/.test(str.charAt(si))) si++;
        rest = w ? str.substr(si, w) : str.slice(si);
        mm = t === 'd' ? /^[+-]?\d+/.exec(rest) : t === 'x' ? /^[0-9A-Fa-f]+/.exec(rest) : t === 's' ? (w ? (rest.length ? [rest] : null) : /^\S+/.exec(rest)) : /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest);
        if (!mm) return { ok: false, values: out, err: '第 ' + (out.length + 1) + ' 個 % 對不到資料' };
        si += mm[0].length; out.push(t === 'd' ? parseInt(mm[0], 10) : t === 'x' ? parseInt(mm[0], 16) : t === 's' ? mm[0] : parseFloat(mm[0]));
      } else if (/\s/.test(c)) { while (si < str.length && /\s/.test(str.charAt(si))) si++; fi++; }
      else { if (str.charAt(si) !== c) return { ok: false, values: out, err: '格式裡的「' + c + '」對不到資料' }; si++; fi++; }
    }
    return { ok: true, values: out, rest: str.slice(si) };
  }

  /* ====================================================================== 序列線：兩邊設定不同時會收到什麼 */
  function charMs(f) { return (1 + f.bits + (f.parity === 'N' ? 0 : 1) + f.stop) * 1000 / f.baud; }
  function baudOk(a, b) { return Math.abs(a - b) / b < 0.03; }
  /* 送的一方照 tx 的格式把一個位元組變成一串位元，收的一方照 rx 的格式切回來 */
  function reframe(byte, tx, rx) {
    var seq = [], i, ones = 0, v = 0, bit, perr = false, ferr = false, k = 0;
    for (i = 0; i < tx.bits; i++) { bit = (byte >> i) & 1; seq.push(bit); ones += bit; }
    if (tx.parity !== 'N') seq.push(tx.parity === 'E' ? ones % 2 : 1 - ones % 2);
    function next() { return k < seq.length ? seq[k++] : (k++, 1); }      // 送完之後線上是停止位元（1）
    ones = 0;
    for (i = 0; i < rx.bits; i++) { bit = next(); v |= bit << i; ones += bit; }
    if (rx.parity !== 'N') { bit = next(); if (bit !== (rx.parity === 'E' ? ones % 2 : 1 - ones % 2)) perr = true; }
    if (next() !== 1) ferr = true;
    return { byte: v, perr: perr, ferr: ferr };
  }
  /* 鮑率不同：位元寬度對不上，收到的是和原文無關的位元組（示意，不是逐位元模擬） */
  var JUNK = [0x00, 0x80, 0xE0, 0xF8, 0xFE, 0xFF, 0x1C, 0x78, 0xC0, 0x06, 0x98, 0xE6, 0x9E, 0x60];
  function garble(bytes, txBaud, rxBaud) {
    var ratio = rxBaud / txBaud, n = ratio > 1 ? Math.round(bytes.length * Math.min(ratio, 3) * 0.6) : Math.floor(bytes.length * ratio), out = [], i;
    n = Math.max(1, n);
    for (i = 0; i < n; i++) out.push(JUNK[(bytes[i % bytes.length] * 7 + i * 13 + (ratio > 1 ? 3 : 0)) % JUNK.length]);
    return out;
  }

  /* ====================================================================== Modbus 共用 */
  function modbusPdu(func, d, regs) {      // d = 功能碼之後的位元組；回傳回應的 PDU
    var addr, qty, i, v, out;
    if (func === 3 || func === 4) {
      if (d.length !== 4) return [func | 0x80, 3];
      addr = d[0] << 8 | d[1]; qty = d[2] << 8 | d[3];
      if (func === 4 && !regs.fn4) return [0x84, 1];
      if (qty < 1 || qty > regs.maxQty) return [func | 0x80, 3];
      out = [func, qty * 2];
      for (i = 0; i < qty; i++) { v = regs.read(addr + i); if (v === undefined) return [func | 0x80, 2]; out.push(v >> 8, v & 255); }
      return out;
    }
    if (func === 6 && regs.write) {
      if (d.length !== 4) return [0x86, 3];
      v = regs.write(d[0] << 8 | d[1], d[2] << 8 | d[3]);
      return v ? [0x86, v] : [6].concat(d);
    }
    return [func | 0x80, 1];
  }

  /* ====================================================================== 六台儀器 */
  /* 收到結尾字元才處理一行。mode：'lf' 要 \n（前面有 \r 也可以）、'crlf' 一定要 \r\n、'cr' 要 \r、'any' \r 或 \n 都算 */
  function lineDev(mode, onLine, now) {
    var buf = '', last = 0;
    return {
      onBytes: function (b) {
        if (now) { if (buf && now() - last > 1000) buf = ''; last = now(); }      // 模擬的簡化：半截命令 1 秒沒下文就丟掉
        buf += toText(b);
        for (;;) {
          var k = -1, i, c, ln;
          for (i = 0; i < buf.length; i++) { c = buf.charAt(i); if (c === '\n' || (c === '\r' && (mode === 'any' || mode === 'cr'))) { k = i; break; } }
          if (k < 0) break;
          ln = buf.slice(0, k + 1); buf = buf.slice(k + 1);
          if (mode === 'crlf' && ln.slice(-2) !== '\r\n') continue;
          if (mode === 'cr' && ln.slice(-1) !== '\r') continue;
          onLine(ln.replace(/[\r\n]+$/, ''));
        }
        if (buf.length > 256) buf = '';
      },
      garbage: function () { buf = ''; }, pending: function () { return buf; }
    };
  }

  /* 1) GW Instek GPD-3303S */
  function makeGpd(ctx) {
    var st = { v: [5, 5], i: [1, 1], out: false, err: '', R: [10, 47] };
    function meas(ch) {
      if (!st.out) return [0, 0];
      var V = st.v[ch], I = V / st.R[ch];
      if (I > st.i[ch]) { I = st.i[ch]; V = I * st.R[ch]; }
      return [Math.max(0, V + gauss(ctx.rng) * 0.001), Math.max(0, I + gauss(ctx.rng) * 0.0005)];
    }
    function cc(ch) { return st.out && st.v[ch] / st.R[ch] > st.i[ch]; }
    var BAUDS = [115200, 57600, 9600];
    var ld = lineDev('any', function (line) {
      var s = line.trim().toUpperCase(), m, ch, val;
      function say(x) { ctx.send(x + '\r\n', 15); }
      if (!s) return;
      if (s.length > 15) { st.err = 'Program mnemonic too long'; return; }
      if (s === '*IDN?') return say('GW INSTEK,GPD-3303S,SN:EK123456,V1.00');
      if ((m = /^([VI])SET([12]):(.*)$/.exec(s))) {
        val = parseFloat(m[3]); ch = +m[2] - 1;
        if (m[3].trim() === '') { st.err = 'Missing parameter'; return; }
        if (!/^\d+(\.\d+)?$/.test(m[3].trim())) { st.err = 'Invalid character'; return; }
        if (m[1] === 'V') { if (val > 32) { st.err = 'Data out of range'; return; } st.v[ch] = val; } else { if (val > 3.2) { st.err = 'Data out of range'; return; } st.i[ch] = val; }
        return;
      }
      if ((m = /^([VI])SET([12])\?$/.exec(s))) return say((m[1] === 'V' ? st.v : st.i)[+m[2] - 1].toFixed(3) + m[1].replace('I', 'A'));
      if ((m = /^([VI])OUT([12])\?$/.exec(s))) { val = meas(+m[2] - 1); return say(m[1] === 'V' ? val[0].toFixed(3) + 'V' : val[1].toFixed(3) + 'A'); }
      if (s === 'OUT1') { st.out = true; return; }
      if (s === 'OUT0') { st.out = false; return; }
      if (s === 'STATUS?') { val = BAUDS.indexOf(ctx.devBaud()); return say((cc(0) ? '0' : '1') + (cc(1) ? '0' : '1') + '10' + '0' + (st.out ? '1' : '0') + (val & 1) + (val >> 1)); }
      if (s === 'ERR?') { val = st.err || 'No Error.'; st.err = ''; return say(val); }
      if ((m = /^BAUD([012])$/.exec(s))) { ctx.setBaud(BAUDS[+m[1]]); return; }
      if (/^(BEEP[01]|TRACK[012]|LOCAL|RCL[1-4]|SAV[1-4])$/.test(s)) return;
      if (s === 'HELP?') return say('ISET VSET IOUT VOUT TRACK BEEP OUT STATUS *IDN RCL SAV ERR BAUD LOCAL');
      if (/^(OUT|BEEP|TRACK|BAUD|RCL|SAV)$/.test(s)) { st.err = 'Missing parameter'; return; }
      st.err = 'Undefined header';
    }, ctx.now);
    return { onBytes: ld.onBytes, garbage: function () { ld.garbage(); st.err = 'Invalid character'; }, inst: { setLoad: function (ch, ohm) { st.R[ch - 1] = Math.max(0.1, ohm); }, state: function () { return st; } } };
  }

  /* 2) Keysight 34461A（USBTMC 或 LAN socket 5025，命令一樣） */
  function scpiIs(pattern, hdr) {
    var p = pattern.split(':'), h = hdr.replace(/^:/, '').split(':'), i, sh;
    if (p.length !== h.length) return false;
    for (i = 0; i < p.length; i++) { sh = p[i].replace(/[a-z]/g, ''); if (h[i] !== sh.toUpperCase() && h[i] !== p[i].toUpperCase()) return false; }
    return true;
  }
  function makeDmm(ctx) {
    var st = { func: 'VOLT', nplc: 10, errs: [], sig: { VOLT: 4.99871, RES: 1000.23, CURR: 0.0000012 }, busyUntil: 0, last: null };
    function err(c, t) { st.erred = true; if (st.errs.length < 20) st.errs.push(c + ',"' + t + '"'); }
    function tMeas() { return st.nplc / 60 * 1000 * 2 + 20; }      // 60 Hz、含自動歸零（示意）
    function reading() { var base = st.sig[st.func]; if (Math.abs(base) > 1200) return 9.9e37; return base * (1 + gauss(ctx.rng) * 4e-6 * Math.sqrt(10 / st.nplc)) + (st.func === 'VOLT' ? 2e-5 * Math.sin(ctx.now() / 9000) : 0); }
    function exec(line) {
      var s = line.trim(), q, sp, hdr, arg, f, any = ['', 'SENS:', 'SENSe:'];
      function say(x, d) { ctx.send(x + '\n', d || 15); }
      function is(list) { return list.some(function (p) { return scpiIs(p, hdr); }); }
      if (!s) return;
      sp = s.search(/\s/); hdr = (sp < 0 ? s : s.slice(0, sp)).toUpperCase(); arg = sp < 0 ? '' : s.slice(sp + 1).trim();
      q = /\?$/.test(hdr); if (q) hdr = hdr.slice(0, -1);
      if (hdr === '*IDN' && q) return say('Keysight Technologies,34461A,MY53200000,A.02.08-02.37-02.08-00.49-01-01');
      if (hdr === '*RST' && !q) { st.func = 'VOLT'; st.nplc = 10; return; }
      if (hdr === '*CLS' && !q) { st.errs = []; return; }
      if (hdr === '*OPC' && q) return say('1', Math.max(15, st.busyUntil - ctx.now()));
      if (is(['SYSTem:ERRor', 'SYSTem:ERRor:NEXT']) && q) return say(st.errs.length ? st.errs.shift() : '+0,"No error"');
      f = is(['MEASure:VOLTage:DC', 'MEASure:VOLTage']) ? 'VOLT' : is(['MEASure:RESistance']) ? 'RES' : is(['MEASure:CURRent:DC', 'MEASure:CURRent']) ? 'CURR' : '';
      if (f) { if (!q) return err(-113, 'Undefined header'); st.func = f; st.nplc = 10; st.busyUntil = ctx.now() + tMeas(); return say(sci(reading()), tMeas()); }
      f = is(['CONFigure:VOLTage:DC', 'CONFigure:VOLTage']) ? 'VOLT' : is(['CONFigure:RESistance']) ? 'RES' : is(['CONFigure:CURRent:DC', 'CONFigure:CURRent']) ? 'CURR' : '';
      if (f && !q) { st.func = f; st.nplc = 10; return; }
      if (is(['CONFigure']) && q) return say('"' + st.func + ' ' + (st.func === 'VOLT' ? '+1.00000000E+01,+3.00000000E-06' : st.func === 'RES' ? '+1.00000000E+03,+1.00000000E-03' : '+1.00000000E-04,+1.00000000E-10') + '"');
      if (any.some(function (pre) { return scpiIs(pre + 'VOLTage:DC:NPLC', hdr) || scpiIs(pre + 'VOLTage:NPLC', hdr) || scpiIs(pre + 'RESistance:NPLC', hdr); })) {
        if (q) return say(sci(st.nplc));
        if (arg === '') return err(-109, 'Missing parameter');
        if ([0.02, 0.2, 1, 10, 100].indexOf(parseFloat(arg)) < 0) return err(-222, 'Data out of range');
        st.nplc = parseFloat(arg); return;
      }
      if (hdr === 'READ' && q) { st.busyUntil = ctx.now() + tMeas(); return say(sci(reading()), tMeas()); }
      if (is(['INITiate', 'INITiate:IMMediate']) && !q) { st.busyUntil = ctx.now() + tMeas(); st.last = reading(); return; }
      if (is(['FETCh']) && q) { if (st.last === null) return err(-230, 'Data corrupt or stale'); return say(sci(st.last), Math.max(15, st.busyUntil - ctx.now())); }
      err(-113, 'Undefined header');
    }
    var ld = lineDev('lf', function (l) { l.split(';').forEach(exec); }, ctx.now);
    return {
      onBytes: function (b) { st.erred = false; if (ctx.kind === 'usbtmc') toText(b).replace(/[\r\n]+$/, '').split(/\n|;/).forEach(exec); else ld.onBytes(b); },   // USBTMC 一次寫入就是一則完整訊息
      onRead: function (hasData) { if (ctx.dev.err420 && ctx.kind === 'usbtmc' && !hasData && !st.erred) err(-420, 'Query UNTERMINATED'); },      // 預設關閉（時機沒查證）：open('dmm',{device:{err420:true}}) 才會在「沒送查詢就讀」時記一筆 -420
      garbage: ld.garbage, inst: { setInput: function (v) { st.sig.VOLT = v; }, state: function () { return st; } }
    };
  }

  /* 3) A&D 電子天平：出廠是 Key mode（按 PRINT 且穩定才送一筆）；改成 Stream mode 才會一直送 */
  function makeBal(ctx) {
    var st = { target: 0, shown: 0, zero: 0, changed: -1e9, stream: ctx.dev.stream === true, t: 0, nextOut: 100, wantStable: false, cap: 220 };
    function stable() { return st.t - st.changed > 1200 && Math.abs(st.target - st.shown) < 0.004; }
    function fmt() {
      var w = st.shown - st.zero + gauss(ctx.rng) * (stable() ? 0.002 : 0.04), a;
      if (st.shown > st.cap) return 'OL,+9999999E+19\r\n';
      w = Math.round(w * 100) / 100; if (w === 0) w = 0;
      a = Math.abs(w).toFixed(2); while (a.length < 8) a = '0' + a;
      return (stable() ? 'ST' : 'US') + ',' + (w < 0 ? '-' : '+') + a + '  g\r\n';
    }
    var ld = lineDev('crlf', function (line) {
      var s = line.trim().toUpperCase();
      if (s === 'Q') ctx.send(fmt(), 20);
      else if (s === 'S') st.wantStable = true;
      else if (s === 'Z' || s === 'R' || s === 'T') { st.zero = st.shown; }
      else if (s === 'SIR') st.stream = true;
      else if (s === 'C') st.stream = false;
    }, ctx.now);
    return {
      onBytes: ld.onBytes, garbage: ld.garbage,
      step: function (to) {
        while (st.t < to) {
          var n = Math.min(to, st.t + 10), dt = n - st.t;
          st.shown += (st.target - st.shown) * (1 - Math.exp(-dt / 150)); st.t = n;
          if (st.t >= st.nextOut) { st.nextOut += 100; if (st.stream) ctx.sendAt(fmt(), st.t); else if (st.wantStable && stable()) { st.wantStable = false; ctx.sendAt(fmt(), st.t); } }
        }
      },
      inst: { put: function (g) { st.target = Math.max(0, +g || 0); st.changed = st.t; }, remove: function () { st.target = 0; st.changed = st.t; }, print: function () { st.wantStable = true; }, state: function () { return st; } }
    };
  }

  /* 4) 台達 DTB 溫控器（Modbus ASCII／RTU） */
  function makeDtb(ctx) {
    var st = { pv: 25, sv: 100, hi: 500, lo: -20, t: 0, station: ctx.dev.station || 1, mode: ctx.dev.mode || 'ascii', wen: 0, run: 1, open: false };
    var regs = {
      maxQty: 8, fn4: false,
      read: function (a) { return a === 0x1000 ? (st.open ? 0x8003 : i16((st.pv + gauss(ctx.rng) * 0.04) * 10)) : a === 0x1001 ? i16(st.sv * 10) : undefined; },
      write: function (a, v) { if (a !== 0x1001) return 2; if (!st.wen) return 2; var s = (v > 32767 ? v - 65536 : v) / 10; if (s > st.hi || s < st.lo) return 3; st.sv = s; return 0; }
    };
    function bitAt(a) { return a === 0x0810 ? st.wen : a === 0x0814 ? st.run : undefined; }
    function pdu(func, d) {
      var a, v, q, i, out;
      if (func === 5) { if (d.length !== 4) return [0x85, 3]; a = d[0] << 8 | d[1]; v = d[2] << 8 | d[3]; if (bitAt(a) === undefined) return [0x85, 2]; if (v !== 0xFF00 && v !== 0) return [0x85, 3]; if (a === 0x0810) st.wen = v ? 1 : 0; else st.run = v ? 1 : 0; return [5].concat(d); }
      if (func === 2) { if (d.length !== 4) return [0x82, 3]; a = d[0] << 8 | d[1]; q = d[2] << 8 | d[3]; if (q < 1 || q > 16) return [0x82, 3]; out = 0; for (i = 0; i < q; i++) { v = bitAt(a + i); if (v === undefined) { if (i === 0) return [0x82, 2]; v = 0; } out |= v << i; } return q > 8 ? [2, 2, out & 255, out >> 8] : [2, 1, out]; }
      return modbusPdu(func, d, regs);
    }
    function handle(b) { if (b[0] !== st.station) return null; return [st.station].concat(pdu(b[1], b.slice(2))); }
    var ld = lineDev('crlf', function (line) {
      var b, r;
      if (st.mode !== 'ascii' || line.charAt(0) !== ':') return;
      b = parseHex(line.slice(1)); if (!b || b.length < 3) return;
      if (((b.reduce(function (x, y) { return x + y; }, 0)) & 255) !== 0) return;       // LRC 不對：不回應
      r = handle(b.slice(0, -1)); if (r) ctx.send(asciiFrame(r), 30);
    }, ctx.now);
    return {
      onBytes: function (b) {
        if (st.mode === 'ascii') return ld.onBytes(b);
        var c, r; if (b.length < 4) return;
        c = crc16(b.slice(0, -2)); if (b[b.length - 2] !== (c & 255) || b[b.length - 1] !== (c >> 8)) return;   // CRC 不對：不回應
        r = handle(b.slice(0, -2)); if (r) ctx.send(rtuFrame(r), 30);
      },
      garbage: ld.garbage,
      step: function (to) { var dt = to - st.t; if (dt > 0) { st.pv += ((st.run ? st.sv : 25) - st.pv) * (1 - Math.exp(-dt / 20000)); st.t = to; } },
      inst: { sensorOpen: function (v) { st.open = !!v; }, state: function () { return st; } }
    };
  }

  /* 4b) 研華 ADAM-4017（RS-485，ASCII 命令，CR 結尾） */
  function makeAdam4(ctx) {
    var st = { addr: '01', v: [7.2111, 7.2567, 1.4567, -0.0312, 0, 0, 0, 0] };
    function f7(x) { x += gauss(ctx.rng) * 0.0004; var a = Math.abs(x); return (x < 0 ? '-' : '+') + (a < 10 ? a.toFixed(4) : a.toFixed(3)); }
    var ld = lineDev('cr', function (line) {
      var m = /^#([0-9A-Fa-f]{2})([0-7]?)$/.exec(line.replace(/^\n+/, ''));
      if (!m || m[1].toUpperCase() !== st.addr) return;                 // 語法錯、位址不對：沒有回應
      ctx.send('>' + (m[2] === '' ? st.v.map(f7).join('') : f7(st.v[+m[2]])) + '\r', 20);
    }, ctx.now);
    return { onBytes: ld.onBytes, garbage: ld.garbage, inst: { setInput: function (ch, v) { st.v[ch] = Math.max(-10, Math.min(10, +v)); }, state: function () { return st; } } };
  }

  /* 5) 研華 ADAM-6017（Modbus TCP） */
  var ADAM_RANGES = { pm10: { name: '±10 V', lo: -10, hi: 10, unit: 'V' }, pm150m: { name: '±150 mV', lo: -0.15, hi: 0.15, unit: 'V' }, ma0_20: { name: '0–20 mA', lo: 0, hi: 20, unit: 'mA' }, ma4_20: { name: '4–20 mA', lo: 4, hi: 20, unit: 'mA' } };
  function makeAdam(ctx) {
    var st = { ch: [['pm10', 2.5], ['ma4_20', 12], ['ma0_20', 7.3], ['pm150m', 0.1], ['pm10', 0], ['pm10', 0], ['pm10', 0], ['pm10', 0]], buf: [] };
    function raw(i) { var c = st.ch[i], r = ADAM_RANGES[c[0]]; return Math.max(0, Math.min(65535, Math.round((c[1] - r.lo) / (r.hi - r.lo) * 65535 + gauss(ctx.rng) * 2))); }
    var regs = { maxQty: 8, fn4: true, read: function (a) { return a >= 0 && a <= 7 ? raw(a) : undefined; } };
    return {
      onBytes: function (b) {
        st.buf = st.buf.concat(b);
        while (st.buf.length >= 7) {
          var len = st.buf[4] << 8 | st.buf[5], f;
          if (st.buf[2] || st.buf[3] || len < 2 || len > 253) { st.buf = []; return; }     // 協定代號不是 0：整包丟掉
          if (st.buf.length < 6 + len) return;                                           // 還沒收完，繼續等
          f = st.buf.slice(0, 6 + len); st.buf = st.buf.slice(6 + len);
          if (f[6] !== 1) continue;                                                      // 站號（Unit ID）不是 1：不回應
          ctx.send(mbap(f[0] << 8 | f[1], 1, modbusPdu(f[7], f.slice(8), regs)), 8);
        }
      },
      garbage: function () { st.buf = []; },
      inst: { setInput: function (ch, v) { st.ch[ch][1] = v; }, state: function () { return st; } }
    };
  }

  /* 6) NI USB-6009：沒有命令，只有電壓 */
  function makeDaq(ctx) {
    var st = { bar: 5, mA: 12, pot: 0.4 };
    function volt(ch) { return ch === 0 ? 1 + st.bar / 10 * 4 : ch === 1 ? st.mA * 0.25 : ch === 2 ? st.pot * 5 : 0.02; }
    return {
      daqRead: function (ch, n, rate, t0) {
        var out = [], lsb = 20 / 16384, i, v;
        for (i = 0; i < n; i++) { v = volt(ch) + gauss(ctx.rng) * 0.002 + 0.003 * Math.sin(2 * Math.PI * 60 * (t0 / 1000 + i / rate)); out.push(Math.max(-10, Math.min(10, Math.round(v / lsb) * lsb))); }
        return out;
      },
      inst: { set: function (name, v) { if (name === 'pressure') st.bar = Math.max(0, Math.min(10, +v)); if (name === 'current') st.mA = Math.max(0, Math.min(24, +v)); if (name === 'pot') st.pot = Math.max(0, Math.min(1, +v)); }, state: function () { return st; } }
    };
  }

  /* 這一張表是所有儀器資料的唯一來源。
     checked：查證員對過說明書的項目；unverified：說明書沒寫或查不到、這裡用模擬值的項目（頁面會標出來）。 */
  var NOTE_SIM = '說明書沒寫回覆長什麼樣子：下面看到的是模擬的回覆，實機請自己收一筆原始資料來看。';
  var INSTRUMENTS = [
    { id: 'gpd', name: 'GPD-3303S 電源供應器', brand: 'GW Instek 固緯', kind: 'serial', iface: 'USB 虛擬 COM（電腦上看到的是一個序列埠）',
      defaults: { baud: 9600, bits: 8, parity: 'N', stop: 1, term: '\n' }, replyTerm: '\r\n', bauds: [9600, 57600, 115200], manual: { title: 'GPD-X303S Series User Manual（遠端控制章節）', url: 'https://www.gwinstek.com' }, verified: false, make: makeGpd,
      checked: ['只有 USB（虛擬 COM）；鮑率 9600／57600／115200 可選，8-N-1，無流量控制', '設定類命令以 LF 結尾、查詢以 CR 結尾；不分大小寫；命令 15 字元內', '命令表與範圍 0～32.000 V、0～3.200 A', '*IDN? 的格式；STATUS? 回 8 個 0／1；ERR? 的錯誤訊息', '最短回應時間 10 ms'],
      unverified: ['沒加結尾字元的半截命令，儀器會留多久（這裡模擬成 1 秒沒有下文就丟掉）', '出廠鮑率（手冊沒寫，這裡模擬成 9600）', '回覆帶不帶單位、回覆的結尾字元（手冊沒寫，這裡模擬成「5.000V\\r\\n」）', '沒有錯誤時 ERR? 的回覆文字', 'STATUS? 第 6、7 位元和鮑率的對應'],
      card: { how: '一問一答，文字（ASCII）。命令後面要有結尾字元。', simNote: NOTE_SIM,
        cmds: [['*IDN?', '問它是誰'], ['VSET1:5.0', '設定 CH1 電壓（沒有回覆）'], ['VSET1?', '問設定值'], ['ISET1:1.0', '設定 CH1 電流上限'], ['VOUT1?／IOUT1?', '問實際輸出的電壓／電流'], ['OUT1／OUT0', '輸出開／關（沒有通道號）'], ['STATUS?', '8 個 0／1 的狀態'], ['ERR?', '問最後一個錯誤']],
        notes: ['鮑率有三種可選，出廠是哪一種手冊沒寫：到面板看，或連上後用 STATUS? 確認。', '設定類命令沒有回覆；想確認就再問一次（VSET1?）。', '輸出關著時 VOUT1? 會是 0。'] },
      presets: ['*IDN?', 'VSET1:5.0', 'VSET1?', 'OUT1', 'VOUT1?', 'IOUT1?', 'STATUS?', 'ERR?'],
      actions: [['CH1 負載換成 2 Ω', function (i) { i.setLoad(1, 2); }], ['CH1 負載換回 10 Ω', function (i) { i.setLoad(1, 10); }]], demo: ['OUT1\n', 'VOUT1?\n'] },
    { id: 'dmm', name: '34461A 數位電表', brand: 'Keysight', kind: 'usbtmc', ifaces: ['usbtmc', 'tcp'], iface: 'USB（USBTMC）或網路線（LAN socket）', host: '192.168.1.60', port: 5025, resource: 'USB0::0x2A8D::0x1301::MY53200000::INSTR',
      defaults: { term: '\n' }, replyTerm: '\n', manual: { title: 'Keysight Truevolt Series Operating and Service Guide（SCPI 命令）', url: 'https://www.keysight.com' }, verified: false, make: makeDmm,
      checked: ['*IDN? 回四欄：廠牌,型號,序號,韌體版本', '讀數是科學記號字串，例如 +8.54530000E+01；過載回 9.9E37', 'SYST:ERR? 沒有錯誤回 +0,"No error"；佇列最多 20 筆、先進先出、讀了就清', 'LAN：5025 是 SCPI Socket，5024 是 Telnet'],
      unverified: ['沒加結尾字元的半截命令，儀器會留多久（這裡模擬成 1 秒沒有下文就丟掉）', '回覆的結尾字元（手冊沒寫，這裡模擬成 \\n）', 'USB 資源名稱裡的編號', '量測要花多久（這裡用 NPLC÷60 秒×2＋20 ms 示意）', '讀數的雜訊大小', '-222、-109 這幾個錯誤碼出現的時機', '用 USB 時沒送查詢就去讀，實機可能會多記一筆 -420 Query UNTERMINATED（這裡預設不模擬）'],
      card: { how: 'SCPI：一問一答，文字。USB 和網路的命令完全一樣，只有「怎麼連」不同。', simNote: '回覆的結尾字元手冊沒寫：自己收一筆，用「看不見的字元」那一列確認。',
        cmds: [['*IDN?', '問它是誰'], ['MEAS:VOLT:DC?', '量一次直流電壓'], ['CONF:VOLT:DC', '設定成量直流電壓（沒有回覆）'], ['VOLT:DC:NPLC 100', '積分時間（越大越準、越慢）'], ['READ?', '照目前設定量一次'], ['SYST:ERR?', '問錯誤佇列'], ['*RST', '回到預設'], ['*OPC?', '做完了回 1']],
        notes: ['下錯命令時儀器不會主動講，要問 SYST:ERR? 才知道。', '走網路時埠號是 5025（5024 是給人用的 Telnet，會多出提示字元），而且要先連線。', '讀數超過量程會回 9.9E37，不是錯誤訊息。'] },
      presets: ['*IDN?', 'MEAS:VOLT:DC?', 'CONF:VOLT:DC', 'VOLT:DC:NPLC 100', 'READ?', 'SYST:ERR?', '*RST'], demo: ['MEAS:VOLT:DC?\n'] },
    { id: 'bal', name: 'FX-i 電子天平', brand: 'A&D', kind: 'serial', iface: 'RS-232C（D-Sub 9 針）',
      defaults: { baud: 2400, bits: 7, parity: 'E', stop: 1, term: '\r\n' }, replyTerm: '\r\n', devOpts: [['key', '輸出模式 Key：按 PRINT 且穩定才送一筆（出廠）', { stream: false }], ['stream', '輸出模式 Stream：不用問，一直送', { stream: true }]],
      manual: { title: 'A&D FX-i／FZ-i 使用說明書：RS-232C 與資料輸出', url: 'https://www.aandd.jp' }, verified: false, make: makeBal,
      checked: ['出廠 2400 bps、7 位元、偶同位、1 停止位元，結尾字元 CR LF，A&D 標準格式', '出廠是 Key mode（按 PRINT 且穩定才送）；Stream mode 才連續送', '一筆 15 個字元（不含結尾字元）：ST,+00001.27  g／US,-00183.69  g／OL,+9999999E+19', '命令 Q、S、SIR、C、R／Z、T，都要加結尾字元'],
      unverified: ['沒加結尾字元的半截命令，儀器會留多久（這裡模擬成 1 秒沒有下文就丟掉）', 'Stream 模式每秒幾筆（這裡用 10 筆；手冊建議 20 筆／秒時鮑率 4800 以上）', '秤量上限（這裡用 220 g）', '多久算穩定（示意）', '下錯命令時的回應（這裡模擬成不回應）'],
      card: { how: '出廠設定下它不會自己送：要按天平上的 PRINT，或送 Q 命令。改成 Stream 模式才會一直送。',
        cmds: [['（一筆資料）', '標頭,數值 單位 CR LF，共 15 字元＋結尾字元'], ['ST／US／OL', '標頭：穩定／還在晃／超載'], ['Q', '立刻要一筆'], ['S', '穩定時要一筆'], ['SIR／C', '開始連續送／取消'], ['R 或 Z', '歸零']],
        notes: ['出廠的通訊參數是 2400、7、E、1，不是常見的 9600-8-N-1。', '接上去什麼都收不到，先看輸出模式：Key 模式本來就不會自己送。', 'Stream 模式沒有人讀的時候，資料會在電腦的緩衝區裡越積越多。'] },
      presets: ['Q', 'S', 'SIR', 'C', 'Z'], actions: [['按天平上的 PRINT', function (i) { i.print(); }], ['放上零件（50 g）', function (i) { i.put(50); }], ['換成 123.45 g 的零件', function (i) { i.put(123.45); }], ['放上 300 g（超過秤量）', function (i) { i.put(300); }], ['拿走零件', function (i) { i.remove(); }]], demo: ['Q\r\n'] },
    { id: 'dtb', name: 'DTB 溫度控制器', brand: 'Delta 台達', kind: 'serial', iface: 'RS-485（兩條線），Modbus ASCII 或 RTU', binary: true, bauds: [2400, 4800, 9600, 19200, 38400],
      defaults: { baud: 9600, bits: 7, parity: 'E', stop: 1, term: '\r\n' }, replyTerm: '\r\n', devOpts: [['ascii', 'Modbus ASCII，9600-7-E-1，站號 1', { mode: 'ascii' }], ['rtu', 'Modbus RTU，9600-8-E-1，站號 1', { mode: 'rtu', bits: 8, parity: 'E' }]],
      manual: { title: '台達 DTB 系列 Instruction Sheet：RS-485 通訊', url: 'https://www.deltaww.com' }, verified: false, make: makeDtb,
      checked: ['鮑率 2400～38400；不支援 7N1、8O2、8E2；Modbus ASCII 或 RTU', '功能碼 03H 讀（最多 8 個字）、06H 寫 1 個字、02H 讀位元、05H 寫位元', '1000H＝PV（單位 0.1）、1001H＝SV、0810H＝通訊寫入許可（預設 0 禁止）、0814H＝RUN／STOP', 'PV 的錯誤值：8002H 初始中、8003H 感測器未接、8004H 輸入錯誤', 'RTU 範例：讀 1000H 起 2 個字是 01 03 10 00 00 02 C0 CB'],
      unverified: ['沒加結尾字元的半截命令，儀器會留多久（這裡模擬成 1 秒沒有下文就丟掉）', '出廠站號、鮑率、格式（查不到，這裡模擬成站號 1、9600、7-E-1、ASCII）', '通訊寫入被禁止時寫 SV 的回應（這裡模擬成例外碼 02）', '非法位址、數值超出範圍回的例外碼', 'SV 可設定的範圍（這裡用 −20.0～500.0）', '溫度上升的快慢（示意）'],
      card: { how: 'Modbus：一問一答。數值是整數，單位 0.1 度（250 代表 25.0）。', simNote: '出廠的站號、鮑率、格式查不到：到面板把目前的通訊設定讀出來，電腦這邊照著設。',
        cmds: [['功能碼 03', '讀暫存器（一次最多 8 個字）'], ['功能碼 06', '寫一個暫存器'], ['功能碼 05', '寫一個位元（FF00＝1、0000＝0）'], ['1000H', '目前溫度 PV'], ['1001H', '設定溫度 SV'], ['0810H（位元）', '通訊寫入許可，預設 0：要先寫成 1 才能改 SV'], ['ASCII 模式', '「:」開頭，十六進位文字，LRC，CR LF 結尾'], ['RTU 模式', '直接送位元組，最後兩個是 CRC（低位元組在前）']],
        notes: ['站號不對、檢查碼不對：它完全不回應，只會等到逾時。', 'PV 讀到 8003H 不是 3276.3 度，是「感測器沒接」。', '儀器面板上選 ASCII 還是 RTU，電腦這邊就要跟著設。'] },
      presets: function (dc) { var rd = [1, 3, 0x10, 0x00, 0, 2], en = [1, 5, 0x08, 0x10, 0xFF, 0], wr = [1, 6, 0x10, 0x01, 0x01, 0xF4], bad = [1, 3, 0x20, 0x00, 0, 1], L = [['讀 PV、SV', rd], ['允許通訊寫入', en], ['寫 SV = 50.0', wr], ['讀不存在的位址', bad]]; return L.map(function (x) { return dc && dc.mode === 'rtu' ? { label: x[0], hex: hex(rtuFrame(x[1])) } : { label: x[0], text: asciiFrame(x[1]).trim() }; }); },
      actions: [['拔掉感測器的線', function (i) { i.sensorOpen(true); }], ['接回感測器', function (i) { i.sensorOpen(false); }]], demo: [asciiFrame([1, 3, 0x10, 0x00, 0, 2])] },
    { id: 'adam4017', name: 'ADAM-4017 類比輸入模組', brand: 'Advantech 研華', kind: 'serial', iface: 'RS-485（兩條線），ASCII 命令',
      defaults: { baud: 9600, bits: 8, parity: 'N', stop: 1, term: '\r' }, replyTerm: '\r', manual: { title: 'ADAM-4000 Series User Manual：命令集', url: 'https://www.advantech.com' }, verified: false, make: makeAdam4,
      checked: ['出廠 9600、位址 01', '#01＋CR 讀 8 個通道：回 > 加 8 組、每組 7 個字元（含正負號）、沒有單位、CR 結尾', '#AAN 讀單一通道，例如回 >+1.4567', '位址不存在或語法錯：沒有回應'],
      unverified: ['沒加結尾字元的半截命令，儀器會留多久（這裡模擬成 1 秒沒有下文就丟掉）', '資料格式 8-N-1', '各通道的電壓是本站設定的情境', '數值超過 10 時小數位數怎麼排（這裡維持 7 個字元）', '命令後面多一個 \\n 時的反應（這裡會忽略）'],
      card: { how: '一問一答，文字。命令和回覆都只用 CR 結尾（沒有 LF）。',
        cmds: [['#01', '讀位址 01 的 8 個通道'], ['#012', '只讀位址 01 的通道 2'], ['回覆', '> 開頭，8 個數值黏在一起：每個 7 個字元，沒有逗號']],
        notes: ['8 個數值之間沒有分隔符號，要照「每 7 個字元一組」去切。', '位址打錯、命令打錯：它不會回錯誤訊息，就是不回。', '結尾字元是 CR，不是 LF。讀的時候也要等 CR。'] },
      presets: ['#01', '#012', '#02'], actions: [['通道 2 接到 3.3 V', function (i) { i.setInput(2, 3.3); }], ['通道 2 接回 1.4567 V', function (i) { i.setInput(2, 1.4567); }]], demo: ['#01\r'] },
    { id: 'adam6017', name: 'ADAM-6017 類比輸入模組', brand: 'Advantech 研華', kind: 'tcp', iface: '網路線（RJ-45），Modbus TCP', host: '192.168.1.50', port: 502, binary: true,
      defaults: { term: '' }, manual: { title: 'ADAM-6000 Series User Manual：Modbus 位址表', url: 'https://www.advantech.com' }, verified: false, make: makeAdam, ranges: ADAM_RANGES,
      channels: [['AI0', 'pm10'], ['AI1', 'ma4_20'], ['AI2', 'ma0_20'], ['AI3', 'pm150m'], ['AI4', 'pm10'], ['AI5', 'pm10'], ['AI6', 'pm10'], ['AI7', 'pm10']],
      checked: ['位址 40001 起是 AI 通道 0～7', '可以用功能碼 03 或 04 讀'],
      unverified: ['埠號（這裡用 Modbus TCP 慣用的 502）', '原始值怎麼換算（這裡模擬成 16 位元 0～65535 線性對應量程的下限～上限）', 'Unit ID 要填 1', '模組的 IP（這裡用 192.168.1.50 示意）', '各通道的量程設定（示意）'],
      card: { how: 'Modbus TCP：先連線（IP、埠），再一問一答，全部是位元組。', simNote: '原始值的換算公式查不到：這裡的換算是模擬的。實機要對照說明書的量程表，並且拿一個已知的電壓來驗算。',
        cmds: [['MBAP 標頭', '交易編號 2、協定 0000、長度 2、站號 1'], ['功能碼 03／04', '讀暫存器'], ['位址 0000～0007', 'AI0～AI7（Modbus 位址 40001～40008）'], ['原始值', '一個 16 位元的整數，要依這一通道的量程換算']],
        notes: ['沒有先連線就寫，什麼都送不出去。', 'Modbus TCP 沒有 CRC／LRC，但長度欄位要對，不然模組會一直等剩下的位元組。', '0 V 不一定是原始值 0：這裡模擬的換算是 ±10 V 的量程把 0 V 放在中間。實機的換算方式要看說明書的資料格式表，或用兩個已知電壓自己對。'] },
      presets: [{ label: '讀 AI0～AI7', hex: hex(mbap(1, 1, [3, 0, 0, 0, 8])) }, { label: '讀 AI0', hex: hex(mbap(2, 1, [4, 0, 0, 0, 1])) }, { label: '讀不存在的位址', hex: hex(mbap(3, 1, [3, 0, 0x20, 0, 1])) }], demo: [['connect'], mbap(1, 1, [3, 0, 0, 0, 8])] },
    { id: 'daq', name: 'USB-6009 接三個感測器', brand: 'NI', kind: 'daq', iface: '感測器的訊號線直接鎖在端子上（差動接法 ai0～ai3）', defaults: {}, manual: { title: 'NI USB-6008/6009 User Guide and Specifications', url: 'https://www.ni.com' }, verified: false, make: makeDaq,
      channels: [['ai0', '壓力傳送器：1～5 V 對應 0～10 bar'], ['ai1', '4～20 mA 的訊號，經 250 Ω 電阻變成 1～5 V'], ['ai2', '電位計：0～5 V'], ['ai3', '沒接東西']],
      checked: ['8 個單端或 4 個差動通道；差動 14 位元、單端 13 位元', '最高 48 kS/s（所有通道合計）', '差動範圍 ±20、±10、±5、±4、±2.5、±2、±1.25、±1 V；單端 ±10 V', '輸入阻抗 144 kΩ', '4～20 mA 要外接分流電阻（電阻乘最大電流不能超過輸入範圍）'],
      unverified: ['雜訊大小（示意）', '三個感測器的接法與量程是本站設定的情境', '250 Ω 是常見做法，不是 NI 指定的值'],
      card: { how: '沒有命令、沒有回覆。感測器給的是電壓，DAQ 卡把電壓變成數字。',
        cmds: [['ai0', '壓力傳送器 1～5 V ＝ 0～10 bar'], ['ai1', '4～20 mA 經 250 Ω ＝ 1～5 V（常見做法）'], ['ai2', '電位計 0～5 V'], ['取樣', '通道、幾點、每秒幾點（差動、±10 V、14 位元）']],
        notes: ['讀回來的是一串電壓（陣列），不是字串。', '同一個電壓每次讀都差一點點：雜訊和量化。', '電壓要自己依感測器的規格換算成壓力、電流。'] },
      actions: [['壓力調到 2.0 bar', function (i) { i.set('pressure', 2); }], ['壓力調到 7.5 bar', function (i) { i.set('pressure', 7.5); }], ['電流調到 4 mA', function (i) { i.set('current', 4); }], ['電流調到 20 mA', function (i) { i.set('current', 20); }]] }
  ];
  function defOf(id) { for (var i = 0; i < INSTRUMENTS.length; i++) if (INSTRUMENTS[i].id === id) return INSTRUMENTS[i]; return null; }
  function list() {
    return INSTRUMENTS.map(function (d) {
      var o = {}; Object.keys(d).forEach(function (k) { if (typeof d[k] !== 'function' && k !== 'actions' && k !== 'demo') o[k] = JSON.parse(JSON.stringify(d[k])); });
      o.presets = typeof d.presets === 'function' ? d.presets({}) : (d.presets || []).slice();
      o.actions = (d.actions || []).map(function (a) { return a[0]; });
      return o;
    });
  }

  /* ====================================================================== 連線（session） */
  function Session(def, cfg) {
    var self = this, k;
    cfg = cfg || {};
    this.id = def.id; this.def = def; this.now = 0; this.rx = []; this.log = []; this.events = []; this.closed = false; this.overrun = 0; this.lineErrors = { parity: 0, framing: 0, baud: 0 };
    this.kind = cfg.iface && def.ifaces && def.ifaces.indexOf(cfg.iface) >= 0 ? cfg.iface : def.kind;
    this.cfg = { timeoutMs: 2000 }; for (k in def.defaults) this.cfg[k] = def.defaults[k]; for (k in cfg) if (k !== 'device' && k !== 'seed') this.cfg[k] = cfg[k];
    this.devFmt = { baud: def.defaults.baud, bits: def.defaults.bits, parity: def.defaults.parity, stop: def.defaults.stop }; this.devCfg = cfg.device || {};
    ['baud', 'bits', 'parity', 'stop'].forEach(function (f) { if (self.devCfg[f] != null) self.devFmt[f] = self.devCfg[f]; });
    this.connected = this.kind !== 'tcp';
    this.rng = rng32(cfg.seed == null ? 20261111 : cfg.seed);
    this.dev = def.make({ rng: this.rng, kind: this.kind, dev: this.devCfg, now: function () { return self.now; },
      send: function (x, delay) { self._emit(toBytes(x), self.now + (delay || 0)); }, sendAt: function (x, at) { self._emit(toBytes(x), at); },
      setBaud: function (b) { self.devFmt.baud = b; }, devBaud: function () { return self.devFmt.baud; } });
    this.inst = this.dev.inst || {};
    Object.keys(this.inst).forEach(function (m) { if (!(m in self)) self[m] = function () { self._run(self.now); return self.inst[m].apply(self.inst, arguments); }; });
  }
  Session.prototype._note = function (dir, bytes, note) { var e = { t: Math.round(this.now), dir: dir, bytes: bytes || [], text: toText(bytes || []), note: note || '' }; this.log.push(e); if (this.log.length > 500) this.log.shift(); return e; };
  Session.prototype._emit = function (bytes, at) { if (this.kind === 'serial') at += bytes.length * charMs(this.devFmt); this.events.push({ at: at, bytes: bytes }); };
  Session.prototype._deliver = function () {
    var self = this, due = [], rest = [], pc = this.cfg, dv = this.devFmt;
    this.events.forEach(function (e) { (e.at <= self.now ? due : rest).push(e); }); this.events = rest;
    due.sort(function (a, b) { return a.at - b.at; }).forEach(function (e) {
      var b = e.bytes;
      if (self.kind === 'tcp' && !self.connected) return;
      if (self.kind === 'serial') {
        if (!baudOk(pc.baud, dv.baud)) { b = garble(b, dv.baud, pc.baud); self.lineErrors.baud += b.length; }
        else b = b.map(function (x) { var r = reframe(x, dv, pc); if (r.perr) self.lineErrors.parity++; if (r.ferr) self.lineErrors.framing++; return r.byte; });
      }
      b.forEach(function (x) { if (self.rx.length < 4096) self.rx.push(x); else self.overrun++; });
    });
  };
  Session.prototype._run = function (until, stop) {
    for (;;) {
      this._deliver();
      if (stop && stop()) return true;
      if (this.now >= until) return false;
      var next = Math.min(until, this.now + 10), ev = null;
      if (this.dev.step) this.dev.step(next);
      this.events.forEach(function (e) { if (ev === null || e.at < ev) ev = e.at; });
      this.now = ev !== null && ev < next ? Math.max(ev, this.now) : next;
    }
  };
  Session.prototype.setCfg = function (c) { for (var k in c) this.cfg[k] = c[k]; return this.cfg; };
  Session.prototype.tick = function (ms) { this._run(this.now + Math.max(0, +ms || 0)); return this.now; };
  Session.prototype.connect = function (o) {
    o = o || {};
    if (this.kind !== 'tcp') return { ok: true };
    var host = o.host || this.cfg.host || this.def.host, port = +(o.port || this.cfg.port || this.def.port);
    if (host === this.def.host && this.def.id === 'dmm' && port === 5024) { this.tick(5); this._note('err', [], '5024 是 Telnet 埠'); return { ok: false, error: '5024 是給人用的 Telnet 埠（會多出歡迎訊息和提示字元），這個模擬不提供；程式要連 SCPI Socket 的 5025' }; }
    if (host !== this.def.host || port !== this.def.port) { this.tick(3000); this._note('err', [], '連線失敗：' + host + ':' + port + ' 等了 3000 ms 沒有回應（IP 或埠號不對、線沒接、被防火牆擋住）'); return { ok: false, error: '連線逾時：' + host + ':' + port + ' 沒有回應' }; }
    this.tick(5); this.connected = true; this._note('info', [], '已連線 ' + host + ':' + port); return { ok: true };
  };
  Session.prototype.disconnect = function () { if (this.kind === 'tcp') { this.connected = false; this.rx = []; this.events = []; if (this.dev.garbage) this.dev.garbage(); this._note('info', [], '已中斷連線'); } };
  Session.prototype.write = function (x) {
    var b = toBytes(x), self = this, pc = this.cfg, dv = this.devFmt, got, bad = false;
    if (this.closed) return { ok: false, n: 0, error: '這個連線已經關閉' };
    if (this.kind === 'daq') { this._note('err', [], 'DAQ 沒有命令可以寫：它只量電壓'); return { ok: false, n: 0, error: 'DAQ 卡沒有「命令」，不能寫字串給它' }; }
    this._run(this.now);
    if (this.kind === 'tcp' && !this.connected) { this._note('err', b, '還沒連線就寫：送不出去'); return { ok: false, n: 0, error: '還沒連線（要先 connect）' }; }
    this._note('tx', b);
    if (this.kind === 'serial') {
      this.now += b.length * charMs(pc);
      if (!baudOk(pc.baud, dv.baud)) { if (this.dev.garbage) this.dev.garbage(); return { ok: true, n: b.length }; }
      got = b.map(function (v) { var r = reframe(v, pc, dv); if (r.perr || r.ferr) bad = true; return r.byte; });
      if (bad) { if (self.dev.garbage) self.dev.garbage(); return { ok: true, n: b.length }; }
      b = got;
    }
    this.dev.onBytes(b);
    return { ok: true, n: b.length };
  };
  function findTerm(rx, term) { if (!term) return -1; var t = toBytes(term), i, j, ok; for (i = 0; i + t.length <= rx.length; i++) { ok = true; for (j = 0; j < t.length; j++) if (rx[i + j] !== t[j]) { ok = false; break; } if (ok) return i + t.length; } return -1; }
  Session.prototype.read = function (o, n, rate) {
    var self = this, t0 = this.now, term, count, to, end = -1, hit, bytes, r;
    if (this.kind === 'daq') {                                   // DAQ：read(ch, n, rate) 回傳電壓陣列
      r = []; n = n == null ? 1 : n; rate = rate || 1000;
      if (typeof o !== 'number' || o < 0 || o > 3 || o % 1) r.error = '沒有這個通道（差動接法只有 ai0～ai3）';
      else if (n < 1 || n > 100000) r.error = '點數要在 1～100000';
      else if (rate <= 0 || rate > 48000) r.error = '取樣率超過這張卡的上限（48000 S/s）';
      if (r.error) { this._note('err', [], r.error); return r; }
      r = this.dev.daqRead(o, n, rate, this.now); this.now += n / rate * 1000;
      this._note('rx', [], 'ai' + o + '：' + n + ' 點，' + rate + ' S/s，花了 ' + Math.round(n / rate * 1000) + ' ms'); return r;
    }
    o = o || {};
    if (this.closed) return { bytes: [], text: '', timedOut: true, waitedMs: 0, error: '這個連線已經關閉' };
    if (this.kind === 'tcp' && !this.connected) { this._note('err', [], '還沒連線就讀'); return { bytes: [], text: '', timedOut: true, waitedMs: 0, error: '還沒連線（要先 connect）' }; }
    term = o.term === undefined ? this.cfg.term : o.term; count = o.count == null ? 4096 : o.count; to = o.timeoutMs == null ? this.cfg.timeoutMs : o.timeoutMs;
    this._run(this.now);
    if (this.dev.onRead) this.dev.onRead(this.rx.length > 0 || this.events.length > 0);
    hit = this._run(t0 + to, function () { end = findTerm(self.rx, term); if (end > count) end = -1; return end > 0 || self.rx.length >= count; });
    bytes = hit ? this.rx.splice(0, end > 0 ? end : count) : this.rx.splice(0, Math.min(count, this.rx.length));
    r = { bytes: bytes, text: toText(bytes), timedOut: !hit, waitedMs: Math.round(this.now - t0) };
    this._note(hit ? 'rx' : 'err', bytes, hit ? '' : '等了 ' + to + ' ms' + (bytes.length ? '，只收到 ' + bytes.length + ' 個位元組（沒等到' + (term ? '結尾字元' : '指定的數量') + '）' : '沒有收到任何東西'));
    return r;
  };
  Session.prototype.query = function (cmd, o) { o = o || {}; var w = this.write(cmd + (o.wterm === undefined ? (this.cfg.term || '') : o.wterm)); if (!w.ok) return { bytes: [], text: '', timedOut: true, waitedMs: 0, error: w.error }; return this.read(o); };
  Session.prototype.bytesAtPort = function () { this._run(this.now); return this.rx.length; };
  Session.prototype.flush = function () { this._run(this.now); var n = this.rx.length; this.rx = []; this._note('info', [], '清掉緩衝區 ' + n + ' 個位元組'); return n; };
  Session.prototype.close = function () { this.closed = true; this.connected = false; this._note('info', [], '關閉連線'); };
  function open(id, cfg) { var d = defOf(id); if (!d) throw new Error('InstSim：沒有這台儀器 ' + id); return new Session(d, cfg); }

  /* 跑一段標準操作，回傳一筆典型的原始回覆（位元組） */
  function sample(id, cfg) {
    var d = defOf(id), s = open(id, cfg), out = [];
    if (d.kind === 'daq') return s.read(0, 100, 1000);
    (d.demo || []).forEach(function (st) {
      if (st[0] === 'connect') return s.connect();
      if (st[0] === 'tick') { s.tick(st[1]); s.flush(); out = s.read({ timeoutMs: 1000 }).bytes; return; }
      s.write(st); out = d.binary && d.kind === 'tcp' ? (s.tick(200), s.read({ term: null, count: s.bytesAtPort(), timeoutMs: 0 }).bytes) : s.read({ timeoutMs: 3000 }).bytes;
    });
    return out;
  }

  /* ====================================================================== 自我檢查：每個「新手會遇到的現象」都要重現 */
  function verify() {
    var P = [], s, r, r2, a, b, n;
    function ok(name, cond, got) { if (!cond) P.push(name + (got !== undefined ? '（得到 ' + JSON.stringify(got) + '）' : '')); }
    function avg(v) { return v.reduce(function (x, y) { return x + y; }, 0) / v.length; }
    try {
      // ---- gpd
      s = open('gpd'); r = s.query('*IDN?'); ok('gpd：*IDN? 有回覆', !r.timedOut && /^GW INSTEK,GPD-3303S,SN:\w+,V1\.00\r\n$/.test(r.text), r.text);
      s.write('*IDN?'); r = s.read({ timeoutMs: 500 }); ok('gpd：沒加結尾字元 → 逾時', r.timedOut && !r.bytes.length, r.text);
      s.write('\r'); r = s.read(); ok('gpd：補上 CR 才回（CR、LF 都算結束）', /GPD/.test(r.text), r.text);
      r = s.query('VOUT1?'); ok('gpd：輸出關閉時 VOUT = 0', fract(r.text) === 0, r.text);
      s.write('VSET1:5.0\n'); s.write('OUT1\n'); r = s.query('VOUT1?'); r2 = s.query('IOUT1?'); ok('gpd：輸出後 VOUT≈5、IOUT≈0.5', Math.abs(fract(r.text) - 5) < 0.02 && Math.abs(fract(r2.text) - 0.5) < 0.02, [r.text, r2.text]);
      ok('gpd：回覆帶單位、CR LF 結尾', /V\r\n$/.test(r.text) && /A\r\n$/.test(r2.text));
      s.setLoad(1, 2); r = s.query('IOUT1?'); r2 = s.query('VOUT1?'); ok('gpd：負載變重 → 定電流，電壓掉下來', Math.abs(fract(r.text) - 1) < 0.02 && Math.abs(fract(r2.text) - 2) < 0.02, [r.text, r2.text]);
      r = s.query('STATUS?'); ok('gpd：STATUS? 是 8 個 0／1，CH1 在 CC', /^0[01]{7}\r\n$/.test(r.text), r.text);
      s.write('VSET1:5.0\n'); r = s.read({ timeoutMs: 300 }); ok('gpd：設定命令沒有回覆', r.timedOut);
      s.write('VOLT 5\n'); r = s.read({ timeoutMs: 300 }); r2 = s.query('ERR?'); ok('gpd：下錯命令不回、ERR? 才看得到', r.timedOut && /Undefined header/.test(r2.text), r2.text);
      r = s.query('ERR?'); ok('gpd：ERR? 讀過就清掉', /No Error/.test(r.text), r.text);
      s.write('VSET1:99\n'); r = s.query('ERR?'); ok('gpd：超出範圍', /Data out of range/.test(r.text), r.text);
      r = s.query('VOUT1?', { term: '\r' }); r2 = s.read({ term: '\r', timeoutMs: 300 }); ok('gpd：讀取的結尾字元設成 \\r → 下一次先讀到殘留的 \\n', r.text.slice(-1) === '\r' && r2.bytes[0] === 10, [r.text, r2.bytes]);
      s = open('gpd', { baud: 115200 }); r = s.query('*IDN?', { timeoutMs: 500 }); ok('gpd：鮑率設錯 → 收不到', r.timedOut && !r.bytes.length, r.bytes);
      s = open('gpd'); s.write('BAUD0\n'); r = s.query('*IDN?', { timeoutMs: 500 }); s.setCfg({ baud: 115200 }); r2 = s.query('*IDN?'); ok('gpd：BAUD 命令改了鮑率，電腦也要跟著改', r.timedOut && /GPD/.test(r2.text), [r.text, r2.text]);
      s = open('gpd', { bits: 7, parity: 'E' }); r = s.query('*IDN?', { timeoutMs: 500 }); ok('gpd：7-E-1 對 8-N-1 → 命令變亂碼、沒有回覆', r.timedOut, r.text);
      // ---- dmm
      s = open('dmm'); r = s.query('*IDN?'); ok('dmm：*IDN? 四欄', r.text.trim().split(',').length === 4 && /34461A/.test(r.text), r.text);
      r = s.query('MEAS:VOLT:DC?'); ok('dmm：讀數是科學記號加換行', /^[+-]\d\.\d{8}E[+-]\d\d\n$/.test(r.text), r.text);
      ok('dmm：讀數約 5 V', Math.abs(fract(r.text) - 4.9987) < 0.001, r.text);
      r = s.query('MEAS:VOLT:DC?', { wterm: '' }); ok('dmm：USBTMC 不加換行也收得到', !r.timedOut, r.text);
      s.write('MEAS:VOLT?DC\n'); r = s.read({ timeoutMs: 300 }); r2 = s.query('SYST:ERR?'); ok('dmm：下錯命令 → 錯誤佇列 -113', r.timedOut && /^-113,"Undefined header"/.test(r2.text), r2.text);
      r2 = s.query('SYST:ERR?'); ok('dmm：錯誤讀過一次就沒了', /^\+0,"No error"/.test(r2.text), r2.text); s.write('CONF:VOLT:DC 10\n'); r = s.read({ timeoutMs: 300 }); r2 = s.query('SYST:ERR?'); ok('dmm：設定命令沒有回覆，也不算錯', r.timedOut && /^\+0,/.test(r2.text), r2.text);
      s = open('dmm', { device: { err420: true } }); s.write('CONF:VOLT:DC 10\n'); s.read({ timeoutMs: 300 }); r2 = s.query('SYST:ERR?'); ok('dmm：（選項 err420）沒送查詢就讀 → -420', /^-420/.test(r2.text), r2.text); s = open('dmm');
      r2 = s.query('SYST:ERR?'); ok('dmm：錯誤佇列讀完是 +0,"No error"', /^\+0,"No error"\n$/.test(r2.text), r2.text);
      for (n = 0; n < 30; n++) s.write('BAD\n'); for (n = 0; s.query('SYST:ERR?').text.charAt(0) === '-' && n < 40; n++) { /* 數一數 */ } ok('dmm：錯誤佇列最多 20 筆', n === 20, n);
      s.write('CONF:VOLT:DC\n'); s.write('VOLT:DC:NPLC 100\n'); r = s.query('READ?', { timeoutMs: 2000 }); ok('dmm：NPLC 100、逾時 2000 ms → 讀不到', r.timedOut && !r.bytes.length, r);
      r = s.read({ timeoutMs: 5000 }); ok('dmm：再等久一點就收到', !r.timedOut && /E\+00\n$/.test(r.text), r.text);
      r = s.query('MEASure:VOLTage:DC?'); ok('dmm：長寫法也認得', !r.timedOut, r.text);
      s.setInput(5000); r = s.query('MEAS:VOLT:DC?'); ok('dmm：過載回 9.9E37', r.text === '+9.90000000E+37\n', r.text);
      s = open('dmm', { iface: 'tcp' }); r = s.write('*IDN?\n'); ok('dmm（LAN）：沒連線就寫 → 錯誤', !r.ok);
      r = s.connect({ port: 5024 }); ok('dmm（LAN）：5024 不是 SCPI 埠', !r.ok && /Telnet/.test(r.error), r);
      r = s.connect({ host: '192.168.1.99' }); ok('dmm（LAN）：IP 錯 → 連不上', !r.ok);
      ok('dmm（LAN）：連線成功', s.connect().ok); s.write('*IDN?'); r = s.read({ timeoutMs: 500 }); ok('dmm（LAN）：socket 沒加換行 → 不回應', r.timedOut);
      s.write('\n'); r = s.read(); ok('dmm（LAN）：補上換行才回', /34461A/.test(r.text), r.text);
      // ---- bal
      s = open('bal'); s.tick(2000); ok('bal：出廠 Key 模式，不問就沒有資料', s.bytesAtPort() === 0, s.bytesAtPort());
      r = s.read({ timeoutMs: 500 }); ok('bal：Key 模式直接讀 → 逾時', r.timedOut && !r.bytes.length);
      s.print(); r = s.read({ timeoutMs: 1000 }); ok('bal：按 PRINT 送一筆', /^ST,\+00000\.00 {2}g\r\n$/.test(r.text) && r.bytes.length === 17, r.text);
      s.write('Q\n'); r = s.read({ timeoutMs: 500 }); r2 = s.query('Q'); ok('bal：Q 要加 CR LF', r.timedOut && /^ST/.test(r2.text), r2.text);
      s.put(50); s.print(); r = s.read({ timeoutMs: 400 }); r2 = s.read({ timeoutMs: 3000 }); ok('bal：還在晃時按 PRINT，要等穩定才送', r.timedOut && /^ST,\+00050\.0\d/.test(r2.text), [r.text, r2.text]);
      s.write('SIR\r\n'); s.tick(1000); n = s.bytesAtPort(); ok('bal：SIR 之後一直送', n >= 150, n); s.write('C\r\n'); s.tick(200); s.flush(); s.tick(1000); ok('bal：C 取消連續送', s.bytesAtPort() === 0, s.bytesAtPort());
      s = open('bal', { device: { stream: true } }); s.tick(1000); n = s.bytesAtPort(); ok('bal（Stream）：沒人讀，緩衝區一直累積', n >= 150, n);
      r = s.read(); ok('bal：一筆的格式（15 字元＋CR LF）', /^(ST|US),[+-]\d{5}\.\d\d {2}g\r\n$/.test(r.text) && r.bytes.length === 17, r.text);
      s.put(50); s.tick(300); s.flush(); r = s.read(); ok('bal：剛放上去是 US', /^US/.test(r.text), r.text);
      s.tick(3000); r = s.read(); ok('bal：不清緩衝區讀到的是舊資料（還是 US）', /^US/.test(r.text), r.text);
      s.flush(); r = s.read(); ok('bal：清掉再讀是 ST、50 g', /^ST,\+00050\.0\d/.test(r.text), r.text);
      s.put(300); s.tick(3000); s.flush(); r = s.read(); ok('bal：超載', r.text === 'OL,+9999999E+19\r\n', r.text);
      s.tick(60000); ok('bal：緩衝區滿了會掉資料', s.bytesAtPort() === 4096 && s.overrun > 0, [s.bytesAtPort(), s.overrun]);
      s = open('bal', { baud: 9600, bits: 8, parity: 'N', device: { stream: true } }); s.tick(500); r = s.read({ term: null, count: 34, timeoutMs: 500 }); ok('bal：鮑率設錯 → 亂碼', r.bytes.length > 0 && !/ST,|US,/.test(r.text), r.text);
      s = open('bal', { bits: 8, parity: 'N', device: { stream: true } }); s.tick(500); r = s.read({ term: null, count: 17, timeoutMs: 500 }); ok('bal：8-N-1 讀 7-E-1 → 一部分字元最高位元變 1', r.bytes.some(function (x) { return x > 127; }) && r.bytes.some(function (x) { return x < 128; }), r.bytes);
      // ---- dtb
      s = open('dtb'); a = asciiFrame([1, 3, 0x10, 0, 0, 2]); s.write(a); r = s.read(); ok('dtb ASCII：讀 PV、SV', /^:010304[0-9A-F]{8}[0-9A-F]{2}\r\n$/.test(r.text), r.text);
      b = parseHex(r.text.slice(1).trim()); ok('dtb ASCII：PV≈25.0、SV=100.0、LRC 正確', Math.abs((b[3] << 8 | b[4]) - 250) <= 6 && (b[5] << 8 | b[6]) === 1000 && lrc(b.slice(0, -1)) === b[b.length - 1], b);
      s.write(a.replace(/..\r\n$/, '00\r\n')); r = s.read({ timeoutMs: 500 }); ok('dtb ASCII：LRC 錯 → 不回應', r.timedOut);
      s.write(asciiFrame([2, 3, 0x10, 0, 0, 1])); r = s.read({ timeoutMs: 500 }); ok('dtb：站號錯 → 不回應', r.timedOut);
      s.write(a.trim()); r = s.read({ timeoutMs: 500 }); ok('dtb ASCII：沒有 CR LF → 不回應', r.timedOut); s.write('\r\n'); s.read();
      r = s.query(asciiFrame([1, 3, 0x20, 0, 0, 1]).trim()); ok('dtb：非法位址 → 例外碼 02', /^:018302/.test(r.text), r.text);
      r = s.query(asciiFrame([1, 3, 0x10, 0, 0, 9]).trim()); ok('dtb：一次讀超過 8 個字 → 例外碼 03', /^:018303/.test(r.text), r.text);
      r = s.query(asciiFrame([1, 6, 0x10, 1, 0x01, 0xF4]).trim()); ok('dtb：還沒允許通訊寫入 → 寫 SV 被拒絕', /^:0186/.test(r.text) && s.inst.state().sv === 100, r.text);
      r = s.query(asciiFrame([1, 5, 0x08, 0x10, 0xFF, 0]).trim()); ok('dtb：05 寫 0810H 回原封不動', r.text === asciiFrame([1, 5, 0x08, 0x10, 0xFF, 0]), r.text);
      r = s.query(asciiFrame([1, 2, 0x08, 0x10, 0, 1]).trim()); ok('dtb：02 讀位元', /^:01020101/.test(r.text), r.text);
      r = s.query(asciiFrame([1, 6, 0x10, 1, 0x01, 0xF4]).trim()); ok('dtb：允許後寫 SV 回原封不動', r.text === asciiFrame([1, 6, 0x10, 1, 0x01, 0xF4]) && s.inst.state().sv === 50, r.text);
      s.tick(60000); r = s.query(asciiFrame([1, 3, 0x10, 0, 0, 1]).trim()); b = parseHex(r.text.slice(1).trim()); ok('dtb：PV 慢慢靠近 SV（60 秒後 > 40）', (b[3] << 8 | b[4]) > 400 && (b[3] << 8 | b[4]) < 500, b);
      r = s.query(asciiFrame([1, 6, 0x10, 1, 0x27, 0x10]).trim()); ok('dtb：SV 超過範圍 → 例外碼 03', /^:018603/.test(r.text), r.text);
      s.sensorOpen(true); r = s.query(asciiFrame([1, 3, 0x10, 0, 0, 1]).trim()); ok('dtb：感測器沒接 → PV 讀到 8003H', /^:0103028003/.test(r.text), r.text);
      ok('dtb RTU：範例封包的 CRC 是 C0 CB', hex(rtuFrame([1, 3, 0x10, 0, 0, 2])) === '01 03 10 00 00 02 C0 CB', hex(rtuFrame([1, 3, 0x10, 0, 0, 2])));
      s = open('dtb', { bits: 8, parity: 'E', device: { mode: 'rtu', bits: 8, parity: 'E' } }); s.write(rtuFrame([1, 3, 0x10, 0, 0, 1])); r = s.read({ term: null, count: 7 });
      ok('dtb RTU：回 7 個位元組、CRC 正確', r.bytes.length === 7 && crc16(r.bytes.slice(0, 5)) === (r.bytes[5] | r.bytes[6] << 8), r.bytes);
      b = rtuFrame([1, 3, 0x10, 0, 0, 1]); s.write(b.slice(0, 6).concat([b[7], b[6]])); r = s.read({ term: null, count: 7, timeoutMs: 500 }); ok('dtb RTU：CRC 高低位元組放反 → 不回應', r.timedOut && !r.bytes.length, r.bytes);
      s = open('dtb', { device: { mode: 'rtu', bits: 8, parity: 'E' } }); s.write(rtuFrame([1, 3, 0x10, 0, 0, 1])); r = s.read({ term: null, count: 7, timeoutMs: 500 }); ok('dtb：面板改成 RTU 8-E-1，電腦還是 7-E-1 → 不回應', r.timedOut && !r.bytes.length, r.bytes);
      s = open('dtb', { bits: 8, parity: 'N' }); r = s.query(a.trim(), { timeoutMs: 500 }); ok('dtb：8-N-1 對 7-E-1 → 不回應', r.timedOut);
      // ---- adam4017
      s = open('adam4017'); r = s.query('#01'); ok('adam4017：#01 回 > 加 8 組 7 字元、CR 結尾', /^>([+-]\d\.\d{4}){8}\r$/.test(r.text) && r.bytes.length === 58, r.text);
      ok('adam4017：第一組約 +7.2111', Math.abs(fract(r.text.substr(1, 7)) - 7.2111) < 0.003, r.text.substr(1, 7));
      r = s.query('#012'); ok('adam4017：#012 讀單一通道', /^>\+1\.45\d\d\r$/.test(r.text), r.text);
      r = s.query('#02', { timeoutMs: 500 }); ok('adam4017：位址不存在 → 沒有回應', r.timedOut && !r.bytes.length);
      r = s.query('$01X', { timeoutMs: 500 }); ok('adam4017：語法錯 → 沒有回應', r.timedOut && !r.bytes.length);
      s.write('#01\n'); r = s.read({ timeoutMs: 500 }); ok('adam4017：結尾字元用 \\n → 沒有回應', r.timedOut && !r.bytes.length, r.text);
      s = open('adam4017'); r = s.query('#01', { term: '\n', wterm: '\r', timeoutMs: 500 }); ok('adam4017：讀的時候等 \\n → 資料到了卻卡到逾時', r.timedOut && r.bytes.length === 58, r.bytes.length);
      // ---- adam6017
      s = open('adam6017'); r = s.write(mbap(1, 1, [3, 0, 0, 0, 8])); ok('adam6017：沒連線就寫 → 錯誤', !r.ok);
      ok('adam6017：連線', s.connect().ok); s.write(mbap(0x1234, 1, [3, 0, 0, 0, 8])); r = s.read({ term: null, count: 25 });
      ok('adam6017：回 25 個位元組、交易編號照抄', r.bytes.length === 25 && r.bytes[0] === 0x12 && r.bytes[1] === 0x34 && r.bytes[8] === 16, r.bytes);
      n = r.bytes[9] << 8 | r.bytes[10]; ok('adam6017：AI0 原始值換算 ≈ 2.5 V', Math.abs(n / 65535 * 20 - 10 - 2.5) < 0.01, n);
      n = r.bytes[11] << 8 | r.bytes[12]; ok('adam6017：AI1 原始值換算 ≈ 12 mA', Math.abs(n / 65535 * 16 + 4 - 12) < 0.02, n);
      n = r.bytes[17] << 8 | r.bytes[18]; ok('adam6017：0 V 的原始值在中間', Math.abs(n - 32768) < 20, n);
      s.write(mbap(2, 1, [3, 0, 0x20, 0, 1])); r = s.read({ term: null, count: 9 }); ok('adam6017：非法位址 → 83 02', r.bytes[7] === 0x83 && r.bytes[8] === 2, r.bytes);
      s.write(mbap(3, 1, [3, 0, 0, 0, 1]).slice(0, 10)); r = s.read({ term: null, count: 9, timeoutMs: 500 }); ok('adam6017：少送位元組 → 一直等、逾時', r.timedOut && !r.bytes.length);
      s.disconnect(); s.connect(); a = mbap(4, 1, [3, 0, 0, 0, 1]); a[3] = 1; s.write(a); r = s.read({ term: null, count: 9, timeoutMs: 500 }); ok('adam6017：協定代號不是 0 → 不回應', r.timedOut);
      // ---- daq
      s = open('daq'); r = s.read(0, 200, 1000); a = avg(r);
      ok('daq：ai0 平均 ≈ 3.0 V（5 bar）', r.length === 200 && Math.abs(a - 3) < 0.005, a);
      ok('daq：有雜訊（每點不一樣）', Math.max.apply(null, r) - Math.min.apply(null, r) > 0.002);
      ok('daq：量化成 14 位元的階梯', r.every(function (v) { return Math.abs(v / (20 / 16384) - Math.round(v / (20 / 16384))) < 1e-6; }));
      ok('daq：讀 200 點花 200 ms', Math.abs(s.now - 200) < 1, s.now);
      ok('daq：沒有命令可以寫', !s.write('*IDN?\n').ok);
      ok('daq：取樣率太高 → 錯誤', !!s.read(0, 10, 100000).error); ok('daq：差動接法沒有 ai5', !!s.read(5, 10, 1000).error);
      s.set('pressure', 7.5); ok('daq：7.5 bar → 4.0 V', Math.abs(avg(s.read(0, 100, 1000)) - 4) < 0.005);
      ok('daq：12 mA 經 250 Ω → 3.0 V', Math.abs(avg(s.read(1, 100, 1000)) - 3) < 0.005);
      // ---- 可重現、工具、資料表
      a = open('gpd').query('*IDN?').text; b = open('gpd').query('*IDN?').text; r = open('daq').read(0, 5, 1000).join(); r2 = open('daq').read(0, 5, 1000).join(); ok('同樣的操作結果相同', a === b && r === r2);
      ok('LRC', lrc([1, 3, 0x10, 0, 0, 2]) === 0xEA, lrc([1, 3, 0x10, 0, 0, 2])); ok('CRC16', crc16([1, 3, 0, 0, 0, 1]) === 0x0A84, crc16([1, 3, 0, 0, 0, 1]));
      ok('scan', JSON.stringify(scan('ST,+00123.45  g', '%2s,%f').values) === '["ST",123.45]'); ok('fract 遇到非數字開頭回 0', fract('ST,+1.2') === 0 && fract('5.000V') === 5 && dec('12.9V') === 12);
      ok('list() 有 7 台、欄位齊全', list().length === 7 && list().every(function (d) { return d.id && d.name && d.kind && d.manual && d.verified === false && d.card && d.unverified.length && d.checked.length; }));
      ok('sample() 每台都有資料', INSTRUMENTS.every(function (d) { return sample(d.id).length > 0; }));
    } catch (e) { P.push('執行時出錯：' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
    return { ok: P.length === 0, problems: P };
  }

  /* ====================================================================== 畫面：三種看法、終端機 */
  var D = typeof document !== 'undefined' ? document : null;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var CSS = '.isim-term{border:1px solid var(--line,#c9d0cf);border-left:4px solid var(--on,var(--accent,#0a57a4));border-radius:6px;background:var(--card,var(--paper,#fff));color:var(--ink,#18212a);padding:10px;font-size:14px;min-width:0;max-width:100%;box-sizing:border-box}' +
    '.isim-term *{box-sizing:border-box}.isim-row{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin:6px 0}.isim-row label{display:inline-flex;gap:4px;align-items:center;flex-wrap:wrap;max-width:100%}' +
    '.isim-term select,.isim-term input,.isim-term button{font:inherit;color:inherit;max-width:100%}.isim-term input[type=text]{border:1px solid var(--line,#c9d0cf);border-radius:4px;padding:5px 8px;background:var(--card,var(--paper,#fff));font-family:ui-monospace,Consolas,monospace;min-width:0}' +
    '.isim-term select{border:1px solid var(--line,#c9d0cf);border-radius:4px;padding:4px 6px;background-color:var(--card,var(--paper,#fff));color:var(--ink,#18212a);min-width:0}.isim-term select option{background-color:var(--card,var(--paper,#fff));color:var(--ink,#18212a)}' +
    '.isim-term button{border:1px solid var(--line,#c9d0cf);background:var(--card,var(--paper,#fff));border-radius:6px;padding:5px 10px;cursor:pointer}.isim-term button:disabled,.isim-term select:disabled,.isim-term input:disabled{opacity:.5;cursor:default}' +
    '.isim-term button.isim-pri{background:var(--go-solid,#17803f);border-color:var(--go-solid,#17803f);color:#fff;font-weight:700}.isim-in{flex:1 1 180px}' +
    '.isim-pre button{font-family:ui-monospace,Consolas,monospace;font-size:13px;padding:2px 8px;border-radius:4px}.isim-cap{font-size:12px;color:var(--mute,#56606b)}' +
    '.isim-badge{font:600 12px ui-monospace,Consolas,monospace;border:1px solid var(--line,#c9d0cf);border-radius:4px;padding:1px 6px}.isim-badge.hot{border-color:#b26a00;color:var(--warn,#a86400)}' +
    '.isim-out{border:1px solid var(--line,#c9d0cf);border-radius:6px;padding:8px;margin:6px 0;min-height:46px}.isim-msg{font-weight:700;margin:0 0 4px;padding-left:8px;border-left:4px solid var(--line,#c9d0cf)}.isim-msg.bad{color:var(--lab-bad,var(--stop-text,var(--bad,#b71c1c)));border-left-color:currentColor}.isim-msg.ok{border-left-color:var(--go,var(--accent2,#17803f))}' +
    '.isim-views{display:grid;gap:4px}.isim-v{display:grid;grid-template-columns:118px minmax(0,1fr);gap:8px;align-items:start}@media(max-width:520px){.isim-v{grid-template-columns:minmax(0,1fr);gap:0}}' +
    '.isim-vl{font-size:12px;color:var(--mute,#56606b);padding-top:3px}.isim-plain,.isim-marks,.isim-hex{margin:0;font:14px/1.5 ui-monospace,Consolas,monospace;background:var(--bg,#eceeeb);border-radius:4px;padding:3px 6px;overflow-wrap:anywhere;white-space:pre-wrap;min-height:1.6em;max-height:180px;overflow:auto;border:0;max-width:100%}' +
    '.isim-ctl{font-style:normal;font-size:11px;background:var(--on,var(--accent,#0a57a4));color:var(--card,var(--paper,#fff));border-radius:3px;padding:0 3px;margin:0 1px;white-space:nowrap}.isim-ctl.sp{background:transparent;color:var(--mute,#56606b);font-size:14px;padding:0;margin:0}.isim-ctl.hi{background:#b26a00;color:#fff}' +
    '.isim-log{font:12px/1.5 ui-monospace,Consolas,monospace;max-height:150px;overflow:auto;border:1px solid var(--line,#c9d0cf);border-radius:6px;padding:4px 6px;margin-top:6px;overflow-wrap:anywhere}.isim-log .tx{color:var(--on,var(--accent,#0a57a4))}.isim-log .err{color:var(--lab-bad,var(--stop-text,var(--bad,#b71c1c)))}' +
    '.isim-plot{display:block;width:100%;height:auto;background:var(--bg,#eceeeb);border-radius:4px}';
  function css() { if (!D || D.getElementById('instsim-css')) return; var s = D.createElement('style'); s.id = 'instsim-css'; s.textContent = CSS; D.head.appendChild(s); }
  function viewsHtml(bytes, opts) {
    opts = opts || {}; var max = opts.max || 900, cut = bytes.length > max, b = cut ? bytes.slice(bytes.length - max) : bytes, plain = '', marks = '', i, c;
    for (i = 0; i < b.length; i++) {
      c = b[i];
      if (c === 13 && b[i + 1] === 10) { plain += '\n'; marks += '<i class="isim-ctl">\\r</i><i class="isim-ctl">\\n</i>\n'; i++; }
      else if (c === 10 || c === 13) { plain += '\n'; marks += '<i class="isim-ctl">' + (c === 10 ? '\\n' : '\\r') + '</i>' + (c === 10 ? '\n' : ''); }
      else if (c === 32) { plain += ' '; marks += '<i class="isim-ctl sp">·</i>'; }
      else if (c === 9) { plain += '\t'; marks += '<i class="isim-ctl">\\t</i>'; }
      else if (c > 32 && c < 127) { plain += esc(String.fromCharCode(c)); marks += esc(String.fromCharCode(c)); }
      else { plain += c >= 0xA0 ? esc(String.fromCharCode(c)) : c >= 0x80 ? '▯' : ''; marks += '<i class="isim-ctl hi">' + h2(c) + '</i>'; }
    }
    return (opts.label ? '<div class="isim-cap">' + esc(opts.label) + '</div>' : '') + (cut ? '<div class="isim-cap">共 ' + bytes.length + ' 個位元組，只顯示最後 ' + max + ' 個。</div>' : '') +
      '<div class="isim-views"><div class="isim-v"><span class="isim-vl">① 記事本看到的</span><pre class="isim-plain">' + plain + '</pre></div>' +
      '<div class="isim-v"><span class="isim-vl">② 看不見的字元也畫出來</span><div class="isim-marks">' + marks + '</div></div>' +
      '<div class="isim-v"><span class="isim-vl">③ 十六進位（' + bytes.length + ' 個位元組）</span><div class="isim-hex">' + hex(b) + '</div></div></div>';
  }
  function bytesView(container, bytes, opts) { css(); container.innerHTML = viewsHtml(toBytes(bytes), opts); return container; }
  function showText(t) { return esc(t).replace(/\r/g, '<i class="isim-ctl">\\r</i>').replace(/\n/g, '<i class="isim-ctl">\\n</i>'); }

  function terminal(container, opts) {
    css(); opts = opts || {};
    var def = defOf(opts.inst), cfg = {}, k, ses, api = {}, lastReal = Date.now(), timer = null, devOpt = 0;
    if (!def) { container.textContent = 'InstSim：沒有這台儀器 ' + opts.inst; return null; }
    for (k in (opts.cfg || {})) cfg[k] = opts.cfg[k];
    function q(sel) { return container.querySelector(sel); }
    function isBin() { return !!def.binary && !(def.devOpts && def.devOpts[devOpt][2].mode === 'ascii'); }
    function sel(name, vals, cur, fmt) { return '<select data-c="' + name + '"' + (opts.lockCfg ? ' disabled' : '') + '>' + vals.map(function (v) { return '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + (fmt ? fmt(v) : v) + '</option>'; }).join('') + '</select>'; }
    function mk() {
      var c = {}, d; for (k in cfg) c[k] = cfg[k];
      if (def.devOpts) { d = def.devOpts[devOpt]; c.device = Object.assign({}, c.device || {}, d[2]); }
      delete c._dev; ses = open(def.id, c); api.session = ses; lastReal = Date.now();
    }
    function presets() { var p = opts.presets || (typeof def.presets === 'function' ? def.presets(def.devOpts ? def.devOpts[devOpt][2] : {}) : def.presets) || []; return p.map(function (x) { return typeof x === 'string' ? { label: x, text: x } : x; }); }
    function build() {
      var c = ses.cfg, h = '<div class="isim-term">', P = { N: '無 None', E: '偶 Even', O: '奇 Odd' };
      if (ses.kind === 'daq') {
        h += '<div class="isim-row"><b>' + esc(def.brand + ' ' + def.name) + '</b><span class="isim-cap">像 NI MAX 的 Test Panel：選通道、點數、取樣率，按讀取。</span></div>' +
          '<div class="isim-row"><label>通道 <select data-d="ch">' + def.channels.map(function (x, i) { return '<option value="' + i + '">' + x[0] + '：' + esc(x[1]) + '</option>'; }).join('') + '</select></label>' +
          '<label>點數 <select data-d="n"><option>1</option><option>10</option><option selected>100</option><option>1000</option></select></label><label>取樣率 <select data-d="rate"><option>10</option><option>100</option><option selected>1000</option><option>10000</option><option>100000</option></select> S/s</label>' +
          '<button type="button" class="isim-pri" data-a="daq">讀取</button></div>';
      } else {
        h += '<div class="isim-row"><b>' + esc(def.brand + ' ' + def.name) + '</b>';
        if (ses.kind === 'serial') h += '<label>鮑率 ' + sel('baud', [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200], c.baud) + '</label><label>資料位元 ' + sel('bits', [7, 8], c.bits) + '</label><label>同位 ' + sel('parity', ['N', 'E', 'O'], c.parity, function (v) { return P[v]; }) + '</label><label>停止位元 ' + sel('stop', [1, 2], c.stop) + '</label>';
        else if (ses.kind === 'tcp') h += '<label>IP <input type="text" data-c="host" size="14" value="' + esc(c.host || def.host) + '"' + (opts.lockCfg ? ' disabled' : '') + '></label><label>埠 <input type="text" data-c="port" size="5" value="' + esc(c.port || def.port) + '"' + (opts.lockCfg ? ' disabled' : '') + '></label><button type="button" data-a="conn">' + (ses.connected ? '中斷連線' : '連線') + '</button><span class="isim-badge' + (ses.connected ? '' : ' hot') + '">' + (ses.connected ? '已連線' : '未連線') + '</span>';
        else h += '<span class="isim-cap">VISA 資源：' + esc(def.resource) + '（USB 插上就有，不用設鮑率）</span>';
        h += '</div>';
        if (def.ifaces && !opts.lockCfg) h += '<div class="isim-row"><label>怎麼接 <select data-a="iface">' + def.ifaces.map(function (f) { return '<option value="' + f + '"' + (f === ses.kind ? ' selected' : '') + '>' + (f === 'usbtmc' ? 'USB（USBTMC）' : '網路線（LAN socket，埠 ' + def.port + '）') + '</option>'; }).join('') + '</select></label></div>';
        if (def.devOpts) h += '<div class="isim-row"><label>儀器面板上的設定 <select data-a="devopt"' + (opts.lockCfg ? ' disabled' : '') + '>' + def.devOpts.map(function (d, i) { return '<option value="' + i + '"' + (i === devOpt ? ' selected' : '') + '>' + esc(d[1]) + '</option>'; }).join('') + '</select></label><span class="isim-cap">這是儀器那一邊；上面那排是電腦這一邊，要自己設成一樣。</span></div>';
        h += '<div class="isim-row"><label>結尾字元 <select data-c="term">' + [['', '無'], ['\n', '\\n（LF）'], ['\r', '\\r（CR）'], ['\r\n', '\\r\\n（CR LF）']].map(function (t) { return '<option value="' + esc(JSON.stringify(t[0])) + '"' + (t[0] === (c.term || '') ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></label>' +
          '<label>讀取方式 <select data-r="mode"><option value="term">讀到結尾字元為止</option><option value="count">讀固定幾個位元組</option><option value="wait"' + (isBin() ? ' selected' : '') + '>等一段時間，再把緩衝區全部讀出來</option></select></label>' +
          '<label>位元組數 <input type="text" data-r="count" size="4" value="7"></label><label>逾時／等待 <select data-r="to"><option>100</option><option>500</option><option selected>2000</option><option>5000</option><option>10000</option></select> ms</label>' +
          '<span class="isim-badge" data-o="bap">緩衝區 0</span></div>';
        if (def.actions) h += '<div class="isim-row isim-pre"><span class="isim-cap">儀器旁邊：</span>' + def.actions.map(function (a, i) { return '<button type="button" data-act="' + i + '">' + esc(a[0]) + '</button>'; }).join('') + '</div>';
        h += '<div class="isim-row"><input class="isim-in" type="text" data-o="in" aria-label="要送出的內容" placeholder="' + (def.binary ? '輸入要送的內容' : '輸入命令，例如 *IDN?') + '" autocomplete="off" spellcheck="false">' +
          (opts.showHex === false ? '' : '<label><input type="checkbox" data-o="hexin"' + (isBin() ? ' checked' : '') + '> 輸入的是十六進位</label>') + '</div>' +
          '<div class="isim-row"><button type="button" class="isim-pri" data-a="query">送出並讀回覆</button><button type="button" data-a="write">只送出</button><button type="button" data-a="read">只讀</button><button type="button" data-a="flush">清緩衝區</button>' +
          (def.binary && opts.showHex !== false ? '<button type="button" data-a="chk">' + (def.kind === 'tcp' ? '幫我加 MBAP 標頭' : '幫我加檢查碼') + '</button>' : '') + '</div>';
        var ps = presets(); if (ps.length) h += '<div class="isim-row isim-pre"><span class="isim-cap">點一下帶入：</span>' + ps.map(function (p, i) { return '<button type="button" data-p="' + i + '" title="' + esc(p.hex || p.text) + '">' + esc(p.label) + '</button>'; }).join('') + '</div>';
      }
      h += '<div class="isim-out" data-o="out" aria-live="polite"><span class="isim-cap">還沒有收到任何東西。</span></div><div class="isim-cap">紀錄（虛擬時間，最新的在上面）</div><div class="isim-log" data-o="log"></div></div>';
      container.innerHTML = h; drawLog(); bap();
    }
    function bap() { var e = q('[data-o="bap"]'); if (!e || ses.kind === 'daq') return; var n = ses.connected || ses.kind !== 'tcp' ? ses.bytesAtPort() : 0; e.textContent = '緩衝區 ' + n + ' 個位元組' + (ses.overrun ? '（已經滿了，掉了 ' + ses.overrun + '）' : ''); e.className = 'isim-badge' + (n > 100 ? ' hot' : ''); }
    function drawLog() {
      var e = q('[data-o="log"]'); if (!e) return;
      e.innerHTML = ses.log.slice(-60).reverse().map(function (l) {
        var arrow = l.dir === 'tx' ? '→ 送出' : l.dir === 'rx' ? '← 收到' : l.dir === 'err' ? '⚠' : '·';
        return '<div class="' + l.dir + '">' + (l.t / 1000).toFixed(3) + 's　' + arrow + (l.bytes.length ? ' ' + l.bytes.length + ' 個位元組　' + (!/^[\x20-\x7e\r\n]*$/.test(l.text) && def.binary ? hex(l.bytes.slice(0, 24)) + (l.bytes.length > 24 ? ' …' : '') : showText(l.text.slice(0, 60)) + (l.text.length > 60 ? '…' : '')) : '') + (l.note ? '　' + esc(l.note) : '') + '</div>';
      }).join('');
    }
    function out(html) { q('[data-o="out"]').innerHTML = html; }
    function wall() { var n = Date.now(), d = Math.min(60000, n - lastReal); lastReal = n; if (d > 0) ses.tick(d); }
    function payload() {
      var t = q('[data-o="in"]').value, hx = q('[data-o="hexin"]') && q('[data-o="hexin"]').checked, b;
      if (hx) { b = parseHex(t); if (!b) { out('<p class="isim-msg bad">十六進位要兩個字一組，例如 01 03 10 00 00 01。</p>'); return null; } return b; }
      return toBytes(t + (ses.cfg.term || ''));
    }
    function doRead() {
      var mode = q('[data-r="mode"]').value, to = +q('[data-r="to"]').value, cnt = Math.max(1, parseInt(q('[data-r="count"]').value, 10) || 1), r, n;
      if (mode === 'wait') { ses.tick(to); n = ses.connected || ses.kind !== 'tcp' ? ses.bytesAtPort() : 0; r = n ? ses.read({ term: null, count: n, timeoutMs: 0 }) : { bytes: [], text: '', timedOut: true, waitedMs: to, empty: true }; if (!n) ses._note('err', [], '等了 ' + to + ' ms，緩衝區是空的'); }
      else r = ses.read(mode === 'count' ? { term: null, count: cnt, timeoutMs: to } : { timeoutMs: to });
      lastReal = Date.now();
      var msg;
      if (r.error) msg = '<p class="isim-msg bad">' + esc(r.error) + '</p>';
      else if (r.timedOut && !r.bytes.length) msg = '<p class="isim-msg bad">等了 ' + to + ' ms 沒有收到任何東西。</p><p class="isim-cap">先想：命令有沒有送到（結尾字元、通訊設定、有沒有連線）？這個命令本來就沒有回覆嗎？儀器來得及回嗎？</p>';
      else if (r.timedOut) msg = '<p class="isim-msg bad">等了 ' + to + ' ms，' + (mode === 'count' ? '沒有湊滿 ' + cnt + ' 個位元組' : '沒有等到結尾字元') + '，只收到下面這 ' + r.bytes.length + ' 個位元組。</p>';
      else msg = '<p class="isim-msg ok">收到 ' + r.bytes.length + ' 個位元組' + (mode === 'wait' ? '' : '（等了 ' + r.waitedMs + ' ms）') + '。</p>';
      if (ses.lineErrors.baud + ses.lineErrors.parity + ses.lineErrors.framing > 0 && r.bytes.length) msg += '<p class="isim-cap">序列埠回報了同位或框架錯誤 ' + (ses.lineErrors.baud + ses.lineErrors.parity + ses.lineErrors.framing) + ' 次：通訊設定和儀器不一樣。</p>';
      out(msg + (r.bytes.length ? viewsHtml(r.bytes) : '')); drawLog(); bap();
      if (opts.onReply && !r.error) opts.onReply(r, ses);
      return r;
    }
    function doWrite() { var b = payload(), w; if (!b) return null; wall(); w = ses.write(b); lastReal = Date.now(); if (!w.ok) { out('<p class="isim-msg bad">' + esc(w.error) + '</p>'); drawLog(); return null; } out('<p class="isim-msg">送出 ' + b.length + ' 個位元組。</p>' + viewsHtml(b)); drawLog(); bap(); return w; }
    function onClick(ev) {
      var b = ev.target.closest('button'); if (!b) return;
      var a = b.dataset.a, p, inp = q('[data-o="in"]');
      if (b.dataset.p != null) { p = presets()[+b.dataset.p]; inp.value = p.hex || p.text; if (q('[data-o="hexin"]')) q('[data-o="hexin"]').checked = !!p.hex; inp.focus(); return; }
      if (b.dataset.act != null) { wall(); def.actions[+b.dataset.act][1](ses.inst); ses._note('info', [], '儀器旁邊：' + def.actions[+b.dataset.act][0]); drawLog(); return; }
      if (a === 'query') { if (doWrite()) doRead(); }
      else if (a === 'write') doWrite();
      else if (a === 'read') { wall(); doRead(); }
      else if (a === 'flush') { wall(); var n = ses.connected || ses.kind !== 'tcp' ? ses.flush() : 0; out('<p class="isim-msg">清掉緩衝區裡的 ' + n + ' 個位元組。</p>'); drawLog(); bap(); }
      else if (a === 'conn') { if (ses.connected) ses.disconnect(); else { var r = ses.connect({ host: q('[data-c="host"]').value.trim(), port: q('[data-c="port"]').value.trim() }); if (!r.ok) { build(); out('<p class="isim-msg bad">' + esc(r.error) + '</p>'); return; } } build(); }
      else if (a === 'chk') { var by = parseHex(inp.value); if (def.binary && !isBin()) { by = parseHex(inp.value.replace(/^:/, '')); if (by) { inp.value = ':' + by.concat([lrc(by)]).map(h2).join(''); if (q('[data-o="hexin"]')) q('[data-o="hexin"]').checked = false; } } else if (by) inp.value = hex(def.kind === 'tcp' ? mbap(1, 1, by) : rtuFrame(by)); else out('<p class="isim-msg bad">先輸入不含檢查碼的位元組，例如 01 03 10 00 00 01' + (def.kind === 'tcp' ? '（Modbus TCP 沒有檢查碼，這個按鈕會幫功能碼之後的內容加上 MBAP 標頭，例如輸入 03 00 00 00 08）' : '') + '。</p>'); }
      else if (a === 'daq') {
        var ch = +q('[data-d="ch"]').value, n2 = +q('[data-d="n"]').value, rate = +q('[data-d="rate"]').value, v = ses.read(ch, n2, rate), mean, mn, mx, pts = '', i, W = 300;
        if (v.error) { out('<p class="isim-msg bad">' + esc(v.error) + '</p>'); drawLog(); return; }
        mean = v.reduce(function (x, y) { return x + y; }, 0) / v.length; mn = Math.min.apply(null, v); mx = Math.max.apply(null, v);
        for (i = 0; i < v.length; i++) pts += (v.length > 1 ? i / (v.length - 1) * W : W / 2).toFixed(1) + ',' + (50 - (mx > mn ? (v[i] - mn) / (mx - mn) : 0.5) * 44 - 3).toFixed(1) + ' ';
        out('<p class="isim-msg ok">讀到 ' + v.length + ' 個電壓值（一個陣列，不是字串）。</p><div class="isim-views"><div class="isim-v"><span class="isim-vl">前幾點（V）</span><div class="isim-hex">' + v.slice(0, 12).map(function (x) { return x.toFixed(4); }).join('　') + (v.length > 12 ? ' …' : '') + '</div></div>' +
          '<div class="isim-v"><span class="isim-vl">平均／最小／最大</span><div class="isim-hex">' + mean.toFixed(4) + ' ／ ' + mn.toFixed(4) + ' ／ ' + mx.toFixed(4) + ' V</div></div>' +
          (v.length > 1 ? '<div class="isim-v"><span class="isim-vl">波形（上下放大到剛好塞滿）</span><svg class="isim-plot" viewBox="0 0 ' + W + ' 54" role="img" aria-label="電壓波形"><polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="1"/></svg></div>' : '') + '</div>');
        drawLog(); if (opts.onReply) opts.onReply({ volts: v, ch: ch, n: n2, rate: rate, mean: mean }, ses);
      }
    }
    function onChange(ev) {
      var t = ev.target, c = t.dataset.c, a = t.dataset.a;
      if (c) { var v = c === 'term' ? JSON.parse(t.value) : (c === 'parity' || c === 'host') ? t.value : +t.value; cfg[c] = v; if (c !== 'host' && c !== 'port') { wall(); ses.setCfg((function () { var o = {}; o[c] = v; return o; })()); ses._note('info', [], '電腦這邊改設定：' + c + ' = ' + JSON.stringify(v)); drawLog(); } }
      else if (a === 'iface') { cfg.iface = t.value; mk(); build(); }
      else if (a === 'devopt') { devOpt = +t.value; mk(); build(); }
    }
    container.addEventListener('click', onClick); container.addEventListener('change', onChange);
    container.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.o === 'in') { ev.preventDefault(); if (doWrite()) doRead(); } });
    mk(); build();
    timer = setInterval(function () { if (!D.body.contains(container)) { clearInterval(timer); return; } if (container.offsetParent === null || D.hidden) { lastReal = Date.now(); return; } wall(); bap(); }, 500);
    api.send = function (text, o) { q('[data-o="in"]').value = text; if (q('[data-o="hexin"]')) q('[data-o="hexin"]').checked = !!(o && o.hex); return doWrite() ? doRead() : null; };
    api.read = function () { return doRead(); };
    api.setRead = function (mode, to, count) { q('[data-r="mode"]').value = mode; if (to) q('[data-r="to"]').value = String(to); if (count) q('[data-r="count"]').value = String(count); };
    api.setCfg = function (c) { for (var kk in c) { cfg[kk] = c[kk]; } ses.setCfg(c); build(); };
    api.rebuild = function () { mk(); build(); };
    api.destroy = function () { clearInterval(timer); container.removeEventListener('click', onClick); container.removeEventListener('change', onChange); container.innerHTML = ''; };
    return api;
  }

  var InstSim = { list: list, open: open, terminal: terminal, bytesView: bytesView, verify: verify, sample: sample,
    util: { toBytes: toBytes, toText: toText, hex: hex, parseHex: parseHex, lrc: lrc, crc16: crc16, asciiFrame: asciiFrame, rtuFrame: rtuFrame, mbap: mbap, dec: dec, fract: fract, hexNum: hexNum, scan: scan, sci: sci, reframe: reframe, viewsHtml: viewsHtml } };
  if (typeof module !== 'undefined' && module.exports) module.exports = InstSim;
  if (root) root.InstSim = InstSim;
})(typeof window !== 'undefined' ? window : null);
