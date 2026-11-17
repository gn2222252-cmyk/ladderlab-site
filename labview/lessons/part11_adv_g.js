/* 高階實務 H7：看懂 Actor Framework 的程式（接手用，不是從零寫）。
   證據：docs/research_af.md（助理整理：本機 vi.lib 的官方說明字串、本機範例說明；NI 線上說明的鏡像和論壇標二手）。
   職缺：AF 只在國外職缺出現（4 則）；台灣沒有找到。DQMH 在台灣資料裡的兩處沒有職缺代號，不當證據（job_research.md 已加註）。
   實測（labview_vi/_build/probe_af.py，LabVIEW 2026）：複製 NI 範例 Actor Framework Fundamentals（咖啡店，113 支 VI），開啟並截圖方塊圖（沒有執行）：
   Send Add Customer.vi 把 Add Customer Msg 物件 Enqueue（priority 預設 Normal）；Add Customer Msg 的 Do.vi 用 To More Specific Class 把 Actor 轉成
   Coffee Shop 再呼叫它的方法；Coffee Shop 的 Actor Core 有自己的 UI 事件迴圈，主線上呼叫父類別 Actor Core（方塊圖註解：框架的訊息處理在那裡）；
   Stop Core 的註解：這個 actor 啟動的 nested actor 不用自己送停止訊息，框架會處理。課文不放 NI 的截圖，只用自己的話描述。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='高階實務';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary><div class="ans">${a}</div></details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

/* ---- 一則訊息的旅程（照範例的實際檔案） ---- */
const TRIP=[
 {w:'Coffee Shop 的 Actor Core.vi（UI 迴圈）',t:'使用者在前面板按了「加一位客人」。Coffee Shop 自己的 Actor Core 裡有一個 UI 事件迴圈（helper loop），它不直接改資料，而是<b>送一則訊息給自己</b>。',qmh:'QMH 的 UI 迴圈把命令字串放進佇列'},
 {w:'Coffee Shop Messages\\Add Customer Msg\\Send Add Customer.vi',t:'Send Add Customer.vi 做一件事：做出一個 Add Customer Msg 物件，用 Enqueue 放進對方的 <b>Message Enqueuer</b>（就是那個 actor 的佇列），優先權預設 Normal。每一種訊息都有自己的 Send xxx.vi，是 Message Maker 這個工具產生的。',qmh:'Enqueue Element，元素是字串（或 cluster）'},
 {w:'父類別 Actor.lvclass 的 Actor Core（框架裡面）',t:'Coffee Shop 的 Actor Core 主線上呼叫了父類別的 Actor Core。框架的訊息迴圈就在那裡：一次拿一則訊息，呼叫那則訊息的 Do.vi。<b>你在專案裡看不到這個迴圈</b>，因為它在 vi.lib 的 Actor Framework 裡。',qmh:'消費者迴圈的 Dequeue'},
 {w:'Add Customer Msg\\Do.vi',t:'Do.vi 是訊息類別覆寫的方法。它把收到的 Actor 物件用 To More Specific Class 轉成 Coffee Shop，再呼叫 Coffee Shop 的方法（範例裡是一個「加入」方法，帶 Customer 這個種類）。外面包一個錯誤 Case：前面有錯就不做。',qmh:'Case 結構裡「AddCustomer」那一頁'},
 {w:'Coffee Shop.lvclass 的方法',t:'真正做事的是 Coffee Shop 的方法：改 Coffee Shop 的私有資料、或啟動一個 Customer 的 nested actor。做完把改過的物件傳回去，框架的訊息迴圈再拿下一則。',qmh:'那一頁裡的程式，資料在 Shift Register'}
];
function tripFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff;font-size:13px';
  el.innerHTML=`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${TRIP.map((s,i)=>`<button data-i="${i}" style="padding:2px 8px">${i+1}</button>${i<TRIP.length-1?'→':''}`).join('')}</div><div data-o="out" style="margin-top:8px"></div>`;
  function show(i){
    el.querySelectorAll('[data-i]').forEach(b=>b.style.background=+b.dataset.i===i?'#1d4fa0':'');el.querySelectorAll('[data-i]').forEach(b=>b.style.color=+b.dataset.i===i?'#fff':'');
    const s=TRIP[i];
    el.querySelector('[data-o=out]').innerHTML=`<div style="color:#555">檔案：<code>${s.w}</code></div><p style="margin:4px 0">${s.t}</p><div style="color:#7a5b00">對照 QMH（A 系列）：${s.qmh}</div>`;
  }
  el.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>show(+b.dataset.i));show(0);
}

/* ---- 停止和錯誤：預設行為 ---- */
const ERRS=[
 {t:'Coffee Shop 自己的方法回了一個錯誤',r:'Handle Error 的預設是<b>任何錯誤都停止這個 actor</b>。Coffee Shop 停止時，框架會讓它啟動的 nested actor（客人、店員）也停止。'},
 {t:'某一位客人（nested actor）出錯停止了',r:'客人停止時會送 Last Ack 給它的 caller（Coffee Shop）。Handle Last Ack Core 的預設是把裡面的錯誤往上傳，所以<b>Coffee Shop 也跟著停</b>，一路停到 root。要讓「一位客人出錯不影響整間店」，要覆寫 Handle Last Ack Core 或 Handle Error 自己決定。'},
 {t:'程式送 Normal Stop',r:'Normal Stop 是一則一般的訊息，要<b>排隊</b>：前面的訊息處理完才輪到它。'},
 {t:'程式送 Emergency Stop',r:'Emergency Stop 用最高（critical）優先權，<b>排到最前面</b>；但正在處理的那一則訊息還是要先做完。'},
 {t:'某一則 Do.vi 裡有一個跑 10 秒的迴圈',r:'訊息一次只處理一則：這 10 秒內這個 actor <b>什麼都收不到</b>，連 Stop 都要等。長時間的工作要放到 helper loop（像 Coffee Shop 的 UI 迴圈那樣），並在 Stop Core 讓它結束。'}
];
function errFig(el){
  el.className='fig';el.style.cssText='border:1px solid #e8dca8;border-radius:6px;padding:10px 12px;background:#fffdf3;font-size:13px';
  el.innerHTML=`<label>情況 <select data-k="e">${ERRS.map((e,i)=>`<option value="${i}">${e.t}</option>`).join('')}</select></label><p data-o="out" style="margin:8px 0 0"></p>`;
  const d=()=>el.querySelector('[data-o=out]').innerHTML=ERRS[+el.querySelector('select').value].r;
  el.querySelector('select').onchange=d;d();
}

L.push({id:'H7',order:46,no:'H7',part:PART,title:'看懂 Actor Framework 的程式：接手時找得到訊息從哪裡來、在哪裡處理、怎麼停',mins:70,files:[],
goals:[['學會','用 QMH 的觀念對照 AF：actor、message、enqueuer、Actor Core、Do.vi；追一則訊息從 Send 到 Do 到方法；知道 AF 的停止和錯誤預設；知道 LabVIEW 2018 和 2020 以後的差別；知道 DQMH 是什麼'],
 ['工作上','國外的資深 LabVIEW 職缺會寫 Actor Framework；接手大型、多工位的系統時可能會遇到。這一課的目標是「看得懂、改得動一個小地方」，不是從零設計'],
 ['用到','A2～A7（QMH、四個迴圈、結束順序、錯誤處理）、H1（類別、動態分派、Call Parent Method）、H4（父類別定義介面）']],
check:'不看課文，能說出：一則訊息在 AF 裡經過哪幾個 VI；為什麼你在專案裡找不到訊息迴圈；一個 nested actor 出錯時預設會發生什麼；為什麼 Do.vi 裡不能跑長迴圈；2018 的 AF 程式和 2026 的範例差在哪裡。',
body:[
C.h3('這一課的工作','x','接手一套用 AF 寫的設備程式'),
`<p>你接手一台多工位設備的程式。打開專案：上百支 VI，每一種「命令」都是一個類別、一個 Do.vi、一個 Send xxx.vi；找不到一個看得到的主迴圈；主管要你「加一個顯示當前產量的訊息」。</p>
<p>這是 <b>Actor Framework（AF）</b>：LabVIEW 內建的框架（LabVIEW 2012 起），用 H1 的類別寫 A 系列 QMH 那種「好幾個平行的迴圈、用佇列傳訊息」。這一課用 NI 內附的咖啡店範例，練習<b>看懂</b>它，不是從零設計。</p>`,
note('為什麼有這一課（資料來源）','Actor Framework 只在國外的資深職缺看到（4 則）；台灣的資料裡沒有找到。PTT 上有從業者提到某家公司對 DQMH（另一個框架）需求很高（二手）。所以這一課的定位是「遇到時看得懂」，不是必備技能。整理在 docs/research_af.md。'),
C.h3('① 用 QMH 的觀念對照','','A 系列學過的東西換個名字'),
C.table(['QMH（A 系列）','Actor Framework','在哪裡'],[
 ['一個「迴圈＋佇列」的模組','一個 <b>actor</b>：一個繼承 Actor.lvclass 的類別','專案裡的 xxx.lvclass'],
 ['佇列的參考','<b>Message Enqueuer</b>：只能放進去，不能拿出來','Read Self Enqueuer、Read Caller Enqueuer'],
 ['命令字串（或 cluster）','<b>訊息類別</b>：每一種命令是一個繼承 Message 的類別','xxx Msg.lvclass'],
 ['消費者迴圈的 Dequeue + Case 結構','父類別的 <b>Actor Core</b>（框架裡）＋每個訊息的 <b>Do.vi</b>','你看不到迴圈；Do.vi 在訊息類別裡'],
 ['Case 那一頁裡的程式','actor 類別的<b>方法</b>（由 Do.vi 呼叫）','xxx.lvclass 的成員 VI'],
 ['程式開始時的初始化','<b>Pre Launch Init</b>（框架在 Actor Core 之前呼叫）','覆寫的方法'],
 ['結束時的清理、等其他迴圈停','<b>Stop Core</b>；nested actor 停止時送 <b>Last Ack</b>','覆寫的方法'],
 ['UI 事件迴圈','覆寫的 Actor Core 裡自己放的 helper loop','xxx.lvclass 的 Actor Core.vi']
]),
C.h3('② 追一則訊息','','咖啡店範例的實際檔案'),
`<p>NI 範例：Help ▸ Find Examples 搜尋 Actor Framework，打開 Actor Framework Fundamentals（咖啡店）。先複製整個資料夾。入口是 Launcher.vi：它用 Launch Root Actor 啟動最上層的 Coffee Shop，然後自己就結束了（actor 會繼續跑）。下面跟著一則「加一位客人」的訊息走一遍：</p>`,
{fn:tripFig},
ask('Coffee Shop 的 Actor Core 是覆寫的方法，裡面呼叫了 Call Parent Method。如果刪掉它會怎樣？H1 的作業不是叫你刪掉 Call Parent Method 嗎？',`<p>刪掉就<b>沒有訊息迴圈</b>：框架的訊息處理在父類別的 Actor Core 裡（範例的方塊圖註解也這樣寫），不呼叫它，這個 actor 收得到訊息但永遠不會處理。</p><p>H1 刪掉的是 Get Class Name、Get Unique Test ID 裡的 Call Parent Method：那裡父類別的版本會回傳錯的名稱，要換成自己的。<b>要不要呼叫父類別，看父類別那個方法做了什麼</b>：AF 的 Actor Core、Pre Launch Init、Stop Core 這類，通常都要保留。</p>`),
C.h3('③ 停止和錯誤：預設會發生什麼','','接手時最常被嚇到的地方'),
{fn:errFig},
warn('錯誤代碼 43','在 Do.vi 或方法裡，錯誤 43（使用者取消）被框架拿來代表「停止這個 actor」。不要把它當一般錯誤用，也不要看到 43 就以為是程式壞了。'),
`<p>Coffee Shop 的 Stop Core 方塊圖上有一段註解：它啟動的 nested actor 不用自己送停止訊息，框架會處理；清理時的錯誤可以忽略，因為 actor 本來就要結束了。</p>`,
C.h3('④ 接手時的陷阱','',''),
C.table(['陷阱','結果','怎麼辦'],[
 ['在 Do.vi 或方法裡跑長迴圈、長時間等待','這段時間 actor 收不到任何訊息，連 Stop 都等','長的工作放到 helper loop，用訊息通知結果'],
 ['helper loop 沒有停止的方法','actor 停了，helper loop 還在跑，程式關不掉','在 Stop Core 用 user event 或佇列通知它停（範例在 Stop Core 裡銷毀 user event）'],
 ['兩個 actor 用「送出並等待回覆」互相等','兩邊都卡住（死結）','能用一般訊息就不要等回覆'],
 ['忘了錯誤的預設是「停」','一個小錯誤讓整個系統停到 root','需要容錯的地方覆寫 Handle Error／Handle Last Ack Core'],
 ['想直接執行某個 actor 的 VI','actor 不能自己啟動自己','找 launcher（範例的 Launcher.vi）'],
 ['用一般的除錯方式','訊息是非同步的，中斷點停在一個 actor，其他的還在跑','在 Do.vi 放中斷點，一次看一則訊息；必要時加紀錄']
]),
C.h3('⑤ 2018 和 2020 以後','','學校電腦和公司電腦可能不一樣'),
`<ul><li><b>介面（interface）</b>是 LabVIEW 2020 才有的。2026 的咖啡店／Actors and Interfaces 範例用介面定義訊息；範例說明寫它「完全取代 LabVIEW 2019 以前用的抽象訊息寫法」。所以<b>2018 的 AF 程式用的是抽象訊息</b>，長得和 2026 的範例不一樣。</li>
<li>2026 存的範例 2018 打不開。學校是 2018 的話，看你那一版內附的範例。</li>
<li>AF 從 2024 年起在 GitHub 開源（ni/actor-framework，MIT 授權）；新的 2.x 版只支援 LabVIEW 2020 以後。</li>
<li>Launch 時把「打開 Actor Core 前面板」設成 T，在 Run-Time Engine（建成 EXE）會回錯誤。</li></ul>`,
C.h3('⑥ DQMH：另一個常見的框架','','知道它的存在'),
`<p>DQMH（Delacor QMH）由 DQMH Consortium 維護，免費、附原始碼，用 VIPM 安裝，支援 LabVIEW 2016 以後。它是「事件（Request／Broadcast）＋ QMH」，刻意少用物件導向，論壇上普遍認為比 AF 好上手（二手）。如果你接手的程式資料夾裡有「Module Admin」「Request」「Broadcast」這些字，多半是 DQMH。</p>`,
C.h3('⑦ 作業：在咖啡店範例裡找答案','','只讀，不用改'),
`<ol><li>在專案裡找到 Remove Customer Msg：它的 Send 和 Do 各做了什麼？Do.vi 呼叫了 Coffee Shop 的哪一個方法？</li>
<li>Coffee Shop 的 Pre Launch Init 做了什麼？為什麼這些事不放在 Actor Core？（提示：看方塊圖的註解）</li>
<li>Customer 和 Customer With Cell Phone 是什麼關係？後者多了什麼訊息？它的 Actor Core 有沒有呼叫父類別？</li>
<li>如果主管要「顯示目前店裡有幾位客人」，你會加在哪裡：新的訊息？Coffee Shop 的方法？UI 迴圈？寫下你會新增或修改哪些檔案（不用真的做）。</li></ol>`,
tip('讀碼順序（建議）','Launcher.vi → Coffee Shop 的 Actor Core → 一則訊息從 Send 到 Do 到方法 → 啟動 nested actor 的地方 → Stop Core 和 Handle Last Ack Core。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'AF 的訊息迴圈在哪裡？',o:['在父類別 Actor 的 Actor Core（框架裡），所以專案裡看不到','在 Launcher.vi','在每個 Send xxx.vi','AF 沒有訊息迴圈'],a:0,ex:'覆寫的 Actor Core 要呼叫父類別才會有訊息迴圈。'},
 {q:'Send Add Customer.vi 做什麼？',o:['做出 Add Customer Msg 物件，Enqueue 到對方的佇列','直接改 Coffee Shop 的資料','啟動一位客人','停止 Coffee Shop'],a:0,ex:'真正做事的是 Do.vi 呼叫的方法。'},
 {q:'一位客人（nested actor）出錯停止，預設會？',o:['錯誤經由 Last Ack 往上傳，Coffee Shop 也停','只有那位客人停','整間店自動重開','什麼都不會發生'],a:0,ex:'要容錯就要覆寫 Handle Last Ack Core 或 Handle Error。'},
 {q:'某個 Do.vi 裡跑了 10 秒的迴圈，這 10 秒內送 Normal Stop 會？',o:['要等那則訊息處理完、排到它才停','立刻停','被丟掉','程式當掉'],a:0,ex:'訊息一次處理一則；Emergency Stop 會插隊，但也要等正在處理的那則做完。'},
 {q:'覆寫 AF 的 Actor Core 時，Call Parent Method 應該？',o:['保留，否則沒有訊息處理','一律刪掉','換成 Launch Root Actor','換成 Enqueue'],a:0,ex:'和 H1 刪掉 Call Parent Method 的情況不同：看父類別那個方法做了什麼。'},
 {q:'LabVIEW 2018 的 AF 程式和 2026 範例的主要差別？',o:['2018 沒有介面，用抽象訊息；2026 範例用介面','完全一樣','2018 沒有 AF','2026 沒有 Do.vi'],a:0,ex:'介面是 LabVIEW 2020 才有的。'}
]}
]});
})();
