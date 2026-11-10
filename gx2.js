"use strict";
/* GX Works2 guide page: the three-ways comparison (same flasher as ladder with M, STL ladder and SFC chart),
and the self-check list. The comparison runs on the practice bridge with exercise E12. */
const CMP = {
  m: { il: "LD M8002\nOR T1\nOR M0\nANI T0\nOUT M0\nLD T0\nOR M1\nANI T1\nOUT M1\nLD M0\nOUT T0 K10\nLD M1\nOUT T1 K10\nLD M0\nOUT Y000\nLD M1\nOUT Y001",
       note: "一般階梯圖：M0、M1 各代表一步，自己用自保持記住，下一步回頭切斷上一步（ANI T0、ANI T1）。步驟一多，條件就纏在一起。" },
  stl: { il: "LD M8002\nSET S0\nSTL S0\nLD M8000\nSET S20\nSTL S20\nOUT Y000\nOUT T0 K10\nLD T0\nSET S21\nSTL S21\nOUT Y001\nOUT T1 K10\nLD T1\nOUT S20\nRET",
         note: "STL 步進階梯圖：每一段 STL 是一步，SET S21 換到下一步，上一步自動關。最後的 OUT S20 是跳回 S20。" },
  sfc: { il: null, note: "SFC 圖：和 STL 那頁是同一份程式。上面的虛線框是 GX Works2 的梯形圖區塊（000），方框是步，┼ 是轉移條件，↳ 是 JUMP。" },
};
CMP.sfc.il = CMP.stl.il;
let cpy = null, cpr = null, cmpMode = "m", cmpLayout = null, last = 0;
const $ = (id) => document.getElementById(id);

function cmpShow(mode) {
  cmpMode = mode;
  document.querySelectorAll("#compare .compare-tabs button").forEach((b) => b.classList.toggle("here", b.dataset.c === mode));
  $("cmp-note").textContent = CMP[mode].note;
  if (!cpr) return;
  const out = JSON.parse(cpr.compile(CMP[mode].il));
  cmpLayout = out.rungs;
  ladderComment = (d) => ({ Y000: "燈 1", Y001: "燈 2", T0: "1 秒", T1: "1 秒", M0: "第 1 步", M1: "第 2 步", M8002: "開機第一掃描" }[d] || "");
  $("cmp-ladder").hidden = mode === "sfc";
  $("cmp-sfc").hidden = mode !== "sfc";
  $("cmp-il").hidden = false;
  $("cmp-il").textContent = CMP[mode].il;
  if (mode === "sfc") renderSfc($("cmp-sfc"), JSON.parse(cpr.sfc()), (s) => ({ S0: "待機", S20: "Y0 亮", S21: "Y1 亮" }[s] || ""));
  else renderRungs($("cmp-ladder"), cmpLayout.map((r, i) => [r, i]), {});
}
document.querySelectorAll("#compare .compare-tabs button").forEach((b) => b.addEventListener("click", () => cmpShow(b.dataset.c)));
$("cmp-start").onclick = async () => {
  $("cmp-start").hidden = true; $("cmp-load").hidden = false;
  try {
    cpy = await bootPython();
    cpr = cpy.runPython("from practice_bridge import Practice; Practice()");
    cpr.load("E12");
    $("cmp-load").hidden = true;
    cmpShow(cmpMode);
    requestAnimationFrame(frame);
  } catch (e) { console.error(e); $("cmp-load").textContent = "模擬引擎載入失敗，請重新整理。"; }
};
function frame(t) {
  const dt = Math.min(100, last ? t - last : 16); last = t;
  cpr.tick(Math.round(dt / 10) * 10);
  const st = JSON.parse(cpr.state());
  if (st) {
    $("lamp0").classList.toggle("on", !!st.outputs.Y000);
    $("lamp1").classList.toggle("on", !!st.outputs.Y001);
    $("cmp-step").textContent = st.steps.length ? "作用中的步：" + st.steps.join(" ") : "";
    if (cmpMode === "sfc") updateSfc($("cmp-sfc"), st);
    else if (cmpLayout) updateRungs($("cmp-ladder"), st, cmpLayout, -1);
  }
  requestAnimationFrame(frame);
}
$("cmp-note").textContent = CMP.m.note;

/* ---------- self check ---------- */
function countChecks() {
  const boxes = [...document.querySelectorAll("#checklist input")];
  const done = boxes.filter((b) => b.checked).length;
  $("checkcount").textContent = `已完成 ${done} / ${boxes.length}` + (done === boxes.length ? "，你已經會在 GX Works2 寫 FX3S 的步進程式了！" : "");
}
const saved = storeGet("ll_gx2_check", {});
document.querySelectorAll("#checklist input").forEach((b) => {
  b.checked = !!saved[b.dataset.k];
  b.addEventListener("change", () => { saved[b.dataset.k] = b.checked; storeSet("ll_gx2_check", saved); countChecks();
renderWaitlist(document.getElementById("wl"), "gx2", "學會 GX Works2 了？接下來想練更多機台嗎？"); });
});
countChecks();
$("tocbtn").onclick = () => document.body.classList.toggle("toc-open");
document.querySelectorAll("#toc a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("toc-open")));
