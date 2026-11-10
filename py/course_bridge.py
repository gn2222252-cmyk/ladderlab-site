# -*- coding: utf-8 -*-
"""Lesson player glue for the browser. Wraps learn.Runner (the same class the desktop window and the tests use),
so a lesson behaves exactly as test_lessons.py proves. Everything returned to the page is a JSON string."""
import json

import learn
from bridge import _tree
from ladder_view import Rung, bit, conducts, explain, rung_power, word
from exercises import EXERCISES
from lessons import COMMENT, LESSONS
from sfc import build_json
from quiz import questions_json

from course_map import CHAPTERS, chapter_of_lesson, lesson_number, lesson_order
from lesson_guide import GUIDE

# Chapters of the main course line, used as the lesson list's groups (only the ones that hold lessons).
TRACKS = [(c["id"], "第 %s 章　%s" % (c["id"], c["t"]), "Chapter %s" % c["id"]) for c in CHAPTERS]


def lesson_id(lesson):
    return lesson["title"].split(" ", 1)[0]


def lesson_name(lesson):
    return lesson["title"].split(" ", 1)[1]


def track_of(lesson):
    c, _ = chapter_of_lesson(lesson_id(lesson))
    return c["id"] if c else "?"


def catalog():
    """Lessons in course order. 'i' is still the index in LESSONS (what load() takes)."""
    index = {lesson_id(l): i for i, l in enumerate(LESSONS)}
    out = []
    for lid in lesson_order():
        l = LESSONS[index[lid]]
        out.append({"i": index[lid], "id": lid, "no": lesson_number(lid), "name": lesson_name(l), "track": track_of(l)})
    practice = [{"id": e["id"], "title": e["title"], "lesson": e["lesson"]} for e in EXERCISES]
    chapters = [{"id": c["id"], "t": c["t"], "why": c["why"], "can": c["can"]} for c in CHAPTERS]
    return json.dumps({"tracks": [{"id": t, "zh": zh, "en": en} for t, zh, en in TRACKS], "lessons": out,
                       "practice": practice, "chapters": chapters}, ensure_ascii=False)


class Course(object):
    def __init__(self):
        self.index = 0
        self.lesson = None
        self.run = None
        self.layout = []

    # ---- loading ------------------------------------------------------
    def load(self, index):
        self.index = int(index)
        self.lesson = LESSONS[self.index]
        return self._start(self.lesson)

    def stage(self, name):
        return self._start(dict(self.lesson, il=self.lesson["stages"][name]))

    def _start(self, lesson):
        slow = self.run.slow if self.run is not None else False
        self.run = learn.Runner(lesson)
        self.run.slow = slow
        self.leaves = []
        self.layout = []
        for r in self.run.rungs:
            if isinstance(r, Rung):
                self.layout.append({"k": "r", "sec": r.section, "para": r.para, "state": r.state,
                                    "cond": _tree(r.cond, self.leaves),
                                    "out": [[op] + list(ops) for op, ops in r.outputs]})
            else:
                self.layout.append({"k": r[0], "state": r[1] if r[0] == "stl" else None})
        l = self.lesson
        comment = dict(COMMENT)
        comment.update(l.get("comment", {}))
        self.comment = comment
        meta = {k: l.get(k) for k in ("title", "text", "inputs", "outputs", "table", "dtd", "notes", "sfc", "values", "watch",
                                      "conflict", "plant", "hold", "demo", "check", "latched", "panel")}
        meta["trace"] = [c[0] for c in l.get("trace", [])]
        meta["stages"] = sorted(l.get("stages", {}).keys())
        meta["id"] = lesson_id(l)
        meta["track"] = track_of(l)
        meta["no"] = lesson_number(meta["id"])
        meta["name"] = lesson_name(l)
        meta["guide"] = GUIDE.get(meta["id"])
        meta["il"] = lesson["il"]
        return json.dumps({"lesson": meta, "rungs": self.layout, "comments": {"zh": comment, "en": comment}},
                          ensure_ascii=False)

    # ---- operating ----------------------------------------------------
    def set_input(self, name, value):
        self.run.set_input(name, 1 if value else 0)

    def power_cycle(self):
        self.run.power_cycle()

    def toggle(self, name):
        self.run.set_input(name, 0 if self.run.get_input(name) else 1)

    def set_slow(self, on):
        self.run.slow = bool(on)

    def tick(self, ms):
        self.run.tick(float(ms))

    def slow_step(self):
        self.run.slow_step()

    def finish_scan(self):
        """Slow motion: run to the end of the scan that is under way."""
        guard = 0
        while self.run.scanner is not None and guard < 2000:
            self.run.slow_step()
            guard += 1

    def reset_trace(self):
        self.run.round, self.run.trace_rows = 0, []

    def reached(self, until):
        return self.run.last == until

    def scanning(self):
        return self.run.scanner is not None

    def quiz(self):
        return questions_json(lesson_id(self.lesson))

    def sfc(self):
        return build_json(self.run.items, self.comment)

    def explain(self, index):
        r = self.run.rungs[int(index)]
        return explain(r, self.run.plc, self.comment) if isinstance(r, Rung) else ""

    def check(self):
        """[(device, wanted, now)] for the lesson's end-of-demo check."""
        return json.dumps([[d, int(bool(w)), int(bool(bit(self.run.plc, d)))] for d, w in self.lesson["check"]])

    # ---- state for drawing --------------------------------------------
    def _value(self, dev):
        if dev[0] in "DTC" and dev[1:].isdigit():
            return word(self.run.plc, dev)
        return int(bool(bit(self.run.plc, dev)))

    def state(self):
        run, p = self.run, self.run.plc
        cur = run.current_rung()
        cur_index = next((i for i, r in enumerate(run.rungs) if r is cur), -1) if cur is not None else -1
        power, coils = [], []
        for r in run.rungs:
            if isinstance(r, Rung):
                power.append(1 if rung_power(p, r) else 0)
                coils.append([1 if op in ("OUT", "SET") and ops and ops[0][0] in "YMS" and bit(p, ops[0]) else 0
                              for op, ops in r.outputs])
            else:
                power.append(1 if r[0] == "stl" and bit(p, r[1]) else 0)
                coils.append([])
        l = self.lesson
        conflict = l.get("conflict")
        plant = None
        if run.plant is not None:
            plant = {"z": run.plant.z, "zb": run.plant.zb, "kind": l.get("plant"),
                     "vac": p.y_out[1] if l.get("plant") == "cylinder" else 0}
        return json.dumps({
            "inputs": {name: run.get_input(name) for name, _, _ in l["inputs"]},
            "outputs": {name: int(bool(bit(p, name))) for name, _ in l["outputs"]},
            "values": {d: self._value(d) for d, _ in l.get("values", [])},
            "watch": {d: self._value(d) for d, _ in l.get("watch", [])},
            "steps": ["S%d" % s for s in p.active_states()],
            "conflict": bool(conflict and bit(p, conflict[0]) and bit(p, conflict[1])),
            "leaves": "".join("1" if conducts(p, x) else "0" for x in self.leaves),
            "power": power, "coils": coils, "cur": cur_index, "scanning": run.scanner is not None,
            "phase": run.phase, "last": run.last if isinstance(run.last, int) or run.last is None else str(run.last),
            "trace": [[n, row] for n, row, _ in run.trace_rows], "plant": plant, "slow": run.slow,
            "time": p.clock_ms})
