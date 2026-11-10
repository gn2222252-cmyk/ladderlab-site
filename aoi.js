"use strict";
/* AOI sorter page. Python side: engine/aoi_bridge.py (the real 13_PLC program plus a LabVIEW stand-in). */
let py = null, lab = null, L = null, st = null, last = 0, selected = -1, tick = 0;
const $ = (id) => document.getElementById(id);
const esc2 = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* belt coordinates: D402 0..9000, stopper 4000, sort sensor 6850..7150, exit 8900 */
function drawScene() {
  const c = $("scene"), cx = c.getContext("2d"), W = 760, X0 = 40, X1 = 720, BY = 150;
  const px = (pos) => X0 + (pos / 9000) * (X1 - X0);
  cx.clearRect(0, 0, W, 300); cx.fillStyle = cssVar("--bg"); cx.fillRect(0, 0, W, 300);
  cx.fillStyle = cssVar("--belt"); cx.fillRect(X0 - 10, BY - 22, X1 - X0 + 20, 44);
  if (st.do.M100) { cx.strokeStyle = cssVar("--rail"); const off = (st.time / 6) % 22; for (let x = X0 - 10 + off; x < X1 + 10; x += 22) { cx.beginPath(); cx.moveTo(x, BY - 22); cx.lineTo(x, BY + 22); cx.stroke(); } }
  const label = (t, x, y, col) => { cx.fillStyle = col || cssVar("--mute"); cx.font = "12px system-ui"; cx.fillText(t, x, y); };
  // sensors
  [[200, "入料", st.di.M124], [4000, "到位", st.di.M125], [7000, "分選", st.di.M126], [8900, "出口", st.di.M127]].forEach(([p, t, on]) => {
    cx.fillStyle = on ? cssVar("--on") : cssVar("--line"); cx.beginPath(); cx.arc(px(p), BY + 34, 6, 0, 7); cx.fill(); label(t, px(p) - 12, BY + 56); });
  // stopper
  cx.fillStyle = st.do.M101 ? "#c62828" : cssVar("--rail"); cx.fillRect(px(4000) + 18, st.do.M101 ? BY - 26 : BY + 18, 6, st.do.M101 ? 52 : 10); label("擋料", px(4000) + 10, BY - 34);
  // camera
  cx.fillStyle = st.do.M106 ? "#ffcc33" : cssVar("--rail"); cx.fillRect(px(4000) - 14, 40, 28, 22); label("相機", px(4000) - 12, 34);
  if (st.do.M106) { cx.fillStyle = "rgba(255,204,51,.25)"; cx.beginPath(); cx.moveTo(px(4000) - 10, 62); cx.lineTo(px(4000) + 10, 62); cx.lineTo(px(4000) + 40, BY - 22); cx.lineTo(px(4000) - 40, BY - 22); cx.fill(); }
  // clamp
  cx.fillStyle = st.do.M102 ? cssVar("--on") : cssVar("--line"); cx.fillRect(px(4000) - 36, BY - 6, st.do.M102 ? 18 : 8, 12); label("夾爪", px(4000) - 60, BY + 4);
  // pusher and NG bin
  const pushOut = st.do.M103 ? 30 : 0;
  cx.fillStyle = cssVar("--rail"); cx.fillRect(px(7000) - 12, BY + 60 - pushOut, 24, 30); label("推料", px(7000) + 16, BY + 82);
  cx.strokeStyle = cssVar("--ink"); cx.strokeRect(px(7000) - 30, 40, 60, 40); label(`NG 料盒 ${st.bin}`, px(7000) - 30, 34, st.di.M134 ? "#c62828" : null);
  // part
  if (st.part.on) {
    const x = px(Math.min(st.part.pos, 9000));
    cx.fillStyle = st.part.result === 2 ? "#c62828" : st.part.result === 1 ? "#2f9e44" : "#e8833a";
    cx.fillRect(x - 24, BY - 14, 24, 28);
    cx.fillStyle = "#fff"; cx.font = "10px system-ui"; cx.fillText(String(st.part.id).slice(-2), x - 18, BY + 4);
  }
  // lamps
  [["M110", "#2f9e44", "綠"], ["M109", "#f2a900", "黃"], ["M108", "#c62828", "紅"]].forEach(([d, col, t], i) => {
    cx.fillStyle = st.do[d] ? col : cssVar("--line"); cx.beginPath(); cx.arc(W - 40, 40 + i * 26, 9, 0, 7); cx.fill(); });
  if (st.estop || st.alarm) { cx.fillStyle = "rgba(198,40,40,.10)"; cx.fillRect(0, 0, W, 300); }
}

function guide() {
  if (st.estop) return "急停中。解除急停後按「異常復歸」。";
  if (st.alarm) return st.cause_present ? `異常 ${st.alarm}：原因還在，先排除（看右邊的故障設定），再按異常復歸。` : `異常 ${st.alarm}：原因已排除，按「異常復歸」回到初始化。`;
  if (st.step < 30) return "上電後自動初始化、清線 6 秒，等它進入待機。";
  if (st.step === 30) return "待機中，按「啟動」。";
  return "運轉中。試試右邊「上位機」改成不回覆、取消心跳，或勾氣壓不足，看會跳哪個異常碼，再到階梯圖第 3 區找原因。";
}

function frame(t) {
  const dt = Math.min(100, last ? t - last : 16); last = t;
  lab.run(Math.round(dt / 10) * 10);
  st = JSON.parse(lab.state());
  drawScene();
  $("status").innerHTML = `<span>步序 D300 <b>${st.step}（${esc2(L.steps[st.step] || "")}）</b></span>` +
    `<span>異常碼 D301 <b class="${st.alarm ? "alarm" : ""}">${st.alarm}（${esc2(L.alarms[st.alarm] || "")}）</b></span>` +
    `<span>總數 <b>${st.total}</b> OK <b>${st.ok}</b> NG <b>${st.ng}</b></span><span>氣壓 <b>${(st.air / 1000).toFixed(2)} MPa</b></span>`;
  $("hostlog").textContent = st.log.join("　");
  const g = guide(); if ($("guide").textContent !== g) $("guide").textContent = g;
  $("dos").querySelectorAll("li").forEach((li) => li.classList.toggle("on", !!st.do[li.dataset.d]));
  $("dis").querySelectorAll("li").forEach((li) => li.classList.toggle("on", !!st.di[li.dataset.d]));
  $("estop").classList.toggle("latched", st.estop);
  updateRungs($("ladder"), st, L.rungs, selected);
  drawChallenge();
  if (selected >= 0 && ++tick % 15 === 0) $("explain").textContent = lab.explain(selected);
  requestAnimationFrame(frame);
}

/* ---------- fault challenge ---------- */
let cs = null, clueAt = 0;
$("case").onchange = () => {
  const id = $("case").value;
  clueAt = 0; $("ch-clues").innerHTML = ""; $("ch-msg").textContent = ""; $("ch-repair").hidden = true; $("ch-explain").hidden = true;
  $("ch-fix").disabled = false; $("ch-progress").textContent = "";
  ["host", "hb", "air", "clamp"].forEach((k) => { $(k).disabled = !!id; });   // the challenge owns the faults
  if (!id) { cs = null; lab.case = null; lab.fixed = false; lab.reset(); $("ch-body").hidden = true; return; }
  cs = JSON.parse(lab.load(id));
  $("ch-body").hidden = false;
  $("ch-report").textContent = cs.report; $("ch-level").textContent = "難度 " + "●".repeat(cs.level);
};
$("ch-clue").onclick = () => { if (!cs || clueAt >= cs.clues.length) return; $("ch-clues").insertAdjacentHTML("beforeend", `<p><b>提示 ${clueAt + 1}</b> ${esc2(cs.clues[clueAt])}</p>`); clueAt++; };
$("ch-submit").onclick = () => {
  if (!$("ch-part").value || !$("ch-cause").value) { $("ch-msg").textContent = "兩個都要選。"; return; }
  const r = JSON.parse(lab.diagnose($("ch-part").value, $("ch-cause").value));
  $("ch-msg").textContent = r.msg; $("ch-msg").className = "dmsg " + (r.ok ? "good" : "bad");
  if (r.ok) $("ch-repair").hidden = false;
};
$("ch-fix").onclick = () => {
  const r = JSON.parse(lab.repair()); $("ch-fix").disabled = true;
  $("ch-explain").hidden = false; $("ch-explain").innerHTML = `<b>診斷思路</b><br>${esc2(r.explain)}`;
};
function drawChallenge() {
  if (!cs) return;
  const g = JSON.parse(lab.regs());
  $("regs").innerHTML = `<span>D302 b0 檢測請求 <b>${g.D302_b0}</b></span><span>D306 零件 ID <b>${g.D306}</b></span>` +
    `<span>D510 檢測結果 <b>${g.D510}</b></span><span>D511 結果已寫入 <b>${g.D511}</b></span><span>D520 心跳 <b>${g.D520}</b></span>` +
    `<span>D314 氣壓 <b>${g.D314}</b></span><span>D550 <b>${g.D550}</b></span>`;
  const p = JSON.parse(lab.progress());
  if (p.fixed) {
    $("ch-progress").textContent = p.solved ? "✓ 結案！生產恢復。" : `修理完成。異常復歸 → 等回到待機 → 啟動：已完成 ${p.moved} / 2 顆`;
    $("ch-progress").className = "verdict " + (p.solved ? "good" : "");
    if (p.solved) { const s = storeGet("ll_aoi", []); if (!s.includes(cs.id)) { s.push(cs.id); storeSet("ll_aoi", s); } }
  }
}

function sections() { const s = []; L.rungs.forEach((r) => { if (r.sec && !s.includes(r.sec)) s.push(r.sec); }); return s; }
function drawLadder() {
  const sec = sections()[+$("section").value];
  renderRungs($("ladder"), L.rungs.map((r, i) => [r, i]).filter(([r]) => r.sec === sec), {
    onClick: (i) => { selected = i; $("explain").hidden = false; $("explain").textContent = lab.explain(i); } });
}

document.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("click", () => lab && lab.command(b.dataset.cmd)));
$("estop").onclick = () => lab && lab.command(st && st.estop ? "estop_release" : "estop");
$("host").onchange = () => lab.set_host($("host").value, +$("ngrate").value / 100);
$("ngrate").oninput = () => { $("ngval").textContent = $("ngrate").value + "%"; lab.set_host($("host").value, +$("ngrate").value / 100); };
$("hb").onchange = () => lab.set_heartbeat($("hb").checked);
$("air").onchange = () => lab.set_air(!$("air").checked);
$("clamp").onchange = () => lab.clamp_stuck($("clamp").checked);
$("speed").oninput = () => { $("spval").textContent = $("speed").value + "%"; lab.set_speed(+$("speed").value); };
$("section").onchange = () => { selected = -1; $("explain").hidden = true; drawLadder(); };

async function boot() {
  try {
    py = await bootPython();
    lab = py.runPython("from aoi_faults import AoiFaultLab; AoiFaultLab()");
    const fc = JSON.parse(py.runPython("from aoi_faults import catalog; catalog()"));
    $("case").innerHTML += fc.cases.map((c) => `<option value="${c.id}">${c.id} ${esc2(c.title)} ${"●".repeat(c.level)}${c.free ? "" : "（Pro 試用）"}</option>`).join("");
    $("ch-part").innerHTML = '<option value="">請選擇</option>' + fc.parts.map(([v, t]) => `<option value="${v}">${esc2(t)}</option>`).join("");
    $("ch-cause").innerHTML = '<option value="">請選擇</option>' + fc.causes.map(([v, t]) => `<option value="${v}">${esc2(t)}</option>`).join("");
    L = JSON.parse(lab.layout_json());
    ladderComment = (d) => L.comments.zh[d] || "";
    $("dos").innerHTML = L.do.map(([d, t]) => `<li data-d="${d}"><i></i>${d} ${esc2(t)}</li>`).join("");
    $("dis").innerHTML = L.di.map(([d, t]) => `<li data-d="${d}"><i></i>${d} ${esc2(t)}</li>`).join("");
    $("section").innerHTML = sections().map((s, i) => `<option value="${i}">${esc2(s.split("|")[0].trim())}</option>`).join("");
    $("section").value = String(Math.max(0, sections().findIndex((s) => /SECTION 2/.test(s))));
    drawLadder();
    const want = location.hash.slice(1);
    if (fc.cases.some((c) => c.id === want)) { $("case").value = want; $("case").onchange(); }
    $("loading").hidden = true;
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    $("loading").textContent = "模擬引擎載入失敗，請重新整理。";
  }
}
boot();
