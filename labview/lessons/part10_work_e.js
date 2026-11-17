/* 實務案例 W8：接手舊程式。前一位工程師離職，留下一支能跑但很亂的測試程式，要加一個測項而且不能弄壞原本的功能。
   職缺對照（docs/job_research.md 第 F 組）：依產線需求維護及修改 LabVIEW 程式（Y01）、測試腳本修改除錯（Y02）。
   重點：先留基準（改之前的行為）、版本控制、一次改一件事、回歸測試、看不懂的東西先別刪。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

/* ---- 舊程式的方塊圖（只看，不動） ---- */
const old={name:'PM5_Test_final_v3_new.vi（舊程式）',view:'bd',
 bd:{w:900,h:300,structs:[{id:'sq',k:'case',x:20,y:20,w:860,h:260,frames:['0 [0..5]','1 [0..5]','2 [0..5]','3 [0..5]','4 [0..5]','5 [0..5]'],cur:2}],
  nodes:[
  {id:'dmm',k:'sub',name:'Read DMM.vi',icon:['DMM'],ins:[],outs:['reading','error out'],x:60,y:60,w:60,h:44,color:'#6a3fb5'},
  {id:'ec',k:'sub',name:'Case：error 頁什麼都沒接',icon:['err?','空白'],ins:['error'],outs:[],x:180,y:110,w:70,h:44,color:'#b03a2e',tip:'error 是 True 時走空白頁：讀值沒有寫進 Vout，Vout 還是上一片的值'},
  {id:'vout',k:'ind',t:'dbl',label:'Vout',x:300,y:60},
  {id:'lv',k:'ctl',t:'dbl',label:'Vout（區域變數）',x:420,y:160},
  {id:'k1',k:'const',t:'dbl',v:5.15,x:420,y:200,label:'上限（寫死）'},
  {id:'k2',k:'const',t:'dbl',v:4.85,x:420,y:236,label:'下限（寫死）'},
  {id:'irc',k:'fn',fn:'In Range and Coerce',x:560,y:180},
  {id:'res',k:'ind',t:'bool',label:'T03 PASS',x:660,y:196},
  {id:'kw',k:'const',t:'i32',v:3000,x:60,y:200,label:'？？？'},
  {id:'wt',k:'fn',fn:'Wait (ms)',x:140,y:194}],
  wires:[
  {id:'a1',from:'dmm.reading',to:'vout',t:'dbl'},
  {id:'a2',from:'dmm.error out',to:'ec.error',t:'err',mx:150},
  {id:'a3',from:'k1',to:'irc.upper limit',t:'dbl',mx:540},
  {id:'a4',from:'lv',to:'irc.x',t:'dbl',mx:545},
  {id:'a5',from:'k2',to:'irc.lower limit',t:'dbl',mx:550},
  {id:'a6',from:'irc.In Range?',to:'res',t:'bool'},
  {id:'a7',from:'kw',to:'wt',t:'i32'}]}
};

/* ---- 圖：回歸測試 ---- */
const BOARDS=[
 {id:'B1',name:'良品',base:'PASS'},
 {id:'B2',name:'良品（負載切換後回穩比較慢）',base:'PASS'},
 {id:'B3',name:'無載電壓偏低',base:'FAIL T02'},
 {id:'B4',name:'滿載 5.12 V',base:'PASS'},
 {id:'B5',name:'良品，但 DMM 線鬆了',base:'PASS'}
];
const CHG=[
 {k:'A',t:'上下限搬到 limits 表，數字照規格書'},
 {k:'B',t:'DMM 讀取錯誤時判 ERROR（不用上一片的值）'},
 {k:'C',t:'加新測項 T06 輸出漣波（≤ 50 mV）'},
 {k:'D',t:'「順手」刪掉看不懂的 Wait 3000 ms，每片快 3 秒'},
 {k:'E',t:'Stacked Sequence 改成狀態機（行為不變）'}
];
function regress(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<p style="margin:0 0 6px"><b>勾選要套用的修改，按「跑回歸測試」：5 片已知的板子，和改之前的結果比。</b></p>
  <div data-o="chk" style="font-size:13px;line-height:1.9"></div>
  <p><button type="button" class="btn" data-k="go">跑回歸測試</button></p>
  <table class="tbl" style="width:100%;font-size:13px" data-o="tb"></table>
  <div data-o="ex" style="font-size:13px;margin-top:8px"></div>`;
  const o=k=>el.querySelector('[data-o='+k+']');
  o('chk').innerHTML=CHG.map(c=>`<label style="display:block"><input type="checkbox" data-c="${c.k}"> ${c.k}　${c.t}</label>`).join('');
  function result(b,on){
    if(b.id==='B5'&&on.B) return 'ERROR（DMM）';
    if(b.id==='B2'&&on.D) return 'FAIL T03';
    if(b.id==='B4'&&on.A) return 'FAIL T03';
    return b.base;
  }
  const WHY={
   B4:'<b>B4 從 PASS 變 FAIL（改 A 造成）</b>：舊程式 T03 的上限寫成 5.15，規格書是 5.10。（正常的 PM5 加上負載時輸出會略降，滿載約 4.97 V；滿載 5.12 V 反而比無載還高，是回授電路有問題的板子。）這不是你改壞，是<b>舊程式本來就錯</b>，而且已經出貨的板子可能有問題。不要自己決定：寫下來，交給主管和品保決定要不要改、出貨的要不要追。',
   B5:'<b>B5 從 PASS 變 ERROR（改 B 造成）</b>：這是你想要的改變。舊程式在 DMM 讀不到時沿用上一片的值，壞的接線也會 PASS。這個差異要寫進變更說明，讓大家知道行為變了。',
   B2:'<b>B2 從 PASS 變 FAIL（改 D 造成）</b>：這是改壞了。那個 Wait 3000 ms 放在量 T03 那一格，是在等負載切到 2 A 之後輸出回穩。這片板子回穩比較慢，少等 3 秒就量到還在往下掉的電壓。（W6 規格寫穩定 0.4 秒，是 RD 給的典型值；實測有板子比較慢，這件事也要回報 RD。）看不懂的東西不要「順手」刪：先問、先量，懂了就寫上註解，例如「負載切換後等回穩：B2 類實測 1.2 秒，留餘裕 3 秒」。'};
  el.querySelector('[data-k=go]').onclick=()=>{
    const on={};el.querySelectorAll('[data-c]').forEach(c=>on[c.dataset.c]=c.checked);
    const rows=BOARDS.map(b=>{const r=result(b,on);return {b,r,diff:r!==b.base};});
    const t06=on.C;
    o('tb').innerHTML=`<tr><th>板子</th><th>改之前（基準）</th><th>改之後</th>${t06?'<th>T06 漣波</th>':''}<th>一樣嗎？</th></tr>`+rows.map(x=>`<tr><td>${x.b.id} ${x.b.name}</td><td>${x.b.base}</td><td>${x.r}</td>${t06?`<td>${x.b.id==='B5'&&on.B?'－':({B1:12,B2:15,B3:14,B4:11,B5:13}[x.b.id])+' mV'}</td>`:''}<td style="font-weight:700;color:${x.diff?'#c0392b':'#1e7b34'}">${x.diff?'不一樣':'一樣'}</td></tr>`).join('');
    const ex=rows.filter(x=>x.diff).map(x=>`<p>${WHY[x.b.id]}</p>`);
    const n=Object.values(on).filter(Boolean).length;
    let s=ex.join('');
    if(!n) s='<p>什麼都沒改，結果和基準完全一樣：回歸測試本身是好的（同一片量兩次結果一樣）。這一步也要做。</p>';
    else if(!ex.length) s='<p>勾選的修改都沒有改變原本 5 片的結果'+(on.C?'；T06 是新加的欄位，原本的判定不受影響':'')+(on.E?'；E 把架構換掉但行為不變，這是重構最理想的結果':'')+'。</p>';
    if(on.B&&on.C) s+='<p style="color:#556">B5 的 T06 是「－」：勾了 B 之後 DMM 錯誤會讓整片停在 ERROR，後面的測項不量。</p>';
    if(n>1) s+='<p style="color:#556">一次勾很多項時，出現差異就很難知道是哪一項造成的。實際工作上<b>一次只改一件事</b>：改一項 → 跑回歸 → 提交（commit）→ 再改下一項。</p>';
    o('ex').innerHTML=s;
  };
}

/* ---- 一步一步寫：讀不到就是 ERROR ---- */
const fixv={name:'T03_Judge.vi（修改後）',view:'split',ratio:2.2,
 fp:{w:330,h:230,items:[
  {id:'cut',k:'btn',style:'toggle',mech:'switch',label:'DMM 線鬆了（模擬）',x:12,y:8,v:false},
  {id:'tv',k:'num',ctl:true,label:'板子真正的輸出 V（模擬）',x:150,y:8,w:70,v:4.97,inc:0.05,dig:2},
  {id:'pv',k:'num',ctl:true,label:'上一片的讀值（模擬）',x:150,y:62,w:70,v:5.00,inc:0.05,dig:2},
  {id:'rd',k:'num',label:'這一片讀到',x:12,y:118,w:70,dig:3},
  {id:'old',k:'str',label:'舊程式會判',x:110,y:118,w:90},
  {id:'res',k:'str',label:'修改後判',x:220,y:118,w:90}]},
 bd:{w:640,h:220,nodes:[
  {id:'dmm',k:'sub',name:'Read DMM.vi',icon:['DMM'],ins:[],outs:['reading','error out'],x:20,y:40,w:70,h:44,color:'#6a3fb5'},
  {id:'ub',k:'fn',fn:'Unbundle By Name',outs:['status'],x:140,y:80},
  {id:'knan',k:'const',t:'dbl',v:'NaN',x:140,y:20},
  {id:'sel1',k:'fn',fn:'Select',x:230,y:30},
  {id:'khi',k:'const',t:'dbl',v:5.1,x:262,y:100},
  {id:'klo',k:'const',t:'dbl',v:4.85,x:262,y:150},
  {id:'irc',k:'fn',fn:'In Range and Coerce',x:320,y:40},
  {id:'kP',k:'const',t:'str',v:'PASS',x:374,y:8},
  {id:'kF',k:'const',t:'str',v:'FAIL',x:362,y:100},
  {id:'sel2',k:'fn',fn:'Select',x:420,y:40},
  {id:'kE',k:'const',t:'str',v:'ERROR',x:430,y:150},
  {id:'sel3',k:'fn',fn:'Select',x:500,y:60},
  {id:'res',k:'ind',t:'str',label:'結果',x:570,y:66}],
  wires:[
  {id:'f1',from:'dmm.error out',to:'ub',t:'err',mx:120},
  {id:'f2',from:'knan',to:'sel1.t',t:'dbl',mx:215},
  {id:'f3',from:'ub.status',to:'sel1.s',t:'bool',mx:215},
  {id:'f4',from:'dmm.reading',to:'sel1.f',t:'dbl'},
  {id:'f5',from:'sel1.out',to:'irc.x',t:'dbl',mx:300},
  {id:'f6',from:'khi',to:'irc.upper limit',t:'dbl',mx:306},
  {id:'f7',from:'klo',to:'irc.lower limit',t:'dbl',mx:312},
  {id:'f8',from:'kP',to:'sel2.t',t:'str',mx:410},
  {id:'f9',from:'irc.In Range?',to:'sel2.s',t:'bool',mx:400},
  {id:'f10',from:'kF',to:'sel2.f',t:'str',mx:412},
  {id:'f11',from:'sel2.out',to:'sel3.f',t:'str',mx:480},
  {id:'f12',from:'kE',to:'sel3.t',t:'str',mx:488},
  {id:'f13',from:'ub.status',to:'sel3.s',t:'bool',pts:[[215,96],[215,134],[470,134],[470,76],[500,76]]},
  {id:'f14',from:'sel3.out',to:'res',t:'str'}]},
 sim:{live:true,init:()=>({}),
  step(inp){
   const cut=!!inp.cut,tv=+inp.tv||0,pv=+inp.pv||0,rd=cut?0:tv;
   const j=v=>v>=4.85&&v<=5.1?'PASS':'FAIL';
   const old=cut?j(pv):j(tv),x=cut?NaN:rd,inr=!cut&&x>=4.85&&x<=5.1,res=cut?'ERROR':(inr?'PASS':'FAIL');
   return {out:{rd,old,res},
    vals:{'dmm.reading':rd,'ub.status':cut,knan:'NaN','sel1.out':cut?'NaN':rd.toFixed(3),khi:5.1,klo:4.85,'irc.In Range?':inr,kP:'PASS',kF:'FAIL','sel2.out':inr?'PASS':'FAIL',kE:'ERROR','sel3.out':res},
    msg:cut?'讀取失敗：舊程式用上一片的 '+pv.toFixed(2)+' V 判成 '+old+'；修改後判 ERROR':'讀到 '+rd.toFixed(2)+' V → '+res};},
  doneMsg:'改前面板的值，結果會跟著變'}
};

L.push({id:'W08',order:30.988,no:'W8',part:PART,title:'接手舊程式：前一位工程師離職了，加一個測項，而且不能把原本的功能弄壞',mins:75,files:['練習\\實務\\Legacy\\（舊程式和你的修改）'],
goals:[['學會','動手改之前先留基準（用已知的板子跑一次，記下結果）；先放進版本控制；看懂別人的程式的順序；舊程式常見的問題：上下限寫死、區域變數傳資料、錯誤被吞掉、看不懂的 Wait；一次改一件事、每改一次跑回歸測試；分辨「改壞了」和「舊程式本來就錯」；變更說明要寫什麼。'],['做出','在回歸測試台上找出哪一個修改改壞了東西；T03_Judge.vi（讀不到就判 ERROR）；一份變更說明。'],['為什麼是這個題目','職缺常寫「維護及修改既有 LabVIEW 程式」「測試腳本修改、除錯」，有時放在工作內容的第一條。上班第一個月，你改別人程式的時間，通常比寫新程式還多。']],
check:'不看課文，能說出接手舊程式時「動手改之前」要做的三件事、回歸測試出現差異時怎麼判斷是不是你改壞的，以及為什麼看不懂的 Wait 不能直接刪。',
body:[
C.h3('① 聽懂需求','','主管的原話'),
`<p>時間線：W6 那個新的測試站，是公司下一代的寫法，還在試產線上驗證；正式產線上一直在跑的，是前一位工程師小陳寫的舊版。這一課處理的就是這支舊版。</p>`,
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「PM5 測試站的程式是小陳寫的，他上個月離職了。客戶要求加測輸出漣波，你加一個測項進去。產線不能停，下週一換線時上新版。程式在測試站電腦的桌面上。」</p></div>`,
ask('動手之前要問（或自己查）哪些事？',
 `<ol><li><b>哪一份才是現在在跑的？</b>桌面上常常有 <code>PM5_Test.vi</code>、<code>PM5_Test_final.vi</code>、<code>PM5_Test_final_v3_new.vi</code>。看測試站實際開的是哪一個（開著的視窗、捷徑、執行檔的建置日期）。</li>
 <li><b>LabVIEW 版本？</b>測試站裝的是 2018，你的電腦是新版的話，存檔後 2018 就打不開了。用同一版，或 File ▸ Save for Previous Version。</li>
 <li><b>新測項的規格？</b>漣波怎麼量（示波器？頻寬限制 20 MHz？）、上限多少、在哪個負載條件下量。跟 W6 一樣要寫成測試項目表。</li>
 <li><b>有沒有可以拿來測的板子？</b>要幾片已知結果的板子（好的、各種壞的），用來比對改前改後。</li>
 <li><b>在哪裡測？</b>產線不能停：借一台備用的測試站，或下班時間。</li></ol>`),
C.h3('② 改之前：先留基準','','這一步最常被跳過'),
`<p>還沒看懂程式、還沒改任何東西之前，先做三件事：</p>
<ol><li><b>整份複製出來，放進版本控制</b>（git 或至少一個有日期的壓縮檔）。第一次提交寫「接手時原封不動」。之後改壞了，隨時可以回到這裡。</li>
<li><b>用已知的板子跑一次，把結果記下來</b>：5 片板子，每一片的每一項量測值和判定、花了幾秒。這就是<b>基準</b>：之後每改一次，都拿同樣的 5 片再跑，和基準比。</li>
<li><b>寫下你看到的行為</b>：畫面長什麼樣子、FAIL 時會不會繼續測、檔案存到哪裡。</li></ol>`,
ask('基準跑出來，B5（DMM 線鬆了）竟然是 PASS。要現在就修嗎？',
 `<p>先<b>記下來、回報</b>，不要默默修掉。這代表產線上可能已經有「沒量到就 PASS」的板子出貨了，是品質事件，主管和品保要知道。修不修、什麼時候上線、要不要追已出貨的，是他們決定。</p>
 <p>修的時候也要當成<b>獨立的一件修改</b>，跟「加 T06」分開提交、分開說明。混在一起，之後出問題時分不清是哪一個造成的。</p>`),
C.h3('③ 盤點：看懂別人的程式','','順序很重要'),
C.table(['順序','做什麼','LabVIEW 裡怎麼做'],[
 ['1','先跑起來看，不要先看方塊圖','用一片好板子跑一次，看畫面怎麼動'],
 ['2','看有哪些 VI、誰呼叫誰','View ▸ VI Hierarchy'],
 ['3','從前面板找到方塊圖','前面板的元件按兩下，方塊圖會跳到它的端子'],
 ['4','看資料怎麼流','Highlight Execution、Probe（第 2 課教過）'],
 ['5','找出所有「寫死」的數字和區域變數','Ctrl+F 搜尋 Local Variable；一個一個看常數'],
 ['6','把看懂的流程畫成一張圖','紙筆就好：每一格 Sequence 在做什麼']
]),
`<p>下面是舊程式 Sequence 第 2 格（量 T03）的樣子。先自己找找看有什麼問題：</p>`,
{lv:old,cap:'舊程式的一格：DMM 讀值寫進 Vout，另一格用 Vout 的區域變數判定。'},
ask('這一格至少有四個問題，你找到幾個？',
 `<ol><li><b>錯誤被吞掉</b>：DMM 的 error 接到 Case，但 error 那一頁什麼都沒做。讀不到時 Vout 不會更新，<b>還是上一片的值</b>，判定照樣跑：這就是 B5 會 PASS 的原因。</li>
 <li><b>用區域變數傳資料</b>：讀值寫進顯示元件，再從區域變數拿出來判定。資料不是沿著線流，看不出先後；而且它會保留上一次的值。用線直接連就不會有這種事。</li>
 <li><b>上下限寫死，而且寫錯</b>：T03 上限寫 5.15，規格書是 5.10。上下限散在每一格的常數裡，很難一次檢查。</li>
 <li><b>沒有註解的 Wait 3000 ms</b>：等什麼？不知道。不知道的東西不要刪，先查。</li>
 <li>（加分）檔名叫 <code>final_v3_new</code>：沒有版本控制的徵兆。</li></ol>`),
C.h3('④ 規劃：一次改一件事','','每改一件就跑回歸測試'),
`<p>要做的修改列出來，排好順序，<b>一次改一件、跑一次回歸、提交一次</b>。下面的回歸測試台可以試試看：每一項修改分別勾、一起勾，看 5 片板子的結果有沒有跟基準不一樣。</p>`,
{fn:regress},
ask('回歸測試出現「不一樣」，怎麼判斷是你改壞了，還是舊程式本來就錯？',
 `<p>拿規格書來對：</p>
 <ul><li>新的結果<b>符合規格</b>、舊的不符合 → 舊程式本來就錯（B4）。回報，由主管和品保決定。</li>
 <li>新的結果<b>是你本來想要的改變</b> → 預期中的差異（B5）。寫進變更說明。</li>
 <li>新的結果<b>不符合規格、也不是你想要的</b> → 你改壞了（B2）。回到上一次提交，找原因。</li></ul>
 <p>三種都要寫下來。只有「完全一樣」才不用解釋：所以重構（E）的目標就是完全一樣。</p>`),
tip('VI 放進版本控制要注意','VI 是二進位檔，git 看不出改了哪裡。專案屬性勾「Separate compiled code from source file」，不然只是打開存檔就會冒出一堆「有變更」的檔案；比較改前改後可以用 Tools ▸ Compare ▸ Compare VIs（專業版才有），或在提交訊息寫清楚改了哪一格、附截圖。'),
tip('看不懂的東西先別刪','舊程式裡奇怪的 Wait、多讀一次丟掉、某個儀器設定重送兩次，常常是前人踩過坑之後加的。刪之前先問、先實驗；搞懂了就在旁邊寫一個註解（方塊圖上按兩下空白處就能打字），下一個接手的人就不用再猜一次。'),
C.h3('⑤ 一步一步寫','','修 B5：讀不到就是 ERROR'),
`<p>這是要交給主管核准的修改之一。新寫法不用區域變數，讀值直接沿著線走；DMM 有錯誤時，讀值換成 NaN（不是數字），結果是 ERROR。</p>`,
{steps:{title:'T03_Judge.vi：讀不到就判 ERROR',lv:fixv,steps:[
 {t:'拆出錯誤的 status',view:'split',add:['cut','tv','pv','dmm','ub','f1'],h:`<p>Read DMM.vi 的 error out 接 ${fn('Programming','Cluster, Class, & Variant','Unbundle By Name')}，選 <b>status</b>：True 代表這次讀取失敗。</p>`},
 {t:'讀不到就換成 NaN',view:'split',add:['knan','sel1','f2','f3','f4','rd'],h:`<p>Select：status 是 True 給 NaN，否則給讀值。NaN 跟任何數比都是 False，就算後面有人忘了檢查錯誤，也不會被判 PASS。</p>`},
 {t:'和上下限比',view:'split',add:['khi','klo','irc','f5','f6','f7','kP','kF','sel2','f8','f9','f10'],h:`<p>上下限照規格書：4.85～5.10。實際的程式要從 limits 表拿（修改 A），這裡為了看清楚先用常數。</p>`},
 {t:'錯誤優先：ERROR',view:'split',add:['kE','sel3','f11','f12','f13','res','f14','old'],h:`<p>最後一個 Select：有錯誤就是 "ERROR"，不管上下限比出什麼。</p><p>前面板切「DMM 線鬆了」：舊程式用上一片的值判 PASS，修改後判 ERROR。再把「上一片的讀值」改成 4.5：舊程式就變 FAIL，<b>同一個壞掉的接線，結果看上一片而定</b>，這種 bug 最難查。</p>`}
]}},
tip('參考答案','<a href="vi/LV2018/W08_T03_Judge.zip" download>W08_T03_Judge.zip（LabVIEW 2018）</a>　<a href="vi/W08_T03_Judge.zip" download style="font-size:13px">2026 版</a>：解開後保持資料夾結構，W08_sub 裡的 Read DMM.vi 是<b>假的</b> SubVI（用「DMM loose (sim)」「true V (sim)」兩個輸入代替真的電表），換成真的 Read DMM 時要重接端子。NaN 用 0 ÷ 0 產生。實測：4.97 V PASS；線鬆了 value used 是 NaN、結果 ERROR；5.10 和 4.85 PASS（含上下限）；4.80、5.12 FAIL。'),
C.h3('⑥ 交機：變更說明','','讓下一個人看得懂你改了什麼'),
C.table(['欄位','內容（範例）'],[
 ['版本','PM5_Test 1.1.0（接手時的版本記為 1.0.0）'],
 ['改了什麼','① 新增 T06 輸出漣波 ≤ 50 mV；② DMM 讀取錯誤判 ERROR（原本沿用上一片的讀值）；③ 上下限改由 limits.csv 讀取'],
 ['為什麼','① 客戶要求；② 基準測試發現讀不到時會誤判 PASS；③ 原本 T03 上限寫成 5.15，與規格書 5.10 不符'],
 ['行為改變','B4 類（滿載 5.10～5.15 V）原本 PASS，改後 FAIL；接線不良原本可能 PASS，改後 ERROR'],
 ['回歸測試','5 片基準板，結果表附後；每片多 0.8 秒（T06）'],
 ['核准','品保 ___、主管 ___（③ 的上限修正需品保同意）'],
 ['上線與退回','週一換線時上線；有問題時退回 1.0.0（版本控制裡的第一個提交）']
]),
`<p>上線後的第一天，跟著產線看前 100 片：良率有沒有突然變化？有的話，先對照變更說明裡的「行為改變」。</p>`,
note('接手的心態','舊程式能跑，代表它在產線上通過了很多次真正的考驗，雖然有問題，也藏著很多你還不知道的知識。尊重它、先留基準、一次改一件事；不要一接手就整個重寫。等你有了回歸測試，重構才是安全的。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'接手舊程式，第一件事應該是？',o:['複製一份放進版本控制，用已知的板子跑一次留基準','先把亂的地方整理乾淨','直接加新測項','重寫一個新的'],a:0,ex:'沒有基準就不知道改了之後有沒有變。'},
 {q:'回歸測試的「基準」是？',o:['改之前，用同一批已知板子跑出來的結果','規格書','新程式的結果','客戶的要求'],a:0,ex:'改前改後用同樣的板子比。'},
 {q:'改了上下限之後，一片原本 PASS 的板子變成 FAIL，而新的上下限符合規格書。代表？',o:['舊程式本來就錯，要回報主管和品保','你改壞了，要改回去','測試站壞了','不用管它'],a:0,ex:'而且已出貨的可能有問題。'},
 {q:'舊程式 DMM 讀不到時判 PASS，最可能的原因？',o:['錯誤頁沒處理，區域變數還是上一片的值','DMM 太準','上下限太寬','Wait 太長'],a:0,ex:'錯誤被吞掉 ＋ 區域變數保留舊值。'},
 {q:'讀值換成 NaN 的好處？',o:['NaN 和任何數比都是 False，不會被判在範圍內','NaN 比較快','NaN 等於 0','可以存檔'],a:0,ex:'多一道防線。'},
 {q:'程式裡有一個沒註解的 Wait 3000 ms，最好的做法？',o:['先問、先實驗搞懂，再寫上註解','直接刪掉，測試變快','改成 0','改成 30000'],a:0,ex:'它可能是在等電源穩定。'},
 {q:'為什麼要一次只改一件事？',o:['回歸測試出現差異時，才知道是哪一項造成的','LabVIEW 一次只能改一個地方','比較快','主管規定'],a:0,ex:'改一項、跑回歸、提交。'},
 {q:'用新版 LabVIEW 打開 2018 的程式存檔，會怎樣？',o:['2018 打不開，要用 Save for Previous Version','沒差別','程式變快','自動轉成 2018'],a:0,ex:'測試站裝的是哪一版要先問。'}
]}
]});
})();
