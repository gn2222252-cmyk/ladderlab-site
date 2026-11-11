"use strict";
/* Loop lab: build a While or For loop from a few choices and watch it run iteration by iteration; shift registers
   (initialized, uninitialized, stacked); Wait (ms) versus Wait Until Next ms Multiple on a timeline. */
(function () {
  /* 依容器實際寬高重設 canvas 解析度（乘 devicePixelRatio），座標用 CSS 像素，手機上不會被壓扁 */
  function fitCanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    if (!cv.clientWidth) { const g0 = cv.getContext("2d"), lw = +cv.dataset.lw || cv.width, lh = +cv.dataset.lh || cv.height; g0.setTransform(cv.width / lw, 0, 0, cv.height / lh, 0, 0); return { g: g0, W: lw, H: lh }; }   // 分頁藏起來時不重設，免得越算越大
    const w = Math.max(1, Math.round(cv.clientWidth)), h = Math.max(1, Math.round(cv.clientHeight || cv.height));
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    cv.dataset.lw = w; cv.dataset.lh = h;
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, W: w, H: h };
  }
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const show = (v) => Array.isArray(v) ? (Array.isArray(v[0]) ? "[" + v.map((r) => "[" + r.join(", ") + "]").join(", ") + "]" : "[" + v.join(", ") + "]") : String(v);
  $("tabs").querySelectorAll("button").forEach((b) => b.onclick = () => {
    $("tabs").querySelectorAll("button").forEach((x) => x.classList.toggle("here", x === b));
    ["run", "sr", "wait"].forEach((t) => { $("t-" + t).hidden = t !== b.dataset.t; });
    try { history.replaceState(null, "", "#" + b.dataset.t); } catch (e) { /* file:// */ }
    if (b.dataset.t === "wait") wrun();
  });

  /* ---------- the simulator ---------- */
  function cfg() {
    const arrText = $("arr").value.trim();
    return {
      kind: $("kind").value, n: $("n").value.trim() === "" ? null : Math.max(0, Math.floor(Number($("n").value) || 0)),
      arr: arrText ? arrText.split(/[,\s]+/).filter(Boolean).map(Number) : null, idx: $("idx").value === "1",
      stop: $("stop").value, op: $("op").value, out: $("out").value,
    };
  }
  function simulate(c) {
    const notes = [], iters = [];
    let count;
    if (c.kind === "for") {
      const byArr = c.arr && c.idx ? c.arr.length : null;
      if (c.n === null && byArr === null) return { error: "For Loop 的 N 沒接，也沒有自動索引的陣列可以決定圈數：Run 箭頭是斷的，不能執行。" };
      count = c.n === null ? byArr : byArr === null ? c.n : Math.min(c.n, byArr);
      if (c.n !== null && byArr !== null && c.n !== byArr) notes.push(`N = ${c.n}、陣列有 ${byArr} 個，For Loop 取比較小的那個：跑 ${count} 圈。`);
      if (count === 0) notes.push("跑 0 圈：迴圈裡的程式一次都不執行，Last Value 通道輸出這個型別的預設值。");
    }
    let sr = 0, i = 0;
    const needX = c.op !== "ii";
    if (needX && !c.arr) notes.push("沒有接輸入陣列，這裡用 i 當作 x。");
    for (;;) {
      if (c.kind === "for" && i >= count) break;
      let x;
      if (!needX) x = null;
      else if (!c.arr) x = i;
      else if (c.idx) { x = i < c.arr.length ? c.arr[i] : 0; if (i === c.arr.length && c.kind === "while") notes.push(`While Loop 不會因為索引的陣列用完就停：第 ${i} 圈開始拿到的是預設值 0。`); }
      else x = c.arr.slice();
      const f = (v) => c.op === "x2" ? v * 2 : c.op === "xi" ? v + i : v;
      let y;
      if (c.op === "ii") y = i * i;
      else if (c.op === "sum") { sr = Array.isArray(x) ? (Array.isArray(sr) ? sr.map((s, k) => s + x[k]) : x.map((v) => sr + v)) : (Array.isArray(sr) ? sr : sr + x); y = sr; }
      else if (c.op === "pair") y = Array.isArray(x) ? x.concat(x.map((v) => v * 10)) : [x, x * 10];
      else y = Array.isArray(x) ? x.map(f) : f(x);
      let stopNow = false, cond = null;
      if (c.kind === "while") {
        cond = c.stop === "ge3" ? i >= 3 : c.stop === "lt3" ? i < 3 : c.stop === "ge0" ? true : false;
        stopNow = c.stop === "lt3" ? !cond : cond;
      }
      iters.push({ i, x, y, cond, keep: c.out !== "cond" || (!Array.isArray(y) && y > 10) });
      i++;
      if (c.kind === "while" && (stopNow || i >= 12)) {
        if (!stopNow) notes.push("停止條件永遠不會成立：這是無限迴圈。只能按工具列的中止鍵（等於拔電源，後面的程式不會執行）。這裡跑 12 圈就先停。");
        break;
      }
    }
    if (c.kind === "while") notes.unshift(`While Loop 在每圈「最後」才檢查停止條件，所以至少會跑 1 圈；i 從 0 開始數，跑了 ${iters.length} 圈時 i 最後是 ${iters.length - 1}。`);
    const ys = iters.map((t) => t.y);
    let result;
    if (c.out === "last") result = ys.length ? ys[ys.length - 1] : (c.op === "pair" || (c.arr && !c.idx && needX) ? [] : 0);
    else if (c.out === "index") result = ys;
    else if (c.out === "concat") {
      if (ys.length && !Array.isArray(ys[0])) { notes.push("Concatenating 只給「每圈輸出陣列」的通道用；每圈是一個數字時，LabVIEW 的通道選單沒有這個選項，這裡用 Indexing 的結果代替。"); result = ys; }
      else result = [].concat(...ys);
    } else {
      if (ys.length && Array.isArray(ys[0])) { notes.push("Conditional 通道這裡只示範數字；每圈是陣列時改成全部收下。"); result = ys; }
      else result = iters.filter((t) => t.keep).map((t) => t.y);
    }
    return { iters, count: iters.length, result, notes };
  }

  /* ---------- drawing the loop ---------- */
  function drawLoop(c) {
    const lb = $("lb");
    lb.className = "loopbox" + (c.kind === "for" ? " for" : "");
    const opText = { x2: "x × 2", xi: "x + i", ii: "i × i", sum: "SR + x", pair: "[x, x×10]" }[c.op];
    const outMark = { last: "", index: "idx", concat: "idx", cond: "idx" }[c.out];
    lb.innerHTML = `<span class="ttl">${c.kind === "for" ? "For Loop" : "While Loop"}</span>` +
      (c.kind === "for" ? `<span class="term-n">N</span><span class="lbl" style="left:40px;top:10px">${c.n === null ? "（沒接）" : c.n}</span>` : "") +
      (c.arr ? `<span class="tunnel in ${c.idx ? "idx" : ""}"></span><span class="lbl" style="left:16px;top:96px">${c.idx ? "自動索引" : "整個陣列"}</span>` : "") +
      `<div class="bodynode" id="body">${opText}</div>` +
      `<span class="tunnel out ${outMark}"></span><span class="lbl" style="right:16px;top:96px">${{ last: "Last Value", index: "Indexing", concat: "Concat", cond: "Conditional" }[c.out]}</span>` +
      `<span class="term-i" id="ti">i</span>` +
      (c.kind === "while" ? `<span class="term-c ${c.stop === "lt3" ? "cont" : ""}" id="tc">${c.stop === "lt3" ? "↻" : "●"}</span>` : "");
    $("nw").style.display = c.kind === "for" ? "" : "none";
    $("sw").style.display = c.kind === "while" ? "" : "none";
  }
  async function token(text, from, to, ms) {
    const lb = $("lb"), t = document.createElement("span");
    t.className = "tok"; t.textContent = text;
    Object.assign(t.style, { left: from[0] + "px", top: from[1] + "px" });
    lb.appendChild(t);
    await sleep(30);
    Object.assign(t.style, { left: to[0] + "px", top: to[1] + "px" });
    await sleep(ms);
    t.remove();
  }
  let running = false;
  async function go(fast) {
    if (running) return;
    running = true;
    const c = cfg(); drawLoop(c);
    $("log").innerHTML = ""; $("result").textContent = ""; $("verdict").textContent = ""; $("lesson").textContent = "";
    const r = simulate(c);
    if (r.error) { $("result").textContent = "不能執行"; $("lesson").textContent = r.error; running = false; return; }
    const W = $("lb").clientWidth, mid = W / 2 - 30;
    for (const it of r.iters) {
      $("ti").textContent = it.i;
      if (!fast) {
        if (it.x !== null && c.arr) await token(show(it.x), [-8, 66], [mid, 26], 450);
        $("body").textContent = show(it.y);
        await token(show(it.y), [mid, 26], [W - 70, 66], 450);
        if ($("tc")) { $("tc").textContent = it.cond ? "T" : "F"; await sleep(250); }
      }
      const line = document.createElement("div");
      line.className = "new";
      line.textContent = `i = ${it.i}　x = ${it.x === null ? "-" : show(it.x)}　→ ${show(it.y)}` + (c.out === "cond" && !Array.isArray(it.y) ? (it.keep ? "　收下" : "　不收") : "") +
        (it.cond !== null ? `　條件 ${it.cond ? "True" : "False"}` : "");
      $("log").appendChild(line); $("log").scrollTop = 1e6;
    }
    $("result").textContent = `跑了 ${r.count} 圈，輸出 ${show(r.result)}`;
    $("lesson").textContent = r.notes.join(" ");
    if ($("pred").checked) {
      const pn = Number($("pn").value), po = $("po").value.replace(/[\[\]\s]/g, "");
      const okN = pn === r.count, okO = po === show(r.result).replace(/[\[\]\s]/g, "");
      $("verdict").textContent = `${okN ? "✓" : "✗"} 圈數（你猜 ${$("pn").value || "?"}，實際 ${r.count}）　${okO ? "✓" : "✗"} 輸出（實際 ${show(r.result)}）`;
      $("verdict").className = "verdict-line " + (okN && okO ? "ok" : "bad");
    }
    running = false;
  }
  $("go").onclick = () => go(false);
  $("fast").onclick = () => go(true);
  $("pred").onchange = () => { $("predbox").hidden = !$("pred").checked; };
  ["kind", "n", "arr", "idx", "stop", "op", "out"].forEach((id) => $(id).addEventListener("change", () => { drawLoop(cfg()); $("log").innerHTML = ""; $("result").textContent = ""; $("lesson").textContent = ""; $("verdict").textContent = ""; }));
  drawLoop(cfg());

  /* ---------- shift registers ---------- */
  let mem = 0, runs = 0;
  function srDraw(l, r, note) {
    $("srbox").innerHTML = `<span class="sr l" style="top:50px">${l}</span><span class="sr r" style="top:50px">${r}</span>` +
      `<div class="bodynode" style="margin-top:44px">左邊 + i</div><span class="lbl" style="left:14px;top:8px">${note || ""}</span>`;
  }
  let srbusy = false;
  async function srrun() {
    if (srbusy) return; srbusy = true; $("srrun").disabled = $("srreset").disabled = true;
    try {
    const n = Math.max(0, Math.floor(Number($("srn").value) || 0)), init = $("srinit").checked;
    let v = init ? 0 : mem;
    runs++;
    $("srlog").innerHTML = `<div>第 ${runs} 次執行 VI，Shift Register 一開始是 ${v}${init ? "（接了初始值 0）" : runs > 1 ? "（沒接初始值：記得上次的結果）" : "（沒接初始值，第一次是預設值 0）"}</div>`;
    for (let i = 1; i <= n; i++) {
      srDraw(v, "", `第 ${i} 圈`);
      await sleep(350);
      const nv = v + i;
      srDraw(v, nv, `第 ${i} 圈：${v} + ${i} = ${nv}`);
      $("srlog").insertAdjacentHTML("beforeend", `<div class="new">第 ${i} 圈：左邊 ${v} + ${i} → 右邊 ${nv}，下一圈從左邊出來</div>`);
      await sleep(450);
      v = nv;
    }
    mem = v; $("srout").textContent = v;
    $("srlog").insertAdjacentHTML("beforeend", `<div><b>輸出 ${v}</b>${init ? "" : "　再按一次執行看看：沒接初始值，結果會越來越大。"}</div>`);
    } finally { srbusy = false; $("srrun").disabled = $("srreset").disabled = false; }
  }
  $("srrun").onclick = srrun;
  $("srreset").onclick = () => { mem = 0; runs = 0; srDraw(0, "", "VI 重新載入：沒初始化的 Shift Register 回到預設值 0"); $("srout").textContent = "-"; $("srlog").innerHTML = ""; };
  srDraw(0, "", "");
  let stkbusy = false;
  $("stk").onclick = async () => {
    if (stkbusy) return; stkbusy = true; $("stk").disabled = true;
    let p1 = 0, p2 = 0;
    $("stklog").innerHTML = "<div>i　這圈的值　左邊上格（前一圈）　左邊下格（前前一圈）　平均（三圈）</div>";
    for (let i = 0; i < 6; i++) {
      const v = i * 10;
      $("stklog").insertAdjacentHTML("beforeend", `<div class="new">${i}　${v}　　　${p1}　　　　${p2}　　　　${((v + p1 + p2) / 3).toFixed(1)}</div>`);
      p2 = p1; p1 = v;
      await sleep(500);
    }
    $("stklog").insertAdjacentHTML("beforeend", "<div>前兩圈的格子一開始是初始值 0，所以前兩個平均偏低；要接初始值，堆疊的每一格都要接。</div>");
    stkbusy = false; $("stk").disabled = false;
  };

  /* ---------- Wait (ms) versus Wait Until Next ms Multiple ---------- */
  function wrun() {
    const w = Math.max(10, Number($("wms").value) || 100), cmax = Math.max(10, Number($("wcode").value) || 80);
    const codes = Array.from({ length: 6 }, () => 20 + Math.random() * Math.max(0, cmax - 20));
    const a = [], b = [];
    let t = 0;
    codes.forEach((c) => { a.push([t, c, Math.max(w, c)]); t += Math.max(w, c); });
    t = 37;                                    // the loop starts at some moment between ticks
    codes.forEach((c) => { const end = Math.ceil((t + c) / w) * w; b.push([t, c, end - t]); t = end; });
    const cv = $("wt"), fit = fitCanvas(cv), g = fit.g, Wd = fit.W;
    g.clearRect(0, 0, Wd, fit.H);
    const span = Math.max(a[a.length - 1][0] + a[a.length - 1][2], b[b.length - 1][0] + b[b.length - 1][2]) + 20, x = (ms) => 150 + ms / span * (Wd - 170);
    const fg = getComputedStyle(document.body).color;
    g.font = "13px sans-serif"; g.fillStyle = fg;
    g.fillText("Wait (ms)", 8, 70); g.fillText("Wait Until Next", 8, 160); g.fillText("ms Multiple", 8, 176);
    const every = Math.max(1, Math.ceil(30 / Math.max(1, x(w) - x(0))));          // 窄螢幕時刻度數字隔幾格才寫一個，不要疊在一起
    for (let m = 0, k = 0; m <= span; m += w, k++) { g.strokeStyle = "rgba(128,128,128,.3)"; g.beginPath(); g.moveTo(x(m), 20); g.lineTo(x(m), 200); g.stroke(); if (k % every === 0) { g.fillStyle = "rgba(128,128,128,.8)"; g.fillText(m + "", x(m) - 8, 212); } }
    [[a, 50], [b, 140]].forEach(([rows, y]) => rows.forEach(([s, c, p], k) => {
      g.fillStyle = "rgba(128,128,128,.25)"; g.fillRect(x(s), y, x(s + p) - x(s), 30);
      g.fillStyle = "#1e5bd7"; g.fillRect(x(s), y, x(s + c) - x(s), 30);
      g.fillStyle = "#fff"; g.fillText(String(k), x(s) + 4, y + 20);
    }));
    const pa = a.map((r) => r[2]), pb = b.slice(1).map((r) => r[2]);
    $("wsum").textContent = `藍色是程式、灰色是等待。Wait (ms)：每圈 ${pa.map((v) => Math.round(v)).join("、")} ms（不會比 ${w} 短，程式比較慢時更長）。` +
      `Wait Until Next ms Multiple：第一圈只等到下一個整數倍，之後每圈 ${pb.map((v) => Math.round(v)).join("、")} ms，開始時間都對齊 ${w} 的倍數。`;
  }
  $("wrun").onclick = wrun;
  const h = location.hash.slice(1);
  if (["sr", "wait"].includes(h)) $("tabs").querySelector(`[data-t="${h}"]`).click();
  window.LoopLab = { simulate, cfg };
})();
