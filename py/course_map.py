# -*- coding: utf-8 -*-
"""The one course order for the whole site. learn.html (lesson list, previous/next), path.html (course map),
practice.html and every guide page (the chapter bar) read this, so the site has a single storyline.

Item kinds: L lesson id (lessons.py), E exercise id, F gantry fault case, A AOI case, G page (href, label).
tools/gen_course_map.py writes web/course_map.js from this file; tests check that it is up to date."""

CHAPTERS = [
    {"id": "1", "t": "認識 PLC 與階梯圖",
     "why": "先知道 PLC 是一台怎樣的機器：端子怎麼接、X／Y 怎麼編號，再學會讀最基本的階梯圖。",
     "can": ["說出 FX3S 的輸入、輸出端子各接什麼", "看懂接點、線圈、串聯、並聯、常閉", "寫出第一個會亮的程式"],
     "items": [["L", "0"], ["G", "wiring.html", "FX3S 實機與接線：每條線接在哪"], ["L", "1"], ["L", "2"], ["L", "2-1"], ["E", "E1"], ["E", "E2"], ["G", "sim.html#lamp", "模擬器：用梯形圖畫第一個程式"], ["G", "review.html#ch1", "第 1 章 章末小考"]]},
    {"id": "2", "t": "階梯圖怎麼運作",
     "why": "PLC 不是一次看完整張圖，而是一行一行、一圈一圈算。懂了掃描，自保持、雙線圈、互鎖都說得通；這一章也開始用 GX Works2 打程式、寫入、監看。",
     "can": ["解釋掃描與「慢一圈」", "寫出啟動／停止自保持", "避免雙線圈、寫出正反轉互鎖", "在 GX Works2 建工程、轉換、寫入、監看"],
     "items": [["L", "3"], ["L", "3-2"], ["L", "4"], ["E", "E3"],
               ["G", "gx2.html#g2", "GX Works2：建立工程選什麼"], ["G", "gx2.html#g13", "GX Works2：認識畫面"],
              ["G", "gx2.html#g4", "GX Works2：畫一條完整的階梯圖"], ["G", "gx2.html#g14", "GX Works2：編輯操作與快捷鍵"],
              ["G", "gx2.html#g15", "GX Works2：存檔與開啟工程"],
               ["G", "gx2.html#g8", "GX Works2：寫入 FX3S 與監看"],
               ["L", "8"], ["L", "9"], ["E", "E4"], ["E", "E9"], ["G", "review.html#ch2", "第 2 章 章末小考"]]},
    {"id": "3", "t": "FX 常用指令",
     "why": "有了運作觀念，再把三菱 FX 的工具一次備齊：軟元件編號、SET／RST、脈衝、計時、計數、特殊繼電器、數值與比較。每學一個就做一題。",
     "can": ["知道 FX3S 每種軟元件的編號範圍", "分辨 OUT、SET、PLS 的差別", "用計時器做延時與閃爍、用計數器計數", "用 MOV、比較、ALT、ZRST 處理數值與狀態", "用移位指令做跑馬燈"],
     "items": [["L", "A1"], ["L", "A4"], ["E", "E8"], ["L", "A2"], ["E", "E5"], ["E", "E6"],
               ["L", "A3"], ["E", "E7"], ["E", "E16"], ["L", "A6"], ["L", "A5"], ["L", "A11"], ["E", "E14"], ["E", "E27"], ["L", "A10"], ["L", "A12"], ["E", "E26"], ["L", "A14"], ["E", "E29"], ["G", "review.html#ch3", "第 3 章 章末小考"]]},
    {"id": "4", "t": "順序控制：步進 STL 與 SFC",
     "why": "機器是一步接一步的。先看自保持寫流程為什麼會打結，再學步進：怎麼把動作描述畫成步序、怎麼寫 STL、怎麼在 GX Works2 建 SFC，最後是並行和選擇分支。",
     "can": ["把動作描述整理成步序表", "照規則寫出 STL 步進程式", "在 GX Works2 用階梯圖寫 STL，也會建 SFC 工程", "寫並行分支與選擇分支"],
     "items": [["L", "5"], ["L", "6"], ["L", "6-1"], ["L", "6-2"], ["L", "6-6"], ["L", "6-5"], ["L", "6-7"], ["E", "E10"], ["E", "E17"],
               ["G", "gx2.html#g1", "GX Works2：三種寫法差在哪"], ["G", "gx2.html#g5", "GX Works2：在階梯圖裡寫 STL"],
               ["G", "gx2.html#g6", "GX Works2：建立 SFC 工程"],
               ["L", "6-4"], ["L", "7"], ["L", "A7"], ["G", "gx2.html#g7", "GX Works2：SFC 分支"],
               ["E", "E12"], ["E", "E13"], ["G", "sim.html#cylinder", "模擬器：用 SFC 畫氣缸取放"], ["G", "sim.html#traffic", "模擬器：紅綠燈（選擇分支）"], ["G", "sim.html#arm", "模擬器：氣壓機械手臂（STL 步進梯形圖）"], ["L", "6-3"], ["G", "review.html#ch4", "第 4 章 章末小考"]]},
    {"id": "5", "t": "讓機台可靠：異常、手動與復歸",
     "why": "會動不夠，機台還要停得下來、壞了會報警、能手動、能回原點。這章是真實機台程式裡最多行的部分。",
     "can": ["分辨現場常閉和程式常閉，急停接法正確", "替每一步加逾時，記住第一個異常碼", "寫手動點動與回原點", "做循環停止與輸出仲裁"],
     "items": [["L", "A9"], ["G", "safety.html", "急停、安全迴路與硬體互鎖：為什麼不能只靠程式"], ["L", "A8"], ["E", "E11"], ["L", "C4"], ["L", "A13"], ["E", "E30"], ["L", "B1"], ["L", "B2"], ["L", "C2"], ["E", "E31"], ["L", "C3"], ["E", "E32"], ["L", "C6"], ["G", "sim.html#sorter", "模擬器：輸送帶分料"], ["G", "sim.html#stepper", "模擬器：步進馬達定位（DRVI／DRVA）"], ["G", "sim.html#tank", "模擬器：儲槽液位（遲滯控制）"], ["G", "sim.html#elevator", "模擬器：三層電梯"], ["G", "review.html#ch5", "第 5 章 章末小考"]]},
    {"id": "6", "t": "整機設計：從需求到程式",
     "why": "把前五章串成一套工程流程：問需求、選元件、配 I/O、畫步序、分區寫程式、模擬測試、試車。再用雙龍門看一台真實機台怎麼套這套流程。",
     "can": ["從需求做出 I/O 表和步序", "照「初始化→模式→手動→原點→自動→異常→輸出」分區寫程式", "先在模擬器上把機器弄壞再上機"],
     "items": [["G", "design.html", "機台設計方法（自動門實例）"], ["E", "E15"], ["L", "C5"], ["L", "10"], ["L", "C1"], ["G", "review.html#ch6", "第 6 章 章末小考"]]},
    {"id": "7", "t": "故障排除與接手程式",
     "why": "現場最常做的事不是寫新程式，而是機器停了要找原因、接手別人寫的程式。這章用雙龍門和 AOI 兩台機台練固定的診斷流程。",
     "can": ["照「現象 → I/O → 往左追 → 硬體或程式」找故障", "看懂 PLC 與上位機的交握", "用程式健檢整理一份陌生程式"],
     "items": [["G", "faults.html", "故障排除：診斷流程"], ["F", "F1"], ["F", "F2"], ["F", "F3"], ["F", "F4"],
               ["F", "F5"], ["F", "F6"], ["F", "F7"], ["F", "F8"],
               ["G", "aoi.html", "AOI 機台：PLC 與上位機交握"], ["A", "A1"], ["A", "A2"], ["A", "A3"], ["A", "A4"], ["A", "A5"],
               ["G", "check.html", "程式健檢：接手一份陌生程式"]]},
]

# Side tracks: taken after the main line (or alongside it), not part of "next lesson".
TRACKS = [
    {"id": "X", "t": "技能檢定衝刺", "after": "5",
     "why": "第 5 章學完就能挑戰。氣壓乙級與工業配線乙級的 PLC 題，依勞動部公開試題做成模擬機台，一項一項自動評分。",
     "can": ["三種模式、急停、復歸、停電的寫法", "照試題逐條驗收"],
     "items": [["G", "exam.html", "檢定專區：考什麼、怎麼評"], ["G", "drawing.html", "考前畫圖練習：I/O 配線圖與外部接線圖"], ["E", "E18a"], ["E", "E18b"], ["E", "E18"], ["E", "E19"], ["E", "E20"], ["E", "E21"],
               ["E", "E23"], ["E", "E25"], ["E", "E22"], ["E", "E24"]]},   # industrial wiring by paper number 101, 102, 105, 106
    {"id": "Y", "t": "上位機：LabVIEW", "after": "7",
     "why": "PLC 之外，用 LabVIEW 寫讀寫 PLC 的上位機：資料流、迴圈、VISA 通訊、雙迴圈與 Queue、心跳與重連；另有 CLAD 證照課與模擬考。",
     "can": ["寫出能讀寫 FX 的上位機", "準備 CLAD"],
     "items": [["G", "labview/index.html", "LabVIEW 上位機課程"], ["G", "labview/fxlab.html", "FX 封包練習台：在網頁上和模擬 PLC 對話"], ["G", "labview/lab-array.html", "動畫實驗室：陣列函式"], ["G", "labview/lab-bool.html", "動畫實驗室：按鈕機械動作、邏輯閘、比較"], ["G", "labview/lab-numeric.html", "動畫實驗室：溢位、捨入、商與餘數"]]},
]


def all_sections():
    return CHAPTERS + TRACKS


def lesson_order():
    """Lesson ids in course order (main line only)."""
    return [i[1] for c in CHAPTERS for i in c["items"] if i[0] == "L"]


def chapter_of_lesson(lid):
    for c in CHAPTERS:
        for n, i in enumerate([i for i in c["items"] if i[0] == "L"]):
            if i[1] == lid:
                return c, n + 1
    return None, 0


def lesson_number(lid):
    """Display number like '4.3' (chapter.position among the chapter's lessons)."""
    c, n = chapter_of_lesson(lid)
    return "%s.%d" % (c["id"], n) if c else lid
