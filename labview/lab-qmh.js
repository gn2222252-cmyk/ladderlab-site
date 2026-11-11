/* QMH 架構實驗室：QMH 單一迴圈、Host_Main 四個迴圈、結束順序、猜一猜
   迴圈名稱、位址、傳遞工具都照第六部分課文（part6_arch_a.js、part6_arch_b.js）。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function log(id, s) { var l = $(id); if (!l) return; l.insertBefore(el('div', '', s), l.firstChild); while (l.children.length > 300) l.removeChild(l.lastChild); }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* 卡片從 from 飛到 to（host 是 position:relative 的容器）。分頁看不到時不飛。 */
  function fly(host, from, to, html, delay, dur) {
    if (reduce || !host || !from || !to) return;
    dur = dur || 450;
    var go = function () {
      if (host.offsetParent === null || document.hidden) return;
      var hb = host.getBoundingClientRect(), fb = from.getBoundingClientRect(), tb = to.getBoundingClientRect();
      if (!fb.width || !tb.width) return;
      var w = document.createElement('div'); w.innerHTML = html;
      var e = w.firstChild; if (!e || e.nodeType !== 1) return;
      e.classList.add('mfly'); host.appendChild(e);
      var ew = e.offsetWidth, eh = e.offsetHeight, maxX = Math.max(0, hb.width - ew);
      var cx = function (b) { return Math.min(maxX, Math.max(0, b.left - hb.left + b.width / 2 - ew / 2)); };
      var cy = function (b) { return b.top - hb.top + b.height / 2 - eh / 2; };
      e.style.left = cx(fb) + 'px'; e.style.top = cy(fb) + 'px';
      e.getBoundingClientRect();
      var ease = ' cubic-bezier(.4,.1,.2,1)';
      e.style.transition = 'left ' + dur + 'ms' + ease + ', top ' + dur + 'ms' + ease;
      e.style.left = cx(tb) + 'px'; e.style.top = cy(tb) + 'px';
      setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, dur + 80);
    };
    if (delay) setTimeout(go, delay); else go();
  }

  var tabs = $('tabs'), cur = 'qmh';

  /* ======================================================================
     1. QMH 單一迴圈
     ====================================================================== */
  var QCOST = { 'Init': 2, 'Start': 1, 'Read PLC': 2, 'Update UI': 1, 'Set Speed': 1, 'Stop': 1, 'Exit': 1, 'Idle': 1 };
  var QCASES = ['Init', 'Start', 'Read PLC', 'Update UI', 'Set Speed', 'Stop', 'Exit', 'Default'];
  var QACT = {
    'Init': '開設備、載入設定。做完 Enqueue "Read PLC" 給自己',
    'Start': '運轉旗標 = True。做完 Enqueue "Read PLC" 給自己',
    'Read PLC': '讀 D300（步序）。做完 Enqueue "Update UI"，讀到的值當資料帶過去',
    'Update UI': '把資料寫到前面板的顯示元件',
    'Set Speed': '速度 = 訊息帶來的資料。做完 Enqueue "Update UI"',
    'Stop': '運轉旗標 = False。做完 Enqueue "Read PLC"',
    'Exit': '關設備，停止條件接 True，迴圈結束',
    'Default': '不認得的訊息：這一頁什麼都沒做'
  };
  var Q;
  function qcase(m) { return QCASES.indexOf(m) >= 0 && m !== 'Default' ? m : 'Default'; }
  function qMsg(m, d, self) { return { id: ++Q.id, m: m, d: d, self: !!self }; }
  function qData(x) { return x.d == null ? '—' : (x.m === 'Set Speed' ? '速度 ' + x.d : '步序 ' + x.d); }
  function qLabel(x) { return Q.mode === 'str' ? '"' + x.m + (x.d != null ? ':' + x.d : '') + '"' : x.m + (x.d != null ? '（' + qData(x) + '）' : ''); }
  function qCard(x, extra) {
    var cls = x.m === 'Exit' ? 'exit' : qcase(x.m) === 'Default' ? 'bad' : x.self ? 'self' : '';
    if (extra) cls += ' ' + extra;
    var who = x.m === 'Init' && x.self ? '程式開始時放的' : x.self ? '自己送的' : '使用者';
    if (Q.mode === 'str') return '<span class="mcard ' + cls + '">' + esc(qLabel(x)) + '<small>' + who + '</small></span>';
    return '<span class="mcard ' + cls + '">' + esc(x.m) + '<small>資料：' + esc(qData(x)) + (x.self ? '　' + who : '') + '</small></span>';
  }
  function qlog(s) { log('qlog', '<span class="kv">#' + Q.t + '</span> ' + s); }
  function qNew() {
    if (Q && Q.timer) clearInterval(Q.timer);
    Q = { t: 0, i: 0, id: 0, timer: null, resume: false, mode: $('qmode').value, q: [], cur: null, evOn: true, ev: '', evN: 0,
      done: false, released: false, lost: [], userSent: 0, userDone: 0, pressed: 0, inId: null,
      fp: { run: false, speed: 50, step: '—', upd: 0 },
      sm: { st: 'Init', left: QCOST.Init, latched: [], lost: [], done: false, did: 0, run: false, speed: 50, upd: 0 } };
    Q.q.push(qMsg('Init', null, true));
    $('qlog').innerHTML = '';
    qlog('程式開始：Obtain Queue，然後先 Enqueue 一張 "Init" 給訊息處理迴圈。兩個迴圈開始跑。');
    qDraw();
  }
  function smPress(m) {
    var s = Q.sm;
    if (m === 'Strat') return;
    if (s.done) { s.lost.push({ m: m, why: '迴圈已經結束' }); return; }
    if (s.latched.indexOf(m) >= 0) { s.lost.push({ m: m, why: 'Latch 還沒被讀，又按一次也只算一次' }); return; }
    s.latched.push(m);
  }
  function qPress(m, src, k) {
    if (!Q || Q.released) { if (Q) qlog('程式已經結束，按鈕沒人理。按「重來」。'); return; }
    if (m !== 'Strat') Q.pressed++;
    smPress(m);
    if (!Q.evOn) { qlog('按了 ' + m + '：Event 迴圈已經停了（Exit 那一頁把它停掉），沒有人把它變成訊息'); Q.lost.push({ m: m, why: 'Event 迴圈已停' }); qDraw(); return; }
    var x = qMsg(m, m === 'Set Speed' ? 80 : null, false), jump = m === 'Exit' && $('qjump').checked;
    Q.evN++; Q.userSent++;
    Q.ev = (m === 'Strat' ? 'Start 鈕（訊息字串打錯）' : m) + ': Value Change → ' + (jump ? 'Enqueue Element at Opposite End ' : 'Enqueue ') + qLabel(x);
    if (jump) Q.q.unshift(x); else Q.q.push(x);
    Q.inId = x.id;
    fly($('t-qmh'), src || $('qev'), $('qq'), qCard(x), (k || 0) * 160, 420);
    qlog('Event 迴圈：' + esc(Q.ev) + (jump ? '（放到佇列<b>出口端</b>，下一個就輪到它）' : '（排到佇列尾端）'));
    if (m === 'Exit') { Q.evOn = false; qlog('Event 迴圈：Exit 這一頁送完訊息，也把自己的迴圈停掉'); }
    qDraw();
  }
  function smTick() {
    var s = Q.sm; if (s.done) return;
    s.left--; if (s.left > 0) return;
    var st = s.st, next;
    if (st === 'Exit') { s.done = true; s.st = '（結束）'; return; }
    if (st === 'Start') s.run = true; else if (st === 'Stop') s.run = false; else if (st === 'Set Speed') s.speed = 80; else if (st === 'Update UI') s.upd++;
    if (st === 'Idle') {
      if (s.latched.length) {
        var pick = ['Exit', 'Stop', 'Start', 'Set Speed'].filter(function (p) { return s.latched.indexOf(p) >= 0; })[0];
        s.latched.forEach(function (m) { if (m !== pick) s.lost.push({ m: m, why: '和 ' + pick + ' 同一圈被讀到，下一狀態只放得下一個' }); });
        s.latched = []; s.did++; next = pick;
      } else next = 'Idle';
    } else next = { 'Init': 'Read PLC', 'Read PLC': 'Update UI', 'Update UI': 'Idle', 'Start': 'Read PLC', 'Set Speed': 'Update UI', 'Stop': 'Read PLC' }[st] || 'Idle';
    s.st = next; s.left = QCOST[next] || 1;
  }
  function qFinish() {
    var x = Q.cur.x, F = Q.fp, out = [], c = qcase(x.m);
    if (c === 'Start') F.run = true;
    else if (c === 'Stop') F.run = false;
    else if (c === 'Set Speed') F.speed = x.d;
    else if (c === 'Update UI') { if (x.d != null) F.step = x.d; F.upd++; }
    if (c === 'Init' || c === 'Start' || c === 'Stop') out.push(qMsg('Read PLC', null, true));
    else if (c === 'Read PLC') out.push(qMsg('Update UI', F.run ? 40 : 30, true));
    else if (c === 'Set Speed') out.push(qMsg('Update UI', null, true));
    if (!x.self) Q.userDone++;
    if (c === 'Default') qlog('　Case「Default」：' + esc(qLabel(x)) + ' 對不到任何一頁，<b>不會報錯</b>，就這樣被吃掉了');
    else qlog('　Case「' + c + '」做完：' + QACT[c]);
    out.forEach(function (y, k) {
      Q.q.push(y); Q.inId = y.id;
      fly($('t-qmh'), $('qh'), $('qq'), qCard(y), k * 160, 420);
      qlog('　在 Case 裡 Enqueue ' + esc(qLabel(y)) + ' 給自己（排到佇列尾端，前面的訊息先做）');
    });
    Q.cur = null;
    if (c === 'Exit') {
      Q.done = true; Q.released = true;
      Q.lost = Q.lost.concat(Q.q.map(function (y) { return { m: y.m, why: 'Release 時還在佇列裡' }; }));
      qlog('訊息處理迴圈結束。兩個迴圈都停了 → <b>Release Queue</b>' + (Q.q.length ? '，佇列裡還沒處理的 ' + Q.q.map(function (y) { return esc(qLabel(y)); }).join('、') + ' 一起消失' : '，佇列是空的，沒有訊息遺失'));
      Q.q = [];
    }
  }
  function qAllDone() { return Q.done && Q.sm.done; }
  function qTick() {
    if (!Q || qAllDone()) return;
    Q.t++;
    smTick();
    if (!Q.done) {
      if (Q.cur) { Q.cur.left--; if (Q.cur.left <= 0) qFinish(); }
      if (!Q.cur && !Q.done && Q.q.length) {
        var x = Q.q.shift(); Q.cur = { x: x, left: QCOST[qcase(x.m)] || 1, n: QCOST[qcase(x.m)] || 1 }; Q.i++;
        fly($('t-qmh'), $('qq'), $('qh'), qCard(x), 0, 380);
        qlog('訊息處理迴圈第 ' + Q.i + ' 圈：Dequeue → ' + esc(qLabel(x)) + ' → Case「' + qcase(x.m) + '」');
      }
    }
    if (qAllDone() && Q.timer) { clearInterval(Q.timer); Q.timer = null; }
    qDraw();
  }
  function qDraw() {
    var run = !!Q.timer;
    // Event 迴圈
    var h = '<h4>Event 迴圈（生產者）</h4><div class="st">' + (Q.evOn ? 'Event 結構停在這裡<b>等使用者</b>，按鈕一按立刻處理。' : 'Exit 事件後已停止。') + '</div>';
    h += '<div class="kv" style="margin-top:6px">上一個事件：<br>' + (Q.ev ? esc(Q.ev) : '—') + '</div><div class="kv">處理了 ' + Q.evN + ' 個事件</div>';
    $('qev').innerHTML = h; $('qev').className = 'loopbox' + (Q.evOn ? ' run' : ' end');
    // 佇列
    h = '<h4>' + (Q.released ? '已 Release：佇列不在了' : '訊息佇列：' + Q.q.length + ' 張') + '</h4><div class="cards col">';
    var list = Q.released ? [] : Q.q;
    h += list.length ? list.map(function (x, k) { return qCard(x, (k === 0 ? 'head' : '') + (x.id === Q.inId ? ' in' : '')); }).join('') : '<span class="empty">（空的' + (Q.released ? '' : '，處理迴圈停在 Dequeue 等') + '）</span>';
    h += '</div><small class="why">最上面先出（先進先出）。黃色 = 使用者按的，藍色 = 處理迴圈送給自己的。</small>';
    $('qq').innerHTML = h; $('qq').className = 'qwrap' + (Q.released ? ' dead' : '');
    Q.inId = null;
    // 訊息處理迴圈
    var c = Q.cur ? qcase(Q.cur.x.m) : null;
    h = '<h4>訊息處理迴圈（消費者）</h4>';
    if (Q.done) h += '<div class="st">已結束，佇列已 Release。</div>';
    else if (!Q.cur) h += '<div class="st">Dequeue Element 等待中（timeout -1）：佇列有卡片就拿。</div>';
    else h += '<div class="st">拿到 ' + esc(qLabel(Q.cur.x)) + '，執行中…</div>';
    h += '<div class="casebox"><div class="casehd' + (c ? ' on' : '') + '">◀ ' + (c ? (Q.mode === 'str' && c !== 'Default' ? '"' + c + '"' : c) : '…') + ' ▾ ▶</div><div class="casebd">' + (c ? QACT[c] : '（沒有訊息時不執行任何一頁）') + '</div></div>';
    if (Q.cur) h += '<div class="bar" style="width:' + Math.round(100 * (Q.cur.n - Q.cur.left + 1) / (Q.cur.n + 1)) + '%"></div>';
    h += '<div class="clist">' + QCASES.map(function (k) { return '<span class="' + (k === c ? 'on' : '') + '">' + k + '</span>'; }).join('') + '</div>';
    $('qh').innerHTML = h; $('qh').className = 'loopbox' + (Q.done ? ' end' : Q.cur ? ' busy' : run ? ' run' : '');
    // 前面板
    var F = Q.fp;
    $('qfp').innerHTML = '<b>QMH 的前面板</b><span>Running <span class="led' + (F.run ? ' on' : '') + '"></span></span><span>Speed <span class="ind">' + F.speed + '</span></span><span>步序 D300 <span class="ind">' + F.step + '</span></span><span>Update UI 執行了 <b>' + F.upd + '</b> 次</span><small class="why">Read PLC 讀到的值要等 Update UI 那一頁才寫到畫面</small>';
    // 簡單狀態機
    var s = Q.sm, sts = ['Init', 'Read PLC', 'Update UI', 'Idle', 'Start', 'Set Speed', 'Stop', 'Exit'];
    h = '<h4>簡單狀態機（一個迴圈）</h4><div class="smst">' + sts.map(function (k) { return '<span class="' + (k === s.st ? 'on' : '') + '">' + k + '</span>'; }).join('') + '</div>';
    h += '<div class="st">' + (s.done ? '已結束。' : s.st === 'Idle' ? '在 Idle：這一圈讀按鈕。' : '在 ' + s.st + '：這段時間不讀按鈕。') + '</div>';
    h += '<div class="kv">Latch 卡在 True 的按鈕：' + (s.latched.length ? s.latched.join('、') : '—') + '<br>Running ' + (s.run ? '●' : '○') + '　Speed ' + s.speed + '　做了 ' + s.did + ' 個按鈕的事</div>';
    $('qsm').innerHTML = h; $('qsm').className = 'loopbox' + (s.done ? ' end' : run ? ' run' : '');
    h = '<h4>狀態機漏掉的按鈕：' + s.lost.length + ' 個</h4><div class="cards">';
    h += s.lost.length ? s.lost.map(function (x) { return '<span class="mcard lost">' + esc(x.m) + '<small>' + esc(x.why) + '</small></span>'; }).join('') : '<span class="empty">（還沒有）</span>';
    h += '</div>';
    if (Q.lost.length) h += '<h4 style="margin-top:10px">QMH 沒處理到的：' + Q.lost.length + ' 個</h4><div class="cards">' + Q.lost.map(function (x) { return '<span class="mcard lost">' + esc(x.m) + '<small>' + esc(x.why) + '</small></span>'; }).join('') + '</div>';
    $('qsmlost').innerHTML = h; $('qsmlost').className = 'loopbox';
    // 按鈕與說明
    $('qi').textContent = Q.i;
    $('qrun').textContent = run ? '⏸ 暫停' : '▶ 開始執行'; $('qrun').disabled = qAllDone(); $('qstep').disabled = qAllDone();
    $('qtypo').disabled = Q.mode !== 'str';
    $('qtypo').title = Q.mode === 'str' ? '' : 'Enum 只能選已經定義的值，不可能打錯字';
    var userQ = Q.q.filter(function (x) { return !x.self; }).length;
    if (Q.done) say('qsay', 'QMH：使用者送出 ' + Q.userSent + ' 張訊息，處理了 ' + Q.userDone + ' 張' + (Q.lost.length ? '，' + Q.lost.length + ' 個沒處理到（Exit 插隊或 Exit 之後才按）' : '，一張都沒掉') + '。簡單狀態機：做了 ' + s.did + ' 個按鈕的事，漏掉 ' + s.lost.length + ' 個。', Q.lost.length ? 'bad' : 'ok');
    else if (userQ >= 2) say('qsay', '佇列裡有 ' + userQ + ' 張使用者的訊息在排隊，一張都不會被蓋掉，只是要等前面的做完。');
    else if (s.lost.length) say('qsay', '簡單狀態機已經漏掉 ' + s.lost.length + ' 個按鈕，QMH 這邊全部都在排隊或做完了。', 'bad');
    else say('qsay', '');
  }
  function qStart() { if (qAllDone() || Q.timer) return; Q.timer = setInterval(qTick, 700); qDraw(); }
  function qToggle() { if (Q.timer) { clearInterval(Q.timer); Q.timer = null; qDraw(); } else qStart(); }
  Array.prototype.forEach.call($('qbtns').querySelectorAll('[data-m]'), function (b) { b.onclick = function () { qPress(b.dataset.m, b); }; });
  $('qtypo').onclick = function () { if (Q.mode === 'str') qPress('Strat', $('qtypo')); };
  $('qburst').onclick = function () { ['Start', 'Set Speed', 'Stop'].forEach(function (m, k) { qPress(m, $('qburst'), k); }); };
  $('qrun').onclick = qToggle; $('qstep').onclick = qTick; $('qreset').onclick = qNew;
  $('qmode').onchange = qNew;
  qNew();

  /* ======================================================================
     2、3. Host_Main 四個迴圈（共用的模擬引擎）
     一步 = 100 ms。PLC 每步掃描一次；通訊迴圈約 100 ms 一圈；UI 迴圈約 200 ms 一圈；
     檢測迴圈等通知（timeout 500 ms）；MES 迴圈 Dequeue（timeout 200 ms）。
     ====================================================================== */
  var STEPN = { 30: 'Idle', 40: 'RequestPart', 50: 'ToStopper', 60: 'Clamp', 70: 'Inspect', 80: 'Release', 90: 'ToSort', 100: 'PushNG', 110: 'ToExit', 120: 'Done', 900: 'Error', 910: 'AlarmWait' };
  var LOOPN = { ui: '③ UI 迴圈', cm: '② 通訊迴圈', ins: '④ 檢測迴圈', mes: '① MES 迴圈' };
  var STOPSTG = { ui: 'UI 迴圈停', cm: '通訊迴圈停', ins: '檢測迴圈停', mes: 'MES 迴圈停' };
  var BOXES = ['ui', 'wq', 'cm', 'ins', 'nt', 'plc', 'mq', 'mes', 'hx'];
  var BASE = { ui: 'bx lp ui', wq: 'bx tq wq', cm: 'bx lp cm', ins: 'bx lp ins', nt: 'bx tq nt', plc: 'bx plc', mq: 'bx tq mq', mes: 'bx lp mes', hx: 'bx hx' };
  function wCard(a, v, cls) { return '<span class="mcard w' + (cls ? ' ' + cls : '') + '">D' + a + '=' + v + '<small>' + (a * 65536 + v) + '</small></span>'; }
  function mCard(it, cls) { return '<span class="mcard mes' + (cls ? ' ' + cls : '') + '">#' + it.pid + ' ' + (it.r === 1 ? 'OK' : 'NG') + '<small>{"part_id":' + it.pid + ',…}</small></span>'; }
  function nCard(n) { return '<span class="mcard nt">#' + n.seq + '<small>步序 ' + n.w.step + '　b0=' + n.w.b0 + '</small></span>'; }

  function makeSim(pre, isExit) {
    var board = $(pre + 'board'), bx = {}, S = null, timer = null, resume = false, api = {};
    board.innerHTML = BOXES.map(function (k) { return '<div class="' + BASE[k] + '"></div>'; }).join('');
    BOXES.forEach(function (k) { bx[k] = board.querySelector('.bx.' + k); });
    function interval() { return +$(pre + 'speed').value; }
    function dur() { return Math.max(260, Math.min(620, interval() * 2.2)); }
    function lg(s) { log(pre + 'log', '<span class="kv">' + (S.t / 10).toFixed(1) + 's</span> ' + s); }
    function stg(n) { S.stages[n] = 1; }
    function fl(from, to, html, delay) { fly(board, bx[from], bx[to], html, delay || 0, dur()); }

    function reset(scn) {
      if (timer) { clearInterval(timer); timer = null; }
      resume = false;
      S = { t: 0, scn: scn || null, fin: false, endT: null, cardId: 0,
        plc: { step: 30, stepT: 0, alarm: '', b0: 0, pid: 1000, d100: 0, d510: 0, d511: 0, d520: 0, lastBeat: 0, beatT: 0, stop: 0, res: 0, d530: 80, d550: 0, ok: 0, ng: 0 },
        wq: [], wqAlive: true, nt: null, ntSeq: 0, ntAlive: true, mq: [], mqAlive: true,
        ui: { alive: true, n: 0, next: 0, last: null, seen: 0, to: false, fault: 0, pSpeed: 80, waitSpeed: false, leaving: false, since: 0, latch: {}, msg: '', err: '', why: '' },
        cm: { alive: true, n: 0, next: 0, beat: 0, err: '' },
        ins: { alive: true, n: 0, prev: 0, seen: 0, waitT: 0, busy: 0, pid: 0, to: 0, err: '' },
        mes: { alive: true, n: 0, waitT: 0, post: 0, pending: [], ok: 0, fail: 0, err: '' },
        hx: false, estop: false, slow: false, mesDown: false, speed: 80, lost: [], stages: {}, exitPressed: false };
      $(pre + 'log').innerHTML = '';
      if (!isExit) {
        $('mestop').classList.remove('on'); $('mslow').checked = false; $('mmesdown').checked = false; $('mspd').value = '80';
        lg('Obtain 寫入佇列（U32）、Notifier（21 個字）、MES 佇列（字串），四個迴圈開始跑。按 ▶ 或「走一步」。');
      } else {
        S.ui.latch.start = true;
        $('xexit').classList.remove('on');
        if (S.scn === 'nowire') {
          stg('程式開始');
          lg('程式開始：Release Notifier 只接了參照、<b>error in 沒接</b> → 輸入一到齊就執行，不會等 UI 迴圈');
          releaseNt(); stg('Release Notifier 立刻執行');
          releaseWq(); stg('Release 寫入佇列');
        } else lg('程式開始，前面板 Start 已經按下（等 UI 迴圈讀）。等檢測迴圈在檢測時按 Exit。');
      }
      draw();
    }

    /* ---------- 釋放參照 ---------- */
    function releaseNt() { S.ntAlive = false; lg('<b>Release Notifier</b>：正在等它的 Wait on Notification 會收到錯誤，之後再呼叫的 Send Notification 也會出錯'); }
    function releaseWq() {
      var step = S.plc.step;
      S.wq.forEach(function (c) { S.lost.push({ t: 'D' + c.a + '=' + c.v, why: '還在寫入佇列裡沒被 Flush，跟著佇列消失' + (c.a === 100 && c.v === 2 && step === 30 ? '（PLC 本來就在 Idle，沒影響）' : ''), benign: c.a === 100 && c.v === 2 && step === 30 }); });
      lg('<b>Release 寫入佇列</b>' + (S.wq.length ? '：裡面 ' + S.wq.map(function (c) { return 'D' + c.a + '=' + c.v; }).join('、') + ' 還沒寫進 PLC，一起消失' : '：佇列是空的'));
      S.wq = []; S.wqAlive = false;
    }
    function releaseMq() {
      S.mq.forEach(function (it) { S.lost.push({ t: 'MES #' + it.pid, why: '還在 MES 佇列裡，跟著佇列消失' }); });
      lg('<b>Release MES 佇列</b>' + (S.mq.length ? '：裡面還有 ' + S.mq.length + ' 筆沒被 Dequeue，一起消失' : '：佇列是空的'));
      S.mq = []; S.mqAlive = false;
    }
    function stopLoop(k, msg) {
      var L = S[k]; if (!L.alive) return;
      L.alive = false; L.err = msg; stg(STOPSTG[k]);
      lg(LOOPN[k] + '：' + msg);
      if (k === 'ui') {
        var lt = S.ui.latch, names = { start: 'Start', cstop: 'Cycle Stop', reset: 'Reset', exit: 'Exit' };
        Object.keys(lt).forEach(function (b) { if (lt[b] && names[b]) S.lost.push({ t: names[b] + ' 按鈕', why: 'UI 迴圈已停，沒有人讀這個按鈕' }); });
        S.ui.latch = {};
      }
      if (k === 'ins' && S.scn && S.mqAlive) { releaseMq(); stg('Release MES 佇列'); }
      if (k === 'mes') {
        S.mes.pending.forEach(function (it) { S.lost.push({ t: 'MES #' + it.pid, why: '還在待送清單裡沒上傳成功' }); });
        S.hx = true; S.endT = S.t; stg('Host_Exit');
        lg('<b>Host_Exit</b>：MES 結批 → 關伺服（VISA Close）→ 關相機（TCP Close）');
      }
    }

    /* ---------- 寫入佇列 ---------- */
    function enq(a, v, from, who) {
      if (!S.wqAlive) {
        S.lost.push({ t: 'D' + a + '=' + v, why: who + ' Enqueue 時寫入佇列已被 Release → 出錯，沒送出' });
        lg(who + '：Enqueue D' + a + '=' + v + ' → <b>出錯</b>（佇列參照已無效），這筆沒送出');
        return false;
      }
      S.wq.push({ a: a, v: v, id: ++S.cardId });
      fl(from, 'wq', wCard(a, v));
      lg(who + '：Enqueue ' + (a * 65536 + v) + '（D' + a + '=' + v + '）→ 寫入佇列');
      return true;
    }

    /* ---------- PLC（自己一直掃描，LabVIEW 停了它也不停） ---------- */
    function plcScan() {
      var P = S.plc;
      if (P.d100) {
        var k = P.d100; P.d100 = 0;
        if (k === 1) { if (P.step === 30) { P.step = 40; P.stepT = 0; P.stop = 0; lg('PLC：收到 D100=1 → 40 RequestPart，寫回 D100=0'); } else lg('PLC：收到 D100=1，不在 Idle，不理'); }
        else if (k === 2) { if (P.step >= 40 && P.step <= 120) { P.stop = 1; lg('PLC：收到 D100=2 → 做完這顆再停'); } else lg('PLC：收到 D100=2（現在沒在生產）'); }
        else if (k === 3) {
          if (P.step >= 900 && !(P.d550 & 1)) { P.step = 30; P.stepT = 0; P.alarm = ''; P.stop = 0; lg('PLC：收到 D100=3 Reset → 30 Idle（實機會先清線）'); }
          else if (P.step >= 900) lg('PLC：收到 Reset，可是 D550 急停位元還是 1，不能復歸');
          else lg('PLC：收到 Reset，不在警報中，不用做事');
        }
      }
      if ((P.d550 & 1) && P.step < 900) { P.step = 900; P.stepT = 0; P.alarm = '急停（D550 bit0 故障注入）'; P.b0 = 0; lg('PLC：D550 bit0 = 1 → 900 Error，輸出全部 OFF'); }
      if (P.d520 !== P.lastBeat) { P.lastBeat = P.d520; P.beatT = 0; } else P.beatT++;
      if (P.step >= 40 && P.step <= 120 && P.beatT >= 20) { P.step = 910; P.stepT = 0; P.alarm = '9006 心跳逾時'; P.b0 = 0; lg('PLC：D520 兩秒沒變 → <b>警報 9006</b>，停機。這顆零件卡在機台裡'); return; }
      P.stepT++;
      var st = P.step;
      if (st === 900 && P.stepT >= 2) { P.step = 910; P.stepT = 0; }
      else if ((st === 40 || st === 50 || st === 60) && P.stepT >= 6) { P.step = st + 10; P.stepT = 0; if (P.step === 70) { P.pid++; P.b0 = 1; lg('PLC：70 Inspect，D306 = ' + P.pid + '，b0 = 1（請求檢測）'); } }
      else if (st === 70 && P.d511 === 1) { P.b0 = 0; P.res = P.d510; P.step = 80; P.stepT = 0; lg('PLC：看到 D511=1，讀 D510=' + P.d510 + '，b0 = 0 → 80 Release'); }
      else if (st === 80 && P.stepT >= 4) { P.step = 90; P.stepT = 0; }
      else if (st === 90 && P.stepT >= 4) { P.step = P.res === 1 ? 110 : 100; P.stepT = 0; }
      else if ((st === 100 || st === 110) && P.stepT >= 5) { if (P.res === 1) P.ok++; else P.ng++; P.step = 120; P.stepT = 0; }
      else if (st === 120 && P.stepT >= 3 && P.d511 === 0) { P.step = P.stop ? 30 : 40; P.stepT = 0; if (P.stop) { P.stop = 0; lg('PLC：有停止請求 → 30 Idle'); } }
    }

    /* ---------- ② 通訊迴圈：唯一跟 PLC 講話 ---------- */
    function commLoop() {
      var c = S.cm; if (!c.alive || S.t < c.next) return;
      if (!S.ntAlive) { stopLoop('cm', 'Send Notification 出錯（Notifier 已被 Release），停止條件接這條錯誤線 → 迴圈停止'); return; }
      if (!S.wqAlive) { stopLoop('cm', 'Flush Queue 出錯（寫入佇列已被 Release），錯誤一路傳到停止條件 → 迴圈停止'); return; }
      c.n++;
      var P = S.plc, w = { step: P.step, alarm: P.alarm, b0: P.b0, pid: P.pid, ok: P.ok, ng: P.ng };
      P.d520 = ++c.beat;
      var items = S.wq.splice(0, S.wq.length);
      items.forEach(function (it, k) {
        P['d' + it.a] = it.v;
        fl('wq', 'cm', wCard(it.a, it.v), k * 90);
        fl('cm', 'plc', wCard(it.a, it.v), k * 90 + dur() * 0.6);
      });
      if (items.length) lg('通訊迴圈：Flush Queue 一次拿走 ' + items.length + ' 張 → For Loop 依序寫 ' + items.map(function (it) { return 'D' + it.a + '=' + it.v; }).join('、'));
      var old = S.nt ? S.nt.w : null;
      S.nt = { w: w, seq: ++S.ntSeq };
      if (!old || old.step !== w.step || old.b0 !== w.b0 || old.alarm !== w.alarm) fl('cm', 'nt', nCard(S.nt));
      c.next = S.t + (S.slow ? 6 : 1);
    }

    /* ---------- ③ UI 迴圈 ---------- */
    function uiLoop() {
      var u = S.ui; if (!u.alive || S.t < u.next) return;
      u.next = S.t + 2; u.n++;
      if (!S.ntAlive) { stopLoop('ui', 'Wait on Notification 出錯（Notifier 已被 Release）。課文 A7：Release 沒接 error in，所有迴圈一開始就停'); return; }
      if (S.ntSeq > u.seen) {
        var nw = S.nt.w;
        if (u.last && (u.last.step !== nw.step || u.last.alarm !== nw.alarm)) fl('nt', 'ui', nCard(S.nt));
        u.last = nw; u.seen = S.ntSeq; u.to = false;
      } else u.to = true;
      var L = u.latch; u.latch = {};
      var step = u.last ? u.last.step : -1;
      // 命令鈕：Select 鏈，同一圈只送一個，Start 優先
      var n = (L.start ? 1 : 0) + (L.cstop ? 1 : 0) + (L.reset ? 1 : 0);
      if (n) {
        var cmd = L.start ? 1 : L.cstop ? 2 : 3;
        if (n > 1) lg('UI 迴圈：同一圈讀到 ' + n + ' 個命令鈕，Select 鏈只送一個（Start 優先）');
        enq(100, cmd, 'ui', 'UI 迴圈');
      }
      // 故障注入：變了才寫
      var f = S.estop ? 1 : 0;
      if (f !== u.fault) { u.fault = f; enq(550, f, 'ui', 'UI 迴圈（E-Stop 開關變了）'); }
      // 參數：只在 Idle 寫
      if (S.speed !== u.pSpeed) {
        if (step === 30) { enq(530, S.speed, 'ui', 'UI 迴圈（Speed 改了，現在是 Idle）'); u.pSpeed = S.speed; u.waitSpeed = false; }
        else if (!u.waitSpeed) { u.waitSpeed = true; lg('UI 迴圈：Speed 改成 ' + S.speed + '，可是 PLC 不在 Idle，先不寫，回到 Idle 那一圈才寫'); }
      }
      if (L.read) lg('UI 迴圈：「讀 PLC 狀態」<b>不用送任何訊息</b>，直接看 Notifier 最新一筆：步序 ' + (u.last ? u.last.step : '—') + '、OK ' + (u.last ? u.last.ok : 0) + '、NG ' + (u.last ? u.last.ng : 0) + (u.to ? '（這圈逾時，是舊值）' : ''));
      if (!isExit) return;
      // Exit：閂鎖 + 等 PLC 停好
      var now = !!L.exit || u.leaving, first = now && !u.leaving;
      if (first) {
        u.since = S.t; stg('按 Exit');
        lg('UI 迴圈：讀到 Exit → 閂鎖「要離開」，記下時間');
        if (enq(100, 2, 'ui', 'UI 迴圈（第一次：做完這顆再停）')) stg('Enqueue D100=2');
        if (S.scn === 'early') {
          lg('（錯誤示範）UI 迴圈不等 PLC，<b>馬上</b> Release 全部參照');
          releaseNt(); releaseWq(); releaseMq(); stg('立刻 Release 全部');
          u.leaving = true;
          stopLoop('ui', '迴圈停止');
          return;
        }
      }
      u.leaving = now;
      if (now) {
        var why = step === 30 ? 'PLC 回到 30 Idle' : step >= 900 ? 'PLC 在警報中（步序 ' + step + '）' : S.t - u.since >= 200 ? '已經過 20 秒（Exit timeout，交給 PLC 的心跳保護）' : '';
        if (why) {
          stg('等 PLC 回 Idle'); u.why = why;
          stopLoop('ui', 'Exit 條件成立：' + why + ' → 迴圈停止');
          if (S.scn === 'right') {
            lg('Release Notifier 的 error in 接 UI 迴圈的錯誤線 → <b>現在</b>才輪到它執行');
            releaseNt(); stg('Release Notifier');
            releaseWq(); stg('Release 寫入佇列');
          }
        } else u.msg = 'Exit Status：Stopping...（等 PLC 做完這顆，現在步序 ' + step + '）';
      }
    }

    /* ---------- ④ 檢測迴圈 ---------- */
    function finishInspect() {
      var n = S.ins, r = Math.random() < 0.8 ? 1 : 2;
      n.seen = S.ntSeq;   // ignore previous = True：下一次只等新的通知
      lg('檢測迴圈：ID ' + n.pid + ' 檢測完成 → ' + (r === 1 ? 'OK' : 'NG'));
      if (!enq(510, r, 'ins', '檢測迴圈')) {
        S.lost.push({ t: 'D511=1', why: 'D510 的 Enqueue 出錯，錯誤線接下去，後面的 Enqueue 不執行' });
        S.lost.push({ t: 'MES #' + n.pid, why: '錯誤線接下去，MES 的 Enqueue 也不執行' });
        return;
      }
      enq(511, 1, 'ins', '檢測迴圈（錯誤線串在 D510 後面）');
      var it = { pid: n.pid, r: r };
      if (!S.mqAlive) { S.lost.push({ t: 'MES #' + n.pid, why: 'MES 佇列已被 Release' }); lg('檢測迴圈：Enqueue MES → 出錯（MES 佇列已被 Release）'); return; }
      S.mq.push(it); fl('ins', 'mq', mCard(it), dur() * 0.5);
      lg('檢測迴圈：Enqueue {"part_id":' + n.pid + ',"result":"' + (r === 1 ? 'OK' : 'NG') + '"} → MES 佇列');
    }
    function insLoop() {
      var n = S.ins; if (!n.alive) return;
      if (n.busy > 0) { n.busy--; if (n.busy === 0) finishInspect(); return; }
      if (!S.ntAlive) { stopLoop('ins', S.scn === 'right' ? 'Wait on Notification 等待中 Notifier 被 Release → 錯誤 1122 → 迴圈停止' : 'Notifier 已經被 Release，參照無效 → Wait on Notification 出錯 → 迴圈停止（正在等待時被 Release 才是 1122）'); return; }
      if (S.ntSeq > n.seen) {
        n.seen = S.ntSeq; n.waitT = 0; n.n++;
        var w = S.nt.w, b0 = w.b0;
        if (b0 && !n.prev) { n.busy = 14; n.pid = w.pid; fl('nt', 'ins', nCard(S.nt)); lg('檢測迴圈：b0 上升緣 → 取像、檢測 ID ' + w.pid + '（約 1.4 秒，這段時間沒在等通知）'); }
        else if (!b0 && n.prev) { lg('檢測迴圈：b0 下降緣（PLC 收到結果了）'); enq(511, 0, 'ins', '檢測迴圈'); }
        n.prev = b0;
      } else { n.waitT++; if (n.waitT >= 5) { n.waitT = 0; n.n++; n.to++; } }
    }

    /* ---------- ① MES 迴圈 ---------- */
    function mesLoop() {
      var m = S.mes; if (!m.alive) return;
      if (m.post > 0) {
        m.post--;
        if (m.post === 0 && m.pending.length) {
          var it = m.pending[0];
          if (S.mesDown) { m.fail++; lg('MES 迴圈：上傳 #' + it.pid + ' <b>失敗</b> → 留在待送清單，下一圈再試（生產不受影響）'); }
          else { m.pending.shift(); m.ok++; lg('MES 迴圈：#' + it.pid + ' 上傳成功，從待送清單刪掉'); }
        }
        return;
      }
      if (!S.mqAlive) { stopLoop('mes', S.scn === 'right' ? 'Dequeue 等待中 MES 佇列被 Release → 錯誤 1122 → 迴圈停止（前面板 Exit Error 會看到 1122，這是預期的）' : 'MES 佇列已經被 Release，參照無效 → Dequeue 出錯 → 迴圈停止（正在等待時被 Release 才是 1122）'); return; }
      if (S.mq.length) { var x = S.mq.shift(); m.pending.push(x); fl('mq', 'mes', mCard(x)); }
      else { m.waitT++; if (m.waitT < 2) return; }
      m.waitT = 0; m.n++;
      if (m.pending.length) m.post = S.mesDown ? 5 : 3;
    }

    function allDead() { return !S.ui.alive && !S.cm.alive && !S.ins.alive && !S.mes.alive; }
    function tick() {
      if (S.fin) return;
      S.t++;
      plcScan(); uiLoop(); commLoop(); insLoop(); mesLoop();
      if (isExit && S.hx && allDead() && S.t - S.endT >= 30) {
        S.fin = true; if (timer) { clearInterval(timer); timer = null; }
        lg('LabVIEW 全部結束了，PLC 還在自己掃描：步序 ' + S.plc.step + ' ' + (STEPN[S.plc.step] || '') + (S.plc.alarm ? '，警報 ' + S.plc.alarm : ''));
      }
      draw();
    }

    /* ---------- 畫面 ---------- */
    function led(alive, busy) { return '<span class="led ' + (!alive ? 'err' : busy ? 'busy' : 'on') + '"></span>'; }
    function draw() {
      var P = S.plc, u = S.ui, c = S.cm, n = S.ins, m = S.mes, run = !!timer, h;
      // UI
      var lw = u.last;
      h = '<h4>' + led(u.alive) + '③ UI 迴圈 <small>約 200 ms 一圈</small></h4><div class="st">';
      if (!u.alive) h += u.err;
      else if (u.leaving) h += u.msg || 'Exit Status：Stopping...';
      else h += '讀前面板按鈕 → 要寫 PLC 就 Enqueue；等通知更新畫面。';
      h += '</div><div class="kv">畫面：步序 ' + (lw ? lw.step + ' ' + (STEPN[lw.step] || '') : '—') + '　OK ' + (lw ? lw.ok : 0) + '　NG ' + (lw ? lw.ng : 0) + (lw && lw.alarm ? '<br><span style="color:#dc2626">警報：' + esc(lw.alarm) + '</span>' : '') +
        '<br>Notifier：' + (!u.alive ? '—' : u.to ? '<span style="color:#b45309">逾時，顯示舊值</span>' : '有新資料') + '　第 ' + u.n + ' 圈</div>';
      bx.ui.innerHTML = h; bx.ui.className = BASE.ui + (!u.alive ? ' end' : run ? ' run' : '');
      // 寫入佇列
      h = '<h4>寫入佇列 <small>U32 = 位址×65536＋值</small></h4><div class="cards">';
      h += !S.wqAlive ? '<span class="empty">已 Release</span>' : S.wq.length ? S.wq.map(function (x) { return wCard(x.a, x.v); }).join('') : '<span class="empty">（空的）</span>';
      h += '</div><small class="why">UI、檢測迴圈放；只有通訊迴圈拿（Flush Queue）。</small>';
      bx.wq.innerHTML = h; bx.wq.className = BASE.wq + (S.wqAlive ? '' : ' dead');
      // 通訊
      h = '<h4>' + led(c.alive, c.alive && S.slow && S.t < c.next - 1) + '② 通訊迴圈 <small>唯一跟 PLC 講話</small></h4><div class="st">';
      if (!c.alive) h += c.err;
      else if (S.slow && S.t < c.next - 1) h += '<b>等 PLC 回覆中…</b>（這一圈變慢了，別的迴圈照跑）';
      else h += '每圈：讀 D300×16、D400×4 → 寫心跳 D520 → Flush 寫入佇列寫進 PLC → Send Notification。';
      h += '</div><div class="kv">心跳 D520 = ' + c.beat + '　第 ' + c.n + ' 圈</div>';
      bx.cm.innerHTML = h; bx.cm.className = BASE.cm + (!c.alive ? ' end' : S.slow && S.t < c.next - 1 ? ' busy' : run ? ' run' : '');
      // 檢測
      h = '<h4>' + led(n.alive, n.busy > 0) + '④ 檢測迴圈 <small>等通知 timeout 500 ms</small></h4><div class="st">';
      if (!n.alive) h += n.err;
      else if (n.busy > 0) h += '<b>檢測中</b>：ID ' + n.pid + '，還要 ' + (n.busy / 10).toFixed(1) + ' 秒（取像＋三項檢查）<div class="bar" style="width:' + Math.round(100 * (14 - n.busy) / 14) + '%"></div>';
      else h += '等通知中（ignore previous = T）：b0 上升緣就檢測，下降緣就寫 D511=0。上一次 b0 = ' + n.prev;
      h += '</div><div class="kv">第 ' + n.n + ' 圈　逾時 ' + n.to + ' 次</div>';
      bx.ins.innerHTML = h; bx.ins.className = BASE.ins + (!n.alive ? ' end' : n.busy > 0 ? ' busy' : run ? ' run' : '');
      // Notifier
      h = '<h4>Notifier <small>只留最新一筆</small></h4><div class="cards">';
      h += !S.ntAlive ? '<span class="empty">已 Release</span>' : S.nt ? nCard(S.nt) : '<span class="empty">（還沒有通知）</span>';
      h += '</div><small class="why">通訊迴圈每圈送一次（21 個字），新的蓋掉舊的；UI 和檢測迴圈都收得到同一筆。</small>';
      bx.nt.innerHTML = h; bx.nt.className = BASE.nt + (S.ntAlive ? '' : ' dead');
      // PLC
      h = '<h4 style="color:#b45309">PLC <small>自己一直在掃描</small></h4><div class="kv">D300 步序 = <b>' + P.step + ' ' + (STEPN[P.step] || '') + '</b><br>警報：' + (P.alarm ? '<b style="color:#dc2626">' + esc(P.alarm) + '</b>' : '無') +
        '<br>b0 請求檢測 = ' + P.b0 + '　D306 = ' + P.pid + '<br>D510 = ' + P.d510 + '　D511 = ' + P.d511 + '<br>D520 = ' + P.d520 + '（' + (P.beatT / 10).toFixed(1) + ' 秒沒變）<br>D530 = ' + P.d530 + '　D550 = ' + P.d550 + '　OK ' + P.ok + ' / NG ' + P.ng + '</div>';
      bx.plc.innerHTML = h;
      // MES 佇列
      h = '<h4>MES 佇列 <small>字串（JSON）</small></h4><div class="cards">';
      h += !S.mqAlive ? '<span class="empty">已 Release</span>' : S.mq.length ? S.mq.map(function (x) { return mCard(x); }).join('') : '<span class="empty">（空的）</span>';
      h += '</div><small class="why">檢測迴圈放，MES 迴圈拿。</small>';
      bx.mq.innerHTML = h; bx.mq.className = BASE.mq + (S.mqAlive ? '' : ' dead');
      // MES
      h = '<h4>' + led(m.alive, m.post > 0) + '① MES 迴圈 <small>網路慢不卡生產</small></h4><div class="st">';
      if (!m.alive) h += m.err;
      else if (m.post > 0) h += (S.mesDown ? '上傳中…（伺服器沒回應）' : '上傳中…') + ' #' + m.pending[0].pid;
      else h += 'Dequeue 等資料（timeout 200 ms），然後 MES_Flush 送待送清單最前面一筆。';
      h += '</div><div class="kv">待送清單：</div><div class="cards">' + (m.pending.length ? m.pending.map(function (x) { return mCard(x); }).join('') : '<span class="empty">（空的）</span>') + '</div><div class="kv">已上傳 ' + m.ok + ' 筆　失敗 ' + m.fail + ' 次　第 ' + m.n + ' 圈</div>';
      bx.mes.innerHTML = h; bx.mes.className = BASE.mes + (!m.alive ? ' end' : m.post > 0 ? ' busy' : run ? ' run' : '');
      // Host_Exit / 圈數
      if (isExit) h = '<h4>Host_Exit</h4><div class="st">' + (S.hx ? '<b>已執行</b>：MES 結批、關伺服、關相機。' : '還沒執行：它的 error in 接在 MES 迴圈後面，最後才輪到它。') + '</div>';
      else h = '<h4>四個迴圈各跑各的</h4><div class="kv">UI ' + u.n + ' 圈　通訊 ' + c.n + ' 圈<br>檢測 ' + n.n + ' 圈　MES ' + m.n + ' 圈</div><small class="why">Host_Exit（結束時才執行）在「③ 結束順序」分頁。</small>';
      bx.hx.innerHTML = h;
      $(pre + 't').textContent = (S.t / 10).toFixed(1);
      $(pre + 'run').textContent = run ? '⏸ 暫停' : '▶ 開始執行';
      $(pre + 'run').disabled = S.fin; $(pre + 'step').disabled = S.fin;
      if (isExit) drawExit(); else drawMulti();
    }
    function drawMulti() {
      var P = S.plc;
      if (P.alarm) say('msay', 'PLC 警報中：' + esc(P.alarm) + '。' + (S.estop ? '先把 E-Stop 放開，' : '') + '再按 Reset（D100=3）回到 Idle。', 'bad');
      else if (S.ins.busy > 0) say('msay', '檢測迴圈正在忙 1.4 秒，看通訊迴圈的圈數和心跳 D520：照樣在跑。PLC 的心跳沒有停，所以不會 9006。');
      else if (S.slow) say('msay', '通訊迴圈一圈變 600 ms：UI 迴圈等通知 200 ms 就逾時，畫面先顯示舊值，迴圈本身照跑；心跳變慢但還在 2 秒內，PLC 不會報警。');
      else if (S.mesDown && S.mes.pending.length) say('msay', 'MES 斷線：待送 ' + S.mes.pending.length + ' 筆，生產照跑。取消勾選就會一筆一筆補送。');
      else if (P.step === 30 && S.t > 3) say('msay', 'PLC 在 Idle。按 Start，看卡片從 UI 迴圈 → 寫入佇列 → 通訊迴圈 → PLC。');
      else say('msay', '');
    }
    function drawExit() {
      var sc = XSC.filter(function (x) { return x.k === S.scn; })[0], nxt = true;
      $('xflow').innerHTML = sc.stages.map(function (s) {
        var c = S.stages[s] ? 'done' : '';
        if (!c && nxt && (S.exitPressed || S.scn === 'nowire')) { nxt = false; c = 'on'; }
        return '<span class="' + c + '">' + s + '</span>';
      }).join('');
      $('xlost').innerHTML = S.lost.length ? S.lost.map(function (l) { return '<span class="mcard ' + (l.benign ? 'bad' : 'lost') + '">' + esc(l.t) + '<small>' + esc(l.why) + '</small></span>'; }).join('') : '<span class="empty">（沒有）</span>';
      $('xexit').disabled = S.fin || S.exitPressed;
      $('xexit').classList.toggle('on', S.exitPressed);
      var P = S.plc, bad = S.lost.filter(function (l) { return !l.benign; });
      if (S.fin) {
        if (S.scn === 'right') {
          if (!bad.length) say('xsay', '✔ 照順序關：' + (S.ui.why || '') + '之後 UI 迴圈才停；通訊、檢測迴圈因為 Notifier 被 Release 而停，MES 迴圈因為 MES 佇列被 Release 而停，最後 Host_Exit。PLC 停在 ' + P.step + ' ' + (STEPN[P.step] || '') + '，寫入佇列沒有遺失，MES 上傳 ' + S.mes.ok + ' 筆。', 'ok');
          else say('xsay', '順序對了，但還是有 ' + bad.length + ' 件事沒做到，看上面的清單。', 'bad');
        } else if (S.scn === 'early') {
          if (P.alarm) say('xsay', '✖ D100=2 還在寫入佇列裡就被 Release，PLC 沒收到「做完這顆再停」；通訊迴圈一停，心跳 D520 不再變，PLC 報 ' + esc(P.alarm) + '，停在步序 ' + P.step + '，零件卡在機台裡。共 ' + bad.length + ' 件事沒做到。', 'bad');
          else say('xsay', bad.length ? '✖ 有 ' + bad.length + ' 件事沒做到（看上面清單）。這次 PLC 剛好不在生產中，所以沒有心跳警報；在檢測中按 Exit 再試一次。' : '這次 PLC 剛好在 Idle，看起來沒出事。按「重來」，等檢測迴圈在檢測時再按 Exit。', bad.length ? 'bad' : '');
        } else say('xsay', '✖ Release Notifier 沒接 error in，程式一開始就執行了：所有迴圈立刻停，前面板的 Start 根本送不到 PLC。把 error in 接回 UI 迴圈出來的錯誤線就好了。', 'bad');
      } else if (S.scn === 'nowire') say('xsay', '');
      else if (!S.exitPressed && S.ins.busy > 0) say('xsay', '檢測迴圈正在檢測：現在按 Exit 試試。');
      else if (!S.exitPressed) say('xsay', '機台在跑，等檢測迴圈開始檢測（b0 上升）再按 Exit。');
      else if (S.ui.alive && S.ui.leaving) say('xsay', 'UI 迴圈還在跑：Exit Status 顯示 Stopping...，等 PLC 做完這顆回到 Idle。其他迴圈都還正常工作。');
      else say('xsay', '');
    }

    /* ---------- 控制 ---------- */
    function start() { if (S.fin || timer) return; timer = setInterval(tick, interval()); draw(); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } draw(); }
    api.reset = reset;
    api.tick = function (k) { k = k || 1; for (var i = 0; i < k && !S.fin; i++) tick(); return S; };
    api.toggle = function () { if (timer) stop(); else start(); };
    api.start = start; api.stop = stop;
    api.running = function () { return !!timer; };
    api.pause = function (off) { if (off) { if (timer) { stop(); resume = true; } } else if (resume) { resume = false; start(); } };
    api.respeed = function () { if (timer) { clearInterval(timer); timer = setInterval(tick, interval()); } };
    api.press = function (b) {
      if (b === 'exit') {
        if (!isExit) return;
        if (!S.ui.alive) { lg('前面板：按 Exit，可是 UI 迴圈已經停了，沒有人讀'); S.exitPressed = true; draw(); return; }
        S.exitPressed = true;
      }
      S.ui.latch[b] = true;
      var nm = { start: 'Start', cstop: 'Cycle Stop', reset: 'Reset', exit: 'Exit', read: '讀 PLC 狀態' }[b] || b;
      lg('前面板：按 ' + nm + '（Latch 按鈕，等 UI 迴圈下一圈讀到）');
      draw();
    };
    api.set = function (k, v) {
      if (k === 'estop') { S.estop = !!v; lg('前面板：E-Stop ' + (v ? 'ON' : 'OFF') + '（開關會一直維持，UI 迴圈只在改變時寫 D550）'); }
      else if (k === 'slow') { S.slow = !!v; lg(v ? 'PLC 回覆變慢：通訊迴圈一圈變 600 ms' : 'PLC 回覆恢復正常'); }
      else if (k === 'mesDown') { S.mesDown = !!v; lg(v ? 'MES 伺服器斷線' : 'MES 伺服器恢復'); }
      else if (k === 'speed') { S.speed = +v; lg('前面板：Speed 改成 ' + v + '%'); }
      draw();
    };
    api.S = function () { return S; };
    return api;
  }

  var XSC = [
    { k: 'right', name: '✔ 照課文 A7：UI 迴圈等 PLC 停好才停 → Release Notifier（error in 接 UI 迴圈）→ 通訊、檢測迴圈停 → Release MES 佇列 → MES 迴圈停 → Host_Exit',
      stages: ['按 Exit', 'Enqueue D100=2', '等 PLC 回 Idle', 'UI 迴圈停', 'Release Notifier', 'Release 寫入佇列', '通訊迴圈停', '檢測迴圈停', 'Release MES 佇列', 'MES 迴圈停', 'Host_Exit'] },
    { k: 'early', name: '✖ 錯的順序：按 Exit 送出 D100=2 後，馬上 Release Notifier 和兩個佇列，不等 PLC、不等迴圈',
      stages: ['按 Exit', 'Enqueue D100=2', '立刻 Release 全部', 'UI 迴圈停', '通訊迴圈停', 'MES 迴圈停', 'Host_Exit', '檢測迴圈停'] },
    { k: 'nowire', name: '✖ 錯的接線：Release Notifier 的 error in 沒接（課文說最常見的錯）',
      stages: ['程式開始', 'Release Notifier 立刻執行', 'Release 寫入佇列', '通訊迴圈停', 'UI 迴圈停', '檢測迴圈停', 'Release MES 佇列', 'MES 迴圈停', 'Host_Exit'] }
  ];

  /* ---------- 分頁 2 ---------- */
  var M = makeSim('m', false);
  M.reset();
  $('mrun').onclick = M.toggle; $('mstep').onclick = function () { M.tick(1); }; $('mreset').onclick = function () { M.reset(); };
  $('mspeed').onchange = M.respeed;
  $('mstart').onclick = function () { M.press('start'); };
  $('mcstop').onclick = function () { M.press('cstop'); };
  $('mresetb').onclick = function () { M.press('reset'); };
  $('mread').onclick = function () { M.press('read'); };
  $('mestop').onclick = function () { var on = !M.S().estop; $('mestop').classList.toggle('on', on); M.set('estop', on); };
  $('mspd').onchange = function () { M.set('speed', $('mspd').value); };
  $('mslow').onchange = function () { M.set('slow', $('mslow').checked); };
  $('mmesdown').onchange = function () { M.set('mesDown', $('mmesdown').checked); };

  /* ---------- 分頁 3 ---------- */
  var X = makeSim('x', true), xk = 'right';
  function xPick(k) {
    xk = k || xk;
    Array.prototype.forEach.call($('xscn').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.k === xk); });
    X.reset(xk);
  }
  XSC.forEach(function (s) { var b = el('button', '', s.name); b.type = 'button'; b.dataset.k = s.k; b.onclick = function () { xPick(s.k); }; $('xscn').appendChild(b); });
  $('xrun').onclick = X.toggle; $('xstep').onclick = function () { X.tick(1); }; $('xreset').onclick = function () { xPick(); };
  $('xexit').onclick = function () { X.press('exit'); };
  $('xspeed').onchange = X.respeed;
  xPick('right');

  /* ---------- 分頁切換：看不到的分頁暫停計時器 ---------- */
  function sync() {
    var hid = document.hidden;
    if ((cur !== 'qmh' || hid) && Q.timer) { clearInterval(Q.timer); Q.timer = null; Q.resume = true; qDraw(); }
    else if (cur === 'qmh' && !hid && Q.resume) { Q.resume = false; qStart(); }
    M.pause(cur !== 'multi' || hid);
    X.pause(cur !== 'exit' || hid);
  }
  function show(t) {
    cur = t;
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['qmh', 'multi', 'exit', 'quiz'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
    sync();
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  document.addEventListener('visibilitychange', sync);
  if (/^#(qmh|multi|exit|quiz)$/.test(location.hash)) show(location.hash.slice(1));

  window.QmhLab = {
    show: show, current: function () { return cur; },
    qNew: qNew, qTick: qTick, qPress: function (m) { qPress(m); }, qToggle: qToggle, Q: function () { return Q; },
    multi: M, exit: X, xPick: xPick, STEPN: STEPN
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function pickN(a, n) { var b = a.slice(), r = []; while (r.length < n && b.length) r.push(b.splice(Math.floor(Math.random() * b.length), 1)[0]); return r; }
  var EXITSEQ = ['UI 迴圈讀到 Exit，Enqueue D100=2', 'PLC 做完這顆，回到 30 Idle', 'UI 迴圈停止', 'Release Notifier', '檢測迴圈的 Wait on Notification 收到 1122 而停', 'Release MES 佇列', 'MES 迴圈的 Dequeue 收到 1122 而停', 'Host_Exit：結批、關伺服、關相機'];
  var KIND = [
    // 1. 送給自己的訊息排到尾端
    function () {
      var v = pickN(['Read PLC', 'Update UI', 'Log', 'Set Speed', 'Check Alarm'], 3);
      return { q: '訊息佇列裡依序有 <b>"' + v[0] + '"、"' + v[1] + '"</b>（"' + v[0] + '" 先放）。處理迴圈 Dequeue 拿到 "' + v[0] + '"，在這一頁用一般的 Enqueue Element 送 <b>"' + v[2] + '"</b> 給自己。接下來兩次 Dequeue 依序拿到？', ans: '"' + v[1] + '" → "' + v[2] + '"', wrong: ['"' + v[2] + '" → "' + v[1] + '"', '"' + v[0] + '" → "' + v[1] + '"', '"' + v[2] + '" → "' + v[0] + '"', '只拿到 "' + v[2] + '"，"' + v[1] + '" 被蓋掉'], ex: 'Enqueue Element 放到佇列尾端，先進先出，所以先拿到早就在排隊的 "' + v[1] + '"，才輪到自己剛送的 "' + v[2] + '"。佇列不會蓋掉任何一張。' };
    },
    // 2. 插隊
    function () {
      var v = pickN(['Read PLC', 'Update UI', 'Log', 'Set Speed'], 3);
      return { q: '佇列裡依序有 "' + v[0] + '"、"' + v[1] + '"、"' + v[2] + '"。Event 迴圈收到 Exit，用 <b>Enqueue Element at Opposite End</b> 放 "Exit"。下一次 Dequeue 拿到？', ans: '"Exit"', wrong: ['"' + v[0] + '"', '"' + v[2] + '"', '錯誤：佇列不能從出口端放', '三張都被清掉，只剩 "Exit"'], ex: 'Opposite End 是放到出口那一端，所以下一個就輪到它，適合緊急訊息。代價是：如果處理 Exit 就結束迴圈，後面那幾張就不會被處理了。' };
    },
    // 3. QMH vs 簡單狀態機
    function () {
      var n = p1([2, 3, 4]), b = pickN(['Start', 'Stop', 'Set Speed', 'Reset', 'Read PLC'], n), qmh = Math.random() < 0.5;
      return { q: '程式正在做一件要 2 秒的事。這段時間使用者依序按了 <b>' + b.join('、') + '</b>（' + n + ' 個不同的按鈕）。' + (qmh ? '用 <b>QMH</b>（Event 迴圈 + 訊息佇列），最後會處理幾個？' : '用<b>只在 Idle 讀按鈕、Shift Register 只存一個下一狀態的簡單狀態機</b>，回到 Idle 後會處理幾個？'), ans: qmh ? n + ' 個，照按的順序' : '1 個', wrong: qmh ? ['1 個', '0 個', (n - 1) + ' 個', '看 CPU 快慢，不一定'] : [n + ' 個，照按的順序', '0 個', (n - 1) + ' 個', n + ' 個，順序反過來'], ex: qmh ? 'Event 迴圈每按一次就 Enqueue 一張訊息，佇列先進先出，' + n + ' 張都在排隊，一張都不會掉。' : '一圈只能決定一個下一狀態，同時被讀到的其他按鈕就沒了（Latch 按鈕讀一次就彈回）。這就是課文 A2 說要改用 QMH 的原因。' };
    },
    // 4. 字串打錯
    function () {
      var t = p1([['Strat', 'Start'], ['Stpo', 'Stop'], ['exit', 'Exit'], ['Read  PLC', 'Read PLC']]);
      return { q: '訊息用<b>字串</b>。Event 頁 Enqueue 了 <b>"' + t[0] + '"</b>，可是處理迴圈的 Case 只有 "' + t[1] + '" 等幾頁，再加一個 Default 頁（Case 預設比對區分大小寫）。結果？', ans: '進 Default 頁，不會報錯，什麼事都沒做', wrong: ['執行前 Run 箭頭就斷掉，提醒你打錯', '自動對到最像的 "' + t[1] + '"', 'Dequeue 回傳錯誤 1122', '程式當掉'], ex: '字串比對只是比字，對不到就走 Default，LabVIEW 不會幫你檢查拼字。改用 Enum（做成 Type Def）當訊息，就只能選已經定義的值，不可能打錯。' };
    },
    // 5. 誰可以寫 PLC
    function () {
      var w = p1([['D100（Start 命令）', 'UI 迴圈'], ['D510 檢測結果', '檢測迴圈'], ['D550 故障注入', 'UI 迴圈'], ['D511=0（交握結束）', '檢測迴圈']]);
      return { q: '13_PLC 裡，' + w[1] + '要把 <b>' + w[0] + '</b> 寫進 PLC，正確做法是？', ans: 'Enqueue 一張 U32 到寫入佇列，交給通訊迴圈寫', wrong: ['在' + w[1] + '裡直接呼叫 PLC_WriteWord', '用 Send Notification 送給通訊迴圈', '寫進 Global Variable，讓通訊迴圈去讀', '自己再開一條 VISA 連線到 PLC'], ex: 'PLC 連線只有通訊迴圈擁有。兩個迴圈共用一條連線，封包會交錯、回覆對不上。命令不能掉，所以用 Queue，不用 Notifier。' };
    },
    // 6. U32 打包
    function () {
      var a = p1([100, 510, 511, 530, 550]), v = a === 100 ? p1([1, 2, 3]) : a === 510 ? p1([1, 2, 3]) : a === 511 ? p1([0, 1]) : a === 530 ? p1([60, 80, 100]) : p1([0, 1, 2, 3]);
      var u = a * 65536 + v, dec = Math.random() < 0.5;
      if (dec) return { q: '寫入佇列拿到一個 U32：<b>' + u + '</b>。通訊迴圈用 Split Number 拆開後，要寫哪裡、寫多少？', ans: 'D' + a + ' = ' + v, wrong: ['D' + v + ' = ' + a, 'D' + Math.floor(u / 10000) + ' = ' + (u % 10000), 'D' + (a + 1) + ' = ' + v, 'D' + a + ' = ' + (v + 1)], ex: u + ' ÷ 65536 = ' + a + ' 餘 ' + v + '：高 16 位元是位址，低 16 位元是值。' };
      return { q: '要把 <b>D' + a + ' = ' + v + '</b> 放進寫入佇列（元素 = 位址 × 65536 + 值），U32 是多少？', ans: String(u), wrong: [String(v * 65536 + a), String(a * 65536), String(a * 65535 + v), String(a * 1000 + v)], ex: a + ' × 65536 + ' + v + ' = ' + u + '。' };
    },
    // 7. 用哪種傳遞工具
    function () {
      var c = p1([
        ['通訊迴圈每 100 ms 讀到的 21 個字，要給 UI 和檢測迴圈', 'Notifier', '狀態只要最新一筆，而且兩個迴圈都要收：Notifier。Queue 的一個元素只會被一個 Dequeue 拿走。'],
        ['檢測迴圈的 D510、D511，要交給通訊迴圈寫進 PLC', 'Queue', '連續兩筆命令都不能掉、順序不能亂：Queue。Notifier 會把 D510 蓋掉。'],
        ['檢測結果的 JSON，要交給 MES 迴圈上傳', 'Queue', '每一筆都要上傳：Queue。'],
        ['檢測迴圈記住上一圈的 b0，用來判斷上升緣', 'Shift Register', '只有自己用、不跨迴圈：Shift Register。']]);
      return { q: '「' + c[0] + '」用哪一種最合適？', ans: c[1], wrong: ['Queue', 'Notifier', 'Shift Register', 'Local Variable'].filter(function (x) { return x !== c[1]; }), ex: c[2] + '記法：命令用 Queue，狀態用 Notifier。' };
    },
    // 8. 結束順序：下一步
    function () {
      var i = Math.floor(Math.random() * (EXITSEQ.length - 1));
      return { q: '照課文 A6、A7 的 Host_Main 結束順序，在「<b>' + EXITSEQ[i] + '</b>」之後，緊接著的下一步是？', ans: EXITSEQ[i + 1], wrong: EXITSEQ.filter(function (x, k) { return k !== i + 1 && k !== i; }), ex: '完整順序：' + EXITSEQ.join(' → ') + '。' };
    },
    // 9. Release 沒接 error in
    function () {
      var r = p1(['Release Notifier', 'Release Queue（寫入佇列）']);
      return { q: '方塊圖上 <b>' + r + '</b> 只接了參照線，error in 沒接任何東西。按 Run 會？', ans: '程式一開始就執行，迴圈馬上收到錯誤停止', wrong: ['等所有迴圈結束才執行，完全正常', '跳出對話框問你要不要釋放', 'LabVIEW 不允許，Run 箭頭會斷掉', '每一圈都釋放一次'], ex: 'LabVIEW 照資料流執行：輸入到齊就執行。error in 接迴圈出來的錯誤線，目的不是傳錯誤，而是讓它<b>等迴圈結束</b>才執行。' };
    },
    // 10. 檢測放進通訊迴圈
    function () {
      var t = p1([1.4, 2.5, 3]);
      return { q: '把檢測（取像＋判斷，約 <b>' + t + ' 秒</b>）直接放進通訊迴圈。PLC 2 秒沒看到心跳 D520 變化就報 9006。檢測那段時間會怎樣？', ans: t > 2 ? '通訊迴圈卡住、心跳不變，超過 2 秒 PLC 報 9006 停機' : '通訊迴圈卡住 ' + t + ' 秒：心跳不變、畫面不更新，還沒到 2 秒所以 PLC 不報警', wrong: t > 2 ? ['沒影響，心跳由 PLC 自己產生', 'PLC 會等檢測做完，不會報警', 'UI 迴圈會自動代替通訊迴圈送心跳', '只有畫面卡，PLC 不受影響'] : ['PLC 馬上報 9006', '沒影響，心跳由 PLC 自己產生', 'UI 迴圈會自動代替通訊迴圈送心跳', '檢測會變快'], ex: '心跳 D520 是通訊迴圈每圈 +1 寫進去的。通訊迴圈被慢工作卡住，心跳、讀取、寫入全部停。所以課文 A3 把檢測分到自己的迴圈。' };
    },
    // 11. MES 斷線
    function () {
      var n = p1([5, 10, 30]);
      return { q: '生產中 MES 伺服器斷線 ' + n + ' 分鐘。13_PLC 會怎樣？', ans: '照常生產，結果留在 MES 迴圈的待送清單，恢復後一筆一筆補送', wrong: ['PLC 停機，等 MES 恢復', '檢測迴圈卡住，PLC 報 9005', '結果直接丟掉', '通訊迴圈改去上傳 MES'], ex: 'MES 自己一個迴圈：HTTP 慢或失敗只影響它自己。MES_Flush 每圈送清單最前面一筆，失敗就留著下一圈再試。' };
    },
    // 12. Exit Error 1122
    function () {
      return { q: '程式正常按 Exit 結束後，前面板 Exit Error 顯示 <b>錯誤 1122</b>，來源是 Dequeue Element。代表？', ans: 'MES 佇列被 Release，正在等的 Dequeue 收到錯誤，MES 迴圈照設計停止', wrong: ['MES 伺服器壞了', '記憶體不足', 'PLC 斷線', '佇列滿了'], ex: '1122 是「等待中參照被釋放」。這是 Host_Main 用來停迴圈的方式，是預期的，不是故障；想讓畫面乾淨，可以只把 1122 清掉。' };
    },
    // 13. Notifier 逾時
    function () {
      var s = p1([0.6, 1, 1.5]);
      return { q: 'PLC 回覆變慢，通訊迴圈一圈要 ' + s + ' 秒。UI 迴圈用 Wait on Notification（timeout 200 ms），逾時就 Select 上一次的值。UI 迴圈會？', ans: '等不到就逾時，繼續顯示上一次的值，迴圈照跑', wrong: ['卡在 Wait on Notification 直到新資料來', '畫面全部變 0', '迴圈收到錯誤停止', '自己去讀 PLC'], ex: '逾時時 notification 輸出是預設值（全 0），所以課文 A6 用 Select：timed out ? last : notification，畫面停在最後狀態，不會一下全變 0。' };
    },
    // 14. Exit 等什麼
    function () {
      var a = ['PLC 回到 30 Idle', 'PLC 進入 900 以上的警報', 'PLC 斷線', '按 Exit 後已過 20 秒'];
      return { q: '按 Exit 後，UI 迴圈要等條件成立才停。下面哪一個<b>不是</b>它的停止條件？', ans: p1(['MES 待送清單全部上傳完', '檢測迴圈先停']), wrong: a, ex: 'UI 迴圈只等 PLC：回 Idle、警報、斷線，或 20 秒逾時（交給 PLC 的心跳保護）。MES 迴圈是在 UI 迴圈停了之後，由釋放連鎖讓它停的。' };
    },
    // 15. 讀狀態要不要送訊息
    function () {
      return { q: '13_PLC 的 UI 迴圈想顯示 PLC 目前的 OK、NG 數量（D311、D312）。要怎麼拿？', ans: '從 Notifier 最新一筆（21 個字）用 Index Array 取出來', wrong: ['Enqueue 一張「讀 D311」到寫入佇列', '在 UI 迴圈呼叫 PLC_ReadWords', '叫檢測迴圈去讀', '送訊息給 MES 迴圈'], ex: '通訊迴圈每圈都讀 D300 起 16 個字並廣播，D311、D312 就在裡面（索引 11、12）。讀狀態不用送命令，寫入佇列只放「要寫進 PLC」的東西。' };
    }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) window.QmhLab.quiz = window.LabQuiz('xquiz', gen);
  window.QmhLab.quizGen = gen; window.QmhLab.quizKinds = KIND;
})();
