/* 高階實務 H5：單元測試與自動回歸，不用裝任何工具（LabVIEW 2018 的學校電腦也能做）。
   證據：docs/research_unittest.md（助理整理）。台灣職缺明寫 LabVIEW 單元測試的是 0 則；資深技能指南、DQMH（4.0 起有單元測試工具）、
   JKI 在 NI Connect 2024 的分享把它列為資深能力（後兩者有利益關係，已標明）。所以這一課的動機以「W8 的手動回歸太慢、會漏」為主。
   實測（labview_vi/_build/build_h5_tests.py，LabVIEW 2026，另存 2018 版）：
   Judge_Limit_test 6 個案例全過、GPD_VOUT_To_Number_test 5 個案例全過、Run_All_Tests 寫出兩行 PASS；
   把 Judge_Limit 的 Include Upper Limit? 關掉（W13 的預設）→ Judge_Limit_test FAIL 1 of 6，錯的是第 3 個案例 5.10；改回來又全過。
   GPD_VOUT_To_Number("5.000") → value 5.0、valid F。
   LabVIEW CLI：本機 C:\Program Files (x86)\National Instruments\Shared\LabVIEW CLI，26.3，7 個 operation（助理讀本機檔案）。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='高階實務';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary><div class="ans">${a}</div></details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

/* ---- 實測過的：把 W13 的錯放回去，看 Run_All_Tests 的報告 ---- */
function bugFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff;font-size:13px';
  el.innerHTML=`<label>Judge_Limit.vi 的 In Range and Coerce <select data-k="b"><option value="0">含上限（正確）</option><option value="1">不含上限（W13 說的預設值）</option></select></label>
   <pre data-o="out" style="background:#1e1e1e;color:#e8e8e8;padding:8px 10px;border-radius:4px;margin:8px 0 0;white-space:pre-wrap"></pre><div data-o="msg" style="margin-top:6px"></div>`;
  function draw(){
    const bug=el.querySelector('[data-k=b]').value==='1';
    el.querySelector('[data-o=out]').textContent=bug
      ?'FAIL  Judge_Limit_test  failed 1 of 6\nPASS  GPD_VOUT_To_Number_test  failed 0 of 5\n\nALL PASS = F　　mismatch[] = F F T F F F'
      :'PASS  Judge_Limit_test  failed 0 of 6\nPASS  GPD_VOUT_To_Number_test  failed 0 of 5\n\nALL PASS = T';
    el.querySelector('[data-o=msg]').innerHTML=bug
      ?'mismatch[] 第 3 個是 T：那一個案例是 <b>5.10 V</b>，規格說要 PASS，程式判了 FAIL。<b>測試直接指出錯在哪一個邊界</b>，不用等產線上的好板子被丟掉才發現。（LadderLab 在 LabVIEW 2026 實際跑出來的結果）'
      :'兩支測試全過，results 檔寫了兩行 PASS。（LadderLab 在 LabVIEW 2026 實際跑出來的結果）';
  }
  el.querySelector('select').onchange=draw;draw();
}

/* ---- 挑案例：你挑的值，抓得到哪些錯？（純邏輯的練習） ---- */
const CAND=[4.80,4.89,4.90,4.95,5.00,5.05,5.10,5.11,5.20];
const BUGS=[
 {t:'上限沒有含（W13：In Range 的預設）',f:v=>v>=4.90&&v<5.10},
 {t:'下限寫成「大於」而不是「大於或等於」',f:v=>v>4.90&&v<=5.10},
 {t:'上下限接反了（4.90 接到上限、5.10 接到下限）',f:v=>v>=5.10&&v<=4.90},
 {t:'有人把上限改成 5.20（規格沒改）',f:v=>v>=4.90&&v<=5.20}
];
const OK=v=>v>=4.90&&v<=5.10;
function caseFig(el){
  el.className='fig';el.style.cssText='border:1px solid #d9cfe8;border-radius:6px;padding:10px 12px;background:#fbf9ff;font-size:13px';
  el.innerHTML=`<p style="margin:0 0 6px">規格：4.90～5.10 V（含兩端）。勾選你要放進 Judge_Limit_test 的電壓，看看這組案例抓得到下面哪些錯：</p>
   <div style="display:flex;flex-wrap:wrap;gap:6px 14px">${CAND.map((v,i)=>`<label><input type="checkbox" data-i="${i}"${[4,6].includes(i)?' checked':''}> ${v.toFixed(2)}</label>`).join('')}</div>
   <div data-o="out" style="margin-top:8px"></div>`;
  function draw(){
    const pick=CAND.filter((v,i)=>el.querySelector(`[data-i="${i}"]`).checked);
    const rows=BUGS.map(b=>{const hit=pick.filter(v=>b.f(v)!==OK(v));
      return `<div style="border-left:3px solid ${hit.length?'#1e7b34':'#c0392b'};padding:2px 8px;margin:4px 0">${hit.length?'抓到':'<b>漏掉</b>'}：${b.t}${hit.length?`<span style="color:#555">（靠 ${hit.map(v=>v.toFixed(2)).join('、')}）</span>`:''}</div>`;});
    const n=BUGS.filter(b=>pick.some(v=>b.f(v)!==OK(v))).length;
    el.querySelector('[data-o=out]').innerHTML=`<p style="margin:0 0 4px">${pick.length} 個案例，抓到 ${n} / ${BUGS.length} 種錯。</p>`+rows.join('')+
      (n===BUGS.length?'<p style="margin:6px 0 0;color:#1e7b34">每一種都抓到了。看看你挑了哪些：兩個邊界剛好的值、兩個剛好在外面的值，通常就夠了。</p>':'');
  }
  el.querySelectorAll('input').forEach(c=>c.onchange=draw);draw();
}

L.push({id:'H5',order:44,no:'H5',part:PART,title:'單元測試與自動回歸：改完程式，一個按鈕確定沒有改壞',mins:70,files:['H5_Run_All_Tests.zip'],
goals:[['學會','分清楚單元測試、回歸測試、硬體測試；挑出可以不接硬體就測的 VI；寫一支 _test.vi（案例表、For Loop、比對、計數）；挑測試案例（邊界、剛好在外面、壞掉的輸入）；用 Run_All_Tests.vi 一次跑完並留下結果檔；修 bug 前先加一個會失敗的案例'],
 ['工作上','W8 的回歸要人照表手動測 5 片；改的地方越多、版本越多，越容易漏。把它變成一個按鈕，每次改完、每次發行前都跑'],
 ['用到','W8（回歸、變更流程、Git）、W13（In Range 的上限）、H4（PSU_Sim、假物件）、I3／I10（儀器回覆的格式）']],
check:'不看課文，能說出：哪些 VI 適合寫單元測試；一組判定的測試案例至少要有哪幾個值；Run_All_Tests 什麼時候跑；接硬體的程式怎麼測；LabVIEW CLI 的 RunUnitTests 能不能跑我們自己的 _test.vi。',
body:[
C.h3('這一課的工作','x','每次改程式，都要重測 5 片？'),
`<p>W8 你接手了舊程式，每次改完都照回歸表重測 5 片板子。W13 的上限問題、H4 加了新電源的類別、H3 審查完要修的地方……每改一次就要重測一次。產品一多、版本一多，手動回歸會越做越久，也一定會有一天忘了測某一項。</p>
<p>這一課把<b>不接硬體也能測的部分</b>變成自動測試：一支 VI 按一下，告訴你「全部通過」或「哪一個案例錯了」。</p>`,
note('為什麼有這一課（資料來源）','台灣找得到的職缺裡，明寫 LabVIEW 單元測試的是 0 則；把它列為資深能力的，是一份 2025 年的技能指南（訓練業者寫的，二手）和 LabVIEW 社群的框架與廠商（DQMH 從 2018 年 4.0 版起就附單元測試工具；JKI 在 NI Connect 2024 分享在 CI 上跑 372 個測試，JKI 是測試工具的開發者）。所以這一課的理由主要是工作本身：W8 的手動回歸會漏。整理在 docs/research_unittest.md。'),
C.h3('① 三種測試，不要混在一起','',''),
C.table(['','單元測試','回歸測試','硬體測試'],[
 ['測什麼','一支 VI 的邏輯（判定、解析、換算）','改完之後，原本對的東西還對不對','整台測試站和真的儀器、真的板子'],
 ['要不要硬體','<b>不要</b>：輸入是常數或假物件','看情況：可以全用單元測試，也可以加實機','要'],
 ['和什麼比','你寫在案例表裡的預期值','以前的結果（基準）','規格、golden sample'],
 ['多快','幾秒','幾秒到幾十分鐘','以分鐘、小時算'],
 ['例子','Judge_Limit：5.10 V 要 PASS','W8 的 5 片：改完結果要和改之前一樣','W6 的 GR&R、W19 的驗收']
]),
warn('回歸的基準錯了，就抓不到','回歸測試是「和以前比」。如果以前的結果本身就錯（例如 W13 的 5.10 V 一直被判 FAIL），回歸會一直說「一樣，通過」。所以邊界值要用<b>規格</b>寫成單元測試的預期值，不是抄以前程式的輸出。'),
C.h3('② 挑可以測的 VI','','先從「沒有硬體的」開始'),
`<p>好測的 VI 有個共通點：<b>輸入決定輸出</b>，不碰儀器、不讀檔、不看時間。W 系列裡很多這種東西：</p>
<ul><li>判定：值和上下限 → PASS／FAIL（W6、W13）</li>
<li>解析：儀器回的字串 → 數字（I3、I10），例如 GPD 回 <code>5.000V</code></li>
<li>換算、計算：負載調整率（W6 的 T04）、稼動率（W7）、U16 計數差（W7）</li></ul>
<p>碰到硬體的 VI，把「跟儀器講話」和「算」分開：算的部分抽成 SubVI 來測；跟儀器講話的部分，用 H4 的 PSU_Sim 這種假物件替換。</p>`,
C.h3('③ 一支測試 VI 長什麼樣子','','Judge_Limit_test.vi（LabVIEW 實際建出來的）'),
`<div class="fig" style="text-align:center"><img src="img/adv/Judge_Limit_test_diagram.png" alt="Judge_Limit_test.vi 的方塊圖" style="max-width:100%;border:1px solid #ccc"></div>
<ol><li><b>案例表</b>：兩個陣列常數。value[] = 5.00、4.90、5.10、4.89、5.11、4.95；expected[] = T、T、T、F、F、T。上下限 4.90、5.10 是常數。</li>
<li><b>For Loop</b>：兩個陣列自動索引，每一圈測一個案例，呼叫受測的 Judge_Limit.vi。</li>
<li><b>比對</b>：Not Equal? 比「實際的 pass」和「預期的 pass」，不一樣就是 mismatch。</li>
<li><b>計數</b>：Boolean To (0,1) 加進 Shift Register，迴圈結束時就是 failed；total 是陣列大小；failed = 0 就是 all pass。mismatch[] 從索引通道出來，看得到是第幾個案例錯。</li>
<li><b>接線板</b>：輸出 all pass、failed、total，給 Run_All_Tests 呼叫。</li></ol>`,
tip('下載','<a href="vi/LV2018/H5_Run_All_Tests.zip" download>H5_Run_All_Tests.zip（LabVIEW 2018）</a>　<a href="vi/H5_Run_All_Tests.zip" download style="font-size:13px">2026 版</a>：解開後保持資料夾結構。H5_sub 裡有兩個受測的 VI（Judge_Limit、GPD_VOUT_To_Number）和它們的 _test.vi；H5_Run_All_Tests.vi 跑兩支測試、寫結果檔。不需要儀器，也不需要裝任何工具。'),
C.h3('④ 挑案例','','測試的品質在案例'),
{fn:caseFig},
ask('GPD_VOUT_To_Number 的案例是 5.000V、4.998V、No Error.、空字串、5.000。最後一個「5.000」（沒有 V）為什麼要放？',`<p>它模擬<b>回覆被截斷</b>：VISA Read 讀到一半逾時，或結束字元設錯，收到的字串少了尾巴。數字照樣轉得出來（LadderLab 實測：value = 5.0），如果只看數字，程式會把一個不完整的回覆當成正常量測。這支 VI 規定「數字後面要接 V 才算有效」，所以 valid = F。</p><p>好的案例不只放正常值，還放<b>壞掉的輸入</b>：空字串、錯誤訊息、截斷、多一個字。這些才是產線上真的會遇到、又最容易被忽略的。</p>`),
C.h3('⑤ 一個按鈕跑全部','','Run_All_Tests.vi'),
`<div class="fig" style="text-align:center"><img src="img/adv/H5_Run_All_Tests_diagram.png" alt="H5_Run_All_Tests.vi 的方塊圖" style="max-width:100%;border:1px solid #ccc"></div>
<p>每一支 _test.vi 放成 SubVI，各自的 all pass、failed、total 組成一行「PASS／FAIL、名稱、failed x of y」，全部接起來寫進結果檔（用 replace or create，每次覆蓋），ALL PASS 是全部 AND 起來。新增一支 _test.vi，就在這裡多放一個 SubVI。</p>
<p>下面是 LadderLab 實際跑的結果。把 W13 那個錯放回去看看：</p>`,
{fn:bugFig},
C.h3('⑥ 什麼時候跑、找到 bug 怎麼辦','','把它放進變更流程'),
C.table(['時機','做什麼'],[
 ['每次改完程式、commit 之前（W8 的 Git）','跑 Run_All_Tests；不是 ALL PASS 就不 commit'],
 ['發行之前（W19）','跑一次，把結果檔和版本號一起存進發行紀錄'],
 ['找到一個 bug','<b>先加一個會失敗的案例</b>（例如 5.10 V 要 PASS），確認它真的 FAIL，再去修程式，修到它 PASS。這個案例永遠留著，同一個 bug 不會回來第二次'],
 ['審查別人的程式（H3）','請他附上測試結果；新的判定沒有案例，就是審查意見']
]),
C.h3('⑦ 碰到硬體的程式怎麼測','','用假物件'),
`<p>H4 做的 PSU_Sim 讓主程式不接電源也能跑，但它只會走「一切正常」的路。要測錯誤處理，再做一個<b>會故意出錯的假電源</b>（例如 PSU_Fault：Measure Voltage 回錯誤、或回 0），用它跑主程式，檢查這一片被記成 ERROR 而不是 FAIL（W6、H2）。這種情況在實機上很難故意做出來，假物件一行設定就做得到。</p>`,
ask('單元測試全部通過，可以不做 W19 的實機驗收嗎？',`<p>不行。單元測試證明「邏輯照你寫的預期在跑」，不證明儀器、接線、驅動、權限、Run-Time 版本都沒問題；預期值本身寫錯，測試也會通過。單元測試讓實機驗收<b>少抓很多小錯</b>，不能取代它。</p>`),
C.h3('⑧ 工具：知道有，再決定要不要用','','延伸'),
`<details><summary style="cursor:pointer"><b>LabVIEW CLI、NI Unit Test Framework、Caraya、VI Tester</b></summary>
<ul><li><b>LabVIEW CLI</b>：從命令列操作 LabVIEW（建置、跑 VI、比較 VI…），CI 伺服器會用它。LadderLab 這台電腦（LabVIEW 2026）有，在 <code>C:\\Program Files (x86)\\National Instruments\\Shared\\LabVIEW CLI</code>，內建 7 個 operation：CloseLabVIEW、CreateComparisonReport、ExecuteBuildSpec、MassCompile、RunUnitTests、RunVI、RunVIAnalyzer。要先在 LabVIEW 的 VI Server 打開 TCP/IP。它從哪一版開始有，資料互相矛盾；你的學校電腦有沒有，直接看那個資料夾。</li>
<li><b>RunUnitTests 不能跑我們的 _test.vi</b>：它跑的是 NI Unit Test Framework 的 .lvtest（要 Professional 授權和另外的套件）。我們的測試要用 <b>RunVI</b> 跑，而且被跑的 VI 接線板要有它規定的三個端子（Command line args、CLI Process Return Code、Output/Error messages）。</li>
<li><b>Caraya</b>（JKI，BSD-3 開源）：用 Assert 系列 VI 寫測試，可以輸出 JUnit 報告給 CI。2.0 版起要 LabVIEW 2020，<b>LabVIEW 2018 只能用 1.4.4</b>。</li>
<li><b>VI Tester</b>（BSD-3 開源，社群維護）：每個測試是一個類別的方法，用 passIfEqual 這類 VI 判斷（不是 assertEqual）。它的說明寫明不是拿來測硬體的。</li>
<li><b>NI 的 CI 範例</b>（GitHub 上的容器、GitHub Actions）要 LabVIEW 2026 Q1 以上，LabVIEW 2018 用不了。</li></ul>
<p>學校電腦不能裝東西時，這一課的做法（自己的 _test.vi + Run_All_Tests）就夠了；到公司再看團隊用哪一套。</p></details>`,
C.h3('⑨ 作業','',''),
`<ol><li>下載 H5 的檔案，打開 Judge_Limit.vi，把 In Range and Coerce 的「含上限」關掉，跑 H5_Run_All_Tests.vi，看結果檔；再改回來。</li>
<li>幫 W6 的 T04（負載調整率 ＝｜T02 − T03｜÷ T02 × 100）寫一支 Calc_T04.vi 和它的 _test.vi。案例至少要有：一般值、T02 = T03（結果 0）、T03 比 T02 大（取絕對值）、T02 = 0（除以 0 會怎樣？規格沒寫時，先問清楚再寫預期值）。</li>
<li>把它加進 Run_All_Tests.vi，三支全過。</li></ol>`,
C.h3('測','q','小測驗'),
{quiz:[
 {q:'哪一種 VI 最適合寫單元測試？',o:['輸入決定輸出、不碰儀器和檔案的（判定、解析、換算）','直接控制電源的','整支主程式','前面板'],a:0,ex:'碰硬體的部分用假物件替換。'},
 {q:'規格 4.90～5.10 V（含兩端），判定的測試案例至少要有？',o:['4.90、5.10，以及剛好在外面的 4.89、5.11','只要 5.00','只要 4.90','隨機挑 100 個'],a:0,ex:'錯通常出在邊界。'},
 {q:'回歸測試是「和以前的結果比」。以前的結果本身就錯時會？',o:['回歸照樣通過，抓不到','一定會失敗','自動修正','跳出警告'],a:0,ex:'邊界值的預期要照規格寫。'},
 {q:'找到一個 bug，第一步是？',o:['先加一個會失敗的測試案例，確認它真的失敗，再修','直接改程式','重灌 LabVIEW','刪掉測試'],a:0,ex:'這個案例永遠留著，同一個 bug 不會回來。'},
 {q:'LabVIEW CLI 的 RunUnitTests 能跑我們自己寫的 _test.vi 嗎？',o:['不能，它跑 NI UTF 的 .lvtest；我們的要用 RunVI，接線板要有規定的三個端子','可以，什麼都能跑','只能跑 Caraya','CLI 不能跑任何測試'],a:0,ex:'助理讀本機 CLI 的檔案確認的。'},
 {q:'GPD 回覆 "5.000"（少了 V），GPD_VOUT_To_Number 會？',o:['value 是 5.0，但 valid = F','value 是 0','程式出錯','valid = T'],a:0,ex:'回覆被截斷時，數字照樣轉得出來；要另外檢查完整性。'},
 {q:'單元測試全部通過，代表？',o:['邏輯照預期在跑；不代表儀器、接線、部署都沒問題','整台測試站沒問題','不用做實機驗收','產品沒有不良'],a:0,ex:'它不能取代實機驗收。'}
]}
]});
})();
