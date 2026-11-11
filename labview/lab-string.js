/* 字串實驗室：函式逐字元顯示、格式碼、顯示模式 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var CTL = { 0: 'NUL', 2: 'STX', 3: 'ETX', 4: 'EOT', 5: 'ENQ', 6: 'ACK', 8: 'BS', 9: 'TAB', 10: 'LF', 12: 'FF', 13: 'CR', 21: 'NAK', 27: 'ESC' };

  /* '\' Codes 寫法 → 真正的字串 */
  function unesc(s) {
    return s.replace(/\\([0-9A-F]{2}|[rntsbf\\])/g, function (m, c) {
      if (c.length === 2) return String.fromCharCode(parseInt(c, 16));
      return { r: '\r', n: '\n', t: '\t', s: ' ', b: '\b', f: '\f', '\\': '\\' }[c];
    });
  }
  function toCodes(s) {
    var o = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i), ch = s[i];
      if (ch === '\r') o += '\\r'; else if (ch === '\n') o += '\\n'; else if (ch === '\t') o += '\\t'; else if (ch === ' ') o += '\\s';
      else if (ch === '\\') o += '\\\\'; else if (c < 32 || c === 127) o += '\\' + ('0' + c.toString(16).toUpperCase()).slice(-2); else o += ch;
    }
    return o;
  }
  function byteLen(s) { var n = 0; for (var i = 0; i < s.length; i++) n += s.charCodeAt(i) > 127 ? 2 : 1; return n; }

  /* 把字串畫成一格一格 */
  function strip(box, s, mark) {
    box.innerHTML = '';
    if (!s.length) { box.appendChild(el('span', 'why', '（空字串）')); return; }
    for (var i = 0; i < s.length && i < 80; i++) {
      var c = s.charCodeAt(i), cls = 'ch', txt = esc(s[i]);
      if (s[i] === ' ') { cls += ' sp'; txt = '␣'; }
      else if (c < 32 || c === 127) { cls += ' ctl'; txt = CTL[c] || ('0' + c.toString(16).toUpperCase()).slice(-2); }
      var m = mark ? mark(i) : ''; if (m) cls += ' ' + m;
      var d = el('span', cls, '<b>' + txt + '</b><small>' + i + '</small>');
      box.appendChild(d);
    }
  }

  /* ---------- 分頁 ---------- */
  var tabs = $('tabs');
  function show(t) {
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['fn', 'fmt', 'disp'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  if (/^#(fn|fmt|disp)$/.test(location.hash)) show(location.hash.slice(1));

  /* ---------- 函式 ---------- */
  function rng(a, n) { return function (i) { return i >= a && i < a + n ? 'hit' : ''; }; }
  var F = [
    { key: 'len', name: 'String Length', zh: '字串長度', desc: '回傳字串有幾個位元組。空格、換行都算。',
      ins: [['s', 'string', 'str', 'Hello LabVIEW ']],
      run: function (v) { var n = byteLen(v.s); return { outs: [['length', n, 'num']], say: '共 ' + n + ' 個位元組。' + (/ $/.test(v.s) ? '注意最後有一個空格，也算 1。' : '') + (n !== v.s.length ? '中文字在繁體中文 Windows 上一個佔 2 個位元組。' : '') }; },
      notes: ['比較兩個字串是否相等時，尾巴多一個看不見的空格就會「不相等」。先用 Trim Whitespace 再比。', '通訊收到的資料長度，就是用這個函式檢查。'] },
    { key: 'concat', name: 'Concatenate Strings', zh: '連結字串', desc: '把幾個字串頭尾接起來。它不會自動加空格或分隔符號。',
      ins: [['a', '字串 1', 'str', '台北'], ['b', '字串 2', 'str', ' '], ['c', '字串 3', 'str', '高雄']],
      run: function (v) { var r = v.a + v.b + v.c, la = v.a.length, lb = v.b.length; return { src: r, outs: [['concatenated string', r, 'str', function (i) { return i < la ? '' : i < la + lb ? 'hit' : 'new'; }]], say: '三段直接相接，中間要空格得自己接一個空格字串。' }; },
      notes: ['拉長節點可以增加輸入端；也可以直接接一個字串的 1D 陣列。', '組 PLC 命令封包就是這樣：站號 + 命令 + 位址 + 資料，一段一段接。'] },
    { key: 'subset', name: 'String Subset', zh: '取出部分字串', desc: '從 offset 開始，取 length 個字元。位置從 0 算起。',
      ins: [['s', 'string', 'str', '00FF12AB3C'], ['o', 'offset', 'num', 4], ['n', 'length', 'num', 4]],
      run: function (v) { var o = Math.max(0, v.o), r = v.s.substr(o, Math.max(0, v.n)); return { inmark: rng(o, r.length), outs: [['substring', r, 'str']], say: '從位置 ' + o + ' 起取 ' + r.length + ' 個字元' + (r.length < v.n ? '（要 ' + v.n + ' 個，但字串不夠長，有多少給多少，不會出錯）' : '') + '。' }; },
      notes: ['length 沒接線就取到字串結尾；offset 沒接線就是 0。', 'PLC 回傳 "00FF12AB3C" 這種固定格式時，用它切出資料那一段。'] },
    { key: 'replace', name: 'Replace Substring', zh: '替換部分字串', desc: '在 offset 位置，拿掉 length 個字元，換成 substring。',
      ins: [['s', 'string', 'str', 'Motor=OFF'], ['sub', 'substring', 'str', 'ON'], ['o', 'offset', 'num', 6], ['n', 'length', 'num', 3]],
      run: function (v) { var o = Math.max(0, Math.min(v.o, v.s.length)), n = Math.max(0, v.n), gone = v.s.substr(o, n), r = v.s.slice(0, o) + v.sub + v.s.slice(o + n); return { inmark: rng(o, gone.length), outs: [['result string', r, 'str', function (i) { return i >= o && i < o + v.sub.length ? 'new' : ''; }], ['replaced substring', gone, 'str']], say: '拿掉 "' + gone + '"（' + gone.length + ' 個字元），放進 "' + v.sub + '"（' + v.sub.length + ' 個字元）。兩邊長度不必一樣。' }; },
      notes: ['length 設 0 就變成「插入」；substring 給空字串就變成「刪除」。', 'length 等於 substring 的長度，就是等長覆蓋，字串總長不變。'] },
    { key: 'sr', name: 'Search and Replace String', zh: '搜尋並取代', desc: '找出 search string，換成 replace string。不用自己算位置。',
      ins: [['s', 'input string', 'str', 'a-b-c-d'], ['f', 'search string', 'str', '-'], ['r', 'replace string', 'str', ', '], ['all', 'replace all?', 'bool', false], ['ic', 'ignore case?', 'bool', false]],
      run: function (v) {
        if (!v.f) return { outs: [['result string', v.s, 'str']], say: 'search string 是空的，不做任何事。' };
        var hay = v.ic ? v.s.toLowerCase() : v.s, nd = v.ic ? v.f.toLowerCase() : v.f, pos = [], i = 0, k;
        while ((k = hay.indexOf(nd, i)) >= 0) { pos.push(k); i = k + nd.length; if (!v.all) break; }
        var r = '', last = 0, newAt = [];
        pos.forEach(function (p) { r += v.s.slice(last, p); newAt.push([r.length, v.r.length]); r += v.r; last = p + nd.length; });
        r += v.s.slice(last);
        return { inmark: function (j) { return pos.some(function (p) { return j >= p && j < p + nd.length; }) ? 'hit' : ''; },
          outs: [['result string', r, 'str', function (j) { return newAt.some(function (a) { return j >= a[0] && j < a[0] + a[1]; }) ? 'new' : ''; }], ['number of replacements', pos.length, 'num']],
          say: pos.length ? '找到 ' + pos.length + ' 處並取代。' + (!v.all && hay.indexOf(nd, pos[0] + nd.length) >= 0 ? '後面還有相同的字，但 replace all? 是 False（預設），所以只換第一個。' : '') : '找不到 "' + v.f + '"，輸出和輸入一樣' + (!v.ic && v.s.toLowerCase().indexOf(v.f.toLowerCase()) >= 0 ? '（大小寫不同；打開 ignore case? 就找得到）' : '') + '。' };
      },
      notes: ['replace all? 預設是 False：只換第一個。最常見的錯就是忘了接 True。', '把逗號換成 Tab、把小數點逗號換成句點，都靠它。'] },
    { key: 'match', name: 'Match Pattern', zh: '比對樣式', desc: '用樣式找出第一個符合的地方，把字串切成前、中、後三段。',
      ins: [['s', 'string', 'str', 'Temp: 25.6 C'], ['p', 'regular expression', 'str', '[0-9]+'], ['o', 'offset', 'num', 0]],
      run: function (v) {
        var re; try { re = new RegExp(v.p, 'g'); } catch (e) { return { outs: [], say: '樣式寫錯了：' + e.message }; }
        re.lastIndex = Math.max(0, v.o); var m = v.p ? re.exec(v.s) : null;
        if (!m) return { outs: [['before substring', v.s, 'str'], ['match substring', '', 'str'], ['after substring', '', 'str'], ['offset past match', -1, 'num']], say: '找不到符合的：match 是空字串，offset past match = -1。程式裡用「是不是 -1」判斷有沒有找到。' };
        var a = m.index, n = m[0].length;
        return { inmark: rng(a, n), outs: [['before substring', v.s.slice(0, a), 'str'], ['match substring', m[0], 'str'], ['after substring', v.s.slice(a + n), 'str'], ['offset past match', a + n, 'num']],
          say: '在位置 ' + a + ' 找到 "' + m[0] + '"。offset past match = ' + (a + n) + '，是符合處的「下一個」位置；把它接回 offset 再找一次，就能找到下一個。' };
      },
      notes: ['常用樣式：[0-9]+ 一串數字、[A-Za-z]+ 一串英文字母、^ 開頭、$ 結尾、. 任一字元。', '要把所有符合的都找出來：放進 While Loop，offset past match 用 Shift Register 傳回 offset，直到變成 -1。', '這個實驗室用瀏覽器的規則運算式來模擬。真正的 Match Pattern 語法比較少：不支援 \d、\w、{n} 這類寫法，數字請寫 [0-9]。需要分組、指定次數時，改用 Match Regular Expression。'] },
    { key: 'trim', name: 'Trim Whitespace', zh: '去掉頭尾空白', desc: '去掉字串兩端的空格、Tab、換行。中間的不動。',
      ins: [['s', 'string（可用 \\r \\n \\t）', 'code', '  OK 123 \\r\\n']],
      run: function (v) { var a = v.s.length - v.s.replace(/^\s+/, '').length, r = v.s.trim(); return { inmark: function (i) { return i < a || i >= a + r.length ? 'dim' : ''; }, outs: [['trimmed string', r, 'str']], say: '頭去掉 ' + a + ' 個、尾去掉 ' + (v.s.length - a - r.length) + ' 個空白字元。' }; },
      notes: ['使用者輸入、儀器回傳的字串，比較或轉數字之前先 Trim，是標準的防呆。', 'location 輸入可以選只去頭或只去尾。'] },
    { key: 'd2n', name: 'Decimal String To Number', zh: '十進位字串轉數字', desc: '從 offset 開始讀整數，讀到不是數字的字元就停。',
      ins: [['s', 'string', 'str', '120rpm'], ['o', 'offset', 'num', 0], ['d', 'default', 'num', 0]],
      run: function (v) { var o = Math.max(0, v.o), m = /^\s*[-+]?\d+/.exec(v.s.slice(o)); if (!m) return { inmark: rng(o, 1), outs: [['number', v.d, 'num'], ['offset past number', o, 'num']], say: '位置 ' + o + ' 開始不是數字，轉換失敗：輸出 default（' + v.d + '），而且不會報錯。所以 0 不一定代表真的讀到 0。' };
        return { inmark: rng(o, m[0].length), outs: [['number', parseInt(m[0], 10), 'num'], ['offset past number', o + m[0].length, 'num']], say: '讀到 "' + m[0].trim() + '" 就停，後面的 "' + v.s.slice(o + m[0].length) + '" 不管。' }; },
      notes: ['有小數點的用 Fract/Exp String To Number；十六進位用 Hexadecimal String To Number（PLC 回傳的 "12AB" 就用這個）。', '反方向是 Number To Decimal String；要補零、指定寬度時改用 Format Into String。'] },
    { key: 's2a', name: 'Spreadsheet String To Array', zh: '試算表字串轉陣列', desc: '用分隔符號切欄、用換行切列，變成 2D 陣列。讀 CSV 檔就靠它。',
      ins: [['s', 'spreadsheet string（\\t 是 Tab、\\n 換行）', 'code', '1,2,3\\n4,5,6'], ['dl', 'delimiter', 'sel', ',', [[',', '逗號 ,'], ['\t', 'Tab（預設）'], [' ', '空格'], [';', '分號 ;']]], ['f', 'format', 'sel', '%d', [['%d', '%d 整數'], ['%f', '%f 小數'], ['%s', '%s 字串']]]],
      run: function (v) {
        var rows = v.s.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').map(function (r) { return r.split(v.dl); });
        var w = Math.max.apply(null, rows.map(function (r) { return r.length; })), bad = 0;
        var t = rows.map(function (r) { var o = []; for (var i = 0; i < w; i++) { var c = r[i]; if (v.f === '%s') o.push(c == null ? '' : c); else { var n = v.f === '%d' ? parseInt(c, 10) : parseFloat(c); if (c == null || isNaN(n)) { bad++; n = 0; } o.push(n); } } return o; });
        return { inmark: function (i) { return v.s[i] === v.dl ? 'hit' : v.s[i] === '\n' || v.s[i] === '\r' ? 'new' : ''; }, outs: [['array（' + rows.length + ' 列 × ' + w + ' 欄）', t, 'table']],
          say: (w === 1 && rows[0][0].length > 1 && v.s.length > 3 ? '只切出 1 欄：分隔符號可能選錯了（預設是 Tab，不是逗號）。' : '黃色是分隔符號、綠色是換行。') + (bad ? '有 ' + bad + ' 格轉不成數字或是缺的，變成 0。有文字的資料要用 %s 轉成字串陣列。' : '') };
      },
      notes: ['delimiter 預設是 Tab。讀 CSV 檔要自己接逗號。', '輸出是什麼型別，由 array type 輸入決定：接 2D DBL 常數就輸出 2D DBL；這裡用 format 示意。', '反方向是 Array To Spreadsheet String，預設格式 %.3f。'] }
  ];

  var cur = F[0], vals = {};
  /* 隨機挑戰：每個函式的出題範圍，QOUT 是要回答第幾個輸出 */
  var quiz = { on: false, ok: 0, n: 0, last: null };
  var QOUT = { match: 1 };
  function pick1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  var QGEN = {
    len: function () { return { s: pick1(['PLC ', 'Hello', ' ab c', 'D100=25', 'OK\t', 'a  b']) }; },
    concat: function () { return { a: pick1(['D', 'M', 'X0', 'ab']), b: pick1(['', ' ', '-', '10']), c: pick1(['0', 'ON', ' 5', 'z']) }; },
    subset: function () { return { s: pick1(['00FF12AB3C', 'LabVIEW2018', 'ABCDEFGH', 'T=25.6C']), o: ri(0, 6), n: ri(1, 5) }; },
    replace: function () { return { s: pick1(['Motor=OFF', 'ABCDEF', 'X0=1;X1=0']), sub: pick1(['ON', '', '##', 'z']), o: ri(0, 6), n: ri(0, 3) }; },
    sr: function () { var c = pick1([['a-b-c-d', '-'], ['1,2,3', ','], ['Run run RUN', 'run'], ['x==y==z', '=='], ['a-b-c', ',']]); return { s: c[0], f: c[1], r: pick1([' ', ';', 'go', '']), all: Math.random() < 0.5, ic: Math.random() < 0.3 }; },
    match: function () { return { s: pick1(['Temp: 25.6 C', 'D100=4660', 'abc', 'No.7 and No.12']), p: pick1(['[0-9]+', '[A-Z]+', '[a-z]+']), o: pick1([0, 0, 5]) }; },
    trim: function () { return { s: pick1(['  OK 123 \\r\\n', '\\tA B\\s', 'x\\s\\sy', '\\s\\s7']) }; },
    d2n: function () { return { s: pick1(['120rpm', 'abc', '-7 C', '  42', '3.9V', 'x15']), o: pick1([0, 0, 1]), d: pick1([0, -1]) }; }
  };
  function newQuiz() {
    var g = QGEN[cur.key]; if (!g) { $('qmsg').textContent = '這個函式的輸出是表格，沒有出題。換一個函式。'; return; }
    var v = g(); quiz.on = true;
    cur.ins.forEach(function (d) { var e = $('in_' + d[0]); if (!e || v[d[0]] == null) return; if (d[2] === 'bool') e.checked = v[d[0]]; else e.value = v[d[0]]; });
    $('qans').value = ''; $('qmsg').textContent = '字串答案要一字不差（空格也算）；數字直接打。'; $('qmsg').className = 'why';
    update(); $('qans').focus();
  }
  function checkQuiz() {
    if (!quiz.on) return;
    var x = quiz.last.outs[QOUT[cur.key] || 0], want = x[1], got = $('qans').value, good = x[2] === 'num' ? Number(got) === want && got.trim() !== '' : got === want;
    quiz.n++; if (good) quiz.ok++; quiz.on = false; update();
    $('qmsg').textContent = (good ? '✔ 答對！' : '✖ 你答「' + got + '」，正確是「' + want + '」。看上面黃色、綠色標出來的位置。') + '　答對 ' + quiz.ok + ' / ' + quiz.n;
    $('qmsg').className = 'verdict-line ' + (good ? 'ok' : 'bad');
  }
  function readVals() {
    var v = {};
    cur.ins.forEach(function (d) {
      var e = $('in_' + d[0]);
      if (d[2] === 'num') v[d[0]] = parseInt(e.value, 10) || 0;
      else if (d[2] === 'bool') v[d[0]] = e.checked;
      else if (d[2] === 'code') v[d[0]] = unesc(e.value);
      else v[d[0]] = e.value;
    });
    return v;
  }
  function update() {
    var v = readVals(), r = cur.run(v);
    var src = r.src != null ? r.src : v.s != null ? v.s : (v.a + v.b + v.c);
    strip($('inchars'), cur.key === 'concat' ? v.a + v.b + v.c : src, quiz.on ? null : r.inmark);
    var o = $('outs'); o.innerHTML = '';
    quiz.last = r;
    if (quiz.on) { o.appendChild(el('p', 'why', '（先在下面寫出「' + esc((r.outs[QOUT[cur.key] || 0] || ['?'])[0]) + '」的答案，再對答案）')); $('say').textContent = ''; return; }
    (r.outs || []).forEach(function (x) {
      var row = el('div', 'outrow'); row.appendChild(el('span', 'k', esc(x[0])));
      if (x[2] === 'num') row.appendChild(el('span', 'scalar', String(x[1])));
      else if (x[2] === 'table') { var t = el('table', 't2'); x[1].forEach(function (rr) { var tr = el('tr'); rr.forEach(function (c) { tr.appendChild(el('td', typeof c === 'string' ? 'str' : '', esc(c))); }); t.appendChild(tr); }); row.appendChild(t); }
      else { var c = el('div', 'chars'); c.style.display = 'inline-flex'; c.style.verticalAlign = 'middle'; strip(c, x[1], x[3]); row.appendChild(c); }
      o.appendChild(row);
    });
    $('say').textContent = r.say || '';
  }
  function pickFn(f) {
    cur = f; quiz.on = false; if ($('qmsg')) { $('qmsg').textContent = ''; }
    Array.prototype.forEach.call($('fnlist').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.k === f.key); });
    $('fname').innerHTML = esc(f.name) + ' <small style="font-weight:400;color:var(--mute)">' + f.zh + '</small>';
    $('fdesc').textContent = f.desc;
    var box = $('inputs'); box.innerHTML = ''; var row = el('div', 'row');
    f.ins.forEach(function (d) {
      var lab = el('label', d[2] === 'bool' ? 'check small' : '');
      if (d[2] === 'bool') lab.innerHTML = '<input type="checkbox" id="in_' + d[0] + '"' + (d[3] ? ' checked' : '') + '> ' + esc(d[1]);
      else if (d[2] === 'num') lab.innerHTML = esc(d[1]) + ' <input class="scalar" type="number" id="in_' + d[0] + '" value="' + d[3] + '" style="width:64px">';
      else if (d[2] === 'sel') lab.innerHTML = esc(d[1]) + ' <select id="in_' + d[0] + '">' + d[4].map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === d[3] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
      else lab.innerHTML = esc(d[1]) + ' <input class="str" id="in_' + d[0] + '" value="' + esc(d[3]) + '" style="width:' + Math.max(70, Math.min(260, d[3].length * 12 + 40)) + 'px">';
      row.appendChild(lab);
    });
    box.appendChild(row);
    Array.prototype.forEach.call(box.querySelectorAll('input,select'), function (e) { e.oninput = e.onchange = update; });
    $('notes').innerHTML = '<ul>' + f.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
    update();
  }
  F.forEach(function (f) {
    var b = el('button', '', '<b>' + esc(f.name) + '</b><br><small>' + f.zh + '</small>'); b.type = 'button'; b.dataset.k = f.key;
    b.onclick = function () { pickFn(f); }; $('fnlist').appendChild(b);
  });
  pickFn(F[0]);
  $('qnew').onclick = newQuiz; $('qchk').onclick = checkQuiz;
  $('qans').onkeydown = function (e) { if (e.key === 'Enter') checkQuiz(); };

  /* ---------- 格式碼 ---------- */
  var FRE = /%([-+0 ]*)(\d+)?(?:\.(\d+))?([dfsxXeEgoubi%])/g;
  function pad(s, w, flags, numeric) {
    if (!w || s.length >= w) return s;
    var n = w - s.length;
    if (flags.indexOf('-') >= 0) return s + new Array(n + 1).join(' ');
    if (flags.indexOf('0') >= 0 && numeric) { var sg = /^[-+]/.test(s) ? s[0] : ''; return sg + new Array(n + 1).join('0') + s.slice(sg.length); }
    return new Array(n + 1).join(' ') + s;
  }
  function roundEven(x) { var f = Math.floor(x), d = x - f; if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1; return Math.round(x); }
  function fmtOne(flags, w, p, c, raw) {
    var s, x;
    if (c === 's') { s = String(raw); if (p != null) s = s.slice(0, +p); return { s: pad(s, +w, flags, false) }; }
    x = Number(raw);
    if (raw === '' || isNaN(x)) return { err: '%' + c + ' 需要數字，但接到 "' + raw + '"' };
    if ('diu'.indexOf(c) >= 0) s = String(roundEven(x));
    else if (c === 'x') s = (roundEven(x) >>> 0).toString(16);
    else if (c === 'X') s = (roundEven(x) >>> 0).toString(16).toUpperCase();
    else if (c === 'o') s = (roundEven(x) >>> 0).toString(8);
    else if (c === 'b') s = (roundEven(x) >>> 0).toString(2);
    else if (c === 'f') s = x.toFixed(p != null ? +p : 6);
    else if (c === 'e' || c === 'E') s = x.toExponential(p != null ? +p : 6).replace('e', 'E');
    else s = String(+x.toPrecision(p != null ? Math.max(1, +p) : 6));
    if (flags.indexOf('+') >= 0 && x >= 0 && 'xXob'.indexOf(c) < 0) s = '+' + s;
    return { s: pad(s, +w, flags, true) };
  }
  function format(fmt, args) {
    var segs = [], last = 0, m, k = 0, err = '';
    FRE.lastIndex = 0;
    while ((m = FRE.exec(fmt))) {
      if (m.index > last) segs.push({ lit: fmt.slice(last, m.index) });
      if (m[4] === '%') segs.push({ lit: '%', code: '%%' });
      else if (k >= args.length) { err = '格式碼比輸入多：' + m[0] + ' 沒有東西可以吃。'; segs.push({ code: m[0], out: '', n: k++ }); }
      else { var r = fmtOne(m[1], m[2], m[3], m[4], args[k]); if (r.err) err = r.err; segs.push({ code: m[0], out: r.s || '', n: k++ }); }
      last = FRE.lastIndex;
    }
    if (last < fmt.length) segs.push({ lit: fmt.slice(last) });
    return { segs: segs, used: k, err: err, text: segs.map(function (s) { return s.lit != null ? s.lit : s.out; }).join('') };
  }
  var FPRE = [['溫度：%.1f 度', '25.64', '', ''], ['%d 號站 %s', '3', 'OK', ''], ['[%5d]', '42', '', ''], ['[%-5d]', '42', '', ''], ['[%05d]', '42', '', ''], ['%02X%04X', '5', '4660', ''], ['%.3e', '12345.678', '', ''], ['%s=%d (%.2f%%)', 'RH', '61', '61.257'], ['%d', '2.5', '', '']];
  var CODES = [['%d', '十進位整數（小數會先捨入）'], ['%f', '小數，預設 6 位；%.2f 是 2 位'], ['%e', '科學記號'], ['%x／%X', '十六進位（小寫／大寫）；%02X 補零成 2 位'], ['%s', '字串'], ['%5d', '至少 5 格寬，靠右，左邊補空格'], ['%-5d', '至少 5 格寬，靠左'], ['%05d', '至少 5 格寬，左邊補 0'], ['%%', '印出一個 % 符號']];
  function fUpdate() {
    var raw = [$('fa').value, $('fb').value, $('fc').value]; while (raw.length && raw[raw.length - 1] === '') raw.pop();
    var r = format($('ffmt').value, raw);
    $('fsegs').innerHTML = r.segs.map(function (s) { return s.lit != null && !s.code ? '<span class="seg lit">' + esc(s.lit) + '</span>' : s.code === '%%' ? '<span class="seg lit">%%</span>' : '<span class="seg c' + s.n % 4 + '">' + esc(s.code) + '</span>'; }).join('');
    $('fout').innerHTML = r.segs.map(function (s) { return s.lit != null ? '<span class="seg lit">' + esc(s.lit) + '</span>' : '<span class="seg c' + s.n % 4 + '">' + esc(s.out) + '</span>'; }).join('');
    var say = r.err ? '✖ LabVIEW 會報錯：' + r.err : '結果共 ' + r.text.length + ' 個字元。';
    if (!r.err && r.used < raw.length) say += '有 ' + (raw.length - r.used) + ' 個輸入沒有對應的格式碼，LabVIEW 會報「引數太多」的錯。';
    $('fsay').textContent = say; $('fsay').style.color = r.err ? '#dc2626' : '';
  }
  FPRE.forEach(function (p) {
    var b = el('button', '', esc(p[0])); b.type = 'button';
    b.onclick = function () { $('ffmt').value = p[0]; var a = p.slice(1); $('fa').value = a[0]; $('fb').value = a[1]; $('fc').value = a[2]; fUpdate(); };
    $('fpre').appendChild(b);
  });
  $('fcodes').innerHTML = CODES.map(function (c) { return '<tr><td style="text-align:left">' + esc(c[0]) + '</td><td style="text-align:left;font-family:inherit">' + esc(c[1]) + '</td></tr>'; }).join('');
  ['ffmt', 'fa', 'fb', 'fc'].forEach(function (id) { $(id).oninput = fUpdate; });
  $('ffmt').value = FPRE[0][0]; $('fa').value = FPRE[0][1]; fUpdate();

  function scan(str, fmt) {
    var re = '^', kinds = [], last = 0, m;
    function lit(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'); }
    FRE.lastIndex = 0;
    while ((m = FRE.exec(fmt))) {
      re += lit(fmt.slice(last, m.index));
      var w = m[2] ? '{1,' + m[2] + '}' : '+', c = m[4];
      if (c === '%') re += '%';
      else if ('diu'.indexOf(c) >= 0) { re += '\\s*([-+]?\\d' + w + ')'; kinds.push('d'); }
      else if (c === 'x' || c === 'X') { re += '\\s*([0-9A-Fa-f]' + w + ')'; kinds.push('x'); }
      else if (c === 's') { re += '\\s*(\\S' + w + ')'; kinds.push('s'); }
      else { re += '\\s*([-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?)'; kinds.push('f'); }
      last = FRE.lastIndex;
    }
    re += lit(fmt.slice(last));
    var r = new RegExp(re).exec(str);
    if (!r) return null;
    return { vals: kinds.map(function (k, i) { var t = r[i + 1]; return k === 'd' ? parseInt(t, 10) : k === 'x' ? parseInt(t, 16) : k === 's' ? t : parseFloat(t); }), kinds: kinds, rest: str.slice(r[0].length) };
  }
  function sUpdate() {
    var r = scan($('sin').value, $('sfmt').value);
    if (!r) { $('sout').innerHTML = ''; $('ssay').textContent = '✖ 錯誤 85：字串和格式對不上。檢查固定文字有沒有一字不差，數字的位置有沒有對到格式碼。'; $('ssay').style.color = '#dc2626'; return; }
    $('sout').innerHTML = r.vals.map(function (v, i) { return '<span class="seg c' + i % 4 + '">' + esc(r.kinds[i] === 's' ? '"' + v + '"' : v) + '</span>'; }).join(' ') || '<span class="why">（格式裡沒有 % 碼）</span>';
    $('ssay').textContent = '拿出 ' + r.vals.length + ' 個值。' + (r.rest ? '沒用到的部分 "' + r.rest + '" 會從 remaining string 輸出。' : ''); $('ssay').style.color = '';
  }
  $('sin').oninput = $('sfmt').oninput = sUpdate; sUpdate();

  /* ---------- 顯示模式 ---------- */
  var DPRE = [['Hello\\r\\nWorld', '兩行文字'], ['abc\\s', '尾巴有空格'], ['A\\tB\\tC\\r\\n', '試算表的一列'], ['\\0500FFWR0D010001', 'ENQ 開頭的 PLC 命令'], ['\\0200FF1234\\03', 'STX…ETX 包住的回應'], ['\\06', '只有一個 ACK']];
  function dUpdate() {
    var s = unesc($('din').value);
    strip($('dchars'), s);
    $('dnorm').textContent = s.replace(/\r\n|\r/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '□');
    $('dcode').textContent = toCodes(s);
    var hx = ''; for (var i = 0; i < s.length; i++) hx += ('0' + (s.charCodeAt(i) & 255).toString(16).toUpperCase()).slice(-2) + (i % 2 ? ' ' : '');
    $('dhex').textContent = hx.trim();
    $('dpw').textContent = new Array(s.length + 1).join('*');
    $('dlen').textContent = String(byteLen(s));
    var tip = [];
    if (/\r\n/.test(s)) tip.push('Windows 的換行是兩個字元：CR（\\r，0D）＋ LF（\\n，0A）。Normal 模式只看到「換了一行」，長度卻多 2。');
    if (/ $/.test(s)) tip.push('尾巴的空格在 Normal 模式完全看不到，切到 \'\\\' Codes 才看得見 \\s。兩個字串「看起來一樣卻不相等」多半是這個原因。');
    if (/[\x02\x03\x05\x06\x15]/.test(s)) tip.push('通訊封包裡的控制碼（ENQ=05、STX=02、ETX=03、ACK=06、NAK=15）在 Normal 模式是空白或方塊。除錯通訊時一律切到 Hex 或 \'\\\' Codes 看。常數也一樣：右鍵字串常數 ▸ \'\\\' Codes Display，才能打 \\05。');
    if (/[^\x00-\x7f]/.test(s)) tip.push('含中文時，真正的 LabVIEW 依系統編碼存成 2 個位元組（繁體中文 Windows 是 Big5）。這裡的 Hex 欄只示範 ASCII，中文字只顯示低位元組，僅供參考。');
    if (/\t/.test(s)) tip.push('Tab（\\t，09）是 Spreadsheet String 預設的欄位分隔符號。');
    $('dtip').innerHTML = tip.length ? tip.map(esc).join('<br>') : '試試下面的範例，或自己打 \\r\\n、\\05。';
  }
  DPRE.forEach(function (p) { var b = el('button', '', esc(p[0]) + ' <small style="font-family:inherit">' + p[1] + '</small>'); b.type = 'button'; b.onclick = function () { $('din').value = p[0]; dUpdate(); }; $('dpre').appendChild(b); });
  $('din').value = DPRE[0][0]; $('din').oninput = dUpdate; dUpdate();

  window.StringLab = { F: F, format: format, scan: scan, unesc: unesc, toCodes: toCodes, pick: function (k) { pickFn(F.filter(function (f) { return f.key === k; })[0]); }, show: show };
})();
