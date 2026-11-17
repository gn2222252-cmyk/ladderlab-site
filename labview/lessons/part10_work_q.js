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
 ['lo','LabVIEW 的舊程式只寫低位字；上一次寸動送過負座標，高位字還是 0xFFFF（第 3 格目標 40.000 mm）'],
 ['noz','流程寫錯：第 2 格燒完忘了送「Z 上升」就去下一格'],
 ['step','步進馬達：第 2 格之後失步，往 X 少走了 0.6 mm'],
 ['inp','伺服的到位範圍設得很嚴（等 INP 時每次多等 1.2 秒）']
];
const PCK=[['H','PLC：沒回原點，拒絕移動'],['S','PLC：軟體極限（0～60 mm）'],['Z','PLC：Z 軸上升感測器 ON 才准動 XY'],['I','PLC：「完成」要等伺服的到位信號 INP'],['R','LabVIEW：每盤結束回原點，檢查回來時偏了多少']];
const CELLS=[[10,10],[40,10],[10,40],[40,40]];
function runTray(sc,c){
  const L=[];let t=0,crash=false,ok=0,bad=0;const pts=[];
  const mv=d=>0.1+d/100+0.15+(sc==='inp'&&c.I?1.2:0);
  let pos=[0,0];
  const R=(stop)=>({L,pts,t,crash,ok,bad,stop});
  if(sc==='nohome'){
    if(c.H){L.push(['g','第 1 格：PLC 拒絕，異常碼 1「未回原點」。LabVIEW 顯示「請先按原點復歸」，什麼都沒動']);return R('拒絕');}
    L.push(['r','PLC 不知道自己在哪：目前值是 0，但平台其實停在昨天的 (35, 22)。照座標走，每一格都偏了一大段']);
    L.push(['r','第 1 格：探針頭實際停在 (45, 32)，偏了 41 mm，氣缸照樣壓下去，壓在第 4 片板子的零件上：探針歪了，板子壓傷。軟體極限沒有用：PLC 以為自己在 (10, 10)']);
    crash=true;pts.push([45,32,'x']);t+=mv(14)+0.3;return R('撞機');
  }
  for(let i=0;i<4;i++){
    let tgt=CELLS[i].slice();
    if(sc==='lo'&&i===2){
      if(c.S){L.push(['g','第 3 格：高位 0xFFFF、低位 40000 合起來是 −25536 個脈波（−25.5 mm），超出軟體極限。PLC 拒絕，異常碼 2；LabVIEW 停下來，顯示目標值']);return R('拒絕');}
      L.push(['r','第 3 格：目標變成 −25.5 mm，平台往反方向衝，撞到負方向的硬體極限才停（驅動器的 LSN），探針頭撞到托盤外框']);crash=true;pts.push([0,40,'x']);return R('撞機');
    }
    if(sc==='noz'&&i===2){
      if(c.Z){L.push(['g','第 3 格：PLC 拒絕，異常碼 3「Z 軸未上升」。探針頭還壓在第 2 片上，什麼都沒動。LabVIEW 顯示流程錯誤']);return R('拒絕');}
      L.push(['r','第 3 格：探針頭還壓在第 2 片上就橫移：探針斷了兩根，第 2 片板子刮傷']);crash=true;pts.push([25,25,'x']);return R('撞機');
    }
    const d=Math.hypot(tgt[0]-pos[0],tgt[1]-pos[1]);t+=mv(d);
    let act=tgt.slice();
    if(sc==='step'&&i>=2)act=[tgt[0]-0.6,tgt[1]];
    pos=tgt;t+=0.6;            // Z 下、上
    const off=Math.hypot(act[0]-tgt[0],act[1]-tgt[1]);
    pts.push([act[0],act[1],off>0.3?'b':'o']);
    if(off>0.3){bad++;L.push(['r','第 '+(i+1)+' 格：探針偏了 '+off.toFixed(1)+' mm，沒壓到測試點，燒錄回「No target」（W18 的 BF8 重試兩次也一樣）'+(sc==='step'?'。步進馬達沒有到位信號，PLC 和 LabVIEW 都以為到了':'')]);t+=10;}
    else{ok++;t+=8;}
  }
  if(sc==='inp')L.push([c.I?'y':'r',c.I?'每一次移動都等到 INP 才算完成，四格多了將近 5 秒。到位範圍要配合需要的精度設，不是越嚴越好（W16 的節拍）':'沒有等 INP：PLC 送完脈波就回「完成」，比較快，但伺服還在追，探針在平台還在動的時候壓下去。這次剛好都對到，但<b>沒有保證</b>：等 INP 是用時間換保證']);
  if(sc==='step'){if(c.R)L.push(['y','盤子跑完回原點：平台實際比 PLC 以為的更靠近原點，原點感測器提早 0.6 mm 就碰到了。LabVIEW 比對後報警「回原點偏差 0.6 mm」，停機檢查。第 3、4 片已經 FAIL，但下一盤不會再錯']);else L.push(['r','沒有人知道失步了：下一盤、下下一盤，第 3、4 格都 FAIL。作業員以為是板子的問題']);}
  return R('');
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
const SCV=['正常','PLC 拒絕：未回原點（異常碼 1）','PLC 拒絕：Z 軸未上升（異常碼 3）','卡住：一直沒有完成（逾時）','通訊斷了（FX_ReadD 出錯）'];
const mvv={name:'XY_Move.vi',view:'split',ratio:1.5,
 fp:{w:360,h:300,items:[
  {id:'x',k:'num',ctl:true,label:'X mm',x:12,y:8,w:60,v:40,inc:1,dig:3},
  {id:'y',k:'num',ctl:true,label:'Y mm',x:100,y:8,w:60,v:10,inc:1,dig:3},
  {id:'scv',k:'enum',ctl:true,label:'PLC 那邊（模擬用）',options:SCV,x:190,y:8,v:0},
  {id:'px',k:'num',label:'X 脈波（I32）',x:12,y:70,w:80},
  {id:'hi',k:'num',label:'D301（高位，U16）',x:120,y:70,w:60},
  {id:'lo',k:'num',label:'D300（低位，U16）',x:220,y:70,w:70},
  {id:'st',k:'num',label:'D310 狀態',x:12,y:140,w:50},
  {id:'code',k:'num',label:'D311 異常碼',x:110,y:140,w:50},
  {id:'ms',k:'num',label:'等了幾 ms',x:210,y:140,w:70},
  {id:'res',k:'str',label:'結果',x:12,y:200,w:330}]},
 bd:{w:1320,h:470,structs:[{id:'wl',k:'while',x:700,y:20,w:400,h:380}],
  nodes:[
  {id:'x',k:'ctl',t:'dbl',label:'X mm',x:20,y:40},
  {id:'y',k:'ctl',t:'dbl',label:'Y mm',x:20,y:130},
  {id:'kp',k:'const',t:'dbl',v:1000,x:20,y:86,label:'脈波／mm'},
  {id:'m1',k:'fn',fn:'Multiply',x:110,y:50},
  {id:'m2',k:'fn',fn:'Multiply',x:110,y:130},
  {id:'i1',k:'fn',fn:'To Long Integer',x:180,y:50},
  {id:'i2',k:'fn',fn:'To Long Integer',x:180,y:130},
  {id:'px',k:'ind',t:'i32',label:'X 脈波',x:250,y:10},
  {id:'sp',k:'fn',fn:'Split Number',x:260,y:50,h:40},
  {id:'hi',k:'ind',t:'u16',label:'D301',x:340,y:0},
  {id:'lo',k:'ind',t:'u16',label:'D300',x:430,y:40},
  {id:'w32',k:'sub',name:'Write32.vi（Split Number ＋ 兩次 FX_WriteD：低位 D、高位 D＋1，兩個都寫）',icon:['WR','32'],ins:['VISA in','D','I32','error in'],outs:['VISA out','error out'],x:380,y:100,w:56,h:70,color:'#5a6b7d'},
  {id:'kd0',k:'const',t:'i32',v:300,x:330,y:190},
  {id:'w32b',k:'sub',name:'Write32.vi（Y：D302、D303）',icon:['WR','32'],ins:['VISA in','D','I32','error in'],outs:['VISA out','error out'],x:470,y:100,w:56,h:70,color:'#5a6b7d'},
  {id:'kd2',k:'const',t:'i32',v:302,x:430,y:200},
  {id:'wc',k:'sub',name:'FX_WriteD.vi（L14）：命令最後寫',icon:['WRITE','D'],ins:['VISA in','D','Value','error in'],outs:['VISA out','error out'],x:570,y:100,w:56,h:70,color:'#5a6b7d'},
  {id:'kd4',k:'const',t:'i32',v:304,x:520,y:200},
  {id:'k1',k:'const',t:'i32',v:1,x:540,y:240,label:'1 ＝ 移動'},
  {id:'visa',k:'ctl',t:'visa',label:'VISA（L13）',x:20,y:220},
  {id:'tk0',k:'sub',name:'Tick_err.vi（W16：有 error 線的 Tick Count，接在寫完命令之後）',icon:['⏱','err'],ins:['error in'],outs:['ms','error out'],x:632,y:250,w:50,h:44,color:'#5a6b7d'},
  {id:'tv',k:'tunnel',t:'visa',s:'wl',side:'l',y:110},
  {id:'se',k:'sr',t:'err',s:'wl',y:150},
  {id:'tt',k:'tunnel',t:'u32',s:'wl',side:'l',y:262},
  {id:'rd',k:'sub',name:'FX_ReadD.vi（L13）：D310 起讀 2 個字',icon:['READ','D'],ins:['VISA in','D','Count','error in'],outs:['VISA out','Words','error out'],x:770,y:90,w:60,h:80,color:'#5a6b7d'},
  {id:'kd10',k:'const',t:'i32',v:310,x:712,y:200},
  {id:'k2c',k:'const',t:'i32',v:2,x:712,y:236},
  {id:'ia',k:'fn',fn:'Index Array',ins:['array'],outs:['狀態','異常碼'],x:850,y:100,h:40},
  {id:'k2',k:'const',t:'u16',v:2,x:860,y:180},
  {id:'ge',k:'fn',fn:'Greater Or Equal?',x:910,y:110},
  {id:'tk',k:'fn',fn:'Tick Count (ms)',x:790,y:200},
  {id:'sub',k:'fn',fn:'Subtract',x:880,y:256},
  {id:'klim',k:'const',t:'u32',v:3000,x:870,y:300,label:'逾時 ms（依距離算）'},
  {id:'gt',k:'fn',fn:'Greater?',x:930,y:262},
  {id:'or',k:'fn',fn:'Or',x:975,y:200},
  {id:'ub',k:'fn',fn:'Unbundle By Name',outs:['status'],x:960,y:330},
  {id:'or2',k:'fn',fn:'Or',x:1020,y:290},
  {id:'wt',k:'fn',fn:'Wait (ms)',x:960,y:40},
  {id:'k50',k:'const',t:'i32',v:50,x:910,y:40},
  {id:'cond',k:'stop',s:'wl'},
  {id:'tst',k:'tunnel',t:'u16',s:'wl',side:'r',y:180},
  {id:'tto',k:'tunnel',t:'bool',s:'wl',side:'r',y:250},
  {id:'k0',k:'const',t:'i32',v:0,x:1130,y:380,label:'0 ＝ 收到了'},
  {id:'k9',k:'const',t:'i32',v:9,x:1130,y:330,label:'9 ＝ 停止'},
  {id:'sel',k:'fn',fn:'Select',x:1190,y:310},
  {id:'wc2',k:'sub',name:'FX_WriteD.vi：D304 ＝ 0（或逾時送 9）',icon:['WRITE','D'],ins:['D','Value','error in'],outs:['error out'],x:1240,y:200,w:56,h:64,color:'#5a6b7d'},
  {id:'kd4b',k:'const',t:'i32',v:304,x:1160,y:230},
  {id:'st',k:'ind',t:'u16',label:'D310 狀態',x:1150,y:110}],
  wires:[
  {id:'a1',from:'x',to:'m1.x',t:'dbl',mx:95},
  {id:'a2',from:'kp',to:'m1.y',t:'dbl',mx:95},
  {id:'a3',from:'y',to:'m2.x',t:'dbl',mx:95},
  {id:'a4',from:'kp',to:'m2.y',t:'dbl',mx:100},
  {id:'a5',from:'m1.out',to:'i1',t:'dbl'},
  {id:'a7',from:'m2.out',to:'i2',t:'dbl'},
  {id:'a9',from:'i1.out',to:'px',t:'i32',mx:235},
  {id:'a10',from:'i1.out',to:'sp',t:'i32'},
  {id:'a11',from:'sp.hi(x)',to:'hi',t:'u16',mx:325},
  {id:'a12',from:'sp.lo(x)',to:'lo',t:'u16',mx:330},
  {id:'b1',from:'i1.out',to:'w32.I32',t:'i32',pts:[[210,66],[240,66],[240,150],[380,150]]},
  {id:'b2',from:'kd0',to:'w32.D',t:'i32',mx:365},
  {id:'b3',from:'visa',to:'w32.VISA in',t:'visa',pts:[[60,228],[300,228],[300,110],[380,110]]},
  {id:'b4',from:'w32.VISA out',to:'w32b.VISA in',t:'visa'},
  {id:'b5',from:'w32.error out',to:'w32b.error in',t:'err'},
  {id:'b6',from:'i2.out',to:'w32b.I32',t:'i32',pts:[[210,146],[230,146],[230,172],[455,172],[455,150],[470,150]]},
  {id:'b7',from:'kd2',to:'w32b.D',t:'i32',mx:458},
  {id:'b8',from:'w32b.VISA out',to:'wc.VISA in',t:'visa'},
  {id:'b9',from:'w32b.error out',to:'wc.error in',t:'err'},
  {id:'b10',from:'kd4',to:'wc.D',t:'i32',mx:556},
  {id:'b11',from:'k1',to:'wc.Value',t:'i32',mx:560},
  {id:'c1',from:'wc.VISA out',to:'tv.o',t:'visa'},
  {id:'c2',from:'wc.error out',to:'tk0.error in',t:'err',mx:629},
  {id:'c2b',from:'tk0.error out',to:'se.init',t:'err',mx:692},
  {id:'c3',from:'tk0.ms',to:'tt.o',t:'u32',mx:688},
  {id:'c4',from:'tv.i',to:'rd.VISA in',t:'visa'},
  {id:'c5',from:'se.L',to:'rd.error in',t:'err',mx:750},
  {id:'c6',from:'kd10',to:'rd.D',t:'i32',mx:754},
  {id:'c7',from:'k2c',to:'rd.Count',t:'i32',mx:758},
  {id:'c8',from:'rd.Words',to:'ia',t:'u16[]'},
  {id:'c9',from:'ia.狀態',to:'ge.x',t:'u16',mx:895},
  {id:'c10',from:'k2',to:'ge.y',t:'u16',mx:900},
  {id:'c11',from:'tk.millisecond timer value',to:'sub.x',t:'u32',mx:868},
  {id:'c12',from:'tt.i',to:'sub.y',t:'u32',mx:860},
  {id:'c13',from:'sub.out',to:'gt.x',t:'u32',mx:920},
  {id:'c14',from:'klim',to:'gt.y',t:'u32',mx:922},
  {id:'c15',from:'ge.out',to:'or.x',t:'bool',mx:960},
  {id:'c16',from:'gt.out',to:'or.y',t:'bool',mx:968},
  {id:'e1',from:'rd.error out',to:'se.R',t:'err',pts:[[836,162],[846,162],[846,392],[1092,392],[1092,150]]},
  {id:'e2',from:'rd.error out',to:'ub',t:'err',pts:[[836,162],[846,162],[846,346],[960,346]]},
  {id:'e3',from:'or.out',to:'or2.x',t:'bool',mx:1012},
  {id:'e4',from:'ub.status',to:'or2.y',t:'bool',mx:1018},
  {id:'c17',from:'or2.out',to:'cond',t:'bool',mx:1058},
  {id:'c18',from:'k50',to:'wt',t:'i32'},
  {id:'c19',from:'ia.狀態',to:'tst.i',t:'u16',mx:895},
  {id:'c20',from:'gt.out',to:'tto.i',t:'bool',mx:1030},
  {id:'d1',from:'tst.o',to:'st',t:'u16'},
  {id:'d2',from:'tto.o',to:'sel.s',t:'bool',mx:1160},
  {id:'d3',from:'k9',to:'sel.t',t:'i32',mx:1175},
  {id:'d4',from:'k0',to:'sel.f',t:'i32',mx:1178},
  {id:'d5',from:'sel.out',to:'wc2.Value',t:'i32',mx:1230},
  {id:'d6',from:'kd4b',to:'wc2.D',t:'i32',mx:1225},
  {id:'d7',from:'se.out',to:'wc2.error in',t:'err',mx:1220}]},
 sim:{init:()=>({}),
  step(inp){
   const px=Math.round((+inp.x||0)*1000),n=+inp.scv||0;
   const hi=(px>>>16)&0xffff,lo=px&0xffff,s16=lo>32767?lo-65536:lo;
   const st=[2,3,3,1,0][n],code=[0,1,3,0,0][n],ms=[620,60,60,3050,50][n];
   const res=n===0?'到位完成：讀目前位置記錄，寫 D304 ＝ 0':n===1?'PLC 拒絕：未回原點。顯示「請先原點復歸」，寫 D304 ＝ 0':n===2?'PLC 拒絕：Z 軸未上升。這是流程錯誤，停下來通知工程師':n===3?'逾時：送 D304 ＝ 9（停止），報警，這一格判 ERROR':'通訊錯誤：第一圈就從錯誤離開迴圈（不用等到逾時），錯誤碼留下來顯示；平台狀態不明，停機、通知工程師';
   return {out:{px,hi,lo,st,code,ms,res},
    vals:{'m1.out':px,'i1.out':px,'sp.hi(x)':hi,'sp.lo(x)':lo,'ia.狀態':st,'ia.異常碼':code,'sub.out':ms,'ge.out':st>=2,'gt.out':n===3,'or.out':st>=2||n===3,'ub.status':n===4,'or2.out':true,'sel.out':n===3?9:0},
    msg:'X '+(+inp.x).toFixed(3)+' mm ＝ '+px+' 脈波 → 高位 '+hi+'、低位 '+lo+'（兩個 U16，兩個都寫）。'+(px>32767?'低位 '+lo+' 超過 32767：如果 PLC 用 16 位元的 DRVA 只讀 D300，會當成 '+s16+'。':'')+res};},
  doneMsg:'改 X 或 PLC 那邊的情況再 Run'}
};

L.push({id:'W20',order:30.9991,no:'W20',part:PART,title:'XY 平台定位：先回原點、PLC 守住互鎖、到位才算完成，LabVIEW 只負責座標和流程',mins:80,files:['練習\\實務\\Station\\XY_Move.vi','練習\\實務\\Station\\tray_2x2.json'],
goals:[['學會','PC、PLC、驅動器怎麼分工；為什麼開機一定要先回原點；硬體極限、軟體極限、急停各放在哪裡；「Z 軸沒上升不准動 XY」這種互鎖要放在 PLC；指令位置、回授位置、到位信號的差別；32 位元的目標要寫兩個字；用交握下定位命令、輪詢到完成、算逾時；教點和從同一個方向接近；加減速和節拍。'],['做出','在托盤模擬上讓五種錯誤都被擋下或被發現；XY_Move.vi：mm 換成脈波、寫兩個 32 位元目標、最後寫命令、輪詢到完成或逾時、清命令。'],['為什麼是這個題目','PLC 和設備的職缺常寫「伺服控制開發」「馬達與驅動器控制（伺服、步進）」「運動規劃、座標轉換」。這些職缺幾乎都是 PLC 或機器人的工作，沒有一則寫「用 LabVIEW 控制軸卡」：最常見的分工就是這一課的「PLC 定位、上位機下命令」。']],
check:'不看課文，能說出為什麼要先回原點、哪些保護不能只放在 LabVIEW、「脈波送完」和「到位」的差別、超過 32767 個脈波要怎麼寫，以及交握的順序和逾時。',
body:[
C.h3('這一課的工作','x','會動的東西'),
`<p>這一台叫 <b>FL02</b>，test_id 開頭是 <code>FL02-</code>（W1 的共同設定表）。前面的測試站，最危險的事是「判錯」。這一課的機台會動：最危險的事是<b>撞</b>。程式寫錯，壞的不再只是一筆資料，而是探針、治具、板子，甚至人的手。所以這一課的重點不是怎麼讓它動，而是<b>什麼情況下不准它動、誰來擋</b>。</p>`,
tip('練習檔','下載：<a href="work/tray_2x2.json" download>tray_2x2.json</a>。tray_2x2.json 是 W20 的座標表：托盤型號、教點日期、每 mm 脈波數、接近方向和四個點。'),
C.h3('① 聽懂需求','','生產主管的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「W18 的燒錄站（FL01）一次只能放一片，作業員一直換板子。做一台有 XY 平台的：托盤一次放 4 片（2×2），平台帶著燒錄探針頭一片一片移過去，氣缸壓下去燒、燒完抬起來換下一片。作業員只要換托盤。」</p></div>`,
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
 ['輸出','X、Y 脈波 2、方向 2；Z 軸氣缸電磁閥 1；伺服 ON（兩軸可以共用）1；原點復歸後清偏差的 CLEAR 信號（看驅動器的接法）0～2','約 7'],
 ['輸入','X、Y 的 DOG 2；Z 相 2；Z 上、下感測器 2；X、Y 驅動器警報 2；X、Y 到位 INP 2；急停狀態 1；開始、原點復歸按鈕 2','約 13'],
 ['','FX3S-20M 是 12 入 8 出：<b>已經不夠</b>','實際上要加擴充，或換 FX3U']
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
ask('「只寫了低位字」為什麼會往反方向衝？',
 `<p>目標用兩個字：D300 低位、D301 高位，PLC 用 32 位元的 DDRVA 讀。上一次有人寸動時送過一個負座標，負數的高位字是 0xFFFF，一直留在 D301。這次舊程式只寫了 D300 ＝ 40000：PLC 讀到的是 0xFFFF 和 40000 合起來的 −25536，平台往反方向衝。</p>
 <p>這個平台只有 0～60 mm，正常的目標高位都是 0：只寫低位平常<b>剛好對</b>，所以這個錯一直沒被發現，直到有人送過負座標。解法是兩個字都寫。軟體極限是最後一道：它擋得住「超出範圍」的錯，擋不住「在範圍內但是錯」的錯。</p>`),
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
`<p>交握照 W11、W13 的規則：<b>資料先放好、再舉旗子；對方回應了才放下旗子；開始前確認上一次已經結束；逾時就當失敗</b>。新的只有兩件：PLC 收到命令會先檢查前置條件，不合格就<b>拒絕並回報原因、不偷偷修正</b>；「完成」是實際到位，不是脈波送完。（位址和 W7 的 D200～D203、W11 的 D210～D222 不重疊；D300 起在 FX3S 的停電保持區之外，斷電會清 0：命令和狀態本來就不該在斷電後留著，正好。）注意：第 6 部分的雙龍門 Host_Main 也用了 D300～D315，意思完全不同（步序和計數）。位址是<b>每一台機台各自</b>的配置表，換一台機台就要重新對一次，不能看到 D300 就以為是同一個東西（W7 的位址配置表）。</p>`,
{steps:{title:'XY_Move.vi：mm → 脈波 → 寫目標 → 寫命令 → 輪詢 → 清命令',lv:mvv,steps:[
 {t:'mm 換成脈波',view:'split',add:['x','y','kp','m1','m2','a1','a2','a3','a4','a5','a7','i1','i2','px','a9'],h:`<p>脈波數 ＝ mm × 每 mm 脈波數（導程 10 mm、每轉 10000 脈波 → 1000）。To Long Integer 轉成 I32：它會<b>四捨五入</b>到最接近的整數（剛好 .5 時取偶數，13.5 → 14、14.5 → 14），39.9996 mm 會變成 40000。換成 C 或 Python 寫，<code>int()</code> 是直接截掉小數的，會少一個脈波：換語言時要注意。</p><p>每 mm 脈波數放在設定檔，和驅動器的電子齒輪比一起寫進交機文件：有人改了驅動器參數、這裡沒改，就是「單位換算錯」的撞機。</p>`},
 {t:'32 位元拆成兩個字',view:'split',add:['sp','a10','hi','a11','lo','a12'],h:`<p>Split Number 把 I32 拆成高位（hi）、低位（lo）兩個 <b>U16</b>（無號）。40000 個脈波：高位 0、低位 40000，直接接到 FX_WriteD 的 Value（也是 U16）。PLC 用 DDRVA 把 D300、D301 當成一個 32 位元的數，就是 40000。</p><p>同一組 16 個位元，當有號數看是 −25536：如果 PLC 錯用了 16 位元的 DRVA 只讀 D300，或你在 GX Works2 用有號顯示，看到的就是 −25536。</p><p>Write32.vi 裡面就是這一步加兩次 FX_WriteD（L14）：先寫低位 D，再寫高位 D＋1。<b>高位是 0 也要寫</b>：D301 裡可能還留著上一次的值（例如負座標留下的 0xFFFF）。</p>`},
 {t:'寫目標，最後寫命令',view:'split',add:['visa','w32','kd0','b1','b2','b3','w32b','kd2','b4','b5','b6','b7','wc','kd4','k1','b8','b9','b10','b11'],h:`<p>錯誤線把順序排好：X 目標 → Y 目標 → <b>最後</b>才寫 D304 ＝ 1。FX_WriteD 一次只寫一個字，兩軸的目標要寫好幾次；命令最後寫，PLC 看到命令時，四個字都已經放好了。</p><p>開始之前還要先讀一次 D310，確認是 0（待命）：上一次的交握已經結束。（圖上省略，和 W13 的 ⓪ 一樣。）</p>`},
 {t:'輪詢到完成或逾時',view:'split',add:['wl','tk0','tv','se','tt','c1','c2','c2b','c3','rd','kd10','k2c','c4','c5','c6','c7','ia','c8','k2','ge','c9','c10','tk','sub','c11','c12','klim','gt','c13','c14','or','c15','c16','e1','e2','ub','e3','e4','or2','cond','c17','wt','k50','c18'],h:`<p>每 50 ms 讀一次 D310、D311（FX_ReadD 一次讀 2 個字，Words 是 U16 陣列）。狀態 ≥ 2（完成或異常）就離開迴圈。</p><p>錯誤線走 Shift Register：通訊斷了，FX_ReadD 的錯誤留到下一圈，也接到停止條件（Unbundle 出 status 再 Or）：<b>第一次出錯就離開</b>，不用等到逾時，錯誤碼也看得到。</p><p>迴圈前的起始時間用一個有 error 線的 Tick Count（W16 講過的寫法），接在寫完命令之後：一般的 Tick Count 沒有輸入，LabVIEW 可能在寫目標之前就先執行它，時間就算錯了。</p><p>逾時：迴圈前記下 Tick Count，每一圈相減。逾時要<b>依距離算</b>：距離 ÷ 速度 ＋ 加減速時間，乘 2 再加 1 秒。固定寫 10 秒，短的移動卡住要等很久才發現；寫太短，長的移動會被誤判。</p>`},
 {t:'清命令',view:'split',add:['tst','tto','c19','c20','st','d1','code','ms','res','scv','k0','k9','sel','d2','d3','d4','wc2','kd4b','d5','d6','d7'],h:`<p>完成或異常：讀目前位置記錄下來，寫 D304 ＝ 0，表示「收到了」；PLC 看到 0，把 D310 清回 0。逾時：寫 D304 ＝ 9（停止），報警，這一格判 ERROR。</p><p>和 L17 的 D106 不一樣：D106 是 PLC 收到就自己清 0，只告訴你「收到了」；D304 要等 PLC 回報「做完了、結果如何」，所以由 LabVIEW 看到結果之後才清。</p><p>狀態 3 時，D311 的異常碼要轉成中文顯示給作業員（W17 的代碼對照表）。1「未回原點」：提示按原點復歸；3「Z 軸未上升」：這是 LabVIEW 流程的錯，停下來通知工程師。</p>`},
 {t:'Run',view:'split',add:[],h:`<p>先用 X ＝ 40、正常 Run：40000 被拆成高位 0、低位 40000。再試 PLC 拒絕、逾時、通訊斷了。</p><p>32 位元有兩種不同的錯，驗收時要分別測：</p><ul><li><b>PLC 用了 16 位元的 DRVA</b>：只讀 D300，超過 32767（32.767 mm）才出錯，40000 會變成 −25536。小座標都對，所以平常看不出來。驗收時用一個<b>大於 32767 的目標</b>測。</li><li><b>LabVIEW 只寫低位字</b>：高位字是上一次留下的。上一次是正的小座標（高位 0）就剛好對；上一次送過負座標（高位 0xFFFF），這次 40000 就變成 −25536，小座標也會錯。驗收時先送一個<b>負目標</b>，再送正目標。</li></ul>`}
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
 {q:'目標 40000 個脈波，PLC 卻用 16 位元的 DRVA 只讀 D300，會變成？',o:['−25536','40000','0','32767'],a:0,ex:'超過 32767 就要兩個字、用 DDRVA。'},
 {q:'Split Number 把 I32 的 40000 拆開，低位是？',o:['40000（U16）','−25536','0','400'],a:0,ex:'輸出是無號的 U16；−25536 是同樣的位元當有號數看。'},
 {q:'To Long Integer 把 39999.6 轉成？',o:['40000（四捨五入）','39999（截斷）','錯誤','39999.6'],a:0,ex:'LabVIEW 的轉換是四捨五入；C、Python 的 int() 才是截斷。'},
 {q:'下定位命令的順序？',o:['確認待命 → 寫目標 → 最後寫命令','先寫命令再寫目標','同時寫','只寫命令'],a:0,ex:'資料先放好再舉旗子。'},
 {q:'軟體極限在沒回原點時為什麼擋不住？',o:['它比的是 PLC 以為的位置，原點錯了這個位置就是錯的','它太慢','它只擋 Y 軸','它會自動關掉'],a:0,ex:'所以還要硬體極限，和「沒回原點不准動」。'},
 {q:'教點的目的？',o:['用實際對準的座標，吃掉固定的定位誤差','讓作業員學習','加快速度','不用回原點'],a:0,ex:'重複精度好，就能靠教點。'},
 {q:'逾時應該怎麼定？',o:['依距離和速度算，再加餘裕','固定 10 秒','不要逾時','越短越好'],a:0,ex:'固定值不是太長就是太短。'}
]}
]});
})();
