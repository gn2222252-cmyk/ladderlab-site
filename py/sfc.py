# -*- coding: utf-8 -*-
"""Turns a step ladder (STL) program into an SFC chart description, the way GX Works2 shows it:
a ladder block (everything outside STL..RET, e.g. M8002 -> SET S0), then steps and transitions.

On FX the SFC program is downloaded as STL instructions, so the chart and the STL text are the same program.
  step        one STL block (consecutive STL = parallel convergence: several steps form one block)
  action      a rung inside the block that does not move to another step
  transition  a rung inside the block that SETs (or OUTs, for a jump) another S
              one transition with several targets = parallel divergence
              several transitions in one block = selection divergence
"""
import json

from ladder_view import Compare, Contact, Parallel, Rung, Series, parse_program
from ladder_view import RELATION


def cond_text(node, comment=None):
    comment = comment or {}
    if node is None:
        return "（無條件）"
    if isinstance(node, Series):
        return " 且 ".join("(%s)" % cond_text(n, comment) if isinstance(n, Parallel) else cond_text(n, comment) for n in node.items)
    if isinstance(node, Parallel):
        return " 或 ".join(cond_text(n, comment) for n in node.items)
    if isinstance(node, Compare):
        return "%s %s %s" % (node.a, RELATION[node.relation], node.b)
    name = node.name
    return ("非 " if node.negated else "") + name


def _is_move(op, ops):
    return op in ("SET", "OUT") and ops and ops[0].startswith("S") and ops[0][1:].isdigit()


def build(items, comment=None):
    """items: ladder_view source items. Returns a dict (see module doc). Indices are rung indices of parse_program."""
    rungs, _ = parse_program(items)
    ladder, blocks, cur, last_was_stl = [], [], None, False
    for i, r in enumerate(rungs):
        if not isinstance(r, Rung):
            kind = r[0]
            if kind == "stl":
                if cur is not None and last_was_stl:
                    cur["states"].append(r[1])          # STL S22 / STL S42: one block
                else:
                    cur = {"states": [r[1]], "actions": [], "transitions": [], "at": i}
                    blocks.append(cur)
                last_was_stl = True
            else:
                cur, last_was_stl = None, False
            continue
        last_was_stl = False
        if cur is None:
            ladder.append({"r": i, "text": cond_text(r.cond, comment) + " → " + "、".join(" ".join([op] + ops) for op, ops in r.outputs)})
            continue
        moves = [ops[0] for op, ops in r.outputs if _is_move(op, ops)]
        others = [" ".join([op] + ops) for op, ops in r.outputs if not _is_move(op, ops)]
        if moves:
            cur["transitions"].append({"r": i, "cond": cond_text(r.cond, comment), "to": moves, "also": others,
                                       "jump": any(op == "OUT" for op, ops in r.outputs if _is_move(op, ops))})
        else:
            cur["actions"].append({"r": i, "cond": cond_text(r.cond, comment) if r.cond is not None else "",
                                   "do": others})
    starts = sorted({t for l in ladder for t in _targets(rungs[l["r"]])})
    return {"ladder": ladder, "blocks": blocks, "initial": starts}


def _targets(rung):
    return [ops[0] for op, ops in rung.outputs if _is_move(op, ops)]


def build_json(items, comment=None):
    return json.dumps(build(items, comment), ensure_ascii=False)
