/* 實務案例 W7：設備稼動監控。LabVIEW 只「讀」PLC（L13 的 FX_ReadD.vi），算稼動率、記錄每一次停機、班別報表。
   職缺對照（docs/job_research.md）：設備資料收集、串 MES 回傳生產資料、HMI、PLC + PC 程式。
   OEE ＝ 可用率 × 效能 × 良率 是業界通用的定義；各工廠對「計畫停機」怎麼扣不一樣，課文要求學生去問。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;

const ST=['待機','自動運轉','異常停機','計畫停機'];
const STC=['#e0b100','#2e9d48','#d64541','#7d8fa8'];
const CODES={1:'E01 卡料',2:'E02 缺包材',3:'E03 封口溫度低'};
const IDEAL=2.0; // 標準週期 秒／包

/* ---- 圖：一個班的稼動監控（時間加速） ---- */
function oeeSim(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<p style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 6px">
   <button type="button" class="btn" data-k="go">開始</button>
   <button type="button" class="btn" data-k="reset">重來</button>
   速度 <select data-k="sp"><option value="60">1 秒 ＝ 1 分鐘</option><option value="240" selected>1 秒 ＝ 4 分鐘</option><option value="600">1 秒 ＝ 10 分鐘</option></select>
   <button type="button" class="btn" data-k="jam">現在卡料</button>
   <label><input type="checkbox" data-k="cut"> 通訊線拔掉</label>
   <label><input type="checkbox" data-k="wrap"> PLC 計數從 65 500 開始</label></p>
  <p style="font-size:13px;margin:2px 0">班別 08:00～12:00（10:00～10:10 休息）　現在 <b data-o="clk">08:00:00</b>　PLC 狀態 <b data-o="pst">－</b>　電腦看到的 <b data-o="mst">－</b></p>
  <canvas data-o="tl" width="600" height="34" style="width:100%;max-width:600px;height:34px;background:#eef1f5;border:1px solid #c5ced8;display:block"></canvas>
  <p style="font-size:12px;color:#556;margin:2px 0 8px">${ST.map((s,i)=>`<span style="display:inline-block;width:10px;height:10px;background:${STC[i]};margin:0 3px 0 8px"></span>${s}`).join('')}<span style="display:inline-block;width:10px;height:10px;background:#333;margin:0 3px 0 8px"></span>通訊中斷（不知道）</p>
  <div style="display:flex;flex-wrap:wrap;gap:16px">
   <div style="flex:1 1 260px" data-o="bars"></div>
   <div style="flex:1 1 260px;font-size:13px" data-o="cnt"></div></div>
  <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:8px">
   <div style="flex:1 1 300px"><p style="font-size:12px;color:#556;margin:0 0 2px">停機紀錄（最新的在上面）</p><table class="tbl" style="width:100%;font-size:12px" data-o="ev"></table></div>
   <div style="flex:1 1 220px"><p style="font-size:12px;color:#556;margin:0 0 2px">停機原因排行（分鐘，只算有看到的秒數）</p><div data-o="par"></div></div></div>
  <p data-o="rep" style="font:12px Consolas,monospace;white-space:pre;background:#fff;border:1px solid #ccd;padding:6px;margin-top:8px;overflow:auto"></p>`;
  const o=k=>el.querySelector('[data-o='+k+']'),q=k=>el.querySelector('[data-k='+k+']');
  const tl=o('tl').getContext('2d');
  let S,timer=null;
  const hms=s=>{const t=8*3600+s;return [Math.floor(t/3600),Math.floor(t/60)%60,t%60].map(x=>String(x).padStart(2,'0')).join(':');};
  function init(){
    const st=q('wrap').checked?65500:1200;
    S={t:0,run:false,plc:{st:1,code:0,good:st,ng:Math.floor(st/50),prog:0,until:0},
       pc:{first:null,prevG:null,prevN:null,good:0,ng:0,tSt:[0,0,0,0],unk:0,last:-1,ev:[],open:null,naive:0,startG:st,codeSec:{}}};
    tl.clearRect(0,0,600,34);draw();
  }
  function plcSecond(){
    const P=S.plc,t=S.t;
    if(t>=7200&&t<7800){P.st=3;P.code=0;return;}
    if(P.st===3&&t>=7800)P.st=1;
    if(P.st===2){if(t>=P.until){P.st=1;P.code=0;}return;}
    if(P.st===1){
      if(Math.random()<1/1400)fault(Math.random()<0.6?1:Math.random()<0.62?2:3);
      if(P.st!==1)return;
      P.prog+=1/2.25;
      if(P.prog>=1){P.prog-=1;if(Math.random()<0.02)P.ng=(P.ng+1)&0xFFFF;else P.good=(P.good+1)&0xFFFF;}
    }
  }
  function fault(c){const P=S.plc;P.st=2;P.code=c;const d={1:[120,300],2:[300,540],3:[180,420]}[c];P.until=S.t+d[0]+Math.random()*(d[1]-d[0]);}
  function pcSecond(){
    const C=S.pc,P=S.plc;
    if(q('cut').checked){C.unk++;C.last=-2;if(C.open)C.open.unsure=true;return -2;}
    // 讀到 D200 狀態、D201 異常碼、D202 良品、D203 不良（U16）
    if(C.prevG===null){C.prevG=P.good;C.prevN=P.ng;}
    const dg=(P.good-C.prevG)&0xFFFF,dn=(P.ng-C.prevN)&0xFFFF;C.prevG=P.good;C.prevN=P.ng;C.good+=dg;C.ng+=dn;
    C.naive=P.good-C.startG;
    C.tSt[P.st]++;if(P.st===2&&P.code)C.codeSec[P.code]=(C.codeSec[P.code]||0)+1;
    if(P.st!==C.last){
      if(C.open&&P.st!==2){C.open.end=S.t;C.open=null;}
      if(P.st===2&&!C.open){C.open={start:S.t,code:P.code,end:null};C.ev.unshift(C.open);}
    }
    C.last=P.st;return P.st;
  }
  function tick(){
    if(!document.body.contains(el)){clearInterval(timer);return;}
    if(!S.run)return;
    const n=Math.round(+q('sp').value/10);
    for(let i=0;i<n&&S.t<14400;i++){
      plcSecond();const m=pcSecond();
      const x=Math.floor(S.t*600/14400);tl.fillStyle=m===-2?'#333':STC[m];tl.fillRect(x,0,1,34);
      S.t++;
    }
    if(S.t>=14400){S.run=false;q('go').textContent='開始';if(S.pc.open){S.pc.open.end=S.t;S.pc.open=null;}}
    draw();
  }
  function calc(){
    const C=S.pc,plan=C.tSt[0]+C.tSt[1]+C.tSt[2],run=C.tSt[1],tot=C.good+C.ng;
    const A=plan?run/plan:0,Pf=run?tot*IDEAL/run:0,Q=tot?C.good/tot:0;
    return {plan,run,tot,A,Pf,Q,oee:A*Pf*Q};
  }
  function draw(){
    const C=S.pc,P=S.plc,r=calc(),pc=x=>(x*100).toFixed(1)+' %';
    o('clk').textContent=hms(S.t);o('pst').textContent=ST[P.st]+(P.code?'（'+CODES[P.code]+'）':'');
    o('mst').textContent=C.last===-2?'通訊中斷':C.last<0?'－':ST[C.last];
    const bar=(n,v,c)=>`<div style="font-size:13px;margin:3px 0">${n} <b>${pc(v)}</b><div style="height:9px;background:#e3e7ec;border-radius:3px"><div style="height:9px;width:${Math.min(100,v*100)}%;background:${c};border-radius:3px"></div></div></div>`;
    o('bars').innerHTML=bar('可用率（運轉 ÷ 計畫時間）',r.A,'#2e9d48')+bar('效能（產量 × 2.0 s ÷ 運轉時間）'+(r.Pf>1?'　<b style="color:#b8860b">超過 100 %：運轉時間少算了（通訊中斷）</b>':''),r.Pf,r.Pf>1?'#e0b100':'#2f6fd0')+bar('良率（良品 ÷ 總產量）',r.Q,'#8e44ad')+bar('OEE（三個相乘）',r.oee,'#d35400');
    const m=s=>(s/60).toFixed(1);
    o('cnt').innerHTML=`<p>計畫時間 <b>${m(r.plan)}</b> 分（休息 ${m(C.tSt[3])} 分不算）<br>運轉 <b>${m(r.run)}</b>　異常停機 <b>${m(C.tSt[2])}</b>　待機 <b>${m(C.tSt[0])}</b>　通訊中斷 <b>${m(C.unk)}</b> 分</p>
    <p>本班良品 <b>${C.good}</b>　不良 <b>${C.ng}</b>（用差值累加，對的）<br>PLC D202 現在 <b>${P.good}</b>（U16）<br>「D202 減開班時的值」＝ <b style="color:${C.naive<0?'#c0392b':'inherit'}">${C.naive}</b>${C.naive<0?'　← 計數器繞回 0 了，這樣算是錯的':''}</p>`;
    o('ev').innerHTML='<tr><th>開始</th><th>結束</th><th>分鐘</th><th>原因</th></tr>'+C.ev.slice(0,8).map(e=>`<tr><td>${hms(e.start)}</td><td>${e.end==null?'停機中':hms(e.end)+(e.unsure?'（中間斷線，不確定）':'')}</td><td>${(((e.end==null?S.t:e.end)-e.start)/60).toFixed(1)}</td><td>${CODES[e.code]||'?'}</td></tr>`).join('');
    const sum={};Object.keys(C.codeSec).forEach(k=>sum[k]=C.codeSec[k]/60);
    const ks=Object.keys(sum).sort((a,b)=>sum[b]-sum[a]),mx=Math.max(1,...Object.values(sum));
    o('par').innerHTML=ks.length?ks.map(k=>`<div style="font-size:12px;margin:3px 0">${CODES[k]} ${sum[k].toFixed(1)}<div style="height:9px;width:${sum[k]/mx*100}%;background:#d64541;border-radius:3px"></div></div>`).join(''):'<p style="font-size:12px;color:#889">還沒有停機</p>';
    o('rep').textContent='班別報表（每班一列）\n日期,班別,計畫分,運轉分,停機分,停機次數,通訊中斷分,良品,不良,可用率,效能,良率,OEE\n'+
      [new Date().toISOString().slice(0,10),'早班 08-12',m(r.plan),m(r.run),m(C.tSt[2]),C.ev.length,m(C.unk),C.good,C.ng,pc(r.A),pc(r.Pf),pc(r.Q),pc(r.oee)].join(',')+(S.t>=14400?'\n（班別結束，這一列寫進檔案）':'');
  }
  q('go').onclick=()=>{if(S.t>=14400)init();S.run=!S.run;q('go').textContent=S.run?'暫停':'開始';};
  q('reset').onclick=()=>{S.run=false;q('go').textContent='開始';init();};
  q('jam').onclick=()=>{if(S.plc.st===1)fault(1);};
  q('wrap').onchange=()=>{S.run=false;q('go').textContent='開始';init();};
  init();timer=setInterval(tick,100);
}

/* ---- 一步一步寫：計數器差值累加（含讀取失敗） ---- */
const cv={name:'Count.vi',view:'split',ratio:2.2,
 fp:{w:330,h:250,items:[
  {id:'rate',k:'num',ctl:true,label:'機台速度（每圈多幾包，模擬用）',x:12,y:8,w:60,v:3,inc:1},
  {id:'fail',k:'btn',style:'toggle',mech:'switch',label:'讀取失敗（拔線，模擬）',x:200,y:8,v:false},
  {id:'start',k:'num',ctl:true,label:'PLC 的 D202 一開始是（模擬用）',x:12,y:58,w:70,v:65530,inc:1,rep:'U16'},
  {id:'raw',k:'num',label:'Index Array 拿到的值',x:12,y:118,w:70},
  {id:'delta',k:'num',label:'這一圈多了幾包',x:170,y:118,w:60},
  {id:'total',k:'num',label:'本班產量',x:12,y:172,w:80},
  {id:'quit',k:'btn',label:'stop',text:'停止',stop:true,x:200,y:178}]},
 bd:{w:900,h:330,structs:[{id:'wl',k:'while',x:140,y:10,w:740,h:300}],
  nodes:[
  {id:'kD',k:'const',t:'u16',v:202,x:160,y:36},
  {id:'kC',k:'const',t:'u16',v:1,x:174,y:70},
  {id:'rd',k:'sub',name:'FX_ReadD.vi（L13 做的）',top:'FX',icon:['READ D'],ins:['VISA in','D','Count'],outs:['VISA out','Words','error out'],x:220,y:30,w:64,h:56,tip:'VISA 的線這裡省略'},
  {id:'ia',k:'fn',fn:'Index Array',x:320,y:54},
  {id:'raw',k:'ind',t:'u16',label:'D202',x:430,y:24},
  {id:'ub',k:'fn',fn:'Unbundle By Name',outs:['status'],x:300,y:100},
  {id:'not',k:'fn',fn:'Not',x:410,y:102},
  {id:'k0a',k:'const',t:'u16',v:0,x:100,y:141},
  {id:'sr1',k:'sr',t:'u16',s:'wl',y:150},
  {id:'sub',k:'fn',fn:'Subtract',x:480,y:87},
  {id:'sel2',k:'fn',fn:'Select',x:760,y:120},
  {id:'k0c',k:'const',t:'bool',v:false,x:100,y:201},
  {id:'sr3',k:'sr',t:'bool',s:'wl',y:210},
  {id:'and',k:'fn',fn:'And',x:480,y:180},
  {id:'or',k:'fn',fn:'Or',x:560,y:220},
  {id:'kz',k:'const',t:'u16',v:0,x:500,y:288},
  {id:'sel',k:'fn',fn:'Select',x:560,y:150},
  {id:'delta',k:'ind',t:'u16',label:'這一圈多了幾包',x:640,y:100},
  {id:'k0b',k:'const',t:'u32',v:0,x:100,y:261},
  {id:'sr2',k:'sr',t:'u32',s:'wl',y:270},
  {id:'add',k:'fn',fn:'Add',x:660,y:190},
  {id:'total',k:'ind',t:'u32',label:'本班產量',x:760,y:180},
  {id:'kms',k:'const',t:'i32',v:1000,x:576,y:286},
  {id:'wt',k:'fn',fn:'Wait (ms)',x:630,y:274},
  {id:'quit',k:'ctl',t:'bool',label:'stop',x:780,y:288},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w1',from:'kD',to:'rd.D',t:'u16',mx:205},
  {id:'w2',from:'kC',to:'rd.Count',t:'u16',mx:210},
  {id:'w3',from:'rd.Words',to:'ia.array',t:'u16[]',mx:305},
  {id:'w4',from:'ia.element',to:'raw',t:'u16',mx:395},
  {id:'e1',from:'rd.error out',to:'ub',t:'err',mx:292},
  {id:'e2',from:'ub.status',to:'not',t:'bool'},
  {id:'w0a',from:'k0a',to:'sr1.init',t:'u16'},
  {id:'w5',from:'ia.element',to:'sub.x',t:'u16',mx:395},
  {id:'w6',from:'sr1.L',to:'sub.y',t:'u16',mx:465},
  {id:'p1',from:'sr1.L',to:'sel2.t',t:'u16',pts:[[465,150],[465,127],[760,127]]},
  {id:'p2',from:'ub.status',to:'sel2.s',t:'bool',pts:[[370,116],[370,136],[760,136]]},
  {id:'p3',from:'ia.element',to:'sel2.f',t:'u16',pts:[[395,70],[395,140],[748,140],[748,145],[760,145]]},
  {id:'p4',from:'sel2.out',to:'sr1.R',t:'u16',mx:860},
  {id:'w0c',from:'k0c',to:'sr3.init',t:'bool'},
  {id:'v1',from:'sr3.L',to:'and.x',t:'bool',mx:460},
  {id:'v2',from:'not.out',to:'and.y',t:'bool',mx:448},
  {id:'v3',from:'sr3.L',to:'or.x',t:'bool',pts:[[460,210],[460,227],[560,227]]},
  {id:'v4',from:'not.out',to:'or.y',t:'bool',pts:[[448,116],[448,241],[560,241]]},
  {id:'v5',from:'or.out',to:'sr3.R',t:'bool',pts:[[850,234],[850,210],[874,210]]},
  {id:'w9',from:'sub.out',to:'sel.t',t:'u16',mx:545},
  {id:'w10',from:'and.out',to:'sel.s',t:'bool',mx:535},
  {id:'w11',from:'kz',to:'sel.f',t:'u16',mx:550},
  {id:'w12',from:'sel.out',to:'delta',t:'u16',mx:610},
  {id:'w13',from:'sel.out',to:'add.x',t:'u16',mx:615},
  {id:'w0b',from:'k0b',to:'sr2.init',t:'u32'},
  {id:'w14',from:'sr2.L',to:'add.y',t:'u32',mx:640},
  {id:'w15',from:'add.out',to:'sr2.R',t:'u32',mx:720},
  {id:'w16',from:'add.out',to:'total',t:'u32',mx:720},
  {id:'w17',from:'kms',to:'wt',t:'i32'},
  {id:'w18',from:'quit',to:'cond',t:'bool'}]},
 sim:{period:400,init:()=>({plc:null,prev:0,valid:false,total:0}),
  step(inp,st){
   const start=(+inp.start||0)&0xFFFF,err=!!inp.fail;
   if(st.plc===null){st.plc=start;st.start=start;}else st.plc=(st.plc+(+inp.rate||0))&0xFFFF;
   const raw=err?0:st.plc,prev=st.prev,valid=st.valid,diff=(raw-prev)&0xFFFF,use=valid&&!err,delta=use?diff:0;
   st.total+=delta;st.prev=err?prev:raw;st.valid=valid||!err;const naive=st.plc-st.start;
   return {out:{raw,delta,total:st.total},stop:!!inp.quit,
    vals:{kD:202,kC:1,'rd.Words':err?'[ ]（空的）':'['+raw+']','ia.element':raw,'ub.status':err,'not.out':!err,'sr1.L':prev,'sub.out':diff,'sel2.out':st.prev,'sr3.L':valid,'and.out':use,'or.out':st.valid,kz:0,'sel.out':delta,'sr2.L':st.total-delta,'add.out':st.total,kms:1000,k0a:0,k0b:0,k0c:false,quit:!!inp.quit},
    msg:(err?'讀取失敗：Index Array 給 0，'+(0-prev&0xFFFF)+' 這種大數不能算；這一圈不算，上一次的值 '+prev+' 保留':(valid?'D202 ＝ '+raw+'；U16 相減 '+raw+' − '+prev+' ＝ '+diff:'第一次讀到有效值 '+raw+'，只當作「上一次」，不算產量'))+'｜本班 '+st.total+'｜PLC 真正多了：'+((st.plc-st.start)&0xFFFF)};},
  doneMsg:'停止'}
};

L.push({id:'W07',order:30.987,no:'W7',part:PART,title:'設備稼動監控：讀 PLC 的狀態和計數，算稼動率、記錄每一次停機、出班別報表',mins:80,files:['練習\\實務\\Monitor\\Monitor.vi','練習\\實務\\Monitor\\Count.vi'],
goals:[['學會','監控程式只讀不寫；先拿到 PLC 的記憶體配置表；16 位元計數器會繞回 0，用 U16 差值累加；第一次讀取和讀取失敗的陷阱；PLC 重開會不會清計數；狀態改變才記一筆（停機開始、結束）；可用率、效能、良率、OEE 怎麼算、要先問工廠的定義；通訊中斷的時間要記成「不知道」，不能算成停機；班別報表。'],['做出','Count.vi（計數器差值累加）和整個監控程式的規劃；在模擬的一個班上看 OEE、停機紀錄和原因排行。'],['為什麼是這個題目','設備、自動化職缺常寫「收集設備資料」「串接 MES 回傳生產資料」「PLC 與 PC 程式」。這一課接在 L12～L14（和 PLC 通訊）後面，把讀到的數字變成主管看得懂的資訊。']],
check:'不看課文，能說出計數器繞回 0、通訊中斷、PLC 重開時各怎麼算才對、為什麼通訊中斷不能算停機、OEE 的三個部分各怎麼算，以及監控程式為什麼不寫 PLC。',
body:[
C.h3('① 聽懂需求','','廠長的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「包裝機一天到底停多久、為什麼停，大家講的都不一樣。PLC 裡面不是有計數和狀態嗎？做一個畫面放在辦公室，每天給我一張報表。」</p></div>`,
ask('開始寫之前要問哪些事？',
 `<ol><li><b>PLC 裡哪個位址放什麼？</b>去找寫 PLC 的人要<b>記憶體配置表</b>（哪個 D 是狀態、哪個是異常碼、計數放哪裡、是 16 還是 32 位元）。不要自己猜，也不要自己去改 PLC 程式。問到的答案見下一段。</li>
 <li><b>「稼動率」怎麼算？</b>每個工廠的定義不一樣：休息時間扣不扣？換料算不算停機？沒有訂單的待機算不算？問清楚、寫下來，主管簽名。</li>
 <li><b>多久要更新？</b>答案：畫面 1 秒；報表每班一張。</li>
 <li><b>可以從電腦改 PLC 的東西嗎？</b>答案：這一版<b>只讀不寫</b>。（理由見下面。）</li>
 <li><b>通訊埠空著嗎？</b>PLC 的通訊埠可能已經接了觸控螢幕。要接哪一個埠、用什麼通訊方式，跟設備廠確認。</li>
 <li><b>電腦關機或斷線時怎麼辦？</b>答案：PLC 照樣跑，電腦恢復後要能補回產量；斷線那段時間要標示出來。</li></ol>`),
`<p>寫 PLC 的人給的記憶體配置表：</p>`,
C.table(['位址','內容','型態'],[
 ['D200','狀態：0 待機、1 自動運轉、2 異常停機、3 計畫停機（休息、換料）','16 位元'],
 ['D201','異常碼：1 卡料、2 缺包材、3 封口溫度低（沒有異常是 0）','16 位元'],
 ['D202','良品計數：每包一個 +1，滿了繞回 0；放在<b>停電保持區</b>，PLC 斷電或 STOP 不會清 0','16 位元'],
 ['D203','不良計數：同上','16 位元']
]),
ask('監控程式為什麼「只讀不寫」？廠長說「順便讓我在辦公室按一下就能開機」不是很方便嗎？',
 `<p>在辦公室遠端啟動機台，現場可能有人正在清料，看不到也聽不到警告。啟動、復歸這種動作要有人在機台旁邊確認安全，這是 W1 啟動許可的同一個道理。</p>
 <p>另一個原因：寫錯一個位址就可能改到 PLC 正在用的資料。只讀的程式最多「看錯」，不會讓機台出事。真的要寫（例如下載生產目標），要和寫 PLC 的人約定一塊專用的位址、做交握，而且寫在規格裡。</p>`),
note('為什麼是 D200 起','FX3S 的 D0～D127 是一般型，PLC 斷電或 RUN → STOP 會清成 0；D128～D255 是停電保持型。計數放在一般型的話，PLC 重開機後從 0 開始，監控程式會算出一個好幾萬的差值。實際位址以 FX3S 程式手冊的裝置範圍和寫 PLC 的人給的配置表為準。'),
C.h3('② 寫成規格','','定義也要寫成規格'),
C.table(['編號','規格'],[
 ['S1','每 1 秒讀一次 D200～D203（一次讀 4 個字）'],
 ['S2','產量用「這次讀到的 − 上次讀到的」累加，計數器繞回 0 時也要算對；第一次讀取、讀取失敗的那一圈都不算產量；一圈的差值大於「1 秒最多能包幾包 × 間隔 × 2」時視為 PLC 重置，不算產量、記一筆事件'],
 ['S3','計畫時間 ＝ 班別時間 − 計畫停機（D200 ＝ 3）；可用率 ＝ 運轉時間 ÷ 計畫時間'],
 ['S4','效能 ＝ 總產量 × 標準週期 2.0 秒 ÷ 運轉時間；良率 ＝ 良品 ÷ 總產量；OEE ＝ 可用率 × 效能 × 良率'],
 ['S5','D200 從別的狀態變成 2 時記一筆停機開始（時間、異常碼）；離開 2 時補上結束時間'],
 ['S6','讀不到 PLC 的那幾秒記為「通訊中斷」，不算運轉也不算停機；恢復後產量用差值補回'],
 ['S7','每班結束寫一列班別報表（CSV）；停機紀錄另存一個檔'],
 ['S8','程式不寫入 PLC 任何位址']
]),
C.h3('③ 盤點','','只多一條線'),
`<p>硬體只有一條通訊線：L12～L14 已經做好 <b>FX_ReadD.vi</b>，這一課直接用。要確認的是通訊埠和設定（鮑率、站號）跟 PLC 那邊一致。</p>`,
C.h3('④ 先驗證','','用 L13 的程式讀一次'),
`<ol><li>用 L13 的測試 VI 讀 D200～D203，跟 PLC 的觸控螢幕（或 GX Works2 的監視）對照，四個數字要一樣。</li>
<li>請現場按一次急停或拉一次卡料：D200 有沒有變 2、D201 是不是對的代碼？<b>配置表寫的和實際不一樣，是很常見的事。</b></li>
<li>包幾包，看 D202 是不是一包 +1（有些機台一次出兩包，計數 +2）。</li>
<li>請現場把 PLC 斷電再上電：D202 有沒有歸零？歸零的話，請 PLC 的人改用停電保持區，或監控程式要加合理性檢查（下面）。</li></ol>`,
ask('GX Works2 監視 D202 顯示 −32768，LabVIEW 讀到的卻是 32768。哪一個錯了？',
 `<p>都沒錯。16 個位元一樣是 <code>1000 0000 0000 0000</code>：GX Works2 預設用<b>有號</b>（−32768～32767）顯示，FX_ReadD.vi 的 Words 是 <b>U16</b>（0～65535）。所以 PLC 計數到 32767 再 +1，GX Works2 會看到負數，LabVIEW 看到 32768，再加到 65535 之後才繞回 0。</p>
 <p>只要兩邊都用差值來算，用哪一種顯示都不影響產量。</p>`),
C.h3('⑤ 規劃','','最容易錯的兩個地方先想清楚'),
`<p><b>一、計數器會繞回 0。</b>16 位元最多 65535，一天包 1 萬多包，幾天就繞一圈。如果用「現在的值 − 開班時的值」，繞過 0 那一刻產量變成負的。</p>
<p>解法：每一圈算「這一圈多了幾包」再累加。用 <b>U16 相減</b>：5 − 65530 在 U16 裡會自動繞回來，得到 11，正好是這段時間真正多出來的數量。（只要兩次讀取之間不超過 65535 包，一定對。）這也是 S6 的「斷線後補回」：斷線 10 分鐘，恢復後第一次相減就把這 10 分鐘的產量補回來。</p>
<p><b>二、狀態要「改變」才記。</b>每秒都讀到 D200 ＝ 2，不能每秒記一筆停機。用 Shift Register 記住上一次的狀態，和這一次不一樣時才記：W5 的 LCD「沒變就不送」同一個想法。</p>`,
C.plan({start:'Monitor.vi：一個 While Loop，1 秒一圈。Count.vi 做成 SubVI（兩個計數各用一次）。',
 in:'FX_ReadD.vi 讀 D200 起 4 個字 → Index Array 拆成狀態、異常碼、良品、不良。讀取有錯誤時，這一圈當作「通訊中斷」。',
 calc:'計數：U16 差值累加（第一次和讀取失敗不算，差值大得不合理也不算）。時間：5 格的累計陣列（4 個狀態 ＋ 通訊中斷用索引 4），每圈用 Index Array 取出這一格 → ＋1 → Replace Array Subset 放回去。停機：狀態和上一圈不同 → 記錄開始或結束。OEE：照 S3、S4。',
 out:'前面板：現在狀態、四個百分比、產量、停機紀錄表；檔案：停機紀錄、班別報表。',
 loop:'1 秒一圈。比 1 秒短的停機會被漏掉或算不準：要問廠長在不在意。真的在意，要讓 PLC 自己累計停機秒數，電腦只讀結果。',
 end:'按停止或換班：把還沒結束的停機補上結束時間，寫班別報表，關 VISA。'}),
C.h3('⑥ 一步一步寫','','Count.vi：計數器差值累加'),
{steps:{title:'Count.vi：U16 差值累加；第一次和讀取失敗都不算',lv:cv,steps:[
 {t:'讀 D202',view:'split',add:['rate','start','fail','wl','quit','cond','w18','kms','wt','w17','kD','kC','rd','w1','w2','ia','w3','raw','w4'],h:`<p>While Loop、Wait 1000 ms、stop。迴圈裡放 L13 做的 FX_ReadD.vi：D 接 202、Count 接 1。Words 是 U16 陣列，${fn('Programming','Array','Index Array')} 拿第 0 個。</p><p>先切一下「讀取失敗」：Words 是空陣列，Index Array 給的是預設值 <b>0</b>，看起來就像一個正常的數字。這就是後面要防的陷阱。</p>`},
 {t:'讀取有沒有錯',view:'split',add:['ub','e1','e2','not'],h:`<p>FX_ReadD.vi 的 error out 接 Unbundle By Name，選 status：True 表示這次沒讀到。再接一個 Not：「這次讀到了」。</p>`},
 {t:'和上一次相減；讀不到就保留上一次',view:'split',add:['k0a','sr1','w0a','sub','w5','w6','sel2','p1','p2','p3','p4'],h:`<p>Shift Register 存「上一次讀到的值」。Subtract：這一次 − 上一次，兩邊都是 <b>U16</b>，繞回 0 時自動算對（5 − 65530 ＝ 11）。不要先轉成 I32 或 DBL 再減。</p><p>存回 Shift Register 之前經過一個 Select：讀取失敗時存回<b>原來的值</b>，不要把那個假的 0 存進去，不然恢復通訊時會把 PLC 的整個累計值再算一次。</p>`},
 {t:'第一次和讀取失敗都不算',view:'split',add:['k0c','sr3','w0c','and','v1','v2','or','v3','v4','v5','kz','sel','w9','w10','w11','delta','w12'],h:`<p>第二個 Shift Register（Boolean，初值 False）記住「手上有沒有一個有效的上一次」。</p><p>這一圈要算產量的條件：<b>上一次有效 And 這一次讀到了</b>。不成立就給 0。之後只要讀到過一次，它就一直是 True（Or）。</p><p>這同時處理了兩件事：程式剛開始的第一次讀取（還沒有上一次），和通訊中斷（這一次是假的）。如果只用「i ＝ 0 時不算」，第一圈剛好讀失敗就又出錯了。</p>`},
 {t:'累加成本班產量',view:'split',add:['k0b','sr2','w0b','add','w13','w14','w15','total','w16'],h:`<p>第三個 Shift Register（U32，初值 0）累加每一圈的差值。用 U32 是因為一班的產量可能超過 65535。Add 的兩邊是 U16 和 U32，LabVIEW 會自動轉型，接點上出現一個小紅點（coercion dot）：這裡是故意的、不會出錯；介意的話在前面加 To Unsigned Long Integer。</p>`},
 {t:'Run：繞過 0、拔線再接回',view:'split',add:[],h:`<p>D202 從 65530 開始，每圈 +3：繞過 0 之後「這一圈多了幾包」一直是 3。</p><p>跑幾圈後切「讀取失敗」幾秒再切回來：失敗那幾圈是 0，接回來的第一圈一次補回中斷期間多出來的數量。訊息列最後的「PLC 真正多了」和本班產量要一樣。</p>`}
]}},
tip('參考答案','<a href="vi/LV2018/W07_Count.zip" download>W07_Count.zip（LabVIEW 2018）</a>　<a href="vi/W07_Count.zip" download style="font-size:13px">2026 版</a>：解開後保持資料夾結構。W07_sub 裡的 FX_ReadD.vi 是<b>假的</b>（端子位置和 L13 的真 FX_ReadD 一樣，多了 value (sim)、fail (sim)），圖上「SIM ONLY」那一塊在實機上要刪掉。error in 刻意不串：讀不到一次之後，下一次還是要讀。測試版 W07_Count_test.vi 實測四組都對：65530 起每秒 +3，產量 0、3、6、9、12；繞回加一次讀取失敗，最後 16；第一次就讀不到，產量 0、0、5；65530 → 5 這一圈是 11。'),
C.h3('⑦ 測試、交機','','模擬一個班'),
`<p>下面是整個監控程式的模擬：上面的時間軸是電腦看到的每一秒，下面是 OEE、停機紀錄、原因排行和班別報表。照驗收表一條一條試。</p>`,
{fn:oeeSim},
C.table(['測試','操作','預期','規格'],[
 ['T1','跑完整個班','10:00～10:10 是計畫停機（灰藍），不算進計畫時間；班別報表寫一列','S3、S7'],
 ['T2','運轉中按「現在卡料」','時間軸變紅，停機紀錄多一筆「停機中」；恢復後補上結束時間和分鐘數','S5'],
 ['T3','運轉中勾「通訊線拔掉」一段時間再取消','那段是黑色（不知道），不算運轉也不算停機；恢復後產量一次補回；效能會偏高（超過 100 % 時標黃），報表註明','S6'],
 ['T4','勾「PLC 計數從 65 500 開始」再跑','D202 繞回 0 之後，本班良品仍然正確；「D202 減開班值」變負的','S2'],
 ['T5','看停機原因排行','分鐘數最多的排第一：這就是廠長要的「為什麼停」','S5'],
 ['T6','檢查程式','沒有任何寫入 PLC 的 VI','S8']
]),
ask('通訊線拔掉的那 10 分鐘，為什麼不能算成停機？',
 `<p>因為那段時間機台<b>可能一直在跑</b>（恢復後產量補回來就證明了）。算成停機，可用率會被低估，廠長會去追一個不存在的問題；算成運轉也不對。誠實的做法是標示「不知道」，並在報表上寫出通訊中斷了幾分鐘。如果經常斷線，先修通訊，報表才可信。</p>`),
ask('效能算出來超過 100 %，代表什麼？',
 `<p>代表「標準週期 2.0 秒」寫錯了（機台其實更快），或計數重複（一包算兩次，例如感測器抖動），或者運轉時間少算了（例如有一段運轉被當成通訊中斷）。<b>不要把它限制在 100 %</b>：超過 100 % 是一個訊號，回去查定義和資料。驗收 T3 拔線之後，模擬上的效能就會超過 100 %，報表要註明那段通訊中斷。</p>`),
`<p>交機資料：記憶體配置表（和 PLC 負責人一起簽）、OEE 的定義（廠長簽）、通訊設定、報表欄位說明、這張驗收表。</p>`,
note('職缺上的「串 MES、回傳生產資料」','就是把這一課的班別報表或每一筆停機，改成送到工廠的系統（資料庫、網頁 API 或 MQTT），而不是寫在本機檔案。資料怎麼算（差值、狀態改變才記、斷線標示）完全一樣；只換最後「寫到哪裡」那一步。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'16 位元計數從 65530 變成 5，U16 相減 5 − 65530 ＝ ？',o:['11','−65525','0','錯誤'],a:0,ex:'U16 運算會繞回，剛好是中間多出來的數量。'},
 {q:'讀取失敗時 Index Array 給 0，如果照樣相減會怎樣？',o:['差值繞回成六萬多包，恢復時還會再算一次','沒影響','少算幾包','程式停止'],a:0,ex:'讀取失敗的那一圈不算，上一次的值保留。'},
 {q:'通訊中斷的時間應該算成？',o:['不知道（另外標示）','停機','運轉','計畫停機'],a:0,ex:'機台可能一直在跑。'},
 {q:'計畫 420 分、運轉 378 分，可用率是？',o:['90 %','111 %','42 %','378 %'],a:0,ex:'378 ÷ 420。'},
 {q:'運轉 378 分，產量 10206 包，標準週期 2 秒，效能約？',o:['90 %','100 %','45 %','78 %'],a:0,ex:'10206 × 2 ÷ 60 ＝ 340.2 分；340.2 ÷ 378 ＝ 0.9。'},
 {q:'可用率 90 %、效能 90 %、良率 97 %，OEE 約？',o:['78.6 %','90 %','97 %','277 %'],a:0,ex:'三個相乘。'},
 {q:'監控程式要記「停機開始」，條件是？',o:['這一圈狀態是 2，且上一圈不是 2','這一圈狀態是 2','異常碼不是 0','每秒記一次'],a:0,ex:'狀態改變才記。'},
 {q:'廠長要在辦公室按鈕遠端啟動機台，最主要的顧慮是？',o:['現場可能有人，啟動要在機台旁確認安全','網路太慢','LabVIEW 做不到','PLC 不接受'],a:0,ex:'這一版只讀不寫。'}
]}
]});
})();
