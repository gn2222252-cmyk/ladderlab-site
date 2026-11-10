# -*- coding: utf-8 -*-
"""Simulator page: pick a machine, write the program as a ladder, an SFC or an instruction list, run it.
The page compiles ladders and SFCs to the instruction list in JavaScript (web/ledit.js, web/sfcedit.js), so the
engine side is the practice bridge with a machine instead of an exercise."""
import json

from practice_bridge import Practice
from plants import faults_of

MACHINES = [
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
        meta = {k: m[k] for k in ("id", "title", "desc", "inputs", "outputs", "plant", "example", "example_note")}
        meta["faults"] = faults_of(m["plant"])
        return json.dumps(meta, ensure_ascii=False)

    def state(self):
        out = json.loads(Practice.state(self))
        if out and self.rig:
            p = self.rig.plc
            out["words"] = {"D8140": p.d[8140], "M8029": p.m[8029]}
        return json.dumps(out)
