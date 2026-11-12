/* 起步：Quick Drop 的設定與 Ctrl 快捷鍵（接在 L01 後面）。
   設定畫面：使用者的 LabVIEW（Tools » Options » Menu Shortcuts，2026-11-12 截圖）：View ▸ Quick Drop 的 Default 欄是 Ctrl+Space，被改成 Ctrl+&#96;。
   Quick Drop 開著時的 Ctrl 快捷鍵：LabVIEW Wiki「Quick Drop」條目（社群整理、CC BY 3.0；NI 官方表格這次沒讀到內文），
   清單以每台 LabVIEW 的 Quick Drop ▸ Configure ▸ Ctrl-Key Shortcuts 為準。一般模式的 Ctrl+W／O／T 是 LabVIEW 的標準選單快捷鍵。 */
(function(){
const L=window.LESSONS;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const k=s=>s.split('+').map(x=>`<kbd>${x}</kbd>`).join('+');
const steps=list=>`<ol class="mr-steps">${list.map(s=>`<li>${s}</li>`).join('')}</ol>`;
const ui=s=>`<b class="mr-ui">${s}</b>`;

L.push({id:'L01Q',order:1.5,no:'1+',part:'起步',title:'Quick Drop：設定快捷鍵，和 Ctrl+W、Ctrl+O、Ctrl+T',mins:30,
goals:[['學會','Quick Drop 打不開時，怎麼到 Options 改快捷鍵；Quick Drop 開著時，選好物件再按 Ctrl 鍵能做哪些事；為什麼同一個 Ctrl+W、Ctrl+T，Quick Drop 開著和沒開著是不同的功能。'],['做出','把 Quick Drop 設成自己按得到的組合鍵；用 Quick Drop 的 Ctrl+D、Ctrl+W、Ctrl+T 在十秒內接好 L01 的加法。'],['為什麼','寫 LabVIEW 大部分時間花在「找函式、拉線」。Quick Drop 用熟了，速度差好幾倍。']],
check:'你能說出：Ctrl+Space 按了沒反應時去哪裡改；一般模式下 Ctrl+W、Ctrl+O、Ctrl+T 做什麼；Quick Drop 開著時 Ctrl+W、Ctrl+T 做什麼；Quick Drop 的 Ctrl 鍵要「先選物件」還是「先打名字」。',
body:[
C.h3('情境','x','按了 Ctrl+Space，輸入法切換了，Quick Drop 沒出來'),
`<p>L01 教了 Quick Drop：在方塊圖按 ${k('Ctrl+Space')}，打函式名字直接放下。可是在中文 Windows 上，${k('Ctrl+Space')} 常常是<b>切換輸入法</b>的快捷鍵：按下去，輸入法換了，Quick Drop 沒出來。</p>`,
ask('問題出在 LabVIEW 還是 Windows？要改哪一邊？',
 `<p>兩邊搶同一組按鍵，Windows 先拿走了。可以改 Windows 的輸入法快捷鍵，也可以改 LabVIEW。改 LabVIEW 比較單純，只影響 LabVIEW，不會讓你打中文的習慣跟著變。</p>`),

C.h3('第 1 步','','到 Options 改 Quick Drop 的快捷鍵'),
steps([`LabVIEW 選單 ${ui('Tools')} ▸ ${ui('Options…')}。`,
 `左邊 ${ui('Category')} 選 ${ui('Menu Shortcuts')}。`,
 `右邊的清單往下捲，在 ${ui('View')} 底下點 ${ui('Quick Drop')}。`,
 `點一下 ${ui('Shortcut (Press key combination)')} 那一格，<b>直接按</b>你要的組合鍵（不是用打字的），例如 ${k('Ctrl+`')}（數字 1 左邊那個鍵）。`,
 `按 ${ui('Set')}，再按 ${ui('OK')}。`]),
`<figure class="mr-shot"><img src="img/env/quickdrop_shortcut.png" alt="LabVIEW Options 視窗的 Menu Shortcuts：View 底下的 Quick Drop 被選取，Shortcut 欄是 Ctrl+&#96;，Default 欄是 Ctrl+Space" loading="lazy"><figcaption>實機畫面（LabVIEW 2018）：Quick Drop 的 Shortcut 改成 Ctrl+&#96;，右邊 Default 欄還看得到原本的 Ctrl+Space。想改回來，按 Restore。</figcaption></figure>`,
ask('畫面上 Shortcut 和 Default 兩欄，各是什麼？',
 `<p><b>Default</b> 是這台 LabVIEW 原本的設定，<b>Shortcut</b> 是現在用的。改壞了，選那一列按 ${ui('Restore')} 回到 Default；全部改亂了，按 ${ui('Restore All')}。</p>
<p>網路上有人說中文 Windows 的 Quick Drop 預設是 ${k('Ctrl+Shift+Space')}。你的 LabVIEW 到底是哪一個，<b>看這裡的 Default 欄最準</b>：這張實機畫面的 Default 就是 ${k('Ctrl+Space')}。</p>`),
ask('選哪一組按鍵比較好？',
 `<p>三個條件：一隻手按得到（常用）、不跟 Windows 或輸入法衝突、不跟 LabVIEW 其他快捷鍵重複。${k('Ctrl+`')} 很常見：左手小指按 Ctrl、無名指按 \`，而且 LabVIEW 和中文輸入法一般都沒用到它。</p>
<p>設好之後，同一間教室、同一個團隊最好用同一組，互相支援時才不會按錯。</p>`),
warn('畫面最下面那一行','Options 視窗寫著：這些選單快捷鍵只在 VI 視窗（前面板、方塊圖）裡有效。在專案總管裡按，不會打開 Quick Drop。'),

C.h3('第 2 步','','一般模式的 Ctrl+W、Ctrl+O、Ctrl+T'),
`<p>Quick Drop <b>沒有打開</b>的時候，這三個是 LabVIEW 視窗的一般快捷鍵：</p>`,
C.table(['按鍵','功能（一般模式）','注意'],[
 [k('Ctrl+W'),'關閉目前的視窗','關的是 VI 時，前面板和方塊圖一起關；還沒存檔會先問你'],
 [k('Ctrl+O'),'開啟檔案（VI、專案）','myRIO 的 VI 不要這樣直接開，要從專案開（M02）'],
 [k('Ctrl+T'),'前面板和方塊圖左右並排','一邊放控制項、一邊看方塊圖']
]),

C.h3('第 3 步','','Quick Drop 開著時，Ctrl 鍵變成另一套'),
`<p>Quick Drop 不只會「放東西」。<b>先在方塊圖選好物件，再打開 Quick Drop，然後按 Ctrl 加一個字母</b>，它會對選起來的物件做事。這時候同樣的 ${k('Ctrl+W')}、${k('Ctrl+T')}，意思跟一般模式完全不同。</p>`,
C.table(['Quick Drop 開著時','做什麼','先選什麼'],[
 [k('Ctrl+D'),'幫選起來的物件，所有沒接線的端子建立控制項和指示器，並且接好','一個函式'],
 [k('Ctrl+Shift+D'),'幫沒接線的輸入建立常數','一個函式'],
 [k('Ctrl+W'),'把選起來的幾個物件接在一起','兩個以上要相接的物件'],
 [k('Ctrl+T'),'把控制項端子的標籤移到左邊、指示器的標籤移到右邊（整理標籤）','幾個端子'],
 [k('Ctrl+R'),'刪掉選起來的物件，前後的線自動接起來','中間那個要拿掉的物件'],
 [k('Ctrl+I'),'把 Quick Drop 裡打的那個函式，插進選起來的線上','一條線（再在 Quick Drop 打函式名）'],
 [k('Ctrl+P'),'把選起來的物件換成 Quick Drop 裡打的那個','要換掉的物件（再打新的名字）']
]),
note('這張表從哪裡來','整理自 LabVIEW Wiki 的 Quick Drop 條目（社群維護）。每台 LabVIEW 可以自訂、也可能裝了外掛，<b>以你自己的為準</b>：打開 Quick Drop ▸ 按 Configure ▸ 選 Ctrl-Key Shortcuts，就看得到這台全部的 Ctrl 鍵和它們的功能。Ctrl+O 在 Quick Drop 開著時有沒有功能，也在這裡確認。'),
ask('為什麼要「先選物件，再開 Quick Drop」？',
 `<p>因為這些 Ctrl 鍵是對「選起來的東西」做事：Quick Drop 要知道你要幫誰建控制項、把誰接在一起。沒有選任何東西就按 ${k('Ctrl+W')}，它不知道要接什麼。</p>
<p>${k('Ctrl+I')}、${k('Ctrl+P')} 多一步：先選線或物件 → 開 Quick Drop → <b>打新函式的名字</b> → 再按 Ctrl 鍵。</p>`),
ask('Quick Drop 開著時按 Ctrl+W，視窗會被關掉嗎？',
 `<p>不會。Quick Drop 開著時，Ctrl 鍵先交給 Quick Drop 處理：${k('Ctrl+W')} 是接線，不是關視窗。關掉 Quick Drop（按 Esc 或點別的地方）之後，${k('Ctrl+W')} 才又變回關視窗。</p>
<p>所以按之前先看一眼：Quick Drop 的小視窗有沒有開著。</p>`),

C.h3('第 4 步','','十秒做完 L01 的加法'),
steps([`方塊圖按 Quick Drop 的快捷鍵，打 ${ui('Add')}，Enter，點一下放下。`,
 `Add 還選著，再開 Quick Drop，按 ${k('Ctrl+D')}：兩個輸入、一個輸出的控制項和指示器一次建好、接好。`,
 `框選三個端子，開 Quick Drop，按 ${k('Ctrl+T')}：控制項的標籤到左邊、指示器的標籤到右邊，圖一下子整齊了。`,
 `換到前面板，把三個物件改名：Right Count、Left Count、Total。`]),
ask('Ctrl+D 建出來的控制項，名字是什麼？',
 `<p>它用函式端子的名字（Add 是 x、y、x+y）。功能對了，但看不出意思：<b>建完一定要改名</b>，跟 M16 說的一樣，名字是給下一個看程式的人看的。</p>`),
tip('練熟的順序','先只用 Quick Drop 放東西（一週）→ 加上 Ctrl+D（建控制項）→ 加上 Ctrl+R、Ctrl+I（改程式時最省時間）。一次學一個，用到變成反射動作再學下一個。'),

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'中文 Windows 按 Ctrl+Space，輸入法切換了，Quick Drop 沒出來。在 LabVIEW 裡去哪裡改？',o:['Tools ▸ Options ▸ Menu Shortcuts ▸ View ▸ Quick Drop','File ▸ VI Properties','Tools ▸ Options ▸ Block Diagram','NI MAX'],a:0,ex:'點 Shortcut 欄、直接按新的組合鍵、按 Set。'},
 {q:'想知道這台 LabVIEW 的 Quick Drop 原本是哪一組鍵，看哪裡最準？',o:['Options ▸ Menu Shortcuts 的 Default 欄','網路文章','LabVIEW 的安裝光碟','問同學'],a:0,ex:'不同語系、不同版本可能不一樣。'},
 {q:'Quick Drop 沒開時，Ctrl+T 是？',o:['前面板和方塊圖左右並排','整理端子標籤','建立常數','刪掉物件'],a:0,ex:'Quick Drop 開著時才變成整理標籤。'},
 {q:'Quick Drop 開著、選了兩個物件，按 Ctrl+W 會？',o:['把它們接在一起','關閉視窗','開檔','存檔'],a:0,ex:'Quick Drop 開著時，Ctrl 鍵先交給 Quick Drop。'},
 {q:'選一個 Add，開 Quick Drop 按 Ctrl+D，會？',o:['建好並接上所有沒接線端子的控制項和指示器','刪掉 Add','把 Add 換掉','什麼都不會'],a:0,ex:'建完記得改名。'},
 {q:'要把一個函式插進一條已經接好的線上，順序是？',o:['選線 → 開 Quick Drop → 打函式名 → Ctrl+I','開 Quick Drop → Ctrl+I → 選線','Ctrl+B','先刪線再重拉'],a:0,ex:'Ctrl+P 也是「先選、再打名字、再按 Ctrl 鍵」。'}
]}
]});
})();
