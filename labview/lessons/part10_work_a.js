/* 第十部分：實務案例（W1、W2）。每一課是一份完整的工作：聽需求 → 寫規格 → 盤點 → 先驗證 → 規劃 → 寫 → 測試交機。
   素材來源（只取觀念，用自己的話和自己的例子重寫）：
   - LabVIEW 基礎課程 Chap01（鋒穎）：十個按鈕全部觸發才亮燈、BMI 分級表（表中區間有缺口）、比較器、布林函數、按鈕機械動作。
     → W1 改寫成包裝機的「啟動許可」和「重量分級」。
   - DAQ 講義（緯宇）：訊號調理對照（熱電偶：放大、冷接點補償、濾波；加速規：電流激發、反失真濾波；應變規：電壓激發、電橋補償、濾波；
     高電壓：隔離）、典型架構（感測器 → 訊號連接 → DAQ → PC）、接地與浮接訊號源、差動／RSE／NRSE、三個 R、多工與同步取樣架構、
     MAX 的接腳圖與測試面板、DAQmx 流程（建立通道 → 時脈 → 觸發 → Start → Read → Clear），以及「硬體在 Start 時就開始擷取，Read 只是從緩衝區拿」。
     → W2 改寫成三台馬達的振動監測站。
   - 接法選擇的原則（接地訊號源避免 RSE、浮接訊號源用差動或 NRSE 時要加偏壓電阻）與 NI 的 Field Wiring 文件一致。
   - DAQmx 連續擷取讀太慢的錯誤碼 -200279（要讀的樣本已經被覆蓋）。 */
(function(){
const L=window.LESSONS,fn=C.fn,qd=C.qd,wt=C.wt;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const PR=['Functions','Programming'];
const addF=o=>{for(const k in o)if(!LV.F[k])LV.F[k]=o[k];};
addF({
 'And Array Elements':{g:'∧[ ]',ins:['Boolean array'],outs:['logical AND'],pal:[...PR,'Boolean','And Array Elements']},
 'Boolean To (0,1)':{g:'?1:0',ins:['Boolean'],outs:['0, 1'],pal:[...PR,'Boolean','Boolean To (0,1)']},
 'RMS':{g:'RMS',ins:['X'],outs:['rms value'],pal:['Functions','Mathematics','Probability & Statistics','RMS.vi']}
});

/* 七個階段：W1～W5 共用 */
const STAGES=C.table(['階段','要做的事','做完手上有什麼'],[
 ['① 聽懂需求','把對方的原話記下來，挑出「沒講清楚」的地方，回去問','一張問題清單和答案'],
 ['② 寫成規格','每一句話改成能量、能測的句子：數字、單位、範圍、異常時怎樣','規格表（對方簽字或回信確認）'],
 ['③ 盤點','輸入有哪些、輸出有哪些、硬體夠不夠、接線怎麼接','I/O 表、接線表'],
 ['④ 先驗證','不寫程式，先用工具（MAX、手動接線、範例程式）確認硬體是好的','「硬體沒問題」的證據'],
 ['⑤ 規劃','五個問題：從哪裡來、怎麼算、怎麼呈現、多久一次、怎麼停','規劃表、架構草圖'],
 ['⑥ 一步一步寫','每加一塊就 Run 一次，看到對的結果再往下','能跑的 VI'],
 ['⑦ 測試、交機','照規格一條一條測，包含不正常的情況；寫說明','測試紀錄、使用說明、程式']
]);

/* ======================================================================
   W1：包裝機操作畫面：啟動許可與重量分級
   ====================================================================== */
const NAMES=['安全門 1 關好','安全門 2 關好','急停沒有按','氣壓正常','封口溫度到了','包材有料','下游可以收','自動模式'];
const TH=[490,500,510,520],GR=['不足（NG）','偏輕','標準','偏重','超重（NG）'],NGT=[true,false,false,false,true];
const pk={name:'Packer.vi',view:'split',ratio:2.3,
 fp:{w:330,h:330,items:[
  ...NAMES.map((n,i)=>({id:'c'+i,k:'btn',style:'toggle',mech:'switch',label:n,x:i<4?12:112,y:8+(i%4)*40,v:i!==5})),
  {id:'start',k:'btn',label:'啟動',text:'啟動',x:228,y:12},
  {id:'stopm',k:'btn',label:'停機',text:'停機',x:228,y:52},
  {id:'all',k:'led',label:'條件全部 OK',color:'green',x:228,y:98},
  {id:'run',k:'led',label:'運轉中',color:'green',x:228,y:138},
  {id:'why',k:'str',label:'狀態說明',x:12,y:186,w:300},
  {id:'wg',k:'num',ctl:true,label:'重量 g',x:12,y:240,w:80,v:503,inc:0.5,dig:2},
  {id:'grade',k:'str',label:'等級',x:120,y:240,w:100},
  {id:'ng',k:'led',label:'剔除',color:'red',x:250,y:240},
  {id:'quit',k:'btn',label:'stop',text:'結束程式',stop:true,x:12,y:290}]},
 bd:{w:1010,h:480,structs:[{id:'wl',k:'while',x:150,y:14,w:830,h:450}],
  nodes:[
  ...NAMES.map((n,i)=>({id:'c'+i,k:'ctl',t:'bool',label:n,x:170,y:34+i*34})),
  {id:'ba',k:'fn',fn:'Build Array',ins:NAMES.map((n,i)=>'element '+i),x:330,y:30,h:272},
  {id:'aae',k:'fn',fn:'And Array Elements',x:420,y:40},
  {id:'all',k:'ind',t:'bool',label:'條件全部 OK',x:530,y:24},
  {id:'kF',k:'const',t:'bool',v:false,x:390,y:130},
  {id:'srch',k:'fn',fn:'Search 1D Array',x:430,y:110},
  {id:'kn',k:'const',t:'str[]',v:'條件名稱（8 個）',x:420,y:180},
  {id:'ia',k:'fn',fn:'Index Array',x:540,y:130},
  {id:'kq',k:'const',t:'str',v:'缺：',x:570,y:96},
  {id:'cat',k:'fn',fn:'Concatenate Strings',ins:['string 0','string 1'],x:630,y:100},
  {id:'kok',k:'const',t:'str',v:'條件全部 OK，可以啟動',x:540,y:62},
  {id:'sel',k:'fn',fn:'Select',x:720,y:70},
  {id:'why',k:'ind',t:'str',label:'狀態說明',x:790,y:76},
  {id:'kfr',k:'const',t:'bool',v:false,x:110,y:345},
  {id:'sr',k:'sr',t:'bool',s:'wl',y:355},
  {id:'start',k:'ctl',t:'bool',label:'啟動',x:190,y:330},
  {id:'or',k:'fn',fn:'Or',x:280,y:340},
  {id:'stopm',k:'ctl',t:'bool',label:'停機',x:190,y:396},
  {id:'not',k:'fn',fn:'Not',x:250,y:394},
  {id:'and1',k:'fn',fn:'And',x:350,y:346},
  {id:'and2',k:'fn',fn:'And',x:410,y:368},
  {id:'run',k:'ind',t:'bool',label:'運轉中',x:480,y:350},
  {id:'wg',k:'ctl',t:'dbl',label:'重量 g',x:570,y:250},
  {id:'kth',k:'const',t:'dbl[]',v:'490, 500, 510, 520',x:560,y:296},
  {id:'ge',k:'fn',fn:'Greater Or Equal?',x:690,y:256},
  {id:'b01',k:'fn',fn:'Boolean To (0,1)',x:760,y:256,w:44},
  {id:'sum',k:'fn',fn:'Add Array Elements',x:830,y:256},
  {id:'kg',k:'const',t:'str[]',v:'等級名稱（5 個）',x:770,y:320},
  {id:'ia2',k:'fn',fn:'Index Array',x:880,y:290},
  {id:'grade',k:'ind',t:'str',label:'等級',x:930,y:236},
  {id:'kng',k:'const',t:'bool[]',v:'T F F F T',x:790,y:390},
  {id:'ia3',k:'fn',fn:'Index Array',x:880,y:370},
  {id:'ng',k:'ind',t:'bool',label:'剔除',x:930,y:410},
  {id:'quit',k:'ctl',t:'bool',label:'stop',x:640,y:430},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  ...NAMES.map((n,i)=>({id:'wc'+i,from:'c'+i,to:'ba.element '+i,t:'bool',mx:300})),
  {id:'wb1',from:'ba.appended array',to:'aae',t:'bool[]',mx:400},
  {id:'wb2',from:'aae.logical AND',to:'all',t:'bool',mx:480},
  {id:'wb3',from:'ba.appended array',to:'srch.1D array',t:'bool[]',mx:400},
  {id:'wb4',from:'kF',to:'srch.element',t:'bool',mx:420},
  {id:'wb5',from:'srch.index of element',to:'ia.index',t:'i32',mx:500},
  {id:'wb6',from:'kn',to:'ia.array',t:'str[]',mx:520},
  {id:'wb7',from:'kq',to:'cat.string 0',t:'str',mx:605},
  {id:'wb8',from:'ia.element',to:'cat.string 1',t:'str',mx:600},
  {id:'wb9',from:'kok',to:'sel.t',t:'str',mx:690},
  {id:'wb10',from:'aae.logical AND',to:'sel.s',t:'bool',mx:480},
  {id:'wb11',from:'cat.concatenated string',to:'sel.f',t:'str',mx:680},
  {id:'wb12',from:'sel.out',to:'why',t:'str'},
  {id:'wr1',from:'kfr',to:'sr.init',t:'bool'},
  {id:'wr2',from:'sr.L',to:'or.x',t:'bool',mx:260},
  {id:'wr3',from:'start',to:'or.y',t:'bool',mx:260},
  {id:'wr4',from:'or.out',to:'and1.x',t:'bool',mx:330},
  {id:'wr5',from:'aae.logical AND',to:'and1.y',t:'bool',pts:[[480,54],[480,316],[320,316],[320,367]]},
  {id:'wr6',from:'stopm',to:'not',t:'bool'},
  {id:'wr7',from:'and1.out',to:'and2.x',t:'bool',mx:395},
  {id:'wr8',from:'not.out',to:'and2.y',t:'bool',mx:395},
  {id:'wr9',from:'and2.out',to:'run',t:'bool',mx:460},
  {id:'wr10',from:'and2.out',to:'sr.R',t:'bool',pts:[[460,382],[460,448],[972,448],[972,355]]},
  {id:'wg1',from:'wg',to:'ge.x',t:'dbl',mx:670},
  {id:'wg2',from:'kth',to:'ge.y',t:'dbl[]',mx:676},
  {id:'wg3',from:'ge.out',to:'b01',t:'bool[]'},
  {id:'wg4',from:'b01.0, 1',to:'sum',t:'i16[]'},
  {id:'wg5',from:'sum.sum',to:'ia2.index',t:'i16',mx:868},
  {id:'wg6',from:'kg',to:'ia2.array',t:'str[]',mx:862},
  {id:'wg7',from:'ia2.element',to:'grade',t:'str',mx:922},
  {id:'wg8',from:'sum.sum',to:'ia3.index',t:'i16',mx:868},
  {id:'wg9',from:'kng',to:'ia3.array',t:'bool[]',mx:862},
  {id:'wg10',from:'ia3.element',to:'ng',t:'bool',mx:922},
  {id:'wq',from:'quit',to:'cond',t:'bool'}]},
 sim:{period:150,init:()=>({run:false}),
  step(inp,st){
   const cs=NAMES.map((n,i)=>!!inp['c'+i]),all=cs.every(Boolean),idx=cs.indexOf(false),nm=idx<0?'':NAMES[idx];
   const why=all?'條件全部 OK，可以啟動':'缺：'+nm;
   const prev=st.run,o1=prev||!!inp.start,a1=o1&&all,run=a1&&!inp.stopm;st.run=run;
   const w=+inp.wg||0,ge=TH.map(t=>w>=t),cnt=ge.filter(Boolean).length;
   const vals={'ba.appended array':'['+cs.map(b=>b?'T':'F').join(' ')+']','aae.logical AND':all,kF:false,'srch.index of element':idx,kn:'條件名稱','ia.element':nm,kq:'缺：','cat.concatenated string':'缺：'+nm,kok:'條件全部 OK，可以啟動','sel.out':why,
    kfr:false,'sr.L':prev,'or.out':o1,'and1.out':a1,'not.out':!inp.stopm,'and2.out':run,wg:w,kth:'[490, 500, 510, 520]','ge.out':'['+ge.map(b=>b?'T':'F').join(' ')+']','b01.0, 1':'['+ge.map(b=>b?1:0).join(' ')+']','sum.sum':cnt,'ia2.element':GR[cnt],'ia3.element':NGT[cnt],quit:!!inp.quit};
   NAMES.forEach((n,i)=>vals['c'+i]=cs[i]);
   return {out:{all,why,run,grade:GR[cnt],ng:NGT[cnt]},vals,stop:!!inp.quit,
    msg:(run?'運轉中':'停止')+'｜'+why+'｜'+w.toFixed(2)+' g：'+ge.filter(Boolean).length+' 個門檻 ≤ 重量 → '+GR[cnt]};},
  doneMsg:'程式結束'}
};

L.push({id:'W01',order:30.981,no:'W1',part:PART,title:'包裝機的操作畫面：條件全部 OK 才能啟動、秤重分級',mins:60,files:['練習\\實務\\Packer.vi'],
goals:[['學會','一份工作從頭到尾的七個階段；把口頭需求改成能驗收的規格；Build Array ＋ And Array Elements 判斷「全部成立」；Search 1D Array 找出「是哪一個不成立」；啟動按鈕的機械動作為什麼要用 Latch；分級表用「門檻陣列」寫，邊界不會有縫。'],['做出','Packer.vi：8 個條件全部 OK 才能按啟動、運轉中條件掉了就停、畫面告訴操作員缺哪一個；重量依品保的分級表顯示等級和剔除燈。'],['素材','講義 Chap01 的兩個練習「十個按鈕都觸發才亮燈」和「BMI 分級」。這一課把它們放回真正會遇到的地方：機台的啟動許可、產品的重量分級。']],
check:'不看課文，能把一句口頭需求改成規格表，寫出 Packer.vi，並說出 499.95 g 為什麼不會「掉進縫裡」、為什麼啟動按鈕不能用 Switch When Pressed。',
body:[
C.h3('這個單元','x','實務案例：一份工作從頭到尾'),
`<p>前面的課一次教一個功能。真正上班時，沒有人會說「請用 And Array Elements」。你拿到的是一句話、一張表、一台機器，<b>要自己把它拆成程式</b>。這個單元每一課都是一份完整的工作，照同樣的七個階段走：</p>`,
STAGES,
`<p>新手最常跳過的是 ①②④。直接開 LabVIEW 寫，寫完才發現對方要的不是這個，或是硬體本來就壞的。<b>寫程式通常只佔一半的時間</b>，另一半在想清楚和驗證。</p>`,
C.h3('這些課對應什麼工作','','從人力銀行的職缺整理'),
`<p>2026 年 11 月，我們整理了 yes123 的職缺內頁和 104 的搜尋摘要，共約 29 筆 LabVIEW、PLC、自動化測試相關職缺，把「工作內容」裡最常出現的事情排出來。這個單元的題目就是照這張表挑的：</p>`,
C.table(['課','情境','對應的職缺工作'],[
 ['W1','包裝機操作畫面','人機畫面與操作流程、啟動條件'],
 ['W2','DAQ 馬達監測站','DAQ 資料擷取、感測器與接線'],
 ['W3～W5','myRIO 搬運小車操作盒','寫控制程式、整合硬體、現場調機'],
 ['W6','產線功能測試站','寫測試程式、整合儀器（VISA／SCPI）、上下限、測試報表'],
 ['W7','設備稼動監控','讀 PLC 收集設備資料、稼動率、回傳生產資料'],
 ['W8','接手舊程式','維護及修改既有程式、除錯'],
 ['W9','測試資料庫與追溯','測試結果寫入資料庫、序號追溯、串 MES'],
 ['W10','治具開短路測試','治具驗證、治具維護、故障診斷'],
 ['W11','配方與警報','Recipe、Alarm、Interlock、Event Log'],
 ['W12','老化燒機記錄','長時間記錄、異常通知、穩定性'],
 ['W13','簡易 AOI','機器視覺、和 PLC 交握'],
 ['W14','現場除錯','異常排除、除錯（第 2 名）、治具維護'],
 ['W15','特性曲線自動量測','儀器自動量測、自動畫圖、量測報告（第 B 組）'],
 ['W16','縮短測試時間','測試系統優化、測試效率改善（Y02）'],
 ['W17','上傳 MES','設備和 MES 串接、生產資料回傳（Y04、S05）'],
 ['W18','燒錄站','燒錄流程、韌體版本控管、燒錄 SOP（Y09）'],
 ['W19','部署到產線電腦','測試程式導入產線、維護和更新']
]),
`<p>排在第 3 名的「寫文件」（SOP、規格書、操作手冊、I/O 表）沒有單獨一課，因為<b>每一課的 ② 規格和 ⑦ 交機都是在寫文件</b>。第 7 名的「電控設計」（電路圖、配盤配線）在 PLC 主線課程裡。另外，越來越多測試職缺寫「LabVIEW 或 Python 擇一」：這個單元教的流程（問清楚、寫規格、先驗證、照規格驗收）換成哪一種語言都一樣。</p>`,
C.h3('① 聽懂需求','','主管的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「包裝機要加一個 LabVIEW 畫面。安全門、急停、氣壓那些條件都 OK 才能按啟動。秤出來的重量要分級，品保會給你分級表。」</p>
<p>品保給的表：</p>${C.table(['等級','重量'],[['不足（剔除）','490 g 以下'],['偏輕','490～499.9 g'],['標準','500～509.9 g'],['偏重','510～519.9 g'],['超重（剔除）','520 g 以上']])}</div>`,
`<p>這段話聽起來很清楚。先別急著寫，拿筆把<b>每一個「沒講清楚」的地方</b>圈起來。</p>`,
ask('這段需求裡，至少有哪三個地方不清楚？',
 `<ol><li><b>「那些條件」是哪些？</b>要一條一條列出來。問到的答案：安全門 1、安全門 2、急停沒按、氣壓正常、封口溫度到了、包材有料、下游可以收、自動模式，共 8 個。</li>
 <li><b>運轉中有一個條件掉了怎麼辦？</b>停機？等它恢復自己再跑？答案：馬上停，<b>恢復後要操作員再按一次啟動</b>（自己再跑會嚇到正在旁邊的人）。</li>
 <li><b>按不下去的時候，操作員怎麼知道為什麼？</b>只亮一顆「不能啟動」的燈，操作員只能打電話叫你。答案：畫面要寫出缺哪一個。</li>
 <li><b>分級表的邊界</b>：490 g 算「不足」還是「偏輕」？499.95 g 算哪一級？「490 g 以下」包不包含 490？</li></ol>`),
C.h3('② 寫成規格','','每一句都要能測'),
`<p>回去問完，把答案寫成下面這張表，<b>寄給主管和品保確認</b>。之後有爭議，就拿這張表對。</p>`,
C.table(['編號','規格','怎麼驗收'],[
 ['S1','8 個條件全部成立，「條件全部 OK」燈亮','逐一切掉每個條件，燈都要熄'],
 ['S2','條件全部 OK 時按「啟動」才進入運轉','條件不齊時按啟動，不會運轉'],
 ['S3','運轉中任何一個條件不成立，立刻停止；條件恢復後不會自己啟動','運轉中打開安全門 → 停；關上 → 仍是停止'],
 ['S4','不能啟動時，畫面顯示「缺：」加上第一個不成立的條件名稱','切掉「包材有料」→ 顯示「缺：包材有料」'],
 ['S5','重量 w 的等級：w &lt; 490 不足；490 ≤ w &lt; 500 偏輕；500 ≤ w &lt; 510 標準；510 ≤ w &lt; 520 偏重；w ≥ 520 超重','用 489.99、490、499.95、500、519.99、520 測'],
 ['S6','不足、超重亮「剔除」燈','同上']
]),
`<p>注意 S5：品保原本寫的是「490～499.9、500～509.9」。這種寫法<b>中間有縫</b>：499.95 g 不在任何一格。秤的解析度如果是 0.01 g，這種重量天天都會出現。改成「大於等於下限、小於上限」，每個重量都剛好落在一格。</p>`,
ask('講義的 BMI 分級表也有一樣的縫，你找得到嗎？',
 `<p>「正常 18.5～22.9」和「過重 23.0～24.9」之間，22.95 就不在任何一格。這種表是給人看的，人會自己四捨五入；<b>程式不會</b>。拿到任何分級表，第一件事就是檢查邊界：每一個邊界值屬於哪一格、相鄰兩格之間有沒有縫、有沒有重疊。</p>`),
C.h3('③ 盤點','','輸入、輸出各有哪些'),
C.table(['方向','名稱','型別','從哪裡來／到哪裡去'],[
 ['輸入','8 個條件','Boolean × 8','實機：PLC 或數位輸入。這一課先用前面板的開關代替'],
 ['輸入','啟動、停機','Boolean','前面板按鈕'],
 ['輸入','重量','DBL，單位 g','實機：秤的 RS-232（I6 電子天平那一課）。先用數值控制元件代替'],
 ['輸出','條件全部 OK、運轉中、剔除','Boolean','LED'],
 ['輸出','狀態說明、等級','String','字串顯示']
]),
`<p>「先用前面板代替硬體」是很實用的做法：邏輯先在桌上寫對、測完，到現場只要把控制元件換成讀硬體的那一塊，後面的程式不用改。</p>`,
C.h3('④ 先驗證','','三個小實驗，各花兩分鐘'),
`<p>這份工作沒有新硬體，要驗證的是<b>你對函式的理解</b>。開一個空白 VI，各試一次：</p>
<ol><li><b>「全部成立」</b>：講義的練習是十個按鈕都按下燈才亮。一個做法是用 9 個 And 串起來。試著做一次，再用 ${fn('Programming','Array','Build Array')} 把十個 Boolean 接成陣列，接到 ${fn('Programming','Boolean','And Array Elements')}。哪一個比較好改？</li>
<li><b>「找出哪一個」</b>：${fn('Programming','Array','Search 1D Array')} 的 element 接 False 常數，看它回傳什麼。全部是 True 的時候呢？</li>
<li><b>「陣列和一個數比大小」</b>：${fn('Programming','Comparison','Greater Or Equal?')} 的 x 接一個數，y 接一個陣列。輸出是一個數還是一串？</li></ol>`,
ask('三個實驗的結果？',
 `<ol><li>9 個 And 也對，但條件從 8 個變成 9 個，你得重新拉線。陣列做法只要在 Build Array 往下拉多一格。And Array Elements 的意思就是「陣列裡全部都是 True 嗎」。</li>
 <li>回傳<b>第一個</b> False 的索引。全部 True 時找不到，回傳 <b>−1</b>。−1 拿去 Index Array 會得到預設值（空字串），所以全部 OK 時不能用它的結果，要另外處理（後面用 Select）。</li>
 <li>輸出是一串 Boolean：比較函式遇到陣列，會<b>每一個元素都比一次</b>。這個特性等一下拿來做分級。</li></ol>`),
C.h3('⑤ 規劃','','先決定架構，再回答五個問題'),
`<p><b>為什麼要一個 While Loop？</b>條件會一直變，畫面要一直更新，所以要迴圈。<b>為什麼要 Shift Register？</b>「運轉中」要記住：按一下啟動之後，按鈕已經彈回來了，機器還要繼續跑。這就是「這一圈要用到上一圈的結果」，第 5 課的 Shift Register。</p>
<p>運轉的邏輯寫成一句話：<b>這一圈運轉 ＝（上一圈在運轉 或 剛按了啟動）且 條件全部 OK 且 沒按停機</b>。PLC 課的自保持迴路就是這個意思。</p>`,
C.plan({start:'新 VI，存成 <code>練習\\實務\\Packer.vi</code>。前面板先擺好 8 個開關、啟動、停機、重量，再切到方塊圖。',
 in:'8 個條件（Boolean）、啟動和停機（Boolean，機械動作用 <b>Latch When Released</b>）、重量（DBL，g）。',
 calc:'① Build Array → And Array Elements：全部 OK？② Search 1D Array 找第一個 False → Index Array 拿名稱 → 「缺：」接名稱。③ 自保持：Or、And、Not ＋ Shift Register。④ 分級：重量 ≥ 門檻陣列 → Boolean To (0,1) → 加總 ＝ 等級編號 0～4 → Index Array 拿等級名稱和剔除旗標。',
 out:'LED：條件全部 OK、運轉中、剔除。字串：狀態說明、等級。',
 loop:'100 ms 一圈。人按按鈕、秤更新都沒有更快。',
 end:'「結束程式」按鈕停迴圈。停之前運轉中要變 False（實機要記得送停機命令給 PLC）。'}),
ask('為什麼啟動按鈕要用 Latch，不能用 Switch When Pressed？',
 `<p>Switch 按一下會<b>一直保持 True</b>，直到再按一下。想像這個流程：操作員按了啟動（Switch，保持 True）→ 安全門被打開，機器停了 → 有人在裡面清料 → 門關上的瞬間，條件又全部 OK，啟動還是 True，<b>機器自己動了</b>。</p>
 <p>Latch 只在被讀到的那一圈是 True，之後自己彈回 False。條件恢復時已經沒有「啟動」訊號了，機器停在原地，等人再按一次。這就是規格 S3。</p>`),
C.h3('⑥ 一步一步寫','','每一步都 Run 一次'),
{steps:{title:'Packer.vi：啟動許可 ＋ 重量分級',lv:pk,steps:[
 {t:'迴圈和 8 個條件',view:'split',add:['wl','quit','cond','wq',...NAMES.map((n,i)=>'c'+i)],h:`<p>前面板放 8 個 ${C.ctl('Modern','Boolean','Vertical Toggle Switch')}（或任何開關），標籤照規格表的名稱。全部框起來拖進 While Loop。</p><p>標籤要寫完整的「安全門 1 關好」，不是「DI0」：等一下這些名稱會直接顯示給操作員看。</p>`},
 {t:'全部 OK：Build Array → And Array Elements',view:'split',add:['ba',...NAMES.map((n,i)=>'wc'+i),'aae','wb1','all','wb2'],h:`<p>${fn('Programming','Array','Build Array')} ${qd('Build Array')}，往下拉到 8 格，依序接 8 個條件。輸出接 ${fn('Programming','Boolean','And Array Elements')} ${qd('And Array Elements')}，Create ▸ Indicator，標籤「條件全部 OK」。</p><p>Run，切掉任何一個開關，燈都要熄（規格 S1）。</p>`},
 {t:'缺哪一個：Search 1D Array',view:'split',add:['kF','srch','wb3','wb4','kn','ia','wb5','wb6','kq','cat','wb7','wb8','kok','sel','wb9','wb10','wb11','why','wb12'],h:`<p>${fn('Programming','Array','Search 1D Array')}：1D array 接 Build Array 的輸出，element 接 <b>False</b> 常數。</p>
 <p>名稱表：在 Index Array 的 array 上右鍵 ▸ Create ▸ Constant，做一個 8 格的字串陣列常數，<b>順序和 Build Array 一樣</b>。</p>
 ${wt([['Search 的 index of element','Index Array 的 index'],['字串常數「缺：」','Concatenate 的第 1 格'],['Index Array 的 element','Concatenate 的第 2 格'],['And Array Elements','Select 的 s（中間）'],['字串常數「條件全部 OK，可以啟動」','Select 的 t（上）'],['Concatenate 的輸出','Select 的 f（下）']])}
 <p>Run，切掉「包材有料」，看到「缺：包材有料」（規格 S4）。同時切掉兩個，只顯示比較前面的那一個。夠用嗎？下面有一題。</p>`},
 {t:'自保持：Or、And、Not ＋ Shift Register',view:'split',add:['kfr','sr','wr1','start','or','wr2','wr3','and1','wr4','wr5','stopm','not','wr6','and2','wr7','wr8','run','wr9','wr10'],h:`<p>迴圈邊框右鍵 ▸ Add Shift Register。左邊接 False 常數當初值（程式一開始是停的）。</p>
 <p>照那句話接：上一圈（Shift Register 左邊）<b>Or</b> 啟動 → <b>And</b> 條件全部 OK → <b>And</b>（停機經過 <b>Not</b>）→ 運轉中燈，同時接回 Shift Register 右邊。</p>
 <p>啟動、停機兩個按鈕：前面板右鍵 ▸ Mechanical Action ▸ <b>Latch When Released</b>。</p>
 <p>Run，照規格 S2、S3 測：條件不齊時按啟動 → 不會跑；跑起來後切掉一個條件 → 停；條件恢復 → <b>還是停</b>。</p>`},
 {t:'分級：重量和門檻陣列比',view:'split',add:['wg','kth','ge','wg1','wg2','b01','wg3','sum','wg4','kg','ia2','wg5','wg6','grade','wg7','kng','ia3','wg8','wg9','ng','wg10'],h:`<p>Greater Or Equal?：x 接重量，y 接門檻陣列常數 <code>490, 500, 510, 520</code>。輸出是 4 個 Boolean：重量大於等於哪幾個門檻。</p>
 <p>${fn('Programming','Boolean','Boolean To (0,1)')} 把 True 變 1，${fn('Programming','Numeric','Add Array Elements')} 加起來 ＝ <b>過了幾個門檻</b> ＝ 等級編號 0～4。</p>
 <p>兩個 Index Array 用這個編號查表：等級名稱（5 格字串陣列）和剔除旗標（5 格 Boolean 陣列：T F F F T）。</p>`},
 {t:'Run：照規格的邊界值測',view:'split',add:[],h:`<p>重量輸入 489.99、490、499.95、500、519.99、520，對照規格 S5。每一個都只會落在一格，沒有縫，也沒有重疊。</p>`}
]}},
ask('為什麼分級不用一串 Case 或 5 組 In Range and Coerce？',
 `<p>也可以，但每一個邊界會寫兩次：「偏輕的上限 500」和「標準的下限 500」。改規格時只改到一個，就出現縫或重疊。門檻陣列裡<b>每個邊界只寫一次</b>，而且「大於等於下限」自動就是「小於下一個門檻」。品保改成 6 級，只要門檻陣列多一個數、名稱多一格，接線一條都不用動。</p>
 <p>這是實務上很常用的想法：<b>會變的東西放在表裡（陣列常數、設定檔），不要寫死在接線裡</b>。</p>`),
ask('同時缺兩個條件，畫面只顯示第一個。夠不夠？要怎麼改成全部列出？',
 `<p>多數現場夠用：操作員處理完第一個，畫面就換成下一個。要全部列出時：用 For Loop 跑 8 次，條件是 False 的那一圈把名稱加進陣列（條件式通道，C16 課），最後用 ${fn('Programming','String','Concatenate Strings')} 或 Array To Spreadsheet String 接成一行。<b>先問操作員要哪一種</b>，不要自己決定做大的。</p>`),
C.h3('⑦ 測試、交機','','照規格一條一條打勾'),
C.table(['測試','操作','預期','結果'],[
 ['T1','8 個條件逐一切掉','「條件全部 OK」熄、顯示「缺：」該條件','☐'],
 ['T2','缺「包材有料」時按啟動，再把包材切回 OK','一直不會運轉','☐'],
 ['T3','運轉中打開安全門 1，再關上','立刻停，關上後仍停止','☐'],
 ['T4','運轉中按停機','停止','☐'],
 ['T5','重量 489.99、490、499.95、500、509.99、510、519.99、520','不足、偏輕、偏輕、標準、標準、偏重、偏重、超重','☐'],
 ['T6','重量 0（秤沒東西）','不足、剔除。這合理嗎？要問品保：沒有產品時該不該剔除','☐']
]),
`<p>T6 是測試時才冒出來的新問題。這很正常：<b>測試會找到規格沒寫到的地方</b>，記下來回去問，不要自己猜。</p>
<p>交機時給三樣東西：程式、這張測試表（打勾、簽名、日期）、一頁說明（每個燈和按鈕是什麼、缺條件時怎麼看）。</p>`,
note('這一課的模式，後面每一課都會用','需求 → 找出不清楚的地方 → 規格表 → I/O 盤點 → 小實驗驗證 → 規劃 → 一步一步寫 → 照規格測。W2 換成 DAQ，W3～W5 換成 myRIO，步驟一樣。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'Search 1D Array 在陣列裡找不到要找的值，會回傳？',o:['−1','0','陣列長度','錯誤'],a:0,ex:'找不到回傳 −1，要另外處理。'},
 {q:'「8 個 Boolean 全部是 True」最好改的寫法是？',o:['Build Array → And Array Elements','7 個 And 串起來','Or Array Elements','Add Array Elements'],a:0,ex:'條件變多只要多拉一格。'},
 {q:'品保的表寫「490～499.9」「500～509.9」，499.95 g 會怎樣？',o:['不在任何一格，要改成「≥ 下限且 < 上限」','算偏輕','算標準','秤不會出現這個數'],a:0,ex:'給人看的表會有縫，程式要用半開區間。'},
 {q:'啟動按鈕用 Switch When Pressed，最危險的情況是？',o:['條件恢復時機器自己啟動','按鈕按不下去','程式變慢','燈不亮'],a:0,ex:'Switch 一直保持 True。'},
 {q:'Greater Or Equal? 的 x 接 503、y 接 [490, 500, 510, 520]，輸出是？',o:['[T T F F]','T','2','[F F T T]'],a:0,ex:'陣列每一個元素都比一次：503 ≥ 490、503 ≥ 500 成立。'},
 {q:'這一課「運轉中」為什麼要用 Shift Register？',o:['按鈕彈回來後還要記得在運轉','讓迴圈跑比較快','Latch 規定要用','存重量'],a:0,ex:'這一圈要用上一圈的結果，就是 Shift Register。'}
]}
]});

/* ======================================================================
   W2：馬達監測站（DAQ）
   ====================================================================== */
function groundLab(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  let src='gnd',mode='rse',bias=false,card='multi',gp=0.5,t=0,seed=3,drift=0,timer=null;
  const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff-0.5;};
  el.innerHTML=`<p><label>訊號源：<select data-k="src"><option value="gnd">接地的（外殼接地的傳送器、插在同一個配電盤的儀器）</option><option value="flt">浮接的（電池供電、隔離型傳送器、沒碰到金屬的熱電偶）</option></select></label></p>
  <p><label>接法：<select data-k="mode"><option value="diff">差動（DIFF）</option><option value="rse" selected>參考單端（RSE）</option><option value="nrse">非參考單端（NRSE）</option></select></label>
  <label style="margin-left:10px"><input type="checkbox" data-k="bias"> 在 AI− 和 AIGND 之間加偏壓電阻</label></p>
  <p><label>DAQ 卡：<select data-k="card"><option value="multi">一般多功能卡（三種接法都有）</option><option value="6009">USB-6009（只有差動和 RSE）</option></select></label>
  <label style="margin-left:10px">兩邊地線的電位差：<input type="range" min="0" max="2" step="0.1" value="0.5" data-k="gp"> <b class="num" data-o="gp"></b> V</label></p>
  <canvas width="560" height="120" style="width:100%;max-width:560px;background:#111;border-radius:4px" data-o="cv"></canvas>
  <p>訊號源真正的電壓：<b>1.000 V</b>　DAQ 讀到的平均：<b class="num" data-o="avg"></b>　上下跳動：<b class="num" data-o="pp"></b></p>
  <p class="verdict" data-o="verdict" aria-live="polite"></p>`;
  const q=k=>el.querySelector('[data-k='+k+']'),o=k=>el.querySelector('[data-o='+k+']');
  const cv=o('cv'),ctx=cv.getContext('2d');
  function sample(tt){
    const hum=Math.sin(2*Math.PI*60*tt);
    if(src==='gnd'){
      if(mode==='rse')return 1+gp+0.5*gp*hum+rnd()*0.004;
      return 1+0.003*gp*hum+rnd()*0.004;
    }
    if(mode==='rse')return 1+rnd()*0.004;
    if(bias)return 1+rnd()*0.004;
    return Math.max(-10,Math.min(10,1+drift+0.8*hum+rnd()*0.3));
  }
  function verdict(){
    if(card==='6009'&&mode==='nrse')return ['bad','這張卡沒有 NRSE。建立通道時就會報錯：先查規格書的「Input modes」，再決定接法。'];
    if(src==='gnd'&&mode==='rse')return ['bad','讀數多了一段偏移，還疊著 60 Hz 的波：兩邊的地不是同一個電位，RSE 把這個差也量進去了（地迴路）。接地的訊號源改用差動或 NRSE。'];
    if(src==='gnd')return ['ok','正確。差動和 NRSE 量的是「訊號線對訊號自己的地」，兩邊地線的電位差被扣掉了。'];
    if(mode==='rse')return ['ok','正確。浮接的訊號源沒有自己的地，用 RSE 讓它以 DAQ 的地為基準。'];
    if(!bias)return ['bad','讀數亂飄，甚至頂到 ±10 V：浮接的訊號源沒有任何東西把它拉到 DAQ 的地附近，放大器的輸入在飄。加偏壓電阻（常見 10 kΩ～100 kΩ），或改用 RSE。'];
    return ['ok','正確。偏壓電阻給了浮接訊號源一個回到 AIGND 的路，差動的抗雜訊能力也保留下來。'];
  }
  function draw(){
    drift+=rnd()*0.4;drift=Math.max(-12,Math.min(12,drift));
    const N=280,vs=[];for(let i=0;i<N;i++)vs.push(sample(t+i/5000));t+=0.05;
    const lo=-2,hi=4,y=v=>cv.height-4-(Math.max(lo,Math.min(hi,v))-lo)/(hi-lo)*(cv.height-8);
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.strokeStyle='#335';ctx.beginPath();ctx.moveTo(0,y(0));ctx.lineTo(cv.width,y(0));ctx.stroke();
    ctx.strokeStyle='#666';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(0,y(1));ctx.lineTo(cv.width,y(1));ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#999';ctx.font='11px sans-serif';ctx.fillText('1 V（真正的值）',4,y(1)-4);ctx.fillText('0 V',4,y(0)-4);
    const [k]=verdict();
    if(!(card==='6009'&&mode==='nrse')){ctx.strokeStyle='#33ff33';ctx.beginPath();vs.forEach((v,i)=>{const x=i*cv.width/N;i?ctx.lineTo(x,y(v)):ctx.moveTo(x,y(v));});ctx.stroke();}
    const avg=vs.reduce((a,b)=>a+b,0)/N,pp=Math.max(...vs)-Math.min(...vs);
    o('avg').textContent=(card==='6009'&&mode==='nrse')?'—':avg.toFixed(3)+' V';o('pp').textContent=(card==='6009'&&mode==='nrse')?'—':pp.toFixed(3)+' V';o('gp').textContent=gp.toFixed(1);
    const [,m]=verdict();o('verdict').textContent=(k==='ok'?'✔ ':'✘ ')+m;o('verdict').style.color=k==='ok'?'#1b6b2f':'#a3261b';
  }
  q('src').onchange=e=>{src=e.target.value;draw();};
  q('mode').onchange=e=>{mode=e.target.value;draw();};
  q('bias').onchange=e=>{bias=e.target.checked;draw();};
  q('card').onchange=e=>{card=e.target.value;draw();};
  q('gp').oninput=e=>{gp=+e.target.value;draw();};
  draw();timer=setInterval(()=>{if(!document.body.contains(el)){clearInterval(timer);return;}draw();},300);
}

function specCalc(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  const RG=[10,5,2,1,0.5,0.2];
  let f=1000,ch=3,amp=2,bits=16,agg=250,mult=10;
  el.innerHTML=`<p><label>要看到的最高頻率 <input type="number" value="1000" data-k="f" style="width:6em"> Hz</label>
  <label style="margin-left:10px">通道數 <input type="number" value="3" min="1" max="32" data-k="ch" style="width:4em"></label>
  <label style="margin-left:10px">訊號最大 ± <input type="number" value="2" step="0.1" data-k="amp" style="width:5em"> V</label></p>
  <p><label>取樣率要幾倍 <select data-k="mult"><option value="2">2 倍（理論下限）</option><option value="5">5 倍</option><option value="10" selected>10 倍（看波形）</option></select></label>
  <label style="margin-left:10px">卡的解析度 <select data-k="bits"><option>12</option><option>14</option><option selected>16</option><option>24</option></select> 位元</label>
  <label style="margin-left:10px">卡的總取樣率 <input type="number" value="250" data-k="agg" style="width:5em"> kS/s（多工卡是所有通道合計）</label></p>
  <div data-o="out"></div>`;
  const q=k=>el.querySelector('[data-k='+k+']'),o=k=>el.querySelector('[data-o='+k+']');
  function draw(){
    const per=f*mult,need=per*ch/1000,fits=need<=agg;
    const rg=RG.filter(r=>r>=amp*1.1).pop()||null;
    const cw=rg?2*rg/Math.pow(2,bits):null;
    o('out').innerHTML=C.table(['項目','算法','結果'],[
     ['每個通道的取樣率',f+' Hz × '+mult,'<b>'+per.toLocaleString()+' S/s</b>'],
     ['所有通道合計',per.toLocaleString()+' × '+ch,'<b>'+need.toFixed(1)+' kS/s</b>　'+(fits?'✔ 卡的 '+agg+' kS/s 夠用':'✘ 超過卡的 '+agg+' kS/s：減少通道、降低倍數，或換每通道獨立 ADC 的卡')],
     ['量測範圍',rg?'包得住 ±'+amp+' V（留一成餘裕）的最小檔':'',rg?'<b>±'+rg+' V</b>':'✘ 沒有一檔包得住：訊號要先衰減（訊號調理）'],
     ['一格是多少（code width）',rg?'2 × '+rg+' V ÷ 2<sup>'+bits+'</sup>':'',cw?'<b>'+(cw*1e6>=1000?(cw*1e3).toFixed(3)+' mV':(cw*1e6).toFixed(1)+' µV')+'</b>':'—']
    ]);
  }
  ['f','ch','amp','agg'].forEach(k=>q(k).oninput=e=>{const v=+e.target.value;if(k==='f')f=v;if(k==='ch')ch=v;if(k==='amp')amp=v;if(k==='agg')agg=v;draw();});
  q('mult').onchange=e=>{mult=+e.target.value;draw();};q('bits').onchange=e=>{bits=+e.target.value;draw();};
  draw();
}

const DQ=['Functions','Measurement I/O','NI-DAQmx'];
const mv={name:'MotorVib.vi',view:'split',ratio:2.2,
 fp:{w:330,h:420,items:[
  {id:'w0',k:'num',ctl:true,label:'（模擬）1 號馬達軸承磨損 0～10',x:12,y:20,w:60,v:1,inc:1},
  {id:'w1',k:'num',ctl:true,label:'（模擬）2 號',x:12,y:70,w:60,v:2,inc:1},
  {id:'w2',k:'num',ctl:true,label:'（模擬）3 號',x:170,y:70,w:60,v:6,inc:1},
  {id:'slow',k:'btn',mech:'switch',label:'（模擬）迴圈裡多放 Wait 200 ms',showLabel:true,text:'多等 開／關',x:120,y:124},
  {id:'lim',k:'num',ctl:true,label:'警報上限 g rms',x:12,y:124,w:60,v:0.7,inc:0.1,dig:2},
  {id:'rmsI',k:'arr',t:'dbl',n:3,label:'振動 g rms（1～3 號）',x:12,y:180},
  {id:'al',k:'leds',label:'超過上限',names:['1 號','2 號','3 號'],cols:3,color:'red',x:12,y:236},
  {id:'avail',k:'num',label:'緩衝區裡還沒讀的樣本',x:12,y:290,w:90},
  {id:'err',k:'str',label:'錯誤',x:12,y:340,w:300},
  {id:'stop',k:'btn',label:'stop',text:'STOP',stop:true,x:250,y:290}]},
 bd:{w:1120,h:360,structs:[{id:'wl',k:'while',x:380,y:16,w:590,h:330,name:'迴圈：只讀和算'},{id:'fl',k:'for',x:560,y:150,w:170,h:110}],
  nodes:[
  {id:'kcfg',k:'const',t:'enum',v:'Differential',x:8,y:20},
  {id:'kph',k:'const',t:'str',v:'Dev1/ai0:2',x:8,y:52},
  {id:'kmin',k:'const',t:'dbl',v:-5,x:40,y:84},
  {id:'kmax',k:'const',t:'dbl',v:5,x:40,y:110},
  {id:'cvc',k:'fn',fn:'DAQmx Create Virtual Channel',ins:['input terminal configuration','physical channels','min value','max value','error in'],x:110,y:20,h:90},
  {id:'krate',k:'const',t:'dbl',v:10000,x:150,y:150},
  {id:'kmode',k:'const',t:'enum',v:'Continuous Samples',x:120,y:178},
  {id:'kbuf',k:'const',t:'i32',v:10000,x:160,y:206},
  {id:'tim',k:'fn',fn:'DAQmx Timing',x:230,y:20,h:90},
  {id:'sta',k:'fn',fn:'DAQmx Start Task',x:300,y:30},
  {id:'tt',k:'tunnel',t:'visa',s:'wl',y:50},
  {id:'te',k:'tunnel',t:'err',s:'wl',y:90},
  {id:'kn',k:'const',t:'i32',v:1000,x:400,y:120},
  {id:'rd',k:'fn',fn:'DAQmx Read',x:450,y:40},
  {id:'ti',k:'tunnel',t:'dbl[][]',s:'fl',side:'l',y:200,idx:true},
  {id:'rms',k:'fn',fn:'RMS',x:590,y:184},
  {id:'ks',k:'const',t:'dbl',v:0.1,x:600,y:228,label:'100 mV/g'},
  {id:'div',k:'fn',fn:'Divide',x:650,y:190},
  {id:'to',k:'tunnel',t:'dbl[]',s:'fl',side:'r',y:204,idx:true},
  {id:'rmsI',k:'ind',t:'dbl[]',label:'振動 g rms',x:760,y:160},
  {id:'lim',k:'ctl',t:'dbl',label:'警報上限 g rms',x:740,y:280},
  {id:'gt',k:'fn',fn:'Greater?',x:840,y:220},
  {id:'al',k:'ind',t:'bool[]',label:'超過上限',x:890,y:226},
  {id:'ub',k:'unbundle',items:['status'],x:560,y:70,w:60},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:640,y:110},
  {id:'or',k:'fn',fn:'Or',x:700,y:90},
  {id:'cond',k:'stop',s:'wl'},
  {id:'to2',k:'tunnel',t:'visa',s:'wl',side:'r',y:50},
  {id:'te2',k:'tunnel',t:'err',s:'wl',side:'r',y:90},
  {id:'stp',k:'fn',fn:'DAQmx Stop Task',x:990,y:40},
  {id:'clr',k:'fn',fn:'DAQmx Clear Task',x:1050,y:40},
  {id:'seh',k:'fn',fn:'Simple Error Handler',x:1060,y:120}],
  wires:[
  {id:'a1',from:'kcfg',to:'cvc.input terminal configuration',t:'enum',mx:100},
  {id:'a2',from:'kph',to:'cvc.physical channels',t:'str',mx:96},
  {id:'a3',from:'kmin',to:'cvc.min value',t:'dbl',mx:94},
  {id:'a4',from:'kmax',to:'cvc.max value',t:'dbl',mx:92},
  {id:'b1',from:'cvc.task out',to:'tim.task/channels in',t:'visa',mx:200},
  {id:'b2',from:'cvc.error out',to:'tim.error in',t:'err',mx:205},
  {id:'b3',from:'krate',to:'tim.rate',t:'dbl',mx:215},
  {id:'b4',from:'kmode',to:'tim.sample mode',t:'enum',mx:218},
  {id:'b5',from:'kbuf',to:'tim.samples per channel',t:'i32',mx:221},
  {id:'c1',from:'tim.task out',to:'sta.task/channels in',t:'visa',mx:285},
  {id:'c2',from:'tim.error out',to:'sta.error in',t:'err',mx:288},
  {id:'c3',from:'sta.task out',to:'tt.o',t:'visa'},
  {id:'c4',from:'sta.error out',to:'te.o',t:'err'},
  {id:'d1',from:'tt.i',to:'rd.task/channels in',t:'visa'},
  {id:'d2',from:'kn',to:'rd.number of samples per channel',t:'i32',mx:440},
  {id:'d3',from:'te.i',to:'rd.error in',t:'err',mx:430},
  {id:'d4',from:'rd.data',to:'ti.o',t:'dbl[][]',mx:520},
  {id:'d5',from:'ti.i',to:'rms.X',t:'dbl[]'},
  {id:'d6',from:'rms.rms value',to:'div.x',t:'dbl',mx:640},
  {id:'d7',from:'ks',to:'div.y',t:'dbl',mx:640},
  {id:'d8',from:'div.out',to:'to.i',t:'dbl'},
  {id:'d9',from:'to.o',to:'rmsI',t:'dbl[]',mx:745},
  {id:'d10',from:'to.o',to:'gt.x',t:'dbl[]',mx:745},
  {id:'d11',from:'lim',to:'gt.y',t:'dbl',mx:820},
  {id:'d12',from:'gt.out',to:'al',t:'bool[]'},
  {id:'e1',from:'rd.error out',to:'ub.input cluster',t:'err',mx:530},
  {id:'e2',from:'ub.status',to:'or.x',t:'bool',mx:680},
  {id:'e3',from:'stop',to:'or.y',t:'bool',mx:685},
  {id:'e4',from:'or.out',to:'cond',t:'bool',pts:[[740,104],[740,320],[950,320]]},
  {id:'f1',from:'rd.task out',to:'to2.i',t:'visa'},
  {id:'f2',from:'rd.error out',to:'te2.i',t:'err',mx:530},
  {id:'f3',from:'to2.o',to:'stp.task/channels in',t:'visa'},
  {id:'f4',from:'te2.o',to:'stp.error in',t:'err',mx:980},
  {id:'f5',from:'stp.task out',to:'clr.task/channels in',t:'visa'},
  {id:'f6',from:'stp.error out',to:'clr.error in',t:'err',mx:1040},
  {id:'f7',from:'clr.error out',to:'seh',t:'err',mx:1045}]},
 sim:{period:150,init:()=>({back:0,r:11}),
  step(inp,st){
   const rn=()=>{st.r=(st.r*1103515245+12345)%2147483648;return st.r/2147483648-0.5;};
   const loopMs=100+(inp.slow?200:0);st.back+=Math.round(10000*loopMs/1000)-1000;
   const over=st.back>10000;
   const g=[0,1,2].map(i=>{const w=Math.max(0,+inp['w'+i]||0);return 0.15+w*0.08+rn()*0.02;});
   const lim=+inp.lim||0,al=g.map(v=>v>lim);
   if(over){return {out:{avail:st.back,err:'錯誤 −200279：要讀的樣本已經被新的資料蓋掉了（迴圈太慢）',rmsI:g,al},vals:{'ub.status':true,'or.out':true},stop:true,msg:'緩衝區滿了：DAQ 一直在擷取，迴圈拿得比它放得慢'};}
   const vals={kcfg:'Differential',kph:'Dev1/ai0:2',kmin:-5,kmax:5,krate:10000,kmode:'Continuous',kbuf:10000,kn:1000,'rd.data':'3 × 1000 個電壓','rms.rms value':(g[0]*0.1).toFixed(4)+' V（1 號）',ks:0.1,'div.out':g[0],'to.o':'['+g.map(v=>v.toFixed(3)).join(', ')+']',lim,'gt.out':'['+al.map(b=>b?'T':'F').join(' ')+']','ub.status':false,stop:!!inp.stop,'or.out':!!inp.stop};
   return {out:{rmsI:g,al,avail:st.back,err:''},vals,stop:!!inp.stop,msg:'這一圈 '+loopMs+' ms：DAQ 放進 '+(10000*loopMs/1000)+' 筆、Read 拿走 1000 筆，還沒讀的 '+st.back+' 筆'};},
  doneMsg:'迴圈結束，Stop、Clear 都執行了（有錯誤時看前面板的「錯誤」欄）'}
};

L.push({id:'W02',order:30.982,no:'W2',part:PART,title:'馬達監測站：一份 DAQ 工作，從感測器、接線方式到 DAQmx 程式',mins:75,files:['練習\\實務\\MotorVib.vi'],
goals:[['學會','從物理量回推要什麼感測器和訊號調理；判斷訊號源是接地還是浮接，選差動、RSE 或 NRSE；用三個 R（範圍、解析度、取樣率）和通道數決定硬體；先在 MAX 驗證；DAQmx 的建立通道 → 時脈 → Start → 迴圈 Read → Stop、Clear，以及「Start 之後硬體就在跑」。'],['做出','MotorVib.vi：三台馬達的振動，每 0.1 秒算一次 g rms，超過上限亮燈。'],['素材','DAQ 講義的訊號調理、接地與三種接法、三個 R、多工架構、MAX、DAQmx 流程。這一課把它們排成一份真的工作。']],
check:'拿到一個新的量測需求，能說出：要什麼感測器、要什麼訊號調理、接法選哪一種和為什麼、每通道取樣率和總取樣率、量測範圍；寫出連續擷取的 DAQmx 程式，並解釋迴圈裡為什麼不放 Wait。',
body:[
C.h3('① 聽懂需求','','廠務的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「三台抽風機的馬達最近一直壞，換軸承很貴。能不能量一下振動，快壞的時候先通知？資料存起來，我們想看趨勢。」</p></div>`,
`<p>這次對方連要量什麼都只說了「振動」。DAQ 的工作，第一步永遠是從<b>物理量</b>往回推。</p>`,
ask('要回去問的問題有哪些？',
 `<ul><li><b>量哪裡、量幾個點</b>：每台馬達量一個點（靠近軸承的外殼）→ 3 個通道。</li>
 <li><b>振動多快</b>：轉速 1800 rpm（30 Hz），軸承損壞的特徵頻率通常在幾百 Hz 到 1 kHz 左右，所以要看得到 <b>1 kHz</b>。</li>
 <li><b>多大</b>：正常約 0.2～0.5 g，要警報的大概 0.7 g 以上。最大可能到幾 g。</li>
 <li><b>距離和環境</b>：機房裡、旁邊有變頻器（雜訊大），感測器到 DAQ 約 10 公尺。</li>
 <li><b>「通知」是什麼</b>：畫面亮燈就好，還是要發訊息、接到 PLC？先做亮燈。</li>
 <li><b>「趨勢」存多久、多密</b>：每分鐘存一筆 g rms 就好，不用存原始波形。</li></ul>`),
C.h3('② 規格','','寫成能測的句子'),
C.table(['編號','規格'],[
 ['S1','3 台馬達各 1 個振動量測點，頻寬至少 10 Hz～1 kHz'],
 ['S2','每 0.1 秒算一次每台的振動有效值（g rms），畫面顯示到小數 3 位'],
 ['S3','任一台超過上限（預設 0.7 g rms，可在畫面調）亮紅燈'],
 ['S4','每分鐘把 3 台的 g rms 加時間寫一行 CSV'],
 ['S5','感測器斷線或 DAQ 出錯：畫面顯示錯誤，程式安全結束（Stop、Clear 都要執行）']
]),
C.h3('③ 盤點','','從物理量到電腦，一路要經過什麼'),
{fn:d=>{d.innerHTML=`<div class="fig"><svg viewBox="0 0 900 150" width="100%" style="max-width:900px" font-family="Microsoft JhengHei UI,sans-serif">
<defs><marker id="w2a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="#445"/></marker></defs>
${[['物理現象','馬達振動'],['感測器','加速規'],['訊號調理','激發電流、濾波'],['DAQ 硬體','多工 ADC'],['電腦','DAQmx ＋ LabVIEW']].map((b,i)=>`<rect x="${10+i*178}" y="30" width="150" height="80" rx="10" fill="${['#fff3e0','#eef4ff','#f6f0ff','#effaf2','#eef4ff'][i]}" stroke="#889"/><text x="${85+i*178}" y="62" text-anchor="middle" font-size="16" font-weight="700">${b[0]}</text><text x="${85+i*178}" y="88" text-anchor="middle" font-size="13" fill="#445">${b[1]}</text>${i<4?`<path d="M${162+i*178},70H${186+i*178}" stroke="#445" stroke-width="2.5" marker-end="url(#w2a)"/>`:''}`).join('')}
</svg><div class="cap">講義的典型架構。每一個箭頭都是一個要做決定的地方。</div></div>`;}},
`<p>講義列了常見感測器需要的訊號調理。<b>不是每一種都要，但你要知道為什麼要</b>：</p>`,
C.table(['感測器','為什麼要調理','要什麼'],[
 ['熱電偶（溫度）','輸出只有幾十 µV/°C，很小；它量的是「兩端的溫差」','放大、冷接點補償、濾波'],
 ['加速規（振動，IEPE 型）','裡面有放大電路，要外部給它一個定電流才會動；高頻雜訊會混進來','電流激發、AC 耦合、反失真濾波'],
 ['應變規（力、壓力）','是一個電阻，電阻變化很小，要接成電橋、給電壓才變成電壓訊號','電壓激發、電橋補償、放大、濾波'],
 ['高電壓（例如量 220 V）','直接接會燒 DAQ、也有人身危險','隔離']
]),
ask('這份工作的加速規，要自己做激發電流嗎？',
 `<p>可以自己做，但實務上通常<b>買內建 IEPE 激發的振動量測模組</b>：激發電流、AC 耦合、反失真濾波都在模組裡，接上就能量。自己做電路省下的錢，往往不夠付除錯的時間。這是盤點時的典型決定：<b>訊號調理放在硬體裡買，還是自己做</b>。</p>
 <p>判斷方法：先看感測器規格書寫它要什麼（IEPE、激發電壓、輸出範圍），再找有這些功能的 DAQ 模組。找不到才考慮外接調理電路。</p>`),
C.h3('④ 接線方式','','差動、RSE、NRSE 怎麼選'),
`<p>講義列了三種類比輸入的接法。名詞很嚇人，判斷其實只要問<b>一個問題</b>：</p>
<p style="font-size:1.1em;text-align:center"><b>訊號源自己有沒有接地？</b></p>`,
C.table(['','接地的訊號源','浮接的訊號源'],[
 ['例子','外殼接地的傳送器、插同一個配電盤的儀器','電池供電的裝置、隔離型傳送器、沒碰到金屬的熱電偶'],
 ['差動（DIFF）','✔ 最好：兩邊地的電位差被扣掉','✔ 要加偏壓電阻'],
 ['RSE（以 DAQ 的地為準）','✘ 避免：兩邊的地不同電位，差值會被量進去','✔ 可以'],
 ['NRSE（以 AISENSE 為準）','✔ 可以：AISENSE 接到訊號源的地','✔ 要加偏壓電阻']
]),
`<p>下面自己試：先選「接地的訊號源 ＋ RSE」，把兩邊地的電位差拉大，看讀數怎麼變；再換成浮接 ＋ 差動，不加偏壓電阻。</p>`,
{fn:groundLab},
ask('為什麼差動接法每個通道要兩隻腳？這對這份工作有什麼影響？',
 `<p>差動量的是 AI+ 和 AI− 之間的電壓，所以一個通道用掉兩隻腳。例如 8 隻腳的卡，單端可以接 8 個通道，差動只剩 4 個。這份工作 3 個通道，用差動夠。<b>盤點通道數時，要用「選好接法之後」的數字</b>。</p>`),
warn('先查卡支援哪幾種','不是每張卡都有三種接法。例如 USB-6009 只有差動和 RSE。選接法之前先翻規格書，不然接好線才發現不能設定。'),
C.h3('⑤ 三個 R','','用數字決定硬體夠不夠'),
`<p>DAQ 實驗室有三個 R 的動畫，這裡只做決定。這份工作：最高 1 kHz、3 個通道、訊號最大約 ±2 V（加速規 100 mV/g，最大 20 g）。</p>`,
{fn:specCalc},
ask('講義說有兩種 DAQ 架構：所有通道共用一個 ADC（多工），或每個通道一個 ADC（同步）。這份工作選哪一種？',
 `<p><b>多工就夠了</b>：3 台馬達各量各的，不需要比較「同一瞬間」三個通道的相位。只要總取樣率夠（3 × 10 kS/s ＝ 30 kS/s）。</p>
 <p>什麼時候要同步取樣？要比較兩個通道的相位（例如同一台機器兩個方向的振動、量功率要電壓和電流同時取樣），或是每個通道都要很高的取樣率。多工的通道是輪流取樣，第 1 和第 3 通道之間有一小段時間差。</p>`),
C.h3('⑥ 先驗證','','還沒寫程式，先在 MAX 量到訊號'),
`<ol><li>打開 <b>NI MAX</b>（Measurement &amp; Automation Explorer）▸ Devices and Interfaces，找到你的 DAQ，按右鍵 ▸ <b>Self-Test</b>。過了才代表卡和驅動是好的。</li>
<li>同一個選單 ▸ <b>Device Pinouts</b>：看接腳圖，對照你的接線表確認每一條線插在哪一隻腳。</li>
<li>右鍵 ▸ <b>Test Panels</b>：選 ai0、接法選差動、範圍 ±5 V、連續模式，按 Start。用手輕敲馬達外殼，波形要有反應。</li>
<li>三個通道都試一次。<b>MAX 量不到，LabVIEW 也量不到</b>：先查接線、接法、感測器電源。</li></ol>`,
tip('MAX 是你的萬用表','以後客戶說「LabVIEW 讀不到」，先開 MAX 的 Test Panels。讀得到 → 問題在程式；讀不到 → 問題在硬體或接線。一分鐘就能把問題切成兩半。'),
C.h3('⑦ 規劃','','DAQmx 的流程和一個很常見的誤會'),
`<p>講義的 DAQmx 流程：<b>建立通道 → 設定時脈 →（觸發）→ Start → Read → Stop → Clear</b>。照「只做一次的放迴圈外，一直做的放迴圈裡」：建立、時脈、Start 在迴圈前；Read 在迴圈裡；Stop、Clear 在迴圈後。</p>
<p>講義特別提醒一件事：<b>DAQ 卡是在 Start 那一刻就開始擷取</b>，不是等到 Read。Start 之後，硬體照著時脈一直把資料放進電腦記憶體裡的緩衝區；Read 只是從緩衝區拿資料出來。</p>`,
ask('如果迴圈拿得比硬體放得慢，會發生什麼事？',
 `<p>緩衝區會越積越多，滿了之後新的資料蓋掉還沒讀的舊資料，DAQmx 報錯 <b>−200279</b>（要讀的樣本已經不在了）。所以連續擷取的迴圈：</p>
 <ul><li><b>不要放 Wait</b>。Read 要 1000 筆、取樣率 10 kS/s，Read 自己就會等 0.1 秒，迴圈的節奏由硬體決定。</li>
 <li>迴圈裡<b>不要做慢的事</b>（寫大檔、跳對話框）。慢的工作丟給另一個迴圈（第 16 課的 Producer/Consumer）。</li></ul>
 <p>沒有接「設定時脈」的話，DAQmx 用 On Demand 模式：每次 Read 才量一點，時間間隔由軟體決定，不穩。看波形一定要接時脈。</p>`),
C.plan({start:'新 VI，存成 <code>練習\\實務\\MotorVib.vi</code>。MAX 的 Test Panels 已經三個通道都看得到波形。',
 in:'DAQmx Read（<b>Analog 2D DBL, NChan NSamp</b>）：3 列 × 1000 個電壓，單位 V。每一列是一台馬達。',
 calc:'For Loop 自動索引把 2D 拆成一列一列 → <b>RMS</b> → 除以感測器的靈敏度（校正單上寫 100 mV/g ＝ 0.1 V/g）→ g rms。和上限比 → 3 個 Boolean。',
 out:'數值陣列（3 位小數）和 3 顆紅燈。每分鐘寫 CSV 的部分放下一步（用 Elapsed Time 判斷滿一分鐘，F4 課的附加寫入）。',
 loop:'不放 Wait。取樣率 10 kS/s、每次讀 1000 筆 → 每 0.1 秒一圈，由硬體決定。',
 end:'按 Stop 或 Read 出錯（error 的 status 是 True）就停。迴圈外 Stop → Clear → Simple Error Handler，出錯也一定會清掉 Task。'}),
C.h3('⑧ 一步一步寫','','打開「多等」看看迴圈慢了會怎樣'),
{steps:{title:'MotorVib.vi：連續擷取 → RMS → 警報',lv:mv,steps:[
 {t:'建立通道：接法和範圍在這裡決定',view:'bd',add:['kcfg','kph','kmin','kmax','cvc','a1','a2','a3','a4'],h:`<p>${fn('Measurement I/O','NI-DAQmx','DAQmx Create Virtual Channel')}，下面的選單選 <b>Analog Input ▸ Voltage</b>。</p><p>physical channels 寫 <code>Dev1/ai0:2</code>（ai0 到 ai2，三個通道一次建）。min/max 是 −5 和 5：選好範圍，卡會自動用包得住它的最小檔。<b>input terminal configuration</b> 右鍵 Create ▸ Constant，選 <b>Differential</b>：第 ④ 段的決定寫在這裡。</p>`},
 {t:'時脈：10 kS/s、連續',view:'bd',add:['krate','kmode','kbuf','tim','b1','b2','b3','b4','b5'],h:`<p>${fn('Measurement I/O','NI-DAQmx','DAQmx Timing')}，選 Sample Clock。rate 10000，sample mode 選 <b>Continuous Samples</b>。連續模式下 samples per channel 決定緩衝區大小，給 10000（1 秒的量）。</p>`},
 {t:'Start：從這裡開始，硬體就在跑了',view:'bd',add:['sta','c1','c2'],h:`<p>${fn('Measurement I/O','NI-DAQmx','DAQmx Start Task')}。task 線和 error 線都接好：資料流保證先建通道、設時脈，才 Start。</p>`},
 {t:'迴圈裡只放 Read',view:'split',add:['wl','tt','te','c3','c4','kn','rd','d1','d2','d3','f1','f2','to2','te2','slow'],h:`<p>${fn('Measurement I/O','NI-DAQmx','DAQmx Read')}，下面的選單選 <b>Analog ▸ Multiple Channels ▸ Multiple Samples ▸ 2D DBL</b>。number of samples per channel 給 1000。</p><p>先接一個 Waveform Graph 看原始波形（這一步先看原始資料，跟 I3 課一樣）。</p>`},
 {t:'For Loop：每一列算一次 RMS',view:'split',add:['fl','ti','d4','rms','d5','ks','div','d6','d7','to','d8','rmsI','d9','w0','w1','w2'],h:`<p>2D 陣列接進 For Loop，通道預設是自動索引：<b>每一圈拿到一列</b>（一台馬達的 1000 個點），不用接 N。</p><p>${fn('Mathematics','Probability & Statistics','RMS')}，再除以 0.1（V/g）。常數旁邊寫「100 mV/g」：換感測器時要改這個數，<b>每一顆的靈敏度在它的校正單上</b>。</p>`},
 {t:'警報、結束條件',view:'split',add:['lim','gt','d10','d11','al','d12','ub','e1','stop','or','e2','e3','cond','e4','avail','err'],h:`<p>Greater? 接陣列和上限 → 3 個 Boolean，接一個 Boolean 陣列顯示（三顆燈）。</p><p>Read 的 error out 用 ${fn('Programming','Cluster, Class, & Variant','Unbundle By Name')} 拿 status，和 Stop 按鈕 Or 起來接迴圈的停止條件：<b>出錯就停</b>，不要讓迴圈一直對壞掉的 Task 讀。</p>`},
 {t:'Stop、Clear、錯誤處理',view:'bd',add:['stp','clr','seh','f3','f4','f5','f6','f7'],h:`<p>迴圈外依序 ${fn('Measurement I/O','NI-DAQmx','DAQmx Stop Task')}、${fn('Measurement I/O','NI-DAQmx','DAQmx Clear Task')}、Simple Error Handler。</p><p>Clear 一定要執行：不清掉，下次 Run 會說資源被佔用。DAQmx 的 Stop 和 Clear 在 error in 有錯誤時<b>仍然會執行</b>，所以 error 線直接串下去就好。</p>`},
 {t:'Run：調磨損，再打開「多等」',view:'split',add:[],h:`<p>把 3 號的磨損調高，超過上限的燈亮。</p><p>接著打開「迴圈裡多放 Wait 200 ms」：每一圈變成 300 ms，硬體放進 3000 筆、Read 只拿 1000 筆，「還沒讀的樣本」一直變多，超過緩衝區就出現 −200279。這就是「Start 之後硬體就在跑」的意思。</p>`}
]}},
C.h3('⑨ 測試、交機','','用已知的訊號驗證，不要用馬達'),
C.table(['測試','操作','預期'],[
 ['T1 換算','訊號產生器輸出 100 Hz、0.100 V rms 接到 ai0（代替加速規）','顯示 1.000 g rms（0.1 V ÷ 0.1 V/g）'],
 ['T2 通道對應','訊號依序接 ai0、ai1、ai2','只有對應的那一台有數字：沒有接錯線、沒有串音'],
 ['T3 頻寬','頻率改成 1 kHz，振幅不變','讀數不變（1 kHz 在規格內）'],
 ['T4 警報','上限設 0.5，振幅慢慢調高','超過的那一刻亮燈'],
 ['T5 斷線','拔掉一台的感測器','依模組不同：顯示 0、亂跳，或模組報開路。把實際看到的寫進說明書'],
 ['T6 長時間','連續跑 8 小時','沒有 −200279、記憶體不增加、CSV 每分鐘一行']
]),
`<p>T1 用訊號產生器而不是馬達：<b>你知道答案是多少</b>，才驗證得了程式。馬達的振動本來就不知道是多少，拿它測什麼都說不準。T6 很多人省略，結果現場跑兩天才出事。</p>
<p>交機資料：接線表（哪一台接哪個通道、差動的 + − 各接哪隻腳）、每顆感測器的靈敏度、MAX 的 Task 設定截圖、測試紀錄、程式。</p>`,
C.h3('測','q','小測驗'),
{quiz:[
 {q:'外殼接地的傳送器，接 DAQ 時最應該避免哪一種接法？',o:['RSE','差動','NRSE','都可以'],a:0,ex:'兩邊的地不同電位，RSE 會把差量進去。'},
 {q:'浮接的訊號源用差動接法，讀數亂飄，要？',o:['在 AI− 和 AIGND 之間加偏壓電阻','把取樣率加倍','換成 NRSE 就好','加 Wait'],a:0,ex:'浮接的訊號源需要一條回到 DAQ 地的路。'},
 {q:'要看到 1 kHz 的振動，3 個通道、每個通道 10 倍取樣，多工卡的總取樣率至少要？',o:['30 kS/s','10 kS/s','3 kS/s','2 kS/s'],a:0,ex:'1 k × 10 × 3。'},
 {q:'DAQmx 連續擷取時，硬體從什麼時候開始擷取？',o:['DAQmx Start Task','第一次 DAQmx Read','DAQmx Timing','Create Virtual Channel'],a:0,ex:'Read 只是從緩衝區拿資料。'},
 {q:'連續擷取的迴圈裡又放了 Wait 200 ms，最可能出現？',o:['緩衝區被蓋掉，錯誤 −200279','資料變準','取樣率變高','沒有影響'],a:0,ex:'迴圈拿得比硬體放得慢。'},
 {q:'加速規的「100 mV/g」要寫在程式哪裡？',o:['把 RMS 的電壓換成 g 的那個常數，旁邊寫清楚','DAQmx Timing 的 rate','量測範圍','不用寫'],a:0,ex:'換感測器時要改這個數。'},
 {q:'拿到量測需求，第一步是？',o:['從物理量往回推感測器和訊號調理','先寫 DAQmx 程式','先買最貴的卡','先決定取樣率'],a:0,ex:'物理量 → 感測器 → 調理 → DAQ → 程式。'}
]}
]});
})();
