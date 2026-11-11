/* 第八部分：接入新儀器（I14）寫入：把數字送進儀器，怎麼知道它真的照做了
   用到的儀器都在前面接過：GPD-3303S（I2–I4：設定命令沒有回覆、ERR? 才看得到錯誤、範圍 0～32 V、命令 15 字元內）、
   台達 DTB（I7：06H 寫一個字、正常回覆原封不動、例外回覆功能碼加 80H、0810H 通訊寫入許可）。
   LabVIEW：Number To Decimal String 只給整數；Format Into String 的 %.3f；%.; 指定小數點用句點（通用知識，LabVIEW 說明的格式字串語法）。
   「有些設備的設定存在寫入次數有上限的記憶體」是通用知識，請以各設備說明書為準。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='接入新儀器';
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
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

/* ---------- 寫入檢查台：用模擬的 GPD-3303S 實際寫一次 ---------- */
const WV=[['5','5 V'],['12.345','12.345 V'],['33','33 V（超過 32 V）'],['-1','−1 V（打錯了）']];
const WF=[['dec','"VSET1:" ＋ Number To Decimal String'],['f','Format Into String，格式 VSET1:%f'],['f3','Format Into String，格式 VSET1:%.3f'],['comma','同上 %.3f，但這台電腦的小數點是逗號']];
const WC=[['none','送完就好'],['rb','送完再問 VSET1? 讀回來比對'],['rberr','讀回來比對，再問 ERR?']];
let WN=0;
function writeLab(d){
  if(!window.InstSim){d.innerHTML='<div class="fig"><p>模擬儀器沒有載入。</p></div>';return;}
  const id='wr'+(++WN),S={v:'12.345',f:'dec',c:'none'};
  const grp=(k,t,list)=>`<fieldset><legend>${t}</legend>${list.map(o=>`<label><input type="radio" name="${id}-${k}" value="${o[0]}"${S[k]===o[0]?' checked':''}> ${o[1]}</label>`).join('')}</fieldset>`;
  d.innerHTML=`<div class="planlab fig"><div class="wf-opts">${grp('v','操作員輸入的電壓',WV)}${grp('f','數字怎麼變成命令',WF)}${grp('c','送完之後',WC)}</div><div class="wr-out" aria-live="polite"></div></div>`;
  const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const vis=s=>esc(s).replace(/\r/g,'\\r').replace(/\n/g,'\\n');
  function run(){
    ['v','f','c'].forEach(k=>{const c=d.querySelector(`input[name="${id}-${k}"]:checked`);if(c)S[k]=c.value;});
    const v=+S.v,s=InstSim.open('gpd');
    s.write('VSET1:1.0\n');                                 // 原本的設定是 1 V
    let txt;
    if(S.f==='dec')txt=String(Math.round(v));
    else if(S.f==='f')txt=v.toFixed(6);
    else if(S.f==='f3')txt=v.toFixed(3);
    else txt=v.toFixed(3).replace('.',',');
    const cmd='VSET1:'+txt;
    s.write(cmd+'\n');
    const rows=[['送出',`<code>${vis(cmd+'\n')}</code>（${cmd.length} 個字元，不含 \\n）`]];
    let rb=null,er=null;
    if(S.c!=='none'){const r=s.query('VSET1?');rb=parseFloat(r.text);rows.push(['VSET1? 回',`<code>${vis(r.text)}</code>`]);}
    if(S.c==='rberr'){const r=s.query('ERR?');er=r.text.trim();rows.push(['ERR? 回',`<code>${vis(r.text)}</code>`]);}
    const actual=s.inst.state().v[0],want=v;
    rows.push(['儀器真正的設定（偷看）',actual.toFixed(3)+' V']);
    const ok=Math.abs(actual-want)<1e-9,saw=rb!==null;
    let msg,cls;
    if(ok){msg='✔ 儀器設成了 '+actual.toFixed(3)+' V'+(saw?'，你也讀回來確認過了。':'。這次對了，可是程式其實不知道：要是錯了，它也照樣往下跑。');cls=saw?'ok':'warn';}
    else if(!saw){msg='✖ 你要的是 '+want+' V，儀器'+(Math.abs(actual-1)<1e-9?'還是原本的 1.000 V：命令被拒絕了':'被設成了 '+actual.toFixed(3)+' V')+'。設定命令沒有回覆，程式完全不知道。';cls='bad';}
    else if(er&&!/No Error/i.test(er)){msg='✔ 抓到了：讀回來是 '+rb.toFixed(3)+' V，不是 '+want+' V；ERR? 說「'+er+'」。程式可以停下來告訴操作員，而不是帶著錯的電壓往下測。';cls='ok';}
    else if(er){msg='✔ 抓到了：讀回來是 '+rb.toFixed(3)+' V，不是 '+want+' V；ERR? 卻說 No Error。儀器沒有做錯任何事，它很乖地收到了「'+txt+'」：錯在你送的字串。只有讀回來比對抓得到這一種。';cls='ok';}
    else{msg='△ 讀回來是 '+rb.toFixed(3)+' V，跟要的 '+want+' V 不一樣：你知道「沒設成」，但不知道為什麼。再問 ERR? 看看。';cls='warn';}
    if(S.f==='dec'&&v%1)msg+=' Number To Decimal String 只給整數，'+v+' 變成了 '+txt+'。';
    if(S.f==='f')msg+=' %f 預設 6 位小數，命令變長了（這台限 15 個字元）；能用，但沒必要。';
    if(S.f==='comma')msg+=' 小數點變成逗號，儀器看不懂。格式字串前面加 %.; 可以指定用句點。';
    if(v>32||v<0)msg+=' 更好的做法：送出之前，程式自己先檢查範圍（In Range and Coerce），不要等儀器拒絕。';
    d.querySelector('.wr-out').innerHTML='<table class="t pl-log"><tbody>'+rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')+'</tbody></table>'+`<p class="verdict-line ${cls}">${msg}</p>`;
  }
  d.addEventListener('change',run);run();
}

/* =============================== I14 =============================== */
L.push({id:'I14',order:29.995,no:'I14',part:PART,title:'寫入：把數字送進儀器，怎麼知道它真的照做了',mins:50,
goals:[['學會','數字怎麼變成命令字串而不走樣；寫完怎麼知道儀器照做了；好幾個設定要照什麼順序寫；迴圈裡多久寫一次。'],['做出','一個「設定電壓」的子 VI 規劃：檢查範圍 → 組命令 → 寫 → 讀回比對 → 問錯誤。'],['為什麼','讀錯了，頂多數字不對；寫錯了，儀器會照做。而且大部分設定命令沒有回覆：不特別去確認，程式永遠不知道。'],['先備','I2～I4（電源）、I7（溫控器）。']],
check:'你能說出：寫入和讀取最大的不同；12.345 用 Number To Decimal String 組命令會送出什麼；寫完怎麼確定寫進去了；電源的設定和開輸出要照什麼順序；為什麼要用 Shift Register 記住上一次寫的值。',
body:[
C.h3('情境','x','操作員在畫面上打一個電壓'),
`<p>前面幾課大多在「讀」。這一課反過來：操作員在 LabVIEW 畫面上輸入 12.345 V，程式要把電源設成這個電壓。</p>
<p>看起來只是一行 VISA Write。先想一下這一行之前、之後，各會出什麼事。</p>`,
ask('寫入和讀取，最大的差別是什麼？',
 `<p><b>讀錯了，頂多數字不對；寫錯了，儀器會照做。</b>電壓設成 33 V、溫度設成 500 度，接在後面的東西會燒掉。</p>
<p>第二個差別：讀取一定有回覆，讀不到就逾時，你會知道。I2 學過，電源的設定命令<b>沒有回覆</b>：送對送錯，儀器都不吭聲。不特別去確認，程式永遠不知道結果。</p>`),

C.h3('第 1 步','','數字怎麼變成命令字串'),
`<p>命令是 <code>VSET1:12.345</code>。前半是固定的文字，後半是操作員輸入的數字。LabVIEW 裡這個數字是 DBL，要先變成文字。</p>`,
ask('用「VSET1:」接上 Number To Decimal String 的結果，送出去的是什麼？',
 `<p><code>VSET1:12</code>。Number To Decimal String 只給整數，小數四捨五入掉了。儀器很乖地設成 12 V，沒有任何錯誤，因為「12」是合法的電壓。</p>
<p>這種錯最難找：沒有錯誤訊息，電壓也「差不多」。</p>`),
ask('那用 Format Into String？格式字串寫什麼？',
 `<p>${fn('Programming','String','Format Into String')}，格式字串寫 <code>VSET1:%.3f</code>：固定文字直接寫在格式字串裡，%.3f 是小數 3 位。輸出就是 <code>VSET1:12.345</code>。</p>
<p>只寫 %f 也能用，但預設是 6 位小數：<code>VSET1:12.345000</code>，剛好 15 個字元。這台說明書寫命令要在 15 個字元內，再長一點就會被拒絕。照說明書的位數寫，不要讓預設值替你決定。</p>`),
note('程式搬到別台電腦','（通用知識）有些語系的電腦，小數點是逗號。LabVIEW 預設照系統的小數點格式化數字，送出去會變成 VSET1:12,345，儀器看不懂。格式字串最前面加 %.; 可以指定這一次用句點：%.;VSET1:%.3f。'),

C.h3('第 2 步','','寫完了，怎麼知道它照做了？'),
`<p>下面用模擬的電源實際寫一次。原本的設定是 1 V。<b>一次只改一個選項</b>，看「儀器真正的設定」和「程式知道的」是不是一樣。</p>`,
{fn:writeLab},
ask('「送完就好」的時候，哪幾種情況程式會以為成功，其實沒有？',
 `<p>四種都會：12 變成 12（少了小數）、33 V 被拒絕、−1 V 被拒絕、逗號看不懂。儀器都沒有回覆，所以程式這邊每一次看起來都一樣「成功」。</p>
<p>33 V、−1 V 和逗號的情況，儀器還維持在<b>原本的 1 V</b>。程式以為是 33 V 在往下測，資料全部記錯。</p>`),
ask('讀回來比對，和問 ERR?，各抓得到什麼？',
 `<p><b>讀回來</b>（VSET1?）抓得到「結果不對」：不管原因是什麼，設定值跟你要的不一樣，就知道有問題。</p>
<p><b>問 ERR?</b> 抓得到「為什麼」：Data out of range、Invalid character。讀回來比對會知道設錯了，ERR? 才告訴你錯在哪。</p>
<p>兩個都做最完整。12 變成 12 那一種，ERR? 是 No Error（儀器沒有做錯任何事），只有讀回來比對抓得到：錯的是你送的字串。</p>`),
ask('讀回來的值，要「完全相等」才算對嗎？',
 `<p>不一定。儀器的設定有解析度：你送 12.3456，它可能存成 12.346 或 12.34。讀回來用「差不到多少」來比：差的絕對值小於說明書寫的設定解析度（或半個最小位數）就算對。</p>
<p>另外，DBL 用「等於」比較本來就容易出錯：12.345 存在電腦裡不是剛好 12.345，算過一次、轉過一次字串，最後一位就可能不一樣。比「差多少」比較可靠。</p>`),
ask('超過 32 V，要等儀器拒絕嗎？',
 `<p>不要。程式送出之前，自己先檢查：${fn('Programming','Comparison','In Range and Coerce')} 上限接 32、下限接 0，超出範圍就不送，直接告訴操作員。</p>
<p>理由有兩個：儀器拒絕時不會主動講（要問 ERR? 才知道）；而且有些設備不會拒絕，會直接把值卡在上限，你以為設了 33，其實是 32。<b>儀器的範圍檢查是最後一道防線，不是唯一一道。</b></p>`),

C.h3('第 3 步','','寫入的順序'),
ask('電源要輸出 12 V、限流 0.5 A。三個命令 VSET1、ISET1、OUT1，照什麼順序送？',
 `<p><b>先設好，再開輸出</b>：VSET1:12.000 → ISET1:0.500 → OUT1。</p>
<p>如果先 OUT1，輸出打開的那一刻，用的是<b>上一次留下來的設定</b>，可能是上一個人設的 30 V。後面的 VSET1 再快，那一瞬間也已經送出去了。</p>
<p>關的時候反過來：先 OUT0，再改設定。</p>`),
ask('溫控器（I7）改設定溫度，Modbus 的寫入有沒有回覆？怎麼確認？',
 `<p>有。功能碼 06 寫一個字，正常的回覆是<b>原封不動送回來</b>；被拒絕時功能碼加 80H（86H），後面一個位元組是原因。所以 Modbus 寫入比電源好確認：比對回覆是不是跟送出去的一模一樣。</p>
<p>可是 I7 也看過：0810H 的通訊寫入許可沒打開，寫 SV 會被拒絕。所以初始化時要先寫許可，再寫 SV，順序一樣重要。回覆是例外的時候，不要假裝成功。</p>`),

C.h3('第 4 步','','多久寫一次？'),
`<p>畫面上有一個「設定電壓」的數值控制項，程式在 While Loop 裡跑。最直覺的寫法：每一圈都把控制項的值寫給電源。</p>`,
ask('每一圈都寫，有什麼問題？',
 `<ul><li><b>通訊塞車</b>：迴圈 100 ms 一圈，每一圈都多一個命令、一次讀回、一次 ERR?，其他要讀的資料就變慢了。</li>
<li><b>設定可能有寫入次數的上限</b>（通用知識）：有些設備把設定存進斷電也記得的記憶體，這種記憶體能寫的次數有限。一秒寫十次，幾個月就寫壞了。你的設備是不是這樣，要查說明書。</li>
<li><b>紀錄看不出來誰改了什麼</b>：每一圈都在「寫」，真的有人改設定時反而看不出來。</li></ul>`),
ask('那要怎麼寫？要用到什麼結構？',
 `<p><b>只在值有變的時候才寫</b>。要知道「有沒有變」，就要記得上一次寫的是多少：這一圈的值，下一圈要用，所以是 <b>Shift Register</b>。</p>
<p>每一圈：控制項的值跟 Shift Register 裡的「上一次寫的值」比 → 不一樣，Case 走「寫」那一頁：檢查範圍、組命令、寫、讀回比對、問 ERR?，成功才把新值放進 Shift Register → 一樣，Case 走「什麼都不做」。</p>
<p>注意最後一句：<b>寫失敗時不要更新</b>「上一次寫的值」。不然下一圈會以為已經寫好了，再也不會重試。</p>
<p>另一種做法是 Event Structure：控制項的 Value Change 事件發生才寫。效果一樣，第 6 部分的架構課有講。</p>`),
flow(['VISA Open',{loop:['讀「設定電壓」控制項',{kase:['一樣：什麼都不做','不一樣：In Range 檢查 → Format Into String（%.;VSET1:%.3f）→ VISA Write → VSET1? 讀回比對 → ERR? → 成功才更新上一次的值'],label:'跟上一次寫的值一樣嗎？'},'其他要讀的資料'],label:'While Loop',sr:'上一次成功寫入的值、error'},'OUT0 → VISA Close']),

C.h3('回頭看','','寫入的檢查表'),
C.table(['寫之前','寫的時候','寫之後'],[
 ['程式自己檢查範圍（In Range and Coerce）','Format Into String 照說明書的位數；必要時 %.; 指定句點','讀回來比對（差在解析度以內）'],
 ['確認順序：先設定、後開輸出；Modbus 先寫許可','一個命令一次 VISA Write，帶上結尾字元','問錯誤（ERR?、SYST:ERR?）或比對 Modbus 的回覆'],
 ['值沒變就不寫（Shift Register 記上一次）','—','失敗時不更新「上一次的值」，讓下一圈重試；告訴操作員']
]),
tip('自己做一次','到 <a href="instlab.html">儀器接入練習台</a> 選電源供應器：送 VSET1:12（整數）、VSET1:33、VSET1:12,5，每一次都先問 VSET1? 再問 ERR?，把三種情況各看一遍。'),

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'"VSET1:" 接上 Number To Decimal String(12.345)，送出的命令是？',o:['VSET1:12','VSET1:12.345','VSET1:12.3','VSET1:12.345000'],a:0,ex:'Number To Decimal String 只給整數。要小數用 Format Into String 的 %.3f。'},
 {q:'電源的設定命令沒有回覆。怎麼確定設進去了？',o:['送完再問設定值（VSET1?）讀回來比對，並問 ERR?','等 1 秒就一定好了','看 VISA Write 有沒有錯誤','不用確定'],a:0,ex:'VISA Write 沒錯只代表位元組送出去了，不代表儀器接受了。'},
 {q:'送 VSET1:33（上限 32），沒有問 ERR? 也沒有讀回來。儀器現在的設定是？',o:['還是原本的值，命令被拒絕了','33 V','32 V','0 V'],a:0,ex:'這台超出範圍時不改設定，只記一個錯誤。程式不問就不知道。'},
 {q:'電源輸出、電壓、限流，正確的順序是？',o:['先設電壓和限流，再開輸出','先開輸出，再設電壓','先開輸出，再設限流','沒有差別'],a:0,ex:'開輸出那一刻用的是當下的設定。'},
 {q:'畫面上的設定值，為什麼要用 Shift Register 記住「上一次寫的值」？',o:['只在值有變的時候才寫','讓迴圈跑快一點','VISA 規定','為了畫圖'],a:0,ex:'每一圈都寫會塞住通訊，有些設備的設定記憶體還有寫入次數的上限。'},
 {q:'寫入失敗（讀回來不一樣）時，「上一次寫的值」要不要更新？',o:['不要，下一圈才會重試','要，不然會一直寫','看心情','改成 0'],a:0,ex:'更新了，程式就以為已經寫好，不會再試。'},
 {q:'Modbus 06 寫入的正常回覆長什麼樣子？',o:['跟送出去的一模一樣','只回 OK','沒有回覆','回目前溫度'],a:0,ex:'被拒絕時功能碼加 80H，後面一個位元組是原因。'}
]}
]});
})();
