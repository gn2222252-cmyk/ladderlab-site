/* 高階實務 H4：TestStand 和 LabVIEW 怎麼分工。
   證據（docs/research_advanced.md 1.4）：資深職缺最常見的進階工具是 TestStand（21 則裡 7 則，都是國外對照）；PTT P01 一家用 TestStand 除錯產線、
   P04「有 LabVIEW 團隊的公司多半有一套類似 TestStand 的框架」。
   事實來源：docs/research_teststand.md（助理整理，NI TestStand Reference Manual 373435E、Using LabVIEW with TestStand 373200C、
   Code Module Development Best Practices、Report Generation and Customization、授權頁；頁碼寫在該檔）。
   本機沒有裝 TestStand：這一課沒有實機操作，課文有註明；模擬器是照手冊寫的執行規則做的。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='高階實務';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary><div class="ans">${a}</div></details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

/* ---- W6 的五個測項，搬到 TestStand ---- */
const T=[
 {id:'T01',n:'無載輸入電流 mA',lo:5,hi:30,v:17},
 {id:'T02',n:'無載輸出電壓 V',lo:4.90,hi:5.10,v:5.02,d:2},
 {id:'T03',n:'滿載輸出電壓 V',lo:4.85,hi:5.10,v:4.97,d:2},
 {id:'T04',n:'負載調整率 %',lo:0,hi:1.5,v:0.996},
 {id:'T05',n:'滿載效率 %',lo:85,hi:100,v:88.6}
];

/* ---- 模擬器：照手冊的規則跑一片 ----
   規則（research_teststand.md）：Numeric Limit Test 由 TestStand 比上下限；module 的 error out 接到 Step.Result.Error，出錯時這一步是 Error
   （不是 Failed），並跳過 Post／Status Expression；Setup 或 Main 出錯、或操作員終止，跳到 Cleanup；Cleanup 一定跑、其中一步出錯也繼續。
   「出錯之後 Main 剩下的步驟不跑」是手冊預設行為（跳到 Cleanup）。 */
const SC=[
 {t:'正常的一片'},
 {t:'T02 只有 4.85 V（板子真的壞了）',bad:'T02',val:4.85},
 {t:'量到 T03 時，DMM 的 USB 線被碰掉',err:'T03'},
 {t:'量到 T03 時，操作員按 Terminate',term:'T03'}
];
function seqFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff;font-size:13px';
  el.innerHTML=`<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
   <label>這一片 <select data-k="s">${SC.map((s,i)=>`<option value="${i}">${s.t}</option>`).join('')}</select></label>
   <label>LabVIEW 的 code module <select data-k="m"><option value="0">有接 error out（照建議寫）</option><option value="1">把錯誤吞掉，照樣回傳一個數字（0）</option></select></label></div>
   <div data-o="out" style="margin-top:8px"></div>`;
  function run(){
    const s=SC[+el.querySelector('[data-k=s]').value],swallow=el.querySelector('[data-k=m]').value==='1';
    const R=[];let jump=false,why='';
    R.push(['Setup','Power On + 設定 5.00 V（Action）','Done']);
    R.push(['Setup','開 DMM 的 VISA session（Action）','Done']);
    let uut='Passed';
    for(const t of T){
      if(jump){R.push(['Main',t.id+' '+t.n,'（沒有執行）']);continue;}
      if(s.term===t.id){R.push(['Main',t.id+' '+t.n,'操作員在這一步按了 Terminate']);jump=true;why='操作員終止';uut='Terminated';continue;}
      if(s.err===t.id){
        if(swallow){R.push(['Main',t.id+' '+t.n,`Failed（量測值 0，下限 ${t.d?t.lo.toFixed(t.d):t.lo}）`]);if(uut==='Passed')uut='Failed';continue;}
        R.push(['Main',t.id+' '+t.n,'Error：VISA 讀取逾時（Step.Result.Error.Occurred = True）']);jump=true;why='run-time error';uut='Error';continue;}
      const v=s.bad===t.id?s.val:t.v,ok=v>=t.lo&&v<=t.hi,f=x=>t.d?x.toFixed(t.d):x;
      R.push(['Main',t.id+' '+t.n,(ok?'Passed':'Failed')+`（${f(v)}，${f(t.lo)}～${f(t.hi)}）`]);
      if(!ok&&uut==='Passed')uut='Failed';
    }
    if(s.err&&swallow){ // 後面的 DMM 讀取也都吞掉
      let after=false;R.forEach(r=>{if(r[0]==='Main'){if(r[1].startsWith(s.err))after=true;else if(after){const t=T.find(x=>r[1].startsWith(x.id));r[2]=`Failed（量測值 0，下限 ${t.d?t.lo.toFixed(t.d):t.lo}）`;}}});
      if(T.slice(T.findIndex(x=>x.id===s.err)).some(t=>t.lo<=0)){ // T04 下限 0：0 會被判 PASS
        R.forEach(r=>{if(r[1].startsWith('T04')&&r[2].startsWith('Failed'))r[2]='Passed（量測值 0，0～1.5）：DMM 根本沒接上，卻判 PASS';});
      }
    }
    R.push(['Cleanup','Power Off（Action）','Done']);
    R.push(['Cleanup','關 DMM 的 VISA session（Action）','Done']);
    const col=x=>/^Passed|^Done/.test(x)?'#1e7b34':/^Failed/.test(x)?'#b9770e':/沒有執行/.test(x)?'#888':'#c0392b';
    el.querySelector('[data-o=out]').innerHTML=`<table style="border-collapse:collapse;width:100%">${R.map(r=>`<tr><td style="padding:2px 6px;color:#555;width:70px">${r[0]}</td><td style="padding:2px 6px">${r[1]}</td><td style="padding:2px 6px;color:${col(r[2])}">${r[2]}</td></tr>`).join('')}</table>
     <p style="margin:8px 0 0">這一片的結果：<b style="color:${uut==='Passed'?'#1e7b34':uut==='Failed'?'#b9770e':'#c0392b'}">${uut}</b>。${
      jump?`Main 因為${why}沒有跑完，<b>但 Cleanup 照樣執行：電源關了、session 關了</b>。`:''}${
      s.err&&swallow?'<br><b style="color:#c0392b">錯誤被吞掉了：</b>報表上這一片是 FAIL（看起來是板子壞），其實是 DMM 掉線；T04 的下限是 0，量測值 0 還被判 PASS。修了板子也修不好，產線會一直誤判，直到有人發現 DMM 沒接。':''}${
      s.err&&!swallow?'<br>報表上這一片是 <b>Error</b>，不是 FAIL：操作員知道要檢查測試站，不是把板子丟進不良品區（W6 的 ERROR 也是同一個道理）。':''}</p>`;
  }
  el.querySelectorAll('select').forEach(x=>x.onchange=run);run();
}

/* ---- 一步一步寫：給 Numeric Limit Test 呼叫的 code module ---- */
const mv={name:'Measure_DCV.vi',view:'split',ratio:1.7,
 fp:{w:330,h:190,items:[
  {id:'dmm',k:'visa',ctl:true,label:'DMM session',options:['DMM (USB0::0x2A8D::...)'],x:12,y:8},
  {id:'st',k:'enum',ctl:true,label:'DMM（模擬用）',options:['正常，量到 4.97 V','USB 線被碰掉'],x:12,y:62,v:0},
  {id:'meas',k:'num',label:'measurement',x:12,y:120,w:70,dig:3},
  {id:'eo',k:'err',label:'error out',x:150,y:110}]},
 bd:{w:760,h:240,
  nodes:[
  {id:'dmm',k:'ctl',t:'visa',label:'DMM session',x:10,y:40},
  {id:'kc',k:'const',t:'str',v:'MEAS:VOLT:DC?',x:60,y:110},
  {id:'rd',k:'sub',name:'Query DMM.vi',top:'DMM',icon:['?','→DBL'],color:'#6b3fa0',ins:['VISA in','command'],outs:['VISA out','value'],err:true,x:220,y:40,w:56,h:62},
  {id:'meas',k:'ind',t:'dbl',label:'measurement',x:420,y:50},
  {id:'eo',k:'ind',t:'err',label:'error out',x:420,y:130}],
  wires:[
  {id:'w1',from:'dmm',to:'rd.VISA in',t:'visa'},
  {id:'w2',from:'kc',to:'rd.command',t:'str',mx:200},
  {id:'w3',from:'rd.value',to:'meas',t:'dbl'},
  {id:'w4',from:'rd.error out',to:'eo',t:'err',mx:380}]},
 sim:{init:()=>({}),
  step(inp){
   const bad=+inp.st===1;
   return {out:{meas:bad?0:4.97,eo:bad?{status:true,code:-1073807339,source:'VISA Read in Query DMM.vi'}:{status:false,code:0,source:''}},
    vals:{'rd.value':bad?0:4.97},
    msg:bad?'VISA 逾時：error out 的 status = T。TestStand 會把它放進 Step.Result.Error，這一步是 Error，然後跳到 Cleanup；measurement 的 0 不會被拿去比上下限（手冊：出錯時跳過 Post 和 Status Expression）。':'只回傳量測值。上下限 4.85～5.10 在 sequence 裡，由 Numeric Limit Test 比。'};},
  doneMsg:'換一種情況再 Run'}
};

L.push({id:'H4',order:41,no:'H4',part:PART,title:'TestStand 和 LabVIEW 的分工：把 W6 的測試站拆成「流程」和「量測」',mins:75,files:[],
goals:[['學會','TestStand 管什麼、LabVIEW 管什麼；Step Type 怎麼選（Numeric Limit、Pass/Fail、Action…）；寫出好被 TestStand 呼叫的 VI（只回量測值、接 error out）；Error 和 Failed 的差別、Cleanup 一定跑；Test UUTs 和 Single Pass；產線電腦裝哪一種授權、Run-Time 版本'],
 ['工作上','資深測試職缺最常寫的進階工具；進了用 TestStand 的公司，你寫的 LabVIEW 大多是被它呼叫的 code module，也常要用它除錯產線問題'],
 ['用到','W6 的測試站（上下限放檔案、ERROR 不算 PASS 也不算 FAIL、任何路徑都要斷電）；W19 的部署']],
check:'不看課文，能說出：上下限應該放在 LabVIEW 還是 TestStand、為什麼；VI 出錯時 TestStand 怎麼處理那一步和那一片；斷電的步驟放哪個群組；Single Pass 和 Test UUTs 差在哪；產線電腦要裝哪種授權。',
body:[
C.h3('這一課的工作','x','公司要把測試站改用 TestStand'),
`<p>W6 你用 LabVIEW 寫了 PM5 的功能測試站：掃序號、五個測項、上下限放檔案、判 PASS/FAIL、寫 CSV。新產品線要用同一套做法測三種電源，主管決定改用 TestStand：「流程、判定、報表交給 TestStand，你只要寫量測的 VI。」</p>
<p>這是很多公司的分工：<b>TestStand 管測試流程</b>（順序、判定、報表、資料庫、多工位、操作畫面），<b>LabVIEW 寫做事的程式</b>（控制儀器、量測），TestStand 叫它們 code module。</p>`,
note('為什麼有這一課（資料來源）','助理整理的資深測試職缺裡，TestStand 是最常出現的進階工具（21 則裡 7 則，都是國外對照）；PTT 上面試 17 家 LabVIEW 職缺的人，有一家的工作就是用 TestStand 除錯產線問題；另一位從業 12 年的人說，有 LabVIEW 團隊的公司多半已經有一套類似 TestStand 的框架。整理在 docs/research_advanced.md。'),
warn('這一課沒有實機操作','LadderLab 的電腦沒有安裝 TestStand。課文的每一條規則都出自 NI 的官方手冊（TestStand Reference Manual、Using LabVIEW with TestStand、Code Module 最佳做法等，頁碼在 docs/research_teststand.md）；手冊有些是 2008、2010 年版，<b>概念和屬性名稱多年沒變，但畫面、選單名稱以你用的 TestStand 版本為準</b>。下面的模擬器是照手冊寫的執行規則做的，不是 TestStand 本身。'),
C.h3('① W6 的哪些東西搬到 TestStand','','先分工，再寫程式'),
C.table(['W6 用 LabVIEW 做的','改用 TestStand 後由誰做','TestStand 裡叫什麼'],[
 ['掃序號、一片接一片測','TestStand 的流程模型','Test UUTs：每一片開始前跳出對話框問序號，存在 UUT.SerialNumber'],
 ['上下限檔 limits.csv','TestStand','每一步的 Step.Limits.Low／High；或執行時用 Property Loader 從檔案載入'],
 ['判 PASS／FAIL','TestStand','Numeric Limit Test 自己比上下限'],
 ['寫 CSV 結果檔','TestStand','報表（ASCII、HTML、XML、ATML）和資料庫記錄，用同一份結果'],
 ['開機設電壓、開儀器','TestStand 呼叫你的 VI','Setup 群組的 Action 步驟'],
 ['讀 DMM、換算成量測值','<b>LabVIEW</b>','Code module：被步驟呼叫的 VI'],
 ['不管怎麼結束都要斷電','TestStand','Cleanup 群組：一定會跑']
]),
ask('W6 的 Judge.vi 自己比上下限、自己寫檔。如果原封不動搬進 TestStand，用 Pass/Fail Test 呼叫它，會少掉什麼？',`<p>Pass/Fail Test 只拿到一個布林。報表上看不到量測值和上下限，資料庫裡也沒有，之後做良率分析（W14）、GR&R（W6）、查客訴（W9）都沒有數字可用；改上下限還要改 VI。</p><p>NI 的建議是 <b>VI 只回傳量測值，上下限放在 sequence 裡，由 Numeric Limit Test 判定</b>。這和 W6「上下限不寫死在程式裡」是同一個想法，只是放的地方從 CSV 換成 TestStand。</p>`),
C.h3('② 步驟的種類','','選錯種類，報表就少東西'),
C.table(['Step Type','誰判定','什麼時候用'],[
 ['Numeric Limit Test','TestStand：module 回傳一個數值，步驟比上下限（Step.Result.Numeric）','一個數字、一組上下限：W6 的 T01～T05'],
 ['Multiple Numeric Limit Test','TestStand：一步檢查一組量測，每個有自己的上下限；全部過才 Passed','同一次量測得到好幾個相關的數字'],
 ['Pass/Fail Test','module 自己判定，回傳布林（Step.Result.PassFail）','結果本來就只有對錯，例如「燒錄成功？」（W18 的多重判斷可以在 VI 裡做完）'],
 ['String Value Test','TestStand 比對回傳的字串和期望字串','讀韌體版本，要等於 2.3.1（W18）'],
 ['Action','不判定；沒錯是 Done，出錯是 Error','開關電源、設定儀器、開關 session']
]),
tip('型別','手冊寫明：量測值和上下限要是 DBL，不能用 64 位元整數。W7 的 U16 計數值要先轉 DBL 再回傳。'),
C.h3('③ 寫一個好被呼叫的 VI','','LabVIEW 這邊的工作'),
`<p>手冊和 NI 的最佳做法整理起來：</p>
<ul><li><b>只回傳量測值</b>，不比上下限、不寫檔、不跳對話框（記錄交給 TestStand 的報表和資料庫）。</li>
<li><b>有標準的 error out</b>：TestStand 會自動把它接到這一步的 Step.Result.Error。不需要 error in。</li>
<li><b>資料用參數傳</b>（接線板上的控制項和指示器），不要在 VI 裡用 TestStand API 讀寫變數；只有要依步驟狀態動態存取時才傳 ThisContext（sequence context），而且要先檢查參考是否有效。這樣 VI 拿到 TestStand 以外也能單獨測（H3 的單元測試會用到）。</li>
<li><b>儀器 session 在 Setup 開、Cleanup 關</b>，量測的 VI 只拿 session 來用。</li>
<li>接線板不需要特定樣式；但<b>不支援 LabVIEW 類別型別的控制項和指示器</b>。H1 的類別要留在 VI 裡面，接線板上用一般型別。</li></ul>`,
{steps:{title:'Measure_DCV.vi：給 Numeric Limit Test 呼叫的量測 VI',lv:mv,steps:[
 {t:'拿 session、送命令',view:'split',add:['dmm','st','kc','rd','w1','w2'],h:`<p>DMM session 是 TestStand 在 Setup 開好、用參數傳進來的。Query DMM.vi 是你的驅動（I10 那種：送命令、讀回應、換成數字）。命令用 SCPI 的 <code>MEAS:VOLT:DC?</code>。</p>`},
 {t:'只回傳量測值和 error out',view:'split',add:['meas','w3','eo','w4'],h:`<p>measurement（DBL）在 TestStand 的 VI 參數表指到 Step.Result.Numeric；error out 會自動對應到 Step.Result.Error。<b>這個 VI 裡沒有上下限、沒有 PASS/FAIL、沒有寫檔</b>。</p>`},
 {t:'Run',view:'split',add:[],h:`<p>兩種情況各 Run 一次。第二種情況 measurement 是 0，但 error out 有錯：TestStand 會判這一步 Error，不會拿 0 去比上下限。<b>如果你把 error out 拿掉，0 就會被當成量測值</b>，看下面的模擬器。</p>`}
]}},
C.h3('④ 跑一片：Error 不是 FAIL，Cleanup 一定跑','','照手冊的執行規則'),
`<p>sequence：Setup 開電源、開 DMM；Main 是 T01～T05 五個 Numeric Limit Test；Cleanup 關電源、關 DMM。選情況，再切換 code module 的寫法：</p>`,
{fn:seqFig},
ask('斷電為什麼要放在 Cleanup，不放在 Main 的最後一步？',`<p>Setup 或 Main 出錯、或操作員按 Terminate，TestStand 都會直接跳到 Cleanup，Main 後面的步驟不會跑。放在 Main 最後一步，DMM 掉線那一片就會一直帶電（W6 的「任何結束路徑都要斷電」）。Cleanup 裡的步驟就算其中一步出錯，也會繼續跑下一步。</p>`),
C.h3('⑤ 流程模型、序號、報表','',''),
C.table(['項目','選項','差別'],[
 ['執行入口','Test UUTs／Single Pass','Test UUTs 一片接一片、每片問序號；Single Pass 只測一次、<b>不問序號</b>（除錯、驗證程式時用）'],
 ['流程模型','Sequential','一次測一片（預設）'],
 ['','Parallel','好幾個測試座各自開始、各自結束：一座測完先換板子，其他座繼續'],
 ['','Batch','好幾座當一組一起開始、一起結束（例如同一片載板上的幾塊板子）；可以讓某一步整批只跑一次'],
 ['報表格式','ASCII、HTML、XML、ATML（2019 起可另存 PDF）','ASCII 最快最小，XML 最慢最大；ATML 不支援 Batch 的整批報表'],
 ['資料庫','透過 ADO／OLE DB／ODBC','和報表用同一份結果；要做自動分析（W14）用資料庫比解析報表檔好']
]),
ask('W16 的雙治具共用一組儀器、輪流測。如果老闆再加一套儀器，讓兩座各自放板子、各自開始結束，對應哪一種流程模型？若兩座仍共用同一台 DMM，要注意什麼？',`<p>兩座各自開始、各自結束是 Parallel。Batch 是整組一起開始、一起結束，適合同一片載板上的幾塊板子一起測。</p><p>如果兩座共用同一台 DMM，就要確保同一時間只有一座在用它（否則兩邊的命令和回應會交錯，W16 用繼電器切換也是同一個問題）。TestStand 有做同步的機制，用法請查你的版本的手冊；這一點 LadderLab 沒有查證細節。</p>`),
C.h3('⑥ 上下限、條件、運算式','','改規格時不用改程式'),
C.table(['想做的','用什麼','注意'],[
 ['上下限寫在步驟裡','Step.Limits.Low／High','最簡單；改規格要改 sequence file，要走變更流程（W8）'],
 ['上下限從檔案或資料庫載入','Property Loader 步驟','手冊寫<b>只支援 ANSI 編碼</b>：限值檔有中文、存成 UTF-8 可能讀不對（以你的版本的手冊為準）'],
 ['整台測試站共用的值','Station Globals','用運算式讓上下限引用它'],
 ['前一步過了才跑這一步','Precondition','每次執行時計算'],
 ['暫時跳過或強制某一步的結果','Run Mode：Skip、Pass、Fail','固定的設定，不執行 module；<b>除錯完一定要改回 Normal</b>，否則產線會一直強制 Pass'],
 ['呼叫 module 前後處理數值','Pre-Expression、Post-Expression','module 出錯時，Post 和 Status Expression 會被跳過']
]),
C.h3('⑦ 用 TestStand 除錯產線問題','','職缺說的「除錯」'),
C.table(['工具','做什麼'],[
 ['中斷點','在步驟上停下來'],
 ['Step Into／Over／Out','一步一步跑；對呼叫 VI 的步驟可以<b>單步進入 VI</b>，接著用 LabVIEW 的探針看'],
 ['Execution 視窗','Call Stack、Variables、Watch View；開追蹤時，變了的值標紅色'],
 ['Report 窗格','當場看這一片的報表：哪一步 Failed、哪一步 Error、數值多少'],
 ['Run Mode','暫時跳過某一步，確認是不是它造成的（用完改回來）']
]),
warn('產線電腦上的授權','要在產線電腦上單步進入 LabVIEW 程式，那台要裝 Debug Deployment Environment；一般只跑測試的產線電腦裝 Base Deployment Engine，只能執行和簡單除錯。開發、加功能要 Development System。'),
C.h3('⑧ 部署：和 W19 一樣，再多兩件事','',''),
`<ul><li>產線電腦裝的是<b>部署授權</b>（Base Deployment Engine），不是開發版；每一台都要一個授權。</li>
<li>TestStand 用 <b>LabVIEW Run-Time Engine</b> 執行 VI，預設依 VI 的存檔版本自動選 Run-Time。Run-Time 只能跑同一版存檔的 VI：課程的 LabVIEW 2018 VI，產線電腦就要裝 2018 的 Run-Time。位元數也要配合（64 位元 TestStand 和 32 位元 VI 的限制，目前只查到 NI 社群的說法，要用你的版本確認）。</li>
<li>VI 用到 vi.lib 這類路徑時，Run-Time 不像開發環境那樣能自己找到：用 TestStand 的部署工具一起打包，部署工具的版本要和 TestStand 開發系統一致。</li></ul>`,
C.h3('⑨ 最容易做錯的三件事','',''),
C.table(['做錯','結果','正確'],[
 ['在 VI 裡比上下限，用 Pass/Fail Test','報表、資料庫沒有量測值；改規格要改程式','VI 只回量測值，用 Numeric Limit Test'],
 ['VI 把錯誤吞掉，照樣回傳一個數字','儀器掉線被判成 FAIL，甚至 PASS','接 error out：這一步會是 Error，跳到 Cleanup'],
 ['產線電腦「裝 TestStand 就好」','打不開、跑不動 VI、授權不對','部署授權 + 對應版本和位元數的 LabVIEW Run-Time，用部署工具打包']
]),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'NI 建議 W6 的 T02（輸出電壓 4.90～5.10 V）在 TestStand 裡用哪種步驟？',o:['Numeric Limit Test，VI 只回傳電壓','Pass/Fail Test，VI 自己比上下限','Action','String Value Test'],a:0,ex:'上下限放 sequence，TestStand 判定，報表和資料庫才有數值。'},
 {q:'VI 的 error out 有錯時，這一步的結果是？',o:['Error（run-time error），然後跳到 Cleanup','Failed','Passed','TestStand 不會注意到'],a:0,ex:'error out 自動接到 Step.Result.Error。'},
 {q:'斷電的步驟應該放在？',o:['Cleanup 群組','Main 的最後一步','Setup 群組','不用放，TestStand 會自動斷電'],a:0,ex:'出錯或被終止都會跳到 Cleanup，Cleanup 一定跑。'},
 {q:'Single Pass 和 Test UUTs 的差別？',o:['Single Pass 只測一次、不問序號；Test UUTs 一片接一片、每片問序號','完全一樣','Single Pass 比較快所以產線用它','Test UUTs 不產生報表'],a:0,ex:'產線用 Test UUTs。'},
 {q:'TestStand 的 code module VI，接線板上可以放 LabVIEW 類別的控制項嗎？',o:['不支援；類別留在 VI 裡面，接線板用一般型別','可以','只能放一個','只能放在 error 叢集裡'],a:0,ex:'手冊的型別對照表寫明不支援 LabVIEW Object。'},
 {q:'一般只跑測試的產線電腦，裝哪種 TestStand 授權？',o:['Base Deployment Engine','Development System','不需要授權','LabVIEW 開發版'],a:0,ex:'要在現場單步進入 LabVIEW 才需要 Debug Deployment Environment。'},
 {q:'為了除錯把某一步的 Run Mode 設成 Pass，之後要？',o:['改回 Normal，否則產線一直強制 Pass','不用管','刪掉那一步','重灌 TestStand'],a:0,ex:'強制的結果不會執行 module。'},
 {q:'兩座各有自己的儀器、各自放板子、各自開始結束，用哪一種流程模型？',o:['Parallel','Batch','Sequential','Single Pass'],a:0,ex:'Batch 是整組一起開始、一起結束。'}
]}
]});
})();
