"use strict";
/* Simulator page: ladder / SFC / instruction list editors, F4 converts and loads the program into the engine
   (engine/sandbox.py), F3 monitors. The three editors convert into each other through the instruction list. */
let py = null, sb = null, M = null, tab = "ladder", mode = "write", layout = null, last = 0, chart = null;
const $ = (id) => document.getElementById(id);
const escS = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let led = null, sfe = null, lstl = null;
const comment = (dev) => {
  if (!M || !dev) return "";
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
function showTab(t) {
  const cur = currentIL();
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
function convert() {
  const cur = currentIL();
  if (cur.errors && cur.errors.length) {
    $("errors").innerHTML = cur.errors.map((e) => `<li>${e.rung !== undefined ? `第 ${e.rung + 1} 條梯級：` : ""}${escS(e.msg)}</li>`).join("");
    if (tab === "ladder") led.showErrors(cur.errors);
    if (tab === "stl") lstl.showErrors(cur.errors);
    return;
  }
  const out = JSON.parse(sb.compile(cur.il));
  if (out.errors.length) {
    $("errors").innerHTML = out.errors.map((e) => `<li>${e.line ? `指令第 ${e.line} 行：` : ""}${escS(e.msg)}</li>`).join("") + `<li class="hint">轉成的指令表可以在「指令表」分頁看。</li>`;
    return;
  }
  $("errors").innerHTML = "";
  layout = out.rungs;
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
  } else if (kind === "toggle") b.addEventListener("click", () => sb.toggle(dev));
}
function openMachine(id) {
  M = JSON.parse(sb.machine(id));
  $("desc").textContent = M.desc;
  $("note").textContent = "範例：" + M.example_note;
  $("inputs").innerHTML = M.inputs.map(([dev, label, kind]) => `<button type="button" class="inp ${kind}" data-dev="${dev}" data-kind="${kind}" ${kind === "sensor" ? "disabled" : ""}><i></i><span><b>${dev}</b> ${escS(label)}</span><small>${{ hold: "按住", toggle: "切換", sensor: "感測器" }[kind]}</small></button>`).join("");
  $("inputs").querySelectorAll(".inp").forEach(wireInput);
  $("outputs").innerHTML = M.outputs.map(([dev, label]) => `<li data-dev="${dev}"><i></i><b>${dev}</b> ${escS(label)}</li>`).join("");
  $("plant").hidden = !M.plant;
  $("pfaults").innerHTML = (M.faults || []).map(([k, t]) => `<label class="check small"><input type="checkbox" data-f="${k}"> 製造故障：${escS(t)}</label>`).join("");
  $("pfaults").querySelectorAll("input").forEach((c) => c.addEventListener("change", () => sb.set_fault(c.dataset.f, c.checked)));
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("ll_sim_" + id) || "null"); } catch (e) { saved = null; }
  const il = saved && saved.il && saved.il.trim() ? saved.il : M.example;
  const want = saved && saved.tab ? saved.tab : (/STL/.test(il) ? "sfc" : "ladder");
  tab = want;
  ["ladder", "stl", "sfc", "il"].forEach((t) => { if (t === want) loadInto(t, il); });
  if (want !== "il") loadInto("il", il);
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("here", b.dataset.t === tab));
  setMode("write");
  convert();
}
function frame(t) {
  const dt = Math.min(100, last ? t - last : 16); last = t;
  if (sb) {
    sb.tick(Math.round(dt / 10) * 10);
    const st = JSON.parse(sb.state());
    if (st) {
      $("inputs").querySelectorAll(".inp").forEach((b) => b.classList.toggle("on", !!st.inputs[b.dataset.dev]));
      $("outputs").querySelectorAll("li").forEach((li) => li.classList.toggle("on", !!st.outputs[li.dataset.dev]));
      $("steps").textContent = st.steps.length ? "作用中的步：" + st.steps.join("、") : "沒有作用中的步";
      $("words").textContent = st.words && M.id === "stepper" ? `D8140（脈波計數）= ${st.words.D8140}　M8029（定位完成）= ${st.words.M8029 ? "ON" : "OFF"}` : "";
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
$("example").onclick = () => { ["ladder", "stl", "sfc", "il"].forEach((t) => loadInto(t, M.example)); if (!/STL/.test(M.example) && tab === "sfc") tab = "ladder"; showTab(tab); convert(); };
$("clear").onclick = () => { led.set([]); lstl.set([]); sfe.set(SfcEdit.blank()); $("il").value = ""; setMode("write"); };
$("il").addEventListener("input", () => save());
(async () => {
  try {
    py = await bootPython();
    sb = py.runPython("from sandbox import Sandbox; Sandbox()");
    const cat = JSON.parse(py.runPython("from sandbox import catalog; catalog()"));
    $("machine").innerHTML = cat.map((m) => `<option value="${m.id}">${escS(m.title)}</option>`).join("");
    led = LEdit.editor($("ed-ladder"), { comment, onConvert: convert, onChange: () => {} });
    lstl = LEdit.editor($("ed-stl"), { comment, onConvert: convert, onChange: () => {}, stl: true });
    sfe = SfcEdit.editor($("ed-sfc"), { comment, onConvert: convert, onChange: () => {} });
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
