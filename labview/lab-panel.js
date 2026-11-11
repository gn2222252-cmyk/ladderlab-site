/* 人機介面設計工作室：前面板編輯器、設計檢查、Control Editor、Tab Control、猜一猜
   版面存在 localStorage 'll_lv_panel'。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var KEY = 'll_lv_panel', W = 800, H = 480;
  var GO = '#127a3e', STOP = '#c62828', WARN = '#b26a00';

  /* 內建圖片（Control Editor 的「從檔案匯入」用這幾張代替） */
  function svg(s) { return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60">' + s + '</svg>'); }
  var IMGS = {
    playG: { n: '綠色啟動', u: svg('<rect x="2" y="2" width="116" height="56" rx="10" fill="#127a3e"/><path d="M48 14 L80 30 L48 46 Z" fill="#fff"/>') },
    playD: { n: '暗綠啟動', u: svg('<rect x="2" y="2" width="116" height="56" rx="10" fill="#0b3d20"/><path d="M48 14 L80 30 L48 46 Z" fill="#6b8f7a"/>') },
    stopR: { n: '紅色停止', u: svg('<rect x="2" y="2" width="116" height="56" rx="10" fill="#c62828"/><rect x="46" y="16" width="28" height="28" fill="#fff"/>') },
    stopD: { n: '暗紅停止', u: svg('<rect x="2" y="2" width="116" height="56" rx="10" fill="#5c1414"/><rect x="46" y="16" width="28" height="28" fill="#b98a8a"/>') },
    home: { n: '原點圖示', u: svg('<rect x="2" y="2" width="116" height="56" rx="10" fill="#d9dee6"/><path d="M60 12 L84 32 L76 32 L76 48 L44 48 L44 32 L36 32 Z" fill="#1d2430"/>') },
    lampOn: { n: '燈亮', u: svg('<circle cx="60" cy="30" r="26" fill="#facc15" stroke="#7a5d00" stroke-width="4"/>') },
    lampOff: { n: '燈滅', u: svg('<circle cx="60" cy="30" r="26" fill="#4b5563" stroke="#111" stroke-width="4"/>') }
  };

  /* ---------- 兩個版本：亂的（練習用）、整理好的（範例） ---------- */
  function bst(fF, bF, fT, bT) { return { F: { fg: fF, bg: bF }, T: { fg: fT, bg: bT } }; }
  function messy() {
    return { pane: '#e9ecef', pages: ['Auto', 'Manual', 'Alarm Log'], cur: 0, lib: [], els: [
      { id: 'start', kind: 'btn', label: 'Start', caption: 'Start（啟動）', sl: true, sc: true, txt: 'START', x: 30, y: 70, w: 120, h: 50, st: bst('#ffffff', GO, '#ffffff', '#0b5a2c'), val: false, page: -1 },
      { id: 'stop', kind: 'btn', label: 'Stop', caption: 'Stop（停止）', sl: false, sc: true, txt: 'STOP', x: 34, y: 140, w: 96, h: 40, st: bst('#ffffff', GO, '#ffffff', '#0b5a2c'), val: false, page: 1 },
      { id: 'home', kind: 'btn', label: 'Home', caption: 'Home（原點復歸）', sl: false, sc: true, txt: 'HOME', x: 30, y: 220, w: 110, h: 50, st: bst('#1d2430', '#d9dee6', '#1d2430', '#b8c0cc'), val: false, page: -1 },
      { id: 'run', kind: 'led', label: 'Running', caption: 'Running（運轉中）', sl: false, sc: true, x: 180, y: 76, w: 36, h: 36, st: bst('#1d2430', '#14532d', '#1d2430', '#22c55e'), val: true, page: -1 },
      { id: 'alarm', kind: 'led', label: 'Alarm', caption: 'Alarm（異常）', sl: false, sc: true, x: 180, y: 150, w: 36, h: 36, st: bst('#1d2430', '#3f3f46', '#1d2430', '#22c55e'), val: true, page: -1 },
      { id: 'count', kind: 'num', label: 'Right Count', caption: 'Right Count（右側計數）', sl: false, sc: true, x: 300, y: 100, w: 150, h: 36, fg: '#1d2430', bg: '#ffffff', val: 128, page: 0 },
      { id: 'step', kind: 'str', label: 'Step Text', caption: 'Step Text（步序）', sl: false, sc: true, x: 304, y: 170, w: 260, h: 36, fg: '#c3c9d2', bg: '#ffffff', val: 'S21 吸盤吸附中', page: 0 },
      { id: 'chart', kind: 'chart', label: 'Cycle Time', caption: 'Cycle Time（週期時間）', sl: false, sc: true, x: 470, y: 90, w: 300, h: 150, fg: '#1e6fff', bg: '#ffffff', page: 0 },
      { id: 'tab', kind: 'tab', label: 'Tab Control', caption: '', sl: false, sc: false, x: 270, y: 50, w: 510, h: 410, fg: '#1d2430', bg: '#eef1f5', page: -1 }] };
  }
  function cleanVer() {
    return { pane: '#e9ecef', pages: ['Auto', 'Manual', 'Alarm Log'], cur: 0, lib: [], els: [
      { id: 'start', kind: 'btn', label: 'Start', caption: 'Start（啟動）', sl: false, sc: true, txt: 'START', x: 30, y: 70, w: 130, h: 50, st: bst('#ffffff', GO, '#ffffff', '#0b5a2c'), val: false, page: -1 },
      { id: 'stop', kind: 'btn', label: 'Stop', caption: 'Stop（停止）', sl: false, sc: true, txt: 'STOP', x: 30, y: 150, w: 130, h: 50, st: bst('#ffffff', STOP, '#ffffff', '#7f1d1d'), val: false, page: -1 },
      { id: 'home', kind: 'btn', label: 'Home', caption: 'Home（原點復歸）', sl: false, sc: true, txt: 'HOME', x: 30, y: 230, w: 130, h: 50, st: bst('#1d2430', '#d9dee6', '#1d2430', '#b8c0cc'), val: false, page: -1 },
      { id: 'run', kind: 'led', label: 'Running', caption: 'Running（運轉中）', sl: false, sc: true, x: 30, y: 330, w: 36, h: 36, st: bst('#1d2430', '#14532d', '#1d2430', '#22c55e'), val: true, page: -1 },
      { id: 'alarm', kind: 'led', label: 'Alarm', caption: 'Alarm（異常）', sl: false, sc: true, x: 30, y: 410, w: 36, h: 36, st: bst('#1d2430', '#3f3f46', '#1d2430', '#ef4444'), val: false, page: -1 },
      { id: 'count', kind: 'num', label: 'Right Count', caption: 'Right Count（右側計數）', sl: false, sc: true, x: 300, y: 100, w: 150, h: 36, fg: '#1d2430', bg: '#ffffff', val: 128, page: 0 },
      { id: 'step', kind: 'str', label: 'Step Text', caption: 'Step Text（步序）', sl: false, sc: true, x: 300, y: 180, w: 150, h: 36, fg: '#1d2430', bg: '#ffffff', val: 'S21 吸附中', page: 0 },
      { id: 'chart', kind: 'chart', label: 'Cycle Time', caption: 'Cycle Time（週期時間）', sl: false, sc: true, x: 480, y: 100, w: 280, h: 150, fg: '#1e6fff', bg: '#ffffff', page: 0 },
      { id: 'tab', kind: 'tab', label: 'Tab Control', caption: '', sl: false, sc: false, x: 270, y: 50, w: 510, h: 410, fg: '#1d2430', bg: '#eef1f5', page: -1 }] };
  }
  var P;
  function load() { try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && v.els && v.els.length) return v; } catch (e) { /* 私密模式 */ } return messy(); }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* 圖片太大或私密模式：只是不存 */ } }
  P = load();
  function el(id) { return P.els.filter(function (e) { return e.id === id; })[0]; }
  function isBool(e) { return e.kind === 'btn' || e.kind === 'led'; }
  function colors(e) { return isBool(e) ? e.st[e.val ? 'T' : 'F'] : { fg: e.fg, bg: e.bg }; }
  function tabEl() { return el('tab'); }
  function visible(e) { return e.page < 0 || e.page === P.cur; }

  /* ---------- 繪製面板 ---------- */
  var VIEWS = {};
  function mountView(hostId, mode) {
    var host = $(hostId), pv = document.createElement('div');
    pv.className = 'pv'; host.appendChild(pv);
    VIEWS[hostId] = { host: host, pv: pv, mode: mode, k: 1, mark: [] };
    return VIEWS[hostId];
  }
  function chartSvg(c) {
    var pts = [], i; for (i = 0; i <= 30; i++) pts.push((i * 10) + ',' + (50 - 18 * Math.sin(i / 3) - 8 * Math.sin(i / 1.3)).toFixed(1));
    return '<svg viewBox="0 0 300 100" preserveAspectRatio="none" width="100%" height="100%"><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + (c === 'transparent' ? '#1e6fff' : c) + '" stroke-width="2.5"/></svg>';
  }
  function elHtml(e, v) {
    var c = colors(e), fg = c.fg, bg = c.bg, mark = v.mark.indexOf(e.id) >= 0;
    var cls = 'el ' + e.kind + (isBool(e) && e.val ? ' on' : '') + (v.mode === 'edit' && SEL.indexOf(e.id) >= 0 ? ' sel' : '') + (v.mode === 'tab' && TABSEL === e.id ? ' sel' : '') + (mark ? ' bad' : '');
    var face = '';
    if (e.img && e.img[e.val ? 'T' : 'F'] && IMGS[e.img[e.val ? 'T' : 'F']]) face = '<img alt="" src="' + IMGS[e.img[e.val ? 'T' : 'F']].u + '">';
    else if (e.kind === 'btn') face = esc(e.txt);
    else if (e.kind === 'num') face = String(e.val);
    else if (e.kind === 'str') face = esc(e.val);
    else if (e.kind === 'chart') face = chartSvg(fg);
    var caps = (e.sl ? '<div>' + esc(e.label) + '</div>' : '') + (e.sc && e.caption ? '<div>' + esc(e.caption) + '</div>' : '');
    var faceStyle = 'background:' + bg + ';color:' + fg + (e.img && face.indexOf('<img') === 0 ? ';border-color:transparent;box-shadow:none' : '');
    return '<div class="' + cls + '" data-id="' + e.id + '" style="left:' + e.x + 'px;top:' + e.y + 'px;width:' + e.w + 'px;height:' + e.h + 'px">' +
      (caps ? '<div class="cap">' + caps + '</div>' : '') + '<div class="face" style="' + faceStyle + '">' + face + '</div>' +
      (v.mode === 'edit' && SEL.length === 1 && SEL[0] === e.id ? '<span class="rh" data-rh="1"></span>' : '') + '</div>';
  }
  function render(hostId) {
    var v = VIEWS[hostId]; if (!v) return;
    var wpx = v.host.clientWidth; if (wpx < 50) return;
    v.k = wpx / W; v.host.style.height = (H * v.k) + 'px'; v.pv.style.transform = 'scale(' + v.k + ')';
    v.pv.style.backgroundColor = P.pane === 'transparent' ? '#ffffff' : P.pane;
    var t = tabEl(), h = '';
    if (t) {
      var tc = { fg: t.fg, bg: t.bg };
      h += '<div class="tabc' + (v.mode === 'edit' && SEL.indexOf('tab') >= 0 ? ' sel' : '') + (v.mark.indexOf('tab') >= 0 ? ' bad' : '') + '" data-id="tab" style="left:' + t.x + 'px;top:' + t.y + 'px;width:' + t.w + 'px;height:' + t.h + 'px;background:' + tc.bg + ';color:' + tc.fg + '"><div class="pages">' +
        P.pages.map(function (p, i) { return '<span data-page="' + i + '" class="' + (i === P.cur ? 'on' : '') + '" style="' + (i === P.cur ? 'background:' + tc.bg : '') + '">' + esc(p) + '</span>'; }).join('') + '</div>' +
        (v.mode === 'edit' && SEL.length === 1 && SEL[0] === 'tab' ? '<span class="rh" data-rh="1"></span>' : '') + '</div>';
    }
    P.els.forEach(function (e) { if (e.kind !== 'tab' && visible(e)) h += elHtml(e, v); });
    v.pv.innerHTML = h;
  }
  function renderAll() { Object.keys(VIEWS).forEach(function (k) { if (VIEWS[k].host.offsetParent !== null) render(k); }); }

  /* ======================================================================
     1. 編輯器
     ====================================================================== */
  var V1 = mountView('pv-edit', 'edit'), SEL = [], TOOL = 'pos', CUR = { fg: '#ffffff', bg: STOP }, TARGET = 'bg';
  var SWATCH = [GO, STOP, WARN, '#1e6fff', '#ffffff', '#1d2430', '#d9dee6', '#e9ecef', '#facc15', '#22c55e', '#ef4444', '#9aa4b4', '#0b5a2c', '#7f1d1d'];
  function drawColorRow() {
    $('sw').innerHTML = SWATCH.map(function (c) { return '<button type="button" data-c="' + c + '" title="' + c + '" style="background:' + c + '"></button>'; }).join('') + '<button type="button" class="t" data-c="transparent" title="透明（T）">T</button>';
    var f = $('cfgi'), b = $('cbgi');
    f.className = CUR.fg === 'transparent' ? 'tr' : ''; f.style.background = CUR.fg === 'transparent' ? '' : CUR.fg;
    b.className = CUR.bg === 'transparent' ? 'tr' : ''; b.style.background = CUR.bg === 'transparent' ? '' : CUR.bg;
    $('cfg').classList.toggle('here', TARGET === 'fg'); $('cbg').classList.toggle('here', TARGET === 'bg');
  }
  function setTool(t) {
    TOOL = t;
    [].forEach.call($('tools').querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.tool === t); });
    var tips = { pos: '點選元件、拖曳移動，右下角藍點拉大小；手機上點選後用右邊的方向鍵。', op: '點按鈕或 LED 切換 True／False，看兩個狀態的顏色。', set: '點元件，把「目前顏色」的' + (TARGET === 'fg' ? '前景' : '背景') + '塗上去；點空白處改前面板背景。', get: '點元件，把它（目前狀態）的前景、背景顏色吸到「目前顏色」。' };
    say('e-say', tips[t]);
  }
  function applyColor(e, which, c) {
    if (isBool(e)) e.st[e.val ? 'T' : 'F'][which] = c; else e[which] = c;
  }
  function setColor(id, which, c) {
    if (id === 'pane') { P.pane = c; persist(); renderAll(); return; }
    var e = el(id); if (!e) return; applyColor(e, which, c); persist(); renderAll(); drawInsp();
  }
  function getColor(id) { var e = el(id); if (!e) return null; var c = colors(e); CUR = { fg: c.fg, bg: c.bg }; drawColorRow(); return CUR; }
  function select(id, add) {
    if (!id) { SEL = []; }
    else if (add) { var i = SEL.indexOf(id); if (i >= 0) SEL.splice(i, 1); else SEL.push(id); }
    else SEL = [id];
    render('pv-edit'); drawInsp();
  }
  function clampEl(e) { e.w = Math.max(20, Math.min(W, Math.round(e.w))); e.h = Math.max(16, Math.min(H, Math.round(e.h))); e.x = Math.max(-e.w + 10, Math.min(W - 10, Math.round(e.x))); e.y = Math.max(-e.h + 10, Math.min(H - 10, Math.round(e.y))); }
  function move(id, dx, dy) { var e = el(id); if (!e) return; e.x += dx; e.y += dy; if (id === 'tab') P.els.forEach(function (c) { if (c.page >= 0) { c.x += dx; c.y += dy; clampEl(c); } }); clampEl(e); persist(); renderAll(); drawInsp(); }
  function resize(id, dw, dh) { var e = el(id); if (!e) return; e.w += dw; e.h += dh; clampEl(e); persist(); renderAll(); drawInsp(); }

  /* 指標事件：拖曳、縮放、上色、吸色、操作 */
  var drag = null;
  V1.pv.addEventListener('pointerdown', function (ev) {
    var pg = ev.target.closest('[data-page]');
    if (pg) { P.cur = +pg.dataset.page; persist(); renderAll(); return; }
    var node = ev.target.closest('[data-id]'), id = node ? node.dataset.id : null;
    if (TOOL === 'set') { if (id) setColor(id, TARGET, CUR[TARGET]); else setColor('pane', 'bg', CUR.bg); say('e-say', id ? '已上色：' + el(id).label + ' 的' + (TARGET === 'fg' ? '前景' : '背景') + '（' + CUR[TARGET] + '）' : '前面板背景改成 ' + CUR.bg); return; }
    if (TOOL === 'get') { if (id) { getColor(id); say('e-say', '吸到 ' + el(id).label + ' 的顏色：前景 ' + CUR.fg + '、背景 ' + CUR.bg + '。換回上色工具點別的元件。'); } return; }
    if (TOOL === 'op') { var e0 = id && el(id); if (e0 && isBool(e0)) { e0.val = !e0.val; persist(); renderAll(); say('e-say', e0.label + ' = ' + (e0.val ? 'True' : 'False') + '：現在上色會改這個狀態的顏色。'); } return; }
    if (!id) { select(null); return; }
    if (SEL.indexOf(id) < 0 || ev.shiftKey) select(id, ev.shiftKey);
    var e = el(id); if (!e) return;
    drag = { id: id, rh: !!ev.target.dataset.rh, sx: ev.clientX, sy: ev.clientY, moved: false, start: SEL.map(function (s) { var o = el(s); return { id: s, x: o.x, y: o.y, w: o.w, h: o.h }; }),
      kids: id === 'tab' ? P.els.filter(function (c) { return c.page >= 0; }).map(function (c) { return { id: c.id, x: c.x, y: c.y }; }) : [] };
    try { V1.pv.setPointerCapture(ev.pointerId); } catch (x) { /* 舊瀏覽器 */ }
    ev.preventDefault();
  });
  V1.pv.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    var dx = (ev.clientX - drag.sx) / V1.k, dy = (ev.clientY - drag.sy) / V1.k;
    drag.moved = true;
    if (drag.rh) { var s = drag.start[0], e = el(s.id); e.w = s.w + dx; e.h = s.h + dy; clampEl(e); }
    else {
      drag.start.forEach(function (s) { var e = el(s.id); e.x = s.x + dx; e.y = s.y + dy; clampEl(e); });
      drag.kids.forEach(function (s) { if (SEL.indexOf(s.id) < 0) { var e = el(s.id); e.x = s.x + dx; e.y = s.y + dy; clampEl(e); } });
    }
    render('pv-edit');
  });
  function endDrag() { if (drag) { if (drag.moved) { persist(); drawInsp(); } drag = null; } }
  V1.pv.addEventListener('pointerup', endDrag); V1.pv.addEventListener('pointercancel', endDrag);
  document.addEventListener('keydown', function (ev) {
    if (cur !== 'edit' || !SEL.length || /INPUT|SELECT|TEXTAREA/.test((ev.target.tagName || ''))) return;
    var m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (!m) return;
    ev.preventDefault(); var k = ev.shiftKey ? 10 : 1;
    SEL.forEach(function (id) { move(id, m[0] * k, m[1] * k); });
  });

  function drawInsp() {
    var box = $('insp');
    if (!SEL.length) { box.innerHTML = '<h4>屬性</h4><p class="why">點選一個元件（Shift 可多選）。</p>'; return; }
    if (SEL.length > 1) { box.innerHTML = '<h4>選了 ' + SEL.length + ' 個元件</h4><p class="why">用下面的「左邊對齊」「上緣對齊」「等寬等高」，以第一個選的為準。</p>' + nudgeHtml(); return; }
    var e = el(SEL[0]), c = colors(e), h = '<h4>' + esc(e.label) + ' <small class="kv">（' + { btn: '布林按鈕', led: 'LED', num: '數值顯示', str: '字串顯示', chart: 'Waveform Chart', tab: 'Tab Control' }[e.kind] + '）</small></h4>';
    h += '<div class="grid2"><span>Label</span><input type="text" data-f="label" value="' + esc(e.label) + '"><span>Caption</span><input type="text" data-f="caption" value="' + esc(e.caption) + '"></div>';
    h += '<div class="row"><label class="check small"><input type="checkbox" data-v="sl"' + (e.sl ? ' checked' : '') + '> 顯示 Label</label><label class="check small"><input type="checkbox" data-v="sc"' + (e.sc ? ' checked' : '') + '> 顯示 Caption</label></div>';
    if (e.kind !== 'tab') h += '<div class="row"><label class="small">放在 <select data-f="page"><option value="-1">Tab 外面（每頁都看得到）</option>' + P.pages.map(function (p, i) { return '<option value="' + i + '"' + (e.page === i ? ' selected' : '') + '>Tab 頁：' + esc(p) + '</option>'; }).join('') + '</select></label></div>';
    h += '<div class="kv">x ' + e.x + '　y ' + e.y + '　寬 ' + e.w + '　高 ' + e.h + '<br>' + (isBool(e) ? (e.val ? 'True' : 'False') + ' 狀態：' : '') + '前景 ' + c.fg + '　背景 ' + c.bg + '</div>' + nudgeHtml();
    box.innerHTML = h;
    if (e.kind !== 'tab') box.querySelector('[data-f="page"]').value = String(e.page);
  }
  function nudgeHtml() {
    return '<div class="row"><div><div class="small">移動</div><div class="nudge"><span></span><button type="button" data-n="0,-1">↑</button><span></span><button type="button" data-n="-1,0">←</button><button type="button" data-n="0,1">↓</button><button type="button" data-n="1,0">→</button></div></div>' +
      '<div><div class="small">大小</div><div class="nudge"><button type="button" data-r="-4,0">寬−</button><button type="button" data-r="4,0">寬＋</button><span></span><button type="button" data-r="0,-4">高−</button><button type="button" data-r="0,4">高＋</button></div></div></div><label class="check small"><input type="checkbox" id="n10"> 一次 10 px</label>';
  }
  $('insp').addEventListener('input', function (ev) {
    var f = ev.target.dataset.f; if (!f || !SEL.length) return;
    var e = el(SEL[0]); if (f === 'page') return; e[f] = ev.target.value; persist(); renderAll();
  });
  $('insp').addEventListener('change', function (ev) {
    if (!SEL.length) return; var e = el(SEL[0]);
    if (ev.target.dataset.v) { e[ev.target.dataset.v] = ev.target.checked; persist(); renderAll(); }
    if (ev.target.dataset.f === 'page') { assign(e.id, +ev.target.value); }
  });
  $('insp').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    var k = $('n10') && $('n10').checked ? 10 : 1;
    if (b.dataset.n) { var d = b.dataset.n.split(',').map(Number); SEL.forEach(function (id) { move(id, d[0] * k, d[1] * k); }); }
    if (b.dataset.r) { var r = b.dataset.r.split(',').map(Number); SEL.forEach(function (id) { resize(id, r[0] * (k === 10 ? 2.5 : 1), r[1] * (k === 10 ? 2.5 : 1)); }); }
  });
  function align(how) {
    if (SEL.length < 2) { say('e-say', '先用 Shift 選兩個以上的元件。'); return; }
    var a = el(SEL[0]);
    SEL.slice(1).forEach(function (id) { var e = el(id); if (how === 'left') e.x = a.x; else if (how === 'top') e.y = a.y; else { e.w = a.w; e.h = a.h; } });
    persist(); renderAll(); drawInsp();
    say('e-say', how === 'left' ? '已經以 ' + a.label + ' 為準左邊對齊。' : how === 'top' ? '已經以 ' + a.label + ' 為準上緣對齊。' : '已經和 ' + a.label + ' 一樣大。');
  }
  $('tools').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b) setTool(b.dataset.tool); });
  $('sw').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return; CUR[TARGET] = b.dataset.c; drawColorRow(); if (TOOL !== 'set') setTool('set'); });
  $('cpick').oninput = function () { CUR[TARGET] = $('cpick').value; drawColorRow(); };
  $('cfg').onclick = function () { TARGET = 'fg'; drawColorRow(); if (TOOL === 'set') setTool('set'); };
  $('cbg').onclick = function () { TARGET = 'bg'; drawColorRow(); if (TOOL === 'set') setTool('set'); };
  $('al-left').onclick = function () { align('left'); }; $('al-top').onclick = function () { align('top'); }; $('rs-same').onclick = function () { align('size'); };
  function reset(which) { var lib = P.lib || []; P = which === 'clean' ? cleanVer() : messy(); P.lib = lib; SEL = []; TABSEL = null; persist(); renderAll(); drawInsp(); drawTabInsp(); fillCe(); say('e-say', which === 'clean' ? '載入整理好的範例。到 ② 檢查看看。' : '回到一開始亂的版本。'); }
  $('ld-messy').onclick = function () { reset('messy'); }; $('ld-clean').onclick = function () { reset('clean'); };

  /* ======================================================================
     2. 設計檢查
     ====================================================================== */
  var V2 = mountView('pv-check', 'check');
  function hex2rgb(c) { if (!c || c === 'transparent') return null; var m = /^#?([0-9a-f]{6})$/i.exec(c); if (!m) return null; var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lum(rgb) { var a = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
  function contrast(c1, c2) { var a = hex2rgb(c1), b = hex2rgb(c2); if (!a || !b) return null; var l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
  function hueOf(c) { var r = hex2rgb(c); if (!r) return null; var R = r[0] / 255, G = r[1] / 255, B = r[2] / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn; if (d < 0.12) return null; var h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; h *= 60; return h < 0 ? h + 360 : h; }
  function isRed(c) { var h = hueOf(c); return h != null && (h < 20 || h > 340); }
  function isGreen(c) { var h = hueOf(c); return h != null && h > 90 && h < 170; }
  function rect(e) { return { l: e.x, t: e.y - ((e.sl ? 1 : 0) + (e.sc && e.caption ? 1 : 0)) * 17, r: e.x + e.w, b: e.y + e.h }; }
  function gap(a, b) { var dx = Math.max(a.l - b.r, b.l - a.r, 0), dy = Math.max(a.t - b.b, b.t - a.b, 0); if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) return -1; return Math.max(dx, dy); }
  function check() {
    var out = [], els = P.els.filter(function (e) { return e.kind !== 'tab'; }), t = tabEl(), paneBg = P.pane === 'transparent' ? '#ffffff' : P.pane;
    function add(sev, ids, msg) { out.push({ sev: sev, ids: ids, msg: msg }); }
    function layer(e) { return e.page; }
    // 1 對齊：同一層、同類元件差一點點
    for (var i = 0; i < els.length; i++) for (var j = i + 1; j < els.length; j++) {
      var a = els[i], b = els[j]; if (layer(a) !== layer(b)) continue;
      var dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
      if (dx > 0 && dx <= 6 && Math.abs(a.y - b.y) < 200) add('warn', [a.id, b.id], a.label + ' 和 ' + b.label + ' 的左邊差 ' + dx + ' px：看起來想對齊卻沒對齊。選兩個再按「左邊對齊」（Align Objects）。');
      else if (dy > 0 && dy <= 6 && Math.abs(a.x - b.x) < 400) add('warn', [a.id, b.id], a.label + ' 和 ' + b.label + ' 的上緣差 ' + dy + ' px：差一點點最礙眼，要嘛對齊，要嘛明顯分開。');
    }
    // 2 同類元件大小一致
    ['btn', 'led'].forEach(function (k) {
      var g = els.filter(function (e) { return e.kind === k; });
      var sizes = g.map(function (e) { return e.w + '×' + e.h; });
      if (g.length > 1 && sizes.some(function (s) { return s !== sizes[0]; })) add('warn', g.map(function (e) { return e.id; }), (k === 'btn' ? '按鈕' : 'LED') + '的大小不一樣（' + g.map(function (e) { return e.label + ' ' + e.w + '×' + e.h; }).join('、') + '）。同一類用同一個大小（Resize Objects），大小不同會被看成重要性不同。');
    });
    // 3 顏色意義
    var st = el('stop'), sa = el('start'), al = el('alarm'), ru = el('run');
    if (st && !isRed(st.st.F.bg)) add('bad', ['stop'], '停止按鈕不是紅色（現在是 ' + st.st.F.bg + '）。停止、異常用紅，操作員不用讀字就找得到。');
    if (st && sa && st.st.F.bg === sa.st.F.bg) add('bad', ['stop', 'start'], '啟動和停止一樣顏色，很容易按錯。');
    if (sa && isRed(sa.st.F.bg)) add('bad', ['start'], '啟動按鈕是紅色：紅色留給停止和異常。');
    if (al && !isRed(al.st.T.bg)) add('bad', ['alarm'], 'Alarm 燈亮的時候不是紅色（True 顏色是 ' + al.st.T.bg + '）。先用操作工具把它切到 True，再上紅色。');
    if (ru && !isGreen(ru.st.T.bg)) add('warn', ['run'], 'Running 燈亮的時候不是綠色（True 顏色是 ' + ru.st.T.bg + '）。運轉中慣用綠色。');
    // 4 對比
    els.forEach(function (e) {
      if (e.kind === 'led' || (e.img && e.kind === 'btn')) return;
      var c = colors(e), bg = c.bg === 'transparent' ? (e.page >= 0 && t ? t.bg : paneBg) : c.bg, r = contrast(c.fg, bg);
      if (e.kind === 'chart') return;
      if (r != null && r < 4.5) add('bad', [e.id], e.label + ' 的文字對比只有 ' + r.toFixed(1) + ' : 1（' + c.fg + ' 在 ' + bg + ' 上），一般文字至少要 4.5 : 1。');
      if (c.fg === 'transparent') add('bad', [e.id], e.label + ' 的文字是透明的，看不到。');
    });
    // 5 重要按鈕的位置與大小
    if (st && st.page >= 0) add('bad', ['stop'], '停止按鈕放在 Tab Control 的「' + P.pages[st.page] + '」頁：切到別頁就看不到。放到 Tab 外面，每一頁都看得到。');
    if (st && sa && st.w * st.h < sa.w * sa.h) add('warn', ['stop', 'start'], '停止按鈕比啟動按鈕小。停止至少要一樣大、一樣好按。');
    // 6 重疊、太擠、超出
    for (i = 0; i < els.length; i++) {
      var e = els[i], R = rect(e);
      if (R.l < 0 || R.t < 0 || R.r > W || R.b > H) add('bad', [e.id], e.label + ' 有一部分跑到前面板外面。');
      if (e.page >= 0 && t && (e.x < t.x || e.y < t.y || e.x + e.w > t.x + t.w || e.y + e.h > t.y + t.h)) add('bad', [e.id], e.label + ' 屬於 Tab 頁，但超出 Tab Control 的範圍。');
      if (e.page < 0 && t) { var g0 = gap(R, { l: t.x, t: t.y - 22, r: t.x + t.w, b: t.y + t.h }); if (g0 < 0) add('bad', [e.id, 'tab'], e.label + ' 在 Tab 外面卻壓在 Tab Control 上。'); }
      for (j = i + 1; j < els.length; j++) {
        var f = els[j]; if (layer(e) !== layer(f)) continue;
        var g = gap(R, rect(f));
        if (g < 0) add('bad', [e.id, f.id], e.label + ' 和 ' + f.label + '（含文字）重疊了。');
        else if (g < 8) add('warn', [e.id, f.id], e.label + ' 和 ' + f.label + ' 只隔 ' + Math.round(g) + ' px，太擠了。');
      }
    }
    // 7 Label 與 Caption
    els.forEach(function (e) {
      if (e.sl && e.sc && e.caption) add('warn', [e.id], e.label + '：Label 和 Caption 同時顯示，同一件事寫兩次。前面板留 Caption 就好。');
      if (!e.sl && !(e.sc && e.caption)) add('warn', [e.id], e.label + ' 沒有任何文字說明，操作員不知道它是什麼。');
    });
    return out;
  }
  var LAST = [];
  function runCheck() {
    LAST = check();
    var bad = LAST.filter(function (x) { return x.sev === 'bad'; }).length, warn = LAST.length - bad;
    $('chk-sum').textContent = LAST.length ? '要修 ' + bad + ' 項、建議 ' + warn + ' 項' : '全部通過';
    $('issues').innerHTML = LAST.length ? LAST.map(function (x, i) { return '<li class="' + x.sev + '" data-i="' + i + '">' + (x.sev === 'bad' ? '✖ ' : '△ ') + esc(x.msg) + '</li>'; }).join('') : '<li class="ok">✔ 這幾條通則都過了。再自己看看：最常用的放在最順手的位置、同一組的東西放在一起。</li>';
    V2.mark = []; render('pv-check');
    return LAST;
  }
  $('docheck').onclick = runCheck;
  $('issues').addEventListener('click', function (ev) {
    var li = ev.target.closest('li[data-i]'); if (!li) return;
    var x = LAST[+li.dataset.i]; V2.mark = x.ids;
    var e = el(x.ids[0]); if (e && e.page >= 0) P.cur = e.page;
    render('pv-check');
  });

  /* ======================================================================
     3. Control Editor
     ====================================================================== */
  var CE = null;
  function fillCe() {
    var btns = P.els.filter(function (e) { return e.kind === 'btn'; });
    $('ce-el').innerHTML = btns.map(function (e) { return '<option value="' + e.id + '">' + esc(e.label) + '</option>'; }).join('');
    ceOpen(btns[0] && btns[0].id);
  }
  function ceOpen(id) {
    var e = el(id); if (!e) return;
    $('ce-el').value = id;
    CE = { id: id, mode: 'edit', kind: e.ctlKind || 'Control', state: 'F', st: clone(e.st), img: clone(e.img || {}), txt: e.txt, dirty: false, msg: '' };
    drawCe();
  }
  function cePrev(state) {
    var c = CE.st[state], im = CE.img[state];
    return '<div class="prev" style="width:160px;height:70px"><div style="position:absolute;inset:0;display:grid;place-items:center;border-radius:6px;font-weight:700;border:2px solid ' + (im ? 'transparent' : 'rgba(0,0,0,.35)') + ';background:' + c.bg + ';color:' + c.fg + '">' + (im ? '<img alt="" style="width:100%;height:100%;object-fit:contain" src="' + IMGS[im].u + '">' : esc(CE.txt)) + '</div></div>';
  }
  function drawCe() {
    if (!CE) return;
    var e = el(CE.id), cust = CE.mode === 'cust';
    var h = '<div class="tb"><b>' + esc(e.label) + '.ctl</b>' + (CE.dirty ? ' *' : '') +
      '<button type="button" data-ce="mode" title="' + (cust ? 'Change to Edit Mode' : 'Change to Customize Mode') + '">🔧 ' + (cust ? 'Customize Mode（按一下回 Edit Mode）' : 'Edit Mode（按一下切到 Customize Mode）') + '</button>' +
      '<label>類型 <select data-ce="kind">' + ['Control', 'Type Def.', 'Strict Type Def.'].map(function (k) { return '<option' + (CE.kind === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></label>' +
      '<button type="button" data-ce="apply">File ▸ Apply Changes</button><button type="button" data-ce="save">另存成 .ctl</button></div>';
    h += '<div class="body"><div><div class="small">False 狀態</div>' + cePrev('F') + '<div class="small" style="margin-top:6px">True 狀態</div>' + cePrev('T') + '</div><div>';
    if (!cust) h += '<p class="why">現在是 <b>Edit Mode</b>：元件被當成一整塊。要選到按鈕裡面的零件、換它的圖片，先按工具列的扳手切到 <b>Customize Mode</b>。</p>';
    else {
      h += '<div class="row"><span>要改的狀態：</span><button type="button" data-ce="st" data-s="F" class="' + (CE.state === 'F' ? 'go' : '') + '">False</button><button type="button" data-ce="st" data-s="T" class="' + (CE.state === 'T' ? 'go' : '') + '">True</button><span class="why">（布林元件兩個狀態各自一份外觀）</span></div>';
      h += '<div class="small">零件右鍵 ▸ Import from File at Same Size…（這裡用內建圖片代替檔案）</div><div class="imgs">' + Object.keys(IMGS).map(function (k) { return '<button type="button" data-ce="img" data-k="' + k + '" title="' + IMGS[k].n + '"><img alt="' + IMGS[k].n + '" src="' + IMGS[k].u + '"></button>'; }).join('') + '<button type="button" data-ce="img" data-k="">不用圖片</button></div>';
      h += '<div class="small" style="margin-top:6px">或只改顏色（背景）</div><div class="sw">' + [GO, STOP, '#0b5a2c', '#7f1d1d', '#d9dee6', '#facc15', '#1e6fff', 'transparent'].map(function (c) { return '<button type="button" data-ce="col" data-c="' + c + '" class="' + (c === 'transparent' ? 't' : '') + '" style="' + (c === 'transparent' ? '' : 'background:' + c) + '">' + (c === 'transparent' ? 'T' : '') + '</button>'; }).join('') + '</div>';
    }
    h += '<p class="verdict-line" id="ce-say">' + (CE.msg || '') + '</p></div></div>';
    $('cewin').innerHTML = h;
    drawLib();
  }
  function ceMode(m) { CE.mode = m || (CE.mode === 'cust' ? 'edit' : 'cust'); CE.msg = CE.mode === 'cust' ? '切到 Customize Mode：可以選到按鈕裡的零件了。' : '回到 Edit Mode。'; drawCe(); }
  function ceState(s) { CE.state = s; drawCe(); }
  function ceImg(k) { if (CE.mode !== 'cust') { CE.msg = '要先切到 Customize Mode 才能換零件的圖片。'; drawCe(); return false; } if (k) CE.img[CE.state] = k; else delete CE.img[CE.state]; CE.dirty = true; CE.msg = (CE.state === 'T' ? 'True' : 'False') + ' 狀態' + (k ? '換成「' + IMGS[k].n + '」' : '拿掉圖片') + '。按 Apply Changes 才會套到前面板。'; drawCe(); return true; }
  function ceColor(c) { if (CE.mode !== 'cust') { CE.msg = '要先切到 Customize Mode。'; drawCe(); return false; } CE.st[CE.state].bg = c; CE.dirty = true; CE.msg = (CE.state === 'T' ? 'True' : 'False') + ' 狀態背景改成 ' + c + '。'; drawCe(); return true; }
  function ceApply() {
    var e = el(CE.id); e.st = clone(CE.st); e.img = clone(CE.img); e.ctlKind = CE.kind; CE.dirty = false; persist(); renderAll();
    CE.msg = '✔ 已經套回前面板上的 ' + e.label + '。到 ① 用操作工具按按看兩個狀態。'; drawCe(); return e;
  }
  function ceSave(name) {
    name = name || (el(CE.id).label + '_custom');
    P.lib = (P.lib || []).filter(function (x) { return x.name !== name; });
    P.lib.push({ name: name, kind: CE.kind, st: clone(CE.st), img: clone(CE.img), txt: CE.txt });
    persist(); CE.msg = '存成 ' + name + '.ctl（' + CE.kind + '）。'; drawCe(); return P.lib;
  }
  function libPlace(name) {
    var it = (P.lib || []).filter(function (x) { return x.name === name; })[0]; if (!it) return null;
    var n = P.els.filter(function (e) { return e.id.indexOf('cust') === 0; }).length;
    if (n >= 3) { say('e-say', '這個練習最多放 3 個自訂元件。'); return null; }
    var id = 'cust' + (n + 1);
    P.els.push({ id: id, kind: 'btn', label: name, caption: name, sl: false, sc: true, txt: it.txt, x: 170, y: 300 + n * 50, w: 90, h: 40, st: clone(it.st), img: clone(it.img), val: false, page: -1, ctlKind: it.kind });
    persist(); renderAll(); fillCe(); return id;
  }
  function drawLib() {
    var L = P.lib || [];
    $('lib').innerHTML = L.length ? L.map(function (x) { return '<li><b>' + esc(x.name) + '.ctl</b><span class="kv">' + x.kind + '</span><button type="button" data-place="' + esc(x.name) + '">Select a Control… 放到前面板</button></li>'; }).join('') : '<li class="why">還沒有。在上面按「另存成 .ctl」。</li>';
  }
  $('ce-el').onchange = function () { ceOpen($('ce-el').value); };
  $('cewin').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-ce]'); if (!b) return;
    var a = b.dataset.ce;
    if (a === 'mode') ceMode(); else if (a === 'st') ceState(b.dataset.s); else if (a === 'img') ceImg(b.dataset.k); else if (a === 'col') ceColor(b.dataset.c);
    else if (a === 'apply') ceApply(); else if (a === 'save') ceSave();
  });
  $('cewin').addEventListener('change', function (ev) { if (ev.target.dataset.ce === 'kind') { CE.kind = ev.target.value; CE.dirty = true; CE.msg = '類型改成 ' + CE.kind + '。'; drawCe(); } });
  $('lib').addEventListener('click', function (ev) { var b = ev.target.closest('button[data-place]'); if (b) { var id = libPlace(b.dataset.place); if (id) { CE.msg = '放上前面板了（左下方）。回 ① 看看。'; drawCe(); } } });

  /* ======================================================================
     4. Tab Control
     ====================================================================== */
  var V4 = mountView('pv-tab', 'tab'), TABSEL = null;
  function assign(id, page) { var e = el(id); if (!e || e.kind === 'tab') return; var t = tabEl();
    if (page >= 0 && t && e.page < 0) { e.x = Math.max(t.x + 10, Math.min(e.x, t.x + t.w - e.w - 10)); e.y = Math.max(t.y + 30, Math.min(e.y, t.y + t.h - e.h - 10)); }
    if (page < 0 && t && e.page >= 0) { e.x = Math.max(10, Math.min(t.x - e.w - 20, 140)); }
    e.page = page; if (page >= 0) P.cur = page; persist(); renderAll(); drawInsp(); drawTabInsp(); }
  function showPage(i) { P.cur = Math.max(0, Math.min(P.pages.length - 1, i)); persist(); renderAll(); drawTabInsp(); }
  function addPage(name) { P.pages.splice(P.cur + 1, 0, name || ('Page ' + (P.pages.length + 1))); P.els.forEach(function (e) { if (e.page > P.cur) e.page++; }); P.cur++; persist(); renderAll(); drawTabInsp(); return P.pages; }
  function removePage() {
    if (P.pages.length <= 1) return false;
    var on = P.els.filter(function (e) { return e.page === P.cur; });
    if (on.length) { $('tabmsg').textContent = '這一頁還有 ' + on.length + ' 個元件，這個練習規定先把它們移到別頁再刪頁，免得元件跟著頁面不見。'; return false; }
    var c = P.cur; P.pages.splice(c, 1); P.els.forEach(function (e) { if (e.page > c) e.page--; }); P.cur = Math.max(0, c - 1); persist(); renderAll(); drawTabInsp(); return true;
  }
  function drawTabInsp() {
    var h = '<h4>Tab Control</h4><div class="row"><button type="button" data-tb="add">Add Page After</button><button type="button" data-tb="rm">Remove Page</button></div>';
    h += '<label class="small">目前這頁的名稱 <input type="text" id="pgname" value="' + esc(P.pages[P.cur]) + '"></label>';
    if (TABSEL) { var e = el(TABSEL); h += '<div class="row"><span>選到 <b>' + esc(e.label) + '</b>，放在</span><select id="tbpage"><option value="-1">Tab 外面</option>' + P.pages.map(function (p, i) { return '<option value="' + i + '">' + esc(p) + '</option>'; }).join('') + '</select></div>'; }
    else h += '<p class="why">點面板上的元件，選它要放哪一頁。</p>';
    h += '<p class="why" id="tabmsg"></p><div class="kv">Tab Control 端子的值：<b>' + esc(P.pages[P.cur]) + '</b>（目前顯示的頁）</div>';
    $('tabinsp').innerHTML = h;
    if (TABSEL) $('tbpage').value = String(el(TABSEL).page);
    $('terms').innerHTML = P.els.map(function (e) {
      var v = e.kind === 'tab' ? '"' + P.pages[P.cur] + '"' : isBool(e) ? (e.val ? 'T' : 'F') : e.kind === 'chart' ? '…' : e.val;
      return '<span class="' + (visible(e) ? '' : 'hid') + '">' + esc(e.label) + ' = ' + esc(v) + '</span>';
    }).join('');
  }
  V4.pv.addEventListener('pointerdown', function (ev) {
    var pg = ev.target.closest('[data-page]'); if (pg) { showPage(+pg.dataset.page); return; }
    var n = ev.target.closest('[data-id]'); TABSEL = n && n.dataset.id !== 'tab' ? n.dataset.id : null; render('pv-tab'); drawTabInsp();
  });
  $('tabinsp').addEventListener('click', function (ev) { var b = ev.target.closest('button[data-tb]'); if (!b) return; if (b.dataset.tb === 'add') addPage(); else removePage(); });
  $('tabinsp').addEventListener('change', function (ev) {
    if (ev.target.id === 'tbpage') assign(TABSEL, +ev.target.value);
    if (ev.target.id === 'pgname') { P.pages[P.cur] = ev.target.value || P.pages[P.cur]; persist(); renderAll(); drawTabInsp(); }
  });

  /* ---------- 分頁 ---------- */
  var tabs = $('tabs'), cur = 'edit';
  function show(t) {
    cur = t;
    [].forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['edit', 'check', 'ce', 'tab', 'quiz'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
    renderAll();
    if (t === 'check') runCheck();
    if (t === 'tab') drawTabInsp();
    if (t === 'ce') drawCe();
  }
  tabs.addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  var rsz = null; window.addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(renderAll, 120); });

  drawColorRow(); setTool('pos'); drawInsp(); fillCe(); renderAll();
  if (/^#(edit|check|ce|tab|quiz)$/.test(location.hash)) show(location.hash.slice(1));

  window.PanelLab = {
    show: show, state: function () { return P; }, reset: reset, select: select, move: move, resize: resize, align: function (how, ids) { SEL = ids.slice(); align(how); },
    setTool: setTool, setColor: setColor, getColor: getColor, toggle: function (id) { var e = el(id); if (e && isBool(e)) { e.val = !e.val; persist(); renderAll(); } return e && e.val; },
    setText: function (id, f, v) { var e = el(id); e[f] = v; persist(); renderAll(); }, check: function () { return check(); }, runCheck: runCheck, contrast: contrast,
    ce: { open: ceOpen, mode: ceMode, state: ceState, img: ceImg, color: ceColor, kind: function (k) { CE.kind = k; drawCe(); }, apply: ceApply, save: ceSave, place: libPlace, cur: function () { return CE; } },
    tab: { assign: assign, show: showPage, addPage: addPage, removePage: removePage }
  };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function hex(c) { var n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lum(c) { return hex(c).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function (s, v, i) { return s + v * [0.2126, 0.7152, 0.0722][i]; }, 0); }
  function cr(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  var KIND = [
    function () { return { q: '方塊圖上的端子顯示的是元件的哪一個名字？', ans: 'Label', wrong: ['Caption', 'Boolean Text', 'Description', 'Tip Strip'], ex: 'Label 是物件名稱，前面板和方塊圖都看得到；Caption 只在前面板顯示，方塊圖不會出現。' }; },
    function () { var w = p1(['改成中文給操作員看', '加上單位「(mm)」', '改成比較長的說明']);
      return { q: '想把前面板上的元件名稱' + w + '，但不想影響方塊圖（端子、Event 結構、Local Variable 都用 Label 認元件）。該改哪裡？', ans: '設定 Caption 並顯示它，Label 不動', wrong: ['直接改 Label', '改 Description and Tip', '改 Boolean Text', '刪掉 Label'], ex: 'Caption 是前面板上顯示的文字，方塊圖不出現，執行中也能用屬性節點改；Label 是物件名稱，執行中不能改。' }; },
    function () { var os = p1([['Windows', 'Ctrl'], ['Linux', 'Alt']]);
      return { q: '在 ' + os[0] + ' 上，要把 A 元件的顏色複製到 B 元件，最快的做法？', ans: '上色工具按住 ' + os[1] + ' 變吸管點 A，放開後點 B', wrong: ['在 A 上按 Ctrl+C、B 上按 Ctrl+V', '用 Control Editor 打開 B 改', '用屬性節點寫程式', '重新從選盤拉一個 B'], ex: '上色工具按住 Ctrl（Mac 用 Option 或 Command、Linux 用 Alt）會暫時變成吸管（Get Color）取色，放開再點 B 就塗上去。' }; },
    function () { var b = Math.random() < 0.5;
      return { q: b ? '上色工具的顏色選盤裡，右上角的 <b>T</b> 代表？' : '只想讓元件的<b>邊框</b>透明，裡面保留顏色，怎麼點？', ans: b ? '透明（Transparent）' : '按住 F 再點 T', wrong: b ? ['文字顏色', 'True 狀態', '溫度色階', 'Tab 的顏色'] : ['直接點 T', '按住 Shift 再點 T', '按住 B 再點 T', '邊框不能單獨透明'], ex: '選盤右上角的 T 是透明；只要邊框透明，按住 F 再點 T。例如把 Pict Ring 的灰色外框設成透明。' }; },
    function () { return { q: '布林按鈕的 True 和 False 兩個狀態要上不同的顏色，怎麼做？', ans: '先用操作工具把它切到要改的狀態，再用上色工具上色', wrong: ['兩個狀態只能同一個顏色', '一定要寫屬性節點才能改', '在 Label 上按右鍵改', '上色工具按兩下'], ex: '布林元件兩個狀態各有自己的顏色，上色改的是它目前所在的那個狀態。' }; },
    function () { return { q: '要換掉按鈕外觀上的圖片，Control Editor 要先切到哪個模式才能選到裡面的零件？', ans: 'Customize Mode', wrong: ['Edit Mode', 'Run Mode', 'Highlight Execution', 'Design Mode'], ex: 'Control Editor 工具列的扳手按鈕在 Edit Mode 和 Customize Mode 之間切換；Customize Mode 才能選到單一零件。' }; },
    function () { return { q: '在按鈕上按右鍵，哪一條路徑會打開 Control Editor？', ans: 'Advanced ▸ Customize…', wrong: ['Visible Items ▸ Caption', 'Replace ▸ Boolean', 'Data Operations ▸ Make Current Value Default', 'Properties ▸ Appearance'], ex: '右鍵 ▸ Advanced ▸ Customize… 開出 Control Editor。' }; },
    function () { return { q: '在 Control Editor 的零件上換圖片，想讓新圖片自動變成和原本零件一樣大，選哪一個？', ans: 'Import from File at Same Size…', wrong: ['Import from File…', 'Copy to Clipboard', 'Revert', 'Original Size'], ex: 'at Same Size 會把匯入的圖縮放成原本零件的大小。剪貼簿裡有圖時，也可以用 Import Picture from Clipboard。' }; },
    function () { return { q: '在 Control Editor 改好外觀，要套回前面板上原本那個元件，按什麼？', ans: 'File ▸ Apply Changes', wrong: ['File ▸ Save As 存成新的 VI', 'Edit ▸ Undo', '直接關掉視窗就會自動套用', 'Operate ▸ Run'], ex: 'Apply Changes 把修改套回原本的元件；也可以另存 .ctl 給別的 VI 用。' }; },
    function () { var s = p1([['只同步資料型別，外觀各自可以不同', 'Type Def.'], ['資料型別和外觀都同步', 'Strict Type Def.']]);
      return { q: '自訂元件存成 .ctl 時選「' + s[0] + '」，是哪一種？', ans: s[1], wrong: ['Type Def.', 'Strict Type Def.', 'Control', 'Global Variable'].filter(function (x) { return x !== s[1]; }), ex: '三種都存成 .ctl，差別是連結方式。Control：放上去就沒有連結；Type Def.：同步資料型別；Strict Type Def.：連外觀也同步。比較見 Enum 實驗室。' }; },
    function () { return { q: 'Tab Control 目前顯示「Auto」頁，「Manual」頁上的數值控制項，程式讀得到它的值嗎？', ans: '讀得到，所有頁上的端子都在方塊圖上', wrong: ['讀不到，要先切到 Manual 頁', '只讀得到預設值', '執行時會出錯', '要用 Local Variable 才讀得到'], ex: 'Tab Control 只是前面板上的容器。不管顯示哪一頁，每一頁的控制項都在，值都讀寫得到。' }; },
    function () { return { q: 'Tab Control 自己的端子輸出什麼？', ans: '目前顯示的是哪一頁', wrong: ['所有頁上元件的值', '頁數', '使用者按了幾次頁籤', '沒有端子'], ex: '它的值是 Enum 類的，代表目前顯示哪一頁。' }; },
    function () { var b = p1([['停止', '紅色'], ['運轉中指示燈', '綠色'], ['異常指示燈', '紅色']]);
      return { q: '機台操作面板上的「' + b[0] + '」最常用什麼顏色？', ans: b[1], wrong: ['紅色', '綠色', '藍色', '紫色', '黃色'].filter(function (x) { return x !== b[1]; }), ex: '紅色留給停止和異常，綠色是運轉。顏色只是輔助，按鈕上還是要有文字。' }; },
    function () { return { q: '「停止」按鈕放在哪裡最好？', ans: 'Tab Control 外面，每一頁都看得到的位置', wrong: ['放在 Tab Control 的第二頁', '放在「進階」頁，避免誤按', '做得比其他按鈕小，避免誤按', '藏起來，用鍵盤快捷鍵'], ex: '停止要隨時找得到、按得到。放在某一頁裡，切到別頁就看不到。' }; },
    function () { var pairs = [['#9aa4b4', '#ffffff'], ['#1d2430', '#ffffff'], ['#ffffff', '#127a3e'], ['#facc15', '#ffffff'], ['#ffffff', '#c62828'], ['#c3c9d2', '#ffffff']];
      var pick = pairs.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 4), best = pick.slice().sort(function (a, b) { return cr(b[0], b[1]) - cr(a[0], a[1]); })[0];
      var name = function (p) { return '文字 ' + p[0] + ' 在 ' + p[1] + ' 上'; };
      return { q: '下面哪一組文字和底色的對比最高、最好讀？', ans: name(best), wrong: pick.filter(function (p) { return p !== best; }).map(name), ex: '對比比值：' + pick.map(function (p) { return name(p) + ' ≈ ' + cr(p[0], p[1]).toFixed(1) + ' : 1'; }).join('；') + '。一般文字建議至少 4.5 : 1。', chk: function () { return name(best); } }; },
    function () { return { q: '三個按鈕要變成一樣寬、一樣高，用前面板工具列的哪一個？', ans: 'Resize Objects', wrong: ['Align Objects', 'Distribute Objects', 'Reorder', 'Clean Up Diagram'], ex: 'Align Objects 對齊、Distribute Objects 平均分布、Resize Objects 統一大小。' }; },
    function () { return { q: '依講義的做法，前面板（Pane）的背景圖片在哪裡設定？', ans: '在前面板的捲軸上按右鍵 ▸ Properties ▸ Background', wrong: ['在每個元件上按右鍵 ▸ Background', 'Tools ▸ Options ▸ Background', '只能用屬性節點在執行時改', 'File ▸ VI Properties ▸ Background'], ex: 'Pane 有自己的 Properties，Background 頁可以選圖片和排列方式。' }; },
    function () { return { q: '自訂元件存成 .ctl 之後，要放到另一個 VI 的前面板，在 Controls 選盤選？', ans: 'Select a Control…', wrong: ['Select a VI…', 'Import Picture', 'Insert ▸ Control', '把 .ctl 拖到方塊圖'], ex: 'Controls 選盤的 Select a Control… 可以選 .ctl 檔放上前面板。' }; }
  ];
  function gen() { return p1(KIND)(); }
  if (window.LabQuiz) window.PanelLab.quiz = window.LabQuiz('pquiz', gen);
  window.PanelLab.quizGen = gen; window.PanelLab.quizKinds = KIND;
})();
