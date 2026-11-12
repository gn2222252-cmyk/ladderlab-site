/* CLAD 部分的「動手寫 LabVIEW」補充：C07 Reentrancy 示範。在 part5_clad_* 之後載入。 */
(function(){
const L=window.LESSONS,fn=C.fn,qd=C.qd,wt=C.wt;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
function addTo(id,items){const l=L.find(x=>x.id===id);if(!l)return;const i=l.body.findIndex(b=>typeof b==='string'&&b.includes('小測驗'));l.body.splice(i<0?l.body.length:i,0,...items);}

const slow=(id,x,y)=>({id,k:'sub',name:'Slow.vi',top:'SUB',icon:['WAIT','500'],ins:['ms'],outs:['花了 ms'],x,y,w:50,h:42,tip:'自己做的 SubVI：裡面只有 Tick Count → Wait (ms) → Tick Count 相減'});
const c07={name:'Reentrant_Demo.vi',view:'split',ratio:1.6,
 fp:{w:300,h:240,items:[
  {id:'re',k:'btn',mech:'switch',style:'toggle',label:'（模擬）Slow.vi 設成 reentrant',x:16,y:20},
  {id:'n1',k:'num',label:'迴圈 1 跑了幾圈',x:16,y:80,w:70},
  {id:'p1',k:'num',label:'迴圈 1 每圈 ms',x:150,y:80,w:70},
  {id:'n2',k:'num',label:'迴圈 2 跑了幾圈',x:16,y:140,w:70},
  {id:'p2',k:'num',label:'迴圈 2 每圈 ms',x:150,y:140,w:70},
  {id:'stop',k:'btn',mech:'switch',label:'stop',text:'STOP',stop:true,x:16,y:196}]},
 bd:{w:520,h:290,structs:[{id:'wl1',k:'while',x:40,y:20,w:440,h:115,name:'迴圈 1'},{id:'wl2',k:'while',x:40,y:160,w:440,h:115,name:'迴圈 2'}],
  nodes:[
  {id:'k1',k:'const',t:'i32',v:500,x:70,y:52},
  slow('s1',120,40),
  {id:'p1',k:'ind',t:'i32',label:'迴圈 1 每圈 ms',x:240,y:51},
  {id:'i1',k:'iter',s:'wl1'},
  {id:'n1',k:'ind',t:'i32',label:'迴圈 1 跑了幾圈',x:120,y:100},
  {id:'stop',k:'ctl',t:'bool',label:'stop',x:360,y:103},
  {id:'c1',k:'stop',s:'wl1'},
  {id:'k2',k:'const',t:'i32',v:500,x:70,y:192},
  slow('s2',120,180),
  {id:'p2',k:'ind',t:'i32',label:'迴圈 2 每圈 ms',x:240,y:191},
  {id:'i2',k:'iter',s:'wl2'},
  {id:'n2',k:'ind',t:'i32',label:'迴圈 2 跑了幾圈',x:120,y:240},
  {id:'lv',k:'local',t:'bool',v:'stop',x:360,y:234},
  {id:'c2',k:'stop',s:'wl2'}],
  wires:[
  {id:'w1',from:'k1',to:'s1.ms',t:'i32'},
  {id:'w2',from:'s1.花了 ms',to:'p1',t:'i32'},
  {id:'w3',from:'i1',to:'n1',t:'i32',mx:100},
  {id:'w4',from:'stop',to:'c1',t:'bool'},
  {id:'w5',from:'k2',to:'s2.ms',t:'i32'},
  {id:'w6',from:'s2.花了 ms',to:'p2',t:'i32'},
  {id:'w7',from:'i2',to:'n2',t:'i32',mx:100},
  {id:'w8',from:'lv',to:'c2',t:'bool'}]},
 sim:{period:250,init:()=>({t:0,n1:0,n2:0,f1:1000,f2:1500}),
  step(inp,st){const re=!!inp.re;st.t+=250;
   /* reentrant：兩個各自 500 ms 一圈；non-reentrant：同一份 Slow.vi 輪流用，各自 1000 ms 一圈（迴圈 2 晚 500 ms） */
   const per=re?500:1000;if(st.t>=st.f1){st.n1++;st.f1=st.t+per;}if(st.t>=st.f2){st.n2++;st.f2=st.t+per;}const n1=st.n1,n2=st.n2;
   return {out:{n1,n2:Math.max(0,n2),p1:per,p2:per},vals:{k1:500,k2:500,'s1.花了 ms':per,'s2.花了 ms':per,i1:n1,i2:Math.max(0,n2),stop:!!inp.stop,lv:!!inp.stop},stop:!!inp.stop,keep:['stop'],
    msg:re?'reentrant：兩個迴圈各用自己的一份 Slow.vi，同時等，每圈 500 ms':'non-reentrant：記憶體裡只有一份 Slow.vi，一個在用另一個就排隊，每圈變成 1000 ms'};},
  finish(){return {out:{stop:false}};},doneMsg:'兩個迴圈都停了（stop 用 Switch 機械動作，才能用 Local Variable 讀）'}
};
addTo('C07',[
C.h3('做','b','動手：親眼看 non-reentrant 怎麼拖慢兩個迴圈'),
C.plan({start:'兩個 VI：先做 <code>Slow.vi</code>（一個 SubVI），再做 <code>Reentrant_Demo.vi</code> 呼叫它兩次。',
 in:'Slow.vi 的輸入「ms」（I32，要等幾毫秒）；輸出「花了 ms」（I32，實際花了多久）。',
 calc:'Slow.vi 裡面：Tick Count → Wait (ms) → Tick Count，兩個 Tick Count 相減。用 error 線或 Flat Sequence 保證三個的順序（資料流沒有連起來的話，LabVIEW 不保證誰先）。',
 out:'主程式前面板：兩個迴圈各自的圈數和每圈 ms。<b>數字才會說話</b>：光看「好像比較慢」說服不了人。',
 loop:'兩個 While Loop 平行，每圈都呼叫 Slow.vi（500）。理論上兩個都是 500 ms 一圈。',
 end:'一個 stop 按鈕停兩個迴圈：按鈕的機械動作改成 Switch When Pressed，迴圈 2 用 Local Variable 讀（Latch 按鈕不能建立 Local Variable）。'}),
{steps:{title:'C07：同一個 SubVI，兩個迴圈同時呼叫',lv:c07,steps:[
 {t:'先做 Slow.vi',view:'bd',add:['wl1','k1','s1','w1'],h:`<p>新 VI：前面板一個 Numeric Control「ms」、一個 Numeric Indicator「花了 ms」，都改 I32。方塊圖 Tick Count → ${fn('Programming','Timing','Wait (ms)')} → Tick Count，相減接到「花了 ms」。</p><p>右上角圖示上按右鍵 ▸ <b>Show Connector</b>，選 4-2-2-4，點端子再點控制元件，把「ms」接左邊、「花了 ms」接右邊。存檔 <code>Slow.vi</code>。</p><p>回到新的主程式，${fn('Select a VI...')} 把 Slow.vi 放進迴圈 1，輸入接常數 500。</p>`},
 {t:'迴圈 1 的顯示和停止',view:'split',add:['p1','w2','i1','n1','w3','stop','c1','w4','re'],h:`<p>「花了 ms」和 i 各建一個 Indicator。stop 按鈕：右鍵 ▸ Mechanical Action ▸ <b>Switch When Pressed</b>（下一步要用 Local Variable）。</p>`},
 {t:'迴圈 2：複製一份',view:'split',add:['wl2','k2','s2','w5','p2','w6','i2','n2','w7','lv','c2','w8'],h:`<p>選起整個迴圈 1，按住 <kbd>Ctrl</kbd> 拖出一份，刪掉複製出來的 stop，改放 stop 的 ${fn('Programming','Structures','Local Variable')}（右鍵 ▸ Change To Read）。</p><p>兩個迴圈之間沒有任何線：LabVIEW 會讓它們<b>同時</b>跑。</p>`},
 {t:'Run，然後改 Slow.vi 的設定',view:'split',add:[],h:`<p>Run：兩個迴圈每圈都是 <b>1000 ms</b>，不是 500。因為 Slow.vi 預設 non-reentrant，記憶體裡只有一份，一個迴圈在用，另一個只能等。</p><p>停下來，打開 Slow.vi ▸ File ▸ <b>VI Properties ▸ Execution</b>，Reentrancy 選 <b>Preallocated clone reentrant execution</b>，存檔，再 Run：兩個都變 500 ms。網頁上用左邊的「（模擬）reentrant」開關切換。</p>`}
]}},
ask('如果 Slow.vi 裡用 Shift Register 記「被呼叫過幾次」（FGV），改成 reentrant 後，兩個迴圈看到的次數會怎樣？',
 `<p>Preallocated clone：每個呼叫位置一份，各數各的，迴圈 1、迴圈 2 各自從 1 開始數，<b>不再是共用的計數</b>。FGV 就是靠「只有一份」才能讓大家共用同一份資料，所以 FGV 一定要 non-reentrant。速度和共用，要哪一個，取決於這個 SubVI 是拿來做什麼的。</p>`)
]);
})();
