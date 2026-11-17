/* 高階實務 H10：交接和帶新人。讓別人只靠文件就接得下去。
   證據（docs/research_handover.md）：台灣職缺：寫 SOP（Y09、Y05、Y06、Y08、K07）、照 SOP 做（K06）、教育訓練（Y61、Y66、Y65、Y49）、
   客戶端支援與交機（Y21、Y28、Y36、Y40、Y54、K04、Y37）；帶人、技術領導 5 則裡 4 則是國外的。PTT P01：「有的程式沒有文件，要問同事」、3 家要出差技轉。
   TWI 工作教導（LEI 的卡片、Wikipedia，二手）；ISO 9001:2015 文件化資訊、7.2、7.5（CQI 等二手說明）；
   NI 的 VI 文件建議（Driver and VI Library Development Guidelines）、File ▸ Print 可輸出 HTML／RTF／文字（NI 說明，非官方鏡像，二手）。
   這一課沒有 LabVIEW 實測（File ▸ Print 無法用 LadderLab 的腳本操作）。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='高階實務';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary><div class="ans">${a}</div></details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

/* ---- TWI 分解表：這一句屬於哪一欄？ ---- */
const TWI=[
 {s:'掃描板子上的序號標籤',c:0},
 {s:'掃到後畫面序號欄出現 PM5- 加 8 位數字',c:1},
 {s:'序號錯了，資料庫和客訴就追不到這一片（W9）',c:2},
 {s:'把板子放進治具，壓下壓板',c:0},
 {s:'板子的缺角對準治具左下的定位銷，壓到聽見「喀」一聲',c:1},
 {s:'沒壓到底，探針接觸不良，好板子會被判 FAIL（FAIL 不一定是板子壞，W14）',c:2},
 {s:'按綠色 START',c:0},
 {s:'測試中不要碰板子和線；畫面出現 PASS／FAIL／ERROR 之前不要拿起來',c:1},
 {s:'測試中板子帶電（5 V、滿載），拿起來可能燙到或打壞板子',c:2},
 {s:'測完取出板子，依結果放進良品盒或不良品盒',c:0},
 {s:'畫面顯示 ERROR（不是 FAIL）時，不要放進不良品盒，叫工程師',c:1},
 {s:'ERROR 是測試站的問題，不是板子壞（W6、H2）',c:2}
];
const COLS=['主要步驟','要點','理由'];
function twiFig(el){
  el.className='fig';el.style.cssText='border:1px solid #d9cfe8;border-radius:6px;padding:10px 12px;background:#fbf9ff;font-size:13px';
  el.innerHTML=`<p style="margin:0 0 6px">ST01 的作業指導書（WI）草稿。每一句應該放在 TWI 作業分解表的哪一欄？（定位銷、壓板、START 按鈕這些是示範用的細節，W6 沒有寫。）</p>
   ${TWI.map((t,i)=>`<div style="display:flex;gap:8px;align-items:center;margin:3px 0;flex-wrap:wrap"><select data-i="${i}"><option value="-1">—</option>${COLS.map((c,j)=>`<option value="${j}">${c}</option>`).join('')}</select><span>${t.s}</span></div>`).join('')}
   <button data-a="chk" style="margin-top:6px">對答案</button><div data-o="out" style="margin-top:8px"></div>`;
  el.querySelector('[data-a=chk]').onclick=()=>{
    let ok=0;TWI.forEach((t,i)=>{const v=+el.querySelector(`[data-i="${i}"]`).value;if(v===t.c)ok++;});
    const rows=[0,1,2].map(c=>`<div style="margin:4px 0"><b>${COLS[c]}</b><ul style="margin:2px 0 0 18px">${TWI.filter(t=>t.c===c).map(t=>`<li>${t.s}</li>`).join('')}</ul></div>`).join('');
    el.querySelector('[data-o=out]').innerHTML=`<p style="margin:0 0 4px">對了 ${ok} / ${TWI.length} 句。</p>${rows}<p style="color:#555;margin:6px 0 0">真正的表是一列一個步驟，要點和理由寫在同一列；作業員看「步驟」和「要點」，教的人一定要能說出「理由」。</p>`;
  };
}

/* ---- 技能矩陣 ---- */
function skillFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff;font-size:13px';
  const P=['阿明（新人）','小芳','你'],S=['ST01 操作','golden sample 驗證','換治具','ERROR 第一線處理','換版（W19）','改上下限（W6、W8）'];
  const st=[[2,1,0,0,0,0],[3,3,2,2,1,0],[4,4,4,4,4,4]];
  const L4=['未訓練','訓練中','可在指導下做','可獨立做','可以教別人'];
  el.innerHTML=`<p style="margin:0 0 6px">點格子改程度（○ 未訓練、◔ 訓練中、◑ 可在指導下做、● 可獨立做、★ 可以教別人）。目標：你調走前，<b>不算你</b>，每一項至少要有兩個人可獨立做。</p><div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:12px"><tr><th></th>${S.map(s=>`<th style="padding:2px 6px;border-bottom:1px solid #ccc">${s}</th>`).join('')}</tr>${P.map((p,i)=>`<tr><td style="padding:2px 6px">${p}</td>${S.map((s,j)=>`<td data-p="${i}" data-s="${j}" style="padding:2px 6px;text-align:center;cursor:pointer;border:1px solid #e3e8f0"></td>`).join('')}</tr>`).join('')}</table></div><div data-o="out" style="margin-top:6px"></div>`;
  function draw(){
    el.querySelectorAll('[data-p]').forEach(td=>{const v=st[+td.dataset.p][+td.dataset.s];td.textContent=['○','◔','◑','●','★'][v];td.title=L4[v];td.style.color=['#999','#b9770e','#1d4fa0','#1e7b34','#7a3fb0'][v];});
    const gap=S.filter((s,j)=>st.filter((r,i)=>i!==2&&r[j]>=3).length<2);
    el.querySelector('[data-o=out]').innerHTML=gap.length?`還不夠的項目：<b style="color:#c0392b">${gap.join('、')}</b>。這些就是你調走前要排進訓練時程表的。`:'<b style="color:#1e7b34">不算你，每一項都有兩個人可以獨立做了。</b>再看有沒有人到「可以教別人」：下一批新人來時，不用再找你。';
  }
  el.addEventListener('click',e=>{const td=e.target.closest('[data-p]');if(!td)return;const r=st[+td.dataset.p];r[+td.dataset.s]=(r[+td.dataset.s]+1)%5;draw();});
  draw();
}

L.push({id:'H10',order:49,no:'H10',part:PART,title:'交接和帶新人：讓下一個人只靠文件就接得下去',mins:60,files:[],
goals:[['學會','分清楚作業指導書（WI）、SOP、工程交接文件各給誰看；用 TWI 的「步驟、要點、理由」寫一頁 WI；工程交接包的十項（尤其是建置、部署、退版、設定、已知問題、處理手冊）；VI 層級的文件怎麼寫、怎麼輸出；用技能矩陣和訓練時程表帶新人；怎麼驗收交接'],
 ['工作上','台灣的職缺常寫「撰寫 SOP」「教育訓練」「客戶端訓練、交機」；從業者說最常遇到的是「程式沒有文件，要問同事」。W8 你是接手的人，這一課你是交出去的人'],
 ['用到','W8（接手沒有文件的程式）、W19（部署、換版、退版）、W6、W14（ERROR、現場除錯）、H3（審查）、H5（測試）、H6（VI 文件）、H8（測試計畫）、H9（版本庫、提交訊息）']],
check:'不看課文，能說出：WI、SOP、交接文件的差別；TWI 的三欄各寫什麼；工程交接包的十項裡，出事時最要命的是哪兩項；怎麼驗收一份交接文件；技能矩陣拿來做什麼。',
body:[
C.h3('這一課的工作','x','你要調到新產品線了'),
`<p>你負責 PM5 測試站一年多，下個月調去 PM6 的 DVT（H8）。主管說：「走之前把 PM5 交給阿明，他上個月才進來；產線的作業員也要重新訓練一批。<b>你走了以後，不能有事還要打電話問你。</b>」</p>
<p>W8 你是接手的人，拿到一支沒有文件的程式，只能一個一個 VI 打開猜。這一課反過來：你要讓下一個人不用猜。</p>`,
note('為什麼有這一課（資料來源）','台灣的職缺裡，有要「撰寫 SOP」的、要「照 SOP 作業」的、要做教育訓練和客戶端訓練、交機的；寫明「帶人、技術領導」的 5 則裡 4 則是國外的。PTT 上面試 17 家 LabVIEW 職缺的人說，有的公司程式沒有文件、要問同事，有 3 家要出差做技術移轉。整理在 docs/research_handover.md。'),
C.h3('① 三種文件，給三種人看','',''),
C.table(['文件','給誰看','內容','例子'],[
 ['作業指導書（WI）','產線作業員','<b>一個工作站</b>的步驟，配照片；一兩頁','ST01 怎麼測一片、看到 ERROR 怎麼辦'],
 ['SOP','作業員、組長、品保、工程師','一個<b>流程</b>：誰負責、什麼時候、用什麼表單','測試站每天開線檢查（golden sample）、不良品處理流程'],
 ['工程交接文件','接手的工程師','程式怎麼建、怎麼部署、怎麼退版、設定檔、已知問題、出事怎麼處理','PM5 測試站交接包']
]),
warn('ISO 9001 沒有規定格式','ISO 9001:2015 把文件和紀錄統稱「文件化資訊」，要求在必要的範圍內維持（程序、指導）和保存（紀錄、證據），而且要管制版本、核准、發放；但<b>沒有規定 SOP 要長什麼樣子</b>，也沒有規定一定要用技能矩陣（CQI 等二手說明）。格式照公司的文件管理規定。'),
C.h3('② 一頁作業指導書：步驟、要點、理由','','TWI 工作教導'),
`<p>產線最常引用的寫法來自 TWI（二戰時美國的工作教導訓練，後來被日本製造業採用；歷史和寫法出自 LEI 的 TWI 卡片和 Wikipedia，二手）。作業分解表三欄：<b>主要步驟</b>（做什麼）、<b>要點</b>（影響成敗、可能受傷、讓工作比較容易的地方；安全一定是要點）、<b>理由</b>（為什麼）。</p>`,
{fn:twiFig},
ask('作業員只看「步驟」和「要點」就能做，為什麼還要寫「理由」？',`<p>給教的人和以後改 WI 的人看。沒有理由，要點會被當成囉嗦，慢慢被省略：「壓到喀一聲」省掉了，探針接觸不良，好板子被打成 FAIL；大家先懷疑板子，很久才查到是治具（就像 W14，FAIL 率上升最後查到的也是治具，雖然原因不一樣）。TWI 的教法裡，學的人試做時要說出理由，教的人才知道他真的懂。</p>`),
`<p><b>用 WI 教人</b>：TWI 教的四步（LEI 的 TWI 卡片，二手）：<b>讓他準備好</b>（說明這一站做什麼、為什麼重要）→ <b>示範說明</b>（先講步驟，再加要點，再加理由）→ <b>讓他試做</b>（邊做邊說出步驟、要點、理由，做錯當場改）→ <b>追蹤</b>（告訴他有問題找誰，慢慢減少檢查）。TWI 的一句話是：學的人沒學會，是教的人沒教好。</p>`,
C.h3('③ 工程交接包','','只靠文件就能做完'),
C.table(['項目','內容','課程'],[
 ['架構','一張圖：迴圈、模組、儀器、資料流；哪些 VI 是重點','A 系列、H1、H4'],
 ['原始碼和版本','版本庫在哪、分支、目前上線的 tag、怎麼取得','H9'],
 ['建置和部署','建置規格在哪、怎麼產生安裝程式、部署清單','W19'],
 ['<b>退版</b>','出事時怎麼退回上一版、要多久、設定檔怎麼處理','W19'],
 ['設定檔說明','每一個欄位的意思、單位、誰可以改；上下限檔的變更流程','W6、W11、W8'],
 ['存取方式','電腦、帳號、資料庫在哪裡、找誰申請；<b>不要把密碼寫在文件裡</b>；聯絡人寫角色（例如「IT 窗口」「品保主管」），不寫個人電話','W9、W17'],
 ['<b>已知問題</b>','還沒修的問題、嚴重程度、暫時的處理方法；沒處理完的審查意見','H3'],
 ['處理手冊（runbook）','常見異常怎麼判斷和處理：ERROR 和 FAIL、儀器掉線、MES 上傳失敗、良率突然掉','W6、W14、W17'],
 ['測試','怎麼跑 Run_All_Tests、預期看到什麼；測試計畫和最近一次驗證報告','H5、H8'],
 ['未完成事項','還在進行的工作、下一步、負責人和期限','—']
]),
ask('怎麼知道這份交接包寫得夠不夠？',`<p>找一個沒碰過這套系統的人（最好是最資淺的那位），<b>只給他文件</b>，請他做兩件事：一次換版（W19：建置、部署、驗收、必要時退版），一次異常處理（例如 W14：ST02 的 FAIL 率突然上升）。他卡住、要問你的每一個地方，就是文件要補的地方。你在旁邊只看、不出聲。</p>`),
C.h3('④ VI 本身的文件','','H6 的文件分數就是在要求這個'),
`<ul><li><b>VI 說明</b>（VI Properties ▸ Documentation）：這個 VI 做什麼、輸入輸出的單位和範圍、錯誤時怎麼處理。</li>
<li><b>每一個控制項和指示器</b>的說明和 tip strip；複製控制項時記得改說明（NI 的驅動程式開發指引特別提醒這一點）。</li>
<li>方塊圖上的註解：狀態機每一頁做什麼、為什麼這樣寫（不是寫「這裡加 1」）。</li>
<li><b>輸出成文件</b>：NI 的說明寫，File ▸ Print 可以把一個或多個 VI 的文件輸出成 HTML、RTF 或純文字，內容可以選圖示、接線板、前面板、方塊圖、說明、階層、SubVI 清單、修訂歷史。交接包可以附一份 HTML，接手的人不用開 LabVIEW 也能先看。（這一點出自 NI 說明的非官方鏡像，LadderLab 沒有用腳本實測。）</li></ul>`,
C.h3('⑤ 帶新人：技能矩陣和訓練時程','',''),
{fn:skillFig},
`<p>技能矩陣加上「誰在什麼日期前學會哪一項」，就是訓練時程表。ISO 9001 要求保存人員能力的證據，技能矩陣是常見的做法之一，但不是唯一的。</p>`,
C.h3('⑥ 作業','','另外約 3～4 小時'),
`<p>兩個空白範本，複製到 Word 或 Excel 用：</p>`,
`<pre style="background:#f4f6f9;padding:8px;border-radius:4px;white-space:pre-wrap;font-size:12px">【作業指導書】站別：＿＿　文件編號：＿＿　版本：＿＿　核准：＿＿　日期：＿＿
| 步驟 | 主要步驟 | 要點 | 理由 | 照片 |
|  1   |          |      |      |      |
安全注意：＿＿　使用的工具／儀器：＿＿　異常時找：＿＿（角色）</pre>`,
`<pre style="background:#f4f6f9;padding:8px;border-radius:4px;white-space:pre-wrap;font-size:12px">【工程交接包】系統：＿＿　交接人：＿＿　接手人：＿＿　日期：＿＿
1 架構　2 原始碼和版本　3 建置和部署　4 退版　5 設定檔說明
6 存取方式（不寫密碼）　7 已知問題　8 處理手冊　9 測試　10 未完成事項</pre>`,
`<ol><li>幫 W6 的 ST01 寫一頁 WI（TWI 三欄），用自己拍的照片或示意圖；給一位沒做過的同學照著做一次，記下他卡住的地方，改一版。</li>
<li>寫一份「W8 那時候你希望拿到的交接文件」：照 ③ 的十項，寫 PM5 測試站（可以用課程裡的 W6～W19 當內容）。</li>
<li>交換作業：只靠同學的交接文件，做一次換版（W19）和一次異常處理（W14），把卡住的地方回饋給他。</li></ol>`,
C.h3('測','q','小測驗'),
{quiz:[
 {q:'給產線作業員看的是？',o:['作業指導書（WI）：一個工作站的步驟，配照片','工程交接文件','VI 的方塊圖','測試計畫'],a:0,ex:'交接文件是給接手的工程師看的。'},
 {q:'TWI 作業分解表的三欄是？',o:['主要步驟、要點、理由','步驟、時間、成本','輸入、處理、輸出','誰、何時、何地'],a:0,ex:'安全一定是要點。'},
 {q:'工程交接包裡最常被漏掉、出事時最要命的是？',o:['退版方法和已知問題','程式的作者介紹','LabVIEW 的安裝畫面','每個 VI 的檔案大小'],a:0,ex:'出事時要能退回上一版；沒修完的問題要寫出來。'},
 {q:'交接文件裡可以寫資料庫的密碼嗎？',o:['不要，寫在哪裡申請、找誰','可以，比較方便','寫在最後一頁','用注音寫'],a:0,ex:'文件會被轉寄、印出來。'},
 {q:'怎麼驗收交接文件？',o:['請沒碰過的人只靠文件做一次換版和一次異常處理','自己再讀一遍','給主管簽名','數頁數'],a:0,ex:'他卡住的地方就是要補的地方。'},
 {q:'ISO 9001 規定 SOP 一定要用某種格式嗎？',o:['沒有，要求管制版本、核准、發放，格式照公司規定','有，一定要用 TWI','一定要用技能矩陣','一定要用 Word'],a:0,ex:'技能矩陣也不是強制的。'}
]}
]});
})();
