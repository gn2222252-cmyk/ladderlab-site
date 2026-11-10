"use strict";
/* Compact waitlist form for any page. Posts to window.WAITLIST_URL (config.js), same fields as the home page form.
Usage: renderWaitlist(element, "page-name", "heading text") */
function renderWaitlist(el, page, heading) {
  if (!el) return;
  if (window.NO_WAITLIST) { el.hidden = true; return; }
  try { if (localStorage.getItem("ll_waitlisted")) { el.innerHTML = '<p class="wl-done">你已經在 Pro 候補名單上，開放時會先通知你。</p>'; return; } } catch (e) { /* ignore */ }
  el.innerHTML = `<form class="wl">
    <b>${heading || "想要更多機台、題目和 AI 助教？"}</b>
    <span class="wl-sub">Pro 開發中，留 Email 開放時先通知你（不會寄廣告轟炸，每封都能退訂）。</span>
    <div class="wl-row">
      <input type="email" name="email" required maxlength="120" placeholder="你的 Email" aria-label="Email">
      <select name="pain" aria-label="最卡的地方"><option value="">最卡的是…</option><option value="gx">GX Works2 操作</option>
        <option value="logic">流程程式寫不出來</option><option value="debug">機台故障找不到原因</option><option value="other">其他</option></select>
      <button class="go">加入候補</button>
    </div>
    <label class="check small"><input type="checkbox" name="consent" required> 同意蒐集 Email 與上面的答案，用於開放通知與產品研究（隨時可要求刪除）。</label>
    <p class="wl-msg" role="status"></p></form>`;
  const f = el.querySelector("form");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = { email: f.email.value, pain: f.pain.value, consent: f.consent.checked, page, lang: "zh", consent_version: "2026-11-09" };
    const msg = f.querySelector(".wl-msg");
    try {
      const r = await fetch(window.WAITLIST_URL || "/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(r.status);
      msg.textContent = "已加入！開放時會寄信通知你。";
      try { localStorage.setItem("ll_waitlisted", "1"); } catch (err) { /* ignore */ }
      f.querySelectorAll("input,select,button").forEach((x) => { x.disabled = true; });
    } catch (err) { msg.textContent = "送出失敗，請確認 Email 並勾選同意。"; }
  });
}
