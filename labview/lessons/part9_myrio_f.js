/* 第九部分：myRIO（M16）：看一張學生的方塊圖，先預測「在機器上會怎樣」，再改成離開電腦也能用的版本。
   方塊圖是使用者在實機上做的（2026-11-12 提供的截圖）：範本 Main.vi 的 Main Loop 裡加了 Button、LED Express VI，
   四個前面板開關接 LED，Button 接一個指示燈，三個 Express VI 的 error 用 Merge Errors 合起來，和 Stop 一起 Or 停迴圈。
   行為依據：M02（互動式前面板、Stop 與 Abort、Reset myRIO.vi）、M10（開機執行沒有前面板，控制項用存檔時的預設值）、M04（上升緣、彈跳）。
   拔掉 USB 時互動式前面板的確切行為（程式是否繼續跑）依 LabVIEW 設定而定，課文標為「上機確認」。 */
(function(){
const L=window.LESSONS;
const PART='myRIO 嵌入式控制';
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

/* ---------- 機器上會怎樣：模擬 ---------- */
let UID=0;
function machineLab(d){
  const id='mc'+(++UID);
  const S={prog:'orig',mode:'run',sw:[true,false,true,false],btn:false,cnt:0,tilt:false};
  const MODES=[['run','從專案按執行，USB 連著'],['unplug','執行中拔掉 USB'],['startup','做成開機自動執行，只接電源'],['stop','按前面板的 Stop 結束'],['abort','按工具列的 Abort 結束']];
  d.innerHTML=`<div class="planlab fig mc">
<div class="wf-opts"><fieldset><legend>程式</legend><label><input type="radio" name="${id}-prog" value="orig" checked> 原本那張圖</label><label><input type="radio" name="${id}-prog" value="better"> 改進版：BUTTON0 在 myRIO 上切換 LED</label></fieldset>
<fieldset><legend>情況</legend>${MODES.map((m,i)=>`<label><input type="radio" name="${id}-mode" value="${m[0]}"${i?'':' checked'}> ${m[1]}</label>`).join('')}</fieldset></div>
<div class="mc-two"><div class="mc-pc"><b>電腦上的前面板</b><div class="mc-sws">${[0,1,2,3].map(i=>`<label><input type="checkbox" data-sw="${i}"${S.sw[i]?' checked':''}> LED${i}</label>`).join('')}</div><p>Button 指示燈：<span class="mc-ind"></span></p><p class="mc-chart"></p></div>
<div class="mc-dev"><b>myRIO</b><div class="mc-leds">${[0,1,2,3].map(i=>`<span class="mc-led" data-led="${i}"><i></i>LED${i}</span>`).join('')}</div>
<p><button type="button" class="btn mc-b0">按一下 BUTTON0</button> <button type="button" class="btn mc-tilt">傾斜 myRIO</button></p></div></div>
<p class="verdict-line" aria-live="polite"></p></div>`;
  const $=s=>d.querySelector(s);
  function draw(){
    S.prog=d.querySelector(`input[name="${id}-prog"]:checked`).value;S.mode=d.querySelector(`input[name="${id}-mode"]:checked`).value;
    const orig=S.prog==='orig',m=S.mode,panel=m==='run';
    let leds=[false,false,false,false],ind='（看不到）',chart='Acceleration 圖：（看不到）',msg='';
    if(orig){
      if(m==='run'){leds=S.sw.slice();ind=S.btn?'亮（TRUE）':'暗';chart='Acceleration 圖：'+(S.tilt?'三條線跟著傾斜變化':'X、Y 接近 0，平放時 Z 約 1 g');msg='LED 跟著電腦上的開關；按 BUTTON0 只有電腦上的 Button 指示燈會亮，LED 不會變：兩邊沒有接線。';}
      else if(m==='unplug'){leds=S.sw.slice();ind='（停在拔線那一刻）';chart='Acceleration 圖：停住不動';msg='前面板停住了，開關點了也送不過去，LED 停在拔線前的樣子；按 BUTTON0、傾斜都看不到反應。程式在 myRIO 上是否繼續跑、之後怎麼收尾，要在你的 LabVIEW 上實際拔一次確認。重點是：你已經控制不了它，連 Stop 都按不到。';}
      else if(m==='startup'){leds=[false,false,false,false];msg='沒有前面板：開關永遠是存檔時的預設值（通常是 FALSE），所以 LED 全不亮；按 BUTTON0、傾斜也看不到任何結果。這支程式離開電腦就什麼都不會做。';}
      else if(m==='stop'){msg='迴圈結束 → Close 跑 Reset myRIO.vi → LED 全熄。這是正確的結束方式。';}
      else {leds=S.sw.slice();msg='Abort 直接停在當下那一行，Close 沒有跑：LED 停在最後的狀態。接的是馬達的話，馬達會一直轉。';}
    }else{
      const own=[0,1,2,3].map(i=>S.cnt%4===i);
      if(m==='run'||m==='unplug'||m==='startup'){leds=own;ind=m==='run'?(S.btn?'亮（TRUE）':'暗'):ind;chart=m==='run'?chart.replace('（看不到）',S.tilt?'三條線跟著傾斜變化':'X、Y 接近 0，Z 約 1 g'):chart;
        msg=`按 BUTTON0（上升緣＋防彈跳）亮的燈往下一顆移，現在是 LED${S.cnt%4}。判斷在 myRIO 上做，`+(m==='startup'?'所以開機自動執行時一樣能用。':m==='unplug'?'所以拔掉 USB 之後按鈕照樣能切燈，只是電腦看不到了。':'電腦只是用來看。');}
      else if(m==='stop'){msg='沒有前面板時按不到 Stop：開機執行的版本要另外設計停止的方法（M10），例如長按 BUTTON0 3 秒才結束。從專案執行時按 Stop，一樣會跑 Reset myRIO.vi，LED 全熄。';}
      else {leds=own;msg='Abort 一樣跳過 Close：LED 停在最後的狀態。';}
    }
    d.querySelectorAll('[data-sw]').forEach(c=>c.disabled=!(orig&&panel));
    d.querySelectorAll('.mc-led').forEach((e,i)=>e.classList.toggle('on',leds[i]));
    $('.mc-ind').textContent=ind;$('.mc-chart').textContent=chart;
    $('.verdict-line').textContent=msg;
    const canPress=m==='run'||m==='unplug'||m==='startup';$('.mc-b0').disabled=!canPress;$('.mc-tilt').disabled=!canPress;
  }
  d.addEventListener('change',e=>{const c=e.target.closest('[data-sw]');if(c)S.sw[+c.dataset.sw]=c.checked;draw();});
  $('.mc-b0').onclick=()=>{S.btn=true;if(S.prog==='better')S.cnt++;draw();setTimeout(()=>{S.btn=false;draw();},400);};
  $('.mc-tilt').onclick=()=>{S.tilt=!S.tilt;$('.mc-tilt').textContent=S.tilt?'放平 myRIO':'傾斜 myRIO';draw();};
  draw();
}

/* =============================== M16 =============================== */
L.push({id:'M16',order:30.97,no:'M16',part:PART,title:'看一張方塊圖，先預測「機器上會怎樣」',mins:45,
goals:[['學會','讀一張 myRIO 的方塊圖時，一個一個問：這個值從哪裡來、到哪裡去、誰在做判斷；同一支程式在「接著電腦」「拔掉 USB」「開機自動執行」「Stop」「Abort」時各會怎樣。'],['做出','把一支「一定要接電腦才有用」的程式，改成判斷在 myRIO 上做、離開電腦也能動的版本。'],['為什麼','上機之前先預測，跑出來跟預測不一樣的地方，就是你還沒懂的地方。這比一直試、看會怎樣，快得多。']],
check:'你能看著方塊圖說出：按 BUTTON0 時哪裡會變、哪裡不會；拔掉 USB、做成開機執行、按 Stop、按 Abort 時 LED 各會怎樣；為什麼改進版離開電腦也能用。',
body:[
C.h3('情境','x','一張在實機上做的方塊圖'),
`<p>下面這張是在 myRIO 範本 Main.vi（M02）上改出來的：Main Loop 裡除了原本的 Accelerometer，又加了 <b>Button</b> 和 <b>LED</b> 兩個 Express VI。</p>`,
`<figure class="mr-shot"><img src="img/myrio/student_led_button.png" alt="方塊圖：Main Loop 裡有 Accelerometer、Button、LED 三個 Express VI；四個前面板開關接 LED；Button 接一個指示燈；三個 error 合起來和 Stop 一起 Or 停止迴圈；Close 格子呼叫 Reset myRIO.vi" loading="lazy"><figcaption>實機上做的方塊圖（LabVIEW 2018）。先不要往下看答案：一個一個問自己，這個值從哪裡來、到哪裡去。</figcaption></figure>`,
C.h3('第 1 步','','一條線一條線讀'),
ask('四個開關（LED0、LED0 2、LED0 3、LED0 4）的值從哪裡來？',
 `<p>從<b>電腦上的前面板</b>：你用滑鼠點開關，值透過 USB 傳給 myRIO，LED Express VI 再把 myRIO 上對應的 LED 打開。</p>
<p>名字是 LabVIEW 自動取的：放第二個同名的控制項時，它在後面加數字。「LED0 2」其實接的是 LED1。<b>把它們改成 LED0～LED3</b>，看圖的人才不會對錯燈。旁邊的指示燈也一樣：圖上寫成「Botton」，打錯字的名字以後搜尋、對照都會找不到。</p>`),
ask('按下 BUTTON0，myRIO 上的 LED 會變嗎？',
 `<p>不會。Button Express VI 的輸出只接到一個前面板指示燈，沒有接到 LED。按下去，只有<b>電腦畫面上</b>那顆 Button 指示燈亮。</p>
<p>很多人看到「Button」和「LED」放在同一個迴圈裡，就以為它們有關係。方塊圖裡<b>沒有線，就沒有關係</b>：這是讀 LabVIEW 程式最重要的一條規則。</p>`),
ask('三個 Express VI 的 error 合起來，再跟 Stop 一起 Or，是為了什麼？',
 `<p>三個裡面任何一個出錯（例如連線斷了、設定錯了），迴圈就停下來，錯誤從 error out 顯示。這是 M02 範本的寫法往外擴充：每加一個 Express VI，就把它的 error 也接進 Merge Errors，不要讓它的錯誤「掉在地上」沒人看。</p>`),
C.h3('第 2 步','','換五種情況，在機器上會怎樣'),
`<p>先自己在紙上寫：五種情況下，LED 和 Button 指示燈各會怎樣。寫完再用下面的模擬對答案。</p>`,
{fn:machineLab},
ask('為什麼做成開機自動執行之後，LED 全不亮？',
 `<p>M10 說過：開機執行沒有前面板。前面板的開關不會有人去點，它的值永遠是<b>存檔時的預設值</b>。存檔時開關是 FALSE，LED 就永遠不亮。</p>
<p>換句話說：這支程式所有的「決定」都是人在電腦上做的，myRIO 只是照做。電腦一離開，就沒有人做決定了。</p>`),
ask('改進版為什麼離開電腦也能用？',
 `<p>因為「按一下 BUTTON0 → 換下一顆燈」這個<b>決定是在 myRIO 上做的</b>：讀 Button、判斷上升緣和彈跳（M04）、算出第幾顆燈、寫 LED，全部在 Main Loop 裡完成。電腦接著時只是多了一個可以看的畫面。</p>
<p>設計 myRIO 程式時問自己一句：<b>拔掉電腦之後，誰來做決定？</b>答案是「電腦上的人」的部分，都要另外想辦法（實體按鈕、感測器、設定檔）。</p>`),
flow(['Initialize',{loop:['Accelerometer → Acceleration 圖（給電腦看）','Button → 連續 TRUE 的毫秒數（防彈跳）',{kase:['剛好滿 20 ms：第幾顆＋1（到 4 回 0）','其他：不動'],label:'按下滿 20 ms？'},'LED：只亮第幾顆','三個 error 合起來 Or Stop'],label:'Main Loop（10 ms）',sr:'連續 TRUE 的毫秒數、第幾顆'},'Close：Reset myRIO.vi']),
note('迴圈 10 ms 一圈時怎麼算 20 ms','Main Loop 每圈約 10 ms：「連續 TRUE 的圈數」到 2 就是 20 ms。要算得更準，用 Tick Count 記下按下去的時間（M09）。'),
C.h3('第 3 步','','上機驗證'),
`<ol class="mr-steps"><li>照原本那張圖執行，五種情況各試一次，跟你在紙上寫的預測對照。</li><li>拔掉 USB 那一種，特別看：前面板顯示什麼訊息、LED 怎樣、重新插上之後能不能再按 Stop。把看到的寫下來，這是你這台、這個版本的實際行為。</li><li>改成改進版，再做一次，並照 M10 做成開機執行，只接電源試按 BUTTON0。</li></ol>`,
tip('養成習慣','每次改完程式、按執行之前，先講一句「我預期會看到……」。跟預期不一樣時，不要急著改，先找出是哪一條線的理解錯了。'),
C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'原本那張圖，按 BUTTON0 會怎樣？',o:['只有電腦上的 Button 指示燈亮，LED 不變','LED0 亮','四顆 LED 都亮','程式停止'],a:0,ex:'方塊圖裡沒有線，就沒有關係。'},
 {q:'原本那張圖做成開機自動執行，只接電源，LED 會？',o:['全不亮（開關是存檔時的預設值 FALSE）','跟著 BUTTON0','全部亮','閃爍'],a:0,ex:'開機執行沒有前面板。'},
 {q:'按工具列的 Abort 結束，LED 會？',o:['停在最後的狀態（Close 沒有跑）','全部熄滅','全部亮','閃爍'],a:0,ex:'用前面板的 Stop，Close 才會跑 Reset myRIO.vi。'},
 {q:'「LED0 2」這個名字代表什麼？',o:['LabVIEW 自動在重複的名字後面加數字；它其實接的是另一顆 LED','LED0 的第二個功能','LED2','錯誤'],a:0,ex:'改成 LED0～LED3，看圖的人才不會對錯。'},
 {q:'要讓程式離開電腦也能用，關鍵是？',o:['判斷在 myRIO 上做（實體按鈕、感測器），不要靠電腦前面板','把前面板做大一點','用 Abort','把迴圈改成 1 ms'],a:0,ex:'問自己：拔掉電腦之後，誰來做決定？'}
]}
]});
})();
