"use strict";
/* Boolean lab: the six mechanical actions drawn live, logic gates with a truth table and bit masks, Select and
   In Range and Coerce on a number line. */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- tabs ---------- */
  $("tabs").querySelectorAll("button").forEach((b) => b.onclick = () => {
    $("tabs").querySelectorAll("button").forEach((x) => x.classList.toggle("here", x === b));
    ["mech", "gate", "cmp"].forEach((t) => { $("t-" + t).hidden = t !== b.dataset.t; });
    try { history.replaceState(null, "", "#" + b.dataset.t); } catch (e) { /* file:// */ }
  });
  const h = location.hash.slice(1);
  if (["gate", "cmp"].includes(h)) $("tabs").querySelector(`[data-t="${h}"]`).click();

  /* ---------- mechanical actions ---------- */
  const M = [
    { k: "swp", name: "Switch When Pressed", zh: "按下就切換", latch: false, when: "press",
      ex: "按下的瞬間切換，放開不變；要再按一次才切回來。像電燈開關。",
      tip: "用在「模式切換」這類要一直保持的開關。" },
    { k: "swr", name: "Switch When Released", zh: "放開才切換", latch: false, when: "release",
      ex: "按下去沒反應，放開的瞬間才切換。按下後滑開游標再放，可以反悔。",
      tip: "比較少用；想讓使用者「按錯可以滑開取消」時用。" },
    { k: "sur", name: "Switch Until Released", zh: "按住期間有效", latch: false, when: "hold",
      ex: "按住時是 True，放開就回 False。像門鈴、點動按鈕。",
      tip: "手動點動（按住才動、放開就停）用這個，雙龍門的 JOG 就是。程式讀得慢的話，很短的一按可能讀不到。" },
    { k: "lwp", name: "Latch When Pressed", zh: "按下就送一次", latch: true, when: "press",
      ex: "按下的瞬間變 True，等程式讀到一次就自己彈回 False。不管按多短，程式一定讀得到一次。",
      tip: "「啟動」「確定」這種一次性命令用 Latch。注意：Latch 按鈕不能建 Local Variable，端子要放在迴圈裡被讀。" },
    { k: "lwr", name: "Latch When Released", zh: "放開才送一次", latch: true, when: "release",
      ex: "放開的瞬間變 True，程式讀到一次就彈回。LabVIEW 預設的 OK、Stop 按鈕就是這種。",
      tip: "最常見的「Stop」按鈕：放開後讓 While Loop 停下來，然後自己彈回，下次執行不用手動復原。" },
    { k: "lur", name: "Latch Until Released", zh: "按住有效，至少讀一次", latch: true, when: "hold",
      ex: "按住期間是 True；放開後還要等程式讀到一次才彈回。按得再短，程式也至少讀到一次。",
      tip: "要「按住有效」又怕程式讀太慢漏掉時用。" },
  ];
  let mk = "lwr", value = false, down = false, readVal = false, pendingLatch = false, readSincePress = true;
  const hist = [];                 // {t, down, value, read: null|bool}
  let t0 = performance.now(), lastRead = 0;
  function cur() { return M.find((m) => m.k === mk); }
  function drawList() {
    $("mlist").innerHTML = M.map((m) => `<button type="button" data-k="${m.k}" class="${m.k === mk ? "here" : ""}">${esc(m.name)}<small>${esc(m.zh)}${m.latch ? "（Latch：讀一次就彈回）" : ""}</small></button>`).join("");
    $("mlist").querySelectorAll("button").forEach((b) => b.onclick = () => { mk = b.dataset.k; value = false; pendingLatch = false; drawList(); explain(); });
  }
  function explain() { const m = cur(); $("mexplain").textContent = m.ex; $("mtip").textContent = m.tip; }
  function press(on) {
    const m = cur();
    if (on === down) return;
    down = on;
    $("bigbtn").classList.toggle("down", on);
    if (m.when === "press" && on) { value = m.latch ? true : !value; if (m.latch) pendingLatch = true; }
    if (m.when === "release" && !on) { value = m.latch ? true : !value; if (m.latch) pendingLatch = true; }
    if (m.when === "hold") {
      if (on) { value = true; readSincePress = false; }
      else if (!m.latch || readSincePress) value = false;   // Latch Until Released waits for one read
    }
  }
  const bb = $("bigbtn");
  bb.addEventListener("pointerdown", (e) => { e.preventDefault(); try { bb.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } press(true); });
  bb.addEventListener("pointerup", () => press(false));
  bb.addEventListener("pointercancel", () => press(false));
  function programRead(now) {
    const m = cur();
    readVal = value;
    if (m.latch && m.when !== "hold" && pendingLatch && value) { value = false; pendingLatch = false; }
    if (m.k === "lur") { readSincePress = true; if (!down) value = false; }
    hist.push({ t: now, read: readVal });
  }
  function step() {
    const now = performance.now() - t0;
    const period = $("slowread").checked ? 1000 : 150;
    if (now - lastRead >= period) { lastRead = now; programRead(now); }
    hist.push({ t: now, down, value });
    while (hist.length && hist[0].t < now - 8000) hist.shift();
    $("led").classList.toggle("on", value);
    $("led2").classList.toggle("on", readVal);
    draw(now);
    requestAnimationFrame(step);
  }
  function draw(now) {
    const c = $("tl"), g = c.getContext("2d"), W = c.width, H = c.height;
    const css = getComputedStyle(document.body), fg = css.color || "#222";
    g.clearRect(0, 0, W, H);
    const x = (t) => 120 + (t - (now - 8000)) / 8000 * (W - 130);
    const rows = [["滑鼠按住", 30, "down", "#555"], ["按鈕的值", 90, "value", "#1f9d3a"]];
    g.font = "13px sans-serif"; g.fillStyle = fg;
    rows.forEach(([lab, y]) => g.fillText(lab, 8, y + 4));
    g.fillText("程式讀取", 8, 154);
    rows.forEach(([, y, key, col]) => {
      g.strokeStyle = col; g.lineWidth = 3; g.beginPath();
      let first = true;
      hist.filter((p) => key in p).forEach((p) => {
        const yy = p[key] ? y - 16 : y + 10;
        if (first) { g.moveTo(x(p.t), yy); first = false; } else g.lineTo(x(p.t), yy);
      });
      g.stroke();
    });
    hist.filter((p) => "read" in p).forEach((p) => {
      g.fillStyle = p.read ? "#1e6fff" : "rgba(128,128,128,.45)";
      g.beginPath(); g.arc(x(p.t), 150, p.read ? 6 : 3, 0, 7); g.fill();
    });
    g.fillStyle = "rgba(128,128,128,.6)"; g.font = "11px sans-serif";
    g.fillText("← 8 秒前", 120, H - 6); g.fillText("現在 →", W - 52, H - 6);
  }
  drawList(); explain(); requestAnimationFrame(step);

  /* ---------- logic gates ---------- */
  const G = [
    ["And", "兩個都 T 才 T", (a, b) => a && b], ["Or", "有一個 T 就 T", (a, b) => a || b],
    ["Exclusive Or", "不一樣才 T", (a, b) => a !== b], ["Not", "反相（只看 x）", (a) => !a],
    ["Not And", "And 再反相", (a, b) => !(a && b)], ["Not Or", "Or 再反相", (a, b) => !(a || b)],
    ["Not Exclusive Or", "一樣才 T", (a, b) => a === b], ["Implies", "x 是 T 時 y 也要 T", (a, b) => !a || b],
  ];
  let gk = 0, gx = false, gy = false;
  function drawGates() {
    $("gates").innerHTML = G.map((g, i) => `<div class="gate ${i === gk ? "here" : ""}" data-i="${i}"><b>${g[0]}</b><small>${g[1]}</small></div>`).join("");
    $("gates").querySelectorAll(".gate").forEach((d) => d.onclick = () => { gk = +d.dataset.i; drawGates(); gate(); });
  }
  function gate() {
    const f = G[gk][2], one = gk === 3;
    $("swa").textContent = "x = " + (gx ? "T" : "F"); $("swa").classList.toggle("on", gx);
    $("swb").textContent = "y = " + (gy ? "T" : "F"); $("swb").classList.toggle("on", gy); $("swb").style.visibility = one ? "hidden" : "visible";
    $("gout").classList.toggle("on", !!f(gx, gy));
    const rows = one ? [[false], [true]] : [[false, false], [false, true], [true, false], [true, true]];
    $("tt").innerHTML = `<tr><th>x</th>${one ? "" : "<th>y</th>"}<th>${esc(G[gk][0])}</th></tr>` + rows.map((r) => {
      const isCur = r[0] === gx && (one || r[1] === gy);
      return `<tr class="${isCur ? "cur" : ""}">${r.map((v) => `<td>${v ? "T" : "F"}</td>`).join("")}<td>${f(r[0], r[1]) ? "T" : "F"}</td></tr>`;
    }).join("");
  }
  $("swa").onclick = () => { gx = !gx; gate(); };
  $("swb").onclick = () => { gy = !gy; gate(); };
  drawGates(); gate();

  /* bit masks: computed one bit at a time so the student sees the column rule */
  async function bitrun() {
    const x = (parseInt($("mx").value, 10) || 0) & 255, y = (parseInt($("my").value, 10) || 0) & 255, op = $("mop").value;
    const f = { And: (a, b) => a & b, Or: (a, b) => a | b, Xor: (a, b) => a ^ b }[op];
    const bits = (n) => Array.from({ length: 8 }, (_, i) => (n >> (7 - i)) & 1);
    const row = (lab, arr, id) => `<div class="mrow"><span style="width:90px">${lab}</span><span class="bits" id="${id}">${arr.map((b) => `<span class="${b ? "one" : ""}">${b}</span>`).join("")}</span></div>`;
    $("mbits").innerHTML = row(`x = ${x}`, bits(x), "bx") + row(`y = ${y}`, bits(y), "by") + row(`${op}`, Array(8).fill("?"), "br") + `<p id="bres"></p>`;
    const r = bits(f(x, y));
    for (let i = 7; i >= 0; i--) {
      ["bx", "by"].forEach((id) => $(id).children[i].classList.add("flash"));
      await new Promise((ok) => setTimeout(ok, 260));
      const cell = $("br").children[i]; cell.textContent = r[i]; cell.className = r[i] ? "one" : "";
      ["bx", "by"].forEach((id) => { const c = $(id).children[i]; c.classList.remove("flash"); });
    }
    const v = f(x, y);
    $("bres").innerHTML = `結果 = <b>${v}</b>` + (op === "And" && y === 1 ? `　→ 最低位元是 ${v}，所以 ${x} 是<b>${v ? "奇數" : "偶數"}</b>。` : "");
  }
  $("mrun").onclick = bitrun;

  /* ---------- Select and In Range and Coerce ---------- */
  function sel() {
    const a = Number($("samt").value) || 0, s = a > 5000;
    $("scond").textContent = s ? "True → 選 t" : "False → 選 f";
    $("sout").textContent = s ? +(a * 0.8).toFixed(2) : a;
  }
  $("samt").addEventListener("input", sel); sel();
  const MIN = -20, MAX = 120, px = (v) => ((v - MIN) / (MAX - MIN) * 100) + "%";
  function range() {
    const lo = Number($("lo").value) || 0, hi = Number($("hi").value) || 0, x = Number($("cx").value), incl = $("incl").checked;
    const L = Math.min(lo, hi), U = Math.max(lo, hi);
    const inr = x >= L && (incl ? x <= U : x < U);
    const co = Math.min(Math.max(x, L), U);
    $("cxv").textContent = x;
    let ticks = "";
    for (let v = MIN; v <= MAX; v += 20) ticks += `<span class="tick" style="left:${px(v)}">${v}</span>`;
    $("nline").innerHTML = `<div class="axis"></div><div class="band" style="left:${px(L)};width:calc(${px(U)} - ${px(L)})"></div>` +
      `<div class="lim" style="left:${px(L)}"></div><div class="lim" style="left:${px(U)}"></div>${ticks}` +
      `<div class="pt ghost" style="left:${px(x)}" title="x"></div><div class="pt" id="cpt" style="left:${px(x)}"></div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => { const p = $("cpt"); if (p) p.style.left = px(co); }));
    $("inr").classList.toggle("on", inr);
    $("cout").textContent = co;
  }
  ["lo", "hi", "cx", "incl"].forEach((id) => $(id).addEventListener("input", range));
  range();
  window.BoolLab = { press, M, state: () => ({ value, readVal, mk }), select: (k) => { mk = k; value = false; pendingLatch = false; drawList(); explain(); } };
})();
