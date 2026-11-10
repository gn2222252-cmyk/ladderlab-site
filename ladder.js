"use strict";
/* Shared ladder drawing: contact trees from bridge._tree() into SVG. Pages set ladderComment(dev). */
let ladderComment = () => "";
const W = 92, H = 50, X0 = 16;
const SVGNS = "http://www.w3.org/2000/svg";
function size(n) {
  if (!n) return [0, 1];
  if (n.t === "s") { const z = n.i.map(size); return [z.reduce((a, b) => a + b[0], 0), Math.max(...z.map((b) => b[1]))]; }
  if (n.t === "p") { const z = n.i.map(size); return [Math.max(...z.map((b) => b[0])), z.reduce((a, b) => a + b[1], 0)]; }
  return [1, 1];
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
function xAt(c) { return X0 + c * W; }
function place(n, col, row, width, top, out) {
  const y = top + row * H + H / 2;
  if (!n) { out.push(`<line class="wire" x1="${xAt(col)}" y1="${y}" x2="${xAt(col + width)}" y2="${y}"/>`); return; }
  if (n.t === "s") {
    let c = col;
    n.i.forEach((it, i) => { const w = i === n.i.length - 1 ? col + width - c : size(it)[0]; place(it, c, row, w, top, out); c += w; });
    return;
  }
  if (n.t === "p") {
    let r = row, lastY = y;
    for (const it of n.i) { place(it, col, r, width, top, out); lastY = top + r * H + H / 2; r += size(it)[1]; }
    out.push(`<line class="wire" x1="${xAt(col)}" y1="${y}" x2="${xAt(col)}" y2="${lastY}"/>`);
    out.push(`<line class="wire" x1="${xAt(col + width)}" y1="${y}" x2="${xAt(col + width)}" y2="${lastY}"/>`);
    return;
  }
  const x = xAt(col), mid = x + W / 2;
  let body, label, note;
  if (n.t === "cmp") {
    label = `${n.r} ${n.a} ${n.b}`; note = "";
    body = `<rect x="${x + 6}" y="${y - 11}" width="${W - 12}" height="22" rx="3" fill="none" style="stroke:currentColor"/><path d="M${x} ${y}H${x + 6}M${x + W - 6} ${y}H${x + W}"/><text x="${mid}" y="${y + 4}" text-anchor="middle">${esc(label)}</text>`;
    label = "";
  } else {
    label = n.n; note = short(ladderComment(n.n), 7);
    const arrow = n.e === "P" ? `M${mid} ${y + 8}V${y - 8}M${mid - 4} ${y - 3}L${mid} ${y - 8}L${mid + 4} ${y - 3}`
      : n.e === "F" ? `M${mid} ${y - 8}V${y + 8}M${mid - 4} ${y + 3}L${mid} ${y + 8}L${mid + 4} ${y + 3}` : "";
    body = `<path d="M${x} ${y}H${mid - 7}M${mid - 7} ${y - 11}V${y + 11}M${mid + 7} ${y - 11}V${y + 11}M${mid + 7} ${y}H${x + W}${n.neg ? `M${mid - 9} ${y + 11}L${mid + 9} ${y - 11}` : ""}${arrow}"/>`;
  }
  out.push(`<g class="ct" data-k="${n.k}"><rect class="bg" x="${x + 2}" y="${y - 22}" width="${W - 4}" height="44" rx="4"/>${body}` +
    (label ? `<text x="${mid}" y="${y - 14}" text-anchor="middle">${esc(label)}</text>` : "") +
    (note ? `<text class="cm" x="${mid}" y="${y + 21}" text-anchor="middle">${esc(note)}</text>` : "") + `</g>`);
  if (width > 1) out.push(`<line class="wire" x1="${x + W}" y1="${y}" x2="${xAt(col + width)}" y2="${y}"/>`);
}
function rungSvg(r, ri, top, condCols) {
  const out = [], [, h] = size(r.cond), rows = Math.max(h, r.out.length);
  place(r.cond, 0, 0, condCols, top, out);
  const cx0 = xAt(condCols), y0 = top + H / 2;
  r.out.forEach((o, oi) => {
    const y = top + oi * H + H / 2, op = o[0], dev = o[1] || "";
    if (oi > 0) out.push(`<line class="wire" x1="${cx0}" y1="${y0}" x2="${cx0}" y2="${y}"/>`);
    let g;
    if (op === "OUT" || op === "SET" || op === "RST") {
      const tag = op === "OUT" ? dev + (o[2] ? " " + o[2] : "") : `${op} ${dev}`;
      g = `<line class="wire" x1="${cx0}" y1="${y}" x2="${cx0 + 30}" y2="${y}"/><ellipse cx="${cx0 + 50}" cy="${y}" rx="20" ry="13"/>` +
        `<text x="${cx0 + 76}" y="${y + 4}">${esc(tag)}</text><text class="cm" x="${cx0 + 76}" y="${y + 18}">${esc(short(ladderComment(dev), 12))}</text>`;
    } else {
      const text = o.join(" ");
      g = `<line class="wire" x1="${cx0}" y1="${y}" x2="${cx0 + 20}" y2="${y}"/><rect class="box" x="${cx0 + 20}" y="${y - 12}" width="${Math.max(110, text.length * 7.5 + 16)}" height="24" rx="3"/>` +
        `<text x="${cx0 + 28}" y="${y + 4}">${esc(text)}</text>`;
    }
    out.push(`<g class="coil" data-c="${ri}:${oi}">${g}</g>`);
  });
  out.push(`<line class="rail" x1="${X0}" y1="${top}" x2="${X0}" y2="${top + rows * H}"/>`);
  return { svg: out.join(""), rows };
}

/* Draws a list of [rung, index] into root. Rungs: {k:'r'|'stl'|'ret'|'end', ...}. */
function renderRungs(root, items, opts) {
  opts = opts || {};
  const textOf = opts.text || ((s) => s);
  const condCols = Math.max(3, ...items.filter(([r]) => r.k === "r").map(([r]) => size(r.cond)[0]));
  let top = 6, parts = [], para = null;
  for (const [r, i] of items) {
    if (r.k === "r" && r.para && r.para !== para) {
      para = r.para; parts.push(`<text class="para" x="${X0}" y="${top + 14}">${esc(short(textOf(r.para), 90))}</text>`); top += 22;
    }
    if (r.k === "r") {
      const g = rungSvg(r, i, top, condCols);
      parts.push(`<g class="rung" data-r="${i}"><rect class="hit" x="0" y="${top}" width="100%" height="${g.rows * H}"/>${g.svg}</g>`);
      top += g.rows * H + 4;
    } else {
      const text = r.k === "stl" ? `STL ${r.state}` : r.k.toUpperCase();
      parts.push(`<g class="stlbar" data-s="${i}"><rect x="${X0}" y="${top + 4}" width="130" height="24" rx="4"/><text x="${X0 + 10}" y="${top + 21}">${text}</text></g>`);
      top += 32;
    }
  }
  const width = xAt(condCols) + 260;
  root.innerHTML = `<svg xmlns="${SVGNS}" width="${width}" height="${top + 6}" viewBox="0 0 ${width} ${top + 6}">${parts.join("")}</svg>`;
  if (opts.onClick) root.querySelectorAll(".rung").forEach((g) => g.addEventListener("click", () => opts.onClick(+g.dataset.r)));
}

/* Live colours. st: {leaves, power, coils, cur, scanning}; selected: highlighted rung index. */
function updateRungs(root, st, rungs, selected) {
  root.querySelectorAll(".ct").forEach((g) => g.classList.toggle("on", st.leaves[g.dataset.k] === "1"));
  root.querySelectorAll(".coil").forEach((g) => {
    const [ri, oi] = g.dataset.c.split(":").map(Number), o = rungs[ri].out[oi];
    const bitCoil = (o[0] === "OUT" || o[0] === "SET") && /^[YMS]/.test(o[1] || "");
    g.classList.toggle("on", bitCoil ? !!st.coils[ri][oi] : !!st.power[ri]);
  });
  const cur = st.cur === undefined ? -1 : st.cur, slow = !!st.scanning;
  root.querySelectorAll(".stlbar").forEach((g) => {
    g.classList.toggle("on", !!st.power[+g.dataset.s]);
    g.classList.toggle("pending", slow && cur >= 0 && +g.dataset.s > cur);
  });
  root.querySelectorAll(".rung").forEach((g) => {
    const i = +g.dataset.r;
    g.classList.toggle("sel", i === selected);
    g.classList.toggle("cur", slow && i === cur);
    g.classList.toggle("pending", slow && cur >= 0 && i > cur);
  });
}
