/* 實務案例 W17：測試結果上傳 MES、過站檢查。
   職缺對照（docs/research_W17.md 第 5 節）：設備端和 MES 串接、確保資料傳輸完整（Y04）、生產資料回傳（S05）、串連設備與 MES／資料庫。
   和 W9 的分工：W9 教本機暫存＋背景上傳的骨架；這一課教「和別人的系統講話」：介面規格、過站檢查、逾時不等於沒收到、重複、永久和暫時的錯誤、和 IT 一起測。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
if(!LV.F['Flatten To JSON'])LV.F['Flatten To JSON']={g:'{ }',ins:['anything'],outs:['JSON string'],pal:['Functions','Programming','String','Flatten/Unflatten String','Flatten To JSON']};

/* ---- 圖：上傳模擬台 ----
   15 分鐘，前 10 分鐘每 10 秒測完一片（60 片）。一個上傳迴圈，一次送一筆。
   情境：正常；第 2～5 分鐘斷線（連不上，5 秒逾時）；第 2～5 分鐘 MES 很慢（其實收到了，但 6 秒才回，超過 5 秒逾時）；
        第 3 分鐘起 MES 改版，欄位名稱對不上（回 400，永久錯誤）。 */
const SC=[['ok','正常'],['down','第 2～5 分鐘網路斷線'],['slow','第 2～5 分鐘 MES 很慢（其實有收到，6 秒才回）'],['bad','第 3 分鐘起 MES 改版，欄位名稱對不上（回 400）']];
const ST=[['drop','① 測完直接送，失敗就算了（寫 log）'],['block','② 測完直接送，失敗就一直重送，成功才測下一片'],['fixed','③ 本機暫存，背景迴圈每 1 秒重送一次'],['backoff','④ 本機暫存，背景重送：1、2、4…最多 60 秒；400 不重送、亮燈']];
function simulate(sc,st,dedupe,seed){
  let x=seed||5;const rnd=()=>{x=(x*16807)%2147483647;return (x-1)/2147483646;};
  const down=t=>sc==='down'&&t>=120&&t<300,slow=t=>sc==='slow'&&t>=120&&t<300,bad=t=>sc==='bad'&&t>=180;
  const srv=new Map();let calls=0,made=0,stall=0,dupAck=0,alarmAt=null,lostLog=0;
  const q=[],parked=[];const hist=[];
  /* 送一次：回傳 {ok, perm, dur} */
  function send(id,t){
    calls++;
    if(down(t))return {ok:false,dur:5};
    if(bad(t))return {ok:false,perm:true,dur:0.3};
    const rec=()=>{if(dedupe&&srv.has(id)){dupAck++;return;}srv.set(id,(srv.get(id)||0)+1);};
    if(slow(t)){rec();return {ok:false,dur:5};}       // MES 寫進去了，回應卻超過逾時
    rec();return {ok:true,dur:0.3};
  }
  let next=0,busy=0,blockId=null,blockNext=0,gate=0,streak=0;
  for(let t=0;t<900;t++){
    if(st==='block'){
      if(blockId!==null){ if(t>=blockNext){const r=send(blockId,t);if(r.ok){blockId=null;next=Math.max(next,t+Math.ceil(r.dur));}else blockNext=t+Math.ceil(r.dur);} if(blockId!==null&&t>=next)stall++; }
      else if(t<600+stall&&t>=next&&made<60){made++;const r=send(made,t);next=t+10;if(!r.ok){blockId=made;blockNext=t+Math.ceil(r.dur);}}
    }else{
      if(t<600&&t>=next){made++;next=t+10;
        if(st==='drop'){const r=send(made,t);if(!r.ok)lostLog++;}
        else q.push({id:made,at:t,tries:0});}
      if(st!=='drop'&&t>=busy&&t>=gate&&q.length){         // 上傳迴圈：一次送最舊的一筆
        const it=q[0];const r=send(it.id,t);busy=t+Math.max(1,Math.ceil(r.dur));
        if(r.ok){q.shift();streak=0;gate=0;}
        else if(st==='backoff'&&r.perm){q.shift();parked.push(it);if(alarmAt===null)alarmAt=t;}
        else{streak++;gate=st==='fixed'?busy+1:busy+Math.min(60,Math.pow(2,streak-1))*(1+0.5*rnd());}
      }
    }
    hist.push({p:q.length+(blockId!==null?1:0),r:srv.size,m:made});
  }
  let dups=0;srv.forEach(v=>dups+=v-1);
  const pend=q.length+(blockId!==null?1:0);
  return {made,got:srv.size,dups,pend,parked:parked.length,lost:made-srv.size-pend-parked.length,calls,stall,dupAck,alarmAt,hist,lostLog};
}
function mesFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<div style="font-size:13px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 8px;align-items:center">
   <b>網路／MES</b><select data-k="sc" style="width:100%;min-width:0">${SC.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select>
   <b>測試站怎麼送</b><select data-k="st" style="width:100%;min-width:0">${ST.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select>
   <b>MES 端</b><label><input type="checkbox" data-k="dd"> MES 用 test_id 檢查重複：已經有的回「已收到」，不再新增</label></div>
   <canvas data-o="cv" width="600" height="140" style="max-width:100%;background:#fff;border:1px solid #dde;margin-top:8px"></canvas>
   <div data-o="out" style="font-size:13px"></div>`;
  const g=k=>el.querySelector('[data-k='+k+']'),cv=el.querySelector('[data-o=cv]'),c=cv.getContext('2d');
  function draw(){
    const R=simulate(g('sc').value,g('st').value,g('dd').checked,11);
    const W=cv.width,H=cv.height,x0=34,y0=H-22,x1=W-8,y1=10,X=t=>x0+(x1-x0)*t/900,Y=v=>y0-(y0-y1)*v/60;
    c.clearRect(0,0,W,H);c.font='11px sans-serif';c.strokeStyle='#e5e5e5';c.fillStyle='#666';
    for(let m=0;m<=15;m+=3){c.beginPath();c.moveTo(X(m*60),y0);c.lineTo(X(m*60),y1);c.stroke();c.fillText(m+' 分',X(m*60)-8,y0+14);}
    [0,30,60].forEach(v=>{c.fillText(v,8,Y(v)+4);});
    const sc=g('sc').value;if(sc!=='ok'){c.fillStyle='rgba(192,57,43,.08)';const a=sc==='bad'?180:120,b=sc==='bad'?900:300;c.fillRect(X(a),y1,X(b)-X(a),y0-y1);}
    const line=(k,col)=>{c.strokeStyle=col;c.lineWidth=2;c.beginPath();R.hist.forEach((h,t)=>{t?c.lineTo(X(t),Y(h[k])):c.moveTo(X(t),Y(h[k]));});c.stroke();c.lineWidth=1;};
    line('m','#999');line('r','#1e7b34');line('p','#c0392b');
    c.fillStyle='#999';c.fillText('灰：測完幾片',x0+6,y1+10);c.fillStyle='#1e7b34';c.fillText('綠：MES 有幾片（不重複）',x0+90,y1+10);c.fillStyle='#c0392b';c.fillText('紅：等著上傳',x0+250,y1+10);
    const st=g('st').value,cl=(v,bad)=>`<b style="color:${bad?'#c0392b':'#1e7b34'}">${v}</b>`;
    let msg=[];
    if(R.lost>0)msg.push(['r',`遺失 ${R.lost} 片：測過了，MES 卻沒有紀錄，也沒有地方可以補。${st==='drop'?'「寫 log」不等於資料還在：沒有人會去看 log 補傳。':''}`]);
    if(R.dups>0)msg.push(['r',`重複 ${R.dups} 筆：MES 其實收到了，只是回應超過逾時，測試站以為失敗又送一次。<b>逾時不等於沒收到。</b>MES 沒有用 test_id 檢查，同一片就有兩筆。`]);
    if(st==='drop'&&g('sc').value==='slow')msg.push(['y',`測試站的 log 記了 ${R.lostLog} 筆「上傳失敗」，其實 MES 都收到了。逾時不等於沒收到：看 log 的人會以為資料不見了。`]);
    if(R.dupAck>0)msg.push(['g',`MES 回了 ${R.dupAck} 次「已收到」：重送的那幾筆沒有變成重複，測試站把暫存檔刪掉就好。`]);
    if(R.stall>0)msg.push(['r',`產線停了 ${Math.round(R.stall/60)} 分 ${R.stall%60} 秒：上傳卡住，作業員只能等。${g('sc').value==='bad'?'而且<b>永遠不會好</b>：欄位名稱不對，重送一百次也是 400。':''}`]);
    if(st==='fixed'&&R.calls>200)msg.push(['r',`對 MES 送了 ${R.calls} 次。每秒重送一次，${g('sc').value==='bad'?'而且 400 是永久錯誤，送再多次也一樣，':''}MES 恢復的那一刻，全廠的測試站一起湧進去。`]);
    if(R.parked>0)msg.push(['y',`第 ${Math.floor(R.alarmAt/60)} 分 ${R.alarmAt%60} 秒亮燈：MES 回 400（格式錯），這是<b>永久錯誤</b>，重送沒用。${R.parked} 筆擱置在本機，不會遺失；通知工程師和 IT 對規格，修好之後再把擱置的重新送。`]);
    if(R.pend>0&&!R.parked)msg.push(['y',`還有 ${R.pend} 筆在等著上傳。`]);
    if(!msg.length)msg.push(['g','60 片全部進了 MES，沒有重複、沒有遺失。']);
    el.querySelector('[data-o=out]').innerHTML=`<table class="tbl" style="margin-top:6px"><tr><th>測完</th><th>MES 有（不重複）</th><th>重複</th><th>遺失</th><th>擱置／等待</th><th>呼叫 MES 次數</th><th>產線被卡住</th></tr>
     <tr><td>${R.made}</td><td>${R.got}</td><td>${cl(R.dups,R.dups>0)}</td><td>${cl(R.lost,R.lost>0)}</td><td>${R.parked}／${R.pend}</td><td>${cl(R.calls,R.calls>200)}</td><td>${cl(R.stall+' 秒',R.stall>0)}</td></tr></table>
     ${msg.map(([k,t])=>`<div style="border-left:3px solid ${k==='r'?'#c0392b':k==='y'?'#b9770e':'#1e7b34'};padding:2px 8px;margin:4px 0">${t}</div>`).join('')}`;
  }
  el.querySelectorAll('select,input').forEach(s=>s.onchange=draw);draw();
}

/* ---- 一步一步寫：Upload.vi（送一筆，判斷結果） ---- */
const NET=['正常（200）','MES 連不上（逾時）','欄位名稱打錯（400）','MES 內部錯誤（500）'];
const JS='{"test_id":"ST01-20261117-000123","sn":"PM5-26110457","station":"ST01","result":"PASS","items":[{"id":"T03","value":4.975}]}';
const uv={name:'Upload.vi',view:'split',ratio:1.5,
 fp:{w:360,h:300,items:[
  {id:'net',k:'enum',ctl:true,label:'這一次 MES 怎麼回（模擬用）',options:NET,x:12,y:8,v:0},
  {id:'json',k:'str',label:'JSON string',x:12,y:64,w:330,h:60},
  {id:'code',k:'num',label:'狀態碼',x:12,y:150,w:60},
  {id:'outc',k:'str',label:'結果',x:110,y:150,w:230},
  {id:'eo',k:'led',label:'error out 的 status',color:'red',x:12,y:220}]},
 bd:{w:1240,h:360,structs:[{id:'cs',k:'case',x:800,y:150,w:230,h:120,frames:['2','4','Default'],cur:0}],
  nodes:[
  {id:'rec',k:'ctl',t:'clu',label:'rec（test_id, sn, station, result, items）',x:20,y:40},
  {id:'fj',k:'fn',fn:'Flatten To JSON',x:150,y:40},
  {id:'json',k:'ind',t:'str',label:'JSON string',x:230,y:120},
  {id:'hd',k:'ctl',t:'visa',label:'client handle（程式開頭 OpenHandle）',x:20,y:200},
  {id:'kurl',k:'const',t:'str',v:'http://mes.local/api/results',x:60,y:250},
  {id:'kto',k:'const',t:'i32',v:5000,x:220,y:300,label:'timeout ms'},
  {id:'post',k:'sub',name:'POST.vi（HTTP Client）',icon:['HTTP','POST'],ins:['client handle','url','timeout (ms)','buffer','error in'],outs:['headers','body','error out'],x:380,y:180,w:64,h:100,color:'#5a6b7d'},
  {id:'kfmt',k:'const',t:'str',v:'HTTP/%f %d',x:430,y:60},
  {id:'scan',k:'fn',fn:'Scan From String',ins:['input string','format string'],outs:['output 1','output 2'],x:560,y:150,h:40},
  {id:'code',k:'ind',t:'i32',label:'狀態碼',x:660,y:60},
  {id:'k100',k:'const',t:'i32',v:100,x:640,y:230},
  {id:'qr',k:'fn',fn:'Quotient & Remainder',x:700,y:180},
  {id:'csel',k:'sel',t:'i32',s:'cs',y:196},
  {id:'kok',k:'const',t:'str',v:'送達：刪掉暫存檔',x:860,y:200},
  {id:'tc',k:'tunnel',t:'str',s:'cs',side:'r',y:212},
  {id:'ub',k:'fn',fn:'Unbundle By Name',outs:['status'],x:560,y:300},
  {id:'ktmp',k:'const',t:'str',v:'暫時錯誤：稍後重送',x:900,y:300},
  {id:'sel',k:'fn',fn:'Select',x:1080,y:226},
  {id:'outc',k:'ind',t:'str',label:'結果',x:1150,y:234},
  {id:'eo',k:'ind',t:'err',label:'error out',x:1150,y:310}],
  wires:[
  {id:'w1',from:'rec',to:'fj',t:'clu'},
  {id:'w2',from:'fj.JSON string',to:'json',t:'str',mx:215},
  {id:'w3',from:'fj.JSON string',to:'post.buffer',t:'str',mx:215},
  {id:'w4',from:'hd',to:'post.client handle',t:'visa'},
  {id:'w5',from:'kurl',to:'post.url',t:'str',mx:340},
  {id:'w6',from:'kto',to:'post.timeout (ms)',t:'i32',mx:350},
  {id:'w7',from:'post.headers',to:'scan.input string',t:'str',mx:500},
  {id:'w8',from:'kfmt',to:'scan.format string',t:'str',mx:540},
  {id:'w9',from:'scan.output 2',to:'code',t:'i32',mx:640},
  {id:'w10',from:'scan.output 2',to:'qr.x',t:'i32',mx:640},
  {id:'w11',from:'k100',to:'qr.y',t:'i32',mx:688},
  {id:'w12',from:'qr.IQ',to:'csel',t:'i32'},
  {id:'w13',from:'kok',to:'tc.i',t:'str'},
  {id:'w14',from:'post.error out',to:'ub',t:'err',mx:470},
  {id:'w15',from:'ub.status',to:'sel.s',t:'bool',pts:[[620,316],[1060,316],[1060,242],[1080,242]]},
  {id:'w16',from:'ktmp',to:'sel.t',t:'str',pts:[[1050,307],[1050,233],[1080,233]]},
  {id:'w17',from:'tc.o',to:'sel.f',t:'str',pts:[[1046,212],[1046,251],[1080,251]]},
  {id:'w18',from:'sel.out',to:'outc',t:'str'},
  {id:'w19',from:'post.error out',to:'eo',t:'err',pts:[[470,262],[470,340],[1130,340],[1130,318],[1150,318]]}]},
 sim:{init:()=>({}),
  step(inp){
   const n=+inp.net||0;
   const code=[200,0,400,500][n],err=n===1;
   const out=n===0?'送達：刪掉暫存檔':n===1?'暫時錯誤：稍後重送':n===2?'格式錯誤：不要重送，擱置、亮燈、通知工程師':'暫時錯誤：稍後重送';
   const frame=n===2?'4':n===0?'2':'Default';
   return {out:{json:JS,code,outc:out,eo:err},
    vals:{'fj.JSON string':'{"test_id":…}',kurl:'http://mes.local/api/results',kto:5000,'post.headers':n===1?'（空的：沒有回應）':'HTTP/1.1 '+code+' …','scan.output 2':n===1?0:code,k100:100,'qr.IQ':n===1?0:Math.floor(code/100),'ub.status':err,'sel.out':out},
    msg:(n===1?'逾時：POST.vi 的 error out 有錯（status ＝ True），Select 選「暫時錯誤」。':'狀態碼 '+code+' → 除以 100 得 '+Math.floor(code/100)+' → Case 的「'+frame+'」頁。')+' 結果：'+out};},
  doneMsg:'換一種 MES 的回應再 Run'}
};

L.push({id:'W17',order:30.997,no:'W17',part:PART,title:'上傳 MES：測之前先問能不能測，測完的結果不遺失、不重複',mins:75,files:['練習\\實務\\Station\\Upload.vi'],
goals:[['學會','和 IT 談介面規格：方式、欄位、回應的意義、逾時、唯一鍵；過站檢查為什麼要在上電之前、MES 連不上時怎麼辦是品質政策；逾時不等於沒收到，所以一定會重送，接收端要用唯一鍵去重；暫時錯誤（逾時、5xx）才重送，永久錯誤（4xx）要停下來通知人；重送間隔要越來越長；Flatten To JSON 的欄位名稱和 enum 限制；和 IT 一起做整合測試。'],['做出','在上傳模擬台上找出不遺失、不重複、不卡產線、不打爆 MES 的組合；Upload.vi：送一筆，依回應分成送達、暫時錯誤、永久錯誤。'],['為什麼是這個題目','設備和測試的職缺會寫「設備端和資料庫、MES 串接，確保資料傳輸完整」「生產資料回傳」「串連設備、MES、ERP、資料庫」。MES 本身多半是 IT 用 C#、SQL 寫的；測試站工程師的工作是<b>照 MES 的介面把資料送過去</b>，而且在網路不好的時候也不能出錯。']],
check:'不看課文，能列出要向 IT 問的介面問題、說出過站檢查為什麼要在上電前做、為什麼逾時之後重送會造成重複、怎麼避免，以及哪些錯誤該重送、哪些不該。',
body:[
C.h3('這一課的工作','x','和別人的系統講話'),
`<p>W9 已經做過「先寫本機暫存、背景迴圈上傳、成功才刪」的骨架。這一課的對象換成工廠的 MES（製造執行系統）：它不是你寫的，是 IT 部門的；它會反過來<b>管你</b>：這一片能不能測、測完往哪裡送。和別人的系統講話，最重要的是<b>先把規則講清楚、寫下來</b>。</p>`,
C.h3('① 聽懂需求','','IT 課長的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「工廠下個月上 MES。測試站每測完一片，結果要即時上傳；而且測之前要先問 MES 這個序號能不能測，上一站沒過的不能測。介面規格書下週給你，你們那邊先準備。」</p></div>`,
ask('拿到規格書之前，你要先準備好哪些問題？',
 `<ol><li><b>用什麼方式？</b>HTTP（Web API）、TCP 自訂格式、MQTT、資料庫中介表，還是丟檔案？網址、埠號、要不要帳號或金鑰、有沒有 HTTPS 憑證？</li>
 <li><b>欄位和格式</b>：每個欄位的名稱（大小寫）、型別、單位、時間格式和時區、中文用什麼編碼？</li>
 <li><b>回應的意義</b>：成功回什麼？格式錯回什麼？MES 自己出問題回什麼？「已經收過了」回什麼？</li>
 <li><b>重複怎麼辦</b>：我逾時之後重送，MES 會不會多一筆？用哪個欄位判斷是同一筆？</li>
 <li><b>逾時</b>：MES 平常多久回？最慢多久？我等幾秒算失敗？</li>
 <li><b>MES 掛掉時產線能不能測？</b>這不是 IT 能決定的，要品保決定（④ 講）。</li>
 <li><b>有沒有測試環境？</b>不能拿正式的 MES 練習。</li></ol>
 <p>這些問題問清楚、寫進規格書、雙方簽名，之後出問題才有依據。</p>`),
C.h3('② 介面規格','','雙方簽名的那一份'),
C.table(['編號','規格'],[
 ['M1','過站檢查：<code>POST /api/route-check</code>，送 <code>{"sn":…,"station":…}</code>，回 <code>{"allow":true}</code> 或 <code>{"allow":false,"reason":"上一站 FCT 未通過"}</code>。逾時 2 秒'],
 ['M2','上傳結果：<code>POST /api/results</code>，送 test_id、sn、station、result（"PASS"／"FAIL"，字串）、time（ISO 8601，含 +08:00）、items（每一項的 id、value、lo、hi）。逾時 5 秒'],
 ['M3','<b>test_id 是唯一鍵</b>（站號＋日期＋流水號，W9 已經有）。MES 收到已經有的 test_id，回 200 和 <code>{"status":"duplicate"}</code>，不再新增'],
 ['M4','回應：200 成功（accepted 或 duplicate）；4xx 是送的內容有錯，重送也一樣；5xx 或逾時是暫時的，可以重送'],
 ['M5','測試站的重送間隔 1、2、4… 秒，最多 60 秒，加 0～50 % 的隨機值；待上傳超過 100 筆或最舊的超過 30 分鐘，畫面亮燈'],
 ['M6','字元 UTF-8；欄位名稱全部小寫英文']
]),
C.table(['編號','品質政策（品保決定）'],[
 ['P1','過站檢查 2 秒沒回應：<b>離線模式</b>，可以先測，最多 30 分鐘；離線測的每一筆標 offline，恢復後 MES 補做檢查，不合規的序號由品保追'],
 ['P2','MES 回 allow:false：不能測，畫面顯示 MES 給的原因；作業員不能跳過'],
 ['P3','FAIL 之後重測：MES 規定要先到維修站登記，回來才能重測']
]),
C.h3('③ 盤點','','串接方式和 LabVIEW 的工具'),
C.table(['方式','怎麼做','適合','要注意'],[
 ['HTTP（Web API）＋ JSON','對 MES 的網址送 POST，內容是 JSON','新的 MES 多半有；瀏覽器、Postman 就能試','每次都要等它回；POST 重送可能變兩筆（④）'],
 ['TCP 自訂格式','開一條 TCP 連線，照 MES 給的格式送字串','舊系統；很快','格式是自訂的；訊息從哪裡結束要自己處理'],
 ['MQTT','發布到 broker 的主題，MES 訂閱','很多設備一起送；送完就走','要多架 broker；「能不能測」這種要立刻回答的比較不自然；QoS 1 會重複'],
 ['資料庫中介表','寫進 IT 開的一張表，MES 定時來讀','W9 的技巧就夠','有延遲，過站檢查不能即時'],
 ['檔案交換','CSV／XML 丟進共用資料夾','最簡單','格式一改就壞；要防 MES 讀到寫一半的檔（先寫 .tmp 再改名）']
]),
C.table(['LabVIEW 2018 的工具','內建？','重點'],[
 ['HTTP Client（Data Communication ▸ Protocols ▸ HTTP Client）','內建','OpenHandle → AddHeader → POST → CloseHandle；timeout 單位是 ms，預設 10 秒，對測試站太長；HTTPS 要用 ConfigSSL 設憑證'],
 ['Flatten To JSON／Unflatten From JSON','內建（2013 起）','Cluster 元素的標籤就是 JSON 的欄位名稱；<b>不支援 enum</b>；Unflatten 時 JSON 少了欄位會整筆錯誤，多的欄位預設忽略'],
 ['TCP','內建','TCP Read 要決定怎麼知道一則訊息結束（CRLF 模式或先讀長度）'],
 ['MQTT','<b>不內建</b>','VIPM 上有開放原始碼的 MQTT Client 套件，也有商用的；裝之前先確認授權和版本']
]),
`<p>主線用 HTTP ＋ JSON：LabVIEW 內建就能做，也最容易驗證。換一家公司，第一件事是問 IT 用哪一種。</p>`,
C.h3('④ 過站檢查','','測之前先問'),
`<p>流程：掃序號 → <b>問 MES 能不能測</b> → 可以才上電量測 → 測完上傳 → MES 把這一片排到下一站（PASS）或維修站（FAIL）。</p>`,
ask('為什麼過站檢查要在上電之前做，而且不能像上傳一樣丟給背景迴圈慢慢送？',
 `<p>它是「能不能測」的答案。測完才知道「這一片上一站沒過」，已經浪費一次測試，更糟的是作業員可能已經把它放進 PASS 區。上傳結果晚幾分鐘到 MES 沒關係；過站檢查晚了就沒有意義。</p>
 <p>所以兩者的做法不同：過站檢查是<b>同步</b>的，逾時要短（2 秒），沒回應就照 P1 的政策處理；上傳結果是<b>非同步</b>的，交給背景迴圈，慢一點、重送幾次都沒關係。</p>`),
ask('MES 2 秒沒回應，為什麼不由你決定「停線」或「先測再說」？',
 `<p>兩種都有代價。停線：產線一小時幾百片的產能沒了。先測：可能測了不該測的板子（例如上一站其實沒過），要事後追。哪一種風險比較能接受，是品保和生產主管的決定，寫進規格（P1），程式照著做。<b>寫程式的人不要自己決定品質政策</b>，但要把選項和代價講清楚給他們。</p>`),
warn('擋，不是警告','MES 回 allow:false 時，畫面跳出「警告：上一站未通過，是否繼續？」讓作業員按「是」，就等於沒有過站檢查。作業員趕產量時一定會按「是」。要擋就真的擋，P2 寫的就是這件事。'),
C.h3('⑤ 斷線、逾時、重複','','在模擬台上試'),
`<p>下面是 15 分鐘的產線：前 10 分鐘每 10 秒測完一片，共 60 片。先選一種網路狀況，再換測試站的送法，看 MES 最後收到什麼。目標：<b>不遺失、不重複、不卡產線、不打爆 MES</b>，而且四種網路狀況都要過。</p>`,
{fn:mesFig},
ask('選「MES 很慢」，用 ③ 或 ④，不勾 MES 的重複檢查：為什麼會有重複？',
 `<p>MES 其實已經把資料寫進去了，只是 6 秒才回，超過測試站等的 5 秒。測試站看到逾時，以為失敗，過一陣子再送一次：MES 又寫一筆。</p>
 <p><b>逾時只代表「我沒等到回答」，不代表「對方沒收到」。</b>只要會重送，就一定會有重複，這是躲不掉的。解法不在測試站，而在介面規格：每一筆帶一個唯一鍵（M3 的 test_id），MES 看到已經有的，回「已收到」不新增。勾起 MES 的重複檢查再跑一次。</p>
 <p>所以 test_id 要在<b>測試站產生</b>、寫進暫存檔，重送時用同一個。如果每次送的時候才產生新的 test_id，去重就失效了。</p>`),
ask('選「MES 改版，欄位名稱對不上」，比較 ③ 和 ④。',
 `<p>MES 回 400：你送的內容它看不懂。這是<b>永久錯誤</b>，重送一百次也一樣。③ 每秒重送，幾分鐘就打了幾百次，而且沒有人知道出事了。④ 把 4xx 和暫時錯誤分開：4xx 不重送，那幾筆擱置在本機（不會遺失），畫面亮燈、通知工程師去和 IT 對規格。修好之後再把擱置的重新送。</p>
 <p>② 更糟：上傳卡住，測試迴圈跟著卡住，產線直接停了，而且永遠不會自己好。這就是為什麼上傳一定要和測試分開（W9、W12 的生產者／消費者）。</p>`),
ask('④ 的重送間隔為什麼要越來越長，還要加隨機值？',
 `<p>MES 掛掉時，全廠可能有幾十台測試站在重送。每台每秒一次，MES 一恢復就被同時湧進來的請求再打掛一次。間隔越來越長（1、2、4… 最多 60 秒），斷越久送越少；加隨機值，各台就不會剛好在同一秒一起送。模擬台裡比較 ③ 和 ④ 的「呼叫 MES 次數」就看得出來。</p>`),
C.h3('⑥ 寫程式','','Upload.vi：送一筆，判斷結果'),
`<p>上傳迴圈（W9 的消費者）每次從暫存資料夾拿最舊的一筆，呼叫 Upload.vi，依結果決定：刪掉暫存檔、稍後重送，或擱置並亮燈。</p>`,
{steps:{title:'Upload.vi：JSON → POST → 狀態碼 → 三種結果',lv:uv,steps:[
 {t:'Cluster 變 JSON',view:'split',add:['net','rec','fj','w1','json','w2'],h:`<p>${fn('Programming','String','Flatten/Unflatten String','Flatten To JSON')}：Cluster 每個元素的<b>標籤</b>就是 JSON 的欄位名稱。所以標籤要和規格（M6）一模一樣：<code>sn</code> 不能寫成 <code>SN</code> 或 <code>序號</code>。</p><p>result 用字串 "PASS"／"FAIL"，不要用 enum：Flatten To JSON 不支援 enum。數值的 NaN、Inf 不是標準 JSON，ERROR 的量測值要先決定怎麼表示（例如不送那一項，或送 null），也寫進規格。</p>`},
 {t:'POST',view:'split',add:['hd','post','w3','w4','kurl','w5','kto','w6'],h:`<p>client handle 在程式開頭用 OpenHandle 開一次（標頭，例如金鑰，用 AddHeader 加在 handle 上），結束時 CloseHandle。每一筆只呼叫 POST.vi：url、timeout、buffer（JSON 字串）。</p><p>timeout 設 5000 ms（M2）。預設的 10 秒對上傳迴圈來說太長；過站檢查用另一個 VI，timeout 2000 ms。</p>`},
 {t:'取出狀態碼',view:'split',add:['kfmt','scan','w7','w8','code','w9'],h:`<p>HTTP 的回應第一行長這樣：<code>HTTP/1.1 200 OK</code>。Scan From String 用 <code>HTTP/%f %d</code>：%f 吃掉版本 1.1，%d 拿到 200。（POST.vi 回傳的 headers 字串格式，在你的 LabVIEW 版本上先用一個簡單的網址試一次，確認第一行是什麼。）</p>`},
 {t:'分成三種結果',view:'split',add:['k100','qr','w10','w11','csel','w12','cs','kok','tc','w13','ub','w14','ktmp','sel','w15','w16','w17','outc','w18','eo','w19'],h:`<p>狀態碼除以 100，拿商：2 是成功，4 是你送的內容有錯，其他（5）是 MES 自己的問題。Case 的「2」頁輸出「送達」；「4」頁輸出「格式錯誤：不要重送，擱置、亮燈」；Default 頁輸出「暫時錯誤：稍後重送」。（圖上只看得到「2」頁，用 Case 上方的箭頭切換。）</p><p>連不上、逾時的時候根本沒有狀態碼，POST.vi 的 error out 會有錯。所以最後用 error 的 status 選：有錯就是「暫時錯誤」。error out 也要往外傳，讓上傳迴圈記錄錯誤碼。</p><p>200 的時候，body 裡的 <code>"status"</code> 是 accepted 或 duplicate，兩種都算送達：都可以刪掉暫存檔。</p>`},
 {t:'Run：四種回應',view:'split',add:[],h:`<p>依序選四種回應各 Run 一次，看狀態碼走到 Case 的哪一頁、最後的結果是什麼。這三種結果，就是模擬台 ④ 的三條路：刪掉、稍後重送、擱置亮燈。</p>`}
]}},
C.h3('⑦ 和 IT 一起測','','上線前的整合測試'),
`<p>上線前和 IT 約一個時間，在<b>測試用的 MES</b> 上一條一條跑。每一條都要雙方看到結果、簽名。</p>`,
C.table(['項次','做法','預期'],[
 ['I1','正常測 10 片','MES 有 10 筆，欄位、單位、時間（含時區）都對'],
 ['I2','同一筆 test_id 送兩次','MES 回 duplicate，只有一筆'],
 ['I3','故意送錯欄位名稱','MES 回 400，測試站擱置、亮燈，不重送'],
 ['I4','IT 把測試用 MES 停 5 分鐘，產線照測','暫存累積；恢復後補齊，沒有重複、沒有遺失；重送間隔有拉長'],
 ['I5','IT 讓 MES 故意延遲 6 秒回應','測試站逾時重送，MES 靠 test_id 去重，只有一筆'],
 ['I6','掃一個上一站沒過的序號','畫面顯示 MES 的原因，不能上電、不能測'],
 ['I7','過站檢查時把網路線拔掉','2 秒後進離線模式，畫面清楚標示；那幾筆上傳時標 offline'],
 ['I8','測試站程式在上傳中途被強制結束，再開','暫存檔還在，重開後補傳，沒有重複']
]),
tip('自己先模擬一個 MES','IT 的測試環境常常排不到時間。用 LabVIEW 自己寫一個簡單的 Web 服務（或用 Postman 之類工具的模擬功能）照規格回 200、400、500、延遲，先把自己這一邊測完，到時候只要和 IT 對一次。'),
note('這一課用到的前面的東西','W6 的測試站和序號、W9 的 test_id 和暫存上傳、W12 的生產者／消費者和「Queue 要有上限」、W16 的「上傳不要擋住節拍」、W14 的「用資料說話」（MES 上的資料也是除錯的線索）。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'上傳逾時了，代表？',o:['不知道 MES 有沒有收到','MES 一定沒收到','MES 一定收到了','網路斷了'],a:0,ex:'逾時只代表沒等到回答。'},
 {q:'怎麼讓重送不會變成兩筆？',o:['每筆帶一個在測試站產生的唯一鍵，MES 看到已有的就回「已收到」','不要重送','重送前先等 10 分鐘','每次送都產生新的 test_id'],a:0,ex:'唯一鍵要在測試站產生、重送時用同一個。'},
 {q:'MES 回 400，應該？',o:['不重送，擱置並通知工程師','每秒重送','丟掉這一筆','改成 500 再送'],a:0,ex:'4xx 是送的內容有錯，重送也一樣。'},
 {q:'MES 回 503 或逾時，應該？',o:['稍後重送，間隔越來越長','立刻停線','丟掉','每秒重送一次直到成功'],a:0,ex:'暫時錯誤才重送，而且要退避。'},
 {q:'過站檢查和上傳結果的差別？',o:['過站檢查要在上電前同步得到答案；上傳可以在背景慢慢送','兩個都可以背景送','兩個都要同步','過站檢查可以測完再做'],a:0,ex:'能不能測，要在測之前知道。'},
 {q:'MES 連不上時能不能先測，由誰決定？',o:['品保（寫進規格）','寫程式的人','作業員','IT'],a:0,ex:'這是品質政策。'},
 {q:'Flatten To JSON 的欄位名稱從哪裡來？',o:['Cluster 元素的標籤','Cluster 的順序','前面板的標題','自動產生'],a:0,ex:'所以標籤要和規格一模一樣。'},
 {q:'result 欄位為什麼用字串 "PASS"，不用 enum？',o:['Flatten To JSON 不支援 enum','字串比較快','enum 太大','MES 規定'],a:0,ex:'先轉成字串或數字。'}
]}
]});
})();
