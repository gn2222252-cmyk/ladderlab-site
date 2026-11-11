/* 叢集實驗室：Bundle／Unbundle 與叢集順序、Type Def、錯誤叢集的流動、Merge Errors、猜一猜 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function slowF() { return $('slow') && $('slow').checked ? 2.2 : 1; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms * slowF()); }); }
  function roundEven(x) { var f = Math.floor(x), d = x - f; if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1; return Math.round(x); }

  /* 一個複本從 a 飛到 b（FLIP：量兩個位置，用 transition 移過去） */
  function fly(a, b, text, cls) {
    return new Promise(function (done) {
      if (!a || !b) return done();
      var dur = Math.round(600 * slowF());
      var r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
      var f = document.createElement('div');
      f.className = 'fly' + (cls ? ' ' + cls : '');
      f.textContent = text;
      f.style.cssText = 'left:' + r1.left + 'px;top:' + r1.top + 'px;min-width:' + r1.width + 'px;height:' + r1.height + 'px;transition-duration:' + dur + 'ms';
      $('layer').appendChild(f);
      setTimeout(function () { f.style.left = r2.left + 'px'; f.style.top = r2.top + 'px'; f.style.minWidth = r2.width + 'px'; f.style.height = r2.height + 'px'; }, 30);
      setTimeout(function () { f.remove(); done(); }, dur + 60);
    });
  }

  /* ---------- 分頁 ---------- */
  /* 後面四個分頁（conv、math、ord、tabc）的程式在 lab-cluster2.js，切分頁時通知它停掉動畫、畫出內容 */
  var TABS = ['bun', 'td', 'err', 'mrg', 'conv', 'math', 'ord', 'tabc'];
  function show(t) {
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    TABS.forEach(function (k) { var s = $('t-' + k); if (s) s.hidden = k !== t; });
    if (window.ClusterLab2) window.ClusterLab2.onShow(t);
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  if (/^#(bun|td|err|mrg)$/.test(location.hash)) show(location.hash.slice(1));

  /* =====================================================================
     1. Bundle / Unbundle / By Name 與叢集順序
     ===================================================================== */
  var TYPE = { dbl: 'DBL', i32: 'I32', bool: 'TF', str: 'abc' };
  var EL = {
    rx: { name: '右軸位置', t: 'dbl', v: '120.5' },
    lx: { name: '左軸位置', t: 'dbl', v: '80.0' },
    sp: { name: '速度', t: 'i32', v: '300' },
    run: { name: '運轉中', t: 'bool', v: 'T' },
    ac: { name: '異常碼', t: 'str', v: '"E00"' }
  };
  /* 程式設計者接線時的順序（接好之後線就固定在端子位置上） */
  var WIRED = ['rx', 'lx', 'sp', 'run', 'ac'];
  var BCONST = { rx: '250.0', lx: '249.5', sp: '800', run: 'T', ac: '"E12"' };
  var B = { mode: 'unbundle', order: WIRED.slice(), val: {}, bbnKey: 'sp', bbnRaw: '500', busy: false };
  WIRED.forEach(function (id) { B.val[id] = EL[id].v; });

  function parseVal(t, raw) {
    raw = String(raw).trim();
    if (t === 'dbl') { var n = Number(raw); if (!isFinite(n)) n = 0; return Number.isInteger(n) ? n.toFixed(1) : String(n); }
    if (t === 'i32') { var m = Number(raw); return String(isFinite(m) ? roundEven(m) : 0); }
    if (t === 'bool') return /^(t|true|1|on)$/i.test(raw) ? 'T' : 'F';
    return '"' + raw.replace(/^"|"$/g, '') + '"';
  }
  /* 依位置接線：端子 k 現在送出／接收的是 order[k]，但線當初是為 WIRED[k] 接的 */
  /* 數值（DBL、I32）彼此互通：接錯只多一個強制轉換點；數值／布林／字串之間不通才斷線 */
  function isNum(t) { return t === 'dbl' || t === 'i32'; }
  function posMap(order) {
    return WIRED.map(function (w, k) {
      var g = order[k], a = EL[g].t, b = EL[w].t, same = a === b, num = isNum(a) && isNum(b);
      return { k: k, want: w, got: g, ok: g === w, broken: !same && !num, coerce: !same && num };
    });
  }
  function cdot(p) { return p.coerce ? '<i class="cdot" title="強制轉換點"></i>' : ''; }
  function wrongWhy(p, fromT, toT) { return p.coerce ? '（' + TYPE[fromT] + ' 接到 ' + TYPE[toT] + '，有強制轉換點' + (toT === 'i32' ? '，捨入到最近的整數' : '') + '）' : ''; }
  function cluFrame(prefix, vals, label) {
    return '<div class="clu"><span class="cl">' + esc(label || '機台狀態') + '</span>' + B.order.map(function (id, i) {
      var e = EL[id];
      return '<div class="slot" id="' + prefix + 's-' + id + '"><small>' + i + '</small><span class="nm">' + esc(e.name) + '</span><span class="cv ' + e.t + '" id="' + prefix + '-' + id + '">' + esc(vals ? vals[id] : '?') + '</span></div>';
    }).join('') + '</div>';
  }
  var MODE = {
    bundle: { node: 'Bundle', desc: 'Bundle：把元素依「叢集順序」一個一個塞進去。左邊第 0 個端子進叢集的第 0 個元素，以此類推，看的是位置不是名字。',
      note: 'Bundle 的端子只標型別、不標名字。叢集順序改了：數值和布林、字串之間接錯會斷線（看得到）；型別相同、或都是數值（DBL、I32 互接只多一個強制轉換點）的，會默默塞進別的元素（不容易發現）。所以第 8 課說：本課程一律用 By Name。' },
    unbundle: { node: 'Unbundle', desc: 'Unbundle：依「叢集順序」把每個元素拆出來，第 0 個元素從第 0 個輸出端子出來。',
      note: '先按「執行」，再按「右軸位置 ↔ 左軸位置」重排後執行一次：兩個都是 DBL，線不會斷，但兩個顯示元件的數字對調了，LabVIEW 不會給任何提示。再試「速度 移到第 0 個」：DBL 和 I32 都是數值，線不會斷，只多一個強制轉換點（小紅點），VI 照樣能跑，但值錯位了，DBL 進 I32 還會捨入成整數（剛好 .5 取偶數）。最後試「異常碼 移到第 0 個」：字串、布林接到數值的地方，線直接斷掉。' },
    bbn: { node: 'Bundle\nBy Name', desc: 'Bundle By Name：上面接一個原本的叢集，只改你點名的元素，其他元素照原本的值傳過去。',
      note: '選一個元素、打新的值，按執行：只有那一個是新的（綠框），其他都是從輸入叢集原封不動搬過去。這就是在迴圈裡「更新狀態的一個欄位」最常用的寫法。叢集順序怎麼改都不影響。' },
    ubn: { node: 'Unbundle\nBy Name', desc: 'Unbundle By Name：用名字取出元素，端子上直接寫元素名稱。可以只取需要的幾個。',
      note: '先重排叢集順序再執行：每個顯示元件拿到的還是同名的元素。叢集順序只影響「靠位置」的 Bundle／Unbundle。' }
  };
  function renderBun() {
    var m = B.mode, L = '', R = '', map = posMap(B.order);
    Array.prototype.forEach.call($('modes').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.m === m); });
    $('mdesc').textContent = MODE[m].desc;
    $('cnode').textContent = MODE[m].node;
    $('cnote').textContent = MODE[m].note;
    if (m === 'unbundle') {
      L = cluFrame('src', B.val);
      R = map.map(function (p) {
        var tt = EL[p.got].t, it = EL[p.want].t;
        return '<div class="trow"><span class="tn">端子 ' + p.k + '（' + TYPE[tt] + '）</span><i class="tw ' + tt + (p.broken ? ' broken' : '') + '"></i>' + cdot(p) + '<span class="cv ' + it + '" id="out-' + p.k + '">?</span><span>' + esc(EL[p.want].name) + ' 顯示</span></div>';
      }).join('');
    } else if (m === 'ubn') {
      L = cluFrame('src', B.val);
      R = WIRED.map(function (id) {
        var t = EL[id].t;
        return '<div class="trow"><span class="tn">' + esc(EL[id].name) + '</span><i class="tw ' + t + '"></i><span class="cv ' + t + '" id="out-' + id + '">?</span><span>' + esc(EL[id].name) + ' 顯示</span></div>';
      }).join('');
    } else if (m === 'bundle') {
      L = map.map(function (p) {
        var tt = EL[p.got].t, ct = EL[p.want].t;
        return '<div class="trow"><span class="cv ' + ct + '" id="in-' + p.k + '">' + esc(BCONST[p.want]) + '</span><span class="why" style="margin:0">要給 ' + esc(EL[p.want].name) + '</span><i class="tw ' + ct + (p.broken ? ' broken' : '') + '"></i>' + cdot(p) + '<span class="tn">端子 ' + p.k + '（' + TYPE[tt] + '）</span></div>';
      }).join('');
      R = cluFrame('dst', null);
    } else {
      var k = B.bbnKey, t = EL[k].t;
      L = cluFrame('src', B.val, '輸入叢集（原本的狀態）') +
        '<div class="trow" style="margin-top:10px"><select id="bbnk">' + WIRED.map(function (id) { return '<option value="' + id + '"' + (id === k ? ' selected' : '') + '>' + esc(EL[id].name) + '</option>'; }).join('') +
        '</select><input class="cv ' + t + '" id="bbnv" value="' + esc(B.bbnRaw) + '" style="width:80px;color:inherit" aria-label="新的值"><i class="tw ' + t + '"></i><span class="tn">端子「' + esc(EL[k].name) + '」</span></div>';
      R = cluFrame('dst', null, '輸出叢集');
    }
    $('cleft').innerHTML = L; $('cright').innerHTML = R;
    var pos = m === 'bundle' || m === 'unbundle';
    var anyBroken = pos && map.some(function (p) { return p.broken; }), anyCo = pos && map.some(function (p) { return p.coerce; });
    $('csay').className = 'verdict-line' + (anyBroken ? ' bad' : '');
    $('csay').textContent = anyBroken ? '有線斷了（虛線 ✕）：數值和布林、字串之間接不起來，執行箭頭會斷掉，整個 VI 不能跑。' + (anyCo ? '（小紅點是強制轉換點：數值互接不會斷）' : '')
      : anyCo ? '有強制轉換點（小紅點）：DBL、I32 都是數值，不會斷線，VI 可以跑，但值接到別的元素了。' : '';
    if (m === 'bbn') {
      $('bbnk').onchange = function () { B.bbnKey = this.value; B.bbnRaw = EL[this.value].t === 'bool' ? (B.val[this.value] === 'T' ? 'F' : 'T') : B.val[this.value].replace(/"/g, ''); renderBun(); };
      $('bbnv').oninput = function () { B.bbnRaw = this.value; };
    }
  }
  $('modes').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && !B.busy) { B.mode = b.dataset.m; renderBun(); } });

  async function runBun() {
    if (B.busy) return; B.busy = true;
    try {
      renderBun();
      var m = B.mode, map = posMap(B.order), say = $('csay');
      if ((m === 'bundle' || m === 'unbundle') && map.some(function (p) { return p.broken; })) { B.busy = false; return; }
      if (m === 'unbundle') {
        await Promise.all(map.map(function (p, i) {
          var src = $('src-' + p.got), dst = $('out-' + p.k);
          src.parentNode.classList.add('hit');
          var shownV = p.coerce ? parseVal(EL[p.want].t, B.val[p.got]) : B.val[p.got];
          return sleep(i * 90).then(function () { return fly(src, dst, B.val[p.got], p.ok ? '' : 'ferr'); }).then(function () {
            dst.textContent = shownV; if (!p.ok) dst.classList.add('wrong');
          });
        }));
        var bad = map.filter(function (p) { return !p.ok; });
        say.className = 'verdict-line ' + (bad.length ? 'bad' : 'ok');
        say.textContent = bad.length ? '沒有斷線，可是 ' + bad.map(function (p) { return EL[p.want].name + ' 顯示的其實是 ' + EL[p.got].name + wrongWhy(p, EL[p.got].t, EL[p.want].t); }).join('、') + '。型別一樣或都是數值，LabVIEW 不會擋你。' : '每個端子照叢集順序輸出，剛好都接對。';
      } else if (m === 'ubn') {
        await Promise.all(WIRED.map(function (id, i) {
          var src = $('src-' + id), dst = $('out-' + id);
          src.parentNode.classList.add('hit');
          return sleep(i * 90).then(function () { return fly(src, dst, B.val[id]); }).then(function () { dst.textContent = B.val[id]; });
        }));
        say.className = 'verdict-line ok';
        say.textContent = B.order.join() === WIRED.join() ? '用名字取，每個都對。' : '叢集順序已經改過了，但用名字取，每個顯示元件拿到的還是同名的元素。';
      } else if (m === 'bundle') {
        var nv = {};
        await Promise.all(map.map(function (p, i) {
          var src = $('in-' + p.k), dst = $('dst-' + p.got);
          var stored = p.coerce ? parseVal(EL[p.got].t, BCONST[p.want]) : BCONST[p.want];
          return sleep(i * 90).then(function () { return fly(src, dst, BCONST[p.want], p.ok ? '' : 'ferr'); }).then(function () {
            dst.textContent = stored; nv[p.got] = stored;
            if (!p.ok) { dst.classList.add('wrong'); dst.parentNode.classList.add('bad'); }
          });
        }));
        B.val = nv;
        var bad2 = map.filter(function (p) { return !p.ok; });
        say.className = 'verdict-line ' + (bad2.length ? 'bad' : 'ok');
        say.textContent = bad2.length ? '沒有斷線，可是 ' + bad2.map(function (p) { return '要給 ' + EL[p.want].name + ' 的 ' + BCONST[p.want] + ' 跑進了 ' + EL[p.got].name + wrongWhy(p, EL[p.want].t, EL[p.got].t); }).join('、') + '。' :'五個常數照位置塞進叢集，都進到對的元素。（輸出的叢集會當成下一次 Unbundle 的輸入）';
      } else {
        var key = B.bbnKey, v = parseVal(EL[key].t, B.bbnRaw), others = B.order.filter(function (id) { return id !== key; });
        await Promise.all(others.map(function (id, i) {
          var src = $('src-' + id), dst = $('dst-' + id);
          return sleep(i * 70).then(function () { return fly(src, dst, B.val[id], 'ok'); }).then(function () { dst.textContent = B.val[id]; });
        }));
        $('srcs-' + key).classList.add('hit');
        await fly($('bbnv'), $('dst-' + key), v, 'new');
        $('dst-' + key).textContent = v; $('dst-' + key).classList.add('new'); $('dsts-' + key).classList.add('add');
        var old = B.val[key]; B.val[key] = v;
        say.className = 'verdict-line ok';
        say.textContent = '只有「' + EL[key].name + '」從 ' + old + ' 變成 ' + v + '，其他 ' + others.length + ' 個元素照輸入叢集原本的值。';
      }
    } finally { B.busy = false; }
  }
  $('crun').onclick = runBun;
  function reorder(order, msg) {
    if (B.busy) return;
    B.order = order; renderBun();
    if (!$('csay').textContent) { $('csay').className = 'verdict-line'; $('csay').textContent = msg; }
  }
  $('ro1').onclick = function () { var o = B.order.slice(), a = o.indexOf('rx'), b = o.indexOf('lx'); o[a] = 'lx'; o[b] = 'rx'; reorder(o, '叢集順序改了（元素的值沒變，只是排第幾個變了）。按執行看看。'); };
  function toFront(id, msg) { var o = B.order.filter(function (x) { return x !== id; }); o.unshift(id); reorder(o, msg); }
  $('ro3').onclick = function () { toFront('sp', '速度（I32）移到第 0 個。按執行看看。'); };
  $('ro2').onclick = function () { toFront('ac', '異常碼（字串）移到第 0 個。'); };
  $('ro0').onclick = function () { reorder(WIRED.slice(), '順序還原了。'); };

  /* =====================================================================
     2. Type Def
     ===================================================================== */
  var TD_BASE = WIRED.map(function (id) { return { name: EL[id].name, t: EL[id].t }; });
  var TD_ADD = [{ name: '原點完成', t: 'bool' }, { name: '循環次數', t: 'i32' }, { name: '訊息', t: 'str' }];
  var T = { ctl: [], vis: [{ name: 'GT_Parse.vi', td: true }, { name: 'GT_Monitor.vi', td: true }, { name: 'GT_Main.vi', td: false }], busy: false };
  function clone(d) { return d.map(function (x) { return { name: x.name, t: x.t }; }); }
  function tdSame(a, b) { return a.length === b.length && a.every(function (x, i) { return x.t === b[i].t && x.name === b[i].name; }); }
  function tdReset() { T.ctl = clone(TD_BASE); T.vis.forEach(function (v) { v.def = clone(TD_BASE); }); }
  tdReset();
  function defRows(def, pre, hideFrom) {
    return def.map(function (x, k) {
      return '<div class="slot" id="' + pre + k + '"' + (hideFrom != null && k >= hideFrom ? ' style="visibility:hidden"' : '') + '><small>' + k + '</small><span class="nm">' + esc(x.name) + '</span><span class="cv ' + x.t + '" style="min-width:42px;height:24px">' + TYPE[x.t] + '</span></div>';
    }).join('');
  }
  function renderTd(hide) {
    var changed = T.ctl.length > TD_BASE.length;
    $('tdchk').innerHTML = T.vis.map(function (v, i) {
      return '<label class="check small"><input type="checkbox" data-i="' + i + '"' + (v.td ? ' checked' : '') + (changed ? ' disabled' : '') + '> ' + esc(v.name) + ' 用 Type Def</label>';
    }).join('') + (changed ? '<span class="why">（改過 .ctl 了，要換勾選請先按重設）</span>' : '');
    $('tdctl').innerHTML = '<h4><b class="tri">◤</b>MachineStatus.ctl（Type Def）</h4><div class="clu"><span class="cl">機台狀態</span>' + defRows(T.ctl, 'tdc-') + '</div>';
    var h = '';
    T.vis.forEach(function (v, i) {
      if (i) {
        var ok = tdSame(T.vis[i - 1].def, v.def);
        h += '<div class="vlink" title="' + (ok ? '叢集線' : '斷線') + '"><i class="tw clu' + (ok ? '' : ' broken') + '"></i></div>';
      }
      var behind = !tdSame(v.def, T.ctl);
      h += '<div class="vi' + (behind ? ' behind' : '') + '" id="tdv' + i + '"><h4>' + esc(v.name) + '</h4><div class="why" style="margin:0 0 6px">' + (v.td ? '<b class="tri">◤</b>連到 Type Def' : '一般叢集（自己的複本）') + '</div>' +
        '<div class="clu"><span class="cl">' + (v.td ? '◤ ' : '') + '機台狀態</span>' + defRows(v.def, 'tdv' + i + '-', hide && hide[i] != null ? hide[i] : null) + '</div>' +
        (behind ? '<p class="why" style="color:var(--lab-red)">還是舊的定義（' + v.def.length + ' 個元素）</p><button type="button" data-fix="' + i + '">手動改這個 VI</button>' : '') + '</div>';
    });
    $('tdvis').innerHTML = h;
  }
  function tdVerdict() {
    var broken = [], say = $('tdsay');
    for (var i = 1; i < T.vis.length; i++) if (!tdSame(T.vis[i - 1].def, T.vis[i].def)) broken.push(T.vis[i - 1].name + ' → ' + T.vis[i].name);
    var behind = T.vis.filter(function (v) { return !tdSame(v.def, T.ctl); });
    if (!behind.length) { say.className = 'verdict-line ok'; say.textContent = '每個 VI 都是最新的定義，線全部接得起來。'; return; }
    if (behind.length === T.vis.length) { say.className = 'verdict-line bad'; say.textContent = '三個都沒用 Type Def：.ctl 改了，沒有一個 VI 知道。彼此還接得起來，但新元素根本沒進到任何 VI，等於白改。'; return; }
    say.className = 'verdict-line bad';
    say.textContent = (broken.length ? '斷線：' + broken.join('、') + '。' : '') + behind.map(function (v) { return v.name; }).join('、') + ' 沒用 Type Def，還停在舊定義，要一個一個手動改；漏一個就斷線、整個程式不能跑。';
  }
  $('tdchk').addEventListener('change', function (e) { var c = e.target; if (c.dataset.i != null) { T.vis[+c.dataset.i].td = c.checked; renderTd(); $('tdsay').textContent = ''; } });
  $('tdadd').onclick = async function () {
    if (T.busy) return;
    var n = T.ctl.length - TD_BASE.length;
    if (n >= TD_ADD.length) { $('tdsay').className = 'verdict-line'; $('tdsay').textContent = '示範到這裡，按「重設」再玩一次。'; return; }
    T.busy = true;
    try {
      var add = TD_ADD[n], k = T.ctl.length, hide = {};
      T.ctl.push({ name: add.name, t: add.t });
      T.vis.forEach(function (v, i) { if (v.td) { v.def.push({ name: add.name, t: add.t }); hide[i] = k; } });
      renderTd(hide);
      $('tdc-' + k).classList.add('add');
      $('tdsay').className = 'verdict-line'; $('tdsay').textContent = '.ctl 多了「' + add.name + '」（' + TYPE[add.t] + '），存檔……';
      await sleep(400);
      for (var i = 0; i < T.vis.length; i++) {
        if (!T.vis[i].td) continue;
        var dst = $('tdv' + i + '-' + k);
        await fly($('tdc-' + k), dst, add.name, 'new');
        dst.style.visibility = ''; dst.classList.add('add');
      }
      tdVerdict();
    } finally { T.busy = false; }
  };
  $('tdvis').addEventListener('click', async function (e) {
    var b = e.target.closest('button[data-fix]'); if (!b || T.busy) return;
    T.busy = true;
    try {
      var i = +b.dataset.fix, from = T.vis[i].def.length, hide = {};
      T.vis[i].def = clone(T.ctl); hide[i] = from;
      renderTd(hide);
      for (var k = from; k < T.ctl.length; k++) {
        var dst = $('tdv' + i + '-' + k);
        await fly($('tdc-' + k), dst, T.ctl[k].name, 'new');
        dst.style.visibility = ''; dst.classList.add('add');
      }
      tdVerdict();
      if (!T.vis.some(function (v) { return !tdSame(v.def, T.ctl); })) $('tdsay').textContent = '手動改好了，線接回來了。可是專案裡有幾十個 VI 時，靠手動很容易漏，所以會在 VI 之間傳的叢集一律做成 Type Def。';
    } finally { T.busy = false; }
  });
  $('tdreset').onclick = function () { if (T.busy) return; tdReset(); renderTd(); $('tdsay').textContent = ''; };

  /* =====================================================================
     3. 錯誤叢集的流動
     ===================================================================== */
  var NODES = [
    { id: 'open', name: 'VISA Open', inj: [{ k: 'err', code: -1073807343, src: 'VISA Open in GT_Comm.vi', say: '找不到 COM 埠' }] },
    { id: 'write', name: 'VISA Write', inj: [{ k: 'err', code: -1073807339, src: 'VISA Write in GT_Comm.vi', say: '寫入逾時' }] },
    { id: 'read', name: 'VISA Read', inj: [{ k: 'err', code: -1073807339, src: 'VISA Read in GT_Comm.vi', say: '讀取逾時（PLC 沒回應）' }, { k: 'warn', code: 1073676294, src: 'VISA Read in GT_Comm.vi', say: '警告：讀到的位元組數剛好等於要求的數量，可能還有資料沒讀' }] },
    { id: 'clear', name: 'Clear Errors', opt: true },
    { id: 'check', name: 'FX_Check.vi', inj: [{ k: 'err', code: 5001, src: 'FX_Check: bad reply (STX or checksum)', say: '回應的 STX 或校驗不對（自訂錯誤碼）' }] },
    { id: 'close', name: 'VISA Close', always: true },
    { id: 'seh', name: 'Simple Error Handler', end: true }
  ];
  var WHY = { '-1073807343': 'VISA 找不到這個資源：COM 埠名稱打錯，或 USB 轉 RS-232 線沒插。', '-1073807339': '逾時：在 Timeout 時間內沒收到（或送不出）資料。檢查接線、鮑率、PLC 有沒有上電。', '5001': '自訂錯誤：PLC 回應的格式或校驗不對。' };
  var E = { inj: { open: 0, write: 0, read: 0, check: 0 }, clear: false, busy: false };
  function noErr() { return { status: false, code: 0, source: '' }; }
  function nodeById(id) { for (var i = 0; i < NODES.length; i++) if (NODES[i].id === id) return NODES[i]; return null; }
  /* inj：{節點 id: 0 正常 / 1.. 第幾種注入}；clear：Read 後面有沒有 Clear Errors。回傳每一步 {id, ran, why, out} */
  function simulate(inj, clear) {
    var e = noErr(), steps = [];
    NODES.forEach(function (n) {
      if (n.opt && !clear) return;
      var inE = e, st;
      if (n.end) { steps.push({ id: n.id, ran: true, out: e, why: e.status ? '有錯誤 → 跳出對話框' : (e.code ? '收到警告（status False）。type of dialog 預設 1 只顯示錯誤，選 3 或 4 才連警告一起顯示，本頁不畫' : '沒有錯誤，什麼都不顯示') }); return; }
      if (n.opt) { e = noErr(); st = { ran: true, why: inE.status || inE.code ? '把錯誤清掉，後面看到的是「沒有錯誤」' : '本來就沒有錯誤，輸出還是沒有錯誤' }; }
      else if (inE.status && !n.always) st = { ran: false, why: '收到錯誤 → 不執行，原封不動往後傳' };
      else {
        var j = (inj && inj[n.id]) || 0, x = j && n.inj ? n.inj[j - 1] : null;
        if (n.always) st = { ran: true, why: inE.status ? '收到錯誤也照樣關閉連線，錯誤原封不動往後傳' : '關閉連線' };
        else if (x) { e = { status: x.k === 'err', code: x.code, source: x.src }; st = { ran: true, why: x.say, made: x.k }; }
        else st = { ran: true, why: inE.code ? '收到的是警告，不算錯誤，照常執行' : '正常執行' };
      }
      st.id = n.id; st.out = e; steps.push(st);
    });
    return steps;
  }
  function chipText(e) { return (e.status ? '✗ ' : e.code ? '⚠ ' : '✓ ') + e.code; }
  function chipCls(e) { return e.status ? 'ferr' : e.code ? 'warn' : 'ok'; }
  function drawEcl(e) {
    $('ecl').innerHTML = '<span>status</span><span><i class="led ' + (e.status ? 't' : 'f') + '"></i>' + (e.status ? 'True（錯誤）' : 'False') + '</span><span>code</span><span>' + e.code + (e.code && !e.status ? '（警告）' : '') + '</span><span>source</span><span>' + (e.source ? esc(e.source) : '（空）') + '</span>';
  }
  function renderChain() {
    var h = [];
    NODES.forEach(function (n) {
      if (n.opt && !E.clear) return;
      var sel = '';
      if (n.inj) sel = '<select data-n="' + n.id + '" aria-label="' + esc(n.name) + ' 注入"><option value="0">正常</option>' + n.inj.map(function (x, i) { return '<option value="' + (i + 1) + '"' + (E.inj[n.id] === i + 1 ? ' selected' : '') + '>注入' + (x.k === 'err' ? '錯誤 ' : '警告 ') + x.code + '</option>'; }).join('') + '</select>';
      else if (n.always) sel = '<span class="stt" style="color:inherit">（照樣執行）</span>';
      h.push('<div class="en' + (n.opt ? ' clr' : '') + '" id="en-' + n.id + '"><b>' + esc(n.name) + '</b><span class="stt" id="st-' + n.id + '">等待</span>' + sel + '</div>');
    });
    $('chain').innerHTML = h.join('<i class="tw ewire"></i>');
    drawEcl(noErr()); $('dlg').innerHTML = '';
  }
  $('chain').addEventListener('change', function (e) { var s = e.target; if (s.dataset.n) { E.inj[s.dataset.n] = +s.value; } });
  $('eclear').onchange = function () { if (E.busy) { this.checked = E.clear; return; } E.clear = this.checked; renderChain(); };
  $('ereset').onclick = function () { if (E.busy) return; Object.keys(E.inj).forEach(function (k) { E.inj[k] = 0; }); renderChain(); $('elog').innerHTML = ''; };
  function logE(s) { var d = document.createElement('div'); d.innerHTML = s; $('elog').appendChild(d); $('elog').scrollTop = 1e6; }
  async function runChain() {
    if (E.busy) return; E.busy = true;
    try {
      renderChain(); $('elog').innerHTML = '';
      var steps = simulate(E.inj, E.clear);
      logE('error in 沒接 → 一開始是「沒有錯誤」');
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i], n = nodeById(s.id), box = $('en-' + s.id);
        box.classList.add('on');
        await sleep(380);
        var cls = !s.ran ? 'skip' : n.opt ? 'clr' : s.made === 'err' ? 'eerr' : s.made === 'warn' ? 'warn' : (n.end && s.out.status ? 'eerr' : n.end && s.out.code ? 'warn' : 'ran');
        box.classList.remove('on'); box.classList.add(cls);
        $('st-' + s.id).textContent = !s.ran ? '跳過' : s.made === 'err' ? '出錯！' : s.made === 'warn' ? '警告' : n.end ? (s.out.status ? '顯示錯誤' : s.out.code ? '收到警告' : '沒事') : '執行了';
        drawEcl(s.out);
        logE('<b>' + esc(n.name) + '</b>：' + esc(s.why) + ' → ' + chipText(s.out));
        if (i < steps.length - 1) await fly(box, $('en-' + steps[i + 1].id), chipText(s.out), chipCls(s.out));
      }
      var last = steps[steps.length - 1].out;
      if (last.status) {
        $('dlg').innerHTML = '<div class="dlg" role="dialog" aria-label="錯誤對話框（示意）"><div class="dt">Error（Simple Error Handler 對話框示意）</div><div class="db">錯誤 <b>' + last.code + '</b> 發生在 ' + esc(last.source) + '<br><br>' + esc(WHY[String(last.code)] || '') + '<button type="button" id="dlgok">OK</button></div></div>';
        $('dlgok').onclick = function () { $('dlg').innerHTML = ''; };
        logE('Simple Error Handler 預設會跳出對話框，按 OK 之後程式才繼續。');
      } else if (last.code) {
        logE('最後是警告：警告不會讓後面的節點跳過，前面每個節點都照常執行了。Simple Error Handler 的 type of dialog 預設是 1（OK message），只顯示錯誤；要連警告一起顯示，選 3（OK message + warnings）或 4。本頁只畫出錯誤的對話框。');
      } else logE('一路都沒有錯誤。');
    } finally { E.busy = false; }
  }
  $('erun').onclick = runChain;

  /* =====================================================================
     4. Merge Errors
     ===================================================================== */
  var MIN = [
    { name: '右龍門 PLC（COM3）', err: { status: true, code: -1073807339, source: 'VISA Read（右）' }, warn: { status: false, code: 1073676294, source: 'VISA Read（右）' } },
    { name: '左龍門 PLC（COM4）', err: { status: true, code: 5001, source: 'FX_Check（左）' }, warn: { status: false, code: 1073676294, source: 'VISA Read（左）' } },
    { name: '寫入 CSV 紀錄檔', err: { status: true, code: 7, source: 'Open/Create/Replace File' }, warn: null }
  ];
  var M = { sel: ['err', 'none', 'none'], busy: false };
  function minVal(i) { var s = M.sel[i]; return s === 'none' ? noErr() : MIN[i][s]; }
  /* 先找第一個錯誤；沒有錯誤才找第一個警告；都沒有就是沒有錯誤。回傳 index（-1 = 沒有錯誤） */
  function mergeErrors(list) {
    for (var i = 0; i < list.length; i++) if (list[i].status) return i;
    for (i = 0; i < list.length; i++) if (list[i].code) return i;
    return -1;
  }
  function renderMerge() {
    $('min').innerHTML = MIN.map(function (m, i) {
      var opts = [['none', '沒有錯誤'], ['err', '錯誤 ' + m.err.code]]; if (m.warn) opts.push(['warn', '警告 ' + m.warn.code]);
      return '<div class="min"><span class="tn" style="font:12px ui-monospace,Consolas,monospace;color:var(--mute)">輸入 ' + i + '</span><span style="font-size:13px">' + esc(m.name) + '</span><select data-i="' + i + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (M.sel[i] === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select><span class="chip" id="mi-' + i + '">' + chipText(minVal(i)) + '</span></div>';
    }).join('');
    $('mout').textContent = '?'; $('msay').textContent = '';
  }
  $('min').addEventListener('change', function (e) { var s = e.target; if (s.dataset.i != null && !M.busy) { M.sel[+s.dataset.i] = s.value; renderMerge(); } });
  async function runMerge() {
    if (M.busy) return; M.busy = true;
    try {
      renderMerge();
      var list = MIN.map(function (_, i) { return minVal(i); }), w = mergeErrors(list), node = document.querySelector('#t-mrg .node');
      await Promise.all(list.map(function (e, i) { return sleep(i * 120).then(function () { return fly($('mi-' + i), node, chipText(e), chipCls(e)); }); }));
      var out = w < 0 ? noErr() : list[w];
      if (w >= 0) $('mi-' + w).classList.add('win');
      await fly(node, $('mout'), chipText(out), chipCls(out));
      $('mout').textContent = chipText(out) + (out.source ? '  ' + out.source : '');
      var firstErr = list.some(function (e) { return e.status; });
      $('msay').textContent = w < 0 ? '三個輸入都沒有錯誤也沒有警告。' : firstErr ? '輸入 ' + w + ' 是從上往下第一個錯誤，傳出去的就是它' + (list.filter(function (e) { return e.status; }).length > 1 ? '；下面的錯誤被丟掉了。' : '。') : '沒有任何錯誤，所以傳出第一個警告（輸入 ' + w + '）。';
    } finally { M.busy = false; }
  }
  $('mrun').onclick = runMerge;
  $('mswap').onclick = function () { if (M.busy) return; var t = MIN[0]; MIN[0] = MIN[1]; MIN[1] = t; var s = M.sel[0]; M.sel[0] = M.sel[1]; M.sel[1] = s; renderMerge(); };
  $('mrand').onclick = function () { if (M.busy) return; M.sel = MIN.map(function (m) { return pickOne(m.warn ? ['none', 'err', 'warn', 'warn'] : ['none', 'err']); }); renderMerge(); };

  /* =====================================================================
     5. 猜一猜
     ===================================================================== */
  var REORD = [
    { say: '把「右軸位置」和「左軸位置」對調', order: ['lx', 'rx', 'sp', 'run', 'ac'] },
    { say: '把「速度」移到第 0 個', order: ['sp', 'rx', 'lx', 'run', 'ac'] },
    { say: '把「運轉中」和「異常碼」對調', order: ['rx', 'lx', 'sp', 'ac', 'run'] },
    { say: '把「異常碼」移到第 0 個', order: ['ac', 'rx', 'lx', 'sp', 'run'] }
  ];
  var ERRN = ['open', 'write', 'read', 'check'];
  function nm(id) { return nodeById(id).name; }
  var GENS = [
    function () { /* 某節點出錯，後面的節點會不會執行 */
      var a = pickOne(ERRN), ai = ERRN.indexOf(a), after = ERRN.slice(ai + 1).concat(['close']), b = pickOne(after), inj = {}; inj[a] = 1;
      var q = '<b>' + nm(a) + '</b> 出錯了（其他節點正常），用錯誤線串在後面的 <b>' + nm(b) + '</b> 會怎樣？';
      if (b === 'close') return { q: q, ans: '照樣執行，並把原本的錯誤往後傳', wrong: ['不執行，直接把錯誤往後傳', '照樣執行，並把錯誤清掉', '整個 VI 立刻停止', '照樣執行，改傳自己的新錯誤碼'], ex: 'Close 類節點不管 error in 有沒有錯誤都會執行，才不會讓 COM 埠一直被占著；錯誤本身照樣往後傳。' };
      return { q: q, ans: '不執行，直接把錯誤往後傳', wrong: ['照常執行', '照常執行，但輸出空字串', '整個 VI 立刻停止', '先把錯誤清掉再執行'], ex: '幾乎所有 I/O 節點收到 status = True 都不做事，把同一個錯誤傳出去。VI 不會停，後面每個節點都一樣跳過。' };
    },
    function () { /* 兩個節點都注入錯誤，最後收到哪個 code */
      var pairs = [['open', 'write'], ['open', 'read'], ['open', 'check'], ['write', 'check'], ['read', 'check']], p = pickOne(pairs), inj = {};
      inj[p[0]] = 1; inj[p[1]] = 1;
      var steps = simulate(inj, false), code = String(steps[steps.length - 1].out.code);
      var all = ['-1073807343', '-1073807339', '5001', '0', '1073676294'].filter(function (c) { return c !== code; });
      return { q: '<b>' + nm(p[0]) + '</b> 和 <b>' + nm(p[1]) + '</b> 都設成會出錯。最後 Simple Error Handler 收到的 code 是多少？', ans: code, wrong: all,
        ex: nm(p[0]) + ' 先出錯，' + nm(p[1]) + ' 收到錯誤根本沒執行，自己的錯誤也就不會發生。錯誤線上永遠是第一個錯誤：' + code + '。' };
    },
    function () { /* 警告 */
      return pickOne([
        { q: 'VISA Read 回傳 code 1073676294、status False。後面的 <b>FX_Check.vi</b>（用 Error Case 寫的）會？', ans: '照常執行（走 No Error 頁）', wrong: ['不執行，把警告傳下去（走 Error 頁）', '執行到一半就停下來', '把 code 改成 0 再執行'], ex: '這是警告：status 是 False。Case 的選擇器只看 status，所以走 No Error 頁，照常做事。' },
        { q: '下面哪一個錯誤叢集是「警告」？', ans: 'status False、code 1073676294', wrong: ['status True、code 5001', 'status False、code 0', 'status True、code -1073807339'], ex: '警告＝status False 但 code 不是 0。status False、code 0 才是完全沒事。' }
      ]);
    },
    function () { /* Merge Errors */
      var sel = MIN.map(function (m) { return pickOne(m.warn ? ['none', 'err', 'warn'] : ['none', 'err']); });
      if (sel.every(function (s) { return s === 'none'; })) sel[pickOne([0, 1])] = 'warn';
      var list = sel.map(function (s, i) { return s === 'none' ? noErr() : MIN[i][s]; }), w = mergeErrors(list);
      function lab(i) { var e = list[i]; return '輸入 ' + i + '（' + (e.status ? '錯誤 ' : e.code ? '警告 ' : '沒有錯誤') + (e.code || '') + '）'; }
      var none = '沒有錯誤（status False、code 0）';
      var ans = w < 0 ? none : lab(w), wrong = [0, 1, 2].filter(function (i) { return i !== w && list[i].code; }).map(lab).concat([none, '把 code 加起來的新錯誤', '兩個錯誤都傳出去（變成陣列）']).filter(function (x) { return x !== ans; });
      return { q: 'Merge Errors 的三個輸入：' + [0, 1, 2].map(function (i) { return '<br>輸入 ' + i + '：' + (list[i].status ? '錯誤 ' + list[i].code : list[i].code ? '警告 ' + list[i].code : '沒有錯誤'); }).join('') + '<br>error out 會是哪一個？', ans: ans, wrong: wrong,
        ex: 'Merge Errors 從輸入 0 往下找第一個錯誤；一個錯誤都沒有，才找第一個警告。' };
    },
    function () { /* Unbundle 重排 */
      var r = pickOne(REORD), map = posMap(r.order), byName = Math.random() < 0.25;
      var cand = map.filter(function (p) { return !p.ok; }); var p = pickOne(cand.length && Math.random() < 0.8 ? cand : map);
      var want = EL[p.want].name, other = EL[pickOne(WIRED.filter(function (x) { return x !== p.want && x !== p.got; }))].name;
      var OK = '照樣顯示「' + want + '」', BROKEN = '線斷掉（型別不符），VI 不能執行';
      function WRONG(n) { return '變成顯示「' + n + '」的值，方塊圖上什麼記號都沒有'; }
      function WRONGC(n) { return '變成顯示「' + n + '」的值，只多一個強制轉換點，不會斷線'; }
      var gotN = EL[p.got].name, ans = byName ? OK : p.broken ? BROKEN : p.ok ? OK : p.coerce ? WRONGC(gotN) : WRONG(gotN);
      var wrong = [OK, BROKEN, p.coerce && !byName ? WRONGC(other) : WRONG(p.ok || byName ? other : gotN), WRONGC(p.ok || byName ? other : gotN), WRONG(other), '自動照名字重新接好'].filter(function (x) { return x !== ans; });
      return { q: '「機台狀態」原本的叢集順序是 右軸位置、左軸位置、速度、運轉中、異常碼，用 <b>' + (byName ? 'Unbundle By Name' : 'Unbundle') + '</b> 接好 5 個顯示元件。之後在 .ctl ' + r.say + '，原本接到「' + want + ' 顯示」的那條線會？', ans: ans, wrong: wrong,
        ex: byName ? 'By Name 用名字取，叢集順序怎麼改都不受影響。' : 'Unbundle 照叢集順序輸出，線接在端子位置上。第 ' + p.k + ' 個端子現在送出的是「' + EL[p.got].name + '」' + (p.broken ? '，數值和布林、字串之間接不起來，所以斷線。' : p.ok ? '，剛好沒變。' : p.coerce ? '，DBL 和 I32 都是數值，只多一個強制轉換點，VI 照跑但值接錯了' + (EL[p.want].t === 'i32' ? '（還會捨入成整數）' : '') + '。' : '，型別一樣，所以默默接錯。') };
    },
    function () { /* Bundle By Name */
      return { q: '輸入叢集原本「右軸位置」= 120.5。<b>Bundle By Name</b> 只接了「速度」= 500，輸出叢集的「右軸位置」是？', ans: '120.5（照輸入叢集的值）', wrong: ['0.0（沒接的元素變預設值）', '500', '斷線，每個元素都要接', '空的'], ex: 'Bundle By Name 是「修改」：只換點名的元素，其他元素從上面那個輸入叢集原封不動帶過去。' };
    },
    function () { /* Type Def */
      var i = pickOne([0, 1, 2]), names = ['GT_Parse.vi', 'GT_Monitor.vi', 'GT_Main.vi'];
      return { q: '「機台狀態」在 GT_Parse → GT_Monitor → GT_Main 之間傳。只有 <b>' + names[i] + '</b> 沒用 Type Def（自己做了一個一樣的叢集）。在 .ctl 加一個元素後會？', ans: names[i] + ' 停在舊定義，和它相接的叢集線斷掉', wrong: ['全部自動更新，不會斷線', names[i] + ' 也會自動更新，只是要重開', '只有 .ctl 本身出錯', '其他兩個 VI 也不會更新'], ex: '沒連到 Type Def 的叢集只是複本，元素數量不同就是不同型別，接在一起就斷線。' };
    },
    function () { /* Clear Errors */
      return { q: 'VISA Read 後面放了 <b>Clear Errors</b>。這次 Read 逾時了，最後 Simple Error Handler 會？', ans: '不跳對話框（錯誤已經被清掉）', wrong: ['跳出逾時 -1073807339 的對話框', 'FX_Check 收到錯誤不執行，最後跳對話框', '跳出 Clear Errors 自己的錯誤'], ex: 'Clear Errors 之後錯誤線上是「沒有錯誤」，後面的節點照常執行。只在你確定這個錯誤已經處理好（例如準備重連）時才這樣做，否則問題會被藏起來。' };
    }
  ];
  function gen() { return pickOne(GENS)(); }

  /* ---------- 初始化 ---------- */
  renderBun(); renderTd(); renderChain(); renderMerge();
  window.ClusterLab = {
    EL: EL, WIRED: WIRED, NODES: NODES, posMap: posMap, parseVal: parseVal, simulate: simulate, mergeErrors: mergeErrors, tdSame: tdSame,
    state: { bun: B, td: T, err: E, merge: M }, show: show, runBundle: runBun, runChain: runChain, runMerge: runMerge, gen: gen, GENS: GENS,
    quiz: window.LabQuiz ? window.LabQuiz('cquiz', gen) : null
  };
})();
