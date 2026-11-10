"use strict";
/* Self-wired machine for the simulator's free circuit mode: the learner decides what is wired to each terminal
   (Y1 red lamp, Y3 buzzer, Y4 conveyor, X3 the conveyor's photo sensor...). The soft PLC drives the outputs,
   the devices move, and their sensors are fed back into the X inputs, like a real FX3S wired to a machine.
   Nothing is wired by default: every X is a plain switch and every Y a plain lamp until the learner wires it.
   Wiring values: a device kind ("red", "conv"), a part of another Y's device ("doorDn:Y000" = the down coil of
   the shutter on Y0), or a sensor of a device ("conv:Y004" = the photo sensor at the end of the conveyor on Y4). */
const Kit = (() => {
  const OUT = {
    red: ["紅燈", "紅燈"], green: ["綠燈", "綠燈"], yellow: ["黃燈", "黃燈"], buzzer: ["蜂鳴器", "蜂鳴"],
    motor: ["馬達（風扇）", "馬達"], cyl: ["氣缸（單動，彈簧復歸）", "氣缸"], conv: ["輸送帶馬達", "輸送"],
    door: ["鐵捲門（上升線圈）", "鐵門"], tank: ["水槽進水閥", "進水"], heat: ["加熱器", "加熱"],
    seg: ["七段顯示器（BCD，佔連續 4 點）", "七段"],
  };
  const SUB = {                                   // a Y that is part of the device on another Y: [name, short, parent kind]
    doorDn: ["下降線圈", "下降", "door"], tankOut: ["排水閥", "排水", "tank"], push: ["推料氣缸", "推料", "conv"],
  };
  const IN = {
    switch: ["切換開關（點一下 ON／OFF）", "開關"], nopb: ["按鈕（常開，按住才 ON）", "按鈕"],
    ncpb: ["急停／停止按鈕（常閉，平常 ON，按下 OFF）", "急停"],
  };
  const SENS = {
    cylF: ["伸出到底感測器", "前限"], cylB: ["縮回到底感測器", "後限"],
    conv: ["末端光電感測器", "光電"], convM: ["金屬感測器（30% 處，只對金屬 ON）", "金屬"], convP: ["推料位置光電（50% 處）", "推料位"],
    pushF: ["推到底感測器", "推到底"], doorU: ["上限開關", "上限"], doorL: ["下限開關", "下限"],
    tankH: ["高液位感測器（80% 以上 ON）", "高液位"], tankL: ["低液位感測器（20% 以上 ON）", "低液位"],
    heatT: ["溫度開關（60°C 以上 ON）", "溫度"],
  };
  const SENS_OF = { cyl: ["cylF", "cylB"], conv: ["conv", "convM", "convP"], push: ["pushF"], door: ["doorU", "doorL"], tank: ["tankH", "tankL"], heat: ["heatT"] };
  const AT = { conv: 0.85, convM: 0.3, convP: 0.5 }, PUSH_AT = 0.5, BOX = 0.075, BELT = 270;
  const short = (d) => d[0] + d.slice(1).replace(/^0+(?=\d)/, "");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const base = (k) => String(k || "").split(":")[0];
  const yAdd = (y, i) => "Y" + (parseInt(y.slice(1), 8) + i).toString(8).padStart(3, "0");

  let W = {}, pressed = {}, sim = {}, el = null, opt = null, xs = [], ys = [], outs = {}, mute = false, audio = null;

  function load() { try { W = JSON.parse(localStorage.getItem("ll_kit") || "{}") || {}; } catch (e) { W = {}; } }
  function save() { try { localStorage.setItem("ll_kit", JSON.stringify(W)); } catch (e) { /* private mode */ } }
  const kindOf = (dev) => W[dev] || (dev[0] === "X" ? "switch" : "");
  function link(kind) {                           // sensor "conv:Y004" -> ["conv", "Y004"] when Y4 really is a conveyor
    const [s, y] = String(kind).split(":");
    return SENS[s] && y && (SENS_OF[base(W[y])] || []).includes(s) ? [s, y] : null;
  }
  function subLink(kind) {                        // "doorDn:Y000" -> ["doorDn", "Y000"] when Y0 really is a shutter
    const [s, y] = String(kind).split(":");
    return SUB[s] && y && base(W[y]) === SUB[s][2] ? [s, y] : null;
  }
  const subsOf = (y, s) => ys.filter((d) => W[d] === s + ":" + y);
  function segOwner(y) {                          // the seven segment display that uses this Y as bit 1..3
    for (let i = 1; i < 4; i++) {
      const n = parseInt(y.slice(1), 8) - i;
      if (n >= 0) { const o = "Y" + n.toString(8).padStart(3, "0"); if (W[o] === "seg") return [o, i]; }
    }
    return null;
  }
  function devName(y) { const k = W[y]; if (OUT[k]) return OUT[k][0].replace(/（.*$/, ""); const l = subLink(k); return l ? SUB[l[0]][0] : ""; }
  function label(dev) {
    if (!/^[XY]\d+$/.test(dev)) return "";
    const k = kindOf(dev);
    if (dev[0] === "Y") {
      if (OUT[k]) return OUT[k][0];
      const l = subLink(k); if (l) return `${short(l[1])} ${devName(l[1])}的${SUB[l[0]][0]}`;
      const g = segOwner(dev); if (g) return `${short(g[0])} 七段顯示器的第 ${g[1]} 位元（${[1, 2, 4, 8][g[1]]}）`;
      return k ? "（沒有對應的機構）" : "";
    }
    if (IN[k]) return W[dev] ? IN[k][0] : "";
    const l = link(k);
    return l ? `${short(l[1])} ${devName(l[1])}的${SENS[l[0]][0]}` : "（感測器沒有對應的機構）";
  }
  function tag(dev) {
    if (!/^[XY]\d+$/.test(dev)) return "";
    const k = kindOf(dev);
    if (dev[0] === "Y") {
      if (OUT[k]) return OUT[k][1];
      const l = subLink(k); if (l) return SUB[l[0]][1];
      return segOwner(dev) ? "七段" : (k ? "未接" : "");
    }
    if (IN[k]) return W[dev] ? IN[k][1] : "";
    const l = link(k);
    return l ? SENS[l[0]][1] : "未接";
  }
  /* how the simulator page treats an X button: switch (toggle), hold (button), sensor (driven by the machine) */
  function inputKind(dev) { const k = kindOf(dev); return k === "switch" ? "switch" : (k === "nopb" || k === "ncpb") ? "hold" : "sensor"; }
  function press(dev, on) { pressed[dev] = !!on; }

  function stateOf(y) { return sim[y] || (sim[y] = { pos: 0, boxes: [], done: 0, pushed: 0, ang: 0, level: 0, temp: 25, burnt: false }); }
  const on = (y) => !!(y && outs[y]);
  /* advance the machine by dt ms with the PLC outputs; returns the X values the machine drives */
  function step(dt, outputs) {
    outs = outputs || {};
    ys.forEach((y) => {
      const k = W[y]; if (!k) return;
      const s = stateOf(y), b = base(k);
      if (b === "cyl") s.pos = Math.max(0, Math.min(1, s.pos + (on(y) ? 1 : -1) * dt / 600));
      if (b === "push" && subLink(k)) {
        s.pos = Math.max(0, Math.min(1, s.pos + (on(y) ? 1 : -1) * dt / 450));
        const c = stateOf(subLink(k)[1]);
        if (s.pos > 0.5) {
          const n = c.boxes.length;
          c.boxes = c.boxes.filter((x) => Math.abs(x.p + BOX / 2 - PUSH_AT) > BOX * 0.7);
          c.pushed += n - c.boxes.length;
        }
      }
      if (k === "conv" && on(y)) {
        const pusher = subsOf(y, "push")[0], blocked = pusher && stateOf(pusher).pos > 0.15;
        s.boxes.forEach((x) => {
          const np = x.p + dt / 6000;
          if (blocked && x.p + BOX < PUSH_AT - 0.04 && np + BOX >= PUSH_AT - 0.04) return; // the extended pusher blocks the belt
          x.p = np;
        });
        const n = s.boxes.length; s.boxes = s.boxes.filter((x) => x.p < 1); s.done += n - s.boxes.length;
      }
      if (k === "motor" && on(y)) s.ang = (s.ang + dt * 0.72) % 360;
      if (k === "door") {
        const up = on(y), dn = on(subsOf(y, "doorDn")[0]);
        if (up && dn) s.burnt = true;
        if (!s.burnt) s.pos = Math.max(0, Math.min(1, s.pos + ((up ? 1 : 0) - (dn ? 1 : 0)) * dt / 4000));
      }
      if (k === "tank") {
        s.level += ((on(y) ? 1 / 5000 : 0) - (on(subsOf(y, "tankOut")[0]) ? 1 / 9000 : 0)) * dt;
        if (s.level > 1) { s.level = 1; s.over = true; }
        s.level = Math.max(0, s.level);
      }
      if (k === "heat") s.temp = Math.min(200, s.temp + (on(y) ? 8 * dt / 1000 : -(s.temp - 25) * 0.12 * dt / 1000));
    });
    const want = {};
    xs.forEach((x) => {
      const k = W[x]; if (!k) return;
      if (k === "nopb") want[x] = pressed[x] ? 1 : 0;
      else if (k === "ncpb") want[x] = pressed[x] ? 0 : 1;
      else if (k !== "switch") {
        const l = link(k);
        let v = 0;
        if (l) {
          const s = stateOf(l[1]), t = l[0];
          if (t === "cylF" || t === "pushF") v = s.pos >= 0.98 ? 1 : 0;
          if (t === "cylB") v = s.pos <= 0.02 ? 1 : 0;
          if (t === "conv" || t === "convP") v = s.boxes.some((b) => Math.abs(b.p + BOX / 2 - AT[t]) < 0.04) ? 1 : 0;
          if (t === "convM") v = s.boxes.some((b) => b.m && Math.abs(b.p + BOX / 2 - AT[t]) < 0.04) ? 1 : 0;
          if (t === "doorU") v = s.pos >= 0.99 ? 1 : 0;
          if (t === "doorL") v = s.pos <= 0.01 ? 1 : 0;
          if (t === "tankH") v = s.level >= 0.8 ? 1 : 0;
          if (t === "tankL") v = s.level >= 0.2 ? 1 : 0;
          if (t === "heatT") v = s.temp >= 60 ? 1 : 0;
        }
        want[x] = v;
      }
    });
    buzz(ys.some((y) => W[y] === "buzzer" && outs[y]));
    return want;
  }

  function buzz(want) {
    if (mute) want = false;
    try {
      if (want && !audio) {
        const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
        const ctx = new C(), o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = 2300; g.gain.value = 0.025; o.connect(g); g.connect(ctx.destination); o.start();
        audio = { ctx, o };
      } else if (!want && audio) { audio.o.stop(); audio.ctx.close(); audio = null; }
    } catch (e) { audio = null; }
  }

  /* ---------- drawing ---------- */
  const sensorsOf = (y) => xs.filter((x) => link(W[x]) && link(W[x])[1] === y).map((x) => [x, link(W[x])[0]]);
  const sensMark = (x, cx, cy) => `<g class="k-sens" data-x="${x}"><rect x="${cx - 7}" y="${cy - 4}" width="14" height="8" rx="2"/><text x="${cx}" y="${cy - 7}">${short(x)}</text></g>`;
  const SEG = { a: "M14 8h22", b: "M38 10v20", c: "M38 36v20", d: "M14 58h22", e: "M12 36v20", f: "M12 10v20", g: "M14 33h22" };
  const DIG = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];
  function card(y) {
    const k = W[y], name = `<b>${short(y)}</b> ${esc(OUT[k][0])}`;
    if (k === "red" || k === "green" || k === "yellow")
      return `<div class="k-card" data-y="${y}"><svg viewBox="0 0 90 92"><rect class="k-base" x="31" y="66" width="28" height="18" rx="3"/><circle class="k-lamp k-${k}" cx="45" cy="38" r="25"/><circle class="k-shine" cx="37" cy="29" r="6"/></svg><p>${name}</p></div>`;
    if (k === "buzzer")
      return `<div class="k-card" data-y="${y}"><svg viewBox="0 0 90 92"><path class="k-wave" d="M66 26q8 12 0 24M74 20q13 18 0 36M24 26q-8 12 0 24M16 20q-13 18 0 36"/><circle class="k-buz" cx="45" cy="38" r="22"/><circle class="k-buzhole" cx="45" cy="38" r="5"/><rect class="k-base" x="31" y="66" width="28" height="18" rx="3"/></svg><p>${name}</p></div>`;
    if (k === "motor")
      return `<div class="k-card" data-y="${y}"><svg viewBox="0 0 90 92"><circle class="k-mbody" cx="45" cy="40" r="30"/><g class="k-fan"><path d="M45 40 L45 14 A12 12 0 0 1 55 30Z M45 40 L68 53 A12 12 0 0 1 52 60Z M45 40 L22 53 A12 12 0 0 1 28 32Z"/></g><circle class="k-hub" cx="45" cy="40" r="5"/><rect class="k-base" x="31" y="72" width="28" height="12" rx="3"/></svg><p>${name}</p></div>`;
    if (k === "cyl") {
      const s = sensorsOf(y).map(([x, t]) => sensMark(x, t === "cylF" ? 79 : 19, 26)).join("");
      return `<div class="k-card wide" data-y="${y}"><svg viewBox="0 0 230 92"><rect class="k-cylbody" x="10" y="30" width="112" height="32" rx="4"/><rect class="k-piston" x="14" y="33" width="10" height="26"/><rect class="k-rod" x="24" y="41" width="118" height="10"/><rect class="k-head" x="142" y="34" width="10" height="24" rx="2"/>${s}<path class="k-air" d="M30 70v10h-14"/><text class="k-small" x="40" y="86">${esc(short(y))} ON：伸出</text></svg><p>${name}</p></div>`;
    }
    if (k === "conv") {
      const px = (p) => 10 + p * BELT, pusher = subsOf(y, "push")[0];
      const s = sensorsOf(y).map(([x, t]) => {
        const cx = px(AT[t]);
        return t === "conv" ? `<g class="k-sens" data-x="${x}"><rect x="${cx - 6}" y="8" width="12" height="9" rx="2"/><path class="k-beam" d="M${cx} 17V50"/><text x="${cx + 9}" y="15" text-anchor="start">${short(x)}</text></g>`
          : `<g class="k-sens" data-x="${x}"><rect x="${cx - 7}" y="72" width="14" height="8" rx="2"/><text x="${cx}" y="91">${short(x)} ${t === "convM" ? "金屬" : "光電"}</text></g>`;
      }).join("");
      const ps = pusher ? sensorsOf(pusher).map(([x]) => `<g class="k-sens" data-x="${x}"><rect x="${px(PUSH_AT) + 12}" y="6" width="8" height="8" rx="2"/><text x="${px(PUSH_AT) + 22}" y="13" text-anchor="start">${short(x)}</text></g>`).join("") : "";
      const push = pusher ? `<g class="k-pusher"><rect class="k-cylbody" x="${px(PUSH_AT) - 9}" y="2" width="18" height="16" rx="2"/><rect class="k-rod" x="${px(PUSH_AT) - 3}" y="18" width="6" height="2"/><rect class="k-head" x="${px(PUSH_AT) - 14}" y="20" width="28" height="5" rx="1"/><text class="k-small" x="${px(PUSH_AT) - 12}" y="11" text-anchor="end">${short(pusher)} 推料</text></g>` +
        `<rect class="k-bin" x="${px(PUSH_AT) - 22}" y="96" width="44" height="18" rx="2"/><text class="k-small k-binb" x="${px(PUSH_AT)}" y="109" text-anchor="middle"></text>${ps}` : "";
      return `<div class="k-card wider" data-y="${y}"><svg viewBox="0 0 300 118"><rect class="k-belt" x="4" y="50" width="${BELT + 14}" height="16" rx="8"/><path class="k-stripe" d="M12 58H${BELT + 10}"/><circle class="k-roll" cx="12" cy="58" r="6"/><circle class="k-roll" cx="${BELT + 10}" cy="58" r="6"/><g class="k-boxes"></g>${push}${s}<rect class="k-bin" x="${BELT - 2}" y="96" width="30" height="18" rx="2"/><text class="k-small k-done" x="${BELT + 13}" y="109" text-anchor="middle"></text></svg>` +
        `<p>${name}　<button type="button" class="small-btn" data-add="${y}" data-m="1">放金屬</button> <button type="button" class="small-btn" data-add="${y}" data-m="0">放塑膠</button> <button type="button" class="small-btn" data-take="${y}">拿走</button></p></div>`;
    }
    if (k === "door") {
      const dn = subsOf(y, "doorDn")[0], s = sensorsOf(y).map(([x, t]) => sensMark(x, 110, t === "doorU" ? 26 : 82)).join("");
      return `<div class="k-card k-mid" data-y="${y}"><svg viewBox="0 0 130 100"><rect class="k-frame" x="18" y="14" width="80" height="74"/><rect class="k-mbody" x="14" y="4" width="88" height="12" rx="2"/><text class="k-motor-t" x="58" y="13" text-anchor="middle">▲ ${short(y)}${dn ? "　▼ " + short(dn) : ""}</text><g class="k-slats"></g><path class="k-floor" d="M8 88H122"/>${s}<text class="k-warn" x="58" y="56" text-anchor="middle"></text></svg><p>${name}${dn ? "" : '<br><small class="hint">再把另一個 Y 接成「下降線圈」</small>'}</p></div>`;
    }
    if (k === "tank") {
      const out = subsOf(y, "tankOut")[0], s = sensorsOf(y).map(([x, t]) => sensMark(x, 104, t === "tankH" ? 33 : 73)).join("");
      return `<div class="k-card k-mid" data-y="${y}"><svg viewBox="0 0 130 104"><path class="k-pipe" d="M4 8H40V18"/><rect class="k-valve vin" x="18" y="3" width="10" height="10" rx="2"/><text class="k-small" x="23" y="25" text-anchor="middle">${short(y)}</text>` +
        `<rect class="k-tank" x="30" y="18" width="60" height="70" rx="3"/><rect class="k-water" x="31" y="87" width="58" height="0"/><path class="k-mark" d="M88 33h8M88 73h8"/>${s}` +
        (out ? `<path class="k-pipe" d="M60 88V96H124"/><rect class="k-valve vout" x="98" y="91" width="10" height="10" rx="2"/><text class="k-small" x="114" y="89">${short(out)}</text>` : "") +
        `<text class="k-lv" x="60" y="56" text-anchor="middle"></text></svg><p>${name}${out ? "" : '<br><small class="hint">可以再接一個 Y 當「排水閥」</small>'}</p></div>`;
    }
    if (k === "heat") {
      const s = sensorsOf(y).map(([x]) => sensMark(x, 112, 70)).join("");
      return `<div class="k-card k-mid" data-y="${y}"><svg viewBox="0 0 130 100"><rect class="k-oven" x="8" y="10" width="80" height="74" rx="4"/><path class="k-coil" d="M16 66l8-10 8 10 8-10 8 10 8-10 8 10 8-10 8 10"/><text class="k-temp" x="48" y="38" text-anchor="middle"></text><rect class="k-therm" x="98" y="14" width="6" height="44" rx="3"/><rect class="k-merc" x="99" y="57" width="4" height="0"/>${s}</svg><p>${name}</p></div>`;
    }
    if (k === "seg")
      return `<div class="k-card" data-y="${y}"><svg viewBox="0 0 90 92"><rect class="k-segbg" x="12" y="2" width="66" height="70" rx="4"/><g transform="translate(20 4)">${Object.keys(SEG).map((g) => `<path class="k-seg" data-g="${g}" d="${SEG[g]}"/>`).join("")}</g><text class="k-small" x="45" y="86" text-anchor="middle">${short(y)}～${short(yAdd(y, 3))}</text></svg><p>${name}</p></div>`;
    return "";
  }
  function render() {
    if (!el) return;
    const yd = ys.filter((y) => OUT[W[y]]), panel = xs.filter((x) => W[x] === "nopb" || W[x] === "ncpb");
    const cards = yd.map(card).join("") + (panel.length ? `<div class="k-card k-box"><div class="k-btns">${panel.map((x) => {
      const k = W[x];
      return `<button type="button" class="k-pb k-${k}" data-x="${x}" title="${esc(IN[k][0])}"><span></span><small>${short(x)} ${IN[k][1]}</small></button>`;
    }).join("")}</div><p>操作盒</p></div>` : "");
    const rows = xs.concat(ys).filter((d) => W[d]).map((d) => `<tr><td><b>${short(d)}</b></td><td><select data-dev="${d}">${options(d)}</select></td><td><button type="button" class="small-btn" data-del="${d}">拆掉</button></td></tr>`).join("");
    const free = xs.concat(ys).filter((d) => !W[d]);
    el.innerHTML = `<div class="k-scene">${cards || '<p class="hint">還沒有接任何裝置：X 都是切換開關、Y 都只是輸出燈。用下面的接線表把裝置接到端子上，例如 Y1 接紅燈、X3 接輸送帶的光電感測器；或從「範例機構」挑一組來看。</p>'}</div>` +
      `<details class="k-wire" open><summary>接線表（自己接）</summary>` +
      (rows ? `<table class="k-table"><tbody>${rows}</tbody></table>` : "") +
      `<div class="k-add"><select class="k-term">${free.map((d) => `<option value="${d}">${short(d)}</option>`).join("")}</select><select class="k-kind"></select><button type="button" class="small-btn go" data-wire>接上</button></div>` +
      `<div class="k-add"><select class="k-preset">${PRESETS.map((p, i) => `<option value="${i}">${esc(p.title)}</option>`).join("")}</select><button type="button" class="small-btn" data-preset>載入範例機構（接線和程式）</button></div>` +
      `<div class="k-add"><button type="button" class="small-btn" data-reset>機構歸位</button><button type="button" class="small-btn" data-clear>全部拆掉</button><label class="check small"><input type="checkbox" data-mute ${mute ? "checked" : ""}> 蜂鳴器靜音</label></div></details>`;
    const term = el.querySelector(".k-term"), kind = el.querySelector(".k-kind");
    const fill = () => { kind.innerHTML = term.value ? options(term.value, true) : ""; };
    term.onchange = fill; fill();
    el.querySelector("[data-wire]").onclick = () => { if (term.value && kind.value) set(term.value, kind.value); };
    el.querySelector("[data-clear]").onclick = () => { W = {}; sim = {}; changed(); };
    el.querySelector("[data-reset]").onclick = () => { sim = {}; };
    el.querySelector("[data-preset]").onclick = () => preset(+el.querySelector(".k-preset").value);
    el.querySelector("[data-mute]").onchange = (e) => { mute = e.target.checked; if (mute) buzz(false); };
    el.querySelectorAll("select[data-dev]").forEach((s) => (s.onchange = () => set(s.dataset.dev, s.value)));
    el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { delete W[b.dataset.del]; changed(); }));
    el.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => { const s = stateOf(b.dataset.add); if (!s.boxes.some((x) => x.p < BOX + 0.04)) s.boxes.push({ p: 0, m: b.dataset.m === "1" }); }));
    el.querySelectorAll("[data-take]").forEach((b) => (b.onclick = () => { const s = stateOf(b.dataset.take); if (s.boxes.length) { const far = Math.max(...s.boxes.map((x) => x.p)); s.boxes = s.boxes.filter((x) => x.p !== far); } }));
    el.querySelectorAll(".k-pb").forEach((b) => {
      const x = b.dataset.x;
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); press(x, true); try { b.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } });
      const up = () => press(x, false);
      b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
    });
  }
  function options(dev, fresh) {
    const cur = kindOf(dev), opt2 = (v, t) => `<option value="${v}" ${v === cur && !fresh ? "selected" : ""}>${esc(t)}</option>`;
    if (dev[0] === "Y") {
      let o = Object.keys(OUT).map((k) => opt2(k, OUT[k][0])).join("");
      ys.filter((y) => y !== dev).forEach((y) => Object.keys(SUB).forEach((s) => { if (W[y] === SUB[s][2]) o += opt2(s + ":" + y, `${short(y)} ${devName(y)}的${SUB[s][0]}`); }));
      return o;
    }
    let o = Object.keys(IN).map((k) => opt2(k, IN[k][0])).join("");
    ys.forEach((y) => (SENS_OF[base(W[y])] || []).forEach((s) => { if (base(W[y]) !== "push" || subLink(W[y])) o += opt2(s + ":" + y, `${short(y)} ${devName(y)}的${SENS[s][0]}`); }));
    return o;
  }
  function set(dev, kind) { W[dev] = kind; changed(); }
  let before = {};
  /* a terminal that becomes a switch starts OFF (it may have been a sensor or button that was ON); a preset starts all switches OFF */
  function changed(all) {
    save(); render();
    if (opt && opt.onReset) xs.forEach((x) => { if (kindOf(x) === "switch" && (all || before[x] !== "switch")) opt.onReset(x); });
    before = {}; xs.forEach((x) => { before[x] = kindOf(x); });
    if (opt && opt.onChange) opt.onChange();
  }

  const PRESETS = [
    { title: "輸送帶＋紅綠燈＋蜂鳴器", W: { X000: "nopb", X001: "ncpb", X003: "conv:Y004", Y001: "red", Y002: "green", Y003: "buzzer", Y004: "conv" },
      init() { stateOf("Y004").boxes = [{ p: 0.2, m: false }, { p: 0.5, m: true }]; },
      il: ["LD X000", "OR M0", "AND X001", "OUT M0", "LD M0", "ANI X003", "OUT Y004", "OUT Y002", "LDI M0", "OR X003", "OUT Y001",
        "LD M0", "AND X003", "OUT T0 K20", "LD M0", "AND X003", "ANI T0", "OUT Y003"],
      note: "X0 啟動、X1 急停（常閉，平常 ON，所以程式用常開接點 AND X1）。運轉時輸送帶 Y4 轉、綠燈 Y2 亮。工件到末端光電 X3：輸送帶停、紅燈 Y1 亮、蜂鳴器 Y3 響 2 秒。按「拿走」後自動繼續。" },
    { title: "金屬分料：輸送帶＋推料氣缸＋七段計數", W: { X000: "nopb", X001: "ncpb", X002: "convM:Y000", X003: "convP:Y000", X004: "pushF:Y001", Y000: "conv", Y001: "push:Y000", Y004: "seg" },
      init() { stateOf("Y000").boxes = [{ p: 0.05, m: true }]; },
      il: ["LD X000", "OR M0", "AND X001", "OUT M0", "LD X002", "SET M1", "LD X003", "AND M1", "SET Y001", "LD X004", "RST Y001", "RST M1",
        "LD X004", "OUT C0 K10", "LD C0", "RST C0", "LD M0", "ANI Y001", "OUT Y000", "LD M8000", "MOV C0 K1Y004"],
      note: "按 X0 啟動。金屬經過 X2 金屬感測器時記住（SET M1）；到推料位置 X3 時推料氣缸 Y1 推出（輸送帶暫停），推到底 X4 就縮回、忘掉 M1。塑膠一路送到末端。推出的金屬用 C0 計數，MOV C0 K1Y004 顯示在七段顯示器（Y4～Y7）。工件一次放一個比較準。" },
    { title: "鐵捲門：上升／下降互鎖＋上下限", W: { X000: "nopb", X001: "nopb", X002: "ncpb", X003: "doorU:Y000", X004: "doorL:Y000", Y000: "door", Y001: "doorDn:Y000", Y002: "yellow" },
      init() {},
      il: ["LD X000", "OR Y000", "AND X002", "ANI X003", "ANI Y001", "OUT Y000", "LD X001", "OR Y001", "AND X002", "ANI X004", "ANI Y000", "OUT Y001",
        "LD Y000", "OR Y001", "AND M8013", "OUT Y002"],
      note: "X0 上升、X1 下降（都自保持），X2 停止（常閉）。到上限 X3、下限 X4 自動停。ANI Y001／ANI Y000 是互鎖：上升、下降線圈同時 ON 馬達會燒掉（把互鎖拿掉試試看）。門在動時黃燈 Y2 閃。" },
    { title: "水槽液位：自動補水", W: { X000: "tankL:Y000", X001: "tankH:Y000", X002: "switch", Y000: "tank", Y001: "tankOut:Y000", Y002: "red" },
      init() { stateOf("Y000").level = 0.5; },
      il: ["LDI X000", "OR Y000", "ANI X001", "OUT Y000", "LD X002", "OUT Y001", "LDI X000", "OUT Y002"],
      note: "X2 開關打開排水閥 Y1。水位低於低液位 X0：進水閥 Y0 打開並自保持，到高液位 X1 才關，所以水位在 20%～80% 之間來回。低於 20% 時紅燈 Y2 亮。" },
    { title: "加熱器：溫度開關控溫", W: { X000: "switch", X001: "heatT:Y000", Y000: "heat", Y001: "green", Y002: "red" },
      init() {},
      il: ["LD X000", "ANI X001", "OUT Y000", "LD X000", "OUT Y001", "LD X001", "OUT Y002"],
      note: "X0 開關打開運轉（綠燈 Y1）。溫度低於 60°C 時加熱器 Y0 ON，到 60°C 溫度開關 X1 ON 就斷開，溫度會在 60°C 附近上下跳：這就是 ON／OFF 控溫。到溫時紅燈 Y2 亮。" },
  ];
  function preset(i) {
    const p = PRESETS[i] || PRESETS[0];
    W = Object.assign({}, p.W); sim = {}; p.init();
    changed(true);
    if (opt && opt.onPreset) opt.onPreset(p.il.join("\n"), p.note);
  }

  function update(st) {
    if (!el || !st) return;
    el.querySelectorAll(".k-card[data-y]").forEach((c) => {
      const y = c.dataset.y, s = stateOf(y), k = W[y], q = (sel) => c.querySelector(sel);
      c.classList.toggle("on", on(y));
      if (k === "motor") q(".k-fan").setAttribute("transform", `rotate(${s.ang.toFixed(1)} 45 40)`);
      if (k === "cyl") {
        const dx = s.pos * 60;
        q(".k-piston").setAttribute("x", 14 + dx); q(".k-rod").setAttribute("x", 24 + dx); q(".k-head").setAttribute("x", 142 + dx);
      }
      if (k === "conv") {
        q(".k-boxes").innerHTML = s.boxes.map((b) => `<rect class="k-part${b.m ? " metal" : ""}" x="${(10 + b.p * BELT).toFixed(1)}" y="28" width="${BOX * BELT}" height="22" rx="2"/>`).join("");
        q(".k-done").textContent = s.done ? String(s.done) : "";
        const pusher = subsOf(y, "push")[0];
        if (pusher && q(".k-pusher")) {
          const p = stateOf(pusher).pos;
          q(".k-pusher").classList.toggle("on", on(pusher));
          q(".k-pusher .k-rod").setAttribute("height", 2 + p * 28); q(".k-pusher .k-head").setAttribute("y", 20 + p * 28);
          q(".k-binb").textContent = s.pushed ? String(s.pushed) : "";
        }
      }
      if (k === "door") {
        const h = (1 - s.pos) * 72;
        let sl = "";
        for (let yy = 16; yy < 16 + h - 0.5; yy += 8) sl += `<rect class="k-slat" x="20" y="${yy.toFixed(1)}" width="76" height="${Math.min(7, 16 + h - yy).toFixed(1)}"/>`;
        q(".k-slats").innerHTML = sl;
        q(".k-warn").textContent = s.burnt ? "馬達燒毀！" : "";
        c.classList.toggle("burnt", s.burnt);
        if (s.burnt && !q("[data-fix]")) {
          c.insertAdjacentHTML("beforeend", `<button type="button" class="small-btn" data-fix="${y}">修好馬達</button>`);
          q("[data-fix]").onclick = () => { stateOf(y).burnt = false; };
        }
        if (!s.burnt && q("[data-fix]")) q("[data-fix]").remove();
        c.title = s.burnt ? "上升和下降線圈同時 ON，馬達燒毀。程式要加互鎖。" : "";
      }
      if (k === "tank") {
        const h = s.level * 68;
        q(".k-water").setAttribute("y", (87 - h).toFixed(1)); q(".k-water").setAttribute("height", h.toFixed(1));
        q(".k-lv").textContent = s.over ? "溢出！" : Math.round(s.level * 100) + "%";
        if (s.over && s.level < 0.95) s.over = false;
        q(".vin").classList.toggle("open", on(y));
        const out = subsOf(y, "tankOut")[0]; if (out && q(".vout")) q(".vout").classList.toggle("open", on(out));
      }
      if (k === "heat") {
        q(".k-temp").textContent = s.temp.toFixed(0) + "°C";
        const h = Math.max(0, Math.min(42, (s.temp - 20) / 100 * 42));
        q(".k-merc").setAttribute("y", (57 - h).toFixed(1)); q(".k-merc").setAttribute("height", h.toFixed(1));
      }
      if (k === "seg") {
        const v = [0, 1, 2, 3].reduce((a, i) => a + (on(yAdd(y, i)) ? 1 << i : 0), 0), lit = v <= 9 ? DIG[v] : "";
        c.querySelectorAll(".k-seg").forEach((p) => p.classList.toggle("lit", lit.includes(p.dataset.g)));
        c.classList.toggle("on", v > 0);
      }
    });
    el.querySelectorAll(".k-sens").forEach((g) => g.classList.toggle("on", !!(st.inputs || {})[g.dataset.x]));
    el.querySelectorAll(".k-pb").forEach((b) => b.classList.toggle("down", !!pressed[b.dataset.x]));
  }

  /* target: where the machine is drawn; o: {xs, ys, onChange, onPreset} */
  function mount(target, o) { el = target; opt = o; xs = o.xs; ys = o.ys; load(); render(); before = {}; xs.forEach((x) => { before[x] = kindOf(x); }); }
  function unmount() { if (el) el.innerHTML = ""; el = null; buzz(false); }
  return { mount, unmount, step, update, label, tag, inputKind, press, kindOf, PRESETS };
})();
