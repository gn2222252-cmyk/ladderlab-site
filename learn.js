"use strict";
/* Lesson player. Python side: engine/course_bridge.py (wraps learn.Runner, the class test_lessons.py checks).
The demo script semantics follow learn.py LearnWindow.do_script, so what the tests prove is what people see. */
const EN = {
  brand_sub: "Ladder Lab", toc_btn: "Lessons", loading: "Loading the simulator (about 10 s the first time)…",
  play: "▶ Play demo", next: "Next ▸", hold: "Pause after each line", ladder: "Ladder", slow: "Slow-motion scan",
  step: "Step", hint: "Blue = closed / powered. Click any rung to see what it means and why it is or is not powered.",
  inputs: "Inputs (press them)", outputs: "Outputs", plant: "Machine", sfc: "Step chart", values: "Values",
  trace: "Value per scan", prev: "Previous", nextl: "Next lesson", nav_learn: "Course", nav_practice: "Practice",
  disc: "MELSEC and GX Works are trademarks of Mitsubishi Electric Corporation. LadderLab is independent and not affiliated with Mitsubishi Electric. The simulator runs FX-compatible instructions; results do not represent real hardware.",
};
const UI = {
  zh: { start: "按「播放示範」看這一課，或直接按右邊的輸入自己試。", done: "示範結束。換你操作：按右邊的輸入，或點階梯圖看每一條為什麼通或不通。",
    replay: "↻ 重播示範", pause: "⏸ 暫停", resume: "▶ 繼續", load_fail: "模擬引擎載入失敗，請重新整理。", scan: "第 %d 圈",
    hold_k: "按住", toggle_k: "切換", sensor_k: "感測器", conflict: "⚠ 相反動作同時輸出！", stage: "程式：" },
  en: { start: "Press Play demo to watch this lesson, or press the inputs on the right and try it yourself.",
    done: "Demo finished. Your turn: press the inputs, or click a rung to see why it is or is not powered.",
    replay: "↻ Replay demo", pause: "⏸ Pause", resume: "▶ Resume", load_fail: "The simulator failed to load. Please reload.",
    scan: "Scan %d", hold_k: "hold", toggle_k: "switch", sensor_k: "sensor", conflict: "⚠ Opposite outputs at the same time!", stage: "Program: " },
};

let lang = "zh", py = null, course = null, cat = null, idx = 0, L = null, st = null, zhText = {};
let script = [], playing = false, paused = false, wait = 0, until = null, line = 0, lines = 0, selected = -1, last = 0, shownStep = "";
const $ = (id) => document.getElementById(id);
const u = (k) => UI[lang][k];

/* ---------- language ---------- */
function applyLang() {
  document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
  document.querySelectorAll("[data-t]").forEach((el) => {
    const k = el.dataset.t;
    if (!(k in zhText)) zhText[k] = el.textContent;
    el.textContent = lang === "zh" ? zhText[k] : (EN[k] || zhText[k]);
  });
  $("lang").textContent = lang === "zh" ? "English" : "中文";
  $("en-note").hidden = lang === "zh";
  try { localStorage.setItem("ll_lang", lang); } catch (e) { /* private mode */ }
  if (cat) { buildToc(); setPlayLabel(); if (!playing && !line) $("caption").textContent = u("start"); }
}
$("lang").onclick = () => { lang = lang === "zh" ? "en" : "zh"; applyLang(); };

/* ---------- progress (this browser only) ---------- */
function doneSet() { try { return new Set(JSON.parse(localStorage.getItem("ll_done") || "[]")); } catch (e) { return new Set(); } }
function markDone(id) { const s = doneSet(); s.add(id); try { localStorage.setItem("ll_done", JSON.stringify([...s])); } catch (e) { /* ignore */ } buildToc(); }

/* ---------- table of contents ---------- */
function buildToc() {
  const done = doneSet();
  $("toc").innerHTML = `<p class="toc-note"><a href="path.html">‹ 課程地圖（含練習、GX Works2 操作）</a></p>` + cat.tracks.map((t) => {
    const ls = cat.lessons.filter((l) => l.track === t.id);
    if (!ls.length) return "";
    const items = ls.map((l) =>
      `<li><a href="#${encodeURIComponent(l.id)}" class="${l.i === idx ? "here" : ""}">${done.has(l.id) ? "✓ " : ""}<b>${l.no}</b> ${l.name}</a></li>`).join("");
    return `<h3>${lang === "zh" ? t.zh : t.en}</h3><ol>${items}</ol>`;
  }).join("");
}
$("tocbtn").onclick = () => document.body.classList.toggle("toc-open");

/* ---------- loading a lesson ---------- */
function open(i) {
  idx = i;
  stop();
  L = JSON.parse(course.load(i));
  course.set_slow($("slow").checked);
  draw();
  const meta = cat.lessons.find((l) => l.i === i);
  $("crumb").textContent = (cat.tracks.find((t) => t.id === meta.track) || {})[lang] || "";
  document.title = `${L.lesson.no} ${L.lesson.name} | LadderLab PLC 課程`;
  $("hold").checked = !!L.lesson.hold;
  const here = window.Course ? Course.find("L", meta.id) : null;
  const pv = here && Course.step(here, -1), nx = here && Course.step(here, 1);
  $("prev").style.visibility = pv ? "visible" : "hidden";
  if (pv) { $("prev").href = pv.it.href; $("prev").querySelector("span").textContent = Course.label(pv.it); }
  $("nextl").href = nx ? nx.it.href : "path.html";
  $("nextl").querySelector("span").textContent = nx ? "下一步：" + Course.label(nx.it) : "回課程地圖";
  if (here) Course.bar($("cbar"), here);
  const g = L.lesson.guide;
  $("goal").hidden = !g;
  if (g) $("goal").innerHTML = `<b>本課目標</b>${esc(g.goal)}`;
  $("recap").hidden = !g;
  if (g) $("recap").innerHTML = `<h3>重點整理</h3><ul>${g.key.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` +
    (g.trap ? `<p class="trap"><b>常見錯誤：</b>${esc(g.trap)}</p>` : "");
  const chap = cat.chapters.find((c) => c.id === meta.track);
  const firstInChap = cat.lessons.find((l) => l.track === meta.track) === meta;
  $("chintro").hidden = !(chap && firstInChap);
  if (chap && firstInChap) $("chintro").innerHTML = `<h2>第 ${chap.id} 章　${esc(chap.t)}</h2><p>${esc(chap.why)}</p>`;
  const qs = JSON.parse(course.quiz());
  $("quiz-box").hidden = !qs.length;
  $("quiz-box").innerHTML = qs.length ? `<h3>${lang === "zh" ? "預測看看（答案是模擬器實際跑出來的）" : "Predict (answers come from the simulator)"}</h3>` +
    qs.map((q, i) => `<div class="qz" data-i="${i}"><p>${esc(q.q)}</p><div class="qz-opts">${q.options.map((o) =>
      `<button type="button" class="small-btn" data-o="${esc(o)}">${esc(o)}</button>`).join("")}</div><p class="qz-res" hidden></p></div>`).join("") : "";
  $("quiz-box").querySelectorAll(".qz").forEach((box) => {
    const q = qs[+box.dataset.i];
    box.querySelectorAll("[data-o]").forEach((b) => b.addEventListener("click", () => {
      const ok = b.dataset.o === q.answer;
      box.querySelectorAll("[data-o]").forEach((x) => { x.disabled = true; x.classList.toggle("right", x.dataset.o === q.answer); });
      if (!ok) b.classList.add("wrong");
      const r = box.querySelector(".qz-res"); r.hidden = false;
      r.innerHTML = `<b>${ok ? "✓ 對了" : "✗ 答案是 " + esc(q.answer)}</b>　${esc(q.why)}`;
    }));
  });
  const after = [];                         // what the course map puts between this lesson and the next one
  if (here) for (let f = Course.step(here, 1); f && f.it.k !== "L" && f.sec === here.sec; f = Course.step(f, 1)) after.push(f.it);
  $("practice-box").hidden = !after.length;
  $("practice-box").innerHTML = after.length ? `<h3>${lang === "zh" ? "學完這課，接著做" : "Next, do these"}</h3>` +
    after.map((it) => `<a class="btnlink${it.k === "E" ? " go" : ""}" href="${it.href}">${esc(it.label)} ›</a>`).join(" ") : "";
  document.body.classList.remove("toc-open");
  buildToc();
  window.scrollTo(0, 0);
}
function draw() {
  const l = L.lesson;
  $("title").textContent = `${l.no} ${l.name}`;
  $("text").textContent = l.text;
  ladderComment = (dev) => L.comments.zh[dev] || "";
  renderRungs($("ladder"), L.rungs.map((r, i) => [r, i]), { onClick: explainRung });
  showSfc(course.sfc(), (s) => L.comments.zh[s] || "");
  selected = -1; $("explain").hidden = true;
  $("stages").innerHTML = l.stages.length ? `${u("stage")}${l.stages.map((s) => `<button type="button" class="small-btn" data-stage="${s}">${s}</button>`).join(" ")}` : "";
  $("stages").querySelectorAll("[data-stage]").forEach((b) => (b.onclick = () => useStage(b.dataset.stage)));
  $("inputs").innerHTML = l.inputs.map(([dev, label, kind]) =>
    `<button type="button" class="inp ${kind}" data-dev="${dev}" data-kind="${kind}" ${kind === "sensor" ? "disabled" : ""}>` +
    `<i></i><span><b>${dev}</b> ${esc(label)}</span><small>${u(kind + "_k")}</small></button>`).join("");
  $("inputs").querySelectorAll(".inp").forEach(wireInput);
  if (l.latched) {
    $("inputs").insertAdjacentHTML("beforeend", `<button type="button" class="inp power" id="powerbtn"><i></i><span><b>⚡</b> 停電再復電</span><small>電源</small></button>`);
    $("powerbtn").onclick = () => course.power_cycle();
  }
  $("outputs").innerHTML = l.outputs.map(([dev, label]) => `<li data-dev="${dev}"><i></i><b>${dev}</b> ${esc(label)}</li>`).join("");
  $("panel-box").hidden = !l.panel;
  panel = l.panel ? FX3S.live($("panel")) : null;
  $("plant-box").hidden = !l.plant;
  $("sfc-box").hidden = !l.sfc;
  $("sfc").innerHTML = (l.sfc || []).map(([s, t]) => `<li data-s="${s}"><b>${s}</b> ${esc(t)}</li>`).join("");
  const vals = (l.values || []).concat(l.watch || []);
  $("val-box").hidden = !vals.length;
  $("vals").innerHTML = vals.map(([d, t]) => `<li><span>${esc(t)}</span><b data-v="${d}"></b></li>`).join("");
  $("trace-box").hidden = !l.trace.length;
  $("trace").innerHTML = l.trace.length ? `<thead><tr><th></th>${l.trace.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody></tbody>` : "";
  $("table-box").hidden = !l.table;
  if (l.table) $("ltable").innerHTML = `<thead><tr>${l.table.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
    l.table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + "</tbody>";
  $("notes").hidden = !l.notes; $("notes").textContent = l.notes || "";
  $("caption").textContent = u("start");
  setPlayLabel();
}
function useStage(name) {
  L = Object.assign(JSON.parse(course.stage(name)), {});
  const keep = { hold: $("hold").checked };
  draw();
  $("hold").checked = keep.hold;
}
function wireInput(b) {
  const dev = b.dataset.dev, kind = b.dataset.kind;
  if (kind === "hold") {
    const on = (e) => { e.preventDefault(); course.set_input(dev, 1); try { b.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or finished pointer */ } };
    const off = () => course.set_input(dev, 0);
    b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off);
    b.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); course.set_input(dev, 1); } });
    b.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") course.set_input(dev, 0); });
  } else if (kind === "toggle") {
    b.addEventListener("click", () => course.toggle(dev));
  }
}
function explainRung(i) {
  selected = i;
  $("explain").hidden = false;
  $("explain").textContent = course.explain(i);
  updateRungs($("ladder"), st, L.rungs, selected);
}

/* ---------- demo player (same rules as learn.py do_script) ---------- */
function setPlayLabel() {
  $("play").textContent = playing ? (paused ? u("resume") : u("pause")) : (line ? u("replay") : (lang === "zh" ? zhText.play || "▶ 播放示範" : EN.play));
  $("next").hidden = !playing;
  $("prog").textContent = playing || line ? `${line} / ${lines}` : "";
}
function stop() { script = []; playing = false; paused = false; wait = 0; until = null; line = 0; lines = 0; }
$("play").onclick = () => {
  if (playing) { paused = !paused; setPlayLabel(); return; }
  open(idx);
  script = L.lesson.demo.slice();
  lines = script.filter((r) => r[3]).length;
  playing = true; paused = false; line = 0;
  setPlayLabel();
};
$("next").onclick = () => {
  wait = 0; paused = false;
  let guard = 0;
  while (until !== null && guard < 60 && !course.reached(until)) { course.slow_step(); guard++; }
  until = null;
  setPlayLabel();
};
function doScript(ms) {
  const hold = $("hold").checked;
  if (until !== null) {
    if (course.reached(until)) { until = null; if (hold && script.length) paused = true; }
    return;
  }
  if (wait > 0) {
    wait -= ms;
    if (wait <= 0 && hold && script.length) paused = true;
    return;
  }
  if (!script.length) {
    if (playing) { playing = false; $("caption").textContent = u("done"); markDone(L.lesson.id); }
    return;
  }
  const [seconds, action, device, words] = script[0];
  if (action === "sync") { if (!course.scanning()) script.shift(); return; }
  script.shift();
  if (action === "mark") { course.reset_trace(); return; }
  if (words) { line++; $("caption").textContent = words; }
  if (action === "press") course.set_input(device, 1);
  else if (action === "release") course.set_input(device, 0);
  else if (action === "toggle") course.toggle(device);
  else if (action === "power") course.power_cycle();
  else if (action === "slow") { $("slow").checked = true; course.set_slow(true); }
  else if (action === "fast") { $("slow").checked = false; course.set_slow(false); }
  else if (action === "stage") { const c = $("caption").textContent; useStage(device); $("caption").textContent = c; }
  else if (action === "look") lookAt(device);
  if (action === "rung") { until = seconds; return; }
  wait = seconds * 1000;
}
function lookAt(device) {
  const i = L.rungs.findIndex((r) => r.k === "r" && r.out.some((o) => o[o.length - 1] === device));
  const g = $("ladder").querySelector(`.rung[data-r="${i}"]`);
  if (g) scrollToRung(g);
}
function scrollToRung(g) {
  const wrap = document.querySelector(".ladder-wrap");
  const y = g.getBBox().y;
  if (y < wrap.scrollTop || y + 110 > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = Math.max(0, y - 40);
}


/* ---------- ladder / SFC view switch ---------- */
let view = "ladder", hasSfc = false;
function setView(v) {
  view = hasSfc ? v : "ladder";
  document.getElementById("ladderview").hidden = view !== "ladder";
  document.getElementById("sfcview").hidden = view !== "sfc";
  document.querySelectorAll("#vtabs button").forEach((b) => b.classList.toggle("here", b.dataset.v === view));
}
document.querySelectorAll("#vtabs button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.v)));
function showSfc(json, comment) {
  const chart = JSON.parse(json);
  hasSfc = !!(chart && chart.blocks.length);
  document.getElementById("vtabs").hidden = !hasSfc;
  renderSfc(document.getElementById("sfcview"), chart, comment);
  setView(view);
}

/* ---------- controls ---------- */
$("slow").onchange = () => { course.set_slow($("slow").checked); };
$("step").onclick = () => course.slow_step();

/* ---------- drawing state ---------- */
function drawState() {
  st = JSON.parse(course.state());
  updateRungs($("ladder"), st, L.rungs, selected);
  if (view === "sfc") updateSfc($("sfcview"), st);
  $("step").hidden = !st.slow;
  $("phase").hidden = !st.slow || !st.phase; $("phase").textContent = st.phase;
  if (st.slow && st.cur >= 0) { const g = $("ladder").querySelector(`.rung[data-r="${st.cur}"]`); if (g) scrollToRung(g); }
  else if (!st.slow && st.steps.join() !== shownStep) {
    shownStep = st.steps.join();
    const i = L.rungs.findIndex((r) => r.k === "stl" && r.state === st.steps[0]);
    const g = $("ladder").querySelector(`.stlbar[data-s="${i}"]`);
    if (g) scrollToRung(g);
  }
  if (panel) panel.update(fxMap(st.inputs), fxMap(st.outputs));
  $("inputs").querySelectorAll(".inp").forEach((b) => b.classList.toggle("on", !!st.inputs[b.dataset.dev]));
  $("outputs").querySelectorAll("li").forEach((li) => li.classList.toggle("on", !!st.outputs[li.dataset.dev]));
  $("sfc").querySelectorAll("li").forEach((li) => li.classList.toggle("on", st.steps.includes(li.dataset.s)));
  $("vals").querySelectorAll("[data-v]").forEach((b) => {
    const d = b.dataset.v, v = d in st.values ? st.values[d] : st.watch[d];
    b.textContent = /^[DTC]\d/.test(d) ? v : (v ? "ON" : "OFF");
  });
  $("conflict").hidden = !st.conflict;
  if (st.conflict) $("conflict").textContent = (L.lesson.conflict && L.lesson.conflict[2]) || u("conflict");
  if (L.lesson.trace.length) {
    $("trace").querySelector("tbody").innerHTML = st.trace.map(([n, row]) =>
      `<tr><th>${u("scan").replace("%d", n)}</th>${row.map((v, k) => {
        const isWord = typeof v === "number" && v > 1;
        return `<td class="${v && !isWord ? "on" : ""}">${isWord ? v : (v ? "ON" : "OFF")}</td>`;
      }).join("")}</tr>`).join("");
  }
  if (st.plant) drawPlant(st.plant);
}
const pc = $("plant").getContext("2d");
function drawPlant(p) {
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  pc.clearRect(0, 0, 200, 130);
  if (p.kind === "ab") { drawAB(p, css); return; }
  if (p.kind === "panel") {                    // one double-solenoid cylinder lying down: X1 back (home), X0 front
    pc.fillStyle = css("--rail"); pc.fillRect(20, 50, 80, 28);
    pc.fillStyle = css("--belt"); pc.fillRect(100, 60, 10 + p.z * 60, 8);
    pc.fillStyle = "#d0a020"; pc.fillRect(110 + p.z * 60, 52, 10, 24);
    pc.fillStyle = css("--mute"); pc.font = "11px system-ui";
    pc.fillText(p.z >= 0.98 ? "X0 前限" : p.z <= 0.02 ? "X1 後限（原點）" : "移動中", 20, 40);
    pc.fillStyle = css("--line"); pc.fillRect(10, 100, 180, 6);
    return;
  }
  pc.fillStyle = css("--rail"); pc.fillRect(80, 6, 40, 26);
  pc.fillStyle = css("--belt"); pc.fillRect(94, 32, 12, p.z * 60);
  pc.fillStyle = p.vac ? "#2fbf5b" : "#d0a020"; pc.fillRect(74, 32 + p.z * 60, 52, 12);
  pc.fillStyle = css("--mute"); pc.font = "11px system-ui";
  pc.fillText(p.z >= 0.98 ? "X1 下限" : p.z <= 0.02 ? "X2 上限" : "", 132, 40 + p.z * 60);
  pc.fillStyle = css("--line"); pc.fillRect(40, 116, 120, 6);
}

let panel = null;
function fxMap(o) { const m = {}; Object.keys(o).forEach((d) => { m[d[0] + parseInt(d.slice(1), 10)] = o[d]; }); return m; }
function drawAB(p, css) {               // two horizontal single-solenoid cylinders, A on top, B below
  [["A", p.z, 20, "X2", "X3"], ["B", p.zb, 78, "X4", "X5"]].forEach(([name, z, y, back, front]) => {
    pc.fillStyle = css("--rail"); pc.fillRect(10, y, 70, 24);
    pc.fillStyle = css("--belt"); pc.fillRect(80, y + 9, 10 + z * 70, 6);
    pc.fillStyle = "#d0a020"; pc.fillRect(90 + z * 70, y + 2, 10, 20);
    pc.fillStyle = css("--mute"); pc.font = "11px system-ui";
    pc.fillText(name + (z >= 0.98 ? " 伸出 " + front : z <= 0.02 ? " 縮回 " + back : " 移動中"), 12, y - 4);
  });
}
function frame(t) {
  const dt = Math.min(100, last ? t - last : 16); last = t;
  const ms = dt * +$("speed").value;
  if (!paused) { if (playing || script.length) doScript(ms); course.tick(ms); }
  drawState();
  if (playing) setPlayLabel();
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
function route() {
  const id = decodeURIComponent(location.hash.slice(1));
  const found = cat.lessons.find((l) => l.id === id);
  open(found ? found.i : cat.lessons[0].i);
}
async function boot() {
  try { const saved = localStorage.getItem("ll_lang"); if (saved) lang = saved;
    else if (!/^zh/i.test(navigator.language || "")) lang = "en"; } catch (e) { /* ignore */ }
  applyLang();
  try {
    py = await loadPyodide();
    const files = (window.LL_FILES ? Object.keys(window.LL_FILES) : await (await fetch("py/manifest.json", { cache: "no-cache" })).json());
    py.FS.mkdir("/lab");
    for (const name of files) py.FS.writeFile("/lab/" + name, (window.LL_FILES ? Uint8Array.from(atob(window.LL_FILES[name]), (c) => c.charCodeAt(0)) : new Uint8Array(await (await fetch("py/" + name, { cache: "no-cache" })).arrayBuffer())));
    py.runPython("import sys; sys.path.insert(0, '/lab')");
    course = py.runPython("from course_bridge import Course; Course()");
    cat = JSON.parse(py.runPython("from course_bridge import catalog; catalog()"));
    window.addEventListener("hashchange", route);
    route();
    $("loading").hidden = true;
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    $("loading").textContent = u("load_fail");
  }
}
boot();
