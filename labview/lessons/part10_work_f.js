/* 實務案例 W9：測試結果寫進資料庫、用序號追溯。接續 W6（測試站）和 W8（上限寫錯的舊程式）。
   職缺對照（docs/job_research.md 第 G 組）：測試結果寫進 SQL 資料庫、串 MES、建立追溯、序號防呆、報表與查詢畫面。
   網頁上的資料庫是用 JavaScript 寫的小型模擬，只支援課文用到的 SQL 子集。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;

/* ---------- 產生三天的測試資料（固定亂數，每次一樣） ---------- */
function rng(seed){let h=seed>>>0;return ()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return ((h>>>0)%1000000)/1000000;};}
function makeDB(){
  const r=rng(20261114),tests=[],meas=[];let id=1000,sn=26110400;
  const ITEMS=[['T01',5,30],['T02',4.90,5.10],['T03',4.85,null],['T04',0,1.5],['T05',85,100]];
  const days=['2026-11-14','2026-11-15','2026-11-16'],ops=['A12','A07','B03','B11'];
  for(let d=0;d<3;d++)for(let k=0;k<110;k++){
    const st=k%2?'ST02':'ST01';const mins=8*60+Math.floor(k*4.3+r()*3);const hh=String(Math.floor(mins/60)).padStart(2,'0'),mm=String(mins%60).padStart(2,'0'),ss=String(Math.floor(r()*60)).padStart(2,'0');
    const ts=days[d]+' '+hh+':'+mm+':'+ss;
    const ver=(d<2||(d===2&&mins<10*60))?'L1.0':'L1.1',t3hi=ver==='L1.0'?5.15:5.10;
    const s='PM5-'+(++sn);
    let v=[17+(r()-.5)*3,5.02+(r()-.5)*.02,4.975+(r()-.5)*.03,0,88.6+(r()-.5)*1.2];
    let kind=r();
    if(s==='PM5-26110457'){v[1]=5.092;v[2]=5.121;kind=0.5;}
    else if(kind<0.04){v[1]=4.86;v[2]=4.80;}
    else if(kind<0.06){v[4]=82.5;}
    else if(kind<0.1){v[1]=5.085+r()*0.01;v[2]=5.105+r()*0.03;}
    v[3]=Math.abs(v[1]-v[2])/v[1]*100;
    const runOne=(vals,tsx)=>{
      const tid=++id;let res='PASS',fi='';
      const rows=ITEMS.map((it,i)=>{const hi=it[0]==='T03'?t3hi:it[2];const p=vals[i]>=it[1]&&vals[i]<=hi;if(!p&&res==='PASS'){res='FAIL';fi=it[0];}return {test_id:tid,item:it[0],value:+vals[i].toFixed(4),lo:it[1],hi,pass:p?1:0};});
      tests.push({test_id:tid,sn:s,station:st,operator:ops[(d*2+k)%4],ts:tsx,result:res,fail_item:fi,limits_ver:ver,sw_ver:ver==='L1.0'?'1.0.0':'1.1.0'});meas.push(...rows);return res;};
    const res=runOne(v,ts);
    // 有幾片 FAIL 之後被拿去重測，第二次 PASS（重測到 PASS 為止的痕跡）
    if(res==='FAIL'&&r()<0.5){const v2=v.slice();if(v2[4]<85)v2[4]=85.4;if(v2[1]<4.9){v2[1]=4.905;v2[2]=4.86;}v2[3]=Math.abs(v2[1]-v2[2])/v2[1]*100;if(v2[2]>t3hi)v2[2]=t3hi-0.001;const m2=mins+2;runOne(v2,days[d]+' '+String(Math.floor(m2/60)).padStart(2,'0')+':'+String(m2%60).padStart(2,'0')+':'+ss);}
  }
  return {tests,meas};
}

/* ---------- 迷你 SQL：SELECT 子集 ---------- */
function sqlRun(db,q){
  const toks=[];const re=/\s*(?:('(?:[^']|'')*')|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|!=|<>|[=<>(),*;]))/y;let m;re.lastIndex=0;
  const src=q.trim();while(re.lastIndex<src.length){m=re.exec(src);if(!m){throw new Error('看不懂這裡：'+src.slice(re.lastIndex,re.lastIndex+12));}
    if(m[1])toks.push({t:'s',v:m[1].slice(1,-1).replace(/''/g,"'")});else if(m[2])toks.push({t:'n',v:+m[2]});else if(m[3])toks.push({t:'id',v:m[3]});else if(m[4]&&m[4]!==';')toks.push({t:'op',v:m[4]});}
  let p=0;const peek=()=>toks[p],kw=w=>peek()&&peek().t==='id'&&peek().v.toUpperCase()===w,eat=w=>{if(!kw(w))throw new Error('這裡應該是 '+w);p++;},op=o=>peek()&&peek().t==='op'&&peek().v===o;
  const ident=()=>{const k=peek();if(!k||k.t!=='id')throw new Error('這裡應該是欄位或表格名稱');p++;return k.v;};
  eat('SELECT');const sel=[];
  do{ if(op('*')){p++;sel.push({star:1});}
      else if(['COUNT','AVG','MIN','MAX','SUM'].some(f=>kw(f))){const f=ident().toUpperCase();if(!op('('))throw new Error(f+' 後面要接括號');p++;let c='*';if(op('*'))p++;else c=ident();if(!op(')'))throw new Error('少了右括號');p++;sel.push({agg:f,col:c,name:f+'('+c+')'});}
      else sel.push({col:ident()});
  }while(op(',')&&++p);
  eat('FROM');const tn=ident().toLowerCase();const T=db[tn];if(!T)throw new Error('沒有這個表格：'+tn+'（有 tests、meas）');
  const cols=Object.keys(T[0]);const chk=c=>{if(!cols.includes(c))throw new Error(tn+' 沒有欄位 '+c+'（有 '+cols.join('、')+'）');};
  const lit=()=>{const k=peek();if(!k||(k.t!=='s'&&k.t!=='n'))throw new Error('這裡應該是一個值，字串要用單引號');p++;return k.v;};
  let conds=[];
  if(kw('WHERE')){p++;do{const c=ident();chk(c);
     if(kw('IN')){p++;if(!op('('))throw new Error('IN 後面要接括號');p++;const vs=[];do{vs.push(lit());}while(op(',')&&++p);if(!op(')'))throw new Error('少了右括號');p++;conds.push(r=>vs.includes(r[c]));}
     else if(kw('LIKE')){p++;const pat=String(lit());const rx=new RegExp('^'+pat.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/%/g,'.*').replace(/_/g,'.')+'$');conds.push(r=>rx.test(String(r[c])));}
     else{const k=peek();if(!k||k.t!=='op')throw new Error('欄位後面要接比較符號（= < > …）');p++;const v=lit();const o=k.v;
       conds.push(r=>{const x=r[c];switch(o){case '=':return x==v;case '!=':case '<>':return x!=v;case '<':return x<v;case '>':return x>v;case '<=':return x<=v;case '>=':return x>=v;}throw new Error('不支援 '+o);});}
   }while(kw('AND')&&++p);}
  let rows=T.filter(r=>conds.every(f=>f(r)));
  let gb=null;if(kw('GROUP')){p++;eat('BY');gb=[];do{const c=ident();chk(c);gb.push(c);}while(op(',')&&++p);}
  const AGG=['COUNT','AVG','MIN','MAX','SUM'];
  const aggOf=(g,f,c)=>{const vs=g.map(r=>c==='*'?1:r[c]);if(f==='COUNT')return vs.length;if(!vs.length)return '';if(f==='SUM')return +vs.reduce((a,b)=>a+b,0).toFixed(4);if(f==='AVG')return +(vs.reduce((a,b)=>a+b,0)/vs.length).toFixed(4);if(f==='MIN')return Math.min(...vs);return Math.max(...vs);};
  let hv=null;if(kw('HAVING')){if(!gb)throw new Error('HAVING 要接在 GROUP BY 後面');p++;const f=ident().toUpperCase();if(!AGG.includes(f))throw new Error('HAVING 後面要接 COUNT、AVG… 這類函式');if(!op('('))throw new Error('少了左括號');p++;let c='*';if(op('*'))p++;else{c=ident();chk(c);}if(!op(')'))throw new Error('少了右括號');p++;const k=peek();if(!k||k.t!=='op')throw new Error('要接比較符號');p++;hv={f,c,o:k.v,v:lit()};}
  sel.forEach(s=>{if(s.col&&s.col!=='*')chk(s.col);});
  const hasAgg=sel.some(s=>s.agg);
  let out,head;
  if(hasAgg||gb){
    const groups=new Map();rows.forEach(r=>{const k=gb?gb.map(c=>r[c]).join('\u0001'):'';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
    if(!gb&&!groups.size)groups.set('',[]);
    head=sel.map(s=>s.name||s.col);
    let gl=[...groups.values()];
    if(hv)gl=gl.filter(g=>{const x=aggOf(g,hv.f,hv.c),v=hv.v;switch(hv.o){case '=':return x==v;case '!=':case '<>':return x!=v;case '<':return x<v;case '>':return x>v;case '<=':return x<=v;case '>=':return x>=v;}return false;});
    out=gl.map(g=>sel.map(s=>{if(!s.agg){if(gb&&!gb.includes(s.col))throw new Error('有 GROUP BY 時，'+s.col+' 要放在 GROUP BY 裡');return g[0]?g[0][s.col]:'';}
      const vs=g.map(r=>s.col==='*'?1:r[s.col]);if(s.agg==='COUNT')return vs.length;if(!vs.length)return '';
      if(s.agg==='SUM')return +vs.reduce((a,b)=>a+b,0).toFixed(4);if(s.agg==='AVG')return +(vs.reduce((a,b)=>a+b,0)/vs.length).toFixed(4);if(s.agg==='MIN')return Math.min(...vs);return Math.max(...vs);}));
  }else{
    head=sel.some(s=>s.star)?cols:sel.map(s=>s.col);out=rows.map(r=>head.map(c=>r[c]));
  }
  if(kw('ORDER')){p++;eat('BY');const c=ident();let i=head.indexOf(c);if(i<0)throw new Error('ORDER BY 的欄位要在 SELECT 裡');let desc=false;if(kw('DESC')){desc=true;p++;}else if(kw('ASC'))p++;out.sort((a,b)=>(a[i]>b[i]?1:a[i]<b[i]?-1:0)*(desc?-1:1));}
  if(kw('LIMIT')){p++;const n=lit();out=out.slice(0,n);}
  if(p<toks.length)throw new Error('多出來的：'+toks.slice(p).map(t=>t.v).join(' '));
  return {head,rows:out};
}

function sqlConsole(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  const db=makeDB();
  const EX=[
   ['① 這個序號測過幾次',"SELECT test_id, ts, station, operator, result, fail_item, limits_ver FROM tests WHERE sn = 'PM5-26110457'"],
   ['② 那一次的每一項量測',"SELECT item, value, lo, hi, pass FROM meas WHERE test_id = 1158"],
   ['③ 同樣問題的還有誰',"SELECT test_id, value, hi FROM meas WHERE item = 'T03' AND value > 5.10 AND pass = 1"],
   ['④ 每一站 PASS／FAIL 各幾筆',"SELECT station, result, COUNT(*) FROM tests GROUP BY station, result"],
   ['⑤ 測了不只一次的序號',"SELECT sn, COUNT(*) FROM tests GROUP BY sn HAVING COUNT(*) > 1"],
   ['⑥ 看那幾片的先後',"SELECT sn, ts, result, fail_item FROM tests WHERE sn IN ('X') ORDER BY ts"]
  ];
  el.innerHTML=`<p style="margin:0 0 6px"><b>測試資料庫（三天、兩站，約 ${db.tests.length} 次測試）。</b>表格：<code>tests</code>（每一次測試一列）、<code>meas</code>（每一項量測一列）。</p>
  <p style="display:flex;flex-wrap:wrap;gap:6px">${EX.map((e,i)=>`<button type="button" class="btn" data-x="${i}">${e[0]}</button>`).join('')}</p>
  <textarea data-k="q" rows="3" style="width:100%;font:13px Consolas,monospace;box-sizing:border-box"></textarea>
  <p><button type="button" class="btn" data-k="run">執行</button> <span data-o="info" style="font-size:13px;color:#445"></span></p>
  <div style="max-height:260px;overflow:auto"><table class="tbl" style="font-size:12px;width:100%" data-o="tb"></table></div>
  <p style="font-size:12px;color:#667">支援：SELECT 欄位 FROM 表格 WHERE 條件 AND 條件 …（= &lt; &gt; &lt;= &gt;= != IN LIKE）、COUNT／AVG／MIN／MAX／SUM、GROUP BY … HAVING、ORDER BY … DESC、LIMIT。字串用單引號。SQL Server 取前幾列寫 <code>SELECT TOP 10 …</code>；MySQL、PostgreSQL、SQLite 寫 <code>LIMIT 10</code>。範例的 test_id 為了好打字用整數，規格 S2 的實際格式是像 ST01-20261114-0057 的字串。</p>`;
  const o=k=>el.querySelector('[data-o='+k+']'),ta=el.querySelector('[data-k=q]');
  // 讓範例 ② 指到客訴那一片真正的 test_id
  const cid=db.tests.find(t=>t.sn==='PM5-26110457').test_id;EX[1][1]=EX[1][1].replace('1158',cid);
  const cnt={};db.tests.forEach(t=>cnt[t.sn]=(cnt[t.sn]||0)+1);const rt=Object.keys(cnt).filter(k=>cnt[k]>1).slice(0,3);EX[5][1]=EX[5][1].replace("'X'",rt.map(x=>"'"+x+"'").join(', '));
  function run(){
    try{const t0=performance.now();const r=sqlRun(db,ta.value);
      let rows=r.rows;
      o('tb').innerHTML='<tr>'+r.head.map(h=>`<th>${h}</th>`).join('')+'</tr>'+rows.slice(0,80).map(x=>'<tr>'+x.map(v=>`<td>${v}</td>`).join('')+'</tr>').join('');
      o('info').textContent=rows.length+' 列'+(rows.length>80?'（只顯示前 80 列）':'')+'，'+(performance.now()-t0).toFixed(1)+' ms';
    }catch(e){o('tb').innerHTML='';o('info').innerHTML='<b style="color:#c0392b">錯誤：</b>'+e.message;}
  }
  el.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{ta.value=EX[+b.dataset.x][1];run();});
  el.querySelector('[data-k=run]').onclick=run;
  ta.value=EX[0][1];run();
}

/* ---------- 圖：資料庫斷線時，先存本機再補傳 ---------- */
function bufferSim(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<p style="margin:0 0 6px"><b>產線每 3 秒測完一片。資料庫（在 IT 機房）有時候會斷線。</b></p>
  <p style="font-size:13px"><label><input type="radio" name="bm" value="direct"> 直接寫資料庫，寫失敗就跳錯誤視窗</label><br>
  <label><input type="radio" name="bm" value="buf" checked> 先寫本機的暫存檔，另一個迴圈負責上傳，成功才從暫存檔刪掉</label></p>
  <p><button type="button" class="btn" data-k="go">開始</button> <label><input type="checkbox" data-k="down"> 資料庫斷線</label></p>
  <p style="font-size:14px">產線測完 <b data-o="n">0</b> 片　資料庫裡 <b data-o="db">0</b> 筆　暫存檔等待上傳 <b data-o="buf">0</b> 筆　產線卡住 <b data-o="stuck">0</b> 秒　<b data-o="lost" style="color:#c0392b"></b></p>
  <p data-o="msg" style="font-size:13px;color:#445;min-height:18px"></p>`;
  const o=k=>el.querySelector('[data-o='+k+']');let S={n:0,db:0,buf:0,stuck:0,lost:0,t:0,dlg:false},timer=null;
  const mode=()=>el.querySelector('input[name=bm]:checked').value,down=()=>el.querySelector('[data-k=down]').checked;
  function tick(){
    if(!document.body.contains(el)){clearInterval(timer);return;}
    S.t++;
    if(mode()==='direct'){
      if(S.dlg){if(down()){S.stuck++;o('msg').textContent='錯誤視窗：「資料庫連線失敗」。作業員只能按確定……按了之後這一片的資料就沒了。';if(S.stuck%5===0){S.lost++;S.dlg=false;}}else{S.lost++;S.dlg=false;o('msg').textContent='網路恢復了，錯誤視窗關掉，但那一片沒有重寫：算遺失。';}}
      else if(S.t%3===0){S.n++;if(down()){S.dlg=true;o('msg').textContent='寫入失敗，跳出錯誤視窗，產線停住。';}else{S.db++;o('msg').textContent='';}}
    }else{
      if(S.t%3===0){S.n++;S.buf++;}
      if(!down()&&S.buf>0){const k=Math.min(S.buf,2);S.buf-=k;S.db+=k;o('msg').textContent=S.buf?'資料庫恢復，正在補傳暫存檔……':'';}
      else if(down())o('msg').textContent='資料庫斷線：產線照常測，資料先存在本機，等恢復再補傳。';
    }
    o('n').textContent=S.n;o('db').textContent=S.db;o('buf').textContent=S.buf;o('stuck').textContent=S.stuck;o('lost').textContent=S.lost?'遺失 '+S.lost+' 筆':'';
  }
  el.querySelector('[data-k=go]').onclick=()=>{S={n:0,db:0,buf:0,stuck:0,lost:0,t:0,dlg:false};clearInterval(timer);timer=setInterval(tick,250);};
}

L.push({id:'W09',order:30.989,no:'W9',part:PART,title:'測試結果進資料庫：客訴一片板子，10 分鐘內查出它的測試紀錄，再找出同樣問題的還有誰',mins:80,files:['練習\\實務\\Station\\DB_Write.vi','練習\\實務\\Station\\Upload_Loop.vi'],
goals:[['學會','為什麼每天一個 CSV 不夠追溯；兩個表格（每次測試一列、每項量測一列）；每筆紀錄要存當時用的上下限和程式版本；SELECT／WHERE／GROUP BY 查資料；序號是外面來的字串，不能直接拼進 SQL；資料庫斷線時產線不能停：先存本機、另一個迴圈補傳；時間要對。'],['做出','資料表設計、在網頁上的測試資料庫查出客訴板子的紀錄和同批風險、寫入與補傳的程式規劃。'],['為什麼是這個題目','職缺常寫「測試結果寫入 SQL 資料庫」「串接 MES」「建立追溯機制」「序號防呆」。W6 的測試站存 CSV 只是第一步；工廠真正要的是「出事時查得到」。']],
check:'不看課文，能說出 tests 和 meas 兩個表為什麼要分開、為什麼每一筆量測要存當時的上下限、資料庫斷線時程式該怎麼做，以及序號為什麼不能直接拼進 SQL 字串。',
body:[
C.h3('① 聽懂需求','','品保的電話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「客戶退回一片 PM5，序號 PM5-26110457，說輸出電壓偏高。我 10 分鐘內要知道：它哪一天、哪一站、誰測的、測了幾次、量到多少、當時的上下限是多少。還有，同樣問題的還有沒有別片？」</p></div>`,
ask('如果資料是 W6 那樣「每天、每站一個 CSV」，要花多久才回答得出來？',
 `<p>不知道是哪一天測的，就要一個一個打開：3 天 × 2 站 ＝ 6 個檔案，每個幾百列。找到之後還要問：當時的上下限是多少？CSV 只存了量測值，上下限要去翻當時的 limits.csv：那時候是哪一版？</p>
 <p>「同樣問題的還有誰」更難：要把所有檔案合起來，篩出 T03 大於 5.10 而且 PASS 的。用 Excel 做得到，但 10 分鐘不夠，而且容易出錯。</p>
 <p>這就是職缺說的「追溯」：<b>從一個序號，馬上查到它的所有紀錄</b>；從一個問題，馬上查到所有受影響的產品。</p>`),
C.h3('② 寫成規格','','先設計表格'),
`<p>一次測試有 5 項量測（W8 之後是 6 項，以後可能更多）。如果做成一個表、每項一欄，加測項就要改表格。所以分成兩個表：</p>`,
C.table(['表格','一列代表','欄位'],[
 ['tests','一次測試','test_id（每次測試唯一的編號，<b>主鍵</b>）、sn、station、operator、ts（時間）、result、fail_item、limits_ver、sw_ver'],
 ['meas','一次測試裡的一項量測','test_id（對到 tests）、item、value、lo、hi、pass；主鍵是（test_id, item）']
]),
ask('meas 為什麼要存 lo 和 hi？上下限不是都在 limits.csv 裡嗎？',
 `<p>因為上下限會變（W8：T03 上限從 5.15 改成 5.10）。三個月後查一片舊板子，你要知道的是<b>當時</b>用什麼標準判 PASS，不是現在的。每一筆都存下當時的 lo、hi，再加上 limits_ver 和 sw_ver，就不用去猜。</p>
 <p>這是追溯的原則：<b>判斷結果的依據要跟結果存在一起</b>。</p>`),
C.table(['編號','規格'],[
 ['S1','每次測試（含重測、含 ERROR）寫一列 tests；每項量測寫一列 meas'],
 ['S2','test_id 由測試站產生，全廠不重複（例如站號＋時間＋流水號），不要等資料庫給'],
 ['S3','資料庫斷線時產線照常測，資料先存本機暫存檔，恢復後自動補傳，不重複、不遺失'],
 ['S4','序號從條碼槍來，寫入資料庫時用參數化查詢，不拼字串'],
 ['S5','測試站電腦的時間要和伺服器同步（NTP），ts 才排得出先後'],
 ['S6','品保能用序號查到：每次測試的時間、站、作業員、結果、各項量測和當時的上下限']
]),
C.h3('③ 盤點','','資料庫在哪、用什麼連'),
C.table(['項目','內容'],[
 ['資料庫','IT 部門管理的 SQL Server（也可能是 MySQL、PostgreSQL）。要問：主機位址、資料庫名稱、帳號權限（測試站只需要寫入和查詢自己的表）'],
 ['LabVIEW 怎麼連','Database Connectivity Toolkit：寫入是 DB Tools Open Connection →（Begin Transaction）→ Create Parameterized Query → Set Parameter Value → Execute Query →（Commit／Rollback Transaction）→ Free Object → Close Connection；查詢在 Execute Query 之後用 Fetch Recordset Data 拿結果。或 VIPM 上的 SQLite 函式庫（只在本機存）。用哪一個看你的 LabVIEW 版本和授權'],
 ['連線字串','放在設定檔或 UDL 檔，<b>不要寫死在程式裡</b>；密碼不要寫在程式碼或截圖裡'],
 ['網路','測試站到機房的網路會不會斷？斷多久？（答案通常是「偶爾」，所以要有 S3）']
]),
warn('帳號權限','測試站用的資料庫帳號只給需要的權限（寫入 tests、meas，查詢）。不要用管理員帳號：程式有錯或電腦被亂用時，可能刪掉整個資料庫。'),
C.h3('④ 先驗證','','用 SQL 把品保的問題問一遍'),
`<p>寫 LabVIEW 之前，先確定「這樣存，真的查得到品保要的東西」。下面是三天的資料（已經依上面的設計存好了）。依序按 ① 到 ⑤，看每一句 SQL 在問什麼，也可以自己改。</p>`,
{fn:sqlConsole},
ask('查完 ① ② ③，你要怎麼回覆品保？',
 `<p>① 這片在 11/14 測過一次（那天是週六加班），PASS，用的是 <b>L1.0</b> 版上下限。② 它的 T03（滿載輸出電壓）是 5.121 V，當時上限 5.15，所以 PASS；但規格書是 5.10，<b>依規格應該 FAIL</b>。這正是 W8 發現的舊程式錯誤。</p>
 <p>③ 同樣「T03 大於 5.10 卻 PASS」的還有幾片，全部是 L1.0 那段時間（11/16 週一 10:00 換版之前）測的。把這些 test_id 對回 tests 的序號，就是要追回或通知客戶的清單。</p>
 <p>回覆要附上查詢的 SQL 和結果：別人可以照著重查，也知道你是怎麼得到這個結論的。</p>`),
ask('④ 每一站的良率、⑤ 測了不只一次的序號，各有什麼用？',
 `<p>④ 兩站的 FAIL 比例差很多時，先懷疑測試站（治具、儀器）而不是產品。⑤ 列出重測過的序號，對照 result：「FAIL 之後重測到 PASS」的板子，品保通常要另外看，因為可能是接觸不良，也可能是真的有問題卻被重測蒙混過去。CSV 很難看出這個，資料庫一句 GROUP BY 就出來了。</p>`),
C.h3('⑤ 規劃','','寫入不能拖累產線'),
`<p>最直覺的寫法是：測完一片 → 寫資料庫 → 下一片。問題是資料庫在別的機房，網路偶爾會斷。斷線時會怎樣？下面比較兩種做法：</p>`,
{fn:bufferSim},
`<p>第二種做法就是 第 16 課學過的<b>生產者／消費者</b>（Queue）：測試迴圈（生產者）只負責把結果放進本機暫存（檔案或 Queue ＋ 檔案），上傳迴圈（消費者）負責送到資料庫，成功才刪掉。測試迴圈永遠不等網路。</p>`,
C.plan({start:'W6 的 Main.vi 旁邊多一個 Upload_Loop.vi（獨立的迴圈），兩者之間用暫存資料夾溝通：每一次測試存成一個小檔案（檔名 ＝ test_id）。',
 in:'測試迴圈：一次測試的結果（tests 一列 ＋ meas 幾列）。上傳迴圈：暫存資料夾裡的檔案清單。',
 calc:'（資料庫的 test_id 設成主鍵：同一筆傳兩次時會得到「主鍵重複」錯誤，上傳迴圈把它當作「已經傳過」，刪掉暫存檔。）測試迴圈：組好資料 → 寫成暫存檔（先寫成 .tmp，寫完再改名成 .json，避免上傳迴圈讀到寫一半的檔案）。上傳迴圈：每 2 秒看一次資料夾 → 一個檔案一個交易（transaction）：插入 tests 和 meas，全部成功才 commit，然後刪檔；失敗就留著下次再試。',
 out:'資料庫的兩個表；畫面上一個小燈：「待上傳 N 筆」，N 一直變大就通知工程師。',
 loop:'測試迴圈照產線節奏；上傳迴圈 2 秒一圈，斷線時拉長到 30 秒，不要一直猛連。',
 end:'程式結束時上傳迴圈把剩下的傳完（給個上限時間）；沒傳完的留在資料夾，下次開機繼續。'}),
ask('為什麼 test_id 要由測試站自己產生，不讓資料庫自動編號？',
 `<p>資料庫斷線時，暫存檔也需要一個唯一的編號；而且補傳時如果同一個檔案傳了兩次（例如寫入成功但回應沒收到），有自己的 test_id 就能判斷「這筆已經有了」，不會重複。用站號 ＋ 時間 ＋ 流水號，全廠就不會撞號。</p>`),
ask('為什麼序號不能用 Format Into String 直接拼進 SQL？',
 `<p>序號是從條碼槍來的：掃到奇怪的條碼、有人手打、甚至故意輸入 <code>' ; DELETE FROM tests ; --</code>，拼出來的 SQL 就變成另一句指令。這叫 <b>SQL 注入</b>。就算沒有人惡意，序號裡有一個單引號也會讓 SQL 出錯。</p>
 <p>做法：用參數化查詢（SQL 裡寫 <code>?</code>，值另外傳），或用工具包的 Insert Data（給表格名稱和資料叢集，它幫你處理）。W6 的序號格式檢查也是一道防線。</p>`),
C.h3('⑥ 測試、交機','','照規格驗收'),
C.table(['測試','操作','預期','規格'],[
 ['T1','測 3 片（PASS、FAIL、ERROR 各一）','tests 3 列、meas 有對應的列，ERROR 那片的量測值是空的','S1'],
 ['T2','同一片測兩次','tests 兩列，test_id 不同，sn 相同','S1、S2'],
 ['T3','拔掉網路線測 10 片，再接回','產線沒停；接回後暫存檔自動清空，資料庫多 10 筆','S3'],
 ['T4','上傳中途拔網路線','資料庫沒有「只有 tests 沒有 meas」的半筆；接回後補齊、不重複','S3'],
 ['T5','序號欄輸入 <code>PM5-1\'2</code>','格式檢查先擋下；就算放行，寫入也不會出錯','S4'],
 ['T6','品保用序號查詢','10 秒內看到時間、站、作業員、量測值、當時上下限','S6']
]),
`<p>交機資料：表格設計（每一欄的意思和單位）、帳號與權限（不含密碼）、暫存資料夾的位置和「待上傳一直增加時怎麼辦」、常用查詢的 SQL（就是上面那五句）。</p>`,
note('MES 是什麼','很多工廠的資料不是直接寫資料庫，而是送到 MES（製造執行系統）：測試前問 MES「這個序號可以在這一站測嗎」（防止跳站），測完回報結果。做法和這一課一樣：資料要完整、斷線要能補、時間要對；只是「寫到哪裡」換成 MES 給的介面（Web API、資料庫的中介表或檔案）。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'測試項目以後可能增加，資料表怎麼設計比較好改？',o:['tests 一次一列、meas 一項一列','一個表，每個測項一欄','每個測項一個表','存成一大段文字'],a:0,ex:'加測項只是 meas 多幾列。'},
 {q:'每一筆量測要存 lo、hi 的原因？',o:['上下限會改，要知道當時用什麼標準判的','資料庫規定','讓查詢比較快','節省空間'],a:0,ex:'判斷依據和結果存在一起。'},
 {q:'找出所有序號 PM5-26110457 的測試，SQL 是？',o:["SELECT * FROM tests WHERE sn = 'PM5-26110457'","SELECT tests WHERE PM5-26110457","FIND sn IN tests","SELECT sn FROM meas"],a:0,ex:'字串用單引號。'},
 {q:'資料庫斷線時，測試站最好？',o:['照常測，資料存本機，另一個迴圈恢復後補傳','跳錯誤視窗等作業員','停線','不存了'],a:0,ex:'生產者／消費者。'},
 {q:'暫存檔先寫成 .tmp 再改名，是為了？',o:['上傳迴圈不會讀到寫一半的檔案','比較快','改名才能上傳','LabVIEW 規定'],a:0,ex:'改名是一瞬間的動作。'},
 {q:'序號直接用 Format Into String 拼進 SQL 的風險？',o:['特殊字元或惡意輸入會變成別的 SQL 指令（SQL 注入）','比較慢','序號會變大寫','沒有風險'],a:0,ex:'用參數化查詢。'},
 {q:'一片 FAIL 之後重測變 PASS，追溯上應該？',o:['兩次都留下紀錄，品保看得到','只留 PASS 那次','只留 FAIL 那次','刪掉重測'],a:0,ex:'重測不覆蓋。'}
]}
]});
})();
