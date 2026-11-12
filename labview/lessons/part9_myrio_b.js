/* 第九部分：myRIO（M03）——能接什麼、怎麼接、要準備哪些材料。
   腳位、電氣規格全部出自 NI myRIO-1900 User Guide and Specifications（376047）：
   MXP A/B 34 腳、MSP C 20 腳的訊號；DIO 3.3 V 輸出、3.3 V／5 V 相容輸入、4 mA 時 VOH ≥ 2.4 V；
   MXP DIO0～13 有 40 kΩ 上拉、DIO14～15 有 2.1 kΩ 上拉，MSP DIO 有 40 kΩ 下拉；MXP AI／AO 0～5 V、MSP ±10 V；
   AO 驅動 3 mA（MXP）、2 mA（MSP）；+5 V 每個接頭 100 mA、+3.3 V 150 mA、±15 V 32 mA；
   SPI 4 MHz、PWM 100 kHz、編碼器 100 kHz、I2C 400 kHz；NI 配件料號。
   元件照片來自 Wikimedia Commons／Flickr 的開放授權圖，作者與授權列在本課最後（img/myrio/parts/credits.json）。
   LED 壓降、伺服馬達 50 Hz、TB6612FNG 的電壓範圍、MPU-6050 位址等是通用知識或元件規格，課文有標出來。 */
(function(){
const L=window.LESSONS;
const PART='myRIO 嵌入式控制';
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const IMG='img/myrio/parts/';
const photo=(f,cap)=>`<figure class="mr-ph"><img src="${IMG}${f}" alt="${cap}" loading="lazy"><figcaption>${cap}</figcaption></figure>`;

/* ---------- 腳位資料（說明書 Figure 3、Figure 4） ---------- */
const MXP={1:['+5V','pw','+5 V 電源輸出（每個接頭最多 100 mA）'],2:['AO0','ao','類比輸出 0～5 V'],3:['AI0','ai','類比輸入 0～5 V'],4:['AO1','ao','類比輸出 0～5 V'],5:['AI1','ai','類比輸入 0～5 V'],6:['AGND','gd','類比的地（AI、AO 的參考）'],7:['AI2','ai','類比輸入 0～5 V'],8:['DGND','gd','數位的地'],9:['AI3','ai','類比輸入 0～5 V'],10:['UART.RX','dio','UART 接收'],11:['DIO0','dio','數位 I/O'],12:['DGND','gd','數位的地'],13:['DIO1','dio','數位 I/O'],14:['UART.TX','dio','UART 傳送'],15:['DIO2','dio','數位 I/O'],16:['DGND','gd','數位的地'],17:['DIO3','dio','數位 I/O'],18:['DIO11 / ENC.A','dio','數位 I/O；第二功能：編碼器 A 相'],19:['DIO4','dio','數位 I/O'],20:['DGND','gd','數位的地'],21:['DIO5 / SPI.CLK','dio','數位 I/O；第二功能：SPI 時脈'],22:['DIO12 / ENC.B','dio','數位 I/O；第二功能：編碼器 B 相'],23:['DIO6 / SPI.MISO','dio','數位 I/O；第二功能：SPI 資料進'],24:['DGND','gd','數位的地'],25:['DIO7 / SPI.MOSI','dio','數位 I/O；第二功能：SPI 資料出'],26:['DIO13','dio','數位 I/O'],27:['DIO8 / PWM0','dio','數位 I/O；第二功能：PWM0'],28:['DGND','gd','數位的地'],29:['DIO9 / PWM1','dio','數位 I/O；第二功能：PWM1'],30:['DGND','gd','數位的地'],31:['DIO10 / PWM2','dio','數位 I/O；第二功能：PWM2'],32:['DIO14 / I2C.SCL','dio','數位 I/O；第二功能：I2C 時脈（2.1 kΩ 上拉）'],33:['+3.3V','pw','+3.3 V 電源輸出（每個接頭最多 150 mA）'],34:['DIO15 / I2C.SDA','dio','數位 I/O；第二功能：I2C 資料（2.1 kΩ 上拉）']};
const MSP={1:['+15V','pw','+15 V 電源輸出（最多 32 mA）'],2:['−15V','pw','−15 V 電源輸出（最多 32 mA）'],3:['AGND','gd','類比的地'],4:['AO0','ao','類比輸出 ±10 V'],5:['AO1','ao','類比輸出 ±10 V'],6:['AGND','gd','類比的地'],7:['AI0+','ai','差動類比輸入 ±10 V（正）'],8:['AI0−','ai','差動類比輸入 ±10 V（負）'],9:['AI1+','ai','差動類比輸入 ±10 V（正）'],10:['AI1−','ai','差動類比輸入 ±10 V（負）'],11:['DIO0 / ENC0.A','dio','數位 I/O；編碼器 0 A 相'],12:['DIO1','dio','數位 I/O'],13:['DIO2 / ENC0.B','dio','數位 I/O；編碼器 0 B 相'],14:['DIO3 / PWM0','dio','數位 I/O；PWM0'],15:['DIO4 / ENC1.A','dio','數位 I/O；編碼器 1 A 相'],16:['DIO5','dio','數位 I/O'],17:['DIO6 / ENC1.B','dio','數位 I/O；編碼器 1 B 相'],18:['DIO7 / PWM1','dio','數位 I/O；PWM1'],19:['DGND','gd','數位的地'],20:['+5V','pw','+5 V 電源輸出']};
const COL={pw:'#c62828',gd:'#37474f',ai:'#e65100',ao:'#6a1b9a',dio:'#1565c0'};

/* MXP：兩排，上排奇數 33…1、下排偶數 34…2（說明書 Figure 3 的排法） */
function mxpSvg(){
  const W=17,cw=46,x0=60,y0=48,cells=[];
  for(let i=0;i<W;i++){const odd=33-2*i,even=34-2*i;cells.push([odd,x0+i*cw,y0],[even,x0+i*cw,y0+46]);}
  const lab=(p,x,y,up)=>{const t=MXP[p][0].split(' / ');return `<text x="${x+16}" y="${up?y-6:y+50}" font-size="10" text-anchor="middle" fill="currentColor"${up?'':''}>${t[0]}</text>${t[1]?`<text x="${x+16}" y="${up?y-22:y+66}" font-size="9" text-anchor="middle" fill="${COL.dio}">${t[1]}</text>`:''}`;};
  return `<svg class="mr-pin" viewBox="0 0 860 184" role="img" aria-label="MXP 接頭腳位圖">
<text x="10" y="70" font-size="12" fill="currentColor">奇數</text><text x="10" y="116" font-size="12" fill="currentColor">偶數</text>
${cells.map(([p,x,y])=>`<g class="pin" data-p="${p}" tabindex="0"><rect x="${x}" y="${y}" width="32" height="32" rx="4" fill="${COL[MXP[p][1]]}"/><text x="${x+16}" y="${y+21}" font-size="12" text-anchor="middle" fill="#fff">${p}</text></g>`).join('')}
${cells.map(([p,x,y])=>lab(p,x,y,p%2===1)).join('')}
<text x="${x0+16*cw+16}" y="14" font-size="11" text-anchor="middle" fill="currentColor">第 1 腳</text></svg>`;
}
function mspSvg(){
  const cw=40,x0=20,y0=36;
  return `<svg class="mr-pin" viewBox="0 0 840 130" role="img" aria-label="MSP 接頭腳位圖">
${Array.from({length:20},(_,i)=>i+1).map(p=>{const x=x0+(p-1)*cw,t=MSP[p][0].split(' / ');return `<g class="pin" data-p="${p}" tabindex="0"><rect x="${x}" y="${y0}" width="32" height="32" rx="4" fill="${COL[MSP[p][1]]}"/><text x="${x+16}" y="${y0+21}" font-size="12" text-anchor="middle" fill="#fff">${p}</text></g><text x="${x+16}" y="${y0+50}" font-size="10" text-anchor="middle" fill="currentColor">${t[0]}</text>${t[1]?`<text x="${x+16}" y="${y0+63}" font-size="9" text-anchor="middle" fill="${COL.dio}">${t[1]}</text>`:''}`;}).join('')}
<text x="20" y="22" font-size="11" fill="currentColor">第 1 腳</text></svg>`;
}
function pinMap(kind){return d=>{
  const T=kind==='mxp'?MXP:MSP;
  d.innerHTML=`<div class="mr-pinbox fig">${kind==='mxp'?mxpSvg():mspSvg()}<div class="mr-legend">${[['pw','電源'],['gd','地'],['ai','類比輸入'],['ao','類比輸出'],['dio','數位 I/O（藍字是第二功能）']].map(c=>`<span><i style="background:${COL[c[0]]}"></i>${c[1]}</span>`).join('')}</div><p class="mr-pinsay" aria-live="polite">點一隻腳，看它是什麼。</p></div>`;
  const say=d.querySelector('.mr-pinsay');
  const show=p=>{const v=T[p];say.innerHTML=`<b>第 ${p} 腳：${v[0]}</b>　${v[2]}`;d.querySelectorAll('.pin').forEach(g=>g.classList.toggle('on',g.dataset.p===String(p)));};
  d.addEventListener('click',e=>{const g=e.target.closest('.pin');if(g)show(+g.dataset.p);});
  d.addEventListener('keydown',e=>{const g=e.target.closest('.pin');if(g&&(e.key==='Enter'||e.key===' ')){e.preventDefault();show(+g.dataset.p);}});
};}

/* ---------- 接線圖：左邊 myRIO 的腳，右邊元件的腳，中間可以有電阻 ---------- */
function wiring(spec){
  const n=Math.max(spec.links.length,1),rowH=34,H=40+n*rowH,W=780;
  const rows=spec.links.map((l,i)=>{const y=40+i*rowH;const c=l[3]||'#1565c0';
    return `<text x="12" y="${y+5}" font-size="12" fill="currentColor">${l[0]}</text><circle cx="200" cy="${y}" r="5" fill="${c}"/>`+
      (l[2]?`<line x1="200" y1="${y}" x2="290" y2="${y}" stroke="${c}" stroke-width="3"/><rect x="290" y="${y-9}" width="70" height="18" rx="3" fill="#fff4c2" stroke="#8a6d00"/><text x="325" y="${y+4}" font-size="11" text-anchor="middle" fill="#3e2f00">${l[2]}</text><line x1="360" y1="${y}" x2="450" y2="${y}" stroke="${c}" stroke-width="3"/>`
           :`<line x1="200" y1="${y}" x2="450" y2="${y}" stroke="${c}" stroke-width="3"/>`)+
      `<circle cx="450" cy="${y}" r="5" fill="${c}"/><text x="462" y="${y+5}" font-size="12" fill="currentColor">${l[1]}</text>`;}).join('');
  return `<svg class="mr-wire" viewBox="0 0 ${W} ${H}" role="img" aria-label="${spec.title}的接線圖"><text x="12" y="18" font-size="12" font-weight="700" fill="currentColor">${spec.left}</text><text x="462" y="18" font-size="12" font-weight="700" fill="currentColor">${spec.right}</text>${rows}</svg>`;
}
const wfig=(spec,f,cap)=>`<div class="mr-wfig fig">${f?photo(f,cap):''}<div>${wiring(spec)}${spec.extra?`<p class="mr-extra">${spec.extra}</p>`:''}</div></div>`;

/* =============================== M03 =============================== */
L.push({id:'M03',order:30.3,no:'M3',part:PART,title:'能接什麼、怎麼接、要準備哪些材料',mins:70,
goals:[['學會','myRIO 每一個接頭是做什麼的；MXP、MSP 每一隻腳的位置；接線前要先確認的電氣限制；常見元件（LED、按鈕、可變電阻、伺服馬達、直流馬達、編碼器、I2C 感測器）各接哪幾隻腳、為什麼。'],['做出','一張自己的材料清單和接線表：每一條線從 myRIO 第幾腳接到元件的哪一腳。'],['為什麼','接錯一條線，輕則讀不到，重則燒掉腳位。先把「這隻腳能承受什麼」想清楚，再動手。']],
check:'你能說出：MXP 的 DIO 輸出幾伏、輸入能不能接 5 V；LED 為什麼要串電阻；按鈕接 DIO 和地時，按下去讀到 TRUE 還是 FALSE；馬達為什麼不能直接接 DIO；伺服馬達的電為什麼不建議從 myRIO 拿。',
body:[
C.h3('情境','x','材料箱打開了，先別急著插線'),
`<p>你要用 myRIO 做一支小手臂：一個按鈕啟動、一個可變電阻調速度、一顆直流馬達轉關節、一顆伺服馬達開合夾爪、馬達上的編碼器回報角度、再加一顆感測器量傾斜。</p>
<p>材料都在桌上。這一課先回答三個問題：<b>myRIO 有哪些接頭、每一隻腳能做什麼、每一個元件要怎麼接才不會燒掉</b>。</p>`,

C.h3('第 1 步','','myRIO 身上有哪些接頭'),
C.table(['接頭','有什麼','適合接'],[
 ['MXP A、MXP B（兩個 34 腳的排針）','兩個接頭的訊號一模一樣：各有 4 路類比輸入（0～5 V）、2 路類比輸出（0～5 V）、16 路 DIO、UART，加上 +5 V、+3.3 V 電源','大部分的感測器、按鈕、LED、PWM、編碼器、I2C、SPI'],
 ['MSP C（20 腳的端子台）','2 路差動類比輸入（±10 V）、2 路類比輸出（±10 V）、8 路 DIO，加上 ±15 V、+5 V','工業常見的 ±10 V 訊號、需要負電壓的東西'],
 ['AUDIO IN、AUDIO OUT（立體聲插孔）','±2.5 V 的聲音訊號','麥克風前級、耳機'],
 ['USB Device','接電腦','寫程式、部署'],
 ['USB Host','USB 攝影機（UVC）、隨身碟（FAT16／FAT32，在 myRIO 上通常是 /U）','拍照、存資料'],
 ['板上','加速度計（±8 g）、4 顆 LED（LED0～3）、一個按鈕（Button0）','不用接線就能練習（M04）']
]),
note('MXP A 和 B 怎麼分','說明書：兩個接頭的訊號一模一樣，在程式裡用接頭的名字分，例如 ConnectorA/DIO1 和 ConnectorB/DIO1。所以 Express VI 的設定視窗裡，一定要選對是 A 還是 B。'),

C.h3('第 2 步','','MXP 腳位圖（A、B 一樣）'),
`<p>點任一隻腳看說明。腳位的排法照 NI 說明書：上排是奇數腳（右邊是第 1 腳），下排是偶數腳。<b>接線前一定要先找到第 1 腳</b>，myRIO 外殼和 MXP 轉接板上都有標。</p>`,
{fn:pinMap('mxp')},
ask('MXP 上有好幾隻 DGND 和一隻 AGND。接類比感測器時，地要接哪一隻？',
 `<p>說明書：AGND 是類比輸入、輸出的參考；DGND 是數位訊號、+5 V、+3.3 V 的參考。</p>
<p>所以可變電阻、類比感測器的地接 <b>AGND（第 6 腳）</b>；按鈕、LED、數位模組的地接 <b>DGND</b>。分開接，數位訊號切換時的雜訊比較不會跑進類比讀數。</p>`),

C.h3('第 3 步','','MSP 腳位圖'),
{fn:pinMap('msp')},
ask('一個工業用的壓力傳送器輸出 0～10 V，接 MXP 的 AI 還是 MSP 的 AI？',
 `<p>MSP。MXP 的類比輸入只到 5 V，10 V 會超出範圍（讀數卡在最大值）。MSP 的 AI0、AI1 是 ±10 V 的差動輸入：訊號接 AI0+，訊號的地接 AI0−，同時也要接 AGND。</p>`),

C.h3('第 4 步','','接線前，先記住這幾個數字'),
`<p>這張表決定了「什麼可以直接接、什麼要加東西」。每一個數字都出自 myRIO 說明書：</p>`,
C.table(['項目','數字','所以'],[
 ['DIO 輸出電壓','3.3 V（4 mA 時至少 2.4 V）','只能點亮小東西；馬達、繼電器線圈一定要經過驅動電路'],
 ['DIO 輸入','3.3 V 和 5 V 都相容（高電位 2.0～5.25 V）','5 V 的感測器輸出可以直接接 DIO 輸入'],
 ['MXP DIO0～13 的內部電阻','40 kΩ 上拉到 3.3 V','沒接東西時讀到 TRUE；按鈕可以直接接到地'],
 ['MXP DIO14、15','2.1 kΩ 上拉','這兩隻是 I2C，上拉已經內建'],
 ['MSP DIO','40 kΩ 下拉到地','沒接東西時讀到 FALSE，跟 MXP 相反'],
 ['MXP AI／AO','0～5 V、12 位元（一格約 1.22 mV）','超過 5 V 的訊號要分壓，或改用 MSP'],
 ['AO 能推多少電流','MXP 3 mA、MSP 2 mA','AO 是給訊號用的，不能直接推負載'],
 ['+5 V 電源輸出','每個接頭最多 100 mA','小感測器可以；馬達、伺服馬達要外接電源'],
 ['+3.3 V 電源輸出','每個接頭最多 150 mA','3.3 V 的模組（例如 I2C 感測器）可以用'],
 ['第二功能最高頻率','PWM 100 kHz、編碼器 100 kHz、I2C 400 kHz、SPI 4 MHz','規劃轉速、取樣時用得到']
]),
warn('這三件事最常燒東西','① 馬達、喇叭、繼電器線圈直接接 DIO 或 AO。② 外接電源的地沒有跟 myRIO 的地接在一起（共地），訊號沒有參考，元件亂動。③ 接線時沒斷電：插錯一隻腳，瞬間短路。<b>接線、改線一律先拔電源。</b>'),

C.h3('第 5 步','','材料清單'),
`<p>下面是做小手臂會用到的材料。每一樣寫了用途和要注意的地方。</p>`,
`<div class="mr-bom">
${[['breadboard.jpg','麵包板','不用焊接就能把元件接在一起。中間的溝把左右分開，同一排五個孔是通的。'],
 ['jumper.jpg','杜邦線（公對公、公對母）','從 MXP 排針（或轉接板）接到麵包板。多買幾種顏色：紅色電源、黑色地，之後比較好查線。'],
 ['led.jpg','LED（5 mm）','練數位輸出。長腳是正極。'],
 ['resistor.jpg','電阻（330 Ω、10 kΩ 各幾顆）','330 Ω 給 LED 限流；10 kΩ 給按鈕或分壓用。'],
 ['button.jpg','按鈕（輕觸開關）','練數位輸入、啟動和急停的邏輯。'],
 ['pot.jpg','可變電阻（10 kΩ）','練類比輸入：轉動就改變電壓。'],
 ['servo.jpg','小型伺服馬達（例如 SG90）','用 PWM 控制角度，適合做夾爪。'],
 ['dcmotor.jpg','小型直流馬達（最好附編碼器）','關節轉動；附編碼器的才量得到角度和轉速。'],
 ['hbridge.jpg','馬達驅動板（例如 TB6612FNG）','讓 3.3 V 的 DIO、PWM 控制馬達的方向和速度。'],
 ['imu.jpg','I2C 感測器模組（例如 MPU-6050）','練 I2C：讀角速度、加速度。'],
 ['multimeter.jpg','三用電表','接線後先量電壓、量通不通，再上電接 myRIO。']]
 .map(r=>`<figure class="mr-bomi">${photo(r[0],r[1]).replace('<figure class="mr-ph">','').replace('</figure>','')}<p>${r[2]}</p></figure>`).join('')}
</div>`,
C.table(['NI 原廠配件（說明書列的料號）','用途'],[
 ['myRIO-1900 電源供應器（723403-01）','myRIO 的電源。說明書：輸入 6～16 VDC'],
 ['MXP 轉接板（一組五片，782696-01）','把 MXP 的 34 腳排針轉成好接線的端子，最推薦'],
 ['MSP 替換接頭（765788-01）','MSP 端子台的插頭，掉了可以補'],
 ['面板安裝套件（783091-01）','把 myRIO 固定在機台上']
]),
tip('沒有轉接板也可以','MXP 是 2.54 mm 間距的排針，可以直接插杜邦線的母頭。缺點是容易插錯排、插偏一格。<b>接之前先數腳位，接之後用三用電表量一次。</b>'),

C.h3('接線 1','','LED：為什麼要串電阻'),
ask('LED 直接接 DIO0 和 DGND，不加電阻，會怎樣？',
 `<p>LED 一旦導通，本身幾乎不擋電流，電流只被 DIO 自己的極限擋住。說明書給的 DIO 輸出規格是在 4 mA 下量的；超過太多，輸出電壓會掉下來，長時間也可能傷到腳位。</p>
<p>所以串一顆電阻限制電流。算法（通用的電子學）：電阻 ＝（3.3 V − LED 壓降）÷ 想要的電流。綠光、紅光 LED 的壓降大約 2 V，想要 4 mA：(3.3 − 2) ÷ 0.004 ≈ 325 Ω，取常見的 330 Ω。</p>`),
{fn:d=>{d.innerHTML=wfig({title:'LED',left:'myRIO MXP A',right:'LED',links:[['第 11 腳 DIO0','LED 長腳（+）','330 Ω'],['第 12 腳 DGND','LED 短腳（−）','', '#37474f']],extra:'程式：Digital Output 寫 DIO0 = TRUE，LED 亮。'},'led.jpg','LED');}},

C.h3('接線 2','','按鈕：按下去是 TRUE 還是 FALSE？'),
`<p>按鈕一腳接 DIO1，另一腳接 DGND。先不要看答案，想想看。</p>`,
ask('沒按的時候，DIO1 讀到什麼？按下去讀到什麼？',
 `<p>說明書：MXP 的 DIO0～13 有 40 kΩ 的電阻上拉到 3.3 V。所以：</p>
<ul><li><b>沒按</b>：DIO1 只連著上拉電阻，被拉到 3.3 V，讀到 <b>TRUE</b>。</li><li><b>按下去</b>：DIO1 直接接到地，讀到 <b>FALSE</b>。</li></ul>
<p>跟直覺相反。程式裡要加一個 Not，或在命名時就寫「按鈕放開」。這叫「低電位有效」，工業上的急停按鈕常常故意這樣設計：線斷了也會讀到「按下」，比較安全。</p>
<p>注意：接到 <b>MSP</b> 的 DIO 時正好相反，MSP 是 40 kΩ 下拉，沒按讀 FALSE。同一個按鈕，換一個接頭，邏輯就反過來，這就是為什麼要先查腳位表。</p>`),
{fn:d=>{d.innerHTML=wfig({title:'按鈕',left:'myRIO MXP A',right:'按鈕',links:[['第 13 腳 DIO1','按鈕一腳'],['第 16 腳 DGND','按鈕另一腳','','#37474f']],extra:'不用另外加上拉電阻：MXP 的 DIO 已經內建 40 kΩ 上拉。按鈕會彈跳（說明書提醒板上的 Button0 沒有消除彈跳），程式要處理（M04）。'},'button.jpg','按鈕');}},

C.h3('接線 3','','可變電阻：把轉動變成 0～5 V'),
ask('可變電阻三隻腳，哪一隻接 AI0？兩端接什麼？',
 `<p>兩端接一個固定的電壓差：一端 +5 V（第 1 腳），一端 AGND（第 6 腳）。中間那隻（滑動端）接 AI0（第 3 腳）。轉動時，中間那隻的電壓在 0～5 V 之間變，剛好是 MXP AI 的範圍。</p>
<p>為什麼地接 AGND 不接 DGND：這是類比量測，用類比的參考（第 1 步問過）。</p>`),
{fn:d=>{d.innerHTML=wfig({title:'可變電阻',left:'myRIO MXP A',right:'可變電阻（10 kΩ）',links:[['第 1 腳 +5V','一端','','#c62828'],['第 3 腳 AI0','中間（滑動端）','','#e65100'],['第 6 腳 AGND','另一端','','#37474f']],extra:'讀到的值：0～5 V。說明書的類比輸入建議訊號源阻抗 3 kΩ 以下；10 kΩ 的可變電阻在中間位置時阻抗比較高，讀數可能稍微跳動，取平均就好（M05）。'},'pot.jpg','可變電阻');}},

C.h3('接線 4','','伺服馬達：訊號從 myRIO，電從外面'),
ask('伺服馬達三條線：電源、地、訊號。電源可以接 myRIO 的 +5 V 嗎？',
 `<p>說明書：MXP 的 +5 V 每個接頭最多 100 mA。小型伺服馬達轉動、尤其卡住時，電流常常比這個大很多（看你的伺服馬達規格）。從 myRIO 拿電，輕則 myRIO 重開機，重則保護電路動作。</p>
<p>所以：<b>電源和地接外部的 5～6 V 電源；訊號線接 myRIO 的 PWM；外部電源的地一定要接到 myRIO 的 DGND</b>（共地）。沒有共地，訊號沒有共同的參考，伺服馬達會亂抖。</p>
<p>訊號（通用的伺服馬達規格）：週期 20 ms（50 Hz），高電位 1～2 ms 對應不同角度。用 PWM Express VI 設頻率 50 Hz，改 duty cycle 就是改角度（M06）。</p>`),
{fn:d=>{d.innerHTML=wfig({title:'伺服馬達',left:'myRIO MXP A',right:'伺服馬達',links:[['第 27 腳 DIO8 / PWM0','訊號線（橘或黃）'],['第 28 腳 DGND','地（棕或黑）＋外部電源的負極','','#37474f']],extra:'伺服馬達的電源線（紅）接外部 5～6 V 電源的正極，<b>不要接 myRIO 的 +5V</b>。外部電源的負極同時接伺服馬達的地和 myRIO 的 DGND。'},'servo.jpg','伺服馬達');}},

C.h3('接線 5','','直流馬達：為什麼一定要驅動板'),
ask('直流馬達兩條線，一條接 PWM0、一條接 DGND，讓它轉，可以嗎？',
 `<p>不行。三個原因：DIO 只有 3.3 V、幾 mA，推不動馬達；馬達是線圈，斷電時會產生反向的電壓尖峰，直接打回腳位；而且這樣只能單方向轉。</p>
<p>中間要加一塊<b>馬達驅動板</b>（H 橋）。myRIO 只送「方向」和「速度（PWM）」兩種小訊號，大電流由驅動板從外部電源接給馬達。</p>
<p>選驅動板時，看它的<b>邏輯電壓</b>：myRIO 的輸出是 3.3 V，驅動板要能接受 3.3 V 的控制訊號。以 TB6612FNG 為例（元件規格），邏輯電源 2.7～5.5 V，可以直接用 myRIO 的 +3.3 V 供電、直接吃 3.3 V 訊號。</p>`),
{fn:d=>{d.innerHTML=wfig({title:'直流馬達與驅動板',left:'myRIO MXP A',right:'TB6612FNG 驅動板',links:[['第 27 腳 DIO8 / PWM0','PWMA（速度）'],['第 11 腳 DIO0','AIN1（方向）'],['第 13 腳 DIO1','AIN2（方向）'],['第 15 腳 DIO2','STBY（TRUE 才會動）'],['第 33 腳 +3.3V','VCC（邏輯電源）','','#c62828'],['第 30 腳 DGND','GND','','#37474f']],extra:'馬達接驅動板的 A01、A02；驅動板的 VM 接外部馬達電源（依你的馬達電壓）。外部電源的負極接驅動板 GND，也就和 myRIO 共地了。AIN1、AIN2 一個 TRUE 一個 FALSE 決定轉向；兩個都 FALSE 是停止（以驅動板說明為準）。'},'hbridge.jpg','馬達驅動板 TB6612FNG');}},

C.h3('接線 6','','編碼器：馬達轉了多少'),
ask('馬達後面的編碼器有 A、B 兩條訊號線，為什麼要兩條？',
 `<p>一條線只能數「轉了幾格」。兩條線的方波錯開四分之一個週期：A 先變還是 B 先變，就知道轉的方向。這叫正交（quadrature）編碼器。</p>
<p>說明書：MXP 的 DIO11 是 ENC.A（第 18 腳）、DIO12 是 ENC.B（第 22 腳）；MSP 有兩組（ENC0、ENC1）。最高 100 kHz。用 Encoder Express VI 讀，會直接給你計數值和方向（M07）。</p>`),
{fn:d=>{d.innerHTML=wfig({title:'編碼器',left:'myRIO MXP A',right:'馬達的編碼器',links:[['第 18 腳 DIO11 / ENC.A','A 相'],['第 22 腳 DIO12 / ENC.B','B 相'],['第 1 腳 +5V','編碼器電源（看規格，有的是 3.3 V）','','#c62828'],['第 20 腳 DGND','編碼器地','','#37474f']],extra:'編碼器輸出 5 V 的方波也可以直接接：說明書寫 DIO 輸入是 3.3 V／5 V 相容。'},'','')}},

C.h3('接線 7','','I2C 感測器：兩條線接很多顆'),
ask('MPU-6050 模組有 VCC、GND、SCL、SDA。要不要自己加上拉電阻？',
 `<p>I2C 的兩條線（SCL、SDA）需要上拉電阻。說明書：MXP 的 DIO14（I2C.SCL，第 32 腳）、DIO15（I2C.SDA，第 34 腳）已經有 2.1 kΩ 上拉到 3.3 V，一般不用再加。很多模組自己也有上拉，兩組並在一起通常也能用。</p>
<p>電源用 +3.3 V（第 33 腳），I2C 的電壓就是 3.3 V，跟 myRIO 一致。MPU-6050 常見的位址是 0x68（元件規格；看模組上 AD0 那隻腳接哪裡），在 I2C Express VI 裡要填這個位址（M08）。</p>`),
{fn:d=>{d.innerHTML=wfig({title:'I2C 感測器',left:'myRIO MXP A',right:'MPU-6050 模組',links:[['第 33 腳 +3.3V','VCC','','#c62828'],['第 30 腳 DGND','GND','','#37474f'],['第 32 腳 DIO14 / I2C.SCL','SCL'],['第 34 腳 DIO15 / I2C.SDA','SDA']],extra:'同一組 SCL、SDA 可以掛好幾顆 I2C 元件，用位址分辨。'},'imu.jpg','I2C 感測器模組')}},

C.h3('第 6 步','','接上 myRIO 之前的檢查表'),
C.table(['順序','做什麼','為什麼'],[
 ['1','myRIO 和外部電源都斷電','插錯一格就短路'],
 ['2','照接線表接，一條接完打一個勾','漏接、接錯排最常見'],
 ['3','三用電表：量外部電源的電壓、量各個「地」之間是不是通的','共地是很多問題的根源'],
 ['4','先接電源，用 I/O Monitor（M01）一隻一隻試','還沒寫程式，出錯一定是線'],
 ['5','I/O Monitor 都對了，才開專案寫程式（M02）','一次只解一個未知數']
]),

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'MXP 的 DIO 輸出高電位是幾伏？',o:['3.3 V','5 V','12 V','10 V'],a:0,ex:'輸入是 3.3 V／5 V 相容，輸出是 3.3 V。'},
 {q:'按鈕接在 MXP 的 DIO1 和 DGND 之間，按下去讀到？',o:['FALSE（MXP DIO 有 40 kΩ 上拉）','TRUE','不一定','錯誤'],a:0,ex:'沒按時被上拉成 TRUE，按下去接地變 FALSE。接 MSP 時相反。'},
 {q:'0～10 V 的感測器輸出要接哪裡？',o:['MSP 的 AI（±10 V 差動）','MXP 的 AI','DIO','AUDIO IN'],a:0,ex:'MXP 的 AI 只到 5 V。'},
 {q:'伺服馬達的電源線應該接？',o:['外部 5～6 V 電源，並跟 myRIO 共地','myRIO 的 +5V','myRIO 的 AO0','DIO'],a:0,ex:'+5 V 每個接頭只有 100 mA。'},
 {q:'直流馬達為什麼要經過驅動板？',o:['DIO 只有 3.3 V、幾 mA，而且馬達的反向電壓會打回腳位','驅動板比較便宜','不需要','為了讓 LED 亮'],a:0,ex:'myRIO 只送方向和 PWM 小訊號，大電流由驅動板從外部電源給。'},
 {q:'I2C 的 SCL、SDA 接 MXP 的哪兩隻腳？',o:['第 32 腳（DIO14）、第 34 腳（DIO15）','第 1、2 腳','第 27、29 腳','第 18、22 腳'],a:0,ex:'第 18、22 腳是編碼器；第 27、29 腳是 PWM。'},
 {q:'LED 串 330 Ω 電阻是為了？',o:['限制電流，保護 LED 和 DIO 腳位','讓 LED 更亮','讓程式跑快一點','沒有用'],a:0,ex:'(3.3 − 2) ÷ 330 ≈ 4 mA。'},
 {q:'可變電阻的地接 AGND 還是 DGND？',o:['AGND：它是類比量測的參考','DGND','都不接','接 +3.3V'],a:0,ex:'類比接 AGND、數位接 DGND，雜訊比較小。'}
]},
C.h3('圖片來源','',''),
'<ul class="mr-credit"><li>400 points breadboard.jpg：oomlout，<a href="https://commons.wikimedia.org/wiki/File:400_points_breadboard.jpg" rel="noopener">CC BY-SA 2.0</a></li><li>A few Jumper Wires.jpg：oomlout，<a href="https://commons.wikimedia.org/wiki/File:A_few_Jumper_Wires.jpg" rel="noopener">CC BY-SA 2.0</a></li><li>LED Rainbow Pack - 5mm PTH 12903-01.jpg：SparkFun Electronics，<a href="https://commons.wikimedia.org/wiki/File:LED_Rainbow_Pack_-_5mm_PTH_12903-01.jpg" rel="noopener">CC BY 2.0</a></li><li>220 ohms 5% axial resistor.jpg：oomlout，<a href="https://commons.wikimedia.org/wiki/File:220_ohms_5%25_axial_resistor.jpg" rel="noopener">CC BY-SA 2.0</a></li><li>Tactile Switches (3101960804).jpg：walknboston，<a href="https://commons.wikimedia.org/wiki/File:Tactile_Switches_(3101960804).jpg" rel="noopener">CC BY 2.0</a></li><li>10k Ohm Breadboard Compatible Potentiometer.jpg：oomlout，<a href="https://commons.wikimedia.org/wiki/File:10k_Ohm_Breadboard_Compatible_Potentiometer.jpg" rel="noopener">CC BY-SA 2.0</a></li><li>Tower Pro SG90 micro servo motor.jpg：Suyash Dwivedi，<a href="https://commons.wikimedia.org/wiki/File:Tower_Pro_SG90_micro_servo_motor.jpg" rel="noopener">CC BY-SA 4.0</a></li><li>SparkFun Motor Driver - Dual TB6612FNG (with Headers)：SparkFunElectronics，<a href="https://www.flickr.com/photos/41898857@N04/29731275240" rel="noopener">CC BY 2.0</a></li><li>Electronic-Component-Screw-DC-Motor.jpg：Evan-Amos，<a href="https://commons.wikimedia.org/wiki/File:Electronic-Component-Screw-DC-Motor.jpg" rel="noopener">Public domain</a></li><li>HC SR04 Ultrasonic Module.jpg：Suyash Dwivedi，<a href="https://commons.wikimedia.org/wiki/File:HC_SR04_Ultrasonic_Module.jpg" rel="noopener">CC BY-SA 4.0</a></li><li>GY-521 MPU-6050 Module 3 Axis Gyroscope + Accelerometer 0487.jpg：Nevit Dilmen (talk)，<a href="https://commons.wikimedia.org/wiki/File:GY-521_MPU-6050_Module_3_Axis_Gyroscope_%2B_Accelerometer_0487.jpg" rel="noopener">CC BY-SA 3.0</a></li><li>Digital Multimeter Aka.jpg：André Karwath aka Aka，<a href="https://commons.wikimedia.org/wiki/File:Digital_Multimeter_Aka.jpg" rel="noopener">CC BY-SA 2.5</a></li></ul><p class="mr-credit">myRIO 的腳位圖、接線圖依 NI myRIO-1900 User Guide and Specifications 繪製。</p>'
]});
})();
