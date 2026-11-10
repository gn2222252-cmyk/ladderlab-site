# -*- coding: utf-8 -*-
"""Glue between the soft PLC and the browser page. Runs in Pyodide and in plain Python (tests).
Everything returned to the page is a JSON string, so the JavaScript side never holds Python objects."""
import json
import os

from devices import table_sync
from gantry_sim import Machine
from ladder_view import (RELATION, Compare, Contact, Parallel, Rung, Series, bit, blockers, conducts, describe,
                         leaf_name, parse_program, read_source, rung_power, word)
from plc_csv import load_csv
from plc_engine import PLC

HERE = os.path.dirname(os.path.abspath(__file__))
COMMANDS = {"start": 1, "stop": 2, "home": 4, "reset": 8}
COMMENTS = {"zh": {r[0]: r[1] for r in table_sync()}, "en": {r[0]: r[2] for r in table_sync()}}
COMMENTS["zh"].update({"M8000": "RUN 中常 ON", "M8002": "開機第一掃描", "M8013": "1 秒時脈"})
COMMENTS["en"].update({"M8000": "Always ON in RUN", "M8002": "First scan", "M8013": "1 s clock"})


def _tree(node, leaves):
    if node is None:
        return None
    if isinstance(node, Series):
        return {"t": "s", "i": [_tree(n, leaves) for n in node.items]}
    if isinstance(node, Parallel):
        return {"t": "p", "i": [_tree(n, leaves) for n in node.items]}
    leaves.append(node)
    if isinstance(node, Compare):
        return {"t": "cmp", "r": RELATION[node.relation], "a": node.a, "b": node.b, "k": len(leaves) - 1}
    return {"t": "c", "n": node.name, "neg": node.negated, "e": getattr(node, "edge", ""), "k": len(leaves) - 1}


class Lab(object):
    def __init__(self, parts=6):
        self.program = load_csv(os.path.join(HERE, "GANTRY_8Y.csv"))
        self.rungs, _ = parse_program(read_source())
        self.leaves = []
        self.layout = []
        for r in self.rungs:
            if isinstance(r, Rung):
                self.layout.append({"k": "r", "sec": r.section, "para": r.para, "state": r.state,
                                    "cond": _tree(r.cond, self.leaves),
                                    "out": [[op] + list(ops) for op, ops in r.outputs]})
            else:
                self.layout.append({"k": r[0], "state": r[1] if r[0] == "stl" else None,
                                    "sec": r[2] if r[0] == "stl" else r[1]})
        self.reset(parts)

    def reset(self, parts=6):
        self.plc = PLC(self.program)
        self.m = Machine(self.plc, board=False)
        for i in range(parts):
            self.m.add_part("front", -i * 160.0)
        self.run(100)

    def run(self, ms):
        for _ in range(int(ms) // 10):
            self.m.apply_inputs()
            self.plc.scan(10)
            self.m.step(10)

    def command(self, name):
        if name in COMMANDS:
            self.plc.d[106] = COMMANDS[name]
        elif name == "estop":
            self.m.press("X013", 0)
        elif name == "estop_release":
            self.m.press("X013", 1)
        elif name == "auto":
            self.m.press("X010", 1)
        elif name == "manual":
            self.m.press("X010", 0)
        elif name == "add_part":
            self.m.add_part("front", 0.0)

    def fault(self, sensor, value=None):
        """Force a sensor: 0 or 1 sticks it, None releases it."""
        if value is None:
            self.m.force.pop(sensor, None)
        else:
            self.m.force[sensor] = int(value)

    def layout_json(self):
        return json.dumps({"rungs": self.layout, "comments": COMMENTS}, ensure_ascii=False)

    def state(self):
        p, m = self.plc, self.m
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
            "x": [p.x[i] for i in range(11)], "y": [p.y_out[i] for i in range(8)],
            "steps": ["S%d" % s for s in p.active_states()],
            "d": {str(k): p.d[k] for k in (200, 201, 202, 210, 211, 212, 220)},
            "alarm": bool(p.m[2] or p.m[3]), "homed": bool(p.m[20]),
            "left": {"axis": m.left.axis, "z": m.left.z, "vac": m.left.vacuum},
            "right": {"axis": m.right.axis, "z": m.right.z, "vac": m.right.vacuum},
            "parts": [[q["id"], q["on"], q["pos"]] for q in m.parts], "placed": m.placed,
            "estop": not m.buttons["X013"], "auto": bool(m.buttons["X010"]), "force": m.force,
            "power": power, "leaves": "".join("1" if conducts(p, l) else "0" for l in self.leaves),
            "coils": coils, "time": p.clock_ms})

    def explain(self, index, lang="zh"):
        r = self.rungs[index]
        if not isinstance(r, Rung):
            return ""
        c, p = COMMENTS[lang], self.plc
        if lang == "zh":
            lines = ["條件：" + describe(r.cond, c) + "。"]
            if r.state and not bit(p, r.state):
                lines.append("現在不動作：它屬於步序 %s，這一步沒有作用。" % r.state)
            elif rung_power(p, r):
                lines.append("現在條件成立，通電中。")
            else:
                lines.append("現在不通，卡在：" + "；".join(self._why(r, c, "要", "現在是 %d 和 %d")))
            return "\n".join(lines)

        def desc(node):
            if node is None:
                return "always true"
            if isinstance(node, Series):
                return " AND ".join("(%s)" % desc(n) if isinstance(n, Parallel) else desc(n) for n in node.items)
            if isinstance(node, Parallel):
                return " OR ".join(desc(n) for n in node.items)
            name = leaf_name(node, c)
            return ("NOT " + name) if isinstance(node, Contact) and node.negated else name
        lines = ["Condition: " + desc(r.cond) + "."]
        if r.state and not bit(p, r.state):
            lines.append("Not running: it belongs to step %s, which is not active." % r.state)
        elif rung_power(p, r):
            lines.append("The condition is true, the rung is powered.")
        else:
            lines.append("Blocked by: " + "; ".join(self._why(r, c, "must be", "is now %d and %d")))
        return "\n".join(lines)

    def _why(self, r, c, need, values):
        out = []
        for leaf in blockers(self.plc, r.cond):
            if isinstance(leaf, Contact):
                out.append("%s %s %s" % (leaf_name(leaf, c), need, "OFF" if leaf.negated else "ON"))
            else:
                out.append("%s %s" % (leaf_name(leaf, c), values % (word(self.plc, leaf.a), word(self.plc, leaf.b))))
        return out
