/* 實務案例 W14：現場除錯。ST02 的 FAIL 率從 2 % 變成 9 %，要找出原因、修好、讓它不再發生。
   職缺對照（docs/job_research.md 前 10 名第 2 名）：現場調機、試車、異常排除、除錯；治具維護（第 I 組）。
   重點是方法：先把問題講清楚（什麼、哪裡、什麼時候、多少）→ 先看已經有的資料 → 提出假設 → 用最便宜的實驗驗證 → 一次只改一件事 → 確認修好 → 防止再發。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
if(!LV.F['Max & Min'])LV.F['Max & Min']={g:'⇕',ins:['x','y'],outs:['max(x, y)','min(x, y)'],pal:['Functions','Programming','Comparison','Max & Min']};
if(!LV.F['Boolean To (0,1)'])LV.F['Boolean To (0,1)']={g:'?1:0',ins:['Boolean'],outs:['0, 1'],pal:['Functions','Programming','Boolean','Boolean To (0,1)']};

/* ---- 圖：除錯偵探 ---- */
const CHECKS=[
 {k:'st',t:'FAIL 依測試站分開看',min:5,kind:'資料',r:'ST01：2.1 %（12／570）　ST02：<b>9.4 %</b>（54／575）。只有 ST02 變差，產品本身不太可能突然變壞，先懷疑 ST02 這一站。'},
 {k:'item',t:'ST02 的 FAIL 依測項分開看',min:5,kind:'資料',r:'T03（滿載輸出電壓）46 筆、T02 5 筆、其他 3 筆。幾乎都卡在 T03：問題和「滿載」或「量 T03 的路徑」有關。'},
 {k:'hour',t:'ST02 的 FAIL 依時段分開看',min:5,kind:'資料',r:'早上 9.1 %、下午 9.6 %、夜班 9.5 %。沒有時段差異：和溫度、和隔壁機台幾點開機比較沒關係。'},
 {k:'dist',t:'比較兩站 T03 量測值的分布',min:10,kind:'資料',r:'ST01：集中在 4.975 V 附近。ST02：大部分也在 4.975，但有一群掉在 <b>4.83～4.88 V</b>，像是「偶爾少了 0.1 V」。少了固定一截，很像多了一段電阻（I × R）。'},
 {k:'op',t:'ST02 的 FAIL 依作業員分開看',min:5,kind:'資料',r:'A12：9.3 %、B03：9.6 %。換人沒差，不是操作手法的問題。'},
 {k:'swap',t:'把 ST02 FAIL 的 20 片拿到 ST01 重測',min:30,kind:'實驗',r:'ST01 上 <b>19 片 PASS</b>、1 片 FAIL（T05 效率，真的不良）。板子大多是好的，問題在 ST02。'},
 {k:'dmm',t:'ST02 的 DMM 和 ST01 對調',min:40,kind:'實驗',r:'對調後 ST02 的 FAIL 率還是 9 % 左右，ST01 還是 2 %。問題沒有跟著 DMM 走：不是 DMM。'},
 {k:'gold',t:'用 golden sample 在 ST02 連測 20 次',min:15,kind:'實驗',r:'20 次裡 3 次 T03 只有 4.86～4.87 V（FAIL），其他 4.975 V。<b>同一片板子結果會跳</b>：是量測的問題，不是板子的問題，而且是「偶爾接觸不好」的型態。'},
 {k:'probe',t:'看 ST02 治具的探針使用次數',min:5,kind:'資料',r:'ST02 的探針計數 <b>182,000 次</b>，規格壽命 100,000 次（ST01 上個月換過，現在 41,000 次）。磨損的探針接觸電阻變大、時好時壞。'},
 {k:'scope',t:'用放大鏡看 ST02 的負載探針',min:10,kind:'實驗',r:'負載輸出的兩根探針頭部磨平、有氧化痕跡。'},
 {k:'sw',t:'重新安裝 ST02 的測試程式',min:60,kind:'動手',r:'重灌之後 FAIL 率還是 9 %。兩站跑的是同一版程式，這一步本來就不太可能有用：花了一小時。'},
 {k:'limit',t:'把 T03 的下限從 4.85 放寬到 4.80',min:5,kind:'動手',r:'<b style="color:#c0392b">這不是除錯，是把問題藏起來。</b>FAIL 率會下降，但真的輸出偏低的壞板子也會被放過。上下限是品保核准的，不能為了讓數字好看而改。'}
];
const CAUSES=['DMM 壞了','測試程式有 bug','產品這批品質變差','ST02 治具的負載探針磨損，接觸電阻時好時壞','作業員操作不當'];
function detective(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<p style="margin:0 0 6px"><b>你可以做下面這些事。每一件都要花時間；選你覺得最該先做的。</b> 已經花了 <b data-o="t">0</b> 分鐘。</p>
  <div data-o="btns" style="display:flex;flex-wrap:wrap;gap:6px"></div>
  <div data-o="log" style="font-size:13px;margin-top:8px"></div>
  <div style="border-top:1px solid #dde;margin-top:8px;padding-top:8px;font-size:13px">我認為原因是：<select data-k="cause"><option value="-1">（先查，再決定）</option>${CAUSES.map((c,i)=>`<option value="${i}">${c}</option>`).join('')}</select> <button type="button" class="btn" data-k="ans">決定</button> <button type="button" class="btn" data-k="rs">重來</button>
  <div data-o="fb" style="margin-top:6px"></div></div>`;
  const o=k=>el.querySelector('[data-o='+k+']');let done=[],t=0;
  function draw(){
    o('btns').innerHTML=CHECKS.map((c,i)=>`<button type="button" class="btn" data-c="${i}" ${done.includes(i)?'disabled':''} title="${c.kind}，約 ${c.min} 分鐘">${c.kind==='資料'?'📊':c.kind==='實驗'?'🔧':'⚠'} ${c.t}（${c.min} 分）</button>`).join('');
    o('btns').querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{const i=+b.dataset.c;done.push(i);t+=CHECKS[i].min;draw();});
    o('t').textContent=t;
    o('log').innerHTML=done.map((i,n)=>`<div style="border-left:3px solid ${CHECKS[i].kind==='資料'?'#2f6fd0':CHECKS[i].kind==='實驗'?'#1e7b34':'#c0392b'};padding:2px 8px;margin:4px 0"><b>${n+1}. ${CHECKS[i].t}</b>（${CHECKS[i].min} 分）<br>${CHECKS[i].r}</div>`).join('');
  }
  el.querySelector('[data-k=ans]').onclick=()=>{
    const c=+el.querySelector('[data-k=cause]').value;if(c<0)return;
    const has=k=>done.some(i=>CHECKS[i].k===k);
    let fb='';
    if(c!==3){fb='<b style="color:#c0392b">再想想。</b>'+(c===0?'DMM 對調之後問題沒有跟著走（如果你做了那一步）。':c===1?'兩站是同一版程式，只有一站壞。':c===2?'同一批板子在 ST01 是好的。':'換人沒有差別。')+' 證據要能解釋「只有 ST02、只有 T03、同一片時好時壞」這三件事。';}
    else{
      const ev=['st','swap','gold','probe'].filter(has).length;
      fb='<b style="color:#1e7b34">對。</b>總共花了 '+t+' 分鐘。';
      if(!has('probe')&&!has('scope'))fb+=' 不過你還沒有直接的證據（探針計數或實際看探針）：猜對和證明是兩回事，修之前要有證據。';
      if(has('sw'))fb+=' 重灌程式花了 60 分鐘：兩站同一版程式、只有一站壞時，程式不是第一個要懷疑的。';
      if(has('limit'))fb+=' 放寬下限不能算是處理方法。';
      if(has('dmm')&&!has('gold'))fb+=' 對調 DMM 是好方法（A/B 對調），但比較花時間；先用 golden sample 連測，能更快確定「是量測在跳」。';
      fb+='<br>比較有效率的順序：先看<b>已經有的資料</b>（依站、依測項、看分布，各 5～10 分鐘）→ 用便宜的實驗確認（golden sample 連測、看探針計數）→ 最後才動手換東西。';
    }
    o('fb').innerHTML=fb;
  };
  el.querySelector('[data-k=rs]').onclick=()=>{done=[];t=0;o('fb').innerHTML='';el.querySelector('[data-k=cause]').value='-1';draw();};
  draw();
}

/* ---- 一步一步寫：最近 50 片的 FAIL 率警報 ---- */
const fv={name:'FailRate.vi',view:'split',ratio:2,
 fp:{w:330,h:230,items:[
  {id:'p',k:'num',ctl:true,label:'這一站的真實 FAIL 機率 %（模擬）',x:12,y:8,w:60,v:2,inc:1},
  {id:'res',k:'led',label:'這一片 FAIL',color:'red',x:220,y:8},
  {id:'rate',k:'num',label:'最近 N 片的 FAIL 率 %',x:12,y:70,w:70,dig:1},
  {id:'n',k:'num',label:'目前幾片',x:170,y:70,w:50},
  {id:'alm',k:'led',label:'FAIL 率 > 5 %：通知工程師',color:'red',x:12,y:130},
  {id:'quit',k:'btn',label:'stop',text:'停止',stop:true,x:200,y:170}]},
 bd:{w:1000,h:300,structs:[{id:'wl',k:'while',x:110,y:10,w:860,h:270}],
  nodes:[
  {id:'res',k:'ctl',t:'bool',label:'這一片 FAIL',x:140,y:40},
  {id:'b01',k:'fn',fn:'Boolean To (0,1)',x:220,y:40,w:44},
  {id:'k0',k:'const',t:'i16[]',v:'空陣列',x:20,y:152},
  {id:'sr',k:'sr',t:'i16[]',s:'wl',y:160},
  {id:'ba',k:'fn',fn:'Build Array',ins:['element 0','element 1'],x:300,y:60},
  {id:'sz',k:'fn',fn:'Array Size',x:370,y:120},
  {id:'kN',k:'const',t:'i32',v:50,x:370,y:200},
  {id:'sub',k:'fn',fn:'Subtract',x:440,y:130},
  {id:'kz',k:'const',t:'i32',v:0,x:440,y:190},
  {id:'mx',k:'fn',fn:'Max & Min',x:500,y:150},
  {id:'as',k:'fn',fn:'Array Subset',x:570,y:60},
  {id:'sum',k:'fn',fn:'Add Array Elements',x:650,y:40},
  {id:'sz2',k:'fn',fn:'Array Size',x:650,y:110},
  {id:'n',k:'ind',t:'i32',label:'目前幾片',x:720,y:150},
  {id:'div',k:'fn',fn:'Divide',x:720,y:60},
  {id:'k100',k:'const',t:'dbl',v:100,x:740,y:110},
  {id:'mul',k:'fn',fn:'Multiply',x:780,y:70},
  {id:'rate',k:'ind',t:'dbl',label:'FAIL 率 %',x:830,y:30},
  {id:'k5',k:'const',t:'dbl',v:5,x:780,y:200},
  {id:'gt',k:'fn',fn:'Greater?',x:830,y:150},
  {id:'alm',k:'ind',t:'bool',label:'通知',x:900,y:154},
  {id:'quit',k:'ctl',t:'bool',label:'stop',x:640,y:236},
  {id:'cond',k:'stop',s:'wl'}],
  wires:[
  {id:'w1',from:'res',to:'b01',t:'bool'},
  {id:'w2',from:'b01.0, 1',to:'ba.element 1',t:'i16',mx:285},
  {id:'w0',from:'k0',to:'sr.init',t:'i16[]'},
  {id:'w3',from:'sr.L',to:'ba.element 0',t:'i16[]',mx:280},
  {id:'w4',from:'ba.appended array',to:'sz',t:'i16[]',mx:355},
  {id:'w5',from:'sz.size',to:'sub.x',t:'i32',mx:425},
  {id:'w6',from:'kN',to:'sub.y',t:'i32',mx:425},
  {id:'w7',from:'sub.out',to:'mx.x',t:'i32',mx:485},
  {id:'w8',from:'kz',to:'mx.y',t:'i32',mx:488},
  {id:'w9',from:'ba.appended array',to:'as.array',t:'i16[]'},
  {id:'w10',from:'mx.max(x, y)',to:'as.index',t:'i32',mx:555},
  {id:'w11',from:'kN',to:'as.length',t:'i32',pts:[[410,209],[410,230],[560,230],[560,94],[570,94]]},
  {id:'w12',from:'as.subarray',to:'sr.R',t:'i16[]',pts:[[625,76],[625,140],[964,140],[964,160]]},
  {id:'w13',from:'as.subarray',to:'sum',t:'i16[]',mx:625},
  {id:'w14',from:'as.subarray',to:'sz2',t:'i16[]',mx:625},
  {id:'w15',from:'sum.sum',to:'div.x',t:'i16',mx:705},
  {id:'w16',from:'sz2.size',to:'div.y',t:'i32',mx:710},
  {id:'w17',from:'sz2.size',to:'n',t:'i32',mx:710},
  {id:'w18',from:'div.out',to:'mul.x',t:'dbl'},
  {id:'w19',from:'k100',to:'mul.y',t:'dbl',mx:770},
  {id:'w20',from:'mul.out',to:'rate',t:'dbl',mx:815},
  {id:'w21',from:'mul.out',to:'gt.x',t:'dbl',mx:815},
  {id:'w22',from:'k5',to:'gt.y',t:'dbl',mx:820},
  {id:'w23',from:'gt.out',to:'alm',t:'bool',mx:880},
  {id:'wq',from:'quit',to:'cond',t:'bool'}]},
 sim:{period:150,init:()=>({h:[]}),
  step(inp,st){
   const fail=Math.random()*100<(+inp.p||0);st.h.push(fail?1:0);if(st.h.length>50)st.h.shift();
   const s=st.h.reduce((a,b)=>a+b,0),n=st.h.length,rate=s/n*100,alm=rate>5;
   return {out:{res:fail,rate,n,alm},stop:!!inp.quit,
    vals:{res:fail,'b01.0, 1':fail?1:0,'sz.size':n+(n===50?'（加入後 51）':''),kN:50,'mx.max(x, y)':Math.max(0,n-50),'as.subarray':'['+n+' 個]','sum.sum':s,'sz2.size':n,'div.out':(s/n).toFixed(3),k100:100,'mul.out':rate.toFixed(1),k5:5,'gt.out':alm,kz:0},
    msg:'最近 '+n+' 片中 FAIL '+s+' 片 ＝ '+rate.toFixed(1)+' %'+(alm?'　→ 通知工程師':'')+(n<50?'（還不滿 50 片，比例會跳得比較大）':'')};},
  doneMsg:'停止'}
};

L.push({id:'W14',order:30.994,no:'W14',part:PART,title:'現場除錯：ST02 的 FAIL 率突然變 9 %，先看資料、再做實驗，找到原因再動手',mins:70,files:['練習\\實務\\Station\\FailRate.vi'],
goals:[['學會','把問題講清楚（什麼、哪裡、什麼時候、多少）；先看已經有的資料，再做實驗，最後才動手換東西；A/B 對調；golden sample 連測分辨「板子壞」和「量測在跳」；一次只改一件事；不能用放寬上下限來「解決」問題；修好要用數字確認；加上預防（探針計數、FAIL 率警報）。'],['做出','在除錯模擬上找出原因；FailRate.vi：最近 50 片的 FAIL 率超過 5 % 就通知。'],['為什麼是這個題目','職缺工作內容排第 2 名的就是「現場調機、試車、異常排除、除錯」。真正上班後，被叫去看「為什麼最近怪怪的」的次數，比寫新程式還多。']],
check:'不看課文，能說出除錯的順序、為什麼要先看資料、A/B 對調在做什麼、修好之後要怎麼確認，以及為什麼不能放寬上下限。',
body:[
C.h3('① 聽懂問題','','產線主管的電話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「你寫的那個測試站最近很多 FAIL，作業員說機器怪怪的，你下來看一下。」</p></div>`,
ask('這句話裡缺了什麼？去現場之前要先問清楚什麼？',
 `<p>「很多」是多少？「最近」是哪一天開始？「機器怪怪的」是哪一台？把問題變成可以量的句子：</p>
 <ul><li><b>什麼</b>：FAIL 變多（哪一項 FAIL？）</li><li><b>哪裡</b>：ST01 還是 ST02，還是兩台都有？</li><li><b>什麼時候</b>：從哪一天開始？整天都這樣，還是某些時段？</li><li><b>多少</b>：平常 FAIL 率多少，現在多少？</li></ul>
 <p>W9 的資料庫在這裡就派上用場：幾句 SQL，五分鐘內就能回答前三個問題，不用憑印象。</p>`),
C.h3('② 定義問題','','寫成一句話'),
`<p>查完資料，問題變成：<b>「從 11/10 起，ST02 的 FAIL 率從約 2 % 升到 9.4 %，ST01 沒有變化。」</b>這句話已經排除了很多可能：產品品質變差的話，兩站都會變差。</p>`,
C.h3('③ 盤點線索','','從便宜的開始'),
C.table(['類型','例子','花費'],[
 ['📊 已經有的資料','依站、依測項、依時段、依作業員分開看；量測值的分布；探針計數','幾分鐘，不影響產線'],
 ['🔧 小實驗','golden sample 連測、把 FAIL 的板子拿到另一站重測、A/B 對調一個零件','十幾分鐘到一小時，可能要借用產線'],
 ['⚠ 動手改','換治具、重灌程式、改參數','花時間，而且可能引入新問題']
]),
`<p>原則：<b>先看資料，再做實驗，最後才動手</b>。資料是免費的，而且不會改變現場；一開始就動手換東西，換了之後問題消失，你也不知道是哪一個動作修好的。</p>`,
C.h3('④ 假設與驗證','','輪到你了'),
`<p>下面是你可以做的事，每一件都標了大約要花多久。照你認為的順序做，覺得有把握了就選原因。<b>試著用最少的時間找到原因，而且要有證據。</b></p>`,
{fn:detective},
ask('「把 FAIL 的板子拿到 ST01 重測」和「DMM 對調」都是 A/B 對調，各自證明了什麼？',
 `<p>板子換到別站就好了 → 問題跟著「站」，不跟著「板子」。DMM 對調之後問題沒跟著 DMM 走 → 不是 DMM。A/B 對調的精神是：<b>一次只換一樣東西，看問題跟著誰走</b>。同時換兩樣，問題消失了也不知道是哪一個。</p>`),
ask('golden sample 在 ST02 連測 20 次，3 次 FAIL。這個結果為什麼這麼有力？',
 `<p>同一片板子不會一下好一下壞。結果會跳，就證明是<b>量測路徑</b>的問題（接觸、接線、儀器），而不是產品。再加上量測值的分布「偶爾少 0.1 V」（2 A × 約 0.05 Ω），探針接觸電阻就是最可能的原因；探針計數 18 萬次、超過壽命，證據就齊了。</p>`),
warn('不要用放寬上下限來「解決」','把 T03 下限從 4.85 改成 4.80，FAIL 率會下降，主管也許會很高興。但真的輸出偏低的壞板子也被放過了，而且這是品保核准的規格。除錯是找到原因、修掉原因，不是讓數字變好看。'),
C.h3('⑤ 修正','','一次只改一件事'),
`<p>只換 ST02 負載輸出的探針（不要順便換 DMM、順便更新程式）。換完先用 golden sample 連測 20 次，確認不再跳，再讓產線繼續。</p>`,
C.h3('⑥ 確認修好，並防止再發','','用數字說話'),
`<p>修好不是「感覺好了」，是 FAIL 率回到原來的水準，而且維持住。兩個預防措施：</p>
<ol><li><b>探針計數</b>（W10 講過）：每一根探針累計次數，到 90 % 壽命時提醒換。這次的問題，如果有計數就不會發生。</li>
<li><b>FAIL 率警報</b>：每一站各自算「最近 50 片的 FAIL 率」，超過 5 % 就通知工程師。問題剛出現就會被看到，而不是等到主管打電話。</li></ol>`,
{steps:{title:'FailRate.vi：最近 50 片的 FAIL 率',lv:fv,steps:[
 {t:'每一片的結果變成 0 或 1',view:'split',add:['p','quit','wl','cond','wq','res','b01','w1'],h:`<p>測完一片就送進來一個 Boolean（FAIL ＝ True）。Boolean To (0,1)：FAIL 是 1、PASS 是 0。這樣「FAIL 幾片」就是把它們加起來。</p>`},
 {t:'只留最近 50 片',view:'split',add:['k0','sr','w0','ba','w2','w3','sz','w4','kN','sub','w5','w6','kz','mx','w7','w8','as','w9','w10','w11','w12'],h:`<p>和 W12 的 History.vi 一模一樣：Build Array 加到最後，超過 50 個就從後面取 50 個，存回 Shift Register。</p>`},
 {t:'FAIL 率和警報',view:'split',add:['sum','w13','sz2','w14','n','w17','div','w15','w16','k100','mul','w18','w19','rate','w20','k5','gt','w21','w22','alm','w23'],h:`<p>加總 ÷ 片數 × 100 ＝ FAIL 率 %。大於 5 就通知。用片數（而不是固定 50）當分母，剛開工還不滿 50 片時也算得對。</p>`},
 {t:'Run：模擬探針壞掉',view:'split',add:[],h:`<p>先用 2 % 跑一陣子：FAIL 率在 0～6 % 之間跳，偶爾超過 5 %。再改成 9 %：很快就一直亮。</p><p>偶爾亮一下要不要通知？2 % 的站，50 片裡剛好出現 3 片 FAIL 的機會並不小。實務上會要求「連續幾次超過」或把門檻設高一點：門檻太低，警報會被忽略（W11 的警報洗版）。門檻要和產線一起定。</p>`}
]}},
C.h3('⑦ 寫報告','','讓別人知道發生了什麼'),
C.table(['欄位','內容'],[
 ['問題','11/10 起 ST02 FAIL 率 2 % → 9.4 %，主要是 T03'],
 ['影響','約 40 片好板子被判 FAIL（已在 ST01 重測放行）；沒有壞板子被放過'],
 ['原因','ST02 負載輸出探針使用 18.2 萬次（壽命 10 萬），接觸電阻時好時壞，T03 偶爾少 0.1 V'],
 ['證據','依站、依測項的 FAIL 統計；T03 分布；golden sample 連測 20 次有 3 次跳；探針計數；探針外觀照片'],
 ['處理','更換 ST02 負載探針；golden sample 連測 20 次全部 PASS；之後 3 天 FAIL 率 2.0 %'],
 ['預防','加探針計數提醒（90 % 壽命）；每站加最近 50 片 FAIL 率警報'],
 ['沒有做的','沒有放寬上下限；沒有重灌程式']
]),
note('這一課用到的前面的東西','W6 的測試站和 golden sample、W9 的資料庫查詢、W10 的探針計數、W11 的警報門檻、W12 的「只留最近 N 筆」。除錯不是另一種技能，是把前面的東西反過來用：當初怎麼設計，出問題時就怎麼查。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'接到「測試站最近很多 FAIL」，第一步應該？',o:['查資料：哪一站、哪一項、從什麼時候、多少','重灌程式','換治具','放寬上下限'],a:0,ex:'先把問題講清楚。'},
 {q:'只有 ST02 FAIL 率變高，ST01 正常，最不可能的原因？',o:['產品這批品質變差','ST02 的治具','ST02 的接線','ST02 的儀器'],a:0,ex:'產品變差兩站都會變差。'},
 {q:'golden sample 連測 20 次有 3 次 FAIL，代表？',o:['量測路徑時好時壞','golden sample 壞了','上下限太嚴','程式有 bug'],a:0,ex:'同一片板子不會一下好一下壞。'},
 {q:'A/B 對調的原則？',o:['一次只換一樣，看問題跟著誰走','全部一起換最快','先換最貴的','換到問題消失為止'],a:0,ex:'同時換兩樣就不知道是誰。'},
 {q:'為了降低 FAIL 率把下限放寬，問題在哪？',o:['壞板子也會被放過，而且規格要品保核准','沒有問題','程式會變慢','作業員會抱怨'],a:0,ex:'除錯是修掉原因。'},
 {q:'怎麼確認真的修好了？',o:['golden sample 連測不再跳，之後幾天 FAIL 率回到原本水準','看起來好了就好','問作業員','重開機'],a:0,ex:'用數字確認。'},
 {q:'FailRate.vi 用片數當分母而不是固定 50，原因？',o:['剛開工不滿 50 片時也算得對','比較快','50 太大','LabVIEW 規定'],a:0,ex:'前幾片時陣列還不滿。'}
]}
]});
})();
