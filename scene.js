"use strict";
/* Dual gantry scene, top view. st: Lab.state() from engine/bridge.py. Shared by the fault-finding page. */
function drawGantryScene(canvas, st, labels) {
  labels = labels || { belt_f: "前輸送帶 →", belt_r: "← 後輸送帶", lg: "左龍門", rg: "右龍門", waiting: "等待中", alarm: "異常" };
  const cx = canvas.getContext("2d"), L = 90, R = 550, FY = 290, RY = 80;
  const ay = (axis) => FY - (axis / 1000) * (FY - RY);
  cx.clearRect(0, 0, 640, 360);
  cx.fillStyle = cssVar("--bg"); cx.fillRect(0, 0, 640, 360);
  for (const [y, label] of [[FY, labels.belt_f], [RY, labels.belt_r]]) {
    cx.fillStyle = cssVar("--belt"); cx.fillRect(L - 20, y - 16, R - L + 40, 32);
    if (st.y[2]) {
      cx.strokeStyle = cssVar("--rail"); const off = (st.time / 8) % 24;
      for (let x = L - 20 + off; x < R + 20; x += 24) { cx.beginPath(); cx.moveTo(x, y - 16); cx.lineTo(x, y + 16); cx.stroke(); }
    }
    cx.fillStyle = cssVar("--mute"); cx.font = "13px system-ui"; cx.fillText(label, 270, y + 34);
  }
  for (const [x, g, name] of [[L, st.left, labels.lg], [R, st.right, labels.rg]]) {
    cx.strokeStyle = cssVar("--rail"); cx.lineWidth = 6; cx.beginPath(); cx.moveTo(x, RY - 40); cx.lineTo(x, FY + 40); cx.stroke(); cx.lineWidth = 1;
    const y = ay(Math.max(-40, Math.min(1040, g.axis))), s = 26 + 10 * g.z;
    cx.fillStyle = g.z > 0.5 ? cssVar("--on") : cssVar("--card"); cx.strokeStyle = cssVar("--ink"); cx.lineWidth = 2;
    cx.fillRect(x - s / 2, y - s / 2, s, s); cx.strokeRect(x - s / 2, y - s / 2, s, s);
    if (g.vac) { cx.strokeStyle = "#ffb300"; cx.beginPath(); cx.arc(x, y, s / 2 + 6, 0, 7); cx.stroke(); }
    cx.lineWidth = 1; cx.fillStyle = cssVar("--ink"); cx.font = "12px system-ui";
    cx.fillText(name, x < 320 ? x - 80 : x + 22, y + 4);
  }
  let waiting = 0;
  for (const [id, on, pos] of st.parts) {
    let x, y;
    if (on === "front") { if (pos < 0) { waiting++; continue; } x = L + (pos / 1000) * (R - L); y = FY; }
    else if (on === "rear") { x = R - (pos / 1000) * (R - L); y = RY; }
    else if (on === "R") { x = R; y = ay(st.right.axis); }
    else if (on === "L") { x = L; y = ay(st.left.axis); }
    else continue;
    cx.fillStyle = "#e8833a"; cx.fillRect(x - 9, y - 9, 18, 18);
    cx.fillStyle = "#fff"; cx.font = "10px system-ui"; cx.fillText(id, x - 3, y + 4);
  }
  if (waiting) { cx.fillStyle = cssVar("--mute"); cx.font = "12px system-ui"; cx.fillText(`${labels.waiting} ${waiting}`, 8, FY + 4); }
  if (st.estop || st.alarm) {
    cx.fillStyle = "rgba(198,40,40,.12)"; cx.fillRect(0, 0, 640, 360);
    cx.fillStyle = "#c62828"; cx.font = "bold 20px system-ui"; cx.fillText(st.estop ? "E-STOP" : labels.alarm, 20, 30);
  }
}
