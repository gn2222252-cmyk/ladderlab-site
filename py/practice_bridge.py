# -*- coding: utf-8 -*-
"""Practice page glue: compile the learner's text, free-run it with the exercise's machine, grade it."""
import base64
import json
import os
import tempfile

from bridge import _tree
from exercises import EXERCISES, Rig, by_id, compile_il, grade
from ladder_view import Rung, bit, conducts, parse_program, rung_power
from plc_csv import LadderError, csv_bytes, load_csv, plc_info
from sfc import build_json


def catalog():
    return json.dumps([{"id": e["id"], "title": e["title"], "lesson": e["lesson"], "free": e["free"], "exam": e.get("exam", False)}
                       for e in EXERCISES],
                      ensure_ascii=False)


class Practice(object):
    def __init__(self):
        self.ex = None
        self.rig = None
        self.rungs = []
        self.leaves = []

    def load(self, eid):
        self.ex = by_id(eid)
        self.rig, self.rungs, self.leaves = None, [], []
        e = self.ex
        meta = {k: e.get(k) for k in ("id", "title", "task", "inputs", "outputs", "plant", "starter", "hints", "lesson", "free")}
        meta["rules"] = [r[3] for r in e.get("rules", [])]
        meta["tests"] = [t[0] for t in e["tests"]]
        meta["forbid"] = e.get("forbid", [])
        from plants import faults_of
        meta["faults"] = faults_of(e.get("plant"))
        return json.dumps(meta, ensure_ascii=False)

    def solution(self):
        return self.ex["solution"]

    def compile(self, text):
        """Builds the ladder and restarts the machine. Returns errors and the rung layout."""
        items, program, errors = compile_il(text)
        if errors:
            self.rig = None
            return json.dumps({"errors": [{"line": n, "msg": m} for n, m in errors], "rungs": []}, ensure_ascii=False)
        self.items = items
        self.rungs, _ = parse_program(items)
        self.leaves = []
        layout = []
        for r in self.rungs:
            if isinstance(r, Rung):
                layout.append({"k": "r", "sec": "", "para": "", "state": r.state, "cond": _tree(r.cond, self.leaves),
                               "out": [[op] + list(ops) for op, ops in r.outputs]})
            else:
                layout.append({"k": r[0], "state": r[1] if r[0] == "stl" else None})
        self.rig = Rig(self.ex, program)
        return json.dumps({"errors": [], "rungs": layout}, ensure_ascii=False)

    def sfc(self):
        return build_json(getattr(self, "items", []), {})

    def import_csv(self, b64):
        """A GX Works2 program CSV (base64) to instruction list text."""
        data = base64.b64decode(b64)
        path = os.path.join(tempfile.gettempdir(), "ll_import.csv")
        with open(path, "wb") as f:
            f.write(data)
        try:
            program = load_csv(path)
        except (LadderError, UnicodeDecodeError, ValueError) as e:
            return json.dumps({"ok": False, "msg": str(e)}, ensure_ascii=False)
        lines = [" ".join([op] + list(ops)) for _, op, ops in program if op != "END"]
        return json.dumps({"ok": True, "il": "\n".join(lines), "plc": plc_info(data), "count": len(lines)}, ensure_ascii=False)

    def export_csv(self, text):
        """The learner's program as a GX Works2 style CSV (base64). Errors give an empty string."""
        items, program, errors = compile_il(text)
        if errors:
            return ""
        return base64.b64encode(csv_bytes([(op, ops) for _, op, ops in items])).decode("ascii")

    def set_input(self, dev, value):
        if self.rig:
            self.rig.set(dev, value)

    def toggle(self, dev):
        if self.rig:
            n = int(dev[1:], 8)
            self.rig.plc.x_in[n] = 0 if self.rig.plc.x_in[n] else 1

    def stuck(self, on):
        if self.rig and self.rig.plant:
            self.rig.plant.stuck = bool(on)

    def set_fault(self, key, on):
        if self.rig and self.rig.plant:
            self.rig.plant.set_fault(key, bool(on))

    def tick(self, ms):
        if self.rig:
            self.rig.run(ms)

    def state(self):
        if not self.rig:
            return json.dumps(None)
        p, e = self.rig.plc, self.ex
        power, coils = [], []
        for r in self.rungs:
            if isinstance(r, Rung):
                power.append(1 if rung_power(p, r) else 0)
                coils.append([1 if op in ("OUT", "SET") and ops and ops[0][0] in "YMS" and bit(p, ops[0]) else 0
                              for op, ops in r.outputs])
            else:
                power.append(1 if r[0] == "stl" and bit(p, r[1]) else 0)
                coils.append([])
        return json.dumps({
            "inputs": {d: p.x_in[int(d[1:], 8)] for d, _, _ in e["inputs"]},
            "outputs": {d: p.y_out[int(d[1:], 8)] for d, _ in e["outputs"]},     # the terminals (M8034 turns them OFF)
            "leaves": "".join("1" if conducts(p, x) else "0" for x in self.leaves),
            "power": power, "coils": coils, "steps": ["S%d" % s for s in p.active_states()],
            "plant": self.rig.plant.state() if self.rig.plant else None,
            "broken": self.rig.broken, "time": self.rig.ms, "d0": p.d[0]})

    def grade(self, text):
        return json.dumps(grade(self.ex, text), ensure_ascii=False)
