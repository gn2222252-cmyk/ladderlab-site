/* 第九部分：myRIO（M04～M07）：數位、類比、PWM、編碼器與閉迴路。
   硬體事實出自 NI myRIO-1900 User Guide and Specifications：LED0～3 TRUE 亮；Button0 按下 TRUE、沒有消除彈跳；
   加速度計 ±8 g、12 位元、800 S/s；MXP AI 0～5 V、12 位元、準確度 ±50 mV、建議源阻抗 3 kΩ 以下；類比輸入共用一顆 ADC、總取樣率 500 kS/s；
   MXP AO 0～5 V、3 mA；AO 啟動時是 0 V；PWM、編碼器最高 100 kHz。
   Express VI 的名字以 myRIO 函式選單為準；設定視窗的細節各版本略有不同，課文只講「要選什麼」。
   伺服馬達 50 Hz、1～2 ms、直流馬達 PWM 頻率的選法、比例控制，是通用的控制與電子知識。 */
(function(){
const L=window.LESSONS;
const PART='myRIO 嵌入式控制';
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
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
function plotSvg(series,opt){
  opt=opt||{};const W=560,H=opt.h||140,P=28,all=[].concat(...series.map(s=>s.y));
  const mn=opt.min!=null?opt.min:Math.min(...all),mx=opt.max!=null?opt.max:Math.max(...all),sp=(mx-mn)||1,n=Math.max(...series.map(s=>s.y.length));
  const X=i=>P+i/(n-1)*(W-P-6),Y=v=>H-14-(v-mn)/sp*(H-28);
  const lines=series.map(s=>`<polyline points="${s.y.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ')}" fill="none" stroke="${s.c}" stroke-width="${s.w||1.6}"${s.step?' stroke-linejoin="miter"':''}/>`).join('');
  const ref=(opt.ref||[]).map(r=>`<line x1="${P}" x2="${W-6}" y1="${Y(r[0])}" y2="${Y(r[0])}" stroke="${r[1]}" stroke-dasharray="4 3"/><text x="${W-8}" y="${Y(r[0])-3}" font-size="10" text-anchor="end" fill="${r[1]}">${r[2]}</text>`).join('');
  return `<svg class="mr-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${opt.label||'波形'}"><line x1="${P}" y1="${H-14}" x2="${W-6}" y2="${H-14}" stroke="currentColor" stroke-opacity=".3"/><text x="2" y="${Y(mx)+4}" font-size="10" fill="currentColor">${opt.fmt?opt.fmt(mx):mx}</text><text x="2" y="${Y(mn)+4}" font-size="10" fill="currentColor">${opt.fmt?opt.fmt(mn):mn}</text>${ref}${lines}</svg>`;
}

/* ---------- M04 按鈕彈跳模擬 ---------- */
function bounceLab(d){
  const id='bn'+(++UID),S={m:'level'};
  d.innerHTML=`<div class="planlab fig"><p class="wf-note">模擬：按鈕按 3 次。每一次按下、放開，金屬接點都會彈跳幾毫秒。迴圈每 1 ms 讀一次 Button0。</p>
<div class="wf-opts">${radios(id,'m','程式怎麼數',[['level','每一圈讀到 TRUE 就加 1'],['edge','只在 FALSE → TRUE 那一圈加 1（上升緣）'],['deb','上升緣，而且要連續 20 ms 都是 TRUE 才算']],S.m)}</div><div class="bn-plot"></div><p class="verdict-line" aria-live="polite"></p></div>`;
  const sig=[];let r=7;const rnd=()=>{r=(r*1103515245+12345)%2147483648;return r/2147483648;};
  const presses=[[60,180],[300,420],[540,640]];
  for(let t=0;t<720;t++){let v=0;presses.forEach(([a,b])=>{if(t>=a&&t<b)v=1;if((t>=a&&t<a+6)||(t>=b&&t<b+5))v=rnd()<.5?1:0;});sig.push(v);}
  function run(){
    S.m=pick(d,id,'m');let cnt=0,prev=0,hold=0,armed=true;const marks=sig.map(()=>0);
    sig.forEach((v,t)=>{
      if(S.m==='level'){if(v){cnt++;marks[t]=1;}}
      else if(S.m==='edge'){if(v&&!prev){cnt++;marks[t]=1;}}
      else{hold=v?hold+1:0;if(!v)armed=true;if(hold===20&&armed){cnt++;marks[t]=1;armed=false;}}
      prev=v;});
    d.querySelector('.bn-plot').innerHTML=plotSvg([{y:sig,c:'#1565c0'},{y:marks.map(m=>m?1.15:-0.15),c:'#c62828',w:2}],{min:-0.2,max:1.2,h:120,label:'按鈕訊號與計數點',fmt:v=>v>0.5?'TRUE':'FALSE'});
    const ok=cnt===3,say=d.querySelector('.verdict-line');
    say.className='verdict-line '+(ok?'ok':'bad');
    say.textContent=S.m==='level'?`✖ 數到 ${cnt} 次。按著的每一毫秒都被算一次：「讀到 TRUE」和「按了一下」不是同一件事。`
      :S.m==='edge'?`${ok?'✔':'✖'} 數到 ${cnt} 次。上升緣解決了「按著不放」，可是接點彈跳時 FALSE、TRUE 來回好幾次，每一次跳回 TRUE 都被當成新的一下。`
      :`✔ 數到 ${cnt} 次。彈跳只有幾毫秒，要求連續 20 ms 都是 TRUE，就把彈跳濾掉了；放開之後才重新等下一次。`;
  }
  d.addEventListener('change',run);run();
}

/* ---------- M05 平均與量化 ---------- */
function avgLab(d){
  const id='av'+(++UID),S={n:'1'};
  d.innerHTML=`<div class="planlab fig"><p class="wf-note">模擬：可變電阻停在 2.000 V，MXP AI0 讀 200 次（12 位元，一格 1.221 mV，加上一點雜訊）。每一個點是「讀 N 次取平均」的結果。</p>
<div class="wf-opts">${radios(id,'n','每一點平均幾次',[['1','1 次（不平均）'],['10','10 次'],['100','100 次']],S.n)}</div><div class="av-plot"></div><p class="verdict-line" aria-live="polite"></p></div>`;
  let r=11;const rnd=()=>{r=(r*1103515245+12345)%2147483648;return r/2147483648;};
  const g=()=>(rnd()+rnd()+rnd()+rnd()-2)*1.7;
  const lsb=5/4096,read=()=>Math.round((2+g()*0.004)/lsb)*lsb;
  function run(){
    const n=+pick(d,id,'n');const y=[];for(let i=0;i<200;i++){let s=0;for(let k=0;k<n;k++)s+=read();y.push(s/n);}
    const mn=Math.min(...y),mx=Math.max(...y);
    d.querySelector('.av-plot').innerHTML=plotSvg([{y,c:'#e65100'}],{min:1.985,max:2.015,h:130,label:'類比讀數',fmt:v=>v.toFixed(3)+' V',ref:[[2,'#2e7d32','2.000 V']]});
    const say=d.querySelector('.verdict-line');say.className='verdict-line '+(n>1?'ok':'');
    say.textContent=`最大 ${mx.toFixed(4)} V、最小 ${mn.toFixed(4)} V，跳動 ${((mx-mn)*1000).toFixed(1)} mV。`+(n===1?'不平均時看得到一格一格的階梯（1.221 mV）和雜訊。':n===10?'平均 10 次，跳動小了很多。代價是每一點要讀 10 次。':'平均 100 次更穩，但每一點花的時間是 100 倍：變化快的訊號會被「平均掉」。');
  }
  d.addEventListener('change',run);run();
}

/* ---------- M06 PWM ---------- */
function pwmLab(d){
  const id='pw'+(++UID),S={f:'50',duty:'7.5'};
  d.innerHTML=`<div class="planlab fig"><div class="wf-opts">${radios(id,'f','頻率',[['50','50 Hz（週期 20 ms）'],['1000','1 kHz'],['20000','20 kHz']],S.f)}${radios(id,'duty','Duty cycle（高電位佔幾 %）',[['5','5 %'],['7.5','7.5 %'],['10','10 %'],['50','50 %'],['90','90 %']],S.duty)}</div><div class="pw-plot"></div><p class="verdict-line" aria-live="polite"></p></div>`;
  function run(){
    const f=+pick(d,id,'f'),dc=+pick(d,id,'duty'),T=1000/f,hi=T*dc/100,y=[];
    for(let i=0;i<400;i++){const t=(i/400)*3*T;y.push((t%T)<hi?3.3:0);}
    const avg=3.3*dc/100;
    d.querySelector('.pw-plot').innerHTML=plotSvg([{y,c:'#1565c0'}],{min:-0.2,max:3.6,h:120,label:'PWM 波形，三個週期',fmt:v=>v.toFixed(1)+' V',ref:[[avg,'#c62828','平均 '+avg.toFixed(2)+' V']]});
    let msg=`週期 ${T>=1?T.toFixed(T<10?2:0)+' ms':(T*1000).toFixed(0)+' µs'}，高電位 ${hi>=1?hi.toFixed(2)+' ms':(hi*1000).toFixed(1)+' µs'}，平均電壓 ${avg.toFixed(2)} V。`;
    if(f===50){const ang=Math.max(0,Math.min(180,(hi-1)*180));msg+=hi>=0.95&&hi<=2.05?` 伺服馬達看的是高電位多長：${hi.toFixed(2)} ms，大約 ${ang.toFixed(0)}°（以 1 ms＝0°、2 ms＝180° 估算，實際看你的伺服馬達規格）。`:' 伺服馬達要的是 1～2 ms 的脈波，這個 duty 已經超出範圍：伺服馬達可能撞到極限、發熱。';}
    else msg+=' 直流馬達經過驅動板時，轉速大約跟平均電壓成正比：duty 就是油門。'+(f===1000?'1 kHz 在人耳聽得到的範圍，馬達可能會「嗡嗡」叫。':'20 kHz 超過人耳範圍，馬達比較安靜（myRIO 的 PWM 最高 100 kHz；驅動板也要支援這個頻率）。');
    const say=d.querySelector('.verdict-line');say.className='verdict-line';say.textContent=msg;
  }
  d.addEventListener('change',run);run();
}

/* ---------- M07 比例控制 ---------- */
function pLab(d){
  const id='pc'+(++UID),S={kp:'2',sat:'1'};
  d.innerHTML=`<div class="planlab fig"><p class="wf-note">模擬：馬達接驅動板、後面有編碼器。目標是轉到 90°。每 10 ms：讀編碼器 → 算誤差 → 輸出 PWM duty。馬達有慣性，也有摩擦（duty 太小轉不動）。</p>
<div class="wf-opts">${radios(id,'kp','Kp（誤差 1° 給多少 % duty）',[['0.3','0.3'],['2','2'],['8','8']],S.kp)}${radios(id,'sat','duty 的限制',[['1','限制在 −100～100 %'],['0','不限制（程式算多少就給多少）']],S.sat)}</div><div class="pc-plot"></div><p class="verdict-line" aria-live="polite"></p></div>`;
  function run(){
    const kp=+pick(d,id,'kp'),sat=pick(d,id,'sat')==='1',y=[],u=[];let x=0,v=0,over=false;
    for(let k=0;k<300;k++){let e=90-x,duty=kp*e;if(sat)duty=Math.max(-100,Math.min(100,duty));else if(Math.abs(duty)>100)over=true;
      let drive=Math.max(-100,Math.min(100,duty)),f=Math.abs(drive)<8?0:drive-Math.sign(drive)*8;
      v+=(f*9-v*4)*0.01;x+=v*0.01;y.push(x);u.push(duty);}
    const last=y[y.length-1],peak=Math.max(...y);
    d.querySelector('.pc-plot').innerHTML=plotSvg([{y,c:'#1565c0'}],{min:0,max:Math.max(110,peak+5),h:140,label:'角度對時間（3 秒）',fmt:v=>v.toFixed(0)+'°',ref:[[90,'#2e7d32','目標 90°']]});
    let msg=`3 秒後停在 ${last.toFixed(1)}°，最高衝到 ${peak.toFixed(1)}°。`;
    if(kp<1)msg+='Kp 太小：快到目標時誤差變小，duty 跟著變小，小到推不動摩擦，就停在差一點的地方（穩態誤差）。';
    else if(kp>5)msg+='Kp 太大：反應很快，但衝過頭再拉回來，來回擺動。';
    else msg+='反應和超越量比較平衡。剩下的一點誤差，要加積分（I）才消得掉。';
    if(!sat&&over)msg+=' 注意：程式算出來的 duty 超過 100 %，PWM Express VI 只能輸出 0～100 %，實際上會被截掉。程式裡自己先限制，才知道送出去的是多少。';
    const say=d.querySelector('.verdict-line');say.className='verdict-line';say.textContent=msg;
  }
  d.addEventListener('change',run);run();
}

/* =============================== M04 =============================== */
L.push({id:'M04',order:30.4,no:'M4',part:PART,title:'數位輸入輸出：LED、按鈕，和「按一下」到底是什麼',mins:50,
goals:[['學會','LED、Button、Digital Input／Output 這幾個 Express VI 怎麼設定；為什麼「讀到 TRUE」不等於「按了一下」；用 Shift Register 抓上升緣；按鈕彈跳是什麼、怎麼濾掉。'],['做出','按一下 Button0（或外接按鈕），LED0～3 依序亮下一顆。'],['為什麼','機台上的「啟動」「確認」都是按一下就做一次。數錯一次，機器就多動一次。']],
check:'你能說出：按住按鈕時迴圈每一圈都讀到 TRUE 會造成什麼問題；上升緣要記住什麼、放在哪裡；彈跳大約多久、怎麼濾；外接在 MXP 的按鈕按下去讀到什麼。',
body:[
C.h3('情境','x','按一下，換下一顆燈'),
`<p>先不接任何線：myRIO 板上就有 4 顆 LED（LED0～3）和一個按鈕（Button0）。說明書：LED 寫 TRUE 就亮；Button0 按下去是 TRUE。</p>
<p>目標：每按一下 Button0，亮的燈往下一顆移。聽起來很簡單，先照最直覺的方法寫一次。</p>`,
C.h3('第 1 步','','把 Express VI 放進迴圈'),
`<ol class="mr-steps"><li>從 M02 的範本專案開始，打開 myRIO 底下的 Main.vi（確認標題列斜線後面是 myRIO）。</li>
<li>方塊圖按右鍵 ▸ myRIO 函式選單，把 <b>Button</b> 和 <b>LED</b> 兩個 Express VI 放進 Main Loop。</li>
<li>放下去時會跳出設定視窗：Button 選 Button0；LED 勾要用的 LED。之後雙擊 Express VI 可以再改（範本的註解也這樣寫）。</li>
<li>外接的按鈕、LED 用 <b>Digital Input</b>、<b>Digital Output</b>：設定時要選接頭（A、B 或 C）和腳（例如 A/DIO1）。</li></ol>`,
ask('最直覺的寫法：讀到 Button0 是 TRUE，就把「第幾顆燈」加 1。按一下會怎樣？',
 `<p>迴圈大約每 10 ms 跑一圈。你按一下，手指至少按住 100～200 ms，這段時間每一圈都讀到 TRUE：燈一下子跳了十幾格。</p>
<p>問題在於：<b>「現在是 TRUE」是一個狀態，「按了一下」是一個事件</b>。事件是「上一圈 FALSE、這一圈 TRUE」那一瞬間，叫上升緣。</p>`),
ask('要知道「上一圈是 FALSE」，程式要怎麼做？',
 `<p>要記住上一圈的值：這一圈的值，下一圈要用，所以是 <b>Shift Register</b>。這一圈的 Button 值 AND（NOT 上一圈的值）＝ 上升緣。這跟 I4 「Shift Register 是被『下一圈要用』逼出來的」是同一件事。</p>`),
C.h3('第 2 步','','彈跳：上升緣也會數錯'),
`<p>改成上升緣之後，大部分時候對了，偶爾還是會一次跳兩三格。說明書有一句：<b>Button0 沒有做消除彈跳（not debounced）</b>。下面模擬按 3 次，換三種數法看看。</p>`,
{fn:bounceLab},
ask('彈跳的時間大約多久？濾波要等多久才合理？',
 `<p>機械接點的彈跳通常是幾毫秒到十幾毫秒（通用經驗，每顆按鈕不同）。等 20 ms 能濾掉大部分；人按一下至少一百多毫秒，所以 20 ms 不會漏掉真的按壓。</p>
<p>要確認你的按鈕：用 Digital Input 在迴圈裡每 1 ms 讀一次、把結果存成陣列畫出來，實際看彈跳有多長。<b>先看資料，再決定數字</b>，跟接儀器一樣。</p>`),
flow(['初始化：亮 LED0',{loop:['讀 Button0','連續 TRUE 的毫秒數＋1（FALSE 就歸 0）',{kase:['剛好到 20 ms：第幾顆＋1（到 4 回 0）','其他：不動'],label:'剛好滿 20 ms？'},'寫 LED（只亮第幾顆那一顆）','Wait 1 ms'],label:'While Loop',sr:'連續 TRUE 的毫秒數、第幾顆'},'Close：Reset myRIO.vi（燈全關）']),
C.h3('第 3 步','','外接按鈕：邏輯反過來'),
ask('M03 的外接按鈕接在 MXP A 的 DIO1 和 DGND。程式要改哪裡？',
 `<p>MXP 的 DIO 有 40 kΩ 上拉：沒按是 TRUE，按下去是 FALSE，跟 Button0 相反。讀進來之後先接一個 Not，後面的上升緣、濾波都不用改。</p>
<p>好習慣：在 Express VI 後面<b>立刻</b>把它轉成「按下＝TRUE」，並在線上加標籤「啟動鈕（按下＝TRUE）」。以後誰來看都不會搞反。</p>`),
C.table(['輸入來源','沒按','按下'],[['板上 Button0','FALSE','TRUE'],['MXP DIO（40 kΩ 上拉）接到地','TRUE','FALSE'],['MSP DIO（40 kΩ 下拉）接到 +5V／+3.3V','FALSE','TRUE']]),
C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'迴圈每 10 ms 一圈，「讀到 TRUE 就加 1」，按一下會加多少？',o:['十幾次（按住的每一圈都算）','1 次','0 次','不一定是 1 或 2'],a:0,ex:'狀態和事件是兩回事。'},
 {q:'抓上升緣要記住什麼？',o:['上一圈按鈕的值，放在 Shift Register','這一圈的值','按鈕的腳位','LED 的狀態'],a:0,ex:'這一圈 TRUE 而且上一圈 FALSE。'},
 {q:'Button0 有做消除彈跳嗎？',o:['沒有，說明書寫 not debounced','有','看版本','只有放開時有'],a:0,ex:'程式要自己濾。'},
 {q:'外接按鈕在 MXP DIO 和 DGND 之間，按下去讀到？',o:['FALSE','TRUE','錯誤','跳動'],a:0,ex:'40 kΩ 上拉，按下去接地。'},
 {q:'彈跳濾波設 20 ms 的理由？',o:['彈跳通常只有幾毫秒，人按一下至少一百多毫秒','規定','越長越好','LED 需要'],a:0,ex:'先實際量你的按鈕，再決定。'}
]}
]});

/* =============================== M05 =============================== */
L.push({id:'M05',order:30.5,no:'M5',part:PART,title:'類比輸入輸出：讀可變電阻、輸出電壓，數字為什麼會跳',mins:50,
goals:[['學會','Analog Input／Output Express VI；讀到的電壓怎麼換成你要的物理量；12 位元、±50 mV 是什麼意思；平均的好處和代價；AO 能推什麼、不能推什麼。'],['做出','轉可變電阻改變 LED 閃爍的快慢；AO0 輸出一個電壓，用 AI0 讀回來驗證。'],['為什麼','感測器大多給電壓。讀到的數字怎麼解讀、要不要平均、平均多少，決定了你的控制穩不穩。']],
check:'你能說出：MXP AI 一格是多少 mV；讀數跳動 2～3 mV 是不是壞了；平均 100 次的代價；為什麼 AO 不能直接推馬達。',
body:[
C.h3('情境','x','用可變電阻調速度'),
`<p>照 M03 的接線 3：可變電阻兩端接 +5V（第 1 腳）和 AGND（第 6 腳），中間接 AI0（第 3 腳）。目標：轉到底是最快，轉到另一頭是最慢。</p>`,
C.h3('第 1 步','','先看原始數字'),
`<ol class="mr-steps"><li>放一個 <b>Analog Input</b> Express VI 進 Main Loop，設定選 A/AI0。</li><li>輸出接一個數值指示器和一張 Waveform Chart。</li><li>執行，慢慢轉可變電阻，看數字怎麼變。<b>先不要換算</b>。</li></ol>`,
ask('轉到底讀到 4.99 V 左右，轉到另一頭讀到 0.00x V。中間停住不動，最後一兩位一直在跳。正常嗎？',
 `<p>正常。說明書：MXP 的 AI 是 0～5 V、12 位元：5 V ÷ 4096 ≈ <b>1.221 mV 一格</b>，最大讀數 4095 格 ≈ 4.999 V。準確度大約 ±50 mV。</p>
<p>停住不動也會在一兩格之間跳：雜訊加上量化。這不是壞掉，而是你要決定「多穩才夠用」。</p>`),
C.h3('第 2 步','','要不要平均？平均多少？'),
{fn:avgLab},
ask('平均越多越好嗎？',
 `<p>不是。平均 100 次，讀數很穩，可是每一點要讀 100 次：如果迴圈每圈都讀 100 次，迴圈就變慢；如果訊號本身在快速變化（例如震動），平均會把變化也抹掉。</p>
<p>決定的方法：先問「這個訊號多快會變」。可變電阻是人手轉的，幾百毫秒才變一次，平均 10～50 次很合理。量震動、聲音就不能這樣平均。說明書提醒：所有類比輸入共用一顆 ADC，總取樣率 500 kS/s，讀越多通道、每通道能分到的越少。</p>`),
C.h3('第 3 步','','電壓換成你要的東西'),
ask('可變電阻 0～5 V，要變成 LED 閃爍間隔 100～1000 ms。公式怎麼寫？',
 `<p>線性換算：間隔 ＝ 100 ＋（電壓 ÷ 5）×（1000 − 100）。0 V → 100 ms，5 V → 1000 ms。</p>
<p>再加一個保險：In Range and Coerce 把結果限制在 100～1000 之間。讀數偶爾會超過 4.999 或低於 0（雜訊、接觸不良），不限制的話，間隔可能變成負的。這跟 I14「寫之前先檢查範圍」是一樣的想法。</p>`),
C.h3('第 4 步','','類比輸出：AO0 → AI0 自己驗證'),
`<p>拿一條線接 AO0（第 2 腳）和 AI0（第 3 腳）。用 <b>Analog Output</b> 輸出 2.5 V，Analog Input 讀回來。</p>`,
ask('讀回來 2.47 V，差了 30 mV。哪裡出錯？',
 `<p>沒有出錯。AO 和 AI 的準確度各大約 ±50 mV（說明書），兩個加起來差個幾十 mV 在規格內。要更準，要用三用電表量實際的電壓，做校正（記下差多少，程式裡補回去）。</p>`),
warn('AO 不是電源','說明書：MXP 的 AO 最多推 3 mA，MSP 2 mA。它是給其他設備的「控制訊號」（例如給變頻器 0～5 V 的速度命令），不能直接推 LED 以外的負載，更不能推馬達。另外，AO 在 FPGA 初始化後是 0 V：程式啟動的那一刻，接在 AO 上的設備會先收到 0。'),
C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'MXP AI 一格（1 LSB）大約多少？',o:['1.221 mV','5 mV','0.1 V','12 mV'],a:0,ex:'5 V ÷ 4096。'},
 {q:'讀數停在一個值附近跳 2～3 mV，代表？',o:['正常的雜訊和量化','AI 壞了','接錯腳','要換 MSP'],a:0,ex:'先決定需要多穩，再決定要不要平均。'},
 {q:'平均 100 次的代價？',o:['每一點要讀 100 次，變慢，而且快速變化會被抹掉','沒有代價','讀數變大','會燒掉'],a:0,ex:'看訊號多快會變再決定。'},
 {q:'換算後為什麼要 In Range and Coerce？',o:['雜訊或接觸不良時，結果不會跑出合理範圍','讓它變快','LabVIEW 規定','為了畫圖'],a:0,ex:'寫給設備之前先檢查範圍。'},
 {q:'MXP AO 可以直接推馬達嗎？',o:['不行，最多 3 mA','可以','只要 5 V 以下就可以','加電阻就可以'],a:0,ex:'AO 是控制訊號。'}
]}
]});

/* =============================== M06 =============================== */
L.push({id:'M06',order:30.6,no:'M6',part:PART,title:'PWM：伺服馬達的角度、直流馬達的速度',mins:55,
goals:[['學會','PWM 的頻率和 duty cycle 各管什麼；伺服馬達為什麼要 50 Hz、duty 只能在小範圍；直流馬達的 PWM 頻率怎麼選；方向腳和 PWM 腳的順序。'],['做出','可變電阻轉動 → 伺服馬達跟著轉；按鈕切換直流馬達正反轉，可變電阻調速。'],['為什麼','myRIO 控制馬達幾乎都是靠 PWM。同一個 Express VI，參數設錯就是伺服馬達撞到底、直流馬達嗡嗡叫。']],
check:'你能說出：50 Hz、7.5 % 的高電位多長；伺服馬達的 duty 為什麼不能設 50 %；直流馬達改方向前為什麼要先把 duty 降到 0；PWM 的最高頻率。',
body:[
C.h3('情境','x','夾爪和關節'),
`<p>小手臂上有兩種馬達：伺服馬達開合夾爪、直流馬達轉關節。接線照 M03 的接線 4、5。兩個都用 <b>PWM</b> Express VI：設定時選接頭和 PWM 通道（例如 A/PWM0，第 27 腳），輸入是頻率和 duty cycle。</p>`,
C.h3('第 1 步','','PWM 到底在送什麼'),
`<p>PWM 是一直重複的方波：每個週期裡，一段時間 3.3 V、一段時間 0 V。<b>頻率</b>決定一秒重複幾次；<b>duty cycle</b> 決定高電位佔一個週期的幾 %。下面換換看。</p>`,
{fn:pwmLab},
ask('伺服馬達和直流馬達，看的是 PWM 的哪一個東西？',
 `<p><b>伺服馬達看「高電位持續多久」</b>：通用的規格是每 20 ms（50 Hz）一個脈波，1 ms 到 2 ms 對應最左到最右（每顆伺服馬達略有不同，看規格）。所以頻率要固定 50 Hz，duty 只在 5 %～10 % 之間動。</p>
<p><b>直流馬達看「平均電壓」</b>：經過驅動板，duty 越大，平均電壓越高、轉越快。頻率只要夠高、驅動板跟得上就好。</p>
<p>同一個 Express VI，兩種完全不同的用法。這就是為什麼要先問「接的是什麼」，再填參數。</p>`),
C.h3('第 2 步','','可變電阻控制伺服馬達'),
ask('可變電阻 0～5 V，要變成伺服馬達的 duty。公式？',
 `<p>要的是 5 %～10 %：duty ＝ 5 ＋（電壓 ÷ 5）× 5。一樣加 In Range and Coerce 限制在 5～10。</p>
<p>伺服馬達的範圍還要實測：慢慢轉到兩端，聽到伺服馬達「吱吱」頂住的聲音就是超出機構範圍了，把上下限收小一點。夾爪裝上去之後，機構的極限通常比伺服馬達本身更小。</p>`),
C.h3('第 3 步','','直流馬達：方向和速度'),
ask('馬達正轉中，直接把方向腳切成反轉，會怎樣？',
 `<p>馬達還帶著慣性在正轉，驅動板突然反向加電壓，瞬間電流很大：輕則電源掉電、myRIO 重開，重則燒驅動板。</p>
<p>安全的順序：<b>duty 降到 0 → 等馬達停下（幾十到幾百毫秒，看負載）→ 切方向 → 再把 duty 加上去</b>。這是一個有順序、要等待的流程，用 I4、I13 的狀態機寫最清楚。</p>`),
flow(['初始化：STBY＝TRUE、duty＝0',{loop:['讀按鈕（上升緣、濾波：M04）','讀可變電阻 → 目標速度',{kase:['運轉：duty＝目標速度','要換方向：duty＝0 → 等 300 ms → 切 AIN1／AIN2 → 回運轉'],label:'狀態'},'寫 PWM、DIO'],label:'While Loop',sr:'狀態、方向、計時、上一圈按鈕'},'Close：duty＝0、STBY＝FALSE、Reset myRIO.vi']),
ask('直流馬達的 PWM 頻率要設多少？',
 `<p>三個考量：太低（例如幾十 Hz），馬達會一頓一頓；在人耳聽得到的範圍（大約 20 Hz～20 kHz），馬達會發出嗡嗡聲；太高，驅動板開關損失變大、可能跟不上。</p>
<p>常見的折衷是 20 kHz 左右（通用經驗）。myRIO 的 PWM 最高 100 kHz（說明書）；驅動板能接受多高，要看驅動板的規格。</p>`),
C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'伺服馬達常見的 PWM 設定？',o:['50 Hz，高電位 1～2 ms（duty 5～10 %）','20 kHz，duty 0～100 %','1 Hz','100 kHz'],a:0,ex:'伺服馬達看的是脈波寬度。'},
 {q:'直流馬達經過驅動板，duty 代表？',o:['平均電壓，也就是速度','角度','方向','電流上限'],a:0,ex:'方向由驅動板的方向腳決定。'},
 {q:'正轉中要改反轉，正確的順序？',o:['duty 降到 0 → 等停 → 切方向 → 加 duty','直接切方向','先加 duty 再切','關掉 myRIO'],a:0,ex:'避免反向大電流。'},
 {q:'直流馬達 PWM 用 1 kHz，常見的現象？',o:['馬達發出嗡嗡聲','轉不動','燒掉','反轉'],a:0,ex:'在人耳範圍內。常見改用 20 kHz 左右。'},
 {q:'myRIO 的 PWM 最高頻率？',o:['100 kHz','1 kHz','1 MHz','50 Hz'],a:0,ex:'說明書的第二功能最高頻率。'}
]}
]});

/* =============================== M07 =============================== */
L.push({id:'M07',order:30.7,no:'M7',part:PART,title:'編碼器與閉迴路：讓馬達停在你要的角度',mins:60,
goals:[['學會','Encoder Express VI 讀到的計數值怎麼換成角度；轉速怎麼算（為什麼要 Shift Register）；開迴路和閉迴路差在哪；比例控制 Kp 太大、太小各會怎樣；輸出為什麼要限制。'],['做出','關節轉到 90° 停住；畫出角度對時間的圖。'],['為什麼','「讓馬達轉 2 秒」每次停的位置都不一樣。要停得準，就要一邊量一邊修正。']],
check:'你能說出：怎麼實測一圈幾個計數；轉速公式和 Shift Register 放什麼；Kp 太小為什麼停不到目標；Kp 太大會怎樣；duty 為什麼要限制在 ±100 %。',
body:[
C.h3('情境','x','轉到 90° 停住'),
`<p>關節的直流馬達後面有編碼器，照 M03 接線 6 接在 MXP A 的 ENC.A（第 18 腳）、ENC.B（第 22 腳）。用 <b>Encoder</b> Express VI 讀，它會給你計數值（往一個方向轉增加、反方向減少）。</p>`,
ask('第一個方法：讓馬達用 30 % 轉 0.5 秒再停。會停在 90° 嗎？',
 `<p>第一次也許接近，第二次就不一樣了：電池電壓下降、負載不同、摩擦變化，0.5 秒能轉多少每次都不同。這叫<b>開迴路</b>：只下命令，不看結果。</p>
<p>要停得準，就要一邊看編碼器、一邊修正：這叫<b>閉迴路</b>。</p>`),
C.h3('第 1 步','','計數值換成角度：先實測'),
ask('一圈是幾個計數？要去哪裡查？',
 `<p>兩個地方：編碼器（或馬達）規格寫的「每轉脈波數」，以及 myRIO 怎麼計數（每個脈波算 1 次還是 4 次）。兩邊一乘才是一圈的計數。</p>
<p>最可靠的方法是<b>實測</b>：在馬達軸上貼一片膠帶當記號，手轉 10 圈，看計數值變多少，除以 10。跟規格書算出來的對一對，對不上就是有地方理解錯了。</p>
<p>如果馬達有減速齒輪，關節轉一圈是馬達轉好幾圈：再乘上減速比。角度 ＝ 計數值 ÷ 一圈的計數 × 360。</p>`),
C.h3('第 2 步','','轉速：要記住上一次'),
ask('轉速怎麼算？要用到什麼結構？',
 `<p>轉速 ＝（這一次的計數 − 上一次的計數）÷ 兩次之間的時間。「上一次的計數」這一圈存起來、下一圈要用：又是 <b>Shift Register</b>。時間用 Tick Count 相減，或固定迴圈週期（M09 會講怎麼讓週期穩定）。</p>
<p>注意計數值會溢位：Express VI 給的計數值有上限，轉很多圈之後會跳回另一端。相減時差值突然變成很大的負數，就是溢位，要處理（或在溢位前歸零）。</p>`),
C.h3('第 3 步','','比例控制：誤差越大，推得越用力'),
`<p>最簡單的閉迴路：誤差 ＝ 目標角度 − 現在角度；duty ＝ Kp × 誤差。差得多推得多，快到了就推得少。下面試三種 Kp。</p>`,
{fn:pLab},
ask('Kp 太小，為什麼停在差一點的地方，不會慢慢補上？',
 `<p>快到目標時，誤差很小，Kp × 誤差算出的 duty 也很小。小到推不動摩擦，馬達就停了，誤差卡在那裡。這叫穩態誤差。</p>
<p>加大 Kp 可以縮小，但太大又會衝過頭擺動。真正解決要加積分（I）：誤差一直存在，積分就一直累加，終於推得動。這就是 PID 的 I。這一課先把 P 弄懂。</p>`),
ask('程式算出 duty ＝ 250 %，會怎樣？',
 `<p>PWM 只能 0～100 %，實際送出去的會被截掉。問題是你的程式以為送了 250 %，後面如果還有計算（例如積分）會越算越歪。</p>
<p>所以控制輸出一定要<b>自己先限制</b>（In Range and Coerce，−100～100），再拆成「方向」和「duty 大小」送給驅動板。正負號就是方向。</p>`),
flow(['初始化：計數歸零、duty＝0',{loop:['讀 Encoder → 角度','誤差＝目標−角度','duty＝Kp×誤差 → 限制 ±100','正負 → 方向腳；絕對值 → PWM','記錄角度到圖表','Wait（固定週期）'],label:'While Loop（10 ms 一圈）',sr:'上一次計數（算轉速）、error'},'Close：duty＝0、STBY＝FALSE、Reset myRIO.vi']),
C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'「用 30 % 轉 0.5 秒」為什麼停不準？',o:['開迴路：不看結果，負載、電壓一變就不同','PWM 頻率錯了','編碼器沒接','Kp 太大'],a:0,ex:'閉迴路才會一邊量一邊修正。'},
 {q:'一圈幾個計數，最可靠的確認方法？',o:['手轉 10 圈看計數值變多少，再跟規格對照','只看規格','猜一個','問 LabVIEW'],a:0,ex:'先看資料，再相信公式。'},
 {q:'算轉速時，Shift Register 放什麼？',o:['上一次的計數值','Kp','目標角度','PWM 頻率'],a:0,ex:'這一圈的值，下一圈要用。'},
 {q:'Kp 太小的典型現象？',o:['停在差一點的地方（穩態誤差）','來回擺動','反轉','燒掉'],a:0,ex:'要加積分才消得掉。'},
 {q:'控制算出 duty 超過 100 %，應該？',o:['程式自己先限制在 ±100 %，再送出','直接送','改成 0','重開機'],a:0,ex:'不然程式以為送出的和實際不一樣。'}
]}
]});
})();
