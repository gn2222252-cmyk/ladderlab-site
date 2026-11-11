/* 除錯實驗室：Error List、Probe／Breakpoint／單步、迴圈除錯 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function log(id, s) { var l = $(id); l.insertBefore(el('div', '', s), l.firstChild); }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function nd(pre, id, x, y, w, h, cls, lines) {
    var t = (Array.isArray(lines) ? lines : [lines]), s = '<g class="nd ' + cls + '" id="' + pre + id + '" data-n="' + id + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4"/>';
    t.forEach(function (ln, i) { s += '<text x="' + (x + w / 2) + '" y="' + (y + h / 2 + 5 + (i - (t.length - 1) / 2) * 16) + '" text-anchor="middle">' + ln + '</text>'; });
    return s + '</g>';
  }
  function wire(d, cls) { return '<path class="w ' + (cls || '') + '" d="' + d + '"/>'; }
  function xmark(x, y) { return '<path class="xmark" d="M' + (x - 7) + ' ' + (y - 7) + ' L' + (x + 7) + ' ' + (y + 7) + ' M' + (x + 7) + ' ' + (y - 7) + ' L' + (x - 7) + ' ' + (y + 7) + '"/>'; }
  function arrowSVG(ok) {
    return ok ? '<svg viewBox="0 0 34 26"><path d="M2 4 L28 13 L2 22 Z" fill="#fff" stroke="#111" stroke-width="2"/></svg>可以執行'
      : '<svg viewBox="0 0 34 26"><path d="M2 4 L14 8 L11 13 L14 18 L2 22 Z M18 9 L28 13 L18 17 L21 13 Z" fill="#9ca3af" stroke="#111" stroke-width="2"/></svg><span style="color:#dc2626">執行箭頭斷了（點我）</span>';
  }

  var tabs = $('tabs');
  function stopAll() { pStopTimer(); lStopTimer(); }
  function show(t) {
    stopAll();
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['err', 'probe', 'loop'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* ================= 1. 斷掉的箭頭與 Error List ================= */
  var ESC = [
    { name: '① 字串接到 Add', bad: function () {
        return nd('e-', 'str', 20, 40, 70, 30, 'ter str', '"100"') + nd('e-', 'off', 20, 120, 70, 30, 'ter', '偏移') + nd('e-', 'add', 230, 70, 46, 50, 'fn', '+') + nd('e-', 'ind', 400, 80, 90, 30, 'ter', '位置') +
          wire('M90 55 H160 V85 H230', 'broken') + xmark(160, 70) + wire('M90 135 H160 V105 H230') + wire('M276 95 H400') + '<text x="20" y="190" style="font-size:12px">「100」是字串常數（粉紅色線）</text>';
      }, good: function () {
        return nd('e-', 'str', 20, 40, 70, 30, 'ter str', '"100"') + nd('e-', 'cv', 110, 36, 96, 38, 'fn', ['Dec Str', 'To Num']) + nd('e-', 'off', 20, 120, 70, 30, 'ter', '偏移') + nd('e-', 'add', 230, 70, 46, 50, 'fn', '+') + nd('e-', 'ind', 400, 80, 90, 30, 'ter', '位置') +
          wire('M90 55 H110', 'str') + wire('M206 55 H215 V85 H230', 'i32') + wire('M90 135 H160 V105 H230') + wire('M276 95 H400');
      },
      errs: [{ n: 'str', msg: '線：連接的兩端型別不相容（字串 → 數值）', why: 'Add 只能加數值。字串 "100" 要先經過字串轉數字的函式（例如 Decimal String To Number）。' }],
      fix: '中間加一個字串轉數字的函式，線就接得起來了。' },
    { name: '② Required 的輸入沒接', bad: function () {
        return nd('e-', 'd', 20, 105, 60, 28, 'ter', '300') + nd('e-', 'rd', 200, 50, 120, 90, 'sub', ['FX_ReadD', '.vi']) + nd('e-', 'ind', 420, 80, 100, 30, 'ter', '讀到的值') +
          '<path class="w" style="stroke:#7c3aed" d="M186 70 H200"/><text x="182" y="66" text-anchor="end" style="font-size:12px;font-weight:700">VISA resource（Required）</text>' +
          wire('M80 119 H200', 'i32') + wire('M320 95 H420', 'i32');
      }, good: function () {
        return nd('e-', 'visa', 20, 52, 110, 30, 'ter', 'COM1') + nd('e-', 'd', 20, 105, 60, 28, 'ter', '300') + nd('e-', 'rd', 200, 50, 120, 90, 'sub', ['FX_ReadD', '.vi']) + nd('e-', 'ind', 420, 80, 100, 30, 'ter', '讀到的值') +
          '<path class="w" style="stroke:#7c3aed;stroke-width:4" d="M130 67 H165 V70 H200"/>' + wire('M80 119 H200', 'i32') + wire('M320 95 H420', 'i32');
      },
      errs: [{ n: 'rd', msg: 'FX_ReadD.vi：必要的輸入「VISA resource name」沒有接線', why: '這個端子在 SubVI 裡設成 Required，呼叫端一定要接。Context Help 裡它會是粗體字。' }],
      fix: '接上 VISA resource name 的控制元件（或從前一個 VI 的 VISA resource name out 接過來）。' },
    { name: '③ 兩個輸出接到同一個顯示', bad: function () {
        return nd('e-', 'p', 20, 80, 60, 30, 'ter', '脈波') + nd('e-', 'm1', 200, 30, 46, 50, 'fn', '×') + nd('e-', 'm2', 200, 120, 46, 50, 'fn', '×') + nd('e-', 'ind', 420, 80, 100, 30, 'ter', 'X 位置') +
          wire('M80 95 H140 V45 H200') + wire('M140 95 V135 H200') + wire('M246 55 H330 V95 H420') + wire('M246 145 H330 V95', 'broken') + xmark(330, 120);
      }, good: function () {
        return nd('e-', 'p', 20, 80, 60, 30, 'ter', '脈波') + nd('e-', 'm1', 200, 30, 46, 50, 'fn', '×') + nd('e-', 'm2', 200, 120, 46, 50, 'fn', '×') + nd('e-', 'ind', 420, 40, 100, 30, 'ter', 'X 位置') + nd('e-', 'ind2', 420, 130, 100, 30, 'ter', 'Y 位置') +
          wire('M80 95 H140 V45 H200') + wire('M140 95 V135 H200') + wire('M246 55 H420') + wire('M246 145 H420');
      },
      errs: [{ n: 'm2', msg: '線：一條線有多個來源', why: '一個輸入只能聽一個輸出。LabVIEW 不知道 X 位置要顯示哪一個 Multiply 的結果。' }],
      fix: '第二個結果接到自己的顯示元件。' },
    { name: '④ Case 少了 Default', bad: function () {
        return nd('e-', 's', 20, 90, 60, 28, 'ter', '步序') + '<g class="nd" id="e-case" data-n="case"><rect x="150" y="30" width="300" height="150" fill="none" stroke="#6b6b6b" stroke-width="6"/></g>' +
          '<rect x="255" y="20" width="90" height="22" fill="#ececec" stroke="#6b6b6b"/><text x="300" y="36" text-anchor="middle" style="fill:#222">1 ▾</text>' +
          '<rect x="142" y="94" width="16" height="20" fill="#fff" stroke="#1e5bd7" stroke-width="2"/><text x="150" y="109" text-anchor="middle" style="font-size:12px">?</text>' + wire('M80 104 H142', 'i32') +
          '<text x="300" y="100" text-anchor="middle">這個 Case 只有 0、1 兩頁</text><text x="300" y="124" text-anchor="middle" style="font-size:12px">（步序可能是 2、3、−1…）</text>';
      }, good: function () {
        return nd('e-', 's', 20, 90, 60, 28, 'ter', '步序') + '<g class="nd" id="e-case" data-n="case"><rect x="150" y="30" width="300" height="150" fill="none" stroke="#6b6b6b" stroke-width="6"/></g>' +
          '<rect x="240" y="20" width="120" height="22" fill="#ececec" stroke="#6b6b6b"/><text x="300" y="36" text-anchor="middle" style="fill:#222">1, Default ▾</text>' +
          '<rect x="142" y="94" width="16" height="20" fill="#fff" stroke="#1e5bd7" stroke-width="2"/><text x="150" y="109" text-anchor="middle" style="font-size:12px">?</text>' + wire('M80 104 H142', 'i32') +
          '<text x="300" y="100" text-anchor="middle">頁：0、1、Default</text><text x="300" y="124" text-anchor="middle" style="font-size:12px">（沒對到的值都走 Default）</text>';
      },
      errs: [{ n: 'case', msg: 'Case 結構：選擇器的值沒有全部處理到', why: '整數選擇器可能是任何整數，只列 0、1 兩頁不夠。加一頁 Default（例如把其中一頁設成 Default，或新增一頁）。' }],
      fix: '把一頁設成 Default，其他值都有地方去。' },
    { name: '⑤ I32 接 DBL：有轉型點', ok: true, bad: function () {
        return nd('e-', 'p', 20, 70, 60, 28, 'ter', '脈波') + nd('e-', 'k', 20, 140, 70, 28, 'ter', '0.005') + nd('e-', 'mul', 230, 70, 46, 50, 'fn', '×') + nd('e-', 'ind', 400, 80, 90, 30, 'ter', 'mm') +
          wire('M80 84 H230', 'i32') + wire('M90 154 H160 V105 H230') + wire('M276 95 H400') + '<circle class="coerce" cx="234" cy="84" r="5"/><text x="240" y="62" style="font-size:12px">← 轉型點（Coercion Dot）</text>';
      }, good: null, errs: [], fix: '' }
  ];
  var E = { k: 0, fixed: false, open: false, ft: null };
  function eDraw() {
    var sc = ESC[E.k], broken = !sc.ok && !E.fixed;
    Array.prototype.forEach.call($('escn').children, function (b, i) { b.classList.toggle('here', i === E.k); });
    $('esvg').innerHTML = (E.fixed && sc.good ? sc.good() : sc.bad());
    $('earrow').innerHTML = arrowSVG(!broken);
    $('efix').disabled = sc.ok || E.fixed;
    if (E.open) {
      var errs = broken ? sc.errs : [];
      var h = '<div class="elist"><h4>Error List：' + errs.length + ' 個錯誤</h4>';
      errs.forEach(function (e, i) { h += '<button type="button" data-i="' + i + '">⛔ ' + e.msg + '</button><p class="why">' + e.why + '</p>'; });
      if (!errs.length) h += '<p class="why" style="padding:8px 10px">沒有錯誤。</p>';
      $('elist').innerHTML = h + '</div>';
      Array.prototype.forEach.call($('elist').querySelectorAll('button'), function (b) { b.onclick = function () { eJump(+b.dataset.i); }; });
    } else $('elist').innerHTML = '';
    if (sc.ok) say('esay', '箭頭是好的，可以執行。橘色的小點是 Coercion Dot：I32 的脈波被自動轉成 DBL 才相乘。不是錯，但看到它要知道資料被轉型了。', 'ok');
    else if (E.fixed) say('esay', '✔ ' + sc.fix + ' 執行箭頭恢復了。', 'ok');
    else if (!E.open) say('esay', '箭頭斷了。點它看 Error List。');
  }
  function eJump(i) {
    var sc = ESC[E.k], e = sc.errs[i]; if (!e) return null;
    var g = $('e-' + e.n); if (!g) return null;
    clearTimeout(E.ft); g.classList.remove('flash'); void g.getBoundingClientRect(); g.classList.add('flash');
    E.ft = setTimeout(function () { g.classList.remove('flash'); }, 1500);
    say('esay', '跳到出錯的地方：' + e.msg, 'bad');
    return e.n;
  }
  function ePick(k) { E.k = k; E.fixed = false; E.open = false; eDraw(); }
  ESC.forEach(function (s, i) { var b = el('button', '', s.name); b.type = 'button'; b.onclick = function () { ePick(i); }; $('escn').appendChild(b); });
  $('earrow').onclick = function () { E.open = !E.open; eDraw(); };
  $('earrow').onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); E.open = !E.open; eDraw(); } };
  $('efix').onclick = function () { E.fixed = true; eDraw(); };
  ePick(0);

  /* ================= 2. Probe、Breakpoint、單步 ================= */
  var ERRV = { err: true, code: -1073807339 };
  var WIRES = {
    w_p: { svg: 'main', d: 'M120 88 H180', cls: 'i32', name: '脈波（D300）' },
    w_mm: { svg: 'main', d: 'M290 88 H325 V76 H360', cls: '', name: 'PulseToMM 輸出 mm' },
    w_c5: { svg: 'main', d: 'M340 143 H348 V100 H360', cls: '', name: '原點偏移 5' },
    w_pos: { svg: 'main', d: 'M406 88 H450', cls: '', name: 'X 位置' },
    w_err: { svg: 'main', d: 'M120 108 H150', cls: 'err', name: 'FX_ReadD 的 error out', only: 'B' },
    wi_in: { svg: 'sub', d: 'M80 64 H170', cls: 'i32', name: '（SubVI）脈波輸入' },
    wi_2000: { svg: 'sub', d: 'M150 123 H160 V76 H170', cls: '', name: '（SubVI）每轉脈波 2000' },
    wi_rev: { svg: 'sub', d: 'M216 64 H330', cls: '', name: '（SubVI）轉數' },
    wi_lead: { svg: 'sub', d: 'M310 123 H320 V76 H330', cls: '', name: '（SubVI）導程常數' },
    wi_mm: { svg: 'sub', d: 'M376 64 H450', cls: '', name: '（SubVI）mm' }
  };
  var STEPS = [{ n: 'rd' }, { n: 'p2m', enter: true }, { n: 'div', inner: true }, { n: 'mul', inner: true }, { n: 'p2m', exit: true }, { n: 'add' }, { n: 'last' }];
  var P = { gen: 0, timer: null };
  function scn() { return $('pscn').value; }
  function fixed() { return $('pfix').checked; }
  function lead() { return scn() === 'A' && !fixed() ? 1 : 10; }
  function pNew() {
    pStopTimer();
    P = { gen: P.gen + 1, timer: null, started: false, pc: 0, paused: false, done: false, wv: {}, probes: P.probes || {}, bps: P.bps || {}, ran: {}, skipBp: -1, subErr: false, written: null, out: null };
    Object.keys(P.probes).forEach(function (w) { if (WIRES[w].only && WIRES[w].only !== scn()) delete P.probes[w]; else P.probes[w] = { val: undefined, has: false }; });
    $('plog').innerHTML = ''; say('psay', '');
    pBuild(); pDraw();
  }
  function pStopTimer() { if (P && P.timer) { clearInterval(P.timer); P.timer = null; } if (P) P.gen++; }
  function fmtV(v) { if (v && typeof v === 'object') return 'status: ' + (v.err ? 'TRUE' : 'FALSE') + '，code: ' + v.code; return String(+(+v).toFixed(4)); }
  function setW(w, v) { P.wv[w] = v; if (P.probes[w]) { P.probes[w].val = v; P.probes[w].has = true; } }
  function pBuild() {
    var B = scn() === 'B', fx = fixed(), m = '';
    Object.keys(WIRES).forEach(function (k) {
      var w = WIRES[k]; if (w.svg !== 'main' || (w.only && w.only !== scn())) return;
      m += wire(w.d, w.cls) + '<path class="hit" data-w="' + k + '" d="' + w.d + '"/>';
    });
    if (B) {
      if (fx) m += wire('M150 108 H180', 'err') + wire('M290 108 H300 V190 H430 V108 H450', 'err') + '<path class="hit" data-w="w_err" d="M150 108 H180"/>';
      else m += '<text x="154" y="130" style="font-size:11px;fill:#a16207">error out 沒接</text>';
    }
    m += nd('pm-', 'rd', 20, 60, 100, 56, 'sub', ['FX_ReadD', 'D300']) + nd('pm-', 'p2m', 180, 60, 110, 56, 'sub', ['PulseTo', 'MM.vi']) +
      nd('pm-', 'c5', 300, 130, 40, 26, 'ter', '5') + nd('pm-', 'add', 360, 64, 46, 48, 'fn', '+') +
      (B ? nd('pm-', 'last', 450, 60, 100, 56, 'sub', ['寫紀錄檔', '.vi']) : nd('pm-', 'last', 450, 70, 100, 36, 'ter', 'X 位置 mm'));
    m += '<g id="pm-pbs"></g>';
    $('pmain').innerHTML = m;
    var s = '';
    Object.keys(WIRES).forEach(function (k) { var w = WIRES[k]; if (w.svg !== 'sub') return; s += wire(w.d, w.cls) + '<path class="hit" data-w="' + k + '" d="' + w.d + '"/>'; });
    s += nd('ps-', 'in', 10, 50, 70, 28, 'ter', '脈波') + nd('ps-', 'k2000', 90, 110, 60, 26, 'ter', '2000') + nd('ps-', 'div', 170, 40, 46, 48, 'fn', '÷') +
      nd('ps-', 'klead', 250, 110, 60, 26, 'ter', String(lead())) + nd('ps-', 'mul', 330, 40, 46, 48, 'fn', '×') + nd('ps-', 'out', 450, 50, 90, 28, 'ter', 'mm');
    if (B && fx) s += '<text x="10" y="20" style="font-size:12px;fill:#a16207">外面包一個 Case：error in 有錯就整段跳過，直接把錯誤傳出去</text>';
    s += '<g id="ps-pbs"></g>';
    $('psub').innerHTML = s;
    ['pmain', 'psub'].forEach(function (id) {
      Array.prototype.forEach.call($(id).querySelectorAll('.hit'), function (h) { h.onclick = function () { pToggleProbe(h.dataset.w); }; });
      Array.prototype.forEach.call($(id).querySelectorAll('.nd'), function (g) {
        var n = g.dataset.n; if (['rd', 'p2m', 'add', 'last', 'div', 'mul'].indexOf(n) < 0) return;
        g.onclick = function () { pToggleBp(n); };
      });
    });
  }
  function pToggleProbe(w) {
    if (!WIRES[w]) return;
    if (P.probes[w]) delete P.probes[w];
    else {
      var has = P.wv.hasOwnProperty(w) && ($('pret').checked || (P.started && !P.done && P.paused));
      P.probes[w] = { val: has ? P.wv[w] : undefined, has: has };
    }
    pDraw();
  }
  function pToggleBp(n) { if (P.bps[n]) delete P.bps[n]; else P.bps[n] = 1; pDraw(); }
  function inSub() { var s = STEPS[P.pc]; return P.started && !P.done && s && (s.inner || s.exit); }
  function pDraw() {
    var cur = P.started && !P.done && P.paused ? STEPS[P.pc] : null;
    ['rd', 'p2m', 'add', 'last'].forEach(function (n) { var g = $('pm-' + n); if (!g) return; g.setAttribute('class', g.getAttribute('class').replace(/ (ran|next|bp)/g, '') + (P.ran[n] ? ' ran' : '') + (cur && cur.n === n && !cur.exit ? ' next' : '') + (P.bps[n] ? ' bp' : '')); });
    ['div', 'mul'].forEach(function (n) { var g = $('ps-' + n); g.setAttribute('class', g.getAttribute('class').replace(/ (ran|next|bp)/g, '') + (P.ran[n] ? ' ran' : '') + (cur && cur.n === n ? ' next' : '') + (P.bps[n] ? ' bp' : '')); });
    $('psubp').classList.toggle('active', !!inSub());
    // 線上的 Probe 標記
    ['main', 'sub'].forEach(function (sv) {
      var h = '', i = 0;
      Object.keys(P.probes).forEach(function (w, idx) {
        var W = WIRES[w]; if (W.svg !== sv) return;
        var p = $(sv === 'main' ? 'pmain' : 'psub').querySelector('.hit[data-w="' + w + '"]'); if (!p) return;
        var L = p.getTotalLength(), pt = p.getPointAtLength(L * .5);
        h += '<rect class="pb" x="' + (pt.x - 9) + '" y="' + (pt.y - 22) + '" width="18" height="16" rx="3"/><text class="pbt" x="' + pt.x + '" y="' + (pt.y - 10) + '" text-anchor="middle">' + (idx + 1) + '</text>';
        i++;
      });
      $(sv === 'main' ? 'pm-pbs' : 'ps-pbs').innerHTML = h;
    });
    // Probe Watch
    var keys = Object.keys(P.probes);
    $('pprobes').innerHTML = keys.length ? keys.map(function (w, idx) {
      var p = P.probes[w], bad = p.has && p.val && typeof p.val === 'object' && p.val.err;
      return '<div class="probe' + (bad ? ' bad' : '') + '"><b>Probe ' + (idx + 1) + '</b>' + (p.has ? '<span>' + fmtV(p.val) + '</span>' : '<span class="none">' + (P.done ? '沒有值（VI 跑完才放的 Probe；開 Retain Wire Values 再執行一次）' : P.wv.hasOwnProperty(w) ? '資料已經流過，但 VI 已不在暫停狀態；開 Retain Wire Values 才留得住' : '還沒有資料流過') + '</span>') + '<small>' + WIRES[w].name + '</small></div>';
    }).join('') : '<p class="why">還沒有 Probe。點方塊圖上的線放一個。</p>';
    var started = P.started && !P.done;
    $('prun').disabled = !!P.timer; $('prun').textContent = P.paused ? '▶ 繼續執行' : '▶ 執行';
    $('pinto').disabled = $('pover').disabled = $('pout').disabled = !!P.timer || P.done;
    $('pscn').disabled = $('pfix').disabled = started;
  }
  function bpAt(pc) { var s = STEPS[pc]; return s && !s.exit && P.bps[s.n] && P.skipBp !== pc; }
  function exec(pc) {
    var s = STEPS[pc], B = scn() === 'B', fx = fixed();
    if (s.n === 'rd') {
      if (B) { setW('w_p', 0); setW('w_err', ERRV); log('plog', 'FX_ReadD：VISA Read 逾時 → 脈波輸出 0，error out 帶著錯誤 -1073807339'); }
      else { setW('w_p', 12000); log('plog', 'FX_ReadD：讀到 D300 = 12000 脈波'); }
    } else if (s.enter) {
      P.subErr = B && fx; setW('wi_in', P.wv.w_p);
      log('plog', '進入 PulseToMM.vi' + (B ? (fx ? '（error in 接到了：有錯誤）' : '（error in 沒接：以為一切正常）') : ''));
    } else if (s.n === 'div') {
      if (P.subErr) log('plog', '（SubVI）÷：error in 有錯，跳過');
      else { setW('wi_rev', P.wv.wi_in / 2000); log('plog', '（SubVI）÷：' + P.wv.wi_in + ' ÷ 2000 = ' + fmtV(P.wv.wi_rev) + ' 轉'); }
    } else if (s.n === 'mul') {
      if (P.subErr) log('plog', '（SubVI）×：error in 有錯，跳過');
      else { setW('wi_mm', P.wv.wi_rev * lead()); log('plog', '（SubVI）×：' + fmtV(P.wv.wi_rev) + ' × ' + lead() + ' = ' + fmtV(P.wv.wi_mm) + ' mm'); }
    } else if (s.exit) {
      setW('w_mm', P.subErr ? 0 : P.wv.wi_mm); log('plog', '離開 PulseToMM.vi，輸出 ' + fmtV(P.wv.w_mm) + ' mm');
    } else if (s.n === 'add') {
      setW('w_pos', P.wv.w_mm + 5); log('plog', '+：' + fmtV(P.wv.w_mm) + ' + 5 = ' + fmtV(P.wv.w_pos));
    } else if (s.n === 'last') {
      if (B && fx) { P.written = null; log('plog', '寫紀錄檔：error in 有錯，跳過不寫。錯誤處理顯示「逾時 -1073807339」'); }
      else if (B) { P.written = P.wv.w_pos; log('plog', '寫紀錄檔：寫入「X = ' + fmtV(P.wv.w_pos) + ' mm」← 其實 PLC 根本沒讀到'); }
      else { P.out = P.wv.w_pos; log('plog', 'X 位置顯示 ' + fmtV(P.wv.w_pos) + ' mm'); }
    }
    if (!s.enter) P.ran[s.n] = 1;
  }
  function begin() {
    if (P.started && !P.done) return;
    pNew(); P.started = true; setW('w_c5', 5); setW('wi_2000', 2000); setW('wi_lead', lead());
    log('plog', '開始執行');
  }
  /* 從目前的 pc 一直跑到 stopFn(pc) 為真、或碰到 Breakpoint、或跑完 */
  function runUntil(stopFn, honorBp) {
    while (P.pc < STEPS.length) {
      if (stopFn && stopFn(P.pc)) { pPause(); return; }
      if (honorBp && bpAt(P.pc)) { pPause('Breakpoint'); return; }
      exec(P.pc); P.pc++; P.skipBp = -1;
    }
    pFinish();
  }
  function pPause(why) {
    P.paused = true; P.skipBp = P.pc;
    var s = STEPS[P.pc], name = { rd: 'FX_ReadD', p2m: 'PulseToMM', div: '÷', mul: '×', add: '+', last: scn() === 'B' ? '寫紀錄檔' : 'X 位置' }[s.n];
    log('plog', (why ? '⏸ 停在 Breakpoint：' : '⏸ 暫停：') + '下一個要執行的是「' + name + '」' + (s.inner ? '（在 SubVI 裡）' : ''));
    pDraw();
  }
  function pFinish() {
    P.done = true; P.paused = false; pStopTimer(); pDraw();
    var B = scn() === 'B', fx = fixed();
    if (!B) say('psay', fx ? '✔ X 位置 = 65 mm，正確。' : '✖ X 位置 = ' + fmtV(P.out) + ' mm，應該是 65。從輸入往後看 Probe：脈波 12000 對、轉數 6 對、SubVI 裡的 mm 變成 6 就錯了 → 錯在 × 那個節點：導程常數寫成 1，應該是 10。', fx ? 'ok' : 'bad');
    else say('psay', fx ? '✔ 讀取逾時之後，PulseToMM 和寫紀錄檔都跳過了，錯誤被報出來，紀錄檔裡沒有假資料。' : '✖ 紀錄檔寫進了「5 mm」，但這筆是假的：FX_ReadD 已經逾時，error out 卻沒接下去。Probe 放在 error out 上就看得到 status TRUE。', fx ? 'ok' : 'bad');
  }
  function pRun() {
    if (!P.started || P.done) begin();
    P.paused = false; pDraw();
    var g = P.gen;
    P.timer = setInterval(function () {
      if (g !== P.gen) return;
      if (P.pc >= STEPS.length) { pFinish(); return; }
      if (bpAt(P.pc)) { clearInterval(P.timer); P.timer = null; pPause('Breakpoint'); return; }
      exec(P.pc); P.pc++; P.skipBp = -1; pDraw();
    }, 380);
    pDraw();
  }
  function ensurePaused() { if (!P.started || P.done) { begin(); pPause(); return false; } return true; }
  function nextMain(pc) { var i = pc; while (i < STEPS.length && (STEPS[i].inner || STEPS[i].exit)) i++; return i; }
  function pStepOver() {
    if (P.timer) return; if (!ensurePaused()) return;
    var s = STEPS[P.pc], target;
    if (s.enter) target = nextMain(P.pc + 1);
    else if (s.inner) { target = P.pc + 1; if (STEPS[target] && STEPS[target].exit) target++; }
    else target = P.pc + 1;
    var start = P.pc; P.skipBp = start;
    runUntil(function (pc) { return pc === target; }, true);
  }
  function pStepInto() {
    if (P.timer) return; if (!ensurePaused()) return;
    var s = STEPS[P.pc];
    if (s.enter) { exec(P.pc); P.pc++; P.skipBp = -1; log('plog', 'Step Into：打開 PulseToMM.vi，在裡面一步一步走'); pPause(); return; }
    pStepOver();
  }
  function pStepOut() {
    if (P.timer) return; if (!ensurePaused()) return;
    var s = STEPS[P.pc];
    if (s.inner || s.exit) { var target = nextMain(P.pc); P.skipBp = P.pc; log('plog', 'Step Out：把 PulseToMM.vi 剩下的跑完，回到主程式'); runUntil(function (pc) { return pc === target; }, true); }
    else { P.skipBp = P.pc; runUntil(null, true); }
  }
  $('prun').onclick = pRun; $('pover').onclick = pStepOver; $('pinto').onclick = pStepInto; $('pout').onclick = pStepOut;
  $('preset').onclick = function () { pNew(); };
  $('pscn').onchange = $('pfix').onchange = function () { pNew(); };
  $('pret').onchange = pDraw;
  P.probes = {}; P.bps = {}; pNew();

  /* ================= 3. 迴圈的除錯 ================= */
  var PTS = [100, 250, 400, 550, 700];
  var LW = {
    w_arr: { d: 'M90 44 H166', cls: '', name: '點位陣列', thick: true },
    w_size: { d: 'M120 146 V165', cls: 'i32', name: 'Array Size' },
    w_N: { d: 'M145 183 H160 V41 H185', cls: 'i32', name: 'N（要跑幾圈）' },
    w_Nfix: { d: 'M145 128 H160 V41 H185', cls: 'i32', name: 'N（要跑幾圈）' },
    w_i: { d: 'M209 191 H260 V105 H300', cls: 'i32', name: 'i（第幾圈）' },
    w_x: { d: 'M360 95 H400', cls: '', name: '這一圈的點位 x' }
  };
  var L = { gen: 0, timer: null };
  function lFix() { return $('lfix').checked; }
  function lNew() {
    lStopTimer();
    L = { gen: L.gen + 1, timer: null, probes: L.probes || {}, i: -1, phase: 'idle', N: null, got: [], paused: false, done: false, wv: {} };
    Object.keys(L.probes).forEach(function (w) { L.probes[w] = { hist: [] }; });
    $('llog').innerHTML = ''; say('lsay', '');
    lBuild(); lDraw();
  }
  function lStopTimer() { if (L && L.timer) { clearTimeout(L.timer); L.timer = null; } if (L) L.gen++; }
  function lw(k) { return k === 'w_N' && lFix() ? 'w_Nfix' : k; }
  function lBuild() {
    var fx = lFix(), s = '<rect x="170" y="20" width="370" height="200" fill="none" stroke="#4a6fa5" stroke-width="6" rx="4"/><text x="480" y="14" style="font-size:12px">For Loop</text>';
    ['w_arr', 'w_size', fx ? 'w_Nfix' : 'w_N', 'w_i', 'w_x'].forEach(function (k) {
      var w = LW[k]; s += '<path class="w ' + w.cls + '" d="' + w.d + '"' + (w.thick ? ' style="stroke-width:5"' : '') + '/><path class="hit" data-w="' + (k === 'w_Nfix' ? 'w_N' : k) + '" d="' + w.d + '"/>';
    });
    s += '<path class="w" style="stroke-width:5" d="M174 44 H280 V82 H300"/><rect x="164" y="37" width="12" height="14" fill="#e8820c"/>';
    s += nd('l-', 'arr', 10, 30, 80, 28, 'ter', '點位[ ]') + nd('l-', 'size', 95, 110, 50, 36, 'fn', 'Size') + (fx ? '' : nd('l-', 'dec', 95, 165, 50, 36, 'fn', '−1') + '<path class="w i32" d="M120 146 V165"/>') +
      nd('l-', 'N', 185, 30, 24, 22, 'ter', 'N') + nd('l-', 'i', 185, 180, 24, 22, 'ter', 'i') + nd('l-', 'idx', 300, 70, 60, 50, 'fn', 'Index') + nd('l-', 'mv', 400, 70, 110, 50, 'sub', ['MoveTo', '.vi']);
    s += '<g id="l-pbs"></g>';
    $('lsvg').innerHTML = s;
    Array.prototype.forEach.call($('lsvg').querySelectorAll('.hit'), function (h) { h.onclick = function () { lToggleProbe(h.dataset.w); }; });
  }
  function lToggleProbe(w) { if (L.probes[w]) delete L.probes[w]; else L.probes[w] = { hist: L.wv.hasOwnProperty(w) && !L.done ? [L.wv[w]] : [] }; lDraw(); }
  function lSet(w, v) { L.wv[w] = v; if (L.probes[w]) L.probes[w].hist.push(v); }
  function lDraw() {
    var h = '';
    Object.keys(L.probes).forEach(function (w, idx) {
      var p = $('lsvg').querySelector('.hit[data-w="' + w + '"]'); if (!p) return;
      var pt = p.getPointAtLength(p.getTotalLength() * .5);
      h += '<rect class="pb" x="' + (pt.x - 9) + '" y="' + (pt.y - 22) + '" width="18" height="16" rx="3"/><text class="pbt" x="' + pt.x + '" y="' + (pt.y - 10) + '" text-anchor="middle">' + (idx + 1) + '</text>';
    });
    $('l-pbs').innerHTML = h;
    ['idx', 'mv'].forEach(function (n) { var g = $('l-' + n); g.setAttribute('class', g.getAttribute('class').replace(/ next/g, '') + (L.phase === 'x' && !L.done ? ' next' : '')); });
    var keys = Object.keys(L.probes);
    $('lprobes').innerHTML = keys.length ? keys.map(function (w, idx) {
      var p = L.probes[w], last = p.hist.length ? p.hist[p.hist.length - 1] : undefined;
      return '<div class="probe"><b>Probe ' + (idx + 1) + '</b>' + (last === undefined ? '<span class="none">' + (L.done ? '沒有值（迴圈跑完才放的 Probe）' : '還沒有資料流過') + '</span>' : '<span>' + (Array.isArray(last) ? '[' + last.join(', ') + ']' : last) + '</span>') + '<small>' + LW[lw(w)].name + (p.hist.length > 1 ? '｜每圈：' + p.hist.map(function (v) { return Array.isArray(v) ? '[…]' : v; }).join(', ') : '') + '</small></div>';
    }).join('') : '<p class="why">還沒有 Probe。點方塊圖上的線放一個（試試 N 那條）。</p>';
    $('lgot').innerHTML = PTS.map(function (x, k) { var hit = L.got.indexOf(x) >= 0; return '<span class="' + (hit ? '' : L.done ? 'miss' : 'wait') + '">' + x + '</span>'; }).join('');
    $('lrun').disabled = !!L.timer || L.paused; $('lcont').disabled = !L.paused;
    $('lfix').disabled = !!L.timer || L.paused;
  }
  /* 一步：phase 依序 start → i → x → (下一圈 i) … → end */
  function lStep() {
    if (L.done) return false;
    if (L.phase === 'idle') {
      L.N = PTS.length - (lFix() ? 0 : 1);
      lSet('w_arr', PTS.slice()); lSet('w_size', PTS.length); lSet('w_N', L.N);
      log('llog', '開始：Array Size = ' + PTS.length + (lFix() ? '，直接接 N' : '，減 1 後 N = ' + L.N));
      L.phase = 'start';
    } else if (L.phase === 'start' || L.phase === 'x') {
      var ni = L.i + 1;
      if (ni >= L.N) { L.done = true; L.phase = 'end'; lEnd(); return false; }
      L.i = ni; L.phase = 'i'; lSet('w_i', ni);
      var c = $('lcond').value;
      if (c !== '' && +c === ni) { L.paused = true; log('llog', '⏸ Conditional Probe：i = ' + ni + '，條件成立，暫停'); say('lsay', '停在 i = ' + ni + '。看一下各個 Probe 的值，再按「繼續」。' + (+c >= L.N - 1 ? '' : '')); lDraw(); return false; }
    } else if (L.phase === 'i') {
      var x = PTS[L.i]; lSet('w_x', x); L.got.push(x); L.phase = 'x';
      log('llog', '第 i = ' + L.i + ' 圈：Index Array 取出 ' + x + '，MoveTo ' + x + ' mm');
    }
    lDraw(); return true;
  }
  function lEnd() {
    lStopTimer(); lDraw();
    var miss = PTS.filter(function (x) { return L.got.indexOf(x) < 0; });
    if (!miss.length) say('lsay', '✔ 5 個點位都走到了，For Loop 跑了 ' + L.N + ' 圈。', 'ok');
    else say('lsay', '✖ 只跑了 ' + L.N + ' 圈，' + miss.join('、') + ' mm 沒走到。' + (L.probes.w_N ? 'Probe 1 在 N 上就看得到：N = ' + L.N + '。' : '在 N 那條線放 Probe 看看。') + (+$('lcond').value === 4 ? '　你設了 i = 4 才暫停，結果根本沒停：i 從來沒到 4。' : ''), 'bad');
    log('llog', '迴圈結束，共 ' + L.N + ' 圈');
  }
  function lLoop() {
    var g = L.gen, dt = $('lhl').checked ? 650 : 90;
    (function tick() {
      if (g !== L.gen) return;
      if (!lStep()) { L.timer = null; lDraw(); return; }
      L.timer = setTimeout(tick, dt);
    })();
  }
  function lRun() { if (L.timer || L.paused) return; if (L.done || L.phase !== 'idle') lNew(); lLoop(); lDraw(); }
  function lCont() { if (!L.paused) return; L.paused = false; say('lsay', ''); lLoop(); lDraw(); }
  function lRunSync() { lNew(); var k = 0; while (k++ < 100) { if (!lStep()) { if (L.paused) { L.paused = false; continue; } break; } } return L; }
  $('lrun').onclick = lRun; $('lcont').onclick = lCont; $('lreset').onclick = function () { lNew(); };
  $('lfix').onchange = function () { L.probes = {}; lNew(); };
  L.probes = {}; lNew();

  if (/^#(err|probe|loop)$/.test(location.hash)) show(location.hash.slice(1));
  window.DebugLab = {
    show: show, stopAll: stopAll,
    ESC: ESC, ePick: ePick, eJump: eJump, eOpen: function (v) { E.open = v; eDraw(); }, eFix: function () { E.fixed = true; eDraw(); }, E: function () { return E; },
    pNew: pNew, pRun: pRun, pStepOver: pStepOver, pStepInto: pStepInto, pStepOut: pStepOut, pToggleProbe: pToggleProbe, pToggleBp: pToggleBp,
    pRunSync: function () { begin(); runUntil(null, true); return P; }, P: function () { return P; },
    lNew: lNew, lStep: lStep, lRun: lRun, lCont: lCont, lRunSync: lRunSync, lToggleProbe: lToggleProbe, L: function () { return L; }
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function r(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function q(o) { o.wrong = o.wrong.filter(function (w) { return w !== o.ans; }); return o; }
  var KIND = [
    function () { return q({ q: 'VI 的執行箭頭斷掉了（灰色、有裂痕）。想知道哪裡錯，最直接的做法？', ans: '點斷掉的箭頭，看 Error List', wrong: ['開 Highlight Execution 再執行', '在每條線放 Probe', '重新開 LabVIEW', '設一個 Breakpoint'], ex: '箭頭斷掉代表根本不能執行，Probe、Breakpoint、Highlight 都用不上。Error List 會列出每個錯誤，選一項就能跳到出錯的地方。' }); },
    function () { return q({ q: '下面哪一種情況<b>不會</b>讓執行箭頭斷掉？', ans: 'I32 接到 DBL 的輸入，出現轉型點', wrong: ['兩個輸出接到同一個輸入', '字串接到 Add', 'SubVI 的 Required 輸入沒接', '整數選擇器的 Case 沒有 Default、也沒列出所有值'], ex: '轉型點（Coercion Dot）表示資料被自動轉型，不是錯誤。其他四個都是編輯階段的錯誤。' }); },
    function () { return q({ q: 'Probe 視窗顯示的是什麼？', ans: '那條線最近一次流過的值', wrong: ['那條線所有歷史值的平均', '那條線應該要有的正確值', '節點執行花了多久', '整個 VI 的錯誤清單'], ex: 'Probe 顯示最新流過的值。迴圈裡的線每圈都會被新值蓋掉。' }); },
    function () { return q({ q: 'VI 已經執行完了，這時才在一條線上放 Probe，<b>沒有</b>開 Retain Wire Values。Probe 會顯示？', ans: '沒有值，要再執行一次才有', wrong: ['最後一次的值', '0', '預設值', '錯誤訊息'], ex: '平常 Probe 要在資料流過之前放好。先開 Retain Wire Values 再執行，跑完之後放的 Probe 才看得到最後的值。' }); },
    function () { return q({ q: '在一個節點上設 Breakpoint，程式會在什麼時候暫停？', ans: '要執行那個節點之前', wrong: ['那個節點執行完之後', 'VI 一開始就暫停', 'VI 結束時', '出錯的時候才暫停'], ex: '節點上的 Breakpoint 在它要執行前停下，這時它的輸入都已經到了，可以用 Probe 看。' }); },
    function () { var w = p1([['Step Over', '把 SubVI 整個執行完，不進去，停在下一個節點前'], ['Step Into', '打開 SubVI，停在它裡面的第一個節點前'], ['Step Out', '把目前這個 SubVI（或結構）跑完，回到上一層再停']]); return q({ q: '程式暫停，下一個節點是 SubVI。按 <b>' + w[0] + '</b> 會？', ans: w[1], wrong: ['把 SubVI 整個執行完，不進去，停在下一個節點前', '打開 SubVI，停在它裡面的第一個節點前', '把目前這個 SubVI（或結構）跑完，回到上一層再停', '直接結束整個 VI', '跳過 SubVI 不執行'], ex: 'Step Into 進去、Step Over 跳過（整個跑完）、Step Out 跑完這一層出來。' }); },
    function () { return q({ q: '迴圈要跑幾千圈，只有某一圈的值超過上限時才出問題。最適合的工具？', ans: 'Conditional Probe，設條件成立時暫停', wrong: ['Highlight Execution 從頭看到尾', '一般 Probe 盯著看', 'Retain Wire Values', '在迴圈外的線設 Breakpoint'], ex: 'Conditional Probe 讓你設條件（例如值大於某數），條件成立才暫停，不用一圈一圈看。' }); },
    function () { return q({ q: '開 Highlight Execution 執行，下面哪一個正確？', ans: '執行變很慢，和時間有關的問題可能看不到', wrong: ['計算結果會不一樣', '程式跑得更快', '會自動修好錯誤', 'Probe 會失效'], ex: '慢動作可以看清楚資料流，但時間被拉長了，和時序有關的 bug 可能因此不出現。' }); },
    function () { var n = p1([4, 5, 6, 8]); return q({ q: '點位陣列有 ' + n + ' 個元素，For Loop 的 N 接了「陣列大小 − 1」，迴圈裡用 i 去 Index Array。會走到幾個點？', ans: (n - 1) + ' 個（最後一個沒走到）', wrong: [n + ' 個，全部', (n - 2) + ' 個', (n + 1) + ' 個（多走一個空的）', '0 個'], ex: 'N 是要跑幾圈。接 ' + (n - 1) + ' 就只跑 i = 0～' + (n - 2) + '。直接接陣列大小，或把陣列接進迴圈用自動索引。' }); },
    function () { var p = p1([4000, 8000, 12000, 20000]), ppr = p1([1000, 2000]), ld = p1([5, 10]); return q({ q: '脈波 ' + p + '，馬達每轉 ' + ppr + ' 脈波，導程每轉 ' + ld + ' mm。正確的位置是多少 mm？', ans: String(p / ppr * ld), wrong: [String(p / ppr), String(p * ld), String(p / ld), String(p / ppr * ld * 2)], ex: p + ' ÷ ' + ppr + ' = ' + p / ppr + ' 轉，× ' + ld + ' mm = ' + p / ppr * ld + ' mm。' }); },
    function () { return q({ q: '從輸入往輸出一條一條放 Probe，發現第 3 條線的值開始不對（第 1、2 條都對）。錯最可能在哪裡？', ans: '產生第 3 條線的那個節點', wrong: ['第 1 條線的來源', '最後的顯示元件', '第 3 條線後面的節點', 'LabVIEW 本身'], ex: '第一條錯的線，錯就在產生它的節點裡（輸入對、輸出錯）。' }); },
    function () { return q({ q: 'FX_ReadD 逾時出錯，但它的 error out 沒有接到下一個 SubVI。下一個 SubVI 會？', ans: '照樣執行，拿到的數值是 0 之類的預設值', wrong: ['自動跳過不執行', '跟著出同一個錯誤', '整個 VI 斷掉不能執行', '自動重新讀一次'], ex: '下一個 SubVI 不知道前面出錯。錯誤線接起來，照慣例寫的 SubVI 看到 error in 有錯就會跳過。' }); },
    function () { return q({ q: 'Error List 預設<b>不會</b>列出哪一種項目？', ans: '警告（要勾選顯示警告才看得到）', wrong: ['斷線', '型別不符', 'Required 輸入沒接', '找不到 SubVI'], ex: '警告不會讓箭頭斷掉，所以預設不顯示。' }); },
    function () { var n = r(3, 6); return q({ q: 'For Loop 跑 ' + n + ' 圈，在迴圈裡 i 的線上放一般的 Probe。迴圈跑完後 Probe 顯示多少？', ans: String(n - 1), wrong: [String(n), '0', '[0 … ' + (n - 1) + '] 整個陣列', '沒有值'], ex: 'Probe 顯示最後一次流過的值：最後一圈的 i 是 ' + (n - 1) + '（i 從 0 開始）。' }); }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) window.DebugLab.quiz = window.LabQuiz('dquiz', gen);
  window.DebugLab.quizGen = gen; window.DebugLab.quizKinds = KIND;
})();
