"use strict";
/* Assembly bench for the simulator's free circuit mode: the learner drags parts (lamps, buzzer, conveyor, shutter,
   tank...) onto the bench and draws wires from the FX3S terminals (X inputs, Y outputs) to the parts' terminals.
   The soft PLC drives the outputs, the parts move, and their sensors are fed back into the X inputs.
   Nothing is wired by default: every X is a plain switch and every Y a plain lamp until the learner wires it.
   The bench (parts + wires) is turned into a wiring map W that the simulation uses:
   a device kind ("red", "conv"), a part of another Y's device ("doorDn:Y000" = the down coil of the shutter on Y0),
   or a sensor of a device ("conv:Y004" = the photo sensor at the end of the conveyor on Y4). */
const Kit = (() => {
  const OUT = {
    red: ["紅燈", "紅燈"], green: ["綠燈", "綠燈"], yellow: ["黃燈", "黃燈"], buzzer: ["蜂鳴器", "蜂鳴"],
    motor: ["馬達（風扇）", "馬達"], cyl: ["氣缸（單動，彈簧復歸）", "氣缸"], conv: ["輸送帶", "輸送"],
    door: ["鐵捲門", "鐵門"], tank: ["水槽", "水槽"], heat: ["加熱器", "加熱"],
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
  /* the terminals on each part: [port, X or Y, label]. "main" is the device's own coil (or the button's contact) */
  const PORTS = {
    red: [["main", "Y", "線圈"]], green: [["main", "Y", "線圈"]], yellow: [["main", "Y", "線圈"]], buzzer: [["main", "Y", "線圈"]],
    motor: [["main", "Y", "馬達"]], seg: [["main", "Y", "BCD 起點"]],
    cyl: [["main", "Y", "電磁閥"], ["cylF", "X", "前限"], ["cylB", "X", "後限"]],
    conv: [["main", "Y", "馬達"], ["push", "Y", "推料"], ["conv", "X", "末端光電"], ["convM", "X", "金屬"], ["convP", "X", "推料位"], ["pushF", "X", "推到底"]],
    door: [["main", "Y", "上升"], ["doorDn", "Y", "下降"], ["doorU", "X", "上限"], ["doorL", "X", "下限"]],
    tank: [["main", "Y", "進水"], ["tankOut", "Y", "排水"], ["tankH", "X", "高液位"], ["tankL", "X", "低液位"]],
    heat: [["main", "Y", "加熱"], ["heatT", "X", "溫度"]],
    nopb: [["main", "X", "常開"]], ncpb: [["main", "X", "常閉"]], switch: [["main", "X", "接點"]],
  };
  const PNAME = Object.assign({}, ...Object.keys(OUT).map((k) => ({ [k]: OUT[k][1] })), { red: "紅燈", green: "綠燈", yellow: "黃燈", buzzer: "蜂鳴器", motor: "馬達", cyl: "氣缸", conv: "輸送帶", door: "鐵捲門", heat: "加熱器", seg: "七段顯示器", nopb: "按鈕", ncpb: "急停", switch: "切換開關" });
  const WIDTH = { cyl: 250, conv: 330, door: 170, tank: 170, heat: 170, nopb: 92, ncpb: 92, switch: 92 };
  const HEIGHT = { cyl: 150, conv: 230, door: 190, tank: 190, heat: 180, nopb: 120, ncpb: 120, switch: 120 };
  const PALETTE = ["red", "green", "yellow", "buzzer", "motor", "cyl", "conv", "door", "tank", "heat", "seg", "nopb", "ncpb", "switch"];
  const AT = { conv: 0.85, convM: 0.3, convP: 0.5 }, PUSH_AT = 0.5, BOX = 0.075, BELT = 270;
  const short = (d) => d ? d[0] + d.slice(1).replace(/^0+(?=\d)/, "") : "?";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const base = (k) => String(k || "").split(":")[0];
  const yAdd = (y, i) => "Y" + (parseInt(y.slice(1), 8) + i).toString(8).padStart(3, "0");

  let W = {}, pressed = {}, sim = {}, el = null, opt = null, xs = [], ys = [], outs = {}, ins = {}, mute = false, audio = null;
  let parts = [], wires = {}, nid = 1, msg = "", pick = null, ro = null;   // wires: terminal -> "partId.port"

  /* ---------- bench model -> wiring map ---------- */
  const termOf = (pp) => Object.keys(wires).find((t) => wires[t] === pp) || "";
  function derive() {
    const w = {};
    parts.forEach((p) => {
      const main = termOf(p.id + ".main");
      if (IN[p.k]) { if (main) w[main] = p.k; return; }
      if (main) w[main] = p.k;
      PORTS[p.k].slice(1).forEach(([port]) => {
        const t = termOf(p.id + "." + port); if (!t) return;
        if (port === "pushF") w[t] = "pushF:" + termOf(p.id + ".push");
        else w[t] = port + ":" + main;
      });
    });
    return w;
  }
  function place(k, taken, width) {              // first free spot on the bench for a new part
    const w = WIDTH[k] || 124, h = HEIGHT[k] || 160, maxX = Math.max(w + 10, width - w - 6);
    for (let y = 8; y < 4000; y += 16)
      for (let x = 8; x <= maxX; x += 16)
        if (!taken.some((r) => x < r.x + r.w + 8 && x + w + 8 > r.x && y < r.y + r.h + 8 && y + h + 8 > r.y)) return { x, y };
    return { x: 8, y: 8 };
  }
  const rects = () => parts.map((p) => ({ x: p.x, y: p.y, w: WIDTH[p.k] || 124, h: HEIGHT[p.k] || 160 }));
  const benchWidth = () => { const a = el && el.querySelector(".kb-area"); return (a && a.clientWidth) || (el && el.clientWidth) || 680; };
  function addPart(k, at) {
    const p = Object.assign({ id: "p" + nid++, k }, at || place(k, rects(), benchWidth()));
    parts.push(p);
    return p;
  }
  /* turn an old wiring map (presets, earlier saves) into parts on the bench, laid out in order */
  function fromW(w) {
    parts = []; wires = {}; nid = 1;
    const width = benchWidth(), owner = {};
    ys.forEach((y) => { if (OUT[w[y]]) { const p = addPart(w[y]); wires[y] = p.id + ".main"; owner[y] = p; } });
    ys.forEach((y) => { const [s, m] = String(w[y] || "").split(":"); if (SUB[s] && owner[m]) { wires[y] = owner[m].id + "." + s; owner[y] = owner[m]; } });
    xs.forEach((x) => {
      const k = w[x]; if (!k) return;
      if (IN[k]) { const p = addPart(k); wires[x] = p.id + ".main"; return; }
      const [s, m] = k.split(":");
      if (SENS[s] && owner[m]) wires[x] = owner[m].id + "." + s;
    });
    const taken = []; parts.forEach((p) => { Object.assign(p, place(p.k, taken, width)); taken.push({ x: p.x, y: p.y, w: WIDTH[p.k] || 124, h: HEIGHT[p.k] || 160 }); });
  }
  function load() {
    try {
      const b = JSON.parse(localStorage.getItem("ll_kit2") || "null");
      if (b && Array.isArray(b.parts)) { parts = b.parts.filter((p) => PORTS[p.k]); wires = b.wires || {}; nid = b.nid || parts.length + 1; W = derive(); return; }
    } catch (e) { /* bad save */ }
    let old = {};
    try { old = JSON.parse(localStorage.getItem("ll_kit") || "{}") || {}; } catch (e) { old = {}; }
    fromW(old); W = derive();
  }
  function save() { try { localStorage.setItem("ll_kit2", JSON.stringify({ parts, wires, nid })); localStorage.setItem("ll_kit", JSON.stringify(W)); } catch (e) { /* private mode */ } }

  const kindOf = (dev) => W[dev] || (dev[0] === "X" ? "switch" : "");
  function link(kind) {                           // sensor "conv:Y004" -> ["conv", "Y004"] when Y4 really is a conveyor
    const [s, y] = String(kind).split(":");
    return SENS[s] && y && (SENS_OF[base(W[y])] || []).includes(s) ? [s, y] : null;
  }
  function subLink(kind) {                        // "doorDn:Y000" -> ["doorDn", "Y000"] when Y0 really is a shutter
    const [s, y] = String(kind).split(":");
    return SUB[s] && y && base(W[y]) === SUB[s][2] ? [s, y] : null;
  }
  const subsOf = (y, s) => y ? ys.filter((d) => W[d] === s + ":" + y) : [];
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
      return k ? "（裝置的主線圈還沒接）" : "";
    }
    if (IN[k]) return W[dev] ? IN[k][0] : "";
    const l = link(k);
    return l ? `${short(l[1])} ${devName(l[1])}的${SENS[l[0]][0]}` : "（感測器所在的裝置還沒接 Y）";
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
  function press(dev, on) { if (dev) pressed[dev] = !!on; }

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

  /* ---------- drawing the parts ---------- */
  const sensorsOf = (y) => y ? xs.filter((x) => link(W[x]) && link(W[x])[1] === y).map((x) => [x, link(W[x])[0]]) : [];
  const sensMark = (x, cx, cy) => `<g class="k-sens" data-x="${x}"><rect x="${cx - 7}" y="${cy - 4}" width="14" height="8" rx="2"/><text x="${cx}" y="${cy - 7}">${short(x)}</text></g>`;
  const SEG = { a: "M14 8h22", b: "M38 10v20", c: "M38 36v20", d: "M14 58h22", e: "M12 36v20", f: "M12 10v20", g: "M14 33h22" };
  const DIG = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];
  /* the picture of a device; y is the Y its main coil is wired to ("" when not wired yet) */
  function card(y, k) {
    const dy = y ? ` data-y="${y}"` : "";
    if (k === "red" || k === "green" || k === "yellow")
      return `<div class="k-card"${dy}><svg viewBox="0 0 90 92"><rect class="k-base" x="31" y="66" width="28" height="18" rx="3"/><circle class="k-lamp k-${k}" cx="45" cy="38" r="25"/><circle class="k-shine" cx="37" cy="29" r="6"/></svg></div>`;
    if (k === "buzzer")
      return `<div class="k-card"${dy}><svg viewBox="0 0 90 92"><path class="k-wave" d="M66 26q8 12 0 24M74 20q13 18 0 36M24 26q-8 12 0 24M16 20q-13 18 0 36"/><circle class="k-buz" cx="45" cy="38" r="22"/><circle class="k-buzhole" cx="45" cy="38" r="5"/><rect class="k-base" x="31" y="66" width="28" height="18" rx="3"/></svg></div>`;
    if (k === "motor")
      return `<div class="k-card"${dy}><svg viewBox="0 0 90 92"><circle class="k-mbody" cx="45" cy="40" r="30"/><g class="k-fan"><path d="M45 40 L45 14 A12 12 0 0 1 55 30Z M45 40 L68 53 A12 12 0 0 1 52 60Z M45 40 L22 53 A12 12 0 0 1 28 32Z"/></g><circle class="k-hub" cx="45" cy="40" r="5"/><rect class="k-base" x="31" y="72" width="28" height="12" rx="3"/></svg></div>`;
    if (k === "cyl") {
      const s = sensorsOf(y).map(([x, t]) => sensMark(x, t === "cylF" ? 79 : 19, 26)).join("");
      return `<div class="k-card"${dy}><svg viewBox="0 0 230 92"><rect class="k-cylbody" x="10" y="30" width="112" height="32" rx="4"/><rect class="k-piston" x="14" y="33" width="10" height="26"/><rect class="k-rod" x="24" y="41" width="118" height="10"/><rect class="k-head" x="142" y="34" width="10" height="24" rx="2"/>${s}<path class="k-air" d="M30 70v10h-14"/><text class="k-small" x="40" y="86">電磁閥 ON：伸出</text></svg></div>`;
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
      return `<div class="k-card"${dy}><svg viewBox="0 0 300 118"><rect class="k-belt" x="4" y="50" width="${BELT + 14}" height="16" rx="8"/><path class="k-stripe" d="M12 58H${BELT + 10}"/><circle class="k-roll" cx="12" cy="58" r="6"/><circle class="k-roll" cx="${BELT + 10}" cy="58" r="6"/><g class="k-boxes"></g>${push}${s}<rect class="k-bin" x="${BELT - 2}" y="96" width="30" height="18" rx="2"/><text class="k-small k-done" x="${BELT + 13}" y="109" text-anchor="middle"></text></svg>` +
        (y ? `<p><button type="button" class="small-btn" data-add="${y}" data-m="1">放金屬</button> <button type="button" class="small-btn" data-add="${y}" data-m="0">放塑膠</button> <button type="button" class="small-btn" data-take="${y}">拿走</button></p>` : "") + `</div>`;
    }
    if (k === "door") {
      const dn = subsOf(y, "doorDn")[0], s = sensorsOf(y).map(([x, t]) => sensMark(x, 110, t === "doorU" ? 26 : 82)).join("");
      return `<div class="k-card"${dy}><svg viewBox="0 0 130 100"><rect class="k-frame" x="18" y="14" width="80" height="74"/><rect class="k-mbody" x="14" y="4" width="88" height="12" rx="2"/><text class="k-motor-t" x="58" y="13" text-anchor="middle">${y ? "▲ " + short(y) : "▲"}${dn ? "　▼ " + short(dn) : ""}</text><g class="k-slats"></g><path class="k-floor" d="M8 88H122"/>${s}<text class="k-warn" x="58" y="56" text-anchor="middle"></text></svg></div>`;
    }
    if (k === "tank") {
      const out = subsOf(y, "tankOut")[0], s = sensorsOf(y).map(([x, t]) => sensMark(x, 104, t === "tankH" ? 33 : 73)).join("");
      return `<div class="k-card"${dy}><svg viewBox="0 0 130 104"><path class="k-pipe" d="M4 8H40V18"/><rect class="k-valve vin" x="18" y="3" width="10" height="10" rx="2"/><text class="k-small" x="23" y="25" text-anchor="middle">${y ? short(y) : ""}</text>` +
        `<rect class="k-tank" x="30" y="18" width="60" height="70" rx="3"/><rect class="k-water" x="31" y="87" width="58" height="0"/><path class="k-mark" d="M88 33h8M88 73h8"/>${s}` +
        `<path class="k-pipe" d="M60 88V96H124"/><rect class="k-valve vout" x="98" y="91" width="10" height="10" rx="2"/>${out ? `<text class="k-small" x="114" y="89">${short(out)}</text>` : ""}` +
        `<text class="k-lv" x="60" y="56" text-anchor="middle"></text></svg></div>`;
    }
    if (k === "heat") {
      const s = sensorsOf(y).map(([x]) => sensMark(x, 112, 70)).join("");
      return `<div class="k-card"${dy}><svg viewBox="0 0 130 100"><rect class="k-oven" x="8" y="10" width="80" height="74" rx="4"/><path class="k-coil" d="M16 66l8-10 8 10 8-10 8 10 8-10 8 10 8-10 8 10"/><text class="k-temp" x="48" y="38" text-anchor="middle"></text><rect class="k-therm" x="98" y="14" width="6" height="44" rx="3"/><rect class="k-merc" x="99" y="57" width="4" height="0"/>${s}</svg></div>`;
    }
    if (k === "seg")
      return `<div class="k-card"${dy}><svg viewBox="0 0 90 92"><rect class="k-segbg" x="12" y="2" width="66" height="70" rx="4"/><g transform="translate(20 4)">${Object.keys(SEG).map((g) => `<path class="k-seg" data-g="${g}" d="${SEG[g]}"/>`).join("")}</g><text class="k-small" x="45" y="86" text-anchor="middle">${y ? short(y) + "～" + short(yAdd(y, 3)) : "佔連續 4 個 Y"}</text></svg></div>`;
    if (k === "nopb" || k === "ncpb")
      return `<div class="k-card"><button type="button" class="k-pb k-${k}" data-x="${y}" title="${esc(IN[k][0])}"><span></span><small>${k === "nopb" ? "按住" : "平常 ON"}</small></button></div>`;
    if (k === "switch")
      return `<div class="k-card"><button type="button" class="k-sw" data-x="${y}" title="點一下切換 ON／OFF"><span></span><small>OFF</small></button></div>`;
    return "";
  }
  function partHtml(p) {
    const main = termOf(p.id + ".main");
    const ports = PORTS[p.k].map(([port, ty, lab]) => {
      const t = termOf(p.id + "." + port);
      return `<span class="kb-port ${ty}${t ? " used" : ""}" data-port="${p.id}.${port}" data-ty="${ty}" title="${ty === "Y" ? "從 PLC 的 Y 端子拉線到這裡" : "從 PLC 的 X 端子拉線到這裡"}"><i></i>${lab}${t ? `<b>${short(t)}</b>` : ""}</span>`;
    }).join("");
    const hint = !main ? `<p class="kb-hint">${PORTS[p.k][0][1] === "Y" ? "把一個 Y 端子拉線到「" + PORTS[p.k][0][2] + "」" : "把一個 X 端子拉線到「" + PORTS[p.k][0][2] + "」"}</p>` : "";
    return `<div class="kb-part${main ? "" : " idle"}" data-id="${p.id}" data-k="${p.k}" style="left:${p.x}px;top:${p.y}px;width:${WIDTH[p.k] || 124}px">` +
      `<div class="kb-ports">${ports}</div><div class="kb-head"><span>${esc(PNAME[p.k])}${main && p.k !== "seg" ? " " + short(main) : ""}</span><button type="button" class="kb-rm" data-rm="${p.id}" title="拿掉這個零件">×</button></div>` +
      card(main, p.k) + hint + `</div>`;
  }
  function render() {
    if (!el) return;
    const segUse = {}; Object.keys(wires).forEach((t) => { if (wires[t].endsWith(".main") && (parts.find((p) => p.id === wires[t].split(".")[0]) || {}).k === "seg") for (let i = 1; i < 4; i++) segUse[yAdd(t, i)] = t; });
    const term = (t) => `<span class="kb-term ${t[0]}${wires[t] || segUse[t] ? " used" : ""}" data-t="${t}" title="${esc(label(t) || (t[0] === "X" ? "輸入端子（沒接線時是切換開關）" : "輸出端子（沒接線時只亮 PLC 上的燈）"))}"><b>${short(t)}</b><i></i></span>`;
    const rows = xs.concat(ys).filter((d) => W[d] || segUse[d]).map((d) => `<tr><td><b>${short(d)}</b></td><td>${esc(label(d))}</td><td>${wires[d] ? `<button type="button" class="small-btn" data-cut="${d}">拆線</button>` : ""}</td></tr>`).join("");
    el.innerHTML = `<div class="kb-pal"><span class="hint">零件（拖到下面的組裝台，或點一下放上去）：</span>${PALETTE.map((k) => `<button type="button" class="kb-pi" data-k="${k}">${esc(PNAME[k])}</button>`).join("")}</div>` +
      `<div class="kb-bench"><div class="kb-plc"><div class="kb-row"><span class="kb-rl">FX3S<br>輸入</span>${xs.map(term).join("")}</div><div class="kb-row"><span class="kb-rl">輸出</span>${ys.map(term).join("")}</div></div>` +
      `<svg class="kb-wires"></svg><div class="kb-area">${parts.map(partHtml).join("") || '<p class="hint kb-empty">組裝台是空的：從上面把零件拖進來，再從 PLC 的端子（X 藍、Y 橘）拉線到零件的端子。X 沒接線時是切換開關，Y 沒接線時只亮 PLC 面板上的燈。也可以從下面「範例機構」載入一組。</p>'}</div></div>` +
      `<p class="kb-msg${msg ? " show" : ""}">${esc(msg || "拉線：按住端子拖到另一頭放開，或點一下端子再點另一頭。點一下線可以拆掉。")}</p>` +
      `<div class="k-add"><select class="k-preset">${PRESETS.map((p, i) => `<option value="${i}">${esc(p.title)}</option>`).join("")}</select><button type="button" class="small-btn" data-preset>載入範例機構（零件、接線和程式）</button></div>` +
      `<div class="k-add"><button type="button" class="small-btn" data-reset>機構歸位</button><button type="button" class="small-btn" data-clear>全部清空</button><label class="check small"><input type="checkbox" data-mute ${mute ? "checked" : ""}> 蜂鳴器靜音</label></div>` +
      `<details class="k-wire"><summary>接線表（${rows ? "目前接了哪些端子" : "還沒接線"}）</summary>${rows ? `<table class="k-table"><tbody>${rows}</tbody></table>` : ""}</details>`;
    msg = "";
    fitArea();
    el.querySelector("[data-clear]").onclick = () => { parts = []; wires = {}; sim = {}; commit(); };
    el.querySelector("[data-reset]").onclick = () => { sim = {}; };
    el.querySelector("[data-preset]").onclick = () => preset(+el.querySelector(".k-preset").value);
    el.querySelector("[data-mute]").onchange = (e) => { mute = e.target.checked; if (mute) buzz(false); };
    el.querySelectorAll("[data-cut]").forEach((b) => (b.onclick = () => { delete wires[b.dataset.cut]; commit(); }));
    el.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => removePart(b.dataset.rm)));
    el.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => { const s = stateOf(b.dataset.add); if (!s.boxes.some((x) => x.p < BOX + 0.04)) s.boxes.push({ p: 0, m: b.dataset.m === "1" }); }));
    el.querySelectorAll("[data-take]").forEach((b) => (b.onclick = () => { const s = stateOf(b.dataset.take); if (s.boxes.length) { const far = Math.max(...s.boxes.map((x) => x.p)); s.boxes = s.boxes.filter((x) => x.p !== far); } }));
    el.querySelectorAll(".k-pb").forEach((b) => {
      const x = b.dataset.x;
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); press(x, true); try { b.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } });
      const up = () => press(x, false);
      b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
    });
    el.querySelectorAll(".k-sw").forEach((b) => (b.onclick = () => { if (b.dataset.x && opt && opt.onToggle) opt.onToggle(b.dataset.x); }));
    el.querySelectorAll(".kb-pi").forEach((b) => b.addEventListener("pointerdown", (e) => paletteDown(e, b.dataset.k)));
    el.querySelector(".kb-bench").addEventListener("pointerdown", benchDown);
    if (window.ResizeObserver) { if (ro) ro.disconnect(); ro = new ResizeObserver(() => drawWires()); ro.observe(el.querySelector(".kb-bench")); }
    drawWires();
    if (pick) { const n = el.querySelector(pick.sel); if (n) n.classList.add("pick"); else pick = null; }
  }
  function fitArea() {                            // the bench grows to hold every part
    const area = el && el.querySelector(".kb-area"); if (!area) return;
    area.style.height = Math.max(240, ...[...area.querySelectorAll(".kb-part")].map((n) => n.offsetTop + n.offsetHeight + 16)) + "px";
  }
  /* ---------- wires ---------- */
  function centre(node, box) { const r = node.querySelector("i").getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; }
  const curve = (a, b) => { const d = Math.max(30, Math.abs(b[1] - a[1]) / 2); return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}C${a[0].toFixed(1)} ${(a[1] + d).toFixed(1)} ${b[0].toFixed(1)} ${(b[1] - d).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`; };
  function drawWires() {
    if (!el) return;
    const bench = el.querySelector(".kb-bench"), svg = el.querySelector(".kb-wires"); if (!bench || !svg) return;
    const box = bench.getBoundingClientRect();
    svg.setAttribute("width", bench.scrollWidth); svg.setAttribute("height", bench.scrollHeight);
    let out = "";
    Object.keys(wires).forEach((t) => {
      const tn = bench.querySelector(`.kb-term[data-t="${t}"]`), pn = bench.querySelector(`.kb-port[data-port="${wires[t]}"]`);
      if (!tn || !pn) return;
      const p = centre(pn, box), list = [t];
      if (W[t] === "seg") for (let i = 1; i < 4; i++) list.push(yAdd(t, i));
      list.forEach((d, i) => {
        const n = bench.querySelector(`.kb-term[data-t="${d}"]`); if (!n) return;
        out += `<path class="kb-w ${t[0]}" data-t="${d}" data-cut="${t}" d="${curve(centre(n, box), [p[0] + i * 3, p[1]])}"><title>${short(d)} → ${esc(PNAME[base(W[t])] || "")}（點一下拆掉）</title></path>`;
      });
    });
    svg.innerHTML = out + `<path class="kb-pend" d=""/>`;
    svg.querySelectorAll(".kb-w").forEach((w) => w.addEventListener("click", () => { delete wires[w.dataset.cut]; msg = `拆掉了 ${short(w.dataset.cut)} 的線`; commit(); }));
    paint();
  }
  function connect(a, b) {                        // a, b: {t} terminal or {port, ty} part terminal, in either order
    const t = a.t || b.t, pp = a.port || b.port, ty = a.ty || b.ty;
    if (!t || !pp) { msg = "線要一頭接 PLC 的端子、一頭接零件的端子。"; return render(); }
    if (t[0] !== ty) { msg = ty === "Y" ? `${short(t)} 是輸入端子，裝置的線圈要接 Y（輸出）。` : `${short(t)} 是輸出端子，感測器和按鈕要接 X（輸入）。`; return render(); }
    const [pid, port] = pp.split("."), part = parts.find((p) => p.id === pid);
    for (const s of Object.keys(wires)) {
      const sp = parts.find((p) => p.id === wires[s].split(".")[0]);
      if (sp && sp.k === "seg" && wires[s].endsWith(".main") && wires[s] !== pp) for (let i = 1; i < 4; i++) if (yAdd(s, i) === t) { msg = `${short(t)} 已經給 ${short(s)} 的七段顯示器用了（佔 ${short(s)}～${short(yAdd(s, 3))}）。`; return render(); }
    }
    if (part && part.k === "seg" && port === "main") {
      for (let i = 1; i < 4; i++) {
        const d = yAdd(t, i);
        if (!ys.includes(d)) { msg = `七段顯示器要連續 4 個 Y，從 ${short(t)} 開始不夠。`; return render(); }
        if (wires[d]) { msg = `七段顯示器從 ${short(t)} 開始要佔到 ${short(yAdd(t, 3))}，但 ${short(d)} 已經接了別的東西。`; return render(); }
      }
    }
    Object.keys(wires).forEach((s) => { if (wires[s] === pp) delete wires[s]; });
    const was = wires[t]; wires[t] = pp;
    msg = `${short(t)} 接到 ${PNAME[part.k]}的「${PORTS[part.k].find((r) => r[0] === port)[2]}」` + (was && was !== pp ? "（原本那條線拆掉了）" : "");
    commit();
  }
  function removePart(id) {
    parts = parts.filter((p) => p.id !== id);
    Object.keys(wires).forEach((t) => { if (wires[t].split(".")[0] === id) delete wires[t]; });
    commit();
  }
  function commit() { pick = null; W = derive(); changed(); }

  /* ---------- pointer handling: drag parts, draw wires ---------- */
  function endOf(node) {
    if (!node) return null;
    const t = node.closest(".kb-term"); if (t) return { t: t.dataset.t, sel: `.kb-term[data-t="${t.dataset.t}"]` };
    const p = node.closest(".kb-port"); if (p) return { port: p.dataset.port, ty: p.dataset.ty, sel: `.kb-port[data-port="${p.dataset.port}"]` };
    return null;
  }
  function track(e, move, up) {
    const mv = (ev) => move(ev), u = (ev) => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", u); window.removeEventListener("pointercancel", u); up(ev); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", u); window.addEventListener("pointercancel", u);
  }
  function benchDown(e) {
    if (e.button > 0) return;
    const end = endOf(e.target);
    if (end) {
      e.preventDefault();
      const bench = el.querySelector(".kb-bench"), box = bench.getBoundingClientRect(), from = centre(e.target.closest(".kb-term,.kb-port"), box);
      const pend = el.querySelector(".kb-pend"), x0 = e.clientX, y0 = e.clientY;
      let moved = false;
      track(e, (ev) => {
        if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 6) moved = true;
        if (moved && pend) { const b = bench.getBoundingClientRect(); pend.setAttribute("d", curve(from, [ev.clientX - b.left, ev.clientY - b.top])); }
      }, (ev) => {
        if (pend) pend.setAttribute("d", "");
        if (moved) { const to = endOf(document.elementFromPoint(ev.clientX, ev.clientY)); if (to && to.sel !== end.sel) connect(end, to); return; }
        if (pick && pick.sel !== end.sel) { const a = pick; pick = null; el.querySelectorAll(".pick").forEach((n) => n.classList.remove("pick")); connect(a, end); return; }
        el.querySelectorAll(".pick").forEach((n) => n.classList.remove("pick"));
        if (pick && pick.sel === end.sel) { pick = null; return; }
        pick = end; e.target.closest(".kb-term,.kb-port").classList.add("pick");
        const n = el.querySelector(".kb-msg"); if (n) { n.textContent = end.t ? `選了 ${short(end.t)}，再點零件上的端子接上去。` : "選了零件的端子，再點 PLC 上的端子接上去。"; n.classList.add("show"); }
      });
      return;
    }
    const part = e.target.closest(".kb-part");
    if (!part || e.target.closest("button,select,input,.k-pb,.k-sw")) return;
    e.preventDefault();
    dragPart(part.dataset.id, e);
  }
  function dragPart(id, e) {
    const p = parts.find((q) => q.id === id), node = el.querySelector(`.kb-part[data-id="${id}"]`), area = el.querySelector(".kb-area");
    if (!p || !node) return;
    const dx = e.clientX - node.getBoundingClientRect().left, dy = e.clientY - node.getBoundingClientRect().top;
    node.classList.add("drag");
    track(e, (ev) => {
      const r = area.getBoundingClientRect();
      p.x = Math.round(Math.max(0, Math.min(r.width - node.offsetWidth, ev.clientX - r.left - dx)));
      p.y = Math.round(Math.max(0, ev.clientY - r.top - dy));
      node.style.left = p.x + "px"; node.style.top = p.y + "px";
      const need = p.y + node.offsetHeight + 16; if (need > area.offsetHeight) area.style.height = need + "px";
      drawWires();
    }, () => { node.classList.remove("drag"); save(); fitArea(); drawWires(); });
  }
  function paletteDown(e, k) {
    if (e.button > 0) return;
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY;
    let made = null;
    track(e, (ev) => {
      if (!made && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 6) {
        const r = el.querySelector(".kb-area").getBoundingClientRect();
        made = addPart(k, { x: Math.max(0, Math.round(ev.clientX - r.left - 40)), y: Math.max(0, Math.round(ev.clientY - r.top - 10)) });
        render();
        const node = el.querySelector(`.kb-part[data-id="${made.id}"]`);
        if (node) dragPart(made.id, { clientX: node.getBoundingClientRect().left + 40, clientY: node.getBoundingClientRect().top + 10 });
      }
    }, () => {
      if (!made) { made = addPart(k); msg = `放了一個${PNAME[k]}，接著從 PLC 端子拉線到它的「${PORTS[k][0][2]}」。`; }
      commit();
    });
  }

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
    fromW(p.W); W = derive(); sim = {}; p.init(); pick = null;
    changed(true);
    if (opt && opt.onPreset) opt.onPreset(p.il.join("\n"), p.note);
  }

  /* colour the wires, terminals and part terminals that carry a signal */
  function paint() {
    if (!el) return;
    const live = (t) => t[0] === "X" ? !!ins[t] : on(t);
    el.querySelectorAll(".kb-w").forEach((w) => w.classList.toggle("on", live(w.dataset.t)));
    el.querySelectorAll(".kb-term").forEach((n) => n.classList.toggle("on", live(n.dataset.t)));
    el.querySelectorAll(".kb-port.used").forEach((n) => { const t = termOf(n.dataset.port); n.classList.toggle("on", !!t && live(t)); });
  }
  function update(st) {
    if (!el || !st) return;
    ins = st.inputs || {};
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
        const out = subsOf(y, "tankOut")[0]; q(".vout").classList.toggle("open", on(out));
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
    el.querySelectorAll(".k-sens").forEach((g) => g.classList.toggle("on", !!ins[g.dataset.x]));
    el.querySelectorAll(".k-pb").forEach((b) => b.classList.toggle("down", !!pressed[b.dataset.x]));
    el.querySelectorAll(".k-sw").forEach((b) => { const v = !!ins[b.dataset.x]; b.classList.toggle("on", v); b.querySelector("small").textContent = v ? "ON" : "OFF"; });
    paint();
  }

  /* target: where the bench is drawn; o: {xs, ys, onChange, onPreset, onReset, onToggle} */
  let resize = null;
  function mount(target, o) {
    el = target; opt = o; xs = o.xs; ys = o.ys; load(); render(); before = {}; xs.forEach((x) => { before[x] = kindOf(x); });
    if (!resize) { resize = () => drawWires(); window.addEventListener("resize", resize); }
  }
  function unmount() { if (el) el.innerHTML = ""; el = null; buzz(false); }
  return { mount, unmount, step, update, label, tag, inputKind, press, kindOf, PRESETS, redraw: drawWires };
})();
