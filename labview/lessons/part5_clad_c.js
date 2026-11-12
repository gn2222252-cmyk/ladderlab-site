/* 第五部分 C：CLAD 證照（C9～C12）：設計模式、錯誤處理、圖表與 UI、DAQmx 與儀器控制 */
(function(){
const L=window.LESSONS,fn=C.fn,ctl=C.ctl,qd=C.qd,wt=C.wt;
const {tip,warn,note,PART}=C.clad;

/* ======================================================================
   C9 設計模式
   ====================================================================== */
const states=['Init','Wait','Run','Stop'];
const smFig={name:'State Machine',view:'split',ratio:1.4,
 fp:{w:260,h:220,items:[{id:'go',k:'btn',label:'Go',x:20,y:20},{id:'quit',k:'btn',label:'Quit',x:110,y:20},
  {id:'st',k:'str',label:'Current State',x:20,y:80,w:200},{id:'n',k:'num',label:'Runs',x:20,y:140,w:90}]},
 bd:{w:600,h:260,structs:[{id:'wl',k:'while',x:80,y:20,w:470,h:220},{id:'cs',k:'case',x:170,y:60,w:290,h:140,frames:states.map(s=>'"'+s+'"'),cur:2}],nodes:[
  {id:'k0',k:'const',t:'enum',v:'Init ▾',x:10,y:91},{id:'sr',k:'sr',t:'enum',s:'wl',y:100},{id:'sel',k:'sel',t:'enum',s:'cs',y:110},
  ...states.map((s,i)=>({id:'n'+i,k:'const',t:'enum',v:['Wait','Run','Wait','Stop'][i]+' ▾',x:340,y:91,f:'cs:"'+s+'"'})),
  {id:'tout',k:'tunnel',t:'enum',s:'cs',side:'r',y:100},
  {id:'lab',k:'label',text:'每一頁做一件事，\n再決定下一個狀態',x:200,y:140,w:130,h:36},
  {id:'eq',k:'fn',fn:'Equal?',x:480,y:160,showName:false},{id:'kst',k:'const',t:'enum',v:'Stop ▾',x:420,y:205},{id:'cond',k:'stop',s:'wl'}],
 wires:[{id:'w1',from:'k0',to:'sr.init',t:'enum'},{id:'w2',from:'sr.L',to:'sel',t:'enum',pts:[[130,100],[130,110]]},
  ...states.map((s,i)=>({id:'wn'+i,from:'n'+i,to:'tout.i',t:'enum',f:'cs:"'+s+'"'})),{id:'w3',from:'tout.o',to:'sr.R',t:'enum'},{id:'w4',from:'tout.o',to:'eq.x',t:'enum',mx:470},{id:'w5',from:'kst',to:'eq.y',t:'enum',mx:468},{id:'w6',from:'eq.out',to:'cond',t:'bool',pts:[[530,174],[530,218]]}]},
 sim:{period:600,init(){return {s:'Init',n:0};},step(i,st){const cur=st.s;let nx=cur;
   if(cur==='Init')nx='Wait';else if(cur==='Wait'){if(i.quit)nx='Stop';else if(i.go)nx='Run';}else if(cur==='Run'){st.n++;nx='Wait';}
   st.s=nx;return {out:{st:cur+' → '+nx,n:st.n},frames:{cs:states.indexOf(cur)},stop:cur==='Stop',msg:'目前狀態：'+cur+(cur==='Wait'?'（按 Go 或 Quit）':'')};},doneMsg:'進入 Stop 狀態，迴圈結束'}};
L.push({id:'C09',order:109,no:'C9',part:PART,title:'設計模式：State Machine、Producer/Consumer、QMH',mins:60,
goals:[['學會','State Machine、Event-driven State Machine、Producer/Consumer（資料、事件）、Queued Message Handler、Master/Slave、FGV 的用途與比較。'],['考試重點','看需求選模式：「依序且可分支的步驟」→ State Machine；「接收資料不能漏、處理比較慢」→ Producer/Consumer；「UI 不能卡」→ 事件 + Producer/Consumer。'],['動畫練習','<a href="lab-struct.html#sm">結構實驗室：State Machine</a>：洗衣機狀態機一圈一圈跑，開門進暫停；同一圈按兩個按鈕，看哪一個被蓋掉。'],['動畫練習','<a href="lab-qmh.html">QMH 架構實驗室</a>：QMH 和簡單狀態機並排，連按 3 個按鈕，看誰漏掉。'],['動畫練習','<a href="lab-enum.html#sm">Enum 實驗室：字串 vs Enum 狀態</a>：字串狀態打錯一個字就卡在 Default，Enum 在編輯時就抓到。']],
check:'看到題目描述能選出正確的設計模式，並說出 State Machine 的三個零件。',
body:[
C.h3('懂','','State Machine（狀態機）'),
`<p>三個零件：<b>While Loop</b> + <b>Shift Register 存「下一個狀態」</b>（Type Def Enum）+ <b>Case Structure 每個狀態一頁</b>。每一頁做完自己的事，再輸出下一個狀態。和 PLC 的步進梯形圖是同一個概念。</p>`,
{lv:smFig,cap:'按 Run，再按 Go 會進 Run 狀態一次又回 Wait；按 Quit 進 Stop 結束迴圈。Case 頁會跟著目前狀態切換。'},
C.table(['設計模式','結構','適合','缺點'],[
 ['State Machine','While + Shift Register(Enum) + Case','流程有步驟、會依條件跳轉（測試流程、機台步序）','狀態只能一個一個來，不能排隊多個命令'],
 ['Event-driven State Machine','State Machine 的某個狀態裡放 Event Structure（或 Timeout 頁做其他狀態）','有 UI 的小程式','事件頁卡住時 UI 也卡'],
 ['Producer/Consumer（資料）','兩個迴圈 + Queue；生產者放資料、消費者處理','資料不能漏、處理比擷取慢（擷取 → 存檔）','Queue 無限長會吃記憶體'],
 ['Producer/Consumer（事件）','生產者是 Event Structure，把命令放進 Queue','UI 反應要快、工作要做很久（本課程 GT_Main 的概念）','—'],
 ['Queued Message Handler（QMH）','Queue 裡放「訊息名稱 + 資料」，消費者是 State Machine','中大型專案，多個模組互傳訊息','架構比較複雜'],
 ['Master/Slave','一個 Master 迴圈用 Notifier 通知多個 Slave','多個迴圈要同時對同一事件反應，舊資料可丟','Notifier 會丟資料'],
 ['FGV / Action Engine','Non-reentrant SubVI + 未初始化 Shift Register','共用資料、避免 race condition','動作要設計在 FGV 裡面']
]),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'需求：DAQ 每 10 ms 擷取一筆，存檔有時會慢到 200 ms，資料一筆都不能漏。用哪種模式？',o:['State Machine','Producer/Consumer（資料）+ Queue','Master/Slave + Notifier','單一 While Loop'],a:1,ex:'Queue 緩衝，消費者慢也不會漏。'},
 {q:'State Machine 的「下一個狀態」存在哪裡？',o:['Local Variable','Shift Register','Global Variable','Queue'],a:1,ex:'Shift Register（Enum）。'},
 {q:'State Machine 的狀態最好用什麼型別？',o:['字串','Type Def Enum','DBL','Boolean'],a:1,ex:'Type Def Enum：新增狀態時所有常數一起更新，Case 頁籤顯示名稱。'},
 {q:'Master/Slave 模式中 Master 用什麼通知 Slave？',o:['Queue','Notifier','Local Variable','File'],a:1,ex:'Notifier 一對多。'},
 {q:'QMH 和簡單 State Machine 最大的差別？',o:['QMH 不能有 UI','QMH 可以把多個訊息排隊依序處理，也能從其他迴圈送訊息進來','QMH 不用迴圈','沒有差別'],a:1,ex:'訊息放在 Queue 裡，外部也能送入。'},
 {q:'有 UI 的程式，按鈕要立刻反應、但按下後的工作要跑 30 秒，最適合？',o:['事件 + Producer/Consumer','一個 Event Structure 裡直接做 30 秒工作','Global Variable','Sequence Structure'],a:0,ex:'事件頁只負責把命令放進 Queue，消費者慢慢做，UI 不卡。'}
]}
]});

/* ======================================================================
   C10、C11 的動手寫（VI 視窗是網頁模擬的）
   ====================================================================== */
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const PR2=['Functions','Programming'];
if(!LV.F['Error Cluster From Error Code'])LV.F['Error Cluster From Error Code']={g:'#→err',ins:['error code','error message'],outs:['error out'],w:50,col:'#fff1c2',pal:[...PR2,'Dialog & User Interface','Error Cluster From Error Code.vi']};
const NOE={status:false,code:0,source:''};
/* Merge Errors：回報第一個錯誤；沒有錯誤時回報第一個警告 */
const mergeE=(...es)=>es.find(e=>e.status)||es.find(e=>e.code)||NOE;

const errVI={name:'C10_Errors.vi',view:'split',ratio:1.6,
 fp:{w:360,h:330,items:[
  {id:'val',k:'num',ctl:true,label:'Value',x:16,y:16,w:100,v:50,inc:30},
  {id:'inj',k:'btn',label:'（模擬）error in 帶著錯誤進來',text:'注入錯誤',mech:'switch',x:150,y:16},
  {id:'eo',k:'err',label:'error out',x:16,y:80},
  {id:'ec',k:'err',label:'Clear Errors 之後',x:190,y:80},
  {id:'dlg',k:'str',label:'（模擬）Simple Error Handler 跳出的對話框',x:16,y:226,w:330,rows:3}]},
 bd:{w:520,h:200,nodes:[
  {id:'val',k:'ctl',t:'dbl',label:'Value',x:16,y:33},
  {id:'k100',k:'const',t:'dbl',v:100,x:58,y:48},
  {id:'gt',k:'fn',fn:'Greater?',x:96,y:36},
  {id:'k5001',k:'const',t:'i32',v:5001,x:96,y:8},
  {id:'k0',k:'const',t:'i32',v:0,x:110,y:70},
  {id:'sel',k:'fn',fn:'Select',x:140,y:34},
  {id:'kmsg',k:'const',t:'str',v:'Value 超過 100',x:60,y:95},
  {id:'ecfc',k:'fn',fn:'Error Cluster From Error Code',x:200,y:39,h:32,showName:false},
  {id:'ein',k:'ctl',t:'err',label:'error in',x:16,y:170},
  {id:'merge',k:'fn',fn:'Merge Errors',x:280,y:44},
  {id:'seh',k:'fn',fn:'Simple Error Handler',x:360,y:44},
  {id:'eo',k:'ind',t:'err',label:'error out',x:430,y:50},
  {id:'clr',k:'fn',fn:'Clear Errors',x:360,y:110},
  {id:'ec',k:'ind',t:'err',label:'Clear Errors 之後',x:430,y:116}],
 wires:[
  {id:'w1',from:'val',to:'gt.x',t:'dbl'},
  {id:'w2',from:'k100',to:'gt.y',t:'dbl'},
  {id:'w3',from:'gt.out',to:'sel.s',t:'bool'},
  {id:'w4',from:'k5001',to:'sel.t',t:'i32',pts:[[136,17],[136,41]]},
  {id:'w5',from:'k0',to:'sel.f',t:'i32',pts:[[134,79],[134,59]]},
  {id:'w6',from:'sel.out',to:'ecfc.error code',t:'i32'},
  {id:'w7',from:'kmsg',to:'ecfc.error message',t:'str',pts:[[190,104],[190,60]]},
  {id:'w8',from:'ecfc.error out',to:'merge.error 1',t:'err'},
  {id:'w9',from:'ein',to:'merge.error 2',t:'err',pts:[[270,180],[270,65]]},
  {id:'w10',from:'merge.error out',to:'seh.error in',t:'err'},
  {id:'w11',from:'seh.error out',to:'eo',t:'err'},
  {id:'w12',from:'merge.error out',to:'clr.error in',t:'err',pts:[[340,60],[340,126]]},
  {id:'w13',from:'clr.error out',to:'ec',t:'err'}]},
 sim:{live:true,step(i){
  const over=i.val>100,cust=over?{status:true,code:5001,source:'Value 超過 100'}:NOE;
  const ein=i.inj?{status:true,code:-1073807339,source:'VISA Read（逾時）——模擬從上游帶進來的錯誤'}:NOE;
  const m=mergeE(cust,ein);
  const dlg=m.status?'Error '+m.code+' occurred at '+m.source+'\n（按 OK 後程式繼續；error out 仍然是這個錯誤）':'（沒有錯誤：不跳對話框）';
  return {out:{eo:m,ec:NOE,dlg},msg:m.status?'Merge Errors 送出 code '+m.code+(cust.status&&ein.status?'：兩個都有錯，回報 error 1（自訂的 5001）':''):'沒有錯誤',
   vals:{val:i.val,k100:100,k5001:5001,k0:0,kmsg:'Value 超過 100','gt.out':over,'sel.out':over?5001:0,'ecfc.error out':cust,ein,'merge.error out':m,'seh.error out':m,'clr.error out':NOE}};
 }}
};
const C10_LV=[
C.h3('做','b','動手寫：C10_Errors.vi（自訂錯誤、Merge Errors、Simple Error Handler 和 Clear Errors 各做什麼）'),
`<p>表格上的工具，放進同一支小 VI 裡比一比。自訂一個錯誤：Value 超過 100 就產生錯誤 5001；再跟 error in 帶進來的錯誤合併；最後一條給 Simple Error Handler，一條給 Clear Errors，看兩邊的 error out 有什麼不同。</p>`,
C.plan({
 start:'File ▸ New VI，存成 <code>練習\\C10_Errors.vi</code>。',
 in:'前面板 <code>Value</code>（DBL）和 <code>error in</code>（錯誤叢集：status、code、source）。',
 calc:'Greater?（Value &gt; 100）→ Select 選錯誤碼 5001 或 0 → Error Cluster From Error Code.vi 把碼變成錯誤叢集（碼是 0 就是「沒有錯誤」）。Merge Errors 把自訂的錯誤和 error in 合成一條：回報<b>第一個</b>錯誤。',
 out:'兩個 Error Out 指示器：一個接在 Simple Error Handler 後面（有錯會跳對話框，錯誤照樣往後傳），一個接在 Clear Errors 後面（永遠是沒有錯誤）。',
 loop:'不用迴圈，按一次 Run 做一次。',
 end:'這支 VI 自己就是最上層，所以由它顯示錯誤（Simple Error Handler）。如果它是 SubVI，就只把 error out 接到接線端，不要跳對話框，讓主程式決定。'}),
note('VI 視窗是網頁模擬的','改 Value、按「注入錯誤」就會重算；「對話框」那一格模擬 Simple Error Handler 跳出的視窗。'),
{steps:{title:'C10_Errors.vi：產生、合併、顯示、清除',lv:errVI,steps:[
 {t:'前面板',view:'fp',add:['val','inj','eo','ec','dlg'],h:`<p>Numeric Control <code>Value</code>；${ctl('Modern','Array, Matrix & Cluster','Error In 3D.ctl')}；兩個 ${ctl('Modern','Array, Matrix & Cluster','Error Out 3D.ctl')}，標籤 <code>error out</code>、<code>Clear Errors 之後</code>。</p>`},
 {t:'自訂錯誤：Value > 100 就是 5001',view:'bd',add:['val','k100','gt','k5001','k0','sel','kmsg','ecfc','w1','w2','w3','w4','w5','w6','w7'],h:`<p>${fn('Programming','Comparison','Greater?')} 跟 <code>100</code> 比；${fn('Programming','Comparison','Select')} 的 t 接 <code>5001</code>、f 接 <code>0</code>。</p><p>${fn('Programming','Dialog & User Interface','Error Cluster From Error Code.vi')} ${qd('Error Cluster From Error Code')}：error code 接 Select 的輸出，error message 接說明文字（字串常數 <code>Value 超過 100</code>）。碼用 5000～9999 這一段，才不會跟 NI 的碼撞在一起。</p>`},
 {t:'Merge Errors：兩條錯誤線合一',view:'bd',add:['ein','merge','w8','w9'],h:`<p>${fn('Programming','Dialog & User Interface','Merge Errors')} ${qd('Merge Errors')}：</p>${wt([
 ['Error Cluster From Error Code 的 error out','Merge Errors 的 error 1','自訂的錯誤'],
 ['error in','Merge Errors 的 error 2','從上游帶進來的錯誤']])}<p>Merge Errors 由上往下找，回報<b>第一個</b>錯誤。</p>`},
 {t:'Simple Error Handler：顯示，但不清掉',view:'bd',add:['seh','eo','w10','w11'],h:`<p>${fn('Programming','Dialog & User Interface','Simple Error Handler.vi')}：有錯就跳對話框。注意它的 error out <b>還是那個錯誤</b>：它只負責顯示。</p>`},
 {t:'Clear Errors：清掉，但不顯示',view:'bd',add:['clr','ec','w12','w13'],h:`<p>從 Merge Errors 的輸出拉一條分岔到 ${fn('Programming','Dialog & User Interface','Clear Errors.vi')} ${qd('Clear Errors')}。它的輸出永遠是「沒有錯誤」，而且什麼都不會跳出來。</p><div class="warn"><b>Clear Errors 要先記錄再清</b>直接清掉等於假裝沒事。I11、I13 的做法都是：先把錯誤寫進紀錄或顯示出來，確定處理過了，才清。</div>`},
 {t:'Run：四種組合各試一次',view:'split',add:[],h:`<p>Value 50／150，「注入錯誤」開／關，四種組合都看一次：error out 的 code 是多少？Clear Errors 之後呢？對話框有沒有跳？</p>`}
]}},
ask('改一個數字，先預測結果：Value 改成 150，而且按下「注入錯誤」。error out 的 code 是 5001 還是 -1073807339？如果想讓上游的錯誤優先，要改哪裡？',
 `<p>是 <b>5001</b>：兩個都是錯誤時，Merge Errors 回報第一個，自訂的錯誤接在 error 1。另一個錯誤不會出現在 error out。</p>
<p>想讓上游的錯誤優先，就把 error in 接到 error 1、自訂的接到 error 2。一般的習慣是「先發生的錯誤先報」：上游的錯誤通常才是根本原因，後面的錯誤常常是被它連累的。</p>`)
];

/* ======================================================================
   C10 錯誤處理與除錯進階
   ====================================================================== */
L.push({id:'C10',order:110,no:'C10',part:PART,title:'錯誤處理進階：錯誤與警告、自訂錯誤、處理策略',mins:40,
goals:[['學會','錯誤和警告的差別、自動錯誤處理、Simple 與 General Error Handler、Merge Errors、自訂錯誤碼、錯誤處理策略。'],['考試重點','status = False 但 code ≠ 0 是「警告」；error in 有錯時大部分函式不執行，但 Close、Release 類的函式照樣執行。'],['動畫練習','<a href="lab-cluster.html#err">叢集實驗室：錯誤叢集</a>：錯誤與警告的差別、Merge Errors、Clear Errors 一步一步看。']],
check:'能分辨 status/code 的四種組合各代表什麼。',
body:[
C.h3('懂','','錯誤、警告、沒事'),
C.table(['status','code','意思'],[['False','0','沒事'],['False','≠ 0','<b>警告</b>：完成了但有事情要注意（例如第 13 課看到的 1073676294）'],['True','≠ 0','<b>錯誤</b>：失敗了'],['True','0','不正常的寫法（自訂錯誤要給碼）']]),
C.table(['工具','說明'],[
 ['Automatic error handling','VI Properties ▸ Execution 預設啟用：<b>error out 沒接線</b>的節點出錯時，跳出對話框並暫停。有接線就不會自動處理'],
 ['Simple Error Handler.vi','有錯就跳對話框（OK），通常放在程式最後'],
 ['General Error Handler.vi','可加自訂錯誤碼表、選擇對話框種類、清除特定錯誤'],
 ['Merge Errors','多條錯誤線合一，回報<b>第一個錯誤</b>（沒有錯誤時回報第一個警告）'],
 ['Clear Errors.vi','清掉錯誤（可指定特定錯誤碼）'],
 ['Error Cluster From Error Code.vi','用錯誤碼產生錯誤 Cluster'],
 ['Error Ring','下拉選單選錯誤碼，可帶參數'],
 ['自訂錯誤碼','<b>5000～9999</b> 和 <b>-8999～-8000</b> 保留給使用者；可用 Error Code Editor 做 -errors.txt 檔，讓 LabVIEW 顯示你的錯誤說明']
]),
C.h3('懂','','處理策略'),
`<ul><li><b>錯誤線串起來</b>：決定順序、出錯自動跳過後面（第 11 課）。</li>
<li><b>Close / Release 類函式出錯照樣執行</b>：VISA Close、Close File、Release Queue 在 error in 有錯時仍會關閉資源，避免資源洩漏。</li>
<li><b>迴圈裡的錯誤</b>：決定要停止迴圈（錯誤線接 Loop Condition）、重試（第 19 課重連）、還是記錄後清除繼續。</li>
<li><b>Shift Register 放錯誤線</b>：讓錯誤能延續到下一圈處理。</li>
<li>錯誤通常在最上層（主 VI）統一顯示，SubVI 只負責把錯誤正確傳出去。</li></ul>`,
...C10_LV,
C.h3('測','q','小測驗'),
{quiz:[
 {q:'error out 顯示 status = False、code = 1073676294，這代表？',o:['錯誤','警告','沒事','LabVIEW 當機'],a:1,ex:'status False + code 非 0 = 警告。'},
 {q:'VISA Read 的 error out 沒有接線，執行時逾時了，預設會？',o:['什麼都不發生','自動錯誤處理：跳出對話框並暫停','VI 斷掉','自動重試'],a:1,ex:'Automatic error handling 只對沒接線的 error out 生效。'},
 {q:'Merge Errors 有三個輸入：無錯誤、錯誤 A（code 7）、錯誤 B（code 42），輸出？',o:['錯誤 A','錯誤 B','兩個都有','無錯誤'],a:0,ex:'回報第一個錯誤（由上到下）。'},
 {q:'哪些錯誤碼範圍可以自訂？',o:['0～100','5000～9999 和 -8999～-8000','任何負數','只能用 NI 的碼'],a:1,ex:'這兩段保留給使用者。'},
 {q:'Close File 的 error in 有錯誤時，它會？',o:['不執行','照樣關閉檔案，並把錯誤傳出去','清除錯誤','跳出對話框'],a:1,ex:'釋放資源的函式在有錯時仍會執行。'}
]}
]});

/* ======================================================================
   C11 圖表與 UI
   ====================================================================== */
function chartDemo(d){
  d.innerHTML=`<div class="fig"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
   <b>Waveform Chart 的三種 Update Mode：</b><label><input type="radio" name="cm" value="strip" checked> Strip Chart（預設）</label>
   <label><input type="radio" name="cm" value="scope"> Scope Chart</label><label><input type="radio" name="cm" value="sweep"> Sweep Chart</label>
   <button class="btn" data-a="clr">清除歷史</button></div>
   <canvas width="640" height="180" style="background:#111;border:1px solid #555;max-width:100%"></canvas>
   <div class="cap">每 50 ms 送一個點進 Chart（正弦波 + 雜訊）。Strip：從右邊進來往左捲；Scope：畫滿一格清掉重來；Sweep：像心電圖，紅線往右掃過去覆蓋舊資料。</div></div>`;
  const cv=d.querySelector('canvas'),ctx=cv.getContext('2d');let mode='strip',hist=[],t=0,sweepPos=0,scopeBuf=[];const W=160;
  d.querySelectorAll('input').forEach(r=>r.onchange=()=>{mode=r.value;hist=[];scopeBuf=[];sweepPos=0;});
  d.querySelector('[data-a=clr]').onclick=()=>{hist=[];scopeBuf=[];sweepPos=0;};
  const y=v=>90-v*70;
  const tm=setInterval(()=>{
    if(!document.body.contains(cv)){clearInterval(tm);return;}
    const v=Math.sin(t/8)*0.8+(Math.random()-.5)*0.25;t++;
    ctx.fillStyle='#111';ctx.fillRect(0,0,640,180);ctx.strokeStyle='#333';for(let i=0;i<=8;i++){ctx.beginPath();ctx.moveTo(i*80,0);ctx.lineTo(i*80,180);ctx.stroke();}
    ctx.strokeStyle='#4f4';ctx.beginPath();
    if(mode==='strip'){hist.push(v);if(hist.length>W)hist.shift();hist.forEach((p,i)=>{const x=(W-hist.length+i)*4;i?ctx.lineTo(x,y(p)):ctx.moveTo(x,y(p));});}
    else if(mode==='scope'){scopeBuf.push(v);if(scopeBuf.length>W)scopeBuf=[v];scopeBuf.forEach((p,i)=>{i?ctx.lineTo(i*4,y(p)):ctx.moveTo(i*4,y(p));});}
    else{if(hist.length<W)hist.push(v);else hist[sweepPos]=v;sweepPos=(sweepPos+1)%W;hist.forEach((p,i)=>{if(i===sweepPos)ctx.moveTo(i*4,y(p));else i?ctx.lineTo(i*4,y(p)):ctx.moveTo(i*4,y(p));});ctx.stroke();ctx.strokeStyle='#f44';ctx.beginPath();ctx.moveTo(sweepPos*4,0);ctx.lineTo(sweepPos*4,180);}
    ctx.stroke();
  },50);
}
const dispVI={name:'C11_Display.vi',view:'split',ratio:1.5,
 fp:{w:380,h:400,items:[
  {id:'temp',k:'num',label:'Temperature (°C)',x:16,y:16,w:110,dig:1},
  {id:'pts',k:'num',label:'Graph 的點數',x:160,y:16,w:90},
  {id:'stop',k:'btn',label:'stop',text:'STOP',x:296,y:20,stop:true},
  {id:'chart',k:'chart',label:'Waveform Chart（一次一點；網頁把歷史長度設成 50）',x:16,y:76,w:300,h:100,min:15,max:35},
  {id:'graph',k:'chart',label:'Waveform Graph（每圈整個陣列重畫；點多時網頁抽樣畫）',x:16,y:216,w:300,h:100,min:15,max:35}]},
 bd:{w:640,h:300,structs:[{id:'wl',k:'while',x:60,y:20,w:560,h:260}],
  nodes:[
  {id:'karr',k:'const',t:'dbl[]',v:'[ ]',x:16,y:187},
  {id:'sra',k:'sr',t:'dbl[]',s:'wl',y:196},
  {id:'rnd',k:'fn',fn:'Random Number (0-1)',x:90,y:60},
  {id:'k10',k:'const',t:'dbl',v:10,x:120,y:96},
  {id:'mul',k:'fn',fn:'Multiply',x:150,y:69},
  {id:'k20',k:'const',t:'dbl',v:20,x:166,y:100},
  {id:'add',k:'fn',fn:'Add',x:200,y:69},
  {id:'temp',k:'ind',t:'dbl',label:'Temperature (°C)',x:300,y:73},
  {id:'chart',k:'ind',t:'dbl',label:'Waveform Chart',x:300,y:125},
  {id:'ba',k:'fn',fn:'Build Array',x:300,y:185,ins:['array','element'],outs:['appended array']},
  {id:'graph',k:'ind',t:'dbl[]',label:'Waveform Graph',x:380,y:191},
  {id:'asz',k:'fn',fn:'Array Size',x:440,y:140},
  {id:'pts',k:'ind',t:'i32',label:'Graph 的點數',x:500,y:146},
  {id:'k100',k:'const',t:'i32',v:100,x:100,y:240},
  {id:'wait',k:'fn',fn:'Wait (ms)',x:140,y:233},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:530,y:248},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w1',from:'karr',to:'sra.init',t:'dbl[]'},
  {id:'w2',from:'rnd',to:'mul.x',t:'dbl'},
  {id:'w3',from:'k10',to:'mul.y',t:'dbl',pts:[[145,105],[145,90]]},
  {id:'w4',from:'mul.out',to:'add.x',t:'dbl'},
  {id:'w5',from:'k20',to:'add.y',t:'dbl',pts:[[192,109],[192,97]]},
  {id:'w6',from:'add.out',to:'temp',t:'dbl'},
  {id:'w7',from:'add.out',to:'chart',t:'dbl',pts:[[260,83],[260,135]]},
  {id:'w8',from:'sra.L',to:'ba.array',t:'dbl[]'},
  {id:'w9',from:'add.out',to:'ba.element',t:'dbl',pts:[[260,83],[260,206]]},
  {id:'w10',from:'ba.appended array',to:'graph',t:'dbl[]'},
  {id:'w11',from:'ba.appended array',to:'sra.R',t:'dbl[]',pts:[[360,201],[360,240],[600,240],[600,196]]},
  {id:'w12',from:'ba.appended array',to:'asz.array',t:'dbl[]',pts:[[372,201],[372,156]]},
  {id:'w13',from:'asz.size',to:'pts',t:'i32'},
  {id:'w14',from:'k100',to:'wait',t:'i32'},
  {id:'w15',from:'stop',to:'cond',t:'bool'}]},
 sim:{period:150,init(){return {arr:[],seed:3};},step(i,st,ctx){
  st.seed=(st.seed*1103515245+12345)&0x7fffffff;const r=st.seed/0x7fffffff,v=+(20+10*r).toFixed(3);
  st.arr.push(v);const n=st.arr.length,step=Math.max(1,Math.ceil(n/150));
  const g=st.arr.filter((_,k)=>k%step===0),stp=!!i.stop;
  return {out:{temp:v,chart:st.arr.slice(-50),graph:g,pts:n},stop:stp,msg:stp?'按了 STOP':'第 '+ctx.i+' 圈：Chart 收到 1 個點（最多留 50 點）；Graph 收到整個陣列，'+n+' 點',
   vals:{rnd:r,k10:10,k20:20,'mul.out':10*r,'add.out':v,'sra.L':'['+(n-1)+' 點]','ba.appended array':'['+n+' 點]','asz.size':n,k100:100,stop:stp,karr:'[ ]'}};
 },doneMsg:'迴圈結束'}
};
const C11_LV=[
C.h3('做','b','動手寫：C11_Display.vi（同一筆資料，三種呈現）'),
`<p>同一個溫度值，每一圈同時送給 Numeric Indicator、Waveform Chart、Waveform Graph。跑起來比一比：Chart 自己記歷史，Graph 只畫你給它的那個陣列。</p>`,
C.plan({
 start:'File ▸ New VI，存成 <code>練習\\C11_Display.vi</code>。',
 in:'每一圈用 Random Number (0-1) 產生一個假的溫度：DBL，20～30 °C（代替真的感測器）。',
 calc:'隨機數 × 10 ＋ 20。另外用一個 Shift Register 存「到目前為止的所有點」，每圈 Build Array 把新的一點接在後面。',
 out:'Numeric Indicator <code>Temperature (°C)</code>：單位寫在標籤上，Display Format 小數 1 位。Waveform Chart：每圈給<b>一個點</b>，它自己留歷史（Chart History Length，預設 1024 點）。Waveform Graph：每圈給<b>整個陣列</b>，整張重畫。Array Size 顯示 Graph 現在有幾點。',
 loop:'While Loop，Wait 100 ms：一秒 10 點。顯示元件都在迴圈裡面，才會每圈更新。',
 end:'STOP 按鈕。注意 Shift Register 裡的陣列會一直變長：跑一整天就是 86 萬點，記憶體一直加（下面的問題）。'}),
note('VI 視窗是網頁模擬的','為了看得出差別，網頁上 Chart 的歷史長度設成 50 點（LabVIEW 預設 1024）；點數多時 Graph 會抽樣畫。'),
{steps:{title:'C11_Display.vi：一個值，三種顯示',lv:dispVI,steps:[
 {t:'前面板：三種顯示元件',view:'fp',add:['temp','chart','graph','pts','stop'],h:`<p>${ctl('Modern','Numeric','Numeric Indicator')} 標籤 <code>Temperature (°C)</code>；${ctl('Modern','Graph','Waveform Chart')}；${ctl('Modern','Graph','Waveform Graph')}；Numeric Indicator <code>Graph 的點數</code>（I32）；Stop Button。</p>
<p>Temperature 右鍵 ▸ <b>Display Format</b>：Type 選 Floating point、Digits 填 <code>1</code>、選 Digits of precision。單位不要放進數值，寫在標籤上。</p>`},
 {t:'While Loop、Wait 100 ms、STOP',view:'bd',add:['wl','k100','wait','stop','cond','w14','w15'],h:`<p>While Loop 裡放 Wait (ms) 接 <code>100</code>，Loop Condition 上 Create Control（stop）。</p>`},
 {t:'產生資料：Random × 10 ＋ 20',view:'bd',add:['rnd','k10','mul','k20','add','w2','w3','w4','w5'],h:`<p>${fn('Programming','Numeric','Random Number (0-1)')} ${qd('Random')}、Multiply 接 <code>10</code>、Add 接 <code>20</code>：每圈一個 20～30 的 DBL。</p>`},
 {t:'Numeric Indicator 和 Chart：都只給一個點',view:'bd',add:['temp','chart','w6','w7'],h:`${wt([
 ['Add 的 x+y','Temperature (°C)','只顯示最新一個'],
 ['同一條線分岔','Waveform Chart','純量：Chart 接在歷史後面']])}
<p>Chart 右鍵 ▸ <b>Chart History Length…</b> 可以改它記幾點（預設 1024）。超過就把最舊的丟掉。</p>`},
 {t:'Graph：給它整個陣列',view:'bd',add:['karr','sra','ba','graph','asz','pts','w1','w8','w9','w10','w11','w12','w13'],h:`<p>迴圈左框右鍵 Add Shift Register，外面接一個<b>空的 DBL 陣列常數</b>當初始值。${fn('Programming','Array','Build Array')}：上面接 Shift Register（陣列）、下面接這一圈的值，輸出就是「陣列後面多一點」。</p>${wt([
 ['Build Array 的 appended array','Waveform Graph','每圈整個陣列重畫'],
 ['同一條線','Shift Register 右邊','存給下一圈'],
 ['同一條線','Array Size → Graph 的點數','看陣列一直變長']])}`},
 {t:'Run：比一比',view:'split',add:[],h:`<p>Run 一陣子：Temperature 只有一個數；Chart 的線往左捲，最舊的點會消失；Graph 每圈整張重畫，點越來越多（X 軸一直變長），Graph 的點數一直加。</p>`}
]}},
ask('改一個數字，先預測結果：Chart History Length 用 LabVIEW 預設的 1024，讓迴圈跑 2000 圈。Chart 上剩幾點？Graph 上有幾點？如果把 Graph 和 Build Array 移到迴圈<b>外面</b>（用自動索引的 Tunnel 收資料），跑的時候 Graph 會怎樣？',
 `<p>Chart 只剩最後 <b>1024</b> 點，前面 976 點被丟掉了；Graph 有 <b>2000</b> 點，因為陣列是你自己存的，一點都沒丟，記憶體也一直變大。</p>
<p>移到迴圈外面：跑的時候 Graph <b>一直是空的</b>，按 STOP、迴圈結束後，自動索引的 Tunnel 才把整個陣列一次送出去，Graph 這時才出現 2000 點。所以：要邊跑邊看，用 Chart（或在迴圈裡給 Graph 陣列）；要跑完看全部、存檔、分析，用 Graph。</p>`)
];

L.push({id:'C11',order:111,no:'C11',part:PART,title:'Chart、Graph 與使用者介面',mins:50,
goals:[['學會','Waveform Chart 與 Graph 的差別、Chart 的更新模式與歷史長度、各種 Graph 接受的資料、多條曲線、常用 UI 技巧。'],['考試重點','Chart 一次加一個（或一段）點並保留歷史；Graph 每次重畫整個陣列；XY Graph 要 X、Y 兩個陣列。'],['動畫練習','<a href="lab-graph.html">圖表實驗室</a>：同一筆資料同時送給 Chart 和 Graph，看純量、1D、2D、Bundle、Waveform 各畫出什麼；<a href="lab-graph.html#xy">XY Graph 畫圓</a>。'],['動畫練習','<a href="lab-prop.html#val">屬性節點實驗室：Value 與事件</a>：Local Variable、Value、Value (Signaling) 哪一種會觸發 Value Change。'],['動畫練習','<a href="lab-wave.html#wf">波形實驗室：Waveform</a>：改 dt 時 Graph 的 X 軸跟著變，Y 一個數字都沒變。'],['動畫練習','<a href="lab-invoke.html#cls">方法節點實驗室：類別階層</a>：控制參考接得上哪一種 Refnum 輸入、什麼時候要 To More Specific Class。'],['動畫練習','<a href="lab-panel.html">人機介面設計工作室</a>：Label 與 Caption、上色與透明、Control Editor 的 Customize Mode、Tab Control 的值，18 種題型隨機練。']],
check:'能說出 Waveform Graph、XY Graph、Waveform Chart 各接什麼資料。',
body:[
C.h3('懂','','Chart 和 Graph 的差別'),
C.table(['','Waveform Chart','Waveform Graph','XY Graph'],[
 ['資料來源','一次一個點（純量）或一小段（陣列），<b>接在歷史後面</b>','每次給整個陣列，<b>整張重畫</b>','每次給整組 X、Y 資料'],
 ['記憶','有歷史緩衝區，預設 <b>1024 點</b>（Chart History Length）','沒有歷史','沒有歷史'],
 ['通常放在','迴圈裡面','迴圈外面，或每圈畫一次完整資料','任意'],
 ['X 軸','點的序號（可設 dt）','x0 + i × dx','任意 X 值，不需等間距'],
 ['多條曲線','把多個純量 <b>Bundle</b> 成 Cluster；或 2D 陣列','<b>2D 陣列</b>（每列一條）或 Waveform 陣列','Cluster(X 陣列, Y 陣列) 組成陣列']
]),
{fn:chartDemo},
C.table(['Waveform Graph 接受的資料','說明'],[['1D 陣列','x0 = 0、dx = 1'],['Cluster (x0, dx, Y 陣列)','自訂起點和間隔'],['Waveform','t0、dt、Y'],['2D 陣列','每一列一條曲線（可右鍵 Transpose Array）'],['Waveform 陣列','多條曲線，各自有自己的 t0、dt']]),
C.h3('懂','','常用 UI 技巧'),
C.table(['需求','做法'],[
 ['改顏色、隱藏、反灰','Property Node（C8）：Visible、Disabled、BG Color'],
 ['分頁','Tab Control（第 18 課）'],
 ['把另一個 VI 的前面板嵌進來','SubPanel 控制項 + Invoke Node Insert VI'],
 ['程式啟動時把控制項恢復預設值','Invoke Node：Reinitialize All to Default（VI 層級）'],
 ['多條曲線的名稱','Plot Legend 拉長，或 Property Node Plot.Name'],
 ['大量資料畫圖很慢','降低更新頻率、減少點數（降採樣），或在 Defer Panel Updates 期間一次更新'],
 ['游標量測','Graph 右鍵 Visible Items ▸ Cursor Legend']
]),
...C11_LV,
C.h3('測','q','小測驗'),
{quiz:[
 {q:'While Loop 每圈產生一個溫度值，要畫出隨時間變化的曲線，最簡單的顯示元件？',o:['Waveform Graph','Waveform Chart','XY Graph','Intensity Graph'],a:1,ex:'Chart 每次加一個點並保留歷史。'},
 {q:'Waveform Chart 預設的歷史長度？',o:['100 點','1024 點','無限','10000 點'],a:1,ex:'可右鍵 Chart History Length 改。'},
 {q:'Chart 要同時畫三條曲線（每圈三個純量），要怎麼接？',o:['用 Build Array 組成陣列','用 Bundle 組成 Cluster','接三次','不行'],a:1,ex:'給 Chart 一個 Cluster 代表同一時刻的多條曲線；給陣列會被當成同一條曲線的多個點。'},
 {q:'X 值不是等間距（例如溫度對應壓力），要用？',o:['Waveform Chart','Waveform Graph','XY Graph','Waveform Chart 的 Sweep 模式'],a:2,ex:'XY Graph 接 Cluster(X 陣列, Y 陣列)。'},
 {q:'Waveform Graph 接一個 2D 陣列，預設會？',o:['畫一條很長的曲線','每一列畫一條曲線','錯誤','只畫第一列'],a:1,ex:'可右鍵 Transpose Array 改成每一行一條。'},
 {q:'哪一種 Chart 更新模式像心電圖一樣，用一條線掃過去覆蓋舊資料？',o:['Strip Chart','Scope Chart','Sweep Chart','History Chart'],a:2,ex:'Strip 捲動、Scope 清掉重畫、Sweep 掃描覆蓋。'}
]}
]});

/* ======================================================================
   C12 DAQmx 與儀器控制
   ====================================================================== */
const daqFig={name:'DAQmx 連續擷取的標準寫法',bd:{w:860,h:200,structs:[{id:'wl',k:'while',x:350,y:20,w:270,h:160}],nodes:[
  {id:'ch',k:'const',t:'str',v:'Dev1/ai0',x:10,y:30},
  {id:'cv',k:'fn',fn:'DAQmx Create Virtual Channel',x:80,y:30,name:'Create Channel'},
  {id:'tm',k:'fn',fn:'DAQmx Timing',x:170,y:30,name:'Timing (Sample Clock)'},
  {id:'mode',k:'const',t:'enum',v:'Continuous ▾',x:100,y:130},{id:'rate',k:'const',t:'dbl',v:1000,x:120,y:105},
  {id:'st',k:'fn',fn:'DAQmx Start Task',x:270,y:30,name:'Start'},
  {id:'rd',k:'fn',fn:'DAQmx Read',x:420,y:30,name:'Read (N samples)'},{id:'k100',k:'const',t:'i32',v:100,x:370,y:120},
  {id:'gr',k:'ind',t:'dbl[]',label:'Waveform Chart',x:530,y:56},{id:'cond',k:'stop',s:'wl'},
  {id:'sp',k:'fn',fn:'DAQmx Stop Task',x:650,y:30,name:'Stop'},{id:'cl',k:'fn',fn:'DAQmx Clear Task',x:730,y:30,name:'Clear'},{id:'seh',k:'fn',fn:'Simple Error Handler',x:805,y:36,showName:false}],
 wires:[{id:'w1',from:'ch',to:'cv.physical channels',t:'str'},{id:'w2',from:'cv.task out',to:'tm.task/channels in',t:'clu'},{id:'w3',from:'cv.error out',to:'tm.error in',t:'err'},
  {id:'w4',from:'rate',to:'tm.rate',t:'dbl',mx:160},{id:'w5',from:'mode',to:'tm.sample mode',t:'enum',mx:162},
  {id:'w6',from:'tm.task out',to:'st.task/channels in',t:'clu'},{id:'w7',from:'tm.error out',to:'st.error in',t:'err'},
  {id:'w8',from:'st.task out',to:'rd.task/channels in',t:'clu'},{id:'w9',from:'st.error out',to:'rd.error in',t:'err'},{id:'w10',from:'k100',to:'rd.number of samples per channel',t:'i32',mx:405},
  {id:'w11',from:'rd.data',to:'gr',t:'dbl[]'},{id:'w12',from:'rd.error out',to:'cond',t:'err',pts:[[480,80],[480,148]]},
  {id:'w13',from:'rd.task out',to:'sp.task/channels in',t:'clu'},{id:'w14',from:'rd.error out',to:'sp.error in',t:'err',mx:640},
  {id:'w15',from:'sp.task out',to:'cl.task/channels in',t:'clu'},{id:'w16',from:'sp.error out',to:'cl.error in',t:'err'},{id:'w17',from:'cl.error out',to:'seh',t:'err'}]}};
L.push({id:'C12',order:112,no:'C12',part:PART,title:'硬體：DAQmx 擷取與儀器控制',mins:60,
goals:[['學會','MAX、DAQmx 的 Task/Channel/Timing、有限與連續擷取、取樣率與緩衝區、類比輸入接法、儀器控制（GPIB/Serial/USB/Ethernet）、VISA、儀器驅動程式。'],['考試重點','DAQmx 的呼叫順序、連續擷取每次讀多少、緩衝區溢位錯誤的原因、VISA 資源名稱、Instrument Driver 的好處。'],['動畫練習','<a href="lab-daq.html">DAQ 實驗室</a>：取樣率不夠時的混疊、解析度與範圍怎麼算最小可分辨電壓、<a href="lab-daq.html#buf">DAQmx 流程與緩衝區溢位（錯誤 -200279）</a>。'],['動畫練習','<a href="lab-wave.html">波形實驗室</a>：DAQ 讀回來的 Waveform 怎麼拆出 dt；Mean、RMS、標準差在圖上畫出來；移動平均濾雜訊的代價。']],
check:'能默寫 DAQmx 連續擷取的六個步驟。',
body:[
C.h3('懂','','NI MAX（Measurement & Automation Explorer）'),
C.table(['功能','用途'],[['Devices and Interfaces','看到接上的 DAQ 卡、GPIB、序列埠；Self-Test、Reset'],['Test Panels','不用寫程式直接量一次，確認接線'],['Simulated Device','沒有硬體時建立模擬 DAQ 卡，程式照寫（就像本課程的軟 PLC）'],['Data Neighborhood / Tasks','在 MAX 裡預先建立 DAQmx Task'],['Scales','把電壓換算成工程單位']]),
C.h3('懂','','DAQmx 的六個步驟'),
{lv:daqFig,cap:'Create Channel → Timing → Start →（迴圈）Read → Stop → Clear → 錯誤處理。Task 線和錯誤線一路串。'},
C.table(['名詞','意思'],[
 ['Physical Channel','硬體腳位，例如 Dev1/ai0'],['Virtual Channel','腳位 + 設定（量程、接法、單位）'],['Task','一組 Channel + 時序 + 觸發'],
 ['Sample Clock','取樣率（每秒幾點）'],['Finite Samples','擷取固定點數就結束'],['Continuous Samples','一直擷取，資料存進<b>緩衝區</b>，程式要持續讀'],
 ['DAQ Assistant','Express VI，對話框設定（快但彈性小）']
]),
warn('緩衝區溢位','連續擷取時，如果迴圈讀得比硬體寫得慢，緩衝區會滿，出現錯誤 <b>-200279</b>（應用程式沒跟上）。解法：每次多讀一些（常用取樣率的 1/10，也就是每 100 ms 讀一次）、迴圈裡不要做慢的事（存檔交給另一個迴圈：Producer/Consumer）。'),
C.table(['取樣與接線','重點'],[
 ['Nyquist','取樣率至少是訊號最高頻率的 <b>2 倍</b>才不會失真（混疊）；實務上 5～10 倍'],
 ['Differential','兩條線相減，抗雜訊最好，用掉兩個通道'],
 ['RSE（Referenced Single-Ended）','以 DAQ 的地為參考；訊號源浮接時用'],
 ['NRSE','以 AI SENSE 為參考；訊號源本身接地時可用'],
 ['量程（min/max value）','設得越接近實際範圍，解析度越好']
]),
C.h3('懂','','儀器控制'),
C.table(['介面','VISA 資源名稱例子','說明'],[
 ['GPIB','GPIB0::12::INSTR','傳統儀器匯流排，位址 0～30'],['Serial（RS-232/422/485）','ASRL3::INSTR（COM3）','要設定鮑率、資料位、同位、停止位、終止字元（本課程第 12 課）'],
 ['USB（USBTMC）','USB0::0x0957::0x1798::MY123::INSTR','—'],['Ethernet（LXI）','TCPIP0::192.168.1.10::INSTR','也可用 ::SOCKET 直接 TCP（本課程軟 PLC）']
]),
`<ul><li><b>VISA</b> 讓不同介面用同一組函式（Open、Write、Read、Close），換介面只改資源名稱。</li>
<li><b>SCPI</b> 是儀器的標準文字命令，例如 <code>*IDN?</code> 問儀器型號、<code>*RST</code> 重設。</li>
<li><b>Instrument Driver</b>：廠商或 NI 寫好的一組 VI（Initialize、Configure、Read、Close），不用自己查命令。用 <b>Help ▸ Find Instrument Drivers</b>（NI Instrument Driver Network, IDNet）下載，會放到 instr.lib，出現在 Instrument I/O ▸ Instrument Drivers。</li>
<li>讀不到資料最常見的原因：終止字元（\\n 或 \\r）設錯、byte count 不對、逾時太短。</li></ul>`,
C.h3('測','q','小測驗'),
{quiz:[
 {q:'DAQmx 連續擷取的正確順序？',o:['Read → Create → Start → Clear','Create Channel → Timing → Start → Read（迴圈）→ Stop → Clear','Start → Create → Read → Stop','Timing → Read → Create → Clear'],a:1,ex:'建立、時序、開始、讀、停止、清除。'},
 {q:'連續擷取時出現錯誤 -200279，最可能的原因？',o:['接線錯誤','程式讀得太慢，緩衝區溢位','取樣率太低','沒有 Start'],a:1,ex:'應用程式沒跟上硬體寫入的速度。'},
 {q:'要量一個最高 1 kHz 的訊號而不混疊，取樣率至少？',o:['500 Hz','1 kHz','2 kHz','10 Hz'],a:2,ex:'Nyquist：至少 2 倍。'},
 {q:'沒有實體 DAQ 卡，想先寫程式測試，怎麼辦？',o:['不行','在 MAX 建立 Simulated Device','用 Global Variable 代替','改用 Express VI'],a:1,ex:'模擬裝置會產生假資料，程式完全一樣。'},
 {q:'VISA 資源名稱 "GPIB0::5::INSTR" 代表？',o:['COM5','GPIB 介面卡 0 上位址 5 的儀器','USB 第 5 台','TCP 埠 5'],a:1,ex:'介面::位址::INSTR。'},
 {q:'使用 Instrument Driver 的主要好處？',o:['速度更快','不用自己查儀器的命令，有現成的 Initialize/Configure/Read/Close VI','不需要 VISA','可以不接線'],a:1,ex:'驅動程式底層通常也是 VISA。'},
 {q:'抗雜訊最好的類比輸入接法？',o:['RSE','NRSE','Differential','Pseudodifferential'],a:2,ex:'差動接法兩線相減，共模雜訊被消掉。'},
 {q:'問儀器「你是誰」的 SCPI 命令是？',o:['*RST','*IDN?','*CLS','MEAS?'],a:1,ex:'*IDN? 回傳廠牌、型號、序號、韌體版本。'}
]}
]});
})();
