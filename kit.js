"use strict";
/* Self-wired machine for the simulator's free circuit mode: the learner decides what is wired to each terminal
   (Y1 red lamp, Y3 buzzer, Y4 conveyor, X3 the conveyor's photo sensor...). The soft PLC drives the outputs,
   the devices move, and their sensors are fed back into the X inputs, like a real FX3S wired to a machine.
   Nothing is wired by default: every X is a plain switch and every Y a plain lamp until the learner wires it. */
const Kit = (() => {
  const OUT = {
    red: ["紅燈", "紅燈"], green: ["綠燈", "綠燈"], yellow: ["黃燈", "黃燈"], buzzer: ["蜂鳴器", "蜂鳴"],
    motor: ["馬達（風扇）", "馬達"], cyl: ["氣缸（單動，彈簧復歸）", "氣缸"], conv: ["輸送帶馬達", "輸送"],
  };
  const IN = {
    switch: ["切換開關（點一下 ON／OFF）", "開關"], nopb: ["按鈕（常開，按住才 ON）", "按鈕"],
    ncpb: ["急停按鈕（常閉，平常 ON，按下 OFF）", "急停"],
  };
  const SENS = { cylF: ["伸出到底感測器", "前限"], cylB: ["縮回到底感測器", "後限"], conv: ["光電感測器（輸送帶末端）", "光電"] };
  const SENS_OF = { cyl: ["cylF", "cylB"], conv: ["conv"] };
  const SENSOR_AT = 0.8, BOX = 0.085, BELT = 260;
  const short = (d) => d[0] + d.slice(1).replace(/^0+(?=\d)/, "");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let W = {}, pressed = {}, sim = {}, el = null, opt = null, xs = [], ys = [], sens = {}, outs = {}, mute = false, audio = null;

  function load() { try { W = JSON.parse(localStorage.getItem("ll_kit") || "{}") || {}; } catch (e) { W = {}; } }
  function save() { try { localStorage.setItem("ll_kit", JSON.stringify(W)); } catch (e) { /* private mode */ } }
  const kindOf = (dev) => W[dev] || (dev[0] === "X" ? "switch" : "");
  function link(kind) {                       // "conv:Y004" -> ["conv", "Y004"] when that Y is really wired that way
    const [s, y] = String(kind).split(":");
    return SENS[s] && y && (SENS_OF[W[y]] || []).includes(s) ? [s, y] : null;
  }
  function label(dev) {
    if (!/^[XY]\d+$/.test(dev)) return "";
    const k = kindOf(dev);
    if (dev[0] === "Y") return k ? OUT[k][0] : "";
    if (IN[k]) return W[dev] ? IN[k][0] : "";
    const l = link(k);
    return l ? `${short(l[1])} ${OUT[W[l[1]]][1]}的${SENS[l[0]][0]}` : "（感測器沒有對應的機構）";
  }
  function tag(dev) {
    if (!/^[XY]\d+$/.test(dev)) return "";
    const k = kindOf(dev);
    if (dev[0] === "Y") return k ? OUT[k][1] : "";
    if (IN[k]) return W[dev] ? IN[k][1] : "";
    const l = link(k);
    return l ? SENS[l[0]][1] : "未接";
  }
  /* how the simulator page should treat an X button: switch (toggle), hold (button), sensor (driven by the machine) */
  function inputKind(dev) { const k = kindOf(dev); return k === "switch" ? "switch" : (k === "nopb" || k === "ncpb") ? "hold" : "sensor"; }
  function press(dev, on) { pressed[dev] = !!on; }

  function stateOf(y) { return sim[y] || (sim[y] = { pos: 0, boxes: [], done: 0, ang: 0 }); }
  /* advance the machine by dt ms with the PLC outputs; returns the X values the machine drives */
  function step(dt, outputs) {
    outs = outputs || {};
    Object.keys(W).forEach((y) => {
      if (y[0] !== "Y") return;
      const k = W[y], on = !!outs[y], s = stateOf(y);
      if (k === "cyl") s.pos = Math.max(0, Math.min(1, s.pos + (on ? 1 : -1) * dt / 600));
      if (k === "conv" && on) {
        s.boxes = s.boxes.map((p) => p + dt / 5500);
        const n = s.boxes.length; s.boxes = s.boxes.filter((p) => p < 1); s.done += n - s.boxes.length;
      }
      if (k === "motor" && on) s.ang = (s.ang + dt * 0.72) % 360;
    });
    const want = {};
    sens = {};
    Object.keys(W).forEach((x) => {
      if (x[0] !== "X") return;
      const k = W[x];
      if (k === "nopb") want[x] = pressed[x] ? 1 : 0;
      else if (k === "ncpb") want[x] = pressed[x] ? 0 : 1;
      else if (k !== "switch") {
        const l = link(k);
        let v = 0;
        if (l) {
          const s = stateOf(l[1]);
          if (l[0] === "cylF") v = s.pos >= 0.98 ? 1 : 0;
          if (l[0] === "cylB") v = s.pos <= 0.02 ? 1 : 0;
          if (l[0] === "conv") v = s.boxes.some((p) => Math.abs(p + BOX / 2 - SENSOR_AT) < 0.05) ? 1 : 0;
        }
        want[x] = v; sens[x] = v;
      }
    });
    buzz(Object.keys(W).some((y) => W[y] === "buzzer" && outs[y]));
    return want;
  }

  function buzz(on) {
    if (mute) on = false;
    try {
      if (on && !audio) {
        const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
        const ctx = new C(), o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = 2300; g.gain.value = 0.025; o.connect(g); g.connect(ctx.destination); o.start();
        audio = { ctx, o };
      } else if (!on && audio) { audio.o.stop(); audio.ctx.close(); audio = null; }
    } catch (e) { audio = null; }
  }

  /* ---------- drawing ---------- */
  const sensorsOn = (y) => Object.keys(W).filter((x) => x[0] === "X" && link(W[x]) && link(W[x])[1] === y).map((x) => [x, link(W[x])[0]]);
  function card(y) {
    const k = W[y], name = `<b>${short(y)}</b> ${esc(OUT[k][0])}`;
    if (k === "red" || k === "green" || k === "yellow")
      return `<div class="k-card" data-y="${y}"><svg viewBox="0 0 90 92"><rect class="k-base" x="31" y="66" width="28" height="18" rx="3"/><circle class="k-lamp k-${k}" cx="45" cy="38" r="25"/><circle class="k-shine" cx="37" cy="29" r="6"/></svg><p>${name}</p></div>`;
    if (k === "buzzer")
      return `<div class="k-card" data-y="${y}"><svg viewBox="0 0 90 92"><path class="k-wave" d="M66 26q8 12 0 24M74 20q13 18 0 36M24 26q-8 12 0 24M16 20q-13 18 0 36"/><circle class="k-buz" cx="45" cy="38" r="22"/><circle class="k-buzhole" cx="45" cy="38" r="5"/><rect class="k-base" x="31" y="66" width="28" height="18" rx="3"/></svg><p>${name}</p></div>`;
    if (k === "motor")
      return `<div class="k-card" data-y="${y}"><svg viewBox="0 0 90 92"><circle class="k-mbody" cx="45" cy="40" r="30"/><g class="k-fan"><path d="M45 40 L45 14 A12 12 0 0 1 55 30Z M45 40 L68 53 A12 12 0 0 1 52 60Z M45 40 L22 53 A12 12 0 0 1 28 32Z"/></g><circle class="k-hub" cx="45" cy="40" r="5"/><rect class="k-base" x="31" y="72" width="28" height="12" rx="3"/></svg><p>${name}</p></div>`;
    if (k === "cyl") {
      const s = sensorsOn(y).map(([x, t]) => { const cx = t === "cylF" ? 79 : 19; return `<g class="k-sens" data-x="${x}"><rect x="${cx - 7}" y="22" width="14" height="7" rx="2"/><text x="${cx}" y="16">${short(x)}</text></g>`; }).join("");
      return `<div class="k-card wide" data-y="${y}"><svg viewBox="0 0 230 92"><rect class="k-cylbody" x="10" y="30" width="112" height="32" rx="4"/><rect class="k-piston" x="14" y="33" width="10" height="26"/><rect class="k-rod" x="24" y="41" width="118" height="10"/><rect class="k-head" x="142" y="34" width="10" height="24" rx="2"/>${s}<path class="k-air" d="M30 70v10h-14"/><text class="k-small" x="40" y="86">${esc(short(y))} ON：伸出</text></svg><p>${name}</p></div>`;
    }
    if (k === "conv") {
      const s = sensorsOn(y).map(([x]) => { const cx = 10 + SENSOR_AT * BELT; return `<g class="k-sens" data-x="${x}"><rect x="${cx - 6}" y="4" width="12" height="10" rx="2"/><path class="k-beam" d="M${cx} 14V44"/><text x="${cx + 10}" y="12" text-anchor="start">${short(x)}</text></g>`; }).join("");
      return `<div class="k-card wider" data-y="${y}"><svg viewBox="0 0 300 92"><rect class="k-belt" x="6" y="46" width="${BELT + 14}" height="16" rx="8"/><path class="k-stripe" d="M14 54H${BELT + 12}"/><circle class="k-roll" cx="14" cy="54" r="6"/><circle class="k-roll" cx="${BELT + 12}" cy="54" r="6"/><g class="k-boxes"></g>${s}<text class="k-small k-done" x="290" y="84" text-anchor="end"></text></svg>` +
        `<p>${name}　<button type="button" class="small-btn" data-add="${y}">放工件</button> <button type="button" class="small-btn" data-take="${y}">拿走工件</button></p></div>`;
    }
    return "";
  }
  function render() {
    if (!el) return;
    const yd = ys.filter((y) => W[y]), panel = xs.filter((x) => W[x] && IN[W[x]]);
    const cards = yd.map(card).join("") + (panel.length ? `<div class="k-card k-box"><div class="k-btns">${panel.map((x) => {
      const k = W[x];
      return `<button type="button" class="k-pb k-${k}" data-x="${x}" title="${esc(IN[k][0])}"><span></span><small>${short(x)} ${IN[k][1]}</small></button>`;
    }).join("")}</div><p>操作盒</p></div>` : "");
    const rows = xs.concat(ys).filter((d) => W[d]).map((d) => `<tr><td><b>${short(d)}</b></td><td><select data-dev="${d}">${options(d)}</select></td><td><button type="button" class="small-btn" data-del="${d}">拆掉</button></td></tr>`).join("");
    const free = xs.concat(ys).filter((d) => !W[d]);
    el.innerHTML = `<div class="k-scene">${cards || '<p class="hint">還沒有接任何裝置：X 都是切換開關、Y 都只是輸出燈。用下面的接線表把裝置接到端子上，例如 Y1 接紅燈、X3 接輸送帶的光電感測器。</p>'}</div>` +
      `<details class="k-wire" open><summary>接線表（自己接）</summary>` +
      (rows ? `<table class="k-table"><tbody>${rows}</tbody></table>` : "") +
      `<div class="k-add"><select class="k-term">${free.map((d) => `<option value="${d}">${short(d)}</option>`).join("")}</select><select class="k-kind"></select><button type="button" class="small-btn go" data-wire>接上</button></div>` +
      `<div class="k-add"><button type="button" class="small-btn" data-preset>範例：紅綠燈＋蜂鳴器＋輸送帶（接線和程式）</button><button type="button" class="small-btn" data-clear>全部拆掉</button><label class="check small"><input type="checkbox" data-mute ${mute ? "checked" : ""}> 蜂鳴器靜音</label></div></details>`;
    const term = el.querySelector(".k-term"), kind = el.querySelector(".k-kind");
    const fill = () => { kind.innerHTML = term.value ? options(term.value, true) : ""; };
    term.onchange = fill; fill();
    el.querySelector("[data-wire]").onclick = () => { if (term.value && kind.value) set(term.value, kind.value); };
    el.querySelector("[data-clear]").onclick = () => { W = {}; sim = {}; changed(); };
    el.querySelector("[data-preset]").onclick = () => { preset(); };
    el.querySelector("[data-mute]").onchange = (e) => { mute = e.target.checked; if (mute) buzz(false); };
    el.querySelectorAll("select[data-dev]").forEach((s) => (s.onchange = () => set(s.dataset.dev, s.value)));
    el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { delete W[b.dataset.del]; changed(); }));
    el.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => { const s = stateOf(b.dataset.add); if (!s.boxes.some((p) => p < BOX + 0.04)) s.boxes.push(0); }));
    el.querySelectorAll("[data-take]").forEach((b) => (b.onclick = () => { const s = stateOf(b.dataset.take); if (s.boxes.length) s.boxes.splice(s.boxes.indexOf(Math.max(...s.boxes)), 1); }));
    el.querySelectorAll(".k-pb").forEach((b) => {
      const x = b.dataset.x;
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); press(x, true); try { b.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } });
      const up = () => press(x, false);
      b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
    });
  }
  function options(dev, fresh) {
    const cur = kindOf(dev);
    if (dev[0] === "Y") return Object.keys(OUT).map((k) => `<option value="${k}" ${k === cur && !fresh ? "selected" : ""}>${OUT[k][0]}</option>`).join("");
    let o = Object.keys(IN).map((k) => `<option value="${k}" ${k === cur && !fresh ? "selected" : ""}>${IN[k][0]}</option>`).join("");
    ys.filter((y) => SENS_OF[W[y]]).forEach((y) => SENS_OF[W[y]].forEach((s) => {
      const v = s + ":" + y;
      o += `<option value="${v}" ${v === cur && !fresh ? "selected" : ""}>${short(y)} ${OUT[W[y]][1]}的${SENS[s][0]}</option>`;
    }));
    return o;
  }
  function set(dev, kind) { W[dev] = kind; changed(); }
  function changed() { save(); render(); if (opt && opt.onChange) opt.onChange(); }
  function preset() {
    W = { X000: "nopb", X001: "ncpb", X003: "conv:Y004", Y001: "red", Y002: "green", Y003: "buzzer", Y004: "conv" };
    sim = {}; stateOf("Y004").boxes = [0.2, 0.45];
    changed();
    if (opt && opt.onPreset) opt.onPreset(PRESET_IL, PRESET_NOTE);
  }
  const PRESET_IL = ["LD X000", "OR M0", "AND X001", "OUT M0", "LD M0", "ANI X003", "OUT Y004", "OUT Y002",
    "LDI M0", "OR X003", "OUT Y001", "LD M0", "AND X003", "OUT T0 K20", "LD M0", "AND X003", "ANI T0", "OUT Y003"].join("\n");
  const PRESET_NOTE = "按 X0 啟動（自保持 M0，X1 急停是常閉所以串 LD X1 的常開接點）：輸送帶 Y4 轉、綠燈 Y2 亮。工件到光電 X3：輸送帶停、紅燈 Y1 亮、蜂鳴器 Y3 響 2 秒。點「拿走工件」後自動繼續。";

  function update(st) {
    if (!el || !st) return;
    const o = st.outputs || {};
    el.querySelectorAll(".k-card[data-y]").forEach((c) => {
      const y = c.dataset.y, s = stateOf(y);
      c.classList.toggle("on", !!o[y]);
      if (W[y] === "motor") c.querySelector(".k-fan").setAttribute("transform", `rotate(${s.ang.toFixed(1)} 45 40)`);
      if (W[y] === "cyl") {
        const dx = s.pos * 60;
        c.querySelector(".k-piston").setAttribute("x", 14 + dx);
        c.querySelector(".k-rod").setAttribute("x", 24 + dx);
        c.querySelector(".k-head").setAttribute("x", 142 + dx);
      }
      if (W[y] === "conv") {
        c.querySelector(".k-boxes").innerHTML = s.boxes.map((p) => `<rect class="k-part" x="${(10 + p * BELT).toFixed(1)}" y="24" width="${BOX * BELT}" height="22" rx="2"/>`).join("");
        c.querySelector(".k-done").textContent = s.done ? `送出 ${s.done} 個` : "";
      }
    });
    el.querySelectorAll(".k-sens").forEach((g) => g.classList.toggle("on", !!(st.inputs || {})[g.dataset.x]));
    el.querySelectorAll(".k-pb").forEach((b) => b.classList.toggle("down", !!pressed[b.dataset.x]));
  }

  /* el: where the machine is drawn; o: {xs, ys, onChange, onPreset} */
  function mount(target, o) { el = target; opt = o; xs = o.xs; ys = o.ys; load(); render(); }
  function unmount() { if (el) el.innerHTML = ""; el = null; buzz(false); }
  return { mount, unmount, step, update, label, tag, inputKind, press, kindOf, PRESET_IL };
})();
