// Charts: line/area charts with a crosshair tooltip, and color assignment.
// Categorical colors are the validated reference palette, used in fixed slot order; color follows the entity.
(function (root) {
  "use strict";
  const SLOTS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
  const OTHER = "#898781";
  // Asset classes always get the same color, whatever else is on screen.
  const CLASS_COLOR = { Equity: SLOTS[0], "Fixed Income": SLOTS[1], Cash: SLOTS[2], "Real Estate": SLOTS[3], Alternatives: SLOTS[4],
    "Cash Equivalent": SLOTS[5], Other: SLOTS[6], Unclassified: OTHER };
  const INK = { text: "#262c33", muted: "#6b7480", grid: "#e1e0d9", axis: "#c3c2b7", surface: "#ffffff" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Stable colors for entities (accounts, securities): slot order by the stable key order given; 8+ fold into Other.
  function colorMap(keys) {
    const m = {};
    keys.forEach((k, i) => { m[k] = i < SLOTS.length - 1 ? SLOTS[i] : OTHER; });
    return m;
  }

  function niceTicks(min, max, n = 5) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0)), r = step0 / mag;
    const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
    return out;
  }
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (d) => `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}, ${d.slice(0, 4)}`;

  const registry = {};
  let uid = 0;
  /**
   * series: [{name, color, points: [[date, value]], area?: true, dash?: true}] sharing the same dates.
   * fmt: value formatter for axis and tooltip. Returns HTML (legend + svg + tooltip + table view).
   */
  function line({ series, fmt, height = 260, label, zeroLine = false }) {
    const id = "lc" + ++uid, W = 760, H = height, M = { t: 14, r: 96, b: 30, l: 70 };
    const dates = series[0] ? series[0].points.map((p) => p[0]) : [];
    if (dates.length < 2) return '<p class="hint">Not enough history in this period to draw a chart yet.</p>';
    const vals = series.flatMap((s) => s.points.map((p) => p[1])).filter((v) => v != null);
    const areaSeries = series.some((s) => s.area);
    const ticks = niceTicks(Math.min(...vals, areaSeries || zeroLine ? 0 : Infinity), Math.max(...vals));
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const x = (i) => M.l + (i / (dates.length - 1)) * (W - M.l - M.r), y = (v) => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b);
    const grid = ticks.map((t) => `<line x1="${M.l}" x2="${W - M.r}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 && y0 < 0 ? INK.axis : INK.grid}" stroke-width="1"/>
      <text x="${M.l - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="${INK.muted}">${esc(fmt(t))}</text>`).join("");
    // Month ticks (or a few evenly spaced dates for short ranges).
    const xt = [];
    const monthStarts = dates.map((d, i) => [d, i]).filter(([d, i]) => i === 0 || d.slice(5, 7) !== dates[i - 1].slice(5, 7));
    const every = Math.max(1, Math.ceil(monthStarts.length / 7));
    (monthStarts.length >= 3 ? monthStarts.filter((_, k) => k % every === 0) : [[dates[0], 0], [dates[dates.length - 1], dates.length - 1]])
      .forEach(([d, i]) => xt.push(`<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${INK.muted}">${esc(monthStarts.length >= 3 ? MONTHS[+d.slice(5, 7) - 1] + (d.slice(5, 7) === "01" || i === 0 ? " " + d.slice(2, 4) : "") : fmtDate(d))}</text>`));
    const paths = series.map((s) => {
      const pts = s.points.map((p, i) => (p[1] == null ? null : [x(i), y(p[1])])).filter(Boolean);
      const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
      const fill = s.area ? `<path d="${d}L${pts[pts.length - 1][0].toFixed(1)},${y(Math.max(y0, 0)).toFixed(1)}L${pts[0][0].toFixed(1)},${y(Math.max(y0, 0)).toFixed(1)}Z" fill="${s.color}" fill-opacity="0.16"/>` : "";
      return `${fill}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"${s.dash ? ' stroke-dasharray="5 4"' : ""}/>`;
    }).join("");
    // Direct end labels (up to 4 series), nudged apart so they don't overlap.
    const ends = series.slice(0, 4).map((s) => ({ s, v: s.points[s.points.length - 1][1] })).filter((e) => e.v != null)
      .map((e) => ({ ...e, yy: y(e.v) })).sort((a, b) => a.yy - b.yy);
    for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 14) ends[i].yy = ends[i - 1].yy + 14;
    const endLabels = ends.map((e) => `<circle cx="${x(dates.length - 1)}" cy="${y(e.v)}" r="4" fill="${e.s.color}" stroke="${INK.surface}" stroke-width="2"/>
      <text x="${x(dates.length - 1) + 8}" y="${e.yy + 4}" font-size="11" font-weight="700" fill="${INK.text}">${esc(fmt(e.v))}</text>`).join("");
    registry[id] = { series, dates, fmt, x, y, M, W, H };
    const legend = series.length > 1 ? `<div class="lc-legend">${series.map((s) => `<span><i style="background:${s.color}${s.dash ? ";background:repeating-linear-gradient(90deg," + s.color + " 0 5px,transparent 5px 9px)" : ""}"></i>${esc(s.name)}</span>`).join("")}</div>` : "";
    const step = Math.max(1, Math.ceil(dates.length / 60));
    const rows = dates.map((d, i) => [d, i]).filter(([, i]) => i % step === 0 || i === dates.length - 1)
      .map(([d, i]) => `<tr><td>${fmtDate(d)}</td>${series.map((s) => `<td class="n">${s.points[i][1] == null ? "&ndash;" : esc(fmt(s.points[i][1]))}</td>`).join("")}</tr>`).join("");
    return `${legend}<div class="lc-wrap"><svg id="${id}" class="lc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label || "Chart")}" tabindex="0">
        ${grid}<line x1="${M.l}" x2="${W - M.r}" y1="${H - M.b}" y2="${H - M.b}" stroke="${INK.axis}"/>${xt.join("")}${paths}${endLabels}
        <line class="lc-cross" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" stroke="${INK.muted}" stroke-width="1" visibility="hidden"/>
        <g class="lc-dots"></g><rect class="lc-hit" x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}" fill="transparent"/></svg>
        <div class="lc-tip" hidden></div></div>
      <details class="table-view"><summary>Show as table</summary><div class="scroll"><table><thead><tr><th>Date</th>${series.map((s) => `<th class="n">${esc(s.name)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></details>`;
  }

  function show(svg, i) {
    const R = registry[svg.id];
    if (!R) return;
    i = Math.max(0, Math.min(R.dates.length - 1, i));
    svg.dataset.i = i;
    const cx = R.x(i), cross = svg.querySelector(".lc-cross");
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
    svg.querySelector(".lc-dots").innerHTML = R.series.map((s) => (s.points[i][1] == null ? "" :
      `<circle cx="${cx}" cy="${R.y(s.points[i][1])}" r="4" fill="${s.color}" stroke="#fff" stroke-width="2"/>`)).join("");
    const tip = svg.parentElement.querySelector(".lc-tip");
    tip.replaceChildren();
    const h = document.createElement("div"); h.className = "lc-tip-date"; h.textContent = fmtDate(R.dates[i]); tip.appendChild(h);
    for (const s of R.series) {
      const row = document.createElement("div"); row.className = "lc-tip-row";
      const key = document.createElement("i"); key.style.background = s.color;
      const v = document.createElement("b"); v.textContent = s.points[i][1] == null ? "–" : R.fmt(s.points[i][1]);
      const n = document.createElement("span"); n.textContent = s.name;
      row.append(key, v, n); tip.appendChild(row);
    }
    tip.hidden = false;
    const box = svg.getBoundingClientRect(), px = (cx / R.W) * box.width;
    tip.style.left = Math.min(box.width - tip.offsetWidth - 4, Math.max(4, px + 12)) + "px";
  }
  function hide(svg) {
    svg.querySelector(".lc-cross").setAttribute("visibility", "hidden");
    svg.querySelector(".lc-dots").innerHTML = "";
    svg.parentElement.querySelector(".lc-tip").hidden = true;
  }
  function wire(doc) {
    doc.addEventListener("pointermove", (ev) => {
      const svg = ev.target.closest && ev.target.closest("svg.lc");
      if (!svg || !registry[svg.id]) return;
      const R = registry[svg.id], box = svg.getBoundingClientRect(), vx = ((ev.clientX - box.left) / box.width) * R.W;
      show(svg, Math.round(((vx - R.M.l) / (R.W - R.M.l - R.M.r)) * (R.dates.length - 1)));
    });
    doc.addEventListener("pointerout", (ev) => { const svg = ev.target.closest && ev.target.closest("svg.lc"); if (svg && !svg.contains(ev.relatedTarget)) hide(svg); });
    doc.addEventListener("keydown", (ev) => {
      const svg = ev.target.closest && ev.target.closest("svg.lc");
      if (!svg || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) return;
      ev.preventDefault();
      const R = registry[svg.id], cur = svg.dataset.i ? +svg.dataset.i : R.dates.length - 1;
      show(svg, ev.key === "Home" ? 0 : ev.key === "End" ? R.dates.length - 1 : cur + (ev.key === "ArrowLeft" ? -1 : 1));
    });
    doc.addEventListener("focusout", (ev) => { if (ev.target.matches && ev.target.matches("svg.lc")) hide(ev.target); });
  }

  root.Charts = { SLOTS, OTHER, CLASS_COLOR, colorMap, line, wire, fmtDate };
})(window);
