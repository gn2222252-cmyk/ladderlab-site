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
    arm: ["夾爪取放機構（橫移線圈）", "夾爪"], suck: ["吸盤取放機構（橫移線圈）", "吸盤"], feed: ["供料器（推料氣缸）", "供料"],
    tower: ["塔燈（紅燈）", "塔燈"], cyl2: ["雙動氣缸（伸出線圈）", "雙動"], lift: ["三層電梯（上升線圈）", "電梯"], rot: ["分度盤（旋轉馬達）", "分度"],
  };
  const SUB = {                                   // a Y that is part of the device on another Y: [name, short, parent kind]
    doorDn: ["下降線圈", "下降", "door"], tankOut: ["排水閥", "排水", "tank"], push: ["推料氣缸", "推料", "conv"],
    armZ: ["下降氣缸", "下降", ["arm", "suck"]], armG: ["夾爪／吸盤閥", "夾吸", ["arm", "suck"]],
    cylR: ["縮回線圈", "縮回", "cyl2"], liftDn: ["下降線圈", "下降", "lift"],
    twY: ["黃燈", "塔黃", "tower"], twG: ["綠燈", "塔綠", "tower"], twB: ["蜂鳴器", "塔鳴", "tower"],
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
    armL: ["取料位感測器", "取料位"], armR: ["放料位感測器", "放料位"], armU: ["上限感測器", "上限"], armD: ["下限感測器", "下限"],
    armH: ["夾到／吸到工件感測器", "夾到"], feedE: ["料倉有料感測器", "有料"], feedF: ["推到底感測器", "推到底"],
    liftA: ["1 樓位置感測器", "1F"], liftB: ["2 樓位置感測器", "2F"], liftC: ["3 樓位置感測器", "3F"],
    rotP: ["定位感測器（每轉 90° ON）", "定位"], rotO: ["原點感測器（0° ON）", "原點"],
  };
  const SENS_OF = { cyl: ["cylF", "cylB"], conv: ["conv", "convM", "convP"], push: ["pushF"], door: ["doorU", "doorL"], tank: ["tankH", "tankL"], heat: ["heatT"],
    arm: ["armL", "armR", "armU", "armD", "armH"], suck: ["armL", "armR", "armU", "armD", "armH"], feed: ["feedE", "feedF"],
    cyl2: ["cylF", "cylB"], lift: ["liftA", "liftB", "liftC"], rot: ["rotP", "rotO"] };
  const RANGE4 = { seg: "七段顯示器", dial: "指撥開關" };   // devices that take four terminals in a row (BCD)
  const ARMP = (g, h) => [["main", "Y", "橫移"], ["armZ", "Y", "下降"], ["armG", "Y", g], ["armL", "X", "取料位"], ["armR", "X", "放料位"], ["armU", "X", "上限"], ["armD", "X", "下限"], ["armH", "X", h], ["pick", "Mi", "取料"], ["place", "Mo", "放料"]];
  /* the terminals on each part: [port, X or Y, label]. "main" is the device's own coil (or the button's contact).
     Mi / Mo are material ports, not wires: where a workpiece comes in (Mi) or goes out (Mo). Linking a conveyor's outlet
     to a gripper's pick side and the gripper's place side back to the conveyor's inlet closes the loop. */
  const PORTS = {
    red: [["main", "Y", "線圈"]], green: [["main", "Y", "線圈"]], yellow: [["main", "Y", "線圈"]], buzzer: [["main", "Y", "線圈"]],
    motor: [["main", "Y", "馬達"]], seg: [["main", "Y", "BCD 起點"]],
    cyl: [["main", "Y", "電磁閥"], ["cylF", "X", "前限"], ["cylB", "X", "後限"]],
    conv: [["main", "Y", "馬達"], ["push", "Y", "推料"], ["conv", "X", "末端光電"], ["convM", "X", "金屬"], ["convP", "X", "推料位"], ["pushF", "X", "推到底"], ["in", "Mi", "入口"], ["out", "Mo", "出口"]],
    arm: ARMP("夾爪", "夾到"), suck: ARMP("吸盤", "真空"),
    feed: [["main", "Y", "推料"], ["feedE", "X", "有料"], ["feedF", "X", "推到底"], ["out", "Mo", "出口"]],
    bin: [["in", "Mi", "入口"]],
    tower: [["main", "Y", "紅"], ["twY", "Y", "黃"], ["twG", "Y", "綠"], ["twB", "Y", "蜂鳴"]],
    cyl2: [["main", "Y", "伸出"], ["cylR", "Y", "縮回"], ["cylF", "X", "前限"], ["cylB", "X", "後限"]],
    lift: [["main", "Y", "上升"], ["liftDn", "Y", "下降"], ["liftA", "X", "1F"], ["liftB", "X", "2F"], ["liftC", "X", "3F"]],
    rot: [["main", "Y", "旋轉"], ["rotP", "X", "定位"], ["rotO", "X", "原點"]],
    dial: [["main", "X", "BCD 起點"]],
    door: [["main", "Y", "上升"], ["doorDn", "Y", "下降"], ["doorU", "X", "上限"], ["doorL", "X", "下限"]],
    tank: [["main", "Y", "進水"], ["tankOut", "Y", "排水"], ["tankH", "X", "高液位"], ["tankL", "X", "低液位"]],
    heat: [["main", "Y", "加熱"], ["heatT", "X", "溫度"]],
    nopb: [["main", "X", "常開"]], ncpb: [["main", "X", "常閉"]], switch: [["main", "X", "接點"]],
  };
  const PNAME = Object.assign({}, ...Object.keys(OUT).map((k) => ({ [k]: OUT[k][1] })), { red: "紅燈", green: "綠燈", yellow: "黃燈", buzzer: "蜂鳴器", motor: "馬達", cyl: "氣缸", conv: "輸送帶", door: "鐵捲門", heat: "加熱器", seg: "七段顯示器", nopb: "按鈕", ncpb: "急停", switch: "切換開關", arm: "夾爪取放", suck: "吸盤取放", feed: "供料器", bin: "料盒", tower: "塔燈", cyl2: "雙動氣缸", lift: "三層電梯", rot: "分度盤", dial: "指撥開關" });
  const WIDTH = { cyl: 250, conv: 330, door: 170, tank: 170, heat: 170, nopb: 92, ncpb: 92, switch: 92, arm: 230, suck: 230, feed: 160, bin: 130, tower: 110, cyl2: 250, lift: 150, rot: 150, dial: 124 };
  const HEIGHT = { cyl: 150, conv: 260, door: 190, tank: 190, heat: 180, nopb: 120, ncpb: 120, switch: 120, arm: 260, suck: 260, feed: 220, bin: 150, tower: 190, cyl2: 160, lift: 230, rot: 190, dial: 130 };
  const PALETTE = ["red", "green", "yellow", "buzzer", "motor", "cyl", "tower", "cyl2", "conv", "feed", "arm", "suck", "bin", "rot", "lift", "door", "tank", "heat", "seg", "dial", "nopb", "ncpb", "switch"];
  const STOP_AT = 0.88, PICK_FROM = 0.78;          // conveyor stopper (box centre) when something picks at its outlet
  const AT = { conv: 0.85, convM: 0.3, convP: 0.5 }, PUSH_AT = 0.5, BOX = 0.075, BELT = 270;
  let names = {}, lastPreset = 0;                                  // terminals shown by another name (expansion board BX0 / BY0)
  const short = (d) => d ? names[d] || d[0] + d.slice(1).replace(/^0+(?=\d)/, "") : "?";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const base = (k) => String(k || "").split(":")[0];
  const dAdd = (d, i) => d[0] + (parseInt(d.slice(1), 8) + i).toString(8).padStart(3, "0");
  const yAdd = (y, i) => "Y" + (parseInt(y.slice(1), 8) + i).toString(8).padStart(3, "0");

  let W = {}, pressed = {}, sim = {}, el = null, opt = null, xs = [], ys = [], marks = {}, model = "FX3S", outs = {}, ins = {}, mute = false, audio = null;
  let parts = [], wires = {}, links = {}, nid = 1, msg = "", pick = null, ro = null;   // wires: terminal -> "partId.port"; links: "pid.out" -> "pid.in"

  /* ---------- bench model -> wiring map ---------- */
  const termOf = (pp) => Object.keys(wires).find((t) => wires[t] === pp) || "";
  function derive() {
    const w = {};
    parts.forEach((p) => {
      const main = termOf(p.id + ".main");
      if (IN[p.k]) { if (main) w[main] = p.k; return; }
      if (main) w[main] = p.k;
      if (p.k === "dial" && main) for (let i = 1; i < 4; i++) w[dAdd(main, i)] = "dialB:" + main;
      PORTS[p.k].slice(1).forEach(([port, ty]) => {
        if (ty[0] === "M") return;
        const t = termOf(p.id + "." + port); if (!t) return;
        if (port === "pushF") w[t] = "pushF:" + termOf(p.id + ".push");
        else w[t] = port + ":" + main;
      });
    });
    return w;
  }
  const partById = (id) => parts.find((p) => p.id === id);
  const partOfY = (y) => { const v = wires[y]; return v && v.endsWith(".main") ? partById(v.split(".")[0]) : null; };
  const keyOf = (p) => termOf(p.id + ".main") || p.id;          // where a part's simulation state lives
  const linkedFrom = (mi) => Object.keys(links).find((mo) => links[mo] === mi) || "";
  function give(mi, box) {                        // put a workpiece into a material inlet; false when there is no room
    const [id, port] = String(mi || "").split("."), p = partById(id); if (!p) return false;
    const s = stateOf(keyOf(p));
    if (p.k === "conv" && port === "in") { if (s.boxes.some((x) => x.p < BOX + 0.03)) return false; s.boxes.push({ p: 0, m: box.m }); return true; }
    if (p.k === "bin") { const f = box.m ? "metal" : "plastic"; s[f] = (s[f] || 0) + 1; return true; }
    return false;
  }
  function takeFrom(armId) {                      // the arm closes on whatever waits at the outlet linked to its pick side
    const [id] = linkedFrom(armId + ".pick").split("."), p = partById(id); if (!p) return null;
    const s = stateOf(keyOf(p));
    if (p.k === "conv") {
      const b = s.boxes.filter((x) => x.p + BOX / 2 >= PICK_FROM).sort((a, c) => c.p - a.p)[0];
      if (!b) return null; s.boxes = s.boxes.filter((x) => x !== b); return { m: b.m };
    }
    if (p.k === "feed" && s.ready) { const b = s.ready; s.ready = null; return b; }
    return null;
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
  function fromW(w, extra, lk) {
    parts = []; wires = {}; links = {}; nid = 1;
    const width = benchWidth(), owner = {};
    ys.forEach((y) => { if (OUT[w[y]]) { const p = addPart(w[y]); wires[y] = p.id + ".main"; owner[y] = p; } });
    ys.forEach((y) => { const [s, m] = String(w[y] || "").split(":"); if (SUB[s] && owner[m]) { wires[y] = owner[m].id + "." + s; owner[y] = owner[m]; } });
    xs.forEach((x) => {
      const k = w[x]; if (!k) return;
      if (IN[k] || k === "dial") { const p = addPart(k); wires[x] = p.id + ".main"; return; }
      const [s, m] = k.split(":");
      if (SENS[s] && owner[m]) wires[x] = owner[m].id + "." + s;
    });
    const more = (extra || []).map((k) => addPart(k));
    const ref = (r) => r[0] === "#" ? more[+r.slice(1)] : owner[r];
    (lk || []).forEach(([a, pa, b, pb]) => { if (ref(a) && ref(b)) links[ref(a).id + "." + pa] = ref(b).id + "." + pb; });
    const taken = []; parts.forEach((p) => { Object.assign(p, place(p.k, taken, width)); taken.push({ x: p.x, y: p.y, w: WIDTH[p.k] || 124, h: HEIGHT[p.k] || 160 }); });
  }
  function load() {
    try {
      const b = JSON.parse(localStorage.getItem("ll_kit2") || "null");
      if (b && Array.isArray(b.parts)) { parts = b.parts.filter((p) => PORTS[p.k]); wires = b.wires || {}; links = b.links || {}; nid = b.nid || parts.length + 1; W = derive(); return; }
    } catch (e) { /* bad save */ }
    let old = {};
    try { old = JSON.parse(localStorage.getItem("ll_kit") || "{}") || {}; } catch (e) { old = {}; }
    fromW(old); W = derive();
  }
  function save() { try { localStorage.setItem("ll_kit2", JSON.stringify({ parts, wires, links, nid })); localStorage.setItem("ll_kit", JSON.stringify(W)); } catch (e) { /* private mode */ } }

  const kindOf = (dev) => W[dev] || (dev[0] === "X" ? "switch" : "");
  function link(kind) {                           // sensor "conv:Y004" -> ["conv", "Y004"] when Y4 really is a conveyor
    const [s, y] = String(kind).split(":");
    return SENS[s] && y && (SENS_OF[base(W[y])] || []).includes(s) ? [s, y] : null;
  }
  function subLink(kind) {                        // "doorDn:Y000" -> ["doorDn", "Y000"] when Y0 really is a shutter
    const [s, y] = String(kind).split(":");
    return SUB[s] && y && [].concat(SUB[s][2]).includes(base(W[y])) ? [s, y] : null;
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
    if (k === "dial") return "指撥開關的第 0 位元（1）";
    if (base(k) === "dialB") { const m = k.split(":")[1]; return `${short(m)} 指撥開關的第 ${parseInt(dev.slice(1), 8) - parseInt(m.slice(1), 8)} 位元（${1 << (parseInt(dev.slice(1), 8) - parseInt(m.slice(1), 8))}）`; }
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
    if (k === "dial" || base(k) === "dialB") return "指撥";
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
        const cp = partOfY(y), outTo = cp && links[cp.id + ".out"], tgt = outTo && partById(outTo.split(".")[0]);
        const stopper = !!tgt && tgt.k !== "bin" && tgt.k !== "conv";
        let lim = stopper ? STOP_AT - BOX / 2 : 9;
        s.boxes.sort((a, b) => b.p - a.p).forEach((x) => {
          let np = x.p + dt / 6000;
          if (blocked && x.p + BOX < PUSH_AT - 0.04 && np + BOX >= PUSH_AT - 0.04) np = x.p; // the extended pusher blocks the belt
          if (np > lim) np = Math.max(x.p, lim);           // stopper at the outlet; boxes queue behind each other
          x.p = np; if (stopper) lim = x.p - BOX - 0.01;
        });
        const off = s.boxes.filter((x) => x.p >= 1);
        s.boxes = s.boxes.filter((x) => x.p < 1);
        off.forEach((x) => { if (!(tgt && give(outTo, x))) s.done++; });
      }
      if (k === "arm" || k === "suck") stepArm(y, s, k, dt);
      if (k === "cyl2") {
        const ex = on(y), re = on(subsOf(y, "cylR")[0]);       // 5/2 double solenoid: both OFF keeps the last valve position
        if (ex && !re) s.dir = 1;
        if (re && !ex) s.dir = -1;
        s.pos = Math.max(0, Math.min(1, s.pos + (s.dir || 0) * dt / 600));
      }
      if (k === "lift") {
        const up = on(y), dn = on(subsOf(y, "liftDn")[0]);
        if (up && dn) s.burnt = true;
        if (!s.burnt && !s.crash) {
          s.pos += ((up ? 1 : 0) - (dn ? 1 : 0)) * dt / 2500;
          if (s.pos > 2.1) { s.pos = 2.1; s.crash = "衝頂！"; }
          if (s.pos < -0.1) { s.pos = -0.1; s.crash = "蹲底！"; }
        }
      }
      if (k === "rot" && on(y)) s.ang = (s.ang + dt * 0.045) % 360;
      if (k === "feed") {
        const fp = partOfY(y);
        if (s.mag === undefined) s.mag = 5;
        s.pos = Math.max(0, Math.min(1, s.pos + (on(y) ? 1 : -1) * dt / 400));
        if (s.pos >= 0.98 && !s.fed && s.mag > 0 && !s.ready) {
          const box = { m: (s.n = (s.n || 0) + 1) % 2 === 1 }, to = fp && links[fp.id + ".out"], tp = to && partById(to.split(".")[0]);
          if (tp && tp.k !== "arm" && tp.k !== "suck") { if (give(to, box)) { s.mag--; s.fed = true; } }
          else { s.ready = box; s.mag--; s.fed = true; }
        }
        if (s.pos < 0.1) s.fed = false;
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
      else if (k === "dial") want[x] = (stateOf(x).val || 0) & 1;
      else if (base(k) === "dialB") { const m = k.split(":")[1]; want[x] = ((stateOf(m).val || 0) >> (parseInt(x.slice(1), 8) - parseInt(m.slice(1), 8))) & 1; }
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
          if (t === "armL") v = (s.x || 0) <= 0.02 ? 1 : 0;
          if (t === "armR") v = (s.x || 0) >= 0.98 ? 1 : 0;
          if (t === "armU") v = (s.z || 0) <= 0.02 ? 1 : 0;
          if (t === "armD") v = (s.z || 0) >= 0.98 ? 1 : 0;
          if (t === "armH") v = s.hold ? 1 : 0;
          if (t === "feedE") v = (s.mag === undefined ? 5 : s.mag) > 0 ? 1 : 0;
          if (t === "feedF") v = s.pos >= 0.98 ? 1 : 0;
          if (t === "liftA" || t === "liftB" || t === "liftC") v = Math.abs(s.pos - "ABC".indexOf(t[4])) < 0.035 ? 1 : 0;
          if (t === "rotP") { const d = s.ang % 90; v = Math.min(d, 90 - d) < 4 ? 1 : 0; }
          if (t === "rotO") { const d = s.ang % 360; v = Math.min(d, 360 - d) < 4 ? 1 : 0; }
        }
        want[x] = v;
      }
    });
    buzz(ys.some((y) => outs[y] && (W[y] === "buzzer" || (base(W[y]) === "twB" && subLink(W[y])))));
    return want;
  }

  /* pick-and-place: Y main moves to the place side (spring return to the pick side), armZ lowers, armG closes the
     gripper or turns the vacuum on. Moving sideways while lowered crashes the arm (teaches the interlock). */
  function stepArm(y, s, k, dt) {
    const p = partOfY(y); if (!p || s.crash) return;
    const zY = subsOf(y, "armZ")[0], gY = subsOf(y, "armG")[0];
    s.x = s.x || 0; s.z = s.z || 0; s.g = s.g || 0;
    const ox = s.x;
    s.x = Math.max(0, Math.min(1, s.x + (on(y) ? 1 : -1) * dt / 1000));
    s.z = Math.max(0, Math.min(1, s.z + (on(zY) ? 1 : -1) * dt / 500));
    if (s.x !== ox && s.z > 0.15) { s.crash = true; return; }
    const og = s.g, grip = on(gY);
    s.g = k === "suck" ? (grip ? 1 : 0) : Math.max(0, Math.min(1, s.g + (grip ? 1 : -1) * dt / 250));
    const down = s.z >= 0.98, closing = k === "suck" ? grip : og < 0.95 && s.g >= 0.95;
    if (!s.hold && down && s.x <= 0.02 && closing) s.hold = takeFrom(p.id);
    if (s.hold && (k === "suck" ? !grip : s.g < 0.5)) {
      const box = s.hold; s.hold = null;
      if (down && s.x >= 0.98 && links[p.id + ".place"] && give(links[p.id + ".place"], box)) return;
      if (down && s.x <= 0.02) {
        const src = linkedFrom(p.id + ".pick"), cp = partById(src.split(".")[0]);
        if (cp && cp.k === "conv") { stateOf(keyOf(cp)).boxes.push({ p: STOP_AT - BOX / 2, m: box.m }); return; }
        if (cp && cp.k === "feed") { stateOf(keyOf(cp)).ready = box; return; }
      }
      s.drop = (s.drop || 0) + 1;
    }
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
    if (k === "cyl" || k === "cyl2") {
      const s = sensorsOf(y).map(([x, t]) => sensMark(x, t === "cylF" ? 79 : 19, 26)).join("");
      if (k === "cyl2") { const r = subsOf(y, "cylR")[0]; return `<div class="k-card"${dy}><svg viewBox="0 0 230 92"><rect class="k-cylbody" x="10" y="30" width="112" height="32" rx="4"/><rect class="k-piston" x="14" y="33" width="10" height="26"/><rect class="k-rod" x="24" y="41" width="118" height="10"/><rect class="k-head" x="142" y="34" width="10" height="24" rx="2"/>${s}<path class="k-air" d="M30 70v10h-14"/><path class="k-air k-air2" d="M106 70v10h14"/><text class="k-small" x="10" y="90">${y ? short(y) : ""} 伸出</text><text class="k-small" x="124" y="90">${r ? short(r) : ""} 縮回</text></svg></div>`; }
      return `<div class="k-card"${dy}><svg viewBox="0 0 230 92"><rect class="k-cylbody" x="10" y="30" width="112" height="32" rx="4"/><rect class="k-piston" x="14" y="33" width="10" height="26"/><rect class="k-rod" x="24" y="41" width="118" height="10"/><rect class="k-head" x="142" y="34" width="10" height="24" rx="2"/>${s}<path class="k-air" d="M30 70v10h-14"/><text class="k-small" x="40" y="86">電磁閥 ON：伸出</text></svg></div>`;
    }
    if (k === "conv") {
      const px = (p) => 10 + p * BELT, pusher = subsOf(y, "push")[0];
      const cp = y && partOfY(y), to = cp && links[cp.id + ".out"], tp = to && partById(to.split(".")[0]);
      const stop = tp && tp.k !== "bin" && tp.k !== "conv" ? `<rect class="k-stop" x="${(px(STOP_AT) + BOX * BELT / 2 + 1).toFixed(1)}" y="26" width="4" height="26" rx="1"><title>擋料：工件停在出口等取料</title></rect>` : "";
      const s = sensorsOf(y).map(([x, t]) => {
        const cx = px(AT[t]);
        return t === "conv" ? `<g class="k-sens" data-x="${x}"><rect x="${cx - 6}" y="8" width="12" height="9" rx="2"/><path class="k-beam" d="M${cx} 17V50"/><text x="${cx + 9}" y="15" text-anchor="start">${short(x)}</text></g>`
          : `<g class="k-sens" data-x="${x}"><rect x="${cx - 7}" y="72" width="14" height="8" rx="2"/><text x="${cx}" y="91">${short(x)} ${t === "convM" ? "金屬" : "光電"}</text></g>`;
      }).join("");
      const ps = pusher ? sensorsOf(pusher).map(([x]) => `<g class="k-sens" data-x="${x}"><rect x="${px(PUSH_AT) + 12}" y="6" width="8" height="8" rx="2"/><text x="${px(PUSH_AT) + 22}" y="13" text-anchor="start">${short(x)}</text></g>`).join("") : "";
      const push = pusher ? `<g class="k-pusher"><rect class="k-cylbody" x="${px(PUSH_AT) - 9}" y="2" width="18" height="16" rx="2"/><rect class="k-rod" x="${px(PUSH_AT) - 3}" y="18" width="6" height="2"/><rect class="k-head" x="${px(PUSH_AT) - 14}" y="20" width="28" height="5" rx="1"/><text class="k-small" x="${px(PUSH_AT) - 12}" y="11" text-anchor="end">${short(pusher)} 推料</text></g>` +
        `<rect class="k-bin" x="${px(PUSH_AT) - 22}" y="96" width="44" height="18" rx="2"/><text class="k-small k-binb" x="${px(PUSH_AT)}" y="109" text-anchor="middle"></text>${ps}` : "";
      return `<div class="k-card"${dy}><svg viewBox="0 0 300 118"><rect class="k-belt" x="4" y="50" width="${BELT + 14}" height="16" rx="8"/><path class="k-stripe" d="M12 58H${BELT + 10}"/><circle class="k-roll" cx="12" cy="58" r="6"/><circle class="k-roll" cx="${BELT + 10}" cy="58" r="6"/><g class="k-boxes"></g>${stop}${push}${s}<rect class="k-bin" x="${BELT - 2}" y="96" width="30" height="18" rx="2"/><text class="k-small k-done" x="${BELT + 13}" y="109" text-anchor="middle"></text></svg>` +
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
    if (k === "tower") {
      const sub = (n) => subsOf(y, n)[0], lab = (t, yy) => t ? `<text class="k-small" x="54" y="${yy}">${short(t)}</text>` : "";
      return `<div class="k-card"${dy}><svg viewBox="0 0 90 122"><path class="k-wave" d="M50 4q6 6 0 12M38 4q-6 6 0 12"/><rect class="k-buz k-twb" x="30" y="4" width="20" height="10" rx="3"/>` +
        `<rect class="k-tw tr" x="26" y="16" width="28" height="22" rx="2"/><rect class="k-tw ty" x="26" y="40" width="28" height="22" rx="2"/><rect class="k-tw tg" x="26" y="64" width="28" height="22" rx="2"/>` +
        `<rect class="k-base" x="37" y="86" width="6" height="22"/><rect class="k-base" x="24" y="106" width="32" height="8" rx="2"/>` +
        `${lab(y, 31)}${lab(sub("twY"), 55)}${lab(sub("twG"), 79)}${lab(sub("twB"), 12)}</svg></div>`;
    }
    if (k === "lift") {
      const dn = subsOf(y, "liftDn")[0], fy = (n) => 132 - n * 56;
      const s = sensorsOf(y).map(([x, t]) => sensMark(x, 96, fy("ABC".indexOf(t[4])) - 14)).join("");
      return `<div class="k-card"${dy}><svg viewBox="0 0 120 140"><rect class="k-frame" x="30" y="2" width="52" height="132"/>` +
        [0, 1, 2].map((n) => `<path class="k-floor" d="M22 ${fy(n)}H90"/><text class="k-small" x="4" y="${fy(n) - 12}">${n + 1}F</text>`).join("") +
        `<g class="k-cab"><rect class="k-car2" x="36" y="${fy(0) - 34}" width="40" height="34" rx="2"/><path class="k-cardoor" d="M56 ${fy(0) - 30}V${fy(0) - 2}"/></g>` +
        `<text class="k-motor-t2" x="56" y="10" text-anchor="middle">${y ? "▲" + short(y) : "▲"}${dn ? " ▼" + short(dn) : ""}</text>${s}<text class="k-warn" x="56" y="78" text-anchor="middle"></text></svg></div>`;
    }
    if (k === "rot") {
      const s = sensorsOf(y).map(([x, t]) => sensMark(x, 116, t === "rotP" ? 14 : 104)).join("");
      return `<div class="k-card"${dy}><svg viewBox="0 0 130 118"><circle class="k-disc" cx="60" cy="60" r="46"/><g class="k-rotg">` +
        [0, 1, 2, 3].map((i) => `<g transform="rotate(${i * 90} 60 60)"><rect class="k-station" x="51" y="18" width="18" height="16" rx="2"/><text class="k-small" x="60" y="30" text-anchor="middle">${i + 1}</text></g>`).join("") +
        `<circle class="k-hub" cx="60" cy="60" r="6"/></g><path class="k-pointer" d="M54 2H66L60 12Z"/><text class="k-small k-ang" x="60" y="116" text-anchor="middle"></text>${s}</svg></div>`;
    }
    if (k === "dial")
      return `<div class="k-card"${y ? ` data-dial="${y}"` : ""}><div class="k-dial"><button type="button" class="small-btn" data-dd="-1" data-dx="${y}">−</button><b class="k-dv">0</b><button type="button" class="small-btn" data-dd="1" data-dx="${y}">＋</button></div><p class="k-small2">${y ? short(y) + "～" + short(dAdd(y, 3)) + "（BCD）" : "佔連續 4 個 X"}</p></div>`;
    if (k === "arm" || k === "suck") {
      const sx = { armL: [24, 12], armR: [196, 12], armU: [212, 46], armD: [212, 116], armH: [110, 150] };
      const s = sensorsOf(y).map(([x, t]) => sensMark(x, sx[t][0], sx[t][1])).join("");
      const p = y && partOfY(y), src = p && linkedFrom(p.id + ".pick"), dst = p && links[p.id + ".place"];
      const nm = (pp) => { const q = pp && partById(pp.split(".")[0]); if (!q) return "（沒連）"; const t = termOf(q.id + ".main"); return PNAME[q.k] + (t ? " " + short(t) : ""); };
      const tool = k === "arm"
        ? `<rect class="k-head" x="-12" y="0" width="24" height="8" rx="1"/><rect class="k-fing fl" x="-14" y="8" width="4" height="16"/><rect class="k-fing fr" x="10" y="8" width="4" height="16"/><rect class="k-part k-held" x="-9" y="10" width="18" height="14" rx="1"/>`
        : `<rect class="k-rod" x="-3" y="0" width="6" height="10"/><path class="k-cup" d="M-11 18Q0 6 11 18Z"/><rect class="k-part k-held" x="-9" y="18" width="18" height="14" rx="1"/>`;
      return `<div class="k-card"${dy}><svg viewBox="0 0 220 168"><rect class="k-rail" x="18" y="20" width="184" height="8" rx="3"/><path class="k-floor" d="M8 148H212"/><rect class="k-pad" x="24" y="142" width="32" height="6"/><rect class="k-pad" x="164" y="142" width="32" height="6"/>` +
        `<g class="k-car" transform="translate(40 0)"><rect class="k-cylbody" x="-16" y="14" width="32" height="18" rx="2"/><rect class="k-rod k-zrod" x="-3" y="32" width="6" height="8"/><g class="k-tool" transform="translate(0 40)">${tool}</g></g>` +
        `${s}<text class="k-small" x="40" y="162" text-anchor="middle">取：${esc(nm(src))}</text><text class="k-small" x="180" y="162" text-anchor="middle">放：${esc(nm(dst))}</text><text class="k-warn" x="110" y="84" text-anchor="middle"></text><text class="k-small k-drop" x="110" y="100" text-anchor="middle"></text></svg></div>`;
    }
    if (k === "feed") {
      const s = sensorsOf(y).map(([x, t]) => sensMark(x, t === "feedE" ? 96 : 40, t === "feedE" ? 40 : 62)).join("");
      return `<div class="k-card"${dy}><svg viewBox="0 0 140 112"><rect class="k-frame" x="50" y="4" width="30" height="82"/><g class="k-stack"></g><path class="k-floor" d="M4 88H136"/>` +
        `<rect class="k-cylbody" x="4" y="68" width="30" height="16" rx="2"/><rect class="k-rod" x="34" y="73" width="2" height="6"/><rect class="k-head k-fpush" x="36" y="68" width="6" height="16" rx="1"/>` +
        `<rect class="k-bin" x="92" y="66" width="40" height="20" rx="2"/><rect class="k-part k-ready" x="100" y="70" width="24" height="14" rx="1"/>${s}<text class="k-small k-mag" x="65" y="104" text-anchor="middle"></text></svg>` +
        (y ? `<p><button type="button" class="small-btn" data-refill="${y}">補料（+5）</button></p>` : "") + `</div>`;
    }
    if (k === "seg")
      return `<div class="k-card"${dy}><svg viewBox="0 0 90 92"><rect class="k-segbg" x="12" y="2" width="66" height="70" rx="4"/><g transform="translate(20 4)">${Object.keys(SEG).map((g) => `<path class="k-seg" data-g="${g}" d="${SEG[g]}"/>`).join("")}</g><text class="k-small" x="45" y="86" text-anchor="middle">${y ? short(y) + "～" + short(yAdd(y, 3)) : "佔連續 4 個 Y"}</text></svg></div>`;
    if (k === "nopb" || k === "ncpb")
      return `<div class="k-card"><button type="button" class="k-pb k-${k}" data-x="${y}" title="${esc(IN[k][0])}"><span></span><small>${k === "nopb" ? "按住" : "平常 ON"}</small></button></div>`;
    if (k === "switch")
      return `<div class="k-card"><button type="button" class="k-sw" data-x="${y}" title="點一下切換 ON／OFF"><span></span><small>OFF</small></button></div>`;
    return "";
  }
  function binCard(id) {
    return `<div class="k-card" data-bin="${id}"><svg viewBox="0 0 110 74"><path class="k-binbox" d="M8 14L16 70H94L102 14"/><text class="k-small k-bm" x="55" y="40" text-anchor="middle"></text><text class="k-small k-bp" x="55" y="56" text-anchor="middle"></text></svg><p><button type="button" class="small-btn" data-empty="${id}">倒掉</button></p></div>`;
  }
  function partHtml(p) {
    const main = termOf(p.id + ".main"), noMain = PORTS[p.k][0][1][0] === "M";
    const mports = PORTS[p.k].filter((r) => r[1][0] === "M").map(([port, ty, lab]) => {
      const pp = p.id + "." + port, used = ty === "Mo" ? links[pp] : linkedFrom(pp);
      return `<span class="kb-port ${ty}${used ? " used" : ""}" data-port="${pp}" data-ty="${ty}" title="物料口：拉到另一個零件的物料口，決定工件從哪裡${ty === "Mo" ? "送出去" : "進來"}"><i></i>${lab}${ty === "Mo" ? " →" : ""}</span>`;
    }).join("");
    const ports = PORTS[p.k].filter((r) => r[1][0] !== "M").map(([port, ty, lab]) => {
      const t = termOf(p.id + "." + port);
      return `<span class="kb-port ${ty}${t ? " used" : ""}" data-port="${p.id}.${port}" data-ty="${ty}" title="${ty === "Y" ? "從 PLC 的 Y 端子拉線到這裡" : "從 PLC 的 X 端子拉線到這裡"}"><i></i>${lab}${t ? `<b>${short(t)}</b>` : ""}</span>`;
    }).join("");
    const hint = !main && !noMain ? `<p class="kb-hint">${PORTS[p.k][0][1] === "Y" ? "把一個 Y 端子拉線到「" + PORTS[p.k][0][2] + "」" : "把一個 X 端子拉線到「" + PORTS[p.k][0][2] + "」"}</p>` : "";
    return `<div class="kb-part${main || noMain ? "" : " idle"}" data-id="${p.id}" data-k="${p.k}" style="left:${p.x}px;top:${p.y}px;width:${WIDTH[p.k] || 124}px">` +
      `<div class="kb-ports">${ports}</div><div class="kb-head"><span>${esc(PNAME[p.k])}${main && p.k !== "seg" ? " " + short(main) : ""}</span><button type="button" class="kb-rm" data-rm="${p.id}" title="拿掉這個零件">×</button></div>` +
      (p.k === "bin" ? binCard(p.id) : card(main, p.k)) + hint + (mports ? `<div class="kb-mports">${mports}</div>` : "") + `</div>`;
  }
  function render() {
    if (!el) return;
    const segUse = {}; Object.keys(wires).forEach((t) => { if (wires[t].endsWith(".main") && RANGE4[(partById(wires[t].split(".")[0]) || {}).k]) for (let i = 1; i < 4; i++) segUse[dAdd(t, i)] = t; });
    const term = (t) => (marks[t] ? `<span class="kb-ext">${esc(marks[t])}</span>` : "") + `<span class="kb-term ${t[0]}${wires[t] || segUse[t] ? " used" : ""}" data-t="${t}" title="${esc((names[t] ? `${names[t]}：程式裡用 ${{ X370: "M8112", X371: "M8113", X372: "M8114", X373: "M8115", Y370: "M8116", Y371: "M8117" }[t]}。` : "") + (label(t) || (t[0] === "X" ? "輸入端子（沒接線時是切換開關）" : "輸出端子（沒接線時只亮 PLC 上的燈）")))}"><b>${short(t)}</b><i></i></span>`;
    const rows = xs.concat(ys).filter((d) => W[d] || segUse[d]).map((d) => `<tr><td><b>${short(d)}</b></td><td>${esc(label(d))}</td><td>${wires[d] ? `<button type="button" class="small-btn" data-cut="${d}">拆線</button>` : ""}</td></tr>`).join("");
    el.innerHTML = `<div class="kb-pal"><span class="hint">零件（拖到下面的組裝台，或點一下放上去）：</span>${PALETTE.map((k) => `<button type="button" class="kb-pi" data-k="${k}">${esc(PNAME[k])}</button>`).join("")}</div>` +
      `<div class="kb-bench"><div class="kb-plc"><div class="kb-row"><span class="kb-rl">${esc(model)}<br>輸入</span>${xs.map(term).join("")}</div><div class="kb-row"><span class="kb-rl">輸出</span>${ys.map(term).join("")}</div></div>` +
      `<svg class="kb-wires"></svg><div class="kb-area">${parts.map(partHtml).join("") || '<p class="hint kb-empty">組裝台是空的：從上面把零件拖進來，再從 PLC 的端子（X 藍、Y 橘）拉線到零件的端子。X 沒接線時是切換開關，Y 沒接線時只亮 PLC 面板上的燈。也可以從下面「範例機構」載入一組。</p>'}</div></div>` +
      `<p class="hint kb-legend">灰色方塊是<b>物料口</b>：從一個零件的「出口／放料」拉到另一個零件的「入口／取料」，工件就會照這個方向送過去。輸送帶出口連到夾爪取料、夾爪放料再連回輸送帶入口，工件就會一直循環（循環輸送）。</p>` +
      `<p class="kb-msg${msg ? " show" : ""}">${esc(msg || "拉線：按住端子拖到另一頭放開，或點一下端子再點另一頭。點一下線可以拆掉。")}</p>` +
      `<div class="k-add"><select class="k-preset">${PRESETS.map((p, i) => `<option value="${i}" ${i === lastPreset ? "selected" : ""}>${esc(p.title)}</option>`).join("")}</select><button type="button" class="small-btn" data-preset>載入範例機構（零件、接線和程式）</button></div>` +
      `<div class="k-add"><button type="button" class="small-btn" data-reset>機構歸位</button><button type="button" class="small-btn" data-tidy>自動排列</button><button type="button" class="small-btn" data-clear>全部清空</button><label class="check small"><input type="checkbox" data-mute ${mute ? "checked" : ""}> 蜂鳴器靜音</label></div>` +
      `<details class="k-wire"><summary>接線表（${rows ? "目前接了哪些端子" : "還沒接線"}）</summary>${rows ? `<table class="k-table"><tbody>${rows}</tbody></table>` : ""}</details>`;
    msg = "";
    fitArea();
    el.querySelector("[data-clear]").onclick = () => { parts = []; wires = {}; links = {}; sim = {}; commit(); };
    el.querySelectorAll("[data-dd]").forEach((b) => (b.onclick = () => { if (!b.dataset.dx) return; const s = stateOf(b.dataset.dx); s.val = ((s.val || 0) + +b.dataset.dd + 10) % 10; }));
    el.querySelectorAll("[data-refill]").forEach((b) => (b.onclick = () => { const s = stateOf(b.dataset.refill); s.mag = Math.min(10, (s.mag === undefined ? 5 : s.mag) + 5); }));
    el.querySelectorAll("[data-empty]").forEach((b) => (b.onclick = () => { const s = stateOf(b.dataset.empty); s.metal = 0; s.plastic = 0; }));
    el.querySelector("[data-reset]").onclick = () => { sim = {}; };
    el.querySelector("[data-tidy]").onclick = tidy;
    el.querySelector("[data-preset]").onclick = () => { if (parts.length && !confirm("載入範例會取代目前組裝台的零件、接線和程式。要繼續嗎？（想留著的話，先按上面的「存專案」備份）")) return; preset(+el.querySelector(".k-preset").value); };
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
  /* lay the parts out in rows by their real size (ports stick out above and below each part, hence the gaps) */
  function tidy() {
    const area = el && el.querySelector(".kb-area"); if (!area) return;
    const width = area.clientWidth || 680;
    let x = 8, y = 14, row = 0;
    parts.forEach((p) => {
      const n = area.querySelector(`.kb-part[data-id="${p.id}"]`); if (!n) return;
      const w = n.offsetWidth, h = n.offsetHeight;
      if (x > 8 && x + w > width - 8) { x = 8; y += row + 30; row = 0; }
      p.x = x; p.y = y; n.style.left = x + "px"; n.style.top = y + "px";
      x += w + 18; row = Math.max(row, h);
    });
    save(); fitArea(); drawWires();
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
      if (RANGE4[W[t]]) for (let i = 1; i < 4; i++) list.push(dAdd(t, i));
      list.forEach((d, i) => {
        const n = bench.querySelector(`.kb-term[data-t="${d}"]`); if (!n) return;
        out += `<path class="kb-w ${t[0]}" data-t="${d}" data-cut="${t}" d="${curve(centre(n, box), [p[0] + i * 3, p[1]])}"><title>${short(d)} → ${esc(PNAME[base(W[t])] || "")}（點一下拆掉）</title></path>`;
      });
    });
    Object.keys(links).forEach((mo) => {
      const a = bench.querySelector(`.kb-port[data-port="${mo}"]`), b = bench.querySelector(`.kb-port[data-port="${links[mo]}"]`);
      if (!a || !b) return;
      const p = centre(a, box), q = centre(b, box), d = Math.max(50, Math.abs(q[0] - p[0]) / 4);
      out += `<path class="kb-m" data-mo="${mo}" marker-end="url(#kbArr)" d="M${p[0].toFixed(1)} ${p[1].toFixed(1)}C${p[0].toFixed(1)} ${(p[1] + d).toFixed(1)} ${q[0].toFixed(1)} ${(q[1] + d).toFixed(1)} ${q[0].toFixed(1)} ${(q[1] + 9).toFixed(1)}"><title>工件送過去的方向（點一下拆掉）</title></path>`;
    });
    svg.innerHTML = `<defs><marker id="kbArr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" class="kb-arrhead"/></marker></defs>` + out + `<path class="kb-pend" d=""/>`;
    svg.querySelectorAll(".kb-m").forEach((w) => w.addEventListener("click", () => { delete links[w.dataset.mo]; msg = "拆掉了一條物料連線"; commit(); }));
    svg.querySelectorAll(".kb-w").forEach((w) => w.addEventListener("click", () => { delete wires[w.dataset.cut]; msg = `拆掉了 ${short(w.dataset.cut)} 的線`; commit(); }));
    paint();
  }
  function connect(a, b) {                        // a, b: {t} terminal or {port, ty} part terminal, in either order
    const ma = !!(a.ty && a.ty[0] === "M"), mb = !!(b.ty && b.ty[0] === "M");
    if (ma || mb) {
      if (!(ma && mb)) { msg = "物料口（灰色方塊）要連到另一個零件的物料口，表示工件從哪裡送到哪裡；電線才接 PLC 的端子。"; return render(); }
      const mo = a.ty === "Mo" ? a.port : b.ty === "Mo" ? b.port : "", mi = a.ty === "Mi" ? a.port : b.ty === "Mi" ? b.port : "";
      if (!mo || !mi) { msg = "要一頭是「出口／放料」（送出去），一頭是「入口／取料」（接進來）。"; return render(); }
      if (mo.split(".")[0] === mi.split(".")[0]) { msg = "不能接回同一個零件自己身上。"; return render(); }
      Object.keys(links).forEach((k) => { if (k === mo || links[k] === mi) delete links[k]; });
      links[mo] = mi;
      const nm = (pp) => { const q = partById(pp.split(".")[0]), t = termOf(q.id + ".main"); return `${PNAME[q.k]}${t ? " " + short(t) : ""}的「${PORTS[q.k].find((r) => r[0] === pp.split(".")[1])[2]}」`; };
      msg = `工件從 ${nm(mo)} 送到 ${nm(mi)}`;
      return commit();
    }
    const t = a.t || b.t, pp = a.port || b.port, ty = a.ty || b.ty;
    if (!t || !pp) { msg = "線要一頭接 PLC 的端子、一頭接零件的端子。"; return render(); }
    if (t[0] !== ty) { msg = ty === "Y" ? `${short(t)} 是輸入端子，裝置的線圈要接 Y（輸出）。` : `${short(t)} 是輸出端子，感測器和按鈕要接 X（輸入）。`; return render(); }
    const [pid, port] = pp.split("."), part = parts.find((p) => p.id === pid);
    for (const s of Object.keys(wires)) {
      const sp = parts.find((p) => p.id === wires[s].split(".")[0]);
      if (sp && RANGE4[sp.k] && wires[s].endsWith(".main") && wires[s] !== pp) for (let i = 1; i < 4; i++) if (dAdd(s, i) === t) { msg = `${short(t)} 已經給 ${short(s)} 的${RANGE4[sp.k]}用了（佔 ${short(s)}～${short(dAdd(s, 3))}）。`; return render(); }
    }
    if (part && RANGE4[part.k] && port === "main") {
      const all = t[0] === "X" ? xs : ys, nm = RANGE4[part.k];
      for (let i = 1; i < 4; i++) {
        const d = dAdd(t, i);
        if (!all.includes(d)) { msg = `${nm}要連續 4 個 ${t[0]}，從 ${short(t)} 開始不夠（這台 PLC 沒有 ${short(d)}）。`; return render(); }
        if (wires[d]) { msg = `${nm}從 ${short(t)} 開始要佔到 ${short(dAdd(t, 3))}，但 ${short(d)} 已經接了別的東西。`; return render(); }
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
    Object.keys(links).forEach((k) => { if (k.split(".")[0] === id || links[k].split(".")[0] === id) delete links[k]; });
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
        "LD X004", "OUT C0 K10", "LD C0", "RST C0", "LD M0", "ANI Y001", "OUT Y000", "LD M8000", "BCD C0 K1Y004"],
      note: "按 X0 啟動。金屬經過 X2 金屬感測器時記住（SET M1）；到推料位置 X3 時推料氣缸 Y1 推出（輸送帶暫停），推到底 X4 就縮回、忘掉 M1。塑膠一路送到末端。推出的金屬用 C0 計數，BCD C0 K1Y004 轉成 BCD 碼顯示在七段顯示器（Y4～Y7）；用 MOV 只有 0～9 會對。工件一次放一個比較準。" },
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
    { title: "循環輸送：輸送帶＋夾爪取放，工件一直循環", W: { X000: "nopb", X001: "ncpb", X002: "conv:Y000", X003: "armL:Y001", X004: "armR:Y001", X005: "armU:Y001", X006: "armD:Y001", X007: "armH:Y001",
        Y000: "conv", Y001: "arm", Y002: "armZ:Y001", Y003: "armG:Y001", Y004: "green" },
      L: [["Y000", "out", "Y001", "pick"], ["Y001", "place", "Y000", "in"]],
      init() { stateOf("Y000").boxes = [{ p: 0.1, m: true }, { p: 0.45, m: false }]; },
      il: ["LD X000", "OR M0", "AND X001", "OUT M0", "LD M0", "OUT Y004", "LD M0", "ANI X002", "OUT Y000", "LD M8002", "SET S0",
        "STL S0", "LD M0", "AND X002", "AND X003", "AND X005", "SET S20",
        "STL S20", "SET Y002", "LD X006", "SET S21",
        "STL S21", "SET Y003", "OUT T0 K3", "LD T0", "AND X007", "SET S22",
        "STL S22", "RST Y002", "LD X005", "SET S23",
        "STL S23", "SET Y001", "LD X004", "SET S24",
        "STL S24", "SET Y002", "LD X006", "SET S25",
        "STL S25", "RST Y003", "OUT T1 K3", "LD T1", "SET S26",
        "STL S26", "RST Y002", "LD X005", "SET S27",
        "STL S27", "RST Y001", "LD X003", "SET S0", "RET"],
      note: "按 X0 啟動。輸送帶 Y0 把工件送到出口的擋料，末端光電 X2 ON 就停。夾爪用 STL 一步一步做：下降 Y2 → 到下限 X6 夾緊 Y3 → 夾到 X7 上升 → 到上限 X5 橫移 Y1 → 到放料位 X4 下降 → 鬆開 → 上升 → 回取料位 X3。放料口連回輸送帶入口，工件就一直循環。每一步都等感測器確認才走下一步，而且只在上限才橫移：下降時橫移會撞機。X1 是停止按鈕（常閉）：按下後輸送帶停、夾爪做完這一輪停在原點。這是「循環停止」，不是急停；真正的急停要切斷輸出、清掉步序（見課程 5.9 和「急停與硬體互鎖」指南）。" },
    { title: "供料器→輸送帶→吸盤→料盒（計數）", W: { X000: "nopb", X001: "ncpb", X002: "feedE:Y000", X003: "feedF:Y000", X004: "conv:Y001", X005: "armL:Y002", X006: "armR:Y002", X007: "armU:Y002", X010: "armD:Y002", X011: "armH:Y002",
        Y000: "feed", Y001: "conv", Y002: "suck", Y003: "armZ:Y002", Y004: "armG:Y002", Y005: "red" },
      extra: ["bin"], L: [["Y000", "out", "Y001", "in"], ["Y001", "out", "Y002", "pick"], ["Y002", "place", "#0", "in"]],
      init() {},
      il: ["LD X000", "OR M0", "AND X001", "OUT M0", "LD M0", "AND X002", "ANI M1", "ANI X003", "OUT Y000", "LD X003", "SET M1",
        "LD M0", "ANI X004", "OUT Y001", "LDI X002", "OUT Y005", "LD M8002", "SET S0",
        "STL S0", "LD M0", "AND X004", "AND X005", "AND X007", "SET S20",
        "STL S20", "SET Y003", "LD X010", "SET S21",
        "STL S21", "SET Y004", "LD X011", "SET S22",
        "STL S22", "RST Y003", "LD X007", "SET S23",
        "STL S23", "SET Y002", "LD X006", "SET S24",
        "STL S24", "SET Y003", "LD X010", "SET S25",
        "STL S25", "RST Y004", "LDI X011", "SET S26",
        "STL S26", "RST Y003", "LD X007", "SET S27",
        "STL S27", "RST Y002", "RST M1", "LD X005", "SET S0", "RET"],
      note: "按 X0 啟動。供料器 Y0 從料倉推出一個工件到輸送帶入口（推到底 X3 記住 M1，不再推）。輸送帶 Y1 送到出口，光電 X4 ON 就停。吸盤：下降 Y3 → 下限 X10 開真空 Y4 → 真空 X11 上升 → 橫移 Y2 → 放料位下降 → 關真空 → 上升 → 回原點，同時 RST M1 讓供料器推下一個。料盒會分別算金屬和塑膠。料倉 5 個用完，有料 X2 OFF，紅燈 Y5 亮，按「補料」再繼續。" },
    { title: "加工站：分度盤＋雙動氣缸＋塔燈", W: { X000: "nopb", X001: "ncpb", X002: "rotP:Y000", X003: "rotO:Y000", X004: "cylF:Y001", X005: "cylB:Y001",
        Y000: "rot", Y001: "cyl2", Y002: "cylR:Y001", Y003: "tower", Y004: "twY:Y003", Y005: "twG:Y003", Y006: "twB:Y003" },
      init() {},
      il: ["LD X000", "OR M0", "AND X001", "OUT M0", "LD M0", "OUT Y005", "LDI M0", "AND X001", "OUT Y004", "LDI X001", "OUT Y003",
        "LDI X001", "AND M8013", "OUT Y006", "LD M8002", "SET S0",
        "STL S0", "LD M0", "AND X005", "SET S20",
        "STL S20", "SET Y000", "LDI X002", "SET S21",
        "STL S21", "LD X002", "SET S22",
        "STL S22", "RST Y000", "SET Y001", "LD X004", "SET S23",
        "STL S23", "RST Y001", "SET Y002", "LD X005", "SET S24",
        "STL S24", "RST Y002", "LD M0", "SET S20", "LDI M0", "SET S0", "RET"],
      note: "按 X0 啟動（塔燈綠 Y5）。分度盤 Y0 轉，先離開定位、再碰到定位感測器 X2 就停（轉 90°）；雙動氣缸伸出線圈 Y1 打到前限 X4，換縮回線圈 Y2 回到後限 X5，再轉下一站。雙動氣缸兩個線圈都 OFF 時會保持最後的閥位（氣缸繼續走到底，不會中途停），所以用 SET／RST。按 X1 停止：塔燈紅 Y3 亮、蜂鳴器 Y6 響，做完這一站停下；放開 X1 後塔燈黃 Y4 表示待機。" },
    { title: "三層電梯：叫車、上下行、樓層燈", W: { X000: "nopb", X001: "nopb", X002: "nopb", X003: "liftA:Y000", X004: "liftB:Y000", X005: "liftC:Y000",
        Y000: "lift", Y001: "liftDn:Y000", Y002: "yellow", Y003: "yellow", Y004: "yellow" },
      init() {},
      il: ["LD X000", "SET M1", "LD X001", "SET M2", "LD X002", "SET M3",
        "LD X003", "SET M11", "RST M12", "RST M13", "LD X004", "SET M12", "RST M11", "RST M13", "LD X005", "SET M13", "RST M11", "RST M12",
        "LD M1", "AND X003", "RST M1", "LD M2", "AND X004", "RST M2", "LD M3", "AND X005", "RST M3",
        "LD M2", "OR M3", "AND M11", "LD M3", "AND M12", "ORB", "ANI Y001", "OUT Y000",
        "LD M1", "OR M2", "AND M13", "LD M1", "AND M12", "ORB", "ANI Y000", "OUT Y001",
        "LD M11", "OUT Y002", "LD M12", "OUT Y003", "LD M13", "OUT Y004"],
      note: "X0、X1、X2 是 1、2、3 樓的叫車按鈕，叫了就記住（M1～M3），到那一樓才清掉。樓層感測器 X3～X5 記住現在在哪一樓（M11～M13），樓層燈 Y2～Y4 跟著亮。要去的樓層在上面就上升 Y0，在下面就下降 Y1，兩個互鎖。把 ANI 拿掉讓兩個線圈同時 ON 會燒馬達；感測器沒停好會衝頂或蹲底。" },
    { title: "指撥設定數量：供料→吸盤→料盒（要加裝擴充板）", plc: ["FX3S-30M", ["4EX-BD"]],
      W: { X000: "nopb", X001: "ncpb", X002: "feedE:Y000", X003: "feedF:Y000", X004: "conv:Y001", X005: "armL:Y002", X006: "armR:Y002", X007: "armU:Y002", X010: "armD:Y002", X011: "armH:Y002",
        X016: "nopb", X370: "dial", Y000: "feed", Y001: "conv", Y002: "suck", Y003: "armZ:Y002", Y004: "armG:Y002", Y005: "tower", Y006: "twY:Y005", Y007: "twG:Y005", Y010: "twB:Y005", Y011: "seg" },
      extra: ["bin"], L: [["Y000", "out", "Y001", "in"], ["Y001", "out", "Y002", "pick"], ["Y002", "place", "#0", "in"]],
      init() { stateOf("X370").val = 3; },
      il: ["LD M8000", "BIN K1M8112 D0", "LD X000", "OR M0", "AND X001", "ANI M2", "OUT M0",
        "LD M0", "AND X002", "ANI M1", "ANI X003", "OUT Y000", "LD X003", "SET M1", "LD M0", "ANI X004", "OUT Y001",
        "LDF X011", "AND X006", "OUT C0 K99", "LD>= C0 D0", "AND> D0 K0", "SET M2", "LD X016", "RST C0", "RST M2",
        "LD M8000", "BCD C0 K1Y011", "LD M0", "OUT Y007", "LDI M0", "ANI M2", "OUT Y006", "LD M2", "OUT Y005",
        "LD M2", "OUT T2 K30", "LD M2", "ANI T2", "OUT Y010",
        "LD M8002", "SET S0",
        "STL S0", "LD M0", "AND X004", "AND X005", "AND X007", "SET S20",
        "STL S20", "SET Y003", "LD X010", "SET S21",
        "STL S21", "SET Y004", "LD X011", "SET S22",
        "STL S22", "RST Y003", "LD X007", "SET S23",
        "STL S23", "SET Y002", "LD X006", "SET S24",
        "STL S24", "SET Y003", "LD X010", "SET S25",
        "STL S25", "RST Y004", "LDI X011", "SET S26",
        "STL S26", "RST Y003", "LD X007", "SET S27",
        "STL S27", "RST Y002", "RST M1", "LD X005", "SET S0", "RET"],
      note: "主機的 X0～X16 都接滿了，指撥開關要 4 點，所以加裝 FX3G-4EX-BD 輸入擴充板，指撥開關接在擴充板的 BX0～BX3。擴充板的輸入沒有 X 編號，程式要讀特殊繼電器 M8112～M8115，所以用 BIN K1M8112 D0 把指撥開關的 BCD 碼轉成數值讀進來（預設 3）。吸盤每放一個到料盒（真空 X11 由 ON 變 OFF、在放料位 X6），C0 加 1，七段顯示器（Y11～Y14）顯示數量。C0 到設定值：停機、塔燈紅 Y5 亮、蜂鳴器響 3 秒。X16 歸零再按 X0 重新開始。" },
  ];
  function preset(i) {
    const p = PRESETS[i] || PRESETS[0];
    lastPreset = PRESETS[i] ? i : 0;
    const need = [];
    Object.keys(p.W).forEach((d) => { need.push(d); if (RANGE4[p.W[d]]) for (let j = 1; j < 4; j++) need.push(dAdd(d, j)); });
    if (opt && opt.setPlc && (p.plc || need.some((d) => !xs.includes(d) && !ys.includes(d)))) opt.setPlc(...(p.plc || ["FX3S-30M", []]));
    fromW(p.W, p.extra, p.L); W = derive(); sim = {}; p.init(); pick = null;
    changed(true);
    tidy();
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
      if (k === "cyl" || k === "cyl2") {
        const dx = s.pos * 60;
        if (k === "cyl2") { q(".k-air").classList.toggle("on", on(y)); q(".k-air2").classList.toggle("on", on(subsOf(y, "cylR")[0])); }
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
      if (k === "tower") {
        q(".tr").classList.toggle("lit", on(y)); q(".ty").classList.toggle("lit", on(subsOf(y, "twY")[0]));
        q(".tg").classList.toggle("lit", on(subsOf(y, "twG")[0])); c.classList.toggle("buzzing", on(subsOf(y, "twB")[0]));
        c.classList.remove("on");
      }
      if (k === "lift") {
        q(".k-cab").setAttribute("transform", `translate(0 ${(-s.pos * 56).toFixed(1)})`);
        q(".k-warn").textContent = s.burnt ? "馬達燒毀！" : (s.crash || "");
        c.classList.toggle("burnt", !!(s.burnt || s.crash));
        if ((s.burnt || s.crash) && !q("[data-fix]")) {
          c.insertAdjacentHTML("beforeend", `<button type="button" class="small-btn" data-fix="${y}">修好</button>`);
          q("[data-fix]").onclick = () => { const t = stateOf(y); t.burnt = false; t.crash = ""; t.pos = Math.max(0, Math.min(2, Math.round(t.pos))); };
        }
        if (!(s.burnt || s.crash) && q("[data-fix]")) q("[data-fix]").remove();
      }
      if (k === "rot") {
        q(".k-rotg").setAttribute("transform", `rotate(${s.ang.toFixed(1)} 60 60)`);
        q(".k-ang").textContent = Math.round(s.ang) + "°";
      }
      if (k === "arm" || k === "suck") {
        const x = s.x || 0, z = s.z || 0, g = s.g || 0, gap = 4 + (1 - g) * 6;
        q(".k-car").setAttribute("transform", `translate(${(40 + x * 140).toFixed(1)} 0)`);
        q(".k-zrod").setAttribute("height", (8 + z * 70).toFixed(1));
        q(".k-tool").setAttribute("transform", `translate(0 ${(40 + z * 70).toFixed(1)})`);
        if (k === "arm") { q(".fl").setAttribute("x", (-gap - 4).toFixed(1)); q(".fr").setAttribute("x", gap.toFixed(1)); }
        else q(".k-cup").classList.toggle("on", g > 0.5);
        const h = q(".k-held"); h.style.display = s.hold ? "inline" : "none"; h.classList.toggle("metal", !!(s.hold && s.hold.m));
        q(".k-warn").textContent = s.crash ? "撞機！下降時不能橫移" : "";
        q(".k-drop").textContent = s.drop ? `工件掉了 ${s.drop} 個` : "";
        c.classList.toggle("burnt", !!s.crash);
        if (s.crash && !q("[data-fix]")) {
          c.insertAdjacentHTML("beforeend", `<button type="button" class="small-btn" data-fix="${y}">修好</button>`);
          q("[data-fix]").onclick = () => { const t = stateOf(y); t.crash = false; t.z = 0; };
        }
        if (!s.crash && q("[data-fix]")) q("[data-fix]").remove();
      }
      if (k === "feed") {
        const mag = s.mag === undefined ? 5 : s.mag, n = s.n || 0;
        let st2 = "";
        for (let i = 0; i < Math.min(5, mag); i++) st2 += `<rect class="k-part${(n + 1 + i) % 2 === 1 ? " metal" : ""}" x="53" y="${70 - i * 16}" width="24" height="14" rx="1"/>`;
        q(".k-stack").innerHTML = st2;
        q(".k-fpush").setAttribute("x", (36 + s.pos * 14).toFixed(1)); q(".k-rod").setAttribute("width", (2 + s.pos * 14).toFixed(1));
        const r = q(".k-ready"); r.style.display = s.ready ? "" : "none"; r.classList.toggle("metal", !!(s.ready && s.ready.m));
        q(".k-mag").textContent = mag ? `料倉剩 ${mag} 個` : "料倉空了";
      }
      if (k === "seg") {
        const v = [0, 1, 2, 3].reduce((a, i) => a + (on(yAdd(y, i)) ? 1 << i : 0), 0), lit = v <= 9 ? DIG[v] : "";
        c.querySelectorAll(".k-seg").forEach((p) => p.classList.toggle("lit", lit.includes(p.dataset.g)));
        c.classList.toggle("on", v > 0);
      }
    });
    el.querySelectorAll(".k-card[data-dial]").forEach((c) => { c.querySelector(".k-dv").textContent = String(stateOf(c.dataset.dial).val || 0); });
    el.querySelectorAll(".k-card[data-bin]").forEach((c) => {
      const s = stateOf(c.dataset.bin);
      c.querySelector(".k-bm").textContent = `金屬 ${s.metal || 0} 個`; c.querySelector(".k-bp").textContent = `塑膠 ${s.plastic || 0} 個`;
    });
    el.querySelectorAll(".k-sens").forEach((g) => g.classList.toggle("on", !!ins[g.dataset.x]));
    el.querySelectorAll(".k-pb").forEach((b) => b.classList.toggle("down", !!pressed[b.dataset.x]));
    el.querySelectorAll(".k-sw").forEach((b) => { const v = !!ins[b.dataset.x]; b.classList.toggle("on", v); b.querySelector("small").textContent = v ? "ON" : "OFF"; });
    paint();
  }

  /* another PLC model or expansion: wires to terminals the new PLC does not have are removed */
  function setIO(nx, ny, mk, name, nm) {
    xs = nx; ys = ny; marks = mk || {}; model = name || model; names = nm || names;
    const gone = Object.keys(wires).filter((t) => !xs.includes(t) && !ys.includes(t));
    Object.keys(wires).forEach((t) => {
      const p = partById(wires[t].split(".")[0]);
      if (p && RANGE4[p.k] && wires[t].endsWith(".main")) for (let i = 1; i < 4; i++) if (!xs.includes(dAdd(t, i)) && !ys.includes(dAdd(t, i))) gone.push(t);
    });
    [...new Set(gone)].forEach((t) => delete wires[t]);
    if (gone.length) msg = `換成 ${model}：${[...new Set(gone)].map(short).join("、")} 這台沒有，接到它們的線拆掉了。`;
    if (el) commit();
  }
  /* target: where the bench is drawn; o: {xs, ys, marks, model, onChange, onPreset, onReset, onToggle, setPlc} */
  let resize = null;
  function mount(target, o) {
    el = target; opt = o; xs = o.xs; ys = o.ys; marks = o.marks || {}; model = o.model || "FX3S"; names = o.names || {}; load(); render(); before = {}; xs.forEach((x) => { before[x] = kindOf(x); });
    if (!resize) { resize = () => drawWires(); window.addEventListener("resize", resize); }
  }
  /* project file: the bench as data, and back */
  function getBench() { return JSON.parse(JSON.stringify({ parts, wires, links, nid })); }
  function setBench(b) {
    parts = (b.parts || []).filter((p) => PORTS[p.k]); wires = b.wires || {}; links = b.links || {}; nid = b.nid || parts.length + 1;
    Object.keys(wires).forEach((t) => { if (!xs.includes(t) && !ys.includes(t)) delete wires[t]; });
    sim = {}; pick = null; W = derive(); changed(true);
  }
  function unmount() { if (el) el.innerHTML = ""; el = null; buzz(false); }
  return { mount, unmount, setIO, getBench, setBench, step, update, label, tag, inputKind, press, kindOf, PRESETS, redraw: drawWires };
})();
