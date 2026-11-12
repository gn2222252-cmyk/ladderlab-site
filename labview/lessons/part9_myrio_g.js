/* 第九部分：myRIO（M3+）——Digilent MXP 麵包板：看懂、接線、LED 正向／負向接法。
   板子上的字、排母排列，照使用者自己的實物照片（img/myrio/real/bb_*.jpg，已去除拍攝資訊）。
   myRIO 腳位與電氣規格出自 NI myRIO-1900 User Guide（376047），和 M03 同一份：
   DIO 3.3 V 輸出、4 mA 時 VOH ≥ 2.4 V；MXP DIO0～13 有 40 kΩ 上拉、DIO14～15 有 2.1 kΩ 上拉；+5 V 100 mA、+3.3 V 150 mA。
   LED 壓降（紅約 1.9 V、綠約 2.1 V、白／藍約 3 V）、LED 約 20 mA 額定、麵包板內部相通方式，是通用電子知識。
   模擬器：導線、按下的按鈕＝同一個節點；電阻、LED（導通時＝壓降＋小電阻）、DIO 輸出（約 60 Ω 內阻）、上拉電阻
   用節點電壓法解；LED 導通／截止反覆試到穩定。數字是估計，用來比較接法，不是精密量測。 */
(function(){
const L=window.LESSONS;
const PART='myRIO 嵌入式控制';
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const shot=(f,cap,half)=>`<figure class="mr-shot${half?' half':''}"><img src="img/myrio/real/${f}" alt="${cap}" loading="lazy"><figcaption>${cap}</figcaption></figure>`;
const chain=(xs)=>`<div class="bb-chain">${xs.map(x=>`<span class="${x[1]||''}">${x[0]}</span>`).join('<i>→</i>')}</div>`;
let UID=0;

/* ---------- 板子上的排母（照實物照片） ---------- */
const DLN=['GND'].concat(Array.from({length:16},(_,i)=>'DIO'+i),['GND','+5V','+3.3V','GND']);
const DLD=['GND'].concat(Array.from({length:16},(_,i)=>String(i)),['GND','+5V','+3.3V','GND']);
const TLN=['AI0','AI1','AI2','AI3','GND','AO0','AO1','GND','TX','RX','+5V','+3.3V','GND'];
const TLD=['0','1','2','3','GND','0','1','GND','TX','RX','+5V','+3.3V','GND'];
const MXPPIN={DIO0:11,DIO1:13,DIO2:15,DIO3:17,DIO4:19,DIO5:21,DIO6:23,DIO7:25,DIO8:27,DIO9:29,DIO10:31,DIO11:18,DIO12:22,DIO13:26,DIO14:32,DIO15:34,AI0:3,AI1:5,AI2:7,AI3:9,AO0:2,AO1:4,RX:10,TX:14,'+5V':1,'+3.3V':33};
const FN2={DIO5:'SPI.CLK',DIO6:'SPI.MISO',DIO7:'SPI.MOSI',DIO8:'PWM0',DIO9:'PWM1',DIO10:'PWM2',DIO11:'ENC.A',DIO12:'ENC.B',DIO14:'I2C.SCL',DIO15:'I2C.SDA'};
const COLS='ABCDEFGHIJ';

/* ---------- 版面座標 ---------- */
const POS={},RY=r=>76+(r-1)*16;
const CX={A:92,B:108,C:124,D:140,E:156,F:196,G:212,H:228,I:244,J:260};
for(let r=1;r<=30;r++){POS['P'+r]=[34,RY(r)];POS['N'+r]=[52,RY(r)];for(const c of COLS)POS[c+r]=[CX[c],RY(r)];}
DLN.forEach((_,i)=>{POS['X'+i+'a']=[20+i*16,576];POS['X'+i+'b']=[20+i*16,590];});
TLN.forEach((_,i)=>{POS['Y'+i+'a']=[96+i*16,16];POS['Y'+i+'b']=[96+i*16,30];});
function net(h){
  if(h[0]==='P')return 'RP';if(h[0]==='N')return 'RN';
  if(h[0]==='X')return DLN[parseInt(h.slice(1),10)];
  if(h[0]==='Y')return TLN[parseInt(h.slice(1),10)];
  return ('ABCDE'.includes(h[0])?'L':'R')+h.slice(1);
}
const hd=n=>'X'+DLN.indexOf(n)+'a';
function holeName(h){
  if(h[0]==='P')return '電源軌 + 第 '+h.slice(1)+' 列';
  if(h[0]==='N')return '電源軌 − 第 '+h.slice(1)+' 列';
  if(h[0]==='X'||h[0]==='Y')return '排母 '+net(h);
  return h;
}
function holeSay(h){
  const n=net(h);
  if(n==='RP'||n==='RN')return `<b>${holeName(h)}</b>：這一整排都相通（模擬裡當作第 1～30 列全通）。有些麵包板的電源軌在中間斷開，用三用電表的通路檔量一下第 1 列和第 30 列就知道。`;
  if(h[0]==='X'||h[0]==='Y'){
    if(n==='GND')return '<b>GND</b>：所有 GND 都是同一個地。模擬裡把排母的上下兩個孔當作同一個訊號；第一次用，請用三用電表確認你的板子。';
    const p=MXPPIN[n];
    return `<b>${n}</b>：接到 myRIO MXP 第 ${p} 腳${FN2[n]?`（第二功能 ${FN2[n]}）`:''}。插在 MXP A，LabVIEW 裡叫 <code>A/${n}</code>；插在 B 就是 <code>B/${n}</code>。上下兩個孔是同一個訊號。`;
  }
  const r=h.slice(1),left='ABCDE'.includes(h[0]);
  return `<b>${h}</b>：和 ${left?'A':'F'}${r}～${left?'E':'J'}${r} 這 5 個孔相通（同一列、溝的同一邊）。跨過中間的溝（${left?'F':'A'}～${left?'J':'E'}）就不通，上下別列也不通。`;
}

/* ---------- 電路求解 ---------- */
const LEDC={red:['紅',1.9,'#ff3b30'],green:['綠',2.1,'#34c759'],white:['白（透明外殼）',3.0,'#fff6c8']};
const RS_LED=8,R_DIO=60;
function gauss(A,b){
  const n=b.length;
  for(let i=0;i<n;i++){
    let m=i;for(let k=i+1;k<n;k++)if(Math.abs(A[k][i])>Math.abs(A[m][i]))m=k;
    [A[i],A[m]]=[A[m],A[i]];[b[i],b[m]]=[b[m],b[i]];
    const p=A[i][i]||1e-30;
    for(let k=i+1;k<n;k++){const f=A[k][i]/p;if(!f)continue;for(let j=i;j<n;j++)A[k][j]-=f*A[i][j];b[k]-=f*b[i];}
  }
  const x=new Array(n).fill(0);
  for(let i=n-1;i>=0;i--){let s=b[i];for(let j=i+1;j<n;j++)s-=A[i][j]*x[j];x[i]=s/(A[i][i]||1e-30);}
  return x;
}
function solve(comps,dio){
  const par={};
  const f=x=>{if(par[x]==null)par[x]=x;return par[x]===x?x:(par[x]=f(par[x]));};
  const U=(a,b)=>{a=f(a);b=f(b);if(a!==b)par[a]=b;};
  comps.forEach(c=>{if(c.t==='w'||(c.t==='btn'&&c.pressed))U(net(c.a),net(c.b));});
  const FIX={GND:0,'+3.3V':3.3,'+5V':5};
  const fixedAt={};
  Object.keys(FIX).forEach(n=>{const r=f(n);(fixedAt[r]=fixedAt[r]||[]).push(n);});
  for(const r in fixedAt)if(fixedAt[r].length>1)return {short:`短路：${fixedAt[r].join(' 和 ')} 被導線（或按下的按鈕）直接接在一起。真的這樣接，myRIO 的電源保護會動作，甚至燒壞。`};
  const FV={};for(const r in fixedAt)FV[r]=FIX[fixedAt[r][0]];
  FV.VPU=3.3;
  const used=new Set();comps.forEach(c=>[c.a,c.b].forEach(h=>{const n=net(h);if(/^DIO\d/.test(n))used.add(+n.slice(3));}));
  const els=[];
  comps.forEach((c,i)=>{if(c.t==='r')els.push({p:f(net(c.a)),q:f(net(c.b)),g:1/c.R});});
  used.forEach(k=>{const m=dio[k]||'in',n=f('DIO'+k);
    if(m==='in')els.push({p:'VPU',q:n,g:1/(k<14?40000:2100)});
    else{FV['SRC'+k]=m==='hi'?3.3:0;els.push({p:'SRC'+k,q:n,g:1/R_DIO,src:k});}});
  const leds=comps.map((c,i)=>c.t==='led'?i:-1).filter(i=>i>=0);
  const st={};leds.forEach(i=>st[i]=true);
  let V;
  for(let it=0;it<30;it++){
    const all=els.concat(leds.filter(i=>st[i]).map(i=>{const c=comps[i];return {p:f(net(c.a)),q:f(net(c.b)),g:1/RS_LED,i0:LEDC[c.col][1]/RS_LED};}));
    const nodes=new Set();all.forEach(e=>[e.p,e.q].forEach(x=>{if(FV[x]==null)nodes.add(x);}));
    comps.forEach(c=>[c.a,c.b].forEach(h=>{const x=f(net(h));if(FV[x]==null)nodes.add(x);}));
    const idx={};[...nodes].forEach((x,i)=>idx[x]=i);
    const n=nodes.size,A=Array.from({length:n},()=>new Array(n).fill(0)),b=new Array(n).fill(0);
    for(let i=0;i<n;i++)A[i][i]+=1e-9;
    all.forEach(e=>{const g=e.g,i0=e.i0||0,P=idx[e.p],Q=idx[e.q];
      if(P!=null){A[P][P]+=g;b[P]+=i0;if(Q!=null)A[P][Q]-=g;else b[P]+=g*FV[e.q];}
      if(Q!=null){A[Q][Q]+=g;b[Q]-=i0;if(P!=null)A[Q][P]-=g;else b[Q]+=g*FV[e.p];}});
    const x=gauss(A,b);
    V=r=>FV[r]!=null?FV[r]:(idx[r]!=null?x[idx[r]]:0);
    let ch=false;
    leds.forEach(i=>{const c=comps[i],vf=LEDC[c.col][1],d=V(f(net(c.a)))-V(f(net(c.b)));
      if(st[i]&&(d-vf)/RS_LED<-1e-9){st[i]=false;ch=true;}
      else if(!st[i]&&d>vf+1e-6){st[i]=true;ch=true;}});
    if(!ch)break;
  }
  const cnt={};comps.forEach(c=>[c.a,c.b].forEach(h=>{const r=f(net(h));cnt[r]=(cnt[r]||0)+1;}));
  const isAnchor=r=>FV[r]!=null||[...used].some(k=>f('DIO'+k)===r)||['AI0','AI1','AI2','AI3'].some(a=>f(a)===r);
  const res={led:{},dio:{},ai:{},rail:{},V,f};
  leds.forEach(i=>{const c=comps[i],vf=LEDC[c.col][1],ra=f(net(c.a)),rc=f(net(c.b)),d=V(ra)-V(rc);
    const I=st[i]?Math.max(0,(d-vf)/RS_LED):0,mA=I*1000;let msg;
    if(ra===rc)msg='兩隻腳插在相通的孔上（同一列或同一條軌），LED 被自己短路，永遠不會亮。';
    else if(!st[i]&&V(rc)-V(ra)>vf-0.05)msg='接反了：短腳那邊電壓比較高。LED 只讓電流從長腳（+）流到短腳（−）。';
    else if(!st[i]&&cnt[ra]===1&&!isAnchor(ra))msg=`長腳那一條（${holeName(c.a)} 所在的那一組孔）除了這隻腳，沒有接任何東西：電流沒有路，斷路。`;
    else if(!st[i]&&cnt[rc]===1&&!isAnchor(rc))msg=`短腳那一條（${holeName(c.b)} 所在的那一組孔）除了這隻腳，沒有接任何東西：電流沒有路，斷路。`;
    else if(!st[i]&&d>vf-0.4&&d>0.3)msg=`兩端有 ${d.toFixed(2)} V，接近${LEDC[c.col][0]} LED 需要的約 ${vf} V：暗處可能看到微微亮，關不乾淨。`;
    else if(!st[i])msg=`兩端只有 ${Math.max(0,d).toFixed(2)} V，不到${LEDC[c.col][0]} LED 需要的約 ${vf} V，不亮。`;
    else if(mA>20)msg=`電流約 ${mA.toFixed(0)} mA，超過一般 LED 約 20 mA 的額定：很快會燒掉，也拖垮供電的腳位。要串電阻。`;
    else if(mA<0.2)msg=`只有 ${mA.toFixed(2)} mA：幾乎看不到，暗處才看得出一點點光。`;
    else if(mA<1.5)msg=`約 ${mA.toFixed(1)} mA：會亮，但偏暗。`;
    else msg=`約 ${mA.toFixed(1)} mA：正常亮。`;
    res.led[i]={on:st[i]&&mA>=0.2,mA,msg};});
  used.forEach(k=>{const m=dio[k]||'in',v=V(f('DIO'+k));
    if(m==='in')res.dio[k]={m,v,read:v>2.0?'TRUE':(v<0.8?'FALSE':'不確定')};
    else{const I=((m==='hi'?3.3:0)-v)/R_DIO*1000;res.dio[k]={m,v,I};}});
  ['AI0','AI1','AI2','AI3'].forEach(a=>{if(comps.some(c=>net(c.a)===a||net(c.b)===a))res.ai[a]=V(f(a));});
  ['+3.3V','+5V'].forEach(s=>{const r=f(s);let I=0;
    const all=els.concat(leds.filter(i=>st[i]).map(i=>{const c=comps[i];return {p:f(net(c.a)),q:f(net(c.b)),g:1/RS_LED,i0:LEDC[c.col][1]/RS_LED};}));
    all.forEach(e=>{const cur=e.g*(V(e.p)-V(e.q))-(e.i0||0);if(e.p===r)I+=cur;if(e.q===r)I-=cur;});
    if(comps.some(c=>f(net(c.a))===r||f(net(c.b))===r))res.rail[s]=I*1000;});
  return res;
}

/* ---------- 預設接法 ---------- */
const PRESETS={
  photo:{name:'你照片裡的接法',col:'white',dio:{},comps:[['w',hd('+3.3V'),'P28'],['w',hd('GND'),'N28'],['led','C16','N16']],
    say:'照你的照片：橘線 +3.3V → 電源軌 +，灰線 GND → 電源軌 −，LED 一腳在 − 軌、一腳在 C16。哪隻是長腳照片看不出來，這裡先假設長腳在 C16；按「LED 反過來」也試試另一種。'},
  always:{name:'常亮測試（不用 LabVIEW）',col:'red',dio:{},comps:[['w',hd('+3.3V'),'P30'],['w','X0b','N30'],['r','P10','A10'],['led','C10','C13'],['w','A13','N13']],
    say:'+3.3V → 電源軌 + → 330 Ω → LED 長腳（C10）→ 短腳（C13）→ 跳線 → 電源軌 − → GND。先用這個確認 LED、電阻、麵包板都沒問題。'},
  source:{name:'正向接法：DIO0 送電',col:'red',dio:{0:'hi'},comps:[['w',hd('DIO0'),'A8'],['r','B8','B12'],['led','C12','C14'],['w','A14','N14'],['w','X0b','N30']],
    say:'DIO0 → 330 Ω → LED 長腳 → 短腳 → GND。DIO0 寫 TRUE（3.3 V）電流流出來，LED 亮；寫 FALSE 不亮。到右邊改 DIO0 的狀態試試。'},
  sink:{name:'負向接法：DIO0 吸電',col:'red',dio:{0:'lo'},comps:[['w',hd('+3.3V'),'P30'],['r','P8','A8'],['led','C8','C10'],['w',hd('DIO0'),'E10']],
    say:'+3.3V → 330 Ω → LED 長腳 → 短腳 → DIO0。DIO0 寫 FALSE（0 V）時，電流從 +3.3V 流進 DIO0，LED 亮；寫 TRUE 時 LED 兩端都是 3.3 V，不亮。邏輯和正向相反。'},
  sink5:{name:'陷阱：負向接到 +5V',col:'red',dio:{0:'hi'},comps:[['w',hd('+5V'),'P30'],['r','P8','A8'],['led','C8','C10'],['w',hd('DIO0'),'E10']],
    say:'負向接法改接 +5V。DIO0 寫 TRUE 想關燈，但 DIO 最高只有 3.3 V，LED 加電阻兩端還有 1.7 V。看看 LED 和 DIO0 的情況。'},
  nores:{name:'錯誤：沒串電阻',col:'red',dio:{0:'hi'},comps:[['w',hd('DIO0'),'A12'],['led','C12','C14'],['w','A14','N14'],['w','X0b','N30']],
    say:'DIO0 直接推 LED，沒有電阻。看 LED 電流和 DIO0 的電流。'},
  btn:{name:'按鈕輸入：DIO1',col:'red',dio:{1:'in'},comps:[['w',hd('DIO1'),'F20'],['btn','G20','G23'],['w','F23','N23'],['w','X0b','N30']],
    say:'DIO1 → 按鈕 → GND。DIO1 是輸入，內建 40 kΩ 上拉：沒按讀到 TRUE，按下去讀到 FALSE。點按鈕（灰色小方塊）按下、放開。'}
};

function bbLab(d,start){
  const id='bb'+(++UID),S={tool:'look',R:330,col:'red',comps:[],dio:{},sel:null,hi:null,wn:0};
  const holes=Object.keys(POS);
  const rowNum=[1,5,10,15,20,25,30].map(r=>`<text x="78" y="${RY(r)+3}" font-size="8" text-anchor="end" fill="#555">${r}</text><text x="274" y="${RY(r)+3}" font-size="8" fill="#555">${r}</text>`).join('');
  const colLab=c=>`<text x="${CX[c]}" y="66" font-size="8" text-anchor="middle" fill="#555">${c}</text><text x="${CX[c]}" y="558" font-size="8" text-anchor="middle" fill="#555">${c}</text>`;
  const dlab=DLD.map((t,i)=>t.length>2?`<text transform="translate(${20+i*16+3},606) rotate(90)" font-size="7.5" fill="#e8eef5">${t}</text>`:`<text x="${20+i*16}" y="612" font-size="8" text-anchor="middle" fill="#e8eef5">${t}</text>`).join('');
  const tlab=TLD.map((t,i)=>t.length>2?`<text transform="translate(${96+i*16+3},40) rotate(-90)" font-size="6.5" fill="#e8eef5">${t}</text>`:`<text x="${96+i*16}" y="47" font-size="8" text-anchor="middle" fill="#e8eef5">${t}</text>`).join('');
  const svg=`<svg class="bb-svg" viewBox="0 0 360 640" role="img" aria-label="MXP 麵包板模擬：點孔看相通，或選工具接線">
<rect x="2" y="2" width="356" height="636" rx="10" fill="#14476e"/>
<rect x="84" y="6" width="214" height="34" rx="3" fill="#1b1b1b"/><rect x="8" y="568" width="344" height="30" rx="3" fill="#1b1b1b"/>
${tlab}<text x="120" y="57" font-size="7.5" text-anchor="middle" fill="#9fc3e6">AI</text><text x="184" y="57" font-size="7.5" text-anchor="middle" fill="#9fc3e6">AO</text><text x="236" y="57" font-size="7.5" text-anchor="middle" fill="#9fc3e6">UART</text>
${dlab}<text x="150" y="634" font-size="8" text-anchor="middle" fill="#9fc3e6">DIO</text>
<rect x="16" y="60" width="52" height="500" rx="3" fill="#f6f6f3"/><rect x="72" y="60" width="210" height="500" rx="3" fill="#f6f6f3"/>
<rect x="172" y="60" width="8" height="500" fill="#dcdcd6"/>
<line x1="24" y1="70" x2="24" y2="548" stroke="#d32f2f" stroke-width="1.5"/><line x1="62" y1="70" x2="62" y2="548" stroke="#1e63c6" stroke-width="1.5"/>
<text x="30" y="66" font-size="10" fill="#d32f2f">+</text><text x="49" y="66" font-size="10" fill="#1e63c6">−</text>
${[...COLS].map(colLab).join('')}${rowNum}
${holes.map(h=>{const [x,y]=POS[h];return `<rect class="bb-h" data-h="${h}" x="${x-4}" y="${y-4}" width="8" height="8" rx="1.5"/>`;}).join('')}
<g class="bb-cg"></g></svg>`;
  const pre=Object.keys(PRESETS).map(k=>`<button type="button" class="bb-pb" data-p="${k}">${PRESETS[k].name}</button>`).join('');
  d.innerHTML=`<div class="bb-wrap fig"><div class="bb-board">${svg}</div><div class="bb-side">
<div class="bb-pre"><b>載入接法</b>${pre}<button type="button" class="bb-flip">LED 反過來</button><button type="button" class="bb-clr">清除全部</button></div>
<fieldset class="bb-tools"><legend>工具（點兩個孔放一個元件）</legend>${[['look','看相通'],['w','跳線'],['r','電阻'],['led','LED（先點長腳）'],['btn','按鈕'],['del','刪除']].map(t=>`<label><input type="radio" name="${id}-t" value="${t[0]}"${t[0]==='look'?' checked':''}> ${t[1]}</label>`).join('')}</fieldset>
<div class="bb-opt"><label>電阻 <select class="bb-r">${[100,220,330,1000,10000].map(r=>`<option value="${r}"${r===330?' selected':''}>${r>=1000?r/1000+' kΩ':r+' Ω'}</option>`).join('')}</select></label>
<label>LED <select class="bb-c">${Object.keys(LEDC).map(k=>`<option value="${k}">${LEDC[k][0]}</option>`).join('')}</select></label></div>
<p class="bb-say" aria-live="polite">點任何一個孔，看它和哪些孔相通。或先載入一個接法。</p>
<div class="bb-dio"></div><div class="bb-out" aria-live="polite"></div></div></div>`;
  const cg=d.querySelector('.bb-cg'),say=d.querySelector('.bb-say'),out=d.querySelector('.bb-out'),dioBox=d.querySelector('.bb-dio');
  const hEls={};d.querySelectorAll('.bb-h').forEach(e=>hEls[e.dataset.h]=e);
  const WC=['#e8711a','#7a7a7a','#1565c0','#2e7d32','#8e24aa','#c62828'];
  function draw(res){
    cg.innerHTML=S.comps.map((c,i)=>{
      const [x1,y1]=POS[c.a],[x2,y2]=POS[c.b],mx=(x1+x2)/2,my=(y1+y2)/2,dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1,ang=Math.atan2(dy,dx)*180/Math.PI;
      if(c.t==='w'){const col=WC[c.k%WC.length],bend=Math.min(26,len*.22),cx=mx-dy/len*bend,cy=my+dx/len*bend;
        return `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" stroke="${col}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".92"/><circle class="hit" data-i="${i}" cx="${(mx+cx)/2}" cy="${(my+cy)/2}" r="4" fill="${col}" stroke="#fff" stroke-width="1"/>`;}
      if(c.t==='r')return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8d8d8d" stroke-width="1.6"/><g transform="translate(${mx} ${my}) rotate(${ang})"><rect class="hit" data-i="${i}" x="-10" y="-4" width="20" height="8" rx="3.5" fill="#d9bf86" stroke="#7a5f12"/></g><text x="${mx+9}" y="${my-6}" font-size="7.5" fill="#5a4300">${c.R>=1000?c.R/1000+'k':c.R}</text>`;
      if(c.t==='led'){const L_=res&&res.led&&res.led[i],on=L_&&L_.on,lc=LEDC[c.col],op=on?Math.min(1,.35+L_.mA/8):0;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#9a9a9a" stroke-width="1.6"/>${on?`<circle cx="${mx}" cy="${my}" r="14" fill="${lc[2]}" opacity="${(op*.45).toFixed(2)}"/>`:''}<circle class="hit" data-i="${i}" cx="${mx}" cy="${my}" r="7" fill="${on?lc[2]:'#f2f2f2'}" fill-opacity="${on?op.toFixed(2):1}" stroke="${c.col==='white'?'#b0a46a':lc[2]}" stroke-width="1.5"/><text x="${x1+(dx>=0?-9:5)}" y="${y1-5}" font-size="9" font-weight="700" fill="#c62828">+</text>`;}
      if(c.t==='btn')return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#666" stroke-width="1.6"/><rect class="hit" data-i="${i}" x="${mx-6}" y="${my-6}" width="12" height="12" rx="2" fill="${c.pressed?'#333':'#c9c9c9'}" stroke="#333"/>`;
      return '';}).join('')+(S.sel?`<circle cx="${POS[S.sel][0]}" cy="${POS[S.sel][1]}" r="7" fill="none" stroke="#d32f2f" stroke-width="2"/>`:'');
  }
  function update(){
    const used=[...new Set(S.comps.flatMap(c=>[c.a,c.b]).map(net).filter(n=>/^DIO\d/.test(n)).map(n=>+n.slice(3)))].sort((a,b)=>a-b);
    dioBox.innerHTML=used.length?`<p class="bb-h4">LabVIEW 對 DIO 做什麼（插在 MXP A）</p>`+used.map(k=>`<label class="bb-dl">A/DIO${k} <select data-k="${k}">${[['hi','Digital Output 寫 TRUE（3.3 V）'],['lo','Digital Output 寫 FALSE（0 V）'],['in','Digital Input（或程式還沒跑）']].map(o=>`<option value="${o[0]}"${(S.dio[k]||'in')===o[0]?' selected':''}>${o[1]}</option>`).join('')}</select></label>`).join(''):'';
    if(!S.comps.length){draw(null);out.innerHTML='';return;}
    const res=solve(S.comps,S.dio);
    draw(res);
    if(res.short){out.innerHTML=`<p class="bb-bad">${res.short}</p>`;return;}
    const li=[];
    S.comps.forEach((c,i)=>{if(c.t==='led'){const r=res.led[i];li.push(`<li class="${r.mA>20?'bb-bad':(r.on?'bb-ok':'')}"><b>LED（${LEDC[c.col][0]}）${r.on?'亮':'不亮'}</b>：${r.msg}</li>`);}});
    Object.keys(res.dio).forEach(k=>{const r=res.dio[k];
      if(r.m==='in')li.push(`<li><b>A/DIO${k} 輸入</b>：腳上 ${r.v.toFixed(2)} V，Digital Input 讀到 <b>${r.read}</b>。</li>`);
      else{const a=Math.abs(r.I),dir=r.I>=0?'流出':'流進';li.push(`<li class="${a>12?'bb-bad':(a>4.5?'bb-warn':'')}"><b>A/DIO${k} 輸出</b>：腳上 ${r.v.toFixed(2)} V，電流 ${a.toFixed(1)} mA ${dir}腳位。${a>12?'太大了：輸出電壓被拉垮，長時間會傷到腳位。':(a>4.5?'超過說明書給規格的 4 mA，輸出電壓會往下掉。':'')}</li>`);}});
    Object.keys(res.ai).forEach(a=>li.push(`<li><b>${a}</b>：約 ${res.ai[a].toFixed(2)} V。</li>`));
    Object.keys(res.rail).forEach(s=>{const I=res.rail[s],lim=s==='+5V'?100:150;li.push(`<li class="${I>lim?'bb-bad':''}"><b>${s}</b> 送出約 ${Math.max(0,I).toFixed(1)} mA（上限 ${lim} mA）。</li>`);});
    out.innerHTML=`<ul class="bb-res">${li.join('')}</ul>`;
  }
  function load(k){const p=PRESETS[k];S.comps=[];S.wn=0;S.sel=null;S.dio=Object.assign({},p.dio);
    p.comps.forEach(c=>{const o={t:c[0],a:c[1],b:c[2],R:330,col:p.col,pressed:false};if(o.t==='w')o.k=S.wn++;S.comps.push(o);});
    say.innerHTML=`<b>${p.name}</b>：${p.say}`;clearHi();update();}
  function clearHi(){Object.values(hEls).forEach(e=>e.classList.remove('hi'));}
  d.addEventListener('change',e=>{
    if(e.target.name===id+'-t'){S.tool=e.target.value;S.sel=null;clearHi();update();say.textContent={look:'點任何一個孔，看它和哪些孔相通。',w:'跳線：點起點的孔，再點終點的孔。',r:'電阻：點兩個孔。電阻沒有方向。',led:'LED：先點長腳（+）要插的孔，再點短腳（−）的孔。',btn:'按鈕：點兩個孔。放好之後點灰色小方塊可以按下／放開。',del:'刪除：點元件中間的小點、色塊。'}[S.tool];}
    else if(e.target.classList.contains('bb-r'))S.R=+e.target.value;
    else if(e.target.classList.contains('bb-c')){S.col=e.target.value;S.comps.forEach(c=>{if(c.t==='led')c.col=S.col;});update();}
    else if(e.target.dataset.k!=null){S.dio[+e.target.dataset.k]=e.target.value;update();}
  });
  d.addEventListener('click',e=>{
    const pb=e.target.closest('.bb-pb');if(pb){load(pb.dataset.p);return;}
    if(e.target.closest('.bb-clr')){S.comps=[];S.dio={};S.sel=null;S.wn=0;clearHi();say.textContent='清空了。選工具開始接。';update();return;}
    if(e.target.closest('.bb-flip')){S.comps.forEach(c=>{if(c.t==='led'){const t=c.a;c.a=c.b;c.b=t;}});say.textContent='把每顆 LED 的長腳、短腳對調了。';update();return;}
    const hit=e.target.closest('.hit');
    if(hit){const i=+hit.dataset.i,c=S.comps[i];
      if(S.tool==='del'){S.comps.splice(i,1);update();return;}
      if(c.t==='btn'){c.pressed=!c.pressed;say.textContent=c.pressed?'按鈕按下：兩隻腳接通。':'按鈕放開：兩隻腳斷開。';update();return;}}
    const h=e.target.closest('.bb-h');if(!h)return;const hid=h.dataset.h;
    if(S.tool==='look'||S.tool==='del'){clearHi();const n=net(hid);holes.forEach(x=>{if(net(x)===n)hEls[x].classList.add('hi');});say.innerHTML=holeSay(hid);return;}
    if(!S.sel){S.sel=hid;say.innerHTML=`起點：${holeName(hid)}。再點第二個孔。`;draw(S.comps.length?solve(S.comps,S.dio):null);return;}
    if(S.sel===hid){S.sel=null;say.textContent='取消了。';update();return;}
    const o={t:S.tool,a:S.sel,b:hid,R:S.R,col:S.col,pressed:false};if(o.t==='w')o.k=S.wn++;
    S.comps.push(o);S.sel=null;say.innerHTML=`放好了：${{w:'跳線',r:'電阻 '+S.R+' Ω',led:'LED（長腳 '+holeName(o.a)+'）',btn:'按鈕'}[o.t]}，${holeName(o.a)} ↔ ${holeName(hid)}。`;update();
  });
  if(start)load(start);else update();
}

/* =============================== M3+ =============================== */
L.push({id:'M03B',order:30.35,no:'M3+',part:PART,title:'MXP 麵包板：看懂板子、接出第一顆 LED，正向和負向接法',mins:60,
goals:[['學會','Digilent MXP 麵包板上每一排孔、每一個字對到 myRIO 哪一隻腳、LabVIEW 裡叫什麼；麵包板裡面哪些孔相通；LED 為什麼一定要串電阻、長腳短腳怎麼分；正向接法（DIO 送電）和負向接法（DIO 吸電）的差別。'],['做出','先接一顆不用程式的常亮 LED，再改成 DIO0 用 LabVIEW 控制，兩種接法各做一次，最後加一個按鈕。'],['為什麼','板子插上去以後，接錯一條線，LED 不亮還算好；接錯電源會讓 myRIO 保護、重開機，甚至燒腳位。先看懂板子，再動手。']],
check:'你能說出：A16 和哪些孔相通；+3.3V 排母和 DIO0 排母差在哪裡；你照片裡的 LED 為什麼不會亮；正向接法和負向接法，LabVIEW 寫 TRUE 時 LED 各是亮還是滅；為什麼負向接法要接 +3.3V 不接 +5V。',
body:[
C.h3('先看你的板子','x','這塊板子是做什麼的'),
`<p>這是 Digilent 的 <b>MXP Breadboard</b>：一塊小麵包板，一端是 34 孔的母座，直接插到 myRIO 的 MXP A 或 B 接頭上。MXP 的訊號全部被拉到板子上的排母，旁邊印著名字。你只要拿跳線，從排母接到麵包板上就好，不用自己去找 myRIO 的第幾腳。</p>`,
`<div class="mr-gal bb-gal">${shot('bb_dio_end.jpg','你的板子（DIO 那一端）：下方是插 myRIO 的 34 孔母座，上面一排是 DIO 排母，印著 GND、0～15、GND、+5V、+3.3V、GND。')}${shot('bb_ai_end.jpg','另一端：AI 0～3、AO 0～1、UART 的 RX／TX、+5V、+3.3V、GND 的排母。')}</div>`,
C.table(['位置','是什麼','注意'],[
 ['一端的 34 孔母座','插到 myRIO 的 MXP A 或 B','插在 A，程式裡就是 A/DIO0；插在 B 就是 B/DIO0。方向對準再插，不要硬壓。'],
 ['DIO 排母（印 0～15）','MXP 的 DIO0～DIO15','板子上的「3」就是 DIO3。上下兩排孔是同一個訊號，方便你插兩條線。'],
 ['AI／AO／UART 排母','類比輸入 0～3、類比輸出 0～1、序列埠','這一課先不用；M05 的電位器接 AI。'],
 ['+5V、+3.3V、GND','myRIO 送出來的電源和地','常電：程式關不掉。+5V 最多 100 mA、+3.3V 最多 150 mA。'],
 ['旁邊一條紅＋、藍－','電源軌','整條相通，用來分電：把 +3.3V 接上紅線那排，GND 接上藍線那排。'],
 ['A～E、F～J，第 1～30 列','麵包板主區','每一列的 A～E 五個孔相通，F～J 五個孔相通。中間的溝隔開兩邊。']]),
note('板子上的字 ↔ myRIO 腳 ↔ LabVIEW 名字','板子幫你把字印好了，但 LabVIEW 的 Express VI 用的是「接頭/腳名」。對照：「0」＝ DIO0 ＝ MXP 第 11 腳 ＝ <code>A/DIO0</code>；「8」＝ DIO8 ＝ 第 27 腳，第二功能 PWM0（M06 會用）；「14」「15」是 I2C（M08 會用），內建 2.1 kΩ 上拉。完整腳位圖在 M03。'),
ask('板子插在 MXP B，你把 LED 接在板子上的「3」。Digital Output Express VI 要選哪一個？',
 `<p><b>B/DIO3</b>。板子上的字只告訴你「第幾號 DIO」，是 A 還是 B 由你插在哪個接頭決定。選錯 A／B，程式照樣會跑，只是控制到另一個接頭的腳，你的 LED 永遠不動。這是最常見、也最難發現的錯。</p>`),

C.h3('第 1 步','','麵包板裡面怎麼相通'),
`<p>麵包板表面看起來每個孔都一樣，裡面其實是一條一條的金屬夾片。先把這件事弄清楚，後面所有接線問題都是它。</p>
<ul><li><b>主區</b>：同一列、溝的同一邊的 5 個孔相通。A16～E16 是一組，F16～J16 是另一組。</li>
<li><b>上下不通</b>：A16 和 A17 不通。</li>
<li><b>跨溝不通</b>：E16 和 F16 不通。溝是留給 IC、四腳按鈕跨過去用的。</li>
<li><b>電源軌</b>：沿著紅線（＋）那一排整條相通，藍線（－）那一排也是。</li></ul>
<p>下面的模擬器，工具選「看相通」，點任何一個孔，相通的孔會一起變黃。點幾個孔試試，再往下看。</p>`,
{fn:d=>bbLab(d)},
ask('一個元件的兩隻腳，插在 C16 和 D16，會怎樣？',
 `<p>C16、D16 在同一組，兩隻腳被夾片直接接在一起，等於元件被短路，完全沒有作用。<b>一個元件的兩隻腳一定要插在不同的列</b>（或跨過溝）。</p>`),

C.h3('第 2 步','','看你的照片：LED 為什麼不會亮'),
`<p>照片看得出來的：橘線從排母 <b>+3.3V</b>（照片角度看起來是這一格，請對著板子上的字確認）接到電源軌＋，灰線從 <b>GND</b> 接到電源軌－。LED 一隻腳插在－那條軌，另一隻腳插在主區第 16 列 C 附近。</p>
<p>不要急著看答案。用手指沿著電流可能走的路走一遍，一關一關問。</p>`,
ask('從 +3.3V 出發：橘線 → 電源軌＋。電源軌＋上面，除了橘線還插了什麼？',
 `<p>什麼都沒有。LED 那隻腳插在－那一條，不是＋。所以電流到了＋軌就沒有路走了。</p>`),
ask('再看 LED 另一隻腳：C16 這一組孔（A16～E16）還接了什麼？',
 `<p>也沒有。這一組只有 LED 一隻腳，電流進來也出不去。</p>
<p>結論：從＋出發，回不到－，<b>電路沒有閉合</b>，LED 不會亮，和程式、和 LED 好壞都沒關係。這叫「斷路」。</p>`),
ask('那把 C16 那隻腳拔起來，直接插到電源軌＋，一腳＋一腳－，是不是就好了？',
 `<p>會亮（如果長腳在＋），但這是錯的接法：LED 一旦導通，本身幾乎不擋電流，電流只被 +3.3V 的供電能力擋住。說明書：+3.3V 最多 150 mA，而一般 LED 只能長時間承受約 20 mA。LED 會很亮，然後很快變暗或燒掉。</p>
<p>一定要串一顆電阻。M03 算過：(3.3 − 2) ÷ 0.004 ≈ 325 Ω，取 330 Ω。</p>`),
ask('就算串了電阻、亮了，LabVIEW 能讓它閃嗎？',
 `<p>不能。+3.3V 是常電，myRIO 一開機就有，程式管不到。<b>要讓程式控制，電路裡一定要有一端接到 DIO</b>。這就是下面「正向接法」和「負向接法」要講的事。</p>`),
ask('你的 LED 外殼是透明的。它會是什麼顏色？有差嗎？',
 `<p>透明外殼看不出顏色，常見是白光或藍光。這兩種的壓降大約 3 V，比紅、綠（約 2 V）高很多（通用元件規格，以你買的 LED 為準）。</p>
<p>差很多：3.3 V 減掉 3 V，只剩 0.3 V 給電阻，串 330 Ω 只有約 1 mA，會很暗。用紅光 LED 學比較清楚；要用白光，電阻可以換小一點（例如 100 Ω），並且量一下電流。三用電表的二極體檔可以量壓降，順便知道哪隻是長腳（+）。</p>`),
`<p>在上面的模擬器按 <b>「你照片裡的接法」</b>，看右邊的說明；再按「LED 反過來」，看另一種插法。然後按「錯誤：沒串電阻」看電流有多大。</p>`,

C.h3('第 3 步','','先接一顆不用程式的 LED'),
`<p>接任何要程式控制的電路之前，先確定零件和麵包板是好的。這一步跟 LabVIEW 無關。</p>`,
chain([['+3.3V 排母','pw'],['電源軌＋'],['330 Ω'],['LED 長腳（＋）','led'],['LED 短腳（－）','led'],['電源軌－'],['GND 排母','gd']]),
`<ol class="mr-steps"><li>myRIO 先拔電源（插拔麵包板、改線之前都這樣做）。</li>
<li>跳線：板子的 <b>+3.3V</b> → 電源軌＋；<b>GND</b> → 電源軌－。</li>
<li>電阻一腳插電源軌＋，另一腳插 A10。</li>
<li>LED 長腳插 C10（和電阻同一組），短腳插 C13（另一組）。</li>
<li>跳線：A13 → 電源軌－。</li>
<li>接上電源，LED 應該亮。不亮就先檢查 LED 有沒有反、每隻腳是不是插在你以為的那一組。</li></ol>`,
`<p>模擬器裡按「常亮測試」對照。</p>`,

C.h3('第 4 步','','正向接法：DIO 送電（寫 TRUE 亮）'),
chain([['DIO0','dio'],['330 Ω'],['LED 長腳','led'],['LED 短腳','led'],['GND','gd']]),
`<p>把上一步的 +3.3V 換成 <b>DIO0</b>。現在 LED 的電從 DIO0 來：LabVIEW 寫 TRUE，DIO0 輸出 3.3 V，電流從腳位<b>流出來</b>，經過 LED 回到地，LED 亮；寫 FALSE，DIO0 是 0 V，沒有電壓差，不亮。</p>
<p>這叫<b>正向接法</b>（也有人叫 source、送電、拉電流）：腳位當電源。</p>`,
ask('程式還沒開始跑的時候，正向接法的 LED 會怎樣？',
 `<p>還沒被設成輸出的 DIO 是輸入，M03 的規格表：MXP DIO0～13 有 40 kΩ 上拉到 3.3 V。所以有一條很細的路：3.3 V → 40 kΩ → 330 Ω → LED → 地，大約 0.03 mA。多數時候看不出來，但在暗處、用高亮度 LED，可能看到微微亮。這不是程式錯。在模擬器載入「正向接法」，把 DIO0 改成「Digital Input（或程式還沒跑）」看看。</p>`),

C.h3('第 5 步','','負向接法：DIO 吸電（寫 FALSE 亮）'),
chain([['+3.3V','pw'],['330 Ω'],['LED 長腳','led'],['LED 短腳','led'],['DIO0','dio']]),
`<p>LED 反過來放在 +3.3V 和 DIO0 之間。現在 LED 的電從 +3.3V 來，DIO0 是「出口」：</p>
<ul><li><b>寫 FALSE</b>：DIO0 是 0 V，LED 兩端有 3.3 V 的差，電流從 +3.3V 經過 LED <b>流進</b> DIO0，LED <b>亮</b>。</li>
<li><b>寫 TRUE</b>：DIO0 是 3.3 V，LED 兩端都是 3.3 V，沒有電壓差，LED <b>不亮</b>。</li></ul>
<p>這叫<b>負向接法</b>（sink、吸電、灌電流）：腳位當開關，把電流導到地。邏輯跟正向相反，所以程式裡常在 Digital Output 前面放一個 <b>Not</b>，讓前面板的「LED 亮」開關照常理運作。</p>`,
C.table(['','正向接法（source）','負向接法（sink）'],[
 ['電路','DIO → 電阻 → LED → GND','+3.3V → 電阻 → LED → DIO'],
 ['電流方向','從 DIO 流出','流進 DIO'],
 ['寫 TRUE','亮','滅'],
 ['寫 FALSE','滅','亮'],
 ['程式還沒跑（DIO 是輸入、上拉）','可能極微亮','滅（兩端都是 3.3 V）'],
 ['程式裡','直接接','前面加 Not，邏輯才是「TRUE＝亮」']]),
note('跟 PLC 的 NPN／PNP 是同一件事','PLC 課的 sink／source（NPN、PNP）講的也是：電流從輸出點流出來，還是流進輸出點。換到 myRIO，只是電壓從 24 V 變成 3.3 V。'),
ask('負向接法，電源改接 +5V 會更亮吧？',
 `<p>亮的時候確實比較亮，但<b>關不掉</b>：寫 TRUE 時 DIO0 最高只有 3.3 V，LED 加電阻兩端還有 5 − 3.3 = 1.7 V。紅光 LED 大約 1.9 V 才明顯導通，1.7 V 已經很接近：暗處可能看到微亮。而且這時候是 5 V 透過 LED 頂著一隻 3.3 V 的輸出腳。</p>
<p>原則：<b>負向接法的電源，用跟 DIO 一樣的 3.3 V</b>。要推更大的電壓、電流，要經過電晶體或驅動板（M03 的馬達那一節）。模擬器裡按「陷阱：負向接到 +5V」看數字。</p>`),

C.h3('第 6 步','','LabVIEW 端'),
`<ol class="mr-steps"><li>用 M02 的方法從專案開 myRIO 底下的 Main.vi（標題列斜線後面是 myRIO，不是 My Computer）。</li>
<li>方塊圖右鍵 ▸ myRIO ▸ <b>Digital Output</b>（Express VI），放進 Main Loop。設定視窗選接頭和腳：板子插在 A、線接在「0」，就選 <b>A/DIO0</b>。</li>
<li>Express VI 的輸入接一個前面板的布林開關。負向接法就先經過一個 <b>Not</b>。</li>
<li>跑起來，切開關。正向接法：開關 TRUE 亮；負向接法（有 Not）：開關 TRUE 也亮。</li>
<li>按 Stop 結束。範本最後的 Reset myRIO.vi 會把輸出放掉，DIO 回到輸入、上拉。</li></ol>`,
tip('Express VI 設定視窗的名字','各版本 myRIO Toolkit 的設定視窗名稱、排版略有不同。課文只講要選什麼：接頭（A、B、C）和腳（DIO 幾號）。實際畫面以你電腦上的為準。'),

C.h3('第 7 步','','加一個按鈕（輸入）'),
chain([['DIO1','dio'],['按鈕'],['GND','gd']]),
`<p>M03 講過：MXP 的 DIO0～13 有 40 kΩ 上拉。所以按鈕只要接在 DIO1 和 GND 之間，不用自己加電阻。沒按讀到 TRUE，按下讀到 FALSE。</p>
<p>真的四腳按鈕要跨過中間的溝插，兩邊各兩隻腳。用三用電表量一下哪兩隻腳是「按下才通」，那兩隻分別接 DIO1 和 GND。模擬器把它簡化成兩隻腳：載入「按鈕輸入：DIO1」，點灰色方塊按下、放開。</p>`,
ask('把按鈕讀到的值直接接到正向接法 LED 的 Digital Out，按下去 LED 會亮還是滅？',
 `<p>按下讀到 FALSE，寫給正向接法的 LED 就是滅；放開反而亮。要「按下亮」：中間加一個 Not，或改用負向接法的 LED（兩個反相剛好抵消）。這種「訊號到底是高有效還是低有效」，是接任何感測器、按鈕前都要先想的事。</p>`),

C.h3('上機前檢查','','插電之前看一遍'),
`<ul class="mr-check">
<li>myRIO 斷電後才插拔麵包板、改線。</li>
<li>板子插在 A 還是 B？程式選的接頭要一樣。</li>
<li>+3.3V、+5V 從來不直接接到 GND，也不直接接到 DIO。</li>
<li>每顆 LED 都有串電阻；長腳朝電壓高的那邊。</li>
<li>每個元件的兩隻腳不在同一組孔裡。</li>
<li>第一次用電源軌，用三用電表量一下第 1 列到第 30 列是不是整條通。</li></ul>`,
{quiz:[
 {q:'A16 和哪些孔相通？',o:['B16、C16、D16、E16','A15、A17','F16～J16','整條電源軌'],a:0,ex:'同一列、溝的同一邊的 5 個孔是一組。'},
 {q:'照片裡 LED 一腳在電源軌－、一腳在 C16，C16 那一列沒接別的。LED 為什麼不亮？',o:['電路沒有閉合：電流進得來出不去','程式沒有跑','+3.3V 不夠','LED 壞了'],a:0,ex:'先確認電路是一個完整的圈，再懷疑零件和程式。'},
 {q:'正向接法（DIO → 電阻 → LED → GND），寫 TRUE 時？',o:['亮，電流從 DIO 流出','滅','亮，電流流進 DIO','DIO 會壞'],a:0,ex:'DIO 當電源。'},
 {q:'負向接法（+3.3V → 電阻 → LED → DIO），寫 TRUE 時？',o:['滅：LED 兩端都是 3.3 V','亮','微亮','短路'],a:0,ex:'寫 FALSE 才亮；程式裡常加 Not。'},
 {q:'負向接法為什麼不要接 +5V？',o:['DIO 最高 3.3 V，寫 TRUE 時 LED 兩端還有 1.7 V，關不乾淨','+5V 不夠亮','+5V 是輸入','沒有差別'],a:0,ex:'負向接法的電源用跟 DIO 一樣的 3.3 V。'},
 {q:'板子插在 MXP B，線接在板子上的「3」，Express VI 選？',o:['B/DIO3','A/DIO3','DIO3（不用選接頭）','第 3 腳'],a:0,ex:'板子上的字是 DIO 號碼，A／B 由插在哪個接頭決定。'},
 {q:'按鈕接在 DIO1 和 GND 之間，按下去讀到？',o:['FALSE（內建 40 kΩ 上拉）','TRUE','不一定','錯誤'],a:0,ex:'和 M03、M04 一樣。'}
]}
]});
window.MR_BB={solve,net,PRESETS};
})();
