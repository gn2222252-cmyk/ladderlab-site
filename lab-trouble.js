/* 故障排除解謎：每一題的觀察結果都由同一個模型算出來（真相 → 各項檢查），所以一定前後一致；
   verify() 再檢查：症狀成立、沒故障時機台會動、每個錯誤答案至少有一項檢查看得出差別、燈號規則成立。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }

  /* ================= 機台 ================= */
  var M = {
    conv: { name: '輸送帶', ins: [['X0', '啟動按鈕（常開）', 'btn'], ['X1', '停止按鈕（常開）', 'btn'], ['X2', '急停（現場常閉）', 'nc']], outs: [['Y0', '輸送帶接觸器'], ['Y1', '運轉指示燈']],
      il: 'LD X0\nOR Y0\nANI X1\nAND X2\nOUT Y0\nLD Y0\nOUT Y1', act: '測試：按一下啟動 X0。' },
    cyl: { name: '氣缸推料', ins: [['X0', '啟動按鈕（常開）', 'btn'], ['X2', '前限感測器（NPN 近接）', 'sensor']], outs: [['Y0', '伸出電磁閥'], ['Y1', '伸出中指示燈'], ['Y2', '到位燈']],
      il: 'LD X0\nOUT Y0\nLD Y0\nOUT Y1\nLD X2\nOUT Y2', act: '測試：按住啟動 X0（氣缸正常的話會伸到底，前限感測器看到）。', detect: { X2: 'Y0' } },
    door: { name: '自動門', ins: [['X0', '開門按鈕（常開）', 'btn'], ['X3', '急停（現場常閉）', 'nc']], outs: [['Y0', '開門馬達接觸器'], ['Y1', '開門中指示燈']],
      il: 'LD X0\nAND X3\nOUT Y0\nLD Y0\nOUT Y1', act: '測試：按住開門 X0。' }
  };
  /* 每一題：機台、要看的輸出、按了哪些按鈕、真相（類型＋對象）、程式（logic 題才和機台的正確程式不同） */
  var S = [
    { id: 'c-stop', m: 'conv', main: 'Y0', grp: 'Y1', press: ['X0'], truth: ['stop'], off: ['Y1'], sym: '早上開機，按啟動輸送帶不轉，運轉燈也不亮。昨天下班前有人用電腦改過程式。' },
    { id: 'c-wire', m: 'conv', main: 'Y0', grp: 'Y1', press: ['X0'], truth: ['wire_in', 'X0'], sym: '按啟動輸送帶不轉。操作員說按鈕按起來手感正常。' },
    { id: 'c-load', m: 'conv', main: 'Y0', grp: 'Y1', press: ['X0'], truth: ['load_bad', 'Y0'], on: ['Y1'], sym: '按啟動，運轉燈有亮，但輸送帶不轉。' },
    { id: 'c-com', m: 'conv', main: 'Y0', grp: 'Y1', press: ['X0'], truth: ['com'], off: ['Y1'], sym: '換過端子台之後，按啟動輸送帶不轉，運轉燈也不亮。' },
    { id: 'c-burn', m: 'conv', main: 'Y0', grp: 'Y1', press: ['X0'], truth: ['out_burn', 'Y0'], on: ['Y1'], sym: '上週接觸器燒過一次，換新後按啟動輸送帶還是不轉；運轉燈有亮。' },
    { id: 'c-psu', m: 'conv', main: 'Y0', grp: 'Y1', press: ['X0'], truth: ['load_psu'], off: ['Y1'], sym: '按啟動輸送帶不轉，運轉燈也不亮。配電箱裡有一顆 24V 電源供應器的燈不亮。' },
    { id: 'c-logic', m: 'conv', main: 'Y0', grp: 'Y1', press: ['X0'], truth: ['logic'], il: 'LD X0\nOR Y0\nAND X1\nAND X2\nOUT Y0\nLD Y0\nOUT Y1', sym: '新來的工程師改寫了停止的部分，之後按啟動輸送帶就不會動了。' },
    { id: 'c-ems', m: 'conv', main: 'Y0', grp: 'Y1', press: ['X0'], truth: ['wire_in', 'X2'], sym: '清潔人員擦過操作箱之後，按啟動輸送帶不轉。急停按鈕看起來沒有被按下。' },
    { id: 'b-sbad', m: 'cyl', main: 'Y2', grp: 'Y1', press: ['X0'], truth: ['sensor_bad', 'X2'], on: ['Y0'], sym: '按住啟動，氣缸伸到底了，但到位燈 Y2 不亮。' },
    { id: 'b-swire', m: 'cyl', main: 'Y2', grp: 'Y1', press: ['X0'], truth: ['wire_in', 'X2'], on: ['Y0'], sym: '按住啟動，氣缸伸到底了，到位燈不亮。有人說感測器上的小燈是亮的。' },
    { id: 'b-spwr', m: 'cyl', main: 'Y2', grp: 'Y1', press: ['X0'], truth: ['sensor_pwr', 'X2'], on: ['Y0'], sym: '移過感測器的位置之後，氣缸伸到底，到位燈不亮。' },
    { id: 'b-valve', m: 'cyl', main: 'Y0', grp: 'Y1', press: ['X0'], truth: ['load_bad', 'Y0'], on: ['Y1'], sym: '按住啟動，伸出中指示燈有亮，氣缸卻完全不動。氣壓表正常。' },
    { id: 'd-ems', m: 'door', main: 'Y0', grp: 'Y1', press: ['X0'], truth: ['wire_in', 'X3'], sym: '施工後自動門按開門沒反應。急停按鈕沒有被按下。' },
    { id: 'd-logic', m: 'door', main: 'Y0', grp: 'Y1', press: ['X0'], truth: ['logic'], il: 'LD X0\nANI X3\nOUT Y0\nLD Y0\nOUT Y1', sym: '工程師說「急停要用常閉接點」，把程式改了，之後按開門就沒反應。' },
    { id: 'd-ss', m: 'door', main: 'Y0', grp: 'Y1', press: ['X0'], truth: ['ss'], sym: '整理過 PLC 下方的配線後，按開門沒反應。' },
    { id: 'd-motor', m: 'door', main: 'Y0', grp: 'Y1', press: ['X0'], truth: ['load_bad', 'Y0'], on: ['Y1'], sym: '按開門，開門中指示燈亮，門卻不動。' }
  ];
  var TYPES = {
    stop: function () { return 'PLC 在 STOP'; },
    ss: function () { return '輸入共點 S/S 沒接'; },
    logic: function () { return '程式邏輯寫錯'; },
    com: function () { return '輸出的 COM 沒接'; },
    load_psu: function () { return '負載用的 24V 電源沒電'; },
    wire_in: function (t, sc) { return t + '（' + label(sc, t) + '）這一路斷了：按鈕接點或線'; },
    sensor_bad: function (t, sc) { return t + '（' + label(sc, t) + '）感測器本身壞了'; },
    sensor_pwr: function (t, sc) { return t + '（' + label(sc, t) + '）感測器的電源線沒接'; },
    out_burn: function (t, sc) { return t + ' 這一點輸出損壞'; },
    load_bad: function (t, sc) { return t + '（' + label(sc, t) + '）負載本身壞了'; }
  };
  function label(sc, d) { var m = M[sc.m], all = m.ins.concat(m.outs); for (var i = 0; i < all.length; i++) if (all[i][0] === d) return all[i][1]; return d; }
  function hypName(h, sc) { return TYPES[h[0]](h[1], sc); }
  function key(h) { return h[0] + (h[1] ? ':' + h[1] : ''); }

  /* ================= 程式 ================= */
  function parse(il) { return il.trim().split('\n').map(function (l) { var p = l.trim().split(/\s+/); return { op: p[0], d: p[1] }; }); }
  function runIL(il, X, force) {
    var Y = {}, code = parse(il), rungs = [], cur = null, acc = 0;
    for (var pass = 0; pass < 3; pass++) {             // 自保持要多算幾圈才穩定
      rungs = []; cur = null;
      code.forEach(function (c) {
        var v = c.d.charAt(0) === 'X' ? X[c.d] : Y[c.d] || 0;
        if (c.op === 'LD' || c.op === 'LDI') { cur = { parts: [] }; rungs.push(cur); acc = c.op === 'LD' ? v : 1 - v; }
        else if (c.op === 'AND') acc = acc & v; else if (c.op === 'ANI') acc = acc & (1 - v);
        else if (c.op === 'OR') acc = acc | v; else if (c.op === 'ORI') acc = acc | (1 - v);
        if (c.op === 'OUT') { var o = force && force.hasOwnProperty(c.d) ? force[c.d] : acc; Y[c.d] = o; cur.parts.push({ coil: c.d, on: o }); }
        else cur.parts.push({ op: c.op, d: c.d, v: v, pass: /I$/.test(c.op) ? 1 - v : v });
      });
    }
    return { Y: Y, rungs: rungs };
  }

  /* ================= 模型：假設 h 時，每一項檢查會看到什麼 ================= */
  function sim(sc, h) {
    var m = M[sc.m], f = h ? h[0] : null, t = h ? h[1] : null, il = (f === 'logic' && sc.truth[0] === 'logic') ? sc.il : m.il;
    var force = (f === 'logic' && sc.truth[0] !== 'logic') ? (function () { var o = {}; o[sc.main] = 0; return o; })() : null;
    var sensors = m.ins.filter(function (x) { return x[2] === 'sensor'; }).map(function (x) { return x[0]; });
    var moves = {}, X = {}, sled = {}, out = {}, prog, k;
    for (var it = 0; it < 4; it++) {                      // 感測器要等負載動了才看得到：迭代到穩定
      m.ins.forEach(function (x) {
        var d = x[0], kind = x[2], closed;
        if (kind === 'btn') closed = sc.press.indexOf(d) >= 0 ? 1 : 0;
        else if (kind === 'nc') closed = 1;
        else { var need = m.detect && m.detect[d], sees = need ? (moves[need] ? 1 : 0) : 1, pw = !(f === 'sensor_pwr' && t === d); sled[d] = pw && sees && !(f === 'sensor_bad' && t === d) ? 1 : 0; closed = sled[d]; }
        X[d] = closed && !(f === 'wire_in' && t === d) && f !== 'ss' ? 1 : 0;
      });
      if (f === 'stop') { prog = { Y: {}, rungs: [] }; m.outs.forEach(function (o) { prog.Y[o[0]] = 0; }); }
      else prog = runIL(il, X, force);
      m.outs.forEach(function (o) {
        var y = o[0], on = prog.Y[y] ? 1 : 0, cond = on && !(f === 'out_burn' && t === y) && f !== 'com';
        out[y] = on;
        var v = cond && f !== 'load_psu' ? 24 : 0;
        moves[y] = v === 24 && !(f === 'load_bad' && t === y) ? 1 : 0;
        moves['v' + y] = v;
      });
    }
    var mon = f === 'stop' ? 'STOP' : prog.rungs.map(function (r) { return r.parts.map(function (p) { return p.coil ? '(' + p.coil + '=' + p.on + ')' : p.op + ' ' + p.d + '=' + p.v; }).join(' '); }).join(' | ');
    var vs = {}; sensors.forEach(function (d) { vs[d] = f === 'sensor_pwr' && t === d ? 0 : 24; });
    return {
      run: f === 'stop' ? 'STOP' : 'RUN', X: X, out: out, sled: sled, vsens: vs, vload: moves['v' + sc.main], vpsu: f === 'load_psu' ? 0 : 24,
      grp: moves[sc.grp] ? 1 : 0, grpOut: out[sc.grp], moves: moves[sc.main], mv: moves, mon: mon, rungs: prog.rungs, il: il
    };
  }
  /* 檢查項目：各自的時間、能不能用在這台、觀察結果的「指紋」（拿來比對） */
  var CHECKS = [
    { k: 'run', name: '看 RUN／STOP', cost: 1, fp: function (o) { return o.run; } },
    { k: 'in', name: '看 IN 燈（X 指示燈）', cost: 1, fp: function (o) { return JSON.stringify(o.X); } },
    { k: 'out', name: '看 OUT 燈（Y 指示燈）', cost: 1, fp: function (o) { return JSON.stringify(o.out); } },
    { k: 'mon', name: '接電腦看程式監看', cost: 3, fp: function (o) { return o.mon; } },
    { k: 'sled', name: '看感測器自己的燈', cost: 1, ok: function (sc) { return M[sc.m].ins.some(function (x) { return x[2] === 'sensor'; }); }, fp: function (o) { return JSON.stringify(o.sled); } },
    { k: 'vsens', name: '量感測器電源（棕－藍）', cost: 3, ok: function (sc) { return M[sc.m].ins.some(function (x) { return x[2] === 'sensor'; }); }, fp: function (o) { return JSON.stringify(o.vsens); } },
    { k: 'grp', name: '看同一組 COM 的另一個輸出', cost: 1, fp: function (o) { return o.grpOut + '/' + o.grp; } },
    { k: 'vload', name: '量負載兩端電壓', cost: 3, fp: function (o) { return String(o.vload); } },
    { k: 'vpsu', name: '量負載用 24V 電源', cost: 3, fp: function (o) { return String(o.vpsu); } }
  ];
  var ORDER = ['run', 'in', 'out', 'mon', 'sled', 'vsens', 'grp', 'vpsu', 'vload'];   // 先看不用工具的，再監看，最後量
  function checksOf(sc) { return CHECKS.filter(function (c) { return !c.ok || c.ok(sc); }); }
  function candidates(sc) {
    var m = M[sc.m], c = [['stop'], ['ss'], ['logic'], ['com'], ['load_psu']];
    m.ins.forEach(function (x) { c.push(['wire_in', x[0]]); if (x[2] === 'sensor') { c.push(['sensor_bad', x[0]]); c.push(['sensor_pwr', x[0]]); } });
    c.push(['out_burn', sc.main]); c.push(['load_bad', sc.main]);
    return c;
  }
  function fitsSymptom(sc, o) { return !o.moves && (sc.on || []).every(function (y) { return o.mv[y]; }) && (sc.off || []).every(function (y) { return !o.mv[y]; }); }
  function explains(sc) { return candidates(sc).filter(function (h) { return fitsSymptom(sc, sim(sc, h)); }); }   // 說得通報修症狀的假設
  function consistent(sc, obs, done) {      // 和症狀、目前看到的結果都一致的假設
    return explains(sc).filter(function (h) { var o = sim(sc, h); return done.every(function (k) { var c = CHECKS.filter(function (x) { return x.k === k; })[0]; return c.fp(o) === c.fp(obs); }); });
  }
  function bestCost(sc) {                    // 最少要花幾分鐘才能唯一確定（窮舉檢查的組合）
    var cs = checksOf(sc), truth = sim(sc, sc.truth), others = explains(sc).filter(function (h) { return key(h) !== key(sc.truth); }).map(function (h) { return sim(sc, h); });
    var best = null;
    for (var mask = 1; mask < (1 << cs.length); mask++) {
      var set = cs.filter(function (c, i) { return mask & (1 << i); }), cost = set.reduce(function (a, c) { return a + c.cost; }, 0);
      if (best && cost >= best.cost) continue;
      if (others.every(function (o) { return set.some(function (c) { return c.fp(o) !== c.fp(truth); }); })) best = { cost: cost, set: set.map(function (c) { return c.k; }) };
    }
    return best;
  }
  function orderPath(sc) {                   // 照建議順序查，跳過「查了也分不出來」的項目
    var obs = sim(sc, sc.truth), done = [], cost = 0, cs = checksOf(sc).map(function (c) { return c.k; });
    for (var i = 0; i < ORDER.length; i++) {
      var k = ORDER[i]; if (cs.indexOf(k) < 0) continue;
      var before = consistent(sc, obs, done); if (before.length <= 1) break;
      var after = consistent(sc, obs, done.concat([k]));
      if (after.length < before.length) { done.push(k); cost += CHECKS.filter(function (c) { return c.k === k; })[0].cost; }
    }
    return { done: done, cost: cost, left: consistent(sc, obs, done) };
  }

  /* ================= verify：每一題的資料是否前後一致 ================= */
  var OUTSIDE = { out_burn: 1, com: 1, load_psu: 1, load_bad: 1 }, INSIDE = { wire_in: 1, sensor_bad: 1, sensor_pwr: 1, ss: 1 };
  function verify() {
    var probs = [];
    S.forEach(function (sc) {
      var m = M[sc.m], tr = sim(sc, sc.truth), ok = sim(sc, null), p = function (s) { probs.push(sc.id + '：' + s); };
      if (!candidates(sc).some(function (h) { return key(h) === key(sc.truth); })) p('真相不在選項裡');
      if (!fitsSymptom(sc, tr)) p('真相之下的結果和報修單寫的不一樣');
      if (!ok.moves) p('沒有故障時負載也不會動，題目本身有問題');
      explains(sc).forEach(function (h) {
        if (key(h) === key(sc.truth)) return;
        var o = sim(sc, h); if (checksOf(sc).every(function (c) { return c.fp(o) === c.fp(tr); })) p('「' + hypName(h, sc) + '」和真相所有檢查都一樣，分不出來');
      });
      // 燈號規則
      if (tr.run === 'STOP' && sc.truth[0] !== 'stop') p('STOP 卻不是 stop');
      if (tr.out[sc.main] && !tr.moves && !OUTSIDE[sc.truth[0]]) p('OUT 燈亮但負載不動，真相卻不在輸出側');
      // 該亮的輸入：常閉的、按著的、以及「東西真的到了」的感測器（要等負載動才到的，看真相下負載有沒有動）
      var need = m.ins.filter(function (x) { var dep = m.detect && m.detect[x[0]]; return x[2] === 'nc' || sc.press.indexOf(x[0]) >= 0 || (x[2] === 'sensor' && (!dep || tr.mv[dep])); });
      var dark = need.filter(function (x) { return !tr.X[x[0]]; });
      if (dark.length && tr.run === 'RUN' && !INSIDE[sc.truth[0]]) p('該亮的 IN 燈不亮，真相卻不在輸入側');
      if (!dark.length && !tr.out[sc.main] && tr.run === 'RUN' && sc.truth[0] !== 'logic') p('IN 燈都正常、OUT 不亮，真相卻不是程式');
      if (sc.truth[0] === 'logic' && sc.il === m.il) p('logic 題的程式和正確程式一樣');
      if (sc.truth[0] !== 'logic' && sc.il) p('不是 logic 題卻改了程式');
      if (!bestCost(sc)) p('找不到能確定答案的檢查組合');
    });
    return { ok: !probs.length, problems: probs, count: S.length };
  }

  /* ================= 成績 ================= */
  var SKEY = 'll_trouble_stats';
  function getStats() { try { var s = JSON.parse(localStorage.getItem(SKEY) || '{}'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; } }
  function putStats(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { } }
  function record(id, ok, cost, best) {
    var s = getStats(); s.done = s.done || {}; s.wrong = s.wrong || [];
    var d = s.done[id] || { tries: 0, solved: 0, bestCost: null };
    d.tries++; if (ok) { d.solved = 1; d.bestCost = d.bestCost == null ? cost : Math.min(d.bestCost, cost); }
    s.done[id] = d;
    s.wrong = s.wrong.filter(function (x) { return x !== id; }); if (!ok) s.wrong.push(id);
    s.total = (s.total || 0) + 1; s.correct = (s.correct || 0) + (ok ? 1 : 0);
    putStats(s); return s;
  }
  function statLine() { var s = getStats(), solved = Object.keys(s.done || {}).filter(function (k) { return s.done[k].solved; }).length; $('tstat').textContent = '已解 ' + solved + ' / ' + S.length + ' 題' + (s.total ? '　答對率 ' + Math.round(100 * s.correct / s.total) + '%' : '') + ((s.wrong || []).length ? '　待重做 ' + s.wrong.length + ' 題' : ''); }

  /* ================= 畫面 ================= */
  var G = { i: 0, done: [], cost: 0, over: false, gen: 0 };
  function cname(k) { return CHECKS.filter(function (c) { return c.k === k; })[0].name; }
  function show(i) {
    G = { i: i, done: [], cost: 0, over: false, gen: G.gen + 1 };
    var sc = S[i], m = M[sc.m];
    $('tpick').value = i;
    $('ttitle').textContent = '第 ' + (i + 1) + ' 題　' + m.name;
    $('tsym').textContent = sc.sym; $('tact').textContent = m.act;
    $('tio').innerHTML = m.ins.map(function (x) { return '<b>' + x[0] + '</b><span>' + x[1] + '</span>'; }).join('') + m.outs.map(function (y) { return '<b>' + y[0] + '</b><span>' + y[1] + (y[0] === sc.main ? '　← 報修的東西' : '') + '</span>'; }).join('');
    $('til').textContent = (sc.il || m.il);
    var box = $('tchecks'); box.innerHTML = '';
    checksOf(sc).forEach(function (c) { var b = el('button', '', c.name + '<small>約 ' + c.cost + ' 分鐘</small>'); b.type = 'button'; b.dataset.k = c.k; b.onclick = function () { look(c.k); }; box.appendChild(b); });
    $('tfinds').innerHTML = ''; $('treveal').innerHTML = ''; say('tsay', '');
    var sel = $('tdiag'); sel.innerHTML = '<option value="">（選一個原因）</option>';
    candidates(sc).forEach(function (h) { var o = el('option', '', hypName(h, sc)); o.value = key(h); sel.appendChild(o); });
    $('tsubmit').disabled = false; $('tclock').textContent = 0;
    statLine();
  }
  function ledHTML(map, names, out) { return '<div class="leds">' + Object.keys(map).map(function (d) { return '<span class="led2' + (out ? ' out' : '') + (map[d] ? ' on' : '') + '"><i></i>' + d + ' <em>' + names(d) + '</em></span>'; }).join('') + '</div>'; }
  function findingHTML(k, sc, o) {
    var lb = function (d) { return label(sc, d); };
    if (k === 'run') return o.run === 'RUN' ? 'RUN／STOP 開關在 <b>RUN</b>。' : 'RUN／STOP 開關在 <b>STOP</b>：程式不執行，輸出全部 OFF。';
    if (k === 'in') return '按著的狀態下：' + ledHTML(o.X, lb);
    if (k === 'out') return ledHTML(o.out, lb, true);
    if (k === 'mon') {
      if (o.run === 'STOP') return 'GX Works2 顯示 PLC 是 STOP，程式沒有在執行。';
      return o.rungs.map(function (r) { return '<div class="rung">' + r.parts.map(function (p) { return p.coil ? '<span class="cl' + (p.on ? ' on' : '') + '">( ' + p.coil + ' )</span>' : '<span class="ct' + (p.pass ? ' on' : '') + '">' + (/I$/.test(p.op) ? '┤/' : '┤') + p.d + '├</span>'; }).join('<span>─</span>') + '</div>'; }).join('') + '<small class="why">綠色＝這個接點現在導通；黃色＝線圈 ON。</small>';
    }
    if (k === 'sled') return ledHTML(o.sled, lb) + '<small class="why">感測器上的動作指示燈：亮＝它自己有偵測到東西。</small>';
    if (k === 'vsens') return Object.keys(o.vsens).map(function (d) { return d + ' 感測器 棕（+）對 藍（0V）：<span class="volt">' + o.vsens[d] + ' V</span>'; }).join('<br>');
    if (k === 'grp') return sc.grp + '（' + lb(sc.grp) + '）：OUT 燈' + (o.grpOut ? '亮' : '不亮') + '，實際' + (o.grp ? '<b>有動作</b>' : '<b>沒有動作</b>') + '。';
    if (k === 'vload') return sc.main + '（' + lb(sc.main) + '）兩端：<span class="volt">' + o.vload + ' V</span>';
    if (k === 'vpsu') return '負載用的 24V 電源 +24V 對 0V：<span class="volt">' + o.vpsu + ' V</span>';
    return '';
  }
  function look(k) {
    if (G.over || G.done.indexOf(k) >= 0) return null;
    var sc = S[G.i], o = sim(sc, sc.truth), c = CHECKS.filter(function (x) { return x.k === k; })[0];
    G.done.push(k); G.cost += c.cost; $('tclock').textContent = G.cost;
    var b = $('tchecks').querySelector('[data-k="' + k + '"]'); if (b) b.classList.add('done');
    var f = el('div', 'find', '<h4>' + c.name + '　<small>（+' + c.cost + ' 分鐘）</small></h4>' + findingHTML(k, sc, o));
    $('tfinds').insertBefore(f, $('tfinds').firstChild);
    return o;
  }
  var WHY = {
    stop: 'RUN／STOP 開關在 STOP：程式不執行、輸出全部 OFF，IN 燈照樣會亮。這是一秒就能排除的項目，所以永遠第一個看。',
    ss: '每一個 X 燈都不亮，連平常就該亮的急停（常閉）也不亮：不是某一路線斷，而是全部輸入的共點 S/S 沒接（漏型接法 S/S 要接 24V）。',
    logic: 'X 燈都正常、PLC 在 RUN，Y 燈卻不亮：電已經進來了，是程式條件不成立。監看就看得到是哪一個接點擋住。',
    com: 'OUT 燈亮、負載兩端 0V，而且同一組 COM 的其他輸出也一起不動、負載電源有 24V：共用的 COM 沒接（漏型輸出 COM 要接 0V）。',
    load_psu: 'OUT 燈亮、負載兩端 0V，同組的輸出也都不動，量負載電源是 0V：電源供應器沒電，PLC 和配線都沒錯。',
    wire_in: '該亮的 X 燈不亮，但其他輸入正常、PLC 在 RUN：訊號沒進到這一點，是這一路的按鈕接點或線，跟程式無關。',
    sensor_bad: '感測器自己的燈也不亮，量感測器電源有 24V：感測器有電卻偵測不到，感測器壞了（或位置、感測距離不對）。',
    sensor_pwr: '感測器自己的燈不亮，量棕－藍是 0V：感測器沒有電，是電源線的問題。',
    out_burn: 'OUT 燈亮、負載兩端 0V，但同一組 COM 的另一個輸出正常：COM 沒問題，是這一點輸出沒有導通。',
    load_bad: 'OUT 燈亮、負載兩端也量得到 24V，東西卻不動：PLC 和配線都送到了，問題在負載本身（線圈、馬達、機構）。'
  };
  function submit() {
    var v = $('tdiag').value; if (!v || G.over) return null;
    var sc = S[G.i], ok = v === key(sc.truth), best = bestCost(sc), path = orderPath(sc);
    G.over = true; $('tsubmit').disabled = true;
    record(sc.id, ok, G.cost, best.cost);
    say('tsay', (ok ? '✔ 答對！' : '✖ 不對。真相是：' + hypName(sc.truth, sc) + '。') + '你花了 ' + G.cost + ' 分鐘（查了 ' + G.done.length + ' 項）；最少只要 ' + best.cost + ' 分鐘。', ok ? 'ok' : 'bad');
    var left = consistent(sc, sim(sc, sc.truth), G.done);
    var h = '<div class="callout"><b>為什麼：</b>' + WHY[sc.truth[0]] + '</div>';
    h += '<p><b>最快的組合（' + best.cost + ' 分鐘）：</b>' + best.set.map(cname).join(' → ') + '</p>';
    h += '<p><b>照「先看燈、再監看、最後量」的順序（' + path.cost + ' 分鐘）：</b></p><ol class="order">' + ORDER.filter(function (k) { return checksOf(sc).some(function (c) { return c.k === k; }); }).map(function (k) { return '<li class="' + (path.done.indexOf(k) >= 0 ? 'used' : '') + '">' + cname(k) + (path.done.indexOf(k) >= 0 ? '　← 需要' : '　（這題可以跳過）') + '</li>'; }).join('') + '</ol>';
    if (left.length > 1) h += '<p class="why">只看你查過的項目，還有 ' + left.length + ' 種可能說得通：' + left.map(function (x) { return hypName(x, sc); }).join('、') + '。下次多查一項再下結論。</p>';
    $('treveal').innerHTML = h;
    statLine();
    return { ok: ok, cost: G.cost, best: best.cost };
  }
  S.forEach(function (sc, i) { var o = el('option', '', (i + 1) + '. ' + M[sc.m].name + '：' + sc.sym.slice(0, 16) + '…'); o.value = i; $('tpick').appendChild(o); });
  $('tpick').onchange = function () { show(+$('tpick').value); };
  $('tnext').onclick = function () { var s = getStats(), w = (s.wrong || []).map(function (id) { return S.map(function (x) { return x.id; }).indexOf(id); }).filter(function (i) { return i >= 0 && i !== G.i; }); show(w.length && Math.random() < .5 ? w[0] : (G.i + 1) % S.length); };
  $('tagain').onclick = function () { show(G.i); };
  $('tsubmit').onclick = submit;
  show(0);

  window.TroubleLab = { M: M, S: S, CHECKS: CHECKS, ORDER: ORDER, sim: sim, candidates: candidates, explains: explains, consistent: consistent, bestCost: bestCost, orderPath: orderPath, verify: verify, show: show, look: look, submit: submit, G: function () { return G; }, getStats: getStats, SKEY: SKEY, hypName: hypName, key: key };
})();
