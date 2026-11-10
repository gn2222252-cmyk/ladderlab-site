"use strict";
/* Fault-finding cases. Python side: engine/faults.py (FaultLab extends bridge.Lab). */
const XS = ["X000", "X001", "X002", "X003", "X004", "X005", "X006", "X007", "X010", "X011", "X012", "X013"];
const YS = ["Y000", "Y001", "Y002", "Y003", "Y004", "Y005", "Y006", "Y007"];
let py = null, lab = null, cat = null, layout = null, st = null, cs = null, last = 0, selected = -1, clueAt = 0, tick = 0;
const $ = (id) => document.getElementById(id);
const esc2 = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const half = (s) => (s || "").split("|")[0].trim();
const cm = (d) => (layout && layout.comments.zh[d]) || "";

function buildToc() {
  const solved = storeGet("ll_faults", []);
  $("toc").innerHTML = `<h3>故障案例</h3><ol>${cat.cases.map((c) =>
    `<li><a href="#${c.id}" class="${cs && cs.id === c.id ? "here" : ""}">${solved.includes(c.id) ? "✓ " : ""}<b>${c.id}</b> ${esc2(c.title)} <span class="lv">${"●".repeat(c.level)}</span>${c.free ? "" : ' <span class="pro-tag">Pro</span>'}</a></li>`).join("")}</ol>` +
    '<p class="toc-note">● 越多越難。Pro 案例在開放前免費試用。</p>';
}
$("tocbtn").onclick = () => document.body.classList.toggle("toc-open");

function open(id) {
  cs = JSON.parse(lab.load(id));
  document.title = `${cs.id} ${cs.title} | LadderLab 故障排除`;
  $("title").textContent = `${cs.id} ${cs.title}`;
  $("report").textContent = cs.report;
  $("level").textContent = "難度 " + "●".repeat(cs.level);
  $("dmsg").textContent = ""; $("dmsg").className = "dmsg";
  $("cluelist").innerHTML = ""; clueAt = 0; $("clue").disabled = false;
  $("repairbox").hidden = true; $("explainbox").hidden = true; $("repair").disabled = false; $("progress").textContent = "";
  $("part").value = ""; $("cause").value = "";
  selected = -1; $("explain").hidden = true;
  document.body.classList.remove("toc-open");
  buildToc();
  window.scrollTo(0, 0);
}

/* ---------- ladder ---------- */
function sections() { const s = []; layout.rungs.forEach((r) => { if (r.sec && !s.includes(r.sec)) s.push(r.sec); }); return s; }
function drawLadder() {
  const sec = sections()[+$("section").value];
  renderRungs($("ladder"), layout.rungs.map((r, i) => [r, i]).filter(([r]) => r.sec === sec), {
    text: half, onClick: (i) => { selected = i; $("explain").hidden = false; $("explain").textContent = lab.explain(i, "zh"); } });
}

/* ---------- controls ---------- */
document.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("click", () => lab && lab.command(b.dataset.cmd)));
$("estop").onclick = () => lab && lab.command(st && st.estop ? "estop_release" : "estop");
$("mode").onclick = () => lab && lab.command(st && st.auto ? "manual" : "auto");
$("restart").onclick = () => cs && open(cs.id);
$("section").onchange = () => { selected = -1; $("explain").hidden = true; drawLadder(); };
$("clue").onclick = () => {
  const clues = cs.clues;
  if (clueAt >= clues.length) return;
  $("cluelist").insertAdjacentHTML("beforeend", `<p><b>提示 ${clueAt + 1}</b> ${esc2(clues[clueAt])}</p>`);
  clueAt++; if (clueAt >= clues.length) $("clue").disabled = true;
};
$("submit").onclick = () => {
  if (!$("part").value || !$("cause").value) { $("dmsg").textContent = "兩個都要選。"; return; }
  const r = JSON.parse(lab.diagnose($("part").value, $("cause").value));
  $("dmsg").textContent = r.msg; $("dmsg").className = "dmsg " + (r.ok ? "good" : "bad");
  if (r.ok) $("repairbox").hidden = false;
};
$("repair").onclick = () => {
  const r = JSON.parse(lab.repair());
  $("repair").disabled = true;
  $("explainbox").hidden = false;
  $("explainbox").innerHTML = `<b>老師傅的診斷思路</b><br>${esc2(r.explain)}`;
};

/* ---------- loop ---------- */
function frame(t) {
  const dt = Math.min(100, last ? t - last : 16); last = t;
  const ms = Math.floor((dt * +$("speed").value) / 10) * 10;
  if (ms > 0) lab.run(ms);
  st = JSON.parse(lab.state());
  drawGantryScene($("scene"), st);
  const p = JSON.parse(lab.progress());
  $("status").innerHTML = `<span>時間 <b>${(st.time / 1000).toFixed(1)} s</b></span><span>步序 <b>${st.steps.join(" ") || "-"}</b></span>` +
    `<span>異常碼 D220 <b class="${p.code ? "alarm" : ""}">${p.code}（${esc2(p.alarm_text)}）</b></span>` +
    `<span>已搬運 <b>R ${st.placed.R} / L ${st.placed.L}</b></span>`;
  XS.forEach((n) => { const el = $("io-" + n); el.classList.toggle("on", !!st.x[parseInt(n.slice(1), 8)]); });
  YS.forEach((n, i) => $("io-" + n).classList.toggle("on", !!st.y[i]));
  $("estop").classList.toggle("latched", st.estop);
  $("mode").textContent = "模式：" + (st.auto ? "自動" : "手動");
  updateRungs($("ladder"), st, layout.rungs, selected);
  if (selected >= 0 && ++tick % 15 === 0) $("explain").textContent = lab.explain(selected, "zh");
  if (p.fixed) {
    $("progress").textContent = p.solved ? "✓ 結案！機台恢復生產。" : `修理完成。現在把機台救回來：已搬運 ${p.moved} / 2 個工件` + (p.code ? "（先按異常復歸）" : "");
    $("progress").className = "verdict " + (p.solved ? "good" : "");
    if (p.solved) { const s = storeGet("ll_faults", []); if (!s.includes(cs.id)) { s.push(cs.id); storeSet("ll_faults", s); buildToc(); } }
  }
  requestAnimationFrame(frame);
}

async function boot() {
  try {
    py = await bootPython();
    lab = py.runPython("from faults import FaultLab; FaultLab()");
    cat = JSON.parse(py.runPython("from faults import catalog; catalog()"));
    layout = JSON.parse(lab.layout_json());
    ladderComment = cm;
    $("part").innerHTML = '<option value="">請選擇</option>' + cat.parts.map(([v, t]) => `<option value="${v}">${esc2(t)}</option>`).join("");
    $("cause").innerHTML = '<option value="">請選擇</option>' + cat.causes.map(([v, t]) => `<option value="${v}">${esc2(t)}</option>`).join("");
    $("xs").innerHTML = XS.map((n) => `<li id="io-${n}"><i></i>${n} ${esc2(cm(n))}</li>`).join("");
    $("ys").innerHTML = YS.map((n) => `<li id="io-${n}"><i></i>${n} ${esc2(cm(n))}</li>`).join("");
    $("section").innerHTML = sections().map((s, i) => `<option value="${i}">${esc2(half(s))}</option>`).join("");
    $("section").value = String(Math.max(0, sections().findIndex((s) => s.startsWith("P5"))));
    drawLadder();
    const route = () => { const id = location.hash.slice(1); open(cat.cases.some((c) => c.id === id) ? id : cat.cases[0].id); };
    window.addEventListener("hashchange", route);
    route();
    $("loading").hidden = true;
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    $("loading").textContent = "模擬引擎載入失敗，請重新整理。";
  }
}
boot();
