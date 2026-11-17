/* 高階實務 H4：儀器抽象層（用類別）。換一台不同廠牌的儀器，主程式不用改。
   證據（docs/research_advanced.md）：S09「理解並修改 LabVIEW 物件導向架構的軟體」；資深職缺的「架構與模組設計」；P02「沒有 NI 硬體時整合會有陣痛」。
   實測（labview_vi/_build/probe_factory.py，LabVIEW 2026，用 NI 範例 Dynamic Dispatching 的複製品）：
   Get LV Class Default Value.vi 依路徑載入 Square／Triangle，To More Specific Class 轉成 Shape，動態分派的 Identify.vi 回傳各自的名稱；
   路徑不存在 → Get LV Class Default Value 回錯誤 7，但後面的 Identify 照樣執行，跑的是 Shape（父類別）的版本；
   載入不屬於 Shape 家族的類別（Board Testing 的 Resistor）→ To More Specific Class 回錯誤 1448。
   各廠牌命令、IVI、建置 EXE 的說法來自 docs/research_hal.md（助理整理，附出處）。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='高階實務';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary><div class="ans">${a}</div></details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
if(!LV.F['Get LV Class Default Value'])LV.F['Get LV Class Default Value']={g:'📄→\n▣',ins:['class path','error in'],outs:['object','error out'],w:44,h:50,pal:['Functions','Programming','Cluster, Class & Variant','Get LV Class Default Value']};
if(!LV.F['To More Specific Class'])LV.F['To More Specific Class']={g:'▣→\n▣?',ins:['target class','reference','error in'],outs:['specific class reference','error out'],w:44,h:50,pal:['Functions','Programming','Application Control','To More Specific Class']};

/* ---- 一步一步寫：依設定載入電源的類別 ---- */
const CHOICES=[
 {t:'PSU_BrandA.lvclass（A 廠電源）',ok:1,name:'PSU_BrandA'},
 {t:'PSU_BrandB.lvclass（B 廠電源）',ok:1,name:'PSU_BrandB'},
 {t:'PSU_Sim.lvclass（模擬電源，沒有硬體時用）',ok:1,name:'PSU_Sim'},
 {t:'PSU_BrandC.lvclass（打錯字，檔案不存在）',err:7},
 {t:'DMM_BrandA.lvclass（存在，但不是電源家族）',err:1448}
];
const fv={name:'Load PSU.vi',view:'split',ratio:1.7,
 fp:{w:340,h:220,items:[
  {id:'cfg',k:'enum',ctl:true,label:'station.ini 寫的類別（模擬用）',options:CHOICES.map(c=>c.t),x:12,y:8,v:0},
  {id:'nm',k:'str',label:'Get Name 回傳',x:12,y:70,w:300},
  {id:'eo',k:'err',label:'error out',x:12,y:120}]},
 bd:{w:900,h:260,
  nodes:[
  {id:'cp',k:'ctl',t:'path',label:'class path（從設定檔讀）',x:10,y:40},
  {id:'g',k:'fn',fn:'Get LV Class Default Value',x:200,y:30},
  {id:'kc',k:'const',t:'obj',v:'PSU',label:'PSU（父類別）常數',x:230,y:140},
  {id:'tm',k:'fn',fn:'To More Specific Class',x:380,y:60},
  {id:'gn',k:'sub',name:'Get Name.vi（動態）',top:'PSU',icon:['ID?'],color:'#a33b3b',ins:['PSU in'],outs:['PSU out','name'],err:true,x:560,y:56,w:56,h:56},
  {id:'nm',k:'ind',t:'str',label:'Get Name 回傳',x:760,y:66},
  {id:'eo',k:'ind',t:'err',label:'error out',x:760,y:150}],
  wires:[
  {id:'w1',from:'cp',to:'g.class path',t:'path'},
  {id:'w2',from:'g.object',to:'tm.reference',t:'obj',mx:330},
  {id:'w3',from:'kc',to:'tm.target class',t:'obj',mx:340},
  {id:'w4',from:'g.error out',to:'tm.error in',t:'err',mx:350},
  {id:'w5',from:'tm.specific class reference',to:'gn.PSU in',t:'obj',mx:500},
  {id:'w6',from:'tm.error out',to:'gn.error in',t:'err',mx:510},
  {id:'w7',from:'gn.name',to:'nm',t:'str',mx:700},
  {id:'w8',from:'gn.error out',to:'eo',t:'err',mx:720}]},
 sim:{init:()=>({}),
  step(inp){
   const c=CHOICES[+inp.cfg||0];
   if(c.ok)return {out:{nm:c.name,eo:{status:false,code:0,source:''}},vals:{'g.object':c.name,'tm.specific class reference':c.name},
     msg:`載入 ${c.name}，轉成 PSU 型別的線（線上跑的還是 ${c.name}），Get Name 執行 ${c.name} 的版本。主程式之後呼叫的 Set Voltage、Output…也都會是 ${c.name} 的版本。`};
   if(c.err===7)return {out:{nm:'PSU',eo:{status:true,code:7,source:'Get LV Class Default Value.vi'}},vals:{'g.object':'（預設的 LabVIEW Object）'},
     msg:'找不到檔案：Get LV Class Default Value 回錯誤 7。載入失敗不會讓程式自己停：後面的 Get Name 照樣被呼叫，呼叫到的是父類別 PSU 的版本（LadderLab 用 NI 範例實測過）。這個模擬的 Get Name 沒有看 error in，所以還回了「PSU」；如果你的方法照 I10 的寫法（error in 有錯就不做事），錯誤會一路傳到 error out。不管哪一種，主程式都要看到這個錯誤就停下來。'};
   return {out:{nm:'PSU',eo:{status:true,code:1448,source:'To More Specific Class'}},vals:{'g.object':'DMM_BrandA'},
     msg:'類別載得進來，但它不是 PSU 的子類別：To More Specific Class 回錯誤 1448。設定檔寫錯成別的儀器時就是這個錯。'};},
  doneMsg:'換設定檔裡的類別再 Run'}
};

L.push({id:'H4',order:43,no:'H4',part:PART,title:'儀器抽象層：換一台不同廠牌的電源，主程式一行都不用改',mins:80,files:[],
goals:[['學會','先分清楚「各廠牌一樣的」和「不一樣的」；用父類別定義儀器能做的事、每個廠牌一個子類別；用設定檔決定執行時載入哪一個類別（Get LV Class Default Value + To More Specific Class）；做一個模擬儀器的類別，沒有硬體也能開發；載入失敗時怎麼擋；建置 EXE 時要注意什麼'],
 ['工作上','採購換廠牌、某台儀器停產、兩條線用不同廠牌的電源：這種事在產線很常見。沒有抽象層，每次都要改主程式、重新驗證；有了抽象層，只加一個子類別'],
 ['用到','H1（類別、動態分派）、I5（SOCKET 的結束字元）、I10（把儀器包成驅動、儀器錯誤變成 LabVIEW 錯誤）、W6（測試站）、W19（設定檔放 ProgramData）']],
check:'不看課文，能說出：父類別該放哪些方法、哪些東西不該放進去；設定檔裡的類別寫錯時會發生什麼、怎麼擋；為什麼要有模擬儀器的類別；建置 EXE 時動態載入的類別要怎麼處理。',
body:[
C.h3('這一課的工作','x','採購說：「下一批電源換牌子」'),
`<p>W6 的測試站用 A 廠的電源，程式裡到處都是 A 廠的命令。採購說 A 廠交期要 16 週，下一批 4 台換成 B 廠，價格也比較便宜；而舊的 6 台還是 A 廠。主管問你：「程式要改多久？兩種電源能不能同時用？」</p>
<p>這一課的做法：主程式只認一個「電源」父類別，每個廠牌一個子類別；哪一台站用哪一個，寫在那台的設定檔裡。</p>`,
note('為什麼有這一課（資料來源）','NI 出版的測試架構資料列出沒有抽象層時的問題：儀器停產或更換時，每一個呼叫它的步驟都要改，軟體也要等硬體定案才寫得完。台灣資深職缺寫「軟體架構規劃與模組設計」「理解並修改 LabVIEW 物件導向架構的軟體」；PTT 上從業 12 年的人提到，沒有用 NI 的硬體時，整合會有一段陣痛期。目前沒有找到明寫「換儀器」的台灣職缺，所以這一課的動機以 NI 的資料為主。整理在 docs/research_advanced.md、docs/research_hal.md。'),
C.h3('① 先比較：三家電源，同一件事怎麼說','','動手前先查手冊'),
`<p>要做抽象層，第一步不是開 LabVIEW，是把手冊攤開比較。下表是助理從三家電源的程式手冊查到的命令（頁碼在 docs/research_hal.md；RIGOL 和 GW 是經銷商轉放的原廠手冊）：</p>`,
C.table(['要做的事','Keysight E36100B','RIGOL DP800','GW Instek GPD-X303S'],[
 ['設定電壓','<code>VOLT 5</code>（SCPI 樹狀命令）','<code>:VOLT 5</code>；多通道機型，有些命令要帶通道（CH1～CH3）','<code>VSET1:5.0</code>（1 是通道）'],
 ['一次設電壓和電流','<code>APPL 5,1</code>','<code>:APPL CH1,5,1</code>','沒有；分別用 VSET、ISET'],
 ['開輸出','<code>OUTP ON</code>','<code>:OUTP CH1,ON</code>','<code>OUT1</code>'],
 ['量輸出電壓','<code>MEAS:VOLT?</code>','<code>:MEAS? CH1</code>','<code>VOUT1?</code>'],
 ['讀錯誤','<code>SYST:ERR?</code>','<code>:SYST:ERR?</code>','<code>ERR?</code>'],
 ['<code>*RST</code> 會不會清錯誤佇列','不會（*CLS 才清）','會','手冊的命令清單沒有 *RST']
]),
ask('Keysight 和 RIGOL 都是 SCPI，GW 不是。那用 SCPI 的儀器是不是就能直接互換？',`<p>不能。SCPI 標準自己就寫明「不保證完全互換」：它規定命令和回應長什麼樣子，但不規定功能、準確度、解析度、接頭這些真正互換需要的東西。從表上就看得到：RIGOL 是多通道機型，命令要帶 CH1；同一個 <code>*RST</code>，Keysight 不清錯誤佇列、RIGOL 會清。如果你的程式在 Keysight 上靠「下 *RST 之後錯誤佇列還在」來檢查，換到 RIGOL 就錯了。</p><p>GW 的 GPD 根本不是 SCPI（課程的軟儀器模擬的就是它，I2～I4 用過）。所以<b>差異一定要包在某個地方</b>，這就是抽象層的工作。</p>`),
C.h3('② 包在哪裡：四種做法','','NI 的資料把它分成四種'),
`<p>NI 出版的一份測試架構資料（作者是系統整合商 Bloomy）把「怎麼面對不同儀器」分成四種做法：</p>`,
C.table(['做法','內容','適合'],[
 ['1. 各儀器自己的驅動','最常見、最少規劃；換儀器時，驅動和所有呼叫它的地方都要改','只有一種儀器、不會換'],
 ['2. 現成的抽象','IVI 類別驅動、廠商的系列驅動（NI-DMM、NI-DCPower…）','儀器都支援同一套 IVI 或同一家的系列驅動'],
 ['3. 自己的框架＋設定檔','HAL（儀器的角度）＋ MAL（待測物的角度）＋讀設定檔的對應層','多種儀器、多條產線、長期維護'],
 ['4. 外掛（plugin）','子類別和主程式分開放，執行時才載入；加新儀器不用重新部署整個程式','要常常加新儀器']
]),
note('NI 那份資料的建議','「從簡單開始，保持可擴充，能用現成的抽象就用。」越抽象，前期規劃和開發越多；框架規劃不好本身就是風險。資料裡也有工時估計（例如換平台時，沒有框架每個序列要 40～80 小時），那是作者的估計，不是量測數據。'),
`<p>這一課做的是 <b>3 和 4 的小版本</b>：一個電源父類別、每個廠牌一個子類別、設定檔指定要載入哪一個。下面的「HAL」就是指這一層。</p>`,
C.h3('③ 設計父類別','','決定「電源能做什麼」'),
`<p>父類別 PSU 定義每一台電源都要會的事；它的方法本身是空的（或只做共通的檢查），給子類別覆寫。和 H1 的 Component 一樣。</p>`,
C.table(['PSU 的方法（動態分派）','PSU_GPD（課程的軟儀器）','PSU_Keysight','PSU_Sim（沒有硬體時）'],[
 ['Initialize（VISA 資源、通道）','開 VISA；<b>打開結束字元</b>（SOCKET 預設沒開，不開的話 Read 會等到逾時，I5）；記住通道','開 VISA；清錯誤佇列（*CLS）','不開任何東西'],
 ['Get Name','回 <code>GPD</code>','回 <code>Keysight E36100B</code>','回 <code>Sim</code>'],
 ['Set Voltage（V）','<code>VSET1:5.000</code>','<code>VOLT 5.000</code>','記住設定值'],
 ['Set Current Limit（A）','<code>ISET1:1.000</code>','限流的命令助理沒有查到，請查該機型手冊','記住設定值'],
 ['Output（開／關）','<code>OUT1</code>／<code>OUT0</code>（GPD 的 OUT1 兩個通道一起開）','<code>OUTP ON</code>／<code>OUTP OFF</code>','記住狀態'],
 ['Measure Voltage','<code>VOUT1?</code>，回 <code>5.000V</code> 這種：數字後面帶單位，要自己去掉；軟儀器有約 ±0.001 V 的雜訊','<code>MEAS:VOLT?</code>（回應的格式請查手冊）','輸出開著就回設定值加一點雜訊，關著回 0'],
 ['Check Errors','<code>ERR?</code>，回文字；沒錯時是 <code>No Error.</code>','<code>SYST:ERR?</code>，回 <code>代碼,"訊息"</code>，讀到代碼 0 為止','永遠沒有錯誤（也可以做成能「注入」錯誤）'],
 ['Close','關輸出、關 VISA','關輸出、關 VISA','什麼都不做']
]),
ask('Measure Voltage 一定要放在父類別嗎？',`<p>這是設計決定，不是標準。IVI 的電源類別（IviDCPwr）把「量測輸出」放在<b>延伸</b>群組：不是每一台電源都必須支援。我們的測試站（W6）一定要量，所以規定「能接上這個測試站的電源都要會量」，這是<b>我們自己的規定</b>；萬一買到一台不能量的，就要另外用 DMM 量，主程式要能處理。</p><p>父類別放進去的每一個方法，都是對未來所有電源的要求：放太多，新的電源做不到；放太少，主程式又要知道是哪一台。</p>`),
ask('RIGOL 是多通道機型，Keysight 這台只有一個。通道號碼該放哪裡？',`<p>放在設定檔，在 Initialize 時交給子類別記住；之後的 Set Voltage、Output 都不帶通道號碼。主程式只知道「這一站的電源」，不知道它是第幾個通道。單通道的子類別就忽略它。</p><p>也有例外要寫清楚：GPD 的 OUT1 是兩個通道一起開，所以「通道」對它的 Output 沒有作用。這種廠牌的限制要寫在子類別的說明裡。</p>`),
`<p><b>PSU_Sim 很重要。</b>有了它，沒有電源也能開發和測主程式；之後寫單元測試時，也可以用它做出「量到 4.85 V」「回錯誤」這些實機很難故意做出來的情況。</p>`,
C.h3('④ 執行時載入：哪一站用哪一個','','設定檔寫類別'),
`<p>每一台站的設定檔（W19：放在 ProgramData）多一段：</p>
<pre style="background:#f4f6f9;padding:8px;border-radius:4px">[PSU]
class = PSU_GPD.lvclass
resource = TCPIP0::127.0.0.1::5561::SOCKET
channel = 1</pre>
<p>主程式讀到 class，組出路徑，載入那個類別：</p>`,
{steps:{title:'Load PSU.vi：設定檔說用哪一個，就載入哪一個',lv:fv,steps:[
 {t:'從路徑載入類別',view:'split',add:['cfg','cp','g','w1'],h:`<p>class path 是從那台站的設定檔讀出來的（W19：放在 ProgramData）。Get LV Class Default Value.vi（在 Cluster, Class & Variant 選盤）把那個類別載入記憶體，輸出它的預設物件。輸出的型別是最上層的 LabVIEW Object。</p>`},
 {t:'轉成電源的型別',view:'split',add:['kc','tm','w2','w3','w4'],h:`<p>To More Specific Class 把 LabVIEW Object 轉成 PSU 型別的線，target class 接一個 PSU 父類別的常數。線的型別變成 PSU，線上跑的還是 B 廠或 A 廠的物件。如果載入的不是 PSU 的子類別，這裡會出錯。</p>`},
 {t:'之後只呼叫父類別的方法',view:'split',add:['gn','w5','w6','nm','w7','eo','w8'],h:`<p>Get Name 是 PSU 的動態分派方法，執行時跑的是載入的那個子類別的版本。主程式從這裡開始只用 PSU 的方法：Initialize、Set Voltage、Output…，完全不知道是哪一個廠牌。</p>`},
 {t:'Run',view:'split',add:[],h:`<p>五種設定各 Run 一次，特別看「打錯字」那一種：錯誤之後 Get Name 還是被呼叫了。</p>`}
]}},
warn('載入失敗一定要停','分兩層說。<b>第一層（LadderLab 用 NI 範例實測過）</b>：路徑錯時 Get LV Class Default Value 回錯誤 7，但程式不會自己停，後面的動態分派 VI 照樣被呼叫，呼叫到的是父類別的版本。<b>第二層</b>：如果方法沒有檢查 error in、或錯誤線沒有一路串到底，父類別的空方法什麼都不做也不報錯，測試站就會「好像在跑」，其實沒有送任何命令給電源。所以兩件事都要做：每個方法照 I10 的寫法（error in 有錯就不做事、原樣傳出），主程式在載入之後檢查錯誤，顯示「設定檔的電源類別錯誤」並停下來，不能開始測。'),
C.h3('⑤ 延伸閱讀：HAL、MAL 和 IVI','','第一次讀可以先跳過'),
`<details><summary style="cursor:pointer"><b>HAL 和 MAL：主程式還是要知道「電源」</b></summary><p>NI 那份資料分兩層：</p>
<ul><li><b>HAL（硬體抽象層）</b>：從<b>儀器</b>的角度。「這一站的電源，設 5 V、開輸出」。這一課做的就是它。</li>
<li><b>MAL（量測抽象層）</b>：從<b>待測物</b>的角度。「量 UUT 的 5V_Rail」，它自己決定要切哪個開關、用哪台 DMM、哪個檔位，可能動用好幾台儀器。</li></ul>
<p>只有 HAL 時，主程式（或 TestStand 的序列，H2）還是用「電源」「DMM」寫：換<b>同一種</b>儀器的廠牌，主程式不用改；但如果把「用電源量電壓」改成「用 DMM 量」，主程式還是要改。要做到後者，就要再往上做 MAL 和對應設定。先從 HAL 開始，需要時再加。</p></details>
<details><summary style="cursor:pointer"><b>IVI：現成的抽象層</b></summary><ul><li>IVI Foundation 定義了儀器類別（IviDmm、IviDCPwr…）的標準 API。廠商提供「類別相容」的驅動，你在 MAX 設一個<b>邏輯名稱</b>（Logical Name），指到某一台儀器的驅動和位址；程式只用邏輯名稱和類別 API。換儀器時改 MAX 的設定，不改程式。</li>
<li>限制：每一家儀器都要裝自己的 IVI 驅動，還要裝 IVI 的共用元件（LabVIEW 這邊通常是 NI IVI Compliance Package）；<b>延伸群組可以不實作</b>，所以不同廠牌支援的功能不一樣；IVI 也只規定 API，行為細節還是各家不同。</li>
<li>和這一課的關係：IVI 是上面的「做法 2」，自己寫類別是「做法 3、4」。你的儀器都有好用的 IVI 驅動，就先用它；沒有（例如 GPD 這種非 SCPI 的便宜電源）或要更貼近自己測試站的介面，就自己寫。</li></ul></details>`,
C.h3('⑥ 建成 EXE：動態載入的類別會「不見」','','W19 部署時一定會遇到'),
C.table(['問題','原因','做法'],[
 ['EXE 裡 Get LV Class Default Value 回錯誤 7','類別是執行時才用路徑載入的，建置工具看不出主程式需要它，<b>不會自動包進去</b>；EXE 裡的路徑也和開發環境不同','把每一個子類別加到建置規格 Source Files 的 <b>Always Included</b>；不要寫死開發電腦的路徑。EXE 裡類別的實際路徑怎麼寫，建置後一定要在 EXE 裡實際跑一次確認（有一說 Always Included 的檔案會編進 EXE 裡面，只是社群的說法）'],
 ['網路上的舊範例用「開類別的參考（class refnum，不是 F 部分的檔案 refnum）、取預設物件」','類別參考在 Run-Time Engine 不支援','用 Get LV Class Default Value'],
 ['想用 Get LV Class Default Value By Name','它要求類別已經在記憶體裡（NI 社群的說法）','用路徑的版本；或先確定類別已載入']
]),
warn('出處的強度','「動態載入的 VI 要加 Always Included」是 NI 建置手冊寫的（目前只讀到搜尋摘要）；「動態載入的類別也要加」出自 NI 知識庫的錯誤 7／1498 文章（搜尋摘要）和社群，手冊沒有逐字寫。LadderLab 沒有實際建置 EXE 測過這一點：做 W19 的部署驗收時（乾淨電腦上實際跑一次），一定要換一個類別跑跑看。'),
C.h3('⑦ 作業','','兩段，先熟悉機制，再做電源'),
`<p><b>A. 先用 NI 的範例試機制（約 20 分鐘）</b>：Help ▸ Find Examples 找 Dynamic Dispatching，把整個資料夾複製出來。新增一支 VI：</p>
<ol><li>放 Get LV Class Default Value.vi，class path 建成控制項。</li>
<li>從專案視窗把 Shape.lvclass 拖到方塊圖上，就是一個 Shape 類別常數。再放 Shape 的 Identify.vi。</li>
<li>放 To More Specific Class：target class 接 Shape 常數，reference 接載入的物件，輸出接 Identify 的 Shape in。error 線一路串起來，接到 error out。在 Identify 的 Class name 輸出上建一個顯示器。</li>
<li>分別選 Square.lvclass、Triangle.lvclass、一個不存在的路徑、另一個範例的類別（例如 H1 用的 Board Testing 裡的 Resistor.lvclass），各 Run 一次。</li></ol>
<p>LadderLab 實測的結果：Square、Triangle 各回自己的名稱；路徑錯 → 錯誤 7，<b>Identify 照樣回了 Shape</b>；別的家族的類別 → 錯誤 1448。你的結果應該一樣。</p>
<p><b>B. 電源抽象層（約 2～3 小時，可以分兩次做）</b></p>
<ol><li><b>建父類別</b>：專案視窗 My Computer 按右鍵 ▸ New ▸ Class，命名 PSU。私有資料（類別的 .ctl）先放：VISA resource、channel。</li>
<li><b>建方法</b>：PSU 按右鍵 ▸ New ▸ VI from Dynamic Dispatch Template，做出 ③ 表上的每一個方法（Initialize、Get Name、Set Voltage、Set Current Limit、Output、Measure Voltage、Check Errors、Close）。每個方法都有 PSU in／PSU out、error in／error out；父類別的內容先留空（只把 PSU in、error in 原樣接到輸出）。</li>
<li><b>建 PSU_Sim</b>：New ▸ Class，Properties ▸ Inheritance 把父類別改成 PSU。它的私有資料放：設定電壓、輸出開關。對每個方法 New ▸ VI for Override；產生的 VI 裡如果有 Call Parent Method，PSU 的版本是空的，可以刪掉。Set Voltage 把值存進私有資料（Unbundle／Bundle），Measure Voltage 從私有資料拿值、加一點亂數。</li>
<li><b>物件線要一路串下去</b>：PSU_Sim「記得」設定值，靠的是方法把改過的物件從 PSU out 傳出來。主程式裡物件線要從 Initialize 一路接到 Close；放在迴圈裡就要用 Shift Register，否則下一圈拿到的是舊的物件。</li>
<li><b>建 PSU_GPD</b>：同樣繼承 PSU，覆寫每個方法。先啟動課程的軟儀器（照 softinst 資料夾的 README，在命令列跑 <code>soft_instruments.py</code>），GPD 在 5561 埠。Initialize 用 VISA Open，<b>記得打開結束字元</b>（I5）。命令照 ③ 的表；命令超過 15 個字元會被拒收（只有 ERR? 問得到）。Check Errors 把 ERR? 回的文字照 I10 的寫法變成 LabVIEW 錯誤（不是 No Error. 就產生錯誤）。</li>
<li><b>主程式</b>：用 Config File VIs 讀設定檔的 [PSU] 段（W11、W19），用 Build Path 把類別檔名接在類別資料夾後面，接進 ④ 的 Load PSU.vi。之後只用 PSU 的方法：上電 → 設 5 V、限流 1 A → 開輸出 → 量電壓 → 關輸出。</li>
<li><b>驗收</b>：改設定檔的 class，在 PSU_Sim 和 PSU_GPD 之間切換，主程式一行都不改；故意把 class 打錯，確認程式停下來並說明原因；把軟儀器關掉，確認 PSU_GPD 回錯誤、不會判成 PASS。</li></ol>`,
tip('完成的樣子','換設定檔、重開程式，量到的電壓從「設定值加雜訊」（Sim）變成軟儀器回的值（GPD，約 5.000 V）；主程式的方塊圖兩次完全一樣。有 Keysight 或 RIGOL 實機的人，照 ① 的表再加一個子類別。'),
warn('這份作業沒有參考答案','LabVIEW 類別無法用 LadderLab 的自動化工具建立，所以 B 沒有可下載的參考 VI；載入類別的機制（④、作業 A）是實測過的。選單名稱各版本可能不同，以你的 LabVIEW 為準，並請回報給我們。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'兩台電源都支援 SCPI，換廠牌時程式？',o:['不一定能直接用：SCPI 不保證完全互換，通道、預設行為可能不同','一定可以直接用','一定要重寫','只要改 VISA 位址'],a:0,ex:'SCPI 標準自己寫明不保證完全互換。'},
 {q:'設定檔裡的類別路徑打錯，Get LV Class Default Value 回錯誤 7，後面的動態分派 VI 會？',o:['照樣被呼叫，呼叫到的是父類別的版本','程式自動停止','跑最後一個子類別的版本','LabVIEW 當掉'],a:0,ex:'LadderLab 用 NI 範例實測過。方法有檢查 error in 的話錯誤會傳到最後，但程式不會自己停，主程式要自己停下來。'},
 {q:'載入的類別存在、但不是 PSU 的子類別，哪裡會出錯？',o:['To More Specific Class（錯誤 1448）','Get LV Class Default Value','完全不會出錯','VISA Open'],a:0,ex:'轉型失敗。'},
 {q:'為什麼要做 PSU_Sim？',o:['沒有硬體也能開發、測主程式，也能做出實機難做的錯誤情況','比較快','產線用它','IVI 規定的'],a:0,ex:'之後寫單元測試會用到。'},
 {q:'動態載入的子類別，建成 EXE 時要？',o:['加到建置規格的 Always Included，建好後在 EXE 裡實際跑一次','什麼都不用做','放在桌面','改用類別參考（class refnum）'],a:0,ex:'建置工具看不出主程式需要它；類別參考在 Run-Time Engine 不支援。'},
 {q:'HAL 和 MAL 的差別？',o:['HAL 從儀器的角度（電源設 5 V），MAL 從待測物的角度（量 5V_Rail）','完全一樣','MAL 是 IVI 的別名','HAL 只能用在 TestStand'],a:0,ex:'只有 HAL 時，主程式還是要知道用哪一種儀器。'},
 {q:'IVI 類別驅動的限制是？',o:['延伸功能可以不實作，各家支援不同；每家都要裝驅動','沒有限制','只能用 NI 的儀器','不能用在 LabVIEW'],a:0,ex:'IVI 只規定 API，延伸群組是選用的。'}
]}
]});
})();
