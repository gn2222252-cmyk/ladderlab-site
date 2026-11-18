/* 高階實務 H12：呼叫外部程式碼，廠商 DLL（Call Library Function Node）和 .NET／C# 組件。
   證據（docs/research_next_H12.md）：C# 出現在 Y29、Y50、Y51、Y58、Y62；資深職缺寫「Python 或 C# 搭配」R03、S10、S12、Y58、Y62、O04；
   S07「LabVIEW 或 C# 擇一」；104 摘要 N05「整合光源、相機、IO、DB、影像演算法、客戶 API 等各模組的 DLL」、「相機或軸卡整合經驗佳」。
   注意：Y50、Y51、Y58、Y62 本身不是 LabVIEW 職缺，只能說「要和 C# 程式、DLL 合作」。
   NI 事實：docs/research_dll.md（NI 說明舊版鏡像＝二手、NI KB 搜尋摘要、社群標明）。
   實測（LabVIEW 2026 64 位元，labview_vi/_build/probe_h12_*.py、build_h12_dll.py，2026-11-18）：
   - kernel32 GetComputerNameA：緩衝區 2 字元、nSize 2 → 回傳 0、nSize 16；先問大小再配置 → 回傳 1、名稱 15 字元。H12_Station_Name.vi 照這個做，實測通過。
   - Minimum size 設成 nSize、空字串 → 回傳 1、名稱 15 字元。
   - 空字串、nSize 64、錯誤檢查 Disabled（2）→ 回傳 1、名稱 15 字元、沒有錯誤（寫超過配置的空間，結果卻看起來正常）。
   - 同上、Default（1）→ 一樣回傳 1、名稱完整、沒有錯誤（Default 抓不到寫過頭）。
   - 同上、Maximum（0）→ LabVIEW 跳出錯誤 1516（0x5EC）「DLL 寫超過了某個參數配置的空間，記憶體可能已被破壞」，停止 VI。
     （0 Maximum、1 Default、2 Disabled：NI VI Scripting 說明 Error Checking Level 頁。原始輸出 labview_vi/out/probe_h12_clfn_2026-11-18*.txt）
   - 緩衝區 16、nSize 1（作業 1）→ 回傳 0、nSize 16、緩衝區沒被寫入。Maximum 加上配置好的緩衝區 → 正常，不誤報。
   - 同一個 LabVIEW 先用路徑載過 32 位元 kernel32 後，之後用名稱的 kernel32 也斷線，重開 LabVIEW 才好（觀察，原因沒查）。
   - 64 位元 LabVIEW 用路徑指定 C:\Windows\SysWOW64\kernel32.dll（32 位元）→ VI 斷線，執行回錯誤 1003。錯誤清單文字沒有讀出。
   - 假軸卡 SDK FakeAxisCard.dll（C#，csc 編成 .NET Framework 4，AnyCPU）：test_FakeAxisCard.ps1 在 Windows PowerShell 5.1 的 64 位元、32 位元都 0 失敗。
   - .NET 節點不能用腳本設定（Constructor、Invoke 的 Class 是唯讀），所以「LabVIEW 裡用 .NET 節點呼叫假 SDK」的步驟沒有實測，課文有標明。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='高階實務';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary><div class="ans">${a}</div></details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

/* ---- .h 宣告 → 節點設定 ---- */
const MAPOPT=['數值 I32，傳值（Value）','數值 U32，傳指標（Pointer to Value）','字串 C String Pointer，要預先配置（或設 Minimum size）','字串 C String Pointer，當輸入就好','DBL 陣列 Array Data Pointer，要預先配置筆數','無號 pointer-sized 整數','U8 陣列 Array Data Pointer，要預先配置（不要用字串）'];
const MAPQ=[
 ['int axis','0','一般整數、只是輸入：I32 傳值。'],
 ['DWORD* nSize（函式會改它）','1','有 * 而且函式會寫回：Pointer to Value。DWORD 是 32 位元無號。'],
 ['char* lpBuffer（函式把名稱寫進來）','2','函式要寫入的字串：LabVIEW 先配置夠長，或 Minimum size 指到 nSize。這一課的實測就是這一個。'],
 ['const char* fileName（只讀）','3','const 表示函式只讀：當輸入傳進去就好。'],
 ['double* data, int count（函式把量測值填進 data）','4','函式填陣列：先配置 count 筆（Initialize Array），再把 count 另外傳。'],
 ['HANDLE hCard（Open 回傳的裝置代碼）','5','handle、void* 會隨 32／64 位元變長：用 pointer-sized。寫死 U32，64 位元下指標會被截掉。'],
 ['unsigned char* frame（函式把相機原始影像寫進來，資料裡會有 0）','6','C 字串遇到 0 就結束，二進位資料會被截斷：改用 U8 陣列，而且一樣要先配置夠大。'],
 ['BOOL 回傳值（Windows API）','0','Windows 的 BOOL 是 4 bytes 的 int（不是 C++ 的 bool）：I32，0 是失敗。']
];
function mapFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff;font-size:13px';
  el.innerHTML=`<p style="margin:0 0 6px">廠商的 .h 檔裡有這些宣告。每一個在 Call Library Function Node 的參數頁要怎麼設？</p>`+
   MAPQ.map((q,i)=>`<div style="margin:6px 0;display:flex;flex-wrap:wrap;gap:6px;align-items:center"><code style="flex:1 1 220px">${q[0]}</code>
     <select data-i="${i}" style="flex:1 1 240px;max-width:100%"><option value="">選一個</option>${MAPOPT.map((o,j)=>`<option value="${j}">${o}</option>`).join('')}</select>
     <span data-r="${i}" style="flex:1 1 100%;font-size:12px"></span></div>`).join('')+
   `<button type="button" data-k="chk" class="small-btn">對答案</button> <span data-k="sc"></span>`;
  el.querySelector('[data-k=chk]').onclick=()=>{
    let ok=0;
    MAPQ.forEach((q,i)=>{const v=el.querySelector(`[data-i="${i}"]`).value,r=el.querySelector(`[data-r="${i}"]`);
      if(v===q[1]){ok++;r.innerHTML=`<span style="color:#1e7b34">✔ ${q[2]}</span>`;}
      else r.innerHTML=`<span style="color:#b03a2e">✘ 應該是「${MAPOPT[+q[1]]}」。${q[2]}</span>`;});
    el.querySelector('[data-k=sc]').textContent=`${ok} / ${MAPQ.length}`;
  };
}

L.push({id:'H12',order:51,no:'H12',part:PART,title:'呼叫廠商的程式：DLL（Call Library Function Node）和 C# 同事給的 .NET 組件',mins:75,files:['H12_Station_Name.vi','H12_FakeAxisCard.zip'],
goals:[['學會','拿到 SDK 先問的五件事（原生 DLL 還是 .NET、32／64 位元、呼叫慣例、記憶體誰配置、能不能多執行緒）；把 .h 的宣告對到節點設定；字串和陣列的預先配置、先問大小；錯誤檢查等級；用 .NET 節點呼叫 C# 組件；把 SDK 包成自己的驅動 VI；部署要帶什麼'],
 ['工作上','職缺寫「整合各模組的 DLL」「相機或軸卡整合」「Python 或 C# 搭配」：設備的軸卡、相機、條碼機、客戶的 MES 常常只給 DLL 或 .NET 組件'],
 ['用到','H4（儀器抽象層）、W20（XY 平台）、W19（部署和安裝路徑）、H5（單元測試）、H9（版本控制）、第 7 課（陣列）、F 部分（字串）']],
check:'不看課文，能說出：64 位元 LabVIEW 能不能載入 32 位元 DLL；函式要寫入的字串為什麼要先配置；「結果看起來對」為什麼不代表呼叫是對的；handle 要用什麼型別；.NET 組件改了為什麼 LabVIEW 還在用舊的；LabVIEW 2018 能不能用 .NET 8 的組件。',
body:[
C.h3('這一課的工作','x','設備要換軸卡，廠商只給一包 SDK'),
`<p>新設備的軸卡廠商寄來一包 SDK：一個 DLL、一個 .h 標頭檔、一份 PDF 手冊；另一邊，公司的 C# 同事寫好了讀 MES 工單的程式，給你一個 .NET 的 DLL。主管說：「LabVIEW 這邊接一下。」</p>
<p>這種工作最怕的不是不會接，而是<b>接起來好像能跑，其實在破壞記憶體</b>，一個月後在產線上莫名其妙當機。這一課先用 Windows 內建的 DLL 練（每台電腦都有，不用裝任何東西），再用一個假的軸卡 SDK 練 .NET。</p>`,
note('為什麼有這一課（資料來源）','C# 出現在 5 則職缺；資深職缺有 6 則寫「Python 或 C# 搭配」；104 有職缺直接寫「整合光源、相機、IO、DB、影像演算法、客戶 API 等各模組的 DLL」和「相機或軸卡整合經驗佳」。其中幾則 C# 職缺本身不是 LabVIEW 職缺，所以正確的說法是「LabVIEW 工程師要能和 C# 程式、廠商 DLL 合作」。NI 的事實整理在 docs/research_dll.md，主要來自 NI LabVIEW 說明（舊版說明的鏡像，二手）和 NI 知識庫。'),
C.h3('① 拿到 SDK，先問五件事','','還沒開 LabVIEW 之前'),
C.table(['問題','為什麼','去哪裡找答案'],[
 ['是<b>原生 DLL</b>（C／C++ 寫的）還是 <b>.NET 組件</b>（C# 寫的）？','原生 DLL 用 Call Library Function Node；.NET 用 Constructor／Invoke／Property Node，做法完全不同','手冊；有 .h 的通常是原生 DLL；C# 同事給的是 .NET'],
 ['<b>32 還是 64 位元</b>？','LabVIEW 和原生 DLL 的位元數必須一樣，Windows 不讓同一個程式混用（NI 知識庫）','LabVIEW：64 位元 Windows 上，裝在 Program Files (x86) 的是 32 位元、Program Files 的是 64 位元；SDK：資料夾名稱 x86／x64，或問廠商'],
 ['<b>呼叫慣例</b>：C 還是 stdcall？','選錯，NI 說明寫可能讓 LabVIEW 不正常關閉','.h 裡寫 WINAPI、__stdcall 的是 stdcall；大部分 Windows API 是 stdcall（可變參數的函式例外）'],
 ['<b>記憶體誰配置</b>？字串、陣列要多大？','函式要寫入的緩衝區，要 LabVIEW 先配置好；配置不夠就寫壞記憶體','手冊的每個函式說明；常見寫法是「先問大小」'],
 ['能不能<b>多執行緒同時呼叫</b>（thread-safe）？','不能的話，平行迴圈同時呼叫會出偶發錯誤，很難重現','手冊；沒寫的就當作不能']
]),
ask('LabVIEW 2018 在學校是 32 位元，廠商只給 x64 的 DLL，怎麼辦？',`<p>沒辦法直接用。要嘛跟廠商要 x86 版，要嘛換 64 位元的 LabVIEW。LadderLab 在 64 位元 LabVIEW 2026 試過用路徑指定 32 位元的 kernel32（C:\\Windows\\SysWOW64 裡那個）：<b>VI 直接斷線，按執行回錯誤 1003</b>。1003 只代表「VI 不能執行」，不是位元數專用的錯誤，原因要打開錯誤清單看；論壇上常見的訊息是「Library not found or failed to load」。LadderLab 另外觀察到：同一個 LabVIEW 載過那個 32 位元的檔之後，連用名稱指定的 kernel32 也一起斷線，重開 LabVIEW 才恢復（原因沒查）。</p><p>同一個 VI 要在兩種位元下都能用，NI 說明寫可以用萬用字元命名，例如 <code>mylib*.*</code> 會對到 mylib32 或 mylib64。</p>`),
C.h3('② .h 的宣告怎麼對到節點設定','',''),
note('看懂 .h 的三個符號','<code>*</code> 是指標：傳的是「資料放在哪裡」，函式可以透過它把結果寫回來（LabVIEW 選 Pointer to Value、陣列、字串）。<code>const</code> 表示函式只讀、不會改。<b>handle</b>（HANDLE、void*）是廠商給你的「代號」，你不用看懂它，只要原封不動存起來、下次傳回去。'),
`<p>Call Library Function Node 在 ${fn('Connectivity','Libraries & Executables','Call Library Function Node')}。雙擊打開設定：Function 頁選 DLL、函式、呼叫慣例、執行緒；Parameters 頁按 + 一個一個加參數，左邊選參數、右邊設 Type、Data type、Pass（Value 或 Pointer to Value）、字串和陣列的格式與 Minimum size，<b>型別、傳值或傳指標、順序都要和 .h 一模一樣</b>；Error Checking 頁選錯誤檢查等級。對話框下方會即時顯示 C 的函式原型，拿來和 .h 對照。</p>`,
{fn:mapFig},
C.h3('③ 實作：讀測站名稱','','先問大小，再配置'),
`<p>測試紀錄要寫「哪一台電腦測的」（W6、H8 的追溯）。Windows 的 kernel32.dll 有一個函式 <code>BOOL GetComputerNameA(LPSTR lpBuffer, LPDWORD nSize)</code>：你給它一個緩衝區和緩衝區大小，它把電腦名稱寫進去；緩衝區太小就回傳 0（失敗），並把 nSize 改成需要的大小（含結尾的 0）。</p>`,
C.table(['參數','.h','節點設定'],[
 ['回傳','BOOL','數值 I32（0 失敗、非 0 成功）'],
 ['lpBuffer','LPSTR（char*，函式寫入）','字串，C String Pointer'],
 ['nSize','LPDWORD（DWORD*，函式讀也寫）','數值 U32，Pointer to Value']
]),
`<p>H12_Station_Name.vi 用兩個節點：</p><ol><li>第一個：緩衝區接空字串、nSize 接 0 → 回傳 0，nSize 變成需要的大小。</li><li>Initialize Array 做出 nSize 個 U8 的 0，Byte Array To String 變成字串 → 這就是配置好的緩衝區。注意 element 要是 <b>U8</b>：直接在 element 上建常數會是 DBL，接不上 Byte Array To String；在常數上右鍵 Representation ▸ U8，或像參考 VI 一樣先經過 To Unsigned Byte Integer。</li><li>第二個：接這個緩衝區和 nSize → 回傳 1，拿到名稱。</li></ol>
<p>函式庫用<b>名稱</b> <code>kernel32.dll</code> 指定，不用路徑：系統 DLL 用路徑的話，建置時會被包進去散佈到別台電腦（NI 說明）。呼叫慣例選 stdcall。</p>`,
C.table(['LadderLab 實測（LabVIEW 2026 64 位元）','回傳','nSize 回來','名稱'],[
 ['緩衝區 2 字元、nSize 2（太小）','0','16','—'],
 ['H12_Station_Name.vi：先問大小、再配置','第一次 0、第二次 1','16 → 15','15 字元'],
 ['緩衝區接空字串、Minimum size 設成 nSize、nSize 64','1','15','15 字元']
]),
tip('下載','<a href="vi/LV2018/H12_Station_Name.vi" download>H12_Station_Name.vi（LabVIEW 2018）</a>　<a href="vi/H12_Station_Name.vi" download style="font-size:13px">2026 版</a>。不用裝任何東西，32、64 位元的 LabVIEW 都能用（kernel32 兩種都有）。執行後面板會顯示你的電腦名稱。'),
tip('Minimum size 是另一種寫法','在 Parameters 頁選 lpBuffer，把 Minimum size 設成 nSize：LabVIEW 會依 nSize 自動把緩衝區加長（實測：接空字串也拿到名稱）。手冊說「緩衝區至少 N 個字元」時最方便。'),
C.h3('④ 危險實驗：結果對，不代表呼叫是對的','','錯誤檢查等級'),
`<p>如果<b>不配置</b>：緩衝區接空字串，nSize 卻填 64，會怎樣？依 NI 論壇常客的說明（社群），LabVIEW 只配置 1 byte（結尾的 0）給空字串；函式相信 nSize 說的 64，把 16 bytes 寫進去，多出來的部分寫到不屬於這個字串的記憶體。下表的 Maximum 那一列，就是 LabVIEW 自己抓到這件事。</p>`,
C.table(['錯誤檢查等級（節點的 Error Checking 頁）','LadderLab 實測：空字串、nSize 64'],[
 ['Disabled','<b>回傳 1、名稱完整 15 字元、沒有任何錯誤</b>'],
 ['Default（預設）','<b>一樣：回傳 1、名稱完整、沒有任何錯誤</b>。Default 只攔例外、檢查呼叫慣例，抓不到寫過頭'],
 ['Maximum','LabVIEW 跳出<b>錯誤 1516</b>：DLL 寫超過了某個參數配置的空間，記憶體可能已被破壞；VI 被停止'],
 ['Maximum，但緩衝區有配置 64 字元','回傳 1、名稱 15 字元、沒有錯誤（配置正確時不會誤報）']
]),
warn('這就是 DLL 最可怕的地方','用預設的 Default，寫過頭時<b>結果完全正常、沒有任何錯誤</b>。寫壞的記憶體可能屬於 LabVIEW 的其他資料，當下沒事，之後在完全不相干的地方當掉（NI 說明：DLL 造成的當機不一定在呼叫時發生）。所以：<b>函式要寫入的字串、陣列一定先配置</b>，不能靠錯誤檢查；接新的 DLL 函式時，把錯誤檢查暫時改成 <b>Maximum</b> 跑一遍，看會不會出現 1516（Maximum 比較慢、比較吃記憶體，NI 建議只在除錯時用，交機前改回 Default）；<b>不要為了快改成 Disabled</b>。'),
`<ul><li><b>錯誤 1097</b>：DLL 裡發生了例外，LabVIEW 攔到了，但記憶體可能已經被破壞（NI 知識庫）。常見原因是型別設錯、緩衝區沒配置、位元數或呼叫慣例錯。<b>不能清掉錯誤繼續跑</b>，要找到原因，最好重開 LabVIEW。</li>
<li>看錯誤時要看 <b>code</b>，不能只看 status：LabVIEW 的警告是 status 為 FALSE、code 不是 0（NI 說明）。DLL 函式自己的失敗（像回傳 0 的 BOOL）也不會出現在 error out，<b>要檢查回傳值</b>。</li>
<li>DLL 和 LabVIEW 在同一個程式（行程）裡，DLL 當掉，LabVIEW 跟著關掉，沒存的東西就沒了。<b>呼叫新的 DLL 之前先存檔</b>。不穩定的 DLL 可以包成獨立的小程式，用 System Exec 或 TCP 呼叫（W21 的做法），當掉只掉那個程式（推論）。</li></ul>`,
C.h3('⑤ 執行緒','','UI thread 還是 any thread'),
`<ul><li><b>Run in UI thread</b>（預設）：呼叫切到 LabVIEW 的使用者介面執行緒，一次只跑一個呼叫。NI 說明另外寫了：UI thread 上的節點不會執行中止用的 callback，所以按 LabVIEW 的停止鍵，DLL 不會被通知要中途停下來。</li>
<li><b>Run in any thread</b>：比較快，但 DLL 必須 thread-safe（能同時被多個地方呼叫）。NI 說明列的條件包括不存全域資料、不直接存取硬體、用 mutex 保護共用資源。</li>
<li><b>實務上</b>：手冊沒寫 thread-safe 的，保守用 UI thread，或把所有呼叫包在<b>不可重入</b>的 VI 裡，確保一次只有一個呼叫（推論；NI 說明列的 thread-safe 條件之一是「只被一個不可重入的 VI 呼叫」）。很多軸卡、相機 SDK 要求同一條執行緒初始化和呼叫，要看手冊。</li></ul>`,
C.h3('⑥ C# 同事給的 .NET 組件','','假軸卡 SDK'),
`<p>H12_FakeAxisCard.zip 裡有一個假的軸卡 SDK：C# 原始碼 FakeAxisCard.cs、編好的 FakeAxisCard.dll、一支不用 LabVIEW 的檢查程式。沒有硬體，位置是用時間算出來的；每個方法都回傳錯誤碼（0 成功、負數失敗），跟很多真的 SDK 一樣。</p>`,
C.table(['方法（類別 LadderLab.FakeMotion.AxisCard）','做什麼'],[
 ['int Open(int cardNo)','開卡，只有 0 號卡存在（其他回 -1）'],
 ['int MoveAbs(int axis, double positionMm, double speedMmPerS)','移動到絕對位置；軟體極限 0～300 mm（超過回 -4）、速度 0～200 mm/s（超過回 -5）'],
 ['int GetPosition(int axis, out double positionMm)','讀位置：值從 out 參數出來，回傳值是錯誤碼'],
 ['int IsMoving(int axis, out bool moving)','還在動嗎'],
 ['int Stop(int axis)、void Close()','停止、關卡；沒開卡就呼叫回 -2'],
 ['static string ErrorText(int code)','錯誤碼的文字說明']
]),
tip('下載','<a href="vi/H12_FakeAxisCard.zip" download>H12_FakeAxisCard.zip</a>（LabVIEW 2018 和 2026 通用）：FakeAxisCard.cs（原始碼）、FakeAxisCard.dll、test_FakeAxisCard.ps1、README.txt。想自己編：每台 Windows 10／11 都有 <code style="word-break:break-all">C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe</code>，指令在 README。不用 LabVIEW 先檢查：<code style="word-break:break-all">powershell -NoProfile -ExecutionPolicy Bypass -File test_FakeAxisCard.ps1</code>，最後一行要是 failures: 0。'),
warn('下面 LabVIEW 的步驟沒有實測','LadderLab 的建置工具不能設定 .NET 節點（Constructor 和 Invoke 的類別是唯讀），所以步驟是照 NI 說明和範例寫的，沒有在 LabVIEW 裡跑過；SDK 本身用 PowerShell 測過。卡住時看 LabVIEW 附的範例 examples\\Connectivity\\Dot NET\\Calling a Private .NET Assembly.vi。'),
`<p>LadderLab 用 Windows PowerShell 5.1（和 LabVIEW 2018 一樣載入 .NET Framework 4）跑過 17 項檢查，64 位元和 32 位元的 PowerShell 都通過。組件編成 AnyCPU，所以<b>推論</b> 32、64 位元的 LabVIEW 都能載入（LabVIEW 裡沒測），這點和原生 DLL 不一樣。</p>
<p>在 LabVIEW 裡的做法（${fn('Connectivity','.NET')}）：</p>
<ol><li>建一個專案，把 <b>FakeAxisCard.dll、VI、.lvproj 放在同一個資料夾</b>（NI 說明：在專案裡時，私有組件預設到專案資料夾找；NI 強烈建議 .NET 的 VI 放在專案裡；NI 範例提醒 DLL 搬走會出現錯誤 1172）。</li>
<li>放一個 <b>Constructor Node</b>，雙擊，Browse 選 FakeAxisCard.dll，選 LadderLab.FakeMotion 裡的 AxisCard 和它的建構子。輸出是一個物件的 reference。</li>
<li>reference 接到 <b>Invoke Node</b>，在節點上選方法 Open，cardNo 接 0。接著 MoveAbs，再用 While Loop 每 100 ms 呼叫 GetPosition、IsMoving，直到停下來。GetPosition 的位置從 out 參數出來：它在 Invoke Node 上長什麼樣子、輸入要不要接，以你的 LabVIEW 實際看到的為準（沒有實測）。</li>
<li>每個方法的回傳值是錯誤碼：不是 0 就轉成 LabVIEW 的錯誤（例如用 Error Cluster From Error Code.vi，自訂錯誤碼放在 LabVIEW 保留給使用者的 5000～9999，I10 有教），訊息用 ErrorText 的結果。</li>
<li>最後呼叫 Close，再用 <b>Close Reference</b> 關掉 reference。</li></ol>`,
C.table(['.NET 常見狀況','原因和做法'],[
 ['C# 同事改了 DLL、重編了，LabVIEW 還在跑舊的','組件載入後留在記憶體，直到載入它的專案（或 LabVIEW）關掉（NI 說明）。關掉專案再開；不在專案裡用的要重開 LabVIEW。用 .NET Assemblies in Memory 對話框看載入的是哪一版'],
 ['LabVIEW 2018 載不進同事給的組件','NI 官方寫 .NET Core 支援是從 LabVIEW 2024 Q3 開始逐步加入。2018 請同事編成 .NET Framework 4.x（這一課的 SDK 就是）；.NET Standard 2.0 能不能用沒有確認'],
 ['開發電腦能跑，產線電腦錯誤 1172','DLL 沒跟著 VI 或 EXE 放，或少了它依賴的其他 DLL']
]),
C.h3('⑦ 包成自己的驅動 VI','','接 H4'),
`<p>不要讓 SDK 的節點散在主程式裡。像 H4 的儀器抽象層一樣，每個功能包一個 VI：<code>Axis Open.vi</code>、<code>Axis MoveAbs.vi</code>、<code>Axis Get Position.vi</code>、<code>Axis Close.vi</code>，全部有 error in／error out，<b>錯誤碼在這一層就轉成 LabVIEW 的錯誤</b>，單位在這一層統一（mm）。好處：</p>
<ul><li>換廠商時只改這幾個 VI（H4 的 HAL 可以再往上包一層）。</li><li>這幾個 VI 設成不可重入，SDK 的呼叫自然一次一個。</li><li>可以為它們寫 H5 的單元測試（例如「沒 Open 就 MoveAbs 要回錯誤」），用假 SDK 就能跑，不用等設備到。</li><li>H9：廠商的 DLL 要不要放進版本庫，先看授權條款；至少把 SDK 版本號寫進 README。</li></ul>`,
C.h3('⑧ 部署：開發電腦能跑，產線電腦不能跑','','W19'),
C.table(['要帶的東西','說明'],[
 ['DLL 本身','用路徑指定的 DLL，Application Builder 會自動包進建置；用名稱指定的不會（NI 說明）'],
 ['DLL 依賴的其他 DLL','不會被自動找出來，要加到建置規格的 Always Included，通常放在 EXE 旁邊（社群）'],
 ['Visual C++ Redistributable','用 Visual C++ 編的 DLL 常需要它，位元數要和 DLL 一樣（Microsoft 說明）'],
 ['廠商驅動','很多軸卡、相機要裝廠商的驅動程式，不能只複製 DLL'],
 ['.NET 組件和 .config','不在 GAC 的組件建置時會被複製；用了 .config 的要一起放（NI 說明）'],
 ['LabVIEW Run-Time Engine','沒有 LabVIEW 的電腦要裝，位元數要對']
]),
`<p>驗收方法：找一台<b>從來沒裝過開發工具的乾淨電腦</b>裝一次（W19）。</p>`,
C.h3('⑨ 新手最常踩的','',''),
C.table(['錯誤','症狀','怎麼避免'],[
 ['位元數不對','載入失敗、VI 斷線','先查 LabVIEW 幾位元，拿對的 SDK'],
 ['要寫入的字串、陣列沒配置','結果看起來對但記憶體已壞、1097、當機','先問大小或 Minimum size'],
 ['handle 用 U32 存','32 位元正常、64 位元出錯','pointer-sized 整數'],
 ['呼叫慣例選錯','錯誤或 LabVIEW 不正常關閉','看 .h 的 WINAPI、__stdcall'],
 ['不 thread-safe 的 SDK 平行呼叫','偶發錯誤，很難重現','UI thread 或不可重入的包裝 VI'],
 ['清掉 1097 繼續跑','之後在別處當掉','找原因、重開 LabVIEW'],
 ['部署少檔','產線電腦載入失敗','乾淨電腦驗收'],
 ['.NET 組件改了沒生效','跑的還是舊版','關專案或重開 LabVIEW']
]),
C.h3('⑩ 作業','','另外約 2～3 小時'),
`<ol><li>打開 H12_Station_Name.vi，只把<b>第二個節點</b>的 nSize 改接常數 1（Initialize Array 那條線不要動），執行，看回傳值和 nSize 回來多少，說明為什麼。LadderLab 實測：回傳 0、nSize 回來 16、名稱是空的。（<b>不要</b>把 nSize 改成比緩衝區大的數字，那就是 ④ 的危險實驗。）</li>
<li>把它改成 Minimum size 的寫法（只用一個節點），比較兩種寫法哪個比較好讀。</li>
<li>解開 H12_FakeAxisCard.zip，先跑 test_FakeAxisCard.ps1 確認 SDK 沒問題，再照 ⑥ 在 LabVIEW 裡做：開卡、把 0 軸移到 150 mm、每 100 ms 顯示位置、到位後關卡。故意移到 400 mm，確認錯誤有轉成 LabVIEW 的錯誤、訊息看得懂。</li>
<li>照 ⑦ 把 ③ 包成 <code>Axis Open.vi</code>、<code>Axis MoveAbs.vi</code>、<code>Axis Close.vi</code>，並寫一支 H5 的測試：沒開卡就 MoveAbs 一定要回錯誤。</li></ol>`,
C.h3('測','q','小測驗'),
{quiz:[
 {q:'64 位元的 LabVIEW 可以呼叫 32 位元的原生 DLL 嗎？',o:['不行，位元數必須一樣','可以，會自動轉換','只有 stdcall 的可以','重開機就可以'],a:0,ex:'Windows 不讓同一個程式混用。LadderLab 實測：VI 斷線，回錯誤 1003。'},
 {q:'函式會把結果寫進 char* buffer，LabVIEW 這邊要？',o:['先配置夠長的字串（或設 Minimum size）再傳進去','接一個空字串就好','改成 Pascal String','不用管，DLL 會自己配置'],a:0,ex:'DLL 不能把 LabVIEW 給的 C 字串加長。'},
 {q:'緩衝區沒配置，結果卻顯示正確的名稱、也沒錯誤，代表？',o:['不代表沒事：多寫的部分可能已經寫壞記憶體','程式是對的','LabVIEW 自動修好了','DLL 有自己配置'],a:0,ex:'LadderLab 實測：Default 和 Disabled 都這樣；改成 Maximum 才跳出錯誤 1516。'},
 {q:'Open 回傳的 HANDLE 要用什麼型別存？',o:['pointer-sized 整數','U32','DBL','字串'],a:0,ex:'寫死 U32，64 位元下指標會被截掉。'},
 {q:'出現錯誤 1097 時？',o:['找原因（型別、配置、位元數、呼叫慣例），重開 LabVIEW','清掉錯誤繼續跑','改成 Disabled 讓它不報錯','加大 Wait'],a:0,ex:'記憶體可能已經被破壞。'},
 {q:'C# 同事重編了組件，LabVIEW 還在跑舊版，因為？',o:['組件載入後留在記憶體，要關專案或重開 LabVIEW','LabVIEW 不支援 C#','要重新安裝 LabVIEW','DLL 壞了'],a:0,ex:'NI 說明：載入後一直留到載入它的專案或 LabVIEW 關閉。'},
 {q:'LabVIEW 2018 要用同事的組件，請同事怎麼編？',o:['.NET Framework 4.x','.NET 8','任何版本都可以','Python'],a:0,ex:'NI：.NET Core 支援從 LabVIEW 2024 Q3 開始逐步加入。'},
 {q:'手冊沒寫 SDK 是否 thread-safe，怎麼設？',o:['Run in UI thread，或包在不可重入的 VI 裡','Run in any thread 比較快','每個迴圈各自呼叫','錯誤檢查改 Disabled'],a:0,ex:'沒寫的就當作不能同時呼叫。'}
]}
]});
})();
