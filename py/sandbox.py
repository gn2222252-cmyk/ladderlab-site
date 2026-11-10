# -*- coding: utf-8 -*-
"""Simulator page: pick a machine, write the program as a ladder, an SFC or an instruction list, run it.
The page compiles ladders and SFCs to the instruction list in JavaScript (web/ledit.js, web/sfcedit.js), so the
engine side is the practice bridge with a machine instead of an exercise."""
import json
import re

from practice_bridge import Practice
from exercises import SCAN
from ladder_view import bit, word
from plants import faults_of

BOARD = 0o370                                     # where the page puts the expansion board terminals
FX3S_X = ["X%03o" % n for n in range(16)]          # X000-X017 (octal), the FX3S-30M has all of them
FX3S_Y = ["Y%03o" % n for n in range(16)]          # Y000-Y017

MACHINES = [
    {"id": "free", "title": "只模擬電路（不接機構）", "plant": None,
     "desc": "沒有預設任何用途：X0～X17 每一點都是一個可以切換的輸入，Y0～Y17 是輸出燈。畫什麼就模擬什麼，例如常開 X1 接線圈 Y1，把 X1 切到 ON，Y1 就亮。",
     "inputs": [(x, "", "switch") for x in FX3S_X], "outputs": [(y, "") for y in FX3S_Y],
     "example": "LD X001\nOUT Y001",
     "example_note": "常開 X1 接線圈 Y1：X1 ON 時 Y1 亮。",
     "example_step": "\n".join(["LD M8002", "SET S0", "STL S0", "LD X000", "SET S20", "STL S20", "OUT Y000", "LD X001", "SET S21",
                                "STL S21", "OUT Y001", "LD X002", "OUT S0", "RET"]),
     "example_step_note": "沒有任何機構，只看步序：開機進 S0；X0 ON 進 S20（Y0 亮）；X1 ON 進 S21（Y1 亮、Y0 自動熄）；X2 ON 回 S0。"},
    {"id": "lamp", "title": "按鈕和燈（沒有機構）", "plant": None,
     "desc": "最基本的練習台：三個按鈕、一個開關、四顆燈。先在這裡熟悉梯形圖編輯。",
     "inputs": [("X000", "啟動按鈕", "hold"), ("X001", "停止按鈕", "hold"), ("X002", "按鈕 3", "hold"), ("X003", "切換開關", "toggle")],
     "outputs": [("Y000", "運轉燈"), ("Y001", "閃爍燈"), ("Y002", "燈 3"), ("Y003", "燈 4")],
     "example": "LD X000\nOR Y000\nANI X001\nOUT Y000\nLD Y000\nAND M8013\nOUT Y001\nLD X003\nOUT Y002",
     "example_note": "X0 啟動、X1 停止的自保持；運轉時 Y1 每秒閃一次；X3 開關直接控制 Y2。"},
    {"id": "cylinder", "title": "氣缸取放（上下＋吸盤）", "plant": "cylinder",
     "desc": "一支上下氣缸加吸盤。下降 → 吸 1 秒 → 上升，標準的步進（STL／SFC）練習。",
     "inputs": [("X000", "啟動按鈕", "hold"), ("X001", "下限感測器", "sensor"), ("X002", "上限感測器", "sensor")],
     "outputs": [("Y000", "下降電磁閥"), ("Y001", "吸盤"), ("Y002", "上升電磁閥")],
     "example": "LD M8002\nSET S0\nSTL S0\nLD X000\nAND X002\nSET S20\nSTL S20\nOUT Y000\nLD X001\nSET S21\nSTL S21\nSET Y001\nOUT T0 K10\nLD T0\nSET S22\nSTL S22\nOUT Y002\nLD X002\nOUT S0\nRET\nLD S0\nRST Y001",
     "example_note": "S0 待機 → S20 下降到 X1 → S21 吸盤 ON、等 1 秒 → S22 上升到 X2 → 回 S0。"},
    {"id": "sorter", "title": "輸送帶分料（金屬／塑膠）", "plant": "sorter",
     "desc": "按 X5 放一個工件到輸送帶左邊（金屬、塑膠輪流）。金屬感測器 X1 只對金屬有反應；金屬要在推料氣缸前被推進 B 箱，塑膠一路送到 A 箱。",
     "inputs": [("X006", "啟動按鈕", "hold"), ("X007", "停止按鈕", "hold"), ("X005", "放一個工件", "hold"),
                ("X000", "入口光電", "sensor"), ("X001", "金屬感測器", "sensor"), ("X002", "推料前光電", "sensor"),
                ("X003", "推桿後退端", "sensor"), ("X004", "推桿前進端", "sensor")],
     "outputs": [("Y000", "輸送帶馬達"), ("Y001", "推料氣缸")],
     "example": "LD X006\nOR M0\nANI X007\nOUT M0\nLDP X001\nSET M10\nLDP X002\nAND M10\nSET Y001\nRST M10\nLD X004\nRST Y001\nLD M0\nANI Y001\nOUT Y000",
     "example_note": "M0 是運轉自保持；金屬經過 X1 時記住（M10）；同一個工件到 X2 時推出去，推到底（X4）就收回；推的時候輸送帶停。一次只有一個金屬在 X1 和 X2 之間時才正確，工件多時要用移位（SFTL）記住每一個。"},
    {"id": "stepper", "title": "步進馬達滑台（定位）", "plant": "stepper",
     "desc": "步進馬達帶動的滑台，100 脈波 = 1 mm，行程 0～200 mm。Y0 送脈波、Y4 是方向。開機時脈波計數 D8140 是 0，但滑台不在原點，所以要先原點復歸。用 FX3S 的定位指令 DRVI（相對）、DRVA（絕對），完成時 M8029 ON。",
     "inputs": [("X004", "原點復歸按鈕", "hold"), ("X005", "啟動按鈕", "hold"),
                ("X000", "原點感測器", "sensor"), ("X001", "正極限", "sensor"), ("X002", "100 mm 位置感測器", "sensor")],
     "outputs": [("Y000", "脈波輸出"), ("Y004", "方向（ON = 正轉）"), ("Y006", "原點完成燈")],
     "example": "LD M8002\nSET S0\nSTL S0\nLD X004\nSET S10\nLD X005\nAND M20\nSET S20\nSTL S10\nLDI X000\nDRVI K-30000 K3000 Y000 Y004\nLD X000\nSET S11\nSTL S11\nMOV K0 D8140\nSET M20\nLD M8000\nOUT S0\nSTL S20\nDRVA K10000 K4000 Y000 Y004\nLD M8029\nSET S21\nSTL S21\nOUT T0 K10\nLD T0\nSET S22\nSTL S22\nDRVA K0 K4000 Y000 Y004\nLD M8029\nOUT S0\nRET\nLD M20\nOUT Y006",
     "example_note": "X4 原點復歸：往回走直到原點感測器 X0，把 D8140 歸零。X5 啟動：用 DRVA 走到 10000 脈波（100 mm），等 1 秒再回 0。"},
    {"id": "traffic", "title": "十字路口紅綠燈＋行人按鈕", "plant": "traffic",
     "desc": "南北向、東西向各一組紅黃綠燈，加一顆行人燈。按 X0 行人按鈕：等這一輪結束，兩邊都紅燈時亮行人燈。兩邊同時綠燈會出事。",
     "inputs": [("X000", "行人按鈕", "hold")],
     "outputs": [("Y000", "南北 紅"), ("Y001", "南北 黃"), ("Y002", "南北 綠"), ("Y003", "東西 紅"), ("Y004", "東西 黃"), ("Y005", "東西 綠"), ("Y006", "行人 走")],
     "example": "LD M8002\nSET S0\nLD X000\nSET M0\nSTL S0\nOUT Y002\nOUT Y003\nOUT T0 K50\nLD T0\nSET S20\nSTL S20\nOUT Y001\nOUT Y003\nOUT T1 K20\nLD T1\nSET S21\nSTL S21\nOUT Y000\nOUT Y005\nOUT T2 K50\nLD T2\nSET S22\nSTL S22\nOUT Y000\nOUT Y004\nOUT T3 K20\nLD T3\nAND M0\nSET S23\nLD T3\nANI M0\nOUT S0\nSTL S23\nOUT Y000\nOUT Y003\nOUT Y006\nRST M0\nOUT T4 K40\nLD T4\nOUT S0\nRET",
     "example_note": "南北綠 5 秒 → 南北黃 2 秒 → 東西綠 5 秒 → 東西黃 2 秒；有人按過行人按鈕（M0）就多一步全紅＋行人燈 4 秒，沒有就回 S0。S22 之後是選擇分支。"},
    {"id": "elevator", "title": "三層電梯", "plant": "elevator",
     "desc": "車廂在 1～3 樓之間移動。X4、X5、X6 是 1、2、3 樓的呼叫按鈕，X1～X3 是樓層感測器，Y0 上升、Y1 下降，Y2～Y4 是樓層燈。超過 1 樓或 3 樓會撞到。",
     "inputs": [("X004", "1 樓呼叫", "hold"), ("X005", "2 樓呼叫", "hold"), ("X006", "3 樓呼叫", "hold"),
                ("X001", "1 樓感測器", "sensor"), ("X002", "2 樓感測器", "sensor"), ("X003", "3 樓感測器", "sensor")],
     "outputs": [("Y000", "上升"), ("Y001", "下降"), ("Y002", "1 樓燈"), ("Y003", "2 樓燈"), ("Y004", "3 樓燈")],
     "example": "LD X004\nSET M1\nLD X005\nSET M2\nLD X006\nSET M3\nLD X001\nSET M11\nRST M12\nRST M13\nRST M1\nLD X002\nSET M12\nRST M11\nRST M13\nRST M2\nLD X003\nSET M13\nRST M11\nRST M12\nRST M3\nLD M2\nAND M11\nLD M3\nLD M11\nOR M12\nANB\nORB\nANI Y001\nOUT Y000\nLD M1\nLD M12\nOR M13\nANB\nLD M2\nAND M13\nORB\nANI Y000\nOUT Y001\nLD M11\nOUT Y002\nLD M12\nOUT Y003\nLD M13\nOUT Y004",
     "example_note": "M1～M3 記住呼叫，M11～M13 記住現在在哪一樓；樓上有呼叫就上升、樓下有呼叫就下降，到了那層就清掉呼叫。上升和下降互鎖。"},
    {"id": "arm", "title": "氣壓機械手臂（取放）", "plant": "arm",
     "desc": "左右氣缸（Y0 往右、Y1 往左，雙邊電磁閥）、上下氣缸（Y2 下降，放開會彈回上面）、夾爪 Y3。左邊 X4 有工件時：下降夾起 → 上升 → 往右 → 下降放開 → 上升 → 回左邊。",
     "inputs": [("X010", "啟動按鈕", "hold"), ("X012", "連續運轉", "toggle"),
                ("X000", "左端", "sensor"), ("X001", "右端", "sensor"), ("X002", "上端", "sensor"), ("X003", "下端", "sensor"), ("X004", "取料位有工件", "sensor")],
     "outputs": [("Y000", "往右"), ("Y001", "往左"), ("Y002", "下降"), ("Y003", "夾爪")],
     "example": "LD M8002\nSET S0\nSTL S0\nLD X010\nOR X012\nAND X000\nAND X002\nAND X004\nSET S20\nSTL S20\nOUT Y002\nLD X003\nSET S21\nSTL S21\nOUT Y002\nSET Y003\nOUT T0 K5\nLD T0\nSET S22\nSTL S22\nLD X002\nSET S23\nSTL S23\nOUT Y000\nLD X001\nSET S24\nSTL S24\nOUT Y002\nLD X003\nSET S25\nSTL S25\nOUT Y002\nRST Y003\nOUT T1 K5\nLD T1\nSET S26\nSTL S26\nLD X002\nSET S27\nSTL S27\nOUT Y001\nLD X000\nOUT S0\nRET",
     "example_note": "標準的八步取放。下降用 OUT（步一離開就彈回），夾爪用 SET／RST（要跨好幾步保持）。X12 打開就連續做。"},
    {"id": "tank", "title": "儲槽液位控制", "plant": "tank",
     "desc": "Y0 進水閥、Y1 排水泵，家裡一直在用水。X2 低液位、X3 高液位、X4 溢流警報。用 X0 打開「用水高峰」會開排水泵。",
     "inputs": [("X000", "用水高峰（開排水泵）", "toggle"), ("X002", "低液位", "sensor"), ("X003", "高液位", "sensor"), ("X004", "溢流警報", "sensor")],
     "outputs": [("Y000", "進水閥"), ("Y001", "排水泵"), ("Y002", "溢流警報燈")],
     "example": "LD X002\nSET Y000\nLD X003\nRST Y000\nLD X000\nOUT Y001\nLD X004\nAND M8013\nOUT Y002",
     "example_note": "低於 X2 開始進水（SET），到 X3 停止（RST），中間不動作，這叫遲滯控制。X4 溢流時警報燈閃。可以製造故障：高液位感測器壞掉，看看會怎樣。"},
]
BY_ID = {m["id"]: m for m in MACHINES}


def catalog():
    return json.dumps([{"id": m["id"], "title": m["title"]} for m in MACHINES], ensure_ascii=False)


class Sandbox(Practice):
    def machine(self, mid):
        m = BY_ID[mid]
        self.ex = {"id": "SB-" + mid, "title": m["title"], "task": m["desc"], "inputs": m["inputs"], "outputs": m["outputs"],
                   "plant": m["plant"], "rules": [], "tests": [], "lesson": None, "free": True}
        self.rig, self.rungs, self.leaves = None, [], []
        meta = {k: m.get(k) for k in ("id", "title", "desc", "inputs", "outputs", "plant", "example", "example_note",
                                      "example_step", "example_step_note")}
        meta["faults"] = faults_of(m["plant"])
        return json.dumps(meta, ensure_ascii=False)

    watched = ()
    running = True

    def set_io(self, xs, ys):
        """Free mode: the terminals of the PLC the learner picked (model plus expansion boards / blocks)."""
        xs, ys = json.loads(xs), json.loads(ys)
        ok = re.compile(r"^[XY][0-7]{3}$")
        self.ex["inputs"] = [(x, "", "switch") for x in xs if ok.match(x) and x[0] == "X"]
        self.ex["outputs"] = [(y, "") for y in ys if ok.match(y) and y[0] == "Y"]
        # FX3G-4EX-BD / FX3G-2EYT-BD have no X / Y numbers: the program reads BX0-BX3 as M8112-M8115 and drives
        # BY0-BY1 with M8116-M8117 (FX3S hardware manual, special device list). The page shows them as X370-X373 / Y370-Y371.
        self.bx = [int(x[1:], 8) for x, _, _ in self.ex["inputs"] if int(x[1:], 8) >= BOARD]
        self.by = [int(y[1:], 8) for y, _ in self.ex["outputs"] if int(y[1:], 8) >= BOARD]
        return json.dumps({"inputs": self.ex["inputs"], "outputs": self.ex["outputs"]})

    def compile(self, text):
        """Writes a program into the soft PLC. The switches keep their positions (they are wired, not part of the program)."""
        keep = list(self.rig.plc.x_in) if self.rig else None
        before = (self.rig, self.rungs, self.leaves, getattr(self, "items", []))
        out = Practice.compile(self, text)
        if json.loads(out)["errors"]:                  # a program with errors is not written: the PLC keeps the old one
            self.rig, self.rungs, self.leaves, self.items = before
            return out
        if self.rig and keep is not None:
            self.rig.plc.x_in[:] = keep
        if self.rig and not self.running:
            self._stop_outputs()
        return out

    def _stop_outputs(self):
        """STOP: the CPU stops scanning, every output turns OFF and devices that are not latched are cleared."""
        self.rig.power_cycle(0)

    def run_mode(self, on):
        """The RUN/STOP switch. STOP -> RUN restarts the scan, so M8002 is ON again for the first scan."""
        on = bool(on)
        if self.rig and on != self.running:
            self.rig.power_cycle(0)
        self.running = on

    bx = by = ()

    def tick(self, ms):
        if not self.rig:
            return
        if self.running and (self.bx or self.by):
            p = None
            for _ in range(int(ms) // SCAN):
                p = self.rig.plc
                for n in self.bx:
                    p.m[8112 + n - BOARD] = p.x_in[n]
                self.rig.scan()
                p = self.rig.plc
                for n in self.by:
                    p.y[n] = p.y_out[n] = p.m[8116 + n - BOARD]
        elif self.running:
            self.rig.run(ms)
        elif self.rig.plant:
            for _ in range(int(ms) // SCAN):
                self.rig.plant.step(SCAN)

    def watch(self, names):
        """Devices the page shows in the watch list (the ones the program uses)."""
        self.watched = [n for n in json.loads(names) if re.match(r"^(M|S|T|C|D)\d+$", n)][:60]

    def state(self):
        out = json.loads(Practice.state(self))
        if out and self.rig:
            p = self.rig.plc
            out["words"] = {"D8140": p.d[8140], "M8029": p.m[8029]}
            w = {}
            for n in self.watched:
                k = n[0]
                if k in "MS":
                    w[n] = [int(bool(bit(p, n)))]
                elif k in "TC":
                    w[n] = [int(bool(bit(p, n))), word(p, n)]
                else:
                    w[n] = [word(p, n)]
            out["watch"] = w
            out["run"] = self.running
        return json.dumps(out)
