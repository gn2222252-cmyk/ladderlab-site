/* 專案實驗室：.lvproj 是清單、Global 與 Shared Variable 傳多遠、Build Specifications 建立執行檔、猜一猜 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function slowF() { return $('slow') && $('slow').checked ? 2.2 : 1; }

  /* 換分頁或重來時 RUN 加一，舊的回呼看到就停 */
  var RUN = 0;
  function wait(ms, my) { return new Promise(function (res, rej) { setTimeout(function () { if (my !== RUN) rej('cancel'); else res(); }, ms * slowF()); }); }
  function fly(a, b, text, my) {
    return new Promise(function (done, rej) {
      if (!a || !b) return done();
      var dur = Math.round(550 * slowF()), r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
      var f = document.createElement('div'); f.className = 'fly'; f.textContent = text;
      f.style.cssText = 'left:' + r1.left + 'px;top:' + r1.top + 'px;height:26px;transition-duration:' + dur + 'ms';
      $('layer').appendChild(f);
      setTimeout(function () { f.style.left = r2.left + 'px'; f.style.top = r2.top + 'px'; }, 30);
      setTimeout(function () { f.remove(); if (my !== RUN) rej('cancel'); else done(); }, dur + 60);
    });
  }
  function caught(e) { if (e !== 'cancel') throw e; }
  function distinct(ans, list) { var seen = {}; seen[ans] = 1; return list.filter(function (w) { if (seen[w]) return false; seen[w] = 1; return true; }); }
  function say(id, t, cls) { $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); $(id).textContent = t; }

  /* ---------- 分頁 ---------- */
  var TABS = ['pj', 'sv', 'bd'];
  function show(t) {
    RUN++;
    Array.prototype.forEach.call($('layer').children, function (f) { f.remove(); });
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    TABS.forEach(function (k) { $('t-' + k).hidden = k !== t; });
    if (t === 'pj') renderPj();
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });

  /* =====================================================================
     1. 專案是清單
     ===================================================================== */
  var DIRS = ['driver', 'host', 'old'];
  var P = {};
  function pReset() {
    P = {
      disk: ['13_PLC.lvproj', 'Host_Main.vi', 'driver/PLC_ReadWords.vi', 'driver/PLC_WriteWord.vi', 'host/Host_CommStep.vi', 'host/Host_UI.vi'],
      vf: ['driver/PLC_ReadWords.vi', 'driver/PLC_WriteWord.vi'], extraVf: false, fresh: {}
    };
  }
  pReset();
  function slug(p) { return p.replace(/[^\w]/g, '_'); }
  function base(p) { return p.split('/').pop(); }
  function onDisk(p) { return P.disk.indexOf(p) >= 0; }
  /* 純函式：Auto-populating 資料夾看到的檔案 = 硬碟上該資料夾裡的檔案 */
  function autoItems(disk, dir) { return disk.filter(function (p) { return p.indexOf(dir + '/') === 0; }); }
  function ti(id, depth, icon, name, sub, cls) { return '<div class="ti d' + depth + (cls ? ' ' + cls : '') + '"' + (id ? ' id="' + id + '"' : '') + '><span class="ic">' + icon + '</span>' + esc(name) + (sub ? ' <small>' + esc(sub) + '</small>' : '') + '</div>'; }
  function renderPj() {
    var t = '<h3>Project Explorer（Items 頁籤）</h3>' + ti('', 0, '📘', '13_PLC.lvproj') + ti('', 1, '🖥', 'My Computer') +
      ti('pi-' + slug('Host_Main.vi'), 2, '▣', 'Host_Main.vi', '記住：13_PLC\\Host_Main.vi', onDisk('Host_Main.vi') ? '' : 'miss') +
      ti('pi-vf', 2, '📁', '驅動層', 'Virtual Folder，只在專案裡', 'vf') +
      P.vf.map(function (p) { var ok = onDisk(p); return ti('pi-' + slug(p), 3, '▣', base(p), ok ? '記住：13_PLC\\' + p.replace('/', '\\') : '找不到：13_PLC\\' + p.replace('/', '\\') + '（示意）', ok ? '' : 'miss'); }).join('') +
      ti('pi-af', 2, '📂', 'host', 'Auto-populating → 13_PLC\\host\\', 'af') +
      autoItems(P.disk, 'host').map(function (p) { return ti('pi-' + slug(p), 3, '▣', base(p), '', P.fresh[p] ? 'new' : ''); }).join('') +
      (P.extraVf ? ti('pi-vf2', 2, '📁', '畫面', 'Virtual Folder，只在專案裡', 'vf new') : '') +
      ti('', 2, '⚙', 'Dependencies') + ti('', 2, '🔧', 'Build Specifications');
    var d = '<h3>硬碟 D:\\13_PLC\\（檔案總管）</h3>' + ti('dd-root', 0, '📁', '13_PLC\\') +
      P.disk.filter(function (p) { return p.indexOf('/') < 0; }).map(function (p) { return ti('di-' + slug(p), 1, p.slice(-7) === '.lvproj' ? '📘' : '▣', p, '', P.fresh[p] ? 'new' : ''); }).join('') +
      DIRS.map(function (dir) { return ti('dd-' + dir, 1, '📁', dir + '\\') + P.disk.filter(function (p) { return p.indexOf(dir + '/') === 0; }).map(function (p) { return ti('di-' + slug(p), 2, '▣', base(p), '', P.fresh[p] ? 'new' : ''); }).join(''); }).join('');
    $('ptree').innerHTML = t; $('pdisk').innerHTML = d;
    drawLines();
  }
  function drawLines() {
    var svg = $('plines'), w = $('pjw'), R = w.getBoundingClientRect(), s = '';
    if (!R.width || getComputedStyle(svg).display === 'none') { svg.innerHTML = ''; return; }
    function seg(a, b, bad) {
      if (!a || !b) return;
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      var x1 = $('ptree').getBoundingClientRect().right - R.left, y1 = ra.top + ra.height / 2 - R.top, x2 = rb.left - R.left, y2 = rb.top + rb.height / 2 - R.top, mx = (x1 + x2) / 2;
      s += '<path class="' + (bad ? 'bad' : '') + '" d="M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 + '"/>';
    }
    ['Host_Main.vi'].concat(P.vf).forEach(function (p) { var ok = onDisk(p); seg($('pi-' + slug(p)), ok ? $('di-' + slug(p)) : $('dd-' + p.split('/')[0]), !ok); });
    seg($('pi-af'), $('dd-host'), false);
    svg.innerHTML = s;
  }
  window.addEventListener('resize', function () { if (!$('t-pj').hidden) drawLines(); });
  async function pAct(fn) { var my = ++RUN; P.fresh = {}; try { await fn(my); } catch (e) { caught(e); renderPj(); } }
  $('pmove').onclick = function () {
    pAct(async function (my) {
      var from = 'driver/PLC_ReadWords.vi', to = 'old/PLC_ReadWords.vi';
      if (!onDisk(from)) { say('psay', '已經搬過了，按重設再試。'); return; }
      await fly($('di-' + slug(from)), $('dd-old'), 'PLC_ReadWords.vi', my);
      P.disk = P.disk.filter(function (p) { return p !== from; }).concat([to]); P.fresh[to] = 1;
      renderPj();
      say('psay', '檔案搬到 old\\ 了，但專案還記著 driver\\PLC_ReadWords.vi 這個舊路徑（紅色虛線），所以標成找不到；呼叫它的 VI 打開時也會在舊位置找不到這個 SubVI。在 Project Explorer 的 Files 頁籤裡搬，就不會這樣。', 'bad');
    });
  };
  $('padd').onclick = function () {
    pAct(async function (my) {
      var p = 'host/Host_Log.vi';
      if (onDisk(p)) { say('psay', '已經新增過了。'); return; }
      P.disk.push(p); P.fresh[p] = 1; renderPj();
      $('pi-' + slug(p)).style.visibility = 'hidden';
      await fly($('di-' + slug(p)), $('pi-' + slug(p)), 'Host_Log.vi', my);
      $('pi-' + slug(p)).style.visibility = '';
      say('psay', 'host 是 Auto-populating Folder，硬碟上的 host\\ 多了檔案，專案裡自動出現。', 'ok');
    });
  };
  $('padd2').onclick = function () {
    pAct(async function () {
      var p = 'driver/PLC_Ping.vi';
      if (onDisk(p)) { say('psay', '已經新增過了。'); return; }
      P.disk.push(p); P.fresh[p] = 1; renderPj();
      say('psay', '硬碟的 driver\\ 多了 PLC_Ping.vi，可是「驅動層」是 Virtual Folder，不會自己同步，專案裡看不到它。要用的話得自己 Add ▸ File 加進專案。');
    });
  };
  $('pvf').onclick = function () {
    pAct(async function () {
      if (P.extraVf) { say('psay', '已經有「畫面」了。'); return; }
      P.extraVf = true; renderPj();
      say('psay', '專案樹多了「畫面」這個 Virtual Folder，硬碟上什麼都沒變。它只是專案裡的分類標籤。', 'ok');
    });
  };
  $('prm').onclick = function () {
    pAct(async function (my) {
      var p = 'driver/PLC_WriteWord.vi';
      if (P.vf.indexOf(p) < 0) { say('psay', '已經移除了。'); return; }
      $('pi-' + slug(p)).style.opacity = '.3'; await wait(400, my);
      P.vf = P.vf.filter(function (x) { return x !== p; }); renderPj();
      $('di-' + slug(p)).classList.add('new');
      say('psay', '專案裡少了 PLC_WriteWord.vi，但硬碟上的檔案還在（綠底）。從專案移除只是從清單劃掉，不會刪檔。', 'ok');
    });
  };
  $('preset').onclick = function () { RUN++; pReset(); renderPj(); say('psay', ''); };

  /* =====================================================================
     2. Global 與 Shared Variable
     ===================================================================== */
  var V = { deployed: false, val: 0, busy: false };
  /* 純函式：寫入的值，誰讀得到？where = same（同一個應用程式）/ otherApp（同電腦另一個應用程式）/ otherPC */
  function reach(kind, where, deployed) {
    if (kind === 'np') return !!deployed;
    return where === 'same';
  }
  function renderSv() {
    var k = $('svk').value;
    $('sstore').hidden = k === 'np'; $('sve').hidden = k !== 'np';
    $('sstore').innerHTML = (k === 'g' ? 'GT_Globals.vi（Global）' : 'PLC.lvlib ▸ D300（Single-Process）') + ' <span class="v" id="sstv">—</span>';
    $('sve').innerHTML = 'Shared Variable Engine：PLC.lvlib ▸ D300（Network-Published）' + (V.deployed ? '' : '<small>（還沒 Deploy）</small>') + ' <span class="v" id="svev">—</span>';
    $('svdep').disabled = k !== 'np';
    ['swv', 'r1v', 'r2v', 'r3v'].forEach(function (id) { $(id).textContent = '—'; });
    ['r1', 'r2', 'r3'].forEach(function (id) { $(id).classList.remove('ok', 'no'); });
  }
  $('svk').onchange = function () { RUN++; renderSv(); say('svsay', ''); };
  $('svdep').onclick = function () { RUN++; V.deployed = true; renderSv(); say('svsay', 'PLC.lvlib 部署到這台電腦的 Shared Variable Engine 了，D300 這個變數現在在網路上存在。', 'ok'); };
  $('svw').onclick = async function () {
    var my = ++RUN, k = $('svk').value; renderSv();
    V.val = 100 + Math.floor(Math.random() * 900);
    $('swv').textContent = V.val;
    try {
      if (k === 'np' && !V.deployed) { say('svsay', 'Network-Published 的變數要先 Deploy 才存在於 Shared Variable Engine，還沒 Deploy 時讀寫都不會成功。先按「Deploy」。', 'bad'); return; }
      var store = k === 'np' ? $('sve') : $('sstore'), sv = k === 'np' ? $('svev') : $('sstv');
      await fly($('sw'), store, String(V.val), my); sv.textContent = V.val;
      var R = [['r1', 'same', '同一個應用程式'], ['r2', 'otherApp', '同一台電腦另一個應用程式'], ['r3', 'otherPC', '另一台電腦']], msgs = [];
      for (var i = 0; i < R.length; i++) {
        var ok = reach(k, R[i][1], V.deployed), box = $(R[i][0]);
        if (ok) { await fly(store, box, String(V.val), my); $(R[i][0] + 'v').textContent = V.val; box.classList.add('ok'); }
        else { box.classList.add('no'); $(R[i][0] + 'v').textContent = R[i][1] === 'otherApp' ? '0' : '✕'; }
        msgs.push(R[i][2] + (ok ? '：讀到 ' + V.val : R[i][1] === 'otherApp' ? '：讀不到（它如果也有這個變數，是自己的另一份，只看到預設值 0）' : '：讀不到，根本沒有這個變數'));
      }
      say('svsay', msgs.join('；') + '。', k === 'np' ? 'ok' : '');
    } catch (e) { caught(e); }
  };
  renderSv();

  /* =====================================================================
     3. 建立執行檔
     ===================================================================== */
  var STATIC = ['Host_Main.vi', 'Host_CommStep.vi', 'Host_UI.vi', 'PLC_ReadWords.vi', 'PLC_WriteWord.vi', 'vi.lib 用到的 VI'];
  var B = { built: false, plugin: false };
  /* 純函式：建置會包進哪些 VI */
  function buildContents(alwaysPlugin) { return STATIC.concat(alwaysPlugin ? ['Host_Plugin_A.vi'] : []); }
  /* 純函式：在目標電腦上執行的結果 */
  function runResult(rte, visa, plugin) {
    if (rte === 'none') return { ok: false, step: 'rte', msg: '這台電腦沒有 LabVIEW Run-Time Engine，執行檔不能執行。' };
    if (rte === 'old') return { ok: false, step: 'rte', msg: 'Run-Time Engine 的版本和建置用的 LabVIEW 不一樣，執行檔不能執行。要裝相同版本（位元數也相同）。' };
    if (!visa) return { ok: false, step: 'visa', msg: 'Host_Main.vi 開始執行，但 VISA Open 出錯：這台電腦沒有裝 NI-VISA 驅動，和 PLC 的通訊做不起來。' };
    if (!plugin) return { ok: false, step: 'plugin', msg: 'Host_Main.vi 執行到要動態載入 Host_Plugin_A.vi 時出錯：執行檔裡沒有這個 VI（建置時沒放進 Always Included）。' };
    return { ok: true, step: 'done', msg: 'Host_Main.vi 正常執行，通訊和外掛都正常。' };
  }
  function invalidate() { B.built = false; $('bexen').textContent = '（設定改過了，要重新 Build）'; $('bitems').innerHTML = ''; }
  $('balw').onchange = invalidate; $('bname').oninput = invalidate; $('bdest').oninput = invalidate;
  $('bbuild').onclick = async function () {
    var my = ++RUN, list = buildContents($('balw').checked);
    $('bitems').innerHTML = ''; $('blog').innerHTML = ''; say('bsay', '');
    $('bexen').textContent = 'Building…';
    try {
      for (var i = 0; i < list.length; i++) {
        await fly($('bstart'), $('bexe'), list[i], my);
        var s = document.createElement('span'); s.textContent = list[i]; $('bitems').appendChild(s);
      }
      B.built = true; B.plugin = $('balw').checked;
      $('bexen').textContent = $('bdest').value.replace(/\\$/, '') + '\\' + $('bname').value;
      say('bsay', '建置完成。Startup VI 和它呼叫到的 SubVI 都自動包進去了' + (B.plugin ? '，Host_Plugin_A.vi 因為放在 Always Included 也包進去了。' : '；Host_Plugin_A.vi 是動態載入的，Builder 看不到，所以沒有包。'), B.plugin ? 'ok' : '');
    } catch (e) { caught(e); }
  };
  function logB(s, bad) { var d = document.createElement('div'); d.textContent = s; if (bad) d.style.color = '#dc2626'; $('blog').appendChild(d); $('blog').scrollTop = 1e6; }
  $('brun').onclick = async function () {
    var my = ++RUN; $('blog').innerHTML = '';
    if (!B.built) { say('bsay', '先按 Build 產生執行檔。', 'bad'); return; }
    var r = runResult($('brte').value, $('bvisa').checked, B.plugin);
    try {
      logB('雙擊 ' + $('bname').value + ' …'); await wait(400, my);
      if (r.step === 'rte') { logB(r.msg, true); say('bsay', r.msg, 'bad'); return; }
      logB('Run-Time Engine 版本正確，載入 Host_Main.vi'); await wait(400, my);
      if (r.step === 'visa') { logB(r.msg, true); say('bsay', r.msg, 'bad'); return; }
      logB('VISA Open COM3：成功'); await wait(400, my);
      if (r.step === 'plugin') { logB(r.msg, true); say('bsay', r.msg, 'bad'); return; }
      logB('載入 Host_Plugin_A.vi：成功'); say('bsay', r.msg, 'ok');
    } catch (e) { caught(e); }
  };

  if (/^#(pj|sv|bd)$/.test(location.hash)) show(location.hash.slice(1)); else renderPj();

  /* =====================================================================
     4. 猜一猜
     ===================================================================== */
  var GENS = [
    function () { var a = '檔案的路徑清單和建置設定，不含 VI 的程式碼'; return { q: '.lvproj 專案檔裡存的是？', ans: a, wrong: distinct(a, ['所有 VI 的程式碼', '編譯好的執行檔', '前面板的截圖']), ex: '專案只記住「檔案在哪裡」和 Build Specifications 等設定，VI 還是存在硬碟上各自的位置。' }; },
    function () { var a = '只從專案清單拿掉，硬碟上的檔案還在'; return { q: '在 Project Explorer 把一個 VI 從專案移除（Remove from Project），硬碟上的檔案會？', ans: a, wrong: distinct(a, ['被刪除', '移到資源回收筒', '移到 Dependencies 資料夾']), ex: '專案是清單，移除只是劃掉這一行。' }; },
    function () { var a = '專案還記著舊路徑，顯示找不到'; return { q: '關掉 LabVIEW，在 Windows 檔案總管把 PLC_ReadWords.vi 搬到別的資料夾，再打開專案會？', ans: a, wrong: distinct(a, ['專案自動跟著更新路徑', '檔案被搬回原位', '專案檔損壞，打不開']), ex: '要搬檔案，在 Project Explorer 的 Files 頁籤裡搬，LabVIEW 才會一起更新參照。' }; },
    function () { var a = 'Virtual Folder'; return { q: '只想在專案裡分類、硬碟上不要多一個資料夾，用哪一種？', ans: a, wrong: distinct(a, ['Auto-populating Folder', 'Dependencies', 'Build Specifications']), ex: 'Virtual Folder 只存在專案裡。' }; },
    function () { var a = 'Auto-populating Folder'; return { q: '硬碟上 host\\ 資料夾多了一個 VI，專案裡哪一種資料夾會自動出現這個 VI？', ans: a, wrong: distinct(a, ['Virtual Folder', 'Dependencies', 'Build Specifications']), ex: 'Auto-populating Folder 和硬碟上的資料夾同步。' }; },
    function () {
      var w = pickOne(['otherApp', 'otherPC']), a = '讀不到';
      return { q: '產線電腦上的 GT_Main.exe 用 <b>Global Variable</b> 存 D300。' + (w === 'otherApp' ? '同一台電腦上另一個程式 Report.exe' : '辦公室另一台電腦') + '讀得到這個值嗎？', ans: a, wrong: distinct(a, ['讀得到，Global 全電腦共用', '讀得到，Global 全網路共用', '要先 Deploy 才讀得到']),
        ex: 'Global Variable 只在同一個應用程式裡的 VI 之間共用。要給其他程式或其他電腦，用 Network-Published Shared Variable 或 TCP 之類的通訊。' };
    },
    function () { var a = 'Network-Published Shared Variable'; return { q: '想讓辦公室的監看電腦讀到產線電腦的即時數值，下面哪一種可以？', ans: a, wrong: distinct(a, ['Global Variable', 'Single-Process Shared Variable', 'Local Variable']), ex: 'Network-Published 透過 Shared Variable Engine 發佈到網路，要先 Deploy。' }; },
    function () { var a = '同一個應用程式'; return { q: '<b>Single-Process</b> Shared Variable 的共用範圍是？', ans: a, wrong: distinct(a, ['同一個網路上的所有電腦', '同一台電腦上所有程式', '只有同一個 VI 裡']), ex: '範圍和 Global Variable 一樣。要跨程式、跨電腦用 Network-Published。' }; },
    function () { var a = '專案裡的 Library（.lvlib）'; return { q: 'Shared Variable 建立後放在哪裡？', ans: a, wrong: distinct(a, ['一個只有前面板的 Global VI', 'VI 的方塊圖裡', 'Windows 登錄檔']), ex: '在專案的 target 上新增 Variable，它會放在一個 Library 裡；Global Variable 才是只有前面板的特殊 VI。' }; },
    function () { var a = '把 Library Deploy 到 Shared Variable Engine'; return { q: 'Network-Published Shared Variable 要讓別台電腦讀得到，先要做什麼？', ans: a, wrong: distinct(a, ['把變數改成 Single-Process', '把 VI 存成 Global', '什麼都不用做']), ex: '在 Library 上右鍵 Deploy，變數才在 Shared Variable Engine 上存在。' }; },
    function () { var a = '相同版本（位元數也相同）的 LabVIEW Run-Time Engine'; return { q: '把 13_PLC.exe 拿到沒裝 LabVIEW 的產線電腦，至少要先安裝？', ans: a, wrong: distinct(a, ['LabVIEW 開發版', '任何版本的 Run-Time Engine 都可以', '什麼都不用裝']), ex: '執行檔不含 LabVIEW 本身。用到 VISA、DAQmx 也要裝對應的驅動。' }; },
    function () { var a = 'Always Included'; return { q: '主程式用 VI Server 動態載入 Host_Plugin_A.vi（方塊圖上沒有直接放它），建置時要把它放在哪裡？', ans: a, wrong: distinct(a, ['Startup VIs', 'Dependencies', '不用管，Builder 會自己找到']), ex: 'Builder 只看得到方塊圖上直接呼叫的 SubVI，動態載入的要手動加進 Always Included。' }; },
    function () { var a = '執行檔一打開就執行的 VI'; return { q: 'Application (EXE) 建置規格裡的 <b>Startup VI</b> 是？', ans: a, wrong: distinct(a, ['建置時第一個被編譯的 VI', '安裝程式的第一個畫面', 'Run-Time Engine 的設定檔']), ex: '通常就是主程式 Host_Main.vi，它呼叫的 SubVI 會自動一起包進去。' }; },
    function () { var a = 'Build Specifications 上右鍵 ▸ New ▸ Application (EXE)'; return { q: '在專案裡要建立執行檔，從哪裡開始？', ans: a, wrong: distinct(a, ['File ▸ Save As', 'Tools ▸ Options', 'Dependencies 上右鍵 ▸ Refresh']), ex: '建置規格都在 Build Specifications 底下：Application、Installer、Zip 等。' }; },
    function () { var a = '那台電腦也要裝 NI-VISA 驅動'; return { q: '13_PLC.exe 用 VISA 和 PLC 通訊。產線電腦裝了正確版本的 Run-Time Engine，還需要？', ans: a, wrong: distinct(a, ['什麼都不用，VISA 已經包在 exe 裡', '裝 LabVIEW 開發版', '把 exe 改名成 .vi']), ex: '執行檔不含硬體驅動，VISA、DAQmx 要另外安裝（或做 Installer 一起包）。' }; }
  ];
  function gen() { return pickOne(GENS)(); }

  window.ProjectLab = {
    autoItems: autoItems, reach: reach, buildContents: buildContents, runResult: runResult, show: show,
    state: { project: function () { return P; }, sv: V, build: B }, GENS: GENS, gen: gen,
    quiz: window.LabQuiz ? window.LabQuiz('pquiz', gen) : null
  };
})();
