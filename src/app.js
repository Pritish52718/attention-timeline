(function () {
"use strict";

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, html = "") => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else e.setAttribute(k, v);
  }
  if (html) e.innerHTML = html;
  return e;
};
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmt = (x, d = 2) => (Object.is(x, -Infinity) ? "−∞" : (x < 0 ? "−" : "") + Math.abs(x).toFixed(d));
const fmtInt = (x) => Math.round(x).toLocaleString("en-US");
function fmtBytes(b) {
  const u = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0; while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; }   // decimal units, as in the lesson
  return (b >= 100 ? b.toFixed(0) : b >= 10 ? b.toFixed(1) : b.toFixed(2)) + " " + u[i];
}
function fmtBig(x) {
  if (x < 1e4) return fmtInt(x);
  const e = Math.floor(Math.log10(x));
  const m = x / Math.pow(10, e);
  return m.toFixed(1) + " × 10" + String(e).split("").map(c => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+c]).join("");
}
function hash(a, b) { // deterministic pseudo-random in [0,1)
  let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const redraws = [];
function onTheme(fn) { redraws.push(fn); }
function redrawAll() { redraws.forEach(f => f()); }
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redrawAll);
new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

/* ---------- 1. attention lab ---------- */
const TOK = ["The", "river", "bank", "was", "muddy"];
// Each token's starting vector x. The four numbers are hand-made and readable:
// how much the word is about nature, about money, is a thing, describes something.
const XDIM = ["nature", "money", "thing", "describes"];
const X = [[0.1, 0.1, 0.0, 0.2], [1.0, 0.0, 0.8, 0.0], [0.4, 0.4, 1.0, 0.0], [0.0, 0.0, 0.1, 0.6], [0.8, 0.0, 0.0, 1.0]];
// The three learned tables, hand-made here. q = x·W_Q, k = x·W_K, v = x·W_V.
const W = {
  q: [[0.5, 0, 0, 0], [0, 0.5, 0, 0], [2, 2, 0, 0], [0, 0, 1, 0]],   // a thing asks "nature or money?"; a describing word looks for a thing
  k: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 0.5]],     // a token advertises what it is about
  v: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0.5, 0], [0, 0, 0, 1]]      // what it hands over if chosen
};
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const project = (M, T) => M.map(row => T[0].map((_, c) => r4(row.reduce((a, x, i) => a + x * T[i][c], 0))));
const Q = project(X, W.q), K = project(X, W.k), V = project(X, W.v);
const VDIM = XDIM;
const PROJ = {
  q: { name: "query", sym: "q", wsym: "W_Q", cols: ["q₁", "q₂", "q₃", "q₄"], job: "what am I looking for?" },
  k: { name: "key", sym: "k", wsym: "W_K", cols: ["k₁", "k₂", "k₃", "k₄"], job: "what do I contain?" },
  v: { name: "value", sym: "v", wsym: "W_V", cols: XDIM.map(s => s.slice(0, 3)), job: "what do I hand over if I am chosen?" }
};
const D = 4;
const STAGES = [
  { n: 0, label: "x → q, k, v", title: "" },
  { n: 1, label: "Q × Kᵀ", title: "Scores = Q · Kᵀ" },
  { n: 2, label: "Scale", title: "Scaled scores ÷ √d" },
  { n: 3, label: "Mask", title: "Masked scores" },
  { n: 4, label: "Softmax", title: "Attention weights" },
  { n: 5, label: "× V", title: "Attention weights (used to mix V)" }
];
const lab = { stage: 0, focus: 2, causal: true, proj: "q" };

function labCompute() {
  const n = TOK.length;
  const raw = [], sc = [], mk = [], sm = [], out = [];
  for (let i = 0; i < n; i++) {
    raw[i] = []; sc[i] = []; mk[i] = [];
    for (let j = 0; j < n; j++) {
      const s = Q[i].reduce((a, q, d) => a + q * K[j][d], 0);
      raw[i][j] = s; sc[i][j] = s / Math.sqrt(D);
      mk[i][j] = lab.causal && j > i ? -Infinity : sc[i][j];
    }
    const mx = Math.max(...mk[i].filter(isFinite));
    const ex = mk[i].map(x => (isFinite(x) ? Math.exp(x - mx) : 0));
    const z = ex.reduce((a, b) => a + b, 0);
    sm[i] = ex.map(x => x / z);
    out[i] = VDIM.map((_, d) => sm[i].reduce((a, w, j) => a + w * V[j][d], 0));
  }
  return { raw, sc, mk, sm, out };
}

function matTable(tbl, rows, cols, data, opts = {}) {
  const { heat = null, focus = -1, onRow = null, digits = 2 } = opts;
  let finite = data.flat().filter(x => isFinite(x));
  const lo = Math.min(...finite), hi = Math.max(...finite);
  let h = "<thead><tr><th></th>" + cols.map(c => `<th scope="col">${c}</th>`).join("") + "</tr></thead><tbody>";
  data.forEach((r, i) => {
    h += `<tr class="${i === focus ? "focus" : ""}"><th scope="row" data-row="${i}" tabindex="${onRow ? 0 : -1}">${rows[i]}</th>`;
    r.forEach(x => {
      if (!isFinite(x)) { h += `<td class="neg-inf">−∞</td>`; return; }
      let style = "";
      if (heat === "range") { const a = hi > lo ? 0.06 + 0.54 * (x - lo) / (hi - lo) : 0.2; style = `background:rgba(${cssVar("--heat")},${a.toFixed(3)})`; }
      if (heat === "prob") { style = `background:rgba(${cssVar("--heat")},${(0.04 + 0.6 * x).toFixed(3)})`; }
      h += `<td style="${style}">${fmt(x, digits)}</td>`;
    });
    h += "</tr>";
  });
  tbl.innerHTML = h + "</tbody>";
  if (onRow) tbl.querySelectorAll("tbody th").forEach(th => {
    th.addEventListener("click", () => onRow(+th.dataset.row));
    th.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRow(+th.dataset.row); } });
  });
}

function renderLab() {
  const c = labCompute();
  const f = lab.focus, ft = TOK[f];
  // step buttons
  const steps = $("#lab-steps");
  steps.innerHTML = "";
  STAGES.forEach((s, i) => {
    if (i) steps.appendChild(el("span", { class: "step-arrow", "aria-hidden": "true" }, "→"));
    const b = el("button", { class: "step-btn", type: "button", "aria-pressed": String(i === lab.stage) }, `<span class="n">${s.n}</span>${s.label}`);
    b.addEventListener("click", () => { lab.stage = i; renderLab(); });
    steps.appendChild(b);
  });
  // Q K V
  const qkv = $("#lab-qkv"); qkv.innerHTML = "";
  [["X · token vectors", X, XDIM.map(s => s.slice(0, 3)), 1], ["Q = X·W_Q", Q, PROJ.q.cols, 2], ["K = X·W_K", K, PROJ.k.cols, 2], ["V = X·W_V", V, PROJ.v.cols, 2]].forEach(([name, M, cols, digits]) => {
    const box = el("div", { style: "min-width:0" });
    box.appendChild(el("div", { class: "mat-label" }, `<span>${name}</span><span>5 × 4</span>`));
    const wrap = el("div", { class: "scroll-x" }); const t = el("table", { class: "mat small" });
    wrap.appendChild(t); box.appendChild(wrap); qkv.appendChild(box);
    matTable(t, TOK, cols, M, { focus: f, onRow: r => { lab.focus = r; renderLab(); }, digits });
  });
  // main matrix
  const st = lab.stage;
  $("#lab-proj").hidden = st !== 0;
  $("#lab-matwrap").hidden = st === 0;
  if (st === 0) renderProj(f);
  else {
    const data = [null, c.raw, c.sc, c.mk, c.sm, c.sm][st];
    $("#lab-mat-title").textContent = STAGES[st].title;
    $("#lab-mat-shape").textContent = "query ↓  key →";
    matTable($("#lab-mat"), TOK, TOK, data, { heat: st >= 4 ? "prob" : "range", focus: f, onRow: r => { lab.focus = r; renderLab(); } });
  }
  // output
  if (st === 5) {
    $("#lab-out-note").textContent = "Output = weights × V. One new vector per token (columns are the value dimensions).";
    matTable($("#lab-out"), TOK, VDIM, c.out, { heat: "range", focus: f, onRow: r => { lab.focus = r; renderLab(); } });
  } else {
    $("#lab-out-note").textContent = st === 0 ? "" : "The output appears at step 5.";
    $("#lab-out").innerHTML = "";
  }
  // explanation
  const row = (M) => M[f].map((x, j) => `${TOK[j]} ${fmt(x)}`).join(", ");
  const visible = TOK.filter((_, j) => !(lab.causal && j > f));
  const future = TOK.map((_, j) => j).filter(j => j > f);
  const allEx = c.sc[f].map(x => Math.exp(x)), allZ = allEx.reduce((a, x) => a + x, 0);
  const leftover = allEx.filter((_, j) => j <= f).reduce((a, x) => a + x, 0) / allZ;
  const w = c.sm[f].map((x, j) => [x, j]).filter(p => p[0] > 0).sort((a, b) => b[0] - a[0]);
  const pct = w.map(([x, j]) => `${TOK[j]} ${(x * 100).toFixed(0)}%`).join(", ");
  const best = c.raw[f].map((x, j) => [x, j]).filter(p => !(lab.causal && p[1] > f)).sort((a, b) => b[0] - a[0])[0][1];
  const dot = Q[f].map((q, d) => `${fmt(q)}×${fmt(K[best][d])}`).join(" + ");
  const say = [
    "Each token starts as a list of numbers, x. Three learned tables turn that one list into a query, a key and a value.",
    "Every query is compared with every key. The score is the dot product q·k.",
    "Divide every score by √d (here √4 = 2).",
    lab.causal ? "Hide the future. A token may look only at itself and the words before it." : "No mask. Every token can see every other token.",
    "Softmax turns each row into weights that add up to 1.",
    "Each token's output is the weighted sum of the value vectors."
  ][st];
  const sub = [
    [`“${ft}” arrives as x = [${X[f].map(x => fmt(x, 1)).join(", ")}]: a 1 × D list, with D = 4 here and thousands in a real model.`,
     `The layer owns three D × D tables. x times each one gives a new 1 × D list: query = x·W_Q (what am I looking for?), key = x·W_K (what do I contain?), value = x·W_V (what do I hand over if chosen?).`,
     `The tables are learned. They start random, and training nudges them until these lookups help predict the next word. Here they are hand-made so each cell can be read.`],
    `A dot product multiplies two lists slot by slot and adds the results. For “${ft}” and “${TOK[best]}”: q·k = ${dot} = ${fmt(c.raw[f][best])}. Row “${ft}”: ${row(c.raw)}. Higher means a closer match. Five tokens make a 5 × 5 table; N tokens make an N × N table.`,
    `Row “${ft}”: ${row(c.sc)}. Dot products grow with d (real heads use d = 128), and softmax of large numbers becomes almost one-hot, which stalls learning. Scaling keeps the spread sensible.`,
    lab.causal ? [
      future.length
        ? `Q·Kᵀ only measures how well two tokens match. It does not know which words come later. “${ft}” has scores for ${future.map(j => `“${TOK[j]}” (${fmt(c.sc[f][j])})`).join(" and ")}, but when the model is writing “${ft}” those words do not exist yet.`
        : `Q·Kᵀ only measures how well two tokens match. It does not know which words come later. “${ft}” is the last word, so nothing is hidden for it. Click an earlier word to see cells blocked.`,
      `The mask adds −∞ to every cell above the diagonal. “${ft}” may look at: ${visible.join(", ")}.`,
      `Why before softmax? Softmax raises e to each score, and e to the −∞ is 0. Hidden words get exactly zero weight and the visible words share the full 100%, in one step.`,
      future.length
        ? `Mask after softmax instead and the future words have already taken their share: the visible words for “${ft}” would be left with ${(leftover * 100).toFixed(0)}%, not 100%, and would need rescaling.`
        : `Mask after softmax instead and any future words would already have taken a share, leaving the visible ones short of 100%.`,
      `Masks also hide padding, the filler tokens added to make sentences the same length.`
    ] : [`No mask: every row keeps all five scores, so each word can see the words after it. That is fine for a model that only reads. A model that writes one word at a time must not see the words it has yet to write, or it would learn to copy the answer.`, `Turn the mask back on to see what gets hidden.`],
    `Row “${ft}”: ${pct}.`,
    `“${ft}” = ${w.slice(0, 3).map(([x, j]) => `${x.toFixed(2)}×v(${TOK[j]})`).join(" + ")}${w.length > 3 ? " + …" : ""}. On its own, “${ft}” had nature ${fmt(V[f][0])} and money ${fmt(V[f][1])}. After attention it has nature ${fmt(c.out[f][0])} and money ${fmt(c.out[f][1])}: the output carries meaning borrowed from the tokens it attended to. In a full layer this output then passes through one more learned table (W_O) and is added back onto x.`
  ][st];
  $("#lab-say").textContent = say;
  const subEl = $("#lab-sub"); subEl.textContent = "";
  [].concat(sub).forEach(t => { const d = el("span", { class: "blk" }); d.textContent = t; subEl.appendChild(d); });
}
function renderProj(f) {
  const box = $("#lab-proj"); box.innerHTML = "";
  const P = PROJ[lab.proj], T = W[lab.proj], res = { q: Q, k: K, v: V }[lab.proj][f];
  const seg = el("div", { class: "seg", role: "group", "aria-label": "Which table" });
  Object.entries(PROJ).forEach(([key, pr]) => {
    const b = el("button", { type: "button", "aria-pressed": String(key === lab.proj) }, `${pr.wsym} → ${pr.name}`);
    b.addEventListener("click", () => { lab.proj = key; renderLab(); });
    seg.appendChild(b);
  });
  box.appendChild(seg);
  box.appendChild(el("p", { class: "out-note" }, `The ${P.name}: ${P.job}`));
  const eq = el("div", { class: "proj-eq" });
  const part = (label, shape, rows, cols, data, digits) => {
    const d = el("div", { style: "min-width:0" });
    d.appendChild(el("div", { class: "mat-label" }, `<span>${label}</span><span>${shape}</span>`));
    const t = el("table", { class: "mat small" }); d.appendChild(t);
    matTable(t, rows, cols, data, { digits });
    return d;
  };
  const xc = XDIM.map(s => s.slice(0, 3));
  eq.appendChild(part(`x · “${TOK[f]}”`, "1 × 4", [""], xc, [X[f]], 1));
  eq.appendChild(el("span", { class: "op", "aria-hidden": "true" }, "×"));
  eq.appendChild(part(`${P.wsym} · learned`, "4 × 4", xc, P.cols, T, 1));
  eq.appendChild(el("span", { class: "op", "aria-hidden": "true" }, "="));
  eq.appendChild(part(`${P.sym} · ${P.name}`, "1 × 4", [""], P.cols, [res], 2));
  const wrap = el("div", { class: "scroll-x" }); wrap.appendChild(eq); box.appendChild(wrap);
  const lines = P.cols.map((cn, cidx) => `${cn} = ` + X[f].map((x, i) => `${fmt(x, 1)}×${fmt(T[i][cidx], 1)}`).join(" + ") + ` = ${fmt(res[cidx])}`);
  box.appendChild(el("p", { class: "out-note" }, `Each number of ${P.sym} is x times one column of ${P.wsym}, slot by slot, added up:`));
  const pre = el("pre", { class: "calc" }); pre.textContent = lines.join("\n"); box.appendChild(pre);
}
$("#lab-causal").addEventListener("change", e => { lab.causal = e.target.checked; renderLab(); });
onTheme(renderLab);

/* ---------- 2. costs ---------- */
function renderCosts() {
  const p = +$("#n-slider").value, N = Math.pow(2, p), B = Math.pow(2, +$("#b-slider").value);
  $("#n-out").textContent = fmtInt(N) + " tokens";
  $("#b-out").textContent = B === 1 ? "1 user" : B + " users";
  const gpus = (x) => x > 80e9 ? `${(x / 80e9).toFixed(x < 8e11 ? 1 : 0)} GPUs’ worth of memory.` : `Fits on one 80 GB GPU (${(x / 80e9 * 100).toFixed(x < 8e8 ? 2 : 0)}% of it).`;
  const score = N * N * 32 * 2;
  $("#c-scores").textContent = fmtBytes(score);
  $("#c-scores-g").textContent = `${fmtBig(N * N)} scores per head. ${gpus(score)}`;
  const kv = 2 * 32 * 4096 * N * 2 * B;
  $("#c-kv").textContent = fmtBytes(kv);
  $("#c-kv-g").textContent = `${B > 1 ? fmtBytes(2 * 32 * 4096 * 2 * N) + " per user × " + B + " users. " : ""}${gpus(kv)}`;
  if (N <= 4096) { $("#c-pos").textContent = "100%"; $("#c-pos-g").textContent = `Every position up to ${fmtInt(N)} was practised in training.`; }
  else { $("#c-pos").textContent = `${(4096 / N * 100).toFixed(N > 100000 ? 2 : 1)}%`; $("#c-pos-g").textContent = `Positions past 4,096 were never practised.`; }
  // section 3: the same N, regrouped
  $("#rg-nn").textContent = `${fmtInt(N)} × ${fmtInt(N)} = ${fmtBig(N * N)} scores per head`;
  $("#rg-dd").textContent = `128 × 128 = 16,384 numbers per head, whatever N is`;
  $("#rg-kv").textContent = fmtBytes(2 * 32 * 4096 * N * 2);
  $("#rg-state").textContent = fmtBytes(32 * 32 * 128 * 128 * 2);
}
$("#n-slider").addEventListener("input", renderCosts);
$("#b-slider").addEventListener("input", renderCosts);

/* ---------- 3. priority map ---------- */
const TKEYS = Object.keys(THREADS);
const yearOf = (d) => { const [y, m, dd] = d.split("-").map(Number); return y + (m - 1) / 12 + (dd - 1) / 365; };
function renderMap() {
  const svg = $("#map-svg");
  const W = 900, L = 150, R = 20, top = 16, rowH = 36;
  const H = top + TKEYS.length * rowH + 34;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const x0 = 2014, x1 = 2026.75;
  const X = (y) => L + (y - x0) / (x1 - x0) * (W - L - R);
  let s = "";
  for (let y = 2014; y <= 2026; y++) {
    const x = X(y);
    s += `<line x1="${x}" x2="${x}" y1="${top - 4}" y2="${H - 30}" style="stroke:var(--rule)" stroke-width="1"/>`;
    s += `<text x="${x}" y="${H - 12}" text-anchor="middle" font-size="12" style="fill:var(--muted)">${y}</text>`;
  }
  TKEYS.forEach((k, r) => {
    const y = top + r * rowH + rowH / 2;
    s += `<text x="${L - 14}" y="${y + 4}" text-anchor="end" font-size="13" font-weight="500" style="fill:var(--t-${k})">${THREADS[k].label}</text>`;
    s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" style="stroke:var(--rule)" stroke-dasharray="2 4"/>`;
  });
  const placed = {};
  ENTRIES.forEach(e => {
    e.threads.forEach((k, idx) => {
      const r = TKEYS.indexOf(k);
      const x = X(yearOf(e.date)), mid = top + r * rowH + rowH / 2;
      placed[k] = placed[k] || [];
      const near = placed[k].filter(p => Math.abs(p - x) < 13).length;
      const y = mid + (near === 0 ? 0 : near % 2 ? -9 : 9);
      placed[k].push(x);
      const fill = idx === 0 ? `fill:var(--t-${k})` : `fill:var(--surface);stroke:var(--t-${k})`;
      s += `<g class="dot" tabindex="0" role="link" data-id="${e.id}" aria-label="${e.name}, ${e.dateLabel}"><title>${e.name} · ${e.dateLabel}</title><circle cx="${x.toFixed(1)}" cy="${y}" r="${idx === 0 ? 6.5 : 5}" style="${fill}" stroke-width="2"/></g>`;
    });
  });
  svg.innerHTML = s;
  svg.querySelectorAll(".dot").forEach(g => {
    const go = () => { const t = document.getElementById("e-" + g.dataset.id); if (t) t.scrollIntoView({ block: "start" }); };
    g.addEventListener("click", go);
    g.addEventListener("keydown", ev => { if (ev.key === "Enter") go(); });
  });
}

/* ---------- 4. figures ---------- */
const MN = 16;
function maskCode(p, i, j) {
  const causalOK = j <= i;
  switch (p) {
    case "causal": return causalOK ? 1 : 0;
    case "strided": { if (!causalOK) return 0; const d = i - j; if (d < 4) return 1; if (d % 4 === 0) return 2; return 0; }
    case "topk": {
      if (!causalOK) return 0;
      const sc = []; for (let t = 0; t <= i; t++) sc.push([hash(i, t), t]);
      sc.sort((a, b) => b[0] - a[0]);
      return sc.slice(0, 3).some(z => z[1] === j) ? 1 : 3;
    }
    case "longformer": { if (i === 0 || j === 0) return 2; return Math.abs(i - j) <= 2 ? 1 : 0; }
    case "window": return causalOK && i - j < 4 ? 1 : 0;
    case "sink": { if (!causalOK) return 0; if (j < 2) return 2; return i - j < 4 ? 1 : 0; }
    case "alibi": return causalOK ? Math.exp(-0.3 * (i - j)) : 0;
    case "nsa": case "csa": {
      if (!causalOK) return 0;
      if (i - j < 3) return 1;
      const bi = Math.floor(i / 4), bj = Math.floor(j / 4);
      if (bj >= bi) return 0;
      const nsel = p === "nsa" ? 1 : Math.min(2, bi);
      const order = []; for (let b = 0; b < bi; b++) order.push([hash(i * 7 + (p === "nsa" ? 1 : 2), b), b]);
      order.sort((a, c) => c[0] - a[0]);
      return order.slice(0, nsel).some(z => z[1] === bj) ? 2 : 3;
    }
    case "dsa": {
      if (!causalOK) return 0;
      const sc = []; for (let t = 0; t <= i; t++) sc.push([hash(i + 99, t), t]);
      sc.sort((a, b) => b[0] - a[0]);
      return sc.slice(0, 4).some(z => z[1] === j) ? 2 : 3;
    }
  }
  return 0;
}
const MASK_CAP = {
  causal: (c) => `Full causal attention: all ${c.total} past pairs are scored, so the work grows with N².`,
  strided: (c) => `${c.att} of ${c.total} causal pairs attended. Fixed by hand, identical for every input.`,
  topk: (c) => `Only ${c.att} pairs survive, but all ${c.total} scores were computed to find them.`,
  longformer: (c) => `${c.att} of ${c.total} pairs (bidirectional encoder). Token 0 is global; everyone else sees ±2 neighbours.`,
  window: (c) => `${c.att} of ${c.total} causal pairs. The cache never holds more than W tokens.`,
  sink: (c) => `${c.att} of ${c.total} causal pairs. The first two tokens stay in the cache forever.`,
  alibi: () => `Full attention, but every score is pushed down in proportion to distance. Far tokens stay reachable, just quieter.`,
  nsa: () => `Each query reads coarse block summaries, then attends in full to the best-rated block, plus a local window.`,
  csa: () => `Each grey square stands for one compressed entry covering 4 tokens; the indexer picks the best entries, plus a raw window.`,
  dsa: (c) => `The cheap indexer touches all ${c.total} pairs; full attention runs on only ${c.att}.`
};
function drawMask(cv, p) {
  const cell = 10, gap = 1, S = MN * (cell + gap) + gap;
  const dpr = window.devicePixelRatio || 1;
  cv.width = S * dpr; cv.height = S * dpr; cv.style.width = S + "px";
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const heat = cssVar("--heat"), cellC = cssVar("--cell"), acc = cssVar("--accent"), bg = cssVar("--surface");
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  for (let i = 0; i < MN; i++) for (let j = 0; j < MN; j++) {
    const v = maskCode(p, i, j);
    let col = cellC;
    if (p === "alibi") col = v > 0 ? `rgba(${heat},${(0.12 + 0.85 * v).toFixed(3)})` : cellC;
    else if (v === 1) col = `rgba(${heat},0.9)`;
    else if (v === 2) col = acc;
    else if (v === 3) col = `rgba(${heat},0.25)`;
    g.fillStyle = col;
    g.fillRect(gap + j * (cell + gap), gap + i * (cell + gap), cell, cell);
  }
}
function maskCounts(p) {
  let att = 0, total = 0;
  for (let i = 0; i < MN; i++) for (let j = 0; j < MN; j++) {
    const v = maskCode(p, i, j);
    if (p === "longformer") { total++; if (v === 1 || v === 2) att++; continue; }
    if (j <= i) total++;
    if (v === 1 || v === 2) att++;
  }
  return { att, total };
}
function figMask(box, f) {
  const cv = el("canvas", { role: "img", "aria-label": `Attention pattern: ${f.pattern}` });
  box.appendChild(el("div", { class: "lbl" }, "Who attends to whom · 16 tokens"));
  box.appendChild(cv);
  const lg = el("div", { class: "legend" });
  const sw = { 1: "rgba(var(--heat),0.9)", 2: "var(--accent)", 3: "rgba(var(--heat),0.25)" };
  for (const [k, txt] of Object.entries(f.legend || {})) lg.appendChild(el("span", {}, `<i style="background:${sw[k]}"></i>${txt}`));
  lg.appendChild(el("span", {}, `<i style="background:var(--cell)"></i>skipped`));
  box.appendChild(lg);
  box.appendChild(el("p", { class: "cap" }, "Rows are queries (top = first token), columns are keys. " + MASK_CAP[f.pattern](maskCounts(f.pattern))));
  const draw = () => drawMask(cv, f.pattern);
  draw(); onTheme(draw);
}

function figHeads(box, f) {
  box.appendChild(el("div", { class: "lbl" }, "8 query heads, and what is cached"));
  const seg = el("div", { class: "seg", role: "group", "aria-label": "Attention variant" });
  const modes = [["mha", "MHA"], ["gqa", "GQA"], ["mqa", "MQA"], ["mla", "MLA"]];
  const svgWrap = el("div"); const cap = el("p", { class: "cap" });
  let mode = f.mode;
  const render = () => {
    seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === mode)));
    const W = 340, H = 170, n = 8, gx = (W - 40) / (n - 1);
    const hx = (i) => 20 + i * gx;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${mode} head layout">`;
    for (let i = 0; i < n; i++) s += `<circle cx="${hx(i)}" cy="22" r="10" style="fill:var(--t-exact)"/><text x="${hx(i)}" y="26" text-anchor="middle" font-size="10" style="fill:var(--surface)">Q${i + 1}</text>`;
    let groups;
    if (mode === "mha") groups = [...Array(8)].map((_, i) => [i]);
    if (mode === "gqa") groups = [[0, 1, 2, 3], [4, 5, 6, 7]];
    if (mode === "mqa") groups = [[0, 1, 2, 3, 4, 5, 6, 7]];
    if (mode !== "mla") {
      groups.forEach(gr => {
        const cx = (hx(gr[0]) + hx(gr[gr.length - 1])) / 2, w = Math.max(30, hx(gr[gr.length - 1]) - hx(gr[0]) + 26);
        gr.forEach(i => s += `<line x1="${hx(i)}" y1="33" x2="${cx}" y2="112" style="stroke:var(--muted)" stroke-width="1"/>`);
        s += `<rect x="${cx - w / 2}" y="112" width="${w}" height="28" rx="4" style="fill:var(--t-decode)"/><text x="${cx}" y="130" text-anchor="middle" font-size="11" font-weight="600" style="fill:var(--surface)">K,V</text>`;
      });
    } else {
      for (let i = 0; i < n; i++) {
        s += `<line x1="${hx(i)}" y1="33" x2="${hx(i)}" y2="64" style="stroke:var(--muted)"/><rect x="${hx(i) - 13}" y="64" width="26" height="20" rx="3" style="fill:none;stroke:var(--t-decode)" stroke-dasharray="3 2"/><text x="${hx(i)}" y="78" text-anchor="middle" font-size="9" style="fill:var(--t-decode)">K,V</text>`;
        s += `<line x1="${hx(i)}" y1="84" x2="${W / 2 - 30}" y2="120" style="stroke:var(--rule)"/>`;
      }
      s += `<rect x="${W / 2 - 90}" y="120" width="120" height="28" rx="4" style="fill:var(--t-compress)"/><text x="${W / 2 - 30}" y="138" text-anchor="middle" font-size="11" font-weight="600" style="fill:var(--surface)">latent c (512)</text>`;
      s += `<rect x="${W / 2 + 40}" y="120" width="70" height="28" rx="4" style="fill:var(--t-position)"/><text x="${W / 2 + 75}" y="138" text-anchor="middle" font-size="11" font-weight="600" style="fill:var(--surface)">RoPE k (64)</text>`;
      s += `<text x="${W - 8}" y="78" text-anchor="end" font-size="10" style="fill:var(--muted)">rebuilt, not cached</text>`;
    }
    s += `<text x="8" y="${H - 6}" font-size="11" style="fill:var(--muted)">cached per token, per layer ↑</text></svg>`;
    svgWrap.innerHTML = s;
    cap.textContent = {
      mha: "MHA: every head keeps its own K and V. 8 heads cache 8 K/V pairs per token.",
      gqa: "GQA: heads share within groups. 2 groups cache 2 K/V pairs per token, 4× smaller than MHA here.",
      mqa: "MQA: all heads share one K/V pair, 8× smaller than MHA here. Fastest, with the most quality loss.",
      mla: "MLA: cache one latent per token; each head rebuilds its K and V from it. DeepSeek-V2 caches 512 + 64 = 576 numbers per token per layer, where full MHA with its 128 heads of 128 would need 2 × 128 × 128 = 32,768."
    }[mode];
  };
  modes.forEach(([m, t]) => {
    const b = el("button", { type: "button", "data-m": m }, t);
    b.addEventListener("click", () => { mode = m; render(); });
    seg.appendChild(b);
  });
  box.appendChild(seg); box.appendChild(svgWrap); box.appendChild(cap);
  render();
}

function figKV(box) {
  box.appendChild(el("div", { class: "lbl" }, "KV cache for one sequence"));
  const id = "kv-" + Math.random().toString(36).slice(2, 7);
  const ctl = el("div", { class: "mini-ctl" }, `<label for="${id}">Context</label><input type="range" id="${id}" min="10" max="20" value="17"><output></output>`);
  const bars = el("div", { class: "kvbars" });
  const cap = el("p", { class: "cap" }, "Same 32-layer model as above (32 heads × 128). GQA uses 8 groups. The MLA bar uses DeepSeek-V2's latent size (512 + 64). The sliding-window bar is GQA-8 with W = 4,096.");
  box.appendChild(ctl); box.appendChild(bars); box.appendChild(cap);
  const inp = ctl.querySelector("input"), out = ctl.querySelector("output");
  const rows = [["MHA", 2 * 32 * 128], ["GQA-8", 2 * 8 * 128], ["MQA", 2 * 128], ["MLA", 576], ["SWA 4K", 2 * 8 * 128, 4096]];
  const render = () => {
    const N = Math.pow(2, +inp.value); out.textContent = fmtInt(N) + " tokens";
    const vals = rows.map(([n, e, cap]) => [n, e * 2 * 32 * Math.min(N, cap || Infinity)]);
    const mx = vals[0][1];
    bars.innerHTML = vals.map(([n, b]) => `<div class="kvrow"><span class="nm">${n}</span><span class="track"><span class="fill" style="display:block;width:${Math.max(0.6, b / mx * 100).toFixed(2)}%"></span></span><span class="val">${fmtBytes(b)}</span></div>`).join("");
  };
  inp.addEventListener("input", render); render();
}

function figRope(box) {
  box.appendChild(el("div", { class: "lbl" }, "One rotated pair of dimensions"));
  const svgWrap = el("div");
  const id1 = "rm-" + Math.random().toString(36).slice(2, 7), id2 = id1 + "n";
  const ctl = el("div", { class: "mini-ctl" },
    `<label for="${id1}">q at position m</label><input type="range" id="${id1}" min="0" max="24" value="6"><output data-o="m"></output>` +
    `<label for="${id2}">k at position n</label><input type="range" id="${id2}" min="0" max="24" value="3"><output data-o="n"></output>`);
  const btns = el("div", { class: "mini-ctl" });
  const shift = el("button", { class: "btn", type: "button" }, "Move both +4"), back = el("button", { class: "btn", type: "button" }, "Reset");
  btns.appendChild(shift); btns.appendChild(back);
  const read = el("p", { class: "cap" });
  box.appendChild(svgWrap); box.appendChild(ctl); box.appendChild(btns); box.appendChild(read);
  const [im, inn] = ctl.querySelectorAll("input");
  const th = 0.3, pq = 0.35, pk = 1.2;
  const render = () => {
    const m = +im.value, n = +inn.value;
    ctl.querySelector('[data-o="m"]').textContent = m; ctl.querySelector('[data-o="n"]').textContent = n;
    const aq = pq + m * th, ak = pk + n * th, cx = 110, cy = 100, r = 80;
    const pt = (a, rr) => [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
    const [qx, qy] = pt(aq, r), [kx, ky] = pt(ak, r);
    let s = `<svg viewBox="0 0 300 200" role="img" aria-label="Rotated query and key vectors">`;
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" style="fill:none;stroke:var(--rule)"/><line x1="${cx - r - 6}" x2="${cx + r + 6}" y1="${cy}" y2="${cy}" style="stroke:var(--rule)"/><line y1="${cy - r - 6}" y2="${cy + r + 6}" x1="${cx}" x2="${cx}" style="stroke:var(--rule)"/>`;
    s += `<line x1="${cx}" y1="${cy}" x2="${qx}" y2="${qy}" style="stroke:var(--accent)" stroke-width="3"/><circle cx="${qx}" cy="${qy}" r="5" style="fill:var(--accent)"/>`;
    s += `<line x1="${cx}" y1="${cy}" x2="${kx}" y2="${ky}" style="stroke:var(--t-decode)" stroke-width="3"/><circle cx="${kx}" cy="${ky}" r="5" style="fill:var(--t-decode)"/>`;
    const [lqx, lqy] = pt(aq, r + 14), [lkx, lky] = pt(ak, r + 14);
    s += `<text x="${lqx}" y="${lqy + 4}" text-anchor="middle" font-size="12" font-weight="600" style="fill:var(--accent)">q</text><text x="${lkx}" y="${lky + 4}" text-anchor="middle" font-size="12" font-weight="600" style="fill:var(--t-decode)">k</text>`;
    const score = Math.cos(aq - ak);
    s += `<text x="210" y="70" font-size="12" style="fill:var(--muted)">m − n</text><text x="210" y="92" font-size="22" style="fill:var(--ink);font-family:var(--f-mono)">${m - n}</text>`;
    s += `<text x="210" y="124" font-size="12" style="fill:var(--muted)">q · k</text><text x="210" y="146" font-size="22" style="fill:var(--ink);font-family:var(--f-mono)">${fmt(score, 3)}</text></svg>`;
    svgWrap.innerHTML = s;
    read.textContent = `q is rotated by m·θ and k by n·θ (θ = 0.3 rad per position here). Press “Move both +4”: both arrows turn, the gap m − n stays ${m - n}, and the score stays ${fmt(score, 3)}. Only distance matters.`;
  };
  im.addEventListener("input", render); inn.addEventListener("input", render);
  shift.addEventListener("click", () => {
    if (+im.value + 4 > 24 || +inn.value + 4 > 24) { im.value = +im.value % 4; inn.value = +inn.value % 4; }
    im.value = +im.value + 4; inn.value = +inn.value + 4; render();
  });
  back.addEventListener("click", () => { im.value = 6; inn.value = 3; render(); });
  render();
}

function figExt(box) {
  box.appendChild(el("div", { class: "lbl" }, "How each method slows each RoPE dimension"));
  const svgWrap = el("div");
  const id = "ext-" + Math.random().toString(36).slice(2, 7);
  const ctl = el("div", { class: "mini-ctl" }, `<label for="${id}">Extension factor s</label><input type="range" id="${id}" min="1" max="5" value="3"><output></output>`);
  const lg = el("div", { class: "legend" }, `<span><i style="background:var(--accent)"></i>Position interpolation</span><span><i style="background:var(--t-length)"></i>NTK-aware</span><span><i style="background:var(--t-state)"></i>YaRN</span>`);
  const cap = el("p", { class: "cap" }, "A RoPE head with d = 128 (64 rotating pairs), base 10,000, trained at 4,096 tokens. Pairs on the left turn many times within the trained window and encode nearby order; pairs on the right never finish one turn. Interpolation slows them all equally. NTK leaves the fast pairs almost alone. YaRN leaves fast pairs exactly as they were and fully slows only the pairs that never completed a turn.");
  box.appendChild(svgWrap); box.appendChild(ctl); box.appendChild(lg); box.appendChild(cap);
  const inp = ctl.querySelector("input"), out = ctl.querySelector("output");
  const d = 128, P = 64, base = 10000, Lt = 4096, a = 1, b = 32;
  const theta = (i) => Math.pow(base, -2 * i / d);
  const rot = (i) => Lt / (2 * Math.PI / theta(i));
  const render = () => {
    const s = Math.pow(2, +inp.value); out.textContent = s + "× (" + fmtInt(Lt * s) + " tokens)";
    const W = 520, H = 230, l = 54, r = 12, t = 14, bt = 42;
    const X = (i) => l + i / (P - 1) * (W - l - r);
    const Y = (f) => t + (-Math.log2(f)) / Math.log2(s) * (H - t - bt); // f=1 top, f=1/s bottom
    const pi = (i) => 1 / s;
    const ntk = (i) => Math.pow(s, -2 * i / (d - 2));
    const yarn = (i) => { const g = Math.min(1, Math.max(0, (rot(i) - a) / (b - a))); return (1 - g) / s + g; };
    const line = (fn, c) => `<polyline points="${[...Array(P).keys()].map(i => X(i).toFixed(1) + "," + Y(fn(i)).toFixed(1)).join(" ")}" style="fill:none;stroke:var(${c})" stroke-width="2.5"/>`;
    let iB = 0, iA = 0; for (let i = 0; i < P; i++) { if (rot(i) >= b) iB = i; if (rot(i) >= a) iA = i; }
    let sv = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Per-dimension scaling factors">`;
    sv += `<line x1="${l}" x2="${W - r}" y1="${Y(1)}" y2="${Y(1)}" style="stroke:var(--rule)"/><line x1="${l}" x2="${W - r}" y1="${Y(1 / s)}" y2="${Y(1 / s)}" style="stroke:var(--rule)"/>`;
    sv += `<text x="${l - 6}" y="${Y(1) + 4}" text-anchor="end" font-size="11" style="fill:var(--muted)">1× (kept)</text><text x="${l - 6}" y="${Y(1 / s) + 4}" text-anchor="end" font-size="11" style="fill:var(--muted)">÷${s}</text>`;
    [[iB, "32 turns"], [iA, "1 turn"]].forEach(([i, txt]) => {
      sv += `<line x1="${X(i)}" x2="${X(i)}" y1="${t}" y2="${H - bt}" style="stroke:var(--muted)" stroke-dasharray="3 3"/><text x="${X(i) + 4}" y="${H - bt - 6}" font-size="10.5" style="fill:var(--muted)">${txt} in 4K</text>`;
    });
    sv += line(pi, "--accent") + line(ntk, "--t-length") + line(yarn, "--t-state");
    sv += `<text x="${l}" y="${H - 18}" font-size="11" style="fill:var(--muted)">pair 1 · fast rotation</text><text x="${W - r}" y="${H - 18}" text-anchor="end" font-size="11" style="fill:var(--muted)">pair 64 · slow rotation</text>`;
    sv += `<text x="${(l + W - r) / 2}" y="${H - 2}" text-anchor="middle" font-size="11" style="fill:var(--muted)">RoPE dimension pair →</text></svg>`;
    svgWrap.innerHTML = sv;
  };
  inp.addEventListener("input", render); render();
}

const MEM_TOKENS = [
  { label: "“meeting at 2 pm”", k: [1, 0], v: [2, 1] },
  { label: "“in room 3”", k: [0, 1], v: [3, 0] },
  { label: "“meeting moved to 5 pm”", k: [1, 0], v: [5, 5] }
];
const MODE_NAME = { linear: "Linear", delta: "Delta", gated: "Gated delta" };
function figMemory(box, f) {
  box.appendChild(el("div", { class: "lbl" }, "Memory lab · a 2 × 2 state S"));
  const st = { mode: f.mode, step: 3, alpha: 0.8 };
  const seg = el("div", { class: "seg", role: "group", "aria-label": "Update rule" });
  f.modes.forEach(m => { const b = el("button", { type: "button", "data-m": m }, MODE_NAME[m]); b.addEventListener("click", () => { st.mode = m; render(); }); seg.appendChild(b); });
  const id = "al-" + Math.random().toString(36).slice(2, 7);
  const actl = el("div", { class: "mini-ctl" }, `<label for="${id}">Forget gate α</label><input type="range" id="${id}" min="0.5" max="1" step="0.05" value="0.8"><output></output>`);
  const nav = el("div", { class: "mini-ctl" });
  const prev = el("button", { class: "btn", type: "button" }, "← Back"), next = el("button", { class: "btn", type: "button" }, "Next token →");
  nav.appendChild(prev); nav.appendChild(next);
  const toks = el("div", { class: "mem-toks" });
  const grid = el("div", { class: "mem-grid" });
  const tblWrap = el("div"); const calc = el("div", { class: "mem-calc" });
  grid.appendChild(tblWrap); grid.appendChild(calc);
  const ro = el("div", { class: "readout" });
  box.appendChild(seg); box.appendChild(actl); box.appendChild(toks); box.appendChild(grid); box.appendChild(ro); box.appendChild(nav);
  const ain = actl.querySelector("input"), aout = actl.querySelector("output");
  ain.addEventListener("input", () => { st.alpha = +ain.value; render(); });
  prev.addEventListener("click", () => { st.step = Math.max(0, st.step - 1); render(); });
  next.addEventListener("click", () => { st.step = Math.min(3, st.step + 1); render(); });
  const v2 = (a) => `[${a.map(x => Math.abs(x) < 0.005 ? "0" : fmt(x, 2).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1")).join(", ")}]`;
  function render() {
    seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === st.mode)));
    actl.hidden = st.mode !== "gated"; aout.textContent = st.alpha.toFixed(2);
    let S = [[0, 0], [0, 0]], lastCalc = "Nothing written yet. S starts at zero.";
    for (let t = 0; t < st.step; t++) {
      const { k, v } = MEM_TOKENS[t];
      let lines = [];
      if (st.mode === "gated") { S = S.map(r => r.map(x => x * st.alpha)); lines.push(`decay: S ← ${st.alpha.toFixed(2)}·S`); }
      if (st.mode === "linear") {
        S = S.map((r, a) => r.map((x, c) => x + k[a] * v[c]));
        lines.push(`write: S ← S + kᵀv`, `k = ${v2(k)}, v = ${v2(v)}`);
      } else {
        const old = [0, 1].map(c => k[0] * S[0][c] + k[1] * S[1][c]);
        const gap = v.map((x, c) => x - old[c]);
        S = S.map((r, a) => r.map((x, c) => x + k[a] * gap[c]));
        lines.push(`read: v_old = k·S = ${v2(old)}`, `gap = v − v_old = ${v2(v)} − ${v2(old)} = ${v2(gap)}`, `write: S ← S + kᵀ·gap`);
      }
      lastCalc = `Token ${t + 1}: ${MEM_TOKENS[t].label}\n` + lines.join("\n");
    }
    toks.innerHTML = MEM_TOKENS.map((t, i) => `<span class="mem-tok ${i < st.step - 1 ? "past" : i === st.step - 1 ? "cur" : ""}">${i + 1}. ${t.label}</span>`).join("");
    tblWrap.innerHTML = `<table class="mat small"><thead><tr><th></th><th>v₁</th><th>v₂</th></tr></thead><tbody>` +
      S.map((r, a) => `<tr><th scope="row">${a === 0 ? "meeting" : "room"}</th>${r.map(x => `<td style="background:rgba(${cssVar("--heat")},${Math.min(0.6, Math.abs(x) / 8).toFixed(3)})">${fmt(x, 2)}</td>`).join("")}</tr>`).join("") + `</tbody></table>`;
    calc.textContent = lastCalc;
    const truth = (key) => { let ans = null; for (let t = 0; t < st.step; t++) if (MEM_TOKENS[t].k[0] === key[0] && MEM_TOKENS[t].k[1] === key[1]) ans = MEM_TOKENS[t].v; return ans || [0, 0]; };
    const q = [["When is the meeting?", [1, 0]], ["Which room?", [0, 1]]];
    ro.innerHTML = q.map(([txt, qq]) => {
      const got = [0, 1].map(c => qq[0] * S[0][c] + qq[1] * S[1][c]);
      const want = truth(qq);
      const ok = got.every((x, c) => Math.abs(x - want[c]) < 0.05);
      const big = Math.abs(want[0]) >= Math.abs(want[1]) ? 0 : 1;
      const ratio = want[big] ? got[big] / want[big] : 0;
      const faded = !ok && ratio > 0 && ratio < 1 && got.every((x, c) => Math.abs(x - ratio * want[c]) < 0.05);
      const verdict = ok ? "✓ latest value" : faded ? `faded to ${Math.round(ratio * 100)}% of ${v2(want)}` : "✗ latest is " + v2(want);
      return `<div><span>${txt}</span><span class="ans">q·S = ${v2(got)}</span><span class="${ok ? "ok" : faded ? "fade" : "no"}">${verdict}</span></div>`;
    }).join("");
    prev.disabled = st.step === 0; next.disabled = st.step === 3;
  }
  onTheme(render);
  render();
}

function figStack(box, f) {
  box.appendChild(el("div", { class: "lbl" }, "Layer schedule"));
  const row = el("div", { style: "display:flex;flex-wrap:wrap;gap:4px;margin-top:4px" });
  const exact = new Set(["S", "G"]);
  [...f.pattern].forEach(ch => {
    const ex = exact.has(ch);
    row.appendChild(el("span", { style: `display:inline-flex;align-items:center;justify-content:center;width:30px;height:38px;border-radius:3px;font:600 13px var(--f-mono);color:var(--surface);background:var(${ex ? "--t-exact" : "--t-state"})`, title: ex ? "full attention (KV cache)" : "linear / delta (fixed state)" }, ch));
  });
  box.appendChild(row);
  const n = f.pattern.length, e = [...f.pattern].filter(c => exact.has(c)).length;
  box.appendChild(el("div", { class: "legend" }, `<span><i style="background:var(--t-state)"></i>fixed-size state</span><span><i style="background:var(--t-exact)"></i>full attention, keeps a KV cache</span>`));
  box.appendChild(el("p", { class: "cap" }, `${e} of ${n} layers keep a growing KV cache, so the cache is about ${Math.round(e / n * 100)}% of an all-attention model's at the same width.`));
}

const FIGS = { mask: figMask, heads: figHeads, kv: figKV, rope: figRope, ext: figExt, memory: figMemory, stack: figStack };

/* ---------- 5. timeline ---------- */
const byId = Object.fromEntries(ENTRIES.map(e => [e.id, e]));
function renderTimeline() {
  const tl = $("#tl");
  const sorted = ENTRIES.map((e, i) => [e, i]).sort((a, b) => a[0].date < b[0].date ? -1 : a[0].date > b[0].date ? 1 : a[1] - b[1]).map(p => p[0]);
  sorted.forEach(e => {
    const era = ERAS.find(x => x.before === e.id);
    if (era) tl.appendChild(el("div", { class: "era" }, `<div class="yrs">${era.years}</div><div><h3>${era.title}</h3><p>${era.text}</p></div>`));
    const year = e.date.slice(0, 4);
    const tags = e.threads.map(t => `<span class="tag" style="--c:var(--t-${t})">${THREADS[t].label}</span>`).join("");
    const srcs = [e.src, e.src2].filter(Boolean).map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>`).join("");
    const resp = e.responds.length ? `<p class="responds">Responds to: ${e.responds.map(id => `<a href="#e-${id}">${byId[id].name} (${byId[id].date.slice(0, 4)})</a>`).join(" · ")}</p>` : "";
    const art = el("article", { class: "entry", id: "e-" + e.id, "data-threads": e.threads.join(" ") });
    art.innerHTML = `
      <div class="when"><div class="d">${e.dateLabel}</div><div class="y">${year}</div></div>
      <div class="card panel">
        <div class="card-head"><h3>${e.name}</h3><span class="who">${e.who}</span>${e.added ? '<span class="badge-added">added</span>' : ""}</div>
        <div class="card-head" style="margin-top:8px">${tags}<span class="srcs">${srcs}</span></div>
        ${resp}
        <div class="body${e.fig ? " has-fig" : ""}">
          <div class="txt"><div class="lbl">Before</div><p>${e.before}</p><div class="lbl">The problem</div><p>${e.problem}</p><div class="lbl">The fix</div><p>${e.mechanism}</p></div>
          ${e.fig ? '<div class="fig"></div>' : ""}
        </div>
        ${e.build ? `<div class="build"><div class="lbl">Build it up, one step at a time</div><ol>${e.build.map(b => `<li><h4>${b.h}</h4><p>${b.p}</p>${b.calc ? `<div class="scroll-x"><pre class="calc">${b.calc}</pre></div>` : ""}</li>`).join("")}</ol></div>` : ""}
        ${e.note ? `<p class="note"><b>Date check.</b> ${e.note}</p>` : ""}
        ${e.cls ? `<p class="note cls"><b>From class.</b> ${e.cls}</p>` : ""}
        <div class="trade">
          <div class="buys"><div class="lbl">What it solved</div><ul>${e.buys.map(x => `<li>${x}</li>`).join("")}</ul></div>
          <div class="gives"><div class="lbl">Problems it introduced</div><ul>${e.costs.map(x => `<li>${x}</li>`).join("")}</ul></div>
          <div class="when-choose"><div class="lbl">Choose it when</div><p>${e.choose}</p></div>
        </div>
        <p class="leaves">Which left the next problem: <span>${e.leaves}</span></p>
      </div>`;
    tl.appendChild(art);
    if (e.fig) FIGS[e.fig.type](art.querySelector(".fig"), e.fig);
  });
  // chips
  const chips = $("#chips");
  let active = null;
  const all = el("button", { class: "chip all", type: "button", "aria-pressed": "true" }, "All concerns");
  chips.appendChild(all);
  const btns = [all];
  TKEYS.forEach(k => {
    const b = el("button", { class: "chip", type: "button", "aria-pressed": "false", style: `--c:var(--t-${k})`, title: THREADS[k].desc }, THREADS[k].label);
    b.dataset.k = k; chips.appendChild(b); btns.push(b);
  });
  const apply = () => {
    btns.forEach(b => b.setAttribute("aria-pressed", String(active ? b.dataset.k === active : b === all)));
    tl.querySelectorAll(".entry").forEach(a => a.classList.toggle("dim", !!active && !a.dataset.threads.split(" ").includes(active)));
  };
  btns.forEach(b => b.addEventListener("click", () => { active = b === all || active === b.dataset.k ? null : b.dataset.k; apply(); }));
}

/* ---------- 6. closing sections ---------- */
function renderClosing() {
  $("#choose-table tbody").innerHTML = WORKLOADS.map(w => `<tr><td>${w.w}</td><td>${w.pick}</td><td>${w.why}</td></tr>`).join("");
  $("#gloss").innerHTML = GLOSSARY.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("");
  $("#fixes").innerHTML = CORRECTIONS.map(c => `<div class="fix panel"><h3>${c.title}</h3><p>${c.text}</p></div>`).join("");
  const seen = new Set(), items = [];
  ENTRIES.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).forEach(e => [e.src, e.src2].filter(Boolean).forEach(s => {
    if (seen.has(s.url)) return; seen.add(s.url);
    items.push(`<li><a href="${s.url}" target="_blank" rel="noopener">${s.label}</a> <span class="d">· ${e.name} · ${e.dateLabel}</span></li>`);
  }));
  items.push(`<li><a href="https://arxiv.org/abs/1810.04805" target="_blank" rel="noopener">arXiv 1810.04805</a> <span class="d">· BERT, learned positions in wide use · 11 Oct 2018</span></li>`);
  items.push(`<li><a href="https://sebastianraschka.com/llm-architecture-gallery/hybrid-attention/" target="_blank" rel="noopener">Raschka, hybrid attention gallery</a> <span class="d">· layer counts for Qwen3-Next and Kimi Linear</span></li>`);
  $("#src-list").innerHTML = items.join("");
}

/* ---------- boot ---------- */
renderLab();
renderCosts();
renderMap();
renderTimeline();
renderClosing();
})();
