/* 檔案 I/O 實驗室：Open/Create/Replace File 的 operation、檔案指標（file mark）、每圈寫一筆 CSV、猜一猜 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function slowF() { return $('slow') && $('slow').checked ? 2.2 : 1; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms * slowF()); }); }
  function roundEven(x) { var f = Math.floor(x), d = x - f; if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1; return Math.round(x); }
  function fly(a, b, text, cls) {
    return new Promise(function (done) {
      if (!a || !b) return done();
      var dur = Math.round(450 * slowF()), r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
      var f = document.createElement('div');
      f.className = 'fly' + (cls ? ' ' + cls : ''); f.textContent = text;
      f.style.cssText = 'left:' + r1.left + 'px;top:' + r1.top + 'px;min-width:' + Math.min(r1.width, 160) + 'px;height:' + Math.min(r1.height, 34) + 'px;transition-duration:' + dur + 'ms';
      $('layer').appendChild(f);
      setTimeout(function () { f.style.left = r2.left + 'px'; f.style.top = r2.top + 'px'; f.style.minWidth = Math.min(r2.width, 160) + 'px'; f.style.height = Math.min(r2.height, 34) + 'px'; }, 30);
      setTimeout(function () { f.remove(); done(); }, dur + 60);
    });
  }
  /* 顯示用：把 \r\n、\t 標出來 */
  function shown(t) { return esc(t).replace(/\t/g, '<span class="ws">→</span>').replace(/\r\n/g, '<span class="ws">↵</span>\n'); }

  /* ---------- 分頁 ---------- */
  var TABS = ['open', 'mark', 'csv'];
  function show(t) {
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    TABS.forEach(function (k) { $('t-' + k).hidden = k !== t; });
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  if (/^#(open|mark|csv)$/.test(location.hash)) show(location.hash.slice(1));

  /* =====================================================================
     1. 開檔方式
     ===================================================================== */
  var OPS = ['open', 'replace', 'create', 'open or create', 'replace or create', 'replace or create with confirmation'];
  var OLD = '時間,D0,D1\r\n09:00:01,100,25.0\r\n09:00:02,101,25.1\r\n';
  /* 回傳 {kind:'open'|'truncate'|'create'|'confirm'|'error', code, keep} */
  function openResult(op, exists) {
    var name = typeof op === 'number' ? OPS[op] : op;
    switch (name) {
      case 'open': return exists ? { kind: 'open' } : { kind: 'error', code: 7 };
      case 'replace': return exists ? { kind: 'truncate' } : { kind: 'error', code: 7 };
      case 'create': return exists ? { kind: 'error', code: 10 } : { kind: 'create' };
      case 'open or create': return exists ? { kind: 'open' } : { kind: 'create' };
      case 'replace or create': return exists ? { kind: 'truncate' } : { kind: 'create' };
      default: return exists ? { kind: 'confirm' } : { kind: 'create' };
    }
  }
  var RTEXT = { open: '打開，內容保留', truncate: '清空', create: '建立新檔', confirm: '問要不要取代', error: '' };
  var O = { tried: {}, busy: false };
  $('oop').innerHTML = OPS.map(function (o, i) { return '<option value="' + i + '"' + (i === 4 ? ' selected' : '') + '>' + i + '：' + o + '</option>'; }).join('');
  function drawFile(exists) {
    var f = $('ofile'); f.className = 'fic' + (exists ? '' : ' none');
    $('ofpre').innerHTML = exists ? shown(OLD) : '（沒有這個檔案）';
  }
  function cellText(r) { return r.kind === 'error' ? '錯誤 ' + r.code : RTEXT[r.kind]; }
  function drawMx(cur) {
    var h = '<tr><th>operation</th><th>檔案已存在</th><th>檔案不存在</th></tr>';
    OPS.forEach(function (o, i) {
      h += '<tr><th style="text-align:left">' + i + '：' + o + '</th>';
      [true, false].forEach(function (ex) {
        var key = i + ':' + ex, r = openResult(i, ex), t = O.tried[key];
        h += '<td class="' + (t ? (r.kind === 'error' ? 'e' : 'k') : '') + (cur === key ? ' cur' : '') + '">' + (t ? cellText(r) : '?') + '</td>';
      });
      h += '</tr>';
    });
    $('omx').innerHTML = h;
  }
  function resBox(html) { $('ores').innerHTML = html; }
  function okRes(kind) {
    return '<div><span class="refw" id="oref"></span> refnum out（可以拿去寫）</div><div style="margin-top:6px"><span class="ew"></span> error out：<b style="color:#15803d">沒有錯誤</b></div><p class="why">' +
      { open: '檔案打開了，舊資料都在，寫入位置在<b>開頭</b>。直接寫會蓋掉前面的字（第 2 分頁看指標）。', truncate: '檔案被清成 0 個位元組，舊資料不見了。', create: '建立了一個空的新檔。' }[kind] + '</p>';
  }
  function errRes(code, why) {
    return '<div><span class="refw dead"></span> refnum out：<b>無效</b>（後面的 Write 收到錯誤就不做）</div><div style="margin-top:6px"><span class="ew"></span> error out：<span class="codebig" style="color:#dc2626">' + code + '</span></div><p class="why">' + why + '</p>';
  }
  function askDialog(title, msg, okLabel) {
    return new Promise(function (done) {
      $('odialog').innerHTML = '<div class="dlg" role="dialog" aria-label="' + esc(title) + '"><div class="dt">' + esc(title) + '（示意）</div><div class="db">' + msg + '<div class="row" style="justify-content:flex-end"><button type="button" id="dok">' + okLabel + '</button><button type="button" id="dno">取消</button></div></div></div>';
      $('dok').onclick = function () { $('odialog').innerHTML = ''; done(true); };
      $('dno').onclick = function () { $('odialog').innerHTML = ''; done(false); };
    });
  }
  async function runOpen(auto) {
    if (O.busy) return; O.busy = true;
    try {
      var op = +$('oop').value, ex = $('oex').checked, key = op + ':' + ex, f = $('ofile');
      drawFile(ex); resBox('<p class="why">執行中…</p>'); $('onode').classList.remove('bad');
      if ($('odlg').checked && !auto) {
        var go = await askDialog('選擇檔案', '路徑沒有給，Open/Create/Replace File 跳出檔案對話框，問要開哪個檔。', '確定（選 log.csv）');
        if (!go) { resBox(errRes(43, '使用者在檔案對話框按了取消：canceled 輸出是 True，error out 是 43。這不是「壞掉」，取消時就不要往下寫。')); f.classList.add('bad'); return; }
      }
      await sleep(350);
      var r = openResult(op, ex);
      O.tried[key] = 1; drawMx(key);
      if (r.kind === 'confirm') {
        var yes = auto ? true : await askDialog('取代檔案？', 'log.csv 已經存在，要取代嗎？', '取代');
        if (!yes) { resBox('<p>按了<b>取消</b>：檔案保持原樣，沒有被清空。</p><p class="why">程式要自己檢查 error out 再決定要不要往下寫。</p>'); return; }
        r = { kind: 'truncate' };
      }
      if (r.kind === 'error') {
        f.classList.add('bad');
        resBox(errRes(r.code, r.code === 7 ? '找不到檔案：這個 operation 不會幫你建檔。' : 'create 只建新檔，檔案已經在了就不做，回報錯誤 10（重複路徑）。錯誤 8 是另一回事：沒有權限，或檔案正被別的程式（例如 Excel）占用。'));
        return;
      }
      if (r.kind === 'truncate') { f.classList.add('wipe'); await sleep(450); $('ofpre').textContent = '（0 個位元組）'; f.classList.remove('wipe'); }
      if (r.kind === 'create') { f.className = 'fic pop'; $('ofpre').textContent = '（0 個位元組）'; await sleep(450); }
      resBox(okRes(r.kind));
    } finally { O.busy = false; }
  }
  $('orun').onclick = function () { runOpen(false); };
  $('oall').onclick = function () { OPS.forEach(function (_, i) { O.tried[i + ':true'] = 1; O.tried[i + ':false'] = 1; }); drawMx(); };
  $('oclr').onclick = function () { O.tried = {}; drawMx(); };
  $('oex').onchange = function () { drawFile(this.checked); resBox(''); };
  drawFile(true); drawMx();

  /* =====================================================================
     2. 檔案指標
     ===================================================================== */
  var INIT = '100,25.0\r\n101,25.1\r\n';
  var M = { data: INIT.split(''), open: false, mark: 0, busy: false };
  /* 純函式：在 mark 寫 text，回傳 {data, mark, over}（over＝蓋掉幾個字元） */
  function writeAt(data, mark, text) {
    var d = data.slice(), over = 0;
    text.split('').forEach(function (c, i) { var k = mark + i; if (k < d.length) { d[k] = c; over++; } else d.push(c); });
    return { data: d, mark: mark + text.length, over: over };
  }
  function unescapeCodes(s) { return s.replace(/\\r/g, '\r').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\'); }
  function chLabel(c) { return c === '\r' ? 'CR' : c === '\n' ? 'LF' : c === '\t' ? 'TAB' : c === ' ' ? '␠' : c; }
  function chCell(c) { var e = document.createElement('span'); e.className = 'ch' + (c.length && /[\r\n\t]/.test(c) ? ' cc' : ''); e.textContent = chLabel(c); return e; }
  function drawGrid() {
    var g = $('mgrid'); g.innerHTML = '';
    M.data.forEach(function (c) { g.appendChild(chCell(c)); });
    var eof = document.createElement('span'); eof.className = 'ch eof'; eof.textContent = 'EOF'; g.appendChild(eof);
    var mk = document.createElement('span'); mk.className = 'mk'; mk.id = 'mk'; g.appendChild(mk);
    placeMark(); drawState();
  }
  function placeMark() {
    var g = $('mgrid'), mk = $('mk'); if (!mk) return;
    var cells = g.querySelectorAll('.ch'), c = cells[Math.min(M.mark, cells.length - 1)];
    mk.style.display = M.open ? '' : 'none';
    if (c) { mk.style.left = c.offsetLeft + 'px'; mk.style.top = (c.offsetTop - 19) + 'px'; }
  }
  function drawState() {
    $('mstate').innerHTML = (M.open ? '檔案<b>開著</b>，寫入位置 = ' + M.mark : '檔案<b>關著</b>（沒有 refnum）') + '；檔案大小 ' + M.data.length + ' 個位元組。內容：<code>' + shown(M.data.join('')).replace(/\n/g, '') + '</code>';
  }
  function logM(s) { var d = document.createElement('div'); d.innerHTML = s; $('mlog').appendChild(d); $('mlog').scrollTop = 1e6; }
  function sayM(t, cls) { $('msay').className = 'verdict-line' + (cls ? ' ' + cls : ''); $('msay').textContent = t; }
  $('mopen').onclick = async function () {
    if (M.busy) return;
    if (M.open) { sayM('已經開著了。這個示範一次只開一個 refnum，先按 Close File。', 'bad'); return; }
    M.busy = true;
    try {
      var op = +$('mop').value; M.open = true; M.mark = 0;
      if (op === 4 && M.data.length) {
        Array.prototype.forEach.call($('mgrid').querySelectorAll('.ch:not(.eof)'), function (c) { c.classList.add('over'); c.style.opacity = '.2'; });
        await sleep(450); M.data = []; logM('<b>Open（replace or create）</b>：檔案清空，位置 = 0');
        sayM('replace or create：舊內容全部清掉，從 0 個位元組開始。');
      } else { logM('<b>Open（open or create）</b>：內容保留，位置 = 0（在最前面）'); sayM('open or create：舊內容還在，但寫入位置在最前面。現在直接 Write 會蓋掉第一行。'); }
      drawGrid();
    } finally { M.busy = false; }
  };
  function setPos(end) {
    if (M.busy) return;
    if (!M.open) { sayM('檔案沒開，沒有 refnum 可以設定位置（實際執行會回報錯誤）。', 'bad'); return; }
    M.mark = end ? M.data.length : 0; placeMark(); drawState();
    logM('<b>Set File Position</b>（from = ' + (end ? 'end' : 'start') + '，offset 0）：位置 = ' + M.mark);
    sayM(end ? '位置移到檔案最後面。現在 Write 會接在後面，這才是「往後加」。' : '位置回到最前面。');
  }
  $('mend').onclick = function () { setPos(true); };
  $('mstart').onclick = function () { setPos(false); };
  $('mwrite').onclick = async function () {
    if (M.busy) return;
    if (!M.open) { sayM('檔案沒開，Write to Text File 沒有 refnum 可以寫（實際執行會回報錯誤）。', 'bad'); return; }
    var text = unescapeCodes($('mtext').value); if (!text) return;
    M.busy = true;
    try {
      var g = $('mgrid'), eof = g.querySelector('.eof'), start = M.mark, over = 0;
      for (var i = 0; i < text.length; i++) {
        var c = text[i], k = M.mark, cells = g.querySelectorAll('.ch:not(.eof)'), cell, isOver = k < M.data.length;
        if (k < M.data.length) { cell = cells[k]; over++; }
        else { cell = chCell(''); cell.textContent = ''; g.insertBefore(cell, eof); M.data.push(''); }
        await fly($('mtext'), cell, chLabel(c), isOver ? '' : 'new');
        var was = M.data[k];
        M.data[k] = c; cell.textContent = chLabel(c); cell.className = 'ch' + (/[\r\n\t]/.test(c) ? ' cc' : '') + (was ? ' over' : ' nw');
        M.mark++; placeMark();
      }
      drawState();
      logM('<b>Write to Text File</b>「' + shown(text).replace(/\n/g, '') + '」：寫了 ' + text.length + ' 個位元組，位置 ' + start + ' → ' + M.mark + (over ? '，<span style="color:#dc2626">蓋掉 ' + over + ' 個舊字元</span>' : ''));
      sayM(over ? '蓋掉了 ' + over + ' 個舊字元（紅底）！檔案沒有變長多少，舊資料被新資料覆蓋。' : '全部接在後面（綠底），舊資料都還在。', over ? 'bad' : 'ok');
    } finally { M.busy = false; }
  };
  $('mclose').onclick = function () {
    if (M.busy) return;
    if (!M.open) { sayM('本來就關著。'); return; }
    M.open = false; placeMark(); drawState(); logM('<b>Close File</b>：refnum 釋放，檔案大小 ' + M.data.length); sayM('關檔了。下次 Open，寫入位置又會回到 0。');
  };
  $('mreset').onclick = function () { if (M.busy) return; M.data = INIT.split(''); M.open = false; M.mark = 0; $('mlog').innerHTML = ''; sayM(''); drawGrid(); };
  window.addEventListener('resize', placeMark);
  drawGrid();

  /* 開關檔次數比較（時間長度是示意單位） */
  var COST = { o: 6, w: 1, c: 4 }, P = { busy: false };
  function perfCount(n, eachLoop) { return eachLoop ? { o: n, w: n, c: n, t: n * (COST.o + COST.w + COST.c) } : { o: 1, w: n, c: 1, t: COST.o + n * COST.w + COST.c }; }
  $('prun').onclick = async function () {
    if (P.busy) return; P.busy = true;
    try {
      var N = 20, A = { o: 0, w: 0, c: 0, t: 0 }, Bc = { o: 0, w: 0, c: 0, t: 0 };
      ['pa', 'pb'].forEach(function (p) { ['o', 'w', 'c', 't'].forEach(function (k) { $(p + '-' + k).textContent = '0'; }); $(p + '-tl').innerHTML = ''; });
      $('psay').textContent = '';
      function seg(p, S, k) { S[k]++; S.t += COST[k]; $(p + '-' + k).textContent = S[k]; $(p + '-t').textContent = S.t; var i = document.createElement('i'); i.className = k; i.style.width = (COST[k] * 4) + 'px'; $(p + '-tl').appendChild(i); }
      seg('pb', Bc, 'o');
      for (var i = 0; i < N; i++) {
        seg('pa', A, 'o'); seg('pa', A, 'w'); seg('pa', A, 'c');
        seg('pb', Bc, 'w');
        await sleep(110);
      }
      seg('pb', Bc, 'c');
      $('psay').className = 'verdict-line ok';
      $('psay').textContent = '同樣 20 筆：左邊開關檔各 20 次，右邊各 1 次。量測迴圈要固定週期時，用右邊的架構。';
    } finally { P.busy = false; }
  };

  /* =====================================================================
     3. 寫 CSV 紀錄
     ===================================================================== */
  var C = { file: '', n: 0, busy: false };
  function fmtNum(spec, v) {
    if (spec === '%d') return String(roundEven(v));
    var p = +spec.replace(/[^0-9]/g, ''); return v.toFixed(p);
  }
  function hms(n) { var s = 9 * 3600 + n; function z(x) { return (x < 10 ? '0' : '') + x; } return z(Math.floor(s / 3600)) + ':' + z(Math.floor(s / 60) % 60) + ':' + z(s % 60); }
  function eolStr(e) { return e === 'crlf' ? '\r\n' : e === 'lit' ? '\\r\\n' : ''; }
  /* 純函式：opt = {way, del, fmt, eol}，r = {n, d0, d1raw}。回傳這一圈寫進檔案的字串 */
  function buildLine(opt, r) {
    var t = r.d1raw / 10;
    if (opt.way === 'a2s') return [r.n, r.d0, t].map(function (v) { return fmtNum(opt.fmt, v); }).join(opt.del) + '\r\n';
    return hms(r.n) + opt.del + r.d0 + opt.del + fmtNum(opt.fmt, t) + eolStr(opt.eol);
  }
  function headerLine(opt) { return (opt.way === 'a2s' ? ['秒', 'D0', 'D1'] : ['時間', 'D0', 'D1']).join(opt.del) + (opt.way === 'a2s' ? '\r\n' : eolStr(opt.eol)); }
  /* Excel 打開 .csv：用 \r\n（或 \n）分列、用逗號分欄（台灣地區設定） */
  function excelParse(text) {
    var rows = text.split(/\r?\n/);
    if (rows.length && rows[rows.length - 1] === '') rows.pop();
    return rows.map(function (r) { return r.split(','); });
  }
  function opt() { return { way: $('cway').value, del: $('cdel').value === '\\t' ? '\t' : $('cdel').value, fmt: $('cfmt').value, eol: $('ceol').value }; }
  function fmtLine() {
    var o = opt(), d = o.del === '\t' ? '\\t' : o.del;
    $('ceol').disabled = o.way === 'a2s';
    $('cfmtline').innerHTML = o.way === 'fis'
      ? 'Format Into String 的 format string：<code>%s' + esc(d) + '%d' + esc(d) + esc(o.fmt) + (o.eol === 'crlf' ? '\\r\\n' : '') + '</code>' + (o.eol === 'crlf' ? '（format string 本身就認得 \\r、\\n 這類反斜線碼）' : o.eol === 'lit' ? '，再用 Concatenate Strings 接一個字串常數 <code>\\r\\n</code>：常數沒切 \'\\\' Codes Display，反斜線就是普通字元，變成 4 個字' : '') + '，input 1 = 時間字串（Format Date/Time String）、input 2 = D0、input 3 = D1 ÷ 10'
      : 'Array To Spreadsheet String：array = [秒數, D0, D1 ÷ 10]（1D 當成一列），format string = <code>' + esc(o.fmt) + '</code>（<b>每一欄共用</b>），delimiter = <code>' + esc(d) + '</code>。每一列最後它會自己加換行（Windows 上是 \\r\\n），所以「行尾」選項用不到。';
  }
  function drawCsv() {
    $('cfile').innerHTML = C.file ? shown(C.file) : '<span class="why">（空的）</span>';
    var rows = excelParse(C.file), cols = Math.max(3, rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0));
    var h = '<table class="xl"><tr><th></th>';
    for (var j = 0; j < Math.min(cols, 12); j++) h += '<th>' + String.fromCharCode(65 + j) + '</th>';
    h += '</tr>';
    rows.slice(0, 12).forEach(function (r, i) {
      h += '<tr><th>' + (i + 1) + '</th>';
      for (var j = 0; j < Math.min(cols, 12); j++) {
        var v = r[j] == null ? '' : r[j], num = /^-?\d+(\.\d+)?$/.test(v), tm = /^\d\d:\d\d:\d\d$/.test(v);
        h += '<td class="' + (num || tm ? 'n' : '') + '">' + esc(num ? String(Number(v)) : v.replace(/\t/g, ' ')) + '</td>';
      }
      h += '</tr>';
    });
    if (!rows.length) h += '<tr><th>1</th><td></td><td></td><td></td></tr>';
    $('cxl').innerHTML = h + '</table>';
  }
  function csvVerdict() {
    var o = opt(), msg = [], bad = false, rows = excelParse(C.file);
    if (!C.n) { $('csay').textContent = ''; return; }
    if (o.del !== ',') { msg.push('分隔不是逗號：Excel 打開 .csv 時整行擠在 A 欄。'); bad = true; }
    if (o.way === 'fis' && o.eol !== 'crlf') { msg.push(o.eol === 'none' ? '沒有換行：所有紀錄接成一長行，前一筆的溫度和下一筆的時間黏在一起。' : '\\r\\n 被寫成 4 個普通字元：看起來有，其實沒換行。'); bad = true; }
    if (o.fmt === '%d') { msg.push('溫度用 %d：小數被捨入掉了（25.5 → 26、24.5 → 24，剛好一半取偶數）。'); bad = true; }
    if (o.way === 'a2s' && o.fmt !== '%d') msg.push('Array To Spreadsheet String 的格式整列共用，D0 也變成 ' + fmtNum(o.fmt, 100) + ' 這種寫法；Excel 會顯示成 100，但檔案比較大。');
    if (o.fmt === '%.3f' && o.way === 'fis') msg.push('%.3f 多寫了兩個沒有意義的 0：D1 本來只有 0.1 的解析度。');
    if (!bad) msg.unshift('Excel 分成 ' + (rows[0] ? rows[0].length : 3) + ' 欄、' + rows.length + ' 列，正確。');
    $('csay').className = 'verdict-line ' + (bad ? 'bad' : 'ok'); $('csay').textContent = msg.join(' ');
  }
  function plcRead(n) { return { n: n, d0: 100 + n * rint(1, 3), d1raw: 245 + rint(0, 12) }; }
  async function oneLoop() {
    var o = opt();
    if (!C.n && !C.file && $('chead').checked) { C.file += headerLine(o); drawCsv(); }
    C.n++;
    var r = plcRead(C.n), line = buildLine(o, r);
    $('cplc').innerHTML = '<span>第 ' + C.n + ' 圈</span><span id="cp0">D0 = ' + r.d0 + '</span><span id="cp1">D1 = ' + r.d1raw + '</span>';
    $('cline').innerHTML = '';
    await Promise.all([fly($('cp0'), $('cline'), String(r.d0)), fly($('cp1'), $('cline'), String(r.d1raw))]);
    $('cline').innerHTML = shown(line).replace(/\n/g, '');
    await sleep(200);
    await fly($('cline'), $('cfile'), line.replace(/\r\n/g, '↵').replace(/\t/g, '→'), 'new');
    C.file += line; drawCsv(); $('cfile').scrollTop = 1e6;
  }
  $('cstep').onclick = async function () { if (C.busy) return; C.busy = true; try { await oneLoop(); csvVerdict(); } finally { C.busy = false; } };
  $('crun').onclick = async function () { if (C.busy) return; C.busy = true; try { for (var i = 0; i < 6; i++) await oneLoop(); csvVerdict(); } finally { C.busy = false; } };
  $('cnew').onclick = function () { if (C.busy) return; C.file = ''; C.n = 0; $('cline').innerHTML = ''; $('cplc').innerHTML = ''; drawCsv(); csvVerdict(); };
  ['cway', 'cdel', 'cfmt', 'ceol'].forEach(function (id) { $(id).onchange = function () { fmtLine(); if ((C.n || C.file) && !C.busy) { C.file = ''; C.n = 0; drawCsv(); $('csay').className = 'verdict-line'; $('csay').textContent = '設定改了，檔案清空重來（等於 replace or create）。'; } }; });
  fmtLine(); drawCsv();

  /* =====================================================================
     4. 猜一猜
     ===================================================================== */
  function opAnswer(i, ex) { var r = openResult(i, ex); return r.kind === 'error' ? '錯誤 ' + r.code : { open: '打開，內容保留', truncate: '清空後打開', create: '建立新的空檔', confirm: '跳出對話框問要不要取代' }[r.kind]; }
  var ALLOP = ['打開，內容保留', '清空後打開', '建立新的空檔', '跳出對話框問要不要取代', '錯誤 7', '錯誤 10'];
  function letters(n) { var s = ''; for (var i = 0; i < n; i++) s += String.fromCharCode(65 + rint(0, 25)); return s; }
  var GENS = [
    function () {
      var i = rint(0, 5), ex = Math.random() < .5, ans = opAnswer(i, ex);
      return { q: 'Open/Create/Replace File 的 operation = <b>' + OPS[i] + '</b>，檔案' + (ex ? '<b>已經存在</b>' : '<b>不存在</b>') + '，結果是？', ans: ans, wrong: ALLOP.filter(function (x) { return x !== ans; }),
        ex: '有 create 的沒檔就建，有 replace 的有檔就清空；單獨的 open／replace 沒檔是錯誤 7，單獨的 create 有檔是錯誤 10。' };
    },
    function () {
      return { q: 'file path 沒接，執行時跳出檔案對話框，使用者按了<b>取消</b>。error out 是？', ans: '錯誤 43', wrong: ['錯誤 7', '錯誤 8', '沒有錯誤，refnum 指向空檔', '錯誤 1430'], ex: '43 表示使用者取消了操作。用 canceled 輸出或錯誤碼判斷，取消時不要往下寫。' };
    },
    function () {
      var old = letters(6), w = letters(rint(2, 3)), ans = w + old.slice(w.length);
      return { q: '檔案內容是 <code>' + old + '</code>。用 <b>open or create</b> 打開，直接 Write to Text File 寫 <code>' + w + '</code> 再關檔。檔案變成？', ans: ans, wrong: [old + w, w, w + old, old], ex: '開檔時寫入位置在 0，寫進去的字會蓋掉前面同樣長度的舊字，後面的舊字還在。' };
    },
    function () {
      var old = letters(5), w = letters(2), ans = old + w;
      return { q: '檔案內容是 <code>' + old + '</code>。open or create 打開 → <b>Set File Position（from = end）</b> → 寫 <code>' + w + '</code> → 關檔。檔案變成？', ans: ans, wrong: [w + old.slice(2), w, w + old, old], ex: '先把位置移到最後，新的字就接在後面，這才是往後加。' };
    },
    function () {
      var old = letters(6), a = letters(2), b = letters(2), ans = a + b + old.slice(4);
      return { q: '檔案內容是 <code>' + old + '</code>。open or create 打開後，<b>連續寫兩次</b>：先寫 <code>' + a + '</code>，再寫 <code>' + b + '</code>（中間沒有關檔）。檔案變成？', ans: ans, wrong: [b + old.slice(2), a + old.slice(2), old + a + b, a + b], ex: '每次寫完位置就往後移。第二次從第 2 格接著寫，所以 ' + a + ' 後面接 ' + b + '，最後兩個舊字還在。' };
    },
    function () {
      var old = letters(6), w = letters(3);
      return { q: '檔案內容是 <code>' + old + '</code>。用 <b>replace or create</b> 打開，寫 <code>' + w + '</code>。檔案變成？', ans: w, wrong: [w + old.slice(3), old + w, w + old, '錯誤 8'], ex: 'replace 會先把檔案清空，所以只剩新寫的字。' };
    },
    function () {
      var n = pickOne([10, 50, 100, 600]), each = Math.random() < .6, c = perfCount(n, each);
      var ans = String(c.o) + ' 次', pool = [n, 1, 2, n * 2, n + 1].filter(function (x) { return x !== c.o; }).map(function (x) { return x + ' 次'; });
      return { q: '迴圈跑 ' + n + ' 圈，每圈寫一行。' + (each ? '<b>Open、Write、Close 都放在迴圈裡</b>' : '<b>Open 放在迴圈外（左邊）、Write 在迴圈裡、Close 在迴圈外（右邊）</b>') + '。Open/Create/Replace File 一共執行幾次？', ans: ans, wrong: pool,
        ex: each ? '放在迴圈裡就每圈都開一次。開、關檔比寫一行慢得多，量測迴圈要把它們搬到迴圈外。' : '迴圈外的節點只執行一次，迴圈裡只剩寫入。' };
    },
    function () {
      var d = pickOne(['不接（預設是 Tab）', '接分號 ;']);
      return { q: 'Array To Spreadsheet String 的 delimiter ' + d + '，存成 log.csv，用 Excel（台灣地區設定）打開會？', ans: '每一行都擠在 A 欄', wrong: ['自動分成 3 欄', '打不開，顯示格式錯誤', '只顯示第一行', '數字全部變成 0'], ex: 'CSV 是逗號分隔，Excel 照地區設定的清單分隔（台灣是逗號）分欄。分隔用別的符號，整行就是一格。' };
    },
    function () {
      return { q: 'Format Into String 的 format string 是 <code>%s,%d,%.1f</code>（最後<b>沒有 \\r\\n</b>），每圈寫一行，記了 3 圈。檔案會？', ans: '3 筆接成同一行，前一筆的溫度黏著下一筆的時間', wrong: ['正常 3 行', 'Write to Text File 自己會補換行', '只留下最後一筆', '錯誤 83'], ex: 'Write to Text File 寫什麼就是什麼，不會自己補換行。每行結尾要自己加 \\r\\n。' };
    },
    function () {
      return { q: 'format string 是 <code>%s,%d,%.1f</code>，結尾再用 Concatenate Strings 接一個字串常數，常數裡打了 <code>\\r\\n</code>，但<b>沒有切 \'\\\' Codes Display</b>。檔案每一行結尾會？', ans: '多出 \\ r \\ n 四個普通字元，而且沒有換行', wrong: ['正常換行', '只換行不回車', '錯誤，不能執行', '自動變成 Tab'], ex: '一般字串常數沒切 \'\\\' Codes Display 時，反斜線就是普通字元；切了之後 \\r\\n 才代表 CR、LF 兩個位元組。format string 不一樣：它本身就認得 \\r、\\n，所以直接寫在 format string 裡最省事。' };
    },
    function () {
      var v = pickOne([24.5, 25.5, 26.5, 23.5]), ans = String(roundEven(v)), lo = Math.floor(v), hi = Math.ceil(v);
      return { q: '溫度 ' + v + ' 用 <code>%d</code> 寫進檔案，寫出的是？', ans: ans, wrong: [String(ans === String(lo) ? hi : lo), String(v), v.toFixed(0) === ans ? String(lo - 1) : v.toFixed(0), String(v) + '0'], ex: 'LabVIEW 遇到剛好一半取偶數（24.5 → 24、25.5 → 26）。要保留小數用 %.1f。' };
    }
  ];
  function gen() { return pickOne(GENS)(); }

  window.FileLab = {
    OPS: OPS, openResult: openResult, writeAt: writeAt, buildLine: buildLine, headerLine: headerLine, excelParse: excelParse, perfCount: perfCount, roundEven: roundEven,
    state: { open: O, mark: M, csv: C }, show: show, runOpen: runOpen, GENS: GENS, gen: gen,
    quiz: window.LabQuiz ? window.LabQuiz('fquiz', gen) : null
  };
})();
