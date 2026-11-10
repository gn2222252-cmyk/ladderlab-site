"use strict";
/* Shared by every page: Python boot, language memory, small helpers. */
async function bootPython() {
  const py = await loadPyodide();
  const files = (window.LL_FILES ? Object.keys(window.LL_FILES) : await (await fetch("py/manifest.json", { cache: "no-cache" })).json());
  py.FS.mkdir("/lab");
  await Promise.all(files.map(async (name) => {
    const buf = (window.LL_FILES ? Uint8Array.from(atob(window.LL_FILES[name]), (c) => c.charCodeAt(0)) : new Uint8Array(await (await fetch("py/" + name, { cache: "no-cache" })).arrayBuffer()));
    py.FS.writeFile("/lab/" + name, buf);
  }));
  py.runPython("import sys; sys.path.insert(0, '/lab')");
  return py;
}
function savedLang() {
  try { const s = localStorage.getItem("ll_lang"); if (s) return s; } catch (e) { /* private mode */ }
  return /^zh/i.test(navigator.language || "") ? "zh" : "en";
}
function storeGet(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } }
/* progress backup: every LadderLab key in this browser (they all start with "ll_") as one JSON file, and back */
const LV_KEYS = ["gantry-lv-course-v1", "gantry-lv-exam-best", "gantry-lv-exam-wrong"];     /* the LabVIEW course's own keys (kept so old progress survives) */
const progressKey = (k) => !!k && ((k.indexOf("ll_") === 0 && k !== "ll_waitlisted") || LV_KEYS.includes(k));
function progressExport() {
  const data = { ladderlab: "progress", version: 1, saved: new Date().toISOString().slice(0, 10), items: {} };
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (progressKey(k)) data.items[k] = localStorage.getItem(k); } } catch (e) { /* private mode */ }
  return data;
}
function progressImport(data) {
  if (!data || data.ladderlab !== "progress" || typeof data.items !== "object") return -1;
  let n = 0;
  Object.keys(data.items).forEach((k) => { if (progressKey(k) && typeof data.items[k] === "string") { try { localStorage.setItem(k, data.items[k]); n++; } catch (e) { /* full */ } } });
  return n;
}
function storeSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ } }
function cssVar(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function drawCylinder(ctx, p) {
  ctx.clearRect(0, 0, 200, 130);
  ctx.fillStyle = cssVar("--rail"); ctx.fillRect(80, 6, 40, 26);
  ctx.fillStyle = cssVar("--belt"); ctx.fillRect(94, 32, 12, p.z * 60);
  ctx.fillStyle = p.vac ? "#2fbf5b" : "#d0a020"; ctx.fillRect(74, 32 + p.z * 60, 52, 12);
  ctx.fillStyle = cssVar("--mute"); ctx.font = "11px system-ui";
  ctx.fillText(p.z >= 0.98 ? "X1 下限" : p.z <= 0.02 ? "X2 上限" : "", 132, 40 + p.z * 60);
  if (p.stuck) { ctx.fillStyle = "#c62828"; ctx.fillText("卡住", 10, 20); }
  ctx.fillStyle = cssVar("--line"); ctx.fillRect(40, 116, 120, 6);
}
