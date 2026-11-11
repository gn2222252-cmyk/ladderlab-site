/* 交握實驗室：D106 命令脈衝、13_PLC 檢測交握（b0／D510／D511）、D240 心跳與逾時、猜一猜
   位址與 PLC 行為：雙龍門照第 13、17、19 課與 engine/GANTRY_8Y_source.il；檢測交握照第六部分 A5。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* 每個分頁一個控制物件：gen 每次「重來」加 1，舊的 setTimeout 回呼看到 gen 不同就什麼都不做 */
  function Tab(name) { return { name: name, gen: 0, timer: null, resume: false, s: null }; }
  function later(T, fn, ms) { var g = T.gen; setTimeout(function () { if (T.gen === g) fn(); }, ms); }
  function logTo(id, T, s, tl) { var l = $(id); l.insertBefore(el('div', '', '<span class="kv">' + tl + '</span> ' + s), l.firstChild); while (l.children.length > 300) l.removeChild(l.lastChild); }

  /* 封包從一條泳道飛到另一條（host 是 position:relative 的 .lanes） */
  function fly(T, host, from, to, html, delay, dur) {
    if (reduce || !host || !from || !to) return;
    dur = dur || 420;
    later(T, function () {
      if (host.offsetParent === null || document.hidden) return;
      var hb = host.getBoundingClientRect(), fb = from.getBoundingClientRect(), tb = to.getBoundingClientRect();
      if (!fb.width || !tb.width) return;
      var w = document.createElement('div'); w.innerHTML = html;
      var e = w.firstChild; if (!e || e.nodeType !== 1) return;
      e.classList.add('mfly'); host.appendChild(e);
      var ew = e.offsetWidth, eh = e.offsetHeight, maxX = Math.max(0, hb.width - ew);
      var cx = function (b) { return Math.min(maxX, Math.max(0, b.left - hb.left + b.width / 2 - ew / 2)); };
      var cy = function (b) { return b.top - hb.top + Math.min(b.height / 2, 60) - eh / 2; };
      e.style.left = cx(fb) + 'px'; e.style.top = cy(fb) + 'px';
      e.getBoundingClientRect();
      e.style.transition = 'left ' + dur + 'ms ease-in-out, top ' + dur + 'ms ease-in-out';
      e.style.left = cx(tb) + 'px'; e.style.top = cy(tb) + 'px';
      setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, dur + 80);
    }, delay || 0);
  }

  /* ---------- 時序圖：rows = [{g:'群組標題'} 或 {name, key, kind:'bit'|'num'|'ramp'|'mark', c, max, fmt}] ---------- */
  function chart(box, rows, hist, tl) {
    var W = Math.floor(box.clientWidth - 8);
    if (W < 200) return;
    var L = W < 480 ? 92 : 124, n = Math.max(20, Math.min(110, Math.floor((W - L - 8) / 5)));
    var data = hist.slice(-n), dx = (W - L - 8) / Math.max(1, n - 1), rh = 24, gh = 18, y = 2, s = '';
    var X = function (i) { return L + i * dx; };
    rows.forEach(function (r) {
      if (r.g) { s += '<rect x="0" y="' + y + '" width="' + W + '" height="' + gh + '" fill="' + r.c + '" opacity=".12"/><text class="gh" x="4" y="' + (y + 13) + '" style="fill:' + r.c + '">' + r.g + '</text>'; y += gh + 2; return; }
      var c = r.c, top = y + 4, bot = y + rh - 4;
      s += '<text x="4" y="' + (y + rh / 2 + 4) + '">' + r.name + '</text><line x1="' + L + '" y1="' + (y + rh) + '" x2="' + W + '" y2="' + (y + rh) + '" stroke="currentColor" opacity=".12"/>';
      if (!data.length) { y += rh; return; }
      if (r.kind === 'bit' || r.kind === 'ramp') {
        var pts = [], area = [];
        data.forEach(function (d, i) {
          var v = r.kind === 'bit' ? (d[r.key] ? 1 : 0) : Math.min(1, (d[r.key] || 0) / r.max);
          var yy = bot - v * (bot - top);
          if (r.kind === 'bit' && i > 0) pts.push(X(i) + ',' + pts[pts.length - 1].split(',')[1]);
          pts.push(X(i) + ',' + yy);
        });
        var last = pts[pts.length - 1].split(',')[1];
        pts.push((X(data.length - 1) + dx) + ',' + last);
        area = pts.slice(); area.push((X(data.length - 1) + dx) + ',' + bot, X(0) + ',' + bot);
        s += '<polygon points="' + area.join(' ') + '" fill="' + c + '" opacity=".14"/><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + c + '" stroke-width="2"/>';
        if (r.kind === 'ramp') s += '<line x1="' + L + '" y1="' + top + '" x2="' + W + '" y2="' + top + '" stroke="' + c + '" stroke-dasharray="3 3" opacity=".6"/>';
      } else if (r.kind === 'num') {
        var i0 = 0;
        for (var i = 1; i <= data.length; i++) {
          if (i === data.length || data[i][r.key] !== data[i0][r.key]) {
            var v0 = data[i0][r.key], x0 = X(i0), x1 = i === data.length ? X(i - 1) + dx : X(i), zero = !v0;
            s += '<rect x="' + x0 + '" y="' + top + '" width="' + Math.max(0.5, x1 - x0) + '" height="' + (bot - top) + '" fill="' + c + '" opacity="' + (zero ? '.05' : '.2') + '" stroke="' + c + '" stroke-opacity=".7"/>';
            var txt = r.fmt ? r.fmt(v0) : String(v0);
            if (x1 - x0 >= txt.length * 6.6 + 4) s += '<text x="' + (x0 + 3) + '" y="' + (bot - 4) + '">' + esc(txt) + '</text>';
            i0 = i;
          }
        }
      } else {
        var lastX = -99;
        data.forEach(function (d, i) {
          var m = d[r.key]; if (!m) return;
          s += '<line x1="' + X(i) + '" y1="' + top + '" x2="' + X(i) + '" y2="' + bot + '" stroke="' + c + '" stroke-width="2"/>';
          if (X(i) - lastX > 26) { s += '<text x="' + (X(i) + 2) + '" y="' + (top + 9) + '" style="fill:' + c + '">' + esc(m) + '</text>'; lastX = X(i) + esc(m).length * 6.6; }
        });
      }
      y += rh;
    });
    if (data.length) {
      data.forEach(function (d, i) { if (d.t % 10 === 0) s += '<line x1="' + X(i) + '" y1="2" x2="' + X(i) + '" y2="' + y + '" stroke="currentColor" opacity=".08"/><text x="' + (X(i) + 2) + '" y="' + (y + 12) + '" opacity=".7">' + tl(d.t) + '</text>'; });
    }
    y += 16;
    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + y + '" width="' + W + '" height="' + y + '" role="img" aria-label="時序圖">' + s + '</svg>';
  }
  /* 圖表顏色跟著深淺模式（lab.css 的 --lab-orange、--lab-blue） */
  function cssv(n, d) { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d; } catch (e) { return d; } }
  var CP = cssv('--lab-orange', '#b45309'), CL = cssv('--lab-blue', '#1f6feb');

  var tabs = $('tabs'), cur = 'cmd';

  /* ======================================================================
     1. D106 命令脈衝（雙龍門）
     ====================================================================== */
  var TC = Tab('cmd');
  var CNAME = { 1: 'Start', 2: 'Stop', 4: 'Home', 8: 'Reset', 16: 'Clear' };
  var CMB = { 1: 'M100', 2: 'M101', 4: 'M102', 8: 'M103', 16: 'M104' };
  function bits(v, map) { return [1, 2, 4, 8, 16].filter(function (b) { return v & b; }).map(function (b) { return map[b]; }).join('+'); }
  function cname(v) { return bits(v, CNAME) || '0'; }
  function clog(s) { logTo('clog', TC, s, '#' + TC.s.t); }
  function cNew() {
    if (TC.timer) { clearInterval(TC.timer); TC.timer = null; }
    TC.resume = false; TC.gen++;
    TC.s = { t: 0, run: true, d106: 0, scan: 0, mbits: 0, d202: 0, homeT: 0, s0: true, homed: false, auto: true,
      running: false, stopReq: false, runT: 0, q: [], pend: null, next: 1, lvD202: 0, lvErr: '', wr: '', rd: '', m: '',
      sent: 0, taken: 0, lost: [], to: 0, noeff: 0, ok: 0, hist: [] };
    $('clog').innerHTML = ''; $('cstop').classList.remove('on'); $('cstop').textContent = 'PLC 切到 STOP';
    clog('LabVIEW 開始：UI 迴圈把按鈕變成 D106 的值放進佇列，通訊迴圈每 2 格一圈：有命令就寫，沒命令就讀 D200～D202。');
    cSample(); cDraw();
  }
  function cPress(v) {
    var s = TC.s; s.q.push(v);
    clog('UI 迴圈：' + cname(v) + ' 按下 → Enqueue D106 = ' + v);
    cDraw();
  }
  function cScan() {
    var s = TC.s; s.scan++; s.mbits = 0;
    if (s.d106 > 0) {
      var v = s.d106; s.d106 = 0; s.mbits = v; s.taken++; s.m = bits(v, CMB);
      clog('PLC 掃描：D106 = ' + v + ' &gt; 0 → MOV D106 K2M100（' + s.m + ' ON）→ <b>MOV K0 D106</b>。M 取一掃描脈衝後 RST');
      if (v & 4) {
        if (s.s0 && s.d202 === 0) { s.s0 = false; s.d202 = 10; s.homeT = 0; clog('　M102 → M9 → M14 成立（在 S0、沒有異常）→ 原點復歸開始，D202 = 10'); }
        else { s.noeff++; clog('　M102 → M9 有脈衝，可是<b>不在 S0</b> → M14 不成立，原點不會開始。D106 照樣被清 0'); }
      }
      if (v & 1) {
        var why = []; if (!s.auto) why.push('不是自動模式'); if (!s.homed) why.push('還沒原點（M20）'); if (!s.s0) why.push('不在 S0');
        if (!why.length) { s.running = true; s.s0 = false; s.runT = 0; clog('　M100 → M6 → M16 成立 → 自動開始，離開 S0（這裡不模擬自動流程）'); }
        else { s.noeff++; clog('　M100 → M6 有脈衝，可是' + why.join('、') + ' → M16 不成立，<b>不會啟動</b>。D106 照樣被清 0'); }
      }
      if (v & 2) { if (s.running) { s.stopReq = true; clog('　M101 → M7 → 循環停止：做完這一趟才停'); } else clog('　M101 → M7：沒在自動運轉，Stop 沒事做'); }
      if (v & 8) {
        if (!s.homed && s.s0 && s.d202 === 0) { s.s0 = false; s.d202 = 10; s.homeT = 0; clog('　M103 → M8：沒有異常；而且<b>還沒原點（M20 OFF）</b> → M14 = M8・M20 不成立的那一支成立 → 原點復歸開始，D202 = 10（PLC 程式 P2：M14 = M8 且未原點，或 M9）'); }
        else clog('　M103 → M8：異常復歸（現在沒有異常）' + (s.homed ? '；已經原點（M20 ON），所以不會再啟動原點復歸' : ''));
      }
      if (v & 16) clog('　M104：計數清除');
    }
    if (s.d202 > 0 && ++s.homeT >= 3) {
      s.homeT = 0;
      if (s.d202 < 13) s.d202++; else { s.d202 = 0; s.homed = true; s.s0 = true; clog('PLC：原點復歸完成，D202 回到 0，回 S0（M20 已原點）'); }
    }
    if (s.running && ++s.runT >= 8 && s.stopReq) { s.running = false; s.stopReq = false; s.s0 = true; clog('PLC：這一趟做完，回到 S0 待機'); }
  }
  function cComm() {
    var s = TC.s, conf = $('cmode').value === 'confirm', limit = +$('climit').value;
    var host = $('clanes');
    if (conf && s.pend) {
      var v = s.d106;
      fly(TC, host, $('cplc'), $('clv'), '<span class="pk rd">D106 → ' + v + '<small>讀回</small></span>');
      if (v === 0) { s.rd = '讀回0✓'; s.ok++; clog('LabVIEW：讀回 D106 = 0 → PLC 已經拿走 ' + cname(s.pend.v) + '（寫完後 ' + (s.t - s.pend.at) + ' 格）。可以寫下一筆'); s.pend = null; }
      else if (s.t - s.pend.at >= limit) { s.rd = '逾時✗'; s.to++; s.lvErr = '讀回逾時：D106 一直是 ' + v; clog('LabVIEW：讀回 D106 還是 ' + v + '，已經等了 ' + (s.t - s.pend.at) + ' 格 → <b>逾時</b>。PLC 沒把命令拿走（STOP？程式沒在掃描？）'); s.pend = null; }
      else s.rd = '讀回' + v;
      return;
    }
    if (s.q.length) {
      var w = s.q.shift();
      if (s.d106 !== 0) { s.lost.push({ old: s.d106, by: w }); clog('✖ LabVIEW 寫 D106 = ' + w + ' 時，D106 還是 ' + s.d106 + '（PLC 還沒拿走）→ <b>' + cname(s.d106) + ' 被蓋掉了</b>'); }
      s.d106 = w; s.sent++; s.wr = 'W' + w;
      fly(TC, host, $('clv'), $('cplc'), '<span class="pk">FX_WriteD<small>D106 = ' + w + '</small></span>');
      fly(TC, host, $('cplc'), $('clv'), '<span class="pk rd">ACK<small>06h</small></span>', 430);
      clog('LabVIEW：FX_WriteD(106, ' + w + ') → PLC 回 <b>ACK</b>（封包收到、值寫進去了）' + (conf ? '。接著每圈讀回 D106' : ''));
      if (conf) s.pend = { v: w, at: s.t };
    } else { s.lvD202 = s.d202; }
  }
  function cTick() {
    var s = TC.s; s.t++; s.wr = s.rd = s.m = ''; s.mbits = 0;
    if (s.run && s.t % (+$('cscan').value) === 0) cScan();
    if (s.t >= s.next) { s.next = s.t + 2; cComm(); }
    cSample(); cDraw();
  }
  function cSample() { var s = TC.s; s.hist.push({ t: s.t, d106: s.d106, m: s.m, d202: s.d202, run: s.run ? 1 : 0, wr: s.wr, rd: s.rd, pend: s.pend ? 1 : 0 }); if (s.hist.length > 400) s.hist.shift(); }
  var CROWS = [
    { g: 'PLC（D／M）', c: CP },
    { name: 'D106', key: 'd106', kind: 'num', c: CP },
    { name: 'M100～M104', key: 'm', kind: 'mark', c: CP },
    { name: 'D202 原點', key: 'd202', kind: 'num', c: CP },
    { name: 'RUN', key: 'run', kind: 'bit', c: CP },
    { g: 'LabVIEW 通訊迴圈', c: CL },
    { name: '寫 D106', key: 'wr', kind: 'mark', c: CL },
    { name: '讀回 D106', key: 'rd', kind: 'mark', c: CL },
    { name: '等待確認', key: 'pend', kind: 'bit', c: CL }
  ];
  function cDraw() {
    var s = TC.s, conf = $('cmode').value === 'confirm', run = !!TC.timer;
    var h = '<h4>LabVIEW <small>UI 迴圈 → 佇列 → 通訊迴圈</small></h4>';
    h += '<div class="kv">佇列：</div><div class="pks">' + (s.q.length ? s.q.map(function (v) { return '<span class="pk">D106=' + v + '<small>' + cname(v) + '</small></span>'; }).join('') : '<span class="empty">（空的）</span>') + '</div>';
    h += '<div class="kv" style="margin-top:6px">' + (s.pend ? '等 PLC 拿走 D106 = ' + s.pend.v + '（已等 ' + (s.t - s.pend.at) + ' 格）' : conf ? '沒有在等確認' : '課文做法：收到 ACK 就算寫好') + '<br>讀到的 D202 = ' + s.lvD202 + '<br>寫了 ' + s.sent + ' 筆' + (conf ? '　確認 ' + s.ok + ' 筆　逾時 ' + s.to + ' 次' : '') + '</div>';
    if (s.lvErr) h += '<div class="kv" style="color:var(--lab-red)">' + esc(s.lvErr) + '</div>';
    $('clv').innerHTML = h;
    h = '<h4>PLC <small>' + (s.run ? 'RUN：' + ($('cscan').value === '1' ? '每格掃描一次' : '每 5 格掃描一次') : 'STOP：程式不掃描') + '</small></h4><div class="hregs">';
    h += '<span class="reg ' + (s.d106 ? 'hot' : '') + '">' + s.d106 + '<small>D106</small></span><span class="reg ' + (s.d202 ? 'ok' : '') + '">' + s.d202 + '<small>D202 原點步序</small></span></div><div class="hlamps">';
    [1, 2, 4, 8, 16].forEach(function (b) { h += '<span><span class="led ' + (s.mbits & b ? 'on' : '') + '"></span>' + CMB[b] + ' ' + CNAME[b] + '</span>'; });
    h += '</div><div class="hlamps"><span><span class="led ' + (s.s0 ? 'on' : '') + '"></span>S0 待機</span><span><span class="led ' + (s.homed ? 'on' : '') + '"></span>M20 已原點</span><span><span class="led ' + (s.auto ? 'on' : '') + '"></span>X10 自動</span><span><span class="led ' + (s.running ? 'warn' : '') + '"></span>自動運轉</span></div>';
    h += '<div class="kv">PLC 拿走 ' + s.taken + ' 次　拿走了但沒生效 ' + s.noeff + ' 次</div>';
    $('cplc').innerHTML = h; $('cplc').className = 'lane plc' + (s.run ? '' : ' dead');
    $('cs0').checked = s.s0; $('chomed').checked = s.homed; $('cauto').checked = s.auto;
    $('ct').textContent = s.t; $('crun').textContent = run ? '⏸ 暫停' : '▶ 開始';
    chart($('cchart'), CROWS, s.hist, function (t) { return '#' + t; });
    if (s.lost.length) say('csay', '✖ 被蓋掉 ' + s.lost.length + ' 筆：' + s.lost.map(function (x) { return cname(x.old) + '（被 ' + cname(x.by) + ' 蓋掉）'; }).join('、') + '。D106 只有一格，上一筆還沒被 PLC 拿走就寫下一筆，前一筆就沒了。改用「讀回等 0」就不會。', 'bad');
    else if (s.to) say('csay', '✖ 讀回逾時 ' + s.to + ' 次：PLC 一直沒把 D106 清 0。ACK 只代表封包收到，不代表程式有在跑。', 'bad');
    else if (s.noeff) say('csay', 'PLC 拿走了命令（D106 已清 0），可是條件不成立，什麼都沒做 ' + s.noeff + ' 次。D106 = 0 只代表「收到」，要不要動是 PLC 程式決定的，看 D202、步序才知道有沒有生效。');
    else if (s.sent) say('csay', '✔ 寫了 ' + s.sent + ' 筆，PLC 都拿走了。', 'ok');
    else say('csay', '');
  }
  function cStart() { if (!TC.timer) { TC.timer = setInterval(cTick, 450); cDraw(); } }
  function cStopT() { if (TC.timer) { clearInterval(TC.timer); TC.timer = null; cDraw(); } }
  Array.prototype.forEach.call($('cbtns').querySelectorAll('[data-v]'), function (b) { b.onclick = function () { cPress(+b.dataset.v); }; });
  $('cburst').onclick = function () { cPress(1); cPress(4); };
  $('crun').onclick = function () { if (TC.timer) cStopT(); else cStart(); };
  $('cstep').onclick = cTick; $('creset').onclick = cNew;
  $('cstop').onclick = function () { var s = TC.s; s.run = !s.run; $('cstop').classList.toggle('on', !s.run); $('cstop').textContent = s.run ? 'PLC 切到 STOP' : 'PLC 切回 RUN'; clog('PLC 切到 ' + (s.run ? 'RUN' : 'STOP（程式不掃描，D 暫存器還是讀寫得到）')); cDraw(); };
  $('cs0').onchange = function () { TC.s.s0 = $('cs0').checked; cDraw(); };
  $('chomed').onchange = function () { TC.s.homed = $('chomed').checked; cDraw(); };
  $('cauto').onchange = function () { TC.s.auto = $('cauto').checked; cDraw(); };
  $('cmode').onchange = $('cscan').onchange = function () { cDraw(); };
  cNew();

  /* ======================================================================
     2. 檢測交握（13_PLC：D302.b0、D306、D510、D511）
     ====================================================================== */
  var TI = Tab('insp');
  var STEPN = { 40: 'RequestPart', 50: 'ToStopper', 60: 'Clamp', 70: 'Inspect', 80: 'Release', 90: 'ToSort', 100: 'PushNG', 110: 'ToExit', 120: 'Done', 910: 'AlarmWait' };
  function ilog(s) { logTo('ilog', TI, s, (TI.s.t / 10).toFixed(1) + 's'); }
  function iNew() {
    if (TI.timer) { clearInterval(TI.timer); TI.timer = null; }
    TI.resume = false; TI.gen++;
    TI.s = { t: 0, P: { step: 50, stepT: 0, b0: 0, pid: 1000, d510: 0, d511: 0, alarm: '', inT: 0, res: 0 },
      wq: [], nt: null, seq: 0, stall: 0, armStall: false, cam: false,
      ins: { busy: 0, pid: 0, prev: 0, seen: 0, waitT: 0 }, count: {}, dup: [], writes: 0, w511: 0, hist: [], wm: '', im: '' };
    $('ilog').innerHTML = ''; $('icam').classList.remove('on'); $('istall').disabled = false;
    ilog('PLC 往步序 70 走。通訊迴圈每 100 ms：讀 PLC → Flush 寫入佇列寫進去 → Send Notification。');
    iSample(); iDraw();
  }
  function iReact() {
    var P = TI.s.P;
    if (P.step === 70 && P.d511 === 1) {
      var r = P.d510;
      if (r < 1 || r > 3) { P.step = 910; P.alarm = '9007 結果碼不對'; P.b0 = 0; ilog('PLC：D511 = 1，可是 D510 = ' + r + '（不是 1/2/3）→ 警報 9007'); return; }
      P.res = r; P.b0 = 0; P.step = 80; P.stepT = 0; ilog('PLC：③ 看到 D511 = 1，讀 D510 = ' + r + '，<b>b0 = 0</b> → 步序 80');
    }
  }
  function iScan() {
    var P = TI.s.P, st = P.step; P.stepT++;
    if (st === 910) return;
    if ((st === 40 || st === 50 || st === 60) && P.stepT >= 6) {
      P.step = st + 10; P.stepT = 0;
      if (P.step === 70) {
        if (P.d511 !== 0) { P.step = 60; P.stepT = 0; ilog('PLC：⑤ D511 還不是 0，先不進 70'); return; }
        P.pid++; P.b0 = 1; P.inT = 0; ilog('PLC：① 步序 70，D306 = ' + P.pid + '，<b>b0 = 1</b>（請求檢測）');
      }
    } else if (st === 70) {
      if (++P.inT >= 50) { P.step = 910; P.alarm = '9005 檢測逾時'; P.b0 = 0; ilog('PLC：等 D511 等太久 → <b>警報 9005 檢測逾時</b>（課文 A5 的練習約 5 秒）'); }
    } else if (st === 80 && P.stepT >= 4) { P.step = 90; P.stepT = 0; }
    else if (st === 90 && P.stepT >= 4) { P.step = P.res === 1 ? 110 : 100; P.stepT = 0; }
    else if ((st === 100 || st === 110) && P.stepT >= 5) { P.step = 120; P.stepT = 0; }
    else if (st === 120 && P.stepT >= 3 && P.d511 === 0) { P.step = 40; P.stepT = 0; }
  }
  function iComm() {
    var s = TI.s, P = s.P;
    if (s.stall > 0) { s.stall--; return; }
    var w = { b0: P.b0, step: P.step, pid: P.pid };
    var items = s.wq.splice(0, s.wq.length);
    items.forEach(function (it, k) {
      P['d' + it.a] = it.v; s.writes++; if (it.a === 511 && it.v === 0) s.w511++;
      fly(TI, $('ilanes'), $('ilv'), $('iplc'), '<span class="pk">D' + it.a + '=' + it.v + '</span>', k * 90);
      iReact();
    });
    if (items.length) { s.wm = items.map(function (it) { return it.a + '=' + it.v; }).join(','); ilog('通訊迴圈：Flush → 寫 ' + items.map(function (it) { return 'D' + it.a + '=' + it.v; }).join('、')); }
    s.nt = { w: w, seq: ++s.seq };
  }
  function iEnq(a, v) { TI.s.wq.push({ a: a, v: v }); }
  function iStartInspect(pid, why) {
    var s = TI.s, n = s.ins;
    n.busy = 14; n.pid = pid; s.count[pid] = (s.count[pid] || 0) + 1;
    if (s.count[pid] > 1) { s.dup.push(pid); ilog('檢測迴圈：' + why + ' → 又檢測 ID ' + pid + '，<b>這是第 ' + s.count[pid] + ' 次</b>（同一顆！）'); }
    else ilog('檢測迴圈：' + why + ' → ② 取像、檢測 ID ' + pid + '（約 1.4 秒）');
  }
  function iDone() {
    var s = TI.s, n = s.ins;
    n.seen = s.seq;   // ignore previous = True
    if (s.cam) { s.im = '✖出錯'; ilog('檢測迴圈：<b>相機斷線</b>，檢測出錯 → 錯誤線讓 Enqueue 都不執行，不寫 D510、D511'); return; }
    var r = Math.random() < 0.8 ? 1 : 2;
    iEnq(510, r); iEnq(511, 1); s.im = '完成';
    ilog('檢測迴圈：ID ' + n.pid + ' → ' + (r === 1 ? 'OK' : 'NG') + '，Enqueue D510 = ' + r + '，再 Enqueue D511 = 1（錯誤線串著，順序固定）');
    if (s.armStall) { s.armStall = false; s.stall = 7; $('istall').disabled = false; ilog('通訊迴圈<b>卡住 0.7 秒</b>（例如 PLC 回覆慢），寫入佇列裡的結果還沒送出去'); }
  }
  function iIns() {
    var s = TI.s, n = s.ins;
    if (n.busy > 0) { n.busy--; if (n.busy === 0) iDone(); return; }
    var got, to = false;
    if (s.seq > n.seen) { got = s.nt.w; n.seen = s.seq; n.waitT = 0; }
    else { if (++n.waitT < 5) return; n.waitT = 0; to = true; got = { b0: 0, step: 0, pid: 0 }; }
    if ($('imode').value === 'edge') {
      if (to && !$('ito').checked) { s.im = '逾時:保留'; ilog('檢測迴圈：Wait on Notification 逾時 → Host_Edge 保留上一圈的值（Next = Prev），不判斷邊緣'); return; }
      if (to) { s.im = '逾時→0'; ilog('檢測迴圈：Wait on Notification 逾時，輸出全 0，<b>被當成 b0 = 0</b>'); }
      var b0 = got.b0;
      if (b0 && !n.prev) { s.im = '▲上升'; iStartInspect(got.pid, 'b0 上升緣'); }
      else if (!b0 && n.prev) { s.im = to ? '▼假下降' : '▼下降'; iEnq(511, 0); ilog('檢測迴圈：b0 下降緣' + (to ? '（其實是逾時的假資料）' : '（④ PLC 收到了）') + ' → Enqueue D511 = 0'); }
      n.prev = b0;
    } else {
      if (to) s.im = '逾時→0';
      if (got.b0) { s.im = '●b0=1'; iStartInspect(got.pid, '這一圈 b0 = 1'); }
      else { iEnq(511, 0); if (!s.im) s.im = 'D511=0'; }
      n.prev = got.b0;
    }
  }
  function iTick() {
    var s = TI.s; s.t++; s.wm = ''; s.im = '';
    iScan(); iComm(); iIns();
    iSample(); iDraw();
  }
  function iSample() { var s = TI.s, P = s.P; s.hist.push({ t: s.t, step: P.step, b0: P.b0, d510: P.d510, d511: P.d511, wm: s.wm, stall: s.stall > 0 ? 1 : 0, im: s.im, busy: s.ins.busy > 0 ? 1 : 0, prev: s.ins.prev }); if (s.hist.length > 400) s.hist.shift(); }
  var IROWS = [
    { g: 'PLC（D）', c: CP },
    { name: '步序 D300', key: 'step', kind: 'num', c: CP },
    { name: 'D302.b0 請求', key: 'b0', kind: 'bit', c: CP },
    { name: 'D510 結果', key: 'd510', kind: 'num', c: CP },
    { name: 'D511 完成', key: 'd511', kind: 'bit', c: CP },
    { g: 'LabVIEW（通訊迴圈、檢測迴圈）', c: CL },
    { name: '寫入 PLC', key: 'wm', kind: 'mark', c: CL },
    { name: '通訊卡住', key: 'stall', kind: 'bit', c: '#dc2626' },
    { name: '上一圈 b0', key: 'prev', kind: 'bit', c: CL },
    { name: '邊緣判斷', key: 'im', kind: 'mark', c: CL },
    { name: '檢測中', key: 'busy', kind: 'bit', c: '#7c3aed' }
  ];
  function iDraw() {
    var s = TI.s, P = s.P, n = s.ins, run = !!TI.timer;
    var h = '<h4>LabVIEW <small>通訊迴圈 100 ms、檢測迴圈等通知</small></h4>';
    h += '<div class="kv">通訊迴圈：' + (s.stall > 0 ? '<b style="color:var(--lab-red)">卡住中</b>（還要 ' + (s.stall / 10).toFixed(1) + ' 秒）' : '正常') + '　Notifier #' + s.seq + (s.nt ? '（b0 = ' + s.nt.w.b0 + '）' : '') + '</div>';
    h += '<div class="kv">寫入佇列：</div><div class="pks">' + (s.wq.length ? s.wq.map(function (it) { return '<span class="pk">D' + it.a + '=' + it.v + '</span>'; }).join('') : '<span class="empty">（空的）</span>') + '</div>';
    h += '<div class="kv" style="margin-top:6px">檢測迴圈：' + (n.busy > 0 ? '<b>檢測中</b> ID ' + n.pid + '，還要 ' + (n.busy / 10).toFixed(1) + ' 秒' : '等通知（timeout 500 ms）') + '<br>上一圈 b0（Shift Register）= ' + n.prev + '<br>寫了 ' + s.writes + ' 筆，其中 D511=0 ' + s.w511 + ' 筆</div>';
    $('ilv').innerHTML = h;
    h = '<h4>PLC <small>13_PLC 梯形圖</small></h4><div class="hregs">';
    h += '<span class="reg ' + (P.step === 70 ? 'hot' : P.step === 910 ? 'bad' : '') + '">' + P.step + '<small>D300 ' + (STEPN[P.step] || '') + '</small></span>';
    h += '<span class="reg ' + (P.b0 ? 'hot' : '') + '">' + P.b0 + '<small>D302.b0</small></span><span class="reg">' + P.pid + '<small>D306 ID</small></span>';
    h += '<span class="reg ' + (P.d510 ? 'ok' : '') + '">' + P.d510 + '<small>D510</small></span><span class="reg ' + (P.d511 ? 'ok' : '') + '">' + P.d511 + '<small>D511</small></span></div>';
    h += '<div class="kv">' + (P.alarm ? '<b style="color:var(--lab-red)">警報 ' + esc(P.alarm) + '</b>' : P.step === 70 ? '等 D511 = 1（已等 ' + (P.inT / 10).toFixed(1) + ' 秒）' : '—') + '</div>';
    var ids = Object.keys(s.count);
    h += '<div class="kv">檢測次數：' + (ids.length ? ids.slice(-4).map(function (k) { return k + '×' + s.count[k]; }).join('　') : '—') + '</div>';
    $('iplc').innerHTML = h; $('iplc').className = 'lane plc' + (P.step === 910 ? ' dead' : '');
    $('it').textContent = (s.t / 10).toFixed(1); $('irun').textContent = run ? '⏸ 暫停' : '▶ 開始';
    chart($('ichart'), IROWS, s.hist, function (t) { return (t / 10) + 's'; });
    if (P.alarm) say('isay', '✖ PLC 警報 ' + esc(P.alarm) + '。' + (s.cam ? '相機斷線時檢測迴圈不寫結果，PLC 等不到 D511 = 1 就逾時。' : ''), 'bad');
    else if (s.dup.length) say('isay', '✖ 同一顆零件被檢測了不只一次：ID ' + s.dup.filter(function (x, i, a) { return a.indexOf(x) === i; }).join('、') + '。' + ($('imode').value === 'level' ? '位準判斷：檢測完時通知裡的 b0 還是 1。' : '逾時被當成 b0 = 0，產生假的下降緣和新的上升緣。'), 'bad');
    else if ($('imode').value === 'level' && s.w511 > 6) say('isay', '位準判斷：b0 = 0 的每一圈都寫一次 D511 = 0，已經寫了 ' + s.w511 + ' 筆。', 'bad');
    else if (ids.length) say('isay', '✔ 每顆零件只檢測一次（' + ids.length + ' 顆）。看時序圖：b0 ↑ → 檢測 → D511 ↑ → b0 ↓ → D511 ↓。', 'ok');
    else say('isay', '');
  }
  function iSpeed() { return +$('ispeed').value; }
  $('irun').onclick = function () { if (TI.timer) { clearInterval(TI.timer); TI.timer = null; iDraw(); } else { TI.timer = setInterval(iTick, iSpeed()); iDraw(); } };
  $('ispeed').onchange = function () { if (TI.timer) { clearInterval(TI.timer); TI.timer = setInterval(iTick, iSpeed()); } };
  $('istep').onclick = iTick; $('ireset').onclick = iNew;
  $('istall').onclick = function () { TI.s.armStall = true; $('istall').disabled = true; ilog('已設定：下一次檢測完成時，通訊迴圈會卡 0.7 秒'); };
  $('icam').onclick = function () { var s = TI.s; s.cam = !s.cam; $('icam').classList.toggle('on', s.cam); ilog(s.cam ? '相機斷線' : '相機恢復'); iDraw(); };
  $('imode').onchange = $('ito').onchange = iNew;
  iNew();

  /* ======================================================================
     3. 心跳與逾時（雙龍門：D240、T30、D107、異常 40）
     ====================================================================== */
  var TH = Tab('hb');
  function hlog(s) { logTo('hlog', TH, s, (TH.s.t / 10).toFixed(1) + 's'); }
  function hNew() {
    if (TH.timer) { clearInterval(TH.timer); TH.timer = null; }
    TH.resume = false; TH.gen++;
    TH.s = { t: 0, line: true, man: $('hman').checked, jog: false,
      P: { d240: 0, d253: 0, t30: 0, t30on: false, m22p: false, d220: 0, m3: false, d107: 0, d254: 0, m110: false, m5: false },
      L: { alive: true, conn: true, busyUntil: 0, waiting: false, err: false, hb: 0, lastHb: -99, q: [], exiting: false, end: '', flushed: 0, view: null, mark: '' },
      cutAt: null, plcDet: null, lvDet: null, ev: '', hist: [] };
    ['hcut', 'hjog'].forEach(function (k) { $(k).classList.remove('on'); });
    $('hcut').textContent = '拔掉通訊線'; $('hjog').textContent = '按住 L Forward（點動）';
    $('hlog').innerHTML = '';
    hlog('LabVIEW 開始：通訊迴圈約 200 ms 一圈，Tick Count 每過 1000 ms 寫一次 D240。');
    hSample(); hDraw();
  }
  function hEnq(a, v, why) { var L = TH.s.L; if (!L.alive || L.exiting) { hlog('LabVIEW 已經結束，沒有人送 ' + why); return; } L.q.push({ a: a, v: v }); hlog('UI 迴圈：' + why + ' → Enqueue D' + a + ' = ' + v + (TH.s.L.conn ? '' : '（現在斷線，會先堆在佇列裡）')); }
  function hPlc() {
    var s = TH.s, P = s.P;
    if (P.d240 === P.d253 && P.d240 > 0) P.t30 = Math.min(30, P.t30 + 1); else P.t30 = 0;
    var on = P.t30 >= 30;
    if (on && !P.t30on) { if (s.cutAt != null && s.plcDet == null) s.plcDet = s.t; hlog('PLC：D240 已經 3 秒沒變 → <b>T30 ON</b>，判定 HMI 斷線'); }
    var c = on && s.man;
    if (c && !P.m22p) { if (P.d220 === 0) P.d220 = 40; P.m3 = true; hlog('PLC：手動模式下 HMI 斷線 → <b>異常 40</b>（D220 = 40，M3 異常中）'); }
    else if (on && !P.t30on && !s.man) hlog('PLC：自動模式不報 40（PLC 程式：只有手動時 HMI 是唯一操作站）');
    P.m22p = c; P.t30on = on;
    P.m5 = s.man && !P.m3 && !on;
    if (!P.m5) { if (P.d107 || P.m110) hlog('PLC：M5（手動有效）OFF → <b>ZRST M110～M125、D107 = 0</b>，點動停止'); P.d107 = 0; P.d254 = 0; P.m110 = false; }
    else if (P.d107 !== P.d254) { P.m110 = !!(P.d107 & 1); P.d254 = P.d107; }
    P.d253 = P.d240;
  }
  function hWrite(it) {
    var P = TH.s.P;
    fly(TH, $('hlanes'), $('hlv'), $('hplc'), '<span class="pk">D' + it.a + '=' + it.v + '</span>');
    if (it.a === 106) { if (it.v & 8) { if (P.m3) { P.m3 = false; P.d220 = 0; hlog('PLC：收到 D106 = 8 → M103 → M8 → <b>異常復歸</b>，D220 = 0'); } else hlog('PLC：收到 Reset，沒有異常'); } }
    else if (it.a === 107) P.d107 = it.v;
    else if (it.a === 240) P.d240 = it.v;
  }
  function hLv() {
    var s = TH.s, L = s.L, P = s.P;
    if (!L.alive || s.t < L.busyUntil) return;
    if (L.waiting) {
      L.waiting = false;
      if (!s.line) {
        L.err = true; L.conn = false; L.mark = '逾時';
        if (s.cutAt != null && s.lvDet == null) s.lvDet = s.t;
        hlog('LabVIEW：VISA Read 等了 2 秒沒有回應 → <b>逾時錯誤</b>，PLC Connected 熄滅');
        if (L.exiting) { L.alive = false; L.end = 'Exit（D240 = 0 沒寫到）'; hlog('LabVIEW：結束時寫 D240 = 0 失敗（線是斷的），VISA Close，程式結束'); }
        return;
      }
    }
    if (L.err) {
      L.err = false; var n = L.q.length; L.q = []; L.flushed += n; L.mark = '重連';
      hlog('LabVIEW 錯誤頁：Clear Errors → VISA Close → Wait 1000 ms → FX_Open → <b>Flush Queue</b>' + (n ? '（丟掉斷線期間堆的 ' + n + ' 筆命令）' : ''));
      L.busyUntil = s.t + 10; return;
    }
    if (!s.line) { L.waiting = true; L.busyUntil = s.t + 20; return; }
    if (L.exiting) {
      hWrite({ a: 240, v: 0 }); L.alive = false; L.conn = false; L.mark = 'D240=0'; L.end = 'Exit';
      hlog('LabVIEW：Release Queue → 通訊迴圈結束 → <b>FX_WriteD(240, 0)</b> → VISA Close。PLC 知道 HMI 是正常下線');
      return;
    }
    var marks = [];
    L.q.splice(0, L.q.length).forEach(function (it) { hWrite(it); marks.push(it.a + '=' + it.v); });
    if (s.t - L.lastHb >= 10) { L.hb = L.hb >= 32767 ? 1 : L.hb + 1; hWrite({ a: 240, v: L.hb }); L.lastHb = s.t; marks.push('240=' + L.hb); }
    if (!L.conn) hlog('LabVIEW：讀到回應了 → PLC Connected 亮回來');
    L.conn = true; L.view = { d220: P.d220, d107: P.d107 }; L.mark = marks.join(',');
    L.busyUntil = s.t + 2;
  }
  function hTick() { var s = TH.s; s.t++; s.L.mark = ''; hPlc(); hLv(); hSample(); hDraw(); }
  function hSample() { var s = TH.s, P = s.P; s.hist.push({ t: s.t, d240: P.d240, t30: P.t30, t30on: P.t30on ? 1 : 0, d220: P.d220, m110: P.m110 ? 1 : 0, line: s.line ? 1 : 0, conn: s.L.conn && s.L.alive ? 1 : 0, mk: s.L.mark || s.ev }); s.ev = ''; if (s.hist.length > 400) s.hist.shift(); }
  var HROWS = [
    { g: 'PLC（D／T／M）', c: CP },
    { name: 'D240 心跳', key: 'd240', kind: 'num', c: CP },
    { name: 'T30 計時', key: 't30', kind: 'ramp', max: 30, c: CP },
    { name: 'T30 斷線', key: 't30on', kind: 'bit', c: '#dc2626' },
    { name: 'D220 異常', key: 'd220', kind: 'num', c: '#dc2626' },
    { name: 'M110 點動', key: 'm110', kind: 'bit', c: CP },
    { g: 'LabVIEW 通訊迴圈', c: CL },
    { name: '通訊線', key: 'line', kind: 'bit', c: '#6b7280' },
    { name: 'PLC Connected', key: 'conn', kind: 'bit', c: CL },
    { name: '寫入／事件', key: 'mk', kind: 'mark', c: CL }
  ];
  function sec(a, b) { return ((b - a) / 10).toFixed(1) + ' 秒'; }
  function hDraw() {
    var s = TH.s, P = s.P, L = s.L, run = !!TH.timer;
    var h = '<h4>LabVIEW <small>通訊迴圈約 200 ms 一圈</small></h4><div class="hlamps"><span><span class="led ' + (L.alive && L.conn ? 'on' : 'err') + '"></span>PLC Connected</span><span>' + (L.alive ? '程式執行中' : '程式已結束（' + L.end + '）') + '</span></div>';
    h += '<div class="kv">' + (!L.alive ? '—' : L.waiting ? '<b style="color:var(--lab-orange)">VISA Read 等回應中…</b>（逾時 2 秒）' : L.err ? '下一圈進錯誤頁' : s.t < L.busyUntil && L.mark === '重連' ? 'Wait 1000 ms 後重開' : '寫命令 → 心跳 → 讀狀態') + '</div>';
    h += '<div class="kv">心跳計數 ' + L.hb + '　上次寫 D240：' + (L.lastHb < 0 ? '—' : ((s.t - L.lastHb) / 10).toFixed(1) + ' 秒前') + '</div>';
    h += '<div class="kv">佇列：</div><div class="pks">' + (L.q.length ? L.q.map(function (it) { return '<span class="pk">D' + it.a + '=' + it.v + '</span>'; }).join('') : '<span class="empty">（空的）</span>') + '</div>';
    h += '<div class="kv">重連時丟掉的命令：' + L.flushed + ' 筆</div>';
    $('hlv').innerHTML = h; $('hlv').className = 'lane hlv' + (L.alive ? '' : ' dead');
    h = '<h4>PLC <small>' + (s.man ? '手動模式' : '自動模式') + '</small></h4><div class="hregs">';
    h += '<span class="reg">' + P.d240 + '<small>D240</small></span><span class="reg">' + P.d253 + '<small>D253 上次</small></span>';
    h += '<span class="reg ' + (P.t30on ? 'bad' : P.t30 > 10 ? 'hot' : '') + '">' + (P.t30 / 10).toFixed(1) + '<small>T30（3.0 斷線）</small></span>';
    h += '<span class="reg ' + (P.d220 ? 'bad' : '') + '">' + P.d220 + '<small>D220 異常</small></span><span class="reg ' + (P.d107 ? 'hot' : '') + '">' + P.d107 + '<small>D107</small></span></div>';
    h += '<div class="hlamps"><span><span class="led ' + (P.m5 ? 'on' : '') + '"></span>M5 手動有效</span><span><span class="led ' + (P.m110 ? 'warn' : '') + '"></span>M110 點動中（L 軸前進）</span><span><span class="led ' + (P.m3 ? 'err' : '') + '"></span>M3 異常</span></div>';
    h += '<div class="kv">' + (P.d240 === 0 ? 'D240 = 0：沒有 HMI，PLC 不檢查心跳' : 'D240 &gt; 0：每次掃描比對，有變化 T30 就歸零') + '</div>';
    $('hplc').innerHTML = h;
    var w = '<div><b>PLC 這邊</b><br>' + (s.cutAt == null ? '還沒有斷線。' : s.plcDet != null ? '斷線後 <b>' + sec(s.cutAt, s.plcDet) + '</b> 發現（T30 ON）。' : '還沒發現（T30 = ' + (P.t30 / 10).toFixed(1) + ' 秒）。') + '</div>';
    w += '<div><b>LabVIEW 這邊</b><br>' + (s.cutAt == null ? '還沒有斷線。' : L.end === 'Abort' ? '程式被 Abort，沒有人發現。' : s.lvDet != null ? '斷線後 <b>' + sec(s.cutAt, s.lvDet) + '</b> 發現（VISA 逾時）。' : '還沒發現。') + '</div>';
    $('hwho').innerHTML = w;
    $('ht').textContent = (s.t / 10).toFixed(1); $('hrun').textContent = run ? '⏸ 暫停' : '▶ 開始';
    $('hexit').disabled = !L.alive || L.exiting || s.jog; $('habort').disabled = !L.alive;
    $('hjog').disabled = !L.alive;
    chart($('hchart'), HROWS, s.hist, function (t) { return (t / 10) + 's'; });
    if (!L.alive && L.end === 'Abort') say('hsay', 'Abort 砍掉了程式：D240 停在 ' + P.d240 + '，沒有寫 0。' + (P.d220 === 40 ? 'PLC 3 秒沒看到變化，已經報 40、停掉點動。' : s.man ? '手動模式下 3 秒後 PLC 會報 40。' : '自動模式不報 40。'), 'bad');
    else if (P.m110 && !s.line) say('hsay', '線已經斷了，可是 PLC 還沒發現，點動還在走（T30 = ' + (P.t30 / 10).toFixed(1) + ' 秒）。', 'bad');
    else if (P.d220 === 40) say('hsay', '異常 40：PLC 判定 HMI 斷線，點動已經停了。線接回來、PLC Connected 亮了之後，還要按 Reset（D106 = 8）才會清掉。', 'bad');
    else if (!L.alive && L.end === 'Exit') say('hsay', '✔ 正常結束：D240 = 0，PLC 知道 HMI 下線了，不檢查心跳，不報 40。', 'ok');
    else if (s.cutAt != null && s.plcDet != null && s.lvDet != null) say('hsay', '兩邊都發現了：PLC 在 ' + sec(s.cutAt, s.plcDet) + '、LabVIEW 在 ' + sec(s.cutAt, s.lvDet) + '。誰先發現要看拔線的那一刻，D240 剛寫過多久、VISA Read 剛好在等什麼。');
    else say('hsay', '');
  }
  function hSpeed() { return +$('hspeed').value; }
  $('hrun').onclick = function () { if (TH.timer) { clearInterval(TH.timer); TH.timer = null; hDraw(); } else { TH.timer = setInterval(hTick, hSpeed()); hDraw(); } };
  $('hspeed').onchange = function () { if (TH.timer) { clearInterval(TH.timer); TH.timer = setInterval(hTick, hSpeed()); } };
  $('hstep').onclick = hTick; $('hreset').onclick = hNew;
  $('hcut').onclick = function () {
    var s = TH.s; s.line = !s.line; $('hcut').classList.toggle('on', !s.line); $('hcut').textContent = s.line ? '拔掉通訊線' : '接回通訊線';
    if (!s.line) { s.cutAt = s.t; s.plcDet = s.lvDet = null; s.ev = '拔線'; hlog('<b>拔線</b>：D240 停在 ' + s.P.d240 + '（上次寫入是 ' + (s.L.lastHb < 0 ? '—' : ((s.t - s.L.lastHb) / 10).toFixed(1) + ' 秒前') + '）'); }
    else { s.ev = '接回'; hlog('<b>接回通訊線</b>'); }
    hDraw();
  };
  $('hjog').onclick = function () { var s = TH.s; s.jog = !s.jog; $('hjog').classList.toggle('on', s.jog); $('hjog').textContent = s.jog ? '放開 L Forward' : '按住 L Forward（點動）'; hEnq(107, s.jog ? 1 : 0, s.jog ? '按下 L Forward（值變了才送）' : '放開 L Forward'); hDraw(); };
  $('hman').onchange = function () { TH.s.man = $('hman').checked; hlog('PLC 切到' + (TH.s.man ? '手動' : '自動') + '模式'); hDraw(); };
  $('hrst').onclick = function () { hEnq(106, 8, 'Reset'); hDraw(); };
  $('hexit').onclick = function () { var L = TH.s.L; if (!L.alive) return; L.exiting = true; L.q = []; TH.s.ev = 'Exit'; hlog('UI 迴圈：按 Exit → 迴圈結束 → Release Queue'); hDraw(); };
  $('habort').onclick = function () { var s = TH.s, L = s.L; if (!L.alive) return; L.alive = false; L.conn = false; L.end = 'Abort'; s.ev = 'Abort'; s.cutAt = s.t; s.plcDet = s.lvDet = null; hlog('<b>Abort</b>：程式立刻被砍掉，後面的 D240 = 0、VISA Close 都不會執行'); hDraw(); };
  hNew();

  /* ---------- 分頁切換：看不到的分頁暫停計時器 ---------- */
  var ALL = { cmd: [TC, cTick, function () { return 450; }, cDraw], insp: [TI, iTick, iSpeed, iDraw], hb: [TH, hTick, hSpeed, hDraw] };
  function sync() {
    Object.keys(ALL).forEach(function (k) {
      var a = ALL[k], T = a[0], off = cur !== k || document.hidden;
      if (off && T.timer) { clearInterval(T.timer); T.timer = null; T.resume = true; }
      else if (!off && T.resume) { T.resume = false; T.timer = setInterval(a[1], a[2]()); }
      if (!off) a[3]();
    });
  }
  function show(t) {
    cur = t;
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['cmd', 'insp', 'hb', 'quiz'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
    sync();
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  document.addEventListener('visibilitychange', sync);
  var rsz = null;
  window.addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(function () { if (ALL[cur]) ALL[cur][3](); }, 150); });
  if (/^#(cmd|insp|hb|quiz)$/.test(location.hash)) show(location.hash.slice(1));

  function api(T, tick, reset, draw) { return { reset: reset, tick: function (n) { for (var i = 0; i < (n || 1); i++) tick(); return T.s; }, S: function () { return T.s; }, running: function () { return !!T.timer; }, draw: draw }; }
  window.HandshakeLab = {
    show: show, current: function () { return cur; },
    cmd: Object.assign(api(TC, cTick, cNew, cDraw), { press: cPress, setRun: function (v) { if (TC.s.run !== !!v) $('cstop').click(); } }),
    insp: Object.assign(api(TI, iTick, iNew, iDraw), { armStall: function () { $('istall').click(); }, camera: function (bad) { if (TI.s.cam !== !!bad) $('icam').click(); } }),
    hb: Object.assign(api(TH, hTick, hNew, hDraw), { cut: function (v) { if (TH.s.line === !!v) $('hcut').click(); }, jog: function (v) { if (TH.s.jog !== !!v) $('hjog').click(); }, resetAlarm: function () { $('hrst').click(); }, exit: function () { $('hexit').click(); }, abort: function () { $('habort').click(); } })
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function pickN(a, n) { var b = a.slice(), r = []; while (r.length < n && b.length) r.push(b.splice(Math.floor(Math.random() * b.length), 1)[0]); return r; }
  function uniq(ans, list) { var seen = {}, out = []; seen[ans] = 1; list.forEach(function (x) { x = String(x); if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
  var CMD = [['Start', 1], ['Stop', 2], ['Home', 4], ['Reset', 8], ['Clear Counts', 16]];
  function risingCount(seq) { var p = 0, n = 0; seq.forEach(function (b) { if (b && !p) n++; p = b; }); return n; }
  var KIND = [
    // 1. D106 位元
    function () {
      var c = pickN(CMD, p1([1, 2])), v = c.reduce(function (a, x) { return a + x[1]; }, 0), dec = Math.random() < 0.5;
      if (dec) return { q: 'LabVIEW 寫 <b>D106 = ' + v + '</b>，PLC 會把哪些位元搬到 M100～M104？', ans: c.map(function (x) { return x[0]; }).join(' + '), wrong: uniq(c.map(function (x) { return x[0]; }).join(' + '), CMD.filter(function (x) { return x[1] !== v; }).map(function (x) { return x[0]; }).concat(['Start + Stop', 'Home + Reset', 'Stop + Clear Counts'])), ex: 'D106 位元 0～4 = Start、Stop、Home、Reset、Clear Counts（1、2、4、8、16）。' + v + ' = ' + c.map(function (x) { return x[1]; }).join(' + ') + '。' };
      return { q: '想讓 PLC 收到 <b>' + c.map(function (x) { return x[0]; }).join(' 和 ') + '</b>，D106 要寫多少？', ans: String(v), wrong: uniq(String(v), [v + 1, v * 2, c.length, c[0][1] - 1 || 3, 31, v === 5 ? 6 : 5]), ex: '每個命令是一個位元：Start 1、Stop 2、Home 4、Reset 8、Clear Counts 16，加起來 = ' + v + '。' };
    },
    // 2. STOP 時讀回
    function () {
      var v = p1([1, 4, 8]), run = Math.random() < 0.5;
      return { q: 'PLC 在 <b>' + (run ? 'RUN' : 'STOP') + '</b>。LabVIEW 寫 D106 = ' + v + '，收到 ACK，過一會兒再讀 D106，會是多少？', ans: run ? '0' : String(v), wrong: uniq(run ? '0' : String(v), [run ? String(v) : '0', '65535', '讀不到，PLC 回 NAK', String(v * 2)]), ex: run ? 'RUN 時每次掃描執行 MOV K0 D106，一拿走就清 0。' : 'STOP 時程式不掃描，沒有人執行 MOV K0 D106，值就一直留著。ACK 只代表封包收到。' };
    },
    // 3. 拿走了但沒生效
    function () {
      var c = p1([['Home（D106 = 4）', '不在 S0 待機（例如正在自動運轉）'], ['Start（D106 = 1）', '還沒原點（M20 OFF）'], ['Start（D106 = 1）', '模式開關在手動（X10 OFF）']]);
      return { q: 'LabVIEW 寫 ' + c[0] + '，讀回 D106 已經是 0，可是機台沒動。最可能的原因？', ans: 'PLC 拿走了命令，但' + c[1] + '，啟動條件不成立', wrong: ['D106 沒寫進去', 'PLC 回了 NAK', 'LabVIEW 應該再寫一次，第二次才會生效', 'D106 要寫負數'], ex: 'D106 = 0 只代表 PLC 程式掃到、把命令搬到 M10x 了。要不要動，是 PLC 自己的條件決定的（M14、M16）。看 D202、步序、異常碼才知道有沒有生效。' };
    },
    // 4. 寫太快
    function () {
      var a = pickN(CMD.slice(0, 4), 2);
      return { q: 'D106 = ' + a[0][1] + '（' + a[0][0] + '）還沒被 PLC 拿走，LabVIEW 又寫了 D106 = ' + a[1][1] + '（' + a[1][0] + '）。PLC 下一次掃描會做什麼？', ans: '只做 ' + a[1][0] + '，' + a[0][0] + ' 被蓋掉了', wrong: ['兩個都做，先 ' + a[0][0] + ' 再 ' + a[1][0], '兩個都不做', '只做 ' + a[0][0], 'PLC 報通訊錯誤'], ex: 'D106 只是一個暫存器，後寫的值直接蓋掉前面的。要嘛等讀回 0 再寫下一筆，要嘛一次寫兩個位元（' + (a[0][1] + a[1][1]) + '）。' };
    },
    // 5. 五步交握的下一步
    function () {
      var S = ['PLC：步序 70，寫 D306，b0 = 1', 'LabVIEW：看到 b0 上升，檢測，寫 D510 再寫 D511 = 1', 'PLC：看到 D511 = 1，讀 D510，b0 = 0', 'LabVIEW：看到 b0 下降，寫 D511 = 0', 'PLC：下一顆到 70 之前確認 D511 = 0'];
      var i = Math.floor(Math.random() * 4);
      return { q: '13_PLC 的檢測交握，「<b>' + S[i] + '</b>」的下一步是？', ans: S[i + 1], wrong: S.filter(function (x, k) { return k !== i + 1 && k !== i; }).concat(['LabVIEW：寫 D302 = 0']), ex: '請求 ↑ → 完成 ↑ → 請求 ↓ → 完成 ↓，每個訊號都等對方回應才收回。' };
    },
    // 6. 上升緣次數（計算）
    function () {
      var seq = [0], k = 7; while (seq.length < k) seq.push(Math.random() < 0.55 ? 1 : 0);
      if (!seq.some(function (b) { return b; })) seq[3] = 1;
      var r = risingCount(seq), lvl = seq.filter(function (b) { return b; }).length, edge = Math.random() < 0.5;
      return { q: '檢測迴圈依序收到的 b0：<b>' + seq.join('、') + '</b>（每筆都是新通知，檢測瞬間做完）。用' + (edge ? '<b>上升緣</b>（這圈 1、上一圈 0）' : '<b>位準</b>（這圈 b0 = 1 就檢測）') + '，總共檢測幾次？', ans: String(edge ? r : lvl), wrong: uniq(String(edge ? r : lvl), [edge ? lvl : r, (edge ? r : lvl) + 1, Math.max(0, (edge ? r : lvl) - 1), 0, seq.length]), ex: '上升緣只在 0 → 1 那一圈成立，共 ' + r + ' 次；位準是每一個 1 都算，共 ' + lvl + ' 次。b0 = 1 會維持好幾圈，所以檢測要用上升緣。' };
    },
    // 7. Timed Out
    function () {
      var good = Math.random() < 0.5;
      return { q: '檢測迴圈收到：b0 = 1、1、<b>（逾時）</b>、1、0。Host_Edge ' + (good ? '照課文：逾時就保留上一圈的值' : '沒檢查 Timed Out，逾時輸出的全 0 被當成 b0 = 0') + '。這段會判出幾個上升緣？（開始前上一圈 b0 = 0）', ans: good ? '1 個' : '2 個', wrong: good ? ['2 個', '0 個', '3 個', '4 個'] : ['1 個', '0 個', '3 個', '4 個'], ex: good ? '逾時那一圈 Next = Prev（1），所以後面的 1 不算新的上升緣，只有第一個。' : '逾時被當成 0，接下來的 1 又是 0 → 1，多判一個上升緣：同一顆零件檢測兩次。' };
    },
    // 8. D510 和 D511 的順序
    function () {
      return { q: '檢測迴圈如果<b>先</b> Enqueue D511 = 1、<b>後</b> Enqueue D510（結果），可能發生什麼？', ans: 'PLC 看到 D511 = 1 就去讀 D510，讀到的是上一顆的結果', wrong: ['沒差，PLC 會等兩個都到', 'LabVIEW 會自動調換順序', 'PLC 回 NAK', 'D510 會蓋掉 D511'], ex: '佇列先進先出、通訊迴圈依序寫。D511 = 1 是「結果已經準備好」的訊號，所以 D510 一定要先寫。課文用錯誤線把兩個 Enqueue 串起來保證順序。' };
    },
    // 9. 為什麼等 b0 下降才清 D511
    function () {
      return { q: '檢測迴圈為什麼要等到 <b>b0 下降</b>，才把 D511 寫回 0？', ans: 'b0 下降代表 PLC 已經看到 D511 = 1、讀過結果了', wrong: ['寫完 D511 = 1 馬上寫 0 比較快', 'PLC 規定 D511 只能每秒寫一次', '為了讓 D510 保持不變', 'b0 下降代表下一顆已經到了'], ex: '太早清掉，PLC 可能根本沒看到 D511 = 1，就一直等到逾時（9005）。每個訊號都要等對方回應才收回。' };
    },
    // 10. 相機斷線
    function () {
      return { q: '檢測時相機斷線，Do_Inspect_R 回傳錯誤。課文的檢測迴圈接下來會？', ans: '錯誤線讓 Enqueue 不執行，不寫結果；PLC 等不到 D511 而報 9005', wrong: ['寫 D510 = 2（NG）', '寫 D510 = 3（伺服異常）', '自動重新拍照直到成功', '把 b0 清成 0'], ex: '錯誤線當開關：error in 有錯，後面的 Enqueue 什麼都不做。只有伺服錯誤（5000～5999）會被 Clear Errors 並送 D510 = 3。' };
    },
    // 11. 心跳間隔
    function () {
      var n = p1([0.5, 1, 2, 4, 5]), bad = n >= 3;
      return { q: '雙龍門 PLC 用 T30：D240 <b>3 秒</b>沒變化就算 HMI 斷線。如果 LabVIEW 每 <b>' + n + ' 秒</b>才寫一次 D240（每次都 +1），會怎樣？', ans: bad ? '每次寫之前都已經超過 3 秒，PLC 會判定斷線' : '每次都在 3 秒內變化，T30 一直被歸零，不會斷線', wrong: bad ? ['不會斷線', '只有自動模式會斷線', 'PLC 會自己把 D240 加 1'] .concat(['T30 計到 ' + n + ' 秒就自動歸零']) : ['PLC 會判定斷線', '只有自動模式會斷線', 'PLC 會自己把 D240 加 1', 'T30 會累積，' + Math.ceil(3 / n) + ' 次後斷線'], ex: 'T30 只在「D240 和上一次掃描一樣」時計時，一有變化就歸零。課文每 1 秒寫一次，有足夠的餘裕。' };
    },
    // 12. 拔線後各自的安全狀態
    function () {
      var man = Math.random() < 0.5;
      return { q: '雙龍門在<b>' + (man ? '手動' : '自動') + '模式</b>，通訊線被踢掉超過 3 秒。PLC 這邊會？', ans: man ? '報異常 40，D107 清 0，點動停止' : '不報異常 40（只有手動模式報）', wrong: man ? ['不報異常，點動繼續', '馬上斷電', '等 LabVIEW 重連才停', '報 9006'] : ['報異常 40 並停機', '馬上斷電', '自動把 D240 寫成 0', '報 9006'], ex: 'PLC 程式：T30（3 秒沒變）讓「手動有效」M5 OFF，清掉 D107 和 M110～M125；只有手動模式會報 40，因為這時 HMI 是唯一的操作站。9006 是 13_PLC 的心跳警報，不是雙龍門的。' };
    },
    // 13. D240 = 0
    function () {
      return { q: '雙龍門的 LabVIEW 正常按 Exit 時，為什麼要先寫 <b>D240 = 0</b> 再關埠？', ans: 'D240 = 0 代表「沒有 HMI」，PLC 就不檢查心跳，不會報 40', wrong: ['讓心跳從頭算', '讓 PLC 停機', 'VISA Close 一定要先寫一筆', '清掉 PLC 的異常'], ex: 'PLC 只在 D240 > 0 時計 T30。用 Abort 砍掉程式就不會寫 0，手動模式 3 秒後報 40。' };
    },
    // 14. 心跳循環
    function () {
      return { q: 'LabVIEW 的心跳計數到 <b>32767</b> 後，下一個要寫多少？', ans: '1', wrong: ['0', '32768', '-32768', '65535'], ex: 'PLC 的 D 是有號 16 位元，32768 會變成 -32768；0 又代表「沒有 HMI」。所以在 1～32767 之間循環。' };
    },
    // 15. 重連後 Flush Queue
    function () {
      var n = p1([3, 5, 8]);
      return { q: '斷線那幾秒，操作員按了 ' + n + ' 下點動，佇列裡堆了 ' + n + ' 筆 D107 命令。線接回來後，課文的通訊迴圈怎麼處理？', ans: '錯誤頁 Flush Queue，全部丟掉', wrong: ['照順序全部寫給 PLC', '只寫最後一筆', '等操作員確認再寫', '寫完再丟掉'], ex: '斷線期間的舊點動命令如果在重連後才送出去，機台會突然自己動。所以重連時一律清掉。' };
    },
    // 16. 誰發現斷線
    function () {
      return { q: '雙龍門的線被拔掉。LabVIEW 這邊是<b>怎麼</b>發現的？', ans: 'VISA Read 等不到回應而逾時，錯誤線帶著錯誤進到下一圈', wrong: ['讀 D240 發現沒變', 'PLC 寫一個斷線旗標給 LabVIEW', 'Tick Count 停了', 'Windows 跳通知'], ex: '心跳是寫給 PLC 看的。LabVIEW 這邊看的是通訊本身：讀不到就逾時（課文 2 秒），下一圈進錯誤頁重連，PLC Connected 熄滅。' };
    }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) window.HandshakeLab.quiz = window.LabQuiz('hquiz', gen);
  window.HandshakeLab.quizGen = gen; window.HandshakeLab.quizKinds = KIND;
})();
