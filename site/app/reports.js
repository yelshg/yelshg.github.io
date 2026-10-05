// Home reporting: a left menu per selected portfolios with Activity summary, Allocations,
// Allocation vs Target and Performance, each with a period and an "as of" date.
(function (root) {
  "use strict";
  const { esc, money, pct } = U;
  const NAV = [["home", "Overview"], ["home-activity", "Activity summary"], ["home-allocations", "Allocations"],
    ["home-target", "Allocation vs Target"], ["home-performance", "Performance"], ["home-transactions", "Transactions"]];
  const H = () => App.state.home;

  // pfSel stays null (= every portfolio, including new ones) until the user ticks or unticks one.
  const isSelected = (id) => !H().pfSel || H().pfSel.has(id);
  function selectedPortfolios() {
    return Store.all("portfolios").sort((a, b) => a.name.localeCompare(b.name)).filter((p) => isSelected(p.id));
  }
  const accountsOf = (pfs) => [...new Set(pfs.flatMap((p) => p.account_numbers))];
  function dates() {
    const h = H(), asOf = h.asOfMode === "custom" && h.asOf ? h.asOf : History.lastBusinessDay();
    return { asOf, kind: h.period, from: h.from };
  }
  const activeWindow = (list, d) => (list || []).find((w) => (!w.start || w.start <= d) && (!w.end || w.end >= d));
  function reportingModel(pf, asOf) {
    const w = activeWindow(pf.reporting_targets, asOf);
    return Store.get("models", (w && w.model_id) || pf.model_id);
  }
  const compact = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; return a >= 1e6 ? `${s}$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${s}$${(a / 1e3).toFixed(1)}k` : `${s}$${a.toFixed(0)}`; };
  const pctTxt = (v, d = 2) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;

  // ---- layout ----
  function shell(route, content) {
    const all = Store.all("portfolios").sort((a, b) => a.name.localeCompare(b.name));
    const sel = selectedPortfolios();
    return `<div class="home-layout"><aside class="home-nav" aria-label="Home menu">
        <div class="hn-block"><div class="hn-title">Portfolios</div>
          ${all.length ? `<label class="toggle small"><input type="checkbox" data-act="home-pf-all"${sel.length === all.length ? " checked" : ""}> All portfolios</label>
            ${all.map((p) => `<label class="toggle"><input type="checkbox" data-act="home-pf" data-pf="${esc(p.id)}"${isSelected(p.id) ? " checked" : ""}> ${esc(p.name)}</label>`).join("")}`
            : '<p class="hint">No portfolios yet.</p>'}</div>
        <nav class="hn-block">${NAV.map(([r, l]) => `<a href="#${r}" class="${route === r ? "on" : ""}"${route === r ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
      </aside><section class="home-main">${content}</section></div>`;
  }
  function dateBar() {
    const h = H(), { asOf } = dates();
    const opt = (v, l, cur) => `<option value="${v}"${cur === v ? " selected" : ""}>${l}</option>`;
    return `<div class="datebar">
      <label>Period <select id="h-period">${opt("ytd", "Year to date", h.period)}${opt("qtd", "Quarter to date", h.period)}${opt("inception", "Since inception", h.period)}${opt("custom", "Custom start date", h.period)}</select></label>
      ${h.period === "custom" ? `<input type="date" id="h-from" value="${esc(h.from || "")}" aria-label="Start date">` : ""}
      <label>As of <select id="h-asof-mode">${opt("lbd", "Last business day", h.asOfMode)}${opt("custom", "Custom date", h.asOfMode)}</select></label>
      ${h.asOfMode === "custom" ? `<input type="date" id="h-asof" value="${esc(h.asOf || asOf)}" max="${History.etDate()}" aria-label="As of date">` : `<span class="muted small">${Charts.fmtDate(asOf)}</span>`}
    </div>`;
  }

  // ---- data loading (cached per view + selection + dates) ----
  function key(route) { const d = dates(), h = H(); return [route, selectedPortfolios().map((p) => p.id).join(","), d.kind, d.from, d.asOf, h.targetModel || "", h.perfSleeve || ""].join("|"); }
  async function load(route) {
    const k = key(route), h = H();
    if (h.data[k]) return;
    h.data[k] = { loading: true };
    try {
      const pfs = selectedPortfolios(), accts = accountsOf(pfs);
      if (!pfs.length) throw new Error("Select at least one portfolio on the left.");
      if (!accts.length) throw new Error("The selected portfolios have no accounts yet.");
      let { asOf } = dates();
      const { kind, from } = dates();
      const first = await History.series(accts, "0000-01-01", "0000-01-01");
      if (!first) throw new Error(RH.mode === "live" ? "No history recorded yet. The app records each account every time it opens with Robinhood connected; reports fill in from today."
        : "No history yet.");
      // History only exists from the day the app first recorded these accounts.
      let note = "";
      if (asOf < first.inception) {
        if (h.asOfMode !== "custom") { asOf = first.inception; note = `History for these accounts starts ${Charts.fmtDate(first.inception)}, when the app first recorded them, so this shows that day.`; }
        else { h.data[k] = { error: `History for these accounts starts ${Charts.fmtDate(first.inception)}, when the app first recorded them. Pick an as-of date on or after that.`, fixDate: first.inception }; App.rerender(); return; }
      }
      const start = History.periodStart(kind, asOf, from, first.inception);
      if (start > asOf) throw new Error("The start date is after the as-of date.");
      const s = await History.series(accts, start, asOf);
      const out = { s, start, asOf, inception: first.inception, pfs, accts, note };
      if (route === "home-activity") {
        // The same figures for each account on its own (each starts from its own first activity).
        out.byAccount = await Promise.all(accts.map(async (a) => {
          const sa = await History.series([a], start, asOf);
          return { account: a, activity: sa && sa.points.length ? History.activity(sa) : null };
        }));
      }
      if (route === "home-performance") {
        const pf = pfs[0], model = reportingModel(pf, asOf);
        const windows = (pf.benchmarks || []).map((b) => { const m = Store.get("models", b.model_id); return m && m.benchmark ? { start: b.start, end: b.end, name: m.benchmark.name, components: m.benchmark.components } : null; }).filter(Boolean);
        out.model = model;
        out.sleeves = (model && model.sleeves) || [];
        const sl = out.sleeves.find((x) => x.id === h.perfSleeve);
        if (sl) {
          const syms = new Set(sl.securities.map((x) => x.symbol));
          const val = (p) => Object.values(p.holdings).reduce((t, hs) => t + Object.entries(hs).reduce((u, [sym, v]) => u + (syms.has(sym) ? v.value : 0), 0), 0);
          const flow = (p) => [...syms].reduce((t, sym) => t + (p.buys[sym] || 0) - (p.sells[sym] || 0), 0);
          out.port = History.twr(s.points, s.prior, val, flow);
          out.bench = sl.benchmark && sl.benchmark.components && sl.benchmark.components.length ? await History.benchmark([{ components: sl.benchmark.components }], s.points[0].date, asOf) : null;
          out.benchName = sl.benchmark && sl.benchmark.components && sl.benchmark.components.length ? sl.benchmark.name || sl.benchmark.components.map((c) => c.name).join(" / ") : "";
        } else {
          out.port = History.twr(s.points, s.prior);
          out.bench = s.points.length ? await History.benchmark(windows, s.points[0].date, asOf) : null;
          out.benchName = windows.map((w) => w.name).filter((v, i, a) => a.indexOf(v) === i).join(" then ");
          // Each account on its own, against its own benchmark (Accounts > Reporting) or else the portfolio's.
          const winsOf = (list) => (list || []).map((b) => { const m = Store.get("models", b.model_id); return m && m.benchmark ? { start: b.start, end: b.end, name: m.benchmark.name, components: m.benchmark.components } : null; }).filter(Boolean);
          out.byAccount = await Promise.all(accts.map(async (a) => {
            const sa = await History.series([a], start, asOf);
            if (!sa || !sa.points.length) return { account: a, none: true };
            const own = winsOf(U.acctDoc(a).benchmarks), w = own.length ? own : windows;
            const port = History.twr(sa.points, sa.prior), bench = await History.benchmark(w, sa.points[0].date, asOf);
            return { account: a, ret: port.length ? port[port.length - 1][1] : 0, bench: bench && bench.length ? bench[bench.length - 1][1] : null,
              benchName: w.map((x) => x.name).filter((v, i, arr) => arr.indexOf(v) === i).join(" then "), own: own.length > 0, from: sa.points[0].date };
          }));
        }
      }
      h.data[k] = out;
    } catch (e) { h.data[k] = { error: e.message }; }
    App.rerender();
  }
  function current(route) {
    const d = H().data[key(route)];
    if (!d) { load(route); return { loading: true }; }
    return d;
  }
  const state = (d) => d.loading ? '<div class="progress"><span class="spinner" aria-hidden="true"></span><span>Loading history and prices...</span></div>'
    : d.error ? `<p class="errorbox">${esc(d.error)}${d.fixDate ? ` <button class="linkbtn" type="button" data-act="asof-set" data-date="${esc(d.fixDate)}">Show ${Charts.fmtDate(d.fixDate)}</button>` : ""}</p>` : "";

  // ---- holdings at the as-of date: [{account, symbol, cls, value}] including cash ----
  function holdings(d) {
    const p = d.s.points[d.s.points.length - 1] || d.s.prior, names = Object.fromEntries((App.state.rhAccounts || []).map((a) => [a.id, a.name]));
    const items = [];
    for (const a of d.accts) {
      for (const [sym, h] of Object.entries((p.holdings || {})[a] || {})) items.push({ account: a, acctName: names[a] || U.maskText(a), symbol: sym, cls: U.classOf(sym), value: h.value });
      if ((p.cash || {})[a] != null) items.push({ account: a, acctName: names[a] || U.maskText(a), symbol: "Cash", cls: "Cash", value: p.cash[a] });
    }
    return items.filter((x) => Math.abs(x.value) > 0.005);
  }

  // ---- Activity summary ----
  function activity() {
    const d = current("home-activity");
    if (d.loading || d.error) return state(d);
    if (!d.s.points.length) return '<p class="hint">No history in this period.</p>';
    const a = History.activity(d.s);
    let invested = a.begin;
    const valueS = d.s.points.map((p) => [p.date, p.value]);
    const netS = d.s.points.map((p) => [p.date, (invested += p.flow)]);
    const row = (l, v, cls = "") => `<tr class="${cls}"><th>${l}</th><td class="n">${money(v)}</td></tr>`;
    return `<div class="act-grid"><div><table class="act-table"><tbody>
        ${row(`Beginning value <span class="muted small">${d.start <= d.inception ? "before " + Charts.fmtDate(d.inception) + " (first activity)" : Charts.fmtDate(d.s.prior ? d.s.prior.date : d.start)}</span>`, a.begin, "strong")}
        ${row("Net additions", a.adds)}${row("Withdrawals", a.wds)}${row("Realized gain", a.realized)}${row("Unrealized gain (change)", a.unreal)}
        ${row("Income <span class=\"muted small\">dividends, interest</span>", a.income)}${row("Fees", a.fees)}
        ${row("Other activity", a.other)}
        ${row(`Ending value <span class="muted small">${Charts.fmtDate(d.asOf)}</span>`, a.end, "strong total")}</tbody></table></div>
      <div class="card chart-card"><header><h2>Value and cash flow</h2></header><div class="body">
        ${Charts.line({ label: "Account value and net cash invested", fmt: compact, series: [
          { name: "Account value", color: Charts.SLOTS[0], points: valueS, area: true },
          { name: "Net invested (cash flow)", color: Charts.SLOTS[1], points: netS, dash: true }] })}</div></div></div>
      ${byAccountTable(d, a)}
      <p class="small muted">History is rebuilt from your Robinhood order history, deposits and withdrawals you enter (Me &gt; Accounts, click an account number),
        and a daily snapshot. Robinhood doesn't report transfers, so any you haven't entered are inferred: deposits on the day of the purchase they paid for,
        withdrawals on the earliest day the account held that much cash. Holdings already in an account when tracking began count as additions.
        Realized gain uses average cost. Income and fees come from the dividends, interest and fees entered with each account's cash activity
        (reinvested dividends are also picked up from reinvestment buys). Other activity is whatever is left, such as items not entered or rounding.
        See <a href="#home-transactions">Transactions</a> for every item.</p>`;
  }

  function byAccountTable(d, total) {
    if (!d.byAccount) return "";
    const names = Object.fromEntries((App.state.rhAccounts || []).map((x) => [x.id, x]));
    const cols = [["begin", "Beginning value"], ["adds", "Net additions"], ["wds", "Withdrawals"], ["realized", "Realized gain"],
      ["unreal", "Unrealized gain (change)"], ["income", "Income"], ["fees", "Fees"], ["other", "Other activity"], ["end", "Ending value"]];
    const rows = d.byAccount.map(({ account, activity: a }) => {
      const info = names[account];
      return `<tr><th><span class="acct-name">${esc(info ? info.name : "Account")}</span> <span class="muted small">${U.mask(account)}${info ? " &middot; " + esc(info.type_label) : ""}</span></th>
        ${a ? cols.map(([k]) => `<td class="n${k === "end" ? " strong" : ""}">${money(a[k])}</td>`).join("") : `<td colspan="${cols.length}" class="muted">No history in this period.</td>`}</tr>`;
    }).join("");
    return `<section class="card"><header><h2>By account</h2></header><div class="body"><div class="scroll"><table class="by-acct">
      <thead><tr><th>Account</th>${cols.map(([, l]) => `<th class="n">${l}</th>`).join("")}</tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><th>Portfolio total</th>${cols.map(([k]) => `<td class="n">${money(total[k])}</td>`).join("")}</tr></tfoot></table></div>
      <p class="small muted">Each account's figures cover the same period; they add up to the portfolio totals above.</p></div></section>`;
  }

  // ---- Allocations (drill-down) ----
  const LEVELS = { acct_class: ["account", "cls", "symbol"], acct_asset: ["account", "symbol"], class: ["cls", "symbol"], asset: ["symbol"] };
  const LEVEL_NAME = { account: "Account", cls: "Asset class", symbol: "Security" };
  // Donut of the top level, then a list where each row opens in place to show what's inside it.
  function allocations() {
    const d = current("home-allocations");
    if (d.loading || d.error) return state(d);
    const h = H(), levels = LEVELS[h.allocMode], open = h.allocOpen;
    const items = holdings(d), total = items.reduce((s, x) => s + x.value, 0);
    const labelOf = (lv, x) => (lv === "account" ? `${x.acctName} ${U.maskText(x.account)}` : lv === "symbol" ? U.symLabel(x.symbol) : x[lv]);
    const group = (list, lv) => {
      const m = new Map();
      for (const x of list) { const g = m.get(x[lv]) || { key: x[lv], label: labelOf(lv, x), value: 0, items: [] }; g.value += x.value; g.items.push(x); m.set(x[lv], g); }
      return [...m.values()].sort((a, b) => b.value - a.value);
    };
    const top = group(items, levels[0]);
    const colors = levels[0] === "cls" ? Charts.CLASS_COLOR : Charts.colorMap(top.map((g) => g.key).sort());
    for (const g of top) g.color = colors[g.key] || Charts.OTHER;
    const rowsFor = (groups, depth, path) => groups.map((g) => {
      const id = [...path, g.key].join("|"), canOpen = depth < levels.length - 1;
      if (canOpen && h.allocAll) open.add(id);
      const isOpen = canOpen && open.has(id);
      const name = canOpen ? `<button class="tree-btn" type="button" data-act="alloc-toggle" data-key="${esc(id)}" aria-expanded="${isOpen}"><span class="caret-ic" aria-hidden="true">${isOpen ? "&#9662;" : "&#9656;"}</span>${esc(g.label)}</button>` : esc(g.label);
      const row = `<tr class="tree-row depth-${depth}${isOpen ? " open" : ""}"><td style="padding-left:${10 + depth * 22}px">${depth === 0 ? `<span class="legend-sq" style="background:${g.color}"></span>` : ""}${name}</td>
        <td class="n">${money(g.value)}</td><td class="n">${pct(total ? g.value / total : 0, 2)}</td></tr>`;
      return row + (isOpen ? rowsFor(group(g.items, levels[depth + 1]), depth + 1, [...path, g.key]) : "");
    }).join("");
    const opt = (v, l) => `<option value="${v}"${h.allocMode === v ? " selected" : ""}>${l}</option>`;
    const canOpen = levels.length > 1;
    return `<div class="controls between"><label>View <select id="h-alloc-mode">${opt("acct_class", "Account & class")}${opt("acct_asset", "Account & asset")}${opt("class", "Class")}${opt("asset", "Asset")}</select></label>
        ${canOpen ? `<span><button class="linkbtn" type="button" data-act="alloc-expand" data-all="1">Expand all</button> &middot; <button class="linkbtn" type="button" data-act="alloc-expand">Collapse all</button></span>` : ""}</div>
      <div class="alloc-stack"><figure class="donut-fig">${Views.donut(top.map((g) => ({ label: g.label, value: g.value, color: g.color })), 240, `Allocation by ${LEVEL_NAME[levels[0]]}`)}</figure>
        <div class="scroll"><table class="tree-table"><thead><tr><th>${levels.map((l) => LEVEL_NAME[l]).join(" / ")}</th><th class="n">Market value</th><th class="n">% of total</th></tr></thead>
          <tbody>${rowsFor(top, 0, [])}</tbody><tfoot><tr><th>Total</th><td class="n">${money(total)}</td><td class="n">${pct(total ? 1 : 0, 2)}</td></tr></tfoot></table></div></div>
      <p class="small muted">As of ${Charts.fmtDate(d.asOf)} closing prices. ${canOpen ? `Click ${LEVEL_NAME[levels[0]].toLowerCase() === "account" ? "an account" : "a class"} to show what's inside it.` : ""}</p>`;
  }

  // ---- Allocation vs Target ----
  // A triangle shows which way an allocation is off target (over or under), even inside the band; none when exactly on target.
  const tri = (d) => (d > 0 ? '<span class="tri" aria-label="over target">&#9650;</span>' : d < 0 ? '<span class="tri" aria-label="under target">&#9660;</span>' : "");
  function target() {
    const d = current("home-target");
    if (d.loading || d.error) return state(d);
    const h = H(), pf = d.pfs[0], models = Store.all("models").sort((a, b) => a.name.localeCompare(b.name));
    const model = Store.get("models", h.targetModel) || reportingModel(pf, d.asOf);
    // Targets are the model's weights exactly as uploaded (no portfolio cash target added on top).
    const items = holdings(d), total = items.reduce((s, x) => s + x.value, 0);
    const cur = {}, tgt = {};
    for (const x of items) cur[x.cls] = (cur[x.cls] || 0) + x.value;
    const flat = U.flatModel(model);
    for (const [sym, w] of Object.entries(flat)) tgt[U.classOf(sym)] = (tgt[U.classOf(sym)] || 0) + w;
    const classes = [...new Set([...Object.keys(cur), ...Object.keys(tgt)])].sort((a, b) => (tgt[b] || 0) - (tgt[a] || 0) || a.localeCompare(b));
    const color = (c) => Charts.CLASS_COLOR[c] || Charts.OTHER;
    // Outside the band (above +5% or below -5% by default) is red; inside it, edges included, is light green.
    const band = U.rset().class_band;
    const rows = classes.map((c) => { const cp = total ? (cur[c] || 0) / total : 0, tp = tgt[c] || 0, diff = Math.round((cp - tp) * 10000) / 10000;
      return `<tr><td><span class="legend-sq" style="background:${color(c)}"></span>${esc(c)}</td><td class="n">${pct(cp, 2)}</td><td class="n">${pct(tp, 2)}</td>
        <td class="n ${Math.abs(diff) > band + 1e-9 ? "bad-cell" : "ok-cell"}">${tri(diff)}${pct(diff, 2)}</td></tr>`; }).join("");
    const drift = h.showDrift && model ? driftPanel(items, total, model, pf) : "";
    return `<div class="controls between"><label>Target model <select id="h-target-model">${models.map((m) => `<option value="${esc(m.id)}"${model && m.id === model.id ? " selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>
        <button class="btn${h.showDrift ? " primary" : ""}" type="button" data-act="toggle-drift" aria-pressed="${!!h.showDrift}">Portfolio drift</button></div>
      ${model ? "" : '<p class="hint">Create a model to compare against.</p>'}
      <div class="two"><figure class="donut-fig"><figcaption class="cap-top">Current</figcaption>${Views.donut(classes.map((c) => ({ label: c, value: cur[c] || 0, color: color(c) })), 200, "Current asset class allocation", false)}</figure>
        <figure class="donut-fig"><figcaption class="cap-top">Target: ${esc(model ? model.name : "none")}</figcaption>${Views.donut(classes.map((c) => ({ label: c, value: tgt[c] || 0, color: color(c) })), 200, "Target asset class allocation", false)}</figure></div>
      <div class="scroll"><table><thead><tr><th>Asset class</th><th class="n">Current %</th><th class="n">Target %</th><th class="n">Difference</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="small muted">Target % is the model's weights as uploaded. Set-aside cash is kept on top of the model's cash, so Cash sits above its target by the set-aside. Differences beyond &plusmn;${pct(band, 1)} (the asset class tolerance in Settings &gt; Rebalance) are red; within it, green. Picking another model shows how far the portfolio is from it.</p>
      ${drift}`;
  }
  function driftPanel(items, total, model, pf) {
    const band = U.rset().position_band, flat = U.flatModel(model), cur = {};
    // Cash is compared only when the model has a cash line.
    for (const x of items) if (x.symbol !== "Cash") cur[x.symbol] = (cur[x.symbol] || 0) + x.value; else if (U.CASH in flat) cur[U.CASH] = (cur[U.CASH] || 0) + x.value;
    const syms = [...new Set([...Object.keys(flat), ...Object.keys(cur)])];
    const rows = syms.map((s) => { const cp = total ? (cur[s] || 0) / total : 0, tp = flat[s] || 0, dr = cp - tp; return { s, cp, tp, dr, out: Math.abs(dr) > band + 1e-9 }; })
      .sort((a, b) => Math.abs(b.dr) - Math.abs(a.dr));
    const max = rows.reduce((m, r) => Math.max(m, Math.abs(r.dr)), 0), outN = rows.filter((r) => r.out).length;
    return `<section class="card drift-card"><header><h2>Portfolio drift vs ${esc(model.name)}</h2></header><div class="body">
      <div class="kpis small-kpis"><div><span>Largest drift</span><b>${pct(max, 2)}</b></div><div><span>Positions out of band (&plusmn;${pct(band, 1)})</span><b>${outN} of ${rows.length}</b></div></div>
      <div class="scroll"><table><thead><tr><th>Security</th><th class="n">Current %</th><th class="n">Target %</th><th class="n">Drift</th><th>Status</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td class="sym">${esc(U.symLabel(r.s))}</td><td class="n">${pct(r.cp, 2)}</td><td class="n">${pct(r.tp, 2)}</td><td class="n ${r.out ? "bad-cell" : "ok-cell"}">${tri(Math.round(r.dr * 10000) / 10000)}${pct(r.dr, 2)}</td>
          <td>${r.out ? '<span class="pill oob">Out of band</span>' : '<span class="pill ok">In band</span>'}</td></tr>`).join("")}</tbody></table></div></div></section>`;
  }

  // ---- Performance ----
  function performance() {
    const d = current("home-performance");
    if (d.loading || d.error) return state(d);
    const h = H(), pf = d.pfs[0];
    const tabs = [["", "Total portfolio"], ...d.sleeves.map((s) => [s.id, s.name])];
    const port = d.port, bench = d.bench;
    const pr = port.length ? port[port.length - 1][1] : 0, br = bench && bench.length ? bench[bench.length - 1][1] : null;
    const series = [{ name: h.perfSleeve ? (d.sleeves.find((s) => s.id === h.perfSleeve) || {}).name || "Sleeve" : "Portfolio", color: Charts.SLOTS[0], points: port }];
    if (bench) series.push({ name: d.benchName || "Benchmark", color: Charts.SLOTS[1], points: bench });
    const noBench = !bench ? (h.perfSleeve ? "This sleeve has no benchmark yet. Set one on the model's page."
      : `No benchmark yet. Add a model benchmark to ${esc(pf.name)} under Portfolios > Reporting.`) : "";
    return `<div class="seg tabs-seg" role="tablist" aria-label="Portfolio or sleeve">${tabs.map(([id, l]) => `<button type="button" role="tab" data-act="perf-sleeve" data-id="${esc(id)}" aria-selected="${(h.perfSleeve || "") === id}">${esc(l)}</button>`).join("")}</div>
      <div class="kpis small-kpis"><div><span>${esc(series[0].name)} (time-weighted)</span><b>${pctTxt(pr)}</b></div>
        <div><span>${esc(d.benchName || "Benchmark")}</span><b>${br == null ? "&ndash;" : pctTxt(br)}</b></div>
        <div><span>Difference</span><b>${br == null ? "&ndash;" : pctTxt(pr - br)}</b></div></div>
      ${noBench ? `<p class="hint">${noBench}</p>` : ""}
      <div class="card chart-card"><header><h2>Cumulative return, ${Charts.fmtDate(d.s.points[0] ? d.s.points[0].date : d.start)} to ${Charts.fmtDate(d.asOf)}</h2></header><div class="body">
        ${Charts.line({ label: "Time-weighted return vs benchmark", fmt: (v) => pctTxt(v, 1), zeroLine: true, series })}</div></div>
      ${!h.perfSleeve && d.byAccount ? perfByAccount(d) : ""}
      <p class="small muted">Time-weighted return removes the effect of deposits and withdrawals. ${d.model ? `Sleeves come from ${esc(d.model.name)}${(pf.reporting_targets || []).length ? " (the reporting target)" : ""}. ` : ""}
        Benchmarks use index-tracking ETFs from Robinhood's price history (for example VT for MSCI ACWI IMI and BNDW for Bloomberg Global Aggregate); they are price returns,
        so dividends are not included and benchmark returns read slightly low.</p>`;
  }

  function perfByAccount(d) {
    const names = Object.fromEntries((App.state.rhAccounts || []).map((x) => [x.id, x]));
    const rows = d.byAccount.map((r) => { const info = names[r.account];
      const label = `<span class="acct-name">${esc(info ? info.name : "Account")}</span> <span class="muted small">${U.mask(r.account)}</span>`;
      if (r.none) return `<tr><th>${label}</th><td colspan="5" class="muted">No history in this period.</td></tr>`;
      return `<tr><th>${label}</th><td class="n">${pctTxt(r.ret)}</td><td>${esc(r.benchName || "None")}${r.benchName ? ` <span class="muted small">${r.own ? "account's" : "portfolio's"}</span>` : ""}</td>
        <td class="n">${r.bench == null ? "&ndash;" : pctTxt(r.bench)}</td><td class="n">${r.bench == null ? "&ndash;" : pctTxt(r.ret - r.bench)}</td><td class="nowrap">${Charts.fmtDate(r.from)}</td></tr>`; }).join("");
    return `<section class="card"><header><h2>By account</h2></header><div class="body"><div class="scroll"><table class="by-acct">
      <thead><tr><th>Account</th><th class="n">Return (time-weighted)</th><th>Benchmark</th><th class="n">Benchmark return</th><th class="n">Difference</th><th>From</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p class="small muted">Each account is measured on its own from its first day in the period. An account uses its own benchmark (Me &gt; Accounts &gt; Reporting) when it has one, otherwise the portfolio's.</p></div></section>`;
  }

  // ---- Transactions ----
  function transactions() {
    const d = current("home-transactions");
    if (d.loading || d.error) return state(d);
    const h = H(), info = Object.fromEntries((App.state.rhAccounts || []).map((x) => [x.id, x]));
    const acctType = (a) => (info[a] ? info[a].type_label : "Account");
    const all = d.s.points.flatMap((p) => p.tx || []);
    const types = Object.keys(History.TX_TYPES), acctTypes = [...new Set(d.accts.map(acctType))].sort();
    const typeOn = (t) => !h.txTypes || h.txTypes.has(t);
    // Newest first to start; click a column heading to sort by it (same-day items keep their order).
    const acctName = (a) => (info[a] ? info[a].name : "Account");
    const TX_COLS = [["date", "Date", "", (t) => t.date], ["account", "Account", "", (t) => acctName(t.account) + t.account], ["type", "Type", "", (t) => History.TX_TYPES[t.type] || t.type],
      ["symbol", "Symbol", "", (t) => t.symbol || ""], ["qty", "Quantity", "n", (t) => (t.qty == null ? -Infinity : +t.qty)], ["price", "Price", "n", (t) => +t.price || 0],
      ["amount", "Amount", "n", (t) => +t.amount || 0], ["details", "Details", "", (t) => t.note || ""]];
    const rows = Views.sortRows("tx", TX_COLS, all.filter((t) => typeOn(t.type) && (!h.txAcctType || acctType(t.account) === h.txAcctType))
      .map((t, i) => ({ ...t, i })).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.i - b.i)), { key: "date", dir: -1 });
    const counts = {};
    for (const t of all) if (!h.txAcctType || acctType(t.account) === h.txAcctType) counts[t.type] = (counts[t.type] || 0) + 1;
    const totals = {};
    for (const t of rows) totals[t.type] = (totals[t.type] || 0) + t.amount;
    const qty = (v) => (v == null ? "" : Math.abs(v) >= 1 ? (+v).toLocaleString("en-US", { maximumFractionDigits: 4 }) : (+v).toFixed(6).replace(/0+$/, ""));
    const chip = (t) => `<label class="toggle chip"><input type="checkbox" data-act="tx-type" data-type="${t}"${typeOn(t) ? " checked" : ""}> ${History.TX_TYPES[t]} <span class="muted small">${counts[t] || 0}</span></label>`;
    return `<div class="tx-filters"><div class="tx-types" role="group" aria-label="Transaction types">
          <label class="toggle chip"><input type="checkbox" data-act="tx-type-all"${!h.txTypes ? " checked" : ""}> All types</label>${types.map(chip).join("")}</div>
        <label>Account type <select id="h-tx-accttype"><option value="">All account types</option>${acctTypes.map((t) => `<option${h.txAcctType === t ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label></div>
      <div class="kpis small-kpis">${types.filter((t) => totals[t] != null).map((t) => `<div><span>${History.TX_TYPES[t]}</span><b>${money(totals[t])}</b></div>`).join("") || "<div><span>Total</span><b>&ndash;</b></div>"}</div>
      ${rows.length ? `<div class="scroll"><table class="tx-table"><thead><tr>${Views.sortHead("tx", TX_COLS, { key: "date", dir: -1 })}</tr></thead><tbody>
        ${rows.map((t) => `<tr><td class="nowrap">${Charts.fmtDate(t.date)}</td><td><span class="acct-name">${esc(info[t.account] ? info[t.account].name : "Account")}</span> <span class="muted small">${U.mask(t.account)} &middot; ${esc(acctType(t.account))}</span></td>
          <td><span class="tx-type tx-${t.type}">${History.TX_TYPES[t.type] || esc(t.type)}</span></td><td class="sym">${esc(t.symbol || "")}</td>
          <td class="n">${qty(t.qty)}</td><td class="n">${t.price ? money(t.price) : ""}</td><td class="n">${money(t.amount)}</td>
          <td>${t.inferred ? '<span class="pill est">Estimated</span> ' : ""}<span class="small">${esc(t.note || "")}</span></td></tr>`).join("")}</tbody></table></div>`
        : '<p class="hint">No transactions match these filters in this period.</p>'}
      <p class="small muted">${rows.length} of ${all.length} transactions, ${Charts.fmtDate(d.s.points[0] ? d.s.points[0].date : d.start)} to ${Charts.fmtDate(d.asOf)}. Click a column heading to sort.
        Amounts are the cash effect: buys and fees are negative; shares moved in or out show their market value. Buys and sells come from Robinhood's order history;
        deposits, withdrawals, dividends, interest and fees come from each account's cash activity (Me &gt; Accounts). Items marked Estimated were inferred, not entered.</p>`;
  }

  function render(route) {
    let body;
    // A drawing error must show as a message, never leave the page stuck on "Loading".
    try {
      body = route === "home-activity" ? activity() : route === "home-allocations" ? allocations() : route === "home-target" ? target() : route === "home-transactions" ? transactions() : performance();
      const d = H().data[key(route)];
      if (d && d.note) body = `<p class="pending">${esc(d.note)}</p>` + body;
    } catch (e) {
      console.error(e);
      body = `<p class="errorbox">This report couldn't be drawn: ${esc(e.message)}. Try another date, or press Refresh.</p>`;
    }
    const title = (NAV.find((n) => n[0] === route) || [])[1];
    return shell(route, `<div class="page-head"><h1>${esc(title)}</h1><button class="btn small" type="button" data-act="report-refresh">Refresh</button>
      <span class="muted small">${selectedPortfolios().map((p) => esc(p.name)).join(", ") || "No portfolio selected"}</span></div>${dateBar()}<div class="report-body">${body}</div>`);
  }

  root.Reports = { render, shell, NAV, selectedPortfolios };
})(window);
