/* 第九部分：myRIO（M01、M02）——第一次接上、開專案、以後怎麼再啟動。環境：LabVIEW 2018。
   硬體事實：NI myRIO-1900 User Guide and Specifications（376047）：Zynq-7010、667 MHz 雙核、512 MB 非揮發記憶體、256 MB DDR3；
   MXP A/B、MSP C 腳位；電源 6～16 VDC；Status LED 閃爍次數；Reset 按 5 秒進 safe mode；USB host port 裝置對應 /U。
   軟體：myRIO Toolkit 只支援 32 位元 LabVIEW（NI 2018 myRIO Toolkit Readme）；需要 LabVIEW、Real-Time Module、myRIO Toolkit（NI myRIO Software Bundle Readme）；
   USB 連線位址 172.22.11.2；插上 USB 出現 myRIO USB Monitor，選 Launch the Getting Started Wizard；Set Up and Explore ▸ Launch the I/O Monitor；
   專案：Create Project ▸ myRIO ▸ myRIO Project ▸ Plugged into USB；或 Empty Project ▸ New ▸ Targets and Devices ▸ Discover an existing target（NI RIO Developer Essentials Guide）。
   myRIO Project 範本的 Main.vi 內容、從資料夾直接開 Main.vi 時標題列變成「on ….lvproj/My Computer」且執行箭頭斷掉，
   都照實機畫面（2026-11-12 使用者提供的截圖）描述。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='myRIO 嵌入式控制';
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const steps=list=>`<ol class="mr-steps">${list.map(s=>`<li>${s}</li>`).join('')}</ol>`;
const ui=s=>`<b class="mr-ui">${s}</b>`;
const TGT='NI-myRIO-1900-xxxxxxxx';
const tree=(rows)=>`<div class="mr-tree fig" role="img" aria-label="Project Explorer 的樹狀結構">${rows.map(r=>`<div style="padding-left:${r[0]*18}px"><span class="mr-ic">${r[1]}</span> ${r[2]}${r[3]?`<small>　← ${r[3]}</small>`:''}</div>`).join('')}</div>`;

/* =============================== M01 =============================== */
L.push({id:'M01',order:30.1,no:'M1',part:PART,title:'myRIO 是什麼：程式不在你的電腦上跑',mins:45,
goals:[['學會','myRIO 和「電腦＋DAQ 卡」差在哪裡；LabVIEW 2018 要裝哪幾樣；第一次接上電、接上 USB 會看到什麼；怎麼用 I/O Monitor 不寫程式就動動看。'],['做出','myRIO 接上電腦、燈號正常、Getting Started Wizard 走完、用 I/O Monitor 讓 LED 亮起來。'],['為什麼','myRIO 最容易卡住的不是程式，是「開不起來」。第一次就把每一個燈、每一個視窗看懂，之後出問題才知道看哪裡。']],
check:'你能說出：myRIO 上的程式跑在哪一顆處理器上、電腦在做什麼；LabVIEW 2018 要裝哪三樣、為什麼一定要 32 位元；USB 接上後 myRIO 的位址是多少；Status LED 閃 4 下代表什麼。',
body:[
C.h3('情境','x','桌上多了一台藍色的小盒子'),
`<p>實驗室發給你一台 NI myRIO-1900，要你用它控制一支小手臂：讀感測器、驅動馬達。你已經會用 LabVIEW 在電腦上寫程式，也會接儀器。</p>
<p>先停一下，想一個問題：這台小盒子跟前面用過的 USB-6009（I8）有什麼不一樣？</p>`,
ask('USB-6009 和 myRIO，程式各跑在哪裡？',
 `<p><b>USB-6009</b>：程式跑在你的電腦上。DAQ 卡只負責把電壓變成數字，傳給電腦。電腦關機，什麼都不會動。</p>
<p><b>myRIO</b>：盒子裡面有自己的電腦。說明書：處理器是 Xilinx Zynq-7010，雙核心、667 MHz，有 256 MB 記憶體和 512 MB 的儲存空間，跑的是 LabVIEW Real-Time。同一顆晶片裡還有一塊 FPGA，負責直接控制接腳。</p>
<p>所以你在電腦上寫的程式，按下執行之後，會被<b>送到 myRIO 上跑</b>。電腦只是拿來寫程式、看前面板。這是整個 myRIO 課最重要的一句話，後面每一個「為什麼要這樣做」都從這裡來。</p>`),
C.table(['','電腦＋USB-6009','myRIO'],[
 ['程式跑在','你的電腦','myRIO 裡的處理器（LabVIEW Real-Time）'],
 ['電腦拔掉','全部停','可以設定成自己繼續跑（M10）'],
 ['接腳由誰控制','DAQ 卡的硬體','FPGA（預設已經寫好一套，叫 default personality）'],
 ['LabVIEW 這邊','DAQmx','myRIO 的 Express VI（底下是 FPGA 的介面）']
]),

C.h3('第 1 步','','LabVIEW 2018 要裝什麼'),
`<p>myRIO 的程式要三樣軟體才寫得了。少一樣，後面就會出現「找不到 myRIO」或「選單裡沒有 myRIO」。</p>`,
C.table(['軟體','做什麼','少了會怎樣'],[
 ['LabVIEW 2018（32 位元）','寫程式的地方','—'],
 ['LabVIEW 2018 Real-Time Module','讓 LabVIEW 能把程式送到 myRIO 上跑','專案裡加不進 myRIO'],
 ['LabVIEW 2018 myRIO Toolkit','myRIO 的範本、Express VI、Getting Started Wizard','函式選單裡沒有 myRIO，Create Project 也沒有 myRIO 範本'],
 ['（選用）LabVIEW 2018 FPGA Module','自己改 FPGA','用預設的 FPGA（default personality）就不需要']
]),
warn('一定要 32 位元','NI 的 myRIO Toolkit 說明：只支援 32 位元的 LabVIEW。電腦上裝的是 64 位元 LabVIEW 2018，就算 Toolkit 裝下去也用不了。最省事的方法是裝 NI 的「myRIO Software Bundle」，它會一次裝好對應版本的三樣。'),
ask('同一台電腦已經裝了 LabVIEW 2021，可以用 2018 的 myRIO Toolkit 嗎？',
 `<p>不行。Toolkit 要跟 LabVIEW 同一個版本：2018 的 Toolkit 只裝進 LabVIEW 2018。不同版本的 LabVIEW 可以並存在同一台電腦，打開哪一版，就用哪一版的 Toolkit。</p>
<p>myRIO 上面裝的軟體也要對得上：Getting Started Wizard 會幫你把電腦這邊版本的軟體裝到 myRIO 上（第 3 步）。</p>`),

C.h3('第 2 步','','接上電，先看燈'),
steps([`把電源接到 myRIO 的電源接頭。說明書：電源電壓 6～16 VDC。`,
 `看盒子正面：${ui('POWER')} 燈亮起來，表示電源夠。`,
 `${ui('STATUS')} 燈會先亮一下，這是開機自我檢查（POST）。<b>STATUS 燈熄掉，才是開機完成</b>。`,
 `用 USB 線接 myRIO 的 ${ui('USB Device')} 埠到電腦。注意盒子上有兩個 USB：另一個是 USB Host，是給隨身碟、攝影機用的，接電腦要接 Device 那一個。`]),
ask('STATUS 燈一直沒熄，每隔幾秒閃幾下。怎麼辦？',
 `<p>數它閃幾下。說明書的對照：</p>`+C.table(['每隔幾秒閃','意思','怎麼辦'],[
 ['2 下','myRIO 偵測到軟體有問題，常見原因是更新軟體時被中斷','重新把軟體裝到 myRIO（NI MAX 或 Getting Started Wizard）'],
 ['3 下','myRIO 在 safe mode','重開機（按一下 Reset）'],
 ['4 下','程式當掉兩次，中間沒有重開機，通常是記憶體用完','檢查你放在 myRIO 上的程式有沒有一直長大的陣列或沒關的參照'],
 ['一直閃或恆亮','無法恢復的錯誤','聯絡 NI']])+`<p>這就是為什麼第 2 步要你「先看燈」：燈號是 myRIO 唯一不用電腦就能告訴你的事。</p>`),
note('Reset 按鈕','說明書：按一下放開，處理器和 FPGA 重新啟動。按住 5 秒再放開，會進 safe mode：只跑更新設定、安裝軟體需要的服務。平常不要按住。'),

C.h3('第 3 步','','電腦這邊：USB Monitor 和 Getting Started Wizard'),
`<p>USB 接上之後，Windows 會多出一張網路卡（USB 的虛擬網路）。電腦和 myRIO 其實是用網路在講話，這條 USB 網路上 myRIO 的位址固定是 <code>172.22.11.2</code>。</p>
<p>同時會跳出 ${ui('myRIO USB Monitor')} 視窗。</p>`,
steps([`在 USB Monitor 選 ${ui('Launch the Getting Started Wizard')}。`,
 `精靈會找到你的 myRIO，列出它的名字。出廠的名字長得像 <code>${TGT}</code>，後面那串是這台的序號，每台不一樣。`,
 `精靈檢查 myRIO 上的軟體，跟電腦上的 LabVIEW 版本不一樣時，會幫你裝上去。<b>第一次一定要讓它裝完</b>，中途不要拔線（不然就是 STATUS 閃 2 下）。`,
 `可以在這一步幫 myRIO 改名字（例如 robot-arm-01），之後在專案裡比較好認。`,
 `最後它會讓你試板上的加速度計和 LED：傾斜盒子看數值變化，就表示電腦和 myRIO 已經講得上話了。`]),
tip('USB Monitor 被關掉了怎麼辦','打開 LabVIEW 2018，起始畫面的 Set Up and Explore 裡有 Launch the Getting Started Wizard，效果一樣。'),

C.h3('第 4 步','','不寫程式，先讓接腳動起來：I/O Monitor'),
`<p>跟接儀器一樣，先不要寫程式。myRIO 有一個現成的工具：I/O Monitor，可以直接點開接腳看數值、切換輸出。</p>`,
steps([`LabVIEW 起始畫面 ${ui('Set Up and Explore')} ▸ ${ui('Launch the I/O Monitor')}，選你的 myRIO。（之後有專案了，也可以在專案總管對 myRIO 按右鍵 ▸ ${ui('Launch IO Monitor')}。）`,
 `數位：拿一條線接 MXP A 的 DIO0（第 11 腳）和 DIO1（第 13 腳）。在 I/O Monitor 選 DIO0、DIO1，把 DIO0 改成 Write，切換它，看 DIO1 讀到的值跟著變。`,
 `類比：拿一條線接 MXP A 的 AO0（第 2 腳）和 AI0（第 3 腳）。改 AO0 的輸出，看 AI0 讀到多少。`]),
ask('AO0 輸出 2.5 V，AI0 讀到 2.47 V。myRIO 壞了嗎？',
 `<p>沒壞。說明書：MXP 的類比輸入、輸出準確度都是 ±50 mV 左右，差 30 mV 在規格內。</p>
<p>另外，MXP 的 AI、AO 範圍都是 0～5 V、12 位元：一格是 5 V ÷ 4096 ≈ 1.22 mV。讀數會在最後一兩格跳動，這是正常的。</p>
<p>這也是第一次就用 I/O Monitor 的原因：先知道「正常」長什麼樣子，之後自己的程式讀到奇怪的數字，才分得出是程式的錯、接線的錯，還是本來就這樣。</p>`),

C.h3('回頭看','','第一次接上的檢查表'),
C.table(['檢查','正常的樣子','不正常時先看'],[
 ['電源','POWER 亮、STATUS 亮一下就熄','電源接頭、電壓 6～16 V；STATUS 閃幾下'],
 ['USB','接 Device 埠；跳出 USB Monitor','是不是接到 Host 埠；換一條 USB 線'],
 ['軟體','Getting Started Wizard 找到 myRIO、裝完軟體','LabVIEW 是不是 32 位元、三樣有沒有裝齊'],
 ['接腳','I/O Monitor 裡 DIO0 → DIO1、AO0 → AI0 對得上','接線的腳位（M04 會把每一隻腳講清楚）']
]),

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'在 LabVIEW 按下執行，myRIO 的程式跑在哪裡？',o:['myRIO 裡的處理器（LabVIEW Real-Time）','你的電腦','USB 線上','FPGA 以外的 DAQ 卡'],a:0,ex:'電腦負責寫程式和顯示前面板；程式被送到 myRIO 上跑。'},
 {q:'LabVIEW 2018 要寫 myRIO 程式，一定要裝的是？',o:['LabVIEW 2018（32 位元）、Real-Time Module、myRIO Toolkit','只要 LabVIEW 2018 64 位元','LabVIEW 和 DAQmx','只要 FPGA Module'],a:0,ex:'FPGA Module 只有要自己改 FPGA 時才需要。'},
 {q:'myRIO 用 USB 接上電腦後，它的位址是？',o:['172.22.11.2','192.168.1.1','127.0.0.1','COM3'],a:0,ex:'USB 會變成一條虛擬網路，myRIO 在這條網路上固定是 172.22.11.2。'},
 {q:'USB 線應該接 myRIO 的哪一個埠？',o:['USB Device','USB Host','都可以','MXP A'],a:0,ex:'USB Host 是給隨身碟、攝影機用的。'},
 {q:'STATUS 燈每隔幾秒閃 4 下，最可能的原因？',o:['程式當掉兩次，通常是記憶體用完','正常開機','電源不夠','USB 沒接'],a:0,ex:'說明書的燈號表。檢查放在 myRIO 上的程式有沒有一直長大的陣列。'},
 {q:'為什麼先用 I/O Monitor，而不是直接寫程式？',o:['先確認接腳和數值「正常長什麼樣子」，之後出問題才分得出是誰的錯','I/O Monitor 比較快','程式寫不出來','規定一定要用'],a:0,ex:'跟接儀器的「先講到話」是同一個想法。'}
]}
]});

/* =============================== M02 =============================== */
L.push({id:'M02',order:30.2,no:'M2',part:PART,title:'開專案：從專案總管把程式送上 myRIO，以後怎麼再打開',mins:55,
goals:[['學會','用範本建立 myRIO 專案；看懂專案總管裡每一層；確認一個 VI 是不是真的在 myRIO 上跑；範本 Main.vi 的三格在做什麼；下次怎麼把同一個專案再開起來。'],['做出','一個 myRIO 專案，Main.vi 在 myRIO 上跑，前面板看得到加速度的波形；關掉 LabVIEW 之後，照步驟再開一次。'],['為什麼','myRIO 的 VI 一定要從專案裡、放在 myRIO 底下打開，才會送到 myRIO 上跑。新手最常見的問題，就是直接雙擊 VI 檔，結果它在電腦上開、什麼都跑不動。']],
check:'你能說出：專案總管裡 My Computer 和 myRIO 底下的 VI 差在哪；看哪裡可以確定 VI 是在 myRIO 上跑；下次開專案的步驟；為什麼不能直接雙擊 Main.vi。',
body:[
C.h3('情境','x','Getting Started Wizard 走完了，然後呢？'),
`<p>上一課已經確認 myRIO 跟電腦講得上話。這一課要寫第一個自己的程式。在 myRIO 上寫程式，一定要從<b>專案</b>開始。</p>`,
ask('前面的課，很多 VI 不用專案也能跑。myRIO 為什麼一定要專案？',
 `<p>因為 LabVIEW 要知道<b>這個 VI 要送到哪一台機器上跑</b>。</p>
<p>專案（.lvproj）就是一張「哪個 VI 跑在哪台機器」的清單。清單裡有兩台機器：你的電腦（My Computer）和 myRIO。VI 放在哪一台底下，按執行時就送到哪一台。沒有專案，LabVIEW 只能把 VI 放在電腦上跑。</p>`),

C.h3('方法一','','用範本建立專案（第一次建議用這個）'),
steps([`開 LabVIEW 2018（32 位元）。起始畫面按 ${ui('Create Project')}。`,
 `左邊的分類選 ${ui('myRIO')}，右邊選 ${ui('myRIO Project')}，按 ${ui('Next')}。`,
 `填專案名稱和存放的資料夾。<b>每個專案開一個自己的資料夾</b>：範本會一次產生好幾個檔案，混在一起以後很難整理。`,
 `目標選 ${ui('Plugged into USB')}，按 ${ui('Refresh')}，清單裡出現你的 myRIO（就是上一課看到的名字），選它。`,
 `按 ${ui('Finish')}。LabVIEW 建好專案，打開 ${ui('Project Explorer')}（專案總管）。`]),
tip('找不到 myRIO','先確認 USB 線接的是 Device 埠、STATUS 燈已經熄。還是找不到時，改選用網路連線的那一個選項，IP 直接填 172.22.11.2。'),

C.h3('看懂專案總管','',''),
`<p>建好之後，專案總管長得像這樣（名字依你取的）：</p>`,
tree([[0,'📁','我的myRIO專案.lvproj','專案檔：下次就是開它'],[1,'🖥','My Computer','你的電腦'],[2,'·','Dependencies',''],[2,'·','Build Specifications',''],[1,'🔷',`${TGT} (172.22.11.2)`,'myRIO：括號裡是它的 IP'],[2,'📄','Main.vi','放在 myRIO 底下 → 在 myRIO 上跑'],[2,'·','Dependencies',''],[2,'·','Build Specifications','M10 做獨立執行時會用到']]),
ask('同一個 Main.vi，放在 My Computer 底下和放在 myRIO 底下，有什麼不同？',
 `<p>放在哪一台底下，按執行時就在哪一台上跑。myRIO 的 Express VI（加速度計、LED、PWM…）是去控制 myRIO 的接腳，只有在 myRIO 上跑才有東西可以控制。</p>
<p>所以：<b>要碰 myRIO 接腳的 VI，一定放在 myRIO 底下</b>。My Computer 底下放的是只在電腦上跑的東西，例如之後的「電腦端監控畫面」（M09）。</p>`),
ask('myRIO 那一行括號裡的 172.22.11.2，什麼時候要改？',
 `<p>用 USB 接的時候就是 172.22.11.2，不用改。改用 Wi-Fi 或網路線連 myRIO 時，它會有另一個 IP，這時候要對 myRIO 按右鍵 ▸ ${ui('Properties')}，把 IP 改成新的位址。</p>
<p>範本 Main.vi 前面板的說明第 1 條就是這件事：先確認專案裡的 myRIO IP 是對的。IP 錯了，LabVIEW 會連不上，按執行就一直等。</p>`),

C.h3('打開 Main.vi','','先看說明，再看程式'),
steps([`在專案總管裡，雙擊 <b>myRIO 底下的</b> ${ui('Main.vi')}。`,
 `先看視窗最上面的標題列：<code>Main.vi Front Panel on 我的myRIO專案.lvproj/${TGT}</code>。`,
 `再看視窗左下角，也寫著 <code>我的myRIO專案.lvproj/${TGT}</code>。`]),
ask('標題列那一段「on ….lvproj/NI-myRIO-1900-…」在告訴你什麼？',
 `<p>它說的是：<b>這個 VI 屬於哪個專案、要在哪一台機器上跑</b>。看到 myRIO 的名字，按執行就會送到 myRIO。</p>
<p>要看清楚的是<b>斜線後面那一段</b>。如果寫的是 <code>on 我的myRIO專案.lvproj/My Computer</code>，表示這個 VI 雖然屬於這個專案，卻是在「我的電腦」底下開的：它跟 myRIO 是斷開的，執行箭頭是斷的。這是新手最常踩的坑，下面「以後怎麼再打開」會再講一次。</p>`),
`<p>前面板上方有範本的說明：這個範本從板上的加速度計讀資料，畫在波形圖上；使用前先確認專案裡 myRIO 的 IP，然後執行。前面板有一張 Acceleration (g) 的圖（X、Y、Z 三軸）、一個 error out、一個 Stop 鈕。</p>
<p>按 <kbd>Ctrl</kbd>+<kbd>E</kbd> 看方塊圖。整個程式是一個三格的 Flat Sequence：</p>`,
C.table(['格子','裡面有什麼','為什麼這樣排'],[
 ['Initialize','空的，只有一個 #CodeNeeded 的註解：在這裡加入初始化使用者介面和硬體的程式','開始前只做一次的事，例如設定初始輸出、開檔案'],
 ['Acquire and process data','一個 While Loop（Main Loop）：Accelerometer Express VI 讀 X、Y、Z 三軸 → 組成一個陣列 → 畫到 Acceleration 圖；Wait 10 ms；按 Stop 或出錯就停','一直重複做的事放在迴圈裡；Wait 讓迴圈大約每 10 ms 跑一圈'],
 ['Close','Reset myRIO.vi → error out','結束時把 myRIO 的輸出恢復成預設，不要讓馬達、LED 停在最後的狀態']
]),
ask('Close 那一格為什麼要呼叫 Reset myRIO.vi？拿掉會怎樣？',
 `<p>想像你的程式在迴圈裡讓馬達轉、讓 LED 亮。按 Stop，迴圈結束了，可是 myRIO 的接腳<b>會停在最後寫進去的狀態</b>：馬達繼續轉、LED 繼續亮。</p>
<p>Reset myRIO.vi 把輸出恢復成預設。這跟 I13 測試站「結束時一定要關電源輸出」是同一個想法：<b>程式結束時，設備要停在安全的狀態</b>。</p>`),
ask('迴圈的停止條件為什麼是「Stop 或 error」，不是只有 Stop？',
 `<p>Accelerometer 讀不到時（例如連線斷了），error 會變成有錯。如果只看 Stop，迴圈會繼續一直跑、一直出錯，畫面卻停在最後一筆。把 error 的 status 和 Stop 用 Or 接起來，出錯也會停下來，錯誤從 error out 顯示出來。這是 I4 講過的做法。</p>`),

C.h3('執行','','第一次按下執行會發生什麼'),
steps([`按工具列的執行箭頭（${ui('Run')}）。`,
 `LabVIEW 先連上 myRIO（專案總管裡 myRIO 圖示旁邊會出現綠色的連線燈），再跳出 ${ui('Deployment Progress')} 視窗：把 Main.vi 和它用到的東西送到 myRIO 上。第一次會比較久。`,
 `送完之後 VI 開始跑。傾斜 myRIO，看圖上 X、Y、Z 三條線跟著變。`,
 `按前面板的 ${ui('Stop')} 結束。不要用工具列的紅色中止鈕（Abort）。`]),
ask('為什麼要按前面板的 Stop，不按工具列的 Abort？',
 `<p>Abort 是「立刻停下」：程式停在哪一行就是哪一行，<b>Close 那一格不會被執行</b>，Reset myRIO.vi 沒有跑，輸出就停在最後的狀態。</p>
<p>按 Stop 是讓迴圈自己結束，接著跑完 Close，myRIO 的輸出才會恢復。只有程式真的卡死、Stop 按了沒反應時，才用 Abort。</p>`),
ask('程式在 myRIO 上跑，那前面板上的圖是誰畫的？',
 `<p>程式在 myRIO 上跑，前面板顯示在你的電腦上：LabVIEW 透過 USB 的網路，把 myRIO 上的控制項、指示器的值傳過來。所以 USB 一拔，前面板就不會再更新。</p>
<p>這種「從專案按執行」的跑法，適合開發和除錯。要讓 myRIO 拔掉電腦也自己跑，要另外建置成開機自動執行的程式（M10）。</p>`),
`<p>最後按 <kbd>Ctrl</kbd>+<kbd>S</kbd> 存檔，在專案總管按 ${ui('File')} ▸ ${ui('Save All')}（存專案）。</p>`,

C.h3('以後怎麼再打開','','這一段最重要'),
`<p>過了一個禮拜，你要繼續寫這個專案。下面是每一次的順序，前後不要顛倒：</p>`,
steps([`myRIO 接上電源，等 STATUS 燈熄掉；USB 線接 Device 埠。`,
 `開 LabVIEW 2018（32 位元）。`,
 `<b>開專案，不是開 VI</b>：起始畫面右邊最近開過的專案清單裡點它，或 ${ui('File')} ▸ ${ui('Open Project')}，選你的 <code>.lvproj</code>。也可以在檔案總管雙擊 <code>.lvproj</code>。`,
 `在專案總管確認 myRIO 那一行的 IP 是對的（USB 是 172.22.11.2）。`,
 `想先確認連得上：對 myRIO 按右鍵 ▸ ${ui('Connect')}，圖示旁邊出現綠燈就是連上了。（不做這一步也可以，按執行時 LabVIEW 會自己連。）`,
 `從 <b>myRIO 底下</b>雙擊 ${ui('Main.vi')}，看標題列有沒有 <code>on ….lvproj/${TGT}</code>。`,
 `按執行。`,
 `用完：前面板按 Stop → 存檔 → 對 myRIO 按右鍵 ▸ ${ui('Disconnect')} → 關專案。`]),
ask('直接在檔案總管雙擊 Main.vi，會怎樣？',
 `<p>它會在<b>電腦上</b>打開，跟 myRIO 斷開。實際的樣子：標題列變成 <code>Main.vi Front Panel on 我的myRIO專案.lvproj/My Computer</code>，左下角也是 <code>…/My Computer</code>；執行箭頭是斷的，按不下去。（專案沒開的時候，標題列連 on… 都沒有，一樣是在電腦上。）</p>
<p>原因：myRIO 的 Express VI 是去控制 myRIO 的接腳，在「我的電腦」底下沒有接腳可以控制，LabVIEW 就判定這個 VI 不能跑。很多人以為是 myRIO 壞了、線鬆了，其實只是開錯了地方。</p>
<p>記住一個習慣：<b>myRIO 的東西，永遠從 .lvproj 開，再從 myRIO 底下開 VI</b>。標題列斜線後面不是 myRIO 的名字，就關掉這個視窗，回專案總管、從 myRIO 底下重新開。</p>`),
ask('換一台電腦開同一個專案，要注意什麼？',
 `<p>三件事：那台電腦也要有 LabVIEW 2018（32 位元）＋Real-Time Module＋myRIO Toolkit；整個專案<b>資料夾</b>一起帶過去，不要只帶 Main.vi；myRIO 的 IP 確認一下（USB 一樣是 172.22.11.2）。</p>`),

C.h3('方法二','','從空專案自己加 myRIO（了解一下）'),
`<p>不用範本也可以，步驟多一點，但你會更清楚專案是怎麼組起來的。NI 的教學是這樣做：</p>`,
steps([`${ui('File')} ▸ ${ui('New…')} ▸ ${ui('Empty Project')}，先存成一個 .lvproj。`,
 `對專案最上面那一行按右鍵 ▸ ${ui('New')} ▸ ${ui('Targets and Devices…')}。`,
 `保持 ${ui('Discover an existing target or device')}，在 myRIO 的分類裡選你的 myRIO，按 OK。`,
 `對 myRIO 按右鍵 ▸ ${ui('New')} ▸ ${ui('VI')}，存成 Main.vi（或你要的名字）。`]),
`<p>跟範本的差別：方法二的 Main.vi 是空的，Initialize、Close、Reset myRIO.vi 都要自己加。第一次用範本，看懂範本為什麼這樣排，之後再自己從空的開始。</p>`,

C.h3('出問題時先看哪裡','',''),
C.table(['看到的現象','最可能的原因','先做什麼'],[
 ['Create Project 裡沒有 myRIO 分類','開的是 64 位元 LabVIEW，或沒裝 myRIO Toolkit','確認開的是 LabVIEW 2018（32 位元）'],
 ['Plugged into USB 找不到 myRIO','STATUS 還沒熄、USB 接到 Host、USB 網路卡沒設定好','等開機完成、換 Device 埠；改用網路選項填 172.22.11.2'],
 ['標題列是 on….lvproj/My Computer（或沒有 on…）；執行箭頭斷掉','VI 是從資料夾直接開的，跟 myRIO 斷開','關掉這個視窗，從專案總管 myRIO 底下重開'],
 ['按執行一直等、最後連不上','專案裡 myRIO 的 IP 不對','對 myRIO 按右鍵 ▸ Properties 看 IP'],
 ['部署時說 myRIO 上的軟體版本不合','myRIO 上裝的是別的版本的軟體','重新跑 Getting Started Wizard，裝 2018 的軟體'],
 ['按 Stop 之後 LED、馬達還在動','用了 Abort，或程式沒有呼叫 Reset myRIO.vi','用 Stop 結束；Close 格子要有 Reset myRIO.vi']
]),

C.h3('測驗','q','小測驗'),
{quiz:[
 {q:'myRIO 的 VI 要怎麼打開，才會在 myRIO 上跑？',o:['開 .lvproj，從專案總管 myRIO 底下雙擊 VI','在檔案總管雙擊 VI','從 My Computer 底下開','用記事本開'],a:0,ex:'VI 放在哪一台底下，就在哪一台上跑。'},
 {q:'怎麼確認打開的 VI 會在 myRIO 上跑？',o:['標題列斜線後面是 myRIO 的名字：「on 專案名.lvproj/NI-myRIO-1900-…」','標題列是「on 專案名.lvproj/My Computer」','前面板是灰色的','看不出來'],a:0,ex:'斜線後面是 My Computer，就是在電腦上、跟 myRIO 斷開。視窗左下角也看得到。'},
 {q:'從資料夾直接雙擊 Main.vi，標題列是「on 專案名.lvproj/My Computer」，執行箭頭斷掉。原因？',o:['VI 開在「我的電腦」底下，跟 myRIO 斷開；myRIO 的 Express VI 在電腦上不能跑','myRIO 壞了','USB 線鬆了','專案檔壞了'],a:0,ex:'關掉這個視窗，從專案總管的 myRIO 底下重開。'},
 {q:'範本 Main.vi 的 Close 格子為什麼要呼叫 Reset myRIO.vi？',o:['讓 myRIO 的輸出恢復預設，不要停在最後的狀態','讓 myRIO 重新開機','清除專案','加快下一次執行'],a:0,ex:'程式結束時，設備要停在安全的狀態。'},
 {q:'結束程式應該按哪一個？',o:['前面板的 Stop','工具列的 Abort','直接拔 USB','關掉 LabVIEW'],a:0,ex:'Abort 會跳過 Close 那一格。'},
 {q:'下次要繼續這個專案，第一個要開的是？',o:['.lvproj 專案檔','Main.vi','NI MAX','I/O Monitor'],a:0,ex:'從專案開，VI 才會在對的機器上。'},
 {q:'用 USB 連線時，專案裡 myRIO 的 IP 應該是？',o:['172.22.11.2','127.0.0.1','192.168.0.1','不用 IP'],a:0,ex:'改用 Wi-Fi 或網路線時才要改成新的 IP。'},
 {q:'程式在 myRIO 上跑，前面板的圖為什麼看得到？',o:['LabVIEW 透過 USB 網路把數值傳回電腦顯示','程式其實在電腦上跑','myRIO 有螢幕','FPGA 直接畫圖'],a:0,ex:'所以拔掉 USB，前面板就不會更新；要獨立執行要另外建置（M10）。'}
]}
]});
})();
