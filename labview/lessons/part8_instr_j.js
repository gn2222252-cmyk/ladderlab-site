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

/* ======================================================================
   LabVIEW 實作：GPD_SetVoltage.vi（檢查範圍 → 組命令 → 寫 → 讀回 → 比對）
   回覆是網頁模擬的（照 instsim.js 的 GPD：設定命令不回、VSET1? 回設定值）。
   ====================================================================== */
const ctl=C.ctl,qd=C.qd,wt=C.wt,PR=['Functions','Programming'];
const addF=o=>{for(const k in o)if(!LV.F[k])LV.F[k]=o[k];};
addF({
 'Fract/Exp String To Number':{g:'1.2E→#',ins:['string','offset','default'],outs:['offset past number','number'],w:46,pal:[...PR,'String','Number/String Conversion','Fract/Exp String To Number']},
 'Absolute Value':{p:'|x|',a:1,pal:[...PR,'Numeric','Absolute Value']}
});
const NOERR={status:false,code:0,source:''};
const setVI={name:'GPD_SetVoltage.vi',view:'bd',
 fp:{w:400,h:260,items:[
  {id:'vin',k:'visa',label:'VISA in',x:16,y:16,w:130,v:'COM5',options:['COM5']},
  {id:'volt',k:'num',ctl:true,label:'Voltage (V)',x:16,y:76,w:110,v:12.345,inc:1,dig:3},
  {id:'ein',k:'err',label:'error in (no error)',x:16,y:130},
  {id:'vout',k:'visa',label:'VISA out',x:200,y:16,w:130,v:'COM5',options:['COM5']},
  {id:'rb',k:'num',label:'Readback (V)',x:200,y:76,w:110,dig:3},
  {id:'ver',k:'led',label:'Verified',x:330,y:76},
  {id:'eout',k:'err',label:'error out',x:200,y:130}]},
 bd:{w:640,h:350,structs:[{id:'cs',k:'case',x:150,y:20,w:420,h:200,frames:['False','True'],cur:1}],
  nodes:[
  {id:'vin',k:'ctl',t:'visa',label:'VISA in',x:10,y:40},
  {id:'k32',k:'const',t:'dbl',v:32,x:56,y:129},
  {id:'volt',k:'ctl',t:'dbl',label:'Voltage (V)',x:10,y:140},
  {id:'k0',k:'const',t:'dbl',v:0,x:56,y:152},
  {id:'irc',k:'fn',fn:'In Range and Coerce',x:80,y:126,showName:false},
  {id:'ein',k:'ctl',t:'err',label:'error in',x:10,y:186},
  {id:'sel',k:'sel',t:'bool',s:'cs',y:157},
  {id:'tv',k:'tunnel',t:'visa',s:'cs',side:'l',y:50},
  {id:'tx',k:'tunnel',t:'dbl',s:'cs',side:'l',y:142},
  {id:'te',k:'tunnel',t:'err',s:'cs',side:'l',y:196},
  {id:'tvo',k:'tunnel',t:'visa',s:'cs',side:'r',y:131},
  {id:'teo',k:'tunnel',t:'err',s:'cs',side:'r',y:153},
  {id:'tbo',k:'tunnel',t:'str',s:'cs',side:'r',y:200},
  {id:'kfmt',k:'const',t:'str',v:'%.;VSET1:%.3f\\n',x:158,y:82,f:'cs:True'},
  {id:'fmt',k:'fn',fn:'Format Into String',x:286,y:80,f:'cs:True',showName:false},
  {id:'wr1',k:'fn',fn:'VISA Write',x:350,y:39,f:'cs:True',showName:false},
  {id:'kq',k:'const',t:'str',v:'VSET1?\\n',x:400,y:52,f:'cs:True'},
  {id:'wr2',k:'fn',fn:'VISA Write',x:480,y:39,f:'cs:True',showName:false},
  {id:'k100',k:'const',t:'i32',v:100,x:381,y:133,f:'cs:True'},
  {id:'rd',k:'fn',fn:'VISA Read',x:414,y:120,f:'cs:True',showName:false},
  {id:'fx',k:'fn',fn:'Fract/Exp String To Number',x:170,y:250,showName:false},
  {id:'rb',k:'ind',t:'dbl',label:'Readback (V)',x:232,y:310},
  {id:'sub',k:'fn',fn:'Subtract',x:250,y:274,showName:false},
  {id:'abs',k:'fn',fn:'Absolute Value',x:290,y:274,showName:false},
  {id:'ktol',k:'const',t:'dbl',v:'0.0005',x:284,y:312},
  {id:'lt',k:'fn',fn:'Less?',x:340,y:281,showName:false},
  {id:'ver',k:'ind',t:'bool',label:'Verified',x:380,y:285},
  {id:'vout',k:'ind',t:'visa',label:'VISA out',x:590,y:121},
  {id:'eout',k:'ind',t:'err',label:'error out',x:590,y:165}],
  wires:[
  {id:'w1',from:'vin',to:'tv.o',t:'visa'},
  {id:'w2',from:'k32',to:'irc.upper limit',t:'dbl'},
  {id:'w3',from:'volt',to:'irc.x',t:'dbl'},
  {id:'w4',from:'k0',to:'irc.lower limit',t:'dbl'},
  {id:'w5',from:'irc.In Range?',to:'sel',t:'bool'},
  {id:'w6',from:'irc.coerced(x)',to:'tx.o',t:'dbl'},
  {id:'w7',from:'ein',to:'te.o',t:'err'},
  {id:'t1',from:'kfmt',to:'fmt.format string',t:'str',f:'cs:True'},
  {id:'t2',from:'tx.i',to:'fmt.input 1',t:'dbl',pts:[[270,142],[270,103]],f:'cs:True'},
  {id:'t3',from:'tv.i',to:'wr1.VISA resource name',t:'visa',f:'cs:True'},
  {id:'t4',from:'fmt.resulting string',to:'wr1.write buffer',t:'str',pts:[[338,97],[338,61]],f:'cs:True'},
  {id:'t5',from:'te.i',to:'wr1.error in',t:'err',pts:[[346,196],[346,72]],f:'cs:True'},
  {id:'t6',from:'wr1.VISA resource name out',to:'wr2.VISA resource name',t:'visa',f:'cs:True'},
  {id:'t7',from:'kq',to:'wr2.write buffer',t:'str',f:'cs:True'},
  {id:'t8',from:'wr1.error out',to:'wr2.error in',t:'err',f:'cs:True'},
  {id:'t9',from:'wr2.VISA resource name out',to:'rd.VISA resource name',t:'visa',pts:[[540,50],[540,118],[380,118],[380,131]],f:'cs:True'},
  {id:'t10',from:'wr2.error out',to:'rd.error in',t:'err',pts:[[527,72],[527,112],[372,112],[372,153]],f:'cs:True'},
  {id:'t11',from:'k100',to:'rd.byte count',t:'i32',f:'cs:True'},
  {id:'t12',from:'rd.VISA resource name out',to:'tvo.i',t:'visa',f:'cs:True'},
  {id:'t13',from:'rd.error out',to:'teo.i',t:'err',f:'cs:True'},
  {id:'t14',from:'rd.read buffer',to:'tbo.i',t:'str',pts:[[462,142],[462,200]],f:'cs:True'},
  {id:'f1',from:'tv.i',to:'tvo.i',t:'visa',pts:[[360,50],[360,131]],f:'cs:False'},
  {id:'f2',from:'te.i',to:'teo.i',t:'err',pts:[[360,196],[360,153]],f:'cs:False'},
  {id:'w8',from:'tvo.o',to:'vout',t:'visa'},
  {id:'w9',from:'teo.o',to:'eout',t:'err',mx:582},
  {id:'w10',from:'tbo.o',to:'fx.string',t:'str',pts:[[600,200],[600,240],[160,240],[160,262]]},
  {id:'w11',from:'fx.number',to:'sub.x',t:'dbl'},
  {id:'w12',from:'fx.number',to:'rb',t:'dbl',pts:[[224,281],[224,320]]},
  {id:'w13',from:'irc.coerced(x)',to:'sub.y',t:'dbl',pts:[[130,142],[130,295]]},
  {id:'w14',from:'sub.out',to:'abs',t:'dbl'},
  {id:'w15',from:'abs.out',to:'lt.x',t:'dbl'},
  {id:'w16',from:'ktol',to:'lt.y',t:'dbl',pts:[[337,321],[337,302]]},
  {id:'w17',from:'lt.out',to:'ver',t:'bool'}]},
 sim:{live:true,step(i){
  const v=+i.volt,ok=v>=0&&v<=32,cmd='VSET1:'+v.toFixed(3)+'\n',rb=ok?+v.toFixed(3):0,ver=ok&&Math.abs(rb-v)<0.0005;
  return {out:{vout:i.vin,rb,ver,eout:NOERR},frames:{cs:ok?1:0},
   msg:ok?'In Range? ＝ T，走 True 頁：送「'+cmd.replace('\n','\\n')+'」，再問 VSET1? 讀回 '+rb.toFixed(3)+'，差 '+Math.abs(rb-v).toExponential(1)+' → Verified '+(ver?'亮':'不亮'):'超出 0～32 V：In Range? ＝ F，走 False 頁，什麼都不送。Readback 是空字串轉出來的 0，Verified 不亮。（這一版還沒產生錯誤，下面的問題）',
   vals:{vin:i.vin,volt:v,k32:32,k0:0,'irc.In Range?':ok,'irc.coerced(x)':Math.min(32,Math.max(0,v)),kfmt:'%.;VSET1:%.3f\n','fmt.resulting string':cmd,kq:'VSET1?\n',k100:100,'rd.read buffer':ok?rb.toFixed(3)+'V\r\n':'','fx.number':rb,'sub.out':rb-v,'abs.out':Math.abs(rb-v),ktol:0.0005,'lt.out':ver}};
 }}
};
const I14_LV=[
C.h3('LabVIEW','b','動手寫：GPD_SetVoltage.vi（上面那張規劃的 Case「不一樣」那一頁，包成驅動）'),
`<p>把「檢查範圍 → 組命令 → 寫 → 讀回比對」做成一個 SubVI。主程式的迴圈只要在「值有變」時呼叫它一次。ERR? 這一步先不畫，最後的問題會用到。</p>`,
C.plan({
 start:'File ▸ New VI，存成 <code>驅動\\GPD\\GPD_SetVoltage.vi</code>（跟 I10 的 GPD_ReadCurrent.vi 放在一起）。接線端照 I10 的慣例：VISA 和 error 左進右出。',
 in:'從接線端進來：<code>VISA in</code>、<code>Voltage (V)</code>（DBL，操作員輸入的，例 12.345）、<code>error in</code>。讀回來的是 VSET1? 的回覆字串（例 <code>12.345V\\r\\n</code>）。',
 calc:'In Range and Coerce（上限 32、下限 0）→ In Range? 接 Case。True 頁：Format Into String，格式 <code>%.;VSET1:%.3f\\n</code>（小數 3 位、指定句點、帶結尾字元）→ VISA Write → 再寫 <code>VSET1?\\n</code> → VISA Read。外面：Fract/Exp String To Number 轉回 DBL，跟要的值相減、取絕對值，小於 0.0005（%.3f 最後一位的一半）就算對。',
 out:'接線端出去：<code>Readback (V)</code>、<code>Verified</code>（布林）、<code>VISA out</code>、<code>error out</code>。',
 loop:'SubVI 裡沒有迴圈：呼叫一次寫一次。主程式用 Shift Register 記「上一次成功寫的值」，有變才呼叫（上面的規劃圖）。',
 end:'error 線串過 Case。超出範圍走 False 頁，什麼都不送；Verified 是 False，主程式看到就<b>不要更新</b>「上一次的值」，並告訴操作員。'}),
note('下面的 VI 視窗是網頁模擬的','改 Voltage 就會重算：試 12.345、33、−1。模擬的電源照上面「寫入檢查台」的規則。'),
{steps:{title:'GPD_SetVoltage.vi：範圍 → 命令 → 寫 → 讀回 → 比對',lv:setVI,steps:[
 {t:'前面板：照驅動的慣例',view:'fp',add:['vin','volt','ein','vout','rb','ver','eout'],h:`<p>左邊（輸入）：VISA Resource Name <code>VISA in</code>、Numeric Control <code>Voltage (V)</code>（3 位小數）、error in。右邊（輸出）：<code>VISA out</code>、<code>Readback (V)</code>、Round LED <code>Verified</code>、error out。</p>`},
 {t:'先檢查範圍：In Range and Coerce',view:'bd',add:['vin','volt','ein','k32','k0','irc','w2','w3','w4'],h:`<p>${fn('Programming','Comparison','In Range and Coerce')} ${qd('In Range and Coerce')}：upper limit 接 <code>32</code>、lower limit 接 <code>0</code>（這台每組 0～32 V）。輸出 <b>In Range?</b> 是布林，<b>coerced(x)</b> 是夾在範圍內的值。</p><p>儀器的範圍檢查是最後一道防線；程式自己先擋，不合法的值根本不送出去。</p>`},
 {t:'Case：In Range? 決定送不送',view:'bd',add:['cs','sel','tv','tx','te','tvo','teo','tbo','w1','w5','w6','w7','f1','f2'],h:`<p>Case Structure 的選擇端子接 In Range?，自動變成 True／False 兩頁。<b>False 頁</b>只把 VISA 線和 error 線從左接到右（點 ◀ ▶ 看）。</p><p class="qd">右邊那個字串 Tunnel 在 False 頁沒有接：右鍵 ▸ <b>Use Default If Unwired</b>，False 頁就輸出空字串。</p>`},
 {t:'True 頁：Format Into String 組命令',view:'bd',add:['kfmt','fmt','t1','t2'],frames:{cs:1},h:`<p>${fn('Programming','String','Format Into String')} ${qd('Format Into String')}。format string 接常數（'\\' Codes Display）<code>%.;VSET1:%.3f\\n</code>：</p>
${C.table(['格式字串的一段','意思'],[['%.;','這一次用句點當小數點（電腦語系是逗號也不會變）'],['VSET1:','固定文字，照抄'],['%.3f','input 1 的數字，小數 3 位'],['\\n','結尾字元']])}
<p>input 1 接穿進 Case 的電壓。輸出就是 <code>VSET1:12.345\\n</code>。</p>`},
 {t:'True 頁：寫設定、問設定值、讀回',view:'bd',add:['wr1','kq','wr2','k100','rd','t3','t4','t5','t6','t7','t8','t9','t10','t11','t12','t13','t14'],frames:{cs:1},h:`${wt([
 ['Format Into String 的 resulting string','VISA Write 的 write buffer','送設定（沒有回覆）'],
 ['常數 VSET1?\\n','第二個 VISA Write','問：你現在設的是多少'],
 ['第二個 VISA Write','VISA Read（byte count 100）','讀回 12.345V\\r\\n'],
 ['VISA Read 的 read buffer','右邊的字串 Tunnel','拿到 Case 外面轉數字']])}`},
 {t:'Case 外面：轉回數字、比對',view:'split',add:['fx','rb','sub','abs','ktol','lt','ver','vout','eout','w8','w9','w10','w11','w12','w13','w14','w15','w16','w17'],h:`<p>Fract/Exp String To Number 把讀回的字串變 DBL，接 <code>Readback (V)</code>。${fn('Programming','Numeric','Subtract')}（讀回 − 要的）→ ${fn('Programming','Numeric','Absolute Value')} → ${fn('Programming','Comparison','Less?')} 常數 <code>0.0005</code> → <code>Verified</code>。</p><p>不用 Equal?：DBL 算過、轉過字串，最後一位可能不一樣（上面「完全相等」那一題）。改 Voltage 試 12.345、33、−1。</p>`}
]}},
ask('改一個數字，先預測結果：格式字串的 <code>%.3f</code> 改成 <code>%.1f</code>，Voltage 輸入 12.345。送出的命令是什麼？Verified 會亮嗎？',
 `<p>送出 <code>VSET1:12.3\\n</code>（%.1f 四捨五入到 1 位）。電源很乖地設成 12.300，VSET1? 讀回 12.300。差 0.045，比 0.0005 大：<b>Verified 不亮</b>。</p>
<p>這就是讀回比對抓得到、ERR? 抓不到的那一種錯：儀器沒有做錯任何事，錯在你送的字串。另外注意：超出範圍（33 V）時這一版的 Verified 也是不亮，但 error out 沒有錯。正式的驅動要在 False 頁用 ${fn('Programming','Dialog & User Interface','Error Cluster From Error Code.vi')} 產生一個自訂錯誤（例 5003「電壓超出 0～32 V」），讓主程式從 error 線就知道（I10）。</p>`)
];

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

...I14_LV,
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
