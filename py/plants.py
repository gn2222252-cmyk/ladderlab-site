# -*- coding: utf-8 -*-
"""Small machines for the practice exercises. Each one reads the PLC outputs, moves, and writes the PLC inputs.
step(ms) is called after every scan; state() is what the page draws; faults are things the learner can break."""


class Plant(object):
    kind = ""
    faults = []                       # [(key, label)]

    def __init__(self, plc):
        self.plc = plc
        self.broken = set()
        self.apply()

    def x(self, n, v):
        self.plc.x_in[n] = 1 if v else 0

    def y(self, n):
        return self.plc.y_out[n]

    def set_fault(self, key, on):
        (self.broken.add if on else self.broken.discard)(key)

    def apply(self):
        pass


class Cylinder(Plant):
    """Y0 down, Y2 up; X1 down limit, X2 up limit. Two seconds stroke. 'stuck' = no air."""
    kind = "cylinder"
    faults = [("stuck", "氣壓不足（氣缸卡住）")]

    def __init__(self, plc):
        self.z = 0.0
        Plant.__init__(self, plc)

    @property
    def stuck(self):
        return "stuck" in self.broken

    @stuck.setter
    def stuck(self, on):
        self.set_fault("stuck", on)

    def step(self, ms):
        down, up = self.y(0), self.y(2)
        if not self.stuck:
            if down and not up:
                self.z = min(1.0, self.z + ms / 2000.0)
            elif up and not down:
                self.z = max(0.0, self.z - ms / 2000.0)
        self.apply()

    def apply(self):
        self.x(1, self.z >= 0.98)
        self.x(2, self.z <= 0.02)

    def state(self):
        return {"type": self.kind, "z": self.z, "vac": self.y(1), "stuck": self.stuck}


class Tank(Plant):
    """Water tank. Y0 inlet valve (+15 %/s), Y1 drain pump (-12 %/s), the house always uses 4 %/s.
    X2 low level (<= 20 %), X3 high level (>= 80 %), X4 overflow alarm switch (>= 95 %)."""
    kind = "tank"
    faults = [("high_dead", "高液位感測器 X3 故障（一直 OFF）"), ("valve_stuck", "進水閥卡在打開")]

    def __init__(self, plc, level=0.10):
        self.level = level
        Plant.__init__(self, plc)

    def step(self, ms):
        s = ms / 1000.0
        inflow = self.y(0) or "valve_stuck" in self.broken
        self.level += (0.15 if inflow else 0) * s - (0.12 if self.y(1) else 0) * s - 0.04 * s
        self.level = min(1.0, max(0.0, self.level))
        self.apply()

    def apply(self):
        self.x(2, self.level <= 0.20)
        self.x(3, self.level >= 0.80 and "high_dead" not in self.broken)
        self.x(4, self.level >= 0.95)

    def state(self):
        return {"type": self.kind, "level": self.level, "inlet": int(self.y(0) or "valve_stuck" in self.broken), "drain": self.y(1)}


class Door(Plant):
    """Sliding door, 0 closed .. 1 open, 2.5 s full stroke. Y0 open motor, Y1 close motor.
    X0 fully open, X1 fully closed. X2 person sensor and X3 safety beam are inputs the learner (or test) sets.
    Closing on a person in the beam = a crush; the plant records it."""
    kind = "door"
    faults = [("open_limit_dead", "開到底限位 X0 故障（一直 OFF）")]

    def __init__(self, plc):
        self.pos = 0.0
        self.crush = False
        Plant.__init__(self, plc)

    def step(self, ms):
        d = ms / 2500.0
        o, c = self.y(0), self.y(1)
        if o and not c:
            self.pos = min(1.0, self.pos + d)
        elif c and not o:
            if self.plc.x_in[3] and self.pos < 0.9:
                self.crush = True
            self.pos = max(0.0, self.pos - d)
        self.apply()

    def apply(self):
        self.x(0, self.pos >= 0.99 and "open_limit_dead" not in self.broken)
        self.x(1, self.pos <= 0.01)

    def state(self):
        return {"type": self.kind, "pos": self.pos, "open": self.y(0), "close": self.y(1), "crush": self.crush,
                "person": self.plc.x_in[2], "beam": self.plc.x_in[3]}


class Conveyor(Plant):
    """Packing conveyor. While Y0 runs, a part passes the sensor X2 every 1.0 s (ON for 0.3 s).
    'sensor_dirty' = the sensor misses every other part."""
    kind = "conveyor"
    faults = [("sensor_dirty", "工件感測器 X2 髒污（漏算）")]

    def __init__(self, plc):
        self.travel = 0.0
        self.passed = 0
        self.seen = 0
        Plant.__init__(self, plc)

    def step(self, ms):
        if self.y(0):
            before = int(self.travel)
            self.travel += ms / 1000.0
            if int(self.travel) != before:
                self.passed += 1
        self.apply()

    def apply(self):
        on = (self.travel % 1.0) < 0.3 and self.travel >= 1.0      # a stopped belt leaves the part under the sensor
        if on and "sensor_dirty" in self.broken and int(self.travel) % 2 == 0:
            on = False
        self.x(2, on)

    def state(self):
        return {"type": self.kind, "travel": self.travel, "passed": self.passed, "run": self.y(0), "full_lamp": self.y(1),
                "sensor": self.plc.x_in[2]}


class PneuABC(Plant):
    """Three pneumatic cylinders like the Taiwan pneumatics level B (氣壓乙級) PLC questions.
    A: three-position closed-centre valve (Y0 A+, Y1 A-): with no output it stops where it is. Sensors a0 X10, a1 X11
       (middle), a2 X12. Full stroke 2 s, 1 s with the fast valve Y11 ON.
    B, C: double-solenoid valves (memory): B+ Y2, B- Y3, C+ Y4, C- Y5. They keep the last direction even with all
       outputs off, so after an emergency stop they finish the stroke. b0 X13, b1 X14, c0 X15, c1 X16. Stroke 1 s."""
    kind = "pneu"
    faults = [("a1_dead", "A 缸中間感測器 a1 故障（一直 OFF）")]

    def __init__(self, plc, relief=False):
        self.a, self.b, self.c = 0.0, 0.0, 0.0
        self.bdir, self.cdir = -1, -1
        self.relief = relief          # relief circuit: the emergency stop exhausts B and C, so they stop where they are
        Plant.__init__(self, plc)

    def step(self, ms):
        s = ms / 1000.0
        ap, am = self.y(0), self.y(1)
        speed = 1.0 if self.plc.y_out[9] else 0.5          # Y11 is index 9 (octal 11)
        if ap and not am:
            self.a = min(1.0, self.a + speed * s)
        elif am and not ap:
            self.a = max(0.0, self.a - speed * s)
        if self.y(2) and not self.y(3):
            self.bdir = 1
        elif self.y(3) and not self.y(2):
            self.bdir = -1
        if self.y(4) and not self.y(5):
            self.cdir = 1
        elif self.y(5) and not self.y(4):
            self.cdir = -1
        if not (self.relief and not self.plc.x_in[7]):     # X7 (NC) OFF = emergency stop pressed
            self.b = min(1.0, max(0.0, self.b + self.bdir * s))
            self.c = min(1.0, max(0.0, self.c + self.cdir * s))
        self.apply()

    def apply(self):
        self.x(8, self.a <= 0.02)                                           # X10
        self.x(9, abs(self.a - 0.5) <= 0.03 and "a1_dead" not in self.broken)  # X11
        self.x(10, self.a >= 0.98)                                          # X12
        self.x(11, self.b <= 0.02)                                          # X13
        self.x(12, self.b >= 0.98)                                          # X14
        self.x(13, self.c <= 0.02)                                          # X15
        self.x(14, self.c >= 0.98)                                          # X16

    def state(self):
        y = self.plc.y_out
        return {"type": self.kind, "a": self.a, "b": self.b, "c": self.c, "green": y[6], "red": y[7], "yellow": y[8],
                "fast": y[9]}


class PneuSet(Plant):
    """Configurable cylinders for the level B questions. Each cylinder: name, valve ('center' = three-position closed
    centre, stops without output; 'memory' = double solenoid, keeps the last direction), plus/minus output numbers
    (decimal index of the octal Y), sensor marks [(position 0..1, input index, label)], start position, stroke seconds."""
    kind = "pneuset"
    faults = []

    def __init__(self, plc, cylinders):
        self.cyl = [dict(c, pos=c["start"], dir=-1 if c["start"] < 0.5 else 1) for c in cylinders]
        Plant.__init__(self, plc)

    def step(self, ms):
        s = ms / 1000.0
        for c in self.cyl:
            p, m = self.y(c["plus"]), self.y(c["minus"])
            v = s / c["stroke"]
            if c["valve"] == "center":
                if p and not m:
                    c["pos"] = min(1.0, c["pos"] + v)
                elif m and not p:
                    c["pos"] = max(0.0, c["pos"] - v)
            else:
                if p and not m:
                    c["dir"] = 1
                elif m and not p:
                    c["dir"] = -1
                c["pos"] = min(1.0, max(0.0, c["pos"] + c["dir"] * v))
        self.apply()

    def apply(self):
        for c in self.cyl:
            for at, n, _ in c["marks"]:
                self.x(n, abs(c["pos"] - at) <= (0.02 if at in (0.0, 1.0) else 0.03))

    def state(self):
        y = self.plc.y_out
        return {"type": "pneuset", "cyl": [{"name": c["name"], "pos": c["pos"], "marks": [[at, lab] for at, _, lab in c["marks"]]}
                                           for c in self.cyl], "green": y[6], "red": y[7], "yellow": y[8]}


class ExamDoor(Plant):
    """工業配線乙級第五題的電動門。0 全閉 .. 1 全開，全行程 3 秒。Y0 MC1 開門（正轉）、Y1 MC2 關門（反轉）。
    X4 LS1 全開、X5 LS2 全閉。X6 對照型光電開關（有人＝ON）、X7 積熱電驛 TH（常閉，正常＝ON）由使用者或測試設定。
    關門中光電開關被遮住超過 0.1 秒還在關＝夾到人。"""
    kind = "door2"
    faults = [("ls1_dead", "全開限位 LS1 故障（一直 OFF）")]

    def __init__(self, plc):
        self.pos = 0.0
        self.crush = False
        self.blocked_ms = 0
        Plant.__init__(self, plc)

    def step(self, ms):
        d = ms / 3000.0
        o, c = self.y(0), self.y(1)
        if o and not c:
            self.pos = min(1.0, self.pos + d)
        elif c and not o:
            self.pos = max(0.0, self.pos - d)
        if c and not o and self.plc.x_in[6]:
            self.blocked_ms += ms
            if self.blocked_ms > 100:
                self.crush = True
        else:
            self.blocked_ms = 0
        self.apply()

    def apply(self):
        self.x(4, self.pos >= 0.99 and "ls1_dead" not in self.broken)
        self.x(5, self.pos <= 0.01)

    def state(self):
        y = self.plc.y_out
        return {"type": self.kind, "pos": self.pos, "open": y[0], "close": y[1], "crush": self.crush,
                "beam": self.plc.x_in[6], "th": self.plc.x_in[7], "auto": self.plc.x_in[3],
                "pl1": y[2], "pl2": y[3], "pl3": y[4], "pl4": y[5], "bz": y[6]}


class Belt3(Plant):
    """工業配線乙級第一題的三台輸送帶。Y0～Y2 是 MC1～MC3。積熱電驛 TH1～TH3 接常閉（X4～X6，正常＝ON），
    用「製造故障」讓它跳脫。X3 緊急停止（常閉）由使用者切換。"""
    kind = "belt3"
    faults = [("th1", "M1 過載（TH1 跳脫）"), ("th2", "M2 過載（TH2 跳脫）"), ("th3", "M3 過載（TH3 跳脫）")]

    def __init__(self, plc):
        self.travel = [0.0, 0.0, 0.0]
        Plant.__init__(self, plc)

    def step(self, ms):
        for i in range(3):
            if self.y(i):
                self.travel[i] += ms / 1000.0
        self.apply()

    def apply(self):
        for i in range(3):
            self.x(4 + i, "th%d" % (i + 1) not in self.broken)

    def state(self):
        y = self.plc.y_out
        return {"type": self.kind, "run": [y[0], y[1], y[2]], "travel": list(self.travel), "lamps": [y[3], y[4], y[5], y[6], y[7]],
                "bz": y[8], "th": [self.plc.x_in[4], self.plc.x_in[5], self.plc.x_in[6]], "ems": self.plc.x_in[3], "cos": self.plc.x_in[2]}


class Sump(Plant):
    """工業配線乙級第六題的污水池。水位近接開關 PXS1～PXS6（X10～X15）和考場一樣由人切換；
    緩啟動器、變頻器的過載接點 Tb（常閉，X16、X17）用「製造故障」跳脫。
    Y2 M1（緩啟動器運轉）、Y3 M2（變頻器 FWD）、Y4 變頻器高速（ON＝100%，OFF＝40%）、Y5 污水閥 SV。"""
    kind = "sump"
    faults = [("ss_trip", "緩啟動器過載跳脫（M1）"), ("inv_trip", "變頻器過載跳脫（M2）")]

    def step(self, ms):
        self.apply()

    def apply(self):
        self.x(0o16, "ss_trip" not in self.broken)
        self.x(0o17, "inv_trip" not in self.broken)

    def state(self):
        y, x = self.plc.y_out, self.plc.x_in
        return {"type": self.kind, "pxs": [x[0o10 + i] for i in range(6)], "m1": y[2], "m2": y[3], "fast": y[4], "sv": y[5],
                "mc": [y[0], y[1]], "pl1": y[6], "pl2": y[7], "code": [y[8], y[9], y[10]], "bz": y[11],
                "cos": 2 if x[7] else 1 if x[6] else 0, "ems": x[5], "trip": [not x[0o16], not x[0o17]]}


class Pumps2(Plant):
    """工業配線乙級第二題的兩部抽水機。水塔浮球開關 X7（ON＝缺水）、蓄水池切換開關 X10（ON＝允許抽水）和考場一樣由人切換；
    TH1、TH2（常閉，X5、X6）用「製造故障」跳脫。Y0 MC1、Y1 MC2。"""
    kind = "pumps2"
    faults = [("th1", "#1 抽水機過載（TH1 跳脫）"), ("th2", "#2 抽水機過載（TH2 跳脫）")]

    def step(self, ms):
        self.apply()

    def apply(self):
        self.x(5, "th1" not in self.broken)
        self.x(6, "th2" not in self.broken)

    def state(self):
        y, x = self.plc.y_out, self.plc.x_in
        return {"type": self.kind, "run": [y[0], y[1]], "lamps": [y[2], y[3], y[4], y[5], y[6], y[7]], "bz": y[8], "ems_lamp": y[9],
                "tower_low": x[7], "pool_ok": x[8], "cos": 2 if x[3] else 1 if x[2] else 0, "th": [x[5], x[6]], "ems": x[4]}


Q3_CYL = [
    {"name": "A", "valve": "memory", "plus": 0, "minus": 1, "start": 0.0, "stroke": 1.0, "marks": [(0.0, 8, "a0"), (1.0, 9, "a1")]},
    {"name": "B", "valve": "memory", "plus": 2, "minus": 3, "start": 0.0, "stroke": 1.0, "marks": [(0.0, 10, "b0"), (1.0, 11, "b1")]},
    {"name": "C", "valve": "center", "plus": 4, "minus": 5, "start": 1.0, "stroke": 1.0,
     "marks": [(0.0, 12, "c0"), (0.5, 13, "c1"), (1.0, 14, "c2")]},
]

PLANTS = {"cylinder": Cylinder, "tank": Tank, "door": Door, "conveyor": Conveyor, "pneu": PneuABC, "door2": ExamDoor, "belt3": Belt3, "sump": Sump, "pumps2": Pumps2,
          "pneu_relief": lambda plc: PneuABC(plc, relief=True), "pneu_q3": lambda plc: PneuSet(plc, Q3_CYL)}


def make(kind, plc):
    return PLANTS[kind](plc) if kind in PLANTS else None


def faults_of(kind):
    """Faults the learner can switch on for this machine (factories built with lambda report their class's list)."""
    if kind == "pneu_relief":
        return PneuABC.faults
    if kind == "pneu_q3":
        return PneuSet.faults
    return getattr(PLANTS.get(kind), "faults", [])
