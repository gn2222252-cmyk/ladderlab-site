# -*- coding: utf-8 -*-
"""Program health check for FX instruction lists: device cross reference and rule-based warnings.
Deterministic, no AI. Used by web/check.html (engineer tool) and by the tests on the real gantry and AOI programs.

Warnings (each with the line numbers involved):
  double_coil     the same Y/M driven by OUT in two places outside step ladder blocks (the later one wins)
  set_no_reset    SET on a device that is never RST/ZRST/OUT anywhere
  read_never_set  an M/S/T/C/D that is read but never written (and is not a special device)
  timer_reuse     the same timer coil in two places outside STL (two coils fight over one timer)
  no_initial      step ladder used but no M8002 -> SET S0..S9
  capacity        program steps above the CPU limit (FX3S: 4000)
  out_s_outside   OUT S outside STL (only a jump inside STL is valid)
"""
import re

from plc_csv import COMPARE_RE, PULSE_FORMS, instruction_steps

CAPACITY = {"FX3S": 4000, "FX3G": 32000, "FX3U": 64000}
READ_OPS = {"LD", "LDI", "AND", "ANI", "OR", "ORI", "LDP", "LDF", "ANDP", "ANDF", "ORP", "ORF"}
SPECIAL = re.compile(r"^M8\d{3}$|^D8\d{3}$")
DEV = re.compile(r"^([XYMSTCD])(\d+)$")
WORD_BITS = re.compile(r"^K(\d)([XYMS])(\d+)$")


def _norm(dev):
    m = re.match(r"^([XY])([0-7]+)$", dev)
    return "%s%03d" % (m.group(1), int(m.group(2))) if m else dev


def _expand_range(a, b):
    ma, mb = DEV.match(a), DEV.match(b)
    if not ma or not mb or ma.group(1) != mb.group(1):
        return []
    base = 8 if ma.group(1) in "XY" else 10
    lo, hi = int(ma.group(2), base), int(mb.group(2), base)
    if hi - lo > 2000:
        return []
    fmt = (lambda n: "%s%03o" % (ma.group(1), n)) if base == 8 else (lambda n: "%s%d" % (ma.group(1), n))
    return [fmt(n) for n in range(lo, hi + 1)]


def analyze(items, cpu="FX3S", comments=None):
    """items: [(line, op, operands)]. Returns a report dict."""
    comments = comments or {}
    refs = {}                           # dev -> {"read": [lines], "write": [(line, op, in_stl)]}

    def ref(dev, kind, line, op=None, in_stl=False):
        dev = _norm(dev)
        r = refs.setdefault(dev, {"read": [], "write": [], "packed": []})
        if kind == "read":
            r["read"].append(line)
        elif kind == "packed":
            r["packed"].append(line)          # read as part of a K4M.. word: spare bits are normal
        else:
            r["write"].append((line, op, in_stl))

    steps, in_stl, uses_stl, initial = 0, False, False, False
    prev_ld_m8002 = False
    warnings = []
    for line, op, ops in items:
        steps += instruction_steps(op, ops)
        if op in PULSE_FORMS:
            op = op[:-1]                        # MOVP behaves like MOV for the cross reference
        compare = COMPARE_RE.match(op)
        if op == "STL":
            in_stl, uses_stl = True, True
            ref(ops[0], "read", line)
            continue
        if op == "RET":
            in_stl = False
            continue
        if op in READ_OPS:
            ref(ops[0], "read", line)
            prev_ld_m8002 = op == "LD" and ops[0] == "M8002" or (prev_ld_m8002 and op not in ("LD", "LDI", "LDP", "LDF"))
            continue
        if op == "MC":
            ref(ops[1], "write", line, "MC", in_stl)
            continue
        if op == "ALT":
            ref(ops[0], "read", line)
            ref(ops[0], "write", line, "ALT", in_stl)
            continue
        if op in ("MUL", "DIV"):
            for src in ops[:2]:
                if DEV.match(src):
                    ref(src, "read", line)
            m = DEV.match(ops[2])
            if m:
                ref(ops[2], "write", line, op, in_stl)
                ref("%s%d" % (m.group(1), int(m.group(2)) + 1), "write", line, op, in_stl)
            continue
        if compare:
            for o in ops:
                if DEV.match(o):
                    ref(o, "read", line)
            continue
        if op in ("OUT", "SET", "RST", "PLS", "PLF"):
            if op == "SET" and ops[0].startswith("S") and prev_ld_m8002 and int(ops[0][1:] or 99) <= 9:
                initial = True
            if op == "OUT" and ops[0][0] == "S" and not in_stl:
                warnings.append({"kind": "out_s_outside", "lines": [line], "dev": ops[0],
                                 "msg": "OUT %s 寫在步進區外面。OUT S 只能在 STL～RET 裡當跳躍；一般階梯圖要用 SET。" % ops[0]})
            ref(ops[0], "write", line, op, in_stl)
            if len(ops) > 1 and DEV.match(ops[1]):
                ref(ops[1], "read", line)
            continue
        if op in ("DRVI", "DRVA"):
            for o in ops[:2]:
                if DEV.match(o):
                    ref(o, "read", line)
            for o in ops[2:]:
                ref(o, "write", line, op, in_stl)
            continue
        if op in ("SFTL", "SFTR"):
            m = DEV.match(ops[1])
            if DEV.match(ops[0]):
                ref(ops[0], "read", line)
            if m:
                base = int(m.group(2), 8 if m.group(1) in "XY" else 10)
                for k in range(int(ops[2].lstrip("K"))):
                    ref(_bitname(m.group(1), base + k), "write", line, op, in_stl)
            continue
        if op in ("ROL", "ROR"):
            m = WORD_BITS.match(ops[0])
            if m:
                for k in range(int(m.group(1)) * 4):
                    ref(_bitname(m.group(2), int(m.group(3), 8 if m.group(2) in "XY" else 10) + k), "write", line, op, in_stl)
            elif DEV.match(ops[0]):
                ref(ops[0], "read", line)
                ref(ops[0], "write", line, op, in_stl)
            continue
        if op == "ZRST":
            for d in _expand_range(ops[0], ops[1]):
                ref(d, "write", line, "ZRST", in_stl)
            continue
        if op in ("MOV", "ADD", "SUB", "CMP", "ZCP", "INC", "DEC"):
            *srcs, dst = ops
            if op in ("INC", "DEC"):
                srcs, dst = ops, ops[0]
            for s in srcs:
                m = WORD_BITS.match(s)
                if m:
                    for k in range(int(m.group(1)) * 4):
                        ref(_bitname(m.group(2), int(m.group(3), 8 if m.group(2) in "XY" else 10) + k), "packed", line)
                elif DEV.match(s):
                    ref(s, "read", line)
            if op in ("CMP", "ZCP"):
                m = DEV.match(dst)
                if m:
                    base = int(m.group(2))
                    for k in range(3):
                        ref("%s%d" % (m.group(1), base + k), "write", line, op, in_stl)
                continue
            m = WORD_BITS.match(dst)
            if m:
                for k in range(int(m.group(1)) * 4):
                    ref(_bitname(m.group(2), int(m.group(3), 8 if m.group(2) in "XY" else 10) + k), "write", line, op, in_stl)
            elif DEV.match(dst):
                ref(dst, "write", line, op, in_stl)

    for dev, r in sorted(refs.items(), key=lambda kv: _sort_key(kv[0])):
        outs = [w for w in r["write"] if w[1] == "OUT" and not w[2] and dev[0] in "YMT"]
        if dev[0] in "YM" and len(outs) > 1:
            warnings.append({"kind": "double_coil", "dev": dev, "lines": [w[0] for w in outs],
                             "msg": "%s 在一般階梯圖被 OUT 了 %d 次（雙線圈），只有最後一次有效。" % (dev, len(outs))})
        if dev[0] == "T" and len(outs) > 1:
            warnings.append({"kind": "timer_reuse", "dev": dev, "lines": [w[0] for w in outs],
                             "msg": "計時器 %s 的線圈出現 %d 次，會互相干擾。" % (dev, len(outs))})
        sets = [w for w in r["write"] if w[1] == "SET"]
        clears = [w for w in r["write"] if w[1] in ("RST", "ZRST", "OUT")]
        if sets and not clears and dev[0] in "YM":
            warnings.append({"kind": "set_no_reset", "dev": dev, "lines": [w[0] for w in sets],
                             "msg": "%s 有 SET 但整個程式沒有 RST，一旦 ON 就永遠不會 OFF。" % dev})
        if r["read"] and not r["write"] and dev[0] in "MSTC" and not SPECIAL.match(dev):
            warnings.append({"kind": "read_never_set", "dev": dev, "lines": r["read"][:5],
                             "msg": "%s 有被讀取，但程式裡沒有任何地方寫入它（打錯編號？還是由上位機寫入？）。" % dev})
    if uses_stl and not initial:
        warnings.append({"kind": "no_initial", "dev": "S0", "lines": [],
                         "msg": "有用步進（STL），但沒找到 M8002 → SET S0～S9 啟動初始步。確認初始步有被打開，否則一步都不會動。"})
    limit = CAPACITY.get(cpu)
    if limit and steps > limit:
        warnings.append({"kind": "capacity", "dev": "", "lines": [],
                         "msg": "程式 %d 步，超過 %s 的 %d 步上限。" % (steps, cpu, limit)})

    io = []
    for dev, r in sorted(refs.items(), key=lambda kv: _sort_key(kv[0])):
        if dev[0] in "XY" or (dev[0] in "MSTCD" and not SPECIAL.match(dev)):
            if not r["read"] and not r["write"]:
                continue                       # only a spare bit inside a packed word
            io.append({"dev": dev, "comment": comments.get(dev, ""), "reads": r["read"], "writes": [w[0] for w in r["write"]],
                       "how": sorted({w[1] for w in r["write"]})})
    counts = {k: len([d for d in io if d["dev"][0] == k]) for k in "XYMSTCD"}
    return {"steps": steps, "cpu": cpu, "limit": limit, "instructions": len(items), "counts": counts, "devices": io,
            "warnings": warnings}


def _bitname(kind, n):
    return "%s%03o" % (kind, n) if kind in "XY" else "%s%d" % (kind, n)


def _sort_key(dev):
    m = DEV.match(dev)
    if not m:
        return ("Z", 0)
    base = 8 if m.group(1) in "XY" else 10
    return ("XYMSTCD".index(m.group(1)), int(m.group(2), base))
