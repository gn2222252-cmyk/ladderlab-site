/* 結構實驗室：Case 選擇器、Event 排隊、State Machine、Sequence 計時 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function roundEven(x) { var f = Math.floor(x), d = x - f; if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1; return Math.round(x); }

  /* ---------- 分頁 ---------- */
  var tabs = $('tabs');
  function show(t) {
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['case', 'event', 'sm', 'seq'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  if (/^#(case|event|sm|seq)$/.test(location.hash)) show(location.hash.slice(1));

  /* ---------- Case 選擇器 ---------- */
  var INT_CASES = [
    { lab: '..0', act: '顯示「未設定」', m: function (v) { return v <= 0; }, why: '「..0」表示 0 和所有負數' },
    { lab: '1', act: '啟動馬達', m: function (v) { return v === 1; } },
    { lab: '2..5', act: '低速運轉', m: function (v) { return v >= 2 && v <= 5; }, why: '「2..5」是範圍，含頭含尾' },
    { lab: '7, 9', act: '特殊模式', m: function (v) { return v === 7 || v === 9; }, why: '逗號分開是清單：7 或 9' },
    { lab: '10..', act: '高速運轉', m: function (v) { return v >= 10; }, why: '「10..」表示 10 以上全部' },
    { lab: 'Default', act: '其他值：顯示錯誤', def: true }
  ];
  var STR_CASES = [
    { lab: '"Start"', act: '開始量測', s: 'Start' },
    { lab: '"Stop"', act: '停止量測', s: 'Stop' },
    { lab: '"Reset"', act: '清除資料', s: 'Reset' },
    { lab: 'Default', act: '不認得的指令', def: true }
  ];
  var ENUM_VALS = ['Idle', 'Run', 'Stop', 'Error'];
  var ENUM_ACT = { Idle: '等待指令', Run: '執行量測', Stop: '關閉設備', Error: '顯示錯誤對話框' };

  function caseList(type) {
    if (type === 'int' || type === 'dbl') return INT_CASES;
    if (type === 'str') return STR_CASES;
    if (type === 'enum') return ENUM_VALS.map(function (v) { return { lab: '"' + v + '"', act: ENUM_ACT[v], e: v }; });
    return [{ lab: 'True', act: '馬達 ON', b: true }, { lab: 'False', act: '馬達 OFF', b: false }];
  }
  /* 回傳 {idx, why, broken} */
  function pick(type, raw, opt) {
    var list = caseList(type), i, why = '';
    if (type === 'int' || type === 'dbl') {
      var x = Number(raw);
      if (!isFinite(x)) return { idx: -1, why: '請輸入數字' };
      var v = x;
      if (type === 'dbl') {
        v = roundEven(x);
        why = 'DBL 接到整數頁籤的選擇器，先捨入成整數：' + x + ' → ' + v + (Math.abs(x - Math.floor(x) - 0.5) < 1e-9 ? '（剛好 .5 捨入到偶數）' : '') + '。';
      } else if (x !== Math.trunc(x)) {
        v = Math.trunc(x);
      }
      for (i = 0; i < list.length; i++) if (!list[i].def && list[i].m(v)) return { idx: i, why: why + v + ' 對到「' + list[i].lab + '」' + (list[i].why ? '（' + list[i].why + '）' : '') + '。' };
      return { idx: list.length - 1, why: why + v + ' 沒有對到任何頁籤，所以走 Default。' };
    }
    if (type === 'str') {
      for (i = 0; i < list.length; i++) {
        if (list[i].def) continue;
        if (raw === list[i].s || (opt.ci && raw.toLowerCase() === list[i].s.toLowerCase())) return { idx: i, why: '"' + raw + '" 對到 ' + list[i].lab + (raw !== list[i].s ? '（打開了 Case Insensitive Match）' : '') + '。' };
      }
      var near = list.filter(function (c) { return c.s && c.s.toLowerCase() === raw.toLowerCase(); })[0];
      return { idx: list.length - 1, why: '"' + raw + '" 沒有對到' + (near ? '：字串比對預設分大小寫，"' + raw + '" ≠ "' + near.s + '"。右鍵 Case 結構 ▸ Case Insensitive Match 可以不分大小寫' : '任何頁籤') + '，所以走 Default。' };
    }
    if (type === 'enum') {
      for (i = 0; i < list.length; i++) if (list[i].e === raw) return { idx: i, why: 'Enum 的頁籤直接寫值的名字，"' + raw + '" 就走這頁。四個值都有頁，所以不需要 Default。' };
      return { idx: -1, broken: true, why: '執行箭頭斷掉了！Type Def 新增了 "' + raw + '"，但 Case 結構沒有這一頁、也沒有 Default。解法：右鍵 Case ▸ Add Case for Every Value，一次補齊。這正是 Enum 的好處：漏掉的值會在編輯時就被抓到，不會等到執行才出錯。' };
    }
    var b = raw === true || raw === 'true';
    return { idx: b ? 0 : 1, why: '布林選擇器只有 True、False 兩頁，不能有 Default。' };
  }

  var cs = { type: 'int', val: '6', ci: false, pause: false };
  function renderInput() {
    var w = $('cinwrap'), t = cs.type;
    if (t === 'int') w.innerHTML = '<label>值 <input class="scalar" id="cin" type="number" step="1" value="' + esc(cs.val) + '" style="width:80px"></label> <button type="button" id="cdec">−1</button><button type="button" id="cinc">+1</button>';
    else if (t === 'dbl') w.innerHTML = '<label>值 <input class="scalar dbl" id="cin" value="' + esc(cs.val) + '" style="width:90px"></label> <span class="why">試 2.5、3.5、6.4、9.5</span>';
    else if (t === 'str') w.innerHTML = '<label>值 <input class="scalar" id="cin" value="' + esc(cs.val) + '" style="width:110px;color:#c026d3"></label> <label class="check small"><input type="checkbox" id="cci"' + (cs.ci ? ' checked' : '') + '> Case Insensitive Match</label>';
    else if (t === 'enum') {
      var vals = ENUM_VALS.concat(cs.pause ? ['Pause'] : []);
      w.innerHTML = '<label>值 <select id="cin">' + vals.map(function (v) { return '<option' + (v === cs.val ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label> <label class="check small"><input type="checkbox" id="cpause"' + (cs.pause ? ' checked' : '') + '> 在 Type Def 新增一個值 Pause（Case 還沒改）</label>';
    } else w.innerHTML = '<span class="sw' + (cs.val === 'true' ? ' on' : '') + '" id="cin" style="display:inline-flex;border:2px solid #1f9d3a;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:700">' + (cs.val === 'true' ? 'True' : 'False') + '</span>';
    var inp = $('cin');
    if (t === 'bool') inp.onclick = function () { cs.val = cs.val === 'true' ? 'false' : 'true'; renderInput(); renderCases(); };
    else inp.oninput = inp.onchange = function () { cs.val = inp.value; renderCases(); };
    if ($('cdec')) { $('cdec').onclick = function () { cs.val = String((parseInt(cs.val, 10) || 0) - 1); renderInput(); renderCases(); }; $('cinc').onclick = function () { cs.val = String((parseInt(cs.val, 10) || 0) + 1); renderInput(); renderCases(); }; }
    if ($('cci')) $('cci').onchange = function () { cs.ci = this.checked; renderCases(); };
    if ($('cpause')) $('cpause').onchange = function () { cs.pause = this.checked; if (cs.pause) cs.val = 'Pause'; else if (cs.val === 'Pause') cs.val = 'Idle'; renderInput(); renderCases(); };
  }
  function renderCases() {
    var list = caseList(cs.type), r = pick(cs.type, cs.type === 'str' ? cs.val : cs.val, { ci: cs.ci });
    var box = $('cases'); box.innerHTML = '';
    list.forEach(function (c, i) {
      var d = el('div', 'case' + (i === r.idx ? ' run' : ''));
      d.appendChild(el('span', 'sel', esc(c.lab) + (c.def ? '' : '')));
      d.appendChild(el('span', 'act', esc(c.act)));
      box.appendChild(d);
    });
    $('cwhy').innerHTML = (r.broken ? '<b style="color:#dc2626">✖ </b>' : '▶ ') + esc(r.why);
    $('cwhy').style.color = r.broken ? '#dc2626' : '';
  }
  $('ctype').onchange = function () {
    cs.type = this.value;
    cs.val = { int: '6', dbl: '2.5', str: 'stop', enum: 'Run', bool: 'true' }[cs.type];
    cs.pause = false;
    renderInput(); renderCases();
  };

  /* 猜一猜 */
  var quiz = { n: 0, ok: 0, cur: null };
  function newQuiz() {
    var kinds = [
      function () { var v = [-2, 0, 1, 5, 6, 8, 9, 10, 37][Math.floor(Math.random() * 9)]; return { type: 'int', val: String(v), text: 'I32 選擇器接 <b>' + v + '</b>，走哪一頁？' }; },
      function () { var v = ['2.5', '5.5', '6.5', '0.4', '9.5', '1.5'][Math.floor(Math.random() * 6)]; return { type: 'dbl', val: v, text: '選擇器接 DBL <b>' + v + '</b>（頁籤是上面那組整數），走哪一頁？' }; },
      function () { var v = ['Stop', 'stop', 'RESET', 'Start ', 'Start'][Math.floor(Math.random() * 5)]; return { type: 'str', val: v, text: '字串選擇器接 <b>"' + esc(v) + '"</b>（沒開 Case Insensitive），走哪一頁？' }; }
    ];
    var q = kinds[Math.floor(Math.random() * kinds.length)]();
    q.ans = pick(q.type, q.val, { ci: false }).idx;
    quiz.cur = q;
    $('cq').innerHTML = q.text;
    var box = $('cqopts'); box.innerHTML = '';
    caseList(q.type).forEach(function (c, i) {
      var b = el('button', '', esc(c.lab)); b.type = 'button';
      b.onclick = function () {
        if (!quiz.cur) return;
        quiz.n++; var good = i === q.ans; if (good) quiz.ok++;
        cs.type = q.type; cs.val = q.val; cs.ci = false; $('ctype').value = q.type; renderInput(); renderCases();
        $('cqscore').innerHTML = (good ? '✔ 答對！' : '✖ 答案是「' + esc(caseList(q.type)[q.ans].lab) + '」，上面已經換成這個值。') + '　答對 ' + quiz.ok + ' / ' + quiz.n + '　<button type="button" id="cqnext">下一題</button>';
        $('cqnext').onclick = newQuiz;
        quiz.cur = null;
      };
      box.appendChild(b);
    });
  }
  renderInput(); renderCases(); newQuiz();

  /* ---------- Event 結構：事件排隊 ---------- */
  var ev = { q: [], busy: false, running: true, iter: 0, toTimer: null, waitStart: 0, n: 0 };
  function evlog(s) { var l = $('evlog'); l.insertBefore(el('div', '', s), l.firstChild); }
  function stamp() { return (performance.now() / 1000).toFixed(1) + 's'; }
  function drawQueue() {
    var box = $('queue'); var keep = {};
    ev.q.forEach(function (e, i) {
      keep[e.id] = 1;
      var d = box.querySelector('[data-id="' + e.id + '"]');
      if (!d) { d = el('div', 'ev', esc(e.name)); d.dataset.id = e.id; d.style.left = (box.clientWidth || 600) + 'px'; box.appendChild(d); void d.offsetWidth; }
      d.style.left = (8 + i * 190) + 'px';
    });
    Array.prototype.forEach.call(box.querySelectorAll('.ev'), function (d) { if (!keep[d.dataset.id]) { d.style.left = '-200px'; d.style.opacity = '0'; setTimeout(function () { d.remove(); }, 450); } });
  }
  function handle(name, ms, cb) {
    ev.busy = true; ev.iter++;
    $('handler').classList.add('busy');
    $('hname').innerHTML = '第 ' + ev.iter + ' 圈：執行 <b>[' + esc(name) + ']</b> 這一頁' + (ms ? '（' + ms + ' ms）' : '');
    var bar = $('hbar'); bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth;
    bar.style.transition = 'width ' + ms + 'ms linear'; bar.style.width = '100%';
    setTimeout(function () { ev.busy = false; $('handler').classList.remove('busy'); bar.style.transition = 'none'; bar.style.width = '0'; cb(); }, ms);
  }
  function waitNext() {
    clearTimeout(ev.toTimer); ev.toTimer = null;
    if (!ev.running) { $('hname').textContent = '（迴圈已結束）'; return; }
    if (ev.q.length) {
      var e = ev.q.shift(); drawQueue();
      var waited = ((performance.now() - e.t) / 1000).toFixed(1);
      evlog(stamp() + '　開始處理「' + esc(e.name) + '」（在佇列等了 ' + waited + ' 秒）');
      var ms = e.stop ? 300 : (parseInt($('evms').value, 10) || 0);
      handle(e.name, ms, function () {
        if (e.stop) { ev.running = false; evlog(stamp() + '　Stop 頁輸出 True 給迴圈的停止條件 → While Loop 結束'); $('evstop').textContent = '▶ 重新執行 VI'; }
        waitNext();
      });
      return;
    }
    var to = parseInt($('evto').value, 10);
    $('hname').textContent = '第 ' + (ev.iter + 1) + ' 圈：Event 結構在等事件…' + (to >= 0 ? '（' + to + ' ms 沒事件就走 Timeout）' : '（Timeout = -1，一直等）');
    if (to >= 0) {
      ev.toTimer = setTimeout(function () {
        ev.toTimer = null;
        evlog(stamp() + '　' + to + ' ms 都沒有事件 → 執行 <b>Timeout</b> 頁（例如更新時間、輪詢 PLC）');
        handle('Timeout', 400, waitNext);
      }, Math.max(to, 50));
    }
  }
  function push(name, stop) {
    var e = { id: ++ev.n, name: name, t: performance.now(), stop: !!stop };
    if (!ev.running) { evlog(stamp() + '　「' + esc(name) + '」發生了，但迴圈已經結束，沒有 Event 結構在處理。'); return; }
    ev.q.push(e); drawQueue();
    evlog(stamp() + '　事件進佇列：' + esc(name) + (ev.busy ? '（目前在忙，先排隊）' : ''));
    if (!ev.busy && ev.toTimer !== null) waitNext();
    else if (!ev.busy) waitNext();
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-ev]'), function (b) { b.onclick = function () { push(b.dataset.ev); }; });
  $('evstop').onclick = function () {
    if (!ev.running) { ev.running = true; ev.iter = 0; ev.q = []; drawQueue(); $('evlog').innerHTML = ''; this.textContent = '按 Stop：Value Change → 結束迴圈'; evlog(stamp() + '　VI 重新執行'); waitNext(); return; }
    push('Stop：Value Change', true);
  };
  $('evto').onchange = function () { if (!ev.busy) waitNext(); };
  var evStarted = false;
  function startEvent() { if (!evStarted) { evStarted = true; evlog(stamp() + '　VI 開始執行，進入 While Loop'); waitNext(); } }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && b.dataset.t === 'event') startEvent(); });
  if (!$('t-event').hidden) startEvent();

  /* ---------- State Machine：洗衣機 ---------- */
  var STATES = ['Init', 'Idle', 'Fill', 'Wash', 'Spin', 'Pause', 'Done', 'Exit'];
  var ZH = { Init: '初始化', Idle: '待機', Fill: '進水', Wash: '洗衣', Spin: '脫水', Pause: '暫停', Done: '完成', Exit: '結束' };
  var DUR = { Fill: 3, Wash: 5, Spin: 4 };
  var sm = { st: 'Init', i: 0, left: 0, resume: null, door: false, startBtn: false, stopBtn: false, timer: null };
  var smd = $('smd');
  STATES.forEach(function (s, k) {
    if (k) smd.appendChild(el('span', 'arrow', k === 5 || k === 6 || k === 7 ? '·' : '→'));
    var d = el('div', 'st', ZH[s] + '<br><small style="font-weight:400">' + s + '</small>'); d.dataset.s = s; smd.appendChild(d);
  });
  var srBox = el('p', 'why'); smd.parentNode.insertBefore(srBox, smd.nextSibling);
  function smlog(s) { var l = $('smlog'); l.insertBefore(el('div', '', s), l.firstChild); }
  function smDraw() {
    Array.prototype.forEach.call(smd.querySelectorAll('.st'), function (d) { d.classList.toggle('on', d.dataset.s === sm.st); });
    srBox.innerHTML = '迴圈第 <b>' + sm.i + '</b> 圈　Shift Register 裡的狀態：<span class="scalar" style="color:#2563eb">' + sm.st + '</span>' + (sm.left ? '　這個狀態還剩 ' + sm.left + ' 圈' : '') + '　門：' + (sm.door ? '<b style="color:#dc2626">開</b>' : '關');
  }
  /* 每一圈：執行 Case[st]，回傳下一個狀態 */
  function caseRun(st) {
    switch (st) {
      case 'Init': return ['Idle', '初始化 I/O、清除畫面'];
      case 'Idle':
        if (sm.stopBtn) return ['Exit', '讀到 Stop 按鈕'];
        if (sm.startBtn && !sm.door) return ['Fill', '讀到「開始」按鈕，門是關的'];
        if (sm.startBtn && sm.door) return ['Idle', '按了開始，但門開著，不動作'];
        return ['Idle', '沒有按鈕，繼續待機'];
      case 'Fill': case 'Wash': case 'Spin':
        if (sm.door) { sm.resume = st; return ['Pause', '門被打開 → 暫停，記住要回到 ' + st]; }
        if (sm.left > 1) { sm.left--; return [st, '繼續' + ZH[st]]; }
        return [{ Fill: 'Wash', Wash: 'Spin', Spin: 'Done' }[st], ZH[st] + '完成'];
      case 'Pause':
        if (!sm.door) return [sm.resume, '門關上了，回到 ' + sm.resume];
        return ['Pause', '門還開著，等待'];
      case 'Done': return ['Idle', '響鈴三聲'];
    }
    return ['Exit', ''];
  }
  function smTick() {
    if (sm.st === 'Exit') { sm.i++; smDraw(); smlog('第 ' + sm.i + ' 圈 Case[Exit]：關閉設備，停止條件 = True，迴圈結束'); clearInterval(sm.timer); sm.timer = null; $('smstop').textContent = '▶ 重新執行'; return; }
    sm.i++;
    var cur = sm.st, r = caseRun(cur), nx = r[0];
    if (nx !== cur && DUR[nx] && cur !== 'Pause') sm.left = DUR[nx];
    if (nx === 'Pause' || cur === 'Pause' && nx !== 'Pause') { /* 保留剩餘圈數 */ }
    if (!DUR[nx] && nx !== 'Pause') sm.left = 0;
    var lost = sm.startBtn && sm.stopBtn ? '　<b style="color:#dc2626">（同一圈按了開始和 Stop，Idle 頁先判斷 Stop，「開始」被蓋掉）</b>' : '';
    if (cur === 'Idle') { sm.startBtn = false; sm.stopBtn = false; }
    smlog('第 ' + sm.i + ' 圈 Case[<b>' + cur + '</b>]：' + r[1] + ' → 下一圈 ' + nx + lost);
    sm.st = nx; smDraw();
  }
  function smRun() { if (!sm.timer) sm.timer = setInterval(smTick, 700); }
  $('smstart').onclick = function () { sm.startBtn = true; smlog('（按了「開始」，等 Idle 那一圈讀到）'); };
  $('smdoor').onclick = function () { sm.door = true; smDraw(); };
  $('smclose').onclick = function () { sm.door = false; smDraw(); };
  $('smstop').onclick = function () {
    if (sm.st === 'Exit' && !sm.timer) { sm.st = 'Init'; sm.i = 0; sm.left = 0; sm.door = false; sm.startBtn = sm.stopBtn = false; $('smlog').innerHTML = ''; this.textContent = '按 Stop'; smDraw(); smRun(); return; }
    sm.stopBtn = true; smlog('（按了 Stop，只有 Idle 頁會讀它）');
  };
  smDraw();
  var smStarted = false;
  function startSm() { if (!smStarted) { smStarted = true; smRun(); } }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && b.dataset.t === 'sm') startSm(); });
  if (!$('t-sm').hidden) startSm();

  /* ---------- Sequence 與 Tick Count ---------- */
  var tickBase = Math.floor(Math.random() * 4e9);
  function tick() { return (tickBase + Math.floor(performance.now())) >>> 0; }
  function seqlog(s) { var l = $('seqlog'); l.insertBefore(el('div', '', s), l.firstChild); }
  var frames = document.querySelectorAll('.frame');
  function lit(k) { Array.prototype.forEach.call(frames, function (f, i) { f.classList.toggle('on', i === k); }); }
  $('seqrun').onclick = function () {
    var btn = this; btn.disabled = true;
    var work = 200 + Math.floor(Math.random() * 700), noseq = $('noseq').checked;
    var order = noseq ? [0, 1, 2].sort(function () { return Math.random() - 0.5; }) : [0, 1, 2];
    var t0 = null, t1 = null, step = 0;
    $('dt').textContent = '?';
    function next() {
      if (step >= 3) {
        lit(-1); btn.disabled = false;
        var dt = (t1 - t0) >>> 0;
        if (dt > 1e9) dt = t1 - t0;
        $('dt').textContent = String(dt);
        var okOrder = order.join() === '0,1,2';
        seqlog((noseq ? '沒有 Sequence，這次執行順序：' + order.map(function (k) { return '第 ' + (k + 1) + ' 格'; }).join(' → ') + '。' : '') +
          '程式實際花 ' + work + ' ms，量到 ' + dt + ' ms' + (okOrder && Math.abs(dt - work) < 40 ? ' ✔' : (noseq ? ' ✖ 量錯了：沒有規定先後，Tick Count 可能在程式之前或之後才讀。' : '')) +
          (okOrder && noseq && Math.abs(dt - work) < 40 ? '（這次剛好順序對，但下次不一定）' : ''));
        return;
      }
      var k = order[step++]; lit(k);
      if (k === 0) setTimeout(function () { t0 = tick(); seqlog('t0 = ' + t0 + '（Tick Count 是開機後的毫秒數，本身沒意義，只能拿來相減）'); next(); }, 250);
      else if (k === 1) setTimeout(next, work);
      else { t1 = tick(); seqlog('t1 = ' + t1); setTimeout(next, 250); }
    }
    next();
  };

  window.StructLab = { pick: pick, roundEven: roundEven, ev: ev, sm: sm, show: show, smTick: smTick };
})();
