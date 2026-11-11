/* 變數實驗室：競爭條件、Stop 接法、FGV */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function log(id, s) { var l = $(id); l.insertBefore(el('div', '', s), l.firstChild); }

  var tabs = $('tabs');
  function show(t) {
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['race', 'stop', 'fgv'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
    if (t === 'stop' && !sp.timer && !sp.started) pickScn(sp.k);
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* ---------- 競爭條件 ---------- */
  var N = 3, rc;
  function rReset() { clearInterval(rc && rc.timer); rc = { x: 0, A: { i: 0, pc: 0, tmp: null }, B: { i: 0, pc: 0, tmp: null }, lost: 0, timer: null }; $('rlog').innerHTML = ''; rDraw(); $('rsay').textContent = ''; $('rsay').className = 'verdict-line'; }
  function rDraw() {
    ['A', 'B'].forEach(function (n) {
      var L = rc[n], done = L.i >= N, fg = $('rfgv').checked, t = L.tmp;
      var h = '<h3>迴圈 ' + n + '　' + (done ? '跑完了' : '第 ' + (L.i + 1) + ' / ' + N + ' 圈') + '</h3>';
      var steps = fg ? ['呼叫 FGV「Add 1」（讀、加、寫一次做完）'] : ['讀 x' + (L.pc > 0 ? ' → 讀到 ' + (L.pc === 1 ? t : t - 1) : ''), '加 1' + (L.pc > 1 ? ' → ' + t : ''), '寫回 x' + (L.pc === 2 ? '（準備寫入 ' + t + '）' : '')];
      steps.forEach(function (s, k) { h += '<div class="stepn' + (!done && k === L.pc ? ' on' : '') + (done || k < L.pc ? ' done' : '') + '">' + (k + 1) + '. ' + s + '</div>'; });
      $('box' + n).innerHTML = h;
    });
    $('rx').textContent = rc.x;
    $('ra').disabled = rc.A.i >= N; $('rb').disabled = rc.B.i >= N;
  }
  function bump() { var b = $('rx'); b.classList.add('bump'); setTimeout(function () { b.classList.remove('bump'); }, 250); }
  function rStep(n) {
    var L = rc[n], o = rc[n === 'A' ? 'B' : 'A']; if (L.i >= N) return;
    if ($('rfgv').checked) { rc.x++; L.i++; bump(); log('rlog', n + '：FGV 內部讀 ' + (rc.x - 1) + '、加 1、寫 ' + rc.x + '（另一個迴圈這時進不來，只能等）'); }
    else if (L.pc === 0) { L.tmp = rc.x; L.pc = 1; log('rlog', n + '：讀 x，讀到 ' + L.tmp); }
    else if (L.pc === 1) { L.tmp++; L.pc = 2; log('rlog', n + '：加 1，手上是 ' + L.tmp + '（x 還是 ' + rc.x + '）'); }
    else {
      var over = rc.x >= L.tmp; if (over) rc.lost++;
      log('rlog', n + '：把 ' + L.tmp + ' 寫回 x' + (over ? '　<b style="color:#dc2626">← x 本來已經是 ' + rc.x + '，被舊資料蓋掉，掉了一筆！</b>' : ''));
      rc.x = L.tmp; L.pc = 0; L.i++; bump();
    }
    rDraw();
    if (rc.A.i >= N && rc.B.i >= N) {
      var ok = rc.x === 2 * N;
      $('rsay').textContent = ok ? '✔ x = ' + rc.x + '，正確。' + ($('rfgv').checked ? '用 FGV 不管怎麼排都是 6。' : '這次的順序剛好沒有交錯；再試一次，讓 A 讀完換 B 讀。') : '✖ x = ' + rc.x + '，應該是 ' + 2 * N + '，少了 ' + (2 * N - rc.x) + '。兩邊都「讀到舊值」再各自寫回，後寫的蓋掉先寫的。';
      $('rsay').className = 'verdict-line ' + (ok ? 'ok' : 'bad');
    } else if (!$('rfgv').checked && L.pc === 1 && o.pc === 1 && o.tmp === L.tmp) { $('rsay').textContent = '注意：A 和 B 現在手上都拿著同一個舊值 ' + L.tmp + '。'; }
  }
  $('ra').onclick = function () { rStep('A'); }; $('rb').onclick = function () { rStep('B'); };
  $('rreset').onclick = rReset; $('rfgv').onchange = rReset;
  $('rauto').onclick = function () { rReset(); rc.timer = setInterval(function () { var c = []; if (rc.A.i < N) c.push('A'); if (rc.B.i < N) c.push('B'); if (!c.length) { clearInterval(rc.timer); return; } rStep(c[Math.floor(Math.random() * c.length)]); }, 220); };
  $('rdemo').onclick = function () { $('rfgv').checked = false; rReset(); var seq = ['A', 'B', 'A', 'A', 'B', 'B'], k = 0; rc.timer = setInterval(function () { if (k >= seq.length) { clearInterval(rc.timer); $('rsay').textContent = '兩個迴圈各跑完一圈，x 應該是 2，卻只有 ' + rc.x + '。繼續按，或按「隨機跑完」。'; return; } rStep(seq[k++]); }, 650); };
  rReset();

  /* ---------- 一顆 Stop 停兩個迴圈 ---------- */
  var SCN = [
    { k: 'two', name: '① 兩顆 Stop，各接各的迴圈', say: '可以停，但要按兩次，而且兩個迴圈不是同時停。' },
    { k: 'wire', name: '② 一顆 Stop 放在迴圈 1 裡，從迴圈 1 拉線到迴圈 2', say: '' },
    { k: 'latch', name: '③ Stop（預設 Latch 動作）＋ Local Variable', say: '' },
    { k: 'switch', name: '④ 機械動作改成 Switch When Pressed ＋ Local Variable，結束後寫回 False', say: '' }
  ];
  var sp = { k: 'two', timer: null, started: false };
  function sDraw() {
    $('i1').textContent = sp.i1; $('i2').textContent = sp.i2;
    $('lp1').className = 'lp' + (sp.r1 ? ' run' : ''); $('lp2').className = 'lp' + (sp.r2 ? ' run' : sp.w2 ? ' wait' : '');
    $('s1').textContent = sp.r1 ? '執行中' : sp.broken ? '不能執行' : '已停止'; $('s2').textContent = sp.r2 ? '執行中' : sp.w2 ? '還沒開始（等迴圈 1 的資料）' : sp.broken ? '不能執行' : '已停止';
    Array.prototype.forEach.call($('sbtns').querySelectorAll('.stopb'), function (b) { b.classList.toggle('on', !!sp['b' + b.dataset.n]); });
  }
  function pickScn(k) {
    clearInterval(sp.timer); sp = { k: k, i1: 0, i2: 0, r1: true, r2: true, w2: false, b1: false, b2: false, timer: null, started: true };
    Array.prototype.forEach.call($('scn').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.k === k); });
    var bt = $('sbtns'); bt.innerHTML = '';
    (k === 'two' ? [1, 2] : [1]).forEach(function (n) { var b = el('button', 'stopb', k === 'two' ? 'STOP ' + n : 'STOP'); b.type = 'button'; b.dataset.n = n; b.onclick = function () { press(n); }; bt.appendChild(b); });
    $('ssay').className = 'verdict-line'; $('ssay').textContent = '兩個迴圈都在跑，按 Stop。';
    if (k === 'wire') { sp.r2 = false; sp.w2 = true; $('ssay').textContent = '還沒按 Stop，迴圈 2 就沒在跑：線從迴圈 1 出來，資料要等迴圈 1「整個結束」才會送出，迴圈 2 只能等。'; }
    if (k === 'latch') { sp.r1 = sp.r2 = false; sp.broken = true; $('ssay').className = 'verdict-line bad'; $('ssay').textContent = '✖ 執行箭頭是斷的：Latch 動作的布林不能建立 Local Variable。因為 Latch 是「被讀一次就彈回」，兩個地方都在讀，LabVIEW 不知道該由誰負責彈回。'; }
    sDraw();
    if (!sp.broken) sp.timer = setInterval(sTick, 350);
  }
  function press(n) {
    if (sp.broken) return;
    if (sp.k === 'switch') { sp.b1 = true; } else sp['b' + n] = true;
    sDraw();
  }
  function sTick() {
    if (sp.r1) { sp.i1++; if (sp.b1) { sp.r1 = false; if (sp.k !== 'switch') sp.b1 = sp.k === 'two' ? false : sp.b1; } }
    if (sp.k === 'two') { if (sp.r2) { sp.i2++; if (sp.b2) { sp.r2 = false; sp.b2 = false; } } if (!sp.r1 && sp.r2) $('ssay').textContent = '迴圈 1 停了，迴圈 2 還在跑。再按 STOP 2。'; if (!sp.r1 && !sp.r2) end('可以停，但要按兩次，兩個迴圈也不是同時停。使用者只想按一次。'); }
    else if (sp.k === 'wire') {
      if (!sp.r1 && sp.w2) { sp.w2 = false; sp.r2 = true; sp.b1 = false; $('ssay').textContent = '迴圈 1 結束，True 從通道送出，迴圈 2 現在才開始…'; }
      else if (sp.r2) { sp.i2++; sp.r2 = false; end('✖ 迴圈 2 只跑了 1 圈：它拿到的是固定的 True，第一圈就停。用一條線把兩個迴圈連起來，它們就不再平行，而是一前一後。', true); }
    } else if (sp.k === 'switch') {
      if (sp.r2) { sp.i2++; if (sp.b1) sp.r2 = false; }
      if (!sp.r1 && !sp.r2) { clearInterval(sp.timer); sp.timer = null; sDraw(); $('ssay').className = 'verdict-line ok'; $('ssay').textContent = '✔ 兩個迴圈在同一圈內都停了（迴圈 1 讀端子、迴圈 2 讀 Local Variable）。按鈕還停在 True…'; setTimeout(function () { if (sp.k !== 'switch') return; sp.b1 = false; sDraw(); $('ssay').textContent += ' 兩個迴圈後面再用 Local Variable 寫入 False，把按鈕彈回來，下次執行才不會一開始就停。'; }, 1200); return; }
    }
    sDraw();
  }
  function end(msg, bad) { clearInterval(sp.timer); sp.timer = null; $('ssay').textContent = msg; $('ssay').className = 'verdict-line' + (bad ? ' bad' : ''); sDraw(); }
  SCN.forEach(function (s) { var b = el('button', '', s.name); b.type = 'button'; b.dataset.k = s.k; b.onclick = function () { pickScn(s.k); }; $('scn').appendChild(b); });
  $('srestart').onclick = function () { pickScn(sp.k); };

  /* ---------- FGV ---------- */
  var fg = { mem: 0 };
  function fcall(c, a) {
    var before = fg.mem, out = '';
    if (a === 'Init') { fg.mem = 0; out = 'Init：Shift Register 設成 0'; }
    else if (a === 'Add') { var d = c === '1' ? 5 : 1; fg.mem += d; out = 'Add：讀到 ' + before + '，加 ' + d + '，存回 ' + fg.mem; }
    else out = 'Get：讀到 ' + fg.mem + '，原樣存回';
    $('fact').textContent = 'Case：' + a; $('fsr').textContent = fg.mem; $('fsr').classList.add('flash'); setTimeout(function () { $('fsr').classList.remove('flash'); }, 350);
    $('f' + c).textContent = fg.mem; log('flog', 'VI ' + c + ' 呼叫 FGV → ' + out + '　（回傳 ' + fg.mem + '）');
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-c]'), function (b) { b.onclick = function () { fcall(b.dataset.c, b.dataset.a); }; });
  $('funload').onclick = function () { fg.mem = 0; $('fsr').textContent = 0; $('f1').textContent = $('f2').textContent = '–'; $('fact').textContent = 'Case：等待呼叫'; log('flog', '所有 VI 都關掉，FGV 離開記憶體。再打開時 Shift Register 回到型別的預設值 0。所以程式開頭要先呼叫一次 Init，不要依賴「剛好是 0」。'); };

  if (/^#(race|stop|fgv)$/.test(location.hash)) show(location.hash.slice(1));
  window.VarLab = { rStep: rStep, rc: function () { return rc; }, rReset: rReset, pickScn: pickScn, press: press, sTick: sTick, sp: function () { return sp; }, fcall: fcall, fg: fg, show: show };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  var KIND = [
    function () {
      var n = p1([2, 3, 5]);
      return { q: '兩個平行迴圈各做 <b>' + n + '</b> 次「讀 Local Variable x → 加 1 → 寫回 x」，x 從 0 開始。最後 x 可能是多少？', ans: '介於 ' + Math.max(2, n) + ' 和 ' + 2 * n + ' 之間都有可能', wrong: ['一定是 ' + 2 * n, '一定是 ' + n, '一定是 0', 'LabVIEW 會報錯，不能執行'], ex: '這是競爭條件：讀和寫之間另一個迴圈可能插進來，結果取決於執行順序，每次可能不同。' };
    },
    function () {
      return { q: 'Stop 按鈕的機械動作是預設的 <b>Latch When Released</b>，對它建立 Local Variable 給另一個迴圈讀，會怎樣？', ans: '執行箭頭斷掉，不能執行', wrong: ['兩個迴圈一起停', '只有第一個迴圈停', '要按兩次才停', '可以執行，但會出警告'], ex: 'Latch 動作的布林不能建立 Local Variable：被讀一次就彈回，兩個地方讀會讓結果不確定，所以 LabVIEW 直接禁止。改成 Switch 動作，結束後寫回 False。' };
    },
    function () {
      return { q: '從迴圈 1 裡的 Stop 拉一條線到平行的迴圈 2，當迴圈 2 的停止條件。執行後會怎樣？', ans: '迴圈 2 要等迴圈 1 結束才開始，而且只跑一圈', wrong: ['兩個迴圈同時停', '迴圈 2 永遠不會停', '執行箭頭斷掉', '迴圈 2 每圈都讀到最新的 Stop'], ex: '資料流：線上的值要等迴圈 1 整個結束才送出。用一條線連起來，兩個迴圈就變成一前一後，不再平行。' };
    },
    function () {
      return { q: 'FGV 裡的 Shift Register <b>沒有接初始值</b>。第一次呼叫 Add 5，第二次呼叫 Add 1（中間沒有 Init，VI 一直開著），第二次回傳多少？', ans: '6', wrong: ['1', '5', '0', '每次都不一定'], ex: '沒初始化的 Shift Register 會記住上次呼叫留下的值：0+5=5，再 +1 = 6。這就是 FGV 能「記住」資料的原因。' };
    },
    function () {
      return { q: '一個只有 Set 和 Get 兩個動作的 FGV，兩個迴圈都做「Get → 加 1 → Set」。這樣能避免競爭條件嗎？', ans: '不能，加 1 要放進 FGV 裡面才安全', wrong: ['能，FGV 一定安全', '能，因為 SubVI 不可重入', '不能，FGV 根本不能用在兩個迴圈', '能，只要加 Wait'], ex: 'Get 和 Set 是兩次分開的呼叫，中間另一個迴圈還是能插進來。要把「讀＋改＋寫」做成 FGV 裡的一個動作（Action Engine）。' };
    },
    function () {
      return { q: 'Global Variable 和 Local Variable 最大的差別是？', ans: 'Global 可以在不同 VI 之間共用，Local 只在同一個 VI 裡', wrong: ['Global 不會有競爭條件', 'Local 可以跨電腦共用', 'Global 存在硬碟裡', '兩者完全一樣'], ex: 'Global Variable 是一個獨立的 .vi 檔，多個 VI 都能讀寫；資料在記憶體，不是硬碟。跨電腦要用 Shared Variable。兩者都一樣有競爭條件。' };
    }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) window.VarLab.quiz = window.LabQuiz('vquiz', gen);
  window.VarLab.quizKinds = KIND;
})();
