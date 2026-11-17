/* 實務案例 W20：XY 平台定位。PM5 v2 燒錄站擴充：托盤上 2×2 片，XY 平台帶著燒錄探針頭（Z 用氣缸），一片一片移過去燒。
   職缺對照（docs/research_W20.md 第 1 節）：伺服控制開發（Y15）、馬達與驅動器控制（Y19）、PLC 控制與手臂路徑（Y20）、運動規劃與座標轉換（Y03）。
   分工：FX3S 負責定位和所有互鎖，LabVIEW 負責座標表、流程和紀錄。新東西只有兩個：命令有前置條件（PLC 會拒絕），完成要等實際到位。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
if(!LV.F['Split Number'])LV.F['Split Number']={g:'⇉',ins:['x'],outs:['hi(x)','lo(x)'],pal:['Functions','Programming','Numeric','Data Manipulation','Split Number']};
if(!LV.F['Round To Nearest'])LV.F['Round To Nearest']={p:'⌊⌉',a:1,pal:['Functions','Programming','Numeric','Round To Nearest']};
if(!LV.F['To Long Integer'])LV.F['To Long Integer']={p:'I32',a:1,pal:['Functions','Programming','Numeric','Conversion','To Long Integer']};

/* ---- 圖：托盤上跑一盤 ---- */
const SCN=[
 ['ok','正常跑一盤'],
 ['nohome','早上開機（斷過電），沒回原點就按開始'],
 ['lo','LabVIEW 的舊程式只寫了低位字（第 3 格目標 40.000 mm，高位字還留著上一次的 1）'],
 ['noz','流程寫錯：第 2 格燒完忘了送「Z 上升」就去下一格'],
 ['step','步進馬達：第 2 格之後失步，往 X 偏了 0.6 mm'],
 ['inp','伺服的到位範圍設得很嚴（每次移動多等 1.2 秒）']
];
const PCK=[['H','PLC：沒回原點，拒絕移動'],['S','PLC：軟體極限（0～60 mm）'],['Z','PLC：Z 軸上升感測器 ON 才准動 XY'],['I','PLC：「完成」要等伺服的到位信號 INP'],['R','LabVIEW：每盤結束回原點，檢查回來時偏了多少']];
const CELLS=[[10,10],[40,10],[10,40],[40,40]];
function runTray(sc,c){
  const L=[];let t=0,crash=false,ok=0,bad=0;const pts=[];
  const mv=d=>0.1+d/100+(sc==='inp'?1.2:0.15);
  let pos=[0,0],homed=sc!=='nohome',drift=0;
  if(sc==='nohome'&&!c.H){L.push(['r','PLC 不知道自己在哪：D8340 是 0，但平台其實停在昨天的 (35, 22)。照座標走，每一格都偏了一大段']);}
  for(let i=0;i<4;i++){
    let tgt=CELLS[i].slice();
    if(sc==='lo'&&i===2)tgt=[105.536,40];
    if(sc==='nohome'&&!homed){
      if(c.H){L.push(['g','第 1 格：PLC 拒絕，異常碼 1「未回原點」。LabVIEW 顯示「請先按原點復歸」，什麼都沒動']);return {L,pts,t,crash,ok,bad,stop:'拒絕'};}
    }
    if(sc==='lo'&&i===2){
      if(c.S){L.push(['g','第 3 格：目標變成 1×65536＋40000 ＝ 105536 脈波（105.5 mm），超過軟體極限。PLC 拒絕，異常碼 2；LabVIEW 停下來，顯示目標值']);return {L,pts,t,crash,ok,bad,stop:'拒絕'};}
      L.push(['r','第 3 格：目標 105.5 mm，平台一路衝到硬體極限才停（驅動器的 LSN／LSP），探針頭撞到托盤外框']);crash=true;pts.push([60,40,'x']);return {L,pts,t,crash,ok,bad,stop:'撞機'};
    }
    if(sc==='noz'&&i===2){
      if(c.Z){L.push(['g','第 3 格：PLC 拒絕，異常碼 3「Z 軸未上升」。探針頭還壓在第 2 片上，什麼都沒動。LabVIEW 顯示流程錯誤']);return {L,pts,t,crash,ok,bad,stop:'拒絕'};}
      L.push(['r','第 3 格：探針頭還壓在第 2 片上就橫移：探針斷了兩根，第 2 片板子刮傷']);crash=true;pts.push([25,25,'x']);return {L,pts,t,crash,ok,bad,stop:'撞機'};
    }
    const d=Math.hypot(tgt[0]-pos[0],tgt[1]-pos[1]);t+=mv(d);
    let act=tgt.slice();
    if(sc==='nohome')act=[tgt[0]+35,tgt[1]+22];
    if(sc==='step'&&i>=2){drift=0.6;act=[tgt[0]+drift,tgt[1]];}
    pos=tgt;t+=0.6;            // Z 下、上
    if(sc==='nohome'&&(act[0]>60||act[1]>60)){L.push(['r','第 '+(i+1)+' 格：實際位置超出平台範圍，撞到硬體極限停下。（軟體極限沒有用：PLC 以為自己在 ('+tgt.join(', ')+')）']);crash=true;pts.push([Math.min(act[0],60),Math.min(act[1],60),'x']);return {L,pts,t,crash,ok,bad,stop:'撞機'};}
    const off=Math.hypot(act[0]-tgt[0],act[1]-tgt[1]);
    pts.push([act[0],act[1],off>0.3?'b':'o']);
    if(off>0.3){bad++;L.push(['r','第 '+(i+1)+' 格：探針偏了 '+off.toFixed(1)+' mm，沒壓到測試點，燒錄回「No target」（W18 的 BF8 重試兩次也一樣）'+(sc==='step'?'。步進馬達沒有到位信號，PLC 和 LabVIEW 都以為到了':'')]);t+=10;}
    else{ok++;t+=8;}
  }
  if(sc==='inp')L.push([c.I?'y':'r',c.I?'每一次移動都要多等 1.2 秒才 INP，四格多了將近 5 秒。到位範圍要配合需要的精度設，不是越嚴越好（W16 的節拍）':'沒有等 INP：PLC 送完脈波就回「完成」，伺服還在追，探針在平台還在動的時候壓下去。這次剛好都對到，但沒有保證']);
  if(sc==='step'){if(c.R)L.push(['y','盤子跑完回原點：PLC 送了該送的脈波，原點感測器卻提早 0.6 mm 就碰到了。LabVIEW 比對後報警「回原點偏差 0.6 mm」，停機檢查。第 3、4 片已經 FAIL，但下一盤不會再錯']);else L.push(['r','沒有人知道失步了：下一盤、下下一盤，第 3、4 格都 FAIL。作業員以為是板子的問題']);}
  return {L,pts,t,crash,ok,bad,stop:''};
}
function stageFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<div style="font-size:13px"><b>情況</b> <select data-k="sc" style="max-width:100%">${SCN.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select>
   <div style="margin-top:4px">${PCK.map(([k,t])=>`<label style="display:block"><input type="checkbox" data-k="${k}"> ${t}</label>`).join('')}</div></div>
   <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;align-items:flex-start">
   <canvas data-o="cv" width="220" height="220" style="background:#fff;border:1px solid #dde;flex:none"></canvas>
   <div data-o="out" style="font-size:13px;flex:1;min-width:200px"></div></div>`;
  const cv=el.querySelector('[data-o=cv]'),cx=cv.getContext('2d');
  function draw(){
    const c={};PCK.forEach(([k])=>c[k]=el.querySelector('[data-k='+k+']').checked);
    const R=runTray(el.querySelector('[data-k=sc]').value,c);
    const S=v=>20+v*3;cx.clearRect(0,0,220,220);
    cx.strokeStyle='#999';cx.strokeRect(S(0),S(0),180,180);cx.fillStyle='#666';cx.font='10px sans-serif';cx.fillText('平台 0～60 mm',S(0)+2,S(60)+12);
    cx.fillStyle='#e8f0e0';cx.fillRect(S(2),S(2),S(48)-S(2),S(48)-S(2));
    CELLS.forEach(([x,y],i)=>{cx.fillStyle='#cfe3c0';cx.fillRect(S(x-6),S(y-6),36,36);cx.strokeStyle='#6a8';cx.strokeRect(S(x-6),S(y-6),36,36);cx.fillStyle='#2d6b2d';cx.beginPath();cx.arc(S(x),S(y),3,0,7);cx.fill();cx.fillStyle='#333';cx.fillText(i+1,S(x-5),S(y-7)+8);});
    R.pts.forEach(([x,y,k])=>{cx.strokeStyle=k==='x'?'#c0392b':k==='b'?'#d35400':'#2f6fd0';cx.lineWidth=2;if(k==='x'){cx.beginPath();cx.moveTo(S(x)-6,S(y)-6);cx.lineTo(S(x)+6,S(y)+6);cx.moveTo(S(x)+6,S(y)-6);cx.lineTo(S(x)-6,S(y)+6);cx.stroke();}else{cx.beginPath();cx.arc(S(x),S(y),5,0,7);cx.stroke();}cx.lineWidth=1;});
    el.querySelector('[data-o=out]').innerHTML=`<p style="margin:0 0 4px">${R.stop==='撞機'?'<b style="color:#c0392b">撞機</b>':R.stop==='拒絕'?'<b style="color:#1e7b34">PLC 拒絕，什麼都沒壞</b>':'燒錄 PASS <b>'+R.ok+'</b> 片、沒對到 <b style="color:'+(R.bad?'#c0392b':'#1e7b34')+'">'+R.bad+'</b> 片'}　約 ${R.t.toFixed(1)} 秒</p>`+
      (R.L.length?R.L:[['g','四格都到位、燒錄 PASS。藍圈是探針實際壓下去的位置，綠點是測試點']]).map(([k,t])=>`<div style="border-left:3px solid ${k==='r'?'#c0392b':k==='y'?'#b9770e':'#1e7b34'};padding:2px 8px;margin:4px 0">${t}</div>`).join('');
  }
  el.querySelectorAll('select,input').forEach(s=>s.onchange=draw);draw();
}

/* ---- 一步一步寫：XY_Move.vi ---- */
const SCV=['正常','PLC 拒絕：未回原點（異常碼 1）','PLC 拒絕：Z 軸未上升（異常碼 3）','卡住：一直沒有完成（逾時）'];
const mvv={name:'XY_Move.vi',view:'split',ratio:1.5,
 fp:{w:360,h:300,items:[
  {id:'x',k:'num',ctl:true,label:'X mm',x:12,y:8,w:60,v:40,inc:1,dig:3},
  {id:'y',k:'num',ctl:true,label:'Y mm',x:100,y:8,w:60,v:10,inc:1,dig:3},
  {id:'scv',k:'enum',ctl:true,label:'PLC 那邊（模擬用）',options:SCV,x:190,y:8,v:0},
  {id:'px',k:'num',label:'X 脈波（I32）',x:12,y:70,w:80},
  {id:'hi',k:'num',label:'寫進 D301（高位）',x:120,y:70,w:60},
  {id:'lo',k:'num',label:'寫進 D300（低位）',x:220,y:70,w:70},
  {id:'st',k:'num',label:'D310 狀態',x:12,y:140,w:50},
  {id:'code',k:'num',label:'D311 異常碼',x:110,y:140,w:50},
  {id:'ms',k:'num',label:'等了幾 ms',x:210,y:140,w:70},
  {id:'res',k:'str',label:'結果',x:12,y:200,w:330}]},
 bd:{w:1300,h:430,structs:[{id:'wl',k:'while',x:700,y:20,w:400,h:300}],
  nodes:[
  {id:'x',k:'ctl',t:'dbl',label:'X mm',x:20,y:40},
  {id:'y',k:'ctl',t:'dbl',label:'Y mm',x:20,y:130},
  {id:'kp',k:'const',t:'dbl',v:1000,x:20,y:86,label:'脈波／mm'},
  {id:'m1',k:'fn',fn:'Multiply',x:110,y:50},
  {id:'m2',k:'fn',fn:'Multiply',x:110,y:130},
  {id:'r1',k:'fn',fn:'Round To Nearest',x:160,y:50},
  {id:'r2',k:'fn',fn:'Round To Nearest',x:160,y:130},
  {id:'i1',k:'fn',fn:'To Long Integer',x:210,y:50},
  {id:'i2',k:'fn',fn:'To Long Integer',x:210,y:130},
  {id:'px',k:'ind',t:'i32',label:'X 脈波',x:270,y:10},
  {id:'sp',k:'fn',fn:'Split Number',x:280,y:50,h:40},
  {id:'hi',k:'ind',t:'i16',label:'D301',x:350,y:0},
  {id:'lo',k:'ind',t:'i16',label:'D300',x:440,y:40},
  {id:'w32',k:'sub',name:'Write32.vi（Split Number ＋ 兩次 FX_WriteD：先低位 D、再高位 D＋1）',icon:['WR','32'],ins:['VISA in','D','I32','error in'],outs:['VISA out','error out'],x:380,y:100,w:56,h:70,color:'#5a6b7d'},
  {id:'kd0',k:'const',t:'i32',v:300,x:330,y:190},
  {id:'w32b',k:'sub',name:'Write32.vi（Y：D302、D303）',icon:['WR','32'],ins:['VISA in','D','I32','error in'],outs:['VISA out','error out'],x:470,y:100,w:56,h:70,color:'#5a6b7d'},
  {id:'kd2',k:'const',t:'i32',v:302,x:430,y:200},
  {id:'wc',k:'sub',name:'FX_WriteD.vi（L14）：命令最後寫',icon:['WRITE','D'],ins:['VISA in','D','Value','error in'],outs:['VISA out','error out'],x:570,y:100,w:56,h:70,color:'#5a6b7d'},
  {id:'kd4',k:'const',t:'i32',v:304,x:520,y:200},
  {id:'k1',k:'const',t:'i32',v:1,x:540,y:240,label:'1 ＝ 移動'},
  {id:'visa',k:'ctl',t:'visa',label:'VISA（L13）',x:20,y:220},
  {id:'tk0',k:'fn',fn:'Tick Count (ms)',x:620,y:280},
  {id:'tv',k:'tunnel',t:'visa',s:'wl',side:'l',y:110},
  {id:'te',k:'tunnel',t:'err',s:'wl',side:'l',y:150},
  {id:'tt',k:'tunnel',t:'u32',s:'wl',side:'l',y:290},
  {id:'rd',k:'sub',name:'FX_ReadD.vi（L13）：D310 起讀 2 個字',icon:['READ','D'],ins:['VISA in','D','Count','error in'],outs:['VISA out','Words','error out'],x:770,y:90,w:60,h:80,color:'#5a6b7d'},
  {id:'kd10',k:'const',t:'i32',v:310,x:712,y:200},
  {id:'k2c',k:'const',t:'i32',v:2,x:712,y:236},
  {id:'ia',k:'fn',fn:'Index Array',ins:['array'],outs:['狀態','異常碼'],x:850,y:100,h:40},
  {id:'k2',k:'const',t:'i32',v:2,x:860,y:180},
  {id:'ge',k:'fn',fn:'Greater Or Equal?',x:910,y:110},
  {id:'tk',k:'fn',fn:'Tick Count (ms)',x:820,y:250},
  {id:'sub',k:'fn',fn:'Subtract',x:880,y:256},
  {id:'klim',k:'const',t:'u32',v:3000,x:880,y:300,label:'逾時 ms（依距離算）'},
  {id:'gt',k:'fn',fn:'Greater?',x:960,y:262},
  {id:'or',k:'fn',fn:'Or',x:1010,y:200},
  {id:'wt',k:'fn',fn:'Wait (ms)',x:960,y:40},
  {id:'k50',k:'const',t:'i32',v:50,x:910,y:40},
  {id:'cond',k:'stop',s:'wl'},
  {id:'tst',k:'tunnel',t:'i32',s:'wl',side:'r',y:180},
  {id:'tto',k:'tunnel',t:'bool',s:'wl',side:'r',y:270},
  {id:'k0',k:'const',t:'i32',v:0,x:1120,y:340,label:'0 ＝ 收到了'},
  {id:'k9',k:'const',t:'i32',v:9,x:1120,y:300,label:'9 ＝ 停止'},
  {id:'sel',k:'fn',fn:'Select',x:1180,y:300},
  {id:'wc2',k:'sub',name:'FX_WriteD.vi：D304 ＝ 0（或逾時送 9）',icon:['WRITE','D'],ins:['D','Value'],outs:['error out'],x:1220,y:200,w:56,h:56,color:'#5a6b7d'},
  {id:'kd4b',k:'const',t:'i32',v:304,x:1150,y:220},
  {id:'st',k:'ind',t:'i32',label:'D310 狀態',x:1140,y:110}],
  wires:[
  {id:'a1',from:'x',to:'m1.x',t:'dbl',mx:95},
  {id:'a2',from:'kp',to:'m1.y',t:'dbl',mx:95},
  {id:'a3',from:'y',to:'m2.x',t:'dbl',mx:95},
  {id:'a4',from:'kp',to:'m2.y',t:'dbl',mx:100},
  {id:'a5',from:'m1.out',to:'r1',t:'dbl'},{id:'a6',from:'r1.out',to:'i1',t:'dbl'},
  {id:'a7',from:'m2.out',to:'r2',t:'dbl'},{id:'a8',from:'r2.out',to:'i2',t:'dbl'},
  {id:'a9',from:'i1.out',to:'px',t:'i32',mx:255},
  {id:'a10',from:'i1.out',to:'sp',t:'i32'},
  {id:'a11',from:'sp.hi(x)',to:'hi',t:'i16',mx:340},
  {id:'a12',from:'sp.lo(x)',to:'lo',t:'i16',mx:345},
  {id:'b1',from:'i1.out',to:'w32.I32',t:'i32',pts:[[240,66],[255,66],[255,150],[380,150]]},
  {id:'b2',from:'kd0',to:'w32.D',t:'i32',mx:365},
  {id:'b3',from:'visa',to:'w32.VISA in',t:'visa',pts:[[60,228],[300,228],[300,110],[380,110]]},
  {id:'b4',from:'w32.VISA out',to:'w32b.VISA in',t:'visa'},
  {id:'b5',from:'w32.error out',to:'w32b.error in',t:'err'},
  {id:'b6',from:'i2.out',to:'w32b.I32',t:'i32',pts:[[240,146],[250,146],[250,172],[455,172],[455,150],[470,150]]},
  {id:'b7',from:'kd2',to:'w32b.D',t:'i32',mx:458},
  {id:'b8',from:'w32b.VISA out',to:'wc.VISA in',t:'visa'},
  {id:'b9',from:'w32b.error out',to:'wc.error in',t:'err'},
  {id:'b10',from:'kd4',to:'wc.D',t:'i32',mx:556},
  {id:'b11',from:'k1',to:'wc.Value',t:'i32',mx:560},
  {id:'c1',from:'wc.VISA out',to:'tv.o',t:'visa'},
  {id:'c2',from:'wc.error out',to:'te.o',t:'err'},
  {id:'c3',from:'tk0.millisecond timer value',to:'tt.o',t:'u32'},
  {id:'c4',from:'tv.i',to:'rd.VISA in',t:'visa'},
  {id:'c5',from:'te.i',to:'rd.error in',t:'err',mx:750},
  {id:'c6',from:'kd10',to:'rd.D',t:'i32',mx:754},
  {id:'c7',from:'k2c',to:'rd.Count',t:'i32',mx:758},
  {id:'c8',from:'rd.Words',to:'ia',t:'i32[]'},
  {id:'c9',from:'ia.狀態',to:'ge.x',t:'i32',mx:895},
  {id:'c10',from:'k2',to:'ge.y',t:'i32',mx:900},
  {id:'c11',from:'tk.millisecond timer value',to:'sub.x',t:'u32',mx:868},
  {id:'c12',from:'tt.i',to:'sub.y',t:'u32',mx:860},
  {id:'c13',from:'sub.out',to:'gt.x',t:'u32',mx:945},
  {id:'c14',from:'klim',to:'gt.y',t:'u32',mx:948},
  {id:'c15',from:'ge.out',to:'or.x',t:'bool',mx:990},
  {id:'c16',from:'gt.out',to:'or.y',t:'bool',mx:995},
  {id:'c17',from:'or.out',to:'cond',t:'bool'},
  {id:'c18',from:'k50',to:'wt',t:'i32'},
  {id:'c19',from:'ia.狀態',to:'tst.i',t:'i32',mx:895},
  {id:'c20',from:'gt.out',to:'tto.i',t:'bool',mx:1050},
  {id:'d1',from:'tst.o',to:'st',t:'i32'},
  {id:'d2',from:'tto.o',to:'sel.s',t:'bool',mx:1150},
  {id:'d3',from:'k9',to:'sel.t',t:'i32',mx:1165},
  {id:'d4',from:'k0',to:'sel.f',t:'i32',mx:1168},
  {id:'d5',from:'sel.out',to:'wc2.Value',t:'i32',mx:1212},
  {id:'d6',from:'kd4b',to:'wc2.D',t:'i32',mx:1205}]},
 sim:{init:()=>({}),
  step(inp){
   const px=Math.round((+inp.x||0)*1000),n=+inp.scv||0;
   const hi=px>>16,lo=((px&0xffff)<<16)>>16;
   const st=[2,3,3,1][n],code=[0,1,3,0][n],ms=[620,60,60,3050][n];
   const res=n===0?'到位完成：讀目前位置記錄，寫 D304 ＝ 0':n===1?'PLC 拒絕：未回原點。顯示「請先原點復歸」，寫 D304 ＝ 0':n===2?'PLC 拒絕：Z 軸未上升。這是流程錯誤，停下來通知工程師':'逾時：送 D304 ＝ 9（停止），報警，這一格判 ERROR';
   return {out:{px,hi,lo,st,code,ms,res},
    vals:{'m1.out':px,'i1.out':px,'sp.hi(x)':hi,'sp.lo(x)':lo,'ia.狀態':st,'ia.異常碼':code,'sub.out':ms,'ge.out':st>=2,'gt.out':n===3,'or.out':true,'sel.out':n===3?9:0},
    msg:'X '+(+inp.x).toFixed(3)+' mm ＝ '+px+' 脈波 → 高位 '+hi+'、低位 '+lo+(px>32767?'（超過 32767：只寫低位字，PLC 會讀成 '+lo+'）':'')+'。'+res};},
  doneMsg:'改 X 或 PLC 那邊的情況再 Run'}
};

L.push({id:'W20',order:30.9991,no:'W20',part:PART,title:'XY 平台定位：先回原點、PLC 守住互鎖、到位才算完成，LabVIEW 只負責座標和流程',mins:80,files:['練習\\實務\\Station\\XY_Move.vi','練習\\實務\\Station\\tray_2x2.json'],
goals:[['學會','PC、PLC、驅動器怎麼分工；為什麼開機一定要先回原點；硬體極限、軟體極限、急停各放在哪裡；「Z 軸沒上升不准動 XY」這種互鎖要放在 PLC；指令位置、回授位置、到位信號的差別；32 位元的目標要寫兩個字；用交握下定位命令、輪詢到完成、算逾時；教點和從同一個方向接近；加減速和節拍。'],['做出','在托盤模擬上讓五種錯誤都被擋下或被發現；XY_Move.vi：mm 換成脈波、寫兩個 32 位元目標、最後寫命令、輪詢到完成或逾時、清命令。'],['為什麼是這個題目','PLC 和設備的職缺常寫「伺服控制開發」「馬達與驅動器控制（伺服、步進）」「運動規劃、座標轉換」。這些職缺幾乎都是 PLC 或機器人的工作，沒有一則寫「用 LabVIEW 控制軸卡」：最常見的分工就是這一課的「PLC 定位、上位機下命令」。']],
check:'不看課文，能說出為什麼要先回原點、哪些保護不能只放在 LabVIEW、「脈波送完」和「到位」的差別、超過 32767 個脈波要怎麼寫，以及交握的順序和逾時。',
body:[
C.h3('這一課的工作','x','會動的東西'),
`<p>前面的測試站，最危險的事是「判錯」。這一課的機台會動：最危險的事是<b>撞</b>。程式寫錯，壞的不再只是一筆資料，而是探針、治具、板子，甚至人的手。所以這一課的重點不是怎麼讓它動，而是<b>什麼情況下不准它動、誰來擋</b>。</p>`,
C.h3('① 聽懂需求','','生產主管的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「W18 的燒錄站一次只能放一片，作業員一直換板子。做一台有 XY 平台的：托盤一次放 4 片（2×2），平台帶著燒錄探針頭一片一片移過去，氣缸壓下去燒、燒完抬起來換下一片。作業員只要換托盤。」</p></div>`,
ask('為什麼不用一個治具一次壓 4 片、4 台燒錄器同時燒？',
 `<p>也可以，那是「四頭並行」：最快，但要 4 台燒錄器、4 組探針、治具也大。這台的做法是一套燒錄器、一個探針頭，靠平台移動：比較便宜，換產品時只要改座標表（像 W11 的配方），代價是四片一片一片燒，比較慢。這是 W16 的節拍取捨，要和生產主管一起算。</p>
 <p>另外，同一片板子上的好幾個點，產線會用針床治具一次壓下去（W6、W10）；用 XY 平台一點一點去壓，是飛針測試機的做法，很慢，只適合少量多樣。這一課的平台移動的是「片和片之間」，不是同一片上的點。</p>`),
C.h3('② 分工','','誰負責什麼'),
C.table(['功能','放哪裡','為什麼'],[
 ['急停、安全門','安全繼電器（硬體接線），PLC 只讀它的狀態','不能依賴任何程式；切斷動力的不能是軟體'],
 ['硬體極限','驅動器的正反轉極限輸入（例如三菱的 LSP、LSN），常閉接點','原點錯、程式錯都擋得住；線斷了也等於到極限'],
 ['軟體極限、「沒回原點不准動」、「Z 軸沒上升不准動 XY」','PLC','電腦當機、LabVIEW 寫錯時還有效（和 W11「保護邏輯放 PLC」一樣）'],
 ['原點復歸、定位、到位判斷','PLC ＋ 伺服驅動器','脈波要準時送，Windows 做不到'],
 ['座標表、流程、燒錄、紀錄、畫面','LabVIEW','會改、要記錄的東西']
]),
warn('「Z 軸沒上升不准動 XY」一定要在 PLC','探針頭壓著板子時橫移，會刮壞板子、撞斷探針。這一條如果只寫在 LabVIEW 的流程裡，流程寫錯一次就撞了。PLC 裡的互鎖：Z 軸的上升感測器 ON，才准執行 XY 移動。LabVIEW 也要檢查，但它是第二道。'),
C.h3('③ 盤點','','FX3S 能做什麼'),
C.table(['項目','FX3S（電晶體輸出）','注意'],[
 ['軸數','2 軸：Y000、Y001，脈波＋方向','Y002 只有 FX3U 系列能當脈波輸出'],
 ['最高頻率','每軸 100 kHz','每 mm 1000 脈波時，最快 100 mm／s：解析度和速度是取捨'],
 ['原點復歸','DSZR（DOG 加 Z 相）、ZRN','ZRN 在 FX3S 上不做 DOG 搜尋；要從 DOG 的哪一側開始，看手冊'],
 ['定位','DRVA（絕對）、DRVI（相對）、PLSV（變速）；32 位元用 DDRVA','FX3S 沒有中斷定位 DVIT、沒有表格定位 DTBL'],
 ['完成旗標','M8029（指令執行完成），多個指令共用','接點要放在<b>那個指令的正下方</b>，否則別的指令會把它關掉；中途停止時 M8029 不會 ON，異常結束旗標會 ON'],
 ['輸出型式','接三菱伺服要用漏型（sink）輸出','型號後綴 MT/ES 是漏型、MT/ESS 是源型：接線前和硬體手冊、驅動器的脈波輸入設定再確認一次']
]),
note('特殊暫存器的編號要自己核對','目前值、最高速度、爬行速度、加減速時間這些特殊暫存器（D8340 起）和旗標的編號，網路上找得到的多半是 FX3U／FX3G 手冊。FX3S 看起來相同，但寫程式前一定要在 FX3S 的定位手冊上核對一次。'),
C.table(['I/O','用途','點數'],[
 ['輸出','X、Y 脈波 2、方向 2；Z 軸氣缸電磁閥 1','5'],
 ['輸入','X、Y 的 DOG 2；Z 上、下感測器 2；X、Y 驅動器警報 2；X、Y 到位 INP 2；急停狀態 1','9'],
 ['','FX3S-20M 是 12 入 8 出：剩下的點不多，再加按鈕、指示燈就不夠了','實際上常要加擴充，或換 FX3U']
]),
C.h3('④ 原點、極限、到位','','三個觀念'),
`<p><b>原點</b>：PLC 的目前值（D8340）只是「從開機起送出去幾個脈波」。斷過電、PLC 重開、急停、驅動器警報之後，這個數字和平台實際的位置就沒有關係了。所以：</p>
<ul><li>每次開機都要先<b>原點復歸</b>（DSZR：往原點方向走，碰到 DOG 減速到爬行速度，DOG 離開後第一個 Z 相信號就停）。</li>
<li>PLC 有一個「已回原點（Homed）」旗標。斷電、急停、驅動器警報都要把它清掉；它沒有 ON，PLC 拒絕任何移動命令。雙龍門專案（L15～L17）的 Homed 和原點步序就是這個。</li>
<li>原點復歸要有逾時：最長行程 ÷ 回原點速度，再加餘裕。失敗時停下、報警，人用寸動（L17 的 D107）把軸移到 DOG 的另一側，再重回原點。</li></ul>
<p><b>到位</b>：有三種「位置」。指令位置是 PLC 送出去的脈波數；回授位置是馬達編碼器回報的實際位置；兩者的差叫偏差。伺服在偏差小於「到位範圍」時，才輸出到位信號（INP）。所以<b>「脈波送完」不等於到了</b>：伺服可能還在追，或被卡住追不上。PLC 判斷「完成」要同時看：該軸的完成旗標、INP ON、沒有警報。</p>
<p><b>精度</b>：重複精度是「每次回到同一點，分散多大」；定位精度是「到的地方離目標多遠」。探針要壓在 1 mm 左右的測試點上，靠的是重複精度。固定的偏差可以用<b>教點</b>吃掉：用寸動把探針頭對準第一片的測試點，記下座標，而不是直接用圖面的座標。每次都<b>從同一個方向</b>接近目標，可以避開螺桿的背隙。</p>`,
C.h3('⑤ 先在托盤模擬上試','','五種會撞、會錯的情況'),
`<p>先選一種情況、所有保護都不勾，看會發生什麼事；再一項一項勾上去，看哪一項擋住了它。目標：每一種情況，都是<b>被擋下（什麼都沒壞）</b>或<b>被發現</b>，而不是撞機或默默做錯。</p>`,
{fn:stageFig},
ask('「只寫了低位字」為什麼會變成 105.5 mm？',
 `<p>40.000 mm × 1000 ＝ 40000 個脈波，超過 16 位元的 32767，要用兩個字（D300 低位、D301 高位），PLC 用 32 位元的 DDRVA。舊程式只寫了 D300，D301 裡還留著上一次的 1：PLC 讀到的是 1 × 65536 ＋ 40000 ＝ 105536。</p>
 <p>反過來，如果 PLC 用的是 16 位元的 DRVA，40000 會被讀成 −25536，平台往反方向衝。兩種錯都要靠<b>驗收時用一個大於 32767 的目標測一次</b>，平常只跑小座標根本看不出來。軟體極限是最後一道：它擋得住「超出範圍」的錯，擋不住「在範圍內但是錯」的錯。</p>`),
ask('步進馬達失步，為什麼 PLC 和 LabVIEW 都不知道？',
 `<p>步進馬達是開迴路：PLC 送了脈波，就假設它走到了，沒有編碼器回報，也沒有 INP。負載太重、加速太快、遇到共振，少走了幾步，誰也不知道，一直錯到下一次回原點。</p>
 <p>對策：加速放緩、避開共振的轉速；定期回原點，回原點時比對「應該送幾個脈波才碰到原點」和實際的差（模擬裡的最後一項）；要求高的話改用閉迴路步進或伺服。</p>`),
ask('沒回原點時，軟體極限為什麼也擋不住？',
 `<p>軟體極限是拿「PLC 以為自己在哪」去比。原點不對，PLC 以為的位置就是錯的，它以為還在範圍內，其實已經衝出去了。所以軟體極限只能放在硬體極限的<b>內側</b>當第一道限制，最後還是要靠硬體極限；而「沒回原點不准動」是讓軟體極限有意義的前提。</p>`),
C.h3('⑥ 寫程式','','XY_Move.vi'),
C.table(['位址','誰寫','內容'],[
 ['D300、D301','LabVIEW','目標 X，32 位元，單位是脈波，低位字在前'],
 ['D302、D303','LabVIEW','目標 Y，32 位元'],
 ['D304','LabVIEW','命令：0 無、1 移動到目標、2 原點復歸、9 停止'],
 ['D310','PLC','狀態：0 待命、1 移動中、2 完成、3 異常'],
 ['D311','PLC','異常碼：1 未回原點、2 超出軟體極限、3 Z 軸未上升、4 異常結束、5 驅動器警報'],
 ['D312～D315','PLC','目前位置 X、Y（指令位置）']
]),
`<p>交握照 W11、W13 的規則：<b>資料先放好、再舉旗子；對方回應了才放下旗子；開始前確認上一次已經結束；逾時就當失敗</b>。新的只有兩件：PLC 收到命令會先檢查前置條件，不合格就<b>拒絕並回報原因、不偷偷修正</b>；「完成」是實際到位，不是脈波送完。（位址和 W7 的 D200～D203、W11 的 D210～D222 不重疊。）</p>`,
{steps:{title:'XY_Move.vi：mm → 脈波 → 寫目標 → 寫命令 → 輪詢 → 清命令',lv:mvv,steps:[
 {t:'mm 換成脈波',view:'split',add:['x','y','kp','m1','m2','a1','a2','a3','a4','r1','r2','a5','a6','a7','a8','i1','i2','px','a9'],h:`<p>脈波數 ＝ mm × 每 mm 脈波數（導程 10 mm、每轉 10000 脈波 → 1000）。先 Round To Nearest，再 To Long Integer（I32）：直接轉型會截掉小數，39.9996 mm 會少一個脈波。</p><p>每 mm 脈波數放在設定檔，和驅動器的電子齒輪比一起寫進交機文件：有人改了驅動器參數、這裡沒改，就是「單位換算錯」的撞機。</p>`},
 {t:'32 位元拆成兩個字',view:'split',add:['sp','a10','hi','a11','lo','a12'],h:`<p>Split Number 把 I32 拆成高位（hi）、低位（lo）兩個 16 位元的字。40000 個脈波：高位 0、低位 −25536（同樣的 16 個位元，當有號數看就是負的）。PLC 用 DDRVA 把 D300、D301 當成一個 32 位元的數，就是 40000。</p><p>Write32.vi 裡面就是這一步加兩次 FX_WriteD（L14）：先寫低位 D，再寫高位 D＋1。</p>`},
 {t:'寫目標，最後寫命令',view:'split',add:['visa','w32','kd0','b1','b2','b3','w32b','kd2','b4','b5','b6','b7','wc','kd4','k1','b8','b9','b10','b11'],h:`<p>錯誤線把順序排好：X 目標 → Y 目標 → <b>最後</b>才寫 D304 ＝ 1。FX_WriteD 一次只寫一個字，兩軸的目標要寫好幾次；命令最後寫，PLC 看到命令時，四個字都已經放好了。</p><p>開始之前還要先讀一次 D310，確認是 0（待命）：上一次的交握已經結束。（圖上省略，和 W13 的 ⓪ 一樣。）</p>`},
 {t:'輪詢到完成或逾時',view:'split',add:['wl','tk0','tv','te','tt','c1','c2','c3','rd','kd10','k2c','c4','c5','c6','c7','ia','c8','k2','ge','c9','c10','tk','sub','c11','c12','klim','gt','c13','c14','or','c15','c16','cond','c17','wt','k50','c18'],h:`<p>每 50 ms 讀一次 D310、D311（FX_ReadD 一次讀 2 個字）。狀態 ≥ 2（完成或異常）就離開迴圈。</p><p>逾時：迴圈前記下 Tick Count，每一圈相減。逾時要<b>依距離算</b>：距離 ÷ 速度 ＋ 加減速時間，乘 2 再加 1 秒。固定寫 10 秒，短的移動卡住要等很久才發現；寫太短，長的移動會被誤判。</p>`},
 {t:'清命令',view:'split',add:['tst','tto','c19','c20','st','d1','code','ms','res','scv','k0','k9','sel','d2','d3','d4','wc2','kd4b','d5','d6'],h:`<p>完成或異常：讀目前位置記錄下來，寫 D304 ＝ 0，表示「收到了」；PLC 看到 0，把 D310 清回 0。逾時：寫 D304 ＝ 9（停止），報警，這一格判 ERROR。</p><p>狀態 3 時，D311 的異常碼要轉成中文顯示給作業員（W17 的代碼對照表）。1「未回原點」：提示按原點復歸；3「Z 軸未上升」：這是 LabVIEW 流程的錯，停下來通知工程師。</p>`},
 {t:'Run',view:'split',add:[],h:`<p>先用 X ＝ 40、正常 Run：看 40000 被拆成高位 0、低位 −25536。再試 PLC 拒絕和逾時。最後把 X 改成 30（30000，沒超過 32767）：高位 0，低位就是 30000。<b>32.767 mm 以下，只寫低位也剛好對</b>：這就是為什麼這個錯平常看不出來。</p>`}
]}},
C.h3('⑦ 主流程和節拍','','一盤四片'),
C.table(['步驟','做什麼','約幾秒'],[
 ['0','開機：原點復歸（還沒回原點就不能按開始）','—'],
 ['1','讀座標表（托盤型號、教點日期、4 個點；W11 的 JSON）','—'],
 ['2','每一格：XY_Move.vi 到測試點','距離 ÷ 速度 ＋ 加減速；30 mm 約 0.4 秒'],
 ['3','Z 下壓，等下限感測器 ON（有逾時）','0.3'],
 ['4','燒錄（W18 的 Flash.vi）、讀版本，記錄這一格的結果（W9）','8～15'],
 ['5','Z 上升，等上限感測器 ON（有逾時）','0.3'],
 ['6','四格做完：回待命點；每盤或每 N 盤回原點，比對偏差','—']
]),
`<p>移動時間的估法：滾珠螺桿導程 10 mm、每轉 10000 脈波，每 mm 1000 脈波；FX3S 最高 100 kHz → 最快 100 mm／s。移動 50 mm、加速時間 0.1 秒：約 0.5 ＋ 0.1 ＝ 0.6 秒。四格的移動加起來不到 3 秒，燒錄才是大頭：和 W16 一樣，先量每一步的時間，再決定要不要改成兩頭並行。</p>`,
note('加減速','FX3S 的定位指令是直線（梯形）加減速，加速時間、減速時間各有一個特殊暫存器。加速度突然改變容易讓平台振動，到位前要多等；伺服驅動器通常有「位置指令濾波」的參數可以讓它平滑一點。加速時間不是越短越好：振動、失步（步進）、到位等待都會變多。'),
C.table(['常見事故','原因','預防'],[
 ['撞機：沒回原點就動','開機或斷電後位置不明','PLC：Homed 沒 ON 拒絕移動；斷電、急停、警報後清掉 Homed'],
 ['撞機：座標系錯','換了托盤或治具沒重新教點','座標表帶托盤型號和教點日期；換托盤後第一盤用慢速跑'],
 ['撞機：單位換算錯','mm 和脈波搞混、驅動器齒輪比改了、32 位元只寫一半','換算係數放設定檔、寫進交機文件；驗收用大於 32767 的目標；軟體極限'],
 ['Z 軸壓著時橫移','沒確認上升感測器就移動','PLC 互鎖'],
 ['失步','步進馬達開迴路','加速放緩、定期回原點比對、改閉迴路'],
 ['斷電後位置不明','增量式編碼器、步進、PLC 目前值斷電就沒了','開機一律回原點；絕對式編碼器要監視電池']
]),
note('這一課用到的前面的東西','L13、L14 的 FX_ReadD／FX_WriteD，L15～L17 的原點、Homed、D106 命令和 D107 點動，W7 的位址配置表和 32 位元，W11 的「保護放 PLC」和配方，W13 的交握，W16 的節拍，W17 的異常代碼對照，W18 的燒錄。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'為什麼開機一定要先回原點？',o:['PLC 的目前值只是送出去的脈波數，斷電後和實際位置無關','讓馬達暖機','規定','校正速度'],a:0,ex:'增量式編碼器和步進都一樣。'},
 {q:'「Z 軸沒上升不准動 XY」應該放在哪裡？',o:['PLC（LabVIEW 也檢查，當第二道）','只放 LabVIEW','只放在作業指導書','不用做'],a:0,ex:'程式寫錯、電腦當機時還要有效。'},
 {q:'急停應該由誰切斷動力？',o:['安全繼電器的硬體接線','LabVIEW','PLC 程式','作業員'],a:0,ex:'切斷動力的不能是軟體。'},
 {q:'「脈波送完」為什麼不等於到位？',o:['伺服可能還在追或被卡住；要看到位信號 INP','脈波會遺失','PLC 會算錯','一定等於'],a:0,ex:'完成要看完成旗標＋INP＋沒有警報。'},
 {q:'目標 40000 個脈波，只寫了低位字，PLC 用 16 位元讀會變成？',o:['−25536','40000','0','32767'],a:0,ex:'超過 32767 就要兩個字。'},
 {q:'下定位命令的順序？',o:['確認待命 → 寫目標 → 最後寫命令','先寫命令再寫目標','同時寫','只寫命令'],a:0,ex:'資料先放好再舉旗子。'},
 {q:'軟體極限在沒回原點時為什麼擋不住？',o:['它比的是 PLC 以為的位置，原點錯了這個位置就是錯的','它太慢','它只擋 Y 軸','它會自動關掉'],a:0,ex:'所以還要硬體極限，和「沒回原點不准動」。'},
 {q:'教點的目的？',o:['用實際對準的座標，吃掉固定的定位誤差','讓作業員學習','加快速度','不用回原點'],a:0,ex:'重複精度好，就能靠教點。'},
 {q:'逾時應該怎麼定？',o:['依距離和速度算，再加餘裕','固定 10 秒','不要逾時','越短越好'],a:0,ex:'固定值不是太長就是太短。'}
]}
]});
})();
