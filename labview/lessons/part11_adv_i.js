/* 高階實務 H9：LabVIEW 和 Git。VI 是二進位檔，版本控制要怎麼做。
   證據（docs/research_git.md）：明寫 Git 的只有兩則國外資深職缺；台灣只見「版本管理」（Y33、Y09），Git／SVN 0 則。所以定位是：
   「版本紀錄的紀律」人人要會；Git、分支、審查、CI 是資深的工具。
   實測（2026-11-18）：
   - Git 2.56 暫存庫：git diff 對 VI 只顯示「Binary files ... differ」；.lvproj 是 XML，預設逐行 diff，標 binary 後也變成 Binary；
     兩個分支改同一個 VI，git merge 回「Cannot merge binary files」並標示衝突。
   - LabVIEW CLI（本機 LabVIEW 2026）的 CreateComparisonReport：比較 H5 GPD_VOUT_To_Number 的第一版（git 歷史 fa878dd）和修正版；
     預設報告列出新增的 Greater Than 0?、And，加上一堆「moved」；加 -nobdcosm -nofppos 後只剩兩個新增節點和接線改變（說明標籤的修改也被當成外觀而濾掉）。
     圖片 img/adv/h9_*.png 是報告附的方塊圖（課程自己的 VI）。
   - 「只存原始碼」（Separate compiled code）的效果 LadderLab 沒有實測：lvkit 拿不到 VI 參考，無法用腳本設定；內容照 NI 說明（鏡像，二手）。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='高階實務';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary><div class="ans">${a}</div></details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const term=s=>`<pre style="background:#1e1e1e;color:#e8e8e8;padding:8px 10px;border-radius:4px;white-space:pre-wrap;font-size:12px">${s}</pre>`;

/* ---- 哪些檔案放進版本庫 ---- */
const FILES=[
 {f:'Main.vi、Judge_Limit.vi、Oven State.ctl',in:true,why:'原始碼，當然要放。'},
 {f:'PM5 Station.lvproj',in:true,why:'NI 建議放進去：連結、專案設定、建置規格都存在裡面。但它是 XML，要標成 binary，避免 Git 自動合併出壞檔；最好由一個人改。'},
 {f:'PSU.lvclass、PSU_Sim.lvclass、Drivers.lvlib',in:true,why:'原始碼（類別和函式庫的定義）。同樣是 XML，標成 binary。'},
 {f:'PM5 Station.aliases、PM5 Station.lvlps',in:false,why:'LabVIEW 自動產生，每台電腦都不一樣，換一台電腦打開專案就變。GitHub 的 LabVIEW .gitignore 範本把它們排除。'},
 {f:'builds\\PM5Station.exe、installer\\',in:false,why:'建置產物：可以從原始碼和建置規格重新產生。版本用 tag 標記（W19 的版本號），安裝程式另外存到發行資料夾。'},
 {f:'Documents\\LabVIEW Data\\VIObjCache\\',in:false,why:'只存原始碼後，編譯碼放在這個快取，每台電腦自己會產生；它也不在專案資料夾裡。'},
 {f:'station_template.ini（設定檔範本）',in:true,why:'程式需要它（W19 第一次執行時複製），屬於原始碼的一部分。'},
 {f:'ProgramData 裡每一台站自己的 station.ini',in:false,why:'每一台的設定不一樣，是那台電腦的資料，不是原始碼（W19）。範本放版本庫、各站的實際設定另外備份。'},
 {f:'廠商給的 DLL（例如燒錄工具的 SDK）',in:true,why:'程式要用它，而且你不能自己產生，所以要放（或用套件管理記錄版本）。注意 GitHub 的 LabVIEW 範本預設排除 *.dll，要把那一行拿掉。'},
 {f:'H5 的 results 檔、每天的測試 log',in:false,why:'執行產生的資料，不是原始碼；版本庫只放「怎麼產生它的程式」。發行時的測試結果另外存進發行紀錄（H5、H8）。'}
];
function filesFig(el){
  el.className='fig';el.style.cssText='border:1px solid #d9cfe8;border-radius:6px;padding:10px 12px;background:#fbf9ff;font-size:13px';
  el.innerHTML=`<p style="margin:0 0 6px">PM5 測試站的資料夾裡有這些東西。勾選你認為<b>要放進 Git 版本庫</b>的：</p>
   ${FILES.map((x,i)=>`<label style="display:block;margin:3px 0"><input type="checkbox" data-i="${i}"> ${x.f}</label>`).join('')}
   <button data-a="chk" style="margin-top:6px">對答案</button><div data-o="out" style="margin-top:8px"></div>`;
  el.querySelector('[data-a=chk]').onclick=()=>{
    let ok=0;
    const rows=FILES.map((x,i)=>{const on=el.querySelector(`[data-i="${i}"]`).checked,g=on===x.in;if(g)ok++;
      return `<div style="border-left:3px solid ${g?'#1e7b34':'#c0392b'};padding:2px 8px;margin:5px 0"><b style="color:${g?'#1e7b34':'#c0392b'}">${g?'✓':'✗'}</b> ${x.f}：<b>${x.in?'放':'不放'}</b><details style="color:#444"><summary style="cursor:pointer;color:#1d4fa0">為什麼</summary>${x.why}</details></div>`;});
    el.querySelector('[data-o=out]').innerHTML=`<p style="margin:0 0 4px">對了 ${ok} / ${FILES.length} 個。</p>`+rows.join('');
  };
}

L.push({id:'H9',order:48,no:'H9',part:PART,title:'LabVIEW 和 Git：VI 是二進位檔，改了什麼、誰改的、怎麼不互相蓋掉',mins:60,files:[],
goals:[['學會','為什麼 VI 在 Git 裡看不出改了什麼、合併不了；「只存原始碼」是什麼、在哪裡設、什麼時候不能用；怎麼看兩版 VI 差在哪（Compare VIs、LVCompare、CLI 的差異報告）；.gitignore 和 .gitattributes 要寫什麼；多人怎麼避免同時改同一個 VI；把 W8、H3、H5、W19、H8 串成一個提交的流程'],
 ['工作上','版本紀錄的紀律（改了什麼、為什麼、哪一版上線）每個工程師都要有；Git、分支、審查、CI 是資深職缺寫的工具。明寫 Git 的職缺目前只看到國外的'],
 ['用到','W8（接手、第一次提交原封不動、回歸）、W19（版本號）、H3（審查）、H5（commit 前跑測試）、H8（報告寫程式版本）']],
check:'不看課文，能說出：git diff 對 VI 顯示什麼；為什麼 .lvproj 要標 binary；「只存原始碼」解決什麼問題、哪種 VI 不能用；差異報告的 -nobdcosm 會濾掉什麼；兩個人改了同一個 VI 時 Git 會怎樣、要怎麼避免。',
body:[
C.h3('這一課的工作','x','測試站的程式要進 Git'),
`<p>W8 你接手了舊程式，用「有日期的資料夾」管版本。現在團隊有三個人改同一個測試站的程式，主管要求放進公司的 Git。你很快發現三件事：Git 看不出 VI 改了哪裡；改一個 SubVI，十幾個 VI 都變成「有變更」；兩個人同一天改了同一個 VI，合併不了。</p>`,
note('為什麼有這一課（資料來源）','助理整理的職缺裡，明寫 Git 的只有兩則國外的資深職缺；台灣的資料裡 Git、SVN 都是 0 則，只有「版本管理」（PLC 參數和程式版本、韌體版本）。所以這一課的重點是「版本紀錄的紀律」，Git 是做到它的工具。整理在 docs/research_git.md。'),
C.h3('① VI 在 Git 裡長什麼樣子','','LadderLab 實際跑的'),
`<p>把 H5 的 GPD_VOUT_To_Number.vi 第一版放進一個 Git 版本庫，換成修正後的版本，再下 <code>git diff</code>：</p>`,
term('$ git diff -- GPD_VOUT_To_Number.vi\ndiff --git a/GPD_VOUT_To_Number.vi b/GPD_VOUT_To_Number.vi\nindex 5ea2881..7a5e39e 100644\nBinary files a/GPD_VOUT_To_Number.vi and b/GPD_VOUT_To_Number.vi differ'),
`<p>Git 只知道「變了」（5802 → 6018 bytes），不知道變了什麼。再讓兩個分支都改這個 VI，然後合併：</p>`,
term('$ git merge alice\nwarning: Cannot merge binary files: GPD_VOUT_To_Number.vi (HEAD vs. alice)\nCONFLICT (content): Merge conflict in GPD_VOUT_To_Number.vi\nAutomatic merge failed; fix conflicts and then commit the result.'),
`<p>Git 合併不了，只能選一邊的版本，另一個人的修改要<b>手動重做</b>。所以 LabVIEW 的版本控制，重點在「不要讓兩個人同時改同一個 VI」和「看得到改了什麼」。</p>`,
C.h3('② 只存原始碼：不要讓沒改的 VI 也「有變更」','','Separate compiled code'),
`<p>VI 檔預設同時存著原始碼（面板、方塊圖）和編譯碼。改了一個 SubVI，呼叫它的 VI 都要重新編譯，LabVIEW 就把它們標成「有變更」；存檔後，Git 看到一堆檔案變了，可是原始碼根本沒改。設成<b>只存原始碼</b>後，編譯碼改存到每台電腦自己的快取（Documents\\LabVIEW Data\\VIObjCache），只有真正改過的 VI 會變。</p>`,
C.table(['範圍','在哪裡設','注意'],[
 ['單一 VI','VI Properties ▸ General ▸ Separate compiled code from source file','—'],
 ['之後所有新檔','Tools ▸ Options ▸ Environment ▸ Separate compiled code from new files','只影響<b>新建的</b>檔案'],
 ['專案的新項目','Project Properties ▸ Separate compiled code from new project items','<b>不影響已經存在的檔案</b>'],
 ['專案裡已有的檔案','同一頁的 Mark Existing Items','接手舊專案時要用這個（W8 已修正說明）']
]),
warn('不能用的時候','要在 Run-Time Engine 執行的 VI 不要設（Run-Time 讀不到快取）；含 Express VI 或 Statechart 的方塊圖不能分開。這一節的內容照 NI 的說明（非官方鏡像，二手）；LadderLab 的自動化工具沒辦法設定這個 VI 屬性，所以<b>沒有實測</b>。你可以自己試：設定之前改一個 SubVI，看呼叫它的 VI 標題列有沒有出現 *；設定之後再試一次。'),
C.h3('③ 看兩版 VI 差在哪','','審查（H3）時一定要做'),
C.table(['工具','怎麼用','限制'],[
 ['Compare VIs','LabVIEW 的 Tools ▸ Compare ▸ Compare VIs，選兩個 VI','NI 說明寫要 Professional 版'],
 ['LVCompare.exe','<code>C:\\Program Files\\National Instruments\\Shared\\LabVIEW Compare\\LVCompare.exe</code>，可以從命令列或 Git 呼叫','Professional 版；路徑要是絕對路徑（Git 給的路徑要先轉，社群多半用一個轉換腳本，二手）'],
 ['LabVIEW CLI 的 CreateComparisonReport','不開畫面，產生 HTML 差異報告；CI 可以在每次提交時自動產生','2025 Q3 才加的（LabVIEW Wiki，二手），<b>LabVIEW 2018 沒有</b>']
]),
`<p>LadderLab 在 LabVIEW 2026 用 CLI 比較 H5 那個 bug 的修正前後：</p>`,
term('LabVIEWCLI -OperationName CreateComparisonReport ^\n  -VI1 old\\GPD_VOUT_To_Number.vi -VI2 new\\GPD_VOUT_To_Number.vi ^\n  -ReportType html -ReportPath report.html -nobdcosm -nofppos\n\nConnection established with LabVIEW at port number 3363.\nCreateComparisonReport operation succeeded.'),
`<div class="fig" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;text-align:center"><div><img src="img/adv/h9_old.png" alt="修正前" style="max-width:100%;border:1px solid #ccc"><div style="font-size:12px">修正前：只看「後面那個字是 V」</div></div><div><img src="img/adv/h9_new.png" alt="修正後" style="max-width:100%;border:1px solid #ccc"><div style="font-size:12px">修正後：多了 &gt;0 和 AND</div></div></div>
<div class="fig" style="text-align:center"><img src="img/adv/h9_diff.png" alt="報告標出新增的節點" style="max-width:100%;border:1px solid #ccc"><div style="font-size:12px">報告把新增的兩個節點框起來（1A、1B）</div></div>`,
`<p>報告的文字部分只有三行：Greater Than 0? 新增、And 新增、接線改變。審查的人不用開 LabVIEW，就知道這次提交改了什麼。</p>`,
ask('同樣兩個 VI，不加 -nobdcosm -nofppos 時，報告多了一堆「moved」；加了以後，連方塊圖上說明文字的修改也不見了。這代表什麼？',`<p>不加：存檔前做了 Clean Up Diagram，每個節點的位置都變了，報告把它們全列出來，真正的修改被淹沒。加了：位置這類「外觀」的變動都濾掉，只剩功能上的修改；但 LabVIEW 也把<b>說明文字的修改</b>算成外觀，一起濾掉了。</p><p>所以審查時先看濾掉外觀的版本找功能修改，再看完整版確認說明有沒有跟著改（H3 的「文件」那一類）。</p>`),
C.h3('④ .gitignore 和 .gitattributes','','第一次提交前寫好'),
{fn:filesFig},
`<p>一份起點（照 GitHub 的 LabVIEW .gitignore 範本和 Git 官方文件；依你的專案調整）：</p>`,
term('# .gitignore\n*.aliases\n*.lvlps\n*.lvprojstate\n.cache/\nbuilds/\n*.exe\n*.lvlibp\n# 範本也排除 *.llb、*.dll：專案原始碼放在 .llb、或要用廠商的 DLL 時，不要排除\n\n# .gitattributes\n*.vi       binary\n*.vim      binary\n*.ctl      binary\n*.lvproj   binary\n*.lvlib    binary\n*.lvclass  binary'),
ask('.lvproj、.lvclass 其實是 XML 文字檔，Git 本來看得懂。為什麼還要標成 binary？',`<p>LadderLab 試過：不標的話，<code>git diff</code> 對 .lvproj 會逐行顯示 XML 的差異，看起來很方便；但合併時 Git 也會<b>逐行自動合併</b> XML，兩個人各加一個檔案，可能合出 LabVIEW 讀不了的專案檔。標成 binary 後，diff 只顯示「Binary files differ」，合併時一定要人決定。Git 在 Windows 上還可能幫文字檔轉換換行字元（實測有出現 LF 轉 CRLF 的警告），binary 也不會轉。NI 的建議是專案檔開發期間盡量不改、要改時由一個人改。</p>`),
C.h3('⑤ 不要兩個人改同一個 VI','',''),
C.table(['做法','說明'],[
 ['架構先切好','VI 小、一個 VI 一件事；用 lvlib、lvclass 分模組，一個人負責一個模組（H1、H4）。常常撞在同一個 VI，代表架構該切了'],
 ['改之前先說','改共用的 VI（型別定義、主程式、專案檔）前，先在群組說一聲'],
 ['鎖檔','Git LFS 的 lockable：檔案平常唯讀，要改先 lock。但要伺服器支援 locking，不是每個平台都有，先問公司的 Git 管理者'],
 ['真的衝突時','先保留兩個版本（另存一份），用 Compare VIs 或差異報告看對方改了什麼，在其中一版手動補上；LVMerge 可以幫忙並排比較，但也是人工逐項處理']
]),
C.h3('⑥ 一次提交的流程','','把前面的課串起來'),
C.table(['步驟','做什麼','課程'],[
 ['1','接手時第一次提交：原封不動；第二次提交：只改「只存原始碼」的設定','W8、②'],
 ['2','一次改一件事；改完跑 Run_All_Tests，不是 ALL PASS 就不提交','H5'],
 ['3','提交訊息寫：改了什麼、為什麼、怎麼驗證（例如「GPD 回覆沒有數字時判無效；加 2 個測試案例」）','W8'],
 ['4','請人審查：附差異報告或截圖','H3、③'],
 ['5','要上線的版本打 tag（例如 v1.3.0），和 EXE 的版本號一致；安裝程式另外存發行資料夾','W19'],
 ['6','驗證報告寫測試程式的 tag 或提交編號','H8']
]),
C.h3('⑦ 學校電腦不能裝 Git 時','',''),
`<ul><li>用「有日期的資料夾或壓縮檔＋一份變更紀錄」模擬提交：每次只改一件、寫一行紀錄、跑一次測試（W8 已經這樣做）。</li>
<li>在 LabVIEW 裡做 ② 的實驗：設定只存原始碼前後，改一個 SubVI，看呼叫它的 VI 會不會出現 *。</li>
<li>學校是 Professional 版的話，用 Compare VIs 比兩個資料夾裡的同名 VI。</li>
<li>Git for Windows 有可攜版，但算不算「安裝軟體」要照學校規定，不要私下用。</li></ul>`,
C.h3('測','q','小測驗'),
{quiz:[
 {q:'git diff 一個改過的 VI，會看到？',o:['Binary files ... differ','逐行的方塊圖差異','前面板的截圖','什麼都不顯示'],a:0,ex:'VI 是二進位檔；要看差異用 Compare VIs、LVCompare 或 CLI 的差異報告。'},
 {q:'兩個分支都改了同一個 VI，git merge 會？',o:['衝突，不能自動合併，要人選一個版本再手動補','自動合併','刪掉 VI','選比較新的那一個'],a:0,ex:'所以要避免兩個人同時改同一個 VI。'},
 {q:'「只存原始碼」解決什麼問題？',o:['改一個 SubVI 時，呼叫它的 VI 不會因為重新編譯變成「有變更」','讓 VI 跑得比較快','讓 Git 看得懂 VI','讓 VI 變小所以不用版本控制'],a:0,ex:'編譯碼改存到每台電腦自己的快取。'},
 {q:'專案屬性的 Separate compiled code from new project items 對舊檔有效嗎？',o:['沒有，舊檔要用 Mark Existing Items','有','只對 .lvproj 有效','要重開電腦才有效'],a:0,ex:'選項名稱就寫了 new project items。'},
 {q:'為什麼 .lvproj 要標成 binary？',o:['避免 Git 逐行自動合併 XML，合出壞掉的專案檔','因為它很大','因為它是執行檔','Git 規定的'],a:0,ex:'也避免 Windows 上的換行轉換。'},
 {q:'CreateComparisonReport 加 -nobdcosm 會？',o:['濾掉位置等外觀變動，連說明文字的修改也濾掉','只留外觀變動','比較前面板的顏色','產生 PDF'],a:0,ex:'先看濾掉外觀的找功能修改，再看完整版確認說明。'},
 {q:'哪一個<b>不該</b>放進版本庫？',o:['建置出來的 EXE','主程式的 VI','station_template.ini','專案要用的廠商 DLL'],a:0,ex:'建置產物可以重新產生，用 tag 標記版本。'}
]}
]});
})();
