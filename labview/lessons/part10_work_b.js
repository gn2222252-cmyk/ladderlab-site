/* 第十部分：實務案例（W3、W4、W5）：myRIO 搬運小車操作盒。
   素材來源（只取觀念，用自己的話重寫）：myRIO 手臂班講義 第 3～5 章
   - 矩陣鍵盤（Digilent PmodKYPD）：COL1～4 → MXP B DIO0～3（數位輸入），ROW1～4 → B DIO4～7（數位輸出），VCC 接 +3.3 V；
     一次把一列拉 LOW、讀四行；講義用 Rotate 1D Array 產生列的圖樣、Search 1D Array 找按鍵、Value Has Changed PtByPt 去彈跳、密碼比對。
   - 序列 LCD（Digilent PmodCLS）：UART 9600 baud（MD0～MD2 跳線選鮑率）、只接 TX；指令格式 ESC [ 參數 指令字元
     （j 清除並回到開頭、列;行H 移游標、0h/1h 換行長度、0c/1c/2c 游標樣式、@／A 捲動）；做成 SubVI、接點設 Required、寫 VI 說明、附範例。
   - 伺服馬達：50 Hz（週期 20 ms）、Duty ＝ 高電位時間 ÷ 20 ms；連續旋轉伺服要自己找停止點（講義那顆約 1.46 ms），
     講義標的安全範圍 0.7～2.0 ms、極限 0.5～2.5 ms；兩顆伺服做前後左右，鍵盤控制、LCD 顯示。
   - myRIO-1900 User Guide：MXP DIO0～13 內建 40 kΩ 上拉到 3.3 V；UART 腳和 DIO 電氣特性相同；+5 V 輸出每個接頭最多 100 mA；
     MXP 腳位：DIO0～7 ＝ 11、13、15、17、19、21、23、25；UART.TX ＝ 14、UART.RX ＝ 10；DIO8～10（PWM0～2）＝ 27、29、31；+3.3 V ＝ 33；DGND ＝ 30。
   - myRIO 的 PWM Express VI，Duty Cycle 是 0～1（不是 %）。 */
(function(){
const L=window.LESSONS,fn=C.fn,qd=C.qd,wt=C.wt;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const PR=['Functions','Programming'];
const addF=o=>{for(const k in o)if(!LV.F[k])LV.F[k]=o[k];};
addF({
 'Rotate 1D Array':{g:'[↻]',ins:['n','array'],outs:['output array'],pal:[...PR,'Array','Rotate 1D Array']},
 'Reshape Array':{g:'[▭]',ins:['array','dimension size'],outs:['output array'],pal:[...PR,'Array','Reshape Array']}
});
const myrio=(...p)=>C.pal('Functions','myRIO',...p);
const KEYS='123A456B789C0FED'.split('');
const X=(id,name,icon,ins,outs,x,y,o)=>Object.assign({id,k:'sub',name,top:'myRIO',color:'#2f6fd0',icon:[icon],ins,outs,x,y,w:70,h:Math.max(44,Math.max(ins.length,outs.length)*15+14),err:true,
 tip:'myRIO 的 Express VI：方塊圖右鍵 ▸ myRIO 選盤。放下去會跳出設定視窗；之後雙擊可以再改。'},o||{});
const quote=t=>`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px">${t}</div>`;

/* 整個專案的需求（W3～W5 共用） */
const PROJECT=quote(`<p>研究室的老師：「實驗室有一台用兩顆伺服馬達當輪子的搬運小車，想做一個操作盒：<b>輸入密碼才能用</b>，用鍵盤控制前後左右，上面有一個小螢幕顯示狀態。用 myRIO 做，手邊有 Digilent 的 4×4 鍵盤和序列 LCD。」</p>`);
const PROJECT_SPEC=C.table(['編號','規格','在哪一課'],[
 ['P1','4×4 鍵盤：0～9 輸入密碼，<b>E ＝ 確認</b>、<b>F ＝ 清除</b>；密碼 4 碼，輸入時螢幕只顯示 *','W3'],
 ['P2','LCD 兩行：第 1 行狀態（LOCKED、READY、FORWARD…），第 2 行提示或 *；畫面不能閃','W4'],
 ['P3','解鎖後<b>按住</b> 2／8／4／6 ＝ 前／後／左／右，<b>放開就停</b>；D ＝ 重新上鎖','W5'],
 ['P4','密碼錯 3 次鎖 30 秒；解鎖後 60 秒沒按任何鍵自動上鎖','W5'],
 ['P5','鍵盤線脫落、程式按 Stop、出錯：兩顆輪子都要停','W5']
]);

/* ======================================================================
   W3：矩陣鍵盤與密碼
   ====================================================================== */
function scanFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  const pressed=new Set();let row=0,timer=null,speed=700,paused=false;
  el.innerHTML=`<p>點鍵盤上的鍵「按下」（再點一次放開）。左邊是 myRIO 送出的四列，上面是讀回來的四行。
  <label style="margin-left:8px">速度 <select data-k="sp"><option value="1400">慢</option><option value="700" selected>中</option><option value="250">快</option></select></label>
  <button type="button" class="btn" data-k="pause">暫停</button> <button type="button" class="btn" data-k="next">下一列</button></p>
  <svg viewBox="0 0 470 300" width="100%" style="max-width:470px" font-family="Microsoft JhengHei UI,sans-serif" data-o="svg"></svg>
  <p data-o="txt" aria-live="polite"></p>`;
  const svg=el.querySelector('[data-o=svg]'),txt=el.querySelector('[data-o=txt]');
  function draw(){
    const cols=[0,1,2,3].map(c=>{for(let r=0;r<4;r++)if(r===row&&pressed.has(r*4+c))return 0;return 1;});
    // 同一行有兩顆按著、而且其中一顆在正在掃描的列：LOW 和 HIGH 接在一起
    const conflict=[0,1,2,3].some(c=>pressed.has(row*4+c)&&[0,1,2,3].some(r=>r!==row&&pressed.has(r*4+c)));
    let s='';
    for(let c=0;c<4;c++){const x=150+c*70;s+=`<line x1="${x}" y1="40" x2="${x}" y2="290" stroke="${cols[c]?'#2a7':'#c33'}" stroke-width="3"/><text x="${x}" y="18" text-anchor="middle" font-size="12">Col${c+1}（DIO${c}）</text><text x="${x}" y="34" text-anchor="middle" font-size="13" font-weight="700" fill="${cols[c]?'#2a7':'#c33'}">${cols[c]?'HIGH':'LOW'}</text>`;}
    for(let r=0;r<4;r++){const y=70+r*60,lo=r===row;s+=`<line x1="10" y1="${y}" x2="420" y2="${y}" stroke="${lo?'#c33':'#999'}" stroke-width="${lo?4:2}"/><text x="10" y="${y-8}" font-size="12">Row${r+1}（DIO${r+4}）</text><text x="96" y="${y-8}" font-size="12" font-weight="700" fill="${lo?'#c33':'#777'}">${lo?'LOW':'HIGH'}</text>`;
      for(let c=0;c<4;c++){const x=150+c*70,on=pressed.has(r*4+c);s+=`<g data-key="${r*4+c}" style="cursor:pointer"><rect x="${x-22}" y="${y-20}" width="44" height="40" rx="7" fill="${on?'#ffd54d':'#fff'}" stroke="#555"/><text x="${x}" y="${y+6}" text-anchor="middle" font-size="17" font-weight="700">${KEYS[r*4+c]}</text></g>`;}}
    svg.innerHTML=s;
    svg.querySelectorAll('[data-key]').forEach(g=>g.onclick=()=>{const k=+g.dataset.key;pressed.has(k)?pressed.delete(k):pressed.add(k);draw();});
    const low=cols.map((v,i)=>v?null:i).filter(v=>v!==null);
    let m=`現在把 <b>Row${row+1}</b> 拉 LOW，讀到四行：${cols.map(v=>v?'H':'<b style="color:#c33">L</b>').join(' ')}。`;
    m+=low.length?` → 這一列按著的是 <b>${low.map(c=>KEYS[row*4+c]).join('、')}</b>。`:' → 這一列沒有鍵按著。';
    if(conflict)m+=`<br><b style="color:#a3261b">注意：同一行還有別的鍵按著。那顆鍵把 Row${row+1}（LOW）和另一列（HIGH）接在同一條線上，兩個輸出在打架。</b>`;
    txt.innerHTML=m;
  }
  function tick(){if(!document.body.contains(el)){clearInterval(timer);return;}if(!paused){row=(row+1)%4;draw();}}
  el.querySelector('[data-k=sp]').onchange=e=>{speed=+e.target.value;clearInterval(timer);timer=setInterval(tick,speed);};
  el.querySelector('[data-k=pause]').onclick=e=>{paused=!paused;e.target.textContent=paused?'繼續':'暫停';};
  el.querySelector('[data-k=next]').onclick=()=>{row=(row+1)%4;draw();};
  draw();timer=setInterval(tick,speed);
}

const kp={name:'Keypad.vi',view:'split',ratio:2.3,
 fp:{w:330,h:440,items:[
  ...KEYS.map((k,i)=>({id:'k'+i,k:'btn',mech:'switch',text:k,label:k,x:12+(i%4)*42,y:12+Math.floor(i/4)*36})),
  {id:'mat',k:'leds',label:'按下的鍵（4×4）',names:KEYS,cols:4,color:'green',x:214,y:18},
  {id:'key',k:'str',label:'key',x:12,y:170,w:60},
  {id:'nk',k:'led',label:'new key?',color:'green',x:100,y:170},
  {id:'buf',k:'str',label:'輸入中（Password Display）',x:12,y:226,w:140},
  {id:'msg',k:'str',label:'結果',x:170,y:226,w:140},
  {id:'stop',k:'btn',label:'stop',text:'STOP',stop:true,x:12,y:290}]},
 bd:{w:1060,h:500,structs:[
  {id:'wl',k:'while',x:10,y:14,w:1030,h:470},
  {id:'fl',k:'for',x:40,y:40,w:520,h:190,name:'掃描四列'},
  {id:'cs',k:'case',x:600,y:270,w:330,h:180,frames:['""','"E"','"F"','Default'],cur:3}],
  nodes:[
  {id:'kN',k:'const',t:'i32',v:4,x:20,y:26},{id:'N',k:'N',s:'fl'},{id:'it',k:'iter',s:'fl'},
  {id:'kpat',k:'const',t:'bool[]',v:'F T T T',x:60,y:96},
  {id:'rot',k:'fn',fn:'Rotate 1D Array',x:130,y:80},
  {id:'iaR',k:'fn',fn:'Index Array',ins:['array'],outs:['Row1','Row2','Row3','Row4'],x:195,y:70,h:64},
  X('do','Digital Output（4 通道）','DO',['Row1 (B/DIO4)','Row2 (B/DIO5)','Row3 (B/DIO6)','Row4 (B/DIO7)'],[],250,64),
  X('di','Digital Input（4 通道）','DI',[],['Col1 (B/DIO0)','Col2 (B/DIO1)','Col3 (B/DIO2)','Col4 (B/DIO3)'],350,64),
  {id:'baC',k:'fn',fn:'Build Array',ins:['element 0','element 1','element 2','element 3'],x:450,y:64,h:64},
  {id:'notA',k:'fn',fn:'Not',x:500,y:82},
  {id:'tm',k:'tunnel',t:'bool[][]',s:'fl',side:'r',y:96,idx:true},
  {id:'mat',k:'ind',t:'bool[][]',label:'按下的鍵（4×4）',x:600,y:180},
  {id:'k16',k:'const',t:'i32',v:16,x:590,y:120},
  {id:'rs',k:'fn',fn:'Reshape Array',x:630,y:90},
  {id:'kT',k:'const',t:'bool',v:true,x:690,y:130},
  {id:'srch',k:'fn',fn:'Search 1D Array',x:720,y:90},
  {id:'kkeys',k:'const',t:'str[]',v:'1 2 3 A 4 5 6 B 7 8 9 C 0 F E D',x:700,y:160},
  {id:'iak',k:'fn',fn:'Index Array',x:810,y:100},
  {id:'key',k:'ind',t:'str',label:'key',x:900,y:60},
  {id:'kfe',k:'const',t:'str',v:'""',x:20,y:236},
  {id:'srk',k:'sr',t:'str',s:'wl',y:246},
  {id:'ne1',k:'fn',fn:'Not Equal?',x:860,y:150},
  {id:'kem',k:'const',t:'str',v:'""',x:820,y:206},
  {id:'ne2',k:'fn',fn:'Not Equal?',x:860,y:196},
  {id:'and',k:'fn',fn:'And',x:920,y:170},
  {id:'nk',k:'ind',t:'bool',label:'new key?',x:970,y:174},
  {id:'kem2',k:'const',t:'str',v:'""',x:480,y:300},
  {id:'sel',k:'fn',fn:'Select',x:530,y:300},
  {id:'csel',k:'sel',t:'str',s:'cs',y:316},
  {id:'kfb',k:'const',t:'str',v:'""',x:20,y:356},{id:'srb',k:'sr',t:'str',s:'wl',y:366},
  {id:'kfm',k:'const',t:'str',v:'""',x:20,y:416},{id:'srm',k:'sr',t:'str',s:'wl',y:426},
  {id:'tk',k:'tunnel',t:'str',s:'cs',side:'l',y:290},
  {id:'tb',k:'tunnel',t:'str',s:'cs',side:'l',y:366},
  {id:'tmg',k:'tunnel',t:'str',s:'cs',side:'l',y:426},
  {id:'tbo',k:'tunnel',t:'str',s:'cs',side:'r',y:366},
  {id:'tmo',k:'tunnel',t:'str',s:'cs',side:'r',y:426},
  {id:'buf',k:'ind',t:'str',label:'輸入中',x:960,y:330},
  {id:'msg',k:'ind',t:'str',label:'結果',x:960,y:400},
  {id:'cat',k:'fn',fn:'Concatenate Strings',ins:['string 0','string 1'],x:700,y:340,f:'cs:Default'},
  {id:'kpw',k:'const',t:'str',v:'1234',x:640,y:300,f:'cs:"E"'},
  {id:'eq',k:'fn',fn:'Equal?',x:720,y:330,f:'cs:"E"'},
  {id:'kok',k:'const',t:'str',v:'PASS',x:740,y:290,f:'cs:"E"'},
  {id:'kng',k:'const',t:'str',v:'FAIL',x:740,y:390,f:'cs:"E"'},
  {id:'sel2',k:'fn',fn:'Select',x:820,y:380,f:'cs:"E"'},
  {id:'kclr',k:'const',t:'str',v:'""',x:800,y:340,f:['cs:"E"']},
  {id:'kclr2',k:'const',t:'str',v:'""',x:800,y:350,f:'cs:"F"'},
  {id:'kw',k:'const',t:'i32',v:20,x:60,y:440},{id:'wait',k:'fn',fn:'Wait (ms)',x:100,y:434},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:300,y:440},{id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'a0',from:'kN',to:'N',t:'i32'},
  {id:'a1',from:'kpat',to:'rot.array',t:'bool[]',mx:120},
  {id:'a2',from:'it',to:'rot.n',t:'i32',mx:110},
  {id:'a3',from:'rot.output array',to:'iaR.array',t:'bool[]'},
  {id:'a4',from:'iaR.Row1',to:'do.Row1 (B/DIO4)',t:'bool'},{id:'a5',from:'iaR.Row2',to:'do.Row2 (B/DIO5)',t:'bool'},
  {id:'a6',from:'iaR.Row3',to:'do.Row3 (B/DIO6)',t:'bool'},{id:'a7',from:'iaR.Row4',to:'do.Row4 (B/DIO7)',t:'bool'},
  {id:'a8',from:'do.error out',to:'di.error in',t:'err'},
  {id:'a9',from:'di.Col1 (B/DIO0)',to:'baC.element 0',t:'bool'},{id:'a10',from:'di.Col2 (B/DIO1)',to:'baC.element 1',t:'bool'},
  {id:'a11',from:'di.Col3 (B/DIO2)',to:'baC.element 2',t:'bool'},{id:'a12',from:'di.Col4 (B/DIO3)',to:'baC.element 3',t:'bool'},
  {id:'a13',from:'baC.appended array',to:'notA',t:'bool[]'},
  {id:'a14',from:'notA.out',to:'tm.i',t:'bool[]'},
  {id:'b1',from:'tm.o',to:'mat',t:'bool[][]',mx:580},
  {id:'b2',from:'tm.o',to:'rs.array',t:'bool[][]',mx:580},
  {id:'b3',from:'k16',to:'rs.dimension size',t:'i32',mx:620},
  {id:'b4',from:'rs.output array',to:'srch.1D array',t:'bool[]'},
  {id:'b5',from:'kT',to:'srch.element',t:'bool',mx:710},
  {id:'b6',from:'srch.index of element',to:'iak.index',t:'i32',mx:795},
  {id:'b7',from:'kkeys',to:'iak.array',t:'str[]',mx:790},
  {id:'b8',from:'iak.element',to:'key',t:'str',mx:880},
  {id:'c0',from:'kfe',to:'srk.init',t:'str'},
  {id:'c1',from:'iak.element',to:'ne1.x',t:'str',mx:850},
  {id:'c2',from:'srk.L',to:'ne1.y',t:'str',pts:[[40,246],[40,250],[840,250],[840,171]]},
  {id:'c3',from:'iak.element',to:'ne2.x',t:'str',mx:850},
  {id:'c4',from:'kem',to:'ne2.y',t:'str',mx:850},
  {id:'c5',from:'ne1.out',to:'and.x',t:'bool',mx:905},
  {id:'c6',from:'ne2.out',to:'and.y',t:'bool',mx:905},
  {id:'c7',from:'and.out',to:'nk',t:'bool'},
  {id:'c8',from:'iak.element',to:'srk.R',t:'str',pts:[[850,116],[850,236],[1036,236],[1036,246]]},
  {id:'d1',from:'and.out',to:'sel.s',t:'bool',pts:[[955,184],[955,262],[515,262],[515,316]]},
  {id:'d2',from:'iak.element',to:'sel.t',t:'str',pts:[[850,116],[850,256],[505,256],[505,307]]},
  {id:'d3',from:'kem2',to:'sel.f',t:'str',mx:515},
  {id:'d4',from:'sel.out',to:'csel',t:'str'},
  {id:'d5',from:'sel.out',to:'tk.o',t:'str',mx:575},
  {id:'e0',from:'kfb',to:'srb.init',t:'str'},{id:'e1',from:'srb.L',to:'tb.o',t:'str'},
  {id:'e2',from:'kfm',to:'srm.init',t:'str'},{id:'e3',from:'srm.L',to:'tmg.o',t:'str'},
  {id:'e4',from:'tbo.o',to:'srb.R',t:'str'},{id:'e5',from:'tmo.o',to:'srm.R',t:'str'},
  {id:'e6',from:'tbo.o',to:'buf',t:'str',mx:950},{id:'e7',from:'tmo.o',to:'msg',t:'str',mx:950},
  {id:'f1',from:'tb.i',to:'tbo.i',t:'str',f:'cs:""'},{id:'f2',from:'tmg.i',to:'tmo.i',t:'str',f:'cs:""'},
  {id:'g1',from:'tb.i',to:'cat.string 0',t:'str',f:'cs:Default'},{id:'g2',from:'tk.i',to:'cat.string 1',t:'str',mx:680,f:'cs:Default'},
  {id:'g3',from:'cat.concatenated string',to:'tbo.i',t:'str',f:'cs:Default'},{id:'g4',from:'tmg.i',to:'tmo.i',t:'str',f:'cs:Default'},
  {id:'h1',from:'tb.i',to:'eq.x',t:'str',mx:700,f:'cs:"E"'},{id:'h2',from:'kpw',to:'eq.y',t:'str',mx:705,f:'cs:"E"'},
  {id:'h3',from:'eq.out',to:'sel2.s',t:'bool',mx:800,f:'cs:"E"'},{id:'h4',from:'kok',to:'sel2.t',t:'str',mx:805,f:'cs:"E"'},
  {id:'h5',from:'kng',to:'sel2.f',t:'str',mx:805,f:'cs:"E"'},{id:'h6',from:'sel2.out',to:'tmo.i',t:'str',f:'cs:"E"'},
  {id:'h7',from:'kclr',to:'tbo.i',t:'str',f:'cs:"E"'},
  {id:'i1',from:'kclr2',to:'tbo.i',t:'str',f:'cs:"F"'},{id:'i2',from:'tmg.i',to:'tmo.i',t:'str',f:'cs:"F"'},
  {id:'z1',from:'kw',to:'wait',t:'i32'},{id:'z2',from:'stop',to:'cond',t:'bool'}]},
 sim:{period:120,init:()=>({prev:'',buf:'',msg:''}),
  step(inp,st){
   const pr=KEYS.map((k,i)=>!!inp['k'+i]);const idx=pr.indexOf(true),key=idx<0?'':KEYS[idx];
   const nk=key!==st.prev&&key!=='';st.prev=key;
   const sel=nk?key:'';let frame=3;
   if(sel==='')frame=0;else if(sel==='E'){frame=1;st.msg=st.buf==='1234'?'PASS':'FAIL';st.buf='';}
   else if(sel==='F'){frame=2;st.buf='';}else{st.buf=(st.buf+sel);}
   const star='*'.repeat(st.buf.length);
   return {out:{mat:pr,key,nk,buf:star,msg:st.msg},frames:{cs:frame},
    vals:{'tm.o':'4×4','rs.output array':'['+pr.map(b=>b?'T':'F').join('')+']','srch.index of element':idx,'iak.element':'"'+key+'"','ne1.out':key!==st.prev,'and.out':nk,'sel.out':'"'+sel+'"','tbo.o':'"'+st.buf+'"','tmo.o':'"'+st.msg+'"'},
    stop:!!inp.stop,msg:key?('掃到「'+key+'」'+(nk?'，新按下的 → 進 Case「'+(sel==='E'?'"E"':sel==='F'?'"F"':'Default')+'」':'，還按著，不重複輸入')):'沒有鍵按著'};},
  doneMsg:'迴圈結束'}
};

L.push({id:'W03',order:30.983,no:'W3',part:PART,title:'myRIO 操作盒 ①：矩陣鍵盤，8 條線讀 16 個鍵，再做密碼輸入',mins:70,files:['練習\\實務\\Keypad.vi'],
goals:[['學會','把整個專案切成能各自驗收的小塊；矩陣鍵盤為什麼省線、怎麼掃描、為什麼讀的那一邊要有上拉電阻；照廠商腳位表接線；先只掃一列驗證接線；For Loop ＋ Rotate 1D Array 掃四列；Search 1D Array 找按鍵；「新按下」才算一次；Case 處理數字、E、F。'],['做出','Keypad.vi：顯示按著的鍵、新按下的鍵，輸入 4 碼按 E 比對密碼。'],['素材','myRIO 手臂班講義第 3 章（矩陣鍵盤、去彈跳、密碼比對）。']],
check:'不看課文，能畫出 4×4 鍵盤掃描時某一列拉 LOW 的樣子，說出按著 5 時四行會讀到什麼；能解釋為什麼按住一個鍵不會一直輸入。',
body:[
C.h3('① 聽懂需求','','整個專案'),
`<p>W3～W5 是同一份工作，分三課做。這是比較大的工作常見的做法：<b>先切成能各自驗收的小塊</b>。鍵盤自己能動、LCD 自己能動，最後再接在一起。整合時出問題，至少知道每一塊本身是好的。</p>`,
PROJECT,
ask('這段話裡有哪些要回去問清楚？',
 `<ul><li>密碼幾碼？輸錯怎麼辦？→ 4 碼；錯 3 次鎖 30 秒。</li>
 <li>「控制前後左右」是按一下走一段，還是按住才走？→ <b>按住才走、放開就停</b>（操作的人放手，車子就停，比較安全）。</li>
 <li>不用的時候呢？→ 60 秒沒操作自動上鎖。</li>
 <li>螢幕要顯示什麼？→ 狀態和輸入中的密碼（只顯示 *）。</li></ul>`),
C.h3('② 規格','','整個專案的規格，這一課負責 P1'),
PROJECT_SPEC,
C.h3('③ 盤點','','鍵盤長什麼樣、腳位怎麼接'),
`<p>手上的鍵盤是 Digilent 的 4×4 鍵盤模組，背面兩排各 6 隻針。第一件事是找廠商的腳位表（講義有整理），不要用猜的：</p>`,
C.table(['鍵盤腳','訊號','接到 myRIO（MXP B）','MXP 腳號','在 LabVIEW 裡'],[
 ['1','COL4','DIO3','17','Digital Input'],['2','COL3','DIO2','15','Digital Input'],['3','COL2','DIO1','13','Digital Input'],['4','COL1','DIO0','11','Digital Input'],
 ['5、11','GND','DGND','30（或任一 DGND）',''],['6、12','VCC','+3.3V','33',''],
 ['7','ROW4','DIO7','25','Digital Output'],['8','ROW3','DIO6','23','Digital Output'],['9','ROW2','DIO5','21','Digital Output'],['10','ROW1','DIO4','19','Digital Output']
]),
`<p>注意腳 1 是 <b>COL4</b>，不是 COL1：腳號和訊號編號是反的。照著表一條一條接，接完再對一次。</p>`,
C.h3('原理','','16 個鍵為什麼只要 8 條線'),
`<p>16 個鍵各接一條線要 16 條。矩陣把鍵排成 4 列 × 4 行：每個鍵的兩隻腳，一隻接它那一<b>列</b>，一隻接它那一<b>行</b>。按下去，就是把那一列和那一行接通。</p>
<p>讀法：<b>一次只把一列拉 LOW，其他列保持 HIGH</b>，然後讀四行。行平常是 HIGH（myRIO 的 MXP DIO0～13 內建 40 kΩ 上拉到 3.3 V，使用手冊有寫）。如果這一列有鍵按著，那一行就被拉成 LOW。四列輪流掃一次，就知道每一個鍵的狀態。</p>`,
{fn:scanFig},
ask('按住 5，掃到 Row2 時四行讀到什麼？掃到 Row1 呢？',
 `<p>5 在 Row2、Col2。掃到 Row2（Row2 是 LOW）：Col2 被拉 LOW，讀到 <b>H L H H</b>。掃到 Row1：5 接的是 Row2，而 Row2 這時是 HIGH，Col2 不會變，讀到 <b>H H H H</b>。所以「哪一列 LOW 的時候哪一行 LOW」就決定了是哪一個鍵。</p>`),
warn('同一行按兩顆','上面的動畫按住 1 和 4（同一行）：掃 Row1 時，Row1 是 LOW、Row2 是 HIGH，兩顆鍵把它們接在同一條線上，兩個輸出在打架。偶爾一下通常不會壞，但正式的產品會在每一條列線串一顆電阻（例如 1 kΩ），或讓沒在掃描的列改成輸入。這一課的程式規定：同時按好幾顆，只算掃到的第一顆。'),
C.h3('④ 先驗證','','只掃一列，確認接線'),
`<ol><li>開 myRIO 專案（M2 課），Main.vi 的迴圈裡放一個 ${myrio('Digital Out')}，設定成 4 個通道 B/DIO4～7，接常數：Row1 = F，其他 = T。</li>
<li>再放一個 ${myrio('Digital In')}，4 個通道 B/DIO0～3，接 4 顆 LED 顯示。</li>
<li>Run。沒按鍵時 4 顆都亮（HIGH）。按 1、2、3、A，應該依序是第 1、2、3、4 顆熄掉。按第 2 列的鍵（4、5、6、B），都不會有反應。</li></ol>`,
ask('按 1 時，熄掉的是第 4 顆，不是第 1 顆。哪裡錯了？',
 `<p>行接反了：腳 1～4 是 COL4～COL1，可能照「腳 1 → DIO0」順著接了。改接線或改 LabVIEW 裡通道的順序都可以，但<b>改完要更新接線表</b>，不然下一個人照表接又錯。這種錯誤在這一步兩分鐘就找到；等全部寫完才發現，你會懷疑是程式的問題。</p>`),
C.h3('⑤ 規劃','','四列要怎麼輪流'),
`<p>講義的做法是 While Loop 每一圈把「F T T T」用 ${fn('Programming','Array','Rotate 1D Array')} 轉一格：第 1 圈 Row1 LOW、第 2 圈 Row2 LOW……四圈才掃完一次。這裡改成<b>每一圈用一個 For Loop 一次掃完四列</b>：每一圈結束時手上就是完整的 4×4，後面的判斷比較好寫。</p>`,
C.plan({start:'myRIO 專案裡新增 <code>Keypad.vi</code>（在 myRIO 的 Target 下面：右鍵 ▸ New ▸ VI），第 ④ 步驗證過的兩個 Express VI 搬進來。',
 in:'Digital Input 的 4 行（Boolean，HIGH ＝ True ＝ 沒按）。在 For Loop 裡讀 4 次 → 4 × 4 個 Boolean。',
 calc:'① For Loop 跑 4 次，第 i 圈：Rotate 1D Array（F T T T，轉 i 格）→ 第 i 列是 F（LOW）→ 寫 DO → 讀 DI。② 讀到的 4 個 Boolean 經過 Not（按下 ＝ LOW ＝ False，反過來變成 True 比較直覺），自動索引成 4×4。③ Reshape 成 16 個，Search 1D Array 找第一個 True → 索引 0～15 → 查表 "123A456B789C0FED"。④ 和上一圈的 key 比：<b>不一樣而且不是空的</b>才是「新按下」。⑤ 新按下的鍵送進 Case：數字接在後面、E 比對、F 清除。',
 out:'4×4 LED、key、new key?、輸入中的字串（前面板右鍵 ▸ <b>Password Display</b>，只顯示 *）、結果。',
 loop:'20 ms 一圈。人最快一秒按 10 個鍵，每個鍵至少按著 50 ms，20 ms 掃一次一定抓得到。',
 end:'Stop 結束。結束前把 4 列都寫 HIGH（不掃描），這一課先省略。'}),
ask('為什麼「和上一圈不一樣」就能去掉按鍵彈跳？',
 `<p>彈跳是按下的前幾毫秒接點一下通一下斷。20 ms 才掃一次，大部分彈跳在兩次掃描之間就結束了；就算剛好掃到斷的那一下，也只是這一圈讀到空的，下一圈讀到同一個鍵：空的 → 「5」會被當成新按下一次……這樣就輸入兩次了。</p>
 <p>所以掃描間隔就是第一道防線，比較嚴謹的做法是：<b>連續兩圈讀到同一個鍵才算數</b>（講義用 Value Has Changed PtByPt 做的事情類似）。實機測試時如果發現偶爾重複輸入，就加這一層。</p>`),
C.h3('⑥ 一步一步寫','','前面板的鍵用滑鼠點一下＝按住，再點一下＝放開'),
{steps:{title:'Keypad.vi：掃描 → 找鍵 → 新按下 → 密碼',lv:kp,steps:[
 {t:'迴圈、For Loop 和列的圖樣',view:'bd',add:['wl','kw','wait','z1','stop','cond','z2','fl','kN','N','a0','it','kpat','rot','a1','a2','iaR','a3'],h:`<p>While Loop 裡放一個 For Loop，N 接 4。</p><p>For Loop 裡：Boolean 陣列常數 <code>F T T T</code> 接 ${fn('Programming','Array','Rotate 1D Array')} ${qd('Rotate 1D Array')} 的 array，迴圈的 i 接 n。i ＝ 1 時變成 T F T T：<b>LOW 的那一格跟著 i 走</b>。</p><p>Index Array 往下拉成 4 個輸出，不接 index：依序拿第 0、1、2、3 個。</p>`},
 {t:'寫四列、讀四行',view:'split',add:['do','a4','a5','a6','a7','di','a8',...KEYS.map((k,i)=>'k'+i)],h:`<p>第 ④ 步的 Digital Output（4 個通道 Row1～4）和 Digital Input（Col1～4）搬進 For Loop。</p><p><b>error 線從 DO 接到 DI</b>：這條線決定順序，保證先把列寫好再讀行。沒有這條線，LabVIEW 可能先讀再寫，讀到的是上一列的結果。</p>`},
 {t:'四行 → 反相 → 4×4',view:'split',add:['baC','a9','a10','a11','a12','notA','a13','tm','a14','mat','b1'],h:`<p>Build Array 把 4 行接成陣列，再接 ${fn('Programming','Boolean','Not')}（Not 可以直接接陣列，每個都反相）。接到 For Loop 右邊框，通道預設自動索引：跑 4 圈 → 4 列 × 4 行的 2D 陣列。</p><p>Create ▸ Indicator，在前面板把它排成 4×4 的燈。點前面板的鍵，對應的燈要亮。</p>`},
 {t:'找出是哪一個鍵',view:'split',add:['k16','rs','b2','b3','kT','srch','b4','b5','kkeys','iak','b6','b7','key','b8'],h:`<p>${fn('Programming','Array','Reshape Array')} 把 4×4 拉成 16 個（dimension size ＝ 16），順序是第 1 列的 4 個、第 2 列的 4 個……</p><p>Search 1D Array 找 True → 索引 0～15，沒按是 −1。用索引去字串陣列常數查表：1 2 3 A 4 5 6 B 7 8 9 C 0 F E D（和鍵盤上的排列一樣）。−1 查表會得到空字串，剛好代表「沒按」。</p>`},
 {t:'新按下的才算',view:'split',add:['kfe','srk','c0','ne1','c1','c2','kem','ne2','c3','c4','and','c5','c6','nk','c7','c8'],h:`<p>While Loop 加一個 Shift Register 存上一圈的 key（初值空字串）。</p><p>${fn('Programming','Comparison','Not Equal?')} 兩個：這一圈 ≠ 上一圈、這一圈 ≠ 空字串，And 起來 ＝ <b>new key?</b>。按住一個鍵，只有第一圈是 True。</p>`},
 {t:'密碼：Case 依鍵處理',view:'split',add:['kem2','sel','d1','d2','d3','cs','csel','d4','tk','d5','kfb','srb','e0','e1','tb','kfm','srm','e2','e3','tmg','tbo','tmo','e4','e5','buf','e6','msg','e7','f1','f2','cat','g1','g2','g3','g4','kpw','eq','h1','h2','kok','kng','sel2','h3','h4','h5','h6','kclr','h7','kclr2','i1','i2'],h:`<p>Select：new key? 是 True 就送 key，否則送空字串。接到 Case 的選擇端，Case 自動變成字串型。</p>
 <p>四頁：<b>""</b>（沒有新按鍵）什麼都不改；<b>"E"</b> 把輸入中的字串和 "1234" 比，結果寫 PASS／FAIL，輸入清空；<b>"F"</b> 清空；<b>Default</b>（其他鍵）接在後面。按 Case 上面的箭頭切換四頁看看。</p>
 <p>兩個 Shift Register 記「輸入中」和「結果」：每一頁都要把值接出去，沒改的就從左邊直接接到右邊。</p>`},
 {t:'Run：輸入 1、2、3、4，按 E',view:'split',add:[],h:`<p>點 1（按下）再點一次（放開），依序輸入 1234，最後點 E → PASS。試試按住 5 不放：只輸入一次。輸入錯的再按 E → FAIL。</p><p>A、B、C、D 現在也會被接進密碼裡。規格只允許數字，要怎麼擋？（下面有一題。）</p>`}
]}},
ask('A～D 被當成密碼的一部分。怎麼改成只收數字？',
 `<p>兩種做法：在 Case 加一頁 <code>"A","B","C","D"</code>（Case 的一頁可以寫多個值，用逗號隔開），裡面什麼都不做；或在 Default 頁用 ${fn('Programming','String','Match Pattern')}（樣式 <code>[0-9]</code>）判斷是不是數字。第一種一眼看得懂，比較好維護。W5 會用 D 當「重新上鎖」，那時它本來就要有自己的一頁。</p>`),
ask('密碼寫成常數 "1234" 放在程式裡，交機時有什麼問題？',
 `<p>要改密碼得改程式、重新部署。實務上會把密碼放在 myRIO 上的設定檔（F 課的讀檔），或至少做成前面板的控制項再「Make Current Value Default」。這一點要問使用者：<b>誰會改密碼、多久改一次</b>。</p>`),
C.h3('⑦ 測試','','這一塊自己先驗收'),
C.table(['測試','操作','預期'],[
 ['T1','16 個鍵逐一按','key 顯示正確的字，燈的位置和實體鍵盤一樣'],
 ['T2','按住 5 兩秒','只輸入一個 5'],
 ['T3','快速連按 5 五下','輸入五個 5，不多不少（多了 → 加「連續兩圈相同」）'],
 ['T4','1234 E／1235 E','PASS／FAIL，按完輸入都清空'],
 ['T5','輸入 12，按 F，再輸入 1234 E','PASS'],
 ['T6','同時按住 1 和 2','只算 1（第一個）']
]),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'4×4 矩陣鍵盤要幾條訊號線？',o:['8','16','4','32'],a:0,ex:'4 列 ＋ 4 行。'},
 {q:'掃描時，被掃描的那一列送什麼？',o:['LOW，其他列 HIGH','HIGH，其他列 LOW','全部 LOW','全部 HIGH'],a:0,ex:'按著的鍵會把那一行拉 LOW。'},
 {q:'讀的那四行平常為什麼是 HIGH？',o:['myRIO MXP 的 DIO 內建上拉電阻','鍵盤自己發電','LabVIEW 預設','因為接了 +5 V'],a:0,ex:'MXP DIO0～13 有 40 kΩ 上拉到 3.3 V。'},
 {q:'DO 和 DI 之間的 error 線有什麼作用？',o:['保證先寫列再讀行','讓程式比較快','沒有作用','顯示錯誤'],a:0,ex:'資料流決定執行順序。'},
 {q:'Search 1D Array 回傳 −1，去 Index Array 查 "1 2 3 A…" 會得到？',o:['空字串','"1"','"D"','錯誤'],a:0,ex:'超出範圍得到預設值。'},
 {q:'按住一個鍵不放，為什麼只輸入一次？',o:['只有「和上一圈不同而且不是空的」才算新按下','鍵盤只送一次','Wait 擋掉了','For Loop 只跑一次'],a:0,ex:'用 Shift Register 存上一圈的 key。'}
]}
]});

/* ======================================================================
   W4：序列 LCD 驅動
   ====================================================================== */
function lcdEmu(el,opt){
  opt=opt||{};
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<div data-o="lcd" style="display:inline-block;background:#9fd6a8;border:8px solid #234;border-radius:6px;padding:8px 10px;font-family:Consolas,monospace;font-size:22px;line-height:30px;color:#1a2a1a;letter-spacing:2px"></div>
  <p style="margin-top:8px">要送的字串（用 <code>\\1B</code> 代表 ESC，和 LabVIEW 的 '\\' Codes Display 一樣）：</p>
  <p><input type="text" data-k="s" style="width:100%;max-width:520px;font-family:Consolas,monospace" value="${opt.v||'\\1B[jHello'}"> </p>
  <p><button type="button" class="btn pri" data-k="send">送出（不清除，接著上一次的畫面）</button> <button type="button" class="btn" data-k="reset">LCD 斷電重開</button>
  ${['\\1B[j','\\1B[1;0H','\\1B[0c','\\1B[2c','\\1B[1h','\\1B[1@'].map(x=>`<button type="button" class="btn" data-ins="${x}">${x}</button>`).join(' ')}</p>
  <p data-o="log" style="font-size:13px;color:#445"></p>`;
  const lcd=el.querySelector('[data-o=lcd]'),log=el.querySelector('[data-o=log]'),inp=el.querySelector('[data-k=s]');
  let S;function reset(){S={lines:[' '.repeat(40),' '.repeat(40)],r:0,c:0,wrap:16,cur:2,off:0};}
  reset();
  function put(ch){const L=S.lines[S.r];S.lines[S.r]=L.slice(0,S.c)+ch+L.slice(S.c+1);S.c++;if(S.c>=S.wrap){S.c=0;S.r=(S.r+1)%2;}}
  function send(str){
    const parts=[];let i=0;const s=str.replace(/\\1B/gi,'\x1b').replace(/\\r/g,'\r').replace(/\\n/g,'\n');
    while(i<s.length){
      if(s[i]==='\x1b'){
        if(s[i+1]!=='['){parts.push('ESC 後面不是 [，被忽略');i++;continue;}
        let j=i+2,par='';while(j<s.length&&/[0-9;]/.test(s[j]))par+=s[j++];
        const cmd=s[j];const ps=par.split(';').filter(x=>x!=='').map(Number);
        if(cmd==='j'){S.lines=[' '.repeat(40),' '.repeat(40)];S.r=0;S.c=0;S.off=0;parts.push('清除畫面、游標回到開頭');}
        else if(cmd==='H'){S.r=Math.max(0,Math.min(1,ps[0]||0));S.c=Math.max(0,Math.min(S.wrap-1,ps[1]||0));parts.push('游標移到第 '+S.r+' 列、第 '+S.c+' 行');}
        else if(cmd==='c'){S.cur=ps.length?ps[0]:0;parts.push(['游標關閉','游標開、不閃','游標開、閃爍'][S.cur]||'游標模式 '+S.cur);}
        else if(cmd==='h'){S.wrap=(ps[0]===1)?40:16;parts.push('一行 '+S.wrap+' 個字才換行');}
        else if(cmd==='@'){S.off=Math.min(24,S.off+(ps[0]||1));parts.push('畫面往左捲 '+(ps[0]||1)+' 格');}
        else if(cmd==='A'){S.off=Math.max(0,S.off-(ps[0]||1));parts.push('畫面往右捲 '+(ps[0]||1)+' 格');}
        else parts.push('不認得的指令「'+(cmd||'（字串結束）')+'」');
        i=j+1;continue;
      }
      if(s[i]==='\r'||s[i]==='\n'){parts.push('CR／LF 在這顆 LCD 上不會換行，被當成看不見的字');i++;continue;}
      put(s[i]);i++;
    }
    const txtCount=s.replace(/\x1b\[[0-9;]*./g,'').length;
    parts.push('共 '+[...s].length+' 個位元組，9600 baud 約 '+(([...s].length*10)/9.6).toFixed(1)+' ms');
    log.textContent=parts.join('；');draw();
  }
  function draw(){
    const blink=S.cur===2&&(Date.now()/500|0)%2;
    lcd.innerHTML=[0,1].map(r=>{const vis=S.lines[r].slice(S.off,S.off+16);return [...vis].map((ch,c)=>{const here=S.cur&&r===S.r&&c+S.off===S.c;return `<span style="display:inline-block;width:14px;${here?(S.cur===2&&blink?'background:#1a2a1a;color:#9fd6a8;':'border-bottom:3px solid #1a2a1a;'):''}">${ch===' '?'&nbsp;':ch.replace(/[<>&]/g,'?')}</span>`;}).join('');}).join('<br>');
  }
  el.querySelector('[data-k=send]').onclick=()=>send(inp.value);
  el.querySelector('[data-k=reset]').onclick=()=>{reset();log.textContent='重新上電：畫面空白，游標在開頭';draw();};
  el.querySelectorAll('[data-ins]').forEach(b=>b.onclick=()=>{inp.value+=b.dataset.ins;});
  send(inp.value);
  const t=setInterval(()=>{if(!document.body.contains(el)){clearInterval(t);return;}draw();},500);
}

const lw={name:'LCD_Write.vi',view:'split',ratio:1.9,
 fp:{w:320,h:300,items:[
  {id:'row',k:'num',ctl:true,label:'row（0 或 1）',rep:'U8',x:12,y:20,w:60,v:0},
  {id:'col',k:'num',ctl:true,label:'col（0～15）',rep:'U8',x:120,y:20,w:60,v:0},
  {id:'txt',k:'str',ctl:true,label:'text',x:12,y:80,w:290,v:'READY'},
  {id:'out',k:'str',label:'Output String（\\ 碼顯示）',x:12,y:150,w:290,codes:true},
  {id:'len',k:'num',label:'位元組數',x:12,y:220,w:60},
  {id:'ms',k:'num',label:'9600 baud 約幾 ms',x:140,y:220,w:60,dig:1}]},
 bd:{w:640,h:240,nodes:[
  {id:'kf',k:'const',t:'str',v:'\\1B[%d;%dH%-16s',x:20,y:30},
  {id:'row',k:'ctl',t:'u8',label:'row',x:40,y:80},
  {id:'col',k:'ctl',t:'u8',label:'col',x:40,y:120},
  {id:'txt',k:'ctl',t:'str',label:'text',x:40,y:160},
  {id:'fmt',k:'fn',fn:'Format Into String',ins:['format string','input 1','input 2','input 3'],x:220,y:40,h:80},
  {id:'out',k:'ind',t:'str',label:'Output String',x:340,y:50},
  X('uart','UART（A/UART，9600）','UART',['Characters to Write'],[],460,40),
  {id:'sl',k:'fn',fn:'String Length',x:340,y:150},
  {id:'len',k:'ind',t:'i32',label:'位元組數',x:420,y:154}],
  wires:[
  {id:'w1',from:'kf',to:'fmt.format string',t:'str',mx:200},
  {id:'w2',from:'row',to:'fmt.input 1',t:'u8',mx:190},
  {id:'w3',from:'col',to:'fmt.input 2',t:'u8',mx:195},
  {id:'w4',from:'txt',to:'fmt.input 3',t:'str',mx:200},
  {id:'w5',from:'fmt.resulting string',to:'out',t:'str'},
  {id:'w6',from:'fmt.resulting string',to:'uart.Characters to Write',t:'str',mx:440},
  {id:'w7',from:'fmt.resulting string',to:'sl',t:'str',mx:320},
  {id:'w8',from:'sl.length',to:'len',t:'i32'}]},
 sim:{live:true,step(inp){
  const r=Math.max(0,Math.min(1,+inp.row||0)),c=+inp.col||0,t=String(inp.txt||'');
  const pad=(t+' '.repeat(16)).slice(0,Math.max(16,t.length));
  const s='\x1b['+r+';'+c+'H'+pad;const n=[...s].length;
  return {out:{out:s,len:n,ms:n*10/9.6},vals:{kf:'\\1B[%d;%dH%-16s',row:r,col:c,txt:'"'+t+'"','fmt.resulting string':'"\\1B['+r+';'+c+'H'+pad+'"','sl.length':n},
   msg:'ESC [ '+r+' ; '+c+' H，後面接補滿 16 格的文字：舊的字會被空白蓋掉，不用先清畫面'};}}
};

L.push({id:'W04',order:30.984,no:'W4',part:PART,title:'myRIO 操作盒 ②：序列 LCD，讀懂指令表，做成別人拿了就會用的驅動 SubVI',mins:65,files:['練習\\實務\\LCD_Cmd.vi','練習\\實務\\LCD_Write.vi','練習\\實務\\LCD_Example.vi'],
goals:[['學會','UART 只接一條線的單向通訊；鮑率要兩邊一樣（LCD 用跳線選）；先送純文字驗證；讀懂「ESC [ 參數 指令」的格式；在 LabVIEW 字串裡放 ESC（\\ 碼顯示）；為什麼不要每一圈都清畫面；把指令包成 SubVI，接點設 Required、寫說明、附範例。'],['做出','LCD_Cmd.vi（選指令 → 字串）、LCD_Write.vi（在第幾列第幾行寫字）、LCD_Example.vi（示範怎麼用）。'],['素材','myRIO 手臂班講義第 4 章（UART、LCD 指令、SubVI、Required、說明文件、範例程式）。']],
check:'不看課文，能寫出「清除畫面」和「游標移到第 1 列第 0 行」要送的字串；說出 LCD 畫面一直閃的原因和改法；說出交出一個 SubVI 時要附哪三樣東西。',
body:[
C.h3('① 需求','','這一課負責 P2'),
`<p>規格 P2：LCD 兩行，第 1 行狀態、第 2 行提示或 *，<b>畫面不能閃</b>。另外這一塊有一個隱藏的需求：W5 整合時，主程式要能很簡單地「在第幾列寫什麼字」。所以這一課交出去的不只是能動的程式，而是<b>一組好用的 SubVI</b>。</p>`,
C.h3('② 盤點','','這顆 LCD 怎麼接、怎麼說話'),
`<p>Digilent 的序列 LCD 模組：16 字 × 2 行，可以用 UART、SPI 或 I²C 控制，用板子上的跳線選。講義用 UART：</p>`,
C.table(['項目','內容','從哪裡知道'],[
 ['介面','UART，<b>只要接 TX 一條訊號線</b>（加電源、地）','講義的接線圖、模組手冊'],
 ['鮑率','MD2、MD1、MD0 三個跳線選：講義的表 9600 baud 是 0、1、0（有插跳線帽 ＝ 0）','講義的跳線表；不同版次的模組以手冊為準'],
 ['電源','VCC 接 +3.3 V（MXP 腳 33），GND 接 DGND（腳 30）',''],
 ['訊號','myRIO 的 UART.TX（MXP 腳 14）→ LCD 的 RX','myRIO 使用手冊：UART.TX 是腳 14、UART.RX 是腳 10'],
 ['方向','myRIO → LCD，單向。LCD 不會回話','']
]),
ask('講義說的單工、半雙工、全雙工，這顆 LCD 是哪一種？這對除錯有什麼影響？',
 `<p>這個接法只用到一個方向（myRIO 送、LCD 收），是<b>單工</b>。影響很大：LCD 不會回「收到了」，<b>程式沒辦法知道它有沒有收到</b>。送錯了、鮑率不對、線沒接，程式都不會出錯，只能用眼睛看螢幕。所以驗證一定要一步一步做，每一步都看螢幕。</p>`),
warn('接頭要和設定一樣','講義的接線圖接在 MXP B 的 UART，但 Express VI 設定畫面選的是 A/UART。你接哪一個，設定就選哪一個。選錯不會報錯，只是螢幕沒反應，這種錯最難找。'),
C.h3('③ 先驗證','','先送純文字'),
`<ol><li>Main.vi 放一個 ${myrio('UART')}，設定：Channel 選你接的那個接頭的 UART、Mode 選 <b>Write</b>、Baud rate <b>9600</b>、Data bits 8、Parity None、Stop bits 1。</li>
<li>Characters to Write 接字串常數 <code>Hello</code>，Run 一次。</li></ol>`,
C.table(['看到','可能的原因'],[
 ['Hello','接線、鮑率都對，往下做'],
 ['一堆亂碼','鮑率不一樣：檢查跳線，或 Express VI 的 baud'],
 ['什麼都沒有（背光有亮）','TX 接到 RX 了、接頭和設定不一樣、跳線選成 SPI／I²C'],
 ['背光都沒亮','電源沒接好']
]),
C.h3('④ 讀懂指令表','','ESC [ 參數 指令'),
`<p>只送文字，字會一直往後接。要清畫面、移游標，要送<b>指令</b>。這顆 LCD 的指令都長一樣：</p>
<p style="text-align:center;font-size:1.1em"><code>ESC</code>（一個位元組 0x1B）＋ <code>[</code> ＋ 參數（數字，多個用 ; 分開）＋ 指令字元</p>`,
C.table(['指令字元','做什麼','例子（\\ 碼顯示）'],[
 ['j','清除畫面，游標回到開頭','\\1B[j'],
 ['H','移游標到「列;行」（從 0 開始）','\\1B[1;0H ＝ 第 2 行的開頭'],
 ['c','游標樣式：0 關、1 開、2 開而且閃','\\1B[0c'],
 ['h','換行長度：0 ＝ 16 字換行、1 ＝ 40 字換行','\\1B[0h'],
 ['@、A','整個畫面往左、往右捲幾格','\\1B[1@']
]),
`<p>LabVIEW 的字串常數怎麼放 ESC？在常數上按右鍵 ▸ <b>'\\' Codes Display</b>，然後打 <code>\\1B</code>。切回 Normal Display 會看到一個方框：那就是看不見的 ESC。（字串實驗室的「看不見的字元」有示範。）</p>
<p>下面是一顆模擬的 LCD，照指令表試試看。先送 <code>\\1B[j</code> 清畫面，再試移游標、游標樣式。</p>`,
{fn:el=>lcdEmu(el,{v:'\\1B[j\\1B[0cREADY\\1B[1;0H****'})},
ask('每一圈都先送 \\1B[j 再寫兩行字，畫面會怎樣？',
 `<p>會<b>閃</b>：清除之後到字寫完之間，畫面是空的。兩行加指令大約 40 個位元組，9600 baud 一個位元組約 1 ms，空白的時間有幾十毫秒，每一圈都來一次，眼睛就看到閃。</p>
 <p>改法有兩個，W5 兩個都用：① <b>不清畫面，直接把游標移到行首，寫滿 16 格</b>（不足的補空白），舊字自然被蓋掉。② <b>內容沒變就不送</b>：用 Shift Register 記上一次送的字串，不一樣才送。</p>`),
C.h3('⑤ 規劃','','交出去的是三個 VI'),
C.table(['VI','輸入','輸出','做什麼'],[
 ['LCD_Cmd.vi','LCD-CMD select（Enum：清除、游標關、游標開閃爍、16 字換行…）','Output CMD（字串）','Case 依 Enum 選一段參數加指令字元，前面接 \\1B['],
 ['LCD_Write.vi','row、col、text','Output String','Format Into String：<code>\\1B[%d;%dH%-16s</code>'],
 ['LCD_Example.vi','—','—','示範：單一指令、多個指令、清除後寫字']
]),
`<p>為什麼 SubVI 只「產生字串」，不直接呼叫 UART？因為字串可以先接起來一次送，也方便測試：<b>不接 myRIO 也能檢查產生的字串對不對</b>（下面的模擬就是這樣）。</p>`,
C.plan({start:'myRIO 專案裡新增 LCD_Write.vi。',
 in:'row（U8，0 或 1）、col（U8，0～15）、text（字串）。',
 calc:'Format Into String，格式 <code>\\1B[%d;%dH%-16s</code>：%d 是整數；<b>%-16s</b> 是「至少 16 格、靠左、不足補空白」。結果就是「移游標 ＋ 補滿 16 格的字」。',
 out:'Output String（前面板設 \\ 碼顯示，看得到 \\1B）。另外算一下字串長度，心裡有數要送多久。',
 loop:'SubVI 本身不放迴圈，主程式每一圈呼叫它。',
 end:'只產生字串，沒有要關的東西。'}),
C.h3('⑥ 一步一步寫','','LCD_Write.vi'),
{steps:{title:'LCD_Write.vi：row、col、text → 一段要送的字串',lv:lw,steps:[
 {t:'三個輸入',view:'split',add:['row','col','txt'],h:`<p>前面板放 row、col（數值，表示法改 U8）、text（字串控制項）。</p>`},
 {t:'Format Into String',view:'split',add:['kf','fmt','w1','w2','w3','w4','out','w5'],h:`<p>${fn('Programming','String','Format Into String')}，往下拉成 3 個 input。格式字串常數設 <b>'\\' Codes Display</b>，內容 <code>\\1B[%d;%dH%-16s</code>。</p><p>Output String 的顯示元件也設成 '\\' Codes Display。改 text，看後面補了幾個空白。</p>`},
 {t:'接上 UART（在主程式裡）',view:'bd',add:['uart','w6','sl','w7','len','w8','ms'],h:`<p>測試時可以直接接 UART Express VI 看螢幕；做成 SubVI 時把 UART 拿掉，Output String 接到連接器上，由主程式送。</p><p>${fn('Programming','String','String Length')}：一次大約 22 個位元組，9600 baud 約 23 ms。主程式 20 ms 一圈的話，每圈都送兩行就已經來不及了。這就是「沒變就不送」的理由。</p>`}
]}},
C.h3('⑦ 交機','','讓別人拿了就會用'),
`<p>講義在這裡做了三件很多人會省略的事，這正是「能動的程式」和「能交出去的程式」的差別：</p>`,
C.table(['做什麼','怎麼做','為什麼'],[
 ['接點設 Required','連接器上的接點按右鍵 ▸ This Connection Is ▸ <b>Required</b>','呼叫的人忘了接，箭頭直接斷掉，不會帶著預設值偷偷執行'],
 ['寫說明','File ▸ VI Properties ▸ Category 選 <b>Documentation</b> ▸ VI description','滑鼠移到 SubVI 上按 Ctrl+H，Context Help 視窗就會顯示這段說明'],
 ['附範例','LCD_Example.vi：單一指令、多個指令（Enum 陣列丟進 For Loop）、清除後寫字','看範例比看說明快；也是你自己的回歸測試'],
 ['畫圖示','Edit Icon：寫「LCD CMD」「LCD WR」','方塊圖上一眼認得出來']
]),
ask('LCD_Write.vi 的 row、col、text，哪幾個該設 Required？',
 `<p><b>text</b> 一定要：忘了接，就會一直寫空白。row、col 可以設 Recommended，預設 0 也合理（寫在左上角）。原則：<b>沒接就一定是錯的</b> → Required；有合理的預設值 → Recommended。error in 通常是 Recommended。</p>`),
tip('講義的最後一個問題：能不能更簡潔？','LCD_Cmd.vi 用 Enum ＋ Case，每一頁一個常數，指令一多就很長。另一種寫法：把參數和指令字元放在一個字串陣列常數裡，用 Enum 的值當索引去 Index Array。程式變短，但改指令時要小心陣列順序和 Enum 順序一致。兩種都對，選團隊比較看得懂的那一種。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'這顆 LCD 用 UART 時，myRIO 要接幾條訊號線？',o:['1 條（TX）','2 條（TX、RX）','4 條','8 條'],a:0,ex:'LCD 只收不送。'},
 {q:'送 Hello 結果出現亂碼，最可能是？',o:['鮑率兩邊不一樣','線沒接','LCD 壞了','字串太長'],a:0,ex:'有字但是亂的，通常是鮑率。'},
 {q:'「游標移到第 2 行開頭」要送？',o:['\\1B[1;0H','\\1B[2;1H','\\1B[j','\\1B[1c'],a:0,ex:'列、行都從 0 開始。'},
 {q:'畫面一直閃，最可能的原因？',o:['每一圈都先清畫面再寫','鮑率太高','沒設 Required','字太少'],a:0,ex:'改成移游標、補空白，沒變就不送。'},
 {q:'%-16s 的意思是？',o:['至少 16 格、靠左、不足補空白','最多 16 個字','16 進位','重複 16 次'],a:0,ex:'負號是靠左。'},
 {q:'接點設成 Required，呼叫的人忘了接會怎樣？',o:['Run 箭頭斷掉，不能執行','用預設值執行','執行時跳錯誤','沒有影響'],a:0,ex:'寫程式的時候就擋下來。'}
]}
]});

/* ======================================================================
   W5：整合：兩顆伺服、狀態機、驗收
   ====================================================================== */
function servoFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  let seed=Date.now()%9973;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
  let stop=1.44+Math.round(rnd()*8)/100,db=0.012,on=1.5,ang=0,t=null;
  el.innerHTML=`<p>這顆連續旋轉伺服的停止點不知道是多少（每一顆都不一樣）。拉高電位時間，找出輪子<b>完全不動</b>的範圍，取中間。</p>
  <p><label>高電位時間 <input type="range" min="0.7" max="2.0" step="0.002" value="1.5" data-k="on" style="width:280px"> <b class="num" data-o="on"></b> ms</label></p>
  <p>週期 20 ms（50 Hz）→ Duty Cycle ＝ <b class="num" data-o="duty"></b>（myRIO 的 PWM Express VI 要的是 0～1，不是 %）</p>
  <svg viewBox="0 0 220 120" width="220" data-o="svg"><circle cx="60" cy="60" r="48" fill="#333"/><circle cx="60" cy="60" r="40" fill="#555"/><line data-o="spoke" x1="60" y1="60" x2="60" y2="22" stroke="#ffd54d" stroke-width="6" stroke-linecap="round"/><circle cx="60" cy="60" r="6" fill="#ddd"/><text x="125" y="55" font-size="14" data-o="dir"></text><text x="125" y="78" font-size="12" fill="#556" data-o="spd"></text></svg>
  <p><button type="button" class="btn" data-k="mark1">記下：從這裡開始不動</button> <button type="button" class="btn" data-k="mark2">記下：到這裡還不動</button> <button type="button" class="btn" data-k="new">換一顆伺服</button></p>
  <p data-o="res" aria-live="polite"></p>`;
  const q=k=>el.querySelector('[data-k='+k+']'),o=k=>el.querySelector('[data-o='+k+']');let m1=null,m2=null;
  const speed=()=>{const d=on-stop;if(Math.abs(d)<=db)return 0;return Math.max(-1,Math.min(1,(d-Math.sign(d)*db)/0.4));};
  function draw(){o('on').textContent=on.toFixed(3);o('duty').textContent=(on/20).toFixed(4);const s=speed();
    o('dir').textContent=s===0?'停止':(s>0?'順時針':'逆時針');o('spd').textContent=s===0?'':'速度 '+Math.round(Math.abs(s)*100)+'%';
    o('res').innerHTML=(m1!=null?'開始不動：'+m1.toFixed(3)+' ms':'')+(m2!=null?'　不動到：'+m2.toFixed(3)+' ms':'')+(m1!=null&&m2!=null?'　→ <b>停止點取 '+((m1+m2)/2).toFixed(3)+' ms</b>（Duty '+(((m1+m2)/2)/20).toFixed(4)+'）'+(Math.abs((m1+m2)/2-stop)<0.006?'　✔ 很準':'　再試細一點'):'');}
  function spin(){if(!document.body.contains(el)){clearInterval(t);return;}ang+=speed()*30;o('spoke').setAttribute('transform','rotate('+ang+' 60 60)');}
  q('on').oninput=e=>{on=+e.target.value;draw();};
  q('mark1').onclick=()=>{m1=on;draw();};q('mark2').onclick=()=>{m2=on;draw();};
  q('new').onclick=()=>{stop=1.44+Math.round(rnd()*8)/100;m1=m2=null;draw();};
  draw();t=setInterval(spin,60);
}

/* 整個操作盒的模擬：鍵盤（按住）→ 狀態機 → 兩顆伺服、LCD */
function boxSim(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">
   <div><div data-o="lcd" style="background:#9fd6a8;border:8px solid #234;border-radius:6px;padding:6px 8px;font-family:Consolas,monospace;font-size:19px;line-height:26px;color:#1a2a1a;letter-spacing:2px;width:252px"></div>
   <div data-o="pad" style="display:grid;grid-template-columns:repeat(4,52px);gap:6px;margin-top:10px"></div>
   <p style="font-size:12px;color:#556;margin-top:6px">按住滑鼠 ＝ 按住鍵；放開 ＝ 放開。手機上按住也可以。</p>
   <p><label><input type="checkbox" data-k="cable"> 鍵盤排線脫落</label>　<button type="button" class="btn" data-k="stop">程式 Stop</button> <button type="button" class="btn" data-k="restart">重新執行</button></p></div>
   <div><canvas width="300" height="240" data-o="cv" style="background:#eef2f6;border:1px solid #c5ced8;border-radius:6px"></canvas>
   <p style="font-size:13px">狀態：<b data-o="st"></b>　左輪 <b data-o="l"></b> ms　右輪 <b data-o="r"></b> ms</p>
   <p style="font-size:13px" data-o="info"></p></div></div>
   <p data-o="log" style="font-size:13px;color:#445;max-height:110px;overflow:auto;border-top:1px solid #dde;padding-top:6px"></p>`;
  const o=k=>el.querySelector('[data-o='+k+']');
  const STOP_L=1.46,STOP_R=1.48,D=0.2;
  const DIRS={'2':['FORWARD',+1,-1],'8':['BACKWARD',-1,+1],'4':['LEFT',-1,-1],'6':['RIGHT',+1,+1]};
  let S,held=new Set(),timer=null,running=true;
  function init(){o('log').innerHTML='';S={st:'LOCKED',buf:'',fails:0,until:0,idle:0,prevKey:'',lcd:['',''],sent:0,car:{x:150,y:120,a:-Math.PI/2},L:STOP_L,R:STOP_R,t:0};held.clear();running=true;log('程式開始：狀態 LOCKED');}
  function log(m){const p=o('log');p.innerHTML=`<div>${(S?(S.t/1000).toFixed(1):'0.0')} s　${m}</div>`+p.innerHTML;}
  const pad=o('pad');
  KEYS.forEach(k=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=k;b.style.cssText='height:44px;font-size:18px;font-weight:700;touch-action:none';
    const dn=e=>{e.preventDefault();held.add(k);b.style.background='#ffd54d';};const up=()=>{held.delete(k);b.style.background='';};
    b.addEventListener('pointerdown',dn);b.addEventListener('pointerup',up);b.addEventListener('pointerleave',up);b.addEventListener('pointercancel',up);pad.appendChild(b);});
  el.querySelector('[data-k=stop]').onclick=()=>{if(!running)return;running=false;S.L=STOP_L;S.R=STOP_R;writeLCD('STOPPED','');log('按 Stop：迴圈結束前把兩輪寫成停止點，LCD 顯示 STOPPED');draw();};
  el.querySelector('[data-k=restart]').onclick=()=>{init();draw();};
  function writeLCD(a,b){const l=[a,b];for(let i=0;i<2;i++){if(l[i]!==S.lcd[i]){S.lcd[i]=l[i];S.sent++;}}}
  function step(){
    if(!document.body.contains(el)){clearInterval(timer);return;}
    if(!running){draw();return;}
    S.t+=20;
    const cable=el.querySelector('[data-k=cable]').checked;
    let key='';if(!cable){for(const k of KEYS)if(held.has(k)){key=k;break;}}
    const nk=key!==S.prevKey&&key!=='';S.prevKey=key;
    let dir=null;
    if(S.st==='LOCKED'){
      if(nk){if(/[0-9]/.test(key)&&S.buf.length<4)S.buf+=key;else if(key==='F')S.buf='';
        else if(key==='E'){if(S.buf==='1234'){S.st='READY';S.fails=0;S.idle=0;log('密碼正確 → READY');}else{S.fails++;log('密碼錯誤（第 '+S.fails+' 次）');if(S.fails>=3){S.st='WAIT';S.until=S.t+30000;log('錯 3 次 → 鎖 30 秒');}}S.buf='';}}
      writeLCD('LOCKED','PIN:'+'*'.repeat(S.buf.length));
    }else if(S.st==='WAIT'){
      const left=Math.ceil((S.until-S.t)/1000);writeLCD('WAIT '+left+' s','');
      if(S.t>=S.until){S.st='LOCKED';S.fails=0;log('30 秒到 → LOCKED');}
    }else{
      if(key)S.idle=0;else S.idle+=20;
      if(nk&&key==='D'){S.st='LOCKED';log('按 D → 重新上鎖');}
      else if(S.idle>=60000){S.st='LOCKED';log('60 秒沒操作 → 自動上鎖');}
      else{dir=DIRS[key]||null;writeLCD(dir?dir[0]:'READY',dir?'':'2/8/4/6 D:LOCK');}
      if(S.st==='LOCKED')writeLCD('LOCKED','PIN:');
    }
    S.L=dir?+(STOP_L+dir[1]*D).toFixed(3):STOP_L;S.R=dir?+(STOP_R+dir[2]*D).toFixed(3):STOP_R;
    // 車子：左輪 +、右輪 − ＝ 前進（兩顆裝的方向相反）
    const vl=(S.L-STOP_L)/D,vr=-(S.R-STOP_R)/D,v=(vl+vr)/2*1.6,w=(vl-vr)/2*0.06;
    S.car.a+=w;S.car.x+=Math.cos(S.car.a)*v;S.car.y+=Math.sin(S.car.a)*v;
    S.car.x=(S.car.x+300)%300;S.car.y=(S.car.y+240)%240;
    draw();
  }
  function draw(){
    o('lcd').innerHTML=S.lcd.map(l=>(l+' '.repeat(16)).slice(0,16).replace(/ /g,'&nbsp;')).join('<br>');
    o('st').textContent=running?S.st:'程式已停止';o('l').textContent=S.L.toFixed(3);o('r').textContent=S.R.toFixed(3);
    o('info').textContent='LCD 實際送出的次數：'+S.sent+'（內容沒變就不送）';
    const cv=o('cv'),c=cv.getContext('2d');c.clearRect(0,0,300,240);
    c.save();c.translate(S.car.x,S.car.y);c.rotate(S.car.a+Math.PI/2);
    c.fillStyle='#2f6fd0';c.fillRect(-16,-20,32,40);c.fillStyle='#ffd54d';c.beginPath();c.moveTo(0,-26);c.lineTo(-8,-18);c.lineTo(8,-18);c.fill();
    c.fillStyle='#222';c.fillRect(-22,-8,6,18);c.fillRect(16,-8,6,18);c.restore();
  }
  init();draw();timer=setInterval(step,20);
}

const ENUMS=['STOP','FORWARD','BACKWARD','LEFT','RIGHT'];
const outv={name:'Main.vi（輸出那一段）',view:'split',ratio:2,
 fp:{w:320,h:300,items:[
  {id:'dir',k:'enum',ctl:true,label:'方向（Enum，狀態機算出來的）',options:ENUMS,x:12,y:24,v:0},
  {id:'sl',k:'num',ctl:true,label:'左輪停止點 ms',x:12,y:84,w:70,v:1.46,inc:0.01,dig:3},
  {id:'sr',k:'num',ctl:true,label:'右輪停止點 ms',x:160,y:84,w:70,v:1.48,inc:0.01,dig:3},
  {id:'dl',k:'num',label:'左輪 Duty（0～1）',x:12,y:150,w:80,dig:4},
  {id:'dr',k:'num',label:'右輪 Duty（0～1）',x:160,y:150,w:80,dig:4},
  {id:'txt',k:'str',label:'LCD 第 1 行',x:12,y:210,w:140},
  {id:'sent',k:'led',label:'這一圈有送 LCD？',color:'green',x:180,y:210}]},
 bd:{w:900,h:330,nodes:[
  {id:'dir',k:'ctl',t:'enum',label:'方向',x:20,y:60},
  {id:'kL',k:'const',t:'dbl[]',v:'0, +1, −1, −1, +1',x:100,y:20,label:'左輪係數'},
  {id:'kR',k:'const',t:'dbl[]',v:'0, −1, +1, −1, +1',x:100,y:120,label:'右輪係數'},
  {id:'iaL',k:'fn',fn:'Index Array',x:240,y:30},
  {id:'iaR',k:'fn',fn:'Index Array',x:240,y:120},
  {id:'kD',k:'const',t:'dbl',v:0.2,x:270,y:80,label:'±0.2 ms'},
  {id:'mL',k:'fn',fn:'Multiply',x:310,y:34},{id:'mR',k:'fn',fn:'Multiply',x:310,y:124},
  {id:'sl',k:'ctl',t:'dbl',label:'左輪停止點 ms',x:300,y:-4},{id:'sr',k:'ctl',t:'dbl',label:'右輪停止點 ms',x:300,y:170},
  {id:'aL',k:'fn',fn:'Add',x:380,y:30},{id:'aR',k:'fn',fn:'Add',x:380,y:130},
  {id:'k20',k:'const',t:'dbl',v:20,x:410,y:84,label:'週期 20 ms'},
  {id:'vL',k:'fn',fn:'Divide',x:450,y:36},{id:'vR',k:'fn',fn:'Divide',x:450,y:126},
  {id:'dl',k:'ind',t:'dbl',label:'左輪 Duty',x:520,y:0},{id:'dr',k:'ind',t:'dbl',label:'右輪 Duty',x:520,y:180},
  X('pL','PWM（B/PWM1，DIO9）','PWM',['Duty Cycle'],[],560,30),
  X('pR','PWM（B/PWM2，DIO10）','PWM',['Duty Cycle'],[],560,120),
  {id:'ktx',k:'const',t:'str[]',v:'READY, FORWARD, BACKWARD, LEFT, RIGHT',x:100,y:230},
  {id:'iaT',k:'fn',fn:'Index Array',x:330,y:236},
  {id:'txt',k:'ind',t:'str',label:'LCD 第 1 行',x:420,y:290},
  {id:'ne',k:'fn',fn:'Not Equal?',x:470,y:240},
  {id:'prev',k:'ctl',t:'str',label:'上一次送的（Shift Register）',x:330,y:290},
  {id:'sent',k:'ind',t:'bool',label:'要送 LCD？',x:540,y:244},
  {id:'lcd',k:'sub',name:'LCD_Write.vi → UART（在 Case True 裡）',icon:['LCD','WR'],ins:['text'],outs:[],x:660,y:236,w:70,h:50,color:'#8d6e00',tip:'W4 做的 SubVI；放在 Case 的 True 頁，內容變了才送'}],
  wires:[
  {id:'w1',from:'dir',to:'iaL.index',t:'enum',mx:90},{id:'w2',from:'kL',to:'iaL.array',t:'dbl[]',mx:225},
  {id:'w3',from:'dir',to:'iaR.index',t:'enum',mx:90},{id:'w4',from:'kR',to:'iaR.array',t:'dbl[]',mx:225},
  {id:'w5',from:'iaL.element',to:'mL.x',t:'dbl'},{id:'w6',from:'kD',to:'mL.y',t:'dbl',mx:300},
  {id:'w7',from:'iaR.element',to:'mR.x',t:'dbl'},{id:'w8',from:'kD',to:'mR.y',t:'dbl',mx:300},
  {id:'w9',from:'mL.out',to:'aL.y',t:'dbl'},{id:'w10',from:'sl',to:'aL.x',t:'dbl',mx:365},
  {id:'w11',from:'mR.out',to:'aR.x',t:'dbl'},{id:'w12',from:'sr',to:'aR.y',t:'dbl',mx:365},
  {id:'w13',from:'aL.out',to:'vL.x',t:'dbl'},{id:'w14',from:'k20',to:'vL.y',t:'dbl',mx:440},
  {id:'w15',from:'aR.out',to:'vR.x',t:'dbl'},{id:'w16',from:'k20',to:'vR.y',t:'dbl',mx:440},
  {id:'w17',from:'vL.out',to:'dl',t:'dbl',mx:505},{id:'w18',from:'vL.out',to:'pL.Duty Cycle',t:'dbl',mx:505},
  {id:'w19',from:'vR.out',to:'dr',t:'dbl',mx:505},{id:'w20',from:'vR.out',to:'pR.Duty Cycle',t:'dbl',mx:505},
  {id:'w21',from:'dir',to:'iaT.index',t:'enum',mx:90},{id:'w22',from:'ktx',to:'iaT.array',t:'str[]'},
  {id:'w23',from:'iaT.element',to:'ne.x',t:'str',mx:400},{id:'w24',from:'prev',to:'ne.y',t:'str',mx:440},
  {id:'w25',from:'ne.out',to:'sent',t:'bool'},{id:'w26',from:'iaT.element',to:'txt',t:'str',mx:400},
  {id:'w27',from:'iaT.element',to:'lcd.text',t:'str',pts:[[400,252],[400,226],[640,226],[640,261]]}]},
 sim:{period:200,init:()=>({prev:''}),
  step(inp,st){const d=+inp.dir||0,cl=[0,1,-1,-1,1][d],cr=[0,-1,1,-1,1][d],sl=+inp.sl||0,sr=+inp.sr||0;
   const onL=sl+cl*0.2,onR=sr+cr*0.2,dl=onL/20,dr=onR/20,tx=['READY','FORWARD','BACKWARD','LEFT','RIGHT'][d],sent=tx!==st.prev;st.prev=tx;
   return {out:{dl,dr,txt:tx,sent},vals:{dir:ENUMS[d],'iaL.element':cl,'iaR.element':cr,kD:0.2,'mL.out':cl*0.2,'mR.out':cr*0.2,'aL.out':onL.toFixed(3)+' ms','aR.out':onR.toFixed(3)+' ms','vL.out':dl.toFixed(4),'vR.out':dr.toFixed(4),'iaT.element':'"'+tx+'"','ne.out':sent},
    msg:ENUMS[d]+'：左輪 '+onL.toFixed(3)+' ms、右輪 '+onR.toFixed(3)+' ms'+(sent?'；LCD 內容變了 → 送':'；LCD 內容沒變 → 不送')};},
  doneMsg:'執行完畢'}
};

L.push({id:'W05',order:30.985,no:'W5',part:PART,title:'myRIO 操作盒 ③：兩顆伺服當輪子、狀態機把三塊接起來、照規格驗收交機',mins:80,files:['練習\\實務\\Main.vi'],
goals:[['學會','連續旋轉伺服要自己找停止點；電源預算（myRIO 的 5 V 不夠推兩顆伺服）；兩個輪子裝反方向時前後左右怎麼算；用狀態機（Enum ＋ Shift Register ＋ Case）把鍵盤、LCD、伺服接起來；「放開就停」「排線脫落就停」這種安全規格怎麼落實；驗收表和交機資料。'],['做出','Main.vi：密碼解鎖、按住方向鍵走、放開就停、錯 3 次鎖 30 秒、60 秒沒動自動上鎖；LCD 不閃。'],['素材','myRIO 手臂班講義第 5 章（伺服、找停止的 Duty、UI 控制、兩顆伺服、鍵盤控制、加 LCD）。']],
check:'不看課文，能說出怎麼找一顆連續旋轉伺服的停止點；畫出這個操作盒的狀態圖；說出排線脫落時車子為什麼會停。',
body:[
C.h3('① 需求','','這一課負責 P3～P5，並把三塊接起來'),
PROJECT_SPEC,
C.h3('② 盤點','','伺服怎麼接、電從哪裡來'),
C.table(['項目','內容'],[
 ['伺服','兩顆<b>連續旋轉</b>伺服（360°，當輪子用）。三條線：電源（紅）、地（黑或棕）、訊號（黃、橘或白）'],
 ['訊號','左輪 → MXP B 的 DIO9（PWM1，腳 29）；右輪 → DIO10（PWM2，腳 31）'],
 ['電源','<b>外接 5 V 電源</b>給伺服的紅線；外接電源的地要和 myRIO 的 DGND 接在一起（共地）'],
 ['鍵盤、LCD','照 W3、W4 的接線表']
]),
ask('為什麼不直接用 myRIO MXP 上的 +5V 推伺服？',
 `<p>myRIO 使用手冊寫 MXP 的 +5 V 輸出<b>每個接頭最多 100 mA</b>。小伺服轉動時常常要好幾百 mA，啟動或卡住時更大，兩顆一定超過。輕則 myRIO 重開機，重則保護電路動作。所以伺服用外接電源。</p>
 <p>為什麼要共地？訊號線的 HIGH／LOW 是相對於地來說的。伺服的地和 myRIO 的地沒接在一起，伺服看到的 PWM 訊號就沒有基準，可能亂轉或不轉。</p>`),
C.h3('③ 先驗證','','每一顆伺服的停止點都不一樣'),
`<p>一般的伺服，脈波寬度決定<b>角度</b>。連續旋轉伺服改成決定<b>轉速和方向</b>：某一個寬度附近停止，比它寬往一個方向轉、比它窄往另一個方向轉。名目上大約 1.5 ms，但每一顆都有誤差，講義那一顆量到 1.46 ms。</p>
<p>講義用的 PWM 頻率 50 Hz，週期 20 ms，所以 <b>Duty ＝ 高電位時間 ÷ 20 ms</b>。講義也標了安全範圍 0.7～2.0 ms、極限 0.5～2.5 ms：超出範圍伺服可能抖動或撞到機構的極限，先在安全範圍內試。</p>`,
{fn:servoFig},
`<p>實機的做法一樣：在 Main.vi 放一個 PWM Express VI，前面板放一個高電位時間的旋鈕（0.7～2.0 ms），除以 20 接到 Duty Cycle，慢慢轉，用眼睛看輪子。<b>兩顆分別量、分別記下來</b>，寫進交機資料。有些伺服旁邊有一個微調的小孔，可以把停止點調到 1.5 ms；沒有的話就在程式裡用各自的停止點。</p>`,
C.h3('④ 規劃','','兩個輪子、四個方向'),
`<p>兩顆伺服裝在車子左右兩側，<b>面對的方向相反</b>。所以同樣是「往前」，左輪要順時針、右輪要逆時針：左輪的時間加一點、右輪的時間減一點。</p>`,
C.table(['方向','左輪','右輪','鍵'],[
 ['停止','停止點','停止點','放開、5'],['前進','停止點 ＋ 0.2 ms','停止點 − 0.2 ms','2'],['後退','停止點 − 0.2 ms','停止點 ＋ 0.2 ms','8'],
 ['左轉（原地）','停止點 − 0.2 ms','停止點 − 0.2 ms','4'],['右轉（原地）','停止點 ＋ 0.2 ms','停止點 ＋ 0.2 ms','6']
]),
ask('實機按 2，車子往後走。要改哪裡？',
 `<p>兩個輪子的方向都反了：把左右輪係數表的正負號整個反過來就好。如果只有一邊反（車子原地轉），只改那一邊。<b>係數放在陣列常數裡</b>，改的時候只動一個常數，接線不用改：跟 W1 的門檻陣列同一個想法。</p>`),
`<p>接著是整個程式的架構。三塊都已經各自驗收過了，現在要決定<b>什麼時候做什麼</b>。規格裡出現「鎖住時只收密碼」「解鎖後才能動」「錯 3 次等 30 秒」：程式在不同的<b>狀態</b>下對同一個鍵的反應不同，這就是狀態機（M12 課的骨架）。</p>`,
C.table(['狀態','LCD','在這個狀態：','換到'],[
 ['LOCKED','LOCKED／PIN:****','數字存起來、F 清除、E 比對；輪子停','密碼對 → READY；錯第 3 次 → WAIT'],
 ['WAIT','WAIT 25 s','什麼鍵都不理；輪子停','30 秒到 → LOCKED'],
 ['READY','READY 或 FORWARD…','按住 2／8／4／6 → 走，沒按 → 停','D → LOCKED；60 秒沒按 → LOCKED']
]),
C.plan({start:'myRIO 專案的 Main.vi（範本的 Initialize／Main Loop／Close 三格）。Keypad.vi 的掃描改成 SubVI <code>KeyScan.vi</code>（輸出 key、new key?），LCD_Write.vi 直接用。',
 in:'KeyScan.vi 每一圈給：key（按著的鍵，沒按是空字串）、new key?。另外用 Tick Count 算經過的時間（WAIT 的 30 秒、READY 的 60 秒）。',
 calc:'Enum「狀態」放在 Shift Register，Case 依狀態分三頁。每一頁算出：下一個狀態、方向 Enum、LCD 兩行文字。Case 外面：方向 → 查係數表 → 兩輪的高電位時間 → ÷20 → PWM；LCD 文字和上一次比，不一樣才呼叫 LCD_Write。',
 out:'兩個 PWM 的 Duty；LCD；前面板顯示狀態和兩輪的時間（除錯用）。',
 loop:'20 ms 一圈：鍵盤掃描的節奏。PWM 每圈都寫沒關係（很快）；LCD 沒變就不送（9600 baud 送一行要 20 ms）。',
 end:'Stop 或任何錯誤 → 離開迴圈 → Close 那一格<b>先把兩輪寫成停止點</b>，再 Reset myRIO。PWM 是硬體在送，程式不寫新的值，它就一直送最後的設定；不要把「停下來」寄望在後面的 Reset 上，自己明確寫一次停止。'}),
ask('「排線脫落要停」這條規格，需要另外寫程式嗎？',
 `<p>不用，這是設計出來的。排線脫落時四行都讀到 HIGH（上拉電阻），等於「沒有鍵按著」。規格是「按住才走、放開就停」，所以車子自然停下。如果當初設計成「按一下開始走、再按一下停」，排線一掉就<b>停不下來</b>了。這就是第 ① 步問清楚「按住還是按一下」的價值：安全常常不是靠多寫一段程式，而是靠一開始選對行為。</p>`),
C.h3('⑤ 一步一步寫','','Case 外面的輸出段'),
`<p>狀態機的骨架和 M12 一樣（Enum ＋ Shift Register ＋ Case），這裡只做新的部分：Case 算出方向之後，怎麼變成兩個輪子的 Duty，以及 LCD「沒變就不送」。</p>`,
{steps:{title:'方向 → 兩輪 Duty；LCD 沒變就不送',lv:outv,steps:[
 {t:'方向查表',view:'split',add:['dir','kL','kR','iaL','iaR','w1','w2','w3','w4'],h:`<p>方向是一個 Enum（STOP、FORWARD、BACKWARD、LEFT、RIGHT），由狀態機的 Case 算出來。Enum 可以直接當 Index Array 的索引。</p><p>兩個係數陣列：左輪 <code>0, +1, −1, −1, +1</code>、右輪 <code>0, −1, +1, −1, +1</code>，順序和 Enum 一樣，就是上面那張表。</p>`},
 {t:'係數 → 高電位時間 → Duty',view:'split',add:['kD','mL','mR','w5','w6','w7','w8','sl','sr','aL','aR','w9','w10','w11','w12','k20','vL','vR','w13','w14','w15','w16','dl','dr','w17','w19'],h:`<p>係數 × 0.2 ms ＋ 各自的停止點 ＝ 高電位時間；÷ 20 ms ＝ Duty（0～1）。</p><p>兩個停止點做成前面板的控制項，交機時把量到的值設成預設值（右鍵 ▸ Data Operations ▸ Make Current Value Default）。換伺服時只要改這兩個數字。</p>`},
 {t:'接到 PWM',view:'bd',add:['pL','pR','w18','w20'],h:`<p>${myrio('PWM')} 兩個：B/PWM1（DIO9）、B/PWM2（DIO10），頻率在設定視窗填 <b>50 Hz</b>，Duty Cycle 從方塊圖接進來。</p>`},
 {t:'LCD：沒變就不送',view:'split',add:['ktx','iaT','w21','w22','txt','w26','prev','ne','w23','w24','sent','w25','lcd','w27'],h:`<p>LCD 第 1 行也用同一個 Enum 查文字表。和 Shift Register 裡「上一次送的」比，${fn('Programming','Comparison','Not Equal?')} 是 True 才進 Case 的 True 頁呼叫 LCD_Write.vi。</p><p>改方向試試看：只有方向改變的那一圈「要送 LCD？」是 True。</p>`},
 {t:'Run：改方向、改停止點',view:'split',add:[],h:`<p>選 FORWARD：左輪 1.66 ms、右輪 1.28 ms。把右輪停止點改成 1.50，看右輪的 Duty 跟著變。</p>`}
]}},
C.h3('⑥ 整合起來','','整個操作盒的模擬'),
`<p>下面把三塊接起來：鍵盤（W3）→ 狀態機 → 兩個輪子和 LCD（W4）。密碼是 1234。照下一段的驗收表一條一條試。</p>`,
{fn:boxSim},
C.h3('⑦ 驗收、交機','','照規格一條一條測'),
C.table(['測試','操作','預期','規格'],[
 ['T1','輸入 1234 E','LCD 變 READY','P1'],
 ['T2','輸入 1111 E 三次','第 3 次後 WAIT，倒數 30 秒，期間按什麼都沒反應','P4'],
 ['T3','READY 時按住 2，再放開','按著時前進；放開馬上停（不超過一圈 20 ms）','P3'],
 ['T4','按住 4、按住 6','原地左轉、右轉','P3'],
 ['T5','READY 後 60 秒不按','自動 LOCKED','P4'],
 ['T6','READY 時按住 2，勾「鍵盤排線脫落」','車子停','P5'],
 ['T7','車子在走的時候按程式 Stop','兩輪停，LCD 顯示 STOPPED','P5'],
 ['T8','看 LCD 一分鐘','不閃；「實際送出的次數」只在內容改變時增加','P2']
]),
`<p>交機資料：</p>
<ul><li><b>接線表</b>：鍵盤、LCD、兩顆伺服、外接電源（含共地），每條線的 MXP 腳號。</li>
<li><b>校正值</b>：左輪、右輪各自的停止點（例如 1.46、1.48 ms），以及量的方法。換伺服要重量。</li>
<li><b>操作說明</b>：密碼、怎麼改密碼、每個鍵的功能、LOCKED／WAIT／READY 的意思。</li>
<li><b>測試紀錄</b>：上面這張表打勾、日期、簽名。</li>
<li><b>程式</b>：整個專案資料夾；開機自動執行的話照 M10 課設定，並寫在說明裡。</li></ul>`,
note('回頭看這三課','W3～W5 用到的東西，前面的課都教過：Express VI、Shift Register、Case、Enum、Format Into String、SubVI。實務真正多出來的是：先問清楚（按住還是按一下）、先切小塊各自驗證、找校正值、算電源和通訊時間、照規格驗收、把資料交出去。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'連續旋轉伺服的「停止點」要怎麼得到？',o:['每一顆實際慢慢調，找不動的範圍取中間','一律 1.5 ms','看 LabVIEW 預設值','Duty 設 0'],a:0,ex:'每一顆都有誤差。'},
 {q:'50 Hz 的 PWM，高電位 1.46 ms，myRIO PWM Express VI 的 Duty Cycle 要給？',o:['0.073','7.3','1.46','0.0146'],a:0,ex:'1.46 ÷ 20 ＝ 0.073，是 0～1 的比例。'},
 {q:'兩顆伺服為什麼不接 myRIO MXP 的 +5V？',o:['每個接頭最多 100 mA，不夠','電壓太高','頻率不對','LabVIEW 不允許'],a:0,ex:'用外接電源並共地。'},
 {q:'兩輪裝的方向相反，「前進」時？',o:['一輪加時間、一輪減時間','兩輪都加','兩輪都減','兩輪都停止點'],a:0,ex:'見方向表。'},
 {q:'鍵盤排線脫落時車子會停，是因為？',o:['規格選了「按住才走、放開就停」，脫落等於沒按','程式偵測到脫落','myRIO 會斷電','PWM 自動停'],a:0,ex:'安全靠一開始選對行為。'},
 {q:'程式結束時，為什麼 Close 要先把兩輪寫成停止點？',o:['不然伺服會照最後的 Duty 繼續轉','讓 LCD 清除','節省電','LabVIEW 規定'],a:0,ex:'PWM 硬體會一直送最後的設定。'},
 {q:'LCD 文字「沒變就不送」主要是為了？',o:['9600 baud 送一行要約 20 ms，每圈都送會拖慢迴圈、畫面也可能閃','省記憶體','LCD 只能寫一次','讓文字變大'],a:0,ex:'通訊時間要算進迴圈裡。'}
]}
]});
})();
