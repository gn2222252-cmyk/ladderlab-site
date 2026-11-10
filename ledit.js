"use strict";
/* Graphical ladder editor, keyed like GX Works2: F5 open contact, F6 closed contact, Shift+F5/F6 parallel, Shift+F7/F8
   rising/falling contact, F7 coil, F8 application instruction, F9 horizontal line, Shift+F9 vertical line, Ctrl+F9 /
   Ctrl+F10 delete them, Delete, Enter edits, F4 converts. A rung is a grid: COLS contact columns plus one output column.
   The grid compiles to the instruction list the engine runs (LEdit.compile) and an instruction list loads back into
   a grid (LEdit.fromIL). Pure functions work in node too (tests). */
const LEdit = (() => {
  const COLS = 9;

  /* ---------------- model ---------------- */
  function newRung(rows) {
    rows = rows || 1;
    return { cells: Array.from({ length: rows }, () => Array(COLS).fill(null)),
      vl: Array.from({ length: rows }, () => Array(COLS + 1).fill(false)), out: Array(rows).fill(null), dirty: true };
  }
  function addRow(rg, at) {
    at = at === undefined ? rg.cells.length : at;
    rg.cells.splice(at, 0, Array(COLS).fill(null));
    rg.vl.splice(at, 0, Array(COLS + 1).fill(false));
    rg.out.splice(at, 0, null);
  }
  function delRow(rg, at) {
    if (rg.cells.length <= 1) { rg.cells[0] = Array(COLS).fill(null); rg.vl[0] = Array(COLS + 1).fill(false); rg.out[0] = null; return; }
    rg.cells.splice(at, 1); rg.vl.splice(at, 1); rg.out.splice(at, 1);
  }
  const clone = (x) => JSON.parse(JSON.stringify(x));

  /* ---------------- grid -> instruction list ---------------- */
  const T = { k: "T" };
  function AND(items) {
    const flat = [];
    for (const x of items) { if (!x || x.k === "T") continue; if (x.k === "A") flat.push(...x.i); else flat.push(x); }
    return flat.length === 0 ? T : flat.length === 1 ? flat[0] : { k: "A", i: flat };
  }
  function OR(items) {
    const flat = [];
    for (const x of items) { if (x.k === "T") return T; if (x.k === "O") flat.push(...x.i); else flat.push(x); }
    const seen = new Set(), uniq = flat.filter((x) => { const s = JSON.stringify(x); if (seen.has(s)) return false; seen.add(s); return true; });
    if (uniq.length === 1) return uniq[0];
    // factor shared first contacts: a·b + a·c + d·e -> a·(b + c) + d·e, so parallel blocks stay blocks (LD..OR..ANB)
    const lists = uniq.map((x) => (x.k === "A" ? x.i : [x])), groups = [];
    for (const l of lists) {
      const key = JSON.stringify(l[0]), g = groups.find((x) => x.key === key);
      if (g) g.rests.push(l.slice(1)); else groups.push({ key, first: l[0], rests: [l.slice(1)] });
    }
    if (groups.some((g) => g.rests.length > 1)) {
      const parts = groups.map((g) => (g.rests.length > 1 ? AND([g.first, OR(g.rests.map((r) => AND(r)))]) : AND([g.first, ...g.rests[0]])));
      return parts.length === 1 ? parts[0] : { k: "O", i: parts };
    }
    return { k: "O", i: uniq };
  }
  const CMP = /^(<>|>=|<=|=|>|<)\s*(\S+)\s+(\S+)$/;
  function mnemonic(cell, base) {           // base: LD | AND | OR
    if (cell.t === "cmp") { const m = CMP.exec(cell.d.trim()); return `${base}${m[1]} ${m[2]} ${m[3]}`; }
    const op = { no: base, nc: base === "LD" ? "LDI" : base === "AND" ? "ANI" : "ORI", p: base + "P", f: base + "F" }[cell.t];
    return `${op} ${cell.d}`;
  }
  function emit(e, out) {
    if (e.k === "L") { out.push(mnemonic(e.c, "LD")); return; }
    const join = e.k === "A" ? "AND" : "OR", block = e.k === "A" ? "ANB" : "ORB";
    emit(e.i[0], out);
    for (const it of e.i.slice(1)) {
      if (it.k === "L") out.push(mnemonic(it.c, join));
      else { emit(it, out); out.push(block); }
    }
  }
  function outLine(o) {
    if (o.op === "OUT") return `OUT ${o.a}${o.k ? " " + o.k : ""}`;
    return o.text.trim().replace(/\s+/g, " ");
  }
  /* One rung. Returns {lines, error}. tran: what a TRAN output turns into (SFC transitions). */
  function compileRung(rg, tran) {
    const R = rg.cells.length, W = COLS + 1, RAIL = R * W, parent = Array.from({ length: RAIL + 1 }, (_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
    for (let r = 0; r < R; r++) unite(r * W, RAIL);
    for (let r = 0; r < R - 1; r++) for (let b = 0; b <= COLS; b++) if (rg.vl[r][b]) unite(r * W + b, (r + 1) * W + b);
    const edges = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < COLS; c++) {
      const cell = rg.cells[r][c];
      if (cell) edges.push({ from: r * W + c, to: r * W + c + 1, cell });
    }
    const memo = new Map();
    const exprOf = (node) => {
      const root = find(node);
      if (root === find(RAIL)) return T;
      if (memo.has(root)) return memo.get(root);
      memo.set(root, null);
      const terms = [];
      for (const e of edges) {
        if (find(e.to) !== root) continue;
        const s = exprOf(e.from);
        if (s === null) continue;
        terms.push(AND([s, e.cell.t === "h" ? T : { k: "L", c: e.cell }]));
      }
      const v = terms.length ? OR(terms) : null;
      memo.set(root, v);
      return v;
    };
    const groups = [];
    for (let r = 0; r < R; r++) {
      const o = rg.out[r];
      if (!o) continue;
      const root = find(r * W + COLS), g = groups.find((x) => x.root === root);
      if (g) g.outs.push(o); else groups.push({ root, outs: [o], row: r });
    }
    const hasCell = rg.cells.some((row) => row.some(Boolean));
    if (!groups.length) return { lines: [], error: hasCell ? "這一條有接點，但沒有線圈或指令（右邊要有 F7 或 F8）" : null };
    const lines = [];
    for (const g of groups) {
      const e = exprOf(g.root);
      if (e === null) return { lines: [], error: `第 ${g.row + 1} 列的${g.outs[0].op === "OUT" ? "線圈" : "指令"}沒有接到左邊母線（線斷了，用 F9 補橫線）` };
      if (e.k !== "T") emit(e, lines);
      for (const o of g.outs) {
        if (o.op === "TRAN") { if (!tran) return { lines: [], error: "TRAN 只能用在 SFC 的移轉條件裡" }; lines.push(...tran); }
        else lines.push(outLine(o));
      }
    }
    return { lines, error: null };
  }
  function compile(rungs, tran) {
    const il = [], errors = [], lineRung = [];
    rungs.forEach((rg, i) => {
      const r = compileRung(rg, tran);
      if (r.error) errors.push({ rung: i, msg: r.error });
      r.lines.forEach((l) => { il.push(l); lineRung.push(i); });
    });
    return { il: il.join("\n"), errors, lineRung };
  }

  /* ---------------- instruction list -> grid ---------------- */
  const LOADS = /^(LD|LDI|LDP|LDF)$/, ANDS = /^(AND|ANI|ANDP|ANDF)$/, ORS = /^(OR|ORI|ORP|ORF)$/;
  const CMPOP = /^(LD|AND|OR)(<>|>=|<=|=|>|<)$/;
  function leafOf(op, args) {
    const m = CMPOP.exec(op);
    if (m) return { k: "L", c: { t: "cmp", d: `${m[2]} ${args[0]} ${args[1]}` } };
    const t = { LD: "no", AND: "no", OR: "no", LDI: "nc", ANI: "nc", ORI: "nc", LDP: "p", ANDP: "p", ORP: "p", LDF: "f", ANDF: "f", ORF: "f" }[op];
    return { k: "L", c: { t, d: args[0] } };
  }
  function size(e) {
    if (!e || e.k === "T") return [0, 1];
    if (e.k === "L") return [1, 1];
    const z = e.i.map(size);
    return e.k === "A" ? [z.reduce((a, b) => a + b[0], 0), Math.max(...z.map((b) => b[1]))] : [Math.max(...z.map((b) => b[0])), z.reduce((a, b) => a + b[1], 0)];
  }
  function place(rg, e, r, c, w) {
    const fill = (row, from, to) => { for (let k = from; k < to; k++) if (!rg.cells[row][k]) rg.cells[row][k] = { t: "h" }; };
    if (!e || e.k === "T") { fill(r, c, c + w); return; }
    if (e.k === "L") { rg.cells[r][c] = clone(e.c); fill(r, c + 1, c + w); return; }
    if (e.k === "A") {
      let col = c;
      e.i.forEach((it, i) => { const iw = i === e.i.length - 1 ? c + w - col : size(it)[0]; place(rg, it, r, col, iw); col += iw; });
      return;
    }
    let row = r, lastStart = r;
    for (const it of e.i) { lastStart = row; place(rg, it, row, c, w); row += size(it)[1]; }
    for (let k = r; k < lastStart; k++) { rg.vl[k][c] = true; rg.vl[k][c + w] = true; }
  }
  function fromIL(text) {
    const rungs = [], warnings = [];
    let cur = null, stack = [], outs = [];
    const flush = () => {
      if (!outs.length && cur === null) return;
      if (!outs.length) { warnings.push("有一段接點後面沒有輸出，略過"); cur = null; stack = []; return; }
      const [w, h] = size(cur);
      if (w > COLS) { warnings.push(`有一條梯級需要 ${w} 格，超過 ${COLS} 格，請在指令表修改`); }
      const rg = newRung(Math.max(h, outs.length));
      if (w <= COLS) place(rg, cur, 0, 0, COLS);
      outs.forEach((o, i) => { rg.out[i] = o; if (i > 0) rg.vl[i - 1][COLS] = true; if (i > 0 && !rg.cells[i].some(Boolean) && cur === null) { /* coil straight from the rail */ } });
      if (cur === null) for (let i = 1; i < outs.length; i++) for (let k = 0; k < COLS; k++) rg.cells[i][k] = rg.cells[i][k] || null;
      rungs.push(rg); cur = null; stack = []; outs = [];
    };
    for (const raw of text.split("\n")) {
      const line = raw.split(";")[0].trim();
      if (!line) continue;
      const [opRaw, ...args] = line.split(/\s+/), op = opRaw.toUpperCase();
      if (LOADS.test(op) || /^LD(<>|>=|<=|=|>|<)$/.test(op)) {
        if (outs.length) flush();
        if (cur !== null) stack.push(cur);
        cur = leafOf(op, args);
      } else if (ANDS.test(op) || /^AND(<>|>=|<=|=|>|<)$/.test(op)) {
        if (outs.length) { warnings.push(`輸出後面接 ${op}（沒有 MPS）無法畫成梯形圖，請用指令表`); return { rungs: null, warnings }; }
        cur = AND([cur, leafOf(op, args)]);
      } else if (ORS.test(op) || /^OR(<>|>=|<=|=|>|<)$/.test(op)) {
        cur = OR([cur, leafOf(op, args)]);
      } else if (op === "ANB") { cur = AND([stack.pop(), cur]); }
      else if (op === "ORB") { cur = OR([stack.pop(), cur]); }
      else if (op === "MPS" || op === "MRD" || op === "MPP") { warnings.push("用了 MPS／MRD／MPP，梯形圖編輯器還畫不出來，請用指令表"); return { rungs: null, warnings }; }
      else if (op === "END") { flush(); }
      else if (op === "STL" || op === "RET") {
        flush();
        const rg = newRung(1); place(rg, T, 0, 0, COLS); rg.out[0] = { op: "FN", text: line.replace(/\s+/g, " ") }; rungs.push(rg);
      } else if (op === "OUT") {
        outs.push({ op: "OUT", a: args[0], k: args[1] || "" });
      } else {
        outs.push({ op: "FN", text: line.replace(/\s+/g, " ") });
      }
    }
    flush();
    rungs.forEach((rg) => { rg.dirty = false; if (rg.cells.every((row) => row.every((c) => !c))) place(rg, T, 0, 0, COLS); });
    return { rungs, warnings };
  }

  /* ---------------- editor UI ---------------- */
  const CW = 64, RH = 44, OW = 260, PAD = 28;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const KIND = { no: "常開接點", nc: "常閉接點", p: "上升沿接點", f: "下降沿接點", cmp: "比較接點" };

  function editor(root, opts) {
    opts = opts || {};
    const tranMode = !!opts.tran;              // SFC transition: output is TRAN
    let rungs = opts.rungs && opts.rungs.length ? opts.rungs : [newRung(1)];
    let cur = { g: 0, r: 0, c: 0 }, dlg = null;
    const comment = opts.comment || (() => "");
    root.classList.add("ledit");
    root.innerHTML = `<div class="le-bar">${[
      ["F5", "no", "┤├", "常開接點"], ["sF5", "pno", "┤├↓", "並聯常開"], ["F6", "nc", "┤/├", "常閉接點"], ["sF6", "pnc", "┤/├↓", "並聯常閉"],
      ["sF7", "p", "┤↑├", "上升沿"], ["sF8", "f", "┤↓├", "下降沿"], ["F7", "coil", "( )", tranMode ? "TRAN" : "線圈"], ["F8", "fn", "[ ]", "應用指令"],
      ["F9", "h", "─", "橫線"], ["sF9", "v", "│", "直線"], ["cF9", "dh", "─✕", "刪橫線"], ["cF10", "dv", "│✕", "刪直線"], ["Del", "del", "✕", "刪除"],
      ["", "row", "＋列", "插入一列"], ["", "rung", "＋梯級", "新增梯級"], ["", "drung", "－梯級", "刪除梯級"]]
      .concat(opts.stl ? [["", "stl", "STL", "步進開始（STL S）"], ["", "ret", "RET", "步進結束"]] : [])
      .map(([k, a, g, t]) => `<button type="button" class="le-b" data-a="${a}" title="${t}${k ? "（" + k + "）" : ""}"><b>${g}</b><small>${k || t}</small></button>`).join("")}</div>
      <div class="le-wrap" tabindex="0"><div class="le-svg"></div></div>
      <p class="le-help">點格子選位置，按工具列或鍵盤 F5、F6、F7…；在格子上直接打字也可以（例如 <code>LD X0</code>、<code>X0</code>、<code>OUT Y0</code>）。Enter 或雙擊修改，Delete 刪除，方向鍵移動。</p>`;
    const wrap = root.querySelector(".le-wrap"), svgBox = root.querySelector(".le-svg");

    function rowTop(g) { let y = 8; for (let i = 0; i < g; i++) y += rungs[i].cells.length * RH + 14; return y; }
    const stlOf = (rg) => { const o = rg.out[0]; return o && o.op === "FN" && /^(STL\s+S\d+|RET)$/.test(o.text) && !rg.cells.some((row) => row.some((c) => c && c.t !== "h")) && rg.out.filter(Boolean).length === 1 ? o.text : null; };
    function draw() {
      const parts = [];
      let y = 8, state = null;
      const width = PAD + COLS * CW + OW + 10;
      rungs.forEach((rg, g) => {
        const R = rg.cells.length, h = R * RH, mark = opts.stl ? stlOf(rg) : null;
        if (mark) state = /^STL/.test(mark) ? mark.split(/\s+/)[1] : null;
        if (opts.stl && mark) {
          const cy = y + RH / 2, x = PAD, m = x + CW / 2;
          parts.push(`<g class="le-rung${rg.dirty ? " dirty" : ""}" data-g="${g}"><rect class="le-bg" x="${PAD}" y="${y}" width="${COLS * CW + OW - 20}" height="${h}"/>`);
          for (let c = 0; c <= COLS; c++) parts.push(`<rect class="le-cell" data-g="${g}" data-r="0" data-c="${c}" x="${PAD + c * CW}" y="${y}" width="${c === COLS ? OW - 20 : CW}" height="${RH}"/>`);
          if (/^STL/.test(mark)) {
            parts.push(`<path class="le-w le-stl" d="M${x} ${cy}H${m - 8}M${m - 8} ${cy - 12}V${cy + 12}M${m + 8} ${cy - 12}V${cy + 12}M${m + 8} ${cy}H${x + CW * 2}"/><text class="le-t" x="${m}" y="${cy - 15}">${esc(state)}</text><text class="le-stlt" x="${m}" y="${cy + 4}">STL</text>` +
              `<text class="le-c le-start" x="${x + CW * 2 + 6}" y="${cy + 4}">步 ${esc(state)} 開始：下面的梯級只在這一步作用時執行</text>`);
          } else {
            parts.push(`<path class="le-w" d="M${x} ${cy}H${x + CW}"/><rect class="le-box" x="${x + CW}" y="${cy - 12}" width="54" height="24" rx="2"/><text class="le-t" x="${x + CW + 27}" y="${cy + 4}">RET</text><text class="le-c le-start" x="${x + CW + 64}" y="${cy + 4}">步進區結束，下面是一般梯形圖</text>`);
          }
          parts.push(`<text class="le-no" x="2" y="${y + 18}">${g + 1}</text><path class="le-rail" d="M${PAD} ${y}V${y + h}"/></g>`);
          y += h + 14;
          return;
        }
        if (opts.stl && state) parts.push(`<rect class="le-band" x="${PAD - 9}" y="${y - 7}" width="6" height="${h + 14}"><title>${esc(state)}</title></rect><text class="le-bandt" x="${PAD - 12}" y="${y + h / 2 + 4}" text-anchor="end">${esc(state)}</text>`);
        parts.push(`<g class="le-rung${rg.dirty ? " dirty" : ""}" data-g="${g}"><rect class="le-bg" x="${PAD}" y="${y}" width="${COLS * CW + OW - 20}" height="${h}"/>`);
        parts.push(`<text class="le-no" x="2" y="${y + 18}">${g + 1}</text>`);
        for (let r = 0; r < R; r++) {
          const cy = y + r * RH + RH / 2;
          for (let c = 0; c < COLS; c++) {
            const x = PAD + c * CW, cell = rg.cells[r][c];
            parts.push(`<rect class="le-cell" data-g="${g}" data-r="${r}" data-c="${c}" x="${x}" y="${y + r * RH}" width="${CW}" height="${RH}"/>`);
            if (!cell) continue;
            if (cell.t === "h") { parts.push(`<path class="le-w" d="M${x} ${cy}H${x + CW}"/>`); continue; }
            const m = x + CW / 2;
            if (cell.t === "cmp") {
              parts.push(`<path class="le-w" d="M${x} ${cy}H${x + 4}M${x + CW - 4} ${cy}H${x + CW}"/><rect class="le-box" x="${x + 4}" y="${cy - 10}" width="${CW - 8}" height="20" rx="2"/><text class="le-t" x="${m}" y="${cy + 4}">${esc(cell.d)}</text>`);
              continue;
            }
            let d = `M${x} ${cy}H${m - 6}M${m - 6} ${cy - 10}V${cy + 10}M${m + 6} ${cy - 10}V${cy + 10}M${m + 6} ${cy}H${x + CW}`;
            if (cell.t === "nc") d += `M${m - 8} ${cy + 10}L${m + 8} ${cy - 10}`;
            if (cell.t === "p") d += `M${m} ${cy + 7}V${cy - 7}M${m - 3} ${cy - 3}L${m} ${cy - 7}L${m + 3} ${cy - 3}`;
            if (cell.t === "f") d += `M${m} ${cy - 7}V${cy + 7}M${m - 3} ${cy + 3}L${m} ${cy + 7}L${m + 3} ${cy + 3}`;
            parts.push(`<path class="le-w" d="${d}"/><text class="le-t" x="${m}" y="${cy - 14}">${esc(cell.d)}</text><text class="le-c" x="${m}" y="${cy + 21}">${esc(comment(cell.d).slice(0, 6))}</text>`);
          }
          for (let b = 0; b <= COLS; b++) if (rg.vl[r][b] && r < R - 1) {
            const x = PAD + b * CW; parts.push(`<path class="le-w" d="M${x} ${cy}V${cy + RH}"/>`);
          }
          const ox = PAD + COLS * CW, o = rg.out[r];
          parts.push(`<rect class="le-cell" data-g="${g}" data-r="${r}" data-c="${COLS}" x="${ox}" y="${y + r * RH}" width="${OW - 20}" height="${RH}"/>`);
          if (o) {
            if (o.op === "OUT" || o.op === "TRAN") {
              const label = o.op === "TRAN" ? "TRAN" : o.a + (o.k ? " " + o.k : "");
              parts.push(`<path class="le-w" d="M${ox} ${cy}H${ox + 18}"/><path class="le-w" d="M${ox + 24} ${cy - 11}Q${ox + 18} ${cy} ${ox + 24} ${cy + 11}M${ox + 44} ${cy - 11}Q${ox + 50} ${cy} ${ox + 44} ${cy + 11}"/><path class="le-w" d="M${ox + 50} ${cy}H${ox + 56}"/>` +
                `<text class="le-t le-start" x="${ox + 60}" y="${cy + 4}">${esc(label)}</text><text class="le-c le-start" x="${ox + 60}" y="${cy + 18}">${esc(o.a ? comment(o.a).slice(0, 10) : "")}</text>`);
            } else {
              const t = o.text, w = Math.min(OW - 34, Math.max(70, t.length * 7.4 + 14));
              parts.push(`<path class="le-w" d="M${ox} ${cy}H${ox + 8}"/><rect class="le-box" x="${ox + 8}" y="${cy - 12}" width="${w}" height="24" rx="2"/><text class="le-t le-start" x="${ox + 14}" y="${cy + 4}">${esc(t)}</text>`);
            }
          }
        }
        parts.push(`<path class="le-rail" d="M${PAD} ${y}V${y + h}"/><path class="le-rail" d="M${PAD + COLS * CW + OW - 20} ${y}V${y + h}"/></g>`);
        y += h + 14;
      });
      const cy = rowTop(cur.g) + cur.r * RH, cx = PAD + cur.c * CW;
      parts.push(`<rect class="le-cur" x="${cx + 1}" y="${cy + 1}" width="${(cur.c === COLS ? OW - 20 : CW) - 2}" height="${RH - 2}"/>`);
      svgBox.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y + 4}" viewBox="0 0 ${width} ${y + 4}">${parts.join("")}</svg>`;
      svgBox.querySelectorAll(".le-cell").forEach((el) => {
        el.addEventListener("mousedown", () => { cur = { g: +el.dataset.g, r: +el.dataset.r, c: +el.dataset.c }; closeDlg(); draw(); wrap.focus(); });
        el.addEventListener("dblclick", () => { cur = { g: +el.dataset.g, r: +el.dataset.r, c: +el.dataset.c }; editHere(); });
      });
      if (opts.onChange) opts.onChange();
    }
    const R = () => rungs[cur.g];
    const touch = () => { R().dirty = true; };
    function ensureRow(r) { while (R().cells.length <= r) addRow(R()); }
    function fillToCoil(r) {
      const row = R().cells[r];
      let last = -1;
      for (let c = 0; c < COLS; c++) if (row[c]) last = c;
      for (let c = last + 1; c < COLS; c++) row[c] = { t: "h" };
    }
    function setContact(kind, dev, parallel) {
      if (cur.c >= COLS) cur.c = COLS - 1;
      ensureRow(cur.r);
      R().cells[cur.r][cur.c] = { t: kind, d: dev };
      if (parallel && cur.r > 0) { R().vl[cur.r - 1][cur.c] = true; R().vl[cur.r - 1][cur.c + 1] = true; }
      touch(); cur.c = Math.min(COLS, cur.c + 1);
    }
    function setOut(o) {
      ensureRow(cur.r);
      R().out[cur.r] = o; fillToCoil(cur.r); touch();
      if (cur.r === R().cells.length - 1) { rungs.splice(cur.g + 1, 0, newRung(1)); cur = { g: cur.g + 1, r: 0, c: 0 }; }
      else { cur.r += 1; cur.c = 0; }
    }
    function parseCoil(text) {
      const t = text.trim().toUpperCase().replace(/\s+/g, " ");
      if (!t) return null;
      if (tranMode && (t === "TRAN" || t === "")) return { op: "TRAN" };
      const m = /^(?:OUT )?([YMSTC]\d+)(?: (K-?\d+|D\d+))?$/.exec(t);
      if (m) return { op: "OUT", a: m[1], k: m[2] || "" };
      return { op: "FN", text: t };
    }
    /* typed instruction: LD X0, ANI X1, OUT Y0, SET M0, STL S20, or just a device for the chosen symbol */
    function applyTyped(sym, text) {
      const t = text.trim().toUpperCase().replace(/\s+/g, " ");
      if (sym === "coil") { if (tranMode && !t) { setOut({ op: "TRAN" }); return; } const o = parseCoil(t); if (o) setOut(o); return; }
      if (sym === "fn") { if (t) setOut(tranMode && t === "TRAN" ? { op: "TRAN" } : { op: "FN", text: t }); return; }
      const m = /^(LD|LDI|LDP|LDF|AND|ANI|ANDP|ANDF|OR|ORI|ORP|ORF)\s+(\S+)$/.exec(t);
      if (m) {
        const op = m[1], par = /^OR/.test(op);
        const kind = /I$/.test(op) ? "nc" : /P$/.test(op) ? "p" : /F$/.test(op) ? "f" : "no";
        if (par && cur.r === 0) cur.r = 1;
        setContact(kind, m[2], par); return;
      }
      const cm = /^(LD|AND|OR)(<>|>=|<=|=|>|<)\s+(\S+)\s+(\S+)$/.exec(t);
      if (cm) { setContact("cmp", `${cm[2]} ${cm[3]} ${cm[4]}`, cm[1] === "OR" && cur.r > 0); return; }
      if (/^(OUT|SET|RST|PLS|PLF|MOV|ADD|SUB|INC|DEC|MUL|DIV|CMP|ZCP|ZRST|ALT|STL|RET|SFTL|SFTR|ROL|ROR|DRVI|DRVA|TRAN)\b/.test(t) || /P\b/.test(t.split(" ")[0])) {
        const o = /^OUT /.test(t) || /^TRAN$/.test(t) ? parseCoil(t.replace(/^OUT /, "")) : { op: "FN", text: t };
        if (o && o.op === "FN" && o.text === "TRAN" && tranMode) o.op = "TRAN";
        setOut(o); return;
      }
      if (/^(<>|>=|<=|=|>|<)\s+\S+\s+\S+$/.test(t)) { setContact("cmp", t, sym === "pno" || sym === "pnc"); return; }
      const kind = { no: "no", nc: "nc", pno: "no", pnc: "nc", p: "p", f: "f" }[sym] || "no";
      if (sym === "pno" || sym === "pnc") { if (cur.r === 0) cur.r = 1; setContact(kind, t, true); return; }
      setContact(kind, t, false);
    }
    function openDlg(sym, preset) {
      closeDlg();
      const top = rowTop(cur.g) + cur.r * RH + RH + 4, left = PAD + Math.min(cur.c, COLS - 2) * CW;
      dlg = document.createElement("div");
      dlg.className = "le-dlg";
      dlg.style.cssText = `top:${top}px;left:${left}px`;
      const names = { no: "┤├ 常開", nc: "┤/├ 常閉", pno: "┤├ 並聯常開", pnc: "┤/├ 並聯常閉", p: "┤↑├ 上升沿", f: "┤↓├ 下降沿", coil: tranMode ? "( ) TRAN" : "( ) 線圈", fn: "[ ] 應用指令" };
      dlg.innerHTML = `<div class="le-dlg-h">輸入梯形圖</div><div class="le-dlg-r"><select>${Object.entries(names).map(([k, v]) => `<option value="${k}"${k === sym ? " selected" : ""}>${v}</option>`).join("")}</select>` +
        `<input value="${esc(preset || "")}" placeholder="${sym === "coil" ? (tranMode ? "直接按確定" : "Y0、T0 K10") : sym === "fn" ? "SET M0、MOV K5 D0、STL S20" : "X0、M0、>= D0 K10"}"><button type="button" class="ok">確定</button><button type="button" class="no">取消</button></div>`;
      svgBox.style.position = "relative"; svgBox.appendChild(dlg);
      const inp = dlg.querySelector("input"), sel = dlg.querySelector("select");
      inp.focus(); inp.select();
      const ok = () => { const s = sel.value, v = inp.value; closeDlg(); applyTyped(s, v); draw(); wrap.focus(); };
      dlg.querySelector(".ok").onclick = ok;
      dlg.querySelector(".no").onclick = () => { closeDlg(); wrap.focus(); };
      inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") ok(); if (e.key === "Escape") { closeDlg(); wrap.focus(); } });
    }
    function closeDlg() { if (dlg) { dlg.remove(); dlg = null; } }
    function editHere() {
      ensureRow(cur.r);
      if (cur.c === COLS) {
        const o = R().out[cur.r];
        openDlg(o && o.op === "FN" ? "fn" : "coil", o ? (o.op === "OUT" ? o.a + (o.k ? " " + o.k : "") : o.op === "TRAN" ? "" : o.text) : "");
        return;
      }
      const cell = R().cells[cur.r][cur.c];
      openDlg(cell && KIND[cell.t] ? cell.t : "no", cell && cell.d ? cell.d : "");
    }
    function act(a) {
      ensureRow(cur.r);
      const rg = R();
      if (["no", "nc", "pno", "pnc", "p", "f"].includes(a)) { if (cur.c >= COLS) cur.c = COLS - 1; openDlg(a, ""); return; }
      if (a === "coil") { cur.c = COLS; if (tranMode) { setOut({ op: "TRAN" }); draw(); return; } openDlg("coil", ""); return; }
      if (a === "fn") { cur.c = COLS; openDlg("fn", ""); return; }
      if (a === "h") { if (cur.c < COLS) { rg.cells[cur.r][cur.c] = { t: "h" }; cur.c = Math.min(COLS, cur.c + 1); touch(); } }
      if (a === "v") { if (cur.r === rg.cells.length - 1) addRow(rg); rg.vl[cur.r][cur.c] = true; cur.r += 1; touch(); }
      if (a === "dh") { if (cur.c < COLS && rg.cells[cur.r][cur.c] && rg.cells[cur.r][cur.c].t === "h") { rg.cells[cur.r][cur.c] = null; touch(); } }
      if (a === "dv") { if (cur.r < rg.cells.length) { rg.vl[cur.r][cur.c] = false; if (cur.r > 0) rg.vl[cur.r - 1][cur.c] = false; touch(); } }
      if (a === "del") { if (cur.c === COLS) rg.out[cur.r] = null; else rg.cells[cur.r][cur.c] = null; touch(); }
      if (a === "row") { addRow(rg, cur.r + 1); cur.r += 1; touch(); }
      if (a === "drow") { delRow(rg, cur.r); cur.r = Math.min(cur.r, rg.cells.length - 1); touch(); }
      if (a === "rung") { rungs.splice(cur.g + 1, 0, newRung(1)); cur = { g: cur.g + 1, r: 0, c: 0 }; }
      if (a === "stl" || a === "ret") {
        const rg2 = newRung(1);
        for (let k = 0; k < COLS; k++) rg2.cells[0][k] = { t: "h" };
        if (a === "ret") { rg2.out[0] = { op: "FN", text: "RET" }; rungs.splice(cur.g + 1, 0, rg2); cur = { g: cur.g + 1, r: 0, c: 0 }; draw(); return; }
        const used = rungs.map((x) => stlOf(x)).filter((t) => t && /^STL/.test(t)).map((t) => +t.split(/\s+/)[1].slice(1));
        rg2.out[0] = { op: "FN", text: "STL S" + (used.length ? Math.max(19, ...used) + 1 : 0) };
        rungs.splice(cur.g + 1, 0, rg2); cur = { g: cur.g + 1, r: 0, c: COLS }; draw(); editHere(); return;
      }
      if (a === "drung") { rungs.splice(cur.g, 1); if (!rungs.length) rungs.push(newRung(1)); cur = { g: Math.min(cur.g, rungs.length - 1), r: 0, c: 0 }; }
      draw();
    }
    root.querySelectorAll(".le-b").forEach((b) => b.addEventListener("click", () => { act(b.dataset.a); if (!dlg) wrap.focus(); }));
    function move(dr, dc) {
      cur.c = Math.max(0, Math.min(COLS, cur.c + dc));
      if (dr) {
        let r = cur.r + dr;
        if (r < 0) { if (cur.g > 0) { cur.g -= 1; r = rungs[cur.g].cells.length - 1; } else r = 0; }
        else if (r >= R().cells.length) { if (cur.g < rungs.length - 1) { cur.g += 1; r = 0; } else r = R().cells.length - 1; }
        cur.r = r;
      }
      draw();
    }
    wrap.addEventListener("keydown", (e) => {
      if (dlg) return;
      const k = e.key, s = e.shiftKey, c = e.ctrlKey || e.metaKey;
      const map = { F5: s ? "pno" : "no", F6: s ? "pnc" : "nc", F7: s ? "p" : "coil", F8: s ? "f" : "fn", F9: c ? "dh" : s ? "v" : "h", F10: c ? "dv" : null, Delete: "del" };
      if (k === "Insert" && s) { e.preventDefault(); act("row"); return; }
      if (k === "Delete" && s) { e.preventDefault(); act("drow"); return; }
      if (k === "F4") { e.preventDefault(); if (opts.onConvert) opts.onConvert(); return; }
      if (map[k]) { e.preventDefault(); act(map[k]); return; }
      if (k === "ArrowLeft") { e.preventDefault(); move(0, -1); return; }
      if (k === "ArrowRight") { e.preventDefault(); move(0, 1); return; }
      if (k === "ArrowUp") { e.preventDefault(); move(-1, 0); return; }
      if (k === "ArrowDown") { e.preventDefault(); move(1, 0); return; }
      if (k === "Enter") { e.preventDefault(); editHere(); return; }
      if (k === "Backspace") { e.preventDefault(); act("del"); return; }
      if (k.length === 1 && /[A-Za-z0-9<>=]/.test(k) && !c) { e.preventDefault(); openDlg(cur.c === COLS ? "coil" : "no", k.toUpperCase()); }
    });
    draw();
    return {
      get rungs() { return rungs; },
      set(rs) { rungs = rs && rs.length ? rs : [newRung(1)]; cur = { g: 0, r: 0, c: 0 }; closeDlg(); draw(); },
      compile() { const r = compile(rungs, opts.tran); return r; },
      markClean() { rungs.forEach((rg) => { rg.dirty = false; }); draw(); },
      showErrors(errs) { svgBox.querySelectorAll(".le-rung").forEach((el) => el.classList.toggle("err", errs.some((x) => x.rung === +el.dataset.g))); },
      focus() { wrap.focus(); },
      redraw: draw,
    };
  }

  const api = { COLS, newRung, compile, compileRung, fromIL, editor };
  if (typeof module !== "undefined") module.exports = api;
  return api;
})();
