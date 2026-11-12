/* 第九部分：myRIO（M13～M15）：加速度計與傾斜角、完整 PID、出問題時怎麼救。
   myRIO 事實：NI myRIO-1900 User Guide and Specifications（加速度計 3 軸、±8 g、12 位元、一格 3.906 mg、800 S/s、雜訊 3.9 mg rms；
   Status LED 閃 2／3／4 下的意思；Reset 按 5 秒進 safe mode；safe mode 時 MXP A 的 UART 115200-8-N-1；POWER 燈表示電源足夠）。
   NI 教學／論壇：USB 位址 172.22.11.2、找不到時改用網路選項手動填、Windows 那張 USB 網路卡的 DHCP 沒設好會找不到、Disable RT Startup App。
   傾斜角公式、移動平均、PID（積分飽和、對量測值微分）是通用的數學與控制知識。
   NI MAX 的 Add/Remove Software、Format Disk、Distributed System Manager 是 LabVIEW Real-Time 的通用工具，選單位置各版本略有差異。 */
(function(){
const L=window.LESSONS;
const PART='myRIO 嵌入式控制';
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const steps=list=>`<ol class="mr-steps">${list.map(s=>`<li>${s}</li>`).join('')}</ol>`;
const ui=s=>`<b class="mr-ui">${s}</b>`;
function flow(items){
  const one=x=>{
    if(typeof x==='string')return `<span class="fb">${x}</span>`;
    if(x.loop)return `<span class="fl"><em>${x.label||'While Loop'}</em><span class="fin">${x.loop.map(one).join('<i class="fa">→</i>')}</span>${x.sr?`<small class="fsr">Shift Register：${x.sr}</small>`:''}</span>`;
    if(x.kase)return `<span class="fc"><em>Case：${x.label}</em><span class="fin">${x.kase.map(one).join('<i class="fa">或</i>')}</span></span>`;
    return '';
  };
  return `<div class="bdflow fig">${items.map(one).join('<i class="fa">→</i>')}</div>`;
}
let UID=0;
const radios=(id,k,t,list,cur)=>`<fieldset><legend>${t}</legend>${list.map(o=>`<label><input type="radio" name="${id}-${k}" value="${o[0]}"${cur===o[0]?' checked':''}> ${o[1]}</label>`).join('')}</fieldset>`;
const pick=(d,id,k)=>{const c=d.querySelector(`input[name="${id}-${k}"]:checked`);return c?c.value:null;};
function plotSvg(series,opt){
  const W=560,H=opt.h||140,P=30,all=[].concat(...series.map(s=>s.y));
  const mn=opt.min!=null?opt.min:Math.min(...all),mx=opt.max!=null?opt.max:Math.max(...all),sp=(mx-mn)||1,n=Math.max(...series.map(s=>s.y.length));
  const X=i=>P+i/(n-1)*(W-P-6),Y=v=>H-14-(Math.max(mn,Math.min(mx,v))-mn)/sp*(H-28);
  const ref=(opt.ref||[]).map(r=>`<line x1="${P}" x2="${W-6}" y1="${Y(r[0])}" y2="${Y(r[0])}" stroke="${r[1]}" stroke-dasharray="4 3"/><text x="${W-8}" y="${Y(r[0])-3}" font-size="10" text-anchor="end" fill="${r[1]}">${r[2]}</text>`).join('');
  return `<svg class="mr-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${opt.label||'波形'}"><text x="2" y="${Y(mx)+4}" font-size="10" fill="currentColor">${opt.fmt(mx)}</text><text x="2" y="${Y(mn)+4}" font-size="10" fill="currentColor">${opt.fmt(mn)}</text>${ref}${series.map(s=>`<polyline points="${s.y.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ')}" fill="none" stroke="${s.c}" stroke-width="1.6"/>`).join('')}</svg>`;
}

/* ---------- M13 傾斜角 ---------- */
function tiltLab(d){
  const id='tl'+(++UID),S={ang:'20',f:'none',vib:'0'};
  d.innerHTML=`<div class="planlab fig"><p class="wf-note">模擬：myRIO 繞 Y 軸傾斜，讀 200 次加速度計（每一格 3.906 mg，加上說明書寫的雜訊）。藍線是算出來的角度。</p>
<div class="wf-opts">${radios(id,'ang','實際傾斜',[['0','0°（平放）'],['20','20°'],['60','60°']],S.ang)}${radios(id,'vib','桌子在震動嗎',[['0','沒有'],['1','有（馬達在旁邊轉）']],S.vib)}${radios(id,'f','怎麼處理',[['none','直接算'],['avg','最近 20 筆取平均再算']],S.f)}</div><div class="tl-plot"></div><p class="verdict-line" aria-live="polite"></p></div>`;
  function run(){
    const a=+pick(d,id,'ang')*Math.PI/180,vib=pick(d,id,'vib')==='1',fl=pick(d,id,'f');let r=3;
    const rnd=()=>{r=(r*1103515245+12345)%2147483648;return r/2147483648;},g=()=>(rnd()+rnd()+rnd()+rnd()-2)*1.7;
    const q=v=>Math.round(v/0.003906)*0.003906,out=[],hx=[],hz=[];
    for(let i=0;i<200;i++){
      const sh=vib?0.25*Math.sin(i*1.7)+0.1*g():0;
      let x=q(Math.sin(a)+sh+g()*0.0039),z=q(Math.cos(a)+0.6*sh+g()*0.0039);
      hx.push(x);hz.push(z);if(hx.length>20){hx.shift();hz.shift();}
      if(fl==='avg'){x=hx.reduce((s,v)=>s+v,0)/hx.length;z=hz.reduce((s,v)=>s+v,0)/hz.length;}
      out.push(Math.atan2(x,z)*180/Math.PI);}
    const tgt=+pick(d,id,'ang'),tail=out.slice(40),mx=Math.max(...tail),mn=Math.min(...tail);
    d.querySelector('.tl-plot').innerHTML=plotSvg([{y:out,c:'#1565c0'}],{min:tgt-15,max:tgt+15,h:130,label:'算出來的傾斜角',fmt:v=>v.toFixed(0)+'°',ref:[[tgt,'#2e7d32','實際 '+tgt+'°']]});
    const say=d.querySelector('.verdict-line'),span=mx-mn;
    say.className='verdict-line '+(span<2?'ok':'');
    say.textContent=`算出的角度在 ${mn.toFixed(1)}° 到 ${mx.toFixed(1)}° 之間跳（範圍 ${span.toFixed(1)}°）。`+(vib&&fl==='none'?'震動時加速度計量到的不只是重力，還有晃動本身：角度亂跳。':vib?'平均把震動抹平了大半；代價是角度變化時要等一下才跟上（看最前面那段爬升）。':fl==='avg'?'沒有震動時，平均只是讓讀數更穩。':'沒有震動時，靜止的雜訊不大，直接算就夠用。');
  }
  d.addEventListener('change',run);run();
}

/* ---------- M14 PID ---------- */
function pidLab(d){
  const id='pd'+(++UID),S={ki:'0',kd:'0',aw:'1',load:'0'};
  d.innerHTML=`<div class="planlab fig"><p class="wf-note">接續 M07 的模擬：Kp 固定 2，目標 90°，10 ms 一圈，看 6 秒。可以在 2.5 秒時加一個負載（有人一直推著關節）。</p>
<div class="wf-opts">${radios(id,'ki','Ki',[['0','0（只有 P）'],['2','2'],['3','3']],S.ki)}${radios(id,'kd','Kd',[['0','0'],['0.3','0.3']],S.kd)}${radios(id,'aw','積分',[['1','有上限 ±40（抗飽和）'],['0','沒有上限']],S.aw)}${radios(id,'load','2.5 秒時',[['0','沒事'],['1','加一個負載']],S.load)}</div><div class="pd-plot"></div><p class="verdict-line" aria-live="polite"></p></div>`;
  function run(){
    const kp=2,ki=+pick(d,id,'ki'),kd=+pick(d,id,'kd'),aw=pick(d,id,'aw')==='1',load=pick(d,id,'load')==='1';
    let x=0,v=0,I=0,prev=0;const y=[];
    for(let k=0;k<600;k++){const dt=0.01,e=90-x;I+=ki*e*dt;if(aw)I=Math.max(-40,Math.min(40,I));
      const dterm=-kd*(x-prev)/dt;prev=x;
      let u=Math.max(-100,Math.min(100,kp*e+I+dterm));
      let f=Math.abs(u)<8?0:u-Math.sign(u)*8;if(load&&k>=250)f-=25;
      v+=(f*9-v*4)*dt;x+=v*dt;y.push(x);}
    const pre=y.slice(0,250),peak=Math.max(...pre),end=y[y.length-1],before=pre[pre.length-1];
    d.querySelector('.pd-plot').innerHTML=plotSvg([{y,c:'#1565c0'}],{min:0,max:Math.max(115,peak+5),h:140,label:'角度對時間（6 秒）',fmt:v=>v.toFixed(0)+'°',ref:[[90,'#2e7d32','目標 90°']]});
    let msg=`前 2.5 秒最高衝到 ${peak.toFixed(1)}°，停在 ${before.toFixed(1)}°；6 秒時在 ${end.toFixed(1)}°。`;
    if(!ki)msg+=load?' 只有 P：負載一來就被推離目標，停在誤差剛好跟負載平衡的地方，回不去。':' 只有 P：停在差一點的地方（穩態誤差）。';
    else{
      if(!aw&&peak>130)msg+=' 積分沒有上限：一開始誤差大，輸出早就頂到 100 %，積分卻還在累加；到了目標還在推，衝得特別高。這叫積分飽和（windup）。';
      else msg+=' 加了 I，誤差最後補到 0 附近'+(peak>112?'，可是第一次衝過頭比較多（I 也在推）。':'。');
      if(load)msg+=Math.abs(end-90)<1.5?' 負載來了以後，積分慢慢增加，把關節推回 90°：這就是 I 的用處。':' 負載來了，積分還在追。';
    }
    if(kd)msg+=' D 看「正在變多快」：衝向目標太快時先踩煞車，超越量明顯變小。';
    const say=d.querySelector('.verdict-line');say.className='verdict-line '+(ki&&aw&&kd&&Math.abs(end-90)<1.5?'ok':'');say.textContent=msg;
  }
  d.addEventListener('change',run);run();
}

/* =============================== M13 =============================== */
L.push({id:'M13',order:30.94,no:'M13',part:PART,title:'加速度計：做一個水平儀，順便學濾波和校正',mins:45,
goals:[['學會','板上加速度計讀到的是什麼；怎麼先實測哪一軸朝哪裡；三軸加速度怎麼算成傾斜角；震動時為什麼角度會亂跳、平均的代價；怎麼做歸零校正。'],['做出','一個水平儀：LED0～3 顯示往哪邊傾斜，傾斜超過 30° 時全部閃爍（M12 的故障條件）。'],['為什麼','不用接任何線就能做；而且「讀到的數字不只是你想量的東西」這件事，每一種感測器都會遇到。']],
check:'你能說出：平放時三軸大約讀到多少；傾斜角的公式；震動時角度亂跳的原因；平均 20 筆的代價；歸零校正要記住什麼。',
body:[
C.h3('情境','x','M12 要偵測「傾斜超過 30°」'),
`<p>M12 的規格寫：傾斜超過 30° 當成故障。M08 用的是外接的 MPU-6050；其實 myRIO 板上就有一顆加速度計。說明書：3 軸、±8 g、12 位元（一格 3.906 mg）、每秒更新 800 次。M02 範本的 Main.vi 讀的就是它。</p>`,
C.h3('第 1 步','','先看資料：哪一軸朝哪裡'),
ask('myRIO 平放在桌上，X、Y、Z 三軸各讀到多少？',
 `<p>先猜，再用範本 Main.vi 實際看（M02）。加速度計量的是「除了自由落體以外感受到的加速度」，靜止時量到的就是重力的反方向：朝上的那一軸大約 1 g，另外兩軸接近 0。</p>
<p><b>先看外殼</b>：myRIO 背面印著加速度計的軸向（下圖）：Y 朝接頭那一端、X 朝左、Z 是 ⊗（從背面看是穿進去，也就是指向正面）。照這樣推：正面朝上平放，Z 大約是 +1 g。</p><p><b>再實測驗證</b>：平放、立起來、側放各讀一次，看是不是跟推的一樣。印在外殼上的是「應該」，讀出來的才是「實際」，兩個對得上才開始寫程式。這跟 I1「先看背板，再講到話」是同一件事。</p>`),
`<figure class="mr-shot half"><img src="img/myrio/real/back.jpg" alt="實機背面：上方印著 ACCELEROMETER 和 X、Y、Z 的方向。（標籤上的序號已遮）" loading="lazy"><figcaption>實機背面：上方印著 ACCELEROMETER 和 X、Y、Z 的方向。（標籤上的序號已遮）</figcaption></figure>`,
C.h3('第 2 步','','三軸變成角度'),
ask('只用一軸，例如 sin(角度) ＝ X，可以算角度嗎？',
 `<p>小角度可以，大角度不準：sin 在 90° 附近幾乎不變，X 差一點點，角度就差很多；而且分不出往前倒還是倒過來。</p>
<p>比較好的做法用兩軸（通用的數學）：角度 ＝ atan2(X, Z)。atan2 同時看兩軸的正負號，從 −180° 到 180° 都分得出來。LabVIEW 裡用 Inverse Tangent (2 Input)，結果是弧度，乘 180/π 換成度。</p>`),
C.h3('第 3 步','','震動：讀到的不只是重力'),
{fn:tiltLab},
ask('為什麼有震動時，角度會亂跳？',
 `<p>加速度計分不出「重力」和「晃動」：桌子在震，X、Z 都多了晃動的加速度，atan2 算出來的就不是傾斜角了。</p>
<p>平均可以把來回的晃動抹平，代價是反應變慢：真的傾斜了，要等平均的那幾筆都換新才跟得上。平均幾筆，看 M05 那一句：<b>你要量的東西多快會變</b>。判斷「傾斜超過 30° 停機」可以接受零點幾秒的延遲；拿來穩定一台會晃的車就不行（要再加陀螺儀，那是另一個題目）。</p>`),
C.h3('第 4 步','','歸零校正'),
ask('機台本身就有一點斜，平放時讀到 2.3°。要怎麼讓它顯示 0°？',
 `<p>開機時（或按一個「歸零」鈕時）讀一段時間取平均，記下這個角度當作<b>偏移量</b>；之後每次都減掉它。偏移量在迴圈裡一直要用、只在按歸零時改：放在 Shift Register。</p>
<p>要讓斷電後還記得，就寫到檔案（M10 的存檔），開機時讀回來。</p>`),
flow(['開機：讀偏移量檔案（沒有就用 0）',{loop:['讀 Accelerometer（X、Z）','最近 20 筆平均','atan2 → 度 − 偏移量',{kase:['|角度| > 30°：LED 全部閃、送故障','往左：LED0 亮','往右：LED3 亮','水平：LED1、LED2 亮'],label:'角度'},'按了歸零：偏移量＝目前角度、寫檔'],label:'While Loop',sr:'最近 20 筆、偏移量、閃爍計時'},'Close：Reset myRIO.vi']),
C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'myRIO 平放靜止時，加速度計大約讀到？',o:['朝上的那一軸約 1 g，另兩軸約 0','三軸都是 0','三軸都是 1 g','朝上那軸是 9.8'],a:0,ex:'量到的是重力的反方向，單位是 g。'},
 {q:'哪一軸朝上，最可靠的確認方法？',o:['平放、立起、側放各讀一次','看說明書就好','猜','看 LabVIEW 的圖示'],a:0,ex:'先看資料。'},
 {q:'傾斜角用哪個函式比較好？',o:['atan2(X, Z)（Inverse Tangent 2 Input）','arcsin(X)','X × 90','Z ÷ X'],a:0,ex:'atan2 看兩軸正負號，大角度也準。'},
 {q:'有震動時角度亂跳，平均 20 筆的代價？',o:['反應變慢','讀數變大','會燒掉','沒有代價'],a:0,ex:'看你要量的東西多快會變。'},
 {q:'歸零的偏移量放在哪裡？',o:['Shift Register（要斷電記得就再寫檔）','區域變數','前面板就好','不用存'],a:0,ex:'一直要用、只在按歸零時改。'}
]}
]});

/* =============================== M14 =============================== */
L.push({id:'M14',order:30.95,no:'M14',part:PART,title:'完整的 PID：把 M07 剩下的誤差補上',mins:60,
goals:[['學會','I 和 D 各在解決什麼問題；積分飽和是什麼、怎麼防；為什麼對「量測值」微分而不是對誤差；離散的 PID 在迴圈裡怎麼寫、哪些值放 Shift Register；調參數的順序。'],['做出','關節在有負載的情況下也能回到 90°；加上 D 之後，超越量比只有 PI 時明顯變小。'],['為什麼','M07 只有 P：停不準、一推就偏。加上 I、D 才是真正能用的位置控制。']],
check:'你能說出：只有 P 為什麼回不到目標；積分飽和的現象和兩種防法；D 為什麼對量測值微分；PID 在迴圈裡要記住哪兩個值；調參數先調哪一個。',
body:[
C.h3('情境','x','M07 的關節一推就偏'),
`<p>M07 只用比例控制：停的位置差一點，有人推一下關節，它就停在被推過去的地方。這一課把 I（積分）和 D（微分）加上去。</p>`,
C.h3('第 1 步','','先在模擬裡看三個字母各做什麼'),
{fn:pidLab},
ask('只有 P 時，負載一來，為什麼回不到 90°？',
 `<p>負載一直往回推。P 的輸出是「Kp × 誤差」：要有誤差，才有力氣頂住負載。誤差和負載剛好平衡時，馬達就停在那裡，誤差永遠不會是 0。</p>
<p>I 把誤差<b>累加起來</b>：只要還有一點誤差，積分就一直變大，推得越來越用力，直到誤差真的變 0。這就是 I 的工作。</p>`),
ask('沒有上限的積分，為什麼會衝過頭那麼多？',
 `<p>一開始誤差很大，輸出早就頂到 100 %，可是積分還在一直累加。到了目標附近，P 變小了，積分卻已經很大，繼續推：衝過頭，要等積分慢慢「還回去」才停得下來。這叫<b>積分飽和（windup）</b>。</p>
<p>兩種常見的防法（通用的控制知識）：把積分限制在一個範圍內；或輸出已經頂到上下限時，就不要再累加積分。</p>`),
ask('D 為什麼要對「量測值」微分，不是對誤差？',
 `<p>D 看「變化多快」，用來踩煞車。如果對誤差微分，<b>目標一改</b>（例如從 90° 改成 0°），誤差瞬間跳一大格，微分算出一個超大的值，馬達猛然抖一下，這叫微分踢（derivative kick）。</p>
<p>對量測值（目前角度）微分：目標怎麼跳都不影響 D，D 只在關節真的動得快時才出力。量測值有雜訊時，D 會把雜訊放大，所以 D 通常很小，或先把量測值濾波（M13 的平均）。</p>`),
C.h3('第 2 步','','在迴圈裡怎麼寫'),
ask('每一圈要算 P、I、D，哪些值要「記到下一圈」？',
 `<p>兩個：<b>積分累加到現在的值</b>，和<b>上一圈的量測值</b>（算 D 用）。都是「這一圈算出來，下一圈要用」：放 Shift Register。</p>
<p>還有一個隱藏的條件：I 要乘 dt、D 要除 dt。dt 是迴圈週期，所以 M09 的「週期要穩」在這裡變得很重要：dt 一跳，I、D 就算錯。用 Timed Loop，dt 就是設定的週期。</p>`),
flow([{loop:['讀編碼器 → 角度（可先濾波）','誤差＝目標−角度','積分＝積分＋Ki×誤差×dt，限制在 ±上限','D＝−Kd×（角度−上一圈角度）÷dt','輸出＝Kp×誤差＋積分＋D，限制 ±100','寫方向、PWM'],label:'Timed Loop（dt＝10 ms）',sr:'積分、上一圈角度'}]),
note('LabVIEW 有沒有現成的 PID','有些 LabVIEW 版本附 PID 函式選單（PID and Fuzzy Logic Toolkit）。它內部做的就是上面這些事，參數名字一樣。自己寫一次，你才知道它的每一個輸入在做什麼、出問題時看哪裡。'),
C.h3('第 3 步','','調參數的順序'),
ask('三個參數，先調哪一個？',
 `<p>常見的手調順序（通用經驗）：</p>
<ol><li>Ki、Kd 先設 0，Kp 從小慢慢加，加到反應夠快、開始有一點擺動，再退回一點。</li>
<li>加 Ki，從很小開始，加到剩下的誤差在合理時間內消掉；開始擺動就退。記得積分要有上限。</li>
<li>擺動或超越量還是太大，才加一點點 Kd。</li></ol>
<p>每改一次只改一個參數，並<b>把結果記下來</b>（目標、超越量、穩定時間）。跟接儀器一樣：一次只解一個未知數。</p>`),
C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'有負載時只有 P 回不到目標，因為？',o:['要有誤差才有力氣頂住負載','Kp 太大','編碼器壞了','PWM 頻率太低'],a:0,ex:'I 會一直累加，直到誤差變 0。'},
 {q:'積分飽和（windup）的典型現象？',o:['衝過頭很多才慢慢拉回來','停不到目標','不會動','反轉'],a:0,ex:'積分要有上限，或輸出飽和時停止累加。'},
 {q:'D 為什麼對量測值微分？',o:['目標改變時不會產生微分踢','比較好算','比較準','規定'],a:0,ex:'D 只在關節真的動很快時出力。'},
 {q:'PID 迴圈要放 Shift Register 的是？',o:['積分值和上一圈的量測值','Kp、Ki、Kd','目標值','PWM 頻率'],a:0,ex:'這一圈算、下一圈用。'},
 {q:'手調 PID 通常先調？',o:['Kp（Ki、Kd 先設 0）','Kd','Ki','三個一起'],a:0,ex:'一次只改一個參數，並記錄結果。'}
]}
]});

/* =============================== M15 =============================== */
L.push({id:'M15',order:30.96,no:'M15',part:PART,title:'出問題時怎麼救：連不上、部署失敗、開機卡住',mins:45,
goals:[['學會','一套固定的檢查順序：從燈號、USB、電腦設定、軟體版本，到 myRIO 上的程式；safe mode 和重灌軟體什麼時候用；怎麼看 myRIO 的記憶體和處理器。'],['做出','一張自己的故障排除卡，貼在 myRIO 旁邊。'],['為什麼','myRIO 出問題時，最浪費時間的是「隨便亂試」。照順序一層一層排除，通常十分鐘內找得到。']],
check:'你能說出：排查的五層順序；STATUS 閃 2、3、4 下各要做什麼；什麼時候按住 Reset 5 秒；開機程式把 myRIO 卡住時怎麼辦；怎麼確認是不是記憶體一直變大。',
body:[
C.h3('原則','x','由下往上，一層一層排除'),
`<p>跟接儀器時「一次只解一個未知數」一樣：先確定下面那一層是好的，再往上查。順序：</p>
<ol><li><b>電源和燈號</b>：myRIO 自己好不好？</li><li><b>USB 連線</b>：電腦看不看得到 myRIO？</li><li><b>電腦的軟體</b>：LabVIEW 版本、位元數、Toolkit 對不對？</li><li><b>myRIO 上的軟體</b>：跟電腦的版本合不合？</li><li><b>你的程式</b>：專案、VI 開的位置、開機程式。</li></ol>`,
C.h3('第 1 層','','電源和燈號'),
C.table(['看到','意思（說明書）','做什麼'],[
 ['POWER 不亮','沒電或電源不夠','檢查電源接頭；說明書：6～16 VDC'],
 ['STATUS 亮一下就熄','正常開機完成','往下一層'],
 ['STATUS 每隔幾秒閃 2 下','myRIO 偵測到軟體有問題，常見是更新軟體時被中斷','重新裝軟體（第 4 層）'],
 ['閃 3 下','在 safe mode','按一下 Reset 重開'],
 ['閃 4 下','程式當掉兩次、中間沒重開，通常是記憶體用完','先停掉開機程式（第 5 層），再查程式'],
 ['一直閃或恆亮','無法恢復的錯誤','聯絡 NI']
]),
C.h3('第 2 層','','USB 連線'),
ask('Getting Started Wizard、Create Project 都找不到 myRIO。依序查什麼？',
 `<ol><li>USB 線接的是 <b>USB Device</b> 埠嗎（不是 Host）？換一條線試試：有些線只能充電，不能傳資料。</li>
<li>Windows 有沒有多出那張 USB 的網路卡？NI 論壇有人遇過這張網路卡的 DHCP 沒設好，就怎麼樣都找不到 myRIO：到 Windows 的網路設定看那張網路卡有沒有拿到位址。</li>
<li>改用網路的選項，直接填 <code>172.22.11.2</code>（M02）。</li>
<li>用瀏覽器開 <code>http://172.22.11.2</code>：開得起來，表示 myRIO 和連線都是好的，問題在 LabVIEW 這一側。</li></ol>`),
C.h3('第 3 層','','電腦的軟體'),
C.table(['症狀','原因','做什麼'],[
 ['Create Project 沒有 myRIO 分類、函式選單沒有 myRIO','開的是 64 位元 LabVIEW，或沒裝 myRIO Toolkit','確認開的是 LabVIEW 2018（32 位元）'],
 ['裝了好幾個版本的 LabVIEW','Toolkit 只裝進對應的那一版','用跟 Toolkit 同一版的 LabVIEW 開專案']
]),
C.h3('第 4 層','','myRIO 上的軟體'),
ask('部署時說 myRIO 上的軟體版本不合，或 STATUS 閃 2 下。怎麼重裝？',
 `<p>兩條路：</p>
<ul><li>重新跑 <b>Getting Started Wizard</b>（M01）：它會把電腦這一版的軟體裝到 myRIO 上。最簡單。</li>
<li><b>NI MAX</b>：${ui('Remote Systems')} 底下找到你的 myRIO ▸ ${ui('Software')} 按右鍵 ▸ ${ui('Add/Remove Software')}，選跟電腦上 LabVIEW 同一版的軟體組合。</li></ul>
<p>裝的過程中<b>不要斷電、不要拔線</b>：這就是「閃 2 下」最常見的原因。</p>`),
ask('myRIO 完全開不起來、連瀏覽器都進不去。最後一招？',
 `<p><b>Safe mode</b>：按住 Reset 5 秒再放開（說明書）。myRIO 只啟動更新設定、安裝軟體需要的服務，不跑你的程式。進了 safe mode，再用 NI MAX 重裝軟體；必要時在 NI MAX 對 myRIO 按右鍵格式化（Format Disk），等於清空重來，<b>myRIO 上的程式和檔案都會不見</b>，先備份。</p>
<p>說明書還提到：safe mode 時可以用 MXP A 的 UART 接一條 USB 轉 TTL（3.3 V）的線，用終端機 115200-8-N-1 跟它講話。這是很少用到的最後手段。</p>`),
C.h3('第 5 層','','你的程式'),
C.table(['症狀','最可能的原因','做什麼'],[
 ['標題列是 …lvproj/My Computer、執行箭頭斷掉','VI 從資料夾直接開（M02）','從專案總管 myRIO 底下重開'],
 ['按執行說有衝突、要停掉正在跑的程式','開機程式還在跑（M10）','讓它停掉；開發期間在 NI MAX 或 172.22.11.2 選 Disable RT Startup App'],
 ['一開機就當、LED 亂閃、閃 4 下','開機程式有問題（例如記憶體一直長大）','先 Disable RT Startup App 重開，再修程式'],
 ['跑一陣子變慢、最後當掉','迴圈裡一直 Build Array、開參照沒關、檔案一直開','用 Distributed System Manager 看 myRIO 的記憶體是不是一直往上爬'],
 ['馬達、LED 停在最後的狀態','用了 Abort，或沒有 Reset myRIO.vi','用 Stop 結束；Close 要有 Reset myRIO.vi（M02）']
]),
ask('怎麼確認是不是記憶體一直變大？',
 `<p>LabVIEW 的 ${ui('Tools')} 選單裡有 <b>Distributed System Manager</b>（LabVIEW Real-Time 的通用工具），可以看到 myRIO 的處理器和記憶體使用量。讓程式跑十分鐘：記憶體一直往上爬、不會停，就是有東西沒釋放。</p>
<p>最常見的兇手：迴圈裡用 Build Array 一直把資料接上去（陣列無限長大）。改成固定大小的陣列，或用 M09 的 RT FIFO 把資料送走。</p>`),
tip('做一張故障排除卡','把上面五層各寫一行「看什麼、怎麼辦」，印出來貼在 myRIO 旁邊。下一次出問題，照著卡片一層一層打勾，不要跳著試。'),
C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'排查的順序應該是？',o:['電源燈號 → USB → 電腦軟體 → myRIO 軟體 → 程式','先改程式','先重灌','隨便試'],a:0,ex:'由下往上，一層一層排除。'},
 {q:'STATUS 每隔幾秒閃 2 下，最常見的原因？',o:['更新軟體時被中斷','電源不夠','USB 沒接','程式太長'],a:0,ex:'重新裝軟體，過程中不要斷電。'},
 {q:'瀏覽器開得起 172.22.11.2，但 LabVIEW 找不到 myRIO。問題比較可能在？',o:['LabVIEW 這一側（版本、位元數、Toolkit）','myRIO 壞了','USB 線斷了','電源'],a:0,ex:'myRIO 和連線都證明是好的。'},
 {q:'開機程式一開就讓 myRIO 當掉，先做什麼？',o:['Disable RT Startup App 再重開','格式化','換 myRIO','重灌 Windows'],a:0,ex:'先讓 myRIO 能開機，再修程式。'},
 {q:'怎麼確認記憶體是不是一直變大？',o:['Distributed System Manager 看 myRIO 的記憶體','看 LED','看前面板','猜'],a:0,ex:'最常見的兇手是迴圈裡的 Build Array。'}
]}
]});
})();
