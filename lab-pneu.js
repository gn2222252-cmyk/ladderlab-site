/* 氣壓缸實驗室：三種電磁閥、位移－時間圖與 STL 步序、感測器壞了、猜一猜
   氣缸與閥的行為照 engine/plants.py：
     center：本站當成 5/3 中位封閉型，+ 線圈 ON 往前、− 線圈 ON 往後，都 OFF 停在原地。
     memory：5/2 雙線圈閥，+ 或 − 決定方向，線圈都 OFF 時保持最後的方向，一直走到行程底。
     感測器：端點在 0.02 以內、中間點在 0.03 以內算 ON。
     E18 的 A 缸全行程 2 秒，快速閥 ON 時 1 秒；B、C 缸 1 秒。
   單線圈閥（彈簧復歸）plants.py 沒有，照課文：線圈 OFF 就回到彈簧側（這裡當成縮回），速度沿用 1 秒。
   5/3 中位加壓、中位排氣只做定性示意（分頁 1），速度不是實測值。
   兩個線圈同時通電：各廠、各型的結果不同，這裡不模擬，只提醒「不要同時通電」。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function logTo(id, s) { var l = $(id); l.insertBefore(el('div', '', s), l.firstChild); while (l.children.length > 200) l.removeChild(l.lastChild); }
  function Tab() { return { gen: 0, timer: null, resume: false }; }
  function clamp(v) { return Math.max(0, Math.min(1, v)); }
  function sensorOn(pos, at) { return Math.abs(pos - at) <= (at === 0 || at === 1 ? 0.02 : 0.03); }
  var COL = ['#1f6feb', '#b45309', '#7c3aed', '#0b8a5f'];
  var VCOL = ['#1f6feb', '#b45309', '#7c3aed', '#0b8a5f', '#be185d'];
  var tabs = $('tabs'), cur = 'valve';

  /* 共用：畫一支氣缸 */
  function cylHtml(c, pos, coils, sens, dead, valveName) {
    var pistonL = 2 + pos * 50, headL = 58 + pos * 36;
    var h = '<h4>' + c.n + ' 缸 <small>' + valveName + '</small><span class="coils">' + coils.map(function (k) { return '<span class="coil' + (k[1] ? ' on' : '') + '">' + k[0] + '</span>'; }).join('') + '</span><small>位置 ' + pos.toFixed(2) + '</small></h4>';
    h += '<div class="pn-body"><div class="pn-barrel"></div><div class="pn-rod" style="left:' + (pistonL + 1) + '%;width:' + (headL - pistonL) + '%"></div><div class="pn-piston" style="left:' + pistonL + '%;top:8px"></div><div class="pn-head" style="left:' + headL + '%"></div>';
    (c.marks || []).forEach(function (m) {
      var isDead = dead && dead === m[1];
      h += '<span class="pn-mark' + (sens[m[1]] ? ' on' : '') + (isDead ? ' dead' : '') + '" style="left:' + (2 + m[0] * 50 + 1) + '%"><i></i>' + m[1] + (isDead ? '✖' : '') + '</span>';
    });
    return h + '</div>';
  }

  /* ======================================================================
     1. 三種電磁閥
     ====================================================================== */
  var TV = Tab(), V;
  var VK = [{ k: 'single', name: '單線圈閥（彈簧復歸）', s: '① 單線圈' }, { k: 'memory', name: '5/2 雙線圈閥', s: '② 5/2 雙線圈' },
    { k: 'cc', name: '5/3 中位封閉型', s: '③ 5/3 封閉' }, { k: 'cp', name: '5/3 中位加壓型', s: '④ 5/3 加壓' }, { k: 'ce', name: '5/3 中位排氣型', s: '⑤ 5/3 排氣' }];
  var NV = VK.length, DRIFT = 0.15;   // 中位加壓型的慢慢移動：只是示意的速度
  var VCYL = { n: '', marks: [[0, '後端'], [1, '前端']] };
  function vlog(s) { logTo('v-log', '<span class="kv">' + (V.t / 1000).toFixed(2) + 's</span> ' + s); }
  function zeros(v) { var a = []; for (var i = 0; i < NV; i++) a.push(v); return a; }
  function vReset() {
    if (TV.timer) { clearInterval(TV.timer); TV.timer = null; }
    TV.gen++; TV.resume = false;
    V = { t: 0, cmd: 'none', pos: zeros(0), dir: zeros(-1), hist: [], ev: [], offAt: null, offPos: null };
    $('v-log').innerHTML = ''; $('v-off').classList.remove('on');
    vlog('五支缸都在後端，線圈都 OFF。');
    vStart(); vDraw();
  }
  function vPush() {
    if (V.cmd === 'plus' || V.cmd === 'minus') { vlog('有線圈在通電，閥把壓縮空氣送進一側，用手推不動。'); return; }
    V.pos[4] = clamp(V.pos[4] - 0.25);
    vlog('用手把活塞桿往回推：⑤ 中位排氣型兩側都沒有壓力，被推動了；①～④ 有壓力或封住的空氣頂著，這裡不畫移動（實際會不會被推動看負載和空氣壓縮量）。');
    vDraw();
  }
  function vCoils(i) {
    var c = V.cmd;
    if (VK[i].k === 'single') return [['線圈', c === 'plus']];
    return [['+', c === 'plus'], ['−', c === 'minus']];
  }
  function vCmd(c) {
    V.cmd = c;
    $('v-off').classList.toggle('on', c === 'off');
    if (c === 'off') { V.offAt = V.t; V.offPos = V.pos.slice(); vlog('<b>線圈全部 OFF</b>：位置 ' + V.pos.map(function (p) { return p.toFixed(2); }).join('、')); }
    else vlog(c === 'plus' ? '伸出命令：單線圈閥線圈 ON；5/2、5/3 閥「+」線圈 ON' : '縮回命令：單線圈閥線圈 OFF；5/2、5/3 閥「−」線圈 ON');
    vDraw();
  }
  function vPhys(dt) {
    var v = dt / 1000, c = V.cmd;
    VK.forEach(function (k, i) {
      if (k.k === 'single') V.pos[i] = clamp(V.pos[i] + (c === 'plus' ? v : -v));
      else if (k.k === 'memory') { if (c === 'plus') V.dir[i] = 1; else if (c === 'minus') V.dir[i] = -1; V.pos[i] = clamp(V.pos[i] + V.dir[i] * v); }
      else if (c === 'plus') V.pos[i] = clamp(V.pos[i] + v);
      else if (c === 'minus') V.pos[i] = clamp(V.pos[i] - v);
      else if (k.k === 'cp') V.pos[i] = clamp(V.pos[i] + DRIFT * v);   // 兩側都有壓力：無桿側面積大，慢慢往伸出方向（示意）
    });
  }
  function vTick(ms) {
    for (var s = 0; s < ms; s += 10) {
      V.t += 10;
      V.ev = V.ev.filter(function (e) { if (V.t >= e.at) { e.fn(); return false; } return true; });
      vPhys(10);
      if (V.t % 50 === 0) { V.hist.push({ t: V.t, p: V.pos.slice(), off: V.cmd === 'off' }); if (V.hist.length > 140) V.hist.shift(); }
    }
    vDraw();
  }
  function vStart() { if (!TV.timer) TV.timer = setInterval(function () { vTick(30); }, 30); }
  function vDemo(n) {
    vReset();
    if (n === 3) { V.pos = zeros(1); V.dir = zeros(1); V.cmd = 'plus'; vlog('（先讓五支缸都伸到前端，伸出命令保持）'); V.ev.push({ at: V.t + 300, fn: function () { vCmd('minus'); } }); V.ev.push({ at: V.t + 800, fn: function () { vCmd('off'); } }); return; }
    vCmd('plus');
    V.ev.push({ at: V.t + (n === 1 ? 500 : 1300), fn: function () { vCmd('off'); } });
  }
  function vDraw() {
    var MID = { cc: '中位：兩側出口都封住', cp: '中位：兩側都接壓力', ce: '中位：兩側都通排氣' };
    $('v-cyls').innerHTML = VK.map(function (k, i) {
      var sens = { '後端': sensorOn(V.pos[i], 0), '前端': sensorOn(V.pos[i], 1) };
      var nm = k.name + (MID[k.k] && V.cmd !== 'plus' && V.cmd !== 'minus' ? '　' + MID[k.k] : '');
      return '<div class="pn-cyl" style="border-color:' + VCOL[i] + '">' + cylHtml({ n: ['①', '②', '③', '④', '⑤'][i], marks: VCYL.marks }, V.pos[i], vCoils(i), sens, null, nm) + '</div>';
    }).join('');
    vChart();
    if (V.cmd === 'off' && V.offAt != null && V.t - V.offAt > 1100) {
      var p = V.pos.map(function (x) { return x.toFixed(2); }), o = V.offPos;
      say('v-say', '斷電時位置是 ' + o.map(function (x) { return x.toFixed(2); }).join('、') + '。現在：① 單線圈 ' + p[0] + '（彈簧讓閥回去，氣缸回後端）；② 5/2 雙線圈 ' + p[1] + '（閥保持最後閥位，走到底）；③ 5/3 中位封閉 ' + p[2] + '（停在斷電那一刻）；④ 5/3 中位加壓 ' + p[3] + '（兩側都有壓力，面積差讓它慢慢動）；⑤ 5/3 中位排氣 ' + p[4] + '（兩側無壓，沒有東西推它，但用手推得動）。');
    } else if (V.cmd === 'off') say('v-say', '線圈全部 OFF：5/3 閥的彈簧讓閥回中位，看五支缸各往哪裡走……');
    else say('v-say', '');
  }
  function vChart() {
    var box = $('v-chart'), W = Math.floor(box.clientWidth - 8);
    if (W < 200) return;
    var L = 84, win = 5000, RH = 30, H = NV * RH + 22, t1 = V.t, t0 = t1 - win, s = '', COL = VCOL;
    var x = function (t) { return L + (t - t0) / win * (W - L - 6); };
    V.hist.forEach(function (h, i) { if (h.off && h.t >= t0) { var nx = V.hist[i + 1] ? V.hist[i + 1].t : h.t + 50; s += '<rect x="' + x(h.t) + '" y="0" width="' + Math.max(1, x(nx) - x(h.t)) + '" height="' + (NV * RH) + '" fill="#dc2626" opacity=".08"/>'; } });
    VK.forEach(function (k, i) {
      var y0 = i * RH, yy = function (p) { return y0 + RH - 4 - p * (RH - 8); };
      s += '<text x="2" y="' + (y0 + 18) + '" style="fill:' + COL[i] + '">' + k.s + '</text><line x1="' + L + '" y1="' + yy(0) + '" x2="' + W + '" y2="' + yy(0) + '" stroke="currentColor" opacity=".15"/><line x1="' + L + '" y1="' + yy(1) + '" x2="' + W + '" y2="' + yy(1) + '" stroke="currentColor" opacity=".15" stroke-dasharray="3 3"/>';
      var pts = V.hist.filter(function (h) { return h.t >= t0; }).map(function (h) { return x(h.t) + ',' + yy(h.p[i]); });
      if (pts.length > 1) s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + COL[i] + '" stroke-width="2"/>';
    });
    s += '<text x="' + L + '" y="' + (H - 4) + '" opacity=".7">← 5 秒前</text><text x="' + (W - 40) + '" y="' + (H - 4) + '" opacity=".7">現在</text>';
    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="五支氣缸的位移">' + s + '</svg>';
  }
  $('v-plus').onclick = function () { vCmd('plus'); };
  $('v-minus').onclick = function () { vCmd('minus'); };
  $('v-off').onclick = function () { vCmd('off'); };
  $('v-push').onclick = vPush;
  $('v-demo1').onclick = function () { vDemo(1); }; $('v-demo2').onclick = function () { vDemo(2); }; $('v-demo3').onclick = function () { vDemo(3); };
  $('v-reset').onclick = vReset;

  /* ======================================================================
     2、3. 位移－時間圖與 STL 步序（共用引擎）
     ====================================================================== */
  function defE18() {
    return { key: 'e18', name: 'E18 變速迴路', cyls: [
      { n: 'A', valve: 'center', marks: [[0, 'a0'], [0.5, 'a1'], [1, 'a2']], stroke: 2, fast: 1 },
      { n: 'B', valve: 'memory', marks: [[0, 'b0'], [1, 'b1']], stroke: 1 },
      { n: 'C', valve: 'memory', marks: [[0, 'c0'], [1, 'c1']], stroke: 1 }],
      steps: [{ mv: [['A', 1]], to: { A: 0.5 } }, { mv: [['B', 1]] }, { mv: [['A', -1]] }, { mv: [['C', 1]] }, { mv: [['B', -1]] },
        { mv: [['A', 1]], to: { A: 0.5 }, note: '慢' }, { mv: [['A', 1, 'fast']], to: { A: 1 }, note: '快' }, { mv: [['A', -1], ['C', -1]] }] };
  }
  var VALVE_NAME = { center: '5/3 中位封閉型（本站的示範選擇）', memory: '5/2 雙線圈閥', setrst: '單線圈閥（SET／RST）', outonly: '單線圈閥（只用 OUT）' };
  /* 解析「A+ B+ A-/B-」。回傳 {def} 或 {err} */
  function parseSeq(txt, valve) {
    var toks = String(txt || '').trim().split(/\s+/).filter(Boolean);
    if (!toks.length) return { err: '請輸入動作順序，例如 A+ B+ A- B-' };
    if (toks.length > 10) return { err: '最多 10 步' };
    var names = [], steps = [], lp = {};
    for (var i = 0; i < toks.length; i++) {
      var parts = toks[i].split('/'), mv = [], seen = {};
      for (var j = 0; j < parts.length; j++) {
        var m = /^([A-Da-d])([+-])$/.exec(parts[j]);
        if (!m) return { err: '看不懂「' + toks[i] + '」：每一步寫成 A+、B- 這樣，同一步兩支缸用 / 連起來' };
        var n = m[1].toUpperCase(), d = m[2] === '+' ? 1 : -1;
        if (seen[n]) return { err: '第 ' + (i + 1) + ' 步 ' + n + ' 缸寫了兩次' };
        seen[n] = 1;
        if (names.indexOf(n) < 0) { names.push(n); lp[n] = 0; }
        if ((d === 1 && lp[n] === 1) || (d === -1 && lp[n] === 0)) return { err: '第 ' + (i + 1) + ' 步「' + n + (d > 0 ? '+' : '-') + '」：' + n + ' 缸已經在' + (d > 0 ? '前端' : '後端') + '，沒有東西可做' };
        lp[n] = d > 0 ? 1 : 0; mv.push([n, d]);
      }
      steps.push({ mv: mv });
    }
    names.sort();
    var notHome = names.filter(function (n) { return lp[n] !== 0; });
    return { def: { key: 'custom', name: toks.join(' '), cyls: names.map(function (n) { var l = n.toLowerCase(); return { n: n, valve: valve || 'memory', marks: [[0, l + '0'], [1, l + '1']], stroke: 1 }; }), steps: steps }, warn: notHome.length ? '最後 ' + notHome.join('、') + ' 缸沒有回到後端：下一輪的起點和第一輪不一樣，S0 的原點條件也不會成立。' : '' };
  }
  function PRESET(k) {
    if (k === 'e18') return defE18();
    if (k === 'ex67') return parseSeq('A+ B+ A-/B-', 'memory').def;
    if (k === 'ex65') return parseSeq('A+ B+ B- A-', 'memory').def;
    return null;
  }
  function condOf(def, st) {
    return st.mv.map(function (m) {
      var c = def.cyls.filter(function (x) { return x.n === m[0]; })[0];
      var to = st.to && st.to[m[0]] != null ? st.to[m[0]] : (m[1] > 0 ? 1 : 0);
      return c.marks.filter(function (k) { return k[0] === to; })[0][1];
    });
  }
  function moveText(st) { return st.mv.map(function (m) { return m[0] + (m[1] > 0 ? '+' : '-') + (m[2] ? '、快速閥' : ''); }).join('、'); }

  function Rig(pre, opt) {
    var T = Tab(), R = null, def = null, ideal = null;
    function lg(s) { logTo(pre + '-log', '<span class="kv">' + (R.t / 1000).toFixed(2) + 's</span> ' + s); }
    function cyl(n) { return def.cyls.filter(function (c) { return c.n === n; })[0]; }

    function fresh(d) {
      var r = { t: 0, k: -1, permit: false, stepT: 0, pos: {}, dir: {}, latch: {}, coil: {}, sens: {}, ems: false, alarm: '', cycles: 0, done: false, dead: opt.dead ? opt.dead() : '', warn: [], trace: [] };
      d.cyls.forEach(function (c) { r.pos[c.n] = 0; r.dir[c.n] = -1; r.latch[c.n] = 0; });
      return r;
    }
    function coilsOf(r, valveOverride) {
      var out = {};
      def.cyls.forEach(function (c) { out[c.n] = { p: 0, m: 0, f: 0 }; });
      var active = r.k >= 0 && r.permit && !r.ems && !r.alarm;
      if (active) {
        def.steps[r.k].mv.forEach(function (m) {
          var o = out[m[0]]; if (m[1] > 0) o.p = 1; else o.m = 1; if (m[2]) o.f = 1;
          var v = valveOverride || cyl(m[0]).valve;
          if (v === 'setrst') r.latch[m[0]] = m[1] > 0 ? 1 : 0;
        });
      }
      if (r.ems || r.alarm) def.cyls.forEach(function (c) { r.latch[c.n] = 0; });
      def.cyls.forEach(function (c) {
        var v = valveOverride || c.valve;
        if (v === 'setrst') { out[c.n] = { p: r.latch[c.n], m: 0, f: 0 }; }
        else if (v === 'outonly') { out[c.n].m = 0; }
      });
      return out;
    }
    function physics(r, dt, valveOverride) {
      var co = coilsOf(r, valveOverride);
      def.cyls.forEach(function (c) {
        var v = valveOverride || c.valve, o = co[c.n], spd = dt / 1000 / (o.f && c.fast ? c.fast : c.stroke);
        if (v === 'center') { if (o.p && !o.m) r.pos[c.n] = clamp(r.pos[c.n] + spd); else if (o.m && !o.p) r.pos[c.n] = clamp(r.pos[c.n] - spd); }
        else if (v === 'memory') { if (o.p && !o.m) r.dir[c.n] = 1; else if (o.m && !o.p) r.dir[c.n] = -1; r.pos[c.n] = clamp(r.pos[c.n] + r.dir[c.n] * spd); }
        else r.pos[c.n] = clamp(r.pos[c.n] + (o.p ? spd : -spd));
      });
      r.coil = co;
      r.sens = {};
      def.cyls.forEach(function (c) { c.marks.forEach(function (m) { r.sens[m[1]] = sensorOn(r.pos[c.n], m[0]) && m[1] !== r.dead; }); });
    }
    function originOk(r) { return def.cyls.every(function (c) { return r.sens[c.marks[0][1]]; }); }
    function logic(r, quiet, single) {
      if (r.k < 0 || !r.permit || r.ems || r.alarm) return;
      r.stepT += 10;
      var st = def.steps[r.k], cond = condOf(def, st);
      if (cond.every(function (s) { return r.sens[s]; })) {
        if (!quiet) {
          var bad = [];
          if (ideal) def.cyls.forEach(function (c) { if (Math.abs(r.pos[c.n] - ideal.seg[r.k][c.n][1]) > 0.1) bad.push(c.n); });
          if (bad.length) { r.warn.push(r.k); lg('<span class="err">S' + (20 + r.k) + ' 換步時 ' + bad.join('、') + ' 缸不在圖上該在的位置</span>（' + bad.map(function (n) { return n + ' = ' + r.pos[n].toFixed(2); }).join('、') + '）'); }
          lg('S' + (20 + r.k) + '：' + cond.join(' 而且 ') + ' 到了 → ' + (r.k + 1 < def.steps.length ? '換到 S' + (21 + r.k) : '一輪完成，回 S0'));
        }
        r.trace.push({ k: r.k, t: r.stepT });
        r.k++; r.stepT = 0;
        if (r.k >= def.steps.length) { r.k = -1; r.permit = false; r.cycles++; r.done = true; return; }
        r.permit = single;
        if (!single && !quiet) lg('手動步進：S' + (20 + r.k) + ' 已經作用，可是要等你按 ST 才輸出');
        return;
      }
      if (opt.timeout && opt.timeout() && ideal && r.stepT > 2 * ideal.dur[r.k]) {
        r.alarm = 'S' + (20 + r.k) + ' 逾時';
        if (!quiet) lg('<span class="err">S' + (20 + r.k) + ' 等 ' + cond.join('・') + ' 超過正常時間的 2 倍（' + (2 * ideal.dur[r.k] / 1000).toFixed(1) + ' 秒）→ 異常：記下異常、輸出全斷</span>');
      }
    }
    function computeIdeal() {
      var save = R, r = fresh(def), dur = [], seg = [], guard = 0, vOver = def.key === 'custom' ? 'memory' : null;
      r.dead = ''; R = r;
      physics(r, 0, vOver);
      r.k = 0; r.permit = true;
      var startPos = {}; def.cyls.forEach(function (c) { startPos[c.n] = r.pos[c.n]; });
      var curK = 0;
      while (!r.done && guard++ < 20000) {
        physics(r, 10, vOver); logic(r, true, true);
        if (r.k !== curK) {
          var s = {}; def.cyls.forEach(function (c) { s[c.n] = [startPos[c.n], snap(c, r.pos[c.n])]; startPos[c.n] = snap(c, r.pos[c.n]); });
          seg.push(s); dur.push(r.trace[r.trace.length - 1].t); curK = r.k < 0 ? def.steps.length : r.k;
        }
      }
      R = save;
      return { seg: seg, dur: dur, ok: r.done };
    }
    function snap(c, p) { var best = p; c.marks.forEach(function (m) { if (Math.abs(m[0] - p) < 0.05) best = m[0]; }); return best; }

    function load(d) {
      if (T.timer) { clearInterval(T.timer); T.timer = null; }
      T.gen++; T.resume = false;
      def = d; ideal = computeIdeal();
      R = fresh(def); physics(R, 0);
      $(pre + '-log').innerHTML = '';
      lg('載入「' + def.name + '」：' + def.steps.length + ' 個時段＝' + def.steps.length + ' 步（S20～S' + (19 + def.steps.length) + '），位移－時間圖有 ' + (def.steps.length + 1) + ' 條步號線。');
      start(); draw();
    }
    function reset() { if (def) load(def); }
    function st() {
      if (R.ems) { lg('急停中，按 ST 無效。'); return; }
      if (R.alarm) { lg('異常中，按 ST 無效（要先排除故障、復歸）。'); return; }
      var single = $(pre + '-mode') ? $(pre + '-mode').value !== 'manual' : true;
      if (R.k < 0) {
        if (!originOk(R)) { var miss = def.cyls.filter(function (c) { return !R.sens[c.marks[0][1]]; }).map(function (c) { return c.marks[0][1]; }); lg('按 ST：S0 的原點條件不成立（' + miss.join('、') + ' 沒有 ON），不啟動。'); return; }
        R.k = 0; R.permit = true; R.stepT = 0; R.done = false; R.trace = []; R.warn = [];
        lg('按 ST：原點條件成立（' + def.cyls.map(function (c) { return c.marks[0][1]; }).join('・') + '）→ S20：輸出 ' + moveText(def.steps[0]) + '，等 ' + condOf(def, def.steps[0]).join('・'));
        R.single = single;
      } else if (!R.permit) { R.permit = true; lg('按 ST：S' + (20 + R.k) + ' 開始輸出 ' + moveText(def.steps[R.k]) + '，等 ' + condOf(def, def.steps[R.k]).join('・')); }
      else lg('動作中，ST 沒有作用。');
      draw();
    }
    function ems(on) {
      R.ems = !!on;
      if (on) { var was = R.k; R.k = -1; R.permit = false; lg('<b>急停</b>：步序清除（原本在 ' + (was >= 0 ? 'S' + (20 + was) : 'S0') + '）、PLC 輸出全斷。' + def.cyls.map(function (c) { return c.n + '（' + VALVE_NAME[c.valve] + '）' + (c.valve === 'center' ? '停在原地' : c.valve === 'memory' ? '照最後的方向走完' : '彈回後端'); }).join('；')); }
      else lg('解除急停：照試題要先復歸（這裡按「重來」代替復歸）。');
      draw();
    }
    function tick(ms) {
      for (var s = 0; s < ms; s += 10) {
        R.t += 10;
        physics(R, 10);
        var single = R.single !== false && ($(pre + '-mode') ? $(pre + '-mode').value !== 'manual' : true);
        logic(R, false, single);
      }
      draw();
    }
    function speed() { return $(pre + '-speed') ? +$(pre + '-speed').value : 1; }
    function start() { if (!T.timer) T.timer = setInterval(function () { tick(Math.round(30 * speed() / 10) * 10 || 10); }, 30); }
    function stop() { if (T.timer) { clearInterval(T.timer); T.timer = null; } }

    function draw() {
      if (!R) return;
      var co = R.coil || {};
      $(pre + '-cyls').innerHTML = def.cyls.map(function (c, i) {
        var o = co[c.n] || {}, coils = c.valve === 'setrst' || c.valve === 'outonly' ? [[c.n + ' 線圈', o.p]] : [[c.n + '+', o.p], [c.n + '-', o.m]];
        if (c.fast) coils.push(['快速閥', o.f]);
        return '<div class="pn-cyl" style="border-color:' + COL[i] + '">' + cylHtml(c, R.pos[c.n], coils, R.sens, R.dead, VALVE_NAME[c.valve]) + '</div>';
      }).join('');
      var h = '<h4>STL 步序</h4><div class="s' + (R.k < 0 ? ' on' : '') + '"><b>S0</b><span>待機　原點：' + def.cyls.map(function (c) { return c.marks[0][1]; }).join('・') + (R.ems ? '（急停中）' : '') + '</span></div>';
      def.steps.forEach(function (stp, i) {
        var cls = R.k === i ? (R.alarm ? 'bad' : R.permit ? 'on' : 'hold') : '';
        h += '<div class="s ' + cls + '"><b>S' + (20 + i) + '</b><span>第 ' + (i + 1) + ' 格：輸出 ' + moveText(stp) + (stp.note ? '（' + stp.note + '）' : '') + '　等 ' + condOf(def, stp).join('・') + '</span></div>';
      });
      $(pre + '-stl').innerHTML = h;
      dtd();
      if ($(pre + '-t')) $(pre + '-t').textContent = (R.t / 1000).toFixed(1);
      if (opt.after) opt.after(R, def, ideal);
    }
    function dtd() {
      var box = $(pre + '-chart'), W = Math.floor(box.clientWidth - 8);
      if (W < 200) return;
      var n = def.steps.length, L = 34, top = 18, rh = 58, cw = (W - L - 12) / n, s = '';
      var X = function (i) { return L + i * cw; }, H = top + def.cyls.length * rh + 36;
      if (R.k >= 0) s += '<rect x="' + X(R.k) + '" y="' + (top - 2) + '" width="' + cw + '" height="' + (def.cyls.length * rh + 4) + '" fill="' + (R.alarm ? '#dc2626' : '#f59e0b') + '" opacity=".16"/>';
      for (var i = 0; i <= n; i++) s += '<line x1="' + X(i) + '" y1="' + (top - 4) + '" x2="' + X(i) + '" y2="' + (top + def.cyls.length * rh) + '" stroke="currentColor" opacity=".35" stroke-dasharray="3 3"/><text x="' + (X(i) - 3) + '" y="12">' + (i === n ? (n + 1) + '=1' : i + 1) + '</text>';
      var frac = 0;
      if (R.k >= 0 && ideal.seg[R.k]) {
        var fr = [];
        def.steps[R.k].mv.forEach(function (m) { var sg = ideal.seg[R.k][m[0]], d = sg[1] - sg[0]; if (d) fr.push(clamp((R.pos[m[0]] - sg[0]) / d)); });
        frac = fr.length ? Math.max.apply(null, fr) : 0;
      }
      def.cyls.forEach(function (c, ci) {
        var y0 = top + ci * rh, Y = function (p) { return y0 + rh - 10 - p * (rh - 20); };
        c.marks.forEach(function (m) { s += '<line x1="' + L + '" y1="' + Y(m[0]) + '" x2="' + X(n) + '" y2="' + Y(m[0]) + '" stroke="currentColor" opacity=".1"/><text x="' + (L - 26) + '" y="' + (Y(m[0]) + 4) + '"' + (m[1] === R.dead ? ' style="fill:#dc2626"' : '') + '>' + m[1] + '</text>'; });
        s += '<text x="2" y="' + (y0 + 14) + '" style="fill:' + COL[ci] + ';font-weight:700">' + c.n + '</text>';
        var pts = [];
        ideal.seg.forEach(function (sg, i) { pts.push(X(i) + ',' + Y(sg[c.n][0])); pts.push(X(i + 1) + ',' + Y(sg[c.n][1])); });
        if (pts.length) s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + COL[ci] + '" stroke-width="2.5"/>';
        var dx = R.k >= 0 ? X(R.k) + frac * cw : R.done ? X(n) : X(0);
        s += '<circle cx="' + dx + '" cy="' + Y(R.pos[c.n]) + '" r="6" fill="' + COL[ci] + '" stroke="#fff" stroke-width="1.5"/>';
      });
      var by = top + def.cyls.length * rh + 14;
      def.steps.forEach(function (stp, i) {
        var cx = X(i) + cw / 2;
        s += '<text x="' + cx + '" y="' + by + '" text-anchor="middle" style="font-size:10px">S' + (20 + i) + '</text><text x="' + cx + '" y="' + (by + 13) + '" text-anchor="middle" style="font-size:10px;opacity:.75">' + condOf(def, stp).join('・') + '</text>';
        if (stp.note) s += '<text x="' + cx + '" y="' + (top + 10) + '" text-anchor="middle" style="font-size:10px;fill:#dc2626">' + stp.note + '</text>';
      });
      box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="位移－時間圖">' + s + '</svg>';
    }
    var api = { load: load, reset: reset, st: st, ems: ems, tick: function (ms) { tick(ms || 10); return R; }, S: function () { return R; }, def: function () { return def; }, ideal: function () { return ideal; },
      start: start, stop: stop, draw: draw, running: function () { return !!T.timer; },
      pause: function (off) { if (off) { if (T.timer) { stop(); T.resume = true; } } else if (T.resume) { T.resume = false; start(); } } };
    return api;
  }

  /* ---------- 分頁 2 ---------- */
  var D = Rig('d', {
    after: function (R, def) {
      if (R.ems) say('d-say', '急停：步序清除、輸出全斷。' + def.cyls.map(function (c) { return c.n + ' 在 ' + R.pos[c.n].toFixed(2); }).join('、') + '。' + (def.key === 'e18' ? '試題原文只寫結果：「氣壓缸 A 需立即停止於該位置，氣壓缸 B、C 則停止於該步驟終點」。本站把 A 模擬成 5/3 中位封閉型、B、C 模擬成 5/2 雙線圈閥來做出這個結果，這是示範選擇，試題沒有指定閥型。' : ''), 'bad');
      else if (R.warn.length) say('d-say', '✖ 有 ' + R.warn.length + ' 步換步時氣缸不在圖上的位置。' + (def.cyls[0].valve === 'outonly' ? '單線圈閥只在動作那一步 OUT，一離開那一步線圈就 OFF，氣缸彈回去了（課程 4.5 的常見錯誤）。改用 SET／RST 保持。' : ''), 'bad');
      else if (R.done && R.k < 0) say('d-say', '✔ 一輪完成，回到 S0。圖上的每一格都對應一步，圓點沿著線走完了。', 'ok');
      else if (R.k >= 0 && !R.permit) say('d-say', '手動步進：S' + (20 + R.k) + ' 已經作用，等你按 ST 才輸出。');
      else say('d-say', '');
    }
  });
  function dLoad() {
    var k = $('d-pre').value, custom = k === 'custom';
    $('d-seq').hidden = !custom; $('d-valrow').hidden = !custom; $('d-err').textContent = '';
    $('d-ems').classList.remove('on');
    var def;
    if (custom) {
      var p = parseSeq($('d-seq').value, $('d-valve').value);
      if (p.err) { $('d-err').textContent = p.err; return false; }
      def = p.def; if (p.warn) $('d-err').textContent = p.warn;
    } else def = PRESET(k);
    D.load(def);
    return true;
  }
  $('d-pre').onchange = dLoad; $('d-valve').onchange = dLoad;
  $('d-seq').onchange = dLoad; $('d-seq').onkeydown = function (e) { if (e.key === 'Enter') dLoad(); };
  $('d-st').onclick = function () { D.st(); };
  $('d-ems').onclick = function () { var on = !D.S().ems; $('d-ems').classList.toggle('on', on); D.ems(on); };
  $('d-reset').onclick = function () { $('d-ems').classList.remove('on'); D.reset(); };
  dLoad();

  /* ---------- 分頁 3 ---------- */
  var S3 = Rig('s', {
    dead: function () { return $('s-dead').value; },
    timeout: function () { return $('s-to').checked; },
    after: function (R, def) {
      var dead = R.dead;
      if (R.alarm) say('s-say', '✖ ' + R.alarm + '：逾時監視發現了，記下異常、輸出全斷。氣缸停在：' + def.cyls.map(function (c) { return c.n + ' ' + R.pos[c.n].toFixed(2); }).join('、') + '。', 'bad');
      else if (R.k >= 0 && dead && condOf(def, def.steps[R.k]).indexOf(dead) >= 0 && R.stepT > 1500) say('s-say', '✖ 卡在 S' + (20 + R.k) + '：在等 ' + dead + '，可是 ' + dead + ' 壞了。輸出 ' + moveText(def.steps[R.k]) + ' 一直留著。' + (def.key === 'e18' && dead === 'a1' ? 'A+ 一直輸出，本站 A 缸的 5/3 中位封閉型閥不會自己回中位，A 已經跑過 a1，正往 a2 走。' : '') + ($('s-to').checked ? '' : '沒有逾時監視，機台就一直停在這裡，也沒有任何燈號告訴你。'), 'bad');
      else if (R.k < 0 && dead && def.cyls.some(function (c) { return c.marks[0][1] === dead; })) say('s-say', dead + ' 是原點感測器：S0 的原點條件永遠不成立，按 ST 根本啟動不了。', 'bad');
      else if (R.done && R.k < 0) say('s-say', dead ? '這一輪沒有用到 ' + dead + '，所以順利跑完。' : '✔ 感測器都正常，一輪跑完。', 'ok');
      else say('s-say', '');
    }
  });
  function sFill() {
    var def = PRESET($('s-pre').value), cur = $('s-dead').value, opts = ['<option value="">（都正常）</option>'];
    def.cyls.forEach(function (c) { c.marks.forEach(function (m) { opts.push('<option value="' + m[1] + '">' + m[1] + '</option>'); }); });
    $('s-dead').innerHTML = opts.join('');
    if ([].some.call($('s-dead').options, function (o) { return o.value === cur; })) $('s-dead').value = cur;
    else $('s-dead').value = def.key === 'e18' ? 'a1' : '';
    return def;
  }
  function sLoad() { S3.load(sFill()); }
  $('s-pre').onchange = function () { $('s-dead').value = ''; sLoad(); };
  $('s-dead').onchange = function () { S3.load(PRESET($('s-pre').value)); };
  $('s-to').onchange = function () { S3.load(PRESET($('s-pre').value)); };
  $('s-st').onclick = function () { S3.st(); };
  $('s-reset').onclick = function () { S3.reset(); };
  sLoad();

  /* ---------- 分頁切換 ---------- */
  function sync() {
    var hid = document.hidden;
    if (cur !== 'valve' || hid) { if (TV.timer) { clearInterval(TV.timer); TV.timer = null; TV.resume = true; } }
    else { if (TV.resume || !TV.timer) { TV.resume = false; vStart(); } vDraw(); }
    D.pause(cur !== 'dtd' || hid); S3.pause(cur !== 'sens' || hid);
    if (cur === 'dtd') D.draw(); if (cur === 'sens') S3.draw();
  }
  function show(t) {
    cur = t;
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['valve', 'dtd', 'sens', 'quiz'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
    sync();
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  document.addEventListener('visibilitychange', sync);
  var rsz = null; window.addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(function () { if (cur === 'valve') vDraw(); if (cur === 'dtd') D.draw(); if (cur === 'sens') S3.draw(); }, 150); });
  vReset();
  D.pause(true); S3.pause(true);
  if (/^#(valve|dtd|sens|quiz)$/.test(location.hash)) show(location.hash.slice(1));

  window.PneuLab = {
    show: show, current: function () { return cur; },
    valve: { reset: vReset, cmd: vCmd, demo: vDemo, tick: function (ms) { vTick(ms || 10); return V; }, S: function () { return V; }, stop: function () { if (TV.timer) { clearInterval(TV.timer); TV.timer = null; } } },
    dtd: Object.assign(D, { loadPreset: function (k, seq, valve) { $('d-pre').value = k; if (seq != null) $('d-seq').value = seq; if (valve) $('d-valve').value = valve; return dLoad(); } }),
    sens: Object.assign(S3, { setup: function (k, dead, to) { $('s-pre').value = k; sFill(); $('s-dead').value = dead || ''; $('s-to').checked = !!to; S3.load(PRESET(k)); } }),
    parse: parseSeq, condOf: condOf, defE18: defE18
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function uniq(ans, list) { var seen = {}, out = []; seen[ans] = 1; list.forEach(function (x) { x = String(x); if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
  var VAL = [['單線圈閥（彈簧復歸）', '回到彈簧側（常見是縮回）'], ['5/2 雙線圈閥', '保持最後的閥位，一路走到行程底'], ['5/3 中位封閉型閥', '停在斷電那一刻的位置'],
    ['5/3 中位加壓型閥', '回中位、兩側都有壓力，缸桿面積差會讓它慢慢移動'], ['5/3 中位排氣型閥', '回中位、兩側都沒有壓力，外力可以推動活塞桿']];
  function randSeq() {
    var cy = p1([['A', 'B'], ['A', 'B', 'C']]), pos = {}, seq = [], n = cy.length * 2;
    cy.forEach(function (c) { pos[c] = 0; });
    var order = cy.map(function (c) { return c + '+'; }).concat(cy.slice().reverse().map(function (c) { return c + '-'; }));
    if (Math.random() < 0.5 && cy.length === 2) order = ['A+', 'B+', 'B-', 'A-'];
    if (Math.random() < 0.4) order = cy.length === 2 ? ['A+', 'B+', 'A-', 'B-'] : ['A+', 'B+', 'C+', 'A-', 'B-', 'C-'];
    return order.slice(0, n);
  }
  var KIND = [
    // 1. 斷電中途
    function () {
      var v = p1(VAL);
      return { q: '氣缸伸出到一半時 PLC 輸出全斷（急停或停電）。用<b>' + v[0] + '</b>的氣缸會？（不考慮外部負載）', ans: v[1], wrong: uniq(v[1], VAL.map(function (x) { return x[1]; })), ex: '單線圈閥斷電回彈簧側；5/2 雙線圈閥保持最後閥位走到底；5/3 閥兩個線圈都斷電時彈簧讓閥回中位，中位封閉型封住兩側（停住）、中位加壓型兩側都有壓力（面積差會讓它慢慢動）、中位排氣型兩側無壓（可被外力推動）。' };
    },
    // 2. E18 急停
    function () {
      var c = p1([['A', '立即停止於該位置'], ['B', '停止於該步驟終點'], ['C', '停止於該步驟終點']]);
      return { q: '氣壓乙級 08000-1090201（變速迴路）的急停要求：動作中按急停，<b>' + c[0] + ' 缸</b>要？', ans: c[1], wrong: uniq(c[1], ['立即停止於該位置', '停止於該步驟終點', '立刻縮回原點', '兩側無壓，可以用手拉動', '繼續做完整個循環']), ex: '試題原文：「氣壓缸 A 需立即停止於該位置，氣壓缸 B、C 則停止於該步驟終點」，並且壓按 ST 無效、控制器輸出端斷電。原文沒有指定閥型；本站模擬時 A 用 5/3 中位封閉型、B、C 用 5/2 雙線圈閥做出這個結果。' };
    },
    // 3. 要停在中間選什麼閥
    function () {
      return { q: '位移－時間圖上 A 缸第 1 格只走到行程中間的 a1 就停，下一格不動。課文說 A 缸要用哪一種閥？', ans: '三位置中封閥（5/3 中位封閉型）', wrong: ['5/2 雙線圈閥', '單線圈閥（彈簧復歸）', '哪一種都可以', '兩個 5/2 雙線圈閥並聯'], ex: '5/2 雙線圈閥線圈 OFF 也保持閥位，會一路走到 a2，停不在中間。要停在中間得用 5/3 閥，課文寫的是三位置中封閥；中位加壓、中位排氣型能不能停穩，還要看負載與迴路。' };
    },
    // 3b. 1090201 與 1090202 的急停不同
    function () {
      var b = Math.random() < 0.5;
      return { q: '氣壓乙級 ' + (b ? '08000-1090202（釋壓迴路）' : '08000-1090201（變速迴路）') + '的急停要求是哪一個？', ans: b ? 'A、B、C 停止，B、C 兩側無壓（可以用手拉動）' : 'A 立即停止於該位置，B、C 停止於該步驟終點', wrong: [b ? 'A 立即停止於該位置，B、C 停止於該步驟終點' : 'A、B、C 停止，B、C 兩側無壓（可以用手拉動）', '全部立刻縮回原點', '急停只要紅燈閃爍，動作照做', 'A、B、C 都走完整個循環'], ex: '兩題的急停規定不同：1090201 要 A 立即停在該位置、B、C 停在該步驟終點；1090202 要 A、B、C 停止，B、C 兩側無壓、可以用手拉動。兩題都要壓按 ST 無效、輸出端斷電。' };
    },
    // 3c. 兩個線圈同時通電
    function () {
      return { q: '5/2 雙線圈閥的「+」「−」兩個線圈同時通電，會怎樣？', ans: '各廠、各型不同，程式要互鎖，不要同時通電', wrong: ['一定停在中間', '一定往前', '一定往後', '一定燒掉線圈'], ex: '兩個線圈同時通電的結果各廠不同，不要賭它。程式裡 A+、A- 互鎖；STL 相鄰兩步一個 A+、一個 A-，換步那一個掃描要加 ANI。' };
    },
    // 4. 雙線圈閥水平線
    function () {
      return { q: '雙線圈閥（5/2）的 A 缸在第 1 格伸到 a1，第 2、3 格圖上是水平線。第 2、3 格要不要繼續輸出 A+？', ans: '不用，線圈 OFF 也保持閥位，A 停在端點', wrong: ['要，不然 A 會縮回', '要輸出 A-', '要用 SET A+', '要每格都 OUT A+ 和 A-'], ex: '課文：雙線圈閥線圈都 OFF 會保持最後的閥位，已經在端點就不會跑，所以水平線不用輸出。' };
    },
    // 5. 單線圈 OUT 只在一步
    function () {
      return { q: '單線圈閥的 A 缸，程式只在 S20 寫 OUT Y0（A+）。進到 S21（B+）時 A 缸會？', ans: '線圈 OFF，A 彈回縮回', wrong: ['保持伸出', '停在原地', '繼續伸出', '看 B 缸而定'], ex: '離開步時 OUT 的輸出自動 OFF。單線圈閥要保持就用 SET／RST，或每一步都寫 OUT（課文的常見錯誤）。' };
    },
    // 6. 時段數與步號線
    function () {
      var n = p1([3, 4, 6, 8, 9]);
      return { q: '一張位移－時間圖有 <b>' + n + '</b> 個時段。圖上有幾條步號線、STL 要幾步（不含 S0）？', ans: (n + 1) + ' 條線、' + n + ' 步', wrong: uniq((n + 1) + ' 條線、' + n + ' 步', [n + ' 條線、' + n + ' 步', (n + 1) + ' 條線、' + (n + 1) + ' 步', n + ' 條線、' + (n - 1) + ' 步', (n + 2) + ' 條線、' + n + ' 步']), ex: '一格＝一個時段＝一步。線比格多一條，最後一條寫「' + (n + 1) + '=1」表示回到第 1 條。E18：9 條線、8 個時段＝8 步。' };
    },
    // 7. 讀順序：第 k 步的輸出和條件
    function () {
      var seq = randSeq(), k = Math.floor(Math.random() * seq.length), t = seq[k], c = t[0].toLowerCase() + (t[1] === '+' ? '1' : '0');
      var ans = '輸出 ' + t + '，等 ' + c, other = c.slice(0, 1) + (c[1] === '1' ? '0' : '1');
      return { q: '動作順序 <b>' + seq.join('　') + '</b>（兩位置的雙線圈缸，x0 後端、x1 前端）。第 ' + (k + 1) + ' 步 S' + (20 + k) + ' 要做什麼？', ans: ans, wrong: uniq(ans, ['輸出 ' + t + '，等 ' + other, '輸出 ' + seq[(k + 1) % seq.length] + '，等 ' + c, '輸出 ' + t + '，等 T0 計時', '輸出 ' + t[0] + (t[1] === '+' ? '-' : '+') + '，等 ' + c]), ex: '斜線就是輸出，斜線的終點就是換步條件：' + t + ' 往' + (t[1] === '+' ? '前' : '後') + '走，到 ' + c + ' 才換下一步。' };
    },
    // 8. 同一格兩支缸
    function () {
      var pair = p1([['A-', 'B-', 'a0', 'b0'], ['A-', 'C-', 'a0', 'c0'], ['B+', 'C+', 'b1', 'c1']]);
      return { q: '位移－時間圖同一格裡 ' + pair[0] + ' 和 ' + pair[1] + ' 兩條斜線同時走。這一步的換步條件？', ans: pair[2] + ' 而且 ' + pair[3], wrong: [pair[2] + ' 或 ' + pair[3], '只要 ' + pair[2], '只要 ' + pair[3], '等 1 秒'], ex: '同一格兩條斜線＝同一步輸出兩個線圈，兩個都到才換步（AND）。只等一個，另一支還沒到就進下一輪，可能撞機。' };
    },
    // 9. 斜率＝速度
    function () {
      return { q: 'E18 第 7 格 A 缸的斜線比第 6 格陡。代表什麼？程式要怎麼做？', ans: '第 7 格比較快，要同時輸出 A+ 和快速閥', wrong: ['第 7 格比較慢，要關快速閥', 'A 缸要換成單線圈閥', '要用計時器控制速度', '沒有意義，畫圖的誤差'], ex: '斜率不同＝速度不同。試題寫第 6 格慢、第 7 格快；本站用 Y11 快速閥代表快速（A 缸全行程 2 秒變 1 秒）。' };
    },
    // 10. 感測器壞了卡哪一步
    function () {
      var seq = randSeq(), plus = []; for (var pi = 0; pi < seq.length; pi++) if (seq[pi][1] === '+') plus.push(pi); var k = plus[Math.floor(Math.random() * plus.length)], t = seq[k], c = t[0].toLowerCase() + '1';
      var first = -1; for (var i = 0; i < seq.length; i++) { var ti = seq[i], ci = ti[0].toLowerCase() + (ti[1] === '+' ? '1' : '0'); if (ci === c) { first = i; break; } }
      var ans = 'S' + (20 + first) + '（第 ' + (first + 1) + ' 格），' + seq[first] + ' 一直輸出';
      return { q: '動作順序 <b>' + seq.join('　') + '</b>。感測器 <b>' + c + '</b> 壞了（一直 OFF）。按 ST 後步序會卡在哪？', ans: ans, wrong: uniq(ans, ['S20（第 1 格），' + seq[0] + ' 一直輸出', '跑完一輪才停', '不會卡，PLC 會跳過壞掉的感測器', 'S' + (20 + seq.length - 1) + '（最後一格）', 'S' + (21 + first) + '（第 ' + (first + 2) + ' 格）']), ex: '第一個要等 ' + c + ' 的是 ' + seq[first] + ' 那一步。條件永遠不成立，步序停在那裡，輸出也一直留著。' };
    },
    // 11. 原點感測器壞
    function () {
      var c = p1(['a0', 'b0']);
      return { q: '原點感測器 <b>' + c + '</b> 壞了（一直 OFF），S0 的啟動條件寫了「各缸都在原點」。按 ST 會？', ans: '原點條件不成立，根本啟動不了', wrong: ['照常啟動', '跑到一半才停', '自動跳過 ' + c, '啟動後 ' + c.toUpperCase().charAt(0) + ' 缸往反方向衝'], ex: 'S0 的啟動條件加上「兩缸都在原位」（課文 6-5）。原點感測器壞了，條件永遠不成立。' };
    },
    // 12. 中封閥 + 中間感測器壞
    function () {
      return { q: 'E18 的 a1（A 缸中間）壞了。第 1 格 S20 輸出 A+、等 a1。A 缸會怎樣？', ans: 'A+ 一直輸出，A 跑過 a1 一路到 a2，步序卡在 S20', wrong: ['停在 a1 等', '回到 a0', '停在原地不動', '跳到第 2 格'], ex: '5/3 閥要線圈 OFF 才回中位。a1 沒來就不換步，A+ 一直在，A 就走到行程底 a2。' };
    },
    // 13. 為什麼用感測器不用計時器
    function () {
      return { q: '換步條件為什麼用「動作完成的感測器」，不用計時器猜時間？', ans: '氣壓不足時氣缸變慢，計時器照樣換步，機構會撞', wrong: ['計時器比較貴', 'FX3S 沒有計時器', '感測器比較快', '試題規定不能用計時器'], ex: '課文 6-5 的提醒。圖上標「等 T 秒」的時段才用計時器。' };
    },
    // 14. 相鄰步 A+、A- 互鎖
    function () {
      return { q: 'S26 輸出 A+、S27 輸出 A-（相鄰兩步）。換步的那一個掃描會發生什麼？', ans: '兩步同時作用一個掃描，A+、A- 可能同時 ON，要加互鎖', wrong: ['完全不會重疊', 'PLC 自動幫你互鎖', 'A 缸會停一秒', '只有 SET 會重疊，OUT 不會'], ex: '課文：轉移那一圈前後兩步同時作用，相反方向的輸出要加互鎖（ANI）。E18 提示也提到。' };
    },
    // 15. 逾時值怎麼定
    function () {
      var t = p1([2, 3, 4]);
      return { q: '某一步正常 ' + t + ' 秒到位，要配一個逾時計時器發現感測器故障。逾時值大約設多少？', ans: (t * 1.5) + '～' + (t * 2) + ' 秒', wrong: uniq((t * 1.5) + '～' + (t * 2) + ' 秒', [t + ' 秒整', (t * 0.5) + ' 秒', (t * 10) + ' 秒', '不用設，PLC 會自己發現']), ex: '課程第 5 章：先量正常動作時間，再乘 1.5～2 倍。太短會誤報，太長卡很久才發現。' };
    },
    // 16. 手動步進
    function () {
      return { q: '氣壓乙級的「手動步進」模式，每按一次 ST 會？', ans: '只走一個時段（一格）', wrong: ['走完一整個循環', '走兩格', '只動一支缸的一半行程', '回到原點'], ex: '一格＝一個時段＝一步，手動步進每按一次 ST 就走一格。E18 的提示用執行許可 M40，換步時清掉。' };
    },
    // 17. 黃燈
    function () {
      return { q: 'E18 的黃燈（Y10）什麼時候閃？', ans: '復歸中，0.5 秒 ON／0.5 秒 OFF', wrong: ['感測器故障時', '運轉中', '急停按下時恆亮', '待機時'], ex: 'E18：解除急停後切到復歸模式按復歸鈕，黃燈 0.5 秒閃爍，先 B、C 再 A 回原點。試題沒有規定感測器故障的燈號。' };
    }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) window.PneuLab.quiz = window.LabQuiz('pn-quiz', gen);
  window.PneuLab.quizGen = gen; window.PneuLab.quizKinds = KIND;
})();
