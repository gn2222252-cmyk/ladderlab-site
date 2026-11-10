# -*- coding: utf-8 -*-
"""Program health check page glue: text or GX Works2 CSV in, report JSON out."""
import base64
import json
import os
import tempfile

from analyzer import analyze
from exercises import compile_il, normalize
from plc_csv import LadderError, load_csv, plc_info

HERE = os.path.dirname(os.path.abspath(__file__))


def _items(text):
    """Accepts any instruction list (no exercise limits), keeps the editor line numbers."""
    out, errors = [], []
    for number, raw in enumerate(text.splitlines(), 1):
        code = raw.split(";", 1)[0].strip().upper()
        if not code:
            continue
        w = code.split()
        if w[0] == "END":
            continue
        out.append((number, w[0], [normalize(x) for x in w[1:]]))
    _, _, errs = compile_il(text)
    errors = [{"line": n, "msg": m} for n, m in errs]
    return out, errors


def check_text(text, cpu="FX3S"):
    items, errors = _items(text)
    report = analyze(items, cpu, _comments(text))
    report["errors"] = errors
    return json.dumps(report, ensure_ascii=False)


OUT_WORDS = {"OUT": "讓 %s ON", "SET": "鎖定 %s ON", "RST": "清除 %s", "PLS": "讓 %s ON 一個掃描", "PLF": "放開時讓 %s ON 一個掃描",
             "INC": "%s 加 1", "ZRST": "整批清除 %s"}


def _out_text(op, ops, comments):
    name = lambda d: "%s（%s）" % (d, comments[d]) if comments.get(d) else d
    if op == "OUT" and len(ops) == 2:
        return "%s 計時／計數，設定 %s" % (name(ops[0]), ops[1])
    if op == "MOV":
        return "把 %s 複製到 %s" % (ops[0], name(ops[1]))
    if op in ("ADD", "SUB"):
        return "%s = %s %s %s" % (name(ops[2]), ops[0], "+" if op == "ADD" else "-", ops[1])
    if op == "ZRST":
        return "整批清除 %s～%s" % (ops[0], ops[1])
    if op in ("SET", "OUT") and ops and ops[0][0] == "S" and ops[0][1:].isdigit():
        return ("換到步 %s" if op == "SET" else "跳到步 %s") % name(ops[0])
    if op in OUT_WORDS and ops:
        return OUT_WORDS[op] % name(ops[0])
    return " ".join([op] + list(ops))


def explain_doc(text):
    """Rung-by-rung plain-language description (deterministic, no AI)."""
    from ladder_view import Rung, describe, parse_program
    items, _ = _items(text)
    src = [("ins", op, ops) for _, op, ops in items]
    lines = [n for n, _, _ in items]
    comments = _comments(text)
    try:
        rungs, _ = parse_program(src)
    except (IndexError, KeyError, ValueError) as e:
        return json.dumps({"ok": False, "msg": "程式結構無法解析：%s" % e}, ensure_ascii=False)
    out, state = [], None
    for r in rungs:
        if not isinstance(r, Rung):
            if r[0] == "stl":
                state = r[1]
                out.append({"kind": "step", "text": "── 步 %s %s ──" % (r[1], comments.get(r[1], ""))})
            elif r[0] == "ret":
                state = None
                out.append({"kind": "step", "text": "── 步進區結束（RET），以下每個掃描都執行 ──"})
            continue
        first = lines[r.first] if r.first < len(lines) else 0
        cond = describe(r.cond, comments) if r.cond is not None else "（步進中直接執行）"
        outs = "、".join(_out_text(op, ops, comments) for op, ops in r.outputs)
        out.append({"kind": "rung", "line": first, "state": state, "text": "當 %s → %s" % (cond, outs)})
    return json.dumps({"ok": True, "rungs": out}, ensure_ascii=False)


def io_csv(text):
    """I/O table as CSV text (UTF-8 with BOM so Excel opens Chinese correctly)."""
    report = json.loads(check_text(text))
    rows = ["元件,註解,寫入方式,寫入（行）,讀取（行）"]
    for d in report["devices"]:
        rows.append('%s,"%s",%s,"%s","%s"' % (d["dev"], d["comment"].replace('"', "'"), "/".join(d["how"]),
                                               " ".join(map(str, d["writes"])), " ".join(map(str, d["reads"]))))
    return "\ufeff" + "\r\n".join(rows) + "\r\n"


def csv_to_text(b64):
    data = base64.b64decode(b64)
    path = os.path.join(tempfile.gettempdir(), "ll_check.csv")
    with open(path, "wb") as f:
        f.write(data)
    try:
        program = load_csv(path)
    except (LadderError, UnicodeDecodeError, ValueError) as e:
        return json.dumps({"ok": False, "msg": str(e)}, ensure_ascii=False)
    lines = [" ".join([op] + list(ops)) for _, op, ops in program if op != "END"]
    return json.dumps({"ok": True, "text": "\n".join(lines), "plc": plc_info(data)}, ensure_ascii=False)


def sample(name):
    path = os.path.join(HERE, {"gantry": "GANTRY_8Y.csv", "aoi": "AOI_PLC.csv"}[name])
    return "\n".join(" ".join([op] + list(ops)) for _, op, ops in load_csv(path) if op != "END")


def _bare(text):
    return [" ".join(l.split(";", 1)[0].upper().split()) for l in str(text).splitlines() if l.split(";", 1)[0].strip()]


def _comments(text=""):
    """The gantry's device comments, only for the gantry sample itself: someone else's program would get wrong names
    (tester round 4: X000 labelled as a gantry position)."""
    out = {}
    if _bare(text) != _bare(sample("gantry")):
        return out
    try:
        from devices import table_sync
        out.update({r[0]: r[1] for r in table_sync()})
    except ImportError:
        pass
    return out
