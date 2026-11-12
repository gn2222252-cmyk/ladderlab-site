/* 第九部分：myRIO 的「動手寫 LabVIEW」段落（M03C、M13、M14）。在 part9_myrio_lv1.js 之後載入。
   Accelerometer Express VI 的 X-Axis、Y-Axis、Z-Axis 照範本 Main.vi 的實機截圖；單位 g。
   Mean PtByPt.vi、Inverse Tangent (2 Input) 是 LabVIEW 內建函式。 */
(function(){
const L=window.LESSONS,fn=C.fn,qd=C.qd,wt=C.wt;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
Object.assign(LV.F,{
 'Mean PtByPt':{g:'x̄\nPtByPt',ins:['x','sample length'],outs:['mean'],w:46,h:36,col:'#e6f0fb',pal:['Functions','Signal Processing','Point By Point','Probability & Statistics PtByPt','Mean PtByPt.vi']},
 'Inverse Tangent (2 Input)':{g:'atan2',ins:['y','x'],outs:['angle'],w:40,h:32,pal:['Functions','Mathematics','Elementary & Special Functions','Trigonometric Functions','Inverse Tangent (2 Input)']}
});
const X=(id,name,icon,ins,outs,x,y,o)=>Object.assign({id,k:'sub',name,top:'myRIO',color:'#2f6fd0',icon:[icon],ins,outs,x,y,w:58,h:Math.max(40,Math.max(ins.length,outs.length)*15+12),
 tip:'myRIO 的 Express VI：方塊圖右鍵 ▸ myRIO 選盤。放下去會跳出設定視窗；之後雙擊可以再改。'},o||{});
const myrio=(...p)=>C.pal('Functions','myRIO',...p);
function addTo(id,items,before){const l=L.find(x=>x.id===id);if(!l)return;const key=before||'小測驗';const i=l.body.findIndex(b=>typeof b==='string'&&b.includes(key));l.body.splice(i<0?l.body.length:i,0,...items);}
const D2R=180/Math.PI;

/* ============================== M13 ============================== */
const m13={name:'Main.vi（M13：水平儀）',view:'split',ratio:2.2,
 fp:{w:300,h:330,items:[
  {id:'acc',k:'num',ctl:true,label:'（模擬）把 myRIO 往右傾斜幾度',x:16,y:24,w:80,v:0,inc:5},
  {id:'shk',k:'btn',mech:'switch',label:'（模擬）桌子在震',showLabel:true,text:'震動 開／關',x:170,y:24},
  {id:'zero',k:'btn',label:'歸零',text:'歸零',x:16,y:84},
  {id:'ang',k:'num',label:'角度 °',x:120,y:84,w:80,dig:1},
  {id:'led',k:'leds',label:'（模擬）LED0～3',names:['左','LED1','LED2','右'],cols:4,x:16,y:150},
  {id:'fault',k:'led',label:'傾斜超過 30°',color:'red',x:16,y:210},
  {id:'stop',k:'btn',label:'stop',text:'STOP',stop:true,x:170,y:210}]},
 bd:{w:790,h:340,structs:[{id:'wl',k:'while',x:50,y:20,w:720,h:300,name:'Main Loop'}],
  nodes:[
  {id:'acc',...X('acc','Accelerometer','ACC',[],['X-Axis','Y-Axis','Z-Axis'],80,50)},
  {id:'k20',k:'const',t:'i32',v:20,x:150,y:140},
  {id:'mx',k:'fn',fn:'Mean PtByPt',x:190,y:50},
  {id:'mz',k:'fn',fn:'Mean PtByPt',x:190,y:100},
  {id:'atan',k:'fn',fn:'Inverse Tangent (2 Input)',x:270,y:75},
  {id:'k57',k:'const',t:'dbl',v:57.2958,x:285,y:125,label:'180/π'},
  {id:'mul',k:'fn',fn:'Multiply',x:350,y:84},
  {id:'sub',k:'fn',fn:'Subtract',x:430,y:91},
  {id:'k0',k:'const',t:'dbl',v:0,x:20,y:271},
  {id:'so',k:'sr',t:'dbl',s:'wl',y:280},
  {id:'zero',k:'ctl',t:'bool',label:'歸零',x:330,y:230},
  {id:'sel',k:'fn',fn:'Select',x:400,y:250},
  {id:'ang',k:'ind',t:'dbl',label:'角度 °',x:490,y:50},
  {id:'km5',k:'const',t:'dbl',v:-5,x:485,y:125},
  {id:'lt',k:'fn',fn:'Less?',x:520,y:110},
  {id:'k5',k:'const',t:'dbl',v:5,x:490,y:172},
  {id:'gt',k:'fn',fn:'Greater?',x:520,y:160},
  {id:'or',k:'fn',fn:'Or',x:580,y:140},
  {id:'not',k:'fn',fn:'Not',x:620,y:140},
  {id:'led',...X('led','LED','LED',['LED0','LED1','LED2','LED3'],[],690,90)},
  {id:'abs',k:'fn',fn:'Absolute Value',x:495,y:215},
  {id:'k30',k:'const',t:'dbl',v:30,x:528,y:250},
  {id:'g30',k:'fn',fn:'Greater?',x:565,y:222},
  {id:'fault',k:'ind',t:'bool',label:'傾斜超過 30°',x:620,y:226},
  {id:'kw',k:'const',t:'i32',v:10,x:200,y:257},
  {id:'wait',k:'fn',fn:'Wait (ms)',x:240,y:250},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:680,y:288},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w1',from:'acc.X-Axis',to:'mx.x',t:'dbl',mx:160},
  {id:'w2',from:'acc.Z-Axis',to:'mz.x',t:'dbl',mx:168},
  {id:'w3',from:'k20',to:'mx.sample length',t:'i32',mx:180},
  {id:'w4',from:'k20',to:'mz.sample length',t:'i32',mx:180},
  {id:'w5',from:'mx.mean',to:'atan.y',t:'dbl',mx:250},
  {id:'w6',from:'mz.mean',to:'atan.x',t:'dbl',mx:256},
  {id:'w7',from:'atan.angle',to:'mul.x',t:'dbl'},
  {id:'w8',from:'k57',to:'mul.y',t:'dbl',mx:347},
  {id:'w9',from:'mul.out',to:'sub.x',t:'dbl'},
  {id:'w10',from:'k0',to:'so.init',t:'dbl'},
  {id:'w11',from:'mul.out',to:'sel.t',t:'dbl',mx:390},
  {id:'w12',from:'zero',to:'sel.s',t:'bool'},
  {id:'w13',from:'so.L',to:'sel.f',t:'dbl',mx:395},
  {id:'w14',from:'sel.out',to:'so.R',t:'dbl',mx:750},
  {id:'w15',from:'sel.out',to:'sub.y',t:'dbl',pts:[[440,266],[440,170],[418,170],[418,112]]},
  {id:'w16',from:'sub.out',to:'ang',t:'dbl',mx:475},
  {id:'w17',from:'sub.out',to:'lt.x',t:'dbl',mx:475},
  {id:'w18',from:'km5',to:'lt.y',t:'dbl',mx:514},
  {id:'w19',from:'sub.out',to:'gt.x',t:'dbl',mx:475},
  {id:'w20',from:'k5',to:'gt.y',t:'dbl',mx:516},
  {id:'w21',from:'lt.out',to:'or.x',t:'bool',mx:564},
  {id:'w22',from:'gt.out',to:'or.y',t:'bool',mx:568},
  {id:'w23',from:'or.out',to:'not.x',t:'bool'},
  {id:'w24',from:'lt.out',to:'led.LED0',t:'bool',mx:670},
  {id:'w25',from:'not.out',to:'led.LED1',t:'bool',mx:662},
  {id:'w26',from:'not.out',to:'led.LED2',t:'bool',mx:674},
  {id:'w27',from:'gt.out',to:'led.LED3',t:'bool',mx:682},
  {id:'w28',from:'sub.out',to:'abs.x',t:'dbl',mx:475},
  {id:'w29',from:'abs.out',to:'g30.x',t:'dbl',mx:545},
  {id:'w30',from:'k30',to:'g30.y',t:'dbl',mx:560},
  {id:'w31',from:'g30.out',to:'fault',t:'bool'},
  {id:'w32',from:'kw',to:'wait',t:'i32'},
  {id:'w33',from:'stop',to:'cond',t:'bool'}]},
 sim:{period:100,init:()=>({bx:[],bz:[],off:0,r:3}),
  step(inp,st){st.r=(st.r*1103515245+12345)%2147483648;const rn=()=>{st.r=(st.r*1103515245+12345)%2147483648;return st.r/2147483648-0.5;};
   const th=((+inp.acc||0)+2.3)/D2R,sh=inp.shk?0.6:0.01;
   const x=Math.sin(th)+rn()*sh,z=Math.cos(th)+rn()*sh;
   st.bx.push(x);st.bz.push(z);if(st.bx.length>20){st.bx.shift();st.bz.shift();}
   const avg=a=>a.reduce((s,v)=>s+v,0)/a.length,mxv=avg(st.bx),mzv=avg(st.bz),rad=Math.atan2(mxv,mzv),raw=rad*D2R;
   const z0=!!inp.zero,off=z0?raw:st.off,ang=raw-off;st.off=off;
   const lt=ang<-5,gt=ang>5,mid=!(lt||gt),f=Math.abs(ang)>30;
   return {out:{ang,led:[lt,mid,mid,gt],fault:f},
    vals:{'acc.X-Axis':x,'acc.Z-Axis':z,k20:20,'mx.mean':mxv,'mz.mean':mzv,'atan.angle':rad,k57:57.2958,'mul.out':raw,'so.L':st.off,zero:z0,'sel.out':off,'sub.out':ang,km5:-5,k5:5,'lt.out':lt,'gt.out':gt,'or.out':lt||gt,'not.out':mid,'abs.out':Math.abs(ang),k30:30,'g30.out':f,k0:0,kw:10,stop:!!inp.stop},
    stop:!!inp.stop,msg:`X ${x.toFixed(3)} g、Z ${z.toFixed(3)} g → 平均後 ${raw.toFixed(1)}°，減偏移量 ${off.toFixed(1)}° → ${ang.toFixed(1)}°${inp.shk?'（震動中：平均 20 筆還是會晃）':''}`};},
  doneMsg:'迴圈結束'}
};
addTo('M13',[
C.h3('LabVIEW','b','動手寫：水平儀'),
C.plan({start:'M02 範本的 Main.vi：它本來就有 Accelerometer Express VI，<b>這次留著</b>，把 Acceleration 圖刪掉就好。',
 in:'Accelerometer 的 <code>X-Axis</code>、<code>Z-Axis</code>：DBL，單位 g（不是 m/s²）。平放時 Z 約 1、X 約 0。',
 calc:'① 平均：每一軸各接一個 Mean PtByPt.vi（最近 20 筆的平均；它自己記住前面的資料，不用自己做 Shift Register）。② 角度：Inverse Tangent (2 Input)，<b>y 接 X、x 接 Z</b>（atan2(X, Z)），輸出是弧度，乘 180/π ≈ 57.2958 變成度。③ 歸零：偏移量放 Shift Register，按「歸零」那一圈用 Select 換成目前角度；角度 − 偏移量。④ 判斷：< −5° 左、> 5° 右、其他算水平；|角度| > 30° 故障。',
 out:'「角度 °」顯示一位小數；LED0（左）、LED1＋LED2（水平）、LED3（右）；前面板一顆紅燈「傾斜超過 30°」。',
 loop:'10 ms 一圈，平均 20 筆 ≈ 最近 0.2 秒。',
 end:'Stop 結束；Close 格 Reset myRIO.vi。要讓偏移量斷電後還在，按歸零時寫檔（M10）。'}),
{steps:{title:'M13：加速度 → 平均 → 角度 → 歸零 → 判斷',lv:m13,steps:[
 {t:'留下 Accelerometer，先看數字',view:'split',add:['wl','acc','shk','kw','wait','w32','stop','cond','w33'],h:`<p>打開範本 Main.vi（myRIO 底下），刪掉 Acceleration 圖和它前面的 Build Array，Accelerometer 留著。</p><p>先在 X-Axis、Z-Axis 上各 Create ▸ Indicator，Run，平放、往右傾、往左傾看數字怎麼變：<b>往右傾 X 是變大還是變小？</b>對完了再把這兩個 Indicator 刪掉繼續。</p>`},
 {t:'各平均最近 20 筆',view:'bd',add:['k20','mx','mz','w1','w2','w3','w4'],h:`<p>${fn('Signal Processing','Point By Point','Probability & Statistics PtByPt','Mean PtByPt.vi')} ${qd('Mean PtByPt')} 放兩個。<code>sample length</code> 接常數 20（I32）。</p><p>PtByPt（Point By Point）的意思是「一次給一個點」：它在裡面記住最近 20 筆，每一圈吐出平均。M05 說的「平均的代價」在這裡就是：角度要過大約 0.2 秒才完全跟上。</p>`},
 {t:'atan2，弧度變度',view:'bd',add:['atan','w5','w6','k57','mul','w7','w8'],h:`<p>${fn('Mathematics','Elementary & Special Functions','Trigonometric Functions','Inverse Tangent (2 Input)')} ${qd('Inverse Tangent (2 Input)')}：<b>上面 y 接 X 的平均、下面 x 接 Z 的平均</b>。接反了，平放會讀到 90°。</p><p>輸出是弧度，Multiply 乘常數 57.2958（在常數上按右鍵 ▸ Visible Items ▸ Label，寫上 180/π，別人才看得懂這個數字）。</p>`},
 {t:'歸零：偏移量放 Shift Register',view:'split',add:['sub','w9','k0','w10','so','zero','sel','w11','w12','w13','w14','w15','ang','w16'],h:`<p>前面板放一個按鈕「歸零」（機械動作 Latch When Released）。加一個 Shift Register，初始值 0。</p>${wt([['算出來的角度','Select 的 t','按歸零：偏移量＝現在的角度'],['歸零按鈕','Select 的 s'],['左邊 Shift Register','Select 的 f','沒按：保持原來的偏移量'],['Select','右邊 Shift Register、Subtract 的 y'],['算出來的角度','Subtract 的 x','角度 − 偏移量']])}`},
 {t:'判斷左右和故障，點燈',view:'bd',add:['km5','lt','k5','gt','or','not','led','w17','w18','w19','w20','w21','w22','w23','w24','w25','w26','w27','abs','k30','g30','fault','w28','w29','w30','w31'],h:`<p>Less?（< −5）→ LED0；Greater?（> 5）→ LED3；兩個都不是（Or 再 Not）→ LED1、LED2。</p><p>Absolute Value → Greater? 30 → 前面板紅燈。為什麼用絕對值：往左、往右超過 30° 都算故障，一個比較就夠了。</p>`},
 {t:'Run：傾斜、震動、歸零',view:'split',add:[],h:`<p>Run。注意一開始就讀到 2.3° 左右（網頁假設機台本身有點斜），按「歸零」變成 0。改傾斜角度看燈；打開「震動」看角度晃，再想想平均 20 筆夠不夠。</p>`}
]}},
ask('把 Mean PtByPt 的 sample length 從 20 改成 200，傾斜判斷會變怎樣？',
 `<p>晃動幾乎看不到了，可是要過大約 2 秒（200 × 10 ms）角度才跟上。真的倒下去 2 秒後才停機，太慢。數字怎麼選，回到 M05 那一句：<b>你要量的東西多快會變、你能接受多慢的反應</b>。</p>`)
]);

/* ============================== M14 ============================== */
const m14={name:'Main.vi（M14：PID）',view:'split',ratio:2.2,
 fp:{w:300,h:330,items:[
  {id:'tgt',k:'num',ctl:true,label:'目標角度 °',x:16,y:24,w:70,v:90,inc:10},
  {id:'kp',k:'num',ctl:true,label:'Kp',x:110,y:24,w:60,v:2,inc:0.5,dig:1},
  {id:'ki',k:'num',ctl:true,label:'Ki',x:190,y:24,w:60,v:3,inc:0.5,dig:1},
  {id:'kd',k:'num',ctl:true,label:'Kd',x:16,y:84,w:60,v:0.1,inc:0.05,dig:2},
  {id:'ang',k:'num',label:'角度 °',x:110,y:84,w:60,dig:1},
  {id:'out',k:'num',label:'輸出 %',x:190,y:84,w:60,dig:1},
  {id:'chart',k:'chart',label:'角度圖（0～120°）',x:16,y:140,w:260,h:80,min:0,max:120},
  {id:'load',k:'btn',mech:'switch',label:'（模擬）有人一直往回推',showLabel:true,text:'負載 開／關',x:16,y:250},
  {id:'stop',k:'btn',label:'stop',text:'STOP',stop:true,x:200,y:262}]},
 bd:{w:790,h:360,structs:[{id:'wl',k:'while',x:60,y:20,w:710,h:320,name:'Main Loop（10 ms 一圈，dt＝0.01 s）'}],
  nodes:[
  {id:'angs',k:'sub',name:'角度（M07 那一段）',top:'M07',color:'#6d4c41',icon:['ENC→°'],ins:[],outs:['角度'],x:90,y:50,w:56,h:40,tip:'M07 的 Encoder → ÷ 一圈計數 × 360。可以選起來 Edit ▸ Create SubVI 包成一個 SubVI。'},
  {id:'tgt',k:'ctl',t:'dbl',label:'目標角度 °',x:90,y:120},
  {id:'err',k:'fn',fn:'Subtract',x:190,y:90},
  {id:'ang',k:'ind',t:'dbl',label:'角度 °',x:175,y:190},
  {id:'kp',k:'ctl',t:'dbl',label:'Kp',x:215,y:52},
  {id:'mp',k:'fn',fn:'Multiply',x:270,y:40},
  {id:'ki',k:'ctl',t:'dbl',label:'Ki',x:215,y:140},
  {id:'mi',k:'fn',fn:'Multiply',x:270,y:105},
  {id:'kdt',k:'const',t:'dbl',v:0.01,x:230,y:175,label:'dt'},
  {id:'mi2',k:'fn',fn:'Multiply',x:320,y:112},
  {id:'k0',k:'const',t:'dbl',v:0,x:25,y:221},
  {id:'si',k:'sr',t:'dbl',s:'wl',y:230},
  {id:'addI',k:'fn',fn:'Add',x:380,y:120},
  {id:'kIhi',k:'const',t:'dbl',v:50,x:395,y:85},
  {id:'kIlo',k:'const',t:'dbl',v:-50,x:388,y:165},
  {id:'coI',k:'fn',fn:'In Range and Coerce',x:430,y:115},
  {id:'k0b',k:'const',t:'dbl',v:0,x:25,y:291},
  {id:'sd',k:'sr',t:'dbl',s:'wl',y:300},
  {id:'dsub',k:'fn',fn:'Subtract',x:190,y:260},
  {id:'kdt2',k:'const',t:'dbl',v:0.01,x:200,y:232,label:'dt'},
  {id:'dd',k:'fn',fn:'Divide',x:250,y:260},
  {id:'kd',k:'ctl',t:'dbl',label:'Kd',x:290,y:225},
  {id:'md',k:'fn',fn:'Multiply',x:330,y:262},
  {id:'addPI',k:'fn',fn:'Add',x:520,y:60},
  {id:'subD',k:'fn',fn:'Subtract',x:580,y:67},
  {id:'kOhi',k:'const',t:'dbl',v:100,x:600,y:30},
  {id:'kOlo',k:'const',t:'dbl',v:-100,x:592,y:120},
  {id:'coO',k:'fn',fn:'In Range and Coerce',x:640,y:70},
  {id:'out',k:'ind',t:'dbl',label:'輸出 %',x:700,y:40},
  {id:'outs',k:'sub',name:'輸出（M07 那一段）',top:'M07',color:'#6d4c41',icon:['%→PWM'],ins:['輸出 %'],outs:[],x:700,y:120,w:56,h:40,tip:'M07 的 Absolute Value ÷ 100 → PWM、≥ 0? → AIN1／AIN2。'},
  {id:'kw',k:'const',t:'i32',v:10,x:420,y:237},
  {id:'wait',k:'fn',fn:'Wait (ms)',x:460,y:230},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:690,y:308},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w1',from:'tgt',to:'err.x',t:'dbl',mx:170},
  {id:'w2',from:'angs.角度',to:'err.y',t:'dbl',mx:155},
  {id:'w3',from:'angs.角度',to:'ang',t:'dbl',mx:155},
  {id:'w4',from:'err.out',to:'mp.x',t:'dbl',mx:245},
  {id:'w5',from:'kp',to:'mp.y',t:'dbl',mx:260},
  {id:'w6',from:'err.out',to:'mi.x',t:'dbl',mx:245},
  {id:'w7',from:'ki',to:'mi.y',t:'dbl',mx:260},
  {id:'w8',from:'mi.out',to:'mi2.x',t:'dbl'},
  {id:'w9',from:'kdt',to:'mi2.y',t:'dbl',mx:300},
  {id:'w10',from:'k0',to:'si.init',t:'dbl'},
  {id:'w11',from:'mi2.out',to:'addI.x',t:'dbl',mx:365},
  {id:'w12',from:'si.L',to:'addI.y',t:'dbl',mx:360},
  {id:'w13',from:'addI.out',to:'coI.x',t:'dbl',mx:420},
  {id:'w14',from:'kIhi',to:'coI.upper limit',t:'dbl',mx:425},
  {id:'w15',from:'kIlo',to:'coI.lower limit',t:'dbl',mx:426},
  {id:'w16',from:'coI.coerced(x)',to:'si.R',t:'dbl',pts:[[480,130.7],[480,215],[750,215],[750,230]]},
  {id:'w17',from:'k0b',to:'sd.init',t:'dbl'},
  {id:'w18',from:'angs.角度',to:'dsub.x',t:'dbl',mx:155},
  {id:'w19',from:'sd.L',to:'dsub.y',t:'dbl',pts:[[100,300],[100,281]]},
  {id:'w20',from:'angs.角度',to:'sd.R',t:'dbl',pts:[[155,70],[155,300]]},
  {id:'w21',from:'dsub.out',to:'dd.x',t:'dbl',mx:235},
  {id:'w22',from:'kdt2',to:'dd.y',t:'dbl',mx:244},
  {id:'w23',from:'dd.out',to:'md.x',t:'dbl',mx:300},
  {id:'w24',from:'kd',to:'md.y',t:'dbl',mx:322},
  {id:'w25',from:'mp.out',to:'addPI.x',t:'dbl',mx:505},
  {id:'w26',from:'coI.coerced(x)',to:'addPI.y',t:'dbl',mx:490},
  {id:'w27',from:'addPI.out',to:'subD.x',t:'dbl'},
  {id:'w28',from:'md.out',to:'subD.y',t:'dbl',mx:565},
  {id:'w29',from:'subD.out',to:'coO.x',t:'dbl',mx:625},
  {id:'w30',from:'kOhi',to:'coO.upper limit',t:'dbl',mx:635},
  {id:'w31',from:'kOlo',to:'coO.lower limit',t:'dbl',mx:636},
  {id:'w32',from:'coO.coerced(x)',to:'out',t:'dbl',mx:690},
  {id:'w33',from:'coO.coerced(x)',to:'outs.輸出 %',t:'dbl',mx:690},
  {id:'w34',from:'kw',to:'wait',t:'i32'},
  {id:'w35',from:'stop',to:'cond',t:'bool'}]},
 sim:{period:100,init:()=>({x:0,v:0,I:0,prev:0,hist:[]}),
  step(inp,st){const kp=+inp.kp||0,ki=+inp.ki||0,kd=+inp.kd||0,tg=+inp.tgt||0,load=inp.load?30:0,dt=0.01;let e=0,P=0,Dd=0,D=0,u=0,raw=0,mi=0,dsub=0;
   for(let k=0;k<10;k++){const a=st.x;e=tg-a;P=kp*e;mi=ki*e;st.I=Math.max(-50,Math.min(50,st.I+mi*dt));dsub=a-st.prev;Dd=dsub/dt;D=kd*Dd;st.prev=a;raw=P+st.I-D;u=Math.max(-100,Math.min(100,raw));
    let f=u-load;f=Math.abs(f)<8?0:f-Math.sign(f)*8;st.v+=(f*9-st.v*4)*dt;st.x+=st.v*dt;}
   st.hist.push(st.x);if(st.hist.length>130)st.hist.shift();
   return {out:{ang:st.x,out:u,chart:st.hist.slice()},
    vals:{'angs.角度':st.x,tgt:tg,'err.out':e,kp,'mp.out':P,ki,'mi.out':mi,kdt:dt,'mi2.out':mi*dt,'si.L':st.I,'addI.out':st.I,'coI.coerced(x)':st.I,kIhi:50,kIlo:-50,'sd.L':st.prev,'dsub.out':dsub,kdt2:dt,'dd.out':Dd,kd,'md.out':D,'addPI.out':P+st.I,'subD.out':raw,kOhi:100,kOlo:-100,'coO.coerced(x)':u,k0:0,k0b:0,kw:10,stop:!!inp.stop},
    stop:!!inp.stop,msg:`角度 ${st.x.toFixed(1)}°：P ${P.toFixed(1)}＋I ${st.I.toFixed(1)}−D ${D.toFixed(1)} ＝ ${u.toFixed(1)} %${load?'（負載 30 % 往回推）':''}`};},
  doneMsg:'迴圈結束。Close 格：duty＝0、STBY＝FALSE，再 Reset myRIO.vi。'}
};
addTo('M14',[
C.h3('LabVIEW','b','動手寫：把 M07 的 P 改成 PID'),
C.plan({start:'M07 寫好的 Main.vi，<b>另存一份</b>（File ▸ Save As ▸ Copy）再改。只換掉中間「誤差 × Kp」那一段，前面的 Encoder → 角度、後面的 duty 和方向都不動。',
 in:'角度（M07 算好的 DBL，度）；前面板四個控制元件：目標角度、Kp、Ki、Kd（都是 DBL）。',
 calc:'P ＝ Kp × 誤差。I：積分 ＝ 上一圈的積分 ＋ Ki × 誤差 × dt，限制在 ±50（防積分飽和），積分放 <b>Shift Register</b>。D ＝ Kd × (角度 − 上一圈角度) ÷ dt，<b>對角度微分</b>，上一圈角度放第二個 Shift Register。輸出 ＝ P ＋ I − D，限制 ±100。dt ＝ 0.01 s，跟迴圈週期一致。',
 out:'「輸出 %」和角度圖。除錯時可以把 P、I、D 三個值各接一個 Indicator，看是誰在出力。',
 loop:'10 ms 一圈，dt 寫成常數 0.01。週期不穩，I 和 D 就算錯：正式版用 M09 的 Timed Loop。',
 end:'跟 M07 一樣：Close 格先 duty＝0、STBY＝FALSE，再 Reset myRIO.vi。'}),
{steps:{title:'M14：P → 加 I（含上限）→ 加 D',lv:m14,steps:[
 {t:'保留 M07 的頭尾',view:'split',add:['wl','angs','outs','tgt','err','w1','w2','ang','w3','kw','wait','w34','stop','cond','w35'],h:`<p>咖啡色的兩個方塊代表 M07 已經寫好、這一課不動的部分。實際上它們還是 M07 那幾個函式；要讓圖乾淨，可以選起來 <b>Edit ▸ Create SubVI</b> 包成 SubVI（第 10 課）。</p><p>誤差 ＝ 目標 − 角度：Subtract 上面接目標。</p>`},
 {t:'P：跟 M07 一樣',view:'bd',add:['kp','mp','w4','w5'],h:`<p>Multiply：誤差 × Kp。</p>`},
 {t:'I：累加，放 Shift Register',view:'bd',add:['ki','mi','w6','w7','kdt','mi2','w8','w9','k0','w10','si','addI','w11','w12','kIhi','kIlo','coI','w13','w14','w15','w16'],h:`<p>加一個 Shift Register（初始值 0）存「積分到現在的值」。</p>${wt([['誤差 × Ki × dt','Add 的 x','這一圈要加的量'],['左邊 Shift Register','Add 的 y','上一圈累積的'],['Add','In Range and Coerce（±50）','防積分飽和'],['coerced(x)','右邊 Shift Register','下一圈接著加']])}<p>上限 50 是說「光靠積分最多出 50 % 的力」，負載越大這個數字要越大，實測調整。</p>`},
 {t:'D：對角度微分',view:'bd',add:['k0b','w17','sd','dsub','w18','w19','w20','kdt2','dd','w21','w22','kd','md','w23','w24'],h:`<p>第二個 Shift Register 存上一圈的角度。（角度 − 上一圈角度）÷ dt 是角速度（度／秒），× Kd。</p><p>想一想：第一圈「上一圈角度」是初始值 0，如果關節一開始停在 45°，D 第一圈會算出一個很大的值。改進：初始值接一個「迴圈開始前先讀一次的角度」。</p>`},
 {t:'加起來，限制，送出',view:'split',add:['addPI','w25','w26','subD','w27','w28','kOhi','kOlo','coO','w29','w30','w31','out','w32','w33'],h:`<p>Add（P＋I），再 Subtract 減掉 D（D 對角度微分，角度往目標衝得越快，就減越多，等於踩煞車）。In Range and Coerce ±100，接「輸出 %」和 M07 的輸出段。</p>`},
 {t:'Run：開負載、調參數',view:'split',add:[],h:`<p>Run。先把 Ki、Kd 改 0，打開「負載」：停在差一截的地方（只有 P）。再把 Ki 改回 3：慢慢補回 90°。Kd 改 0 和 0.3 比較超越量。每次改完按 STOP 再 Run，從 0° 重新開始。</p>`}
]}},
ask('把積分的上下限 ±50 拿掉（或改成 ±1000），目標從 0 跳到 90，角度圖會變怎樣？',
 `<p>一開始輸出早就頂到 100 %，積分卻還一直往上加。到 90° 附近時積分已經很大，繼續推：衝過頭很多，要等積分慢慢減回來。這就是積分飽和。<b>先預測，再到模擬裡把 Ki 調大看看</b>。</p>`)
]);

/* ============================== M03C ============================== */
const SEG=[[12,0,40,8],[52,8,8,40],[52,56,8,40],[12,96,40,8],[4,56,8,40],[4,8,8,40],[12,48,40,8]];
const CODES=[63,6,91,79,102,109,125,7,127,111];
const segItems=SEG.map((r,k)=>({k:'deco',x:200+r[0],y:24+r[1],w:r[2],h:r[3],r:3,border:'none',fill:s=>s.dout&&!s.dout[k]?'#4f8dff':'#d6dae0'}));
const m03c={name:'Main.vi（M3++：七段顯示器顯示 0～9）',view:'split',ratio:1.9,
 fp:{w:300,h:240,items:[
  {k:'deco',x:194,y:16,w:76,h:122,r:6,border:'none',fill:'#17191c'},...segItems,
  {k:'deco',x:262,y:120,w:8,h:8,r:4,border:'none',fill:s=>s.dout&&!s.dout[7]?'#4f8dff':'#d6dae0'},
  {k:'text',text:'（模擬）共陽七段',x:194,y:144,size:12},
  {id:'dig',k:'num',ctl:true,rep:'U8',label:'要顯示的數字',x:16,y:24,w:80,v:2},
  {id:'dout',k:'leds',label:'DIO0～7 寫出去的值',names:['a','b','c','d','e','f','g','dp'],cols:4,x:16,y:84},
  {id:'stop',k:'btn',label:'stop',text:'STOP',stop:true,x:16,y:180}]},
 bd:{w:700,h:260,structs:[{id:'wl',k:'while',x:40,y:20,w:640,h:220,name:'Main Loop'}],
  nodes:[
  {id:'dig',k:'ctl',t:'u8',label:'要顯示的數字',x:60,y:60},
  {id:'codes',k:'const',t:'u8[]',v:'63 6 91 79 102 109 125 7 127 111',w:200,x:60,y:150,label:'段碼表（a 是第 0 位）'},
  {id:'ia',k:'fn',fn:'Index Array',x:280,y:70},
  {id:'nba',k:'fn',fn:'Number To Boolean Array',x:340,y:70},
  {id:'not',k:'fn',fn:'Not',x:405,y:72},
  {id:'ia8',k:'fn',fn:'Index Array',ins:['array'],outs:['a','b','c','d','e','f','g','dp'],x:445,y:36,w:36,h:112},
  {id:'dout',...X('dout','Digital Output','DO',['A/DIO0','A/DIO1','A/DIO2','A/DIO3','A/DIO4','A/DIO5','A/DIO6','A/DIO7'],[],560,30)},
  {id:'kw',k:'const',t:'i32',v:50,x:300,y:187},
  {id:'wait',k:'fn',fn:'Wait (ms)',x:340,y:180},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:580,y:208},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w1',from:'codes',to:'ia.array',t:'u8[]',mx:268},
  {id:'w2',from:'dig',to:'ia.index',t:'u8',mx:200},
  {id:'w3',from:'ia.element',to:'nba',t:'u8'},
  {id:'w4',from:'nba.Boolean array',to:'not.x',t:'bool[]'},
  {id:'w5',from:'not.out',to:'ia8.array',t:'bool[]',mx:432},
  ...['a','b','c','d','e','f','g','dp'].map((s,k)=>({id:'d'+k,from:'ia8.'+s,to:'dout.A/DIO'+k,t:'bool',mx:500+k*6})),
  {id:'w6',from:'kw',to:'wait',t:'i32'},
  {id:'w7',from:'stop',to:'cond',t:'bool'}]},
 sim:{period:100,init:()=>({}),
  step(inp){const n=Math.round(+inp.dig||0),c=n>=0&&n<CODES.length?CODES[n]:0,bits=[0,1,2,3,4,5,6,7].map(k=>!!(c>>k&1)),out=bits.map(b=>!b);
   const v={dig:n,codes:'[63…111]','ia.element':c,'nba.Boolean array':bits.map(b=>b?'T':'F').join(''),'not.out':out.map(b=>b?'T':'F').join(''),kw:50,stop:!!inp.stop};
   ['a','b','c','d','e','f','g','dp'].forEach((s,k)=>v['ia8.'+s]=out[k]);
   return {out:{dout:out},vals:v,stop:!!inp.stop,msg:n>=CODES.length?`輸入 ${n}：超出段碼表，Index Array 給預設值 0 → 全部 TRUE → 全滅`:`數字 ${n} → 段碼 ${c} → 亮的段寫 FALSE（共陽）`};},
  doneMsg:'迴圈結束。Close 格的 Reset myRIO.vi 之後，DIO 回到預設（輸入），共陽的段全部不亮。'}
};
(function(){const l=L.find(x=>x.id==='M03C');if(!l)return;const i=l.body.findIndex(b=>typeof b==='string'&&b.includes('再一個 <b>Index Array</b>'));if(i<0)return;l.body.splice(i,1,
C.plan({start:'M02 的專案 ▸ myRIO 底下的 Main.vi，Main Loop 裡。',
 in:'前面板一個 Numeric Control「要顯示的數字」，表示法改 <b>U8</b>（在控制元件上按右鍵 ▸ Representation ▸ U8），Data Range 設 0～9。',
 calc:'① 查表：段碼表是 10 個 U8 的陣列常數，Index Array 用數字當索引取出一個段碼。② 拆成位元：Number To Boolean Array，第 0 個是 a 段。③ 共陽要反相：Not（整個陣列一次反）。④ 拆成 8 個：Index Array 往下拉成 8 個輸出。',
 out:'Digital Output Express VI 勾 A/DIO0～A/DIO7 八個通道，一條線一段。',
 loop:'數字是人在改的，50 ms 一圈就夠了。',
 end:'Stop 結束；Reset myRIO.vi 之後 DIO 變回輸入，共陽的段不亮。'}),
{steps:{title:'M3++：數字 → 段碼 → 8 個 DIO',lv:m03c,steps:[
 {t:'控制元件和段碼表',view:'split',add:['wl','dig','codes','kw','wait','w6','stop','cond','w7'],h:`<p>前面板放 Numeric Control「要顯示的數字」，改成 U8。</p><p>方塊圖放 ${fn('Programming','Array','Array Constant')}，裡面拖一個 Numeric Constant 進去、改成 U8，再往右拉成 10 格，依序輸入 63、6、91、79、102、109、125、7、127、111（上面的段碼表）。</p><p>想一想：這個陣列每一圈都一樣，放迴圈外面、用通道傳進來也可以。放裡面比較好讀，LabVIEW 也會自己最佳化。</p>`},
 {t:'Index Array 查表',view:'bd',add:['ia','w1','w2'],h:`<p>${fn('Programming','Array','Index Array')} ${qd('Index Array')}：上面 <code>array</code> 接段碼表，下面 <code>index</code> 接數字。輸出就是那個數字的段碼（一個 U8）。</p>`},
 {t:'變成 8 個布林，再反相',view:'bd',add:['nba','w3','not','w4'],h:`<p>${fn('Programming','Boolean','Number To Boolean Array')} ${qd('Number To Boolean Array')}：U8 → 8 個布林的陣列，<b>第 0 個是最低位</b>，剛好是 a 段。</p><p>共陽：段要亮，那支腳要寫 FALSE。Not 可以直接接布林陣列，整排一次反相。共陰的顯示器就把 Not 拿掉。</p>`},
 {t:'拆成 8 個，接 Digital Output',view:'split',add:['ia8','w5','dout',...[0,1,2,3,4,5,6,7].map(k=>'d'+k)],h:`<p>再放一個 Index Array，接上陣列之後把它的<b>下緣往下拉</b>，拉出 8 個輸出：沒接 index 的時候，它依序給第 0、1、2…7 個元素。</p><p>放 ${C.pal('Functions','myRIO','Digital Output')} ${qd('Digital Output')}，設定視窗按 <b>+</b> 加到 8 個通道：A/DIO0～A/DIO7。一條一條接，a 接 DIO0、dp 接 DIO7，跟上面的接線表一樣。</p>`},
 {t:'Run：改數字',view:'split',add:[],h:`<p>Run，改「要顯示的數字」。看左邊 DIO0～7 的值：亮的段是 FALSE。輸入 12 試試。</p>`}
]}});})();
})();
