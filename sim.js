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
  rangeWarn();
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
/* expansion board terminals: the page keeps them at X370-X373 / Y370-Y371, the program uses M8112-M8117 */
const BOARD_NAMES = { X370: "BX0", X371: "BX1", X372: "BX2", X373: "BX3", Y370: "BY0", Y371: "BY1" };
const BOARD_M = { X370: "M8112", X371: "M8113", X372: "M8114", X373: "M8115", Y370: "M8116", Y371: "M8117" };
const shortDev = (d) => BOARD_NAMES[d] || d[0] + d.slice(1).replace(/^0+(?=\d)/, "");
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
/* free mode: which PLC the soft PLC is. Main units number their X / Y from 0 (octal); a board or an expansion block
   starts at the next multiple of 8 after what is already there, which is how Mitsubishi numbers FX expansions. */
const PLC_MODELS = [["FX3S-10M", 6, 4], ["FX3S-14M", 8, 6], ["FX3S-20M", 12, 8], ["FX3S-30M", 16, 14],
  ["FX3G-14M", 8, 6], ["FX3G-24M", 14, 10], ["FX3G-40M", 24, 16], ["FX3G-60M", 36, 24],
  ["FX3U-16M", 8, 8], ["FX3U-32M", 16, 16], ["FX3U-48M", 24, 24], ["FX3U-64M", 32, 32], ["FX3U-80M", 40, 40], ["FX3U-128M", 64, 64]];
const PLC_EXT = {
  "4EX-BD": { x: 4, y: 0, bd: true, n: () => "FX3G-4EX-BD（輸入擴充板 4 點，M8112～M8115）" },
  "2EYT-BD": { x: 0, y: 2, bd: true, n: () => "FX3G-2EYT-BD（輸出擴充板 2 點，M8116～M8117）" },
  "8EX": { x: 8, y: 0, n: () => "FX2N-8EX（輸入擴充模組 8 點）" }, "16EX": { x: 16, y: 0, n: () => "FX2N-16EX（輸入擴充模組 16 點）" },
  "8EYR": { x: 0, y: 8, n: () => "FX2N-8EYR（輸出擴充模組 8 點）" }, "16EYR": { x: 0, y: 16, n: () => "FX2N-16EYR（輸出擴充模組 16 點）" },
};
let plcCfg = { model: "FX3S-20M", ext: [] };   // the school's FX3S-20MT/ES
try { const c = JSON.parse(localStorage.getItem("ll_plc") || "null"); if (c && PLC_MODELS.some((m) => m[0] === c.model)) plcCfg = { model: c.model, ext: (c.ext || []).filter((e) => PLC_EXT[e]) }; } catch (e) { /* private mode */ }
const plcFam = (m) => m.slice(0, 4);
/* what may be added to this model: [allowed, reason] */
function extAllowed(model, ext, add) {
  const fam = plcFam(model), e = PLC_EXT[add], m = PLC_MODELS.find((r) => r[0] === model);
  const boards = ext.filter((k) => PLC_EXT[k].bd).length;
  if (e.bd && fam === "FX3U") return [false, "FX3U 沒有 I/O 擴充板，要用擴充模組"];
  if (e.bd && boards >= 1) return [false, "I/O 擴充板只能裝一片（4 點輸入或 2 點輸出擇一）"];
  if (!e.bd && fam === "FX3S") return [false, "FX3S 不能接擴充模組，只能裝一片擴充板；點數不夠要換 FX3G 或 FX3U"];
  const total = m[1] + m[2] + ext.concat(add).reduce((a, k) => a + PLC_EXT[k].x + PLC_EXT[k].y, 0);
  const max = fam === "FX3G" ? 128 : fam === "FX3U" ? 256 : 999;
  if (total > max) return [false, `${fam} 最多 ${max} 點`];
  return [true, ""];
}
function plcIO(cfg) {
  const m = PLC_MODELS.find((r) => r[0] === cfg.model) || PLC_MODELS[3], o8 = (k, n) => k + n.toString(8).padStart(3, "0");
  const xs = [], ys = [], marks = {};
  for (let i = 0; i < m[1]; i++) xs.push(o8("X", i));
  for (let i = 0; i < m[2]; i++) ys.push(o8("Y", i));
  let nx = m[1], ny = m[2];
  cfg.ext.forEach((k) => {
    const e = PLC_EXT[k], tag = k.replace(/-BD$/, " 擴充板").replace(/^(\d+)(EX|EYR)$/, "FX2N-$1$2");
    if (e.bd) {                                        // boards are read / driven through M8112-M8117, not X / Y
      for (let i = 0; i < e.x; i++) xs.push(o8("X", 0o370 + i));
      for (let i = 0; i < e.y; i++) ys.push(o8("Y", 0o370 + i));
      marks[e.x ? "X370" : "Y370"] = tag;
      return;
    }
    if (e.x) { const st = Math.ceil(nx / 8) * 8; marks[o8("X", st)] = tag; for (let i = 0; i < e.x; i++) xs.push(o8("X", st + i)); nx = st + e.x; }
    if (e.y) { const st = Math.ceil(ny / 8) * 8; marks[o8("Y", st)] = tag; for (let i = 0; i < e.y; i++) ys.push(o8("Y", st + i)); ny = st + e.y; }
  });
  return { xs, ys, marks };
}
const spans = (all) => {                                         // ["X000".."X017","X020"..] -> "X0～X17、X20～X23"
  const out = []; let a = null, b = null, list = all.filter((d) => !BOARD_NAMES[d]), bd = all.filter((d) => BOARD_NAMES[d]);
  list.forEach((d) => { const n = parseInt(d.slice(1), 8); if (b !== null && n === parseInt(b.slice(1), 8) + 1) b = d; else { if (a) out.push([a, b]); a = b = d; } });
  if (a) out.push([a, b]);
  return out.map(([x, y]) => x === y ? shortDev(x) : `${shortDev(x)}～${shortDev(y)}`).join("、") +
    (bd.length ? `＋擴充板 ${shortDev(bd[0])}～${shortDev(bd[bd.length - 1])}（程式用 ${BOARD_M[bd[0]]}～${BOARD_M[bd[bd.length - 1]]}）` : "");
};
function applyPlc(model, ext, live) {
  const cfg = { model, ext: [] };
  (ext || []).forEach((k) => { if (PLC_EXT[k] && extAllowed(model, cfg.ext, k)[0]) cfg.ext.push(k); });
  plcCfg = cfg;
  try { localStorage.setItem("ll_plc", JSON.stringify(cfg)); } catch (e) { /* private mode */ }
  const io = plcIO(cfg);
  if (sb && isFree()) {
    const r = JSON.parse(sb.set_io(JSON.stringify(io.xs), JSON.stringify(io.ys), cfg.model));
    M.inputs = r.inputs; M.outputs = r.outputs;
    if (live) { Kit.setIO(io.xs, io.ys, io.marks, cfg.model, BOARD_NAMES); freeIO(); }
  }
  renderPlcCfg(io);
  if (fx && fx.setModel) fx.setModel(cfg.model, io.xs, io.ys);
  rangeWarn();
  return io;
}
function renderPlcCfg(io) {
  io = io || plcIO(plcCfg);
  $("plc-box").querySelector("h3").textContent = isFree() ? `軟 PLC（${plcCfg.model} 模擬）` : "軟 PLC（FX3S 模擬）";
  $("plc-cfg").hidden = !isFree();
  if (!isFree()) return;
  $("plcModel").innerHTML = ["FX3S", "FX3G", "FX3U"].map((f) => `<optgroup label="${f}">${PLC_MODELS.filter((m) => plcFam(m[0]) === f).map((m) => `<option value="${m[0]}" ${m[0] === plcCfg.model ? "selected" : ""}>${m[0]}（${m[1]} 入／${m[2]} 出）</option>`).join("")}</optgroup>`).join("");
  $("plcExt").innerHTML = plcCfg.ext.map((k, i) => `<li>${escS(PLC_EXT[k].n(plcFam(plcCfg.model)))} <button type="button" class="kb-rm" data-xi="${i}" title="拆掉">×</button></li>`).join("");
  $("plcExtSel").innerHTML = Object.keys(PLC_EXT).map((k) => { const [ok, why] = extAllowed(plcCfg.model, plcCfg.ext, k); return `<option value="${k}" ${ok ? "" : "disabled"} title="${escS(why)}">${escS(PLC_EXT[k].n(plcFam(plcCfg.model)))}${ok ? "" : "（不能裝）"}</option>`; }).join("");
  $("plcIOtext").textContent = `輸入 ${io.xs.length} 點：${spans(io.xs)}　輸出 ${io.ys.length} 點：${spans(io.ys)}`;
  $("plcExt").querySelectorAll("[data-xi]").forEach((b) => (b.onclick = () => { const e = plcCfg.ext.slice(); e.splice(+b.dataset.xi, 1); applyPlc(plcCfg.model, e, true); }));
}
/* the program uses terminals this PLC does not have */
function rangeWarn() {
  const w = $("rangewarn"); if (!w) return;
  if (!isFree() || !loadedIL) { w.hidden = true; return; }
  const have = new Set(M.inputs.map((r) => r[0]).concat(M.outputs.map((r) => r[0]))), miss = new Set();
  const n3 = (k, n) => k + n.toString(8).padStart(3, "0");
  (loadedIL.toUpperCase().match(/\bK[1-4][XY][0-7]+\b|\b[XY][0-7]+\b/g) || []).forEach((t) => {
    if (t[0] === "K") { const k = t[2], st = parseInt(t.slice(3), 8); for (let i = 0; i < 4 * +t[1]; i++) if (!have.has(n3(k, st + i))) miss.add(n3(k, st + i)); }
    else if (!have.has(n3(t[0], parseInt(t.slice(1), 8)))) miss.add(n3(t[0], parseInt(t.slice(1), 8)));
  });
  const il = loadedIL.toUpperCase(), noBoard = [];
  if (/\bM811[2-5]\b/.test(il) && !have.has("X370")) noBoard.push("M8112～M8115 是 FX3G-4EX-BD 的輸入");
  if (/\bM811[67]\b/.test(il) && !have.has("Y370")) noBoard.push("M8116、M8117 是 FX3G-2EYT-BD 的輸出");
  [...miss].forEach((d) => { if (BOARD_NAMES[d]) miss.delete(d); });
  w.hidden = !miss.size && !noBoard.length;
  if (!miss.size && noBoard.length) { w.innerHTML = `⚠ ${noBoard.join("；")}，但現在沒有加裝這片擴充板，讀到的都是 OFF。可以在右邊「軟 PLC」加裝。`; return; }
  if (miss.size) w.innerHTML = `⚠ 程式用到 <b>${[...miss].slice(0, 8).map(shortDev).join("、")}${miss.size > 8 ? "…" : ""}</b>，但 ${escS(plcCfg.model)}${plcCfg.ext.length ? "＋擴充" : ""} 沒有這些端子（真的 PLC 上這些點不會有輸入、也接不到東西）。可以在右邊「軟 PLC」換大一點的機型，或加裝擴充板／擴充模組。`;
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
  if (free) {
    const io = applyPlc(plcCfg.model, plcCfg.ext, false);
    Kit.mount($("kit"), { xs: io.xs, ys: io.ys, marks: io.marks, model: plcCfg.model, names: BOARD_NAMES, onChange: freeIO, onPreset: kitPreset, onReset: (x) => sb.set_input(x, 0), onToggle: (x) => sb.toggle(x),
      setPlc: (m, e) => applyPlc(m, e, true) });
  } else {
    renderPlcCfg(); Kit.unmount();
    const io20 = plcIO({ model: "FX3S-20M", ext: [] });
    if (fx && fx.setModel) fx.setModel("FX3S-20M", io20.xs, io20.ys);
  }
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
  const dt = Math.max(0, Math.min(100, last ? t - last : 16)); last = t;
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
/* open a GX Works2 program CSV (UTF-16) or a plain instruction list / UTF-8 CSV, and save the program as a GX Works2 CSV */
function csvText(buf) {                                   // fallback for files that are not GX Works2's UTF-16 export
  const text = new TextDecoder("utf-8").decode(buf).replace(/^\ufeff/, "");
  const rows = text.split(/\r?\n/).filter((l) => l.trim());
  if (!rows.some((l) => /[\t,]/.test(l))) return rows.map((l) => l.trim()).join("\n");
  const out = [];
  rows.forEach((l) => {
    const c = l.split(/\t|,/).map((x) => x.trim().replace(/^"|"$/g, ""));
    if (/^\d+$/.test(c[0]) && c[2] && /^[A-Za-z<>=]/.test(c[2])) out.push([c[2].toUpperCase(), c[3] || ""]);
    else if (!c[0] && !c[2] && c[3] && out.length) out[out.length - 1].push(c[3]);
  });
  return out.filter((r) => r[0] !== "END").map((r) => r.filter(Boolean).join(" ")).join("\n");
}
$("csvin").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f || !sb) return;
  const buf = new Uint8Array(await f.arrayBuffer());
  let il = "", info = "";
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    let bin = ""; buf.forEach((b) => { bin += String.fromCharCode(b); });
    const r = JSON.parse(sb.import_csv(btoa(bin)));
    if (!r.ok) { alert("讀不懂這個檔案：" + r.msg + "\n請確認是 GX Works2 匯出的程式 CSV。"); return; }
    il = r.il; info = `${r.plc || "未知 PLC"}，${r.count} 個指令`;
  } else {
    il = csvText(buf);
    if (!il.trim()) { alert("這個檔案裡找不到指令。請用 GX Works2 匯出的程式 CSV，或一行一個指令的文字檔。"); return; }
    info = `${il.split("\n").length} 個指令`;
  }
  if (mode === "monitor") setMode("write");
  ["ladder", "stl", "sfc", "il"].forEach((t) => loadInto(t, il));
  showTab(/\bSTL\b/i.test(il) ? "stl" : "ladder");
  convert();
  $("note").textContent = `已開啟 ${f.name}（${info}）。`;
});
$("plcModel").onchange = (e) => applyPlc(e.target.value, plcCfg.ext, true);
$("plcExtAdd").onclick = () => { const k = $("plcExtSel").value; if (k && extAllowed(plcCfg.model, plcCfg.ext, k)[0]) applyPlc(plcCfg.model, plcCfg.ext.concat(k), true); };
/* project file: PLC model and expansions, the assembled machine and the program in one JSON file */
$("projout").onclick = () => {
  if (!sb || !isFree()) { alert("專案檔存的是「只模擬電路」的組裝台；請先在上面選「只模擬電路」。"); return; }
  const data = { ladderlab: "sim-project", version: 1, plc: plcCfg, bench: Kit.getBench(), program: currentIL().il, tab };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
  a.download = "LadderLab_專案.json"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$("projin").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f || !sb) return;
  let d = null;
  try { d = JSON.parse(await f.text()); } catch (err) { d = null; }
  if (!d || d.ladderlab !== "sim-project") { alert("這不是 LadderLab 模擬器的專案檔（.json）。"); return; }
  if (!isFree()) { $("machine").value = "free"; openMachine("free"); }
  if (d.plc && d.plc.model) applyPlc(d.plc.model, d.plc.ext || [], true);
  if (d.bench) Kit.setBench(d.bench);
  const il = String(d.program || "");
  if (mode === "monitor") setMode("write");
  ["ladder", "stl", "sfc", "il"].forEach((t) => loadInto(t, il));
  showTab(["ladder", "stl", "sfc", "il"].includes(d.tab) ? d.tab : (/\bSTL\b/i.test(il) ? "stl" : "ladder"));
  convert();
  $("note").textContent = `已開啟專案 ${f.name}（${plcCfg.model}${plcCfg.ext.length ? "＋擴充" : ""}）。`;
});
$("csvout").onclick = () => {
  if (!sb) return;
  const b64 = sb.export_csv(currentIL().il);
  if (!b64) { alert("程式還有錯誤，先修正（按 F4 看錯誤）再存。"); return; }
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes], { type: "text/csv" }));
  a.download = "LadderLab_程式.csv"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
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
