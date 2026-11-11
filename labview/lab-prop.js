/* 屬性節點實驗室：Property Node 改外觀（讀／寫）、Value 與 Value (Signaling) 與事件、控制參考進 SubVI、猜一猜 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function slowF() { return $('slow') && $('slow').checked ? 2.2 : 1; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms * slowF()); }); }
  function fly(a, b, text, cls) {
    return new Promise(function (done) {
      if (!a || !b) return done();
      var dur = Math.round(550 * slowF()), r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
      var f = document.createElement('div');
      f.className = 'fly' + (cls ? ' ' + cls : ''); f.textContent = text;
      f.style.cssText = 'left:' + r1.left + 'px;top:' + r1.top + 'px;height:28px;transition-duration:' + dur + 'ms';
      $('layer').appendChild(f);
      setTimeout(function () { f.style.left = r2.left + 'px'; f.style.top = r2.top + 'px'; }, 30);
      setTimeout(function () { f.remove(); done(); }, dur + 60);
    });
  }

  /* ---------- 分頁 ---------- */
  var TABS = ['pn', 'val', 'ref'];
  function show(t) {
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    TABS.forEach(function (k) { $('t-' + k).hidden = k !== t; });
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  if (/^#(pn|val|ref)$/.test(location.hash)) show(location.hash.slice(1));

  /* =====================================================================
     1. 屬性節點改外觀
     ===================================================================== */
  var DIS = ['0：Enabled', '1：Disabled', '2：Disabled and Grayed Out'];
  var COLORS = { '': '預設', '#fecaca': '紅', '#fef08a': '黃', '#bbf7d0': '綠', '#bfdbfe': '藍' };
  function freshCtl() {
    return {
      num: { label: '速度設定', cls: 'Numeric', kind: 'num', value: 100 },
      btn: { label: '右軸前進', cls: 'Boolean', kind: 'bool', value: false },
      led: { label: '原點完成', cls: 'Boolean', kind: 'bool', value: true, ind: true },
      str: { label: '訊息', cls: 'String', kind: 'str', value: '待機中' }
    };
  }
  var A = { ctl: freshCtl(), clicks: 0, busy: false };
  function initState() { Object.keys(A.ctl).forEach(function (k) { var c = A.ctl[k]; c.visible = true; c.disabled = 0; c.blinking = false; c.color = ''; }); A.clicks = 0; }
  initState();
  var PROPS = ['Value', 'Visible', 'Disabled', 'Blinking', '顏色'];
  function propKind(id, p) { if (p === 'Value') return A.ctl[id].kind; return { Visible: 'bool', Disabled: 'dis', Blinking: 'bool', '顏色': 'color' }[p]; }
  function propsFor(id) { return PROPS.filter(function (p) { return p !== '顏色' || id === 'num' || id === 'str'; }); }
  function valText(kind, v) {
    if (kind === 'bool') return v ? 'True' : 'False';
    if (kind === 'dis') return String(v);
    if (kind === 'color') return COLORS[v] || '預設';
    if (kind === 'str') return '"' + v + '"';
    return String(v);
  }
  function getProp(id, p) { var c = A.ctl[id]; return p === 'Value' ? c.value : p === 'Visible' ? c.visible : p === 'Disabled' ? c.disabled : p === 'Blinking' ? c.blinking : c.color; }
  function setProp(id, p, v) {
    var c = A.ctl[id];
    if (p === 'Value') c.value = v; else if (p === 'Visible') c.visible = v; else if (p === 'Disabled') c.disabled = v; else if (p === 'Blinking') c.blinking = v; else c.color = v;
  }
  function ctlHtml(pre, id, c) {
    var cls = 'ctl' + (c.visible ? '' : ' hid') + (c.disabled === 2 ? ' dis2' : '') + (c.blinking ? ' blink' : ''), bg = c.color ? ' style="background:' + c.color + '"' : '', face;
    if (c.kind === 'num') face = '<div class="nbox"><div class="ud"><span data-ud="1">▲</span><span data-ud="-1">▼</span></div><div class="face" id="' + pre + id + '-f"' + bg + '>' + esc(c.value) + '</div></div>';
    else if (id === 'btn') face = '<button type="button" class="btnf face' + (c.value ? ' on' : '') + '" id="' + pre + id + '-f">' + esc(c.label) + '</button>';
    else if (c.kind === 'bool') face = '<div class="ledf face' + (c.value ? ' on' : '') + '" id="' + pre + id + '-f"></div>';
    else face = '<div class="strf face" id="' + pre + id + '-f"' + bg + '>' + esc(c.value) + '</div>';
    return '<div class="' + cls + '" data-id="' + id + '"><span class="lb">' + esc(c.label) + '</span>' + face + '</div>';
  }
  function renderFp1() {
    $('fp1').innerHTML = '<p class="cap">GT_Main.vi 前面板（簡化）</p>' + Object.keys(A.ctl).map(function (id) { return ctlHtml('a-', id, A.ctl[id]); }).join('');
    $('clicks').textContent = '「右軸前進」被按了 ' + A.clicks + ' 次。';
  }
  $('fp1').addEventListener('click', function (e) {
    var w = e.target.closest('.ctl'); if (!w) return;
    var id = w.dataset.id, c = A.ctl[id], ud = e.target.dataset.ud;
    if (id !== 'btn' && !(id === 'num' && ud)) return;
    if (c.disabled) { sayP('Disabled = ' + c.disabled + '：' + (c.disabled === 1 ? '外觀正常，但按了沒反應。' : '反灰，按了也沒反應。'), 'bad'); return; }
    if (id === 'btn') { c.value = !c.value; A.clicks++; } else c.value += +ud * 10;
    renderFp1(); sayP('使用者操作了「' + c.label + '」。');
  });
  function sayP(t, cls) { $('psay').className = 'verdict-line' + (cls ? ' ' + cls : ''); $('psay').textContent = t; }
  function dir() { return document.querySelector('input[name=pdir]:checked').value; }
  function nodeHtml(title, rows, explicit) {
    return '<div class="pn" id="pn"><div class="ph">' + (explicit ? '<span class="ref"></span>' : '') + esc(title) + '</div>' + rows.map(function (r, k) {
      return '<div class="pr" id="pr-' + k + '">' + (r.dir === 'w' ? '<span class="pt" id="pt-' + k + '"></span><span class="ar">▶</span><span class="nm">' + esc(r.name) + '</span>' : '<span class="nm">' + esc(r.name) + '</span><span class="ar">▶</span><span class="pt" id="pt-' + k + '"></span>') + '</div>';
    }).join('') + '</div>';
  }
  function inputHtml(kind, cur) {
    if (kind === 'bool') return '<select id="pv"><option value="1"' + (cur ? ' selected' : '') + '>True</option><option value="0"' + (cur ? '' : ' selected') + '>False</option></select>';
    if (kind === 'dis') return '<select id="pv">' + DIS.map(function (d, i) { return '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select>';
    if (kind === 'color') return '<select id="pv">' + Object.keys(COLORS).map(function (c) { return '<option value="' + c + '"' + (c === cur ? ' selected' : '') + '>' + COLORS[c] + '</option>'; }).join('') + '</select>';
    return '<input id="pv" class="scalar" style="width:' + (kind === 'str' ? 150 : 80) + 'px" value="' + esc(cur) + '">';
  }
  function readInput(kind) {
    var v = $('pv').value;
    if (kind === 'bool') return v === '1';
    if (kind === 'dis') return +v;
    if (kind === 'num') { var n = Number(v); return isFinite(n) ? n : 0; }
    return v;
  }
  function renderPicker() {
    var id = $('ptgt').value, props = propsFor(id), cur = $('pprop').value;
    $('pprop').innerHTML = props.map(function (p) { return '<option' + (p === cur ? ' selected' : '') + '>' + p + '</option>'; }).join('');
    var p = $('pprop').value, kind = propKind(id, p), w = dir() === 'w';
    $('pinrow').hidden = !w;
    if (w) $('pin').innerHTML = inputHtml(kind, kind === 'bool' ? !getProp(id, p) : kind === 'dis' ? (getProp(id, p) ? 0 : 2) : kind === 'color' ? '#fecaca' : kind === 'num' ? 250 : '右軸過載');
    $('pnode').innerHTML = nodeHtml(A.ctl[id].label, [{ name: p, dir: dir() }]);
    $('pout').hidden = w; $('pout').textContent = '?';
  }
  $('ptgt').innerHTML = Object.keys(A.ctl).map(function (id) { return '<option value="' + id + '">' + A.ctl[id].label + '（' + A.ctl[id].cls + (A.ctl[id].ind ? '，顯示元件' : '') + '）</option>'; }).join('');
  $('ptgt').onchange = renderPicker; $('pprop').onchange = renderPicker;
  Array.prototype.forEach.call(document.querySelectorAll('input[name=pdir]'), function (r) { r.onchange = renderPicker; });
  function writeMsg(id, p, v) {
    var c = A.ctl[id];
    if (p === 'Visible') return v ? '元件出現了。' : '元件藏起來了（本頁用虛線框標出原本的位置）。值還在，方塊圖照樣讀寫得到它的端子。';
    if (p === 'Disabled') return ['Enabled：可以操作。', 'Disabled：看起來正常，但使用者按不動。去前面板按按看。', 'Disabled and Grayed Out：反灰，也按不動。'][v];
    if (p === 'Blinking') return v ? '開始閃爍，常用來提醒異常。' : '停止閃爍。';
    if (p === '顏色') return '顏色改了。';
    return '「' + c.label + '」的值改成 ' + valText(c.kind, v) + '。這樣寫不會產生 Value Change 事件（看第 2 分頁）。';
  }
  async function writeRow(id, p, v, k) {
    var kind = propKind(id, p);
    $('pr-' + k).classList.add('on');
    await fly($('pinrow').hidden || !$('pv') ? $('pn') : $('pv'), $('pt-' + k), valText(kind, v));
    await fly($('pn'), $('a-' + id + '-f') || $('fp1'), valText(kind, v));
    setProp(id, p, v); renderFp1();
    $('pr-' + k).classList.remove('on');
  }
  async function runProp() {
    if (A.busy) return; A.busy = true;
    try {
      if (A.multi) { A.multi = false; renderPicker(); }
      var id = $('ptgt').value, p = $('pprop').value, kind = propKind(id, p);
      if (dir() === 'w') {
        var v = readInput(kind);
        await writeRow(id, p, v, 0);
        sayP(writeMsg(id, p, v), 'ok');
      } else {
        var cur = getProp(id, p), src = $('a-' + id + '-f');
        $('pr-0').classList.add('on');
        if (!A.ctl[id].visible) src = src.parentNode;
        await fly(src, $('pt-0'), valText(kind, cur));
        await fly($('pt-0'), $('pout'), valText(kind, cur));
        $('pout').textContent = valText(kind, cur); $('pr-0').classList.remove('on');
        sayP('讀到 ' + p + ' = ' + valText(kind, cur) + '。讀取不會改變前面板。', 'ok');
      }
    } finally { A.busy = false; }
  }
  $('prun').onclick = runProp;
  $('pmulti').onclick = async function () {
    if (A.busy) return; A.busy = true;
    try {
      var rows = [{ p: 'Value', v: '異常：右軸過載' }, { p: '顏色', v: '#fecaca' }, { p: 'Blinking', v: true }];
      A.multi = true; $('pinrow').hidden = true; $('pout').hidden = true;
      $('pnode').innerHTML = nodeHtml('訊息', rows.map(function (r) { return { name: r.p, dir: 'w' }; }));
      sayP('一個節點、三個屬性，由上往下執行……');
      for (var k = 0; k < rows.length; k++) { await writeRow('str', rows[k].p, rows[k].v, k); await sleep(200); }
      sayP('三個屬性由上往下依序寫入：先改文字、再改顏色、最後開始閃爍。', 'ok');
    } finally { A.busy = false; }
  };
  $('preset').onclick = function () { if (A.busy) return; A.ctl = freshCtl(); initState(); renderFp1(); renderPicker(); sayP(''); };
  renderFp1(); renderPicker();

  /* =====================================================================
     2. Value、Value (Signaling)、Local Variable 與事件
     ===================================================================== */
  var METHOD = {
    user: { name: '使用者在前面板操作', fires: true },
    local: { name: 'Local Variable', fires: false },
    value: { name: 'Property Node：Value', fires: false },
    sig: { name: 'Property Node：Value (Signaling)', fires: true },
    term: { name: '寫另一個顯示元件的端子', fires: false }
  };
  function firesEvent(m) { return !!METHOD[m].fires; }
  var V = { value: 100, busy: false, n: 0 };
  function renderFp2() {
    $('fp2').innerHTML = '<p class="cap">前面板</p><div class="ctl"><span class="lb">速度設定</span><div class="nbox"><div class="ud"><span data-ud="1">▲</span><span data-ud="-1">▼</span></div><input class="face" id="v-f" value="' + V.value + '" style="border:0;width:80px;font:600 15px ui-monospace,Consolas,monospace;text-align:right;background:transparent;color:#111" aria-label="速度設定"></div></div>';
  }
  function logV(s) { var d = document.createElement('div'); d.innerHTML = s; $('vlog').appendChild(d); $('vlog').scrollTop = 1e6; }
  async function writeVal(m, nv, from) {
    if (V.busy) return; V.busy = true;
    try {
      var old = V.value;
      if (m !== 'user') { await fly(from, $('v-f'), String(nv)); }
      V.value = nv; renderFp2();
      if (firesEvent(m)) {
        await fly($('v-f'), $('evs'), 'Value Change', 'ev');
        V.n++;
        $('evs').classList.add('fire');
        $('evb').innerHTML = '第 ' + V.n + ' 次執行這一頁：OldVal = ' + old + '，NewVal = ' + nv;
        logV('<b>' + METHOD[m].name + '</b>：值 ' + old + ' → ' + nv + '，<span style="color:var(--on)">產生 Value Change 事件</span>');
        await sleep(700); $('evs').classList.remove('fire');
      } else {
        logV('<b>' + METHOD[m].name + '</b>：值 ' + old + ' → ' + nv + '，<span style="color:var(--lab-red)">沒有事件</span>，Event 結構繼續等');
      }
    } finally { V.busy = false; }
  }
  $('meth').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var n = Number($('vnew').value); if (!isFinite(n)) n = 0;
    writeVal(b.dataset.m, n, b);
  });
  $('fp2').addEventListener('click', function (e) { var ud = e.target.dataset.ud; if (ud) writeVal('user', V.value + 10 * ud); });
  $('fp2').addEventListener('change', function (e) { if (e.target.id === 'v-f') { if (V.busy) { e.target.value = V.value; return; } var n = Number(e.target.value); writeVal('user', isFinite(n) ? n : 0); } });
  renderFp2();
  $('race').onclick = function () {
    var T = [0.7, 1.4, 3.2];
    T.forEach(function (t, i) { var b = $('r' + i); b.style.transitionDuration = '0s'; b.style.width = '0'; });
    setTimeout(function () { T.forEach(function (t, i) { var b = $('r' + i); b.style.transitionDuration = (t * slowF()) + 's'; b.style.width = '100%'; }); }, 40);
  };

  /* =====================================================================
     3. 控制參考進 SubVI
     ===================================================================== */
  var BTN = ['右前進', '右後退', '左前進', '左後退'];
  var R = { manual: true, dis: [0, 0, 0, 0], busy: false };
  function renderFp3() {
    $('fp3').innerHTML = '<p class="cap">GT_Main.vi 前面板</p><div class="ctl"><span class="lb">手動模式</span><div class="swf' + (R.manual ? ' on' : '') + '" id="msw" role="switch" aria-checked="' + R.manual + '" tabindex="0"></div></div>' +
      BTN.map(function (n, i) { return '<div class="ctl' + (R.dis[i] === 2 ? ' dis2' : '') + '"><span class="lb">&nbsp;</span><button type="button" class="btnf" id="rb' + i + '">' + n + '</button></div>'; }).join('');
  }
  function xNode() { return nodeHtml('Boolean', [{ name: 'Disabled', dir: 'w' }], true).replace('id="pn"', 'id="xpnn"').replace(/id="pr-0"/, 'id="xpr"').replace(/id="pt-0"/, 'id="xpt"'); }
  $('xpn').innerHTML = xNode();
  $('impl').innerHTML = nodeHtml('右前進', [{ name: 'Disabled', dir: 'w' }]).replace(/id="[^"]*"/g, '');
  $('expl').innerHTML = nodeHtml('Boolean', [{ name: 'Disabled', dir: 'w' }], true).replace(/id="[^"]*"/g, '');
  async function runSub() {
    if (R.busy) return; R.busy = true;
    try {
      var v = R.manual ? 0 : 2;
      $('refin').innerHTML = ''; $('fi').textContent = '–'; $('rsay').textContent = '';
      $('subsay').textContent = 'Disabled 輸入 = ' + v + (v ? '（Disabled and Grayed Out）' : '（Enabled）');
      for (var i = 0; i < BTN.length; i++) {
        var chip = document.createElement('span'); chip.className = 'rchip'; chip.textContent = 'ref ' + BTN[i]; chip.style.visibility = 'hidden';
        $('refin').appendChild(chip);
        await fly($('rb' + i), chip, '→ ' + BTN[i], 'ref');
        chip.style.visibility = '';
      }
      for (i = 0; i < BTN.length; i++) {
        $('fi').textContent = i; $('xpr').classList.add('on');
        $('refin').children[i].style.outline = '2px solid var(--on)';
        await fly($('xpnn'), $('rb' + i), 'Disabled ← ' + v);
        R.dis[i] = v; renderFp3();
        $('refin').children[i].style.outline = ''; $('xpr').classList.remove('on');
        await sleep(120);
      }
      $('fi').textContent = '完成';
      $('rsay').className = 'verdict-line ok';
      $('rsay').textContent = R.manual ? '手動模式開：SubVI 透過參考把四個按鈕都設回 Enabled。' : '手動模式關：SubVI 透過參考把主 VI 的四個按鈕全部反灰。SubVI 自己的前面板上根本沒有這些按鈕。';
    } finally { R.busy = false; }
  }
  $('fp3').addEventListener('click', function (e) {
    if (e.target.id === 'msw') { if (R.busy) return; R.manual = !R.manual; renderFp3(); runSub(); return; }
    var b = e.target.closest('.btnf'); if (!b) return;
    var i = +b.id.slice(2);
    $('rsay').className = 'verdict-line' + (R.dis[i] ? ' bad' : '');
    $('rsay').textContent = R.dis[i] ? '「' + BTN[i] + '」反灰了，按不動。' : '「' + BTN[i] + '」可以按。';
  });
  $('fp3').addEventListener('keydown', function (e) { if (e.target.id === 'msw' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); e.target.click(); } });
  $('tryimpl').onclick = function () {
    $('isay').className = 'verdict-line bad';
    $('isay').textContent = '做不到：在 SubVI 裡建立的隱含屬性節點只能選 SubVI 自己前面板上的元件，碰不到主 VI 的「右前進」。要改別的 VI 的元件，就要把參考傳進來，用明確的屬性節點。';
  };
  renderFp3();

  /* =====================================================================
     4. 猜一猜
     ===================================================================== */
  var GENS = [
    function () {
      var n = pickOne([0, 1, 2]), ans = ['可以操作，外觀正常', '外觀正常，但按不動', '反灰，而且按不動'][n];
      return { q: '用 Property Node 把按鈕的 <b>Disabled</b> 寫成 <b>' + n + '</b>，結果是？', ans: ans, wrong: ['可以操作，外觀正常', '外觀正常，但按不動', '反灰，而且按不動', '按鈕從前面板消失', '反灰，但還按得動'].filter(function (x) { return x !== ans; }),
        ex: 'Disabled：0 Enabled、1 Disabled（看起來正常但按不動）、2 Disabled and Grayed Out。要藏起來是 Visible。' };
    },
    function () {
      var m = pickOne(['local', 'value', 'sig', 'user']), f = firesEvent(m);
      var ans = f ? '會，Value Change 那一頁執行一次' : '不會，Event 結構繼續等';
      return { q: '用<b>' + METHOD[m].name + '</b>改「速度設定」的值，Event 結構裡「速度設定：Value Change」那一頁會執行嗎？', ans: ans, wrong: ['會，Value Change 那一頁執行一次', '不會，Event 結構繼續等', '會執行兩次', 'VI 會斷掉，不能這樣寫'].filter(function (x) { return x !== ans; }),
        ex: 'Value Change 只由使用者在前面板操作，或寫 Value (Signaling) 屬性產生。Local Variable、Value 屬性、寫端子都不會。' };
    },
    function () {
      return { q: '想用程式改控制項的值，<b>而且</b>要讓 Value Change 事件那一頁跟著跑，要用？', ans: 'Property Node 的 Value (Signaling)', wrong: ['Property Node 的 Value', 'Local Variable', 'Global Variable', '把值接到控制項端子'], ex: 'Value (Signaling) 寫值時會產生 Value Change 事件，就像使用者改了一樣。' };
    },
    function () {
      var slow = Math.random() < .6;
      return { q: '同一個值要在迴圈裡寫很多次，下面哪一種<b>' + (slow ? '最慢' : '最快') + '</b>？', ans: slow ? 'Property Node 的 Value' : '直接寫 Indicator 端子', wrong: (slow ? ['直接寫 Indicator 端子'] : ['Property Node 的 Value']).concat(['Local Variable', '三種一樣快', 'Global Variable 一定最快']),
        ex: '端子最直接；Local Variable 可能多一份資料複本；Property Node 每次都要切到 UI 執行緒，最慢。只要更新顯示，用端子就好。' };
    },
    function () {
      var w = pickOne(['Visible', '顏色', 'Disabled']);
      return { q: '想在 SubVI 裡改主 VI 某個按鈕的 <b>' + w + '</b>，要把什麼傳進 SubVI？', ans: '那個按鈕的控制參考（Control Reference）', wrong: ['那個按鈕的值', '那個按鈕的 Local Variable', 'Global Variable', '主 VI 的檔案路徑'], ex: '在按鈕上右鍵 ▸ Create ▸ Reference，參考線接進 SubVI，SubVI 裡用明確的 Property Node 改屬性。' };
    },
    function () {
      return pickOne([
        { q: 'SubVI 要改主 VI 的按鈕，SubVI 裡該放哪一種屬性節點？', ans: '明確的（左上角接參考線）', wrong: ['隱含的（在按鈕上右鍵建立）', '兩種都可以', '都不行，只能用 Invoke Node'], ex: '隱含的屬性節點綁在自己 VI 的元件上，SubVI 裡沒有主 VI 的按鈕；明確的看參考線，參考從哪來就改哪個元件。' },
        { q: '一個屬性節點標題寫著元件名字「右前進」、沒有參考輸入。它是？', ans: '隱含屬性節點，只能改同一個 VI 的「右前進」', wrong: ['明確屬性節點，可以放在任何 SubVI', 'Invoke Node', 'Local Variable'], ex: '隱含屬性節點的標題是元件名字；明確屬性節點的標題是類別（例如 Boolean），左上角有參考輸入。' }
      ]);
    },
    function () {
      return { q: '一個屬性節點往下拉長，放了 Value、Visible、Blinking 三個屬性（都是寫）。執行順序是？', ans: '由上往下，一個一個做', wrong: ['由下往上', '三個同時', '每次執行順序都不一定'], ex: '同一個屬性節點的多個屬性由上往下依序執行。順序重要時（例如先改值再顯示），就照這個排。' };
    },
    function () {
      return pickOne([
        { q: '在前面板元件上右鍵 ▸ Create ▸ Property Node，剛放下的節點是？', ans: '讀（端子在右邊往外輸出）', wrong: ['寫（端子在左邊往裡輸入）', '看屬性而定', '讀和寫各一個端子'], ex: '預設是讀；右鍵 ▸ Change To Write 才變成寫。整個節點也可以一次 Change All To Write。' },
        { q: '屬性節點的端子在<b>左邊</b>、箭頭往裡，代表？', ans: '這個屬性是「寫」', wrong: ['這個屬性是「讀」', '這是參考輸入', '這是錯誤輸入'], ex: '寫入時值從左邊流進節點；讀取時從右邊流出。' }
      ]);
    },
    function () {
      return { q: '用屬性節點把數值控制項的 <b>Visible</b> 寫成 False 之後，方塊圖還讀得到它的值嗎？', ans: '讀得到，只是前面板上看不到', wrong: ['讀不到，值變成預設值 0', 'VI 會斷掉', '端子會從方塊圖上消失'], ex: 'Visible 只管看不看得到，元件和它的值都還在，端子照常運作。' };
    },
    function () {
      return { q: '「右軸前進」按鈕的 Disabled = 1。使用者在前面板按它，會？', ans: '沒反應，但按鈕看起來正常', wrong: ['沒反應，而且按鈕反灰', '照常切換', '按鈕消失', 'VI 停止'], ex: '1 = Disabled：外觀不變但不能操作。想讓使用者一眼看出不能按，用 2（Disabled and Grayed Out）。' };
    }
  ];
  function gen() { return pickOne(GENS)(); }

  window.PropLab = {
    state: { panel: A, value: V, ref: R }, getProp: getProp, setProp: setProp, firesEvent: firesEvent, METHOD: METHOD, DIS: DIS,
    show: show, runProp: runProp, writeVal: writeVal, runSub: runSub, GENS: GENS, gen: gen,
    quiz: window.LabQuiz ? window.LabQuiz('pquiz', gen) : null
  };
})();
