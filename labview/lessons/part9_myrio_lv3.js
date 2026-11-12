/* 第九部分：myRIO 的「動手寫 LabVIEW」段落（M08、M09）。在 part9_myrio_lv2.js 之後載入。
   MPU-6050：位址 0x68、WHO_AM_I 0x75、PWR_MGMT_1 0x6B、加速度從 0x3B 起 6 個位元組（高位在前）、±2 g 時 16384 LSB/g（元件規格，M08 課文已列）。
   Timed Loop：Programming ▸ Structures ▸ Timed Structures；RT FIFO：Real-Time ▸ RT FIFO（LabVIEW Real-Time Module）。 */
(function(){
const L=window.LESSONS,fn=C.fn,qd=C.qd,wt=C.wt;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
Object.assign(LV.F,{
 'Type Cast':{g:'⇢\nCAST',ins:['type','x'],outs:['*(type *) &x'],w:40,h:34,pal:['Functions','Programming','Numeric','Data Manipulation','Type Cast']},
 'Max & Min':{g:'max\nmin',ins:['x','y'],outs:['max(x, y)','min(x, y)'],w:40,h:34,pal:['Functions','Programming','Comparison','Max & Min']}
});
const X=(id,name,icon,ins,outs,x,y,o)=>Object.assign({id,k:'sub',name,top:'myRIO',color:'#2f6fd0',icon:[icon],ins,outs,x,y,w:58,h:Math.max(40,Math.max(ins.length,outs.length)*15+12),
 tip:'myRIO 的 Express VI：方塊圖右鍵 ▸ myRIO 選盤。放下去會跳出設定視窗；之後雙擊可以再改。'},o||{});
const myrio=(...p)=>C.pal('Functions','myRIO',...p);
function addTo(id,items){const l=L.find(x=>x.id===id);if(!l)return;const i=l.body.findIndex(b=>typeof b==='string'&&b.includes('小測驗'));l.body.splice(i<0?l.body.length:i,0,...items);}
const hx=b=>b.toString(16).toUpperCase().padStart(2,'0');

/* ============================== M08 ============================== */
const m08={name:'Main.vi（M08：I2C 讀 MPU-6050 加速度）',view:'split',ratio:2.1,
 fp:{w:300,h:270,items:[
  {id:'tilt',k:'num',ctl:true,label:'（模擬）把感測器往右傾斜幾度',x:16,y:24,w:80,v:0,inc:15},
  {id:'raw',k:'arr',t:'u8',n:6,label:'Bytes Read（原始 6 個位元組）',x:16,y:84},
  {id:'gx',k:'num',label:'X g',x:16,y:150,w:70,dig:3},
  {id:'gy',k:'num',label:'Y g',x:100,y:150,w:70,dig:3},
  {id:'gz',k:'num',label:'Z g',x:184,y:150,w:70,dig:3},
  {id:'stop',k:'btn',label:'stop',text:'STOP',stop:true,x:16,y:210}]},
 bd:{w:760,h:280,structs:[{id:'wl',k:'while',x:200,y:20,w:540,h:240,name:'Main Loop'}],
  nodes:[
  {id:'kwk',k:'const',t:'u8[]',v:'6B 00',hex:true,x:14,y:71,w:60,label:'叫醒：寫 0x6B＝0'},
  {id:'wake',k:'sub',name:'I2C（叫醒）',top:'myRIO',color:'#2f6fd0',icon:['I2C','W'],ins:['Bytes to Write'],outs:[],err:true,x:100,y:50,w:58,h:52},
  {id:'tn',k:'tunnel',s:'wl',y:95},
  {id:'k3b',k:'const',t:'u8[]',v:'3B',hex:true,x:240,y:62,w:40,label:'從 0x3B 開始'},
  {id:'rd',k:'sub',name:'I2C（讀 6 個）',top:'myRIO',color:'#2f6fd0',icon:['I2C','W→R'],ins:['Bytes to Write'],outs:['Bytes Read'],err:true,x:300,y:50,w:58,h:52},
  {id:'raw',k:'ind',t:'u8[]',label:'Bytes Read',x:420,y:150},
  {id:'kty',k:'const',t:'i16[]',v:'I16 陣列',x:390,y:26,w:60},
  {id:'tc',k:'fn',fn:'Type Cast',x:460,y:50},
  {id:'k16',k:'const',t:'dbl',v:16384,x:470,y:112,label:'±2 g'},
  {id:'div',k:'fn',fn:'Divide',x:530,y:60},
  {id:'ia3',k:'fn',fn:'Index Array',ins:['array'],outs:['X','Y','Z'],x:585,y:45,w:36,h:60},
  {id:'gx',k:'ind',t:'dbl',label:'X g',x:660,y:40},
  {id:'gy',k:'ind',t:'dbl',label:'Y g',x:660,y:80},
  {id:'gz',k:'ind',t:'dbl',label:'Z g',x:660,y:120},
  {id:'kw',k:'const',t:'i32',v:10,x:240,y:217},
  {id:'wait',k:'fn',fn:'Wait (ms)',x:280,y:210},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:650,y:218},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w1',from:'kwk',to:'wake.Bytes to Write',t:'u8[]',mx:88},
  {id:'w2',from:'wake.error out',to:'tn',t:'err'},
  {id:'w3',from:'tn.i',to:'rd.error in',t:'err',mx:260},
  {id:'w4',from:'k3b',to:'rd.Bytes to Write',t:'u8[]',mx:290},
  {id:'w5',from:'rd.Bytes Read',to:'tc.x',t:'u8[]',mx:400},
  {id:'w6',from:'kty',to:'tc.type',t:'i16[]',mx:455},
  {id:'w7',from:'rd.Bytes Read',to:'raw',t:'u8[]',mx:400},
  {id:'w8',from:'tc.*(type *) &x',to:'div.x',t:'i16[]',mx:515},
  {id:'w9',from:'k16',to:'div.y',t:'dbl',mx:520},
  {id:'w10',from:'div.out',to:'ia3.array',t:'dbl[]',mx:572},
  {id:'w11',from:'ia3.X',to:'gx',t:'dbl',mx:640},
  {id:'w12',from:'ia3.Y',to:'gy',t:'dbl',mx:645},
  {id:'w13',from:'ia3.Z',to:'gz',t:'dbl',mx:650},
  {id:'w14',from:'kw',to:'wait',t:'i32'},
  {id:'w15',from:'stop',to:'cond',t:'bool'}]},
 sim:{period:100,init:()=>({r:9}),
  step(inp,st){const rn=()=>{st.r=(st.r*1103515245+12345)%2147483648;return st.r/2147483648-0.5;};
   const th=(+inp.tilt||0)*Math.PI/180,g=[Math.sin(th)+rn()*0.01,rn()*0.01,Math.cos(th)+rn()*0.01];
   const iv=g.map(v=>Math.max(-32768,Math.min(32767,Math.round(v*16384)))),bytes=[];iv.forEach(v=>{const u=v&0xFFFF;bytes.push(u>>8,u&0xFF);});
   const gg=iv.map(v=>v/16384);
   return {out:{raw:bytes,gx:gg[0],gy:gg[1],gz:gg[2]},vals:{kwk:'6B 00',k3b:'3B','rd.Bytes Read':'['+bytes.map(hx).join(' ')+']',kty:'I16[]','tc.*(type *) &x':'['+iv.join(', ')+']',k16:16384,'div.out':'['+gg.map(v=>v.toFixed(3)).join(', ')+']','ia3.X':gg[0],'ia3.Y':gg[1],'ia3.Z':gg[2],kw:10,stop:!!inp.stop},
    stop:!!inp.stop,msg:`讀到 ${bytes.map(hx).join(' ')} → I16 ${iv.join('、')} → ÷16384`};},
  doneMsg:'迴圈結束'}
};
addTo('M08',[
C.h3('LabVIEW','b','動手寫：叫醒、讀 6 個位元組、換成 g'),
C.plan({start:'Main.vi。<b>Initialize 那一格</b>放「叫醒」（只做一次），Main Loop 裡放「讀加速度」。動手前先照上面第 2 步，用 WHO_AM_I 確認讀得到 0x68。',
 in:'I2C Express VI 的 <code>Bytes Read</code>：<b>U8 陣列</b>，6 個位元組依序是 X 高、X 低、Y 高、Y 低、Z 高、Z 低。',
 calc:'① 每兩個位元組合成一個<b>有號</b> 16 位元整數：Type Cast 成 I16 陣列（Type Cast 把高位元組放前面，剛好跟 MPU-6050 一樣）。② 換成 g：整個陣列除以 16384（±2 g 量程）：Divide 可以直接接陣列，三個一起除。③ Index Array 拉成 3 個輸出拿 X、Y、Z。',
 out:'前面板：原始的 6 個位元組（用十六進位顯示：右鍵 ▸ Display Format ▸ Hexadecimal），和 X、Y、Z 三個 g 值。<b>原始資料留著顯示</b>，換算錯的時候才對得出來。',
 loop:'10 ms 一圈。I2C 400 kHz 讀 6 個位元組不到 1 ms。',
 end:'error 線從叫醒一路接到迴圈裡：叫醒失敗，後面就不讀。Stop 結束。'}),
{steps:{title:'M08：I2C → U8[6] → I16[3] → g',lv:m08,steps:[
 {t:'Initialize：叫醒 MPU-6050',view:'bd',add:['kwk','wake','w1','wl','tn','w2','kw','wait','w14','stop','cond','w15'],h:`<p>在範本的 Initialize 格放 ${myrio('I2C')} ${qd('I2C')}：接頭選 A、位址 0x68、模式選「寫」。要寫的位元組是一個 U8 陣列常數 <code>6B 00</code>：第一個是暫存器位址 0x6B（PWR_MGMT_1），第二個是要寫進去的值 0。</p><p>陣列常數改十六進位：在常數上按右鍵 ▸ Display Format ▸ Hexadecimal。</p><p>error out 接進 Main Loop：<b>資料流保證先叫醒、再讀</b>。</p>`},
 {t:'迴圈裡：寫 0x3B，讀 6 個',view:'split',add:['k3b','rd','w3','w4','raw','w7','tilt'],h:`<p>Main Loop 裡再放一個 I2C Express VI，模式選「先寫再讀」，讀的數量填 <b>6</b>。要寫的是一個位元組 <code>3B</code>：告訴它「從 0x3B 開始讀」。</p><p>Bytes Read 先接一個陣列 Indicator（十六進位顯示），Run，<b>先看原始位元組</b>。平放時最後兩個（Z）應該是 40 00 附近。</p>`},
 {t:'Type Cast 成 I16',view:'bd',add:['kty','tc','w5','w6'],h:`<p>${fn('Programming','Numeric','Data Manipulation','Type Cast')} ${qd('Type Cast')}：<code>x</code> 接 Bytes Read；上面的 <code>type</code> 接一個 <b>I16 的陣列常數</b>（內容不重要，只告訴它要變成什麼型別）。</p><p>6 個 U8 變成 3 個 I16。0xFC18 會變成 −1000，不是 64536：I16 是有號的。</p>`},
 {t:'÷16384，拆成三軸',view:'split',add:['k16','div','w8','w9','ia3','w10','gx','gy','gz','w11','w12','w13'],h:`<p>Divide：上面接 I16 陣列，下面接常數 16384（DBL）。陣列除以一個數 → 每一個元素都除，輸出 DBL 陣列。常數旁邊加標籤「±2 g」：量程改了，這個數字要跟著改。</p><p>Index Array 拉成 3 個輸出 → X g、Y g、Z g。</p>`},
 {t:'Run：傾斜看看',view:'split',add:[],h:`<p>Run，改「（模擬）傾斜幾度」，同時看原始位元組和 g 值怎麼變。往左傾（負的角度）時 X 的高位元組變成 F? 開頭：負數。</p>`}
]}},
ask('把 Type Cast 的 type 改成 U16 陣列，平放時 Z 還是 1 g，X 讀到 −0.01 g 的時候會顯示多少？',
 `<p>−0.01 g × 16384 ≈ −164，16 位元是 0xFF5C。當成 U16 是 65372，÷16384 ≈ <b>3.99 g</b>。只要有一點點負的就跳到快 4 g，這就是「有號、無號搞錯」最典型的樣子：數字在 0 附近正常，一變負就變很大。</p>`)
]);

/* ============================== M09 ============================== */
const m09={name:'Main.vi（M09：量每一圈的實際週期）',view:'split',ratio:1.9,
 fp:{w:300,h:270,items:[
  {id:'slow',k:'btn',mech:'switch',label:'（模擬）每一圈都寫一行紀錄檔',showLabel:true,text:'寫檔 開／關',x:16,y:26},
  {id:'per',k:'num',label:'這一圈 ms',x:16,y:90,w:70},
  {id:'mx',k:'num',label:'最長 ms',x:120,y:90,w:70},
  {id:'chart',k:'chart',label:'每一圈的週期（0～40 ms）',x:16,y:146,w:260,h:70,min:0,max:40},
  {id:'stop',k:'btn',label:'stop',text:'STOP',stop:true,x:200,y:240}]},
 bd:{w:650,h:280,structs:[{id:'wl',k:'while',x:60,y:20,w:560,h:240,name:'Main Loop'}],
  nodes:[
  {id:'t0',k:'fn',fn:'Tick Count (ms)',x:8,y:104,showName:false},
  {id:'sr1',k:'sr',t:'u32',s:'wl',y:120},
  {id:'tick',k:'fn',fn:'Tick Count (ms)',x:100,y:50},
  {id:'sub',k:'fn',fn:'Subtract',x:190,y:59},
  {id:'per',k:'ind',t:'u32',label:'這一圈 ms',x:260,y:50},
  {id:'chart',k:'ind',t:'u32',label:'週期圖',x:260,y:95},
  {id:'k0',k:'const',t:'u32',v:0,x:22,y:191},
  {id:'sr2',k:'sr',t:'u32',s:'wl',y:200},
  {id:'mm',k:'fn',fn:'Max & Min',x:300,y:150},
  {id:'mx',k:'ind',t:'u32',label:'最長 ms',x:400,y:150},
  {id:'slow',k:'sub',name:'寫一行紀錄檔（慢的工作）',top:'FILE',color:'#8d6e00',icon:['LOG'],ins:[],outs:[],x:430,y:60,w:46,h:40,tip:'代表一件會偶爾變慢的工作，例如寫檔'},
  {id:'kw',k:'const',t:'i32',v:10,x:420,y:217},
  {id:'wait',k:'fn',fn:'Wait (ms)',x:460,y:210},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:540,y:228},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w1',from:'t0',to:'sr1.init',t:'u32'},
  {id:'w2',from:'tick',to:'sub.x',t:'u32'},
  {id:'w3',from:'sr1.L',to:'sub.y',t:'u32',mx:170},
  {id:'w4',from:'tick',to:'sr1.R',t:'u32',pts:[[160,66],[160,36],[600,36],[600,120]]},
  {id:'w5',from:'sub.out',to:'per',t:'u32',mx:240},
  {id:'w6',from:'sub.out',to:'chart',t:'u32',mx:240},
  {id:'w7',from:'k0',to:'sr2.init',t:'u32'},
  {id:'w8',from:'sub.out',to:'mm.x',t:'u32',mx:240},
  {id:'w9',from:'sr2.L',to:'mm.y',t:'u32',mx:280},
  {id:'w10',from:'mm.max(x, y)',to:'mx',t:'u32'},
  {id:'w11',from:'mm.max(x, y)',to:'sr2.R',t:'u32',mx:380},
  {id:'w12',from:'kw',to:'wait',t:'i32'},
  {id:'w13',from:'stop',to:'cond',t:'bool'}]},
 sim:{period:100,init:()=>({t:1000,mx:0,hist:[],r:5,first:true}),
  step(inp,st){const rn=()=>{st.r=(st.r*1103515245+12345)%2147483648;return st.r/2147483648;};
   let work=rn()<0.5?0:1;if(inp.slow)work+=rn()<0.15?5+Math.round(rn()*20):1+Math.round(rn()*2);
   const p=10+work,prev=st.t;st.t+=p;const mx=Math.max(st.mx,p);st.mx=mx;st.hist.push(p);if(st.hist.length>130)st.hist.shift();
   return {out:{per:p,mx,chart:st.hist.slice()},vals:{t0:1000,tick:st.t,'sr1.L':prev,'sub.out':p,'sr2.L':mx,'mm.max(x, y)':mx,k0:0,kw:10,stop:!!inp.stop},
    stop:!!inp.stop,msg:`這一圈 ${p} ms（Wait 10 ＋ 工作 ${work} ms），目前最長 ${mx} ms`};},
  doneMsg:'迴圈結束'}
};
addTo('M09',[
C.h3('LabVIEW','b','動手寫：先量，再改'),
C.plan({start:'M07 的 Main.vi（另存一份）。先不改控制，<b>只加量測</b>。',
 in:'Tick Count (ms)：U32，從某個時間開始數的毫秒數。單看它沒意義，<b>兩次相減</b>才是經過的時間。',
 calc:'這一圈的週期 ＝ 這一圈的 Tick Count − 上一圈的 Tick Count。上一圈的值放 Shift Register；初始值接一個迴圈外的 Tick Count，第一圈才不會算出一個超大的數字。最長的一圈：Max & Min 跟上一次的最大值比，結果放第二個 Shift Register。',
 out:'「這一圈 ms」「最長 ms」兩個數字，加一張 Waveform Chart 畫每一圈的週期：偶爾的一根尖刺，數字一閃就過，圖上才看得到。',
 loop:'照原本的 Wait 10。量完、確認問題之後，才換成 Timed Loop（下面的步驟）。',
 end:'量測本身也要花時間，但很少（一次 Tick Count 和一次減法）。'}),
{steps:{title:'M09：Tick Count 相減 → 週期、最長',lv:m09,steps:[
 {t:'放 Tick Count，記住上一圈',view:'bd',add:['wl','t0','sr1','w1','tick','sub','w2','w3','w4','kw','wait','w12','stop','cond','w13','slow'],h:`<p>${fn('Programming','Timing','Tick Count (ms)')} ${qd('Tick Count')} 放兩個：一個在迴圈<b>外面</b>（接 Shift Register 的初始值），一個在迴圈裡面。</p>${wt([['迴圈裡的 Tick Count','Subtract 的 x，和右邊 Shift Register'],['左邊 Shift Register（上一圈）','Subtract 的 y'],['迴圈外的 Tick Count','左邊 Shift Register 外側','第一圈的「上一圈」']])}<p>右上那個「寫一行紀錄檔」代表原本迴圈裡的慢工作（M07 時你放進去的畫圖、寫檔）。</p>`},
 {t:'顯示，畫圖',view:'split',add:['per','chart','w5','w6'],h:`<p>Subtract 的輸出 Create ▸ Indicator「這一圈 ms」，再接一張 Waveform Chart。</p>`},
 {t:'記住最長的一圈',view:'split',add:['k0','sr2','w7','mm','w8','w9','mx','w10','w11'],h:`<p>${fn('Programming','Comparison','Max & Min')} ${qd('Max & Min')}：x 接這一圈、y 接上一次的最大值（第二個 Shift Register，初始值 0），<code>max(x, y)</code> 存回去，也接「最長 ms」。</p>`},
 {t:'Run：開關寫檔',view:'split',add:[],h:`<p>Run。先關掉「寫檔」：週期大多是 10～11 ms（Wait 10 ＋ 工作時間）。再打開：偶爾跳到 20、30 ms。<b>這就是控制偶爾抖一下的原因</b>，有數字了才去改。</p>`}
]}},
C.h3('LabVIEW','b','改成 Timed Loop ＋ RT FIFO'),
`<ol class="mr-steps">
<li>方塊圖右鍵 ▸ ${fn('Programming','Structures','Timed Structures','Timed Loop')}，拖出一個框。雙擊左邊的輸入節點打開設定：<b>Period 填 10</b>（ms），<b>Priority</b> 填一個比預設大的數字（數字越大越優先）。</li>
<li>把「讀 Encoder → 計算 → 寫 PWM」這幾個搬進 Timed Loop。Wait 刪掉：Timed Loop 自己控制週期，裡面不需要 Wait。</li>
<li>Timed Loop 框裡面左邊有一個資料節點（Left Data Node），往下拉、選 <b>Finished Late? [i-1]</b>，接一個指示燈：上一圈晚了就亮，比自己量更直接。</li>
<li>迴圈前放 ${fn('Real-Time','RT FIFO','RT FIFO Create')}：type 接一個 DBL 常數、size 填 1000。Timed Loop 裡用 <b>RT FIFO Write</b> 寫角度（timeout 填 0：滿了也不要等，控制迴圈絕對不能卡住）。</li>
<li>另一個普通 While Loop（Wait 100）用 <b>RT FIFO Read</b> 把資料讀出來畫圖、寫檔。兩個迴圈都結束後放 <b>RT FIFO Delete</b>。</li>
<li>再 Run 一次，看 Finished Late? 還會不會亮、角度圖還抖不抖。</li></ol>`,
ask('RT FIFO Write 的 timeout 填 −1（一直等）會怎樣？',
 `<p>FIFO 滿了的時候（例如畫圖的迴圈被拖慢），控制迴圈就停在 Write 等，<b>控制迴圈被慢的迴圈拖住</b>，等於又把慢工作搬回來了。控制迴圈寧可丟掉一筆紀錄，也不能晚。</p>`)
]);

/* ============================== M03B 第 6 步 ============================== */
const m03b={name:'Main.vi（M3+：開關控制麵包板上的 LED）',view:'split',ratio:1.6,
 fp:{w:300,h:220,items:[
  {id:'sw',k:'btn',mech:'switch',style:'toggle',label:'LED 亮',x:16,y:26},
  {id:'mode',k:'ring',ctl:true,label:'（模擬）LED 怎麼接',options:['正向接法（DIO → 電阻 → LED → GND）','負向接法（+3.3V → 電阻 → LED → DIO）'],x:16,y:80,v:1},
  {id:'dout',k:'leds',label:'A/DIO0 寫出去的值',names:['DIO0'],cols:1,x:16,y:140},
  {id:'bbled',k:'led',label:'（模擬）麵包板上的 LED',color:'red',x:170,y:140},
  {id:'stop',k:'btn',label:'stop',text:'STOP',stop:true,x:170,y:180}]},
 bd:{w:560,h:220,structs:[{id:'wl',k:'while',x:40,y:20,w:500,h:180,name:'Main Loop'}],
  nodes:[
  {id:'sw',k:'ctl',t:'bool',label:'LED 亮',x:90,y:66},
  {id:'not',k:'fn',fn:'Not',x:200,y:62,tip:'負向接法才需要：寫 FALSE 才亮'},
  {id:'dout',...X('dout','Digital Output','DO',['A/DIO0'],[],300,56)},
  {id:'kw',k:'const',t:'i32',v:10,x:300,y:147},
  {id:'wait',k:'fn',fn:'Wait (ms)',x:340,y:140},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:440,y:168},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w1',from:'sw',to:'not.x',t:'bool'},
  {id:'w2',from:'not.out',to:'dout.A/DIO0',t:'bool'},
  {id:'w3',from:'kw',to:'wait',t:'i32'},
  {id:'w4',from:'stop',to:'cond',t:'bool'}]},
 sim:{period:100,init:()=>({}),
  step(inp){const sw=!!inp.sw,sink=(+inp.mode||0)===1,d=!sw,lit=sink?!d:d;
   return {out:{dout:[d],bbled:lit},vals:{sw,'not.out':d,kw:10,stop:!!inp.stop},stop:!!inp.stop,
    msg:`開關 ${sw?'TRUE':'FALSE'} → Not → DIO0 寫 ${d?'TRUE（3.3 V）':'FALSE（0 V）'} → ${sink?'負向接法':'正向接法'}：LED ${lit?'亮':'滅'}${!sink?'（正向接法不需要 Not，把它拿掉）':''}`};},
  doneMsg:'迴圈結束。Reset myRIO.vi 之後 DIO0 變回輸入（上拉），負向接法的 LED 兩端都是 3.3 V，不亮。'}
};
(function(){const l=L.find(x=>x.id==='M03B');if(!l)return;const i=l.body.findIndex(b=>typeof b==='string'&&b.includes('Express VI 的輸入接一個前面板的布林開關'));if(i<0)return;l.body.splice(i,1,
C.plan({start:'M02 的專案 ▸ <b>myRIO 底下</b>的 Main.vi（標題列斜線後面是 myRIO）。在 Main Loop 裡寫。',
 in:'前面板一個布林開關「LED 亮」（Controls ▸ Modern ▸ Boolean ▸ Vertical Toggle Switch 之類，機械動作用 Switch When Pressed：切一下就保持）。',
 calc:'先想清楚「LED 亮」要 DIO0 寫什麼：<b>正向接法</b>寫 TRUE 亮 → 開關直接接；<b>負向接法</b>寫 FALSE 才亮 → 中間加一個 Not。讓前面板的意思永遠是「TRUE＝亮」，接法的差別藏在方塊圖裡。',
 out:'Digital Output Express VI，通道 A/DIO0（板子上印「0」的那一排）。',
 loop:'人在切開關，10 ms 一圈綽綽有餘（範本原本就是 10）。',
 end:'Stop 結束，Reset myRIO.vi 把 DIO0 放掉。'}),
{steps:{title:'M3+：開關 → (Not) → A/DIO0',lv:m03b,steps:[
 {t:'放開關和 Digital Output',view:'split',add:['wl','sw','dout','kw','wait','w3','stop','cond','w4','mode'],h:`<p>前面板放一個布林開關，標籤改「LED 亮」。方塊圖放 ${C.pal('Functions','myRIO','Digital Output')} ${qd('Digital Output')}，設定視窗選 <b>A/DIO0</b>。</p><p>正向接法：開關直接接到 A/DIO0 就完成了。</p>`},
 {t:'負向接法：加 Not',view:'bd',add:['not','w1','w2'],h:`<p>${fn('Programming','Boolean','Not')} ${qd('Not')} 放在中間。在線上點一下右鍵 ▸ Insert ▸ Boolean ▸ Not，可以直接插進已經接好的線。</p>`},
 {t:'Run：切開關、換接法',view:'split',add:['dout','bbled'],h:`<p>Run，切「LED 亮」。再把「（模擬）LED 怎麼接」換成正向接法：有 Not 的程式，開關 TRUE 反而滅。<b>程式和接線要一起改</b>。</p>`}
]}});})();

/* ============================== M12 狀態機骨架 ============================== */
const ST=['初始化','等待','回原點','到 90°','夾緊','放開','回 0°','故障'];
const FR={ /* 每一頁：說明、下一步（單一常數）或 [條件, 條件成立去哪] */
 '初始化':{txt:'開 I2C、叫醒 MPU-6050、開檔、LED0 亮',one:'等待'},
 '等待':{txt:'等啟動鈕的上升緣',cond:'tst',go:'回原點'},
 '回原點':{txt:'慢速找原點，計數歸零（超時 → 故障）',cond:'pos',go:'到 90°'},
 '到 90°':{txt:'M07 的比例控制，目標 90°',cond:'pos',go:'夾緊'},
 '夾緊':{txt:'伺服到閉合角度，等 2 秒',cond:'tmr',go:'放開'},
 '放開':{txt:'伺服到打開角度',one:'回 0°'},
 '回 0°':{txt:'比例控制回 0°，記錄一筆',cond:'pos',go:'等待'},
 '故障':{txt:'PWM＝0、STBY＝FALSE、LED 閃；按啟動才重來',cond:'tst',go:'初始化'}
};
const fr=s=>'cs:'+s;
const m12nodes=[],m12wires=[];
ST.forEach((s,k)=>{const f=FR[s],F=fr(s);
 m12nodes.push({id:'lb'+k,k:'label',text:f.txt,x:290,y:62,w:270,h:24,f:F});
 if(f.one){m12nodes.push({id:'kn'+k,k:'const',t:'enum',v:f.one,x:420,y:141,f:F});m12wires.push({id:'wn'+k,from:'kn'+k,to:'tnx.i',t:'enum',mx:560,f:F});}
 else{
  m12nodes.push({id:'kg'+k,k:'const',t:'enum',v:f.go,x:340,y:125,f:F},{id:'ks'+k,k:'const',t:'enum',v:s,x:340,y:168,f:F},{id:'s2'+k,k:'fn',fn:'Select',x:470,y:140,f:F});
  m12wires.push({id:'wg'+k,from:'kg'+k,to:'s2'+k+'.t',t:'enum',mx:440,f:F},{id:'ws'+k,from:'ks'+k,to:'s2'+k+'.f',t:'enum',mx:450,f:F},{id:'wo'+k,from:'s2'+k+'.out',to:'tnx.i',t:'enum',mx:560,f:F});
  if(f.cond==='tst') m12wires.push({id:'wc'+k,from:'tst.i',to:'s2'+k+'.s',t:'bool',mx:430,f:F});
  else{m12nodes.push({id:'cd'+k,k:'sub',name:f.cond==='pos'?'到位了？':'過了 2 秒？',top:'?',color:'#6d4c41',icon:[f.cond==='pos'?'誤差<1°':'≥2000ms'],ins:[],outs:['TF'],x:330,y:200,w:50,h:36,f:F,tip:f.cond==='pos'?'M07：|誤差| < 1° 持續 200 ms':'Tick Count 相減 ≥ 2000（進這一頁時記下開始時間）'});
   m12wires.push({id:'wc'+k,from:'cd'+k+'.TF',to:'s2'+k+'.s',t:'bool',mx:430,f:F});}
 }
});
const m12={name:'Main.vi（M12：狀態機骨架）',view:'split',ratio:2.1,
 fp:{w:300,h:250,items:[
  {id:'start',k:'btn',label:'啟動',text:'啟動',x:16,y:26},
  {id:'est',k:'btn',mech:'switch',style:'toggle',label:'急停（打開＝TRUE）',x:120,y:26},
  {id:'stat',k:'str',label:'目前狀態',x:16,y:96,w:150},
  {id:'stop',k:'btn',label:'stop',text:'STOP',stop:true,x:200,y:96},
  {k:'text',text:'網頁模擬：每個動作大約 1.5 秒「到位」',x:16,y:160,size:12}]},
 bd:{w:760,h:330,structs:[{id:'wl',k:'while',x:70,y:20,w:670,h:290,name:'Timed Loop／Main Loop（10 ms）'},{id:'cs',k:'case',x:250,y:50,w:380,h:210,frames:ST,cur:1}],
  nodes:[
  {id:'k0',k:'const',t:'enum',v:'初始化',x:8,y:111},
  {id:'sr',k:'sr',t:'enum',s:'wl',y:120},
  {id:'est',k:'ctl',t:'bool',label:'急停',x:110,y:60},
  {id:'kflt',k:'const',t:'enum',v:'故障',x:110,y:95},
  {id:'es',k:'fn',fn:'Select',x:190,y:80},
  {id:'sel',k:'sel',t:'enum',s:'cs',y:96},
  {id:'start',k:'ctl',t:'bool',label:'啟動（上升緣）',x:110,y:200},
  {id:'tst',k:'tunnel',t:'bool',s:'cs',y:216},
  {id:'tnx',k:'tunnel',t:'enum',s:'cs',side:'r',y:150},
  {id:'stat',k:'ind',t:'enum',label:'目前狀態',x:660,y:180},
  ...m12nodes,
  {id:'kw',k:'const',t:'i32',v:10,x:260,y:277},
  {id:'wait',k:'fn',fn:'Wait (ms)',x:300,y:270},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:640,y:278},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w0',from:'k0',to:'sr.init',t:'enum'},
  {id:'w1',from:'est',to:'es.s',t:'bool',mx:175},
  {id:'w2',from:'kflt',to:'es.t',t:'enum',mx:170},
  {id:'w3',from:'sr.L',to:'es.f',t:'enum',mx:180},
  {id:'w4',from:'es.out',to:'sel',t:'enum'},
  {id:'w5',from:'start',to:'tst',t:'bool'},
  ...m12wires,
  {id:'w6',from:'tnx.o',to:'sr.R',t:'enum',mx:700},
  {id:'w7',from:'tnx.o',to:'stat',t:'enum',mx:650},
  {id:'w8',from:'kw',to:'wait',t:'i32'},
  {id:'w9',from:'stop',to:'cond',t:'bool'}]},
 sim:{period:100,init:()=>({s:'初始化',n:0}),
  step(inp,st){const est=!!inp.est,start=!!inp.start,prev=st.s;let cur=est?'故障':st.s;if(cur!==st.s)st.n=0;
   const f=FR[cur];st.n++;let cond=false,next=cur;
   if(f.one)next=f.one;else{cond=f.cond==='tst'?start:f.cond==='tmr'?st.n>=20:st.n>=15;next=cond?f.go:cur;}
   if(next!==cur)st.n=0;st.s=next;const k=ST.indexOf(cur);
   const v={k0:'初始化','sr.L':prev,est,kflt:'故障','es.out':cur,start,'tst.i':start,'tnx.o':next,kw:10,stop:!!inp.stop};
   if(!f.one){v['s2'+k+'.out']=next;v['kg'+k]=f.go;v['ks'+k]=cur;v['cd'+k+'.TF']=cond;}else v['kn'+k]=f.one;
   return {out:{stat:cur+' → 下一圈：'+next},vals:v,frames:{cs:k},stop:!!inp.stop,keep:[],
    msg:`這一圈在「${cur}」${est?'（急停：不管原本在哪，直接進故障）':''} → 下一圈「${next}」`};},
  doneMsg:'迴圈結束。Close：PWM＝0、STBY＝FALSE、關檔、Reset myRIO.vi。'}
};
addTo('M12',[
C.h3('LabVIEW','b','動手寫：狀態機的骨架'),
C.plan({start:'新的 Main.vi（從範本開始）。先只寫骨架：狀態怎麼換，每一頁做的事先用註解代替，跑得通了再一頁一頁填進 M04～M13 的程式。',
 in:'目前狀態：一個 <b>Enum（列舉）</b>，8 個項目照上面的表。啟動鈕（上升緣，M04）、急停（M04 的 Not 之後，TRUE＝要停）。',
 calc:'① 狀態放 Shift Register，初始值「初始化」。② <b>Case 之前</b>先檢查急停：Select（急停 ? 故障 : 原狀態）。這樣每一個狀態都會被急停打斷，不用每一頁各寫一次。③ Case Structure 每一頁算出「下一個狀態」：條件成立去下一步，不成立留在原地（Select）。④ 從 Case 右邊的通道接回 Shift Register。',
 out:'前面板一個 Enum 顯示元件「目前狀態」：除錯時第一個看的就是它。',
 loop:'10 ms（正式版用 M09 的 Timed Loop）。每一頁都要「很快做完就離開」：等 2 秒不能用 Wait 2000，要記下開始時間，每一圈檢查到了沒。',
 end:'故障頁把所有輸出設成安全值；Stop 之後 Close 再設一次，然後 Reset myRIO.vi。'}),
{steps:{title:'M12：Enum ＋ Shift Register ＋ Case',lv:m12,steps:[
 {t:'做 Enum，放 Shift Register',view:'bd',add:['wl','k0','sr','w0','kw','wait','w8','stop','cond','w9'],h:`<p>方塊圖放 ${fn('Programming','Numeric','Enum Constant')}，右鍵 ▸ Edit Items，照順序輸入 8 個狀態。<b>再右鍵 ▸ Make Type Def.</b>（L08）：之後要加一個狀態，只改一個地方，所有用到的常數一起更新。</p><p>Shift Register 的初始值接「初始化」。</p>`},
 {t:'Case 之前先擋急停',view:'bd',add:['est','kflt','es','w1','w2','w3'],h:`<p>Select：s 接急停、t 接常數「故障」、f 接 Shift Register。急停 TRUE 時，不管原本在哪一個狀態，這一圈都變成「故障」。</p>`},
 {t:'放 Case Structure',view:'bd',add:['cs','sel','w4','tnx','w6','stat','w7','start','tst','w5'],h:`<p>${fn('Programming','Structures','Case Structure')} ${qd('Case Structure')}，選擇器接 Select 的輸出。Enum 接上去之後，在框上右鍵 ▸ <b>Add Case for Every Value</b>，8 頁一次建好。</p><p>右邊的輸出通道接回 Shift Register，和「目前狀態」顯示元件。啟動鈕從左邊接進 Case。</p>`},
 {t:'每一頁：決定下一個狀態',view:'bd',add:m12nodes.map(n=>n.id).concat(m12wires.map(w=>w.id)),h:`<p>用 Case 上方的 ◀ ▶ 一頁一頁看。大部分的頁都是同一個樣子：</p>${wt([['常數「下一步」','Select 的 t','條件成立'],['常數「自己」','Select 的 f','條件不成立：下一圈還在這裡'],['條件（到位了？過了 2 秒？啟動？）','Select 的 s'],['Select','右邊的通道']])}<p>「初始化」「放開」做完就走，直接接一個常數。<b>每一頁都要接右邊的通道</b>，漏接的那一頁會輸出預設值（Enum 的第一個：初始化），程式就莫名其妙重來。把通道設成 Use Default If Unwired 會藏住這個錯，不要用。</p>`},
 {t:'Run：啟動、急停',view:'split',add:[],h:`<p>Run，按「啟動」看狀態一路走完回到「等待」。中途打開急停：不管在哪一步都進「故障」；關掉急停再按啟動，從「初始化」重來。方塊圖的 Case 會跟著切到目前那一頁。</p>`}
]}},
ask('「夾緊」那一頁直接放 Wait (ms) 2000 會怎樣？',
 `<p>這一圈要等 2 秒才結束，這 2 秒裡<b>急停讀不到</b>、編碼器沒在讀、其他輸出不會更新。狀態機的每一頁都要很快做完：進來時記下 Tick Count，之後每一圈比一次「過了 2 秒沒」，沒過就留在這一頁。</p>`)
]);
})();
