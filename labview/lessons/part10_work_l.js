/* 實務案例 W15：特性曲線自動量測。PM5 改版，RD 要效率曲線和負載調整率的報告。
   職缺對照（docs/job_research.md 第 B 組）：用程式控制儀器自動跑完量測流程、自動抓特性曲線、量測結果自動存檔並畫圖、產出量測報告（Y11、Y12、S06）。
   重點：量哪裡（四線）、等多久（熱穩定）、用什麼量（輕載時輸入電流的準確度）、怎麼掃（方向、暖機）、報告要寫什麼才能重現。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
if(!LV.F['Transpose 2D Array'])LV.F['Transpose 2D Array']={g:'⤡',ins:['2D array'],outs:['transposed array'],pal:['Functions','Programming','Array','Transpose 2D Array']};

/* ---- 模擬的 PM5 和量測台 ----
   板子：輸出 5.00 − 0.0125 × I；損耗 ＝ 0.30 ＋ 0.10 I ＋ Rc(T) I²，Rc 隨溫度上升。
   溫度：一階，時間常數 90 秒，平衡溫度 ＝ 25 ＋ 30 × 損耗。
   導線：電源到板子、板子到負載，來回各 0.05 Ω。 */
const RW=0.05,TAU=90;
const vdut=I=>5.00-0.0125*I;
const loss=(I,T)=>0.30+0.10*I+0.12*(1+0.006*(T-25))*I*I;
function eqT(I){let T=25;for(let k=0;k<40;k++)T=25+30*loss(I,T);return T;}
function truth(I){if(I<=0)return null;const po=vdut(I)*I;return po/(po+loss(I,eqT(I)))*100;}
function heat(T,I,s){for(let k=0;k<s;k++){const te=25+30*loss(I,T);T+=(te-T)*(1-Math.exp(-1/TAU));}return T;}
function rng(seed){let x=seed||1;return ()=>{x=(x*16807)%2147483647;return (x-1)/2147483646;};}
/* 量一點：回傳量到的 Vin、Iin、Vout、Iout 和算出來的效率 */
function meas(I,T,o,r){
  const po=vdut(I)*I,pin=po+loss(I,T);
  const Iin=(12-Math.sqrt(144-4*RW*pin))/(2*RW);          // 電源端子固定 12.000 V，板子吃到 12 − Iin × RW
  const n=()=>(r()-0.5)*2e-4;
  const Vout=(o.four?vdut(I):vdut(I)-I*RW)*(1+n());
  const Vin=(o.four?12-Iin*RW:12)*(1+n());
  let Ii=o.dmm?Iin*1.0003+0.0001:Iin*1.0015+0.004;          // 示意：DMM ±(0.03 %＋0.1 mA)；電源回讀 ±(0.15 %＋4 mA)，這裡用固定偏差
  Ii=o.dmm?Math.round(Ii*1e4)/1e4:Math.round(Ii*1e3)/1e3;
  const Io=I*(1+n());
  return {Vin,Iin:Ii,Vout,Iout:Io,eta:I>0?Vout*Io/(Vin*Ii)*100:null,pin};
}
/* 掃一次 */
function sweep(o){
  const r=rng(o.seed||7);let T=25,t=0;
  if(o.warm){T=heat(T,2,o.warm);t+=o.warm;}
  let pts=[];for(let k=0;k<=20;k++)pts.push(+(k*0.1).toFixed(1));
  if(o.dir==='down')pts.reverse();
  const res=[];
  pts.forEach(I=>{
    if(o.dwell==='auto'){                                     // 每 10 秒看一次輸入功率，連續三次差 < 0.05 % 才記錄，最多 10 分鐘
      let h=[],w=0;
      while(w<600){T=heat(T,I,10);w+=10;h.push(meas(I,T,{four:true,dmm:true},r).pin);if(h.length>=3){const a=h.slice(-3),mx=Math.max(...a),mn=Math.min(...a);if((mx-mn)/mx<0.0005)break;}}
      t+=w;
    }else{T=heat(T,I,o.dwell);t+=o.dwell;}
    t+=0.5;                                                    // 送命令、讀四個值
    res.push({I,...meas(I,T,o,r),T});
  });
  res.sort((a,b)=>a.I-b.I);
  return {res,t};
}
const KEY=[[0.2,'10 %'],[0.5,'25 %'],[1.0,'50 %'],[1.5,'75 %'],[2.0,'100 %']];
const mmss=s=>{s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+' 小時 ':'')+m+' 分 '+x+' 秒';};

function benchFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  const sel=(k,lab,opts,v)=>`<label style="display:inline-block;margin:2px 10px 2px 0">${lab} <select data-k="${k}">${opts.map(([a,b])=>`<option value="${a}"${a==v?' selected':''}>${b}</option>`).join('')}</select></label>`;
  el.innerHTML=`<div style="font-size:13px">
   ${sel('four','量電壓的位置',[['0','儀器的端子上（兩線）'],['1','板子的端子上（四線）']],'0')}
   ${sel('dmm','輸入電流用',[['0','電源供應器自己的讀值'],['1','DMM 串在輸入線上']],'0')}<br>
   ${sel('dwell','每一點等',[['1','1 秒'],['10','10 秒'],['60','1 分鐘'],['300','5 分鐘'],['auto','直到輸入功率穩定']],'1')}
   ${sel('warm','開始前',[['0','直接開始（板子是冷的）'],['1800','滿載暖機 30 分鐘']],'0')}
   ${sel('dir','掃描方向',[['up','輕載 → 滿載'],['down','滿載 → 輕載']],'up')}
   <button type="button" class="btn" data-k="run">開始掃描（0～2 A，每 0.1 A 一點）</button></div>
   <canvas data-o="cv" width="560" height="250" style="max-width:100%;background:#fff;border:1px solid #dde;margin-top:8px"></canvas>
   <div data-o="out" style="font-size:13px;overflow-x:auto"></div>`;
  const cv=el.querySelector('[data-o=cv]'),c=cv.getContext('2d');
  const g=k=>el.querySelector('[data-k='+k+']').value;
  function draw(R){
    const W=cv.width,H=cv.height,x0=46,y0=H-30,x1=W-12,y1=12,ymin=60,ymax=95;
    const X=I=>x0+(x1-x0)*I/2,Y=e=>y0-(y0-y1)*(e-ymin)/(ymax-ymin);
    c.clearRect(0,0,W,H);c.font='11px sans-serif';c.strokeStyle='#ddd';c.fillStyle='#555';
    for(let e=60;e<=95;e+=5){c.beginPath();c.moveTo(x0,Y(e));c.lineTo(x1,Y(e));c.stroke();c.fillText(e+'%',8,Y(e)+4);}
    for(let I=0;I<=2;I+=0.5){c.beginPath();c.moveTo(X(I),y0);c.lineTo(X(I),y1);c.stroke();c.fillText(I.toFixed(1)+' A',X(I)-12,y0+16);}
    c.save();c.beginPath();c.rect(x0,y1,x1-x0,y0-y1);c.clip();
    c.strokeStyle='#999';c.lineWidth=2;c.beginPath();
    for(let k=1;k<=200;k++){const I=k/100,e=truth(I);k===1?c.moveTo(X(I),Y(e)):c.lineTo(X(I),Y(e));}
    c.stroke();c.restore();c.lineWidth=1;c.fillStyle='#999';c.fillText('灰線：板子真正的效率（熱平衡、量在板子上）',x0+150,y0-8);
    if(!R)return;
    c.fillStyle='#2f6fd0';R.res.forEach(p=>{if(p.eta==null)return;c.beginPath();c.arc(X(p.I),Y(Math.max(ymin,Math.min(ymax,p.eta))),3.5,0,7);c.fill();});
    c.fillText('藍點：這次量到的',x0+150,y0-22);
  }
  el.querySelector('[data-k=run]').onclick=()=>{
    const o={four:g('four')==='1',dmm:g('dmm')==='1',dwell:g('dwell')==='auto'?'auto':+g('dwell'),warm:+g('warm'),dir:g('dir'),seed:Math.floor(Math.random()*1e6)+1};
    const R=sweep(o);draw(R);
    const at=I=>R.res.find(p=>Math.abs(p.I-I)<1e-6);
    const rows=KEY.map(([I,lab])=>{const p=at(I),tr=truth(I),d=p.eta-tr;return `<tr><td>${lab}（${I} A）</td><td>${p.eta.toFixed(2)}</td><td>${tr.toFixed(2)}</td><td style="color:${Math.abs(d)>=0.5?'#c0392b':'#1e7b34'}">${d>=0?'+':''}${d.toFixed(2)}</td></tr>`;}).join('');
    const avg=a=>a.reduce((s,x)=>s+x,0)/a.length,A4=[0.5,1.0,1.5,2.0];
    const am=avg(A4.map(I=>at(I).eta)),at4=avg(A4.map(truth));
    const v0=at(0).Vout,v2=at(2).Vout,lr=(v0-v2)/v0*100,lrt=(vdut(0)-vdut(2))/vdut(0)*100;
    el.querySelector('[data-o=out]').innerHTML=`<table class="tbl" style="margin-top:6px"><tr><th>負載</th><th>量到的效率 %</th><th>真正的 %</th><th>差</th></tr>${rows}
     <tr><td>25／50／75／100 % 平均（DOE 的平均效率算法）</td><td>${am.toFixed(2)}</td><td>${at4.toFixed(2)}</td><td style="color:${Math.abs(am-at4)>=0.5?'#c0392b':'#1e7b34'}">${am-at4>=0?'+':''}${(am-at4).toFixed(2)}</td></tr>
     <tr><td>負載調整率（0 A 和 2 A 的輸出電壓）</td><td>${lr.toFixed(2)} %</td><td>${lrt.toFixed(2)} %</td><td style="color:${lr>1.5?'#c0392b':'#1e7b34'}">${lr>1.5?'超過 1.5 % 的規格':'在規格內'}</td></tr></table>
     <p style="margin:4px 0">這次掃描花了 <b>${mmss(R.t)}</b>（21 點）。差 ≥ 0.5 個百分點標紅。</p>`;
  };
  draw(null);
}

/* ---- 一步一步寫：Sweep.vi ---- */
const sv={name:'Sweep.vi',view:'split',ratio:1.6,
 fp:{w:350,h:400,items:[
  {id:'dwell',k:'num',ctl:true,label:'每點等幾 ms',x:12,y:8,w:70,v:1000,inc:500},
  {id:'four',k:'enum',ctl:true,label:'量電壓的位置（模擬用）',options:['兩線：儀器端子','四線：板子端子'],x:150,y:8,v:1},
  {id:'chart',k:'chart',label:'效率 %（每一點一格，60～95 %）',x:12,y:70,w:320,h:100,min:60,max:95},
  {id:'tbl',k:'table',label:'數據',cols:['Iout A','Vout V','效率 %'],rows:10,x:12,y:196,w:320}]},
 bd:{w:1180,h:380,structs:[{id:'fl',k:'for',x:200,y:20,w:640,h:320}],
  nodes:[
  {id:'kN',k:'const',t:'i32',v:10,x:150,y:26},{id:'N',k:'N',s:'fl'},
  {id:'dwell',k:'ctl',t:'i32',label:'每點等幾 ms',x:20,y:180},
  {id:'tu1',k:'tunnel',t:'i32',s:'fl',side:'l',y:190},
  {id:'kerr',k:'const',t:'err',v:'no error',x:60,y:290},
  {id:'sr',k:'sr',t:'err',s:'fl',y:300},
  {id:'it',k:'iter',s:'fl'},
  {id:'inc',k:'fn',fn:'Increment',x:240,y:220},
  {id:'kst',k:'const',t:'dbl',v:0.2,x:250,y:270,label:'每點 A'},
  {id:'mul',k:'fn',fn:'Multiply',x:300,y:230},
  {id:'ls',k:'sub',name:'Load_Set.vi（CURR x，第一次加 INP ON）',icon:['LOAD','SET'],ins:['電流 A','error in'],outs:['error out'],x:360,y:120,w:56,h:44,color:'#5a6b7d'},
  {id:'st',k:'sub',name:'Settle.vi（W10 做過：等幾 ms，有 error 線）',icon:['WAIT','ms'],ins:['ms','error in'],outs:['error out'],x:450,y:140,w:56,h:44,color:'#5a6b7d'},
  {id:'ra',k:'sub',name:'Read_All.vi（兩台 DMM 和負載各讀一次）',icon:['READ','4 值'],ins:['error in'],outs:['Vin','Iin','Vout','Iout','error out'],x:540,y:110,w:60,h:90,color:'#5a6b7d'},
  {id:'m1',k:'fn',fn:'Multiply',x:640,y:60},
  {id:'m2',k:'fn',fn:'Multiply',x:640,y:130},
  {id:'dv',k:'fn',fn:'Divide',x:700,y:80},
  {id:'k100',k:'const',t:'dbl',v:100,x:700,y:150},
  {id:'m3',k:'fn',fn:'Multiply',x:760,y:90},
  {id:'tE',k:'tunnel',t:'dbl[]',s:'fl',side:'r',y:104,idx:true},
  {id:'tV',k:'tunnel',t:'dbl[]',s:'fl',side:'r',y:200,idx:true},
  {id:'tI',k:'tunnel',t:'dbl[]',s:'fl',side:'r',y:240,idx:true},
  {id:'chart',k:'ind',t:'dbl[]',label:'效率 %',x:1100,y:40},
  {id:'ba',k:'fn',fn:'Build Array',ins:['array 0','array 1','array 2'],x:900,y:190},
  {id:'tr',k:'fn',fn:'Transpose 2D Array',x:980,y:200},
  {id:'tbl',k:'ind',t:'dbl[][]',label:'數據',x:1060,y:204},
  {id:'lo',k:'sub',name:'Load_Off.vi（INP OFF：不管前面有沒有錯都要關）',icon:['LOAD','OFF'],ins:['error in'],outs:['error out'],x:900,y:290,w:56,h:44,color:'#5a6b7d'}],
  wires:[
  {id:'w0',from:'kN',to:'N',t:'i32'},
  {id:'w1',from:'dwell',to:'tu1.o',t:'i32'},
  {id:'w2',from:'kerr',to:'sr.init',t:'err'},
  {id:'w3',from:'it',to:'inc',t:'i32',mx:230},
  {id:'w4',from:'inc.out',to:'mul.x',t:'i32',mx:288},
  {id:'w5',from:'kst',to:'mul.y',t:'dbl',mx:290},
  {id:'w6',from:'mul.out',to:'ls.電流 A',t:'dbl',mx:345},
  {id:'w7',from:'sr.L',to:'ls.error in',t:'err',mx:340},
  {id:'w8',from:'tu1.i',to:'st.ms',t:'i32',mx:435},
  {id:'w9',from:'ls.error out',to:'st.error in',t:'err',mx:432},
  {id:'w10',from:'st.error out',to:'ra.error in',t:'err',mx:524},
  {id:'w11',from:'ra.Vout',to:'m1.x',t:'dbl',mx:620},
  {id:'w12',from:'ra.Iout',to:'m1.y',t:'dbl',mx:628},
  {id:'w13',from:'ra.Vin',to:'m2.x',t:'dbl',mx:612},
  {id:'w14',from:'ra.Iin',to:'m2.y',t:'dbl',mx:616},
  {id:'w15',from:'m1.out',to:'dv.x',t:'dbl'},
  {id:'w16',from:'m2.out',to:'dv.y',t:'dbl',mx:688},
  {id:'w17',from:'dv.out',to:'m3.x',t:'dbl'},
  {id:'w18',from:'k100',to:'m3.y',t:'dbl',mx:748},
  {id:'w19',from:'m3.out',to:'tE.i',t:'dbl'},
  {id:'w20',from:'ra.Vout',to:'tV.i',t:'dbl',mx:620},
  {id:'w21',from:'ra.Iout',to:'tI.i',t:'dbl',mx:628},
  {id:'w22',from:'ra.error out',to:'sr.R',t:'err',pts:[[606,192],[606,330],[830,330],[830,300]]},
  {id:'w23',from:'tE.o',to:'chart',t:'dbl[]',mx:1080},
  {id:'w24',from:'tI.o',to:'ba.array 0',t:'dbl[]',mx:870},
  {id:'w25',from:'tV.o',to:'ba.array 1',t:'dbl[]',mx:860},
  {id:'w26',from:'tE.o',to:'ba.array 2',t:'dbl[]',mx:880},
  {id:'w27',from:'ba.appended array',to:'tr',t:'dbl[][]'},
  {id:'w28',from:'tr.transposed array',to:'tbl',t:'dbl[][]'},
  {id:'w29',from:'sr.out',to:'lo.error in',t:'err',mx:880}]},
 sim:{init:()=>({}),
  step(inp){
   const ms=Math.max(0,+inp.dwell||0),four=+inp.four===1,r=rng(11);
   let T=25;const rows=[],eta=[];
   for(let i=0;i<10;i++){const I=+((i+1)*0.2).toFixed(1);T=heat(T,I,Math.round(ms/1000));const p=meas(I,T,{four,dmm:true},r);rows.push([I.toFixed(1),p.Vout.toFixed(4),p.eta.toFixed(2)]);eta.push(p.eta);}
   const d=eta[9]-truth(2);
   return {out:{chart:eta,tbl:rows},
    vals:{kN:10,kst:0.2,'mul.out':'0.2, 0.4 … 2.0','m3.out':'每一點的效率','tE.o':'[10 個效率]','tV.o':'[10 個 Vout]','tI.o':'[10 個 Iout]','tr.transposed array':'10 列 × 3 行'},
    msg:'滿載 2 A：量到 '+eta[9].toFixed(2)+' %，真正 '+truth(2).toFixed(2)+' %（差 '+(d>=0?'+':'')+d.toFixed(2)+'）。'+(four?'':'兩線量：輸出電壓少了導線上的壓降，效率偏低。')+(ms<60000?' 每點等不到 1 分鐘：板子還沒熱到平衡，滿載效率偏高。':'')};},
  doneMsg:'掃描完成：改等待時間或量測位置再 Run'}
};

L.push({id:'W15',order:30.995,no:'W15',part:PART,title:'特性曲線自動量測：效率曲線和負載調整率，量哪裡、等多久、用什麼量',mins:75,files:['練習\\實務\\Bench\\Sweep.vi'],
goals:[['學會','把「手動調負載、抄數字」變成程式；效率 ＝ 輸出功率 ÷ 輸入功率，四個值各從哪裡量；四線量測（量在板子的端子上）；每一點要等到熱穩定，怎麼判斷穩定；輕載時輸入電流的準確度決定效率準不準；掃描方向和暖機；報告要寫到別人能重做一次。'],['做出','在模擬量測台上看出四種錯誤各自讓曲線偏多少；Sweep.vi：For 迴圈掃 10 個負載點，自動索引收集數據，畫曲線、出表格，最後一定關負載。'],['為什麼是這個題目','儀器自動化的職缺常寫「把研發定好的量測步驟寫成程式、自動抓特性曲線」「量測結果自動存檔並畫圖」「依 datasheet 寫測試規格、產出量測報告」。和 W6 的產線測試不同：產線要快、要判 PASS／FAIL；特性量測要準、要能重現，一份報告常常要跑幾個小時。']],
check:'不看課文，能說出效率要量哪四個值、為什麼電壓要量在板子上、每一點為什麼要等、怎麼判斷等夠了、輕載效率為什麼最容易量錯，以及報告裡一定要寫的測試條件。',
body:[
C.h3('這一課的工作','x','研發實驗室裡的 LabVIEW'),
`<p>W6 是產線：一片 20 秒，判 PASS／FAIL。這一課是另一種常見的工作：<b>研發或品保要一份特性曲線</b>。不判對錯，而是要把產品在各種條件下的表現量出來、畫成圖、寫成報告交給客戶。職缺裡寫「實驗室自動化」「自動抓特性曲線」的，就是這種工作。</p>`,
C.h3('① 聽懂需求','','RD 工程師的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「PM5 改版了，換了一顆 MOSFET。客戶要新版的效率曲線和負載調整率，輸入 10.8、12、13.2 V 三種，負載 0 到 2 A。以前都是技術員手動調負載、抄電表，一份要一個下午，而且兩個人抄出來的曲線不一樣。你寫個程式自動跑。」</p></div>`,
ask('「兩個人抄出來的曲線不一樣」，可能是哪些原因？寫程式之前要先問清楚什麼？',
 `<p>同一片板子，曲線不一樣，代表<b>量法</b>不一樣。可能的差別：</p>
 <ul><li>電表夾在哪裡：夾在負載的端子上，還是板子的端子上？</li>
 <li>調好負載之後等多久才抄：馬上抄，還是等數字不跳了才抄？</li>
 <li>輸入電流看哪一台：電源供應器面板上的數字，還是另外串一台電表？</li>
 <li>從輕載往重載調，還是反過來？開始之前板子有沒有先熱機？</li>
 <li>室溫、板子有沒有裝在外殼裡、有沒有風扇。</li></ul>
 <p>所以要先問清楚：負載點有哪些、每一點的穩定條件、量測位置、要不要暖機、環境條件、報告格式、樣品數。<b>程式只是把一種量法固定下來</b>：量法本身沒定好，程式跑得再快也只是快速地量錯。</p>`),
C.h3('② 寫成規格','','量測條件表'),
C.table(['編號','規格'],[
 ['C1','輸入電壓 10.8、12.0、13.2 V（額定 12 V 的 ±10 %），每一種掃一次'],
 ['C2','負載 0～2 A，每 0.1 A 一點（21 點）；報告另外列出客戶指定的 10、25、50、75、100 % 這五點，和 25／50／75／100 % 的平均效率'],
 ['C3','效率 ＝（Vout × Iout）÷（Vin × Iin）× 100。Vin、Vout 都量在<b>板子的端子上</b>'],
 ['C4','開始前滿載暖機 30 分鐘；從滿載往輕載掃'],
 ['C5','每一點等到輸入功率穩定才記錄（判斷方法見 ④），每一點最多等 10 分鐘，超過就記「不穩定」'],
 ['C6','室溫 25 ± 5 °C，板子水平放置、不加風扇；室溫每一點都記下來'],
 ['C7','報告：曲線圖、數據表、測試條件、儀器型號序號和校正日期、原始數據檔'],
 ['C8','結束或出錯：先關負載、再關電源（和 W6 的 S6 一樣）'],
 ['C9','負載調整率 ＝（0 A 的 Vout − 2 A 的 Vout）÷ 0 A 的 Vout × 100，和 W6 的 T04 同一個定義']
]),
ask('C4 為什麼從滿載往輕載掃，而不是從輕載往重載？',
 `<p>板子的損耗會讓它變熱，熱了以後 MOSFET 和線圈的電阻變大、損耗又變大。滿載時溫度最高，最需要等。</p>
 <ul><li>先在滿載暖機 30 分鐘，板子已經在最熱的狀態，往輕載走是<b>慢慢降溫</b>，每一點要等的時間比較短。</li>
 <li>從冷的板子、從輕載開始往上，每一點都還沒熱到平衡，重載的效率會<b>偏高</b>（看起來比真的好）。</li></ul>
 <p>實務上不同公司、不同法規規定的順序不一樣（下面的模擬台可以兩種都試），重點是<b>固定一種、寫進報告</b>。</p>`),
note('負載點和暖機不是自己挑的','要看產品對應的規範。例如美國能源部（DOE）外部電源的測試方法（10 CFR 430 Appendix Z）：量 100、75、50、25 % 和無載，從高往低；開始前在 100 % 先跑至少 30 分鐘；每一點監看輸入功率 5 分鐘，沒有比最大值漂移超過 5 %（單一輸出）才算穩定、記錄那時候的值；「平均效率」是 25／50／75／100 % 四點的平均。電腦電源的 80 PLUS 則是 20、50、100 %（最高等級再加 10 %）。PM5 是板上的模組，不在這些法規範圍裡，所以 C1～C5 是照客戶的規格寫；有指定規範時，照規範寫，報告裡寫出依據。'),
C.h3('③ 盤點','','儀器和接線'),
C.table(['設備','量什麼','注意'],[
 ['可程式電源供應器','給板子 Vin','它面板上的電壓是<b>它自己端子</b>上的電壓，不是板子上的'],
 ['電子負載（定電流 CC 模式）','拉 Iout，讀回 Iout','負載的電流讀值通常夠準；電壓讀值同樣是它自己端子上的'],
 ['DMM ①','板子輸出端的 Vout','兩條細線<b>直接夾在板子的輸出端子上</b>'],
 ['DMM ②','板子輸入端的 Vin','同上，夾在板子的輸入端子上'],
 ['DMM ③（或電源的讀值）','Iin','串在輸入線上；輕載時電流小，準確度最要緊（④ 會看到）'],
 ['功率分析儀（有預算時）','一台同時量 Vin、Iin、Pin','交流輸入的電源（例如變壓器、充電器）一定要用它，因為交流的功率不是電壓 × 電流這麼簡單']
]),
`<p><b>四線量測</b>：大電流走粗線（電源 → 板子 → 負載），電壓用另外兩條細線直接量在板子的端子上。細線上幾乎沒有電流，所以沒有壓降；粗線上 2 A × 0.05 Ω ＝ 0.1 V 的壓降，就不會算進板子的輸出電壓裡。W6 的治具也是這樣接（DMM 用另外兩條細線）。</p><p>電源供應器和電子負載本身也常有 sense 端子（remote sense）：接上之後，電源會自己把輸出調高，補回導線的壓降，讓板子真的拿到 12.000 V。能補多少有上限，看規格書；sense 線正負接反可能損壞設備。</p><p>「量在哪裡」本身也是規格的一部分：DOE 的外部電源（例如筆電變壓器）規定在<b>輸出線的末端</b>量，因為那條線是產品的一部分，線上的損耗要算進去。PM5 沒有線，就量在板子的端子上。</p>`,
C.h3('④ 先在量測台上試','','四種量法，各錯多少'),
`<p>下面是一台模擬的量測台，板子是 PM5（輸入 12 V）。灰線是它<b>真正</b>的效率曲線；按「開始掃描」，藍點是你用這種量法量到的。先用預設值（全部是「抄表」的做法）跑一次，再一次只改一個選項，看哪一個影響哪一段曲線。</p>`,
{fn:benchFig},
ask('只改「量電壓的位置」，哪一段曲線變最多？為什麼？',
 `<p>重載。導線的壓降 ＝ 電流 × 電阻，2 A 時 Vout 少了 0.1 V（約 2 %），效率就少了約 2 個百分點；0.2 A 時只少 0.01 V，幾乎看不出來。</p>
 <p>負載調整率更明顯：兩線量時，0 A 和 2 A 差了 0.125 V，算出來 2.5 %，<b>超過 1.5 % 的規格</b>。（負載調整率的分母各家寫法不同，有的除以無載電壓、有的除以滿載電壓，照規格書；這裡和 W6 一樣除以無載電壓。）板子沒有問題，是量法讓它看起來不合格。客戶拿到這份報告，第一個問題就是「你們的板子不合規格？」</p>`),
ask('只改「輸入電流用」，哪一段變最多？為什麼？',
 `<p>輕載。0.2 A 輸出時，輸入電流只有 0.11 A 左右；電源供應器的電流讀值如果有幾 mA 的誤差，就是好幾 % 的誤差，效率跟著差好幾個百分點。滿載時輸入電流約 0.9 A，同樣幾 mA 只佔不到 1 %。</p>
 <p>規格書上的準確度通常寫成「±（讀值的 % ＋ 幾個字）」，那個固定的「＋ 幾個字」在小電流時最吃虧。<b>量之前先算</b>：最小的那一點，儀器的誤差換算成效率是多少？不夠準就換一台、換小一點的檔位，或用分流電阻。（模擬裡的誤差是示意，實際數字看你那台儀器的規格書。）</p>`),
ask('「每一點等 1 秒、直接開始、輕載 → 滿載」和「暖機 30 分鐘、滿載 → 輕載、等到穩定」差在哪裡？各要花多少時間？',
 `<p>前者很快（大約半分鐘），但板子一直是冷的，重載的效率偏高半個百分點以上。後者大約 40 分鐘（其中 30 分鐘是暖機），每一點都在熱平衡。固定每點等 5 分鐘也很準，但要將近兩個小時。</p>
 <p>「等到穩定」比「固定等 5 分鐘」好：已經穩定的點不用白等，還沒穩定的點會多等一下。這就是為什麼 C5 寫「等到輸入功率穩定」：模擬裡的判斷是每 10 秒讀一次輸入功率，<b>最近三次的最大和最小差不到 0.05 %</b> 才記錄。這個門檻要配合儀器的雜訊來定：門檻比雜訊還小，就永遠等不到。</p>`),
note('兩種「穩定」','電子負載切換電流之後，輸出電壓幾毫秒就穩了（W8 的「負載切換後回穩」，要看的是「進入誤差帶而且留在帶內」），但溫度要幾分鐘到幾十分鐘。特性量測要等的是後者。DOE 的寫法是每一點看 5 分鐘、漂移不超過 5 %；模擬台的「最近三次差不到 0.05 %」是這一課自己訂的、比較嚴的門檻。門檻怎麼訂，看你要的準確度和儀器的雜訊。'),
C.h3('⑤ 寫程式','','Sweep.vi'),
`<p>結構很簡單：For 迴圈跑 10 次，每一次設負載 → 等 → 讀四個值 → 算效率。迴圈右邊的通道開<b>自動索引</b>，10 個值自己收集成陣列，迴圈結束後一次畫圖、出表格。</p>`,
{steps:{title:'Sweep.vi：10 個負載點，一點一點量',lv:sv,steps:[
 {t:'For 迴圈和負載點',view:'split',add:['dwell','fl','kN','N','w0','it','inc','w3','kst','mul','w4','w5'],h:`<p>N ＝ 10。第 i 圈的負載 ＝（i ＋ 1）× 0.2 A：0.2、0.4 … 2.0 A。i 從 0 開始，所以要先 +1。</p><p>真正的程式會把負載點放在設定檔裡（和 W6 的 limits.csv 一樣），用自動索引的輸入通道一個一個拿出來；這裡為了好讀，直接算。</p>`},
 {t:'設負載 → 等 → 讀',view:'split',add:['tu1','w1','kerr','sr','w2','ls','w6','w7','st','w8','w9','ra','w10','w22'],h:`<p>三個 SubVI 用錯誤線串起來，所以一定是「設好 → 等 → 讀」的順序。錯誤線還接到 Shift Register：某一點出錯，後面幾圈的 SubVI 收到錯誤就不做事（SubVI 裡的 Case 結構），不會在儀器出錯時繼續亂設負載。</p><p>Load_Set.vi 第一次送 <code>INP ON</code>，要在電源 <code>OUTP ON</code>、板子輸出已經建立之後。定電流（CC）模式的負載一打開就要全部的電流，板子還在啟動時被拉住，有些電源會啟動不了；所以順序是先開電源、等一下、再開負載。</p><p>Read_All.vi 裡面就是 W6、I13 做過的事：對兩台 DMM 和負載各送一次 <code>MEAS</code> 類的查詢，Scan From String 變成數字。</p>`},
 {t:'算效率，自動索引收集',view:'split',add:['m1','w11','w12','m2','w13','w14','dv','w15','w16','k100','m3','w17','w18','tE','w19','tV','w20','tI','w21'],h:`<p>Pout ＝ Vout × Iout，Pin ＝ Vin × Iin，效率 ＝ Pout ÷ Pin × 100。三個右邊通道都是自動索引（方框裡有 [ ]）：每一圈放一個值進去，迴圈結束時變成 10 個值的陣列。</p>`},
 {t:'畫圖、出表格、關負載',view:'split',add:['chart','w23','ba','w24','w25','w26','tr','w27','tbl','w28','lo','w29','four'],h:`<p>效率陣列直接接 Waveform Graph。表格：Build Array 把三個 1D 陣列疊成 3 列 × 10 行的 2D 陣列，Transpose 2D Array 轉成 10 列 × 3 行（一列一個負載點），接到表格。</p><p>最後的 Load_Off.vi：迴圈不管怎麼結束（跑完或出錯），都要關負載（C8）。它裡面<b>不看 error in</b>，有錯也照樣關，再把錯誤傳出去。</p><p>這張圖的 X 軸是「第幾點」，不是電流。要用電流當 X 軸，改用 XY Graph：把 Iout 陣列和效率陣列 Bundle 起來接上去。</p>`},
 {t:'Run：等待時間和量測位置',view:'split',add:[],h:`<p>先用 1000 ms、四線跑一次，看訊息：滿載效率比真正的高一點（板子還沒熱）。改成 120000 ms（2 分鐘）再跑：差距變小。再把量測位置改成兩線：整條曲線往下掉，重載掉最多。</p><p>真的跑起來，等待時間也是真的：10 點 × 2 分鐘 ＝ 20 分鐘。所以 ④ 的「等到穩定」比較好。</p>`}
]}},
ask('三種輸入電壓都要掃，程式要怎麼改？',
 `<p>外面再包一層 For 迴圈，跑 3 次，每次先設電源的電壓（10.8、12.0、13.2），再跑裡面那一層。兩層的自動索引會收集成 2D 陣列：3 列（輸入電壓）× 21 行（負載點），直接接 Waveform Graph 就是三條曲線（每一列一條）。</p>
 <p>順便多一個結果：同一個負載下，三種輸入電壓的輸出電壓差多少，就是<b>電源調整率</b>（line regulation）。數據已經有了，不用另外量。</p>`),
C.h3('⑥ 出報告','','別人要能照著重做一次'),
`<p>報告不只是一張圖。半年後客戶說「你們新版的效率比較差」，你要能拿出當時的條件，證明是同一種量法量出來的。</p>`,
C.table(['欄位','內容','為什麼'],[
 ['樣品','型號、版本、序號、樣品數','改版前後要能對得上'],
 ['測試條件','C1～C6 全部：輸入電壓、負載點、暖機、掃描方向、穩定條件、室溫','條件不同，曲線就不能比'],
 ['接線','四線，量在板子的端子上（附一張照片）','兩線和四線差 2 個百分點'],
 ['儀器','每一台的型號、序號、<b>校正到期日</b>','過期的儀器量出來的數字，品保不會收'],
 ['結果','曲線圖、五個重點負載的數據表、負載調整率、電源調整率','客戶最常看的就是這幾個數字'],
 ['原始數據','CSV 檔名和存放位置；程式版本','有疑問時可以回頭查，不用重量']
]),
`<p>產生報告的方法：最簡單的是把數據存成 CSV（F1、W6 做過），再用事先做好的 Excel 樣板開起來畫圖。LabVIEW 也有 Report Generation 的 VI 可以直接產生報告（有些格式要另外裝 Report Generation Toolkit，先確認你的版本有什麼）。不管用哪一種，<b>測試條件和儀器資訊要由程式自動寫進去</b>，不要靠人事後補，人會忘。</p>`,
tip('程式本身也要能重現','把負載點、等待條件、輸入電壓都放在設定檔裡，報告寫出用的是哪一個設定檔。下一次改版，用同一個設定檔再跑一次，兩份報告就可以直接比。'),
note('這一課用到的前面的東西','I13、I14 的儀器控制和「寫入後讀回確認」，W6 的效率公式和「先關負載再關電源」，W8 的「負載切換後回穩」，W10 的 Settle.vi，F1 的 CSV。特性量測和產線測試用的是同一套東西，差別是要準、要能重現，而不是要快。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'效率要量哪四個值？',o:['Vin、Iin、Vout、Iout','Vin、Vout','Iin、Iout','Pout、溫度'],a:0,ex:'Pout ÷ Pin，兩邊各要電壓和電流。'},
 {q:'電壓用兩線量在負載的端子上，結果會？',o:['Vout 少了導線壓降，重載時效率偏低','完全一樣','輕載時偏低最多','效率偏高'],a:0,ex:'壓降 ＝ 電流 × 導線電阻，重載最大。'},
 {q:'輕載效率最容易量錯，主要是因為？',o:['輸入電流小，電流量測的固定誤差佔比變大','輕載時電壓不穩','負載不準','板子太熱'],a:0,ex:'「＋ 幾個字」的誤差在小電流時最吃虧。'},
 {q:'冷的板子從輕載快速掃到重載，重載的效率會？',o:['偏高，因為板子還沒熱到平衡','偏低','不變','無法量'],a:0,ex:'熱了以後電阻變大、損耗變大。'},
 {q:'「等到輸入功率穩定」比「每一點固定等 5 分鐘」好在哪裡？',o:['已經穩定的點不用白等，沒穩定的點會多等','比較簡單','比較快而且一定比較準','不用寫程式'],a:0,ex:'而且要設最長等待時間。'},
 {q:'Sweep.vi 右邊的通道為什麼要開自動索引？',o:['每一圈的值自動收集成陣列','讓迴圈跑比較快','LabVIEW 規定','避免錯誤'],a:0,ex:'迴圈結束時得到 10 個值的陣列。'},
 {q:'Load_Off.vi 有錯誤輸入時應該？',o:['照樣關負載，再把錯誤傳出去','什麼都不做','停止程式','清掉錯誤'],a:0,ex:'結束時一定要關，跟有沒有錯無關。'},
 {q:'報告裡一定要寫儀器的校正到期日，原因？',o:['過期的儀器量的數字不被承認','好看','客戶要訂儀器','法律規定要寫序號'],a:0,ex:'數據要有可信的來源。'}
]}
]});
})();
