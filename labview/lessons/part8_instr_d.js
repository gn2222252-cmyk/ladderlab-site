/* 第八部分：接入新儀器（I7）溫控器 台達 DTB：它說的不是文字（Modbus RTU）
   儀器事實出自台達 B 系列 Instruction Sheet 的 RS-485 Communication 一節：鮑率範圍、ASCII／RTU、功能碼 03H／06H／02H／05H、
   1000H＝PV（單位 0.1）、1001H＝SV、0810H＝通訊寫入許可、PV 錯誤值 8002H／8003H／8004H、RTU 範例 01 03 10 00 00 02 C0 CB。
   出廠的站號與通訊格式在那份文件裡查不到，所以課文要學生到面板讀。
   例外回覆（功能碼加 80H）與寫入回覆（原樣送回）是 Modbus 協定本身的規則。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='接入新儀器';
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const hx=(n,w)=>(n>>>0).toString(16).toUpperCase().padStart(w||2,'0');
function crc16(bytes){let c=0xFFFF;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c&1)?((c>>>1)^0xA001):(c>>>1);}return c&0xFFFF;}
const withCrc=b=>{const c=crc16(b);return b.concat([c&0xFF,c>>8]);};
const bytesHTML=parts=>`<div class="frame">${parts.map(p=>`<span class="${p[2]||''}">${p[0]}<small>${p[1]||''}</small></span>`).join('')}</div>`;
function flow(items){
  const one=x=>{
    if(typeof x==='string')return `<span class="fb">${x}</span>`;
    if(x.loop)return `<span class="fl"><em>${x.label||'While Loop'}</em><span class="fin">${x.loop.map(one).join('<i class="fa">→</i>')}</span>${x.sr?`<small class="fsr">Shift Register：${x.sr}</small>`:''}</span>`;
    if(x.kase)return `<span class="fc"><em>Case：${x.label}${x.pages?'（每次只走其中一頁）':''}</em><span class="fin">${x.kase.map(one).join(x.pages?'<i class="fa">或</i>':'<i class="fa">→</i>')}</span></span>`;
    return '';
  };
  return `<div class="bdflow fig">${items.map(one).join('<i class="fa">→</i>')}</div>`;
}

/* ---------- 模擬的溫控器：只懂 Modbus RTU ---------- */
function makeDTB(){
  const S={station:1,pv:250,sv:300,wen:0,sensor:true};
  function reply(req){
    if(req.length<4)return null;
    const body=req.slice(0,-2),c=crc16(body);
    if((c&0xFF)!==req[req.length-2]||(c>>8)!==req[req.length-1])return null;      // CRC 不對：不回
    if(req[0]!==S.station)return null;                                              // 不是叫我：不回
    const f=req[1],addr=(req[2]<<8)|req[3],n=(req[4]<<8)|req[5];
    const exc=code=>withCrc([S.station,f|0x80,code]);
    if(f===3){
      if(n<1||n>8)return exc(3);
      const out=[];
      for(let i=0;i<n;i++){const a=addr+i;let v;
        if(a===0x1000)v=S.sensor?S.pv:0x8003;else if(a===0x1001)v=S.sv;else if(a===0x1002)v=5000;else if(a===0x1003)v=0xFC18;else return exc(2);
        out.push((v>>8)&0xFF,v&0xFF);}
      return withCrc([S.station,3,out.length].concat(out));
    }
    if(f===6){
      if(addr!==0x1001)return exc(2);
      if(!S.wen)return exc(2);
      S.sv=n&0xFFFF;return req.slice();
    }
    if(f===5){
      if(addr!==0x0810)return exc(2);
      S.wen=(req[4]===0xFF)?1:0;return req.slice();
    }
    return exc(1);
  }
  function tick(){ if(S.pv<S.sv)S.pv+=Math.min(3,S.sv-S.pv);else if(S.pv>S.sv)S.pv-=Math.min(2,S.pv-S.sv); }
  return {S,reply,tick};
}
function parseHex(t){const m=t.replace(/[^0-9a-fA-F]/g,'');if(m.length%2)return null;const o=[];for(let i=0;i<m.length;i+=2)o.push(parseInt(m.substr(i,2),16));return o;}
function explain(req,rep){
  if(!rep)return '<p><b>等到逾時，沒有收到任何位元組。</b></p>';
  const p=[];p.push([hx(rep[0]),'站號','adr']);
  if(rep[1]&0x80){p.push([hx(rep[1]),'功能碼＋80H','ctl']);p.push([hx(rep[2]),'例外碼','ctl']);p.push([hx(rep[3])+' '+hx(rep[4]),'CRC','sum']);
    const wr=(req[1]===6);const why={1:'不支援這個功能碼',2:wr?'這個位址現在不能寫。這台是因為通訊寫入許可還沒打開（實機會回哪一個例外碼，說明書沒寫，這裡是模擬的）':'沒有這個位址',3:'數量或數值不合法'}[rep[2]]||'其他錯誤';
    return bytesHTML(p)+`<p><b>這是例外回覆</b>：功能碼的最高位元是 1（${hx(rep[1])}＝${hx(req[1])}＋80）。例外碼 ${hx(rep[2])}：${why}。它只有 5 個位元組。</p>`;}
  if(rep[1]===3){p.push([hx(rep[1]),'功能碼','ctl']);p.push([hx(rep[2]),'後面有幾個位元組','len']);const vals=[];
    for(let i=0;i<rep[2];i+=2){const v=(rep[3+i]<<8)|rep[4+i];vals.push(v);p.push([hx(rep[3+i])+' '+hx(rep[4+i]),'資料','dat']);}
    p.push([hx(rep[rep.length-2])+' '+hx(rep[rep.length-1]),'CRC','sum']);
    const a0=(req[2]<<8)|req[3];
    return bytesHTML(p)+'<ul>'+vals.map((v,i)=>{const a=a0+i,s=v>=0x8000?v-0x10000:v;
      const meaning=(a===0x1000&&v>=0x8002&&v<=0x8007)?`這不是溫度。說明書：${hx(v,4)}H 是錯誤值（8003H＝感測器沒接）`:`當成有號整數是 ${s}，乘 0.1 是 <b>${(s/10).toFixed(1)}</b>`;
      return `<li>位址 ${hx(a,4)}H：${hx(v>>8)} ${hx(v&0xFF)} → 高位元組在前，合成 ${hx(v,4)}H ＝ ${v}。${meaning}</li>`;}).join('')+'</ul>';}
  p.push([hx(rep[1]),'功能碼','ctl']);p.push([hx(rep[2])+' '+hx(rep[3]),'位址','adr']);p.push([hx(rep[4])+' '+hx(rep[5]),'數值','dat']);p.push([hx(rep[6])+' '+hx(rep[7]),'CRC','sum']);
  return bytesHTML(p)+'<p>寫入類的回覆是把你送的封包<b>原樣送回</b>。收到一樣的，就表示它收到並且接受了。</p>';
}
function modbusLab(el){
  el.className='mblab fig';
  const dev=makeDTB();let timer=null;
  const PRE=[
   ['讀現在溫度和設定溫度（1000H 起 2 個字）',[1,3,0x10,0x00,0,2]],
   ['讀一個不存在的位址（2000H）',[1,3,0x20,0x00,0,1]],
   ['把設定溫度改成 45.0（寫 1001H＝450）',[1,6,0x10,0x01,0x01,0xC2]],
   ['打開通訊寫入許可（位元 0810H 設為 1）',[1,5,0x08,0x10,0xFF,0x00]],
   ['問 2 號站（這條線上沒有 2 號）',[2,3,0x10,0x00,0,2]]
  ];
  el.innerHTML=`<p><b>模擬的溫控器</b>：站號 1，RTU。現在溫度 <b class="num" data-k="pv"></b> ℃，設定溫度 <b class="num" data-k="sv"></b> ℃，通訊寫入許可 <b data-k="wen"></b>
   <button type="button" class="btn" data-a="sensor">拔掉感測器</button></p>
   <p><label>選一個要送的封包（不含 CRC）：<select>${PRE.map((x,i)=>`<option value="${i}">${x[0]}</option>`).join('')}</select></label></p>
   <p><label>要送出的位元組（十六進位，可以自己改）：<input type="text" spellcheck="false" style="width:100%;max-width:26em;font:16px var(--mono);padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink)"></label></p>
   <p><button type="button" class="btn" data-a="crc">算出 CRC 加在後面</button> <button type="button" class="btn pri" data-a="send">送出</button></p>
   <div class="out" aria-live="polite"></div>`;
  const sel=el.querySelector('select'),inp=el.querySelector('input'),out=el.querySelector('.out');
  const show=()=>{el.querySelector('[data-k=pv]').textContent=dev.S.sensor?(dev.S.pv/10).toFixed(1):'—';el.querySelector('[data-k=sv]').textContent=(dev.S.sv/10).toFixed(1);el.querySelector('[data-k=wen]').textContent=dev.S.wen?'開':'關';};
  const fill=()=>{inp.value=PRE[+sel.value][1].map(b=>hx(b)).join(' ');out.innerHTML='';};
  sel.onchange=fill;fill();show();
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el.querySelector('[data-a=send]').click();}});
  timer=setInterval(()=>{if(!document.body.contains(el)){clearInterval(timer);return;}dev.tick();show();},400);
  el.querySelector('[data-a=sensor]').onclick=e=>{dev.S.sensor=!dev.S.sensor;e.target.textContent=dev.S.sensor?'拔掉感測器':'接回感測器';show();};
  el.querySelector('[data-a=crc]').onclick=()=>{const b=parseHex(inp.value);if(!b||!b.length){out.innerHTML='<p><b>這不是成對的十六進位數字。</b></p>';return;}inp.value=withCrc(b).map(x=>hx(x)).join(' ');};
  el.querySelector('[data-a=send]').onclick=()=>{const b=parseHex(inp.value);if(!b||!b.length){out.innerHTML='<p><b>這不是成對的十六進位數字。</b></p>';return;}
    const rep=dev.reply(b);show();
    let h=`<p>送出 ${b.length} 個位元組：<span class="rawstr">${b.map(x=>hx(x)).join(' ')}</span></p>`;
    if(!rep){const body=b.slice(0,-2),c=crc16(body);const crcOk=b.length>=4&&(c&0xFF)===b[b.length-2]&&(c>>8)===b[b.length-1];
      h+=explain(b,null)+`<p>${!crcOk?'最後兩個位元組不是正確的 CRC（是不是還沒按「算出 CRC」？）。CRC 不對，溫控器把整個封包當成雜訊丟掉，<b>不會回任何東西</b>。':'CRC 是對的，但站號不是 1。線上沒有這一台，所以沒有人回答。'}</p>`;}
    else h+=`<p>收到 ${rep.length} 個位元組：<span class="rawstr">${rep.map(x=>hx(x)).join(' ')}</span></p>`+explain(b,rep);
    out.innerHTML=h;};
}

/* ======================================================================
   LabVIEW 實作：I07_ReadPV.vi（讀一次 1000H、1001H：先讀 3 個，再照長度讀完）
   回覆是網頁模擬的（上面的 makeDTB 規則）。
   ====================================================================== */
const ctl=C.ctl,qd=C.qd,wt=C.wt,PR=['Functions','Programming'];
const addF=o=>{for(const k in o)if(!LV.F[k])LV.F[k]=o[k];};
addF({
 'Join Numbers':{g:'hi|lo',ins:['hi','lo'],outs:['hi.lo'],pal:[...PR,'Numeric','Data Manipulation','Join Numbers']},
 'To Word Integer':{p:'I16',a:1,pal:[...PR,'Numeric','Conversion','To Word Integer']},
 'To Double Precision Float':{p:'DBL',a:1,pal:[...PR,'Numeric','Conversion','To Double Precision Float']}
});
const NOERR={status:false,code:0,source:''};
const hexs=b=>b.map(x=>hx(x)).join(' ');
const PVSIM=['25.0 ℃（回 00 FA）','−1.0 ℃（回 FF F6）','感測器沒接（回 80 03）','封包錯或站號錯：不回'];
const pvVI={name:'I07_ReadPV.vi',view:'bd',
 fp:{w:380,h:280,items:[
  {id:'res',k:'visa',label:'Resource',x:16,y:16,w:170,v:'COM7',options:['COM7','COM3','COM4']},
  {id:'sim',k:'ring',label:'（模擬）溫控器這次',x:200,y:16,w:160,options:PVSIM,v:0},
  {id:'pv',k:'num',label:'PV (℃)',x:16,y:76,w:110,dig:1},
  {id:'body',k:'str',label:'Body（Hex Display）',x:150,y:76,w:210},
  {id:'eo',k:'err',label:'error out',x:16,y:140}]},
 bd:{w:640,h:390,nodes:[
  {id:'res',k:'ctl',t:'visa',label:'Resource',x:16,y:30},
  {id:'k1000',k:'const',t:'u32',v:1000,x:60,y:50},
  {id:'k9600',k:'const',t:'u32',v:9600,x:60,y:69},
  {id:'kev',k:'const',t:'enum',v:'Even',x:60,y:87},
  {id:'kF',k:'const',t:'bool',v:false,x:78,y:106},
  {id:'cfg',k:'fn',fn:'VISA Configure Serial Port',x:106,y:21,h:132,ins:['VISA resource name','timeout','baud rate','parity','enable termination char','error in']},
  {id:'kreq',k:'const',t:'str',v:'0103 1000 0002 C0CB',hex:true,x:160,y:103},
  {id:'wr',k:'fn',fn:'VISA Write',x:310,y:90},
  {id:'k3',k:'const',t:'i32',v:3,x:356,y:103},
  {id:'rd1',k:'fn',fn:'VISA Read',x:380,y:90},
  {id:'sb1',k:'fn',fn:'String To Byte Array',x:436,y:134},
  {id:'kidx',k:'const',t:'i32',v:2,x:470,y:172},
  {id:'idx1',k:'fn',fn:'Index Array',x:500,y:139},
  {id:'k2',k:'const',t:'i32',v:2,x:525,y:180},
  {id:'add',k:'fn',fn:'Add',x:552,y:149},
  {id:'rd2',k:'fn',fn:'VISA Read',x:150,y:240},
  {id:'sb2',k:'fn',fn:'String To Byte Array',x:210,y:246},
  {id:'body',k:'ind',t:'str',label:'Body',x:214,y:304},
  {id:'idx2',k:'fn',fn:'Index Array',x:280,y:250,ins:['array','index 0','index 1'],outs:['element 0','element 1'],h:47},
  {id:'join',k:'fn',fn:'Join Numbers',x:332,y:255},
  {id:'i16',k:'fn',fn:'To Word Integer',x:386,y:257,showName:false},
  {id:'dbl',k:'fn',fn:'To Double Precision Float',x:426,y:257,showName:false},
  {id:'k10',k:'const',t:'dbl',v:10,x:444,y:290},
  {id:'div',k:'fn',fn:'Divide',x:470,y:264,showName:false},
  {id:'pv',k:'ind',t:'dbl',label:'PV (℃)',x:512,y:268},
  {id:'cl',k:'fn',fn:'VISA Close',x:566,y:290},
  {id:'seh',k:'fn',fn:'Simple Error Handler',x:566,y:344}],
 wires:[
  {id:'w1',from:'res',to:'cfg.VISA resource name',t:'visa'},
  {id:'w2',from:'k1000',to:'cfg.timeout',t:'u32'},
  {id:'w3',from:'k9600',to:'cfg.baud rate',t:'u32'},
  {id:'w4',from:'kev',to:'cfg.parity',t:'enum'},
  {id:'w5',from:'kF',to:'cfg.enable termination char',t:'bool'},
  {id:'w6',from:'cfg.VISA resource name out',to:'wr.VISA resource name',t:'visa',pts:[[155,65],[155,101]]},
  {id:'w7',from:'cfg.error out',to:'wr.error in',t:'err',pts:[[152,109],[152,123]]},
  {id:'w8',from:'kreq',to:'wr.write buffer',t:'str'},
  {id:'w9',from:'wr.VISA resource name out',to:'rd1.VISA resource name',t:'visa'},
  {id:'w10',from:'wr.error out',to:'rd1.error in',t:'err'},
  {id:'w11',from:'k3',to:'rd1.byte count',t:'i32'},
  {id:'w12',from:'rd1.read buffer',to:'sb1.string',t:'str',pts:[[430,112],[430,150]]},
  {id:'w13',from:'sb1.unsigned byte array',to:'idx1.array',t:'u8[]'},
  {id:'w14',from:'kidx',to:'idx1.index',t:'i32',pts:[[496,181],[496,162]]},
  {id:'w15',from:'idx1.element',to:'add.x',t:'u8'},
  {id:'w16',from:'k2',to:'add.y',t:'i32',pts:[[549,189],[549,170]]},
  {id:'w17',from:'rd1.VISA resource name out',to:'rd2.VISA resource name',t:'visa',pts:[[600,101],[600,226],[136,226],[136,251]]},
  {id:'w18',from:'add.out',to:'rd2.byte count',t:'i32',pts:[[590,163],[590,218],[128,218],[128,262]]},
  {id:'w19',from:'rd1.error out',to:'rd2.error in',t:'err',pts:[[427,123],[427,210],[120,210],[120,273]]},
  {id:'w20',from:'rd2.read buffer',to:'sb2.string',t:'str'},
  {id:'w21',from:'rd2.read buffer',to:'body',t:'str',pts:[[205,262],[205,314]]},
  {id:'w22',from:'sb2.unsigned byte array',to:'idx2.array',t:'u8[]'},
  {id:'w23',from:'idx2.element 0',to:'join.hi',t:'u8'},
  {id:'w24',from:'idx2.element 1',to:'join.lo',t:'u8',mx:326},
  {id:'w25',from:'join.hi.lo',to:'i16',t:'u16'},
  {id:'w26',from:'i16.out',to:'dbl',t:'i16'},
  {id:'w27',from:'dbl.out',to:'div.x',t:'dbl'},
  {id:'w28',from:'k10',to:'div.y',t:'dbl',pts:[[467,299],[467,285]]},
  {id:'w29',from:'div.out',to:'pv',t:'dbl'},
  {id:'w30',from:'rd2.VISA resource name out',to:'cl.VISA resource name',t:'visa',pts:[[200,251],[200,236],[556,236],[556,305]]},
  {id:'w31',from:'rd2.error out',to:'cl.error in',t:'err',pts:[[202,273],[202,330],[560,330],[560,319]]},
  {id:'w32',from:'cl.error out',to:'seh.error in',t:'err',pts:[[618,312],[618,338],[558,338],[558,360]]}]},
 sim:{live:true,step(i){
  const k=+i.sim||0,E={status:true,code:-1073807339,source:'VISA Read in I07_ReadPV.vi（逾時：溫控器沒有回）'};
  if(k===3)return {out:{pv:0,body:'',eo:E},msg:'CRC 錯或站號錯，溫控器一個位元組都不回：第一個 Read 等滿 1000 ms 逾時，後面都不做。PV 停在 0，error out 有錯。',vals:{'rd1.error out':E,'rd2.error out':E,'cl.error out':E}};
  const pv=[0x00FA,0xFFF6,0x8003][k],rep=withCrc([1,3,4,pv>>8,pv&255,0x01,0x2C]);
  const head=rep.slice(0,3),bodyB=rep.slice(3),n=head[2]+2;
  const u=(bodyB[0]<<8)|bodyB[1],s=u>=0x8000?u-0x10000:u,t=s/10;
  return {out:{pv:t,body:hexs(bodyB),eo:NOERR},msg:'讀 3 個：'+hexs(head)+' → 第 3 個是 '+head[2]+'，再讀 '+head[2]+'＋2＝'+n+' 個：'+hexs(bodyB)+'。'+hx(bodyB[0])+' '+hx(bodyB[1])+' 合成 '+hx(u,4)+'H，當 I16 是 '+s+'，÷10＝'+t+(k===2?'。這不是溫度：8003H 是「感測器沒接」，要先挑出來（下面的問題）。':''),
   vals:{res:i.res,k1000:1000,k9600:9600,kev:'Even',kF:false,kreq:'01 03 10 00 00 02 C0 CB',k3:3,kidx:2,k2:2,k10:10,'rd1.read buffer':hexs(head),'sb1.unsigned byte array':head,'idx1.element':head[2],'add.out':n,'rd2.read buffer':hexs(bodyB),'sb2.unsigned byte array':bodyB,'idx2.element 0':bodyB[0],'idx2.element 1':bodyB[1],'join.hi.lo':u,'i16.out':s,'dbl.out':s,'div.out':t,'rd1.error out':NOERR,'rd2.error out':NOERR,'cl.error out':NOERR}};
 }}
};
const I07_LV=[
C.h3('LabVIEW','b','動手寫：I07_ReadPV.vi（把上面那張表畫成方塊圖）'),
`<p>上面的表格列了每一格要用的函式。這裡把它們排成一張真的方塊圖。先只讀<b>一次</b>：確定 25.0 讀得出來，再包進迴圈。</p>`,
C.plan({
 start:'File ▸ New VI，存成 <code>練習\\儀器\\I07_ReadPV.vi</code>。這一台跟前面的文字儀器差太多，不從舊 VI 改。',
 in:'送出 8 個位元組 <code>01 03 10 00 00 02 C0 CB</code>。回覆分兩次讀：先讀 3 個（站號、功能碼、後面幾個位元組），再讀「第 3 個位元組的值＋2」個（資料＋CRC）。讀到的是字串，但裡面是位元組，不是文字。',
 calc:'String To Byte Array 變成 U8 陣列 → Index Array 取前兩個 → Join Numbers（高位元組接 hi）合成 U16 → To Word Integer 當成有號的 I16 → To Double Precision Float → 除以 10。例：00 FA → 250 → 25.0 ℃；FF F6 → −10 → −1.0 ℃。',
 out:'Numeric Indicator <code>PV (℃)</code>，1 位小數（儀器的單位是 0.1 度）。另外一個字串指示器 <code>Body</code> 開 <b>Hex Display</b>，對照網頁上看到的位元組。',
 loop:'這支只做一次。確定對了再照 I4 包進 While Loop，Wait 500 ms：位址表寫 PV 每 0.4 秒才更新一次。',
 end:'error 線一路串到 VISA Close。溫控器對錯的封包不回，所以「沒回」就是 1000 ms 後的逾時錯誤，Read 後面的事都不做。CRC 驗證和例外回覆（功能碼加 80H）這一版還沒處理，下面的問題會用到。'}),
note('下面的 VI 視窗是網頁模擬的','方塊圖照真的 LabVIEW 畫。模擬的溫控器規則跟上面的封包練習台一樣；站號 1、9600、8、Even、1 是這一課假設的面板設定。'),
{steps:{title:'I07_ReadPV.vi：送封包 → 讀頭 → 照長度讀身體 → 合成溫度',lv:pvVI,steps:[
 {t:'前面板',view:'fp',add:['res','pv','body','eo','sim'],h:`<p>Resource 選 USB 轉 RS-485 的 COM 埠。放 Numeric Indicator <code>PV (℃)</code>（Display Format 1 位小數），String Indicator <code>Body</code>，右鍵選 <b>Hex Display</b>。</p>`},
 {t:'序列埠：termination char 一定要關',view:'bd',add:['res','k1000','k9600','kev','kF','cfg','w1','w2','w3','w4','w5'],h:`<p>VISA Configure Serial Port 的常數照面板抄到的：baud <code>9600</code>、parity <code>Even</code>、timeout <code>1000</code>（data bits 8、stop bits 1.0 用預設值）。</p><p>在 <b>enable termination char</b> 上 Create ▸ Constant，設成 <b>F</b>（False）。上面講過：資料剛好是 0AH 時，Read 會以為讀完了。</p>`},
 {t:'送出 8 個位元組：Hex Display 的字串常數',view:'bd',add:['kreq','wr','w6','w7','w8'],h:`<p>在 VISA Write 的 write buffer 上 Create ▸ Constant。<b>先右鍵選 Hex Display</b>，再打 <code>0103 1000 0002 C0CB</code>（每兩個十六進位字是一個位元組，空白 LabVIEW 會自己排）。常數左邊出現小小的 x，就表示現在是 Hex Display。</p><p class="qd">先抄說明書的範例封包，能通以後才改成自己組（用 Byte Array To String）。</p>`},
 {t:'讀頭：VISA Read 讀 3 個',view:'bd',add:['k3','rd1','w9','w10','w11'],h:`<p>VISA Read 的 byte count 接 <code>3</code>：站號、功能碼、「後面還有幾個位元組」。</p>`},
 {t:'從頭算出還要讀幾個',view:'bd',add:['sb1','kidx','idx1','k2','add','w12','w13','w14','w15','w16'],h:`<p>${fn('Programming','String','String/Array/Path Conversion','String To Byte Array')} ${qd('String To Byte Array')} 把 3 個位元組變成 U8 陣列。${fn('Programming','Array','Index Array')} ${qd('Index Array')} 的 index 接 <code>2</code>（第 3 個，從 0 數）。${fn('Programming','Numeric','Add')} 加 <code>2</code>（CRC 兩個位元組）。</p>${wt([
 ['VISA Read（讀頭）的 read buffer','String To Byte Array 的 string'],
 ['unsigned byte array','Index Array 的 array','粗藍線：U8 陣列'],
 ['常數 2','Index Array 的 index'],
 ['Index Array 的 element','Add 的 x','例：04'],
 ['常數 2','Add 的 y','x + y = 6']])}`},
 {t:'讀身體：byte count 用算的',view:'bd',add:['rd2','w17','w18','w19'],h:`<p>第二個 VISA Read。紫線、黃線從第一個 Read 接過來，byte count 接 Add 的結果。</p>${wt([
 ['VISA Read（讀頭）的 VISA resource name out','VISA Read（讀身體）的 VISA resource name'],
 ['Add 的 x+y','VISA Read（讀身體）的 byte count','6：4 個資料＋2 個 CRC'],
 ['VISA Read（讀頭）的 error out','VISA Read（讀身體）的 error in']])}`},
 {t:'兩個位元組合成溫度',view:'bd',add:['sb2','body','idx2','join','i16','dbl','k10','div','pv','w20','w21','w22','w23','w24','w25','w26','w27','w28','w29'],h:`<p>身體也用 String To Byte Array 變成陣列。Index Array 往下拉成兩格，<b>index 都不接</b>：第一格預設取第 0 個，第二格自動取下一個（第 1 個）。</p>${wt([
 ['element 0（00）','Join Numbers 的 hi',fn('Programming','Numeric','Data Manipulation','Join Numbers')],
 ['element 1（FA）','Join Numbers 的 lo','高位元組在前：Modbus 規定'],
 ['Join Numbers 的 hi.lo（U16）','To Word Integer',fn('Programming','Numeric','Conversion','To Word Integer')+'：溫度會是負的，要當 I16'],
 ['I16','To Double Precision Float','先變 DBL 再除，才有小數'],
 ['DBL','Divide 的 x；常數 10 接 y','單位 0.1 度'],
 ['Divide 的 x/y','PV (℃)','']])}`},
 {t:'VISA Close、Simple Error Handler；Run',view:'split',add:['cl','seh','w30','w31','w32'],h:`<p>收尾跟前面每一支一樣。Run：PV 是 25.0。在模擬上把「溫控器這次」換成 −1.0 ℃ 和「感測器沒接」各看一次（改值就會重算）。</p>`}
]}},
ask('改一個數字，先預測結果：把 To Word Integer 刪掉，Join Numbers 直接接 To Double Precision Float。溫控器回 FF F6 時，PV 顯示多少？回 80 03（感測器沒接）時呢？',
 `<p>FF F6 會顯示 <b>6552.6</b>：FFF6H 當成沒有正負號的 U16 是 65526，÷10。這就是上面說的「零下要當 I16」。</p>
<p>80 03 不管有沒有 To Word Integer 都不是溫度：U16 是 32771 → 3277.1；I16 是 −32765 → −3276.5。所以在 Join Numbers 之後、換算以前，要先比對 8002H～8004H（Equal? 或 In Range and Coerce），是錯誤值就走另一頁 Case，不要算成溫度。這一步就是你下一個要加的東西。</p>`)
];

L.push({id:'I07',order:29.8,no:'I7',part:PART,title:'溫控器：它說的不是文字（Modbus）',mins:70,
goals:[['學會','看懂 Modbus 的位址表和封包；沒有結尾字元時怎麼知道一筆讀完了；兩個位元組怎麼合成一個數值；CRC 是做什麼的。'],['做出','親手送出讀溫度的封包，並把回覆的每一個位元組解釋出來。'],['為什麼','溫控器、變頻器、電力錶、遠端 I/O、很多 PLC，講的都是 Modbus。這是工廠裡最常遇到的一種。'],['先備','I2～I6。這一課最難，因為前面學的「文字、結尾字元」在這裡都不適用。']],
check:'給你位址表的一行和一串回覆位元組，你能說出：封包怎麼組、回覆有幾個位元組、哪兩個位元組是數值、換算後是幾度。',
body:[
C.h3('情境','x','第四台：台達 DTB 溫控器'),
`<p>任務：烤箱上有一顆溫控器。LabVIEW 要每秒讀現在的溫度，並且能從電腦改設定溫度。</p>`,
C.h3('第 1 步','','看背板'),
`<p>沒有 USB，也沒有 9 針接頭。端子台上有兩個端子，標著 <b>D+</b> 和 <b>D−</b>。這是 <b>RS-485</b>。</p>`,
ask('電腦沒有 RS-485，怎麼接？它跟 RS-232 差在哪？',
 `<p>買一個「USB 轉 RS-485」的轉接器，D+ 接 D+、D− 接 D−。有的轉接器標的是 A、B 或 DATA+、DATA−，各家的正負定義不完全一樣；參數都對卻沒有回應時，把兩條線對調再試一次。插上電腦，一樣多出一個 COM 埠。所以還是序列埠，還是 VISA。</p>
<p>差別有一個會影響程式：RS-232 一條線只接一台設備。RS-485 同一對線上可以並聯很多台，像一條走廊上有很多個房間。</p>
<p>很多台共用一條線，你說話的時候就要先講「我在叫誰」。所以每一台有一個號碼，叫<b>站號</b>。這是前三台沒有的東西，接入單要多一格。</p>`),
C.h3('第 2 步','','翻說明書：這次沒有命令表'),
`<p>說明書的 RS-485 Communication 一節裡，找不到 <code>VOUT1?</code> 那種文字命令。它給的是三樣東西：</p>
<ul><li>支援的鮑率（2400 到 38400）和通訊協定：<b>Modbus</b>，分 ASCII 和 RTU 兩種模式。</li>
<li>幾個<b>功能碼</b>：03H 是「讀暫存器」，06H 是「寫一個暫存器」。</li>
<li>一張<b>位址表</b>：</li></ul>
<p>三個新名詞：<b>暫存器</b>是設備裡一格一格放資料的位置，每一格放一個 16 位元的數，每一格有自己的<b>位址</b>。<b>功能碼</b>是「要它做哪一種事」的代號。數字後面的 H 表示十六進位。</p>
<p>ASCII 和 RTU 是同一種內容的兩種寫法：RTU 直接送位元組，比較短，最常用；ASCII 把每個位元組寫成兩個文字字元，用冒號開頭、CR LF 結尾。電腦和溫控器面板一定要選同一種，這一課用 RTU。</p>`,
C.table(['位址','內容','備註'],[
 ['1000H','現在溫度（PV）','單位 0.1 度，每 0.4 秒更新一次'],
 ['1001H','設定溫度（SV）','單位 0.1 度'],
 ['0810H（位元）','通訊寫入許可','出廠是 0：不允許從通訊寫入']
]),
ask('出廠的站號、鮑率是多少？說明書這一節沒寫。',
 `<p>跟電源那台的鮑率一樣：<b>沒寫的不要猜，去機器上看。</b></p>
<p>溫控器面板的設定選單裡有通訊這一組：站號、鮑率、資料長度、同位、停止位元、ASCII 或 RTU。一項一項抄下來。前一個使用者可能改過，所以就算說明書有寫出廠值，也要以面板為準。</p>
<p>這一課假設你在面板上抄到的是：<b>站號 1、9600、8 資料位、偶同位、1 停止位、RTU</b>。</p>`),
ask('Modbus 跟前面的命令有什麼根本的不同？',
 `<p>前三台，你送的是「一句話」，內容是人看得懂的字。</p>
<p>Modbus 不是一句話，是一張<b>填好的表格</b>。格子的順序和大小是固定的：</p>
<p>「幾號站，請你做哪一種事，從哪個位址開始，要幾個。」再加兩個位元組的檢查碼。</p>
<p>設備那邊也不是用「名字」找資料，而是用<b>位址</b>。你不能問「現在幾度」，只能說「給我 1000H 那一格的內容」。1000H 是什麼意思，要回去查位址表。</p>`),
ask('要讀現在溫度和設定溫度。照「幾號站、做哪種事、從哪個位址開始、要幾個」，四格各填什麼？',
 `<p>查位址表和功能碼：</p>
<ul><li>幾號站：面板上抄到的 1。</li><li>做哪種事：讀暫存器，功能碼 03。</li><li>從哪個位址開始：現在溫度在 1000H。</li><li>要幾個：現在溫度和設定溫度剛好是連著的兩格（1000H、1001H），一次要 2 個。</li></ul>
<p>每一格在封包裡占幾個位元組是協定規定的：站號 1 個、功能碼 1 個、位址 2 個、數量 2 個。所以是 01、03、10 00、00 02。</p>`),
`<p>對照說明書給的範例，前六個位元組一樣。最後多出來的兩個是檢查碼（CRC），後面會講它是什麼，現在先知道它一定要有：</p>`,
bytesHTML([['01','站號','adr'],['03','功能碼：讀','ctl'],['10 00','起始位址 1000H','adr'],['00 02','要 2 個','len'],['C0 CB','檢查碼','sum']]),
ask('這 8 個位元組，可以像 *IDN? 那樣用鍵盤打出來嗎？',
 `<p>不行，這是最容易搞錯的地方。</p>
<p>第一個位元組是<b>數值 1</b>，不是字元「0」和字元「1」。字元「1」的值是 31H。你在字串常數裡打 <code>0103</code>，送出去的是 30 31 30 33 四個位元組，溫控器完全看不懂。</p>
<p>在 LabVIEW 裡有兩種正確的做法：</p>
<ul><li>對字串常數按右鍵選 <b>Hex Display</b>，再輸入 <code>0103 1000 0002 C0CB</code>。這時候打的每兩個字才是一個位元組。</li>
<li>用 U8 的陣列裝 1、3、16、0、0、2…，再用 ${fn('String','Path/Array/String Conversion','Byte Array To String')} 轉成字串給 VISA Write。站號、位址會變的時候用這一種。</li></ul>
<p>判斷的方法：說明書把封包寫成一格一格的十六進位數字，就是位元組，要用 Hex Display；寫成一串看得懂的字，就是文字。</p>`),
ask('結尾字元是什麼？',
 `<p><b>沒有。</b></p>
<p>文字型的儀器可以約定「看到換行就是結束」，因為正常的內容裡不會出現換行。位元組型的封包不行：資料可以是任何值，溫度剛好是 10（0AH）的時候，資料裡就會出現一個跟換行一模一樣的位元組。</p>
<p>所以用 Modbus RTU 時，VISA 的 <b>Enable Termination Char 要設成 False</b>。不關掉的話，Read 會在資料中間看到 0AH 就提早結束，而且只在某些溫度發生，非常難查。</p>`),
ask('沒有結尾字元，Read 怎麼知道讀完了？',
 `<p>接入單上最容易漏的那一格又來了。這次的答案是：<b>用算的</b>。</p>
<p>回覆的格式是固定的：站號 1 個、功能碼 1 個、「後面有幾個位元組」1 個、資料、CRC 2 個。你要了 2 個暫存器，每個 2 個位元組，所以是 1＋1＋1＋4＋2＝<b>9 個</b>。</p>
<p>直接叫 VISA Read 讀 9 個位元組可以，但有一個破綻：設備回的如果是「例外回覆」，只有 5 個位元組，你會等到逾時。</p>
<p>比較穩的讀法分兩次：</p>
<ol><li>先讀 <b>3 個</b>位元組：站號、功能碼、第三個位元組。</li>
<li>看功能碼。正常的話，第三個位元組就是「後面還有幾個資料位元組」，再讀那麼多個加 2 個 CRC。功能碼的最高位元是 1（例如 83H）就是例外回覆，再讀 2 個就結束。</li></ol>
<p>「長度寫在封包前面，先讀頭、再照頭讀身體」，這個讀法之後接網路設備也是同一招。</p>`),

C.h3('第 3、4 步','','講到話，看原始回覆'),
note('這是網頁模擬的溫控器','封包格式、功能碼、位址照說明書。站號和通訊格式是這一課假設的。'),
{fn:modbusLab},
{todo:[
 '選第一個封包，<b>不要</b>按「算出 CRC」，直接送出。看會怎樣。',
 '按「算出 CRC 加在後面」，再送出。對照下面的解說，找出哪兩個位元組是現在溫度。',
 '選「讀一個不存在的位址」，算 CRC、送出。回覆有幾個位元組？功能碼變成什麼？',
 '選「問 2 號站」，算 CRC、送出。',
 '選「把設定溫度改成 45.0」，算 CRC、送出。成功了嗎？',
 '選「打開通訊寫入許可」送出，然後再送一次改設定溫度的封包。看上面的設定溫度和現在溫度怎麼變。',
 '按「拔掉感測器」，再讀一次溫度。讀到的數值是什麼？'
]},
ask('沒加 CRC、站號不對，都是「沒有回應」。為什麼它不回一個錯誤？',
 `<p>因為在一條很多台共用的線上，「不回答」才是安全的做法。</p>
<p>CRC 不對，表示這個封包在路上壞了，連「在叫誰」都不能相信，所以每一台都當作沒聽到。站號不是自己，那是在叫別人，更不該出聲，否則兩台同時講話，線上就全亂了。</p>
<p>對你的程式來說，這表示：<b>逾時是 Modbus 最常見的錯誤回報方式</b>。逾時了要查的順序是：站號 → 通訊參數 → CRC 算得對不對 → 線。</p>`),

C.h3('第 5 步','','兩個位元組變成一個溫度'),
`<p>讀溫度的回覆是 9 個位元組，例如：</p>`,
bytesHTML([['01','站號','adr'],['03','功能碼','ctl'],['04','後面 4 個','len'],['00 FA','1000H 的內容','dat'],['01 2C','1001H 的內容','dat'],['xx xx','CRC','sum']]),
ask('00 FA 是幾度？',
 `<p>分三步，每一步都有一個要從說明書確認的事：</p>
<ol><li><b>哪個位元組在前？</b>Modbus 規定高位元組先送。所以是 00FAH，不是 FA00H。</li>
<li><b>合起來是多少？</b>00FAH ＝ 250。</li>
<li><b>單位是什麼？</b>位址表寫「單位 0.1 度」。250 × 0.1 ＝ <b>25.0 度</b>。</li></ol>
<p>在 LabVIEW 裡：把回覆字串用 ${fn('String','String/Array/Path Conversion','String To Byte Array')} 變成 U8 陣列，用 Index Array 取出第 3、第 4 個元素，接到 ${fn('Numeric','Data Manipulation','Join Numbers')}（高位元組接上面那個輸入），得到一個 16 位元的整數。轉成 DBL，除以 10。</p>`),
ask('溫度如果是零下呢？',
 `<p>零下 1.0 度，設備送的是 FF F6。當成沒有正負號的整數是 65526，除以 10 變成 6552.6 度，明顯不對。</p>
<p>16 位元的暫存器要表示負數，用的是二補數。所以合成之後要當成<b>有號的 I16</b>：FFF6H 當成 I16 是 −10，除以 10 是 −1.0。</p>
<p>該用有號還是無號，看這個量會不會是負的。溫度會，所以用 I16。接上實機以後，找機會讓它讀一次零下的值確認。</p>`),
ask('拔掉感測器之後讀到 8003H。這是幾度？',
 `<p>不是溫度。說明書列了幾個特別的值：8002H 是還在初始化，8003H 是感測器沒接，8004H 是感測器輸入錯誤。</p>
<p>跟電表的 9.9E37、天平的 OL 一樣：<b>同一個位置，有時候放的是數值，有時候放的是「我有狀況」</b>。轉成溫度以前，先用 Case 把這幾個值挑出來。</p>
<p>你會發現每一台儀器都有這種設計，只是長相不同。翻說明書的時候，專門找一下「錯誤時會回什麼」。</p>`),

C.h3('做','b','在 LabVIEW 裡做一次：讀一筆溫度'),
`<p>剛才在網頁上手動做的事，一格一格搬進 LabVIEW。先只做「讀一次」，不要迴圈：</p>`,
C.table(['要做的事','函式','從哪裡拿','注意'],[
 ['設定序列埠','VISA Configure Serial Port',fn('Instrument I/O','Serial'),'照面板抄到的參數；<b>Enable Termination Char 接 False</b>；timeout 接 1000'],
 ['準備封包','字串常數（Hex Display）',fn('String'),'先直接打說明書的範例 <code>0103 1000 0002 C0CB</code>。能通以後再改成自己組'],
 ['送出','VISA Write',fn('Instrument I/O','Serial'),'—'],
 ['讀頭','VISA Read',fn('Instrument I/O','Serial'),'byte count 接 3'],
 ['讀身體','VISA Read',fn('Instrument I/O','Serial'),'byte count 接「第 3 個位元組的值 ＋ 2」'],
 ['字串變位元組','String To Byte Array',fn('String','Path/Array/String Conversion'),'之後用 Index Array 取出要的那兩個'],
 ['兩個位元組合成一個數','Join Numbers',fn('Numeric','Data Manipulation'),'高位元組接上面的輸入'],
 ['當成有號的數','To Word Integer（I16）',fn('Numeric','Conversion'),'溫度可能是負的'],
 ['變成度','Divide',fn('Numeric'),'除以 10'],
 ['關閉','VISA Close',fn('Instrument I/O','Serial'),'—']
]),
`<p>兩次 VISA Read 讀到的字串，都另外接到開了 Hex Display 的字串指示器。先確認看到的位元組跟網頁上一樣，再往下接轉換。</p>`,
...I07_LV,
C.h3('懂','','CRC：不用背算法，但要知道三件事'),
`<ul><li><b>它是什麼</b>：把前面所有位元組照固定的算法算出兩個位元組，附在最後。接收的那一邊照同樣的算法再算一次，結果不一樣就表示封包在路上壞了。</li>
<li><b>送的時候</b>：你要算對，不然設備不理你（剛才試過）。</li>
<li><b>收的時候</b>：你也要驗。CRC 不對的回覆不要拿去轉溫度。</li></ul>`,
ask('LabVIEW 裡 CRC 要怎麼算？',
 `<p>有現成的就用現成的。NI 和社群都有 Modbus 函式庫，裝了以後有「讀暫存器」「寫暫存器」的 VI，封包和 CRC 它會處理。工作上通常這樣做。</p>
<p>但值得看一眼算法長什麼樣，因為它剛好是 For Loop 和 Shift Register 的標準用法：</p>
<ul><li>有一個 16 位元的值，一開始是 FFFFH。它每處理一個位元組就會被改掉，而且下一個位元組要用改過的。→ <b>Shift Register</b>。</li>
<li>封包裡的每個位元組都要處理一次，次數等於陣列長度。→ <b>For Loop</b>，自動索引。</li>
<li>每個位元組裡面再重複 8 次（一個位元一次）。→ 裡面再一層 <b>For Loop</b>，N＝8。</li></ul>
<p>你不需要現在寫出來。重點是：看到「一個值被反覆更新」，就想到 Shift Register；看到「每個元素做一次」，就想到 For Loop。</p>`),

C.h3('第 6 步','','規劃程式'),
ask('要改設定溫度，直接寫 1001H 就好嗎？',
 `<p>剛才試過，被拒絕了。位址表上有一行小字：0810H「通訊寫入許可」出廠是 0。要先把它設成 1，溫控器才接受從通訊來的寫入。</p>
<p>這件事每一圈都要做嗎？不用，開機做一次。所以它放在迴圈<b>外面</b>，跟設定序列埠排在一起。</p>
<p>這種「要先打開某個開關才能寫」的規定，在工業設備上很常見。它不會寫在顯眼的地方。寫入沒效果的時候，回去把位址表從頭到尾看一遍。</p>`),
ask('寫入之後，怎麼知道成功了？',
 `<p>Modbus 的寫入有回覆：設備把你送的封包<b>原樣送回來</b>。收到一模一樣的，就是成功；收到例外回覆，或逾時，就是失敗。</p>
<p>所以程式裡要比對「送出去的」和「收回來的」是不是相等。這比電源那台省事，不用另外送一次查詢。</p>`),
ask('一秒讀幾次才對？',
 `<p>位址表寫：現在溫度每 0.4 秒更新一次。你讀得比這個快，只會讀到重複的值。</p>
<p>所以迴圈的等待設 500 ms 就夠了。讀取的速度要看設備多久更新一次，不是越快越好。</p>`),
flow(['設定序列埠（關掉結尾字元）','寫 0810H＝1',{loop:[{kase:['組寫入封包、送出','讀回、比對'],label:'按了「套用」'},'組讀取封包＋CRC','送出','讀 3 個','照長度讀完','驗 CRC',{kase:['正常：合成 I16、÷10','錯誤值：顯示狀況','例外或 CRC 錯：計錯'],label:'回覆是哪一種',pages:true},'等 500 ms'],label:'While Loop',sr:'error、連續失敗次數'},'關閉']),
ask('一條線上接了五顆溫控器，怎麼讀？',
 `<p>同一條線上一次只能有一台在講話。所以不能五台同時問，要一台問完、等它答完，再問下一台。</p>
<p>「同樣的事對每一台做一次，總共幾台是知道的」，這是 <b>For Loop</b>：把站號放在一個陣列裡，自動索引，裡面就是剛才那一串「組封包、送、讀、驗、轉」。</p>
<p>到這裡可以把「讀一台」那一串包成一個 SubVI，輸入是站號和位址，輸出是數值。這就是你自己寫的驅動。</p>`),
C.table(['接入單上的事','前三台','溫控器','所以程式哪裡不同'],[
 ['說的是','文字','位元組','字串要用 Hex Display；用 Byte Array 組封包'],
 ['一筆到哪裡結束','結尾字元','沒有，長度要算','關掉 termination char；先讀頭再讀身體'],
 ['在叫誰','不用講','站號','封包第一個位元組；多台用 For Loop'],
 ['怎麼找資料','命令的名字','位址','查位址表'],
 ['數值','十進位文字','兩個位元組的整數，要乘 0.1','Join Numbers、I16、除以 10'],
 ['檢查碼','沒有','CRC','送要算、收要驗'],
 ['出錯的樣子','錯誤佇列','例外回覆，或不回','先看功能碼最高位元；逾時要處理']
]),

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'RS-485 的設備為什麼需要站號？',o:['同一對線上並聯很多台，要說明在叫誰','讓傳輸比較快','RS-485 規定一定要有密碼','為了計算 CRC'],a:0,ex:'RS-232 一條線一台，不需要。'},
 {q:'在一般顯示的字串常數裡打 0103，VISA Write 送出去的是？',o:['30 31 30 33 四個位元組（字元 0、1、0、3）','01 03 兩個位元組','一個位元組 103','什麼都不送'],a:0,ex:'要送數值 01 03，字串常數要開 Hex Display。'},
 {q:'Modbus RTU 為什麼要把 Enable Termination Char 關掉？',o:['資料可以是任何值，可能剛好等於結尾字元，Read 會提早結束','RTU 比較慢','VISA 不支援','這樣 CRC 才會對'],a:0,ex:'而且只在某些數值才發生，很難查。'},
 {q:'用功能碼 03 讀 3 個暫存器。正常的回覆有幾個位元組？',o:['11 個：1＋1＋1＋6＋2','3 個','8 個','9 個'],a:0,ex:'站號、功能碼、位元組數各 1，每個暫存器 2，CRC 2。'},
 {q:'回覆的資料是 01 2C，位址表寫單位 0.1 度。是幾度？',o:['30.0','1.44','300','11265'],a:0,ex:'高位元組在前：012CH＝300，乘 0.1。'},
 {q:'回覆是 01 83 02 加兩個 CRC。這是什麼？',o:['例外回覆：功能碼 03 加上 80H，例外碼 02 表示沒有這個位址','溫度 2 度','站號 83 的回覆','CRC 錯誤'],a:0,ex:'功能碼最高位元是 1 就是例外回覆，只有 5 個位元組。'},
 {q:'送了封包卻逾時。下面哪一個「不是」可能的原因？',o:['溫度太高','站號不對','CRC 算錯','鮑率或同位不對'],a:0,ex:'Modbus 設備對聽不懂、或不是叫它的封包，一律不回。'},
 {q:'CRC 的算法裡，那個每處理一個位元組就被更新的 16 位元值，要放在哪裡？',o:['Shift Register','一般通道','常數','Local Variable 比較好'],a:0,ex:'值被反覆更新、下一次要用改過的，就是 Shift Register。'}
]}
]});
})();
