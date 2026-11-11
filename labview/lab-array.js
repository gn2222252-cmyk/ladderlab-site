"use strict";
/* LabVIEW array functions, animated. Each function takes the current inputs and returns the outputs plus a "moves"
   list (which input cell flies to which output cell) so one animation routine can show every function. */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = (v) => { const n = Number(String(v).trim()); return Number.isFinite(n) ? n : 0; };
  const fmt = (v) => Array.isArray(v) ? (Array.isArray(v[0]) ? v.map((r) => "[" + r.join(", ") + "]").join("; ") : v.join(", ")) : String(v);

  /* ---------- the functions (only the ones students use in projects and CLAD) ---------- */
  const F = {
    size: {
      name: "Array Size", icon: "Array\nSize", group: "查詢",
      desc: "陣列有幾個元素。一維輸出一個數字；二維輸出 [列數, 行數]。",
      ins: [["array", "a"]], params: [],
      run(s) { return { outs: [["size", s.a.length, "i32"]], moves: s.a.map((_, i) => ({ from: ["a", i], to: ["size"] })) }; },
      predict: "size", notes: ["空陣列的 size 是 0，For Loop 自動索引空陣列就跑 0 次。", "二維陣列輸出的是一個陣列 [列數, 行數]，不是總數。"],
      random(s) { s.a = rnd(rint(0, 6)); },
    },
    index: {
      name: "Index Array（一維）", icon: "Index\nArray", group: "查詢",
      desc: "拿出第 index 個元素。index 從 0 開始數。",
      ins: [["array", "a"]], params: [["index", "i", 2]],
      run(s) {
        const i = s.i, ok = i >= 0 && i < s.a.length;
        return { outs: [["element", ok ? s.a[i] : 0, "dbl"]], moves: ok ? [{ from: ["a", i], to: ["element"] }] : [], hit: ok ? [["a", i]] : [],
          say: ok ? "" : `index ${i} 超出範圍：LabVIEW 不會報錯，而是輸出這個型別的預設值 0。` };
      },
      predict: "element", notes: ["index 從 0 開始：[5, 6, 7] 的 index 1 是 6。", "超出範圍不會報錯，輸出預設值（數字是 0、字串是空的）。CLAD 很愛考。", "迴圈裡想一個一個拿，用 For Loop 的自動索引通道比較簡單。"],
      random(s) { s.a = rnd(rint(3, 6)); s.i = rint(-1, s.a.length + 1); },
    },
    index2: {
      name: "Index Array（二維）", icon: "Index\nArray\n2D", group: "查詢",
      desc: "二維陣列要給兩個 index：先列（row）、再行（column）。只給 row 時，整列拿出來變成一維陣列。",
      ins: [["2D array", "m"]], params: [["row", "r", 1], ["column（空白＝整列）", "c", ""]],
      run(s) {
        const r = s.r, rowOk = r >= 0 && r < s.m.length;
        if (s.c === "" || s.c === null) {
          const out = rowOk ? s.m[r].slice() : [];
          return { outs: [["subarray", out, "dbl"]], moves: rowOk ? out.map((_, j) => ({ from: ["m", r, j], to: ["subarray", j] })) : [] };
        }
        const c = num(s.c), ok = rowOk && c >= 0 && c < s.m[0].length;
        return { outs: [["element", ok ? s.m[r][c] : 0, "dbl"]], moves: ok ? [{ from: ["m", r, c], to: ["element"] }] : [] };
      },
      predict: "element 或 subarray", notes: ["順序是 row 先、column 後，跟 Excel 的「列、欄」一樣。", "只接 row 拿到一整列；只接 column（把 row 斷開）拿到一整行。"],
      random(s) { const rows = rint(2, 3), cols = rint(3, 4); s.m = Array.from({ length: rows }, () => rnd(cols)); s.r = rint(0, rows - 1); s.c = Math.random() < .5 ? "" : rint(0, cols - 1); },
    },
    search: {
      name: "Search 1D Array", icon: "Search\n1D", group: "查詢",
      desc: "從 start index 開始往後找，找到第一個相等的元素就回傳它的 index；找不到回傳 -1。",
      ins: [["1D array", "a"]], params: [["element", "e", 3], ["start index", "st", 0]],
      run(s) {
        let k = -1;
        for (let i = Math.max(0, s.st); i < s.a.length; i++) if (s.a[i] === s.e) { k = i; break; }
        return { outs: [["index of element", k, "i32"]], moves: k >= 0 ? [{ from: ["a", k], to: ["index of element"] }] : [], hit: k >= 0 ? [["a", k]] : [] };
      },
      predict: "index of element", notes: ["找不到是 -1，不是 0。後面接 Index Array 前要先判斷 ≥ 0。", "只找第一個；要找全部，把 start index 改成上一次找到的位置 + 1 再找。"],
      random(s) { s.a = rnd(rint(4, 7), 6); s.e = rint(1, 6); s.st = Math.random() < .3 ? rint(1, 3) : 0; },
    },
    maxmin: {
      name: "Array Max & Min", icon: "Max\nMin", group: "查詢",
      desc: "一次找出最大值、最小值，以及它們的 index。有相同的值時，回傳最前面那一個的 index。",
      ins: [["array", "a"]], params: [],
      run(s) {
        if (!s.a.length) return { outs: [["max value", 0, "dbl"], ["max index", -1, "i32"], ["min value", 0, "dbl"], ["min index", -1, "i32"]], moves: [] };
        let mx = 0, mn = 0;
        s.a.forEach((v, i) => { if (v > s.a[mx]) mx = i; if (v < s.a[mn]) mn = i; });
        return { outs: [["max value", s.a[mx], "dbl"], ["max index", mx, "i32"], ["min value", s.a[mn], "dbl"], ["min index", mn, "i32"]],
          moves: [{ from: ["a", mx], to: ["max value"] }, { from: ["a", mn], to: ["min value"] }] };
      },
      predict: "max value", notes: ["[3, 9, 1, 9] 的 max index 是 1（第一個 9），不是 3。", "空陣列的 index 都是 -1。"],
      random(s) { s.a = rnd(rint(4, 7), 9); },
    },
    insert: {
      name: "Insert Into Array", icon: "Insert", group: "修改",
      desc: "在 index 的位置插入新元素，後面的元素全部往後推一格。",
      ins: [["array", "a"]], params: [["index", "i", 1], ["new element", "e", 9]],
      run(s) {
        const i = s.i;
        if (i < 0 || i > s.a.length) return { outs: [["output array", s.a.slice(), "dbl"]], moves: s.a.map((_, k) => ({ from: ["a", k], to: ["output array", k] })),
          say: `index ${i} 超出範圍（可以插的位置是 0～${s.a.length}），陣列原封不動。` };
        const out = s.a.slice(0, i).concat([s.e], s.a.slice(i));
        const moves = s.a.map((_, k) => ({ from: ["a", k], to: ["output array", k < i ? k : k + 1] }));
        moves.push({ from: ["param", "e"], to: ["output array", i], fresh: true });
        return { outs: [["output array", out, "dbl"]], moves };
      },
      predict: "output array", notes: ["index 等於陣列長度時，插在最後面（等於附加）。", "index 再大就不插了，輸出和輸入一樣，不會報錯。", "在迴圈裡一直插會一直重新配置記憶體，大量資料改用 Build Array 或先 Initialize Array。"],
      random(s) { s.a = rnd(rint(3, 5)); s.i = rint(0, s.a.length + 1); s.e = rint(10, 99); },
    },
    del: {
      name: "Delete From Array", icon: "Delete", group: "修改",
      desc: "從 index 開始刪掉 length 個元素。輸出兩個：刪剩的陣列，以及被刪掉的部分。",
      ins: [["array", "a"]], params: [["index", "i", 1], ["length", "n", 2]],
      run(s) {
        const i = s.i, n = Math.max(0, s.n);
        if (i < 0 || i >= s.a.length) return { outs: [["array w/ subset deleted", s.a.slice(), "dbl"], ["deleted portion", [], "dbl"]],
          moves: s.a.map((_, k) => ({ from: ["a", k], to: ["array w/ subset deleted", k] })), say: `index ${i} 超出範圍，什麼都沒刪。` };
        const del = s.a.slice(i, i + n), rest = s.a.slice(0, i).concat(s.a.slice(i + n));
        const moves = [];
        s.a.forEach((_, k) => {
          if (k < i) moves.push({ from: ["a", k], to: ["array w/ subset deleted", k] });
          else if (k >= i + n) moves.push({ from: ["a", k], to: ["array w/ subset deleted", k - n] });
          else moves.push({ from: ["a", k], to: ["deleted portion", k - i] });
        });
        return { outs: [["array w/ subset deleted", rest, "dbl"], ["deleted portion", del, "dbl"]], moves, gone: del.map((_, k) => ["a", i + k]) };
      },
      predict: "array w/ subset deleted", notes: ["length 沒接時預設是 1。", "length 超過剩下的元素數，就刪到最後為止。"],
      random(s) { s.a = rnd(rint(4, 6)); s.i = rint(0, s.a.length); s.n = rint(1, 3); },
    },
    replace: {
      name: "Replace Array Subset", icon: "Replace", group: "修改",
      desc: "把 index 那一格換成新元素。陣列長度不變。",
      ins: [["array", "a"]], params: [["index", "i", 2], ["new element", "e", 0]],
      run(s) {
        const i = s.i, ok = i >= 0 && i < s.a.length, out = s.a.slice();
        if (ok) out[i] = s.e;
        const moves = s.a.map((_, k) => ({ from: ["a", k], to: ["output array", k] })).filter((m) => !ok || m.from[1] !== i);
        if (ok) moves.push({ from: ["param", "e"], to: ["output array", i], fresh: true });
        return { outs: [["output array", out, "dbl"]], moves, gone: ok ? [["a", i]] : [], say: ok ? "" : `index ${i} 超出範圍，陣列不變（不會變長）。` };
      },
      predict: "output array", notes: ["和 Insert 的差別：Replace 不會讓陣列變長。超出範圍就什麼都不做。", "Shift Register 裡的陣列用 Replace 改值，記憶體效率最好（不會重新配置）。"],
      random(s) { s.a = rnd(rint(3, 6)); s.i = rint(-1, s.a.length); s.e = rint(10, 99); },
    },
    sort: {
      name: "Sort 1D Array", icon: "Sort\n1D", group: "修改",
      desc: "由小排到大。要由大到小，排完接 Reverse 1D Array。",
      ins: [["array", "a"]], params: [],
      run(s) {
        const idx = s.a.map((v, k) => [v, k]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        return { outs: [["sorted array", idx.map((p) => p[0]), "dbl"]], moves: idx.map((p, j) => ({ from: ["a", p[1]], to: ["sorted array", j] })) };
      },
      predict: "sorted array", notes: ["只有遞增排序。遞減：Sort 後接 Reverse 1D Array。", "Cluster 陣列也能排，依 Cluster 的第一個元素排。"],
      random(s) { s.a = rnd(rint(4, 7), 20); },
    },
    build: {
      name: "Build Array", icon: "Build\nArray", group: "建立",
      desc: "把輸入接起來。沒勾 Concatenate 時，兩個一維陣列會疊成二維（短的補 0）；勾了就首尾相接成一維。",
      ins: [["array 1", "a"], ["array 2", "b"]], params: [["Concatenate Inputs（1＝勾，0＝不勾）", "cc", 0]],
      run(s) {
        if (s.cc) {
          const out = s.a.concat(s.b);
          return { outs: [["appended array", out, "dbl"]], moves: s.a.map((_, k) => ({ from: ["a", k], to: ["appended array", k] }))
            .concat(s.b.map((_, k) => ({ from: ["b", k], to: ["appended array", s.a.length + k] }))) };
        }
        const w = Math.max(s.a.length, s.b.length), pad = (r) => r.concat(Array(w - r.length).fill(0));
        return { outs: [["appended array", [pad(s.a), pad(s.b)], "dbl2"]], moves: s.a.map((_, k) => ({ from: ["a", k], to: ["appended array", 0, k] }))
          .concat(s.b.map((_, k) => ({ from: ["b", k], to: ["appended array", 1, k] }))),
          say: s.a.length !== s.b.length ? "兩個陣列長度不同：二維陣列每一列必須一樣長，短的那一列補 0。" : "" };
      },
      predict: "appended array（二維用 ; 分列）", notes: ["CLAD 常考：沒勾 Concatenate，兩個一維 → 二維；勾了 → 一維。", "一個陣列加一個純量（數字）時，不管有沒有勾，都是把數字接在後面。"],
      random(s) { s.a = rnd(rint(2, 4)); s.b = rnd(rint(1, 4)); s.cc = Math.random() < .5 ? 1 : 0; },
    },
    subset: {
      name: "Array Subset", icon: "Array\nSubset", group: "建立",
      desc: "從 index 開始取 length 個元素出來，原陣列不變。",
      ins: [["array", "a"]], params: [["index", "i", 1], ["length", "n", 3]],
      run(s) {
        const i = Math.max(0, s.i), out = s.a.slice(i, i + Math.max(0, s.n));
        return { outs: [["subarray", out, "dbl"]], moves: out.map((_, j) => ({ from: ["a", i + j], to: ["subarray", j] })),
          say: i + s.n > s.a.length && i < s.a.length ? "length 超過剩下的元素，只取到最後一個為止，不會補 0。" : "" };
      },
      predict: "subarray", notes: ["和 Delete 相反：Subset 是「拿出來」，原陣列不動。", "length 太大不會出錯，取到最後為止。"],
      random(s) { s.a = rnd(rint(4, 7)); s.i = rint(0, s.a.length - 1); s.n = rint(1, 4); },
    },
  };
  const ORDER = ["size", "index", "index2", "search", "maxmin", "insert", "del", "replace", "sort", "build", "subset"];

  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function rnd(n, top) { return Array.from({ length: n }, () => rint(1, top || 9)); }

  /* ---------- state ---------- */
  let key = "insert", st = {}, right = 0, total = 0, done = new Set();
  try { done = new Set(JSON.parse(localStorage.getItem("ll_lv_lab_array") || "[]")); } catch (e) { done = new Set(); }
  function fresh() {
    st = { a: [1, 2, 3, 4], b: [5, 6], m: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] };
    F[key].params.forEach(([, k, v]) => { st[k] = v; });
  }

  /* ---------- drawing ---------- */
  function cellsHtml(arr, id, edit, type) {
    if (!edit && !arr.length) return `<div class="arr ${type === "i32" ? "i32" : ""}" data-arr="${id}"><div class="cellw"><span class="cell empty">空</span><small>&nbsp;</small></div></div>`;
    return `<div class="arr" data-arr="${id}">` + arr.map((v, i) => `<div class="cellw">` +
      (edit ? `<input class="cell" data-a="${id}" data-i="${i}" value="${v}">` : `<span class="cell" data-c="${id}:${i}">${v}</span>`) + `<small>${i}</small></div>`).join("") +
      (edit ? `</div><span class="arrbtn"><button type="button" data-add="${id}">＋</button> <button type="button" data-rm="${id}">－</button></span>` : `</div>`);
  }
  function gridHtml(m, id, edit) {
    const cols = m.length ? m[0].length : 0;
    return `<div class="arr d2" data-arr="${id}" style="grid-template-columns:repeat(${cols},auto)">` + m.map((row, r) => row.map((v, c) =>
      edit ? `<input class="cell" data-a="${id}" data-r="${r}" data-i="${c}" value="${v}">` : `<span class="cell" data-c="${id}:${r}:${c}">${v}</span>`).join("")).join("") + `</div>`;
  }
  function drawInputs() {
    const f = F[key];
    $("inputs").innerHTML = f.ins.map(([label, k]) => `<div class="term"><div class="tl"><span class="wire"></span>${esc(label)}</div>` +
      (k === "m" ? gridHtml(st.m, "m", true) : cellsHtml(st[k], k, true)) + `</div>`).join("") +
      f.params.map(([label, k]) => `<div class="term"><div class="tl"><span class="wire i32"></span>${esc(label)}</div><input class="scalar" data-p="${k}" value="${st[k]}"></div>`).join("");
    $("inputs").querySelectorAll("input[data-a]").forEach((inp) => inp.addEventListener("input", () => {
      const k = inp.dataset.a;
      if (k === "m") st.m[+inp.dataset.r][+inp.dataset.i] = num(inp.value); else st[k][+inp.dataset.i] = num(inp.value);
      clearOut();
    }));
    $("inputs").querySelectorAll("input[data-p]").forEach((inp) => inp.addEventListener("input", () => {
      st[inp.dataset.p] = inp.value.trim() === "" && inp.dataset.p === "c" ? "" : num(inp.value); clearOut();
    }));
    $("inputs").querySelectorAll("[data-add]").forEach((b) => b.onclick = () => { st[b.dataset.add].push(rint(1, 9)); drawInputs(); clearOut(); });
    $("inputs").querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { st[b.dataset.rm].pop(); drawInputs(); clearOut(); });
  }
  function drawOutputs(res, reveal) {
    $("outputs").innerHTML = res.outs.map(([label, v, type]) => `<div class="term"><div class="tl"><span class="wire ${type === "i32" ? "i32" : ""}"></span>${esc(label)}</div>` +
      (Array.isArray(v) ? (type === "dbl2" ? gridHtml(reveal ? v : v.map((r) => r.map(() => "?")), label, false) : cellsHtml(reveal ? v : v.map(() => "?"), label, false, type))
        : `<span class="scalar ${type === "dbl" ? "dbl" : ""}" data-s="${esc(label)}">${reveal ? v : "?"}</span>`) + `</div>`).join("");
  }
  function clearOut() { const res = F[key].run(st); drawOutputs(res, false); $("verdict").textContent = ""; $("verdict").className = "verdict-line"; }

  /* ---------- animation: clones fly from input cells to output cells ---------- */
  function cellEl(addr) {
    const [where, a, b] = addr;
    if (where === "param") return $("inputs").querySelector(`input[data-p="${a}"]`);
    if (where === "m") return $("inputs").querySelector(`input[data-a="m"][data-r="${a}"][data-i="${b}"]`);
    return $("inputs").querySelector(`input[data-a="${where}"][data-i="${a}"]`);
  }
  function outEl(to) {
    const [label, a, b] = to;
    if (a === undefined) return $("outputs").querySelector(`[data-s="${CSS.escape(label)}"]`);
    if (b !== undefined) return $("outputs").querySelector(`[data-c="${CSS.escape(label + ":" + a + ":" + b)}"]`);
    return $("outputs").querySelector(`[data-c="${CSS.escape(label + ":" + a)}"]`);
  }
  async function animate(res) {
    const slow = $("slow").checked, dur = slow ? 1400 : 650, gap = slow ? 260 : 90;
    (res.hit || []).forEach((h) => { const e = cellEl(h); if (e) e.classList.add("hit"); });
    (res.gone || []).forEach((h) => { const e = cellEl(h); if (e) e.classList.add("gone"); });
    const layer = $("layer");
    const flights = res.moves.map((m, k) => new Promise((done) => {
      const from = cellEl(m.from), to = outEl(m.to);
      if (!from || !to) return done();
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      const fl = document.createElement("div");
      fl.className = "fly" + (m.fresh ? " new" : "");
      fl.textContent = from.value;
      Object.assign(fl.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px", transitionDuration: dur + "ms" });
      layer.appendChild(fl);
      setTimeout(() => {
        Object.assign(fl.style, { left: b.left + "px", top: b.top + "px", width: b.width + "px", height: b.height + "px" });
        setTimeout(() => { to.textContent = fl.textContent; if (m.fresh) to.classList.add("new"); fl.remove(); done(); }, dur);
      }, 30 + k * gap);
    }));
    await Promise.all(flights);
  }

  /* ---------- run / predict ---------- */
  function parsePred(t) {
    t = t.trim();
    if (t.includes(";")) return t.split(";").map((r) => r.split(/[,\s]+/).filter(Boolean).map(num));
    const parts = t.split(/[,\s]+/).filter(Boolean).map(num);
    return parts.length === 1 && !/^\[/.test(t) ? parts[0] : parts;
  }
  function primary(res) {
    const f = F[key];
    if (key === "index2") return res.outs[0][1];
    const o = res.outs.find(([l]) => f.predict.startsWith(l)) || res.outs[0];
    return o[1];
  }
  let busy = false;
  async function run() {
    if (busy) return;
    busy = true;
    $("inputs").querySelectorAll(".cell").forEach((c) => c.classList.remove("hit", "gone"));
    const res = F[key].run(st);
    const pred = $("predict").checked ? $("predin").value : null;
    drawOutputs(res, false);
    $("outputs").querySelectorAll(".cell, .scalar").forEach((c) => { c.textContent = ""; });
    if (res.outs.some(([, v]) => Array.isArray(v) && !v.length)) drawOutputs(res, true);
    await animate(res);
    drawOutputs(res, true);
    let msg = res.say || "", cls = "verdict-line";
    if (pred !== null && pred.trim() !== "") {
      total++;
      const ok = JSON.stringify(parsePred(pred)) === JSON.stringify(primary(res));
      if (ok) { right++; done.add(key); try { localStorage.setItem("ll_lv_lab_array", JSON.stringify([...done])); } catch (e) { /* private */ } }
      msg = (ok ? "✓ 答對了！" : `✗ 正確答案是 ${fmt(primary(res))}。`) + (msg ? "　" + msg : "");
      cls += ok ? " ok" : " bad";
      $("score").textContent = `答對 ${right} / ${total}`;
      drawList();
    }
    $("verdict").textContent = msg; $("verdict").className = cls;
    busy = false;
  }

  /* ---------- page ---------- */
  function drawList() {
    let html = "", g = "";
    ORDER.forEach((k) => {
      if (F[k].group !== g) { g = F[k].group; html += `<h3>${g}</h3>`; }
      html += `<button type="button" data-k="${k}" class="${k === key ? "here" : ""}${done.has(k) ? " done" : ""}">${esc(F[k].name)}</button>`;
    });
    $("fnlist").innerHTML = html;
    $("fnlist").querySelectorAll("button").forEach((b) => b.onclick = () => select(b.dataset.k));
  }
  function select(k) {
    key = k; fresh();
    const f = F[k];
    $("node").textContent = f.icon;
    $("node").style.whiteSpace = "pre";
    $("fname").textContent = f.name;
    $("fdesc").textContent = f.desc;
    $("notes").innerHTML = "<h3>要記住的</h3><ul>" + f.notes.map((n) => `<li>${esc(n)}</li>`).join("") + "</ul>";
    $("predhint").textContent = `預測：${f.predict}，陣列用逗號分開`;
    $("predin").value = "";
    drawList(); drawInputs(); clearOut();
    try { history.replaceState(null, "", "#" + k); } catch (e) { /* file:// */ }
  }
  $("run").onclick = run;
  $("predict").onchange = () => { $("predbox").hidden = !$("predict").checked; };
  $("predin").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  $("newq").onclick = () => {
    F[key].random(st);
    $("predict").checked = true; $("predbox").hidden = false; $("predin").value = "";
    drawInputs(); clearOut(); $("predin").focus();
  };
  const start = location.hash.slice(1);
  select(F[start] ? start : "insert");
  window.ArrayLab = { F, run, select, st: () => st };
})();
