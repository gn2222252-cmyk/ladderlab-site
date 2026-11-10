"use strict";
/* LadderLab demo: Pyodide runs the soft PLC (engine/*.py), this file draws the machine and the ladder. */
const EN = {
  brand_sub: "Ladder Lab", f7: "LabVIEW host course", f7d: "22 lessons to build a PLC host program yourself (VISA, two loops, heartbeat and reconnect), plus architecture and a 201-question CLAD practice bank (Chinese).", f5: "Skill test: pneumatics level B PLC questions", f5d: "Taiwan skill-test questions on three simulated cylinders: manual step, single and continuous cycle, emergency stop, reset, power failure, all auto-graded (Chinese).", f6: "Engineer tool: program health check", f6d: "Paste or import a GX Works2 program: finds double coils, SET without RST, timer reuse; explains each rung in plain words; exports the I/O list and a program document.", cta_path: "Where to start? See the learning path ›", cta_gx2: "How to build SFC in GX Works2 ›", f1: "Interactive course, 30 lessons", f1d: "From \"ladder is a circuit\" to step ladder, timers, counters, manual mode and homing. Every lesson runs, with slow-motion scans.", f2: "GX Works2 hands-on (FX3S)", f2d: "Ladder, STL step ladder or SFC: which to choose, how to create, download and monitor, step by step (Chinese).", f3: "17 auto-graded exercises", f3d: "Write the program, it is tested on a virtual machine including safety interlocks. Imports GX Works2 CSV.", f4: "13 troubleshooting cases", f4d: "Read the work order, alarm code and I/O, find the fault, repair it and bring the machine back.", nav_learn: "Course", nav_practice: "Practice", cta_p: "Free interactive course: 30 lessons from \"ladder is a circuit\" to manual mode, homing and fault handling on the dual gantry. Every lesson runs.", cta_b: "Start learning ›", h1: "Mitsubishi FX PLC from wiring and ladder to machine design and troubleshooting, all practised in your browser.", lab_intro: "This is the star of the last chapters: a dual-gantry pick-and-place machine programmed with FX instructions, running in your browser. Press Home, then Start, or inject a fault and watch the alarm.",
  sub: "One complete course for students learning the FX3S with GX Works2: every lesson has a live ladder, then you write the program yourself and it is graded on a virtual machine. No PLC, no install (lessons in Chinese).",
  loading: "Loading the simulator (about 10 s the first time)…", b_home: "Home", b_start: "Start", b_stop: "Stop",
  b_reset: "Reset alarm", b_estop: "E-STOP", b_part: "Add a part", speed: "Speed", b_restart: "Restart",
  fault: "Inject a fault", f_ok: "Normal", f_off: "Stuck OFF (broken wire)", f_on: "Stuck ON (short)",
  inputs: "Inputs X", outputs: "Outputs Y", ladder: "Ladder (live monitor)",
  hint: "Blue = contact closed, coil on. Click any rung to see what it means and why it is or is not powered.",
  pro_h: "Pro is in development", p1: "Learner Pro", p1d: "More machines, auto-graded exercises, an AI tutor, GX Works2 walkthroughs.",
  p2: "Engineer Pro", p2d: "Import your program: AI explains each rung, finds likely bugs, writes the I/O document, and test-runs it on a virtual machine.",
  w_h: "Join the waitlist (not open yet, you will be told first)", w_email: "Email", q1: "You are", choose: "Choose",
  r1: "Student", r2: "Field engineer", r3: "Teacher / trainer", r4: "Moving into automation", r5: "Other",
  q2: "Which PLC brand do you use most?", q2p: "e.g. Mitsubishi FX, Siemens, Allen-Bradley",
  q3: "What slows you down most when writing or fixing PLC programs?", q4: "If Pro had the features above, what would you pay per month?",
  pr0: "I would not pay", pr1: "Under US$10", pr2: "US$10-25", pr3: "Over US$25", q5: "Which one do you want more?", both: "Both",
  n_s: "Privacy notice", n_b: "Collected by LadderLab (independent developer) to tell you when it opens and for product research: your email and your answers, kept until you ask for deletion or the product closes. Email us any time to see, correct or delete your data. Without an email we cannot notify you.",
  consent: "I have read the notice and agree to get the launch email.", w_btn: "Join the waitlist",
  disc: "MELSEC and GX Works are trademarks of Mitsubishi Electric Corporation. LadderLab is independent and not affiliated with Mitsubishi Electric. The simulator runs FX-compatible instructions; results do not represent real hardware. Do not use them directly on real equipment.",
};
const MSG = {
  zh: { load_fail: "模擬引擎載入失敗，請重新整理。", g_home: "第 1 步：按「原點復歸」，兩座龍門會回到原點。",
    g_start: "第 2 步：按「啟動」，看兩座龍門同步把工件從前輸送帶搬到後輸送帶。下面的階梯圖會跟著亮。",
    g_run: "試試「製造故障」：讓 X012（右氣缸下限）卡在 OFF。氣缸明明下去了，PLC 卻收不到訊號。趁它還在等的時候，點亮著的步序下面的階梯圖，看卡在哪個接點；等太久就會逾時異常停機。",
    g_alarm: "異常停機！切到「P8 逾時監視」看是哪個計時器觸發。把故障改回「正常」，再按「異常復歸」與「原點復歸」。",
    g_estop: "急停中：所有輸出被切斷。再按一次急停解除，然後按「異常復歸」。", t: "時間", steps: "步序", placed: "已搬運",
    cycles: "完成循環", alarm: "異常", waiting: "等待中", ok: "已加入！開放時會寄信通知你。", bad: "送出失敗，請檢查 Email 與勾選同意。",
    belt_f: "前輸送帶 →", belt_r: "← 後輸送帶", lg: "左龍門", rg: "右龍門" },
  en: { load_fail: "The simulator failed to load. Please reload.", g_home: "Step 1: press Home. Both gantries return to their home positions.",
    g_start: "Step 2: press Start and watch both gantries move parts from the front belt to the rear belt. The ladder below lights up as it runs.",
    g_run: "Try Inject a fault: make X012 (R cylinder down) stuck OFF. The cylinder is down but the PLC never sees it. While it waits, click the rungs under the lit step to find the blocking contact; wait too long and it stops on a timeout alarm.",
    g_alarm: "Alarm stop! Open P8 TIMEOUT WATCH to see which timer fired. Set the fault back to Normal, then press Reset alarm and Home.",
    g_estop: "E-stop: all outputs are cut. Press E-STOP again to release, then Reset alarm.", t: "Time", steps: "Steps", placed: "Moved",
    cycles: "Cycles", alarm: "ALARM", waiting: "waiting", ok: "You are on the list. We will email you at launch.", bad: "Could not send. Check the email and the consent box.",
    belt_f: "Front belt →", belt_r: "← Rear belt", lg: "L gantry", rg: "R gantry" },
};
const SENSORS = ["X000", "X001", "X002", "X003", "X004", "X005", "X006", "X007", "X011", "X012"];
const XS = ["X000", "X001", "X002", "X003", "X004", "X005", "X006", "X007", "X010", "X011", "X012", "X013"];
const YS = ["Y000", "Y001", "Y002", "Y003", "Y004", "Y005", "Y006", "Y007"];

let tick = 0, lang = "zh", py = null, lab = null, layout = null, st = null, selected = -1, last = 0, zhText = {};
const $ = (id) => document.getElementById(id);
const half = (s) => (s || "").split("|")[lang === "zh" ? 0 : 1] ?.trim() || (s || "").split("|")[0].trim();
const cm = (dev) => (layout && layout.comments[lang][dev]) || "";
ladderComment = cm;

/* ---------- language ---------- */
function applyLang() {
  document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
  document.querySelectorAll("[data-t]").forEach((el) => {
    const k = el.dataset.t;
    if (!(k in zhText)) zhText[k] = el.textContent;
    el.textContent = lang === "zh" ? zhText[k] : (EN[k] || zhText[k]);
  });
  document.querySelectorAll("[data-tp]").forEach((el) => {
    if (!el.dataset.zh) el.dataset.zh = el.placeholder;
    el.placeholder = lang === "zh" ? el.dataset.zh : EN[el.dataset.tp];
  });
  $("lang").textContent = lang === "zh" ? "English" : "中文";
  try { localStorage.setItem("ll_lang", lang); } catch (e) { /* private mode */ }
  if (layout) { fillSelects(); buildIO(); drawLadder(); if (selected >= 0) showExplain(selected); }
}
$("lang").onclick = () => { lang = lang === "zh" ? "en" : "zh"; applyLang(); };

/* ---------- machine scene ---------- */
const cv = $("scene"), cx = cv.getContext("2d");
const L = 90, R = 550, FY = 290, RY = 80;
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ay = (axis) => FY - (axis / 1000) * (FY - RY);
function drawScene() {
  const m = MSG[lang];
  cx.clearRect(0, 0, 640, 360);
  cx.fillStyle = css("--bg"); cx.fillRect(0, 0, 640, 360);
  for (const [y, label] of [[FY, m.belt_f], [RY, m.belt_r]]) {
    cx.fillStyle = css("--belt"); cx.fillRect(L - 20, y - 16, R - L + 40, 32);
    if (st && st.y[2]) { cx.strokeStyle = css("--rail"); const off = (st.time / 8) % 24;
      for (let x = L - 20 + off; x < R + 20; x += 24) { cx.beginPath(); cx.moveTo(x, y - 16); cx.lineTo(x, y + 16); cx.stroke(); } }
    cx.fillStyle = css("--mute"); cx.font = "13px system-ui"; cx.fillText(label, 270, y + 34);
  }
  for (const [x, g, name] of [[L, st.left, m.lg], [R, st.right, m.rg]]) {
    cx.strokeStyle = css("--rail"); cx.lineWidth = 6; cx.beginPath(); cx.moveTo(x, RY - 40); cx.lineTo(x, FY + 40); cx.stroke(); cx.lineWidth = 1;
    const y = ay(Math.max(-40, Math.min(1040, g.axis))), s = 26 + 10 * g.z;
    cx.fillStyle = g.z > 0.5 ? css("--on") : css("--card"); cx.strokeStyle = css("--ink"); cx.lineWidth = 2;
    cx.fillRect(x - s / 2, y - s / 2, s, s); cx.strokeRect(x - s / 2, y - s / 2, s, s);
    if (g.vac) { cx.strokeStyle = "#ffb300"; cx.beginPath(); cx.arc(x, y, s / 2 + 6, 0, 7); cx.stroke(); }
    cx.lineWidth = 1; cx.fillStyle = css("--ink"); cx.font = "12px system-ui";
    cx.fillText(name, x < 320 ? x - 80 : x + 22, y + 4);
  }
  let waiting = 0;
  for (const [id, on, pos] of st.parts) {
    let x, y;
    if (on === "front") { if (pos < 0) { waiting++; continue; } x = L + (pos / 1000) * (R - L); y = FY; }
    else if (on === "rear") { x = R - (pos / 1000) * (R - L); y = RY; }
    else if (on === "R") { x = R; y = ay(st.right.axis); }
    else if (on === "L") { x = L; y = ay(st.left.axis); }
    else continue;
    cx.fillStyle = "#e8833a"; cx.fillRect(x - 9, y - 9, 18, 18);
    cx.fillStyle = "#fff"; cx.font = "10px system-ui"; cx.fillText(id, x - 3, y + 4);
  }
  if (waiting) { cx.fillStyle = css("--mute"); cx.font = "12px system-ui"; cx.fillText(`${m.waiting} ${waiting}`, 8, FY + 4); }
  if (st.estop || st.alarm) { cx.fillStyle = "rgba(198,40,40,.12)"; cx.fillRect(0, 0, 640, 360);
    cx.fillStyle = "#c62828"; cx.font = "bold 20px system-ui"; cx.fillText(st.estop ? "E-STOP" : m.alarm, 20, 30); }
}

function drawStatus() {
  const m = MSG[lang];
  $("status").innerHTML = `<span>${m.t} <b>${(st.time / 1000).toFixed(1)} s</b></span>` +
    `<span>${m.steps} <b>${st.steps.join(" ") || "-"}</b></span>` +
    `<span>${m.placed} <b>R ${st.placed.R} / L ${st.placed.L}</b></span>` +
    `<span>${m.cycles} <b>${st.d["212"]}</b></span>` + (st.alarm ? `<span class="alarm">${m.alarm}</span>` : "");
  const g = st.estop ? "g_estop" : st.alarm ? "g_alarm" : !st.homed ? "g_home" : st.steps.some((s) => +s.slice(1) >= 20 && +s.slice(1) < 30) ? "g_run" : "g_start";
  if ($("guide").dataset.k !== g + lang) { $("guide").textContent = m[g]; $("guide").dataset.k = g + lang; }
  $("estop").classList.toggle("latched", st.estop);
}

/* ---------- I/O lamps ---------- */
function buildIO() {
  $("xs").innerHTML = XS.map((n) => `<li id="io-${n}"><i></i>${n} ${cm(n)}</li>`).join("");
  $("ys").innerHTML = YS.map((n) => `<li id="io-${n}"><i></i>${n} ${cm(n)}</li>`).join("");
}
function drawIO() {
  XS.forEach((n, i) => { const el = $("io-" + n); el.classList.toggle("on", !!st.x[parseInt(n.slice(1), 8)]); el.classList.toggle("forced", n in st.force); });
  YS.forEach((n, i) => $("io-" + n).classList.toggle("on", !!st.y[i]));
}

/* ---------- ladder (drawing lives in ladder.js) ---------- */
function sections() {
  const seen = [];
  layout.rungs.forEach((r) => { if (r.sec && !seen.includes(r.sec)) seen.push(r.sec); });
  return seen;
}
function fillSelects() {
  const sel = $("section"), cur = sel.value;
  sel.innerHTML = sections().map((s, i) => `<option value="${i}">${esc(half(s))}</option>`).join("");
  sel.value = cur || String(Math.max(0, sections().findIndex((s) => s.startsWith("P5"))));
  const fs = $("fsensor"), fcur = fs.value;
  fs.innerHTML = SENSORS.map((n) => `<option value="${n}">${n} ${esc(cm(n))}</option>`).join("");
  fs.value = fcur || "X012";
}
function drawLadder() {
  const sec = sections()[+$("section").value];
  const items = layout.rungs.map((r, i) => [r, i]).filter(([r]) => r.sec === sec);
  const condCols = Math.max(3, ...items.filter(([r]) => r.k === "r").map(([r]) => size(r.cond)[0]));
  let top = 6, parts = [], para = null;
  for (const [r, i] of items) {
    if (r.k === "r" && r.para && r.para !== para) {
      para = r.para; parts.push(`<text class="para" x="${X0}" y="${top + 14}">${esc(short(half(r.para), 90))}</text>`); top += 22;
    }
    if (r.k === "r") {
      const g = rungSvg(r, i, top, condCols);
      parts.push(`<g class="rung" data-r="${i}"><rect class="hit" x="0" y="${top}" width="100%" height="${g.rows * H}"/>${g.svg}</g>`);
      top += g.rows * H + 4;
    } else {
      const text = r.k === "stl" ? `STL ${r.state}` : r.k.toUpperCase();
      parts.push(`<g class="stlbar" data-s="${i}"><rect x="${X0}" y="${top + 4}" width="130" height="24" rx="4"/><text x="${X0 + 10}" y="${top + 21}">${text}</text></g>`);
      top += 32;
    }
  }
  const width = xAt(condCols) + 260;
  $("ladder").innerHTML = `<svg xmlns="${SVGNS}" width="${width}" height="${top + 6}" viewBox="0 0 ${width} ${top + 6}">${parts.join("")}</svg>`;
  $("ladder").querySelectorAll(".rung").forEach((g) => g.addEventListener("click", () => showExplain(+g.dataset.r)));
  if (st) drawLadderState(true);
}
let lastLeaves = "";
function drawLadderState(force) {
  const root = $("ladder");
  if (force || st.leaves !== lastLeaves) {
    root.querySelectorAll(".ct").forEach((g) => g.classList.toggle("on", st.leaves[g.dataset.k] === "1"));
    lastLeaves = st.leaves;
  }
  root.querySelectorAll(".coil").forEach((g) => {
    const [ri, oi] = g.dataset.c.split(":").map(Number), o = layout.rungs[ri].out[oi];
    const bitCoil = (o[0] === "OUT" || o[0] === "SET") && /^[YMS]/.test(o[1] || "");
    g.classList.toggle("on", bitCoil ? !!st.coils[ri][oi] : !!st.power[ri]);
  });
  root.querySelectorAll(".stlbar").forEach((g) => g.classList.toggle("on", !!st.power[+g.dataset.s]));
  root.querySelectorAll(".rung").forEach((g) => g.classList.toggle("sel", +g.dataset.r === selected));
}
function showExplain(i) {
  selected = i;
  const box = $("explain");
  box.hidden = false;
  box.textContent = lab.explain(i, lang);
  drawLadderState(true);
}

/* ---------- controls ---------- */
document.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("click", () => lab && lab.command(b.dataset.cmd)));
$("estop").onclick = () => lab && lab.command(st.estop ? "estop_release" : "estop");
$("restart").onclick = () => { if (!lab) return; lab.reset(6); $("fmode").value = ""; };
$("fmode").onchange = $("fsensor").onchange = () => {
  if (!lab) return;
  SENSORS.forEach((n) => lab.fault(n, null));
  if ($("fmode").value !== "") lab.fault($("fsensor").value, +$("fmode").value);
};

function frame(t) {
  const dt = Math.min(100, last ? t - last : 16); last = t;
  const ms = Math.floor((dt * +$("speed").value) / 10) * 10;
  if (ms > 0) lab.run(ms);
  st = JSON.parse(lab.state());
  drawScene(); drawStatus(); drawIO(); drawLadderState(false);
  if (selected >= 0 && ++tick % 15 === 0) $("explain").textContent = lab.explain(selected, lang);
  requestAnimationFrame(frame);
}

/* ---------- waitlist ---------- */
if (window.NO_WAITLIST) $("wait").hidden = true;
$("wait").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target), body = Object.fromEntries(f.entries());
  body.consent = !!f.get("consent"); body.lang = lang; body.consent_version = "2026-11-09";
  const msg = $("wmsg");
  try {
    const r = await fetch(window.WAITLIST_URL || "/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(r.status);
    msg.textContent = MSG[lang].ok; e.target.reset();
  } catch (err) { msg.textContent = MSG[lang].bad; }
});

/* ---------- boot ---------- */
async function boot() {
  try { const saved = localStorage.getItem("ll_lang"); if (saved) lang = saved;
    else if (!/^zh/i.test(navigator.language || "")) lang = "en"; } catch (e) { /* ignore */ }
  applyLang();
  try {
    py = await loadPyodide();
    const files = (window.LL_FILES ? Object.keys(window.LL_FILES) : await (await fetch("py/manifest.json", { cache: "no-cache" })).json());
    py.FS.mkdir("/lab");
    for (const name of files) {
      const buf = (window.LL_FILES ? Uint8Array.from(atob(window.LL_FILES[name]), (c) => c.charCodeAt(0)) : new Uint8Array(await (await fetch("py/" + name, { cache: "no-cache" })).arrayBuffer()));
      py.FS.writeFile("/lab/" + name, buf);
    }
    py.runPython("import sys; sys.path.insert(0, '/lab')");
    lab = py.runPython("from bridge import Lab; Lab()");
    layout = JSON.parse(lab.layout_json());
    st = JSON.parse(lab.state());
    fillSelects(); buildIO(); drawLadder();
    $("section").onchange = () => { selected = -1; $("explain").hidden = true; drawLadder(); };
    $("loading").hidden = true;
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    $("loading").textContent = MSG[lang].load_fail;
  }
}
boot();
