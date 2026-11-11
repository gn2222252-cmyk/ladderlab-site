/* 掃描週期實驗室：掃描三步驟、慢一圈、雙線圈、太短的輸入與看門狗、猜一猜
   掃描順序照 engine/plc_engine.py：讀輸入（x = x_in）→ 由上往下執行 → 寫輸出（y_out = y）。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function Tab() { return { gen: 0, timer: null, resume: false }; }
  function later(T, fn, ms) { var g = T.gen; return setTimeout(function () { if (T.gen === g) fn(); }, ms); }
  function logTo(id, s) { var l = $(id); l.insertBefore(el('div', '', s), l.firstChild); while (l.children.length > 200) l.removeChild(l.lastChild); }

  function fly(T, host, from, to, html, delay) {
    if (reduce || !host || !from || !to) return;
    later(T, function () {
      if (host.offsetParent === null || document.hidden) return;
      var hb = host.getBoundingClientRect(), fb = from.getBoundingClientRect(), tb = to.getBoundingClientRect();
      if (!fb.width || !tb.width) return;
      var e = el('span', 'scbit on mfly', html); host.appendChild(e);
      var ew = e.offsetWidth, eh = e.offsetHeight, maxX = Math.max(0, hb.width - ew);
      var cx = function (b) { return Math.min(maxX, Math.max(0, b.left - hb.left + b.width / 2 - ew / 2)); };
      var cy = function (b) { return b.top - hb.top + Math.min(b.height / 2, 40) - eh / 2; };
      e.style.left = cx(fb) + 'px'; e.style.top = cy(fb) + 'px';
      e.getBoundingClientRect();
      e.style.transition = 'left 420ms ease-in-out, top 420ms ease-in-out';
      e.style.left = cx(tb) + 'px'; e.style.top = cy(tb) + 'px';
      setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 500);
    }, delay || 0);
  }

  /* ---------- 小型梯形圖機器 ----------
     一行 = { main: [接點…], par: 跟第一個接點並聯的接點或 null, coil: {op:'OUT', d}, il }
     接點 = { d: 'X000', nc: 常閉? }。結果 = (main[0] 或 par) 而且 main[1..] 全部通。 */
  function C(d, nc) { return { d: d, nc: !!nc }; }
  function ilOf(r) {
    var a = [(r.main[0].nc ? 'LDI ' : 'LD ') + r.main[0].d];
    if (r.par) a.push((r.par.nc ? 'ORI ' : 'OR ') + r.par.d);
    r.main.slice(1).forEach(function (c) { a.push((c.nc ? 'ANI ' : 'AND ') + c.d); });
    a.push(r.coil.op + ' ' + r.coil.d);
    return a.join(' / ');
  }

  function Machine(o) {
    var pre = o.pre, T = Tab(), S = null, box = $(pre + '-box');
    var X = o.inputs.map(function (x) { return x[0]; }), Y = o.outputs.map(function (y) { return y[0]; }), MS = o.ms || [];
    var LBL = {}; o.inputs.concat(o.outputs).forEach(function (a) { LBL[a[0]] = a[1]; }); (o.mlabels || []).forEach(function (a) { LBL[a[0]] = a[1]; });
    box.innerHTML = '<div class="sccol"><div class="scp" id="' + pre + '-px"><h4>實體輸入 <small>X 端子</small></h4><div class="scbits"></div></div>' +
      '<div class="scp" id="' + pre + '-ix"><h4>輸入映像 <small>程式只看這裡</small></h4><div class="scbits"></div></div></div>' +
      '<div class="sccol"><div class="scp" id="' + pre + '-prog"><h4>程式 <small>由上往下一行一行算</small></h4><div></div></div>' +
      (MS.length ? '<div class="scp" id="' + pre + '-mm"><h4>內部繼電器 M <small>（也是記憶體）</small></h4><div class="scbits"></div></div>' : '') + '</div>' +
      '<div class="sccol"><div class="scp" id="' + pre + '-iy"><h4>輸出映像 <small>OUT 寫這裡</small></h4><div class="scbits"></div></div>' +
      '<div class="scp" id="' + pre + '-py"><h4>實體輸出 <small>Y 端子</small></h4><div class="scbits"></div></div></div>';
    var P = {}; ['px', 'ix', 'prog', 'mm', 'iy', 'py'].forEach(function (k) { P[k] = $(pre + '-' + k); });
    var inRow = $(pre + '-in'), btn = {};
    inRow.innerHTML = '<span class="small">按鈕（按一下＝按住，再按一下＝放開）：</span>';
    o.inputs.forEach(function (x) {
      var b = el('button', 'btnx', ''); b.type = 'button'; btn[x[0]] = b;
      b.onclick = function () { press(x[0], !S.phys[x[0]]); };
      inRow.appendChild(b);
    });
    function lg(s) { logTo(pre + '-log', '<span class="kv">第 ' + S.scan + ' 圈</span> ' + s); }

    function reset() {
      if (T.timer) { clearInterval(T.timer); T.timer = null; }
      T.resume = false; T.gen++;
      S = { phys: {}, img: {}, out: {}, p: 0, last: -1, scan: 1, rows: o.prog(), ev: {}, reads: {}, rec: [], trail: [], flash: {} };
      X.forEach(function (d) { S.phys[d] = 0; S.img[d] = 0; });
      Y.concat(MS).forEach(function (d) { S.img[d] = 0; });
      Y.forEach(function (d) { S.out[d] = 0; });
      $(pre + '-log').innerHTML = '';
      lg('停在第 1 圈開頭。按「走一步」或 ▶。');
      draw();
    }
    function press(d, v) {
      S.phys[d] = v ? 1 : 0;
      var where = S.last < 0 || S.p === 0 ? '輸入刷新之前' : S.p <= S.rows.length ? '程式執行到一半（第 ' + S.p + ' 行之前）' : '輸出刷新之前';
      lg('實體 ' + d + (v ? ' ON' : ' OFF') + '（' + where + '）。輸入映像要等' + (S.p === 0 ? '<b>這一圈開頭</b>' : '<b>下一圈</b>') + '的輸入刷新才會變');
      draw();
    }
    function step() {
      var n = S.rows.length, p = S.p;
      S.flash = {};
      if (p === 0) {
        S.ev = {}; S.reads = {}; S.trail = [];
        var ch = [];
        X.forEach(function (d) { if (S.img[d] !== S.phys[d]) { ch.push(d); S.flash[d] = 1; } S.img[d] = S.phys[d]; });
        ch.forEach(function (d, k) { fly(T, box, P.px, P.ix, d + '=' + S.phys[d], k * 120); });
        lg('<b>① 輸入刷新</b>：把 X 端子拍照存進輸入映像' + (ch.length ? '（' + ch.map(function (d) { return d + ' → ' + S.img[d]; }).join('、') + '）' : '（沒有變化）'));
      } else if (p <= n) {
        var r = S.rows[p - 1], get = function (c) { if (!(c.d in S.reads)) S.reads[c.d] = S.img[c.d]; var v = S.img[c.d] ? 1 : 0; return c.nc ? !v : !!v; };
        var cs = r.main.map(get), pv = r.par ? get(r.par) : false;
        var res = (cs[0] || pv) && cs.slice(1).every(Boolean);
        S.ev[p - 1] = { cs: cs, pv: pv, res: res };
        var before = S.img[r.coil.d];
        S.img[r.coil.d] = res ? 1 : 0; S.flash[r.coil.d] = 1;
        S.trail.push({ row: p, d: r.coil.d, v: S.img[r.coil.d], reads: r.main.concat(r.par ? [r.par] : []).map(function (c) { return c.d + '=' + S.img[c.d]; }) });
        lg('<b>② 第 ' + p + ' 行</b>：' + ilOf(r) + ' → 條件' + (res ? '成立' : '不成立') + '，映像 ' + r.coil.d + ' = ' + S.img[r.coil.d] + (before !== S.img[r.coil.d] ? '（變了）' : ''));
      } else {
        var chg = [];
        Y.forEach(function (d) { if (S.out[d] !== S.img[d]) { chg.push(d); S.flash['o' + d] = 1; } S.out[d] = S.img[d]; });
        chg.forEach(function (d, k) { fly(T, box, P.iy, P.py, d + '=' + S.out[d], k * 120); });
        lg('<b>③ 輸出刷新</b>：輸出映像一次送到 Y 端子' + (chg.length ? '（' + chg.map(function (d) { return d + ' → ' + S.out[d]; }).join('、') + '）' : '（沒有變化）'));
        var rec = { scan: S.scan, img: {}, out: {}, reads: {}, trail: S.trail.slice() };
        Object.keys(S.img).forEach(function (k) { rec.img[k] = S.img[k]; });
        Object.keys(S.out).forEach(function (k) { rec.out[k] = S.out[k]; });
        Object.keys(S.reads).forEach(function (k) { rec.reads[k] = S.reads[k]; });
        S.rec.push(rec); if (S.rec.length > 60) S.rec.shift();
        S.scan++;
      }
      S.last = p; S.p = (p + 1) % (n + 2);
      draw();
    }
    function scanOnce() { do { step(); } while (S.p !== 0); }
    function bitsHtml(list, src, prefix, diffWith) {
      return list.map(function (d) {
        var v = src[d], diff = diffWith && diffWith[d] !== v;
        return '<span class="scbit' + (v ? ' on' : '') + (diff ? ' diff' : '') + (S.flash[(prefix || '') + d] ? ' flash' : '') + '">' + d + ' = ' + v + '<small>' + (LBL[d] || '') + '</small></span>';
      }).join('');
    }
    function cellHtml(c, on, coil) {
      return '<span class="scc' + (coil ? ' coil' : '') + (on ? ' on' : '') + '"><span class="sym">' + (coil ? c.d : (c.nc ? '/' : '') + c.d) + '</span><small>' + (LBL[c.d] || '') + '</small></span>';
    }
    function draw() {
      var n = S.rows.length, run = !!T.timer, p = S.p;
      // 指示列
      var names = ['① 輸入刷新'].concat(S.rows.map(function (r, i) { return '② 第 ' + (i + 1) + ' 行'; })).concat(['③ 輸出刷新']);
      $(pre + '-phase').innerHTML = names.map(function (nm, i) { return '<span class="' + (i === S.last ? 'on' : '') + '">' + nm + '</span>'; }).join('');
      // 映像
      P.px.querySelector('.scbits').innerHTML = X.map(function (d) {
        var v = S.phys[d], diff = S.img[d] !== v;
        return '<span class="scbit' + (v ? ' on' : '') + (diff ? ' diff' : '') + '">' + d + ' = ' + v + '<small>' + (diff ? '映像還沒跟上' : LBL[d] || '') + '</small></span>';
      }).join('');
      P.ix.querySelector('.scbits').innerHTML = bitsHtml(X, S.img);
      P.iy.querySelector('.scbits').innerHTML = bitsHtml(Y, S.img);
      if (P.mm) P.mm.querySelector('.scbits').innerHTML = bitsHtml(MS, S.img);
      P.py.querySelector('.scbits').innerHTML = Y.map(function (d) { return '<span class="lamp2' + (S.out[d] ? ' on' : '') + (S.flash['o' + d] ? ' scbit flash' : '') + '"><i></i>' + d + '<small>' + (LBL[d] || '') + '</small></span>'; }).join('');
      P.ix.className = 'scp' + (S.last === 0 ? ' hot' : ''); P.py.className = 'scp' + (S.last === n + 1 ? ' hot' : ''); P.iy.className = 'scp' + (S.last > 0 && S.last <= n ? ' hot' : '');
      // 程式
      var h = '';
      S.rows.forEach(function (r, i) {
        var e = S.ev[i], doneRow = !!e, cur = S.last === i + 1;
        var cls = 'scr' + (cur ? ' cur' : '') + (!doneRow && S.last >= 0 && S.last <= n && p !== 0 ? ' wait' : '');
        h += '<div class="' + cls + '"><span class="no">第 ' + (i + 1) + ' 行</span><div class="sclad"><span class="scrail"></span><span class="scw"></span>';
        if (r.par) h += '<span class="scpar">' + cellHtml(r.main[0], e && e.cs[0]) + cellHtml(r.par, e && e.pv) + '</span>';
        else h += cellHtml(r.main[0], e && e.cs[0]);
        r.main.slice(1).forEach(function (c, k) { h += '<span class="scw"></span>' + cellHtml(c, e && e.cs[k + 1]); });
        h += '<span class="scw"></span>' + cellHtml(r.coil, e && e.res, true) + '<span class="scw"></span><span class="scrail"></span></div>';
        h += '<div class="scil">' + ilOf(r) + '</div><div class="scres">' + (e ? '這一圈算過：' + r.coil.d + ' = ' + (e.res ? 1 : 0) : S.last >= 0 && S.last <= n && p !== 0 ? '這一圈還沒算到（映像裡是上一圈的值）' : '') + '</div></div>';
      });
      P.prog.querySelector('div').innerHTML = h;
      P.prog.className = 'scp' + (S.last > 0 && S.last <= n ? ' hot' : '');
      // 紀錄表
      var cols = o.cols, recs = S.rec.slice(-8);
      $(pre + '-tbl').innerHTML = recs.length ? '<table class="tbl"><thead><tr>' + cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
        recs.map(function (r) { return '<tr>' + cols.map(function (c) { var v = c[1](r); return '<td class="' + (v === 1 ? 'on' : '') + '">' + v + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>' : '<span class="why">每跑完一圈，這裡多一列紀錄。</span>';
      $(pre + '-n').textContent = S.scan;
      $(pre + '-run').textContent = run ? '⏸ 暫停' : '▶ 開始';
      X.forEach(function (d) { btn[d].classList.toggle('on', !!S.phys[d]); btn[d].textContent = d + ' ' + (LBL[d] || '') + '：' + (S.phys[d] ? '按住中' : '放開'); });
      if (o.after) o.after(S, api);
    }
    function speed() { return +$(pre + '-speed').value; }
    function start() { if (!T.timer) { T.timer = setInterval(step, speed()); draw(); } }
    function stop() { if (T.timer) { clearInterval(T.timer); T.timer = null; draw(); } }
    $(pre + '-run').onclick = function () { if (T.timer) stop(); else start(); };
    $(pre + '-step').onclick = step;
    if ($(pre + '-scan')) $(pre + '-scan').onclick = scanOnce;
    $(pre + '-reset').onclick = reset;
    $(pre + '-speed').onchange = function () { if (T.timer) { clearInterval(T.timer); T.timer = setInterval(step, speed()); } };
    var api = { T: T, reset: reset, step: function (k) { for (var i = 0; i < (k || 1); i++) step(); return S; }, scanOnce: function (k) { for (var i = 0; i < (k || 1); i++) scanOnce(); return S; },
      press: press, S: function () { return S; }, running: function () { return !!T.timer; }, start: start, stop: stop, draw: draw,
      pause: function (off) { if (off) { if (T.timer) { stop(); T.resume = true; } } else if (T.resume) { T.resume = false; start(); } } };
    reset();
    return api;
  }

  var tabs = $('tabs'), cur = 'scan';

  /* ======================================================================
     1. 掃描三步驟
     ====================================================================== */
  var M1 = Machine({ pre: 's', inputs: [['X000', '啟動'], ['X001', '停止'], ['X002', '按鈕']], outputs: [['Y000', '馬達'], ['Y001', '燈'], ['Y002', '運轉燈']],
    prog: function () { return [
      { main: [C('X000'), C('X001', true)], par: C('Y000'), coil: { op: 'OUT', d: 'Y000' } },
      { main: [C('X002')], par: null, coil: { op: 'OUT', d: 'Y001' } },
      { main: [C('Y000')], par: null, coil: { op: 'OUT', d: 'Y002' } }]; },
    cols: [['圈', function (r) { return r.scan; }], ['X0', function (r) { return r.img.X000; }], ['X1', function (r) { return r.img.X001; }], ['X2', function (r) { return r.img.X002; }], ['Y0 馬達', function (r) { return r.out.Y000; }], ['Y1 燈', function (r) { return r.out.Y001; }], ['Y2 運轉燈', function (r) { return r.out.Y002; }]],
    after: function (S) {
      var n = S.rows.length, diff = ['X000', 'X001', 'X002'].filter(function (d) { return S.phys[d] !== S.img[d]; });
      if (diff.length && S.last >= 0 && S.p !== 0) say('s-say', '實體 ' + diff.join('、') + ' 已經變了，可是輸入映像還是舊的：這一圈剩下的程式都看不到，要等下一圈的 ① 輸入刷新。');
      else if (diff.length) say('s-say', '實體 ' + diff.join('、') + ' 變了，下一步就是 ① 輸入刷新，馬上會被拍進映像。');
      else if (S.last === n + 1) say('s-say', '一圈結束：輸出映像一次送到 Y 端子，接著馬上開始下一圈。');
      else if (S.last > 0 && S.img.Y000 !== S.out.Y000) say('s-say', '輸出映像的 Y0 已經是 ' + S.img.Y000 + '，可是實體 Y0 還是 ' + S.out.Y000 + '：要等這一圈的 ③ 輸出刷新才送出去。');
      else say('s-say', '');
    } });

  /* ======================================================================
     2. 慢一圈
     ====================================================================== */
  function lateProg() {
    var rd = { main: [C('M0')], par: null, coil: { op: 'OUT', d: 'Y000' } }, wr = { main: [C('X000')], par: null, coil: { op: 'OUT', d: 'M0' } }, cmp = { main: [C('X000')], par: null, coil: { op: 'OUT', d: 'Y001' } };
    return $('l-swap').checked ? [wr, rd, cmp] : [rd, wr, cmp];
  }
  function firstScan(recs, f) { for (var i = 0; i < recs.length; i++) if (f(recs[i])) return recs[i].scan; return null; }
  var M2 = Machine({ pre: 'l', inputs: [['X000', '按鈕']], outputs: [['Y000', '看 M0'], ['Y001', '直接看 X0']], ms: ['M0'], mlabels: [['M0', '由 X0 寫']],
    prog: lateProg,
    cols: [['圈', function (r) { return r.scan; }], ['X0 映像', function (r) { return r.img.X000; }], ['讀 M0 時是', function (r) { return r.reads.M0; }], ['M0（算完）', function (r) { return r.img.M0; }], ['Y0', function (r) { return r.out.Y000; }], ['Y1', function (r) { return r.out.Y001; }]],
    after: function (S) {
      var R = S.rec, on1 = firstScan(R, function (r) { return r.out.Y001 === 1; }), on0 = firstScan(R, function (r) { return r.out.Y000 === 1; });
      var swap = $('l-swap').checked;
      if (on1 != null && on0 != null) {
        var d = on0 - on1;
        say('l-say', d > 0 ? 'Y1 在第 ' + on1 + ' 圈亮，Y0 在第 ' + on0 + ' 圈才亮：<b>慢一圈</b>。讀 M0 的那一行在寫 M0 的那一行上面，第 ' + on1 + ' 圈讀到的是上一圈留下的 M0 = 0。' : 'Y0 和 Y1 都在第 ' + on1 + ' 圈亮：' + (swap ? '先寫 M0 再讀，同一圈就拿到新值。' : '同一圈。'), d > 0 ? 'bad' : 'ok');
      } else if (on1 != null) say('l-say', 'Y1 已經亮了（第 ' + on1 + ' 圈），Y0 呢？再走一圈看看。');
      else say('l-say', swap ? '現在第 1 行先寫 M0，第 2 行再讀 M0。' : '現在第 1 行先讀 M0，M0 到第 2 行才寫。');
    } });
  $('l-swap').onchange = function () { M2.reset(); };

  /* ======================================================================
     3. 雙線圈
     ====================================================================== */
  function dblProg() {
    if ($('d-fix').checked) return [
      { main: [C('X000')], par: C('X001'), coil: { op: 'OUT', d: 'Y000' } },
      { main: [C('Y000')], par: null, coil: { op: 'OUT', d: 'Y002' } }];
    return [
      { main: [C('X000')], par: null, coil: { op: 'OUT', d: 'Y000' } },
      { main: [C('Y000')], par: null, coil: { op: 'OUT', d: 'Y002' } },
      { main: [C('X001')], par: null, coil: { op: 'OUT', d: 'Y000' } }];
  }
  var M3 = Machine({ pre: 'd', inputs: [['X000', '條件 A'], ['X001', '條件 B']], outputs: [['Y000', '寫了兩次？'], ['Y002', '讀 Y0']],
    prog: dblProg,
    cols: [['圈', function (r) { return r.scan; }], ['X0', function (r) { return r.img.X000; }], ['X1', function (r) { return r.img.X001; }], ['第 1 行寫 Y0', function (r) { var t = r.trail.filter(function (x) { return x.d === 'Y000'; }); return t.length ? t[0].v : '—'; }], ['最後寫 Y0', function (r) { var t = r.trail.filter(function (x) { return x.d === 'Y000'; }); return t.length ? t[t.length - 1].v : '—'; }], ['實體 Y0', function (r) { return r.out.Y000; }], ['實體 Y2', function (r) { return r.out.Y002; }]],
    after: function (S) {
      var t = S.trail;
      $('d-trail').innerHTML = t.length ? '這一圈的輸出映像：' + t.map(function (x) { return '第 ' + x.row + ' 行 ' + (x.d === 'Y002' ? '讀 Y0 → Y2 = ' + x.v : 'OUT Y0 = ' + x.v); }).join(' → ') + (S.last === S.rows.length + 1 ? ' → <b>輸出刷新送出 Y0 = ' + S.out.Y000 + '</b>' : '') : '';
      var last = S.rec[S.rec.length - 1];
      if (!last) { say('d-say', ''); return; }
      if (!$('d-fix').checked && last.img.X000 && !last.img.X001) say('d-say', '條件 A 成立，可是第 3 行又把 Y0 寫回 0，實體 Y0 不亮。更怪的是第 2 行讀 Y0 時映像還是 1，所以 <b>Y2 亮了</b>：同一圈裡 Y0 的映像先 1 後 0，看你在哪一行讀。', 'bad');
      else if (!$('d-fix').checked && last.img.X001) say('d-say', '條件 B 在最後一行，它說了算：實體 Y0 = 1。' + (last.img.X000 ? '' : '可是第 1 行先把映像寫成 0，第 2 行讀到 0，所以 <b>Y2 不亮</b>：實體 Y0 亮、讀 Y0 的 Y2 卻不亮，兩個對不上。'), last.img.X000 ? '' : 'bad');
      else if ($('d-fix').checked) say('d-say', '只寫一次 OUT Y0：A 或 B 任一個成立，Y0 就亮，第 2 行讀到的 Y0 也和實體一致。', 'ok');
      else say('d-say', '');
    } });
  $('d-fix').onchange = function () { M3.reset(); };

  /* ======================================================================
     4. 太短的輸入、看門狗
     ====================================================================== */
  var TT = Tab(), TR = 10, TS = null;
  function tScan() { return +$('t-scanms').value; }
  function tW() { return +$('t-w').value; }
  function tMake(W, Sc, start, phase) {
    var win = Math.max(6 * Sc, W + 4 * Sc + TR + 10);
    if (start == null) start = Sc + Math.floor(Math.random() * Sc);
    if (phase == null) phase = Math.floor(Math.random() * Sc);
    var fOn = W > TR ? start + TR : null, fOff = start + W;
    var samples = [], got = null;
    for (var t = phase; t <= win; t += Sc) { var v = fOn != null && t >= fOn && t < fOff ? 1 : 0; samples.push({ t: t, v: v }); if (v && got == null) got = samples.length; }
    return { W: W, Sc: Sc, start: start, phase: phase, win: win, fOn: fOn, fOff: fOff, samples: samples, got: got, shown: 0 };
  }
  function tRule(W, Sc) { return W >= Sc + TR ? 'sure' : W <= TR ? 'never' : 'maybe'; }
  function tDraw() {
    var box = $('t-chart'), R = TS;
    var Wd = Math.floor(box.clientWidth - 8); if (Wd < 200) return;
    if (!R) { box.innerHTML = '<p class="why" style="margin:6px">按「▶ 按一下」，看按鈕的 ON 有沒有被輸入刷新拍到。</p>'; return; }
    var L = Wd < 480 ? 74 : 104, x = function (t) { return L + t * (Wd - L - 8) / R.win; }, rh = 26, y = 4, s = '', upto = R.shown;
    var row = function (name, f, c) {
      s += '<text x="4" y="' + (y + 17) + '">' + name + '</text>';
      var pts = [], prev = null;
      for (var t = 0; t <= upto; t++) { var v = f(t), yy = v ? y + 4 : y + rh - 4; if (prev !== null && prev !== yy) pts.push(x(t) + ',' + prev); pts.push(x(t) + ',' + yy); prev = yy; }
      if (pts.length > 1) s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + c + '" stroke-width="2"/>';
      y += rh;
    };
    var top = y;
    row('按鈕（實體）', function (t) { return t >= R.start && t < R.start + R.W; }, '#b45309');
    row('過了響應時間', function (t) { return R.fOn != null && t >= R.fOn && t < R.fOff; }, '#7c3aed');
    var sy = y; s += '<text x="4" y="' + (y + 17) + '">輸入刷新</text>'; y += rh;
    row('X 映像', function (t) { var v = 0; R.samples.forEach(function (p) { if (p.t <= t) v = p.v; }); return v; }, '#16a34a');
    R.samples.forEach(function (p, i) {
      if (p.t > upto) return;
      s += '<line x1="' + x(p.t) + '" y1="' + top + '" x2="' + x(p.t) + '" y2="' + y + '" stroke="currentColor" opacity=".15"/>';
      s += '<circle cx="' + x(p.t) + '" cy="' + (sy + rh / 2) + '" r="' + (p.v ? 6 : 4) + '" fill="' + (p.v ? '#16a34a' : 'none') + '" stroke="' + (p.v ? '#16a34a' : 'currentColor') + '" stroke-width="1.5"/>';
    });
    if (R.start <= upto) s += '<line x1="' + x(R.start) + '" y1="' + top + '" x2="' + x(R.start) + '" y2="' + (top + rh) + '" stroke="#b45309" stroke-dasharray="2 2"/>';
    s += '<line x1="' + x(upto) + '" y1="' + top + '" x2="' + x(upto) + '" y2="' + y + '" stroke="#f59e0b" stroke-width="2"/>';
    for (var t = 0; t <= R.win; t += (R.win > 150 ? 50 : 20)) s += '<text x="' + (x(t) - 4) + '" y="' + (y + 12) + '" opacity=".7">' + t + '</text>';
    s += '<text x="' + (Wd - 30) + '" y="' + (y + 12) + '" opacity=".7">ms</text>';
    y += 18;
    box.innerHTML = '<svg viewBox="0 0 ' + Wd + ' ' + y + '" width="' + Wd + '" height="' + y + '" role="img" aria-label="輸入時間軸">' + s + '</svg>';
  }
  function tVerdict() {
    var R = TS; if (!R) { say('t-say', ''); return; }
    if (R.shown < R.win) { say('t-say', ''); return; }
    var rule = tRule(R.W, R.Sc), txt = R.got ? '✔ 抓到了：第 ' + R.got + ' 次輸入刷新拍到 ON，程式看得到這次按鈕。' : '✖ 漏掉了：' + (R.fOn == null ? '按鈕只 ON ' + R.W + ' ms，還沒過輸入響應時間（約 ' + TR + ' ms）就放開了。' : '過了響應時間之後只剩 ' + (R.W - TR) + ' ms，剛好落在兩次輸入刷新中間，程式從頭到尾都沒看到。');
    txt += '　' + (rule === 'sure' ? 'ON ' + R.W + ' ms ≥ 掃描 ' + R.Sc + ' ms + 響應 ' + TR + ' ms，不管什麼時候按都抓得到。' : rule === 'never' ? '短於響應時間，這個模型裡一定抓不到。' : 'ON ' + R.W + ' ms 比「掃描 ' + R.Sc + ' + 響應 ' + TR + ' = ' + (R.Sc + TR) + ' ms」短，抓不抓得到看運氣。');
    say('t-say', txt, R.got ? 'ok' : 'bad');
  }
  function tGo(start, phase) {
    if (TT.timer) { clearInterval(TT.timer); TT.timer = null; }
    TT.gen++;
    TS = tMake(tW(), tScan(), start, phase);
    var per = Math.max(1, Math.round(TS.win / 90));
    TT.timer = setInterval(function () {
      TS.shown = Math.min(TS.win, TS.shown + per);
      tDraw();
      if (TS.shown >= TS.win) { clearInterval(TT.timer); TT.timer = null; tVerdict(); }
    }, 30);
    say('t-say', '');
  }
  function tFinish() { if (TT.timer) { clearInterval(TT.timer); TT.timer = null; } if (TS) { TS.shown = TS.win; tDraw(); tVerdict(); } }
  function tMany(n) {
    n = n || 20; var ok = 0, last = null;
    for (var i = 0; i < n; i++) { last = tMake(tW(), tScan()); if (last.got) ok++; }
    if (TT.timer) { clearInterval(TT.timer); TT.timer = null; }
    TT.gen++; TS = last; TS.shown = TS.win; tDraw(); tVerdict();
    var rule = tRule(tW(), tScan());
    $('t-stat').innerHTML = '連續試 ' + n + ' 次（每次按的時刻都不一樣）：抓到 <b>' + ok + '</b> 次、漏掉 <b>' + (n - ok) + '</b> 次。' + (rule === 'sure' ? '' : '　把 ON 時間拉到 ' + (tScan() + TR) + ' ms 以上再試。');
    return ok;
  }
  function tLabel() { $('t-wv').textContent = tW() + ' ms'; }
  $('t-go').onclick = function () { tGo(); }; $('t-many').onclick = function () { tMany(20); };
  $('t-reset').onclick = function () { if (TT.timer) { clearInterval(TT.timer); TT.timer = null; } TT.gen++; TS = null; $('t-stat').innerHTML = ''; tDraw(); say('t-say', ''); };
  $('t-w').oninput = tLabel; $('t-scanms').onchange = function () { $('t-stat').innerHTML = ''; };
  tLabel();

  var TW = Tab(), WD = { ms: 0, err: false, running: false };
  var WLIM = 200, WMAX = 400;
  function wLabel() { $('w-msv').textContent = $('w-ms').value + ' ms'; }
  function wDraw(cur) {
    $('w-lim').style.left = (WLIM / WMAX * 100) + '%';
    $('w-fill').style.width = (Math.min(cur, WMAX) / WMAX * 100) + '%';
    $('w-fill').className = 'fill' + (cur > WLIM ? ' bad' : '');
    $('w-lbl').style.left = '6px'; $('w-lbl').textContent = '這一圈 ' + Math.round(cur) + ' ms　｜　D8000 = ' + WLIM + ' ms';
  }
  function wRun(ms) {
    if (TW.timer) { clearInterval(TW.timer); TW.timer = null; }
    TW.gen++;
    ms = ms == null ? +$('w-ms').value : ms;
    WD = { ms: ms, err: false, running: true, cur: 0 };
    say('w-say', '');
    var stepMs = Math.max(2, ms / 60);
    TW.timer = setInterval(function () {
      WD.cur = Math.min(ms, WD.cur + stepMs);
      if (WD.cur > WLIM) { WD.cur = WLIM + 1; WD.err = true; }
      wDraw(WD.cur);
      if (WD.err || WD.cur >= ms) { clearInterval(TW.timer); TW.timer = null; WD.running = false; wVerdict(); }
    }, 25);
  }
  function wVerdict() {
    if (WD.err) say('w-say', '✖ 一圈還沒跑完就超過 D8000（' + WLIM + ' ms）：看門狗逾時，CPU 判定異常而停止運轉，輸出全部 OFF。程式裡不能有會卡住很久的迴圈。', 'bad');
    else say('w-say', '✔ 這一圈 ' + WD.ms + ' ms 就跑完了，END 時看門狗重新計時，下一圈照常。', 'ok');
  }
  function wFinish() { if (TW.timer) { clearInterval(TW.timer); TW.timer = null; WD.cur = WD.ms > WLIM ? WLIM + 1 : WD.ms; WD.err = WD.ms > WLIM; WD.running = false; wDraw(WD.cur); wVerdict(); } }
  $('w-ms').oninput = wLabel; $('w-go').onclick = function () { wRun(); };
  $('w-reset').onclick = function () { if (TW.timer) { clearInterval(TW.timer); TW.timer = null; } TW.gen++; WD = { ms: 0, err: false, running: false }; wDraw(0); say('w-say', ''); };
  wLabel(); wDraw(0);

  /* ---------- 分頁切換：看不到的分頁暫停 ---------- */
  var MACH = { scan: M1, late: M2, dbl: M3 };
  function sync() {
    Object.keys(MACH).forEach(function (k) { MACH[k].pause(cur !== k || document.hidden); });
    if (cur !== 'time' || document.hidden) { tFinish(); wFinish(); } else tDraw();
  }
  function show(t) {
    cur = t;
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['scan', 'late', 'dbl', 'time', 'quiz'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
    sync();
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  document.addEventListener('visibilitychange', sync);
  var rsz = null; window.addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(function () { if (cur === 'time') tDraw(); }, 150); });
  if (/^#(scan|late|dbl|time|quiz)$/.test(location.hash)) show(location.hash.slice(1));

  window.ScanLab = {
    show: show, current: function () { return cur; },
    scan: M1, late: M2, dbl: M3,
    time: { go: tGo, finish: tFinish, many: tMany, make: tMake, rule: tRule, S: function () { return TS; }, set: function (W, Sc) { $('t-w').value = W; if (Sc) $('t-scanms').value = String(Sc); tLabel(); } },
    wd: { run: wRun, finish: wFinish, S: function () { return WD; }, limit: WLIM }
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function uniq(ans, list) { var seen = {}, out = []; seen[ans] = 1; list.forEach(function (x) { x = String(x); if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
  var KIND = [
    // 1. 掃描順序
    function () {
      var st = ['輸入刷新', '由上往下執行程式', '輸出刷新'], i = Math.floor(Math.random() * 3);
      return { q: 'PLC 一圈裡，「<b>' + st[i] + '</b>」做完之後，接著做什麼？', ans: st[(i + 1) % 3] + (i === 2 ? '（下一圈開始）' : ''), wrong: uniq(st[(i + 1) % 3] + (i === 2 ? '（下一圈開始）' : ''), [st[(i + 2) % 3], st[i] + '（再做一次）', '等使用者按按鈕', '通訊處理完才回到第一行']), ex: '一圈 = ① 輸入刷新 → ② 由上往下執行 → ③ 輸出刷新，做完馬上下一圈。' };
    },
    // 2. 程式執行到一半按按鈕
    function () {
      var r = p1([2, 3, 5]);
      return { q: '程式正在執行第 ' + r + ' 行時，你按下按鈕 X0。第 ' + (r + 1) + ' 行讀 X0，會看到什麼？', ans: 'OFF：這一圈的輸入映像已經拍好了，下一圈才看得到 ON', wrong: ['ON：按下就馬上看得到', '看 X0 接在哪個端子而定', 'PLC 會從第 1 行重新開始', '會出現錯誤'], ex: '程式只讀輸入映像。映像在每一圈開頭的輸入刷新才更新，中途按下要等下一圈。' };
    },
    // 3. 慢一圈（計算）
    function () {
      var rd = p1([1, 2, 3, 4]), wr = p1([1, 2, 3, 4].filter(function (x) { return x !== rd; }));
      var late = rd < wr;
      return { q: 'M0 在第 <b>' + wr + '</b> 行由 X0 寫（LD X0 / OUT M0），第 <b>' + rd + '</b> 行讀 M0 去 OUT Y0。X0 在第 1 圈開始前按下，Y0 的實體輸出在第幾圈亮？', ans: late ? '第 2 圈' : '第 1 圈', wrong: late ? ['第 1 圈', '第 3 圈', '不會亮', '看掃描時間'] : ['第 2 圈', '第 3 圈', '不會亮', '看掃描時間'], ex: late ? '讀 M0 的那一行在上面，第 1 圈讀到的是上一圈的 M0 = 0；第 2 圈才讀到 1。這就是慢一圈。' : 'M0 先寫、後讀，第 1 圈就讀到新值，同一圈的輸出刷新就送出去。' };
    },
    // 4. 雙線圈最後一行
    function () {
      var a = p1([0, 1]), b = p1([0, 1]);
      return { q: '程式：第 1 行 LD X0 / OUT Y0，第 2 行 LD X1 / OUT Y0。這一圈 X0 = ' + a + '、X1 = ' + b + '，實體 Y0 送出什麼？', ans: String(b), wrong: uniq(String(b), [String(1 - b), 'X0 和 X1 取 OR', '兩個都寫，Y0 一直閃', 'PLC 不准執行，跳錯誤']), ex: '每個 OUT 只改映像，後面的蓋掉前面的；輸出刷新時映像是第 2 行寫的 ' + b + '。' };
    },
    // 5. 雙線圈中間讀
    function () {
      return { q: '第 1 行 LD X0 / OUT Y0，第 2 行 LD Y0 / OUT Y2，第 3 行 LD X1 / OUT Y0。X0 = 1、X1 = 0。這一圈結束，實體 Y0 和 Y2 是？', ans: 'Y0 = 0、Y2 = 1', wrong: ['Y0 = 1、Y2 = 1', 'Y0 = 0、Y2 = 0', 'Y0 = 1、Y2 = 0', 'Y0 一直閃'], ex: '第 2 行讀 Y0 的映像時，第 1 行剛寫 1，所以 Y2 = 1；第 3 行又把 Y0 寫回 0，最後送出 0。同一圈裡 Y0 的映像先 1 後 0。' };
    },
    // 6. 雙線圈的修法
    function () {
      return { q: '兩個條件都要能讓 Y0 亮，最好的寫法是？', ans: '條件 OR 在一起，只寫一個 OUT Y0', wrong: ['寫兩行 OUT Y0', '一行 OUT、一行 SET Y0', '把第二行放在程式最上面', '兩行都改成 PLS Y0'], ex: '同一個線圈只寫一次。大程式的做法是各段先寫 M，最後的輸出段才寫 Y（課文：雙龍門的 P9）。' };
    },
    // 7. 太短的輸入（計算）
    function () {
      var Sc = p1([10, 20, 40]), W = p1([5, 8, Sc, Sc + 5, Sc + 10, Sc + 20]);
      var ans = W >= Sc + 10 ? '一定抓得到' : W <= 10 ? '幾乎一定漏掉：還沒過輸入響應時間就放開了' : '可能被漏掉，要看按的時刻';
      return { q: '掃描週期 ' + Sc + ' ms，輸入響應時間約 10 ms（FX3S）。按鈕只 ON <b>' + W + ' ms</b>，程式抓得到嗎？', ans: ans, wrong: uniq(ans, ['一定抓得到', '可能被漏掉，要看按的時刻', '幾乎一定漏掉：還沒過輸入響應時間就放開了', 'PLC 會自動延長成 1 秒']), ex: '原則：輸入要維持超過「一個掃描週期 + 輸入響應時間」= ' + (Sc + 10) + ' ms，才保證被某一次輸入刷新拍到。' };
    },
    // 8. 看門狗預設
    function () {
      return { q: 'FX 的看門狗計時器時間放在哪裡、預設多少？', ans: 'D8000，預設 200 ms', wrong: ['D8000，預設 10 ms', 'M8000，預設 200 ms', 'D8010，預設 100 ms', '沒有看門狗'], ex: '程式手冊 37.2.2：D8000 看門狗計時器，預設 200 ms。M8000 是 RUN 中常 ON。' };
    },
    // 9. 看門狗逾時
    function () {
      var ms = p1([250, 300, 500]);
      return { q: '程式某一圈因為卡在迴圈裡跑了 ' + ms + ' ms（D8000 是預設值），會怎樣？', ans: '看門狗逾時，CPU 判定異常停止運轉，輸出全部 OFF', wrong: ['沒事，只是這一圈比較慢', '自動跳過剩下的行', '輸出保持最後的狀態繼續跑', 'D8000 自動加大'], ex: '一圈超過 D8000（預設 200 ms）沒跑完，就是看門狗逾時，PLC 停止運轉、輸出 OFF。' };
    },
    // 10. 輸出什麼時候送出
    function () {
      var r = p1([1, 2, 3]);
      return { q: '第 ' + r + ' 行 OUT Y0 寫成 ON，接在 Y0 的燈什麼時候亮？', ans: '這一圈的輸出刷新（全部行算完之後）', wrong: ['執行到第 ' + r + ' 行的那一刻', '下一圈的輸入刷新', '下一圈執行到第 ' + r + ' 行時', '要等 1 秒'], ex: 'OUT 只寫輸出映像；全部算完，輸出刷新才一次送到 Y 端子。這樣機器不會收到算到一半的結果。' };
    },
    // 11. PLS 當圈
    function () {
      var a = p1([2, 3]), b = a + p1([1, 2]);
      return { q: '第 ' + a + ' 行 LD X2 / PLS M0，第 ' + b + ' 行 LD M0 / INC D0。X2 剛按下的那一圈，D0 會加嗎？', ans: '會，這一圈就加 1', wrong: ['不會，下一圈才加', '每一圈都加', '要放開 X2 才加', '要按兩次才加'], ex: 'PLS 在條件剛成立的那一圈把 M0 寫成 ON，寫在它下面的行當圈就讀得到（課文 A4）；下一圈 M0 就 OFF 了。' };
    },
    // 12. 讀 Y 讀的是映像
    function () {
      return { q: '程式裡的 LD Y000（Y0 的接點）讀的是？', ans: '輸出映像（到這一行為止最後寫的值）', wrong: ['Y0 端子實際的電壓', '輸入映像', '上一次輸出刷新送出去的值，一定是', 'Y0 接的負載有沒有動'], ex: 'Y 的接點讀輸出映像。所以雙線圈時，中間的行讀到的可能和實體輸出不一樣。' };
    },
    // 13. 自保持
    function () {
      return { q: 'LD X0 / OR Y0 / ANI X1 / OUT Y0。按下 X0 讓 Y0 亮，再放開 X0。放開後那一圈，OR Y0 讀到的 Y0 是？', ans: '1：上一圈寫進映像的值還在', wrong: ['0：放開就清掉', '看 X1', '不一定，看掃描時間', '讀不到，要等輸出刷新'], ex: '映像會留到被重新寫為止。放開 X0 那一圈，Y0 的映像還是上一圈的 1，電從自己的接點繞回來，所以保持住。' };
    },
    // 14. 模擬器與實機掃描時間
    function () {
      var sim = Math.random() < 0.5;
      return { q: sim ? '本站模擬器一圈固定多久？' : 'FX3S 實機一圈大約多久？', ans: sim ? '10 ms' : '依程式長短，一般不到 1 ms 到數 ms', wrong: sim ? ['1 秒', '200 ms', '依程式長短，一般不到 1 ms 到數 ms', '100 ms'] : ['固定 10 ms', '固定 200 ms', '1 秒', '依按鈕次數而定'], ex: '「模擬器和實機的差異」頁：實機依程式長短，一般不到 1 ms 到數 ms；模擬器固定 10 ms，方便看清楚慢一圈。' };
    }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) window.ScanLab.quiz = window.LabQuiz('scan-quiz', gen);
  window.ScanLab.quizGen = gen; window.ScanLab.quizKinds = KIND;
})();
