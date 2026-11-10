# -*- coding: utf-8 -*-
"""Troubleshooting cases on the AOI sorter: most are about the PLC <-> host (LabVIEW) handshake, which the gantry
cases do not cover. Same flow: work order -> operate -> diagnose -> repair -> bring production back (2 parts)."""
import json

from aoi_bridge import ALARMS, AoiLab

PARTS = [("PLC", "PLC 程式"), ("HOST_APP", "上位機程式（LabVIEW）"), ("HOST_LINK", "通訊線路／上位機當機"),
         ("AIR", "氣源／調壓閥"), ("CLAMP", "夾爪氣缸／磁簧"), ("STOPPER", "擋料氣缸"), ("CAMERA", "相機／光源")]
CAUSES = [("no_reply", "沒有回覆檢測結果"), ("bad_value", "回覆了不合法的值"), ("link_lost", "通訊中斷（心跳停了）"),
          ("low_air", "氣壓不足"), ("stuck", "機構卡住"), ("program", "PLC 程式錯誤")]

CASES = [
    {"id": "A1", "free": True, "level": 2, "title": "停在檢測，異常 9005",
     "report": "每顆零件都會夾緊、相機燈也亮，但過一陣子就停機，異常碼 9005。上位機畫面看起來還開著。",
     "fault": "no_reply", "part": "HOST_APP", "cause": "no_reply",
     "clues": ["9005 是檢測逾時：PLC 送出檢測請求後，等不到結果。", "看步序停在 70（檢測），D302 的 b0（檢測請求）是 1，D511（結果已寫入）一直是 0。",
               "心跳 D520 還在變：通訊線是好的，上位機也活著，只是沒把結果寫回來。"],
     "explain": "PLC 端一切照規格：在步序 70 把 b0 設 1 並等 D511。心跳還在跳，代表通訊與上位機程式都在跑，問題在上位機的檢測流程（例如相機觸發失敗、例外被吞掉沒回寫）。修的地方在 LabVIEW，不是 PLC。看交握的每一個旗標，就能把責任切清楚。"},
    {"id": "A2", "free": False, "level": 2, "title": "運轉中突然停機，異常 9006",
     "report": "機台運轉幾顆後停機，異常碼 9006，按復歸也復歸不了。",
     "fault": "link_lost", "part": "HOST_LINK", "cause": "link_lost",
     "clues": ["9006 是心跳逾時：PLC 一段時間沒看到上位機的心跳 D520 變化。", "看 D520 還有沒有在變。",
               "復歸不了是因為原因還在（M27）：心跳恢復之前，PLC 不允許復歸。"],
     "explain": "上位機每 100 ms 把 D520 加 1，PLC 看它有沒有變。不變就是上位機當機或通訊線斷了。PLC 設計成「原因還在就不能復歸」，避免在沒有上位機的情況下繼續生產（沒有檢測就分選是錯的）。先恢復通訊，心跳又開始變，再復歸。"},
    {"id": "A3", "free": False, "level": 2, "title": "上位機說它有回，PLC 卻報 9007",
     "report": "異常碼 9007。LabVIEW 工程師說他有寫結果進 D510。",
     "fault": "bad_value", "part": "HOST_APP", "cause": "bad_value",
     "clues": ["9007 是檢測結果不合法。", "規格：D510 = 1 是 OK、2 是 NG、3 是伺服警報。看看 D510 實際寫了什麼。"],
     "explain": "上位機確實有回覆，但寫了規格以外的值。PLC 不會猜：不合法的結果直接報警，不會把零件亂分。這是介面規格（交握表）存在的意義。修上位機，讓它只寫 1、2、3。"},
    {"id": "A4", "free": False, "level": 1, "title": "一開機就報 8004",
     "report": "早上一開機，還沒按啟動，異常燈就亮了，異常碼 8004。",
     "fault": "low_air", "part": "AIR", "cause": "low_air",
     "clues": ["8004 是氣壓不足。看氣壓值和「氣壓正常」感測（M123）。", "空壓機剛開、或調壓閥被調低，都會這樣。"],
     "explain": "氣壓低於門檻時，氣缸動作會變慢甚至動不了，所以 PLC 先擋住。這是現場最常見的早班故障：空壓機還沒打到壓力。等氣壓恢復（M123 ON）再復歸。"},
    {"id": "A5", "free": False, "level": 3, "title": "夾緊那一步逾時，異常 9002",
     "report": "零件到擋料位置後，停在夾緊，異常碼 9002。",
     "fault": "stuck", "part": "CLAMP", "cause": "stuck",
     "clues": ["9002 是夾爪逾時：命令出去了，到位訊號沒來。", "看輸出：夾爪 DO2 有沒有 ON？", "這台的夾爪伸出到位訊號被機構卡住擋掉（D550 bit1 模擬）。"],
     "explain": "命令（輸出）有出去、到位回饋沒來，問題在命令之後：夾爪氣缸、電磁閥、磁簧開關或機構卡料。和雙龍門 F3／F4 一樣，要分辨是「機構沒動」還是「動了但感測器沒回報」，到現場看一眼夾爪的位置最快。"},
]


class AoiFaultLab(AoiLab):
    def __init__(self):
        self.case, self.fixed, self.base = None, False, 0
        AoiLab.__init__(self)

    def load(self, cid):
        self.case = next(c for c in CASES if c["id"] == cid)
        self.fixed = False
        self.reset()
        self._apply(True)
        return json.dumps({k: self.case[k] for k in ("id", "title", "report", "level", "clues", "free")}, ensure_ascii=False)

    def _apply(self, on):
        f = self.case["fault"]
        if f == "no_reply":
            self.set_host("none" if on else "random")
        elif f == "bad_value":
            self.set_host("bad" if on else "random")
        elif f == "link_lost":
            self.set_heartbeat(not on)
        elif f == "low_air":
            self.set_air(not on)
        elif f == "stuck":
            self.clamp_stuck(on)

    def diagnose(self, part, cause):
        c = self.case
        ok_p, ok_c = part == c["part"], cause == c["cause"]
        if ok_p and ok_c:
            msg = "診斷正確！修理後：異常復歸 → 等它清線回到待機 → 啟動，做完 2 顆才算結案。"
        elif ok_p:
            msg = "責任歸屬對了，但原因不對。再看一次交握旗標或感測器。"
        elif ok_c:
            msg = "現象判斷對了，但問題不在這裡。想想：是 PLC、上位機，還是機構？"
        else:
            msg = "還不對。先看異常碼代表什麼，再看相關的 D 暫存器或輸出。"
        return json.dumps({"ok": ok_p and ok_c, "part": ok_p, "cause": ok_c, "msg": msg}, ensure_ascii=False)

    def repair(self):
        self._apply(False)
        self.fixed = True
        self.base = self.plc.d[310]
        return json.dumps({"explain": self.case["explain"]}, ensure_ascii=False)

    def progress(self):
        moved = self.plc.d[310] - self.base if self.fixed else 0
        return json.dumps({"fixed": self.fixed, "moved": moved, "solved": self.fixed and moved >= 2 and self.plc.d[301] == 0,
                           "code": self.plc.d[301], "alarm_text": ALARMS.get(self.plc.d[301], "")}, ensure_ascii=False)

    def regs(self):
        p = self.plc
        return json.dumps({"D302_b0": p.d[302] & 1, "D306": p.d[306], "D510": p.d[510], "D511": p.d[511], "D520": p.d[520],
                           "D314": p.d[314], "D550": p.d[550]})


def catalog():
    return json.dumps({"cases": [{k: c[k] for k in ("id", "title", "level", "free")} for c in CASES], "parts": PARTS,
                       "causes": CAUSES}, ensure_ascii=False)
