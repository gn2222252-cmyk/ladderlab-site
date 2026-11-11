/* 第八部分：接入新儀器（I8）感測器接 DAQ：沒有命令可以送
   事實出處：
   - NI USB-6009 Specifications：類比輸入 8 單端／4 差動；差動 14 位元、單端 13 位元；最高 48 kS/s（所有通道合計）；
     差動範圍 ±20、±10、±5、±4、±2.5、±2、±1.25、±1 V，單端 ±10 V；輸入阻抗 144 kΩ。
   - NI「Connecting Current Signals to a DAQ Device」：量電流要外接分流電阻；電阻乘以最大電流不能超過輸入範圍；
     4 mA 代表 0%、20 mA 代表 100%。250 Ω 是常見做法，不是該頁的原文。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='接入新儀器';
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
function flow(items){
  const one=x=>{
    if(typeof x==='string')return `<span class="fb">${x}</span>`;
    if(x.loop)return `<span class="fl"><em>${x.label||'While Loop'}</em><span class="fin">${x.loop.map(one).join('<i class="fa">→</i>')}</span>${x.sr?`<small class="fsr">Shift Register：${x.sr}</small>`:''}</span>`;
    if(x.kase)return `<span class="fc"><em>Case：${x.label}${x.pages?'（每次只走其中一頁）':''}</em><span class="fin">${x.kase.map(one).join(x.pages?'<i class="fa">或</i>':'<i class="fa">→</i>')}</span></span>`;
    return '';
  };
  return `<div class="bdflow fig">${items.map(one).join('<i class="fa">→</i>')}</div>`;
}

/* ---------- 模擬：壓力傳送器 4–20 mA → 分流電阻 → USB-6009 ---------- */
const RANGES=[20,10,5,4,2.5,2,1.25,1];
function daqLab(el){
  el.className='daqlab fig';
  let bar=3.2,broken=false,R=250,rng=10,a=1,b=0,seed=7;
  const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff-0.5;};
  el.innerHTML=`<p><label>實際壓力：<input type="range" min="0" max="10" step="0.1" value="3.2" data-k="bar"> <b class="num" data-o="bar"></b> bar</label>
   <button type="button" class="btn" data-a="brk">拔掉一條線</button></p>
   <p><label>分流電阻：<select data-k="R"><option value="250" selected>250 Ω</option><option value="500">500 Ω</option><option value="100">100 Ω</option><option value="1000">1000 Ω</option></select></label>
   <label style="margin-left:12px">DAQ 輸入範圍：<select data-k="rng">${RANGES.map(r=>`<option value="${r}"${r===10?' selected':''}>±${r} V</option>`).join('')}</select></label></p>
   <table class="t"><tr><th>傳送器送出的電流</th><th>電阻兩端的電壓</th><th>DAQ 讀到的電壓</th><th>一格是多少伏特</th></tr>
   <tr><td><b class="num" data-o="ma"></b> mA</td><td><b class="num" data-o="v"></b> V</td><td><b class="num" data-o="rd"></b></td><td><b class="num" data-o="lsb"></b> mV</td></tr></table>
   <p>你的換算：壓力 ＝ 電壓 × <input type="number" step="0.01" value="1" data-k="a" style="width:5.5em"> ＋ <input type="number" step="0.01" value="0" data-k="b" style="width:5.5em">
   ＝ <b class="num" data-o="calc"></b> bar</p><p class="verdict" data-o="verdict" aria-live="polite"></p>`;
  const q=k=>el.querySelector('[data-k='+k+']'),o=k=>el.querySelector('[data-o='+k+']');
  function draw(){
    const ma=broken?0:4+16*bar/10, v=ma/1000*R;
    const lsb=2*rng/16384, clipped=v>rng;
    const noisy=Math.min(rng,v)+rnd()*0.004;
    const rd=Math.round(noisy/lsb)*lsb;
    o('bar').textContent=bar.toFixed(1);o('ma').textContent=ma.toFixed(2);o('v').textContent=v.toFixed(3);
    o('rd').textContent=rd.toFixed(4)+' V'+(clipped?'（超出範圍，被截掉了）':'');o('lsb').textContent=(lsb*1000).toFixed(2);
    const calc=rd*a+b;o('calc').textContent=isFinite(calc)?calc.toFixed(2):'—';
    let msg;
    if(!clipped&&!broken&&0.02*R>=rng*0.98)msg='注意：20 mA 時電壓是 '+(0.02*R).toFixed(1)+' V，剛好頂到這個範圍的上限，沒有餘裕。傳送器稍微超出一點、或電阻有一點誤差，就會被截掉。選大一檔的範圍。';
    else if(clipped)msg='電阻兩端的電壓超過 DAQ 的輸入範圍。20 mA × '+R+' Ω ＝ '+(0.02*R).toFixed(1)+' V，要選包得住它的範圍，或換小一點的電阻。';
    else if(broken)msg='線斷了，電流是 0，電壓接近 0 V。正常時最低也有 4 mA（'+(0.004*R).toFixed(1)+' V）。所以電壓明顯低於這個值，就能判斷成斷線，不要把它換算成壓力。';
    else if(Math.abs(calc-bar)<0.06)msg='換算對了。再拉一拉壓力，確認整個範圍都對。';
    else msg='還不對。提示：先算 0 bar 和 10 bar 時電壓各是幾伏特，用這兩點求直線。';
    o('verdict').textContent=msg;
  }
  q('bar').oninput=e=>{bar=+e.target.value;draw();};
  q('R').onchange=e=>{R=+e.target.value;draw();};
  q('rng').onchange=e=>{rng=+e.target.value;draw();};
  q('a').oninput=e=>{a=+e.target.value;draw();};
  q('b').oninput=e=>{b=+e.target.value;draw();};
  el.querySelector('[data-a=brk]').onclick=e=>{broken=!broken;e.target.textContent=broken?'把線接回去':'拔掉一條線';draw();};
  draw();
}

L.push({id:'I08',order:29.85,no:'I8',part:PART,title:'感測器接 DAQ：沒有命令可以送',mins:55,
goals:[['學會','不會說話的設備怎麼接；電流訊號怎麼變成電壓；輸入範圍和取樣率怎麼選；電壓怎麼換算成物理量。'],['做出','壓力傳送器的接入單（量測版）、換算式和程式規劃圖。'],['為什麼','工廠裡大部分的感測器都是這一型：壓力、流量、溫度、位移、荷重。它們只給一個電壓或電流。'],['動畫練習','<a href="lab-daq.html">DAQ 實驗室</a>：取樣率、解析度、緩衝區。']],
check:'給你一顆感測器的規格（輸出範圍和對應的物理量），你能說出：怎麼接、DAQ 的範圍選哪一檔、換算式是什麼、斷線時會看到什麼。',
body:[
C.h3('情境','x','第五台：壓力傳送器'),
`<p>任務：管路上裝了一顆壓力傳送器，LabVIEW 要顯示現在的壓力並畫趨勢圖。手邊有一張 NI USB-6009 資料擷取卡。</p>`,
C.h3('第 1 步','','看它用什麼接'),
`<p>傳送器上只有兩條線，沒有任何通訊孔。規格表只有一行跟訊號有關：</p>
<p style="font:700 18px var(--mono)">輸出：4–20 mA，對應 0–10 bar</p>`,
ask('照 I1 的三個問題，它該用什麼？',
 `<p>第一題就有答案了：它<b>不會說話</b>。規格表裡沒有命令、沒有位址表、沒有鮑率。</p>
<p>它做的事只有一件：壓力越大，流過那兩條線的電流越大。你沒有任何東西可以「送」給它，它也不會「回答」。</p>
<p>所以前面七課的寫、讀、結尾字元、逾時，這裡全部用不上。你需要的是一個能把電訊號量成數字的東西，就是那張資料擷取卡。LabVIEW 這邊用 <b>DAQmx</b>。</p>`),
C.h3('第 2 步','','接入單換一張'),
`<p>對話型的設備，接入單問的是「它聽得懂什麼」。量測型的設備，接入單問的是「它給的訊號長什麼樣」：</p>`,
C.table(['要知道的事','去哪裡找','這顆傳送器'],[
 ['訊號是什麼','規格表的 Output','電流'],
 ['範圍','規格表','4 到 20 mA'],
 ['對應的物理量','規格表','4 mA 是 0 bar，20 mA 是 10 bar'],
 ['變化有多快','看你量的東西','管路壓力，一秒內變不了多少'],
 ['它自己要不要供電','接線圖','要，通常 24 V'],
 ['擷取卡能量什麼','擷取卡的規格書','USB-6009 只能量電壓']
]),
ask('傳送器給的是電流，擷取卡只會量電壓。怎麼辦？',
 `<p>讓電流流過一顆已知的電阻，電阻兩端就會有電壓，電壓 ＝ 電流 × 電阻。量那個電壓就等於量到了電流。這顆電阻叫<b>分流電阻</b>。</p>`),
ask('電阻要選多大？',
 `<p>NI 的說明只給了一個條件：<b>最大電流乘以電阻，不能超過擷取卡的輸入範圍。</b></p>
<p>最大電流是 20 mA。常見的做法是用 250 Ω：20 mA × 250 Ω ＝ 5 V，4 mA × 250 Ω ＝ 1 V。於是 4–20 mA 變成 1–5 V。</p>
<p>電阻太大會超出範圍（1000 Ω 的話最大是 20 V）；太小的話電壓範圍很窄，解析度浪費掉。下面可以自己換電阻試。</p>`),
ask('為什麼工業感測器喜歡用 4–20 mA，而不是 0–20 mA？',
 `<p>因為 0 被留下來當「出事了」。</p>
<p>正常工作時，壓力是 0 也有 4 mA。所以量到的電流如果接近 0，只有一種可能：線斷了，或傳送器沒電。</p>
<p>這跟電表的 9.9E37、溫控器的 8003H 是同一種設計：留一個正常不會出現的值，用來表示有狀況。只是這次不是寫在說明書的錯誤表裡，而是藏在訊號範圍裡。</p>`),

C.h3('懂','','怎麼接線'),
`<p>電流要流過一整圈才會有訊號，所以傳送器、電源、分流電阻要串成一個迴路：</p>
<p style="font:700 16px var(--mono)">24 V 電源的 ＋ → 傳送器 → 分流電阻 → 24 V 電源的 −</p>
<p>擷取卡量的是<b>電阻兩端</b>的電壓：電阻靠傳送器的那一端接 AI＋，靠電源負端的那一端接 AI−。NI 的說明建議把分流電阻放在靠近電源負端（接地）的這一側。</p>
<p>擷取卡的輸入有兩種接法。<b>差動</b>是量兩個端子之間的電壓差，比較不受雜訊影響，量感測器建議用這種；<b>單端</b>是量一個端子對擷取卡接地的電壓，可用的通道比較多。USB-6009 的差動通道要用哪兩個螺絲端子，照它的使用手冊上的端子圖接，不要用猜的。</p>`,
C.h3('第 3 步','','不寫程式，先看到訊號'),
`<p>對話型設備的第 3 步是「送一條命令看它回」。量測型設備的第 3 步是「先看到電壓在動」。</p>
<p>工具一樣是 NI MAX：左邊展開 Devices and Interfaces，裡面會有一個 NI USB-6009（名稱通常是 Dev1）。點它，上方按 <b>Test Panels</b>。選好通道、輸入接法（差動是 Differential）和範圍，按 Start，就會看到電壓的數字和波形。</p>
<p>這一步確認的是接線：有沒有接對端子、分流電阻有沒有裝、傳送器有沒有電。看到大約 1 到 5 V 之間的電壓，而且壓力變的時候它跟著變，就過關了。</p>`,
note('這是網頁模擬','擷取卡的位元數和範圍照 USB-6009 的規格書。雜訊大小是示意。'),
{fn:daqLab},
{todo:[
 '拉動壓力，看電流、電壓怎麼跟著變。0 bar 和 10 bar 時電壓各是多少？記下來。',
 '把分流電阻換成 1000 Ω，壓力拉到 10 bar。會看到什麼？換回 250 Ω。',
 '把輸入範圍從 ±10 V 改成 ±5 V。「一格是多少伏特」怎麼變？壓力拉到 10 bar 時，下面的提示說什麼？做完改回 ±10 V。',
 '用剛才記下的兩個點，算出換算式的兩個數字填進去，讓算出來的壓力跟實際的一樣。',
 '按「拔掉一條線」。你的換算式算出幾 bar？這個數字可以相信嗎？'
]},

C.h3('第 4、5 步','','看原始資料，換算成壓力'),
ask('這次的原始資料是什麼型別？',
 `<p>DAQmx Read 給你的直接就是 <b>DBL</b>，單位是伏特。不是字串，不用切、不用轉型別。</p>
<p>但它還不是你要的。你要的是 bar，手上是伏特。型別對了，<b>單位</b>還沒對。</p>`),
ask('伏特怎麼變成 bar？',
 `<p>規格表說訊號和壓力是直線關係。直線由兩個點決定，這兩個點規格表都給了：</p>
<ul><li>4 mA，也就是 1 V，是 0 bar。</li><li>20 mA，也就是 5 V，是 10 bar。</li></ul>
<p>電壓每增加 4 V，壓力增加 10 bar，所以斜率是 10 ÷ 4 ＝ 2.5。1 V 的時候要等於 0，所以是：</p>
<p style="font:700 18px var(--mono)">壓力 ＝ 2.5 × 電壓 − 2.5</p>
<p>任何「輸出 A 到 B 對應 C 到 D」的感測器，都是同一個算法：找出兩個點，求斜率和截距。在 LabVIEW 裡就是一個乘法和一個加法。DAQmx 也可以建一個 Custom Scale，讓 Read 直接回 bar，道理一樣。</p>`),
ask('拔掉線以後，換算式算出 −2.5 bar。該怎麼處理？',
 `<p>壓力不會是負的 2.5 bar。這是 0 V 套進換算式的結果，而 0 V 代表斷線。</p>
<p>所以換算以前先判斷：電壓明顯低於 1 V（例如低於 0.8 V），就走「斷線」那一頁，顯示警告，不畫到圖上。又是 <b>Case</b>，理由跟前面每一台一樣：同一個讀值有兩種意思。</p>`),

C.h3('懂','','兩個要自己決定的設定'),
ask('輸入範圍選哪一檔？',
 `<p>擷取卡把輸入範圍切成固定的格數。USB-6009 用差動接法是 14 位元，也就是 16384 格。範圍 ±10 V 的話，20 V 分成 16384 格，一格大約 1.2 mV；範圍 ±5 V，一格大約 0.6 mV。</p>
<p>範圍越小，格子越細，量得越精細。但範圍要包得住訊號，不然超出的部分會被截掉。</p>
<p>所以原則是：<b>選包得住訊號、而且留一點餘裕的最小範圍</b>。</p>
<p>訊號是 1 到 5 V，±5 V 看起來剛好。但「剛好」就是問題：傳送器在超壓時會送出比 20 mA 再多一點的電流，電阻也有誤差，電壓一超過 5 V 就被截掉，而且看不出來。所以這裡選 <b>±10 V</b>，一格 1.2 mV，換成壓力大約是 0.003 bar，對量管路壓力綽綽有餘。</p>
<p>如果真的需要更細，正確的做法是換小一點的電阻（例如 200 Ω，最大 4 V）再用 ±5 V，而不是讓訊號頂到滿刻度。</p>`),
ask('一秒要讀幾次？',
 `<p>問訊號本身：它變化多快？</p>
<p>管路壓力一秒內變不了多少，一秒讀 10 次已經很夠。這張卡最快可以每秒 48000 次，但讀那麼快只會得到一大堆幾乎一樣的數字。</p>
<p>反過來，如果量的是震動或聲音，訊號一秒變化幾千次，就要讀得比它快很多才看得到波形。取樣率是照「訊號多快」選的，不是照「卡片多快」。想看取樣太慢會發生什麼事，到 <a href="lab-daq.html">DAQ 實驗室</a>。</p>
<p>另一個常見的做法：一次讀 100 點取平均，可以把雜訊壓下來。這時候 Read 回來的是陣列，接一個 Mean 就好。</p>`),

C.h3('第 6 步','','規劃程式：形狀你已經看過了'),
`<p>DAQmx 的函式在 ${fn('Measurement I/O','NI-DAQmx')}（選盤的標題是 DAQmx - Data Acquisition）。DAQmx 把「量哪個通道、怎麼量」這一整組設定叫做一個<b>任務</b>（Task）。任務那條線的角色，跟 VISA 的資源線一樣：建立一次，從頭串到尾，最後清掉。先看函式的順序：</p>`,
flow(['Create Virtual Channel（AI 電壓、範圍 ±10 V、差動）','Start Task',{loop:['Read','判斷斷線','換算成 bar','顯示、畫圖','等 100 ms'],label:'While Loop',sr:'error'},'Stop Task','Clear Task','顯示錯誤']),
ask('這張圖跟電源那一課的圖，像不像？',
 `<p>幾乎一樣。迴圈外建立、迴圈內讀、迴圈外清掉；一條任務線和一條 error 線從頭串到尾；error 進 Shift Register；讀到的值先判斷能不能用，再換算。</p>
<p>因為你問的是同一組問題：這件事每次都要做嗎？會失敗嗎？讀到的值有幾種意思？多久讀一次？問題一樣，骨架就一樣。</p>`),
C.table(['','對話型（VISA）','量測型（DAQ）'],[
 ['先確認什麼','送命令有回覆','看得到電壓在動'],
 ['用什麼工具先試','NI MAX 的 VISA Test Panel','NI MAX 的 Test Panels'],
 ['原始資料','字串或位元組','電壓（DBL）'],
 ['要做的轉換','切字串、轉型別','換算單位'],
 ['「有狀況」長什麼樣','錯誤值、錯誤佇列、逾時','訊號跑到正常範圍外面'],
 ['讀取速度由誰決定','儀器多久能回、資料多久更新','訊號變化有多快'],
 ['程式骨架','開 → 迴圈（寫、讀）→ 關','建立 → 迴圈（讀）→ 清除']
]),

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'一顆只有兩條線、規格寫「輸出 4–20 mA」的傳送器，為什麼不能用 VISA？',o:['它不會說話，沒有命令可以送，只能量它的訊號','VISA 太慢','它需要 TCP','VISA 不支援電流'],a:0,ex:'I1 的第一個問題：它自己會說話嗎？'},
 {q:'擷取卡只能量電壓，傳送器輸出 4–20 mA。用 250 Ω 的分流電阻，量到的電壓範圍是？',o:['1 到 5 V','4 到 20 V','0.25 到 2.5 V','0 到 10 V'],a:0,ex:'電壓＝電流×電阻。0.004×250＝1，0.02×250＝5。'},
 {q:'選分流電阻時，NI 說明裡唯一的硬性條件是？',o:['最大電流乘以電阻，不能超過擷取卡的輸入範圍','一定要 250 Ω','越大越好','要跟線一樣長'],a:0,ex:'超出範圍的電壓會被截掉。'},
 {q:'1 V 對應 0 bar，5 V 對應 10 bar。量到 3 V 是幾 bar？',o:['5','3','7.5','2.5'],a:0,ex:'壓力＝2.5×電壓−2.5。3 V 剛好在中間。'},
 {q:'量到 0.02 V。最合理的判斷是？',o:['斷線或傳送器沒電。正常最低也有 1 V','壓力是 −2.45 bar','壓力是 0 bar','擷取卡壞了'],a:0,ex:'4–20 mA 把 0 留給「出事了」。'},
 {q:'訊號是 1 到 5 V。USB-6009 的輸入範圍該選？',o:['±10 V：包得住訊號，而且有餘裕','±5 V：剛好等於訊號的最大值','±1 V：格子最細','±20 V：越大越好'],a:0,ex:'±5 V 沒有餘裕，稍微超出就被截掉。±20 V 的格子白白變粗一倍。'},
 {q:'量管路壓力，取樣率設每秒 48000 次。結果會？',o:['得到一大堆幾乎相同的數字，沒有比較準','比較準','擷取卡會壞','壓力會變'],a:0,ex:'取樣率照訊號變化多快來選。'}
]}
]});
})();
