"use strict";
/* FX3S-20MT/ES front panel, drawn from the terminal layout in the FX3S User's Manual (Hardware Edition) 4.7.4.
   An original drawing, not a photo. Two uses:
     FX3S.live(el)            -> panel whose IN/OUT lamps follow a running program (setLeds)
     FX3S.player(el, scene)   -> step by step wiring animation: red arrows point at the terminal, wires draw themselves
*/
const FX3S = (() => {
  const P = 36, BX = 215, BY = 92, BW = 330, BH = 334, RH = 30;
  const ROWS = [                                               // [names, x of first cell, y of the row, block]
    [["⏚", "S/S", "X1", "X3", "X5", "X7", "X11", "X13"], BX + 28, 100, "top"],
    [["L", "N", "X0", "X2", "X4", "X6", "X10", "X12"], BX + 10, 130, "top"],
    [["0V", "Y0", "Y1", "Y2", "Y3", "Y4", "Y6", "•"], BX + 28, 356, "bot"],
    [["24V", "COM0", "COM1", "COM2", "COM3", "COM4", "Y5", "Y7"], BX + 10, 386, "bot"],
  ];
  const T = {};                                                // terminal name -> {x, y, block}
  ROWS.forEach(([names, x0, y, block]) => names.forEach((n, i) => { if (n !== "•") T[n] = { x: x0 + i * P + P / 2, y: y + (block === "top" ? 9 : 21), block }; }));
  const PART = {                                               // things an arrow can point at: [x, y, from]
    "in-led": [400, 190, "left"], "status": [400, 243, "left"], "out-led": [400, 300, "left"],
    "usb": [490, 256, "left"], "runstop": [488, 203, "left"], "topblock": [380, 98, "top"], "botblock": [380, 418, "bot"],
    "model": [300, 204, "top"],
  };
  const INS = ["X0", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "X10", "X11", "X12", "X13"];
  const OUTS = ["Y0", "Y1", "Y2", "Y3", "Y4", "Y5", "Y6", "Y7"];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function ledPos(name) {
    if (name[0] === "X") { const i = INS.indexOf(name); return [404 + (i % 8) * 9.5, i < 8 ? 184 : 196]; }
    const i = OUTS.indexOf(name); return [404 + i * 9.5, 300];
  }
  function panelSvg() {
    let s = `<rect class="fx-din" x="${BX - 26}" y="${BY + 120}" width="${BW + 52}" height="70" rx="3"/>` +
      `<rect class="fx-body" x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="8"/>` +
      `<rect class="fx-face" x="${BX + 6}" y="164" width="${BW - 12}" height="188" rx="4"/>`;
    ROWS.forEach(([names, x0, y, block]) => names.forEach((n, i) => {
      const x = x0 + i * P, small = n.length > 3, sy = y + (block === "top" ? 9 : 21), ty = y + (block === "top" ? 26 : 11);
      s += `<g class="fx-term${n === "•" ? " vacant" : ""}" data-t="${esc(n)}"><rect x="${x}" y="${y}" width="${P}" height="${RH}"/>` +
        (n === "•" ? `<circle cx="${x + P / 2}" cy="${y + 15}" r="2"/>` :
          `<circle class="fx-screw" cx="${x + P / 2}" cy="${sy}" r="6"/><path class="fx-slot" d="M${x + P / 2 - 4} ${sy}h8"/>` +
          `<text x="${x + P / 2}" y="${ty}" class="${small ? "sm" : ""}">${esc(n)}</text>`) + "</g>";
    }));
    // output groups that share a common: a broad line, as printed on the real terminal strip
    s += `<path class="fx-broad" d="M${BX + 10 + 5 * P} 386v30"/>`;
    s += `<text class="fx-model" x="232" y="226">FX3S-20MT/ES</text><text class="fx-sub" x="232" y="246">12 點輸入 · 8 點電晶體輸出</text>` +
      `<text class="fx-sub" x="232" y="262">AC 電源型（示意圖）</text>`;
    s += `<text class="fx-cap" x="384" y="188">IN</text><text class="fx-cap" x="380" y="304">OUT</text>`;
    s += `<text class="fx-tiny" x="404" y="176">0 1 2 3 4 5 6 7</text><text class="fx-tiny" x="404" y="209">10 11 12 13</text><text class="fx-tiny" x="404" y="292">0 1 2 3 4 5 6 7</text>`;
    INS.concat(OUTS).forEach((n) => { const [x, y] = ledPos(n); s += `<rect class="fx-led" data-led="${n}" x="${x}" y="${y - 3}" width="6" height="6" rx="1"/>`; });
    ["POW", "RUN", "ERR"].forEach((n, i) => {
      s += `<rect class="fx-led st" data-led="${n}" x="404" y="${232 + i * 11}" width="6" height="6" rx="1"/><text class="fx-tiny" x="414" y="${238 + i * 11}">${n}</text>`;
    });
    s += `<rect class="fx-cover" x="482" y="170" width="54" height="170" rx="4"/>` +
      `<text class="fx-tiny" x="488" y="184">RUN</text><rect class="fx-sw" x="490" y="190" width="14" height="26" rx="3"/><rect class="fx-knob" data-led="SW" x="492" y="192" width="10" height="11" rx="2"/><text class="fx-tiny" x="488" y="228">STOP</text>` +
      `<rect class="fx-port" x="490" y="250" width="22" height="12" rx="2"/><text class="fx-tiny" x="488" y="274">USB</text>` +
      `<circle class="fx-port" cx="508" cy="304" r="12"/><text class="fx-tiny" x="486" y="330">RS-422</text>`;
    return s;
  }

  /* ---- outside devices: each returns its drawing and where its wires leave ---- */
  const DEV = {
    button(x, y, o) {
      return { svg: `<rect class="fx-dev" x="${x}" y="${y}" width="74" height="40" rx="6"/><circle class="fx-btn" cx="${x + 20}" cy="${y + 20}" r="11"/>` +
        `<text class="fx-dl" x="${x + 52}" y="${y + 24}">${esc(o.label)}</text>`, pins: { a: [x + 14, y + 40], b: [x + 60, y + 40] } };
    },
    sensor(x, y, o) {
      return { svg: `<rect class="fx-dev" x="${x}" y="${y}" width="120" height="44" rx="6"/><rect class="fx-sens" x="${x + 6}" y="${y + 5}" width="30" height="12" rx="3"/>` +
        `<text class="fx-dl" x="${x + 78}" y="${y + 15}">${esc(o.label)}</text>` +
        `<text class="fx-pin" x="${x + 20}" y="${y + 38}">棕</text><text class="fx-pin" x="${x + 60}" y="${y + 38}">黑</text><text class="fx-pin" x="${x + 100}" y="${y + 38}">藍</text>`,
        pins: { brown: [x + 20, y + 44], black: [x + 60, y + 44], blue: [x + 100, y + 44] } };
    },
    lamp(x, y, o) {
      return { svg: `<rect class="fx-dev" x="${x}" y="${y}" width="70" height="40" rx="6"/><circle class="fx-lamp" data-load="${o.on || ""}" cx="${x + 35}" cy="${y + 20}" r="10"/>` +
        `<path class="fx-x" d="M${x + 28} ${y + 13}l14 14M${x + 42} ${y + 13}l-14 14"/><text class="fx-dl" x="${x + 35}" y="${y + 56}">${esc(o.label)}</text>`,
        pins: { a: [x + 14, y], b: [x + 56, y] } };
    },
    valve(x, y, o) {
      return { svg: `<rect class="fx-dev" x="${x}" y="${y}" width="78" height="40" rx="6"/><rect class="fx-coil" data-load="${o.on || ""}" x="${x + 22}" y="${y + 10}" width="34" height="20" rx="2"/>` +
        `<path class="fx-x" d="M${x + 22} ${y + 30}l34 -20"/><text class="fx-dl" x="${x + 39}" y="${y + 56}">${esc(o.label)}</text>`,
        pins: { a: [x + 14, y], b: [x + 64, y] } };
    },
    psu(x, y, o) {
      return { svg: `<rect class="fx-dev psu" x="${x}" y="${y}" width="86" height="46" rx="6"/><text class="fx-dl" x="${x + 43}" y="${y + 30}">${esc(o.label)}</text>` +
        `<text class="fx-pin" x="${x + 16}" y="${y + 14}">＋</text><text class="fx-pin" x="${x + 70}" y="${y + 14}">－</text>`,
        pins: { plus: [x + 16, y], minus: [x + 70, y] } };
    },
    ac(x, y, o) {
      return { svg: `<rect class="fx-dev psu" x="${x}" y="${y}" width="104" height="44" rx="6"/><text class="fx-dl" x="${x + 52}" y="${y + 18}">${esc(o.label)}</text>` +
        `<text class="fx-pin" x="${x + 16}" y="${y + 38}">L</text><text class="fx-pin" x="${x + 52}" y="${y + 38}">N</text><text class="fx-pin" x="${x + 88}" y="${y + 38}">⏚</text>`,
        pins: { L: [x + 16, y + 44], N: [x + 52, y + 44], PE: [x + 88, y + 44] } };
    },
    pc(x, y, o) {
      return { svg: `<rect class="fx-dev" x="${x}" y="${y}" width="96" height="60" rx="6"/><rect class="fx-screen" x="${x + 10}" y="${y + 8}" width="76" height="36" rx="2"/>` +
        `<text class="fx-dl" x="${x + 48}" y="${y + 30}">GX Works2</text><text class="fx-dl" x="${x + 48}" y="${y + 76}">${esc(o.label)}</text>`, pins: { usb: [x, y + 52] } };
    },
  };

  function resolve(tok, pins) {
    if (Array.isArray(tok)) return { p: tok };
    if (tok.startsWith("T:")) { const t = T[tok.slice(2)]; return { p: [t.x, t.y], term: t }; }
    if (tok.startsWith("P:")) { const q = PART[tok.slice(2)]; return { p: [q[0], q[1]] }; }
    const [d, pin] = tok.slice(2).split(".");
    return { p: pins[d][pin], dev: true };
  }
  function wirePath(pts, pins) {
    const r = pts.map((t) => resolve(t, pins));
    let d = `M${r[0].p[0]} ${r[0].p[1]}`;
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1], b = r[i];
      if (a.p[0] !== b.p[0] && a.p[1] !== b.p[1]) d += (a.term || a.dev) && !b.term ? `L${a.p[0]} ${b.p[1]}` : `L${b.p[0]} ${a.p[1]}`;
      d += `L${b.p[0]} ${b.p[1]}`;
    }
    return d;
  }
  function arrowAt(tok) {
    let x, y, from;
    if (tok.startsWith("T:")) { const t = T[tok.slice(2)]; x = t.x; y = t.y; from = t.block; } else { [x, y, from] = PART[tok.slice(2)]; }
    const rot = { top: 0, bot: 180, left: -90, right: 90 }[from];
    return `<circle class="fx-ring" cx="${x}" cy="${y}" r="15"/><g transform="translate(${x} ${y}) rotate(${rot})"><g class="fx-bob">` +
      `<path class="fx-arrow" d="M0 -56V-22M-10 -34L0 -18L10 -34"/></g></g>`;
  }

  function mount(el, extra) {
    el.classList.add("fx-wrap");
    el.innerHTML = `<svg class="fx-svg" viewBox="0 0 760 560" role="img" aria-label="FX3S-20MT/ES 面板示意圖">` +
      `<g class="fx-devs"></g><g class="fx-panel">${panelSvg()}</g><g class="fx-wires"></g><g class="fx-point"></g></svg>` + (extra || "");
    const svg = el.querySelector("svg");
    return {
      svg,
      setLeds(map) {
        svg.querySelectorAll("[data-led]").forEach((n) => n.classList.toggle("on", !!map[n.dataset.led]));
        svg.querySelectorAll("[data-load]").forEach((n) => n.classList.toggle("on", !!map[n.dataset.load]));
      },
    };
  }

  /* Panel whose lamps follow a running program. */
  function live(el) {
    const m = mount(el);
    m.svg.setAttribute("viewBox", `${BX - 30} ${BY - 8} ${BW + 60} ${BH + 16}`);
    m.setLeds({ POW: 1, RUN: 1, SW: 1 });
    return { svg: m.svg, update(x, y, st) { m.setLeds(Object.assign({ POW: 1, RUN: 1, SW: 1 }, st || {}, x, y)); } };
  }

  /* Step by step wiring animation. scene: {devs:{id:[kind,x,y,opts]}, wires:{id:{pts,c,label}}, steps:[{say,point,wires,devs,leds,flow}]} */
  function player(el, scene) {
    const m = mount(el, `<div class="fx-ctl"><p class="fx-say" aria-live="polite"></p><div class="fx-btns">` +
      `<button type="button" class="small-btn fx-prev">‹ 上一步</button><span class="fx-dots"></span>` +
      `<button type="button" class="small-btn fx-next go">下一步 ›</button><button type="button" class="small-btn fx-auto">▶ 自動播放</button></div></div>`);
    const pins = {}, devSvg = {};
    Object.entries(scene.devs || {}).forEach(([id, [kind, x, y, o]]) => { const d = DEV[kind](x, y, o || {}); pins[id] = d.pins; devSvg[id] = d.svg; });
    let at = 0, timer = null;
    const q = (c) => el.querySelector(c);
    q(".fx-dots").innerHTML = scene.steps.map((_, i) => `<i data-i="${i}"></i>`).join("");
    function show(i, fresh) {
      at = Math.max(0, Math.min(scene.steps.length - 1, i));
      const shownW = new Set(), shownD = new Set(), now = scene.steps[at];
      scene.steps.slice(0, at + 1).forEach((s) => { (s.wires || []).forEach((w) => shownW.add(w)); (s.devs || []).forEach((d) => shownD.add(d)); });
      q(".fx-devs").innerHTML = [...shownD].map((id) => `<g class="${(now.devs || []).includes(id) && fresh ? "fx-fade" : ""}${now.press === id ? " pressed" : ""}">${devSvg[id]}</g>`).join("");
      q(".fx-wires").innerHTML = [...shownW].map((id) => {
        const w = scene.wires[id], d = wirePath(w.pts, pins), isNew = (now.wires || []).includes(id) && fresh;
        return `<path class="fx-wire-bg" d="${d}"/><path class="fx-wire c-${w.c}${isNew ? " fx-new" : ""}" pathLength="1" d="${d}"/>` +
          ((now.flow || []).includes(id) ? `<path class="fx-flow" d="${d}"/>` : "");
      }).join("");
      q(".fx-point").innerHTML = (now.point || []).map(arrowAt).join("");
      m.svg.querySelectorAll(".fx-term").forEach((t) => t.classList.toggle("hot", (now.point || []).includes("T:" + t.dataset.t)));
      m.setLeds(Object.assign({ POW: 1, RUN: 1, SW: 1 }, now.leds || {}));
      q(".fx-say").innerHTML = `<b>${at + 1} / ${scene.steps.length}</b>　${now.say}`;
      q(".fx-dots").querySelectorAll("i").forEach((d, k) => d.classList.toggle("here", k === at));
      q(".fx-prev").disabled = at === 0;
      q(".fx-next").textContent = at === scene.steps.length - 1 ? "↺ 從頭看" : "下一步 ›";
    }
    function stop() { clearInterval(timer); timer = null; q(".fx-auto").textContent = "▶ 自動播放"; }
    q(".fx-prev").onclick = () => { stop(); show(at - 1, false); };
    q(".fx-next").onclick = () => { stop(); show(at === scene.steps.length - 1 ? 0 : at + 1, true); };
    q(".fx-dots").onclick = (e) => { if (e.target.dataset.i) { stop(); show(+e.target.dataset.i, true); } };
    q(".fx-auto").onclick = () => {
      if (timer) { stop(); return; }
      q(".fx-auto").textContent = "⏸ 暫停";
      if (at === scene.steps.length - 1) show(0, true);
      timer = setInterval(() => { if (at === scene.steps.length - 1) stop(); else show(at + 1, true); }, 3800);
    };
    show(0, true);
    return { show };
  }

  /* ---------------- scenes ---------------- */
  const SCENES = {
    parts: { steps: [
      { say: "這是 FX3S-20MT/ES 的正面。上面一排端子接<b>電源和輸入</b>，下面一排接<b>輸出</b>。端子分上下兩層交錯排列，接線前先對端子上印的字。", point: ["P:model"] },
      { say: "<b>上排端子</b>：左邊 L、N、⏚ 是電源，S/S 是輸入共點，右邊 X0～X7、X10～X13 是 12 點輸入。X 是八進位，所以 X7 的下一點是 X10。", point: ["P:topblock"] },
      { say: "<b>下排端子</b>：左邊 0V、24V 是 PLC 自己送出來的直流 24V（給感測器用），右邊 Y0～Y7 是 8 點輸出，COM0～COM4 是輸出共點。", point: ["P:botblock"] },
      { say: "<b>IN 指示燈</b>：每個輸入一顆。按鈕按下、感測器有訊號，對應的燈就亮。燈不亮就是線路問題，跟程式無關。", point: ["P:in-led"], leds: { X0: 1, X3: 1 } },
      { say: "<b>POW / RUN / ERR</b>：POW 亮＝有電；RUN 亮＝程式在跑；ERR 閃＝程式錯誤，ERR 恆亮＝CPU 錯誤。", point: ["P:status"] },
      { say: "<b>OUT 指示燈</b>：程式讓 Y 輸出時亮。燈亮了但負載不動，問題在輸出線路或負載；燈沒亮，回頭查程式。", point: ["P:out-led"], leds: { Y0: 1, Y2: 1 } },
      { say: "<b>RUN / STOP 開關</b>（在右邊的小蓋子裡）：撥到 STOP，程式停止、輸出全部 OFF。寫入程式前通常先切 STOP。", point: ["P:runstop"] },
      { say: "<b>USB 埠</b>（同一個蓋子裡）：用 USB 線接電腦，GX Works2 從這裡寫入程式和監看。", point: ["P:usb"] },
    ] },
    power: {
      devs: { ac: ["ac", 20, 14, { label: "AC100～240V" }] },
      wires: { l: { pts: ["D:ac.L", [36, 72], [T.L.x, 72], "T:L"], c: "brown" }, n: { pts: ["D:ac.N", [72, 82], [T.N.x, 82], "T:N"], c: "blue" },
        pe: { pts: ["D:ac.PE", [108, 62], [T["⏚"].x, 62], "T:⏚"], c: "green" } },
      steps: [
        { say: "<b>先斷電再接線。</b>ES 型吃交流 100～240V。電源只接上排最左邊三個端子：L、N、⏚。", devs: ["ac"], point: ["T:L", "T:N", "T:⏚"] },
        { say: "火線接 <b>L</b>。", wires: ["l"], point: ["T:L"] },
        { say: "中性線接 <b>N</b>。", wires: ["n"], point: ["T:N"] },
        { say: "接地線接 <b>⏚</b>。接地要獨立，不要和大電力設備共用。", wires: ["pe"], point: ["T:⏚"] },
        { say: "<b>絕對不要</b>把交流電接到下排的 24V、0V 或任何 X、Y 端子，PLC 會燒掉。24V 端子是 PLC「送出」電，不能從外面灌電進去。", point: ["T:24V", "T:0V"] },
        { say: "送電後 POW 燈亮。RUN/STOP 撥到 RUN，RUN 燈亮，PLC 開始執行程式。", flow: ["l", "n"], leds: { POW: 1, RUN: 1 } },
      ] },
    sink: {
      devs: { b: ["button", 60, 6, { label: "按鈕" }], s: ["sensor", 590, 6, { label: "NPN 感測器" }] },
      wires: {
        ss: { pts: ["T:S/S", [T["S/S"].x, 78], [194, 78], [194, 446], [T["24V"].x, 446], "T:24V"], c: "red" },
        b1: { pts: ["D:b.b", [120, 60], [T.X0.x, 60], "T:X0"], c: "ink" },
        b2: { pts: ["D:b.a", [74, 66], [178, 66], [178, 462], [T["0V"].x, 462], "T:0V"], c: "blue" },
        s1: { pts: ["D:s.black", [650, 66], [T.X1.x, 66], "T:X1"], c: "ink" },
        s2: { pts: ["D:s.brown", [610, 78], [576, 78], [576, 478], [T["24V"].x, 478], "T:24V"], c: "brown" },
        s3: { pts: ["D:s.blue", [690, 60], [720, 60], [720, 494], [T["0V"].x, 494], "T:0V"], c: "blue" },
      },
      steps: [
        { say: "<b>漏型（Sink）輸入</b>：台灣最常見，配 NPN 感測器。第一步先決定 S/S 接哪裡，這條線決定整台是漏型還是源型。", point: ["T:S/S"] },
        { say: "用一條短線把上排的 <b>S/S</b> 接到下排的 <b>24V</b>。接了這條，所有 X 輸入都是漏型。", wires: ["ss"], point: ["T:S/S", "T:24V"] },
        { say: "按鈕一端接 <b>X0</b>。", devs: ["b"], wires: ["b1"], point: ["T:X0"] },
        { say: "按鈕另一端接下排的 <b>0V</b>。漏型就是：按下去，X 被拉到 0V。", wires: ["b2"], point: ["T:0V"] },
        { say: "按下按鈕：電流從 24V → S/S → PLC 內部 → X0 → 按鈕 → 0V。面板上 IN 0 的燈亮。", press: "b", flow: ["ss", "b1", "b2"], leds: { X0: 1 } },
        { say: "三線式 <b>NPN</b> 近接感測器：<b>黑線（訊號）</b>接 X1。", devs: ["s"], wires: ["s1"], point: ["T:X1"] },
        { say: "<b>棕線</b>接 24V、<b>藍線</b>接 0V，感測器才有電。顏色是業界慣例，接線前還是要看感測器外殼上的標示。", wires: ["s2", "s3"], point: ["T:24V", "T:0V"] },
        { say: "工件靠近：NPN 感測器把黑線接到 0V，X1 ON，IN 1 的燈亮。和按鈕的動作一模一樣。", flow: ["s1", "s3", "ss"], leds: { X1: 1 } },
      ] },
    source: {
      devs: { b: ["button", 60, 6, { label: "按鈕" }], s: ["sensor", 590, 6, { label: "PNP 感測器" }] },
      wires: {
        ss: { pts: ["T:S/S", [T["S/S"].x, 78], [194, 78], [194, 462], [T["0V"].x, 462], "T:0V"], c: "blue" },
        b1: { pts: ["D:b.b", [120, 60], [T.X0.x, 60], "T:X0"], c: "ink" },
        b2: { pts: ["D:b.a", [74, 66], [178, 66], [178, 446], [T["24V"].x, 446], "T:24V"], c: "red" },
        s1: { pts: ["D:s.black", [650, 66], [T.X1.x, 66], "T:X1"], c: "ink" },
        s2: { pts: ["D:s.brown", [610, 78], [576, 78], [576, 478], [T["24V"].x, 478], "T:24V"], c: "brown" },
        s3: { pts: ["D:s.blue", [690, 60], [720, 60], [720, 494], [T["0V"].x, 494], "T:0V"], c: "blue" },
      },
      steps: [
        { say: "<b>源型（Source）輸入</b>：配 PNP 感測器，歐系設備常見。和漏型只差在 S/S 接的地方相反。", point: ["T:S/S"] },
        { say: "把 <b>S/S</b> 接到下排的 <b>0V</b>。", wires: ["ss"], point: ["T:S/S", "T:0V"] },
        { say: "按鈕一端接 <b>X0</b>，另一端接 <b>24V</b>。源型就是：按下去，X 被拉到 24V。", devs: ["b"], wires: ["b1", "b2"], point: ["T:X0", "T:24V"] },
        { say: "按下按鈕：24V → 按鈕 → X0 → PLC 內部 → S/S → 0V。IN 0 的燈亮。", press: "b", flow: ["b2", "b1", "ss"], leds: { X0: 1 } },
        { say: "<b>PNP</b> 感測器：黑線接 X1，棕線 24V，藍線 0V。動作時它把黑線接到 24V。", devs: ["s"], wires: ["s1", "s2", "s3"], point: ["T:X1"] },
        { say: "<b>NPN 和 PNP 不能混用在同一台。</b>S/S 只有一個，整台只能選一種。感測器買錯型，燈永遠不會亮。", flow: ["s1", "s2", "ss"], leds: { X1: 1 } },
      ] },
    output: {
      devs: { p: ["psu", 40, 476, { label: "DC24V 電源" }], l: ["lamp", 300, 476, { label: "指示燈", on: "Y0" }], v: ["valve", 440, 476, { label: "電磁閥", on: "Y1" }] },
      wires: {
        y0: { pts: ["T:Y0", [T.Y0.x, 448], [314, 448], "D:l.a"], c: "ink" },
        l2: { pts: ["D:l.b", [356, 462], [396, 462], [396, 548], [14, 548], [14, 456], [56, 456], "D:p.plus"], c: "red" },
        c0: { pts: ["T:COM0", [T.COM0.x, 440], [110, 440], "D:p.minus"], c: "blue" },
        y1: { pts: ["T:Y1", [T.Y1.x, 456], [454, 456], "D:v.a"], c: "ink" },
        v2: { pts: ["D:v.b", [504, 462], [544, 462], [544, 548], [396, 548]], c: "red" },
        c1: { pts: ["T:COM1", [T.COM1.x, 432], [T.COM0.x, 432]], c: "blue" },
      },
      steps: [
        { say: "<b>MT/ES 是漏型電晶體輸出</b>，只能接直流（DC5～30V），每點最大 0.5A。輸出要自己準備負載電源，PLC 的 Y 只是一個開關。", devs: ["p"], point: ["T:Y0", "T:COM0"] },
        { say: "負載（指示燈）一端接 <b>Y0</b>。", devs: ["l"], wires: ["y0"], point: ["T:Y0"] },
        { say: "負載另一端接電源的 <b>＋24V</b>。", wires: ["l2"] },
        { say: "<b>COM0</b> 接電源的 <b>－（0V）</b>。Y0 的共點是 COM0，接錯 COM 就不會動。", wires: ["c0"], point: ["T:COM0"] },
        { say: "程式讓 Y0 ON：電流從 ＋24V → 燈 → Y0 → PLC 內的電晶體 → COM0 → 0V。OUT 0 燈亮，指示燈亮。", flow: ["l2", "y0", "c0"], leds: { Y0: 1 } },
        { say: "再接一個電磁閥到 <b>Y1</b>。Y1 的共點是 <b>COM1</b>：Y0～Y3 各有自己的 COM0～COM3，Y4～Y7 四點共用 COM4（端子排上有粗線分組）。", devs: ["v"], wires: ["y1", "v2"], point: ["T:Y1", "T:COM1"] },
        { say: "用同一個電源時，把 <b>COM1 跨接到 COM0</b>。忘了這條，Y1 的 OUT 燈會亮但電磁閥不動。", wires: ["c1"], point: ["T:COM1", "T:COM0"] },
        { say: "Y1 ON，電磁閥動作。電磁閥、繼電器這類線圈負載要並聯一顆二極體（續流），不然斷電瞬間的突波會打壞電晶體。", flow: ["v2", "y1", "c1", "c0"], leds: { Y1: 1 } },
      ] },
    usb: {
      devs: { pc: ["pc", 640, 190, { label: "電腦" }] },
      wires: { u: { pts: ["D:pc.usb", [600, 242], [600, 256], [510, 256]], c: "ink" } },
      steps: [
        { say: "打開面板右邊的小蓋子，裡面有 RUN/STOP 開關和 USB 埠。", point: ["P:usb"] },
        { say: "用 USB 線（Mini-B 接頭）把 PLC 接到電腦。", devs: ["pc"], wires: ["u"], point: ["P:usb"] },
        { say: "寫入前把開關撥到 <b>STOP</b>（或讓 GX Works2 遠端 STOP）。RUN 燈滅，輸出全部 OFF。", point: ["P:runstop"], leds: { RUN: 0, SW: 0 } },
        { say: "GX Works2：連接目標選 Serial USB → 通訊測試 → 在線 → PLC 寫入。寫入時資料從電腦送進 PLC。", flow: ["u"], leds: { RUN: 0, SW: 0 } },
        { say: "寫完撥回 <b>RUN</b>，RUN 燈亮。接著在 GX Works2 按 F3 監看，畫面上的接點會跟著面板的 IN 燈一起變。", point: ["P:runstop"], leds: { X0: 1, Y0: 1 } },
      ] },
  };

  function auto() {
    document.querySelectorAll("[data-fx3s]").forEach((el) => {
      const s = SCENES[el.dataset.fx3s];
      if (s && !el.dataset.done) { el.dataset.done = "1"; player(el, s); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto); else auto();
  return { live, player, SCENES, T };
})();
