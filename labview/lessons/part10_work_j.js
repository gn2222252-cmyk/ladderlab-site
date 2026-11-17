/* 實務案例 W13：簡易 AOI。拍輸送帶上的墊片，量外徑、找缺角，NG 時用交握訊號告訴 PLC 剔除。
   職缺對照（docs/job_research.md 第 E 組）：AOI 影像檢測、規劃相機／鏡頭／光源、視覺結果交給 PLC（觸發與資料交握）。
   LabVIEW 的影像處理需要 Vision Development Module（另購）與相機驅動（Vision Acquisition Software）；這一課的影像處理在網頁上用 JavaScript 模擬，
   重點放在「光源、門檻、像素換算、交握」這些不管用哪一套軟體都一樣的事。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

const W=320,H=240,PXMM=8,CAL=8.1; // 影像 320 px 對應 40 mm；CAL 是用同一種量法量校正片得到的 px/mm
const PARTS=['良品（外徑 20.0 mm）','缺角','外徑 20.6 mm（偏大）','沒有工件'];

/* 產生影像：亮背景、暗墊片（背光），light 0.3～1 */
function render(kind,light,seed){
  const g=new Float32Array(W*H);let h=seed||7;const rnd=()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return ((h>>>0)%1000)/1000;};
  const cx=160+((seed||0)%7)-3,cy=120+((seed||0)%5)-2,Ro=(kind===2?20.6:20)*PXMM/2,Ri=8*PXMM/2;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const dx=x-cx,dy=y-cy,r=Math.hypot(dx,dy);let v=215;
    if(kind!==3&&r<=Ro&&r>=Ri){v=40;if(kind===1){const a=Math.atan2(dy,dx);if(a>0.35&&a<0.85&&r>Ro-26)v=215;}}
    v=v*light*(0.92+0.16*(x/W))+(rnd()-0.5)*16;
    g[y*W+x]=Math.max(0,Math.min(255,v));
  }
  return g;
}
function otsu(g){const hist=new Array(256).fill(0);for(const v of g)hist[v|0]++;const n=g.length;let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];let sB=0,wB=0,best=0,th=128,th2=128;
  for(let t=0;t<256;t++){wB+=hist[t];if(!wB)continue;const wF=n-wB;if(!wF)break;sB+=t*hist[t];const mB=sB/wB,mF=(sum-sB)/wF,b=wB*wF*(mB-mF)*(mB-mF);if(b>best*1.0001){best=b;th=t;th2=t;}else if(b>=best*0.9999)th2=t;}return Math.round((th+th2)/2);}
function inspect(g,thr){
  let n=0,x0=W,x1=-1,y0=H,y1=-1,sd=0,sb=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const v=g[y*W+x];if(v<=thr){n++;sd+=v;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}else sb+=v;}
  const mD=n?sd/n:0,mB=n<W*H?sb/(W*H-n):0,gap=mB-mD;
  if(!n) return {none:true,n,gap};
  if(n===W*H||gap<50) return {anom:true,n,gap,mD,mB};
  const wpx=x1-x0+1,hpx=y1-y0+1,dmm=Math.max(wpx,hpx)/CAL;
  const ideal=Math.PI*((Math.max(wpx,hpx)/2)**2-(4*PXMM)**2),ratio=n/ideal;
  return {n,x0,x1,y0,y1,wpx,hpx,dmm,ratio};
}
function judge(r){
  if(r.none) return {ok:false,why:['沒有工件（或門檻設錯）']};
  if(r.anom) return {ok:false,why:['視覺異常：暗的和亮的兩群差不到 50 灰階（差 '+Math.round(r.gap)+'），影像裡可能沒有工件、或光源有問題。不判尺寸，直接回 NG 並通知（規格 V4）']};
  const why=[];
  if(r.dmm<19.8||r.dmm>20.2) why.push('外徑 '+r.dmm.toFixed(2)+' mm 超出 19.8～20.2');
  if(r.ratio<0.95) why.push('面積只有理想的 '+(r.ratio*100).toFixed(1)+' %（缺角？）');
  if(r.ratio>1.05) why.push('面積是理想的 '+(r.ratio*100).toFixed(0)+' %（背景也被當成工件？）');
  return {ok:!why.length,why};
}

/* ---- 圖：AOI 檢測台 ---- */
function aoiSim(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<p style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 6px">工件 <select data-k="kind">${PARTS.map((p,i)=>`<option value="${i}">${p}</option>`).join('')}</select>
   光源亮度 <input type="range" data-k="light" min="30" max="100" value="100" style="width:110px"> <b data-o="lv">100 %</b></p>
  <p style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 6px">門檻 <input type="range" data-k="thr" min="20" max="240" value="128" style="width:140px"> <b data-o="tv">128</b>
   <label><input type="checkbox" data-k="auto"> 自動門檻（看直方圖，找兩群灰階中間）</label>
   <label><input type="checkbox" data-k="bin"> 顯示二值化結果</label></p>
  <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start">
   <canvas data-o="cv" width="${W}" height="${H}" style="border:1px solid #889;max-width:100%"></canvas>
   <div style="flex:1 1 220px;font-size:13px" data-o="res"></div></div>`;
  const o=k=>el.querySelector('[data-o='+k+']'),q=k=>el.querySelector('[data-k='+k+']');
  let seed=11;
  function run(){
    const kind=+q('kind').value,light=+q('light').value/100;o('lv').textContent=q('light').value+' %';
    const g=render(kind,light,seed);let thr=+q('thr').value;if(q('auto').checked){thr=otsu(g);q('thr').value=thr;}o('tv').textContent=thr;
    const r=inspect(g,thr),j=judge(r);
    const c=o('cv').getContext('2d'),im=c.createImageData(W,H),bin=q('bin').checked;
    for(let i=0;i<W*H;i++){const v=bin?(g[i]<thr?255:0):g[i];const k=i*4;if(bin&&g[i]<thr){im.data[k]=255;im.data[k+1]=90;im.data[k+2]=60;}else{im.data[k]=im.data[k+1]=im.data[k+2]=bin?20:v;}im.data[k+3]=255;}
    c.putImageData(im,0,0);
    if(!r.none&&!r.anom){c.strokeStyle=j.ok?'#1ec24a':'#ff3b30';c.lineWidth=2;c.strokeRect(r.x0,r.y0,r.wpx,r.hpx);}
    o('res').innerHTML=`<p style="font-size:22px;font-weight:700;color:${j.ok?'#1e7b34':'#c0392b'};margin:0">${j.ok?'OK':'NG'}</p>
     ${r.none?'<p>找不到暗的像素</p>':r.anom?'<p>兩群灰階：'+Math.round(r.mD)+' 和 '+Math.round(r.mB)+'</p>':`<p>暗像素 ${r.n} 個<br>外框 ${r.wpx} × ${r.hpx} px<br>外徑 ${r.wpx} px ÷ ${CAL} px/mm ＝ <b>${r.dmm.toFixed(2)} mm</b><br>面積 ÷ 理想圓環 ＝ <b>${(r.ratio*100).toFixed(1)} %</b></p>`}
     <p style="color:#c0392b">${j.why.join('<br>')}</p>`;
  }
  ['kind','light','thr','auto','bin'].forEach(k=>q(k).addEventListener('input',()=>{if(k==='thr')q('auto').checked=false;if(k==='kind')seed=(seed*7+3)%97;run();}));
  run();
}

/* ---- 圖：和 PLC 的交握時序 ---- */
function handFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  const SIG=['Trigger（PLC → 視覺）','Busy（視覺 → PLC）','Done（視覺 → PLC）','Result OK（視覺 → PLC）'];
  const STEPS=[
   [[0,0,0,0],'⓪ 等待：四條線都是 0。PLC 要先確認 Busy ＝ 0、Done ＝ 0（上一次交握已經結束），才可以送下一個 Trigger。'],
   [[1,0,0,0],'① 工件到位，PLC 的感測器觸發，PLC 把 Trigger 設 1。'],
   [[1,1,0,0],'② 視覺程式看到 Trigger，先把 Busy 設 1（PLC 知道「收到了，在做」），然後拍照。'],
   [[1,1,0,0],'③ 處理影像（這一步約 80 ms）。PLC 這時候不能讓輸送帶把工件帶走，或已經把位置記下來。'],
   [[1,1,0,1],'④ 結果先放好（Result OK ＝ 1），然後<b>等一下</b>（超過 PLC 的輸入濾波＋一次掃描，例如 20 ms）。'],
   [[1,0,1,1],'⑤ 再把 Done 設 1、Busy 設 0。PLC 一看到 Done 就會讀 Result：這時 Result 已經穩穩在那裡了。'],
   [[0,0,1,1],'⑥ PLC 讀到 Done，拿走 Result，把 Trigger 設 0 表示「我拿到了」。'],
   [[0,0,0,0],'⑦ 視覺程式看到 Trigger 變 0，把 Done 和 Result 清成 0，回到等待。一次交握完成。']];
  el.innerHTML=`<p style="margin:0 0 6px"><b>一次檢測的交握（四條數位線）</b> <button type="button" class="btn" data-k="nx">下一步</button> <button type="button" class="btn" data-k="rs">重來</button></p>
  <svg data-o="sv" viewBox="0 0 620 170" style="width:100%;max-width:620px;background:#fff;border:1px solid #ccd"></svg>
  <p data-o="tx" style="font-size:14px;min-height:40px"></p>`;
  const o=k=>el.querySelector('[data-o='+k+']');let i=0;
  function draw(){
    let s='';SIG.forEach((n,r)=>{const y=20+r*38;s+=`<text x="4" y="${y+14}" font-size="11" fill="#334">${n}</text>`;let px=180,prev=STEPS[0][0][r];let d=`M${px},${y+(prev?4:24)}`;
      for(let k=1;k<=i;k++){const v=STEPS[k][0][r];const x=180+k*55;if(v!==prev){d+=` L${x},${y+(prev?4:24)} L${x},${y+(v?4:24)}`;prev=v;}else d+=` L${x},${y+(v?4:24)}`;}
      d+=` L${180+i*55+30},${y+(prev?4:24)}`;s+=`<path d="${d}" fill="none" stroke="${['#2f6fd0','#d68910','#1e7b34','#8e44ad'][r]}" stroke-width="2.5"/>`;});
    s+=`<line x1="${180+i*55+30}" y1="10" x2="${180+i*55+30}" y2="165" stroke="#c0392b" stroke-dasharray="3 3"/>`;
    o('sv').innerHTML=s;o('tx').innerHTML=STEPS[i][1];
  }
  el.querySelector('[data-k=nx]').onclick=()=>{if(i<STEPS.length-1)i++;draw();};
  el.querySelector('[data-k=rs]').onclick=()=>{i=0;draw();};
  draw();
}

/* ---- 一步一步寫：像素換 mm、判定 ---- */
const jv={name:'Judge_Washer.vi',view:'split',ratio:2,
 fp:{w:320,h:200,items:[
  {id:'wpx',k:'num',ctl:true,label:'外框寬 px（影像處理的結果）',x:12,y:8,w:60,v:161,inc:1},
  {id:'cal',k:'num',ctl:true,label:'px／mm（校正得到）',x:180,y:8,w:60,v:8.1,inc:0.05,dig:2},
  {id:'ratio',k:'num',ctl:true,label:'面積比',x:12,y:64,w:60,v:0.99,inc:0.01,dig:2},
  {id:'mm',k:'num',label:'外徑 mm',x:180,y:64,w:60,dig:2},
  {id:'ok',k:'led',label:'OK',color:'green',x:12,y:124}]},
 bd:{w:620,h:220,nodes:[
  {id:'wpx',k:'ctl',t:'dbl',label:'外框寬 px',x:20,y:30},
  {id:'cal',k:'ctl',t:'dbl',label:'px/mm',x:20,y:80},
  {id:'div',k:'fn',fn:'Divide',x:110,y:40},
  {id:'mm',k:'ind',t:'dbl',label:'外徑 mm',x:200,y:10},
  {id:'khi',k:'const',t:'dbl',v:20.2,x:150,y:90},
  {id:'klo',k:'const',t:'dbl',v:19.8,x:150,y:130},
  {id:'irc',k:'fn',fn:'In Range and Coerce',x:230,y:50},
  {id:'ratio',k:'ctl',t:'dbl',label:'面積比',x:20,y:170},
  {id:'k95',k:'const',t:'dbl',v:0.95,x:110,y:186},
  {id:'ge',k:'fn',fn:'Greater Or Equal?',x:200,y:166},
  {id:'and',k:'fn',fn:'And',x:330,y:80},
  {id:'ok',k:'ind',t:'bool',label:'OK',x:400,y:86}],
  wires:[
  {id:'w1',from:'wpx',to:'div.x',t:'dbl',mx:90},
  {id:'w2',from:'cal',to:'div.y',t:'dbl',mx:90},
  {id:'w3',from:'div.out',to:'mm',t:'dbl',mx:180},
  {id:'w4',from:'div.out',to:'irc.x',t:'dbl',mx:180},
  {id:'w5',from:'khi',to:'irc.upper limit',t:'dbl',mx:214},
  {id:'w6',from:'klo',to:'irc.lower limit',t:'dbl',mx:220},
  {id:'w7',from:'ratio',to:'ge.x',t:'dbl',mx:90},
  {id:'w8',from:'k95',to:'ge.y',t:'dbl',mx:180},
  {id:'w9',from:'irc.In Range?',to:'and.x',t:'bool',mx:300},
  {id:'w10',from:'ge.out',to:'and.y',t:'bool',mx:310},
  {id:'w11',from:'and.out',to:'ok',t:'bool'}]},
 sim:{live:true,init:()=>({}),
  step(inp){const mm=(+inp.wpx)/(+inp.cal||1),inr=mm>=19.8&&mm<=20.2,ge=+inp.ratio>=0.95,ok=inr&&ge;
   return {out:{mm,ok},vals:{'div.out':mm.toFixed(3),khi:20.2,klo:19.8,'irc.In Range?':inr,k95:0.95,'ge.out':ge,'and.out':ok},
    msg:inp.wpx+' px ÷ '+(+inp.cal).toFixed(2)+' ＝ '+mm.toFixed(2)+' mm'+(inr?'':'（超出 19.8～20.2）')+(ge?'':'；面積比不足')+' → '+(ok?'OK':'NG')};},
  doneMsg:''}
};

L.push({id:'W13',order:30.993,no:'W13',part:PART,title:'簡易 AOI：拍墊片量外徑、找缺角，NG 時用交握訊號叫 PLC 剔除',mins:80,files:['練習\\實務\\AOI\\Judge_Washer.vi'],
goals:[['學會','AOI 的成敗大半在光源（背光、亮度穩定）；門檻怎麼選、自動門檻；像素換 mm 要校正；用外徑和面積比判斷；先收集 OK 和 NG 的樣本；和 PLC 的交握（Trigger、Busy、Done、Result）和順序；誤判（把好的判 NG）和漏判（把壞的判 OK）哪個比較嚴重。'],['做出','在模擬檢測台上找出光源變暗時固定門檻為什麼會誤判；Judge_Washer.vi（像素換 mm、判定）；交握時序。'],['為什麼是這個題目','職缺常寫「AOI 影像檢測系統開發與維護」「規劃相機、鏡頭、光源」「視覺結果交給 PLC 或手臂」。用的軟體各家不同（LabVIEW Vision、Halcon、OpenCV），但光源、校正、交握的想法都一樣。']],
check:'不看課文，能說出光源變暗時固定門檻會怎樣、怎麼從像素算出 mm、交握的四條線各是誰送給誰，以及 Result 為什麼要在 Done 之前放好。',
body:[
C.h3('① 聽懂需求','','品保的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「沖壓出來的墊片偶爾缺角、尺寸跑掉，現在靠人看，看久了會漏。輸送帶上加一台相機，外徑 20 ± 0.2 mm，缺角的要剔除。剔除機構是 PLC 控制的氣缸。」</p></div>`,
ask('至少問五件事。',
 `<ol><li><b>一分鐘幾片？</b>決定相機速度和處理時間。答案：60 片／分，每片有 1 秒，但工件只在相機下停 0.2 秒。</li>
 <li><b>多小的缺角要抓到？</b>「缺角」要變成數字：例如缺掉超過外圈面積的 3 %。拿真的 NG 品來看。</li>
 <li><b>±0.2 mm 要量得準，需要什麼解析度？</b>經驗上每個像素要比公差小很多（例如公差的 1/5～1/10）。視野 40 mm、320 像素是 0.125 mm／像素，<b>其實不夠</b>（下面會算）。實際要用解析度更高的相機或更小的視野。</li>
 <li><b>漏判和誤判哪個比較嚴重？</b>漏判（壞的流出去）通常比誤判（好的被丟掉）嚴重，但誤判太多產線會抱怨。門檻要和品保一起定。</li>
 <li><b>PLC 怎麼告訴你工件到了、你怎麼告訴 PLC 結果？</b>答案：用數位 I/O 交握（下面）。</li></ol>`),
C.h3('② 寫成規格','',''),
C.table(['編號','規格'],[
 ['V1','外徑 19.8～20.2 mm 為 OK'],
 ['V2','墊片的暗區面積 ÷ 理想圓環面積 &lt; 95 % 判為缺角（NG）'],
 ['V3','PLC 送 Trigger 後 150 ms 內回 Done 和結果（時間預算：輸入濾波約 10 ms × 2 方向、取像、處理約 80 ms、Result 和 Done 之間 20 ms、餘裕）'],
 ['V4','沒有工件、影像異常（太暗、太亮）時回 NG 並亮「視覺異常」，不能回 OK'],
 ['V5','每一張 NG 的影像存檔（檔名含時間和原因），OK 的每 100 張存 1 張'],
 ['V6','每天開工先拍校正片（已知尺寸），換算係數偏差超過 1 % 要通知']
]),
C.h3('③ 盤點','','相機、鏡頭、光源'),
C.table(['項目','選擇','為什麼'],[
 ['光源','背光（光源在工件下面）','墊片變成亮背景上的黑影，邊緣最清楚，表面反光和顏色都不影響。一般輸送帶不透光：要讓工件經過兩段輸送帶之間的空隙、用透明皮帶，或推到玻璃檢測台上'],
 ['相機','工業相機（GigE 或 USB3），外部觸發','可以由 PLC 的訊號觸發拍照，時間固定'],
 ['鏡頭','遠心鏡頭或焦距長一點的鏡頭','一般鏡頭在工件高低不同時大小會變，量尺寸會不準。遠心鏡頭的視野約等於前鏡的口徑，看 40 mm 要大型遠心鏡頭（貴、大）；預算有限時用長焦鏡頭拉遠工作距離，並固定工件高度'],
 ['軟體','LabVIEW ＋ Vision Development Module；相機驅動 Vision Acquisition Software（IMAQdx，支援 GigE Vision、USB3 Vision）','Vision Assistant 隨 VDM 安裝，可以先試門檻和量測；要用 Tools ▸ Create LabVIEW VI 產生程式，需要正式授權（試用版不行）。也可以用其他視覺軟體，想法相同'],
 ['I/O','和 PLC 之間 4 條數位線：Trigger、Busy、Done、Result','<b>經過繼電器或光耦合器隔離</b>，或用 24 V 的工業數位 I/O 模組。一般 DAQ 的數位線是 5 V TTL，FX3S 的 I/O 是 24 V']
]),
warn('DAQ 的數位線不能直接接 PLC','DAQ 的 5 V TTL 推不動 PLC 的 24 V 輸入（PLC 讀不到）；PLC 的 24 V 輸出接進 DAQ，會超過額定、燒壞 DAQ。接之前看兩邊規格書的輸入電壓和輸出型式（NPN／PNP、sink／source），中間用繼電器、光耦合器或 24 V 的數位 I/O 模組。'),
tip('AOI 的成敗大半在打光','新手常想用很厲害的演算法解決問題，老手會先把光打好：光好，簡單的門檻就夠；光不好，再厲害的演算法也不穩。下面的模擬可以體會。'),
C.h3('④ 先驗證','','先用模擬的檢測台試'),
`<p>先選「良品」，打開「顯示二值化結果」看門檻 128 把哪些像素當成工件（紅色）。再把光源亮度慢慢調暗到 50 %：固定門檻會發生什麼事？然後勾「自動門檻」。最後換成缺角、偏大、沒有工件。</p>`,
{fn:aoiSim},
ask('光源調到 50 % 時，固定門檻 128 為什麼把良品判成 NG？',
 `<p>背景原本大約 215（亮），光源變暗一半剩 107，<b>比門檻 128 還暗</b>，整個背景都被當成工件：外框變成整張影像，量到 40 mm。這不是程式算錯，是假設錯了：「背景一定比 128 亮」。</p>
 <p>三種解法，通常一起用：① 光源要穩（用穩定的光源控制器、定期檢查亮度）；② 自動門檻（從直方圖找出兩群灰階的中間，亮度變了門檻跟著變）；③ 檢查影像本身：背景平均亮度超出範圍、或兩群灰階差太少，就判「視覺異常」（規格 V4），不要硬判。</p>
 <p>自動門檻有一個陷阱：<b>它在空影像上也一定會找到一個門檻</b>。選「沒有工件」再勾自動門檻：只有背景一群灰階，它照樣切一刀，把一半的背景當成工件。所以模擬裡先檢查「兩群灰階差不到 50 就是異常」，才判尺寸。</p>
 <p>這裡的自動門檻是 Otsu 法：找一個門檻，讓兩群灰階分得最開。兩群分得很開時，中間一整段空白都一樣好，標準寫法會取第一個（貼著暗群的邊緣），這裡取那段空白的中間，比較穩。LabVIEW Vision 的自動門檻也有好幾種方法可以選，要拿自己的影像試。</p>`),
ask('320 像素看 40 mm，一個像素是幾 mm？要量 ±0.2 mm 夠嗎？',
 `<p>40 ÷ 320 ＝ 0.125 mm。公差帶 0.4 mm 只有 3.2 個像素，邊緣差一個像素就是 0.125 mm，量測的散佈會吃掉大半公差（W6 說過：散佈要遠小於公差）。實務上要讓一個像素小於公差的 1/5～1/10：例如 5 百萬畫素的相機，或把視野縮小到只看墊片。（網頁的模擬為了跑得動用小影像，所以判斷結果會比真實的抖。）</p>`),
C.h3('⑤ 規劃','','和 PLC 的交握'),
`<p>視覺和 PLC 是兩台獨立的機器，各跑各的。要確定「這一次的結果是哪一片的」，靠的是交握：</p>`,
{fn:handFig},
`<p>想多看幾種交握的時序，可以玩<a href="lab-handshake.html">動畫實驗室：PLC 與上位機交握</a>。</p>`,
ask('為什麼 Result 要在 Done 之前就放好？',
 `<p>PLC 一看到 Done ＝ 1，<b>同一個掃描週期</b>就會讀 Result。如果你先設 Done、再設 Result，PLC 可能剛好在兩者中間讀到上一片的結果或 0。就算順序對，兩條線只差幾微秒也不夠：FX3S 的輸入預設有 10 ms 的濾波（D8020），兩個訊號經過濾波後仍可能落在同一次掃描的前後。所以中間<b>等超過「輸入濾波＋一次掃描」</b>（例如 20 ms）。所以順序一定是：結果放好 → 再告訴對方「好了」。反過來，PLC 收到之後把 Trigger 拉回 0，視覺程式才清除 Done 和 Result，確保對方已經拿走。</p>
 <p>這個「先放資料、再舉旗子；對方回應、才放下旗子」的模式，在 PLC 和任何外部設備之間都一樣（W11 的配方下載也是：先寫暫存區、再舉「下載完成」旗標）。</p>`),
C.plan({start:'AOI_Main.vi：初始化相機（外部觸發模式）和 DAQ 的 4 條數位線，進入狀態機。',
 in:'Trigger（DI）、相機影像、校正係數（px/mm，每天用校正片更新）。',
 calc:'等 Trigger → Busy ＝ 1 → 取像 → 檢查影像亮度 → 門檻（自動）→ 找出工件（粒子分析）→ 外徑 px → mm、面積比 → 判定 → Result → Done ＝ 1、Busy ＝ 0 → 等 Trigger 回 0 → 清除。',
 out:'Busy、Done、Result（DO）；畫面：最新影像、OK／NG 統計；NG 影像存檔。',
 loop:'狀態機每圈很短（幾 ms），等 Trigger 時：DAQ 支援變化偵測（Change Detection）就用它，否則 1～2 ms 輪詢（反應時間要算進 V3 的 150 ms）；一次檢測 ≤ 150 ms。',
 end:'程式結束前把 Busy、Done、Result 全部清成 0，並讓 PLC 知道視覺離線（PLC 側要能處理「視覺沒回應」：逾時就剔除）。'}),
C.h3('⑥ 一步一步寫','','Judge_Washer.vi'),
`<p>影像處理的部分用 Vision Assistant 做出來之後，可以產生 LabVIEW 程式碼（要正式授權的 VDM）；它的輸出是外框寬度（px）和面積。判定這一段自己寫，而且要能單獨測試：</p>`,
{steps:{title:'像素 → mm → 判定',lv:jv,steps:[
 {t:'像素換 mm',view:'split',add:['wpx','cal','div','w1','w2','mm','w3'],h:`<p>px ÷（px/mm）＝ mm。px/mm 不要寫死：每天用校正片量一次（例如 10.00 mm 的量塊量到 81 px → 8.1 px/mm），存在設定檔。<b>校正片要用和工件同一種量法量</b>（同樣的門檻、同樣「外框寬度」的定義）：數像素的外框會比真正的寬度多大約 1 個像素，兩邊都多 1 個，誤差才會抵消。要量得更準，用 Vision 的邊緣工具做次像素量測。</p>`},
 {t:'外徑在範圍內',view:'split',add:['khi','klo','irc','w4','w5','w6'],h:`<p>In Range and Coerce：19.8～20.2 mm。記得右鍵勾 Include upper limit（預設不含上限，20.2 mm 會判 NG）。</p>`},
 {t:'面積比 ≥ 95 %',view:'split',add:['ratio','k95','ge','w7','w8','and','w9','w10','ok','w11'],h:`<p>外徑對了不代表沒缺角：缺一小角，外框寬度可能不變。所以再看面積比。兩個都過才 OK。</p><p>改前面板：外框 165 px → 20.37 mm NG；面積比 0.9 → NG；校正係數改成 8.3（相機被撞歪了）→ 161 px 只有 19.40 mm，好的也變 NG：這就是 V6 每天校正的原因。</p>`}
]}},
tip('參考答案','<a href="vi/LV2018/W13_Judge_Washer.vi" download>W13_Judge_Washer.vi（LabVIEW 2018）</a>　<a href="vi/W13_Judge_Washer.vi" download style="font-size:13px">2026 版</a>。In Range and Coerce 已經勾了 Include upper limit。實測：沒勾時，161.6 px ÷ 8 ＝ 20.2 mm 會被判 NG；勾了才是 OK。'),
C.h3('⑦ 測試、交機','',''),
C.table(['測試','操作','預期','規格'],[
 ['T1','OK 品 50 片、各種 NG 品各 10 片，每片過 3 次','OK 不被判 NG、NG 全部抓到；同一片 3 次結果一樣','V1、V2'],
 ['T2','光源調暗 30 %','自動門檻仍正確，或判「視覺異常」，不會亂判','V4'],
 ['T3','輸送帶上沒有工件時送 Trigger','回 NG 並亮視覺異常','V4'],
 ['T4','用 PLC 量 Trigger 到 Done 的時間','≤ 150 ms，連續 1000 次','V3'],
 ['T5','視覺程式關掉時讓工件通過','PLC 逾時，工件被剔除（不是放行）','V4'],
 ['T6','看 NG 影像資料夾','每張 NG 都有，檔名可以看出時間和原因','V5']
]),
`<p>T1 的「各種 NG 品」要<b>從產線收集真的不良品</b>，不要只用自己做的。收集 OK 和 NG 樣本、定門檻、驗證，這一步常常比寫程式還花時間。</p>`,
note('漏判和誤判','把壞的判成 OK（漏判）會流到客戶手上；把好的判成 NG（誤判）會浪費、產線會抱怨，最後有人把 AOI 關掉。兩種都要記錄、定期檢討。T5 的設計原則是：不確定時判 NG（fail-safe），寧可多丟一片，也不要放壞的出去。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'量墊片外徑，最適合的打光？',o:['背光：工件變成亮背景上的黑影','正面打光','不要打光','彩色光'],a:0,ex:'邊緣最清楚。'},
 {q:'光源變暗後背景比門檻還暗，結果是？',o:['背景被當成工件，量測完全錯','沒影響','工件消失','程式當掉'],a:0,ex:'用穩定光源、自動門檻、檢查影像亮度。'},
 {q:'校正片 10 mm 量到 80 px，外框 161 px 是幾 mm？',o:['20.125','16.1','1.61','12.9'],a:0,ex:'161 ÷ 8。'},
 {q:'交握時，視覺程式要先？',o:['把 Result 放好，再設 Done','先設 Done，再放 Result','同時設','不用 Done'],a:0,ex:'PLC 看到 Done 就會讀 Result。'},
 {q:'Done 什麼時候清回 0？',o:['看到 PLC 把 Trigger 拉回 0 之後','送出後馬上','下一片來的時候','永遠不清'],a:0,ex:'確定對方已經拿到。'},
 {q:'視覺程式沒回應時，PLC 應該？',o:['逾時後剔除工件','放行工件','停住等','重開視覺電腦'],a:0,ex:'不確定時判 NG。'},
 {q:'外徑對了，還要看面積比的原因？',o:['缺一小角時外框寬度可能不變','面積比較好算','規定要兩個','讓程式慢一點'],a:0,ex:'一個量測抓不到所有缺陷。'}
]}
]});
})();
