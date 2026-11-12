/* 第八部分：接入新儀器（I12）示波器：一次回來兩千個數字
   設備：Tektronix TBS2000B（網路 socket server）。事實出自 TBS2000B Series Programmer Manual（077-1149-03）：
   socket server 設定與預設埠 4000（p.1–2）；訊息結尾 LF（p.8）；波形資料格式、有號／無號、寬度 2 乘 256、傳輸步驟（p.36–38）；
   CURVe 與區塊格式 #<x><yyy><data><newline>、通道沒顯示時不回並記事件 2244／420（p.92–93）；DATa INIT、DATa:STARt／STOP（p.95–100）；
   HEADer（p.147）；記錄長度 1000～5000000（p.163）；水平 15 格；WFMOutpre? 與各欄（p.298–308）；換算公式（WFMInpre:YMUlt）；
   程式範例與出廠設定（p.335–339）。訊號本身（1 kHz、2 V 的正弦波）是本課的情境。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='接入新儀器';
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
function term(opts){return d=>{
  if(window.InstSim&&InstSim.terminal){InstSim.terminal(d,opts);}
  else d.innerHTML='<div class="fig"><p>模擬儀器終端機沒有載入。</p></div>';
};}
function flow(items){
  const one=x=>{
    if(typeof x==='string')return `<span class="fb">${x}</span>`;
    if(x.loop)return `<span class="fl"><em>${x.label||'While Loop'}</em><span class="fin">${x.loop.map(one).join('<i class="fa">→</i>')}</span>${x.sr?`<small class="fsr">Shift Register：${x.sr}</small>`:''}</span>`;
    if(x.kase)return `<span class="fc"><em>Case：${x.label}</em><span class="fin">${x.kase.map(one).join('<i class="fa">→</i>')}</span></span>`;
    return '';
  };
  return `<div class="bdflow fig">${items.map(one).join('<i class="fa">→</i>')}</div>`;
}

/* ---------- 拆一塊波形：用模擬的示波器實際抓一次，每個選項只改一件事 ---------- */
let WFN=0;
function wfLab(d){
  if(!window.InstSim){d.innerHTML='<div class="fig"><p>模擬儀器沒有載入。</p></div>';return;}
  const id='wf'+(++WFN), S={hdr:'1',w:'1',read:'term',conv:'u8',scale:'0'};
  const OPT=[
    ['hdr','HEADER',[['1','ON（出廠）'],['0','OFF']]],
    ['w','DATA:WIDTH',[['1','1（出廠）'],['2','2']]],
    ['read','VISA Read 怎麼讀',[['term','讀到結尾字元 \\n 就停'],['len','先讀 2 個，再讀長度，再照長度讀']]],
    ['conv','位元組變數字',[['u8','String To Byte Array（U8）'],['i8','Type Cast 成 I8 陣列'],['i16','Type Cast 成 I16 陣列']]],
    ['scale','換算',[['0','先不要'],['1','(資料 − YOFF) × YMULT + YZERO']]]];
  d.innerHTML=`<div class="wflab fig"><p class="wf-note">每次改選項，都會照下面的命令重新跟模擬的示波器要一次波形（DATA:ENCDG 固定是 RIBINARY）。</p>
<div class="wf-opts">${OPT.map(o=>`<fieldset><legend>${o[1]}</legend>${o[2].map(v=>`<label><input type="radio" name="${id}-${o[0]}" value="${v[0]}"${S[o[0]]===v[0]?' checked':''}> ${v[1]}</label>`).join('')}</fieldset>`).join('')}</div>
<div class="wf-cmd"></div><div class="wf-bytes"></div><p class="wf-say verdict-line" aria-live="polite"></p><div class="wf-plot"></div></div>`;
  const $=s=>d.querySelector(s);
  const H2=n=>(n<16?'0':'')+n.toString(16).toUpperCase();
  function chips(b,p,x,n,got){
    const role=i=>i<p?['hd','命令名稱']:i===p?['sh','#']:i===p+1?['sx','位數']:i<p+2+x?['sn','長度']:i<p+2+x+n?['sd','資料']:['lf','結尾'];
    const show=[];for(let i=0;i<Math.min(b.length,p+2+x+8);i++)show.push(i);
    const tail=got?[b.length-2,b.length-1].filter(i=>i>=p+2+x+8):[];
    const one=i=>{const r=role(i);return `<span class="wb ${r[0]}" title="${r[1]}"><b>${H2(b[i])}</b><small>${b[i]>32&&b[i]<127?String.fromCharCode(b[i]).replace('<','&lt;'):b[i]===10?'\\n':b[i]===32?'␣':''}</small></span>`;};
    return `<div class="wf-row">${show.map(one).join('')}${tail.length?'<span class="wb gap">…</span>'+tail.map(one).join(''):''}</div>
<div class="wf-key"><span class="wb hd">命令名稱</span><span class="wb sh">#</span><span class="wb sx">位數</span><span class="wb sn">長度</span><span class="wb sd">資料</span><span class="wb lf">結尾 \\n</span></div>`;
  }
  function plot(v,unit){
    const W=320,Hh=120,mn=Math.min(...v),mx=Math.max(...v),span=(mx-mn)||1,step=Math.max(1,Math.floor(v.length/320));
    let pts='';for(let i=0;i<v.length;i+=step)pts+=(i/(v.length-1)*W).toFixed(1)+','+(Hh-4-(v[i]-mn)/span*(Hh-8)).toFixed(1)+' ';
    const f=x=>unit==='V'?x.toFixed(2)+' V':String(Math.round(x));
    return `<svg class="wf-svg" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="畫出來的波形：最大 ${f(mx)}，最小 ${f(mn)}"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg><p class="wf-ax">${v.length} 點；最大 ${f(mx)}，最小 ${f(mn)}${unit==='V'?'':'（單位：小格）'}</p>`;
  }
  function run(){
    OPT.forEach(o=>{const c=d.querySelector(`input[name="${id}-${o[0]}"]:checked`);if(c)S[o[0]]=c.value;});
    const s=InstSim.open('tbs',{seed:11});s.connect();
    const cmds=['HEADER '+(S.hdr==='1'?'ON':'OFF'),'DATA:ENCDG RIBINARY','DATA:WIDTH '+S.w,'CURVE?'];
    cmds.forEach(c=>s.write(c+'\n'));
    $('.wf-cmd').innerHTML='送出：'+cmds.map(c=>`<code>${c}</code>`).join(' → ');
    let b=[],data=null,say='',cls='bad',p=0,x=0,n=0;
    if(S.read==='term'){
      b=s.read().bytes;p=b[0]===35?0:b.indexOf(35);x=b[p+1]-48;n=+String.fromCharCode(...b.slice(p+2,p+2+x));
      const got=b.length-(p+2+x);
      if(got>=n+1)data=b.slice(p+2+x,p+2+x+n);
      else say=`✖ 標頭說後面有 ${n} 個位元組，這次只收到 ${Math.max(0,got-1)} 個資料就停了。停下來的那個位元組是 0A：某一點的值剛好是 10，VISA Read 把它當成結尾字元 \\n。剩下的 ${n+1-got} 個位元組還在緩衝區，下一次讀會先讀到它們。`;
    }else{
      const a=s.read({term:null,count:2});b=a.bytes.slice();
      if(a.text[0]!=='#'){say=`✖ 先讀的 2 個字元是「${a.text}」，不是「#」加一個數字。HEADER 是 ON：回覆前面多了「:CURVE 」這 7 個字元。照長度讀之前，要先送 HEADER OFF。`;p=2;}
      else{x=+a.text[1];const c=s.read({term:null,count:x});n=+c.text;const e=s.read({term:null,count:n+1});b=b.concat(c.bytes,e.bytes);data=e.bytes.slice(0,n);}
    }
    const shown=b.length?chips(b,p,x||0,n||0,!!data):'';
    $('.wf-bytes').innerHTML=shown?`<p class="wf-cap">收到 ${b.length} 個位元組，最前面幾個（十六進位，下面是對應的字元）：</p>`+shown:'';
    if(!data){$('.wf-say').textContent=say;$('.wf-say').className='wf-say verdict-line bad';$('.wf-plot').innerHTML='';return;}
    let v;
    if(S.conv==='u8')v=data.slice();
    else if(S.conv==='i8')v=data.map(q=>q>127?q-256:q);
    else{v=[];for(let i=0;i+1<data.length;i+=2){const q=data[i]<<8|data[i+1];v.push(q>32767?q-65536:q);}}
    const right=(S.w==='1'&&S.conv==='i8')||(S.w==='2'&&S.conv==='i16');
    let unit='';
    if(S.scale==='1'){
      s.flush();s.write('HEADER OFF\n');
      const num=c=>parseFloat(s.query(c).text);
      const ym=num('WFMOUTPRE:YMULT?'),yo=num('WFMOUTPRE:YOFF?'),yz=num('WFMOUTPRE:YZERO?');
      v=v.map(q=>(q-yo)*ym+yz);unit='V';
      say=`YMULT ${ym}、YOFF ${yo}、YZERO ${yz}（每次抓波形都要重新問）。`;
    }else say='';
    if(S.w==='1'&&S.conv==='u8')say='✖ 中間跳到 200 多：RIBINARY 是有號的（−128～127），U8 把 −10（F6）讀成 246。改用 Type Cast 成 I8 陣列。'+(unit?'':'');
    else if(S.w==='1'&&S.conv==='i16')say=`✖ 只剩 ${v.length} 點，數字也不對：寬度是 1，I16 把相鄰兩點黏成一個數。`;
    else if(S.w==='2'&&S.conv==='i8')say=`✖ 變成 ${v.length} 點，一半是 0：寬度 2 時每點 2 個位元組、低位元組是 0（說明書：資料乘 256）。要用 I16。`;
    else if(S.w==='2'&&S.conv==='u8')say='✖ 寬度 2 要兩個位元組合成一點，而且是有號的。要用 Type Cast 成 I16 陣列。';
    else if(right&&!unit)say=`△ 形狀對了，可是單位是「小格」${S.w==='2'?'（寬度 2 時乘了 256）':''}，不是伏特。下一步：換算。`;
    else if(right&&unit){say='✔ 得到電壓。'+say+'訊號是振幅 2 V 的正弦波，看最大、最小值對不對得上。';cls='ok';}
    else if(unit)say='✖ 位元組沒有轉對，換算也救不回來。'+say;
    $('.wf-say').textContent=say;$('.wf-say').className='wf-say verdict-line '+(cls==='ok'?'ok':right?'':'bad');
    $('.wf-plot').innerHTML=plot(v,unit);
  }
  d.addEventListener('change',run);run();
}

/* ======================================================================
   LabVIEW 實作：I12_Curve.vi（照長度讀一塊 RIBINARY 波形：讀 2 → 讀 x → 關結尾字元 → 讀 n → 讀掉 \n → 開回來）
   回覆是網頁模擬的（2000 點、1 V/div 下振幅約 50 小格的正弦波，跟上面的模擬示波器同一個情境）。
   ====================================================================== */
const ctl=C.ctl,qd=C.qd,wt=C.wt,PR=['Functions','Programming'];
const addF=o=>{for(const k in o)if(!LV.F[k])LV.F[k]=o[k];};
addF({
 'Decimal String To Number':{g:'123→#',ins:['string','offset','default'],outs:['offset past number','number'],w:46,pal:[...PR,'String','Number/String Conversion','Decimal String To Number']},
 'Type Cast':{g:'⇢T',ins:['x','type'],outs:['*(type *) &x'],pal:[...PR,'Numeric','Data Manipulation','Type Cast']}
});
const NOERR={status:false,code:0,source:''};
const TBSRES='TCPIP0::192.168.1.70::4000::SOCKET';
const WAVE=Array.from({length:2000},(_,k)=>Math.round(50*Math.sin(2*Math.PI*k/1333.33)));
const curveVI={name:'I12_Curve.vi',view:'bd',
 fp:{w:400,h:260,items:[
  {id:'res',k:'visa',label:'Resource',x:16,y:16,w:300,v:TBSRES,options:[TBSRES,'TCPIP0::127.0.0.1::5565::SOCKET']},
  {id:'graph',k:'chart',label:'Waveform Graph（單位：小格；網頁只畫抽樣的點）',x:16,y:76,w:300,h:110,min:-128,max:127},
  {id:'eo',k:'err',label:'error out',x:16,y:210}]},
 bd:{w:640,h:320,nodes:[
  {id:'res',k:'ctl',t:'visa',label:'Resource',x:10,y:37},
  {id:'init',k:'sub',name:'TBS_Initialize.vi',top:'TBS',icon:['INIT'],ins:['Resource'],outs:['VISA out'],err:true,x:56,y:30},
  {id:'kcurve',k:'const',t:'str',v:'CURVE?\\n',x:110,y:49},
  {id:'wr',k:'fn',fn:'VISA Write',x:180,y:36,showName:false},
  {id:'k2',k:'const',t:'i32',v:2,x:230,y:49},
  {id:'rd2',k:'fn',fn:'VISA Read',x:256,y:36,showName:false},
  {id:'k1a',k:'const',t:'i32',v:1,x:296,y:117},
  {id:'k1b',k:'const',t:'i32',v:1,x:296,y:135},
  {id:'ss1',k:'fn',fn:'String Subset',x:320,y:90,h:72,showName:false},
  {id:'d2n1',k:'fn',fn:'Decimal String To Number',x:370,y:114,showName:false},
  {id:'rdx',k:'fn',fn:'VISA Read',x:470,y:36,showName:false},
  {id:'kF',k:'const',t:'bool',v:false,x:522,y:54},
  {id:'pnoff',k:'prop',cls:'VISA',items:[{n:'TermChar En',w:true}],err:true,x:546,y:38,w:90},
  {id:'d2n2',k:'fn',fn:'Decimal String To Number',x:530,y:98,showName:false},
  {id:'rdn',k:'fn',fn:'VISA Read',x:110,y:200,showName:false},
  {id:'k1c',k:'const',t:'i32',v:1,x:170,y:213},
  {id:'rdlf',k:'fn',fn:'VISA Read',x:200,y:200,showName:false},
  {id:'kT',k:'const',t:'bool',v:true,x:248,y:218},
  {id:'pnon',k:'prop',cls:'VISA',items:[{n:'TermChar En',w:true}],err:true,x:270,y:202,w:90},
  {id:'cl',k:'fn',fn:'VISA Close',x:380,y:196,showName:false},
  {id:'seh',k:'fn',fn:'Simple Error Handler',x:440,y:202,showName:false},
  {id:'karr',k:'const',t:'i8[]',v:'[I8]',x:168,y:282},
  {id:'tc',k:'fn',fn:'Type Cast',x:210,y:270},
  {id:'graph',k:'ind',t:'i8[]',label:'Waveform Graph',x:290,y:276}],
 wires:[
  {id:'w1',from:'res',to:'init.Resource',t:'visa'},
  {id:'w2',from:'init.VISA out',to:'wr.VISA resource name',t:'visa'},
  {id:'w3',from:'init.error out',to:'wr.error in',t:'err'},
  {id:'w4',from:'kcurve',to:'wr.write buffer',t:'str'},
  {id:'w5',from:'wr.VISA resource name out',to:'rd2.VISA resource name',t:'visa'},
  {id:'w6',from:'wr.error out',to:'rd2.error in',t:'err'},
  {id:'w7',from:'k2',to:'rd2.byte count',t:'i32'},
  {id:'w8',from:'rd2.read buffer',to:'ss1.string',t:'str',pts:[[306,58],[306,108]]},
  {id:'w9',from:'k1a',to:'ss1.offset',t:'i32'},
  {id:'w10',from:'k1b',to:'ss1.length',t:'i32'},
  {id:'w11',from:'ss1.substring',to:'d2n1.string',t:'str'},
  {id:'w12',from:'d2n1.number',to:'rdx.byte count',t:'i32',pts:[[440,145],[440,58]]},
  {id:'w13',from:'rd2.VISA resource name out',to:'rdx.VISA resource name',t:'visa'},
  {id:'w14',from:'rd2.error out',to:'rdx.error in',t:'err'},
  {id:'w15',from:'rdx.VISA resource name out',to:'pnoff.reference',t:'visa'},
  {id:'w16',from:'kF',to:'pnoff.TermChar En',t:'bool'},
  {id:'w17',from:'rdx.error out',to:'pnoff.error in',t:'err',pts:[[516,69],[516,78]]},
  {id:'w18',from:'rdx.read buffer',to:'d2n2.string',t:'str',pts:[[518,58],[518,110]]},
  {id:'w19',from:'pnoff.reference out',to:'rdn.VISA resource name',t:'visa',pts:[[639,47],[639,196],[36,196],[36,211]]},
  {id:'w20',from:'pnoff.error out',to:'rdn.error in',t:'err',pts:[[637,78],[637,188],[28,188],[28,233]]},
  {id:'w21',from:'d2n2.number',to:'rdn.byte count',t:'i32',pts:[[584,129],[584,180],[20,180],[20,222]]},
  {id:'w22',from:'rdn.VISA resource name out',to:'rdlf.VISA resource name',t:'visa'},
  {id:'w23',from:'rdn.error out',to:'rdlf.error in',t:'err'},
  {id:'w24',from:'k1c',to:'rdlf.byte count',t:'i32'},
  {id:'w25',from:'rdlf.VISA resource name out',to:'pnon.reference',t:'visa'},
  {id:'w26',from:'kT',to:'pnon.TermChar En',t:'bool'},
  {id:'w27',from:'rdlf.error out',to:'pnon.error in',t:'err',pts:[[246,233],[246,242]]},
  {id:'w28',from:'pnon.reference out',to:'cl.VISA resource name',t:'visa'},
  {id:'w29',from:'pnon.error out',to:'cl.error in',t:'err',mx:370},
  {id:'w30',from:'cl.error out',to:'seh.error in',t:'err'},
  {id:'w31',from:'rdn.read buffer',to:'tc.x',t:'str',pts:[[160,222],[160,281]]},
  {id:'w32',from:'karr',to:'tc.type',t:'i8[]'},
  {id:'w33',from:'tc.*(type *) &x',to:'graph',t:'i8[]'}]},
 sim:{live:true,step(i){
  const pts=WAVE.filter((_,k)=>k%13===0);
  return {out:{graph:pts,eo:NOERR},msg:'讀 2 個：「#4」→ x＝4；讀 4 個：「2000」→ n＝2000；關掉結尾字元，讀 2000 個資料，再讀 1 個把 \\n 讀掉；開回結尾字元。Type Cast 成 I8：2000 點，最大 50、最小 −50（小格）。',
   vals:{res:i.res,kcurve:'CURVE?\n',k2:2,k1a:1,k1b:1,kF:false,k1c:1,kT:true,karr:'[I8]','rd2.read buffer':'#4','ss1.substring':'4','d2n1.number':4,'rdx.read buffer':'2000','d2n2.number':2000,'rdn.read buffer':'（2000 個位元組）','tc.*(type *) &x':WAVE,'init.error out':NOERR,'rdn.error out':NOERR,'cl.error out':NOERR}};
 }}
};
const I12_LV=[
C.h3('LabVIEW','b','動手寫：I12_Curve.vi（照標頭的長度讀一塊波形）'),
`<p>上面的規劃圖裡，新的只有「讀 2 → 讀 x → 關結尾字元 → 讀 n＋1 → 開結尾字元」和 Type Cast。這一支只抓<b>一塊</b>，把讀法做對；換算和迴圈在最後一步說明怎麼加。</p>`,
C.plan({
 start:'File ▸ New VI，存成 <code>練習\\儀器\\I12_Curve.vi</code>。初始化那一串（VISA Open、Termination Character Enable＝True、Termination Character＝10、Timeout、HEADER OFF、DATA:SOURCE CH1、DATA:ENCDG RIBINARY、DATA:WIDTH 1）照 I10 的做法先包成 <code>TBS_Initialize.vi</code>，這張圖只畫它的方塊。',
 in:'送 <code>CURVE?\\n</code>。回覆是 <code>#42000</code>＋2000 個位元組＋<code>\\n</code>。每個位元組是一點，有號的 −128～127，單位是「小格」。',
 calc:'讀 2 個 → String Subset（offset 1、length 1）→ Decimal String To Number 得到 x＝4 → 再讀 x 個 → Decimal String To Number 得到 n＝2000 → Property Node 把 TermChar En 寫成 False → 讀 n 個（資料）→ 再讀 1 個（把最後的 \\n 讀掉）→ TermChar En 寫回 True。資料用 Type Cast（type 接 I8 陣列常數）變成 I8 陣列。換成伏特：（資料 − YOFF）× YMULT ＋ YZERO，陣列直接算，不用迴圈。',
 out:'Waveform Graph：先畫 I8 陣列（Y 軸是小格），確定形狀對了再接換算後的電壓。',
 loop:'這一支只抓一次。正式程式照規劃圖：While Loop 裡每一輪 ACQ 單次 → *OPC? → 問換算參數 → CURVE?。',
 end:'error 線一路串到 VISA Close。注意：如果讀資料那一次忘了關結尾字元，<b>不會有錯誤</b>，只會在第一個 0A 停下來、讀到一半。讀完一定要把 TermChar En 寫回 True，不然下一個文字查詢會等到逾時。'}),
note('下面的 VI 視窗是網頁模擬的','模擬的示波器跟上面終端機同一個情境；畫面只抽樣畫出一部分的點。'),
{steps:{title:'I12_Curve.vi：讀 2、讀 x、讀 n、讀 1',lv:curveVI,steps:[
 {t:'前面板',view:'fp',add:['res','graph','eo'],h:`<p>Resource 打 SOCKET 的資源名稱（示波器先在面板打開 Socket Server）。放 ${ctl('Modern','Graph','Waveform Graph')}：Graph 一次收一整個陣列（Chart 是一點一點累積），抓波形用 Graph。</p>`},
 {t:'初始化、送 CURVE?、讀 2 個',view:'bd',add:['res','init','kcurve','wr','k2','rd2','w1','w2','w3','w4','w5','w6','w7'],h:`<p><code>TBS_Initialize.vi</code> 是自己包的驅動（I10）：裡面 VISA Open，對紫線 Create ▸ Property Node 設 TermChar En＝True、TermChar＝10、Timeout＝5000，再送 HEADER OFF 等四條設定命令。</p><p>接著 VISA Write 送 <code>CURVE?\\n</code>，VISA Read 的 byte count 接 <code>2</code>：讀到「#4」。</p>`},
 {t:'第 2 個字元是長度欄的位數',view:'bd',add:['k1a','k1b','ss1','d2n1','w8','w9','w10','w11'],h:`<p>String Subset：offset <code>1</code>、length <code>1</code>，取出「4」。${fn('Programming','String','Number/String Conversion','Decimal String To Number')} ${qd('Decimal String To Number')} 變成整數 4。</p>`},
 {t:'讀 x 個：得到 n',view:'bd',add:['rdx','d2n2','w12','w13','w14','w18'],h:`<p>第二個 VISA Read，byte count 接上一步的 4，讀到「2000」。再一個 Decimal String To Number：n＝2000。</p><p class="qd">記錄長度改了，這裡自己就會變成別的數字，程式不用改。</p>`},
 {t:'關掉結尾字元，讀 n 個，再讀 1 個',view:'bd',add:['kF','pnoff','w15','w16','w17','rdn','w19','w20','w21','k1c','rdlf','w22','w23','w24'],h:`<p>在紫線上右鍵 ▸ Create ▸ Property Node ▸ Message Based Settings ▸ <b>Termination Character Enable</b>（圖上是簡稱 TermChar En），右鍵 Change All To Write，接常數 <b>F</b>。</p>${wt([
 ['Property Node 的 reference out','VISA Read 的 VISA resource name','一定要在關掉之後才讀'],
 ['n（Decimal String To Number 的 number）','VISA Read 的 byte count','2000 個資料'],
 ['常數 1','下一個 VISA Read 的 byte count','把最後的 \\n 讀掉，不留在緩衝區']])}
<p class="qd">課文說「讀 n＋1 個」；這裡拆成「讀 n 個」加「讀 1 個」，效果一樣，資料那一段就不用再切掉最後一個位元組。</p>`},
 {t:'開回結尾字元，Close',view:'bd',add:['kT','pnon','cl','seh','w25','w26','w27','w28','w29','w30'],h:`<p>再一個 Property Node，TermChar En 寫 <b>T</b>。之後的文字查詢（*OPC?、WFMOUTPRE:YMULT?）才會讀到 \\n 就回來。然後 VISA Close、Simple Error Handler。</p>`},
 {t:'Type Cast 成 I8 陣列，畫出來',view:'split',add:['karr','tc','graph','w31','w32','w33'],h:`<p>${fn('Programming','Numeric','Data Manipulation','Type Cast')}：x 接讀 n 個那一次的 read buffer，type 接一個 <b>I8 陣列常數</b>（Array Constant 裡放一個 I8 數值常數）。輸出接 Waveform Graph。</p>
<p>Run：一條振幅約 50 小格的正弦波。<b>換成伏特</b>的下一步：用 I3 的「送查詢、讀、Scan From String」問 <code>WFMOUTPRE:YMULT?</code>、<code>YOFF?</code>、<code>YZERO?</code>，I8 陣列先 To Double Precision Float，再接 Subtract（YOFF）→ Multiply（YMULT）→ Add（YZERO）。三個函式直接接陣列，不用 For Loop。</p>`}
]}},
ask('改一個數字，先預測結果：Type Cast 的 type 從 I8 陣列改成 U8 陣列（或直接用 String To Byte Array）。Graph 會變成什麼樣子？',
 `<p>正的那一半不變；負的那一半全部跳到上面：−10 存成位元組是 F6，U8 看成 246，−50 變成 206。Graph 上是一個「正弦波的上半段＋一塊浮在 200 附近的東西」，Y 軸被撐到 0～255。</p>
<p>沒有任何錯誤。這跟上面「拆一塊波形」的 ✖ 一模一樣：位元組本身沒有正負號，<b>要用什麼型別看它，是你決定的</b>。說明書寫 RIBINARY 是有號的，所以用 I8。</p>`)
];

/* =============================== I12 =============================== */
L.push({id:'I12',order:29.98,no:'I12',part:PART,title:'示波器：一次回來兩千個數字',mins:65,
goals:[['學會','讀懂 #42000 這種二進位區塊；讀一整段波形時，VISA Read 該怎麼讀；螢幕上的「小格」怎麼換算成伏特和秒；2000 個點的換算要不要用迴圈。'],['做出','示波器的接入單和程式規劃圖：抓一次波形、換算、畫圖、處理「沒有觸發」。'],['為什麼','測試站的工作常常要把波形抓回電腦存檔、自動判斷。前面幾台都是一次一個數字，這一台一次一整段，讀法和轉法都要重想。'],['網頁練習','<a href="instlab.html">儀器接入練習台</a> 選「TBS2000B 示波器」。']],
check:'你能說出：為什麼讀 CURVE? 不能用「讀到結尾字元就停」；#42000 的每一個字元是什麼；一點的資料怎麼變成伏特；為什麼 2000 個點的換算不用 For Loop。',
body:[
C.h3('情境','x','產線要把波形存下來'),
`<p>測試站每測一個產品，要把示波器 CH1 的波形抓回電腦，存檔，再判斷峰值有沒有超出規格。手上有一台 Tektronix TBS2000B、一條網路線、一本程式設計手冊。</p>
<p>跟前面幾台比，新的地方只有一個：<b>一次回來的不是一個數字，是一整段波形</b>。就這一個差別，「怎麼讀」和「怎麼轉」都要重想。</p>`,

C.h3('第 1 步','','它該用什麼？'),
ask('它會說話嗎？LabVIEW 用哪一組函式？',
 `<p>有程式設計手冊，命令是 SCPI 文字（<code>*IDN?</code>、<code>CURVE?</code>）：它會說話，用 VISA。</p>
<p>它可以接 USB（USBTMC），也可以接網路。這一課用網路的 socket server：資源名稱是 <code>TCPIP0::192.168.1.70::4000::SOCKET</code>（IP 是示意）。選網路來練，是因為 SOCKET 的結尾字元要自己處理，等一下的問題在這裡最明顯。</p>`),
note('先在示波器上打開 socket server','說明書：Utility ▸ Config ▸ Socket Server，最上面一項選 Enabled；埠號在同一個選單看（預設 4000）。協定有 None 和 Terminal：Terminal 是給人用鍵盤打的，程式用 None。'),

C.h3('第 2 步','','先講到話'),
`<p>下面是模擬的示波器。先按「連線」，送 <code>*IDN?</code>。再送 <code>CURVE?</code>：送之前，先猜會看到什麼。</p>`,
{fn:term({inst:'tbs',cfg:{term:'\n'}})},
ask('CURVE? 回來的東西，記事本那一列為什麼像亂碼？',
 `<p>看十六進位那一列：除了最前面幾個是看得懂的字元，後面都是 00～FF 之間的位元組。出廠設定 DATA:ENCDG 是 RIBINARY，也就是二進位：每一點用一個位元組送。記事本把它們當字元畫，當然是亂碼。</p>
<p>還有一件事：它前面多了 <code>:CURVE</code> 這幾個字。這兩件事等一下一件一件處理。<b>先別急著解二進位</b>：第一步是讓數據變成看得懂的樣子。</p>`),

C.h3('第 3 步','','先讓數據「看得見」：改成 ASCII'),
`<p>送 <code>DATA:ENCDG ASCII</code>，再送 <code>CURVE?</code>。</p>`,
ask('這一串數字是電壓嗎？最大的大約多少？',
 `<p>最大大約 50，最小大約 −50。示波器上是 1 V/div，訊號振幅 2 V：50 不是伏特。</p>
<p>說明書：示波器內部每一點都是一個 8 位元的數字，範圍 −128～127，代表「在螢幕上第幾格」。手冊的例子：100 mV/div 時 YMULT 是 4.0E-3，也就是一格（division）切成 25 個小格。1 V/div 時一小格是 0.04 V，50 小格就是 2 V。</p>
<p>所以這裡的數字要換算才是電壓。換算用的參數儀器會告訴你，第 4 步再看。</p>`),
ask('最前面的 :CURVE 是什麼？它會造成什麼問題？',
 `<p>說明書：HEADER 出廠是開的，查詢的回覆前面會帶命令名稱。給人看很方便，給程式切就麻煩：用 Spreadsheet String To Array 以逗號切，第一個元素是「:CURVE 50」，轉不出正確的數字。</p>
<p>所以初始化時送一次 <code>HEADER OFF</code>。這一行要寫進接入單：這台的回覆預設帶標頭。</p>`),
ask('2000 個數字，VISA Read 的 byte count 要給多少？',
 `<p>說明書：ASCII 每一點佔 2～7 個字元（負號、數字、逗號）。2000 點最多一萬多個字元。byte count 給 20000 就夠了：I4 學過，結尾字元打開時 byte count 只是上限，讀到 <code>\\n</code> 就回來，不會等滿。</p>
<p>如果還用 I2 那種「給 100 就好」，只會讀到開頭一小段，剩下的留在緩衝區，下一次讀會讀到舊資料的後半段。</p>`),
tip('為什麼是 2000 點，不是 2500','說明書：DATA:STOP 出廠是 2500，但這台目前的記錄長度是 2000；STOP 比記錄長度大時，只送到記錄長度為止。'),

C.h3('第 4 步','','小格怎麼變成伏特、秒'),
`<p>說明書給的公式：</p><p class="fig" style="text-align:center"><b>值 ＝（資料 − YOFF）× YMULT ＋ YZERO</b></p>
<p>這三個數字，和時間軸要用的 XINCR、XZERO，都可以問 <code>WFMOUTPRE?</code> 一次拿到，或分開問（<code>WFMOUTPRE:YMULT?</code>…）。在終端機送 <code>HEADER OFF</code> 再送 <code>WFMOUTPRE?</code>，對照下表。</p>`,
C.table(['欄位','意思','這台現在的值'],[
 ['NR_PT','這次 CURVE? 會送幾點','2000'],
 ['XINCR','相鄰兩點差幾秒（取樣間隔）','750.0000E-9'],
 ['XZERO','第一點的時間（觸發點是 0）','-750.0000E-6'],
 ['YMULT','一小格是幾伏特','40.0000E-3'],
 ['YOFF','畫面上的位置，用小格表示','0.0E+0'],
 ['YZERO','垂直偏移，用伏特表示','0.0E+0']
]),
ask('手算：一點的資料是 −48，電壓多少？如果有人把 CH1 往上移 1 格，YOFF 變成 25，同一個電壓的資料會變成多少？',
 `<p>（−48 − 0）× 0.04 ＋ 0 ＝ −1.92 V。</p>
<p>往上移 1 格，畫面上整條線往上 25 小格，這一點的資料變成 −23。照公式：（−23 − 25）× 0.04 ＝ −1.92 V，算出來一樣。</p>
<p>所以 YOFF 一定要放進公式。只看資料，有人轉了一下旋鈕，你的電壓就全部錯了。</p>`),
ask('時間軸：第 i 點是幾秒？要自己用迴圈算 2000 個時間嗎？',
 `<p>第 i 點的時間 ＝ XZERO ＋ i × XINCR（PT_OFF 是 0）。第 0 點是 −0.75 ms，第 1000 點是 0，觸發點在正中間。</p>
<p>不用自己算。Waveform Graph 可以吃一包「起點、間隔、Y 陣列」：用 Bundle 把 XZERO、XINCR、電壓陣列綁在一起接上去，X 軸就是秒。</p>`),
ask('YMULT 可以只在程式開頭問一次嗎？',
 `<p>V/div、位置、記錄長度一改，YMULT、YOFF、XINCR 就跟著變。操作員碰一下旋鈕，你存下來的波形就全部縮放錯誤，而且看不出來。</p>
<p>一筆波形配一組參數：每次抓波形都重新問。多問幾個數字只花幾毫秒，換來的是「存下來的每一筆都對得起來」。</p>`),

C.h3('第 5 步','','為什麼要換回二進位'),
ask('ASCII 已經看得懂了，出廠為什麼是二進位？',
 `<p>大小。寬度 1 的二進位每點 1 個位元組；ASCII 每點 2～7 個字元。2000 點差不多是 2 KB 對 6～8 KB。記錄長度可以設到 5000000 點，差距就是幾 MB 對十幾 MB。</p>
<p>做法：除錯時用 ASCII 看清楚；確定換算對了，正式程式用二進位。</p>`),
`<p>在終端機送 <code>HEADER OFF</code>、<code>DATA:ENCDG RIBINARY</code>，再送 <code>CURVE?</code>。看十六進位那一列最前面：<code>23 34 32 30 30 30</code>。</p>`,
ask('#42000 是什麼意思？',
 `<p>說明書的格式是 <code>#&lt;x&gt;&lt;yyy&gt;&lt;data&gt;&lt;newline&gt;</code>：</p>
<ul><li><code>#</code>：區塊開始。</li><li><code>4</code>：後面接著的「長度」有 4 個字元。</li><li><code>2000</code>：資料有 2000 個位元組。</li><li>然後是 2000 個位元組的資料，最後一個 <code>\\n</code>。</li></ul>
<p>為什麼要先講「長度有幾個字元」？因為資料可能是 500 個位元組，也可能是 5000000 個：先告訴你長度欄有多寬，你才知道長度讀到哪裡結束。</p>`),
ask('終端機用「讀到結尾字元為止」，收到幾個位元組？標頭說應該有幾個？差在哪裡？',
 `<p>只收到幾百個就停了，而且顯示「收到」，看起來像成功。標頭說後面有 2000 個。</p>
<p>停下來的那個位元組是 0A。某一點的值剛好是 10，十六進位就是 0A，也就是 <code>\\n</code>。VISA Read 不知道這是資料，以為是結尾字元。剩下的位元組還在緩衝區，下一次讀會先讀到它們，之後全部錯位。</p>
<p>這跟 I7 的 Modbus RTU 是同一件事：<b>位元組資料不能靠結尾字元判斷結束</b>。</p>`),
ask('那要怎麼讀？',
 `<p>標頭自己就告訴你長度，照它讀：</p>
<ol><li>讀 2 個位元組：<code>#4</code>。第 2 個字元是 4。</li><li>再讀 4 個：<code>2000</code>，轉成數字。</li><li>再讀 2000 ＋ 1 個：資料加上最後的 <code>\\n</code>，一起讀掉，不留在緩衝區。</li></ol>
<p>第 3 次讀之前，用 Property Node 把 Termination Character Enable 寫成 False，讀完再寫回 True。不然 VISA Read 還是會在第一個 0A 停下來。</p>
<p>這個順序和 I9 讀 Modbus TCP 一樣：先讀固定長度的頭，再照頭裡寫的長度讀剩下的。在終端機試：讀取方式選「讀固定幾個位元組」，依序填 2、4、2001。</p>`),
note('接 USB 的時候','說明書：走 USB（USBTMC）時，一則訊息的結尾由 USB 標頭裡的 EOM 位元標示。所以只要你沒有自己打開結尾字元、byte count 夠大，USB 通常一次就讀完。照長度讀的方法 USB 和網路都適用，程式換接法也不用改。'),

C.h3('第 6 步','','位元組變成數字'),
`<p>手上有 2000 個位元組了。下面用模擬的示波器實際抓一塊：<b>一次只改一個選項</b>，看圖和數字怎麼變。每一個 ✖ 都是新手真的會寫出來的程式。</p>`,
{fn:wfLab},
ask('String To Byte Array 畫出來，為什麼中間會跳到 200 多？',
 `<p>String To Byte Array 給的是 U8，沒有負號，範圍 0～255。RIBINARY 是有號的，範圍 −128～127。−10 存成位元組是 F6，U8 讀成 246。</p>
<p>要讓 LabVIEW 用「有號」的方式看這些位元組：${fn('Numeric','Data Manipulation','Type Cast')}，type 接一個 I8 的陣列常數，字串進去，I8 陣列出來。</p>`),
ask('改成 DATA:WIDTH 2，程式要改哪裡？',
 `<p>每點變成 2 個位元組，高位元組在前（RI）。Type Cast 的 type 改成 I16 陣列。LabVIEW 的 Type Cast 本來就是高位元組在前，剛好對上。如果示波器設成 SRIbinary（低位元組在前），就要換順序：${fn('String','Flatten/Unflatten String','Unflatten From String')} 的 byte order 選 little-endian。</p>
<p>換算公式不用改：說明書寫寬度 2 時資料乘了 256，示波器回的 YMULT 也跟著小了 256 倍。參數照問，公式照用。</p>`),
ask('換算 2000 個點，要用 For Loop 一點一點算嗎？',
 `<p>不用。LabVIEW 的加減乘除可以直接接陣列：陣列減一個數，就是每個元素都減。I8 陣列減 YOFF、乘 YMULT、加 YZERO，三個函式接起來，出來就是 2000 個電壓。</p>
<p>I11 用 For Loop，是因為每一段要「切字串、轉數字」，每一圈做的事不只是算術。這裡資料已經是數字陣列了，直接算。</p>
<p>型別要注意：I8 只裝得下 −128～127。如果你拿 I8 去跟 I8 常數相減或相乘，結果會溢位。先用 To Double Precision Float 轉成 DBL 再算，最清楚。</p>`),

C.h3('第 7 步','','規劃程式'),
flow(['VISA Open（SOCKET）','Termination Character Enable：True','HEADER OFF；DATA:SOURCE CH1；DATA:ENCDG RIBINARY；DATA:WIDTH 1；DATA:START 1；DATA:STOP 記錄長度',
 {loop:['ACQ:STOPAFTER SEQ；ACQ:STATE ON','*OPC?（逾時 5 s）',{kase:['逾時：沒有觸發 → 記下來、清掉 error、提示操作員'],label:'*OPC? 逾時？'},'問 YMULT、YOFF、YZERO、XINCR、XZERO','CURVE?','讀 2 → 讀 x → 關結尾字元 → 讀 n＋1 → 開結尾字元','Type Cast → 轉 DBL → 換算','Bundle → Waveform Graph、存檔'],label:'While Loop',sr:'error'},
 'VISA Close']),
ask('*OPC? 的逾時要設多久？逾時代表什麼？',
 `<p>單次擷取要等到觸發才算做完。訊號沒來，*OPC? 就一直不回。說明書的範例也特別提醒：程式的逾時要設得夠長，等得到這一次擷取。</p>
<p>這裡的逾時多半是「沒有觸發」：探棒沒接、觸發準位不對、產品沒通電。這是 I11 說的「預期中的失敗」：記下來、清掉 error、提示操作員，下一輪再試。不要讓整支程式停掉。</p>
<p>在第 2 步的終端機試：按「拔掉 CH1 的探棒」，送 <code>ACQ:STOPAFTER SEQ</code>、<code>ACQ:STATE ON</code>、<code>*OPC?</code>。</p>`),
ask('記錄長度改成 20000，程式還是只拿到 2500 點，為什麼？',
 `<p>說明書：改了記錄長度，DATA:STOP 不會自己跟著變。STOP 還是 2500，所以只送前 2500 點。</p>
<p>做法：每次設定記錄長度時，同時把 DATA:STOP 設成一樣（或更大）；抓之前問一次 <code>WFMOUTPRE:NR_PT?</code> 確認這次會送幾點。</p>
<p>你的讀取程式不用改：第 3 次讀多少，是從標頭的長度算出來的，不是寫死 2000。這就是照標頭讀的好處。</p>`),
ask('改成抓 CH2，程式卡在 CURVE? 一直等到逾時。示波器沒有回錯誤訊息，怎麼查？',
 `<p>說明書：要抓的通道沒有顯示在螢幕上時，CURVE? 什麼都不回，只在事件佇列記下 2244（Waveform requested is not activated）和 420（Query UNTERMINATED）。</p>
<p>所以「不回應」又出現了，跟 I5 的電表一樣：要自己去問。送 <code>ALLEV?</code> 把事件讀出來。解法是先 <code>SELECT:CH2 ON</code>。</p>`),

...I12_LV,
C.h3('回頭看','','跟電表比，哪裡不同'),
C.table(['接入單上的事','數位電表（I5）','示波器','所以程式哪裡不同'],[
 ['一次回多少','一個數字','一整段：1000～5000000 點','byte count 從標頭算，不寫死'],
 ['資料長什麼樣子','文字加 \\n','#42000＋位元組＋\\n','照長度讀；讀資料時關掉結尾字元'],
 ['數字的意思','就是電壓','螢幕上的小格','用 YMULT、YOFF、YZERO 換算，每次都重新問'],
 ['什麼時候量完','送 READ? 就量','要等觸發','*OPC? 等；逾時＝沒觸發，不是斷線'],
 ['出錯時','SYST:ERR?','ALLEV?','卡住時先問事件']
]),
`<p>六個步驟一樣，問的問題一樣，答案不一樣，所以程式不一樣。這一課新學的只有兩件事：<b>照長度讀</b>，和<b>拿儀器給的參數換算</b>。下次遇到頻譜分析儀、網路分析儀、任意波形產生器，你會看到同樣的 # 開頭的區塊。</p>`,
tip('繼續練','到 <a href="instlab.html">儀器接入練習台</a> 選「TBS2000B 示波器」，有三個任務；②「把原始資料變成數字」也有示波器的題目。'),
C.h3('做','b','用真的 LabVIEW 讀一塊波形：軟儀器'),
`<p>I4 的軟儀器也有這台示波器：<code>TCPIP0::127.0.0.1::5565::SOCKET</code>。命令、預設值、資料格式和這一課一樣。下載：<a href="softinst/soft_instruments.py" download>soft_instruments.py</a>（說明：<a href="softinst/README.md">README</a>）。</p>
<p>我們用 NI-VISA 實際連過：結尾字元打開、byte count 給 5000 讀 CURVE?，VISA Read 真的會停在資料裡的第一個 0A；照長度讀 2、4、2001，讀資料那一次把 Termination Character Enable 寫成 False，就收到完整的 2001 個位元組，下一個查詢也不會讀到殘留。你在 LabVIEW 裡也做一次，把兩種結果都看過。</p>
<p>在軟儀器的視窗打 <code>x</code> 再按 Enter，可以拔掉 CH1 的探棒，練「*OPC? 等不到觸發」那一段。</p>`,

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'CURVE? 回 #42000 開頭。這代表？',o:['後面的長度欄有 4 個字元，資料有 2000 個位元組','資料有 42000 個位元組','有 4 個通道、每個 2000 點','錯誤碼 42000'],a:0,ex:'# 之後第一個字元說明長度欄有幾個字元。'},
 {q:'讀 CURVE? 時用「讀到結尾字元就停」，只收到幾百個位元組。最可能的原因？',o:['資料裡剛好有一個位元組是 0A，被當成 \\n','示波器只送了幾百個','網路太慢','byte count 太大'],a:0,ex:'二進位資料不能靠結尾字元判斷結束，要照標頭的長度讀。'},
 {q:'RIBINARY、寬度 1 的資料用 String To Byte Array 轉，負的點變成 200 多。該怎麼改？',o:['用 Type Cast 轉成 I8 陣列','每一點減 256','改用 Decimal String To Number','把 HEADER 打開'],a:0,ex:'RIBINARY 是有號的，U8 沒有負號。'},
 {q:'一點的資料是 30，YMULT 0.04、YOFF 5、YZERO 0。電壓是？',o:['1.0 V','1.2 V','1.4 V','0.2 V'],a:0,ex:'(30 − 5) × 0.04 ＝ 1.0 V。'},
 {q:'2000 個點要換算成電壓，最簡單的做法？',o:['陣列直接減、乘、加，LabVIEW 會對每個元素做','For Loop 跑 2000 次','While Loop 一點一點讀','換成 ASCII 再用字串函式'],a:0,ex:'算術函式可以直接接陣列。'},
 {q:'為什麼每次抓波形都要重新問 YMULT、YOFF？',o:['V/div、位置一改，這些參數就變了','示波器每秒會忘記','不問就不能 CURVE?','說明書規定一定要問'],a:0,ex:'一筆波形配一組參數，存下來的資料才換算得對。'},
 {q:'單次擷取後 *OPC? 逾時。最可能的情況？',o:['沒有觸發：訊號沒來或觸發準位不對','網路線斷了','YMULT 太小','DATA:STOP 太大'],a:0,ex:'單次擷取要等到觸發才算做完；這是預期中的失敗，提示操作員、下一輪再試。'},
 {q:'記錄長度改成 20000，CURVE? 還是只送 2500 點。原因？',o:['DATA:STOP 不會跟著記錄長度改','示波器只能送 2500 點','HEADER 沒關','寬度要改成 2'],a:0,ex:'要自己把 DATA:STOP 設成記錄長度。'}
]}
]});
})();
