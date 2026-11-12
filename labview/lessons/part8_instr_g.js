/* 第八部分：接入新儀器（I11）綜合演練：一台沒教過的設備，自己走完六步
   設備：研華 ADAM-4017 類比輸入模組（RS-485，ADAM ASCII 命令）。
   事實出自 ADAM-4000 Series User Manual：出廠鮑率 9600、位址 01（p.9）；#AA(cr) 的語法、回覆 >(data)(cr)、
   語法錯誤或位址不存在時沒有回應、#AAN 讀單一通道、範例回覆每通道 7 個字元（p.99–100）。
   資料位元與同位那一頁沒有寫，模擬用 8、None、1。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='接入新儀器';
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const hint=(q,a)=>`<details class="think"><summary><span class="q">${q}</span><span class="hint">自己先做，卡住了再點開</span></summary>${a}</details>`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const vis=s=>esc(s).replace(/ /g,'<i class="cc sp">␣</i>').replace(/\r/g,'<i class="cc">\\r</i>').replace(/\n/g,'<i class="cc">\\n</i>');
const raw=s=>`<span class="rawstr">${vis(s)}</span>`;
function term(opts){return d=>{
  if(window.InstSim&&InstSim.terminal){InstSim.terminal(d,opts);}
  else d.innerHTML='<div class="fig"><p>模擬儀器終端機沒有載入。</p></div>';
};}

/* ======================================================================
   LabVIEW 參考答案：I11_ADAM4017.vi（讀一次，For Loop 照位置切成 8 個數值）
   回覆是網頁模擬的；8 個數值用說明書的範例回覆。
   ====================================================================== */
const ctl=C.ctl,qd=C.qd,wt=C.wt,PR=['Functions','Programming'];
const addF=o=>{for(const k in o)if(!LV.F[k])LV.F[k]=o[k];};
addF({'Fract/Exp String To Number':{g:'1.2E→#',ins:['string','offset','default'],outs:['offset past number','number'],w:46,pal:[...PR,'String','Number/String Conversion','Fract/Exp String To Number']}});
const NOERR={status:false,code:0,source:''};
const AI8=[7.2111,7.2567,7.3125,7.1000,7.4712,7.2555,7.1234,7.5678];
const A4017='>'+AI8.map(v=>(v<0?'-':'+')+Math.abs(v).toFixed(4)).join('')+'\r';
const adamVI={name:'I11_ADAM4017.vi',view:'bd',
 fp:{w:420,h:240,items:[
  {id:'res',k:'visa',label:'Resource',x:16,y:16,w:150,v:'COM8',options:['COM8','COM3']},
  {id:'sim',k:'ring',label:'（模擬）命令裡的位址',x:190,y:16,w:150,options:['01（線上有這一台）','02（線上沒有）'],v:0},
  {id:'ai',k:'arr',label:'AI (V)：通道 0～7',x:16,y:76,n:8},
  {id:'eo',k:'err',label:'error out',x:16,y:130}]},
 bd:{w:640,h:300,structs:[{id:'fl',k:'for',x:290,y:120,w:300,h:170}],
  nodes:[
  {id:'res',k:'ctl',t:'visa',label:'Resource',x:16,y:29},
  {id:'k1000',k:'const',t:'u32',v:1000,x:60,y:49},
  {id:'k13',k:'const',t:'u8',v:13,x:74,y:69},
  {id:'cfg',k:'fn',fn:'VISA Configure Serial Port',x:106,y:20,h:96,ins:['VISA resource name','timeout','termination char','error in']},
  {id:'kcmd',k:'const',t:'str',v:'#01\\r',x:160,y:54},
  {id:'wr',k:'fn',fn:'VISA Write',x:210,y:41},
  {id:'k100',k:'const',t:'i32',v:100,x:256,y:54},
  {id:'rd',k:'fn',fn:'VISA Read',x:290,y:41},
  {id:'cl',k:'fn',fn:'VISA Close',x:520,y:41},
  {id:'seh',k:'fn',fn:'Simple Error Handler',x:580,y:47,showName:false},
  {id:'k8',k:'const',t:'i32',v:8,x:262,y:128},
  {id:'N',k:'N',s:'fl'},
  {id:'tdata',k:'tunnel',t:'str',s:'fl',side:'l',y:180},
  {id:'iter',k:'iter',s:'fl'},
  {id:'k7a',k:'const',t:'i32',v:7,x:332,y:246},
  {id:'mul',k:'fn',fn:'Multiply',x:360,y:248},
  {id:'inc',k:'fn',fn:'Increment',x:396,y:248},
  {id:'k7b',k:'const',t:'i32',v:7,x:444,y:207},
  {id:'ss',k:'fn',fn:'String Subset',x:470,y:162,h:72},
  {id:'fx',k:'fn',fn:'Fract/Exp String To Number',x:518,y:186,showName:false},
  {id:'tout',k:'tunnel',t:'dbl[]',s:'fl',side:'r',y:217,idx:true},
  {id:'ai',k:'ind',t:'dbl[]',label:'AI (V)',x:600,y:207}],
 wires:[
  {id:'w1',from:'res',to:'cfg.VISA resource name',t:'visa'},
  {id:'w2',from:'k1000',to:'cfg.timeout',t:'u32'},
  {id:'w3',from:'k13',to:'cfg.termination char',t:'u8'},
  {id:'w4',from:'cfg.VISA resource name out',to:'wr.VISA resource name',t:'visa'},
  {id:'w5',from:'cfg.error out',to:'wr.error in',t:'err',mx:205},
  {id:'w6',from:'kcmd',to:'wr.write buffer',t:'str'},
  {id:'w7',from:'wr.VISA resource name out',to:'rd.VISA resource name',t:'visa'},
  {id:'w8',from:'wr.error out',to:'rd.error in',t:'err'},
  {id:'w9',from:'k100',to:'rd.byte count',t:'i32'},
  {id:'w10',from:'rd.VISA resource name out',to:'cl.VISA resource name',t:'visa',mx:510},
  {id:'w11',from:'rd.error out',to:'cl.error in',t:'err',mx:515},
  {id:'w12',from:'cl.error out',to:'seh.error in',t:'err'},
  {id:'w13',from:'rd.read buffer',to:'tdata.o',t:'str',pts:[[340,63],[340,100],[250,100],[250,180]]},
  {id:'w14',from:'k8',to:'N',t:'i32'},
  {id:'w15',from:'k7a',to:'mul.x',t:'i32'},
  {id:'w16',from:'iter',to:'mul.y',t:'i32'},
  {id:'w17',from:'mul.out',to:'inc',t:'i32'},
  {id:'w18',from:'inc.out',to:'ss.offset',t:'i32',pts:[[430,262],[430,198]]},
  {id:'w19',from:'k7b',to:'ss.length',t:'i32'},
  {id:'w20',from:'tdata.i',to:'ss.string',t:'str'},
  {id:'w21',from:'ss.substring',to:'fx.string',t:'str'},
  {id:'w22',from:'fx.number',to:'tout.i',t:'dbl'},
  {id:'w23',from:'tout.o',to:'ai',t:'dbl[]'}]},
 sim:{live:true,step(i){
  if(+i.sim===1){const E={status:true,code:-1073807339,source:'VISA Read in I11_ADAM4017.vi（逾時：線上沒有 02 號，沒有回應）'};
   return {out:{ai:[0,0,0,0,0,0,0,0],eo:E},msg:'02 號不存在：模組不回，Read 等滿 1000 ms 逾時，read buffer 是空字串。For Loop 還是跑 8 次，每次都切到空字串，Fract/Exp 給 0：AI 會是 8 個 0，看起來像量到 0 V。所以要先看 error、再檢查長度。',vals:{'rd.error out':E,'cl.error out':E}};}
  return {out:{ai:AI8.slice(),eo:NOERR},msg:'讀到 '+A4017.length+' 個字元。For Loop 第 i 圈從 1＋7×i 切 7 個字元：第 0 圈「'+A4017.substr(1,7)+'」、第 1 圈「'+A4017.substr(8,7)+'」…，自動索引收成 8 個 DBL。',
   vals:{res:i.res,k1000:1000,k13:13,kcmd:'#01\r',k100:100,k8:8,k7a:7,k7b:7,'rd.read buffer':A4017,'tdata.i':A4017,iter:0,'mul.out':0,'inc.out':1,'ss.substring':A4017.substr(1,7),'fx.number':AI8[0],'tout.o':AI8,'rd.error out':NOERR,'cl.error out':NOERR}};
 }}
};
const I11_LV=[
C.h3('LabVIEW','b','對答案：I11_ADAM4017.vi（讀一次、照位置切成 8 個數值）'),
`<p><b>先自己畫完再往下看。</b>下面是第 5 步那幾個提示畫成的方塊圖，只做「讀一次、切好」。While Loop、Case、Clear Errors、連續失敗計數是第 6 步的規劃，等這一支確定切對了再照 I4 加上去。</p>`,
C.plan({
 start:'File ▸ New VI，存成 <code>練習\\儀器\\I11_ADAM4017.vi</code>。',
 in:'送 <code>#01\\r</code>，VISA Read 讀回 58 個字元的字串：<code>&gt;</code>＋8 個「正負號＋6 個數字和小數點」＋<code>\\r</code>。單位 V。',
 calc:'For Loop，N 接 8。第 i 圈的起點 ＝ 1 ＋ 7 × i（Multiply、Increment），String Subset 取 7 個字元，Fract/Exp String To Number 轉成 DBL。右邊的 Tunnel 是<b>自動索引</b>，8 圈的結果收成一個 8 個元素的陣列。',
 out:'DBL 陣列指示器 <code>AI (V)</code>，拉成 8 格。之後要畫趨勢圖，就把這個陣列接 Waveform Chart（一圈 8 條線）。',
 loop:'這一支只讀一次。規劃裡是 While Loop＋Wait 1000 ms：任務是每秒讀一次。',
 end:'逾時 1000 ms。這台出錯時不回應，所以逾時就是它的錯誤回報。注意：逾時以後 For Loop 照樣跑，切空字串得到 8 個 0；所以加迴圈以前，先在 Read 後面檢查 error 和長度（String Length ＝ 58），不對就不要切。'}),
note('下面的 VI 視窗是網頁模擬的','8 個數值用說明書的範例回覆；9600、8、None、1 是這一課的假設。'),
{steps:{title:'I11_ADAM4017.vi：Read 之後用 For Loop 切 8 次',lv:adamVI,steps:[
 {t:'前面板',view:'fp',add:['res','ai','eo','sim'],h:`<p>Resource（USB 轉 RS-485 的 COM 埠）。${ctl('Modern','Array, Matrix & Cluster','Array')} 裡放 Numeric Indicator，標籤 <code>AI (V)</code>，拉成 8 格。</p>`},
 {t:'設定序列埠：termination char 改成 13',view:'bd',add:['res','k1000','k13','cfg','w1','w2','w3'],h:`<p>VISA Configure Serial Port 的 baud、data bits、parity、stop bits 不接：預設就是 9600、8、None、1.0。要接的是 <b>termination char <code>13</code></b>（\\r，這台用 CR 結尾，不是預設的 10）和 timeout <code>1000</code>。</p>`},
 {t:'送 #01\\r，讀 100',view:'bd',add:['kcmd','wr','k100','rd','cl','seh','w4','w5','w6','w7','w8','w9','w10','w11','w12'],h:`<p>Write 的常數（'\\' Codes Display）<code>#01\\r</code>。Read 的 byte count 100（比 58 大就好，讀到 \\r 就回來）。Close、Simple Error Handler 照舊。</p>`},
 {t:'For Loop，N ＝ 8',view:'bd',add:['fl','N','k8','tdata','w13','w14'],h:`<p>${fn('Programming','Structures','For Loop')} ${qd('For Loop')}。左上角的 <b>N</b> 上 Create ▸ Constant，輸入 <code>8</code>。</p><p>read buffer 拉進 For Loop：穿過邊框的地方是一般 Tunnel（每一圈拿到的都是同一個完整字串）。</p>`},
 {t:'第 i 圈從哪裡切：1 ＋ 7 × i',view:'bd',add:['iter','k7a','mul','inc','w15','w16','w17'],h:`${wt([
 ['常數 7','Multiply 的 x','每個數值 7 個字元'],
 ['i（左下角）','Multiply 的 y','第 0、1、2…圈'],
 ['Multiply 的 x*y','Increment','跳過開頭的 &gt;']])}<p>i ＝ 0 時是 1，i ＝ 1 時是 8，i ＝ 7 時是 50。</p>`},
 {t:'String Subset 取 7 個，Fract/Exp 轉數字',view:'bd',add:['k7b','ss','fx','w18','w19','w20','w21'],h:`${wt([
 ['迴圈裡的字串 Tunnel','String Subset 的 string'],
 ['Increment 的 x+1','String Subset 的 offset'],
 ['常數 7','String Subset 的 length'],
 ['String Subset 的 substring','Fract/Exp String To Number 的 string','「+7.2111」→ 7.2111']])}`},
 {t:'自動索引：8 個數值變成陣列；Run',view:'split',add:['tout','ai','w22','w23'],h:`<p>Fract/Exp 的 number 拉到迴圈右邊框。For Loop 的輸出 Tunnel <b>預設就是自動索引</b>（框裡有 [ ]），出來是 DBL 陣列，接 <code>AI (V)</code>。</p><p>Run：8 格是 7.2111、7.2567…。把模擬換成「02」：AI 變成 8 個 0，error out 有逾時錯誤。這就是 end 那一格說的「先看 error 再切」。</p>`}
]}},
hint('改一個數字，先預測結果：N 的 8 不小心打成 9。AI 會有幾格？最後一格是多少？會不會出錯？',
 `<p>9 格，<b>不會出錯</b>。第 8 圈的起點是 1 ＋ 7 × 8 ＝ 57，從第 57 個字元（最後的 \\r）切 7 個，String Subset 只給得出「\\r」一個字元；Fract/Exp 開頭不是數字，給預設值 0。所以第 9 格是 0。</p>
<p>多一格 0 V，很容易被當成「第 9 個通道接地」。陣列的長度也是要檢查的東西：迴圈次數最好不要寫死，或在切之前先確認 String Length ＝ 58。</p>`)
];

L.push({id:'I11',order:29.97,no:'I11',part:PART,title:'綜合演練：一台沒教過的設備，自己走完六步',mins:60,
goals:[['這一課不教新東西','給你一台前面沒出現過的設備和幾行說明書摘錄。六個步驟自己走，每一步的提示都收起來，卡住了才打開。'],['做出','一張接入單、三筆手算的結果、一張程式規劃圖。'],['過關的標準','不看提示，說得出每一個決定的理由。'],['先備','I1～I10。']],
check:'你能在不看提示的情況下完成六個步驟，並且說出：它用 VISA 還是別的、結尾字元是什麼、回覆怎麼切、哪裡用了迴圈、為什麼。',
body:[
C.h3('情境','x','箱子裡有一個沒見過的模組'),
`<p>機台的電控箱裡有一個藍色的模組，面板印著 <b>ADAM-4017</b>。它接了 8 個感測器的電壓訊號。主管要你讓 LabVIEW 每秒讀一次這 8 個通道，畫成趨勢圖。</p>
<p>你沒用過它。手邊有的東西只有：模組本身，和下面這幾行從說明書抄出來的內容。</p>`,
C.table(['說明書裡找到的','原文的意思'],[
 ['接線','端子上有 DATA+、DATA−（RS-485），另外有 8 組類比輸入端子'],
 ['出廠設定','鮑率 9600；位址 01（十六進位）'],
 ['讀全部通道','命令 <code>#AA(cr)</code>。AA 是兩位十六進位的位址，(cr) 是歸位字元 0DH'],
 ['讀單一通道','命令 <code>#AAN(cr)</code>。N 是通道編號 0～7'],
 ['回覆','<code>&gt;(data)(cr)</code>。&gt; 是開頭的分隔字元'],
 ['回覆的範例','<code>&gt;+7.2111+7.2567+7.3125+7.1000+7.4712+7.2555+7.1234+7.5678(cr)</code>'],
 ['出錯時','語法錯誤、通訊錯誤、或位址不存在：沒有回應']
]),
note('這是網頁模擬的模組','命令和回覆格式照說明書。資料位元和同位，說明書這一頁沒有寫，模擬用的是 8、None、1；各通道的電壓是這一課設定的情境。'),

C.h3('第 1 步','','它該用什麼？'),
`<p>照 I1 的三個問題判斷。寫下你的答案和理由，再往下。</p>`,
hint('提示：三個問題的答案',
 `<p>它會說話嗎？會，說明書有命令。用什麼接？RS-485，經轉接器在電腦上是 COM 埠。所以是 <b>VISA</b>。</p>
<p>注意它同時有兩種身分：對它的 8 個感測器來說，它是在做「量測」；對你的電腦來說，它是一台「會說話的設備」。你要處理的是後面這一段。</p>`),

C.h3('第 2 步','','填接入單'),
`<p>拿 I1 的接入單，用上面的摘錄填。填不出來的格子打問號。</p>`,
hint('提示：哪幾格會打問號，怎麼辦',
 `<ul><li><b>資料位元、同位、停止位元</b>：摘錄裡沒有。先試最常見的 8、None、1；不通再查完整的說明書，或用廠商的設定工具讀出來。</li>
<li><b>結尾字元</b>：命令用 (cr) 結尾，回覆也用 (cr) 結尾。這台是 <code>\\r</code>，不是前面幾台常見的 <code>\\n</code>。</li>
<li><b>誰先開口</b>：電腦問才回。</li>
<li><b>在叫誰</b>：RS-485 可以並聯很多台，所以命令裡有位址 AA。這台是 01。</li>
<li><b>出錯的樣子</b>：不回應。所以逾時就是它唯一的錯誤回報。</li>
<li><b>回一次要多久</b>：摘錄沒寫。等一下實際量。</li></ul>`),

C.h3('第 3 步','','不寫程式，先講到話'),
`<p>用下面的終端機。通訊設定和結尾字元都要自己設，命令自己打。目標：讓它回 8 個通道的數值。</p>`,
{fn:term({inst:'adam4017',cfg:{baud:9600,bits:8,parity:'N',stop:1,term:'\n'},presets:[],showHex:true})},
hint('提示：送了沒有回應',
 `<p>照 I2 的檢查順序。參數沒問題的話，看結尾字元：終端機一開始選的是 <code>\\n</code>，這台要的是 <code>\\r</code>。</p>
<p>命令是 <code>#01</code>：井字號、位址 01。它沒有 <code>*IDN?</code> 可以用，所以第一條命令就是讀取。讀取不會改變模組的狀態，一樣符合「第一條命令」的條件。</p>`),
hint('提示：想確認「不回應」是什麼樣子',
 `<p>送 <code>#02</code>（線上沒有 02 號）。它不會回錯誤訊息，只會逾時。記住這個樣子：之後程式裡看到逾時，可能的原因就是位址錯、命令錯、線斷了。</p>`),

C.h3('第 4 步','','看原始回覆'),
`<p>把回覆的三種顯示都看一遍。回答下面四個問題，寫下來：</p>
<ol><li>一共幾個字元？</li><li>最前面和最後面各是什麼？</li><li>8 個數值之間用什麼隔開？</li><li>每個數值占幾個字元？</li></ol>`,
hint('提示：四個問題的答案',
 `<p>以範例來說：${raw('>+7.2111+7.2567+7.3125+7.1000+7.4712+7.2555+7.1234+7.5678\r')}</p>
<ol><li>58 個：開頭 1 個、8 × 7 ＝ 56 個、結尾 1 個。</li>
<li>最前面是 <code>&gt;</code>，最後面是 <code>\\r</code>。</li>
<li><b>沒有分隔符號。</b>數值是黏在一起的。</li>
<li>每個 7 個字元：正負號 1 個、數字和小數點 6 個。</li></ol>
<p>沒有逗號，所以不能用「找逗號」的方法切。能依靠的是<b>每個數值的寬度固定</b>，這跟天平那一課「用位置切」是同一招。</p>`),

C.h3('第 5 步','','手算：變成 8 個數值'),
`<p>用你剛才實際收到的那一筆，手動切出 8 個數值。然後寫下：在 LabVIEW 裡，你要的資料型別是什麼？打算用哪些函式？</p>`,
hint('提示：怎麼切',
 `<p>要的型別是「8 個 DBL」，也就是一個一維陣列。</p>
<p>第 0 個數值從第 1 個字元開始（第 0 個是 <code>&gt;</code>），長度 7；第 1 個從第 8 個字元開始；第 i 個從 1 ＋ 7 × i 開始。</p>
<p>每一個都做同樣的事：${fn('String','String Subset')} 取出 7 個字元，再用 Fract/Exp String To Number 轉成數字。</p>`),
hint('提示：同樣的事做 8 次，用什麼？',
 `<p>次數是固定的、事先知道的：8 次。這是 <b>For Loop</b>，N 接 8。</p>
<p>迴圈裡用 i 算出起點（1 ＋ 7 × i），取字串、轉數字；轉出來的數字從迴圈右邊的通道出去，開著自動索引，出來就是一個 8 個元素的陣列。</p>
<p>到這裡你用了兩種迴圈，理由不同：While Loop 是「一直讀，不知道幾次」；For Loop 是「這件事做 8 次」。</p>`),
hint('提示：這一筆能不能用，怎麼檢查？',
 `<p>說明書沒有給檢查碼，所以能做的檢查是格式：第一個字元是不是 <code>&gt;</code>；長度是不是 58。兩個都對才切，不對就丟掉、計一次錯。</p>
<p>另外想一下：通道沒有接線，或訊號超出範圍時，數值那 7 個字元會變成什麼？摘錄裡沒有寫。這種事要記在接入單上當成「待確認」，拿到實機時拔掉一個通道的線，看它實際回什麼。</p>`),

C.h3('第 6 步','','規劃程式'),
`<p>畫出規劃圖。至少要回答：</p>
<ul><li>什麼在迴圈外，什麼在迴圈裡？</li><li>哪些線進 Shift Register？</li><li>哪裡有 Case？分哪幾種情況？</li><li>逾時設多少？一秒讀幾次？</li><li>程式結束時要對模組做什麼？</li></ul>`,
hint('提示：一種合理的規劃',
 `<p>迴圈外：VISA Configure Serial Port（9600、8、None、1；termination char 接 13，也就是 <code>\\r</code>；逾時 1000）。</p>
<p>While Loop 裡：送 <code>#01\\r</code> → 讀 → 檢查開頭和長度 → Case：格式對，用 For Loop 切成 8 個數值、畫圖；格式不對，計一次錯 → 等 1 秒。</p>
<p>Shift Register：error、連續失敗的次數。</p>
<p>先停一下，想一個問題：模組沒回應時，VISA Read 逾時，error 變成有錯，放進 Shift Register。下一圈的 VISA Write 收到這個 error in，會怎樣？下一個提示有答案。</p>
<p>迴圈外：VISA Close。這個模組只是被讀，沒有輸出要關，所以結束時不用另外送命令。這一點跟電源供應器不同：要不要「收尾」，看設備會不會因為你離開而留在危險的狀態。</p>`),
hint('提示：逾時之後，下一圈為什麼什麼都不做？',
 `<p>大部分 LabVIEW 函式看到 error in 有錯，就<b>不執行</b>，直接把錯誤往下傳。所以 error 放進 Shift Register 之後，下一圈的 VISA Write 不送、VISA Read 不讀，一圈一圈空轉，畫面停在最後一筆。這跟 I9 重連之前要先清 error 是同一件事。</p>
<p>兩種失敗不一樣，要分開看：</p>
<ul><li><b>逾時</b>：VISA Read 給的是一個 LabVIEW 錯誤（-1073807339）。這一台不回應就是它報錯的方式，算預期中的事：記下來、計一次失敗，然後用 Clear Errors 清掉，下一圈才會真的再送一次。</li>
<li><b>格式不對</b>：VISA Read 沒有錯，是你自己的檢查不通過。error 本來就是乾淨的，只要計一次失敗。</li></ul>
<p>所以 Case 至少有三種情況：讀到而且格式對、讀到但格式不對、逾時。其他錯誤碼（例如 COM 埠被拔掉）不要清，讓它停下來、顯示出來。</p>`),
hint('提示：連續失敗的次數是做什麼的？',
 `<p>RS-485 的線很長，偶爾一筆被雜訊打壞是正常的。壞一筆就停掉整支程式，太敏感；永遠不停，線真的斷了又沒人知道。</p>
<p>常見的做法：失敗一次就加 1，成功一次就歸零；連續失敗超過例如 5 次，才當成通訊中斷，顯示警告。「一個數字每一圈被改掉、下一圈要用」，所以它在 Shift Register 裡。</p>`),

...I11_LV,
C.h3('回頭看','','你剛才做的事'),
C.table(['步驟','你做的判斷','用到哪一課'],[
 ['1','會說話、序列埠 → VISA','I1'],
 ['2','從幾行摘錄填出接入單；沒寫的打問號','I1、I2'],
 ['3','結尾字元是 \\r；不回應就是它的錯誤','I2、I7'],
 ['4','沒有分隔符號，寬度固定','I3、I6'],
 ['5','照位置切，For Loop 做 8 次，先檢查格式','I3、I6、I7'],
 ['6','迴圈外開關、error 進 Shift Register、Case 分三種、逾時記下來再清掉、連續失敗才警告','I4、I9']
]),
`<p>這台設備前面沒有教過，可是你沒有用到任何新東西。六個步驟、同一組問自己的話，換一台設備再走一次而已。</p>
<p>下一次主管放一台沒看過的機器在你桌上，你知道第一個動作是什麼：把它轉過來，看背板。</p>`,
tip('繼續練','到 <a href="instlab.html">儀器接入練習台</a> 還有其他幾台可以用同樣的方式自己走。想用真的 LabVIEW 做，下載 I4 的軟儀器。下一課 I12 換一台一次回兩千個數字的設備：示波器。'),

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'這台模組送 #01 加 \\n 沒有回應，改成加 \\r 就回了。這說明什麼？',o:['結尾字元每一台不一樣，要照說明書，不能沿用上一台的','模組壞了又好了','\\n 比較慢','VISA 不支援 \\n'],a:0,ex:'說明書寫的是 (cr)，就是 \\r。'},
 {q:'回覆「>+7.2111+7.2567…」裡 8 個數值沒有用逗號隔開。該怎麼切？',o:['每個數值寬度固定 7 個字元，照位置切','找加號當分隔','用 Spreadsheet String To Array 接逗號','沒辦法切'],a:0,ex:'負的數值是減號，所以不能找加號。寬度固定才是可靠的依據。'},
 {q:'「把同樣的轉換做 8 次」用 For Loop 而不是 While Loop，因為？',o:['次數固定而且事先知道','For Loop 比較快','While Loop 不能處理字串','沒有差別'],a:0,ex:'不知道幾次用 While，知道幾次用 For。'},
 {q:'說明書說這台出錯時「沒有回應」。你的程式會看到什麼？',o:['VISA Read 逾時','錯誤訊息字串','空白的數值 0','模組重新開機'],a:0,ex:'所以逾時要設得合理，而且要處理。'},
 {q:'偶爾一筆格式不對。比較好的處理是？',o:['丟掉這一筆、計一次錯；連續太多次才當成通訊中斷','馬上停止程式','當成 0 畫到圖上','不管它'],a:0,ex:'計數放在 Shift Register，成功就歸零。'},
 {q:'error 放在 Shift Register 裡。模組逾時一次之後，畫面就再也不更新了。最可能的原因是？',o:['逾時的錯誤一直留在 error 線上，之後的 VISA Write、VISA Read 看到 error in 有錯就不執行','模組壞了','For Loop 的 N 不對','逾時設太長'],a:0,ex:'逾時是這台預期中的失敗：記下來、計數，再用 Clear Errors 清掉。其他錯誤碼不要清。'},
 {q:'程式結束時，這台模組需要像電源供應器那樣送「關閉」的命令嗎？',o:['不用。它只是被讀，不會因為你離開而留在危險的狀態','要，不然會燒掉','要，不然下次讀不到','每台設備都要'],a:0,ex:'要不要收尾，看設備離開時會停在什麼狀態。'}
]}
]});
})();
