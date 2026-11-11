#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""軟儀器：沒有真儀器，也能用真的 LabVIEW 練「接入新儀器」。

一支程式同時開四個 TCP 埠，各模擬一台儀器。行為對照網頁練習台的
web/labview/assets/instsim.js（同名儀器的命令、回覆格式、錯誤行為、數值都一樣）。

    5561  gpd  GW Instek GPD-3303S 電源供應器   文字，一問一答
    5562  dmm  Keysight 34461A 數位電表          SCPI，錯誤佇列
    5563  bal  A&D FX-i 電子天平                 預設不主動送；可以開連續輸出
    5564  dtb  台達 DTB 溫度控制器               Modbus RTU（位元組原樣走 TCP）

LabVIEW 的 VISA 資源名稱：TCPIP0::127.0.0.1::5561::SOCKET（埠號換成上面那一台）

TCP 沒有鮑率，也沒有同位。這裡練的是：命令、結尾字元、回覆格式、逾時、錯誤處理。
鮑率與同位設錯會怎樣，請到網頁的「儀器練習台」（labview/instlab.html）練。

只用 Python 標準函式庫。啟動：python soft_instruments.py
"""
import argparse
import heapq
import math
import random
import re
import socket
import sys
import threading
import time
from decimal import Decimal, ROUND_HALF_UP

DEFAULT_HOST = "127.0.0.1"
DEFAULT_BASE_PORT = 5561
ORDER = ["gpd", "dmm", "bal", "dtb"]          # 埠號＝base-port＋這裡的順序，--only 不會改變埠號


# ====================================================================== 小工具
def visible(data):
    """把位元組寫成看得見的樣子：\\r \\n 畫出來，其他不可見的寫成 \\xNN。"""
    out = []
    for b in data:
        if b == 13:
            out.append("\\r")
        elif b == 10:
            out.append("\\n")
        elif b == 9:
            out.append("\\t")
        elif 32 <= b < 127:
            out.append(chr(b))
        else:
            out.append("\\x%02X" % b)
    return "".join(out)


def hexs(data):
    return " ".join("%02X" % b for b in data)


def crc16(data):
    """Modbus RTU 的 CRC-16（多項式 A001h，起始值 FFFFh）。"""
    c = 0xFFFF
    for b in data:
        c ^= b
        for _ in range(8):
            c = (c >> 1) ^ 0xA001 if c & 1 else c >> 1
    return c


def rtu_frame(body):
    """在後面接上 CRC：低位元組在前。"""
    c = crc16(body)
    return bytes(body) + bytes([c & 0xFF, c >> 8])


def fixed(x, digits):
    """和 JavaScript 的 toFixed 一樣（剛好一半時進位）。"""
    q = Decimal(1).scaleb(-digits)
    return str(Decimal(x).quantize(q, rounding=ROUND_HALF_UP))


def sci(v):
    """+4.99873847E+00 這種寫法：正負號、8 位小數、指數至少兩位。"""
    return ("-" if v < 0 else "+") + ("%.8E" % abs(v))


_FLOAT = re.compile(r"\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?")


def parse_float(s):
    """和 JavaScript 的 parseFloat 一樣：從頭讀到不是數字為止；讀不到是 NaN。"""
    m = _FLOAT.match(s)
    return float(m.group(0)) if m else float("nan")


def i16(v):
    return int(math.floor(v + 0.5)) % 65536


class Clock:
    """毫秒，從程式啟動算起。"""

    def __init__(self):
        self.t0 = time.monotonic()

    def now(self):
        return (time.monotonic() - self.t0) * 1000.0


class LineBuffer:
    """收到結尾字元才算一行。每條連線各有一個。
    mode：'any' \\r 或 \\n 都算；'lf' 要 \\n（前面有 \\r 也可以）；'crlf' 一定要 \\r\\n。
    半截命令 1 秒沒有下文就丟掉（模擬的簡化，和 instsim.js 一樣）。"""

    def __init__(self, mode, now):
        self.mode, self.now, self.buf, self.last = mode, now, "", 0.0

    def feed(self, data):
        t = self.now()
        if self.buf and t - self.last > 1000:
            self.buf = ""
        self.last = t
        self.buf += data.decode("latin-1")
        lines = []
        while True:
            k = -1
            for i, c in enumerate(self.buf):
                if c == "\n" or (c == "\r" and self.mode == "any"):
                    k = i
                    break
            if k < 0:
                break
            line, self.buf = self.buf[:k + 1], self.buf[k + 1:]
            if self.mode == "crlf" and not line.endswith("\r\n"):
                continue                                   # 結尾不對：這一行當作沒看到
            lines.append(line.rstrip("\r\n"))
        if len(self.buf) > 256:
            self.buf = ""
        return lines


class Instrument:
    name = ""
    title = ""
    summary = ""
    binary = False            # True：紀錄用十六進位
    frame_gap = 0.0           # 大於 0：安靜這麼多秒才算一個封包（Modbus RTU）

    def __init__(self, clock, seed=None):
        self.clock = clock
        self.rng = random.Random(seed)
        self.lock = threading.RLock()
        self.conns = set()

    def gauss(self):
        r = self.rng.random
        return (r() + r() + r() + r() - 2) * 1.73

    def new_session(self):
        return None

    def on_bytes(self, conn, session, data):
        raise NotImplementedError

    def tick(self):
        pass


# ====================================================================== 1) GW Instek GPD-3303S
class Gpd(Instrument):
    name = "gpd"
    title = "GW Instek GPD-3303S 電源供應器"
    summary = "文字，一問一答；結尾 \\n、\\r、\\r\\n 都收；回覆結尾 \\r\\n"
    BAUDS = [115200, 57600, 9600]

    def __init__(self, clock, seed=None):
        super().__init__(clock, seed)
        self.v = [5.0, 5.0]           # 設定電壓 CH1、CH2
        self.i = [1.0, 1.0]           # 電流上限
        self.out = False
        self.err = ""
        self.R = [10.0, 47.0]         # 接在輸出上的負載（歐姆）
        self.baud = 9600              # 只影響 STATUS? 的最後兩個位元；TCP 沒有鮑率
        self.track = 0                # 0 獨立、1 串聯、2 並聯
        self.beep = 0

    def new_session(self):
        return LineBuffer("any", self.clock.now)

    def _cc(self, ch):
        return self.out and self.v[ch] / self.R[ch] > self.i[ch]

    def _meas(self, ch):
        if not self.out:
            return 0.0, 0.0
        v = self.v[ch]
        i = v / self.R[ch]
        if i > self.i[ch]:            # 電流到上限：變成定電流，電壓掉下來
            i = self.i[ch]
            v = i * self.R[ch]
        return max(0.0, v + self.gauss() * 0.001), max(0.0, i + self.gauss() * 0.0005)

    def on_bytes(self, conn, session, data):
        for line in session.feed(data):
            self._line(conn, line)

    def _line(self, conn, line):
        s = line.strip().upper()

        def say(x):
            conn.send((x + "\r\n").encode("latin-1"), 15)

        if not s:
            return
        if len(s) > 15:
            self.err = "Program mnemonic too long"
            return
        if s == "*IDN?":
            return say("GW INSTEK,GPD-3303S,SN:EK123456,V1.00")
        m = re.fullmatch(r"([VI])SET([12]):(.*)", s)
        if m:
            arg, ch = m.group(3).strip(), int(m.group(2)) - 1
            if arg == "":
                self.err = "Missing parameter"
                return
            if not re.fullmatch(r"\d+(\.\d+)?", arg):
                self.err = "Invalid character"
                return
            val = float(arg)
            if m.group(1) == "V":
                if val > 32:
                    self.err = "Data out of range"
                    return
                self.v[ch] = val
            else:
                if val > 3.2:
                    self.err = "Data out of range"
                    return
                self.i[ch] = val
            return                                         # 設定類命令沒有回覆
        m = re.fullmatch(r"([VI])SET([12])\?", s)
        if m:
            ch = int(m.group(2)) - 1
            return say(fixed(self.v[ch], 3) + "V" if m.group(1) == "V" else fixed(self.i[ch], 3) + "A")
        m = re.fullmatch(r"([VI])OUT([12])\?", s)
        if m:
            v, i = self._meas(int(m.group(2)) - 1)
            return say(fixed(v, 3) + "V" if m.group(1) == "V" else fixed(i, 3) + "A")
        if s == "OUT1":
            self.out = True
            return
        if s == "OUT0":
            self.out = False
            return
        if s == "STATUS?":
            # 手冊：bit2–3 追蹤模式（01 獨立、11 串聯、10 並聯），bit4 Beep，bit5 輸出
            b = self.BAUDS.index(self.baud)
            return say(("0" if self._cc(0) else "1") + ("0" if self._cc(1) else "1")
                       + ["01", "11", "10"][self.track] + str(self.beep)
                       + ("1" if self.out else "0") + str(b & 1) + str(b >> 1))
        if s == "ERR?":
            msg, self.err = self.err or "No Error.", ""
            return say(msg)
        m = re.fullmatch(r"BAUD([012])", s)
        if m:
            self.baud = self.BAUDS[int(m.group(1))]
            return
        m = re.fullmatch(r"TRACK([012])", s)
        if m:
            self.track = int(m.group(1))   # 只改 STATUS?，兩個通道的連動沒有模擬
            return
        m = re.fullmatch(r"BEEP([01])", s)
        if m:
            self.beep = int(m.group(1))
            return
        if re.fullmatch(r"LOCAL|RCL[1-4]|SAV[1-4]", s):
            return
        if s == "HELP?":
            return say("ISET VSET IOUT VOUT TRACK BEEP OUT STATUS *IDN RCL SAV ERR BAUD LOCAL")
        if re.fullmatch(r"OUT|BEEP|TRACK|BAUD|RCL|SAV", s):
            self.err = "Missing parameter"
            return
        self.err = "Undefined header"                      # 下錯命令：不回覆，只記下來，ERR? 才問得到


# ====================================================================== 2) Keysight 34461A（SCPI socket）
def scpi_is(pattern, hdr):
    """SYSTem:ERRor 這種寫法：大寫的部分是縮寫。hdr 是全大寫。長寫法、短寫法都對。"""
    p, h = pattern.split(":"), hdr.split(":")
    if len(p) != len(h):
        return False
    for a, b in zip(p, h):
        short = re.sub(r"[a-z]", "", a)
        if b != short.upper() and b != a.upper():
            return False
    return True


class Dmm(Instrument):
    name = "dmm"
    title = "Keysight 34461A 數位電表"
    summary = "SCPI；命令結尾要 \\n；回覆結尾 \\n；下錯命令不回覆，要問 SYST:ERR?"

    def __init__(self, clock, seed=None):
        super().__init__(clock, seed)
        self.func = "VOLT"
        self.nplc = 10.0
        self.errs = []
        self.sig = {"VOLT": 4.99871, "RES": 1000.23, "CURR": 0.0000012}     # 接在輸入端的東西
        self.busy_until = 0.0
        self.last = None

    def new_session(self):
        return LineBuffer("lf", self.clock.now)

    def _err(self, code, text):
        if len(self.errs) < 20:                            # 佇列最多 20 筆
            self.errs.append('%d,"%s"' % (code, text))

    def _t_meas(self):
        return self.nplc / 60 * 1000 * 2 + 20              # 量一次要多久（毫秒，示意）

    def _reading(self):
        base = self.sig[self.func]
        if abs(base) > 1200:
            return 9.9e37                                  # 超過量程
        v = base * (1 + self.gauss() * 4e-6 * math.sqrt(10 / self.nplc))
        if self.func == "VOLT":
            v += 2e-5 * math.sin(self.clock.now() / 9000)
        return v

    def on_bytes(self, conn, session, data):
        for line in session.feed(data):
            for part in line.split(";"):
                self._exec(conn, part)

    def _exec(self, conn, line):
        s = line.strip()
        if not s:
            return
        now = self.clock.now()

        def say(x, delay=15):
            conn.send((x + "\n").encode("latin-1"), delay)

        parts = s.split(None, 1)
        hdr = parts[0].upper()
        arg = parts[1].strip() if len(parts) > 1 else ""
        q = hdr.endswith("?")
        if q:
            hdr = hdr[:-1]
        if hdr.startswith(":"):
            hdr = hdr[1:]

        def is_(*patterns):
            return any(scpi_is(p, hdr) for p in patterns)

        if hdr == "*IDN" and q:
            return say("Keysight Technologies,34461A,MY53200000,A.02.08-02.37-02.08-00.49-01-01")
        if hdr == "*RST" and not q:
            self.func, self.nplc = "VOLT", 10.0
            return
        if hdr == "*CLS" and not q:
            self.errs = []
            return
        if hdr == "*OPC" and q:
            return say("1", max(15, self.busy_until - now))
        if is_("SYSTem:ERRor", "SYSTem:ERRor:NEXT") and q:
            return say(self.errs.pop(0) if self.errs else '+0,"No error"')
        f = ("VOLT" if is_("MEASure:VOLTage:DC", "MEASure:VOLTage") else "RES" if is_("MEASure:RESistance")
             else "CURR" if is_("MEASure:CURRent:DC", "MEASure:CURRent") else "")
        if f:
            if not q:
                return self._err(-113, "Undefined header")
            self.func, self.nplc = f, 10.0
            self.busy_until = now + self._t_meas()
            return say(sci(self._reading()), self._t_meas())
        f = ("VOLT" if is_("CONFigure:VOLTage:DC", "CONFigure:VOLTage") else "RES" if is_("CONFigure:RESistance")
             else "CURR" if is_("CONFigure:CURRent:DC", "CONFigure:CURRent") else "")
        if f and not q:
            self.func, self.nplc = f, 10.0                 # 設定命令：沒有回覆
            return
        if is_("CONFigure") and q:
            rng = {"VOLT": "+1.00000000E+01,+3.00000000E-06", "RES": "+1.00000000E+03,+1.00000000E-03",
                   "CURR": "+1.00000000E-04,+1.00000000E-10"}[self.func]
            return say('"%s %s"' % (self.func, rng))
        if any(scpi_is(pre + tail, hdr) for pre in ("", "SENS:", "SENSe:")
               for tail in ("VOLTage:DC:NPLC", "VOLTage:NPLC", "RESistance:NPLC")):
            if q:
                return say(sci(self.nplc))
            if arg == "":
                return self._err(-109, "Missing parameter")
            val = parse_float(arg)
            if val not in (0.02, 0.2, 1, 10, 100):
                return self._err(-222, "Data out of range")
            self.nplc = val
            return
        if hdr == "READ" and q:
            self.busy_until = now + self._t_meas()
            return say(sci(self._reading()), self._t_meas())
        if is_("INITiate", "INITiate:IMMediate") and not q:
            self.busy_until = now + self._t_meas()
            self.last = self._reading()
            return
        if is_("FETCh") and q:
            if self.last is None:
                return self._err(-230, "Data corrupt or stale")
            return say(sci(self.last), max(15, self.busy_until - now))
        self._err(-113, "Undefined header")                # 不認得：不回覆，放進錯誤佇列


# ====================================================================== 3) A&D FX-i 電子天平
class Bal(Instrument):
    name = "bal"
    title = "A&D FX-i 電子天平"
    summary = "預設 Key mode：不問不送；命令結尾一定要 \\r\\n；一筆 17 個位元組"

    def __init__(self, clock, seed=None):
        super().__init__(clock, seed)
        self.target = 0.0             # 秤盤上真正的重量
        self.shown = 0.0              # 顯示值：慢慢追上 target
        self.zero = 0.0
        self.changed = -1e9           # 上一次放上／拿走的時間
        self.stream = False           # False＝Key mode（出廠）；SIR 命令改成連續送
        self.t = 0.0
        self.next_out = 100.0
        self.want = set()             # 送了 S、正在等穩定的連線
        self.want_all = False         # 有人按了天平上的 PRINT
        self.cap = 220.0
        self.sent = 0                 # 連續送出的筆數（給紀錄用）

    def new_session(self):
        return LineBuffer("crlf", self.clock.now)

    def _stable(self):
        return self.t - self.changed > 1200 and abs(self.target - self.shown) < 0.004

    def _fmt(self):
        w = self.shown - self.zero + self.gauss() * (0.002 if self._stable() else 0.04)
        if self.shown > self.cap:
            return b"OL,+9999999E+19\r\n"
        w = math.floor(w * 100 + 0.5) / 100
        digits = ("%.2f" % abs(w)).rjust(8, "0")
        sign = "-" if w < 0 else "+"
        return ("%s,%s%s  g\r\n" % ("ST" if self._stable() else "US", sign, digits)).encode("latin-1")

    def on_bytes(self, conn, session, data):
        self._step(self.clock.now())
        for line in session.feed(data):
            s = line.strip().upper()
            if s == "Q":
                conn.send(self._fmt(), 20)                 # 立刻要一筆
            elif s == "S":
                self.want.add(conn)                        # 穩定了才給
            elif s in ("Z", "R", "T"):
                self.zero = self.shown
            elif s == "SIR":
                self.stream = True
            elif s == "C":
                self.stream = False
            # 其他命令：不回應（模擬值，說明書沒寫）

    def _step(self, to):
        while self.t < to:
            n = min(to, self.t + 10)
            self.shown += (self.target - self.shown) * (1 - math.exp(-(n - self.t) / 150))
            self.t = n
            if self.t >= self.next_out:                    # 每 0.1 秒看一次要不要送
                self.next_out += 100
                if self.stream:
                    frame = self._fmt()
                    self.sent += 1
                    for c in list(self.conns):
                        c.send(frame, 0, quiet=True)
                elif (self.want or self.want_all) and self._stable():
                    frame = self._fmt()
                    targets = list(self.conns) if self.want_all else [c for c in self.want if c in self.conns]
                    self.want, self.want_all = set(), False
                    for c in targets:
                        c.send(frame, 0)

    def tick(self):
        self._step(self.clock.now())

    # ---- 天平旁邊的人做的事
    def put(self, grams):
        self._step(self.clock.now())
        self.target = max(0.0, float(grams))
        self.changed = self.t

    def remove(self):
        self.put(0)

    def press_print(self):
        self.want_all = True


# ====================================================================== 4) 台達 DTB 溫度控制器（Modbus RTU）
class Dtb(Instrument):
    name = "dtb"
    title = "台達 DTB 溫度控制器"
    summary = "Modbus RTU 位元組原樣走 TCP；站號 1；CRC 或站號不對完全不回"
    binary = True
    frame_gap = 0.03

    def __init__(self, clock, seed=None, station=1):
        super().__init__(clock, seed)
        self.pv = 25.0
        self.sv = 100.0
        self.hi, self.lo = 500.0, -20.0
        self.t = 0.0
        self.station = station
        self.wen = 0                  # 0810H：通訊寫入許可，預設 0（禁止）
        self.run = 1                  # 0814H：RUN／STOP
        self.open = False             # 感測器的線被拔掉

    def _advance(self):
        now = self.clock.now()
        dt = now - self.t
        if dt > 0:
            self.pv += ((self.sv if self.run else 25.0) - self.pv) * (1 - math.exp(-dt / 20000))
            self.t = now

    def _read(self, addr):
        if addr == 0x1000:
            return 0x8003 if self.open else i16((self.pv + self.gauss() * 0.04) * 10)
        if addr == 0x1001:
            return i16(self.sv * 10)
        return None

    def _write(self, addr, v):
        if addr != 0x1001:
            return 2
        if not self.wen:
            return 2                                       # 寫入沒被允許（例外碼是模擬值）
        s = (v - 65536 if v > 32767 else v) / 10
        if s > self.hi or s < self.lo:
            return 3
        self.sv = s
        return 0

    def _bit(self, addr):
        return self.wen if addr == 0x0810 else self.run if addr == 0x0814 else None

    def _pdu(self, func, d):
        if func == 5:
            if len(d) != 4:
                return [0x85, 3]
            a, v = d[0] << 8 | d[1], d[2] << 8 | d[3]
            if self._bit(a) is None:
                return [0x85, 2]
            if v not in (0xFF00, 0):
                return [0x85, 3]
            if a == 0x0810:
                self.wen = 1 if v else 0
            else:
                self.run = 1 if v else 0
            return [5] + list(d)
        if func == 2:
            if len(d) != 4:
                return [0x82, 3]
            a, q = d[0] << 8 | d[1], d[2] << 8 | d[3]
            if q < 1 or q > 16:
                return [0x82, 3]
            out = 0
            for k in range(q):
                v = self._bit(a + k)
                if v is None:
                    if k == 0:
                        return [0x82, 2]
                    v = 0
                out |= v << k
            return [2, 2, out & 0xFF, out >> 8] if q > 8 else [2, 1, out]
        if func in (3, 4):
            if len(d) != 4:
                return [func | 0x80, 3]
            a, q = d[0] << 8 | d[1], d[2] << 8 | d[3]
            if func == 4:
                return [0x84, 1]
            if q < 1 or q > 8:
                return [0x83, 3]
            out = [3, q * 2]
            for k in range(q):
                v = self._read(a + k)
                if v is None:
                    return [0x83, 2]
                out += [v >> 8, v & 0xFF]
            return out
        if func == 6:
            if len(d) != 4:
                return [0x86, 3]
            e = self._write(d[0] << 8 | d[1], d[2] << 8 | d[3])
            return [0x86, e] if e else [6] + list(d)
        return [func | 0x80, 1]

    def on_bytes(self, conn, session, data):
        self._advance()
        b = bytes(data)
        if len(b) < 4:
            return
        c = crc16(b[:-2])
        if b[-2] != (c & 0xFF) or b[-1] != (c >> 8):
            return                                         # CRC 不對：不回應
        if b[0] != self.station:
            return                                         # 不是叫我：不回應
        conn.send(rtu_frame(bytes([self.station] + self._pdu(b[1], list(b[2:-2])))), 30)

    def sensor_open(self, flag):
        self.open = bool(flag)


CLASSES = {"gpd": Gpd, "dmm": Dmm, "bal": Bal, "dtb": Dtb}


# ====================================================================== 伺服器
class Conn:
    def __init__(self, server, inst, sock, addr):
        self.server, self.inst, self.sock, self.addr = server, inst, sock, addr
        self.tag = "%s %s:%s" % (inst.name, addr[0], addr[1])
        self.wlock = threading.Lock()
        self.closed = False

    def send(self, data, delay_ms=0, quiet=False):
        """過 delay_ms 毫秒後送出（儀器回話要時間）。"""
        self.server._schedule(self, bytes(data), delay_ms, quiet)

    def _send_now(self, data, quiet):
        if self.closed:
            return
        try:
            with self.wlock:
                self.sock.sendall(data)
        except OSError:
            self.closed = True
            return
        if not quiet:
            self.server.log_bytes(self, "送出", data)


class SoftInstrumentServer:
    """把幾台軟儀器各開在一個 TCP 埠。ports：{'gpd': 5561, ...}，0 表示讓系統挑。"""

    def __init__(self, host=DEFAULT_HOST, ports=None, seed=None, log=None):
        if ports is None:
            ports = {n: DEFAULT_BASE_PORT + i for i, n in enumerate(ORDER)}
        self.host = host
        self.clock = Clock()
        self.instruments = {}
        for n in ORDER:
            if n in ports:
                self.instruments[n] = CLASSES[n](self.clock, None if seed is None else seed + ORDER.index(n))
        self._want_ports = dict(ports)
        self.ports = {}
        self._log = log if log is not None else self._print
        self._plock = threading.Lock()
        self._stop = threading.Event()
        self._listeners = {}
        self._threads = []
        self._conns = set()
        self._heap, self._seq, self._cv = [], 0, threading.Condition()
        self._stream_seen = 0

    # ---- 紀錄
    def _print(self, text):
        with self._plock:
            try:
                print(text, flush=True)
            except (OSError, ValueError):
                pass

    def log(self, text):
        self._log(text)

    def log_bytes(self, conn, what, data):
        body = hexs(data) if conn.inst.binary else visible(data)
        self._log("[%s] %s %3d 個位元組  %s" % (conn.tag, what, len(data), body))

    # ---- 啟動／停止
    def start(self):
        try:
            for name in self.instruments:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                if sys.platform != "win32":
                    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind((self.host, self._want_ports[name]))
                s.listen(8)
                s.settimeout(0.3)
                self._listeners[name] = s
                self.ports[name] = s.getsockname()[1]
        except OSError:
            for s in self._listeners.values():
                s.close()
            self._listeners = {}
            raise
        for name, s in self._listeners.items():
            self._spawn(self._accept, name, s)
        self._spawn(self._sender)
        self._spawn(self._ticker)
        return self

    def _spawn(self, fn, *args):
        t = threading.Thread(target=fn, args=args, daemon=True)
        t.start()
        self._threads.append(t)

    def stop(self):
        self._stop.set()
        with self._cv:
            self._cv.notify_all()
        for s in list(self._listeners.values()):
            try:
                s.close()
            except OSError:
                pass
        for c in list(self._conns):
            self._close(c)
        for t in self._threads:
            if t is not threading.current_thread():
                t.join(timeout=1.0)

    def __enter__(self):
        return self.start()

    def __exit__(self, *exc):
        self.stop()

    def resource(self, name):
        host = "127.0.0.1" if self.host in ("0.0.0.0", "") else self.host
        return "TCPIP0::%s::%d::SOCKET" % (host, self.ports[name])

    # ---- 連線
    def _accept(self, name, lsock):
        inst = self.instruments[name]
        while not self._stop.is_set():
            try:
                sock, addr = lsock.accept()
            except socket.timeout:
                continue
            except OSError:
                return
            sock.settimeout(None)
            try:
                sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            except OSError:
                pass
            conn = Conn(self, inst, sock, addr)
            self._conns.add(conn)
            with inst.lock:
                inst.conns.add(conn)
            self._spawn(self._serve, conn)

    def _serve(self, conn):
        inst = conn.inst
        session = inst.new_session()
        self._log("[%s] 連上了" % conn.tag)
        try:
            alive = True
            while alive and not self._stop.is_set():
                data = conn.sock.recv(4096)
                if not data:
                    break
                if inst.frame_gap:                         # RTU：後面安靜一小段，才算一個封包收完
                    conn.sock.settimeout(inst.frame_gap)
                    try:
                        while True:
                            more = conn.sock.recv(4096)
                            if not more:
                                alive = False
                                break
                            data += more
                    except socket.timeout:
                        pass
                    conn.sock.settimeout(None)
                self.log_bytes(conn, "收到", data)
                with inst.lock:
                    inst.on_bytes(conn, session, data)
        except OSError:
            pass
        finally:
            self._close(conn)
            self._log("[%s] 斷線" % conn.tag)

    def _close(self, conn):
        conn.closed = True
        self._conns.discard(conn)
        with conn.inst.lock:
            conn.inst.conns.discard(conn)
            if hasattr(conn.inst, "want"):
                conn.inst.want.discard(conn)
        try:
            conn.sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        try:
            conn.sock.close()
        except OSError:
            pass

    # ---- 排程：到時間才送出
    def _schedule(self, conn, data, delay_ms, quiet):
        with self._cv:
            self._seq += 1
            heapq.heappush(self._heap, (time.monotonic() + max(0.0, delay_ms) / 1000.0, self._seq, conn, data, quiet))
            self._cv.notify()

    def _sender(self):
        while not self._stop.is_set():
            with self._cv:
                while not self._stop.is_set():
                    if not self._heap:
                        self._cv.wait(0.5)
                        continue
                    wait = self._heap[0][0] - time.monotonic()
                    if wait <= 0:
                        break
                    self._cv.wait(wait)
                if self._stop.is_set():
                    return
                _, _, conn, data, quiet = heapq.heappop(self._heap)
            conn._send_now(data, quiet)

    def _ticker(self):
        last_report = time.monotonic()
        while not self._stop.wait(0.02):
            for inst in self.instruments.values():
                with inst.lock:
                    inst.tick()
            bal = self.instruments.get("bal")
            if bal and time.monotonic() - last_report >= 1.0:      # 連續輸出一秒十筆，紀錄只印一行
                last_report = time.monotonic()
                with bal.lock:
                    n, self._stream_seen = bal.sent - self._stream_seen, bal.sent
                    listeners = len(bal.conns)
                    sample = visible(bal._fmt()) if n else ""
                if n:
                    self._log("[bal] 連續輸出中：這一秒送了 %d 筆給 %d 條連線，現在是 %s" % (n, listeners, sample))

    # ---- 鍵盤：儀器旁邊的人做的事
    KEYS_HELP = "p 放上 50 g　r 拿走　o 過載（300 g）　k 按天平的 PRINT　s 拔掉／接回溫控器的感測器　h 說明　q 結束"

    def key(self, ch):
        """回傳要印給學生看的一句話；不認得回 None。"""
        ch = (ch or "").strip().lower()[:1]
        bal, dtb = self.instruments.get("bal"), self.instruments.get("dtb")
        if ch in ("p", "r", "o", "k"):
            if not bal:
                return "這次沒有開天平（bal）。"
            with bal.lock:
                if ch == "p":
                    bal.put(50)
                    return "天平：放上 50 g。先晃一下（US），大約 1.5 秒後穩定（ST）。"
                if ch == "r":
                    bal.remove()
                    return "天平：拿走了。"
                if ch == "o":
                    bal.put(300)
                    return "天平：放上 300 g，超過秤量，會送 OL。"
                bal.press_print()
                return "天平：按了 PRINT。穩定時送出一筆。"
        if ch == "s":
            if not dtb:
                return "這次沒有開溫控器（dtb）。"
            with dtb.lock:
                dtb.sensor_open(not dtb.open)
                return "溫控器：感測器的線%s。" % ("拔掉了，PV 會讀到 8003H" if dtb.open else "接回去了")
        if ch == "h":
            return self.KEYS_HELP
        return None


# ====================================================================== 命令列
def plan_ports(base_port=DEFAULT_BASE_PORT, only=None):
    """--only 只決定開哪幾台；每台的埠號固定是 base-port＋它在 ORDER 裡的順序。"""
    names = ORDER if not only else [n.strip().lower() for n in only.split(",") if n.strip()]
    bad = [n for n in names if n not in ORDER]
    if bad:
        raise ValueError("沒有這台儀器：%s（可以用的：%s）" % (", ".join(bad), ", ".join(ORDER)))
    return {n: base_port + ORDER.index(n) for n in ORDER if n in names}


def banner(server):
    lines = ["軟儀器已啟動。結束：輸入 q 再按 Enter，或按 Ctrl+C。", ""]
    for name, inst in server.instruments.items():
        lines.append("  %-4s %s" % (name, inst.title))
        lines.append("       VISA 資源名稱：%s" % server.resource(name))
        lines.append("       %s" % inst.summary)
    lines += ["",
              "這裡走的是 TCP，沒有鮑率，也沒有同位。",
              "練的是：命令、結尾字元、回覆格式、逾時、錯誤處理。",
              "鮑率與同位設錯會怎樣，請到網頁的「儀器練習台」（labview/instlab.html）練。",
              "",
              "下面會印出每條連線收到與送出的位元組（\\r \\n 會畫出來）。",
              "鍵盤（打一個字母再按 Enter）：" + SoftInstrumentServer.KEYS_HELP,
              ""]
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description="軟儀器：用 TCP 模擬四台儀器，給 LabVIEW 的 VISA（SOCKET 資源）練習。")
    ap.add_argument("--host", default=DEFAULT_HOST, help="要聽哪個位址（預設 127.0.0.1，只有這台電腦連得到）")
    ap.add_argument("--base-port", type=int, default=DEFAULT_BASE_PORT,
                    help="第一台的埠號（預設 5561）；四台依序是 gpd、dmm、bal、dtb")
    ap.add_argument("--only", default="", help="只開其中幾台，用逗號分開，例如 gpd,dmm")
    args = ap.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except (AttributeError, ValueError):
            pass
    try:
        ports = plan_ports(args.base_port, args.only)
    except ValueError as e:
        print(e, file=sys.stderr)
        return 2
    server = SoftInstrumentServer(args.host, ports)
    try:
        server.start()
    except OSError as e:
        print("開不了埠（%s）。可能已經有一份軟儀器在跑，或埠號被別的程式佔用：換一個 --base-port 試試。" % e, file=sys.stderr)
        return 1
    print(banner(server), flush=True)
    try:
        for line in sys.stdin:
            ch = line.strip().lower()[:1]
            if ch == "q":
                break
            msg = server.key(ch)
            if msg:
                server.log(msg)
            elif ch:
                server.log("不認得「%s」。%s" % (ch, SoftInstrumentServer.KEYS_HELP))
        else:
            while True:                                    # 沒有鍵盤可讀（例如在背景執行）：一直跑到被關掉
                time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        server.stop()
        print("軟儀器已結束。", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
