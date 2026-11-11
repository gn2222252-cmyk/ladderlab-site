/* Formula Node 實驗室：圖形節點 vs Formula Node 對照、語法檢查器（安全的小子集，不用 eval）、整數除法、猜一猜 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function slowF() { return $('slow') && $('slow').checked ? 2.2 : 1; }
  function fmt(v) { if (typeof v === 'boolean') return v ? 'T' : 'F'; if (!isFinite(v)) return String(v); return String(Number(v.toPrecision(6))); }

  /* 計時器與動畫：每次換分頁 RUN 加一，跑到一半的動畫看到 RUN 變了就停 */
  var RUN = 0;
  function wait(ms, my) { return new Promise(function (res, rej) { setTimeout(function () { if (my !== RUN) rej('cancel'); else res(); }, ms * slowF()); }); }

  /* ---------- 分頁 ---------- */
  var TABS = ['cmp', 'syn', 'int'];
  function show(t) {
    RUN++;
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    TABS.forEach(function (k) { $('t-' + k).hidden = k !== t; });
    clearHl();
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* =====================================================================
     1. 兩種寫法對照
     ===================================================================== */
  function I(n) { return { op: 'in', n: n }; }
  function K(v) { return { op: 'k', v: v }; }
  function B(op, a, b) { return { op: op, a: a, b: b }; }
  function U(op, a) { return { op: op, a: a }; }
  function S(c, t, f) { return { op: 'sel', c: c, t: t, f: f }; }
  var EX = {
    pulse: { name: '脈波換算位置', out: 'mm', unit: 'mm', desc: '伺服馬達一圈 ppr 個脈波，滾珠螺桿導程 lead mm（轉一圈走幾 mm）。PLC 回傳累積脈波 p，換成右軸位置。',
      ins: [['p', '累積脈波 p', 25000], ['ppr', '每圈脈波 ppr', 10000], ['lead', '導程 lead (mm)', 10]],
      ast: function () { return B('mul', B('div', I('p'), I('ppr')), I('lead')); } },
    temp: { name: '溫度補償', out: 'L', unit: 'mm', desc: '鋼構的熱膨脹：20 °C 時長 L0，溫度 T 時的長度 L = L0 × (1 + k × (T − 20))，k 是線膨脹係數（鋼約 0.0000115 /°C）。',
      ins: [['L0', '20 °C 長度 L0 (mm)', 1500], ['k', '膨脹係數 k', 0.0000115], ['T', '溫度 T (°C)', 32]],
      ast: function () { return B('mul', I('L0'), B('add', K(1), B('mul', I('k'), B('sub', I('T'), K(20))))); } },
    judge: { name: '量測判定', out: 'ok', unit: '', desc: '量測值 x 和目標值 t 差多少？差的絕對值在公差 tol 以內就合格，ok = 1；否則 ok = 0。',
      ins: [['x', '量測值 x', 100.03], ['t', '目標值 t', 100], ['tol', '公差 tol', 0.05]],
      ast: function () { return S(B('le', U('abs', B('sub', I('x'), I('t'))), I('tol')), K(1), K(0)); } },
    trap: { name: '梯形速度：移動時間', out: 't', unit: 's', desc: '右軸移動距離 d (mm)，最高速度 v (mm/s)、加速度 a (mm/s²)。距離夠長（d ≥ v²/a）是梯形：t = v/a + d/v；太短到不了最高速，變三角形：t = 2√(d/a)。',
      ins: [['d', '距離 d (mm)', 500], ['v', '最高速度 v', 200], ['a', '加速度 a', 1000]],
      ast: function () { return S(B('ge', I('d'), B('div', B('mul', I('v'), I('v')), I('a'))), B('add', B('div', I('v'), I('a')), B('div', I('d'), I('v'))), B('mul', K(2), U('sqrt', B('div', I('d'), I('a'))))); } }
  };
  var GLYPH = { add: '+', sub: '−', mul: '×', div: '÷', abs: '|x|', sqrt: '√x', le: '≤?', ge: '≥?', sel: '?:' };
  var TXT = { add: '+', sub: '-', mul: '*', div: '/', le: '<=', ge: '>=' };
  var PREC = { le: 1, ge: 1, add: 2, sub: 2, mul: 3, div: 3 };
  var NAME = { add: 'Add', sub: 'Subtract', mul: 'Multiply', div: 'Divide', abs: 'Absolute Value', sqrt: 'Square Root', le: 'Less Or Equal?', ge: 'Greater Or Equal?', sel: 'Select' };
  var X = { key: 'pulse', ast: null, vals: {}, order: [] };
  function kids(n) { return n.op === 'sel' ? [n.t, n.c, n.f] : n.op === 'in' || n.op === 'k' ? [] : n.b ? [n.a, n.b] : [n.a]; }
  function evalAst(n, env) {
    var v;
    switch (n.op) {
      case 'in': v = env[n.n]; break;
      case 'k': v = n.v; break;
      case 'add': v = evalAst(n.a, env) + evalAst(n.b, env); break;
      case 'sub': v = evalAst(n.a, env) - evalAst(n.b, env); break;
      case 'mul': v = evalAst(n.a, env) * evalAst(n.b, env); break;
      case 'div': v = evalAst(n.a, env) / evalAst(n.b, env); break;
      case 'abs': v = Math.abs(evalAst(n.a, env)); break;
      case 'sqrt': v = Math.sqrt(evalAst(n.a, env)); break;
      case 'le': v = evalAst(n.a, env) <= evalAst(n.b, env); break;
      case 'ge': v = evalAst(n.a, env) >= evalAst(n.b, env); break;
      case 'sel': var c = evalAst(n.c, env), t = evalAst(n.t, env), f = evalAst(n.f, env); v = c ? t : f; break;
    }
    n.val = v; return v;
  }
  /* 版面：葉子在第 0 欄、節點放在「高度」那一欄；葉子依序往下排，節點在子節點中間 */
  function layout(root) {
    var leaves = 0, order = [], id = 0;
    (function walk(n) {
      kids(n).forEach(walk);
      n.id = id++; order.push(n);
      if (!kids(n).length) { n.h = 0; n.y = 22 + leaves * 34; leaves++; }
      else { var ks = kids(n); n.h = 1 + Math.max.apply(null, ks.map(function (k) { return k.h; })); n.y = ks.reduce(function (s, k) { return s + k.y; }, 0) / ks.length; }
    })(root);
    return { order: order, leaves: leaves, H: root.h };
  }
  var COLW = 92;
  function nx(n) { return 10 + n.h * COLW + (n.h ? 22 : 0); }
  function nw(n) { return n.h ? 34 : 74; }
  function drawBd() {
    var ex = EX[X.key], L = layout(X.ast), W = 10 + (L.H + 1) * COLW + 120, Ht = L.leaves * 34 + 16, s = '';
    L.order.forEach(function (n) {
      var ks = kids(n);
      ks.forEach(function (k, i) {
        var off = ks.length === 1 ? 0 : ks.length === 2 ? (i ? 7 : -7) : (i - 1) * 10;
        var x1 = nx(k) + nw(k), y1 = k.y, x2 = nx(n), y2 = n.y + off, mx = x2 - 10;
        var bool = k.op === 'le' || k.op === 'ge';
        s += '<polyline class="' + (bool ? 'wb' : '') + '" points="' + x1 + ',' + y1 + ' ' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 + '"/>';
      });
    });
    var root = X.ast, rx = nx(root) + nw(root), ix = (L.H + 1) * COLW + 20;
    s += '<line x1="' + rx + '" y1="' + root.y + '" x2="' + ix + '" y2="' + root.y + '"/>';
    L.order.forEach(function (n) {
      var x = nx(n), y = n.y;
      if (n.op === 'in') s += '<g class="ctl"><rect x="' + x + '" y="' + (y - 11) + '" width="74" height="22" rx="3"/><text x="' + (x + 6) + '" y="' + (y + 4) + '">' + esc(n.n) + ' DBL</text></g>';
      else if (n.op === 'k') s += '<g class="cst"><rect x="' + x + '" y="' + (y - 11) + '" width="74" height="22" rx="3"/><text x="' + (x + 6) + '" y="' + (y + 4) + '">' + n.v + '</text></g>';
      else s += '<g class="nd" data-id="' + n.id + '"><title>' + NAME[n.op] + '</title><rect x="' + x + '" y="' + (y - 15) + '" width="34" height="30" rx="3"/><text x="' + (x + 17) + '" y="' + (y + 4) + '" text-anchor="middle">' + GLYPH[n.op] + '</text></g>';
      s += '<text class="val" id="wv' + n.id + '" x="' + (x + nw(n) + 3) + '" y="' + (y - 4) + '"></text>';
    });
    s += '<g class="ind"><rect x="' + ix + '" y="' + (root.y - 13) + '" width="96" height="26" rx="3"/><text x="' + (ix + 6) + '" y="' + (root.y + 5) + '" id="bdout">' + esc(ex.out) + ' = ?</text></g>';
    $('bd').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + Ht + '" role="img" aria-label="圖形節點方塊圖">' + s + '</svg>';
    X.order = L.order;
  }
  function ptxt(n, parentP, right) {
    if (n.op === 'in') return esc(n.n);
    if (n.op === 'k') return String(n.v);
    if (n.op === 'abs' || n.op === 'sqrt') return '<span class="op" data-id="' + n.id + '">' + n.op + '</span>(' + ptxt(n.a, 0) + ')';
    var p = PREC[n.op], s = ptxt(n.a, p) + ' <span class="op" data-id="' + n.id + '">' + TXT[n.op] + '</span> ' + ptxt(n.b, p, true);
    return p < parentP || (right && p === parentP && (n.op === 'sub' || n.op === 'div')) ? '(' + s + ')' : s;
  }
  function drawFn() {
    var ex = EX[X.key], r = X.ast, out = esc(ex.out), body;
    if (r.op === 'sel') body = '<span class="op" data-id="' + r.id + '">if</span> (' + ptxt(r.c, 0) + ')\n  ' + out + ' = ' + ptxt(r.t, 0) + ';\n<span class="op" data-id="' + r.id + '">else</span>\n  ' + out + ' = ' + ptxt(r.f, 0) + ';';
    else body = out + ' = ' + ptxt(r, 0) + ';';
    $('fnbox').innerHTML = '<div class="side l">' + ex.ins.map(function (i) { return '<span>' + esc(i[0]) + '</span>'; }).join('') + '</div><div class="side r"><span>' + out + '</span></div><pre id="fnpre">' + body + '</pre>';
  }
  function envNow() { var e = {}; EX[X.key].ins.forEach(function (i) { var v = Number($('in-' + i[0]).value); e[i[0]] = isFinite(v) ? v : 0; }); return e; }
  function clearHl() { Array.prototype.forEach.call(document.querySelectorAll('.nd.hl, .op.hl'), function (e) { e.classList.remove('hl'); }); }
  function hl(id, on) {
    Array.prototype.forEach.call(document.querySelectorAll('#bd .nd[data-id="' + id + '"], #fnpre .op[data-id="' + id + '"]'), function (e) { e.classList.toggle('hl', on); });
  }
  function showVal(n) { var t = $('wv' + n.id); if (t) t.textContent = fmt(n.val); }
  function resultText() { var ex = EX[X.key], v = X.ast.val; return ex.out + ' = ' + fmt(typeof v === 'boolean' ? (v ? 1 : 0) : v) + (ex.unit ? ' ' + ex.unit : ''); }
  function syncCalc() {
    RUN++; clearHl();
    evalAst(X.ast, envNow());
    X.order.forEach(showVal);
    $('bdout').textContent = resultText();
    var ex = EX[X.key], extra = '';
    if (X.key === 'trap') extra = X.ast.c.val ? '（距離夠長：梯形）' : '（距離太短：三角形）';
    if (X.key === 'judge') extra = X.ast.val ? '（合格）' : '（不合格）';
    $('exsay').className = 'verdict-line ok';
    $('exsay').textContent = '兩邊都算出 ' + resultText() + extra + '。';
  }
  function loadEx(k) {
    X.key = k; X.ast = EX[k].ast();
    $('exdesc').textContent = EX[k].desc;
    $('exins').innerHTML = EX[k].ins.map(function (i) { return '<label>' + esc(i[1]) + '<input id="in-' + i[0] + '" value="' + i[2] + '"></label>'; }).join('');
    drawBd(); drawFn(); syncCalc();
  }
  $('ex').innerHTML = Object.keys(EX).map(function (k) { return '<option value="' + k + '">' + EX[k].name + '</option>'; }).join('');
  $('ex').onchange = function () { loadEx(this.value); };
  $('exins').addEventListener('input', syncCalc);
  $('step').onclick = async function () {
    var my = ++RUN;
    clearHl();
    evalAst(X.ast, envNow());
    X.order.forEach(function (n) { var t = $('wv' + n.id); if (t) t.textContent = ''; });
    $('bdout').textContent = EX[X.key].out + ' = ?';
    $('exsay').className = 'verdict-line'; $('exsay').textContent = '資料流：輸入都到了的節點才執行……';
    try {
      for (var i = 0; i < X.order.length; i++) {
        var n = X.order[i];
        if (n.op === 'in' || n.op === 'k') { showVal(n); continue; }
        hl(n.id, true);
        $('exsay').textContent = NAME[n.op] + '：' + fmt(n.val) + '（右邊 Formula Node 裡同一個運算也亮起來）';
        await wait(750, my);
        showVal(n); hl(n.id, false);
      }
      $('bdout').textContent = resultText();
      syncCalc();
    } catch (e) { if (e !== 'cancel') throw e; }
  };
  loadEx('pulse');

  /* =====================================================================
     2. 語法檢查器（簡化子集：自己寫的 tokenizer / parser / interpreter，不用 eval）
     ===================================================================== */
  var TYPES = { int32: 'i', float64: 'f' };
  var FUNCS = { sin: 1, cos: 1, tan: 1, sqrt: 1, abs: 1, exp: 1, floor: 1, ceil: 1, pow: 2, max: 2, min: 2 };
  var KW = { 'if': 1, 'else': 1, 'for': 1, 'while': 1 };
  var BROKEN = '執行箭頭會斷掉，VI 不能執行；按斷掉的箭頭，Error List 會指出這個 Formula Node 有錯。';
  var MAYBE = '這個寫法本模擬器沒有實作。LabVIEW 的 Formula Node 語法比這裡多（例如 ?:、**、do…while），不一定會斷線，請以實機為準。';
  function Err(line, msg, kind) { this.line = line; this.msg = msg; this.kind = kind || 'e'; }
  function lex(src) {
    var toks = [], i = 0, line = 1, OPS = ['++', '--', '+=', '-=', '*=', '/=', '==', '!=', '<=', '>=', '&&', '||'];
    while (i < src.length) {
      var c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (src.substr(i, 2) === '//') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (src.substr(i, 2) === '/*') { var j = src.indexOf('*/', i + 2); if (j < 0) throw new Err(line, '註解 /* 沒有用 */ 結束。' + BROKEN); for (var q = i; q < j; q++) if (src[q] === '\n') line++; i = j + 2; continue; }
      var m = /^(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/.exec(src.slice(i));
      if (m) { toks.push({ t: 'num', v: Number(m[1]), isInt: /^\d+$/.test(m[1]), line: line }); i += m[1].length; continue; }
      m = /^[A-Za-z_]\w*/.exec(src.slice(i));
      if (m) { toks.push({ t: 'id', v: m[0], line: line }); i += m[0].length; continue; }
      var two = src.substr(i, 2);
      if (OPS.indexOf(two) >= 0) { toks.push({ t: 'op', v: two, line: line }); i += 2; continue; }
      if ('+-*/%<>=!(){};,'.indexOf(c) >= 0) { toks.push({ t: 'op', v: c, line: line }); i++; continue; }
      throw new Err(line, '看不懂的符號「' + c + '」。' + MAYBE);
    }
    toks.push({ t: 'eof', v: '', line: line });
    return toks;
  }
  function parse(toks) {
    var p = 0;
    function peek(k) { return toks[p + (k || 0)]; }
    function next() { return toks[p++]; }
    function isOp(v, k) { var t = peek(k); return t.t === 'op' && t.v === v; }
    function prevLine() { return p ? toks[p - 1].line : 1; }
    function expect(v, msg) { if (isOp(v)) return next(); throw new Err(peek().t === 'eof' ? prevLine() : peek().line, msg); }
    function semi() { if (isOp(';')) { next(); return; } throw new Err(prevLine(), '這一行結尾少了分號「;」。' + BROKEN); }
    function block() { next(); var list = []; while (!isOp('}')) { if (peek().t === 'eof') throw new Err(prevLine(), '大括號 { 沒有對應的 }。' + BROKEN); list.push(stmt()); } next(); return { k: 'block', list: list }; }
    function stmt() {
      var t = peek();
      if (t.t === 'op' && t.v === '{') return block();
      if (t.t === 'id' && TYPES[t.v]) {
        next(); var items = [];
        do {
          var n = peek(); if (n.t !== 'id') throw new Err(n.line, t.v + ' 後面要接變數名稱。' + BROKEN);
          next(); var init = null; if (isOp('=')) { next(); init = expr(); }
          items.push({ n: n.v, init: init, line: n.line });
        } while (isOp(',') && next());
        semi(); return { k: 'decl', type: TYPES[t.v], items: items, line: t.line };
      }
      if (t.t === 'id' && t.v === 'if') {
        next(); expect('(', 'if 後面要有小括號 ( )。' + BROKEN); var c = expr(); expect(')', 'if 的條件少了右括號 )。' + BROKEN);
        var a = stmt(), b = null; if (peek().t === 'id' && peek().v === 'else') { next(); b = stmt(); }
        return { k: 'if', c: c, t: a, f: b, line: t.line };
      }
      if (t.t === 'id' && t.v === 'while') {
        next(); expect('(', 'while 後面要有小括號 ( )。' + BROKEN); var wc = expr(); expect(')', 'while 的條件少了右括號 )。' + BROKEN);
        return { k: 'while', c: wc, body: stmt(), line: t.line };
      }
      if (t.t === 'id' && t.v === 'for') {
        next(); expect('(', 'for 後面要有小括號 ( )。' + BROKEN);
        var init = isOp(';') ? null : simple(); expect(';', 'for 的括號裡要用兩個分號隔成三段：for (起始; 條件; 每圈做)。' + BROKEN);
        var fc = isOp(';') ? null : expr(); expect(';', 'for 的括號裡要用兩個分號隔成三段。' + BROKEN);
        var upd = isOp(')') ? null : simple(); expect(')', 'for 的括號少了 )。' + BROKEN);
        return { k: 'for', init: init, c: fc, upd: upd, body: stmt(), line: t.line };
      }
      if (t.t === 'id' && peek(1).t === 'id') {
        var ci = Object.keys(TYPES).filter(function (k) { return k.toLowerCase() === t.v.toLowerCase(); })[0];
        throw new Err(t.line, ci ? '型別要寫成「' + ci + '」，大小寫有分，「' + t.v + '」不認得。' + BROKEN : '「' + t.v + ' ' + peek(1).v + '」看起來像宣告，但「' + t.v + '」不是本模擬器認得的型別（只認得 int32、float64）；如果不是宣告，就是前一個敘述少了運算符號或分號。');
      }
      var s = simple(); semi(); return s;
    }
    function simple() {
      var t = next();
      if (t.t !== 'id' || KW[t.v]) throw new Err(t.line, t.v === 'else' ? 'else 前面沒有對應的 if。' + BROKEN : '這裡應該是「變數 = 算式」，看不懂「' + t.v + '」。' + (KW[t.v] ? MAYBE : BROKEN));
      var o = peek();
      if (o.t === 'op' && (o.v === '++' || o.v === '--')) { next(); return { k: 'inc', n: t.v, op: o.v, line: t.line }; }
      if (o.t === 'op' && ['=', '+=', '-=', '*=', '/='].indexOf(o.v) >= 0) { next(); return { k: 'set', n: t.v, op: o.v, e: expr(), line: t.line }; }
      throw new Err(o.t === 'eof' ? t.line : o.line, '「' + t.v + '」後面應該是 = 或 ++，看到的是「' + (o.v || '結尾') + '」。如果上一行沒有分號，LabVIEW 會把兩行當成一行讀。' + BROKEN);
    }
    function bin(nextFn, ops) {
      return function () {
        var a = nextFn();
        while (peek().t === 'op' && ops.indexOf(peek().v) >= 0) { var o = next(); a = { k: 'bin', op: o.v, a: a, b: nextFn(), line: o.line }; }
        return a;
      };
    }
    function unary() {
      if (peek().t === 'op' && (peek().v === '-' || peek().v === '!' || peek().v === '+')) { var o = next(); return { k: 'un', op: o.v, a: unary(), line: o.line }; }
      return primary();
    }
    function primary() {
      var t = next();
      if (t.t === 'num') return { k: 'num', v: t.v, isInt: t.isInt, line: t.line };
      if (t.t === 'id' && !KW[t.v]) {
        if (isOp('(')) {
          next(); var args = [];
          if (!isOp(')')) { args.push(expr()); while (isOp(',')) { next(); args.push(expr()); } }
          expect(')', '函式 ' + t.v + '( 少了右括號 )。' + BROKEN);
          return { k: 'call', f: t.v, args: args, line: t.line };
        }
        return { k: 'var', n: t.v, line: t.line };
      }
      if (t.t === 'op' && t.v === '(') { var e = expr(); expect(')', '少了右括號 )。' + BROKEN); return e; }
      throw new Err(t.line, t.t === 'eof' ? '算式沒寫完就結束了。' + BROKEN : '算式裡看不懂「' + t.v + '」。' + MAYBE);
    }
    var mul = bin(unary, ['*', '/', '%']), add = bin(mul, ['+', '-']), rel = bin(add, ['<', '<=', '>', '>=']), eq = bin(rel, ['==', '!=']), and = bin(eq, ['&&']), or = bin(and, ['||']);
    function expr() { return or(); }
    var list = [];
    while (peek().t !== 'eof') list.push(stmt());
    return list;
  }
  /* 檢查變數、函式有沒有宣告；收集全部錯誤 */
  function check(prog, ins, outs) {
    var known = {}, errs = [];
    ins.forEach(function (n) { known[n] = 'f'; }); outs.forEach(function (n) { known[n] = 'f'; });
    function ciHint(name) {
      var all = Object.keys(known).filter(function (k) { return k.toLowerCase() === name.toLowerCase(); });
      return all.length ? '大小寫不一致：你宣告的是「' + all[0] + '」，Formula Node 的 ' + all[0] + ' 和 ' + name + ' 是兩個不同的變數。' : '';
    }
    function useVar(n, line) { if (!known[n] && !errs.some(function (e) { return e.line === line && e.n === n; })) errs.push(Object.assign(new Err(line, (ciHint(n) || '變數「' + n + '」沒有宣告：它不是邊框上的輸入或輸出，也沒有用 int32／float64 宣告。') + BROKEN), { n: n })); }
    function ex(e) {
      if (!e) return;
      if (e.k === 'var') useVar(e.n, e.line);
      else if (e.k === 'call') {
        if (!(e.f in FUNCS)) {
          var c = Object.keys(FUNCS).filter(function (f) { return f.toLowerCase() === e.f.toLowerCase(); })[0];
          errs.push(new Err(e.line, c ? '函式名稱大小寫不對：要寫「' + c + '」，不是「' + e.f + '」。' + BROKEN : '「' + e.f + '」不在本模擬器認得的函式裡（sin cos tan sqrt abs exp floor ceil pow max min）。LabVIEW 遇到不認得的函式名稱，' + BROKEN));
        } else if (FUNCS[e.f] !== e.args.length) errs.push(new Err(e.line, e.f + ' 要 ' + FUNCS[e.f] + ' 個參數，這裡給了 ' + e.args.length + ' 個。' + BROKEN));
        e.args.forEach(ex);
      } else if (e.k === 'bin') { ex(e.a); ex(e.b); } else if (e.k === 'un') ex(e.a);
    }
    function st(s) {
      if (!s) return;
      if (s.k === 'decl') s.items.forEach(function (it) { ex(it.init); known[it.n] = s.type; });
      else if (s.k === 'set') { ex(s.e); useVar(s.n, s.line); }
      else if (s.k === 'inc') useVar(s.n, s.line);
      else if (s.k === 'if') { ex(s.c); st(s.t); st(s.f); }
      else if (s.k === 'while') { ex(s.c); st(s.body); }
      else if (s.k === 'for') { st(s.init); ex(s.c); st(s.upd); st(s.body); }
      else if (s.k === 'block') s.list.forEach(st);
    }
    prog.forEach(st);
    return errs;
  }
  /* 解譯執行。碰到本模擬器不下結論的地方（整數相除除不盡、% 用在小數或負數、小數存進 int32、除以 0）就停下來說明 */
  function Stop(line, msg) { this.line = line; this.msg = msg; this.kind = 'w'; }
  function run(prog, inVals, outs) {
    var env = {}, steps = 0, assigned = {};
    Object.keys(inVals).forEach(function (n) { env[n] = { t: 'f', v: inVals[n] }; });
    outs.forEach(function (n) { if (!env[n]) env[n] = { t: 'f', v: 0 }; });
    function typ(e) {
      if (e.k === 'num') return e.isInt ? 'i' : 'f';
      if (e.k === 'var') return env[e.n] ? env[e.n].t : 'f';
      if (e.k === 'call') return 'f';
      if (e.k === 'un') return e.op === '!' ? 'i' : typ(e.a);
      if (['<', '<=', '>', '>=', '==', '!=', '&&', '||'].indexOf(e.op) >= 0) return 'i';
      return typ(e.a) === 'i' && typ(e.b) === 'i' ? 'i' : 'f';
    }
    function ev(e) {
      if (e.k === 'num') return e.v;
      if (e.k === 'var') return env[e.n] ? env[e.n].v : 0;
      if (e.k === 'un') { var u = ev(e.a); return e.op === '-' ? -u : e.op === '!' ? (u ? 0 : 1) : u; }
      if (e.k === 'call') { var a = e.args.map(ev); return e.f === 'pow' ? Math.pow(a[0], a[1]) : e.f === 'max' ? Math.max(a[0], a[1]) : e.f === 'min' ? Math.min(a[0], a[1]) : Math[e.f](a[0]); }
      var x = ev(e.a), y;
      if (e.op === '&&') return x && ev(e.b) ? 1 : 0;
      if (e.op === '||') return x || ev(e.b) ? 1 : 0;
      y = ev(e.b);
      switch (e.op) {
        case '+': return x + y; case '-': return x - y; case '*': return x * y;
        case '/':
          if (y === 0) throw new Stop(e.line, '除以 0：本模擬器不示範，結果請以 LabVIEW 實測為準。');
          if (typ(e.a) === 'i' && typ(e.b) === 'i' && x % y !== 0) throw new Stop(e.line, '兩個整數相除（' + x + ' / ' + y + '）除不盡。結果是小數還是只留整數，要看 LabVIEW 怎麼決定型別，本模擬器不下結論。想要小數就寫成 ' + x + '.0；想要整數商就用 floor()。');
          return x / y;
        case '%':
          if (x < 0 || y <= 0 || x !== Math.floor(x) || y !== Math.floor(y)) throw new Stop(e.line, '本模擬器只示範 0 和正整數的 %（' + fmt(x) + ' % ' + fmt(y) + ' 不示範）。');
          return x % y;
        case '<': return x < y ? 1 : 0; case '<=': return x <= y ? 1 : 0; case '>': return x > y ? 1 : 0; case '>=': return x >= y ? 1 : 0;
        case '==': return x === y ? 1 : 0; case '!=': return x !== y ? 1 : 0;
      }
      return 0;
    }
    function put(n, v, line) {
      if (!env[n]) env[n] = { t: 'f', v: 0 };
      if (env[n].t === 'i' && v !== Math.floor(v)) throw new Stop(line, '把小數 ' + fmt(v) + ' 存進 int32 變數「' + n + '」：會被轉成整數，捨入規則請以 LabVIEW 實測為準，本模擬器停在這裡。');
      env[n].v = v; assigned[n] = 1;
    }
    function tick(line) { if (++steps > 20000) throw new Stop(line, '迴圈跑了太多圈（超過 20000 步），可能是無窮迴圈。在 LabVIEW 裡這會讓 VI 一直跑不停。'); }
    function st(s) {
      if (!s) return;
      tick(s.line);
      if (s.k === 'decl') s.items.forEach(function (it) { env[it.n] = { t: s.type, v: 0 }; if (it.init) put(it.n, ev(it.init), it.line); });
      else if (s.k === 'set') { var v = ev(s.e), cur = env[s.n].v; put(s.n, s.op === '=' ? v : s.op === '+=' ? cur + v : s.op === '-=' ? cur - v : s.op === '*=' ? cur * v : (v === 0 ? (function () { throw new Stop(s.line, '除以 0：本模擬器不示範。'); })() : cur / v), s.line); }
      else if (s.k === 'inc') put(s.n, env[s.n].v + (s.op === '++' ? 1 : -1), s.line);
      else if (s.k === 'if') { if (ev(s.c)) st(s.t); else st(s.f); }
      else if (s.k === 'while') { while (ev(s.c)) { tick(s.line); st(s.body); } }
      else if (s.k === 'for') { st(s.init); while (s.c ? ev(s.c) : 1) { tick(s.line); st(s.body); st(s.upd); } }
      else if (s.k === 'block') s.list.forEach(st);
    }
    prog.forEach(st);
    var out = {}; outs.forEach(function (n) { out[n] = assigned[n] ? env[n].v : null; });
    return out;
  }
  function parseIns(txt) {
    var vals = {}, errs = [];
    txt.split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (s) {
      var m = /^([A-Za-z_]\w*)\s*=\s*(-?[\d.]+(?:[eE][+-]?\d+)?)$/.exec(s);
      if (m) vals[m[1]] = Number(m[2]); else errs.push('輸入「' + s + '」要寫成「名稱 = 數字」。');
    });
    return { vals: vals, errs: errs };
  }
  function parseOuts(txt) { return txt.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return /^[A-Za-z_]\w*$/.test(s); }); }
  /* 對外：checkFormula(src, inputs{名稱:值}, outputs[名稱]) → {ok, errors:[{line,msg,kind}], outputs} */
  function checkFormula(src, ins, outs) {
    var res = { ok: false, errors: [], outputs: null };
    var dup = Object.keys(ins).filter(function (n) { return outs.indexOf(n) >= 0; });
    if (dup.length) { res.errors.push({ line: 0, msg: '「' + dup[0] + '」同時是輸入和輸出。本模擬器請用不同名字。', kind: 'w' }); return res; }
    try {
      var prog = parse(lex(src));
      var errs = check(prog, Object.keys(ins), outs);
      if (errs.length) { res.errors = errs; return res; }
      if (!prog.length) { res.errors.push({ line: 0, msg: 'Formula Node 是空的。', kind: 'w' }); return res; }
      res.outputs = run(prog, ins, outs); res.ok = true;
    } catch (e) {
      if (e instanceof Err || e instanceof Stop) res.errors.push({ line: e.line, msg: e.msg, kind: e.kind }); else throw e;
    }
    return res;
  }
  var SX = [
    { n: '正確：兩點距離', ins: 'x = 3, y = 4', outs: 'z', src: '// 右軸、左軸的位移量算直線距離\nz = sqrt(x*x + y*y);' },
    { n: '錯：少了分號', ins: 'x = 3, y = 4', outs: 'z', src: 'float64 d;\nd = x*x + y*y\nz = sqrt(d);' },
    { n: '錯：大小寫不一致', ins: 'x = 3, y = 4', outs: 'z', src: 'z = sqrt(X*X + y*y);' },
    { n: '錯：變數沒宣告', ins: 'x = 3, y = 4', outs: 'z', src: 'd = x*x + y*y;\nz = sqrt(d);' },
    { n: '錯：函式名稱大小寫', ins: 'x = 3, y = 4', outs: 'z', src: 'z = Sqrt(x*x + y*y);' },
    { n: 'if / else：量測判定', ins: 'x = 100.03, t = 100, tol = 0.05', outs: 'ok', src: 'if (abs(x - t) <= tol)\n  ok = 1;\nelse\n  ok = 0;' },
    { n: 'if / else：梯形速度', ins: 'd = 500, v = 200, a = 1000', outs: 't', src: 'float64 da;\nda = v*v/a;   // 加速＋減速要走的距離\nif (d >= da)\n  t = v/a + d/v;\nelse\n  t = 2*sqrt(d/a);' },
    { n: 'for：1 加到 n', ins: 'n = 10', outs: 's', src: 'int32 i;\ns = 0;\nfor (i = 1; i <= n; i++)\n  s = s + i;' },
    { n: 'while：幾圈才超過目標', ins: 'step = 0.35, target = 10', outs: 'pos, k', src: 'pos = 0;\nk = 0;\nwhile (pos < target) {\n  pos = pos + step;\n  k++;\n}' }
  ];
  $('sx').innerHTML = SX.map(function (s, i) { return '<option value="' + i + '">' + esc(s.n) + '</option>'; }).join('');
  function loadSx(i) { var s = SX[i]; $('sin').value = s.ins; $('sout').value = s.outs; $('src').value = s.src; doCheck(); }
  $('sx').onchange = function () { loadSx(+this.value); };
  function doCheck() {
    var pi = parseIns($('sin').value), outs = parseOuts($('sout').value), msgs = [];
    pi.errs.forEach(function (m) { msgs.push({ kind: 'w', line: 0, msg: m }); });
    var r = pi.errs.length ? { ok: false, errors: [] } : checkFormula($('src').value, pi.vals, outs);
    msgs = msgs.concat(r.errors);
    var hard = r.errors.some(function (e) { return e.kind === 'e'; });
    $('arrow').className = 'runarrow' + (hard ? ' broken' : '');
    $('arrow').title = hard ? '執行箭頭斷掉' : '可以執行';
    var bad = {}; msgs.forEach(function (m) { if (m.line) bad[m.line] = 1; });
    $('lst').innerHTML = $('src').value.split('\n').map(function (l, i) { return '<div' + (bad[i + 1] ? ' class="bad"' : '') + '><i>' + (i + 1) + '</i>' + esc(l) + '</div>'; }).join('');
    var h = msgs.map(function (m) { return '<li class="' + m.kind + '">' + (m.line ? '第 ' + m.line + ' 行：' : '') + esc(m.msg) + '</li>'; }).join('');
    if (r.ok) h += '<li class="ok">語法正確，執行結果：' + outs.map(function (n) { return n + ' = ' + (r.outputs[n] == null ? '（公式裡沒有指定）' : fmt(r.outputs[n])); }).join('，') + '</li>';
    $('msgs').innerHTML = h;
    return r;
  }
  $('chk').onclick = doCheck;
  loadSx(0);

  /* =====================================================================
     3. 整數除法
     ===================================================================== */
  function qr(x, y) { return { iq: Math.floor(x / y), r: x - y * Math.floor(x / y) }; }
  function readXY() {
    var x = Math.floor(Number($('ix').value)), y = Math.floor(Number($('iy').value));
    if (!isFinite(x) || x < 0) x = 0; if (!isFinite(y) || y < 1) y = 1;
    if (x > 9999999) x = 9999999; if (y > 9999999) y = 9999999;
    $('ix').value = x; $('iy').value = y; return { x: x, y: y };
  }
  async function runInt() {
    var my = ++RUN, v = readXY(), x = v.x, y = v.y, r = qr(x, y);
    ['o-div', 'o-iq', 'o-r', 'o-fq', 'o-fr'].forEach(function (id) { $(id).textContent = '?'; });
    $('isay').textContent = '';
    var box = $('dots');
    try {
      if (x <= 60 && x / y <= 30) {
        box.innerHTML = '';
        var groups = [];
        for (var g = 0; g < r.iq; g++) { var d = document.createElement('div'); d.className = 'grp'; box.appendChild(d); groups.push(d); }
        var rest = document.createElement('div'); rest.className = 'grp rest'; if (r.r) box.appendChild(rest);
        var cells = [];
        for (var i = 0; i < x; i++) { var dot = document.createElement('i'); dot.className = 'dot pending'; (i < r.iq * y ? groups[Math.floor(i / y)] : rest).appendChild(dot); cells.push(dot); }
        for (i = 0; i < x; i++) { cells[i].classList.remove('pending'); await wait(Math.max(25, 600 / x), my); }
      } else box.innerHTML = '<p class="why">數字太大，不畫點：' + x + ' 分成每組 ' + y + ' 個。</p>';
      await wait(250, my);
      $('o-div').textContent = fmt(x / y);
      $('o-iq').textContent = r.iq; $('o-r').textContent = r.r;
      $('o-fq').textContent = r.iq; $('o-fr').textContent = r.r;
      $('isay').className = 'verdict-line ok';
      $('isay').textContent = x + ' 個、每 ' + y + ' 個一組：' + r.iq + ' 整組，剩 ' + r.r + ' 個（' + r.iq + ' × ' + y + ' + ' + r.r + ' = ' + x + '）。Divide 給的是小數 ' + fmt(x / y) + '。' + (y === 10000 ? '也就是轉了 ' + r.iq + ' 整圈，多 ' + r.r + ' 個脈波。' : '');
    } catch (e) { if (e !== 'cancel') throw e; }
  }
  $('irun').onclick = runInt;
  $('ipulse').onclick = function () { $('ix').value = 25300; $('iy').value = 10000; runInt(); };

  if (/^#(cmp|syn|int)$/.test(location.hash)) show(location.hash.slice(1));

  /* =====================================================================
     4. 猜一猜
     ===================================================================== */
  var NOGO = '執行箭頭斷掉，不能執行';
  var GENS = [
    function () {
      return { q: 'Formula Node 左邊框宣告了輸入 <code>x</code>，公式寫 <code>y = X * 2;</code>（右邊框有輸出 y）。結果是？', ans: NOGO + '（X 沒有宣告）', wrong: ['正常執行，LabVIEW 不分大小寫', '自動把 X 改成 x', 'X 當成 0，y = 0'], ex: 'Formula Node 大小寫有分，x 和 X 是兩個不同的變數，X 沒有宣告就是語法錯誤。' };
    },
    function () {
      return { q: 'Formula Node 裡第 1 行 <code>d = x*x + y*y</code> 結尾忘了分號，第 2 行是 <code>z = sqrt(d);</code>。結果是？', ans: NOGO + '（語法錯誤）', wrong: ['照樣執行，換行就等於分號', '只跳出警告，照樣執行', 'LabVIEW 自動補上分號'], ex: '每個敘述都要用分號結束。少了分號，LabVIEW 會把兩行接在一起讀，看不懂就斷箭頭。' };
    },
    function () {
      var y = pickOne([2, 4, 5, 8]), x; do { x = rint(3, 40); } while (x % y === 0);
      var ans = fmt(x / y);
      return { q: '兩個 <b>I32</b> 常數 ' + x + ' 和 ' + y + ' 接到圖形的 <b>Divide（÷）</b>，輸出是？', ans: ans + '（DBL）', wrong: [Math.floor(x / y) + '（I32）', Math.ceil(x / y) + '（I32）', (x % y) + '（I32）', Math.round(x / y) + '（DBL）'].filter(function (w) { return w !== ans + '（DBL）'; }),
        ex: 'Divide 的輸出一定是浮點數，整數相除也會得到小數。要整數商和餘數，用 Quotient & Remainder。' };
    },
    function () {
      var y = rint(2, 9), x = rint(y + 1, 60), r = qr(x, y);
      var ans = 'IQ = ' + r.iq + '，R = ' + r.r;
      return { q: '<b>Quotient & Remainder</b>：x = ' + x + '，y = ' + y + '（都是 I32）。輸出是？', ans: ans, wrong: ['IQ = ' + r.r + '，R = ' + r.iq, 'IQ = ' + (r.iq + 1) + '，R = ' + Math.abs(r.r - y), 'IQ = ' + fmt(x / y) + '，R = 0', 'IQ = ' + r.iq + '，R = ' + (r.r + 1)].filter(function (w) { return w !== ans; }),
        ex: x + ' = ' + r.iq + ' × ' + y + ' + ' + r.r + '。IQ 是幾整組，R 是剩下的。' };
    },
    function () {
      var p = pickOne([12500, 25000, 37500, 30000, 5000, 42000]), mm = p / 10000 * 10;
      return { q: 'Formula Node：<code>mm = p / ppr * lead;</code>，p = ' + p + '、ppr = 10000、lead = 10（都是 DBL）。mm 是？', ans: fmt(mm), wrong: [fmt(p / 10000), fmt(p / (10000 * 10)), fmt(p * 10), fmt(mm * 10)].filter(function (w) { return w !== fmt(mm); }),
        ex: '先算 p / ppr = ' + fmt(p / 10000) + ' 圈，再乘導程 10 mm：' + fmt(mm) + ' mm。/ 和 * 同一層，由左往右算。' };
    },
    function () {
      var x = pickOne([100.03, 99.98, 100.07, 99.94, 100.05, 100.0]), ok = Math.abs(x - 100) <= 0.05 + 1e-12 ? 1 : 0;
      return { q: '<code>if (abs(x - t) &lt;= tol) ok = 1; else ok = 0;</code>，t = 100、tol = 0.05、x = ' + x + '。ok 是？', ans: String(ok), wrong: [String(1 - ok), fmt(Math.abs(x - 100)), '-1', '執行箭頭斷掉'],
        ex: '|' + x + ' − 100| = ' + fmt(Math.abs(x - 100)) + (ok ? '，不超過 0.05，合格。' : '，超過 0.05，不合格。') };
    },
    function () {
      var n = rint(3, 12), s = n * (n + 1) / 2;
      return { q: '<code>int32 i; s = 0; for (i = 1; i &lt;= n; i++) s = s + i;</code>，n = ' + n + '。s 是？', ans: String(s), wrong: [String(n * (n - 1) / 2), String(n * n), String(n * (n + 1)), String(s + n + 1)].filter(function (w) { return w !== String(s); }),
        ex: 'i 從 1 跑到 ' + n + '（含），s = 1 + 2 + … + ' + n + ' = ' + s + '。' };
    },
    function () {
      return { q: 'Formula Node 裡要用一個自己的整數計數變數 i，正確的宣告是？', ans: 'int32 i;', wrong: ['Int32 i;', 'i as int32;', 'var i: int32;', 'int32 i'], ex: '型別寫在前面、名稱在後面、分號結尾，大小寫要對：int32、float64。' };
    },
    function () {
      return { q: 'Formula Node 的<b>輸出變數</b> z 要怎麼宣告？', ans: '在邊框上右鍵 ▸ Add Output，打 z', wrong: ['在公式第一行寫 output z;', '不用宣告，等號左邊出現過就自動變輸出', '在前面板放一個 Indicator 就好'], ex: '輸入、輸出變數都在邊框上宣告：左邊 Add Input、右邊 Add Output，輸出的框比較粗。' };
    },
    function () {
      var F = pickOne([['y = (a + b) * c;', 2, 'Add、Multiply'], ['y = (a + b) * c / d;', 3, 'Add、Multiply、Divide'], ['y = a * b + c * d;', 3, 'Multiply ×2、Add'], ['y = sqrt(a*a + b*b);', 4, 'Multiply ×2、Add、Square Root']]);
      return { q: '把 <code>' + F[0] + '</code> 改用圖形節點拉線，至少要幾個運算節點？', ans: String(F[1]), wrong: [F[1] - 1, F[1] + 1, F[1] + 2, 1].map(String).filter(function (w) { return w !== String(F[1]); }), ex: '每個運算子或函式一個節點：' + F[2] + '。公式越長，Formula Node 越省地方。' };
    }
  ];
  function gen() { return pickOne(GENS)(); }

  window.FormulaLab = {
    EX: EX, evalAst: evalAst, lex: lex, parse: parse, checkFormula: checkFormula, quotRem: qr, show: show, loadEx: loadEx, loadSx: loadSx, doCheck: doCheck, runInt: runInt,
    GENS: GENS, gen: gen, quiz: window.LabQuiz ? window.LabQuiz('fquiz', gen) : null
  };
})();
