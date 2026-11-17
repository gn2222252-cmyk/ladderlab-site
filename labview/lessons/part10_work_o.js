/* 實務案例 W18：燒錄站。PM5 v2 板上多了一顆 MCU，韌體要在產線燒進去，每一片都要查得到燒的是哪一版。
   職缺對照（docs/review_W17.md 附錄）：Y09「規劃並導入燒錄流程、韌體版本控管、寫燒錄 SOP、熟悉燒錄工具和治具」。
   重點：LabVIEW 呼叫別人的程式（System Exec）；燒錄成功要靠好幾道判斷，不能只看一個；燒對檔案、燒進去了、板子真的跑起來，是三件事。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
if(!LV.F['Match Regular Expression'])LV.F['Match Regular Expression']={g:'.*',ins:['input string','regular expression'],outs:['before match','whole match','after match','offset past match'],w:56,pal:['Functions','Programming','String','Match Regular Expression']};
if(!LV.F['Greater Or Equal To 0?'])LV.F['Greater Or Equal To 0?']={p:'≥0',a:1,pal:['Functions','Programming','Comparison','Greater Or Equal To 0?']};
if(!LV.F['Less Than 0?'])LV.F['Less Than 0?']={p:'<0',a:1,pal:['Functions','Programming','Comparison','Less Than 0?']};

/* ---- 圖：燒錄站的六道關卡 ---- */
const CK=[
 ['H','燒錄前比對檔案的 SHA256（和發行清單）',0.3],
 ['N','用工具的非互動參數（不會跳對話框）',0],
 ['V','寫入後讓工具讀回比對（-v）',4],
 ['R','看 return code ＝ 0',0],
 ['T','看輸出文字：有成功字樣、沒有 Error',0],
 ['B','重開後用 UART 問版本（VER?），和清單比對',3]
];
const CASES=[
 {t:'正常',good:true},
 {t:'燒錄線接觸不良，連不上 MCU'},
 {t:'發行資料夾裡的檔案被人換成舊版 2.2.0'},
 {t:'快閃記憶體有一格壞了，寫進去的和檔案不一樣'},
 {t:'燒錄命令包在 .bat 裡，結束碼被後面的命令蓋掉；這一片線沒接好'},
 {t:'燒錄工具跳出視窗等人按（例如 J-Link 在 Windows 上的提示視窗）'},
 {t:'燒完、驗證都過，但板子不開機（治具把 BOOT0 腳拉高，或晶振沒焊）'}
];
function judge(i,c){
  // 每一個情境在各道關卡看到什麼
  const S=[
   {},
   {rc:1,text:'Error: No STM32 target found!',rb:'old'},
   {hash:1,rb:'2.2.0'},
   c.V?{rc:1,text:'Error: Data mismatch found at address …',rb:'2.3.1',vf:1}:{rb:'2.3.1',latent:1},
   {text:'Error: No STM32 target found!',rb:'old'},
   c.N?{rc:1,text:'Error: …（不跳視窗，印出錯誤就結束）',rb:'old'}:{hang:1},
   {rb:'none'}
  ][i];
  if(S.hang)return {v:'卡住',why:'工具跳出對話框等人按，System Exec 沒有逾時，整個測試站停在那裡'};
  const why=[];
  if(c.H&&S.hash)why.push('雜湊和清單不符，不燒');
  if(c.R&&S.rc)why.push('return code '+S.rc);
  if(c.T&&S.text)why.push('輸出有「'+S.text+'」');
  if(c.B&&S.rb&&S.rb!=='2.3.1')why.push(S.rb==='none'?'問版本沒有回應':S.rb==='old'?'讀回的是舊版或空白':'讀回 '+S.rb+'，不是 2.3.1');
  return why.length?{v:'FAIL',why:why.join('；')}:{v:'PASS',why:S.latent?'沒有寫入後驗證：壞的那一格平常用不到，板子照樣開機回報 2.3.1。出貨後某天跑到那一段程式才出事':S.vf?'工具驗證失敗了，但站沒看 return code 和輸出，照樣重開；板子跑的是幾乎完整的新韌體，回報 2.3.1':''};
}
function flashFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<div style="font-size:13px">${CK.map(([k,t,s])=>`<label style="display:block"><input type="checkbox" data-k="${k}"> ${k}. ${t}${s?`（每片 +${s} 秒）`:''}</label>`).join('')}</div>
   <div data-o="out" style="font-size:13px;overflow-x:auto"></div>`;
  function draw(){
    const c={};CK.forEach(([k])=>c[k]=el.querySelector('[data-k='+k+']').checked);
    let esc=0,hang=0;
    const rows=CASES.map((cs,i)=>{const r=judge(i,c);const ok=cs.good?r.v==='PASS':r.v==='FAIL';if(!cs.good&&r.v==='PASS')esc++;if(r.v==='卡住')hang++;
      const col=r.v==='卡住'?'#b9770e':ok?'#1e7b34':'#c0392b';
      return `<tr><td>${cs.t}</td><td style="color:${col};font-weight:700">${r.v}</td><td>${cs.good?'PASS':'FAIL'}</td><td>${r.why||''}</td></tr>`;}).join('');
    const sec=8+CK.reduce((a,[k,,s])=>a+(c[k]?s:0),0);
    el.querySelector('[data-o=out]').innerHTML=`<table class="tbl" style="margin-top:6px"><tr><th>這一片的情況</th><th>站的判定</th><th>應該是</th><th>站看到了什麼</th></tr>${rows}</table>
     <p style="margin:4px 0">壞板子被判 PASS：<b style="color:${esc?'#c0392b':'#1e7b34'}">${esc}</b> 種　測試站卡住：<b style="color:${hang?'#b9770e':'#1e7b34'}">${hang}</b> 種　每片約 <b>${sec.toFixed(1)}</b> 秒（燒錄本身 8 秒）</p>`;
  }
  el.querySelectorAll('input').forEach(s=>s.onchange=draw);draw();
}

/* ---- 一步一步寫：Flash.vi ---- */
const CASE=['正常','燒錄線沒接好','驗證失敗（快閃記憶體壞）','包在 .bat 裡，結束碼被蓋掉（線沒接好）'];
const OUT=[
 '…\nFile download complete\n…\nDownload verified successfully',
 'Error: No STM32 target found!',
 '…\nFile download complete\n…\nError: Data mismatch found at address 0x08004A20\nDownload verification failed',
 'Error: No STM32 target found!'];
const fv={name:'Flash.vi',view:'split',ratio:1.5,
 fp:{w:360,h:330,items:[
  {id:'cs',k:'enum',ctl:true,label:'這一片的情況（模擬用）',options:CASE,x:12,y:8,v:0},
  {id:'tool',k:'str',ctl:true,label:'tool（燒錄工具的完整路徑）',x:12,y:60,w:330,v:'C:\\Program Files\\STMicroelectronics\\STM32Cube\\STM32CubeProgrammer\\bin\\STM32_Programmer_CLI.exe'},
  {id:'fw',k:'str',ctl:true,label:'fw（發行資料夾裡的韌體）',x:12,y:110,w:330,v:'\\\\fileserver\\release\\PM5\\PM5FW_2.3.1.bin'},
  {id:'txt',k:'str',label:'standard output ＋ standard error（字樣是示意）',x:12,y:160,w:330,h:80},
  {id:'rc',k:'num',label:'return code',x:12,y:262,w:50},
  {id:'ok',k:'led',label:'燒錄 OK',color:'green',x:120,y:262}]},
 bd:{w:1260,h:340,structs:[],
  nodes:[
  {id:'kf',k:'const',t:'str',v:'"%s" -c port=SWD mode=UR -w "%s" 0x08000000 -v -rst',x:20,y:20},
  {id:'tool',k:'ctl',t:'str',label:'tool',x:20,y:80},
  {id:'fw',k:'ctl',t:'str',label:'fw',x:20,y:140},
  {id:'fis',k:'fn',fn:'Format Into String',ins:['format string','input 1','input 2'],x:415,y:70,h:56},
  {id:'kT',k:'const',t:'bool',v:true,x:420,y:190,label:'wait until completion?'},
  {id:'sx',k:'sub',name:'System Exec.vi（Connectivity ▸ Libraries & Executables）',icon:['SYS','EXEC'],ins:['command line','wait until completion?'],outs:['standard output','standard error','return code'],x:500,y:80,w:64,h:90,color:'#5a6b7d'},
  {id:'cat',k:'fn',fn:'Concatenate Strings',ins:['string 0','string 1'],x:630,y:80},
  {id:'txt',k:'ind',t:'str',label:'輸出文字',x:720,y:20},
  {id:'kok',k:'const',t:'str',v:'verified successfully',x:700,y:64},
  {id:'mr1',k:'fn',fn:'Match Regular Expression',x:870,y:110,h:56},
  {id:'ker',k:'const',t:'str',v:'Error:',x:740,y:250},
  {id:'mr2',k:'fn',fn:'Match Regular Expression',x:870,y:220,h:56},
  {id:'ge',k:'fn',fn:'Greater Or Equal To 0?',x:960,y:150},
  {id:'lt',k:'fn',fn:'Less Than 0?',x:960,y:260},
  {id:'rc',k:'ind',t:'i32',label:'return code',x:640,y:300},
  {id:'eq',k:'fn',fn:'Equal To 0?',x:960,y:60},
  {id:'a1',k:'fn',fn:'And',x:1040,y:100},
  {id:'a2',k:'fn',fn:'And',x:1100,y:170},
  {id:'ok',k:'ind',t:'bool',label:'燒錄 OK',x:1180,y:176}],
  wires:[
  {id:'w1',from:'kf',to:'fis.format string',t:'str',mx:400},
  {id:'w2',from:'tool',to:'fis.input 1',t:'str',mx:395},
  {id:'w3',from:'fw',to:'fis.input 2',t:'str',mx:400},
  {id:'w4',from:'fis.resulting string',to:'sx.command line',t:'str'},
  {id:'w5',from:'kT',to:'sx.wait until completion?',t:'bool',mx:480},
  {id:'w6',from:'sx.standard output',to:'cat.string 0',t:'str'},
  {id:'w7',from:'sx.standard error',to:'cat.string 1',t:'str',mx:600},
  {id:'w8',from:'cat.concatenated string',to:'txt',t:'str',mx:690},
  {id:'w9',from:'cat.concatenated string',to:'mr1.input string',t:'str',mx:690},
  {id:'w10',from:'kok',to:'mr1.regular expression',t:'str',mx:855},
  {id:'w11',from:'cat.concatenated string',to:'mr2.input string',t:'str',mx:690},
  {id:'w12',from:'ker',to:'mr2.regular expression',t:'str',mx:855},
  {id:'w13',from:'mr1.offset past match',to:'ge',t:'i32',mx:940},
  {id:'w14',from:'mr2.offset past match',to:'lt',t:'i32',mx:940},
  {id:'w15',from:'sx.return code',to:'rc',t:'i32',mx:600},
  {id:'w16',from:'sx.return code',to:'eq',t:'i32',pts:[[574,155],[574,46],[940,46],[940,76],[960,76]]},
  {id:'w17',from:'eq.out',to:'a1.x',t:'bool',mx:1020},
  {id:'w18',from:'ge.out',to:'a1.y',t:'bool',mx:1020},
  {id:'w19',from:'a1.out',to:'a2.x',t:'bool',mx:1080},
  {id:'w20',from:'lt.out',to:'a2.y',t:'bool',mx:1080},
  {id:'w21',from:'a2.out',to:'ok',t:'bool'}]},
 sim:{init:()=>({}),
  step(inp){
   const n=+inp.cs||0,txt=OUT[n],rc=[0,1,1,0][n];
   const okS=txt.indexOf('verified successfully')>=0,er=txt.indexOf('Error:')>=0,ok=rc===0&&okS&&!er;
   return {out:{txt,rc,ok},
    vals:{'fis.resulting string':'"C:\\…\\STM32_Programmer_CLI.exe" -c port=SWD … -v -rst','sx.return code':rc,'mr1.offset past match':okS?'≥ 0':-1,'mr2.offset past match':er?'≥ 0':-1,'eq.out':rc===0,'ge.out':okS,'lt.out':!er,'a1.out':rc===0&&okS,'a2.out':ok},
    msg:(ok?'三個條件都成立：燒錄 OK（接著還要讀回版本）。':'燒錄失敗：'+[rc!==0?'return code '+rc:'',!okS?'找不到成功字樣':'',er?'輸出有 Error':''].filter(Boolean).join('、')+'。')+(n===3?' 注意 return code 是 0：只看它就會判成功。':'')};},
  doneMsg:'換一種情況再 Run'}
};

L.push({id:'W18',order:30.998,no:'W18',part:PART,title:'燒錄站：把韌體燒進每一片板子，燒對、燒進去、跑得起來，還要查得到',mins:70,files:['練習\\實務\\Station\\Flash.vi','練習\\實務\\Station\\release.csv'],
goals:[['學會','用 System Exec.vi 呼叫別人的命令列工具；路徑加引號、非互動參數、沒有逾時的風險；燒錄成功要看好幾道：檔案雜湊、寫入後驗證、return code、輸出文字、重開後讀回版本；故意做失敗的實驗，把工具的行為記下來；發行清單和韌體版本控管；每一片記下燒了什麼。'],['做出','在燒錄站模擬上選出最少的關卡，讓七種情況都判對、不卡住；Flash.vi：組命令、執行、依 return code 和輸出文字判斷。'],['為什麼是這個題目','車用和電子產品的測試職缺會寫「規劃並導入燒錄流程」「韌體版本控管」「撰寫燒錄 SOP」「熟悉燒錄工具和治具」。燒錯一版韌體，整批產品都要召回重燒；查不出哪幾片燒錯，就只能全部召回。']],
check:'不看課文，能說出 System Exec 的三個輸出、為什麼不能只看 return code、為什麼燒完還要讀回版本、發行清單的用途，以及每一片要記錄哪些東西。',
body:[
C.h3('這一課的工作','x','LabVIEW 去指揮別人的程式'),
`<p>前面的課，LabVIEW 都是直接和儀器講話。燒錄不一樣：燒錄器的廠商會給一個<b>命令列工具</b>，LabVIEW 要做的是呼叫它、等它做完、讀它說了什麼，再判斷成功還是失敗。很多產線的工作都是這樣：別人的工具、你的流程。</p>`,
tip('練習檔','下載：<a href="work/release.csv" download>release.csv</a>。release.csv 是 W18 的發行清單範例：status 是 active 的那一版才能燒；SHA256 是範例值，實際要算你手上的韌體檔。'),
C.h3('① 聽懂需求','','RD 經理的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「PM5 v2（在 v1.1 的基礎上）板上多了一顆 STM32，韌體要在產線燒。以前都是 RD 自己用燒錄軟體的視窗一片一片點，現在量產了要一個燒錄站：作業員只能掃序號、按開始，不能自己選檔案。韌體一個月會改一兩版。客戶問起來，要能查出每一片燒的是哪一版。」</p></div>`,
ask('至少列出五個要回去問的問題。',
 `<ol><li><b>用什麼工具燒？</b>燒錄器型號、命令列工具的名稱和版本、怎麼接到板子（SWD、UART）。</li>
 <li><b>韌體檔從哪裡來？</b>誰發行、放在哪裡、怎麼知道哪一版是正式的？</li>
 <li><b>工單怎麼指定版本？</b>同一個料號可能同時有兩版在出貨（不同客戶）。</li>
 <li><b>燒完怎麼確認？</b>板子有沒有辦法回報自己的版本（例如 UART 送 <code>VER?</code>）？</li>
 <li><b>燒錯了怎麼辦？</b>可以重燒嗎？要不要記錄？</li>
 <li><b>換版的流程</b>：誰核准、什麼時候生效、舊版什麼時候不能再燒？</li>
 <li><b>節拍</b>：一片可以花幾秒？（W16）</li></ol>`),
C.h3('② 寫成規格','','燒錄站規格'),
C.table(['編號','規格'],[
 ['BF1','韌體只從唯讀的發行資料夾拿。<code>release.csv</code> 一列一版：料號、版本、檔名、SHA256、核准人、生效日。發行資料夾在網路上，本機留一份快取：網路斷時只能用快取裡雜湊相符、清單上仍有效的版本；快取也沒有就停'],
 ['BF2','工單指定版本；燒之前算檔案的 SHA256，和清單比對，不符就不燒（ERROR，通知工程師）。LabVIEW 2018 沒有內建 SHA256：用 System Exec 執行 Windows 內建的 <code>certutil -hashfile 檔案 SHA256</code>'],
 ['BF3','用命令列工具，參數一律寫在設定檔；一定要用<b>非互動</b>參數，並開寫入後驗證'],
 ['BF4','PASS 要同時成立：return code ＝ 0、輸出有成功字樣、輸出沒有 <code>Error:</code>（只找 Error 會被檔名或路徑裡的字誤判）'],
 ['BF5','燒完<b>斷電再上電</b>（有些 MCU 第一次燒完只做軟體重開，會停在晶片內建的開機程式，好板子被誤判），UART 送 <code>VER?</code>，回應要等於工單指定的版本；10 秒沒回應判 FAIL'],
 ['BF6','每一片記錄（W9 的資料庫，並上傳 MES，W17）：test_id、序號、版本、SHA256、工具和版本、燒錄器序號、MCU 的唯一 ID、讀回的設定位元組（option bytes）、return code、輸出的前幾行、讀回的版本、秒數'],
 ['BF7','換版：RD 發行、品保核准後才更新 release.csv；舊版標「停用」，不刪（追溯要用）'],
 ['BF8','重燒：連不上（No target）可以重壓治具再燒，最多 2 次；寫入後驗證失敗不能重燒，判 FAIL 送修，原因記下來']
]),
C.h3('③ 盤點','','System Exec.vi'),
`<p>${fn('Connectivity','Libraries & Executables','System Exec.vi')}：執行一個命令列，等它結束，把它輸出的文字和結束碼交回來。</p>`,
C.table(['端子','意思','注意'],[
 ['command line','要執行的命令，和在命令提示字元打的一樣','路徑有空白要加<b>雙引號</b>；執行檔不在 PATH 裡就寫完整路徑'],
 ['working directory','執行時的目前資料夾','不能拿它來找執行檔；工具會在這裡寫暫存檔或 log 時要設'],
 ['wait until completion?','預設 True：等它結束才往下','要拿到輸出和結束碼就要等'],
 ['standard output／standard error','工具印出來的文字','有些工具把錯誤印在 standard error（例如 esptool 新版），兩個都要看'],
 ['return code','工具自己回的結束碼，通常 0 是成功','和 LabVIEW 的 error out 是兩回事：工具失敗，error out 不一定有錯']
]),
warn('System Exec 沒有逾時','它只會一直等。燒錄工具如果跳出一個視窗等人按，測試站就永遠停在那裡。各工具的脾氣不同：STM32CubeProgrammer 的命令列版遇到燒錄器韌體太舊，會印出錯誤就結束；J-Link 在 Windows 上可能跳出提示視窗，要用它的命令把視窗關掉（查手冊）。第一次接手一個工具時，先試試看它什麼情況會跳視窗。真的需要逾時，簡單的做法：讓工具把輸出寫到檔案，System Exec 不等（wait until completion? 接 False），另一個迴圈計時，超過時間就用 <code>taskkill</code> 結束它，再讀檔案。進階做法是 .NET 的 Process 類別（WaitForExit 給毫秒，超過就 Kill），但同時讀它的輸出時要照微軟文件的寫法，不然會互相卡住。'),
C.table(['常見工具','命令的樣子（示意，以手冊和 -h 為準）','寫入後驗證'],[
 ['STM32CubeProgrammer CLI','<code>STM32_Programmer_CLI -c port=SWD mode=UR -w 檔案.bin 0x08000000 -v -rst</code>','<code>-v</code>'],
 ['SEGGER J-Link Commander','<code>JLink.exe -device 型號 -if SWD -speed 4000 -CommanderScript prog.jlink</code>','命令檔裡寫驗證的命令；Windows 上可能跳視窗，要用命令關掉'],
 ['esptool（ESP32）','<code>esptool --port COM5 write-flash 0x0 檔案.bin</code>','寫入後自動用 MD5 比對'],
 ['Microchip IPECMD','<code>ipecmd.exe -?</code> 列出全部參數','看安裝目錄裡的說明檔']
]),
C.h3('④ 先做失敗的實驗','','把工具的脾氣記下來'),
`<p>工具的手冊通常寫了「成功時印什麼」，但「各種失敗時回什麼結束碼、印什麼」很少寫清楚。寫判斷邏輯之前，先在命令提示字元裡<b>故意讓它失敗</b>，一條一條記下來：</p>`,
C.table(['實驗','做法','記下來'],[
 ['E1','正常燒一次','return code、輸出的最後幾行（成功字樣）、花幾秒'],
 ['E2','拔掉燒錄線再燒','return code、錯誤字樣'],
 ['E3','給一個不存在的檔名','同上'],
 ['E4','給一個錯的檔案（例如別的產品的韌體）','有沒有擋下來？'],
 ['E5','燒到一半拔掉燒錄線','return code、板子變成什麼狀態、能不能重燒'],
 ['E6','把命令包在 .bat 裡，再做一次 E2','.bat 回的結束碼，和直接執行一樣嗎？']
]),
`<p>這張表就是你寫判斷邏輯的依據，也要放進燒錄 SOP。換工具版本時，重做一次。</p>`,
ask('E6 為什麼要做？',
 `<p>常見的情況：有人把燒錄命令寫進一個 .bat，LabVIEW 呼叫 .bat。燒錄那一行後面如果還有別的命令（例如 <code>copy</code> 一份 log 到網路資料夾），.bat 回給 LabVIEW 的是<b>最後執行的那個命令</b>的結束碼：copy 成功了，<b>燒錄失敗，return code 還是 0</b>。（不是每一種命令都會蓋掉：例如 <code>echo</code> 不會改變結束碼。所以要做實驗，不要猜。）</p>
 <p>解法：燒錄那一行的<b>緊接下一行</b>就把結束碼存起來（<code>set RC=%errorlevel%</code>），最後 <code>exit /b %RC%</code>；或乾脆不要包 .bat，直接呼叫工具。</p>
 <p>還有更麻煩的：工具自己的結束碼也不一定可靠。ST 的社群有人回報，STM32CubeProgrammer 的命令列版在連線中斷、驗證錯誤時也回 0。這就是為什麼 BF4 不只看 return code，還要看輸出文字。</p>`),
C.h3('⑤ 每一道關卡擋什麼','','在燒錄站模擬上試'),
`<p>下面列出七種實際會遇到的情況，和六道可以加的檢查。先全部不勾，看看會怎樣；再一道一道加上去，找出<b>最少要哪幾道</b>，七種情況才全部判對、測試站也不會卡住。每一道都要花時間，右下角是每片的秒數。</p>`,
{fn:flashFig},
ask('哪一種情況只有「重開後讀回版本」抓得到？',
 `<p>「燒完、驗證都過，但板子不開機」。檔案對、寫進去的也和檔案一樣，工具回報一切成功，但板子根本沒跑起來（例如治具的 BOOT0 腳被拉高，MCU 開機進了晶片內建的開機程式；或晶振沒焊）。<b>燒對檔案、燒進去了、板子跑得起來，是三件不同的事</b>，要分別確認：雜湊管第一件，寫入後驗證管第二件，讀回版本管第三件。</p>
 <p>讀回版本也順便抓到「檔案被換成舊版」：就算沒做雜湊比對，板子報 2.2.0 就知道不對。但那時已經燒下去了；雜湊比對在燒之前就擋下來，而且會告訴你是<b>發行資料夾</b>出了問題，整條線都要停下來查。</p>`),
ask('「快閃記憶體壞了一格」為什麼沒開 -v 時會被判 PASS？讀回版本不是也做了嗎？',
 `<p>壞的那一格可能在平常用不到的地方（例如某個很少跑的功能）。板子照樣開機、照樣回報 2.3.1，所有檢查都過了，出貨之後某一天跑到那一段程式才出事。只有<b>寫入後把整個內容讀回來比對</b>（-v）抓得到。多花 4 秒，換掉一個出貨後才會發生、而且很難查的問題。</p>`),
ask('最少要哪幾道？規格為什麼 H、R、T 三道都要？',
 `<p>模擬裡最少是 N、V、B，再加 R 或 T 其中一道。少了 R 和 T，「驗證失敗」那一片站根本不知道失敗，照樣重開，板子跑的是幾乎完整寫進去的新韌體，回報 2.3.1，就被放過了：<b>V 開了，也要有人看它的結果</b>。</p>
 <p>但規格三道都要，因為判對不等於夠用：</p>
 <ul><li><b>R 和 T 都要</b>：結束碼可能被 .bat 蓋掉，工具自己也有失敗時回 0 的回報；輸出文字的字樣也可能隨工具版本改變。兩個一起看，任一個說失敗就是失敗。</li>
 <li><b>它們告訴你原因</b>：「No target found」是接觸問題，作業員重壓治具再燒一次就好（BF8）；驗證失敗是板子的問題，要送修，不能一直重燒。只有 B 的話，作業員只知道「不對」。而且 B 要斷電、上電、等 10 秒逾時才知道失敗。</li>
 <li><b>H 在燒之前就擋</b>：檔案被換掉時，沒有 H，每一片都會燒成舊版、讀回 2.2.0、判 FAIL、重燒、又 FAIL，一直到有人發現。有 H，第一片就停下來，而且直接指出是<b>發行資料夾</b>出問題，整條線都要停下來查。</li></ul>
 <p>檢查不只是為了判 PASS／FAIL，也是為了出事時<b>馬上知道是哪裡出事</b>。這和 W14「每一筆都留證據」是同一件事。</p>`),
C.h3('⑥ 寫程式','','Flash.vi'),
{steps:{title:'Flash.vi：組命令 → 執行 → 三個條件',lv:fv,steps:[
 {t:'組出命令',view:'split',add:['cs','kf','tool','fw','fis','w1','w2','w3'],h:`<p>Format Into String 把工具路徑和韌體路徑放進命令裡。格式字串裡兩個 %s 外面都加了<b>雙引號</b>：<code>C:\\Program Files\\…</code> 有空白，不加引號，命令列會在空白處斷開。程式本身的路徑，Windows 有時還猜得到（但如果有人在 C:\\ 放了一個 Program.exe，就會執行到錯的程式）；後面的<b>參數</b>（例如韌體檔的路徑）有空白就一定會被拆成兩段，工具收到的是錯的檔名。兩個都加引號。</p><p>工具路徑、參數、韌體路徑都從設定檔和 release.csv 來（BF1、BF3），不要寫死在程式裡。作業員只掃序號，程式從工單查出要燒哪一版。</p>`},
 {t:'System Exec',view:'split',add:['kT','sx','w4','w5','rc','w15'],h:`<p>wait until completion? 接 True：等工具結束，才拿得到輸出和 return code。等的這段時間 LabVIEW 什麼都不能做（這個 VI 卡在這裡），所以它要放在燒錄站自己的流程裡，畫面用另一個迴圈更新。</p>`},
 {t:'兩個輸出合起來看',view:'split',add:['cat','w6','w7','txt','w8'],h:`<p>standard output 和 standard error 接成一個字串：有的工具把錯誤印在 standard error，只看 standard output 會漏掉。這段文字也要存進紀錄（BF6 存前幾行），出問題時才有東西查。</p>`},
 {t:'三個條件都要成立',view:'split',add:['kok','mr1','w9','w10','ker','mr2','w11','w12','ge','w13','lt','w14','eq','w16','a1','w17','w18','a2','w19','w20','ok','w21'],h:`<p>Match Regular Expression 找不到時，offset past match 是 −1。所以：</p><ul><li>return code ＝ 0（Equal To 0?）</li><li>找得到成功字樣：offset ≥ 0</li><li>找不到 <code>Error:</code>：offset &lt; 0（帶冒號，避免檔名或路徑裡剛好有 Error 這幾個字）</li></ul><p>三個 And 起來才是「燒錄 OK」。成功字樣和錯誤字樣用 ④ 實驗記下來的那幾句，不要用自己猜的：這個模擬的輸出文字只是示意，實際的字樣會隨工具和版本不同。</p><p>這只是燒錄這一步。之後還有重開、讀回版本（BF5）：用 W6、I 單元的 VISA 送 <code>VER?</code>。</p>`},
 {t:'Run：四種情況',view:'split',add:[],h:`<p>依序選四種情況 Run。最後一種：包在 .bat 裡，結束碼被後面的命令蓋掉，return code 是 0，但輸出有 <code>Error:</code>：只看 return code 就會判成功。</p>`}
]}},
C.h3('⑦ 記錄和換版','','韌體版本控管'),
`<p>職缺寫的「韌體版本控管」，在產線上就是兩件事：<b>燒之前</b>只能燒核准過的那一版（BF1、BF2、BF7），<b>燒之後</b>每一片都查得到燒了什麼（BF6）。</p>`,
C.table(['欄位','例子','為什麼要記'],[
 ['序號、test_id','PM5-26120015、FL01-20261117-000088','和 W9 的測試紀錄、W17 的 MES 對得起來'],
 ['版本、SHA256','2.3.1、9f2c…','客訴時查「這一片是哪一版」；檔案名稱相同但內容不同時，靠雜湊分辨'],
 ['工具和版本、燒錄器序號','STM32_Programmer_CLI 2.x、燒錄器 #3','某一台燒錄器有問題時，找出它燒過的板子'],
 ['return code、輸出前幾行、讀回版本、秒數','0、Download verified…、2.3.1、15.3','失敗時不用重現就能先看原因；秒數變長是燒錄器或接觸變差的徵兆（W14）']
]),
ask('客戶說「2.3.0 有一個 bug，你們出給我的板子哪些是 2.3.0？」你要多久能回答？',
 `<p>有 BF6 的紀錄：一句 SQL（W9），幾分鐘。沒有紀錄：只能把庫存和客戶手上的全部收回來一片一片讀版本。</p>
 <p>反過來，換版的那一天最容易出錯：有人把新版檔案放進資料夾，但清單還沒核准；或工單還指定舊版。BF7 規定清單由品保核准才更新、舊版標停用不刪，就是為了讓「那一天到底燒了什麼」查得清楚。</p>`),
note('燒錄 SOP 要寫什麼','職缺常要求寫燒錄 SOP。內容就是這一課的東西：用哪一個工具和版本、命令和參數（設定檔）、④ 的失敗實驗表、BF4 的判斷條件、失敗怎麼處理（可以重燒幾次、什麼情況要叫工程師）、換版流程（BF7）。作業員看的是操作步驟；工程師看的是後面這些。'),
note('這一課用到的前面的東西','W6 的測試站流程和 VISA 讀版本、W8 的版本和變更說明、W9 的資料庫和 test_id、W14 的「每一筆都留證據」、W16 的節拍、W17 的上傳 MES。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'System Exec.vi 的 return code 是什麼？',o:['被呼叫的程式自己回的結束碼','LabVIEW 的錯誤碼','執行了幾秒','輸出的行數'],a:0,ex:'和 error out 是兩回事。'},
 {q:'命令裡的路徑有空白，要怎麼辦？',o:['用雙引號把路徑包起來','把空白刪掉','改用 working directory','不能有空白'],a:0,ex:'否則會在空白處斷開。'},
 {q:'為什麼不能只看 return code？',o:['有些情況失敗了它還是 0（例如包在 .bat 裡）','它不準','它是隨機的','LabVIEW 讀不到'],a:0,ex:'還要看輸出文字。'},
 {q:'燒錄工具跳出對話框，System Exec 會？',o:['一直等，測試站卡住','自動按確定','逾時回錯誤','自動關掉'],a:0,ex:'它沒有逾時；要用非互動參數。'},
 {q:'燒完、驗證都過，為什麼還要重開讀回版本？',o:['確認板子真的跑起來了','比較快','讓作業員看','法規規定'],a:0,ex:'燒進去和跑得起來是兩件事。'},
 {q:'燒之前比對 SHA256 的目的？',o:['確認燒的是核准過的那個檔案','加快燒錄','加密','壓縮'],a:0,ex:'檔名一樣，內容可能不一樣。'},
 {q:'工具的失敗行為手冊沒寫清楚，應該？',o:['自己故意做失敗的實驗，記下結束碼和輸出','照猜的寫','只判成功字樣','問作業員'],a:0,ex:'這張表也放進 SOP。'},
 {q:'舊版韌體停用後，release.csv 裡那一列應該？',o:['標停用，不刪','刪掉','改成新版','移到別的資料夾就好'],a:0,ex:'追溯還要用。'}
]}
]});
})();
