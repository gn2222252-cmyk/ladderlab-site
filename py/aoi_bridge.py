# -*- coding: utf-8 -*-
"""AOI inspection sorter: the real 13_PLC program (AOI_PLC.csv, 532 instructions, step register D300) running with
its own machine-simulation section (M198) and a stand-in for the LabVIEW host: heartbeat D520 every 100 ms and the
inspection handshake (D302 b0 -> D510 result, D511 = 1 -> wait b0 = 0 -> D511 = 0), as tests/test_aoi.py does.

A second machine style for the course: the steps live in a data register (MOV K50 D300) instead of STL."""
import json
import os
import random

from bridge import _tree
from ladder_view import Rung, bit, conducts, parse_program, read_source, rung_power
from plc_csv import load_csv
from plc_engine import PLC

HERE = os.path.dirname(os.path.abspath(__file__))
STEPS = {0: "上電", 10: "初始化", 20: "清線", 30: "待機", 40: "要料", 50: "送到擋料", 60: "夾緊", 70: "檢測", 80: "放開",
         90: "送到分選", 100: "推到 NG 料盒", 110: "送到出口", 120: "完成計數", 900: "異常", 910: "等待復歸"}
ALARMS = {0: "無異常", 8001: "急停", 8004: "氣壓不足", 8101: "NG 料盒滿", 9001: "擋料氣缸逾時", 9002: "夾爪逾時（卡住）",
          9003: "推料氣缸逾時", 9004: "零件沒有到位", 9005: "檢測逾時（上位機沒回覆）", 9006: "上位機心跳逾時（斷線）",
          9007: "檢測結果不合法", 9008: "伺服警報（上位機回報）"}
DO = [("M100", "輸送帶"), ("M101", "擋料"), ("M102", "夾爪"), ("M103", "推料"), ("M104", "要料脈衝"), ("M105", "出料"),
      ("M106", "光源"), ("M108", "紅燈"), ("M109", "黃燈"), ("M110", "綠燈"), ("M111", "蜂鳴器")]
DI = [("M124", "入料感測"), ("M125", "到位感測"), ("M126", "分選感測"), ("M127", "出口感測"), ("M123", "氣壓正常"), ("M134", "NG 料盒滿")]
COMMANDS = {"start": 1, "stop": 2, "reset": 3, "clear_bin": 4}
STEP_FLAGS = [("M%d" % (160 + i), "步序 %d %s" % (n, STEPS[n])) for i, n in enumerate([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 900, 910])]
COMMENTS = dict(DO + DI + STEP_FLAGS + [("M198", "模擬區開關"), ("M192", "急停中"), ("M27", "異常原因還在"), ("M21", "停止請求"),
                           ("D300", "步序"), ("D301", "異常碼"), ("D510", "檢測結果"), ("D511", "結果已寫入"), ("D520", "上位機心跳")])


class AoiLab(object):
    def __init__(self):
        self.program = load_csv(os.path.join(HERE, "AOI_PLC.csv"))
        self.items = read_source(os.path.join(HERE, "AOI_PLC_source.il"))
        self.rungs, _ = parse_program(self.items)
        self.leaves, self.layout = [], []
        for r in self.rungs:
            if isinstance(r, Rung):
                self.layout.append({"k": "r", "sec": r.section, "para": r.para, "state": r.state,
                                    "cond": _tree(r.cond, self.leaves), "out": [[op] + list(ops) for op, ops in r.outputs]})
            else:
                self.layout.append({"k": r[0], "state": None, "sec": r[1] if r[0] != "stl" else r[2]})
        self.reset()

    def reset(self):
        self.plc = PLC(self.program)
        self.plc.set_x(3, 1)                 # emergency stop (NC) closed
        self.t = 0
        self.heartbeat = True
        self.answer_mode = "random"          # random / ok / ng / none / bad
        self.ng_rate = 0.3
        self.inspect_ms = 400
        self.inspecting = None
        self.flag_set = False
        self.log = []
        self.rng = random.Random(7)
        self.run(200)

    # ---- host stand-in ---------------------------------------------------
    def _host(self):
        p = self.plc
        if self.t % 100 == 0 and self.heartbeat:
            p.d[520] = (p.d[520] + 1) & 0x7FFF
        status = p.d[302]
        if status & 1 and self.inspecting is None and not self.flag_set and self.answer_mode != "none":
            self.inspecting = self.t + self.inspect_ms
        if self.inspecting is not None and self.t >= self.inspecting:
            self.inspecting = None
            if self.answer_mode == "ok":
                result = 1
            elif self.answer_mode == "ng":
                result = 2
            elif self.answer_mode == "bad":
                result = 7
            else:
                result = 2 if self.rng.random() < self.ng_rate else 1
            p.d[510] = result
            p.d[511] = 1
            self.flag_set = True
            self.log.append("零件 %d 檢測結果：%s" % (p.d[306], {1: "OK", 2: "NG"}.get(result, "不合法(%d)" % result)))
            del self.log[:-6]
        if not status & 1 and self.flag_set:
            p.d[511] = 0
            self.flag_set = False

    def run(self, ms):
        for _ in range(int(ms) // 10):
            self.plc.scan(10)
            self.t += 10
            self._host()

    # ---- operator and faults ---------------------------------------------
    def command(self, name):
        p = self.plc
        if name in COMMANDS:
            p.d[100] = COMMANDS[name]
        elif name == "estop":
            p.set_x(3, 0)
        elif name == "estop_release":
            p.set_x(3, 1)

    def set_host(self, mode, ng_rate=None):
        self.answer_mode = mode
        if ng_rate is not None:
            self.ng_rate = float(ng_rate)

    def set_heartbeat(self, on):
        self.heartbeat = bool(on)

    def set_air(self, ok):
        self.plc.d[314] = 550 if ok else 380

    def set_speed(self, pct):
        self.plc.d[315] = int(pct)

    def clamp_stuck(self, on):
        if on:
            self.plc.d[550] |= 2
        else:
            self.plc.d[550] &= ~2

    # ---- drawing ------------------------------------------------------------
    def layout_json(self):
        return json.dumps({"rungs": self.layout, "comments": {"zh": COMMENTS, "en": COMMENTS}, "steps": STEPS,
                           "alarms": ALARMS, "do": DO, "di": DI}, ensure_ascii=False)

    def state(self):
        p = self.plc
        power, coils = [], []
        for r in self.rungs:
            if isinstance(r, Rung):
                power.append(1 if rung_power(p, r) else 0)
                coils.append([1 if op in ("OUT", "SET") and ops and ops[0][0] in "YMS" and bit(p, ops[0]) else 0
                              for op, ops in r.outputs])
            else:
                power.append(0)
                coils.append([])
        return json.dumps({
            "step": p.d[300], "alarm": p.d[301], "total": p.d[310], "ok": p.d[311], "ng": p.d[312], "bin": p.d[313],
            "part": {"on": p.d[400] == 1, "id": p.d[401], "pos": p.d[402], "result": p.d[403]},
            "do": {d: int(bit(p, d)) for d, _ in DO}, "di": {d: int(bit(p, d)) for d, _ in DI},
            "estop": not p.x_in[3], "air": p.d[314], "speed": p.d[315], "heartbeat": self.heartbeat,
            "host": self.answer_mode, "cause_present": int(bit(p, "M27")), "log": self.log,
            "leaves": "".join("1" if conducts(p, x) else "0" for x in self.leaves), "power": power, "coils": coils,
            "steps": [], "time": self.t}, ensure_ascii=False)

    def explain(self, index):
        from ladder_view import explain
        r = self.rungs[int(index)]
        return explain(r, self.plc, COMMENTS) if isinstance(r, Rung) else ""
