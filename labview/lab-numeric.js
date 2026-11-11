"use strict";
/* Numeric lab: integer wrap-around on a dial, float-to-integer saturation, rounding on a number line,
   Quotient & Remainder as grouping and as a milliseconds converter. */
(function () {
  const $ = (id) => document.getElementById(id);
  $("tabs").querySelectorAll("button").forEach((b) => b.onclick = () => {
    $("tabs").querySelectorAll("button").forEach((x) => x.classList.toggle("here", x === b));
    ["ovf", "round", "qr"].forEach((t) => { $("t-" + t).hidden = t !== b.dataset.t; });
    try { history.replaceState(null, "", "#" + b.dataset.t); } catch (e) { /* file:// */ }
  });
  const h = location.hash.slice(1);
  if (["round", "qr"].includes(h)) $("tabs").querySelector(`[data-t="${h}"]`).click();

  /* ---------- integer types ---------- */
  const T = { U8: [0, 255], I8: [-128, 127], U16: [0, 65535], I16: [-32768, 32767], I32: [-2147483648, 2147483647] };
  const wrap = (v, t) => { const [lo, hi] = T[t], n = hi - lo + 1; return ((v - lo) % n + n) % n + lo; };
  let val = 250, turns = 0;
  function dialSvg() {
    const t = $("rep").value, [lo, hi] = T[t];
    const marks = [Math.round(lo + (hi - lo) / 4), Math.round(lo + (hi - lo) / 2), Math.round(lo + 3 * (hi - lo) / 4)];
    const ang = (v) => (v - lo) / (hi - lo + 1) * 360;
    $("dial").innerHTML = `<circle cx="130" cy="130" r="110" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="16"/>` +
      `<path d="M130 20 A110 110 0 0 1 132 20" stroke="#dc2626" stroke-width="16"/>` +
      marks.map((m) => { const a = (ang(m) - 90) * Math.PI / 180; return `<text x="${130 + 86 * Math.cos(a)}" y="${134 + 86 * Math.sin(a)}" text-anchor="middle">${m}</text>`; }).join("") +
      `<text x="130" y="16" text-anchor="middle" fill="#dc2626">↻ 繞回點</text><text x="130" y="52" text-anchor="middle">${hi}｜${lo}</text>` +
      `<g class="needle" id="needle"><line x1="130" y1="130" x2="130" y2="34" stroke="#1e5bd7" stroke-width="5" stroke-linecap="round"/><circle cx="130" cy="130" r="8" fill="#1e5bd7"/></g>`;
    $("drange").textContent = `${t}：${lo} ～ ${hi}（${hi - lo + 1} 個值）。`;
  }
  function setNeedle(animate) {
    const t = $("rep").value, [lo, hi] = T[t];
    const deg = (val - lo) / (hi - lo + 1) * 360 + turns * 360;
    const n = $("needle"); if (!n) return;
    if (!animate) n.style.transition = "none";
    n.style.transform = `rotate(${deg}deg)`;
    if (!animate) { void n.getBoundingClientRect(); n.style.transition = ""; }
    $("dval").textContent = val;
  }
  function add(d) {
    const t = $("rep").value, raw = val + d, nv = wrap(raw, t);
    if (raw > T[t][1]) { turns++; $("dflag").textContent = `溢位！${val} + ${d} 超過上限 ${T[t][1]}，繞回到 ${nv}。`; }
    else if (raw < T[t][0]) { turns--; $("dflag").textContent = `溢位！${val} − ${-d} 低於下限 ${T[t][0]}，繞回到 ${nv}。`; }
    else $("dflag").textContent = "";
    val = nv; setNeedle(true);
  }
  document.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => add(+b.dataset.d));
  $("tomax").onclick = () => { val = T[$("rep").value][1]; $("dflag").textContent = ""; setNeedle(true); };
  $("tomin").onclick = () => { val = T[$("rep").value][0]; $("dflag").textContent = ""; setNeedle(true); };
  $("rep").onchange = () => { val = Math.min(Math.max(val, T[$("rep").value][0]), T[$("rep").value][1]); turns = 0; dialSvg(); setNeedle(false); $("dflag").textContent = ""; };
  dialSvg(); setNeedle(false);

  /* float to integer: round to nearest (ties to even), then saturate */
  const roundEven = (x) => { const f = Math.floor(x), d = x - f; return d > .5 ? f + 1 : d < .5 ? f : (f % 2 === 0 ? f : f + 1); };
  function conv() {
    const x = Number($("cin").value), t = $("cto").value, [lo, hi] = T[t];
    if (!Number.isFinite(x)) { $("cout").textContent = "?"; return; }
    const r = roundEven(x), out = Math.min(Math.max(r, lo), hi);
    $("cout").textContent = out;
    $("cwhy").textContent = r > hi ? `${x} 捨入成 ${r}，超過 ${t} 上限，夾在 ${hi}。` : r < lo ? `${x} 捨入成 ${r}，低於 ${t} 下限，夾在 ${lo}。` : `${x} 捨入成 ${r}，在範圍內。`;
  }
  ["cin", "cto"].forEach((id) => $(id).addEventListener("input", conv)); conv();

  /* ---------- rounding ---------- */
  const R = { near: roundEven, down: Math.floor, up: Math.ceil, trunc: roundEven };
  const RN = { near: "Round To Nearest", down: "Round Toward −Infinity", up: "Round Toward +Infinity", trunc: "To Long Integer" };
  const pos = (v) => ((v + 4) / 8 * 100) + "%";
  function rdraw() {
    const x = Number($("rx").value), f = $("rfn").value, y = R[f](x);
    $("rxv").textContent = x.toFixed(1);
    let ticks = "";
    for (let v = -4; v <= 4; v++) ticks += `<span class="tk" style="left:${pos(v)}"></span><span class="tick" style="left:${pos(v)}">${v}</span>`;
    if (!$("rline").dataset.built) {
      $("rline").innerHTML = `<div class="axis"></div>${ticks}<div class="pt" id="rp0"></div><div class="pt res" id="rp1"></div><span class="lab" id="rl1"></span>`;
      $("rline").dataset.built = 1;
    }
    $("rp0").style.left = pos(x);
    $("rp1").style.left = pos(x);
    $("rl1").style.left = pos(x);
    requestAnimationFrame(() => requestAnimationFrame(() => { $("rp1").style.left = pos(y); $("rl1").style.left = pos(y); $("rl1").textContent = `${RN[f]} → ${y}`; }));
    const xs = [2.5, 3.5, -2.5, 2.4, 2.6, -1.2];
    $("rtab").innerHTML = `<tr><th>x</th><th>Nearest</th><th>−Infinity</th><th>+Infinity</th></tr>` +
      xs.map((v) => `<tr class="${Math.abs(v - x) < 1e-9 ? "here" : ""}"><td>${v}</td><td>${roundEven(v)}</td><td>${Math.floor(v)}</td><td>${Math.ceil(v)}</td></tr>`).join("");
  }
  ["rx", "rfn"].forEach((id) => $(id).addEventListener("input", rdraw)); rdraw();

  /* ---------- quotient & remainder ---------- */
  function qrun() {
    const x = Math.max(0, Math.floor(Number($("qx").value) || 0)), y = Math.max(1, Math.floor(Number($("qy").value) || 1));
    const iq = Math.floor(x / y), r = x - iq * y;
    $("qiq").textContent = iq; $("qr").textContent = r;
    const groups = Math.min(iq, 40);
    let html = "";
    for (let g = 0; g < groups; g++) html += `<div class="grp">${Array.from({ length: Math.min(y, 20) }, (_, k) => `<span class="dot" style="animation-delay:${(g * y + k) * 25}ms"></span>`).join("")}</div>`;
    if (r) html += `<div class="grp left">${Array.from({ length: r }, (_, k) => `<span class="dot" style="animation-delay:${(groups * y + k) * 25}ms"></span>`).join("")}</div>`;
    $("dots").innerHTML = html + (iq > 40 ? `<span class="why">（只畫前 40 組）</span>` : "");
  }
  $("qrun").onclick = qrun; qrun();
  function msrun() {
    let v = Math.max(0, Math.floor(Number($("ms").value) || 0));
    const steps = [[1000, "毫秒"], [60, "秒"], [60, "分"], [24, "時"]];
    const parts = [];
    steps.forEach(([d, unit]) => { const q = Math.floor(v / d), r = v - q * d; parts.push(`<span class="st">${v} ÷ ${d} → R = <b>${r} ${unit}</b>，IQ = ${q} 往下送</span>`); v = q; });
    parts.push(`<span class="st"><b>${v} 天</b></span>`);
    $("chain").innerHTML = parts.join("<span>→</span>");
    [...$("chain").querySelectorAll(".st")].forEach((s, i) => setTimeout(() => s.classList.add("show"), 350 * i));
  }
  $("msrun").onclick = msrun; msrun();
  window.NumLab = { wrap, roundEven, add, val: () => val };
})();
