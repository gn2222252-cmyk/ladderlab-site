"use strict";
/* Program health check. Python side: engine/check_bridge.py + engine/analyzer.py. */
let py = null, last = null;
const $ = (id) => document.getElementById(id);
const esc2 = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const KIND = { double_coil: "雙線圈", set_no_reset: "SET 沒有 RST", read_never_set: "讀了沒人寫", timer_reuse: "計時器重複",
  no_initial: "沒有啟動初始步", capacity: "超過容量", out_s_outside: "OUT S 用錯地方",
  counter_k0: "計數器設 0", state_dead_end: "步沒有出口", state_never_entered: "步沒被進入",
  adjacent_timer: "相鄰步共用計時器", io_range: "超出機型點數" };

function lines(ls) { return ls.map((n) => `<a href="#" data-line="${n}">${n}</a>`).join("、"); }
function run() {
  if (!py) return;
  const text = $("code").value;
  last = JSON.parse(py.runPython(`from check_bridge import check_text; check_text(${JSON.stringify(text)}, ${JSON.stringify($("cpu").value)})`));
  const r = last, pct = r.limit ? Math.round((r.steps / r.limit) * 100) : 0;
  let html = `<div class="sumgrid"><div><b>${r.instructions}</b><span>指令</span></div><div><b>${r.steps}</b><span>步（${r.cpu} 上限 ${r.limit || "?"}，用了 ${pct}%）</span></div>` +
    `<div><b>${r.counts.X}/${r.counts.Y}</b><span>用到的 X／Y</span></div><div><b class="${r.warnings.length ? "bad" : "good"}">${r.warnings.length}</b><span>個提醒</span></div></div>`;
  if (r.errors.length) html += `<h3>語法問題</h3><ul class="errors">${r.errors.slice(0, 20).map((e) => `<li>${e.line ? `第 <a href="#" data-line="${e.line}">${e.line}</a> 行：` : ""}${esc2(e.msg)}</li>`).join("")}</ul>`;
  html += r.warnings.length ? `<h3>提醒</h3><ul class="warns">${r.warnings.map((w) =>
    `<li><span class="tag">${KIND[w.kind] || w.kind}</span> ${esc2(w.msg)}${w.lines.length ? `<br><small>行號：${lines(w.lines)}</small>` : ""}</li>`).join("")}</ul>`
    : '<p class="good">沒有發現規則能找到的問題。（規則式檢查不能取代人工審查與實機測試）</p>';
  $("report").innerHTML = html;
  $("report").querySelectorAll("[data-line]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); goLine(+a.dataset.line); }));
  drawXref();
  drawExplain(text);
}
let lastDoc = null;
function drawExplain(text) {
  lastDoc = JSON.parse(py.runPython(`from check_bridge import explain_doc; explain_doc(${JSON.stringify(text)})`));
  if (!lastDoc.ok) { $("explain-list").innerHTML = `<li>${esc2(lastDoc.msg)}</li>`; return; }
  $("explain-list").innerHTML = lastDoc.rungs.slice(0, 800).map((r) => r.kind === "step" ? `<li class="ex-step">${esc2(r.text)}</li>`
    : `<li><a href="#" data-line="${r.line}">第 ${r.line} 行</a>　${esc2(r.text)}</li>`).join("");
  $("explain-list").querySelectorAll("[data-line]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); goLine(+a.dataset.line); }));
}
function save(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$("dl-doc").onclick = () => {
  if (!lastDoc || !lastDoc.ok || !last) return;
  const md = ["# 程式說明", "", `- 指令 ${last.instructions}、步數 ${last.steps}（${last.cpu} 上限 ${last.limit}）`, `- 健檢提醒 ${last.warnings.length} 則`, ""]
    .concat(last.warnings.map((w) => `  - ${KIND[w.kind] || w.kind}：${w.msg}`), ["", "## 逐條說明", ""])
    .concat(lastDoc.rungs.map((r) => r.kind === "step" ? `\n### ${r.text}\n` : `- 第 ${r.line} 行：${r.text}`),
      ["", "> 由 LadderLab 程式健檢以規則產生，請搭配人工審查與實機測試。"]);
  save("程式說明.md", md.join("\n"), "text/markdown");
};
$("dl-io").onclick = () => {
  if (!py) return;
  save("IO表.csv", py.runPython(`from check_bridge import io_csv; io_csv(${JSON.stringify($("code").value)})`), "text/csv");
};
function drawXref() {
  if (!last) return;
  const k = $("kind").value;
  const rows = last.devices.filter((d) => !k || d.dev[0] === k);
  $("xref").innerHTML = `<thead><tr><th>元件</th><th>註解</th><th>寫入（行）</th><th>讀取（行）</th></tr></thead><tbody>` +
    rows.slice(0, 600).map((d) => `<tr><td><b>${d.dev}</b></td><td>${esc2(d.comment)}</td><td>${d.how.join("/")} ${lines(d.writes.slice(0, 12))}${d.writes.length > 12 ? "…" : ""}</td>` +
      `<td>${lines(d.reads.slice(0, 12))}${d.reads.length > 12 ? "…" : ""}</td></tr>`).join("") + "</tbody>";
  $("xref").querySelectorAll("[data-line]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); goLine(+a.dataset.line); }));
}
function goLine(n) {
  const ta = $("code"), all = ta.value.split("\n");
  let start = 0;
  for (let i = 0; i < n - 1 && i < all.length; i++) start += all[i].length + 1;
  ta.focus(); ta.setSelectionRange(start, start + (all[n - 1] || "").length);
  ta.scrollTop = Math.max(0, (n - 5) * 20);
}
$("run").onclick = run;
$("kind").onchange = drawXref;
document.querySelectorAll("[data-sample]").forEach((b) => b.addEventListener("click", () => {
  if (!py) return;
  $("code").value = py.runPython(`from check_bridge import sample; sample(${JSON.stringify(b.dataset.sample)})`);
  run();
}));
$("csvin").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f || !py) return;
  const buf = new Uint8Array(await f.arrayBuffer()); let bin = ""; buf.forEach((x) => { bin += String.fromCharCode(x); });
  const r = JSON.parse(py.runPython(`from check_bridge import csv_to_text; csv_to_text(${JSON.stringify(btoa(bin))})`));
  e.target.value = "";
  if (!r.ok) { alert("讀不懂這個檔案：" + r.msg); return; }
  $("code").value = r.text; run();
});
(async () => {
  try { py = await bootPython(); $("loading").hidden = true; }
  catch (err) { console.error(err); $("loading").textContent = "分析引擎載入失敗，請重新整理。"; }
  renderWaitlist($("wl"), "check", "想要 AI 逐條解釋程式、自動產生 I/O 文件嗎？（工程師 Pro）");
})();
