/* 高階實務 H6：CLD 型限時專案。題目是 LadderLab 原創的（不是 NI 的樣題），形式照 CLD：4 小時、只有軟體、狀態機、檔案紀錄。
   證據（docs/research_cld.md）：CLD 考試 4 小時、只有軟體（NI 官方頁、2012 指南 p.2）；先決條件現在是 None（官方 BADGE 頁；2018 起 CLAD 不是先決條件，論壇公告，二手）；
   配分：2012 指南 40 分（風格 15、功能 15、文件 10，p.11），2019-11 起功能 50／風格 30／文件 20（NI 論壇公告，二手；現行官方文件查不到）；及格 70%。
   評分重點出自 2012 指南 p.11–12（狀態機＋typedef enum、錯誤時要停、100 ms 內回應、CPU 不吃滿、錯誤端子要接、說明與 tip strip）。
   職缺：台灣只見 CLAD 偶爾列為加分，沒有看到 CLD；國外資深職缺常列為加分。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='高階實務';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary><div class="ans">${a}</div></details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

/* ---- 參考行為：燒機箱控制器（網頁版，不是 LabVIEW；用來確認你對需求的理解） ---- */
function ovenFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff;font-size:13px';
  el.innerHTML=`<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px">
   <div>
    <label>設定溫度 °C <input data-k="sp" type="number" value="60" min="30" max="85" style="width:60px"></label><br>
    <label>持溫秒數 <input data-k="soak" type="number" value="10" min="1" max="600" style="width:60px"></label><br>
    <div style="margin:6px 0;display:flex;gap:6px;flex-wrap:wrap">
     <button data-a="start">Start</button><button data-a="stop">Stop</button>
     <label><input type="checkbox" data-k="door"> 門開著</label>
     <label><input type="checkbox" data-k="fault"> 溫度感測器斷線</label></div>
    <div>狀態：<b data-o="st"></b>　溫度：<b data-o="t"></b> °C　加熱器：<b data-o="h"></b></div>
    <div>持溫剩餘：<b data-o="left"></b> s</div>
   </div>
   <div><div style="color:#555">紀錄檔（每次狀態改變寫一行）</div>
    <pre data-o="log" style="background:#1e1e1e;color:#e8e8e8;padding:6px 8px;border-radius:4px;height:150px;overflow:auto;margin:4px 0 0;font-size:12px;white-space:pre-wrap"></pre></div></div>`;
  const S={st:'Idle',t:25,heat:false,left:0,log:[],tick:0};
  const $=q=>el.querySelector(q);
  function go(ns,why){if(S.st===ns)return;S.st=ns;const ts=(S.tick/10).toFixed(1).padStart(6);S.log.push(`${ts} s, ${ns}${why?', '+why:''}, ${S.t.toFixed(1)} C`);}
  $('[data-a=start]').onclick=()=>{if(S.st==='Idle'||S.st==='Done'){S.left=+$('[data-k=soak]').value||10;go('Heating','Start');}};
  $('[data-a=stop]').onclick=()=>{if(S.st!=='Idle')go('Cooling','Stop pressed');};
  function step(){
    S.tick++;
    const sp=Math.min(85,Math.max(30,+$('[data-k=sp]').value||60)),door=$('[data-k=door]').checked,fault=$('[data-k=fault]').checked;
    if(fault&&S.st!=='Error'&&S.st!=='Idle'){go('Error','sensor fault');}
    if(S.st!=='Error'&&door&&(S.st==='Heating'||S.st==='Soaking')){S.prev=S.st;go('Paused','door open');}
    if(S.st==='Paused'&&!door)go(S.prev||'Heating','door closed');
    S.heat=S.st==='Heating'||(S.st==='Soaking'&&S.t<sp);
    if(S.heat)S.t+=0.5;else if(S.t>25)S.t-=S.st==='Cooling'||S.st==='Error'||S.st==='Paused'?0.4:0.05;
    if(S.st==='Heating'&&S.t>=sp)go('Soaking','setpoint reached');
    if(S.st==='Soaking'&&S.tick%10===0){S.left--;if(S.left<=0)go('Cooling','soak done');}
    if(S.st==='Cooling'&&S.t<=35)go('Done','below 35 C');
    $('[data-o=st]').textContent=S.st;$('[data-o=st]').style.color=S.st==='Error'?'#c0392b':S.st==='Paused'?'#b9770e':'#1d4fa0';
    $('[data-o=t]').textContent=S.t.toFixed(1);$('[data-o=h]').textContent=S.heat?'ON':'OFF';$('[data-o=left]').textContent=S.st==='Soaking'||S.st==='Paused'?S.left:'—';
    const lg=$('[data-o=log]');lg.textContent=S.log.join('\n');lg.scrollTop=lg.scrollHeight;
  }
  const id=setInterval(()=>{if(!document.body.contains(el)){clearInterval(id);return;}step();},100);step();
}

/* ---- 自評表 ---- */
const SC=[
 {c:'功能',w:50,items:['Start 後依序 Heating → Soaking → Cooling → Done','持溫倒數只在 Soaking 時走，門開時暫停','門開時加熱器關、狀態 Paused；門關回到原本的階段','感測器斷線時加熱器關、進入 Error、不能再 Start','Stop 在任何狀態都會進入 Cooling（Idle 除外）','每次狀態改變寫一行紀錄（時間、狀態、原因、溫度）','操作在 100 ms 內有反應，CPU 沒有吃滿']},
 {c:'風格',w:30,items:['狀態機，狀態是 type-def 的 enum','重複的程式做成 SubVI，結構不巢狀兩層以上','沒有用一堆區域變數、沒有用 Value 屬性更新顯示','錯誤端子都接了，開的參考（檔案）都關了','線不繞、不重疊、不從結構底下穿過']},
 {c:'文件',w:20,items:['主 VI 和每個 SubVI 都有 VI 說明（VI Properties ▸ Documentation）','控制項有 tip strip；常數、重要的線有標籤','SubVI 有自己的圖示，主 VI 不是預設圖示']}
];
function scoreFig(el){
  el.className='fig';el.style.cssText='border:1px solid #d9cfe8;border-radius:6px;padding:10px 12px;background:#fbf9ff;font-size:13px';
  el.innerHTML=SC.map((g,gi)=>`<div style="margin:4px 0 8px"><b>${g.c}（${g.w} 分）</b>${g.items.map((t,i)=>`<label style="display:block;margin:2px 0 2px 10px"><input type="checkbox" data-g="${gi}" data-i="${i}"> ${t}</label>`).join('')}</div>`).join('')+
   `<div data-o="out" style="border-top:1px solid #ddd;padding-top:6px"></div>`;
  function draw(){
    let tot=0;const parts=SC.map((g,gi)=>{const n=el.querySelectorAll(`[data-g="${gi}"]:checked`).length,sc=g.w*n/g.items.length;tot+=sc;return `${g.c} ${sc.toFixed(0)}／${g.w}`;});
    const f=el.querySelectorAll('[data-g="0"]:checked').length/SC[0].items.length*50;
    el.querySelector('[data-o=out]').innerHTML=`估計：${parts.join('、')}，合計 <b style="color:${tot>=70?'#1e7b34':'#c0392b'}">${tot.toFixed(0)} 分</b>（及格 70）。`+(tot<70&&f<40?'<br>功能拿不到 40，風格和文件全拿也過不了：<b>先把功能做完</b>。':'')+'<br><span style="color:#777">配分用 2019 年起的「功能 50、風格 30、文件 20」（NI 論壇上的公告，現行官方文件查不到）；每一類平均分給各項是 LadderLab 的簡化，實際評分更細。</span>';
  }
  el.querySelectorAll('input').forEach(c=>c.onchange=draw);draw();
}

L.push({id:'H6',order:45,no:'H6',part:PART,title:'CLD 型限時專案：4 小時做一個能交件、好維護的燒機箱控制器',mins:300,files:[],
goals:[['學會','在限時內從需求做出可以執行、好維護、有文件的 LabVIEW 程式：讀需求、畫狀態圖、定 type-def enum、先做主流程再補細節、邊做邊寫文件、交件前自己驗收；知道 CLD 的現行規則和評分重點'],
 ['工作上','國外資深職缺常把 CLD 列為加分；台灣職缺目前只見 CLAD 偶爾加分。不管考不考，「限時做出別人接得下去的程式」就是工作日常'],
 ['用到','A8（從需求到骨架）、A2～A7（QMH）、W12（燒機和紀錄檔）、H3（審查清單）、H5（固定輸入自己測）']],
check:'不看課文，能說出：CLD 考什麼、多久、能用什麼資料；評分三大類和為什麼要先把功能做完；你的 4 小時怎麼分配；交件前要自己檢查哪些事。',
body:[
C.h3('這一課的工作','x','限時做完，而且別人接得下去'),
`<p>這一課是一場模擬考：<b>4 小時</b>，照需求做出一支燒機箱控制器（只有軟體，溫度是模擬的）。形式照 NI 的 CLD（Certified LabVIEW Developer）實作考試，但題目是 LadderLab 自己出的，主題接 W12 的老化燒機。</p>
<p>不打算考證照也值得做：工作上很多時候就是「主管給一張需求、這週交」，交出去的程式要能跑、能維護、有說明。</p>`,
note('為什麼有這一課（資料來源）','國外的資深 LabVIEW 職缺常把 CLD 寫成加分；台灣職缺目前只看到 CLAD 偶爾列為加分，沒有看到寫 CLD 的；NI 台灣的課程路線是「Core 3 加 CLD」（搜尋摘要）。考試規則和評分整理在 docs/research_cld.md。'),
C.h3('① CLD 考什麼','','先知道規則'),
C.table(['項目','內容','出處強度'],[
 ['形式','4 小時實作，只有軟體、沒有硬體；線上（Pearson VUE 遠端監考的虛擬機）或實體','NI 官方頁'],
 ['能用什麼','LabVIEW 內建的說明、範例、範本可以用；自己帶寫好的 VI、外部資源<b>禁止</b>；不能用紙筆（虛擬機裡有記事本、小畫家）','官方頁、2012 指南'],
 ['不能改','題目給的主 VI 名稱、給定的控制項、資料夾結構；改了就不評分','2012 指南、樣題'],
 ['LabVIEW 版本','考場提供，不能用自己的；官方沒寫哪一版，論壇說近年是 2020','論壇（二手）'],
 ['先決條件','現在不需要 CLAD（2018 年起取消）。2012 年的指南還寫「CLAD 是先決條件」，那是舊規定','官方頁；取消時間是論壇公告（二手）'],
 ['及格','70%','2012 指南；2019 論壇公告'],
 ['配分','2012 指南：40 分（風格 15、功能 15、文件 10）。<b>2019-11 起改成功能 50、風格 30、文件 20</b>','新配分只有 NI 論壇上的公告（二手），現行官方文件查不到'],
 ['有效期','3 年；可以考 CLD-R（1 小時選擇題）、累積點數或重考實作來重新認證','官方頁、CLD-R 指南']
]),
warn('功能占一半','2019 年改制的理由是不讓「功能做不完、靠風格和文件撐到及格」的考卷過關。論壇上的計算：功能至少要拿到約 40％ 才有可能及格。所以策略是：<b>先讓主流程能跑、需求一條一條做完，再整理風格、補文件</b>；但文件要邊做邊寫，不要留到最後 10 分鐘。'),
C.h3('② 題目：燒機箱控制器','','LadderLab 原創，形式照 CLD'),
`<p>你拿到一個資料夾：<code>Oven Controller.vi</code>（主 VI，前面板已經放好控制項）、<code>Oven State.ctl</code> 的位置留給你建。前面板有：Start、Stop 按鈕；設定溫度（30～85 °C）；持溫秒數；「門開著」開關；「感測器斷線」開關（模擬用）；狀態、溫度、加熱器、持溫剩餘的顯示；紀錄檔路徑。</p>`,
C.table(['編號','需求'],[
 ['R1','程式開起來在 Idle，加熱器關。溫度從 25 °C 開始模擬：加熱器開時每 100 ms 升 0.5 °C；關時慢慢降回 25 °C'],
 ['R2','按 Start（只在 Idle 或 Done 有效）→ Heating：加熱器開，直到溫度到設定溫度'],
 ['R3','到設定溫度 → Soaking：維持溫度（低於設定就加熱、到了就關），持溫秒數倒數'],
 ['R4','持溫倒數到 0 → Cooling：加熱器關，降到 35 °C 以下 → Done'],
 ['R5','Heating 或 Soaking 時門被打開 → Paused：加熱器關、持溫倒數暫停；門關上 → 回到原本的階段'],
 ['R6','任何時候感測器斷線 → Error：加熱器關，狀態停在 Error，Start 無效（要重開程式）'],
 ['R7','Stop：Idle 以外的任何狀態 → Cooling'],
 ['R8','每次狀態改變，在紀錄檔加一行：經過秒數、新狀態、原因、當時溫度（CSV）'],
 ['R9','任何操作在 100 ms 內有反應；CPU 不能吃滿'],
 ['R10','程式出錯（例如紀錄檔開不起來）時，加熱器關、停止程式並顯示錯誤']
]),
`<p>下面是需求的<b>參考行為</b>（網頁版的模擬，不是 LabVIEW）。動手前先玩一遍，確認你對每一條需求的理解和它一樣：</p>`,
{fn:ovenFig},
ask('R5 說門關上要「回到原本的階段」。如果在 Heating 開門、關門時溫度已經掉了 5 °C，應該回到哪裡？持溫倒數呢？',`<p>回到 Heating：原本就還沒到設定溫度。如果是在 Soaking 開門，關門後回 Soaking，倒數從暫停的地方繼續（參考行為就是這樣做的）。</p><p>需求沒寫清楚的地方，考試時要<b>自己做一個合理的決定，並寫在 VI 說明裡</b>（例如「門關後若溫度低於設定 0.5 °C 以上，仍算 Soaking，由加熱器補回」）。工作上則是去問需求的人，問不到就寫下你的假設。</p>`),
C.h3('③ 4 小時怎麼分','','考過的人的建議（二手）'),
C.table(['時間','做什麼','對應課程'],[
 ['0:00–0:30','讀需求兩遍，列出狀態和「什麼事件讓它換狀態」，畫狀態圖；建 type-def enum；決定要哪些 SubVI','A8'],
 ['0:30–2:00','主迴圈和狀態機骨架先能跑：Idle → Heating → Soaking → Cooling → Done。每做完一個狀態就 Run 一次','A2、W1'],
 ['2:00–3:00','補 Paused、Error、Stop、紀錄檔；做錯誤處理（R10）','W6、W12'],
 ['3:00–3:30','自己驗收：照需求表一條一條試，邊界也試（剛好到設定溫度、持溫 1 秒、門在 Soaking 的最後一秒打開）','H5'],
 ['3:30–4:00','整理線、補說明、tip strip、圖示；<b>存檔</b>（沒存到就沒有分數）','H3']
]),
tip('文件邊做邊寫','每建一個 SubVI，馬上寫它的說明和圖示；每放一個常數就加標籤。留到最後 30 分鐘一次寫，通常寫不完。'),
C.h3('④ 架構：簡單的狀態機就夠','','不要把 H1、H4 帶進來'),
`<ul><li>2012 指南的最低要求是<b>狀態機，狀態用 type-def 的 enum</b>。一個 While Loop、一個 Case 結構、一個 Shift Register 放目前狀態和資料（溫度、持溫剩餘），每圈 Wait 100 ms，就能滿足 R1、R9。</li>
<li>按鈕用 Event 結構或輪詢都可以；用 Event 時要注意 Timeout（溫度模擬要一直跑）。</li>
<li>A 系列的 QMH 可以用，但比題目需要的多；4 小時內做得完、做得穩才重要。H1 的類別、H4 的抽象層、Actor Framework 都不要帶進來：時間不夠，也不加分。</li>
<li>紀錄檔：開始時開一次（replace or create）、每次換狀態寫一行、結束時關（W12、F4）。</li></ul>`,
ask('「感測器斷線」和「程式出錯」（R6 和 R10）有什麼不一樣？',`<p>R6 是<b>製程上的異常</b>：程式本身沒問題，照需求進入 Error 狀態、關加熱器、等人處理，程式繼續跑（畫面要能顯示）。R10 是<b>程式的錯誤</b>（error cluster 有錯，例如檔案開不起來）：關加熱器、停止程式、顯示錯誤。2012 指南的功能要求就有「發生錯誤時程式要停」。兩者混在一起，常見的結果是檔案開不起來時程式還在假裝正常加熱。</p>`),
C.h3('⑤ 交件前自評','','照評分重點勾'),
{fn:scoreFig},
C.h3('⑥ 常被扣分的地方','','考過的人說的（二手）'),
C.table(['扣分','怎麼避免'],[
 ['出錯時程式沒有停','error 線接到停止條件，停之前關加熱器、關檔案'],
 ['錯誤端子沒接','每個有 error 的節點都串起來（H3）'],
 ['迴圈沒有 Wait，CPU 100%','狀態機每圈 Wait；Event 結構用 Timeout'],
 ['區域變數用太多','資料放 Shift Register；按鈕在 Event 或迴圈裡讀'],
 ['SubVI 沒有圖示或說明、控制項沒有 tip strip','邊做邊寫'],
 ['改了題目給的前面板或名稱','不要改；要加的東西放在自己的 SubVI 裡'],
 ['做了題目沒要求的功能','不加分還花時間，還可能弄壞要求的功能'],
 ['功能做不完','先把主流程做到能跑，再補細節；最後 30 分鐘不要再加新功能']
]),
warn('這一課沒有參考答案','LadderLab 目前沒有這一題的參考 VI；上面的參考行為是網頁版的模擬，用來確認需求，不是 LabVIEW 的寫法。做完後可以用 H3 的方式找同學互相審查，用 ⑤ 的自評表給分。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'現在考 CLD 需要先考過 CLAD 嗎？',o:['不需要（2018 年起取消）','需要','要先考 CLA','要先考 CLD-R'],a:0,ex:'2012 年的指南還寫是先決條件，那是舊規定。'},
 {q:'2019 年起 CLD 的配分（NI 論壇公告）？',o:['功能 50、風格 30、文件 20','風格 15、功能 15、文件 10','只看功能','只看文件'],a:0,ex:'40 分制是 2012 年指南的舊配分。'},
 {q:'考試時可以用的資料？',o:['LabVIEW 內建的說明、範例、範本','自己事先寫好的 VI','網路搜尋','紙本筆記'],a:0,ex:'外部寫好的 VI 和資源禁止使用。'},
 {q:'4 小時的策略？',o:['先讓主流程能跑、需求做完，文件邊做邊寫','先把圖示畫漂亮','先寫所有文件','先做最難的錯誤處理再做主流程'],a:0,ex:'功能占一半，做不完扣最多。'},
 {q:'這一題用什麼架構最合適？',o:['狀態機 + type-def enum','Actor Framework','H4 的類別抽象層','Sequence 結構串到底'],a:0,ex:'最低要求是狀態機；複雜的架構在 4 小時內做不完也不加分。'},
 {q:'紀錄檔開不起來（error cluster 有錯）時應該？',o:['關加熱器、停止程式、顯示錯誤','忽略錯誤繼續加熱','改成 Error 狀態繼續跑','重開電腦'],a:0,ex:'程式的錯誤要停；製程異常（感測器斷線）才是進 Error 狀態。'}
]}
]});
})();
