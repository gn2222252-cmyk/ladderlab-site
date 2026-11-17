/* 高階實務 H3：審查別人的程式（code review）。
   證據（docs/research_advanced.md 1.4）：資深職缺多出「帶人、設計審查、技術領導」（21 則裡 5 則）；PTT P01 用人主管都問程式架構與維護。
   審查對象 H3_Review_Me.vi 是 LadderLab 用 LabVIEW 2026 實際建出來的 VI（labview_vi/_build/build_h7_review.py），問題是故意放的；
   方塊圖圖片是 LabVIEW 匯出的。每個問題對應的行為：In Range and Coerce 預設不含上限（W13 實測）、Fract/Exp String To Number 找不到數字時
   輸出 default（預設 0）、Floating Point Equal? 在 LabVIEW 2026 的選盤裡（search_styles 查到）。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='高階實務';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary><div class="ans">${a}</div></details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

/* 候選意見：bad=true 是真的問題；sev：必修／應修／建議 */
const FIND=[
 {t:'命令字串 MEAS:VOLT:DC?\\n 是一般顯示模式',bad:true,sev:'必修',why:'一般顯示模式下打的 <code>\\n</code> 是「反斜線」和「n」兩個字元，不是換行。儀器收到多出來的兩個字，命令看不懂，多半不回應或回錯誤，VISA Read 等到逾時。要在常數上按右鍵改成 \'\\\' Codes Display 再打 \\n，或改用 Concatenate 加 Line Feed 常數；VISA 那邊的結束字元設定也要對（I3）。'},
 {t:'VISA Read 的 error out 沒有接出去',bad:true,sev:'必修',why:'逾時、斷線全都看不見。Read 失敗時 read buffer 是空字串，Fract/Exp String To Number 找不到數字就輸出 default（預設 0），V = 0、PASS = F：<b>儀器掉線被記成產品 FAIL</b>（H2 的模擬器就是這個情況）。迴圈也不會因為錯誤停下來。error 要一路接到底，出錯時結果記 ERROR 不是 FAIL（W6）。'},
 {t:'In Range and Coerce 沒有打開「含上限」',bad:true,sev:'必修',why:'它預設<b>含下限、不含上限</b>（W13 實測）：剛好 5.10 V 會判 FAIL，和規格書「4.90～5.10 V（含）」不符。要在節點上按右鍵勾選含上限，並在旁邊放註解。'},
 {t:'上下限 4.9、5.1 直接打在方塊圖上',bad:true,sev:'應修',why:'改規格要改程式、重新建置、重新驗證（W8）；每台測試站的值也可能不一樣。上下限放設定檔或限值檔（W6、W11），程式只讀。'},
 {t:'用 Equal? 比較量到的電壓是不是剛好 5 V',bad:true,sev:'應修',why:'DBL 量測值幾乎不會剛好等於 5.0，這個燈永遠不亮。要判斷「夠接近」就比差的絕對值小於一個容許值；LabVIEW 2026 的 Comparison 選盤也有 Floating Point Equal?。先問清楚這個燈到底要表達什麼，規格裡有沒有這個需求。'},
 {t:'Open/Create/Replace File 放在迴圈裡，而且沒有 Close File',bad:true,sev:'必修',why:'每一圈開一個新的檔案參考、從來不關，程式跑越久累積越多。要在迴圈外開一次、迴圈裡寫、迴圈外關（F4、W12）。'},
 {t:'operation 用 open or create，沒有把位置移到檔尾',bad:true,sev:'必修',why:'打開檔案時位置在開頭，每次寫入都從頭蓋掉前面的內容：跑一整天，檔案裡只剩最後一筆左右的資料。要用 Set File Position 移到檔尾再寫（W6 的 Append_Line.vi 就是這樣做），或在迴圈外開一次、一直往後寫。'},
 {t:'程式結束時沒有 VISA Close',bad:true,sev:'應修',why:'session 留著沒關。開發環境裡停掉 VI 時 LabVIEW 會幫忙清，但不要依賴它：迴圈結束後接 VISA Close，error 接到 Simple Error Handler（W6、I10）。'},
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
      return `<div style="border-left:3px solid ${col};padding:2px 8px;margin:5px 0"><b style="color:${col}">${mark}</b> ${f.t}${f.bad?` <span style="background:${f.sev==='必修'?'#c0392b':f.sev==='應修'?'#b9770e':'#888'};color:#fff;border-radius:3px;padding:0 5px;font-size:11px">${f.sev}</span>`:' <span style="color:#1e7b34;font-size:11px">（沒問題）</span>'}<div style="color:#444">${f.why}</div></div>`;});
    el.querySelector('[data-o=out]').innerHTML=`<p style="margin:0 0 4px">找到 ${hit} / ${FIND.filter(f=>f.bad).length} 個問題，漏了 ${miss} 個，把 ${wrong} 個沒問題的當成問題。</p>`+rows.join('');
  };
}

/* 意見怎麼寫：同一個問題，三種寫法 */
function commentFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff;font-size:13px';
  const C3=[
   ['A','「這段寫得很爛，error 都不接。」','只有情緒，沒有位置、後果、做法。新人只會覺得被罵，不知道要改哪裡。'],
   ['B','「VISA Read 的 error out 要接。」','有位置、有做法，但沒有<b>為什麼</b>：新人會照做這一次，下一支程式還是一樣。'],
   ['C','「【必修】VISA Read 的 error out 沒接（方塊圖中間）。DMM 斷線時 read buffer 是空字串，Fract/Exp 輸出 0，這一片會被記成 FAIL，產線會把好板子丟掉。建議：error 接到迴圈的停止條件，出錯時這一片記 ERROR。可以參考 W6 的 Judge.vi。改完請拔掉 DMM 的 USB 測一次給我看。」','位置、後果、做法、參考、怎麼驗收都有；標了嚴重程度，對方知道先改哪個。']
  ];
  el.innerHTML=C3.map(c=>`<div style="border:1px solid #dfe6f0;border-radius:4px;padding:6px 8px;margin:6px 0;background:#fff"><b>寫法 ${c[0]}</b>　${c[1]}<div style="color:#555;margin-top:3px">${c[2]}</div></div>`).join('');
}

L.push({id:'H3',order:42,no:'H3',part:PART,title:'審查別人的程式：找出會讓產線誤判的問題，寫出對方改得動的意見',mins:60,files:['H3_Review_Me.vi'],
goals:[['學會','審查 LabVIEW 程式時依什麼順序看（正確性 → 錯誤處理 → 資源 → 可維護性）；分辨「會讓產線誤判、掉資料」和「只是不好看」；寫出有位置、後果、做法、驗收方法的意見；用實際測試驗收修改'],
 ['工作上','資深職缺多出來的要求是帶人、審查程式；新人的程式上產線前要有人看過，你會是那個人'],
 ['用到','W6（ERROR 不是 FAIL、上下限放檔案）、W8（變更說明、回歸）、W13（In Range 的上限）、F4／W12（寫檔）、H2（錯誤被吞掉的後果）']],
check:'不看課文，能說出審查的先後順序、哪三種問題一定要擋下來（會誤判、掉資料、資源洩漏），以及一則好的審查意見要包含哪五樣東西。',
body:[
C.h3('這一課的工作','x','新人說：「我寫好了，可以上產線嗎？」'),
`<p>你帶的新人花一個下午寫了一支 DMM 電壓記錄程式：每一圈量一次 5 V 輸出，判 PASS，寫進 log 檔。他在自己的桌上跑過，「數字有出來」。下週要放到老化燒機區跑三天（W12）。上產線前你要審查。</p>
<p>下面是他的方塊圖（LadderLab 用 LabVIEW 2026 真的建出來的 VI，可以下載打開；<b>問題是故意放的</b>，但每一個都是實際工作常見的）。</p>`,
note('為什麼有這一課（資料來源）','助理整理的資深職缺裡，有 5 則寫到帶人、設計審查、技術領導；PTT 上一個月面試 17 家 LabVIEW 職缺的人說，用人主管幾乎都問程式架構和維護。整理在 docs/research_advanced.md。'),
`<div class="fig" style="text-align:center"><img src="img/adv/H3_Review_Me_diagram.png" alt="H3_Review_Me.vi 的方塊圖" style="max-width:100%;border:1px solid #ccc"></div>`,
tip('下載','<a href="vi/LV2018/H3_Review_Me.vi" download>H3_Review_Me.vi（LabVIEW 2018）</a>　<a href="vi/H3_Review_Me.vi" download style="font-size:13px">2026 版</a>。打開後先不要按 Run（沒有接 DMM 時，VISA Read 會等到逾時）；看方塊圖就好。'),
C.h3('① 先自己審一次','','不要先看答案'),
`<p>照下面的順序看，每看到一個可疑的地方就記下來：</p>
<ol><li><b>正確性</b>：結果會不會錯？（判定、單位、比較、命令）</li>
<li><b>錯誤處理</b>：出錯時會發生什麼？看得到嗎？會不會被記成別的東西？</li>
<li><b>資源</b>：開了的東西有沒有關？跑三天會不會越來越多？</li>
<li><b>資料</b>：檔案寫進去的東西，三天後還在嗎？</li>
<li><b>可維護性</b>：下一個人看得懂嗎？改規格要改程式嗎？</li></ol>`,
{fn:reviewFig},
ask('九個問題裡，哪三個你會說「這個沒改不准上產線」？為什麼是這三個，而不是全部？',`<p>例如：error 沒接（儀器掉線被記成 FAIL）、log 每次從頭蓋掉（三天的資料只剩一筆）、In Range 不含上限（規格邊界的好板子被判 FAIL）。它們會讓<b>產線做出錯的決定或丟掉資料</b>。檔案沒關、命令字串也很嚴重（後者其實程式根本量不到東西，在桌上試跑就該發現）。</p><p>可讀性、上下限寫死也該改，但不會讓明天的產線出錯。審查要<b>分輕重</b>：全部標成一樣重要，新人不知道先改哪個，重要的反而被淹沒。</p>`),
ask('新人說「我在桌上跑過，數字有出來」。為什麼他沒有發現這些問題？',`<p>他只試了「一切正常」的情況：DMM 接好、跑幾分鐘、看一眼數字。這些問題要在<b>不正常或長時間</b>的情況才會出現：拔掉 DMM（error）、剛好 5.10 V（上限）、跑一小時後打開 log 檔（被蓋掉）、看工作管理員的資源（檔案參考越來越多）。</p><p>所以驗收不能只是「跑起來了」，要有<b>故意弄壞的測試</b>（W6 的 ERROR 測試、W14 的現場除錯也是這個想法）。</p>`),
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
 ['邊界值','用電源把輸出調到 4.90 和 5.10 V（或改用模擬值）','兩個都 PASS；4.89、5.11 FAIL'],
 ['儀器掉線','跑到一半拔掉 DMM 的 USB','記 ERROR（不是 FAIL），程式停下或明確提示；session 有關'],
 ['長時間','跑一小時','log 檔有一小時的資料；開啟的檔案數量沒有一直增加'],
 ['規格改變','改設定檔裡的上下限，不改程式','判定跟著變']
]),
note('和 W8 的回歸測試接起來','審查找的是「看得出來」的問題，驗收測試找的是「跑起來才看得到」的問題，兩個都要。改過的程式要再跑一次 W8 的回歸測試，確認沒有改壞原本對的部分。'),
C.h3('④ 審查的清單','','貼在你的螢幕旁邊'),
C.table(['類別','看什麼','課程裡的例子'],[
 ['正確性','比較含不含邊界、DBL 不用等於、單位和換算、命令字串（\\n、結束字元）','W13、W6、I3'],
 ['錯誤處理','error 有沒有一路接到底；出錯時記成什麼；迴圈會不會因錯誤停','W6、H2'],
 ['資源','開的東西（VISA、檔案、DAQ 任務、Queue）有沒有在所有路徑都關','F4、W12、I10'],
 ['資料','寫檔的位置、格式、編碼；斷電、重開後資料還在不在','W6、W12、W9'],
 ['設定','上下限、路徑、站別有沒有寫死','W6、W11、W19'],
 ['可維護性','說明、標籤、SubVI 切法、一個 VI 不要大到一個畫面看不完','W8、A 系列'],
 ['架構','迴圈分工、資料怎麼在迴圈之間傳','A 系列、H1']
]),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'審查時最先看的是？',o:['結果會不會錯、出錯時會發生什麼','線有沒有拉直','圖示漂不漂亮','變數命名'],a:0,ex:'先擋會讓產線誤判、掉資料的問題。'},
 {q:'VISA Read 的 error out 沒接，DMM 斷線時這支程式會？',o:['V 變成 0，這一片被記成 FAIL','自動停下來','跳出錯誤對話框','記成 ERROR'],a:0,ex:'Fract/Exp 找不到數字時輸出 default（預設 0）。'},
 {q:'Open/Create/Replace File 用 open or create、不移位置就寫，結果？',o:['每次從檔頭蓋掉舊資料','自動接在檔尾','檔案被清空後重寫','會出錯'],a:0,ex:'打開時位置在開頭，要 Set File Position 到檔尾。'},
 {q:'一則好的審查意見要有？',o:['嚴重程度、位置、後果、做法、怎麼驗收','只要指出錯在哪','對方的名字','越短越好'],a:0,ex:'讓對方改得動，下次也記得。'},
 {q:'新人說「在桌上跑過沒問題」，你要再做？',o:['拔線、邊界值、長時間這類故意弄壞的測試','不用，跑過就好','請他再跑一次一樣的','直接上產線'],a:0,ex:'很多問題只在不正常或長時間的情況出現。'},
 {q:'一般顯示模式的字串常數裡打 \\n，送出去的是？',o:['反斜線和 n 兩個字元','換行字元','什麼都不送','空白'],a:0,ex:'要切到 \'\\\' Codes Display 才會變成換行。'}
]}
]});
})();
