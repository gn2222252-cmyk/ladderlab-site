/* 第八部分：接入新儀器（I1 起）
   重點不是某一台儀器的答案，而是「拿到一台沒看過的設備，照什麼順序想」。
   每一課都照同一個順序寫：看到什麼 → 問自己什麼 → 試一下 → 出了什麼事 → 所以要這樣做。
   儀器與通訊細節以各廠說明書為準；本檔只放判斷方法，不放某台儀器的命令。 */
(function(){
const L=window.LESSONS;
const PART='接入新儀器';
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
/* 問自己：一個問題，接著是怎麼想出答案 */
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;

/* ---------- 判斷流程：VISA、DAQ 還是 TCP ---------- */
const DEVICES=[
 {n:'電源供應器（GW Instek GPD-3303S）',back:'背板有一個 USB 孔。裝好驅動後，裝置管理員多出一個 COM 埠。',man:'說明書有「Remote Control」一章，列了一張命令表，例如設定電壓、讀回電流。',talks:true,link:'serial',
  why:'它有自己的 CPU，聽得懂文字命令。USB 在電腦上變成 COM 埠，所以走序列埠。'},
 {n:'數位電表（Keysight 34461A）',back:'背板有 USB 和網路孔。',man:'說明書說用 SCPI 命令，網路可以用 VXI-11、HiSLIP 或 Socket 連線。',talks:true,link:'lan',lan:'scpi',
  why:'它是標準的量測儀器，USB 和網路講的是同一套 SCPI 命令。'},
 {n:'壓力傳送器（輸出 4–20 mA）',back:'只有兩條線，沒有任何通訊孔。',man:'規格表只有一句：輸出 4–20 mA 對應 0–10 bar。沒有命令表。',talks:false,
  why:'它只會把壓力變成電流，不會聽、也不會回答。要有人幫它把電流量成數字。'},
 {n:'溫控器（台達 DTB 系列）',back:'端子台上有一對 RS-485 端子（常見的標示是 D+、D−，依型號的端子圖）。',man:'說明書附一張 Modbus 位址表：哪個位址是現在溫度、哪個是設定溫度。',talks:true,link:'serial',
  why:'它會說話，說的是 Modbus。RS-485 經轉接器接到電腦後也是一個 COM 埠。'},
 {n:'電子天平（A&D）',back:'背板有一個 9 針的 RS-232C 接頭。',man:'說明書有「資料輸出格式」一節，寫每一筆重量送出來的字元排列。',talks:true,link:'serial',
  why:'它會說話，而且常常不用問、自己一直送。接頭是 RS-232，就是序列埠。'},
 {n:'類比輸入模組（研華 ADAM-6017）',back:'一個網路孔，加上一排接感測器的端子。',man:'說明書附一張 Modbus/TCP 位址表（Modbus/TCP 的標準埠號是 502）。',talks:true,link:'lan',lan:'custom',
  why:'它會說話，走網路，說的是 Modbus/TCP。這不是量測儀器那一套，要自己管連線和封包。'},
 {n:'K 型熱電偶',back:'兩條細線，沒有接頭。',man:'沒有說明書，只有型號和一張「溫度對毫伏」的表。',talks:false,
  why:'它只產生幾毫伏的電壓。要用有熱電偶輸入的擷取卡來量。'},
 {n:'本課程的 PLC（三菱 FX3S）',back:'一個圓形 8 針的編程口（RS-422）。',man:'編程口協定：STX 開頭、ETX 結尾、後面兩碼校驗。你在第 12～14 課用過。',talks:true,link:'serial',
  why:'它會說話。RS-422 經 USB-SC09-FX 轉接線變成 COM 埠。'}
];
const RESULT={
 visa:{t:'用 VISA',c:'var(--accent)',d:'VISA Open（或 VISA Configure Serial Port）→ Write → Read → Close。序列埠、USB、GPIB、網路上的量測儀器，都是同一組函式，只差資源名稱。',next:'下一步翻說明書的通訊章節，抄下：通訊參數、命令怎麼寫、用什麼字元結尾、回覆長什麼樣。'},
 daq:{t:'用 DAQ（DAQmx）',c:'var(--accent2)',d:'設備自己不會說話，只給一個電壓、電流或接點。要用資料擷取卡把訊號量成數字，LabVIEW 這邊用 DAQmx：Create Virtual Channel → Start Task → Read → Clear Task。',next:'下一步看規格表：輸出是電壓還是電流、範圍多大、對應的物理量是多少；再看擷取卡的輸入範圍接不接得住。'},
 tcp:{t:'用 TCP 函式（或 Modbus 函式庫）',c:'var(--warn)',d:'設備走網路，但說的不是量測儀器的 SCPI，而是 Modbus/TCP 或廠商自訂的封包。用 TCP Open Connection → Write → Read → Close Connection，自己決定一次讀幾個位元組；有現成的 Modbus 函式庫就用函式庫。',next:'下一步翻說明書：IP 和埠號、封包每一個位元組的意思、要讀的資料在哪個位址。'}
};
function dtree(el){
  el.className='dtree fig';
  let dev=0,step=0,path=[],done=null;
  function target(d){return !d.talks?'daq':(d.link==='lan'&&d.lan==='custom')?'tcp':'visa';}
  function draw(msg){
    const d=DEVICES[dev];
    let h='<div class="dt-pick"><label>選一台設備：<select>'+DEVICES.map((x,i)=>`<option value="${i}"${i===dev?' selected':''}>${x.n}</option>`).join('')+'</select></label></div>';
    h+=`<div class="dt-card"><p><b>你看到的</b>：${d.back}</p><p><b>說明書寫的</b>：${d.man}</p></div>`;
    if(path.length)h+='<ol class="dt-path">'+path.map(p=>`<li>${p}</li>`).join('')+'</ol>';
    if(msg)h+=`<p class="dt-msg">${msg}</p>`;
    if(done){const r=RESULT[done];
      h+=`<div class="dt-res" style="border-left-color:${r.c}"><b>${r.t}</b><p>${r.d}</p><p><b>為什麼是它</b>：${d.why}</p><p>${r.next}</p></div><p><button type="button" class="btn" data-a="again">換一台再判斷一次</button></p>`;
    }else if(step===0){
      h+='<p class="dt-q">第 1 問：這台設備自己會說話嗎？</p><p class="dt-hint">判斷方法：說明書裡有沒有「命令表」或「通訊協定」。有，就是會說話。只有「輸出幾伏、幾毫安」的規格，就是不會。</p>'+
         '<p><button type="button" class="btn" data-a="talk">會，它有命令表或通訊協定</button> <button type="button" class="btn" data-a="mute">不會，它只輸出電壓、電流或接點</button></p>';
    }else if(step===1){
      h+='<p class="dt-q">第 2 問：它用什麼接到電腦？</p><p class="dt-hint">看背板的接頭，不要看盒子上的廣告詞。USB 要多看一眼：裝好驅動後如果多出一個 COM 埠，它就是序列埠。</p>'+
         '<p><button type="button" class="btn" data-a="serial">RS-232、RS-485、RS-422、USB 或 GPIB</button> <button type="button" class="btn" data-a="lan">網路線</button></p>';
    }else if(step===2){
      h+='<p class="dt-q">第 3 問：說明書說它在網路上講什麼？</p><p class="dt-hint">量測儀器會寫 SCPI、VXI-11、HiSLIP 或 Socket。工業設備會寫 Modbus/TCP，或一張自己定義的封包格式。</p>'+
         '<p><button type="button" class="btn" data-a="scpi">SCPI（VXI-11、HiSLIP、Socket）</button> <button type="button" class="btn" data-a="custom">Modbus/TCP 或自訂封包</button></p>';
    }
    el.innerHTML='<div aria-live="polite">'+h+'</div>';
    if(el.dataset.kb){const f=el.querySelector('button[data-a]');if(f)f.focus();}
    el.dataset.kb='1';
    el.querySelector('select').onchange=e=>{dev=+e.target.value;step=0;path=[];done=null;draw();};
    el.querySelectorAll('button[data-a]').forEach(b=>b.onclick=()=>act(b.dataset.a));
  }
  function act(a){
    const d=DEVICES[dev];
    if(a==='again'){dev=(dev+1)%DEVICES.length;step=0;path=[];done=null;return draw();}
    if(step===0){
      if((a==='talk')!==d.talks)return draw(a==='talk'?'再看一次說明書寫的：裡面沒有任何命令，只有輸出規格。沒有命令可以送，它就不會回答你。':'再看一次：說明書有命令表或位址表，表示它聽得懂、也會回答。');
      if(!d.talks){path.push('它不會說話，只輸出訊號。');done='daq';return draw();}
      path.push('它會說話：說明書有命令表或通訊協定。');step=1;return draw();
    }
    if(step===1){
      if(a!==d.link)return draw(a==='lan'?'背板上沒有網路孔。照你實際看到的接頭選。':'這台是用網路線接的。照你實際看到的接頭選。');
      if(a==='serial'){path.push('接頭是序列埠這一類（或 USB、GPIB）。');done='visa';return draw();}
      path.push('接頭是網路線。');step=2;return draw();
    }
    if(step===2){
      if(a!==d.lan)return draw(a==='scpi'?'說明書給的是 Modbus/TCP 位址表，不是 SCPI 命令。':'說明書寫的是 SCPI 命令，它是量測儀器那一套。');
      path.push(a==='scpi'?'它在網路上講 SCPI。':'它在網路上講 Modbus/TCP 或自訂封包。');done=target(d);return draw();
    }
  }
  draw();
}

/* 第一次出現的名詞 */
const NAMES=C.table(['會看到的名詞','一句話'],[
 ['RS-232、RS-422、RS-485','三種序列埠的接線方式。對電腦來說都是一個 COM 埠。RS-485 可以一對線接很多台'],
 ['GPIB','量測儀器專用的並列介面，接頭又寬又厚。舊儀器很常見'],
 ['SCPI','量測儀器通用的文字命令寫法，例如 <code>MEAS:VOLT:DC?</code>。I5 會教怎麼讀'],
 ['VXI-11、HiSLIP、Socket','量測儀器走網路時的三種連線方式。講的都還是 SCPI'],
 ['Modbus、Modbus/TCP','工業設備通用的通訊協定，用位址找資料。走序列埠的叫 Modbus RTU 或 ASCII，走網路的叫 Modbus/TCP。I7 會教'],
 ['DAQ、DAQmx','資料擷取。DAQ 是把電壓、電流量成數字的硬體；DAQmx 是 LabVIEW 裡操作它的那組函式'],
 ['資源名稱','VISA 用來指出「哪一台、怎麼連」的一串字，例如 <code>COM3</code>']
]);

/* ---------- 儀器接入單 ---------- */
const SHEET=[
 ['它會說話嗎','看說明書有沒有命令表或通訊協定','會：編程口協定'],
 ['接頭與介面','看背板','圓形 8 針，RS-422；經 USB-SC09-FX 變成 COM 埠'],
 ['通訊參數','說明書的通訊設定表','9600 bps、7 資料位、偶同位、1 停止位'],
 ['誰先開口','說明書的通訊流程','電腦先問，PLC 才回答'],
 ['命令怎麼寫','命令格式一節','STX + 命令碼 + 位址 + 長度 + ETX + 兩碼校驗'],
 ['一筆資料到哪裡結束','命令格式一節','沒有換行字元；看到 ETX 後再收兩碼校驗'],
 ['回覆長什麼樣','回覆格式一節','STX + 十六進位文字 + ETX + 校驗；或一個 ACK／NAK'],
 ['要變成什麼數字','你的需求','每 4 個十六進位字元是一個 16 位元整數，低位元組在前'],
 ['等多久算失敗','說明書或自己實測','正常幾十毫秒就回；逾時設 1000 ms'],
 ['怎麼知道出錯','錯誤回覆一節','回 NAK，或校驗碼對不起來']
];

L.push({id:'I01',order:26,no:'I1',part:PART,title:'拿到一台沒看過的儀器：先別開 LabVIEW',mins:40,
goals:[['學會','接一台新設備的六個步驟，以及每一步在回答什麼問題；VISA、DAQ、TCP 怎麼選。'],['做出','一張填好的「儀器接入單」。之後每接一台設備都先填這張。'],['為什麼','工作上最常見的任務就是：給你一台設備和一本說明書，讓 LabVIEW 讀得到它。這件事有固定的做法。'],['接著','I2 起每一課接一台真的儀器，都照這六步走。']],
check:'隨便給你一台設備的背板照片和說明書目錄，你能說出：它該用 VISA、DAQ 還是 TCP，以及接下來要翻說明書的哪一章、抄哪幾件事。',
body:[
C.h3('情境','x','主管放了一台電源供應器在你桌上'),
`<p>「下週測試站要用。讓 LabVIEW 可以設定電壓、讀回電流。」</p>
<p>你學過 While Loop、Case、Shift Register，也用過 VISA Write 和 VISA Read。可是看著這台機器，你不知道第一步要做什麼。</p>
<p>這很正常。你卡住的原因不是 LabVIEW 不熟，而是你還不知道三件事：這台機器<b>用什麼接</b>、<b>聽得懂什麼</b>、<b>會回什麼</b>。這三件事都不在 LabVIEW 裡，在背板和說明書裡。</p>`,

C.h3('懂','','新手的做法，和做過很多台的人的做法'),
C.table(['','新手','做過很多台的人'],[
 ['第一個動作','開 LabVIEW，拉 VISA Write 和 VISA Read','把機器轉過來看背板'],
 ['接著','猜一個命令送出去','翻說明書的通訊章節，抄下五件事'],
 ['沒有回應時','不知道錯在哪：線？參數？命令？程式？','還沒寫程式，所以一定不是程式錯'],
 ['什麼時候寫程式','一開始','最後。先用現成工具確認「講得到話」']
]),
`<p>差別在這裡：新手一次面對四個未知數（接線、通訊參數、命令、自己的程式），它們綁在一起，錯了不知道是哪一個。有經驗的人<b>一次只解一個未知數</b>，每一步都有「過關了」的明確樣子。</p>`,

C.h3('懂','','六個步驟'),
`<ol class="sixsteps">
<li><b>看背板</b><span class="ans">回答：它用什麼跟外面接？</span><span class="pass">過關：說得出接頭的名字（RS-232、RS-485、USB、GPIB、網路，或只是兩條訊號線）。</span></li>
<li><b>翻說明書的通訊章節</b><span class="ans">回答：它聽得懂什麼、會回什麼？</span><span class="pass">過關：抄下通訊參數、命令格式、結尾字元、回覆格式、誰先開口。章名通常是 Remote Control、Communication、Interface、Programming，或「通訊」「資料輸出」。</span></li>
<li><b>不寫程式，先講到話</b><span class="ans">回答：線和參數對了嗎？</span><span class="pass">過關：用現成的工具送一條最不會出事的命令，看到它回話。這時候還沒有你的程式，出錯一定是線或參數。</span></li>
<li><b>看原始回覆</b><span class="ans">回答：它實際送回來的每一個字元是什麼？</span><span class="pass">過關：把回覆原封不動顯示出來，連看不見的換行、空白都看到。先不要急著轉成數字。</span></li>
<li><b>在紙上把回覆變成數字</b><span class="ans">回答：要切哪裡、轉成什麼型別、要不要乘除？</span><span class="pass">過關：拿三筆真的回覆，手算得出正確的數值和單位。</span></li>
<li><b>最後才規劃程式</b><span class="ans">回答：要重複做嗎？要記住什麼？有幾種情況？會失敗嗎？</span><span class="pass">過關：說得出為什麼這裡要迴圈、為什麼那條線要進 Shift Register、Case 分的是哪幾種情況。</span></li>
</ol>`,
ask('為什麼程式排在最後？',
 `<p>因為前五步的答案會決定程式長什麼樣。</p>
<p>舉例：第 2 步發現這台天平「不用問、自己一直送」，那你的程式就不需要 VISA Write，而且要處理「積了一堆舊資料」的問題。第 4 步發現回覆後面帶著單位字元，那第 5 步就要先把單位切掉。這些都還沒確定以前，畫出來的方塊圖只是猜的。</p>`),
tip('你其實做過一次了','第 12～14 課接 FX3S 的時候，走的就是這六步。只是當時第 1、2 步我們替你做完了：直接告訴你參數是 9600、7、偶同位，封包是 STX 開頭、ETX 結尾。這一部分要練的，就是自己做那兩步。'),

C.h3('懂','','第 1 步的判斷：VISA、DAQ，還是 TCP'),
`<p>LabVIEW 裡跟外面設備打交道的函式主要有三組：<b>VISA</b>、<b>DAQmx</b>、<b>TCP</b>。選哪一組，不是看設備貴不貴、新不新，而是照順序問三個問題。</p>
<p>先不看答案。下面有八台設備，每一台都給你「背板上看到的」和「說明書寫的」。照三個問題自己判斷，選錯了會告訴你該回頭看哪裡。</p>`,
NAMES,
{fn:dtree},
C.h3('整理','','把剛才的判斷寫成一張表'),
C.table(['問題','怎麼判斷','答案帶你去哪'],[
 ['① 它自己會說話嗎？','說明書有沒有命令表或通訊協定','不會 → <b>DAQ</b>。會 → 問第 ② 題'],
 ['② 它用什麼接？','看背板接頭','序列埠、USB、GPIB → <b>VISA</b>。網路線 → 問第 ③ 題'],
 ['③ 它在網路上講什麼？','說明書寫 SCPI，還是 Modbus/TCP、自訂封包','SCPI → <b>VISA</b>。Modbus/TCP、自訂封包 → <b>TCP</b>']
]),
ask('為什麼第一題是「會不會說話」，而不是先看接頭？',
 `<p>因為這一題把設備分成完全不同的兩種。</p>
<p>會說話的設備裡面有一顆處理器。你送文字或位元組給它，它照說明書的規則回答。你跟它之間是<b>對話</b>。</p>
<p>不會說話的設備（感測器、傳送器、開關）只是把溫度、壓力、位置變成電壓或電流。你沒有東西可以「送」給它。你需要一張資料擷取卡，把那個電壓量成數字。你跟它之間是<b>量測</b>。</p>
<p>對話用 VISA 或 TCP，量測用 DAQ。這一題答錯，後面全錯。</p>`),
ask('序列埠、USB、GPIB 明明是不同的線，為什麼都用 VISA？',
 `<p>因為 VISA 就是為了這件事做的。它把這些介面包成同一組動作：打開、寫、讀、關閉。差別只在<b>資源名稱</b>：<code>COM3</code>、<code>USB0::…::INSTR</code>、<code>GPIB0::5::INSTR</code>。</p>
<p>好處你在第 12 課看過：在家用 TCP 連軟 PLC，到工廠改成 COM 埠，方塊圖不用重畫。</p>`),
ask('同樣是網路線，為什麼有的用 VISA，有的用 TCP？',
 `<p>量測儀器（電表、示波器、電源）在網路上講的還是 SCPI，VISA 認得它，資源名稱寫成 <code>TCPIP0::192.168.1.20::INSTR</code> 就能用。同一台儀器之後改接 USB，程式也不用改。</p>
<p>工業設備（遠端 I/O 模組、PLC、控制器）在網路上講的是 Modbus/TCP 或廠商自己定的封包。這種封包沒有固定的結尾字元，一筆資料有多長要從封包開頭的長度欄位算出來。這時候用 TCP 函式自己管連線、自己決定讀幾個位元組，比較清楚。如果裝了現成的 Modbus 函式庫，就讓函式庫處理封包。</p>`),
warn('先找有沒有現成的驅動，但不要只會用驅動','很多儀器廠商或 NI 有提供 LabVIEW 的儀器驅動（Instrument Driver），裝上去就有一組現成的 VI。能用就用。可是驅動裡面做的事，就是這一部分教的事。驅動沒有支援你要的功能、版本不合、或根本沒有驅動的時候，你要能自己來。'),

C.h3('做','b','填一張「儀器接入單」'),
`<p>第 2 步翻說明書時，不要整本看，只找下面這十件事。右邊用你已經接過的 FX3S 當例子。</p>`,
C.table(['要知道的事','去哪裡找','例：FX3S 編程口'],SHEET),
ask('這十件事裡，哪一件最容易漏掉？',
 `<p>「一筆資料到哪裡結束」。</p>
<p>VISA Read 要嘛讀到指定的位元組數，要嘛讀到結尾字元，要嘛等到逾時。你不告訴它一筆到哪裡結束，它只能一直等。新手最常見的「程式卡住十秒才出錯」，就是這一格沒填。</p>`),
{todo:[
 '找一台你手邊或公司有的設備，什麼都可以：電表、溫控器、條碼機、磅秤。把它轉過來，寫下背板上每一個接頭的名字。',
 '上網找它的說明書（搜尋「型號 + manual」或「型號 + 通訊」）。找到通訊那一章，記下頁碼。',
 '照三個問題判斷：它該用 VISA、DAQ 還是 TCP？寫下你的理由。',
 '照上面的表填一張接入單。填不出來的格子先打問號，那就是你下一步要查的事。'
]},

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'你接上一台新儀器，送了命令沒有回應。你用的是自己剛寫的 LabVIEW 程式。這時候最大的問題是？',o:['不知道錯在線、參數、命令還是程式，四個綁在一起','VISA 壞了','儀器壞了','LabVIEW 版本太舊'],a:0,ex:'所以第 3 步要先用現成工具講到話。那時候還沒有你的程式，可以先排除一個未知數。'},
 {q:'一顆壓力傳送器，規格表只寫「輸出 1–5 V 對應 0–10 bar」。要用哪一組函式？',o:['DAQ：它不會說話，要把電壓量成數字','VISA：它有輸出','TCP：比較快','VISA 或 TCP 都可以'],a:0,ex:'沒有命令表，就沒有東西可以送給它。這是量測，不是對話。'},
 {q:'一台電表可以接 USB，也可以接網路，兩邊都講 SCPI。你選 VISA 的最大好處是？',o:['之後換一種接法，只要改資源名稱','VISA 比較快','不用看說明書','不用設逾時'],a:0,ex:'VISA 把不同介面包成同一組函式。'},
 {q:'一個遠端 I/O 模組走網路，說明書附 Modbus/TCP 位址表。為什麼不直接當成 SCPI 儀器處理？',o:['它的封包沒有結尾字元，長度要從封包開頭算，要自己決定讀幾個位元組','因為它比較便宜','因為網路線不能用 VISA','因為 Modbus 不能用在 LabVIEW'],a:0,ex:'說的語言不同，處理的方法就不同。'},
 {q:'說明書寫：「天平每 0.1 秒自動送出一筆重量」。這句話會改變程式的哪一點？',o:['不需要先送命令；而且要小心讀到積在緩衝區的舊資料','要用 DAQ','要用 TCP','沒有影響'],a:0,ex:'「誰先開口」是接入單上的一格。答案不同，程式的骨架就不同。'},
 {q:'接入單上哪一格沒填，最容易造成「VISA Read 卡住到逾時」？',o:['一筆資料到哪裡結束','設備的價格','設備的重量','LabVIEW 的版本'],a:0,ex:'Read 不知道一筆到哪裡結束，只能等到逾時。'}
]}
]});
})();
