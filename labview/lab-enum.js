/* Enum 實驗室：Enum vs Ring 接 Case、Type Def 新增選項、Type Def vs Strict、字串 vs Enum 狀態機、猜一猜 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function slowF() { return $('slow') && $('slow').checked ? 2.2 : 1; }

  /* 換分頁或重來時 RUN 加一，舊的回呼看到就停 */
  var RUN = 0;
  function wait(ms, my) { return new Promise(function (res, rej) { setTimeout(function () { if (my !== RUN) rej('cancel'); else res(); }, ms * slowF()); }); }
  function fly(a, b, text, my) {
    return new Promise(function (done, rej) {
      if (!a || !b) return done();
      var dur = Math.round(500 * slowF()), r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
      var f = document.createElement('div'); f.className = 'fly'; f.textContent = text;
      f.style.cssText = 'left:' + r1.left + 'px;top:' + r1.top + 'px;height:26px;transition-duration:' + dur + 'ms';
      $('layer').appendChild(f);
      setTimeout(function () { f.style.left = r2.left + 'px'; f.style.top = r2.top + 'px'; }, 30);
      setTimeout(function () { f.remove(); if (my !== RUN) rej('cancel'); else done(); }, dur + 60);
    });
  }
  function caught(e) { if (e !== 'cancel') throw e; }
  function distinct(ans, list) { var seen = {}; seen[ans] = 1; return list.filter(function (w) { if (seen[w]) return false; seen[w] = 1; return true; }); }

  var MODES = ['手動', '自動', '原點復歸', '急停'];
  var ACTS = ['開放手動按鈕', '執行自動循環', '兩軸回原點', '停止所有輸出'];
  var RINGV = [10, 20, 30, 99];

  /* ---------- 分頁 ---------- */
  var TABS = ['er', 'add', 'strict', 'sm'];
  function show(t) {
    RUN++;
    Array.prototype.forEach.call($('layer').children, function (f) { f.remove(); });
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    TABS.forEach(function (k) { $('t-' + k).hidden = k !== t; });
    SM.running = false;
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* =====================================================================
     1. Enum vs Ring
     ===================================================================== */
  var ER = { sel: 2 };
  function ringVal(i) { return $('ringcustom').checked ? RINGV[i] : i; }
  /* 純函式：Ring 的值 v 走 Case 的哪一頁（列出的值，否則 Default） */
  function ringCase(v, listed) { var k = listed.indexOf(v); return k >= 0 ? k : -1; }
  function renderER() {
    $('pick').innerHTML = MODES.map(function (m, i) { return '<button type="button" data-i="' + i + '"' + (i === ER.sel ? ' class="here"' : '') + '>' + m + '</button>'; }).join('');
    var rv = MODES.map(function (_, i) { return ringVal(i); });
    $('laneE').innerHTML = '<h3>Enum</h3><span class="ctlk" id="eC">' + MODES[ER.sel] + '</span><div class="wirep"><i></i>線上帶著：值 ' + ER.sel + ' ＋ 項目清單（文字是型別的一部分）</div>' +
      '<div class="cs"><div class="sel">' + MODES.map(function (m, i) { return '<span id="eT' + i + '">"' + m + '"</span>'; }).join('') + '</div><div class="body" id="eB">…</div></div>' +
      '<div class="row">接到數值顯示元件：<span class="ind" id="eN">?</span></div>';
    $('laneR').innerHTML = '<h3>Ring</h3><span class="ctlk ring" id="rC">' + MODES[ER.sel] + '</span><div class="wirep"><i></i>線上只有數字 ' + rv[ER.sel] + '（文字只在前面板顯示）</div>' +
      '<div class="cs"><div class="sel">' + rv.map(function (v, i) { return '<span id="rT' + i + '">' + v + '</span>'; }).join('') + '<span id="rTd">Default</span></div><div class="body" id="rB">…</div></div>' +
      '<div class="row">接到數值顯示元件：<span class="ind" id="rN">?</span></div>';
  }
  async function runER() {
    var my = ++RUN, i = ER.sel, rv = ringVal(i), listed = MODES.map(function (_, k) { return ringVal(k); }), rk = ringCase(rv, listed);
    renderER();
    try {
      await Promise.all([fly($('eC'), $('eT' + i), '"' + MODES[i] + '"', my), fly($('rC'), rk >= 0 ? $('rT' + rk) : $('rTd'), String(rv), my)]);
      $('eT' + i).classList.add('on'); $('eB').textContent = '"' + MODES[i] + '" 這一頁：' + ACTS[i];
      (rk >= 0 ? $('rT' + rk) : $('rTd')).classList.add('on'); $('rB').textContent = rv + ' 這一頁：' + ACTS[i] + '（頁籤上看不出是哪個模式，要靠註解）';
      await Promise.all([fly($('eC'), $('eN'), String(i), my), fly($('rC'), $('rN'), String(rv), my)]);
      $('eN').textContent = i; $('rN').textContent = rv;
      $('ersay').className = 'verdict-line ok';
      $('ersay').textContent = '選「' + MODES[i] + '」：Enum 的 Case 頁籤寫著 "' + MODES[i] + '"，數值顯示元件看到 ' + i + '；Ring 的頁籤是 ' + rv + '，數值顯示元件看到 ' + rv + '。' + ($('ringcustom').checked ? 'Ring 的值是自訂的，Enum 做不到。' : '');
    } catch (e) { caught(e); }
  }
  $('pick').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { ER.sel = +b.dataset.i; runER(); } });
  $('ringcustom').onchange = runER;
  renderER();

  /* =====================================================================
     2. Type Def 新增一個選項
     ===================================================================== */
  var A = {};
  function aReset() { A = { ctl: MODES.slice(), main: MODES.slice(), tabs: MODES.slice(), panel: MODES.slice(), ring: MODES.slice(), added: false, busy: false }; }
  aReset();
  function mainBroken() { return A.main.some(function (m) { return A.tabs.indexOf(m) < 0; }); }
  function items(list, pre, newOne) { return '<div class="items">' + list.map(function (m, i) { return '<span id="' + pre + i + '"' + (m === newOne ? ' class="new"' : '') + '>' + i + ' ' + m + '</span>'; }).join('') + '</div>'; }
  function renderAdd(hideNew) {
    var nw = A.added ? '保養' : null, br = mainBroken();
    $('actl').innerHTML = '<b>MachineMode.ctl（Type Def，Enum）</b>' + items(A.ctl, 'ac', nw);
    $('avis').innerHTML =
      '<div class="vi" id="vMain"><h4>GT_Main.vi <span class="arrow' + (br ? ' broken' : '') + '" title="' + (br ? '執行箭頭斷掉' : '可執行') + '">➡</span></h4><div class="why" style="margin:0">◤ Type Def 的 Enum 常數</div>' + items(A.main, 'am', nw) +
        '<div class="cs"><div class="sel">' + A.tabs.map(function (m, i) { return '<span id="amt' + i + '"' + (m === nw ? ' class="new"' : '') + '>"' + m + '"</span>'; }).join('') + '</div><div class="body" id="amB">' + (br ? '<span class="bad">"保養" 沒有對應的頁、也沒有 Default → 執行箭頭斷掉</span>' : '每個值都有頁，不需要 Default') + '</div></div></div>' +
      '<div class="vi old" id="vPanel"><h4>GT_Panel.vi <span class="arrow">➡</span></h4><div class="why" style="margin:0">一般 Enum 常數（沒連 Type Def）</div>' + items(A.panel, 'ap', null) + '<p class="note" id="apN">' + (A.added ? '還是舊的四個選項，選不到「保養」，而且和 Type Def 已經不是同一個型別。' : '和 .ctl 長得一樣，但只是複本。') + '</p></div>' +
      '<div class="vi" id="vOld"><h4>GT_Old.vi <span class="arrow">➡</span></h4><div class="why" style="margin:0">Ring（數字）</div>' + items(A.ring, 'ar', nw) +
        '<div class="cs"><div class="sel">' + [0, 1, 2, 3].map(function (v) { return '<span id="art' + v + '">' + v + '</span>'; }).join('') + '<span id="artd">Default</span></div><div class="body" id="arB">Default：其他值，不做事</div></div></div>';
    if (hideNew) ['am4', 'ar4'].forEach(function (id) { if ($(id)) $(id).style.visibility = 'hidden'; });
  }
  $('aadd').onclick = async function () {
    if (A.added) { $('asay').textContent = '已經加過了，按重設再試一次。'; return; }
    var my = ++RUN;
    A.added = true; A.ctl.push('保養'); A.main.push('保養'); A.ring.push('保養');
    renderAdd(true);
    try {
      await wait(250, my);
      await fly($('ac4'), $('am4'), '4 保養', my); $('am4').style.visibility = '';
      await fly($('ac4'), $('ar4'), '同事手動加 4 保養', my); $('ar4').style.visibility = '';
      $('asay').className = 'verdict-line bad';
      $('asay').textContent = 'GT_Main 的常數自動多了「保養」，Case 沒有這一頁也沒有 Default，執行箭頭立刻斷掉（編輯時就抓到）。GT_Panel 的常數停在舊清單。GT_Old 的 Ring 箭頭還是好的，看起來沒事。';
    } catch (e) { caught(e); renderAdd(false); }
  };
  $('aall').onclick = async function () {
    if (!A.added) { $('asay').className = 'verdict-line'; $('asay').textContent = '每個值都已經有頁了。先在 .ctl 加「保養」。'; return; }
    if (!mainBroken()) { $('asay').textContent = '已經補齊了。'; return; }
    var my = ++RUN;
    A.tabs.push('保養'); renderAdd(false);
    $('amt4').style.visibility = 'hidden';
    try {
      await fly($('am4'), $('amt4'), '新增 "保養" 頁', my); $('amt4').style.visibility = '';
      $('asay').className = 'verdict-line ok';
      $('asay').textContent = 'Add Case for Every Value 幫每個還沒有頁的值各加一頁（這裡是 "保養"），箭頭接回來了，接著在新頁裡寫保養模式要做的事。';
    } catch (e) { caught(e); renderAdd(false); }
  };
  $('arun').onclick = async function () {
    var my = ++RUN; renderAdd(false);
    var hasNew = A.added, msg = [];
    try {
      if (!hasNew) { $('asay').className = 'verdict-line'; $('asay').textContent = '還沒有「保養」這個選項，先在 .ctl 加。'; return; }
      if (mainBroken()) msg.push('GT_Main：執行箭頭斷掉，根本不能跑，要先補 Case。');
      else { await fly($('am4'), $('amt4'), '"保養"', my); $('amt4').classList.add('on'); $('amB').textContent = '"保養" 這一頁：進入保養模式'; msg.push('GT_Main：走 "保養" 這一頁。'); }
      msg.push('GT_Panel：選單裡沒有「保養」，選不到。');
      await fly($('ar4'), $('artd'), '4', my); $('artd').classList.add('on'); $('arB').textContent = 'Default：其他值，不做事 ← 值 4 跑到這裡';
      msg.push('GT_Old：Ring 送出 4，Case 沒有 4 這一頁，默默走 Default，機台沒反應，也沒有任何錯誤。');
      $('asay').className = 'verdict-line'; $('asay').textContent = msg.join(' ');
    } catch (e) { caught(e); }
  };
  $('areset').onclick = function () { RUN++; aReset(); renderAdd(false); $('asay').textContent = ''; };
  renderAdd(false);

  /* =====================================================================
     3. Type Def vs Strict Type Def
     ===================================================================== */
  var DEFC = '#f3f4f6', S = {};
  function sReset() {
    S = { kind: $('skind').value, ctl: { color: DEFC, items: MODES.slice() } };
    ['TD', 'ST'].forEach(function (k) { S[k] = { ctl: { color: DEFC, items: MODES.slice() }, inst: [{ vi: 'GT_Main.vi', color: DEFC, items: MODES.slice() }, { vi: 'GT_Auto.vi', color: DEFC, items: MODES.slice() }] }; });
  }
  sReset();
  /* 純函式：這個改變會不會同步到實例？kind = enum/ring，what = color/item，strict = true/false */
  function syncs(kind, what, strict) { if (strict) return true; return what === 'item' && kind === 'enum'; }
  function instHtml(k, i, it) { return '<div class="inst"><div class="why" style="margin:0">' + it.vi + '</div><div class="fpc" id="s' + k + i + '" style="background:' + it.color + '"><b>運轉模式</b><span class="v">' + esc(it.items[0]) + '</span></div><div class="items">' + it.items.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + '</div></div>'; }
  function renderS() {
    ['TD', 'ST'].forEach(function (k) {
      var g = S[k];
      $('s' + k).innerHTML = '<div class="inst" style="border-width:2px"><div class="why" style="margin:0">MachineMode.ctl（' + (k === 'TD' ? 'Type Def' : 'Strict Type Def') + '，' + (S.kind === 'enum' ? 'Enum' : 'Ring') + '）</div><div class="fpc" id="s' + k + 'c" style="background:' + g.ctl.color + '"><b>運轉模式</b><span class="v">' + esc(g.ctl.items[0]) + '</span></div><div class="items">' + g.ctl.items.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + '</div></div>' +
        g.inst.map(function (it, i) { return instHtml(k, i, it); }).join('');
    });
  }
  async function ctlChange(what, apply, label) {
    var my = ++RUN;
    ['TD', 'ST'].forEach(function (k) { apply(S[k].ctl); });
    renderS();
    var msgs = [];
    try {
      for (var k of ['TD', 'ST']) {
        var strict = k === 'ST', ok = syncs(S.kind, what, strict);
        for (var i = 0; i < 2; i++) {
          if (!ok) continue;
          await fly($('s' + k + 'c'), $('s' + k + i), label, my);
          apply(S[k].inst[i]); renderS();
        }
        msgs.push((strict ? 'Strict Type Def' : 'Type Def') + '：' + (ok ? '兩個實例都更新了' : '實例沒有更新'));
      }
      var why = what === 'color' ? '顏色是外觀，只有 Strict 同步。' : S.kind === 'enum' ? 'Enum 的項目是資料型別的一部分，兩種都同步。' : 'Ring 的項目文字不是資料型別（Ring 的型別只是數字），只有 Strict 會同步文字。';
      $('ssay').className = 'verdict-line'; $('ssay').textContent = msgs.join('；') + '。' + why;
    } catch (e) { caught(e); }
  }
  $('scolor').onclick = function () { ctlChange('color', function (o) { o.color = '#fed7aa'; }, '橘底'); };
  $('sitem').onclick = function () { ctlChange('item', function (o) { if (o.items.indexOf('保養') < 0) o.items.push('保養'); }, '+ 保養'); };
  $('srename').onclick = function () { ctlChange('item', function (o) { o.items = o.items.map(function (m) { return m === '急停' ? '緊急停止' : m; }); }, '急停 → 緊急停止'); };
  $('slocal').onclick = function () {
    RUN++;
    S.TD.inst[0].color = '#bfdbfe'; renderS();
    $('ssay').className = 'verdict-line';
    $('ssay').textContent = 'Type Def：GT_Main 的這個控制項改成藍底了，只影響這一個，.ctl 和 GT_Auto 不變。Strict Type Def：不能在使用的地方自己改外觀，要改就得改 .ctl，所有地方一起變。';
  };
  $('skind').onchange = function () { RUN++; sReset(); renderS(); $('ssay').textContent = ''; };
  $('sreset').onclick = $('skind').onchange;
  renderS();

  /* =====================================================================
     4. 字串 vs Enum 狀態
     ===================================================================== */
  var STATES = ['待機', '原點復歸', '自動'];
  var SM = { running: false };
  /* 純函式：字串 Case 走哪一頁（完全相同才算，否則 Default） */
  function strCase(s) { var k = STATES.indexOf(s); return k >= 0 ? k : -1; }
  function smBoxes(pre) { return STATES.map(function (s, i) { return '<div class="st" id="' + pre + i + '">' + s + '</div>'; }).join('') + '<div class="st def" id="' + pre + 'd">Default</div>'; }
  function renderSM() { $('smS').innerHTML = smBoxes('ss'); $('smE').innerHTML = smBoxes('se'); }
  function logTo(id, s) { var d = document.createElement('div'); d.textContent = s; $(id).appendChild(d); $(id).scrollTop = 1e6; }
  function lit(pre, k) { Array.prototype.forEach.call(document.querySelectorAll('[id^="' + pre + '"]'), function (e) { e.classList.remove('on'); }); var e = $(pre + (k < 0 ? 'd' : k)); if (e) e.classList.add('on'); }
  async function runSM() {
    var my = ++RUN; SM.running = true;
    renderSM(); $('logS').innerHTML = ''; $('logE').innerHTML = '';
    var typo = $('typo').value, sS = '待機', sE = 0, stuck = 0;
    var nextS = { '待機': typo, '原點復歸': '自動', '自動': '待機' };
    try {
      for (var step = 1; step <= 12 && SM.running; step++) {
        var k = strCase(sS);
        lit('ss', k); lit('se', sE);
        if (k < 0) { logTo('logS', step + '. 「' + JSON.stringify(sS).slice(1, -1) + '」對不到任何頁 → Default：不認得，回待機'); sS = '待機'; stuck++; }
        else { logTo('logS', step + '. ' + STATES[k] + ' → 下一個 "' + nextS[sS] + '"'); sS = nextS[sS]; }
        logTo('logE', step + '. ' + STATES[sE] + ' → 下一個 ' + STATES[(sE + 1) % 3]); sE = (sE + 1) % 3;
        await wait(700, my);
      }
      $('smsay').className = 'verdict-line' + (stuck ? ' bad' : ' ok');
      $('smsay').textContent = stuck ? '字串版本掉進 Default ' + stuck + ' 次，永遠到不了「原點復歸」和「自動」，可是程式沒有任何錯誤訊息。Enum 版本照順序跑。' : '字串打對了，兩邊跑起來一樣。但只要有人改錯一個字，就會像其他選項那樣卡住。';
    } catch (e) { caught(e); }
    SM.running = false;
  }
  $('smrun').onclick = runSM;
  $('smstop').onclick = function () { RUN++; SM.running = false; $('smsay').textContent = '停止。'; };
  $('smtry').onclick = function () { $('smsay').className = 'verdict-line ok'; $('smsay').textContent = 'Enum 常數是下拉選單，只能選「待機」「原點復歸」「自動」，打不進 "原点復歸"。不存在的狀態在編輯時就不可能出現。'; };
  renderSM();

  if (/^#(er|add|strict|sm)$/.test(location.hash)) show(location.hash.slice(1));

  /* =====================================================================
     5. 猜一猜
     ===================================================================== */
  var GENS = [
    function () { var ans = '"手動"、"自動"、"原點復歸"、"急停"'; return { q: '「運轉模式」<b>Enum</b>（手動、自動、原點復歸、急停）接到 Case 結構的選擇器，頁籤會顯示？', ans: ans, wrong: distinct(ans, ['0、1、2、3', '0、1、2、3、Default', 'True、False', '"0"、"1"、"2"、"3"']), ex: 'Enum 的項目文字是型別的一部分，頁籤直接顯示項目名稱。' }; },
    function () { var ans = '數字（例如 0、1、2、3），通常還要 Default'; return { q: '同樣四個選項做成 <b>Ring</b>，接到 Case 結構，頁籤會顯示？', ans: ans, wrong: distinct(ans, ['"手動"、"自動"、"原點復歸"、"急停"', 'True、False', '不能接，箭頭斷掉']), ex: 'Ring 線上只有數字，Case 把它當數字選擇器。' }; },
    function () { var i = Math.floor(Math.random() * 4), ans = String(i); return { q: 'Enum「運轉模式」選了「' + MODES[i] + '」（清單順序：手動、自動、原點復歸、急停），接到數值顯示元件會看到？', ans: ans, wrong: distinct(ans, ['0', '1', '2', '3', String(i + 1), '"' + MODES[i] + '"']), ex: 'Enum 底下是整數，從 0 開始依序編號：' + MODES[i] + ' = ' + i + '。' }; },
    function () { var i = Math.floor(Math.random() * 4), ans = String(RINGV[i]); return { q: 'Ring 的值設成：手動 = 10、自動 = 20、原點復歸 = 30、急停 = 99。選「' + MODES[i] + '」時，線上的值是？', ans: ans, wrong: distinct(ans, [String(i), '10', '20', '30', '99', String(i + 1)]), ex: 'Ring 的每個項目可以自訂值，適合對應硬體代碼。Enum 做不到，Enum 一定是 0、1、2…。' }; },
    function () { var ans = '只能是 0、1、2…連續編號'; return { q: 'Enum 項目的數值可以怎麼設定？', ans: ans, wrong: distinct(ans, ['每個項目可以自訂任意值', '只能是 1、2、3…', '只能是 2 的次方']), ex: '要自訂值（例如 10、20、99）用 Ring。' }; },
    function () { var ans = '執行箭頭斷掉，要補一頁或加 Default'; return { q: 'Type Def 的 Enum 新增了「保養」。用它接的 Case 原本每個值都有頁、沒有 Default，現在會？', ans: ans, wrong: distinct(ans, ['自動新增一頁', '「保養」自動走第一頁', '執行時才跳出錯誤', '沒有任何影響']), ex: 'Enum 的 Case 要涵蓋每個值或有 Default。右鍵 Add Case for Every Value 可以一次補齊。' }; },
    function () { var ans = '默默走 Default，不會有錯誤'; return { q: 'Ring 加了一個新值 4，接的 Case 有 0～3 和 Default。選新值執行會？', ans: ans, wrong: distinct(ans, ['執行箭頭斷掉', '自動新增 4 這一頁', '跳出錯誤對話框']), ex: 'Ring 是數字，Case 不知道「你又多了一個選項」，只會照數字找頁，找不到就走 Default。' }; },
    function () { var ans = '停在舊清單，選不到新選項'; return { q: '一個<b>沒連 Type Def</b> 的 Enum 常數（從 .ctl 複製來的），.ctl 加了新選項之後會？', ans: ans, wrong: distinct(ans, ['自動多出新選項', '自動變成 Ring', '自動連到 Type Def']), ex: '沒連 Type Def 的常數只是當時的複本。所以會在 VI 之間傳的 Enum 一律做成 Type Def。' }; },
    function () { var ans = '只有 Strict Type Def 的實例變色'; return { q: '把 .ctl 的底色改成橘色。用一般 Type Def 和 Strict Type Def 的前面板控制項會？', ans: ans, wrong: distinct(ans, ['兩種都變色', '兩種都不變', '只有一般 Type Def 變色']), ex: '顏色是外觀。一般 Type Def 只同步資料型別，Strict 連外觀也同步。' }; },
    function () { var ans = '不會，只有 Strict Type Def 才同步 Ring 的文字'; return { q: 'Ring 做成<b>一般 Type Def</b>，在 .ctl 把「急停」改成「緊急停止」，用到它的控制項顯示的文字會跟著改嗎？', ans: ans, wrong: distinct(ans, ['會，Type Def 什麼都同步', '會，而且值也變了', '不會，Strict 也不會']), ex: 'Ring 的型別只是數字，項目文字不是型別的一部分，要 Strict Type Def 才同步。Enum 不一樣，項目是型別的一部分，一般 Type Def 就會同步。' }; },
    function () { var ans = '在使用的地方不能自己改外觀'; return { q: 'Strict Type Def 和一般 Type Def 相比，使用的地方多了什麼限制？', ans: ans, wrong: distinct(ans, ['不能接線', '不能當常數用', '不能放在 Cluster 裡']), ex: 'Strict 連外觀都由 .ctl 決定，要改外觀就改 .ctl，所有地方一起變。' }; },
    function () { var ans = '走 Default，狀態機卡住但不報錯'; return { q: '字串狀態機，下一個狀態常數打成 "原点復歸"（點字打成简体），Case 有 "原點復歸" 這頁和 Default，會？', ans: ans, wrong: distinct(ans, ['走 "原點復歸" 那一頁', '執行箭頭斷掉', '跳出錯誤對話框']), ex: '字串要完全一樣才對得到頁。Enum 常數只能從清單選，不會有這種錯字。' }; },
    function () { var ans = 'Type Def 的 Enum'; return { q: '狀態機的「狀態」最適合用什麼型別？', ans: ans, wrong: distinct(ans, ['字串', 'Ring', 'DBL', '沒有 Type Def 的 Enum']), ex: 'Enum 讓 Case 頁籤顯示狀態名稱、漏掉的狀態會斷箭頭；做成 Type Def 後新增狀態，所有常數一起更新。' }; },
    function () { var ans = 'Add Case for Every Value'; return { q: 'Enum 接的 Case 少了幾個值的頁，右鍵 Case 結構選哪個可以一次補齊？', ans: ans, wrong: distinct(ans, ['Add Case After', 'Duplicate Case', 'Make This The Default Case', 'Remove Empty Case']), ex: 'Add Case for Every Value 幫每個還沒有頁的值各加一頁。' }; }
  ];
  function gen() { return pickOne(GENS)(); }

  window.EnumLab = {
    MODES: MODES, RINGV: RINGV, ringCase: ringCase, strCase: strCase, syncs: syncs, show: show, runER: runER, runSM: runSM,
    state: { er: ER, add: function () { return A; }, strict: function () { return S; }, sm: SM }, GENS: GENS, gen: gen,
    quiz: window.LabQuiz ? window.LabQuiz('equiz', gen) : null
  };
})();
