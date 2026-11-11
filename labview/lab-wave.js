/* 波形實驗室：Waveform（t0、dt、Y）、統計（Mean、σ、RMS、Max/Min、P-P）、移動平均、猜一猜 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function slowF() { return $('slow') && $('slow').checked ? 2.2 : 1; }
  function f3(v) { return String(Number(v.toFixed(3))); }
  function sig(v) { return String(Number(v.toPrecision(4))); }

  /* 每次換分頁或重新開始，RUN 加一；舊的動畫回呼看到 RUN 變了就不做事 */
  var RUN = 0;
  function wait(ms, my) { return new Promise(function (res, rej) { setTimeout(function () { if (my !== RUN) rej('cancel'); else res(); }, ms * slowF()); }); }
  function fly(a, b, text, my) {
    return new Promise(function (done, rej) {
      if (!a || !b) return done();
      var dur = Math.round(550 * slowF()), r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
      var f = document.createElement('div'); f.className = 'fly'; f.textContent = text;
      f.style.cssText = 'left:' + r1.left + 'px;top:' + r1.top + 'px;height:28px;padding:0 6px;font-size:12px;transition-duration:' + dur + 'ms';
      $('layer').appendChild(f);
      setTimeout(function () { f.style.left = r2.left + 'px'; f.style.top = r2.top + 'px'; }, 30);
      setTimeout(function () { f.remove(); if (my !== RUN) rej('cancel'); else done(); }, dur + 60);
    });
  }
  function caught(e) { if (e !== 'cancel') throw e; }

  /* 固定種子的亂數，重新取樣才換 */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r, n) { var a = []; for (var i = 0; i < n; i++) { var u = 1 - r(), v = r(); a.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)); } return a; }

  /* ---------- 統計（純函式） ---------- */
  function mean(a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; }
  function stdev(a, sample) { var m = mean(a), ss = a.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0); return Math.sqrt(ss / (sample ? a.length - 1 : a.length)); }
  function rms(a) { return Math.sqrt(a.reduce(function (s, v) { return s + v * v; }, 0) / a.length); }
  function maxmin(a) { var mx = 0, mn = 0; a.forEach(function (v, i) { if (v > a[mx]) mx = i; if (v < a[mn]) mn = i; }); return { max: a[mx], imax: mx, min: a[mn], imin: mn }; }
  function movAvg(a, n) { var out = [], s = 0; for (var i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; out.push(s / Math.min(i + 1, n)); } return out; }

  /* ---------- 畫圖 ---------- */
  function plot(cv, o) {
    var dpr = window.devicePixelRatio || 1, Wc = cv.clientWidth || 600, Hc = cv.clientHeight || 250;
    cv.width = Math.round(Wc * dpr); cv.height = Math.round(Hc * dpr);
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var L = 50, R = 10, T = 12, B = 26, pw = Wc - L - R, ph = Hc - T - B;
    c.fillStyle = '#0b0f14'; c.fillRect(0, 0, Wc, Hc);
    if (o.msg) { c.fillStyle = '#9aa7b5'; c.font = '14px sans-serif'; c.textAlign = 'center'; c.fillText(o.msg, Wc / 2, Hc / 2); return; }
    var x0 = o.xmin, x1 = o.xmax, y0 = o.ymin, y1 = o.ymax;
    function X(x) { return L + (x - x0) / (x1 - x0) * pw; } function Y(y) { return T + (y1 - y) / (y1 - y0) * ph; }
    if (o.band) { c.fillStyle = 'rgba(96,165,250,.22)'; c.fillRect(L, Y(o.band[1]), pw, Y(o.band[0]) - Y(o.band[1])); }
    if (o.win) { c.fillStyle = 'rgba(96,165,250,.25)'; c.fillRect(X(o.win[0]), T, Math.max(2, X(o.win[1]) - X(o.win[0])), ph); }
    c.strokeStyle = '#263241'; c.lineWidth = 1; c.fillStyle = '#9aa7b5'; c.font = '11px ui-monospace,Consolas,monospace';
    var nx = Wc < 420 ? 2 : 4;
    for (var i = 0; i <= 4; i++) { var gy = T + ph * i / 4; c.beginPath(); c.moveTo(L, gy); c.lineTo(L + pw, gy); c.stroke(); c.textAlign = 'right'; c.fillText(sig(y1 - (y1 - y0) * i / 4), L - 5, gy + 4); }
    for (i = 0; i <= nx; i++) { var gx = L + pw * i / nx; c.beginPath(); c.moveTo(gx, T); c.lineTo(gx, T + ph); c.stroke(); c.textAlign = i === 0 ? 'left' : i === nx ? 'right' : 'center'; c.fillText(o.xlab(x0 + (x1 - x0) * i / nx), gx, Hc - 8); }
    (o.hl || []).forEach(function (h) { c.strokeStyle = h.color; c.lineWidth = 2; c.setLineDash(h.dash ? [6, 4] : []); c.beginPath(); c.moveTo(L, Y(h.y)); c.lineTo(L + pw, Y(h.y)); c.stroke(); c.setLineDash([]); });
    (o.series || []).forEach(function (s) {
      if (!s.y.length) return;
      c.strokeStyle = s.color; c.lineWidth = s.w || 2; c.beginPath();
      s.y.forEach(function (v, k) { var px = X(s.x[k]), py = Y(v); if (k) c.lineTo(px, py); else c.moveTo(px, py); }); c.stroke();
      if (s.dots) { c.fillStyle = s.color; s.y.forEach(function (v, k) { c.beginPath(); c.arc(X(s.x[k]), Y(v), 3, 0, 7); c.fill(); }); }
    });
    (o.marks || []).forEach(function (m) { c.fillStyle = m.color; c.beginPath(); c.arc(X(m.x), Y(m.y), 5, 0, 7); c.fill(); c.textAlign = 'left'; c.fillText(m.label, Math.min(X(m.x) + 7, Wc - 60), Y(m.y) + (m.below ? 14 : -6)); });
  }

  /* ---------- 分頁 ---------- */
  var TABS = ['wf', 'st', 'ma'];
  function show(t) {
    RUN++;
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    TABS.forEach(function (k) { $('t-' + k).hidden = k !== t; });
    Array.prototype.forEach.call($('layer').children, function (f) { f.remove(); });
    if (t === 'wf') drawWf(); else if (t === 'st') drawSt(); else maAll(false);
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* =====================================================================
     1. Waveform：t0、dt、Y
     ===================================================================== */
  var DTS = [0.0005, 0.001, 0.002, 0.005, 0.01, 0.1];
  var W = { t0: new Date(2026, 10, 11, 9, 30, 15, 0), Y: [], built: false, busy: false };
  (function () { var r = rng(7); for (var k = 0; k < 25; k++) W.Y.push(Number((1.5 * Math.sin(2 * Math.PI * k / 10) + (r() - 0.5) * 0.3).toFixed(2))); })();
  function dtNow() { return DTS[+$('wdt').value]; }
  function z(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function clock(ms) { var d = new Date(ms); return z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()) + '.' + z(d.getMilliseconds(), 3); }
  function t0Text() { var d = W.t0; return d.getFullYear() + '/' + z(d.getMonth() + 1) + '/' + z(d.getDate()) + ' ' + clock(d.getTime()); }
  function yText() { return '[' + W.Y.slice(0, 4).join(', ') + ', …]（' + W.Y.length + ' 點）'; }
  function renderWsrc(out) {
    $('wsrc').innerHTML = [['t0', '時間戳記', '<span class="chip ts" id="s-t0">' + t0Text() + '</span>'], ['dt', 'DBL（秒）', '<span class="chip" id="s-dt">' + dtNow() + '</span>'], ['Y', '1D DBL 陣列', '<span class="chip arr" id="s-y">' + yText() + '</span>']].map(function (r) {
      return '<div class="it"><b>' + r[0] + '</b><span class="why" style="margin:0">' + (out ? '輸出 · ' : '') + r[1] + '</span>' + r[2] + '</div>';
    }).join('');
  }
  function fillWbox(on) {
    $('w-t0').innerHTML = on ? '<span class="chip ts">' + t0Text() + '</span>' : '';
    $('w-dt').innerHTML = on ? '<span class="chip">' + dtNow() + '</span>' : '';
    $('w-y').innerHTML = on ? '<span class="chip arr">' + yText() + '</span>' : '';
  }
  function drawWf() {
    var dt = dtNow(), n = W.Y.length, abs = $('wfmt').value === 'abs', t0 = W.t0.getTime();
    $('wdtv').textContent = dt + ' s（' + sig(1 / dt) + ' S/s）';
    if (!W.built) { plot($('cwf'), { msg: 'Graph 還沒收到 Waveform，先按 Build Waveform' }); return; }
    var xs = W.Y.map(function (_, k) { return k * dt; });
    plot($('cwf'), { xmin: 0, xmax: (n - 1) * dt, ymin: -2, ymax: 2, series: [{ x: xs, y: W.Y, color: '#ffd84d', dots: true }],
      xlab: function (x) { return abs ? clock(t0 + x * 1000) : sig(x) + ' s'; } });
  }
  $('wdt').oninput = function () {
    var dt = dtNow(), n = W.Y.length;
    if ($('s-dt')) $('s-dt').textContent = dt;
    if (W.built) fillWbox(true);
    drawWf();
    $('wsay').className = 'verdict-line';
    $('wsay').textContent = 'dt = ' + dt + ' s：' + n + ' 點橫跨 ' + sig((n - 1) * dt) + ' 秒（第一點在 0、最後一點在 (' + n + ' − 1) × dt），取樣率 1/dt = ' + sig(1 / dt) + ' S/s。Y 陣列的 25 個數字完全沒變。';
  };
  $('wfmt').onchange = function () {
    drawWf();
    $('wsay').className = 'verdict-line';
    $('wsay').textContent = $('wfmt').value === 'abs' ? 'X 軸從 t0 的時鐘時間 ' + clock(W.t0.getTime()) + ' 開始標，可以和 PLC 的異常紀錄時間對照。' : 'X 軸從 0 秒開始標，只看經過多久。資料一樣，只是刻度的寫法不同。';
  };
  $('wbuild').onclick = async function () {
    var my = ++RUN;
    renderWsrc(false); fillWbox(false); W.built = false; drawWf();
    $('wnode').textContent = 'Build\nWaveform';
    try {
      await fly($('s-t0'), $('w-t0'), 't0', my); $('w-t0').innerHTML = '<span class="chip ts">' + t0Text() + '</span>';
      await fly($('s-dt'), $('w-dt'), 'dt = ' + dtNow(), my); $('w-dt').innerHTML = '<span class="chip">' + dtNow() + '</span>';
      await fly($('s-y'), $('w-y'), 'Y[25]', my); $('w-y').innerHTML = '<span class="chip arr">' + yText() + '</span>';
      W.built = true; drawWf();
      $('wsay').className = 'verdict-line ok';
      $('wsay').textContent = '三個元素組成一條 Waveform 線，接到 Waveform Graph，X 軸自動變成時間。DAQmx Read 選 Waveform 輸出時，拿到的就是組好的 Waveform。';
    } catch (e) { caught(e); }
  };
  $('wget').onclick = async function () {
    if (!W.built) { $('wsay').className = 'verdict-line bad'; $('wsay').textContent = '還沒有 Waveform 可以拆，先按 Build Waveform。'; return; }
    var my = ++RUN;
    $('wnode').textContent = 'Get Waveform\nComponents';
    renderWsrc(true);
    ['s-t0', 's-dt', 's-y'].forEach(function (id) { $(id).style.visibility = 'hidden'; });
    try {
      await fly($('w-t0'), $('s-t0'), 't0', my); $('s-t0').style.visibility = '';
      await fly($('w-dt'), $('s-dt'), 'dt', my); $('s-dt').style.visibility = '';
      await fly($('w-y'), $('s-y'), 'Y', my); $('s-y').style.visibility = '';
      $('wsay').className = 'verdict-line ok';
      $('wsay').textContent = 'Get Waveform Components 把 t0、dt、Y 拿出來。要對 Y 做陣列運算（例如找最大值），先拆出 Y；要知道取樣率，拿 dt 算 1/dt。';
    } catch (e) { caught(e); ['s-t0', 's-dt', 's-y'].forEach(function (id) { if ($(id)) $(id).style.visibility = ''; }); }
  };
  renderWsrc(false); fillWbox(false);

  /* =====================================================================
     2. 統計
     ===================================================================== */
  var SIG = {
    cur: { off: 2.5, amp: 0.8, noise: 0.15, cyc: 6, unit: 'A', name: '馬達電流' },
    vib: { off: 0, amp: 2, noise: 0.3, cyc: 5, unit: 'mm/s', name: '振動' },
    tmp: { off: 4, amp: 0, noise: 0.2, cyc: 1, unit: '°C（相對 30 °C）', name: '溫度' }
  };
  var S = { seed: 11, g: [], n: 200 };
  function regen() { S.g = gauss(rng(S.seed), S.n); }
  regen();
  function loadSig(k) { var p = SIG[k]; $('soff').value = p.off; $('samp').value = p.amp; $('snoise').value = p.noise; drawSt(); }
  function sigData() {
    var p = SIG[$('ssig').value], off = +$('soff').value, amp = +$('samp').value, nz = +$('snoise').value, a = [];
    for (var i = 0; i < S.n; i++) a.push(off + amp * Math.sin(2 * Math.PI * p.cyc * i / S.n) + nz * S.g[i]);
    return a;
  }
  function stats(a) { var mm = maxmin(a); return { mean: mean(a), sdS: stdev(a, true), sdP: stdev(a, false), rms: rms(a), max: mm.max, imax: mm.imax, min: mm.min, imin: mm.imin, pp: mm.max - mm.min }; }
  function drawSt() {
    var p = SIG[$('ssig').value], a = sigData(), s = stats(a), xs = a.map(function (_, i) { return i; });
    $('soffv').textContent = $('soff').value; $('sampv').textContent = $('samp').value; $('snoisev').textContent = $('snoise').value;
    var lo = Math.min(s.min, -0.5, s.mean - s.sdS) - 0.3, hi = Math.max(s.max, 0.5, s.rms, s.mean + s.sdS) + 0.3;
    plot($('cst'), { xmin: 0, xmax: S.n - 1, ymin: lo, ymax: hi, xlab: function (x) { return String(Math.round(x)); },
      band: [s.mean - s.sdS, s.mean + s.sdS], series: [{ x: xs, y: a, color: '#ffd84d', w: 1.5 }],
      hl: [{ y: s.mean, color: '#4ade80' }, { y: s.rms, color: '#f472b6', dash: true }],
      marks: [{ x: s.imax, y: s.max, color: '#f87171', label: 'Max ' + f3(s.max) }, { x: s.imin, y: s.min, color: '#f87171', label: 'Min ' + f3(s.min), below: true }] });
    $('sbox').innerHTML = [['Mean', s.mean, 'Mean.vi'], ['σ（樣本，N − 1）', s.sdS, 'Std Deviation and Variance'], ['σ（母體，N）', s.sdP, '同上，weighting 選 Population'], ['RMS', s.rms, 'RMS.vi'], ['Max', s.max, 'Array Max & Min，index ' + s.imax], ['Min', s.min, 'Array Max & Min，index ' + s.imin], ['Peak-to-Peak', s.pp, 'Max − Min']].map(function (r) {
      return '<div>' + r[0] + '<b>' + f3(r[1]) + '</b><i>' + r[2] + '</i></div>';
    }).join('');
    $('sfx').innerHTML = 'N = ' + S.n + '（單位 ' + esc(p.unit) + '）<br>Mean = Σx ÷ N = ' + f3(s.mean) + '<br>σ（樣本）= √( Σ(x − Mean)² ÷ (N − 1) ) = ' + f3(s.sdS) + '　σ（母體）= √( Σ(x − Mean)² ÷ N ) = ' + f3(s.sdP) +
      '<br>RMS = √( Σx² ÷ N ) = ' + f3(s.rms) + '　驗算：√(Mean² + σ母體²) = ' + f3(Math.sqrt(s.mean * s.mean + s.sdP * s.sdP)) + '<br>Peak-to-Peak = Max − Min = ' + f3(s.max) + ' − (' + f3(s.min) + ') = ' + f3(s.pp);
    var say;
    if (Math.abs(s.mean) < 0.1 * Math.max(s.rms, 1e-9)) say = '平均幾乎是 0：Mean 看不出訊號有多大，RMS ≈ σ 才代表「抖多大」。正弦波沒有雜訊時，RMS = 振幅 ÷ √2。';
    else if (s.sdP < 0.2 * Math.abs(s.mean)) say = '直流偏移佔大部分：RMS 幾乎等於 |Mean|，σ 才看得出波動和雜訊有多大。';
    else say = '有偏移也有波動：RMS² = Mean² + σ²，兩部分都算進去了。';
    $('ssay').textContent = say;
  }
  $('ssig').onchange = function () { loadSig(this.value); };
  ['soff', 'samp', 'snoise'].forEach(function (id) { $(id).oninput = drawSt; });
  $('sre').onclick = function () { S.seed = rint(1, 1e6); regen(); drawSt(); };
  $('ssig').value = 'cur'; $('soff').value = SIG.cur.off; $('samp').value = SIG.cur.amp; $('snoise').value = SIG.cur.noise;

  /* =====================================================================
     3. 移動平均
     ===================================================================== */
  var M = { len: 140, on: 40, off: 100, g: gauss(rng(23), 140) };
  function maRaw() { var nz = +$('mnoise').value, a = []; for (var i = 0; i < M.len; i++) a.push((i >= M.on && i < M.off ? 3 : 0.3) + nz * M.g[i]); return a; }
  function maStats(raw, y, n) {
    var seg = function (a) { return a.slice(M.on + 25, M.off); };
    var half = -1; for (var i = M.on; i < M.off; i++) if (y[i] >= 1.65) { half = i - M.on; break; }
    return { sRaw: stdev(seg(raw), true), sMa: stdev(seg(y), true), half: half, full: n - 1 };
  }
  function maDraw(raw, y, upto, win) {
    var xs = raw.map(function (_, i) { return i; });
    plot($('cma'), { xmin: 0, xmax: M.len - 1, ymin: -0.8, ymax: 4.4, xlab: function (x) { return String(Math.round(x)); }, win: win,
      series: [{ x: xs, y: raw, color: '#6b7785', w: 1.2 }, { x: xs.slice(0, upto), y: y.slice(0, upto), color: '#ffd84d', w: 2.2 }] });
  }
  function maBox(raw, y, n) {
    var s = maStats(raw, y, n);
    $('mbox').innerHTML = '<div>運轉中的雜訊 σ（原始）<b>' + f3(s.sRaw) + ' A</b></div><div>運轉中的雜訊 σ（N = ' + n + '）<b>' + f3(s.sMa) + ' A</b></div><div>啟動後幾點到一半（1.65 A）<b>' + (s.half < 0 ? '—' : s.half + ' 點') + '</b></div><div>沒有雜訊時完全跟上<b>' + s.full + ' 點後</b></div>';
    $('msay').className = 'verdict-line';
    $('msay').textContent = n === 1 ? 'N = 1 就是原始訊號，沒有平均。' : 'N = ' + n + '：雜訊從 ' + f3(s.sRaw) + ' 降到 ' + f3(s.sMa) + '，但啟動後要 ' + (n - 1) + ' 點才完全跟上，邊緣變成斜坡。N 越大越平、越慢。';
  }
  function winCells(raw, i, n) {
    var a = raw.slice(Math.max(0, i - n + 1), i + 1);
    $('mwl').textContent = '第 ' + i + ' 點：最近 ' + a.length + ' 點（Shift Register 裡的內容，最右邊是新進來的）→ 平均 ' + f3(mean(a));
    $('mwin').innerHTML = a.map(function (v, k) { return '<span' + (k === a.length - 1 ? ' class="new"' : '') + '>' + v.toFixed(2) + '</span>'; }).join('');
  }
  function maAll(stop) {
    if (stop !== false) RUN++;
    var n = +$('mn').value, raw = maRaw(), y = movAvg(raw, n);
    $('mnoisev').textContent = $('mnoise').value;
    maDraw(raw, y, M.len, null); winCells(raw, M.len - 1, n); maBox(raw, y, n);
  }
  $('mall').onclick = function () { maAll(); };
  $('mn').onchange = function () { maAll(); };
  $('mnoise').oninput = function () { maAll(); };
  $('mrun').onclick = async function () {
    var my = ++RUN, n = +$('mn').value, raw = maRaw(), y = movAvg(raw, n);
    $('mbox').innerHTML = ''; $('msay').textContent = '';
    try {
      for (var i = 0; i < M.len; i++) {
        maDraw(raw, y, i + 1, [Math.max(0, i - n + 1) - 0.5, i + 0.5]); winCells(raw, i, n);
        await wait(i >= M.on - 3 && i <= M.on + n + 3 ? 160 : 45, my);
      }
      maDraw(raw, y, M.len, null); maBox(raw, y, n);
    } catch (e) { caught(e); }
  };

  window.addEventListener('resize', function () { var t = TABS.filter(function (k) { return !$('t-' + k).hidden; })[0]; if (t === 'wf') drawWf(); else if (t === 'st') drawSt(); else maAll(false); });

  /* =====================================================================
     4. 猜一猜
     ===================================================================== */
  function distinct(ans, list) { var seen = {}; seen[ans] = 1; return list.filter(function (w) { if (seen[w]) return false; seen[w] = 1; return true; }); }
  var GENS = [
    function () { return { q: 'LabVIEW 的 Waveform 資料型別，主要的三個元素是？', ans: 't0、dt、Y', wrong: distinct('t0、dt、Y', ['x0、dx、X 陣列', '開始時間、結束時間、Y', 'Y、取樣率、通道名稱', 't0、Y、點數']), ex: 't0 是第一點的時間戳記、dt 是每點間隔（秒）、Y 是資料陣列。' }; },
    function () {
      var dt = pickOne([0.001, 0.002, 0.01, 0.1]), n = pickOne([100, 250, 500, 1000]), ans = sig((n - 1) * dt) + ' 秒';
      return { q: 'Waveform 的 dt = ' + dt + ' s，Y 有 ' + n + ' 點。最後一點的時間是 t0 之後幾秒？', ans: ans, wrong: distinct(ans, [sig(n * dt) + ' 秒', sig(n / dt) + ' 秒', sig(dt) + ' 秒', sig((n + 1) * dt) + ' 秒']), ex: '第一點在 t0（0 秒），第 k 點在 k × dt，最後一點是 (' + n + ' − 1) × ' + dt + '。' };
    },
    function () {
      var dt = pickOne([0.0005, 0.001, 0.002, 0.005, 0.01]), fs = sig(1 / dt), ans = fs + ' S/s';
      return { q: 'Waveform 的 dt = ' + dt + ' s，取樣率是？', ans: ans, wrong: distinct(ans, [dt + ' S/s', sig(dt * 1000) + ' S/s', sig(2 / dt) + ' S/s', sig(1 / dt / 2) + ' S/s']), ex: '取樣率 = 1 ÷ dt。' };
    },
    function () {
      var a = [rint(1, 9), rint(1, 9), rint(1, 9), rint(1, 9)], m = mean(a), ans = sig(m);
      return { q: '[' + a.join(', ') + '] 的 Mean 是？', ans: ans, wrong: distinct(ans, [sig(m + 1), sig(a.reduce(function (s, v) { return s + v; }, 0)), sig((Math.max.apply(null, a) + Math.min.apply(null, a)) / 2 + 0.5), sig(rms(a))]), ex: '全部加起來 ÷ 個數 = ' + a.reduce(function (s, v) { return s + v; }, 0) + ' ÷ 4 = ' + sig(m) + '。' };
    },
    function () {
      var c = pickOne([[2, -2, 2, -2], [3, -3, 3, -3], [1, 1, 1, 1], [0, 4, 0, 4], [-5, -5, -5, -5]]), r = rms(c), ans = f3(r);
      return { q: '[' + c.join(', ') + '] 的 RMS 是？', ans: ans, wrong: distinct(ans, [f3(mean(c)), f3(Math.max.apply(null, c)), f3(Math.sqrt(c.reduce(function (s, v) { return s + v * v; }, 0))), f3(mean(c.map(Math.abs)) / 2), '0']), ex: 'RMS = √(平方的平均) = √((' + c.map(function (v) { return v * v; }).join(' + ') + ') ÷ 4) = ' + ans + '。正負號平方後都變正，所以 RMS 不會是負的。' };
    },
    function () {
      var a = [rint(-5, 5), rint(-5, 5), rint(-5, 5), rint(-5, 5), rint(-5, 5)], mm = maxmin(a), ans = String(mm.max - mm.min);
      return { q: '[' + a.join(', ') + '] 的 Peak-to-Peak（峰對峰值）是？', ans: ans, wrong: distinct(ans, [String(mm.max), String(mm.max + mm.min), String(Math.abs(mm.min)), String(mm.max - mm.min + 1), String(mm.max - mm.min - 1), String(mm.max - mm.min + 2)]), ex: 'Max − Min = ' + mm.max + ' − (' + mm.min + ') = ' + ans + '。' };
    },
    function () {
      var A = pickOne([1, 2, 4, 10]), ans = f3(A / Math.SQRT2);
      return { q: '振動訊號是振幅 ' + A + ' 的正弦波，沒有偏移、沒有雜訊，取很多個完整週期。RMS 約是？', ans: ans, wrong: distinct(ans, [String(A), '0', String(2 * A), f3(A / 2)]), ex: '正弦波的 RMS = 振幅 ÷ √2 ≈ 0.707 × 振幅。它的 Mean 是 0。' };
    },
    function () {
      var c = pickOne([2.5, 3, 24, -1.5]), which = pickOne(['sd', 'rms']), ans = which === 'sd' ? '0' : String(Math.abs(c));
      return { q: '溫度感測器讀到的值一直是 ' + c + '（完全沒有變化，共 100 點）。它的 ' + (which === 'sd' ? '標準差' : 'RMS') + ' 是？', ans: ans, wrong: distinct(ans, ['0', String(Math.abs(c)), String(c * c), String(c / 2), '100']), ex: '固定值：Mean = ' + c + '、標準差 = 0（完全沒有波動）、RMS = |' + c + '|。' };
    },
    function () { return { q: '標準差除以 <b>N − 1</b> 的是哪一種？', ans: '樣本（Sample）標準差', wrong: distinct('樣本（Sample）標準差', ['母體（Population）標準差', 'RMS', '平均絕對誤差']), ex: '樣本除以 N − 1，母體除以 N。Std Deviation and Variance VI 的 weighting 輸入可以選。點數多時兩者差很少。' }; },
    function () {
      var a = [rint(0, 9), rint(0, 9), rint(0, 9), rint(0, 9), rint(0, 9), rint(0, 9)], n = pickOne([3, 4]), last = a.slice(-n), ans = sig(mean(last));
      return { q: '訊號 [' + a.join(', ') + ']，N = ' + n + ' 的移動平均，<b>最後一點</b>的輸出是？', ans: ans, wrong: distinct(ans, [sig(mean(a)), sig(a[a.length - 1]), sig(mean(a.slice(0, n))), sig(mean(last) + 1), sig(mean(last) - 1), sig(last.reduce(function (s, v) { return s + v; }, 0))]), ex: '最後一點 = 最近 ' + n + ' 點 [' + last.join(', ') + '] 的平均 = ' + ans + '。' };
    },
    function () {
      var k = rint(20, 60), n = pickOne([3, 4, 5, 8]), ans = '第 ' + (k + n - 1) + ' 點';
      return { q: '沒有雜訊的訊號在第 ' + k + ' 點從 0 跳到 10。N = ' + n + ' 的移動平均（每點 = 含自己在內最近 ' + n + ' 點的平均）第一次等於 10 是在？', ans: ans, wrong: distinct(ans, ['第 ' + k + ' 點', '第 ' + (k + n) + ' 點', '第 ' + (k + 1) + ' 點', '第 ' + (k + 2 * n) + ' 點']), ex: '要等視窗裡 ' + n + ' 點全部是新值：第 ' + k + ' 到第 ' + (k + n - 1) + ' 點。' };
    },
    function () { return { q: '移動平均的視窗 N 從 5 改成 25，會怎樣？', ans: '雜訊更小，但反應更慢、邊緣更鈍', wrong: distinct('雜訊更小，但反應更慢、邊緣更鈍', ['雜訊更小，而且反應更快', '雜訊變大', '完全沒差', '平均值整體往上偏']), ex: '平均的點越多越平，但新變化要等更多點才反應出來。' }; },
    function () { return { q: '想從 DAQ 讀回來的 Waveform 拿出 dt 算取樣率，用哪個函式？', ans: 'Get Waveform Components', wrong: distinct('Get Waveform Components', ['Build Waveform', 'Index Array', 'Array Subset']), ex: 'Get Waveform Components 拆出 t0、dt、Y；Build Waveform 是反過來組合。' }; },
    function () { return { q: '把 Waveform 的 dt 從 0.001 改成 0.002（Y 不動），Waveform Graph 會？', ans: '曲線形狀一樣，X 軸的時間刻度變成兩倍', wrong: distinct('曲線形狀一樣，X 軸的時間刻度變成兩倍', ['Y 值全部變成一半', '點數變成一半', '曲線變成兩倍高', '沒有任何變化']), ex: 'dt 只決定每點在 X 軸上的位置，Y 一個數字都沒變。' }; }
  ];
  function gen() { return pickOne(GENS)(); }

  /* ---------- 初始化 ---------- */
  var first = /^#(wf|st|ma)$/.test(location.hash) ? location.hash.slice(1) : 'wf';
  show(first);
  $('wdt').oninput();
  window.WaveLab = {
    mean: mean, stdev: stdev, rms: rms, maxmin: maxmin, movAvg: movAvg, stats: stats, state: { wave: W, sig: S, ma: M }, show: show,
    GENS: GENS, gen: gen, quiz: window.LabQuiz ? window.LabQuiz('wquiz', gen) : null
  };
})();
