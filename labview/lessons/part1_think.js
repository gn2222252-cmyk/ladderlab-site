/* 起步：寫 LabVIEW 之前怎麼想。一個完整的小例子：1～5 V 的壓力傳送器 → 0～10 bar。
   1～5 V（或 4～20 mA）對應量程、低於下限代表斷線，是工業傳送器的通用做法。 */
(function(){
const L=window.LESSONS,fn=C.fn,qd=C.qd,wt=C.wt;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

const pv={name:'Pressure.vi',view:'split',ratio:1.7,
 fp:{w:300,h:250,items:[
  {id:'v',k:'num',ctl:true,label:'感測器電壓 V',x:16,y:24,w:90,v:3,inc:0.5,dig:2},
  {id:'bar',k:'num',label:'壓力 bar',x:16,y:90,w:90,dig:2},
  {id:'alarm',k:'led',label:'超過 8 bar',color:'red',x:150,y:90},
  {id:'txt',k:'str',label:'顯示文字',x:16,y:150,w:140},
  {id:'broken',k:'led',label:'感測器斷線？',color:'red',x:180,y:150}]},
 bd:{w:620,h:250,
  nodes:[
  {id:'v',k:'ctl',t:'dbl',label:'感測器電壓 V',x:20,y:60},
  {id:'k1',k:'const',t:'dbl',v:1,x:70,y:92},
  {id:'sub',k:'fn',fn:'Subtract',x:100,y:63},
  {id:'k4',k:'const',t:'dbl',v:4,x:140,y:99},
  {id:'div',k:'fn',fn:'Divide',x:170,y:70},
  {id:'k10',k:'const',t:'dbl',v:10,x:205,y:106},
  {id:'mul',k:'fn',fn:'Multiply',x:240,y:77},
  {id:'kHi',k:'const',t:'dbl',v:10,x:262,y:36},
  {id:'kLo',k:'const',t:'dbl',v:0,x:266,y:115},
  {id:'co',k:'fn',fn:'In Range and Coerce',x:300,y:67},
  {id:'bar',k:'ind',t:'dbl',label:'壓力 bar',x:420,y:50},
  {id:'k8',k:'const',t:'dbl',v:8,x:372,y:130},
  {id:'gt',k:'fn',fn:'Greater?',x:410,y:105},
  {id:'alarm',k:'ind',t:'bool',label:'超過 8 bar',x:470,y:109},
  {id:'kf',k:'const',t:'str',v:'%.2f bar',x:320,y:170},
  {id:'fmt',k:'fn',fn:'Format Into String',x:420,y:162},
  {id:'txt',k:'ind',t:'str',label:'顯示文字',x:500,y:168},
  {id:'k09',k:'const',t:'dbl',v:0.9,x:52,y:205},
  {id:'lt',k:'fn',fn:'Less?',x:100,y:180},
  {id:'broken',k:'ind',t:'bool',label:'感測器斷線？',x:160,y:184}],
  wires:[
  {id:'w1',from:'v',to:'sub.x',t:'dbl'},
  {id:'w2',from:'k1',to:'sub.y',t:'dbl',mx:96},
  {id:'w3',from:'sub.out',to:'div.x',t:'dbl'},
  {id:'w4',from:'k4',to:'div.y',t:'dbl',mx:166},
  {id:'w5',from:'div.out',to:'mul.x',t:'dbl'},
  {id:'w6',from:'k10',to:'mul.y',t:'dbl',mx:234},
  {id:'w7',from:'mul.out',to:'co.x',t:'dbl',mx:285},
  {id:'w8',from:'kHi',to:'co.upper limit',t:'dbl',mx:294},
  {id:'w9',from:'kLo',to:'co.lower limit',t:'dbl',mx:295},
  {id:'w10',from:'co.coerced(x)',to:'bar',t:'dbl',mx:380},
  {id:'w11',from:'co.coerced(x)',to:'gt.x',t:'dbl',mx:380},
  {id:'w12',from:'k8',to:'gt.y',t:'dbl',mx:400},
  {id:'w13',from:'gt.out',to:'alarm',t:'bool'},
  {id:'w14',from:'kf',to:'fmt.format string',t:'str',mx:410},
  {id:'w15',from:'co.coerced(x)',to:'fmt.input 1',t:'dbl',mx:380},
  {id:'w16',from:'fmt.resulting string',to:'txt',t:'str'},
  {id:'w17',from:'v',to:'lt.x',t:'dbl',mx:64},
  {id:'w18',from:'k09',to:'lt.y',t:'dbl',mx:92},
  {id:'w19',from:'lt.out',to:'broken',t:'bool'}]},
 sim:{live:true,step(inp){const v=+inp.v||0,s=v-1,d=s/4,m=d*10,c=Math.max(0,Math.min(10,m)),a=c>8,t=c.toFixed(2)+' bar',b=v<0.9;
  return {out:{bar:c,alarm:a,txt:t,broken:b},vals:{v,k1:1,'sub.out':s,k4:4,'div.out':d,k10:10,'mul.out':m,kHi:10,kLo:0,'co.coerced(x)':c,k8:8,'gt.out':a,kf:'%.2f bar','fmt.resulting string':t,k09:0.9,'lt.out':b},
   msg:`${v} V → (${v}−1)÷4×10 ＝ ${m.toFixed(2)} → 限制後 ${c.toFixed(2)} bar${b?'；低於 0.9 V：傳送器至少會給 1 V，比這還低代表線斷了':''}`};}}
};

L.push({id:'L01T',order:1.7,no:'1++',part:'起步',title:'寫 LabVIEW 之前怎麼想：數值從哪來、怎麼算、怎麼呈現',mins:45,files:['練習\\Pressure.vi'],
goals:[['學會','動手之前先回答五個問題；數值的型別、單位、範圍怎麼決定；公式怎麼變成一排函式；結果用什麼元件呈現、顯示幾位小數；怎麼用幾個已知的點驗證。'],['做出','Pressure.vi：1～5 V 的壓力傳送器 → 0～10 bar，超過 8 bar 亮燈，低於 0.9 V 判斷斷線。'],['為什麼','後面每一課（讀 PLC、接儀器、myRIO）都是同一個流程：拿到一個數字 → 換算 → 判斷 → 給人看。先把流程想清楚，畫方塊圖只是照著放。']],
check:'不看課文，能對任何一個新的量測說出：從哪裡讀、什麼型別和單位、公式（並用兩個點驗算）、放什麼顯示元件、幾位小數、什麼情況算異常。',
body:[
C.h3('情境','x','一顆壓力傳送器'),
`<p>機台上有一顆壓力傳送器，規格寫：量程 0～10 bar，輸出 1～5 V。DAQ 或 myRIO 會讀到一個電壓。主管要你做一個畫面：顯示目前壓力，超過 8 bar 亮紅燈。</p>
<p>新手最常見的做法是馬上打開 LabVIEW、開始找函式。<b>先別碰滑鼠</b>。下面五個問題回答完，方塊圖其實已經畫好一半了。</p>`,
C.h3('第 1 步','','五個問題，先寫在紙上'),
C.plan({start:'新 VI，存成 <code>練習\\Pressure.vi</code>。這一課先不放迴圈：按一次 Run 算一次（第 4 課才學 While Loop，到時候整段放進迴圈就好）。',
 in:'電壓：<b>DBL</b>（有小數），單位 V，正常範圍 1～5。這一課先用前面板的數值控制元件代替感測器；之後換成 DAQ、myRIO 的讀取，後面的程式完全不用改。',
 calc:'壓力 ＝（電壓 − 1）÷ 4 × 10。再限制在 0～10（雜訊可能讓電壓稍微超出 1～5）。超過 8 → 警報。電壓 < 0.9 → 斷線（傳送器正常時至少給 1 V）。',
 out:'數字「壓力 bar」顯示兩位小數；紅燈「超過 8 bar」；紅燈「感測器斷線？」；另外用 Format Into String 組一段「5.00 bar」的文字（之後寫紀錄檔、顯示在狀態列會用到）。',
 loop:'這一課按一次 Run 算一次。放進迴圈後，壓力是慢慢變的，100 ms 一次就夠。',
 end:'沒有要關的東西。之後讀硬體時，error 線要一路接，出錯就停（第 11 課）。'}),
ask('這五個問題裡，哪一個最常被忘記？',
 `<p>⑤「出錯怎麼辦」，其次是 ① 的「範圍」。程式在正常的數字下都對，出事都是在不正常的時候：線斷了、感測器超出量程、儀器沒回應。<b>先想好「不正常長什麼樣子」</b>，這一課的「低於 0.9 V 算斷線」就是這樣來的。</p>`),
C.h3('第 2 步','','數值：型別、單位、範圍'),
C.table(['這個數值是什麼','用什麼型別','線的顏色','例子'],[
 ['量測值、換算結果（有小數）','DBL','橘色','電壓、壓力、溫度、角度'],
 ['計數、索引、次數','I32','藍色','第幾圈、陣列索引、計數器'],
 ['PLC 暫存器、儀器的原始碼','U16、U8','藍色','D 暫存器、位元組'],
 ['開關、狀態、判斷結果','Boolean','綠色','按鈕、警報、到位了沒'],
 ['文字、命令、回覆','String','粉紅色','*IDN?、「5.00 bar」'],
 ['好幾個同種的值','陣列','粗線','一次讀回的 8 個通道']
]),
`<p>單位寫在<b>標籤</b>上（「壓力 bar」「電壓 V」），不要只寫「Value」。三個月後的你、接手的同事，看標籤就知道這是什麼。</p>`,
C.h3('第 3 步','','運算：公式先用數字驗算'),
`<p>把公式寫出來之後，先拿兩三個<b>已知答案</b>的點算一遍：</p>`,
C.table(['電壓','代進公式','應該是'],[['1 V','(1−1)÷4×10','0 bar（量程下限）'],['5 V','(5−1)÷4×10','10 bar（量程上限）'],['3 V','(3−1)÷4×10','5 bar（正中間）']]),
`<p>三個都對，公式才算數。接著<b>照公式的順序</b>放函式：先減、再除、再乘，每一個常數都是公式裡的一個數字。`+'不要先在心裡化簡成「× 2.5 − 2.5」：結果一樣，可是以後量程改成 0～16 bar，你得重新推一次；照原樣寫，只要把 10 改成 16。</p>',
C.h3('第 4 步','','照著五個問題放方塊圖'),
{steps:{title:'Pressure.vi：電壓 → 壓力 → 判斷 → 呈現',lv:pv,steps:[
 {t:'放輸入：一個數值控制元件',view:'split',add:['v'],h:`<p>前面板右鍵 ▸ ${C.ctl('Modern','Numeric','Numeric Control')}，標籤改「感測器電壓 V」。預設就是 DBL（橘色），不用改。</p><p>按 <kbd>Ctrl</kbd>+<kbd>E</kbd> 切到方塊圖，看到它的端子（橘色、箭頭朝右：資料從這裡流出去）。</p>`},
 {t:'照公式放三個函式',view:'bd',add:['k1','sub','w1','w2','k4','div','w3','w4','k10','mul','w5','w6'],h:`<p>${fn('Programming','Numeric','Subtract')} ${qd('Subtract')}、Divide、Multiply，由左到右照公式排。</p>${wt([['感測器電壓 V','Subtract 的 x（上）'],['常數 1','Subtract 的 y（下）','上減下：順序很重要'],['Subtract','Divide 的 x'],['常數 4','Divide 的 y','5 − 1：電壓的範圍'],['Divide','Multiply 的 x'],['常數 10','Multiply 的 y','壓力的範圍']])}<p>常數的做法：在函式的下面那個輸入上按右鍵 ▸ Create ▸ Constant，型別會自動對上。</p>`},
 {t:'限制範圍',view:'bd',add:['kHi','kLo','co','w7','w8','w9'],h:`<p>${fn('Programming','Comparison','In Range and Coerce')} ${qd('In Range')}：upper 10、lower 0。電壓有雜訊時可能讀到 5.02 V，算出 10.05 bar；限制之後畫面不會出現「超過量程」的怪數字。</p>`},
 {t:'呈現：數字和警報燈',view:'split',add:['bar','w10','k8','gt','w11','w12','alarm','w13'],h:`<p>coerced(x) 上右鍵 ▸ Create ▸ Indicator，標籤「壓力 bar」。前面板在它上面按右鍵 ▸ <b>Display Format</b>：Digits 2、選 Digits of precision：永遠顯示兩位小數，數字不會一下 5、一下 5.0123。</p><p>${fn('Programming','Comparison','Greater?')} ${qd('Greater?')} 和常數 8 比，輸出 Create ▸ Indicator → 前面板出現一顆燈，標籤「超過 8 bar」，右鍵改成紅色。</p>`},
 {t:'呈現：組一段文字',view:'bd',add:['kf','fmt','w14','w15','txt','w16'],h:`<p>${fn('Programming','String','Format Into String')} ${qd('Format Into String')}：format string 接字串常數 <code>%.2f bar</code>（%.2f＝小數兩位，F2 課有完整的格式碼），input 1 接壓力。結果「5.00 bar」可以直接寫進紀錄檔或顯示在狀態列。</p>`},
 {t:'異常：斷線判斷',view:'split',add:['k09','lt','w17','w18','broken','w19'],h:`<p>Less?：電壓 < 0.9 → 「感測器斷線？」。為什麼是 0.9 不是 1：留一點餘裕，正常的 1.00 V 加上雜訊讀到 0.98 不要誤報。</p><p>這就是 1～5 V（或 4～20 mA）傳送器的好處：<b>0 V 不是「壓力 0」，而是「出事了」</b>。</p>`},
 {t:'Run：用已知的點驗證',view:'split',add:[],h:`<p>輸入 1、3、5，對照上面的驗算表。再試 4.6（9 bar，警報）、0（斷線）、6（被限制在 10）。網頁版改完數字就會重算；LabVIEW 裡要再按一次 Run。</p>`}
]}},
C.h3('第 5 步','','呈現：選哪一種顯示元件'),
C.table(['想讓人看到什麼','用什麼','注意'],[
 ['精確的目前值','Numeric Indicator','設好小數位數，標籤帶單位'],
 ['一眼看在不在範圍內','Gauge、Meter、Tank','刻度範圍改成這個量的量程（例如 0～10 bar），警戒區可以塗色'],
 ['最近一段時間的變化','Waveform Chart','每次給一個點，它自己記歷史；放在迴圈裡'],
 ['一次拿到的一整串資料','Waveform Graph','每次給整個陣列，畫完整條；示波器、一次擷取 1000 點'],
 ['正常／異常','LED（Boolean Indicator）','紅色只用在異常，別讓操作員習慣「紅色是正常」'],
 ['訊息、紀錄','String Indicator','用 Format Into String 先排好格式']
]),
ask('主管說「壓力圖要看得到最近 10 分鐘」，要用 Chart 還是 Graph？要改哪裡？',
 `<p>Chart：每 100 ms 給一個點，它自己累積。10 分鐘 ＝ 600 秒 × 10 點 ＝ 6000 點，所以在 Chart 上按右鍵 ▸ <b>Chart History Length</b> 改成至少 6000（預設 1024，大約只有 1.7 分鐘）。Graph 也做得到，但你得自己用陣列存 6000 筆、每次整串重畫，比較麻煩。</p>`),
ask('輸入 0.95 V，畫面會顯示什麼？合理嗎？',
 `<p>(0.95 − 1) ÷ 4 × 10 ＝ −0.125，被限制成 <b>0.00 bar</b>；0.95 ≥ 0.9，斷線燈不亮。合理：可能只是雜訊讓 1.00 V 讀成 0.95。如果是一直停在 0.95，就要去量線。<b>邊界附近的值一定要自己試</b>，bug 最常躲在那裡。</p>`),
tip('之後每一課都會先看到這張表','從這一課開始，動手寫 LabVIEW 的段落都會先列「寫 LabVIEW 之前，先回答這幾個問題」，再一步一步放方塊圖。看到表的時候，先自己試著回答，再往下看。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'量程 0～10 bar、輸出 1～5 V，讀到 2 V 是幾 bar？',o:['2.5','2','5','0.25'],a:0,ex:'(2−1)÷4×10 ＝ 2.5。'},
 {q:'為什麼公式要先用 1 V、5 V、3 V 驗算？',o:['已知答案的點對了，公式才可信','LabVIEW 規定','讓程式跑比較快','不用驗算'],a:0,ex:'先用已知答案檢查，再相信公式。'},
 {q:'1～5 V 的傳送器讀到 0 V，最可能代表？',o:['線斷了或傳送器沒電','壓力是 0','壓力是負的','正常'],a:0,ex:'正常時至少 1 V。'},
 {q:'想看最近一段時間的趨勢，每次給一個點，用？',o:['Waveform Chart','Waveform Graph','Numeric Indicator','String Indicator'],a:0,ex:'Chart 自己記歷史。'},
 {q:'「壓力」的顯示元件，表示法用？',o:['DBL','U8','Boolean','String'],a:0,ex:'有小數的量測值用 DBL。'}
]}
]});
})();
