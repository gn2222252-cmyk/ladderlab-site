/* 第八部分：接入新儀器（I9、I10）
   I9 網路模組 研華 ADAM-6017：先連線，再說話（Modbus/TCP、TCP 函式、斷線重連）。
   I10 把它包成自己的驅動，上線前的檢查表。
   事實出處：ADAM-6000 Series User Manual 附錄 B 的 Modbus 位址表（4X 區 40001 起是 AI 通道 0～7，功能碼 03／04 讀）。
   埠號 502、MBAP 標頭、位址從 0 起算，是 Modbus/TCP 協定本身的規則。
   注意：同一份手冊（Ed.5）第 6 章與附錄 B 的範例把 40001 寫成封包位址 00 01，回覆範例是浮點數（每通道 4 個位元組），
   和標準規則、和本站的模擬（位址 00 00、每通道一個 16 位元整數）不同。課文把這個落差當成教材：教學生自己驗。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='接入新儀器';
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const bytesHTML=parts=>`<div class="frame">${parts.map(p=>`<span class="${p[2]||''}">${p[0]}<small>${p[1]||''}</small></span>`).join('')}</div>`;
function term(opts){return d=>{
  if(window.InstSim&&InstSim.terminal){InstSim.terminal(d,opts);}
  else d.innerHTML='<div class="fig"><p>模擬儀器終端機沒有載入。</p></div>';
};}
function flow(items){
  const one=x=>{
    if(typeof x==='string')return `<span class="fb">${x}</span>`;
    if(x.loop)return `<span class="fl"><em>${x.label||'While Loop'}</em><span class="fin">${x.loop.map(one).join('<i class="fa">→</i>')}</span>${x.sr?`<small class="fsr">Shift Register：${x.sr}</small>`:''}</span>`;
    if(x.kase)return `<span class="fc"><em>Case：${x.label}${x.pages?'（每次只走其中一頁）':''}</em><span class="fin">${x.kase.map(one).join(x.pages?'<i class="fa">或</i>':'<i class="fa">→</i>')}</span></span>`;
    return '';
  };
  return `<div class="bdflow fig">${items.map(one).join('<i class="fa">→</i>')}</div>`;
}

/* ======================================================================
   LabVIEW 實作：I09_ReadAI.vi（TCP：Open → Write → 讀 7 → 算長度 → 讀剩下的 → Close）
                 I10：GPD_ReadCurrent.vi（第一個驅動 SubVI）與主程式
   回覆是網頁模擬的（照 instsim.js 的 adam6017：交易編號照抄、每通道 2 個位元組、0 V 約 32768）。
   ====================================================================== */
const ctl=C.ctl,qd=C.qd,wt=C.wt,PR=['Functions','Programming'],TCPP=['Functions','Data Communication','Protocols','TCP'];
const addF=o=>{for(const k in o)if(!LV.F[k])LV.F[k]=o[k];};
addF({
 'TCP Open Connection':{g:'TCP\nOPEN',ins:['address','remote port or service name','timeout ms','error in'],outs:['connection ID','error out'],w:48,h:72,col:'#e2f2ec',pal:[...TCPP,'TCP Open Connection']},
 'TCP Write':{g:'TCP\nW',ins:['connection ID','data in','error in'],outs:['connection ID out','bytes written','error out'],w:44,h:44,col:'#e2f2ec',pal:[...TCPP,'TCP Write']},
 'TCP Read':{g:'TCP\nR',ins:['connection ID','bytes to read','timeout ms','error in'],outs:['connection ID out','data out','error out'],w:48,h:90,col:'#e2f2ec',pal:[...TCPP,'TCP Read']},
 'TCP Close Connection':{g:'TCP\nCLOSE',ins:['connection ID','error in'],outs:['connection ID out','error out'],w:48,h:44,col:'#e2f2ec',pal:[...TCPP,'TCP Close Connection']},
 'Type Cast':{g:'⇢T',ins:['x','type'],outs:['*(type *) &x'],pal:[...PR,'Numeric','Data Manipulation','Type Cast']}
});
const NOERR={status:false,code:0,source:''};
const hx2=n=>(n<16?'0':'')+n.toString(16).toUpperCase();
const hexs=b=>b.map(hx2).join(' ');
const AIRAW=[40962,32767,45875,32768,32770,32766,32768,32769];
const aiVI={name:'I09_ReadAI.vi',view:'bd',
 fp:{w:400,h:300,items:[
  {id:'addr',k:'str',ctl:true,label:'Address',x:16,y:16,w:120,v:'192.168.1.50'},
  {id:'port',k:'num',ctl:true,label:'Port',rep:'U16',x:160,y:16,w:80,v:502},
  {id:'sim',k:'ring',label:'（模擬）模組',x:260,y:16,w:130,options:['正常','網路線拔掉'],v:0},
  {id:'raw',k:'arr',label:'Raw (U16)：AI0～AI7',x:16,y:76,n:8},
  {id:'eo',k:'err',label:'error out',x:16,y:140}]},
 bd:{w:640,h:480,nodes:[
  {id:'addr',k:'ctl',t:'str',label:'Address',x:16,y:43},
  {id:'port',k:'ctl',t:'u16',label:'Port',x:16,y:75},
  {id:'k3000',k:'const',t:'u32',v:3000,x:14,y:108},
  {id:'open',k:'fn',fn:'TCP Open Connection',x:60,y:21,h:160},
  {id:'kreq',k:'const',t:'str',v:'0001 0000 0006 0103 0000 0008',hex:true,x:114,y:103},
  {id:'wr',k:'fn',fn:'TCP Write',x:330,y:90},
  {id:'k7',k:'const',t:'i32',v:7,x:394,y:110},
  {id:'kt',k:'const',t:'u32',v:1000,x:382,y:128},
  {id:'rd7',k:'fn',fn:'TCP Read',x:424,y:83},
  {id:'k4',k:'const',t:'i32',v:4,x:481,y:177},
  {id:'k2',k:'const',t:'i32',v:2,x:481,y:195},
  {id:'ss',k:'fn',fn:'String Subset',x:504,y:150,h:72},
  {id:'ku16',k:'const',t:'u16',v:0,x:524,y:224},
  {id:'tc',k:'fn',fn:'Type Cast',x:552,y:175},
  {id:'dec',k:'fn',fn:'Decrement',x:600,y:177},
  {id:'kt2',k:'const',t:'u32',v:1000,x:210,y:325},
  {id:'rdn',k:'fn',fn:'TCP Read',x:260,y:280},
  {id:'k2b',k:'const',t:'i32',v:2,x:353,y:334},
  {id:'k16',k:'const',t:'i32',v:16,x:356,y:352},
  {id:'ss2',k:'fn',fn:'String Subset',x:380,y:307,h:72},
  {id:'kar',k:'const',t:'u16[]',v:'[U16]',x:424,y:324},
  {id:'tc2',k:'fn',fn:'Type Cast',x:470,y:322,ins:['type','x']},
  {id:'raw',k:'ind',t:'u16[]',label:'Raw (U16)',x:520,y:328},
  {id:'cl',k:'fn',fn:'TCP Close Connection',x:580,y:380,showName:false},
  {id:'seh',k:'fn',fn:'Simple Error Handler',x:590,y:430,showName:false}],
 wires:[
  {id:'w1',from:'addr',to:'open.address',t:'str'},
  {id:'w2',from:'port',to:'open.remote port or service name',t:'u16'},
  {id:'w3',from:'k3000',to:'open.timeout ms',t:'u32'},
  {id:'w4',from:'open.connection ID',to:'wr.connection ID',t:'ref',pts:[[111,74],[111,101]]},
  {id:'w5',from:'open.error out',to:'wr.error in',t:'err',pts:[[109,128],[109,123]]},
  {id:'w6',from:'kreq',to:'wr.data in',t:'str'},
  {id:'w7',from:'wr.connection ID out',to:'rd7.connection ID',t:'ref'},
  {id:'w8',from:'k7',to:'rd7.bytes to read',t:'i32'},
  {id:'w9',from:'kt',to:'rd7.timeout ms',t:'u32'},
  {id:'w10',from:'wr.error out',to:'rd7.error in',t:'err',pts:[[378,123],[378,155]]},
  {id:'w11',from:'rd7.data out',to:'ss.string',t:'str',pts:[[478,128],[478,168]]},
  {id:'w12',from:'k4',to:'ss.offset',t:'i32'},
  {id:'w13',from:'k2',to:'ss.length',t:'i32'},
  {id:'w14',from:'ss.substring',to:'tc.x',t:'str'},
  {id:'w15',from:'ku16',to:'tc.type',t:'u16',pts:[[548,233],[548,196]]},
  {id:'w16',from:'tc.*(type *) &x',to:'dec',t:'u16'},
  {id:'w17',from:'rd7.connection ID out',to:'rdn.connection ID',t:'ref',pts:[[634,106],[634,266],[136,266],[136,298]]},
  {id:'w18',from:'dec.out',to:'rdn.bytes to read',t:'u16',pts:[[631,191],[631,258],[128,258],[128,316]]},
  {id:'w19',from:'rd7.error out',to:'rdn.error in',t:'err',pts:[[475,151],[475,250],[120,250],[120,352]]},
  {id:'w20',from:'kt2',to:'rdn.timeout ms',t:'u32'},
  {id:'w21',from:'rdn.data out',to:'ss2.string',t:'str'},
  {id:'w22',from:'k2b',to:'ss2.offset',t:'i32'},
  {id:'w23',from:'k16',to:'ss2.length',t:'i32'},
  {id:'w24',from:'ss2.substring',to:'tc2.x',t:'str'},
  {id:'w25',from:'kar',to:'tc2.type',t:'u16[]'},
  {id:'w26',from:'tc2.*(type *) &x',to:'raw',t:'u16[]'},
  {id:'w27',from:'rdn.connection ID out',to:'cl.connection ID',t:'ref',pts:[[316,303],[316,290],[560,290],[560,395]]},
  {id:'w28',from:'rdn.error out',to:'cl.error in',t:'err',pts:[[314,348],[314,420],[570,420],[570,409]]},
  {id:'w29',from:'cl.error out',to:'seh.error in',t:'err',pts:[[634,409],[634,428],[584,428],[584,446]]}]},
 sim:{live:true,step(i){
  if(+i.sim===1){const E={status:true,code:56,source:'TCP Open Connection in I09_ReadAI.vi（連不上 '+i.addr+':'+i.port+'，等了 3000 ms）'};
   return {out:{raw:[],eo:E},msg:'連線就失敗了：後面的 Write、Read 看到 error in 有錯都不做，Close 照樣執行。Raw 是空的。',vals:{'open.error out':E,'wr.error out':E,'rd7.error out':E,'rdn.error out':E,'cl.error out':E}};}
  const data=[];AIRAW.forEach(v=>data.push(v>>8,v&255));
  const head=[0,1,0,0,0,3+16,1],body=[3,16].concat(data),n=((head[4]<<8)|head[5])-1;
  return {out:{raw:AIRAW.slice(),eo:NOERR},msg:'讀 7 個：'+hexs(head)+' → 長度 '+hx2(head[4])+' '+hx2(head[5])+'＝'+(n+1)+'，減 1 再讀 '+n+' 個：'+hexs(body.slice(0,6))+'…。跳過前 2 個（功能碼、位元組數），16 個位元組 Type Cast 成 8 個 U16。',
   vals:{addr:i.addr,port:i.port,k3000:3000,kreq:'00 01 00 00 00 06 01 03 00 00 00 08',k7:7,kt:1000,k4:4,k2:2,ku16:0,kt2:1000,k2b:2,k16:16,kar:'[U16]','rd7.data out':hexs(head),'ss.substring':hexs(head.slice(4,6)),'tc.*(type *) &x':n+1,'dec.out':n,'rdn.data out':hexs(body),'ss2.substring':hexs(data),'tc2.*(type *) &x':AIRAW,'open.error out':NOERR,'wr.error out':NOERR,'rd7.error out':NOERR,'rdn.error out':NOERR,'cl.error out':NOERR}};
 }}
};
const I09_LV=[
C.h3('LabVIEW','b','動手寫：I09_ReadAI.vi（先不管斷線：連一次、讀一次、關掉）'),
`<p>規劃圖的第一版。這一支只讀<b>一次</b>，把「讀 7 個、算長度、讀剩下的」做對。對了以後再照上面的規劃包進迴圈、加交易編號和重連。</p>`,
C.plan({
 start:'File ▸ New VI，存成 <code>練習\\儀器\\I09_ReadAI.vi</code>。先在命令提示字元 <code>ping 192.168.1.50</code> 通了才開始。',
 in:'TCP Read 讀到的是字串，裡面是位元組。先讀 7 個（MBAP 標頭＋站號），第 5、6 個是「後面還有幾個」；再讀「長度 − 1」個：功能碼 1 個、位元組數 1 個、資料 16 個（8 個通道 × 2）。',
 calc:'長度：String Subset（offset 4、length 2）→ Type Cast 成 U16（高位元組在前，Type Cast 剛好也是）→ Decrement。資料：String Subset（offset 2、length 16）→ Type Cast 成 U16 陣列，一次得到 8 個原始值。原始值換成伏特要用兩個已知點量出斜率和截距（上面那一題），這一版先顯示原始值。',
 out:'U16 陣列指示器 <code>Raw (U16)</code>，拉開成 8 格。先跟廠商設定工具上看到的數值比，確定通道沒有差一格。',
 loop:'這支只做一次。之後的版本：While Loop、Wait 1000 ms（任務是每秒讀一次）。',
 end:'TCP Read 的 timeout ms 一定要接（1000），不接是 25 秒。error 串到 TCP Close Connection；連不上時 TCP Open 就出錯，後面都不做，Close 照樣關。'}),
note('下面的 VI 視窗是網頁模擬的','模組的位址、各通道的原始值是模擬的，封包格式照 Modbus/TCP。'),
{steps:{title:'I09_ReadAI.vi：TCP 的開、寫、讀兩次、關',lv:aiVI,steps:[
 {t:'前面板',view:'fp',add:['addr','port','raw','eo','sim'],h:`<p>String Control <code>Address</code>（192.168.1.50）、Numeric Control <code>Port</code>（Representation U16，502）。${ctl('Modern','Array, Matrix & Cluster','Array')} 裡放一個 Numeric Indicator，Representation 改 U16，標籤 <code>Raw (U16)</code>，往右拉成 8 格。</p>`},
 {t:'TCP Open Connection',view:'bd',add:['addr','port','k3000','open','w1','w2','w3'],h:`<p>${fn('Data Communication','Protocols','TCP','TCP Open Connection')} ${qd('TCP Open')}。</p>${wt([
 ['Address','address','模組的 IP'],
 ['Port','remote port or service name','502：Modbus/TCP 的標準埠號'],
 ['常數 3000','timeout ms','連線最多等 3 秒']])}<p>輸出的 <b>connection ID</b> 是一條連線的代號（深綠色的參照線），角色跟 VISA 的紫線一樣。</p>`},
 {t:'TCP Write：送 12 個位元組',view:'bd',add:['kreq','wr','w4','w5','w6'],h:`<p>${fn('Data Communication','Protocols','TCP','TCP Write')} ${qd('TCP Write')}。data in 接 Hex Display 的字串常數 <code>0001 0000 0006 0103 0000 0008</code>：交易編號 1、協定 0、長度 6、站號 1、功能碼 03、位址 0、要 8 個。</p>`},
 {t:'TCP Read：先讀 7 個',view:'bd',add:['k7','kt','rd7','w7','w8','w9','w10'],h:`<p>${fn('Data Communication','Protocols','TCP','TCP Read')} ${qd('TCP Read')}。mode 不接（Standard：讀滿才回來，或逾時）。bytes to read 接 <code>7</code>，timeout ms 接 <code>1000</code>。</p>`},
 {t:'從標頭算出還要讀幾個',view:'bd',add:['k4','k2','ss','ku16','tc','dec','w11','w12','w13','w14','w15','w16'],h:`<p>String Subset 取第 4、5 個位元組（offset <code>4</code>、length <code>2</code>），${fn('Programming','Numeric','Data Manipulation','Type Cast')} ${qd('Type Cast')} 的 type 接一個 <b>U16</b> 常數（值不重要，只看型別），2 個位元組就變成一個 U16。再 ${fn('Programming','Numeric','Decrement')}：長度包含已經讀走的站號，要減 1。</p>`},
 {t:'讀剩下的',view:'bd',add:['kt2','rdn','w17','w18','w19','w20'],h:`<p>第二個 TCP Read：connection ID 和 error 從第一個接過來，bytes to read 接 Decrement 的結果（例：19 − 1 ＝ 18），timeout ms 一樣 <code>1000</code>。</p>`},
 {t:'16 個位元組變成 8 個 U16',view:'bd',add:['k2b','k16','ss2','kar','tc2','raw','w21','w22','w23','w24','w25','w26'],h:`${wt([
 ['TCP Read 的 data out','String Subset 的 string','offset 2：跳過功能碼和位元組數'],
 ['常數 16','String Subset 的 length','8 個通道 × 2'],
 ['U16 陣列常數','Type Cast 的 type','在陣列常數裡放一個 U16 數值常數'],
 ['Type Cast 的輸出','Raw (U16)','8 個原始值']])}<p class="qd">先數位元組再決定型別：16 ÷ 8 ＝ 2，所以是 U16。如果你那一台回來是 32 個，就要改成 SGL 陣列（上面講的浮點數版本）。</p>`},
 {t:'TCP Close Connection；Run',view:'split',add:['cl','seh','w27','w28','w29'],h:`<p>${fn('Data Communication','Protocols','TCP','TCP Close Connection')}，再 Simple Error Handler。Run：Raw 第 0 格是 40962（A002H）。把模擬切到「網路線拔掉」再看一次：3 秒後出錯，Raw 是空的。</p>`}
]}},
ask('改一個數字，先預測結果：把 TCP Write 的封包裡起始位址從 <code>0000</code> 改成 <code>0001</code>（照說明書範例從 1 數）。Raw 的 8 格會變成什麼？會有錯誤嗎？',
 `<p><b>沒有錯誤</b>，8 格全部往前移一格：第 0 格變成原本 AI1 的值，最後一格是 AI8（這個模組沒有，可能回 0 或例外回覆，要看模組）。數值看起來都很合理。</p>
<p>這就是上面說的「填錯一格不會有任何錯誤訊息」。所以一定要用已知的訊號驗：只動 AI0（例如短路成 0 V），看是不是第 0 格在變。</p>`)
];

/* ---------- I10：GPD_ReadCurrent.vi（驅動的 Read）與用驅動寫的主程式 ---------- */
const drvVI={name:'GPD_ReadCurrent.vi',view:'split',ratio:1.6,
 fp:{w:330,h:230,items:[
  {id:'vin',k:'visa',label:'VISA in',x:16,y:16,w:130,v:'COM5',options:['COM5']},
  {id:'ein',k:'err',label:'error in (no error)',x:16,y:76},
  {id:'vout',k:'visa',label:'VISA out',x:180,y:16,w:130,v:'COM5',options:['COM5']},
  {id:'cur',k:'num',label:'Current (A)',x:180,y:76,w:110,dig:3},
  {id:'eout',k:'err',label:'error out',x:180,y:126}]},
 bd:{w:560,h:150,nodes:[
  {id:'vin',k:'ctl',t:'visa',label:'VISA in',x:16,y:40},
  {id:'ein',k:'ctl',t:'err',label:'error in',x:16,y:110},
  {id:'kcmd',k:'const',t:'str',v:'IOUT1?\\n',x:80,y:52},
  {id:'wr',k:'fn',fn:'VISA Write',x:150,y:39},
  {id:'k100',k:'const',t:'i32',v:100,x:200,y:52},
  {id:'rd',k:'fn',fn:'VISA Read',x:236,y:39},
  {id:'kf',k:'const',t:'str',v:'%f',x:292,y:41},
  {id:'sc',k:'fn',fn:'Scan From String',x:320,y:39,h:44,ins:['format string','input string','error in'],outs:['remaining string','output 1','error out']},
  {id:'cur',k:'ind',t:'dbl',label:'Current (A)',x:390,y:51},
  {id:'vout',k:'ind',t:'visa',label:'VISA out',x:450,y:40},
  {id:'eout',k:'ind',t:'err',label:'error out',x:490,y:62}],
 wires:[
  {id:'w1',from:'vin',to:'wr.VISA resource name',t:'visa'},
  {id:'w2',from:'ein',to:'wr.error in',t:'err',mx:140},
  {id:'w3',from:'kcmd',to:'wr.write buffer',t:'str'},
  {id:'w4',from:'wr.VISA resource name out',to:'rd.VISA resource name',t:'visa'},
  {id:'w5',from:'wr.error out',to:'rd.error in',t:'err'},
  {id:'w6',from:'k100',to:'rd.byte count',t:'i32'},
  {id:'w7',from:'rd.read buffer',to:'sc.input string',t:'str'},
  {id:'w8',from:'rd.error out',to:'sc.error in',t:'err'},
  {id:'w9',from:'kf',to:'sc.format string',t:'str'},
  {id:'w10',from:'sc.output 1',to:'cur',t:'dbl'},
  {id:'w11',from:'rd.VISA resource name out',to:'vout',t:'visa',pts:[[286,50],[286,24],[440,24],[440,50]]},
  {id:'w12',from:'sc.error out',to:'eout',t:'err'}]},
 sim:{live:true,step(i){return {out:{cur:0.5,vout:i.vin,eout:NOERR},msg:'（模擬）讀到 0.500A\\r\\n → 0.5',vals:{vin:i.vin,ein:NOERR,kcmd:'IOUT1?\n',k100:100,kf:'%f','rd.read buffer':'0.500A\r\n','sc.output 1':0.5,'rd.VISA resource name out':i.vin,'sc.error out':NOERR}};}}
};
const drvMain={name:'I10_Main.vi（用驅動寫的主程式）',view:'bd',
 bd:{w:640,h:200,structs:[{id:'wl',k:'while',x:250,y:20,w:240,h:160}],
  nodes:[
  {id:'res',k:'ctl',t:'visa',label:'Resource',x:10,y:47},
  {id:'ini',k:'sub',name:'GPD_Initialize.vi',top:'GPD',icon:['INIT'],ins:['Resource'],outs:['VISA out'],err:true,x:56,y:40},
  {id:'kv',k:'const',t:'dbl',v:12,x:140,y:55},
  {id:'ki',k:'const',t:'dbl',v:0.5,x:106,y:72},
  {id:'cfg',k:'sub',name:'GPD_Configure.vi',top:'GPD',icon:['CONFIG'],ins:['VISA in','Voltage','Current Limit'],outs:['VISA out'],err:true,x:170,y:30,h:80},
  {id:'t1',k:'tunnel',t:'visa',s:'wl',side:'l',y:64},
  {id:'sre',k:'sr',t:'err',s:'wl',y:103},
  {id:'rd',k:'sub',name:'GPD_ReadCurrent.vi',top:'GPD',icon:['READ I'],ins:['VISA in'],outs:['VISA out','Current'],err:true,x:310,y:40},
  {id:'cur',k:'ind',t:'dbl',label:'Current (A)',x:400,y:53},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:400,y:140},
  {id:'cond',k:'stop',s:'wl'},
  {id:'t2',k:'tunnel',t:'visa',s:'wl',side:'r',y:40},
  {id:'cls',k:'sub',name:'GPD_Close.vi',top:'GPD',icon:['CLOSE'],ins:['VISA in'],outs:[],err:true,x:520,y:40},
  {id:'seh',k:'fn',fn:'Simple Error Handler',x:590,y:63,showName:false}],
  wires:[
  {id:'w1',from:'res',to:'ini.Resource',t:'visa'},
  {id:'w2',from:'ini.VISA out',to:'cfg.VISA in',t:'visa',mx:115},
  {id:'w3',from:'ini.error out',to:'cfg.error in',t:'err',mx:104},
  {id:'w4',from:'kv',to:'cfg.Voltage',t:'dbl'},
  {id:'w5',from:'ki',to:'cfg.Current Limit',t:'dbl'},
  {id:'w6',from:'cfg.VISA out',to:'t1.o',t:'visa',mx:230},
  {id:'w7',from:'cfg.error out',to:'sre.init',t:'err',mx:230},
  {id:'w8',from:'t1.i',to:'rd.VISA in',t:'visa',mx:290},
  {id:'w9',from:'sre.L',to:'rd.error in',t:'err',mx:290},
  {id:'w10',from:'rd.Current',to:'cur',t:'dbl'},
  {id:'w11',from:'rd.VISA out',to:'t2.i',t:'visa',mx:380},
  {id:'w12',from:'rd.error out',to:'sre.R',t:'err',mx:380},
  {id:'w13',from:'stop',to:'cond',t:'bool'},
  {id:'w14',from:'t2.o',to:'cls.VISA in',t:'visa',mx:505},
  {id:'w15',from:'sre.out',to:'cls.error in',t:'err',mx:510},
  {id:'w16',from:'cls.error out',to:'seh.error in',t:'err',mx:580}]}
};
const I10_LV=[
C.h3('LabVIEW','b','動手寫：GPD_ReadCurrent.vi（第一個驅動 VI）'),
`<p>上面第一個 todo 說「把三個函式框起來 Create SubVI」。這裡把那一步做完整：LabVIEW 幫你建的 SubVI 只是雛形，名字、接線端、錯誤線都要自己整理，才算一個能串起來的驅動 VI。</p>`,
C.plan({
 start:'打開 <code>I04_Monitor.vi</code>，選取迴圈裡的 VISA Write、VISA Read、Scan From String 和常數 → <b>Edit ▸ Create SubVI</b>。雙擊新出現的 SubVI，File ▸ Save As 存成 <code>驅動\\GPD\\GPD_ReadCurrent.vi</code>。',
 in:'從接線端進來兩樣：<code>VISA in</code>（已經開好的 COM 埠）、<code>error in</code>。VI 自己送 <code>IOUT1?\\n</code>、讀回 <code>0.500A\\r\\n</code>。',
 calc:'Scan From String（%f）→ DBL。命令的拼法、結尾字元、格式全部收在這個 VI 裡，主程式看不到。',
 out:'接線端出去三樣：<code>Current (A)</code>（DBL）、<code>VISA out</code>、<code>error out</code>。',
 loop:'SubVI 裡<b>不放迴圈</b>：呼叫一次讀一次。多久讀一次由主程式的迴圈決定。',
 end:'不開也不關 COM 埠（那是 Initialize、Close 的事）。error in 有錯時，裡面的 VISA 函式自己就不做事，直接把錯誤從 error out 傳出去。'}),
{steps:{title:'GPD_ReadCurrent.vi：整理 Create SubVI 做出來的雛形',lv:drvVI,steps:[
 {t:'前面板：輸入在左、輸出在右',view:'fp',add:['vin','ein','vout','cur','eout'],h:`<p>Create SubVI 會自動產生控制元件，名字是 LabVIEW 取的。改成：<code>VISA in</code>、<code>error in (no error)</code>、<code>VISA out</code>、<code>Current (A)</code>、<code>error out</code>。輸入排左邊、輸出排右邊，看前面板就知道誰進誰出。</p><p class="qd">LabVIEW 沒有自動產生 error in／error out 時，在 VISA Write 的 error in 上右鍵 Create ▸ Control、在最後的 error out 上 Create ▸ Indicator。</p>`},
 {t:'方塊圖：照原本的順序',view:'bd',add:['vin','ein','kcmd','wr','k100','rd','w1','w2','w3','w4','w5','w6'],h:`<p>內容跟 I4 迴圈裡一樣，只是頭尾從 Tunnel 變成 SubVI 的控制元件：</p>${wt([
 ['VISA in','VISA Write 的 VISA resource name'],
 ['error in','VISA Write 的 error in','上一個 VI 有錯，這裡就不送'],
 ['常數 IOUT1?\\n','VISA Write 的 write buffer'],
 ['VISA Write','VISA Read（byte count 100）','紫線、黃線照串']])}`},
 {t:'轉數字，輸出 Current',view:'bd',add:['kf','sc','cur','w7','w8','w9','w10'],h:`<p>Scan From String（%f）的 output 1 接 <code>Current (A)</code>。</p>`},
 {t:'VISA out、error out：線要穿出去',view:'bd',add:['vout','eout','w11','w12'],h:`${wt([
 ['VISA Read 的 VISA resource name out','VISA out','讓下一個驅動 VI 接著用'],
 ['Scan From String 的 error out','error out','最後一個有 error 的函式']])}<p>這兩條線是驅動能「一個接一個串起來」的關鍵。少了 VISA out，主程式就得自己拉一條分岔，順序也就沒有資料流保證了。</p>`},
 {t:'接線端（Connector Pane）和圖示',view:'split',add:[],h:`<p>前面板右上角的接線端：右鍵 ▸ Patterns 選 <b>4 × 2 × 2 × 4</b>（預設那一個）。用滑鼠點一格、再點一個控制元件，就接上了：</p>
${C.table(['位置','接什麼'],[['左上','VISA in'],['左下','error in'],['右上','VISA out'],['右下','error out'],['右邊中間','Current (A)']])}
<p>圖示（右上角另一個方塊）雙擊進 Icon Editor，寫兩行字：<code>GPD</code>／<code>READ I</code>。存檔。</p>`},
 {t:'回到主程式：只看得到驅動',view:'split',add:[],h:`<p>主程式裡原本那三個函式現在變成一個方塊。下面那張圖是四個驅動都做好以後的主程式：它不知道 <code>IOUT1?</code> 怎麼拼，只知道「讀電流」。</p>`}
]}},
{lv:drvMain,cap:'用驅動寫的主程式：Initialize、Configure 在迴圈外各一次，Read 在迴圈裡，Close 在最後。每個方塊都是自己寫的 SubVI（圖上的名稱照上面的表）；紫線和黃線直直穿過去。'},
ask('改一個數字，先預測結果：GPD_ReadCurrent.vi 的接線端，把 error in 接到<b>右下</b>、error out 接到<b>左下</b>（接反了）。主程式那張圖接得起來嗎？',
 `<p>接不起來，或接起來是斷線：主程式裡上一個 VI 的 error out 要接到這個 VI 的 error in，可是它現在在右邊，LabVIEW 不讓「輸出接輸出」，線會是斷的（虛線、Run 箭頭斷掉）。</p>
<p>這就是為什麼大家都照同一個慣例排：連線的線左上進右上出、error 左下進右下出。你的驅動照慣例，別人的程式（包括 NI 的範例）就能直接跟它串在一起。</p>`)
];

/* =============================== I9 =============================== */
L.push({id:'I09',order:29.9,no:'I9',part:PART,title:'網路模組：先連線，再說話（TCP）',mins:60,
goals:[['學會','TCP 的連線、寫、讀、關；Modbus/TCP 的標頭；位址表上的 40001 在封包裡填多少；斷線後怎麼重連。'],['做出','親手送出讀 8 個通道的封包，分兩次把回覆讀完，並規劃一支會自動重連的程式。'],['為什麼','遠端 I/O 模組、PLC、很多新設備都走網路。網路線被拔掉、設備重開機，是每天都會發生的事。'],['先備','I7。封包的中段和 Modbus RTU 一樣。'],['網頁練習','<a href="instlab.html">儀器接入練習台</a> 選「ADAM-6017」。']],
check:'你能說出：Modbus/TCP 和 RTU 的封包差在哪、回覆要怎麼分兩次讀、連線的那條線為什麼要進 Shift Register。',
body:[
C.h3('情境','x','第六台：研華 ADAM-6017 類比輸入模組'),
`<p>任務：機台旁邊的箱子裡有一個類比輸入模組，接了 8 個感測器。它用網路線接到交換器，LabVIEW 要每秒讀一次 8 個通道。</p>`,
C.h3('第 1、2 步','','背板與接入單'),
`<p>背板：一個網路孔，一排接感測器的端子。說明書附 Modbus/TCP 的位址表。</p>
<p>照 I1 的三個問題：會說話、走網路、講的不是 SCPI 而是 Modbus/TCP。用 <b>TCP 函式</b>。</p>`,
C.table(['接入單','這個模組','怎麼知道的'],[
 ['IP 位址','例：192.168.1.50','模組的設定工具，或箱子上貼的標籤'],
 ['埠號','502','同一台設備上可以同時開好幾種網路服務，埠號是指定「要找哪一個服務」的號碼。502 是 Modbus/TCP 的標準埠號，確認模組沒有被改過'],
 ['站號','1','設定工具'],
 ['誰先開口','電腦問才回','—'],
 ['資料在哪裡','位址 40001～40008 是通道 0～7','說明書的位址表'],
 ['功能碼','03 或 04：讀暫存器','說明書'],
 ['數值','每個通道是一個 16 位元的整數，還是一個浮點數，要看你那一版說明書','說明書的資料格式表；不確定就看回覆有幾個位元組（下面會做）']
]),
ask('網路設備跟序列埠設備，使用上最大的不同是什麼？',
 `<p>序列埠是一條專線：線接著，隨時可以送。</p>
<p>網路要先<b>連線</b>。你的程式要先跟模組說「我要跟你建立連線」，它答應了，才有一條可以寫、可以讀的通道。沒連線就寫，什麼都送不出去。</p>
<p>而且這條連線<b>會斷</b>：網路線被拔、交換器斷電、模組重開機。斷了以後，原來那條連線就作廢了，要重新連一次。序列埠的線也可能被拔掉（I4 最後留了這一題），只是在網路上斷線更常發生，所以這一課要正面處理它。</p>`),
ask('接上去以後，第一件事做什麼？',
 `<p>還是同一個原則：<b>不寫程式，先確認通得到</b>。網路設備有比送命令更基本的一步：</p>
<ol><li>在命令提示字元打 <code>ping 192.168.1.50</code>。有回應，表示線和 IP 設定都對。沒回應就先不用往下試，先查電腦和模組的 IP 是不是設在同一個範圍。</li>
<li>用廠商的設定工具連上去，看得到 8 個通道的數值在動。這證明模組本身正常，也讓你知道「正確的數值大概是多少」，等一下自己讀出來可以比對。</li>
<li>最後才自己送封包。</li></ol>`),

C.h3('懂','','封包：跟 I7 比，多了什麼、少了什麼'),
`<p>網路要先連線才能送東西，這是跟序列埠最大的不同（上面那一題）。連上以後，要送的封包長這樣。先自己排排看：</p>`,
ask('要讀 8 個通道。用 I7 學的做法，「幾號站、做哪種事、從哪個位址開始、要幾個」各填什麼？',
 `<p>站號 1；讀暫存器，功能碼 03；從第一個通道開始；要 8 個。寫成位元組是 01、03、00 00、00 08。（起始位址為什麼是 00 00，下面有一題專門講，它沒有看起來那麼單純。）</p>
<p>Modbus/TCP 的封包就是把這一段放在後面，前面再加 6 個位元組的標頭：</p>`),
bytesHTML([['00 01','交易編號','adr'],['00 00','協定：固定 0','ctl'],['00 06','後面還有 6 個位元組','len'],['01','站號','adr'],['03','功能碼：讀','ctl'],['00 00','起始位址','adr'],['00 08','要 8 個','len']]),
`<p>後面的站號、功能碼、位址、數量，跟 I7 的 Modbus RTU 一模一樣。不同的是：<b>前面多了 6 個位元組的標頭，後面沒有 CRC</b>。標頭加上站號這 7 個位元組，協定文件叫它 MBAP 標頭。終端機上有一顆「幫我加 MBAP 標頭」的按鈕，這一課先不用它，自己打完整的封包。</p>`,
ask('為什麼不需要 CRC 了？',
 `<p>CRC 的用途是檢查「封包在路上有沒有壞」。TCP 和乙太網路這兩層自己就會檢查，壞了還會自動重送，所以到你手上的位元組幾乎不會是壞的。Modbus/TCP 就把自己的 CRC 拿掉了。</p>`),
ask('「交易編號」是做什麼的？',
 `<p>你問一次，自己編一個號碼放進去；模組的回覆會帶著同一個號碼。</p>
<p>它的用處是對帳：收到回覆時，看號碼是不是你剛才問的那一個。如果上一問的回覆因為網路塞車遲到了，號碼對不起來，你就知道這一筆不是現在這一問的答案。</p>
<p>每問一次加 1。「一個值每一圈被改掉、下一圈要用改過的」，所以它放在 Shift Register 裡。</p>`),
ask('位址表寫 40001，為什麼封包裡的位址是 00 00？',
 `<p>這是 Modbus 最常讓人差一格的地方。</p>
<p>位址表上的 40001 是給人看的寫法：最前面的 4 代表「這一類是可以讀寫的暫存器」，後面的編號從 1 開始數。封包裡的位址是給機器看的：不含那個 4，而且從 0 開始數。</p>
<p>所以 40001 在封包裡是 0，40002 是 1，40008 是 7。</p>
<p>以上是 Modbus 標準的規定。<b>但是</b>：這個模組的說明書，自己的範例卻把 40001 寫成 00 01，也就是從 1 開始數。標準說 0，說明書的範例寫 1，你手上那一台到底用哪一個？</p>
<p>不要選邊相信，<b>去驗</b>：只改變通道 0 的輸入（例如短路成 0 V，或接一個已知的電壓），用 00 00 讀一次，看第一筆數值有沒有跟著變。變了，就是從 0 數；變的是第二筆，或根本沒變，就是從 1 數。</p>
<p>填錯一格不會有任何錯誤訊息，你只會讀到隔壁通道的值，而且數值看起來很合理。所以這個驗證一定要做。這一頁模擬的模組是照標準，從 0 數。</p>`),

C.h3('第 3、4 步','','講到話，把回覆讀完'),
note('這是網頁模擬的模組','封包格式照 Modbus/TCP。IP、各通道接的訊號、原始值的換算方式是模擬的。'),
{fn:term({inst:'adam6017',presets:[{label:'讀 AI0～AI7',hex:'00 01 00 00 00 06 01 03 00 00 00 08'},{label:'讀不存在的位址',hex:'00 03 00 00 00 06 01 03 00 20 00 01'}],showHex:true})},
{todo:[
 '<b>不要</b>按連線。點「讀 AI0～AI7」把封包帶進輸入框，按「送出並讀回覆」。先猜：會怎樣？',
 '按「連線」，等上面的標示變成「已連線」（大約要 1 秒）。把「讀取方式」改成「讀固定幾個位元組」，位元組數填 7，再按「送出並讀回覆」。讀到的 7 個位元組裡，哪兩個是「後面還有幾個」？',
 '回覆是位元組，不是文字，所以第 ① 列「記事本看到的」會是亂碼，這是正常的。看第 ③ 列十六進位。',
 '照剛才的長度，算出還要讀幾個位元組，填進「位元組數」，按「只讀」。看「緩衝區」剩幾個：全部讀完了嗎？',
 '故意多讀一個、少讀一個各試一次。各會看到什麼？',
 '點「讀不存在的位址」，按「送出並讀回覆」，同樣先讀 7 個。這次長度是多少？再讀剩下的，功能碼變成什麼？'
]},
ask('標頭說「後面還有 13H（19）個位元組」，我已經讀了 7 個，還要讀幾個？',
 `<p>不是 19 個，是 <b>18 個</b>。</p>
<p>長度那一格算的是「長度欄位之後」的位元組數，而標頭的第 7 個位元組（站號）已經算在裡面了，你也已經把它讀走了。所以還剩 19 − 1 ＝ 18 個。</p>
<p>這種「長度到底包不包含某一格」的問題，每一種協定的規定都不一樣。不要靠記的，用終端機實際數一次：多讀會逾時，少讀下一次會讀到上一筆的尾巴。兩種都很容易看出來。</p>
<p>LabVIEW 裡的做法：${fn('Data Communication','Protocols','TCP','TCP Read')} 的 bytes to read 先接 7；把讀到的字串轉成位元組陣列，取第 4、第 5 個元素用 Join Numbers 合成長度；減 1 以後，接給第二個 TCP Read。</p>`),
ask('TCP Read 沒有結尾字元可以設。它怎麼知道讀完了？',
 `<p>TCP Read 預設的模式（Standard）只看兩件事：讀滿你要的位元組數，或逾時。所以用 TCP 函式時，「一筆到哪裡結束」完全是你的責任，一定要像上面那樣先讀頭、再照頭讀身體。</p>
<p>另外，TCP Read 的 timeout 沒接的話預設是 25 秒。模組沒回的時候，程式會整整卡 25 秒，看起來像當機。跟 VISA 一樣，照「正常多久會回」接一個合理的值，例如 1000。</p>
<p>這也是為什麼量測儀器走網路時建議用 VISA：它替你處理了這件事。</p>`),

C.h3('第 5 步','','原始值變成電壓'),
ask('資料區有 16 個位元組，我要了 8 個通道。每個通道是幾個位元組？這告訴我什麼？',
 `<p>16 ÷ 8 ＝ 2。每個通道 2 個位元組，是一個 16 位元的整數。</p>
<p>這個除法值得做，因為同一份說明書的範例回覆是另一種樣子：要 2 個通道，資料區卻有 8 個位元組，每個通道 4 個，那是<b>浮點數</b>。不同的型號、不同的韌體版本、不同的位址區，格式可能不一樣。</p>
<p>所以不要先假設格式。先數一數實際回來幾個位元組，除以你要的通道數：2 個是整數，4 個多半是浮點數。這跟 I3 的「先看原始回覆，再決定怎麼轉」是同一件事。</p>
<p>這一頁模擬的模組，每個通道是 2 個位元組的整數。</p>`),
`<p>（以下是這個模擬模組的例子。）資料區每 2 個位元組是一個通道，高位元組在前（跟 I7 一樣）。通道 0 讀到的例如是 A0 02，合起來是 A002H ＝ 40962。</p>`,
ask('40962 是幾伏特？',
 `<p>要看這個通道的量程，和這個模組怎麼把量程對到原始值。這要查說明書的資料格式表。</p>
<p>查不到，或不確定自己看懂的時候，有一個不靠說明書的辦法，你在 I8 用過：<b>找兩個已知的點</b>。</p>
<ul><li>把輸入短路（0 V），讀一次原始值。</li><li>接一個已知的電壓（例如用電源供應器給 5.000 V，旁邊用電表確認），再讀一次。</li></ul>
<p>兩個點決定一條直線，斜率和截距就出來了。這個模擬的模組在 ±10 V 量程下，0 V 讀到的大約是 32768，不是 0。如果你以為「0 就是 0 V」，算出來的電壓會全部偏掉。</p>
<p>用已知的訊號去對，是接任何類比設備的最後一道確認。它連接線錯誤、量程設錯、通道填錯一格都抓得到。</p>`),

...I09_LV,
C.h3('第 6 步','','規劃程式：連線會斷'),
`<p>先畫不考慮斷線的版本。形狀你已經很熟了：</p>`,
flow(['TCP Open Connection（IP、502）',{loop:['組封包（交易編號＋1）','TCP Write','TCP Read 7 個','算長度','TCP Read 剩下的','比對交易編號','換算、顯示','等 1 秒'],label:'While Loop',sr:'error、交易編號'},'TCP Close Connection']),
ask('測試時把網路線拔掉再插回去。這支程式會怎樣？',
 `<p>拔掉以後，TCP Read 等不到回覆，出錯。拔線通常先看到的是逾時（錯誤 56）；模組重開機或主動斷線，看到的是對方關閉連線（錯誤 66）。兩種都一樣處理。error 進了 Shift Register，接下來每一圈的 TCP 函式都不做事，迴圈結束。</p>
<p>線插回去了，程式卻已經停了。現場的人要走過來重新按執行。對一支要跑一整天的監看程式，這不能接受。</p>`),
ask('要讓它自己恢復，需要做哪些事？',
 `<p>一件一件列出來：</p>
<ol><li>發現出錯時，<b>不要離開迴圈</b>。</li>
<li>把舊的連線關掉。它已經作廢了。</li>
<li>把 error <b>清掉</b>。不清的話，下一步的 TCP Open 看到 error in 有錯，一樣不做事。清之前先把錯誤記到紀錄裡。</li>
<li>等幾秒，重新 TCP Open Connection。</li>
<li>連上了，會得到一條<b>新的</b>連線。下一圈要用新的這一條。</li></ol>
<p>看第 5 點。I4 留下一個問題：「VISA 資源那條線要不要進 Shift Register？」當時的答案是不用，因為它不會變。現在會變了：重連以後，連線那條線上的值換成新的，而且下一圈要用。所以<b>連線的線要進 Shift Register</b>。</p>`),
ask('「有時候量測、有時候重連」，這像前面學過的什麼？',
 `<p>每一圈做的事不一樣，而且要記得現在在哪個階段。這是 I4「問題 5」的<b>狀態機</b>：Case 選這一圈做哪一步，Shift Register 記得做到哪，Enum 幫步驟取名字。</p>`),
C.table(['狀態','這一圈做什麼','下一圈去哪'],[
 ['連線','TCP Open Connection','成功 → 量測；失敗 → 等待重連'],
 ['量測','寫、讀頭、讀身體、換算、顯示','正常 → 量測；出錯 → 斷線處理；按停止 → 結束'],
 ['斷線處理','記錄錯誤、關掉舊連線、清掉 error、畫面顯示「連線中斷」','等待重連'],
 ['等待重連','等 3 秒','連線；按停止 → 結束'],
 ['結束','關閉連線','離開迴圈']
]),
`<p>Shift Register 裡現在有四樣東西：狀態、連線、error、交易編號。每一樣都能用同一句話檢查：它在迴圈裡會被改掉、而且下一圈要用改過的。</p>`,
warn('斷線時畫面上要顯示什麼','重連期間，畫面上的數值要清楚標示「這是舊的」，或直接顯示成無效。最糟的情況是：連線斷了十分鐘，畫面還停在最後一筆正常的數字，現場的人以為一切正常。'),
C.table(['','Modbus RTU（I7）','Modbus/TCP（這一課）'],[
 ['走什麼','序列埠（RS-485）','網路'],
 ['LabVIEW 函式','VISA','TCP Open、Write、Read、Close'],
 ['開始前','設定通訊參數','先連線'],
 ['封包前面','沒有','6 個位元組的標頭（交易編號、協定、長度）'],
 ['封包後面','CRC','沒有'],
 ['讀回覆','先讀 3 個，照位元組數再讀','先讀 7 個，照長度再讀（長度減 1）'],
 ['會遇到的狀況','逾時、CRC 錯','逾時、連線中斷，要重連']
]),

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'還沒連線就呼叫 TCP Write。會怎樣？',o:['出錯，什麼都送不出去','照樣送出，只是比較慢','自動連線','送到廣播位址'],a:0,ex:'網路要先連線，才有通道可以寫。'},
 {q:'接上網路設備後，最先該做的確認是？',o:['ping 它的 IP','寫一支 LabVIEW 程式','重灌驅動','把逾時設成 0'],a:0,ex:'ping 不到，線、IP、網段至少有一個不對，先不用往下試。'},
 {q:'位址表寫通道 3 在 40004。照 Modbus 的標準，封包的起始位址要填？',o:['00 03','00 04','40 04','9C 44'],a:0,ex:'去掉代表類別的 4，再從 0 開始數：40004 → 3。有些說明書的範例從 1 數，所以一定要用已知的通道驗一次。'},
 {q:'要了 2 個通道，回覆的資料區有 8 個位元組。最合理的判斷是？',o:['每個通道 4 個位元組，可能是浮點數，要查說明書的資料格式','模組壞了','多讀了 4 個，丟掉後面的','每個通道 2 個位元組，另外 4 個是 CRC'],a:0,ex:'先數位元組，再決定怎麼轉。Modbus/TCP 沒有 CRC。'},
 {q:'Modbus/TCP 的封包為什麼沒有 CRC？',o:['TCP 這一層已經保證資料正確','網路不會出錯','CRC 放在標頭裡','為了省電'],a:0,ex:'壞掉的資料 TCP 會自動重送。'},
 {q:'標頭的長度欄位是 00 05，你已經讀完 7 個位元組的標頭。還要讀幾個？',o:['4 個','5 個','7 個','12 個'],a:0,ex:'長度包含標頭最後那個站號，已經讀走了，所以減 1。'},
 {q:'做了自動重連以後，連線的那條線為什麼要進 Shift Register？',o:['重連會得到新的連線，下一圈要用新的','讓讀取變快','TCP 規定的','為了顯示在前面板'],a:0,ex:'會被改掉、而且下一圈要用改過的。'},
 {q:'重連之前為什麼要先把 error 清掉？',o:['error in 有錯時，TCP Open 不會執行','為了讓畫面乾淨','清掉才能關閉連線','不清也可以'],a:0,ex:'清之前要先把錯誤記下來。'},
 {q:'斷線十分鐘，畫面上還停著最後一筆正常的數字。問題在哪？',o:['看的人會以為一切正常；舊資料要標示成無效','沒有問題','數字太大','應該顯示 0'],a:0,ex:'顯示 0 也不對，0 可能是合理的量測值。要明確標示無效。'}
]}
]});

/* =============================== I10 =============================== */
L.push({id:'I10',order:29.95,no:'I10',part:PART,title:'把它包成自己的驅動，上線前的檢查表',mins:45,
goals:[['學會','把接入單變成四個 SubVI；每個 SubVI 該有哪些輸入輸出；儀器的錯誤怎麼變成 LabVIEW 的錯誤；上線前要故意弄壞哪些東西來測。'],['做出','一份你自己那台儀器的驅動規劃：四個 VI 的名稱、輸入、輸出。'],['為什麼','主程式不該認得「VOUT1?」這種字。它只該說「讀電壓」。這樣換一台儀器，只要換驅動。'],['動畫練習','<a href="lab-subvi.html">SubVI 實驗室</a>：接線端、必接與選接。']],
check:'你能把任何一台儀器的接入單，對應成 Initialize、Configure、Read、Close 四個 SubVI，並說出每一格接入單的內容落在哪一個 VI 裡。',
body:[
C.h3('情境','x','同一段方塊圖，你已經複製了第三次'),
`<p>測試站要讀電壓的地方有五處。你把「送 VOUT1?、讀、轉數字」那一串複製了五次。後來發現回覆要多處理一種情況，五個地方都要改，其中一個忘了。</p>`,
ask('問題出在哪？',
 `<p>「怎麼跟這台儀器講話」的知識，散在主程式的五個地方。</p>
<p>主程式關心的是測試流程：設幾伏特、等多久、讀到多少算合格。它不該知道命令的拼法、結尾字元、回覆要從第幾個字元切。這些是另一個層次的事，應該收在一個地方。</p>
<p>收起來的方法你學過：<b>SubVI</b>。一組專門跟某一台儀器講話的 SubVI，就叫這台儀器的<b>驅動</b>。</p>`),
C.h3('懂','','四個 VI，接入單的每一格都有去處'),
C.table(['SubVI','做什麼','接入單的哪幾格在這裡'],[
 ['Initialize','打開連線、設定通訊參數、確認對方是對的機型、清掉舊的錯誤','介面、通訊參數、結尾字元、逾時'],
 ['Configure','把儀器設成你要的狀態（量程、電壓、模式），並讀回確認','設定類的命令；寫入後怎麼確認'],
 ['Read','要一筆資料，轉成數值，判斷這一筆能不能用','查詢命令、回覆格式、怎麼變成數字、特別的值'],
 ['Close','把儀器放回安全的狀態，關閉連線','結束時儀器該停在什麼狀態']
]),
ask('Initialize 裡為什麼要「確認對方是對的機型」？',
 `<p>現場有五台儀器、五個 COM 埠。有人把線插錯了，你的程式對著電表送電源供應器的命令。</p>
<p>如果 Initialize 一開始就送 <code>*IDN?</code>，檢查回覆裡有沒有預期的型號，沒有就直接報錯「COM5 上不是 GPD-3303S」，接錯線在第一秒就會被發現，而不是測到一半才出現奇怪的數字。</p>
<p>第一條命令選 <code>*IDN?</code> 的理由（I2），到這裡又用了一次。</p>`),
ask('每個 SubVI 的輸入輸出要怎麼排？',
 `<p>四個 VI 會一個接一個串起來，所以要讓線能直直地穿過去：</p>
<ul><li>左上角：連線的線進來（VISA 資源、TCP 連線、DAQmx 任務）。右上角：同一條線出去。</li>
<li>左下角：error in。右下角：error out。</li>
<li>中間：這個 VI 自己的輸入（要設的電壓）和輸出（讀到的數值）。</li></ul>
<p>每一個 VI 裡面的最外層，都是「error in 有錯就什麼都不做，直接把錯誤往下傳」。這樣主程式只要看最後的 error out。</p>`),
ask('儀器回「超出範圍」，LabVIEW 的 error 線上卻沒有錯。怎麼辦？',
 `<p>對 VISA 來說，命令送出去了、回覆收到了，一切正常。「儀器不接受這個命令」是儀器的事，VISA 不知道。</p>
<p>所以驅動要負責把它<b>翻譯</b>成 LabVIEW 的錯誤：每個 VI 做完事以後，問一次儀器的錯誤狀態（電源是 <code>ERR?</code>，SCPI 儀器是 <code>SYST:ERR?</code>，Modbus 是看例外回覆）。有錯，就在 error out 上製造一個錯誤，把儀器說的話放進錯誤訊息裡。</p>
<p>製造錯誤用 ${fn('Dialog & User Interface','Error Cluster From Error Code')}：error code 接一個你自己訂的號碼，message 接儀器回的文字。LabVIEW 留了 5000 到 9999 這一段給使用者自己訂，例如 5001 代表「儀器回報錯誤」、5002 代表「機型不對」。</p>
<p>這樣主程式不用懂任何一台儀器的錯誤格式，只要看 error 線。</p>`),
tip('先找現成的','動手寫以前，先看有沒有人寫好了：LabVIEW 的 Tools ▸ Instrumentation ▸ Find Instrument Drivers，或到儀器廠商的網站找 LabVIEW driver。找到的驅動，打開來看，你會發現它裡面就是這四類 VI，做的就是這幾課的事。找不到、版本不合、或缺你要的功能時，你現在有能力自己寫。'),

...I10_LV,
C.h3('懂','','上線前：故意把它弄壞'),
`<p>程式在「一切正常」時會動，只證明了一半。另一半是：出事的時候它做了什麼。下面每一項都要親手做一次，看程式的反應是不是你要的。</p>`,
C.table(['故意做這件事','應該看到','對應哪一課'],[
 ['程式跑到一半，拔掉通訊線','在逾時的時間內發現；畫面標示資料無效；不當機','I2、I9'],
 ['線插回去','自己恢復，或明確提示要重新啟動','I9'],
 ['儀器關機再開機','同上；重新設定儀器（它開機後回到預設值了）','I4、I9'],
 ['把線插到另一台儀器','Initialize 馬上報錯：機型不對','這一課'],
 ['設一個超出範圍的值','error 線上有錯，訊息說得出是哪個值','I4、這一課'],
 ['讓量測值超出量程','顯示過載，不畫進圖、不算進平均','I3、I5'],
 ['感測器拔掉','顯示斷線，不顯示成一個假的數值','I7、I8'],
 ['按停止','儀器回到安全狀態（輸出關閉），連線關閉','I4'],
 ['程式因為錯誤結束','同上。出錯時更要關輸出','I4'],
 ['讓它連續跑一個晚上','記憶體沒有一直增加，資料沒有越來越慢','I6']
]),
ask('這張表為什麼要等到最後才做？',
 `<p>因為它測的是你的<b>程式</b>，前提是通訊本身已經沒有問題。</p>
<p>回頭看這十課的順序：先確認線和參數（講到話），再確認格式（看原始回覆），再確認換算（變成數字），然後才寫程式，最後才測壞掉的情況。每一步都站在前一步「已經確定」的東西上面。</p>
<p>這就是 I1 說的：一次只解一個未知數。</p>`),

C.h3('做','b','規劃你自己的驅動'),
{todo:[
 '先動手做一個最小的：打開 I4「版本 0」那支程式，用滑鼠把「送 IOUT1?、讀回覆、轉成數字」三個函式框起來，選 Edit ▸ Create SubVI。打開做出來的 SubVI，看 LabVIEW 幫你建了哪些輸入輸出。這就是 Read 的雛形。',
 '拿 I1 填好的那張接入單。寫下四個 VI 的名稱（建議用「儀器名＋動作」，例如 GPD Initialize）。',
 '每個 VI 列出輸入和輸出。接入單上的每一格，都要落在某一個 VI 裡。有落不進去的嗎？',
 'Read 這個 VI：列出它可能回來的每一種情況（正常、過載、不穩定、逾時…），每一種要輸出什麼。',
 'Close 這個 VI：寫下離開時要把儀器設成什麼狀態，以及出錯時這些命令要怎麼還是送得出去。',
 '照上面的表，寫下你打算怎麼把它弄壞，各預期看到什麼。'
]},

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'把儀器的操作包成驅動，最主要的好處是？',o:['跟儀器講話的細節收在一個地方，主程式只管測試流程','程式跑得比較快','不用看說明書','不用處理錯誤'],a:0,ex:'換儀器、改格式，只要動驅動。'},
 {q:'Initialize 裡送 *IDN? 並檢查型號，是為了？',o:['接錯儀器或接錯埠時，第一秒就發現','讓儀器暖機','加快通訊','清除緩衝區'],a:0,ex:'不然會測到一半才出現奇怪的數字。'},
 {q:'設了超出範圍的電壓，VISA Write 沒有回報任何錯誤。為什麼？',o:['對 VISA 來說命令已經送出，儀器接不接受它不知道','VISA 壞了','電壓其實設進去了','error 線沒接'],a:0,ex:'要由驅動去問儀器的錯誤狀態，再翻譯成 LabVIEW 的錯誤。'},
 {q:'驅動的每個 SubVI，連線的線和 error 線為什麼都要「進來又出去」？',o:['讓四個 VI 可以一個接一個串起來','規定要這樣','為了好看','這樣不用 Shift Register'],a:0,ex:'進來的在左邊，出去的在右邊，線直直穿過去。'},
 {q:'上線前「拔掉通訊線」的測試，是在確認什麼？',o:['程式在逾時內發現、標示資料無效、不當機','通訊線的品質','儀器的精度','電腦的速度'],a:0,ex:'正常時會動只證明一半。'},
 {q:'「弄壞它」的測試為什麼排在最後？',o:['它測的是程式；通訊、格式、換算要先確定沒問題','因為最不重要','因為最簡單','沒有特別原因'],a:0,ex:'一次只解一個未知數。'}
]}
]});
})();
