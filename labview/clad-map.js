/* CLAD 考試地圖與題型特訓
   考試規則與主題比例：依 NI 現行 CLAD 準備指南（由查證員讀原文）與 2017 版備考指南 p.4 的圓餅圖，兩者比例相同。
   題目全部是本站原創；能計算的題目都附 chk()，用模擬的方式重算答案（CladMap.verify() 會跑一遍）。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function store(k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 私密模式 */ } }
  var KMAP = 'll_lv_clad_map', KDRILL = 'll_lv_clad_drill';

  /* ======================================================================
     考試規則（以 NI 官網最新公告為準）
     ====================================================================== */
  var RULES = [['40 題', '單選，每題 4 選 1'], ['1 小時', '考試時間'], ['70%', '以上及格'], ['線上或 PSI 考場', '應考方式'], ['不能用 LabVIEW', '也不能查任何資料；題目會附 LabVIEW 與 LabVIEW Help 的截圖']];

  /* ======================================================================
     考試地圖：L = [網址, 顯示文字]
     ====================================================================== */
  function les(id, t) { return ['index.html#' + id, '課程 ' + id + (t ? ' ' + t : '')]; }
  function lab(f, h, t) { return [f + (h ? '#' + h : ''), t]; }
  var TOPICS = [
    { id: 'hw', name: '硬體連接與採集（Hardware）', pct: 10, c: '#1f4e8c', pts: [
      { id: 'hw1', t: '訊號路徑：感測器 → 接線盒 → DAQ → 電腦', d: '訊號從哪裡進來、經過哪些硬體才到 LabVIEW。', L: [les('C12', 'DAQmx'), lab('lab-daq.html', 'rate', 'DAQ 實驗室')] },
      { id: 'hw2', t: '取樣率與混疊（奈奎斯特）', d: '取樣率要大於訊號最高頻率的 2 倍；不夠時量到不存在的低頻。', L: [lab('lab-daq.html', 'rate', 'DAQ：取樣率與混疊'), les('C12')] },
      { id: 'hw3', t: '解析度與量測範圍', d: '範圍選得剛好，最小可分辨電壓才小。', L: [lab('lab-daq.html', 'res', 'DAQ：解析度與範圍')] },
      { id: 'hw4', t: 'DAQmx 任務的一生', d: '建立通道 → 設定時序 → 開始 → 迴圈裡讀寫 → 停止、清除。', L: [lab('lab-daq.html', 'buf', 'DAQ：DAQmx 流程與緩衝區'), les('C12')] },
      { id: 'hw5', t: '連續擷取的緩衝區', d: '每次讀的點數 ÷ 取樣率 ≈ 一圈的時間；讀太慢會溢位，寫得比產生慢會不足。', L: [lab('lab-daq.html', 'buf', 'DAQ：緩衝區')] },
      { id: 'hw6', t: '多通道資料：取第 N 個通道', d: '多通道讀回 2D 陣列，一列一個通道，索引從 0 算起。', L: [les('C13', '多通道 2D 陣列'), lab('lab-array.html', '', '陣列實驗室')] },
      { id: 'hw7', t: 'Waveform 與基本分析', d: 't0、dt、Y；平均、RMS、濾波後的形狀。', L: [lab('lab-wave.html', 'wf', '波形：t0、dt、Y'), lab('lab-wave.html', 'st', '波形：統計')] }] },
    { id: 'env', name: 'LabVIEW 程式設計環境', pct: 25, c: '#0f9f7a', pts: [
      { id: 'e1', t: '專案：Project Explorer、資料夾、Library', d: '.lvproj 只記路徑；搬檔案要在專案裡搬，避免交叉連結。', L: [lab('lab-project.html', 'pj', '專案是清單'), les('C01')] },
      { id: 'e2', t: '資料型別與線的顏色', d: '數值（整數、浮點）、布林、字串、陣列、Cluster 在面板和方塊圖上的樣子。', L: [les('L03'), les('C02'), lab('lab-numeric.html', 'ovf', '數值：溢位與轉換')] },
      { id: 'e3', t: '強制轉換點、捨入、溢位', d: '整數溢位會繞回；浮點轉整數四捨六入五成雙並夾在範圍內。', L: [lab('lab-numeric.html', 'round', '數值：捨入函式'), les('C02')] },
      { id: 'e4', t: 'Enum 與 Ring', d: 'Enum 的文字是型別的一部分；Ring 只是數字。', L: [lab('lab-enum.html', 'er', 'Enum vs Ring')] },
      { id: 'e5', t: '預測執行順序：資料流（不含迴圈的 VI）', d: '輸入到齊才執行；沒有連線就不保證先後；線分叉是複製。', L: [lab('lab-flow.html', 'rule', '資料流規則'), lab('lab-flow.html', 'par', '平行與順序'), les('L02')] },
      { id: 'e6', t: '預測簡單 State Machine 的行為', d: 'Shift Register 存下一個狀態，每圈 Case 選一頁。', L: [lab('lab-struct.html', 'sm', 'State Machine'), lab('lab-enum.html', 'sm', '字串 vs Enum 狀態')] },
      { id: 'e7', t: '預測事件驅動 UI', d: 'Event Structure 一次處理一個事件；Timeout -1 永遠等。', L: [lab('lab-struct.html', 'event', 'Event 事件排隊'), les('C04')] },
      { id: 'e8', t: '預測不含 Queue 的平行迴圈', d: '兩個迴圈之間有線，就是一個等另一個；用 Local Variable 停兩個迴圈。', L: [lab('lab-var.html', 'stop', '一顆 Stop 停兩個迴圈'), lab('lab-flow.html', 'loop', '迴圈的邊界')] },
      { id: 'e9', t: '按鈕的機械動作', d: 'Switch／Latch、When Pressed／Released／Until Released。', L: [lab('lab-bool.html', 'mech', '按鈕機械動作')] },
      { id: 'e10', t: '斷掉的箭頭與除錯工具', d: 'Error List、Probe、Breakpoint、Highlight Execution、單步執行。', L: [lab('lab-debug.html', 'err', '斷掉的箭頭'), lab('lab-debug.html', 'probe', 'Probe 與單步')] },
      { id: 'e11', t: 'Error Cluster 與 Merge Errors', d: 'error in 有錯就跳過；關閉類照樣執行；Merge Errors 取第一個錯誤。', L: [lab('lab-cluster.html', 'err', '錯誤叢集的流動'), lab('lab-cluster.html', 'mrg', 'Merge Errors'), les('L11'), les('C10')] },
      { id: 'e12', t: '查 LabVIEW Help', d: 'Context Help（Ctrl+H）看端子名稱、預設值、粗體是必要輸入。', L: [les('C01')] }] },
    { id: 'fun', name: 'LabVIEW 程式設計基礎', pct: 50, c: '#334155', big: true, pts: [
      { id: 'f1', t: 'While、For：跑幾次、停止條件', d: 'While 至少跑一次；For 的 N 和自動索引取小的。', L: [lab('lab-loop.html', 'run', '迴圈怎麼跑'), les('L04'), les('C03')] },
      { id: 'f2', t: 'Shift Register：初始化與多次執行', d: '沒接初始值的 Shift Register 會記住上一次執行的值。', L: [lab('lab-loop.html', 'sr', 'Shift Register'), les('L05')] },
      { id: 'f3', t: '迴圈通道：最後值、索引、串接、條件', d: '輸出通道的四種模式決定迴圈外拿到什麼。', L: [lab('lab-flow.html', 'loop', '迴圈的邊界'), les('C15'), les('C16')] },
      { id: 'f4', t: 'Case 選擇器：捨入、範圍、字串、Default', d: '小數先捨入成整數；範圍包含兩端；字串分大小寫。', L: [lab('lab-struct.html', 'case', 'Case 走哪一頁'), les('L06'), les('C04')] },
      { id: 'f5', t: '時間：Wait、Tick Count、時間戳', d: 'Tick Count 相減量耗時；Format Date/Time String 的格式碼。', L: [lab('lab-loop.html', 'wait', 'Wait 與節拍器'), lab('lab-time.html', 'wrap', 'Tick Count 繞回'), lab('lab-time.html', 'stamp', '時間戳與格式碼')] },
      { id: 'f6', t: '陣列函式', d: 'Array Size、Index、Replace Subset、Insert、Delete、Initialize、Build、Subset、Max & Min、Sort 1D、Search 1D、Split 1D。', L: [lab('lab-array.html', '', '陣列實驗室'), les('L07'), les('C05')] },
      { id: 'f7', t: '2D 陣列與自動索引的大小', d: '兩層迴圈、自動索引、Build Array 有沒有勾 Concatenate。', L: [les('C13'), les('C15'), lab('lab-coderead.html', 'prac', '看圖說答案')] },
      { id: 'f8', t: '字串與格式碼', d: 'Format Into String、Scan From String、Spreadsheet String To Array。', L: [lab('lab-string.html', 'fmt', '格式碼'), lab('lab-string.html', 'fn', '切、接、找、換'), les('F05'), les('L09')] },
      { id: 'f9', t: '檔案 I/O：開、寫、關與錯誤碼', d: '開檔方式、路徑沒接跳對話框、錯誤 7、10、43。', L: [lab('lab-file.html', 'open', '開檔方式'), lab('lab-file.html', 'mark', '檔案指標'), les('F04'), les('C17')] },
      { id: 'f10', t: 'CSV 與 TDMS', d: '給人和 Excel 看用 CSV；大量多通道、要帶屬性用 TDMS。', L: [lab('lab-file.html', 'csv', '寫 CSV'), les('F01'), les('C06')] },
      { id: 'f11', t: 'DAQmx 在程式裡的寫法', d: '迴圈外開始與清除、迴圈內讀；錯誤和 Stop 一起停迴圈。', L: [lab('lab-daq.html', 'buf', 'DAQmx 流程'), les('C12')] }] },
    { id: 'bp', name: '程式設計最佳實踐', pct: 15, c: '#64748b', pts: [
      { id: 'b1', t: 'SubVI 與 4-2-2-4 接線端', d: '輸入在左、輸出在右、錯誤在下面兩角。', L: [lab('lab-subvi.html', 'conn', '接線端怎麼配'), les('L10'), les('C07')] },
      { id: 'b2', t: 'Required、Recommended、Optional', d: 'Required 沒接，執行箭頭就斷。', L: [lab('lab-subvi.html', 'req', 'Required 沒接會怎樣')] },
      { id: 'b3', t: 'Edit ▸ Create SubVI 做了什麼', d: '自動建控制項、配接線端、換成 SubVI；Required、圖示、檔名要自己來。', L: [les('C07')] },
      { id: 'b4', t: 'Cluster：Bundle／Unbundle By Name', d: '把相關資料打包；線分叉是兩份。', L: [lab('lab-cluster.html', 'bun', 'Bundle／Unbundle'), les('C18'), les('L08')] },
      { id: 'b5', t: 'Type Def 與 Strict Type Def', d: '改 .ctl，所有用到的地方一起更新。', L: [lab('lab-cluster.html', 'td', 'Type Def'), lab('lab-enum.html', 'strict', 'Type Def vs Strict'), lab('lab-enum.html', 'add', '新增選項')] }] }
  ];
  var EXT = { id: 'ext', name: '課程延伸（不在官方範圍）', pct: 0, c: '#9333ea', pts: [
    { id: 'x1', t: 'Queue 與 Notifier', d: '迴圈之間傳資料：一筆都不能少用 Queue，只要最新用 Notifier。', L: [lab('lab-queue.html', 'basic', 'Queue 基本'), lab('lab-queue.html', 'cmp', '三種傳法比一比'), les('C08')] },
    { id: 'x2', t: '設計模式：Producer/Consumer、QMH', d: '工作上一定會用到的架構。', L: [lab('lab-queue.html', 'stop', 'Producer/Consumer 怎麼關'), lab('lab-qmh.html', 'qmh', 'QMH'), les('C09')] },
    { id: 'x3', t: 'FGV 功能型全域變數', d: '用不初始化的 Shift Register 存資料的 SubVI。', L: [lab('lab-var.html', 'fgv', 'FGV'), les('C08')] },
    { id: 'x4', t: 'Reentrancy、Polymorphic', d: '可重入的兩種模式、多型 VI。', L: [lab('lab-subvi.html', 'reent', '可重入'), les('C07')] },
    { id: 'x5', t: '屬性節點與控制參考', d: '用程式改顏色、反灰；Value (Signaling) 會觸發事件。', L: [lab('lab-prop.html', 'pn', '屬性節點'), lab('lab-prop.html', 'ref', '控制參考')] },
    { id: 'x6', t: 'Chart 與 Graph', d: '2017 版指南的範例題出現過：Chart 記舊資料、Graph 整張換。', L: [lab('lab-graph.html', 'type', 'Chart 和 Graph'), les('C11'), les('C14')] },
    { id: 'x7', t: 'Sequence 與 Formula Node', d: '強制順序的兩種寫法、文字公式。', L: [lab('lab-struct.html', 'seq', 'Sequence 與計時'), lab('lab-formula.html', 'cmp', 'Formula Node')] },
    { id: 'x8', t: 'VISA 儀器通訊', d: '序列埠、VISA Read 的三個返回條件。', L: [lab('lab-visa.html', 'read', 'VISA Read'), les('L12')] },
    { id: 'x9', t: '執行檔與 Shared Variable', d: 'Build Specifications、Run-Time Engine。', L: [lab('lab-project.html', 'bd', '建立執行檔'), lab('lab-project.html', 'sv', 'Shared Variable')] }] };

  /* ======================================================================
     題型與原創題
     ====================================================================== */
  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function p1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rhe(x) { var f = Math.floor(x), d = x - f; if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1; return Math.round(x); }   // 四捨六入五成雙
  function arrStr(a) { return '[' + a.join(', ') + ']'; }
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }

  var TYPES = [
    { id: 'size', name: '看圖說陣列大小', topic: 'fun', pts: ['f7', 'f3'],
      how: '先數「誰決定圈數」：For 迴圈看 N 和所有自動索引陣列，取最小的。再看輸出通道：自動索引會多一個維度（1D 變 2D），最後值通道只留最後一圈，Build Array 勾了 Concatenate 是接長不是疊層。2D 的大小寫成「列 × 行」，外層迴圈決定列數。',
      rec: [lab('lab-loop.html', 'run', '迴圈怎麼跑'), les('C13'), lab('lab-coderead.html', 'prac', '看圖說答案')],
      gens: [
        function () { var n = ri(2, 7), m = ri(2, 6);
          return { q: 'For Loop 的 N 接 ' + n + '。迴圈裡用 Initialize Array 做出 ' + m + ' 個 0 的 1D 陣列，接到迴圈右邊框的<b>自動索引</b>輸出通道。迴圈外的陣列大小是？', ans: n + ' 列 × ' + m + ' 行', wrong: [m + ' 列 × ' + n + ' 行', '1 列 × ' + (n * m) + ' 行', n + ' 列 × 1 行', (n - 1) + ' 列 × ' + m + ' 行'],
            ex: '每一圈產生一列（' + m + ' 個元素），自動索引把 ' + n + ' 圈疊成 2D：' + n + ' 列 × ' + m + ' 行。',
            chk: function () { var a = []; for (var i = 0; i < n; i++) a.push(new Array(m).fill(0)); return a.length + ' 列 × ' + a[0].length + ' 行'; } }; },
        function () { var a = ri(3, 9), b = ri(3, 9), c = ri(3, 12);
          return { q: '兩個 1D 陣列（長度 ' + a + ' 和 ' + b + '）都用自動索引接進 For Loop，N 端子另外接了 ' + c + '。迴圈跑幾圈？', ans: String(Math.min(a, b, c)), wrong: [String(Math.max(a, b, c)), String(a), String(b), String(c), String(a + b), String(Math.min(a, b, c) + 1), String(Math.min(a, b, c) - 1)],
            ex: '自動索引的陣列和 N 都會限制圈數，取最小的：min(' + a + ', ' + b + ', ' + c + ') = ' + Math.min(a, b, c) + '。',
            chk: function () { var it = 0; while (it < a && it < b && it < c) it++; return String(it); } }; },
        function () { var k = ri(2, 6), s = ri(2, 5);
          return { q: 'While Loop 的停止條件（Stop if True）接 <code>i ≥ ' + k + '</code>。每一圈用 Build Array（勾 Concatenate Inputs）把 ' + s + ' 個新資料接到 Shift Register 的 1D 陣列後面，初始值是空陣列。迴圈結束後陣列有幾個元素？', ans: String((k + 1) * s), wrong: [String(k * s), String(k + 1), String((k + 2) * s), String(s)],
            ex: 'i 從 0 數到 ' + k + ' 才停，共 ' + (k + 1) + ' 圈，每圈接 ' + s + ' 個：' + (k + 1) + ' × ' + s + ' = ' + (k + 1) * s + '。While Loop 是先做完這一圈才看停止條件。',
            chk: function () { var arr = [], i = 0; for (;;) { for (var j = 0; j < s; j++) arr.push(0); if (i >= k) break; i++; } return String(arr.length); } }; }] },
    { id: 'loop', name: '迴圈跑幾次、i 是多少', topic: 'fun', pts: ['f1', 'f3'],
      how: 'While Loop 一定先跑一圈，跑完才看停止條件；看清楚是 Stop if True 還是 Continue if True。i 從 0 開始，跑了 n 圈時最後一圈的 i 是 n − 1。For 的 N = 0 時一圈都不跑：Shift Register 直接送出初始值，最後值通道送出預設值。',
      rec: [lab('lab-loop.html', 'run', '迴圈怎麼跑'), les('C03'), lab('lab-debug.html', 'loop', '迴圈的除錯')],
      gens: [
        function () { var k = ri(2, 7), f = p1([['Stop if True', 'i ≥ k'], ['Stop if True', 'i + 1 ≥ k'], ['Continue if True', 'i < k'], ['Continue if True', 'i + 1 < k']]);
          var cond = f[1].replace('k', k);
          var sim = function () { var i = 0, n = 0; for (;;) { n++; var c = f[1] === 'i ≥ k' ? i >= k : f[1] === 'i + 1 ≥ k' ? i + 1 >= k : f[1] === 'i < k' ? i < k : i + 1 < k; var stop = f[0] === 'Stop if True' ? c : !c; if (stop) return n; i++; } };
          var n = sim();
          return { q: 'While Loop 的條件端子設成 <b>' + f[0] + '</b>，接到 <code>' + cond + '</code>（i 是迴圈計數）。迴圈總共跑幾圈？', ans: n + ' 圈', wrong: [(n - 1) + ' 圈', (n + 1) + ' 圈', k + 2 + ' 圈', '停不下來'],
            ex: '一圈一圈試：每圈做完才判斷，條件讓迴圈停下時已經跑了 ' + n + ' 圈（最後一圈 i = ' + (n - 1) + '）。', chk: function () { return sim() + ' 圈'; } }; },
        function () { var x = ri(1, 9), a = ri(2, 5);
          return { q: 'For Loop 的 N 接 0。Shift Register 初始值接 ' + x + '，迴圈裡每圈加 ' + a + '；另外 i 接到一個「最後值」輸出通道。迴圈外 Shift Register 的值和 i 的值分別是？', ans: x + ' 和 0', wrong: [(x + a) + ' 和 0', x + ' 和 -1', '0 和 0', (x + a) + ' 和 1'],
            ex: 'N = 0 一圈都不跑：Shift Register 直接把初始值 ' + x + ' 送出去；最後值通道沒有任何一圈的值，送出 I32 的預設值 0。', chk: function () { var sr = x, last = 0; for (var i = 0; i < 0; i++) { sr += a; last = i; } return sr + ' 和 ' + last; } }; },
        function () { var n = ri(3, 8);
          return { q: 'For Loop N = ' + n + '，Shift Register 初始值 0，每圈把 i 加進去（sr + i）。迴圈結束後 Shift Register 的值？', ans: String(n * (n - 1) / 2), wrong: [String(n * (n + 1) / 2), String(n), String(n - 1), String(n * n)],
            ex: 'i 是 0、1、…、' + (n - 1) + '，加起來 = ' + n * (n - 1) / 2 + '。i 從 0 開始，最後一圈是 N − 1。', chk: function () { var s = 0; for (var i = 0; i < n; i++) s += i; return String(s); } }; }] },
    { id: 'sr', name: 'Shift Register 跑兩次以上', topic: 'fun', pts: ['f2'],
      how: '先看 Shift Register 左邊外面有沒有接初始值。有接：每次按 Run 都從初始值開始。沒接：第一次從預設值（數值 0、空陣列）開始，之後每次 Run 接著上次留下的值（VI 沒關、沒重新編譯時）。這就是 FGV 能記住資料的原因。',
      rec: [lab('lab-loop.html', 'sr', 'Shift Register'), les('L05'), lab('lab-var.html', 'fgv', 'FGV')],
      gens: [
        function () { var n = ri(2, 5), a = ri(2, 6), r = ri(2, 4), init = Math.random() < 0.5, c = ri(1, 9);
          var sim = function () { var mem = 0, out = 0; for (var run = 0; run < r; run++) { var sr = init ? c : mem; for (var i = 0; i < n; i++) sr += a; mem = sr; out = sr; } return String(out); };
          var v = sim();
          return { q: 'For Loop N = ' + n + '，每圈 Shift Register 加 ' + a + '。Shift Register ' + (init ? '左邊接了初始值 ' + c : '<b>沒有</b>接初始值') + '。VI 開著不關，連按 Run ' + r + ' 次，第 ' + r + ' 次結束時迴圈外顯示多少？', ans: v,
            wrong: [String(init ? r * n * a : n * a), String(init ? c + n * a * r : (r - 1) * n * a), String(n * a + (init ? 0 : c)), String((init ? c : 0) + (n - 1) * a), String(Number(v) + n * a), String(Number(v) + a), '0'],
            ex: init ? '有接初始值，每次 Run 都從 ' + c + ' 重新開始：' + c + ' + ' + n + ' × ' + a + ' = ' + v + '。' : '沒接初始值，每次 Run 接著上一次的值：' + r + ' 次 × ' + n + ' 圈 × ' + a + ' = ' + v + '。',
            chk: sim }; },
        function () { var n = ri(2, 4), r = ri(2, 3);
          var sim = function () { var mem = []; for (var run = 0; run < r; run++) { var sr = mem.slice(); for (var i = 0; i < n; i++) sr.push(i); mem = sr; } return mem.length + ' 個元素'; };
          return { q: 'For Loop N = ' + n + '，Shift Register（沒接初始值）裝 1D 陣列，每圈用 Build Array 把 i 接到後面。VI 開著連按 Run ' + r + ' 次，最後陣列有幾個元素？', ans: sim(), wrong: [n + ' 個元素', (n * r - 1) + ' 個元素', (n + r) + ' 個元素', '0 個元素'],
            ex: '陣列一路累積：每次 Run 多 ' + n + ' 個，' + r + ' 次 = ' + n * r + ' 個。要每次重來，就在左邊接一個空陣列常數。', chk: sim }; },
        function () { var a = ri(2, 5), b = ri(2, 5);
          return { q: '一個 FGV（While Loop 只跑一圈、Shift Register 沒接初始值）有 Reset 和 Add 兩個動作。主程式依序呼叫：Reset、Add ' + a + '、Add ' + b + '、Add ' + a + '。最後讀出的值？', ans: String(2 * a + b), wrong: [String(a), String(a + b), String(2 * a + 2 * b), '0'],
            ex: 'FGV 靠沒初始化的 Shift Register 記住上一次呼叫的值：Reset 歸 0，之後一路加 = ' + (2 * a + b) + '。', chk: function () { var m = 0; m = 0; m += a; m += b; m += a; return String(m); } }; }] },
    { id: 'case', name: 'Case 選擇器走哪一頁', topic: 'fun', pts: ['f4'],
      how: '小數接到 Case：選擇器上會出現強制轉換點，先捨入成整數，而且是四捨六入五成雙（2.5 → 2、3.5 → 4，NI KB 的捨入規則）。NI 建議選擇器用整數、布林或 Enum，不要直接接 DBL。範圍「a..b」兩端都包含；「..0」是 0 以下。字串要完全一樣，預設分大小寫、空白也算。都對不到就走 Default；沒有 Default 又沒列完所有值，箭頭會斷。',
      rec: [lab('lab-struct.html', 'case', 'Case 走哪一頁'), lab('lab-numeric.html', 'round', '捨入函式'), les('C04')],
      gens: [
        function () { var v = p1([0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 2.4, 3.6, 1.2]);
          var pg = function () { var r = rhe(v); return r === 2 ? '2' : r === 4 ? '4' : '0, Default'; };
          return { q: 'Case 結構的頁籤是 <code>0, Default</code>、<code>2</code>、<code>4</code>。選擇器接一個 DBL 數值 <b>' + v + '</b>，執行哪一頁？', ans: pg(), wrong: ['2', '4', '0, Default', '斷箭頭，不能執行', '3'],
            ex: v + ' 先捨入成 ' + rhe(v) + '（四捨六入五成雙）' + (pg() === '0, Default' ? '，沒有對應的頁就走 Default' : '') + '。', chk: pg }; },
        function () { var v = ri(-2, 11);
          var pg = function () { return v <= 0 ? '..0' : v <= 4 ? '1..4' : v <= 8 ? '5..8' : 'Default'; };
          return { q: '整數選擇器的 Case 頁籤是 <code>..0</code>、<code>1..4</code>、<code>5..8</code>、<code>Default</code>。輸入 <b>' + v + '</b> 執行哪一頁？', ans: pg(), wrong: ['..0', '1..4', '5..8', 'Default'],
            ex: '範圍兩端都包含：..0 是 0 以下、1..4、5..8，其他走 Default。' + v + ' → ' + pg() + '。', chk: pg }; },
        function () { var s = p1(['Stop', 'stop', 'STOP', 'Stop ']);
          return { q: '字串選擇器的 Case 頁籤只有 <code>"Stop"</code> 和 <code>Default</code>（沒有改設定）。輸入 <code>"' + esc(s) + '"</code>（引號裡的內容）執行哪一頁？', ans: s === 'Stop' ? '"Stop"' : 'Default', wrong: [s === 'Stop' ? 'Default' : '"Stop"', '兩頁都執行', '斷箭頭', '跳出錯誤'],
            ex: s === 'Stop' ? '完全一樣才對到 "Stop"。' : '字串比對要一模一樣，預設分大小寫、多一個空白也不一樣，所以走 Default。Case 右鍵有 Case Insensitive Match 可以改成不分大小寫。', chk: function () { return s === 'Stop' ? '"Stop"' : 'Default'; } }; }] },
    { id: 'event', name: 'Event Structure：次數與 Timeout', topic: 'env', pts: ['e7'],
      how: 'Event Structure 每圈只處理一個事件，處理完回去等下一個。Timeout 接 -1（或不接）就一直等；接 t 毫秒，t 毫秒內沒事件就執行 Timeout 頁一次。按鈕的 Value Change：Latch 按一下算一次；Switch 每切一次都算（True→False 也算）。要「啟動後定時、停止後不再定時」，就把 timeout 值放進 Shift Register，由事件頁改它。',
      rec: [lab('lab-struct.html', 'event', 'Event 事件排隊'), lab('lab-bool.html', 'mech', '按鈕機械動作'), les('C04')],
      gens: [
        function () { var t = p1([250, 400, 500, 1000]), T = p1([1.3, 2.2, 3.1, 4.6]);
          var f = function () { var n = 0, clock = 0; while (clock + t <= T * 1000 + 1e-6) { clock += t; n++; } return n + ' 次'; };
          return { q: 'While Loop 裡的 Event Structure，Timeout 接 ' + t + ' ms。執行後使用者 ' + T + ' 秒內完全沒有操作。Timeout 頁執行了幾次？（處理時間忽略不計）', ans: f(), wrong: [Math.ceil(T * 1000 / t) + 1 + ' 次', '0 次', '1 次', Math.floor(T * 1000 / t) - 1 + ' 次', Math.floor(T * 1000 / t) + 1 + ' 次', Math.round(T) + ' 次', '一直執行，停不下來'],
            ex: '每等滿 ' + t + ' ms 沒事件就執行一次 Timeout 頁，然後重新等：' + T * 1000 + ' ÷ ' + t + ' 取整數 = ' + f() + '。', chk: f }; },
        function () { var k = ri(3, 8), onlyT = Math.random() < 0.5;
          var f = function () { var v = false, n = 0; for (var i = 0; i < k; i++) { v = !v; if (!onlyT || v) n++; } return n + ' 次'; };
          return { q: '按鈕的機械動作是 <b>Switch When Pressed</b>，一開始是 False。使用者按了 ' + k + ' 次（每按一次切換一次）。Value Change 事件頁裡' + (onlyT ? '只有 NewVal 是 True 時才把計數加 1' : '每次都把計數加 1') + '，最後計數是？', ans: f(), wrong: [k + ' 次', Math.ceil(k / 2) + ' 次', Math.floor(k / 2) + ' 次', (k * 2) + ' 次', '1 次'],
            ex: 'Switch 每切一次值就變一次，每次都觸發 Value Change（' + k + ' 次）。' + (onlyT ? '其中變成 True 的是第 1、3、5…次，共 ' + f() + '。' : ''), chk: f }; },
        function () { var ms = p1([200, 500, 1000]);
          return { q: '要做：按 <b>Enable</b> 之後指示燈每 ' + ms + ' ms 閃一次，按 <b>Disable</b> 之後不再閃。閃爍寫在 Timeout 頁，Timeout 端子接 Shift Register。Enable、Disable 兩個事件頁分別把 Shift Register 改成？', ans: 'Enable 頁 ' + ms + '、Disable 頁 -1', wrong: ['Enable 頁 ' + ms / 1000 + '、Disable 頁 -1', 'Enable 頁 ' + ms + '、Disable 頁 0', 'Enable 頁 -1、Disable 頁 ' + ms, '兩頁都 ' + ms],
            ex: 'Timeout 的單位是毫秒。-1 是永遠等（不再執行 Timeout 頁）；0 是完全不等，Timeout 頁會一直狂跑。' }; }] },
    { id: 'err', name: '錯誤叢集：傳遞、停止、重試', topic: 'env', pts: ['e11'],
      how: '錯誤線上有錯（status = True）時，NI 內建的函式大多不做事、把錯誤往下傳；自己寫的 SubVI 不會自動跳過，要在裡面用 Case 結構接 error in 自己做；Close、Release 這類收尾函式照樣執行。迴圈的條件端子接錯誤線（Stop if True 看 status），出錯的那一圈做完就停。Merge Errors 回傳第一個錯誤，沒有錯誤才回傳第一個警告。重試：清掉錯誤、再試，最多幾次就停。',
      rec: [lab('lab-cluster.html', 'err', '錯誤叢集的流動'), lab('lab-cluster.html', 'mrg', 'Merge Errors'), les('C10'), les('L11')],
      gens: [
        function () { var n = ri(5, 9), k = ri(2, n - 1), askI = Math.random() < 0.5;
          var sim = function () { var calls = 0, lastI = 0; for (var i = 0; i < n; i++) { calls++; lastI = i; if (calls === k) break; } return askI ? 'i = ' + lastI : calls + ' 次'; };
          return { q: 'For Loop N = ' + n + '，啟用條件端子（Stop if True），接 SubVI 的 error out。SubVI 在第 ' + k + ' 次呼叫時出錯。迴圈結束後' + (askI ? '「最後值」通道送出的 i 是多少？' : 'SubVI 一共被呼叫幾次？'), ans: sim(),
            wrong: askI ? ['i = ' + k, 'i = ' + (k - 2), 'i = ' + (n - 1), 'i = ' + n, 'i = ' + (k + 1)] : [(k - 1) + ' 次', (k + 1) + ' 次', n + ' 次', (n - 1) + ' 次', (k + 2) + ' 次', '0 次'],
            ex: '出錯的那一圈（第 ' + k + ' 次，i = ' + (k - 1) + '）做完才看條件端子，接著停。i 從 0 算，所以是 ' + (k - 1) + '；呼叫了 ' + k + ' 次。', chk: sim }; },
        function () { return { q: 'error in 帶著一個錯誤（status = True）傳進來。下面哪一個仍然會做它的工作？', ans: 'Close File：照樣把檔案關掉', wrong: ['Write to Text File：照樣寫入', 'Open/Create/Replace File：照樣開檔', 'Read from Text File：照樣讀', 'Enqueue Element：照樣放進佇列'],
          ex: '一般函式看到 error in 有錯就跳過；關閉、釋放類（Close File、Release Queue、VISA Close）照樣執行，避免資源一直被占用。' }; },
        function () { var c = p1([['無錯誤', '警告 ' + ri(1, 9) * 1000 + 1, '錯誤 ' + p1([7, 43, 56])], ['錯誤 ' + p1([7, 10]), '無錯誤', '錯誤 ' + p1([43, 56])], ['警告 ' + p1([1, 2]), '無錯誤', '無錯誤'], ['無錯誤', '無錯誤', '無錯誤']]);
          var f = function () { var e = c.filter(function (x) { return x.indexOf('錯誤 ') === 0; })[0]; if (e) return e; var w = c.filter(function (x) { return x.indexOf('警告') === 0; })[0]; return w || '無錯誤'; };
          return { q: 'Merge Errors 的三個輸入依序是：<b>' + c.join('、') + '</b>。輸出是？', ans: f(), wrong: c.concat(['無錯誤', '錯誤 1', '三個合在一起的錯誤', '最後一個輸入原樣輸出']), ex: 'Merge Errors 從上往下找第一個錯誤；都沒有錯誤才找第一個警告；都沒有就是無錯誤。', chk: f }; }] },
    { id: 'file', name: '檔案 I/O 會怎樣', topic: 'fun', pts: ['f9', 'f10'],
      how: '先看路徑有沒有接：沒接會跳檔案對話框，按取消是錯誤 43。再看開檔方式：單獨 open 或 replace，檔案不存在會出錯（找不到檔案是錯誤 7；所以才有 replace or create 這個選項）；單獨 create，檔案已經在是錯誤 10；有 replace 的會把舊內容清空；with confirmation 會先問。標準寫法是迴圈外開、迴圈內寫、迴圈外關。',
      rec: [lab('lab-file.html', 'open', '開檔方式'), lab('lab-file.html', 'mark', '檔案指標'), les('F04'), les('C17')],
      gens: [
        function () { var op = p1(['open', 'replace', 'create', 'open or create', 'replace or create']), ex = Math.random() < 0.5;
          var f = function () { if (op === 'open') return ex ? '打開，內容保留' : '錯誤 7'; if (op === 'replace') return ex ? '清空後打開' : '錯誤 7'; if (op === 'create') return ex ? '錯誤 10' : '建立新的空檔'; if (op === 'open or create') return ex ? '打開，內容保留' : '建立新的空檔'; return ex ? '清空後打開' : '建立新的空檔'; };
          return { q: 'Open/Create/Replace File 的 operation 選 <b>' + op + '</b>，檔案' + (ex ? '<b>已經存在</b>' : '<b>不存在</b>') + '。結果？', ans: f(), wrong: ['打開，內容保留', '清空後打開', '建立新的空檔', '錯誤 7', '錯誤 10', '跳出對話框問要不要取代'],
            ex: '有 create 的沒檔就建；有 replace 的有檔就清空；單獨 open、replace 沒檔是錯誤 7；單獨 create 有檔是錯誤 10。', chk: f }; },
        function () { var cancel = Math.random() < 0.5;
          return { q: 'Write to Text File 的 file 端子<b>沒接</b>，執行時' + (cancel ? '跳出對話框，使用者按了<b>取消</b>。error out 是？' : '會發生什麼事？'), ans: cancel ? '錯誤 43' : '跳出檔案對話框讓使用者選位置', wrong: cancel ? ['錯誤 7', '沒有錯誤', '錯誤 8', '錯誤 10'] : ['錯誤 7：找不到檔案', '寫到 LabVIEW 預設資料夾', '什麼都不做', '寫到 VI 所在的資料夾'],
            ex: '檔案函式的路徑沒接就用對話框問（端子名稱寫著 use dialog）。使用者取消是錯誤 43，要判斷後跳過寫入。' }; },
        function () { var s = p1([['報表要讓辦公室的人用 Excel 直接打開', 'CSV（逗號分隔的文字檔）'], ['多通道高速擷取，每個通道還要存名稱、單位等屬性，之後用 LabVIEW 或 DIAdem 分析', 'TDMS'], ['給人看、用記事本也能改的設定或紀錄', '文字檔']]);
          return { q: '「' + s[0] + '」最適合存成？', ans: s[1], wrong: ['CSV（逗號分隔的文字檔）', 'TDMS', '文字檔', '二進位檔（自己定格式）'], ex: 'CSV 是文字，Excel 直接開；TDMS 是 NI 的量測格式，適合大量資料並帶屬性；文字檔人看得懂。' }; }] },
    { id: 'str', name: '字串與格式碼', topic: 'fun', pts: ['f8'],
      how: '把格式碼拆開一個一個套：%d 整數、%f 小數（%.2f 兩位）、%s 字串、%05d 至少 5 格左邊補 0。格式碼以外的字照抄。Format Into String 不會改到原本的數值。解析逗號分隔的回應，用 Spreadsheet String To Array，delimiter 接逗號，format 決定元素型別。',
      rec: [lab('lab-string.html', 'fmt', '格式碼'), lab('lab-string.html', 'fn', '切、接、找、換'), les('F05')],
      gens: [
        function () { var n = ri(7, 9999);
          return { q: 'Format Into String 的 format string 是 <code>ID%05d</code>，輸入整數 ' + n + '。結果字串？', ans: 'ID' + pad(n, 5), wrong: ['ID' + n, 'ID' + n + '00000'.slice(String(n).length), 'ID    '.slice(0, 7 - String(n).length) + n, 'ID%05d'],
            ex: '%05d：至少 5 格寬、左邊補 0。', chk: function () { return 'ID' + pad(n, 5); } }; },
        function () { var p = p1([12.5, 7, 199.9, 3.05, 48.1, 250]);
          return { q: '價格存成 DBL ' + p + '。要顯示成「$金額，兩位小數」，format string 用 <code>$%.2f</code>。結果字串？原本的 DBL 會變嗎？', ans: '$' + p.toFixed(2) + '，DBL 不變', wrong: ['$' + p + '，DBL 不變', '$' + p.toFixed(2) + '，DBL 也變成兩位小數', '$%.2f，DBL 不變', p.toFixed(2) + '$，DBL 不變'],
            ex: '%.2f 固定兩位小數，前面的 $ 照抄。Format Into String 只產生新字串，原本的數值不受影響。', chk: function () { return '$' + p.toFixed(2) + '，DBL 不變'; } }; },
        function () { var a = []; for (var i = 0, n = ri(3, 5); i < n; i++) a.push(ri(1, 99));
          var s = a.join(',');
          return { q: '儀器回應字串 <code>' + s + '</code>。用 Spreadsheet String To Array，delimiter 接 <code>,</code>，format 接 <code>%d</code>，array type 接 1D I32。輸出陣列？', ans: arrStr(a), wrong: [arrStr([Number(a.join(''))]), arrStr(a.slice().reverse()), arrStr(a.slice(0, -1)), arrStr([a.reduce(function (x, y) { return x + y; }, 0)])],
            ex: '以逗號切開，每段用 %d 轉成整數，依序放進陣列。', chk: function () { return arrStr(s.split(',').map(Number)); } }; }] },
    { id: 'time', name: '時間與計時', topic: 'fun', pts: ['f5'],
      how: '耗時用 Tick Count 前後相減（單位 ms，是 U32，繞回也照樣相減得對）；時間戳跟著電腦時鐘走。定時取樣算圈數：總時間 ÷ 每圈時間。Format Date/Time String 的格式碼：%Y 四位年、%m 月、%d 日、%H 24 小時、%I 12 小時、%M 分、%S 秒，都補成兩位。',
      rec: [lab('lab-time.html', 'wrap', 'Tick Count 繞回'), lab('lab-time.html', 'stamp', '時間戳與格式碼'), lab('lab-loop.html', 'wait', 'Wait 與節拍器')],
      gens: [
        function () { var m = p1([5, 10, 15, 20, 30]), h = p1([1, 2, 6, 12, 24]);
          return { q: '每 ' + m + ' 分鐘記一筆溫度，要記滿 ' + h + ' 小時。迴圈每圈記一筆、等 ' + m + ' 分鐘，總共要跑幾圈？', ans: String(h * 60 / m), wrong: [String(h * m), String(h * 60), String(h * 60 / m + 1), String(Math.round(h * 3600 / m))],
            ex: h + ' 小時 = ' + h * 60 + ' 分鐘，÷ ' + m + ' = ' + h * 60 / m + ' 圈。', chk: function () { var n = 0, t = 0; while (t < h * 60) { n++; t += m; } return String(n); } }; },
        function () { var x = ri(100, 900), y = ri(100, 900), t1 = 4294967296 - x;
          return { q: 'Tick Count (ms) 開始時讀到 ' + t1 + '，結束時讀到 ' + y + '。兩個都是 U32，用 Subtract（結束 − 開始），結果是？', ans: (x + y) + ' ms', wrong: [(y - t1) + ' ms', (t1 - y) + ' ms', y + ' ms', '錯誤：負數'],
            ex: 'U32 相減會繞回：' + y + ' − ' + t1 + ' 在 U32 裡等於 ' + (x + y) + '，就是真正經過的毫秒數。', chk: function () { return (((y - t1) % 4294967296 + 4294967296) % 4294967296) + ' ms'; } }; },
        function () { var Y = ri(2020, 2027), M = ri(1, 12), D = ri(1, 28), H = ri(0, 23), Mi = ri(0, 59), S = ri(0, 59);
          var f = function () { return Y + '-' + pad(M, 2) + '-' + pad(D, 2) + ' ' + pad(H, 2) + ':' + pad(Mi, 2) + ':' + pad(S, 2); };
          return { q: '時間是 ' + Y + ' 年 ' + M + ' 月 ' + D + ' 日 ' + H + ' 點 ' + Mi + ' 分 ' + S + ' 秒。Format Date/Time String 用 <code>%Y-%m-%d %H:%M:%S</code>，結果？', ans: f(),
            wrong: [Y + '-' + M + '-' + D + ' ' + H + ':' + Mi + ':' + S, Y + '-' + pad(D, 2) + '-' + pad(M, 2) + ' ' + pad(H, 2) + ':' + pad(Mi, 2) + ':' + pad(S, 2), String(Y).slice(2) + '-' + pad(M, 2) + '-' + pad(D, 2) + ' ' + pad(H, 2) + ':' + pad(Mi, 2) + ':' + pad(S, 2), Y + '-' + pad(M, 2) + '-' + pad(D, 2) + ' ' + pad(H % 12 || 12, 2) + ':' + pad(Mi, 2) + ':' + pad(S, 2), Y + '/' + pad(M, 2) + '/' + pad(D, 2) + ' ' + pad(H, 2) + ':' + pad(Mi, 2) + ':' + pad(S, 2), Y + '-' + pad(M, 2) + '-' + pad(D, 2) + ' ' + pad(H, 2) + ':' + pad(Mi, 2)],
            ex: '%m、%d、%H、%M、%S 都補成兩位；%Y 是四位年；%H 是 24 小時制。', chk: f }; }] },
    { id: 'daq', name: 'DAQ：取樣、緩衝、通道', topic: 'hw', pts: ['hw2', 'hw5', 'hw6'],
      how: '連續擷取：每圈讀 S 點、取樣率 R，迴圈大約 S ÷ R 秒一圈；讀得比進來慢就會溢位。奈奎斯特：取樣率要大於訊號最高頻率的 2 倍。多通道讀成 2D 陣列時一列一個通道，第 N 個通道的索引是 N − 1。',
      rec: [lab('lab-daq.html', 'buf', 'DAQmx 流程與緩衝區'), lab('lab-daq.html', 'rate', '取樣率與混疊'), les('C12'), les('C13')],
      gens: [
        function () { var R = p1([1000, 2000, 5000, 10000]), want = p1([0.1, 0.2, 0.5, 1]);
          var f = function () { return Math.round(R * want) + ' 點'; };
          return { q: 'DAQmx 連續擷取，取樣率 ' + R + ' S/s。希望迴圈大約每 ' + want + ' 秒讀一次、每次把緩衝區新進來的資料讀光，DAQmx Read 的 number of samples per channel 接多少？', ans: f(), wrong: [Math.round(R / want) + ' 點', R + ' 點', Math.round(want * 1000) + ' 點', '-1（全部）', Math.round(R * want * 2) + ' 點', Math.round(R * want / 2) + ' 點'],
            ex: '每秒進來 ' + R + ' 點，' + want + ' 秒就是 ' + R * want + ' 點。', chk: f }; },
        function () { var f0 = p1([60, 120, 250, 1000, 2500]);
          return { q: '要量的訊號最高頻率是 ' + f0 + ' Hz。依奈奎斯特定理，取樣率至少要大於多少才量得出正確的頻率？', ans: 2 * f0 + ' Hz', wrong: [f0 + ' Hz', 4 * f0 + ' Hz', f0 / 2 + ' Hz', 10 * f0 + ' Hz'], ex: '取樣率要大於最高頻率的 2 倍；要看清楚形狀，實務上取更高。', chk: function () { return 2 * f0 + ' Hz'; } }; },
        function () { var n = ri(2, 8);
          return { q: '一個 8 通道熱電偶模組，通道 ai0～ai7 全部加進同一個任務，讀成 2D 陣列（一列一個通道）。要第 ' + n + ' 個熱電偶，Index Array 的 row index 接多少？它是哪個實體通道？', ans: 'row ' + (n - 1) + '，ai' + (n - 1), wrong: ['row ' + n + '，ai' + n, 'row ' + (n - 1) + '，ai' + n, 'row ' + n + '，ai' + (n - 1), 'column ' + (n - 1) + '，ai' + (n - 1)],
            ex: '索引和通道編號都從 0 開始：第 ' + n + ' 個是 ai' + (n - 1) + '、row ' + (n - 1) + '。', chk: function () { var ch = []; for (var i = 0; i < 8; i++) ch.push('ai' + i); return 'row ' + (n - 1) + '，' + ch[n - 1]; } }; }] },
    { id: 'arr', name: '陣列函式的輸出', topic: 'fun', pts: ['f6'],
      how: '每個陣列函式記三件事：索引從 0 算、超出範圍會怎樣、輸出是什麼型別。Search 1D Array 找不到回傳 -1；Array Subset 長度超過就截到尾；Max & Min 有多個最大值時回傳第一個的索引；Delete From Array 回傳刪掉後的陣列和被刪的部分；Index Array 索引小於 0 或超出範圍（包括空陣列）回傳該型別的預設值，不會出錯。',
      rec: [lab('lab-array.html', '', '陣列實驗室'), les('C05'), les('L07')],
      gens: [
        function () { var a = []; for (var i = 0; i < 6; i++) a.push(ri(1, 9)); var v = Math.random() < 0.7 ? p1(a) : 0;
          return { q: '陣列 <code>' + arrStr(a) + '</code> 接到 Search 1D Array，element 是 ' + v + '，start index 不接。輸出 index of element？', ans: String(a.indexOf(v)), wrong: [String(a.indexOf(v) + 1), String(a.lastIndexOf(v) === a.indexOf(v) ? a.length : a.lastIndexOf(v)), '0', '-1', String(a.length), String(a.length - 1), 'NaN（找不到時沒有輸出）'],
            ex: v === 0 || a.indexOf(v) < 0 ? '找不到回傳 -1。' : '從索引 0 開始找，回傳第一個符合的位置。', chk: function () { for (var i = 0; i < a.length; i++) if (a[i] === v) return String(i); return '-1'; } }; },
        function () { var a = []; for (var i = 0; i < 7; i++) a.push(ri(10, 99)); var idx = ri(1, 5), len = ri(2, 5);
          return { q: '陣列 <code>' + arrStr(a) + '</code> 接到 Array Subset，index = ' + idx + '，length = ' + len + '。輸出？', ans: arrStr(a.slice(idx, idx + len)), wrong: [arrStr(a.slice(idx - 1, idx - 1 + len)), arrStr(a.slice(idx, idx + len - 1)), arrStr(a.slice(idx + 1, idx + 1 + len)), arrStr(a.slice(0, len))],
            ex: '從索引 ' + idx + '（第 ' + (idx + 1) + ' 個）開始取 ' + len + ' 個；超過尾端就取到最後。', chk: function () { var o = []; for (var i = idx; i < idx + len && i < a.length; i++) o.push(a[i]); return arrStr(o); } }; },
        function () { var a = []; for (var i = 0; i < 6; i++) a.push(ri(1, 9)); var mx = Math.max.apply(null, a); a[ri(0, 5)] = mx;
          return { q: '陣列 <code>' + arrStr(a) + '</code> 接到 Array Max & Min。max value 和 max index 是？', ans: mx + '，索引 ' + a.indexOf(mx), wrong: [mx + '，索引 ' + (a.indexOf(mx) + 1), mx + '，索引 ' + a.lastIndexOf(mx), Math.min.apply(null, a) + '，索引 ' + a.indexOf(Math.min.apply(null, a)), mx + '，索引 ' + a.length, mx + '，索引 -1', (a.indexOf(mx) + 1) + '，索引 ' + mx],
            ex: '最大值有好幾個時，max index 是第一個出現的位置。', chk: function () { var bi = 0; for (var i = 1; i < a.length; i++) if (a[i] > a[bi]) bi = i; return a[bi] + '，索引 ' + bi; } }; }] },
    { id: 'type', name: '資料型別選擇與轉換', topic: 'env', pts: ['e2', 'e3', 'e4'],
      how: '先問：要不要小數、會不會負數、範圍多大，再挑放得下的最小整數型別（U8 0～255、I8 -128～127、U16 0～65535、I16 -32768～32767）。整數運算超出範圍會繞回；浮點數轉整數會先四捨六入五成雙，超出範圍就夾在最大或最小值。',
      rec: [lab('lab-numeric.html', 'ovf', '溢位與轉換'), lab('lab-numeric.html', 'round', '捨入函式'), les('C02')],
      gens: [
        function () { var a = ri(240, 255), b = ri(262 - a, 40);
          return { q: '兩個 <b>U8</b> 數值 ' + a + ' 和 ' + b + ' 接到 Add，輸出也是 U8。結果？', ans: String((a + b) % 256), wrong: [String(a + b), '255', '0', String(a + b - 255), String(a)], ex: 'U8 最大 255，超過就從 0 繞回：(' + a + ' + ' + b + ') − 256 = ' + (a + b) % 256 + '。', chk: function () { return String((a + b) & 255); } }; },
        function () { var v = p1([300.2, -5.7, 12.5, 13.5, 254.5, 99.49]);
          var f = function () { return String(Math.max(0, Math.min(255, rhe(v)))); };
          return { q: 'DBL ' + v + ' 接到 To Unsigned Byte Integer（U8）。結果？', ans: f(), wrong: [String(Math.round(v)), String(Math.floor(v)), String(((Math.round(v) % 256) + 256) % 256), String(Math.ceil(v)), '0', '255', String(Math.trunc(v)), '錯誤：超出範圍'],
            ex: '浮點轉整數：先四捨六入五成雙，超出 0～255 就夾住（不是繞回）。', chk: f }; },
        function () { var s = p1([[-40, 125, '環境溫度（整數度）'], [0, 200, '料盒數量'], [-500, 500, '馬達位置（整數格）'], [0, 4000, '轉速 rpm（整數）'], [-90, 90, '角度（整數度）']]);
          var f = function () { var T = [['U8', 0, 255], ['I8', -128, 127], ['U16', 0, 65535], ['I16', -32768, 32767]]; for (var i = 0; i < T.length; i++) if (s[0] >= T[i][1] && s[1] <= T[i][2]) return T[i][0]; return 'I32'; };
          return { q: '「' + s[2] + '」範圍 ' + s[0] + '～' + s[1] + '，只要整數。放得下而且最省記憶體的型別是？', ans: f(), wrong: ['U8', 'I8', 'U16', 'I16', 'DBL'], ex: 'U8 0～255、I8 -128～127、U16 0～65535、I16 -32768～32767。有負數就要 I 開頭。', chk: f }; }] },
    { id: 'exec', name: '執行順序與平行迴圈', topic: 'env', pts: ['e5', 'e8', 'e9'],
      how: '畫出「誰在等誰的線」：節點要所有輸入到齊才執行；迴圈的輸出通道要等迴圈結束才送值，所以下游的迴圈要等。沒有連線的兩個迴圈同時跑。迴圈裡有 Wait 時，一圈的時間由最慢的那件事決定；按 Stop 之後，這一圈還要跑完，下一圈讀到 Stop 也要跑完才停。',
      rec: [lab('lab-flow.html', 'par', '平行與順序'), lab('lab-flow.html', 'loop', '迴圈的邊界'), lab('lab-var.html', 'stop', '一顆 Stop 停兩個迴圈')],
      gens: [
        function () { var wired = Math.random() < 0.5;
          return { q: '方塊圖上有兩個 While Loop。' + (wired ? '迴圈 1 的輸出通道有一條線接進迴圈 2 的輸入通道。' : '兩個迴圈之間沒有任何線，各自有自己的 Stop 按鈕。') + '執行時會怎樣？', ans: wired ? '迴圈 2 要等迴圈 1 停止後才開始' : '兩個迴圈同時執行', wrong: ['迴圈 2 要等迴圈 1 停止後才開始', '兩個迴圈同時執行', '迴圈 1 要等迴圈 2 停止後才開始', '兩個迴圈互相等待，永遠不執行'],
            ex: wired ? '迴圈 2 的輸入通道要有值才能開始，而迴圈 1 的輸出通道要等它結束才送值。' : '沒有資料相依就沒有先後，兩個迴圈平行執行。' }; },
        function () { var W = p1([1, 2, 3]);
          return { q: 'While Loop 裡有 Wait (ms) 接 ' + W * 1000 + '，Stop 按鈕的端子直接接條件端子（Stop if True），兩者之間沒有線。按下 Stop 之後，迴圈最慢大約多久會停？', ans: '約 ' + 2 * W + ' 秒', wrong: ['約 ' + W + ' 秒', '立刻停', '約 ' + W / 2 + ' 秒', '約 ' + 3 * W + ' 秒'],
            ex: 'Stop 端子在一圈開始時就被讀了。剛讀完才按：這一圈還要等完 ' + W + ' 秒，下一圈讀到 True，但這一圈的 Wait 也要等完 ' + W + ' 秒才結束，最多約 ' + 2 * W + ' 秒。', chk: function () { return '約 ' + 2 * W + ' 秒'; } }; },
        function () { var act = p1([['Switch When Released', '放開之後才變 True'], ['Switch When Pressed', '按下的瞬間就變 True'], ['Latch When Pressed', '按下時變 True，被程式讀一次後自動回 False']]);
          return { q: '按鈕的機械動作是 <b>' + act[0] + '</b>。使用者按住它 3 秒都沒放。這 3 秒內程式讀到的值是？', ans: act[0] === 'Switch When Released' ? '一直是 False' : act[0] === 'Switch When Pressed' ? '一直是 True' : '讀到一次 True，之後都是 False',
            wrong: ['一直是 False', '一直是 True', '讀到一次 True，之後都是 False', 'True 和 False 交替'], ex: act[0] + '：' + act[1] + '。' }; }] },
    { id: 'subvi', name: '最佳實踐：SubVI、Cluster、Type Def', topic: 'bp', pts: ['b1', 'b2', 'b3', 'b4', 'b5'],
      how: 'Create SubVI 會自動：把選取範圍換成 SubVI、為跨過邊界的線建立控制項和指示器、配好接線端並連好。不會自動：把輸入設成 Required、畫有意義的圖示、取好檔名。接線端照 4-2-2-4：輸入左、輸出右、error in 左下、error out 右下（NI 說明原文）；參照放上面兩角是 NI 風格慣例；Required 沒接箭頭會斷。Cluster 線分叉就是兩份資料，Bundle By Name 只改自己那一份。Type Def 改 .ctl 並存檔，所有用到的地方一起更新。Waveform Graph 接 2D 陣列時，預設每一列是一條線；Waveform Chart 剛好相反，預設每一行是一條線。',
      rec: [lab('lab-subvi.html', 'conn', '接線端怎麼配'), lab('lab-subvi.html', 'req', 'Required／Recommended'), les('C07'), lab('lab-cluster.html', 'bun', 'Bundle／Unbundle'), lab('lab-cluster.html', 'td', 'Type Def'), les('C18')],
      gens: [
        function () { return { q: '選取一段程式碼按 Edit ▸ Create SubVI 之後，哪一件事<b>還要自己做</b>？', ans: '把必要的輸入設成 Required', wrong: ['為跨過選取框的線建立控制項和指示器', '把控制項、指示器接到接線端', '在原本的位置放上 SubVI 並接好線', '配一個有足夠端子的接線端'],
          ex: 'Create SubVI 會自動建控制項、配接線端、接好線、換上 SubVI；Required／Recommended 的設定、圖示和檔名要自己處理。' }; },
        function () { var w = p1([['error in', '左下角'], ['error out', '右下角'], ['參照輸入（例如 VISA resource name）', '左上角'], ['參照輸出（例如 VISA resource name out）', '右上角']]);
          return { q: '照 4-2-2-4 接線端的慣例，<b>' + w[0] + '</b> 放在哪裡？', ans: w[1], wrong: ['左下角', '右下角', '左上角', '右上角', '正中間'], ex: '輸入在左、輸出在右；參照線走上面兩角，錯誤線走下面兩角，串起來的 VI 線才會是直的。' }; },
        function () { var r = p1([['Required', '執行箭頭斷掉，不能執行'], ['Recommended', '可以執行，用那個輸入的預設值'], ['Optional', '可以執行，用那個輸入的預設值']]);
          return { q: 'SubVI 有一個輸入設成 <b>' + r[0] + '</b>，呼叫的地方沒有接線。結果？', ans: r[1], wrong: ['執行箭頭斷掉，不能執行', '可以執行，用那個輸入的預設值', '執行時跳出錯誤對話框', '可以執行，輸入是空的所以 SubVI 不執行'],
            ex: '只有 Required 沒接會讓箭頭斷掉；Recommended、Optional 沒接都用預設值，差別是 Context Help 怎麼顯示。' }; },
        function () { var a = ri(1, 9), b = ri(10, 99), v = ri(100, 200);
          return { q: 'Cluster 常數 {Count = ' + a + ', Limit = ' + b + '} 的線分成兩條。上面那條接 Bundle By Name 把 Count 改成 ' + v + '，接到指示器 A；下面那條直接接到指示器 B。指示器 B 的 Count 是？', ans: String(a), wrong: [String(v), String(b), '0', '看哪一條先執行'],
            ex: '線分叉時資料被複製成兩份，Bundle By Name 只改它那一份，B 還是原本的 ' + a + '。', chk: function () { var c = { Count: a, Limit: b }, up = Object.assign({}, c), down = Object.assign({}, c); up.Count = v; return String(down.Count); } }; },
        function () { var n = ri(2, 5);
          return { q: '一個 Type Def Cluster 用在 ' + n + ' 個 VI 裡。打開 .ctl 加了一個新元素並存檔，這 ' + n + ' 個 VI 裡的 Cluster 會？', ans: '全部自動多出新元素', wrong: ['都不會變，要一個一個改', '只有目前開著的會變', '全部箭頭斷掉', '只有第一個 VI 會變'],
            ex: 'Type Def 的意義就是「一處改、處處跟著改」。沒做成 Type Def 的 Cluster 常數就要一個一個改。' }; },
        function () { var r = ri(2, 5), c = ri(50, 500);
          return { q: '一個 ' + r + ' 列 × ' + c + ' 行的 2D DBL 陣列直接接到 Waveform Graph（沒有轉置）。畫出幾條線、每條幾個點？', ans: r + ' 條線、每條 ' + c + ' 點', wrong: [c + ' 條線、每條 ' + r + ' 點', '1 條線、' + r * c + ' 點', r + ' 條線、每條 ' + r + ' 點', '不能接，型別不符'],
            ex: 'Waveform Graph 接 2D 陣列時，預設一列是一條線（右鍵 Transpose Array 可改成一行一條）。小心：Waveform Chart 預設反過來，一行是一條線。', chk: function () { return r + ' 條線、每條 ' + c + ' 點'; } }; }] },
    { id: 'env', name: '環境、除錯與專案', topic: 'env', pts: ['e1', 'e10', 'e12'],
      how: '箭頭斷掉先開 Error List，從第一個錯誤點過去。找錯的值用 Probe 和 Breakpoint，看資料怎麼流用 Highlight Execution。專案檔只記路徑，在專案外搬檔案會找不到；同名 VI 從不同資料夾載入會交叉連結。看不懂端子先開 Context Help（Ctrl+H），粗體字是必要輸入。',
      rec: [lab('lab-debug.html', 'err', '斷掉的箭頭'), lab('lab-debug.html', 'probe', 'Probe 與單步'), lab('lab-project.html', 'pj', '專案是清單'), les('C01')],
      gens: [
        function () { var s = p1([['想知道某一條線在執行時的值，不想停下程式', 'Probe'], ['想讓程式執行到某個節點時停下來', 'Breakpoint'], ['想看資料一顆一顆沿著線流動', 'Highlight Execution'], ['箭頭斷掉，想知道哪裡出錯', 'Error List']]);
          return { q: '「' + s[0] + '」該用哪一個工具？', ans: s[1], wrong: ['Probe', 'Breakpoint', 'Highlight Execution', 'Error List', 'Clean Up Diagram'], ex: 'Probe 看值、Breakpoint 停下、Highlight Execution 看流動、Error List 列出斷箭頭的原因。' }; },
        function () { return { q: '在 Windows 檔案總管裡把專案中的 Sub.vi 搬到另一個資料夾，再打開專案。專案樹裡的 Sub.vi 會？', ans: '找不到檔案（顯示遺失），要在專案裡重新指定或從專案裡搬', wrong: ['自動跟著移動到新位置', '專案裡還有一份副本，照常使用', '檔案被專案刪除', '自動在原位置建一個新的空 VI'],
          ex: '.lvproj 只記錄檔案路徑，不存檔案本身。要搬檔案就在 Project Explorer 或 Files 頁裡搬。' }; },
        function () { return { q: 'Context Help 視窗裡，某個函式的端子名稱是<b>粗體</b>。代表？', ans: '必要輸入（Required），不接箭頭會斷', wrong: ['輸出端子', '已經接好的端子', '有預設值的選用輸入', '錯誤端子'], ex: 'Context Help 用粗體標 Required、一般字是 Recommended、灰字是 Optional。' }; }] }
  ];

  /* ======================================================================
     考試地圖畫面
     ====================================================================== */
  var mapState = store(KMAP, {});
  function allPoints(withExt) { var a = []; TOPICS.concat(withExt ? [EXT] : []).forEach(function (t) { t.pts.forEach(function (p) { a.push({ t: t, p: p }); }); }); return a; }
  function topicHtml(t) {
    var done = t.pts.filter(function (p) { return mapState[p.id]; }).length;
    var h = '<div class="topic' + (t.big ? ' big' : '') + (t.id === 'ext' ? ' ext' : '') + '" style="border-color:' + t.c + '" id="tp-' + t.id + '"><h3 style="color:' + t.c + '">' + t.name + (t.pct ? '<small>' + t.pct + '%，約 ' + Math.round(40 * t.pct / 100) + ' 題</small>' : '<small>課程有、官方清單沒有</small>') + '<small>已掌握 ' + done + ' / ' + t.pts.length + '</small></h3>';
    h += '<div class="pbar"><i style="width:' + (100 * done / t.pts.length) + '%;background:' + t.c + '"></i></div><div class="pts">';
    t.pts.forEach(function (p) {
      h += '<div class="pt' + (mapState[p.id] ? ' done' : '') + '" data-id="' + p.id + '"><div class="hd"><input type="checkbox" aria-label="已掌握：' + esc(p.t) + '"' + (mapState[p.id] ? ' checked' : '') + '><button type="button" aria-expanded="false">' + esc(p.t) + '</button></div>' +
        '<div class="bd" hidden>' + esc(p.d) + '<br>' + p.L.map(function (l) { return '<a href="' + l[0] + '">' + esc(l[1]) + '</a>'; }).join('') + '</div></div>';
    });
    return h + '</div></div>';
  }
  function drawMap() {
    $('rules').innerHTML = RULES.map(function (r) { return '<div><b>' + r[0] + '</b><small>' + r[1] + '</small></div>'; }).join('');
    $('dist').innerHTML = TOPICS.map(function (t) { return '<span style="width:' + t.pct + '%;background:' + t.c + '" title="' + t.name + '">' + t.pct + '%</span>'; }).join('');
    $('cmap').innerHTML = TOPICS.map(topicHtml).join('') + topicHtml(EXT);
    var off = allPoints(false), d = off.filter(function (x) { return mapState[x.p.id]; }).length;
    var w = 0; TOPICS.forEach(function (t) { var dn = t.pts.filter(function (p) { return mapState[p.id]; }).length; w += t.pct * dn / t.pts.length; });
    $('mapsum').textContent = '官方考點已掌握 ' + d + ' / ' + off.length + '（依主題比例加權約 ' + Math.round(w) + '%）';
  }
  $('cmap').addEventListener('click', function (e) {
    var pt = e.target.closest('.pt'); if (!pt) return;
    if (e.target.tagName === 'INPUT') { if (e.target.checked) mapState[pt.dataset.id] = 1; else delete mapState[pt.dataset.id]; save(KMAP, mapState); drawMap(); return; }
    var b = e.target.closest('button'); if (b) { var bd = pt.querySelector('.bd'); bd.hidden = !bd.hidden; b.setAttribute('aria-expanded', String(!bd.hidden)); }
  });
  $('mapclear').onclick = function () { mapState = {}; save(KMAP, mapState); drawMap(); };

  /* ======================================================================
     題型特訓
     ====================================================================== */
  var stats = store(KDRILL, {});
  var D = null;   // {list:[{type, gi}], i, q, opts, answered}
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function buildOpts(q) {
    var seen = {}, opts = [String(q.ans)]; seen[String(q.ans)] = 1;
    shuffle(q.wrong.map(String)).forEach(function (w) { if (!seen[w] && opts.length < 4) { seen[w] = 1; opts.push(w); } });
    return shuffle(opts);
  }
  function typeById(id) { return TYPES.filter(function (t) { return t.id === id; })[0]; }
  function startDrill(list, title) {
    D = { list: list, i: 0, title: title, right: 0 };
    $('drill').hidden = false; nextQ();
    $('drill').scrollIntoView({ block: 'nearest' });
  }
  function startType(id) { var t = typeById(id); startDrill(t.gens.map(function (g, gi) { return { type: id, gi: gi }; }), '題型：' + t.name); }
  function startMixed() { startDrill(shuffle(TYPES.map(function (t) { return { type: t.id, gi: Math.floor(Math.random() * t.gens.length) }; })), '綜合測驗'); }
  function nextQ() {
    if (!D) return;
    if (D.i >= D.list.length) { drawDrillEnd(); return; }
    var it = D.list[D.i], t = typeById(it.type);
    D.q = t.gens[it.gi](); D.opts = buildOpts(D.q); D.answered = false;
    drawDrill();
  }
  function drawDrill() {
    var it = D.list[D.i], t = typeById(it.type);
    var h = '<div class="row" style="margin:0"><b>' + esc(D.title) + '</b><span class="kv">第 ' + (D.i + 1) + ' / ' + D.list.length + ' 題　答對 ' + D.right + '</span><button type="button" data-a="close">關閉</button></div>';
    h += '<details class="how"' + (D.title.indexOf('題型') === 0 && D.i === 0 ? ' open' : '') + '><summary><b>怎麼解這類題：' + esc(t.name) + '</b></summary>' + esc(t.how) + '</details>';
    h += '<div class="q">' + D.q.q + '</div><div class="opts">' + D.opts.map(function (o, k) { return '<button type="button" data-o="' + k + '">' + 'ABCD'.charAt(k) + '. ' + esc(o) + '</button>'; }).join('') + '</div>';
    h += '<p class="verdict-line" id="dv"></p><div class="row"><button type="button" class="go" data-a="next" hidden>下一題</button></div>';
    $('drill').innerHTML = h;
  }
  function answer(k) {
    if (!D || D.answered) return null;
    D.answered = true;
    var it = D.list[D.i], ok = D.opts[k] === String(D.q.ans);
    var s = stats[it.type] || { r: 0, w: 0 }; if (ok) { s.r++; D.right++; } else s.w++; stats[it.type] = s; save(KDRILL, stats);
    [].forEach.call($('drill').querySelectorAll('.opts button'), function (b, j) { if (D.opts[j] === String(D.q.ans)) b.classList.add('ok'); else if (j === k) b.classList.add('no'); });
    var v = $('dv'); v.innerHTML = (ok ? '✔ 答對！' : '✖ 答案是「' + esc(D.q.ans) + '」。') + D.q.ex; v.className = 'verdict-line ' + (ok ? 'ok' : 'bad');
    $('drill').querySelector('[data-a="next"]').hidden = false;
    drawTypes(); drawWeak();
    return ok;
  }
  function drawDrillEnd() {
    $('drill').innerHTML = '<div class="row" style="margin:0"><b>' + esc(D.title) + '：完成</b><span class="kv">答對 ' + D.right + ' / ' + D.list.length + '</span><button type="button" data-a="close">關閉</button></div><p class="why">到「③ 弱點建議」看錯題的題型該去哪裡補。</p>';
  }
  $('drill').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.o != null) answer(+b.dataset.o);
    else if (b.dataset.a === 'next') { D.i++; nextQ(); }
    else if (b.dataset.a === 'close') { D = null; $('drill').hidden = true; }
  });
  function drawTypes() {
    var tot = { r: 0, w: 0 };
    $('types').innerHTML = TYPES.map(function (t) {
      var s = stats[t.id] || { r: 0, w: 0 }; tot.r += s.r; tot.w += s.w;
      var topic = TOPICS.filter(function (x) { return x.id === t.topic; })[0];
      return '<div class="tcard' + (s.w > s.r ? ' weak' : '') + '"><h4>' + esc(t.name) + '</h4><span class="tag" style="color:' + topic.c + '">' + topic.name + '</span><span class="st">答對 ' + s.r + '　答錯 ' + s.w + '</span><button type="button" data-t="' + t.id + '">練這一型（' + t.gens.length + ' 題）</button></div>';
    }).join('');
    $('dsum').textContent = '累計：答對 ' + tot.r + '、答錯 ' + tot.w;
  }
  $('types').addEventListener('click', function (e) { var b = e.target.closest('button[data-t]'); if (b) startType(b.dataset.t); });
  $('mixed').onclick = startMixed;
  $('dclear').onclick = function () { stats = {}; save(KDRILL, stats); drawTypes(); drawWeak(); };

  /* ======================================================================
     弱點建議
     ====================================================================== */
  function recommend() {
    var list = TYPES.map(function (t) { var s = stats[t.id] || { r: 0, w: 0 }; return { t: t, r: s.r, w: s.w, rate: s.w / Math.max(1, s.r + s.w) }; })
      .filter(function (x) { return x.w > 0; }).sort(function (a, b) { return b.rate - a.rate || b.w - a.w; });
    var todo = [];
    TOPICS.slice().sort(function (a, b) { return b.pct - a.pct; }).forEach(function (t) { t.pts.forEach(function (p) { if (!mapState[p.id]) todo.push({ t: t, p: p }); }); });
    return { weak: list, todo: todo };
  }
  function drawWeak() {
    var R = recommend(), h = '';
    if (!R.weak.length) h += '<p class="why">還沒有錯題紀錄。先到「② 題型特訓」做「綜合測驗」，這裡就會列出要補的地方。</p>';
    R.weak.forEach(function (x) {
      h += '<div class="rec"><h4>' + esc(x.t.name) + '　<span class="kv">錯 ' + x.w + '／對 ' + x.r + '</span></h4><div class="why">' + esc(x.t.how) + '</div>' +
        x.t.rec.map(function (l) { return '<a href="' + l[0] + '">' + esc(l[1]) + '</a>'; }).join('') + '　<button type="button" data-t="' + x.t.id + '">再練這一型</button></div>';
    });
    if (R.todo.length) {
      h += '<h3>地圖上還沒勾「已掌握」的官方考點（佔分大的主題在前）</h3>';
      R.todo.slice(0, 8).forEach(function (x) { h += '<div class="rec"><h4>' + esc(x.p.t) + '　<span class="kv" style="color:' + x.t.c + '">' + x.t.name + ' ' + x.t.pct + '%</span></h4>' + x.p.L.map(function (l) { return '<a href="' + l[0] + '">' + esc(l[1]) + '</a>'; }).join('') + '</div>'; });
      if (R.todo.length > 8) h += '<p class="why">還有 ' + (R.todo.length - 8) + ' 個，回「① 考試地圖」看全部。</p>';
    } else h += '<p class="verdict-line ok">官方考點都勾完了。</p>';
    $('weak').innerHTML = h;
  }
  $('weak').addEventListener('click', function (e) { var b = e.target.closest('button[data-t]'); if (b) { show('drill'); startType(b.dataset.t); } });

  /* ---------- 分頁 ---------- */
  var tabs = $('tabs');
  function show(t) {
    [].forEach.call(tabs.querySelectorAll('button'), function (b) { b.classList.toggle('here', b.dataset.t === t); });
    ['map', 'drill', 'weak'].forEach(function (k) { $('t-' + k).hidden = k !== t; });
    if (t === 'weak') drawWeak();
  }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.t); history.replaceState(null, '', '#' + b.dataset.t); } });
  drawMap(); drawTypes(); drawWeak();
  if (/^#(map|drill|weak)$/.test(location.hash)) show(location.hash.slice(1));

  /* ---------- 測試 API ---------- */
  function verify(times) {
    times = times || 50; var bad = [];
    TYPES.forEach(function (t) {
      t.gens.forEach(function (g, gi) {
        for (var k = 0; k < times; k++) {
          var q = g(), opts = buildOpts(q);
          if (!q.q || q.ans == null || !q.ex) bad.push(t.id + gi + '：缺欄位');
          if (opts.length < 4) bad.push(t.id + gi + '：選項不足 ' + opts.join('|'));
          if (opts.indexOf(String(q.ans)) < 0) bad.push(t.id + gi + '：答案不在選項');
          if (q.chk && q.chk() !== String(q.ans)) bad.push(t.id + gi + '：chk ' + q.chk() + ' ≠ ' + q.ans);
        }
      });
    });
    return bad;
  }
  function links() { var a = []; allPoints(true).forEach(function (x) { x.p.L.forEach(function (l) { a.push(l[0]); }); }); return a; }
  window.CladMap = {
    TOPICS: TOPICS, EXT: EXT, TYPES: TYPES, RULES: RULES, show: show,
    map: { get: function () { return mapState; }, set: function (id, v) { if (v) mapState[id] = 1; else delete mapState[id]; save(KMAP, mapState); drawMap(); }, clear: function () { mapState = {}; save(KMAP, mapState); drawMap(); } },
    drill: { startType: startType, startMixed: startMixed, answer: answer, answerCorrect: function () { return answer(D.opts.indexOf(String(D.q.ans))); }, answerWrong: function () { for (var i = 0; i < D.opts.length; i++) if (D.opts[i] !== String(D.q.ans)) return answer(i); }, next: function () { D.i++; nextQ(); }, cur: function () { return D; } },
    stats: function () { return stats; }, recommend: recommend, verify: verify, links: links, questionCount: function () { return TYPES.reduce(function (n, t) { return n + t.gens.length; }, 0); }
  };
})();
