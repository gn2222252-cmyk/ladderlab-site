/* DAQ 實驗室：取樣率、解析度與範圍、DAQmx 緩衝區 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var tabs = $('tabs');
  function show(t) {
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['rate', 'res', 'buf'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  function frame(cv, y0, y1, xl) {
    var c = cv.getContext('2d'), W = cv.width, H = cv.height, L = 52, R = 10, T = 12, B = 24;
    c.fillStyle = '#0b0f14'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#263241'; c.fillStyle = '#9aa7b5'; c.font = '11px ui-monospace,Consolas,monospace'; c.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var gy = T + (H - T - B) * i / 4, gx = L + (W - L - R) * i / 4;
      c.beginPath(); c.moveTo(L, gy); c.lineTo(W - R, gy); c.moveTo(gx, T); c.lineTo(gx, H - B); c.stroke();
      c.textAlign = 'right'; c.fillText(+(y1 - (y1 - y0) * i / 4).toPrecision(3), L - 5, gy + 4);
      c.textAlign = 'center'; c.fillText(+(xl * i / 4).toFixed(2) + ' s', gx, H - 8);
    }
    return { c: c, X: function (t) { return L + t / xl * (W - L - R); }, Y: function (v) { return T + (y1 - v) / (y1 - y0) * (H - T - B); } };
  }

  /* ---------- 取樣率 ---------- */
  function alias(f, fs) { return Math.abs(f - fs * Math.round(f / fs)); }
  function rDraw() {
    var f = +$('sf').value, fs = +$('fs').value, TT = 2, g = frame($('crate'), -1.2, 1.2, TT), c = g.c, t, k;
    $('sfv').textContent = f + ' Hz'; $('fsv').textContent = fs + ' S/s';
    function s(t) { return Math.sin(2 * Math.PI * f * t + 0.5); }
    c.strokeStyle = '#6b7785'; c.lineWidth = 1.5; c.beginPath();
    for (t = 0; t <= TT; t += 0.002) { if (t) c.lineTo(g.X(t), g.Y(s(t))); else c.moveTo(g.X(0), g.Y(s(0))); } c.stroke();
    c.strokeStyle = '#ffd84d'; c.lineWidth = 2; c.beginPath();
    for (k = 0; k / fs <= TT + 1e-9; k++) { t = k / fs; if (k) c.lineTo(g.X(t), g.Y(s(t))); else c.moveTo(g.X(t), g.Y(s(t))); } c.stroke();
    c.fillStyle = '#fff'; for (k = 0; k / fs <= TT + 1e-9; k++) { t = k / fs; c.beginPath(); c.arc(g.X(t), g.Y(s(t)), 3.5, 0, 7); c.fill(); }
    var fa = alias(f, fs), ratio = fs / f, msg, cls = '';
    if (ratio >= 10) { msg = '✔ 取樣率是訊號的 ' + (+ratio.toFixed(1)) + ' 倍，頻率和形狀都對。'; cls = 'ok'; }
    else if (ratio > 2) msg = '取樣率是訊號的 ' + (+ratio.toFixed(1)) + ' 倍（大於 2 倍）：頻率量得出來，但每個週期只有 ' + (+ratio.toFixed(1)) + ' 個點，形狀是折線，峰值也可能量不到。';
    else if (ratio === 2) { msg = '剛好 2 倍，是理論的邊界：每個週期只有 2 個點，量到的振幅完全看取樣點落在哪裡，不可靠。要「大於」2 倍。'; cls = 'bad'; }
    else { msg = '✖ 取樣率不到訊號的 2 倍，發生混疊：' + (fa < 1e-9 ? '每次都量到波形的同一個位置，看起來是一條直線（0 Hz）。' : '黃線看起來是 ' + (+fa.toFixed(2)) + ' Hz 的訊號，但真正的訊號是 ' + f + ' Hz。') + '程式不會有任何錯誤訊息。'; cls = 'bad'; }
    $('rsay').textContent = msg; $('rsay').className = 'verdict-line ' + cls;
  }
  $('sf').oninput = $('fs').oninput = rDraw;
  Array.prototype.forEach.call(document.querySelectorAll('[data-p]'), function (b) { b.onclick = function () { var p = b.dataset.p.split(','); $('sf').value = p[0]; $('fs').value = p[1]; rDraw(); }; });
  rDraw();

  /* ---------- 解析度與範圍 ---------- */
  function volt(v) { var a = Math.abs(v); return a >= 1 ? +v.toPrecision(4) + ' V' : a >= 1e-3 ? +(v * 1e3).toPrecision(4) + ' mV' : +(v * 1e6).toPrecision(4) + ' µV'; }
  function quant(bits, R, v) { var lsb = 2 * R / Math.pow(2, bits), q = Math.round(v / lsb) * lsb; return Math.max(-R, Math.min(R - lsb, q)); }
  function qDraw() {
    var bits = +$('bits').value, R = +$('range').value, A = +$('amp').value, lsb = 2 * R / Math.pow(2, bits), TT = 1;
    $('ampv').textContent = volt(A);
    var ym = Math.max(Math.min(A, R) * 1.25, lsb * 3), g = frame($('cres'), -ym, ym, TT), c = g.c, t;
    if (R <= ym) { c.strokeStyle = '#ff4d4d'; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(g.X(0), g.Y(R)); c.lineTo(g.X(TT), g.Y(R)); c.moveTo(g.X(0), g.Y(-R)); c.lineTo(g.X(TT), g.Y(-R)); c.stroke(); c.setLineDash([]); }
    function s(t) { return A * Math.sin(2 * Math.PI * 2 * t); }
    c.strokeStyle = '#6b7785'; c.lineWidth = 1.5; c.beginPath(); for (t = 0; t <= TT; t += 0.002) { var yy = Math.max(-ym * 1.5, Math.min(ym * 1.5, s(t))); if (t) c.lineTo(g.X(t), g.Y(yy)); else c.moveTo(g.X(0), g.Y(yy)); } c.stroke();
    c.strokeStyle = '#ffd84d'; c.lineWidth = 2; c.beginPath(); var prev = null;
    for (t = 0; t <= TT; t += 0.002) { var q = quant(bits, R, s(t)); if (prev === null) c.moveTo(g.X(t), g.Y(q)); else { c.lineTo(g.X(t), g.Y(prev)); c.lineTo(g.X(t), g.Y(q)); } prev = q; } c.stroke();
    var used = Math.floor(2 * Math.min(A, R) / lsb) + 1, lv = Math.pow(2, bits);
    $('lv').textContent = lv.toLocaleString(); $('cw').textContent = volt(lsb); $('used').textContent = Math.min(used, lv).toLocaleString();
    var msg, cls = '';
    if (A > R) { msg = '✖ 訊號振幅 ' + volt(A) + ' 超出範圍 ±' + R + ' V，超出的部分被削平（紅色虛線是範圍上下限）。換大一點的範圍。'; cls = 'bad'; }
    else if (used < 50) { msg = '✖ 這個訊號只用到 ' + used + ' 階，量到的是階梯。' + (bits < 16 ? '提高解析度，或' : '') + '把範圍縮小到剛好包住訊號。'; cls = 'bad'; }
    else if (A < R / 4 && R > 0.2) msg = '量得出來，但訊號只占範圍的 ' + Math.round(A / R * 100) + '%，其他的階數都浪費了。換小一級的範圍，最小可分辨電壓會跟著變小。';
    else { msg = '✔ 範圍剛好包住訊號，用到 ' + used.toLocaleString() + ' 階，一階只有 ' + volt(lsb) + '。'; cls = 'ok'; }
    $('qsay').textContent = msg; $('qsay').className = 'verdict-line ' + cls;
  }
  $('bits').onchange = $('range').onchange = $('amp').oninput = qDraw;
  Array.prototype.forEach.call(document.querySelectorAll('[data-q]'), function (b) { b.onclick = function () { var p = b.dataset.q.split(','); $('bits').value = p[0]; $('range').value = p[1]; $('amp').value = p[2]; qDraw(); }; });
  qDraw();

  /* ---------- DAQmx 流程與緩衝區 ---------- */
  var CAP = 10000, bs = { phase: 'idle', timer: null };
  function hl(n, err) { Array.prototype.forEach.call($('flow').querySelectorAll('.n'), function (e) { e.classList.toggle('on', e.dataset.n === n && !err); e.classList.toggle('err', e.dataset.n === n && !!err); }); }
  function bDraw() {
    var p = Math.min(100, bs.buf / CAP * 100); $('bfill').style.width = p + '%'; $('bfill').className = p > 70 ? 'hot' : '';
    $('btxt').textContent = Math.round(bs.buf).toLocaleString() + ' 筆等著被拿';
    $('bit').textContent = bs.it; $('bgot').textContent = Math.round(bs.got).toLocaleString(); $('bt').textContent = bs.t.toFixed(1) + ' s';
    $('bper').textContent = bs.per == null ? '–' : (bs.per * 1000).toFixed(0) + ' ms';
  }
  function say(s, cls) { $('bsay').textContent = s; $('bsay').className = 'verdict-line ' + (cls || ''); }
  function finish(msg, cls) { bs.phase = 'done'; clearInterval(bs.timer); bs.timer = null; hl('clear'); setTimeout(function () { if (bs.phase === 'done') hl(cls === 'bad' ? 'err' : '', cls === 'bad'); }, 600); say(msg, cls); bDraw(); }
  function bTick(dt) {
    dt = dt || 0.05; bs.t += dt;
    if (bs.phase === 'create') { hl('create'); if (bs.t > 0.4) bs.phase = 'timing'; return bDraw(); }
    if (bs.phase === 'timing') { hl('timing'); if (bs.t > 0.8) { bs.phase = 'start'; } return bDraw(); }
    if (bs.phase === 'start') { hl('start'); if (bs.t > 1.2) { bs.phase = 'read'; bs.iter0 = bs.t; say('Start 之後卡就開始量了，緩衝區開始累積。Read 在等資料…'); } return bDraw(); }
    bs.buf += bs.rate * dt;
    if (bs.buf >= CAP) { bs.buf = CAP; hl('read', true); return finish('✖ 錯誤 -200279：緩衝區滿了，還沒被拿走的舊資料被蓋掉，擷取中止。原因是迴圈裡的其他工作要 ' + bs.work / 1000 + ' 秒，這段時間卡量了 ' + Math.round(bs.rate * bs.work / 1000).toLocaleString() + ' 筆，一圈卻只拿走 ' + bs.n + ' 筆。解法：每次多拿一點、把慢的工作（存檔、畫圖）移到另一個迴圈，或降低取樣率。', 'bad'); }
    if (bs.phase === 'work') { hl('work'); bs.workLeft -= dt * 1000; if (bs.workLeft <= 0) bs.phase = 'read'; return bDraw(); }
    hl('read');
    var reads = 0;
    while (reads < 50) {
    var take = bs.n < 0 ? bs.buf : (bs.buf >= bs.n ? bs.n : 0);
    if (!(bs.n < 0 || take > 0)) break;
    reads++;
    {
      bs.buf -= take; bs.got += take; bs.it++; bs.per = bs.n > 0 && !bs.work ? bs.n / bs.rate : bs.t - bs.iter0; bs.iter0 = bs.t;
      if (bs.stopReq) return finish('按了 Stop：迴圈結束，Clear Task 停止擷取並釋放資源。共拿到 ' + Math.round(bs.got).toLocaleString() + ' 筆。', 'ok');
      if (bs.it === 3) {
        if (bs.n < 0) say(bs.work ? '-1 表示「緩衝區裡有多少拿多少」，不會溢位，但每次拿到的筆數不固定（這次 ' + Math.round(take) + ' 筆）。' : '-1 加上迴圈裡沒有其他工作：Read 不等待，迴圈空轉、吃滿 CPU，每次只拿到一點點。要自己加 Wait。', bs.work ? '' : 'bad');
        else if (bs.work / 1000 > bs.n / bs.rate) say('迴圈一圈要 ' + bs.work + ' ms，卡在這段時間量了 ' + Math.round(bs.rate * bs.work / 1000) + ' 筆，卻只拿走 ' + bs.n + ' 筆。看緩衝區一直漲…');
        else say('✔ 穩定：Read 等滿 ' + bs.n + ' 筆才往下走，所以一圈大約 ' + Math.round(bs.n / bs.rate * 1000) + ' ms（筆數 ÷ 取樣率）。緩衝區不會累積。', 'ok');
      }
      if (bs.work > 0) { bs.phase = 'work'; bs.workLeft = bs.work; }
    }
    if (bs.n < 0 || bs.phase === 'work') break;
    }
    bDraw();
  }
  function bRun() {
    clearInterval(bs.timer);
    bs = { phase: 'create', t: 0, buf: 0, got: 0, it: 0, per: null, rate: +$('rate').value, n: +$('nper').value, work: +$('work').value, stopReq: false, timer: null };
    say('建立通道、設定取樣時脈…'); bDraw();
    bs.timer = setInterval(function () { bTick(0.05); }, 50);
  }
  $('brun').onclick = bRun;
  $('bstop').onclick = function () { if (bs.timer) { bs.stopReq = true; say('Stop 按下了，等這一圈的 Read 做完…'); } };
  bs.buf = 0; bs.got = 0; bs.it = 0; bs.t = 0; bDraw();

  if (/^#(rate|res|buf)$/.test(location.hash)) show(location.hash.slice(1));
  window.DaqLab = { alias: alias, quant: quant, bTick: bTick, bRun: bRun, bs: function () { return bs; }, show: show };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function volt(v) { var a = Math.abs(v); return a >= 1 ? +v.toPrecision(3) + ' V' : a >= 1e-3 ? +(v * 1e3).toPrecision(3) + ' mV' : +(v * 1e6).toPrecision(3) + ' µV'; }
  var KIND = [
    function () {
      var c = p1([[9, 10], [7, 10], [12, 10], [45, 50], [60, 50], [8, 5], [130, 100]]), f = c[0], fs = c[1], fa = window.DaqLab.alias(f, fs);
      return { q: '訊號是 <b>' + f + ' Hz</b> 的正弦波，用 <b>' + fs + ' S/s</b> 取樣。Graph 上看到的訊號是幾 Hz？', ans: fa + ' Hz', wrong: [f + ' Hz', fs + ' Hz', fs / 2 + ' Hz', (f + fs) + ' Hz', Math.abs(fs - 2 * f) + ' Hz', '0 Hz'], ex: '取樣率不到 2 倍會混疊：看到的頻率＝訊號頻率和「最接近的取樣率整數倍」的差，|' + f + ' − ' + fs * Math.round(f / fs) + '| = ' + fa + ' Hz。' };
    },
    function () {
      var f = p1([50, 100, 400, 1000, 20000]);
      return { q: '要量的訊號最高頻率是 <b>' + f + ' Hz</b>。照奈奎斯特定理，取樣率至少要大於多少？', ans: 2 * f + ' S/s', wrong: [f + ' S/s', f / 2 + ' S/s', 10 * f + ' S/s', 4 * f + ' S/s'], ex: '大於最高頻率的 2 倍才量得出正確頻率；要看清楚波形，實務上抓 5～10 倍（' + 5 * f + '～' + 10 * f + ' S/s）。' };
    },
    function () {
      var b = p1([12, 16]), R = p1([10, 5, 1]), lsb = 2 * R / Math.pow(2, b);
      return { q: '<b>' + b + ' 位元</b>的 DAQ，量測範圍設 <b>±' + R + ' V</b>。最小可分辨的電壓變化大約是多少？', ans: volt(lsb), wrong: [volt(R / Math.pow(2, b)), volt(2 * R / Math.pow(2, b === 12 ? 16 : 12)), volt(2 * R / b), volt(lsb * 10), volt(4 * R / Math.pow(2, b))], ex: '範圍寬度 ' + 2 * R + ' V ÷ 2 的 ' + b + ' 次方（' + Math.pow(2, b).toLocaleString() + ' 階）＝ ' + volt(lsb) + '。注意 ±' + R + ' V 的寬度是 ' + 2 * R + ' V，不是 ' + R + ' V。' };
    },
    function () {
      var c = p1([[1000, 100], [1000, 500], [5000, 500], [10000, 1000], [2000, 500], [1000, 1000]]), ms = c[1] / c[0] * 1000;
      return { q: '連續擷取，取樣率 <b>' + c[0].toLocaleString() + ' S/s</b>，迴圈裡的 DAQmx Read 每次讀 <b>' + c[1] + '</b> 筆，沒有其他 Wait。迴圈一圈大約多久？', ans: ms + ' ms', wrong: [ms * 10 + ' ms', ms / 10 + ' ms', '1 ms', c[1] + ' ms', '0 ms（全速空轉）', 1000 + ms + ' ms'], ex: 'Read 會等緩衝區湊滿 ' + c[1] + ' 筆才往下走：' + c[1] + ' ÷ ' + c[0] + ' = ' + ms / 1000 + ' 秒。所以迴圈不用再加 Wait。' };
    },
    function () {
      var c = p1([[0.05, [10, 5, 1, 0.2], 0.2], [0.8, [10, 5, 1, 0.2], 1], [3, [10, 5, 1, 0.2], 5], [7, [10, 5, 1, 0.2], 10]]);
      return { q: '感測器輸出在 <b>±' + c[0] + ' V</b> 之間。要量得最細又不被削平，範圍選哪一個？', ans: '±' + c[2] + ' V', wrong: c[1].filter(function (r) { return r !== c[2]; }).map(function (r) { return '±' + r + ' V'; }), ex: '選「剛好包住訊號」的最小範圍：比它小會削平，比它大則每一階變粗，浪費解析度。' };
    }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) window.DaqLab.quiz = window.LabQuiz('dquiz', gen);
  window.DaqLab.quizGen = gen; window.DaqLab.quizKinds = KIND;
})();
