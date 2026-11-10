"use strict";
/* Simulator page: ladder / SFC / instruction list editors, F4 converts and loads the program into the engine
   (engine/sandbox.py), F3 monitors. The three editors convert into each other through the instruction list. */
let py = null, sb = null, M = null, tab = "ladder", mode = "write", layout = null, last = 0, chart = null;
const $ = (id) => document.getElementById(id);
const escS = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let led = null, sfe = null, lstl = null, fx = null, loadedIL = null, errLed = false, lastOut = {};
const isFree = () => M && M.id === "free";
const comment = (dev) => {
  if (!M || !dev) return "";
  if (isFree()) return Kit.label(String(dev).toUpperCase().replace(/^([XY])0*(\d+)$/, (m, k, d) => k + d.padStart(3, "0")));
  const n = String(dev).toUpperCase().replace(/^([XY])0*(\d)/, (m, k, d) => k + d.padStart(3, "0").slice(-3));
  const f = M.inputs.concat(M.outputs).find((r) => r[0] === n || r[0] === dev);
  return f ? f[1] : "";
};

function save() { try { localStorage.setItem("ll_sim_" + M.id, JSON.stringify({ tab, il: currentIL().il })); } catch (e) { /* private mode */ } }
function currentIL() {
  if (tab === "ladder") return led.compile();
  if (tab === "stl") return lstl.compile();
  if (tab === "sfc") { const r = sfe.compile(); return { il: r.il, errors: r.errors.map((m) => ({ msg: m })) }; }
  return { il: $("il").value, errors: [] };
}
function loadInto(t, il) {
  const warn = [];
  if (t === "ladder" || t === "stl") { const g = LEdit.fromIL(il); if (!g.rungs) return g.warnings; (t === "ladder" ? led : lstl).set(g.rungs); warn.push(...g.warnings); }
  else if (t === "sfc") { const g = SfcEdit.fromIL(il); if (!g.model) return g.warnings; sfe.set(g.model); warn.push(...g.warnings); }
  else $("il").value = il;
  return warn.length ? warn : null;
}
/* example for a tab: step tabs (STL, SFC) get a step program even when the machine's example is a plain ladder */
const stepTab = (t) => t === "stl" || t === "sfc";
function exampleFor(t) { return stepTab(t) && M.example_step ? M.example_step : M.example; }
function noteFor(t) { return "範例：" + (stepTab(t) && M.example_step ? M.example_step_note : M.example_note); }
function showTab(t) {
  let cur = currentIL();
  if (t !== tab && stepTab(t) && !/\bSTL\b/i.test(cur.il)) {
    /* a ladder without steps has nothing to show as steps: start the step tabs from the plain step example */
    const ex = exampleFor(t);
    ["stl", "sfc", "il"].forEach((x) => loadInto(x, ex));
    tab = t; cur = { il: ex, errors: [] };
  }
  $("note").textContent = noteFor(t);
  if (t !== tab) {
    const problem = cur.il.trim() ? loadInto(t, cur.il) : null;
    if (problem && (t === "ladder" || t === "stl" || t === "sfc") && !(t === "sfc" ? sfe.model : (t === "ladder" ? led : lstl).rungs.length)) { $("errors").innerHTML = problem.map((p) => `<li>${escS(p)}</li>`).join(""); return; }
    if (problem && problem.length) $("errors").innerHTML = problem.map((p) => `<li>${escS(p)}</li>`).join("");
    else $("errors").innerHTML = "";
    if (!cur.il.trim() && t === "sfc") sfe.set(SfcEdit.blank());
  }
  tab = t;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("here", b.dataset.t === t));
  if (mode === "monitor") setMode("write");
  showEditors();
  save();
}
function showEditors() {
  const mon = mode === "monitor";
  $("ed-ladder").hidden = mon || tab !== "ladder";
  $("ed-stl").hidden = mon || tab !== "stl";
  $("ed-sfc").hidden = mon || tab !== "sfc";
  $("ed-il").hidden = mon || tab !== "il";
  $("monitor").hidden = !mon;
  $("mon-sfc").hidden = !(mon && tab === "sfc" && chart && chart.blocks);
  document.querySelector("#monitor .ladder-wrap").hidden = mon && tab === "sfc" && chart && chart.blocks;
}
function setMode(m) {
  mode = m;
  $("bWrite").classList.toggle("here", m === "write"); $("bMon").classList.toggle("here", m === "monitor");
  $("state").textContent = m === "write" ? "寫入模式：可以修改程式。改完按 F4 轉換。" : "監看模式（唯讀）：亮的接點、線圈是通電的。要修改按 F2。";
  showEditors();
}
/* the soft PLC runs what was last written: warn while the editor shows something else */
const norm = (il) => String(il || "").split("\n").map((l) => l.trim().replace(/\s+/g, " ")).filter(Boolean).join("\n");
function checkPending() {
  if (loadedIL === null || !led) return;
  let now = "";
  try { now = currentIL().il; } catch (e) { now = ""; }
  $("pending").hidden = norm(now) === norm(loadedIL);
}
function convert() {
  const cur = currentIL();
  if (cur.errors && cur.errors.length) {
    errLed = true;
    $("errors").innerHTML = cur.errors.map((e) => `<li>${e.rung !== undefined ? `第 ${e.rung + 1} 條梯級：` : ""}${escS(e.msg)}</li>`).join("");
    if (tab === "ladder") led.showErrors(cur.errors);
    if (tab === "stl") lstl.showErrors(cur.errors);
    return;
  }
  const out = JSON.parse(sb.compile(cur.il));
  if (out.errors.length) {
    errLed = true;
    $("errors").innerHTML = out.errors.map((e) => `<li>${e.line ? `指令第 ${e.line} 行：` : ""}${escS(e.msg)}</li>`).join("") + `<li class="hint">轉成的指令表可以在「指令表」分頁看。</li>`;
    return;
  }
  $("errors").innerHTML = "";
  errLed = false; loadedIL = cur.il;
  $("plcprog").textContent = cur.il.trim() ? cur.il.trim() + "\nEND" : "END";
  $("pending").hidden = true;
  layout = out.rungs;
  const wl = watchList(cur.il);
  sb.watch(JSON.stringify(wl));
  $("watch").innerHTML = wl.length ? wl.map((d) => `<tr data-w="${d}"><td><b>${d}</b></td><td class="v"></td></tr>`).join("") : '<tr><td class="hint">程式沒有用到 M、S、T、C、D</td></tr>';
  ladderComment = comment;
  renderRungs($("mon-ladder"), layout.map((r, i) => [r, i]), {});
  try { chart = JSON.parse(sb.sfc()); if (chart && chart.blocks && chart.blocks.length) renderSfc($("mon-sfc"), chart, comment); else chart = null; } catch (e) { chart = null; }
  if (tab === "ladder") led.markClean();
  if (tab === "stl") lstl.markClean();
  if (tab === "il") loadInto("il", cur.il);
  save();
  setMode("monitor");
}
function wireInput(b) {
  const dev = b.dataset.dev, kind = b.dataset.kind;
  if (kind === "hold") {
    const on = (e) => { e.preventDefault(); sb.set_input(dev, 1); try { b.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } };
    const off = () => sb.set_input(dev, 0);
    b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off);
  } else if (kind === "toggle" || kind === "switch") b.addEventListener("click", () => sb.toggle(dev));
}
/* devices the program uses, for the watch list */
function watchList(il) {
  const seen = [];
  (il.match(/\b[MSTCD]\d+\b/g) || []).forEach((d) => { if (!seen.includes(d) && !/^M8\d{3}$/.test(d)) seen.push(d); });
  return seen.sort((a, b) => "MSTCD".indexOf(a[0]) - "MSTCD".indexOf(b[0]) || +a.slice(1) - +b.slice(1));
}
/* free mode: the X buttons and Y lamps follow what the learner wired (Kit) */
const shortDev = (d) => d[0] + d.slice(1).replace(/^0+(?=\d)/, "");
function freeIO() {
  $("inputs").innerHTML = M.inputs.map(([dev]) => {
    const k = Kit.inputKind(dev), t = Kit.tag(dev);
    return `<button type="button" class="inp ${k}" data-dev="${dev}" data-kind="${k}" ${k === "sensor" ? "disabled" : ""} title="${escS(Kit.label(dev) || "切換開關：點一下 ON／OFF")}"><i></i><b>${shortDev(dev)}</b>${t ? `<small>${escS(t)}</small>` : ""}</button>`;
  }).join("");
  $("inputs").querySelectorAll(".inp").forEach((b) => {
    const dev = b.dataset.dev, k = b.dataset.kind;
    if (k === "switch") b.addEventListener("click", () => sb.toggle(dev));
    if (k === "hold") {
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); Kit.press(dev, true); try { b.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } });
      const up = () => Kit.press(dev, false);
      b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
    }
  });
  $("outputs").innerHTML = M.outputs.map(([dev]) => { const t = Kit.tag(dev); return `<li data-dev="${dev}" title="${escS(Kit.label(dev))}"><i></i><b>${shortDev(dev)}</b>${t ? `<small>${escS(t)}</small>` : ""}</li>`; }).join("");
  if (layout) { ladderComment = comment; renderRungs($("mon-ladder"), layout.map((r, i) => [r, i]), {}); }
  if (led) { led.redraw && led.redraw(); }
}
function kitPreset(il, note) {
  ["ladder", "stl", "sfc", "il"].forEach((t) => loadInto(t, il));
  tab = "ladder";
  showTab("ladder");
  convert();
  $("note").textContent = "範例：" + note;
}
function openMachine(id) {
  M = JSON.parse(sb.machine(id));
  $("desc").textContent = M.desc;
  $("note").textContent = "範例：" + M.example_note;
  const free = M.id === "free";
  $("inputs").classList.toggle("free-io", free); $("outputs").classList.toggle("free-io", free);
  $("plant-box").hidden = !M.plant;
  $("kit-box").hidden = !free;
  if (free) Kit.mount($("kit"), { xs: M.inputs.map((r) => r[0]), ys: M.outputs.map((r) => r[0]), onChange: freeIO, onPreset: kitPreset, onReset: (x) => sb.set_input(x, 0), onToggle: (x) => sb.toggle(x) });
  else Kit.unmount();
  if (free) freeIO();
  else {
    $("inputs").innerHTML = M.inputs.map(([dev, label, kind]) => `<button type="button" class="inp ${kind}" data-dev="${dev}" data-kind="${kind}" ${kind === "sensor" ? "disabled" : ""}><i></i><span><b>${dev}</b> ${escS(label)}</span><small>${{ hold: "按住", toggle: "切換", sensor: "感測器" }[kind]}</small></button>`).join("");
    $("inputs").querySelectorAll(".inp").forEach(wireInput);
    $("outputs").innerHTML = M.outputs.map(([dev, label]) => `<li data-dev="${dev}"><i></i><b>${dev}</b> ${escS(label)}</li>`).join("");
  }
  $("pfaults").innerHTML = (M.faults || []).map(([k, t]) => `<label class="check small"><input type="checkbox" data-f="${k}"> 製造故障：${escS(t)}</label>`).join("");
  $("pfaults").querySelectorAll("input").forEach((c) => c.addEventListener("change", () => sb.set_fault(c.dataset.f, c.checked)));
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("ll_sim_" + id) || "null"); } catch (e) { saved = null; }
  const il = saved && saved.il && saved.il.trim() ? saved.il : M.example;
  const want = saved && saved.tab ? saved.tab : (/STL/.test(il) ? "sfc" : "ladder");
  tab = want;
  ["ladder", "stl", "sfc", "il"].forEach((t) => { if (t === want) loadInto(t, il); });
  if (want !== "il") loadInto("il", il);
  $("note").textContent = noteFor(tab);
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("here", b.dataset.t === tab));
  setMode("write");
  convert();
}
function frame(t) {
  const dt = Math.min(100, last ? t - last : 16); last = t;
  if (sb) {
    if (isFree()) { const want = Kit.step(dt, lastOut); Object.keys(want).forEach((d) => sb.set_input(d, want[d])); }
    sb.tick(Math.round(dt / 10) * 10);
    const st = JSON.parse(sb.state());
    if (fx) {
      const leds = {}, run = !st || st.run !== false;
      if (st) { Object.keys(st.inputs).forEach((d) => { leds[shortDev(d)] = st.inputs[d]; }); Object.keys(st.outputs).forEach((d) => { leds[shortDev(d)] = st.outputs[d]; }); }
      fx.update(leds, {}, { RUN: run && !!st, SW: run, ERR: errLed && (t % 1000 < 500) });
      $("bRun").textContent = run ? "切到 STOP" : "切到 RUN";
      $("plcinfo").textContent = st ? (run ? `RUN　執行 ${(st.time / 1000).toFixed(1)} 秒` : "STOP：輸出全部 OFF") : "沒有程式";
    }
    if (st) {
      lastOut = st.outputs;
      if (isFree()) Kit.update(st);
      $("inputs").querySelectorAll(".inp").forEach((b) => b.classList.toggle("on", !!st.inputs[b.dataset.dev]));
      $("outputs").querySelectorAll("li").forEach((li) => li.classList.toggle("on", !!st.outputs[li.dataset.dev]));
      $("steps").textContent = st.steps.length ? "作用中的步：" + st.steps.join("、") : "沒有作用中的步";
      $("words").textContent = st.words && M.id === "stepper" ? `D8140（脈波計數）= ${st.words.D8140}　M8029（定位完成）= ${st.words.M8029 ? "ON" : "OFF"}` : "";
      if (st.watch) $("watch").querySelectorAll("[data-w]").forEach((tr) => {
        const d = tr.dataset.w, v = st.watch[d];
        if (!v) return;
        tr.querySelector(".v").innerHTML = /^[MS]/.test(d) ? (v[0] ? '<span class="won">ON</span>' : "OFF") : /^[TC]/.test(d) ? `${v[1]}　接點 ${v[0] ? '<span class="won">ON</span>' : "OFF"}` : String(v[0]);
      });
      if (mode === "monitor" && layout) { updateRungs($("mon-ladder"), st, layout, -1); if (chart && !$("mon-sfc").hidden) updateSfc($("mon-sfc"), st); }
      if (st.plant) drawPlant($("plant").getContext("2d"), st.plant);
    }
  }
  requestAnimationFrame(frame);
}
document.addEventListener("keydown", (e) => {
  if (!sb) return;
  if (e.key === "F4") { e.preventDefault(); convert(); }
  if (e.key === "F3") { e.preventDefault(); if (layout) setMode("monitor"); }
  if (e.key === "F2") { e.preventDefault(); setMode("write"); }
});
$("bConv").onclick = () => convert();
$("bMon").onclick = () => { if (layout) setMode("monitor"); };
$("bWrite").onclick = () => setMode("write");
document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => showTab(b.dataset.t)));
$("example").onclick = () => {
  const ex = exampleFor(tab);
  ["ladder", "stl", "sfc", "il"].forEach((t) => loadInto(t, ex));
  if (!/\bSTL\b/.test(ex) && tab === "sfc") tab = "ladder";
  $("note").textContent = noteFor(tab);
  showTab(tab); convert();
};
$("clear").onclick = () => { led.set([]); lstl.set([]); sfe.set(SfcEdit.blank()); $("il").value = ""; setMode("write"); };
$("il").addEventListener("input", () => { save(); checkPending(); });
(async () => {
  try {
    py = await bootPython();
    sb = py.runPython("from sandbox import Sandbox; Sandbox()");
    const cat = JSON.parse(py.runPython("from sandbox import catalog; catalog()"));
    $("machine").innerHTML = cat.map((m) => `<option value="${m.id}">${escS(m.title)}</option>`).join("");
    led = LEdit.editor($("ed-ladder"), { comment, onConvert: convert, onChange: checkPending });
    lstl = LEdit.editor($("ed-stl"), { comment, onConvert: convert, onChange: checkPending, stl: true });
    sfe = SfcEdit.editor($("ed-sfc"), { comment, onConvert: convert, onChange: checkPending });
    fx = FX3S.live($("fxlive"));
    const runStop = () => { const st = JSON.parse(sb.state()); sb.run_mode(!(st && st.run !== false)); };
    $("bRun").onclick = runStop;
    fx.svg.addEventListener("click", (e) => { if (e.target.closest(".fx-sw,.fx-knob,.fx-cover")) runStop(); });
    const want = (location.hash || "").slice(1);
    const first = cat.some((m) => m.id === want) ? want : cat[0].id;
    $("machine").value = first;
    $("machine").onchange = () => { location.hash = $("machine").value; openMachine($("machine").value); };
    $("loading").hidden = true;
    openMachine(first);
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    $("loading").textContent = "模擬引擎載入失敗，請重新整理。";
  }
})();
