/* 高階實務 H11：大量量測資料，TDMS 和 DAQmx 的記錄。
   證據（docs/research_tdms.md）：職缺寫的是 DAQ（S02、S12、O08）、數據整理和報表（Y02、R01、Y12、Y49、Y51、Y55、Y65）、燒機（R01、Y55）；
   TDMS 0 則、「高速擷取」0 則明寫。TDMS 是做這些工作的工具，不是招募關鍵字。
   NI 官方：TDMS 白皮書與內部結構文件（File／Group／Channel、屬性、.tdms_index 可重建、segment、碎片化原因、Defragment）；
   DAQmx Configure Logging（Log Only 不能 Read、Log and Read 一定要 Read）；錯誤 -200279（緩衝區資料被覆蓋）；npTDMS 是個人開發的 LGPL 套件。
   實測（labview_vi/_build/build_h11_tdms.py，LabVIEW 2026，不用硬體）：
   - 8 通道 × N 筆 DBL：TDMS 一次寫入 1,000 筆 → 64,634 bytes（索引 634）；100,000 筆 → 6,400,636 bytes（索引 636）；
     同樣資料存成 CSV（%.3f）→ 57,000／5,700,000 bytes。讀回 T3：1,000／100,000 筆，第一個值例如 62.81631370783932，CSV 是 62.816。
   - 每次寫一筆（8 通道各 1 個值）寫 1,000 次 → 64,872 bytes（索引 872）；最後 Defragment → 64,632 bytes（索引 632）。
   - 建置中的錯誤：一維陣列接 8 個通道名稱，8 個值全進同一個通道（T3 讀回錯誤 -2532）；要用 [8][1] 的二維陣列；
     通道名稱陣列接進 For Loop 被自動索引，迴圈只跑 8 圈；TDMS Open 的 operation 4 是 replace（檔案要先存在），create or replace 是 2。
   - 寫入時間沒有量（Tick Count 沒有資料相依，量不準）。npTDMS 沒有安裝，Python 讀取的部分沒有實測。DAQmx 沒有實測（沒有硬體、沒有建立模擬裝置）。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='高階實務';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary><div class="ans">${a}</div></details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

/* ---- 資料量計算器 ---- */
function rateFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff;font-size:13px';
  el.innerHTML=`<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
   <label>通道 <input data-k="ch" type="number" value="8" min="1" style="width:56px"></label>
   <label>每通道每秒 <input data-k="sr" type="number" value="0.1" min="0" step="any" style="width:80px"> 筆</label>
   <label>記錄 <input data-k="h" type="number" value="8" min="0" step="any" style="width:56px"> 小時</label>
   <label>預設 <select data-k="p"><option value="">自己填</option><option value="8,0.1,8">W12 燒機：8 通道、10 秒一筆、8 小時</option><option value="3,10000,0.5">W2 振動：3 通道、10 kS/s、30 分鐘</option><option value="4,1000000,0.0167">示波器等級：4 通道、1 MS/s、1 分鐘</option></select></label></div>
   <div data-o="out" style="margin-top:8px"></div>`;
  const q=s=>el.querySelector(s);
  function draw(){
    const ch=+q('[data-k=ch]').value||0,sr=+q('[data-k=sr]').value||0,h=+q('[data-k=h]').value||0;
    const n=ch*sr*h*3600,rows=sr*h*3600,b=n*8,csv=n*7;
    const fmt=x=>x>=1e9?(x/1e9).toFixed(2)+' GB':x>=1e6?(x/1e6).toFixed(2)+' MB':x>=1e3?(x/1e3).toFixed(1)+' kB':x.toFixed(0)+' B';
    const rate=ch*sr*8;
    let adv;
    if(rows<=1048576&&rate<1e4)adv='資料量小：CSV 就夠了，Excel 也打得開。TDMS 不是必要的（但要保留全精度、要記每個通道的單位和設定時，TDMS 仍然方便）。';
    else if(rows>1048576)adv=`超過 Excel 一張工作表的 1,048,576 列：不管 CSV 還是 TDMS，<b>都不能整份丟進 Excel</b>，要用程式（LabVIEW、DIAdem、Python）分析，或分檔。`;
    else adv='資料量開始變大：用二進位（TDMS）寫比較省空間和時間，一次寫一塊。';
    if(rate>1e6)adv+=' 每秒寫入超過 1 MB：擷取迴圈只做擷取和寫檔，分析放另一個迴圈（生產者／消費者，A 系列）；用 DAQmx 的 Configure Logging 讓驅動直接寫 TDMS。';
    q('[data-o=out]').innerHTML=`總共 ${Math.round(n).toLocaleString()} 個值、${Math.round(rows).toLocaleString()} 列（每列一個時間點）。DBL 二進位約 <b>${fmt(b)}</b>，每秒寫入約 ${fmt(rate)}；CSV 每個值留 3 位小數（約 7 個字元）約 ${fmt(csv)}，但精度只剩 0.001。<br>${adv}`;
  }
  q('[data-k=p]').onchange=()=>{const v=q('[data-k=p]').value;if(v){const [a,b2,c]=v.split(',');q('[data-k=ch]').value=a;q('[data-k=sr]').value=b2;q('[data-k=h]').value=c;}draw();};
  ['ch','sr','h'].forEach(k=>q(`[data-k=${k}]`).oninput=draw);draw();
}

L.push({id:'H11',order:50,no:'H11',part:PART,title:'大量量測資料：什麼時候用 TDMS、怎麼寫才不會出事、DAQmx 怎麼直接記錄',mins:60,files:['H11_TDMS_vs_CSV.vi','H11_TDMS_per_sample.vi'],
goals:[['學會','先算資料量再選格式；TDMS 的結構（檔案、群組、通道、屬性）；TDMS 和 CSV 實際差在哪（大小、精度、能不能用 Excel 開）；寫 TDMS 的三個陷阱；什麼情況會碎片化、Defragment 做什麼；DAQmx 的 Configure Logging 和錯誤 -200279；Python 怎麼讀 TDMS'],
 ['工作上','職缺寫的是「DAQ 量測」「數據整理和報表」「燒機」，沒有直接寫 TDMS；但資料一大，用 CSV 會慢、會丟精度、Excel 也開不了，這時就用得到'],
 ['用到','F 部分（CSV、檔案 I/O）、W2（DAQ）、W12（燒機記錄）、W21（Python 報表）、A 系列（生產者／消費者）、第 7 課（自動索引）']],
check:'不看課文，能說出：CSV 和 TDMS 誰比較小（看情況）、誰保留全精度；寫 TDMS 時通道名稱陣列接進迴圈會發生什麼；一次寫一筆會不會讓檔案變很大；Log Only 和 Log and Read 的差別；-200279 怎麼處理。',
body:[
C.h3('這一課的工作','x','燒機從 8 小時變成 168 小時、W2 的振動要 10 kS/s'),
`<p>W12 的燒機記錄每 10 秒一筆，用 CSV 很好用。現在客戶要求做 168 小時的可靠度測試；W2 的馬達振動要從每秒一筆改成每秒一萬筆。CSV 檔越來越大、寫入越來越慢，Excel 也打不開了。主管說：「改用 TDMS 吧。」但 TDMS 不是什麼情況都比較好，這一課先算，再選。</p>`,
note('為什麼有這一課（資料來源）','職缺寫的是 DAQ 量測（台灣 2 則、國外 1 則）、數據整理和報表、燒機；明寫 TDMS 或「高速擷取」的是 0 則。TDMS 是做這些工作時會用到的工具。NI 的事實出自 TDMS 白皮書和內部結構文件、DAQmx 文件和知識庫，整理在 docs/research_tdms.md。'),
C.h3('① 先算資料量','','選格式之前'),
{fn:rateFig},
ask('W12 燒機 8 通道、10 秒一筆、8 小時，需要用 TDMS 嗎？',`<p>8 × 0.1 × 28800 ＝ 23,040 個值、2,880 列，二進位才 184 kB。CSV 完全夠用，打開就能看，交給品保也方便。<b>不要因為「TDMS 比較專業」就換</b>：作業員、品保、客戶多半只會開 Excel。資料量大、要保留全精度、要在檔案裡記每個通道的單位和設定時，才換 TDMS。</p>`),
C.h3('② TDMS 長什麼樣子','',''),
`<ul><li><b>三層</b>：檔案（File）→ 群組（Group，例如「burnin」）→ 通道（Channel，例如 T1～T8）。每一層都可以掛屬性（站別、序號、單位、取樣率、測試程式版本）；只有通道有資料。</li>
<li><b>兩個檔</b>：<code>.tdms</code> 是資料；<code>.tdms_index</code> 是加快讀取用的索引，沒有的話 NI 的程式會自己重建，存檔、傳給別人時<b>不用</b>一起給。</li>
<li><b>segment</b>：每寫一次就多一段。檔案、群組、通道的結構和上一次一樣時，新的一段不用重寫結構資訊。</li>
<li>函式在 ${fn('Programming','File I/O','TDMS Streaming')}：TDMS Open、TDMS Write、TDMS Read、TDMS Close、TDMS Set Properties、TDMS Defragment；LabVIEW 8.2 起就有，2018 可以用。</li></ul>`,
C.h3('③ TDMS 和 CSV 實際比一次','','LadderLab 在 LabVIEW 2026 跑的'),
`<p>H11_TDMS_vs_CSV.vi：模擬 8 個溫度通道（60～68 °C 加亂數），同一份資料一次寫進 TDMS、也存成 CSV（每個值 3 位小數），再從 TDMS 讀回 T3。</p>`,
C.table(['每通道筆數','TDMS（.tdms）','索引（.tdms_index）','CSV（%.3f）','讀回 T3'],[
 ['1,000','64,634 bytes','634 bytes','57,000 bytes','1,000 筆'],
 ['100,000','6,400,636 bytes','636 bytes','5,700,000 bytes','100,000 筆']
]),
ask('TDMS 反而比 CSV 大？那為什麼大家說 TDMS 省空間？',`<p>TDMS 存的是完整的 DBL，每個值 8 bytes；這份 CSV 每個值只留 3 位小數（例如 <code>62.816</code>，加逗號約 7 個字元），<b>精度已經丟了</b>。同一次實測，TDMS 讀回 T3 的第一個值是 62.81631370783932，CSV 裡是 62.816。</p><p>要比空間，要在同樣精度下比：CSV 要保留和 DBL 一樣的精度，每個值要寫十幾個字元，就比 TDMS 大很多。所以正確的說法是：<b>TDMS 保留全精度、寫得快、檔案裡有結構和屬性</b>；只要 3 位小數的少量資料，CSV 可能更小也更方便。</p>`),
tip('下載','<a href="vi/LV2018/H11_TDMS_vs_CSV.vi" download>H11_TDMS_vs_CSV.vi</a>、<a href="vi/LV2018/H11_TDMS_per_sample.vi" download>H11_TDMS_per_sample.vi</a>（LabVIEW 2018）；<a href="vi/H11_TDMS_vs_CSV.vi" download style="font-size:13px">2026 版</a>、<a href="vi/H11_TDMS_per_sample.vi" download style="font-size:13px">2026 版</a>。不需要任何硬體：填每通道筆數和檔案路徑就能跑。'),
C.h3('④ 寫 TDMS 的三個陷阱','','LadderLab 建 VI 時真的踩到的'),
C.table(['陷阱','結果','怎麼避免'],[
 ['資料接成一維陣列（8 個值），通道名稱接 8 個','8 個值<b>全寫進同一個通道</b>，讀 T3 回錯誤 -2532（找不到）','一次寫「每個通道一筆」，資料要是 [8][1] 的二維陣列（Reshape Array），一列對一個通道'],
 ['通道名稱陣列從迴圈外接進 For Loop','LabVIEW 預設<b>自動索引</b>：迴圈只跑 8 圈（陣列長度），每圈只拿到一個名稱（第 7 課）','在通道上按右鍵改成不索引（Disable Indexing）'],
 ['TDMS Open 的 operation 用了和 Open/Create/Replace File 一樣的數字','TDMS Open 的 4 是 replace（檔案要先存在），回錯誤 7；create or replace 是 2','用列舉常數（右鍵 Create Constant），不要直接打數字']
]),
C.h3('⑤ 一次寫一筆，會碎片化嗎？','','實測：看寫的是什麼'),
`<p>H11_TDMS_per_sample.vi：同樣 8 個通道，但在迴圈裡<b>每一圈寫一次</b>（每個通道 1 個值），寫 1,000 次，像 W12 那樣每來一筆就寫：</p>`,
C.table(['寫法（8 通道 × 1,000 筆）','.tdms','.tdms_index'],[
 ['一次寫一整塊','64,634 bytes','634 bytes'],
 ['一筆一筆寫 1,000 次','64,872 bytes','872 bytes'],
 ['一筆一筆寫，最後 TDMS Defragment','64,632 bytes','632 bytes']
]),
`<p>只多了約 240 bytes：每次寫的群組、通道、型別都一樣，TDMS 不重寫結構資訊，只把資料接上去。NI 的文件列的碎片化原因是：很多次小量寫入<b>而且</b>結構在變（換通道順序、每次寫不同的通道、一直改屬性、重複寫一樣的屬性）。LadderLab 建 VI 時接錯過一次：每次寫的是不同的通道，只寫 8 次，索引就 648 bytes，和寫 1,000 次正確結構的 872 bytes 差不多。</p>`,
warn('這個結果只代表這一種情況','LadderLab 只測了「每次寫一樣的 8 個通道」。如果你的程式每次寫的通道不一樣、或一直更新屬性，碎片化會明顯得多；寫完做 TDMS Defragment（它會移除多餘的結構資訊和舊的屬性值），或改成累積一塊再寫。Defragment 要在檔案關閉、沒有人開著的時候做（LadderLab 試過同時開著會回錯誤 5）。'),
C.h3('⑥ DAQmx 直接記錄','','高速時讓驅動寫檔'),
`<ul><li><b>DAQmx Configure Logging</b>（NI-DAQmx 9.0 起）：驅動把擷取的資料直接寫成 TDMS，不經過你的程式；NI 的實測可以超過 1.2 GB/s。</li>
<li><b>Log Only</b>：效能最好，但擷取時<b>不能</b>用 DAQmx Read。<b>Log and Read</b>：<b>一定要</b>呼叫 DAQmx Read，驅動才會寫檔（DAQmx C 參考的搜尋摘要）。</li>
<li>錯誤 <b>-200279</b>：緩衝區裡還沒讀的資料被新資料蓋掉了（NI 知識庫）。處理：加大緩衝區、每次讀多一點、讀得更勤、擷取迴圈只做擷取（分析放另一個迴圈，A 系列的生產者／消費者），或改用 Configure Logging。<b>不要</b>打開 Overwrite Mode 了事：資料掉了你也不會知道。</li></ul>`,
warn('這一節沒有實測','LadderLab 的電腦沒有 DAQ 硬體，也沒有建立 MAX 的模擬裝置，所以 DAQmx 的部分照 NI 文件寫。W2 的課有 DAQmx 的完整寫法。'),
C.h3('⑦ Python 讀 TDMS','','接 W21'),
`<ul><li>常用的是 <b>npTDMS</b>：個人開發的開源套件（LGPL-3.0），<b>不是 NI 官方的</b>。<code>TdmsFile.read(路徑)</code> 一次讀進記憶體；檔案很大時用 <code>TdmsFile.open</code> 分段讀。</li>
<li>NI 官方的 Python 套件 <code>nidaqmx</code> 是用來控制 DAQ 的，<b>不能讀 TDMS</b>。</li>
<li>W21 用的 Python 環境沒有裝 npTDMS；裝之前先確認公司或學校允不允許裝套件。這一節 LadderLab 沒有實測。</li>
<li>Excel 要開 TDMS 要裝 NI 的免費外掛（TDM Excel Add-In），而且一張工作表最多 1,048,576 列。</li></ul>`,
C.h3('⑧ 作業','',''),
`<ol><li>用 ① 的計算器，算你們產線一個測試站一年的資料量（每片幾個量測值、一天幾片），決定用 CSV、TDMS 還是資料庫（W9）。</li>
<li>打開 H11_TDMS_vs_CSV.vi，在 TDMS 檔加上屬性：用 TDMS Set Properties 在檔案層記站別和測試程式版本（W19、H8），在每個通道記單位「°C」；讀回來確認。</li>
<li>把 H11_TDMS_per_sample.vi 改成「每一圈只寫一個通道、輪流寫 8 個通道」，看 .tdms_index 變多大，再做一次 Defragment 比較。</li></ol>`,
C.h3('測','q','小測驗'),
{quiz:[
 {q:'8 通道、10 秒一筆、8 小時的燒機記錄，用什麼格式？',o:['CSV 就夠了（資料量小、Excel 打得開）','一定要 TDMS','一定要資料庫','不用存'],a:0,ex:'先算資料量再選。'},
 {q:'同樣的資料，TDMS 檔比只留 3 位小數的 CSV 大，代表？',o:['TDMS 保留全精度，CSV 已經丟了精度','TDMS 比較差','LabVIEW 寫錯了','CSV 壓縮過'],a:0,ex:'實測：TDMS 讀回 62.81631370783932，CSV 是 62.816。'},
 {q:'TDMS Write 的資料接一維陣列（8 個值）、通道名稱接 8 個，結果？',o:['8 個值全進同一個通道','每個通道各一個值','LabVIEW 斷線','寫進 8 個檔案'],a:0,ex:'要用 [8][1] 的二維陣列。'},
 {q:'通道名稱陣列從外面接進 For Loop，沒改設定時？',o:['被自動索引，迴圈只跑陣列長度那麼多圈','沒影響','迴圈不執行','LabVIEW 斷線'],a:0,ex:'第 7 課的自動索引。'},
 {q:'每圈寫一次一樣的 8 個通道，寫 1,000 次，檔案會？',o:['只比一次寫完大一點（實測多約 240 bytes）','變成 1,000 倍大','寫不進去','自動 Defragment'],a:0,ex:'結構不變時不重寫結構資訊；結構一直變才會明顯碎片化。'},
 {q:'DAQmx 的 Log Only 模式，擷取時可以用 DAQmx Read 嗎？',o:['不行；要邊記錄邊讀用 Log and Read','可以','一定要','只能讀前 1000 筆'],a:0,ex:'Log and Read 則一定要呼叫 Read。'},
 {q:'錯誤 -200279 正確的處理？',o:['加大緩衝區、讀得更勤或更多、擷取迴圈只做擷取','打開 Overwrite Mode','重開電腦','降低 CPU 使用率就好'],a:0,ex:'Overwrite 會讓資料掉了也不知道。'}
]}
]});
})();
