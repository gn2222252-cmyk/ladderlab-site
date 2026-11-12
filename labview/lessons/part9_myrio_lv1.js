/* 第九部分：myRIO 的「動手寫 LabVIEW」段落（M04～M07）。
   這個檔案在 part9_myrio_a～h 之後載入，把每一課的 LabVIEW 實作插在小測驗前面：
   先填「寫之前的五個問題」（C.plan），再一步一步長出方塊圖（步驟播放器 + 模擬執行）。
   Express VI 端子：Button0、LED0～3 照範本與實機截圖；Encoder 的 Reset Counter、Counter Value（I32）、
   Counter Direction、Overflow? 與 PWM 的 duty cycle 範圍 0～1，出自 NI LabVIEW myRIO Toolkit 說明。
   實際的端子名稱會帶你選的通道（例如 A/AI0），網頁只畫最重要的幾個端子。 */
(function(){
const L=window.LESSONS,fn=C.fn,qd=C.qd,wt=C.wt;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
Object.assign(LV.F,{
 'Absolute Value':{p:'|x|',a:1,pal:['Functions','Programming','Numeric','Absolute Value']},
 'Greater Or Equal To 0?':{p:'≥0',a:1,pal:['Functions','Programming','Comparison','Greater Or Equal To 0?']}
});
/* myRIO Express VI 方塊：藍色標頭，端子名稱就是設定時選的通道 */
const X=(id,name,icon,ins,outs,x,y,o)=>Object.assign({id,k:'sub',name,top:'myRIO',color:'#2f6fd0',icon:[icon],ins,outs,x,y,w:58,h:Math.max(40,Math.max(ins.length,outs.length)*15+12),
 tip:'myRIO 的 Express VI：方塊圖右鍵 ▸ myRIO 選盤。放下去會跳出設定視窗；之後雙擊可以再改。'},o||{});
const myrio=(...p)=>C.pal('Functions','myRIO',...p);
/* 插在「小測驗」前面 */
function addTo(id,items){const l=L.find(x=>x.id===id);if(!l)return;const i=l.body.findIndex(b=>typeof b==='string'&&b.includes('小測驗'));l.body.splice(i<0?l.body.length:i,0,...items);}
const MAINLOOP=`<p>從 M02 的範本開始：專案總管裡 <b>myRIO 底下</b>雙擊 Main.vi，按 <kbd>Ctrl</kbd>+<kbd>E</kbd> 切到方塊圖。中間那一格的 <b>Main Loop</b> 已經有 While Loop、Wait（10 ms）、Stop 按鈕；把 Accelerometer、Acceleration 圖和它們的線選起來刪掉（Ctrl+B 清掉斷線），我們在這個迴圈裡寫。</p>`;

/* ============================== M04 ============================== */
const m04={name:'Main.vi（M04：按一下換下一顆燈）',view:'split',ratio:1.9,
 fp:{w:300,h:220,items:[
  {id:'btn',k:'btn',mech:'hold',label:'（模擬）板上的 Button0',showLabel:true,text:'按住＝按下 Button0',x:16,y:26},
  {id:'led',k:'leds',label:'（模擬）板上的 LED0～3',names:['LED0','LED1','LED2','LED3'],cols:4,x:16,y:96,v:[true,false,false,false]},
  {id:'idx',k:'num',label:'第幾顆',x:16,y:160,w:70,v:0},
  {id:'stop',k:'btn',label:'stop',text:'STOP',stop:true,x:180,y:160}]},
 bd:{w:650,h:340,structs:[{id:'wl',k:'while',x:70,y:20,w:560,h:300,name:'Main Loop'}],
  nodes:[
  {id:'btn',...X('btn','Button','BTN',[],['Button0'],110,50)},
  {id:'led',...X('led','LED','LED',['LED0','LED1','LED2','LED3'],[],520,60)},
  {id:'kF',k:'const',t:'bool',v:false,x:40,y:111},
  {id:'sr1',k:'sr',t:'bool',s:'wl',y:120},
  {id:'not',k:'fn',fn:'Not',x:150,y:106},
  {id:'and',k:'fn',fn:'And',x:230,y:60},
  {id:'k0',k:'const',t:'i32',v:0,x:36,y:221},
  {id:'sr2',k:'sr',t:'i32',s:'wl',y:230},
  {id:'inc',k:'fn',fn:'Increment',x:130,y:216},
  {id:'k4',k:'const',t:'i32',v:4,x:160,y:245},
  {id:'qr',k:'fn',fn:'Quotient & Remainder',x:190,y:214},
  {id:'sel',k:'fn',fn:'Select',x:290,y:200},
  {id:'c0',k:'const',t:'i32',v:0,x:400,y:72},{id:'eq0',k:'fn',fn:'Equal?',x:430,y:60,showName:false},
  {id:'c1',k:'const',t:'i32',v:1,x:400,y:112},{id:'eq1',k:'fn',fn:'Equal?',x:430,y:100,showName:false},
  {id:'c2',k:'const',t:'i32',v:2,x:400,y:152},{id:'eq2',k:'fn',fn:'Equal?',x:430,y:140,showName:false},
  {id:'c3',k:'const',t:'i32',v:3,x:400,y:192},{id:'eq3',k:'fn',fn:'Equal?',x:430,y:180,showName:false},
  {id:'idx',k:'ind',t:'i32',label:'第幾顆',x:380,y:270},
  {id:'kw',k:'const',t:'i32',v:10,x:436,y:237},
  {id:'wait',k:'fn',fn:'Wait (ms)',x:470,y:230},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:540,y:288},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'ww',from:'kw',to:'wait',t:'i32'},
  {id:'wst',from:'stop',to:'cond',t:'bool'},
  {id:'wF',from:'kF',to:'sr1.init',t:'bool'},
  {id:'wb1',from:'btn.Button0',to:'and.x',t:'bool',mx:200},
  {id:'wb2',from:'btn.Button0',to:'sr1.R',t:'bool',pts:[[190,70],[190,40],[610,40],[610,120]]},
  {id:'wn1',from:'sr1.L',to:'not.x',t:'bool'},
  {id:'wn2',from:'not.out',to:'and.y',t:'bool',mx:205},
  {id:'w0',from:'k0',to:'sr2.init',t:'i32'},
  {id:'wi1',from:'sr2.L',to:'inc.x',t:'i32'},
  {id:'wi2',from:'inc.out',to:'qr.x',t:'i32',mx:175},
  {id:'wi3',from:'k4',to:'qr.y',t:'i32',mx:186},
  {id:'ws1',from:'qr.R',to:'sel.t',t:'i32',mx:255},
  {id:'ws2',from:'and.out',to:'sel.s',t:'bool',mx:275},
  {id:'ws3',from:'sr2.L',to:'sel.f',t:'i32',pts:[[100,230],[100,295],[270,295],[270,225]]},
  {id:'ws4',from:'sel.out',to:'sr2.R',t:'i32',mx:600},
  {id:'we0',from:'sel.out',to:'eq0.x',t:'i32',mx:360},{id:'wc0',from:'c0',to:'eq0.y',t:'i32'},{id:'wl0',from:'eq0.out',to:'led.LED0',t:'bool',mx:470},
  {id:'we1',from:'sel.out',to:'eq1.x',t:'i32',mx:360},{id:'wc1',from:'c1',to:'eq1.y',t:'i32'},{id:'wl1',from:'eq1.out',to:'led.LED1',t:'bool',mx:480},
  {id:'we2',from:'sel.out',to:'eq2.x',t:'i32',mx:360},{id:'wc2',from:'c2',to:'eq2.y',t:'i32'},{id:'wl2',from:'eq2.out',to:'led.LED2',t:'bool',mx:490},
  {id:'we3',from:'sel.out',to:'eq3.x',t:'i32',mx:360},{id:'wc3',from:'c3',to:'eq3.y',t:'i32'},{id:'wl3',from:'eq3.out',to:'led.LED3',t:'bool',mx:500},
  {id:'wix',from:'sel.out',to:'idx',t:'i32',mx:360}]},
 sim:{period:50,init:()=>({prev:false,idx:0,n:0}),
  step(inp,st){const b=!!inp.btn,edge=b&&!st.prev,nx=(st.idx+1)%4,idx=edge?nx:st.idx;
   const v={'btn.Button0':b,'sr1.L':st.prev,'not.out':!st.prev,'and.out':edge,'sr2.L':st.idx,'inc.out':st.idx+1,k4:4,'qr.R':nx,'sel.out':idx,kw:10,stop:!!inp.stop,kF:false,k0:0,c0:0,c1:1,c2:2,c3:3};
   [0,1,2,3].forEach(k=>v['eq'+k+'.out']=idx===k);
   if(edge)st.n++;st.prev=b;st.idx=idx;
   return {out:{led:[0,1,2,3].map(k=>k===idx),idx},vals:v,stop:!!inp.stop,
    msg:inp.stop?'按了 STOP：這一圈跑完就結束':edge?'這一圈是上升緣（上一圈 FALSE、這一圈 TRUE）→ 換下一顆':b?'按著不放：每一圈都讀到 TRUE，可是不是上升緣，燈不動':'等你按 Button0（已經按了 '+st.n+' 下）'};},
  doneMsg:'迴圈結束。實機上接著跑 Close 那一格的 Reset myRIO.vi，燈全部關掉。'}
};
addTo('M04',[
C.h3('LabVIEW','b','動手寫：按一下 Button0，換下一顆燈'),
C.plan({start:'M02 建好的專案 ▸ myRIO 底下的 Main.vi。只在中間那一格的 Main Loop 裡寫。',
 in:'Button Express VI 的 <code>Button0</code>：布林（TF），按下 TRUE。每 10 ms 讀一次，所以按一下會讀到好幾個 TRUE。',
 calc:'① 上升緣：這一圈 TRUE <b>而且</b>上一圈 FALSE → 要記住上一圈：Shift Register。② 第幾顆：上升緣時 (第幾顆＋1) 除以 4 取餘數（0→1→2→3→0），不是上升緣就保持原值：又要記住，第二個 Shift Register；「二選一」用 Select。③ 第幾顆 → 四個布林：拿第幾顆和 0、1、2、3 比 Equal?。',
 out:'LED Express VI 的 LED0～LED3（板上的燈）；前面板放一個「第幾顆」數字，除錯時一眼看到程式以為現在是第幾顆。',
 loop:'沿用範本的 10 ms。按一下至少 100 ms，10 ms 讀一次不會漏掉。',
 end:'按 Stop 結束迴圈，Close 格的 Reset myRIO.vi 把燈關掉。不要用 Abort（M02）。'}),
{steps:{title:'M04：上升緣 + 計數 + 點燈',lv:m04,steps:[
 {t:'找到 Main Loop',view:'bd',add:['wl','kw','wait','ww','stop','cond','wst'],h:MAINLOOP+`<p>留下來的就是迴圈的骨架：Wait 10 ms 讓迴圈大約每 10 ms 跑一圈；stop 接到右下角的 Loop Condition。</p>`},
 {t:'放 Button 和 LED 兩個 Express VI',view:'split',add:['btn','led'],h:`<p>方塊圖空白處按右鍵 ▸ ${myrio('Onboard','Button')}，放進迴圈的左邊。設定視窗選 <b>Button0</b>，按 OK。</p><p>再放 ${myrio('Onboard','LED')} 到右邊，設定視窗把 <b>LED0～LED3 都勾起來</b>。LED Express VI 就多出四個布林輸入，接 TRUE 的那一顆亮。</p><p>（也可以按 <kbd>Ctrl</kbd>+<kbd>Space</kbd> 打 <code>Button</code>、<code>LED</code>。選盤的分類名稱各版本略有不同，找不到就用 Quick Drop。）</p><p>前面板左邊兩個「（模擬）」只是網頁用來代替板子的按鈕和燈，真的 Main.vi 前面板上不會有。</p>`},
 {t:'上升緣：Shift Register 記住上一圈',view:'bd',add:['kF','wF','sr1','not','and','wb1','wb2','wn1','wn2'],h:`<p>迴圈<b>右邊框</b>按右鍵 ▸ <b>Add Shift Register</b>，左右各出現一個小方塊。</p>${wt([['Button0','右邊的 Shift Register','這一圈的值存起來，下一圈從左邊拿出來'],['左邊的 Shift Register','Not','上一圈的值反相：上一圈 FALSE → TRUE'],['Button0','And 的上面','這一圈 TRUE'],['Not','And 的下面','而且上一圈 FALSE'],['False 常數（迴圈外）','左邊 Shift Register 的外側','初始值：第一圈當作「上一圈沒按」']])}<p>${fn('Programming','Boolean','Not')} ${qd('Not')}、${fn('Programming','Boolean','And')} ${qd('And')}。False 常數：在左邊 Shift Register 外側按右鍵 ▸ Create ▸ Constant，點一下常數切成 F。</p><p>And 的輸出只在「剛按下去的那一圈」是 TRUE，這就是<b>上升緣</b>。</p>`},
 {t:'第幾顆：第二個 Shift Register',view:'bd',add:['k0','w0','sr2','inc','k4','qr','sel','wi1','wi2','wi3','ws1','ws2','ws3','ws4'],h:`<p>再加一個 Shift Register 存「第幾顆」，外側接 I32 常數 0（一開始亮 LED0）。</p><p>${fn('Programming','Numeric','Increment')} ${qd('Increment')} 把它加 1；${fn('Programming','Numeric','Quotient & Remainder')} ${qd('Quotient')} 除以常數 4，取 <code>R</code>（餘數）：0、1、2、3、0…，永遠不會超過 3。</p><p>${fn('Programming','Comparison','Select')} ${qd('Select')}：中間 <code>s</code> 接上升緣。TRUE 走上面 <code>t</code>（加 1 之後的值）；FALSE 走下面 <code>f</code>（原來的值）。</p>${wt([['左邊 Shift Register（第幾顆）','Increment → Quotient & Remainder 的 x'],['常數 4','Quotient & Remainder 的 y'],['R','Select 的 t'],['And（上升緣）','Select 的 s'],['左邊 Shift Register（第幾顆）','Select 的 f','沒按就保持原值'],['Select 的輸出','右邊 Shift Register','下一圈用']])}`},
 {t:'第幾顆 → 四顆燈',view:'split',add:['c0','eq0','c1','eq1','c2','eq2','c3','eq3','we0','wc0','wl0','we1','wc1','wl1','we2','wc2','wl2','we3','wc3','wl3','idx','wix'],h:`<p>放四個 ${fn('Programming','Comparison','Equal?')} ${qd('Equal?')}，下面分別接常數 0、1、2、3；上面都接 Select 的輸出（同一條線分岔出去）。四個輸出接到 LED0～LED3。</p><p>同一時間只有一個 Equal? 是 TRUE，所以只亮一顆。</p><p>在 Select 的輸出上按右鍵 ▸ Create ▸ Indicator，改名「第幾顆」。</p>`},
 {t:'Run：按住、放開',view:'split',add:[],h:`<p>按 Run，然後在前面板<b>按住</b>「按住＝按下 Button0」再放開。按住不放，燈不會一直跑；放開再按，才換下一顆。</p><p>打開方塊圖的燈泡（Highlight Execution）看一圈裡資料怎麼流。實機上第一次 Run 會先部署到 myRIO，要等一下。</p>`}
]}},
ask('把 Select 的 s 改接 Button0（不經過上升緣），按住 1 秒，燈會怎樣？先算一算再看答案。',
 `<p>10 ms 一圈，按住 1 秒大約 100 圈都是 TRUE，「第幾顆」加了 100 次。100 除以 4 剛好整除，<b>看起來好像沒動</b>，其實燈轉了 25 輪，快到眼睛看不出來。按的時間稍微不同，停在哪一顆就是隨機的。這就是「狀態」和「事件」的差別。</p>`),
ask('要加上 20 ms 的彈跳濾波，方塊圖要改哪裡？',
 `<p>多一個 Shift Register 存「連續 TRUE 幾圈」：Button0 是 TRUE 就 ＋1，FALSE 就歸 0（Select）。迴圈 10 ms 一圈，20 ms 就是 2 圈：用 <code>Equal?</code> 判斷「剛好等於 2」，取代原來的 And 當作 Select 的 s。用「剛好等於」而不是「大於等於」，按住不放時才不會每一圈都算。</p>`)
]);

/* ============================== M05 ============================== */
const m05={name:'Main.vi（M05：可變電阻調閃爍快慢）',view:'split',ratio:1.9,
 fp:{w:310,h:260,items:[
  {id:'ai',k:'num',ctl:true,label:'（模擬）可變電阻的電壓 V',x:16,y:24,w:90,v:2.5,inc:0.5,dig:2},
  {id:'volt',k:'num',label:'電壓 V',x:16,y:84,w:90,dig:3},
  {id:'ms',k:'num',label:'閃爍間隔 ms',x:150,y:84,w:90,dig:0},
  {id:'chart',k:'chart',label:'電壓圖（0～5 V）',x:16,y:140,w:180,h:60,min:0,max:5},
  {id:'led',k:'leds',label:'（模擬）LED0',names:['LED0'],cols:1,x:220,y:140},
  {id:'stop',k:'btn',label:'stop',text:'STOP',stop:true,x:220,y:210}]},
 bd:{w:650,h:300,structs:[{id:'wl',k:'while',x:60,y:20,w:570,h:260,name:'Main Loop'}],
  nodes:[
  {id:'ai',...X('ai','Analog Input','AI',[],['A/AI0'],100,50)},
  {id:'k5',k:'const',t:'dbl',v:5,x:175,y:92},
  {id:'div',k:'fn',fn:'Divide',x:210,y:63},
  {id:'k900',k:'const',t:'dbl',v:900,x:240,y:100},
  {id:'mul',k:'fn',fn:'Multiply',x:285,y:70},
  {id:'k100',k:'const',t:'dbl',v:100,x:318,y:112},
  {id:'add',k:'fn',fn:'Add',x:360,y:77},
  {id:'kHi',k:'const',t:'dbl',v:1000,x:385,y:40},
  {id:'kLo',k:'const',t:'dbl',v:100,x:392,y:115},
  {id:'co',k:'fn',fn:'In Range and Coerce',x:430,y:67},
  {id:'ms',k:'ind',t:'dbl',label:'閃爍間隔 ms',x:530,y:60},
  {id:'wait',k:'fn',fn:'Wait (ms)',x:530,y:120},
  {id:'volt',k:'ind',t:'dbl',label:'電壓 V',x:200,y:150},
  {id:'chart',k:'ind',t:'dbl',label:'電壓圖',x:200,y:190},
  {id:'kF',k:'const',t:'bool',v:false,x:30,y:231},
  {id:'sr',k:'sr',t:'bool',s:'wl',y:240},
  {id:'not',k:'fn',fn:'Not',x:140,y:226},
  {id:'led',...X('led','LED','LED',['LED0'],[],260,215)},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:520,y:248},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w1',from:'ai.A/AI0',to:'div.x',t:'dbl'},
  {id:'w2',from:'k5',to:'div.y',t:'dbl',mx:203},
  {id:'w3',from:'div.out',to:'mul.x',t:'dbl'},
  {id:'w4',from:'k900',to:'mul.y',t:'dbl',mx:278},
  {id:'w5',from:'mul.out',to:'add.x',t:'dbl'},
  {id:'w6',from:'k100',to:'add.y',t:'dbl',mx:355},
  {id:'w7',from:'add.out',to:'co.x',t:'dbl',mx:410},
  {id:'w8',from:'kHi',to:'co.upper limit',t:'dbl',mx:426},
  {id:'w9',from:'kLo',to:'co.lower limit',t:'dbl',mx:426},
  {id:'w10',from:'co.coerced(x)',to:'ms',t:'dbl',mx:500},
  {id:'w11',from:'co.coerced(x)',to:'wait',t:'dbl',mx:500,coerce:true},
  {id:'w12',from:'ai.A/AI0',to:'volt',t:'dbl',mx:180},
  {id:'w13',from:'ai.A/AI0',to:'chart',t:'dbl',mx:180},
  {id:'w14',from:'kF',to:'sr.init',t:'bool'},
  {id:'w15',from:'sr.L',to:'not.x',t:'bool'},
  {id:'w16',from:'not.out',to:'led.LED0',t:'bool',mx:220},
  {id:'w17',from:'not.out',to:'sr.R',t:'bool',pts:[[190,240],[190,272],[621,272],[621,240]]},
  {id:'w18',from:'stop',to:'cond',t:'bool'}]},
 sim:{period:100,init:()=>({on:false,t:0,hist:[],r:5}),
  step(inp,st){
   st.r=(st.r*1103515245+12345)%2147483648;const nz=(st.r/2147483648-0.5)*0.004;
   const v=Math.max(0,Math.min(4.999,(+inp.ai||0)+nz));const lsb=5/4096,vq=Math.round(v/lsb)*lsb;
   const raw=100+vq/5*900,ms=Math.max(100,Math.min(1000,raw));
   st.t+=100;if(st.t>=ms){st.t=0;st.on=!st.on;}
   st.hist.push(vq);if(st.hist.length>90)st.hist.shift();
   return {out:{volt:vq,ms,chart:st.hist.slice(),led:[st.on]},
    vals:{'ai.A/AI0':vq,k5:5,'div.out':vq/5,k900:900,'mul.out':vq/5*900,k100:100,'add.out':raw,kHi:1000,kLo:100,'co.coerced(x)':ms,'sr.L':!st.on,'not.out':st.on,kF:false,stop:!!inp.stop},
    stop:!!inp.stop,msg:inp.stop?'按了 STOP：這一圈跑完、Wait 等完才會停':`讀到 ${vq.toFixed(3)} V → 間隔 ${ms.toFixed(0)} ms（網頁每 0.1 秒算一次，燈照算出來的間隔換）`};},
  doneMsg:'迴圈結束'}
};
addTo('M05',[
C.h3('LabVIEW','b','動手寫：讀可變電阻 → 換算 → 控制閃爍'),
C.plan({start:'Main.vi 的 Main Loop（跟 M04 同一個專案；可以另存一份 Main.vi 的複本再改）。',
 in:'Analog Input Express VI 選 <b>A/AI0</b>：輸出是 DBL，單位<b>伏特</b>，範圍 0～5 V，一格約 1.221 mV。',
 calc:'把 0～5 V 線性換成 100～1000 ms：間隔 ＝ 電壓 ÷ 5 × 900 ＋ 100。順序照公式放 Divide、Multiply、Add 三個函式。最後 In Range and Coerce 限制在 100～1000，雜訊讓電壓超出一點點也不會算出奇怪的數字。',
 out:'數字顯示「電壓 V」（顯示 3 位小數，看得到最後一兩位在跳）、「閃爍間隔 ms」；Waveform Chart 畫電壓，轉動時看得到曲線；LED0 用來看快慢。',
 loop:'這一版最簡單：把算出來的間隔直接接到 Wait，迴圈每圈就等那麼久，每一圈 LED 反相一次。代價寫在下面的問題裡。',
 end:'Stop 結束，Close 格 Reset myRIO.vi。'}),
{steps:{title:'M05：AI → 換算 → 限制 → Wait 和 LED',lv:m05,steps:[
 {t:'放 Analog Input，先看原始數字',view:'split',add:['wl','ai','volt','chart','w12','w13','stop','cond','w18'],h:MAINLOOP+`<p>放 ${myrio('Analog Input')} ${qd('Analog Input')}，設定視窗選通道 <b>A/AI0</b>（MXP A 第 3 腳）。</p><p>在它的輸出上按右鍵 ▸ Create ▸ Indicator，改名「電壓 V」。再到前面板放一個 ${C.ctl('Modern','Graph','Waveform Chart')}，回方塊圖把電壓也接過去。</p><p>先 Run 一次、慢慢轉，確認數字在 0～5 之間變化：<b>先看資料，再寫公式</b>。</p>`},
 {t:'照公式放三個函式',view:'bd',add:['k5','div','w1','w2','k900','mul','w3','w4','k100','add','w5','w6'],h:`<p>間隔 ＝ 電壓 ÷ 5 × 900 ＋ 100。從左到右照著放：</p>${wt([['A/AI0','Divide 的 x'],['常數 5','Divide 的 y','0～5 V 變成 0～1'],['Divide','Multiply 的 x'],['常數 900','Multiply 的 y','0～1 變成 0～900'],['Multiply','Add 的 x'],['常數 100','Add 的 y','變成 100～1000']])}<p>${fn('Programming','Numeric','Divide')} ${qd('Divide')}、Multiply、Add 都在同一個選盤。常數在函式的輸入上按右鍵 ▸ Create ▸ Constant，就會是對的型別（DBL，橘色）。</p><p>想一想：為什麼不寫成「電壓 × 180 ＋ 100」？結果一樣，但「÷5 ×900」看得出 5 是滿刻度、900 是範圍，以後要改範圍知道改哪一個數字。</p>`},
 {t:'In Range and Coerce 限制範圍',view:'bd',add:['kHi','kLo','co','w7','w8','w9','ms','w10'],h:`<p>${fn('Programming','Comparison','In Range and Coerce')} ${qd('In Range')}：上面 <code>upper limit</code> 接 1000，中間 <code>x</code> 接剛算出來的值，下面 <code>lower limit</code> 接 100。輸出 <code>coerced(x)</code> 一定在 100～1000 之間。</p><p>在 coerced(x) 上 Create ▸ Indicator，改名「閃爍間隔 ms」。</p>`},
 {t:'間隔接 Wait；LED 每圈反相',view:'bd',add:['wait','w11','kF','w14','sr','not','w15','led','w16','w17'],h:`<p>把範本原本的 10 ms 常數刪掉，改接 coerced(x)。Wait 要的是整數，DBL 接上去會出現紅色小點（coercion dot，自動轉型），這裡可以接受。</p><p>加一個 Shift Register（初始值 False），中間放 Not：每一圈 TRUE、FALSE 交替。放 ${myrio('Onboard','LED')}，只勾 LED0，接 Not 的輸出。</p>`},
 {t:'Run：轉可變電阻',view:'split',add:[],h:`<p>Run。前面板改「（模擬）可變電阻的電壓」，看電壓、間隔、燈的快慢一起變。改成 6 或 -1 試試：間隔還是停在 1000、100，因為有 In Range and Coerce。</p>`}
]}},
ask('這樣寫，電壓轉到 5 V（間隔 1000 ms）時按 Stop，最久要等多久才停？為什麼？',
 `<p>最久大約 1 秒：迴圈要等這一圈的 Wait 等完，才會檢查 Stop。而且電壓也變成 1 秒才讀一次，圖變得很稀疏。</p><p>更好的寫法：迴圈固定 10 ms 一圈（讀得快、停得快），另外用 <b>Elapsed Time</b> 或 Tick Count 相減，「時間到了」才把 LED 反相。<b>迴圈的速度和閃爍的速度是兩件事，不要綁在一起</b>：M09 會再深入。</p>`),
tip('型別的小提醒','Analog Input 給的是 DBL（橘線）。Wait 要整數，所以有紅點。如果把結果接給 Digital Output 或 LED，就要先比較（例如 Greater?）變成布林：數字不能直接接到布林端子，線會斷掉。')
]);

/* ============================== M06 ============================== */
const m06={name:'Main.vi（M06：可變電阻控制伺服馬達）',view:'split',ratio:1.9,
 fp:{w:310,h:230,items:[
  {id:'ai',k:'num',ctl:true,label:'（模擬）可變電阻的電壓 V',x:16,y:24,w:90,v:2.5,inc:0.5,dig:2},
  {id:'volt',k:'num',label:'電壓 V',x:16,y:84,w:80,dig:3},
  {id:'duty',k:'num',label:'Duty（0～1）',x:120,y:84,w:80,dig:4},
  {id:'pms',k:'num',label:'高電位 ms',x:220,y:84,w:70,dig:2},
  {id:'pwm',k:'text',text:s=>'（模擬）伺服馬達大約在 '+(s.angv!=null?s.angv:90)+'°',x:16,y:140,size:15,bold:true,color:'#1d4fa0'},
  {id:'stop',k:'btn',label:'stop',text:'STOP',stop:true,x:16,y:180}]},
 bd:{w:650,h:300,structs:[{id:'wl',k:'while',x:60,y:20,w:570,h:260,name:'Main Loop'}],
  nodes:[
  {id:'ai',...X('ai','Analog Input','AI',[],['A/AI0'],100,50)},
  {id:'k5',k:'const',t:'dbl',v:5,x:175,y:92},
  {id:'div',k:'fn',fn:'Divide',x:210,y:63},
  {id:'ka',k:'const',t:'dbl',v:0.05,x:232,y:100},
  {id:'mul',k:'fn',fn:'Multiply',x:285,y:70},
  {id:'kb',k:'const',t:'dbl',v:0.05,x:308,y:112},
  {id:'add',k:'fn',fn:'Add',x:360,y:77},
  {id:'kHi',k:'const',t:'dbl',v:0.1,x:380,y:40},
  {id:'kLo',k:'const',t:'dbl',v:0.05,x:380,y:115},
  {id:'co',k:'fn',fn:'In Range and Coerce',x:430,y:67},
  {id:'pwm',...X('pwm','PWM','PWM',['Duty Cycle'],[],530,60)},
  {id:'duty',k:'ind',t:'dbl',label:'Duty（0～1）',x:520,y:130},
  {id:'k20',k:'const',t:'dbl',v:20,x:470,y:199},
  {id:'m20',k:'fn',fn:'Multiply',x:520,y:175},
  {id:'pms',k:'ind',t:'dbl',label:'高電位 ms',x:570,y:179},
  {id:'volt',k:'ind',t:'dbl',label:'電壓 V',x:200,y:150},
  {id:'kw',k:'const',t:'i32',v:20,x:260,y:207},
  {id:'wait',k:'fn',fn:'Wait (ms)',x:300,y:200},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:520,y:248},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w1',from:'ai.A/AI0',to:'div.x',t:'dbl'},
  {id:'w2',from:'k5',to:'div.y',t:'dbl',mx:203},
  {id:'w3',from:'div.out',to:'mul.x',t:'dbl'},
  {id:'w4',from:'ka',to:'mul.y',t:'dbl',mx:278},
  {id:'w5',from:'mul.out',to:'add.x',t:'dbl'},
  {id:'w6',from:'kb',to:'add.y',t:'dbl',mx:352},
  {id:'w7',from:'add.out',to:'co.x',t:'dbl',mx:410},
  {id:'w8',from:'kHi',to:'co.upper limit',t:'dbl',mx:422},
  {id:'w9',from:'kLo',to:'co.lower limit',t:'dbl',mx:422},
  {id:'w10',from:'co.coerced(x)',to:'pwm.Duty Cycle',t:'dbl',mx:500},
  {id:'w11',from:'co.coerced(x)',to:'duty',t:'dbl',mx:490},
  {id:'w12',from:'co.coerced(x)',to:'m20.x',t:'dbl',mx:480},
  {id:'w13',from:'k20',to:'m20.y',t:'dbl',mx:510},
  {id:'w14',from:'m20.out',to:'pms',t:'dbl'},
  {id:'w15',from:'ai.A/AI0',to:'volt',t:'dbl',mx:180},
  {id:'w16',from:'kw',to:'wait',t:'i32'},
  {id:'w17',from:'stop',to:'cond',t:'bool'}]},
 sim:{period:100,init:()=>({}),
  step(inp){const v=Math.max(0,Math.min(4.999,+inp.ai||0)),raw=v/5*0.05+0.05,d=Math.max(0.05,Math.min(0.1,raw)),p=d*20,a=Math.round((p-1)*180);
   return {out:{volt:v,duty:d,pms:p,angv:a},vals:{'ai.A/AI0':v,k5:5,'div.out':v/5,ka:0.05,'mul.out':v/5*0.05,kb:0.05,'add.out':raw,kHi:0.1,kLo:0.05,'co.coerced(x)':d,k20:20,'m20.out':p,kw:20,stop:!!inp.stop},
    stop:!!inp.stop,msg:`duty ${d.toFixed(4)}（${(d*100).toFixed(2)} %）→ 50 Hz 每 20 ms 高電位 ${p.toFixed(2)} ms`};},doneMsg:'迴圈結束。Close 格要先把 duty 設回安全值再 Reset。'}
};
addTo('M06',[
C.h3('LabVIEW','b','動手寫：可變電阻 → 伺服馬達的 duty'),
C.plan({start:'Main.vi 的 Main Loop。接線照 M03 的接線 4（伺服馬達訊號線接 MXP A 第 27 腳 PWM0）。',
 in:'Analog Input（A/AI0）：DBL，0～5 V。',
 calc:`<b>先查 Express VI 要的單位</b>：myRIO 的 PWM Express VI，duty cycle 輸入的範圍是 <b>0～1</b>（0.5 就是 50 %），不是 0～100。所以伺服馬達的 5～10 % 要寫成 0.05～0.10：duty ＝ 電壓 ÷ 5 × 0.05 ＋ 0.05，再用 In Range and Coerce 限制在 0.05～0.10。`,
 out:'PWM Express VI 的 Duty Cycle（頻率在設定視窗固定為 50 Hz）。前面板顯示 duty 和「高電位 ms」＝ duty × 20 ms：這個數字才是伺服馬達真正看的東西，應該在 1～2 ms 之間。',
 loop:'伺服馬達每 20 ms 才看一次脈波，迴圈比 20 ms 快也沒有用：Wait 20 ms。',
 end:'Stop 之後 Close 格：先把 duty 寫回中間值或 0（看機構怎樣比較安全），再 Reset myRIO.vi。'}),
{steps:{title:'M06：AI → duty（0～1）→ PWM',lv:m06,steps:[
 {t:'放 Analog Input 和 PWM',view:'split',add:['wl','ai','volt','w15','pwm','kw','wait','w16','stop','cond','w17'],h:MAINLOOP+`<p>放 ${myrio('Analog Input')}（A/AI0）和 ${myrio('PWM')} ${qd('PWM')}。PWM 的設定視窗：通道選 <b>A/PWM0</b>（第 27 腳）；頻率填 <b>50 Hz</b>；duty cycle 選「由方塊圖輸入」，Express VI 就多出 Duty Cycle 端子。Wait 改成 20。</p>`},
 {t:'公式：電壓 → 0.05～0.10',view:'bd',add:['k5','div','w1','w2','ka','mul','w3','w4','kb','add','w5','w6'],h:`<p>duty ＝ 電壓 ÷ 5 × 0.05 ＋ 0.05。0 V → 0.05（1 ms），5 V → 0.10（2 ms）。</p>${wt([['A/AI0','Divide 的 x'],['常數 5','Divide 的 y'],['Divide','Multiply 的 x'],['常數 0.05','Multiply 的 y','可以動的範圍：0.10 − 0.05'],['Multiply','Add 的 x'],['常數 0.05','Add 的 y','起點：1 ms']])}`},
 {t:'限制範圍，接到 PWM',view:'bd',add:['kHi','kLo','co','w7','w8','w9','w10','duty','w11'],h:`<p>In Range and Coerce：upper 0.1、lower 0.05。之後裝上夾爪，機構的極限比伺服馬達小，就是改這兩個常數。</p><p>coerced(x) 接 PWM 的 Duty Cycle，再 Create ▸ Indicator 一個「Duty（0～1）」。</p>`},
 {t:'換算成高電位 ms，給人看',view:'split',add:['k20','m20','w12','w13','pms','w14'],h:`<p>Multiply 乘 20（50 Hz 的週期是 20 ms），Create ▸ Indicator「高電位 ms」。程式不需要它，<b>是給你檢查的</b>：轉到兩端應該看到 1.00 和 2.00。</p>`},
 {t:'Run',view:'split',add:[],h:`<p>Run，改「（模擬）可變電阻的電壓」。注意 duty 顯示 0.0750，不是 7.5：如果你接上去的是 7.5，Express VI 會當成超出範圍，伺服馬達不會照你想的動。</p>`}
]}},
ask('同學把公式寫成 duty ＝ 電壓 ÷ 5 × 5 ＋ 5（以為單位是 %），伺服馬達會怎樣？',
 `<p>算出來是 5～10，遠超過 duty 的上限 1。送出去不是你想的 5～10 %。<b>第一件事永遠是查 Express VI 要的單位和範圍</b>（在 Express VI 上按右鍵 ▸ Help），再寫公式。這跟接儀器時「先看說明書的命令格式」是同一個習慣。</p>`),
tip('直流馬達也是同一個 Express VI','直流馬達：設定視窗頻率改 20 kHz 左右（看驅動板），duty 0～1 就是油門。方向用 Digital Output 寫 AIN1、AIN2（M07 的程式會用到）。')
]);

/* ============================== M07 ============================== */
const CPR=1440;
const m07={name:'Main.vi（M07：比例控制轉到目標角度）',view:'split',ratio:2.1,
 fp:{w:300,h:300,items:[
  {id:'tgt',k:'num',ctl:true,label:'目標角度 °',x:16,y:24,w:80,v:90,inc:10},
  {id:'kp',k:'num',ctl:true,label:'Kp（%／度）',x:140,y:24,w:80,v:2,inc:0.5,dig:1},
  {id:'ang',k:'num',label:'角度 °',x:16,y:84,w:80,dig:1},
  {id:'duty',k:'num',label:'輸出 %（−100～100）',x:140,y:84,w:80,dig:1},
  {id:'chart',k:'chart',label:'角度圖（0～120°）',x:16,y:140,w:260,h:80,min:0,max:120},
  {id:'stop',k:'btn',label:'stop',text:'STOP',stop:true,x:16,y:250}]},
 bd:{w:790,h:330,structs:[{id:'wl',k:'while',x:60,y:20,w:710,h:290,name:'Main Loop（10 ms 一圈）'}],
  nodes:[
  {id:'enc',...X('enc','Encoder','ENC',[],['Counter Value'],90,50)},
  {id:'kc',k:'const',t:'i32',v:CPR,x:150,y:92},
  {id:'div',k:'fn',fn:'Divide',x:200,y:63},
  {id:'k360',k:'const',t:'dbl',v:360,x:228,y:100},
  {id:'mul',k:'fn',fn:'Multiply',x:270,y:70},
  {id:'ang',k:'ind',t:'dbl',label:'角度 °',x:335,y:50},
  {id:'chart',k:'ind',t:'dbl',label:'角度圖',x:335,y:95},
  {id:'tgt',k:'ctl',t:'dbl',label:'目標角度 °',x:262,y:150},
  {id:'sub',k:'fn',fn:'Subtract',x:350,y:128},
  {id:'kp',k:'ctl',t:'dbl',label:'Kp',x:350,y:180},
  {id:'mk',k:'fn',fn:'Multiply',x:410,y:135},
  {id:'k100',k:'const',t:'dbl',v:100,x:430,y:96},
  {id:'km100',k:'const',t:'dbl',v:-100,x:422,y:172},
  {id:'co',k:'fn',fn:'In Range and Coerce',x:470,y:125},
  {id:'duty',k:'ind',t:'dbl',label:'輸出 %',x:545,y:70},
  {id:'abs',k:'fn',fn:'Absolute Value',x:545,y:127},
  {id:'kd',k:'const',t:'dbl',v:100,x:585,y:178},
  {id:'d100',k:'fn',fn:'Divide',x:625,y:134},
  {id:'pwm',...X('pwm','PWM','PWM',['Duty Cycle'],[],690,128)},
  {id:'ge',k:'fn',fn:'Greater Or Equal To 0?',x:545,y:205,showName:false},
  {id:'not',k:'fn',fn:'Not',x:600,y:222},
  {id:'kT',k:'const',t:'bool',v:true,x:650,y:250},
  {id:'dio',...X('dio','Digital Output','DO',['A/DIO0','A/DIO1','A/DIO2'],[],690,200)},
  {id:'kw',k:'const',t:'i32',v:10,x:120,y:257},
  {id:'wait',k:'fn',fn:'Wait (ms)',x:160,y:250},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:650,y:278},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w1',from:'enc.Counter Value',to:'div.x',t:'i32'},
  {id:'w2',from:'kc',to:'div.y',t:'i32',mx:194},
  {id:'w3',from:'div.out',to:'mul.x',t:'dbl'},
  {id:'w4',from:'k360',to:'mul.y',t:'dbl',mx:264},
  {id:'w5',from:'mul.out',to:'ang',t:'dbl',mx:315},
  {id:'w6',from:'mul.out',to:'chart',t:'dbl',mx:315},
  {id:'w7',from:'tgt',to:'sub.x',t:'dbl',mx:330},
  {id:'w8',from:'mul.out',to:'sub.y',t:'dbl',mx:315},
  {id:'w9',from:'sub.out',to:'mk.x',t:'dbl'},
  {id:'w10',from:'kp',to:'mk.y',t:'dbl',mx:398},
  {id:'w11',from:'mk.out',to:'co.x',t:'dbl'},
  {id:'w12',from:'k100',to:'co.upper limit',t:'dbl',mx:464},
  {id:'w13',from:'km100',to:'co.lower limit',t:'dbl',mx:466},
  {id:'w14',from:'co.coerced(x)',to:'duty',t:'dbl',mx:525},
  {id:'w15',from:'co.coerced(x)',to:'abs.x',t:'dbl',mx:525},
  {id:'w16',from:'abs.out',to:'d100.x',t:'dbl'},
  {id:'w17',from:'kd',to:'d100.y',t:'dbl',mx:620},
  {id:'w18',from:'d100.out',to:'pwm.Duty Cycle',t:'dbl',mx:670},
  {id:'w19',from:'co.coerced(x)',to:'ge.x',t:'dbl',mx:525},
  {id:'w20',from:'ge.out',to:'dio.A/DIO0',t:'bool',mx:668},
  {id:'w21',from:'ge.out',to:'not.x',t:'bool',mx:585},
  {id:'w22',from:'not.out',to:'dio.A/DIO1',t:'bool',mx:676},
  {id:'w23',from:'kT',to:'dio.A/DIO2',t:'bool',mx:682},
  {id:'w24',from:'kw',to:'wait',t:'i32'},
  {id:'w25',from:'stop',to:'cond',t:'bool'}]},
 sim:{period:100,init:()=>({x:0,v:0,hist:[]}),
  step(inp,st){const kp=+inp.kp||0,tg=+inp.tgt||0;let u=0,e=0,raw=0;
   for(let k=0;k<10;k++){e=tg-st.x;raw=kp*e;u=Math.max(-100,Math.min(100,raw));const f=Math.abs(u)<8?0:u-Math.sign(u)*8;st.v+=(f*9-st.v*4)*0.01;st.x+=st.v*0.01;}
   const cnt=Math.round(st.x/360*CPR),ang=cnt/CPR*360;st.hist.push(ang);if(st.hist.length>130)st.hist.shift();
   return {out:{ang,duty:u,chart:st.hist.slice()},vals:{'enc.Counter Value':cnt,kc:CPR,'div.out':cnt/CPR,k360:360,'mul.out':ang,tgt:tg,'sub.out':e,kp,'mk.out':raw,k100:100,km100:-100,'co.coerced(x)':u,'abs.out':Math.abs(u),kd:100,'d100.out':Math.abs(u)/100,'ge.out':u>=0,'not.out':u<0,kT:true,kw:10,stop:!!inp.stop},
    stop:!!inp.stop,msg:`角度 ${ang.toFixed(1)}°，誤差 ${e.toFixed(1)}°，輸出 ${u.toFixed(1)} %${Math.abs(raw)>100?'（算出 '+raw.toFixed(0)+' %，被限制）':''}`};},
  doneMsg:'迴圈結束。Close 格：duty＝0、STBY＝FALSE，再 Reset myRIO.vi。'}
};
addTo('M07',[
C.h3('LabVIEW','b','動手寫：讀編碼器 → 算誤差 → 輸出 duty 和方向'),
C.plan({start:'Main.vi 的 Main Loop。接線照 M03 的接線 5（驅動板：PWM0 第 27 腳、AIN1＝DIO0、AIN2＝DIO1、STBY＝DIO2）和接線 6（編碼器 ENC.A 第 18 腳、ENC.B 第 22 腳）。',
 in:'Encoder Express VI 的 <code>Counter Value</code>：<b>I32 整數</b>（藍線），從上次歸零到現在數了幾格；它還有 Reset Counter 輸入（TRUE 就歸零）和 Counter Direction、Overflow? 輸出。前面板輸入：目標角度（DBL）、Kp（DBL）。',
 calc:`① 角度 ＝ 計數 ÷ 一圈計數 × 360（一圈計數要<b>實測</b>，網頁先用 ${CPR} 當例子）。② 誤差 ＝ 目標 − 角度（Subtract：上面減下面，順序很重要）。③ 輸出 % ＝ Kp × 誤差，In Range and Coerce 限制在 −100～100。④ 拆成兩件事：大小 ＝ 絕對值 ÷ 100 → PWM 的 duty（0～1）；方向 ＝ 輸出 ≥ 0 → AIN1，反相 → AIN2；STBY 一直 TRUE。`,
 out:'前面板：角度、輸出 %、角度圖（Waveform Chart，看得到衝過頭或停不到）。',
 loop:'10 ms 一圈。控制迴圈要穩定、夠快；M09 會講怎麼讓週期準。',
 end:'Stop 之後 Close 格：先寫 duty＝0、STBY＝FALSE，再 Reset myRIO.vi。馬達一定要停在安全的狀態。'}),
{steps:{title:'M07：編碼器 → 角度 → P 控制 → PWM＋方向',lv:m07,steps:[
 {t:'放 Encoder，換成角度',view:'split',add:['wl','enc','kc','div','w1','w2','k360','mul','w3','w4','ang','w5','chart','w6','kw','wait','w24','stop','cond','w25'],h:MAINLOOP+`<p>放 ${myrio('Encoder')} ${qd('Encoder')}，設定選 <b>A/ENC0</b>。Counter Value 是整數，接到 Divide 的時候 LabVIEW 會自動轉成 DBL（除法的結果有小數）。</p>${wt([['Counter Value','Divide 的 x'],['常數 一圈計數','Divide 的 y','先手轉 10 圈實測'],['Divide','Multiply 的 x'],['常數 360','Multiply 的 y'],['Multiply','角度 °、角度圖']])}<p>先只做到這裡就 Run，<b>用手轉</b>馬達軸一圈，確認角度從 0 變到 360。正負號相反就把 A、B 相對調或乘 −1。</p>`},
 {t:'誤差和 Kp',view:'bd',add:['tgt','sub','w7','w8','kp','mk','w9','w10'],h:`<p>前面板放兩個 Numeric Control：「目標角度 °」「Kp」。${fn('Programming','Numeric','Subtract')} ${qd('Subtract')}：<b>上面接目標、下面接角度</b>，接反了馬達會往反方向越跑越遠（正回授）。</p><p>Multiply：誤差 × Kp ＝ 輸出 %。</p>`},
 {t:'限制在 ±100 %',view:'bd',add:['k100','km100','co','w11','w12','w13','duty','w14'],h:`<p>In Range and Coerce：upper 100、lower −100。Create ▸ Indicator「輸出 %」，看程式到底送了多少。</p>`},
 {t:'大小 → PWM，正負 → 方向',view:'bd',add:['abs','w15','kd','d100','w16','w17','pwm','w18','ge','w19','not','w21','kT','dio','w20','w22','w23'],h:`<p>${fn('Programming','Numeric','Absolute Value')} ${qd('Absolute Value')} 取大小，÷100 變成 0～1 接 PWM 的 Duty Cycle（PWM 設定 A/PWM0、20 kHz 左右）。</p><p>${fn('Programming','Comparison','Greater Or Equal To 0?')} ${qd('Greater Or Equal To 0')} 判斷方向，接 Digital Output（設定勾 A/DIO0、A/DIO1、A/DIO2 三個通道）：</p>${wt([['≥ 0?','A/DIO0（AIN1）'],['≥ 0? → Not','A/DIO1（AIN2）','一個 TRUE 一個 FALSE 決定轉向'],['True 常數','A/DIO2（STBY）','TRUE 驅動板才會動']])}`},
 {t:'Run：改 Kp',view:'split',add:[],h:`<p>Run，看角度圖。Kp 改 0.5、2、8 各跑一次（改完按 STOP 再 Run，從 0° 重新開始）。對照上面的模擬：太小停不到，太大來回擺。</p>`}
]}},
ask('目標從 90 改成 −90，Subtract 和方向這兩段要改嗎？',
 `<p>都不用改。誤差變成負的，輸出 % 變成負的，≥ 0? 變 FALSE，AIN1、AIN2 對調，馬達自己反轉。<b>正負號就是方向</b>，這是為什麼要先算「帶正負號的輸出」，最後才拆成大小和方向。</p>`),
note('一圈計數為什麼放常數而不是寫死在公式裡','放成一個有標籤的常數（或前面板的控制元件），換馬達、換減速比時只改一個地方，看圖的人也知道這個數字是什麼。')
]);
})();
