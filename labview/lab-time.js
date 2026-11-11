/* 時間實驗室：Tick Count 繞回、逾時判定、時間戳與格式碼 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function log(id, s) { var l = $(id); l.insertBefore(el('div', '', s), l.firstChild); }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function n3(x) { return Math.round(x).toLocaleString('en-US'); }
  function sec(ms) { return (ms / 1000).toFixed(1) + ' s'; }
  var WRAP = 4294967296, LIMIT = 8000;

  var tabs = $('tabs'), CUR = 'wrap';
  function stopAll() { wStop(); hPause(); sClockStop(); }
  function show(t) {
    stopAll(); CUR = t;
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['wrap', 'tmo', 'stamp'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
    if (t === 'stamp') sClockStart();
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* ================= 1. Tick Count 繞回 ================= */
  function u32sub(a, b) { return ((a - b) % WRAP + WRAP) % WRAP; }
  function wCalc(pos, e) {
    var start = ((pos % WRAP) + WRAP) % WRAP, now = (start + e) % WRAP;
    return { start: start, now: now, u32: u32sub(now, start), dbl: now - start, e: e };
  }
  var W = { e: 0, raf: null, gen: 0, hit: {} };
  function wStop() { W.gen++; if (W.raf) cancelAnimationFrame(W.raf); W.raf = null; $('wplay').textContent = '▶ 開始移動'; }
  function wReset() { wStop(); W.e = 0; W.hit = {}; say('wsay', ''); wDraw(); }
  function wJudge(r) {
    if (r.u32 > LIMIT && W.hit.u32 == null) W.hit.u32 = r.e;
    if (r.dbl > LIMIT && W.hit.dbl == null) W.hit.dbl = r.e;
  }
  function wDraw() {
    var pos = +$('wpos').value, act = +$('wact').value, r = wCalc(pos, W.e);
    $('wposv').textContent = (pos < 0 ? '還差 ' + n3(-pos) + ' ms' : pos === 0 ? '剛好在 0' : '已過 ' + n3(pos) + ' ms');
    $('wactv').textContent = n3(act) + ' ms';
    // 表格
    var rows = [
      ['開始（U32）', n3(r.start), ''],
      ['現在（U32）', n3(r.now), ''],
      ['U32 現在 − 開始', n3(r.u32), r.u32 > LIMIT ? '超時' : '未超時', r.u32 === r.e],
      ['轉 DBL（或 I64）再減', n3(r.dbl), r.dbl > LIMIT ? '超時' : '未超時', r.dbl === r.e]
    ];
    $('wtab').innerHTML = '<tr><th style="width:44%">項目</th><th>值（ms）</th><th style="width:22%">&gt; 8000？</th></tr>' + rows.map(function (x) { return '<tr class="' + (x[3] === undefined ? '' : x[3] ? 'ok' : 'bad') + '"><td>' + x[0] + '</td><td class="num">' + x[1] + '</td><td>' + x[2] + '</td></tr>'; }).join('') +
      '<tr><td>真正經過</td><td class="num">' + n3(r.e) + '</td><td>' + (r.e > LIMIT ? '應該超時' : '') + '</td></tr>';
    // 計數環（放大繞回點附近 ±15 秒）
    var cx = 130, cy = 130, R = 96, SPAN = 15000;
    function off(v) { return v >= WRAP / 2 ? v - WRAP : v; }
    function pt(v, rr) { var a = off(v) / SPAN * 170 * Math.PI / 180; return [cx + (rr || R) * Math.sin(a), cy - (rr || R) * Math.cos(a)]; }
    var s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="10"/>';
    s += '<line x1="' + cx + '" y1="' + (cy - R - 14) + '" x2="' + cx + '" y2="' + (cy - R + 14) + '" stroke="#dc2626" stroke-width="3"/>';
    s += '<text x="' + (cx + 6) + '" y="16" style="fill:var(--lab-red)">0</text><text x="' + (cx - 6) + '" y="16" text-anchor="end" style="fill:var(--lab-red)">4294967295</text>';
    // 走過的弧
    var steps = 40, d = '';
    for (var i = 0; i <= steps; i++) { var p = pt((r.start + W.e * i / steps) % WRAP); d += (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }
    if (W.e > 0) s += '<path d="' + d + '" fill="none" stroke="#f59e0b" stroke-width="10" stroke-linecap="round"/>';
    var ps = pt(r.start), pn = pt(r.now);
    s += '<circle cx="' + ps[0] + '" cy="' + ps[1] + '" r="8" style="fill:var(--on)"/><circle cx="' + pn[0] + '" cy="' + pn[1] + '" r="8" fill="#e8820c" stroke="#7c2d12" stroke-width="2"/>';
    s += '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle">藍＝開始</text><text x="' + cx + '" y="' + (cy + 12) + '" text-anchor="middle">橘＝現在</text>';
    s += '<text x="' + cx + '" y="' + (cy + 34) + '" text-anchor="middle" style="font-size:11px;fill:var(--mute)">只畫繞回點前後 15 秒</text>';
    $('wdial').innerHTML = s;
    if (W.e >= act && !W.raf) wVerdict();
  }
  function wVerdict() {
    var act = +$('wact').value, crossed = wCalc(+$('wpos').value, 0).start + act >= WRAP && +$('wpos').value < 0;
    if (act <= LIMIT) { say('wsay', '動作 ' + n3(act) + ' ms 就完成，沒超過 8000 ms。' + (crossed ? '雖然跨過繞回點，U32 相減算出的經過時間還是對的；DBL 那一列變成負數，這次只是剛好不需要報警。' : ''), crossed ? '' : 'ok'); return; }
    var u = W.hit.u32, d = W.hit.dbl;
    if (d == null) say('wsay', '✖ 動作花了 ' + n3(act) + ' ms，U32 寫法在 ' + n3(u) + ' ms 判定超時；先轉 DBL 的寫法跨過繞回點後變成負數，<b>永遠不會判定超時</b>，X 軸卡住也不會報警。', 'bad');
    else say('wsay', '✔ 這次沒有跨過繞回點，兩種寫法都在 ' + n3(u) + ' ms 判定超時。把起點拉到繞回點前面再試一次。', 'ok');
  }
  function wPlay() {
    if (W.raf) { wStop(); return; }
    if (W.e >= +$('wact').value) { W.e = 0; W.hit = {}; }
    var g = ++W.gen, act = +$('wact').value, t0 = null, e0 = W.e, rate = act / 3000;
    say('wsay', ''); $('wplay').textContent = '⏸ 暫停';
    function fr(ts) {
      if (g !== W.gen) return;
      if (t0 == null) t0 = ts;
      W.e = Math.min(act, Math.round(e0 + (ts - t0) * rate));
      wJudge(wCalc(+$('wpos').value, W.e));
      if (W.e >= act) { W.raf = null; $('wplay').textContent = '▶ 開始移動'; wDraw(); return; }
      wDraw(); W.raf = requestAnimationFrame(fr);
    }
    W.raf = requestAnimationFrame(fr);
  }
  /* 測試用：直接跑完 */
  function wRunSync(pos, act) {
    wStop(); if (pos != null) $('wpos').value = pos; if (act != null) $('wact').value = act;
    W.hit = {}; for (var e = 0; e <= +$('wact').value; e += 50) { W.e = e; wJudge(wCalc(+$('wpos').value, e)); }
    W.e = +$('wact').value; wDraw(); return { hit: W.hit, say: $('wsay').textContent };
  }
  $('wplay').onclick = wPlay; $('wreset').onclick = wReset;
  $('wpos').oninput = $('wact').oninput = wReset;
  wReset();

  /* ================= 2. 逾時判定 ================= */
  var H;
  function hNew() {
    if (H) clearInterval(H.timer);
    H = { t: 0, timer: null, gen: (H ? H.gen : 0) + 1, beat: true, hb: 1, nextInc: 700,   /* PLC 的心跳和 LabVIEW 的迴圈不同步 */ hbStopAt: null, lastInc: 0, stopAt: null, pulse: false,
      A: { next: 0, last: 1, lastChange: 0, lost: false, detect: null, stopped: null, iters: 0 },
      B: { phase: 'start', next: 0, first: null, waitEnd: 0, lost: false, detect: null, stopped: null, iters: 0 } };
    $('hlog').innerHTML = ''; say('hsay', '按「執行」。');
    hDraw();
  }
  function hPause() { if (H && H.timer) { clearInterval(H.timer); H.timer = null; if ($('hrun')) $('hrun').textContent = '▶ 執行'; } }
  function hTick(dt) {
    dt = dt || 50; H.t += dt; H.pulse = false;
    var t = H.t, A = H.A, B = H.B;
    if (H.beat && t >= H.nextInc) { H.hb = H.hb >= 32767 ? 1 : H.hb + 1; H.nextInc += 1000; H.lastInc = t; H.pulse = true; }
    // 左：每 100 ms 一圈，Tick Count 比較
    while (A.stopped == null && t >= A.next) {
      A.iters++;
      if (H.hb !== A.last) { A.last = H.hb; A.lastChange = A.next; if (A.lost) { A.lost = false; log('hlog', sec(A.next) + ' 左：心跳又變了，恢復連線'); } }
      if (!A.lost && A.next - A.lastChange > 3000) { A.lost = true; if (A.detect == null && H.hbStopAt != null) A.detect = A.next; log('hlog', sec(A.next) + ' 左：「現在 − 上次變化」= ' + (A.next - A.lastChange) + ' ms &gt; 3000 → <b>判定斷線</b>'); }
      if (H.stopAt != null) { A.stopped = A.next; log('hlog', sec(A.next) + ' 左：這圈讀到 STOP，迴圈結束（按下後 ' + (A.next - H.stopAt) + ' ms）'); }
      A.next += 100;
    }
    // 右：讀一次 → Wait 3000 → 再讀一次比較
    var guard = 0;
    while (B.stopped == null && guard++ < 5) {
      if (B.phase === 'start' && t >= B.next) {
        if (H.stopAt != null) { B.stopped = B.next; log('hlog', sec(B.next) + ' 右：Wait 結束、回到迴圈開頭才讀到 STOP（按下後 ' + (B.next - H.stopAt) + ' ms）'); break; }
        B.first = H.hb; B.phase = 'wait'; B.waitEnd = B.next + 3000;
      } else if (B.phase === 'wait' && t >= B.waitEnd) {
        B.iters++;
        var same = H.hb === B.first;
        if (same && !B.lost) { B.lost = true; if (B.detect == null && H.hbStopAt != null) B.detect = B.waitEnd; log('hlog', sec(B.waitEnd) + ' 右：等了 3 秒，前後都是 ' + H.hb + ' → <b>判定斷線</b>'); }
        else if (!same && B.lost) { B.lost = false; log('hlog', sec(B.waitEnd) + ' 右：心跳變了，恢復連線'); }
        B.phase = 'start'; B.next = B.waitEnd;
      } else break;
    }
    hDraw();
    if (A.stopped != null && B.stopped != null) { hPause(); say('hsay', '左邊按下 STOP 後 ' + (A.stopped - H.stopAt) + ' ms 就停；右邊要 ' + (B.stopped - H.stopAt) + ' ms，因為它正卡在 Wait 3000 ms 裡。', 'ok'); }
  }
  function hDraw() {
    var A = H.A, B = H.B, t = H.t;
    $('ht').textContent = sec(t); $('hhb').textContent = H.hb;
    if (H.pulse) { var e = $('hhb'); e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); }
    $('hline').className = 'lmp ' + (H.beat ? 'on' : 'off'); $('hline').lastChild.textContent = H.beat ? '心跳正常（每秒 +1）' : '心跳停住了（' + sec(t - H.hbStopAt) + '）';
    $('hplug').textContent = H.beat ? '⏸ 讓心跳停住（模擬 PLC 當機）' : '▶ 恢復心跳';
    var el1 = Math.max(0, Math.min(t, A.next) - A.lastChange), p1 = Math.min(100, el1 / 3000 * 100);
    $('hA').innerHTML = '<h3>✔ 每 100 ms 一圈＋Tick Count 比較</h3>' +
      '<span class="lmp ' + (A.lost ? 'off' : 'on') + '"><i></i>' + (A.lost ? '判定斷線' : '連線中') + '</span>' +
      '<div class="lbl">現在 − 上次變化：' + el1 + ' ms / 3000</div><div class="pbar ' + (A.lost ? 'bad' : p1 > 60 ? 'warn' : '') + '"><i style="width:' + p1 + '%"></i></div>' +
      '<div class="kv"><span>迴圈圈數</span><b>' + A.iters + '</b><span>上次看到變化</span><b>' + sec(A.lastChange) + '</b>' +
      '<span>心跳停住後多久發現</span><b>' + (A.detect != null ? ((A.detect - H.hbStopAt) / 1000).toFixed(1) + ' s' : '–') + '</b>' +
      '<span>STOP 反應</span><b>' + (A.stopped != null ? (A.stopped - H.stopAt) + ' ms' : H.stopAt != null ? '…' : '–') + '</b></div>';
    var p2 = B.phase === 'wait' ? Math.min(100, (t - (B.waitEnd - 3000)) / 3000 * 100) : 0;
    $('hB').innerHTML = '<h3>✖ 讀一次 → Wait 3000 ms → 再讀一次</h3>' +
      '<span class="lmp ' + (B.lost ? 'off' : 'on') + '"><i></i>' + (B.lost ? '判定斷線' : '連線中') + '</span>' +
      '<div class="lbl">' + (B.stopped != null ? '迴圈已停' : B.phase === 'wait' ? 'Wait 3000 ms 中（迴圈卡在這裡，什麼都不能做）' : '迴圈開頭') + '</div><div class="pbar warn"><i style="width:' + (B.stopped != null ? 0 : p2) + '%"></i></div>' +
      '<div class="kv"><span>迴圈圈數</span><b>' + B.iters + '</b><span>這輪第一次讀到</span><b>' + (B.first == null ? '–' : B.first) + '</b>' +
      '<span>心跳停住後多久發現</span><b>' + (B.detect != null ? ((B.detect - H.hbStopAt) / 1000).toFixed(1) + ' s' : '–') + '</b>' +
      '<span>STOP 反應</span><b>' + (B.stopped != null ? (B.stopped - H.stopAt) + ' ms' : H.stopAt != null ? '還在 Wait…' : '–') + '</b></div>';
    $('hstop').classList.toggle('on', H.stopAt != null); $('hstop').disabled = H.stopAt != null || !H.timer;
    $('hplug').disabled = H.stopAt != null;
    if (A.detect != null && B.detect != null && H.stopAt == null) say('hsay', '心跳停住後，左邊 ' + ((A.detect - H.hbStopAt) / 1000).toFixed(1) + ' 秒發現，右邊 ' + ((B.detect - H.hbStopAt) / 1000).toFixed(1) + ' 秒' + (B.detect > A.detect ? '才發現。' : '發現（這次 3 秒區間剛好對齊，右邊沒吃虧；恢復心跳後換個時間點再停一次）。') + '現在按 STOP 比比看反應。');
    else if (A.detect != null && B.detect == null && H.stopAt == null) say('hsay', '左邊已經判定斷線，右邊還在等它的 3 秒區間結束。', 'bad');
  }
  function hToggleBeat() {
    if (!H.beat) { H.beat = true; H.nextInc = H.t + 1000; H.hbStopAt = null; H.A.detect = null; H.B.detect = null; log('hlog', sec(H.t) + ' 心跳恢復'); }
    else { H.beat = false; H.hbStopAt = H.t; log('hlog', sec(H.t) + ' 心跳停住（最後一次加 1 是在 ' + sec(H.lastInc) + '）'); }
    hDraw();
  }
  function hStopBtn() { if (H.stopAt == null) { H.stopAt = H.t; log('hlog', sec(H.t) + ' 按下 STOP'); hDraw(); } }
  $('hrun').onclick = function () {
    if (H.timer) { hPause(); return; }
    if (H.A.stopped != null && H.B.stopped != null) hNew();
    var g = H.gen;
    H.timer = setInterval(function () { if (g !== H.gen) return; hTick(50); }, 50);
    $('hrun').textContent = '⏸ 暫停'; hDraw();
  };
  $('hplug').onclick = hToggleBeat; $('hstop').onclick = hStopBtn;
  $('hreset').onclick = function () { hPause(); hNew(); };
  hNew();

  /* ================= 3. 時間戳與格式碼 ================= */
  var EPOCH1904 = 2082844800;   // 1904-01-01 到 1970-01-01 的秒數
  var CODES = [
    ['%Y', '西元年，4 位數'], ['%y', '西元年後 2 位'], ['%m', '月，01～12'], ['%d', '日，01～31'],
    ['%H', '時，00～23（24 小時制）'], ['%I', '時，01～12（12 小時制）'], ['%M', '分，00～59'], ['%S', '秒，00～59'],
    ['%3u', '秒的小數部分，3 位（毫秒）；%1u、%2u 是 1、2 位'], ['%j', '一年中的第幾天，001～366'], ['%%', '一個 % 字元']
  ];
  function p2(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function parts(ms, utc) {
    var d = new Date(ms), g = utc ? 'getUTC' : 'get';
    var Y = d[g + 'FullYear'](), M = d[g + 'Month'](), D = d[g + 'Date']();
    var start = utc ? Date.UTC(Y, 0, 1) : new Date(Y, 0, 1).getTime(), cur = utc ? Date.UTC(Y, M, D) : new Date(Y, M, D).getTime();
    return { Y: Y, M: M + 1, D: D, h: d[g + 'Hours'](), m: d[g + 'Minutes'](), s: d[g + 'Seconds'](), ms: d[g + 'Milliseconds'](), j: Math.round((cur - start) / 86400000) + 1 };
  }
  /* 回傳 { text, unknown:[…] } */
  function fmtDT(f, ms, utc) {
    var P = parts(ms, utc), unk = [];
    var out = f.replace(/%(\d?)([A-Za-z%])/g, function (all, dg, c) {
      if (dg) { if (c === 'u' && +dg >= 1 && +dg <= 3) return '.' + p2(P.ms, 3).slice(0, +dg); unk.push(all); return all; }
      switch (c) {
        case 'Y': return String(P.Y); case 'y': return p2(P.Y % 100); case 'm': return p2(P.M); case 'd': return p2(P.D);
        case 'H': return p2(P.h); case 'I': return p2(P.h % 12 === 0 ? 12 : P.h % 12); case 'M': return p2(P.m); case 'S': return p2(P.s);
        case 'j': return p2(P.j, 3); case '%': return '%';
      }
      unk.push(all); return all;
    });
    return { text: out, unknown: unk };
  }
  function lvSeconds(ms) { return ms / 1000 + EPOCH1904; }
  var S = { frozen: null, timer: null, gen: 0 };
  function sNow() { return S.frozen != null ? S.frozen : Date.now(); }
  function sDraw() {
    var ms = sNow(), utc = $('sutc').checked, r = fmtDT($('sfmt').value, ms, utc);
    $('sout').textContent = r.text || ' ';
    $('sraw').innerHTML = '<span>timestamp</span><b>' + lvSeconds(ms).toFixed(3) + ' 秒</b><span>意思</span><b>從 1904-01-01 00:00 UTC 起算</b>';
    $('scodes').innerHTML = '<tr><th style="width:18%">碼</th><th>意思</th><th style="width:28%">現在</th></tr>' + CODES.map(function (c) { return '<tr><td class="num">' + c[0] + '</td><td>' + c[1] + '</td><td class="num">' + fmtDT(c[0], ms, utc).text + '</td></tr>'; }).join('');
    if (r.unknown.length) say('ssay', '「' + r.unknown.join('、') + '」不在上面的清單裡，這裡原樣輸出。不代表 LabVIEW 不支援，請查 LabVIEW 說明的 Time Format Codes。', 'bad');
    else if (!$('ssay').dataset.keep) say('ssay', '');
  }
  function sClockStart() { sClockStop(); var g = ++S.gen; S.timer = setInterval(function () { if (g !== S.gen) return; if (S.frozen == null) sDraw(); }, 100); sDraw(); }
  function sClockStop() { S.gen++; clearInterval(S.timer); S.timer = null; }
  ['%Y-%m-%d %H:%M:%S', '%Y%m%d', '%H:%M:%S%3u', '%Y/%m/%d %I:%M', '%y%m%d_%H%M%S', '第 %j 天'].forEach(function (f) {
    var b = el('button', '', f); b.type = 'button'; b.onclick = function () { $('sfmt').value = f; sDraw(); }; $('spre').appendChild(b);
  });
  $('sfmt').oninput = sDraw; $('sutc').onchange = sDraw;
  $('sfreeze').onclick = function () { if (S.frozen == null) { S.frozen = Date.now(); this.textContent = '▶ 時間繼續走'; } else { S.frozen = null; this.textContent = '⏸ 凍結時間'; } sDraw(); };
  function sLog(dur, jump) {
    dur = dur || 1200 + Math.floor(Math.random() * 13) * 100; if (jump == null) jump = $('sjump').checked;
    // 校時往回撥 5 秒：結束時讀到的時鐘比開始時「少走」5 秒，時間戳相減 = 真正耗時 − 5000
    var t1 = sNow(), real = dur, tsDiff = jump ? dur - 5000 : dur;
    var line = fmtDT('%Y-%m-%d %H:%M:%S', t1, $('sutc').checked).text + ',X 軸移動,' + real;
    log('slogbox', line + '　<span style="color:var(--mute)">（Tick Count 相減 ' + real + ' ms；時間戳相減 ' + tsDiff + ' ms）</span>');
    say('ssay', jump ? '✖ 中途校時往回撥 5 秒：時間戳相減得到 ' + tsDiff + ' ms（負的！），Tick Count 相減還是 ' + real + ' ms。耗時欄要用 Tick Count。' : '✔ 時間欄 ' + line.split(',')[0] + ' 來自時間戳，耗時 ' + real + ' ms 來自 Tick Count。沒有校時時兩種相減剛好一樣。', jump ? 'bad' : 'ok');
    $('ssay').dataset.keep = '1'; setTimeout(function () { delete $('ssay').dataset.keep; }, 4000);
    return { line: line, tick: real, ts: tsDiff };
  }
  $('slog').onclick = function () { sLog(); };
  sDraw();

  if (/^#(wrap|tmo|stamp)$/.test(location.hash)) show(location.hash.slice(1));
  window.TimeLab = {
    show: show, stopAll: stopAll, WRAP: WRAP,
    u32sub: u32sub, wCalc: wCalc, wRunSync: wRunSync, W: function () { return W; },
    hNew: hNew, hTick: hTick, hToggleBeat: hToggleBeat, hStop: hStopBtn, H: function () { return H; },
    fmtDT: fmtDT, lvSeconds: lvSeconds, sLog: sLog, S: function () { return S; }
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  var T = window.TimeLab;
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function r(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function n3(x) { return x.toLocaleString('en-US'); }
  var KIND = [
    function () {
      return { q: 'Tick Count (ms) 輸出的資料型別是？', ans: 'U32（無號 32 位元整數）', wrong: ['DBL', 'I32', 'Timestamp', 'U64'], ex: 'U32 毫秒，所以約 49.7 天繞回一次。' };
    },
    function () {
      return { q: 'Tick Count (ms) 大約多久會繞回 0 一次？', ans: '約 49.7 天', wrong: ['約 24.8 天', '約 1 天', '約 136 年', '永遠不會'], ex: '2 的 32 次方毫秒 ≈ 4,294,967 秒 ≈ 49.7 天。（24.8 天是 I32 的一半範圍。）' };
    },
    function () {
      var s = 4294967296 - r(1, 9) * 1000, n = r(1, 9) * 1000, d = T.u32sub(n, s);
      return { q: '開始時 Tick Count = ' + n3(s) + '，現在 = ' + n3(n) + '。兩個 U32 直接相減，結果是？', ans: n3(d), wrong: [n3(n - s), n3(s - n), n3(n), '0'], ex: 'U32 相減跨過繞回點會自動補回 2^32：' + n3(n) + ' − ' + n3(s) + ' + 4,294,967,296 = ' + n3(d) + ' ms。' };
    },
    function () {
      var s = 4294967296 - r(1, 9) * 1000, n = r(1, 9) * 1000;
      return { q: '同樣開始 ' + n3(s) + '、現在 ' + n3(n) + '，但兩個都<b>先轉成 DBL</b> 再相減，再判斷「經過時間 &gt; 8000 ms」。會？', ans: '得到很大的負數，永遠判斷不到超時', wrong: ['結果一樣正確', '得到很大的正數，馬上判斷超時', 'LabVIEW 出錯停止', '得到 0'], ex: n3(n) + ' − ' + n3(s) + ' = ' + n3(n - s) + '，負數永遠不會大於 8000。要先用 U32 相減再轉型。' };
    },
    function () {
      return { q: '在 While Loop 裡判斷「X 軸移動超過 8 秒沒到位就報警」，比較好的寫法是？', ans: '開始時把 Tick Count 存進 Shift Register，每圈比較現在減開始', wrong: ['迴圈裡放 Wait 8000 ms，等完再看有沒有到位', '用 Get Date/Time In Seconds 相減', '用迴圈圈數乘上 Wait 的毫秒數估算', '把 Tick Count 轉成 DBL 存起來再比'], ex: '迴圈照常轉，每圈多一次減法和比較；不會卡住畫面，跨過繞回點也正確。' };
    },
    function () {
      var w = p1([2000, 3000, 5000]);
      return { q: '迴圈裡讀一次心跳、Wait ' + w + ' ms、再讀一次比較。操作員在 Wait 剛開始時按 STOP（端子在迴圈開頭讀），大約多久迴圈才會停？', ans: '約 ' + w / 1000 + ' 秒', wrong: ['立刻', '約 0.1 秒', '約 ' + (w / 500) + ' 秒', '永遠不會停'], ex: 'Wait 期間迴圈卡在原地，要等 Wait 結束、回到迴圈開頭才讀到 STOP。' };
    },
    function () {
      var x = p1([1500, 2800, 3200, 4500]);
      return { q: '看門狗：心跳 3 秒（3000 ms）沒變就算斷線。上次心跳變化時的 Tick Count 是 T，現在是 T + ' + x + '。判斷結果？', ans: x > 3000 ? '斷線' : '正常', wrong: [x > 3000 ? '正常' : '斷線', '無法判斷，要等 Wait 結束', '要看心跳值是不是 0', '要轉成 DBL 才能比'], ex: '經過 ' + x + ' ms ' + (x > 3000 ? '&gt;' : '≤') + ' 3000 ms。' };
    },
    function () {
      var Y = r(2024, 2027), M = r(1, 12), D = r(1, 28), h = r(0, 23), m = r(0, 59), s = r(0, 59);
      function p(n) { return (n < 10 ? '0' : '') + n; }
      var ans = Y + '-' + p(M) + '-' + p(D) + ' ' + p(h) + ':' + p(m) + ':' + p(s);
      return { q: '時間是 ' + Y + ' 年 ' + M + ' 月 ' + D + ' 日 ' + h + ' 點 ' + m + ' 分 ' + s + ' 秒。Format Date/Time String 的格式碼 <code>%Y-%m-%d %H:%M:%S</code> 輸出？', ans: ans, wrong: [Y + '-' + M + '-' + D + ' ' + h + ':' + m + ':' + s, Y + '-' + p(D) + '-' + p(M) + ' ' + p(h) + ':' + p(m) + ':' + p(s), String(Y).slice(2) + '-' + p(M) + '-' + p(D) + ' ' + p(h) + ':' + p(m) + ':' + p(s), Y + '-' + p(m) + '-' + p(D) + ' ' + p(h) + ':' + p(M) + ':' + p(s), Y + '/' + p(M) + '/' + p(D) + ' ' + p(h) + ':' + p(m) + ':' + p(s), p(M) + '-' + p(D) + '-' + Y + ' ' + p(h) + ':' + p(m) + ':' + p(s)], ex: '%m 是月、%M 是分，大小寫不同；月日時分秒都補成 2 位。' };
    },
    function () {
      var h = r(13, 23);
      return { q: '下午 ' + (h - 12) + ' 點（' + h + ':00），格式碼 <code>%I</code> 輸出？', ans: (h - 12 < 10 ? '0' : '') + (h - 12), wrong: [String(h), (h - 12) + ' PM', 'PM', String(h - 1)], ex: '%I 是 12 小時制的時（01～12），%H 才是 24 小時制。' };
    },
    function () {
      return { q: '格式碼 <code>%3u</code> 代表什麼？', ans: '秒的小數部分 3 位（毫秒）', wrong: ['3 位數的年', '一年中的第幾天', '星期幾', 'UTC 時差'], ex: '常接在 %S 後面：%H:%M:%S%3u，紀錄到毫秒。' };
    },
    function () {
      return { q: 'Get Date/Time In Seconds 輸出的時間戳，0 秒代表什麼時候？', ans: '1904-01-01 00:00 UTC', wrong: ['1970-01-01 00:00 UTC', '電腦開機的那一刻', 'LabVIEW 啟動的那一刻', '今天 00:00'], ex: 'LabVIEW 的時間戳從 1904 年起算（UTC）。電腦開機起算的是 Tick Count 那一類計數。' };
    },
    function () {
      var w = p1([['紀錄檔每一列的「時間」欄', '時間戳（Get Date/Time In Seconds＋Format Date/Time String）'], ['X 軸移動花了幾毫秒', 'Tick Count 相減']]);
      return { q: '「' + w[0] + '」應該用哪一種？', ans: w[1], wrong: [w[1].indexOf('Tick') === 0 ? '時間戳（Get Date/Time In Seconds＋Format Date/Time String）' : 'Tick Count 相減', '迴圈圈數 × Wait 毫秒數', 'Tick Count 直接寫進檔案', '兩個時間戳轉成 I32 相減'], ex: 'Tick Count 量間隔，時間戳記錄是「幾點幾分」。Tick Count 本身不代表任何時刻；時間戳碰到校時會跳。' };
    },
    function () {
      return { q: '量一個動作的耗時，量到一半電腦自動校時，時鐘往回撥了 5 秒。哪一種量法不受影響？', ans: 'Tick Count 相減', wrong: ['兩個時間戳相減', 'Format Date/Time String 的 %S 相減', '兩種都會受影響', '兩種都不受影響'], ex: '時間戳跟著電腦時鐘走，往回撥就可能得到負的耗時；Tick Count 只是一直往上數，跟時鐘無關。' };
    },
    function () {
      var Y = r(2025, 2027), M = r(1, 12), D = r(1, 28);
      function p(n) { return (n < 10 ? '0' : '') + n; }
      return { q: '每天一個紀錄檔，檔名用 <code>%Y%m%d</code> 再加上 .csv。' + Y + ' 年 ' + M + ' 月 ' + D + ' 日的檔名是？', ans: '' + Y + p(M) + p(D) + '.csv', wrong: ['' + Y + M + D + '.csv', '' + Y + p(D) + p(M) + '.csv', String(Y).slice(2) + p(M) + p(D) + '.csv', Y + '-' + p(M) + '-' + p(D) + '.csv'], ex: '格式碼中間沒有符號就直接相連；月、日都補成 2 位，檔名按字母排序剛好就是日期順序。' };
    }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) T.quiz = window.LabQuiz('tquiz', gen);
  T.quizGen = gen; T.quizKinds = KIND;
})();
