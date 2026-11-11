/* 佇列實驗室：Queue 基本、Queue／Notifier／Local Variable 比較、Producer/Consumer 關閉順序 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function log(id, s) { var l = $(id); l.insertBefore(el('div', '', s), l.firstChild); }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function chip(txt, sub, cls) { return '<span class="chip' + (cls ? ' ' + cls : '') + '">' + txt + (sub != null ? '<small>' + sub + '</small>' : '') + '</span>'; }
  function flow(id, names, state) { $(id).innerHTML = names.map(function (n, i) { return '<span class="' + (state[i] || '') + '">' + n + '</span>'; }).join(''); }   // style.css 的 .flow 會自己加箭頭
  function reading(n) { return 20 + (n * 7) % 11; }   // 假裝是 PLC D0 的溫度

  var tabs = $('tabs');
  function show(t) {
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['basic', 'cmp', 'stop'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* ================= 1. Queue 基本 ================= */
  var B;
  function bNew() {
    if (B) clearInterval(B.timer);
    B = { t: 0, obtained: false, released: false, timer: null, max: +$('bmax').value, q: [], next: 1,
      prod: { st: 'idle', due: 0, hold: null, err: '' }, cons: { st: 'deq', since: 0, due: 0, cur: null, to: false, err: '' },
      saved: 0, timeouts: 0, lost: [], inId: null, takeId: null };
    $('blog').innerHTML = ''; say('bsay', '');
    $('bmax').disabled = false;
    bDraw();
  }
  function pint() { return +$('bpint').value; }
  function cint() { return +$('bcint').value; }
  function tmo() { return +$('btmo').value; }
  function full() { return B.max > 0 && B.q.length >= B.max; }
  function mkItem() { var n = B.next++; return { id: n, v: reading(n) }; }
  function bObtain() {
    if (B.obtained) return;
    B.max = +$('bmax').value; B.obtained = true; $('bmax').disabled = true;
    B.cons.since = B.t;
    log('blog', 'Obtain Queue：建立佇列，max queue size = ' + B.max + (B.max < 0 ? '（不限）' : '') + '，資料型別是數值（溫度）。拿到一條佇列參考線，接給兩個迴圈。');
    bDraw();
  }
  function bTryEnq(item) {
    if (full()) { B.prod.st = 'block'; B.prod.hold = item; log('blog', '生產者：讀到 #' + item.id + '（' + item.v + '℃），Enqueue 時佇列已滿（' + B.q.length + '/' + B.max + '）→ <b>停在 Enqueue 等空位</b>'); return false; }
    B.q.push(item); B.inId = item.id;
    log('blog', '生產者：Enqueue #' + item.id + '（' + item.v + '℃），佇列現在 ' + B.q.length + ' 筆');
    return true;
  }
  function bEnq() {
    if (!B.obtained || B.released) return;
    if (B.prod.st === 'block') { say('bsay', '生產者還卡在上一個 Enqueue（佇列滿），這一筆根本還沒輪到。', 'bad'); return; }
    if (bTryEnq(mkItem()) && $('bpmode').value === 'timer') B.prod.due = B.t + pint();
    bDraw();
  }
  function bTick(dt) {
    dt = dt || 100;
    if (!B.obtained || B.released) return;
    B.t += dt;
    var c = B.cons, p = B.prod, T = tmo();
    // 消費者
    if ($('bpause').checked) { if (c.st === 'deq') c.since = B.t; }
    else {
      if (c.st === 'busy' && B.t >= c.due) { B.saved++; log('blog', '消費者：#' + c.cur.id + ' 寫進檔案了（共 ' + B.saved + ' 筆），回到 Dequeue'); c.st = 'deq'; c.since = B.t; }
      if (c.st === 'deq') {
        if (B.q.length) { var it = B.q.shift(); c.cur = it; c.to = false; c.st = 'busy'; c.due = B.t + cint(); B.takeId = it.id; log('blog', '消費者：Dequeue 拿到 #' + it.id + '（' + it.v + '℃），timed out? = False，開始寫檔'); }
        else if (T >= 0 && B.t - c.since >= T) { c.to = true; c.cur = { id: 0, v: 0, dflt: true }; B.timeouts++; c.since = B.t; B.takeId = 0; log('blog', '消費者：等了 ' + T + ' ms 沒資料 → timed out? = <b>True</b>，element = 0（預設值）。這圈不寫檔，繼續下一圈'); }
      }
    }
    // 生產者
    if (p.st === 'block') {
      if (!full()) { var h = p.hold; p.hold = null; B.q.push(h); B.inId = h.id; p.st = $('bpmode').value === 'timer' ? 'wait' : 'idle'; p.due = B.t + pint(); log('blog', '生產者：有空位了，卡住的 Enqueue 把 #' + h.id + ' 放進去，迴圈才繼續'); }
    } else if ($('bpmode').value === 'timer') {
      if (p.st !== 'wait') { p.st = 'wait'; p.due = B.t + pint(); }
      else if (B.t >= p.due) { if (bTryEnq(mkItem())) p.due = B.t + pint(); }
    } else p.st = 'idle';
    bDraw();
  }
  function bRelease() {
    if (!B.obtained || B.released) return;
    clearInterval(B.timer); B.timer = null;
    B.released = true; B.lost = B.q.slice(); if (B.prod.hold) B.lost.push(B.prod.hold);
    var c = B.cons, p = B.prod;
    if (p.st === 'block') p.err = 'Enqueue 正在等空位時佇列被 Release → 錯誤 <b>1122</b>，迴圈停止。手上的 #' + p.hold.id + ' 沒送出。';
    else p.err = '迴圈停止（之後再呼叫 Enqueue 也只會得到錯誤，參考已無效）。';
    if ($('bpause').checked) c.err = '下次呼叫 Dequeue 時佇列參考已無效 → 出錯，迴圈停止。';
    else if (c.st === 'deq') c.err = '正在 Dequeue 等資料時佇列被 Release → 錯誤 <b>1122</b>，等待立刻結束，用錯誤停掉迴圈。';
    else { B.saved++; c.err = '手上的 #' + c.cur.id + ' 已經拿出來了，會寫完；回到 Dequeue 時參考已無效 → 出錯，迴圈停止。'; }
    log('blog', 'Release Queue：佇列被銷毀' + (B.lost.length ? '，裡面還沒處理的 ' + B.lost.map(function (x) { return '#' + x.id; }).join('、') + ' 一起消失' : '') + '。');
    bDraw();
  }
  function bDraw() {
    var c = B.cons, p = B.prod, run = !!B.timer, T = tmo();
    flow('bflow', ['① Obtain Queue', '② Enqueue（生產者迴圈）', '③ Dequeue（消費者迴圈）', '④ Release Queue'],
      !B.obtained ? ['on'] : B.released ? ['done', 'done', 'done', 'on'] : ['done', 'on', 'on', '']);
    // 生產者
    var ph = '<h3>生產者迴圈：讀 D0</h3><div class="st">';
    if (!B.obtained) ph += '還沒有佇列，Enqueue 沒東西可放。';
    else if (B.released) ph += p.err;
    else if (p.st === 'block') ph += '<b style="color:#dc2626">Enqueue 等待中</b>：佇列滿了（' + B.q.length + '/' + B.max + '），迴圈卡在這裡，不會去讀下一筆。<div class="slots">' + chip('#' + p.hold.id, p.hold.v + '℃', 'exit') + '</div>';
    else if ($('bpmode').value === 'button') ph += '等你按「手動 Enqueue 一筆」。';
    else if (!run) ph += '暫停中（按「開始執行」）。';
    else ph += 'Wait 中，' + Math.max(0, p.due - B.t) + ' ms 後讀下一筆並 Enqueue。';
    ph += '</div><div class="kv">下一筆：#' + B.next + '</div>';
    $('bprod').innerHTML = ph;
    $('bprod').className = 'loopbox' + (B.released ? ' end' : p.st === 'block' ? ' block' : run ? ' run' : '');
    // 佇列
    var qh = '<h3>' + (B.released ? '已 Release：佇列不在了' : !B.obtained ? '（還沒 Obtain）' : 'Queue：' + B.q.length + (B.max > 0 ? ' / ' + B.max : ' 筆（不限）')) + '</h3><div class="slots">';
    var list = B.released ? B.lost : B.q;
    list.forEach(function (x) { qh += chip('#' + x.id, x.v + '℃', B.released ? 'lost' : x.id === B.inId ? 'in' : ''); });
    if (B.obtained && !B.released && B.max > 0) for (var i = B.q.length; i < B.max; i++) qh += chip('', null, 'empty');
    qh += '</div><small class="why">' + (B.released ? (B.lost.length ? '劃掉的 ' + B.lost.length + ' 筆沒有被處理' : '佇列是空的，沒有資料遺失') : '左邊先出，新的排到右邊（先進先出）') + '</small>';
    $('bq').innerHTML = qh; $('bq').className = 'qwrap' + (B.released ? ' dead' : '');
    B.inId = null;
    // 消費者
    var ch = '<h3>消費者迴圈：寫檔</h3><div class="st">';
    if (!B.obtained) ch += '還沒有佇列。';
    else if (B.released) ch += c.err;
    else if ($('bpause').checked) ch += '暫停中，沒有去 Dequeue。';
    else if (c.st === 'deq') ch += 'Dequeue 等資料中：已等 ' + (B.t - c.since) + ' ms' + (T < 0 ? '（timeout -1，一直等）' : ' / timeout ' + T + ' ms');
    else ch += '寫檔中：#' + c.cur.id + '，還要 ' + Math.max(0, c.due - B.t) + ' ms';
    ch += '</div><div class="row" style="margin:4px 0">element ' + (c.cur ? chip(c.cur.dflt ? '0' : '#' + c.cur.id, c.cur.dflt ? '預設值' : c.cur.v + '℃', (c.cur.dflt ? 'dflt' : '') + (B.takeId === c.cur.id ? ' take' : '')) : chip('', null, 'empty')) +
      ' <span>timed out? <span class="led' + (c.to ? ' on' : '') + '"></span></span></div><div class="kv">已寫入 ' + B.saved + ' 筆　逾時 ' + B.timeouts + ' 次</div>';
    $('bcons').innerHTML = ch;
    $('bcons').className = 'loopbox' + (B.released ? ' end' : run && !$('bpause').checked ? ' run' : '');
    B.takeId = null;
    // 按鈕
    $('bobtain').disabled = B.obtained;
    $('brun').disabled = !B.obtained || B.released; $('brun').textContent = run ? '⏸ 暫停' : '▶ 開始執行';
    $('benq').disabled = !B.obtained || B.released; $('brel').disabled = !B.obtained || B.released;
    // 說明
    if (B.released) say('bsay', B.lost.length ? '✖ Release 時佇列裡還有 ' + B.lost.length + ' 筆，它們沒有寫進檔案。真正的程式要先讓消費者處理完（見「Producer/Consumer 怎麼關」分頁）。' : '佇列已經空了才 Release，沒有資料遺失。共寫入 ' + B.saved + ' 筆。', B.lost.length ? 'bad' : 'ok');
    else if (p.st === 'block') say('bsay', '佇列滿了，生產者被 Enqueue 卡住，讀值的速度被迫降到和消費者一樣。資料沒有掉，只是生產者在等。');
    else if (B.obtained && B.max < 0 && B.q.length >= 10) say('bsay', '佇列沒有上限，生產比消費快就會一直變長、一直吃記憶體。長時間執行要嘛讓消費者跟得上，要嘛設上限。', 'bad');
    else if (c.to && !B.q.length) say('bsay', '逾時了：timed out? = True，element 是 0。這個 0 不是 PLC 讀到的值，不要寫進檔案。');
    else say('bsay', '');
  }
  function bToggle() {
    if (!B.obtained || B.released) return;
    if (B.timer) { clearInterval(B.timer); B.timer = null; }
    else B.timer = setInterval(function () { bTick(100); }, 100);
    bDraw();
  }
  function lbl() { $('bpintv').textContent = pint() + ' ms'; $('bcintv').textContent = cint() + ' ms'; }
  $('bobtain').onclick = bObtain; $('brun').onclick = bToggle; $('benq').onclick = bEnq; $('brel').onclick = bRelease; $('breset').onclick = bNew;
  $('bpint').oninput = $('bcint').oninput = lbl;
  $('bmax').onchange = function () { if (!B.obtained) { B.max = +$('bmax').value; bDraw(); } };
  $('btmo').onchange = $('bpmode').onchange = $('bpause').onchange = function () { if (B.cons.st === 'deq') B.cons.since = B.t; bDraw(); };
  lbl(); bNew();

  /* ================= 2. Queue vs Notifier vs Local Variable ================= */
  var C;
  function cNew() {
    if (C) clearInterval(C.timer);
    var P = +$('cper').value;
    C = { k: -1, P: P, end: 4 * P, timer: null, done: false,
      q: { box: [], got: [], busy: 0, st: '', inV: null, takeV: false },
      n: { val: null, seq: 0, seen: 0, got: [], busy: 0, st: '', over: null, takeV: false },
      l: { val: null, got: [], next: 0, st: '', takeV: false } };
    $('clog').innerHTML = '';
    cDraw();
  }
  function cStep() {
    if (C.done) return;
    var k = ++C.k, P = C.P, q = C.q, n = C.n, l = C.l, v = null;
    q.inV = null; q.takeV = n.takeV = l.takeV = false; n.over = null;
    if (k < 5) {
      v = k + 1;
      q.box.push(v); q.inV = v;
      if (n.val != null && n.seq > n.seen) { n.over = n.val; log('clog', '第 ' + k + ' 步：Notifier 裡的 ' + n.val + ' 還沒被拿走，就被 ' + v + ' 蓋掉了'); }
      n.val = v; n.seq++;
      l.val = v;
      log('clog', '第 ' + k + ' 步：送出 ' + v);
    }
    // Queue 接收端
    if (k >= q.busy) {
      if (q.box.length) { var x = q.box.shift(); q.got.push({ v: x }); q.busy = k + P; q.takeV = true; q.st = 'Dequeue 拿到 ' + x + '，忙 ' + P + ' 步'; }
      else q.st = '佇列空了，Dequeue 等待中';
    } else q.st = '處理中（還要 ' + (q.busy - k) + ' 步）';
    // Notifier 接收端
    if (k >= n.busy) {
      if (n.val != null && n.seq > n.seen) { n.got.push({ v: n.val }); n.seen = n.seq; n.busy = k + P; n.takeV = true; n.st = 'Wait on Notification 拿到 ' + n.val + '，忙 ' + P + ' 步'; }
      else n.st = '沒有新通知，Wait on Notification 等待中（不會重拿舊的）';
    } else n.st = '處理中（還要 ' + (n.busy - k) + ' 步）';
    // Local Variable 接收端：照自己的節奏讀
    if (k >= l.next) {
      var last = l.got.length ? l.got[l.got.length - 1].v : null;
      l.got.push({ v: l.val, dup: l.val === last }); l.next = k + P; l.takeV = true;
      l.st = '讀到 ' + l.val + (l.val === last ? '（和上次一樣，重讀）' : '');
      if (l.val === last) log('clog', '第 ' + k + ' 步：Local Variable 又讀到 ' + l.val + '，接收端以為是新資料');
    } else l.st = '處理中（還要 ' + (l.next - k) + ' 步）';
    if (k >= C.end) { C.done = true; clearInterval(C.timer); C.timer = null; }
    cDraw();
  }
  function missing(got) { var s = {}; got.forEach(function (g) { s[g.v] = 1; }); return [1, 2, 3, 4, 5].filter(function (x) { return !s[x]; }); }
  function cDraw() {
    var k = C.k, q = C.q, n = C.n, l = C.l, h = '';
    $('ct').textContent = Math.max(0, k);
    for (var i = 1; i <= 5; i++) h += chip(i, null, i - 1 <= k ? 'sent' : '');
    $('csrc').innerHTML = h;
    $('cqbox').innerHTML = q.box.length ? q.box.map(function (x) { return chip(x, null, x === q.inV ? 'in' : ''); }).join('') : chip('', null, 'empty');
    $('cnbox').innerHTML = (n.over != null ? chip(n.over, '被蓋掉', 'lost gone') : '') + (n.val != null ? chip(n.val, n.seq > n.seen ? '新的' : '已讀', n.over != null ? 'in' : '') : chip('', null, 'empty'));
    $('clbox').innerHTML = l.val != null ? chip(l.val) : chip('', null, 'empty');
    function got(arr, take) { return arr.length ? arr.map(function (g, i) { return chip(g.v, g.dup ? '重讀' : null, (g.dup ? 'dup' : '') + (take && i === arr.length - 1 ? ' take' : '')); }).join('') : chip('', null, 'empty'); }
    $('cqgot').innerHTML = got(q.got, q.takeV); $('cngot').innerHTML = got(n.got, n.takeV); $('clgot').innerHTML = got(l.got, l.takeV);
    $('cqst').textContent = k < 0 ? '' : q.st; $('cnst').textContent = k < 0 ? '' : n.st; $('clst').textContent = k < 0 ? '' : l.st;
    [['cqres', q.got], ['cnres', n.got], ['clres', l.got]].forEach(function (r) {
      var e = $(r[0]);
      if (!C.done) { e.textContent = ''; e.className = 'res'; return; }
      var m = missing(r[1]), d = r[1].filter(function (g) { return g.dup; }).length;
      e.className = 'res ' + (m.length || d ? 'bad' : 'ok');
      e.textContent = m.length || d ? '✖ ' + (m.length ? '漏掉 ' + m.join('、') : '') + (m.length && d ? '；' : '') + (d ? '重讀 ' + d + ' 次' : '') : '✔ 1～5 全部拿到，順序正確，不重複';
    });
    $('cstep').disabled = C.done; $('cauto').textContent = C.timer ? '⏸ 暫停' : '▶ 自動跑完';
  }
  $('cstep').onclick = cStep; $('creset').onclick = cNew; $('cper').onchange = cNew;
  $('cauto').onclick = function () {
    if (C.timer) { clearInterval(C.timer); C.timer = null; cDraw(); return; }
    if (C.done) cNew();
    C.timer = setInterval(cStep, 700); cDraw();
  };
  cNew();

  /* ================= 3. Producer/Consumer 關閉順序 ================= */
  var DSC = [
    { k: 'wrong', name: '✖ 錯的順序：按 STOP → 先 Release Queue → 再 Enqueue 最後一筆', stages: ['按 STOP', 'Release Queue', 'Enqueue 最後一筆', '消費者停'] },
    { k: 'exit', name: '✔ 對的順序：按 STOP → Enqueue 最後一筆 → Enqueue「Exit」→ 消費者看到 Exit 停 → 兩邊都停了才 Release', stages: ['按 STOP', 'Enqueue 最後一筆', 'Enqueue Exit', '消費者拿到 Exit 停', 'Release Queue'] }
  ];
  var D;
  function dPick(k) {
    if (D) clearInterval(D.timer);
    D = { k: k || (D ? D.k : 'wrong'), step: 0, timer: null, stopReq: false, next: 1, q: [], released: false, fin: false, done: {},
      prod: { st: 'run', last: null, err: '' }, cons: { st: 'deq', cur: null, due: 0, err: '' }, saved: [], lost: [], inId: null, takeId: null };
    Array.prototype.forEach.call($('dscn').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.k === D.k); });
    $('dlog').innerHTML = ''; say('dsay', '');
    dDraw();
  }
  function stg(name) { D.done[name] = 1; }
  function dRelease() {
    D.released = true; stg('Release Queue');
    if (D.q.length) { D.lost = D.lost.concat(D.q); log('dlog', 'Release Queue：佇列被銷毀，裡面 ' + D.q.map(function (x) { return '#' + x.id; }).join('、') + ' 還沒寫檔，一起消失'); }
    else log('dlog', 'Release Queue：佇列是空的，沒有東西遺失');
    D.q = [];
    if (D.cons.st === 'deq') { D.cons.st = 'end'; D.cons.err = 'Dequeue 等待中佇列被 Release → 錯誤 1122，迴圈停止'; stg('消費者停'); log('dlog', '消費者：正在 Dequeue 等待 → 收到錯誤 1122，迴圈停止'); }
  }
  function dTick() {
    if (D.fin) return;
    D.step++;
    var P = +$('dcper').value, c = D.cons, p = D.prod;
    // 消費者
    if (c.st === 'busy' && D.step >= c.due) { D.saved.push(c.cur); log('dlog', '消費者：#' + c.cur.id + ' 寫進檔案'); c.cur = null; c.st = 'deq'; }
    if (c.st === 'deq') {
      if (D.released) { c.st = 'end'; c.err = '回到 Dequeue 時佇列參考已無效 → 出錯，迴圈停止'; stg('消費者停'); log('dlog', '消費者：呼叫 Dequeue，佇列已經不在 → 出錯，迴圈停止'); }
      else if (D.q.length) {
        var it = D.q.shift(); D.takeId = it.id;
        if (it.exit) { c.st = 'end'; c.cur = it; stg('消費者拿到 Exit 停'); log('dlog', '消費者：Dequeue 拿到 <b>Exit</b> → 前面的資料都處理完了，迴圈結束'); }
        else { c.cur = it; c.st = 'busy'; c.due = D.step + P; log('dlog', '消費者：Dequeue 拿到 #' + it.id + '，寫檔中'); }
      }
    }
    // 生產者
    if (p.st === 'run') {
      var item = { id: D.next, v: reading(D.next) }; D.next++;
      if (D.stopReq) {
        item.last = true; p.last = item; stg('按 STOP');
        log('dlog', '生產者：讀到最後一筆 #' + item.id + '，迴圈要結束了');
        if (D.k === 'wrong') { dRelease(); p.st = 'shut'; }
        else { D.q.push(item); D.inId = item.id; p.last = null; stg('Enqueue 最後一筆'); log('dlog', '生產者：Enqueue 最後一筆 #' + item.id); p.st = 'shut'; }
      } else { D.q.push(item); D.inId = item.id; log('dlog', '生產者：Enqueue #' + item.id); }
    } else if (p.st === 'shut') {
      if (D.k === 'wrong') { D.lost.push(p.last); p.err = 'Enqueue 最後一筆 #' + p.last.id + ' 時佇列已被 Release → 出錯，沒送出'; stg('Enqueue 最後一筆'); log('dlog', '生產者：Enqueue #' + p.last.id + ' → 出錯（佇列參考已無效），這筆沒送出'); p.last = null; }
      else { D.q.push({ id: 'Exit', exit: true }); D.inId = 'Exit'; stg('Enqueue Exit'); log('dlog', '生產者：Enqueue <b>Exit</b>，排在所有資料後面。生產者迴圈結束'); }
      p.st = 'end';
    }
    // 收尾
    if (p.st === 'end' && c.st === 'end') {
      if (!D.released) { dRelease(); log('dlog', '兩個迴圈都結束了，現在才 Release Queue'); }
      D.fin = true; clearInterval(D.timer); D.timer = null;
    }
    dDraw();
  }
  function dStop() { if (!D.fin && D.prod.st === 'run') { D.stopReq = true; dDraw(); } }
  function dDraw() {
    var c = D.cons, p = D.prod, sc = DSC.filter(function (s) { return s.k === D.k; })[0], run = !!D.timer;
    var nxt = true;
    flow('dflow', sc.stages, sc.stages.map(function (s) { if (D.done[s]) return 'done'; if (nxt && D.stopReq) { nxt = false; return 'on'; } return ''; }));
    var ph = '<h3>生產者迴圈</h3><div class="st">';
    if (p.st === 'run') ph += D.stopReq ? 'STOP 按下了，這一圈讀完最後一筆就收尾。' : run ? '每一步讀一筆 D0 並 Enqueue。' : '按 ▶ 開始。';
    else if (p.st === 'shut') ph += D.k === 'wrong' ? '已經 Release，手上還拿著最後一筆，下一步要 Enqueue…' : '最後一筆送了，下一步送 Exit…';
    else ph += p.err || '迴圈已結束。';
    ph += '</div>' + (p.last ? '<div class="slots">' + chip('#' + p.last.id, '最後', 'exit') + '</div>' : '');
    $('dprod').innerHTML = ph; $('dprod').className = 'loopbox' + (p.st === 'end' ? ' end' : run ? ' run' : '');
    var qh = '<h3>' + (D.released ? '已 Release' : 'Queue：' + D.q.length + ' 筆') + '</h3><div class="slots">';
    qh += D.q.length ? D.q.map(function (x) { return x.exit ? chip('Exit', null, 'exit' + (x.id === D.inId ? ' in' : '')) : chip('#' + x.id, x.last ? '最後' : x.v + '℃', x.id === D.inId ? 'in' : ''); }).join('') : chip('', null, 'empty');
    qh += '</div>';
    $('dq').innerHTML = qh; $('dq').className = 'qwrap' + (D.released ? ' dead' : '');
    var ch = '<h3>消費者迴圈：寫檔</h3><div class="st">';
    if (c.st === 'end') ch += c.err || '拿到 Exit，迴圈結束。';
    else if (c.st === 'busy') ch += '寫檔中 #' + c.cur.id + '…';
    else ch += 'Dequeue 等資料中…';
    ch += '</div>' + (c.cur ? '<div class="slots">' + (c.cur.exit ? chip('Exit', null, 'exit' + (D.takeId === 'Exit' ? ' take' : '')) : chip('#' + c.cur.id, c.cur.last ? '最後' : c.cur.v + '℃', D.takeId === c.cur.id ? 'take' : '')) + '</div>' : '');
    $('dcons').innerHTML = ch; $('dcons').className = 'loopbox' + (c.st === 'end' ? ' end' : run ? ' run' : '');
    D.inId = D.takeId = null;
    $('dsaved').innerHTML = D.saved.length ? D.saved.map(function (x) { return chip('#' + x.id, x.last ? '最後' : x.v + '℃'); }).join('') : chip('', null, 'empty');
    $('dlost').innerHTML = D.lost.length ? D.lost.map(function (x) { return chip('#' + x.id, x.last ? '最後' : x.v + '℃', 'lost'); }).join('') : chip('', null, 'empty');
    $('dstop').classList.toggle('on', D.stopReq); $('dstop').disabled = D.fin || D.stopReq;
    $('drun').disabled = D.fin; $('drun').textContent = run ? '⏸ 暫停' : '▶ 開始'; $('dstep').disabled = D.fin;
    if (D.fin) {
      if (D.lost.length) say('dsay', '✖ 遺失 ' + D.lost.length + ' 筆（' + D.lost.map(function (x) { return '#' + x.id; }).join('、') + '）：' + (D.lost.length > 1 ? '佇列裡還沒寫的跟著 Release 消失；' : 'Release 時佇列剛好是空的，可是') + '最後一筆 Enqueue 時佇列已經不在。順序反了，最後一筆一定掉。', 'bad');
      else say('dsay', '✔ 0 筆遺失：#1～#' + D.saved[D.saved.length - 1].id + ' 全部寫進檔案（包括最後一筆），消費者看到 Exit 才停，兩個迴圈都結束後才 Release。', 'ok');
    } else if (!D.stopReq && D.q.length >= 3) say('dsay', '佇列裡已經堆了 ' + D.q.length + ' 筆，現在按 STOP 看看。');
    else if (!D.stopReq) say('dsay', '');
  }
  DSC.forEach(function (s) { var b = el('button', '', s.name); b.type = 'button'; b.dataset.k = s.k; b.onclick = function () { dPick(s.k); }; $('dscn').appendChild(b); });
  $('drun').onclick = function () { if (D.fin) return; if (D.timer) { clearInterval(D.timer); D.timer = null; } else D.timer = setInterval(dTick, 600); dDraw(); };
  $('dstep').onclick = dTick; $('dstop').onclick = dStop; $('dreset').onclick = function () { dPick(D.k); };
  dPick('wrong');

  if (/^#(basic|cmp|stop)$/.test(location.hash)) show(location.hash.slice(1));
  window.QueueLab = {
    show: show,
    bNew: bNew, bObtain: bObtain, bTick: bTick, bEnq: bEnq, bRelease: bRelease, bToggle: bToggle, B: function () { return B; },
    cNew: cNew, cStep: cStep, C: function () { return C; },
    dPick: dPick, dTick: dTick, dStop: dStop, D: function () { return D; },
    reading: reading
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function pickN(a, n) { var b = a.slice(), r = []; while (r.length < n && b.length) r.push(b.splice(Math.floor(Math.random() * b.length), 1)[0]); return r; }
  var KIND = [
    function () {
      var n = p1([2, 3, 4, 5]);
      return { q: 'Obtain Queue 時 max queue size 設 <b>' + n + '</b>。生產者連續 Enqueue，消費者一個都還沒拿。第 <b>' + (n + 1) + '</b> 次 Enqueue Element（timeout 沒接，預設 -1）會怎樣？', ans: '停在 Enqueue 等，直到有人拿走一個', wrong: ['把最舊的元素擠掉，放進新的', '丟掉這個新元素，繼續往下跑', '立刻回傳錯誤 1122', '佇列自動變大，照樣放進去', 'timed out? 變 True，繼續往下跑'], ex: '佇列滿了 Enqueue 就等空位，timeout -1 表示一直等。資料不會被丟，只是生產者被拖慢。Queue 不會自己擠掉舊資料。' };
    },
    function () {
      var v = pickN([12, 18, 25, 31, 47, 56, 63], 3);
      return { q: '接收迴圈正在忙，還沒呼叫 Wait on Notification。這段時間送出端連續 Send Notification 三次：<b>' + v.join('、') + '</b>。接收迴圈忙完後呼叫 Wait on Notification（ignore previous 保持 False），拿到什麼？', ans: String(v[2]), wrong: [String(v[0]), String(v[1]), v.join('、') + ' 依序三個', '什麼都拿不到，要等下一次 Send'], ex: 'Notifier 只存最新的一筆，新的會蓋掉舊的，所以 ' + v[0] + '、' + v[1] + ' 已經不見了。接收端還沒看過 ' + v[2] + '，所以會立刻拿到它。要每筆都拿到就用 Queue。' };
    },
    function () {
      var cmd = pickN(['讀 D0', '存檔', '歸零', '開馬達', '關馬達', '回原點'], 4), d = p1([1, 2, 3]);
      return { q: '佇列原本是空的，依序 Enqueue：<b>' + cmd.join(' → ') + '</b>。接著 Dequeue 第 ' + d + ' 次，拿到哪一個？', ans: cmd[d - 1], wrong: cmd.filter(function (c, i) { return i !== d - 1; }).concat(['空字串（佇列是空的）']), ex: 'Queue 先進先出（FIFO），Dequeue 照放進去的順序拿：第 ' + d + ' 次拿到第 ' + d + ' 個放進去的「' + cmd[d - 1] + '」。' };
    },
    function () {
      var t = p1([100, 250, 500, 2000]);
      return { q: '佇列是空的，也沒有人會再 Enqueue。消費者呼叫 Dequeue Element，timeout 設 <b>' + t + ' ms</b>（元素型別是數值）。結果？', ans: t + ' ms 後往下走，timed out? = True，element 是 0', wrong: ['一直等下去，迴圈停在這裡', '立刻回傳 0，timed out? = False', t + ' ms 後回傳錯誤 1122', t + ' ms 後回傳上一次拿到的值'], ex: '有接 timeout 就不會永遠等；時間到 timed out? 輸出 True，element 是該型別的預設值（數值是 0）。要靠 timed out? 判斷，別把這個 0 當資料。' };
    },
    function () {
      return { q: '消費者正停在 Dequeue Element 等資料（timeout -1），這時生產者迴圈呼叫 <b>Release Queue</b> 把佇列釋放掉。消費者的 Dequeue 會？', ans: '馬上結束等待，回傳錯誤 1122', wrong: ['繼續等，直到有人 Enqueue', 'timed out? 變 True，沒有錯誤', '拿到佇列裡最後一個元素', '整個 VI 當掉，要強制關閉'], ex: '佇列被 Release（銷毀）時，正在等它的 Dequeue 會收到錯誤 1122（等待中參考失效），迴圈可以用這個錯誤停下。缺點是佇列裡還沒拿的資料會跟著消失。' };
    },
    function () {
      var a = p1([6, 7, 8, 9, 10]), b = p1([2, 3, 4]);
      return { q: 'max queue size 設 -1。生產者 Enqueue 了 <b>' + a + '</b> 次，消費者 Dequeue 了 <b>' + b + '</b> 次（都成功、沒有逾時）。現在佇列裡有幾個元素？', ans: String(a - b), wrong: [String(a), String(b), String(a + b), '0', String(a - b + 1)], ex: '每次 Enqueue 多一個、每次成功的 Dequeue 少一個：' + a + ' − ' + b + ' = ' + (a - b) + '。-1 表示沒有上限，所以 Enqueue 都不會等。' };
    },
    function () {
      var w = p1([50, 100]), r = p1([300, 500]);
      return { q: '迴圈 A 每 ' + w + ' ms 把新的 PLC 讀值寫進 Local Variable；迴圈 B 每 ' + r + ' ms 讀一次這個 Local Variable 存檔。A 寫完 1、2、3、4、5 就停了，B 還在跑。B 存下來的資料會？', ans: '漏掉一些值，而且之後一直重複存 5', wrong: ['1～5 依序全部存到', '只存到 5 一次', '讀不到，要等 A 停了才讀得到', '存到 1～5，之後不再存'], ex: 'Local Variable 只是「現在的值」，沒有「新資料來了」的通知。B 讀得比 A 寫得慢就會漏；A 停了 B 還在讀，就一直讀到同一個 5。要每筆都存就用 Queue。' };
    },
    function () {
      var c = p1([
        ['每一筆量測都要寫進檔案，一筆都不能少', 'Queue', '每筆都要處理、要照順序 → Queue。'],
        ['畫面只要顯示最新溫度，中間沒看到的值不重要', 'Notifier', '只要最新值 → Notifier，新的蓋掉舊的剛好是想要的。'],
        ['按一下 Stop，要同時叫醒好幾個正在等待的迴圈一起結束', 'Notifier', 'Notifier 可以讓好幾個在等的迴圈都收到同一個通知（用 Wait on Notification）；Queue 的一個元素只會被一個 Dequeue 拿走。'],
        ['操作員按的指令（開馬達、歸零、存檔）要一個一個照順序執行', 'Queue', '指令不能漏、不能亂序 → Queue。']]);
      return { q: '兩個平行迴圈之間：「' + c[0] + '」。用哪一種傳最合適？', ans: c[1], wrong: [c[1] === 'Queue' ? 'Notifier' : 'Queue', 'Local Variable', 'Global Variable', '用一條線直接把兩個迴圈接起來'], ex: c[2] };
    },
    function () {
      var v = pickN(['A', 'B', 'C', 'D', 'E'], 3), x = p1(['X', 'Y', 'Z']);
      return { q: '佇列裡依序有 <b>' + v.join('、') + '</b>（' + v[0] + ' 最先放進去）。這時用 <b>Enqueue Element at Opposite End</b> 放進 ' + x + '。下一次 Dequeue 拿到什麼？', ans: x, wrong: [v[0], v[1], v[2], '錯誤，佇列不能從前面放'], ex: 'Enqueue Element at Opposite End 把元素放到佇列「出口那一端」，所以下一個被拿走的就是它。常用來插隊送緊急指令（例如緊急停止）。' };
    },
    function () {
      return { q: 'Producer/Consumer 要結束時，生產者先 Enqueue 最後一筆資料，再 Enqueue 一個「Exit」訊息。佇列裡原本還有 3 筆沒處理。消費者什麼時候會看到 Exit？', ans: '處理完前面 3 筆和最後一筆之後', wrong: ['馬上，Exit 會插到最前面', '永遠看不到，要用 Release 才會停', '處理完前面 3 筆，最後一筆會被跳過', '生產者 Release Queue 之後'], ex: 'Enqueue 放在佇列尾端，先進先出，所以 Exit 一定在所有資料後面。消費者把資料都處理完才停，最後再 Release，一筆都不掉。' };
    }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) window.QueueLab.quiz = window.LabQuiz('qquiz', gen);
  window.QueueLab.quizGen = gen; window.QueueLab.quizKinds = KIND;
})();
