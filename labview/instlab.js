/* 儀器練習台：先講到話、把原始資料變成數字、VISA／DAQ／TCP 判斷、猜一猜
   儀器的行為全部在 assets/instsim.js（InstSim），這個檔只管頁面。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var IS = window.InstSim, U = IS.util, LIST = IS.list();
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function say(id, s, cls) { $(id).innerHTML = s || ''; $(id).className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function def(id) { return LIST.filter(function (d) { return d.id === id; })[0]; }
  function vis(t) { return t.replace(/\r/g, '\\r').replace(/\n/g, '\\n'); }
  function num(v, unit) { if (typeof v !== 'number' || !isFinite(v)) return String(v); var s = Math.abs(v) >= 1e6 ? v.toExponential(3) : String(Math.round(v * 10000) / 10000); return s + (unit ? ' ' + unit : ''); }
  function avg(v) { return v.reduce(function (x, y) { return x + y; }, 0) / v.length; }
  function same(a, b) { return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)); }
  /* 挑選列只在第一次畫按鈕；之後只換「選中」的標記。整塊重畫的話，鍵盤焦點會掉回頁面最上面。 */
  function pickRow(box, curId, onPick, items) {
    var el = $(box);
    if (el.dataset.n !== String(items.length)) {
      el.innerHTML = items.map(function (d) { return '<button type="button" data-id="' + d.id + '">' + esc(d.name) + '<small>' + esc(d.sub) + '</small></button>'; }).join('');
      el.dataset.n = String(items.length);
      el.onclick = function (e) { var b = e.target.closest('button'); if (b) onPick(b.dataset.id); };
    }
    [].forEach.call(el.querySelectorAll('button'), function (b) {
      var on = b.dataset.id === curId, br, er;
      b.classList.toggle('here', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on && el.scrollWidth > el.clientWidth) {      // 手機是單列橫向捲動：把選中的那一顆捲進來
        br = b.getBoundingClientRect(); er = el.getBoundingClientRect();
        if (br.width && (br.left < er.left || br.right > er.right - 36)) el.scrollLeft += br.left - er.left - 8;
      }
    });
  }
  var INST_ITEMS = LIST.map(function (d) { return { id: d.id, name: d.name, sub: d.brand + '｜' + (d.kind === 'serial' ? '序列埠' : d.kind === 'tcp' ? '網路' : d.kind === 'usbtmc' ? 'USB／網路' : '類比訊號') }; });

  /* ====================================================================== ① 先講到話 */
  var cur = 'gpd', term = null, LAST = {}, DONE = {};
  var GENERIC = { baud: 9600, bits: 8, parity: 'N', stop: 1, term: '\n', host: '', port: '' };      // 電腦常見的預設值，不是儀器的設定
  function hasText(r, re) { return !!(r && r.bytes && re.test(r.text)); }
  var TASKS = {
    gpd: [['讓它回答自己是誰（型號）', function (r) { return hasText(r, /GPD-3303S/); }],
      ['把輸出打開，讀到一筆不是 0 的實際輸出電壓', function (r) { return hasText(r, /^\d+\.\d{3}V/) && U.fract(r.text) > 0.5; }],
      ['故意下一個錯的命令，再把錯誤訊息問出來', function (r) { return hasText(r, /Undefined header|Invalid character|Missing parameter|Data out of range|too long/); }]],
    dmm: [['讓它回答自己是誰', function (r) { return hasText(r, /34461A/); }],
      ['量到一筆電壓', function (r) { return hasText(r, /^[+-]\d\.\d{8}E[+-]\d\d/); }],
      ['故意下錯命令，再從錯誤佇列把錯誤問出來', function (r) { return hasText(r, /^-\d+,"/); }]],
    bal: [['收到一筆看得懂的資料（不是亂碼）', function (r) { return hasText(r, /^(ST|US|OL),/) && r.bytes.every(function (b) { return b < 128; }); }],
      ['放上零件，收到一筆「穩定」而且不是 0 的重量', function (r) { return hasText(r, /^ST,[+-]\d{5}\.\d\d/) && Math.abs(U.fract(r.text.substr(3, 9))) > 1; }],
      ['讓天平超載，看它送出什麼', function (r) { return hasText(r, /^OL,/); }]],
    dtb: [['讀到目前溫度 PV', function (r) { return hasText(r, /^:010304|^:010302/) || !!(r && r.bytes && r.bytes[0] === 1 && r.bytes[1] === 3 && r.bytes.length >= 7); }],
      ['把設定溫度 SV 改成 50.0', function (r, s) { return s.inst.state().sv === 50; }],
      ['收到一個「例外」回應（功能碼最高位元是 1）', function (r) { return hasText(r, /^:01[89]/) || !!(r && r.bytes && r.bytes[0] === 1 && (r.bytes[1] & 0x80) && r.text.charAt(0) !== ':'); }]],
    adam4017: [['一次讀到 8 個通道', function (r) { return hasText(r, /^>([+-]\d+\.\d+){8}\r$/); }],
      ['只讀通道 2', function (r) { return hasText(r, /^>[+-]\d+\.\d+\r$/); }]],
    adam6017: [['連線後讀到 AI0～AI7（25 個位元組的回應）', function (r) { return !!(r && r.bytes && r.bytes.length === 25 && r.bytes[7] === 3 || r && r.bytes && r.bytes.length === 25 && r.bytes[7] === 4); }],
      ['收到一個例外回應', function (r) { return !!(r && r.bytes && r.bytes.length >= 9 && (r.bytes[7] & 0x80)); }]],
    daq: [['讀 ai0，至少 100 點', function (r) { return !!(r && r.volts && r.ch === 0 && r.n >= 100); }],
      ['讀到 ai1（4～20 mA 那一路）', function (r) { return !!(r && r.volts && r.ch === 1); }]],
    tbs: [['連線後讓它回答自己是誰', function (r) { return hasText(r, /^TEKTRONIX,TBS2/); }],
      ['拿到一筆看得懂的波形：一串用逗號分開的數字，前面沒有 :CURVE', function (r) { return hasText(r, /^-?\d+,-?\d+,-?\d+/); }],
      ['收到一塊完整的二進位波形（標頭寫幾個位元組，就收到幾個，最後是 \\n；一次讀或分三次讀都可以）', function (r, s) {
        function whole(b) { var x, n; if (!b.length || b[0] !== 35) return false; x = b[1] - 48; n = +U.toText(b.slice(2, 2 + x)); return x > 0 && n > 0 && b.length === 2 + x + n + 1 && b[b.length - 1] === 10; }
        var L = s && s.log ? s.log.filter(function (e) { return e.dir === 'rx'; }).slice(-3) : [], k;
        for (k = 0; k < L.length; k++) if (whole([].concat.apply([], L.slice(k).map(function (e) { return e.bytes; })))) return true;
        return false; }]]
  };
  function fmtDefaults(d) {
    var P = { N: '無', E: '偶（Even）', O: '奇（Odd）' }, x = d.defaults;
    if (d.kind === 'serial') return x.baud + ' bps、' + x.bits + ' 個資料位元、同位 ' + P[x.parity] + '、' + x.stop + ' 個停止位元；結尾字元 ' + vis(x.term);
    if (d.kind === 'tcp') return 'IP ' + d.host + '（示意，實機看模組的設定）、埠 ' + d.port;
    if (d.kind === 'usbtmc') return 'USB：插上就有，不用設鮑率。網路：IP ' + d.host + '（示意）、埠 ' + d.port + '。';
    return '差動接法、±10 V（本頁的設定）';
  }
  var PC_NOTE = '這是電腦這邊常見的預設，不是儀器的設定';
  function pcDefaults(d) {      // 終端機一開始的樣子（GENERIC）
    if (d.kind === 'daq') return '';
    if (d.kind === 'serial') return GENERIC.baud + '-' + GENERIC.bits + '-' + GENERIC.parity + '-' + GENERIC.stop + '、結尾字元 ' + vis(GENERIC.term) + '。' + PC_NOTE + '：要照上一行自己改。';
    return '結尾字元 ' + vis(GENERIC.term) + '。' + PC_NOTE + '。';
  }
  function noteHtml(n) { var m = /^（(模擬|通用知識[^）]*)）(.*)$/.exec(n); return m ? '<span class="il-tag">' + esc(m[1]) + '</span>' + esc(m[2]) : esc(n); }
  function drawCard() {
    var d = def(cur), c = d.card, pc = pcDefaults(d), h = '<h3>說明書摘要卡：' + esc(d.brand + ' ' + d.name) + '</h3>';
    h += '<dl class="il-kv"><dt>介面</dt><dd>' + esc(d.iface) + '</dd><dt>' + (d.kind === 'daq' ? '設定' : '儀器的設定') + '</dt><dd>' + esc(fmtDefaults(d)) + '</dd>' + (pc ? '<dt>終端機的預設值</dt><dd>' + esc(pc) + '</dd>' : '') + '<dt>怎麼對話</dt><dd>' + esc(c.how) + '</dd></dl>';
    if (c.simNote) h += '<div class="il-sim">' + esc(c.simNote) + '</div>';
    h += '<div><table class="il-cmds"><tbody>' + c.cmds.map(function (x) { return '<tr><td>' + esc(x[0]) + '</td><td>' + esc(x[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<ul>' + c.notes.map(function (n) { return '<li>' + noteHtml(n) + '</li>'; }).join('') + '</ul>';
    h += '<details><summary>哪些對過說明書、哪些是模擬的</summary><p class="il-why"><b>對過說明書</b></p><ul>' + d.checked.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p class="il-why"><b>說明書沒寫或查不到，這裡是模擬值（實機請自己看）</b></p><ul>' + d.unverified.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>';
    h += '<p class="il-why">來源：' + esc(d.manual.title) + '　<a href="' + esc(d.manual.url) + '" rel="noopener">原廠網站</a></p>';
    $('card').innerHTML = h;
  }
  function drawTasks() {
    var t = TASKS[cur] || [], dn = DONE[cur] || (DONE[cur] = []);
    $('tasks').innerHTML = t.map(function (x, i) { return '<li class="' + (dn[i] ? 'ok' : '') + '">' + (dn[i] ? '完成：' : '試試看：') + esc(x[0]) + '</li>'; }).join('');
  }
  function onReply(r, ses) {
    if (r && (r.volts || (r.bytes && r.bytes.length && !r.timedOut))) LAST[cur] = r.volts ? { volts: r.volts, ch: r.ch } : { bytes: r.bytes.slice(), text: r.text };
    var t = TASKS[cur] || [], dn = DONE[cur] || (DONE[cur] = []), ch = false;
    t.forEach(function (x, i) { var ok = false; try { ok = x[1](r, ses); } catch (e) { ok = false; } if (ok && !dn[i]) { dn[i] = true; ch = true; } });
    if (ch) drawTasks();
  }
  function pick(id) {
    cur = id; if (term) term.destroy();
    pickRow('pick', cur, pick, INST_ITEMS); drawCard(); drawTasks();
    term = IS.terminal($('term'), { inst: id, cfg: GENERIC, onReply: onReply, cfgNote: def(id).kind === 'serial' ? '上面這一排' + PC_NOTE.slice(2) + '。' : '' });
    return term;
  }

  /* ====================================================================== ② 把原始資料變成數字 */
  var pcur = 'gpd', PRAW = {}, PSRC = {};
  function s16(v) { return v > 32767 ? v - 65536 : v; }
  function sampleFor(id) {
    var s, r;
    if (id === 'gpd') { s = IS.open('gpd'); s.write('ISET1:2.0\n'); s.write('VSET1:12.34\n'); s.write('OUT1\n'); r = s.query('VOUT1?'); return { bytes: r.bytes, text: r.text }; }
    if (id === 'bal') { s = IS.open('bal'); s.put(123.45); s.tick(3000); r = s.query('Q'); return { bytes: r.bytes, text: r.text }; }
    if (id === 'daq') return { volts: IS.open('daq').read(0, 100, 1000), ch: 0 };
    if (id === 'tbs') { s = IS.open('tbs'); s.connect(); s.write('HEADER OFF\n'); s.write('CURVE?\n'); r = s.read({ term: null, count: 2007 }); return { bytes: r.bytes, text: r.text }; }
    r = IS.sample(id); return { bytes: r, text: U.toText(r) };
  }
  var PARSE = {
    gpd: function (raw) {
      var m = /^(\d+\.\d+)([VA])\r?\n?$/.exec(raw.text), u = m ? m[2] : 'V', sc;
      return { goal: '目標：拿到輸出' + (u === 'V' ? '電壓（V）' : '電流（A）') + '的數值。', unit: u, truth: m ? U.fract(raw.text) : NaN, methods: [
        { name: 'Fract/Exp String To Number（整串直接接進去）', ok: true, run: function () { return U.fract(raw.text); }, why: '它從頭讀數字，讀到不是數字的 ' + u + ' 就停，後面的 ' + u + ' 和結尾字元都被丟掉。' },
        { name: 'Decimal String To Number', run: function () { return U.dec(raw.text); }, why: 'Decimal 只認整數，讀到小數點就停了。', trap: '這一筆小數剛好是 0。換一筆 5.123' + u + ' 就只剩 5。' },
        { name: 'Scan From String，格式字串 %f' + u, ok: true, run: function () { sc = U.scan(raw.text, '%f' + u); return sc.ok ? sc.values[0] : 'Scan From String 出錯：' + sc.err; }, why: '%f 讀一個小數，後面的 ' + u + ' 當成固定文字對掉。回覆長相不對時它會報錯，剛好幫你把關。' },
        { name: 'String Subset 取前 4 個字元，再 Fract/Exp String To Number', run: function () { return U.fract(raw.text.substr(0, 4)); }, why: '長度寫死了：12.345' + u + ' 只取到 12.3。數字的位數會變，不能用固定長度切。', trap: '這一筆後面的位數剛好都是 0。' },
        { name: 'Scan From String，格式字串 %d', run: function () { sc = U.scan(raw.text, '%d'); return sc.ok ? sc.values[0] : 'Scan From String 出錯：' + sc.err; }, why: '%d 是整數，小數點之後全部不見。', trap: '這一筆小數剛好是 0。' }] };
    },
    dmm: function (raw) {
      var ok = /^[+-]\d\.\d+E[+-]\d+\r?\n?$/.test(raw.text), sc;
      return { goal: '目標：拿到量測值（V）。', unit: 'V', truth: ok ? U.fract(raw.text) : NaN, methods: [
        { name: 'Fract/Exp String To Number', ok: true, run: function () { return U.fract(raw.text); }, why: '它認得 E+00 這種科學記號，結尾的換行自動忽略。' },
        { name: 'Scan From String，格式字串 %f', ok: true, run: function () { sc = U.scan(raw.text, '%f'); return sc.ok ? sc.values[0] : 'Scan From String 出錯：' + sc.err; }, why: '%f 也認得科學記號。' },
        { name: 'Decimal String To Number', run: function () { return U.dec(raw.text); }, why: 'Decimal 只認整數：讀到小數點就停。' },
        { name: 'String Subset 取前 5 個字元，再 Fract/Exp String To Number', run: function () { return U.fract(raw.text.substr(0, 5)); }, why: '後面的位數和指數都被切掉了。如果讀數是 +1.23456789E-03，這樣會得到 1.23，差了一千倍。' }] };
    },
    bal: function (raw) {
      var hd = raw.text.substr(0, 2), ok = /^(ST|US),[+-]\d{5}\.\d\d {2}g\r\n$/.test(raw.text), sc;
      return { goal: '目標：拿到重量（g），而且要知道這一筆穩不穩定。', unit: 'g', truth: ok ? U.fract(raw.text.substr(3, 9)) : NaN,
        special: hd === 'OL' ? '這一筆是超載（OL）：數值欄是 9999999E+19，不是重量。所以程式要先看前兩個字元，再決定要不要轉數字。' : '', methods: [
        { name: 'Fract/Exp String To Number（整串直接接進去）', run: function () { return U.fract(raw.text); }, why: '開頭是 S 不是數字，它直接給 0，而且不會報錯。', trap: '這一筆重量剛好是 0，看不出問題。放上零件再收一筆。' },
        { name: 'String Subset（offset 3、length 9）→ Fract/Exp String To Number', ok: true, run: function () { return U.fract(raw.text.substr(3, 9)); }, why: '這是固定寬度的格式，數值永遠在第 3～11 個字元。別忘了另外把前 2 個字元（ST／US）拿出來判斷。' },
        { name: 'Scan From String，格式字串 %2s,%f', ok: true, run: function () { sc = U.scan(raw.text, '%2s,%f'); return sc.ok ? sc.values[1] : 'Scan From String 出錯：' + sc.err; }, why: '一次拿到兩樣：%2s 是標頭（' + hd + '），%f 是數值。' },
        { name: 'Scan From String，格式字串 %s,%f', run: function () { sc = U.scan(raw.text, '%s,%f'); return sc.ok ? sc.values[1] : 'Scan From String 出錯：' + sc.err; }, why: '%s 會一路讀到空白為止，把「' + raw.text.split(' ')[0] + '」整段吃掉，後面的逗號就對不上了。要限制寬度：%2s。' },
        { name: 'String Subset（offset 3、length 9）→ Decimal String To Number', run: function () { return U.dec(raw.text.substr(3, 9)); }, why: 'Decimal 只認整數，小數不見了。', trap: '這一筆小數剛好是 .00。' }] };
    },
    dtb: function (raw) {
      var t = raw.text, b = raw.bytes, v, sub;
      if (/^:0103(02|04)[0-9A-F]{4}/.test(t)) {
        v = U.hexNum(t.substr(7, 4)); sub = t.substr(7, 4);
        return { goal: '目標：拿到目前溫度 PV（度）。這是 Modbus ASCII 的回覆。', unit: '度', truth: s16(v) / 10, special: v >= 0x8002 && v <= 0x8004 ? '這一筆的 PV 是 ' + sub + 'H：不是溫度，是錯誤碼（8003H＝感測器沒接）。轉成數字之前要先判斷。' : '', methods: [
          { name: 'String Subset（offset 7、length 4）→ Hexadecimal String To Number → 除以 10', ok: true, run: function () { return s16(U.hexNum(sub)) / 10; }, why: '「' + sub + '」是十六進位的文字，先變成整數 ' + v + '，再除以 10（單位是 0.1 度）。' },
          { name: 'String Subset（offset 7、length 4）→ Decimal String To Number → 除以 10', run: function () { return U.dec(sub) / 10; }, why: '「' + sub + '」是十六進位。Decimal 遇到 A～F 就停，或把它當十進位讀。', trap: '這一筆剛好沒有 A～F。' },
          { name: 'String Subset（offset 7、length 4）→ Hexadecimal String To Number（不除）', run: function () { return v; }, why: '說明書：數值的單位是 0.1 度，所以 ' + v + ' 代表 ' + v / 10 + '。' },
          { name: 'String Subset（offset 5、length 4）→ Hexadecimal String To Number → 除以 10', run: function () { return s16(U.hexNum(t.substr(5, 4))) / 10; }, why: '位置差了兩格：取到的是「位元組數」和資料的前半。先在原始資料上一格一格數。' },
          { name: 'Fract/Exp String To Number（整串直接接進去）', run: function () { return U.fract(t); }, why: '開頭是冒號，不是數字：得到 0。' }] };
      }
      if (b[0] === 1 && b[1] === 3 && b.length >= 7 && t.charAt(0) !== ':') {
        v = b[3] << 8 | b[4];
        return { goal: '目標：拿到目前溫度 PV（度）。這是 Modbus RTU 的回覆，全部是位元組。', unit: '度', truth: s16(v) / 10, special: v >= 0x8002 && v <= 0x8004 ? '這一筆的 PV 是錯誤碼，不是溫度。' : '', methods: [
          { name: 'Index Array 取索引 3、4 → Join Numbers（索引 3 是高位元組）→ 除以 10', ok: true, run: function () { return s16(v) / 10; }, why: 'Modbus 的資料是高位元組在前。' },
          { name: 'Index Array 取索引 3、4 → Join Numbers（索引 4 當高位元組）→ 除以 10', run: function () { return s16(b[4] << 8 | b[3]) / 10; }, why: '高低位元組放反了。（CRC 才是低位元組在前，資料不是。）' },
          { name: '只取索引 4（一個位元組）→ 除以 10', run: function () { return b[4] / 10; }, why: '一個位元組最多 255，也就是 25.5 度，再高就錯了。', trap: '這一筆高位元組剛好是 0。' },
          { name: 'Index Array 取索引 2、3 → Join Numbers → 除以 10', run: function () { return s16(b[2] << 8 | b[3]) / 10; }, why: '索引 2 是「後面有幾個位元組」，不是資料。' }] };
      }
      return { goal: '目標：拿到目前溫度 PV。', truth: NaN, methods: [] };
    },
    adam4017: function (raw) {
      var t = raw.text, all = /^>([+-]\d+\.\d+){8}\r?$/.test(t);
      return { goal: '目標：拿到通道 2（第 3 個）的電壓。', unit: 'V', truth: all ? U.fract(t.substr(15, 7)) : NaN, special: /^>[+-]\d+\.\d+\r?$/.test(t) ? '這是「只讀一個通道」的回覆。回 ① 送 #01 收 8 個通道的那一種，或按「用範例資料」。' : '', methods: [
        { name: 'String Subset（offset 15、length 7）→ Fract/Exp String To Number', ok: true, run: function () { return U.fract(t.substr(15, 7)); }, why: '開頭的 > 佔 1 格，每個通道固定 7 格：1 + 2 × 7 = 15。' },
        { name: 'String Subset（offset 14、length 7）→ Fract/Exp String To Number', run: function () { return U.fract(t.substr(14, 7)); }, why: '忘了開頭的 >，往前偏了一格：取到「' + t.substr(14, 7) + '」。' },
        { name: 'Spreadsheet String To Array（分隔符號用逗號）→ Index Array 取索引 2', run: function () { return 0; }, why: '回覆裡沒有逗號，整串變成 1 個元素；索引 2 超出範圍，LabVIEW 給預設值 0。', trap: '這一筆通道 2 剛好是 0。' },
        { name: 'Fract/Exp String To Number（整串直接接進去）', run: function () { return U.fract(t); }, why: '開頭是 >，不是數字：得到 0。', trap: '這一筆通道 2 剛好是 0。' }] };
    },
    adam6017: function (raw) {
      var b = raw.bytes, ok = b.length >= 11 && (b[7] === 3 || b[7] === 4) && b[8] >= 2, r = ok ? b[9] << 8 | b[10] : 0;
      return { goal: '目標：拿到 AI0 的電壓。這一通道的量程是 ±10 V（換算公式是本頁模擬的，實機依說明書）。', unit: 'V', truth: ok ? r / 65535 * 20 - 10 : NaN, methods: [
        { name: '索引 9、10 → Join Numbers（索引 9 是高位元組）→ ÷65535 × 20 − 10', ok: true, run: function () { return r / 65535 * 20 - 10; }, why: '原始值 ' + r + ' 是 0～65535 裡的位置；量程從 −10 到 +10，寬度 20，起點 −10。' },
        { name: '索引 9、10 → Join Numbers → ÷65535 × 10', run: function () { return r / 65535 * 10; }, why: '把量程當成 0～10 V 了。±10 V 的 0 V 在原始值的中間。' },
        { name: '索引 9、10 → Join Numbers → ÷1000（當成 mV）', run: function () { return r / 1000; }, why: '原始值不是 mV，只是一個比例。' },
        { name: '索引 7、8 → Join Numbers → ÷65535 × 20 − 10', run: function () { return (b[7] << 8 | b[8]) / 65535 * 20 - 10; }, why: '索引 7 是功能碼、索引 8 是位元組數，資料從索引 9 開始。前 7 個位元組是 MBAP 標頭。' },
        { name: '索引 9、10 → Join Numbers（索引 10 當高位元組）→ ÷65535 × 20 − 10', run: function () { return (b[10] << 8 | b[9]) / 65535 * 20 - 10; }, why: '高低位元組放反了。' }] };
    },
    daq: function (raw) {
      var v = raw.volts || [], a = v.length ? avg(v) : NaN;
      if (raw.ch === 0) return { goal: '目標：ai0 是壓力傳送器（1～5 V 對應 0～10 bar），算出壓力。', unit: 'bar', truth: (a - 1) / 4 * 10, methods: [
        { name: '先取平均（Mean）→ (V − 1) ÷ 4 × 10', ok: true, run: function () { return (a - 1) / 4 * 10; }, why: '1 V 是 0 bar、5 V 是 10 bar：先減掉 1，再除以跨度 4，乘上 10。平均是為了壓掉雜訊。' },
        { name: '先取平均 → V ÷ 5 × 10', run: function () { return a / 5 * 10; }, why: '忘了 1 V 才是 0 bar。這樣沒有壓力時也會算出 2 bar。' },
        { name: '只拿陣列的第 0 點 → (V − 1) ÷ 4 × 10', near: true, run: function () { return (v[0] - 1) / 4 * 10; }, why: '公式對，但單獨一點有雜訊，每次讀都會跳。取樣多一點再平均。' },
        { name: '先取平均 → V × 2', run: function () { return a * 2; }, why: '把 0～5 V 當成 0～10 bar 了。看感測器的規格：輸出是 1～5 V。' }] };
      if (raw.ch === 1) return { goal: '目標：ai1 是 4～20 mA 的訊號經過 250 Ω，算出電流（mA）。', unit: 'mA', truth: a / 250 * 1000, methods: [
        { name: '先取平均 → V ÷ 250 × 1000', ok: true, run: function () { return a / 250 * 1000; }, why: '歐姆定律：I = V ÷ R，再把 A 換成 mA。' },
        { name: '先取平均 → (V − 1) ÷ 4 × 16', run: function () { return (a - 1) / 4 * 16; }, why: '少加了起點 4 mA：1 V 對應的是 4 mA，不是 0。' },
        { name: '只拿陣列的第 0 點 → V ÷ 250 × 1000', near: true, run: function () { return v[0] / 250 * 1000; }, why: '公式對，但單獨一點有雜訊。' },
        { name: '先取平均 → V × 250', run: function () { return a * 250; }, why: '乘除反了：I = V ÷ R。' }] };
      return { goal: '這一筆是 ai' + raw.ch + ' 的資料。', truth: NaN, special: '回 ① 讀 ai0（壓力）或 ai1（電流），或按「用範例資料」。', methods: [] };
    },
    tbs: function (raw) {
      var t = raw.text, b = raw.bytes, G = '目標：找出這一段波形「最高」的那一點（單位是小格，−128～127）。', p = t.indexOf('#'), x, n, hd, data, sv, mx;
      function maxOf(v) { return v.reduce(function (a, c) { return Math.max(a, c); }, -Infinity); }
      function sg(v) { return v > 127 ? v - 256 : v; }
      if (p < 0) return { goal: G, truth: NaN, special: /^(:CURVE )?-?\d+,/.test(t) ? '這一筆是 ASCII 的波形（一串用逗號分開的數字）。這一題練的是二進位：回 ① 送 HEADER OFF、DATA:ENCDG RIBINARY，讀取方式選「讀固定幾個位元組」收 2007 個；或按「用範例資料」。' : '', methods: [] };
      x = b[p + 1] - 48; n = +t.substr(p + 2, x); hd = p + 2 + x; data = b.slice(hd, hd + n);
      if (!(x > 0) || data.length < n) return { goal: G, truth: NaN, special: '這一塊不完整：標頭說有 ' + n + ' 個位元組，只收到 ' + data.length + ' 個。多半是用「讀到結尾字元為止」讀，停在剛好等於 0A 的資料上。回 ① 改用「讀固定幾個位元組」。', methods: [] };
      if (n > 1 && data.every(function (v, i) { return i % 2 === 0 || v === 0; })) return { goal: G, truth: NaN, special: '這一筆是 DATA:WIDTH 2（每點 2 個位元組、低位元組是 0）。這一題用寬度 1：回 ① 送 DATA:WIDTH 1 再收一次，或按「用範例資料」。', methods: [] };
      sv = data.map(sg); mx = maxOf(sv);
      return { goal: G, unit: '小格', truth: mx, methods: [
        { name: '去掉前 ' + hd + ' 個位元組的標頭 → Type Cast 成 I8 陣列 → Array Max & Min 取最大', ok: true, run: function () { return mx; }, why: '標頭「' + t.substr(0, hd) + '」不是資料；RIBINARY 是有號的，用 I8 看。' },
        { name: '整串（含標頭）Type Cast 成 I8 陣列 → Array Max & Min 取最大', run: function () { return maxOf(b.map(sg)); }, why: '標頭也被當成資料：「' + t.substr(p + 1, 1) + '」這個字元的值是 ' + b[p + 1] + '，比真正的最大值還大。最後的 \\n（10）也混進去了。', trap: '這一筆標頭的字元剛好都比資料小。換成找最小值，或換一個訊號，就會出錯。' },
        { name: '去掉標頭 → String To Byte Array（U8）→ Array Max & Min 取最大', run: function () { return maxOf(data); }, why: 'U8 沒有負號：負的點（例如 −10，位元組 F6）被讀成 246，最大值變成 200 多。' },
        { name: '去掉標頭 → Type Cast 成 I16 陣列 → Array Max & Min 取最大', run: function () { var v = [], i, q; for (i = 0; i + 1 < data.length; i += 2) { q = data[i] << 8 | data[i + 1]; v.push(q > 32767 ? q - 65536 : q); } return maxOf(v); }, why: '寬度是 1：I16 把相鄰兩點黏成一個數。' },
        { name: 'Spreadsheet String To Array（逗號）→ Array Max & Min 取最大', run: function () { return 0; }, why: '二進位資料裡沒有逗號分隔的數字文字，切不出東西。這是 ASCII 的切法。' }] };
    }
  };
  var PM = null;
  function drawParse() {
    pickRow('ppick', pcur, function (id) { pcur = id; drawParse(); }, INST_ITEMS);
    var raw = PRAW[pcur], P;
    if (!raw) { if (LAST[pcur]) { raw = PRAW[pcur] = LAST[pcur]; PSRC[pcur] = '這是你在 ① 最後收到的那一筆。'; } else { raw = PRAW[pcur] = sampleFor(pcur); PSRC[pcur] = '你還沒在 ① 收到這台的資料，先用範例。'; } }
    $('p-src').textContent = PSRC[pcur];
    if (raw.volts) $('p-raw').innerHTML = '<p class="il-raw" style="font:13px ui-monospace,Consolas,monospace;overflow-wrap:anywhere">ai' + raw.ch + '，' + raw.volts.length + ' 點（V）：' + raw.volts.slice(0, 10).map(function (x) { return x.toFixed(4); }).join('、') + (raw.volts.length > 10 ? ' …' : '') + '</p>';
    else IS.bytesView($('p-raw'), raw.bytes, { label: '原始資料' });
    P = PM = PARSE[pcur](raw);
    $('p-goal').textContent = P.goal;
    if (P.special || !isFinite(P.truth)) { $('p-m').innerHTML = ''; say('p-say', esc(P.special || '這一筆不是預期的量測回覆（可能是錯誤訊息、別的命令的回覆，或讀到半截）。回 ① 收一筆正常的，或按「用範例資料」。'), 'bad'); return; }
    $('p-m').innerHTML = P.methods.map(function (m, i) { return '<button type="button" data-i="' + i + '">' + esc(m.name) + '</button>'; }).join('');
    say('p-say', '');
  }
  function choose(i) {
    var P = PM, m = P && P.methods[i], v, cls, msg, b;
    if (!m) return null;
    v = m.run();
    if (m.ok) { cls = 'ok'; msg = '✔ 得到 <span class="il-res">' + esc(num(v, P.unit)) + '</span>。' + esc(m.why); }
    else if (m.near) { cls = 'near'; msg = '△ 得到 <span class="il-res">' + esc(num(v, P.unit)) + '</span>（平均算出來是 ' + esc(num(P.truth, P.unit)) + '）。' + esc(m.why); }
    else if (same(v, P.truth)) { cls = 'near'; msg = '△ 這一筆剛好算對（' + esc(num(v, P.unit)) + '），可是這個做法有問題：' + esc(m.why) + esc(m.trap || ''); }
    else { cls = 'no'; msg = '✖ 得到 <span class="il-res">' + esc(typeof v === 'number' ? num(v, P.unit) : v) + '</span>，正確是 ' + esc(num(P.truth, P.unit)) + '。' + esc(m.why); }
    b = $('p-m').querySelectorAll('button')[i]; if (b) b.className = cls;
    say('p-say', msg, cls === 'ok' ? 'ok' : cls === 'no' ? 'bad' : '');
    return { value: v, cls: cls };
  }
  $('p-m').onclick = function (e) { var b = e.target.closest('button'); if (b) choose(+b.dataset.i); };
  $('p-sample').onclick = function () { PRAW[pcur] = sampleFor(pcur); PSRC[pcur] = '範例資料。'; drawParse(); };

  /* ====================================================================== ③ VISA、DAQ 還是 TCP？ */
  var LINK = ['序列埠（COM）：用 VISA，要設鮑率、資料位元、同位', 'USB 測試儀器（USBTMC）：用 VISA，選 USB 資源就好，不用設鮑率', '網路線：用 VISA 的 TCPIP 資源或 TCP 函式，要 IP 和埠號', '它不講話：用 DAQ 卡（DAQmx）量電壓'];
  var DATA = ['文字（ASCII），一行一行，有結尾字元', '位元組加檢查碼（例如 Modbus RTU 的 CRC）', '位元組，前面有長度欄位（例如 Modbus TCP 的 MBAP）'];
  var WHO = ['一問一答：我送命令，它才回', '它自己會送：我只要讀，但要小心緩衝區裡的舊資料'];
  var SC = [
    { id: 'psu', name: '電源供應器', sub: '背面一個 USB 孔', clue: '背面只有一個 USB 孔。裝好驅動程式後，Windows 裝置管理員多了一個「COM7」。', quote: 'Baud rate: 9600／57600／115200, Data bits: 8, Parity: none. 例：VSET1:5.0', speaks: true, link: 0, linkWhy: '雖然插的是 USB 線，但電腦看到的是 COM 埠（虛擬序列埠），而且說明書要你設鮑率：這就是序列埠。', data: 0, dataWhy: '命令是看得懂的字（VSET1:5.0）。', who: 0, whoWhy: '說明書列的是命令和查詢，沒有說它會自己送。' },
    { id: 'dmmlan', name: '數位電表（接網路線）', sub: 'RJ-45 網路孔', clue: '背面有 RJ-45 網路孔，面板上看得到 IP 位址。', quote: 'SCPI Socket: port 5025.　MEAS:VOLT:DC?', speaks: true, link: 2, linkWhy: '有 IP、有埠號：這是網路連線，沒有鮑率這種東西。', data: 0, dataWhy: 'SCPI 是文字命令，回覆也是文字。', who: 0, whoWhy: '命令後面有問號的才有回覆。' },
    { id: 'dmmusb', name: '數位電表（接 USB）', sub: 'USB-B 方形孔', clue: '用 USB 線接上後，NI MAX 的「Devices and Interfaces」出現 USB0::0x2A8D::…::INSTR，裝置管理員裡沒有多出 COM 埠。', quote: 'Remote interface: USB, LAN.　MEAS:VOLT:DC?', speaks: true, link: 1, linkWhy: '沒有 COM 埠、資源名稱是 USB 開頭、說明書寫 USBTMC：這是 USB 測試儀器類別，不是虛擬序列埠。', data: 0, dataWhy: '和接網路時一樣是 SCPI 文字。', who: 0, whoWhy: '一樣是一問一答。' },
    { id: 'bal', name: '電子天平', sub: 'D-Sub 9 針', clue: '背面是 9 針的 D-Sub 接頭，標示 RS-232C。面板的設定裡有「Stream mode」。', quote: '2400 bps, 7 bits, EVEN. Stream mode: data is output continuously.', speaks: true, link: 0, linkWhy: 'RS-232C、有鮑率和同位：序列埠。', data: 0, dataWhy: '資料是「ST,+00012.34  g」這種文字加 CR LF。', who: 1, whoWhy: 'Stream mode 是連續輸出：不用問它也一直送。' },
    { id: 'tc', name: '溫度控制器', sub: '兩個端子 D+、D−', clue: '背面的端子標 D+、D−（或 DATA+、DATA−），要透過 USB 轉 RS-485 的轉接器接到電腦。', quote: 'RS-485, Modbus RTU／ASCII, 2400～38400 bps. 位址 1000H：PV', speaks: true, link: 0, linkWhy: 'RS-485 經過轉接器後，電腦上還是一個 COM 埠，一樣要設鮑率。', data: 1, dataWhy: 'Modbus RTU 是位元組，最後兩個位元組是 CRC。（選 ASCII 模式的話是十六進位文字加 LRC。）', who: 0, whoWhy: 'Modbus 永遠是主站（電腦）先問，從站才回。' },
    { id: 'adam', name: '網路型類比輸入模組', sub: 'RJ-45 網路孔', clue: '模組上有 RJ-45 網路孔，用原廠工具可以搜尋到它的 IP。', quote: 'Protocol: Modbus/TCP.　Address 40001～40008: AI value', speaks: true, link: 2, linkWhy: '有 IP：網路連線。', data: 2, dataWhy: 'Modbus TCP 是位元組，前面多一段 MBAP 標頭（含長度），沒有 CRC。', who: 0, whoWhy: 'Modbus 是一問一答。' },
    { id: 'pt', name: '壓力傳送器', sub: '兩條線', clue: '只有兩條線，沒有任何接頭。銘牌上寫「Output: 4–20 mA」。', quote: 'Output signal: 4…20 mA, 2-wire.　Range: 0…10 bar', speaks: false, speakWhy: '它只輸出一個電流大小，沒有命令、沒有協定。', dataWhy: 'DAQ 讀回來的是電壓的數值陣列。電流要先經過電阻變成電壓，再自己依規格換算成壓力。' },
    { id: 'scan', name: '條碼掃描器', sub: 'USB', clue: 'USB 接頭。照說明書掃了「USB COM Port Emulation」的設定條碼後，裝置管理員多了一個 COM 埠。', quote: 'Suffix: CR.　掃到條碼時送出條碼內容', speaks: true, link: 0, linkWhy: '設定成 COM Port Emulation 之後，電腦看到的就是序列埠。', data: 0, dataWhy: '送出的是條碼的文字，後面加 CR。', who: 1, whoWhy: '有人掃它才送，不是你問它才回：程式要一直準備好收。' }
  ];
  var fcur = 'psu', F = null;
  function flowSteps(s) {
    var st = [{ q: '第 1 步：這台設備會不會「講話」？', opts: ['會：它有通訊介面，照某種協定收發資料', '不會：它只給一個電壓或電流的大小'], a: s.speaks ? 0 : 1, why: s.speaks ? '線索裡有通訊規格（鮑率、埠號或協定名稱），而且說明書有命令。' : s.speakWhy }];
    if (!s.speaks) {
      st.push({ q: '第 2 步：那電腦要怎麼接它？', opts: LINK, a: 3, why: '沒有協定可以講，就用 DAQ 卡把電壓量進來。' });
      st.push({ q: '第 3 步：讀回來的會是什麼？', opts: ['一行文字', '一串電壓的數值（陣列），要自己換算成物理量', 'Modbus 封包'], a: 1, why: s.dataWhy });
    } else {
      st.push({ q: '第 2 步：電腦這邊看到的是什麼？LabVIEW 用哪一組函式？', opts: LINK, a: s.link, why: s.linkWhy });
      st.push({ q: '第 3 步：線上跑的資料長什麼樣子？', opts: DATA, a: s.data, why: s.dataWhy });
      st.push({ q: '第 4 步：誰先開口？', opts: WHO, a: s.who, why: s.whoWhy });
    }
    st.push({ q: '最後：接下來第一件事做什麼？', opts: ['先用最簡單的方法（終端機、VISA Test Panel、MAX 的 Test Panel）收一筆，把原始資料整個看一遍', '直接把完整的 LabVIEW 程式寫好再一起測', '先規劃迴圈、Case 和 Shift Register'], a: 0, why: '先讓資料進得來。看過原始資料，才知道要怎麼切、要不要迴圈、要記住什麼。' });
    return st;
  }
  function flowEnd(s) {
    if (!s.speaks) return '結論：用 DAQmx。先在 NI MAX 的 Test Panel 看到電壓，再想換算公式。';
    return '結論：' + ['VISA（序列埠）', 'VISA（USB 資源）', s.data === 2 ? 'TCP 函式（或 Modbus 函式庫）' : 'VISA 的 TCPIP 資源，或 TCP 函式'][s.link] + '；資料是' + ['文字，用字串函式切', '位元組，要算檢查碼、用陣列函式取位元組', '位元組，前 7 個是標頭，用陣列函式取位元組'][s.data] + '；' + (s.who ? '它會自己送，程式要一直讀，而且先清掉舊資料。' : '一問一答，送完命令再讀。');
  }
  function drawFlow() {
    pickRow('fpick', fcur, function (id) { fcur = id; F = null; flowSay(''); drawFlow(); }, SC);
    var s = SC.filter(function (x) { return x.id === fcur; })[0], h, i;
    if (!F) F = { steps: flowSteps(s), i: 0, wrong: -1, miss: 0 };
    h = '<div class="il-clue"><b>你看到的</b>：' + esc(s.clue) + '<blockquote>說明書：' + esc(s.quote) + '</blockquote></div>';
    for (i = 0; i <= F.i && i < F.steps.length; i++) {
      var st = F.steps[i], done = i < F.i;
      h += '<div class="il-step' + (done ? ' done' : '') + '"><b>' + esc(st.q) + '</b><div class="il-m">' + st.opts.map(function (o, k) { return '<button type="button" data-k="' + k + '"' + (done ? ' disabled' : '') + ' class="' + (done && k === st.a ? 'ok' : !done && k === F.wrong ? 'no' : '') + '">' + esc(o) + '</button>'; }).join('') + '</div>' +
        (done ? '<p class="il-why">為什麼：' + esc(st.why) + '</p>' : '') + '</div>';
    }
    if (F.i >= F.steps.length) h += '<div class="il-end" tabindex="-1"><b>' + esc(flowEnd(s)) + '</b><p class="il-why">' + (F.miss ? '這一台你選錯了 ' + F.miss + ' 次。' : '每一步都第一次就選對。') + '換一台再走一次，看哪些線索決定了答案。</p></div>';
    $('flow').innerHTML = h;
  }
  function flowSay(html, cls) { var e = $('flow-say'); e.innerHTML = html || ''; e.className = 'verdict-line' + (cls ? ' ' + cls : ''); }
  function flowAnswer(k) {
    if (!F || F.i >= F.steps.length) return null;
    var box = $('flow'), st = F.steps[F.i], ok = k === st.a, had = box.contains(document.activeElement), end, el;
    if (ok) { F.i++; F.wrong = -1; } else { F.wrong = k; F.miss++; }
    drawFlow(); end = F.i >= F.steps.length;
    /* 結果區（aria-live）：看得到的只有一句；原因和下一題另外唸給螢幕閱讀器，畫面上已經寫在步驟裡了 */
    if (ok) flowSay('✔ 對。<span class="il-sr">' + esc(st.why) + (end ? ' ' + esc(flowEnd(SC.filter(function (x) { return x.id === fcur; })[0])) : ' 下一題：' + esc(F.steps[F.i].q)) + '</span>' + (end ? '這一台走完了。' : ''), 'ok');
    else flowSay('✖ 不是這個。再看一次上面的線索和說明書那一句。', 'bad');
    if (had) {      // 整塊重畫了：答對把焦點放到下一步的第一個選項（走完就放到結論），答錯還給同一顆
      el = ok ? (end ? box.querySelector('.il-end') : box.querySelector('.il-step:not(.done) button')) : box.querySelectorAll('.il-step:not(.done) button')[k];
      if (el) el.focus();
    }
    return ok;
  }
  $('flow').onclick = function (e) { var b = e.target.closest('button[data-k]'); if (b && !b.disabled) flowAnswer(+b.dataset.k); };

  /* ====================================================================== 分頁 */
  var tabs = $('tabs');
  function show(t) {
    [].forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['talk', 'parse', 'flow', 'quiz'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
    if (t === 'parse') { PRAW[pcur] = null; pcur = cur; PRAW[pcur] = null; drawParse(); }
    if (t === 'flow') drawFlow();
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  pick('gpd');
  if (/^#(talk|parse|flow|quiz)$/.test(location.hash)) show(location.hash.slice(1));

  window.InstLab = { show: show, pick: pick, term: function () { return term; }, last: function () { return LAST; }, done: function () { return DONE; },
    parse: { pick: function (id) { pcur = id; PRAW[id] = sampleFor(id); PSRC[id] = '範例資料。'; drawParse(); return PM; }, set: function (id, raw) { pcur = id; PRAW[id] = raw; PSRC[id] = ''; drawParse(); return PM; }, choose: choose, cur: function () { return PM; }, defs: PARSE, sampleFor: sampleFor },
    flow: { pick: function (id) { fcur = id; F = null; flowSay(''); drawFlow(); return F; }, answer: flowAnswer, state: function () { return F; }, scenarios: SC, steps: flowSteps } };
})();

/* ---------- 猜一猜 ---------- */
(function () {
  'use strict';
  var IS = window.InstSim, U = IS.util;
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function h2(n) { return (n < 16 ? '0' : '') + n.toString(16).toUpperCase(); }
  function uniq(ans, list) { var seen = {}, out = []; seen[ans] = 1; list.forEach(function (x) { x = String(x); if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
  var KIND = [
    function () { var c = p1(['S', 'T', 'U', ',', '1', '0', 'g', '5']), b = c.charCodeAt(0), f = function () { var r = U.reframe(b, { bits: 7, parity: 'E', stop: 1 }, { bits: 8, parity: 'N', stop: 1 }).byte; return r === b ? h2(b) + 'h（沒變）' : h2(r) + 'h（變成亂碼）'; };
      return { q: '天平用 7-E-1 送出字元「' + c + '」（' + h2(b) + 'h），電腦卻設成 8-N-1（鮑率一樣）。電腦收到的位元組是？', ans: f(), wrong: uniq(f(), [h2(b) + 'h（沒變）', h2(b | 0x80) + 'h（變成亂碼）', h2((~b) & 255) + 'h（變成亂碼）', '什麼都收不到', h2(b >> 1) + 'h（變成亂碼）']), ex: '7-E-1 的第 8 個位元是同位位元。電腦當成資料的最高位元：字元裡 1 的個數是奇數時它是 1，所以有些字沒事、有些字變成 80h 以上的怪字。', chk: f }; },
    function () { var b = [1, p1([3, 6]), 0x10, ri(0, 1), 0, ri(1, 8)], f = function () { return h2(U.lrc(b)); };
      return { q: 'Modbus ASCII：要送的位元組是 <b>' + U.hex(b) + '</b>。LRC 是多少？（全部加起來，取負數的最低 8 位元）', ans: f(), wrong: uniq(f(), [h2(b.reduce(function (x, y) { return x + y; }, 0) & 255), h2((U.lrc(b) + 1) & 255), h2((~U.lrc(b)) & 255), h2(U.crc16(b) & 255), '00']), ex: '總和是 ' + h2(b.reduce(function (x, y) { return x + y; }, 0) & 255) + 'h，LRC 是它的二補數 ' + f() + 'h：兩個加起來剛好是 00。', chk: f }; },
    function () { var b = [1, 3, 0x10, ri(0, 1), 0, ri(1, 4)], c = U.crc16(b), f = function () { return h2(c & 255) + ' ' + h2(c >> 8); };
      return { q: 'Modbus RTU：算出來的 CRC 是 <b>' + h2(c >> 8) + h2(c & 255) + 'h</b>。接在封包最後的兩個位元組，依序是？', ans: f(), wrong: uniq(f(), [h2(c >> 8) + ' ' + h2(c & 255), h2(c & 255) + ' ' + h2(c & 255), '只放 ' + h2(c & 255), h2(c >> 8) + ' ' + h2(c >> 8)]), ex: 'CRC 是低位元組在前；封包裡的位址和資料才是高位元組在前。放反了，儀器會當成 CRC 錯誤，完全不回應。', chk: f }; },
    function () { var t = ri(150, 999), s = h2(t >> 8) + h2(t & 255), f = function () { return (parseInt(s, 16) / 10).toFixed(1) + ' 度'; };
      return { q: '溫控器回覆裡，PV 的 4 個十六進位字元是 <b>' + s + '</b>（單位 0.1 度）。溫度是？', ans: f(), wrong: uniq(f(), [t + '.0 度', (parseInt(s, 10) || 0) / 10 + ' 度', (t / 100).toFixed(2) + ' 度', ((t & 255) / 10).toFixed(1) + ' 度', s + ' 度']), ex: s + 'h ＝ ' + t + '，再除以 10。', chk: f }; },
    function () { var n = ri(1, 150), v = 65536 - n, s = h2(v >> 8) + h2(v & 255), f = function () { var x = parseInt(s, 16); return ((x > 32767 ? x - 65536 : x) / 10).toFixed(1) + ' 度'; };
      return { q: '冷凍庫的溫控器，PV 回 <b>' + s + '</b>（單位 0.1 度，有正負號的 16 位元）。溫度是？', ans: f(), wrong: uniq(f(), [(v / 10).toFixed(1) + ' 度', (n / 10).toFixed(1) + ' 度', '感測器沒接', '0.0 度']), ex: '最高位元是 1 代表負數：' + v + ' − 65536 ＝ −' + n + '，再除以 10。LabVIEW 裡把 U16 轉成 I16 就對了。', chk: f }; },
    function () { var raw = p1([0, 16384, 32768, 40960, 49151, 65535]), x = raw / 65535 * 20 - 10, v2 = function (n) { var t = n.toFixed(2); return (t === '-0.00' ? '0.00' : t) + ' V'; }, f = function () { return v2(raw / 65535 * 20 - 10); };
      return { q: '類比輸入模組某通道的量程是 ±10 V，原始值 0～65535 線性對應 −10～+10 V（本站模擬的換算）。讀到原始值 <b>' + raw + '</b>，電壓是？', ans: f(), wrong: uniq(f(), [v2(raw / 65535 * 10), v2(raw / 1000), v2(raw / 65535 * 20), v2(-x), v2(x / 2), v2(raw / 65535 * 10 - 5), v2(x + 5)]), ex: '÷65535 得到 0～1 的位置，×20 是量程寬度，再加上起點 −10。0 V 在原始值的中間。', chk: f }; },
    function () { var bar = p1([0, 2, 2.5, 5, 7.5, 10]), v = 1 + bar / 10 * 4, f = function () { return ((v - 1) / 4 * 10).toFixed(1) + ' bar'; };
      return { q: '壓力傳送器輸出 4～20 mA 對應 0～10 bar，經 250 Ω 電阻後 DAQ 量到 <b>' + v.toFixed(2) + ' V</b>。壓力是？', ans: f(), wrong: uniq(f(), [(v / 5 * 10).toFixed(1) + ' bar', (v * 2).toFixed(1) + ' bar', (v * 4).toFixed(1) + ' bar', (v - 1).toFixed(1) + ' bar', ((v - 1) / 5 * 10).toFixed(1) + ' bar', (v * 2.5).toFixed(1) + ' bar', v.toFixed(1) + ' bar']), ex: v.toFixed(2) + ' V ÷ 250 Ω ＝ ' + (v * 4).toFixed(1) + ' mA。4 mA 是 0 bar、20 mA 是 10 bar：(V − 1) ÷ 4 × 10。', chk: f }; },
    function () { var nplc = p1([10, 100]), to = p1([500, 2000, 5000]), tm = Math.round(nplc / 60 * 1000 * 2 + 20), ok = tm < to;
      return { q: '電表量一次要 ' + tm + ' ms（積分時間長）。程式送出 READ? 後馬上讀，逾時設 ' + to + ' ms。會怎樣？', ans: ok ? '等大約 ' + tm + ' ms 後讀到數值' : '逾時：' + to + ' ms 到了還沒有資料', wrong: uniq(ok ? '等大約 ' + tm + ' ms 後讀到數值' : '逾時：' + to + ' ms 到了還沒有資料', ['等大約 ' + tm + ' ms 後讀到數值', '逾時：' + to + ' ms 到了還沒有資料', '馬上讀到上一次的數值', '儀器回一個錯誤訊息', '讀到空字串，沒有錯誤']), ex: '讀取會一直等到資料來或逾時。量測時間比逾時長，就一定逾時：把逾時加長，或把積分時間調短。' }; },
    function () { var c = p1(['*IDN?', 'VSET1?', 'MEAS:VOLT:DC?']);
      return { q: '序列埠（或 socket）的儀器，命令要用換行結尾。你送了「' + c + '」卻沒有加結尾字元，然後去讀。結果？', ans: '儀器還在等命令結束，不會回；讀取等到逾時', wrong: ['儀器回 ERROR', '儀器照樣回覆', '電腦自動幫你補上換行', '連線中斷'], ex: '儀器靠結尾字元知道「一個命令講完了」。沒有它，儀器會一直等下去，你這邊就是逾時。' }; },
    function () { var sec = ri(3, 9), per = 10;
      return { q: '天平設成連續送，每秒 ' + per + ' 筆。程式開了序列埠之後 ' + sec + ' 秒才第一次讀一行。讀到的是？', ans: sec + ' 秒前的第一筆（最舊的）', wrong: ['現在這一刻的重量', '最後 ' + per + ' 筆的平均', '逾時', '空字串'], ex: '沒被讀走的資料都排在緩衝區裡，先進先出。這 ' + sec + ' 秒已經積了大約 ' + sec * per + ' 筆。要最新的：先清緩衝區（VISA Flush I/O Buffer）再讀，或一直讀到沒有為止。' }; },
    function () { return { q: '送出「VSET1:5.0」之後去讀，等到逾時都沒有東西。最可能的原因？', ans: '這是設定命令，本來就沒有回覆', wrong: ['儀器壞了', '鮑率一定設錯了', '要等更久', '命令要改成小寫'], ex: '設定類的命令通常不回。想確認有沒有設進去，再送一個查詢（VSET1?），或問錯誤（ERR?）。' }; },
    function () { return { q: '對 34461A 送了一個拼錯的命令，它什麼都沒回。怎麼知道它覺得哪裡錯？', ans: '送 SYST:ERR? 把錯誤佇列讀出來', wrong: ['等久一點它會自己說', '看 VISA Read 的 error out', '重開機', '讀到的空字串就是錯誤訊息'], ex: 'SCPI 儀器把錯誤放進佇列，不會主動通知。SYST:ERR? 一次讀一筆，讀到 +0,"No error" 就是讀完了。' }; },
    function () { var e = p1([[0x83, 2, '位址不存在'], [0x83, 3, '數量或數值不合法'], [0x86, 3, '寫入的數值不合法']]);
      return { q: 'Modbus 溫控器回了 <b>01 ' + h2(e[0]) + ' 0' + e[1] + '</b>（後面是檢查碼）。這代表？', ans: '例外回應：命令收到了，但被拒絕（例外碼 0' + e[1] + '）', wrong: ['溫度是 ' + (e[0] * 256 + e[1]) / 10 + ' 度', '檢查碼算錯了', '站號不對', '一切正常'], ex: '功能碼加上 80h（' + h2(e[0] & 0x7F) + ' → ' + h2(e[0]) + '）就是例外回應，後面一個位元組是原因。檢查碼錯或站號錯的話，它根本不會回。' }; },
    function () { var w = p1([['站號填錯', 1], ['CRC 兩個位元組放反', 1], ['讀一個不存在的位址', 0]]);
      return { q: '對 Modbus RTU 的溫控器送命令，但是<b>' + w[0] + '</b>。會怎樣？', ans: w[1] ? '完全不回應，讀取等到逾時' : '回例外碼（功能碼的最高位元變 1）', wrong: uniq(w[1] ? '完全不回應，讀取等到逾時' : '回例外碼（功能碼的最高位元變 1）', ['完全不回應，讀取等到逾時', '回例外碼（功能碼的最高位元變 1）', '回 ERROR 這個字', '照樣回資料', '儀器當機']), ex: '封包本身有問題（站號、檢查碼）→ 從站當作不是給它的，不回。封包正確但內容不合法 → 回例外碼。所以「逾時」和「例外」是兩種不同的線索。' }; },
    function () { return { q: '網路型的儀器，程式一開始就直接寫命令，沒有先連線。結果？', ans: '寫入就出錯：沒有連線，資料送不出去', wrong: ['命令會先存著，連線後自動送出', '儀器會自己連回來', '可以寫，只是讀不到', '跟序列埠一樣，直接就能寫'], ex: 'TCP 要先 Open Connection（給 IP 和埠號），拿到連線之後才能寫和讀；用完要關。' }; },
    function () { var w = p1(['ST,+00050.00  g', 'US,-00183.69  g', 'OL,+9999999E+19']), f = function () { return (w.length + 2) + ' 個'; };
      return { q: '天平送出一筆「' + w.replace(/ /g, '␣') + '」再加 CR LF。VISA Read 讀到結尾字元為止，會拿到幾個位元組？', ans: f(), wrong: uniq(f(), [w.length + ' 個', (w.length + 1) + ' 個', (w.length - 1) + ' 個', (w.length + 4) + ' 個']), ex: '15 個字元（含逗號和空白）加上 CR、LF 兩個看不見的字元。轉數字前要知道它們在。', chk: f }; },
    function () { var n = ri(1, 7), f = function () { return String(1 + 7 * n); };
      return { q: 'ADAM-4017 回覆「>」後面接 8 組數值，每組固定 7 個字元、沒有分隔符號。要取通道 ' + n + '，String Subset 的 offset 是多少？', ans: f(), wrong: uniq(f(), [String(7 * n), String(8 * n), String(1 + 8 * n), String(7 * n + 7), String(n)]), ex: '開頭的 > 佔第 0 格，通道 0 從 1 開始，每個通道 7 格：1 + 7 × ' + n + ' ＝ ' + f() + '，length 都是 7。', chk: f }; },
    function () { return { q: 'ADAM-4017 的回覆用 CR 結尾。VISA Read 的結尾字元卻設成 LF（\\n）。會怎樣？', ans: '資料其實到了，但 Read 一直等不到 \\n，卡到逾時', wrong: ['正常讀到', '讀到一半', '儀器不回應', '讀到兩筆'], ex: 'Read 在等它認得的結尾字元。逾時之後看緩衝區，資料都在：這就是「結尾字元設錯」的樣子。' }; },
    function () { var s = p1([['壓力傳送器，銘牌寫 Output 4–20 mA，只有兩條線', 'DAQ 卡（DAQmx）'], ['溫控器，端子是 D+、D−，說明書寫 Modbus RTU', 'VISA 序列埠（經 USB 轉 RS-485）'], ['電表，NI MAX 裡出現 USB0::…::INSTR', 'VISA（USB 資源）'], ['模組有 RJ-45，說明書寫 Modbus/TCP', 'TCP 連線']]);
      return { q: '「' + s[0] + '」。LabVIEW 這邊用什麼接？', ans: s[1], wrong: uniq(s[1], ['DAQ 卡（DAQmx）', 'VISA 序列埠（經 USB 轉 RS-485）', 'VISA（USB 資源）', 'TCP 連線']), ex: '看線索：只給電壓電流 → DAQ；有鮑率 → 序列埠；USB 資源名稱 → USBTMC；有 IP 和埠 → 網路。' }; },
    function () { var n = ri(4, 12), f = function () { return String(n + 1); };
      return { q: 'Modbus TCP 的 MBAP 標頭裡有一個「長度」欄位。功能碼加資料一共 ' + n + ' 個位元組時，長度要填多少？', ans: f(), wrong: uniq(f(), [String(n), String(n + 7), String(n + 2), String(n + 6)]), ex: '長度 ＝ 站號 1 個位元組 ＋ 後面的 ' + n + ' 個 ＝ ' + f() + '。填太大，模組會一直等還沒來的位元組；你就逾時。', chk: f }; },
    function () { return { q: '天平照說明書設好 2400、7、E、1，接上去卻什麼都收不到。先查哪一項？', ans: '輸出模式：出廠是按 PRINT 才送（Key mode），不會自己一直送', wrong: ['把鮑率改成 9600', '把同位改成 None', '換一條 USB 線', '重灌 LabVIEW'], ex: '參數對了還是沒資料，要回去看說明書「什麼時候會送」。按天平的 PRINT、送 Q 命令，或把它改成 Stream mode。' }; },
    function () { return { q: '溫控器的 PV 讀到 <b>8003H</b>。程式把它轉成數字會得到 3277.1 度。該怎麼處理？', ans: '先判斷是不是錯誤碼（8003H＝感測器沒接），不要當成溫度', wrong: ['照樣顯示 3277.1 度', '除以 100 就對了', '當成負數 −3276.5 度', '重送一次就會好'], ex: '很多儀器用特別的數值表示「這不是量測值」。看過原始資料、對過說明書，才知道要先擋掉哪些值。' }; }
  ];
  function gen() { return p1(KIND)(); }
  function verify(n) {
    n = n || 200; var bad = [], L = window.InstLab;
    KIND.forEach(function (k, i) {
      for (var j = 0; j < n; j++) {
        var q = k(), w = q.wrong.filter(function (x, ix, a) { return x !== q.ans && a.indexOf(x) === ix; });
        if (!q.q || !q.ans || !q.ex) bad.push('題型 ' + i + '：缺欄位');
        if (w.length < 3) bad.push('題型 ' + i + '：錯誤選項不足 ' + w.length);
        if (q.chk && q.chk() !== q.ans) bad.push('題型 ' + i + '：chk ' + q.chk() + ' ≠ ' + q.ans);
      }
    });
    IS.list().forEach(function (d) {       // 每台儀器的範例資料：正確切法算出真值，錯的切法不能算對（除非它標了「剛好」的情況）
      var raw = L.parse.sampleFor(d.id), P = L.parse.defs[d.id](raw), okN = 0;
      if (!isFinite(P.truth)) bad.push(d.id + '：範例資料算不出真值');
      P.methods.forEach(function (m, i) { var v = m.run(); if (m.ok) { okN++; if (typeof v !== 'number' || Math.abs(v - P.truth) > 1e-9) bad.push(d.id + ' 切法 ' + i + '：標成正確卻算出 ' + v); } else if (!m.near && typeof v === 'number' && Math.abs(v - P.truth) <= 1e-9) bad.push(d.id + ' 切法 ' + i + '：標成錯的卻在範例資料上算對'); });
      if (!okN) bad.push(d.id + '：沒有正確的切法');
    });
    L.flow.scenarios.forEach(function (s) { L.flow.steps(s).forEach(function (st, i) { if (!(st.a >= 0 && st.a < st.opts.length) || !st.why) bad.push(s.id + ' 第 ' + (i + 1) + ' 步：答案或說明有缺'); }); });
    var v = IS.verify(); if (!v.ok) bad = bad.concat(v.problems.map(function (p) { return 'InstSim：' + p; }));
    return bad;
  }
  if (window.LabQuiz) window.InstLab.quiz = window.LabQuiz('iquiz', gen);
  window.InstLab.quizGen = gen; window.InstLab.quizKinds = KIND; window.InstLab.verify = verify;
})();
