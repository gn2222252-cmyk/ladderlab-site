/* 第八部分：接入新儀器（I5、I6）
   I5 數位電表 Keysight 34461A：同一套問法，答案不同（SCPI、USB 與網路、量測要時間、錯誤佇列）。
   I6 電子天平 A&D FX-i：它不等你問（輸出模式、標頭、舊資料）。
   儀器事實出處：
   - Keysight Truevolt Series Operating and Service Guide（9018-03876）：*IDN? p.265；READ? p.202、p.240；MEAS:VOLT:DC? p.285；
     過載 9.9E37 p.250；SYST:ERR? p.458；LAN 埠 5024／5025 p.411、p.474。回覆的結尾字元手冊沒有寫。
   - A&D FZ-i／FX-i 使用手冊：出廠通訊設定 p.41；資料格式 p.45、p.47；RS-232C 規格 p.58；命令 p.62。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='接入新儀器';
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const vis=s=>esc(s).replace(/ /g,'<i class="cc sp">␣</i>').replace(/\r/g,'<i class="cc">\\r</i>').replace(/\n/g,'<i class="cc">\\n</i>');
const raw=s=>`<span class="rawstr">${vis(s)}</span>`;
const SIMNOTE=note('這是網頁模擬的儀器','命令和格式照說明書；說明書沒寫的地方是模擬的。接實機時請照同樣的步驟自己看一次。');
function term(opts){return d=>{
  if(window.InstSim&&InstSim.terminal){InstSim.terminal(d,opts);}
  else d.innerHTML='<div class="fig"><p>模擬儀器終端機還在製作中，完成後會出現在這裡。先照課文在紙上走一次：每個實驗先寫下你猜會看到什麼。</p></div>';
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
   LabVIEW 實作（I5、I6）。回覆是網頁模擬的（照 instsim.js 的 dmm、bal）。
   ====================================================================== */
const ctl=C.ctl,qd=C.qd,wt=C.wt,PR=['Functions','Programming'];
const addF=o=>{for(const k in o)if(!LV.F[k])LV.F[k]=o[k];};
addF({
 'Wait Until Next ms Multiple':{g:'⌚▤',ins:['millisecond multiple'],outs:['millisecond timer value'],col:'#e8f0ff',pal:[...PR,'Timing','Wait Until Next ms Multiple']},
 'Fract/Exp String To Number':{g:'1.2E→#',ins:['string','offset','default'],outs:['offset past number','number'],w:46,pal:[...PR,'String','Number/String Conversion','Fract/Exp String To Number']}
});
const NOERR={status:false,code:0,source:''};
const TMO=(vi,ms)=>({status:true,code:-1073807339,source:'VISA Read in '+vi+'（逾時：等了 '+(ms||1000)+' ms）'});
const SIMLV=note('下面的 VI 視窗是網頁模擬的','方塊圖照真的 LabVIEW 畫；按 Run 時儀器的回覆是網頁假裝的。真的儀器以你看到的為準。');

/* ---------- I05_DMM.vi：Property Node 設逾時、CONF 在迴圈外、READ? 在迴圈裡、過載亮燈 ---------- */
const DMMRES='USB0::0x2A8D::0x1301::MY53200000::INSTR';
const dmmVI={name:'I05_DMM.vi',view:'bd',
 fp:{w:360,h:330,items:[
  {id:'res',k:'visa',label:'Resource',x:16,y:16,w:320,v:DMMRES,options:[DMMRES,'TCPIP0::192.168.1.60::INSTR']},
  {id:'chart',k:'chart',label:'DC Volts（0～10 V）',x:16,y:76,w:260,h:90,min:0,max:10},
  {id:'ol',k:'led',label:'Overload',x:290,y:76,color:'red'},
  {id:'stop',k:'btn',label:'stop',text:'STOP',x:282,y:130,stop:true},
  {id:'over',k:'btn',label:'（模擬）接上超出量程的電壓',text:'超量程',mech:'switch',x:16,y:190},
  {id:'eo',k:'err',label:'error out',x:190,y:186}]},
 bd:{w:640,h:440,structs:[{id:'wl',k:'while',x:150,y:110,w:470,h:270}],
  nodes:[
  {id:'res',k:'ctl',t:'visa',label:'Resource',x:10,y:20},
  {id:'kconf',k:'const',t:'str',v:'CONF:VOLT:DC 10\\n',x:52,y:32},
  {id:'wr1',k:'fn',fn:'VISA Write',x:186,y:19},
  {id:'k3000',k:'const',t:'u32',v:3000,x:246,y:37},
  {id:'pn',k:'prop',cls:'VISA',items:[{n:'Timeout',w:true}],err:true,x:290,y:21,w:80},
  {id:'t1',k:'tunnel',t:'visa',s:'wl',side:'l',y:170},
  {id:'sre',k:'sr',t:'err',s:'wl',y:227},
  {id:'kread',k:'const',t:'str',v:'READ?\\n',x:166,y:172},
  {id:'wr',k:'fn',fn:'VISA Write',x:232,y:159},
  {id:'k100',k:'const',t:'i32',v:100,x:282,y:172},
  {id:'rd',k:'fn',fn:'VISA Read',x:318,y:159},
  {id:'kf',k:'const',t:'str',v:'%f',x:374,y:207},
  {id:'sc',k:'fn',fn:'Scan From String',x:398,y:194,h:44,ins:['input string','format string','error in'],outs:['remaining string','output 1','error out']},
  {id:'chart',k:'ind',t:'dbl',label:'DC Volts',x:560,y:206},
  {id:'k9e37',k:'const',t:'dbl',v:'9E+37',x:440,y:262},
  {id:'ge',k:'fn',fn:'Greater Or Equal?',x:490,y:250},
  {id:'ol',k:'ind',t:'bool',label:'Overload',x:540,y:254},
  {id:'k1000',k:'const',t:'u32',v:1000,x:166,y:300},
  {id:'wait',k:'fn',fn:'Wait Until Next ms Multiple',x:210,y:293},
  {id:'ub',k:'unbundle',items:['status'],x:380,y:320},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:470,y:346},
  {id:'or',k:'fn',fn:'Or',x:520,y:330},
  {id:'cond',k:'stop',s:'wl'},
  {id:'t2',k:'tunnel',t:'visa',s:'wl',side:'r',y:170},
  {id:'cl',k:'fn',fn:'VISA Close',x:500,y:396},
  {id:'seh',k:'fn',fn:'Simple Error Handler',x:560,y:402}],
  wires:[
  {id:'w1',from:'res',to:'wr1.VISA resource name',t:'visa'},
  {id:'w2',from:'kconf',to:'wr1.write buffer',t:'str'},
  {id:'w3',from:'wr1.VISA resource name out',to:'pn.reference',t:'visa'},
  {id:'w4',from:'wr1.error out',to:'pn.error in',t:'err',mx:238},
  {id:'w5',from:'k3000',to:'pn.Timeout',t:'u32'},
  {id:'w6',from:'pn.reference out',to:'t1.o',t:'visa',pts:[[390,30],[390,98],[128,98],[128,170]]},
  {id:'w7',from:'pn.error out',to:'sre.init',t:'err',pts:[[380,61],[380,90],[120,90],[120,227]]},
  {id:'w8',from:'t1.i',to:'wr.VISA resource name',t:'visa'},
  {id:'w9',from:'kread',to:'wr.write buffer',t:'str'},
  {id:'w10',from:'sre.L',to:'wr.error in',t:'err',mx:229},
  {id:'w11',from:'wr.VISA resource name out',to:'rd.VISA resource name',t:'visa'},
  {id:'w12',from:'wr.error out',to:'rd.error in',t:'err'},
  {id:'w13',from:'k100',to:'rd.byte count',t:'i32'},
  {id:'w14',from:'rd.read buffer',to:'sc.input string',t:'str',mx:382},
  {id:'w15',from:'rd.error out',to:'sc.error in',t:'err',mx:370},
  {id:'w16',from:'kf',to:'sc.format string',t:'str'},
  {id:'w17',from:'rd.VISA resource name out',to:'t2.i',t:'visa'},
  {id:'w18',from:'sc.error out',to:'sre.R',t:'err'},
  {id:'w19',from:'sc.output 1',to:'chart',t:'dbl'},
  {id:'w20',from:'sc.output 1',to:'ge.x',t:'dbl',pts:[[460,216],[460,257]]},
  {id:'w21',from:'k9e37',to:'ge.y',t:'dbl'},
  {id:'w22',from:'ge.out',to:'ol',t:'bool'},
  {id:'w23',from:'k1000',to:'wait',t:'u32'},
  {id:'w24',from:'sc.error out',to:'ub.input cluster',t:'err',pts:[[450,227],[450,240],[370,240],[370,334]]},
  {id:'w25',from:'ub.status',to:'or.x',t:'bool',mx:490},
  {id:'w26',from:'stop',to:'or.y',t:'bool',mx:513},
  {id:'w27',from:'or.out',to:'cond',t:'bool',mx:568},
  {id:'w28',from:'t2.o',to:'cl.VISA resource name',t:'visa',pts:[[636,170],[636,394],[490,394],[490,411]]},
  {id:'w29',from:'sre.out',to:'cl.error in',t:'err',pts:[[630,227],[630,388],[484,388],[484,425]]},
  {id:'w30',from:'cl.error out',to:'seh.error in',t:'err'}]},
 sim:{period:300,init(){return {hist:[]};},step(i,st,ctx){
  const n=ctx.i,over=!!i.over,v=over?9.9e37:+(5.0012+0.0004*Math.sin(n*1.3)).toFixed(4);
  const ex=v.toExponential(8).split('e'),s=over?'+9.90000000E+37\n':'+'+ex[0]+'E'+(ex[1][0]==='-'?'-':'+')+ex[1].replace(/[+-]/,'').padStart(2,'0')+'\n';
  st.hist.push(v);const stp=!!i.stop;
  return {out:{chart:st.hist.slice(),ol:over,eo:NOERR},stop:stp,msg:stp?'按了 STOP：離開迴圈，VISA Close':over?'讀到 9.9E37：Overload 亮了。Chart 也被畫上去，Y 軸被撐爆（下面「問自己」要你修掉它）':'第 '+n+' 圈：READ? → '+s.trim()+' → '+v+' V（網頁加快成 0.3 秒一圈；真的 VI 是 1 秒）',
   vals:{res:i.res,kconf:'CONF:VOLT:DC 10\n',k3000:3000,kread:'READ?\n',k100:100,kf:'%f',k9e37:9e37,k1000:1000,'rd.read buffer':s,'sc.output 1':v,'ge.out':over,'sc.error out':NOERR,'ub.status':false,stop:stp,'or.out':stp}};
 },doneMsg:'迴圈結束，VISA Close'}
};
const I05_LV=[
C.h3('LabVIEW','b','動手寫：I05_DMM.vi（照上面的規劃圖，跟 I04 比只改三處）'),
`<p>骨架直接拿 I04_Monitor.vi 來改。先在紙上圈出「跟電源那台不一樣」的地方：沒有序列埠設定、多一個量測設定 CONF、逾時要另外設、多一個過載判斷。其他照舊。</p>`,
C.plan({
 start:'打開 <code>I04_Monitor.vi</code>，Save As ▸ Copy 存成 <code>練習\\儀器\\I05_DMM.vi</code>。把 VISA Configure Serial Port 刪掉：USB 儀器沒有鮑率可以設。',
 in:'迴圈裡每圈送 <code>READ?\\n</code>，VISA Read 讀回例如 <code>+8.54530000E+01\\n</code>（字串，科學記號，單位 V）。量程 10 V；超出量程時回 <code>+9.90000000E+37</code>。',
 calc:'Scan From String（%f）認得科學記號，轉成 DBL。再用 Greater Or Equal? 跟 9E+37 比：大於等於就是過載，不是電壓。',
 out:'Waveform Chart <code>DC Volts</code>（Y 軸 0～10）；紅色 LED <code>Overload</code>。',
 loop:'While Loop，一圈 1 秒：用 Wait Until Next ms Multiple 接 1000，每次都對齊到整秒。逾時用 Property Node 設成 3000 ms：照你的量測設定在終端機量一次最慢多久回，留幾倍餘裕（這裡假設量到約 1 秒）。',
 end:'跟 I04 一樣：STOP 或出錯就停；error 進 Shift Register；迴圈後 VISA Close、Simple Error Handler。'}),
SIMLV,
{steps:{title:'I05_DMM.vi：拿 I04 來改',lv:dmmVI,steps:[
 {t:'前面板：資源名稱換成 USB 的',view:'fp',add:['res','chart','ol','stop','eo','over'],h:`<p>Resource 下拉選電表的 USB 資源（NI MAX 看得到，例：<code>${DMMRES}</code>）。Current (A) 刪掉，Chart 改名 <code>DC Volts</code>、Y 軸 0～10。加 ${ctl('Modern','Boolean','Round LED')}，標籤 <code>Overload</code>，右鍵 Properties 把 On 的顏色改紅色。</p>`},
 {t:'迴圈外：先送 CONF，再用 Property Node 設逾時',view:'bd',add:['res','kconf','wr1','k3000','pn','w1','w2','w3','w4','w5'],h:`<p>VISA Configure Serial Port 刪掉，在原位置放一個 VISA Write，write buffer 接常數（'\\' Codes Display）<code>CONF:VOLT:DC 10\\n</code>。這是規劃圖上「設定一次就好」的那一條。</p>
<p>接著在紫線上 <b>右鍵 ▸ Create ▸ Property Node ▸ General Settings ▸ Timeout</b>，在 Property Node 上右鍵 <b>Change All To Write</b>，Timeout 接常數 <code>3000</code>（單位 ms）。</p>${wt([
 ['Resource','VISA Write 的 VISA resource name','USB 儀器不用 Configure；第一次用到時 VISA 會自己開'],
 ['VISA Write 的 VISA resource name out','Property Node 的 reference'],
 ['VISA Write 的 error out','Property Node 的 error in'],
 ['常數 3000','Property Node 的 Timeout','照「這個量測設定多久回」來設']])}`},
 {t:'穿進迴圈：命令換成 READ?',view:'bd',add:['wl','t1','sre','kread','wr','k100','rd','kf','sc','t2','w6','w7','w8','w9','w10','w11','w12','w13','w14','w15','w16','w17','w18'],h:`<p>Property Node 的兩個輸出接到迴圈左邊的 VISA Tunnel 和 error Shift Register（線繞到迴圈上方再下來）。迴圈裡的 VISA Write 常數改成 <code>READ?\\n</code>：量測設定已經在迴圈外送過，每圈只要「量一筆、讀回來」。</p><p>VISA Read、Scan From String（%f）跟 I04 一樣，不用動。</p>`},
 {t:'Chart 和過載判斷',view:'bd',add:['chart','k9e37','ge','ol','w19','w20','w21','w22'],h:`<p>放 ${fn('Programming','Comparison','Greater Or Equal?')} ${qd('Greater Or Equal')}。y 輸入 Create ▸ Constant，輸入 <code>9E+37</code>（DBL 常數可以直接打科學記號）。</p>${wt([
 ['Scan From String 的 output 1','DC Volts（Chart）'],
 ['同一條線分岔','Greater Or Equal? 的 x'],
 ['常數 9E+37','Greater Or Equal? 的 y','電表說 9.9E37 代表過載；比它小一點的門檻就好'],
 ['Greater Or Equal? 的 x &gt;= y?','Overload']])}`},
 {t:'一圈 1 秒：Wait Until Next ms Multiple',view:'bd',add:['k1000','wait','w23'],h:`<p>Wait (ms) 換成 ${fn('Programming','Timing','Wait Until Next ms Multiple')} ${qd('Wait Until Next')}，接 <code>1000</code>：等到電腦時鐘的下一個「1000 的倍數」毫秒。READ? 本身花了幾百毫秒也沒關係，每一筆還是落在整秒上，趨勢圖的時間間隔一致。</p>`},
 {t:'停止條件、Close：跟 I04 一樣',view:'bd',add:['ub','stop','or','cond','cl','seh','w24','w25','w26','w27','w28','w29','w30'],h:`<p>Unbundle By Name（status）、Or、stop、VISA Close、Simple Error Handler 都從 I04 留下來，只是位置挪了。</p><p class="qd">圖上 Close 放在迴圈下方，線繞過去；接法跟 I04 一模一樣。</p>`},
 {t:'Run，再接一個超出量程的電壓',view:'split',add:[],h:`<p>Run：每秒一點，大約 5 V（模擬加快成 0.3 秒一點）。按「超量程」：Overload 亮了，可是 Chart 也收到了 9.9E37，畫面整個被撐壞。下面的問題要你修。</p>`}
]}},
ask('改一個數字，先預測結果：想讓過載的點「不畫上 Chart」，在 Chart 前面放一個 Select：s 接 Overload 的布林、t 接常數 NaN、f 接量到的電壓。Chart 上會看到什麼？',
 `<p>過載的那幾秒，Chart 上是一段<b>空白</b>：Waveform Chart 遇到 NaN（Not a Number）不畫那一點，線斷開，Y 軸也不會被撐爆。接回正常電壓，線又接著畫。</p>
<p>這就是規劃圖上的 Case「大於 9E37：不畫上圖表，亮過載燈」。只有「換一個值」這麼簡單時，用 Select 比整個 Case 結構清楚；要多做幾件事（記錄次數、寫檔）時再換成 Case。NaN 常數：放一個 DBL 常數，直接打 <code>NaN</code>。</p>`)
];

/* ---------- I06_Balance.vi：送 Q、切標頭和重量、上一筆是 US 這一筆是 ST 才記一筆 ---------- */
const balVI={name:'I06_Balance.vi',view:'bd',
 fp:{w:380,h:300,items:[
  {id:'res',k:'visa',label:'Resource',x:16,y:16,w:170,v:'COM6',options:['COM6','COM3','COM4']},
  {id:'stop',k:'btn',label:'stop',text:'STOP',x:220,y:20,stop:true},
  {id:'hdr',k:'str',label:'Header',x:16,y:76,w:70},
  {id:'wt',k:'num',label:'Weight (g)',x:110,y:76,w:110,dig:2},
  {id:'rec',k:'led',label:'Record（剛剛變成 ST）',x:240,y:76,color:'yel'},
  {id:'part',k:'btn',label:'（模擬）放上零件／拿走',text:'放上',mech:'switch',x:16,y:136},
  {id:'eo',k:'err',label:'error out',x:200,y:130}]},
 bd:{w:640,h:330,structs:[{id:'wl',k:'while',x:196,y:10,w:420,h:310}],
  nodes:[
  {id:'res',k:'ctl',t:'visa',label:'Resource',x:16,y:39},
  {id:'k1000',k:'const',t:'u32',v:1000,x:60,y:59},
  {id:'k2400',k:'const',t:'u32',v:2400,x:60,y:78},
  {id:'k7',k:'const',t:'u8',v:7,x:76,y:96},
  {id:'kev',k:'const',t:'enum',v:'Even',x:60,y:115},
  {id:'cfg',k:'fn',fn:'VISA Configure Serial Port',x:106,y:30,h:132,ins:['VISA resource name','timeout','baud rate','data bits','parity','error in']},
  {id:'kE',k:'const',t:'str',v:'',x:150,y:231},
  {id:'t1',k:'tunnel',t:'visa',s:'wl',side:'l',y:74},
  {id:'sre',k:'sr',t:'err',s:'wl',y:200},
  {id:'srh',k:'sr',t:'str',s:'wl',y:240},
  {id:'kq',k:'const',t:'str',v:'Q\\r\\n',x:210,y:76},
  {id:'wr',k:'fn',fn:'VISA Write',x:262,y:63},
  {id:'k100',k:'const',t:'i32',v:100,x:310,y:76},
  {id:'rd',k:'fn',fn:'VISA Read',x:346,y:63},
  {id:'k0',k:'const',t:'i32',v:0,x:404,y:94},
  {id:'k2',k:'const',t:'i32',v:2,x:404,y:112},
  {id:'ss',k:'fn',fn:'String Subset',x:430,y:67,h:72},
  {id:'k3',k:'const',t:'i32',v:3,x:404,y:163},
  {id:'fx',k:'fn',fn:'Fract/Exp String To Number',x:430,y:148},
  {id:'hdr',k:'ind',t:'str',label:'Header',x:520,y:93},
  {id:'wt',k:'ind',t:'dbl',label:'Weight (g)',x:520,y:169},
  {id:'kUS',k:'const',t:'str',v:'US',x:204,y:245},
  {id:'eq2',k:'fn',fn:'Equal?',x:230,y:233},
  {id:'kw',k:'const',t:'i32',v:100,x:290,y:242},
  {id:'wait',k:'fn',fn:'Wait (ms)',x:330,y:235},
  {id:'kST',k:'const',t:'str',v:'ST',x:470,y:255},
  {id:'eq1',k:'fn',fn:'Equal?',x:500,y:243},
  {id:'and',k:'fn',fn:'And',x:545,y:207},
  {id:'rec',k:'ind',t:'bool',label:'Record',x:578,y:211},
  {id:'ub',k:'unbundle',items:['status'],x:404,y:280},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:505,y:286},
  {id:'or',k:'fn',fn:'Or',x:548,y:289},
  {id:'cond',k:'stop',s:'wl'},
  {id:'t2',k:'tunnel',t:'visa',s:'wl',side:'r',y:74}],
  wires:[
  {id:'w1',from:'res',to:'cfg.VISA resource name',t:'visa'},
  {id:'w2',from:'k1000',to:'cfg.timeout',t:'u32'},
  {id:'w3',from:'k2400',to:'cfg.baud rate',t:'u32'},
  {id:'w4',from:'k7',to:'cfg.data bits',t:'u8'},
  {id:'w5',from:'kev',to:'cfg.parity',t:'enum'},
  {id:'w6',from:'cfg.VISA resource name out',to:'t1.o',t:'visa'},
  {id:'w7',from:'cfg.error out',to:'sre.init',t:'err',mx:170},
  {id:'w8',from:'kE',to:'srh.init',t:'str'},
  {id:'w9',from:'t1.i',to:'wr.VISA resource name',t:'visa'},
  {id:'w10',from:'kq',to:'wr.write buffer',t:'str'},
  {id:'w11',from:'sre.L',to:'wr.error in',t:'err',mx:257},
  {id:'w12',from:'wr.VISA resource name out',to:'rd.VISA resource name',t:'visa'},
  {id:'w13',from:'wr.error out',to:'rd.error in',t:'err'},
  {id:'w14',from:'k100',to:'rd.byte count',t:'i32'},
  {id:'w15',from:'rd.VISA resource name out',to:'t2.i',t:'visa'},
  {id:'w16',from:'rd.read buffer',to:'ss.string',t:'str'},
  {id:'w17',from:'k0',to:'ss.offset',t:'i32'},
  {id:'w18',from:'k2',to:'ss.length',t:'i32'},
  {id:'w19',from:'rd.read buffer',to:'fx.string',t:'str',pts:[[400,85],[400,160]]},
  {id:'w20',from:'k3',to:'fx.offset',t:'i32'},
  {id:'w21',from:'ss.substring',to:'hdr',t:'str'},
  {id:'w22',from:'fx.number',to:'wt',t:'dbl'},
  {id:'w23',from:'rd.error out',to:'sre.R',t:'err',pts:[[394,96],[394,200]]},
  {id:'w24',from:'ss.substring',to:'srh.R',t:'str',pts:[[490,103],[490,240]]},
  {id:'w25',from:'srh.L',to:'eq2.x',t:'str'},
  {id:'w26',from:'kUS',to:'eq2.y',t:'str'},
  {id:'w27',from:'ss.substring',to:'eq1.x',t:'str',pts:[[490,103],[490,250]]},
  {id:'w28',from:'kST',to:'eq1.y',t:'str'},
  {id:'w29',from:'eq1.out',to:'and.y',t:'bool',mx:536},
  {id:'w30',from:'eq2.out',to:'and.x',t:'bool',pts:[[266,247],[266,214]]},
  {id:'w31',from:'and.out',to:'rec',t:'bool'},
  {id:'w32',from:'kw',to:'wait',t:'i32'},
  {id:'w33',from:'rd.error out',to:'ub.input cluster',t:'err',pts:[[394,96],[394,294]]},
  {id:'w34',from:'ub.status',to:'or.y',t:'bool',pts:[[496,294],[496,314],[544,314],[544,310]]},
  {id:'w35',from:'stop',to:'or.x',t:'bool'},
  {id:'w36',from:'or.out',to:'cond',t:'bool',mx:580}]},
 sim:{period:250,init(){return {prev:'',g:0,on:false,t:0};},step(i,st,ctx){
  const want=i.part?12.34:0;
  if(Math.abs(st.g-want)>0.004){st.g+= (want-st.g)*0.55;st.t=0;}else{st.g=want;st.t++;}
  const stable=Math.abs(st.g-want)<0.01&&st.t>=1,hdr=stable?'ST':'US';
  const w=+st.g.toFixed(2),line=hdr+','+(w<0?'-':'+')+Math.abs(w).toFixed(2).padStart(8,'0')+'  g\r\n';
  const rec=st.prev==='US'&&hdr==='ST';st.prev=hdr;const stp=!!i.stop;
  return {out:{hdr,wt:w,rec,eo:NOERR},stop:stp,msg:stp?'按了 STOP':(rec?'上一筆 US、這一筆 ST：記一筆 '+w+' g':'讀到 '+line.replace('\r\n','\\r\\n')+(hdr==='ST'?'：穩定，但上一筆也是 ST，不再記':'：還在晃，只顯示')),
   vals:{res:i.res,k1000:1000,k2400:2400,k7:7,kev:'Even',kq:'Q\r\n',k100:100,k0:0,k2:2,k3:3,kUS:'US',kST:'ST',kw:100,kE:'','rd.read buffer':line,'ss.substring':hdr,'fx.number':w,'srh.L':st.prev,'eq1.out':hdr==='ST','and.out':rec,'rd.error out':NOERR,'ub.status':false,stop:stp,'or.out':stp}};
 },doneMsg:'迴圈結束'}
};
const I06_LV=[
C.h3('LabVIEW','b','動手寫：I06_Balance.vi（命令模式：送 Q、切開、只在剛變穩定時記一筆）'),
`<p>照上面的規劃圖，先做「命令模式」：一問一答，跟電源同一種骨架。新的東西只有三樣：用位置切字串、比對標頭、用 Shift Register 記住上一筆的標頭。</p>`,
C.plan({
 start:'打開 <code>I04_Monitor.vi</code>，Save As ▸ Copy 存成 <code>練習\\儀器\\I06_Balance.vi</code>。Scan From String 刪掉，這台的數字不在開頭。',
 in:'每圈送 <code>Q\\r\\n</code>（命令也要加 CR LF），VISA Read 讀回一筆 17 個字元，例：<code>ST,+00001.27␣␣g\\r\\n</code>。重量單位 g。',
 calc:'String Subset（offset 0、length 2）切出標頭 <code>ST</code>。Fract/Exp String To Number（offset 3）讀出 1.27：讀到空白就停，單位不影響。標頭用 Equal? 比字串：這一筆是 "ST" <b>而且</b>上一筆是 "US"，才是「剛剛變穩定」。',
 out:'字串指示器 <code>Header</code>、數值 <code>Weight (g)</code>（2 位小數）、LED <code>Record</code>（剛變穩定那一圈亮一次）。',
 loop:'While Loop，Wait 100 ms：天平回一筆很快，零件放上去到穩定要零點幾秒，一秒看 10 次夠細。',
 end:'跟 I04 一樣：STOP 或出錯就停，error 進 Shift Register。另外一個 Shift Register 存「上一筆的標頭」，初始值是空字串。'}),
SIMLV,
{steps:{title:'I06_Balance.vi：切標頭、比上一筆',lv:balVI,steps:[
 {t:'前面板',view:'fp',add:['res','stop','hdr','wt','rec','eo','part'],h:`<p>Resource 選 USB 轉 RS-232 線的 COM 埠。放 String Indicator <code>Header</code>、Numeric Indicator <code>Weight (g)</code>、${ctl('Modern','Boolean','Square LED')} <code>Record</code>。</p>`},
 {t:'序列埠參數改成天平的',view:'bd',add:['res','k1000','k2400','k7','kev','cfg','w1','w2','w3','w4','w5'],h:`<p>VISA Configure Serial Port 的常數照接入單改：baud rate <code>2400</code>、data bits <code>7</code>、parity <code>Even</code>、timeout <code>1000</code>。stop bits 沒接，預設就是 1.0。</p><p>termination char 也沒接：預設 \\n，回覆最後是 CR LF，最後一個字元正是 \\n。</p>`},
 {t:'迴圈：送 Q\\r\\n、讀一筆',view:'bd',add:['wl','t1','sre','kq','wr','k100','rd','t2','w6','w7','w9','w10','w11','w12','w13','w14','w15','w23'],h:`<p>Write 的常數改成 <code>Q\\r\\n</code>（'\\' Codes Display）。Read 一樣 100。</p><p class="qd">圖上沒有畫迴圈右邊外面的 VISA Close、Simple Error Handler：跟 I04 一模一樣。這張圖 error 線從 Read 直接回 Shift Register：String Subset 和 Fract/Exp 沒有 error 端子。</p>`},
 {t:'用位置切：String Subset、Fract/Exp',view:'bd',add:['k0','k2','ss','k3','fx','hdr','wt','w16','w17','w18','w19','w20','w21','w22'],h:`<p>${fn('Programming','String','String Subset')} ${qd('String Subset')}：offset <code>0</code>、length <code>2</code>。</p>
<p>${fn('Programming','String','Number/String Conversion','Fract/Exp String To Number')} ${qd('Fract/Exp')}：offset <code>3</code>（跳過「ST,」三個字元）。</p>${wt([
 ['VISA Read 的 read buffer','String Subset 的 string'],
 ['read buffer 分岔','Fract/Exp String To Number 的 string'],
 ['String Subset 的 substring','Header'],
 ['Fract/Exp 的 number','Weight (g)','DBL']])}`},
 {t:'上一筆的標頭：再加一個 Shift Register',view:'bd',add:['kE','srh','w8','w24','kUS','eq2','w25','w26'],h:`<p>在迴圈左邊框上右鍵 ▸ <b>Add Shift Register</b>。左邊外面接一個空字串常數當初始值（第一圈沒有「上一筆」）。</p>${wt([
 ['String Subset 的 substring','Shift Register 右邊','這一筆的標頭，存給下一圈'],
 ['Shift Register 左邊（迴圈內）','Equal? 的 x','上一筆的標頭'],
 ['常數 "US"','Equal? 的 y','上一筆還在晃嗎？']])}
<p>${fn('Programming','Comparison','Equal?')} 可以直接比兩個字串。</p>`},
 {t:'這一筆是 ST，而且上一筆是 US',view:'bd',add:['kST','eq1','and','rec','w27','w28','w29','w30','w31'],h:`<p>再放一個 Equal?：substring 跟常數 <code>"ST"</code> 比。兩個結果接 ${fn('Programming','Boolean','And')} ${qd('And')}，輸出接 Record。</p><p>這就是 PLC 課的上升緣：只有「從 US 變成 ST」的那一圈是 True。</p>`},
 {t:'Wait、停止條件；Run',view:'split',add:['kw','wait','ub','stop','or','cond','w32','w33','w34','w35','w36'],h:`<p>Wait (ms) 接 <code>100</code>；Unbundle By Name、Or、stop 跟 I04 一樣。</p><p>Run，按「放上」：Header 先是 US，穩定後變 ST，Record 只亮<b>一次</b>。零件一直放著，Record 不再亮。按一下變「拿走」，再放上，又亮一次。</p>`}
]}},
ask('改一個數字，先預測結果：把常數 "US" 改成 "ST"（變成「上一筆是 ST、這一筆也是 ST」才記錄）。零件放著不動 5 秒，Record 會亮幾次？',
 `<p>大約 <b>50 次</b>：一圈 100 ms，穩定以後每一圈都符合條件，每一圈都記一筆。這就是上面「問自己」說的「同一個零件被記了十幾次」，只是現在讀得更快。</p>
<p>反過來想：要「剛剛變成」，就一定要比較「不一樣」的兩筆。上升緣的條件永遠是「上一次是 A、這一次是 B」，A 和 B 不能一樣。</p>`)
];

/* =============================== I5 =============================== */
L.push({id:'I05',order:29.5,no:'I5',part:PART,title:'數位電表：同一套問法，答案不同',mins:55,
goals:[['學會','讀懂 SCPI 命令表的寫法；USB 和網路怎麼選；量測要花時間時逾時怎麼設；怎麼問儀器「剛才哪裡錯了」。'],['做出','一張電表的接入單和程式規劃圖，並說出它跟電源那台哪裡不同、為什麼不同。'],['為什麼','第二台儀器最能看出方法有沒有學到：照同樣的順序問，得到不同的答案，畫出不同的程式。']].concat(window.InstSim?[['網頁練習','<a href="instlab.html">儀器接入練習台</a> 選「數位電表」。']]:[]),
check:'你能指出電表的程式和電源的程式有哪三個地方不一樣，每一個都對應到接入單上哪一格的答案不同。',
body:[
C.h3('情境','x','第二台：Keysight 34461A 數位電表'),
`<p>任務：每秒讀一次直流電壓，畫成趨勢圖。</p>
<p>這一課不會再從頭解釋每一步。你照 I1 的六步自己走，課文只在<b>答案跟上一台不一樣</b>的地方停下來。</p>`,

C.h3('第 1 步','','看背板'),
`<p>背板有 USB 和網路孔。兩個都能用。</p>`,
ask('兩種都能接，選哪一種？',
 `<p>先分清楚這個選擇會影響什麼。</p>
<p>它<b>不影響程式</b>。這台是量測儀器，USB 和網路講的是同一套 SCPI 命令，都用 VISA，方塊圖一模一樣，只有資源名稱不同。</p>
<p>它影響的是<b>現場</b>：</p>
<ul><li>電表就在電腦旁邊、只有一兩台：USB。插上去，NI MAX 就找得到，不用設定網路。</li>
<li>電表在機櫃裡、離電腦遠、或有很多台：網路。USB 線不能拉太長，網路可以。</li></ul>
<p>所以這一題的答案是「看現場」。重點是你知道它不會讓你重寫程式，因此可以先用 USB 把程式寫好，之後要改網路再改資源名稱。</p>`),
ask('接入單上「通訊參數」那一格，這台要填什麼？',
 `<p>電源那台填的是鮑率、資料位元、同位、停止位元。這台<b>沒有這些東西可以填</b>。</p>
<p>鮑率那一組是序列埠才有的。USB 儀器和網路儀器不用設，所以也不需要 VISA Configure Serial Port，直接用 VISA Open（或把資源名稱直接接給 VISA Write）就可以。</p>
<p>走網路的話，這一格填的是 IP 位址。它在電表面板的網路設定選單裡看得到。</p>`),

C.h3('第 2 步','','讀懂 SCPI 命令表'),
`<p>這台的說明書很厚，通訊部分叫 SCPI Programming Reference。命令表上的寫法長這樣：</p>
<p style="font:700 18px var(--mono)">MEASure[:VOLTage]:{AC|DC}? [{&lt;range&gt;|AUTO|MIN|MAX|DEF} [, {&lt;resolution&gt;|MIN|MAX|DEF}]]</p>
<p>先自己猜：要量直流電壓，下面四種寫法，哪幾種電表會接受？</p>
<p><code>MEAS:VOLT:DC?</code>　<code>MEAS:DC?</code>　<code>MEA:VOL:DC?</code>　<code>MEAS:VOLT:DC? 10</code></p>`,
ask('這一串符號，哪些要打、哪些不用？',
 `<p>SCPI 的命令表有固定的讀法。學一次，以後幾乎每一台量測儀器都通用：</p>
${C.table(['寫法','意思','這一條的例子'],[
 ['大寫字母','一定要打的部分','<code>MEAS</code>、<code>VOLT</code>、<code>DC</code>'],
 ['小寫字母','可以省略','<code>MEASure</code> 打成 <code>MEAS</code> 就可以，但不能再短'],
 ['冒號 :','往下一層','量測 → 電壓 → 直流'],
 ['問號 ?','這是查詢，儀器會回覆','沒有問號的命令不會回'],
 ['中括號 [ ]','整段可以不寫','<code>[:VOLTage]</code> 可以省；後面的範圍和解析度也可以不給'],
 ['大括號 { } 和直線 |','從裡面選一個','<code>{AC|DC}</code> 選 DC；AUTO、MIN、MAX、DEF 選一'],
 ['角括號 &lt; &gt;','換成你的數值','<code>&lt;range&gt;</code> 換成 10']
])}
<p>所以四種寫法裡，<code>MEAS:VOLT:DC?</code>、<code>MEAS:DC?</code>、<code>MEAS:VOLT:DC? 10</code> 都可以；<code>MEA:VOL:DC?</code> 不行，大寫的部分沒打完整。這一課統一寫 <code>MEAS:VOLT:DC?</code>，最容易看懂。</p>`),
C.table(['接入單','說明書寫的','還不知道的'],[
 ['誰先開口','電腦問才回','—'],
 ['命令','SCPI。量電壓：<code>MEAS:VOLT:DC?</code>','—'],
 ['回覆','範例：<code>+8.54530000E+01</code>。多筆時用逗號隔開','結尾字元，說明書沒寫'],
 ['超出範圍時','回 <code>9.9E37</code>','—'],
 ['怎麼知道出錯','送 <code>SYST:ERR?</code>。沒錯回 <code>+0,"No error"</code>','—'],
 ['走網路時的埠號','5025 是 SCPI Socket；5024 是 Telnet','—'],
 ['回一次要多久','看量測設定，可以從很快到一秒多','實際多久，要自己量']
]),

C.h3('第 3、4 步','','講到話，看原始回覆'),
SIMNOTE,
{fn:term({inst:'dmm',presets:['*IDN?','MEAS:VOLT:DC?','CONF:VOLT:DC 10','READ?','SYST:ERR?','MEAS:VOLT:CD?'],showHex:true})},
{todo:[
 '送 <code>*IDN?</code>。回覆有四段，用逗號隔開。哪一段是型號？',
 '送 <code>MEAS:VOLT:DC?</code>。看回覆的結尾是哪個字元。這就是接入單上那一格的答案。',
 '故意送一條打錯的：<code>MEAS:VOLT:CD?</code>。等到逾時。然後送 <code>SYST:ERR?</code>，看電表說什麼。',
 '再送一次 <code>SYST:ERR?</code>。這次回什麼？',
 '把上面的「怎麼接」從 USB 換成網路線，按連線，再送一次 <code>*IDN?</code>。命令需要改嗎？'
]},
ask('打錯的命令為什麼是逾時，而不是馬上回一個錯誤訊息？',
 `<p>因為 SCPI 儀器<b>不會主動報錯</b>。它看不懂你的命令，就不回覆，只把錯誤記進自己的「錯誤佇列」，面板上亮一個 Error 燈。</p>
<p>你要知道哪裡錯，得主動去問：<code>SYST:ERR?</code>。它回 <code>-113,"Undefined header"</code>，意思是「這個命令我不認得」。</p>
<p>第二次問，回 <code>+0,"No error"</code>。因為錯誤被讀走就清掉了。佇列裡可能有好幾筆（這台最多存 20 筆），先發生的先讀到。</p>
<p>還有一個說明書上的細節會騙到人：<b>每一條連線各有自己的錯誤佇列</b>。你在 NI MAX 打錯的命令，錯誤記在 NI MAX 那條連線上；換到 LabVIEW 去問 <code>SYST:ERR?</code>，只會得到「沒有錯誤」。要問，就在出錯的那一條連線上問。</p>`),
ask('錯誤可能不只一筆。要讀幾次？',
 `<p>不知道幾次，要一直讀到看見 <code>+0</code> 為止。</p>
<p>「不知道要做幾次，做到某個條件成立為止」，這句話你聽過：<b>While Loop</b>。這是迴圈在儀器程式裡的第二種用途。第一種是「一直量」，這一種是「讀到沒有為止」。</p>
<p>回覆的格式是「數字、逗號、帶引號的字串」。逗號前面的數字用 Scan From String 的 <code>%d</code> 讀出來，是 0 就離開迴圈。</p>`),

C.h3('第 5 步','','把回覆變成數字'),
`<p>回覆 ${raw('+8.54530000E+01\n')} 是科學記號，上一課轉過了：85.453 V。過載時的 <code>9.9E37</code> 要用 Case 另外處理，也講過了。</p>`,
ask('一次要讀十筆呢？',
 `<p>電表可以一次量很多筆再一起回，回覆會是用逗號隔開的一長串：</p>
<p>${raw('-4.98748741E-01,-4.35163427E-01,-4.10112221E-01\n')}</p>
<p>這不是一個數字，是好幾個。要的型別變成 <b>DBL 的一維陣列</b>。用 ${fn('String','Spreadsheet String To Array')}，分隔符號接逗號，格式接 <code>%f</code>，一次就轉成陣列。它預設給的是二維陣列；要一維的，把一個空的一維 DBL 陣列常數接到 array type 輸入端。</p>
<p>注意這裡的想法：先決定「我要的型別是什麼」，再去找函式。不是先想到某個函式再硬套。</p>`),

C.h3('第 6 步','','規劃程式：跟電源那台哪裡不同'),
`<p>骨架一樣：迴圈外打開，迴圈內問、讀、轉、顯示，迴圈外關閉，error 進 Shift Register。現在用同一套問法，看答案不同的地方。</p>`,
ask('「這件事每一次都要做嗎？」——MEAS:VOLT:DC? 每一圈都送，有沒有問題？',
 `<p>說明書說，<code>MEAS?</code> 其實是兩件事合在一起：先「設定量測」（CONFigure），再「量一筆並讀回」（READ?）。</p>
<p>設定量測需要每一次都做嗎？不用。量直流電壓、10 V 量程，這些設一次就不會變。</p>
<p>所以拆開：迴圈外送一次 <code>CONF:VOLT:DC 10</code>，迴圈內只送 <code>READ?</code>。每一圈少做一件事，量得比較快，也不會每圈把你另外調過的設定蓋掉。</p>
<p>這跟「序列埠在迴圈外開」是同一個判斷，只是對象從 LabVIEW 的函式換成了儀器的命令。</p>`),
flow(['VISA Open','送 CONF:VOLT:DC 10',{loop:['送 READ?','讀回覆','轉成數字',{kase:['不畫上圖表，亮過載燈'],label:'大於 9E37'},'畫到圖表','等到滿 1 秒'],label:'While Loop',sr:'error'},'VISA Close','顯示錯誤']),
ask('「儀器多久回一筆？」——逾時還是設 1 秒嗎？',
 `<p>電源那台最慢的命令也在 0.4 秒內回，設 1 秒很寬裕。這台不一樣：<b>量測本身要花時間</b>。</p>
<p>電表為了量得準，會把訊號平均一段時間。這段時間可以設定，設得越長越準、也越慢。設成最精準的那一檔，一筆要一秒多。這時候逾時設 1 秒，每一筆都會逾時，可是儀器明明沒壞。</p>
<p>所以這一格不能抄上一台的數字。做法是：照你要用的量測設定，在終端機實際量一次，看它多久回；逾時設成那個時間的幾倍。之後如果改了量測設定，逾時要跟著改。</p>`),
ask('走網路時，資源名稱有兩種寫法。差在哪裡？',
 `<p><code>TCPIP0::192.168.1.20::INSTR</code>：VISA 把它當成儀器，一筆訊息到哪裡結束由通訊協定處理，你不用管結尾字元。</p>
<p><code>TCPIP0::192.168.1.20::5025::SOCKET</code>：直接連到 5025 這個埠。這種連線只是一條「位元組的水管」，沒有「一筆」的概念。這時候你必須自己把 termination char 打開並設成換行，Read 才知道讀到哪裡停，不然又是等到逾時。</p>
<p>在哪裡開：對紫色的 VISA 線按右鍵，Create ▸ Property Node，選 Message Based Settings 底下的 Termination Character Enable（寫入 True）和 Termination Character（寫入 10）。序列埠不用這樣做，是因為 VISA Configure Serial Port 已經替你設了。</p>
<p>這個陷阱有一個很好認的樣子。我們用 NI-VISA 連課程的軟儀器實際試過：SOCKET 剛打開時，Termination Character 本來就是 10，但 Enable 是 False，逾時是 2000 ms。這時候讀，Read 會等滿 2 秒才回來，<b>回來的字串是完整的，error out 卻是逾時</b>。打開 Enable 之後，同一條命令幾十毫秒就回來，沒有錯誤。所以只要看到「資料明明有、卻每次都逾時、而且每次都剛好等滿逾時」，先查這一格。</p>
<p>又回到接入單上最容易漏的那一格：一筆資料到哪裡結束。</p>`),
C.table(['接入單上的事','電源供應器','數位電表','所以程式哪裡不同'],[
 ['通訊參數','9600、8、None、1','沒有（USB、網路不用設）','不需要 VISA Configure Serial Port'],
 ['回一次要多久','0.01～0.4 秒','看量測設定，可能超過 1 秒','逾時要照量測設定算'],
 ['每圈要送的命令','IOUT1?','READ?（設定在迴圈外送一次）','迴圈外多一個 CONF'],
 ['特別的回覆','沒有','9.9E37 代表過載','多一個 Case'],
 ['出錯怎麼知道','ERR?','SYST:ERR?，可能有好幾筆','用迴圈讀到 +0 為止']
]),
...I05_LV,

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'命令表寫 MEASure:VOLTage:DC?。下面哪一個寫法儀器不認得？',o:['MEA:VOL:DC?','MEAS:VOLT:DC?','MEASURE:VOLTAGE:DC?','meas:volt:dc?'],a:0,ex:'大寫的部分一定要打完整。MEAS 不能再省成 MEA。大小寫本身不分。'},
 {q:'這台電表用 USB 接。VISA Configure Serial Port 要怎麼設？',o:['不需要它。鮑率那一組是序列埠才有的','9600、8、None、1','115200、8、None、1','照電源那台'],a:0,ex:'USB 和網路儀器直接用 VISA Open。'},
 {q:'送了打錯的 SCPI 命令。會看到什麼？',o:['Read 逾時；要另外送 SYST:ERR? 才知道原因','馬上收到錯誤訊息','儀器重開機','VISA Write 回報錯誤'],a:0,ex:'SCPI 儀器不主動報錯，只把錯誤放進佇列。'},
 {q:'把 MEAS:VOLT:DC? 拆成迴圈外的 CONF 和迴圈內的 READ?，理由是？',o:['設定量測只要做一次，不用每圈重設','READ? 比較準','MEAS? 不能用在迴圈裡','這樣不用設逾時'],a:0,ex:'問自己：這件事每一次都要做嗎？'},
 {q:'電表設成最精準的檔位後，每一筆都逾時，儀器沒有壞。最可能的原因？',o:['量一筆的時間比逾時還長','USB 線太短','命令打錯','電壓太低'],a:0,ex:'逾時要照「這個設定下多久回一筆」來設。'},
 {q:'資源名稱用 ::5025::SOCKET 連線，Read 一直等到逾時。最該檢查？',o:['termination char 有沒有打開並設成換行','IP 是不是太長','電表有沒有校正','LabVIEW 的版本'],a:0,ex:'SOCKET 連線沒有「一筆」的概念，要自己告訴 Read 讀到哪裡停。'}
]}
]});

/* =============================== I6 =============================== */
L.push({id:'I06',order:29.7,no:'I6',part:PART,title:'電子天平：它不等你問',mins:55,
goals:[['學會','「誰先開口」怎麼改變程式的骨架；固定格式的回覆怎麼切；標頭有幾種意思時用 Case；為什麼會讀到舊資料。'],['做出','天平的接入單和程式規劃圖：只在重量穩定時記一筆。'],['為什麼','工作上很多設備是這一型：條碼機、磅秤、流量計、各種顯示器的資料輸出。它們不聽命令，或只聽很少的命令。']].concat(window.InstSim?[['網頁練習','<a href="instlab.html">儀器接入練習台</a> 選「電子天平」。']]:[]),
check:'你能說出：天平預設為什麼收不到資料、收到的 15 個字元各是什麼、怎樣只在「放上去並穩定」的那一刻記一筆。',
body:[
C.h3('情境','x','第三台：A&D 電子天平'),
`<p>任務：產線上每放一個零件上去，等重量穩定，自動記下一筆重量。</p>`,
C.h3('第 1、2 步','','背板與接入單'),
`<p>背板是 9 針的 RS-232C 接頭。現在的電腦沒有這種接頭，要一條「USB 轉 RS-232」的線，插上去以後電腦多一個 COM 埠。會說話、序列埠，用 VISA。</p>
<p>說明書的通訊設定表寫著出廠值：</p>`,
C.table(['接入單','這台天平','電源那台是'],[
 ['鮑率','2400','9600'],
 ['資料位元','7','8'],
 ['同位','偶同位（Even）','None'],
 ['停止位元','1','1'],
 ['結尾字元','CR LF','—']
]),
ask('可以沿用電源那台的設定嗎？',
 `<p>不行，五格裡有三格不一樣。</p>
<p>通訊參數沒有「通常是多少」這回事。每一台都要查說明書，再對照機器上目前的設定（出廠值可能被前一個使用者改過）。照上一台的設定直接試，是新手很常見的浪費時間的方式。</p>
<p>另外說明書提醒：天平和電腦之間要用「直通」的 RS-232 線。線的種類不對，參數全對也收不到任何東西。這屬於 I2 檢查順序的第 1 項。</p>`),

C.h3('第 3 步','','講到話……結果什麼都沒有'),
SIMNOTE,
{fn:term({inst:'bal',cfg:{baud:2400,bits:7,parity:'E',stop:1,term:'\r\n'},presets:['Q','S','SIR','C','Z'],showHex:true})},
{todo:[
 '參數已經照說明書設好。按「只讀」。先猜：會收到什麼？',
 '先不要改任何設定。對照接入單，一格一格想：哪一格還沒確認？'
]},
ask('參數都對，為什麼收不到？是壞了嗎？',
 `<p>回到接入單上的那一格：<b>誰先開口</b>。</p>
<p>說明書有一節叫「資料輸出模式」。這台的出廠設定是「按鍵模式」：使用者按天平上的 PRINT 鍵，而且重量穩定，它才送一筆。你沒按，它就不送。</p>
<p>所以它沒壞，線也沒錯。它只是在等別的事。這也是 I2 檢查順序的最後一項：「儀器是不是在等別的事」。</p>`),
ask('我要它自動送資料，有哪些辦法？各有什麼代價？',
 `<p>說明書給了兩條路：</p>
<ul><li><b>把天平改成「串流模式」。</b>它會不停地送，每秒好幾筆。你的程式不用送任何命令，只要讀。</li>
<li><b>維持原來的模式，由電腦送命令去要。</b>送 <code>Q</code> 是「現在就給我一筆」，送 <code>S</code> 是「等穩定了再給我一筆」。</li></ul>
<p>怎麼選？問自己：<b>節奏要由誰控制？</b></p>
<p>串流模式（設備不等人問、自己一筆接一筆送）的節奏在天平手上。它送多快，你就得讀多快。電腦收到資料時，會先放進一塊暫存的空間，等你的程式來拿，這塊空間叫<b>緩衝區</b>。你讀得比它送得慢，沒讀的資料就在緩衝區裡越積越多（後面會看到這會出什麼事）。</p>
<p>命令模式的節奏在你手上。一問一答，跟電源、電表是同一種骨架，前面學的可以直接用。</p>
<p>結論：<b>能問就用問的</b>。只有設備不支援命令（很多條碼機、舊型磅秤就是），或真的需要最高的更新速度，才用串流。</p>`),
{todo:[
 '送 <code>Q</code>。收到一筆。',
 '按「放上零件」，馬上連送幾次 <code>Q</code>。每一筆的前兩個字元一樣嗎？',
 '把零件拿走，馬上送 <code>S</code>。它跟 <code>Q</code> 的反應差在哪？'
]},

C.h3('第 4 步','','看原始回覆'),
`<p>說明書說，每一筆固定是 15 個字元，再加結尾：</p>
<p>${raw('ST,+00001.27  g\r\n')}</p>`,
C.table(['位置','字元','意思'],[
 ['0～1','<code>ST</code>','標頭。ST 穩定、US 不穩定、OL 超過秤量'],
 ['2','<code>,</code>','分隔'],
 ['3～11','<code>+00001.27</code>','正負號和數值，前面補 0'],
 ['12～14','<code>␣␣g</code>','單位，固定 3 個字元，不夠的用空白補'],
 ['結尾','<code>\\r\\n</code>','CR LF']
]),
ask('「固定 15 個字元」這件事有什麼用？',
 `<p>它讓你可以用<b>位置</b>來切，不用去找分隔符號。標頭一定在第 0、1 個字元，數值一定從第 3 個字元開始。</p>
<p>它也給你一個免費的檢查：讀到的一筆如果不是 15 個字元（加結尾是 17 個），就表示這一筆不完整，可能是從中間開始讀的。不完整的資料不要轉、不要用。</p>`),

C.h3('第 5 步','','變成數字，以及「這個數字能不能用」'),
`<p>要拿兩樣東西：</p>
<ul><li>標頭：${fn('String','String Subset')}，offset 0、length 2，得到 <code>ST</code>。</li>
<li>數值：${fn('String','Number/String Conversion','Fract/Exp String To Number')}，offset 接 3，得到 1.27。它讀到空白就停，後面的單位不影響。</li></ul>`,
ask('拿到 1.27 了。可以直接記到檔案裡嗎？',
 `<p>還不行。同樣是「讀到一個數字」，標頭不同，意思完全不同：</p>`),
C.table(['標頭','意思','這一筆該怎麼處理'],[
 ['ST','重量穩定','可以記錄'],
 ['US','還在晃','只顯示，不記錄'],
 ['OL','超過秤量。數值欄是一串 9，不是重量','不顯示成重量，亮警告'],
 ['其他','不是完整的一筆','丟掉，計一次錯誤']
]),
`<p>四種情況、四種處理。把標頭字串接到 <b>Case 結構</b>的選擇端子，四頁分別是 "ST"、"US"、"OL" 和 Default。</p>`,
ask('說明書只列了三種標頭。為什麼還要有 Default？',
 `<p>一個理由是 LabVIEW 的規定：用字串當選擇端子時，一定要有一頁 Default，不然程式不能執行。</p>
<p>更重要的理由是現實：線鬆了、雜訊、剛開機時從一筆的中間開始讀，你就會收到說明書上沒有的東西。Default 頁就是「收到我看不懂的資料時該怎麼辦」。好的儀器程式一定有這一頁，而且裡面不是空的：至少計一次數，連續太多次就當成通訊異常。</p>`),

C.h3('第 6 步','','規劃：每放一個零件，只記一次'),
`<p>先寫最直接的版本：迴圈裡送 <code>Q</code>、讀、切、判斷，標頭是 ST 就記一筆。</p>`,
ask('這個版本跑起來會怎樣？',
 `<p>零件放著不動的那幾秒，每一圈讀到的都是 ST，於是同一個零件被記了十幾次。</p>
<p>你要的不是「現在是 ST」，而是「<b>剛剛變成</b> ST」：上一圈還是 US，這一圈變 ST 的那一刻。</p>`),
ask('要知道「剛剛變成」，需要什麼？',
 `<p>需要上一圈的標頭。這一圈拿它來跟現在的比。</p>
<p>「上一圈的東西這一圈還要用」，又是這一句，答案還是 <b>Shift Register</b>。這次裡面放的是一個字串：上一筆的標頭。</p>
<p>判斷變成：上一筆是 US，而且這一筆是 ST，才記錄。你在 PLC 課學過同一件事，叫上升緣。</p>`),
flow(['設定序列埠（2400、7、Even、1）',{loop:['送 Q','讀一筆','長度對嗎',{kase:['ST：上一筆是 US 才記錄','US：只顯示','OL：警告','Default：計錯'],label:'標頭',pages:true},'等 100 ms'],label:'While Loop',sr:'error、上一筆的標頭'},'關閉']),
ask('拿走零件再放下一個，會不會漏記或多記？',
 `<p>照順序想一次：拿走時重量變化，標頭變 US；空秤穩定，變 ST，這時候會記到一筆接近 0 的重量。</p>
<p>所以還要再加一個條件：重量大於某個下限才算有零件。這種「想一遍實際操作的每一步，看程式會做什麼」的檢查，要在畫方塊圖以前做。在紙上發現比在產線上發現便宜得多。</p>`),
...I06_LV,

C.h3('懂','','串流模式的坑：讀到的是舊資料'),
`<p>有些設備只能串流，所以這個坑一定要認得。把上面終端機裡的天平切成串流模式，然後：</p>`,
{todo:[
 '先按「拿走零件」讓秤上是空的。送 <code>SIR</code>，天平開始不停地送。',
 '什麼都不做，等 5 秒。注意看「緩衝區裡有幾個位元組」那個數字。',
 '現在按「放上零件」，馬上按一次「只讀」。先猜：會讀到零件的重量嗎？',
 '送 <code>C</code> 停止串流。'
]},
ask('零件明明已經放上去了，為什麼讀到的還是 0？',
 `<p>因為 Read 讀的是緩衝區<b>最前面</b>、最舊的那一筆。那是 5 秒前天平送的，當時秤上是空的。</p>
<p>緩衝區是先進先出的。你 5 秒沒讀，裡面排了上百筆。你每讀一筆只前進一筆，永遠追不上現在。畫面上的重量會比實際慢好幾秒，而且越跑越慢。</p>
<p>這不會有任何錯誤訊息。程式看起來一切正常，只是數字是舊的。</p>`),
C.table(['做法','怎麼做','適合'],[
 ['讀得比它送得快','迴圈裡不要另外放長時間的等待。Read 自己會等到有一筆才回','一直在讀的監看程式'],
 ['開始前先清掉','讀之前用 VISA Flush I/O Buffer（在 Instrument I/O ▸ VISA ▸ Advanced VISA 底下）把接收緩衝區裡舊的丟掉','偶爾才讀一次'],
 ['只拿最後一筆','對 VISA 線按右鍵 Create ▸ Property Node，選 Serial Settings 底下的 Number of Bytes at Serial Port，看積了多少；全部讀出來，只留最後完整的一筆','讀取間隔不固定']
]),
tip('一句話記住','一問一答的設備，資料是「你要了才有」，永遠是新的。自己一直送的設備，資料是「它給了就在那裡」，你不拿它就變舊。'),

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'天平通訊參數都設對了，Read 卻一直逾時。最該先查說明書的哪一節？',o:['資料輸出模式：它可能要按鍵或收到命令才送','保固條款','電池規格','外觀尺寸'],a:0,ex:'誰先開口？這台出廠是按 PRINT 才送。'},
 {q:'這台天平是 2400、7 資料位、偶同位。用 9600、8、None 去讀，會？',o:['收不到，或收到亂碼','照樣讀得到，只是慢一點','讀到的重量變成 4 倍','自動調整'],a:0,ex:'每一台都要查，不能沿用上一台的設定。'},
 {q:'回覆「US,-00183.69  g」的數值可以記進檔案嗎？',o:['不行。US 表示還沒穩定','可以，數字是完整的','可以，但要取絕對值','要先乘以 10'],a:0,ex:'同樣是數字，標頭不同，意思不同。所以要 Case。'},
 {q:'用字串當 Case 的選擇端子，為什麼一定要有 Default 頁？',o:['LabVIEW 規定要有，而且現實中會收到說明書沒列的東西','讓程式跑快一點','Default 頁不會被執行','為了好看'],a:0,ex:'Default 是「收到看不懂的資料時怎麼辦」。'},
 {q:'「每放一個零件只記一次」需要比較這一筆和上一筆的標頭。上一筆的標頭放在哪裡？',o:['Shift Register','Local Variable','常數','檔案'],a:0,ex:'上一圈的東西這一圈還要用。'},
 {q:'串流模式下，程式每 2 秒才讀一次。會發生什麼？',o:['讀到的是積在緩衝區的舊資料，而且越來越舊，沒有任何錯誤訊息','每次都讀到最新的','VISA 會自動丟掉舊的','天平會停止傳送'],a:0,ex:'緩衝區先進先出。讀得比它送得慢，就永遠追不上。'}
]}
]});
})();
