/* 方法節點實驗室：Property vs Invoke、類別階層、This VI + Controls[]、VI Server */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function log(id, s) { var l = $(id); l.insertBefore(el('div', '', s), l.firstChild); }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function pulse(e, cls, ms) { if (!e) return; e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); setTimeout(function () { e.classList.remove(cls); }, ms || 800); }

  /* ---------- 共用：畫一個前面板元件 ---------- */
  function ctlHTML(c) {
    var face;
    if (c.k === 'num') face = '<div class="nbox' + (c.ind ? ' ind' : '') + '">' + esc(c.v) + '</div>';
    else if (c.k === 'bool') face = '<div class="swf' + (c.v ? ' on' : '') + '"></div>';
    else if (c.k === 'btn') face = '<div class="btnf">' + esc(c.txt) + '</div>';
    else if (c.k === 'str') face = '<div class="strf">' + esc(c.v) + '</div>';
    else if (c.k === 'chart') face = '<svg class="chart" viewBox="0 0 220 90">' + chartPath(c.v) + '</svg>';
    return '<div class="ctl' + (c.dis ? ' dis' : '') + '" id="' + c.dom + '"><span class="lb">' + esc(c.label) + '</span>' + face + '</div>';
  }
  function chartPath(d) {
    if (!d.length) return '<text x="110" y="50" fill="#6b7280" font-size="11" text-anchor="middle">（沒有資料）</text>';
    var p = d.map(function (v, i) { return (i ? 'L' : 'M') + (4 + i * 212 / Math.max(1, d.length - 1)).toFixed(1) + ' ' + (84 - v / 300 * 78).toFixed(1); }).join(' ');
    return '<path d="' + p + '" fill="none" stroke="#facc15" stroke-width="2"/>';
  }

  /* ================= 1. 屬性 vs 方法 ================= */
  var V = { gen: 0, els: {} };
  function vInit() {
    V.els = {
      x: { dom: 'v-x', k: 'num', cls: 'Numeric', label: 'Target X (mm)', v: 125.5, def: 0 },
      vac: { dom: 'v-vac', k: 'bool', cls: 'Boolean', label: 'Vacuum', v: true, def: false },
      note: { dom: 'v-note', k: 'str', cls: 'String', label: 'Operator Note', v: '換班檢查', def: '' },
      ch: { dom: 'v-ch', k: 'chart', cls: 'Waveform Chart', label: 'X Position', v: [0, 40, 90, 150, 200, 230, 250, 260, 255, 258], def: [] }
    };
  }
  var VACTS = {
    common: [['p-val', 'Property：Value（讀）'], ['p-dis2', 'Property：Disabled ← 2（寫）'], ['p-dis0', 'Property：Disabled ← 0（寫）'], ['m-reinit', 'Invoke：Reinitialize To Default'], ['m-img', 'Invoke：Get Image']],
    ch: [['p-hist', 'Property：History Data ← 空陣列（寫）'], ['m-export', 'Invoke：Export Image'], ['m-img', 'Invoke：Get Image'], ['p-dis2', 'Property：Disabled ← 2（寫）'], ['p-dis0', 'Property：Disabled ← 0（寫）']]
  };
  function vDraw() {
    var fp = $('vfp'), cap = fp.querySelector('.cap').outerHTML;
    fp.innerHTML = cap + Object.keys(V.els).map(function (k) { return ctlHTML(V.els[k]); }).join('');
  }
  function vActs() {
    var t = $('vtgt').value, list = t === 'ch' ? VACTS.ch : VACTS.common, s = $('vact'), keep = s.value;
    s.innerHTML = list.map(function (a) { return '<option value="' + a[0] + '">' + a[1] + '</option>'; }).join('');
    if (list.some(function (a) { return a[0] === keep; })) s.value = keep;
    vNode();
  }
  function vNode() {
    var t = V.els[$('vtgt').value], a = $('vact').value, inv = a.charAt(0) === 'm', rows;
    if (a === 'p-val') rows = ['Value ►（讀出）'];
    else if (a === 'p-dis2') rows = ['◄ 2　Disabled'];
    else if (a === 'p-dis0') rows = ['◄ 0　Disabled'];
    else if (a === 'p-hist') rows = ['◄ [ ]　History Data'];
    else if (a === 'm-reinit') rows = ['Reinitialize To Default'];
    else if (a === 'm-img') rows = ['Get Image', '◄ Image Depth：8', 'Image ►（影像資料）'];
    else rows = ['Export Image', '◄ File Type：PNG', '◄ Target：File', '◄ Path：C:\\gantry\\xpos.png', '◄ Hide Grid：F', '◄ Always Overwrite：T'];
    $('vnode').innerHTML = '<span class="refw" id="vref"></span><span class="node' + (inv ? ' inv' : '') + '" id="vnd"><span class="nh">' + esc(t.label) + '（' + (inv ? 'Invoke Node' : 'Property Node') + '）</span>' + rows.map(function (r) { return '<span class="nr">' + esc(r) + '</span>'; }).join('') + '</span>';
  }
  function vRun(sync) {
    var g = ++V.gen, key = $('vtgt').value, t = V.els[key], a = $('vact').value;
    function effect() {
      if (g !== V.gen) return;
      var dom = $(t.dom), msg = '', cls = 'act';
      if (a === 'p-val') { msg = '讀到 Value = ' + (t.k === 'str' ? '"' + t.v + '"' : String(t.v)) + '。元件本身沒有任何變化，只是把現在的值讀出來。'; cls = ''; }
      else if (a === 'p-dis2') { t.dis = 1; msg = 'Disabled 寫成 2：元件變灰、不能操作。它會一直保持這個狀態，直到再寫一次。'; }
      else if (a === 'p-dis0') { t.dis = 0; msg = 'Disabled 寫成 0：恢復可以操作。'; }
      else if (a === 'p-hist') { t.v = []; msg = '寫 History Data 為空陣列：圖表清空。這是寫屬性，不是方法。'; }
      else if (a === 'm-reinit') { var old = t.v; t.v = Array.isArray(t.def) ? t.def.slice() : t.def; msg = '叫它做一件事：恢復成預設值。' + (t.k === 'str' ? '"' + old + '" → "' + t.v + '"' : old + ' → ' + t.v) + '（預設值是存檔時設定的值）。'; }
      else if (a === 'm-img') { cls = 'snap'; msg = 'Get Image：傳回這個元件現在長相的影像資料（Image Depth 8 = 256 色），可以接到圖片顯示或存檔。元件本身不變。'; }
      else { cls = 'snap'; msg = 'Export Image：把圖表存成 C:\\gantry\\xpos.png。Always Overwrite 設 T，檔案已經存在也直接覆蓋。'; }
      vDraw(); dom = $(t.dom);
      if (cls) pulse(dom, cls, 900);
      say('vsay', msg, a.charAt(0) === 'm' ? 'ok' : '');
      log('vlog', (a.charAt(0) === 'm' ? '方法' : '屬性') + '｜' + t.label + '：' + $('vact').selectedOptions[0].textContent);
    }
    pulse($('vnd'), 'go', 700);
    if (sync) { effect(); return t; }
    var r = $('vref'); r.classList.remove('flow'); void r.offsetWidth; r.classList.add('flow');
    setTimeout(effect, 600);
    return t;
  }
  vInit();
  [['x', 'Target X (mm)（Numeric）'], ['vac', 'Vacuum（Boolean）'], ['note', 'Operator Note（String）'], ['ch', 'X Position（Waveform Chart）']].forEach(function (o) { $('vtgt').appendChild(el('option', '', o[1])).value = o[0]; });
  $('vtgt').onchange = vActs; $('vact').onchange = vNode;
  $('vrun').onclick = function () { vRun(false); };
  $('vedit').onclick = function () { V.gen++; V.els.x.v = +(Math.random() * 400).toFixed(1); V.els.vac.v = !V.els.vac.v; V.els.note.v = ['夾爪更換', '換班檢查', '停機保養'][Math.floor(Math.random() * 3)]; V.els.ch.v = [0, 30, 80, 140, 210, 250, 270, 280, 279, 281].map(function (v) { return v + Math.round(Math.random() * 15); }); vDraw(); say('vsay', '前面板的值改了，再試試 Reinitialize To Default。'); };
  vDraw(); vActs();

  /* ================= 2. 類別階層 ================= */
  var CLS = {
    Generic: { up: null, f: [], note: '所有 VI Server 物件的最上層。' },
    GObject: { up: 'Generic', f: [['屬性', 'Position']], note: '前面板、方塊圖上「看得到的物件」。' },
    Decoration: { up: 'GObject', f: [], note: '裝飾（框、線、文字）：只是畫面，沒有值。' },
    Control: { up: 'GObject', f: [['屬性', 'Value'], ['屬性', 'Disabled'], ['屬性', 'Key Focus'], ['屬性', 'Label.Text'], ['方法', 'Reinitialize To Default'], ['方法', 'Get Image']], note: '前面板上的控制項和顯示元件都屬於這一類。' },
    Numeric: { up: 'Control', f: [['屬性', 'Data Range']], note: '數值控制項、顯示元件。' },
    Boolean: { up: 'Control', f: [['屬性', 'Boolean Text']], note: '開關、按鈕、LED。' },
    String: { up: 'Control', f: [['屬性', 'Display Style']], note: '字串控制項、顯示元件。' },
    'Waveform Chart': { up: 'Control', f: [['屬性', 'History Data'], ['方法', 'Export Image']], note: '波形圖表。（圖、表類在 Control 和它之間實際上還有一層共同的類別，這裡省略。）' }
  };
  var C = { sel: 'Numeric', open: { Generic: 1, GObject: 1, Control: 1 } };
  function pathOf(c) { var p = []; while (c) { p.unshift(c); c = CLS[c].up; } return p; }
  function kids(c) { return Object.keys(CLS).filter(function (k) { return CLS[k].up === c; }); }
  function isA(sub, sup) { return pathOf(sub).indexOf(sup) >= 0; }
  var LVCOL = ['#6b7280', '#0e7490', '#7c3aed', '#c2410c'];
  function cDraw() {
    var path = pathOf(C.sel);
    function node(c) {
      var ks = kids(c), open = C.open[c];
      return '<li>' + (ks.length ? '<span class="tg" data-tg="' + c + '">' + (open ? '▾' : '▸') + '</span>' : '<span class="tg"></span>') + '<button type="button" data-c="' + c + '" class="' + (c === C.sel ? 'sel' : path.indexOf(c) >= 0 ? 'path' : '') + '">' + c + '</button>' + (ks.length && open ? '<ul>' + ks.map(node).join('') + '</ul>' : '') + '</li>';
    }
    $('ctree').innerHTML = '<ul>' + node('Generic') + '</ul>';
    Array.prototype.forEach.call($('ctree').querySelectorAll('[data-c]'), function (b) { b.onclick = function () { cSel(b.dataset.c); }; });
    Array.prototype.forEach.call($('ctree').querySelectorAll('[data-tg]'), function (t) { t.onclick = function () { C.open[t.dataset.tg] = !C.open[t.dataset.tg]; cDraw(); }; });
    $('cname').textContent = C.sel;
    var feats = [];
    path.forEach(function (c, i) { CLS[c].f.forEach(function (f) { feats.push('<li><span style="color:' + LVCOL[Math.min(i, 3)] + ';font-weight:700">' + f[0] + '</span> ' + f[1] + ' <span class="lv">← ' + c + (c === C.sel ? '（自己的）' : '（繼承）') + '</span></li>'); }); });
    $('cfeat').innerHTML = feats.length ? feats.join('') : '<li>（這一層沒有列出常用的屬性或方法）</li>';
    $('cwhy').textContent = CLS[C.sel].note + '　路徑：' + path.join(' → ');
  }
  function cSel(c) { C.sel = c; pathOf(c).forEach(function (p) { C.open[p] = 1; }); cDraw(); }
  var REFS = [['Numeric', 'Target X (mm)'], ['Boolean', 'Vacuum'], ['String', 'Operator Note'], ['Waveform Chart', 'X Position'], ['Control', 'Controls[] 陣列裡的一個元素']];
  var TERMS = ['Control', 'Numeric', 'Boolean', 'String', 'GObject'];
  REFS.forEach(function (r, i) { $('cref').appendChild(el('option', '', r[1] + '（' + r[0] + ' 參考）')).value = i; });
  TERMS.forEach(function (t) { $('cterm').appendChild(el('option', '', t + ' Refnum')).value = t; });
  function cWire() {
    var r = REFS[+$('cref').value], t = $('cterm').value, ok = isA(r[0], t), up = isA(t, r[0]) && t !== r[0];
    $('cwire').innerHTML = '<span class="rchip">' + r[0] + ' 參考</span> <span class="refw' + (ok ? '' : '" style="background:repeating-linear-gradient(90deg,#111 0 5px,transparent 5px 9px)') + '"></span> <span class="rchip">' + t + ' Refnum（SubVI 輸入）</span>';
    $('cres').innerHTML = ok ? (r[0] === t ? '✔ 型別一樣，直接接。' : '✔ 可以直接接：' + r[0] + ' 是 ' + t + ' 的下層，' + t + ' 能用的屬性方法它全都有。在 SubVI 裡只能用 ' + t + ' 那一層的。') :
      up ? '✖ 斷線：' + r[0] + ' 比 ' + t + ' 上層，不保證是 ' + t + '。要先用 To More Specific Class 轉成 ' + t + '，轉不過去會出錯、輸出 Not A Refnum。' : '✖ 斷線：' + r[0] + ' 和 ' + t + ' 是不同分支，' + r[0] + ' 不是一種 ' + t + '。';
    $('cres').style.color = ok ? '#15803d' : '#dc2626';
    return ok;
  }
  $('cref').onchange = $('cterm').onchange = cWire;
  cDraw(); $('cref').value = 1; $('cterm').value = 'Numeric'; cWire();

  /* ================= 3. This VI 與 Controls[] ================= */
  var A = { gen: 0, timer: null, els: [] };
  function aInit() {
    A.els = [
      { dom: 'a0', k: 'btn', label: 'Jog X+', txt: 'X+', v: 0, def: 0 },
      { dom: 'a1', k: 'btn', label: 'Jog X-', txt: 'X-', v: 0, def: 0 },
      { dom: 'a2', k: 'num', label: 'Jog Speed (mm/s)', v: 80, def: 50 },
      { dom: 'a3', k: 'bool', label: 'Vacuum', v: true, def: false },
      { dom: 'a4', k: 'str', label: 'Operator Note', v: '手動對位中', def: '' },
      { dom: 'a5', k: 'num', label: 'Status', v: 3, def: 0, ind: true }
    ];
  }
  function aDraw(hl) {
    var fp = $('afp'), cap = fp.querySelector('.cap').outerHTML;
    fp.innerHTML = cap + A.els.map(ctlHTML).join('');
    if (hl != null && A.els[hl]) $(A.els[hl].dom).classList.add('hl');
  }
  var AFLOW = ['This VI', 'Front Panel（屬性）', 'Controls[]（屬性）', 'For Loop', '動作'];
  function aFlow(k, i, n) {
    $('aflow').innerHTML = AFLOW.map(function (s, j) { return '<span class="st' + (j < k ? ' done' : j === k ? ' on' : '') + '">' + (j === 2 && k >= 2 ? 'Controls[]：' + A.els.length + ' 個參考' : j === 3 && i != null ? 'For Loop i = ' + i + ' / N = ' + n : s) + '</span>'; }).join('<span>→</span>');
  }
  function aApply(c) {
    var act = $('aact').value;
    if (act === 'dis') c.dis = 1; else if (act === 'en') c.dis = 0; else c.v = c.def;
  }
  function aStop() { A.gen++; if (A.timer) { clearTimeout(A.timer); A.timer = null; } }
  function aRun(sync) {
    aStop();
    var g = A.gen, n = A.els.length, i = -1, k = 0, done = 0, skipped = 0;
    $('alog').innerHTML = '';
    function step() {
      if (g !== A.gen) return;
      if (k < 3) { aFlow(k, null, n); k++; A.timer = setTimeout(step, 450); return; }
      i++;
      if (i >= n) { aFlow(5, null, n); aDraw(); A.timer = null; say('asay', '✔ 迴圈跑完 ' + n + ' 圈：處理了 ' + done + ' 個' + (skipped ? '、跳過 ' + skipped + ' 個（Status）' : '') + '。不管前面板有幾個元件，程式都不用改。', 'ok'); return; }
      var c = A.els[i], skip = $('askip').checked && c.label === 'Status';
      aFlow(3, i, n);
      if (skip) { skipped++; log('alog', 'i = ' + i + '：Label.Text = "' + c.label + '" → 跳過'); }
      else { aApply(c); done++; log('alog', 'i = ' + i + '：' + c.label + ' → ' + $('aact').selectedOptions[0].textContent.replace(/^.*：/, '')); }
      aDraw(i);
      if (!skip) pulse($(c.dom), 'act', 600);
      A.timer = setTimeout(step, 550);
    }
    if (sync) { A.els.forEach(function (c) { if (!($('askip').checked && c.label === 'Status')) aApply(c); }); aDraw(); return A.els; }
    say('asay', ''); step();
    return null;
  }
  $('arun').onclick = function () { aRun(false); };
  $('areset').onclick = function () { aStop(); aInit(); aDraw(); aFlow(-1); say('asay', ''); $('alog').innerHTML = ''; };
  $('aedit').onclick = function () { A.els[2].v = 120; A.els[3].v = true; A.els[4].v = '改過了'; A.els[5].v = 7; aDraw(); };
  aInit(); aDraw(); aFlow(-1);

  /* ================= 4. VI Server ================= */
  var SV = { gen: 0, timer: null, refs: [], next: 1, fp: { d: 0, s: 0, t: 0 } };
  var SSTEPS = ['Open VI Reference', 'Ctrl Val.Set Distance', 'Ctrl Val.Set Speed', 'Run VI', 'Ctrl Val.Get Time', 'Variant To Data', 'Close Reference'];
  function sDrawFp(hl) {
    var fp = $('sfp'), cap = fp.querySelector('.cap').outerHTML, f = SV.fp;
    fp.innerHTML = cap + [{ dom: 's-d', k: 'num', label: 'Distance (mm)', v: f.d }, { dom: 's-s', k: 'num', label: 'Speed (mm/s)', v: f.s }, { dom: 's-t', k: 'num', label: 'Time (s)', v: f.t, ind: true }].map(ctlHTML).join('');
    if (hl) $(hl).classList.add('hl');
  }
  function sFlow(k, bad) { $('sflow').innerHTML = SSTEPS.map(function (s, j) { var skipClose = j === 6 && !$('sclose').checked; return '<span class="st' + (skipClose ? '' : j < k ? ' done' : j === k ? (bad ? ' bad' : ' on') : '') + '"' + (skipClose ? ' style="text-decoration:line-through;opacity:.5"' : '') + '>' + s + '</span>'; }).join('<span>→</span>'); }
  function sMem() {
    $('scnt').textContent = SV.refs.length;
    $('smem').innerHTML = SV.refs.map(function (r) { return '<span class="rchip' + (SV.refs.length > 3 ? ' leak' : '') + '">VI Ref #' + r + '</span>'; }).join('');
  }
  function sStop() { SV.gen++; if (SV.timer) { clearTimeout(SV.timer); SV.timer = null; } }
  /* 一次呼叫的所有步驟，回傳 { time, err }；fast = 不播動畫 */
  function sCall(fast, done) {
    var g = SV.gen, d = +$('sd').value || 0, sp = +$('ss').value || 0, wrong = $('stype').value === 'str', close = $('sclose').checked, ref = null, out = null, err = null, k = 0;
    var acts = [
      function () { ref = SV.next++; SV.refs.push(ref); sMem(); return '開啟 Calc_MoveTime.vi 的參考：VI Ref #' + ref; },
      function () { SV.fp.d = d; sDrawFp('s-d'); return 'Control Value ▸ Set：Control Name "Distance (mm)"，Value ' + d + '（自動轉成 Variant）'; },
      function () { SV.fp.s = sp; sDrawFp('s-s'); return 'Control Value ▸ Set：Control Name "Speed (mm/s)"，Value ' + sp; },
      function () { SV.fp.t = sp ? +(d / sp).toFixed(3) : Infinity; sDrawFp('s-t'); return 'Run VI（Wait Until Done = T）：用前面板現在的值算出 Time = ' + SV.fp.t; },
      function () { out = SV.fp.t; return 'Control Value ▸ Get：Control Name "Time (s)"，傳回 Variant'; },
      function () { if (wrong) { err = 'Variant To Data 型別不符'; return '✖ Variant To Data 指定 String，但裡面是 DBL：出錯'; } $('sout').textContent = out; return 'Variant To Data 指定 DBL：拿到 ' + out; },
      function () { if (!close) return '（沒有 Close Reference：VI Ref #' + ref + ' 留在記憶體）'; SV.refs = SV.refs.filter(function (r) { return r !== ref; }); sMem(); return 'Close Reference：關掉 VI Ref #' + ref + (err ? '（前面出錯也照樣關）' : ''); }
    ];
    function step() {
      if (g !== SV.gen) return;
      if (k >= acts.length) { if (done) done({ time: out, err: err }); return; }
      var msg = acts[k](), bad = k === 5 && err;
      if (!fast) { sFlow(k, bad); log('slog', msg); }
      k++;
      if (fast) step(); else SV.timer = setTimeout(step, 600);
    }
    step();
    return { time: out, err: err };
  }
  function sVerdict(r, n) {
    var leak = SV.refs.length;
    if (r.err) say('ssay', '✖ ' + r.err + '：Get 傳回的是 Variant，Variant To Data 要指定和控制項一樣的型別（這裡是 DBL）。', 'bad');
    else if (leak) say('ssay', (n > 1 ? '叫了 ' + n + ' 次，' : '') + '記憶體裡還開著 ' + leak + ' 個參考：開了沒關，主程式結束之前 LabVIEW 都沒辦法釋放，迴圈跑越久堆越多。', 'bad');
    else say('ssay', '✔ 拿到 Time = ' + r.time + ' s，參考也關掉了。', 'ok');
  }
  $('srun').onclick = function () { sStop(); sCall(false, function (r) { sFlow(7); sVerdict(r, 1); }); };
  $('srun10').onclick = function () { sStop(); var r; for (var i = 0; i < 10; i++) r = sCall(true); sFlow(7); log('slog', '在迴圈裡連續叫了 10 次'); sVerdict(r, 10); };
  $('sreset').onclick = function () { sStop(); SV.refs = []; SV.next = 1; SV.fp = { d: 0, s: 0, t: 0 }; $('sout').textContent = '–'; $('slog').innerHTML = ''; say('ssay', ''); sMem(); sDrawFp(); sFlow(-1); };
  $('sclose').onchange = function () { sFlow(-1); };
  sDrawFp(); sFlow(-1); sMem();

  /* ================= 分頁 ================= */
  var tabs = $('tabs');
  function stopAll() { V.gen++; aStop(); sStop(); }
  function show(t) {
    stopAll();
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['verb', 'cls', 'all', 'srv'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  if (/^#(verb|cls|all|srv)$/.test(location.hash)) show(location.hash.slice(1));

  window.InvokeLab = {
    show: show, stopAll: stopAll,
    V: function () { return V; }, vRun: vRun,
    CLS: CLS, pathOf: pathOf, isA: isA, cSel: cSel, cWire: cWire,
    A: function () { return A; }, aRun: aRun,
    SV: function () { return SV; }, sCall: sCall
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  var L = window.InvokeLab;
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function q(o) { var seen = {}; seen[o.ans] = 1; o.wrong = o.wrong.filter(function (w) { if (seen[w]) return false; seen[w] = 1; return true; }); return o; }
  var KIND = [
    function () { var t = p1([['把 Jog 按鈕反灰、不能按', 'Property Node：寫 Disabled'], ['把數值恢復成存檔時的預設值', 'Invoke Node：Reinitialize To Default'], ['讀出 Target X 現在的值', 'Property Node：讀 Value'], ['把圖表存成圖檔', 'Invoke Node：Export Image']]); return q({ q: '想要「' + t[0] + '」，用哪一個？', ans: t[1], wrong: ['Property Node：寫 Disabled', 'Invoke Node：Reinitialize To Default', 'Property Node：讀 Value', 'Invoke Node：Export Image', 'Invoke Node：Run VI'], ex: '屬性是讀寫特性（名詞），方法是叫它做一件事（動詞）。' }); },
    function () { return q({ q: '要清空 Waveform Chart 上的舊資料，常見的做法是？', ans: '寫 History Data 屬性為空陣列', wrong: ['呼叫 Export Image 方法', '呼叫 Get Image 方法', '把 Disabled 寫成 2', '把圖表的 Visible 寫成 F'], ex: 'History Data 是 Waveform Chart 的屬性，寫一個空陣列就清空了。' }); },
    function () { return q({ q: '對 Numeric 控制項呼叫 Get Image 方法，會發生什麼？', ans: '傳回元件長相的影像資料，元件本身不變', wrong: ['元件恢復成預設值', '把畫面存成檔案到桌面', '元件變灰', '讀出元件的數值'], ex: 'Get Image 只是「拍一張」元件的樣子傳回來，可以設 Image Depth。' }); },
    function () { return q({ q: '前面板的 Target X 存檔時預設值是 0，現在顯示 125.5。呼叫 Reinitialize To Default 之後顯示？', ans: '0', wrong: ['125.5', '上一次執行結束時的值', '空白', '-1'], ex: 'Reinitialize To Default 恢復成「預設值」，也就是存檔時設好的那個值。' }); },
    function () { return q({ q: 'Numeric 控制項的參考，可以用 Disabled 屬性嗎？', ans: '可以，Numeric 繼承 Control 的屬性', wrong: ['不行，Disabled 只有 Boolean 有', '要先轉成 Generic 才行', '只有在 SubVI 裡才行', '要用 Invoke Node 才行'], ex: '類別階層裡 Numeric 在 Control 底下，Control 有的屬性和方法 Numeric 全都有。' }); },
    function () { var r = p1(['Numeric', 'Boolean', 'String']); return q({ q: r + ' 控制項的參考，接到 SubVI 的 <b>Control Refnum</b> 輸入，會怎樣？', ans: '可以直接接', wrong: ['斷線', '要先用 To More Specific Class', '要先轉成 Variant', '執行時才會出錯'], ex: '下層的參考可以直接接到上層類別的輸入；在 SubVI 裡只能用 Control 那一層的屬性方法。' }); },
    function () { return q({ q: 'Boolean 控制項的參考，接到 SubVI 的 <b>Numeric Refnum</b> 輸入，會怎樣？', ans: '斷線，型別不相容', wrong: ['可以直接接', '自動轉成 Numeric', '執行時 Value 變成 0 或 1', '接得上但屬性不能用'], ex: 'Boolean 和 Numeric 是 Control 底下不同的分支，Boolean 不是一種 Numeric。' }); },
    function () { return q({ q: '從 Controls[] 拿到的是 Control 參考，想用 Numeric 才有的屬性，要先？', ans: '用 To More Specific Class 轉成 Numeric', wrong: ['什麼都不用做', '用 Variant To Data', '用 Open VI Reference', '把參考接到 Close Reference'], ex: 'To More Specific Class 把上層參考轉成下層；轉不過去（其實不是 Numeric）會出錯。' }); },
    function () { return q({ q: '<b>This VI</b> 參考代表什麼？', ans: '目前這個 VI 自己', wrong: ['主程式（最上層的 VI）', '呼叫它的那個 VI', '最近打開的一個 VI', 'LabVIEW 應用程式本身'], ex: 'This VI 是放這個常數的那個 VI 自己的參考，常接 Front Panel 屬性拿到前面板。' }); },
    function () { return q({ q: '前面板參考的 <b>Controls[]</b> 屬性傳回什麼？', ans: '前面板上控制項和顯示元件的參考陣列', wrong: ['只有控制項，沒有顯示元件', '所有控制項現在的值', '方塊圖上所有節點', '前面板的截圖'], ex: 'Controls[] 是參考陣列，控制項和顯示元件都在裡面，常接進 For Loop 一個一個處理。' }); },
    function () { return q({ q: 'Control Value ▸ Get 傳回的值是什麼型別？', ans: 'Variant，要用 Variant To Data 轉回來', wrong: ['自動和控制項同型別', '一律是字串', '一律是 DBL', '叢集'], ex: '因為可以讀任何控制項，所以傳回 Variant；Variant To Data 指定型別，型別不對會出錯。' }); },
    function () { return q({ q: 'Control Value ▸ Set 用什麼指定要寫哪一個控制項？', ans: '控制項的名稱（標籤文字）', wrong: ['控制項在前面板的位置', '控制項的編號 0、1、2', '控制項的資料型別', 'Tab 順序'], ex: 'Control Name 輸入接標籤文字，打錯字就找不到而出錯。' }); },
    function () { return q({ q: 'Run VI 的 Wait Until Done 設成 True 代表？', ans: '等被叫的 VI 跑完才往下執行', wrong: ['VI 會一直重複執行', '跑完後自動關掉參考', '先等使用者按 Run', '只執行一圈迴圈'], ex: '設 True 才能在後面立刻用 Get 讀到算好的結果。' }); },
    function () { return q({ q: '在 While Loop 裡每圈都 Open VI Reference，卻忘了 Close Reference，會怎樣？', ans: '參考越堆越多，記憶體越用越多', wrong: ['沒有影響', 'VI 斷線不能執行', '第二圈就出錯停止', 'LabVIEW 會自動在下一圈關掉'], ex: '沒關的參考在開它的 VI 結束之前沒辦法釋放。每開一個參考就要關一個；開在迴圈裡的，也要在迴圈裡關。' }); },
    function () { return q({ q: 'Run VI 方法的 Wait Until Done、Auto Dispose Ref 沒有接線時，預設值是？', ans: 'Wait Until Done = TRUE、Auto Dispose Ref = FALSE', wrong: ['兩個都是 FALSE', '兩個都是 TRUE', 'Wait Until Done = FALSE、Auto Dispose Ref = TRUE', '沒接會斷線'], ex: '預設會等被叫的 VI 跑完；參考不會自動釋放，要自己 Close Reference。' }); },
    function () { return q({ q: '前面板有一個叢集（裡面 3 個數值）和 2 個按鈕，Controls[] 陣列有幾個元素？', ans: '3 個（叢集本身算 1 個）', wrong: ['5 個（叢集展開成 3 個）', '2 個（叢集不算）', '6 個', '1 個'], ex: 'Controls[] 只回傳直接放在面板上的元件，叢集回傳它本身，不展開。' }); },
    function () { return q({ q: '對一個 Numeric 控制項的參考，可以呼叫 Export Image 方法嗎？', ans: '不行，Export Image 是圖表類（Graph／Chart）的方法', wrong: ['可以，所有控制項都有', '可以，但只能存 PNG', '要先轉成 Generic', '可以，用 Property Node 呼叫'], ex: '控制項通用的方法是 Reinitialize To Default、Get Image 這類；Export Image 屬於圖表類別。' }); },
    function () { return q({ q: '用 VI Server 叫另一個 VI 計算，正確的順序是？', ans: 'Open VI Reference → Set → Run VI → Get → Close Reference', wrong: ['Run VI → Open VI Reference → Get → Close Reference', 'Open VI Reference → Run VI → Set → Get → Close Reference', 'Set → Open VI Reference → Run VI → Get', 'Open VI Reference → Get → Set → Run VI → Close Reference'], ex: '先有參考才能操作；輸入要在 Run 之前設好，輸出要在 Run 之後讀。' }); },
    function () { return q({ q: 'Variant To Data 要轉的型別指定錯了（裡面是 DBL，卻指定 String），結果？', ans: '出錯，拿不到正確的值', wrong: ['自動轉成數字字串', '傳回 0', '傳回空字串，沒有錯誤', 'VI 斷線不能執行'], ex: 'Variant To Data 的 type 要和 Variant 裡的資料型別一致。' }); },
    function () { var c = p1(['Numeric', 'Boolean', 'String', 'Waveform Chart']); var path = L.pathOf(c); return q({ q: c + ' 類別往上數，正確的繼承路徑是？', ans: path.join(' → '), wrong: ['Generic → Control → GObject → ' + c, c + ' → Control → GObject → Generic', 'Generic → GObject → Decoration → ' + c, 'GObject → Generic → Control → ' + c], ex: '最上層是 Generic，接著 GObject、Control，再往下才是各種控制項。' }); }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) L.quiz = window.LabQuiz('iquiz', gen);
  L.quizGen = gen; L.quizKinds = KIND;
})();
