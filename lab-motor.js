/* 馬達實驗室：正反轉與互鎖、Y-Δ 啟動、熱動電驛跳脫、猜一猜
   時間單位 1 ms。接觸器的吸合、釋放時間都是示意值，實際依型錄。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls === 'ok' ? ' say-go' : cls === 'bad' ? ' say-stop' : ''); }
  function logTo(id, s) { var l = $(id), d = document.createElement('div'); d.innerHTML = s; l.insertBefore(d, l.firstChild); while (l.children.length > 120) l.removeChild(l.lastChild); }
  function Tab() { return { gen: 0, timer: null, resume: false }; }
  var tabs = $('tabs'), cur = 'fr';

  /* 共用：接觸器的電樞（主接點）。線圈通電滿 tp 吸合；斷電滿 tr 放開；熔著時一直閉合 */
  function Arm() { return { on: false, p: 0, r: 0 }; }
  function armStep(a, coil, tp, tr, weld) {
    if (coil) { a.r = 0; if (!a.on && ++a.p >= tp) { a.on = true; a.p = 0; return 'close'; } }
    else { a.p = 0; if (a.on && !weld && ++a.r >= tr) { a.on = false; a.r = 0; return 'open'; } }
    return '';
  }
  /* 時序圖：rows = [[名稱, key, 顏色]] */
  function timeline(svg, rows, hist, unit, label) {
    var W = Math.max(280, Math.floor(svg.getBoundingClientRect().width || svg.parentNode.clientWidth || 600)), L = W < 420 ? 86 : 110, rh = 22, H = rows.length * rh + 26;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('height', H);
    if (!hist.length) { svg.innerHTML = '<text x="8" y="16">' + (label || '按按鈕之後這裡會畫出時序') + '</text>'; return; }
    var t0 = hist[0].t, t1 = hist[hist.length - 1].t, span = Math.max(1, t1 - t0), X = function (t) { return L + (t - t0) / span * (W - L - 8); }, s = '';
    rows.forEach(function (r, i) {
      var y = i * rh + 4, top = y + 4, bot = y + rh - 4, pts = [], prev = null;
      s += '<text x="4" y="' + (y + 15) + '">' + r[0] + '</text><line x1="' + L + '" y1="' + (y + rh) + '" x2="' + W + '" y2="' + (y + rh) + '" stroke="currentColor" opacity=".1"/>';
      hist.forEach(function (h) { var yy = h[r[1]] ? top : bot; if (prev !== null && prev !== yy) pts.push(X(h.t) + ',' + prev); pts.push(X(h.t) + ',' + yy); prev = yy; });
      s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + r[2] + '" stroke-width="2.2"/>';
    });
    var step = span > 3000 ? 1000 : span > 600 ? 100 : span > 150 ? 50 : 20;
    for (var t = Math.ceil(t0 / step) * step; t <= t1; t += step) s += '<line x1="' + X(t) + '" y1="2" x2="' + X(t) + '" y2="' + (rows.length * rh + 4) + '" stroke="currentColor" opacity=".08"/><text x="' + (X(t) + 2) + '" y="' + (H - 6) + '" opacity=".75">' + (unit === 's' ? (t / 1000).toFixed(1) + 's' : t + 'ms') + '</text>';
    svg.innerHTML = s;
  }
  function c(on, cls) { return on ? cls : ''; }

  /* ======================================================================
     1. 正反轉
     ====================================================================== */
  var TF = Tab(), F;
  var IL_NONE = 'LD X000\nOR Y000\nANI X002\nOUT Y000     ; 正轉 MC1\nLD X001\nOR Y001\nANI X002\nOUT Y001     ; 反轉 MC2';
  var IL_PROG = 'LD X000\nOR Y000\nANI X001     ; 按鈕互鎖\nANI X002\nANI Y001     ; 輸出互鎖\nOUT Y000     ; 正轉 MC1\nLD X001\nOR Y001\nANI X000\nANI X002\nANI Y000\nOUT Y001     ; 反轉 MC2';
  function fMode() { return $('f-mode').value; }
  function tp() { return +$('f-tp').value; } function tr() { return +$('f-tr').value; }
  function flog(s) { logTo('f-log', '<span class="kv">' + F.t + 'ms</span> ' + s); }
  function fNew() {
    if (TF.timer) { clearInterval(TF.timer); TF.timer = null; }
    TF.gen++; TF.resume = false;
    F = { t: 0, X0: 0, X1: 0, X2: 0, rel: {}, Y0: 0, Y1: 0, c1: 0, c2: 0, a1: Arm(), a2: Arm(), nfb: true, shortAt: null, hist: [], ev: null };
    $('f-log').innerHTML = ''; say('f-say', '');
    flog('停止狀態。先按「正轉」。');
    fStart(); fDraw();
  }
  function fPress(k) {
    if (!F) return;
    F[k] = 1; F.rel[k] = F.t + 30;   // 按一下：按住 30 ms（示意）
    flog('按 ' + { X0: '正轉 X0', X1: '反轉 X1', X2: '停止 X2' }[k]);
    if (k === 'X1' && F.a1.on) { F.ev = F.t; F.hist = F.hist.slice(-20); }
  }
  function fTick() {
    var f = F; f.t++;
    ['X0', 'X1', 'X2'].forEach(function (k) { if (f[k] && f.t >= f.rel[k]) f[k] = 0; });
    var m = fMode(), y0 = f.Y0, y1 = f.Y1;
    if (m === 'none') { f.Y0 = (f.X0 || f.Y0) && !f.X2 ? 1 : 0; f.Y1 = (f.X1 || f.Y1) && !f.X2 ? 1 : 0; }
    else { f.Y0 = (f.X0 || f.Y0) && !f.X1 && !f.X2 && !f.Y1 ? 1 : 0; f.Y1 = (f.X1 || f.Y1) && !f.X0 && !f.X2 && !f.Y0 ? 1 : 0; }
    if (y0 !== f.Y0 || y1 !== f.Y1) flog('PLC 輸出：Y0 = ' + f.Y0 + '、Y1 = ' + f.Y1 + (y0 && !f.Y0 && f.Y1 && !y1 ? '（<b>同一個掃描</b>換向）' : ''));
    var c1 = f.Y0 && (m !== 'ext' || !f.a2.on) ? 1 : 0, c2 = f.Y1 && (m !== 'ext' || !f.a1.on) ? 1 : 0;
    if (m === 'ext' && f.Y1 && !c2 && f.c2 === 0 && f.Y1 !== y1) flog('MC2 線圈還吸不進來：串在它前面的 MC1 b 接點還開著（MC1 沒放開）');
    f.c1 = c1; f.c2 = c2;
    var e1 = armStep(f.a1, c1, tp(), tr(), $('f-weld').checked), e2 = armStep(f.a2, c2, tp(), tr(), false);
    if (e1) flog('MC1 主接點' + (e1 === 'close' ? '吸合' : '放開'));
    if (e2) flog('MC2 主接點' + (e2 === 'close' ? '吸合' : '放開'));
    if (f.nfb && f.a1.on && f.a2.on) { f.nfb = false; f.shortAt = f.t; flog('<b>MC1、MC2 主接點同時閉合 → R、T 兩相短路！主電路斷路器（NFB）跳脫（示意）</b>'); }
    f.hist.push({ t: f.t, Y0: f.Y0, Y1: f.Y1, c1: c1, a1: f.a1.on ? 1 : 0, c2: c2, a2: f.a2.on ? 1 : 0, sh: f.a1.on && f.a2.on ? 1 : 0 });
    if (f.hist.length > 220) f.hist.shift();
  }
  function fStep(n) { for (var i = 0; i < (n || 1); i++) fTick(); fDraw(); return F; }
  function fStart() { if (!TF.timer) TF.timer = setInterval(function () { fStep(+$('f-speed').value); }, 30); }
  function contact(x, y, on) { return on ? '<line class="ct on" x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y + 22) + '"/>' : '<line class="ct" x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y + 8) + '"/><line class="ct" x1="' + x + '" y1="' + (y + 14) + '" x2="' + (x + 6) + '" y2="' + (y + 22) + '"/>'; }
  function fMain() {
    var f = F, p1 = f.nfb && f.a1.on, p2 = f.nfb && f.a2.on, hot = f.shortAt != null && f.t - f.shortAt < 400, sup = f.nfb ? 'on1' : '';
    var s = '', X = [50, 80, 110], X2 = [200, 230, 260], nm = ['R', 'S', 'T'];
    s += '<rect x="36" y="24" width="88" height="22" rx="3" fill="none" stroke="currentColor" style="color:var(--ink)"/><text x="44" y="39">NFB ' + (f.nfb ? 'ON' : '跳脫') + '</text>';
    X.forEach(function (x, i) {
      s += '<text x="' + (x - 4) + '" y="16">' + nm[i] + '</text><line class="wire ' + (hot && i !== 1 ? 'hot flash' : f.nfb ? sup : '') + '" x1="' + x + '" y1="18" x2="' + x + '" y2="24"/>';
      s += '<line class="wire ' + (hot && i !== 1 ? 'hot flash' : f.nfb ? sup : '') + '" x1="' + x + '" y1="46" x2="' + x + '" y2="100"/>';
      s += '<line class="wire ' + (hot && i !== 1 ? 'hot flash' : f.nfb ? sup : '') + '" x1="' + x + '" y1="' + (60 + i * 8) + '" x2="' + X2[i] + '" y2="' + (60 + i * 8) + '"/><line class="wire ' + (f.nfb ? sup : '') + '" x1="' + X2[i] + '" y1="' + (60 + i * 8) + '" x2="' + X2[i] + '" y2="100"/>';
      s += contact(x, 100, f.a1.on) + contact(X2[i], 100, f.a2.on);
      s += '<line class="wire ' + c(p1, 'on1') + '" x1="' + x + '" y1="122" x2="' + x + '" y2="212"/>';
    });
    s += '<text x="118" y="116">MC1</text><text x="268" y="116">MC2</text>';
    // MC2 輸出交叉：R→W、S→V、T→U（對調兩相）
    var to = [110, 80, 50], ys = [190, 175, 160];
    X2.forEach(function (x, i) { s += '<polyline class="wire ' + c(p2, 'on2') + (hot && i !== 1 ? ' hot flash' : '') + '" points="' + x + ',122 ' + x + ',' + ys[i] + ' ' + to[i] + ',' + ys[i] + '"/>'; });
    s += '<text x="40" y="226">U</text><text x="70" y="226">V</text><text x="100" y="226">W</text>';
    var dir = p1 && !p2 ? 1 : p2 && !p1 ? -1 : 0;
    s += '<circle class="motor" cx="80" cy="262" r="30"/><text x="74" y="266">M</text>';
    if (dir) s += '<g class="mspin' + (dir < 0 ? ' rev' : '') + '"><path d="M80 236 A26 26 0 0 1 106 262" fill="none" stroke="' + (dir > 0 ? '#1e6fff' : '#b26a00') + '" stroke-width="3"/><path d="M106 262 l-6 -8 l10 0 z" fill="' + (dir > 0 ? '#1e6fff' : '#b26a00') + '"/></g>';
    s += '<text x="130" y="258" class="' + (hot || !f.nfb ? 't-stop' : dir ? 't-go' : 't-mute') + '">' + (!f.nfb ? (hot ? '⚡ 相間短路！' : 'NFB 跳脫，馬達停') : dir > 0 ? '正轉' : dir < 0 ? '反轉（R、T 對調）' : '停止') + '</text>';
    s += '<text x="130" y="278" class="t-mute">MC2 把 R、T 兩相對調</text>';
    $('f-main').innerHTML = s;
  }
  function fCoil() {
    var f = F, ext = fMode() === 'ext', s = '';
    [[f.Y0, 'Y0', !f.a2.on, 'MC2 b', f.c1, 'MC1', 30], [f.Y1, 'Y1', !f.a1.on, 'MC1 b', f.c2, 'MC2', 95]].forEach(function (r) {
      var y = r[6];
      s += '<line x1="10" y1="' + (y - 20) + '" x2="10" y2="' + (y + 20) + '" stroke="currentColor" stroke-width="3" style="color:var(--ink)"/><text x="16" y="' + (y - 6) + '">PLC ' + r[1] + '</text>';
      s += '<circle cx="70" cy="' + y + '" r="6" fill="' + (r[0] ? '#22c55e' : '#4b5563') + '" stroke="#111"/>';
      s += '<line class="wire ' + c(r[0], 'on1') + '" x1="76" y1="' + y + '" x2="140" y2="' + y + '"/>';
      if (ext) { s += r[2] ? '<line class="ct on" x1="140" y1="' + y + '" x2="170" y2="' + y + '"/>' : '<line class="ct" x1="140" y1="' + y + '" x2="150" y2="' + y + '"/><line class="ct" x1="160" y1="' + y + '" x2="170" y2="' + y + '"/><line class="ct" x1="150" y1="' + (y - 8) + '" x2="160" y2="' + y + '"/>'; s += '<text x="138" y="' + (y - 10) + '">' + r[3] + '</text>'; }
      else s += '<line class="wire ' + c(r[0], 'on1') + '" x1="140" y1="' + y + '" x2="170" y2="' + y + '"/><text x="128" y="' + (y - 10) + '" class="t-mute">（沒有外部互鎖）</text>';
      s += '<line class="wire ' + c(r[4], 'on1') + '" x1="170" y1="' + y + '" x2="230" y2="' + y + '"/><rect class="coil ' + c(r[4], 'on') + '" x="230" y="' + (y - 12) + '" width="50" height="24" rx="12"/><text x="240" y="' + (y + 4) + '">' + r[5] + '</text>';
    });
    $('f-coil').innerHTML = s;
  }
  function fDraw() {
    var f = F; if (!f) return;
    $('f-tpv').textContent = tp() + ' ms'; $('f-trv').textContent = tr() + ' ms'; $('f-t').textContent = f.t;
    $('f-il').textContent = fMode() === 'none' ? IL_NONE : IL_PROG;
    fMain(); fCoil();
    var vis = $('t-fr').offsetParent !== null;
    if (vis) timeline($('f-tl'), [['Y0 輸出', 'Y0', '#1e6fff'], ['MC1 線圈', 'c1', '#1e6fff'], ['MC1 主接點', 'a1', '#1e6fff'], ['Y1 輸出', 'Y1', '#b26a00'], ['MC2 線圈', 'c2', '#b26a00'], ['MC2 主接點', 'a2', '#b26a00'], ['同時閉合', 'sh', '#dc2626']], F.hist, 'ms');
    var m = fMode();
    if (f.shortAt != null) say('f-say', m === 'none' ? '✖ 沒有互鎖：按反轉時 Y0 還自保持著，Y0、Y1 同時 ON，兩個接觸器都吸合 → 相間短路。' : '✖ 程式在同一個掃描讓 Y0 OFF、Y1 ON，可是 MC1 釋放要 ' + tr() + ' ms、MC2 吸合只要 ' + tp() + ' ms（示意），有 ' + Math.max(0, tr() - tp()) + ' ms 兩個主接點同時閉合 → 相間短路。' + ($('f-weld').checked ? 'MC1 熔著時更是一直閉著。' : '') + '程式只看得到自己的 Y，擋不住這一段。', 'bad');
    else if (m === 'ext' && $('f-weld').checked && f.Y1 && !f.a2.on && f.a1.on) say('f-say', 'MC1 主接點熔著：MC1 的 b 接點跟著主接點卡住，一直開著，MC2 線圈吸不進來，沒有短路。可是馬達還在正轉，程式也停不了它，要切主電源或急停迴路，然後換接觸器。', 'bad');
    else if (m === 'ext' && f.a2.on && f.ev != null) say('f-say', '✔ 外部 b 接點互鎖：MC2 線圈要等 MC1 真的放開（' + tr() + ' ms）才通電，再過 ' + tp() + ' ms 才吸合，兩個主接點沒有同時閉合過。實務上換向還會再加延遲，讓電弧熄滅、馬達停下來。', 'ok');
    else if (m === 'prog' && f.a2.on && f.ev != null && tr() <= tp()) say('f-say', '這次釋放時間（' + tr() + ' ms）不比吸合時間長，剛好沒重疊；但接觸器老化、電弧沒熄都會讓情況變差，程式互鎖不是保證。', '');
    else say('f-say', '');
  }
  ['f-fwd', 'f-rev', 'f-stop'].forEach(function (id, i) { $(id).onclick = function () { fPress(['X0', 'X1', 'X2'][i]); }; });
  $('f-reset').onclick = fNew; $('f-mode').onchange = fNew; $('f-weld').onchange = fNew;
  $('f-tp').oninput = $('f-tr').oninput = fDraw;

  /* ======================================================================
     2. Y-Δ 啟動
     ====================================================================== */
  var TY = Tab(), Y, YTP = 15, YTR = 35, T0K = 30;   // 示意：吸合 15 ms、釋放 35 ms；T0 K30 = 3 s
  function gapK() { return +$('y-gap').value; }
  function yMode() { return $('y-mode').value; }
  function ylog(s) { logTo('y-log', '<span class="kv">' + (Y.t / 1000).toFixed(3) + 's</span> ' + s); }
  function yIL() {
    var g = gapK();
    return 'LD X000\nOR Y000\nANI X001\nOUT Y000        ; MC 主\nLD Y000\nOUT T0 K' + T0K + '     ; Y 接運轉時間（示意）\nLD Y000\nANI T0\nANI Y002        ; 程式互鎖\nOUT Y001        ; MCY\n' +
      (g ? 'LD T0\nOUT T1 K' + g + '      ; 切換間隔（示意）\nLD T1\n' : 'LD T0          ; 沒有切換間隔\n') + 'ANI Y001        ; 程式互鎖\nOUT Y002        ; MCΔ';
  }
  function yNew() {
    if (TY.timer) { clearInterval(TY.timer); TY.timer = null; }
    TY.gen++; TY.resume = false;
    Y = { t: 0, X0: 0, X1: 0, rel: {}, Y0: 0, Y1: 0, Y2: 0, T0: 0, T1: 0, acc0: 0, acc1: 0, cM: 0, cY: 0, cD: 0, aM: Arm(), aY: Arm(), aD: Arm(), nfb: true, shortAt: null, slowUntil: 0, hist: [], zoom: [], zoomOn: false };
    $('y-log').innerHTML = ''; say('y-say', '');
    ylog('停止狀態。按「啟動」。');
    yStart(); yDraw();
  }
  function yPress(k) { Y[k] = 1; Y.rel[k] = Y.t + 30; ylog('按 ' + (k === 'X0' ? '啟動 X0' : '停止 X1')); }
  function yTick() {
    var y = Y; y.t++;
    ['X0', 'X1'].forEach(function (k) { if (y[k] && y.t >= y.rel[k]) y[k] = 0; });
    var old = [y.Y0, y.Y1, y.Y2].join(''), g = gapK();
    y.Y0 = (y.X0 || y.Y0) && !y.X1 ? 1 : 0;
    if (y.Y0) { y.acc0++; } else { y.acc0 = 0; }
    var t0 = y.acc0 >= T0K * 100; if (t0 && !y.T0) ylog('T0 到（' + T0K / 10 + ' 秒）'); y.T0 = t0 ? 1 : 0;
    y.Y1 = y.Y0 && !y.T0 && !y.Y2 ? 1 : 0;
    if (g) { if (y.T0) y.acc1++; else y.acc1 = 0; var t1 = y.acc1 >= g * 100; if (t1 && !y.T1) ylog('T1 到（切換間隔 ' + g / 10 + ' 秒）'); y.T1 = t1 ? 1 : 0; y.Y2 = y.T1 && !y.Y1 ? 1 : 0; }
    else { y.T1 = 0; y.Y2 = y.T0 && y.Y0 && !y.Y1 ? 1 : 0; }
    var now = [y.Y0, y.Y1, y.Y2].join('');
    if (now !== old) ylog('PLC 輸出：Y0（MC 主）= ' + y.Y0 + '、Y1（MCY）= ' + y.Y1 + '、Y2（MCΔ）= ' + y.Y2);
    var ext = yMode() === 'ext';
    y.cM = y.Y0; y.cY = y.Y1 && (!ext || !y.aD.on) ? 1 : 0; y.cD = y.Y2 && (!ext || !y.aY.on) ? 1 : 0;
    [['aM', 'cM', 'MC 主'], ['aY', 'cY', 'MCY'], ['aD', 'cD', 'MCΔ']].forEach(function (r) { var e = armStep(y[r[0]], y[r[1]], YTP, YTR, false); if (e) ylog(r[2] + ' 主接點' + (e === 'close' ? '吸合' : '放開')); });
    if (y.nfb && y.aM.on && y.aY.on && y.aD.on) { y.nfb = false; y.shortAt = y.t; ylog('<b>MCY、MCΔ 主接點同時閉合 → 電源相間短路！NFB 跳脫（示意）</b>'); }
    // 切換瞬間：自動放慢、記錄放大圖
    if (y.Y0 && y.acc0 >= T0K * 100 - 60 && !y.zoomOn && !y.zoom.length) y.zoomOn = true;
    if (y.zoomOn) { y.zoom.push({ t: y.t, Y1: y.Y1, aY: y.aY.on ? 1 : 0, Y2: y.Y2, cD: y.cD, aD: y.aD.on ? 1 : 0, sh: y.aY.on && y.aD.on ? 1 : 0 });
      if ((y.aD.on && !y.slowUntil) || (y.shortAt && !y.slowUntil)) y.slowUntil = y.t + 60;
      if (y.slowUntil && y.t >= y.slowUntil) y.zoomOn = false; }
    if (y.t % 20 === 0) { y.hist.push({ t: y.t, aM: y.aM.on ? 1 : 0, aY: y.aY.on ? 1 : 0, aD: y.aD.on ? 1 : 0, sh: y.aY.on && y.aD.on ? 1 : 0 }); if (y.hist.length > 400) y.hist.shift(); }
  }
  function ySlow() { return Y.zoomOn; }
  function yStep(n) { for (var i = 0; i < (n || 1); i++) yTick(); yDraw(); return Y; }
  function yStart() { if (!TY.timer) TY.timer = setInterval(function () { yStep(ySlow() ? 1 : 30); }, 30); }
  function yMain() {
    var y = Y, pw = y.nfb && y.aM.on, s = '', X = [40, 70, 100], nm = ['R', 'S', 'T'], hot = y.shortAt != null && y.t - y.shortAt < 600;
    s += '<rect x="26" y="20" width="88" height="20" rx="3" fill="none" stroke="currentColor" style="color:var(--ink)"/><text x="32" y="34">NFB ' + (y.nfb ? 'ON' : '跳脫') + '</text>';
    X.forEach(function (x, i) {
      s += '<text x="' + (x - 4) + '" y="13">' + nm[i] + '</text><line class="wire ' + (y.nfb ? 'on1' : '') + '" x1="' + x + '" y1="40" x2="' + x + '" y2="56"/>' + contact(x, 56, y.aM.on);
      s += '<line class="wire ' + c(pw, 'on1') + (hot ? ' hot flash' : '') + '" x1="' + x + '" y1="78" x2="' + x + '" y2="130"/>';
      s += '<rect class="coil ' + c(pw && (y.aY.on || y.aD.on), 'on') + '" x="' + (x - 7) + '" y="130" width="14" height="50" rx="3"/>';
      s += '<line class="wire ' + c(pw && y.aY.on, 'on1') + '" x1="' + x + '" y1="180" x2="' + x + '" y2="206"/>' + contact(x, 206, y.aY.on);
    });
    s += '<text x="108" y="160">U1-U2</text><text x="108" y="174" class="t-mute">三個繞組</text><text x="4" y="98" class="t-mute">MC主</text>';
    s += '<line class="wire ' + c(pw && y.aY.on, 'on1') + (hot ? ' hot flash' : '') + '" x1="40" y1="236" x2="100" y2="236"/><text x="44" y="252">MCY：U2、V2、W2 接在一起（星形點）</text>';
    // MCΔ：U2→V 線、V2→W 線、W2→U 線
    var D = [190, 220, 250], back = [70, 100, 40], yy = [100, 110, 120];
    X.forEach(function (x, i) {
      s += '<line class="wire ' + c(pw && y.aD.on, 'on2') + '" x1="' + x + '" y1="194" x2="' + D[i] + '" y2="194"/>' + contact(D[i], 196, y.aD.on);
      s += '<polyline class="wire ' + c(pw && y.aD.on, 'on2') + (hot ? ' hot flash' : '') + '" points="' + D[i] + ',196 ' + D[i] + ',' + yy[i] + ' ' + back[i] + ',' + yy[i] + '"/>';
    });
    s += '<text x="256" y="214">MCΔ</text>';
    var st = !y.nfb ? (hot ? '⚡ 相間短路！' : 'NFB 跳脫') : pw && y.aY.on && !y.aD.on ? 'Y 接運轉（啟動）' : pw && y.aD.on && !y.aY.on ? 'Δ 接運轉' : pw ? '切換中：繞組沒接成迴路' : '停止';
    s += '<text x="150" y="282" class="' + (!y.nfb ? 't-stop' : pw ? 't-go' : 't-mute') + '">' + st + '</text>';
    $('y-main').innerHTML = s;
  }
  function yDraw() {
    var y = Y; if (!y) return;
    $('y-t').textContent = (y.t / 1000).toFixed(2); $('y-il').textContent = yIL();
    $('y-lamps').innerHTML = [['Y0 MC 主', y.Y0], ['Y1 MCY', y.Y1], ['Y2 MCΔ', y.Y2], ['T0', y.T0], ['T1', y.T1]].map(function (r) { return '<span><span class="mlamp' + (r[1] ? ' on' : '') + '"></span>' + r[0] + '</span>'; }).join('') + '<span class="kv">T0 ' + (Math.min(y.acc0, T0K * 100) / 1000).toFixed(1) + '／' + T0K / 10 + ' s</span>';
    yMain();
    if ($('t-yd').offsetParent !== null) {
      timeline($('y-tl'), [['MC 主', 'aM', '#1e6fff'], ['MCY', 'aY', '#1e6fff'], ['MCΔ', 'aD', '#b26a00'], ['同時閉合', 'sh', '#dc2626']], y.hist, 's', '按啟動之後這裡畫出整段時序（主接點）');
      timeline($('y-zoom'), [['Y1 輸出', 'Y1', '#1e6fff'], ['MCY 主接點', 'aY', '#1e6fff'], ['Y2 輸出', 'Y2', '#b26a00'], ['MCΔ 線圈', 'cD', '#b26a00'], ['MCΔ 主接點', 'aD', '#b26a00'], ['同時閉合', 'sh', '#dc2626']], y.zoom, 'ms', 'Y→Δ 切換的那一瞬間會放大畫在這裡');
    }
    var g = gapK(), ext = yMode() === 'ext';
    if (y.shortAt != null) say('y-say', '✖ ' + (g ? '' : '沒有切換間隔：') + '程式讓 MCY 放開、MCΔ 吸合幾乎同時發生，MCY 釋放（' + YTR + ' ms）比 MCΔ 吸合（' + YTP + ' ms）慢（示意），兩個同時閉合 → 短路。加切換間隔 T1、再加外部 b 接點互鎖。', 'bad');
    else if (y.aD.on && y.aM.on) say('y-say', '✔ 已經切成 Δ 運轉。' + (g ? 'MCY 放開之後等了 T1（' + g / 10 + ' 秒）才讓 MCΔ 吸合。' : '') + (ext ? 'MCΔ 線圈前面還串著 MCY 的 b 接點，MCY 沒放開它吸不進來。' : '') + (!g && ext ? '這次靠外部互鎖擋住了，但沒有間隔時電弧可能還沒熄，實務上還是要加 T1。' : ''), 'ok');
    else if (y.aY.on && y.aM.on) say('y-say', 'Y 接啟動中：啟動電流和轉矩大約是直接 Δ 啟動的三分之一。');
    else say('y-say', '');
  }
  $('y-start').onclick = function () { yPress('X0'); }; $('y-stop').onclick = function () { yPress('X1'); };
  $('y-reset').onclick = yNew; $('y-gap').onchange = yNew; $('y-mode').onchange = yNew;

  /* ======================================================================
     3. 熱動電驛
     ====================================================================== */
  var TO = Tab(), O;
  function olog(s) { logTo('o-log', '<span class="kv">' + (O.t / 1000).toFixed(1) + 's</span> ' + s); }
  function oNew() {
    if (TO.timer) { clearInterval(TO.timer); TO.timer = null; }
    TO.gen++; TO.resume = false;
    O = { t: 0, X0: 0, X1: 0, rel: {}, th: false, load: false, loadT: 0, cut: false, Y0: 0, Y3: 0, coil: 0, run: false };
    $('o-log').innerHTML = ''; oStart(); oDraw();
  }
  function oX2() { var nc = $('o-wire').value === 'nc'; if (O.cut) return 0; return nc ? (O.th ? 0 : 1) : (O.th ? 1 : 0); }
  function oTick(ms) {
    var o = O; o.t += ms;
    ['X0', 'X1'].forEach(function (k) { if (o[k] && o.t >= o.rel[k]) o[k] = 0; });
    var nc = $('o-wire').value === 'nc', x2 = oX2(), y0 = o.Y0;
    o.Y0 = (o.X0 || o.Y0) && !o.X1 && (nc ? x2 : !x2) ? 1 : 0;
    o.Y3 = nc ? (x2 ? 0 : 1) : (x2 ? 1 : 0);
    if (y0 && !o.Y0) olog('PLC：Y0 OFF' + (o.Y3 ? '（X2 顯示過載，程式停機）' : ''));
    o.coil = o.Y0 && (!$('o-hw').checked || !o.th) ? 1 : 0;
    var was = o.run; o.run = !!o.coil;
    if (was && !o.run) olog('MC 失磁，馬達停' + (o.Y0 ? '（PLC 的 Y0 還是 ON：是 TH 的 b 接點在線圈迴路直接切斷的）' : ''));
    if (!was && o.run) olog('MC 吸合，馬達轉');
    if (o.load && o.run) { o.loadT += ms; if (o.loadT >= 1500) { o.th = true; o.load = false; o.loadT = 0; olog('<b>TH 跳脫</b>（過載 1.5 秒，示意）'); } }
  }
  function oStep(n) { for (var i = 0; i < (n || 1); i++) oTick(10); oDraw(); return O; }
  function oStart() { if (!TO.timer) TO.timer = setInterval(function () { oStep(3); }, 30); }
  function oDraw() {
    var o = O; if (!o) return;
    var nc = $('o-wire').value === 'nc', hw = $('o-hw').checked, x2 = oX2(), s = '';
    $('o-il').textContent = 'LD X000\nOR Y000\nANI X001\n' + (nc ? 'AND X002     ; TH 接 b 接點：平常 ON' : 'ANI X002     ; TH 接 a 接點：跳脫才 ON') + '\nOUT Y000     ; MC\n' + (nc ? 'LDI X002' : 'LD X002') + '\nOUT Y003     ; 過載燈';
    // 線圈迴路
    s += '<text x="8" y="22">PLC Y0</text><circle cx="70" cy="40" r="6" fill="' + (o.Y0 ? '#22c55e' : '#4b5563') + '" stroke="#111"/>';
    s += '<line class="wire ' + c(o.Y0, 'on1') + '" x1="76" y1="40" x2="140" y2="40"/>';
    if (hw) s += (o.th ? '<line class="ct" x1="140" y1="40" x2="150" y2="40"/><line class="ct" x1="160" y1="40" x2="170" y2="40"/><line class="ct" x1="150" y1="32" x2="160" y2="40"/>' : '<line class="ct on" x1="140" y1="40" x2="170" y2="40"/>') + '<text x="128" y="28">TH b（硬體）</text>';
    else s += '<line class="wire ' + c(o.Y0, 'on1') + '" x1="140" y1="40" x2="170" y2="40"/><text x="128" y="28" class="t-mute">（沒串 TH）</text>';
    s += '<line class="wire ' + c(o.coil, 'on1') + '" x1="170" y1="40" x2="220" y2="40"/><rect class="coil ' + c(o.coil, 'on') + '" x="220" y="28" width="48" height="24" rx="12"/><text x="236" y="44">MC</text>';
    // TH → X2
    s += '<rect x="20" y="90" width="90" height="40" rx="4" fill="' + (o.th ? 'rgba(239,68,68,.2)' : 'transparent') + '" stroke="currentColor" style="color:var(--ink)"/><text x="30" y="108">TH</text><text x="30" y="124" class="' + (o.th ? 't-stop' : 't-mute') + '">' + (o.th ? '跳脫' : o.load ? '過熱中…' : '正常') + '</text>';
    s += '<text x="118" y="104">' + (nc ? 'b 接點' : 'a 接點') + '</text>';
    s += '<line class="wire ' + c(x2, 'on1') + '" x1="110" y1="110" x2="' + (o.cut ? 170 : 240) + '" y2="110"/>' + (o.cut ? '<text x="176" y="114" class="t-stop">✂ 斷線</text><line class="wire" x1="215" y1="110" x2="240" y2="110"/>' : '');
    s += '<rect x="240" y="96" width="70" height="28" rx="3" fill="none" stroke="currentColor" style="color:var(--ink)"/><text x="250" y="114">X2 = ' + x2 + '</text>';
    s += '<circle class="motor" cx="70" cy="180" r="26"/><text x="64" y="184">M</text>' + (o.run ? '<g class="mspin"><path d="M70 158 A22 22 0 0 1 92 180" fill="none" stroke="#1e6fff" stroke-width="3"/></g>' : '');
    s += '<text x="110" y="184" class="' + (o.run ? (o.th ? 't-stop' : 't-go') : 't-mute') + '">' + (o.run ? (o.th ? '⚠ TH 跳脫了，馬達還在轉！' : '運轉中') : '停止') + '</text>';
    $('o-svg').innerHTML = s;
    $('o-lamps').innerHTML = [['X2', x2], ['Y0 MC', o.Y0], ['Y3 過載燈', o.Y3], ['MC 線圈', o.coil]].map(function (r) { return '<span><span class="mlamp' + (r[1] ? (r[0].indexOf('過載') >= 0 ? ' bad' : ' on') : '') + '"></span>' + r[0] + '</span>'; }).join('');
    if (o.run && o.th) say('o-say', '✖ TH 跳脫了，馬達還在轉：' + (nc ? '' : 'X2 接 a 接點，') + (o.cut ? 'X2 的線斷了，PLC 看不到跳脫；' : '') + '而且 TH 沒有串在線圈迴路。過載保護整個失效。', 'bad');
    else if (o.cut && !nc && !o.th) say('o-say', '✖ X2 接 a 接點時線斷了：PLC 讀到 OFF＝「正常」，完全不知道線斷了。之後真的過載，PLC 也收不到。', 'bad');
    else if (o.cut && nc) say('o-say', '✔ X2 接 b 接點：線斷了 X2 變 OFF，程式當成過載停機、亮過載燈。先修線，這叫失效安全（fail-safe）。', 'ok');
    else if (o.th && !o.run) say('o-say', '✔ TH 跳脫，馬達停了。' + (hw ? 'TH 的 b 接點直接切斷 MC 線圈，就算 PLC 當機也會停。' : '這次是靠 PLC 程式停的；PLC 有問題時就沒有保護，所以 TH 的 b 接點最好也串在線圈迴路。') + '按「TH 手動復歸」，馬達不會自己轉，要再按啟動。', 'ok');
    else say('o-say', '');
  }
  $('o-start').onclick = function () { O.X0 = 1; O.rel.X0 = O.t + 60; olog('按啟動 X0'); };
  $('o-stop').onclick = function () { O.X1 = 1; O.rel.X1 = O.t + 60; olog('按停止 X1'); };
  $('o-load').onclick = function () { if (!O.run) { olog('馬達沒在轉，不會過載'); return; } O.load = true; O.loadT = 0; olog('馬達過載（電流變大）'); oDraw(); };
  $('o-thr').onclick = function () { if (O.th) { O.th = false; olog('TH 手動復歸'); } oDraw(); };
  $('o-cut').onclick = function () { O.cut = true; olog('X2 的輸入線斷了'); oDraw(); };
  $('o-fix').onclick = function () { O.cut = false; olog('接回 X2 的線'); oDraw(); };
  $('o-reset').onclick = oNew; $('o-wire').onchange = oNew; $('o-hw').onchange = oDraw;

  /* ---------- 分頁切換：看不到的分頁暫停 ---------- */
  var ALL = { fr: [TF, fStart, fDraw], yd: [TY, yStart, yDraw], ol: [TO, oStart, oDraw] };
  function sync() {
    Object.keys(ALL).forEach(function (k) {
      var a = ALL[k], T = a[0], off = cur !== k || document.hidden;
      if (off && T.timer) { clearInterval(T.timer); T.timer = null; T.resume = true; }
      else if (!off && T.resume) { T.resume = false; a[1](); }
      if (!off) a[2]();
    });
  }
  function show(t) {
    cur = t;
    [].forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['fr', 'yd', 'ol'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
    sync();
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  document.addEventListener('visibilitychange', sync);
  var rsz = null; window.addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(function () { ALL[cur][2](); }, 150); });
  fNew(); yNew(); oNew();
  sync();
  if (/^#(fr|yd|ol)$/.test(location.hash)) show(location.hash.slice(1));

  window.MotorLab = {
    show: show, current: function () { return cur; },
    fr: { reset: fNew, press: fPress, step: fStep, S: function () { return F; }, setMode: function (m) { $('f-mode').value = m; fNew(); }, setTimes: function (p, r) { $('f-tp').value = p; $('f-tr').value = r; fDraw(); }, weld: function (v) { $('f-weld').checked = !!v; fNew(); }, stop: function () { if (TF.timer) { clearInterval(TF.timer); TF.timer = null; } } },
    yd: { reset: yNew, press: yPress, step: yStep, S: function () { return Y; }, set: function (gap, mode) { $('y-gap').value = String(gap); $('y-mode').value = mode; yNew(); }, stop: function () { if (TY.timer) { clearInterval(TY.timer); TY.timer = null; } } },
    ol: { reset: oNew, step: oStep, S: function () { return O; }, set: function (wire, hw) { $('o-wire').value = wire; $('o-hw').checked = !!hw; oNew(); }, start: function () { $('o-start').click(); }, stopBtn: function () { $('o-stop').click(); }, load: function () { $('o-load').click(); }, thReset: function () { $('o-thr').click(); }, cut: function (v) { $(v ? 'o-cut' : 'o-fix').click(); }, stop: function () { if (TO.timer) { clearInterval(TO.timer); TO.timer = null; } } }
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function uniq(ans, list) { var seen = {}, out = []; seen[ans] = 1; list.forEach(function (x) { x = String(x); if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
  var YD = ['按啟動：MC 主、MCY 吸合（Y 接啟動）', 'T0 到：MCY 放開', 'T1（切換間隔）到：MCΔ 吸合（Δ 運轉）'];
  var KIND = [
    function () { var p = ri(8, 25), r = ri(15, 60);
      var f = function () { return Math.max(0, r - p) + ' ms'; };
      return { q: '只有程式互鎖。PLC 在同一個掃描讓 Y0 OFF、Y1 ON。MC1 釋放要 ' + r + ' ms、MC2 吸合要 ' + p + ' ms（示意）。兩個主接點同時閉合多久？', ans: f(), wrong: uniq(f(), [(r + p) + ' ms', p + ' ms', r + ' ms', '0 ms', Math.abs(p - r) + 5 + ' ms']), ex: 'MC1 要 ' + r + ' ms 才放開，MC2 在 ' + p + ' ms 就吸合，重疊 = max(0, ' + r + ' − ' + p + ')。程式只看得到 Y，看不到接觸器還沒放開。', chk: f }; },
    function () { var p = ri(8, 25), r = ri(15, 60);
      var f = function () { return (r + p) + ' ms'; };
      return { q: '程式＋外部 b 接點互鎖（MC2 線圈串 MC1 的 b 輔助接點）。換向時 MC1 釋放 ' + r + ' ms、MC2 吸合 ' + p + ' ms（示意），MC2 主接點在 Y1 ON 之後多久閉合？', ans: f(), wrong: uniq(f(), [p + ' ms', r + ' ms', Math.max(0, r - p) + ' ms', '0 ms', (r + 2 * p) + ' ms']), ex: 'MC1 放開後它的 b 接點才閉合，MC2 線圈這時才通電，再過 ' + p + ' ms 吸合：' + r + ' + ' + p + '。', chk: f }; },
    function () { return { q: '正反轉只寫了程式互鎖（ANI Y0／ANI Y1），夠不夠？', ans: '不夠：FX3S 手冊要求 PLC 外部也要有正反轉的互鎖電路', wrong: ['夠，程式互鎖就能保證不會短路', '夠，只要掃描時間夠短', '不用互鎖，接觸器會自己避開', '只要加大 NFB 就好'], ex: '程式只看得到自己的 Y：接觸器放開比吸合慢、主接點熔著，程式都擋不住。手冊要求外部要有互鎖電路；常見做法是接觸器 b 接點電氣互鎖，再加機械互鎖。' }; },
    function () { return { q: '正反轉的外部電氣互鎖怎麼接？', ans: 'MC1 線圈串 MC2 的 b 輔助接點，MC2 線圈串 MC1 的 b 輔助接點', wrong: ['MC1 線圈串 MC2 的 a 輔助接點', '兩個線圈並聯', 'MC1、MC2 的主接點串聯', '只在 PLC 程式裡寫 ANI'], ex: '對方吸合時它的 b 接點打開，自己的線圈就吸不進來；對方真的放開，b 接點才閉合。' }; },
    function () { return { q: 'MC1 的主接點熔著（線圈斷電也打不開）。這時按反轉，哪一層互鎖擋得住 MC2 吸合？', ans: '外部的電氣互鎖（b 接點和主接點機構連動）或機械連鎖', wrong: ['程式互鎖 ANI Y0', '換更快的 PLC', '按鈕互鎖 ANI X0', '都擋不住，一定短路'], ex: '程式看到 Y0 已經 OFF 就以為沒事；熔著時 MC1 的 b 接點跟著卡在打開，MC2 線圈吸不進來。' }; },
    function () { return { q: '三相馬達要反轉，主電路怎麼做？', ans: '三相裡任意兩相對調', wrong: ['三相全部對調', '把 N 線接到馬達', '改變電壓', '只要 PLC 改輸出就好，接線不用動'], ex: '對調任意兩相，旋轉磁場反向，馬達就反轉。MC2 就是把兩相對調接到馬達。' }; },
    function () { var k = ri(0, 1);
      return { q: 'Y-Δ 啟動的順序，「' + YD[k] + '」的下一步是？', ans: YD[k + 1], wrong: uniq(YD[k + 1], YD.filter(function (x, i) { return i !== k + 1; }).concat(['MCY、MCΔ 同時吸合', 'MC 主放開'])), ex: 'MC 主一直吸著；MCY 先放開，等切換間隔，再讓 MCΔ 吸合。' }; },
    function () { var K = ri(20, 80), id = ri(0, 31);
      var f = function () { return (K / 10) + ' 秒'; };
      return { q: 'FX3S 寫 <code>OUT T' + id + ' K' + K + '</code>（T0～T31 是 100 ms 計時器），線圈通電多久接點才 ON？', ans: f(), wrong: uniq(f(), [K + ' 秒', (K / 100) + ' 秒', K + ' ms', (K * 10) + ' 秒']), ex: '100 ms 計時器：K × 0.1 秒 = ' + K / 10 + ' 秒。', chk: f }; },
    function () { return { q: 'Y-Δ 啟動為什麼要在 MCY 放開和 MCΔ 吸合之間留切換間隔？', ans: '讓 MCY 主接點確實放開、電弧熄滅，避免和 MCΔ 同時閉合短路', wrong: ['讓馬達完全停下來', '節省電費', 'PLC 掃描需要時間', '讓計時器重新歸零'], ex: '原則是 Y 接觸器完全釋放之後才讓 Δ 吸合。間隔多長依接觸器的釋放時間，例如 ABB 的 Y-Δ 專用計時器固定約 50 ms，屬於廠商規格，不是通用標準；三菱目錄則要求兩者之間必須裝電氣互鎖。' }; },
    function () { return { q: 'Y 接啟動時的啟動電流，大約是直接 Δ 啟動的多少？', ans: '約三分之一', wrong: ['約一半', '一樣', '約三倍', '約十分之一'], ex: 'Y 接時每個繞組的電壓是 Δ 接的 1/√3，線電流和轉矩都約是 1/3，所以適合降低啟動電流。' }; },
    function () { var nc = Math.random() < 0.5;
      return { q: '熱動電驛 TH 接到 PLC 的 X2，用的是 <b>' + (nc ? 'b 接點（常閉），程式 AND X2' : 'a 接點（常開），程式 ANI X2') + '</b>。運轉中 X2 的線斷了，結果？', ans: nc ? 'X2 變 OFF，程式當成過載停機（fail-safe）' : 'X2 變 OFF＝正常，PLC 不知道線斷了', wrong: ['X2 變 OFF，程式當成過載停機（fail-safe）', 'X2 變 OFF＝正常，PLC 不知道線斷了', 'X2 變 ON，馬達加速', 'PLC 當機'], ex: '常閉接線平常是 ON，跳脫和斷線都會變 OFF，所以斷線也會停；常開接線斷線時看起來和「沒跳脫」一樣。工業配線乙級、丙級試題就規定：控制接點連接 PLC 的電路被切斷時，應等同積熱電驛跳脫。' }; },
    function () { return { q: '為什麼 TH 的 b 接點常常直接串在接觸器線圈迴路，而不是只接到 PLC？', ans: '過載時不靠程式就讓 MC 失磁，PLC 有問題也照樣停', wrong: ['這樣 PLC 就不用接 X2', '讓馬達轉得比較快', '因為 PLC 不能讀 b 接點', '為了省一個輸入點'], ex: '兩層：線圈迴路裡的 b 接點直接切斷；另一組接點接回 PLC 讓程式亮燈、記錄。' }; },
    function () { return { q: '馬達過載，TH 跳脫、馬達停了。按 TH 的手動復歸鈕之後，馬達會？', ans: '不會自己轉，要再按啟動', wrong: ['馬上自己轉起來', '反轉', '過 3 秒自己轉', 'PLC 會報錯當機'], ex: 'Y0 的自保持已經斷了，要重新按啟動，避免修理中的人被突然轉起來的馬達打到。' }; },
    function () { return { q: '正反轉<b>完全沒有互鎖</b>（各自自保持）。正轉中按反轉，會？', ans: 'Y0、Y1 都 ON，兩個接觸器都吸合 → 相間短路', wrong: ['正轉停、改反轉', '沒反應', '只有 Y1 ON', 'PLC 自動先停 0.5 秒'], ex: '反轉那行沒有 ANI Y0，正轉那行也沒被切掉，兩個都自保持住。' }; },
    function () { return { q: '有按鈕互鎖＋輸出互鎖（ANI X1、ANI Y1 在正轉行；ANI X0、ANI Y0 在反轉行，正轉行在上面）。正轉中直接按反轉，PLC 的輸出？', ans: '同一個掃描 Y0 OFF、Y1 ON', wrong: ['Y0 OFF，下一個掃描 Y1 才 ON', '沒反應，要先按停止', 'Y0、Y1 都 ON', 'Y0 保持、Y1 OFF'], ex: '正轉行被 ANI X1 切掉，映像 Y0 變 0；反轉行在下面，ANI Y0 讀到的已經是 0，同一圈就 ON。輸出是同一圈換了，接觸器卻沒那麼快。' }; },
    function () { return { q: '主電路斷路器（NFB）在 MC1、MC2 同時閉合時跳脫，代表？', ans: '發生相間短路，保護動作了；要找出為什麼兩個接觸器會同時閉合', wrong: ['NFB 太敏感，換大一點的', '馬達過載', 'PLC 程式跑太快', '正常現象，復歸就好'], ex: '跳脫是結果，不是原因。檢查外部互鎖、換向延遲、接觸器是否熔著。' }; }
  ];
  function gen() { return p1(KIND)(); }
  function verify(n) {
    n = n || 200; var bad = [];
    KIND.forEach(function (k, i) {
      for (var j = 0; j < n; j++) {
        var q = k(), w = q.wrong.filter(function (x, ix, a) { return x !== q.ans && a.indexOf(x) === ix; });
        if (!q.q || !q.ans || !q.ex) bad.push(i + '：缺欄位');
        if (w.length < 3) bad.push(i + '：錯誤選項不足 ' + w.length);
        if (q.chk && q.chk() !== q.ans) bad.push(i + '：chk ' + q.chk() + ' ≠ ' + q.ans);
      }
    });
    return bad;
  }
  if (window.LabQuiz) window.MotorLab.quiz = window.LabQuiz('mquiz', gen);
  window.MotorLab.quizGen = gen; window.MotorLab.quizKinds = KIND; window.MotorLab.verify = verify;
})();
