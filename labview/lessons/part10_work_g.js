/* 實務案例 W10：治具開短路測試。DAQ 的數位輸出切繼電器，一次接通一個測點，類比輸入量電壓，換算成對地電阻，和測點表比對。
   職缺對照（docs/job_research.md 第 I 組）：治具規劃與驗證、治具配線與測試程式、治具維護、Gage R&R。
   量測原理：5 V 經過 1 kΩ 參考電阻接到測點，測點對地電阻 Rx，量到 V ＝ 5 × Rx ÷（1000 ＋ Rx），Rx ＝ 1000 × V ÷（5 − V）。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const PR=['Functions','Programming'],DQ=['Functions','Measurement I/O','NI-DAQmx'];
const addF=o=>{for(const k in o)if(!LV.F[k])LV.F[k]=o[k];};
addF({
 'Logical Shift':{g:'≪',ins:['x','y'],outs:['x<<y'],pal:[...PR,'Numeric','Data Manipulation','Logical Shift']},
 'Mean':{g:'x̄',ins:['X'],outs:['mean'],pal:['Functions','Mathematics','Probability & Statistics','Mean.vi']},
 'DAQmx Write':{g:'DAQmx\nW',ins:['task/channels in','data','error in'],outs:['task out','error out'],w:48,h:56,col:'#e3f1ff',pal:[...DQ,'DAQmx Write.vi']},
 'DAQmx Read':{g:'DAQmx\nR',ins:['task/channels in','number of samples per channel','error in'],outs:['task out','data','error out'],w:48,h:56,col:'#e3f1ff',pal:[...DQ,'DAQmx Read.vi']},
 'In Range and Coerce':{g:'⊏⊐',ins:['upper limit','x','lower limit'],outs:['coerced(x)','In Range?'],pal:[...PR,'Comparison','In Range and Coerce']},
 'And Array Elements':{g:'∧[ ]',ins:['Boolean array'],outs:['logical AND'],pal:[...PR,'Boolean','And Array Elements']}
});

const RREF=1000,VS=5;
const PTS=[
 ['P1','GND',0,20],['P2','+5V',800,1200],['P3','SDA',9000,11000],['P4','SCL',9000,11000],
 ['P5','RESET',4300,5700],['P6','LED1',300,450],['P7','LED2',300,450],['P8','CAL（治具自檢 1 kΩ）',980,1020],
 ['P9','TX',45000,55000],['P10','RX',45000,55000],['P11','VBAT',1800,2600],['P12','ADC0',18000,22000],
 ['P13','ADC1',18000,22000],['P14','EN',42300,51700],['P15','GND2',0,20],['P16','NC（空腳）',200000,Infinity]
];
const TRUE_R=[0.3,1000,10000,10000,4990,370,370,1000,49900,49900,2200,20000,20000,47000,0.4,Infinity];
const BOARDS=['良品','P7 開路（LED2 沒焊好）','P3、P4 錫橋（短在一起）','P12 短到地'];
function trueR(board){
  const r=TRUE_R.slice();
  if(board===1)r[6]=Infinity;
  if(board===2){r[2]=r[3]=5000;}
  if(board===3)r[11]=0.5;
  return r;
}
const vOf=R=>R===Infinity?VS:VS*R/(RREF+R);
const rOf=V=>V>=VS-0.002?Infinity:RREF*V/(VS-V);
const fmtL=v=>v===Infinity?'+Inf':fmtR(v);
const fmtR=R=>R===Infinity?'開路':R>=1e6?(R/1e6).toFixed(2)+' MΩ':R>=1000?(R/1000).toFixed(2)+' kΩ':R.toFixed(1)+' Ω';
/* 掃描：settle 太短時讀到的還混著上一點的電壓；two=true 時上一顆繼電器沒放開（兩點並聯） */
function scan(board,settle,two,noise,zin){
  const r=trueR(board);let vPrev=0;const out=[];
  for(let i=0;i<16;i++){
    let R=r[i];
    if(two&&i>0){const a=R,b=r[i-1];R=(a===Infinity)?b:(b===Infinity)?a:a*b/(a+b);}
    if(zin){const Z=144000;R=R===Infinity?Z:R*Z/(R+Z);}
    const f=Math.exp(-(settle+0.7)/1.0);
    let V=vOf(R)*(1-f)+vPrev*f+(noise?(noise()-0.5)*0.0008:0);
    V=Math.max(0,Math.min(VS,V));vPrev=V;
    const Rm=rOf(V),p=PTS[i],ok=Rm>=p[2]&&Rm<=p[3];
    out.push({V,R:Rm,ok,why:ok?'':Rm<p[2]?(Rm<20?'短路':'偏低'):(Rm===Infinity?'開路':'偏高')});
  }
  return out;
}

/* ---- 圖：治具掃描 ---- */
function fixtureSim(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<p style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 6px">
   板子 <select data-k="b">${BOARDS.map((b,i)=>`<option value="${i}">${b}</option>`).join('')}</select>
   繼電器切換後等 <select data-k="s"><option value="0">0 ms</option><option value="2">2 ms</option><option value="10" selected>10 ms</option></select>
   <label><input type="checkbox" data-k="two"> 程式寫錯：上一顆沒放開</label>
   <label><input type="checkbox" data-k="zin"> 換成 AI 輸入阻抗只有 144 kΩ 的低價 DAQ</label>
   <button type="button" class="btn" data-k="go">掃描</button></p>
  <div data-o="grid" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;max-width:620px"></div>
  <p data-o="sum" style="font-size:14px;margin-top:8px"></p>`;
  const o=k=>el.querySelector('[data-o='+k+']'),q=k=>el.querySelector('[data-k='+k+']');
  let busy=false,relayCount=0;
  function cell(i,st,res){
    const p=PTS[i];const bg=st==='on'?'#fff3b0':res?(res.ok?'#dff5e3':'#fde2df'):'#fff';
    return `<div style="border:1px solid ${st==='on'?'#d4a017':'#c9d1db'};background:${bg};border-radius:6px;padding:5px 7px;font-size:12px;min-height:58px">
     <b>${p[0]}</b> ${p[1]}<br><span style="color:#667">規格 ${fmtR(p[2])}～${fmtL(p[3])}</span><br>${res?`${res.V.toFixed(3)} V → <b>${fmtR(res.R)}</b> ${res.ok?'✓':'✗ '+res.why}`:st==='on'?'繼電器 ON，量測中…':''}</div>`;
  }
  function draw(cur,res){o('grid').innerHTML=PTS.map((p,i)=>cell(i,i===cur?'on':'',res&&res[i]&&i<(cur<0?16:cur)?res[i]:null)).join('');}
  q('go').onclick=async()=>{
    if(busy)return;busy=true;
    const r=scan(+q('b').value,+q('s').value,q('two').checked,Math.random,q('zin').checked);
    const t0=performance.now();
    for(let i=0;i<16;i++){if(!document.body.contains(el))return;draw(i,r);relayCount++;await new Promise(z=>setTimeout(z,90));}
    draw(-1,r);
    const bad=r.map((x,i)=>x.ok?null:PTS[i][0]+' '+x.why).filter(Boolean);
    const ms=16*(+q('s').value+10);
    o('sum').innerHTML=(bad.length?`<b style="color:#c0392b">FAIL</b>：${bad.join('、')}`:'<b style="color:#1e7b34">PASS</b>：16 點都在規格內')+`<br><span style="font-size:12px;color:#556">實機掃一次約 ${ms} ms（每點：等 ${q('s').value} ms ＋ 量 10 ms）；繼電器已經動作 ${relayCount} 次</span>`;
    busy=false;
  };
  draw(-1,null);
}

/* ---- 一步一步寫：Scan.vi ---- */
const sv={name:'Scan.vi',view:'split',ratio:1.7,
 fp:{w:340,h:470,items:[
  {id:'board',k:'enum',ctl:true,label:'板子（模擬用）',options:BOARDS,x:12,y:8,v:0},
  {id:'settle',k:'num',ctl:true,label:'等待 ms',x:230,y:8,w:50,v:10,inc:1},
  {id:'rarr',k:'table',label:'每一點量到的電阻',cols:['點','名稱','R','判定'],rows:16,x:12,y:64,w:316},
  {id:'pass',k:'led',label:'16 點全部 OK',color:'green',x:12,y:430}]},
 bd:{w:1170,h:320,structs:[{id:'fl',k:'for',x:200,y:20,w:600,h:260}],
  nodes:[
  {id:'tDO',k:'ctl',t:'visa',label:'DO 任務（port0:1，16 條線）',x:20,y:60},
  {id:'tAI',k:'ctl',t:'visa',label:'AI 任務（ai0，0～5 V）',x:20,y:150},
  {id:'kN',k:'const',t:'i32',v:16,x:150,y:26},{id:'N',k:'N',s:'fl'},
  {id:'tu1',k:'tunnel',t:'visa',s:'fl',side:'l',y:70},
  {id:'tu2',k:'tunnel',t:'visa',s:'fl',side:'l',y:160},
  {id:'it',k:'iter',s:'fl'},
  {id:'k1',k:'const',t:'u16',v:1,x:240,y:200},
  {id:'ls',k:'fn',fn:'Logical Shift',x:290,y:200},
  {id:'dw',k:'fn',fn:'DAQmx Write',x:340,y:54},
  {id:'st',k:'sub',name:'Settle.vi（等幾 ms，有 error 線）',icon:['WAIT','ms'],ins:['ms','error in'],outs:['error out'],x:420,y:80,w:56,h:44,color:'#5a6b7d',tip:'Wait (ms) 沒有 error 端子，包成 SubVI 加上 error in/out，才能用錯誤線排出「寫完 → 等 → 讀」的順序'},
  {id:'kms',k:'const',t:'i32',v:10,x:380,y:186},
  {id:'kS',k:'const',t:'i32',v:10,x:470,y:20},
  {id:'dr',k:'fn',fn:'DAQmx Read',x:520,y:54},
  {id:'mean',k:'fn',fn:'Mean',x:590,y:70},
  {id:'k5',k:'const',t:'dbl',v:5,x:596,y:128,label:'Vs（全關時量到）'},
  {id:'sub',k:'fn',fn:'Subtract',x:650,y:120},
  {id:'div',k:'fn',fn:'Divide',x:700,y:80},
  {id:'kR',k:'const',t:'dbl',v:1000,x:690,y:150},
  {id:'mul',k:'fn',fn:'Multiply',x:750,y:90},
  {id:'tR',k:'tunnel',t:'dbl[]',s:'fl',side:'r',y:104,idx:true},
  {id:'rarr',k:'ind',t:'dbl[]',label:'R（Ω）',x:846,y:234},
  {id:'kmax',k:'const',t:'dbl[]',v:'上限（16 格）',x:836,y:30},
  {id:'kmin',k:'const',t:'dbl[]',v:'下限（16 格）',x:836,y:170},
  {id:'irc',k:'fn',fn:'In Range and Coerce',x:980,y:90},
  {id:'aae',k:'fn',fn:'And Array Elements',x:1050,y:104},
  {id:'pass',k:'ind',t:'bool',label:'16 點全部 OK',x:1112,y:110}],
  wires:[
  {id:'w0',from:'kN',to:'N',t:'i32'},
  {id:'w1',from:'tDO',to:'tu1.o',t:'visa'},
  {id:'w2',from:'tAI',to:'tu2.o',t:'visa'},
  {id:'w3',from:'tu1.i',to:'dw.task/channels in',t:'visa'},
  {id:'w4',from:'k1',to:'ls.x',t:'u16',mx:270},
  {id:'w5',from:'it',to:'ls.y',t:'i32',mx:262},
  {id:'w6',from:'ls.x<<y',to:'dw.data',t:'u16',mx:332},
  {id:'w7',from:'dw.error out',to:'st.error in',t:'err',mx:404},
  {id:'w8',from:'kms',to:'st.ms',t:'i32',mx:410},
  {id:'w9',from:'tu2.i',to:'dr.task/channels in',t:'visa',mx:500},
  {id:'w10',from:'kS',to:'dr.number of samples per channel',t:'i32',mx:508},
  {id:'w11',from:'st.error out',to:'dr.error in',t:'err',mx:500},
  {id:'w12',from:'dr.data',to:'mean',t:'dbl[]',mx:580},
  {id:'w13',from:'k5',to:'sub.x',t:'dbl',mx:640},
  {id:'w14',from:'mean.mean',to:'sub.y',t:'dbl',mx:640},
  {id:'w15',from:'mean.mean',to:'div.x',t:'dbl',mx:640},
  {id:'w16',from:'sub.out',to:'div.y',t:'dbl',mx:690},
  {id:'w17',from:'div.out',to:'mul.x',t:'dbl'},
  {id:'w18',from:'kR',to:'mul.y',t:'dbl',mx:740},
  {id:'w19',from:'mul.out',to:'tR.i',t:'dbl'},
  {id:'w20',from:'tR.o',to:'rarr',t:'dbl[]',mx:824},
  {id:'w21',from:'tR.o',to:'irc.x',t:'dbl[]',mx:824},
  {id:'w22',from:'kmax',to:'irc.upper limit',t:'dbl[]',mx:964},
  {id:'w23',from:'kmin',to:'irc.lower limit',t:'dbl[]',mx:970},
  {id:'w24',from:'irc.In Range?',to:'aae',t:'bool[]',mx:1036},
  {id:'w25',from:'aae.logical AND',to:'pass',t:'bool'}]},
 sim:{init:()=>({}),
  step(inp){
   const r=scan(+inp.board||0,Math.max(0,+inp.settle||0),false,null);
   const all=r.every(x=>x.ok);
   return {out:{rarr:r.map((x,i)=>[PTS[i][0],PTS[i][1],fmtR(x.R),x.ok?'OK':x.why]),pass:all},
    vals:{kN:16,k1:1,'ls.x<<y':'1, 2, 4 … 32768',kms:+inp.settle||0,kS:10,'dr.data':'[10 個電壓]','mean.mean':'每一點的平均電壓',k5:5,kR:1000,'mul.out':'R（Ω）','tR.o':'[16 個 R]','irc.In Range?':'['+r.map(x=>x.ok?'T':'F').join(' ')+']','aae.logical AND':all},
    msg:all?'16 點全部在規格內':'不合格：'+r.map((x,i)=>x.ok?null:PTS[i][0]+' '+x.why).filter(Boolean).join('、')};},
  doneMsg:'掃描完成：改板子或等待時間再 Run'}
};

L.push({id:'W10',order:30.990,no:'W10',part:PART,title:'治具開短路測試：DAQ 切繼電器掃 16 個測點，量電阻、比對測點表',mins:80,files:['練習\\實務\\Fixture\\Scan.vi','練習\\實務\\Fixture\\points.csv'],
goals:[['學會','用一個參考電阻和一個 AI 通道量對地電阻；DAQ 數位輸出切繼電器，一次只接通一點（one-hot）；繼電器切換後要等穩定；用錯誤線排出「寫 → 等 → 讀」的順序；量測範圍要配合參考電阻；測點表放檔案；治具自檢點；繼電器壽命和治具維護。'],['做出','Scan.vi：16 點掃描、換算電阻、和測點表比對；在模擬治具上找出開路、短路和程式寫錯造成的誤判。'],['為什麼是這個題目','電子代工廠的治具職缺常寫「治具規劃、驗證、導入產線」「治具維護、故障診斷、設備日誌」。PCBA 量產線上的開短路多半交給 ICT 或飛針測試機；自己用 DAQ ＋ 繼電器做的掃描，常見於小量產品、線束和連接器的導通測試、功能治具上電前的檢查。原理和這一課一樣。']],
check:'不看課文，能從量到的電壓算出電阻、說出為什麼一次只能接通一顆繼電器、為什麼切換後要等、等多久怎麼決定，以及治具自檢點的用途。',
body:[
tip('練習檔','下載：<a href="work/points.csv" download>points.csv</a>。points.csv 是 W10 的 16 個測點表；P16 的上限寫 Inf（LabVIEW 讀得懂），不是一個很大的數字。'),
C.h3('① 聽懂需求','','治具課長的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「新板子要做一個開短路治具。探針有 16 根，RD 給了每一點對地應該多少電阻。用我們現有的 USB DAQ 和一片 16 路繼電器板，寫一支程式掃一遍，告訴作業員哪一點有問題。一片 1 秒內。」</p></div>`,
ask('至少問四件事。',
 `<ol><li><b>每一點的「應該」是多少？允許多少誤差？</b>RD 給的是電路上的元件值，實際量到的還會加上探針、線、其他元件並聯。答案：RD 給一張測點表（下面），誤差範圍由你量 10 片好板子之後提出，RD 確認。</li>
 <li><b>DAQ 的規格夠不夠</b>：① AI 的<b>輸入阻抗</b>要遠大於最大的待測電阻：低價的 USB DAQ 可能只有一百多 kΩ，會和 50 kΩ、100 kΩ 的測點並聯，全部讀錯（模擬裡可以勾來看）；② <b>解析度</b>：12 位元在 ±10 V 檔一格約 5 mV，分不出 200 kΩ 和開路，要 16 位元以上；③ <b>DO 條數</b>：要 16 條，不夠就加數位 I/O 模組。答案：用一台 16 位元、輸入阻抗 GΩ 級的 DAQ，DO 另外用一片 24 線的數位 I/O。</li>
 <li><b>繼電器板怎麼接</b>：DO 是 HIGH 吸合還是 LOW 吸合？繼電器的線圈要多少電流（DAQ 的 DO 推不推得動，要不要驅動電路）？<b>DAQ 剛上電、程式還沒跑的時候，DO 是什麼狀態？</b>有些 DAQ 開機時數位腳是輸入、有上拉，HIGH 吸合的繼電器板會 16 顆一起吸合。要用硬體保證（LOW 吸合，或輸入端加下拉），程式管不到那一刻。</li>
 <li><b>板子要不要通電？</b>答案：<b>不通電</b>。開短路測試是在上電之前，確保上電不會燒掉。（量電阻時板子通電，量到的東西完全不對，還可能損壞 DAQ。）</li></ol>`),
C.h3('② 寫成規格','','測點表'),
C.table(['點','名稱','下限','上限','說明'],PTS.map((p,i)=>[p[0],p[1],fmtR(p[2]),fmtL(p[3]),
 ['接地','板子負載','10 kΩ 上拉','10 kΩ 上拉','RC 重置','LED ＋限流電阻（實測值，不是電阻的標示值）','LED ＋限流電阻（實測值）','治具上的 1 kΩ 精密電阻，不在板子上','分壓','分壓','電池分壓','濾波','濾波','致能','接地，下限 0、上限 20 Ω 是量測能力的極限','沒接東西；超過 200 kΩ 就當作開路（量測上限）'][i]])),
ask('P16「空腳」量到開路是 PASS，P7 量到開路是 FAIL。為什麼同一個結果，判定不同？',
 `<p>判定看的是<b>和這一點的規格比</b>，不是「開路就是壞」。所以測點表每一點都要有上下限，空腳的下限設在 200 kΩ（這個電路量得到的上限）、上限是 +Inf：開路算出來就是 +Inf，所以 In Range and Coerce 一定要勾 Include upper limit，不然 +Inf 不在範圍內。如果 P16 量到 0 Ω，反而代表它跟地短在一起了：這也是要抓的。</p>`),
C.h3('③ 盤點','','量電阻只需要一個電阻'),
`<p>DAQ 的 AI 量的是電壓，不是電阻。治具上用一個 1 kΩ 的參考電阻，從 5 V 接到測點：</p>
<p style="text-align:center;font-size:15px"><b>V ＝ Vs × Rx ÷（1000 ＋ Rx）</b>　反過來　<b>Rx ＝ 1000 × V ÷（Vs − V）</b></p>
<p>Vs 是那個「5 V」實際的電壓。USB 或 DAQ 給的 5 V 常常有 ±5 % 的誤差，如果公式直接寫 5，4.90 V 的電源會讓 P8 自檢的 1 kΩ 算成 961 Ω，好治具也被判壞。所以 Vs 不要用假設的：每次掃描前先把繼電器全部放開，這時 AI 量到的就是 Vs（只剩參考電阻，沒有電流），存起來給公式用。這叫比例量測：結果只和兩次讀值的比例有關。</p>
<p>Rx 是測點對地的電阻。短路（Rx ≈ 0）量到 0 V；開路（Rx 無限大）量到 5 V；Rx ＝ 1 kΩ 時剛好 2.5 V。16 個測點各接一顆繼電器，繼電器的另一邊全部接到同一個「量測點」：一次接通一顆，就量那一點。</p>`,
ask('Rx ＝ 100 kΩ 時 V ＝ 4.950 V；Rx ＝ 1 MΩ 時 V ＝ 4.995 V。這代表什麼問題？',
 `<p>電阻越大，電壓越擠在 5 V 附近：100 kΩ 和 1 MΩ 只差 45 mV，1 MΩ 和開路只差 5 mV。AI 有雜訊（幾百 µV），量很大的電阻就會不準；同樣地，量 0.3 Ω 和 5 Ω 也只差 25 mV。</p>
 <p>參考電阻決定「量得準的範圍」，大約在參考電阻的 1/50～50 倍之間。這片板子的測點從 0 Ω 到 100 kΩ 都有，實務上會用<b>兩顆參考電阻</b>（例如 100 Ω 和 10 kΩ），依測點表切換；這一課為了簡單只用一顆。</p>`),
C.h3('④ 先驗證','','用 MAX 手動接一點'),
`<ol><li>NI MAX ▸ Test Panels：DO 寫 <code>0x0080</code>（只有第 8 條 HIGH），聽到繼電器「喀」一聲，AI 讀 P8（1 kΩ 自檢電阻）應該是 2.50 V。這一步同時證明 DO、繼電器板、AI 接線、參考電阻都是對的。</li>
<li>用三用電表量一片好板子的 P1～P16，和測點表對照：RD 給的值和實際量的差多少？（常常差很多，因為元件並聯。）</li>
<li>把 DO 寫 0 → 所有繼電器放開，AI 讀到的就是 Vs（量測點懸空，只剩參考電阻）。記下來，看看是不是真的 5.000 V。</li></ol>`,
note('這一課的簡化','網頁和題目為了好算，把每一點都當成一個固定電阻。真的板子上：LED 和二極體是非線性的（要另外用二極體測試）；+5 V 上的大電容要充電很久才穩；用 5 V 打進沒通電的 IC 腳，會經過保護二極體倒灌到電源。所以 ICT 這類設備用很低的測試電壓（低於二極體導通電壓）。另外 P3、P4 的上拉其實接在 +5 V 網路上，對地還要加上 +5 V 對地的電阻；正式的短路測試也會兩兩量相鄰的網路，不只量對地。'),
C.h3('⑤ 規劃','','一次接通一顆、切換後等一下'),
C.plan({start:'Scan.vi。DO、AI 兩個任務在迴圈外建立（DAQmx Create Channel），迴圈結束後先寫 DO ＝ 0，再 Clear。',
 in:'測點表 points.csv（名稱、下限、上限），程式開始時讀一次。',
 calc:'For Loop 跑 16 次：第 i 圈 DO 寫 1 << i（只有第 i 條 HIGH）→ 等繼電器穩定 → AI 讀 10 個點取平均 → 換算 Rx。迴圈結束得到 16 個電阻 → 和上下限陣列比 → 全部 OK？',
 out:'每一點的電阻和判定（表格）、不合格的點、PASS／FAIL。',
 loop:'16 × （等待 ＋ 量測）。等待時間要實驗決定（下面），一片要在 1 秒內。',
 end:'不管正常結束或出錯，<b>最後一定寫 DO ＝ 0</b>，所有繼電器放開。'}),
ask('DO 的資料為什麼是「1 << i」，不是「第 i 條設成 True」就好？',
 `<p>DAQmx Write 寫整個 port 時，一次寫 16 條線的狀態。1 << i 是只有第 i 位元是 1 的數（1、2、4…32768），等於<b>同時</b>把第 i 條打開、其他 15 條關掉。</p>
 <p>如果只寫「第 i 條 True」，上一圈打開的那一條沒關，兩點就透過量測點短在一起（並聯），兩點都量錯。下面的模擬勾「上一顆沒放開」就是這種錯。</p>`),
{fn:fixtureSim},
ask('等待 0 ms 時，好板子也有好幾點 FAIL。為什麼？等多久才夠？',
 `<p>繼電器從收到訊號到接點真正閉合，要幾 ms，而且接點會彈跳；量測點上的電壓也要時間從上一點的值變過來。0 ms 量到的電壓<b>還混著上一點的值</b>，所以前後兩點差很多的地方（例如 P1 接地之後的 P2）錯得最明顯。</p>
 <p>等多久用實驗決定：看繼電器規格書的動作時間，再實際試 2、5、10、20 ms，找到「結果不再改變」的時間，再加一點餘裕。寫進註解（W8：沒有註解的 Wait 會被下一個人刪掉）。</p>`),
C.h3('⑥ 一步一步寫','','Scan.vi'),
{steps:{title:'Scan.vi：one-hot 切繼電器 → 等 → 讀 → 換算 → 比對',lv:sv,steps:[
 {t:'For Loop 和兩個任務',view:'split',add:['board','settle','fl','kN','N','w0','tDO','tAI','tu1','tu2','w1','w2'],h:`<p>For Loop，N 接 16。DO、AI 兩個任務從左邊穿進迴圈（任務在迴圈外建立好，一個 VI 只建一次）。</p>`},
 {t:'第 i 圈只打開第 i 顆：Logical Shift',view:'split',add:['it','k1','ls','w4','w5','dw','w3','w6'],h:`<p>${fn('Programming','Numeric','Data Manipulation','Logical Shift')}：x 接 U16 的 1，y 接 i，得到 1、2、4…。接到 DAQmx Write 的 data（多型選 Digital ▸ Single Channel ▸ Single Sample ▸ U16 (port format)）。</p>`},
 {t:'等，然後讀',view:'split',add:['st','kms','w7','w8','dr','kS','w9','w10','w11'],h:`<p>Wait (ms) 沒有 error 端子，放在迴圈裡會和 Write 同時執行（資料流沒有先後）。所以包成一個小 SubVI：error in → Wait → error out，用錯誤線排出 <b>Write → 等 → Read</b> 的順序。（內建的 Time Delay Express VI 本身就有 error in／out，也可以直接用。）</p><p>DAQmx Read 讀 10 個樣本（Analog ▸ Single Channel ▸ Multiple Samples ▸ 1D DBL）。AI 任務沒有設 DAQmx Timing 的話是軟體一點一點取樣，間隔不固定；要固定間隔就設 Sample Clock、Finite Samples（例如 1 kHz、10 點），每一點用 Start → Read → Stop。</p>`},
 {t:'平均、換算電阻',view:'split',add:['mean','w12','k5','sub','w13','w14','div','w15','w16','kR','mul','w17','w18','tR','w19','rarr','w20'],h:`<p>Mean 取平均（降低雜訊）。Rx ＝ 1000 × V ÷（Vs − V），Vs 是迴圈開始前 DO 全關時量到的電壓。</p><p><b>開路要另外處理</b>：開路時 V 和 Vs 幾乎一樣，雜訊會讓 V 比 Vs 還大一點點，分母變成負的，算出一個很大的<b>負</b>電阻，被判成短路。所以要加一個判斷（圖上省略）：V ≥ Vs − 2 mV 時直接輸出 +Inf，用 Select 選。網頁模擬就是這樣算的。</p><p>電阻從右邊的自動索引通道出去，16 圈得到 16 個元素的陣列。</p>`},
 {t:'和測點表比',view:'split',add:['kmax','kmin','irc','w21','w22','w23','aae','w24','pass','w25'],h:`<p>上下限陣列從 points.csv 讀（這裡用常數代表）。In Range and Coerce 一次比 16 格，And Array Elements 看是不是全部 OK。和 W6 一模一樣的寫法，同樣要記得右鍵勾 <b>Include upper limit</b>（預設不含上限）。</p><p>迴圈結束後還要 DAQmx Write 0（所有繼電器放開）→ Clear Task，錯誤線也要接 Shift Register，前一圈出錯就不要再切繼電器（圖上省略）。</p>`},
 {t:'Run：換板子、改等待時間',view:'split',add:[],h:`<p>依序選四種板子。錫橋那片：P3、P4 都是 5 kΩ（兩個 10 kΩ 並聯），兩點都偏低。再把等待改成 0 ms，好板子也會出現假的 FAIL。</p>`}
]}},
C.h3('⑦ 測試、交機','','治具也需要維護'),
C.table(['測試','操作','預期'],[
 ['T1','好板子連測 10 次','10 次都 PASS，每一點的電阻變化很小（記錄下來，就是 Gage R&R 的起點）'],
 ['T2','三種故意做壞的板子','都抓到，而且指出正確的點'],
 ['T3','等待時間 2、5、10 ms 各跑 10 次','找出不再有假 FAIL 的最短時間，寫進註解'],
 ['T4','拔 USB 再接回，程式還沒啟動；再啟動程式，中途按停止','程式還沒啟動時繼電器全部放開（硬體保證）；按停止後 DO ＝ 0'],
 ['T5','每天開工先量 P8 自檢點','2.50 V（1 kΩ）。偏掉代表參考電阻或探針有問題，治具先修']
]),
ask('為什麼要在治具上放一顆 P8 自檢電阻？',
 `<p>它不屬於板子，是治具自己的「已知答案」。每一片都量它，如果哪天 P8 量到 1.3 kΩ，代表量測路徑（探針、繼電器接點、參考電阻、線）壞了，這時候其他點的 FAIL 都不可信。有了它，作業員和程式都能分辨「板子壞」還是「治具壞」。W6 的 golden sample、W2 的先用 MAX 驗證，都是同一個想法。</p>`),
tip('治具維護','探針大約幾萬到幾十萬次要換，繼電器也有機械壽命。程式裡累計每一顆繼電器、每一根探針的動作次數，存在檔案裡；快到壽命時提醒換。職缺上的「治具維護、設備日誌」就是這些。模擬裡的「繼電器已經動作幾次」就是這個計數。'),
`<p>交機資料：測點表（含版本）、接線圖（每根探針 → 繼電器 → DO 線號）、等待時間的實驗紀錄、10 片好板子的量測統計、自檢點的標準值、探針和繼電器的更換次數門檻。</p>`,
C.h3('測','q','小測驗'),
{quiz:[
 {q:'參考電阻 1 kΩ、5 V，量到 2.5 V，Rx ＝ ？',o:['1 kΩ','2.5 kΩ','500 Ω','開路'],a:0,ex:'1000 × 2.5 ÷ 2.5。'},
 {q:'量到接近 5 V 代表？',o:['開路（電阻很大）','短路','1 kΩ','DAQ 壞了'],a:0,ex:'Rx 越大越接近 5 V。'},
 {q:'第 5 圈（i ＝ 5）DO 要寫？',o:['32（1 << 5）','5','0x05','63'],a:0,ex:'只有第 5 位元是 1。'},
 {q:'上一顆繼電器沒放開，會怎樣？',o:['兩點並聯，兩點都量錯','比較快','沒影響','DAQ 會報錯'],a:0,ex:'一次只能接通一顆。'},
 {q:'Wait (ms) 直接放在迴圈裡和 DAQmx Write 並排，問題是？',o:['它沒有資料相依，可能跟 Write 同時執行，等不到','Wait 不能放在 For Loop','會等兩次','沒問題'],a:0,ex:'用有 error 線的 SubVI 或 Flat Sequence 排順序。'},
 {q:'開短路測試時板子應該？',o:['不通電','通電','接負載','接示波器'],a:0,ex:'先確認沒短路才上電。'},
 {q:'治具自檢點量到不對，應該？',o:['先修治具，這時其他點的結果不可信','照樣出貨','改上下限','重開程式'],a:0,ex:'分辨板子壞還是治具壞。'}
]}
]});
})();
