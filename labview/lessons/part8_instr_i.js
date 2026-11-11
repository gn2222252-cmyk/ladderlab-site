/* 第八部分：接入新儀器（I13）測試站：三台儀器一起用，先規劃再寫
   用到的儀器都在前面接過：GPD-3303S（I2–I4）、34461A（I5）、TBS2000B（I12）。這一課不教新的儀器命令，
   教「好幾台一起用」時才會出現的問題：順序、等多久、出錯時怎麼保證關電、每一片都有紀錄。
   被測物（5 V 穩壓板）、時間、故障都是本課設定的情境；下面的模擬只算「照你選的規劃，事情會怎麼發生」。
   LabVIEW 事實：大部分函式 error in 有錯就不執行，Close 類照樣執行（第 5 部分 CLAD 課）；狀態機＝While＋Case＋Shift Register＋Enum（I4）。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='接入新儀器';
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
function flow(items){
  const one=x=>{
    if(typeof x==='string')return `<span class="fb">${x}</span>`;
    if(x.loop)return `<span class="fl"><em>${x.label||'While Loop'}</em><span class="fin">${x.loop.map(one).join('<i class="fa">→</i>')}</span>${x.sr?`<small class="fsr">Shift Register：${x.sr}</small>`:''}</span>`;
    if(x.kase)return `<span class="fc"><em>Case：${x.label}</em><span class="fin">${x.kase.map(one).join('<i class="fa">或</i>')}</span></span>`;
    return '';
  };
  return `<div class="bdflow fig">${items.map(one).join('<i class="fa">→</i>')}</div>`;
}

/* ---------- 規劃模擬：選結構、等法、故障，看一片產品測下來會發生什麼 ---------- */
const PLAN={
 st:[['line','一條直線：每一步接 error 線，出錯就跳過後面的步驟'],['close','一條直線，但最後的「關輸出」不管 error 都執行'],['sm','狀態機：出錯跳到「錯誤」狀態，先關輸出、記下原因，再等下一片']],
 wait:[['w100','開輸出後固定等 100 ms'],['w2000','開輸出後固定等 2 秒'],['poll','一直讀電表：連續 3 筆差不到 1 mV 才算穩定（最多等 3 秒）']],
 fault:[['none','沒有故障'],['slow','這一片啟動比較慢（1.2 秒才穩定）'],['dmm','電表的線鬆了（讀取逾時）'],['short','產品短路（電源變成定電流）']]
};
let PN=0;
function planLab(d){
  const id='pl'+(++PN),S={st:'line',wait:'w100',fault:'dmm'};
  const grp=(k,t)=>`<fieldset><legend>${t}</legend>${PLAN[k].map(o=>`<label><input type="radio" name="${id}-${k}" value="${o[0]}"${S[k]===o[0]?' checked':''}> ${o[1]}</label>`).join('')}</fieldset>`;
  d.innerHTML=`<div class="planlab fig"><div class="wf-opts">${grp('st','程式的結構')}${grp('wait','開輸出之後等多久')}${grp('fault','這一片發生什麼事')}</div>
<table class="t pl-log"><thead><tr><th>時間</th><th>步驟</th><th>發生什麼</th></tr></thead><tbody></tbody></table>
<div class="pl-sum" aria-live="polite"></div></div>`;
  function run(){
    ['st','wait','fault'].forEach(k=>{const c=d.querySelector(`input[name="${id}-${k}"]:checked`);if(c)S[k]=c.value;});
    const F=S.fault,rows=[];let t=0,err='',out=false,vout=null,rip=null,rec=null,verdict='';
    const startT=F==='slow'?1200:450;
    const V=at=>F==='short'?0.02:at>=startT?5.003:5.003*Math.min(1,at/startT)*0.96;
    const add=(step,what,bad)=>rows.push([t,step,what,bad]);
    const skip=step=>add(step,'跳過：error in 有錯，這一步什麼都沒做','bad');
    add('讀序號','SN-0421');t+=50;
    out=true;add('電源','送 VSET1:12.0、ISET1:0.5、OUT1：輸出打開'+(F==='short'?'（電流頂到 0.5 A，進入定電流）':''),F==='short'?'warn':'');t+=30;
    let on=t;
    if(S.wait==='w100'){t+=100;add('等穩定','固定等 100 ms');}
    else if(S.wait==='w2000'){t+=2000;add('等穩定','固定等 2 秒');}
    else{
      if(F==='dmm'){t+=2000;err='電表讀取逾時（-1073807339）';add('等穩定','讀電表：等了 2000 ms 沒有回覆',"bad");}
      else{let prev=[],n=0;while(t-on<3000){t+=60;n++;const v=+V(t-on).toFixed(4);prev.push(v);if(prev.length>3)prev.shift();if(prev.length===3&&Math.max(...prev)-Math.min(...prev)<0.001)break;}
        add('等穩定',`讀電表 ${n} 次，最後三筆差不到 1 mV：${(t-on)} ms 時穩定在 ${V(t-on).toFixed(3)} V`);}
    }
    if(err&&S.st!=='sm')skip('量輸出電壓');
    else if(!err){
      if(F==='dmm'){t+=2000;err='電表讀取逾時（-1073807339）';add('量輸出電壓','READ? 等了 2000 ms 沒有回覆','bad');}
      else{t+=220;vout=V(t-on);add('量輸出電壓',`READ? → ${vout.toFixed(3)} V`+(Math.abs(vout-5)>0.05&&F!=='short'?'（還在爬升，還沒穩定）':''),Math.abs(vout-5)>0.05?'warn':'');}
    }
    if(err&&S.st==='sm'){
      add('錯誤（狀態）','記下原因：'+err,'bad');
      out=false;add('錯誤（狀態）','送 OUT0：用一條乾淨的 error 線送，送完再 Merge Errors','ok');
      rec='SN-0421，ERROR：'+err;add('錯誤（狀態）','寫一筆紀錄：'+rec,'ok');t+=40;
    }else{
      if(err)skip('抓波形算漣波');
      else{t+=320;rip=F==='short'?0.004:0.012;add('抓波形算漣波',`ACQ 單次、*OPC?、CURVE? → 峰對峰 ${(rip*1000).toFixed(0)} mV`);}
      if(err&&S.st==='line')skip('關輸出');
      else{out=false;add('關輸出','送 OUT0'+(err?'（這一步特別接成不管 error 都執行）':''),err?'ok':'');}
      t+=20;
      if(err)skip('判斷、存檔');
      else{const pass=vout>4.95&&vout<5.05&&rip<0.05;verdict=pass?'PASS':'FAIL';rec=`SN-0421，${vout.toFixed(3)} V，${(rip*1000).toFixed(0)} mV，${verdict}`;add('判斷、存檔','寫一筆紀錄：'+rec,pass?'ok':'warn');}
    }
    d.querySelector('.pl-log tbody').innerHTML=rows.map(r=>`<tr class="${r[3]||''}"><td>${(r[0]/1000).toFixed(2)} s</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');
    const s=[];
    s.push(out?['bad','電源輸出：還開著。產品還在通電，下一片換上去時可能燒掉，作業員也可能被電到。']:['ok','電源輸出：已經關掉。']);
    s.push(rec?['ok','這一片的紀錄：'+rec]:['bad','這一片沒有紀錄：之後查不到它測過，也不知道為什麼沒過。']);
    if(F==='slow'&&S.wait==='w100')s.push(['bad','誤判：產品其實是好的，只是啟動慢。量的時候它還在爬升，被判成 FAIL。']);
    if(F!=='slow'&&F!=='dmm'&&S.wait==='w2000')s.push(['warn','結果對，但每一片都多等了快 2 秒。一天 2000 片，就是一個多小時。']);
    if(F==='short'&&rec)s.push(['ok','短路被判成 FAIL。再想一步：短路時電源一直頂著 0.5 A，越早發現、越早關輸出越好（例如開輸出後先讀 IOUT1?）。']);
    if(F==='dmm'&&S.st==='sm')s.push(['ok','出錯的是電表，但電源照樣被關掉、原因也寫下來了。這就是要用狀態機的原因。']);
    s.push(['','這一片花了 '+(t/1000).toFixed(2)+' 秒。']);
    d.querySelector('.pl-sum').innerHTML=s.map(x=>`<p class="verdict-line ${x[0]}">${x[1]}</p>`).join('');
  }
  d.addEventListener('change',run);run();
}

/* =============================== I13 =============================== */
L.push({id:'I13',order:29.99,no:'I13',part:PART,title:'測試站：三台儀器一起用，先規劃再寫',mins:70,
goals:[['學會','把測試規格書翻成步驟；決定每一步之間要等什麼；三台一起用時程式該怎麼排；其中一台出錯時，最要緊的是什麼。'],['做出','一張測試站的規劃圖：狀態、每個狀態用到哪台儀器、出錯往哪裡走、一片產品的紀錄長什麼樣子。'],['為什麼','每一台都接得起來，不等於測試站寫得好。三台一起用時，最危險的錯誤不在通訊，在順序和收尾。'],['先備','I4（狀態機）、I5（電表）、I10（驅動程式四件事）、I12（示波器）。']],
check:'你能說出：測試站的程式為什麼不能是一條直線；「關輸出」那一步的 error 線為什麼要特別接；怎麼決定「等穩定」等多久；一片產品出錯時，紀錄裡要寫什麼。',
body:[
C.h3('情境','x','一片 5 V 穩壓板，要測兩樣東西'),
`<p>產線上要測一種 5 V 穩壓板。測試規格書寫：</p>
<ol><li>輸入給 12 V，電流限制 0.5 A。</li><li>輸出電壓要在 4.95～5.05 V。</li><li>輸出的漣波（峰對峰）要小於 50 mV。</li><li>每一片都要留紀錄：序號、量到的值、PASS 或 FAIL。</li></ol>
<p>手上的儀器都接過了：GPD-3303S 電源給輸入，34461A 電表量輸出電壓，TBS2000B 示波器看漣波。每一台怎麼講話，你已經有接入單了。</p>
<p>這一課不會出現新的儀器命令。新的問題只有一個：<b>三台一起用，程式要怎麼排</b>。</p>`,

C.h3('第 1 步','','先用中文寫出步驟，不要開 LabVIEW'),
`<p>把規格書翻成「一片產品從放上去到拿下來」的步驟。先自己寫，再往下看。</p>`,
ask('一片產品要經過哪些步驟？',
 `<ol><li>讀序號（條碼或手動輸入）。</li><li>電源設 12 V、0.5 A，打開輸出。</li><li>等產品穩定。</li><li>電表量輸出電壓。</li><li>示波器抓一次波形，算峰對峰。</li><li>關輸出。</li><li>判斷 PASS／FAIL，寫一筆紀錄。</li></ol>
<p>注意第 3 步。規格書沒有寫，可是一定要有：產品通電到輸出穩定需要時間。寫步驟時最容易漏掉的，就是這種「兩步之間要等什麼」。</p>`),
ask('三台儀器，什麼時候打開（VISA Open）、什麼時候關？每一片都開一次嗎？',
 `<p>不用。I10 的驅動程式分四件事：Initialize、Configure、Read、Close。打開連線、確認是對的機型、設定不會變的參數（電表的量程、示波器的通道和格式），都放在<b>程式開始時做一次</b>。每一片產品只做會變的事：開輸出、量、抓、關輸出。</p>
<p>每一片都重開連線，慢，而且每開一次就多一次出錯的機會。</p>`),

C.h3('第 2 步','','「等穩定」要等多久？'),
ask('開輸出之後，固定等 100 ms 再量，可以嗎？',
 `<p>要看產品。規格書沒寫啟動時間，就自己量：用 I12 的示波器抓一次開機的波形，看輸出多久爬到 5 V。</p>
<p>就算量到大部分是 0.45 秒，也會有幾片比較慢。固定時間設短了，慢的那片會在還沒穩定時被量到，<b>好的產品被判成 FAIL</b>。設長了，每一片都白等。</p>`),
ask('那有沒有不靠猜的等法？',
 `<p>讓儀器告訴你它穩定了：一直讀電表，最近 3 筆差不到 1 mV，才算穩定。再加一個上限（例如 3 秒），超過就當成這一片有問題。</p>
<p>這個迴圈裡要記得「最近 3 筆」：這一圈的值下一圈要用，所以又是 <b>Shift Register</b>（或一個 3 個元素的陣列放在 Shift Register 裡）。上限 3 秒，是迴圈的另一個停止條件。</p>
<p>你會發現，這跟 I6 天平的「ST 穩定才收」是同一種想法：<b>不要自己猜時間，看資料決定</b>。</p>`),

C.h3('第 3 步','','出錯的時候，最重要的是哪一件事？'),
`<p>先停一下。假設第 4 步電表讀取逾時：電表的線鬆了。這時候什麼事情最要緊？寫下你的答案。</p>`,
ask('電表逾時了，最要緊的是什麼？',
 `<p><b>把電源的輸出關掉。</b>量不到電壓，這一片頂多重測；電源一直開著，作業員換下一片時板子還帶電，可能燒掉，也可能電到人。</p>
<p>第二要緊的是<b>留下紀錄</b>：這一片沒測完，原因是電表逾時。沒有紀錄，這一片就像沒測過一樣混進良品裡。</p>`),
ask('如果整支程式是一條直線，每一步都接著 error 線，電表逾時之後會怎樣？',
 `<p>I4、I11 學過：大部分函式看到 error in 有錯，就不執行。電表之後的每一步都被跳過，<b>包括送 OUT0 關輸出</b>，也包括寫紀錄。</p>
<p>程式看起來「停在錯誤」，很安全；實際上電源還開著。這是測試站最常見、也最危險的寫法。</p>`),
`<p>下面的模擬照你選的規劃，跑一片產品，列出每一步發生什麼。<b>一次只改一個選項</b>。先用預設的「一條直線＋電表逾時」看一次，再換結構。</p>`,
{fn:planLab},
ask('改成「關輸出不管 error 都執行」，電源關了。還缺什麼？',
 `<p>紀錄。電源關了，但「判斷、存檔」還是被跳過：這一片什麼都沒留下。</p>
<p>你可以再一步一步補：存檔也不管 error 都執行、存檔時把錯誤訊息寫進去……補到最後，你會發現自己在做的事情是：<b>出錯時，要走另一條路</b>。這就是狀態機的「錯誤」狀態。</p>`),
ask('「關輸出」在 LabVIEW 裡要怎麼接，才會不管 error 都執行？',
 `<p>送 OUT0 是一個 VISA Write。VISA Write 看到 error in 有錯，就不送。所以不能把前面那條 error 線直接接給它。</p>
<p>做法：送 OUT0 的那個 VISA Write，error in 接一條<b>乾淨的</b>（不接，或接一個沒有錯誤的常數）；送完之後，用 ${fn('Programming','Dialog & User Interface','Merge Errors')} 把原本的錯誤和這一步的錯誤合起來，往下傳。原本的錯誤沒有被丟掉，關輸出也一定有做。</p>
<p>VISA Close 不用這樣處理：Close 類的函式本來就是 error in 有錯也會執行（第 5 部分 CLAD 課）。可是「關輸出」是一個命令，不是 Close。</p>`),

C.h3('第 4 步','','畫出狀態機'),
`<p>把步驟變成狀態，每個狀態寫清楚：用哪台儀器、做完往哪裡走、出錯往哪裡走。</p>`,
C.table(['狀態','做什麼','用哪台','正常時下一個','出錯時'],[
 ['初始化','三台 Initialize＋Configure；確認 *IDN?','全部','等產品','結束（顯示哪一台連不上）'],
 ['等產品','等序號（條碼或按鈕）','—','上電','—'],
 ['上電','VSET1:12.0、ISET1:0.5、OUT1','電源','等穩定','錯誤'],
 ['等穩定','讀電表，最近 3 筆差不到 1 mV；最多 3 秒','電表','量測','錯誤（逾時或一直不穩）'],
 ['量測','READ?；抓一次波形、算峰對峰','電表、示波器','斷電','錯誤'],
 ['斷電','OUT0','電源','判斷存檔','錯誤'],
 ['判斷存檔','比對規格，寫一筆紀錄','—','等產品','錯誤'],
 ['錯誤','記下原因 → OUT0（乾淨的 error 線）→ 寫一筆 ERROR 紀錄 → 清掉 error','電源','等產品','結束（連關輸出都失敗，就停機叫人）'],
 ['結束','三台 Close','全部','—','—']
]),
flow(['初始化',{loop:[{kase:['等產品','上電','等穩定','量測','斷電','判斷存檔','錯誤'],label:'目前狀態（Enum）'}],label:'While Loop',sr:'狀態、error、這一片的資料、穩定判斷用的最近 3 筆'},'結束：三台 Close']),
ask('Shift Register 裡要放哪些東西？',
 `<p>問 I4 那一句：「這個值會被改掉，而且下一圈要用嗎？」</p>
<ul><li><b>目前狀態</b>：每一圈決定下一圈做什麼。</li><li><b>error</b>：哪一步出錯，下一圈才知道要走「錯誤」狀態。</li><li><b>這一片的資料</b>（序號、電壓、漣波）：在「量測」量到，到「判斷存檔」才用。</li><li><b>最近 3 筆電表讀值</b>：只有「等穩定」用。</li></ul>
<p>三台儀器的 VISA 資源不用：它們在迴圈裡不會變，從迴圈外接一般的通道進來就好。</p>`),
ask('「錯誤」狀態最後為什麼要清掉 error？',
 `<p>不清的話，error 一直留在 Shift Register 裡，下一片的「上電」看到 error in 有錯就不做事，整個測試站卡住。錯誤已經處理過了（關電、記錄），就清掉，讓下一片從乾淨的狀態開始。這跟 I9 重連之前清 error、I11 逾時清 error 是同一個道理。</p>`),
ask('「判斷存檔」要存成什麼樣子？',
 `<p>一片一列，欄位固定：時間、序號、輸出電壓、漣波、判定（PASS／FAIL／ERROR）、錯誤原因。出錯的那一片也要有一列，判定寫 ERROR，原因寫「電表逾時」。</p>
<p>在 LabVIEW 裡，這些放在一個 Cluster 裡沿著 Shift Register 走，存檔時用第 7 部分學的 Format Into String 或 Write Delimited Spreadsheet 寫成一列 CSV。</p>`),

C.h3('回頭看','','規劃的順序'),
C.table(['先想','再想','最後才寫'],[
 ['規格書翻成步驟；找出「兩步之間要等什麼」','每一步出錯時，最要緊的是什麼（安全、紀錄）','狀態機：每個狀態一頁 Case'],
 ['哪些事只做一次（開連線、不會變的設定）','什麼時候算「穩定」：看資料，不要猜時間','關輸出用乾淨的 error 線，最後 Merge Errors'],
 ['一片產品的紀錄有哪些欄位','錯誤處理完要清掉，下一片才會跑','每一台的驅動程式照 I10 的四件事']
]),
`<p>每一台儀器的接入，你用六步就能自己走完。好幾台一起用時，多的是這一張表：<b>先排順序、找出等待、決定出錯往哪裡走，最後才打開 LabVIEW</b>。</p>`,
tip('自己再做一次','把天平（I6）加進來：測完電壓之後秤重，重量也要寫進紀錄。想一想：天平要放在哪個狀態？它出錯時，電源已經關了嗎？紀錄要多哪一欄？'),

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'測試站寫成一條直線、每一步接 error 線。中間電表逾時，最危險的後果是？',o:['後面的「關輸出」被跳過，電源還開著','電表壞掉','示波器抓不到波形','程式跑太慢'],a:0,ex:'大部分函式 error in 有錯就不執行，送 OUT0 也一樣。'},
 {q:'要讓「送 OUT0」不管前面有沒有錯都執行，怎麼接？',o:['這個 VISA Write 的 error in 接乾淨的，送完再用 Merge Errors 合起來','把 error 線拿掉，錯誤就不管了','改用 VISA Close','在前面加 Wait'],a:0,ex:'原本的錯誤不能丟掉，所以要 Merge Errors。'},
 {q:'開輸出後「等穩定」，比較好的做法是？',o:['一直讀電表，連續幾筆差很小才算穩定，並設一個上限時間','固定等 100 ms','固定等 10 秒最保險','不用等'],a:0,ex:'看資料決定，不要猜時間；上限是為了發現有問題的產品。'},
 {q:'三台儀器的 VISA Open 放在哪裡？',o:['程式開始時做一次（初始化狀態）','每一片產品都開一次','每一個狀態都開一次','不用開'],a:0,ex:'開連線、確認機型、不會變的設定，都只做一次。'},
 {q:'電表逾時的那一片，紀錄應該？',o:['也要寫一列：判定 ERROR、原因「電表逾時」','不用寫，反正沒測完','寫 PASS','寫 FAIL，不用寫原因'],a:0,ex:'沒有紀錄，這一片就像沒測過。'},
 {q:'「錯誤」狀態處理完，為什麼要清掉 error？',o:['不然下一片的每一步看到 error in 有錯都不做事','清掉才能存檔','LabVIEW 規定','為了讓畫面好看'],a:0,ex:'已經處理過的錯誤要清掉；處理不了的（例如連關電都失敗）才停機。'},
 {q:'哪一個「不需要」放進 Shift Register？',o:['三台儀器的 VISA 資源','目前狀態','error','這一片量到的電壓'],a:0,ex:'迴圈裡不會變的值，用一般通道從迴圈外接進來。'}
]}
]});
})();
