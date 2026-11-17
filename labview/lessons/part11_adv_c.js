/* 高階實務 H3：審查別人的程式（code review）。
   證據（docs/research_advanced.md 1.4）：資深職缺多出「帶人、設計審查、技術領導」（21 則裡 5 則）；PTT P01 用人主管都問程式架構與維護。
   審查對象 H3_Review_Me.vi 是 LadderLab 用 LabVIEW 2026 實際建出來的 VI（labview_vi/_build/build_h3_review.py），問題是故意放的；
   方塊圖圖片是 LabVIEW 匯出的。每個問題對應的行為：In Range and Coerce 預設不含上限（W13 實測）、Fract/Exp String To Number 找不到數字時
   輸出 default（預設 0）。審查意見見 docs/review_H3.md。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='高階實務';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary><div class="ans">${a}</div></details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

/* 候選意見：bad=true 是真的問題；sev：必修／應修／建議 */
const FIND=[
 {t:'命令字串 MEAS:VOLT:DC?\\n 是一般顯示模式',bad:true,sev:'必修',why:'一般顯示模式下打的 <code>\\n</code> 是「反斜線」和「n」兩個字元，不是換行。儀器收到多出來的兩個字，命令看不懂，多半不回應或回錯誤，VISA Read 等到逾時。要在常數上按右鍵改成 \'\\\' Codes Display 再打 \\n，或改用 Concatenate 加 Line Feed 常數；VISA 那邊的結束字元設定也要對（I3）。注意：方塊圖上兩種顯示模式看起來都是 \\n，<b>只看圖分不出來</b>，要在常數上按右鍵看勾的是哪一種。'},
 {t:'VISA Read（還有 Write to Text File）的 error out 沒有接出去',bad:true,sev:'必修',why:'錯誤沒有被程式處理。在開發環境，如果這支 VI 的自動錯誤處理是開的（VI Properties ▸ Execution，新 VI 預設開），出錯時會跳出對話框、停在那裡等人按：燒機區半夜沒人按，三天就停在第一次斷線（W12 說過不能這樣）。自動錯誤處理被關掉的話，錯誤就沒人知道：Read 失敗時 read buffer 通常是空的，Fract/Exp String To Number 找不到數字就輸出 default（預設 0），V = 0、PASS = F，<b>儀器掉線被記成產品 FAIL</b>（H2 的模擬器就是這個情況）。兩種結果都不對：error 要接到程式自己的處理（記 ERROR、照 W12 的做法重開 VISA 繼續跑），不要靠自動錯誤處理。'},
 {t:'In Range and Coerce 沒有打開「含上限」',bad:true,sev:'必修',why:'它預設<b>含下限、不含上限</b>（W13 實測）：剛好 5.10 V 會判 FAIL，和規格書「4.90～5.10 V（含）」不符。要在節點上按右鍵勾選含上限，並在旁邊放註解。'},
 {t:'上下限 4.9、5.1 直接打在方塊圖上',bad:true,sev:'應修',why:'改規格要改程式、重新建置、重新驗證（W8）；每台測試站的值也可能不一樣。上下限放設定檔或限值檔（W6、W11），程式只讀。'},
 {t:'用 Equal? 比較量到的電壓是不是剛好 5 V',bad:true,sev:'應修',why:'DBL 量測值幾乎不會剛好等於 5.0：只有 DMM 剛好回 +5.00000000E+00 時才會亮，差 0.00001 V 就不亮。要判斷「夠接近」就比差的絕對值小於一個容許值。先問清楚這個燈到底要表達什麼，規格裡有沒有這個需求。'},
 {t:'Open/Create/Replace File 放在迴圈裡，而且沒有 Close File',bad:true,sev:'必修',why:'每一圈開一個新的檔案參考、從來不關，程式跑越久累積越多（Windows 工作管理員「詳細資料」頁可以加「控制代碼」欄，看它一直變大）。改法是迴圈外開一次、迴圈裡寫、迴圈外關（F4）；開完仍要先移到檔尾（見下一條），跑三天還要定時 Flush，或照 W12 每筆開、寫、關。'},
 {t:'operation 用 open or create，沒有把位置移到檔尾',bad:true,sev:'必修',why:'打開檔案時位置在開頭，每次寫入都從頭蓋掉前面的內容；open or create 不會清空檔案，所以檔案裡是「最新一筆＋舊資料的殘留」，跑一整天也只看得到一行新的。要用 Set File Position 移到檔尾再寫（W6 的 Append_Line.vi 就是這樣做）。迴圈外開一次也一樣：程式重跑時又從檔頭開始，開完要先移到檔尾。'},
 {t:'程式結束時沒有 VISA Close',bad:true,sev:'應修',why:'session 留著沒關。頂層 VI 執行完時 LabVIEW 會自動關掉它開的參考，VISA session 另外還受 LabVIEW 選項裡的設定影響；不要依賴這些：迴圈結束後接 VISA Close，error 接到 Simple Error Handler（W6、I10）。'},
 {t:'log 檔每一行只有電壓，沒有時間',bad:true,sev:'應修',why:'燒機三天後品保問「第二天凌晨那次異常是幾點」，查不到。每一行要有時間戳（W6、W12 的 log 都有）。'},
 {t:'VI 沒有說明，常數沒有標籤',bad:true,sev:'建議',why:'5.1、4.9、100 各代表什麼、單位是什麼，下一個接手的人要猜（W8）。VI Properties 的 Documentation 寫用途，常數加標籤。'},
 {t:'VISA Write 和 VISA Read 之間用 error 線串起來',bad:false,why:'這是對的：error 線決定先寫再讀的順序，也把 Write 的錯誤傳下去。'},
 {t:'用 Fract/Exp String To Number 把回應轉成數字',bad:false,why:'這是對的：DMM 的回應常是 +4.97000000E+00 這種指數格式，要用 Fract/Exp，不能用 Decimal String To Number。問題在它前面的錯誤沒有處理。'},
 {t:'stop 按鈕的端子放在迴圈裡',bad:false,why:'這是對的：每一圈都要讀一次按鈕。放在迴圈外，迴圈只會讀到一開始的值，永遠停不下來（第 4 課）。'},
 {t:'byte count 用 100',bad:false,why:'可以：VISA Read 讀到結束字元就會提早結束，100 只是上限，比回應長就好。'}
];
function reviewFig(el){
  el.className='fig';el.style.cssText='border:1px solid #d9cfe8;border-radius:6px;padding:10px 12px;background:#fbf9ff;font-size:13px';
  el.innerHTML=`<p style="margin:0 0 6px">勾選你認為<b>有問題</b>的地方（沒問題的不要勾），再按「對答案」。</p>
   <div>${FIND.map((f,i)=>`<label style="display:block;margin:3px 0"><input type="checkbox" data-i="${i}"> ${f.t}</label>`).join('')}</div>
   <button data-a="chk" style="margin-top:6px">對答案</button><div data-o="out" style="margin-top:8px"></div>`;
  el.querySelector('[data-a=chk]').onclick=()=>{
    let hit=0,miss=0,wrong=0;
    const rows=FIND.map((f,i)=>{const on=el.querySelector(`[data-i="${i}"]`).checked;
      const ok=on===f.bad;if(f.bad&&on)hit++;else if(f.bad)miss++;else if(on)wrong++;
      const mark=ok?'✓':'✗',col=ok?'#1e7b34':'#c0392b';
      return `<div style="border-left:3px solid ${col};padding:2px 8px;margin:5px 0"><b style="color:${col}">${mark}</b> ${f.t}${f.bad?` <span style="background:${f.sev==='必修'?'#c0392b':f.sev==='應修'?'#b9770e':'#888'};color:#fff;border-radius:3px;padding:0 5px;font-size:11px">${f.sev}</span>`:' <span style="color:#1e7b34;font-size:11px">（沒問題）</span>'}<details style="color:#444"><summary style="cursor:pointer;color:#1d4fa0">為什麼</summary>${f.why}</details></div>`;});
    el.querySelector('[data-o=out]').innerHTML=`<p style="margin:0 0 4px">找到 ${hit} / ${FIND.filter(f=>f.bad).length} 個問題，漏了 ${miss} 個，把 ${wrong} 個沒問題的當成問題。</p>`+rows.join('');
  };
}

/* 意見怎麼寫：同一個問題，三種寫法 */
function commentFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff;font-size:13px';
  const C3=[
   ['A','「這段寫得很爛，error 都不接。」','只有情緒，沒有位置、後果、做法。新人只會覺得被罵，不知道要改哪裡。'],
   ['B','「VISA Read 的 error out 要接。」','有位置、有做法，但沒有<b>為什麼</b>：新人會照做這一次，下一支程式還是一樣。'],
   ['C','「【必修】VISA Read 的 error out 沒接（方塊圖中間）。DMM 斷線時，開發環境會跳對話框停住，燒機區半夜沒人按；自動錯誤處理關掉的話，read buffer 是空的、Fract/Exp 輸出 0，會被記成 FAIL。建議：照 W12 的做法，出錯時這一筆記 ERROR（或 NaN）、重開 VISA、繼續跑；W6 Main.vi 的錯誤狀態也可以參考。改完請在跑的時候拔掉 DMM 的 USB，再接回去，給我看 log。」','位置、後果、做法、參考、怎麼驗收都有；標了嚴重程度，對方知道先改哪個。']
  ];
  el.innerHTML=C3.map(c=>`<div style="border:1px solid #dfe6f0;border-radius:4px;padding:6px 8px;margin:6px 0;background:#fff"><b>寫法 ${c[0]}</b>　${c[1]}<div style="color:#555;margin-top:3px">${c[2]}</div></div>`).join('');
}

L.push({id:'H3',order:42,no:'H3',part:PART,title:'審查別人的程式：找出會讓產線誤判的問題，寫出對方改得動的意見',mins:60,files:['H3_Review_Me.vi'],
goals:[['學會','審查 LabVIEW 程式時依什麼順序看（正確性 → 錯誤處理 → 資源 → 資料 → 可維護性）；分辨「會讓產線誤判、掉資料」和「只是不好看」；寫出有位置、後果、做法、驗收方法的意見；用實際測試驗收修改'],
 ['工作上','資深職缺多出來的要求是帶人、審查程式；新人的程式上產線前要有人看過，你會是那個人'],
 ['用到','W6（ERROR 不是 FAIL、上下限放檔案）、W8（變更說明、回歸）、W12（長時間記錄、斷線重連）、W13（In Range 的上限）、F4（寫檔）、H2（錯誤被吞掉的後果）']],
check:'不看課文，能說出審查的先後順序、哪三種問題一定要擋下來（會誤判、掉資料、資源洩漏），以及一則好的審查意見要包含哪五樣東西。',
body:[
C.h3('這一課的工作','x','新人說：「我寫好了，可以上產線嗎？」'),
`<p>你帶的新人花一個下午寫了一支 DMM 電壓記錄程式：每一圈量一次 5 V 輸出，判 PASS，寫進 log 檔。他說「我在桌上試過了」。下週要放到老化燒機區跑三天（W12）。上產線前你要審查。</p>
<p>下面是他的方塊圖（LadderLab 用 LabVIEW 2026 真的建出來的 VI，可以下載打開；<b>問題是故意放的</b>，但每一個都是實際工作常見的）。</p>`,
note('為什麼有這一課（資料來源）','助理整理的資深職缺裡，有 5 則寫到帶人、設計審查、技術領導；PTT 上一個月面試 17 家 LabVIEW 職缺的人說，用人主管幾乎都問程式架構和維護。整理在 docs/research_advanced.md。'),
`<div class="fig" style="text-align:center"><img src="img/adv/H3_Review_Me_diagram.png" alt="H3_Review_Me.vi 的方塊圖" style="max-width:100%;border:1px solid #ccc"></div>`,
tip('下載','<a href="vi/LV2018/H3_Review_Me.vi" download>H3_Review_Me.vi（LabVIEW 2018）</a>　<a href="vi/H3_Review_Me.vi" download style="font-size:13px">2026 版</a>。打開後先不要按 Run（沒有接 DMM 時，VISA Read 會等到逾時）；看方塊圖就好。'),
C.h3('① 先自己審一次','','不要先看答案'),
`<p>照下面的順序看，每看到一個可疑的地方就記下來：</p>
<ol><li><b>正確性</b>：結果會不會錯？（判定、單位、比較、命令）</li>
<li><b>錯誤處理</b>：出錯時會發生什麼？看得到嗎？會不會被記成別的東西？</li>
<li><b>資源</b>：開了的東西有沒有關？跑三天會不會越來越多？</li>
<li><b>資料</b>：檔案寫進去的東西，三天後還在嗎？查得到時間嗎？</li>
<li><b>可維護性</b>：下一個人看得懂嗎？改規格要改程式嗎？</li></ol>
<p>（refnum、session 這種線：VISA session 是紫色的線，檔案參考是深綠藍色的線，都代表「開著的東西」，看到它們就要找它們在哪裡被關掉。）</p>`,
{fn:reviewFig},
ask('這些問題裡，你會先要求改哪幾個？為什麼不是全部一樣重要？',`<p>先擋會讓<b>產線做出錯的決定或丟掉資料</b>的：error 沒接（儀器掉線被記成 FAIL，或跳對話框停住）、log 每次從頭蓋掉、In Range 不含上限（規格邊界的好板子被判 FAIL）、每圈開檔不關、命令字串（程式根本量不到東西）。</p><p>可讀性、上下限寫死也該改，但不會讓明天的產線出錯。審查要<b>分輕重</b>：全部標成一樣重要，新人不知道先改哪個，重要的反而被淹沒。</p>`),
ask('新人說「我在桌上試過了」。命令字串的問題照理一試就會發現，為什麼他沒發現？其他問題又為什麼試不出來？',`<p>命令字串錯了，儀器不會回，根本不會有數字：他可能沒接 DMM、只看程式有沒有斷線就算「試過」，或試的是改之前的版本。所以審查時要問一句：「<b>你是怎麼測的？給我看結果。</b>」</p><p>其他問題要在<b>不正常或長時間</b>的情況才會出現：拔掉 DMM（error）、剛好 5.10 V（上限）、跑一小時後打開 log 檔（被蓋掉）、看控制代碼（檔案參考越來越多）。驗收不能只是「跑起來了」，要有<b>故意弄壞的測試</b>（I10 的「故意弄壞」表、W6 的 ERROR 測試都是這個想法）。</p>`),
C.h3('② 寫出對方改得動的意見','','同一個問題，三種寫法'),
{fn:commentFig},
C.table(['一則好意見要有','例子'],[
 ['嚴重程度','必修／應修／建議：先改哪個一目了然'],
 ['位置','哪個節點、哪條線（附截圖或在 VI 上加註解）'],
 ['後果','會發生什麼事，最好講產線上看得到的結果（好板子被丟掉、資料不見）'],
 ['做法','建議怎麼改；指出課程或公司裡現成的寫法可以參考'],
 ['怎麼驗收','改完要做什麼測試給你看（拔線、邊界值、跑一小時看檔案）']
]),
warn('對事不對人','意見寫「這個節點」「這條線」，不寫「你又…」。新人照著意見改得動、下次記得住，審查才有用；被罵怕了，下次就不敢給你看了。發現他做得好的地方也要說（例如 Write 和 Read 用 error 線串好了）。'),
C.h3('③ 驗收修改','','不要只看他改了沒，要看結果'),
C.table(['測試','做法','通過的樣子'],[
 ['正常量測','接好 DMM，跑 5 分鐘','V 合理、PASS 正確、log 每圈多一行'],
 ['邊界值','用模擬值（實機調不到剛好 5.10 V，DMM 讀數一定有尾數）：把判定那一段的輸入換成 4.90、5.10、4.89、5.11','4.90、5.10 PASS；4.89、5.11 FAIL'],
 ['儀器掉線','跑到一半拔掉 DMM 的 USB，再接回去','那幾筆記 ERROR（不是 FAIL），不跳對話框等人；接回去後繼續記錄（W12）'],
 ['長時間','跑一小時','log 檔有一小時的資料、每行有時間；工作管理員的控制代碼數沒有一直增加'],
 ['規格改變','改設定檔裡的上下限，不改程式','判定跟著變']
]),
note('和 W8 的回歸測試接起來','審查找的是「看得出來」的問題，驗收測試找的是「跑起來才看得到」的問題，兩個都要。改過的程式要再跑一次 W8 的回歸測試，確認沒有改壞原本對的部分。'),
C.h3('④ 審查的清單','','貼在你的螢幕旁邊'),
C.table(['類別','看什麼','課程裡的例子'],[
 ['正確性','比較含不含邊界、DBL 不用等於、單位和換算、命令字串（\\n、結束字元）','W13、W6、I3'],
 ['錯誤處理','error 有沒有一路接到底；出錯時記成什麼；迴圈會不會因錯誤停','W6、H2'],
 ['資源','開的東西（VISA、檔案、DAQ 任務、Queue）有沒有在所有路徑都關','F4、W12、I10'],
 ['資料','寫檔的位置、時間戳、格式、編碼；斷電、重開後資料還在不在','W6、W12、W9'],
 ['設定','上下限、路徑、站別有沒有寫死','W6、W11、W19'],
 ['可維護性','說明、標籤、SubVI 切法、一個 VI 不要大到一個畫面看不完','W8、A 系列'],
 ['架構','迴圈分工、資料怎麼在迴圈之間傳','A3、A8；類別的程式看 H1']
]),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'審查時最先看的是？',o:['結果會不會錯、出錯時會發生什麼','線有沒有拉直','圖示漂不漂亮','變數命名'],a:0,ex:'先擋會讓產線誤判、掉資料的問題。'},
 {q:'VISA Read 的 error out 沒接，而且這支 VI 的自動錯誤處理被關掉了。DMM 斷線時會？',o:['V 變成 0，這一筆被記成 FAIL','自動重連','記成 ERROR','程式自動停下'],a:0,ex:'Fract/Exp 找不到數字時輸出 default（預設 0）。自動錯誤處理開著的話則會跳對話框停住：兩種都不對。'},
 {q:'Open/Create/Replace File 用 open or create、不移位置就寫，結果？',o:['每次從檔頭蓋掉舊資料（檔案不會被清空，後面留著殘留）','自動接在檔尾','檔案被清空後重寫','會出錯'],a:0,ex:'打開時位置在開頭，要 Set File Position 到檔尾。'},
 {q:'一則好的審查意見要有？',o:['嚴重程度、位置、後果、做法、怎麼驗收','只要指出錯在哪','對方的名字','越短越好'],a:0,ex:'讓對方改得動，下次也記得。'},
 {q:'新人說「在桌上跑過沒問題」，你要再做？',o:['拔線、邊界值、長時間這類故意弄壞的測試','不用，跑過就好','請他再跑一次一樣的','直接上產線'],a:0,ex:'很多問題只在不正常或長時間的情況出現。'},
 {q:'一般顯示模式的字串常數裡打 \\n，送出去的是？',o:['反斜線和 n 兩個字元','換行字元','什麼都不送','空白'],a:0,ex:'要切到 \'\\\' Codes Display 才會變成換行。'}
]}
]});
})();
