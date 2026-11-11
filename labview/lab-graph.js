/* 圖表實驗室：Chart／Graph 資料型別、XY Graph */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  var COL = ['#ffffff', '#ff4d4d', '#4dff6a', '#5aa2ff', '#ffe14d', '#ff7df2'];

  var tabs = $('tabs');
  function show(t) {
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    $('t-type').hidden = t !== 'type'; $('t-xy').hidden = t !== 'xy';
    if (t === 'xy') xyDraw(-1);
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* 畫圖：plots = [[[x,y],...],...] */
  function draw(cv, plots, o) {
    o = o || {};
    var c = cv.getContext('2d'), W = cv.width, H = cv.height, L = 44, R = 10, T = 10, B = 24;
    c.clearRect(0, 0, W, H); c.fillStyle = '#0b0f14'; c.fillRect(0, 0, W, H);
    if (o.msg) { c.fillStyle = '#ff6b6b'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.fillText(o.msg, W / 2, H / 2); c.font = '13px sans-serif'; c.fillStyle = '#aaa'; if (o.sub) c.fillText(o.sub, W / 2, H / 2 + 22); return; }
    var xs = [], ys = [];
    plots.forEach(function (p) { p.forEach(function (q) { xs.push(q[0]); ys.push(q[1]); }); });
    var x0 = o.xmin != null ? o.xmin : (xs.length ? Math.min.apply(null, xs) : 0), x1 = o.xmax != null ? o.xmax : Math.max.apply(null, xs.concat([x0 + 1]));
    var y0 = o.ymin != null ? o.ymin : Math.min.apply(null, ys.concat([0])), y1 = o.ymax != null ? o.ymax : Math.max.apply(null, ys.concat([10]));
    if (x1 === x0) x1 = x0 + 1; if (y1 === y0) y1 = y0 + 1;
    var pw = W - L - R, ph = H - T - B;
    if (o.square) { var s = Math.min(pw, ph); L += (pw - s) / 2; pw = ph = s; }
    function X(x) { return L + (x - x0) / (x1 - x0) * pw; } function Y(y) { return T + ph - (y - y0) / (y1 - y0) * ph; }
    c.strokeStyle = '#263241'; c.lineWidth = 1; c.fillStyle = '#9aa7b5'; c.font = '11px ui-monospace,Consolas,monospace';
    for (var i = 0; i <= 4; i++) {
      var gx = L + pw * i / 4, gy = T + ph * i / 4;
      c.beginPath(); c.moveTo(gx, T); c.lineTo(gx, T + ph); c.moveTo(L, gy); c.lineTo(L + pw, gy); c.stroke();
      c.textAlign = 'center'; c.fillText(+(x0 + (x1 - x0) * i / 4).toFixed(2), gx, H - 8);
      c.textAlign = 'right'; c.fillText(+(y1 - (y1 - y0) * i / 4).toFixed(2), L - 5, gy + 4);
    }
    plots.forEach(function (p, k) {
      if (!p.length) return;
      c.strokeStyle = c.fillStyle = COL[k % COL.length]; c.lineWidth = 2; c.beginPath();
      p.forEach(function (q, j) { if (j) c.lineTo(X(q[0]), Y(q[1])); else c.moveTo(X(q[0]), Y(q[1])); });
      c.stroke();
      p.forEach(function (q, j) { c.beginPath(); c.arc(X(q[0]), Y(q[1]), o.hi === j && k === 0 ? 6 : 3, 0, 7); c.fill(); });
    });
  }

  /* ---------- Chart vs Graph ---------- */
  var TYPES = [
    { k: 'scalar', name: '純量（一個 DBL）' }, { k: 'arr1', name: '1D 陣列（4 個）' }, { k: 'bundle', name: 'Bundle 兩個純量' },
    { k: 'arr2', name: '2D 陣列（2 列 × 4 欄）' }, { k: 'xdy', name: '叢集（x0, dx, Y 陣列）' }, { k: 'wf', name: 'Waveform（t0, dt, Y）' }
  ];
  var st = { type: 'scalar', k: 0, chart: [], graph: [], n: 0, sends: 0, timer: null };
  function sig(k, ph, amp) { return Math.round((5 + (amp || 4) * Math.sin(k * 0.45 + (ph || 0)) + (Math.random() - 0.5)) * 10) / 10; }
  function take(n, ph, amp) { var a = []; for (var i = 0; i < n; i++) a.push(sig(st.k + i, ph, amp)); return a; }
  function reset() { st.chart = []; st.graph = []; st.n = 0; st.sends = 0; st.k = 0; }
  function addChart(plotIdx, x, y) { while (st.chart.length <= plotIdx) st.chart.push([]); var p = st.chart[plotIdx]; p.push([x, y]); if (p.length > 60) p.shift(); }
  function send() {
    var t = st.type, tr = $('tr').checked, x0 = parseFloat($('x0').value) || 0, dx = parseFloat($('dx').value) || 1, d, txt, cs = '', gs = '', cbroken = '', gbroken = '', i, j;
    st.sends++;
    if (t === 'scalar') {
      d = sig(st.k++); txt = 'DBL：' + d;
      addChart(0, st.n++, d); cs = '多一個點，接在舊資料後面。共 ' + st.chart[0].length + ' 點。';
      gbroken = '線是斷的'; gs = 'Graph 不接受單一純量：它要一次拿到整條線（陣列）。要逐點畫請用 Chart，或自己把點累積成陣列。';
    } else if (t === 'arr1') {
      d = take(4); st.k += 4; txt = '1D DBL 陣列：[' + d.join(', ') + ']';
      d.forEach(function (v) { addChart(0, st.n++, v); }); cs = '一次多 4 個點，同一條線，接在後面。共 ' + st.chart[0].length + ' 點。';
      st.graph = [d.map(function (v, i) { return [i, v]; })]; gs = '整條線換成這 4 個點，X 軸是索引 0～3。上一次的資料不見了。';
    } else if (t === 'bundle') {
      d = [sig(st.k), sig(st.k, 2, 2)]; st.k++; txt = '叢集（Bundle）：{ ' + d[0] + ', ' + d[1] + ' }';
      addChart(0, st.n, d[0]); addChart(1, st.n, d[1]); st.n++; cs = '叢集裡有幾個純量就是幾條線，每條各多一個點。這是 Chart 畫多條線最常用的接法。';
      gbroken = '線是斷的'; gs = 'Graph 不接受「純量的叢集」。Graph 要畫兩條線請接 2D 陣列，或把兩個 1D 陣列 Build Array。';
    } else if (t === 'arr2') {
      d = [take(4), take(4, 2, 2)]; st.k += 4; txt = '2D DBL 陣列：\n[' + d[0].join(', ') + ']\n[' + d[1].join(', ') + ']';
      if (!tr) { for (j = 0; j < 4; j++) for (i = 0; i < 2; i++) addChart(j, st.n + i, d[i][j]); st.n += 2; cs = 'Chart 預設把「每一欄」當一條線：4 欄＝4 條線，每條多 2 個點。通常不是你要的，勾 Transpose Array。'; }
      else { for (i = 0; i < 2; i++) for (j = 0; j < 4; j++) addChart(i, st.n + j, d[i][j]); st.n += 4; cs = 'Transpose 之後每一列一條線：2 條線，每條多 4 個點。'; }
      if (!tr) { st.graph = d.map(function (r) { return r.map(function (v, i) { return [i, v]; }); }); gs = 'Graph 預設把「每一列」當一條線：2 條線，各 4 個點。和 Chart 的預設剛好相反。'; }
      else { st.graph = [0, 1, 2, 3].map(function (j) { return [[0, d[0][j]], [1, d[1][j]]]; }); gs = 'Transpose 之後每一欄一條線：4 條線，各 2 個點。'; }
    } else if (t === 'xdy') {
      d = take(6); st.k += 6; txt = '叢集：{ x0 = ' + x0 + ', dx = ' + dx + ', Y = [' + d.join(', ') + '] }';
      cbroken = '線是斷的'; cs = 'Chart 不接受 (x0, dx, Y) 這種叢集。Chart 的 X 起點和間隔要在 Properties ▸ Scales 的 Offset、Multiplier 設定，或改接 Waveform。';
      st.graph = [d.map(function (v, i) { return [x0 + i * dx, v]; })]; gs = 'X 軸從 x0 = ' + x0 + ' 開始，每點間隔 dx = ' + dx + '：最後一點在 ' + (x0 + 5 * dx) + '。改 x0、dx 再送一次看 X 軸刻度。';
    } else {
      d = take(6); st.k += 6; txt = 'Waveform：t0 = ' + x0 + ' 秒, dt = ' + dx + ' 秒, Y = [' + d.join(', ') + ']';
      d.forEach(function (v) { addChart(0, x0 + (st.n++) * dx, v); }); cs = 'Waveform 自己帶時間：每點間隔 dt = ' + dx + ' 秒。新的 6 點接在後面。';
      st.graph = [d.map(function (v, i) { return [x0 + i * dx, v]; })]; gs = '畫出這 6 點，X 軸是時間：t0 起、每點 dt。DAQ 讀回來的資料就是 Waveform，直接接 Graph 時間軸就對。';
    }
    $('data').textContent = '第 ' + st.sends + ' 次送出 → ' + txt;
    if (cbroken) { st.chart = []; draw($('cc'), [], { msg: '✖ ' + cbroken, sub: 'Chart 不接受這種資料型別' }); } else draw($('cc'), st.chart);
    if (gbroken) { st.graph = []; draw($('cg'), [], { msg: '✖ ' + gbroken, sub: 'Graph 不接受這種資料型別' }); } else draw($('cg'), st.graph);
    $('csay').textContent = cs; $('gsay').textContent = gs;
    $('csay').className = 'verdict-line' + (cbroken ? ' bad' : ''); $('gsay').className = 'verdict-line' + (gbroken ? ' bad' : '');
  }
  function pickType(k) {
    st.type = k; reset();
    Array.prototype.forEach.call($('dts').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.k === k); });
    $('trw').style.display = k === 'arr2' ? '' : 'none'; $('wfc').style.display = k === 'xdy' || k === 'wf' ? '' : 'none';
    send();
  }
  TYPES.forEach(function (t) { var b = el('button', '', t.name); b.type = 'button'; b.dataset.k = t.k; b.onclick = function () { pickType(t.k); }; $('dts').appendChild(b); });
  $('send').onclick = send;
  $('tr').onchange = function () { reset(); send(); };
  $('clr').onclick = function () { st.chart = []; st.n = 0; draw($('cc'), []); $('csay').textContent = 'Chart 的歷史清空了。Graph 沒有歷史，不需要清。'; };
  $('auto').onchange = function () { clearInterval(st.timer); st.timer = null; if (this.checked) st.timer = setInterval(send, 400); };
  pickType('scalar');

  /* ---------- XY Graph ---------- */
  var xy = { X: [], Y: [], k: -1, timer: null };
  function gen() {
    var N = +$('np').value, sh = $('shape').value, cnt = N + ($('close').checked ? 1 : 0), X = [], Y = [], i, th, f, r3 = function (v) { return Math.round(v * 1000) / 1000; };
    for (i = 0; i < cnt; i++) {
      th = 2 * Math.PI * i / N;
      if (sh === 'circle') { X.push(r3(Math.cos(th))); Y.push(r3(Math.sin(th))); }
      else if (sh === 'spiral') { f = i / N; X.push(r3(f * Math.cos(3 * th))); Y.push(r3(f * Math.sin(3 * th))); }
      else if (sh === 'liss') { X.push(r3(Math.sin(3 * th))); Y.push(r3(Math.sin(2 * th))); }
      else { f = (i / N) % 1 * 4; var s = Math.floor(f), u = f - s; var P = [[-0.8, -0.5], [0.8, -0.5], [0.8, 0.5], [-0.8, 0.5], [-0.8, -0.5]]; X.push(r3(P[s][0] + (P[s + 1][0] - P[s][0]) * u)); Y.push(r3(P[s][1] + (P[s + 1][1] - P[s][1]) * u)); }
    }
    xy.X = X; xy.Y = Y;
  }
  function xyDraw(k) {
    var n = k < 0 ? xy.X.length : k + 1, pts = [], wy = [];
    for (var i = 0; i < n; i++) { pts.push([xy.X[i], xy.Y[i]]); wy.push([i, xy.Y[i]]); }
    draw($('cxy'), [pts], { xmin: -1.1, xmax: 1.1, ymin: -1.1, ymax: 1.1, square: true, hi: k });
    draw($('cwy'), [wy], { xmin: 0, xmax: Math.max(1, xy.X.length - 1), ymin: -1.1, ymax: 1.1, hi: k });
    var cur = k < 0 ? -1 : k, from = Math.max(0, Math.min(cur - 6, xy.X.length - 13)), h = '';
    [['X', xy.X], ['Y', xy.Y]].forEach(function (a) {
      h += '<div><b>' + a[0] + '</b>' + (from ? '… ' : '');
      for (var i = from; i < Math.min(a[1].length, from + 13); i++) h += '<span class="' + (i === cur ? 'cur' : '') + '">' + (i < n ? a[1][i].toFixed(2) : '') + '</span>';
      h += (from + 13 < a[1].length ? ' …' : '') + '</div>';
    });
    $('arrs').innerHTML = h;
  }
  function xySay() {
    var N = +$('np').value, cl = $('close').checked, sh = $('shape').value, s = 'X、Y 各 ' + xy.X.length + ' 個元素。';
    if (sh === 'circle' || sh === 'gantry' || sh === 'liss') s += cl ? '多跑一圈，最後一點回到起點，圖形閉合了。' : '最後一點沒有接回第一點：' + N + ' 個點只有 ' + (N - 1) + ' 段線，圖形缺一個口。勾「迴圈多跑一圈」讓 For Loop 跑 N＋1 次。';
    if (sh === 'circle' && N < 16) s += '點數太少，圓看起來是 ' + N + ' 邊形，把 N 加大。';
    if (sh === 'circle') s += '右邊同一個 Y 陣列接到 Waveform Graph，X 軸變成索引，畫出來是正弦波，不是圓。';
    $('xysay').textContent = s;
  }
  function xyReset() { clearInterval(xy.timer); xy.timer = null; $('npv').textContent = $('np').value; gen(); xyDraw(-1); xySay(); }
  $('np').oninput = $('shape').onchange = $('close').onchange = xyReset;
  $('xyrun').onclick = function () {
    clearInterval(xy.timer); gen(); var k = 0;
    xy.timer = setInterval(function () { xyDraw(k); $('xysay').textContent = '第 ' + k + ' 圈：X[' + k + '] = ' + xy.X[k] + '、Y[' + k + '] = ' + xy.Y[k] + ' 配成一點，和上一點連線。'; if (++k >= xy.X.length) { clearInterval(xy.timer); xy.timer = null; setTimeout(function () { xyDraw(-1); xySay(); }, 500); } }, Math.max(40, 1800 / xy.X.length));
  };
  xyReset();
  if (location.hash === '#xy') show('xy');

  window.GraphLab = { st: st, send: send, pickType: pickType, xy: xy, gen: gen, show: show };
})();

/* ---------- 猜一猜：幾條線、每條幾點 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  var BROKEN = '線是斷的，接不上';
  function L(n, p) { return n + ' 條線，每條 ' + p + ' 個點'; }
  function gen() {
    var ind = p1(['Chart', 'Graph']), k = p1([1, 2, 3, 5]), t = p1(['scalar', 'arr1', 'bundle', 'arr2', 'arr2t']), ans, ex, name;
    if (t === 'scalar') { name = '一個 DBL 純量'; ans = ind === 'Chart' ? L(1, k) : BROKEN; ex = ind === 'Chart' ? 'Chart 每次多一個點，而且記得舊的。' : 'Graph 不接受單一純量，要一次給整個陣列。'; }
    else if (t === 'arr1') { name = '有 4 個元素的 1D 陣列'; ans = ind === 'Chart' ? L(1, 4 * k) : L(1, 4); ex = ind === 'Chart' ? 'Chart 把每次的 4 點接在後面，執行 ' + k + ' 次就是 ' + 4 * k + ' 點。' : 'Graph 每次整張重畫，不管執行幾次都只有最後那 4 點。'; }
    else if (t === 'bundle') { name = 'Bundle 起來的 2 個純量'; ans = ind === 'Chart' ? L(2, k) : BROKEN; ex = ind === 'Chart' ? '叢集裡每個純量是一條線，每次各多一點。' : 'Graph 不接受純量的叢集。'; }
    else if (t === 'arr2') { name = '2 列 × 4 欄的 2D 陣列（沒有 Transpose）'; ans = ind === 'Chart' ? L(4, 2 * k) : L(2, 4); ex = ind === 'Chart' ? 'Chart 預設每一「欄」一條線：4 條，每次各多 2 點。' : 'Graph 預設每一「列」一條線：2 條各 4 點，而且不累積。'; }
    else { name = '2 列 × 4 欄的 2D 陣列（勾了 Transpose Array）'; ans = ind === 'Chart' ? L(2, 4 * k) : L(4, 2); ex = ind === 'Chart' ? 'Transpose 之後 Chart 每一列一條線：2 條，每次各多 4 點。' : 'Transpose 之後 Graph 每一欄一條線：4 條各 2 點。'; }
    var wrong = [L(1, k), L(1, 4), L(1, 4 * k), L(2, k), L(2, 4), L(4, 2), L(4, 2 * k), L(2, 4 * k), L(k, 4), BROKEN];
    return { q: '把 <b>' + name + '</b> 接到清空過的 <b>Waveform ' + ind + '</b>，VI 執行 <b>' + k + '</b> 次之後，畫面上是什麼？', ans: ans, wrong: wrong, ex: ex };
  }
  if (window.LabQuiz) window.GraphLab.quiz = window.LabQuiz('gquiz', gen);
  window.GraphLab.quizGen = gen;
})();
