"use strict";
/* Practice page: the learner writes IL, sees the ladder, runs it on the machine, then grades it.
Python side: engine/practice_bridge.py and engine/exercises.py (tests prove each reference answer passes). */
const PALETTE = ["LD", "LDI", "AND", "ANI", "OR", "ORI", "OUT", "SET", "RST", "PLS", "STL", "RET", "ANB", "ORB", "MOV", "INC", "ZRST"];
const DEV = ["X000", "X001", "X002", "Y000", "Y001", "Y002", "M0", "T0 K10", "C0 K5", "S0", "S20"];
let py = null, pr = null, cat = [], ex = null, layout = null, st = null, last = 0, hintAt = 0, timer = null;
let led = null, etab = "il", ltimer = null, ldirty = false;   // ldirty: the ladder was edited since it was loaded
const $ = (id) => document.getElementById(id);
const esc2 = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function buildToc() {
  const passed = storeGet("ll_pass", []);
  const li = (e) => `<li><a href="#${e.id}" class="${ex && ex.id === e.id ? "here" : ""}">${passed.includes(e.id) ? "✓ " : ""}<b>${e.id}</b> ${esc2(e.title)}${e.free || e.exam ? "" : ' <span class="pro-tag">Pro</span>'}</a></li>`;
  const byId = Object.fromEntries(cat.map((e) => [e.id, e]));
  const groups = window.Course ? Course.data.chapters.concat(Course.data.tracks).map((sec) => {
    const es = sec.items.filter((it) => it.k === "E" && byId[it.id]).map((it) => byId[it.id]);
    if (!es.length) return "";                    /* only the current chapter open (tester round 10: 30+ items were too many) */
    const here = ex && es.some((e) => e.id === ex.id), n = es.filter((e) => passed.includes(e.id)).length;
    return `<details class="tocgrp"${here || (!ex && sec.main && sec.id === "1") ? " open" : ""}><summary>${esc2(Course.secName(sec))}<span class="toc-count">${n}/${es.length}</span></summary><ol>${es.map(li).join("")}</ol></details>`;
  }).join("") : `<ol>${cat.map(li).join("")}</ol>`;
  $("toc").innerHTML = `<p class="toc-note"><a href="path.html">‹ 課程地圖</a></p><h3>自由練習</h3><ol><li><a href="#FREE" class="${ex && ex.id === "FREE" ? "here" : ""}"><b>✎</b> 自己寫、分享給別人</a></li></ol>` +
    groups + `<p class="toc-note">Pro 題目在開放前免費試用。</p>`;
}
$("tocbtn").onclick = () => document.body.classList.toggle("toc-open");

function open(eid) {
  ex = JSON.parse(pr.load(eid));
  document.title = (ex.id === "FREE" ? ex.title : `${ex.id} ${ex.title}`) + " | LadderLab 練習";
  const free = ex.id === "FREE";
  const lf = window.Course && Course.find("L", ex.lesson), ef = window.Course && Course.find("E", ex.id);
  $("crumb").textContent = free ? "自由練習" : ef && !ef.sec.main ? "技能檢定題" : lf ? `練習題 · 學完 ${lf.it.no} ${lf.it.label} 後做` : "練習題";
  $("grade").hidden = free; $("hint").hidden = free; $("sol").hidden = free; $("share").hidden = !free;
  $("title").textContent = ex.id === "FREE" ? ex.title : `${ex.id} ${ex.title}`;
  $("task").textContent = ex.task;
  const rows = ex.inputs.map(([d, l, k]) => [d, l, { hold: "按鈕（按住）", toggle: "開關", sensor: "感測器（機台自己動）" }[k]])
    .concat(ex.outputs.map(([d, l]) => [d, l, "輸出"]));
  $("iotable").innerHTML = `<thead><tr><th>元件</th><th>用途</th><th>種類</th></tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc2(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  $("rules").innerHTML = ex.rules.map((r) => `<li>安全條件（絕對不可以發生）：${esc2(r)}</li>`).join("") + ex.forbid.map((f) => `<li>不能使用 ${f}</li>`).join("");
  $("inputs").innerHTML = ex.inputs.map(([dev, label, kind]) =>
    `<button type="button" class="inp ${kind}" data-dev="${dev}" data-kind="${kind}" ${kind === "sensor" ? "disabled" : ""}>` +
    `<i></i><span><b>${dev}</b> ${esc2(label)}</span><small>${{ hold: "按住", toggle: "切換", sensor: "感測器" }[kind]}</small></button>`).join("");
  $("inputs").querySelectorAll(".inp").forEach(wireInput);
  $("lockwrap").hidden = ex.inputs.filter((x) => x[2] === "hold").length < 2;
  $("lockhold").checked = false;
  if (ex.latched) {
    $("inputs").insertAdjacentHTML("beforeend", `<button type="button" class="inp power" id="powerbtn"><i></i><span><b>⚡</b> 停電再復電</span><small>電源</small></button>`);
    $("powerbtn").onclick = () => pr.power_cycle();
  }
  $("outputs").innerHTML = ex.outputs.map(([dev, label]) => `<li data-dev="${dev}"><i></i><b>${dev}</b> ${esc2(label)}</li>`).join("") || "<li>（這題看 D0）</li>";
  $("plant-box").hidden = !ex.plant;
  $("pfaults").innerHTML = (ex.faults || []).map(([k, t]) => `<label class="check small"><input type="checkbox" data-f="${k}"> 製造故障：${esc2(t)}</label>`).join("");
  $("pfaults").querySelectorAll("input").forEach((c) => c.addEventListener("change", () => pr.set_fault(c.dataset.f, c.checked)));
  hintAt = 0; $("hints").innerHTML = "";
  $("hint").disabled = false;
  /* exam mode (?exam=1, for teachers): no hints, no reference solution, no part import; grading still works */
  const examMode = new URLSearchParams(location.search).get("exam") === "1";
  $("hint").hidden = examMode; $("sol").hidden = examMode;
  if (examMode) {
    $("frompart").hidden = true;
    $("task").insertAdjacentHTML("afterbegin", `<p class="callout warn">考試模式：提示和參考解答已隱藏，評分照常。要回到一般模式，把網址裡的 ?exam=1 拿掉。</p>`);
  }
  $("results").innerHTML = ""; $("verdict").textContent = ""; $("verdict").className = "verdict"; $("wl").hidden = true;
  const prevPart = { E18b: "E18a", E18: "E18b" }[ex.id];  /* E18 in parts: start from the previous part's program */
  $("frompart").hidden = !prevPart || examMode;
  if (prevPart) { $("frompart").textContent = `帶入 ${prevPart} 的程式`; $("frompart").dataset.from = prevPart; }
  const saved = storeGet("ll_code_" + ex.id, null);
  $("code").value = saved !== null ? saved : ex.starter;
  compileNow();
  etab = "il";                                     // a new exercise: the ladder editor is loaded from its program
  showEditor(storeGet("ll_editor_tab", "ladder"));
  document.body.classList.remove("toc-open");
  buildToc();
  window.scrollTo(0, 0);
}

/* ---------- editor ---------- */
function gutter() {
  const n = $("code").value.split("\n").length;
  $("gutter").textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
  $("gutter").scrollTop = $("code").scrollTop;
}
$("code").addEventListener("input", () => {
  gutter();
  storeSet("ll_code_" + ex.id, $("code").value);
  clearTimeout(timer); timer = setTimeout(compileNow, 350);
});
$("code").addEventListener("scroll", () => { $("gutter").scrollTop = $("code").scrollTop; });
$("code").addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); gradeNow(); } });
function insert(text) {
  const ta = $("code"), a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
  const atLineStart = a === 0 || v[a - 1] === "\n";
  const isOp = PALETTE.includes(text);
  let add = isOp ? (atLineStart ? "" : "\n") + text + (["ANB", "ORB", "RET"].includes(text) ? "\n" : " ") : (v[a - 1] === " " || atLineStart ? "" : " ") + text + "\n";
  ta.value = v.slice(0, a) + add + v.slice(b);
  ta.selectionStart = ta.selectionEnd = a + add.length;
  ta.focus();
  ta.dispatchEvent(new Event("input"));
}
$("palette").innerHTML = PALETTE.map((p) => `<button type="button" class="chip" data-ins="${p}">${p}</button>`).join("") +
  '<span class="sep"></span>' + DEV.map((d) => `<button type="button" class="chip dev" data-ins="${d}">${d}</button>`).join("");
$("palette").querySelectorAll("[data-ins]").forEach((b) => b.addEventListener("click", () => insert(b.dataset.ins)));

function compileNow() {
  gutter();
  $("pfaults").querySelectorAll("input").forEach((c) => { c.checked = false; });   // a new run starts without faults
  $("inputs").querySelectorAll(".inp").forEach((b) => { b._held = false; });        // and with every latched button released
  const out = JSON.parse(pr.compile($("code").value));
  $("errors").innerHTML = out.errors.map((e) => `<li>${e.line ? `第 ${e.line} 行：` : ""}${esc2(e.msg)}</li>`).join("");
  layout = out.rungs;
  if (layout.length) {
    ladderComment = (dev) => { const f = ex.inputs.concat(ex.outputs).find((r) => r[0] === dev); return f ? f[1] : ""; };
    renderRungs($("ladder"), layout.map((r, i) => [r, i]), {});
    showSfc(pr.sfc(), ladderComment);
  } else {
    $("ladder").innerHTML = `<p class="empty">${!out.errors.length || (out.errors.length === 1 && /還沒有寫任何指令/.test(out.errors[0].msg)) ? "還沒寫程式。" : "先修正上面的錯誤，階梯圖才會出現。"}</p>`;
  }
}
$("restart").onclick = () => { compileNow(); $("pfaults").querySelectorAll("input").forEach((c) => { c.checked = false; }); };

$("lockhold").addEventListener("change", () => {       // leaving lock mode releases everything that was latched
  if (!$("lockhold").checked) $("inputs").querySelectorAll('.inp[data-kind="hold"]').forEach((b) => { if (b._held) { b._held = false; pr.set_input(b.dataset.dev, 0); } });
});
function wireInput(b) {
  const dev = b.dataset.dev, kind = b.dataset.kind;
  if (kind === "hold") {
    /* "lock" mode: a click latches the button, so two hold buttons can be down together with one mouse */
    const lock = () => $("lockhold").checked;
    const on = (e) => { e.preventDefault();
      if (lock()) { b._held = !b._held; pr.set_input(dev, b._held ? 1 : 0); return; }
      pr.set_input(dev, 1); try { b.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } };
    const off = () => { if (!lock()) { b._held = false; pr.set_input(dev, 0); } };
    b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off);
    b.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); pr.set_input(dev, 1); } });
    b.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") pr.set_input(dev, 0); });
  } else if (kind === "toggle") b.addEventListener("click", () => pr.toggle(dev));
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

/* ---------- hints, solution, grading ---------- */
$("hint").onclick = () => {
  if (hintAt >= ex.hints.length) return;
  $("hints").insertAdjacentHTML("beforeend", `<p><b>提示 ${hintAt + 1}</b> ${esc2(ex.hints[hintAt])}</p>`);
  hintAt++;
  if (hintAt >= ex.hints.length) $("hint").disabled = true;
};
$("sol").onclick = () => {
  if (!confirm("先自己試過再看比較有用。確定要看參考解答嗎？（會取代編輯器裡的程式）")) return;
  setCode(pr.solution());
};
$("reset").onclick = () => {
  if (!confirm("清掉你寫的程式，回到題目一開始的樣子？")) return;
  setCode(ex.starter);
};
function gradeNow() {
  if (etab === "ladder" && !syncFromLadder()) {
    $("verdict").textContent = "梯形圖還有錯誤，先修正再評分。"; $("verdict").className = "verdict bad";
    return;
  }
  const r = JSON.parse(pr.grade($("code").value));
  if (!r.compiled) {
    $("verdict").textContent = "程式有錯誤，還不能評分。"; $("verdict").className = "verdict bad";
    $("results").innerHTML = r.errors.map((e) => `<li class="bad">${e.line ? `第 ${e.line} 行：` : ""}${esc2(e.msg)}</li>`).join("");
    return;
  }
  const ok = r.results.filter((x) => x.ok).length;
  $("verdict").textContent = r.passed ? `全部通過（${ok}/${r.results.length}）` : `通過 ${ok}/${r.results.length}`;
  $("verdict").className = "verdict " + (r.passed ? "good" : "bad");
  $("results").innerHTML = (r.notes || []).map((n) => `<li class="bad"><b>⚠ 先看這個</b><br><span>${esc2(n)}</span></li>`).join("") +
    r.results.map((x) => `<li class="${x.ok ? "good" : "bad"}"><b>${x.ok ? "✓" : "✗"} ${esc2(x.name)}</b>${x.why ? `<br><span>${esc2(x.why)}</span>` : ""}</li>`).join("");
  if (r.passed) {
    $("wl").hidden = false;
    renderWaitlist($("wl"), "practice-" + ex.id, "通過了！想要更多題目和機台嗎？");
    const p = storeGet("ll_pass", []);
    if (!p.includes(ex.id)) { p.push(ex.id); storeSet("ll_pass", p); buildToc(); }
  }
}
$("grade").onclick = gradeNow;
$("share").onclick = async () => {
  const url = `${location.origin}${location.pathname}?il=${encodeURIComponent($("code").value)}#FREE`;
  if (url.length > 6000) { alert("程式太長，分享連結放不下。請改用「下載指令表」。"); return; }
  try { await navigator.clipboard.writeText(url); $("verdict").textContent = "分享連結已複製，貼給朋友就能直接執行。"; }
  catch (e) { prompt("複製這個連結：", url); }
};

/* ---------- ladder editor: draws the same program; the instruction list stays what is graded ---------- */
$("frompart").onclick = () => {
  const from = $("frompart").dataset.from, code = storeGet("ll_code_" + from, null);
  if (!code || !code.trim() || code.trim() === (cat.find((e) => e.id === from) || {}).starter) { window.alert(`${from} 還沒有你寫的程式。先到 ${from} 寫好（通過評分最好），再回來帶入。`); return; }
  const now = $("code").value.trim();
  if (now && now !== ex.starter.trim() && now !== code.trim() && !window.confirm(`用 ${from} 的程式取代目前這一段的程式？`)) return;
  setCode(code);
};
function setCode(text) {
  clearTimeout(ltimer); ldirty = false;           // a program from outside replaces whatever the ladder had pending
  $("code").value = text;
  $("code").dispatchEvent(new Event("input"));
  if (etab === "ladder") loadLadder();
}
function devComment(dev) {
  const n = String(dev || "").toUpperCase().replace(/^([XY])0*(\d+)$/, (m, k, d) => k + d.padStart(3, "0"));
  const f = ex ? ex.inputs.concat(ex.outputs).find((r) => r[0] === n) : null;
  return f ? f[1] : "";
}
function leadComments(text) {                     // the comment lines before the first instruction survive ladder edits
  const out = [];
  for (const line of text.split("\n")) { if (/^\s*(;|$)/.test(line)) out.push(line); else break; }
  return out.join("\n").replace(/\s+$/, "");
}
function syncFromLadder() {
  if (!led || !ldirty || etab !== "ladder") return true;   // only the ladder tab writes back; just looking keeps the list (and comments)
  const r = led.compile();
  if (r.errors && r.errors.length) {
    led.showErrors(r.errors);
    $("errors").innerHTML = r.errors.map((e) => `<li>${e.rung !== undefined && e.rung !== null ? `第 ${e.rung + 1} 條梯級：` : ""}${esc2(e.msg)}</li>`).join("");
    return false;
  }
  const bare = (t) => t.split("\n").map((l) => l.split(";")[0].trim().toUpperCase().replace(/\s+/g, " ")
    .replace(/\b([XY])0*(\d+)\b/g, (m, k, d) => k + d.padStart(3, "0"))).filter(Boolean).join("\n");
  if (bare(r.il) === bare($("code").value)) { ldirty = false; return true; }   // same program: keep the comments
  const head = leadComments($("code").value), il = (head ? head + "\n" : "") + r.il;
  if (il !== $("code").value) { $("code").value = il; $("code").dispatchEvent(new Event("input")); }
  ldirty = false;
  return true;
}
function loadLadder() {
  if (!led) return false;
  const g = LEdit.fromIL($("code").value);
  if (!g.rungs) {
    etab = "il";                                   // nothing in the ladder editor to keep: do not sync it back
    showEditor("il", true);
    $("errors").innerHTML = `<li>這個程式有梯形圖編輯器畫不出來的寫法（${esc2((g.warnings || []).join("；"))}），請在「指令表」修改。</li>`;
    return false;
  }
  led.set(g.rungs);
  ldirty = false;
  if (g.warnings && g.warnings.length) $("errors").innerHTML = g.warnings.map((w) => `<li>${esc2(w)}</li>`).join("");
  return true;
}
function showEditor(t, quiet) {
  if (t === "ladder" && !led) t = "il";
  if (t === "ladder" && etab !== "ladder") { etab = "ladder"; if (!loadLadder()) return; }
  if (t === "il" && etab === "ladder") syncFromLadder();
  etab = t;
  if (!quiet) storeSet("ll_editor_tab", t);
  $("ed-ladder").hidden = t !== "ladder"; $("ladder-note").hidden = t !== "ladder";
  document.querySelector(".editor").hidden = t === "ladder"; $("palette").hidden = t === "ladder";
  document.querySelectorAll("#etabs button").forEach((b) => b.classList.toggle("here", b.dataset.e === t));
  if (t === "ladder" && led && led.redraw) led.redraw();
}
document.querySelectorAll("#etabs button").forEach((b) => (b.onclick = () => showEditor(b.dataset.e)));

/* ---------- GX Works2 CSV in and out ---------- */
function download(name, bytes, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$("csvin").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const buf = new Uint8Array(await f.arrayBuffer());
  let bin = ""; buf.forEach((b) => { bin += String.fromCharCode(b); });
  const r = JSON.parse(pr.import_csv(btoa(bin)));
  e.target.value = "";
  if (!r.ok) { alert("讀不懂這個檔案：" + r.msg + "\n請確認是 GX Works2 匯出的程式 CSV（UTF-16）。"); return; }
  setCode(`; 從 GX Works2 匯入：${f.name}（${r.plc || "未知 PLC"}，${r.count} 個指令）\n` + r.il);
});
$("csvout").onclick = () => {
  if (etab === "ladder" && !syncFromLadder()) { alert("梯形圖還有錯誤，先修正再下載。"); return; }
  const b64 = pr.export_csv($("code").value);
  if (!b64) { alert("程式還有錯誤，先修正再下載。"); return; }
  if (!confirm("下載成 GX Works2 程式 CSV 格式（FX3S）。\n格式和學校 FX3S 從 GX Works2 匯出的檔案逐位元組相同。\n放回 GX Works2：打開梯形圖，用「編輯 ▸ 讀取 CSV 檔案」（英文版 Edit ▸ Read from CSV File），會取代目前的程式。\n只能用在「簡單工程、不使用標籤」；建立工程時勾了「使用標籤」，選單會是灰的。\n實機匯入還等學校確認；失敗時請改用「下載指令表」照著輸入。")) return;
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  download(`${ex.id}_${ex.title}.csv`, bytes, "text/csv");
};
$("txtout").onclick = () => download(`${ex.id}_${ex.title}.txt`, new TextEncoder().encode($("code").value), "text/plain");

/* ---------- loop ---------- */
function frame(t) {
  const dt = Math.min(100, last ? t - last : 16); last = t;
  pr.tick(Math.round(dt / 10) * 10);
  st = JSON.parse(pr.state());
  if (st) {
    if (layout && layout.length) updateRungs($("ladder"), st, layout, -1);
    if (view === "sfc") updateSfc($("sfcview"), st);
    $("inputs").querySelectorAll(".inp").forEach((b) => b.classList.toggle("on", !!st.inputs[b.dataset.dev]));
    $("outputs").querySelectorAll("li[data-dev]").forEach((li) => li.classList.toggle("on", !!st.outputs[li.dataset.dev]));
    if (st.plant) drawPlant($("plant").getContext("2d"), st.plant);
    $("step-box").hidden = !st.steps.length; $("steps").textContent = st.steps.join(" ");
    $("broken").hidden = !st.broken; if (st.broken) $("broken").textContent = "⚠ " + st.broken;
    $("clock").textContent = (st.time / 1000).toFixed(1) + " s" + (ex.outputs.length ? "" : `　D0 = ${st.d0}`);
  }
  requestAnimationFrame(frame);
}

async function boot() {
  try {
    py = await bootPython();
    pr = py.runPython("from practice_bridge import Practice; Practice()");
    led = LEdit.editor($("ed-ladder"), { comment: devComment, stl: true, onConvert: () => { ldirty = true; syncFromLadder(); },
      onChange: () => { if (etab !== "ladder") return; ldirty = true; clearTimeout(ltimer); ltimer = setTimeout(syncFromLadder, 500); } });
    cat = JSON.parse(py.runPython("from practice_bridge import catalog; catalog()"));
    const route = () => {
      const id = location.hash.slice(1).split("?")[0];
      const known = id === "FREE" || cat.some((e) => e.id === id);
      open(known ? id : cat[0].id);
      if (id && !known) {                          /* an old or mistyped link: say so instead of silently showing E1 */
        document.title = `找不到 ${id} | LadderLab 練習`;
        $("task").insertAdjacentHTML("afterbegin", `<p class="callout warn">找不到「${esc2(id)}」這一題，先打開第一題。如果是剛更新的網站，請按重新整理。</p>`);
      }
      const shared = new URLSearchParams(location.search).get("il");
      if (shared && id === "FREE" && !route.used) {
        route.used = true;
        const mine = $("code").value;                /* tester round 5: a shared link used to wipe the learner's own program */
        const keep = mine.trim() && mine.trim() !== shared.trim() && mine.trim() !== ex.starter.trim();
        if (keep) storeSet("ll_code_FREE_backup", mine);
        setCode(shared);
        if (keep) {
          $("task").insertAdjacentHTML("afterbegin", `<p class="callout" id="sharednote">這是別人分享的程式。你原本在自由練習寫的程式已經先備份起來。<button type="button" class="small-btn" id="restoremine">還原我原本的程式</button></p>`);
          $("restoremine").onclick = () => { setCode(storeGet("ll_code_FREE_backup", "")); $("sharednote").remove(); };
        }
      }
    };
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
