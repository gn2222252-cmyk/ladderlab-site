"use strict";
/* SFC editor for FX (GX Works2 style): a ladder block (M8002 → SET S0), steps with their action ladders, transitions
   with condition ladders ending in TRAN. Selection branches = several transitions from one step; parallel branches =
   one transition to several steps; parallel merge = one transition from several steps. Compiles to STL/RET
   (SfcEdit.compile) and loads from an instruction list with STL (SfcEdit.fromIL). The zoom panes reuse LEdit. */
const SfcEdit = (() => {
  const L = typeof LEdit !== "undefined" ? LEdit : require("./ledit.js");
  const isState = (a) => /^S\d+$/.test(a || "");
  const sNum = (s) => +s.slice(1);

  function chunks(lines) {
    /* split an instruction list into rungs: a rung ends when a load follows an output */
    const out = [];
    let cur = [], hadOut = false;
    for (const l of lines) {
      const op = l.split(/\s+/)[0].toUpperCase();
      const isLoad = /^(LD|LDI|LDP|LDF)$/.test(op) || /^LD(<>|>=|<=|=|>|<)$/.test(op);
      if (isLoad && hadOut) { out.push(cur); cur = []; hadOut = false; }
      cur.push(l);
      if (!/^(LD|LDI|LDP|LDF|AND|ANI|ANDP|ANDF|OR|ORI|ORP|ORF|ANB|ORB|MPS|MRD|MPP)$/.test(op) && !/^(LD|AND|OR)(<>|>=|<=|=|>|<)$/.test(op)) hadOut = true;
    }
    if (cur.length) out.push(cur);
    return out;
  }
  function grid(lines) { const g = L.fromIL(lines.join("\n")); return g.rungs || []; }

  function fromIL(text) {
    const lines = text.split("\n").map((x) => x.split(";")[0].trim()).filter(Boolean);
    const model = { block: [], steps: [], trans: [], after: [] };
    const firstStl = lines.findIndex((l) => /^STL\s/i.test(l)), ret = lines.findIndex((l) => /^RET$/i.test(l));
    if (firstStl < 0) return { model: null, warnings: ["這段程式沒有 STL，不是步進程式，請用梯形圖編輯"] };
    model.block = grid(lines.slice(0, firstStl));
    model.after = ret >= 0 ? grid(lines.slice(ret + 1)) : [];
    const body = lines.slice(firstStl, ret >= 0 ? ret : lines.length);
    const step = (s) => { let x = model.steps.find((t) => t.s === s); if (!x) { x = { s, name: "", act: [] }; model.steps.push(x); } return x; };
    let i = 0, n = 0;
    const warnings = [];
    while (i < body.length) {
      const group = [];
      while (i < body.length && /^STL\s/i.test(body[i])) { group.push(body[i].split(/\s+/)[1].toUpperCase()); i++; }
      const sec = [];
      while (i < body.length && !/^STL\s/i.test(body[i])) sec.push(body[i++]);
      group.forEach(step);
      for (const ch of chunks(sec)) {
        const outs = ch.filter((l) => /^(SET|OUT)\s+S\d+/i.test(l));
        if (outs.length) {
          const cond = ch.filter((l) => !/^(SET|OUT)\s+S\d+/i.test(l));
          const to = outs.map((l) => l.split(/\s+/)[1].toUpperCase());
          const g = L.fromIL(cond.concat(["TRAN"]).join("\n"));
          const rungs = (g.rungs || []).map((rg) => { rg.out = rg.out.map((o) => (o && o.op === "FN" && o.text === "TRAN" ? { op: "TRAN" } : o)); return rg; });
          if (ch.length !== cond.length + outs.length) warnings.push("移轉條件裡混了其他輸出");
          model.trans.push({ id: ++n, from: group.slice(), to, cond: rungs });
        } else if (group.length > 1) {
          warnings.push(`${group.join("、")} 合併的地方只能放移轉條件`);
        } else {
          step(group[0]).act.push(...grid(ch));
        }
      }
    }
    return { model, warnings };
  }

  function compile(model) {
    const il = [], errors = [];
    const order = model.steps.map((s) => s.s);
    const add = (where, rungs, tran) => {
      const r = L.compile(rungs, tran);
      r.errors.forEach((e) => errors.push(`${where}：${e.msg}`));
      if (r.il) il.push(...r.il.split("\n"));
    };
    add("梯形圖區塊", model.block);
    const tranLines = (t, fromIdx) => t.to.map((s) => (order.indexOf(s) <= fromIdx ? "OUT " : "SET ") + s);
    const done = new Set();
    model.steps.forEach((st, si) => {
      const own = model.trans.filter((t) => t.from.length === 1 && t.from[0] === st.s);
      if (st.act.length || own.length) il.push("STL " + st.s);   // a waiting step of a parallel merge needs no block of its own
      add(`步 ${st.s} 的動作`, st.act);
      for (const t of model.trans) {
        if (done.has(t)) continue;
        if (t.from.length === 1 && t.from[0] === st.s) {
          if (!t.to.length) errors.push(`移轉 ${t.id}：還沒選要去哪一步`);
          if (!t.cond.length) errors.push(`移轉 ${t.id}：還沒有條件`);
          add(`移轉 ${t.id}`, t.cond, tranLines(t, si));
          done.add(t);
        }
      }
      for (const t of model.trans) {
        if (done.has(t) || t.from.length < 2) continue;
        const last = Math.max(...t.from.map((s) => order.indexOf(s)));
        if (last !== si) continue;
        t.from.forEach((s) => il.push("STL " + s));
        add(`移轉 ${t.id}（並行合併）`, t.cond, tranLines(t, si));
        done.add(t);
      }
    });
    model.trans.filter((t) => !done.has(t)).forEach((t) => errors.push(`移轉 ${t.id}：起點的步不存在`));
    il.push("RET");
    add("RET 之後的梯形圖", model.after);
    return { il: il.join("\n"), errors };
  }

  /* ---------------- UI ---------------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function blank() {
    const g = L.fromIL("LD M8002\nSET S0");
    return { block: g.rungs, steps: [{ s: "S0", name: "待機", act: [] }], trans: [], after: [] };
  }
  function editor(root, opts) {
    opts = opts || {};
    let model = opts.model || blank(), sel = { k: "step", i: 0 }, zoom = null;
    root.classList.add("sfce");
    root.innerHTML = `<div class="sf-bar"><button type="button" class="le-b" data-a="step"><b>□</b><small>＋步</small></button><button type="button" class="le-b" data-a="tran"><b>┼</b><small>＋移轉</small></button>
      <button type="button" class="le-b" data-a="del"><b>✕</b><small>刪除</small></button><button type="button" class="le-b" data-a="block"><b>▤</b><small>梯形圖區塊</small></button><button type="button" class="le-b" data-a="after"><b>▤</b><small>RET 之後</small></button></div>
      <div class="sf-grid"><div class="sf-chart"></div><div class="sf-side"><div class="sf-form"></div><div class="sf-zoom-h"></div><div class="sf-zoom"></div></div></div>`;
    const chart = root.querySelector(".sf-chart"), form = root.querySelector(".sf-form"), zh = root.querySelector(".sf-zoom-h"), zbox = root.querySelector(".sf-zoom");
    const outgoing = (s) => model.trans.filter((t) => t.from.includes(s) && Math.max(...t.from.map((x) => model.steps.findIndex((y) => y.s === x))) === model.steps.findIndex((y) => y.s === s));
    function drawChart() {
      const parts = [];
      model.steps.forEach((st, i) => {
        const init = sNum(st.s) <= 9, on = sel.k === "step" && sel.i === i;
        const outs = outgoing(st.s);
        parts.push(`<div class="sf-step${init ? " init" : ""}${on ? " sel" : ""}" data-step="${i}"><b>${esc(st.s)}</b> ${esc(st.name || "")}<small>${st.act.length ? st.act.length + " 條動作" : "沒有動作"}</small></div>`);
        if (outs.length > 1) parts.push(`<div class="sf-note">選擇分支：先成立的那條先走</div>`);
        outs.forEach((t) => {
          const ti = model.trans.indexOf(t), son = sel.k === "tran" && sel.i === ti;
          const to = t.to.map((s) => (model.steps.findIndex((x) => x.s === s) <= i && t.to.length === 1 ? "↩ " + s : s)).join("、");
          parts.push(`<div class="sf-tran${son ? " sel" : ""}" data-tran="${ti}"><span class="bar"></span>移轉 ${t.id}${t.from.length > 1 ? `（${t.from.join("＋")} 並行合併）` : ""} → ${esc(to || "？")}${t.to.length > 1 ? "（並行分支）" : ""}<small>${t.cond.length ? "" : "還沒寫條件"}</small></div>`);
        });
      });
      chart.innerHTML = parts.join("");
      chart.querySelectorAll("[data-step]").forEach((el) => el.onclick = () => { sel = { k: "step", i: +el.dataset.step }; refresh(); });
      chart.querySelectorAll("[data-tran]").forEach((el) => el.onclick = () => { sel = { k: "tran", i: +el.dataset.tran }; refresh(); });
    }
    function stepChecks(list, name) {
      return model.steps.map((s) => `<label class="sf-ck"><input type="checkbox" data-${name}="${s.s}"${list.includes(s.s) ? " checked" : ""}> ${s.s}</label>`).join("");
    }
    function drawForm() {
      if (sel.k === "step") {
        const st = model.steps[sel.i];
        form.innerHTML = `<label>步號 <input class="sf-s" value="${esc(st.s)}" style="width:70px"></label> <label>註解 <input class="sf-n" value="${esc(st.name || "")}" style="width:140px"></label>
          <p class="hint">S0～S9 是初始步（雙框），一般步用 S20 以後。</p>`;
        form.querySelector(".sf-s").onchange = (e) => {
          const v = e.target.value.trim().toUpperCase();
          if (!isState(v) || model.steps.some((x, k) => x.s === v && k !== sel.i)) { e.target.value = st.s; return; }
          model.trans.forEach((t) => { t.from = t.from.map((x) => (x === st.s ? v : x)); t.to = t.to.map((x) => (x === st.s ? v : x)); });
          st.s = v; changed(); drawChart();
        };
        form.querySelector(".sf-n").oninput = (e) => { st.name = e.target.value; drawChart(); };
        zh.textContent = `步 ${st.s} 的動作（Zoom）：這一步作用時才執行。不用寫 STL，直接放線圈或指令。`;
      } else if (sel.k === "tran") {
        const t = model.trans[sel.i];
        form.innerHTML = `<div><b>從</b> ${stepChecks(t.from, "f")}</div><div><b>到</b> ${stepChecks(t.to, "t")}</div>
          <p class="hint">選兩個以上的「到」= 並行分支；兩個以上的「從」= 並行合併。往回跳（JUMP）會自動用 OUT S。</p>`;
        form.querySelectorAll("[data-f]").forEach((c) => c.onchange = () => { t.from = [...form.querySelectorAll("[data-f]:checked")].map((x) => x.dataset.f); changed(); drawChart(); });
        form.querySelectorAll("[data-t]").forEach((c) => c.onchange = () => { t.to = [...form.querySelectorAll("[data-t]:checked")].map((x) => x.dataset.t); changed(); drawChart(); });
        zh.textContent = `移轉 ${t.id} 的條件（Zoom）：接點寫完，右邊按 F7 放 TRAN。`;
      } else {
        form.innerHTML = `<p class="hint">${sel.k === "block" ? "梯形圖區塊：每個掃描都執行。至少要有 M8002 → SET S0 把初始步打開；急停、異常也寫在這裡。" : "RET 之後的一般梯形圖：例如用步的狀態點燈。"}</p>`;
        zh.textContent = sel.k === "block" ? "梯形圖區塊" : "RET 之後";
      }
    }
    function target() {
      if (sel.k === "step") return { get: () => model.steps[sel.i].act, set: (r) => { model.steps[sel.i].act = r; }, tran: null };
      if (sel.k === "tran") return { get: () => model.trans[sel.i].cond, set: (r) => { model.trans[sel.i].cond = r; }, tran: ["SET S?"] };
      if (sel.k === "block") return { get: () => model.block, set: (r) => { model.block = r; }, tran: null };
      return { get: () => model.after, set: (r) => { model.after = r; }, tran: null };
    }
    function drawZoom() {
      const tg = target();
      zbox.innerHTML = "";
      zoom = L.editor(zbox, { rungs: tg.get(), tran: tg.tran, comment: opts.comment, onConvert: opts.onConvert, onChange: () => { tg.set(zoom ? zoom.rungs : tg.get()); changed(); } });
      tg.set(zoom.rungs);
    }
    function refresh() { drawChart(); drawForm(); drawZoom(); }
    function changed() { if (opts.onChange) opts.onChange(); }
    root.querySelectorAll(".sf-bar [data-a]").forEach((b) => b.onclick = () => {
      const a = b.dataset.a;
      if (a === "step") {
        const used = model.steps.map((s) => sNum(s.s)), nx = Math.max(19, ...used.filter((x) => x >= 10)) + 1;
        const at = sel.k === "step" ? sel.i + 1 : model.steps.length;
        model.steps.splice(at, 0, { s: "S" + nx, name: "", act: [] });
        sel = { k: "step", i: at };
      } else if (a === "tran") {
        const from = sel.k === "step" ? model.steps[sel.i].s : model.steps[0].s, fi = model.steps.findIndex((s) => s.s === from);
        const nxt = model.steps[fi + 1] ? [model.steps[fi + 1].s] : [];
        const id = Math.max(0, ...model.trans.map((t) => t.id)) + 1;
        model.trans.push({ id, from: [from], to: nxt, cond: [] });
        sel = { k: "tran", i: model.trans.length - 1 };
      } else if (a === "del") {
        if (sel.k === "step" && model.steps.length > 1) {
          const s = model.steps[sel.i].s;
          model.steps.splice(sel.i, 1);
          model.trans = model.trans.filter((t) => !t.from.includes(s)).map((t) => ({ ...t, to: t.to.filter((x) => x !== s) }));
          sel = { k: "step", i: Math.max(0, sel.i - 1) };
        } else if (sel.k === "tran") { model.trans.splice(sel.i, 1); sel = { k: "step", i: 0 }; }
      } else sel = { k: a, i: 0 };
      changed(); refresh();
    });
    refresh();
    return {
      get model() { return model; },
      set(m) { model = m || blank(); sel = { k: "step", i: 0 }; refresh(); },
      compile() { return compile(model); },
      focus() { if (zoom) zoom.focus(); },
    };
  }

  const api = { fromIL, compile, editor, blank };
  if (typeof module !== "undefined") module.exports = api;
  return api;
})();
