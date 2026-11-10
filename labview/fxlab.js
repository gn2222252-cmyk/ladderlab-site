"use strict";
/* FX programming-port protocol practice: a simulated PLC in the browser answers commands 0 (read D) and 1 (write D).
Frame rules as in the LabVIEW lessons: address = 1000h + 2 x D, bytes = words x 2, data low byte first,
checksum = sum of the ASCII codes after STX up to and including ETX, low 8 bits, two hex digits. */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const STX = "\x02", ETX = "\x03", ENQ = "\x05", ACK = "\x06", NAK = "\x15";
  const MAX_WORDS = 32;                                    // this simulator answers at most 64 bytes per read
  const D = new Uint16Array(8000);
  // values the gantry lessons talk about (lesson 12-15): status words D200-D202, D230 bits, a test value in D100
  D[100] = 0x1234; D[200] = 22; D[201] = 42; D[202] = 0; D[230] = 0x0B54;
  let watch = [100, 106, 107, 110, 200, 201, 202, 230, 240];
  let hit = new Set();

  const hex = (n, w) => (n >>> 0).toString(16).toUpperCase().padStart(w, "0").slice(-w);
  const sum = (body) => hex([...body].reduce((a, c) => a + c.charCodeAt(0), 0) & 0xFF, 2);
  const wordText = (v) => hex(v & 0xFF, 2) + hex((v >> 8) & 0xFF, 2);          // low byte first
  const show = (s) => s.replace(/\x05/g, "<ENQ>").replace(/\x02/g, "<STX>").replace(/\x03/g, "<ETX>").replace(/\x06/g, "<ACK>").replace(/\x15/g, "<NAK>");
  const bytes = (s) => [...s].map((c) => hex(c.charCodeAt(0), 2)).join(" ");

  function frame(cmd, d, words, value) {
    const adr = hex(0x1000 + 2 * d, 4);
    const body = cmd === "0" ? "0" + adr + hex(words * 2, 2) + ETX : "1" + adr + "02" + wordText(value & 0xFFFF) + ETX;
    return STX + body + sum(body);
  }
  function parseInput(text) {                              // <STX>, \02, \x02 -> control characters
    return text.trim().replace(/<ENQ>/gi, ENQ).replace(/\\x?05/gi, ENQ).replace(/<STX>/gi, STX).replace(/<ETX>/gi, ETX).replace(/\\x?02/gi, STX).replace(/\\x?03/gi, ETX)
      .replace(/\s+/g, "");
  }

  /* the PLC: returns {reply, why, kind, d, words} ; reply "" = no answer (VISA Read would time out) */
  function plc(msg) {
    if (msg === ENQ) return { reply: ACK, why: "ENQ（05h）：PLC 在線上就回 ACK。這就是第 12 課 L12_Ping.vi 做的事。", kind: "enq" };
    const i = msg.indexOf(STX), j = msg.indexOf(ETX, i + 1);
    if (i < 0) return { reply: "", why: "沒有 STX：PLC 不知道封包從哪裡開始，不回答（LabVIEW 會等到 VISA Read 逾時）。" };
    if (j < 0) return { reply: "", why: "沒有 ETX：PLC 一直等封包結束，不回答（VISA Read 逾時）。" };
    const body = msg.slice(i + 1, j + 1), got = msg.slice(j + 1, j + 3).toUpperCase();
    if (got.length < 2) return { reply: "", why: "ETX 後面少了 2 個校驗字元，PLC 還在等，不回答。" };
    if (got !== sum(body)) return { reply: NAK, why: `校驗不對：STX 之後到 ETX 的 ASCII 碼加起來，低 8 位元是 ${sum(body)}，你寫的是 ${got}。`, kind: "badsum" };
    const cmd = body[0], adrText = body.slice(1, 5), lenText = body.slice(5, 7);
    if (cmd !== "0" && cmd !== "1") return { reply: NAK, why: `命令「${cmd}」這台模擬 PLC 不認得：讀是 0、寫是 1。`, kind: "cmd" };
    if (!/^[0-9A-F]{4}$/i.test(adrText) || !/^[0-9A-F]{2}$/i.test(lenText)) return { reply: NAK, why: "位址要 4 個、位元組數要 2 個十六進位字元（0～9、A～F）。", kind: "fmt" };
    const adr = parseInt(adrText, 16), n = parseInt(lenText, 16);
    if (adr < 0x1000 || adr % 2 || (adr - 0x1000) / 2 > 7999) return { reply: NAK, why: `位址 ${adrText}h 不是 D 暫存器：D 的位址是 1000h + 2 × D（偶數）。`, kind: "adr" };
    const d = (adr - 0x1000) / 2;
    if (!n || n % 2) return { reply: NAK, why: `位元組數 ${lenText}h 要是字數 × 2（偶數，不能是 0）。`, kind: "len" };
    const words = n / 2;
    if (cmd === "0") {
      if (body.length !== 8) return { reply: NAK, why: "讀命令的格式是 0＋位址 4 碼＋位元組數 2 碼＋ETX，中間多了或少了字元。", kind: "fmt" };
      if (words > MAX_WORDS) return { reply: NAK, why: `一次讀 ${words} 個字太多了：這台模擬 PLC 一次最多回 ${MAX_WORDS} 個字。課程裡 D200～D241 分兩次讀（30＋12）。`, kind: "len" };
      if (d + words > 8000) return { reply: NAK, why: "讀的範圍超過 D7999。", kind: "adr" };
      let data = "";
      for (let k = 0; k < words; k++) { data += wordText(D[d + k]); hit.add(d + k); }
      const rb = data + ETX;
      return { reply: STX + rb + sum(rb), why: `讀 D${d} 起 ${words} 個字。每個字 4 個字元、低位元組在前。`, kind: "read", d, words };
    }
    const dataText = body.slice(7, -1);
    if (dataText.length !== words * 4 || !/^[0-9A-F]*$/i.test(dataText)) return { reply: NAK, why: `寫 ${words} 個字要 ${words * 4} 個十六進位資料字元，你送了 ${dataText.length} 個。`, kind: "fmt" };
    for (let k = 0; k < words; k++) {
      const t = dataText.slice(k * 4, k * 4 + 4);
      D[d + k] = parseInt(t.slice(2, 4) + t.slice(0, 2), 16); hit.add(d + k);
    }
    return { reply: ACK, why: `寫進 D${d}${words > 1 ? ` 起 ${words} 個字` : ` = ${D[d]}`}。`, kind: "write", d, words };
  }

  /* ---------- builder ---------- */
  function cmdNow() { return document.querySelector("input[name=cmd]:checked").value; }
  function build() {
    const cmd = cmdNow(), d = Math.max(0, Math.min(7999, +$("bd").value || 0)), w = Math.max(1, Math.min(MAX_WORDS, +$("bw").value || 1));
    const v = (+$("bv").value || 0) & 0xFFFF;
    $("bwl").hidden = cmd !== "0"; $("bvl").hidden = cmd !== "1";
    const f = frame(cmd, d, w, v);
    const cells = [], body = f.slice(1, f.indexOf(ETX) + 1);
    cells.push(["STX", "02h", "ctl"]);
    cells.push([cmd, cmd === "0" ? "讀" : "寫", "cmd"]);
    [...f.slice(2, 6)].forEach((c, k) => cells.push([c, k ? "" : "位址", "adr"]));
    [...f.slice(6, 8)].forEach((c, k) => cells.push([c, k ? "" : "位元組", "len"]));
    if (cmd === "1") [...f.slice(8, 12)].forEach((c, k) => cells.push([c, k ? "" : "資料", "dat"]));
    cells.push(["ETX", "03h", "ctl"]);
    [...f.slice(-2)].forEach((c, k) => cells.push([c, k ? "" : "校驗", "sum"]));
    $("bframe").innerHTML = cells.map(([c, s, k]) => `<span class="fx-ch ${k}"><b>${esc(c)}</b><small>${esc(s)}</small></span>`).join("");
    const parts = [...body].map((c) => `${c === ETX ? "ETX" : c}(${hex(c.charCodeAt(0), 2)})`);
    const total = [...body].reduce((a, c) => a + c.charCodeAt(0), 0);
    $("bsum").innerHTML = `位址 = 1000h + 2 × ${d} = <b>${hex(0x1000 + 2 * d, 4)}h</b>；` +
      (cmd === "0" ? `位元組數 = ${w} × 2 = <b>${hex(w * 2, 2)}h</b>` : `資料 ${v} = ${hex(v, 4)}h → 低位元組在前 <b>${wordText(v)}</b>`) +
      `<br>校驗：${parts.join(" + ")} = ${hex(total, 3)}h → 取低 8 位元 <b>${sum(body)}</b>` +
      `<br>VISA Write 送：<b>${esc(show(f))}</b>（共 ${f.length} 個字元）` + (cmd === "0" ? `；VISA Read 要讀 <b>${4 * w + 4}</b> 個位元組` : "；VISA Read 讀 1 個位元組（ACK／NAK）");
    return f;
  }
  document.querySelectorAll("input[name=cmd]").forEach((r) => r.addEventListener("change", build));
  ["bd", "bw", "bv"].forEach((id) => $(id).addEventListener("input", build));
  $("buse").onclick = () => { $("tx").value = show(build()); $("tx").focus(); };

  /* ---------- tasks ---------- */
  const TASKS = [
    { t: "送 <ENQ>：PLC 在不在線上？（第 12 課的 Ping）", ok: (r) => r.kind === "enq" },
    { t: "讀 D100 一個字，看懂為什麼回來的是 3412（D100 = 1234h）", ok: (r) => r.kind === "read" && r.d === 100 && r.words === 1 },
    { t: "讀雙龍門的狀態字：D200 起 3 個字（第 13 課）", ok: (r) => r.kind === "read" && r.d === 200 && r.words === 3 },
    { t: "寫 D106 = 1：按鈕命令的脈衝（第 17 課）", ok: (r) => r.kind === "write" && r.d === 106 && D[106] === 1 },
    { t: "寫 D240 = 1：HMI 心跳（第 19 課）", ok: (r) => r.kind === "write" && r.d === 240 && D[240] === 1 },
    { t: "故意送一個校驗錯的封包，看 PLC 回 NAK", ok: (r) => r.kind === "badsum" },
    { t: "讀 D200 起 30 個字（第 15 課分兩次讀的第一次）", ok: (r) => r.kind === "read" && r.d === 200 && r.words === 30 },
    { t: "讀 D230 起 12 個字（第二次）", ok: (r) => r.kind === "read" && r.d === 230 && r.words === 12 },
    { t: "寫 D110 = -5：負數在 16 位元裡是 FFFBh，封包資料寫成 FBFF", ok: (r) => r.kind === "write" && r.d === 110 && D[110] === 0xFFFB },
    { t: "寫 D106 = 4（原點復歸），再連續讀 D200 起 3 個字，看 D202 走過 10～13（第 13 課）", ok: (r) => r.kind === "read" && r.d <= 202 && r.d + r.words > 202 && D[202] >= 10 && D[202] <= 13 },
  ];
  let done = new Set();
  try { done = new Set(JSON.parse(localStorage.getItem("ll_fxlab") || "[]")); } catch (e) { done = new Set(); }
  function renderTasks() {
    $("tasklist").innerHTML = TASKS.map((x, k) => `<li class="${done.has(k) ? "done" : ""}">${esc(x.t)}</li>`).join("");
    $("taskhint").textContent = done.size === TASKS.length ? "全部完成！到 LabVIEW 用 VISA Write 送同樣的字串，結果應該一模一樣。" : `完成 ${done.size} / ${TASKS.length}`;
  }

  /* ---------- memory ---------- */
  function renderMem() {
    watch = [...new Set(watch)].sort((a, b) => a - b);
    $("mem").innerHTML = "<thead><tr><th>D</th><th>十進位</th><th>十六進位</th><th>封包裡</th></tr></thead><tbody>" +
      watch.map((d) => `<tr class="${hit.has(d) ? "hit" : ""}"><td>D${d}</td><td><input type="number" data-d="${d}" value="${D[d]}" min="0" max="65535"></td>` +
        `<td>${hex(D[d], 4)}h</td><td>${wordText(D[d])}</td></tr>`).join("") + "</tbody>";
    $("mem").querySelectorAll("input").forEach((inp) => inp.addEventListener("change", () => {
      D[+inp.dataset.d] = (+inp.value || 0) & 0xFFFF; hit = new Set([+inp.dataset.d]); renderMem();
    }));
  }
  $("addbtn").onclick = () => { const d = Math.max(0, Math.min(7999, +$("addd").value || 0)); watch.push(d); renderMem(); };

  /* ---------- terminal ---------- */
  function send() {
    const msg = parseInput($("tx").value);
    if (!msg) return;
    hit = new Set();
    const r = plc(msg);
    for (let k = r.d || 0; r.kind === "read" && k < r.d + r.words; k++) if (!watch.includes(k) && watch.length < 60) watch.push(k);
    if (r.kind === "write") for (let k = r.d; k < r.d + r.words; k++) if (!watch.includes(k)) watch.push(k);
    const hx = $("hexview").checked;
    const line = `<div><span class="tx">TX ${esc(show(msg))}</span>${hx ? `<br><span class="why">　${bytes(msg)}</span>` : ""}<br>` +
      (r.reply ? `<span class="${r.reply === NAK ? "rx-bad" : "rx-ok"}">RX ${esc(show(r.reply))}</span>${hx ? `<br><span class="why">　${bytes(r.reply)}</span>` : ""}`
        : `<span class="rx-bad">RX（沒有回應）</span>`) + `<br><span class="why">${esc(r.why)}</span></div>`;
    $("log").insertAdjacentHTML("afterbegin", line);
    TASKS.forEach((x, k) => { if (x.ok(r)) done.add(k); });
    try { localStorage.setItem("ll_fxlab", JSON.stringify([...done])); } catch (e) { /* private mode */ }
    renderTasks(); renderMem();
    return r;
  }
  $("send").onclick = send;
  $("tx").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
  $("clearlog").onclick = () => { $("log").innerHTML = ""; };

  /* ---------- a little machine behind the registers (lessons 13, 17, 19) ----------
     D106 is a pulse command: the PLC takes it and clears it to 0. Home (D106 = 4) runs the homing steps D202 = 10..13.
     D240 is the HMI heartbeat: the PLC calls the HMI lost when it has not changed for 3 s. */
  let homing = 0, homeAt = 0, hbValue = D[240], hbAt = Date.now(), lastMem = "";
  function tick() {
    const now = Date.now();
    if (D[106]) {
      const cmd = D[106];
      D[106] = 0;
      note(`PLC 收到 D106 = ${cmd}，自己把 D106 清回 0。` + (cmd & 4 ? "原點復歸開始：D202 會從 10 走到 13。" : cmd & 1 ? "（本練習台只模擬原點復歸，Start 等命令只示範清 0。）" : ""));
      if (cmd & 4) { homing = 10; homeAt = now; D[202] = 10; }
    }
    if (homing && now - homeAt > 1000) {
      homeAt = now;
      homing = homing < 13 ? homing + 1 : 0;
      D[202] = homing;
      if (!homing) note("原點復歸完成，D202 回到 0。");
    }
    if (D[240] !== hbValue) { hbValue = D[240]; hbAt = now; }
    const lost = D[240] !== 0 && now - hbAt > 3000;
    $("hb").textContent = D[240] === 0 ? "D240 = 0：HMI 離線（或還沒開始送心跳）"
      : lost ? `D240 已經 ${((now - hbAt) / 1000).toFixed(0)} 秒沒變：PLC 判定 HMI 斷線（第 19 課）` : `D240 = ${D[240]}：心跳正常（3 秒內有變化）`;
    $("hb").className = "hbstate " + (D[240] === 0 ? "" : lost ? "bad" : "good");
    const mem = watch.map((d) => D[d]).join(",");
    if (mem !== lastMem) { lastMem = mem; renderMem(); }
  }
  /* ---------- decoding drill: a read reply for D200, 3 words; sometimes with a wrong checksum ---------- */
  let dq = null, dqRight = 0, dqTotal = 0;
  function newDq() {
    const pick = () => { const r = Math.random(); return r < 0.35 ? Math.floor(Math.random() * 100) : r < 0.7 ? Math.floor(Math.random() * 1000) : r < 0.9 ? Math.floor(Math.random() * 65536) : 0xFFFF - Math.floor(Math.random() * 20); };
    const vals = [pick(), pick(), pick()];
    const body = vals.map(wordText).join("") + ETX;
    let cs = sum(body);
    const bad = Math.random() < 0.25;
    if (bad) cs = hex((parseInt(cs, 16) + 1 + Math.floor(Math.random() * 30)) & 0xFF, 2);
    dq = { vals, bad, text: STX + body + cs };
    const f = dq.text;
    const cells = [["STX", "02h", "ctl"]];
    vals.forEach((v, k) => [...wordText(v)].forEach((c, i) => cells.push([c, i ? "" : "D" + (200 + k), "dat"])));
    cells.push(["ETX", "03h", "ctl"]);
    [...f.slice(-2)].forEach((c, i) => cells.push([c, i ? "" : "校驗", "sum"]));
    $("dqframe").innerHTML = cells.map(([c, s2, k]) => `<span class="fx-ch ${k}"><b>${esc(c)}</b><small>${esc(s2)}</small></span>`).join("");
    $("dqvals").innerHTML = vals.map((_, k) => `<label>D${200 + k} 十進位 <input type="number" data-k="${k}" style="width:100px"></label>`).join("") +
      `<span class="why">負數照 I16 寫（例如 FFFFh 寫 -1），或照 U16 寫 65535 都算對。</span>`;
    $("dqsum").value = ""; $("dqans").innerHTML = "";
  }
  $("dqnext").onclick = newDq;
  $("dqcheck").onclick = () => {
    if (!dq) return;
    const sumOk = $("dqsum").value === (dq.bad ? "0" : "1");
    const got = [...$("dqvals").querySelectorAll("input")].map((i) => i.value.trim());
    const okVals = dq.vals.map((v, k) => got[k] !== "" && (+got[k] === v || +got[k] === (v > 32767 ? v - 65536 : v)));
    const all = sumOk && (dq.bad || okVals.every(Boolean));
    dqTotal++; if (all) dqRight++;
    const body = dq.text.slice(1, -2);
    $("dqans").innerHTML = (all ? "<b>全對！</b>" : "<b>再看一次：</b>") +
      `<br>校驗：STX 之後到 ETX 的 ASCII 碼總和取低 8 位元 = ${sum(body)}，回應裡寫的是 ${dq.text.slice(-2)} → <b>${dq.bad ? "不對，這筆資料要丟掉、記通訊錯誤" : "對"}</b>${sumOk ? " ✓" : " ✗"}` +
      dq.vals.map((v, k) => { const t = wordText(v); return `<br>D${200 + k}：${t} → 低位元組在前，換回來是 ${t.slice(2)}${t.slice(0, 2)}h = <b>${v}</b>${v > 32767 ? `（I16 是 ${v - 65536}）` : ""}${dq.bad ? "" : okVals[k] ? " ✓" : " ✗"}`; }).join("") +
      (dq.bad ? "<br>校驗不對時，數值算出來也不能用。" : "");
    $("dqscore").textContent = `答對 ${dqRight} / ${dqTotal}`;
  };
  newDq();

  function note(t) { $("log").insertAdjacentHTML("afterbegin", `<div><span class="why">PLC：${esc(t)}</span></div>`); }
  setInterval(tick, 200);

  build(); renderTasks(); renderMem();
  window.FxLab = { plc, frame, sum, parseInput, send, D, tick };     // for the page test
})();
