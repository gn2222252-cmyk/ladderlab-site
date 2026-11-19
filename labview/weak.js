/* 不熟專區：畫不熟點卡片、出題、題目與作答紀錄（截圖上的標記）。資料在 weak-data.js。
   這個瀏覽器自己的紀錄（我覺得熟了、答對答錯次數）存在 localStorage，讀不到也能正常顯示。 */
(function () {
  "use strict";
  const W = window.WEAK;
  const $ = (id) => document.getElementById(id);
  const KEY = "ll_weak_v1";
  let me = { self: {}, stats: {}, seen: {} };
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && typeof s === "object") me = Object.assign(me, s); } catch (e) { /* private window */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(me)); } catch (e) { /* ignore */ } };
  const wById = Object.fromEntries(W.weak.map((k) => [k.id, k]));
  const pById = Object.fromEntries(W.problems.map((p) => [p.id, p]));
  const status = (k) => me.self[k.id] === "熟了" ? "熟了" : k.status;
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  $("upd").textContent = "（最後更新 " + W.updated + "）";

  /* ---------- 不熟點卡片 ---------- */
  function drawWeak() {
    $("weak").innerHTML = W.weak.map((k) => {
      const st = status(k), s = me.stats[k.id] || { ok: 0, ng: 0 };
      const n = W.drills.filter((d) => d.weak === k.id).length;
      const from = k.from.map((p) => `<a href="#${p}">題 ${p.slice(1)} ${pById[p] ? pById[p].title : ""}</a>`).join("、");
      return `<div class="wk-card" id="card-${k.id}">
        <div><span class="chip st-${st}">${st}</span><span class="legend">${k.id}　發現於 ${from}</span></div>
        <h3>${k.name}</h3>
        <p><b>觀念：</b>${k.concept}</p>
        <p class="legend"><b>為什麼會錯：</b>${k.why}</p>
        <div class="wk-links">${k.links.map((l) => `<a href="${l.h}">${l.t}</a>`).join("")}</div>
        <div class="wk-row"><span>練習題 ${n} 題　你答對 ${s.ok}、還不行 ${s.ng}</span>
          <button type="button" data-drill="${k.id}">練這一點</button>
          <button type="button" data-self="${k.id}">${me.self[k.id] === "熟了" ? "取消「熟了」" : "我覺得熟了"}</button></div>
      </div>`;
    }).join("");
  }
  $("weak").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.self) {
      const id = b.dataset.self;
      if (me.self[id] === "熟了") delete me.self[id]; else me.self[id] = "熟了";
      save(); drawWeak(); drawPick();
    } else if (b.dataset.drill) {
      $("pick").value = b.dataset.drill; next();
      $("drill-h").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  /* ---------- 出題 ---------- */
  function drawPick() {
    const open = W.weak.filter((k) => status(k) !== "熟了");
    $("pick").innerHTML = `<option value="">全部還不熟的（${open.length} 點）</option>` +
      W.weak.map((k) => `<option value="${k.id}">${k.id} ${k.name.replace(/&gt;/g, ">")}（${status(k)}）</option>`).join("");
  }
  function pool() {
    const v = $("pick").value;
    const ks = v ? [v] : W.weak.filter((k) => status(k) !== "熟了").map((k) => k.id);
    return W.drills.filter((d) => ks.includes(d.weak));
  }
  function mark(d, ok) {
    const s = me.stats[d.weak] || (me.stats[d.weak] = { ok: 0, ng: 0 });
    if (ok) s.ok++; else s.ng++;
    me.seen[d.id] = (me.seen[d.id] || 0) + 1;
    save(); drawWeak();
  }
  function next() {
    const p = pool();
    if (!p.length) { $("drill").innerHTML = `<div class="drill"><p class="q">這個範圍沒有題目了：所有不熟點都標成「熟了」。可以在上面的卡片取消「熟了」，或選某一點再練。</p></div>`; $("pickinfo").textContent = ""; return; }
    const least = Math.min(...p.map((d) => me.seen[d.id] || 0));
    const fresh = p.filter((d) => (me.seen[d.id] || 0) === least);
    const d = fresh[Math.floor(Math.random() * fresh.length)];
    $("pickinfo").textContent = `範圍內 ${p.length} 題`;
    const k = wById[d.weak];
    const head = `<p class="legend">${d.id}・不熟點 ${k.id} ${k.name}・${d.kind === "mc" ? "選擇題" : "動手題（在 LabVIEW 裡做）"}</p><p class="q">${d.q}</p>`;
    if (d.kind === "mc") {
      const order = shuffle(d.o.map((t, i) => i));
      $("drill").innerHTML = `<div class="drill">${head}${order.map((i) => `<button type="button" class="opt" data-i="${i}">${d.o[i]}</button>`).join("")}<p class="res"></p></div>`;
      const box = $("drill").firstElementChild;
      let done = false;
      box.addEventListener("click", (e) => {
        const b = e.target.closest(".opt");
        if (!b || done) return;
        done = true;
        const ok = +b.dataset.i === d.a;
        box.querySelectorAll(".opt").forEach((x) => { if (+x.dataset.i === d.a) x.classList.add("ok"); });
        if (!ok) b.classList.add("ng");
        box.querySelector(".res").innerHTML = `<b style="color:${ok ? "#1e7b34" : "#b03a2e"}">${ok ? "答對了。" : "不對。"}</b>${d.ex}　<button type="button" class="wk-btn pri" data-next="1">下一題</button>`;
        mark(d, ok);
      });
      box.addEventListener("click", (e) => { if (e.target.dataset.next) next(); });
    } else {
      $("drill").innerHTML = `<div class="drill">${head}
        <div class="hs"></div><button type="button" class="wk-btn" data-h="1">給我一個提示（共 ${d.hints.length} 個）</button>
        <p class="legend" style="margin-top:10px">做完用這張清單檢查：</p><ul class="chk">${d.check.map((c) => `<li><label><input type="checkbox"> ${c}</label></li>`).join("")}</ul>
        <details class="ans"><summary>參考做法（自己做完再看）</summary><p class="q">${d.answer}</p></details>
        <div class="wk-row"><button type="button" class="wk-btn pri" data-r="ok">清單全部做到了</button><button type="button" class="wk-btn" data-r="ng">還不行</button><button type="button" class="wk-btn" data-next="1">換一題</button></div><p class="res"></p></div>`;
      const box = $("drill").firstElementChild;
      let shown = 0, rec = false;
      box.addEventListener("click", (e) => {
        const t = e.target;
        if (t.dataset.h) {
          if (shown < d.hints.length) box.querySelector(".hs").insertAdjacentHTML("beforeend", `<div class="hint"><b>提示 ${shown + 1}：</b>${d.hints[shown]}</div>`);
          shown++;
          if (shown >= d.hints.length) t.disabled = true;
        } else if (t.dataset.r && !rec) {
          rec = true; mark(d, t.dataset.r === "ok");
          box.querySelector(".res").textContent = t.dataset.r === "ok" ? "記下來了：答對 +1。" : "記下來了：之後會再出這一點的題。也可以把截圖傳給 Claude 一起看。";
        } else if (t.dataset.next) next();
      });
    }
  }
  $("go").onclick = next;

  /* ---------- 題目與作答紀錄 ---------- */
  function drawProbs() {
    $("probs").innerHTML = W.problems.map((p) => {
      const tries = p.tries.length ? p.tries.map((t, ti) => `
        <p><b>作答 ${ti + 1}（${t.date}）</b>：${t.summary}</p>
        <div class="wkshot" data-p="${p.id}-${ti}"><img src="${t.img}" width="${t.w}" height="${t.h}" alt="題 ${p.id.slice(1)} 作答 ${ti + 1} 的方塊圖截圖" loading="lazy">
          ${t.marks.map((m) => `<button type="button" class="mk ${m.kind}" style="left:${m.x}%;top:${m.y}%" data-m="${p.id}-${ti}-${m.n}" aria-label="標記 ${m.n}">${m.n}</button>`).join("")}</div>
        <p class="legend"><a href="${t.img}" target="_blank" rel="noopener">看原尺寸截圖</a></p>
        <ul class="ml">${t.marks.map((m) => `<li id="m-${p.id}-${ti}-${m.n}"><span class="n ${m.kind}">${m.n}</span><span>${m.text}${m.weak ? ` <a class="tag" href="#card-${m.weak}">→ 不熟點 ${m.weak}</a>` : ""}</span></li>`).join("")}</ul>`).join("")
        : `<p class="legend">還沒有作答紀錄。做完把截圖傳給 Claude，這裡會加上標記。</p>`;
      return `<section class="prob" id="${p.id}">
        <h3>題 ${p.id.slice(1)}　${p.title}</h3><p class="legend">練習：${p.practice}</p>
        <p><b>目標：</b>${p.goal}</p><ol>${p.req.map((r) => `<li>${r}</li>`).join("")}</ol>
        ${tries}
        <div class="hs"></div><button type="button" class="wk-btn" data-ph="${p.id}">重做提示（共 ${p.hints.length} 個）</button>
        <details class="ans"><summary>參考做法（重做完再看）</summary>${p.answer}</details>
      </section>`;
    }).join("");
  }
  $("probs").addEventListener("click", (e) => {
    const m = e.target.closest(".mk");
    if (m) {
      const li = $("m-" + m.dataset.m);
      if (li) { li.classList.remove("flash"); void li.offsetWidth; li.classList.add("flash"); li.scrollIntoView({ behavior: "smooth", block: "nearest" }); setTimeout(() => li.classList.remove("flash"), 1600); }
      return;
    }
    const b = e.target.closest("[data-ph]");
    if (b) {
      const p = pById[b.dataset.ph], sec = b.closest(".prob"), hs = sec.querySelector(".hs");
      const n = hs.children.length;
      if (n < p.hints.length) hs.insertAdjacentHTML("beforeend", `<div class="hint"><b>提示 ${n + 1}：</b>${p.hints[n]}</div>`);
      if (n + 1 >= p.hints.length) b.disabled = true;
    }
  });

  drawWeak(); drawPick(); drawProbs();
})();
