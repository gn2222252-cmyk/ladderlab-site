"use strict";
/* The course line on every page: where am I, what is next. Data: course_map.js (generated from engine/course_map.py).
Progress lives in this browser only, under the keys each page already used. */
(function () {
  const C = window.COURSE;
  if (!C) return;
  const KEYS = { L: "ll_done", E: "ll_pass", F: "ll_faults", A: "ll_aoi" };
  const get = (k, f) => { try { const v = localStorage.getItem(k); return v === null ? f : JSON.parse(v); } catch (e) { return f; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sections = C.chapters.concat(C.tracks);
  const flat = [];
  sections.forEach((sec) => sec.items.forEach((it, n) => flat.push({ sec, it, n })));

  function doneSets() {
    const s = {};
    Object.keys(KEYS).forEach((k) => { s[k] = new Set(get(KEYS[k], [])); });
    s.G = new Set(Object.keys(get("ll_path_g", {})));
    return s;
  }
  function isDone(it, d) { return (d || doneSets())[it.k].has(it.id); }
  function markPage(href) { const g = get("ll_path_g", {}); g[href] = 1; put("ll_path_g", g); }
  function find(kind, id) { return flat.find((f) => f.it.k === kind && f.it.id === id) || null; }
  function findPage(href) {                     // "gx2.html#g6" exact, else the first item on that page
    return flat.find((f) => f.it.k === "G" && f.it.id === href) ||
      flat.find((f) => f.it.k === "G" && f.it.id.split("#")[0] === href.split("#")[0]) || null;
  }
  function line(f) {                             // the main chapters run as one line; a side track is its own line
    return f.sec.main ? flat.filter((x) => x.sec.main) : flat.filter((x) => x.sec === f.sec);
  }
  function step(f, d) { const l = line(f); const i = l.indexOf(f); return l[i + d] || null; }
  function secName(sec) { return sec.main ? `第 ${sec.id} 章　${sec.t}` : `支線：${sec.t}`; }
  function label(it) { return it.k === "L" ? `${it.no} ${it.label}` : it.label; }
  function firstOpen() {
    const d = doneSets();
    return flat.find((f) => f.sec.main && !isDone(f.it, d)) || null;
  }
  /* 繼續上次: the item opened last, or the first unfinished one after it on its line (tester round 10: a learner in
     chapter 5 was sent back to the chapter 1 quiz). Unfinished items before it are counted, not forced. */
  function hasLast() { return !!get("ll_last", null); }
  function resume() {
    const d = doneSets(), last = get("ll_last", null);
    const f = last && flat.find((x) => x.it.k === last.k && x.it.id === last.id && String(x.sec.id) === String(last.sec));
    if (!f) return { at: firstOpen(), skipped: 0, first: null };
    const l = line(f), i = l.indexOf(f);
    const at = isDone(f.it, d) ? (l.slice(i + 1).find((x) => !isDone(x.it, d)) || null) : f;
    const before = (f.sec.main ? l.slice(0, i) : []).filter((x) => !isDone(x.it, d));
    return { at: at || firstOpen(), skipped: before.length, first: before[0] || null };
  }

  /* The bar under the header: course map › chapter, position, previous / next. */
  function bar(el, f) {
    if (!el || !f) return;
    if (f.it.k === "G" && !f.it.id.startsWith("review.html")) markPage(f.it.id);   // a review counts only when passed
    put("ll_last", { k: f.it.k, id: f.it.id, sec: f.sec.id });
    const d = doneSets();
    const n = f.sec.items.filter((it) => isDone(it, d)).length;
    const prev = step(f, -1), next = step(f, 1);
    el.className = "cbar";
    el.innerHTML = `<div class="cbar-where"><a href="path.html">課程地圖</a> › <b>${esc(secName(f.sec))}</b>` +
      `<span class="cbar-pos">第 ${f.n + 1}／${f.sec.items.length} 項 · 完成 ${n}</span>` +
      `<span class="cbar-meter"><i style="width:${Math.round(100 * n / f.sec.items.length)}%"></i></span></div>` +
      `<div class="cbar-nav">${prev ? `<a class="btnlink" href="${prev.it.href}">‹ ${esc(label(prev.it))}</a>` : ""}` +
      `${next ? `<a class="btnlink go" href="${next.it.href}">下一步：${esc(label(next.it))} ›</a>` : `<a class="btnlink go" href="path.html">回課程地圖 ›</a>`}</div>`;
    el.hidden = false;
  }

  /* Pages with <div id="cbar" data-auto>: work out the item from the file name and #hash. */
  function auto() {
    const el = document.getElementById("cbar");
    if (!el || !("auto" in el.dataset)) return;
    const file = location.pathname.split("/").pop() || "index.html", hash = decodeURIComponent(location.hash.slice(1));
    const kind = { "practice.html": "E", "faults.html": "F", "aoi.html": "A" }[file];
    let f = kind && hash ? find(kind, hash) : null;
    if (!f && !(file === "practice.html")) f = findPage(hash ? `${file}#${hash}` : file);
    if (f) bar(el, f); else el.hidden = true;
  }
  window.addEventListener("hashchange", auto);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto); else auto();

  window.Course = { data: C, flat, find, findPage, step, bar, isDone, doneSets, markPage, secName, label, firstOpen, resume, hasLast, esc };
})();
