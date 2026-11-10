"use strict";
/* Drawings of the practice machines (engine/plants.py state()). Canvas 260 x 170. */
function drawPlant(ctx, p) {
  const W = 260, H = 170;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = cssVar("--bg"); ctx.fillRect(0, 0, W, H);
  const txt = (t, x, y, c, size) => { ctx.fillStyle = c || cssVar("--mute"); ctx.font = (size || 11) + "px system-ui"; ctx.fillText(t, x, y); };
  if (p.type === "cylinder") {
    ctx.fillStyle = cssVar("--rail"); ctx.fillRect(110, 8, 40, 30);
    ctx.fillStyle = cssVar("--belt"); ctx.fillRect(124, 38, 12, p.z * 80);
    ctx.fillStyle = p.vac ? "#2fbf5b" : "#d0a020"; ctx.fillRect(104, 38 + p.z * 80, 52, 14);
    txt(p.z >= 0.98 ? "X1 下限" : p.z <= 0.02 ? "X2 上限" : "", 165, 48 + p.z * 80);
    if (p.stuck) txt("氣缸卡住", 10, 20, "#c62828", 13);
    ctx.fillStyle = cssVar("--line"); ctx.fillRect(60, 150, 140, 8);
  } else if (p.type === "tank") {
    const x0 = 90, y0 = 20, w = 90, h = 130;
    ctx.fillStyle = "#4da3ff"; ctx.fillRect(x0, y0 + h * (1 - p.level), w, h * p.level);
    ctx.strokeStyle = cssVar("--ink"); ctx.lineWidth = 2; ctx.strokeRect(x0, y0, w, h); ctx.lineWidth = 1;
    [[0.95, "X4 溢流"], [0.8, "X3 高"], [0.2, "X2 低"]].forEach(([lv, t]) => {
      const y = y0 + h * (1 - lv); ctx.strokeStyle = cssVar("--rail"); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x0 - 6, y); ctx.lineTo(x0 + w + 6, y); ctx.stroke(); ctx.setLineDash([]);
      txt(t, x0 + w + 10, y + 4); });
    ctx.fillStyle = p.inlet ? "#4da3ff" : cssVar("--line"); ctx.fillRect(20, y0 + 4, x0 - 20, 8); txt("進水 Y0", 20, y0 - 2);
    ctx.fillStyle = p.drain ? "#4da3ff" : cssVar("--line"); ctx.fillRect(x0 + w / 2 - 4, y0 + h, 8, 14);
    txt(Math.round(p.level * 100) + "%", x0 + 30, y0 + h / 2, cssVar("--ink"), 16);
  } else if (p.type === "door") {
    const x0 = 40, w = 180, y = 30, h = 110, gap = (w / 2) * p.pos;
    ctx.fillStyle = cssVar("--line"); ctx.fillRect(x0, y, w, h);
    ctx.fillStyle = cssVar("--card"); ctx.fillRect(x0 + w / 2 - gap, y, gap * 2, h);
    ctx.fillStyle = cssVar("--rail"); ctx.fillRect(x0 - gap, y, w / 2, h); ctx.fillRect(x0 + w / 2 + gap, y, w / 2, h);
    ctx.fillStyle = cssVar("--bg"); ctx.fillRect(0, y, x0, h); ctx.fillRect(x0 + w, y, W - x0 - w, h);
    if (p.person) { ctx.fillStyle = "#e8833a"; ctx.beginPath(); ctx.arc(W / 2, y + 40, 12, 0, 7); ctx.fill(); ctx.fillRect(W / 2 - 10, y + 54, 20, 40); }
    if (p.beam) { ctx.strokeStyle = "#c62828"; ctx.beginPath(); ctx.moveTo(x0, y + 90); ctx.lineTo(x0 + w, y + 90); ctx.stroke(); }
    txt(p.open ? "開門中" : p.close ? "關門中" : p.pos >= 0.99 ? "全開" : p.pos <= 0.01 ? "全關" : "", 10, 18, cssVar("--ink"), 13);
    if (p.crush) txt("⚠ 夾到人！", 160, 18, "#c62828", 13);
  } else if (p.type === "door2") {
    const x0 = 20, w = 150, y = 40, h = 100, open = w * p.pos;
    ctx.fillStyle = cssVar("--card"); ctx.fillRect(x0, y, w, h);
    ctx.fillStyle = cssVar("--rail"); ctx.fillRect(x0 + open, y, Math.max(w - open, 2), h);   // panel slides into the pocket at LS1
    ctx.fillStyle = cssVar("--line"); ctx.fillRect(x0 + w, y, 8, h);
    ctx.strokeStyle = cssVar("--ink"); ctx.strokeRect(x0, y, w, h);
    txt("LS2", x0 - 4, y + h + 14, p.pos <= 0.01 ? cssVar("--on") : cssVar("--mute")); txt("LS1", x0 + w - 14, y + h + 14, p.pos >= 0.99 ? cssVar("--on") : cssVar("--mute"));
    if (p.beam) { ctx.strokeStyle = "#c62828"; ctx.beginPath(); ctx.moveTo(x0, y + 80); ctx.lineTo(x0 + w, y + 80); ctx.stroke(); txt("光電遮斷", x0 + 4, y + 76, "#c62828"); }
    txt(p.open ? "開門中" : p.close ? "關門中" : p.pos >= 0.99 ? "全開" : p.pos <= 0.01 ? "全閉" : "停在中間", 10, 18, cssVar("--ink"), 13);
    txt(p.auto ? "COS 2 自動關門" : "COS 1 手動", 90, 18);
    if (!p.th) txt("TH 跳脫", 10, 34, "#c62828", 12);
    if (p.crush) txt("⚠ 夾到人！", 120, 34, "#c62828", 13);
    [["pl1", "PL1", "#2fbf5b"], ["pl2", "PL2", "#e03131"], ["pl3", "PL3", "#ffcc33"], ["pl4", "PL4", "#ff8c1a"], ["bz", "BZ", "#c62828"]].forEach(([k, t, col], i) => {
      ctx.fillStyle = p[k] ? col : cssVar("--line"); ctx.beginPath(); ctx.arc(222, 30 + i * 26, 8, 0, 7); ctx.fill(); txt(t, 234, 34 + i * 26); });
  } else if (p.type === "belt3") {
    ["M1", "M2", "M3"].forEach((name, i) => {
      const y = 34 + i * 40, x0 = 40, x1 = 190;
      ctx.fillStyle = cssVar("--belt"); ctx.fillRect(x0, y, x1 - x0, 14);
      for (let k = 0; k < 4; k++) {
        const x = x0 + (((p.travel[i] * 40 + k * 38) % (x1 - x0)) + (x1 - x0)) % (x1 - x0);
        ctx.fillStyle = cssVar("--rail"); ctx.fillRect(x, y + 2, 4, 10);
      }
      ctx.fillStyle = p.run[i] ? "#2fbf5b" : cssVar("--line"); ctx.beginPath(); ctx.arc(24, y + 7, 9, 0, 7); ctx.fill();
      txt(name, 8, y + 28);
      if (!p.th[i]) txt("TH" + (i + 1) + " 跳脫", x0 + 40, y + 28, "#c62828", 11);
    });
    txt(!p.ems ? "緊急停止中" : p.cos ? "COS 2" : "COS 1", 10, 18, !p.ems ? "#c62828" : cssVar("--ink"), 12);
    [["PL1", "#2fbf5b"], ["PL2", "#2fbf5b"], ["PL3", "#2fbf5b"], ["PL4", "#ffcc33"], ["PL5", "#e03131"]].forEach(([t, col], i) => {
      ctx.fillStyle = p.lamps[i] ? col : cssVar("--line"); ctx.beginPath(); ctx.arc(214, 14 + i * 26, 8, 0, 7); ctx.fill(); txt(t, 226, 18 + i * 26); });
    ctx.fillStyle = p.bz ? "#c62828" : cssVar("--line"); ctx.beginPath(); ctx.arc(214, 144, 8, 0, 7); ctx.fill(); txt("BZ", 226, 148);
  } else if (p.type === "sump") {
    const x0 = 70, y0 = 22, w = 80, h = 112, n = p.pxs.reduce((a, b) => a + b, 0);
    ctx.fillStyle = "#7a8f5a"; ctx.fillRect(x0, y0 + h * (1 - n / 7), w, h * n / 7);
    ctx.strokeStyle = cssVar("--ink"); ctx.lineWidth = 2; ctx.strokeRect(x0, y0, w, h); ctx.lineWidth = 1;
    p.pxs.forEach((on, i) => { const y = y0 + h * (1 - (i + 1) / 7);
      ctx.fillStyle = on ? cssVar("--on") : cssVar("--line"); ctx.beginPath(); ctx.arc(x0 - 8, y, 4, 0, 7); ctx.fill(); txt("S" + (i + 1), x0 - 32, y + 4); });
    ctx.fillStyle = p.sv ? "#7a8f5a" : cssVar("--line"); ctx.fillRect(x0 + 10, y0 - 10, 8, 10); txt("SV", x0 + 22, y0 - 2);
    ctx.fillStyle = p.m1 ? "#2fbf5b" : cssVar("--line"); ctx.beginPath(); ctx.arc(x0 + 8, y0 + h + 16, 6, 0, 7); ctx.fill(); txt("M1", x0 + 18, y0 + h + 20);
    ctx.fillStyle = p.m2 ? "#2fbf5b" : cssVar("--line"); ctx.beginPath(); ctx.arc(x0 + 8, y0 + h + 32, 6, 0, 7); ctx.fill();
    txt("M2" + (p.m2 ? (p.fast ? " 100%" : " 40%") : ""), x0 + 18, y0 + h + 36);
    txt(["COS 0 停機", "COS 1 手動", "COS 2 自動"][p.cos], 8, 14, cssVar("--ink"), 12);
    if (!p.ems) txt("緊急停止", 8, 30, "#c62828", 12);
    if (p.trip[0] || p.trip[1]) txt("過載", 8, 46, "#c62828", 12);
    [["PL1", p.pl1, "#2fbf5b"], ["PL2", p.pl2, "#2fbf5b"], ["PL4", p.code[0], "#ffcc33"], ["PL5", p.code[1], "#ffcc33"], ["PL6", p.code[2], "#ffcc33"], ["BZ", p.bz, "#c62828"]]
      .forEach(([t, on, col], i) => { ctx.fillStyle = on ? col : cssVar("--line"); ctx.beginPath(); ctx.arc(206, 14 + i * 24, 7, 0, 7); ctx.fill(); txt(t, 218, 18 + i * 24); });
    const code = p.code[0] * 4 + p.code[1] * 2 + p.code[2];
    txt("訊息碼 " + code, 186, 162, cssVar("--ink"), 12);
  } else if (p.type === "pumps2") {
    ctx.strokeStyle = cssVar("--ink"); ctx.strokeRect(20, 24, 60, 50); ctx.strokeRect(20, 118, 90, 34);
    ctx.fillStyle = "#4da3ff"; ctx.fillRect(21, p.tower_low ? 62 : 32, 58, p.tower_low ? 11 : 41);
    ctx.fillRect(21, p.pool_ok ? 122 : 143, 88, p.pool_ok ? 29 : 8);
    txt("水塔" + (p.tower_low ? " 缺水" : ""), 22, 18, p.tower_low ? "#c62828" : cssVar("--mute")); txt("蓄水池" + (p.pool_ok ? "" : " 缺水"), 22, 166, p.pool_ok ? cssVar("--mute") : "#c62828");
    ["#1", "#2"].forEach((t, i) => { const x = 100 + i * 36;
      ctx.fillStyle = p.run[i] ? "#2fbf5b" : cssVar("--line"); ctx.beginPath(); ctx.arc(x, 88, 10, 0, 7); ctx.fill(); txt(t, x - 7, 112);
      if (!p.th[i]) txt("TH" + (i + 1), x - 10, 72, "#c62828", 10); });
    txt(["COS 0 手動交替", "COS 1 自動交替", "COS 2 緊急抽水"][p.cos], 96, 18, cssVar("--ink"), 11);
    [["PL1", 0], ["PL2", 1], ["PL3", 2], ["PL4", 3], ["PL5", 4], ["PL6", 5]].forEach(([t, k], i) => {
      ctx.fillStyle = p.lamps[k] ? "#e03131" : "#2fbf5b"; ctx.beginPath(); ctx.arc(196, 30 + i * 20, 6, 0, 7); ctx.fill(); txt(t, 206, 34 + i * 20); });
    ctx.fillStyle = p.ems_lamp ? "#e03131" : "#2fbf5b"; ctx.beginPath(); ctx.arc(196, 150, 6, 0, 7); ctx.fill(); txt("EMS", 206, 154);
    ctx.fillStyle = p.bz ? "#c62828" : cssVar("--line"); ctx.beginPath(); ctx.arc(240, 150, 6, 0, 7); ctx.fill(); txt("BZ", 236, 166);
  } else if (p.type === "pneu") {
    const rows = [["A", p.a, ["a0", "a1", "a2"]], ["B", p.b, ["b0", "b1"]], ["C", p.c, ["c0", "c1"]]];
    rows.forEach(([name, pos, marks], i) => {
      const y = 22 + i * 46, x0 = 30, len = 120;
      ctx.fillStyle = cssVar("--rail"); ctx.fillRect(x0, y, 60, 24);                       // barrel
      ctx.fillStyle = cssVar("--ink"); ctx.fillRect(x0 + 60, y + 9, pos * len, 6);         // rod
      ctx.fillStyle = cssVar("--on"); ctx.fillRect(x0 + 60 + pos * len - 4, y + 3, 8, 18);  // rod end
      txt(name, 8, y + 17, cssVar("--ink"), 14);
      marks.forEach((m, k) => {
        const at = marks.length === 3 ? [0, 0.5, 1][k] : [0, 1][k];
        txt(m, x0 + 56 + at * len, y + 38);
      });
    });
    [["green", "#2fbf5b"], ["red", "#e03131"], ["yellow", "#ffcc33"]].forEach(([k, col], i) => {
      ctx.fillStyle = p[k] ? col : cssVar("--line"); ctx.beginPath(); ctx.arc(244, 30 + i * 30, 9, 0, 7); ctx.fill(); });
    if (p.fast) txt("快速", 210, 160, cssVar("--warn"), 12);
  } else if (p.type === "pneuset") {
    p.cyl.forEach((c, i) => {
      const y = 22 + i * 46, x0 = 30, len = 120;
      ctx.fillStyle = cssVar("--rail"); ctx.fillRect(x0, y, 60, 24);
      ctx.fillStyle = cssVar("--ink"); ctx.fillRect(x0 + 60, y + 9, c.pos * len, 6);
      ctx.fillStyle = cssVar("--on"); ctx.fillRect(x0 + 60 + c.pos * len - 4, y + 3, 8, 18);
      txt(c.name, 8, y + 17, cssVar("--ink"), 14);
      c.marks.forEach(([at, lab]) => txt(lab, x0 + 56 + at * len, y + 38));
    });
    [["green", "#2fbf5b"], ["red", "#e03131"], ["yellow", "#ffcc33"]].forEach(([k, col], i) => {
      ctx.fillStyle = p[k] ? col : cssVar("--line"); ctx.beginPath(); ctx.arc(244, 30 + i * 30, 9, 0, 7); ctx.fill(); });
  } else if (p.type === "conveyor") {
    const y = 90, x0 = 10, x1 = 250, sx = 170;
    ctx.fillStyle = cssVar("--belt"); ctx.fillRect(x0, y - 12, x1 - x0, 24);
    for (let i = 0; i < 6; i++) {
      const pos = ((p.travel - i) % 6 + 6) % 6;           // a part every second, 6 on the belt
      const x = x0 + 20 + (pos / 6) * (x1 - x0 - 40) * 1.0;
      ctx.fillStyle = "#e8833a"; ctx.fillRect(x - 8, y - 22, 16, 14);
    }
    ctx.fillStyle = p.sensor ? cssVar("--on") : cssVar("--line"); ctx.beginPath(); ctx.arc(sx, y + 26, 7, 0, 7); ctx.fill(); txt("X2", sx - 6, y + 46);
    ctx.fillStyle = p.full_lamp ? "#ffcc33" : cssVar("--line"); ctx.beginPath(); ctx.arc(230, 30, 12, 0, 7); ctx.fill(); txt("滿箱 Y1", 200, 58);
    txt((p.run ? "運轉中　" : "停止　") + "已通過 " + p.passed + " 個", 10, 30, cssVar("--ink"), 13);
  } else if (p.type === "sorter") {
    const x0 = 14, x1 = 236, y = 78, L = x1 - x0, X = (f) => x0 + f * L;
    ctx.fillStyle = cssVar("--belt"); ctx.fillRect(x0, y, L, 16);
    for (let k = 0; k < 12; k++) { ctx.fillStyle = cssVar("--rail"); ctx.fillRect(x0 + k * (L / 12), y + 16, 2, 6); }
    ctx.fillStyle = p.run ? "#2fbf5b" : cssVar("--line"); ctx.beginPath(); ctx.arc(x0 + 4, y + 30, 7, 0, 7); ctx.fill(); txt("Y0 馬達", x0 + 14, y + 34);
    p.parts.forEach(([f, metal]) => { ctx.fillStyle = metal ? "#9aa4b4" : "#e8833a"; ctx.fillRect(X(f) - 9, y - 16, 18, 16); if (metal) { ctx.fillStyle = "#5b6576"; ctx.fillRect(X(f) - 9, y - 16, 18, 3); } });
    [["X0", p.marks[0], p.sens[0], "入口"], ["X1", p.marks[1], p.sens[1], "金屬"], ["X2", p.marks[2], p.sens[2], "推料前"]].forEach(([n, f, on, t]) => {
      ctx.fillStyle = on ? cssVar("--on") : cssVar("--line"); ctx.beginPath(); ctx.arc(X(f), y - 30, 6, 0, 7); ctx.fill();
      ctx.strokeStyle = on ? cssVar("--on") : cssVar("--line"); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X(f), y - 24); ctx.lineTo(X(f), y); ctx.stroke(); ctx.setLineDash([]);
      txt(n + " " + t, X(f) - 16, y - 40);
    });
    const px = X(p.marks[2]), body = y + 92, rod = 6 + p.push * 60;
    ctx.fillStyle = cssVar("--rail"); ctx.fillRect(px - 12, body, 24, 14); ctx.fillRect(px - 3, body - rod, 6, rod); ctx.fillRect(px - 10, body - rod - 4, 20, 4);
    ctx.fillStyle = p.sens[3] ? cssVar("--on") : cssVar("--line"); ctx.fillRect(px + 18, body + 2, 8, 8); txt("X3 後退端", px + 28, body + 10);
    ctx.fillStyle = p.sens[4] ? cssVar("--on") : cssVar("--line"); ctx.fillRect(px + 18, body - 12, 8, 8); txt("X4 前進端", px + 28, body - 4);
    txt("Y1 推料", px - 64, body + 10);
    ctx.strokeStyle = cssVar("--ink"); ctx.strokeRect(px - 22, 4, 44, 28); txt("B 箱 " + p.b, px - 20, 22, cssVar("--ink"));
    ctx.strokeRect(x1 - 4, y - 6, 22, 40); txt("A " + p.a, x1 - 4, y + 48, cssVar("--ink"));
    txt("灰 = 金屬　橘 = 塑膠", 4, 14);
    if (p.wrong) txt("分錯 " + p.wrong + " 個", 4, 30, "#c62828", 12);
  } else if (p.type === "stepper") {
    const x0 = 20, x1 = 240, y = 70, X = (mm) => x0 + (mm / 200) * (x1 - x0);
    ctx.fillStyle = cssVar("--rail"); ctx.fillRect(x0 - 6, y + 20, x1 - x0 + 12, 6);
    for (let k = 0; k <= 40; k++) { ctx.fillStyle = cssVar("--line"); ctx.fillRect(x0 + k * (x1 - x0) / 40, y + 21, 1, 4); }
    ctx.fillStyle = cssVar("--ink"); ctx.fillRect(x0 - 18, y + 12, 14, 22); txt("M", x0 - 15, y + 27, "#fff", 10);
    ctx.fillStyle = p.crush || p.crash ? "#c62828" : "#4d8dff"; ctx.fillRect(X(p.mm) - 14, y - 4, 28, 24);
    [["X0 原點", 0, p.sens[0]], ["X2 100mm", 100, p.sens[2]], ["X1 極限", 198, p.sens[1]]].forEach(([t, mm, on]) => {
      ctx.fillStyle = on ? cssVar("--on") : cssVar("--line"); ctx.beginPath(); ctx.arc(X(mm), y + 44, 6, 0, 7); ctx.fill(); txt(t, X(mm) - 18, y + 62);
    });
    txt("實際位置 " + p.mm.toFixed(1) + " mm", 10, 16, cssVar("--ink"), 13);
    txt("D8140 脈波計數 " + p.counter + "（= " + (p.counter / 100).toFixed(1) + " mm）", 10, 34);
    txt((p.pulse ? "Y0 送脈波中　" : "Y0 停　") + (p.pulse ? (p.dir ? "方向 Y4 ON 正轉" : "方向 Y4 OFF 反轉") : ""), 10, 50, p.pulse ? cssVar("--on") : cssVar("--mute"));
    if (p.crash) txt("⚠ 撞到機構端點！", 130, 16, "#c62828", 13);
  } else if (p.type === "traffic") {
    ctx.fillStyle = cssVar("--belt"); ctx.fillRect(100, 0, 60, 190); ctx.fillRect(0, 70, 260, 50);
    ctx.fillStyle = cssVar("--card"); for (let k = 0; k < 6; k++) { ctx.fillRect(104 + k * 9, 124, 5, 18); ctx.fillRect(104 + k * 9, 48, 5, 18); }
    const lamp = (x, y, on, col) => { ctx.fillStyle = on ? col : "#2a2f37"; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); };
    const head = (x, y, ys, label, vertical) => {
      ctx.fillStyle = "#1b1f26"; vertical ? ctx.fillRect(x - 10, y - 10, 20, 58) : ctx.fillRect(x - 10, y - 10, 58, 20);
      ["#e03131", "#ffcc33", "#2fbf5b"].forEach((c, k) => lamp(vertical ? x : x + k * 19, vertical ? y + k * 19 : y, ys[k], c));
      txt(label, vertical ? x - 12 : x - 10, vertical ? y + 62 : y + 24);
    };
    head(178, 10, p.ns, "南北", true); head(14, 140, p.ew, "東西", false);
    ctx.fillStyle = p.walk ? "#2fbf5b" : "#2a2f37"; ctx.fillRect(200, 140, 26, 26); txt("行人", 202, 182);
    if (p.waiting) txt("有人在等", 196, 132, "#b26a00");
    if (p.crash) txt("⚠ 兩邊同時綠燈！", 6, 16, "#c62828", 13);
  } else if (p.type === "elevator") {
    const top = 14, fh = 56, X = 90, W = 70, yOf = (f) => top + (2 - f) * fh;
    ctx.strokeStyle = cssVar("--rail"); ctx.strokeRect(X - 6, top - 6, W + 12, fh * 3 + 6);
    [0, 1, 2].forEach((f) => {
      const y = yOf(f) + fh - 4;
      ctx.fillStyle = cssVar("--line"); ctx.fillRect(X - 30, y, 24, 3); ctx.fillRect(X + W + 6, y, 24, 3);
      ctx.fillStyle = p.lamps[f] ? "#ffcc33" : cssVar("--line"); ctx.beginPath(); ctx.arc(X + W + 40, yOf(f) + 18, 7, 0, 7); ctx.fill();
      ctx.fillStyle = p.calls[f] ? cssVar("--on") : cssVar("--line"); ctx.beginPath(); ctx.arc(X - 40, yOf(f) + 28, 7, 0, 7); ctx.fill();
      txt((f + 1) + "F", X - 66, yOf(f) + 32);
    });
    const cy = yOf(p.pos) + 6;
    ctx.fillStyle = p.crash ? "#c62828" : "#4d8dff"; ctx.fillRect(X, cy, W, fh - 12);
    ctx.fillStyle = cssVar("--card"); ctx.fillRect(X + W / 2 - 1, cy + 4, 2, fh - 20);
    txt(p.up ? "▲ Y0 上升" : p.down ? "▼ Y1 下降" : "停", 4, 186, p.up || p.down ? cssVar("--on") : cssVar("--mute"));
    txt("呼叫", X - 50, 10); txt("樓層燈", X + W + 24, 10);
    if (p.crash) txt("⚠ 撞到！", 4, 14, "#c62828", 13);
  } else if (p.type === "arm") {
    const x0 = 40, x1 = 210, rail = 22, hx = x0 + p.h * (x1 - x0), vy = rail + 18 + p.v * 90;
    ctx.fillStyle = cssVar("--rail"); ctx.fillRect(x0 - 20, rail - 6, x1 - x0 + 40, 10);
    ctx.fillStyle = cssVar("--ink"); ctx.fillRect(hx - 14, rail - 10, 28, 18);
    ctx.fillStyle = cssVar("--belt"); ctx.fillRect(hx - 4, rail + 8, 8, vy - rail - 8);
    ctx.fillStyle = p.grip ? "#2fbf5b" : "#d0a020"; ctx.fillRect(hx - 14, vy, 6, 16); ctx.fillRect(hx + 8, vy, 6, 16);
    if (p.held) { ctx.fillStyle = "#e8833a"; ctx.fillRect(hx - 8, vy + 4, 16, 14); }
    ctx.fillStyle = cssVar("--line"); ctx.fillRect(x0 - 20, 148, 50, 8); ctx.fillRect(x1 - 30, 148, 50, 8);
    if (p.waiting) { ctx.fillStyle = "#e8833a"; ctx.fillRect(x0 - 8, 134, 16, 14); }
    txt("取料 X4", x0 - 20, 170); txt("放料：已放 " + p.placed, x1 - 50, 170);
    [["X0", x0, p.h <= 0.02], ["X1", x1, p.h >= 0.98]].forEach(([t, x, on]) => { ctx.fillStyle = on ? cssVar("--on") : cssVar("--line"); ctx.fillRect(x - 3, 4, 6, 6); txt(t, x + 5, 11); });
    txt("上 X2 " + (p.v <= 0.02 ? "●" : "○") + "　下 X3 " + (p.v >= 0.98 ? "●" : "○"), 70, 186);
    if (p.dropped) txt("掉了 " + p.dropped + " 個", 196, 186, "#c62828");
  }
}
