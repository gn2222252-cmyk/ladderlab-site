/* 第九部分：myRIO（M3++）——七段顯示器。
   零件規格出自使用者提供的規格書 OPD-S6010LB-BW／OPD-S6011LB-BW（Opto Plus LED Corp.，0.6 吋單位數、藍光 InGaN）：
   S6010＝共陽、S6011＝共陰；腳位 1 E、2 D、3 C、4 DP、5 共同、6 B、7 A、8 G、9 F、10 共同；
   IF=20 mA 時 VF 典型 3.2 V、最大 4.0 V；每段連續電流 30 mA、反向電壓 5 V；470 nm；Fig.2 曲線約 2.7 V 起才有電流。
   接法參考 NI《myRIO 入門指南》（2015）第 2 章：共陽七段 a～g、dp 接 MXP B 的 DIO0～7，共陽腳接 +3.3V，程式用 Not 反相。
   DIO 規格出自 NI myRIO-1900 User Guide：3.3 V LVTTL 輸出、5 V 相容輸入（VIH 最大 5.25 V）、灌 4 mA 時 VOL ≤ 0.4 V。
   電流估算（每段約 3 mA）用：LED 約 2.75 V 起導通、內阻約 17 Ω，加上腳位約 60 Ω，是估計值，不是精密量測。 */
(function(){
const L=window.LESSONS;
const PART='myRIO 嵌入式控制';
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
let UID=0;

const SEGS=['a','b','c','d','e','f','g','dp'];
const CODE=[0x3F,0x06,0x5B,0x4F,0x66,0x6D,0x7D,0x07,0x7F,0x6F];
const PIN={a:7,b:6,c:3,d:2,e:1,f:9,g:8,dp:4};
const MXP=[11,13,15,17,19,21,23,25];
const VK=2.75,RLED=17,RPIN=60;

/* 一顆數字的段：segOn = {a:true,...} */
function digitSvg(on,opt){
  opt=opt||{};const lit='#4f8dff',off='#d6dae0',face='#17191c';
  const R=(k,x,y,w,h)=>`<rect data-s="${k}" x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${on[k]?lit:off}"${on[k]?' filter="url(#s7g)"':''}/>`;
  const lab=opt.labels?[['a',60,23],['b',96,63],['c',96,143],['d',60,183],['e',24,143],['f',24,63],['g',60,103]].map(t=>`<text x="${t[1]}" y="${t[2]}" font-size="11" font-weight="700" text-anchor="middle" fill="#111">${t[0]}</text>`).join('')+`<text x="113" y="168" font-size="9" text-anchor="middle" fill="#fff">dp</text>`:'';
  return `<svg viewBox="0 0 128 200" class="s7-digit" role="img" aria-label="七段顯示器：${SEGS.filter(k=>on[k]).join('、')||'全滅'}"><defs><filter id="s7g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect x="0" y="0" width="128" height="200" rx="6" fill="${face}"/>
${R('a',32,12,56,12)}${R('b',90,26,12,68)}${R('c',90,106,12,68)}${R('d',32,176,56,12)}${R('e',18,106,12,68)}${R('f',18,26,12,68)}${R('g',32,94,56,12)}
<circle data-s="dp" cx="113" cy="182" r="6.5" fill="${on.dp?lit:off}"${on.dp?' filter="url(#s7g)"':''}/>${lab}</svg>`;
}

/* 腳位圖：正面看，上排 10～6、下排 1～5 */
function pinoutSvg(){
  const top=[[10,'共同'],[9,'F'],[8,'G'],[7,'A'],[6,'B']],bot=[[1,'E'],[2,'D'],[3,'C'],[4,'DP'],[5,'共同']];
  const xs=[70,100,130,160,190];
  const pin=(x,y1,y2,n,l,ty,ly)=>`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#999" stroke-width="3"/><text x="${x}" y="${ty}" font-size="12" font-weight="700" text-anchor="middle" fill="currentColor">${n}</text><text x="${x}" y="${ly}" font-size="11" text-anchor="middle" fill="${l==='共同'?'#c62828':'#1565c0'}">${l}</text>`;
  const on={};SEGS.forEach(k=>on[k]=false);
  return `<svg viewBox="0 0 260 330" class="s7-pinout" role="img" aria-label="七段顯示器腳位圖，正面看">
${top.map((t,i)=>pin(xs[i],62,40,t[0],t[1],32,16)).join('')}
<rect x="55" y="60" width="150" height="210" rx="6" fill="#17191c"/>
<g transform="translate(78 66) scale(.82)">${digitSvg(on,{labels:true}).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')}</g>
${bot.map((t,i)=>pin(xs[i],270,292,t[0],t[1],306,322)).join('')}
<circle cx="64" cy="262" r="3" fill="#fff"/><text x="10" y="262" font-size="10" fill="currentColor">腳 1</text>
</svg>`;
}

/* 互動：DIO0～7 → 段，共陽／共陰，找接錯的線 */
function seg7Lab(d){
  const id='s7'+(++UID);
  const S={type:'CA',dio:[true,true,true,true,true,true,true,true],run:false,map:[0,1,2,3,4,5,6,7],quiz:null};
  d.innerHTML=`<div class="s7-wrap fig"><div class="s7-show"></div><div class="s7-side">
<div class="s7-row"><b>零件</b><label><input type="radio" name="${id}-t" value="CA" checked> S6010 共陽（共同腳接 +3.3V）</label><label><input type="radio" name="${id}-t" value="CC"> S6011 共陰（共同腳接 GND）</label></div>
<div class="s7-row"><b>程式寫數字</b>${[0,1,2,3,4,5,6,7,8,9].map(n=>`<button type="button" class="s7-n" data-n="${n}">${n}</button>`).join('')}<button type="button" class="s7-off">全滅</button><button type="button" class="s7-idle">程式還沒跑</button></div>
<p class="s7-h">LabVIEW 寫給每一隻 DIO 的值（點一下切換）</p>
<div class="s7-dio"></div>
<p class="s7-say" aria-live="polite"></p>
<div class="s7-quiz"><button type="button" class="s7-q">出一題：偷偷接錯兩條線</button><span class="s7-qa"></span></div>
</div></div>`;
  const show=d.querySelector('.s7-show'),dioBox=d.querySelector('.s7-dio'),say=d.querySelector('.s7-say'),qa=d.querySelector('.s7-qa');
  function segState(){
    const on={},mA={};
    SEGS.forEach((k,i)=>{const w=S.map[i];
      if(!S.run){on[k]=false;mA[k]=S.type==='CC'?(3.3-VK)/40000*1000:0;return;}
      const v=S.dio[w];const drive=S.type==='CA'?!v:v;
      on[k]=drive;mA[k]=drive?(3.3-VK)/(100+RLED+RPIN)*1000:0;});
    return {on,mA};
  }
  function draw(){
    const st=segState(),lit=SEGS.filter(k=>st.on[k]);
    show.innerHTML=digitSvg(st.on);
    dioBox.innerHTML=SEGS.map((k,i)=>`<button type="button" class="s7-b${S.run?(S.dio[i]?' t':' f'):''}" data-i="${i}">A/DIO${i}<small>${S.run?(S.dio[i]?'TRUE':'FALSE'):'輸入'}</small><small>→ ${S.quiz?'？':k}</small></button>`).join('');
    const tot=lit.length*((3.3-VK)/(100+RLED+RPIN)*1000);
    if(!S.run)say.innerHTML=S.type==='CA'?'程式還沒跑：DIO 都是輸入，內建上拉到 3.3 V；共同腳也是 3.3 V，每一段兩端都沒有電壓差，<b>全滅</b>。':'程式還沒跑：DIO 是輸入、上拉到 3.3 V，經過 40 kΩ 只有約 0.01 mA 流過每一段，幾乎看不到（暗處也許有一點點）。';
    else say.innerHTML=lit.length?`亮了 ${lit.length} 段（${lit.join('、')}），每段約 3 mA，${S.type==='CA'?'從 +3.3V 流進各自的 DIO':'從各自的 DIO 流出到 GND'}；合計約 ${tot.toFixed(0)} mA${S.type==='CA'?'，由 +3.3V 供應（上限 150 mA）':'，由 DIO 腳位各自送出'}。`:'全滅。';
  }
  function setNum(n){S.run=true;const c=n==null?0:CODE[n];SEGS.forEach((k,i)=>{const want=!!(c>>i&1);S.dio[i]=S.type==='CA'?!want:want;});draw();}
  d.addEventListener('change',e=>{if(e.target.name===id+'-t'){S.type=e.target.value;S.run=false;draw();}});
  d.addEventListener('click',e=>{
    const n=e.target.closest('.s7-n');if(n){setNum(+n.dataset.n);if(!S.quiz)say.innerHTML+=` 寫 ${n.dataset.n}：${S.type==='CA'?'要亮的段寫 FALSE（共陽）':'要亮的段寫 TRUE（共陰）'}。`;return;}
    if(e.target.closest('.s7-off')){setNum(null);return;}
    if(e.target.closest('.s7-idle')){S.run=false;draw();return;}
    const b=e.target.closest('.s7-b');if(b){const i=+b.dataset.i;if(!S.run){S.run=true;S.dio=S.type==='CA'?S.dio.map(()=>true):S.dio.map(()=>false);}S.dio[i]=!S.dio[i];draw();return;}
    if(e.target.closest('.s7-q')){
      const i=Math.floor(Math.random()*7);let j=Math.floor(Math.random()*6);if(j>=i)j++;
      S.map=[0,1,2,3,4,5,6,7];S.map[i]=j;S.map[j]=i;S.quiz=[Math.min(i,j),Math.max(i,j)];
      qa.innerHTML=`有兩段的線對調了。按幾個數字看看，再選：<select class="s7-a1">${SEGS.slice(0,7).map(k=>`<option>${k}</option>`).join('')}</select> 和 <select class="s7-a2">${SEGS.slice(0,7).map((k,x)=>`<option${x===1?' selected':''}>${k}</option>`).join('')}</select> <button type="button" class="s7-chk">對答案</button>`;
      setNum(8);return;}
    if(e.target.closest('.s7-chk')){
      const a=SEGS.indexOf(d.querySelector('.s7-a1').value),b2=SEGS.indexOf(d.querySelector('.s7-a2').value),g=[Math.min(a,b2),Math.max(a,b2)];
      if(g[0]===S.quiz[0]&&g[1]===S.quiz[1]){qa.innerHTML=`<b class="s7-ok">對了</b>：${SEGS[g[0]]} 和 ${SEGS[g[1]]} 的線對調了。想想看你是用哪幾個數字看出來的。<button type="button" class="s7-q">再一題</button>`;S.map=[0,1,2,3,4,5,6,7];S.quiz=null;draw();}
      else{const p=qa.querySelector('.s7-hint')||qa.appendChild(document.createElement('span'));p.className='s7-hint';p.textContent=' 不是這兩段。提示：找一個數字，讓「應該亮」和「實際亮」只差兩段。';}
      return;}
  });
  draw();
}

const segTable=()=>C.table(['數字','要亮的段','二進位（dp g f e d c b a）','十進位（段碼）'],CODE.map((c,n)=>[String(n),SEGS.filter((k,i)=>c>>i&1).join(' '),c.toString(2).padStart(8,'0').replace(/(\d{4})/,'$1 '),String(c)]));

/* =============================== M3++ =============================== */
L.push({id:'M03C',order:30.36,no:'M3++',part:PART,title:'七段顯示器：讀規格書、接一顆共陽藍光數字、LabVIEW 顯示 0～9',mins:70,
goals:[['學會','拿到一個沒用過的零件，先從規格書找出四件事：共陽還是共陰、每一隻腳是哪一段、要多少電壓、能吃多少電流；再把它換算成電阻值和接線表。'],['做出','把 OPD-S6010LB-BW（共陽、藍光）接到 MXP A 的 DIO0～7，LabVIEW 用一張段碼表顯示 0～9。'],['為什麼','七段顯示器就是 8 顆 LED 共用一隻腳，M3+ 的正向／負向接法、RGB 共陽共陰全部用得上。它也是第一個「接錯線不會冒煙、但數字會怪怪的」零件，最適合練習從現象倒推哪裡接錯。']],
check:'你能說出：S6010 和 S6011 哪一顆是共陽；腳 7 是哪一段、腳 5 和 10 是什麼；為什麼規格書寫 3.2 V，3.3 V 還推得動；每段串多大的電阻、為什麼；共陽顯示 2 時 DIO0～7 各寫什麼；兩條線接反時怎麼從數字看出來。',
body:[
C.h3('先讀規格書','x','拿到新零件，先問四件事'),
`<p>你手上這顆是 Opto Plus 的 <b>OPD-S6010LB-BW</b>：0.6 吋（數字高 15 mm）、一位數、黑底白段、亮藍光的七段顯示器。規格書只有 5 頁，但一個字都不讀就接，十之八九會接錯。動手前，先從規格書回答四個問題：</p>
<ol><li>它是<b>共陽</b>還是<b>共陰</b>？（決定共同腳接 +3.3V 還是 GND，程式寫 TRUE 是亮還是滅）</li>
<li>每一隻腳是<b>哪一段</b>？</li>
<li>要多少<b>電壓</b>才會亮？</li>
<li>每一段能吃多少<b>電流</b>？myRIO 的 DIO 又能給多少？</li></ol>
<p>下面每一題都先自己翻規格書找，再點開對答案。</p>`,
ask('第 1 頁的 DEVICE 表：OPD-S6010LB-BW 和 OPD-S6011LB-BW 差在哪？你手上的是哪一種？',
 `<p>S6010 是<b>共陽</b>（Common Anode），S6011 是<b>共陰</b>（Common Cathode）。兩顆外觀一模一樣，只差料號的一個數字。料號印在顯示器的側面（規格書第 2 頁的尺寸圖上標著 PART NO.／DATE CODE 的位置），拿起來看一下確認。這一課照 <b>S6010 共陽</b>寫；如果你的是 S6011，下面每個地方都會告訴你差在哪。</p>`),
ask('第 2 頁的「內部等效電路」：8 個二極體的箭頭朝哪？5 和 10 兩隻腳是什麼？',
 `<p>S6010 的圖：8 個二極體上面全接在一起，標「5,10」，箭頭往下指到 A、B、C、D、E、F、G、DP 各自的腳。箭頭是電流的方向，所以電流從 5／10 流進來、從各段的腳流出去：5 和 10 是<b>共同的正極</b>，也就是共陽腳。S6011 的圖箭頭反過來，5、10 是共同的負極。</p>
<p>5 和 10 在裡面是接通的，接一隻就夠；兩隻都接也可以，電流分兩隻腳走。</p>`),
{fn:d=>{d.innerHTML=`<div class="s7-pins fig">${pinoutSvg()}<div>${C.table(['腳','是什麼','腳','是什麼'],[['1','E 段','6','B 段'],['2','D 段','7','A 段'],['3','C 段','8','G 段'],['4','DP 小數點','9','F 段'],['5','共同腳','10','共同腳']])}<p class="s7-cap">正面朝自己、小數點在右下時，腳 1 在左下，下排由左到右 1～5，上排由左到右 10～6（照規格書第 2 頁）。<b>腳的號碼和段的名字沒有順序關係</b>，A 段是腳 7，不是腳 1。</p></div></div>`;}},
ask('第 3 頁：VF（順向電壓）典型 3.2 V、最大 4.0 V，條件是 IF = 20 mA。myRIO 的 DIO 只有 3.3 V，推得動嗎？',
 `<p>要看條件：3.2 V 是<b>電流 20 mA 時</b>的壓降。我們本來就不會給 20 mA（DIO 的規格只保證 4 mA），電流小，壓降也小。</p>
<p>翻到第 4 頁的 Fig.2（順向電流對順向電壓）：曲線大約到 <b>2.7 V</b> 才開始翹起來，20 mA 時約 3.1 V，非常陡。所以給幾 mA 的時候，壓降大約 2.7～2.9 V，3.3 V 推得動，只是剩下給電阻的電壓不多（約 0.5 V）。</p>
<p>「最大 4.0 V」的意思是：有些顆的壓降偏高。運氣不好拿到偏高的那顆，用 3.3 V 推會特別暗、甚至某幾段不亮。這不是你接錯，是零件的差異；後面「改用 +5V」那一題就是在處理這件事。</p>`),
ask('那電阻要多大？',
 `<p>限制來自 myRIO，不是 LED：說明書寫 DIO 灌 4 mA 時，輸出低電位最高 0.4 V；這顆 LED 每段可以吃到 30 mA，遠比 DIO 能給的大。所以目標是每段 <b>3 mA 左右</b>，不要超過 4 mA。</p>
<p>估算：3.3 V − 約 2.75 V ＝ 0.55 V，要分給電阻、LED 自己的內阻和腳位的內阻（後兩個合起來大約 80 Ω，是估計）。串 <b>100 Ω</b>：0.55 ÷ 180 ≈ 3 mA。和 M3+ RGB 的綠、藍用的是同一個值，色環棕 黑 棕。</p>
<p>每一段各串一顆，<b>不要</b>只在共同腳串一顆：那樣顯示「1」（2 段亮）和「8」（7 段亮）的亮度會差很多，原因和 M3+ 的 RGB 共用電阻一樣。</p>`),
C.table(['規格書寫的','數字','對你的意思'],[
 ['共陽／共陰','S6010 共陽、S6011 共陰','共同腳（5、10）接 +3.3V；某一段寫 FALSE 才亮'],
 ['VF @ 20 mA','典型 3.2 V，最大 4.0 V','小電流時約 2.7～2.9 V，3.3 V 推得動但餘裕小'],
 ['每段連續電流','30 mA','不是瓶頸；DIO 只保證 4 mA，每段給 3 mA'],
 ['反向電壓','5 V','接反時最多承受 5 V；myRIO 的 3.3 V 接反不會壞，只是不亮'],
 ['波長','470 nm','藍光；外殼的段是白色，不亮時看得到白色的段']]),
note('NI 的入門指南也做過這個實驗','NI《myRIO 入門指南》第 2 章用一顆共陽七段顯示器接在 MXP B：a～g、dp 接 B/DIO0～DIO7，共陽腳接 B/+3.3V，程式裡用 Not 反相。這一課照同樣的對應，但插在 MXP A（和 M3+ 一樣），所以通道是 A/DIO0～7。指南的接線圖上看不到限流電阻；照你這顆的規格估，不串電阻每段可能到 7 mA 上下，超過 DIO 的 4 mA 規格，所以這裡每段串 100 Ω。'),

C.h3('接線','','8 條訊號線、8 顆電阻、1 條電源'),
C.table(['段','顯示器的腳','串','排母（MXP A）','MXP 腳','LabVIEW 通道'],
 SEGS.map((k,i)=>[k,String(PIN[k]),'100 Ω',String(i),String(MXP[i]),'A/DIO'+i]).concat([['共同腳','5（或 10）','不串','+3.3V','33','—（常電）']])),
`<ol class="mr-steps">
<li><b>斷電</b>。</li>
<li>顯示器<b>跨在麵包板中間的溝上</b>插：上排 5 隻在溝的一邊、下排 5 隻在另一邊，這樣 10 隻腳各佔一排，不會互相接通。插之前確認小數點在右下（腳 1 在左下）。</li>
<li>先接共同腳：腳 5 那一排 → 跳線 → 電源軌＋，電源軌＋ → 排母「+3.3V」。</li>
<li><b>先不接 LabVIEW，測一段</b>：拿一顆 100 Ω，一腳插腳 7（A 段）那一排，另一腳插電源軌－（接 GND）。A 段應該亮。這一步同時驗證了三件事：共陽沒弄錯、腳位圖沒看錯、顯示器是好的。</li>
<li>拔掉測試用的電阻。每一隻段腳那一排，各插一顆 100 Ω 跨到旁邊空的一排，再從那一排拉線到排母：A → 「0」、B → 「1」…… DP → 「7」，照上面的表。</li>
<li>接完對一次表，再通電。程式還沒跑時應該<b>全滅</b>（下面的模擬器按「程式還沒跑」看為什麼）。</li></ol>`,
ask('第 4 步測 A 段，結果不亮。可能是哪裡？依序查什麼？',
 `<ol><li>三用電表量腳 5 那一排對 GND：有沒有 3.3 V？沒有 → 共同腳那條線、電源軌、+3.3V 排母。</li>
<li>電阻那隻腳真的插在腳 7 那一排嗎？腳 7 在<b>上排</b>右邊數來第二隻，很容易插成下排的腳 3（C 段）。</li>
<li>如果改接 GND 到共同腳、+3.3V 經電阻到腳 7 才亮 → 你的是共陰（S6011），不是共陽。</li>
<li>都對還是不亮：可能是偏高 VF 的那種顆，試試看把 100 Ω 換成 47 Ω，量一下電流不要超過 4 mA。</li></ol>`),
ask('共陽的共同腳改接 +5V 可以嗎？M3+ 不是說負向接法不要接 +5V？',
 `<p>M3+ 講的是<b>紅光</b> LED：寫 TRUE 時 DIO 是 3.3 V，LED 加電阻兩端還有 5 − 3.3 = 1.7 V，很接近紅光約 1.9 V 的壓降，關不乾淨。</p>
<p>這顆是<b>藍光</b>，Fig.2 顯示要 2.7 V 左右才開始導通。1.7 V 遠低於 2.7 V，寫 TRUE 時一定關得乾淨。所以<b>這顆可以</b>把共同腳接 +5V，好處是電壓餘裕大，VF 偏高的顆也能亮。電阻要重算：(5 − 2.75) ÷ 4 mA − 約 80 Ω ≈ 480 Ω，取 <b>470 Ω</b>（黃 紫 棕），每段約 4 mA。</p>
<p>同一個問題，換了 LED 答案就相反。這就是為什麼要讀規格書，不能背「+5V 不行」。初學先照表用 +3.3V 和 100 Ω，跟 NI 的範例一樣。</p>`),

C.h3('先在模擬器試','','DIO 寫什麼，數字就顯示什麼'),
`<p>左邊是顯示器，右邊 8 個按鈕是 LabVIEW 寫給 A/DIO0～7 的值，每一隻後面標著它接到哪一段。先按數字鍵看看共陽要寫什麼，再切到共陰比較；也按按看「程式還沒跑」。最後按「出一題」：模擬器會偷偷把兩條線對調，你要從顯示出來的數字推出是哪兩條。</p>`,
{fn:d=>seg7Lab(d)},
ask('「出一題」的時候，用哪幾個數字最快看出哪兩條線接反？',
 `<p>挑「只亮一部分、而且不對稱」的數字。例如 <b>1</b> 只亮 b、c：如果顯示出來亮的不是右邊兩段，亮的那兩段就直接告訴你 b、c 的線跑到哪裡去了。<b>8</b> 反而沒用：7 段全亮，任兩條對調都看不出來。</p>
<p>思考方式：寫一個數字，比對「應該亮的段」和「實際亮的段」，差異的那兩段就是嫌疑犯；換一個數字再確認一次。修實機也是這樣，不要一看到怪數字就全部拆掉重接。</p>`),

C.h3('LabVIEW 端','','一張段碼表 + Not + 8 個通道'),
`<p>思路：數字 0～9 不能直接送給 8 隻腳，中間要一張「這個數字要亮哪幾段」的表，叫<b>段碼表</b>。把每個數字要亮的段寫成 8 個位元（a 是最低位、dp 是最高位），就變成一個 0～255 的數。</p>`,
segTable(),
`<ol class="mr-steps">
<li>用 M2 的方法從專案開 myRIO 底下的 Main.vi。</li>
<li>方塊圖放一個 <b>陣列常數</b>，型別 U8，依序填 10 個段碼：63、6、91、79、102、109、125、7、127、111。</li>
<li>前面板放一個數值控制元件「數字」（0～9）。<b>Index Array</b>：陣列接段碼表、索引接「數字」，取出這個數字的段碼。</li>
<li><b>Number To Boolean Array</b>：把段碼變成 8 個布林，第 0 個是 a、第 7 個是 dp（最低位在前，剛好和 DIO0＝a 對齊）。</li>
<li><b>Not</b>：共陽是「寫 FALSE 才亮」，整個陣列反相一次（Not 可以直接接陣列）。共陰（S6011）就不要這個 Not。</li>
<li>再一個 <b>Index Array</b>，往下拉成 8 個輸出，拿出第 0～7 個元素。</li>
<li>myRIO ▸ <b>Digital Output</b>，在設定視窗按 <b>+</b> 加到 8 個通道：A/DIO0～A/DIO7（NI 入門指南的設定畫面就是這樣一個一個加），8 個輸出依序接上去。</li>
<li>都放在 Main Loop 裡，跑起來改「數字」。</li></ol>`,
ask('前面板輸入 12，會顯示什麼？',
 `<p>Index Array 的索引超出陣列範圍時，輸出這個型別的預設值，U8 是 0。0 變成 8 個 FALSE，經過 Not 變成 8 個 TRUE，共陽寫 TRUE 是滅：<b>全滅</b>。程式不會出錯，只是什麼都不顯示。要擋住，可以在前面板把「數字」的範圍設成 0～9，或在 Index Array 前用 In Range and Coerce 限制。</p>`),
ask('按 Stop 之後顯示器會停在最後一個數字嗎？',
 `<p>不會。範本最後的 Reset myRIO.vi 把 DIO 放回輸入、上拉到 3.3 V；共陽的共同腳也是 3.3 V，每一段兩端沒有電壓差，<b>全滅</b>。如果你希望停止後保持某個數字，就要拿掉 Reset，或在結束前寫一次你要的值，再想清楚這樣安不安全。</p>`),
tip('段碼為什麼用數字存','把 10 個數字的段寫成 10 個 U8，表很短、很好檢查，也是單晶片、PLC 常見的做法。你也可以改成 10×8 的二維布林陣列，用滑鼠點；但 80 個小方塊很難一眼看出有沒有點錯，數字表配上面那張二進位表比較好對。'),

C.h3('再做一點','','電位器選數字、跑馬燈'),
`<ul>
<li><b>轉電位器改數字</b>：照 M5 把電位器接到 AI（例如 A/AI0），電壓除以滿刻度乘 9、四捨五入，就是 0～9。轉到最兩端時，數字會不會在兩個值之間跳？M5 講的雜訊在這裡看得特別清楚。</li>
<li><b>跑馬燈</b>（NI 入門指南的延伸題）：讓 a、b、c、d、e、f 六段一次只亮一段，繞著外圈轉。用 Shift Register 記住現在亮第幾段，每次迴圈加 1、到 6 歸 0；速度用電位器調、方向用一個開關切。提示：這次不需要段碼表，用「1 左移幾位」就能算出只有一段亮的段碼。</li>
<li><b>小數點</b>：dp 接在 DIO7，段碼最高位。顯示「3.」就是 79 + 128 = 207。</li></ul>`,

C.h3('上機前檢查','','插電之前看一遍'),
`<ul class="mr-check">
<li>看顯示器側面的料號：S6010 共陽、S6011 共陰。</li>
<li>顯示器跨在溝上，小數點在右下，腳 1 在左下。</li>
<li>每一段各串一顆電阻（3.3 V 用 100 Ω；接 +5V 用 470 Ω）。</li>
<li>共同腳接 +3.3V（共陰則接 GND），不要接到 DIO。</li>
<li>先手動測 A 段亮，再接 LabVIEW。</li>
<li>Express VI 的 8 個通道順序是 DIO0～7，對應 a～g、dp；接頭選 A（插在 B 就選 B）。</li></ul>`,
{quiz:[
 {q:'OPD-S6010LB-BW 是？',o:['共陽：共同腳接 +3.3V','共陰：共同腳接 GND','兩種都可以','看接法決定'],a:0,ex:'規格書第 1 頁：S6010 共陽、S6011 共陰。'},
 {q:'這顆顯示器的 A 段是第幾腳？',o:['7','1','10','3'],a:0,ex:'腳 1 是 E；腳號和段名沒有順序關係，要看腳位圖。'},
 {q:'規格書寫 VF 典型 3.2 V（20 mA），用 3.3 V 推每段約 3 mA 為什麼可以？',o:['電流小時壓降也小，曲線約 2.7 V 起就導通','3.2 V 是最小值','LED 不需要電壓','DIO 可以輸出 5 V'],a:0,ex:'規格的數字一定要看條件。'},
 {q:'共陽接法，數字 1（只亮 b、c），DIO0～6 要寫？',o:['b、c 寫 FALSE，其他寫 TRUE','b、c 寫 TRUE，其他寫 FALSE','全部 TRUE','全部 FALSE'],a:0,ex:'共陽＝負向接法，FALSE 才亮；程式裡用 Not 處理。'},
 {q:'寫數字 1，結果亮的是 b 和 g。最可能是？',o:['c 和 g 的線對調了','b 段壞了','共同腳沒接','電阻太大'],a:0,ex:'應該亮 b、c，實際亮 b、g：c 的訊號跑到 g 去了。'},
 {q:'這顆藍光共陽改接 +5V，寫 TRUE 時關得掉嗎？',o:['關得掉：5 − 3.3 = 1.7 V 遠低於約 2.7 V 的導通電壓','關不掉，和紅光一樣','會燒掉 DIO','要看程式'],a:0,ex:'同一個接法，換了 LED 答案就不同，所以要讀規格書。電阻要改成約 470 Ω。'}
]}
]});
window.MR_S7={CODE,SEGS,PIN};
})();
