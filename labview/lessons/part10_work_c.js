/* 第十部分：實務案例（W6 起）。依台灣人力銀行 LabVIEW／自動化測試職缺最常寫的工作內容挑題目。
   W6：產線功能測試站（ATE）：掃序號 → 上電 → 逐項量測 → 和上下限比 → PASS/FAIL → 寫 CSV → 斷電。
   儀器指令用 SCPI 的寫法示意；每個廠牌的指令細節不同，以該儀器的程式手冊為準。 */
(function(){
const L=window.LESSONS,fn=C.fn,qd=C.qd,wt=C.wt;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const PR=['Functions','Programming'];
const addF=o=>{for(const k in o)if(!LV.F[k])LV.F[k]=o[k];};
addF({
 'Match Regular Expression':{g:'.*',ins:['input string','regular expression'],outs:['before match','whole match','after match','offset past match'],w:56,pal:[...PR,'String','Match Regular Expression']},
 'Search 1D Array':{g:'[?]',ins:['1D array','element','start index'],outs:['index of element'],pal:[...PR,'Array','Search 1D Array']},
 'And Array Elements':{g:'∧[ ]',ins:['Boolean array'],outs:['logical AND'],pal:[...PR,'Boolean','And Array Elements']}
});

/* ======================================================================
   W6：產線功能測試站
   ====================================================================== */
const ITEMS=[
 {id:'T01',name:'無載輸入電流',lo:5,hi:30,unit:'mA',dig:1},
 {id:'T02',name:'無載輸出電壓',lo:4.90,hi:5.10,unit:'V',dig:3},
 {id:'T03',name:'滿載輸出電壓（2 A）',lo:4.85,hi:5.10,unit:'V',dig:3},
 {id:'T04',name:'負載調整率',lo:0,hi:1.5,unit:'%',dig:2},
 {id:'T05',name:'滿載效率',lo:85,hi:100,unit:'%',dig:1}
];
const BOARDS=['良品','輸出電壓偏低','效率不足','治具沒壓好（探針沒接觸）'];
/* 依板子種類算出五個量測值。rnd 是 0～1 的亂數來源。 */
function measure(board,rnd){
  const n=a=>(rnd()-0.5)*2*a;
  if(board===3) return [0.2+n(0.1),0.002+n(0.002),0.001+n(0.001),0,0];
  let iq=17+n(1.5),vnl=5.02+n(0.008),vfl=4.975+n(0.008),eff=88.6+n(0.5);
  if(board===1){vnl=4.86+n(0.01);vfl=4.80+n(0.01);}
  if(board===2){eff=82.4+n(0.6);iq=24+n(1.5);}
  const reg=Math.abs(vnl-vfl)/vnl*100;
  return [iq,vnl,vfl,reg,eff];
}
function seeded(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return ()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return ((h>>>0)%100000)/100000;};}
const SNRE=/^PM5-\d{8}$/;
const pad2=x=>String(x).padStart(2,'0');
const nowStr=()=>{const d=new Date();return [d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()),pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds())];};

/* ---- 圖：同一片板子量 10 次，量測點不同，散佈差多少 ---- */
function repeatFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<p style="margin:0 0 6px"><b>同一片良品量 10 次：滿載輸出電壓（規格 4.85～5.10 V，公差寬 0.25 V）</b></p>
  <p><label><input type="radio" name="rp" value="load" checked> 用電子負載自己的電壓讀值（量在負載的端子上，中間隔著 1 公尺的線）</label><br>
  <label><input type="radio" name="rp" value="dmm"> DMM 夾在板子的輸出端（四線／Kelvin 接法：電流走粗線，量電壓的細線另外拉到板子上）</label></p>
  <p><button type="button" class="btn" data-k="go">量 10 次</button></p>
  <div data-o="out" style="font-family:Consolas,monospace;font-size:13px"></div>`;
  const o=k=>el.querySelector('[data-o='+k+']');
  el.querySelector('[data-k=go]').onclick=()=>{
    const m=el.querySelector('input[name=rp]:checked').value;
    const vs=[];for(let i=0;i<10;i++){
      // 線阻約 0.045 Ω（來回），接觸電阻每次插拔都不一樣
      const v= m==='load' ? 4.975-2*(0.045+Math.random()*0.025)+(Math.random()-0.5)*0.01 : 4.975+(Math.random()-0.5)*0.003;
      vs.push(v);}
    const mean=vs.reduce((a,b)=>a+b,0)/10,sd=Math.sqrt(vs.reduce((a,b)=>a+(b-mean)**2,0)/9),sp=6*sd,pct=sp/0.25*100;
    const bad=pct>30,mid=pct>10&&!bad;
    o('out').innerHTML=`<p>${vs.map(v=>v.toFixed(4)).join('　')}</p>
    <p>平均 <b>${mean.toFixed(4)} V</b>　標準差 σ ＝ ${(sd*1000).toFixed(2)} mV，6σ ＝ <b>${(sp*1000).toFixed(1)} mV</b>　＝ 公差的 <b style="color:${bad?'#c0392b':mid?'#b8860b':'#1e7b34'}">${pct.toFixed(1)} %</b></p>
    <p>${m==='load'?'平均比板子真正的輸出（約 4.975 V）低了將近 0.1 V：2 A 流過線阻，電壓掉在線上。而且每次接觸電阻不同，散佈很大。這樣量，好板子也可能被判 FAIL，壞板子也可能 PASS。':'量在板子上，線阻的壓降不算進去；散佈只剩 DMM 本身的雜訊，遠小於公差。這個測試站才「判得準」。'}</p>`;
  };
}

/* ---- 圖：整個測試站的模擬 ---- */
function stationSim(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
  <div style="flex:1 1 300px;min-width:280px">
   <p style="margin:0 0 4px">序號（條碼槍掃完會自動送 Enter）：</p>
   <p style="display:flex;gap:6px;flex-wrap:wrap"><input data-k="sn" style="font:15px Consolas,monospace;width:170px" placeholder="PM5-xxxxxxxx"> <button type="button" class="btn" data-k="scan">掃一片新的</button> <button type="button" class="btn" data-k="again">重掃上一片</button> <button type="button" class="btn" data-k="start">開始測試</button></p>
   <p style="margin:6px 0">治具上的板子：<select data-k="board">${BOARDS.map((b,i)=>`<option value="${i}">${b}</option>`).join('')}<option value="9">隨機（約 9 成良品）</option></select></p>
   <p style="margin:4px 0;font-size:13px"><label><input type="checkbox" data-k="dmm"> DMM 的 USB 線鬆了</label>　<label><input type="checkbox" data-k="eng"> 工程模式（失敗後繼續測完）</label></p>
   <div data-o="ban" style="margin-top:8px;border-radius:8px;padding:14px;font-size:22px;font-weight:700;text-align:center;background:#dfe6ee;color:#334">請掃序號</div>
   <p data-o="sub" style="font-size:13px;color:#445;margin-top:6px;min-height:18px"></p>
   <p style="font-size:13px">電源供應器：<b data-o="ps">OUTPUT OFF</b>　電子負載：<b data-o="ld">OFF</b>　這一片花了：<b data-o="ct">－</b></p>
   <p style="font-size:13px">今天：投入 <b data-o="n">0</b>　PASS <b data-o="np">0</b>　FAIL <b data-o="nf">0</b>　錯誤 <b data-o="ne">0</b>　良率 <b data-o="y">－</b></p>
  </div>
  <div style="flex:1 1 320px;min-width:280px">
   <table class="tbl" style="width:100%;font-size:13px" data-o="tb"></table>
   <p style="font-size:12px;color:#556;margin:8px 0 2px">當天的 CSV（每測一片加一列，最新的在上面）：</p>
   <div data-o="csv" style="font:12px Consolas,monospace;background:#fff;border:1px solid #ccd;padding:6px;max-height:150px;overflow:auto;white-space:pre"></div>
  </div></div>`;
  const o=k=>el.querySelector('[data-o='+k+']'),q=k=>el.querySelector('[data-k='+k+']');
  let busy=false,state='IDLE',okSN='',lastSN='',serial=26110000,stat={n:0,p:0,f:0,e:0},seen={},rows=[];
  const HDR='日期 時間,序號,第幾次,結果,失敗項,'+ITEMS.map(t=>t.id).join(',');
  function banner(t,bg,fg){const b=o('ban');b.textContent=t;b.style.background=bg;b.style.color=fg||'#fff';}
  function table(vals,res,cur){
    o('tb').innerHTML='<tr><th>項目</th><th>下限</th><th>量測</th><th>上限</th><th>判定</th></tr>'+ITEMS.map((t,i)=>{
      const v=vals[i],r=res[i];const c=r===true?'#1e7b34':r===false?'#c0392b':'#888';
      return `<tr${cur===i?' style="background:#fff6c8"':''}><td>${t.id} ${t.name}</td><td>${t.lo} ${t.unit}</td><td>${v==null?'':v.toFixed(t.dig)}</td><td>${t.hi} ${t.unit}</td><td style="color:${c};font-weight:700">${r===true?'PASS':r===false?'FAIL':cur===i?'量測中…':''}</td></tr>`;}).join('');
  }
  function csv(){o('csv').textContent=HDR+'\n'+rows.slice().reverse().join('\n');}
  function stats(){o('n').textContent=stat.n;o('np').textContent=stat.p;o('nf').textContent=stat.f;o('ne').textContent=stat.e;o('y').textContent=(stat.p+stat.f)?(stat.p/(stat.p+stat.f)*100).toFixed(1)+' %（不含錯誤）':'－';}
  function acceptSN(){
    if(busy) return;
    const sn=q('sn').value.trim();
    if(!SNRE.test(sn)){state='IDLE';banner('序號格式錯誤','#b8860b');o('sub').textContent='「'+sn+'」不是 PM5- 加 8 位數字。可能掃到外箱或別的條碼，請重掃。';return;}
    state='READY';okSN=sn;const k=seen[sn];
    banner('放好板子，按「開始測試」','#2f6fd0');
    o('sub').textContent=k?('這個序號今天已經測過 '+k.n+' 次（上次 '+k.last+'），這次記為第 '+(k.n+1)+' 次，資料全部保留。'):'序號 OK：'+sn;
    table([],[],-1);
  }
  q('sn').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();acceptSN();}});
  q('sn').addEventListener('input',()=>{if(!busy&&state==='READY'){state='IDLE';okSN='';banner('請掃序號','#dfe6ee','#334');o('sub').textContent='序號改了，請按 Enter 重新檢查。';}});
  q('again').onclick=()=>{if(busy||!lastSN)return;q('sn').value=lastSN;acceptSN();};
  q('scan').onclick=()=>{if(busy)return;serial++;q('sn').value='PM5-'+serial;acceptSN();};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  q('start').onclick=async()=>{
    if(busy) return;
    if(state!=='READY'){banner('先掃序號','#b8860b');o('sub').textContent='沒有合法的序號就不能開始：每一筆資料都要能追到是哪一片。';return;}
    busy=true;state='TEST';const sn=okSN,t0=performance.now();lastSN=sn;
    let b=+q('board').value;if(b===9)b=Math.random()<0.9?0:1+Math.floor(Math.random()*3);
    const eng=q('eng').checked,vals=[],res=[];let err='';
    const m=measure(b,Math.random);
    banner('測試中…','#556');
    o('ps').textContent='12.00 V、限流 1.5 A、OUTPUT ON';o('sub').textContent='上電，等輸出穩定';await wait(600);
    const order=[0,1,'LOAD',2,3,4];
    for(const step of order){
      if(!document.body.contains(el)) return;
      if(step==='LOAD'){o('ld').textContent='ON（定電流 2 A）';o('sub').textContent='負載切到 2 A，等 0.4 秒穩定';await wait(400);continue;}
      const i=step;table(vals,res,i);o('sub').textContent=ITEMS[i].id+' '+ITEMS[i].name;
      if((i===1||i===2)&&q('dmm').checked){await wait(2000);err='DMM 沒有回應（VISA 逾時，錯誤碼 −1073807339）';break;}
      await wait(i===3?80:380);
      vals[i]=m[i];res[i]=m[i]>=ITEMS[i].lo&&m[i]<=ITEMS[i].hi;table(vals,res,-1);
      if(!res[i]&&!eng) break;
    }
    o('sub').textContent='負載 OFF → 電源 OUTPUT OFF';o('ld').textContent='OFF';await wait(150);o('ps').textContent='OUTPUT OFF';await wait(150);
    const ct=(performance.now()-t0)/1000;o('ct').textContent=ct.toFixed(1)+' s';
    const pass=!err&&res.length===5&&res.every(Boolean);
    const fi=res.indexOf(false),fname=err?'儀器錯誤':fi>=0?ITEMS[fi].id+' '+ITEMS[fi].name:'';
    const k=seen[sn]||{n:0,last:''};k.n++;const [d,t]=nowStr();k.last=t+' '+(err?'ERROR':pass?'PASS':'FAIL');seen[sn]=k;
    rows.push(d+' '+t+','+sn+','+k.n+','+(err?'ERROR':pass?'PASS':'FAIL')+','+fname+','+ITEMS.map((it,i)=>vals[i]==null?'':vals[i].toFixed(it.dig)).join(','));csv();
    stat.n++;if(err)stat.e++;else if(pass)stat.p++;else stat.f++;stats();
    if(err){banner('儀器錯誤，請通知工程師','#7b2cbf');o('sub').textContent=err+'。電源和負載已經關掉；這一片不算 PASS 也不算 FAIL，修好後重測。';}
    else if(pass){banner('PASS','#1e7b34');o('sub').textContent='貼綠標，放良品區。';}
    else{banner('FAIL：'+fname,'#c0392b');o('sub').textContent='放紅箱（不良品區），不要重測到 PASS 為止；交給維修或工程。';}
    state='IDLE';busy=false;q('sn').value='';q('sn').focus();
  };
  table([],[],-1);csv();stats();
}

/* ---- 一步一步寫：判定和寫一列 CSV ---- */
const jd={name:'Judge.vi',view:'split',ratio:2.1,
 fp:{w:370,h:330,items:[
  {id:'sn',k:'str',ctl:true,label:'序號（條碼槍掃進來）',x:12,y:8,w:170,v:'PM5-26110001'},
  {id:'board',k:'enum',ctl:true,label:'治具上的板子（模擬用）',options:BOARDS,x:200,y:8,v:0},
  {id:'snok',k:'led',label:'序號格式正確',color:'green',x:12,y:62},
  {id:'vals',k:'arr',t:'dbl',n:5,label:'量測值 T01～T05',x:120,y:62},
  {id:'pass',k:'led',label:'PASS',color:'green',x:12,y:118},
  {id:'res',k:'str',label:'結果',x:80,y:118,w:70},
  {id:'fail1',k:'str',label:'第一個失敗的項目',x:170,y:118,w:180},
  {id:'line',k:'str',label:'CSV 這一列',x:12,y:178,w:345,rows:2}]},
 bd:{w:960,h:390,nodes:[
  {id:'sn',k:'ctl',t:'str',label:'序號',x:20,y:30},
  {id:'kre',k:'const',t:'str',v:'^PM5-[0-9]{8}$',x:20,y:70},
  {id:'mre',k:'fn',fn:'Match Regular Expression',x:140,y:24},
  {id:'k0',k:'const',t:'i32',v:0,x:205,y:96},
  {id:'ge',k:'fn',fn:'Greater Or Equal?',x:240,y:62},
  {id:'snok',k:'ind',t:'bool',label:'序號格式正確',x:300,y:66},
  {id:'meas',k:'sub',name:'Measure_All.vi（上電、量 T01～T05、斷電）',icon:['量測','T01-05'],ins:[],outs:['values'],x:16,y:220,w:86,h:44,color:'#6a3fb5',tip:'實機：電源供應器、電子負載、DMM 的 VISA 指令都在這裡面'},
  {id:'vals',k:'ind',t:'dbl[]',label:'量測值',x:150,y:320},
  {id:'khi',k:'const',t:'dbl[]',v:'30, 5.10, 5.10, 1.5, 100',x:120,y:150,label:'上限（limits.csv）'},
  {id:'klo',k:'const',t:'dbl[]',v:'5, 4.90, 4.85, 0, 85',x:120,y:262,label:'下限（limits.csv）'},
  {id:'irc',k:'fn',fn:'In Range and Coerce',x:340,y:190},
  {id:'aae',k:'fn',fn:'And Array Elements',x:420,y:196},
  {id:'and',k:'fn',fn:'And',x:490,y:190},
  {id:'pass',k:'ind',t:'bool',label:'PASS',x:560,y:196},
  {id:'kP',k:'const',t:'str',v:'PASS',x:556,y:128},
  {id:'kF',k:'const',t:'str',v:'FAIL',x:556,y:150},
  {id:'sel',k:'fn',fn:'Select',x:610,y:130},
  {id:'res',k:'ind',t:'str',label:'結果',x:652,y:170},
  {id:'kF2',k:'const',t:'bool',v:false,x:380,y:280},
  {id:'srch',k:'fn',fn:'Search 1D Array',x:420,y:258},
  {id:'knm',k:'const',t:'str[]',v:'T01～T05 項目名稱',x:378,y:326},
  {id:'ia',k:'fn',fn:'Index Array',x:520,y:270},
  {id:'fail1',k:'ind',t:'str',label:'第一個失敗項',x:600,y:276},
  {id:'kdt',k:'const',t:'str',v:'%Y-%m-%d %H:%M:%S',x:584,y:16},
  {id:'dt',k:'fn',fn:'Format Date/Time String',x:720,y:20},
  {id:'kff',k:'const',t:'str',v:'%s,%s,%s,%s,%s',x:676,y:100},
  {id:'kfmt',k:'const',t:'str',v:'%.4f',x:650,y:296},
  {id:'kdl',k:'const',t:'str',v:',',x:676,y:330},
  {id:'a2s',k:'fn',fn:'Array To Spreadsheet String',x:720,y:300},
  {id:'fis',k:'fn',fn:'Format Into String',ins:['format string','時間','序號','結果','失敗項','量測值'],x:820,y:100,w:50},
  {id:'line',k:'ind',t:'str',label:'CSV 這一列',x:892,y:139},
  {id:'app',k:'sub',name:'Append_Line.vi（加到當天的 CSV 最後面）',icon:['CSV','＋'],ins:['text'],outs:[],x:890,y:200,w:56,h:40,color:'#2e7d32',tip:'F 部分學過的寫檔：Open/Create（open or create）→ Set File Position 到最後 → Write to Text File → Close'}],
 wires:[
  {id:'s1',from:'sn',to:'mre.input string',t:'str',mx:120},
  {id:'s2',from:'kre',to:'mre.regular expression',t:'str',mx:125},
  {id:'s3',from:'mre.offset past match',to:'ge.x',t:'i32',mx:225},
  {id:'s4',from:'k0',to:'ge.y',t:'i32',mx:232},
  {id:'s5',from:'ge.out',to:'snok',t:'bool'},
  {id:'m1',from:'meas.values',to:'vals',t:'dbl[]',mx:108},
  {id:'m2',from:'khi',to:'irc.upper limit',t:'dbl[]',mx:330},
  {id:'m3',from:'meas.values',to:'irc.x',t:'dbl[]',mx:320},
  {id:'m4',from:'klo',to:'irc.lower limit',t:'dbl[]',mx:326},
  {id:'j1',from:'irc.In Range?',to:'aae',t:'bool[]',mx:405},
  {id:'j2',from:'aae.logical AND',to:'and.y',t:'bool'},
  {id:'j3',from:'ge.out',to:'and.x',t:'bool',pts:[[284,76],[284,112],[476,112],[476,197],[490,197]]},
  {id:'j4',from:'and.out',to:'pass',t:'bool'},
  {id:'j5',from:'kP',to:'sel.t',t:'str'},
  {id:'j6',from:'and.out',to:'sel.s',t:'bool',mx:545},
  {id:'j7',from:'kF',to:'sel.f',t:'str',mx:600},
  {id:'j8',from:'sel.out',to:'res',t:'str',mx:646},
  {id:'f1',from:'irc.In Range?',to:'srch.1D array',t:'bool[]',mx:405},
  {id:'f2',from:'kF2',to:'srch.element',t:'bool',mx:410},
  {id:'f3',from:'srch.index of element',to:'ia.index',t:'i32',mx:505},
  {id:'f4',from:'knm',to:'ia.array',t:'str[]',mx:510},
  {id:'f5',from:'ia.element',to:'fail1',t:'str'},
  {id:'c1',from:'kff',to:'fis.format string',t:'str',mx:812},
  {id:'c2',from:'dt.date/time string',to:'fis.時間',t:'str',mx:792},
  {id:'c3',from:'kdt',to:'dt.time format string',t:'str'},
  {id:'c4',from:'sn',to:'fis.序號',t:'str',pts:[[110,40],[110,8],[804,8],[804,137],[820,137]]},
  {id:'c5',from:'sel.out',to:'fis.結果',t:'str',pts:[[646,146],[646,158],[808,158],[808,149],[820,149]]},
  {id:'c6',from:'ia.element',to:'fis.失敗項',t:'str',pts:[[580,286],[580,256],[812,256],[812,161],[820,161]]},
  {id:'c7',from:'kfmt',to:'a2s.format string',t:'str',mx:704},
  {id:'c8',from:'meas.values',to:'a2s.array',t:'dbl[]',pts:[[112,242],[112,372],[708,372],[708,323],[720,323]]},
  {id:'c9',from:'kdl',to:'a2s.delimiter',t:'str',mx:710},
  {id:'c10',from:'a2s.spreadsheet string',to:'fis.量測值',t:'str',mx:816},
  {id:'c11',from:'fis.resulting string',to:'line',t:'str'},
  {id:'c12',from:'fis.resulting string',to:'app.text',t:'str',mx:880}]},
 sim:{init:()=>({}),
  step(inp){
   const sn=String(inp.sn||'').trim(),re=sn.match(SNRE),off=re?sn.length:-1,snok=off>=0;
   const v=measure(+inp.board||0,seeded(sn+'|'+(+inp.board||0)));
   const inr=ITEMS.map((t,i)=>v[i]>=t.lo&&v[i]<=t.hi),all=inr.every(Boolean),pass=all&&snok,res=pass?'PASS':'FAIL';
   const fi=inr.indexOf(false),fname=fi>=0?ITEMS[fi].id+' '+ITEMS[fi].name:'';
   const vs=v.map(x=>x.toFixed(4)).join(',');const [d,t]=nowStr();
   const line=d+' '+t+','+sn+','+res+','+fname+','+vs+'\n';
   const B=a=>'['+a.map(b=>b?'T':'F').join(' ')+']';
   return {out:{snok,vals:v.map((x,i)=>+x.toFixed(ITEMS[i].dig)),pass,res,fail1:fname,line},
    vals:{sn:'"'+sn+'"',kre:'^PM5-[0-9]{8}$','mre.offset past match':off,k0:0,'ge.out':snok,'meas.values':'['+v.map((x,i)=>x.toFixed(ITEMS[i].dig)).join(', ')+']',khi:'[30, 5.1, 5.1, 1.5, 100]',klo:'[5, 4.9, 4.85, 0, 85]',
     'irc.In Range?':B(inr),'aae.logical AND':all,'and.out':pass,kP:'PASS',kF:'FAIL','sel.out':'"'+res+'"',kF2:false,'srch.index of element':fi,knm:'項目名稱','ia.element':'"'+fname+'"',
     kdt:'%Y-%m-%d %H:%M:%S','dt.date/time string':d+' '+t,kff:'%s,%s,%s,%s,%s',kfmt:'%.4f',kdl:'","','a2s.spreadsheet string':'"'+vs+'\\n"','fis.resulting string':'(一列，見前面板)'},
    msg:(snok?'序號 OK':'序號格式錯誤（offset past match ＝ −1）')+'｜In Range? '+B(inr)+' → '+res+(fname?'｜第一個失敗：'+fname:'')};},
  doneMsg:'執行完畢：改板子或序號再 Run 一次'}
};

L.push({id:'W06',order:30.986,no:'W6',part:PART,title:'產線功能測試站：掃序號、自動量測、上下限判定、寫 CSV，一片 20 秒內',mins:85,files:['練習\\實務\\Station\\Main.vi','練習\\實務\\Station\\Judge.vi','練習\\實務\\Station\\limits.csv'],
goals:[['學會','測試站的完整流程：序號 → 上電 → 逐項量測 → 判定 → 記錄 → 斷電；把 RD 的規格書改成「測試項目表」（上下限放在檔案，不寫死）；量測點選錯會讓好板子 FAIL（線阻、四線量測）；先確認量測的散佈遠小於公差；Match Regular Expression 檢查序號；In Range and Coerce 一次比整個陣列；任何結束路徑都要斷電；產線資料怎麼存才能追溯。'],['做出','Judge.vi（判定＋組一列 CSV）和整個測試站的流程規劃；在模擬測試站上照驗收表測完。'],['為什麼是這個題目','台灣 LabVIEW 職缺最常見的就是「自動化測試工程師」：寫產線測試程式、整合儀器、產出測試報表、維護測試站。這一課就是這份工作的縮小版。']],
check:'不看課文，能說出這個測試站的 8 個步驟、為什麼滿載電壓要用 DMM 量在板子上、為什麼無載電流也要有下限、程式在哪些情況下要把電源關掉。',
body:[
C.h3('這一課的工作','x','產線測試站是 LabVIEW 最常見的工作'),
`<p>到人力銀行搜「LabVIEW」，最多的職稱是<b>自動化測試工程師、測試工程師、ATE 工程師</b>。工作內容幾乎都寫著：開發產線測試程式、整合量測儀器（電源供應器、電子負載、DMM、示波器）、建立測試規格與上下限、產出測試報表、維護測試站與治具。這一課做一個完整但縮小的版本。</p><p>I13 已經做過一個測試站的骨架（另一塊 5 V 板、只量電壓和漣波）。這一課換一個產品 PM5（多了 2 A 負載和效率），重點放在序號、上下限檔、CSV 和產線流程；I 部分接過的 GPD-3303S、34461A 也可以直接拿來用，命令見 I2～I4。</p>`,
tip('練習檔','下載：<a href="work/limits.csv" download>limits.csv</a>。limits.csv 是 W6 的上下限表（ASCII，LabVIEW 2018 讀中文會變亂碼，所以名稱用英文）。用 Read Delimited Spreadsheet（或 Spreadsheet String To Array）讀成字串陣列，再拆出上下限。'),
C.h3('① 聽懂需求','','產品經理的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「新的 12 V 轉 5 V 電源模組（PM5）下個月上產線，要一個測試站。作業員掃序號、按開始，量輸出電壓和效率，PASS 貼綠標，FAIL 放紅箱。資料要能追溯。一片不要超過 20 秒。規格書 RD 會給你。」</p></div>`,
ask('至少列出五個要回去問的問題。',
 `<ol><li><b>測哪些項目、條件是什麼？</b>「量輸出電壓」是無載還是滿載？滿載是幾 A？輸入幾 V？問 RD 要規格書，一條一條對。</li>
 <li><b>上下限從哪裡來、誰可以改？</b>答案：RD 定，品保核准。作業員不能改，所以<b>不能做成前面板的控制項</b>，要放在檔案裡，改檔案要有人簽名。</li>
 <li><b>序號長什麼樣子？</b>答案：「PM5-」加 8 位數字。程式要檢查，掃到外箱條碼要擋下來。</li>
 <li><b>同一片測兩次怎麼辦？</b>答案：可以重測，但<b>每一次都要留紀錄</b>，不能覆蓋。（品保最怕「FAIL 重測到 PASS 為止」，紀錄要看得出來。）</li>
 <li><b>FAIL 時要不要繼續測後面的項目？</b>答案：產線上第一個 FAIL 就停（省時間）；工程分析時要全部測完。所以做成一個「工程模式」開關。</li>
 <li><b>資料存哪裡、什麼格式、存多久？</b>答案：先存在本機，每天一個 CSV，檔名有日期和站號；之後要上傳工廠的 MES 系統（下一階段）。</li>
 <li><b>儀器有問題時怎麼辦？</b>答案：顯示「儀器錯誤，請通知工程師」，這一片不算 PASS 也不算 FAIL。</li></ol>
 <p>最後一題常常沒人想到，但它最重要：<b>儀器壞掉時，絕對不能讓板子被判 PASS</b>。</p>`),
C.h3('② 寫成規格','','測試項目表 ＋ 流程規格'),
`<p>RD 的規格書寫的是產品「應該」怎樣；測試項目表寫的是測試站「怎麼量、怎麼判」。每一項都要有條件、上下限、單位：</p>`,
C.table(['項次','項目','條件','下限','上限','單位'],[
 ['T01','無載輸入電流','輸入 12 V，輸出不接負載','5','30','mA'],
 ['T02','無載輸出電壓','同上，DMM 量板子輸出端','4.90','5.10','V'],
 ['T03','滿載輸出電壓','負載定電流 2 A，穩定 0.4 秒後量','4.85','5.10','V'],
 ['T04','負載調整率','｜T02 − T03｜÷ T02 × 100（取絕對值）','0','1.5','%'],
 ['T05','滿載效率','（T03 × 2 A）÷（12 V × <b>滿載</b>輸入電流）× 100；負載 ON 之後用 <code>MEAS:CURR?</code> 讀輸入電流','85','100','%']
]),
ask('T01 無載電流越小越好，為什麼還要下限 5 mA？',
 `<p>板子的控制 IC 本身就會吃十幾 mA。量到 0.2 mA 不是「很省電」，而是<b>根本沒接上</b>：探針沒壓好、板子沒放、保險絲斷了。沒有下限的話，這種情況在 T01 會 PASS，要等到後面才 FAIL，而且失敗原因會寫錯（寫成電壓不良）。</p>
 <p>原則：<b>每一項都要有上下限</b>，就算規格書只給一邊。另一邊用「正常的板子不可能超過」的值，用來抓治具和接觸的問題。</p>`),
C.table(['編號','流程規格'],[
 ['S1','序號必須符合 <code>PM5-</code> 加 8 位數字，否則不能開始'],
 ['S2','上下限從 <code>limits.csv</code> 讀，程式裡不寫數字；檔案改了要有核准紀錄'],
 ['S3','量測值在 下限 ≤ x ≤ 上限 為 PASS（含邊界）'],
 ['S4','產線模式第一個 FAIL 就停；工程模式全部測完'],
 ['S5','每測一片，在當天的 CSV 加一列：時間、序號、第幾次、結果、失敗項、5 個量測值。重測不覆蓋'],
 ['S6','測完、FAIL、儀器錯誤、按停止：任何一種結束，<b>先關負載、再關電源輸出</b>'],
 ['S7','儀器錯誤時顯示「請通知工程師」，結果記 ERROR，不算 PASS 或 FAIL'],
 ['S8','一片（從按開始到出結果）≤ 20 秒']
]),
C.h3('③ 盤點','','儀器、指令、接線'),
C.table(['設備','做什麼','怎麼接','會用到的指令（SCPI 寫法示意）'],[
 ['可程式電源供應器','給板子 12 V，讀輸入電流','USB 或 GPIB，VISA','<code>VOLT 12</code>、<code>CURR 1.5</code>（限流）、<code>OUTP ON</code>、<code>MEAS:CURR?</code>'],
 ['電子負載','在輸出端拉 2 A','USB 或 LAN','<code>FUNC CURR</code>、<code>CURR 2</code>、<code>INP ON</code>／<code>INP OFF</code>'],
 ['數位電表 DMM','量板子輸出端的電壓','USB，量測線拉到治具的量測點','<code>MEAS:VOLT:DC?</code>'],
 ['條碼槍','讀序號','USB，模擬鍵盤（掃完自動送 Enter）','不用指令：就像有人打字'],
 ['測試治具','探針壓在板子的測試點上','電源和負載用粗線，DMM 用另外兩條細線','－']
]),
warn('指令以手冊為準','上表是 SCPI 的常見寫法。不同廠牌、型號的指令和回傳格式不一樣，有些電子負載要先切到遠端模式。拿到儀器第一件事是找它的 Programming Manual，或 NI 的儀器驅動（Instrument Driver Network）。'),
ask('電源供應器和電子負載自己都能量電壓，為什麼還要買一台 DMM？',
 `<p>它們量的是<b>自己端子上的電壓</b>。2 A 流過一公尺的線和探針，來回約 0.05 Ω，就掉了 0.1 V，T03 的公差（4.85～5.10）一下子就被吃掉一大半。而且探針每次壓下去的接觸電阻都不一樣，讀值會跳。</p>
 <p>解法是<b>四線（Kelvin）接法</b>：大電流走粗線，量電壓的兩條細線另外拉到板子的輸出端，細線上幾乎沒電流，所以沒有壓降。（這不是 DMM 面板上的「4W」電阻檔；很多電子負載和電源也有 remote sense 端子，是同一個道理。）下一段的實驗可以看到差多少。</p>`),
C.h3('④ 先驗證','','不寫程式，先證明「量得準」'),
`<p>三件事，每件幾分鐘：</p>
<ol><li><b>儀器通了</b>：NI MAX ▸ Devices and Interfaces 找到三台儀器，各開 VISA Test Panel 送 <code>*IDN?</code>，看到廠牌型號。（I 部分「接入新儀器」的方法。）</li>
<li><b>條碼槍的格式</b>：開記事本掃一張序號標籤，看最後有沒有自動換行（Enter）、前後有沒有多出空白或看不見的字元。</li>
<li><b>讀值的精度</b>：查電源供應器規格書的電流回讀精度。T01 要分辨 5～30 mA，如果精度是「±0.2 % ＋ 10 mA」就分不出來，改用 DMM 的電流檔量。</li>
<li><b>量測的散佈</b>：拿一片確定是好的板子（工程師叫它 golden sample），手動操作儀器量 10 次。散佈（6 倍標準差，6σ）要遠小於公差。</li></ol>`,
{fn:repeatFig},
`<p>經驗法則：量測的散佈（6σ）<b>不到公差的十分之一</b>，測試站可以放心用；超過 <b>30 %</b>，測試站本身就不可靠，好的板子會被打成 FAIL，壞的也可能 PASS。（品保正式的做法叫量具重複性與再現性分析 GR&amp;R，原理一樣。）</p>`,
C.h3('⑤ 規劃','','流程寫成狀態機，上下限放在表裡'),
C.table(['狀態','做什麼','下一個'],[
 ['等序號','清空畫面，游標停在序號欄','條碼槍送 Enter → 檢查序號'],
 ['檢查序號','格式對嗎？今天測過幾次？','不對 → 等序號；對 → 等開始'],
 ['上電','電源 12 V、限流 1.5 A、OUTPUT ON，等穩定','逐項量測'],
 ['逐項量測','照測試項目表一項一項量，每量一項就比上下限','產線模式遇到 FAIL → 斷電；全部量完 → 斷電'],
 ['斷電','負載 OFF → 電源 OUTPUT OFF','記錄'],
 ['記錄','組一列，加到當天的 CSV','顯示結果'],
 ['顯示結果','大大的 PASS（綠）或 FAIL（紅）＋失敗項','等序號'],
 ['錯誤','任何一步有 error → 斷電 → 記 ERROR','等序號']
]),
ask('「斷電」為什麼要做成一個獨立的狀態，而不是寫在「逐項量測」的最後？',
 `<p>因為有<b>四條路</b>都要經過它：全部量完、產線模式中途 FAIL、儀器錯誤、使用者按停止。寫在量測的最後，中途離開的那三條就會漏掉，板子一直通電，作業員伸手拿板子時還帶著電；負載還在拉電流時拔板子，探針會打火。把它獨立出來，每一條路都指向它，就不會漏。</p>
 <p>順序也有講究：<b>先關負載、再關電源</b>。反過來的話，電源關掉的瞬間負載還在拉電流，有些負載會跳低電壓警報。</p>`),
C.plan({start:'專案資料夾 <code>練習\\實務\\Station</code>：Main.vi（狀態機）、Measure_All.vi、Judge.vi、Append_Line.vi、limits.csv。',
 in:'序號（字串，條碼槍）、開始按鈕（Latch）、工程模式開關；limits.csv（程式啟動時讀一次）；三台儀器的 VISA 資源名稱（放在設定檔，換機台時不用改程式）。',
 calc:'Judge.vi：序號用 Match Regular Expression 檢查；5 個量測值和上下限陣列丟進 In Range and Coerce，一次比完；And Array Elements → PASS；Search 1D Array 找第一個 False → 失敗項。',
 out:'結果大字（PASS／FAIL／儀器錯誤）、每一項的量測值和判定、當天的 CSV。',
 loop:'等序號時 100 ms 一圈（或用 Event Structure 等「序號改變」和「開始」）；量測時照流程一步一步走，儀器回應的時間決定速度。',
 end:'任何路徑都先進「斷電」；程式結束前再呼叫一次斷電、關閉三個 VISA session。'}),
C.h3('⑥ 一步一步寫','','Judge.vi：判定和組一列 CSV'),
`<p>Measure_All.vi 裡面是 VISA Write／Read，I 部分已經做過很多次。這裡寫判定和記錄：這是每一個測試站都會有、而且最常被寫錯的部分。</p>`,
{steps:{title:'Judge.vi：序號、上下限、失敗項、一列 CSV',lv:jd,steps:[
 {t:'序號格式：Match Regular Expression',view:'split',add:['sn','kre','mre','s1','s2','k0','ge','s3','s4','snok','s5'],h:`<p>${fn('Programming','String','Match Regular Expression')}：regular expression 接 <code>^PM5-[0-9]{8}$</code>。<code>^</code> 是開頭、<code>[0-9]{8}</code> 是 0～9 出現 8 次、<code>$</code> 是結尾。（也可以寫 <code>\\d{8}</code>，但字串常數如果開了「'\\' Codes Display」，反斜線會被當成跳脫碼；用 [0-9] 就沒有這個問題。）</p><p>找不到時 <b>offset past match 是 −1</b>，所以「≥ 0」就是格式正確。</p><p>Run 之後把序號改成 <code>PM5-2611001</code>（少一位）或 <code>PM5-26110001X</code>，燈都要熄。沒有 ^ 和 $ 的話，後面那個會被當成正確：試試看。</p>`},
 {t:'量測值和上下限陣列',view:'split',add:['board','meas','vals','m1','khi','klo','irc','m2','m3','m4'],h:`<p>Measure_All.vi 輸出 5 個量測值的陣列。上下限也各是一個 5 格的陣列，順序和測試項目表一樣（實機從 limits.csv 讀，W1 說過：會變的東西放在表裡）。</p><p>${fn('Programming','Comparison','In Range and Coerce')} 三個輸入都接陣列，它就<b>逐格比</b>，In Range? 輸出 5 個 Boolean。</p><p><b>注意邊界</b>：它預設<b>包含下限、不包含上限</b>。規格 S3 兩邊都含，所以要在節點上按右鍵，勾 <b>Include upper limit</b>。不勾的話，T02 剛好量到 5.100 V 會判 FAIL。驗收表 T9 就是測這個。</p>`},
 {t:'全部 PASS？加上序號',view:'split',add:['aae','j1','and','j2','j3','pass','j4','kP','kF','sel','j5','j6','j7','res','j8'],h:`<p>${fn('Programming','Boolean','And Array Elements')}：5 個都在範圍內。再和「序號格式正確」And 起來，才是 PASS。</p><p>Select 選出 "PASS" 或 "FAIL" 字串，等一下寫進檔案。</p>`},
 {t:'第一個失敗的項目',view:'split',add:['kF2','srch','f1','f2','knm','ia','f3','f4','fail1','f5'],h:`<p>和 W1 一樣：${fn('Programming','Array','Search 1D Array')} 在 In Range? 陣列裡找 False，得到第一個失敗的索引，再查名稱表。全部 PASS 時是 −1，名稱是空字串，剛好就是要寫進 CSV 的「失敗項：空白」。</p>`},
 {t:'組一列 CSV',view:'split',add:['kdt','dt','kff','c1','c2','c3','c4','c5','c6','kfmt','kdl','a2s','c7','c8','c9','c10','fis','line','c11','app','c12'],h:`<p>${fn('Programming','String','Array To Spreadsheet String')}：量測值陣列用 <code>%.4f</code>、逗號分隔，變成「17.0,5.02,…」<b>最後自動加換行</b>。所以把它放在這一列的最後一格，剛好結束這一列。</p>
 <p>時間用 ${fn('Programming','Timing','Format Date/Time String')}，格式 <code>%Y-%m-%d %H:%M:%S</code>（例如 2026-11-17 14:05:09）。不要用 Get Date/Time String：它預設沒有秒，而且格式跟著 Windows 的地區設定，中文 Windows 會變成「下午 02:05」，CSV 排不了序，W9 也匯入不了資料庫。</p>
 <p>${fn('Programming','String','Format Into String')} 往下拉到 5 個輸入，格式 <code>%s,%s,%s,%s,%s</code>：時間、序號、結果、失敗項、量測值。（「第幾次」由 Main.vi 查今天的紀錄後補上，Judge.vi 只管這一片。）</p>
 <p>Append_Line.vi 用 F 部分學過的寫法：Open/Create/Replace File（open or create）→ Set File Position 到檔尾 → Write to Text File → Close。<b>不要每次重寫整個檔案</b>：程式當掉時，最多只損失最後一列。</p>`},
 {t:'Run：換板子、改序號',view:'split',add:[],h:`<p>依序選四種板子 Run：良品全部 PASS；「輸出電壓偏低」第一個失敗是 T02；「效率不足」是 T05；「治具沒壓好」是 <b>T01</b>（因為 T01 有下限）。</p><p>把序號改錯，量測全部 PASS，結果仍是 FAIL。真正的測試站在「檢查序號」就擋下來，不會量；這裡是第二道防線。</p>`}
]}},
ask('上下限為什麼不做成前面板的數值控制項，讓工程師方便調？',
 `<p>前面板的東西作業員也碰得到。產線很忙時，「這片差一點點，調一下上限就過了」真的會發生，而且沒有紀錄。放在檔案裡（甚至加上檢查碼或放在只有工程師能寫的資料夾），改的時候走變更流程，CSV 裡也可以記下當時用的上下限版本，出問題時查得到。</p>`),
C.h3('⑦ 測試、交機','','在模擬測試站上照表測'),
`<p>下面是整個測試站。按「掃一片新的」（或自己在序號欄打字再按 Enter），選治具上的板子，按「開始測試」。照驗收表一條一條試，看 CSV 每一列長什麼樣子。</p>`,
{fn:stationSim},
C.table(['測試','操作','預期','規格'],[
 ['T1','序號打 <code>4712345678901</code>（像商品條碼）按 Enter','序號格式錯誤，不能開始','S1'],
 ['T2','良品測一片','5 項全 PASS，CSV 加一列，花費 ≤ 20 秒','S3、S5、S8'],
 ['T3','「輸出電壓偏低」測一片','停在 T02，後面不量；CSV 記 FAIL 和 T02','S4'],
 ['T4','按「重掃上一片」（等於再掃同一張標籤），再測一次','提示已測過，CSV 新增一列「第 2 次」，第 1 次的紀錄還在','S5'],
 ['T5','勾「工程模式」再測偏低的板子','5 項都量完，FAIL 的項目標紅','S4'],
 ['T6','「治具沒壓好」','T01 FAIL（電流太小），不會誤判成電壓不良','T01 下限'],
 ['T7','勾「DMM 的 USB 線鬆了」','等 2 秒逾時 → 儀器錯誤；電源和負載都 OFF；記 ERROR，不算 PASS','S6、S7'],
 ['T8','選「隨機」連測 20 片','良率合理（約 9 成）；每一片都有一列，沒有漏','S5'],
 ['T9','（實機）用一片 T02 剛好等於上限的板子，或暫時把上限改成量到的值','判 PASS：In Range and Coerce 有勾 Include upper limit','S3']
]),
`<p>交機資料：測試項目表（含版本與核准人）、limits.csv、接線與治具圖（哪個探針接哪台儀器）、儀器清單（型號、VISA 位址）、操作說明（作業員看的一頁）、這張驗收表、golden sample 量 10 次的紀錄。</p>`,
note('之後還會遇到的','實際的產線還會要求：上傳 MES（測試前問「這個序號可以測嗎」、測完回報結果）、條碼印標籤、每天開工先量 golden sample 確認測試站正常、儀器每年校正到期提醒。這些都是在同一個流程上多加幾個狀態。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'上下限最適合放在哪裡？',o:['檔案（limits.csv），改要走變更流程','前面板的數值控制項','方塊圖上的常數','作業員的筆記本'],a:0,ex:'作業員不能改，改了要有紀錄。'},
 {q:'無載輸入電流量到 0.2 mA（規格上限 30 mA），代表？',o:['很可能沒接上：探針沒壓好或沒放板子','非常省電的好板子','DMM 壞了','要調高上限'],a:0,ex:'所以要有下限。'},
 {q:'2 A 流過來回 0.05 Ω 的線，量在負載端子上會少多少？',o:['0.1 V','0.01 V','1 V','不會少'],a:0,ex:'V ＝ I × R ＝ 2 × 0.05。用四線量測量在板子上。'},
 {q:'Match Regular Expression 找不到時，offset past match 是？',o:['−1','0','字串長度','錯誤'],a:0,ex:'所以 ≥ 0 代表有找到。'},
 {q:'序號規則 ^PM5-[0-9]{8}$ 少了 ^ 和 $ 會怎樣？',o:['前後多出字元的序號也會被當成正確','完全找不到','只能找數字','沒有差別'],a:0,ex:'^ $ 鎖住開頭和結尾。'},
 {q:'DMM 逾時沒回應，這一片應該記成？',o:['ERROR，不算 PASS 也不算 FAIL，修好後重測','PASS','FAIL','不用記'],a:0,ex:'儀器壞掉時絕對不能判 PASS。'},
 {q:'量測散佈是公差的 40 %，代表？',o:['測試站本身不可靠，要先改善量測','可以上線','公差太寬','要多量幾次取最好的'],a:0,ex:'經驗法則：小於 10 % 放心，超過 30 % 不能用。'},
 {q:'為什麼斷電要做成獨立的狀態？',o:['完成、FAIL、錯誤、停止四條路都要經過它','比較好看','LabVIEW 規定','讓程式變快'],a:0,ex:'寫在量測最後，中途離開的路會漏掉。'}
]}
]});
})();
