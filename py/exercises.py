# -*- coding: utf-8 -*-
"""Practice exercises: the learner writes the instruction list, the grader runs it on the soft PLC.

Each exercise:
  id, title, lesson (the lesson it follows), free (True = free tier)
  task      what to build, in plain words
  inputs    (device, label, kind)  kind: hold = push button, toggle = switch, sensor = driven by the machine
  outputs   (device, label)
  plant     None or 'cylinder' (Y0 down, Y2 up, X1 down limit, X2 up limit)
  starter   text in the editor at the start
  hints     shown one at a time
  solution  a reference answer (tests prove it passes)
  rules     checked on every scan of every scenario: ('never_both', a, b, why)
  tests     scenarios: (name, [steps]). Steps:
              ('set', dev, 0/1)            change an input
              ('wait', ms)                 run
              ('is', dev, 0/1)             bit must have this value now
              ('d', dev, value)            word must have this value now
              ('stays', dev, 0/1, ms)      run ms, the bit must keep this value on every scan
              ('toggles', dev, ms, lo, hi) run ms, count changes of the bit
              ('stuck', True/False)        the cylinder stops moving (air or valve fault)
"""
import re

from ladder_view import bit, parse_program, word
from plc_csv import ALLOWED, COMPARE_RE, LadderError, check_program, instruction_steps
from plc_engine import PLC

SCAN = 10


# E13 drilling machine: the test drives the sensors the way the machine would.
_DRILL_START = [("set", "X003", 1), ("set", "X005", 1), ("wait", 50), ("set", "X000", 1), ("wait", 50), ("set", "X000", 0),
                ("wait", 50), ("set", "X001", 1), ("wait", 50)]
_ONE_PAIR = [("set", "X003", 0), ("set", "X005", 0), ("set", "X002", 1), ("set", "X004", 1), ("wait", 50),
             ("set", "X002", 0), ("set", "X004", 0), ("set", "X003", 1), ("set", "X005", 1), ("wait", 50),
             ("is", "Y005", 1), ("set", "X006", 1), ("wait", 50), ("set", "X006", 0), ("wait", 50)]

# Taiwan pneumatics level B (氣壓乙級) question 08000-1090201 "PLC-氣壓控制－變速迴路": the PLC part.
# Inputs and outputs follow a fixed practice layout (at the test the examiner assigns two terminals).
_E18_START = [("set", "X002", 1), ("set", "X003", 1), ("set", "X006", 1), ("wait", 100)]
_E18_ST = [("set", "X000", 1), ("wait", 60), ("set", "X000", 0), ("wait", 60)]
_E18_EMS_RESET = [("set", "X002", 1), ("set", "X003", 1), ("set", "X006", 1), ("wait", 100), ("set", "X000", 1), ("wait", 60), ("set", "X000", 0),
                  ("wait", 2300), ("set", "X002", 0), ("wait", 1500), ("set", "X002", 1), ("set", "X003", 0), ("wait", 100),
                  ("set", "X004", 1), ("wait", 60), ("set", "X004", 0)]
_E18_SEQ = ["Y000", "Y002", "Y001", "Y004", "Y003", "Y000", "Y011", "Y001+Y005"]
_E18_DEV = ["Y000", "Y001", "Y002", "Y003", "Y004", "Y005", "Y011"]
_E18_IL = """; ---- 上電：在原點就視為已復歸
LD M8002
SET S0
LD M8002
AND X010
AND X013
AND X015
SET M10
; ---- 指令脈衝
LD X000
PLS M1
LD X004
PLS M2
LD X001
SET M23
; ---- 急停（X7 常閉，OFF＝按下）：步序清除、輸出全斷、要重新復歸
LDI X002
ZRST S20 S27
LDI X002
ZRST S40 S41
LDI X002
RST M10
LDI X002
RST M30
LDI X002
SET S0
; ---- 手動步進：每按一次 ST 給一次執行許可
LD M1
AND M20
AND M30
SET M40
LD M40
OR M21
OR M22
OUT M41
; ---- 待機
STL S0
LD M1
AND X003
AND M10
AND X002
OUT M3
LD M3
AND X005
SET M20
LD M3
AND X006
SET M21
LD M3
AND X007
SET M22
LD M3
LD X005
OR X006
OR X007
ANB
SET M30
RST M23
SET M40
SET S20
LD M2
ANI X003
AND X002
SET S40
; ---- 動作順序
STL S20
LD M41
ANI Y001
OUT Y000
LD X011
SET S21
RST M40
STL S21
LD M41
OUT Y002
LD X014
SET S22
RST M40
STL S22
LD M41
ANI Y000
OUT Y001
LD X010
SET S23
RST M40
STL S23
LD M41
OUT Y004
LD X016
SET S24
RST M40
STL S24
LD M41
OUT Y003
LD X013
SET S25
RST M40
STL S25
LD M41
ANI Y001
OUT Y000
LD X011
SET S26
RST M40
STL S26
LD M41
OUT Y000
OUT Y011
LD X012
SET S27
RST M40
STL S27
LD M41
ANI Y000
OUT Y001
OUT Y005
LD X010
AND X015
AND M22
ANI M23
OUT S20
LD X010
AND X015
LDI M22
OR M23
ANB
SET S0
RST M30
ZRST M20 M22
RST M23
; ---- 復歸：B、C 先回原點，再 A
STL S40
OUT Y003
OUT Y005
LD X013
AND X015
SET S41
STL S41
OUT Y001
LD X010
SET M10
SET S0
RET
; ---- 燈號
LD M10
ANI M30
AND X002
OUT Y006
LD M30
AND X002
OUT Y007
LD S40
OR S41
AND M8013
OUT Y010
"""

# 08000-1090202 "PLC-氣壓控制－釋壓迴路": same sequence without the speed change; after a power failure the machine
# resumes (latched steps), and the emergency stop exhausts B and C.
_E19_IL = """; ---- 練習用 CPU：FX3U 等級（考場要求 24 入 16 出），停電保持：S500～S899、M500～M1023
; M510 已復歸、M530 運轉中、M520～M522 模式、M523 停止請求（都停電保持）
LD M8002
ANI M530
ANI S540
ANI S541
SET S0
LD M8002
AND X010
AND X013
AND X015
ANI M530
ANI S540
ANI S541
SET M510
; 停電恢復：運轉中→等啟動（紅燈閃）；復歸中→等復歸鈕（黃燈閃）
LD M8002
AND M530
SET M600
LD M8002
LD S540
OR S541
ANB
SET M601
LD X000
PLS M1
LD X004
PLS M2
LD X001
SET M523
LD M1
AND M600
RST M600
LD M2
AND M601
RST M601
; ---- 急停
LDI X002
ZRST S500 S507
LDI X002
ZRST S540 S541
LDI X002
RST M510
LDI X002
RST M530
LDI X002
RST M600
LDI X002
RST M601
LDI X002
SET S0
; ---- 執行許可
LD M1
AND M520
AND M530
SET M540
LD M540
OR M521
OR M522
ANI M600
OUT M41
STL S0
LD M1
AND X003
AND M510
AND X002
ANI M600
OUT M3
LD M3
AND X005
SET M520
LD M3
AND X006
SET M521
LD M3
AND X007
SET M522
LD M3
LD X005
OR X006
OR X007
ANB
SET M530
RST M523
SET M540
SET S500
LD M2
ANI X003
AND X002
SET S540
STL S500
LD M41
ANI Y001
OUT Y000
LD X011
SET S501
RST M540
STL S501
LD M41
OUT Y002
LD X014
SET S502
RST M540
STL S502
LD M41
ANI Y000
OUT Y001
LD X010
SET S503
RST M540
STL S503
LD M41
OUT Y004
LD X016
SET S504
RST M540
STL S504
LD M41
OUT Y003
LD X013
SET S505
RST M540
STL S505
LD M41
ANI Y001
OUT Y000
LD X012
SET S506
RST M540
STL S506
LD M41
ANI Y000
OUT Y001
OUT Y005
LD X010
AND X015
AND M522
ANI M523
OUT S500
LD X010
AND X015
LDI M522
OR M523
ANB
SET S0
RST M530
ZRST M520 M522
RST M523
STL S540
ANI M601
OUT Y003
OUT Y005
LD X013
AND X015
SET S541
STL S541
ANI M601
OUT Y001
LD X010
SET M510
SET S0
RET
; ---- 燈號
LD M510
ANI M530
AND X002
OUT Y006
LD M530
AND X002
ANI M600
LD M600
AND M8013
ORB
OUT Y007
LD S540
OR S541
AND M8013
OUT Y010
"""
_E19_START = [("set", "X002", 1), ("set", "X003", 1), ("set", "X006", 1), ("wait", 100)]
_E19_ST = [("set", "X000", 1), ("wait", 60), ("set", "X000", 0), ("wait", 60)]
_E19_RST = [("set", "X004", 1), ("wait", 60), ("set", "X004", 0), ("wait", 60)]
_E19_SEQ = ["Y000", "Y002", "Y001", "Y004", "Y003", "Y000", "Y001+Y005"]
_E19_DEV = ["Y000", "Y001", "Y002", "Y003", "Y004", "Y005"]

# 08000-1090203 "PLC-氣壓控制－平衡迴路": C is the load cylinder (three positions, origin c2 = extended).
_E20_IL = """; ---- 動作在步裡只寫 M（M60～M65），最後一個地方決定 Y（輸出仲裁）
LD M8002
SET S0
LD M8002
AND X010
AND X012
AND X016
SET M10
LD X000
PLS M1
LD X004
PLS M2
LD X001
SET M23
; ---- 急停：在第 3 步（C 往 c1、還沒到）要退回 c2；其他步 C 就地停
LDI X002
AND S22
ANI X015
SET M50
LDI X002
ZRST S20 S28
LDI X002
ZRST S40 S42
LDI X002
RST M10
LDI X002
RST M30
LDI X002
SET S0
LD M1
AND M20
AND M30
SET M40
LD M40
OR M21
OR M22
OUT M41
STL S0
LD M1
AND X003
AND M10
AND X002
OUT M3
LD M3
AND X005
SET M20
LD M3
AND X006
SET M21
LD M3
AND X007
SET M22
LD M3
LD X005
OR X006
OR X007
ANB
SET M30
RST M23
SET M40
SET S20
LD M2
ANI X003
AND X002
SET S40
STL S20
LD M41
ANI Y001
OUT M60
LD X011
SET S21
RST M40
STL S21
LD M41
OUT M62
LD X013
SET S22
RST M40
STL S22
LD M41
OUT M65
LD X015
SET S23
RST M40
STL S23
LD M41
OUT M61
LD X010
SET S24
RST M40
STL S24
LD M41
OUT M65
LD X014
SET S25
RST M40
STL S25
LD M41
OUT M60
LD X011
SET S26
RST M40
STL S26
LD M41
OUT M63
LD X012
SET S27
RST M40
STL S27
LD M41
OUT M64
LD X016
SET S28
RST M40
STL S28
LD M41
OUT M61
LD X010
AND M22
ANI M23
OUT S20
LD X010
LDI M22
OR M23
ANB
SET S0
RST M30
ZRST M20 M22
RST M23
; ---- 復歸：C 回 c2 → B 回 b0 → A 回 a0
STL S40
OUT M64
LD X016
SET S41
STL S41
OUT M63
LD X012
SET S42
STL S42
OUT M61
LD X010
SET M10
SET S0
RET
; ---- 急停中把 C 拉回 c2
LD M50
AND X016
RST M50
; ---- 輸出仲裁（唯一寫 Y 的地方）
LD M60
ANI M61
OUT Y000
LD M61
ANI M60
OUT Y001
LD M62
ANI M63
OUT Y002
LD M63
ANI M62
OUT Y003
LD M64
OR M50
ANI M65
OUT Y004
LD M65
ANI M64
ANI M50
OUT Y005
LD M10
ANI M30
AND X002
OUT Y006
LD M30
AND X002
OUT Y007
LD S40
OR S41
OR S42
AND M8013
OUT Y010
"""
_E20_ST = [("set", "X000", 1), ("wait", 60), ("set", "X000", 0), ("wait", 60)]
_E20_START = [("set", "X002", 1), ("set", "X003", 1), ("set", "X006", 1), ("wait", 100)]
_E20_SEQ = ["Y000", "Y002", "Y005", "Y001", "Y005", "Y000", "Y003", "Y004", "Y001"]
_E20_DEV = ["Y000", "Y001", "Y002", "Y003", "Y004", "Y005"]
_E20_EMS_RESET = _E20_START + _E20_ST + [("wait", 4500), ("set", "X002", 0), ("wait", 1500), ("set", "X002", 1), ("set", "X003", 0),
                                         ("wait", 100), ("set", "X004", 1), ("wait", 60), ("set", "X004", 0)]

# 08000-1090204 "PLC-氣壓控制－鎖固迴路": emergency stop pauses (steps 1-6, resume with ST) or needs a reset (steps 7-10).
_E21_IL = """LD M8002
SET S0
LD M8002
AND X010
AND X012
AND X016
SET M10
LD X000
PLS M1
LD X004
PLS M2
LD X001
SET M23
; ---- 急停的那一刻：第 7～10 步（S26～S28）要復歸；其他步暫停，之後按 ST 接著做
LDI X002
PLS M4
LD M4
LD S26
OR S27
OR S28
ANB
OUT M5
LD M5
ZRST S20 S28
LD M5
RST M10
LD M5
RST M30
LD M5
SET S0
LD M4
ANI M5
AND M30
SET M70
LD M1
AND M70
AND X002
RST M70
LD M1
AND M20
AND M30
ANI M70
SET M40
LD M40
OR M21
OR M22
AND X002
ANI M70
OUT M41
STL S0
LD M1
AND X003
AND M10
AND X002
OUT M3
LD M3
AND X005
SET M20
LD M3
AND X006
SET M21
LD M3
AND X007
SET M22
LD M3
LD X005
OR X006
OR X007
ANB
SET M30
RST M23
SET M40
SET S20
LD M2
ANI X003
AND X002
SET S40
STL S20
LD M41
OUT Y000
LD X011
SET S21
RST M40
STL S21
LD M41
ANI Y000
OUT Y001
LD X010
SET S22
RST M40
STL S22
LD M41
OUT Y005
LD X015
SET S23
RST M40
STL S23
LD M41
OUT Y000
LD X011
SET S24
RST M40
STL S24
LD M41
ANI Y000
OUT Y001
LD X010
SET S25
RST M40
STL S25
LD M41
OUT Y005
LD X014
SET S26
RST M40
STL S26
LD M41
OUT Y002
LD X013
SET S27
RST M40
STL S27
LD M41
ANI Y002
OUT Y003
LD X012
SET S28
RST M40
STL S28
LD M41
OUT Y004
LD X016
AND M22
ANI M23
OUT S20
LD X016
LDI M22
OR M23
ANB
SET S0
RST M30
ZRST M20 M22
RST M23
; ---- 復歸：B 回 b0 → C 回 c2
STL S40
OUT Y003
LD X012
SET S41
STL S41
OUT Y004
LD X016
SET M10
SET S0
RET
LD M10
ANI M30
AND X002
OUT Y006
LD M30
AND X002
OUT Y007
LD S40
OR S41
AND M8013
OUT Y010
"""
_E21_ST = [("set", "X000", 1), ("wait", 60), ("set", "X000", 0), ("wait", 60)]
_E21_RST = [("set", "X004", 1), ("wait", 60), ("set", "X004", 0), ("wait", 60)]
_E21_START = [("set", "X002", 1), ("set", "X003", 1), ("set", "X006", 1), ("wait", 100)]
_E21_SEQ = ["Y000", "Y001", "Y005", "Y000", "Y001", "Y005", "Y002", "Y003", "Y004"]
_E21_DEV = ["Y000", "Y001", "Y002", "Y003", "Y004", "Y005"]

_E29_D = lambda n: [("set", "X000", n & 1), ("set", "X001", n >> 1 & 1), ("set", "X002", n >> 2 & 1), ("set", "X003", n >> 3 & 1), ("wait", 100)]
_E29_P = lambda k: [s for _ in range(k) for s in (("set", "X004", 1), ("wait", 60), ("set", "X004", 0), ("wait", 60))]
_E29_R = [("set", "X005", 1), ("wait", 60), ("set", "X005", 0), ("wait", 60)]
_E29_SHOW = lambda n: [("is", "Y%03o" % i, (int(str(n), 16) >> i) & 1) for i in range(8)]   # n boxes as two BCD digits on Y0..Y7

_E22_IL = """; 工業配線乙級 01300-10802105 第五題 自動門開閉控制（PLC 部分）
; ---- 開機時積熱電驛還沒復歸：BZ 斷續響、燈全熄、不能操作
LD M8002
ANI X007
SET M0
LD M0
AND X007
RST M0
; ---- 運轉中積熱電驛跳脫＝過載警報 M6
LD Y000
OR Y001
ANI X007
SET M6
LD X002
AND M6
SET M7
LD M6
ANI X004
AND X007
RST M6
RST M7
; ---- 光電開關：關門中有人 → 安全開門 M5，全開且人離開才解除
LD X006
AND M2
SET M5
LD M5
ANI X004
ANI X006
RST M5
; ---- 可以操作：沒有開機故障、沒有過載、沒有安全開門
LDI M0
ANI M6
ANI M5
OUT M10
; ---- 過載或光電：關門中立即改成開門（不等 2 秒）
LD M6
OR M5
AND X004
MPS
AND M2
RST M2
RST M3
MPP
SET M1
; ---- PB1 開門：門不在全開、沒在關、沒在等 2 秒
LDP X000
AND M10
ANI M2
ANI M3
AND X004
ANI M4
SET M1
; ---- 關門中按 PB1：立即停止，2 秒後開門
LDP X000
AND M10
AND M2
RST M2
SET M3
LD M3
OUT T0 K20
LD T0
RST M3
SET M1
; ---- 自動關門：全開、停著 → 預告 10 秒（PL3 閃）
LD X003
ANI X004
AND M10
ANI M1
ANI M2
ANI M3
OUT M4
LD M4
OUT T1 K100
LD T1
SET M2
; ---- PB2 關門（預告中按也立即關門）
LDP X001
AND M10
ANI M1
ANI M3
AND X005
SET M2
; ---- 到位停止
LDI X004
RST M1
LDI X005
RST M2
; ---- 輸出
LD M1
ANI M2
OUT Y000
LD M2
ANI M1
OUT Y001
LD Y000
AND M8013
LDI X004
ANI Y001
ORB
ANI M0
OUT Y002
LD Y001
AND M8013
LDI X005
ANI Y000
ORB
ANI M0
OUT Y003
LD M4
AND M8013
LD X003
ANI M4
ORB
ANI M0
OUT Y004
LD M7
AND M8013
OUT Y005
LD M6
ANI M7
OR M5
LD M0
AND M8013
ORB
OUT Y006
END
"""
_E23_IL = """; 工業配線乙級 01300-10802101 第一題 自動啟閉控制（PLC 部分）
; ---- 運轉中的馬達過載（TH 常閉：OFF＝跳脫；只看正在轉的那台）
LD Y000
ANI X004
OUT M41
LD Y001
ANI X005
OUT M42
LD Y002
ANI X006
OUT M43
LD M41
OR M42
OR M43
SET M40
LD M40
AND S0
AND X004
AND X005
AND X006
RST M40
; ---- 有在動作的步（S0 以外）
LD S20
OR S21
OR S22
OR S30
OR S31
OR S32
OR S33
OUT M55
; ---- 緊急停止：動作中按下就暫停（步序、計時都保留）
LDI X003
AND M55
SET M20
LDP X001
AND X003
ANI X002
ANI M40
OUT M61
LD M61
AND M20
RST M20
LD X003
ANI M20
OUT M21
LDP X000
AND M21
ANI M40
OUT M60
; ---- PL4 閃爍的步
LD M55
ANI S22
AND M21
OUT M51
; ---- 啟動中的 10 秒計時，第一台過載後還要接著算（S33）
LD S21
OR S33
AND M21
OUT T251 K100
; ---- 步進
LD M8002
SET S0
STL S0
RST T250
RST T251
RST T252
RST T253
RST T254
RST T255
LD M61
SET S20
LD M60
SET S30
STL S20
LD M21
OUT T250 K50
LD T250
SET S21
LD M60
SET S30
LD M41
SET S0
STL S21
LD T251
SET S22
LD M60
SET S30
LD M41
SET S33
LD M42
SET S0
STL S22
LD M60
SET S30
LD M41
SET S31
LD M42
SET S32
LD M43
SET S0
STL S30
LD M21
OUT T252 K50
LD T252
OR M41
SET S31
LD M42
SET S32
LD M43
SET S0
STL S31
LD M21
OUT T253 K100
LD T253
OR M42
SET S32
LD M43
SET S0
STL S32
LD M21
OUT T254 K50
LD T254
OR M43
SET S0
STL S33
LD M21
OUT T255 K100
LD T255
SET S32
LD M42
AND T251
SET S32
LD M42
ANI T251
SET S0
LD M43
SET S0
RET
; ---- 輸出
LD S20
OR S21
OR S22
OR S30
AND M21
OUT Y000
LD S21
OR S22
OR S30
OR S31
OR S33
AND M21
OUT Y001
LD S33
AND T251
OR S22
OR S30
OR S31
OR S32
AND M21
OUT Y002
LD S30
AND M8013
OUT M52
LD S31
OR S33
AND M8013
OUT M53
LD S32
AND M8013
OUT M54
LD Y000
ANI M52
OUT Y003
LD Y001
ANI M53
OUT Y004
LD Y002
ANI M54
OUT Y005
LD M51
AND M8013
LDI M51
ORB
OUT Y006
LD M40
AND X003
OUT Y007
LD M40
ANI X002
LDI M40
AND X002
ORB
LDI X003
AND M8013
ORB
OUT Y010
END
"""
_E23_PB1 = [("set", "X000", 1), ("wait", 60), ("set", "X000", 0), ("wait", 60)]
_E23_PB2 = [("set", "X001", 1), ("wait", 60), ("set", "X001", 0), ("wait", 60)]
_E23_ON = [("set", "X003", 1), ("wait", 100)]
_E23_RUN = _E23_ON + _E23_PB2 + [("wait", 15200)]
_E24_IL = """; 工業配線乙級 01300-10802106 第六題 污水池排放控制（PLC 部分）
; ---- COS 0 停機：全部回到初始狀態
LD X006
OR X007
OUT M0
LDI M0
ZRST M100 M139
; ---- 緊急停止、過載（只在運轉中），PB5 在全部復歸後回初始狀態
LDI X005
AND M100
SET M101
LD Y002
ANI X016
LD Y003
ANI X017
ORB
SET M102
LD M101
OR M102
AND X004
AND X005
AND X016
AND X017
ZRST M100 M139
LD M101
OR M102
OUT M150
; ---- PB1 開始運轉（MC1、MC2 電源）
LDP X000
AND M0
AND X005
ANI M150
SET M100
LD M100
ANI M150
OUT M103
; ---- 自動（COS 2）：水位遲滯
LD M103
AND X007
OUT M136
LDI M136
ZRST M130 M134
LD M136
MPS
AND X011
SET M130
MRD
ANI X010
RST M130
MRD
AND X012
SET M131
MRD
ANI X011
RST M131
MRD
AND X015
SET M132
MRD
ANI X014
RST M132
MRD
AND X004
AND X014
SET M133
MRD
ANI X014
RST M133
MRD
AND X013
AND M131
SET M134
MPP
ANI M131
RST M134
; ---- 手動（COS 1）：PB2 污水閥、PB3 M1、PB4 M2 各自交替
LD M103
AND X006
OUT M137
LDP X001
AND M137
OUT M115
LD M115
AND M110
OUT M120
LD M115
ANI M110
ANI X014
SET M110
LD M120
RST M110
LDP X002
AND M137
OUT M116
LD M116
AND M111
OUT M121
LD M116
ANI M111
AND X011
SET M111
LD M121
RST M111
LDP X003
AND M137
OUT M117
LD M117
AND M112
OUT M122
LD M117
ANI M112
AND X012
SET M112
LD M122
RST M112
; ---- 命令合併
LD M136
AND M130
LD M137
AND M111
ORB
OUT M140
LD M136
AND M131
LD M137
AND M112
ORB
OUT M141
LD M136
ANI M132
LD M137
AND M110
ORB
OUT M142
LD M140
OUT T0 K30
; ---- 輸出
LD M103
OUT Y000
OUT Y001
LD M140
OUT Y002
LD M141
OUT Y003
LD M141
AND M136
AND X013
OUT Y004
LD M142
OUT Y005
LD T0
OR M8013
AND M140
OUT Y006
LD M8013
OR M134
OR M137
AND M141
OUT Y007
; ---- 水位訊息碼（PL4＝4、PL5＝2、PL6＝1），異常時三燈同時閃
LD M0
ANI M150
OUT M151
LD M150
AND M8013
OUT M152
LD X013
AND M151
OR M152
OUT Y010
LD X011
ANI X013
OR X015
AND M151
OR M152
OUT Y011
LD X010
ANI X011
LD X012
ANI X013
ORB
LD X014
ANI X015
ORB
AND M151
OR M152
OUT Y012
; ---- 蜂鳴器：自動高水位斷續響（PB5 消音）、過載中一直響
LD M136
AND X014
ANI M133
AND M8013
LDI X016
ORI X017
AND M102
ORB
OUT Y013
END
"""
_E24_PB = lambda dev: [("set", dev, 1), ("wait", 60), ("set", dev, 0), ("wait", 60)]
_E24_LV = lambda n: [("set", "X0%d" % (10 + i), 1 if i < n else 0) for i in range(6)] + [("wait", 100)]
_E24_AUTO = [("set", "X005", 1), ("set", "X007", 1), ("wait", 100)]
_E24_MAN = [("set", "X005", 1), ("set", "X006", 1), ("wait", 100)]
_E25_IL = """; 工業配線乙級 01300-10802102 第二題 兩部抽水機控制（PLC 部分）
; ---- 開機或解除急停時有 TH 沒復歸：等全部復歸（M1）
LD M8002
LDI X005
ORI X006
ANB
SET M1
LDP X004
LDI X005
ORI X006
ANB
SET M1
LD X005
AND X006
RST M1
; ---- 馬達沒在轉，它的 TH 卻動作：全部 OFF，重新上電才恢復（M0）
LDF X005
ANI Y000
LDF X006
ANI Y001
ORB
AND X004
ANI M1
SET M0
; ---- 緊急停止：回到初始狀態
LDI X004
ZRST M10 M39
; ---- 運轉中過載
LD Y000
ANI X005
SET M10
LD Y001
ANI X006
SET M11
LD Y000
ANI X005
LD Y001
ANI X006
ORB
SET M31
LD M31
OUT T0 K100
LD T0
RST M31
LD X005
RST M10
LD X006
RST M11
LD M10
AND M11
SET M32
LD X005
AND X006
RST M32
LD X000
AND M32
SET M33
LDI M32
RST M33
; ---- 可以操作
LD X004
ANI M0
ANI M1
ANI M32
OUT M5
; ---- 抽水需求：自動看水塔浮球，手動每按一次 PB2 交替
LDP X001
ANI X002
ANI X003
AND M5
ALT M21
LD X002
AND X007
LDI X002
ANI X003
AND M21
ORB
OUT M20
; ---- 記住實際最後運轉的是哪一台（M24 ON＝#1），需求結束時決定下一次輪誰（M22 ON＝#2）
LD Y000
AND M20
SET M24
LD Y001
AND M20
RST M24
LDF M20
AND X004
MPS
AND M24
SET M22
MPP
ANI M24
RST M22
; ---- 這次輪到哪一台，輪到的那台過載就換另一台
LDI M22
AND X005
LD M22
ANI X006
AND X005
ORB
OUT M40
LD M22
AND X006
LDI M22
ANI X005
AND X006
ORB
OUT M41
; ---- 輸出
LD M20
AND M40
LD X003
AND X007
AND X005
ORB
AND M5
AND X010
OUT Y000
LD M20
AND M41
LD X003
AND X007
AND X006
ORB
AND M5
AND X010
OUT Y001
LD Y000
OUT Y002
LD Y001
OUT Y003
LD M10
ANI M1
LD M1
ANI X005
AND M8013
ORB
ANI M0
OUT Y004
LD M11
ANI M1
LD M1
ANI X006
AND M8013
ORB
ANI M0
OUT Y005
LDI X010
ANI M0
OUT Y006
LD X007
ANI M0
OUT Y007
LD M31
ANI M32
LD M32
ANI M33
ORB
AND M8013
ANI M1
ANI M0
OUT Y010
LDI X004
ANI M0
OUT Y011
END
"""
_E25_ON = [("set", "X004", 1), ("set", "X010", 1), ("set", "X002", 1), ("wait", 100)]
_E25_LOW = [("set", "X007", 1), ("wait", 100)]
_E25_FULL = [("set", "X007", 0), ("wait", 100)]
_E25_PB = lambda dev: [("set", dev, 1), ("wait", 60), ("set", dev, 0), ("wait", 60)]
_E22_PB1 = [("set", "X000", 1), ("wait", 60), ("set", "X000", 0), ("wait", 60)]
_E22_PB2 = [("set", "X001", 1), ("wait", 60), ("set", "X001", 0), ("wait", 60)]
_E22_PB3 = [("set", "X002", 1), ("wait", 60), ("set", "X002", 0), ("wait", 60)]
_E22_ON = [("set", "X007", 1), ("wait", 100)]
_E22_AUTO = [("set", "X007", 1), ("set", "X003", 1), ("wait", 100)]
_E22_OPEN = _E22_ON + _E22_PB1 + [("wait", 3300)]


_E26_GO = [("set", "X000", 1), ("wait", 100), ("set", "X000", 0), ("wait", 100)]
_E27_IN = [("set", "X000", 1), ("wait", 150), ("set", "X000", 0), ("wait", 150)]
_E27_OUT = [("set", "X001", 1), ("wait", 150), ("set", "X001", 0), ("wait", 150)]

EXERCISES = [
    {"id": "E1", "lesson": "1", "free": True, "title": "按鈕點燈",
     "task": "按住按鈕 X0 時，燈 Y0 亮；放開就熄。",
     "inputs": [("X000", "按鈕", "hold")], "outputs": [("Y000", "燈")],
     "starter": "; 每行一個指令，例如：\n; LD X000\n; OUT Y000\n",
     "hints": ["LD 是「從左邊的母線接一個常開接點」。", "OUT 是「把結果送到線圈」。兩行就完成了。"],
     "solution": "LD X000\nOUT Y000",
     "tests": [("按下按鈕，燈要亮", [("set", "X000", 1), ("wait", 50), ("is", "Y000", 1)]),
               ("放開按鈕，燈要熄", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 50), ("is", "Y000", 0)])]},

    {"id": "E2", "lesson": "2", "free": True, "title": "而且與或",
     "task": "Y0：X0 而且 X1 都按住才亮。\nY1：X0 或 X1 任一個按住就亮。",
     "inputs": [("X000", "按鈕 A", "hold"), ("X001", "按鈕 B", "hold")],
     "outputs": [("Y000", "兩個都按"), ("Y001", "任一個按")],
     "starter": "", "hints": ["串聯用 AND，並聯用 OR。", "Y0：LD X000、AND X001、OUT Y000。Y1 換成 OR。"],
     "solution": "LD X000\nAND X001\nOUT Y000\nLD X000\nOR X001\nOUT Y001",
     "tests": [("都沒按：兩個燈都熄", [("wait", 50), ("is", "Y000", 0), ("is", "Y001", 0)]),
               ("只按 A：只有 Y1 亮", [("set", "X000", 1), ("wait", 50), ("is", "Y000", 0), ("is", "Y001", 1)]),
               ("只按 B：只有 Y1 亮", [("set", "X001", 1), ("wait", 50), ("is", "Y000", 0), ("is", "Y001", 1)]),
               ("兩個都按：兩個燈都亮", [("set", "X000", 1), ("set", "X001", 1), ("wait", 50), ("is", "Y000", 1), ("is", "Y001", 1)])]},

    {"id": "E3", "lesson": "4", "free": True, "title": "馬達啟動與停止（自保持）",
     "task": "按一下啟動 X0，馬達 Y0 開始轉，放開按鈕也要繼續轉。\n按一下停止 X1，馬達停。兩個一起按時，停止優先（安全）。",
     "inputs": [("X000", "啟動按鈕", "hold"), ("X001", "停止按鈕（常開；實機停止鈕通常接常閉，見 5.1 課）", "hold")], "outputs": [("Y000", "馬達")],
     "starter": "", "hints": ["Y0 要「記住自己」：把 Y000 並聯在啟動按鈕旁邊（OR Y000）。",
                              "停止要串在最後面，用常閉接點 ANI X001，這樣按停止一定斷電。"],
     "solution": "LD X000\nOR Y000\nANI X001\nOUT Y000",
     "tests": [("按啟動再放開：馬達持續轉", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("stays", "Y000", 1, 1000)]),
               ("按停止：馬達停，放開後也不會自己再轉", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 100),
                                          ("set", "X001", 1), ("wait", 50), ("is", "Y000", 0), ("set", "X001", 0), ("stays", "Y000", 0, 500)]),
               ("啟動和停止一起按：停止優先", [("set", "X000", 1), ("set", "X001", 1), ("stays", "Y000", 0, 300)]),
               ("開機時馬達不能自己轉", [("stays", "Y000", 0, 300)])]},

    {"id": "E4", "lesson": "9", "free": True, "title": "馬達正反轉互鎖",
     "task": "X0 正轉、X1 反轉、X2 停止，都是按一下的按鈕。\n正轉 Y0、反轉 Y1 都要自保持。\n轉動中按相反方向不能切換，要先按停止。Y0 和 Y1 任何時候都不能同時 ON，否則相間短路（兩相電源直接接在一起）。",
     "inputs": [("X000", "正轉按鈕", "hold"), ("X001", "反轉按鈕", "hold"), ("X002", "停止按鈕", "hold")],
     "outputs": [("Y000", "正轉接觸器"), ("Y001", "反轉接觸器")],
     "rules": [("never_both", "Y000", "Y001", "正轉和反轉同時 ON，實機會相間短路")],
     "starter": "", "hints": ["先各寫一個自保持，跟 E3 一樣。", "正轉那條加上 ANI Y001，反轉那條加上 ANI Y000：對方在轉，自己就進不來。",
                              "兩個按鈕同時按也不能兩個都 ON：在「啟動」那一段（OR Y000 之前）加 ANI 對方的按鈕。注意不要加在自保持後面，否則轉動中按反轉會把正轉打斷。"],
     "solution": "LD X000\nANI X001\nOR Y000\nANI X002\nANI Y001\nOUT Y000\nLD X001\nANI X000\nOR Y001\nANI X002\nANI Y000\nOUT Y001",
     "tests": [("按正轉：Y0 轉並保持", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("stays", "Y000", 1, 300)]),
               ("正轉中按反轉：不切換", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 100),
                                 ("set", "X001", 1), ("wait", 100), ("set", "X001", 0), ("is", "Y001", 0), ("stays", "Y000", 1, 200)]),
               ("先停止再反轉：Y1 轉", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("set", "X002", 1), ("wait", 50),
                                 ("set", "X002", 0), ("set", "X001", 1), ("wait", 50), ("set", "X001", 0), ("stays", "Y001", 1, 300), ("is", "Y000", 0)]),
               ("正反轉一起按：都不能同時 ON", [("set", "X000", 1), ("set", "X001", 1), ("wait", 300), ("set", "X000", 0), ("set", "X001", 0), ("wait", 300)])]},

    {"id": "E5", "lesson": "A2", "free": False, "title": "延時啟動",
     "task": "開關 X0 打開後 3 秒，Y0 才亮（例如：送風機先轉 3 秒，再點火）。\nX0 關掉時 Y0 立刻熄，下次打開重新計時。",
     "inputs": [("X000", "開關", "toggle")], "outputs": [("Y000", "延時輸出")],
     "starter": "", "hints": ["計時器 T0 的單位是 0.1 秒，3 秒是 K30：OUT T0 K30。", "T0 計時到，T0 的接點才會閉合：LD T0、OUT Y000。"],
     "solution": "LD X000\nOUT T0 K30\nLD T0\nOUT Y000",
     "tests": [("打開 2.8 秒時還不能亮", [("set", "X000", 1), ("stays", "Y000", 0, 2800)]),
               ("打開 3.1 秒時要亮", [("set", "X000", 1), ("wait", 3100), ("is", "Y000", 1)]),
               ("關掉立刻熄，再打開要重新數 3 秒", [("set", "X000", 1), ("wait", 3100), ("set", "X000", 0), ("wait", 50), ("is", "Y000", 0),
                                       ("set", "X000", 1), ("stays", "Y000", 0, 2800), ("wait", 300), ("is", "Y000", 1)])]},

    {"id": "E6", "lesson": "A2", "free": False, "title": "警示燈閃爍",
     "task": "開關 X0 打開時，警示燈 Y0 亮 0.5 秒、熄 0.5 秒，一直重複。X0 關掉時燈熄。\n不要用 M8013，自己用計時器做。",
     "inputs": [("X000", "開關", "toggle")], "outputs": [("Y000", "警示燈")],
     "starter": "", "hints": ["用兩個計時器互相重置：T0 數「熄」的時間，T1 數「亮」的時間。",
                              "LD X000、ANI T1、OUT T0 K5；LD T0、OUT T1 K5。T0 到了就亮，T1 到了把 T0 斷掉，重新一輪。",
                              "燈：LD T0、OUT Y000。"],
     "solution": "LD X000\nANI T1\nOUT T0 K5\nLD T0\nOUT T1 K5\nLD T0\nOUT Y000",
     "forbid": ["M8013", "M8012"],
     "tests": [("打開 4 秒：燈要閃 7～9 次狀態變化", [("set", "X000", 1), ("toggles", "Y000", 4000, 7, 9)]),
               ("關掉後燈熄", [("set", "X000", 1), ("wait", 1700), ("set", "X000", 0), ("wait", 50), ("stays", "Y000", 0, 1000)])]},

    {"id": "E7", "lesson": "A3", "free": False, "title": "包裝計數",
     "task": "輸送帶上的感測器 X0 每看到一個工件就 ON 一下。數到 5 個時，裝箱完成燈 Y0 亮。\n按重置 X1：計數歸零、燈熄，重新數。",
     "inputs": [("X000", "工件感測器", "hold"), ("X001", "重置按鈕", "hold")], "outputs": [("Y000", "裝箱完成燈")],
     "starter": "", "hints": ["計數器：LD X000、OUT C0 K5。計數器只在 X0 由 OFF 變 ON 時加 1。", "C0 到 5，C0 的接點閉合：LD C0、OUT Y000。",
                              "重置：LD X001、RST C0。"],
     "solution": "LD X000\nOUT C0 K5\nLD C0\nOUT Y000\nLD X001\nRST C0",
     "tests": [("4 個工件：燈還不亮", [*[s for _ in range(4) for s in (("set", "X000", 1), ("wait", 100), ("set", "X000", 0), ("wait", 100))],
                                 ("is", "Y000", 0)]),
               ("第 5 個工件：燈亮", [*[s for _ in range(5) for s in (("set", "X000", 1), ("wait", 100), ("set", "X000", 0), ("wait", 100))],
                                ("is", "Y000", 1)]),
               ("一個工件停在感測器前很久，只能算 1 個", [("set", "X000", 1), ("wait", 2000), ("set", "X000", 0), ("wait", 100),
                                            *[s for _ in range(3) for s in (("set", "X000", 1), ("wait", 100), ("set", "X000", 0), ("wait", 100))],
                                            ("is", "Y000", 0)]),
               ("重置後重新數", [*[s for _ in range(5) for s in (("set", "X000", 1), ("wait", 100), ("set", "X000", 0), ("wait", 100))],
                           ("set", "X001", 1), ("wait", 50), ("set", "X001", 0), ("wait", 50), ("is", "Y000", 0),
                           *[s for _ in range(5) for s in (("set", "X000", 1), ("wait", 100), ("set", "X000", 0), ("wait", 100))],
                           ("is", "Y000", 1)])]},

    {"id": "E8", "lesson": "A4", "free": False, "title": "按一次只加一次",
     "task": "每按一次 X0，D0 加 1。按住不放也只能加 1。\n（實機上 X0 一直 ON 時，每一個掃描都會執行一次，INC 會一直加。）",
     "inputs": [("X000", "按鈕", "hold")], "outputs": [],
     "starter": "", "hints": ["先把按鈕變成「只有一個掃描」的脈衝：LD X000、PLS M0。", "再用脈衝去加：LD M0、INC D0。"],
     "solution": "LD X000\nPLS M0\nLD M0\nINC D0",
     "tests": [("按住 1 秒：D0 只能是 1", [("set", "X000", 1), ("wait", 1000), ("d", "D0", 1)]),
               ("按三次：D0 是 3", [*[s for _ in range(3) for s in (("set", "X000", 1), ("wait", 200), ("set", "X000", 0), ("wait", 200))],
                              ("d", "D0", 3)])]},

    {"id": "E9", "lesson": "9", "free": False, "title": "雙手啟動按鈕（安全）",
     "task": "沖床要用雙手按鈕：X0、X1 兩個按鈕要在 0.5 秒內一起按下，Y0 才動作。\n任一手放開，Y0 立刻停。\n如果先按一個、超過 0.5 秒才按另一個，不能動作；要兩手都放開再重按。這是防止用膠帶黏住一個按鈕的設計。",
     "inputs": [("X000", "左手按鈕", "hold"), ("X001", "右手按鈕", "hold")], "outputs": [("Y000", "沖壓動作")],
     "starter": "", "hints": ["任一個按鈕按著就開始計時：LD X000、OR X001、OUT T0 K5。兩手都放開，T0 才會歸零。",
                              "能啟動的條件：兩個都按、而且 T0 還沒到（ANI T0）。",
                              "啟動後要保持到放手：(兩個都按 且 T0 沒到) 或 Y0，再串上兩個按鈕都按著。",
                              "動作過一次，要兩手都放開才能再來：LD Y000、SET M0；LDI X000、ANI X001、RST M0；啟動條件加 ANI M0。"],
     "solution": "LD X000\nOR X001\nOUT T0 K5\nLD X000\nAND X001\nANI T0\nANI M0\nOR Y000\nAND X000\nAND X001\nOUT Y000\n"
                 "LD Y000\nSET M0\nLDI X000\nANI X001\nRST M0",
     "tests": [("0.2 秒內一起按：動作", [("set", "X000", 1), ("wait", 200), ("set", "X001", 1), ("wait", 50), ("is", "Y000", 1)]),
               ("動作中放開一手：立刻停，再按回去也不能動", [("set", "X000", 1), ("set", "X001", 1), ("wait", 100), ("set", "X001", 0), ("wait", 30),
                                              ("is", "Y000", 0), ("set", "X001", 1), ("stays", "Y000", 0, 500)]),
               ("先按一個，0.7 秒後才按另一個：不能動作", [("set", "X000", 1), ("wait", 700), ("set", "X001", 1), ("stays", "Y000", 0, 500)]),
               ("兩手放開後重按：可以動作", [("set", "X000", 1), ("wait", 700), ("set", "X001", 1), ("wait", 100), ("set", "X000", 0), ("set", "X001", 0),
                                    ("wait", 100), ("set", "X000", 1), ("set", "X001", 1), ("wait", 50), ("is", "Y000", 1)])]},

    {"id": "E10", "lesson": "6", "free": False, "title": "氣缸取料一循環（步進）",
     "task": "用步進（STL）寫一次取料：\n按啟動 X0 → 氣缸下降 Y0，直到下限 X1 → 吸盤 Y1 吸住，等 1 秒 → 氣缸上升 Y2，直到上限 X2 → 回到待機。\n吸盤在上升時要保持吸住，回到待機時放開。下降 Y0 和上升 Y2 不能同時 ON。",
     "plant": "cylinder",
     "inputs": [("X000", "啟動按鈕", "hold"), ("X001", "下限感測器", "sensor"), ("X002", "上限感測器", "sensor")],
     "outputs": [("Y000", "下降"), ("Y001", "吸盤"), ("Y002", "上升")],
     "rules": [("never_both", "Y000", "Y002", "下降和上升同時輸出，雙線圈電磁閥會打架")],
     "starter": "LD M8002\nSET S0\nSTL S0\n; 在這裡寫：按 X0 換到 S20\n\nRET\n",
     "hints": ["四步：S0 待機、S20 下降、S21 吸住等 1 秒、S22 上升。", "S20 裡：OUT Y000，LD X001、SET S21。",
               "S21 裡：SET Y001、OUT T0 K10，LD T0、SET S22。吸盤用 SET，離開這一步也不會放開。",
               "S22 裡：OUT Y002，LD X002、RST Y001、SET S0。"],
     "solution": "LD M8002\nSET S0\nSTL S0\nLD X000\nSET S20\nSTL S20\nOUT Y000\nLD X001\nSET S21\nSTL S21\nSET Y001\nOUT T0 K10\nLD T0\n"
                 "SET S22\nSTL S22\nOUT Y002\nLD X002\nRST Y001\nSET S0\nRET",
     "tests": [("按啟動：開始下降", [("wait", 50), ("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 100), ("is", "Y000", 1), ("is", "Y002", 0)]),
               ("到下限：停止下降，吸盤吸住", [("wait", 50), ("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 2200),
                                     ("is", "Y000", 0), ("is", "Y001", 1), ("is", "Y002", 0)]),
               ("吸 1 秒後上升，上升中保持吸住", [("wait", 50), ("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 3400),
                                       ("is", "Y002", 1), ("is", "Y001", 1)]),
               ("回到上限：回待機，吸盤放開，可以再做一次", [("wait", 50), ("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 6000),
                                             ("is", "Y000", 0), ("is", "Y001", 0), ("is", "Y002", 0),
                                             ("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 100), ("is", "Y000", 1)])]},

    {"id": "E11", "lesson": "A8", "free": False, "title": "下降逾時異常",
     "task": "延續 E10：氣缸可能因為氣壓不足卡住。\n下降超過 3 秒還沒到下限 X1，就要記下異常 M3、停止所有輸出、回到待機。\n異常中按啟動不能動作；按復歸 X3 清除異常後才能再啟動。",
     "plant": "cylinder",
     "inputs": [("X000", "啟動按鈕", "hold"), ("X001", "下限感測器", "sensor"), ("X002", "上限感測器", "sensor"), ("X003", "異常復歸", "hold")],
     "outputs": [("Y000", "下降"), ("Y001", "吸盤"), ("Y002", "上升")],
     "rules": [("never_both", "Y000", "Y002", "下降和上升同時輸出")],
     "starter": "", "hints": ["在 S20 裡加一個鬧鐘：OUT T1 K30。", "LD T1、SET M3：記住異常。",
                              "異常時清掉所有步並回待機：LD M3、ZRST S20 S22，再 RST Y001、SET S0（寫在 RET 之後）。",
                              "S0 的啟動條件加上 ANI M3。復歸：LD X003、RST M3。"],
     "solution": "LD M8002\nSET S0\nSTL S0\nLD X000\nANI M3\nSET S20\nSTL S20\nOUT Y000\nOUT T1 K30\nLD X001\nSET S21\nSTL S21\nSET Y001\n"
                 "OUT T0 K10\nLD T0\nSET S22\nSTL S22\nOUT Y002\nLD X002\nRST Y001\nSET S0\nRET\nLD T1\nSET M3\nLD M3\nZRST S20 S22\n"
                 "LD M3\nRST Y001\nLD M3\nSET S0\nLD X003\nRST M3",
     "tests": [("正常時照常完成一循環", [("wait", 50), ("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 6000),
                                 ("is", "M3", 0), ("is", "Y001", 0), ("is", "Y002", 0)]),
               ("卡住 3 秒：記下異常、輸出全停", [("wait", 50), ("stuck", True), ("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 3300),
                                       ("is", "M3", 1), ("stays", "Y000", 0, 300), ("is", "Y001", 0), ("is", "Y002", 0)]),
               ("異常中按啟動：不能動", [("wait", 50), ("stuck", True), ("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 3300),
                                  ("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("stays", "Y000", 0, 500)]),
               ("排除故障、復歸後可以再啟動", [("wait", 50), ("stuck", True), ("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 3300),
                                     ("stuck", False), ("set", "X003", 1), ("wait", 50), ("set", "X003", 0), ("wait", 50), ("is", "M3", 0),
                                     ("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 100), ("is", "Y000", 1)])]},
    {"id": "E12", "lesson": "6", "free": True, "title": "雙燈交替閃爍（SFC 單流程）",
     "task": "上電後，Y0 亮 1 秒、再換 Y1 亮 1 秒，一直輪流。\n用步進寫：M8002 啟動初始步 S0，S0 直接換到 S20；S20 亮 Y0 並計時 1 秒；S21 亮 Y1 並計時 1 秒，時間到跳回 S20。\n寫好後按「SFC 圖」看看，這就是 GX Works2 裡要畫的 SFC。",
     "inputs": [], "outputs": [("Y000", "燈 1"), ("Y001", "燈 2")],
     "starter": "LD M8002\nSET S0\nSTL S0\n; S0 一進來就換到 S20：LD M8000、SET S20\n\nRET\n",
     "hints": ["S0 裡寫 LD M8000、SET S20。M8000 是 RUN 中常 ON，代表一進 S0 就換到 S20。在 GX Works2 的 SFC 裡，這就是轉移 0 的條件。",
               "S20 裡：OUT Y000、OUT T0 K10，LD T0、SET S21。",
               "S21 裡：OUT Y001、OUT T1 K10，LD T1、OUT S20。跳回前面的步，三菱慣例用 OUT S（SFC 圖上就是 JUMP）。"],
     "solution": "LD M8002\nSET S0\nSTL S0\nLD M8000\nSET S20\nSTL S20\nOUT Y000\nOUT T0 K10\nLD T0\nSET S21\nSTL S21\nOUT Y001\nOUT T1 K10\nLD T1\nOUT S20\nRET",
     "tests": [("上電：Y0 先亮", [("wait", 100), ("is", "Y000", 1), ("is", "Y001", 0)]),
               ("1 秒後換 Y1", [("wait", 1150), ("is", "Y000", 0), ("is", "Y001", 1)]),
               ("一直輪流：6 秒內 Y0 變化 5～7 次", [("wait", 50), ("toggles", "Y000", 6000, 5, 7)])]},

    {"id": "E13", "lesson": "7", "free": False, "title": "鑽床：並行分支與選擇分支（SFC）",
     "task": "圓盤工件要鑽 3 對孔（共 6 孔），兩支鑽頭同時鑽：\n"
             "1. 按啟動 X0：夾緊 Y0。夾緊後壓力開關 X1 ON。\n"
             "2. 兩支鑽頭同時下降：左 Y1 到深度 X2、右 Y3 到深度 X4；各自到了就上升：左 Y2 回原點 X3、右 Y4 回原點 X5。\n"
             "3. 兩支都回到原點，工件旋轉 Y5（轉 60 度），轉到位 X6 ON 算一對孔（計數器 C0，設定 3）。\n"
             "4. 還沒鑽滿 3 對：回到步驟 2 再鑽；鑽滿了：鬆開 Y6（夾緊 Y0 要關掉），鬆開到位 X7 回到待機。\n"
             "回到待機時計數器要清除。\n"
             "注意（FX 手冊）：步進換步的那一個掃描，前一步和後一步會同時 ON。下降和上升這種相反動作，要在步裡加互鎖接點，否則電磁閥兩邊會同時通電一個掃描。",
     "inputs": [("X000", "啟動", "hold"), ("X001", "夾緊壓力開關", "toggle"), ("X002", "左鑽到深度", "toggle"),
                ("X003", "左鑽在原點", "toggle"), ("X004", "右鑽到深度", "toggle"), ("X005", "右鑽在原點", "toggle"),
                ("X006", "旋轉到位", "toggle"), ("X007", "鬆開到位", "toggle")],
     "outputs": [("Y000", "夾緊"), ("Y001", "左鑽下降"), ("Y002", "左鑽上升"), ("Y003", "右鑽下降"), ("Y004", "右鑽上升"),
                 ("Y005", "工件旋轉"), ("Y006", "鬆開")],
     "rules": [("never_both", "Y001", "Y002", "左鑽同時下降又上升"), ("never_both", "Y003", "Y004", "右鑽同時下降又上升"),
               ("never_both", "Y005", "Y001", "鑽頭還在下面時旋轉工件，鑽頭會斷"), ("never_both", "Y005", "Y003", "鑽頭還在下面時旋轉工件，鑽頭會斷"),
               ("never_both", "Y000", "Y006", "夾緊和鬆開同時輸出")],
     "starter": "LD M8002\nSET S0\nSTL S0\nRST C0\nLD X000\nSET S20\n\nRET\n",
     "hints": ["S20 夾緊：SET Y000（要一直夾到鬆開那一步）。LD X001 之後同時 SET S21、SET S24，這就是並行分支。",
               "左邊 S21 下降（OUT Y001，X002 換 S22）、S22 上升（OUT Y002，X003 換 S23）。右邊 S24、S25 同樣寫，換到 S26。",
               "S23、S26 是兩邊的等待步。並行合併的寫法是連續兩個 STL：STL S23、STL S26，下一行直接 SET S27。",
               "S27 旋轉：OUT Y005，LD X006、OUT C0 K3。接著選擇分支：LD X006、ANI C0 → SET S21、SET S24（再鑽一對）；LD X006、AND C0 → SET S28。",
               "S28 鬆開：RST Y000、OUT Y006，LD X007、OUT S0（跳回待機）。",
               "評分說左鑽同時下降又上升？那是換步的一個掃描重疊。上升那一步寫成 LDI Y001、OUT Y002（右邊 LDI Y003、OUT Y004），等下降真的關掉才上升。"],
     "solution": "LD M8002\nSET S0\nSTL S0\nRST C0\nLD X000\nSET S20\nSTL S20\nSET Y000\nLD X001\nSET S21\nSET S24\n"
                 "STL S21\nOUT Y001\nLD X002\nSET S22\nSTL S22\nLDI Y001\nOUT Y002\nLD X003\nSET S23\n"
                 "STL S24\nOUT Y003\nLD X004\nSET S25\nSTL S25\nLDI Y003\nOUT Y004\nLD X005\nSET S26\n"
                 "STL S23\nSTL S26\nSET S27\n"
                 "STL S27\nOUT Y005\nLD X006\nOUT C0 K3\nLD X006\nANI C0\nSET S21\nSET S24\nLD X006\nAND C0\nSET S28\n"
                 "STL S28\nRST Y000\nOUT Y006\nLD X007\nOUT S0\nRET",
     "tests": [("按啟動：夾緊", [("set", "X003", 1), ("set", "X005", 1), ("wait", 50), ("set", "X000", 1), ("wait", 50), ("set", "X000", 0),
                             ("wait", 50), ("is", "Y000", 1), ("is", "Y001", 0)]),
               ("夾緊完成：兩支鑽頭同時下降", [*_DRILL_START, ("is", "Y001", 1), ("is", "Y003", 1)]),
               ("左邊先到深度：左邊上升，右邊繼續鑽", [*_DRILL_START, ("set", "X003", 0), ("set", "X005", 0), ("set", "X002", 1), ("wait", 50),
                                        ("is", "Y001", 0), ("is", "Y002", 1), ("is", "Y003", 1)]),
               ("只有左邊回原點：不能旋轉（並行合併要等兩邊）", [*_DRILL_START, ("set", "X003", 0), ("set", "X005", 0), ("set", "X002", 1),
                                                ("wait", 50), ("set", "X002", 0), ("set", "X003", 1), ("stays", "Y005", 0, 500)]),
               ("只有右邊回原點：也不能旋轉", [*_DRILL_START, ("set", "X003", 0), ("set", "X005", 0), ("set", "X004", 1),
                                     ("wait", 50), ("set", "X004", 0), ("set", "X005", 1), ("stays", "Y005", 0, 500), ("is", "Y001", 1)]),
               ("兩邊都回原點：旋轉；轉到位後再鑽下一對", [*_DRILL_START, *_ONE_PAIR, ("is", "Y001", 1), ("is", "Y003", 1), ("is", "Y006", 0)]),
               ("鑽滿 3 對：鬆開，夾緊關掉；鬆開到位回待機，可以重新開始",
                [*_DRILL_START, *_ONE_PAIR, *_ONE_PAIR, *_ONE_PAIR, ("is", "Y006", 1), ("is", "Y000", 0), ("is", "Y001", 0),
                 ("set", "X007", 1), ("wait", 50), ("set", "X007", 0), ("set", "X001", 0), ("wait", 50), ("is", "Y006", 0),
                 ("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 50), ("is", "Y000", 1),
                 ("set", "X001", 1), ("wait", 50), ("is", "Y001", 1)])]},

    {"id": "E14", "lesson": "A4", "free": False, "title": "水塔自動補水（遲滯與第二道保護）",
     "plant": "tank",
     "task": "按啟動 X0 進入自動，按停止 X1 解除。自動中：\n"
             "・液位低到低液位 X2 時打開進水閥 Y0，一直進水到高液位 X3 才關（中間不要一直開開關關，這叫遲滯）。\n"
             "・溢流開關 X4 是第二道保護：X4 ON 時進水立刻關、警報燈 Y2 亮並保持，按停止才解除。\n"
             "・停止時進水要關。\n"
             "評分會讓高液位感測器故障，看你的第二道保護有沒有擋住。",
     "inputs": [("X000", "啟動", "hold"), ("X001", "停止", "hold"), ("X002", "低液位", "sensor"), ("X003", "高液位", "sensor"),
                ("X004", "溢流開關", "sensor")],
     "outputs": [("Y000", "進水閥"), ("Y002", "溢流警報燈")],
     "starter": "", "hints": ["自動模式用自保持：LD X000、OR M0、ANI X001、OUT M0。",
                              "進水用 SET/RST 做遲滯：LD M0、AND X002 → SET Y000；LD X003 → RST Y000。液位在中間時 Y0 保持原狀。",
                              "溢流：LD X004 → SET M1（記住警報）；LD M1 → RST Y000、OUT Y002；LD X001 → RST M1。",
                              "別忘了停止時 RST Y000（LDI M0 → RST Y000），而且開進水的條件要加 ANI M1。"],
     "solution": "LD X000\nOR M0\nANI X001\nOUT M0\nLD M0\nAND X002\nANI M1\nSET Y000\nLD X003\nRST Y000\nLD X004\nSET M1\n"
                 "LD X001\nRST M1\nLDI M0\nRST Y000\nLD M1\nRST Y000\nLD M1\nOUT Y002",
     "tests": [("按啟動：低液位開始進水", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 50), ("is", "Y000", 1)]),
               ("到高液位關閉進水", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 7500), ("is", "Y000", 0)]),
               ("中間液位不會一直開關（遲滯）", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 7500), ("stays", "Y000", 0, 10000)]),
               ("用水到低液位再自動補水", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 7500), ("wait", 16500), ("is", "Y000", 1)]),
               ("高液位感測器壞了：溢流時強制停止並警報", [("fault", "high_dead", True), ("set", "X000", 1), ("wait", 50), ("set", "X000", 0),
                                                ("wait", 9000), ("is", "Y000", 0), ("is", "Y002", 1), ("stays", "Y000", 0, 3000)]),
               ("按停止：進水關", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 1000), ("set", "X001", 1), ("wait", 50),
                                ("is", "Y000", 0)])]},

    {"id": "E15", "lesson": "9", "free": False, "title": "自動門（防夾安全）",
     "plant": "door",
     "task": "有人（X2）→ 開門 Y0，一直開到開到底 X0 才停。\n"
             "沒人以後等 2 秒才關門 Y1，關到底 X1 停。\n"
             "關門途中有人來、或防夾光電 X3 被遮住，要立刻改成開門。\n"
             "開門和關門馬達不能同時通電，而且絕對不能夾到人。",
     "inputs": [("X000", "開到底", "sensor"), ("X001", "關到底", "sensor"), ("X002", "有人", "toggle"), ("X003", "防夾光電被遮", "toggle")],
     "outputs": [("Y000", "開門馬達"), ("Y001", "關門馬達")],
     "rules": [("never_both", "Y000", "Y001", "開門和關門馬達同時通電"), ("plant_flag", "crush", "", "關門時夾到人")],
     "starter": "", "hints": ["先做「需要開門」M0：LD X002、OR X003、OUT M0。",
                              "開門自保持到開到底：LD M0、OR Y000、ANI X000、ANI Y001、OUT Y000。",
                              "沒人 2 秒：LDI M0、OUT T0 K20。關門：LD T0、ANI X001、ANI Y000、ANI M0、OUT Y001。ANI M0 讓有人時立刻停止關門。"],
     "solution": "LD X002\nOR X003\nOUT M0\nLD M0\nOR Y000\nANI X000\nANI Y001\nOUT Y000\nLDI M0\nOUT T0 K20\nLD T0\nANI X001\nANI Y000\nANI M0\nOUT Y001",
     "tests": [("有人來：開門，開到底停", [("set", "X002", 1), ("wait", 3000), ("is", "Y000", 0), ("is", "X000", 1)]),
               ("人走了 2 秒內不關門", [("set", "X002", 1), ("wait", 3000), ("set", "X002", 0), ("stays", "Y001", 0, 1800), ("wait", 400), ("is", "Y001", 1)]),
               ("關到底停", [("set", "X002", 1), ("wait", 3000), ("set", "X002", 0), ("wait", 5500), ("is", "Y001", 0), ("is", "X001", 1)]),
               ("關門中有人來：立刻改開門", [("set", "X002", 1), ("wait", 3000), ("set", "X002", 0), ("wait", 2800), ("set", "X002", 1), ("wait", 50),
                                       ("is", "Y001", 0), ("is", "Y000", 1)]),
               ("關門中防夾光電被遮：不能夾到人", [("set", "X002", 1), ("wait", 3000), ("set", "X002", 0), ("wait", 2800), ("set", "X003", 1), ("wait", 1000),
                                          ("is", "Y001", 0)])]},

    {"id": "E16", "lesson": "A3", "free": False, "title": "包裝線：滿 5 個換箱",
     "plant": "conveyor",
     "task": "按啟動 X0 輸送帶 Y0 開始轉，按停止 X1 隨時停。\n工件感測器 X2 每經過一個工件 ON 一下。每 5 個工件滿一箱：輸送帶停、滿箱燈 Y1 亮。\n"
             "作業員換好箱子按換箱完成 X3：燈熄、重新計數，輸送帶自動繼續（仍在啟動狀態時）。",
     "inputs": [("X000", "啟動", "hold"), ("X001", "停止", "hold"), ("X002", "工件感測器", "sensor"), ("X003", "換箱完成", "hold")],
     "outputs": [("Y000", "輸送帶"), ("Y001", "滿箱燈")],
     "starter": "", "hints": ["運轉狀態用自保持 M0。", "計數：LD X002、OUT C0 K5。滿了 C0 ON。",
                              "輸送帶：LD M0、ANI C0、OUT Y000。滿箱燈：LD C0、OUT Y001。換箱：LD X003、RST C0。"],
     "solution": "LD X000\nOR M0\nANI X001\nOUT M0\nLD X002\nOUT C0 K5\nLD M0\nANI C0\nOUT Y000\nLD C0\nOUT Y001\nLD X003\nRST C0",
     "tests": [("啟動：輸送帶轉", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 50), ("is", "Y000", 1)]),
               ("4 個工件時還在跑", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 4600), ("is", "Y000", 1), ("is", "Y001", 0)]),
               ("第 5 個工件：停帶、滿箱燈亮", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 5300), ("is", "Y000", 0), ("is", "Y001", 1)]),
               ("換箱後自動續跑，下一箱也是 5 個", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 5300), ("set", "X003", 1), ("wait", 50),
                                          ("set", "X003", 0), ("wait", 50), ("is", "Y001", 0), ("is", "Y000", 1), ("wait", 4500), ("is", "Y000", 1),
                                          ("wait", 700), ("is", "Y001", 1), ("is", "Y000", 0)]),
               ("停止按鈕隨時停", [("set", "X000", 1), ("wait", 50), ("set", "X000", 0), ("wait", 2000), ("set", "X001", 1), ("wait", 50), ("is", "Y000", 0)])]},

    {"id": "E17", "lesson": "6-2", "free": True, "title": "紅綠燈（步進循環）",
     "task": "開關 X0 打開後：綠燈 Y2 亮 5 秒 → 黃燈 Y1 亮 2 秒 → 紅燈 Y0 亮 5 秒 → 回到綠燈，一直循環。\n開關關掉時全部熄滅；再打開要從綠燈開始。用步進（STL）寫，寫好切到「SFC 圖」看看。",
     "inputs": [("X000", "啟動開關", "toggle")], "outputs": [("Y000", "紅燈"), ("Y001", "黃燈"), ("Y002", "綠燈")],
     "starter": "LD M8002\nSET S0\nSTL S0\nLD X000\nSET S20\n; S20 綠、S21 黃、S22 紅\n\nRET\n",
     "hints": ["S20：OUT Y002、OUT T0 K50，LD T0、SET S21。S21、S22 照樣寫，計時 K20、K50。",
               "S22 時間到跳回 S20：LD T2、OUT S20。",
               "開關關掉：寫在 RET 後面，LDI X000 → ZRST S20 S22，再 LDI X000 → SET S0。"],
     "solution": "LD M8002\nSET S0\nSTL S0\nLD X000\nSET S20\nSTL S20\nOUT Y002\nOUT T0 K50\nLD T0\nSET S21\nSTL S21\nOUT Y001\nOUT T1 K20\n"
                 "LD T1\nSET S22\nSTL S22\nOUT Y000\nOUT T2 K50\nLD T2\nOUT S20\nRET\nLDI X000\nZRST S20 S22\nLDI X000\nSET S0",
     "tests": [("打開：先亮綠燈", [("set", "X000", 1), ("wait", 100), ("is", "Y002", 1), ("is", "Y000", 0), ("is", "Y001", 0)]),
               ("5 秒後黃燈", [("set", "X000", 1), ("wait", 5200), ("is", "Y001", 1), ("is", "Y002", 0)]),
               ("再 2 秒紅燈", [("set", "X000", 1), ("wait", 7300), ("is", "Y000", 1), ("is", "Y001", 0)]),
               ("紅燈 5 秒後回到綠燈", [("set", "X000", 1), ("wait", 12300), ("is", "Y002", 1), ("is", "Y000", 0)]),
               ("關掉全部熄滅，再打開從綠燈開始", [("set", "X000", 1), ("wait", 6000), ("set", "X000", 0), ("wait", 100), ("is", "Y000", 0), ("is", "Y001", 0),
                                         ("is", "Y002", 0), ("set", "X000", 1), ("wait", 100), ("is", "Y002", 1), ("is", "Y001", 0)])]},

    {"id": "E18", "lesson": "C2", "free": True, "title": "氣壓乙級 PLC 題：變速迴路（08000-1090201）",
     "plant": "pneu", "exam": True,
     "task": "依技術士技能檢定氣壓乙級術科試題 08000-1090201「PLC-氣壓控制－變速迴路」的操作功能（只練 PLC 程式；氣壓迴路裝配、計算題不在此練習）。\n"
             "動作順序（位移－時間圖的 1～9 格）：A+ 到 a1 → B+ → A- → C+ → B- → A+（慢）到 a1 → A+（快）到 a2 → A-、C- 同時回到原點。\n"
             "・「時段」就是位移－時間圖上相鄰兩條直線之間的一格，也就是一步。例如第 1 時段是 A+ 到 a1。手動步進每按一次 ST 只做一個時段。\n"
             "・變速：試題要求 A 缸第 6 時段前進較慢、第 7 時段較快（迴路裝配條件）。本站用 Y11「A 快速閥」代表快速：Y11 ON 時 A 缸速度加倍，所以第 7 時段要同時輸出 A+ 和 Y11，第 6 時段只輸出 A+。試題的 I/O 參考配置表只列 Y0～Y5，快速閥接哪一個輸出由你規劃，本站固定用 Y11。\n"
             "・燈號：上電且在原點待機時綠燈亮；按 ST 後紅燈亮、綠燈滅；完成後停在起始步驟，紅燈滅、綠燈亮。上電時不在原點：試題沒有規定，本站的做法是還沒復歸時綠燈不亮，要先復歸。\n"
             "・模式：復歸／運轉用二段式開關；手動步進／單一循環／連續循環用多段式開關。連續循環按 STOP 後做完這一循環才停。運轉中切換模式必須無效。三個模式輸入都 OFF 時：試題沒有規定，本站的做法是按 ST 不動作。\n"
             "・急停 EMS（常閉，按下為 OFF）：A 立即停在該位置（5 口 3 位置中封閥），B、C 停在該步驟終點（5/2 雙線圈閥斷電保持閥位，自己走完）；按 ST 無效；PLC 輸出端斷電。\n"
             "・解除急停後：切到復歸模式按復歸鈕，黃燈 0.5 秒 ON／0.5 秒 OFF 閃爍，先 B、C 回原點，再 A 回原點；完成後才能在運轉模式啟動，未復歸按 ST 無效。所有氣壓缸不可爆衝。\n"
             "・停電：恢復供電後要復歸（黃燈閃、先 B、C 再 A），未復歸按 ST 無效。\n"
             "I/O 照試題的 PLC I/O 參考配置表：X0 ST、X1 STOP、X2 EMS、X3 復歸／運轉、X4 復歸鈕、X5 手動步進、X6 單一循環、X7 連續循環；Y0～Y5 為 A+、A-、B+、B-、C+、C-。感測器（X10～）、燈號（Y6～Y10）、快速閥（Y11）是本站的練習配置。",
     "inputs": [("X000", "啟動 ST", "hold"), ("X001", "停止 STOP", "hold"), ("X002", "緊急停止 EMS（常閉）", "toggle"),
                ("X003", "復歸/運轉（ON＝運轉）", "toggle"), ("X004", "復歸按鈕", "hold"), ("X005", "手動步進", "toggle"),
                ("X006", "單一循環", "toggle"), ("X007", "連續循環", "toggle"), ("X010", "a0", "sensor"),
                ("X011", "a1", "sensor"), ("X012", "a2", "sensor"), ("X013", "b0", "sensor"),
                ("X014", "b1", "sensor"), ("X015", "c0", "sensor"), ("X016", "c1", "sensor")],
     "outputs": [("Y000", "A+"), ("Y001", "A-"), ("Y002", "B+"), ("Y003", "B-"), ("Y004", "C+"), ("Y005", "C-"), ("Y006", "綠燈"),
                 ("Y007", "紅燈"), ("Y010", "黃燈"), ("Y011", "A 快速閥")],
     "rules": [("never_both", "Y000", "Y001", "A+、A- 同時輸出"), ("never_both", "Y002", "Y003", "B+、B- 同時輸出"),
               ("never_both", "Y004", "Y005", "C+、C- 同時輸出")],
     "starter": "; 檢定練習：先寫上電與燈號，再寫動作順序（建議用步進 STL），最後寫急停與復歸\n",
     "hints": ["先決定步序：S0 待機、S20～S27 八個時段、S40～S41 復歸。每一步的完成條件就是該缸到位的感測器。",
               "模式用 M20／M21／M22 在啟動那一刻鎖住，運轉中切換選擇開關就不會影響。",
               "手動步進：每按一次 ST 給一個執行許可 M40，換步時清掉；單一、連續循環一直有許可。",
               "急停：LDI X002 → ZRST 所有步、清掉「已復歸」旗標。輸出全在步裡用 OUT，步一清掉就全部斷電。",
               "A 缸在 S26→S27 換步的那一個掃描 A+、A- 會同時 ON，要加互鎖（ANI Y000）。",
               "參考解答是 STL 寫法，看完可以切到「SFC 圖」對照。"],
     "solution": _E18_IL,
     "tests": [("上電在原點：綠燈亮、紅燈滅", [("set", "X002", 1), ("wait", 100), ("is", "Y006", 1), ("is", "Y007", 0)]),
               ("單一循環：動作順序正確", _E18_START + [("set", "X000", 1), ("sequence", 9000, _E18_SEQ, _E18_DEV)]),
               ("單一循環：運轉中紅燈亮、綠燈滅", _E18_START + _E18_ST + [("wait", 500), ("is", "Y007", 1), ("is", "Y006", 0)]),
               ("單一循環：完成後停在原點，綠燈亮、不再動作", _E18_START + _E18_ST + [("wait", 9000), ("is", "Y007", 0), ("is", "Y006", 1),
                                                           ("is", "X010", 1), ("is", "X013", 1), ("is", "X015", 1), ("stays", "Y000", 0, 1500)]),
               ("手動步進：按一次只走一個時段", [("set", "X002", 1), ("set", "X003", 1), ("set", "X005", 1), ("wait", 100)] + _E18_ST +
                [("wait", 1500), ("is", "X011", 1), ("stays", "Y002", 0, 800)] + _E18_ST + [("wait", 1200), ("is", "X014", 1), ("stays", "Y001", 0, 500)]),
               ("連續循環：自動重複，按 STOP 做完這一循環才停", [("set", "X002", 1), ("set", "X003", 1), ("set", "X007", 1), ("wait", 100)] + _E18_ST +
                [("wait", 9000), ("is", "Y007", 1), ("wait", 2000), ("set", "X001", 1), ("wait", 60), ("set", "X001", 0), ("wait", 300),
                 ("is", "Y007", 1), ("wait", 8000), ("is", "Y007", 0), ("is", "Y006", 1), ("stays", "Y000", 0, 1500)]),
               ("運轉中切換模式無效", _E18_START + _E18_ST + [("wait", 2000), ("set", "X006", 0), ("set", "X007", 1), ("wait", 9000),
                                                         ("is", "Y007", 0), ("stays", "Y000", 0, 1500)]),
               ("急停：輸出全斷、A 停住、B 走完該步、按 ST 無效", _E18_START + _E18_ST + [("wait", 2300), ("set", "X002", 0), ("wait", 30),
                 ("is", "Y000", 0), ("is", "Y001", 0), ("is", "Y002", 0), ("is", "Y007", 0), ("is", "Y006", 0), ("wait", 1500), ("is", "X014", 1),
                 ("set", "X000", 1), ("wait", 100), ("set", "X000", 0), ("stays", "Y000", 0, 500), ("stays", "Y001", 0, 300)]),
               ("未復歸時按 ST 無效", _E18_START + _E18_ST + [("wait", 2300), ("set", "X002", 0), ("wait", 1500), ("set", "X002", 1),
                 ("wait", 100)] + _E18_ST + [("stays", "Y000", 0, 800), ("stays", "Y002", 0, 300), ("is", "Y007", 0)]),
               ("復歸順序：先 B、C 回原點，再 A", _E18_EMS_RESET + [("never_while", "Y001", [("X013", 1), ("X015", 1)], 2500,
                                                                 "B、C 還沒回到原點，A 就開始縮回（復歸順序錯）")]),
               ("復歸中黃燈 0.5 秒閃爍", _E18_EMS_RESET + [("toggles", "Y010", 1500, 2, 4)]),
               ("復歸完成：綠燈亮，可以在運轉模式啟動", _E18_EMS_RESET + [("wait", 3000), ("is", "Y006", 1), ("is", "Y010", 0), ("is", "X010", 1),
                                                       ("set", "X003", 1), ("wait", 100)] + _E18_ST + [("wait", 300), ("is", "Y007", 1)]),
               ("停電恢復後要先復歸", _E18_START + _E18_ST + [("wait", 2300), ("power_cycle", 1500), ("wait", 200), ("is", "Y006", 0)] + _E18_ST +
                [("stays", "Y000", 0, 800), ("stays", "Y002", 0, 300)])]},

    {"id": "E19", "lesson": "C2", "free": False, "title": "氣壓乙級 PLC 題：釋壓迴路（08000-1090202）",
     "plant": "pneu_relief", "exam": True, "latched": {"S": (500, 899), "M": (500, 1023), "D": (200, 511)},
     "task": "依 08000-1090202「PLC-氣壓控制－釋壓迴路」的操作功能（只練 PLC 程式）。I/O 和 E18 相同，不用 Y11。\n"
             "動作順序：A+ 到 a1 → B+ → A- → C+ → B- → A+ 到 a2 → A-、C- 同時回原點。\n"
             "・燈號、手動步進、單一循環、連續循環、運轉中切換無效：同 E18。\n"
             "・停電（和 E18 不同）：恢復供電後——運轉中停電：紅燈 0.5 秒閃爍，按 ST 後燈熄並繼續停電前未完成的動作，按復歸無效；"
             "復歸中停電：黃燈 0.5 秒閃爍，按復歸鈕後繼續未完成的復歸，按 ST 無效。\n"
             "・急停：A、B、C 都停止（B、C 兩側釋壓，由氣壓迴路完成）；ST 無效；輸出斷電。解除後在復歸模式按復歸鈕，先 B、C 再 A 回原點，黃燈閃爍。\n"
             "・練習用 CPU 為 FX3U 等級，停電保持範圍：S500～S899、M500～M1023、D200～D511。停電要能接著做，步序和旗標就要放在停電保持區。",
     "inputs": [("X000", "啟動 ST", "hold"), ("X001", "停止 STOP", "hold"), ("X002", "緊急停止 EMS（常閉）", "toggle"),
                ("X003", "復歸/運轉（ON＝運轉）", "toggle"), ("X004", "復歸按鈕", "hold"), ("X005", "手動步進", "toggle"),
                ("X006", "單一循環", "toggle"), ("X007", "連續循環", "toggle"), ("X010", "a0", "sensor"),
                ("X011", "a1", "sensor"), ("X012", "a2", "sensor"), ("X013", "b0", "sensor"),
                ("X014", "b1", "sensor"), ("X015", "c0", "sensor"), ("X016", "c1", "sensor")],
     "outputs": [("Y000", "A+"), ("Y001", "A-"), ("Y002", "B+"), ("Y003", "B-"), ("Y004", "C+"), ("Y005", "C-"), ("Y006", "綠燈"),
                 ("Y007", "紅燈"), ("Y010", "黃燈")],
     "rules": [("never_both", "Y000", "Y001", "A+、A- 同時輸出"), ("never_both", "Y002", "Y003", "B+、B- 同時輸出"),
               ("never_both", "Y004", "Y005", "C+、C- 同時輸出")],
     "starter": "; 先完成 E18，再把步序和旗標搬到停電保持區（S500～、M500～），加上停電恢復的等待\n",
     "hints": ["停電後要「接著做」，PLC 必須記得停在哪一步：步序用 S500～、運轉中旗標用 M530 這類停電保持元件。",
               "上電（M8002）時看保持的旗標：運轉中停電就進入「等啟動」M600（紅燈閃），復歸中停電就「等復歸鈕」M601（黃燈閃）。",
               "等待時要擋住動作：步裡的動作條件加 ANI M600；按 ST 才清 M600。等復歸鈕時按 ST 無效，反之亦然。",
               "M8002 只能在「沒有保持中的步」時才 SET S0，否則會和保持的步同時作用。"],
     "solution": _E19_IL,
     "tests": [("上電在原點：綠燈亮", [("set", "X002", 1), ("wait", 100), ("is", "Y006", 1), ("is", "Y007", 0)]),
               ("單一循環：動作順序正確", _E19_START + [("set", "X000", 1), ("sequence", 9000, _E19_SEQ, _E19_DEV)]),
               ("單一循環：完成後回原點、綠燈亮", _E19_START + _E19_ST + [("wait", 9000), ("is", "Y006", 1), ("is", "Y007", 0), ("is", "X010", 1)]),
               ("連續循環：按 STOP 做完這一循環才停", [("set", "X002", 1), ("set", "X003", 1), ("set", "X007", 1), ("wait", 100)] + _E19_ST +
                [("wait", 8000), ("is", "Y007", 1), ("set", "X001", 1), ("wait", 60), ("set", "X001", 0), ("wait", 8000), ("is", "Y007", 0),
                 ("is", "Y006", 1), ("stays", "Y000", 0, 1500)]),
               ("急停：B 停在半路（釋壓），輸出全斷", _E19_START + _E19_ST + [("wait", 1500), ("set", "X002", 0), ("wait", 600), ("is", "X014", 0),
                 ("is", "X013", 0), ("is", "Y002", 0), ("is", "Y007", 0)]),
               ("運轉中停電：紅燈閃爍，按復歸無效", _E19_START + _E19_ST + [("wait", 1500), ("power_cycle", 1500), ("toggles", "Y007", 1500, 2, 4)] +
                _E19_RST + [("stays", "Y003", 0, 500), ("stays", "Y001", 0, 300)]),
               ("運轉中停電：按 ST 接著做完這一循環", _E19_START + _E19_ST + [("wait", 1500), ("power_cycle", 1500), ("wait", 300)] + _E19_ST +
                [("wait", 9000), ("is", "Y006", 1), ("is", "X010", 1), ("is", "X013", 1), ("is", "X015", 1)]),
               ("復歸中停電：黃燈閃爍，按 ST 無效，按復歸鈕接著復歸",
                _E19_START + _E19_ST + [("wait", 2500), ("set", "X002", 0), ("wait", 300), ("set", "X002", 1), ("set", "X003", 0), ("wait", 100)] + _E19_RST +
                [("wait", 300), ("power_cycle", 300), ("toggles", "Y010", 1500, 2, 4)] + _E19_ST + [("stays", "Y003", 0, 300), ("stays", "Y001", 0, 300)] +
                _E19_RST + [("wait", 4000), ("is", "Y006", 1), ("is", "X010", 1), ("is", "X013", 1)])]},

    {"id": "E20", "lesson": "C3", "free": False, "title": "氣壓乙級 PLC 題：平衡迴路（08000-1090203）",
     "plant": "pneu_q3", "exam": True,
     "task": "依 08000-1090203「PLC-氣壓控制－平衡迴路」的操作功能（只練 PLC 程式）。C 是負載缸：三個位置 c0、c1、c2，原點在 c2（上方）。\n"
             "動作順序：A+ → B+ → C- 到 c1 → A- → C- 到 c0 → A+ → B- → C+ 回 c2 → A-。\n"
             "・燈號、手動步進、單一循環、連續循環（STOP 做完這一循環）、運轉中切換無效：同 E18。\n"
             "・急停：ST 無效；A、B 停在該步終點（雙線圈閥）；C 在第 3 步（往 c1、還沒到）要立即退回 c2，其他步驟就地停止（5 口 3 位置中封閥）。\n"
             "・解除急停後，復歸模式按復歸鈕：黃燈 0.5 秒閃爍，C 回 c2 → B 回 b0 → A 回 a0；未復歸啟動無效。\n"
             "I/O：X0～X7 同 E18；a0 X10、a1 X11、b0 X12、b1 X13、c0 X14、c1 X15、c2 X16；A+ Y0、A- Y1、B+ Y2、B- Y3、C+（往 c2）Y4、C-（往 c0）Y5。",
     "inputs": [("X000", "啟動 ST", "hold"), ("X001", "停止 STOP", "hold"), ("X002", "緊急停止 EMS（常閉）", "toggle"),
                ("X003", "復歸/運轉（ON＝運轉）", "toggle"), ("X004", "復歸按鈕", "hold"), ("X005", "手動步進", "toggle"),
                ("X006", "單一循環", "toggle"), ("X007", "連續循環", "toggle"), ("X010", "a0", "sensor"),
                ("X011", "a1", "sensor"), ("X012", "b0", "sensor"), ("X013", "b1", "sensor"),
                ("X014", "c0", "sensor"), ("X015", "c1", "sensor"), ("X016", "c2", "sensor")],
     "outputs": [("Y000", "A+"), ("Y001", "A-"), ("Y002", "B+"), ("Y003", "B-"), ("Y004", "C+（往 c2）"), ("Y005", "C-（往 c0）"),
                 ("Y006", "綠燈"), ("Y007", "紅燈"), ("Y010", "黃燈")],
     "rules": [("never_both", "Y000", "Y001", "A+、A- 同時輸出"), ("never_both", "Y002", "Y003", "B+、B- 同時輸出"),
               ("never_both", "Y004", "Y005", "C+、C- 同時輸出")],
     "starter": "; 提示：急停時 C 可能要主動退回，所以 Y4 會在兩個地方被要求，先寫到 M 再統一輸出\n",
     "hints": ["九個時段：S20～S28。原點是 a0、b0、c2。",
               "急停時「在第 3 步、C 還沒到 c1」才要退回：在清除步序之前先記下來（LDI X002、AND S22、ANI X015 → SET M50），到 c2 再清掉。",
               "Y4（C+）在第 8 步要用，急停退回也要用。兩處都 OUT Y004 會變雙線圈：步裡寫 M64，最後 LD M64、OR M50 → OUT Y004。",
               "復歸三步：S40 C+ 到 c2、S41 B- 到 b0、S42 A- 到 a0。"],
     "solution": _E20_IL,
     "tests": [("上電在原點：綠燈亮", [("set", "X002", 1), ("wait", 100), ("is", "Y006", 1), ("is", "Y007", 0)]),
               ("單一循環：動作順序正確", _E20_START + [("set", "X000", 1), ("sequence", 10000, _E20_SEQ, _E20_DEV)]),
               ("單一循環：完成後回原點、綠燈亮", _E20_START + _E20_ST + [("wait", 9500), ("is", "Y006", 1), ("is", "X010", 1), ("is", "X016", 1),
                                                             ("stays", "Y000", 0, 1200)]),
               ("手動步進：按一次只走一個時段", [("set", "X002", 1), ("set", "X003", 1), ("set", "X005", 1), ("wait", 100)] + _E20_ST +
                [("wait", 1300), ("is", "X011", 1), ("stays", "Y002", 0, 600)]),
               ("連續循環：按 STOP 做完這一循環才停", [("set", "X002", 1), ("set", "X003", 1), ("set", "X007", 1), ("wait", 100)] + _E20_ST +
                [("wait", 10000), ("is", "Y007", 1), ("set", "X001", 1), ("wait", 60), ("set", "X001", 0), ("wait", 9500), ("is", "Y007", 0),
                 ("stays", "Y000", 0, 1200)]),
               ("急停在第 3 步：C 立即退回 c2", _E20_START + _E20_ST + [("wait", 2200), ("set", "X002", 0), ("wait", 900), ("is", "X016", 1),
                                                          ("is", "Y007", 0)] + _E20_ST + [("stays", "Y000", 0, 500), ("stays", "Y005", 0, 300)]),
               ("急停在其他步：C 就地停止", _E20_START + _E20_ST + [("wait", 3550), ("set", "X002", 0), ("wait", 1000), ("is", "X014", 0),
                                                       ("is", "X016", 0), ("is", "X015", 0), ("is", "Y004", 0), ("is", "Y005", 0)]),
               ("復歸順序：C → B → A", _E20_EMS_RESET + [("never_while", "Y003", [("X016", 1)], 1500, "C 還沒回到 c2，B 就開始復歸"),
                                                     ("never_while", "Y001", [("X016", 1), ("X012", 1)], 1500, "C、B 還沒回原點，A 就開始復歸")]),
               ("復歸中黃燈閃爍，完成後可以啟動", _E20_EMS_RESET + [("toggles", "Y010", 1500, 2, 4), ("wait", 2500), ("is", "Y006", 1),
                                                             ("set", "X003", 1), ("wait", 100)] + _E20_ST + [("wait", 300), ("is", "Y007", 1)])]},

    {"id": "E21", "lesson": "C4", "free": False, "title": "氣壓乙級 PLC 題：鎖固迴路（08000-1090204）",
     "plant": "pneu_q3", "exam": True,
     "task": "依 08000-1090204「PLC-氣壓控制－鎖固迴路」的操作功能（只練 PLC 程式）。I/O 同 E20（C 為負載缸，原點 c2）。\n"
             "動作順序：A+ → A- → C- 到 c1 → A+ → A- → C- 到 c0 → B+ → B- → C+ 回 c2。\n"
             "・燈號、手動步進、單一循環、連續循環（STOP 做完這一循環）、運轉中切換無效：同 E18。\n"
             "・急停：ST 無效；A、B 停在該步終點，C 就地停止（鎖固）。\n"
             "　(1) 在第 7～10 步（C 已到 c0 之後）急停：解除後要切到復歸模式按復歸鈕，黃燈閃爍，B 回 b0 → C 回 c2；未復歸或模式不對，ST 無效。\n"
             "　(2) 在其他步驟急停：解除後按 ST，接著執行未完成的動作；按復歸鈕無效。",
     "inputs": [("X000", "啟動 ST", "hold"), ("X001", "停止 STOP", "hold"), ("X002", "緊急停止 EMS（常閉）", "toggle"),
                ("X003", "復歸/運轉（ON＝運轉）", "toggle"), ("X004", "復歸按鈕", "hold"), ("X005", "手動步進", "toggle"),
                ("X006", "單一循環", "toggle"), ("X007", "連續循環", "toggle"), ("X010", "a0", "sensor"),
                ("X011", "a1", "sensor"), ("X012", "b0", "sensor"), ("X013", "b1", "sensor"),
                ("X014", "c0", "sensor"), ("X015", "c1", "sensor"), ("X016", "c2", "sensor")],
     "outputs": [("Y000", "A+"), ("Y001", "A-"), ("Y002", "B+"), ("Y003", "B-"), ("Y004", "C+（往 c2）"), ("Y005", "C-（往 c0）"),
                 ("Y006", "綠燈"), ("Y007", "紅燈"), ("Y010", "黃燈")],
     "rules": [("never_both", "Y000", "Y001", "A+、A- 同時輸出"), ("never_both", "Y002", "Y003", "B+、B- 同時輸出"),
               ("never_both", "Y004", "Y005", "C+、C- 同時輸出")],
     "starter": "; 同樣是急停，第 7～10 步要清掉步序重新復歸，其他步驟只暫停（步序保留，按 ST 接著做）\n",
     "hints": ["急停的那一刻（LDI X002 → PLS）判斷現在在哪一步：S26～S28 → 清步序、要復歸；其他 → SET 一個「暫停」旗標 M70。",
               "所有動作的許可 M41 加上 AND X002、ANI M70：暫停中步序還在，但不會輸出。",
               "暫停中按 ST（且急停已解除）才清 M70；這時 S0 不在作用，所以待機裡的復歸條件自然無效。",
               "A+ 之後立刻 A-：A- 那步要加 ANI Y000，否則換步那一個掃描兩邊同時 ON。B+、B- 也一樣。"],
     "solution": _E21_IL,
     "tests": [("上電在原點：綠燈亮", [("set", "X002", 1), ("wait", 100), ("is", "Y006", 1)]),
               ("單一循環：動作順序正確", _E21_START + [("set", "X000", 1), ("sequence", 10000, _E21_SEQ, _E21_DEV)]),
               ("單一循環：完成後回原點、綠燈亮", _E21_START + _E21_ST + [("wait", 9000), ("is", "Y006", 1), ("is", "X016", 1), ("stays", "Y000", 0, 1200)]),
               ("手動步進：按一次只走一個時段", [("set", "X002", 1), ("set", "X003", 1), ("set", "X005", 1), ("wait", 100)] + _E21_ST +
                [("wait", 1300), ("is", "X011", 1), ("stays", "Y001", 0, 600)]),
               ("連續循環：按 STOP 做完這一循環才停", [("set", "X002", 1), ("set", "X003", 1), ("set", "X007", 1), ("wait", 100)] + _E21_ST +
                [("wait", 9500), ("is", "Y007", 1), ("set", "X001", 1), ("wait", 60), ("set", "X001", 0), ("wait", 9500), ("is", "Y007", 0),
                 ("stays", "Y000", 0, 1200)]),
               ("前段急停：C 就地停，按復歸無效，按 ST 接著做完", _E21_START + _E21_ST + [("wait", 2150), ("set", "X002", 0), ("wait", 800),
                 ("is", "X015", 0), ("is", "X016", 0), ("is", "Y005", 0), ("set", "X002", 1), ("set", "X003", 0), ("wait", 100)] + _E21_RST +
                [("stays", "Y004", 0, 400), ("stays", "Y003", 0, 200), ("set", "X003", 1), ("wait", 100)] + _E21_ST +
                [("wait", 8000), ("is", "Y006", 1), ("is", "X016", 1), ("is", "X010", 1), ("is", "X012", 1)]),
               ("後段急停：解除後 ST 無效，要復歸（B → C）", _E21_START + _E21_ST + [("wait", 5300), ("set", "X002", 0), ("wait", 1200),
                 ("set", "X002", 1), ("wait", 100)] + _E21_ST + [("stays", "Y003", 0, 1500), ("stays", "Y004", 0, 300), ("set", "X003", 0),
                 ("wait", 100)] + _E21_RST + [("never_while", "Y004", [("X012", 1)], 1500, "B 還沒回到 b0，C 就開始復歸"),
                 ("toggles", "Y010", 600, 0, 3), ("wait", 1500), ("is", "Y006", 1), ("is", "X016", 1)]),
               ("復歸中黃燈閃爍", _E21_START + _E21_ST + [("wait", 5300), ("set", "X002", 0), ("wait", 1200), ("set", "X002", 1), ("set", "X003", 0),
                                                    ("wait", 100)] + _E21_RST + [("toggles", "Y010", 1500, 2, 4)])]},

    {"id": "E22", "lesson": "C4", "free": False, "title": "工業配線乙級第一站：自動門開閉控制（01300-10802105）",
     "plant": "door2", "exam": True,
     "task": "依工業配線乙級 01300-10802105 第五題的動作要求（只練 PLC 程式，配線、電表、輸出確認不在這裡）。門全行程 3 秒。\n"
             "・LS1、LS2 是 b 接點（常閉）：門到位、壓到開關時輸入 OFF，不在該端時 ON（試題機具表「各具 1b 接點」，TB3 只接 LS1-NC、LS2-NC）。試題寫的「LS1 ON」是指開關被門壓到，不是 PLC 讀到 ON。斷線時輸入也是 OFF，等於「到位」，門會停，這是安全側的設計。\n"
             "・手動（COS 1）：門全閉 [PL2 亮] 按 PB1 開門 [MC1、PL1 閃]，到全開 LS1 停 [PL1 亮]；門全開按 PB2 關門 [MC2、PL2 閃]，到全閉 LS2 停。\n"
             "・關門中按 PB1：立即停止，2 秒後才開門。停電後門停在中間，復電後按 PB1／PB2 仍能開／關。開關門進行中切 COS，馬達繼續，到位後才接續新模式。\n"
             "・自動關門（COS 2）：PL3 亮。門全開時預告 [PL1 亮、PL3 閃] 10 秒後自動關門 [MC2、PL2 閃、PL3 亮]；預告中按 PB2 立即關門。手動狀態門全開時切到 COS 2，直接開始預告。\n"
             "・光電開關：關門中有人，BZ 響、立即改成開門，到全開停；人離開後 BZ 停，手動等 PB2，自動重新預告。\n"
             "・過載（只在運轉中有效）：BZ 響；關門中立即改開門，開門中繼續開，到全開停。按 PB3 BZ 停、PL4 閃；門全開且 TH 復歸後 PL4 熄、恢復。\n"
             "・TH 沒復歸就開機：BZ 斷續響、燈全熄、不能操作，TH 復歸後恢復。閃爍一律 ON/OFF 各 0.5 秒（M8013）。\n"
             "注意：開始前先把 X7（TH，常閉）切成 ON。",
     "inputs": [("X000", "PB1 開門", "hold"), ("X001", "PB2 關門", "hold"), ("X002", "PB3 警報復歸", "hold"),
                ("X003", "COS（ON＝2 自動關門）", "toggle"), ("X004", "LS1 全開（b 接點，到位＝OFF）", "sensor"), ("X005", "LS2 全閉（b 接點，到位＝OFF）", "sensor"),
                ("X006", "對照型光電開關（有人＝ON）", "toggle"), ("X007", "積熱電驛 TH（常閉）", "toggle")],
     "outputs": [("Y000", "MC1 開門（正轉）"), ("Y001", "MC2 關門（反轉）"), ("Y002", "PL1 正轉／門全開"), ("Y003", "PL2 反轉／門全閉"),
                 ("Y004", "PL3 自動指示"), ("Y005", "PL4 故障指示"), ("Y006", "BZ 蜂鳴器")],
     "rules": [("never_both", "Y000", "Y001", "MC1、MC2 同時輸出（正反轉短路）"), ("plant_flag", "crush", None, "光電開關有人還在關門：夾到人")],
     "starter": "; 先把「狀態」分清楚：開門中 M1、關門中 M2、等 2 秒 M3、預告 M4、安全開門 M5、過載 M6\n; 輸出最後統一寫，MC1、MC2 互鎖\n",
     "hints": ["門的動作用 SET/RST 旗標記住：M1 開門中、M2 關門中，LS1 到位（b 接點 OFF：LDI X004）RST M1、LS2 到位（LDI X005）RST M2，最後 LD M1 ANI M2 OUT Y000。",
               "關門中按 PB1 要先停：RST M2、SET M3，M3 計時 2 秒（T0 K20）到了才 SET M1。按鈕用 LDP，不然按住會一直觸發。",
               "預告用 OUT M4（全開、自動、停著才成立），T1 K100 到了 SET M2；一關門 M4 自己就掉了，換回手動也會取消。",
               "光電和過載都要「關門中立即改開門」：RST M2、SET M1，不要經過 2 秒等待。過載只在 Y0 或 Y1 有輸出時才算（LD Y000 OR Y001 ANI X007）。",
               "開機時 TH 沒復歸：LD M8002 ANI X007 SET M0；M0 期間所有燈都要 ANI M0，BZ 用 M0 AND M8013。",
               "燈號用「閃 or 亮」兩個條件 ORB：PL1 = (Y0 AND M8013) OR (LS1 到位 ANI Y1)，LS1 到位要寫 LDI X004。"],
     "solution": _E22_IL,
     "tests": [("上電門全閉：PL2 亮、其他燈熄", _E22_ON + [("is", "Y003", 1), ("is", "Y002", 0), ("is", "Y004", 0), ("is", "Y006", 0)]),
               ("手動開門：PL1 閃，到全開停止、PL1 亮", _E22_ON + _E22_PB1 + [("is", "Y000", 1), ("is", "Y003", 0), ("toggles", "Y002", 1500, 2, 4),
                 ("wait", 1600), ("is", "X004", 0), ("is", "Y000", 0), ("stays", "Y002", 1, 500)]),
               ("手動關門：PL2 閃，到全閉停止、PL2 亮", _E22_OPEN + _E22_PB2 + [("is", "Y001", 1), ("toggles", "Y003", 1500, 2, 4),
                 ("wait", 1700), ("is", "X005", 0), ("is", "Y001", 0), ("stays", "Y003", 1, 500), ("is", "Y002", 0)]),
               ("關門中按 PB1：立即停止，2 秒後才開門", _E22_OPEN + _E22_PB2 + [("wait", 1000)] + _E22_PB1 +
                [("is", "Y001", 0), ("stays", "Y000", 0, 1700), ("wait", 400), ("is", "Y000", 1)]),
               ("手動模式全開後不會自己關", _E22_OPEN + [("stays", "Y001", 0, 12000)]),
               ("停電門停在中間：復電後 PB2 可關、PB1 可開", _E22_ON + _E22_PB1 + [("wait", 1300), ("power_cycle", 500), ("wait", 200),
                 ("is", "Y000", 0), ("is", "X004", 1), ("is", "X005", 1)] + _E22_PB2 + [("wait", 1700), ("is", "X005", 0), ("is", "Y001", 0)] +
                _E22_PB1 + [("wait", 3100), ("is", "X004", 0)]),
               ("自動：PL3 亮；全開後預告 10 秒（PL3 閃）才關門", _E22_AUTO + [("is", "Y004", 1)] + _E22_PB1 + [("wait", 3300),
                 ("toggles", "Y004", 3000, 4, 8), ("is", "Y002", 1), ("stays", "Y001", 0, 5000), ("wait", 2000), ("is", "Y001", 1),
                 ("stays", "Y004", 1, 800), ("wait", 2500), ("is", "X005", 0), ("is", "Y001", 0), ("is", "Y003", 1), ("is", "Y004", 1)]),
               ("自動：預告中按 PB2 立即關門", _E22_AUTO + _E22_PB1 + [("wait", 3500)] + _E22_PB2 + [("is", "Y001", 1)]),
               ("手動全開時切到自動：直接開始預告", _E22_OPEN + [("stays", "Y001", 0, 1000), ("set", "X003", 1), ("toggles", "Y004", 2000, 2, 5),
                 ("wait", 8500), ("is", "Y001", 1)]),
               ("自動關門中切回手動：PL3 熄、繼續關到全閉", _E22_AUTO + _E22_PB1 + [("wait", 3300)] + _E22_PB2 + [("wait", 500), ("set", "X003", 0),
                 ("wait", 100), ("is", "Y004", 0), ("is", "Y001", 1), ("wait", 2600), ("is", "X005", 0)]),
               ("光電開關：關門中有人，BZ 響、立即改開門", _E22_OPEN + _E22_PB2 + [("wait", 1000), ("set", "X006", 1), ("wait", 100),
                 ("is", "Y001", 0), ("is", "Y000", 1), ("is", "Y006", 1), ("wait", 1300), ("is", "X004", 0), ("is", "Y000", 0), ("is", "Y006", 1)] +
                _E22_PB2 + [("stays", "Y001", 0, 300), ("set", "X006", 0), ("wait", 100), ("is", "Y006", 0)] + _E22_PB2 + [("is", "Y001", 1)]),
               ("自動模式光電動作：人離開後重新預告", _E22_AUTO + _E22_PB1 + [("wait", 3300)] + _E22_PB2 + [("wait", 800), ("set", "X006", 1),
                 ("wait", 1200), ("is", "X004", 0), ("stays", "Y001", 0, 2000), ("set", "X006", 0), ("toggles", "Y004", 1500, 2, 4),
                 ("wait", 9000), ("is", "Y001", 1)]),
               ("關門中過載：立即改開門；PB3 消音、PL4 閃；TH 復歸後恢復", _E22_OPEN + _E22_PB2 + [("wait", 1000), ("set", "X007", 0), ("wait", 100),
                 ("is", "Y000", 1), ("is", "Y006", 1), ("wait", 1300), ("is", "X004", 0), ("is", "Y000", 0)] + _E22_PB2 +
                [("stays", "Y001", 0, 300)] + _E22_PB3 + [("is", "Y006", 0), ("toggles", "Y005", 1500, 2, 4), ("set", "X007", 1), ("wait", 100),
                 ("is", "Y005", 0), ("is", "Y006", 0)] + _E22_PB2 + [("is", "Y001", 1)]),
               ("開門中過載：繼續開到全開", _E22_ON + _E22_PB1 + [("wait", 1000), ("set", "X007", 0), ("wait", 100), ("is", "Y000", 1),
                 ("is", "Y006", 1), ("wait", 2200), ("is", "X004", 0), ("is", "Y000", 0), ("is", "Y006", 1)]),
               ("馬達停止時 TH 跳脫：沒有作用", _E22_ON + [("set", "X007", 0), ("wait", 500), ("is", "Y006", 0), ("is", "Y005", 0), ("is", "Y003", 1)]),
               ("TH 沒復歸就開機：BZ 斷續、燈全熄、不能操作", [("wait", 100), ("toggles", "Y006", 1500, 2, 4), ("is", "Y003", 0)] + _E22_PB1 +
                [("stays", "Y000", 0, 300), ("set", "X007", 1), ("wait", 100), ("is", "Y006", 0), ("is", "Y003", 1)] + _E22_PB1 + [("is", "Y000", 1)])]},
    {"id": "E23", "lesson": "C4", "free": False, "title": "工業配線乙級第一站：自動啟閉控制（01300-10802101）",
     "plant": "belt3", "exam": True,
     "task": "依工業配線乙級 01300-10802101 第一題的動作要求（只練 PLC 程式；安全電驛、配線不在這裡）。三台輸送帶 M1、M2、M3。\n"
             "・上電 PL4 亮。COS 切到 2：BZ 響（性能測試），切回 1 停。\n"
             "・PB2 啟動：M1 → 5 秒 → M2 → 10 秒 → M3，計時中 PL4 閃，全部啟動後 PL4 亮。\n"
             "・PB1（運轉中不論啟動完成與否，或停車中）：清除殘留物件，M1、M2、M3 全部投入 → 5 秒 [PL4、PL1 交互閃] M1 停 → 10 秒 [PL4、PL2 交互閃] M2 停 → 5 秒 [PL4、PL3 交互閃] M3 停，PL4 亮。\n"
             "・PB6 緊急停止（常閉）：馬達全停、燈全熄（PL4 除外）、BZ 斷續響；解除後 BZ 停，按 PB2 接著做被中斷的動作，計時器延續剩下的時間。\n"
             "・過載（TH 常閉，運轉中跳脫）：BZ 響、PL5 亮、該台立即停；比它先轉的同時停；比它晚的照「停止流程」做完。"
             "例：三台都轉時 TH1 跳 → M1 停 → 10 秒 M2 停 → 5 秒 M3 停；TH2 跳 → M1、M2 停 → 5 秒 M3 停；TH3 跳 → 全停。"
             "只有 M1、M2 在轉時 TH1 跳：M2 繼續 10 秒後停，M3 照原來的啟動計時（延續跳脫前的時間）加入，M2 停後再 5 秒停。COS 切到 2 BZ 停。\n"
             "・過載流程做完、TH 全部復歸後 PL5 熄；COS 切回 1 才能重新啟動。\n"
             "注意：開始前先把 X3（PB6，常閉）切成 ON。TH 用機台的「製造故障」跳脫。",
     "inputs": [("X000", "PB1 停止（清除殘留）", "hold"), ("X001", "PB2 啟動", "hold"), ("X002", "COS（ON＝2 警報測試／復歸）", "toggle"),
                ("X003", "PB6 緊急停止（常閉）", "toggle"), ("X004", "TH1（常閉）", "sensor"), ("X005", "TH2（常閉）", "sensor"),
                ("X006", "TH3（常閉）", "sensor")],
     "outputs": [("Y000", "MC1 M1 運轉"), ("Y001", "MC2 M2 運轉"), ("Y002", "MC3 M3 運轉"), ("Y003", "PL1 M1 運轉"), ("Y004", "PL2 M2 運轉"),
                 ("Y005", "PL3 M3 運轉"), ("Y006", "PL4 電源指示"), ("Y007", "PL5 過載指示"), ("Y010", "BZ 蜂鳴器")],
     "rules": [],
     "starter": "; 啟動流程 S20→S21→S22、停止流程 S30→S31→S32，過載就跳到停止流程的對應位置\n; 緊急停止要「接著做、延續剩餘計時」：用停電保持型計時器 T250～T255，離開流程時記得 RST\n",
     "hints": ["馬達不要寫在步裡，最後統一輸出：MC1 = (S20 或 S21 或 S22 或 S30) 且「沒有緊急停止」。這樣同一個線圈不會散在很多步裡。",
               "緊急停止時步序不要清掉，只要讓輸出和計時器停：一個旗標 M21 =「PB6 沒按、也沒在暫停」，每個計時器和輸出都 AND M21。",
               "T250～T255 是累計型（線圈 OFF 時保留現值），剛好用在「延續剩下的計時」。回到 S0 時把它們全部 RST。",
               "過載只算正在轉的那台：LD Y000 ANI X004 OUT M41。三台都轉時 TH1 → 跳到 S31（M2、M3 轉 10 秒），TH2 → S32，TH3 → S0。",
               "只有 M1、M2 在轉時 TH1 跳：另開一步 S33，M2 轉 10 秒；M3 要等原本的 10 秒啟動計時到，所以 T251 在 S21 和 S33 都要計（寫在 STL 外面：LD S21 OR S33 AND M21 OUT T251 K100）。",
               "交互閃爍：PL4 = M8013，PL1 = MC1 且不是（S30 且 M8013）。BZ 是互斥：過載且 COS 在 1，或沒過載且 COS 在 2。"],
     "solution": _E23_IL,
     "tests": [("上電 PL4 亮；COS 2 BZ 響、切回 1 停", _E23_ON + [("is", "Y006", 1), ("is", "Y000", 0), ("is", "Y010", 0), ("set", "X002", 1),
                 ("wait", 100), ("is", "Y010", 1), ("set", "X002", 0), ("wait", 100), ("is", "Y010", 0)]),
               ("啟動順序：M1 → 5 秒 → M2 → 10 秒 → M3，計時中 PL4 閃", _E23_ON + _E23_PB2 + [("is", "Y000", 1), ("is", "Y003", 1), ("is", "Y001", 0),
                 ("toggles", "Y006", 2000, 3, 5), ("stays", "Y001", 0, 2700), ("wait", 300), ("is", "Y001", 1), ("is", "Y004", 1),
                 ("stays", "Y002", 0, 9700), ("wait", 300), ("is", "Y002", 1), ("is", "Y005", 1), ("stays", "Y006", 1, 1000)]),
               ("停止流程：全部投入 → 5 秒 M1 停 → 10 秒 M2 停 → 5 秒 M3 停", _E23_RUN + _E23_PB1 + [("is", "Y000", 1), ("is", "Y001", 1), ("is", "Y002", 1),
                 ("stays", "Y000", 1, 4700), ("wait", 300), ("is", "Y000", 0), ("is", "Y001", 1), ("stays", "Y001", 1, 9500), ("wait", 500),
                 ("is", "Y001", 0), ("is", "Y002", 1), ("stays", "Y002", 1, 4400), ("wait", 600), ("is", "Y002", 0), ("stays", "Y006", 1, 1000)]),
               ("停止流程的燈號：PL4 與 PL1 交互閃", _E23_RUN + _E23_PB1 + [("toggles", "Y003", 2000, 3, 5), ("toggles", "Y006", 2000, 3, 5),
                 ("is", "Y004", 1), ("wait", 3500), ("toggles", "Y004", 2000, 3, 5), ("is", "Y003", 0)]),
               ("啟動中按 PB1：三台全部投入", _E23_ON + _E23_PB2 + [("wait", 2000)] + _E23_PB1 + [("is", "Y000", 1), ("is", "Y001", 1), ("is", "Y002", 1)]),
               ("停車中按 PB1：三台投入清除殘留後依序停", _E23_ON + _E23_PB1 + [("is", "Y000", 1), ("is", "Y001", 1), ("is", "Y002", 1),
                 ("wait", 20200), ("is", "Y000", 0), ("is", "Y001", 0), ("is", "Y002", 0)]),
               ("緊急停止：全停、燈熄（PL4 除外）、BZ 斷續響", _E23_RUN + [("set", "X003", 0), ("wait", 100), ("is", "Y000", 0), ("is", "Y001", 0),
                 ("is", "Y002", 0), ("is", "Y003", 0), ("is", "Y005", 0), ("is", "Y006", 1), ("toggles", "Y010", 1500, 2, 4)]),
               ("解除緊急停止：BZ 停，按 PB2 接著做、延續剩餘計時", _E23_ON + _E23_PB2 + [("wait", 3000), ("set", "X003", 0), ("wait", 3000),
                 ("set", "X003", 1), ("wait", 100), ("is", "Y010", 0), ("stays", "Y000", 0, 1000)] + _E23_PB2 +
                [("is", "Y000", 1), ("stays", "Y001", 0, 1600), ("wait", 400), ("is", "Y001", 1)]),
               ("三台運轉 TH1 跳脫：M1 停 → 10 秒 M2 停 → 5 秒 M3 停", _E23_RUN + [("fault", "th1", 1), ("wait", 100), ("is", "Y000", 0), ("is", "Y001", 1),
                 ("is", "Y007", 1), ("is", "Y010", 1), ("stays", "Y001", 1, 9500), ("wait", 500), ("is", "Y001", 0), ("is", "Y002", 1),
                 ("toggles", "Y005", 2000, 3, 5), ("wait", 3200), ("is", "Y002", 0)]),
               ("三台運轉 TH2 跳脫：M1、M2 停 → 5 秒 M3 停", _E23_RUN + [("fault", "th2", 1), ("wait", 100), ("is", "Y000", 0), ("is", "Y001", 0),
                 ("is", "Y002", 1), ("stays", "Y002", 1, 4500), ("wait", 500), ("is", "Y002", 0)]),
               ("三台運轉 TH3 跳脫：全部停", _E23_RUN + [("fault", "th3", 1), ("wait", 100), ("is", "Y000", 0), ("is", "Y001", 0), ("is", "Y002", 0),
                 ("is", "Y007", 1), ("is", "Y010", 1), ("set", "X002", 1), ("wait", 100), ("is", "Y010", 0)]),
               ("M1、M2 運轉時 TH1 跳脫：M3 照原計時加入，M2 10 秒後停，再 5 秒 M3 停", _E23_ON + _E23_PB2 + [("wait", 8000), ("fault", "th1", 1), ("wait", 100),
                 ("is", "Y000", 0), ("is", "Y001", 1), ("stays", "Y002", 0, 6700), ("wait", 400), ("is", "Y002", 1), ("stays", "Y001", 1, 2500),
                 ("wait", 500), ("is", "Y001", 0), ("is", "Y002", 1), ("stays", "Y002", 1, 4500), ("wait", 500), ("is", "Y002", 0)]),
               ("M1、M2 運轉時 TH2 跳脫：M1、M2 停，M3 不啟動", _E23_ON + _E23_PB2 + [("wait", 8000), ("fault", "th2", 1), ("wait", 100),
                 ("is", "Y000", 0), ("is", "Y001", 0), ("stays", "Y002", 0, 10000)]),
               ("只有 M1 運轉時 TH1 跳脫：M1 停，M2 不啟動", _E23_ON + _E23_PB2 + [("wait", 2000), ("fault", "th1", 1), ("wait", 100),
                 ("is", "Y000", 0), ("stays", "Y001", 0, 5000)]),
               ("停止流程中（M2、M3 運轉）TH2 跳脫：M2 立即停，5 秒後 M3 停", _E23_RUN + _E23_PB1 + [("wait", 6000), ("is", "Y000", 0), ("is", "Y001", 1),
                 ("is", "Y002", 1), ("fault", "th2", 1), ("wait", 100), ("is", "Y001", 0), ("is", "Y002", 1), ("is", "Y007", 1), ("is", "Y010", 1),
                 ("stays", "Y002", 1, 4300), ("wait", 900), ("is", "Y002", 0)]),
               ("停止流程中（M2、M3 運轉）TH3 跳脫：全部停", _E23_RUN + _E23_PB1 + [("wait", 6000), ("fault", "th3", 1), ("wait", 100),
                 ("is", "Y001", 0), ("is", "Y002", 0), ("is", "Y007", 1), ("is", "Y010", 1)]),
               ("TH 全部復歸：PL5 熄、BZ 再響，COS 切回 1 才停", _E23_RUN + [("fault", "th3", 1), ("wait", 100), ("is", "Y010", 1), ("set", "X002", 1),
                 ("wait", 100), ("is", "Y010", 0), ("fault", "th3", 0), ("wait", 100), ("is", "Y007", 0), ("stays", "Y010", 1, 500),
                 ("set", "X002", 0), ("wait", 100), ("is", "Y010", 0)]),
               ("過載後：TH 沒復歸不能啟動；復歸後 PL5 熄、COS 在 1 才能啟動", _E23_RUN + [("fault", "th3", 1), ("wait", 100), ("set", "X002", 1),
                 ("wait", 500)] + _E23_PB2 + [("is", "Y000", 0), ("fault", "th3", 0), ("wait", 100), ("is", "Y007", 0)] + _E23_PB2 +
                [("is", "Y000", 0), ("set", "X002", 0), ("wait", 100)] + _E23_PB2 + [("is", "Y000", 1)])]},
    {"id": "E24", "lesson": "C4", "free": False, "title": "工業配線乙級第一站：污水池排放控制（01300-10802106）",
     "plant": "sump", "exam": True,
     "task": "依工業配線乙級 01300-10802106 第六題的動作要求（只練 PLC 程式）。水位近接開關 S1～S6 和考場一樣由你切換（由下往上依序 ON）。\n"
             "・COS 0 停機：馬達、燈、警報全部 OFF，按鈕無效。COS 1 手動、COS 2 自動（各一個輸入）。\n"
             "・自動：按 PB1，MC1、MC2 ON、污水閥 SV ON，依水位：上升到 S2 M1 啟動（PL1 閃 3 秒後亮）；S3 M2 以 40% 加入（PL2 閃）；S4 M2 100%（PL2 亮）；"
             "S5 BZ 斷續響（PB5 可消音）；S6 SV OFF。下降：低於 S5 BZ 停、SV ON；低於 S4 M2 回 40%；低於 S2 M2 停；低於 S1 M1 停。升降交錯也要正確。\n"
             "・手動：按 PB1 後，PB2 交替開關 SV（低於 S5 才能開）；PB3 交替 M1（S2 以上才能啟動，PL1 閃 3 秒後亮）；PB4 交替 M2 40%（S3 以上才能啟動，PL2 亮）。\n"
             "・PL4、PL5、PL6 以二進位顯示水位訊息碼（S1～S6 幾個 ON：PL4＝4、PL5＝2、PL6＝1）。\n"
             "・緊急停止 PB6（常閉）：SV OFF、M1、M2 停，PL4～PL6 同時閃，其他燈熄；解除後按 PB5 回到初始狀態（要再按 PB1）。\n"
             "・過載（M1、M2 運轉中對應的緩啟動器／變頻器 Tb 跳脫）：同緊急停止，再加 BZ 響；接點復歸 BZ 停，按 PB5 回到初始狀態。\n"
             "注意：開始前先把 X5（PB6，常閉）切成 ON。",
     "inputs": [("X000", "PB1 開始運轉", "hold"), ("X001", "PB2 SV 開啟／關閉", "hold"), ("X002", "PB3 M1 運轉／停止", "hold"),
                ("X003", "PB4 M2 低速／停止", "hold"), ("X004", "PB5 故障復歸／BZ 消音", "hold"), ("X005", "PB6 緊急停止（常閉）", "toggle"),
                ("X006", "COS 1 手動", "toggle"), ("X007", "COS 2 自動", "toggle"), ("X010", "PXS1 水位 S1", "toggle"),
                ("X011", "PXS2 水位 S2", "toggle"), ("X012", "PXS3 水位 S3", "toggle"), ("X013", "PXS4 水位 S4", "toggle"),
                ("X014", "PXS5 水位 S5", "toggle"), ("X015", "PXS6 水位 S6", "toggle"), ("X016", "緩啟動器 Tb（常閉）", "sensor"),
                ("X017", "變頻器 Tb（常閉）", "sensor")],
     "outputs": [("Y000", "MC1 緩啟動器電源"), ("Y001", "MC2 變頻器電源"), ("Y002", "M1 緩啟動器運轉"), ("Y003", "M2 變頻器 FWD"),
                 ("Y004", "變頻器 100%（OFF＝40%）"), ("Y005", "SV 污水閥／PL3"), ("Y006", "PL1 M1 運轉燈"), ("Y007", "PL2 M2 運轉燈"),
                 ("Y010", "PL4 訊息碼 4"), ("Y011", "PL5 訊息碼 2"), ("Y012", "PL6 訊息碼 1"), ("Y013", "BZ 蜂鳴器")],
     "rules": [],
     "starter": "; 自動的重點是「遲滯」：M1 到 S2 才啟動、低於 S1 才停，中間那段要記得原本的狀態 → 用 SET／RST\n",
     "hints": ["M1 自動：LD X011 SET M130（到 S2 啟動）、LDI X010 RST M130（低於 S1 停）。M2 一樣：S3 SET、低於 S2 RST。SV 關閉：S6 SET、低於 S5 RST。",
               "速度不需要遲滯：100% 就是「M2 在轉且 S4 ON」。",
               "手動、自動各算出 M1、M2、SV 的命令，最後 ORB 合併成一個輸出，不要在兩個地方 OUT 同一個 Y。",
               "交替按鈕：先把按鈕變成一個掃描的脈衝 M（LDP），原本 ON 就 RST、原本 OFF 且條件成立才 SET。注意 SET 和 RST 不要在同一個掃描互相抵消。",
               "訊息碼：PL4＝S4 ON；PL5＝(S2 ON 且 S4 OFF) 或 S6 ON；PL6＝(S1 且非 S2) 或 (S3 且非 S4) 或 (S5 且非 S6)。",
               "緊急停止和過載都用 SET 記住，PB5 在「EMS 解除、過載接點復歸」後才 ZRST 回初始狀態。"],
     "solution": _E24_IL,
     "tests": [("COS 0：全部 OFF、按鈕無效", [("set", "X005", 1)] + _E24_LV(3) + _E24_PB("X000") + [("is", "Y000", 0), ("is", "Y002", 0),
                 ("is", "Y010", 0), ("is", "Y011", 0), ("is", "Y012", 0)]),
               ("自動：PB1 → MC1、MC2、SV ON；訊息碼顯示", _E24_AUTO + _E24_PB("X000") + [("is", "Y000", 1), ("is", "Y001", 1), ("is", "Y005", 1),
                 ("is", "Y002", 0)] + _E24_LV(1) + [("is", "Y012", 1), ("is", "Y011", 0), ("is", "Y010", 0), ("is", "Y002", 0)]),
               ("自動水位上升：S2 M1、S3 M2 40%、S4 100%、S5 BZ、S6 SV 關", _E24_AUTO + _E24_PB("X000") + _E24_LV(2) +
                [("is", "Y002", 1), ("is", "Y011", 1), ("toggles", "Y006", 2500, 3, 6), ("wait", 700), ("stays", "Y006", 1, 500)] + _E24_LV(3) +
                [("is", "Y003", 1), ("is", "Y004", 0), ("toggles", "Y007", 1500, 2, 4), ("is", "Y011", 1), ("is", "Y012", 1)] + _E24_LV(4) +
                [("is", "Y004", 1), ("stays", "Y007", 1, 600), ("is", "Y010", 1), ("is", "Y011", 0), ("is", "Y012", 0)] + _E24_LV(5) +
                [("toggles", "Y013", 1500, 2, 4), ("is", "Y005", 1)] + _E24_PB("X004") + [("stays", "Y013", 0, 600)] + _E24_LV(6) +
                [("is", "Y005", 0), ("is", "Y010", 1), ("is", "Y011", 1), ("is", "Y012", 0)]),
               ("自動水位下降：低於 S5 SV 開、低於 S4 40%、低於 S2 M2 停、低於 S1 M1 停", _E24_AUTO + _E24_PB("X000") + _E24_LV(6) + _E24_LV(5) +
                [("is", "Y005", 0), ("toggles", "Y013", 1500, 2, 4)] + _E24_LV(4) + [("is", "Y005", 1), ("stays", "Y013", 0, 500), ("is", "Y004", 1)] +
                _E24_LV(3) + [("is", "Y004", 0), ("is", "Y003", 1)] + _E24_LV(2) + [("is", "Y003", 1), ("is", "Y002", 1)] + _E24_LV(1) +
                [("is", "Y003", 0), ("is", "Y002", 1)] + _E24_LV(0) + [("is", "Y002", 0), ("is", "Y005", 1)]),
               ("自動升降交錯", _E24_AUTO + _E24_PB("X000") + _E24_LV(3) + _E24_LV(2) + [("is", "Y003", 1)] + _E24_LV(3) + [("is", "Y003", 1)] +
                _E24_LV(1) + [("is", "Y003", 0), ("is", "Y002", 1)] + _E24_LV(2) + [("is", "Y003", 0), ("is", "Y002", 1)] + _E24_LV(3) +
                [("is", "Y003", 1)] + _E24_LV(5) + _E24_LV(6) + _E24_LV(5) + _E24_LV(6) + [("is", "Y005", 0)] + _E24_LV(5) + [("is", "Y005", 0)]),
               ("水位在 S3 以上才按 PB1：M1 運轉、M2 40%、SV ON", _E24_AUTO + _E24_LV(3) + _E24_PB("X000") + [("is", "Y002", 1), ("is", "Y003", 1),
                 ("is", "Y004", 0), ("is", "Y005", 1)]),
               ("手動：PB2 交替開關 SV，S5 以上不能開", _E24_MAN + _E24_PB("X000") + [("is", "Y005", 0)] + _E24_PB("X001") + [("is", "Y005", 1)] +
                _E24_PB("X001") + [("is", "Y005", 0)] + _E24_LV(5) + _E24_PB("X001") + [("stays", "Y005", 0, 300)]),
               ("手動：PB3 交替 M1（S2 以上），PL1 閃 3 秒後亮", _E24_MAN + _E24_PB("X000") + _E24_LV(1) + _E24_PB("X002") + [("stays", "Y002", 0, 300)] +
                _E24_LV(2) + _E24_PB("X002") + [("is", "Y002", 1), ("toggles", "Y006", 2500, 3, 6), ("wait", 700), ("stays", "Y006", 1, 500)] +
                _E24_PB("X002") + [("is", "Y002", 0), ("is", "Y006", 0)] + _E24_PB("X002") + [("is", "Y002", 1)]),
               ("手動：PB4 交替 M2 40%（S3 以上），PL2 亮", _E24_MAN + _E24_PB("X000") + _E24_LV(2) + _E24_PB("X003") + [("stays", "Y003", 0, 300)] +
                _E24_LV(4) + _E24_PB("X003") + [("is", "Y003", 1), ("is", "Y004", 0), ("stays", "Y007", 1, 1200)] + _E24_PB("X003") +
                [("is", "Y003", 0), ("is", "Y007", 0)]),
               ("手動：訊息碼和自動相同", _E24_MAN + _E24_PB("X000") + _E24_LV(5) + [("is", "Y010", 1), ("is", "Y011", 0), ("is", "Y012", 1)]),
               ("緊急停止：全停、PL4～PL6 同時閃；解除後按 PB5 回初始", _E24_AUTO + _E24_PB("X000") + _E24_LV(3) + [("set", "X005", 0), ("wait", 100),
                 ("is", "Y002", 0), ("is", "Y003", 0), ("is", "Y005", 0), ("is", "Y006", 0), ("is", "Y007", 0), ("toggles", "Y010", 1500, 2, 4),
                 ("toggles", "Y012", 1500, 2, 4), ("set", "X005", 1), ("wait", 200), ("toggles", "Y011", 1500, 2, 4), ("is", "Y002", 0)] +
                _E24_PB("X004") + [("stays", "Y010", 0, 300), ("is", "Y011", 1), ("is", "Y012", 1), ("is", "Y002", 0), ("is", "Y005", 0)] +
                _E24_PB("X000") + [("is", "Y002", 1), ("is", "Y005", 1)]),
               ("過載：全停、BZ 響；接點復歸 BZ 停，PB5 回初始", _E24_AUTO + _E24_PB("X000") + _E24_LV(3) + [("fault", "inv_trip", 1), ("wait", 100),
                 ("is", "Y002", 0), ("is", "Y003", 0), ("is", "Y005", 0), ("is", "Y013", 1), ("toggles", "Y011", 1500, 2, 4)] + _E24_PB("X004") +
                [("toggles", "Y011", 1500, 2, 4), ("fault", "inv_trip", 0), ("wait", 100), ("is", "Y013", 0)] + _E24_PB("X004") +
                [("stays", "Y010", 0, 300), ("is", "Y011", 1)] + _E24_PB("X000") + [("is", "Y003", 1)]),
               ("馬達沒在轉時過載接點跳脫：沒有作用", _E24_AUTO + _E24_PB("X000") + _E24_LV(1) + [("fault", "ss_trip", 1), ("wait", 300), ("is", "Y013", 0),
                 ("is", "Y005", 1), ("is", "Y012", 1)])]},
    {"id": "E25", "lesson": "C4", "free": False, "title": "工業配線乙級第一站：兩部抽水機控制（01300-10802102）",
     "plant": "pumps2", "exam": True,
     "task": "依工業配線乙級 01300-10802102 第二題的動作要求（只練 PLC 程式；HMI 畫面、輸出確認的 CB 回授不在這裡）。燈號 ON＝紅燈、OFF＝綠燈。\n"
             "・COS 1 自動交替：水塔缺水（浮球 X7 ON）時 #1 抽水，滿水停；下一次缺水換 #2，再下一次換回 #1……。\n"
             "・COS 0 手動交替：每按一次 PB2：#1 運轉 → 停 → #2 運轉 → 停 → #1……（不看水塔水位）。\n"
             "・COS 2 緊急抽水：水塔缺水時 #1、#2 同時運轉，滿水同時停。\n"
             "・蓄水池低水位（X10 OFF，PL5 紅）：所有抽水機不能運轉；恢復後回到正常操作。PL6 紅＝水塔缺水。\n"
             "・運轉中 TH 動作：該台停、PL3／PL4 紅、BZ 斷續響 10 秒後停；交替模式立即換另一台繼續抽到這次結束，TH 沒復歸前都用另一台單機抽水。\n"
             "・兩只 TH 都跳脫：全停、BZ 斷續響到按 PB1；兩只都復歸才恢復操作。\n"
             "・EMS：全停、EMS 燈紅；解除後回到初始狀態（從 #1 開始）。開機或解除 EMS 時 TH 沒復歸：對應 PL 紅燈閃、BZ 不響、全部復歸才能操作。\n"
             "・馬達沒在運轉，它的 TH 卻動作：所有負載與警報 OFF、所有燈綠、任何操作無效，要重新上電。\n"
             "注意：開始前先把 X4（EMS，常閉）和 X10（蓄水池允許抽水）切成 ON。TH 用機台的「製造故障」跳脫。",
     "inputs": [("X000", "PB1 警報 OFF", "hold"), ("X001", "PB2 手動交替", "hold"), ("X002", "COS 1 自動交替", "toggle"),
                ("X003", "COS 2 緊急抽水", "toggle"), ("X004", "EMS 緊急停止（常閉）", "toggle"), ("X005", "TH1（常閉）", "sensor"),
                ("X006", "TH2（常閉）", "sensor"), ("X007", "水塔浮球（ON＝缺水）", "toggle"), ("X010", "蓄水池（ON＝允許抽水）", "toggle")],
     "outputs": [("Y000", "MC1 #1 抽水機"), ("Y001", "MC2 #2 抽水機"), ("Y002", "PL1 #1 運轉（紅）"), ("Y003", "PL2 #2 運轉（紅）"),
                 ("Y004", "PL3 #1 過載（紅）"), ("Y005", "PL4 #2 過載（紅）"), ("Y006", "PL5 蓄水池缺水（紅）"), ("Y007", "PL6 水塔缺水（紅）"),
                 ("Y010", "BZ 蜂鳴器"), ("Y011", "EMS 指示（紅）")],
     "rules": [],
     "starter": "; 先算「要不要抽水」（自動看浮球、手動看 PB2 交替），再算「輪到哪一台」，最後才決定 MC1、MC2\n",
     "hints": ["需求 M20：自動＝COS1 且 X7；手動＝COS0 且 M21（PB2 用 LDP 觸發 ALT M21）。",
               "輪替要看「實際」最後轉的是哪一台：#1 轉時 SET M24、#2 轉時 RST M24；需求結束（LDF M20）時，M24 ON 就輪 #2（SET M22），否則輪 #1。過載換機後，下一次自然輪到另一台。",
               "過載換機：Sel1 =（輪 #1 且 TH1 正常）或（輪 #2 但 TH2 跳脫、TH1 正常）。Sel2 對稱。這樣跳脫的瞬間就自動換上另一台。",
               "BZ 10 秒：運轉中跳脫的那一刻 SET M31，M31 計時 T0 K100 到了 RST。兩只都跳脫另外用 M32，按 PB1 才消音。",
               "「沒在轉卻跳脫」用 LDF X005 ANI Y000：跳脫那一刻馬達沒輸出就 SET M0，M0 期間所有輸出都要 ANI M0；M0 不停電保持，重新上電自然清掉。",
               "開機時 TH 沒復歸：LD M8002 加上 LDI X005 ORI X006 ANB → SET M1；EMS 解除（LDP X004）同樣判斷。"],
     "solution": _E25_IL,
     "tests": [("初始：兩台停止，燈全綠", _E25_ON + [("is", "Y000", 0), ("is", "Y001", 0), ("is", "Y002", 0), ("is", "Y006", 0), ("is", "Y007", 0)]),
               ("自動交替：#1 → #2 → #1", _E25_ON + _E25_LOW + [("is", "Y000", 1), ("is", "Y001", 0), ("is", "Y002", 1), ("is", "Y007", 1)] + _E25_FULL +
                [("is", "Y000", 0), ("is", "Y007", 0)] + _E25_LOW + [("is", "Y001", 1), ("is", "Y000", 0), ("is", "Y003", 1)] + _E25_FULL +
                [("is", "Y001", 0)] + _E25_LOW + [("is", "Y000", 1), ("is", "Y001", 0)]),
               ("蓄水池低水位：不能抽水，恢復後繼續", _E25_ON + _E25_LOW + [("set", "X010", 0), ("wait", 100), ("is", "Y000", 0), ("is", "Y006", 1),
                 ("set", "X010", 1), ("wait", 100), ("is", "Y000", 1), ("is", "Y006", 0)]),
               ("手動交替：每按一次 PB2 輪換", [("set", "X004", 1), ("set", "X010", 1), ("wait", 100)] + _E25_PB("X001") + [("is", "Y000", 1)] +
                _E25_PB("X001") + [("is", "Y000", 0), ("is", "Y001", 0)] + _E25_PB("X001") + [("is", "Y001", 1), ("is", "Y000", 0)] +
                _E25_PB("X001") + [("is", "Y001", 0)] + _E25_PB("X001") + [("is", "Y000", 1)]),
               ("手動：不看水塔水位", [("set", "X004", 1), ("set", "X010", 1), ("set", "X007", 0), ("wait", 100)] + _E25_PB("X001") + [("stays", "Y000", 1, 500)]),
               ("緊急抽水：兩台同時，蓄水池低水位停、恢復再轉", [("set", "X004", 1), ("set", "X010", 1), ("set", "X003", 1), ("wait", 100)] + _E25_LOW +
                [("is", "Y000", 1), ("is", "Y001", 1), ("set", "X010", 0), ("wait", 100), ("is", "Y000", 0), ("is", "Y001", 0), ("set", "X010", 1),
                 ("wait", 100), ("is", "Y000", 1), ("is", "Y001", 1)] + _E25_FULL + [("is", "Y000", 0), ("is", "Y001", 0)]),
               ("運轉中過載：立即換另一台，BZ 斷續 10 秒後停", _E25_ON + _E25_LOW + [("fault", "th1", 1), ("wait", 100), ("is", "Y000", 0), ("is", "Y001", 1),
                 ("is", "Y004", 1), ("toggles", "Y010", 2000, 3, 5), ("wait", 8300), ("stays", "Y010", 0, 1500), ("is", "Y001", 1)]),
               ("TH 沒復歸：以另一台單機抽水；復歸後恢復交替", _E25_ON + _E25_LOW + [("fault", "th1", 1), ("wait", 100)] + _E25_FULL + [("is", "Y001", 0)] +
                _E25_LOW + [("is", "Y001", 1), ("is", "Y000", 0)] + _E25_FULL + _E25_LOW + [("is", "Y001", 1), ("is", "Y000", 0)] + _E25_FULL +
                [("fault", "th1", 0), ("wait", 100), ("is", "Y004", 0)] + _E25_LOW + [("is", "Y000", 1)]),
               ("兩只 TH 都跳脫：全停、BZ 響到按 PB1，全部復歸才恢復", _E25_ON + _E25_LOW + [("fault", "th1", 1), ("wait", 100), ("fault", "th2", 1),
                 ("wait", 100), ("is", "Y000", 0), ("is", "Y001", 0), ("is", "Y004", 1), ("is", "Y005", 1), ("wait", 10500), ("toggles", "Y010", 2000, 3, 5)] +
                _E25_PB("X000") + [("stays", "Y010", 0, 1000), ("fault", "th1", 0), ("wait", 100), ("stays", "Y000", 0, 500), ("fault", "th2", 0),
                 ("wait", 100), ("is", "Y004", 0), ("is", "Y005", 0), ("is", "Y000", 1)]),
               ("馬達沒轉時 TH 動作：全部 OFF、燈全綠、要重新上電", _E25_ON + [("fault", "th2", 1), ("wait", 100)] + _E25_LOW +
                [("stays", "Y000", 0, 500), ("is", "Y007", 0), ("is", "Y005", 0), ("is", "Y010", 0), ("power_cycle", 300), ("wait", 100),
                 ("toggles", "Y005", 1500, 2, 4), ("is", "Y010", 0), ("is", "Y000", 0), ("fault", "th2", 0), ("wait", 100), ("is", "Y005", 0),
                 ("is", "Y000", 1)]),
               ("緊急停止：全停、EMS 燈紅；解除後從 #1 開始", _E25_ON + _E25_LOW + _E25_FULL + _E25_LOW + [("is", "Y001", 1), ("set", "X004", 0), ("wait", 100),
                 ("is", "Y001", 0), ("is", "Y011", 1), ("set", "X004", 1), ("wait", 100), ("is", "Y011", 0), ("is", "Y000", 1), ("is", "Y001", 0)]),
               ("解除 EMS 時 TH 沒復歸：PL 紅燈閃、BZ 不響、復歸後才能操作", _E25_ON + _E25_LOW + [("fault", "th1", 1), ("wait", 100), ("set", "X004", 0),
                 ("wait", 100), ("set", "X004", 1), ("wait", 100), ("toggles", "Y004", 1500, 2, 4), ("is", "Y010", 0), ("is", "Y001", 0),
                 ("fault", "th1", 0), ("wait", 100), ("is", "Y004", 0), ("is", "Y000", 1)])]},

    {"id": "E26", "lesson": "A12", "free": True, "title": "跑馬燈（八燈依序點亮）",
     "task": "按啟動 X0：Y0 先亮，之後每 1 秒亮點往下一顆移動 Y0 → Y1 → … → Y7，Y7 之後回到 Y0，一直循環。任何時候只有一顆燈亮。\n"
             "按停止 X1：八顆燈全部熄滅，再按啟動從 Y0 重新開始。",
     "inputs": [("X000", "啟動", "hold"), ("X001", "停止", "hold")],
     "outputs": [("Y000", "燈 1"), ("Y001", "燈 2"), ("Y002", "燈 3"), ("Y003", "燈 4"), ("Y004", "燈 5"), ("Y005", "燈 6"), ("Y006", "燈 7"), ("Y007", "燈 8")],
     "starter": "", "hints": ["先做運轉旗標：LD X000、OR M0、ANI X001、OUT M0（自保持）。",
                              "啟動那一刻點亮第一顆：LDP M0、SET Y000。",
                              "每 1 秒一個脈衝：LD M0、ANI T0、OUT T0 K10。T0 到了只會 ON 一個掃描，下一圈自己歸零重數。",
                              "環狀移位：LD T0、SFTLP Y007 Y000 K8 K1。來源用 Y7，最後一顆移出去的同時補回 Y0，就繞一圈了。",
                              "停止全滅：LDI M0、ZRST Y000 Y007。"],
     "solution": "LD X000\nOR M0\nANI X001\nOUT M0\nLDP M0\nSET Y000\nLD M0\nANI T0\nOUT T0 K10\nLD T0\nSFTLP Y007 Y000 K8 K1\nLDI M0\nZRST Y000 Y007",
     "tests": [("按啟動：Y0 先亮，其他不亮", _E26_GO + [("is", "Y000", 1), ("is", "Y001", 0), ("is", "Y007", 0)]),
               ("大約每秒移一顆", _E26_GO + [("wait", 1300), ("is", "Y001", 1), ("is", "Y000", 0), ("wait", 2000), ("is", "Y003", 1), ("is", "Y002", 0)]),
               ("Y7 之後回到 Y0（循環）", _E26_GO + [("wait", 8400), ("is", "Y000", 1), ("is", "Y007", 0), ("wait", 1000), ("is", "Y001", 1)]),
               ("一直只有一顆亮", _E26_GO + [s for k in range(10) for s in (("wait", 950), ("one_of", "Y000 Y001 Y002 Y003 Y004 Y005 Y006 Y007"))]),
               ("停止全滅，再啟動從 Y0 開始", _E26_GO + [("wait", 2400), ("set", "X001", 1), ("wait", 100), ("set", "X001", 0), ("wait", 100),
                 ("is", "Y002", 0), ("is", "Y000", 0), ("stays", "Y000", 0, 1500)] + _E26_GO + [("is", "Y000", 1), ("is", "Y003", 0)])]},

    {"id": "E29", "lesson": "A14", "free": True, "title": "包裝計數：每箱幾個、顯示已裝幾箱（BCD）",
     "task": "包裝線：一位數指撥開關（X0～X3，BCD 的 1、2、4、8）設定「每箱幾個」（1～9）。工件感測器 X4 每來一個工件算一個，滿一箱就重新數下一箱；兩位數七段顯示器（Y0～Y3 個位、Y4～Y7 十位，都是 BCD）顯示「已經裝滿幾箱」（00～99）。按 X5 全部歸零。指撥在 0 時不計數。\n"
             "這台是學校的 FX3S-20M：8 個輸出剛好全部用來顯示。箱數超過 9 箱時，沒用 BCD 送出就會顯示錯。",
     "inputs": [("X000", "指撥 1", "toggle"), ("X001", "指撥 2", "toggle"), ("X002", "指撥 4", "toggle"), ("X003", "指撥 8", "toggle"),
                ("X004", "工件感測器", "hold"), ("X005", "歸零", "hold")],
     "outputs": [("Y000", "個位 1"), ("Y001", "個位 2"), ("Y002", "個位 4"), ("Y003", "個位 8"),
                 ("Y004", "十位 1"), ("Y005", "十位 2"), ("Y006", "十位 4"), ("Y007", "十位 8")],
     "starter": "; 指撥讀進來用 BIN，送到七段用 BCD\n",
     "hints": ["BIN K1X000 D0 把指撥讀成數字。一位數時 BIN 和 MOV 一樣，但養成習慣，兩位數以上才不會錯。",
               "計數器設定值可以用 D：OUT C0 D0。指撥是 0 時不要計數：在 LD X004 後面串 AND> D0 K0。",
               "滿一箱（C0 ON）時讓箱數計數器 C1 加 1（LD C0、OUT C1 K99），再 RST C0 開始下一箱。",
               "BCD C1 K2Y000 把箱數送到兩位數七段；X5 歸零要 RST C0 和 RST C1。"],
     "solution": "LD M8000\nBIN K1X000 D0\nLD X004\nAND> D0 K0\nOUT C0 D0\nLD C0\nOUT C1 K99\nLD C0\nRST C0\nLD M8000\nBCD C1 K2Y000\nLD X005\nRST C0\nRST C1",
     "tests": [("開機顯示 00", [("wait", 100)] + _E29_SHOW(0)),
               ("每箱 3 個：第 3 個工件才變 01", _E29_D(3) + _E29_P(2) + [("is", "Y000", 0)] + _E29_P(1) + _E29_SHOW(1)),
               ("下一箱重新數：再 3 個變 02", _E29_D(3) + _E29_P(6) + _E29_SHOW(2)),
               ("超過 9 箱要用 BCD：12 箱顯示 1、2", _E29_D(1) + _E29_P(12) + _E29_SHOW(12)),
               ("歸零：箱數和這一箱都清掉", _E29_D(3) + _E29_P(7) + _E29_R + _E29_SHOW(0) + _E29_P(2) + _E29_SHOW(0) + _E29_P(1) + _E29_SHOW(1)),
               ("指撥 0 不計數", _E29_D(0) + _E29_P(3) + _E29_SHOW(0))]},

    {"id": "E27", "lesson": "A11", "free": True, "title": "停車場車位計數",
     "task": "停車場有 10 個車位。入口感測器 X0：有車到入口時 ON，車開過去後 OFF；出口感測器 X1 同理。D0 記錄場內車數。\n"
             "① 每進來一台車 D0 加 1，每出去一台 D0 減 1。一台車停在感測器前很久，也只能算一次。\n"
             "② 場內滿 10 台時「車位已滿」燈 Y0 亮。\n"
             "③ 入口柵欄 Y1：未滿時有車到入口（X0 ON）就打開，車過去就關；已滿時不開，而且這台車不能算進去。\n"
             "④ D0 不能變成負數（感測器誤動作時也一樣）。",
     "inputs": [("X000", "入口感測器", "hold"), ("X001", "出口感測器", "hold")],
     "outputs": [("Y000", "車位已滿燈"), ("Y001", "入口柵欄")],
     "starter": "", "hints": ["只在車剛到時算一次：用上升沿 LDP X000。",
                              "還沒滿才算：LDP X000、AND< D0 K10、INC D0。",
                              "出去：LDP X001、AND> D0 K0、DEC D0。AND> D0 K0 讓 D0 不會變負數。",
                              "滿車燈：LD>= D0 K10、OUT Y000。柵欄：LD X000、AND< D0 K10、OUT Y001。"],
     "solution": "LDP X000\nAND< D0 K10\nINC D0\nLDP X001\nAND> D0 K0\nDEC D0\nLD>= D0 K10\nOUT Y000\nLD X000\nAND< D0 K10\nOUT Y001",
     "tests": [("進 3 台、出 1 台：D0 = 2", _E27_IN * 3 + _E27_OUT + [("d", "D0", 2), ("is", "Y000", 0)]),
               ("車停在入口 2 秒，只算 1 台，柵欄開著", [("set", "X000", 1), ("wait", 2000), ("is", "Y001", 1), ("set", "X000", 0), ("wait", 100),
                                              ("is", "Y001", 0), ("d", "D0", 1)]),
               ("第 10 台進來：滿車燈亮", _E27_IN * 10 + [("is", "Y000", 1), ("d", "D0", 10)]),
               ("已滿時第 11 台：柵欄不開，也不算", _E27_IN * 10 + [("set", "X000", 1), ("wait", 200), ("is", "Y001", 0), ("set", "X000", 0),
                                                       ("wait", 100), ("d", "D0", 10)]),
               ("出去一台就不滿了", _E27_IN * 10 + _E27_OUT + [("is", "Y000", 0), ("d", "D0", 9)]),
               ("場內沒車時出口誤動作：D0 不會變負數", _E27_OUT * 2 + [("d", "D0", 0)] + _E27_IN + [("d", "D0", 1)])]},
]


def _e18_part(pid, title, upto, lead, starter):
    """E18 in smaller steps (tester round 2): the same machine, I/O and safety rules, the first `upto` tests."""
    base = next(x for x in EXERCISES if x["id"] == "E18")
    part = dict(base, id=pid, title=title, tests=base["tests"][:upto], starter=starter,
                task=lead + "\n\n" + base["task"],
                hints=[h for h in base["hints"] if not ("急停" in h or "復歸" in h)] if upto < 13 else base["hints"])
    part["solution_note"] = "參考解答是完整版 E18（含急停、復歸），這一段只評前 %d 項。" % upto
    return part


_E18_IO = ("; I/O：X0 ST、X1 STOP、X2 EMS（常閉，練習時先切 ON）、X3 復歸／運轉（ON＝運轉）、X4 復歸鈕、X5 手動步進、X6 單一、X7 連續\n"
           "; 感測器 a0 X10、a1 X11、a2 X12、b0 X13、b1 X14、c0 X15、c1 X16；Y0～Y5＝A+ A- B+ B- C+ C-；Y6 綠、Y7 紅、Y10 黃、Y11 A 快速閥\n")
_i18 = next(i for i, x in enumerate(EXERCISES) if x["id"] == "E18")
EXERCISES[_i18:_i18] = [
    _e18_part("E18a", "氣壓乙級 E18 分段 1：單一循環＋燈號", 4,
              "【分段 1／3】這一段只做單一循環和燈號：開機在原點就當作已復歸；模式開關、急停、復歸、停電留到下兩段。評分只看前 4 項。",
              "; E18a：單一循環＋燈號\n" + _E18_IO +
              "; 步序（位移－時間圖 8 格）：S20 A+ 到 a1 → S21 B+ 到 b1 → S22 A- 到 a0 → S23 C+ 到 c1 → S24 B- 到 b0\n"
              ";   → S25 A+（慢）到 a1 → S26 A+＋Y11（快）到 a2 → S27 A-、C- 到 a0 而且 c0 → 回 S0\n"
              "; 燈號：在原點而且沒在跑＝綠燈；跑的時候＝紅燈\n"),
    _e18_part("E18b", "氣壓乙級 E18 分段 2：加入三種模式", 7,
              "【分段 2／3】在分段 1 的程式加上手動步進（X5）、連續循環（X7）、STOP（X1），而且運轉中切換模式無效。急停、復歸、停電留到 E18。評分看前 7 項。",
              "; E18b：把 E18a 的程式貼過來，再加：\n" + _E18_IO +
              "; 1. 按 ST 的那一刻把模式鎖進 M（例如 M20 手動、M21 單一、M22 連續），運轉中只看 M，不看開關\n"
              "; 2. 手動步進：每按一次 ST 給一個執行許可，換步時清掉\n"
              "; 3. 連續循環：S27 做完回 S20；按 STOP 記住請求，做完這一輪才回 S0\n"),
]

# ---------------------------------------------------------------- compile
DEVICE_RE = re.compile(r"^(X|Y)([0-7]{1,3})$|^(M)(\d{1,4})$|^(S)(\d{1,3})$|^(T|C)(\d{1,3})$|^(D)(\d{1,4})$")
WORD_RE = re.compile(r"^K-?\d{1,5}$|^H[0-9A-F]{1,4}$|^K[1-4][XYMS]\d+$|^N[0-7]$")
MESSAGES = [
    (r"instruction (\S+) not allowed", "不認得指令 %s"),
    (r"(\S+) needs (\d+) operands, has (\d+)", "%s 需要 %s 個元件，這裡寫了 %s 個"),
    (r"(\S+) without an open block", "%s 前面沒有可以合併的 LD 區塊"),
    (r"(\S+) source cannot be a constant", "%s 的來源不能是常數（K、H）：要放 D、C、T 或 K1X0 這類元件（三菱手冊規定）。"),
    (r"MPP without MPS", "MPP 前面沒有 MPS"),
    (r"MRD without MPS", "MRD 前面沒有 MPS"),
    (r"RET without STL", "RET 前面沒有 STL"),
    (r"END inside STL, RET is missing", "步進區最後少了 RET"),
    (r"(\S+) with (\d+) unmerged blocks", "%s 前面有 %s 個 LD 區塊沒有用 ANB 或 ORB 合併"),
    (r"use SET for a state transfer", "OUT S 只能寫在步進（STL～RET）裡面當跳躍；一般階梯圖要用 SET S"),
    (r"(\S+) out of range", "%s 超出範圍"),
    (r"special device (\S+) not allowed", "這個模擬器不支援特殊元件 %s"),
    (r"STL needs an S device", "STL 後面要接 S 元件"),
    (r"(\d+) MPS without MPP", "有 %s 個 MPS 沒有 MPP"),
]


def normalize(dev):
    m = re.match(r"^([XY])([0-7]{1,3})$", dev)
    return "%s%03d" % (m.group(1), int(m.group(2))) if m else dev


def _translate(msg):
    for pattern, zh in MESSAGES:
        m = re.search(pattern, msg)
        if m:
            return zh % m.groups() if m.groups() else zh
    return msg


def compile_il(text):
    """(items, program, errors). errors: [(line number, message)]. Comments after ';' and blank lines are ignored."""
    items, lines, errors = [], [], []
    for number, raw in enumerate(text.splitlines(), 1):
        code = raw.split(";", 1)[0].strip().upper()
        if not code:
            continue
        words = code.split()
        op, ops = words[0], [normalize(w) for w in words[1:]]
        if op == "END":
            continue
        if op not in ALLOWED and not COMPARE_RE.match(op):
            errors.append((number, "不認得指令 %s" % op))
            continue
        for o in ops:
            if not DEVICE_RE.match(o) and not WORD_RE.match(o):
                hint = "（X、Y 是八進位，沒有 8 和 9）" if re.match(r"^[XY]\d+$", o) else ""
                errors.append((number, "看不懂元件 %s%s" % (o, hint)))
        items.append(("ins", op, ops))
        lines.append(number)
    if errors:
        return items, [], errors
    if not items:
        return items, [], [(0, "還沒有寫任何指令")]
    program, step, step_line = [], 0, {}
    for (_, op, ops), number in zip(items, lines):
        program.append((step, op, ops))
        step_line[step] = number
        step += instruction_steps(op, ops)
    program.append((step, "END", []))
    problems, _ = check_program(program)
    for p in problems:
        m = re.match(r"step (\d+): (.*)", p)
        if m:
            errors.append((step_line.get(int(m.group(1)), 0), _translate(m.group(2))))
        elif p != "no END":
            errors.append((0, _translate(p)))
    if not errors:
        try:
            PLC(program)
            parse_program(items)
        except (LadderError, IndexError, KeyError, ValueError) as e:
            errors.append((0, "程式結構有問題：%s" % e))
    return items, program, errors


# ---------------------------------------------------------------- run
from plants import Cylinder, make as make_plant   # noqa: E402  (Cylinder kept for older imports)


class Rig(object):
    """One program on the PLC, with the exercise's machine. Used by the grader and by the free-run panel."""

    def __init__(self, exercise, program):
        self.ex = exercise
        self._program = program
        self.plc = PLC(program, scan_ms=SCAN)
        self.plant = make_plant(exercise.get("plant"), self.plc)
        self.ms = 0
        self.broken = None

    def set(self, dev, value):
        self.plc.x_in[int(normalize(dev)[1:], 8)] = 1 if value else 0

    def scan(self):
        self.plc.scan(SCAN)
        if self.plant:
            self.plant.step(SCAN)
        self.ms += SCAN
        for kind, a, b, why in self.ex.get("rules", []):
            if self.broken is not None:
                break
            if kind == "never_both" and bit(self.plc, a) and bit(self.plc, b):
                self.broken = "%.2f 秒時 %s 和 %s 同時 ON：%s" % (self.ms / 1000.0, a, b, why)
            elif kind == "plant_flag" and self.plant is not None and getattr(self.plant, a, False):
                self.broken = "%.2f 秒時%s" % (self.ms / 1000.0, why)

    def run(self, ms):
        for _ in range(int(ms) // SCAN):
            self.scan()

    def power_cycle(self, off_ms=0):
        """Power failure: the PLC restarts (memory not latched is cleared), the machine keeps its position.
        While the power is off nothing is driven, so memory valves finish their stroke and closed-centre valves stop."""
        inputs = list(self.plc.x_in)
        program = self._program
        dead = PLC(program, scan_ms=SCAN)
        dead.x_in[:] = inputs
        if self.plant:
            self.plant.plc = dead                      # outputs all OFF while the power is off
            for _ in range(int(off_ms) // SCAN):
                self.plant.step(SCAN)
        old = self.plc
        self.plc = PLC(program, scan_ms=SCAN)
        self.plc.x_in[:] = dead.x_in
        keep = self.ex.get("latched", {})                 # battery / EEPROM backed ranges of the CPU
        for lo, hi in [keep["S"]] if "S" in keep else []:
            self.plc.s[lo:hi + 1] = old.s[lo:hi + 1]
        for lo, hi in [keep["M"]] if "M" in keep else []:
            self.plc.m[lo:hi + 1] = old.m[lo:hi + 1]
        for lo, hi in [keep["D"]] if "D" in keep else []:
            self.plc.d[lo:hi + 1] = old.d[lo:hi + 1]
        if self.plant:
            self.plant.plc = self.plc
            self.plant.apply()

    TOGETHER_MS = 50      # turning ON within this time counts as "at the same time" (an interlock may delay one by a scan)

    def record_sequence(self, ms, devices):
        """Runs ms and returns the order in which the devices turned ON; devices turning ON within TOGETHER_MS of the
        first one of a group are joined with + (in the order of devices)."""
        prev = {d: int(bool(bit(self.plc, d))) for d in devices}
        groups, start = [], None
        for _ in range(int(ms) // SCAN):
            self.scan()
            now = {d: int(bool(bit(self.plc, d))) for d in devices}
            rising = [d for d in devices if now[d] and not prev[d]]
            if rising:
                if groups and start is not None and self.ms - start <= self.TOGETHER_MS and not set(rising) & groups[-1]:
                    groups[-1] |= set(rising)
                else:
                    groups.append(set(rising))
                    start = self.ms
            prev = now
        return ["+".join(d for d in devices if d in g) for g in groups]


def _label(ex, dev):
    for name, label, *_ in ex.get("inputs", []) + [(o[0], o[1]) for o in ex.get("outputs", [])]:
        if name == dev:
            return "%s（%s）" % (dev, label)
    return dev


def _onoff(v):
    return "ON" if v else "OFF"


def run_test(ex, program, steps):
    """None when it passes, else the reason in plain words."""
    rig = Rig(ex, program)
    for s in steps:
        kind = s[0]
        if kind == "set":
            rig.set(s[1], s[2])
        elif kind == "wait":
            rig.run(s[1])
        elif kind == "stuck":
            if rig.plant:
                rig.plant.stuck = s[1]
        elif kind == "fault":
            if rig.plant:
                rig.plant.set_fault(s[1], s[2])
        elif kind == "power_cycle":
            rig.power_cycle(s[1] if len(s) > 1 else 0)
        elif kind == "sequence":
            got = rig.record_sequence(s[1], s[3])
            if got[:len(s[2])] != s[2]:
                names = dict((d, _label(ex, d)) for d in s[3])
                return "動作順序不對。應該是：%s；實際是：%s。" % (" → ".join("+".join(names[d] for d in g.split("+")) for g in s[2]),
                                                       " → ".join("+".join(names[d] for d in g.split("+")) for g in got[:len(s[2]) + 2]) or "沒有動作")
        elif kind == "never_while":
            dev, conds, ms, why = s[1], s[2], s[3], s[4]
            for _ in range(ms // SCAN):
                rig.scan()
                if bit(rig.plc, dev) and not all(int(bool(bit(rig.plc, c))) == v for c, v in conds):
                    return "%.2f 秒時 %s ON：%s" % (rig.ms / 1000.0, _label(ex, dev), why)
        elif kind == "is":
            now = int(bool(bit(rig.plc, s[1])))
            if now != s[2]:
                return "%.2f 秒時 %s 應該是 %s，實際是 %s。" % (rig.ms / 1000.0, _label(ex, s[1]), _onoff(s[2]), _onoff(now))
        elif kind == "one_of":                     # exactly one of these devices is ON
            on = [d for d in s[1].split() if bit(rig.plc, d)]
            if len(on) != 1:
                return "%.2f 秒時應該剛好一顆亮，實際亮的是：%s。" % (rig.ms / 1000.0, "、".join(_label(ex, d) for d in on) or "沒有")
        elif kind == "d":
            now = word(rig.plc, s[1])
            if now != s[2]:
                return "%.2f 秒時 %s 應該是 %d，實際是 %d。" % (rig.ms / 1000.0, s[1], s[2], now)
        elif kind == "stays":
            for _ in range(s[3] // SCAN):
                rig.scan()
                now = int(bool(bit(rig.plc, s[1])))
                if now != s[2]:
                    return "%.2f 秒時 %s 變成 %s，這段時間應該一直是 %s。" % (rig.ms / 1000.0, _label(ex, s[1]), _onoff(now), _onoff(s[2]))
        elif kind == "toggles":
            prev, count = bit(rig.plc, s[1]), 0
            for _ in range(s[2] // SCAN):
                rig.scan()
                now = bit(rig.plc, s[1])
                count += 1 if now != prev else 0
                prev = now
            if not s[3] <= count <= s[4]:
                return "%.1f 秒內 %s 變化了 %d 次，應該在 %d～%d 次之間。" % (s[2] / 1000.0, _label(ex, s[1]), count, s[3], s[4])
        if rig.broken:
            return "安全條件違反（先修這一個，其他項目常常會跟著通過）：" + rig.broken
    rig.run(0)
    return ("安全條件違反（先修這一個，其他項目常常會跟著通過）：" + rig.broken) if rig.broken else None


def grade(ex, text):
    items, program, errors = compile_il(text)
    if errors:
        return {"compiled": False, "errors": [{"line": n, "msg": m} for n, m in errors], "results": [], "passed": False}
    used = " ".join(" ".join(i[2]) for i in items)
    results = []
    for dev in ex.get("forbid", []):
        if dev in used:
            results.append({"name": "不能使用 %s" % dev, "ok": False, "why": "這題要自己用計時器做，不能用 %s。" % dev})
    for name, steps in ex["tests"]:
        why = run_test(ex, program, steps)
        results.append({"name": name, "ok": why is None, "why": why or ""})
    return {"compiled": True, "errors": [], "results": results, "passed": all(r["ok"] for r in results)}


SANDBOX = {"id": "FREE", "lesson": "", "free": True, "title": "自由練習",
           "task": "沒有題目，想寫什麼就寫什麼。X0～X7 都可以按，Y0～Y7 都會亮。寫好按「分享」產生連結，別人打開就能直接執行你的程式。",
           "inputs": [("X%03o" % i, "按鈕 X%o" % i, "hold") for i in range(4)] + [("X%03o" % i, "開關 X%o" % i, "toggle") for i in range(4, 8)],
           "outputs": [("Y%03o" % i, "輸出 Y%o" % i) for i in range(8)],
           "starter": "; 自由練習：X0～X3 是按鈕，X4～X7 是開關\nLD X000\nOUT Y000\n", "hints": [], "solution": "", "tests": []}


def by_id(eid):
    if eid == "FREE":
        return SANDBOX
    return next(e for e in EXERCISES if e["id"] == eid)
