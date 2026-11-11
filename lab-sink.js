/* 輸入輸出接線實驗室：漏型／源型輸入、電晶體漏型輸出與 COM 電流、急停接常閉、猜一猜
   事實來源：接線頁（wiring.html）、設計頁（design.html）、課程 A9，以及查證過的 FX3S 規格：
   S/S 接 24V＝漏型（NPN）、接 0V＝源型（PNP），同一台不能混用；輸入響應約 10 ms；
   FX3S-20MT/ES 電晶體漏型輸出每點 0.5 A，Y0～Y3 各自 COM0～COM3，Y4～Y7 共用 COM4 合計 0.8 A。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function distinct(ans, list) { var seen = {}; seen[ans] = 1; return list.filter(function (w) { if (seen[w]) return false; seen[w] = 1; return true; }); }
  function say(id, t, cls) { $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); $(id).textContent = t; }
  function r2(v) { return Math.round(v * 100) / 100; }

  /* ---------- 電流小點：沿折線移動；換分頁或重畫就換一組 ---------- */
  var FLOW = { id: 0, raf: 0, items: [] };
  function stopFlow() { FLOW.id++; cancelAnimationFrame(FLOW.raf); FLOW.items = []; }
  function polyLen(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function at(pts, d) {
    for (var i = 1; i < pts.length; i++) {
      var s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d <= s) { var k = s ? d / s : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; }
      d -= s;
    }
    return pts[pts.length - 1];
  }
  /* list：[{svg, pts}]，每條路徑放一串小點 */
  function startFlow(list) {
    stopFlow();
    var my = FLOW.id;
    FLOW.items = list.map(function (f) {
      var g = document.createElementNS('http://www.w3.org/2000/svg', 'g'), L = polyLen(f.pts), n = Math.max(3, Math.floor(L / 34)), dots = [];
      for (var i = 0; i < n; i++) { var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', '4'); c.setAttribute('class', 'dot'); g.appendChild(c); dots.push(c); }
      f.svg.appendChild(g); return { pts: f.pts, L: L, dots: dots };
    });
    var t0 = performance.now();
    (function tick(now) {
      if (my !== FLOW.id) return;
      var off = (now - t0) * 0.06;
      FLOW.items.forEach(function (it) {
        var gap = it.L / it.dots.length;
        it.dots.forEach(function (c, i) { var p = at(it.pts, (off + i * gap) % it.L); c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); });
      });
      FLOW.raf = requestAnimationFrame(tick);
    })(t0);
  }
  function P(pts) { return pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' '); }
  function line(pts, cls) { return '<polyline class="' + cls + '" points="' + P(pts) + '"/>'; }
  function holdButton(btn, set) {
    function on(e) { e.preventDefault(); set(true); btn.classList.add('on'); }
    function off() { set(false); btn.classList.remove('on'); }
    btn.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, off); });
    btn.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) on(e); });
    btn.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') off(); });
  }

  /* ---------- 分頁 ---------- */
  var TABS = ['in', 'out', 'nc'];
  function show(t) {
    stopFlow();
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    TABS.forEach(function (k) { $('t-' + k).hidden = k !== t; });
    if (t === 'in') drawIn(); else if (t === 'out') drawOut(); else drawNc();
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* =====================================================================
     1. 輸入：漏型與源型
     ===================================================================== */
  /* 純函式：S/S 接法 ss（'24' 或 '0'）、裝置 dev、是否動作 act → 有沒有輸入電流與原因 */
  function inputResult(ss, dev, act) {
    var sink = ss === '24';
    var pullsTo = dev === 'b0' || dev === 'npn' ? '0' : '24';   /* 動作時把 X 接到哪一邊 */
    var match = sink ? pullsTo === '0' : pullsTo === '24';
    if (!act) return { on: false, match: match, why: '還沒按下／沒有感測到，X0 沒有接到任何一邊，沒有電流。' };
    if (match) return { on: true, match: true, why: sink ? '漏型：電流從 24V 經 S/S 進 PLC、從 X0 流出，經' + (dev === 'npn' ? ' NPN 感測器的黑線' : '按鈕') + '到 0V。IN0 燈亮。' : '源型：' + (dev === 'pnp' ? 'PNP 感測器的黑線' : '按鈕') + '把 24V 送進 X0，經 PLC 內部從 S/S 流到 0V。IN0 燈亮。' };
    return { on: false, match: false, why: sink ? '配錯了：S/S 接 24V，X0 這一端也接到 24V，兩邊電壓一樣，沒有電流，IN0 燈不亮。漏型要讓 X 接到 0V（按鈕接 0V、或用 NPN 感測器）。' : '配錯了：S/S 接 0V，X0 這一端也接到 0V，兩邊電壓一樣，沒有電流，IN0 燈不亮。源型要讓 X 接到 24V（按鈕接 24V、或用 PNP 感測器）。' };
  }
  var I = { act: false };
  function drawIn() {
    stopFlow();
    var ss = $('iss').value, dev = $('idev').value, r = inputResult(ss, dev, I.act), s = '', ssY = ss === '24' ? 40 : 260;
    s += line([[20, 40], [620, 40]], 'p24') + '<text x="24" y="32" class="t">＋24V（PLC 的 24V 端子）</text>';
    s += line([[20, 260], [620, 260]], 'p0') + '<text x="24" y="282" class="t">0V（PLC 的 0V 端子）</text>';
    s += '<rect class="box" x="210" y="95" width="150" height="110" rx="6"/><text x="285" y="115" text-anchor="middle" class="t">FX3S</text>';
    s += '<text x="214" y="145" class="t">S/S</text><text x="356" y="145" class="t" text-anchor="end">X0</text>';
    s += line([[220, 150], [265, 150]], 'w') + line([[305, 150], [360, 150]], 'w');
    s += '<path class="w" d="M265 140 L265 160 L292 150 Z M292 140 L292 160"/><text x="285" y="182" class="m" text-anchor="middle">內部光耦合</text>';
    s += '<circle class="lamp' + (r.on ? ' on' : '') + '" cx="285" cy="128" r="7"/><text x="298" y="132" class="m">IN0</text>';
    s += line([[150, ssY], [150, 150], [210, 150]], ss === '24' ? 'wr' : 'wb') + '<circle cx="210" cy="150" r="4" fill="currentColor"/><circle cx="360" cy="150" r="4" fill="currentColor"/>';
    s += '<text x="146" y="' + (ss === '24' ? 70 : 240) + '" class="m" text-anchor="end">S/S 接 ' + (ss === '24' ? '24V' : '0V') + '</text>';
    var path;
    if (dev === 'b0' || dev === 'b24') {
      var top = dev === 'b24', yb = top ? 40 : 260, yc = top ? 95 : 205;
      s += line([[360, 150], [440, 150], [440, top ? 115 : 185]], 'w') + line([[440, top ? 75 : 225], [440, yb]], top ? 'wr' : 'wb');
      s += '<line class="w" x1="' + (I.act ? 440 : 452) + '" y1="' + (top ? 115 : 185) + '" x2="440" y2="' + (top ? 75 : 225) + '"/><line class="w" x1="430" y1="' + yc + '" x2="436" y2="' + yc + '"/>';
      s += '<text x="452" y="' + (yc + 4) + '">按鈕（常開）</text>';
      path = ss === '24' ? [[20, 40], [150, 40], [150, 150], [360, 150], [440, 150], [440, 260], [620, 260]] : [[440, 40], [440, 150], [360, 150], [210, 150], [150, 150], [150, 260], [20, 260]];
    } else {
      var npn = dev === 'npn';
      s += '<rect class="box" x="470" y="110" width="120" height="80" rx="8"/><text x="530" y="128" text-anchor="middle" class="t">' + (npn ? 'NPN' : 'PNP') + ' 感測器</text>';
      s += line([[560, 110], [560, 40]], 'wbr') + '<text x="566" y="80" class="m">棕</text>' + line([[560, 190], [560, 260]], 'wb') + '<text x="566" y="230" class="m">藍</text>';
      s += line([[360, 150], [470, 150]], 'w') + '<text x="430" y="144" class="m">黑</text>';
      var inner = npn ? [[490, 150], [540, 150], [540, 190]] : [[490, 150], [540, 150], [540, 110]];
      s += line(inner, 'w' + (I.act ? '' : ' dim')) + '<text x="500" y="' + (npn ? 180 : 145) + '" class="m">' + (npn ? '動作時黑接藍' : '動作時黑接棕') + '</text>';
      path = ss === '24' ? [[20, 40], [150, 40], [150, 150], [360, 150], [470, 150], [540, 150], [540, 190], [560, 190], [560, 260], [620, 260]] : [[560, 40], [560, 110], [540, 110], [540, 150], [470, 150], [360, 150], [210, 150], [150, 150], [150, 260], [20, 260]];
    }
    if (I.act && !r.on) s += '<text x="400" y="225" class="bad">✕ 沒有電流</text>';
    $('isch').innerHTML = s;
    if (r.on) startFlow([{ svg: $('isch'), pts: path }]);
    say('isay', r.why, I.act ? (r.on ? 'ok' : 'bad') : '');
  }
  $('iss').onchange = drawIn; $('idev').onchange = drawIn;
  holdButton($('ipress'), function (v) { I.act = v; drawIn(); });

  /* =====================================================================
     2. 輸出：電晶體漏型
     ===================================================================== */
  var YS = [['Y0', 80, 'COM0'], ['Y4', 160, 'COM4'], ['Y5', 190, 'COM4'], ['Y6', 220, 'COM4'], ['Y7', 250, 'COM4']];
  var O = { on: { Y0: true, Y4: true, Y5: true, Y6: false, Y7: false }, amp: { Y0: 0.2, Y4: 0.2, Y5: 0.2, Y6: 0.2, Y7: 0.2 } };
  /* 純函式：COM4 合計與警告 */
  function outCheck(on, amp, com) {
    var res = { flows: {}, com4: 0, warn: [] };
    YS.forEach(function (y) {
      var ok = on[y[0]] && com[y[2]] === '0';
      res.flows[y[0]] = ok;
      if (ok && y[2] === 'COM4') res.com4 += amp[y[0]];
      if (ok && amp[y[0]] > 0.5) res.warn.push(y[0] + ' 一點 ' + r2(amp[y[0]]) + ' A，超過每點 0.5 A');
    });
    res.com4 = r2(res.com4);
    if (res.com4 > 0.8) res.warn.push('COM4（Y4～Y7）合計 ' + res.com4 + ' A，超過 0.8 A');
    return res;
  }
  function renderYs() {
    $('oys').innerHTML = YS.map(function (y) {
      return '<label><input type="checkbox" data-y="' + y[0] + '"' + (O.on[y[0]] ? ' checked' : '') + '> ' + y[0] + ' ON　電磁閥 <input type="number" step="0.05" min="0" max="2" data-a="' + y[0] + '" value="' + O.amp[y[0]] + '"> A</label>';
    }).join('');
  }
  $('oys').addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.y) O.on[t.dataset.y] = t.checked;
    if (t.dataset.a) { var v = Number(t.value); O.amp[t.dataset.a] = isFinite(v) && v >= 0 ? v : 0; }
    drawOut();
  });
  function drawOut() {
    stopFlow();
    var com = { COM0: $('ocom0').value, COM4: $('ocom4').value }, r = outCheck(O.on, O.amp, com), s = '', flows = [];
    s += line([[560, 20], [560, 310]], 'p24') + '<text x="556" y="16" class="t" text-anchor="end">外部 ＋24V</text>';
    s += line([[610, 20], [610, 310]], 'p0') + '<text x="636" y="16" class="t" text-anchor="end">0V</text>';
    s += '<rect class="box" x="140" y="45" width="150" height="270" rx="6"/><text x="150" y="65" class="t">FX3S-20MT/ES</text><text x="150" y="80" class="m">電晶體漏型輸出</text>';
    YS.forEach(function (y) {
      var yy = y[1], f = r.flows[y[0]];
      s += '<text x="286" y="' + (yy - 4) + '" class="t" text-anchor="end">' + y[0] + '</text><circle cx="290" cy="' + yy + '" r="4" fill="currentColor"/>';
      s += line([[290, yy], [400, yy]], 'w') + '<rect class="ld' + (f ? ' on' : '') + '" x="400" y="' + (yy - 9) + '" width="70" height="18" rx="3"/><text x="435" y="' + (yy + 4) + '" text-anchor="middle" class="m">SOL ' + r2(O.amp[y[0]]) + 'A</text>';
      s += line([[470, yy], [560, yy]], 'wr');
      s += '<line class="w' + (O.on[y[0]] ? '' : ' dim') + '" x1="270" y1="' + yy + '" x2="250" y2="' + (y[2] === 'COM0' ? 110 : 290) + '"/>';
      if (f) flows.push([[560, yy], [470, yy], [400, yy], [290, yy], [270, yy], [250, y[2] === 'COM0' ? 110 : 290], [290, y[2] === 'COM0' ? 110 : 290], [610, y[2] === 'COM0' ? 110 : 290]]);
    });
    [['COM0', 110], ['COM4', 290]].forEach(function (c) {
      var to = com[c[0]] === '0' ? 610 : 560;
      s += '<text x="286" y="' + (c[1] - 4) + '" class="t" text-anchor="end">' + c[0] + '</text><circle cx="290" cy="' + c[1] + '" r="4" fill="currentColor"/>';
      s += line([[250, c[1]], [290, c[1]]], 'w') + line([[290, c[1]], [to, c[1]]], com[c[0]] === '0' ? 'wb' : 'wr');
      if (com[c[0]] !== '0') s += '<text x="420" y="' + (c[1] + 16) + '" class="bad">接到 ＋24V 了</text>';
    });
    s += '<text x="150" y="300" class="m">Y4～Y7 共用 COM4</text>';
    $('osch').innerHTML = s;
    startFlow(flows.map(function (p) { return { svg: $('osch'), pts: p }; }));
    var anyOnNoFlow = YS.filter(function (y) { return O.on[y[0]] && !r.flows[y[0]]; }).map(function (y) { return y[0]; });
    $('ost').innerHTML = '<div' + (r.com4 > 0.8 ? ' class="warn"' : '') + '>COM4 合計（Y4～Y7）<b>' + r.com4 + ' / 0.8 A</b></div>' +
      YS.map(function (y) { var a = r.flows[y[0]] ? O.amp[y[0]] : 0; return '<div' + (a > 0.5 ? ' class="warn"' : '') + '>' + y[0] + '<b>' + r2(a) + ' A</b></div>'; }).join('');
    var msg = [];
    if (anyOnNoFlow.length) msg.push(anyOnNoFlow.join('、') + ' 的 OUT 燈亮了，負載卻不動：它的 COM 接到 ＋24V，負載兩端都是 24V，沒有電壓差，電流流不過去。漏型輸出的 COM 要接 0V。');
    msg = msg.concat(r.warn.map(function (w) { return '⚠ ' + w + '。'; }));
    if (!msg.length) msg.push('電流從 ＋24V → 電磁閥 → Y → PLC 內部電晶體 → COM → 0V。COM4 合計 ' + r.com4 + ' A，在 0.8 A 以內。');
    say('osay', msg.join(' '), anyOnNoFlow.length || r.warn.length ? 'bad' : 'ok');
  }
  $('ocom0').onchange = drawOut; $('ocom4').onchange = drawOut;
  renderYs();

  /* =====================================================================
     3. 急停接常閉
     ===================================================================== */
  /* 純函式：kind = 'nc'（常閉＋LD）或 'no'（常開＋LDI）。回傳 {x, run} */
  function estop(kind, pressed, broken) {
    var closed = kind === 'nc' ? !pressed && !broken : pressed && !broken;
    var x = closed;
    return { x: x, run: kind === 'nc' ? x : !x };
  }
  var N = { pressed: false };
  function ncSvg(kind) {
    var cut = $('ncut').checked, r = estop(kind, N.pressed, cut), s = '', closed = r.x;
    s += line([[20, 40], [400, 40]], 'p24') + '<text x="24" y="32" class="t">＋24V</text>' + line([[20, 230], [400, 230]], 'p0') + '<text x="24" y="250" class="t">0V</text>';
    s += '<rect class="box" x="150" y="80" width="130" height="100" rx="6"/><text x="215" y="100" text-anchor="middle" class="t">FX3S</text>';
    s += line([[100, 40], [100, 130], [150, 130]], 'wr') + '<text x="104" y="70" class="m">S/S</text>';
    s += line([[150, 130], [280, 130]], 'w') + '<circle class="lamp' + (r.x ? ' on' : '') + '" cx="215" cy="152" r="7"/><text x="228" y="156" class="m">IN13</text><text x="276" y="124" class="t" text-anchor="end">X13</text>';
    s += line([[280, 130], [340, 130], [340, 150]], 'w') + line([[340, 200], [340, 230]], 'wb');
    if (cut) s += '<line class="cut" x1="300" y1="118" x2="318" y2="142"/><text x="292" y="114" class="bad">斷線</text>';
    /* 按鈕：常閉（平常接通）／常開（平常斷開） */
    s += '<line class="w" x1="' + (closed ? 340 : 354) + '" y1="150" x2="340" y2="200"/>';
    s += '<text x="352" y="180" class="m">' + (kind === 'nc' ? '急停（常閉）' : '急停（常開）') + '</text>';
    /* 程式的一行 */
    var cy = 275, contactOn = kind === 'nc' ? r.x : !r.x;
    s += '<line class="w" x1="420" y1="' + (cy - 20) + '" x2="420" y2="' + (cy + 20) + '"/><line class="w" x1="420" y1="' + cy + '" x2="470" y2="' + cy + '"/>';
    s += '<line class="w" x1="470" y1="' + (cy - 12) + '" x2="470" y2="' + (cy + 12) + '"/><line class="w" x1="486" y1="' + (cy - 12) + '" x2="486" y2="' + (cy + 12) + '"/>' + (kind === 'no' ? '<line class="w" x1="466" y1="' + (cy + 12) + '" x2="490" y2="' + (cy - 12) + '"/>' : '');
    s += '<text x="478" y="' + (cy - 16) + '" text-anchor="middle" class="t">X13</text>';
    s += '<line class="' + (contactOn ? 'wr' : 'w dim') + '" x1="486" y1="' + cy + '" x2="560" y2="' + cy + '"/><text x="566" y="' + (cy + 4) + '" class="t">' + (r.run ? '可運轉' : '停機') + '</text>';
    s += '<text x="420" y="' + (cy - 30) + '" class="m">程式：' + (kind === 'nc' ? 'LD X13（常開接點）' : 'LDI X13（常閉接點）') + '</text>';
    return { s: s, r: r };
  }
  function drawNc() {
    stopFlow();
    var A = ncSvg('nc'), Bv = ncSvg('no'), flows = [];
    $('nschA').setAttribute('viewBox', '0 0 640 300'); $('nschB').setAttribute('viewBox', '0 0 640 300');
    $('nschA').innerHTML = A.s; $('nschB').innerHTML = Bv.s;
    var path = [[20, 40], [100, 40], [100, 130], [280, 130], [340, 130], [340, 230], [400, 230]];
    if (A.r.x) flows.push({ svg: $('nschA'), pts: path });
    if (Bv.r.x) flows.push({ svg: $('nschB'), pts: path });
    startFlow(flows);
    var cut = $('ncut').checked, msg;
    if (cut) msg = '線斷了：左邊 X13 變 OFF，程式的常開接點打開，<停機>，安全；右邊 X13 本來就是 OFF，LDI 照樣導通，還在「可運轉」，按急停也沒用（按下去電流還是過不來）。';
    else if (N.pressed) msg = '按下急停：左邊常閉打開，X13 從 ON 變 OFF，停機；右邊常開閉合，X13 變 ON，LDI 打開，也停機。兩種接法按下時都會停。';
    else msg = '平常：左邊常閉按鈕接通，X13 是 ON（IN13 燈亮），程式用常開接點 LD X13 導通。右邊 X13 是 OFF，靠 LDI 導通。看起來都能跑，差別在斷線時。';
    say('nsay', msg.replace(/[<>]/g, ''), cut ? 'bad' : '');
  }
  holdButton($('npress'), function (v) { N.pressed = v; drawNc(); });
  $('ncut').onchange = drawNc;

  window.addEventListener('resize', function () { /* SVG 自己縮放，不用重畫 */ });

  /* =====================================================================
     4. 猜一猜
     ===================================================================== */
  var GENS = [
    function () { var a = '漏型，配 NPN 感測器'; return { q: 'FX3S 的 <b>S/S 接 24V</b>，是哪一種輸入、配哪一種感測器？', ans: a, wrong: distinct(a, ['源型，配 PNP 感測器', '漏型，配 PNP 感測器', '源型，配 NPN 感測器']), ex: 'S/S 接 24V＝漏型，X 被拉到 0V 才 ON，配 NPN。' }; },
    function () { var a = '源型，配 PNP 感測器'; return { q: 'FX3S 的 <b>S/S 接 0V</b>，是哪一種輸入、配哪一種感測器？', ans: a, wrong: distinct(a, ['漏型，配 NPN 感測器', '漏型，配 PNP 感測器', '源型，配 NPN 感測器']), ex: 'S/S 接 0V＝源型，感測器把 24V 送進 X，配 PNP。' }; },
    function () {
      var c = pickOne([['24', 'pnp', 'PNP'], ['0', 'npn', 'NPN']]), a = 'IN 燈不亮，X 一直是 OFF';
      return { q: 'S/S 接 ' + c[0] + 'V，接了一個 <b>' + c[2] + '</b> 感測器，感測到工件時？', ans: a, wrong: distinct(a, ['IN 燈亮，正常', 'IN 燈閃爍', 'PLC 當機']), ex: inputResult(c[0], c[1], true).why };
    },
    function () { var a = '不行，S/S 只有一個，整台只能選一種'; return { q: '同一台 FX3S，可以一部分接 NPN、一部分接 PNP 感測器嗎？', ans: a, wrong: distinct(a, ['可以，每一點自己選', '可以，只要分開 COM', '可以，PNP 接在 X10 以後']), ex: '輸入的漏型／源型由唯一的 S/S 決定。' }; },
    function () { var a = '0V'; return { q: '漏型輸入（S/S 接 24V），按鈕一端接 X0，另一端要接？', ans: a, wrong: distinct(a, ['24V', 'S/S', 'COM0']), ex: '漏型要把 X 拉到 0V 才有電流。' }; },
    function () { var a = '棕＝24V、藍＝0V、黑＝訊號接 X'; return { q: '三線式感測器的三條線怎麼接？', ans: a, wrong: distinct(a, ['棕＝0V、藍＝24V、黑＝訊號接 X', '棕＝訊號、藍＝0V、黑＝24V', '黑＝24V、藍＝0V、棕＝訊號']), ex: 'NPN、PNP 都一樣，差在感測器動作時黑線接到哪一邊。' }; },
    function () { var a = '0V'; return { q: 'FX3S-20MT/ES 是電晶體漏型輸出，COM 要接外部電源的？', ans: a, wrong: distinct(a, ['＋24V', 'S/S', '不用接']), ex: '負載一端接 ＋24V、另一端接 Y，COM 接 0V。' }; },
    function () { var a = 'OUT 燈亮，但負載不動'; return { q: '電晶體漏型輸出，COM4 誤接到 ＋24V。程式讓 Y5 ON，會？', ans: a, wrong: distinct(a, ['負載正常動作', '負載一直動作，關不掉', 'PLC 自動切成源型']), ex: '負載兩端都是 24V，沒有電壓差，電流流不過去。' }; },
    function () { var a = '＋24V → 負載 → Y → COM → 0V'; return { q: '漏型電晶體輸出 ON 時，電流的路徑是？', ans: a, wrong: distinct(a, ['0V → 負載 → Y → COM → ＋24V', 'Y → S/S → 0V', '＋24V → COM → Y → 負載 → 0V']), ex: 'Y ON 時，PLC 內部電晶體把 Y 接通到 COM。' }; },
    function () {
      var each = pickOne([0.15, 0.2, 0.25, 0.3]), n = pickOne([3, 4]), tot = r2(each * n), a = tot > 0.8 ? '超過 0.8 A，不行' : '沒超過 0.8 A，可以';
      return { q: 'Y4～Y7 共用 COM4，同時有 ' + n + ' 個電磁閥 ON，每個 ' + each + ' A（假設值，實際看型錄），合計？', ans: a, wrong: distinct(a, ['超過 0.8 A，不行', '沒超過 0.8 A，可以', '只要每點沒超過 0.5 A，不用算合計', '要看 COM0 的電流']), ex: n + ' × ' + each + ' = ' + tot + ' A。COM4 四點合計只能 0.8 A，每點也不能超過 0.5 A。' };
    },
    function () { var a = 'Y0～Y3 各自一個 COM，Y4～Y7 共用 COM4'; return { q: 'FX3S-20MT/ES 的輸出共點怎麼分組？', ans: a, wrong: distinct(a, ['Y0～Y7 全部共用一個 COM', '每兩點一個 COM', 'Y0～Y3 共用 COM0，Y4～Y7 各自一個 COM']), ex: 'COM0～COM3 對 Y0～Y3，COM4 對 Y4～Y7。' }; },
    function () { var a = '0.5 A'; return { q: 'FX3S 電晶體輸出，每一點最大電流？', ans: a, wrong: distinct(a, ['0.8 A', '2 A', '5 A', '0.05 A']), ex: '每點 0.5 A；Y4～Y7 共用 COM4 時四點合計 0.8 A。' }; },
    function () { var a = '常閉按鈕，程式用常開接點 LD X13'; return { q: '急停按鈕接到 X13，正確的做法？', ans: a, wrong: distinct(a, ['常開按鈕，程式用常閉接點 LDI X13', '常閉按鈕，程式用常閉接點 LDI X13', '常開按鈕，程式用常開接點 LD X13']), ex: '課程 A9：現場常閉 ≠ 程式常閉。平常 X13 是 ON，按下或斷線都變 OFF。' }; },
    function () { var a = 'X13 變 OFF，機器停下來'; return { q: '急停接常閉、程式用 LD X13。如果急停的電線斷了？', ans: a, wrong: distinct(a, ['X13 保持 ON，機器照跑', 'X13 變 ON，機器停下來', 'PLC 報錯當機']), ex: '斷線和按下急停效果一樣，這就是急停要接常閉的原因。' }; },
    function () { var a = '機器照跑，急停失效'; return { q: '急停接<b>常開</b>、程式用 LDI X13。電線斷了之後按急停，會？', ans: a, wrong: distinct(a, ['機器停下來', 'X13 變 ON', 'PLC 自動切換成常閉']), ex: '線斷了按鈕按下也送不進訊號，X13 一直 OFF，LDI 一直導通。' }; },
    function () { var a = '約 10 ms'; return { q: 'FX3S 一般輸入的響應時間大約是？', ans: a, wrong: distinct(a, ['約 1 秒', '約 100 ms', '約 0.01 ms']), ex: '輸入響應約 10 ms，比這更短的訊號一般輸入可能抓不到。' }; }
  ];
  function gen() { return pickOne(GENS)(); }

  /* ---------- 初始化 ---------- */
  show(/^#(in|out|nc)$/.test(location.hash) ? location.hash.slice(1) : 'in');
  window.SinkLab = {
    inputResult: inputResult, outCheck: outCheck, estop: estop, show: show, stopFlow: stopFlow,
    state: { input: I, output: O, nc: N }, GENS: GENS, gen: gen,
    quiz: window.LabQuiz ? window.LabQuiz('squiz', gen) : null
  };
})();
