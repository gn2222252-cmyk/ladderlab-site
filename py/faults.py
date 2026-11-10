# -*- coding: utf-8 -*-
"""Troubleshooting cases on the dual gantry. A fault is hidden in the machine; the learner reads the work order,
operates the machine, reads I/O, alarm code and ladder, then names the faulty part and the cause. Only a right
diagnosis unlocks the repair, and the case is solved when the learner has brought the machine back to work.

Symptoms were measured on the simulation (tools/fault_detail.py), so every work order says what really happens."""
import json

from bridge import Lab

ALARMS = {0: "無異常", 1: "急停", 10: "橫軸逾時（移動太久沒到位）", 11: "氣缸逾時（升降太久沒到位）",
          30: "原點復歸逾時", 40: "HMI 心跳逾時（上位機斷線）"}

PARTS = [  # what the learner can blame
    ("X000", "X000 左龍門前側位置感測器"), ("X001", "X001 左龍門後側位置感測器"),
    ("X002", "X002 右龍門前側位置感測器"), ("X003", "X003 右龍門後側位置感測器"),
    ("X004", "X004 前輸送帶到位感測器"), ("X005", "X005 後輸送帶到位感測器"),
    ("X006", "X006 左氣缸上限"), ("X007", "X007 左氣缸下限"), ("X010", "X010 模式開關"),
    ("X011", "X011 右氣缸上限"), ("X012", "X012 右氣缸下限"), ("X013", "X013 急停（常閉）"),
    ("L_AXIS", "左橫軸馬達／驅動器"), ("R_AXIS", "右橫軸馬達／驅動器"),
    ("L_CYL", "左氣缸本體／電磁閥／氣壓"), ("R_CYL", "右氣缸本體／電磁閥／氣壓"),
    ("L_VAC", "左吸盤／真空"), ("R_VAC", "右吸盤／真空"), ("PLC", "PLC 程式"),
]
CAUSES = [
    ("sensor_off", "感測器斷線或沒感應到（一直 OFF）"), ("sensor_on", "感測器短路或被擋住（一直 ON）"),
    ("mech", "機構卡住、氣壓不足或電磁閥故障"), ("motor", "馬達或驅動器故障"), ("vacuum", "吸盤破損或真空洩漏"),
    ("operation", "操作或開關設定錯誤"), ("estop", "急停迴路斷開"), ("program", "程式錯誤"),
]

CASES = [
    {"id": "F1", "free": True, "level": 1, "title": "按啟動沒反應",
     "report": "早班報修：原點復歸正常，可是按「啟動」機台完全不動，也沒有異常燈。昨天晚班有人做過手動調整。",
     "fault": ("press", "X010", 0), "part": "X010", "cause": "operation",
     "clues": ["先看異常碼：0，代表 PLC 沒有認為出錯。那就是「啟動條件」不成立。",
               "到階梯圖 P3 模式與安全，或 P2 啟動命令那段，點一下看卡在哪個接點。",
               "看輸入 X010（模式開關）現在是 ON 還是 OFF。"],
     "explain": "X010 是模式開關，ON 才是自動。晚班手動調整後沒切回自動，所以啟動命令在階梯圖被 X010 擋住。這是現場最常見的「故障」：機器沒壞，是設定沒還原。檢查順序：異常碼 → 啟動條件 → 模式開關。"},

    {"id": "F2", "free": True, "level": 1, "title": "一開機就異常，復歸不掉",
     "report": "機台送電後異常燈就亮，按「異常復歸」也沒用。急停按鈕看起來是拉起來的（沒有被按下）。",
     "fault": ("force", "X013", 0), "part": "X013", "cause": "estop",
     "clues": ["異常碼是 1：急停。", "急停按鈕是常閉接點：沒按的時候 X013 應該是 ON。看 X013 現在是什麼。",
               "按鈕沒按、X013 卻是 OFF：表示這條線路中間斷了（端子鬆脫、線斷、按鈕接點壞）。"],
     "explain": "急停用常閉接線，正常時 X013 = ON；任何一處斷線都會變成 OFF，PLC 就當成急停。這是故意的「失效安全」設計：線斷了寧可停機。所以按鈕看起來正常但 X013 = OFF，要沿急停迴路查接線，而不是改程式把它跳過。"},

    {"id": "F3", "free": True, "level": 2, "title": "右邊下降後停住，氣缸逾時",
     "report": "機台運轉幾秒後停機，異常碼 11。操作員說有看到右邊的吸盤降下去。",
     "fault": ("force", "X012", 0), "part": "X012", "cause": "sensor_off",
     "clues": ["異常碼 11 是氣缸逾時：氣缸動作太久沒到位。", "停機前 Y004（下降）有輸出嗎？右氣缸上限 X011 有沒有變 OFF？",
               "上限已經 OFF（氣缸離開上面了），下限 X012 卻一直沒 ON：氣缸有動，是哪個東西沒告訴 PLC？"],
     "explain": "判斷關鍵：上限 X011 已經 OFF，代表氣缸真的往下走了；下限 X012 一直 OFF，所以是下限感測器沒有回報（斷線、感應距離跑掉、感測器壞）。如果是氣缸沒動，上限會一直 ON（看 F4）。"},

    {"id": "F4", "free": False, "level": 2, "title": "異常碼也是 11，但原因不一樣",
     "report": "和上次一樣停在異常碼 11，換了下限感測器還是一樣。這次操作員說沒看到吸盤降下來。",
     "fault": ("attr", "right", "cyl_stuck"), "part": "R_CYL", "cause": "mech",
     "clues": ["一樣先看 Y004（下降）有沒有輸出。", "這次右氣缸上限 X011 有沒有變 OFF？",
               "PLC 有下命令、上限卻一直 ON：氣缸根本沒離開。問題在命令之後：電磁閥、氣管、氣壓或氣缸本體。"],
     "explain": "同一個異常碼，兩種原因：F3 是上限 OFF、下限沒來（感測器問題）；F4 是上限一直 ON（氣缸沒動）。PLC 輸出有出去、機構沒動，就去查電磁閥有沒有切換、氣壓錶、氣管有沒有漏。換感測器是白換。"},

    {"id": "F5", "free": False, "level": 2, "title": "橫軸逾時",
     "report": "運轉中停機，異常碼 10。現場聽到右邊的馬達有在轉，左邊沒聲音。",
     "fault": ("attr", "left", "axis_stuck"), "part": "L_AXIS", "cause": "motor",
     "clues": ["異常碼 10：橫軸移動太久沒到位。", "看 Y000、Y001（左橫軸）停機前有沒有輸出，左龍門的位置感測器 X000、X001 有沒有變化。",
               "命令有出去、兩個位置感測器都沒變：左龍門根本沒有移動。"],
     "explain": "Y000/Y001 有輸出，但左龍門前後兩個位置感測器都沒變化，表示左橫軸沒有移動，問題在馬達、驅動器或機構卡死，不是感測器（感測器壞只會少一個訊號，另一個應該會離開）。"},

    {"id": "F6", "free": False, "level": 3, "title": "機台一直動，卻沒搬到東西",
     "report": "機台沒有異常，一直來回跑，但工件都沒有被搬走，前輸送帶末端的工件越堆越多。",
     "fault": ("attr", "right", "vac_fail"), "part": "R_VAC", "cause": "vacuum",
     "clues": ["沒有異常碼：程式認為每一步都完成了。", "看右龍門在前輸送帶下降、吸盤 Y005 ON 的時候，工件有沒有跟著上來。",
               "這台機台沒有「吸到工件」的感測器，所以 PLC 不知道沒吸到。"],
     "explain": "PLC 只看得到它有的感測器。這台機台沒有真空壓力開關，吸盤破了或真空管漏氣，程式還是照步驟跑，所以變成「空跑」。改善建議：加一個真空確認感測器，吸附步改成等它 ON 才上升，沒吸到就報警。這也是設計課的重點：要回饋，才能檢查。"},

    {"id": "F7", "free": False, "level": 3, "title": "輸送帶一直轉，龍門在等",
     "report": "沒有異常。輸送帶一直轉，工件已經到前輸送帶末端擋住了，龍門卻不來拿。",
     "fault": ("force", "X004", 0), "part": "X004", "cause": "sensor_off",
     "clues": ["看作用中的步：龍門在等什麼？", "到 P5 同步搬運，點目前那一步的轉移條件，看卡在哪個接點。",
               "工件明明在末端，X004 卻是 OFF。"],
     "explain": "龍門停在等料的步，轉移條件是前輸送帶末端感測器 X004。工件到了 X004 卻沒 ON：感測器斷線或位置歪了。等料步通常不設逾時（等料是正常的），所以不會報警，只能靠「看步序 + 看轉移條件」找出來。"},

    {"id": "F8", "free": False, "level": 3, "title": "龍門去抓空氣",
     "report": "沒有異常。右邊龍門一直跑去前輸送帶末端降下去吸，但那裡根本沒有工件。",
     "fault": ("force", "X004", 1), "part": "X004", "cause": "sensor_on",
     "clues": ["龍門為什麼覺得有工件？看「有料」的訊號是哪一個。", "看 X004 現在的狀態，和末端到底有沒有工件。"],
     "explain": "末端沒有工件，X004 卻一直 ON：感測器短路、被髒污或反光擋住、或對向的反射板歪了。和 F7 相反。現場判斷法：用手遮住或移開，看輸入燈會不會變化；不會變就是感測器或線路問題。"},
]


class FaultLab(Lab):
    def __init__(self):
        self.case = None
        self.fixed = False
        self.base = 0
        Lab.__init__(self)

    # ---- case life cycle ------------------------------------------------
    def load(self, cid):
        self.case = next(c for c in CASES if c["id"] == cid)
        self.fixed = False
        self.reset()
        meta = {k: self.case[k] for k in ("id", "title", "report", "level", "clues", "free")}
        return json.dumps(meta, ensure_ascii=False)

    def reset(self, parts=6):
        Lab.reset(self, parts)
        if self.case and not self.fixed:
            self._apply(True)

    def _apply(self, on):
        kind = self.case["fault"]
        if kind[0] == "force":
            self.fault(kind[1], kind[2] if on else None)
        elif kind[0] == "attr":
            setattr(getattr(self.m, kind[1]), kind[2], bool(on))
        elif kind[0] == "press":
            self.m.press(kind[1], kind[2] if on else 1)

    def diagnose(self, part, cause):
        c = self.case
        ok_part, ok_cause = part == c["part"], cause == c["cause"]
        if ok_part and ok_cause:
            msg = "診斷正確！可以修理了。修好後要自己把機台救回來：異常復歸 → 原點復歸 → 啟動，搬兩個工件才算結案。"
        elif ok_part:
            msg = "故障的地方找對了，但原因不對。想想：這個元件是一直 OFF、一直 ON，還是根本沒動？"
        elif ok_cause:
            msg = "原因的方向對了，但不是這個元件。回到 I/O 監視，找「應該變化卻沒變化」的那一個。"
        else:
            msg = "還不對。先照提示看異常碼和作用中的步，再點階梯圖看卡在哪個接點。"
        return json.dumps({"ok": ok_part and ok_cause, "part": ok_part, "cause": ok_cause, "msg": msg}, ensure_ascii=False)

    def repair(self):
        self._apply(False)
        self.fixed = True
        self.base = sum(self.m.placed.values())
        return json.dumps({"explain": self.case["explain"]}, ensure_ascii=False)

    def progress(self):
        moved = sum(self.m.placed.values()) - self.base if self.fixed else 0
        alarm = bool(self.plc.m[2] or self.plc.m[3])
        return json.dumps({"fixed": self.fixed, "moved": moved, "solved": self.fixed and moved >= 2 and not alarm,
                           "code": self.plc.d[220], "alarm_text": ALARMS.get(self.plc.d[220], "代碼 %d" % self.plc.d[220])},
                          ensure_ascii=False)


def catalog():
    return json.dumps({"cases": [{k: c[k] for k in ("id", "title", "level", "free")} for c in CASES],
                       "parts": PARTS, "causes": CAUSES, "alarms": ALARMS}, ensure_ascii=False)
