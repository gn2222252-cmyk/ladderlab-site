/* 高階實務 H1：接手物件導向的測試程式。
   證據（docs/research_advanced.md）：S09 竹北精密設備廠職缺「理解並修改用 LabVIEW 物件導向架構的軟體」；P01 用人主管都問架構與維護；
   資深職缺多出「架構與模組設計」。教材用 LabVIEW 內附的 NI 範例 Board Testing（examples\Object-Oriented Programming\Board Testing），
   2026-11-17 在 LabVIEW 2026 複製後開啟、截圖、執行過（labview_vi/_build/probe_board*.py）：兩個版本各處理 150 片（每種 50 片），
   類別繼承由 .lvclass 檔確認。建立新類別的步驟無法用腳本實測，照 NI 說明寫，課文有註明。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='高階實務';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary><div class="ans">${a}</div></details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
if(!LV.F['And Array Elements'])LV.F['And Array Elements']={p:'∀',a:1,pal:['Functions','Programming','Boolean','And Array Elements']};

/* ---- 範例裡的類別（由 .lvclass 檔確認的繼承） ---- */
const BOARDS={
 'Basic DAQ Board':{cls:'Basic DAQ Design',chain:['Basic DAQ Design','DAQ Board Design','Board Design'],gc:'DAQ Board Design',extra:null},
 'Elite DAQ Board':{cls:'Elite DAQ Design',chain:['Elite DAQ Design','DAQ Board Design','Board Design'],gc:'Elite DAQ Design',extra:'Magic Signal Filter'},
 'GPIB Board':{cls:'GPIB Board Design',chain:['GPIB Board Design','Board Design'],gc:'GPIB Board Design',extra:null}
};
const PARTS=['AD Converter','DA Converter','FPGA Chip','Resistor'];

function treeFig(el){
  el.className='fig';el.style.cssText='border:1px solid #d5c9c9;border-radius:6px;padding:10px 12px;background:#fffafa;font-size:13px';
  const box=(t,c,sub)=>`<div style="display:inline-block;border:2px solid ${c};border-radius:4px;padding:3px 8px;margin:3px;background:#fff"><b>${t}</b>${sub?`<div style="font-size:11px;color:#555">${sub}</div>`:''}</div>`;
  el.innerHTML=`<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px">
   <div><div style="color:#2f7d3a;font-weight:bold;margin-bottom:4px">板子（綠色的線）</div>
    ${box('Board Design','#2f7d3a','Get Components：空的（給子類別覆寫）<br>Get Test Name、Check Image Matches Design')}
    <div style="margin-left:22px">└ ${box('DAQ Board Design','#2f7d3a','Get Components：A/D、D/A、FPGA、電阻')}
     <div style="margin-left:22px">└ ${box('Basic DAQ Design','#2f7d3a','只覆寫名稱和編號')}<br>└ ${box('Elite DAQ Design','#2f7d3a','Get Components：先叫父類別，再加一顆濾波器')}</div>
     └ ${box('GPIB Board Design','#2f7d3a','Get Components：同樣四種零件，位置不同')}</div></div>
   <div><div style="color:#a33b3b;font-weight:bold;margin-bottom:4px">零件（紅色的線）</div>
    ${box('Component','#a33b3b','資料：列、行、橫放？<br>Self Test：永遠回 F（給子類別覆寫）')}
    <div style="margin-left:22px">${PARTS.concat(['Magic Signal Filter']).map(p=>'└ '+box(p,'#a33b3b','Self Test：在自己的位置找自己的顏色')).join('<br>')}</div></div></div>
   <p style="margin:8px 0 0;color:#555">在 LabVIEW 裡：專案視窗選任一個類別，<b>View ▸ Class Hierarchy</b> 會畫出同樣的樹。</p>`;
}

/* ---- 動態分派探索：選一種板子，看實際跑的是哪一個 VI ---- */
function dispatchFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff;font-size:13px';
  el.innerHTML=`<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
    <label>佇列送來的這張圖是 <select data-k="b">${Object.keys(BOARDS).map(b=>`<option>${b}</option>`).join('')}</select></label>
    <label><input type="checkbox" data-k="bad"> 這一片有一顆 A/D 沒焊上</label></div>
    <div data-o="out" style="margin-top:8px"></div>`;
  function draw(){
    const b=el.querySelector('[data-k=b]').value,bad=el.querySelector('[data-k=bad]').checked,B=BOARDS[b];
    const comps=PARTS.map(p=>({p,ok:!(bad&&p==='AD Converter')}));
    if(B.extra)comps.push({p:B.extra,ok:true});
    const pass=comps.every(c=>c.ok);
    const gcRow=B.extra
      ?`<b>${B.gc}</b>::Get Components.vi → 裡面的 Call Parent Method 叫 <b>DAQ Board Design</b>::Get Components.vi → 回來再加 Magic Signal Filter（第 4 列第 3 行）`
      :`<b>${B.gc}</b>::Get Components.vi`;
    el.querySelector('[data-o=out]').innerHTML=`
     <ol style="margin:4px 0;padding-left:20px">
      <li>Enum to Board Design.vi：Case 選到「${b}」頁，輸出一個 <b>${B.cls}</b> 的物件。<span style="color:#666">（整支程式裡唯一的 Case：選板子的地方）</span></li>
      <li>Check Image Matches Design.vi 收到的線型別是 <b>Board Design</b>，但線上跑的是 <b>${B.cls}</b>。它呼叫 Get Components，實際執行：${gcRow}</li>
      <li>For Loop 每一圈拿一個零件呼叫 Self Test.vi，實際執行的是：
       <table style="border-collapse:collapse;margin:4px 0">${comps.map(c=>`<tr><td style="padding:1px 8px;border-bottom:1px solid #e3e8f0">${c.p}::Self Test.vi</td><td style="padding:1px 8px;border-bottom:1px solid #e3e8f0;color:${c.ok?'#1e7b34':'#c0392b'}">${c.ok?'T':'F：該有的顏色不在那裡'}</td></tr>`).join('')}</table></li>
      <li>And Array Elements：${pass?'全部 T，<b style="color:#1e7b34">pass? = T</b>':'有一個 F，<b style="color:#c0392b">pass? = F</b>'}</li>
      <li>Get Test Name.vi：<code>Get Class Name</code>（${B.cls} 覆寫）＋「 - 」＋<code>Get Unique Test ID</code>（${B.cls} 覆寫，每個類別自己的計數器）</li>
     </ol>
     <p style="margin:4px 0;color:#555">${B.chain.join(' → ')}：LabVIEW 從最下層的類別往上找，第一個有這個 VI 的就執行它。</p>`;
  }
  el.querySelectorAll('select,input').forEach(s=>s.onchange=draw);draw();
}

/* ---- 改一個零件：兩種寫法要動哪裡 ---- */
function changeFig(el){
  el.className='fig';el.style.cssText='border:1px solid #e8dca8;border-radius:6px;padding:10px 12px;background:#fffdf3;font-size:13px';
  const CH=[
   {t:'零件廠商把 A/D 轉換器的外觀換成紅色',task:['Test_Common To All Boards.vi 是三種板子共用的；但 GPIB 板上同一個位置的那顆，其實是 A/D 還是 D/A？要回去查設計','拆成兩份共用 VI，或在共用 VI 裡加判斷','Test A／B／C.vi 裡每一個找藍色的地方，逐一判斷是 A/D 還是 D/A'],
    obj:['AD Converter::Self Test.vi：把顏色常數改成紅色'],risk:'Case 版要你記得每一塊藍色是什麼零件；類別版的「它是什麼零件」已經寫在物件裡了。'},
   {t:'多一種新板子（例：DAQ Pro = Elite 再加一顆 FPGA）',task:['複製 Test B.vi 改成 Test D.vi，加一段找 FPGA 的程式','主程式的 Case 加一頁 DAQ Pro','Get Test Name 那一段 Case 也要加'],
    obj:['新類別 DAQ Pro Design，繼承 Elite DAQ Design','覆寫 Get Components：Call Parent Method 拿到 Elite 的零件，再加一顆 FPGA','覆寫 Get Class Name、Get Unique Test ID','Board Type Enum 加一項、Enum to Board Design 加一頁（唯一要動的 Case）'],risk:'類別版不碰 Check Image Matches Design、不碰主程式迴圈：已經驗證過的東西沒被改到。'},
   {t:'某一顆零件改成橫放',task:['找到所有檢查那顆零件的地方，改座標和尺寸'],obj:['Get Components 裡那顆零件的 landscape? 改成 T（Component 本來就有這個資料）'],risk:'NI 的說明特別提到：類別版本來就支援旋轉。'}
  ];
  el.innerHTML=`<label>情況 <select data-k="c">${CH.map((c,i)=>`<option value="${i}">${c.t}</option>`).join('')}</select></label><div data-o="out" style="margin-top:8px"></div>`;
  function draw(){
    const c=CH[+el.querySelector('[data-k=c]').value];
    el.querySelector('[data-o=out]').innerHTML=`<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px">
     <div><b>Case 版（Task Design）要改</b><ol style="margin:4px 0;padding-left:20px">${c.task.map(x=>`<li>${x}</li>`).join('')}</ol></div>
     <div><b>類別版（Object Design）要改</b><ol style="margin:4px 0;padding-left:20px">${c.obj.map(x=>`<li>${x}</li>`).join('')}</ol></div></div>
     <p style="margin:6px 0 0;color:#7a5b00">${c.risk}</p>`;
  }
  el.querySelector('select').onchange=draw;draw();
}

/* ---- 一步一步寫：Check Image Matches Design.vi（簡化：拿掉 NI 原本外圍的錯誤 Case） ---- */
const cm={name:'Check Image Matches Design.vi',view:'split',ratio:1.7,
 fp:{w:330,h:200,items:[
  {id:'b',k:'enum',ctl:true,label:'線上跑的物件（模擬用）',options:Object.keys(BOARDS),x:12,y:8,v:0},
  {id:'bad',k:'enum',ctl:true,label:'這一片（模擬用）',options:['焊得好好的','有一顆 A/D 沒焊上'],x:12,y:66,v:0},
  {id:'pass',k:'led',label:'pass?',color:'green',x:12,y:128}]},
 bd:{w:900,h:300,structs:[{id:'fl',k:'for',x:330,y:70,w:250,h:150}],
  nodes:[
  {id:'bin',k:'ctl',t:'objB',label:'board in',x:10,y:30},
  {id:'img',k:'ctl',t:'pic',label:'board image',x:10,y:200},
  {id:'gc',k:'sub',name:'Get Components.vi（動態）',top:'BOARD',icon:['▦▦','→[ ]'],color:'#2f7d3a',ins:['board in'],outs:['board out','components'],x:140,y:30,w:56,h:56},
  {id:'ti',k:'tunnel',t:'obj[]',s:'fl',side:'l',y:110,idx:true},
  {id:'tim',k:'tunnel',t:'pic',s:'fl',side:'l',y:180},
  {id:'st',k:'sub',name:'Self Test.vi（動態）',top:'COMP',icon:['✓?'],color:'#a33b3b',ins:['Component in','Board Image'],outs:['Component out','Pass?'],x:420,y:100,w:56,h:56},
  {id:'to',k:'tunnel',t:'bool[]',s:'fl',side:'r',y:140,idx:true},
  {id:'aae',k:'fn',fn:'And Array Elements',x:650,y:126},
  {id:'pass',k:'ind',t:'bool',label:'pass?',x:760,y:130},
  {id:'bout',k:'ind',t:'objB',label:'board out',x:760,y:40}],
  wires:[
  {id:'w1',from:'bin',to:'gc.board in',t:'objB'},
  {id:'w2',from:'gc.components',to:'ti.o',t:'obj[]',mx:260},
  {id:'w3',from:'ti.i',to:'st.Component in',t:'obj'},
  {id:'w4',from:'img',to:'tim.o',t:'pic'},
  {id:'w5',from:'tim.i',to:'st.Board Image',t:'pic',mx:390},
  {id:'w6',from:'st.Pass?',to:'to.i',t:'bool'},
  {id:'w7',from:'to.o',to:'aae.x',t:'bool[]'},
  {id:'w8',from:'aae.out',to:'pass',t:'bool'},
  {id:'w9',from:'gc.board out',to:'bout',t:'objB',mx:700}]},
 sim:{init:()=>({}),
  step(inp){
   const b=Object.keys(BOARDS)[+inp.b||0],B=BOARDS[b],bad=+inp.bad===1;
   const kinds=PARTS.concat(B.extra?[B.extra]:[]),pass=!bad;
   return {out:{pass},
    vals:{'gc.components':kinds.length+' 種零件','st.Pass?':bad?'有一個 F':'全部 T','aae.out':pass},
    msg:`線的型別是 Board Design，線上跑的是 ${B.cls}：Get Components 執行 ${B.gc} 的版本，回來的陣列裡有 ${kinds.join('、')}（同一種零件可能不只一顆，例如電阻）。For Loop 每圈拿一顆，Self Test 依那一顆的類別各跑各的。`+(bad?'A/D 那一圈回 F，所以 pass? = F。':'')};},
  doneMsg:'換一種板子再 Run'}
};

L.push({id:'H1',order:40,no:'H1',part:PART,title:'接手物件導向的測試程式：看懂類別和動態分派，再改一個零件',mins:80,files:[],
goals:[['學會','打開一支用 LabVIEW 類別寫的程式時，先看哪裡：類別階層、線的型別和線上真正的物件、動態分派的 SubVI 實際會跑哪一個、Call Parent Method；比較 Case 寫法和類別寫法在「改需求」時差在哪；照步驟加一個子類別'],
 ['工作上','職缺寫「理解並修改用 LabVIEW 物件導向架構的軟體」，就是這一課：程式不是你寫的，你要在不弄壞別人已驗證部分的情況下加功能'],
 ['用到','W8 接手舊程式的做法（先跑、先存一份、一次改一件事）；A 系列的 QMH 和 SubVI']],
check:'不看課文，能說出：線的型別和線上物件的差別；雙擊動態分派的 SubVI 時要選哪一個實作；Call Parent Method 做什麼；為什麼「多一種板子」在類別版只要動一個 Case。',
body:[
C.h3('這一課的工作','x','你接手的是別人的類別'),
`<p>你剛進一家做 AOI 和自動化設備的公司。前一位工程師留下一支板子外觀檢查程式，主管說：「下個月多一種板子，你加進去。舊的三種板子已經在產線跑了，不要弄壞。」打開專案，你看到一堆 <code>.lvclass</code>，線是粗的、有花紋的，雙擊 SubVI 跳出來的視窗跟你平常看到的不一樣。</p>
<p>這一課的程式不是 LadderLab 自己編的：它是 <b>LabVIEW 內附的 NI 範例</b>「Board Testing」。NI 用同一個需求寫了兩個版本：一個用 Case 結構（Task Design），一個用類別（Object Design），範例的說明就是在比較「之後要改的時候」哪一個好改。你的電腦上就有，可以直接打開對照。</p>`,
note('為什麼有這一課（資料來源）','竹北一家精密設備廠的 LabVIEW 職缺，條件寫著「能理解並修改由 LabVIEW 物件導向程式架構的軟體」（104 搜尋摘要）。PTT 上一位一個月面試 17 家 LabVIEW 職缺的人說，用人主管幾乎都問程式架構和維護。資深職缺多出來的要求是「架構與模組設計」。整理在 docs/research_advanced.md。'),
C.h3('① 先拿到程式、先跑','','動手前'),
`<ol><li>LabVIEW 選 <b>Help ▸ Find Examples</b>，Search 分頁打 <code>Board Testing</code>，打開「Board Testing - Benefits of Object-Oriented Design.lvproj」。也可以直接到 <code>C:\\Program Files\\National Instruments\\LabVIEW 20xx\\examples\\Object-Oriented Programming\\Board Testing</code>。</li>
<li><b>先把整個資料夾複製到自己的工作資料夾</b>，打開複製的那一份。接手別人的程式也一樣：先留一份原封不動的（W8）。</li>
<li>先跑 <code>Task Design\\Test Boards_TASK.vi</code>，再跑 <code>Object Design\\Test Boards_OBJECT.vi</code>。兩支都會自己停。</li></ol>`,
tip('LadderLab 實測（LabVIEW 2026，複製後執行）','兩支都輸出 150 筆結果，三種板子各 50 片。每片有 25 % 的機會被換成「壞的」圖（Assembly Line Image Generator.vi 裡的 success rate 0.75），所以每次 PASS 的數量都不一樣。測試名稱不一樣：Case 版最後一筆是「Elite DAQ Board - 149」，類別版是「GPIB Board - 49」。'),
ask('為什麼兩個版本的測試名稱編號不一樣？',`<p>Case 版用一個共用的 Get ID Number.vi，三種板子一起編號，所以到 149。類別版的 Get Test Name.vi 呼叫 <code>Get Unique Test ID</code>，而每一種板子的類別都覆寫了它，各有自己的計數器，所以每種板子都是 0～49。</p><p>接手時這種差異很重要：如果品保的報表或資料庫（W9）靠測試名稱查資料，改寫法會改到編號規則。<b>改架構之前，先列出外面看得到的行為</b>（輸出格式、檔名、編號），改完逐項比對。</p>`),
C.h3('② 看懂類別','','先看地圖，不要先看方塊圖'),
{fn:treeFig},
`<p>幾個名詞，用這個範例說：</p>
<ul><li><b>類別（.lvclass）</b>：一種資料加上一組只處理這種資料的 VI。Component 的資料是「列、行、橫放？」，放在類別的 private data 裡（它存在 .lvclass 檔裡面，不是另一個檔案）。</li>
<li><b>只有類別自己的 VI 能讀寫它的資料</b>。外面的 VI 要讀，只能呼叫類別提供的 VI（例如 <code>Get Row and Column.vi</code>）。所以你接手時，<b>資料怎麼被改的，只要看這個類別的 VI</b>，不用全專案搜尋。</li>
<li><b>繼承</b>：Resistor 繼承 Component，自動有 Component 的資料和 VI；它只要寫自己不一樣的部分（Self Test）。</li>
<li><b>線的型別 vs 線上的物件</b>：一條 Board Design 型別的線，上面可以跑 Board Design 或它任何一個子類別的物件。線的顏色是型別的，不會因為線上跑的是哪一個子類別而變。</li></ul>`,
ask('Board Design 的 Get Components.vi 和 Component 的 Self Test.vi 打開來幾乎是空的（一個回空陣列，一個永遠回 F），這是寫錯了嗎？',`<p>不是。它們是給子類別<b>覆寫</b>用的「位置」：父類別先規定「每一種板子都要能回答有哪些零件」「每一種零件都要能自我檢查」，連接器長什麼樣子；真正的內容在子類別。NI 在方塊圖上的註解也是這樣寫的。</p><p>接手時看到空的父類別 VI，不要去改它，要去找子類別的版本。</p>`),
C.h3('③ 動態分派：同一個 SubVI，跑的不是同一個 VI','','這是最容易看錯的地方'),
`<p>Check Image Matches Design.vi 的方塊圖上只有一個 <code>Self Test.vi</code>。但它是<b>動態分派</b>的：執行時看線上的物件是哪一個類別，就跑那個類別的 Self Test.vi。選一種板子看看：</p>`,
{fn:dispatchFig},
ask('你在 Check Image Matches Design.vi 上雙擊 Self Test.vi，想看它怎麼檢查 A/D。會打開哪一個？',`<p>方塊圖上的 SubVI 不知道執行時會是哪一個類別，所以雙擊動態分派的 SubVI 時，LabVIEW 會列出所有實作（Component、AD Converter、DA Converter…）讓你選。要看 A/D 的檢查，選 AD Converter 那一個。</p><p>直接打開 <code>Component\\Self Test.vi</code> 看到「永遠回 F」就以為程式壞了，是接手時最常見的誤判。</p>`),
`<p>動態分派的 VI，連接器上的類別輸入和輸出是「動態分派」端子（在連接器的端子上按右鍵 ▸ This Connection Is ▸ Dynamic Dispatch Input／Output）。所有覆寫的版本，連接器要一模一樣，名稱也要一樣。</p>`,
{steps:{title:'Check Image Matches Design.vi：拿零件、每個零件自己檢查、全部 OK 才 PASS',lv:cm,steps:[
 {t:'拿到零件清單',view:'split',add:['b','bin','gc','w1','bout','w9'],h:`<p>放 board in（Board Design 類別的控制項）和 Get Components.vi。它是 Board Design 的成員 VI，動態分派：線上是 Elite 就跑 Elite 的版本。board out 原樣傳出（類別的 VI 習慣一進一出，和 error 一樣）。</p>`},
 {t:'每個零件跑一次 Self Test',view:'split',add:['fl','ti','w2','img','tim','w4','st','w3','w5'],h:`<p>components 是 Component 陣列，接進 For Loop 自動索引：每一圈拿一個零件。Self Test.vi 是 Component 的動態分派 VI：這一圈的零件是 Resistor，就跑 Resistor 的版本。board image 不索引，每一圈都是同一張圖。</p>`},
 {t:'全部 T 才 PASS',view:'split',add:['to','w6','aae','w7','pass','w8'],h:`<p>每一圈的 Pass? 從右邊的索引通道出來變成布林陣列，And Array Elements 全部 T 才是 T。</p><p>這個 VI 裡<b>沒有任何一個 Case 在判斷板子或零件的種類</b>。新的零件類別只要有自己的 Self Test，這個 VI 一行都不用改。</p>`},
 {t:'Run',view:'split',add:['bad'],h:`<p>三種板子各 Run 一次，看訊息裡 Get Components 跑的是哪一個版本、回來哪幾種零件；再選「有一顆 A/D 沒焊上」。NI 原本的 VI 外面還包了一個錯誤 Case（有錯誤就不檢查），這裡為了看清楚先拿掉。</p>`}
]}},
C.h3('④ Call Parent Method：先做父類別的，再加自己的','',''),
`<p>Elite 板＝Basic 板再加一顆濾波器。Elite DAQ Design 的 Get Components.vi 沒有把四種零件重寫一次，而是：</p>
<ol><li>用 <b>Call Parent Method</b>（${fn('Programming','Cluster, Class & Variant','Call Parent Method')}）呼叫父類別 DAQ Board Design 的 Get Components，拿到原本的零件；</li>
<li>再建一個 Magic Signal Filter 物件，用 Component 的 Initialize.vi 設成第 4 列第 3 行、不橫放，加到陣列最後。</li></ol>
<p>好處：DAQ 板的零件改了（例如換位置），Elite 自動跟著改。</p>`,
ask('這幾個 Get Components.vi 都把 For Loop 設成跑 1 次，外面接一個沒有初始值的 Shift Register，裡面一個 First Call? 選 Case。為什麼？',`<p>只有第一次呼叫時建零件清單，存在沒有初始化的 Shift Register 裡；之後每次呼叫直接回傳存好的清單（NI 的註解也這樣寫）。產線一直跑，每片板子都要叫一次，不用每次重建。</p><p>接手時要知道：這種 VI <b>有記憶</b>。除錯時在 True 頁裡放中斷點或 Probe，一次執行只會停一次（第一片板子），之後的板子都不會進去；要看清單怎麼建的，就看第一次呼叫。按 Run 重新執行時，First Call? 會再回 T，清單重建一次。</p>`),
C.h3('⑤ 改需求：兩種寫法各要動哪裡','','NI 範例自己出的題目'),
`<p>NI 在範例說明裡出了「零件廠商改了一顆零件的外觀」「多一種新板子」「一顆零件改成橫放」三個情況。選一個看看兩個版本各要改哪裡：</p>`,
{fn:changeFig},
ask('既然類別版這麼好改，為什麼不是每支程式都用類別寫？',`<p>NI 的說明也講了代價：類別版的 VI 多很多、每個都很小；第一版寫起來比較慢，對沒學過的人比較難讀。好處在<b>第二版、第三版</b>（需求一直改）才看得出來。</p><p>工作上的判斷：一次性的小工具、只有一種產品的測試，用 Case 和 SubVI 就好；產品種類多、會一直加、要很多人維護多年的程式（例如多種儀器、多種產品的測試平台），類別才划算。接手時兩種都會遇到，兩種都要看得懂。</p>`),
C.h3('⑥ 動手：加一種新板子 DAQ Pro','','在你複製的那一份上做'),
`<p>需求：DAQ Pro ＝ Elite 再加一顆 FPGA（自己決定位置，例如第 2 列第 5 行，要和其他零件不重疊）。照下面的順序做，每做一步就跑一次 Test Boards_OBJECT.vi，確認原本三種板子的結果沒變。</p>
<ol><li>專案視窗在 Object Design 的資料夾上按右鍵 ▸ <b>New ▸ Class</b>，命名 DAQ Pro Design，存在自己的資料夾。</li>
<li>新類別按右鍵 ▸ <b>Properties ▸ Inheritance ▸ Change Inheritance</b>，選 Elite DAQ Design。</li>
<li>新類別按右鍵 ▸ <b>New ▸ VI for Override</b>，選 Get Components.vi。LabVIEW 會產生一個已經放好 Call Parent Method 的 VI：在它後面加一顆 FPGA Chip（照 Elite 的寫法用 Initialize.vi 設位置），Build Array 加到陣列最後。</li>
<li>同樣覆寫 Get Class Name.vi（回傳你的名稱）和 Get Unique Test ID.vi（照 Basic DAQ Design 的做法，給它自己的計數器）。</li>
<li>Board Type Enum.ctl 加一項 DAQ Pro Board；Enum to Board Design.vi 加一頁，放 DAQ Pro Design 的類別常數。</li>
<li>模擬影像：Generate Test Images.vi 裡照其他三種板子的樣子，加一組 DAQ Pro 的圖（Elite 的圖加一個 FPGA 顏色的方塊）。</li></ol>`,
warn('這一段 LadderLab 沒有實測','前面的執行結果和類別繼承都是在 LabVIEW 2026 實際開啟、執行過的；但「建立新類別、覆寫」無法用我們的自動化工具操作，所以第 ⑥ 段的步驟是照 NI 的說明寫的。選單名稱若和你的 LabVIEW 版本不同，以你的版本為準，並請回報給我們。'),
ask('做完之後，Check Image Matches Design.vi 和主程式的迴圈你改了幾行？要怎麼證明舊的三種板子沒有被你弄壞？',`<p>應該是 0 行：你只新增了類別、在 Enum 和選類別的 Case 加了一項、加了一組模擬影像。</p><p>證明的方法是 W8 的回歸：改之前先跑一次，記下三種板子各自的結果；但這個範例每次的壞板是隨機的，結果每次都不一樣，<b>不能直接比</b>。要比，得先讓輸入固定（例如把 success rate 暫時改成 1，或固定亂數），這就是之後「單元測試」那一課要處理的問題。</p>`),
C.h3('⑦ 接手類別程式的檢查清單','','打開專案後的前 30 分鐘'),
C.table(['順序','做什麼','為什麼'],[
 ['1','複製整個專案，打開複製的那一份；先跑一次，記下輸出','改壞時有東西可以比（W8）'],
 ['2','View ▸ Class Hierarchy 看類別樹；記下哪些是「只給子類別覆寫」的父類別','看到空的父類別 VI 不會誤判'],
 ['3','從主程式往下找：唯一選類別的地方在哪（這個範例是 Enum to Board Design.vi）','新增一種產品時，通常就是改這裡加一個新類別'],
 ['4','雙擊動態分派的 SubVI 時，選你要看的那個實作','不要看錯版本'],
 ['5','看有沒有 Call Parent Method、有沒有不初始化的 Shift Register','知道哪些 VI 會疊加父類別的行為、哪些有記憶'],
 ['6','列出外面看得到的行為：輸出格式、測試名稱、編號規則、檔名','改完逐項比對（測試名稱的編號就是例子）'],
 ['7','只在新的類別裡加功能；已驗證的類別和共用 VI 不動','產線上跑的部分不會被你弄壞']
]),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'一條 Board Design 型別的線上，可以跑哪些物件？',o:['Board Design 和它所有子類別的物件','只有 Board Design','只有 GPIB Board Design','任何類別'],a:0,ex:'線的型別是父類別，上面可以跑任何子類別的物件。'},
 {q:'Component 的 Self Test.vi 永遠回 F，代表？',o:['它是給子類別覆寫的，真正的檢查在子類別裡','程式寫錯了','零件都壞了','要把它刪掉'],a:0,ex:'父類別規定介面，內容在子類別。'},
 {q:'Elite DAQ Design 的 Get Components.vi 裡，Call Parent Method 做什麼？',o:['執行父類別 DAQ Board Design 的 Get Components，拿到原本的零件','呼叫 Board Design 的建構子','結束程式','把物件轉成父類別'],a:0,ex:'先做父類別的，再加自己的濾波器。'},
 {q:'在方塊圖上雙擊一個動態分派的 SubVI，會？',o:['列出所有實作讓你選','一定打開父類別的版本','一定打開最後一個子類別的版本','打不開'],a:0,ex:'方塊圖不知道執行時會是哪一個類別。'},
 {q:'類別的 private data 可以被誰直接讀寫？',o:['只有這個類別自己的成員 VI','專案裡任何 VI','只有主程式','子類別的 VI 可以直接讀寫父類別的資料'],a:0,ex:'子類別也要透過父類別提供的 VI（例如 Get Row and Column.vi）。'},
 {q:'在類別版要多一種新板子，主程式迴圈要改？',o:['不用改；新增子類別，選類別的 Case 加一項','每個 SubVI 都要改','Check Image Matches Design.vi 加一個 Case','重寫整支程式'],a:0,ex:'唯一要動的 Case 是選類別的地方（Enum to Board Design.vi）。'},
 {q:'兩個版本的測試名稱編號不一樣，接手時這代表什麼？',o:['改寫法可能改到外面看得到的行為，要先列出來、改完比對','沒關係','LabVIEW 的錯誤','類別版比較正確'],a:0,ex:'報表、資料庫可能靠這些名稱查資料。'},
 {q:'Get Components.vi 用沒有初始化的 Shift Register 存零件清單，在 True 頁放中斷點會？',o:['一次執行只停一次（第一次呼叫），之後直接回傳存好的清單','每片板子都停','永遠不會停','程式會出錯'],a:0,ex:'這種 VI 有記憶；重新按 Run 時 First Call? 再回 T。'}
]}
]});
})();
