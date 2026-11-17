/* 高階實務 H8：寫測試計畫和驗證報告，從 EVT、DVT 到量產。
   證據（docs/research_testplan.md）：資深職缺多出「測試計畫、驗證與確認、文件」（多為國外對照）；台灣 104 搜尋摘要 N01～N04 寫 EVT／DVT 驗證、
   寫測試計畫和測試案例、可靠度、ORT；初階職缺 Y51、Y53、N02 也要寫計畫。EVT／DVT／PVT／MP 沒有官方標準定義，各家說法互相矛盾（只有二手）。
   測試計畫欄位參考 IEEE 829（已被 ISO/IEC/IEEE 29119-3 取代）的公開摘要（二手）；驗證／確認定義引 ISO 9000:2015（IEC Electropedia 轉引）；
   MSA 10%／30%、Ppk 1.67、Cpk 1.33 是二手轉述 AIAG，實際看客戶；台灣強制檢驗要指定試驗室報告（法規名稱來自搜尋摘要）。
   Cpk 計算器的資料是 LadderLab 自己產生的模擬值。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='高階實務';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary><div class="ans">${a}</div></details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;

/* ---- 找出測試計畫草稿的漏洞 ---- */
const DRAFT=[
 {t:'T02 無載輸出電壓：4.90～5.10 V，用 DMM 量',bad:true,why:'少了規格來源（哪一份規格書、第幾版）、量測條件（負載、輸入電壓、等多久才讀，W15）、DMM 的型號和校正到期日。沒有這些，別人照計畫做出來的數字可能不一樣。'},
 {t:'樣本數：「幾片」',bad:true,why:'要寫明數量和怎麼挑：例如 DVT 每個測項至少 N 片、來自至少 2 批料；數量的理由寫上去（客戶要求、統計需要、時程）。'},
 {t:'判定：量到的值在上下限內就 PASS',bad:true,why:'少了「量不到」的情況：儀器錯誤、讀值異常要判 ERROR，不是 FAIL（W6、H2）；上下限含不含端點要寫明（W13）。'},
 {t:'暫停條件：沒有寫',bad:true,why:'什麼情況要先停下來：例如同一個測項連續 3 片 FAIL、golden sample 驗證不過、儀器校正過期。不寫的話，會有人帶著壞掉的測試站一直測下去。'},
 {t:'環境：室溫',bad:true,why:'寫數字和範圍（例如 25 ± 3 °C），還有誰量、用什麼量。高低溫測試另外列。'},
 {t:'風險：「無」',bad:true,why:'一定有：例如治具的繼電器在量測路徑上（W10）、高溫時接觸電阻變大、樣品數少統計不夠。寫出來，並寫怎麼降低。'},
 {t:'變更紀錄：版本 1.0、日期、作者',bad:false,why:'這樣寫是對的。之後每次改測項、改上下限，都要加一行（W8）。'},
 {t:'交付：驗證報告、原始資料、測試程式版本',bad:false,why:'這樣寫是對的。測試程式的版本要和報告綁在一起，才知道是用哪一版測的（W19）。'}
];
function draftFig(el){
  el.className='fig';el.style.cssText='border:1px solid #d9cfe8;border-radius:6px;padding:10px 12px;background:#fbf9ff;font-size:13px';
  el.innerHTML=`<p style="margin:0 0 6px">這是新人寫的測試計畫草稿裡的幾行。勾選你認為<b>要退回補寫</b>的：</p>
   ${DRAFT.map((d,i)=>`<label style="display:block;margin:3px 0"><input type="checkbox" data-i="${i}"> ${d.t}</label>`).join('')}
   <button data-a="chk" style="margin-top:6px">對答案</button><div data-o="out" style="margin-top:8px"></div>`;
  el.querySelector('[data-a=chk]').onclick=()=>{
    el.querySelector('[data-o=out]').innerHTML=DRAFT.map((d,i)=>{const on=el.querySelector(`[data-i="${i}"]`).checked,ok=on===d.bad;
      return `<div style="border-left:3px solid ${ok?'#1e7b34':'#c0392b'};padding:2px 8px;margin:5px 0"><b style="color:${ok?'#1e7b34':'#c0392b'}">${ok?'✓':'✗'}</b> ${d.t}<details style="color:#444"><summary style="cursor:pointer;color:#1d4fa0">為什麼</summary>${d.why}</details></div>`;}).join('');
  };
}

/* ---- Cpk 計算器（模擬資料） ---- */
function rng(seed){let s=seed;return()=>{s=(s*1103515245+12345)%2147483648;return s/2147483648;};}
function sample(mu,sd,n,seed){const r=rng(seed),a=[];for(let i=0;i<n;i+=2){const u=Math.max(r(),1e-9),v=r(),m=Math.sqrt(-2*Math.log(u));a.push(mu+sd*m*Math.cos(2*Math.PI*v));a.push(mu+sd*m*Math.sin(2*Math.PI*v));}return a.slice(0,n);}
const SETS=[
 {t:'PVT：30 片，製程穩定',mu:5.01,sd:0.012},
 {t:'平均偏高（某一批料）',mu:5.06,sd:0.012},
 {t:'散佈變大（換了治具，接觸不穩）',mu:5.01,sd:0.03},
 {t:'只有 5 片（EVT 的數量）',mu:5.01,sd:0.012,n:5}
];
function cpkFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff;font-size:13px';
  el.innerHTML=`<label>T02 的量測資料 <select data-k="s">${SETS.map((s,i)=>`<option value="${i}">${s.t}</option>`).join('')}</select></label>　規格 4.90～5.10 V
   <svg data-o="g" viewBox="0 0 520 120" style="width:100%;max-width:520px;display:block;margin:8px 0"></svg><div data-o="out"></div>`;
  function draw(){
    const S=SETS[+el.querySelector('select').value],x=sample(S.mu,S.sd,S.n||30,7+(+el.querySelector('select').value));
    const n=x.length,mu=x.reduce((a,b)=>a+b,0)/n,sd=Math.sqrt(x.reduce((a,b)=>a+(b-mu)**2,0)/(n-1));
    const LSL=4.90,USL=5.10,cp=(USL-LSL)/(6*sd),cpk=Math.min(USL-mu,mu-LSL)/(3*sd);
    const X=v=>20+(v-4.85)/(0.30)*480;
    let g=`<line x1="${X(LSL)}" y1="10" x2="${X(LSL)}" y2="100" stroke="#c0392b" stroke-dasharray="4 3"/><line x1="${X(USL)}" y1="10" x2="${X(USL)}" y2="100" stroke="#c0392b" stroke-dasharray="4 3"/>`;
    g+=`<text x="${X(LSL)}" y="114" font-size="10" text-anchor="middle">4.90</text><text x="${X(USL)}" y="114" font-size="10" text-anchor="middle">5.10</text><text x="${X(5.0)}" y="114" font-size="10" text-anchor="middle">5.00</text>`;
    x.forEach((v,i)=>{g+=`<circle cx="${X(v)}" cy="${30+(i%8)*8}" r="3" fill="#1d4fa0" opacity=".7"/>`;});
    g+=`<line x1="${X(mu)}" y1="20" x2="${X(mu)}" y2="100" stroke="#1e7b34"/><line x1="${X(mu-3*sd)}" y1="96" x2="${X(mu+3*sd)}" y2="96" stroke="#1e7b34" stroke-width="3"/>`;
    el.querySelector('[data-o=g]').innerHTML=g;
    el.querySelector('[data-o=out]').innerHTML=`n = ${n}，平均 ${mu.toFixed(4)} V，標準差 ${sd.toFixed(4)} V　→　Cp = ${cp.toFixed(2)}，<b style="color:${cpk>=1.33?'#1e7b34':cpk>=1?'#b9770e':'#c0392b'}">Cpk = ${cpk.toFixed(2)}</b>
     <div style="color:#555;margin-top:4px">${S.n?'只有 5 片時，標準差本身就很不準，算出來的 Cpk 可能差很多：不要拿 EVT 的幾片資料宣稱製程能力。':cpk>=1.33?'常見的量產要求是 Cpk ≥ 1.33（二手轉述 AIAG；實際看客戶）。':Math.abs(mu-5.0)>0.04?'散佈不大，但整體偏一邊：Cpk 掉下來是因為「不置中」。看 Cp 和 Cpk 的差就知道。':'散佈變大，兩邊都靠近規格：先查量測系統（重複性、治具），再查製程。'}</div>`;
  }
  el.querySelector('select').onchange=draw;draw();
}

L.push({id:'H8',order:47,no:'H8',part:PART,title:'寫測試計畫和驗證報告：從 EVT、DVT 到量產，每一個數字都追得回去',mins:70,files:[],
goals:[['學會','知道 EVT／DVT／PVT／MP 常見的意思（以及它們沒有標準定義）；測試計畫每個測項要寫哪些欄位、整份計畫要有哪些章；驗證和確認的差別；重複性、GR&R、Cpk 各看什麼、先後順序；驗證報告怎麼逐項對回計畫'],
 ['工作上','台灣電子業的測試職缺會寫「EVT／DVT 驗證、寫測試計畫和測試案例」；初階職缺也有要寫計畫的，資深多出來的是規劃驗證策略、對客戶負責'],
 ['用到','W6（限值檔、ERROR 和 FAIL、重複性）、W8（變更）、W10、W16（量測路徑）、W14（SPC）、W15（量測條件）、W19（驗收）、H2（TestStand 的判定）、H5（測試程式的驗證）']],
check:'不看課文，能說出：一個測項在計畫裡至少要有哪些欄位；為什麼要有暫停條件；驗證和確認差在哪；為什麼要先做 GR&R 再算 Cpk；為什麼 EVT 的 5 片資料不能拿來說製程能力。',
body:[
C.h3('這一課的工作','x','新產品要進 DVT 了'),
`<p>PM5 的下一代 PM6 要進 DVT。主管說：「下週一給我測試計畫；DVT 結束要交驗證報告，PVT 前要確認產線測試站可以用。」你以前都是照別人的計畫測，這次要自己寫。</p>`,
note('為什麼有這一課（資料來源）','104 的搜尋摘要裡有台灣職缺寫「EVT／DVT 驗證」「撰寫硬體測試計畫和測試案例」「新品可靠度驗證、量產 ORT」；初階職缺也有要寫測試計畫的。資深職缺多出來的是規劃驗證策略、對客戶報告、帶人。整理在 docs/research_testplan.md。'),
C.h3('① EVT、DVT、PVT、MP','','常見的意思，不是標準'),
warn('這幾個詞沒有官方定義','助理查不到任何標準或台灣大廠公開的定義，找到的說法互相矛盾：DVT 的 V 有人寫 Verification、有人寫 Validation；「確認能量產」有人放在 DVT、有人放在 PVT；每個階段做幾台，差到十倍以上。<b>進公司後，以那家公司的流程文件為準</b>。下表是常見的用法，當作參考。'),
C.table(['階段','常見的目的','樣品','測試工程師常做的事'],[
 ['EVT（工程驗證）','設計做得出來嗎？功能對不對','少量、手工或試產線，零件可能還會換','功能測試、找設計問題；測試站多半還是手動或半自動'],
 ['DVT（設計驗證）','設計符合規格嗎？各種條件下都符合嗎','接近量產的設計','照測試計畫做完整驗證：功能、邊界、環境（高低溫）、可靠度；安規、EMC 前測；產測站和測試程式也在這時候驗證'],
 ['PVT（生產驗證）','用量產的線、料、站做得出來嗎','量產線、量產料','產測站上線、GR&R、良率和 Cpk、作業員訓練（W19 的驗收）'],
 ['MP（量產）','穩定出貨','—','監控良率和 SPC（W14）、處理客訴（W9）、變更管理（W8）']
]),
note('安規和 EMC','台灣的強制檢驗要用指定試驗室的報告（試驗室要符合 ISO/IEC 17025）；公司內部做的通常是前測和改善。這部分是助理從法規的搜尋摘要看到的，細節以標準檢驗局的公告為準。'),
C.h3('② 測試計畫寫什麼','','每個測項一列'),
`<p>軟體測試的標準（IEEE 829，後來被 ISO/IEC/IEEE 29119-3 取代）列了一份測試計畫該有的章：範圍、方法、通過與失敗準則、暫停條件、交付物、環境、時程、人員、風險。硬體驗證可以借這個骨架。每一個測項，至少寫這幾欄：</p>`,
C.table(['欄位','例子（T02）','為什麼'],[
 ['規格來源','PM6 規格書 v1.2 第 3.4 節','規格改了，知道要改哪幾項'],
 ['量測方法和條件','無載、輸入 12.0 V、上電後等穩定（W15 的判斷）才讀','別人照做會得到一樣的數字'],
 ['儀器','DMM 型號、序號、校正到期日；治具編號','儀器過期或換了，結果要能追'],
 ['樣本數','每一項至少 N 片，來自至少 2 批料（寫理由）','數量太少，結論不可信'],
 ['判定','4.90～5.10 V（含兩端）；量不到判 ERROR','和程式一致（W6、W13、H2）'],
 ['暫停條件','同一測項連續 3 片 FAIL，或 golden sample 不過','避免用壞掉的測試站一直測'],
 ['負責人、時程','誰測、哪一天','卡住時知道找誰'],
 ['風險','治具繼電器在量測路徑上（W10）','先想好怎麼確認']
]),
{fn:draftFig},
C.h3('③ 驗證和確認','',''),
`<p>ISO 9000 的定義（經 IEC 的術語庫轉引）：<b>驗證（verification）</b>是確認「規定的要求已經達到」；<b>確認（validation）</b>是確認「特定的預期用途已經達到」。用 PM6 說：</p>
<ul><li>驗證：輸出電壓 4.90～5.10 V、效率 ≥ 85 %，每一條規格都量過、都符合。</li>
<li>確認：裝進客戶的機器、在客戶的使用情境下（開機湧流、長時間滿載、插拔）真的好用。規格全過，不代表確認一定過。</li></ul>`,
C.h3('④ 重複性、GR&R、Cpk','','先確定量得準，再看做得好不好'),
C.table(['','看什麼','課程'],[
 ['重複性','同一片、同一個人、同一個治具量很多次的散佈','W6（量 10 次）'],
 ['GR&R','重複性＋再現性（換操作員、換治具、量好幾片不同的板子）；結果常用「量測變異占公差的比例」表示','W6 只做了重複性；W16 兩個治具的比較是再現性的一部分'],
 ['SPC 管制圖','製程隨時間有沒有變（W14 用的是看 FAIL 率的 p 管制圖，計數值）','W14'],
 ['Cpk','量測值的分布離規格多遠（計量值）：Cpk = min(上限 − 平均, 平均 − 下限) ÷ (3 × 標準差)','這一課']
]),
warn('順序：先 GR&R，再 Cpk','測試站本身的散佈大，量到的分布就會變寬，Cpk 會被量測系統拖下來，你會以為是製程不好。所以要先確認量測系統夠好（常見的門檻：量測變異占公差 10 % 以下很好、30 % 以上不能用，二手轉述 AIAG），再算 Cpk。'),
{fn:cpkFig},
note('門檻看客戶','常見的說法是量產要 Cpk ≥ 1.33、導入時要 Ppk ≥ 1.67（二手轉述 AIAG 的汽車業手冊）。實際的門檻寫在客戶的要求裡，不是定律。'),
C.h3('⑤ 驗證報告','','每一列都對回計畫'),
C.table(['章節','內容'],[
 ['摘要','結論一句話（例如「T01～T06 全部符合，T05 高溫時邊緣，建議…」）、範圍、版本'],
 ['測試對象','樣品序號、批號、硬體版本、<b>測試程式版本</b>（W19、H5）'],
 ['結果表','每個測項一列，和計畫的編號一樣：規格、樣本數、最小／平均／最大、Cpk（如果要）、判定'],
 ['偏離','和計畫不一樣的地方（少測了幾片、換了儀器）和理由'],
 ['問題清單','FAIL 和 ERROR 的分析、原因、處理狀況（W14 的做法）'],
 ['附錄','原始資料檔的位置、儀器校正證明、測試程式的驗證（H5 的 Run_All_Tests 結果）']
]),
ask('DVT 驗證報告寫「T02 全部 PASS」。主管問：「用哪一版測試程式測的？那一版的上下限是不是 4.90～5.10？」你答不出來，會怎樣？',`<p>報告就不能用：如果那一版程式剛好是 W13 那種「上限不含」或上下限設錯，整份數字都要重測。所以報告要寫程式版本，程式的上下限要和計畫一致，而且這件事本身要有證據（H5 的測試結果、W8 的變更紀錄）。</p>`),
C.h3('⑥ 課程裡已經有的東西，放進一份計畫','',''),
C.table(['計畫的章節','課程'],[
 ['判定和上下限','W6 的限值檔、W13 的含不含上限、H2 的 Numeric Limit Test'],
 ['量測方法、等待時間','W15、W16'],
 ['量測路徑和已知風險','W10（繼電器）、W16（雙治具）'],
 ['測試程式的驗證','H5（單元測試）、W8（回歸）'],
 ['變更紀錄','W8'],
 ['產測站驗收（PVT）','W19'],
 ['量產監控','W14（SPC）＋這一課的 Cpk']
]),
C.h3('⑦ 作業','',''),
`<ol><li>照 ② 的欄位，幫 W6 的 T01～T05 寫一份測試計畫（Excel 或 Word 都可以），每一項都要有規格來源、方法、儀器、樣本數、判定、暫停條件。</li>
<li>用 W6 的資料（或自己模擬 30 片），寫一份一頁的驗證報告：結果表要對回你的計畫編號，T02 算 Cpk。</li>
<li>互相審查（H3 的方式）：拿同學的計畫，找出三個「照著做會做出不一樣結果」的地方。</li></ol>`,
C.h3('測','q','小測驗'),
{quiz:[
 {q:'DVT 的 V 是 Verification 還是 Validation？',o:['各家說法不同，以公司的流程文件為準','一定是 Verification','一定是 Validation','DVT 沒有 V'],a:0,ex:'這幾個詞沒有官方標準定義。'},
 {q:'測試計畫為什麼要寫暫停條件？',o:['避免用壞掉的測試站一直測下去','讓測試快一點','法律規定','給主管看'],a:0,ex:'例如連續 FAIL、golden sample 不過、儀器過期。'},
 {q:'驗證和確認的差別？',o:['驗證：規定的要求達到了；確認：預期的用途達到了','完全一樣','驗證是軟體、確認是硬體','確認比較便宜'],a:0,ex:'規格全過，不代表在客戶的情境下一定好用。'},
 {q:'為什麼要先做 GR&R 再算 Cpk？',o:['量測系統的散佈會讓 Cpk 變小，誤以為是製程不好','Cpk 比較難算','GR&R 是法規','順序沒關係'],a:0,ex:'先確定量得準。'},
 {q:'W6「同一片量 10 次」做的是？',o:['重複性，只是 GR&R 的一部分','完整的 GR&R','Cpk','SPC'],a:0,ex:'GR&R 還要看換人、換治具的再現性。'},
 {q:'EVT 只有 5 片資料，算出 Cpk = 2.1，可以說製程能力很好嗎？',o:['不行，樣本太少，標準差不準','可以','只要大於 1.33 就可以','EVT 不能量測'],a:0,ex:'而且 EVT 的料和製程都還會變。'},
 {q:'驗證報告一定要寫的是？',o:['樣品、測試程式版本、每一項對回計畫編號的結果','只寫 PASS','只寫結論','作業員名字'],a:0,ex:'數字要追得回去。'}
]}
]});
})();
