/* 實務案例 W19：把程式部署到產線電腦。
   職缺對照（docs/research_W19.md 第 8 節）：到工廠現場協助生產測試程式的驗證及導入、和產線一起解決程式錯誤和更新（104 摘要）；維護、修改程式（Y01、Y02）。
   重點：開發電腦上什麼都有，產線電腦上什麼都沒有；用乾淨電腦和作業員帳號先裝一次；設定檔放對地方；版本從 EXE 讀；換版要能退回；Windows 的更新、睡眠、USB 省電要和 IT 約好。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const FL=['Functions','Programming','File I/O'];
if(!LV.F['Get System Directory'])LV.F['Get System Directory']={g:'C:\\',ins:['system directory type'],outs:['path'],pal:[...FL,'File Constants','Get System Directory.vi']};
if(!LV.F['Check if File or Folder Exists'])LV.F['Check if File or Folder Exists']={g:'📄?',ins:['file path'],outs:['file or folder exists?'],pal:[...FL,'Advanced File Functions','Check if File or Folder Exists.vi']};
if(!LV.F['Create Folder'])LV.F['Create Folder']={g:'📁*',ins:['folder path','error in'],outs:['error out'],pal:[...FL,'Advanced File Functions','Create Folder']};
if(!LV.F['Copy'])LV.F['Copy']={g:'⧉',ins:['source path','target path','error in'],outs:['error out'],pal:[...FL,'Advanced File Functions','Copy']};
if(!LV.F['Strip Path'])LV.F['Strip Path']={g:'📁−',ins:['path'],outs:['stripped path','name'],pal:[...FL,'Strip Path']};

/* ---- 圖：裝到產線電腦，跑一個禮拜 ---- */
const DO=[
 {k:'A',t:'設定檔放哪裡',o:['和 EXE 一起放在 Program Files','ProgramData 自己的資料夾，程式第一次執行時自己建','ProgramData 自己的資料夾，安裝時（或 IT）建好，開放所有作業員帳號修改']},
 {k:'B',t:'安裝程式帶了什麼',o:['只有 EXE','EXE ＋ LabVIEW Run-Time','EXE ＋ Run-Time ＋ NI-VISA、DAQmx Runtime；燒錄工具另外列在部署清單']},
 {k:'C',t:'裝到產線之前怎麼試',o:['在自己的開發電腦上，用管理員帳號跑一次','找一台乾淨的電腦（沒裝 LabVIEW），用作業員帳號裝一次、跑一次']},
 {k:'D',t:'Windows 更新',o:['不管它（預設）','和 IT 約好：使用時段內不重開、更新排在停線時間、更新完跑一片 golden sample']},
 {k:'E',t:'電源設定',o:['預設','關掉睡眠和 USB 選擇性暫停']},
 {k:'F',t:'換版方式',o:['拿隨身碟把新版的檔案蓋過去','用安裝程式換版；舊版的安裝程式和設定檔備份留著','每一版的 EXE 放在自己的資料夾，捷徑指向目前的版本；設定檔備份留著']},
 {k:'G',t:'程式版本號',o:['寫死在畫面上的文字，換版時手動改','從 EXE 讀（建置時設定），寫進每一筆測試紀錄']}
];
function week(c){
  const E=[];let stop=0,caught=0;
  const ev=(day,bad,txt,hrs)=>{if(bad&&c.C===1&&day==='第 1 天'){caught++;E.push(['y','驗收時',txt+'：<b>在乾淨電腦上就發現了</b>，產線還沒開始用，改好再裝。']);}else{E.push([bad?'r':'g',day,txt]);if(bad)stop+=hrs;}};
  if(c.B===0)ev('第 1 天',true,'程式根本開不起來：產線電腦沒有 LabVIEW Run-Time',2);
  else if(c.B===1)ev('第 1 天',true,'程式開得起來，但找不到儀器：沒有 NI-VISA Runtime，VISA Open 回錯誤',2);
  else ev('第 1 天',false,'程式開得起來、MAX 看得到儀器、golden sample 跑一片 PASS',0);
  const fix=c.B<2&&c.C===0?'補裝之後，':'';
  if(c.A===0)ev('第 1 天',true,fix+'作業員按「儲存設定」，回錯誤：一般使用者不能寫 Program Files（在開發電腦用管理員帳號跑，永遠不會發現）',1);
  else if(c.A===1)ev(c.C===1?'第 1 天':'第 2 天',true,'早班的帳號第一次執行，程式建了資料夾和設定檔；晚班換另一個作業員帳號，按「儲存設定」回錯誤：自己建的資料夾和檔案，只有建立的那個帳號能改'+(c.C===1?'（驗收時用兩個作業員帳號各試一次才抓得到）':''),1);
  else ev('第 1 天',false,'設定檔、暫存上傳資料夾、log 都在 ProgramData，作業員帳號讀寫正常',0);
  ev('第 3 天凌晨',c.D===0,c.D===0?'Windows 更新自動重開機，正在跑的燒機（W12）中斷，8 小時白跑':'更新排在週日停線時間，週一早上跑一片 golden sample 確認',8);
  ev('第 4 天',c.E===0,c.E===0?'午休後第一片 ERROR：DMM 閒置太久，Windows 把它的 USB 埠關掉省電，連線斷了':'午休後第一片正常',0.5);
  E.push(['n','第 5 天','換新版 1.3.0。下午發現 1.3.0 的 T05 算錯了（W8 的那種回歸錯誤）']);
  if(c.F===0)ev('第 5 天',true,'要退回 1.2.0：舊版被蓋掉了，舊的檔案找不到，只能翻原始碼重新建置，產線停到晚上',4);
  else if(c.F===1){E.push(['y','第 5 天','解除 1.3.0、重裝 1.2.0 的安裝程式（升級碼相同，裝新版時舊版已經被自動移除，所以要重裝）、換回設定檔備份：每台約 40 分鐘，停線 0.7 小時']);stop+=0.7;}
  else{E.push(['g','第 5 天','改捷徑指向 1.2.0 的資料夾、換回設定檔備份：每台約 10 分鐘，停線 0.2 小時。前提是兩版的 EXE 都在電腦上，而且用同一版 Run-Time']);stop+=0.2;}
  ev('第 5 天',c.G===0,c.G===0?'品保問「1.3.0 測過哪些板子？」：畫面上的版本文字上週就忘了改，紀錄裡全是 1.2.0，查不出來，只能全部重測':'資料庫查 sw_ver ＝ 1.3.0，412 片，只重測這些',3);
  return {E,stop,caught};
}
function deployFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<div style="font-size:13px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 8px;align-items:center">${DO.map(o=>`<b>${o.k}. ${o.t}</b><select data-k="${o.k}" style="width:100%;min-width:0">${o.o.map((t,i)=>`<option value="${i}">${t}</option>`).join('')}</select>`).join('')}</div>
   <div data-o="out" style="font-size:13px;margin-top:8px"></div>`;
  function draw(){
    const c={};DO.forEach(o=>c[o.k]=+el.querySelector('[data-k='+o.k+']').value);
    const R=week(c);
    el.querySelector('[data-o=out]').innerHTML=`<p style="margin:4px 0">這一個禮拜：產線因為程式和電腦的問題停了 <b style="color:${R.stop?'#c0392b':'#1e7b34'}">${R.stop} 小時</b>${R.caught?`；有 <b>${R.caught}</b> 個問題在驗收時就抓到了`:''}。</p>`+
      R.E.map(([k,d,t])=>`<div style="border-left:3px solid ${k==='r'?'#c0392b':k==='y'?'#b9770e':k==='n'?'#888':'#1e7b34'};padding:2px 8px;margin:4px 0"><b>${d}</b>　${t}</div>`).join('');
  }
  el.querySelectorAll('select').forEach(s=>s.onchange=draw);draw();
}

/* ---- 一步一步寫：ConfigPath.vi ---- */
const cv={name:'ConfigPath.vi',view:'split',ratio:1.6,
 fp:{w:360,h:220,items:[
  {id:'first',k:'enum',ctl:true,label:'這台電腦（模擬用）',options:['第一次執行：ProgramData 裡還沒有設定檔','之後：設定檔已經在了'],x:12,y:8,v:0},
  {id:'cfg',k:'str',label:'config path',x:12,y:70,w:330},
  {id:'ex',k:'led',label:'原本就有？',color:'green',x:12,y:130},
  {id:'eo',k:'led',label:'error out 的 status',color:'red',x:150,y:130}]},
 bd:{w:1080,h:370,structs:[{id:'cs',k:'case',x:560,y:120,w:330,h:180,frames:['False','True'],cur:0}],
  nodes:[
  {id:'kty',k:'const',t:'enum',v:'Public Application Data',x:20,y:40},
  {id:'gsd',k:'fn',fn:'Get System Directory',x:200,y:40},
  {id:'kco',k:'const',t:'str',v:'MyCompany\\PM5Station',x:160,y:110},
  {id:'bp1',k:'fn',fn:'Build Path',x:330,y:50},
  {id:'kfn',k:'const',t:'str',v:'station.ini',x:330,y:130},
  {id:'bp2',k:'fn',fn:'Build Path',x:430,y:60},
  {id:'cfg',k:'ind',t:'path',label:'config path',x:980,y:66},
  {id:'chk',k:'fn',fn:'Check if File or Folder Exists',x:480,y:180},
  {id:'ex',k:'ind',t:'bool',label:'原本就有？',x:560,y:316},
  {id:'csel',k:'sel',t:'bool',s:'cs',y:196},
  {id:'tcfg',k:'tunnel',t:'path',s:'cs',side:'l',y:166},
  {id:'ad',k:'fn',fn:'Application Directory',x:600,y:230},
  {id:'ktp',k:'const',t:'str',v:'station_template.ini',x:600,y:270},
  {id:'bp3',k:'fn',fn:'Build Path',x:770,y:236},
  {id:'cp',k:'fn',fn:'Copy',x:840,y:150,h:44},
  {id:'te',k:'tunnel',t:'err',s:'cs',side:'r',y:170},
  {id:'eo',k:'ind',t:'err',label:'error out',x:980,y:166}],
  wires:[
  {id:'w1',from:'kty',to:'gsd',t:'enum'},
  {id:'w2',from:'gsd.path',to:'bp1.base path',t:'path',mx:310},
  {id:'w3',from:'kco',to:'bp1.name or relative path',t:'str',mx:310},
  {id:'w4',from:'bp1.appended path',to:'bp2.base path',t:'path',mx:410},
  {id:'w5',from:'kfn',to:'bp2.name or relative path',t:'str',mx:415},
  {id:'w6',from:'bp2.appended path',to:'cfg',t:'path'},
  {id:'w7',from:'bp2.appended path',to:'chk',t:'path',mx:470},
  {id:'w8',from:'chk.file or folder exists?',to:'csel',t:'bool'},
  {id:'w9',from:'chk.file or folder exists?',to:'ex',t:'bool',mx:540},
  {id:'w11',from:'bp2.appended path',to:'tcfg.o',t:'path',mx:530},
  {id:'w13',from:'ad.application directory',to:'bp3.base path',t:'path',mx:750},
  {id:'w14',from:'ktp',to:'bp3.name or relative path',t:'str',mx:755},
  {id:'w15',from:'bp3.appended path',to:'cp.source path',t:'path',mx:825},
  {id:'w16',from:'tcfg.i',to:'cp.target path',t:'path',pts:[[566,166],[590,166],[590,206],[815,206],[815,172],[840,172]]},
  {id:'w18',from:'cp.error out',to:'te.i',t:'err'},
  {id:'w19',from:'te.o',to:'eo',t:'err'}]},
 sim:{init:()=>({}),
  step(inp){
   const ex=+inp.first===1,p='C:\\ProgramData\\MyCompany\\PM5Station\\station.ini';
   return {out:{cfg:p,ex,eo:false},
    vals:{'gsd.path':'C:\\ProgramData','bp1.appended path':'C:\\ProgramData\\MyCompany\\PM5Station','bp2.appended path':p,'chk.file or folder exists?':ex,'ad.application directory':'C:\\Program Files\\PM5Station','bp3.appended path':'C:\\Program Files\\PM5Station\\station_template.ini'},
    msg:ex?'設定檔已經在了：Case 的 True 頁什麼都不做，直接用它（保留這台電腦自己的設定）。':'第一次執行：把程式資料夾裡的範本複製到安裝時建好的資料夾。之後作業員改的設定都存在這一份。'};},
  doneMsg:'換一種情況再 Run'}
};

L.push({id:'W19',order:30.999,no:'W19',part:PART,title:'部署到產線電腦：作業員點兩下就能用，換版退得回去，Windows 不會半夜把它弄壞',mins:65,files:['練習\\實務\\Station\\ConfigPath.vi'],
goals:[['學會','開發電腦和產線電腦差在哪；打包 EXE 和安裝程式要帶哪些東西（Run-Time、驅動、第三方工具）；設定檔、暫存資料夾、log 該放哪裡（ProgramData，不是 Program Files）；版本號從建置規格來、程式自己讀；換版留退路；Windows 更新、睡眠、USB 省電和 IT 約好；用乾淨電腦、作業員帳號先裝一次。'],['做出','在部署模擬上讓產線一個禮拜不停線；ConfigPath.vi：在 ProgramData 找設定檔，第一次執行時從範本複製。'],['為什麼是這個題目','測試職缺會寫「到工廠現場協助生產測試程式的驗證及導入」「和產線一起解決程式錯誤和更新」「維護、修改 LabVIEW 程式」。程式寫好只是一半：裝到十台產線電腦上、半年後還好好的，才算交差。']],
check:'不看課文，能列出安裝程式要帶的東西、說出設定檔為什麼不能放 Program Files、版本號從哪裡來、怎麼退回舊版，以及產線電腦要和 IT 約好的三件事。',
body:[
C.h3('這一課的工作','x','程式寫完之後'),
`<p>這一課以 A 廠 PM5 測試站的程式為例（W8 的 1.1.0 之後又改了一版，現在是 1.2.0）。W6～W18 的程式都在你的開發電腦上跑。開發電腦上什麼都有：LabVIEW 開發環境、所有驅動、管理員權限、你自己。產線電腦上什麼都沒有，用的人是作業員，而且你不在旁邊。這一課講的是<b>把程式交出去</b>。</p>`,
C.h3('① 聽懂需求','','產線主管的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「新的 6 台測試站電腦到了，你去裝。以前換版都是拿隨身碟去每一台複製 VI，還有人直接在產線上改程式，結果每一台版本都不一樣。這次要弄乾淨。」</p></div>`,
ask('「每一台版本都不一樣」會造成什麼問題？要先決定哪些事？',
 `<p>同一個產品，在 ST01 PASS、在 ST02 FAIL，不知道是板子的問題還是程式不一樣；客訴時查不出那一片是用哪一版測的（W14、W9）；有人在產線上改程式，改了什麼沒有紀錄（W8）。</p>
 <p>要先決定：</p><ol><li>產線電腦上<b>只放執行檔</b>（EXE），不放原始碼、不裝開發環境，沒有人能在產線上改程式。</li>
 <li>安裝程式要帶哪些東西，寫成部署清單。</li>
 <li>設定檔、資料、log 放哪裡。</li>
 <li>版本號怎麼產生、怎麼記錄。</li>
 <li>換版的流程，和出事時怎麼退回。</li>
 <li>Windows 的更新、睡眠這些設定，由誰管。</li></ol>`),
C.h3('② 規格','','部署清單和檔案位置'),
C.table(['編號','部署清單'],[
 ['D1','EXE 和安裝程式（版本號，例如 1.2.0）'],
 ['D2','LabVIEW Run-Time Engine 2018，<b>位元數和開發時一樣</b>（32 或 64 位元）'],
 ['D3','NI-VISA Runtime、NI-DAQmx Runtime（用到哪個帶哪個，寫版本號）；要不要 NI MAX（W6 的先驗證儀器會用到）'],
 ['D4','第三方工具：燒錄工具（W18）、條碼槍驅動，各自的版本。安裝程式不會自動帶這些'],
 ['D5','設定檔範本（建置規格裡設成 Always Included，EXE 旁邊才會有）'],
 ['D7','ProgramData 裡的資料夾由安裝程式或 IT 建立，開放 Users 群組「修改」並往下繼承（例如 <code>icacls</code> 的 (OI)(CI)M）；<b>程式不自己建</b>'],
 ['D6','安裝後驗收步驟（⑥）']
]),
C.table(['放哪裡','放什麼','誰可以改'],[
 ['<code>C:\\Program Files\\PM5Station\\</code>','EXE、設定檔範本','只有安裝程式（一般使用者不能寫）'],
 ['<code>C:\\ProgramData\\MyCompany\\PM5Station\\</code>','這一台的設定檔（儀器位址、MES 網址）、暫存上傳資料夾（W9、W17）、log','程式（作業員帳號執行）'],
 ['伺服器','正式的 limits.csv（品保核准，W6）、發行清單和韌體（W18）','核准的人'],
 ['（不要放）','桌面、文件、隨身碟','—']
]),
ask('為什麼設定檔不能和 EXE 一起放在 Program Files？',
 `<p>Windows 不讓一般使用者寫 Program Files 底下的檔案。你在開發電腦上用管理員帳號跑，存設定一切正常；裝到產線電腦、作業員帳號登入，一按「儲存設定」就回錯誤。<b>這個問題在你的電腦上永遠不會發生</b>，所以一定要用作業員帳號試。</p>
 <p>ProgramData 是給「全機共用的程式資料」用的，但權限有陷阱：</p><ul><li>安裝程式建出來的資料夾，可能只有管理員能寫。</li><li>程式自己（用作業員帳號）建的資料夾和檔案，<b>只有建立的那個帳號能改</b>，其他帳號只能讀。產線一班一個帳號時，早班建的設定檔，晚班存不了。</li></ul><p>所以 D7：資料夾由安裝程式或 IT 建好，開放所有使用者修改、往下繼承。程式只負責「設定檔不在時，從範本複製一份」（下面的 ConfigPath.vi）。</p>`),
C.h3('③ 盤點','','打包工具'),
C.table(['建置規格','做什麼','注意'],[
 ['Application (EXE)','把 VI 編成執行檔；用到的 SubVI、儀器驅動的 VI 都編進去','要 Application Builder：Professional 版內含，Base／Full 版要另外買。先在專案的 Build Specifications 按右鍵，看有沒有 New ▸ Application (EXE)'],
 ['Installer','把 EXE 和需要的 NI 軟體包成安裝程式','Additional Installers 頁勾 Run-Time、VISA、DAQmx；自動挑選只會挑 NI 的東西'],
 ['Version Information','Major．Minor．Patch．Build 四個數字','可以勾每次建置自動加 Build；建完要存專案。輸出資料夾的路徑放 <code>[VersionNumber]</code>，每一版各自一個資料夾']
]),
note('沒有 Application Builder 也能學','這一課大部分的內容（設定檔位置、版本、換版、Windows 設定、驗收）和打包工具無關。學校的授權沒有 Application Builder，就先把 ConfigPath.vi 和部署清單做好。'),
C.h3('④ 先在部署模擬上試','','裝上去，跑一個禮拜'),
`<p>每一個選項都是實際會遇到的選擇。全部用預設的第一個選項試一次，看這一個禮拜發生什麼事；再一項一項改。目標：停線越少越好。注意 C：有些問題躲不掉，但可以在<b>驗收時</b>就發現，而不是在產線上。</p>`,
{fn:deployFig},
ask('C 為什麼這麼重要？它又不會讓任何問題消失。',
 `<p>它讓問題提早出現。缺 Run-Time、缺 VISA、沒有寫入權限，這三個問題在開發電腦上<b>永遠看不到</b>：開發電腦裝了 LabVIEW（就有 Run-Time 和驅動），你用管理員帳號。找一台乾淨的電腦、用作業員的帳號裝一次，半小時就全部現形，改好再上產線。不這樣做，同樣的問題會在 6 台產線電腦上、作業員面前一起發生。</p>`),
ask('F 和 G 都是換版的事，為什麼在模擬裡要分開？',
 `<p>F 管「退不退得回去」：新版有問題時，多快能回到上一版。用安裝程式換版，舊版已經被移除，要重裝；每一版的 EXE 各放一個資料夾，改捷徑就好，但前提是兩版都在電腦上、用同一版 Run-Time。G 管「查不查得到」：新版測過的板子有哪些、要不要重測。兩件事都和 W8 一樣：改程式之前先留退路、改了什麼要有紀錄。</p>
 <p>版本號手打在畫面上，遲早有人忘了改。從 EXE 讀（建置規格裡設的那個號碼），每一筆測試紀錄自動帶上（W9 的 sw_ver、W17 上傳 MES），就不會錯。</p>`),
C.h3('⑤ 寫程式','','ConfigPath.vi'),
`<p>程式一開始呼叫它，拿到這台電腦的設定檔路徑。第一次在這台電腦執行時，設定檔還不存在：從程式資料夾裡的範本複製一份到安裝時建好的資料夾（D7）。之後作業員改的設定都存在這一份，換版也不會被蓋掉。</p>`,
{steps:{title:'ConfigPath.vi：ProgramData 裡的設定檔，沒有就從範本複製',lv:cv,steps:[
 {t:'組出路徑',view:'split',add:['first','kty','gsd','w1','kco','bp1','w2','w3','kfn','bp2','w4','w5','cfg','w6'],h:`<p>${fn('Programming','File I/O','File Constants','Get System Directory.vi')} 選 <b>Public Application Data</b>，在 Windows 上就是 <code>C:\\ProgramData</code>。不要把 <code>C:\\ProgramData</code> 寫死：用函式問系統，換一台電腦、換一種 Windows 都對。</p><p>Build Path 兩次：公司\\程式名稱的資料夾，再加檔名。</p>`},
 {t:'在不在？',view:'split',add:['chk','w7','ex','w9','csel','w8','cs'],h:`<p>Check if File or Folder Exists：在的話，Case 的 True 頁什麼都不做（用這台電腦原本的設定）。不在的話走 False 頁。</p>`},
 {t:'第一次：複製範本',view:'split',add:['tcfg','w11','ad','ktp','bp3','w13','w14','cp','w15','w16','te','w18','eo','w19'],h:`<p>範本放在程式資料夾：Application Directory 在 EXE 裡回傳 EXE 所在的資料夾；在開發環境裡，VI 在專案中回傳專案的資料夾，不在專案中回傳 VI 所在的資料夾。範本檔在建置規格裡要設成 Always Included，EXE 旁邊才會有。</p><p>Copy 還有一個 overwrite 輸入，預設 False：目的地已經有檔案時不會蓋掉，剛好保護作業員的設定。</p><p><b>為什麼不先 Create Folder？</b>資料夾已經存在時，Create Folder 會回錯誤；更重要的是，程式自己建的資料夾只有建立的帳號能改（②）。資料夾由安裝程式或 IT 建好（D7）。資料夾不在，Copy 會回錯誤：錯誤線接出去，畫面顯示「部署不完整，請通知工程師」，不要讓程式在沒有設定檔的情況下繼續跑。True 頁的錯誤通道設 Use Default If Unwired。</p>`},
 {t:'Run',view:'split',add:[],h:`<p>兩種情況各 Run 一次。第二次執行時什麼都不複製：這很重要，否則每次開程式，作業員的設定都被範本蓋回去。</p>`}
]}},
note('程式讀自己的版本','畫面的「關於」和每一筆測試紀錄的版本，用 vi.lib 裡的 FileVersionInfo.vi 讀正在執行的 EXE（路徑用 Application 屬性的 Directory Path 和 Name 組出來）。在開發環境裡沒有 EXE 可以讀：用 App.Kind 屬性判斷：<b>等於 Run Time System</b> 時才去讀 EXE 的版本，其他情況都顯示「開發版」（試用版、學生版的開發環境，App.Kind 不一定是 Development System，所以不要反過來判斷），這樣開發時測出來的資料也不會被當成正式版本。'),
C.h3('⑥ 驗收和換版','','交機文件'),
C.table(['項次','驗收（每一台都做）','預期'],[
 ['V1','乾淨電腦、作業員帳號，照部署清單安裝','裝完不用再補任何東西'],
 ['V2','MAX 看得到每一台儀器（W6）','名稱、位址和設定檔一致'],
 ['V3','golden sample 跑 3 片','結果和開發電腦一致'],
 ['V4','用<b>兩個不同的</b>作業員帳號，各改一個設定、存檔、重開程式','兩個帳號都存得了，設定還在'],
 ['V5','拔網路線測 3 片，再接回（W9、W17）','產線沒停；接回後補傳'],
 ['V6','重開機','程式自動啟動（或桌面捷徑清楚）；儀器連得上'],
 ['V7','照退回流程，退到上一版再升回來','時間在換版計畫寫的範圍內，設定檔沒壞']
]),
C.table(['步驟','換版流程'],[
 ['1','新版在備用測試站跑回歸測試（W8）和 GR&R（W6）'],
 ['2','品保、產線主管核准；換版時間排在停線時間'],
 ['3','換版前：舊版的安裝程式（<code>[VersionNumber]</code> 資料夾）和每一台的設定檔備份留著'],
 ['4','換版後：每一台跑一片 golden sample；第一天看前 100 片的良率'],
 ['5','出事時退回，兩種做法擇一，寫進換版計畫：<br>(a) 用安裝程式換版：安裝程式的升級碼相同時，裝新版會自動移除舊版，所以退回要<b>解除新版、重裝舊版的安裝程式</b>（安裝程式通常不讓舊版蓋新版，在你的版本上先試過）。<br>(b) 不用安裝程式換 EXE：Run-Time 和驅動用安裝程式裝一次，每一版的 EXE 放在自己的資料夾，捷徑指向目前的版本，退回只要改捷徑。兩版要用同一版 Run-Time'],
 ['6','設定檔和資料只增不刪：新版加的設定欄位，舊版要能忽略（W11 的 version 欄位）；否則退回舊版時讀不懂新的設定檔']
]),
C.h3('⑦ 產線電腦的設定','','和 IT 約好'),
C.table(['項目','問題','做法'],[
 ['Windows 更新','自動重開機，燒機（W12）或測到一半的程式被關掉','<b>不要自己關掉更新</b>（資安不允許）。和 IT 約好：使用時段內不重開、更新排在停線時間、更新完跑 golden sample'],
 ['睡眠、螢幕保護','長時間測試時電腦睡著','插電時不睡眠（<code>powercfg</code> 或 IT 的群組原則）'],
 ['USB 選擇性暫停','USB 儀器閒置一陣子被 Windows 關掉，下一片 ERROR','電源選項裡停用 USB 選擇性暫停'],
 ['防毒','掃描讓寫檔變慢（W12）；EXE 被誤判刪除','只對程式和資料夾做小範圍排除，由 IT 設定、寫進部署文件'],
 ['多個 Run-Time','燒錄站和測試站是不同年份的 LabVIEW 建的','主版本或位元數不同的 Run-Time 可以並存；同一年的 SP1 會取代原本的版本。部署清單寫清楚各要哪一版']
]),
note('這一課用到的前面的東西','W6 的 MAX 驗證和 golden sample、W8 的回歸測試和變更說明、W9 和 W17 的暫存上傳資料夾、W11 的設定檔 version 欄位、W12 的電腦設定和寫檔、W14 用版本查問題、W18 的第三方工具。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'設定檔應該放在？',o:['ProgramData 底下自己的資料夾','Program Files，和 EXE 一起','桌面','隨身碟'],a:0,ex:'一般使用者不能寫 Program Files。'},
 {q:'為什麼要找一台乾淨的電腦、用作業員帳號先裝一次？',o:['開發電腦上什麼都有，缺東西和權限問題只有在乾淨電腦上才看得到','比較快','IT 規定','可以省授權'],a:0,ex:'讓問題在驗收時就出現。'},
 {q:'安裝程式的「自動挑選建議元件」會幫你帶什麼？',o:['NI 的元件（Run-Time、驅動）；第三方工具要自己列','所有用到的東西','只有 EXE','什麼都不帶'],a:0,ex:'燒錄工具這類要寫進部署清單。'},
 {q:'程式的版本號應該？',o:['在建置規格設定，程式自己從 EXE 讀，寫進每一筆紀錄','手打在畫面上','寫在檔名','不用版本號'],a:0,ex:'手打遲早會忘了改。'},
 {q:'換版前一定要留下的？',o:['舊版的安裝程式和每一台的設定檔備份','什麼都不用','新版的原始碼','作業員名單'],a:0,ex:'出事時才退得回去。'},
 {q:'Windows 更新半夜重開機，正確的做法？',o:['和 IT 約好更新時間和使用時段，更新完跑 golden sample','自己把更新關掉','拔網路線','不管它'],a:0,ex:'資安不允許自己關掉更新。'},
 {q:'ConfigPath.vi 第二次執行時，為什麼不能再複製範本？',o:['會把這台電腦的設定蓋掉','會變慢','會出錯','範本會不見'],a:0,ex:'只有設定檔不在時才複製；Copy 的 overwrite 預設也是 False。'},
 {q:'USB 儀器午休後第一片 ERROR，可以先檢查哪一個 Windows 設定？',o:['USB 選擇性暫停','螢幕解析度','時區','語言'],a:0,ex:'閒置的 USB 裝置可能被關掉省電；它是可能原因之一，不是唯一的。'},
 {q:'程式用作業員帳號在 ProgramData 自己建的設定檔，換另一個作業員帳號會？',o:['可能只能讀、不能存','完全正常','看不到檔案','自動變成管理員'],a:0,ex:'所以資料夾要在安裝時建好、開放權限。'}
]}
]});
})();
