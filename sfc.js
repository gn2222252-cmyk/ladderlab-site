"use strict";
/* SFC chart view of a step ladder program (engine/sfc.py gives the structure), laid out like GX Works2:
a ladder block that starts the initial step, then steps (boxes) and transitions (short bars ending in TRAN).
Parallel branches are drawn side by side between double bars, selection branches side by side under a single bar,
and a return to an earlier step is a jump "↳ S0", as GX Works2 draws it. */
function sfcEsc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function renderSfc(root, chart, comment) {
  comment = comment || (() => "");
  if (!chart || !chart.blocks.length) { root.innerHTML = '<p class="empty">這個程式沒有 STL 步進，所以沒有 SFC 圖。</p>'; return; }
  const blockOf = {};
  chart.blocks.forEach((b) => b.states.forEach((s) => { blockOf[s] = b; }));
  const placed = new Set();

  function stepHtml(b) {
    const initial = b.states.every((s) => +s.slice(1) <= 9);
    const name = b.states.map((s) => `${s}${comment(s) ? `<small>${sfcEsc(comment(s))}</small>` : ""}`).join("<i>＋</i>");
    const acts = b.actions.map((a) => `<li data-r="${a.r}">${a.cond ? `<span class="c">${sfcEsc(a.cond)} →</span> ` : ""}${a.do.map(sfcEsc).join("、")}</li>`).join("");
    return `<div class="sfc-step${initial ? " initial" : ""}" data-states="${b.states.join(" ")}"><div class="sfc-box">${name}</div>` +
      (acts ? `<ul class="sfc-acts">${acts}</ul>` : "") + `</div>`;
  }
  function trHtml(b, t) {
    return `<div class="sfc-tr" data-r="${t.r}" data-from="${b.states.join(" ")}"><span class="sfc-tick">┼</span>` +
      `<span class="sfc-cond">${sfcEsc(t.cond)} ─[TRAN]</span>${t.also.length ? `<span class="c">同時 ${t.also.map(sfcEsc).join("、")}</span>` : ""}</div>`;
  }
  const jumpHtml = (s) => `<div class="sfc-jump">↳ 跳到 ${s}</div>`;

  /* Follows the chart from state s. Stops at a parallel convergence (returned as join) or at a step already drawn. */
  function seq(s, depth) {
    const out = [];
    let join = null;
    while (s && depth < 40) {
      const b = blockOf[s];
      if (!b) { out.push(`<div class="sfc-note">（${s} 沒有寫在程式裡）</div>`); break; }
      if (b.states.length > 1 && !placed.has(b)) { join = b; break; }
      if (placed.has(b)) { out.push(jumpHtml(s)); break; }
      placed.add(b);
      out.push(stepHtml(b));
      const ts = b.transitions;
      if (!ts.length) break;
      if (ts.length === 1 && ts[0].to.length === 1) {
        out.push(trHtml(b, ts[0]));
        s = ts[0].to[0];
        if (ts[0].jump && placed.has(blockOf[s])) { out.push(jumpHtml(s)); break; }
        continue;
      }
      if (ts.length === 1) {                     // parallel divergence
        out.push(trHtml(b, ts[0]));
        out.push('<div class="sfc-dbar">並行分支：同時開始</div>');
        let merge = null;
        const cols = ts[0].to.map((t) => { const r = seq(t, depth + 1); merge = merge || r.join; return `<div class="sfc-col">${r.html}</div>`; });
        out.push(`<div class="sfc-cols par">${cols.join("")}</div>`);
        if (!merge) break;
        out.push('<div class="sfc-dbar">並行合併：每一條都完成才往下</div>');
        placed.add(merge);
        out.push(stepHtml(merge));
        if (!merge.transitions.length) break;
        out.push(trHtml(merge, merge.transitions[0]));
        s = merge.transitions[0].to[0];
        continue;
      }
      out.push('<div class="sfc-sbar">選擇分支：哪個條件先成立就走哪條</div>');
      const cols = ts.map((t) => {
        const r = seq(t.to[0], depth + 1);
        return `<div class="sfc-col">${trHtml(b, t)}${r.html}</div>`;
      });
      out.push(`<div class="sfc-cols sel">${cols.join("")}</div>`);
      break;
    }
    return { html: out.join(""), join };
  }

  const parts = [`<div class="sfc-ladder"><div class="sfc-tag">梯形圖區塊（GX Works2 的 000:Block）：每個掃描都執行</div>` +
    (chart.ladder.length ? chart.ladder.map((l) => `<div class="sfc-lrow" data-r="${l.r}">${sfcEsc(l.text)}</div>`).join("")
      : '<div class="sfc-lrow warn">⚠ 沒有啟動初始步的梯形圖（例如 M8002 → SET S0），SFC 一步都不會亮</div>') + `</div>`];
  const starts = chart.initial.length ? chart.initial : [chart.blocks[0].states[0]];
  for (const s of starts) parts.push(`<div class="sfc-chain">${seq(s, 0).html}</div>`);
  const rest = chart.blocks.filter((b) => !placed.has(b));
  for (const b of rest) parts.push(`<div class="sfc-chain"><div class="sfc-note">另一段流程：</div>${seq(b.states[0], 0).html}</div>`);
  root.innerHTML = `<div class="sfc">${parts.join("")}</div>`;
}

function updateSfc(root, st) {
  if (!st) return;
  const active = new Set(st.steps || []);
  root.querySelectorAll(".sfc-step").forEach((el) => el.classList.toggle("on", el.dataset.states.split(" ").every((s) => active.has(s))));
  root.querySelectorAll(".sfc-tr").forEach((el) => {
    el.classList.toggle("ready", el.dataset.from.split(" ").every((s) => active.has(s)) && !!st.power[+el.dataset.r]);
  });
  root.querySelectorAll(".sfc-acts li[data-r]").forEach((el) => el.classList.toggle("on", !!st.power[+el.dataset.r]));
}
