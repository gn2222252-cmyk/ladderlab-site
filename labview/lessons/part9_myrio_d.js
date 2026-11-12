/* 第九部分：myRIO（M08～M12）：I2C／SPI／UART、時序與電腦端、獨立執行、FPGA 入門、綜合專案。
   myRIO 事實：NI myRIO-1900 User Guide and Specifications（I2C 在 MXP DIO14／15、2.1 kΩ 上拉、400 kHz；SPI 在 DIO5～7、4 MHz，腳位表沒有 CS；
   UART 每個 MXP 一組、電氣上跟 DIO 一樣（3.3 V）、最高 230,400 bps；安全模式時 MXP A 的 UART 是 115200-8-N-1）。
   獨立執行：NI RIO Developer Essentials Guide（Real-Time Application 建置規格、選 startup VI、Build、Run as startup、重開機；
   檔案在 /home/lvuser/natinst/bin/startup.rtexe；NI MAX 或 172.22.11.2 可以 Disable RT Startup App）。
   FPGA：default personality 搭配 Express VI；High Throughput personality 是另一個選擇；自訂 FPGA 要 LabVIEW FPGA Module；
   Set Custom Bitfile 要在 Open FPGA VI Reference 之後馬上呼叫（NI 教學）。
   MPU-6050 的位址與暫存器（0x68、0x75、0x6B、0x3B）是元件規格書的內容；Timed Loop、RT FIFO、Shared Variable、Network Stream 是 LabVIEW Real-Time 的通用知識。 */
(function(){
const L=window.LESSONS;
const PART='myRIO 嵌入式控制';
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const steps=list=>`<ol class="mr-steps">${list.map(s=>`<li>${s}</li>`).join('')}</ol>`;
const ui=s=>`<b class="mr-ui">${s}</b>`;
function flow(items){
  const one=x=>{
    if(typeof x==='string')return `<span class="fb">${x}</span>`;
    if(x.loop)return `<span class="fl"><em>${x.label||'While Loop'}</em><span class="fin">${x.loop.map(one).join('<i class="fa">→</i>')}</span>${x.sr?`<small class="fsr">Shift Register：${x.sr}</small>`:''}</span>`;
    if(x.kase)return `<span class="fc"><em>Case：${x.label}</em><span class="fin">${x.kase.map(one).join('<i class="fa">或</i>')}</span></span>`;
    return '';
  };
  return `<div class="bdflow fig">${items.map(one).join('<i class="fa">→</i>')}</div>`;
}
let UID=0;
const radios=(id,k,t,list,cur)=>`<fieldset><legend>${t}</legend>${list.map(o=>`<label><input type="radio" name="${id}-${k}" value="${o[0]}"${cur===o[0]?' checked':''}> ${o[1]}</label>`).join('')}</fieldset>`;
const pick=(d,id,k)=>{const c=d.querySelector(`input[name="${id}-${k}"]:checked`);return c?c.value:null;};

/* ---------- M08 I2C 位元組 → 數值 ---------- */
function i2cLab(d){
  const id='ic'+(++UID),S={m:'s16'};
  const raw=[0x07,0xD0,0xFC,0x18,0x40,0x1C];
  d.innerHTML=`<div class="planlab fig"><p class="wf-note">從 0x3B 開始讀 6 個位元組（X、Y、Z 加速度，各 2 個位元組，高位元組在前）。MPU-6050 平放、Z 軸朝上時讀到：</p>
<p class="mr-bytes">${raw.map((b,i)=>`<span class="wb ${i%2?'sn':'sd'}"><b>${b.toString(16).toUpperCase().padStart(2,'0')}</b><small>${['X 高','X 低','Y 高','Y 低','Z 高','Z 低'][i]}</small></span>`).join('')}</p>
<div class="wf-opts">${radios(id,'m','兩個位元組怎麼合',[['u16','高×256＋低，當成無號（U16）'],['s16','高×256＋低，當成有號（I16）'],['swap','低×256＋高（順序反了）']],S.m)}</div><table class="t pl-log"><tbody></tbody></table><p class="verdict-line" aria-live="polite"></p></div>`;
  function run(){
    const m=pick(d,id,'m'),v=[0,2,4].map(i=>{let x=m==='swap'?raw[i+1]*256+raw[i]:raw[i]*256+raw[i+1];if(m!=='u16'&&x>32767)x-=65536;return x;});
    d.querySelector('tbody').innerHTML=['X','Y','Z'].map((a,i)=>`<tr><td>${a}</td><td>${v[i]}</td><td>${(v[i]/16384).toFixed(3)} g</td></tr>`).join('');
    const ok=m==='s16',say=d.querySelector('.verdict-line');say.className='verdict-line '+(ok?'ok':'bad');
    say.textContent=ok?'✔ X 0.122 g、Y −0.061 g、Z 1.002 g：平放時 Z 大約 1 g（重力），其他兩軸接近 0，合理。（±2 g 量程時一個 g 是 16384，元件規格）'
      :m==='u16'?'✖ Y 變成 3.9 g：FC18 的最高位元是 1，代表負數。當成無號就把 −1000 讀成 64536。這跟 I12 示波器的有號位元組是同一件事。'
      :'✖ 數值全錯：規格書寫高位元組在前，你把它當成低位元組在前。I7 Modbus、I12 示波器都遇過「位元組順序」這一關。';
  }
  d.addEventListener('change',run);run();
}

/* ---------- M09 迴圈週期的抖動 ---------- */
function jitterLab(d){
  const id='jt'+(++UID),S={m:'wait',ui:'1'};
  d.innerHTML=`<div class="planlab fig"><p class="wf-note">模擬：目標是每 10 ms 跑一圈控制。每一圈的工作大約 2 ms；偶爾 myRIO 上有別的事（例如網路傳資料、寫檔）佔用處理器。</p>
<div class="wf-opts">${radios(id,'m','迴圈怎麼控制時間',[['wait','While Loop＋Wait (ms) 10'],['multi','While Loop＋Wait Until Next ms Multiple 10'],['timed','Timed Loop，週期 10 ms']],S.m)}${radios(id,'ui','寫檔、畫圖放在哪',[['1','跟控制放在同一個迴圈'],['0','另外一個迴圈（低優先）']],S.ui)}</div><div class="jt-plot"></div><p class="verdict-line" aria-live="polite"></p></div>`;
  let r=5;const rnd=()=>{r=(r*1103515245+12345)%2147483648;return r/2147483648;};
  function run(){
    const m=pick(d,id,'m'),inl=pick(d,id,'ui')==='1';r=5;const per=[];let t=0;
    for(let k=0;k<120;k++){
      let work=2+rnd()*0.4;if(inl&&k%15===7)work+=6+rnd()*5;
      let bg=(!inl||m!=='timed')&&rnd()<0.08?3+rnd()*4:0;if(m==='timed'&&!inl)bg=0;
      let start=t,end;
      if(m==='wait')end=start+work+bg+10;
      else{const done=start+work+(m==='timed'?0:bg);end=Math.ceil((done+0.001)/10)*10;}
      per.push(end-start);t=end;}
    const W=560,H=130,mx=Math.max(25,...per);
    const pts=per.map((p,i)=>`${(28+i/(per.length-1)*(W-34)).toFixed(1)},${(H-14-(p/mx)*(H-28)).toFixed(1)}`).join(' ');
    d.querySelector('.jt-plot').innerHTML=`<svg class="mr-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="每一圈的週期"><line x1="28" x2="${W-6}" y1="${H-14-(10/mx)*(H-28)}" y2="${H-14-(10/mx)*(H-28)}" stroke="#2e7d32" stroke-dasharray="4 3"/><text x="${W-8}" y="${H-17-(10/mx)*(H-28)}" font-size="10" text-anchor="end" fill="#2e7d32">10 ms</text><text x="2" y="16" font-size="10" fill="currentColor">${mx.toFixed(0)} ms</text><polyline points="${pts}" fill="none" stroke="#1565c0" stroke-width="1.6"/></svg>`;
    const avg=per.reduce((a,b)=>a+b,0)/per.length,mxp=Math.max(...per),mnp=Math.min(...per),say=d.querySelector('.verdict-line');
    let msg=`平均每圈 ${avg.toFixed(1)} ms，最短 ${mnp.toFixed(1)}、最長 ${mxp.toFixed(1)} ms。`;
    if(m==='wait')msg+='Wait (ms) 是「做完之後再等 10 ms」，所以每圈＝工作時間＋10，永遠超過 10 ms，而且工作時間一變，週期就跟著變。';
    else if(m==='multi')msg+='Wait Until Next ms Multiple 等到時鐘的下一個 10 的倍數，平均準了；但只要有一圈做太久，就會跳過一格，變成 20 ms。';
    else msg+=inl?'Timed Loop 有優先權，別的事搶不走它；可是寫檔、畫圖放在同一圈，那一圈自己就做超過 10 ms，還是會晚。':'Timed Loop 加上把慢的事搬到別的迴圈：每一圈都是 10 ms。這就是控制迴圈的標準寫法。';
    say.className='verdict-line '+(m==='timed'&&!inl?'ok':'');say.textContent=msg;
  }
  d.addEventListener('change',run);run();
}

/* =============================== M08 =============================== */
L.push({id:'M08',order:30.8,no:'M8',part:PART,title:'I2C、SPI、UART：跟感測器和其他控制板講話',mins:60,
goals:[['學會','三種匯流排各接哪幾隻腳、什麼時候用哪一種；I2C 的位址和暫存器；讀回來的位元組怎麼變成數值（有號、高低位元組）；UART 的電壓為什麼不能直接接 RS-232。'],['做出','讀 MPU-6050 的 WHO_AM_I 確認講得上話，再讀三軸加速度換成 g。'],['為什麼','很多感測器不給電壓，而是給一串位元組。這跟 I 系列接儀器是同一套功夫：先講到話、看原始資料、再轉成數字。']],
check:'你能說出：I2C 接哪兩隻腳、要不要加上拉；為什麼第一個要讀的是 WHO_AM_I；FC18 當成有號是多少；myRIO 的 UART 能不能直接接電腦的 RS-232 埠。',
body:[
C.h3('情境','x','加一顆姿態感測器'),
`<p>小手臂要知道自己有沒有傾斜。你手上有一塊 MPU-6050 模組，照 M03 接線 7 接到 MXP A：VCC → +3.3V（第 33 腳）、GND → DGND、SCL → 第 32 腳、SDA → 第 34 腳。</p>
<p>這一課的順序，跟 I 系列接一台新儀器一模一樣：<b>先講到話 → 看原始資料 → 再轉成數字</b>。</p>`,
C.h3('第 1 步','','三種匯流排怎麼選'),
C.table(['','I2C','SPI','UART'],[
 ['myRIO MXP 的腳','SCL＝DIO14（32）、SDA＝DIO15（34）','CLK＝DIO5（21）、MISO＝DIO6（23）、MOSI＝DIO7（25）；片選要另外用一隻 DIO','RX（10）、TX（14）'],
 ['線數','2 條，好幾顆共用，用位址分','3 條＋每顆一條片選','2 條，一對一'],
 ['速度上限（說明書）','400 kHz','4 MHz','230,400 bps'],
 ['常見的東西','姿態感測器、溫濕度、小螢幕','高速 ADC、記憶體、顯示器','GPS、藍牙模組、另一塊控制板']
]),
note('SPI 的片選','說明書的 MXP 腳位表裡，SPI 只有 CLK、MISO、MOSI，沒有片選（CS）。要接 SPI 元件，用一隻一般的 DIO 當片選，讀寫前拉低、讀寫完拉高（實際的有效電位看元件規格）。'),
C.h3('第 2 步','','先講到話：讀 WHO_AM_I'),
ask('接好之後，第一個要讀的是什麼？為什麼不是直接讀加速度？',
 `<p>先讀一個<b>答案已知</b>的暫存器。MPU-6050 的 WHO_AM_I（位址 0x75）會回 0x68（元件規格）。讀到 0x68：線、位址、速度都對了。讀不到或讀到別的，問題一定在接線或設定，跟換算無關。</p>
<p>這就是 I2 的「第一條命令選 *IDN?」：一次只解一個未知數。</p>`),
steps([`放一個 ${ui('I2C')} Express VI，選 A 接頭；位址填 0x68（元件規格：AD0 腳接地時是 0x68、接高是 0x69）。`,
 `做「寫一個位元組（暫存器位址 0x75）然後讀 1 個位元組」。`,
 `讀到 0x68 → 講到話了。讀不到 → 先檢查：電源 3.3 V、SCL、SDA 有沒有接反、位址是不是 0x69。`]),
ask('讀到 0x68 了，接著直接讀加速度，全部是 0。哪裡錯了？',
 `<p>MPU-6050 一上電是睡眠模式（元件規格）：要先把電源管理暫存器 PWR_MGMT_1（0x6B）寫成 0 叫醒它，才會開始量。</p>
<p>這是「寫入」：照 I14 的習慣，寫完要讀回來確認（讀 0x6B，應該是 0）。很多感測器都有「上電要先設定才會動」的步驟，說明書的初始化章節一定要看。</p>`),
C.h3('第 3 步','','位元組變成數字'),
`<p>從 0x3B 開始讀 6 個位元組，就是 X、Y、Z 三軸加速度。下面是一筆真的會讀到的資料，換三種合法看看：</p>`,
{fn:i2cLab},
ask('LabVIEW 裡怎麼把兩個位元組合成有號的 16 位元？',
 `<p>兩個做法：用 Join Numbers 把高、低兩個 U8 合成 U16，再用 To Word Integer（I16）轉成有號；或把 6 個位元組的陣列 Type Cast 成 I16 陣列（I12 學過：Type Cast 是高位元組在前，剛好對上）。</p>
<p>換成 g：除以 16384（±2 g 量程時，元件規格）。量程改了，除數就要跟著改：這個數字放在一個常數裡，旁邊註明是哪個量程。</p>`),
C.h3('第 4 步','','UART：電壓不一樣，不能直接接'),
ask('myRIO 的 UART 可以直接接電腦背後的 RS-232（DB9）嗎？',
 `<p>不行。說明書：myRIO 的 UART 腳電氣上跟 DIO 一樣，是 3.3 V 的邏輯電位（TTL）。RS-232 用的是正負十幾伏特的電壓，而且邏輯是反的。直接接，輕則讀到亂碼，重則燒掉腳位。</p>
<p>要接 RS-232 設備，中間加一顆電位轉換模組（例如 MAX3232 這一類，通用知識）。接另一塊 3.3 V 或 5 V 的控制板（Arduino 之類）可以直接接：TX 接對方 RX、RX 接對方 TX、地接地。myRIO 的輸入是 5 V 相容，對方送 5 V 進來沒關係。</p>
<p>鮑率、資料位元、同位這些設定，跟 I2 的序列埠完全一樣：兩邊要設成一樣。說明書：最高 230,400 bps，資料位元 5～8，停止位元 1、2。</p>`),
C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'I2C 接 MXP 的哪兩隻腳？要不要自己加上拉電阻？',o:['第 32、34 腳；內建 2.1 kΩ 上拉，一般不用加','第 1、2 腳；要加','第 21、23 腳；不用','第 10、14 腳；要加'],a:0,ex:'第 10、14 是 UART；第 21、23、25 是 SPI。'},
 {q:'接好 I2C 感測器，第一個要讀的是？',o:['答案已知的 WHO_AM_I','加速度','溫度','隨便一個'],a:0,ex:'先講到話，一次只解一個未知數。'},
 {q:'MPU-6050 讀加速度全是 0，WHO_AM_I 正常。最可能？',o:['還在睡眠模式，要先寫 0x6B 叫醒','位址錯了','線接反','量程錯'],a:0,ex:'寫完記得讀回來確認。'},
 {q:'FC18 當成有號 16 位元是多少？',o:['−1000','64536','6396','−64536'],a:0,ex:'最高位元是 1 就是負數。'},
 {q:'myRIO 的 UART 能直接接電腦的 RS-232 埠嗎？',o:['不行，myRIO 是 3.3 V 邏輯，RS-232 是正負十幾伏','可以','只要鮑率一樣就可以','加一顆電阻就可以'],a:0,ex:'中間要加電位轉換模組。'}
]}
]});

/* =============================== M09 =============================== */
L.push({id:'M09',order:30.9,no:'M9',part:PART,title:'迴圈的時間要穩：控制、畫圖、存檔要分開',mins:60,
goals:[['學會','Wait (ms)、Wait Until Next ms Multiple、Timed Loop 的差別；什麼是抖動（jitter）、怎麼量；為什麼慢的事情要搬出控制迴圈；控制迴圈和其他迴圈怎麼交換資料；電腦端的監控畫面怎麼拿到 myRIO 的資料。'],['做出','一個 10 ms 的 Timed Loop 控制迴圈，加一個低優先的迴圈負責畫圖和存檔；量出每一圈的實際週期。'],['為什麼','M07 的比例控制假設每 10 ms 算一次。週期忽長忽短，轉速算錯、控制就會抖。']],
check:'你能說出：Wait (ms) 10 為什麼每圈都超過 10 ms；怎麼量每一圈的實際週期；寫檔為什麼不能放在控制迴圈；兩個迴圈之間用什麼傳資料；部署後電腦要怎麼看到 myRIO 的資料。',
body:[
C.h3('情境','x','M07 的控制偶爾會抖一下'),
`<p>M07 的比例控制大部分時候很穩，偶爾馬達會突然抖一下。你在同一個迴圈裡還畫了圖、每一圈寫一行紀錄檔。</p>`,
ask('怎麼確認是不是迴圈的時間不穩？',
 `<p>量它。每一圈開頭讀一次 Tick Count (ms)，跟上一圈的值相減，就是這一圈的實際週期。上一圈的值放 Shift Register（又是它）。把週期畫成圖，或記下最大值、最小值。</p>
<p>先量再改：不要憑感覺說「應該是時間的問題」。</p>`),
C.h3('第 1 步','','三種控制時間的方法'),
{fn:jitterLab},
C.table(['方法','怎麼算時間','適合'],[
 ['Wait (ms)','做完之後再等 N ms：週期＝工作時間＋N','不在乎週期準不準的事，例如更新畫面'],
 ['Wait Until Next ms Multiple','等到時鐘的下一個 N 的倍數','一般的週期性工作'],
 ['Timed Loop','有自己的週期和優先權；晚了會告訴你（Finished Late? 輸出）','myRIO 上的控制迴圈']
]),
ask('Timed Loop 已經有優先權了，為什麼寫檔還是要搬出去？',
 `<p>優先權只能讓「別人」搶不走時間。如果寫檔放在同一圈，那一圈自己就要花很久（檔案系統、記憶卡都可能偶爾慢一下），一樣會晚。</p>
<p>原則：<b>控制迴圈只放「讀感測器 → 計算 → 寫輸出」</b>。畫圖、存檔、網路，全部放到另一個優先權低的迴圈。</p>`),
C.h3('第 2 步','','兩個迴圈怎麼交換資料'),
ask('控制迴圈量到的角度，要交給另一個迴圈去畫圖存檔。用區域變數可以嗎？',
 `<p>可以動，但不好：區域變數只保留「最新一筆」，畫圖的迴圈慢一點，中間的資料就漏掉了；而且兩個迴圈同時讀寫，誰先誰後不確定。</p>
<p>要「每一筆都不漏、而且不拖慢控制迴圈」，用先進先出的佇列。在 LabVIEW Real-Time 上，給時間要求嚴格的迴圈用的是 <b>RT FIFO</b>（通用知識）：寫入不會卡住控制迴圈。這跟第 6 部分 QMH 的佇列是同一個想法，只是換成適合即時系統的版本。</p>`),
flow([{loop:['讀 Encoder','計算','寫 PWM','角度、時間寫進 RT FIFO'],label:'Timed Loop（10 ms，高優先）'},{loop:['從 RT FIFO 讀出所有資料','畫圖','寫檔（M10 用得到）'],label:'While Loop（100 ms，低優先）'}]),
C.h3('第 3 步','','電腦端：部署之後怎麼看資料'),
ask('M02 從專案按執行時，前面板就看得到資料。那為什麼還要學別的方法？',
 `<p>那叫互動式前面板（interactive front panel）：只有從專案按執行、USB 或網路還連著時才有。M10 把程式變成開機自動執行之後，就沒有前面板了。</p>
<p>要在電腦上看資料，要另外寫一個<b>電腦端的 VI</b>（放在專案的 My Computer 底下），用網路跟 myRIO 上的程式交換資料。LabVIEW 常見的兩種（通用知識）：</p>
<ul><li><b>網路發布的 Shared Variable</b>：在專案裡對 myRIO 按右鍵 ▸ New ▸ Variable 建立，兩邊都可以讀寫。簡單，適合「最新的狀態」，例如目前角度、按鈕狀態。</li>
<li><b>Network Stream</b>：一筆一筆不漏地傳，適合要完整記錄的資料。</li></ul>
<p>這就是 M02 說的「My Computer 底下放的是只在電腦上跑的東西」。</p>`),
C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'While Loop＋Wait (ms) 10，工作 2 ms，每圈大約？',o:['12 ms','10 ms','8 ms','2 ms'],a:0,ex:'Wait 是做完再等。'},
 {q:'怎麼量每一圈的實際週期？',o:['Tick Count 相減，上一圈的值放 Shift Register','看 CPU 使用率','猜','用 Wait 的輸入'],a:0,ex:'先量再改。'},
 {q:'控制迴圈裡應該放什麼？',o:['讀感測器、計算、寫輸出','寫檔、畫圖','網路傳輸','全部都放'],a:0,ex:'慢的事放到低優先的迴圈。'},
 {q:'控制迴圈的資料每一筆都要交給記錄迴圈，用？',o:['RT FIFO（先進先出、不卡控制迴圈）','區域變數','全域變數','前面板'],a:0,ex:'區域變數只留最新一筆。'},
 {q:'部署成開機執行後，電腦要看 myRIO 的資料，可以用？',o:['網路發布的 Shared Variable 或 Network Stream','互動式前面板','I/O Monitor','NI MAX'],a:0,ex:'電腦端的 VI 放在 My Computer 底下。'}
]}
]});

/* =============================== M10 =============================== */
L.push({id:'M10',order:30.91,no:'M10',part:PART,title:'獨立執行：拔掉電腦，myRIO 開機自己跑',mins:50,
goals:[['學會','開發時「從專案按執行」和「開機自動執行」差在哪；建立 Real-Time Application 的步驟；設成開機執行、怎麼關掉；沒有前面板時程式要怎麼設計。'],['做出','myRIO 一通電，小手臂的程式自己跑起來；LED 顯示狀態；資料存到檔案。'],['為什麼','機台上不會一直接著一台電腦。程式要能自己啟動、自己告訴你狀況。']],
check:'你能說出：建成開機執行的四個步驟；開機執行的程式存在 myRIO 的哪裡；想改程式時要先做什麼；沒有前面板時，「停止」和「顯示狀態」怎麼做。',
body:[
C.h3('情境','x','電腦要拿走了'),
`<p>到 M09 為止，程式都是從專案按執行：USB 一拔，前面板停住，程式也停了。現在小手臂要裝到機台上，只接電源。</p>`,
ask('從專案按執行的程式，跟要開機自己跑的程式，寫法要不要改？',
 `<p>要想清楚三件事，因為<b>開機執行時沒有前面板</b>：</p>
<ul><li><b>怎麼停</b>：前面板的 Stop 按不到了。用實體按鈕（M04，記得濾彈跳），或一直跑到斷電。</li>
<li><b>怎麼告訴你狀態</b>：用板上的 LED（例如 LED0 恆亮＝正常、閃爍＝錯誤），或存檔。</li>
<li><b>初始值</b>：前面板控制項的值不會有人去改，用常數或設定檔。</li></ul>
<p>先把這三件事改好，再建置。</p>`),
C.h3('第 1 步','','建立 Real-Time Application'),
steps([`在專案總管，<b>myRIO 底下的</b> ${ui('Build Specifications')} 按右鍵 ▸ ${ui('New')} ▸ ${ui('Real-Time Application')}。`,
 `${ui('Information')} 頁：取一個名字（例如 robot-arm）。`,
 `${ui('Source Files')} 頁：把 Main.vi 放到 ${ui('Startup VIs')}。`,
 `按 ${ui('Build')}。完成後，Build Specifications 底下多一個項目。`]),
C.h3('第 2 步','','設成開機執行'),
steps([`對剛建好的建置規格按右鍵 ▸ ${ui('Run as startup')}（有的版本是先 ${ui('Set as startup')}，再對 myRIO 按 ${ui('Deploy')}）。`,
 `LabVIEW 把程式送到 myRIO，並問你要不要重新開機。重開。`,
 `拔掉 USB，只留電源。重新上電，看 LED：程式自己跑起來了。`]),
note('它存在哪裡','NI 的教學：開機執行的程式存在 myRIO 的 /home/lvuser/natinst/bin，檔名是 startup.rtexe。'),
C.h3('第 3 步','','要改程式時'),
ask('開機程式已經在跑，你回到專案改 Main.vi、按執行，會發生什麼？',
 `<p>myRIO 上已經有一個程式在用同樣的接腳，LabVIEW 部署時會告訴你有衝突，要先停掉正在跑的程式。改好要上線，要<b>重新 Build、再 Run as startup</b>，不然 myRIO 開機跑的還是舊版本。</p>
<p>開發期間如果嫌開機程式礙事，可以把它關掉：NI MAX 裡 myRIO 的設定，或用瀏覽器開 172.22.11.2，有 ${ui('Disable RT Startup App')} 的選項（NI 教學）。關掉之後重開，myRIO 就只開機、不跑程式。</p>`),
C.h3('第 4 步','','存檔：存在哪裡'),
ask('記錄檔要存在 myRIO 的哪裡？',
 `<p>兩個選擇：</p>
<ul><li><b>myRIO 內部</b>（例如 /home/lvuser 底下）：方便，但說明書提醒內部記憶體有壽命，要看 NI 的使用建議（說明書附的 Info Code SSDBP）。不要每 10 ms 寫一次，累積一批再寫。</li>
<li><b>USB 隨身碟</b>：插 USB Host 埠，說明書：LabVIEW 通常把它對應到 /U。拔下來插電腦就能看。</li></ul>
<p>寫檔一律放在 M09 的低優先迴圈。</p>`),
C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'建立開機執行程式，在哪裡按右鍵？',o:['myRIO 底下的 Build Specifications','My Computer 底下','Main.vi','NI MAX'],a:0,ex:'New ▸ Real-Time Application。'},
 {q:'開機執行的程式檔名？',o:['startup.rtexe','Main.vi','robot.exe','autorun.inf'],a:0,ex:'存在 /home/lvuser/natinst/bin。'},
 {q:'開機執行時，怎麼停止程式最合理？',o:['實體按鈕（濾彈跳）或斷電','前面板 Stop','Abort','拔 USB'],a:0,ex:'沒有前面板。'},
 {q:'改了 Main.vi 之後，要讓 myRIO 開機跑新版本？',o:['重新 Build，再 Run as startup','存檔就好','重開機就好','什麼都不用'],a:0,ex:'myRIO 跑的是 Build 出來的那一份。'},
 {q:'USB 隨身碟在 myRIO 上通常是？',o:['/U','C:\\','/home','D:'],a:0,ex:'說明書：通常從 /U 開始。'}
]}
]});

/* =============================== M11 =============================== */
L.push({id:'M11',order:30.92,no:'M11',part:PART,title:'FPGA 入門：什麼時候需要自己改 FPGA',mins:40,
goals:[['學會','myRIO 上 FPGA 在做什麼；default personality 已經幫你做了哪些事；什麼需求逼你改 FPGA；改 FPGA 要付出什麼（軟體、編譯時間、複雜度）。'],['做出','一張判斷表：你的專題需要的功能，default personality 夠不夠。'],['為什麼','FPGA 很強，但很花時間。大部分專題用預設的就夠；先知道邊界在哪，才不會一開始就走難的路。']],
check:'你能說出：Express VI 為什麼不用寫 FPGA 也能用；三種需要改 FPGA 的情況；改 FPGA 需要多裝什麼；為什麼要先試 default personality。',
body:[
C.h3('情境','x','同學說「用 FPGA 比較厲害」'),
`<p>你在論壇看到別人用 myRIO 的 FPGA 做了很快的控制。你的小手臂要不要也改 FPGA？</p>`,
ask('到 M10 為止，你寫過任何 FPGA 程式嗎？那 PWM、編碼器是誰在做？',
 `<p>沒有。myRIO 出廠就在 FPGA 裡放了一套寫好的程式，叫 <b>default personality</b>：PWM、編碼器、I2C、SPI 這些需要精準時序的事，FPGA 都做好了。你用的 Express VI，是在 Real-Time 這一側跟它講話（NI 教學：default personality 搭配 Express VI，你只要寫 RT 的程式）。</p>
<p>所以「要不要改 FPGA」的問題其實是：<b>default personality 做不到你要的事嗎？</b></p>`),
C.h3('第 1 步','','什麼情況需要改'),
C.table(['需求','default personality','怎麼辦'],[
 ['8 路以內的 PWM、4 組以內的編碼器','夠：MXP A、B 各有 3 路 PWM、1 組編碼器，MSP 有 2 路 PWM、2 組編碼器（說明書腳位表）','不用改'],
 ['要量脈波寬度（例如超音波測距的回波）、或自訂時序的協定','沒有現成的功能','改 FPGA'],
 ['高速、連續的類比取樣（例如聲音、震動）','Express VI 一次讀一點','先看 NI 的 High Throughput personality（另一套現成的），不夠再改'],
 ['控制迴圈要比 RT 能做到的更快、更準','RT 的迴圈有極限','把控制搬到 FPGA'],
 ['PWM、編碼器要比預設的更多','數量固定','改 FPGA']
]),
C.h3('第 2 步','','改 FPGA 要付出什麼'),
ask('改 FPGA 需要多準備什麼？',
 `<ul><li><b>軟體</b>：LabVIEW FPGA Module（M01 說的「選用」那一項）和它的編譯工具（NI 教學：要自訂 myRIO 的 FPGA，一定要 FPGA Module）。</li>
<li><b>編譯時間</b>：FPGA 程式不是按執行就跑，要先編譯成位元檔，常常要好幾分鐘到幾十分鐘（看程式大小，通用經驗）。改一個數字就要等一次。</li>
<li><b>寫法不同</b>：FPGA 上每一個迴圈都是真的平行的硬體；Real-Time 這一側要用 Open FPGA VI Reference、Read/Write Control 這類函式跟它溝通。</li>
<li><b>預設功能會不見</b>：NI 教學提到 default personality 已經用掉大部分的 FPGA 資源。自己寫一套，原本的 Express VI 可能就不能用了；要保留，就要從 default personality 的原始碼改。NI 的範例也提醒：自訂位元檔時，Set Custom Bitfile 要在開 FPGA 參照之後馬上呼叫。</li></ul>`),
ask('那正確的順序是？',
 `<p><b>先用 default personality 把整個專題做到能動</b>。做完之後，真的有某一項做不到或不夠快，才針對那一項改 FPGA。</p>
<p>這跟 I13 測試站的規劃一樣：先把整條流程排出來，再找瓶頸，不要一開始就最佳化你不確定需要的東西。</p>`),
C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'沒寫 FPGA 程式，PWM、編碼器是誰在做？',o:['出廠就放在 FPGA 裡的 default personality','Real-Time 處理器','電腦','Express VI 自己'],a:0,ex:'Express VI 是在 RT 這一側跟它講話。'},
 {q:'哪一個需求最可能逼你改 FPGA？',o:['量超音波回波的脈波寬度','讀一個按鈕','控制兩顆伺服馬達','點亮 LED'],a:0,ex:'default personality 沒有現成的功能。'},
 {q:'改 FPGA 一定要多裝？',o:['LabVIEW FPGA Module 和編譯工具','DAQmx','VISA','什麼都不用'],a:0,ex:'M01 的「選用」那一項。'},
 {q:'正確的順序？',o:['先用 default personality 做到能動，不夠再針對那一項改','一開始就全部改 FPGA','只用 FPGA','不用 RT'],a:0,ex:'先找到瓶頸再最佳化。'}
]}
]});

/* =============================== M12 =============================== */
L.push({id:'M12',order:30.93,no:'M12',part:PART,title:'綜合專案：小手臂，從規劃到上線',mins:90,
goals:[['學會','把需求變成腳位表、狀態機、迴圈分工和測試計畫；用前面每一課的判斷，自己排出整個程式。'],['做出','一份完整的規劃：腳位表（沒有衝突）、狀態圖、兩個迴圈的分工、安全設計、上線前的測試表。'],['為什麼','每一課的功能你都會了。真正的專題難在「全部放在一起」：腳位會打架、狀態會漏、出錯時要停在安全的地方。']],
check:'你能交出：一張沒有衝突的腳位表；一張狀態圖（含錯誤狀態）；控制迴圈和記錄迴圈各做什麼；急停為什麼用「低電位有效」；上線前要測的五件事。',
body:[
C.h3('需求','x','主管給你的規格'),
`<ol><li>按「啟動」鈕：關節回到原點，再轉到 90°，夾爪閉合，等 2 秒，夾爪打開，回到 0°。</li>
<li>可變電阻調關節的速度上限。</li><li>按「急停」：馬達立刻停、夾爪不動，直到重新啟動。</li>
<li>傾斜超過 30°（MPU-6050）：當成故障，停機。</li><li>每一次動作記錄時間、角度、結果到 USB 隨身碟。</li><li>開機自動執行，LED 顯示狀態。</li></ol>`,
C.h3('第 1 步','','腳位表：先排，再找衝突'),
`<p>先自己排一次，再看下面的參考答案。重點是：<b>有第二功能的腳，被用掉了就不能再當一般 DIO</b>。</p>`,
ask('參考答案：腳位怎麼排？',
 C.table(['功能','接頭／腳','為什麼選這隻'],[
 ['啟動鈕','MXP A DIO0（11）','一般 DIO；按下＝FALSE（上拉）'],
 ['急停鈕','MXP A DIO1（13）＋常閉接點','線斷了也會讀到「按下」，見下一題'],
 ['速度上限（可變電阻）','MXP A AI0（3）','0～5 V 類比'],
 ['關節馬達 PWM','MXP A DIO8 / PWM0（27）','PWM 第二功能'],
 ['關節方向 AIN1／AIN2','MXP A DIO2（15）、DIO3（17）','避開有第二功能的腳'],
 ['驅動板 STBY','MXP A DIO4（19）','同上'],
 ['關節編碼器','MXP A DIO11 / ENC.A（18）、DIO12 / ENC.B（22）','編碼器第二功能'],
 ['夾爪伺服','MXP A DIO9 / PWM1（29）','第二個 PWM'],
 ['MPU-6050','MXP A DIO14 / SCL（32）、DIO15 / SDA（34）','I2C 第二功能'],
 ['狀態顯示','板上 LED0～3','不佔接腳'],
 ['記錄','USB Host（/U）','拔下來就能看']
 ])+`<p>檢查：DIO5～7 是 SPI、DIO10 是 PWM2，這裡沒用到，所以沒有衝突。如果之後要加 SPI 元件，那三隻已經空著。MXP B 整個空著，可以留給擴充。</p>`),
ask('急停為什麼要用常閉接點、讀到「沒按」才算正常？',
 `<p>如果急停用常開接點：按下去才接通。萬一線斷了，按急停就什麼都不會發生。</p>
<p>用常閉接點接在 DIO 和地之間：平常接通，讀到 FALSE；按下急停或<b>線斷了</b>，接點打開，上拉電阻把它拉成 TRUE。程式只要看到 TRUE 就停機。<b>故障時會往安全的方向錯</b>，這是工業安全設計的基本想法（M03 提過 MXP 上拉的特性，這裡用上了）。</p>
<p>注意：這是程式層的停機。真正的機台急停還要有硬體直接切斷馬達電源，不能只靠程式。</p>`),
C.h3('第 2 步','','狀態機'),
ask('列出所有狀態，以及每個狀態出錯要去哪裡。',
 C.table(['狀態','做什麼','正常的下一步','出錯／急停'],[
 ['初始化','開 I2C、叫醒 MPU-6050（讀 WHO_AM_I 確認）、開檔、LED0 亮','等待','故障'],
 ['等待','等啟動鈕（上升緣、濾波）','回原點','—'],
 ['回原點','慢速轉到原點開關或機構極限，計數歸零','到 90°','故障（超時）'],
 ['到 90°','比例控制，速度上限看可變電阻；誤差小於 1° 持續 200 ms 算到','夾緊','故障（超時）'],
 ['夾緊','伺服到閉合角度，等 2 秒','放開','故障'],
 ['放開','伺服到打開角度','回 0°','故障'],
 ['回 0°','比例控制回 0°','記錄 → 等待','故障'],
 ['故障','PWM＝0、STBY＝FALSE、伺服不動、LED 閃、記錄原因、清錯誤','按啟動鈕重新初始化','—']
 ])+`<p>急停在<b>每一個狀態</b>都要檢查：在迴圈一開始讀急停，TRUE 就直接跳到故障。不要只在某幾個狀態裡檢查。</p>`),
C.h3('第 3 步','','迴圈分工'),
flow([{loop:['讀急停、編碼器、按鈕、可變電阻、MPU-6050',{kase:['狀態機（上表）'],label:'目前狀態'},'寫 PWM、方向、伺服','事件寫進 RT FIFO'],label:'Timed Loop（10 ms，高優先）',sr:'狀態、上一次計數、計時、按鈕上一圈的值'},{loop:['讀 RT FIFO','寫到 /U 的檔案','更新 LED 閃爍'],label:'While Loop（100 ms，低優先）'}]),
ask('MPU-6050 的 I2C 讀取放在 10 ms 的控制迴圈裡，可以嗎？',
 `<p>要先量：I2C 400 kHz，讀 6 個位元組加上位址，大約零點幾毫秒，通常放得下。但如果量到它偶爾變慢（感測器忙、線長），就把它搬到一個 50 ms 的中優先迴圈：傾斜是慢慢變的，不需要每 10 ms 讀一次。</p>
<p>每一個東西放在哪個迴圈，問的是 M05 那一句：<b>這個訊號多快會變、需要多快反應</b>。</p>`),
C.h3('第 4 步','','上線前的測試表'),
C.table(['測什麼','怎麼測','通過的樣子'],[
 ['接線','I/O Monitor 一隻一隻試（M01、M03）','每一隻腳的讀寫都對'],
 ['急停','每一個狀態下都按一次；也拔掉急停的線','馬達立刻停，進故障'],
 ['逾時','回原點時用手擋住關節','超時進故障，不會一直推'],
 ['迴圈時間','記錄每一圈的週期（M09）','最長不超過 10 ms 太多'],
 ['獨立執行','拔掉 USB、重新上電（M10）','自己跑起來、檔案有寫進 /U']
]),
`<p>到這裡，myRIO 部分講完了。回頭看：每一個決定都能說出是哪一課的哪個理由。這張規劃交得出來，程式就只是照著畫。</p>`,
C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'腳位規劃時最要注意的？',o:['有第二功能的腳被用掉了，就不能再當一般 DIO','腳位越多越好','都接 MXP B','隨便排'],a:0,ex:'先排表，再找衝突。'},
 {q:'急停用常閉接點、TRUE 代表停機，好處是？',o:['線斷了也會停機：故障往安全的方向錯','比較便宜','程式比較短','按起來比較輕'],a:0,ex:'真正的急停還要有硬體切電。'},
 {q:'急停應該在哪些狀態檢查？',o:['每一個狀態（迴圈一開始就檢查）','只有運轉時','只有等待時','不用檢查'],a:0,ex:'漏一個狀態，就是漏一個危險。'},
 {q:'寫檔放在哪個迴圈？',o:['低優先的記錄迴圈，用 RT FIFO 接資料','10 ms 控制迴圈','FPGA','電腦'],a:0,ex:'M09。'},
 {q:'「到 90°」怎麼判斷算到了？',o:['誤差小於一個範圍，並持續一段時間','誤差剛好等於 0','跑 2 秒就算','讀到 90 就算'],a:0,ex:'浮點和雜訊讓「剛好等於」幾乎不會發生；持續一段時間避免衝過頭時誤判。'}
]}
]});
})();
