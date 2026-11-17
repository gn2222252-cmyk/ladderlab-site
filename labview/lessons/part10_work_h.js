/* 實務案例 W11：配方（Recipe）與警報紀錄。一台熱壓機換做三種產品；作業員只能選配方，工程師才能改；參數下載到 PLC 要回讀確認；
   警報要有遲滯和延遲才不會洗版，要確認才熄，全部留紀錄。
   職缺對照（docs/job_research.md）：HMI 畫面與操作流程（Y15、Y19）、recipe 管理（S04）。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

const LIM={temp:[120,220,'°C',1],press:[1.0,6.0,'bar',0.1],time:[0.5,10,'s',0.1]};
const NAMES={temp:'溫度',press:'壓力',time:'時間'};
const pad=n=>String(n).padStart(2,'0');
const now=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());};
const toPLC=(k,v)=>Math.round(v/LIM[k][3]); // PLC 的 D 存整數：溫度 ×1、壓力 ×10、時間 ×10

/* ---- 圖：配方管理 ---- */
function recipeSim(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  let R=[{name:'A 小袋',temp:165,press:2.5,time:1.2},{name:'B 大袋',temp:175,press:3.0,time:2.0},{name:'C 鋁箔袋',temp:195,press:4.5,time:3.5}];
  let user='作業員',log=[],plc=null,cur=0,okFor=-1;
  el.innerHTML=`<p style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 6px">登入身分：<b data-o="u"></b>
   <button type="button" class="btn" data-k="login">工程師登入</button><button type="button" class="btn" data-k="logout">登出</button>
   <label><input type="checkbox" data-k="clamp"> PLC 程式只接受壓力 4.0 bar 以下（模擬 PLC 那邊的設定）</label></p>
  <p>配方：<select data-k="sel"></select> <button type="button" class="btn" data-k="dl">下載到 PLC</button></p>
  <div data-o="ed" style="display:flex;flex-wrap:wrap;gap:12px;font-size:13px"></div>
  <p><button type="button" class="btn" data-k="save">存檔</button> <span data-o="msg" style="font-size:13px"></span></p>
  <p style="font-size:13px">PLC 目前在用的參數：<b data-o="plc">（還沒下載）</b>　啟動許可：<b data-o="ok">不可以</b></p>
  <div style="display:flex;flex-wrap:wrap;gap:12px">
   <div style="flex:1 1 260px"><p style="font-size:12px;color:#556;margin:0">recipes.json（Flatten To JSON 存出來的樣子）</p><pre data-o="json" style="font-size:12px;background:#fff;border:1px solid #ccd;padding:6px;margin:2px 0;max-height:170px;overflow:auto"></pre></div>
   <div style="flex:1 1 260px"><p style="font-size:12px;color:#556;margin:0">變更紀錄</p><div data-o="log" style="font:12px Consolas,monospace;background:#fff;border:1px solid #ccd;padding:6px;max-height:170px;overflow:auto;white-space:pre"></div></div></div>`;
  const o=k=>el.querySelector('[data-o='+k+']'),q=k=>el.querySelector('[data-k='+k+']');
  const permit=(t,good)=>{o('ok').textContent=t;o('ok').style.color=good?'#1e7b34':'#c0392b';};
  function draw(){
    o('u').textContent=user;q('login').disabled=user==='工程師';q('logout').disabled=user!=='工程師';
    q('sel').innerHTML=R.map((r,i)=>`<option value="${i}"${i===cur?' selected':''}>${r.name}</option>`).join('');
    const ro=user!=='工程師';
    o('ed').innerHTML=Object.keys(LIM).map(k=>`<label>${NAMES[k]}（${LIM[k][0]}～${LIM[k][1]} ${LIM[k][2]}，每格 ${LIM[k][3]}）<br><input data-p="${k}" type="number" step="${LIM[k][3]}" value="${R[cur][k]}" ${ro?'disabled':''} style="width:90px"></label>`).join('');
    q('save').disabled=ro;
    o('json').textContent=JSON.stringify({version:3,recipes:R},null,1);
    o('log').textContent=log.slice().reverse().join('\n')||'（沒有變更）';
    o('plc').textContent=plc?`${plc.name}：D220＝${plc.temp}（${plc.temp} °C）、D221＝${plc.press}（${(plc.press/10).toFixed(1)} bar）、D222＝${plc.time}（${(plc.time/10).toFixed(1)} s）`:'（還沒下載）';
  }
  q('login').onclick=()=>{user='工程師';log.push(now()+' 工程師登入');draw();};
  q('logout').onclick=()=>{user='作業員';log.push(now()+' 工程師登出');draw();};
  q('sel').onchange=()=>{cur=+q('sel').value;okFor=-1;permit('不可以（換了配方，要重新下載）',false);log.push(now()+' '+user+' 選擇配方 '+R[cur].name);draw();};
  q('save').onclick=()=>{
    const nv={name:R[cur].name},errs=[];
    el.querySelectorAll('[data-p]').forEach(i=>{const k=i.dataset.p,v=parseFloat(i.value);nv[k]=v;
      if(isNaN(v)||v<LIM[k][0]||v>LIM[k][1])errs.push(NAMES[k]+' '+i.value+' 超出 '+LIM[k][0]+'～'+LIM[k][1]);
      else if(Math.abs(v/LIM[k][3]-Math.round(v/LIM[k][3]))>1e-6)errs.push(NAMES[k]+' '+i.value+' 不是 '+LIM[k][3]+' 的整數倍（PLC 存不下這個小數）');});
    if(errs.length){o('msg').innerHTML='<b style="color:#c0392b">沒有存檔：</b>'+errs.join('；');return;}
    const ch=Object.keys(LIM).filter(k=>nv[k]!==R[cur][k]);
    ch.forEach(k=>log.push(now()+' 工程師 '+R[cur].name+' '+NAMES[k]+' '+R[cur][k]+' → '+nv[k]));
    R[cur]=nv;o('msg').textContent=ch.length?'已存檔（'+ch.length+' 項變更已記錄）':'沒有變更';
    if(ch.length&&okFor===cur){okFor=-1;permit('不可以（配方改過了，PLC 還是舊的，要重新下載）',false);}
    draw();
  };
  q('dl').onclick=()=>{
    const r=R[cur],send={temp:toPLC('temp',r.temp),press:toPLC('press',r.press),time:toPLC('time',r.time)};
    log.push(now()+' 下載 '+r.name+'：寫暫存區 D210～D212 ＝ '+send.temp+'、'+send.press+'、'+send.time+' → 設「下載完成」旗標 M210');
    if(q('clamp').checked&&send.press>40){log.push(now()+' PLC 拒絕：壓力 '+(send.press/10)+' bar 超出 PLC 的設定，回錯誤碼 E21，沒有套用');plc=plc||null;okFor=-1;
      permit('不可以：PLC 回錯誤 E21（壓力超出機台設定），工作區還是舊的參數',false);draw();return;}
    plc={name:r.name,...send};
    log.push(now()+' PLC 在待機狀態，把暫存區複製到工作區 D220～D222，回「已套用」M211');
    const back={temp:plc.temp,press:plc.press,time:plc.time},bad=Object.keys(LIM).filter(k=>back[k]!==send[k]);
    if(bad.length){permit('不可以：回讀不一致',false);okFor=-1;}
    else{okFor=cur;permit('可以（讀回工作區，三個整數都一致）',true);log.push(now()+' 回讀比對一致，啟動許可 ON');}
    draw();
  };
  draw();
}

/* ---- 圖：警報洗版 ---- */
function alarmSim(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<p style="margin:0 0 6px"><b>熱壓頭溫度設定 175 °C（配方 B），「溫度過低」警報在低於 165 °C 時發出。換料時開門，溫度會掉下來再慢慢回升。</b></p>
  <p style="font-size:13px;display:flex;flex-wrap:wrap;gap:10px"><label><input type="checkbox" data-k="hys"> 遲滯：回到 168 °C 以上才算恢復</label><label><input type="checkbox" data-k="dly"> 延遲：連續 3 秒成立才發出</label>
   <button type="button" class="btn" data-k="go">跑 2 分鐘（加速）</button> <button type="button" class="btn" data-k="ack">確認（Ack）</button></p>
  <canvas data-o="cv" width="600" height="120" style="width:100%;max-width:600px;background:#fff;border:1px solid #ccd"></canvas>
  <p style="font-size:14px">警報發出 <b data-o="n">0</b> 次　畫面警報燈 <b data-o="lamp">熄</b></p>
  <div data-o="log" style="font:12px Consolas,monospace;background:#fff;border:1px solid #ccd;padding:6px;max-height:140px;overflow:auto;white-space:pre"></div>`;
  const o=k=>el.querySelector('[data-o='+k+']'),q=k=>el.querySelector('[data-k='+k+']');
  let S=null,timer=null;
  const temp=t=>{let base=175;if(t>=30&&t<100){const x=t-30;base=x<8?175-x*2.2:Math.min(175,157.4+(x-8)*0.3);}let r=Math.sin(t*1.7)*1.2+Math.sin(t*23.3)*0.9+Math.sin(t*37.1)*0.8;return base+r;};
  function start(){S={t:0,act:false,on:0,lat:false,n:0,log:[],first:null};clearInterval(timer);timer=setInterval(tick,40);const c=o('cv').getContext('2d');c.clearRect(0,0,600,120);
    c.strokeStyle='#c0392b';c.setLineDash([4,3]);c.beginPath();const y=v=>120-(v-145)*3;c.moveTo(0,y(165));c.lineTo(600,y(165));c.stroke();c.strokeStyle='#888';c.beginPath();c.moveTo(0,y(168));c.lineTo(600,y(168));c.stroke();c.setLineDash([]);}
  function tick(){
    if(!document.body.contains(el)){clearInterval(timer);return;}
    for(let k=0;k<5;k++){
      const t=S.t,T=temp(t),hys=q('hys').checked,dly=q('dly').checked;
      const cond=S.act?(hys?T<168:T<165):T<165;
      S.on=cond?S.on+0.1:0;
      const want=cond&&(!dly||S.on>=3);
      if(want&&!S.act){S.act=true;S.n++;S.lat=true;S.log.push(fmt(t)+'  ON   A101 溫度過低 '+T.toFixed(1)+' °C');}
      else if(!cond&&S.act){S.act=false;S.log.push(fmt(t)+'  OFF  A101 溫度恢復 '+T.toFixed(1)+' °C');}
      const c=o('cv').getContext('2d');c.fillStyle=S.act?'#c0392b':'#2f6fd0';c.fillRect(t*5,120-(T-145)*3,1.5,1.5);
      S.t+=0.1;if(S.t>=120){clearInterval(timer);break;}
    }
    o('n').textContent=S.n;o('lamp').textContent=S.lat?(S.act?'亮（警報中）':'閃（已恢復，等確認）'):'熄';o('lamp').style.color=S.lat?'#c0392b':'#1e7b34';
    o('log').textContent=S.log.slice().reverse().join('\n');
  }
  const fmt=t=>'10:'+pad(12+Math.floor(t/60))+':'+pad(Math.floor(t%60))+'.'+Math.floor((t*10)%10);
  q('go').onclick=start;
  q('ack').onclick=()=>{if(!S)return;if(S.act){S.log.push(fmt(S.t)+'  ACK  A101（還在警報中，燈繼續亮）');}else if(S.lat){S.lat=false;S.log.push(fmt(S.t)+'  ACK  A101 熄燈');}draw2();};
  function draw2(){if(!S)return;o('n').textContent=S.n;o('lamp').textContent=S.lat?(S.act?'亮（警報中）':'閃（已恢復，等確認）'):'熄';o('lamp').style.color=S.lat?'#c0392b':'#1e7b34';o('log').textContent=S.log.slice().reverse().join('\n');}
}

/* ---- 一步一步寫：一個警報的邏輯 ---- */
const av={name:'Alarm_TempLow.vi',view:'split',ratio:2,
 fp:{w:320,h:250,items:[
  {id:'T',k:'num',ctl:true,label:'溫度 °C',x:12,y:8,w:60,v:173,inc:1},
  {id:'sp',k:'num',ctl:true,label:'設定 °C',x:120,y:8,w:60,v:175,inc:1},
  {id:'on',k:'led',label:'低於 SP − 10',color:'red',x:12,y:70},
  {id:'act',k:'led',label:'警報狀態（含遲滯）',color:'red',x:120,y:70},
  {id:'lat',k:'led',label:'畫面警報燈（要確認）',color:'red',x:12,y:130},
  {id:'ack',k:'btn',label:'確認',text:'確認',x:170,y:130},
  {id:'quit',k:'btn',label:'stop',text:'停止',stop:true,x:12,y:200}]},
 bd:{w:820,h:340,structs:[{id:'wl',k:'while',x:20,y:10,w:780,h:310}],
  nodes:[
  {id:'T',k:'ctl',t:'dbl',label:'溫度',x:60,y:40},
  {id:'sp',k:'ctl',t:'dbl',label:'設定',x:60,y:100},
  {id:'k10',k:'const',t:'dbl',v:10,x:70,y:140},
  {id:'s10',k:'fn',fn:'Subtract',x:130,y:100},
  {id:'lt',k:'fn',fn:'Less?',x:200,y:40},
  {id:'on',k:'ind',t:'bool',label:'低於 SP−10',x:270,y:20},
  {id:'k7',k:'const',t:'dbl',v:7,x:70,y:180},
  {id:'s7',k:'fn',fn:'Subtract',x:130,y:160},
  {id:'gt',k:'fn',fn:'Greater Or Equal?',x:200,y:150},
  {id:'sr1',k:'sr',t:'bool',s:'wl',y:220},
  {id:'not1',k:'fn',fn:'Not',x:260,y:150},
  {id:'and1',k:'fn',fn:'And',x:320,y:150},
  {id:'or1',k:'fn',fn:'Or',x:390,y:60},
  {id:'act',k:'ind',t:'bool',label:'警報狀態',x:460,y:40},
  {id:'sr2',k:'sr',t:'bool',s:'wl',y:280},
  {id:'ack',k:'ctl',t:'bool',label:'確認',x:470,y:170},
  {id:'not2',k:'fn',fn:'Not',x:540,y:170},
  {id:'and2',k:'fn',fn:'And',x:600,y:170},
  {id:'or2',k:'fn',fn:'Or',x:660,y:90},
  {id:'lat',k:'ind',t:'bool',label:'警報燈',x:730,y:60},
  {id:'quit',k:'ctl',t:'bool',label:'stop',x:610,y:240},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'a1',from:'sp',to:'s10.x',t:'dbl',mx:115},
  {id:'a2',from:'k10',to:'s10.y',t:'dbl',mx:115},
  {id:'a3',from:'T',to:'lt.x',t:'dbl'},
  {id:'a4',from:'s10.out',to:'lt.y',t:'dbl',mx:180},
  {id:'a5',from:'lt.out',to:'on',t:'bool',mx:250},
  {id:'b1',from:'sp',to:'s7.x',t:'dbl',mx:110},
  {id:'b2',from:'k7',to:'s7.y',t:'dbl',mx:115},
  {id:'b3',from:'T',to:'gt.x',t:'dbl',mx:104},
  {id:'b4',from:'s7.out',to:'gt.y',t:'dbl',mx:185},
  {id:'b5',from:'gt.out',to:'not1',t:'bool'},
  {id:'b6',from:'not1.out',to:'and1.x',t:'bool'},
  {id:'b7',from:'sr1.L',to:'and1.y',t:'bool',mx:300},
  {id:'b8',from:'lt.out',to:'or1.x',t:'bool',mx:250},
  {id:'b9',from:'and1.out',to:'or1.y',t:'bool',mx:370},
  {id:'b10',from:'or1.out',to:'act',t:'bool',mx:440},
  {id:'b11',from:'or1.out',to:'sr1.R',t:'bool',pts:[[440,74],[440,206],[794,206],[794,220]]},
  {id:'c1',from:'ack',to:'not2',t:'bool'},
  {id:'c2',from:'not2.out',to:'and2.x',t:'bool'},
  {id:'c3',from:'sr2.L',to:'and2.y',t:'bool',mx:580},
  {id:'c4',from:'or1.out',to:'or2.x',t:'bool',mx:440},
  {id:'c5',from:'and2.out',to:'or2.y',t:'bool',mx:645},
  {id:'c6',from:'or2.out',to:'lat',t:'bool',mx:710},
  {id:'c7',from:'or2.out',to:'sr2.R',t:'bool',pts:[[710,104],[710,268],[794,268],[794,280]]},
  {id:'q1',from:'quit',to:'cond',t:'bool'}]},
 sim:{period:250,init:()=>({act:false,lat:false}),
  step(inp,st){
   const T=+inp.T,sp=+inp.sp,on=T<sp-10,off=T>=sp-7,pa=st.act,pl=st.lat;
   const act=on||(pa&&!off),lat=act||(pl&&!inp.ack);st.act=act;st.lat=lat;
   return {out:{on,act,lat},stop:!!inp.quit,
    vals:{T,sp,k10:10,k7:7,'s10.out':sp-10,'s7.out':sp-7,'lt.out':on,'gt.out':off,'not1.out':!off,'sr1.L':pa,'and1.out':pa&&!off,'or1.out':act,ack:!!inp.ack,'not2.out':!inp.ack,'sr2.L':pl,'and2.out':pl&&!inp.ack,'or2.out':lat,quit:!!inp.quit},
    msg:T.toFixed(1)+' °C：'+(on?'低於 '+(sp-10):off?'回到 '+(sp-7)+' 以上（恢復區）':'在 '+(sp-10)+'～'+(sp-7)+' 之間：維持原來的狀態')+'｜警報 '+(act?'ON':'OFF')+'｜燈 '+(lat?(act?'亮':'等確認'):'熄')};},
  doneMsg:'停止'}
};

L.push({id:'W11',order:30.991,no:'W11',part:PART,title:'配方與警報：換產品只選配方、參數下載要回讀確認、警報不洗版而且要確認',mins:80,files:['練習\\實務\\Press\\recipes.json','練習\\實務\\Press\\Alarm_TempLow.vi'],
goals:[['學會','配方用叢集（Type Def）存成檔案；每個參數有上下限，存檔和讀檔都要檢查；作業員和工程師的權限；誰在什麼時候改了什麼要留紀錄；下載到 PLC 後回讀確認，一致才允許啟動；警報的遲滯、延遲、栓鎖和確認；警報紀錄。'],['做出','配方管理的流程、Alarm_TempLow.vi（遲滯＋栓鎖確認）；在模擬上比較有沒有遲滯和延遲時警報發出幾次。'],['為什麼是這個題目','PLC／設備職缺常寫「規劃人機畫面與操作流程」，半導體設備職缺寫「recipe 管理」。人機畫面最核心的就是這兩件事：換產品時參數不會錯、出事時看得到而且有紀錄。機台能不能讓作業員安心用，很大一部分在這裡。']],
check:'不看課文，能說出配方存檔前後要檢查什麼、下載到 PLC 為什麼要回讀、警報的遲滯和延遲各解決什麼問題、「確認」之後燈什麼時候才熄。',
body:[
C.h3('① 聽懂需求','','生產課長的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「熱壓機要做 A、B、C 三種袋子，溫度、壓力、時間都不一樣。現在作業員每次換線都自己在觸控螢幕上改數字，常常改錯，整批報廢。另外警報一直叫，大家都習慣按掉不看了。」</p></div>`,
ask('這段話裡有兩個問題，各自真正的原因是什麼？',
 `<ol><li><b>改錯參數</b>：原因不是作業員不小心，而是<b>系統讓他可以改</b>。解法：參數由工程師設定成配方，作業員只「選」配方；選完下載到機台，確認無誤才能啟動。</li>
 <li><b>警報被習慣性按掉</b>：原因通常是<b>警報太多、而且大多不重要</b>（溫度在邊界上抖，一分鐘叫十次）。作業員學會「警報 ＝ 噪音」，真正重要的那一次也被按掉。解法：讓每一次警報都值得看（遲滯、延遲、分等級），並且要確認、留紀錄。</li></ol>
 <p>這兩個都是「讓人不容易犯錯」的設計，不是教育訓練能解決的。</p>`),
C.h3('② 寫成規格','',''),
C.table(['編號','規格'],[
 ['R1','配方包含：名稱、溫度（120～220 °C，每格 1 °C）、壓力（1.0～6.0 bar，每格 0.1 bar）、時間（0.5～10 s，每格 0.1 s）；範圍是機台能力，由設備工程師定；PLC 的 D 存整數（溫度 ×1、壓力和時間 ×10）'],
 ['R2','作業員只能選配方；工程師登入後才能新增、修改、刪除'],
 ['R3','存檔前檢查每個參數的範圍和解析度，不合就不存；讀檔時再檢查一次，檔案壞掉、版本不認得或超出範圍就不載入，保留上一份可用的配方並說明原因'],
 ['R4','每一次修改記錄：時間、誰、哪個配方、哪個參數、舊值 → 新值'],
 ['R5','下載的交握：寫 PLC 暫存區 D210～D212 → 設「下載完成」旗標 → PLC 只在待機時複製到工作區 D220～D222 並回「已套用」→ 讀回工作區用<b>整數</b>比對，一致才亮「啟動許可」；換配方、或下載後又改了這個配方，許可取消'],
 ['A1','溫度低於設定 − 10 °C 連續 3 秒才發出「溫度過低」；回到設定 − 7 °C 以上才算恢復'],
 ['A2','栓鎖型：警報中燈亮；恢復後燈閃，作業員按「確認」才熄；還在警報中按的確認不算，恢復後要再確認一次'],
 ['A3','每次警報的 ON、OFF、確認都記錄時間'],
 ['A4','「溫度過低」中不能啟動下一個循環（Interlock）']
]),
C.h3('③ 盤點','','資料長什麼樣子'),
`<p>一個配方是一組參數，LabVIEW 裡用<b>叢集</b>，存成 <b>Type Def</b>（第 8 課）：以後加參數只改一個地方。所有配方是叢集的陣列，存成檔案：</p>`,
C.table(['做法','存檔、讀檔','優點','注意'],[
 ['JSON','Flatten To JSON／Unflatten From JSON（LabVIEW 2013 起內建）','一個檔案放全部，結構清楚','叢集的標籤就是 JSON 的名稱。JSON 裡<b>少了</b>型別要的欄位（改標籤、加參數後讀舊檔）時，Unflatten 會回錯誤，整筆讀不進來'],
 ['INI','Configuration File VIs（Open Config Data、Read Key、Write Key、Close Config Data）','人看得懂，可以用記事本改','每個參數一個 Key；Close Config Data 的 write configuration file? 要接 True，改的內容才會寫回檔案'],
 ['資料庫','W9 的方法','多台機台共用、有完整歷史','要網路，要準備斷線時的做法']
]),
`<p>這一課用 JSON，檔案的樣子見下面的模擬：<code>{"version":3,"recipes":[{"name":…,"temp":…},…]}</code>（叢集陣列存成 JSON 陣列）。叢集元素的<b>標籤用英文</b>（temp、press、time），前面板用 Caption 顯示中文；LabVIEW 2018 的字串是 Windows 的系統編碼，配方名稱有中文時，檔案只在同一種語系的電腦之間交換。</p>
<p><b>為什麼要 version</b>：以後多一個參數，舊檔就少一個欄位，直接用新型別 Unflatten 會失敗。做法：先用一個只有 <code>version</code> 的叢集讀（多出來的欄位預設會被忽略）；依版本選舊版的 Type Def 讀進來，補上新參數的預設值，轉成新型別；存檔一律存新版本。</p>`,
C.h3('④ 先驗證','','配方的完整流程'),
`<p>下面是配方管理的模擬。先用作業員身分試著改參數（改不了），再用工程師登入改，故意輸入超出範圍的值存檔；接著下載到 PLC 看變更紀錄裡的交握步驟；再勾「PLC 程式只接受壓力 4.0 bar 以下」下載 C 配方。最後試試：下載成功之後，工程師又改了同一個配方並存檔，啟動許可會怎樣？</p>`,
{fn:recipeSim},
ask('下載到 PLC 為什麼要讀回來比對？寫進去不就好了嗎？',
 `<p>寫進去不代表 PLC 收到的就是你送的：PLC 程式可能不接受某個值（像模擬裡拒絕 4.5 bar）、PLC 存整數而你送的是小數、通訊可能出錯、位址可能寫錯（例如把壓力寫進了時間）、PLC 剛好在別的模式不接受寫入。讀回來比對，是唯一能證明「機台現在用的就是畫面上這組」的方法。</p>
 <p>比對不一致時<b>不准啟動</b>，並告訴人哪一個參數不一致。這就是規格 R5 的 Interlock。</p>
 <p>比對要用 PLC 的<b>整數</b>比，不要拿 DBL 直接比相等：2.55 bar 存進 PLC 會變成 25 或 26，讀回來永遠不等於 2.55。所以 R1 要先訂好每個參數的解析度，存檔時就擋掉存不下的小數。</p>
 <p>為什麼要先寫暫存區、再舉「下載完成」旗標？三個參數是分三次寫的，機台正在跑的話，可能用到「新溫度＋舊壓力」。先放資料、再舉旗子、PLC 在安全的時間點一次套用：W13 的交握是同一個模式。</p>`),
warn('密碼登入不是資安','程式裡的簡單密碼只能防「不小心」，防不了「故意」：密碼常常寫在程式裡或貼在機台上。工廠要求比較高時，用 Windows 帳號或公司的帳號系統，並且每個人用自己的帳號（紀錄才有意義）。'),
C.h3('⑤ 規劃','','警報為什麼會洗版'),
`<p>溫度不會乖乖停在一個數字，它會上下抖。設定「低於 165 °C 就警報」，溫度在 165 上下抖的時候，警報就 ON、OFF、ON、OFF……下面的模擬跑一次換料（開門讓溫度掉下來再回升），先什麼都不勾，看發出幾次；再分別勾遲滯、延遲。</p>`,
{fn:alarmSim},
C.table(['方法','做法','解決的問題'],[
 ['遲滯（Hysteresis）','ON 和 OFF 用不同的門檻：低於 165 才 ON，回到 168 以上才 OFF。遲滯帶要比雜訊的峰對峰值大：這裡雜訊約 6 °C，只靠 3 °C 的遲滯還會叫 2 次','在門檻附近抖動，反覆 ON／OFF'],
 ['延遲（On-delay）','條件要連續成立一段時間才發出','短暫的尖峰（開門一下、雜訊）'],
 ['栓鎖＋確認（Latch／Ack）','發出後就算恢復，燈也繼續閃，要人確認才熄','警報短暫發生又消失，沒人看到'],
 ['分等級','嚴重（停機）、警告（提醒）、訊息（只記錄）','所有事情都同樣大聲，重要的被淹沒']
]),
ask('「確認」按下去之後，什麼時候燈才熄？',
 `<p>這一課用<b>栓鎖型</b>：恢復之後、再有人按確認，燈才熄。還在警報中按的確認不算，恢復後要再按一次：確保有人看到「它恢復了」。燈的樣子：警報中亮、恢復但還沒確認閃。</p>
 <p>另一種常見的做法（ISA-18.2 標準的警報管理）：警報中按確認就記住「已確認」，燈從閃變恆亮，恢復之後自動熄。要用哪一種寫進規格，兩種都很常見；重要的停機警報常用栓鎖型。</p>`),
C.h3('⑥ 一步一步寫','','Alarm_TempLow.vi：遲滯＋栓鎖確認'),
{steps:{title:'一個警報：遲滯、栓鎖、確認',lv:av,steps:[
 {t:'低於 SP − 10：ON 的條件',view:'split',add:['T','sp','wl','quit','cond','q1','k10','s10','a1','a2','lt','a3','a4','on','a5'],h:`<p>設定 − 10 和溫度比，Less?。這是「開始警報」的條件。</p>`},
 {t:'回到 SP − 7 以上：OFF 的條件',view:'split',add:['k7','s7','b1','b2','gt','b3','b4'],h:`<p>另一個門檻：設定 − 7，用 Greater Or Equal?（規格寫「以上」，就是 ≥）。回到它以上才算恢復。兩個門檻之間（設定 175 時是 165～168）是「維持原狀」的區域。</p>`},
 {t:'遲滯：記住上一圈',view:'split',add:['act','sr1','not1','and1','or1','b5','b6','b7','b8','b9','b10','b11'],h:`<p>警報狀態 ＝ ON 條件 <b>或</b>（上一圈在警報中 <b>且</b> 還沒到 OFF 條件）。上一圈的狀態放在 Shift Register。這和 W1 的自保持是同一個寫法：PLC 的自保持迴路也是。</p><p>Run，把溫度改成 164（ON）、166（還是 ON）、168（OFF）、166（還是 OFF）。</p>`},
 {t:'栓鎖和確認',view:'split',add:['lat','ack','sr2','not2','and2','or2','c1','c2','c3','c4','c5','c6','c7'],h:`<p>警報燈 ＝ 警報狀態 <b>或</b>（上一圈燈亮 <b>且</b> 沒按確認）。還在警報中時第一項就是 True，按確認也不會熄；恢復之後，按確認那一圈第二項變 False，燈熄。這就是規格 A2 的栓鎖型。</p><p>畫面上的「亮」和「閃」用這兩個 Boolean 決定：警報狀態 True → 亮；警報狀態 False 但警報燈 True → 閃（等確認）。</p><p>確認按鈕用 Latch When Released（W1 說過為什麼）。</p>`},
 {t:'Run：照規格 A1、A2 測',view:'split',add:[],h:`<p>溫度 164 → 燈亮。按確認 → 還亮。溫度 170 → 狀態 OFF，燈還亮（閃，等確認）。按確認 → 熄。</p><p>延遲（連續 3 秒）沒有畫在這裡：再加一個 Shift Register 累計「ON 條件連續成立的時間」，到 3 秒才讓它進入警報狀態。自己試著加上去。</p>`}
]}},
C.h3('⑦ 測試、交機','',''),
C.table(['測試','操作','預期','規格'],[
 ['T1','作業員身分試著改參數','改不了','R2'],
 ['T2','工程師把溫度改成 250 存檔','不存，說明超出範圍','R3'],
 ['T3','用記事本把 recipes.json 的壓力改成 9 再開程式','不載入那個配方，顯示原因','R3'],
 ['T4','改兩個參數存檔','變更紀錄多兩列，有舊值和新值','R4'],
 ['T5','PLC 端限制壓力 4.0，下載 4.5 bar 的配方','回讀不一致，不能啟動','R5'],
 ['T6','換料開門（溫度掉到 162 °C 再回升）','警報只發出一次，恢復後燈閃，確認後熄','A1～A3'],
 ['T7','溫度過低時按啟動','不啟動，畫面說明原因','A4']
]),
`<p>交機資料：參數範圍表（誰定的）、配方檔格式與版本、權限說明、警報清單（編號、訊息、等級、門檻、遲滯、延遲、處理方法）。<b>警報清單</b>很重要：每一個警報都要寫「發生時作業員該做什麼」，寫不出來的警報，可能根本不需要。</p>`,
note('和 PLC 的分工','遲滯、延遲、Interlock 這些「保護機台」的邏輯，最好放在 PLC 裡（電腦當機時還有效）；LabVIEW 負責配方管理、顯示、紀錄、權限。這一課在 LabVIEW 寫警報邏輯是為了學觀念；實機上常是 PLC 算出警報位元，LabVIEW 讀來顯示、確認、記錄。<b>保護人的功能</b>（急停、安全門、過溫斷電）還要再往下一層：用安全繼電器、安全 PLC、獨立的過溫保護器，不靠任何一般程式。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'作業員常改錯參數，最好的解法？',o:['參數做成配方，作業員只能選，工程師才能改','加強教育訓練','把參數字體放大','每天檢查一次'],a:0,ex:'讓系統不讓人犯錯。'},
 {q:'配方範圍檢查要在什麼時候做？',o:['存檔前和讀檔時都要','只在存檔前','只在讀檔時','不用，PLC 會擋'],a:0,ex:'檔案可能被手動改壞。'},
 {q:'下載後回讀不一致，應該？',o:['不准啟動，顯示哪個參數不一致','照樣啟動','再下載一次就好不用比對','把畫面改成 PLC 的值'],a:0,ex:'Interlock。'},
 {q:'溫度在 165 °C 上下抖，警報 ON／OFF 一直跳，最直接的解法？',o:['遲滯：ON 和 OFF 用不同門檻','把門檻改成 160','關掉警報','把迴圈變慢'],a:0,ex:'門檻之間留一段維持原狀的區域。'},
 {q:'還在警報中按「確認」，燈會？',o:['繼續亮，恢復後才熄','馬上熄','閃爍','警報解除'],a:0,ex:'恢復 且 確認，兩個都要。'},
 {q:'叢集改了標籤名稱（或多了一個參數），用 Unflatten From JSON 讀舊檔會？',o:['回錯誤，整筆讀不進來','只有那個欄位是空的','自動對應','沒影響'],a:0,ex:'所以要有 version 和舊版轉換。'},
 {q:'保護機台的 Interlock 邏輯最好放在？',o:['PLC（電腦當機時仍有效）','只放在 LabVIEW','Excel','作業員記住'],a:0,ex:'上位機管配方、顯示、紀錄。'}
]}
]});
})();
