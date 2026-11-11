/* 叢集實驗室（續）：陣列與叢集互轉、叢集運算、叢集順序與面板位置、Tab Control，以及新增的猜一猜題型
   和 lab-cluster.js 共用頁面：分頁按鈕由 lab-cluster.js 的 show() 切換，切到這裡的分頁時呼叫 ClusterLab2.onShow。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function distinct(ans, list) { var seen = {}; seen[ans] = 1; return list.filter(function (w) { if (seen[w]) return false; seen[w] = 1; return true; }); }
  function slowF() { return $('slow') && $('slow').checked ? 2.2 : 1; }
  function say(id, t, cls) { $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); $(id).textContent = t; }
  function num(v) { return String(Number(v.toFixed(3))); }

  /* 動畫：RUN 變了（換分頁或重來）舊的回呼就停 */
  var RUN = 0;
  function wait(ms, my) { return new Promise(function (res, rej) { setTimeout(function () { if (my !== RUN) rej('cancel'); else res(); }, ms * slowF()); }); }
  function fly(a, b, text, my, cls) {
    return new Promise(function (done, rej) {
      if (!a || !b) return done();
      var dur = Math.round(480 * slowF()), r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
      var f = document.createElement('div'); f.className = 'fly' + (cls ? ' ' + cls : ''); f.textContent = text;
      f.style.cssText = 'left:' + r1.left + 'px;top:' + r1.top + 'px;height:28px;font-size:12px;transition-duration:' + dur + 'ms';
      $('layer').appendChild(f);
      setTimeout(function () { f.style.left = r2.left + 'px'; f.style.top = r2.top + 'px'; }, 30);
      setTimeout(function () { f.remove(); if (my !== RUN) rej('cancel'); else done(); }, dur + 60);
    });
  }
  function caught(e) { if (e !== 'cancel') throw e; }
  function cell(id, txt, cls) { return '<span class="c2' + (cls ? ' ' + cls : '') + '"' + (id ? ' id="' + id + '"' : '') + '>' + esc(txt) + '</span>'; }

  /* =====================================================================
     純函式（給測試和猜一猜用）
     ===================================================================== */
  /* Array To Cluster：size 格，陣列多出來的不會進叢集；不足的格子沒有對應元素（本頁以 null 表示） */
  function arrayToCluster(arr, size) { var out = []; for (var i = 0; i < size; i++) out.push(i < arr.length ? arr[i] : null); return { cluster: out, lost: Math.max(0, arr.length - size), missing: Math.max(0, size - arr.length) }; }
  /* Cluster To Array：元素型別都一樣才可以 */
  function clusterToArray(types, vals) { var ok = types.every(function (t) { return t === types[0]; }); return ok ? { ok: true, arr: vals.slice() } : { ok: false }; }
  /* Build Cluster Array：每個輸入包成一個單元素叢集；輸入型別要相同 */
  function buildClusterArray(types, vals) { var ok = types.every(function (t) { return t === types[0]; }); return ok ? { ok: true, arr: vals.map(function (v) { return [v]; }) } : { ok: false }; }
  /* Index & Bundle Cluster Array：依索引配對，長度以最短的為準 */
  function indexBundle(arrays) { var n = Math.min.apply(null, arrays.map(function (a) { return a.length; })), out = []; for (var i = 0; i < n; i++) out.push(arrays.map(function (a) { return a[i]; })); return out; }
  /* 叢集運算：b 可以是純量或叢集；元素都要是數值、數量相同 */
  function clusterMath(op, a, b) {
    if (a.some(function (v) { return typeof v !== 'number'; })) return { ok: false, why: 'type' };
    if (Array.isArray(b)) {
      if (b.some(function (v) { return typeof v !== 'number'; })) return { ok: false, why: 'type' };
      if (b.length !== a.length) return { ok: false, why: 'count' };
    }
    return { ok: true, out: a.map(function (v, i) { var w = Array.isArray(b) ? b[i] : b; return op === 'add' ? v + w : v * w; }) };
  }

  /* =====================================================================
     1. 陣列與叢集互轉
     ===================================================================== */
  var CV = { mode: 'a2c', len: 6, size: 9, mixedC2A: false, bcaArr: false, bcaMix: false, ib: [5, 3, 4] };
  var A2C_VALS = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112];
  var IB = [{ name: '位置 (DBL)', cls: '', vals: [12.5, 30.0, 47.5, 65.0, 82.5, 100.0] }, { name: '速度 (I32)', cls: 'i32', vals: [300, 500, 800, 800, 500, 300] }, { name: '站名 (String)', cls: 'str', vals: ['入料', '夾取', '檢測', '分選', '出料', '回原'] }];
  var CVDESC = {
    a2c: 'Array To Cluster：把一維陣列的元素依序放進叢集。叢集要幾格是在編輯時設定的（節點右鍵 Cluster Size，預設 9 格、最多 256 格），不會隨陣列長度改變。',
    c2a: 'Cluster To Array：把叢集的元素依叢集順序排成一維陣列。叢集裡的元素必須是同一種型別，而且元素不能是陣列。',
    bca: 'Build Cluster Array：每個輸入各自包成一個「只有一個元素的叢集」，再組成叢集陣列。輸入的型別要相同。輸入是陣列時，就得到「陣列包陣列」（中間隔一層叢集）。',
    ibca: 'Index & Bundle Cluster Array：輸入是好幾個陣列（型別可以不同），第 i 個叢集由每個陣列的第 i 個元素組成，數量以最短的陣列為準。'
  };
  function cvOpts() {
    var m = CV.mode, h = '';
    if (m === 'a2c') h = '<label>陣列元素數 <select id="cvlen">' + [3, 6, 9, 12].map(function (n) { return '<option' + (n === CV.len ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label><label>叢集大小（右鍵設定） <select id="cvsize">' + [3, 5, 9, 12].map(function (n) { return '<option value="' + n + '"' + (n === CV.size ? ' selected' : '') + '>' + n + (n === 9 ? '（預設）' : '') + '</option>'; }).join('') + '</select></label>';
    else if (m === 'c2a') h = '<label class="check small"><input type="checkbox" id="cvmix"' + (CV.mixedC2A ? ' checked' : '') + '> 叢集裡有一個字串元素</label>';
    else if (m === 'bca') h = '<label class="check small"><input type="checkbox" id="cvarr"' + (CV.bcaArr ? ' checked' : '') + '> 輸入改成三個陣列</label><label class="check small"><input type="checkbox" id="cvbmix"' + (CV.bcaMix ? ' checked' : '') + '> 第 3 個輸入換成字串</label>';
    else h = IB.map(function (a, i) { return '<label>' + a.name + ' 長度 <select data-ib="' + i + '">' + [2, 3, 4, 5, 6].map(function (n) { return '<option' + (n === CV.ib[i] ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>'; }).join('');
    $('cvopt').innerHTML = h;
  }
  var C2A = [['右軸', 'dbl', 120.5], ['左軸', 'dbl', 80.0], ['Z 軸', 'dbl', 15.0], ['補正', 'dbl', 0.5]];
  function renderCv() {
    var m = CV.mode, L = '', R = '';
    Array.prototype.forEach.call($('cvm').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.m === m); });
    $('cvdesc').textContent = CVDESC[m];
    $('cvnode').textContent = { a2c: 'Array To\nCluster', c2a: 'Cluster To\nArray', bca: 'Build Cluster\nArray', ibca: 'Index & Bundle\nCluster Array' }[m];
    if (m === 'a2c') {
      var arr = A2C_VALS.slice(0, CV.len);
      L = '<span class="lbl2">1D 陣列（I32，' + CV.len + ' 個）</span><span class="arr2 i32">' + arr.map(function (v, i) { return cell('ai' + i, v); }).join('') + '</span>';
      R = '<span class="lbl2">叢集（' + CV.size + ' 格）</span><span class="cbox">' + Array.from({ length: CV.size }, function (_, i) { return cell('ao' + i, '?'); }).join('') + '</span>';
    } else if (m === 'c2a') {
      var els = C2A.map(function (e, i) { return CV.mixedC2A && i === 3 ? ['單位', 'str', '"mm"'] : e; });
      L = '<span class="lbl2">叢集（叢集順序 0～3）</span><span class="cbox">' + els.map(function (e, i) { return '<span style="display:grid;gap:1px;font-size:11px;text-align:center">' + e[0] + cell('ci' + i, e[2], e[1] === 'str' ? 'hi' : '') + '</span>'; }).join('') + '</span>';
      R = '<span class="lbl2">1D 陣列</span><span class="arr2">' + els.map(function (_, i) { return cell('co' + i, '?'); }).join('') + '</span>';
    } else if (m === 'bca') {
      var ins = CV.bcaArr ? [[1, 2, 3], [4, 5], [6, 7, 8, 9]] : [10, 20, 30];
      if (CV.bcaMix) ins[2] = CV.bcaArr ? ['a', 'b'] : '"abc"';
      L = '<span class="lbl2">三個輸入（element ' + (CV.bcaArr ? '是陣列' : '') + '）</span>' + ins.map(function (v, i) { var t = Array.isArray(v) ? '[' + v.join(', ') + ']' : v; return '<div class="inrow">' + cell('bi' + i, t, CV.bcaMix && i === 2 ? 'hi' : '') + '</div>'; }).join('');
      R = '<span class="lbl2">叢集陣列</span><span class="arr2 clu" id="bout">' + ins.map(function (_, i) { return '<span class="cbox" id="bo' + i + '" style="visibility:hidden">' + cell('', '?') + '</span>'; }).join('') + '</span>';
    } else {
      L = IB.map(function (a, k) { return '<span class="lbl2">' + a.name + '</span><span class="arr2 ' + a.cls + '">' + a.vals.slice(0, CV.ib[k]).map(function (v, i) { return cell('ii' + k + '_' + i, v); }).join('') + '</span>'; }).join('');
      var n = Math.min.apply(null, CV.ib);
      R = '<span class="lbl2">叢集陣列（' + n + ' 個叢集）</span><span class="arr2 clu">' + Array.from({ length: n }, function (_, i) { return '<span class="cbox" id="io' + i + '">' + [0, 1, 2].map(function (k) { return cell('io' + i + '_' + k, '?'); }).join('') + '</span>'; }).join('') + '</span>';
    }
    $('cvin').innerHTML = L; $('cvout').innerHTML = R; say('cvsay', '');
  }
  $('cvm').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { RUN++; CV.mode = b.dataset.m; cvOpts(); renderCv(); } });
  $('cvopt').addEventListener('change', function (e) {
    var t = e.target; RUN++;
    if (t.id === 'cvlen') CV.len = +t.value; if (t.id === 'cvsize') CV.size = +t.value;
    if (t.id === 'cvmix') CV.mixedC2A = t.checked; if (t.id === 'cvarr') CV.bcaArr = t.checked; if (t.id === 'cvbmix') CV.bcaMix = t.checked;
    if (t.dataset.ib != null) CV.ib[+t.dataset.ib] = +t.value;
    renderCv();
  });
  async function runCv() {
    var my = ++RUN, m = CV.mode; renderCv();
    try {
      if (m === 'a2c') {
        var r = arrayToCluster(A2C_VALS.slice(0, CV.len), CV.size);
        for (var i = 0; i < CV.len; i++) {
          if (i < CV.size) { await fly($('ai' + i), $('ao' + i), String(A2C_VALS[i]), my); $('ao' + i).textContent = A2C_VALS[i]; $('ao' + i).classList.add('new'); }
          else $('ai' + i).classList.add('lost');
        }
        for (i = CV.len; i < CV.size; i++) { $('ao' + i).textContent = '0'; $('ao' + i).classList.add('def'); }
        say('cvsay', r.lost ? '陣列有 ' + CV.len + ' 個，叢集只有 ' + CV.size + ' 格：後面 ' + r.lost + ' 個（劃掉的）通常會被截掉，不會進到叢集（社群說法，官方說明沒有逐字寫）。陣列比叢集大小長時，記得在節點上右鍵 Cluster Size 改大。' :
          r.missing ? '陣列只有 ' + CV.len + ' 個，叢集有 ' + CV.size + ' 格：多出來的 ' + r.missing + ' 格沒有對應的陣列元素，通常會補預設值（數值是 0，虛線格；社群說法，官方說明沒有逐字寫）。' : '陣列和叢集一樣 ' + CV.size + ' 個，一個對一個放進去。', r.lost ? 'bad' : '');
      } else if (m === 'c2a') {
        var types = C2A.map(function (e, i) { return CV.mixedC2A && i === 3 ? 'str' : e[1]; }), res = clusterToArray(types, C2A.map(function (e) { return e[2]; }));
        if (!res.ok) { say('cvsay', '線斷了：叢集裡有 DBL 也有字串，Cluster To Array 要求元素全部同型別（陣列只能放一種型別）。', 'bad'); return; }
        for (var k = 0; k < 4; k++) { await fly($('ci' + k), $('co' + k), String(C2A[k][2]), my); $('co' + k).textContent = C2A[k][2]; $('co' + k).classList.add('new'); }
        say('cvsay', '依叢集順序排成陣列：第 0 個元素變成陣列 index 0。接下來就能用 For Loop、Array Max & Min 這些陣列函式處理。', 'ok');
      } else if (m === 'bca') {
        var ins = CV.bcaArr ? [[1, 2, 3], [4, 5], [6, 7, 8, 9]] : [10, 20, 30];
        var tps = [0, 1, 2].map(function (i) { return CV.bcaMix && i === 2 ? 'str' : 'num'; }), rb = buildClusterArray(tps, ins);
        if (!rb.ok) { say('cvsay', '線斷了：Build Cluster Array 的每個輸入型別要相同，數值和字串不能混在一起。', 'bad'); return; }
        for (var j = 0; j < 3; j++) {
          var o = $('bo' + j), t = Array.isArray(ins[j]) ? '[' + ins[j].join(', ') + ']' : String(ins[j]);
          o.innerHTML = cell('', t); await fly($('bi' + j), o, t, my); o.style.visibility = '';
        }
        say('cvsay', CV.bcaArr ? '三個長度不同的陣列，各自包進一個叢集，再排成叢集陣列。LabVIEW 的陣列不能直接放「長度不同的陣列」，中間隔一層叢集就可以。' : '每個輸入各包成一個只有一個元素的叢集，三個叢集排成一個陣列。', 'ok');
      } else {
        var arrays = IB.map(function (a, kk) { return a.vals.slice(0, CV.ib[kk]); }), out = indexBundle(arrays), n = out.length;
        for (var x = 0; x < n; x++) {
          for (var a = 0; a < 3; a++) { await fly($('ii' + a + '_' + x), $('io' + x + '_' + a), String(arrays[a][x]), my); $('io' + x + '_' + a).textContent = arrays[a][x]; }
          $('io' + x).style.outline = '2px solid #16a34a';
        }
        arrays.forEach(function (arr, a) { for (var y = n; y < arr.length; y++) $('ii' + a + '_' + y).classList.add('lost'); });
        say('cvsay', '依索引配對成 ' + n + ' 個叢集（最短的陣列只有 ' + n + ' 個）。其他陣列多出來的元素（劃掉的）沒有配對，不會出現在輸出。三個陣列的型別都不一樣也沒關係。', 'ok');
      }
    } catch (e) { caught(e); }
  }
  $('cvrun').onclick = runCv;

  /* =====================================================================
     2. 叢集運算
     ===================================================================== */
  var MA = [120.5, 80.0, 15.0], MNAMES = ['右軸', '左軸', 'Z 軸'];
  var MB = { clu: [0.5, -0.3, 1.2], sca: 2.0, str: [0.5, 'mm', 1.2], two: [0.5, -0.3] };
  function mList(v, pre) {
    if (!Array.isArray(v)) return '<span class="lbl2">純量 DBL</span>' + cell(pre + '0', v);
    return '<span class="lbl2">叢集（' + v.length + ' 個元素）</span><span class="cbox">' + v.map(function (x, i) { return cell(pre + i, typeof x === 'number' ? x : '"' + x + '"', typeof x === 'number' ? '' : 'hi'); }).join('') + '</span>';
  }
  function renderMath() {
    var b = MB[$('mb').value];
    $('mnode').textContent = $('mop').value === 'add' ? '+' : '×';
    $('mx').innerHTML = '<span class="lbl2">位置叢集：' + MNAMES.join('、') + '（DBL）</span><span class="cbox">' + MA.map(function (v, i) { return cell('ma' + i, v); }).join('') + '</span><div style="margin-top:8px">' + mList(b, 'mbv') + '</div>';
    $('mout2').innerHTML = '<span class="lbl2">結果叢集</span><span class="cbox">' + MA.map(function (_, i) { return cell('mo' + i, '?'); }).join('') + '</span>';
    say('msay2', '');
  }
  async function runMath() {
    var my = ++RUN, op = $('mop').value, b = MB[$('mb').value], r = clusterMath(op, MA, b);
    renderMath();
    try {
      if (!r.ok) { say('msay2', r.why === 'type' ? '線斷了：叢集裡有字串，' + (op === 'add' ? 'Add' : 'Multiply') + ' 不能算字串。' : '線斷了：一個叢集有 3 個元素、另一個只有 2 個，配不起來。', 'bad'); return; }
      for (var i = 0; i < MA.length; i++) {
        var bv = Array.isArray(b) ? $('mbv' + i) : $('mbv0');
        await Promise.all([fly($('ma' + i), $('mo' + i), String(MA[i]), my), fly(bv, $('mo' + i), String(Array.isArray(b) ? b[i] : b), my, 'ok')]);
        $('mo' + i).textContent = num(r.out[i]); $('mo' + i).classList.add('new');
      }
      say('msay2', Array.isArray(b) ? '兩個叢集一個元素對一個元素' + (op === 'add' ? '相加' : '相乘') + '：右軸配右軸、左軸配左軸、Z 軸配 Z 軸。' : '叢集和純量：純量和每個元素各' + (op === 'add' ? '加' : '乘') + '一次。', 'ok');
    } catch (e) { caught(e); }
  }
  $('mop').onchange = renderMath; $('mb').onchange = renderMath; $('mrun2').onclick = runMath;

  /* =====================================================================
     3. 叢集順序與面板位置
     ===================================================================== */
  var OE = { rx: { name: '右軸位置', v: '120.5' }, lx: { name: '左軸位置', v: '80.0' }, run: { name: '運轉中', v: 'T' }, ac: { name: '異常碼', v: '"E00"' } };
  var POS = [[20, 30], [240, 30], [20, 120], [240, 120]];
  var O = {};
  function oReset() { O = { order: ['rx', 'lx', 'run', 'ac'], pos: { rx: 0, lx: 1, run: 2, ac: 3 }, reorder: false, pick: [] }; }
  oReset();
  function renderOrd() {
    var h = '<span class="cl">機台狀態</span>';
    Object.keys(OE).forEach(function (id) {
      var p = POS[O.pos[id]], cur = O.order.indexOf(id), np = O.pick.indexOf(id);
      h += '<div class="fe" data-id="' + id + '" style="left:' + p[0] + 'px;top:' + p[1] + 'px"><span>' + OE[id].name + '</span><span class="box" id="oe-' + id + '">' + esc(OE[id].v) + '</span>' +
        (O.reorder ? '<span class="ord"><b title="新的順序">' + (np >= 0 ? np : '·') + '</b><i title="原來的順序">' + cur + '</i></span>' : '') + '</div>';
    });
    $('ofp').innerHTML = h; $('ofp').classList.toggle('reorder', O.reorder);
    $('oout').innerHTML = O.order.map(function (id, k) { return '<div class="inrow"><span class="lbl2" style="margin:0;min-width:3.5em">端子 ' + k + '</span>' + cell('oo' + k, '?') + '<span style="font-size:12px">' + OE[id].name + '</span></div>'; }).join('');
    $('ook').hidden = $('ocancel').hidden = !O.reorder; $('oreorder').hidden = $('omove').hidden = O.reorder;
    $('ohint').textContent = O.reorder ? '重排模式：依你要的新順序，一個一個點元素（黑底是新順序、白底是原來的順序）。本頁簡化成全部點完才能按確認。' : '';
    $('ook').disabled = O.pick.length !== O.order.length;
  }
  $('ofp').addEventListener('click', function (e) {
    var el = e.target.closest('.fe'); if (!el || !O.reorder) return;
    var id = el.dataset.id; if (O.pick.indexOf(id) < 0) O.pick.push(id); renderOrd();
  });
  $('omove').onclick = function () {
    RUN++; var ids = Object.keys(OE), first = O.pos[ids[0]];
    ids.forEach(function (id, i) { O.pos[id] = i < ids.length - 1 ? O.pos[ids[i + 1]] : first; });
    renderOrd(); say('osay', '元素在面板上換了位置，但叢集順序沒變：Unbundle 的端子還是同樣的順序。位置只是排版。');
  };
  $('oreorder').onclick = function () { RUN++; O.reorder = true; O.pick = []; renderOrd(); say('osay', ''); };
  $('ocancel').onclick = function () { O.reorder = false; O.pick = []; renderOrd(); say('osay', '取消，順序不變。'); };
  $('ook').onclick = function () {
    var old = O.order.slice(); O.order = O.pick.slice(); O.reorder = false; O.pick = []; renderOrd();
    var changed = old.join() !== O.order.join();
    say('osay', changed ? '叢集順序改成：' + O.order.map(function (id, k) { return k + ' ' + OE[id].name; }).join('、') + '。元素在面板上的位置沒動，但 Unbundle 的端子順序跟著變了；原本接好的線會怎樣，看「Bundle／Unbundle」分頁。' : '點的順序和原來一樣，沒有改變。', changed ? 'bad' : '');
  };
  $('oreset').onclick = function () { RUN++; oReset(); renderOrd(); say('osay', ''); };
  $('orun').onclick = async function () {
    if (O.reorder) return;
    var my = ++RUN; renderOrd();
    try { for (var k = 0; k < O.order.length; k++) { var id = O.order[k]; await fly($('oe-' + id), $('oo' + k), OE[id].v, my); $('oo' + k).textContent = OE[id].v; } say('osay', 'Unbundle 由上到下照叢集順序輸出，和元素在面板上放哪裡無關。', 'ok'); } catch (e) { caught(e); }
  };

  /* =====================================================================
     4. Tab Control
     ===================================================================== */
  var TP = [
    { name: '手動', ctls: [{ id: 'jog', label: '點動速度', t: 'num', v: 50 }, { id: 'grip', label: '夾爪', t: 'bool', v: false }] },
    { name: '自動', ctls: [{ id: 'cyc', label: '循環次數', t: 'num', v: 10 }, { id: 'single', label: '單一循環', t: 'bool', v: true }] },
    { name: '設定', ctls: [{ id: 'com', label: 'COM 埠', t: 'str', v: 'COM3' }] }
  ];
  var TC = { page: 0 };
  function allCtls() { var a = []; TP.forEach(function (p) { p.ctls.forEach(function (c) { a.push(c); }); }); return a; }
  function vtext(c) { return c.t === 'bool' ? (c.v ? 'T' : 'F') : c.t === 'str' ? '"' + c.v + '"' : String(c.v); }
  function renderTab() {
    var p = TP[TC.page];
    $('tcw').innerHTML = '<div class="th">' + TP.map(function (pg, i) { return '<button type="button" data-p="' + i + '"' + (i === TC.page ? ' class="here"' : '') + '>' + pg.name + '</button>'; }).join('') + '</div><div class="tp">' +
      p.ctls.map(function (c) { return '<label>' + c.label + (c.t === 'bool' ? '<input type="checkbox" data-c="' + c.id + '"' + (c.v ? ' checked' : '') + '>' : '<input data-c="' + c.id + '" value="' + esc(c.v) + '">') + '</label>'; }).join('') + '</div>';
    $('tcterms').innerHTML = '<div class="inrow">' + cell('tct', '"' + p.name + '"', 'hi') + '<span style="font-size:12px">Tab Control（目前頁）</span></div>' +
      allCtls().map(function (c) { var on = TP[TC.page].ctls.indexOf(c) >= 0; return '<div class="inrow">' + cell('tc-' + c.id, vtext(c)) + '<span style="font-size:12px">' + c.label + (on ? '' : '（在別頁，看不到）') + '</span></div>'; }).join('');
    $('tccase').innerHTML = '<span class="lbl2">Case 頁籤</span>' + TP.map(function (pg, i) { return cell('tcc' + i, '"' + pg.name + '"', i === TC.page ? 'new' : ''); }).join(' ');
  }
  $('tcw').addEventListener('click', function (e) { var b = e.target.closest('button[data-p]'); if (b) { RUN++; TC.page = +b.dataset.p; renderTab(); say('tcsay', 'Tab Control 的值變成 "' + TP[TC.page].name + '"，Case 結構走「' + TP[TC.page].name + '」那一頁。其他頁的控制項還在，只是看不到。'); } });
  $('tcw').addEventListener('change', function (e) {
    var t = e.target, id = t.dataset.c; if (!id) return;
    var c = allCtls().filter(function (x) { return x.id === id; })[0];
    c.v = c.t === 'bool' ? t.checked : c.t === 'num' ? (Number(t.value) || 0) : t.value; renderTab();
  });
  $('tcread').onclick = async function () {
    var my = ++RUN, all = allCtls();
    renderTab();
    try {
      for (var i = 0; i < all.length; i++) { var el = $('tc-' + all[i].id); el.classList.add('hi'); await wait(180, my); el.classList.remove('hi'); el.classList.add('new'); }
      say('tcsay', '五個控制項全部讀到了，包括不在目前這一頁的 ' + all.filter(function (c) { return TP[TC.page].ctls.indexOf(c) < 0; }).map(function (c) { return c.label; }).join('、') + '。Tab Control 只管前面板顯示哪一頁，不影響方塊圖。', 'ok');
    } catch (e) { caught(e); }
  };

  /* ---------- 切分頁 ---------- */
  function onShow(t) {
    RUN++;
    Array.prototype.forEach.call($('layer').children, function (f) { f.remove(); });
    if (t === 'conv') { cvOpts(); renderCv(); } else if (t === 'math') renderMath(); else if (t === 'ord') renderOrd(); else if (t === 'tabc') renderTab();
  }

  /* =====================================================================
     5. 新增的猜一猜題型（接進 lab-cluster.js 的 GENS）
     ===================================================================== */
  var GENS2 = [
    function () { var a = '9 個'; return { q: '<b>Array To Cluster</b> 預設輸出的叢集有幾個元素？', ans: a, wrong: distinct(a, ['和陣列一樣多', '1 個', '16 個', '256 個']), ex: '預設 9 個，要更多或更少在節點上右鍵改叢集大小。' }; },
    function () {
      var len = pickOne([10, 12, 15]), size = 9, r = arrayToCluster(Array.from({ length: len }, function (_, i) { return i; }), size), a = '前 9 個進叢集，後面 ' + r.lost + ' 個通常被截掉';
      return { q: '一個 ' + len + ' 個元素的陣列接到 Array To Cluster（叢集大小沒改，還是預設），結果？', ans: a, wrong: distinct(a, ['叢集自動變成 ' + len + ' 個', '執行時跳出錯誤', '只取最後 9 個', '線斷掉']), ex: '叢集大小是在編輯時設定的，不會跟著陣列變；多出來的通常被截掉（社群說法）。陣列比較長時要記得右鍵 Cluster Size 改大。' };
    },
    function () { var a = '256 個'; return { q: 'Array To Cluster 的叢集大小最多可以設到幾個元素？', ans: a, wrong: distinct(a, ['9 個', '16 個', '1024 個', '沒有上限']), ex: '預設 9 個，最多 256 個，在節點右鍵 Cluster Size 設定。' }; },
    function () { var a = '線斷掉，元素必須同型別'; return { q: '一個叢集裡有兩個 DBL 和一個字串，接到 <b>Cluster To Array</b> 會？', ans: a, wrong: distinct(a, ['字串自動變成 0', '只轉出兩個 DBL', '輸出字串陣列']), ex: '陣列只能放一種型別，所以 Cluster To Array 要求叢集元素同型別（而且元素不能是陣列），陣列順序就是叢集順序。' }; },
    function () {
      var ls = [rint(2, 6), rint(2, 6), rint(2, 6)], n = indexBundle(ls.map(function (l) { return Array(l).fill(0); })).length, a = n + ' 個';
      return { q: '三個陣列長度分別是 ' + ls.join('、') + '，接到 <b>Index &amp; Bundle Cluster Array</b>，輸出的叢集陣列有幾個叢集？', ans: a, wrong: distinct(a, [Math.max.apply(null, ls) + ' 個', ls.reduce(function (s, v) { return s + v; }, 0) + ' 個', '3 個', (n + 1) + ' 個', (n - 1) + ' 個', (n * 3) + ' 個']), ex: '依索引配對，以最短的陣列為準。' };
    },
    function () { var a = '可以，型別可以不同'; return { q: '<b>Index &amp; Bundle Cluster Array</b> 的輸入陣列可以是不同型別嗎（例如 DBL 陣列、字串陣列）？', ans: a, wrong: distinct(a, ['不行，要全部同型別', '只能是數值陣列', '只能接兩個']), ex: '每個叢集由各陣列同一個索引的元素組成，型別不同沒關係。Build Cluster Array 才要求輸入同型別。' }; },
    function () { var a = '3 個叢集，每個叢集裡只有 1 個元素'; return { q: '三個 DBL 純量接到 <b>Build Cluster Array</b>，輸出是？', ans: a, wrong: distinct(a, ['1 個叢集，裡面有 3 個元素', '3 個元素的 DBL 陣列', '1 個叢集，裡面有 1 個陣列']), ex: '每個輸入各自包成單元素叢集，再組成陣列。常用來做「陣列包陣列」。' }; },
    function () {
      var a2 = [rint(1, 9), rint(1, 9), rint(1, 9)], b2 = [rint(1, 9) * 10, rint(1, 9) * 10, rint(1, 9) * 10], r = clusterMath('add', a2, b2).out, ans = '{' + r.join(', ') + '}';
      return { q: '叢集 {' + a2.join(', ') + '} 和叢集 {' + b2.join(', ') + '}（都是 DBL）接到 Add，結果？', ans: ans, wrong: distinct(ans, ['{' + (a2[0] + a2[1] + a2[2] + b2[0] + b2[1] + b2[2]) + '}', '{' + a2.concat(b2).join(', ') + '}', '線斷掉，叢集不能相加', '{' + a2.map(function (v, i) { return v * b2[i]; }).join(', ') + '}']), ex: '數值叢集接 Add，元素一個對一個相加。' };
    },
    function () {
      var a2 = [rint(1, 9), rint(1, 9), rint(1, 9)], k = rint(2, 5), ans = '{' + clusterMath('add', a2, k).out.join(', ') + '}';
      return { q: '叢集 {' + a2.join(', ') + '} 接 Add，另一邊接純量 ' + k + '，結果？', ans: ans, wrong: distinct(ans, ['{' + (a2[0] + k) + ', ' + a2[1] + ', ' + a2[2] + '}', '線斷掉，叢集不能加純量', '{' + a2.concat([k]).join(', ') + '}', String(a2[0] + a2[1] + a2[2] + k)]), ex: '純量會和每一個元素各加一次。' };
    },
    function () { var a = '線斷掉'; return { q: '叢集 {位置 DBL, 單位 String} 接到 Add，另一邊接純量 1，會？', ans: a, wrong: distinct(a, ['只有位置加 1', '字串後面多一個 1', '兩個元素都變成 1']), ex: '叢集裡有不能相加的字串元素，Add 接不上。' }; },
    function () { var a = '不會，位置只是排版，順序要用 Reorder Controls In Cluster 改'; return { q: '在前面板把叢集裡的「右軸位置」拖到最下面，Unbundle 的輸出順序會變嗎？', ans: a, wrong: distinct(a, ['會，照面板上由上到下排', '會，照由左到右排', '要重新開 VI 才會變']), ex: '叢集順序和面板位置是兩回事。' }; },
    function () { var a = '讀得到，所有頁的控制項同時存在'; return { q: 'Tab Control 現在顯示「手動」頁，方塊圖還讀得到「設定」頁裡的 COM 埠字串嗎？', ans: a, wrong: distinct(a, ['讀不到，要切到那一頁', '讀到空字串', '那個端子會從方塊圖消失']), ex: 'Tab Control 只是前面板排版，不影響方塊圖。' }; },
    function () { var a = '目前顯示哪一頁（像 Enum，接到 Case 頁籤就是分頁名稱）'; return { q: 'Tab Control 自己的端子輸出的是什麼？', ans: a, wrong: distinct(a, ['所有頁上控制項的值組成的叢集', '頁數（一個固定的數字）', '沒有端子，只能用 Property Node 讀']), ex: '可以接到 Case 結構，依目前頁做不同的事。' }; }
  ];
  if (window.ClusterLab && window.ClusterLab.GENS) GENS2.forEach(function (g) { window.ClusterLab.GENS.push(g); });

  window.ClusterLab2 = {
    onShow: onShow, arrayToCluster: arrayToCluster, clusterToArray: clusterToArray, buildClusterArray: buildClusterArray, indexBundle: indexBundle, clusterMath: clusterMath,
    state: { conv: CV, ord: function () { return O; }, tab: TC }, GENS: GENS2
  };
  if (/^#(conv|math|ord|tabc)$/.test(location.hash) && window.ClusterLab) window.ClusterLab.show(location.hash.slice(1));
})();
