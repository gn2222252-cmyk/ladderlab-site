/* 實務案例 W12：老化（Burn-in）長時間記錄。10 台電源連續 8 小時，每 10 秒記一次電壓和溫度。
   重點不是量測，而是「跑很久不出事」：記憶體不能一直長、程式當掉時資料不能全丟、通訊斷了要自己重連、一台壞了其他台繼續、時間要用時間戳。
   職缺對照（docs/job_research.md）：測試數據整理與報告、應力與熱測試（R01）；長時間記錄是同一類工作。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
if(!LV.F['Max & Min'])LV.F['Max & Min']={g:'⇕',ins:['x','y'],outs:['max(x, y)','min(x, y)'],pal:['Functions','Programming','Comparison','Max & Min']};

/* ---- 圖：8 小時壓縮成 40 秒 ---- */
function burnSim(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:14px;font-size:13px">
   <div><b>記憶體</b><br><label><input type="radio" name="mem" value="grow" checked> 每筆都 Build Array 接到 Shift Register（不限長度）</label><br><label><input type="radio" name="mem" value="ring"> 畫面只留最近 360 筆，其他直接寫檔</label></div>
   <div><b>存檔</b><br><label><input type="radio" name="sv" value="end" checked> 跑完才一次存檔</label><br><label><input type="radio" name="sv" value="each"> 每筆寫入，每小時換一個檔</label></div>
   <div><b>通訊斷線</b><br><label><input type="radio" name="rc" value="stop" checked> 出錯就停止整個程式</label><br><label><input type="radio" name="rc" value="retry"> 記為 NaN，關掉 VISA 再重開，繼續</label></div></div>
  <p style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0"><button type="button" class="btn" data-k="go">開始 8 小時</button>
   <button type="button" class="btn" data-k="cut">通訊斷 1 分鐘</button><button type="button" class="btn" data-k="crash">電腦當機（Windows 更新重開）</button></p>
  <canvas data-o="cv" width="600" height="130" style="width:100%;max-width:600px;background:#fff;border:1px solid #ccd"></canvas>
  <p style="font-size:13px;margin:4px 0">經過 <b data-o="t">0:00</b>　程式狀態 <b data-o="st">－</b>　記憶體（示意）<b data-o="mem">－</b>　檔案裡已經存了 <b data-o="saved">0</b> 筆　斷線次數 <b data-o="gap">0</b></p>
  <div data-o="units" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;font-size:12px;max-width:600px"></div>
  <p data-o="log" style="font:12px Consolas,monospace;white-space:pre;background:#fff;border:1px solid #ccd;padding:6px;max-height:120px;overflow:auto;margin-top:6px"></p>`;
  const o=k=>el.querySelector('[data-o='+k+']'),q=k=>el.querySelector('[data-k='+k+']'),rad=n=>el.querySelector('input[name='+n+']:checked').value;
  let S=null,timer=null;
  const hm=s=>Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0');
  function log(m){S.log.unshift(hm(S.t)+'  '+m);o('log').textContent=S.log.join('\n');}
  function start(){
    clearInterval(timer);
    S={t:0,n:0,saved:0,mem:40,alive:true,cut:0,gaps:0,fail:7,failAt:3600*(2+Math.random()*4),dead:{},log:[],cfg:{mem:rad('mem'),sv:rad('sv'),rc:rad('rc')}};
    const c=o('cv').getContext('2d');c.clearRect(0,0,600,130);
    log('開始：記憶體「'+(S.cfg.mem==='grow'?'不限長度':'只留 360 筆')+'」、存檔「'+(S.cfg.sv==='end'?'跑完才存':'每筆寫入')+'」、斷線「'+(S.cfg.rc==='stop'?'停止':'重連')+'」');
    timer=setInterval(tick,50);draw();
  }
  function stopAll(why){S.alive=false;clearInterval(timer);log(why);draw();}
  function tick(){
    if(!document.body.contains(el)){clearInterval(timer);return;}
    for(let k=0;k<4;k++){ // 每 50 ms 前進 40 秒（4 筆 × 10 秒），8 小時約 36 秒
      if(!S.alive)return;
      S.t+=10;S.n++;
      let gap=false;
      if(S.cut>0){S.cut-=10;gap=true;
        if(S.cfg.rc==='stop'){stopAll('VISA 逾時 → 程式停止。後面的時間都沒有資料，要等人發現。');if(S.cfg.sv==='end'){S.saved=0;log('程式停在錯誤，資料還在記憶體裡沒存，一筆都沒留下。');}return;}
      }
      if(gap&&S.cut<=0){S.gaps++;log('通訊恢復（重開 VISA），中間 6 筆記為 NaN');}
      if(S.t>=S.failAt&&!S.dead[S.fail]){S.dead[S.fail]=S.t;log('#'+S.fail+' 電壓掉到 0 V → 這一台判 FAIL、關掉它的輸出，其他 9 台繼續');}
      S.mem+=S.cfg.mem==='grow'?0.012:0;
      if(S.cfg.sv==='each')S.saved=S.n;
      const c=o('cv').getContext('2d'),x=S.t/28800*600;
      c.fillStyle='#2f6fd0';c.fillRect(x,130-Math.min(125,(S.mem-30)*0.45),1.2,1.2);
      if(gap){c.fillStyle='#333';c.fillRect(x,0,1,8);}
      if(S.t>=28800){S.alive=false;clearInterval(timer);if(S.cfg.sv==='end')S.saved=S.n;log('8 小時完成，產生報告');break;}
    }
    draw();
  }
  function draw(){
    o('t').textContent=hm(S.t);o('st').textContent=S.alive?'執行中':'已停止';
    o('mem').textContent=S.mem.toFixed(0)+' MB'+(S.cfg.mem==='grow'&&S.mem>60?'（還在長）':'');
    o('saved').textContent=S.saved+' / '+S.n;o('gap').textContent=S.gaps;
    o('units').innerHTML=Array.from({length:10},(_,i)=>{const id=i+1,d=S.dead[id];return `<div style="border:1px solid ${d?'#c0392b':'#c9d1db'};background:${d?'#fde2df':'#fff'};border-radius:5px;padding:4px">#${id} ${d?'FAIL @'+hm(d):(S.alive||S.t>=28800?'5.02 V 41 °C':'－')}</div>`;}).join('');
  }
  q('go').onclick=start;
  q('cut').onclick=()=>{if(S&&S.alive){S.cut=60;log('通訊斷了（USB 線鬆、儀器重開）');}};
  q('crash').onclick=()=>{if(!S||!S.alive)return;const lost=S.n-S.saved;stopAll('電腦重開機！程式被關掉。'+(S.cfg.sv==='end'?'資料全在記憶體裡，'+S.n+' 筆全部遺失。':'檔案裡已經有 '+S.saved+' 筆，最多只丟最後一筆。'));if(S.cfg.sv==='end')S.saved=0;draw();};
}

/* ---- 一步一步寫：只留最近 N 筆 ---- */
const rv={name:'History.vi',view:'split',ratio:2,
 fp:{w:320,h:210,items:[
  {id:'nmax',k:'num',ctl:true,label:'最多保留 N 筆',x:12,y:8,w:60,v:5,inc:1},
  {id:'val',k:'num',label:'這一筆（模擬量測）',x:150,y:8,w:70,dig:3},
  {id:'hist',k:'arr',t:'dbl',n:6,label:'歷史（最新在最後）',x:12,y:70},
  {id:'size',k:'num',label:'陣列長度',x:12,y:130,w:60},
  {id:'quit',k:'btn',label:'stop',text:'停止',stop:true,x:150,y:140}]},
 bd:{w:860,h:300,structs:[{id:'wl',k:'while',x:110,y:10,w:720,h:270}],
  nodes:[
  {id:'meas',k:'sub',name:'Read_V.vi（量一次）',icon:['V'],ins:[],outs:['V'],x:150,y:40,w:50,h:36,color:'#6a3fb5'},
  {id:'val',k:'ind',t:'dbl',label:'這一筆',x:240,y:20},
  {id:'k0',k:'const',t:'dbl[]',v:'空陣列',x:20,y:182},
  {id:'sr',k:'sr',t:'dbl[]',s:'wl',y:190},
  {id:'ba',k:'fn',fn:'Build Array',ins:['element 0','element 1'],x:290,y:80},
  {id:'sz',k:'fn',fn:'Array Size',x:380,y:130},
  {id:'nmax',k:'ctl',t:'i32',label:'N',x:370,y:230},
  {id:'sub',k:'fn',fn:'Subtract',x:460,y:150},
  {id:'k00',k:'const',t:'i32',v:0,x:470,y:210},
  {id:'mx',k:'fn',fn:'Max & Min',x:530,y:170},
  {id:'as',k:'fn',fn:'Array Subset',x:620,y:80},
  {id:'hist',k:'ind',t:'dbl[]',label:'歷史',x:730,y:40},
  {id:'size',k:'ind',t:'i32',label:'長度',x:730,y:140},
  {id:'sz2',k:'fn',fn:'Array Size',x:680,y:140},
  {id:'quit',k:'ctl',t:'bool',label:'stop',x:710,y:230},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w1',from:'meas.V',to:'val',t:'dbl',mx:220},
  {id:'w2',from:'meas.V',to:'ba.element 1',t:'dbl',mx:220},
  {id:'w3',from:'sr.L',to:'ba.element 0',t:'dbl[]',mx:270},
  {id:'w4',from:'ba.appended array',to:'sz',t:'dbl[]',mx:350},
  {id:'w5',from:'sz.size',to:'sub.x',t:'i32',mx:440},
  {id:'w6',from:'nmax',to:'sub.y',t:'i32',mx:440},
  {id:'w7',from:'sub.out',to:'mx.x',t:'i32',mx:510},
  {id:'w8',from:'k00',to:'mx.y',t:'i32',mx:515},
  {id:'w9',from:'ba.appended array',to:'as.array',t:'dbl[]'},
  {id:'w10',from:'mx.max(x, y)',to:'as.index',t:'i32',mx:600},
  {id:'w11',from:'nmax',to:'as.length',t:'i32',pts:[[406,240],[406,262],[606,262],[606,114],[620,114]]},
  {id:'w12',from:'as.subarray',to:'hist',t:'dbl[]',mx:710},
  {id:'w13',from:'as.subarray',to:'sr.R',t:'dbl[]',pts:[[670,96],[670,190]]},
  {id:'w14',from:'as.subarray',to:'sz2',t:'dbl[]',mx:670},
  {id:'w15',from:'sz2.size',to:'size',t:'i32'},
  {id:'w0',from:'k0',to:'sr.init',t:'dbl[]'},
  {id:'wq',from:'quit',to:'cond',t:'bool'}]},
 sim:{period:500,init:()=>({h:[],i:0}),
  step(inp,st){
   const N=Math.max(1,Math.round(+inp.nmax||1)),v=+(5.02+Math.sin(st.i++*0.9)*0.01).toFixed(3);
   const app=st.h.concat([v]),start=Math.max(0,app.length-N),h=app.slice(start,start+N);st.h=h;
   return {out:{val:v,hist:h,size:h.length},stop:!!inp.quit,
    vals:{'meas.V':v,'sr.L':'['+(app.length-1)+' 個]','ba.appended array':'['+app.length+' 個]','sz.size':app.length,nmax:N,'sub.out':app.length-N,k00:0,'mx.max(x, y)':start,'as.subarray':'['+h.length+' 個]','sz2.size':h.length,quit:!!inp.quit},
    msg:'加入後 '+app.length+' 個 → 從第 '+start+' 個開始取 '+N+' 個 → 保留 '+h.length+' 個'};},
  doneMsg:'停止'}
};

L.push({id:'W12',order:30.992,no:'W12',part:PART,title:'老化燒機記錄：10 台電源跑 8 小時，程式本身不能先倒下',mins:75,files:['練習\\實務\\Burnin\\Burnin_Main.vi','練習\\實務\\Burnin\\History.vi'],
goals:[['學會','長時間程式的四個敵人：記憶體一直長、資料只在記憶體、通訊斷了就停、電腦自己重開；估算資料量；生產者／消費者把量測和存檔分開；每筆寫入並定時換檔；斷線記 NaN 並重開 VISA；一台壞了只關那一台；用時間戳記時間；燒機前的電腦設定。'],['做出','History.vi（只留最近 N 筆的 Shift Register）；在 8 小時壓縮成 40 秒的模擬上比較三組做法。'],['為什麼是這個題目','電源廠的測試職缺會寫應力、熱測試和測試數據整理；燒機（老化）就是這一類工作。寫一個跑 1 分鐘沒問題的程式很容易；跑 8 小時、72 小時不出事，是另一種功夫。']],
check:'不看課文，能說出一個要跑 8 小時的程式最常怎麼死、各用什麼方法避免，並寫出「只留最近 N 筆」的 Shift Register。',
body:[
C.h3('① 聽懂需求','','品保的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「新電源要做燒機：10 台一起放進恆溫箱，滿載跑 8 小時，每 10 秒記一次每台的輸出電壓和溫度。超出範圍要馬上知道是哪一台、什麼時候。上次用的程式跑到第 6 小時當掉，整晚的資料都沒了，這次不能再這樣。」</p></div>`,
ask('「上次跑到第 6 小時當掉，資料全沒了」，可能是哪些原因？',
 `<ol><li><b>記憶體越用越多</b>：每一筆都接到一個不斷變長的陣列（或圖表的歷史設得很大），幾個小時後程式變慢、最後當掉。</li>
 <li><b>資料只在記憶體裡</b>：打算「跑完再存」，中途任何意外，全部歸零。</li>
 <li><b>一次通訊錯誤就停</b>：USB 線鬆一下、儀器自己重開，錯誤一路傳到迴圈的 stop，程式結束了也沒人知道。</li>
 <li><b>電腦自己重開</b>：Windows 更新、睡眠、螢幕保護、別人關機。</li></ol>
 <p>這些在 1 分鐘的測試裡都不會出現，所以要<b>刻意設計</b>、刻意測。</p>`),
C.h3('② 寫成規格','',''),
C.table(['編號','規格'],[
 ['B1','每 10 秒記錄 10 台的電壓和溫度，每一筆有時間戳（日期＋時間），不是用「第幾圈 × 10 秒」推算'],
 ['B2','每一筆寫完就呼叫 Flush File（或每筆 Open → Write → Close），每小時換一個檔；程式被強制結束時最多損失最後一筆；斷電要靠 UPS（還在作業系統快取裡的資料，斷電時可能不見）'],
 ['B3','記憶體使用量不隨時間增加：畫面只顯示最近 1 小時（360 筆）'],
 ['B4','通訊錯誤時，那一筆記為 NaN，關閉並重新開啟 VISA，每 30 秒重試一次，測試不中斷；斷線的時段寫在報告裡'],
 ['B5','某一台電壓超出 4.75～5.25 V 或溫度超過 85 °C：記錄時間、關閉那一台的輸入電源、畫面標紅，其他台繼續。（這個範圍故意比 W6 的出貨規格寬：燒機是要抓「會壞掉的」，出貨規格在燒機之後的測試站再判一次。）'],
 ['B6','結束時產生報告：每台 PASS／FAIL、失敗時間、最大最小值、斷線時段']
]),
C.h3('③ 盤點','','先算資料量'),
`<p>10 台 × 2 個值 × 每 10 秒一筆 × 8 小時 ＝ 2880 筆 × 20 個數。每筆存成一行文字大約 150 bytes，<b>全部才 430 kB</b>。資料量根本不是問題；問題是<b>怎麼存</b>。</p>
`,
C.table(['項目','用途','怎麼接'],[
 ['電壓量測','10 台的輸出電壓','多通道資料記錄器或 DAQ；5 V 在 ±10 V 的範圍內，不用分壓'],
 ['溫度','10 台的外殼溫度','熱電偶模組（要有冷接點補償，W2 講過）'],
 ['負載','滿載燒機','10 路電子負載或電阻負載，各自接在一台的輸出'],
 ['開關','B5 的「關掉那一台」','每台的輸入端串一顆繼電器，用 DO 控制（W10 講過 DO 推繼電器）'],
 ['電腦','跑 8 小時','關睡眠、管好 Windows 更新、接 UPS（下面）']
]),
`<p>電壓、溫度兩台儀器都接 USB，各有一個 VISA 或 DAQmx 任務。</p>`,
C.h3('④ 先驗證','','把 8 小時壓縮來看'),
`<p>下面把 8 小時壓縮成 40 秒。先用預設的三個做法（不限長度、跑完才存、出錯就停）跑一次，中途按「通訊斷 1 分鐘」。再全部換成第二個做法，跑一次，中途按「通訊斷」和「電腦當機」。比較記憶體曲線、存了幾筆。</p>`,
{fn:burnSim},
ask('為什麼「不限長度」的記憶體會一直長？10 台 × 2 個數 × 2880 筆不是才幾百 kB 嗎？',
 `<p>以這一課的規格，8 小時其實只多幾 MB，記憶體不會是 8 小時內當掉的主因（模擬的曲線是示意，真實程式常一起存波形、字串、圖表歷史，長得快很多）。問題是它<b>沒有上限</b>：在迴圈裡用 Build Array 一直加，陣列一直變長，常常還要重新配置、複製；72 小時的燒機、改成每秒取樣、或每筆存一段波形，就會出事。Build Array 本身不是壞東西，下面的 History.vi 也用它，差別在<b>有沒有上限</b>。</p>
 <p>原則：<b>迴圈裡任何會變長的東西，都要有上限</b>。要全部保留的資料，放在檔案裡，不放在記憶體裡。</p>`),
C.h3('⑤ 規劃','','三個迴圈'),
C.table(['迴圈','做什麼','速度'],[
 ['量測（生產者）','每 10 秒讀儀器 → 打上時間戳 → Enqueue。出錯時記 NaN、重開 VISA','10 秒，用時間排程（下一次 ＝ 上一次 ＋ 10 秒；錯過的不補）'],
 ['存檔（消費者）','Dequeue → 寫一行 → 檔案保持開啟，每小時關掉換新檔','有資料就寫'],
 ['畫面','顯示最近 360 筆、每台狀態、警報','人看得到就好（例如 0.5 秒）']
]),
`<p>這是第 16 課的生產者／消費者（Queue），動畫可以看<a href="lab-queue.html">Queue 實驗室</a>。好處：寫檔慢一點（例如防毒軟體在掃描），不會拖慢量測；量測迴圈在重連儀器，也不會讓畫面卡住。</p><p>但 Queue 本身也是「會變長的東西」：Obtain Queue 的 max queue size 預設是 −1（沒有上限）。存檔迴圈卡住時，Queue 會一直長。設一個上限（例如 1000 筆），畫面顯示目前 Queue 的長度，超過一半就警告。</p>`,
ask('為什麼時間要記時間戳，不能用「第幾圈 × 10 秒」？',
 `<p>迴圈每一圈不會剛好 10.000 秒：重連要時間、電腦忙的時候會延遲。8 小時累積下來可能差好幾分鐘，「第 3 小時發生的事」就對不上恆溫箱的紀錄。每一筆直接記時間（Get Date/Time In Seconds 取值、Format Date/Time String 用 <code>%Y-%m-%d %H:%M:%S</code>，和 W6 同一個格式），事後怎麼算都對。</p>
 <p>另外，Wait (ms) 10000 和讀儀器並排（沒有線相連）時，兩個同時開始，一圈約 10 秒（取長的那個）；但某一圈讀取或重連超過 10 秒，那一圈就變長，之後全部往後推。要固定間隔：記下「下一次該量的時間」，到了才量；錯過的時間點（例如重連花了 30 秒）<b>不要補量</b>，直接跳到下一個未來的時間點，那段記成斷線。簡單的情況也可以用 Wait Until Next ms Multiple。</p>`),
warn('燒機前，電腦要設定','關閉睡眠和螢幕保護、設定 Windows 更新的使用時段（或暫停更新）、關掉自動重開機、接 UPS、桌面放一張「燒機中，請勿關機」。程式再穩，電腦自己重開也沒用。'),
C.h3('⑥ 一步一步寫','','History.vi：只留最近 N 筆'),
{steps:{title:'Shift Register 裡的陣列：加一筆、超過 N 就丟掉最舊的',lv:rv,steps:[
 {t:'每圈量一次，加到陣列最後',view:'split',add:['val','quit','wl','cond','wq','meas','w1','k0','sr','w0','ba','w2','w3'],h:`<p>Shift Register 放陣列，初值是空陣列。${fn('Programming','Array','Build Array')}：上面接舊陣列、下面接新的一筆，就是「加在最後」。只做到這裡，陣列會一直長。</p>`},
 {t:'超過 N 就從後面取 N 個',view:'split',add:['sz','w4','nmax','sub','w5','w6','k00','mx','w7','w8','as','w9','w10','w11'],h:`<p>起點 ＝ 長度 − N，但不能小於 0（前幾圈還不滿 N 筆）：${fn('Programming','Comparison','Max & Min')} 和 0 取大的。${fn('Programming','Array','Array Subset')}：從起點取 N 個。</p>`},
 {t:'存回 Shift Register',view:'split',add:['hist','w12','w13','sz2','size','w14','w15'],h:`<p>取出來的子陣列接回 Shift Register 右邊，同時顯示。Run，看「陣列長度」到 N 之後就不再增加。</p>`},
 {t:'Run：改 N',view:'split',add:[],h:`<p>跑一陣子把 N 從 5 改成 3，陣列馬上剩 3 個；改回 5，會慢慢再長到 5。實際程式裡 N ＝ 360（一小時），而所有資料都已經寫在檔案裡了。</p><p>Waveform Chart 本身也有這個功能：右鍵 ▸ Chart History Length。圖表只拿來看，就直接用它（預設 1024 點）。</p><p>N 很大、或每圈很快時，可以預先配好 N 格的陣列，用 Replace Array Subset 加一個「寫到第幾格」的索引繞圈寫（環狀緩衝），就不用每圈重新配置。</p>`}
]}},
C.h3('⑦ 測試、交機','','長時間的程式，要刻意測長時間的事'),
C.table(['測試','操作','預期','規格'],[
 ['T1','把間隔改成 0.1 秒跑 1 小時（等於 10 秒跑 100 小時）','工作管理員裡的記憶體不再增加','B3'],
 ['T2','執行中拔掉儀器 USB 1 分鐘再插回','那段是 NaN，之後自動恢復，測試沒停','B4'],
 ['T3','執行中用工作管理員強制結束程式','檔案裡有到最後一筆（最多少一筆）','B2'],
 ['T4','讓其中一台的電壓超出範圍','只有那一台 FAIL、輸出關閉，其他繼續','B5'],
 ['T5','跑完看報告','每台結果、失敗時間、斷線時段都有','B6'],
 ['T6','正式燒機前，完整跑一次 8 小時（用假負載也可以）','沒有任何人為介入就完成','全部'],
 ['T7','執行中把存檔資料夾設成唯讀 5 分鐘','Queue 長度變大、出現警告；恢復後消化完，資料沒有遺失','B2'],
 ['T8','（用假負載）執行中拔掉電腦電源再開機','檢查檔案到哪一筆；這就是 UPS 要保護的情況','B2']
]),
`<p>T1 的做法很實用：<b>把時間壓縮</b>，讓長時間才會出現的問題提早出現。T6 則是任何長時間程式交出去前都要做的「真的跑一次」。</p>`,
note('一台壞了不要影響其他台','B5 很容易被忽略：程式寫成「任何錯誤就停」，第 7 台壞掉，其他 9 台的燒機也跟著中斷，8 小時要重來。每一台的狀態各自管理（陣列或叢集陣列），一台的錯誤只影響那一台。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'長時間程式最不該做的是？',o:['每筆都 Build Array 接到 Shift Register 且沒有上限','每筆寫檔','記時間戳','用 Queue'],a:0,ex:'記憶體一直長。'},
 {q:'電腦隨時可能當掉，資料要怎麼存？',o:['每筆立刻寫檔，定時換檔','跑完一次存','每小時存一次記憶體內容','存在前面板'],a:0,ex:'最多損失最後一筆。'},
 {q:'通訊錯誤時，燒機程式應該？',o:['記 NaN、重開 VISA、繼續','停止程式','跳對話框等人按','重開電腦'],a:0,ex:'測試不中斷，斷線時段寫進報告。'},
 {q:'為什麼要記時間戳，而不是用圈數算時間？',o:['每一圈不剛好 10 秒，累積誤差大','時間戳比較小','圈數會溢位','LabVIEW 規定'],a:0,ex:'直接記實際時間。'},
 {q:'History.vi 前幾圈陣列還不滿 N 筆，起點 長度 − N 是負的，怎麼辦？',o:['和 0 取大的（Max & Min）','不用管','改用 For Loop','把 N 設成 0'],a:0,ex:'起點不能小於 0。'},
 {q:'想知道程式跑 100 小時會不會記憶體爆掉，最快的方法？',o:['把間隔縮短（壓縮時間）跑 1 小時，看記憶體','真的跑 100 小時','看程式碼猜','問主管'],a:0,ex:'讓問題提早出現。'},
 {q:'第 7 台燒壞了，程式應該？',o:['只關第 7 台、記錄時間，其他繼續','全部停止','重新開始 8 小時','忽略它'],a:0,ex:'一台的錯誤只影響那一台。'}
]}
]});
})();
