// Rebalance result detail: summary, cash values, editable orders, allocations, chart, messages.
// "Submit order" records approval only; orders are entered in Robinhood by the user.
(function (root) {
  "use strict";
  const { esc, money, plainMoney, pct, qty, mask } = U;
  const EPS = 1e-9;
  const mark = (s) => s === "ok" ? '<span class="mark-ok" title="In range">&#10003;</span>' : s === "over" ? '<span class="mark-bad" title="Above range">&#9650;</span>'
    : s === "under" ? '<span class="mark-bad" title="Below range">&#9660;</span>' : '<span class="muted">n/a</span>';
  const key = (a, s) => a + "|" + s;

  function mount(container, resultId) {
    // `r` is re-read from the store on every render, so changes made elsewhere (orders submitted or canceled on the
    // blotter, another tab) are never overwritten by a stale copy.
    let r = Store.get("results", resultId);
    if (!r) { container.innerHTML = '<p class="hint">That result no longer exists. <a href="#results">See all results</a></p>'; return; }
    const D = r.view;
    const accounts = Object.fromEntries(D.accounts.map((a) => [a.id, a]));
    const original = {};
    for (const o of D.orders) original[key(o.account, o.symbol)] = { side: o.side, shares: o.shares, st: o.st_gain, lt: o.lt_gain, lots: o.lots || null };
    const ui = App.state.resultUI[resultId] = App.state.resultUI[resultId] || { showEmpty: true, allocBy: "position", display: "dollar", chartBy: "class",
      sort: { col: "var1", dir: 1 }, openClasses: new Set(), closed: new Set(), drawer: null };
    ui.openLots = ui.openLots || new Set(); ui.fillSort = ui.fillSort || { col: null, dir: 1 };
    const pf = () => Store.get("portfolios", D.run.portfolio_id) || { notes: [], restrictions: [], name: D.run.portfolio, account_numbers: [] };
    const locked = () => r.status !== "proposed";
    const cloneOriginal = () => Object.fromEntries(Object.entries(original).map(([k, o]) => [k, { side: o.side, shares: o.shares }]));
    // Order edits are a draft until Save (kept for this visit if you leave the page without saving).
    const savedOrders = () => (r.edits ? JSON.parse(JSON.stringify(r.edits)) : cloneOriginal());
    let orders = ui.draft || savedOrders();
    const saveEdits = () => { ui.draft = orders; };
    const dirty = () => !!ui.draft && JSON.stringify(ui.draft) !== JSON.stringify(savedOrders());
    function saveNow() { r.edits = orders; ui.draft = null; Store.put("results", r.id, r); U.toast("Changes saved"); render(); }
    function discard() { ui.draft = null; orders = savedOrders(); render(); }
    // Leaving with unsaved edits asks first: save, discard, or stay.
    function leave(hash) {
      if (!dirty()) { location.hash = hash; return; }
      U.modal({ title: "Save your changes?", body: "<p>You've edited orders on this result and haven't saved them.</p>",
        actions: [{ label: "Stay here" }, { label: "Discard changes", danger: true, onClick: () => { discard(); location.hash = hash; } },
          { label: "Save", primary: true, onClick: () => { saveNow(); location.hash = hash; } }] });
    }
    // In a multiple rebalance: this result's place among its portfolios.
    const batch = r.batch_id ? Store.get("batches", r.batch_id) : null;
    const siblings = batch ? (batch.result_ids || []).filter((id) => Store.get("results", id)) : [];
    const pos = siblings.indexOf(r.id);

    function isEdited(k) {
      const o = orders[k] || { side: "none", shares: 0 }, og = original[k] || { side: "none", shares: 0 };
      const q = o.side === "none" ? 0 : +o.shares || 0, oq = og.side === "none" ? 0 : og.shares;
      return (q > EPS || oq > EPS) && (o.side !== og.side || Math.abs(q - oq) > 1e-7);
    }
    const roundShares = (q) => (!(q > 0) ? 0 : D.fractional ? Math.floor(q * 1e6 + 1e-6) / 1e6 : Math.floor(q + 1e-9));

    function allRows() {
      const rows = D.positions.map((p) => ({ ...p, key: key(p.account, p.symbol) }));
      const have = new Set(rows.map((x) => x.key));
      for (const k of new Set([...Object.keys(orders), ...Object.keys(original)])) {
        if (have.has(k)) continue;
        const [account, symbol] = k.split("|");
        rows.push({ account, symbol, group: D.group_of[symbol] || symbol, price: D.prices[symbol] || 0, shares: 0, cost: 0, avg_cost: 0, key: k });
      }
      return rows.sort((a, b) => (accounts[a.account].name + a.symbol).localeCompare(accounts[b.account].name + b.symbol));
    }
    function compute(useOriginal = false) {
      const book = useOriginal ? cloneOriginal() : orders;
      const rows = allRows().map((x) => {
        const o = book[x.key] || { side: "none", shares: 0 };
        const q = o.side === "none" ? 0 : Math.max(0, +o.shares || 0);
        const signed = o.side === "buy" ? q : o.side === "sell" ? -q : 0;
        let st = 0, lt = 0, est = false;
        if (o.side === "sell" && q > 0 && accounts[x.account].taxable) {
          const og = original[x.key];
          if (og && og.side === "sell" && og.shares > 0 && Math.abs(og.shares - q) < 1e-7) { st = og.st; lt = og.lt; }
          else if (og && og.side === "sell" && og.shares > 0 && q < og.shares) { st = (og.st * q) / og.shares; lt = (og.lt * q) / og.shares; est = true; }
          else { st = q * (x.price - x.avg_cost); est = true; }
        }
        return { ...x, o, q, signed, amt: q * x.price, adj: x.shares + signed, st, lt, est, over: o.side === "sell" && q > x.shares + 1e-7, edited: !useOriginal && isEdited(x.key) };
      });
      const cash = D.accounts.map((a) => {
        const flow = rows.filter((x) => x.account === a.id).reduce((s, x) => s - x.signed * x.price, 0), after = a.cash + flow;
        const { lo, hi } = U.cashRange(a.cash_target, a.cash_band, a.set_aside);
        const st = (v) => U.cashState(v, a.cash_target, a.cash_band, a.set_aside);
        return { ...a, flow, after, lo, hi, before_state: st(a.cash), after_state: st(after) };
      });
      const groups = D.groups.map((g) => {
        const mine = rows.filter((x) => x.group === g.group);
        const cur = mine.reduce((s, x) => s + x.shares * x.price, 0), aft = mine.reduce((s, x) => s + x.adj * x.price, 0);
        const st = (v) => { if (!g.modeled) return "na"; const d = (v - g.target_value) / D.base; return d > g.band + EPS ? "over" : d < -g.band - EPS ? "under" : "ok"; };
        return { ...g, cur, aft, adjust: aft - cur, cur_state: st(cur), aft_state: st(aft) };
      });
      const total = D.total_value, names = [...new Set(D.groups.map((g) => g.cls))];
      const classes = names.map((name) => { const gs = groups.filter((g) => g.cls === name);
        return { name, groups: gs, target: gs.reduce((s, g) => s + g.target_value, 0), cur: gs.reduce((s, g) => s + g.cur, 0), aft: gs.reduce((s, g) => s + g.aft, 0) }; });
      const tsum = classes.reduce((s, c) => s + c.target, 0);
      // Cash target is the model's cash only; set-aside counts toward actual cash, so a large set-aside shows as above target.
      classes.push({ name: "Cash", groups: [], target: D.accounts.reduce((s, a) => s + (a.cash_target || 0), 0), cur: D.accounts.reduce((s, a) => s + a.cash, 0), aft: cash.reduce((s, a) => s + a.after, 0), isCash: true });
      for (const c of classes) { const st = (v) => { const d = (v - c.target) / total; return d > D.class_band + EPS ? "over" : d < -D.class_band - EPS ? "under" : "ok"; };
        c.cur_state = st(c.cur); c.aft_state = st(c.aft); c.adjust = c.aft - c.cur; }
      const active = rows.filter((x) => x.q > EPS && x.o.side !== "none");
      const sum = (side, f) => active.filter((x) => x.o.side === side).reduce((s, x) => s + f(x), 0);
      return { rows, cash, groups, classes, problems: rows.filter((x) => x.over),
        totals: { trades: active.length, buys: active.filter((x) => x.o.side === "buy").length, sells: active.filter((x) => x.o.side === "sell").length,
          buyValue: sum("buy", (x) => x.amt), sellValue: sum("sell", (x) => x.amt), st: sum("sell", (x) => x.st), lt: sum("sell", (x) => x.lt), est: active.some((x) => x.est) } };
    }
    const inRange = (items, f) => items.filter((x) => f(x) === "ok").length;
    const band = (ok, n, label, span) => `<th colspan="${span}" class="${ok === n ? "band-green" : "band-red"}">${label}<span class="count">${ok} of ${n}</span></th>`;
    const panel = (id, title, body, extra = "") => `<section class="card panel${ui.closed.has(id) ? " closed" : ""}" id="r-${id}"><header>
      <button class="caret" type="button" data-r="toggle" data-id="${id}" aria-expanded="${!ui.closed.has(id)}">${ui.closed.has(id) ? "&#9656;" : "&#9662;"}</button><h2>${title}</h2>${extra}</header>
      <div class="body">${body}</div></section>`;

    // ---- sections ----
    function summary(c, b) {
      const p = pf(), t0 = b.totals, t1 = c.totals;
      const row = (l, q0, v0, q1, v1) => `<tr><th>${l}</th><td class="n">${q0}</td><td class="n">${money(v0)}</td><td class="n">${q1}</td><td class="n">${money(v1)}</td></tr>`;
      const tax = (l, v0, v1) => `<tr><th>${l}</th><td class="n">${money(v0)}</td><td class="n">${money(v1)}</td></tr>`;
      const count = (n, section) => (n ? `<button class="linkbtn count" type="button" data-r="drawer" data-section="${section}">${n}</button>` : "0");
      return `<div class="summary-grid"><dl class="kv">
          <dt>Portfolio</dt><dd><button class="linkbtn big" type="button" data-r="drawer" data-section="accounts">${esc(p.name)}</button></dd>
          <dt>Market value</dt><dd>${money(D.total_value)}</dd>
          <dt>Current model</dt><dd><button class="linkbtn big" type="button" data-r="drawer-model">${esc(D.run.model || "None")}</button></dd>
          <dt>Completed</dt><dd>${esc(r.created_label)}</dd>
          <dt>Notes</dt><dd>${count((p.notes || []).length, "notes")}</dd>
          <dt>Restrictions</dt><dd>${count((p.restrictions || []).length, "restrictions")}</dd></dl>
        <div class="scroll"><table><thead><tr><th>Orders</th><th colspan="2">Before user edits</th><th colspan="2">After user edits</th></tr>
          <tr><th></th><th class="n">Qty</th><th class="n">Value</th><th class="n">Qty</th><th class="n">Value</th></tr></thead>
          <tbody>${row("Total trades", t0.trades, t0.buyValue + t0.sellValue, t1.trades, t1.buyValue + t1.sellValue)}${row("Buys", t0.buys, t0.buyValue, t1.buys, t1.buyValue)}${row("Sells", t0.sells, t0.sellValue, t1.sells, t1.sellValue)}</tbody></table></div>
        <div class="scroll"><table><thead><tr><th>Tax info (estimated)</th><th class="n">Before edits</th><th class="n">After edits</th></tr></thead>
          <tbody>${tax("Short-term", t0.st, t1.st)}${tax("Long-term", t0.lt, t1.lt)}${tax("Total gain/loss", t0.st + t0.lt, t1.st + t1.lt)}</tbody></table>
          ${t1.est ? '<p class="small muted">Gains on edited sells are estimated from average cost.</p>' : ""}</div></div>`;
    }
    function cashValues(c) {
      const n = c.cash.length, okB = inRange(c.cash, (a) => a.before_state), okA = inRange(c.cash, (a) => a.after_state), tot = (f) => c.cash.reduce((s, a) => s + f(a), 0);
      // Hovering an account number shows its cash target and the edges of its cash range, in dollars.
      const tip = (a) => { const v = a.value || 0, tp = v ? a.cash_target / v : 0, bp = v ? a.cash_band / v : 0;
        return [`Cash target ${pct(tp, 2)} of MV: ${plainMoney(a.cash_target)}`, `Upper limit ${pct(tp + bp, 2)} of MV: ${plainMoney(a.cash_target + a.cash_band)}`,
          `Lower limit ${pct(Math.max(0, tp - bp), 2)} of MV: ${plainMoney(Math.max(0, a.cash_target - a.cash_band))}`,
          a.set_aside > 0.005 ? `Plus ${plainMoney(a.set_aside)} set-aside, kept on top (Available leaves it out)` : ""].filter(Boolean).join("\n"); };
      const rows = c.cash.map((a) => `<tr><td><button class="linkbtn count" type="button" data-r="drawer" data-section="accounts" data-acct="${esc(a.id)}" data-tip="${esc(tip(a))}">${mask(a.id)}</button> <span class="muted">${esc(a.name)}</span></td>
        <td class="n">${money(a.value)}</td><td class="n">${money(a.cash)}</td><td class="n">${money(a.set_aside)}</td><td class="n">${money(a.cash - a.set_aside)}</td><td>${mark(a.before_state)}</td>
        <td class="n adj">${money(a.flow)}</td><td class="n">${money(a.after)}</td><td class="n">${money(a.set_aside)}</td><td class="n">${money(a.after - a.set_aside)}</td><td>${mark(a.after_state)}</td></tr>`).join("");
      return `<div class="scroll"><table><thead><tr class="band-row"><th colspan="2">Account</th>${band(okB, n, "Accounts with cash in range:", 4)}<th class="band-amber">Adjustments</th>${band(okA, n, "Accounts with cash in range:", 4)}</tr>
        <tr><th>Acct#</th><th class="n">Market value</th><th class="n">Total</th><th class="n">Unavailable</th><th class="n">Available</th><th></th><th class="n adj">Cash adjustments</th><th class="n">Total</th><th class="n">Unavailable</th><th class="n">Available</th><th></th></tr></thead>
        <tbody>${rows}</tbody><tfoot><tr><td>Portfolio total</td><td class="n">${money(tot((a) => a.value))}</td><td class="n">${money(tot((a) => a.cash))}</td><td class="n">${money(tot((a) => a.set_aside))}</td>
        <td class="n">${money(tot((a) => a.cash - a.set_aside))}</td><td></td><td class="n adj">${money(tot((a) => a.flow))}</td><td class="n">${money(tot((a) => a.after))}</td><td class="n">${money(tot((a) => a.set_aside))}</td><td class="n">${money(tot((a) => a.after - a.set_aside))}</td><td></td></tr></tfoot></table></div>
        <p class="small muted">Unavailable is set-aside cash; Available is cash less set-aside. Each account keeps its set-aside plus its cash target
          (${pct(D.cash_target_percent, 2)} of its market value); Available is in range within &plusmn;${pct(D.cash_max_excess_percent, 2)} of market value around that target.
          Hover an account number to see the target and range in dollars.</p>`;
    }
    // Holding period of a sell's realized gain: from the lots the rebalance chose, or, for an edited sell, the lots the
    // portfolio's lot rule would likely take. Lots without a buy date are assumed short-term.
    const asOfDay = () => D.run.as_of || new Date().toISOString().slice(0, 10);
    const lotTerm = (l) => (l.acquired && asOfDay() >= RebalEngine.longTermDate(l.acquired) ? "long" : "short");
    function sellTerm(x) {
      if (x.o.side !== "sell" || !(x.q > EPS) || !accounts[x.account].taxable) return null;
      const og = original[x.key];
      let terms;
      if (og && og.side === "sell" && og.lots && Math.abs(og.shares - x.q) < 1e-7) terms = og.lots.filter((l) => l.qty > EPS).map((l) => (l.term === "long" ? "long" : "short"));
      else {
        const method = U.rset().lot_method || "min_tax";
        const lots = (x.lots && x.lots.length ? x.lots : [{ qty: x.shares, cost: x.avg_cost, acquired: null }]).slice()
          .sort((a, b) => (method === "fifo" ? (a.acquired || "").localeCompare(b.acquired || "") : b.cost - a.cost));
        terms = []; let left = x.q;
        for (const l of lots) { if (left <= EPS) break; terms.push(lotTerm(l)); left -= l.qty; }
      }
      const set = new Set(terms);
      return set.size > 1 ? "Mixed" : set.has("long") ? "LT" : set.size ? "ST" : null;
    }
    const termTag = (t) => (t ? ` <span class="term term-${t.toLowerCase()}" title="${t === "LT" ? "Long-term: lots held over a year" : t === "ST" ? "Short-term: lots held a year or less (or with no buy date)" : "Both long- and short-term lots"}">${t}</span>` : "");
    // Sortable columns of the Orders table: [key, label, class, value(row)].
    const ORDER_COLS = [["acct", "Acct#", "", (x) => x.account], ["type", "Type", "", (x) => accounts[x.account].type], ["symbol", "Symbol", "", (x) => x.symbol],
      ["mv", "Mkt value", "n", (x) => x.shares * x.price], ["shares", "Shares", "n", (x) => x.shares], ["cost", "Cost $", "n", (x) => x.cost],
      ["gl", "Unrealized G/L", "n", (x) => x.shares * x.price - x.cost], ["glp", "G/L %", "n", (x) => (x.cost > 0 ? (x.shares * x.price - x.cost) / x.cost : -Infinity)],
      ["side", "Trans type", "adj", (x) => x.o.side], ["amt", "Amt", "adj n", (x) => x.amt], ["q", "Shares", "adj n", (x) => x.q],
      ["adjmv", "Mkt value", "n", (x) => x.adj * x.price], ["adj", "Shares", "n", (x) => x.adj], ["realized", "Realized gain", "n", (x) => (x.o.side === "sell" ? x.st + x.lt : 0)]];
    // Transaction type choices. SELL ALL sells the whole position, and shows whenever a sell equals the shares held.
    const sellsAll = (x) => x.o.side === "sell" && x.shares > EPS && Math.abs(x.q - x.shares) < 1e-6;
    function sideOptions(x) {
      const cur = sellsAll(x) ? "sell_all" : x.o.side;
      return [["none", "NONE"], ["buy", "BUY"], ["sell", "SELL"], ...(x.shares > EPS ? [["sell_all", "SELL ALL"]] : [])]
        .map(([v, l]) => `<option value="${v}"${cur === v ? " selected" : ""}>${l}</option>`).join("");
    }
    function ordersTable(c) {
      const code = { taxable: "T", traditional_ira: "IRA", roth_ira: "ROTH" }, dis = locked() ? " disabled" : "";
      let list = c.rows.filter((x) => ui.showEmpty || x.q > EPS || x.edited || x.o.side !== "none");
      if (ui.orderSort && ui.orderSort.col) {
        const get = (ORDER_COLS.find((k) => k[0] === ui.orderSort.col) || ORDER_COLS[0])[3], dir = ui.orderSort.dir;
        list = list.slice().sort((a, b) => { const p = get(a), q = get(b); return (typeof p === "string" ? p.localeCompare(q) : p - q) * dir; });
      }
      const head = ORDER_COLS.map(([k, l, cls]) => { const on = ui.orderSort && ui.orderSort.col === k;
        return `<th class="${cls}" aria-sort="${on ? (ui.orderSort.dir > 0 ? "ascending" : "descending") : "none"}"><button class="sort" type="button" data-r="order-sort" data-col="${k}">${l}${on ? (ui.orderSort.dir > 0 ? " &#9650;" : " &#9660;") : ""}</button></th>`; }).join("");
      const rows = list.map((x, i) => {
        const val = x.shares * x.price, gl = val - x.cost, open = ui.openLots.has(x.key);
        // Cells the user changed from the rebalance's own order get their own color.
        const og = original[x.key] || { side: "none", shares: 0 }, ogQ = og.side === "none" ? 0 : og.shares;
        const ogChoice = og.side === "sell" && x.shares > EPS && Math.abs(ogQ - x.shares) < 1e-6 ? "sell_all" : og.side;
        const sideCls = (sellsAll(x) ? "sell_all" : x.o.side) !== ogChoice ? " user-cell" : "", qtyCls = Math.abs(x.q - ogQ) > 1e-7 ? " user-cell" : "";
        return `<tr class="${x.edited ? "edited" : ""} ${x.over ? "problem" : ""}" title="${x.over ? "Sell exceeds shares held" : ""}">
          <td><button class="caret" type="button" data-r="lots-toggle" data-k="${esc(x.key)}" aria-expanded="${open}" aria-label="Tax lots for ${esc(x.symbol)}">${open ? "&#9662;" : "&#9656;"}</button>${mask(x.account)}</td><td>${code[accounts[x.account].type] || ""}</td><td class="sym">${esc(x.symbol)}</td>
          <td class="n">${money(val)}</td><td class="n">${qty(x.shares)}</td><td class="n">${money(x.cost)}</td><td class="n">${money(gl)}</td><td class="n">${x.cost > 0 ? pct(gl / x.cost, 1) : "&ndash;"}</td>
          <td class="adj"><select id="o-side-${i}" class="${sideCls.trim()}" data-ok="${esc(x.key)}" data-f="side" aria-label="Transaction type for ${esc(x.symbol)}"${dis}>${sideOptions(x)}</select></td>
          <td class="adj n"><input type="number" id="o-amt-${i}" class="${qtyCls.trim()}" min="0" step="0.01" data-ok="${esc(x.key)}" data-f="amt" value="${x.q ? x.amt.toFixed(2) : ""}" placeholder="0.00" aria-label="Dollar amount"${dis}></td>
          <td class="adj n"><input type="number" id="o-sh-${i}" class="${qtyCls.trim()}" min="0" step="${D.fractional ? "0.000001" : "1"}" data-ok="${esc(x.key)}" data-f="shares" value="${x.q ? +x.q.toFixed(6) : ""}" placeholder="0" aria-label="Shares"${dis}></td>
          <td class="n">${money(x.adj * x.price)}</td><td class="n">${qty(x.adj)}</td>
          <td class="n">${x.o.side === "sell" && x.q ? money(x.st + x.lt) + (x.est ? "*" : "") + termTag(sellTerm(x)) : money(0)}</td></tr>${open ? lotRows(x) : ""}`;
      }).join("");
      return `<div class="controls"><label class="toggle"><input type="checkbox" id="r-show-empty"${ui.showEmpty ? " checked" : ""}> Show positions with no orders</label><span class="sep"></span>
          <span>Buy an unheld security</span>${U.picker("r-add-sym", "Symbol")}<select id="r-add-acct" aria-label="Account"${dis}>${D.accounts.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}</select>
          <button class="btn small" type="button" data-r="add-order"${dis}>Add</button><span class="sep"></span>
          <span><span class="legend-sq" style="background:var(--edited)"></span>User-edited order</span>
          <span><span class="legend-sq" style="background:#dfeaf7;border:1px solid #4a7fc1"></span>Changed field</span>
          <button class="btn small" type="button" data-r="undo"${dis}>Undo user edits</button><button class="btn small" type="button" data-r="clear"${dis}>Clear all orders</button></div>
        ${rows ? `<div class="scroll"><table><thead><tr class="band-row"><th colspan="3"></th><th colspan="5">Current position</th><th colspan="3" class="band-amber">Orders</th><th colspan="3">Adjusted position (est.)</th></tr>
          <tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
          : '<p class="empty">No positions or orders.</p>'}
        <p class="small muted">${locked() ? (r.status === "refused" ? "This result is refused; choose Decision &gt; Re-enable Result to edit its orders." : `This result is ${esc(r.status)}, so its orders can't be edited.`) : "Edit an order's type, dollar amount or shares; every panel recalculates. Click Save at the top to keep your edits."}
          Click a column heading to sort; click again to reverse. Click &#9656; next to an account to see the position's tax lots.
          LT / ST / Mixed: whether a sell's gain is long-term, short-term or both (lots without a buy date count as short-term). * estimated from average cost.</p>`;
    }
    // Tax lots held in a position, and which of them the rebalance's sell order takes.
    function lotRows(x) {
      const taxable = accounts[x.account].taxable, asOf = D.run.as_of || new Date().toISOString().slice(0, 10);
      const held = (x.lots && x.lots.length ? x.lots : x.shares > EPS ? [{ qty: x.shares, cost: x.avg_cost, acquired: null }] : []);
      const og = original[x.key], sold = {};
      const planned = x.o.side === "sell" && og && og.side === "sell" && og.lots && Math.abs(og.shares - x.q) < 1e-7;
      if (planned) for (const l of og.lots) { const k = l.acquired + "|" + l.cost; sold[k] = (sold[k] || 0) + l.qty; }
      const term = (l) => !taxable ? "Tax-deferred" : !l.acquired ? "Unknown" : asOf >= RebalEngine.longTermDate(l.acquired) ? "Long-term" : "Short-term";
      const lots = held.slice().sort((a, b) => (a.acquired || "").localeCompare(b.acquired || ""));
      const body = lots.map((l) => {
        const k = l.acquired + "|" + l.cost, s = Math.min(sold[k] || 0, l.qty); if (s) sold[k] -= s;
        const v = l.qty * x.price, g = v - l.qty * l.cost;
        return `<tr><td>${l.acquired ? esc(l.acquired) : '<span class="muted">Unknown</span>'}</td><td>${term(l)}</td><td class="n">${qty(l.qty)}</td><td class="n">${money(l.cost)}</td>
          <td class="n">${money(l.qty * l.cost)}</td><td class="n">${money(v)}</td><td class="n">${money(g)}</td><td class="n">${s ? qty(s) : ""}</td><td class="n">${s && taxable ? money(s * (x.price - l.cost)) : ""}</td></tr>`;
      }).join("") || '<tr><td colspan="9" class="muted">No shares held.</td></tr>';
      const note = x.o.side === "buy" && x.q > EPS ? `The buy adds a new lot of ${qty(x.q)} shares at about ${money(x.price)}.`
        : x.o.side === "sell" && x.q > EPS && !planned ? "This sell was edited, so the lots it takes aren't known; the engine picks them when the rebalance runs."
        : x.o.side === "sell" && x.q > EPS ? "Shares sold come from the lots marked, chosen by the portfolio's lot selection rule." : "";
      return `<tr class="lots-row"><td colspan="14"><table class="lots"><thead><tr><th>Acquired</th><th>Term</th><th class="n">Shares</th><th class="n">Cost/share</th><th class="n">Cost basis</th>
        <th class="n">Mkt value</th><th class="n">Unrealized G/L</th><th class="n">Shares sold</th><th class="n">Realized gain</th></tr></thead><tbody>${body}</tbody></table>
        ${note ? `<p class="small muted">${note}</p>` : ""}</td></tr>`;
    }
    function variance(v, t, base) {
      if (ui.display === "dollar") return { html: money(v - t), num: v - t };
      if (ui.display === "abs") return { html: pct((v - t) / base, 2, true), num: (v - t) / base };
      return { html: t > 0 ? pct((v - t) / t, 1, true) : "&ndash;", num: t > 0 ? (v - t) / t : 0 };
    }
    function allocations(c) {
      const byClass = ui.allocBy === "class";
      const mk = (x, base, tol, label, extra = {}) => ({ label, target: x.target ?? x.target_value, cur: x.cur, aft: x.aft, adjust: x.adjust, s0: x.cur_state, s1: x.aft_state, tol, base, modeled: x.modeled !== false, ...extra });
      // Set-aside cash is part of the Cash actual, not added to its target.
      const setAside = D.accounts.reduce((s, a) => s + (a.set_aside || 0), 0);
      const cashHint = setAside > 0.005 ? `actual incl. ${plainMoney(setAside)} set-aside` : "";
      let items = byClass ? c.classes.map((k) => mk(k, D.total_value, D.class_band, k.name, { cls: k, hint: k.isCash ? cashHint : "" }))
        : c.groups.map((g) => mk(g, D.base, g.band, g.group, { members: g.members }));
      const cols = [["label", "text"], ["targetPct", "n"], ["tol", "n"], ["target", "n"], ["cur", "n"], ["curPct", "n"], ["var0", "n"], ["s0", "text"], ["adjust", "n"], ["aft", "n"], ["aftPct", "n"], ["var1", "n"], ["s1", "text"]];
      for (const x of items) { x.targetPct = x.target / x.base; x.curPct = x.cur / x.base; x.aftPct = x.aft / x.base; x.v0 = variance(x.cur, x.target, x.base); x.v1 = variance(x.aft, x.target, x.base); x.var0 = x.v0.num; x.var1 = x.v1.num; }
      if (ui.sort.col) {
        const k = ui.sort.col, dir = ui.sort.dir;
        items = items.slice().sort((a, b2) => (typeof a[k] === "string" ? a[k].localeCompare(b2[k]) : a[k] - b2[k]) * dir);
      }
      const counted = items.filter((x) => x.modeled), n = counted.length, ok0 = inRange(counted, (x) => x.s0), ok1 = inRange(counted, (x) => x.s1);
      const row = (x, sub = false) => `<tr class="${sub ? "subrow" : ""}"><td class="sym">${byClass && !sub ? `<button class="caret" type="button" data-r="class-toggle" data-cls="${esc(x.label)}" aria-expanded="${ui.openClasses.has(x.label)}"${x.cls && x.cls.groups.length ? "" : " disabled"}>${ui.openClasses.has(x.label) ? "&#9662;" : "&#9656;"}</button>` : ""}${sub ? '<span class="indent"></span>' : ""}${esc(x.label)}${x.hint ? ` <span class="muted small">(${esc(x.hint)})</span>` : ""}${x.members && x.members.length > 1 ? ` <span class="muted small">+ ${esc(x.members.slice(1).join(", "))}</span>` : ""}</td>
        <td class="n">${pct(x.targetPct, 2)}</td><td class="n">&plusmn;${pct(x.tol, 2)}</td><td class="n">${money(x.target)}</td><td class="n">${money(x.cur)}</td><td class="n">${pct(x.curPct, 2)}</td>
        <td class="n">${x.v0.html}</td><td>${mark(x.s0)}</td><td class="n adj">${money(x.adjust)}</td><td class="n">${money(x.aft)}</td><td class="n">${pct(x.aftPct, 2)}</td><td class="n">${x.v1.html}</td><td>${mark(x.s1)}</td></tr>`;
      const body = items.map((x) => row(x) + (byClass && x.cls && ui.openClasses.has(x.label)
        ? x.cls.groups.map((g) => { const s = mk(g, D.total_value, g.band, g.group, { members: g.members }); s.targetPct = s.target / s.base; s.curPct = s.cur / s.base; s.aftPct = s.aft / s.base;
            s.v0 = variance(s.cur, s.target, s.base); s.v1 = variance(s.aft, s.target, s.base); return row(s, true); }).join("") : "")).join("");
      const hdr = (k, label, cls = "") => { const on = ui.sort.col === k; return `<th class="${cls}" aria-sort="${on ? (ui.sort.dir > 0 ? "ascending" : "descending") : "none"}"><button class="sort" type="button" data-r="sort" data-col="${k}">${label}${on ? (ui.sort.dir > 0 ? " &#9650;" : " &#9660;") : ""}</button></th>`; };
      const seg = (v, l) => `<button type="button" data-r="display" data-v="${v}" aria-pressed="${ui.display === v}">${l}</button>`;
      return `<div class="controls"><label>Show by <select id="r-alloc-by"><option value="position"${byClass ? "" : " selected"}>Position</option><option value="class"${byClass ? " selected" : ""}>Class</option></select></label>
          <span class="seg">Display: ${seg("dollar", "$")}|${seg("rel", "Rel %")}|${seg("abs", "Abs %")}</span>
          <span class="muted small">Model used in rebalance: <button class="linkbtn" type="button" data-r="drawer-model">${esc(D.run.model || "None")}</button></span></div>
        <div class="scroll"><table><thead><tr class="band-row"><th colspan="3">Allocation</th>${band(ok0, n, "Allocations in range:", 5)}<th class="band-amber">Adjustment</th>${band(ok1, n, "Allocations in range:", 4)}</tr>
          <tr>${hdr("label", byClass ? "Class" : "Position")}${hdr("targetPct", "Target %", "n")}${hdr("tol", "Tolerance", "n")}${hdr("target", "Target $", "n")}${hdr("cur", "Actual $", "n")}${hdr("curPct", "Actual %", "n")}
          ${hdr("var0", "Variance", "n")}${hdr("s0", "")}${hdr("adjust", byClass ? "Class adjustment" : "Position adjustment", "n adj")}${hdr("aft", "Value $", "n")}${hdr("aftPct", "Actual %", "n")}${hdr("var1", "Variance", "n")}${hdr("s1", "")}</tr></thead>
          <tbody>${body}</tbody></table></div>
        <p class="small muted">Sorted by variance after adjustments, most underweight first. Click a column heading to sort; click again to reverse. ${byClass ? "Click a class's arrow to show its securities. Classes and their securities are percent of total value, cash included."
          : `Positions are percent of invested value ${money(D.base)}.`} Rel % = variance / target; Abs % = actual &minus; target.</p>`;
    }
    function chart(c) {
      const items = Views.colorize(ui.chartBy === "class" ? c.classes.map((k) => ({ label: k.name, cur: k.cur, aft: k.aft, isCash: k.isCash }))
        : [...c.groups.map((g) => ({ label: g.group, cur: g.cur, aft: g.aft })), { label: "Cash", cur: D.accounts.reduce((s, a) => s + a.cash, 0), aft: c.cash.reduce((s, a) => s + a.after, 0), isCash: true }]);
      const T = D.total_value;
      return `<div class="controls"><label>Group by <select id="r-chart-by"><option value="class"${ui.chartBy === "class" ? " selected" : ""}>Class</option><option value="position"${ui.chartBy === "position" ? " selected" : ""}>Position</option></select></label></div>
        <div class="chart"><figure><figcaption>Current</figcaption>${Views.donut(items.map((x) => ({ label: x.label, value: x.cur, color: x.color })), 200, "Current allocation")}</figure>
        <div class="legend scroll"><table><thead><tr><th></th><th class="n">Current</th><th>${ui.chartBy === "class" ? "Class" : "Position"}</th><th class="n">After adjustments</th><th></th></tr></thead><tbody>
          ${items.map((x) => `<tr><td><span class="legend-sq" style="background:${x.color}"></span></td><td class="n">${pct(x.cur / T, 1)}</td><td>${esc(x.label)}</td><td class="n">${pct(x.aft / T, 1)}</td><td><span class="legend-sq" style="background:${x.color}"></span></td></tr>`).join("")}</tbody></table></div>
        <figure><figcaption>After adjustments</figcaption>${Views.donut(items.map((x) => ({ label: x.label, value: x.aft, color: x.color })), 200, "Allocation after adjustments")}</figure></div>
        <p class="small muted">Percent of total value. Totals may not add to 100% due to rounding.</p>`;
    }
    // Order entry: what to type into Robinhood, one order at a time, ticked off as it's placed.
    const activeOrders = (c) => c.rows.filter((x) => x.q > EPS && x.o.side !== "none")
      .sort((a, b) => (a.o.side === "sell" ? 0 : 1) - (b.o.side === "sell" ? 0 : 1) || accounts[a.account].name.localeCompare(accounts[b.account].name) || b.amt - a.amt);
    const entryCount = (c) => { const list = activeOrders(c); return [list.filter((x) => (r.entered || {})[x.key]).length, list.length]; };
    function entry(c) {
      const list = activeOrders(c), entered = r.entered || {}, dollars = (ui.buyMode || "dollars") === "dollars";
      if (!list.length) return '<p class="empty">No orders to enter.</p>';
      const [done, total] = entryCount(c);
      const groups = [];
      for (const x of list) { const g = groups.find((y) => y.side === x.o.side && y.account === x.account); if (g) g.items.push(x); else groups.push({ side: x.o.side, account: x.account, items: [x] }); }
      let n = 0;
      const rows = groups.map((g) => `<tr class="grp"><td colspan="6">${g.side === "sell" ? "Sells" : "Buys"} in ${esc(accounts[g.account].name)} ${mask(g.account)}</td></tr>` + g.items.map((x) => {
        n++;
        const isBuy = x.o.side === "buy", asDollars = isBuy && dollars;
        const value = asDollars ? x.amt.toFixed(2) : String(+x.q.toFixed(6));
        const shown = asDollars ? plainMoney(x.amt) : `${qty(x.q)} shares`;
        const est = asDollars ? `about ${qty(x.q)} shares at ${plainMoney(x.price)}` : `about ${plainMoney(x.amt)} at ${plainMoney(x.price)}`;
        return `<tr class="${entered[x.key] ? "done" : ""}"><td><input type="checkbox" id="ent-${n}" data-entry="${esc(x.key)}" aria-label="Mark order ${n} as entered"${entered[x.key] ? " checked" : ""}></td>
          <td class="n">${n}</td><td class="side-${x.o.side}">${x.o.side.toUpperCase()}</td>
          <td><a class="rh-link" href="https://robinhood.com/stocks/${encodeURIComponent(x.symbol)}" target="_blank" rel="noopener">${esc(x.symbol)} <span aria-hidden="true">&#8599;</span><span class="sr">(opens Robinhood)</span></a></td>
          <td class="n entry-val"><b>${shown}</b> <button class="btn small" type="button" data-r="copy-val" data-v="${esc(value)}" aria-label="Copy ${esc(shown)}">Copy</button></td>
          <td class="muted small">${est}</td></tr>`;
      }).join("")).join("");
      return `<div class="controls"><b>${done} of ${total} entered</b><progress max="${total}" value="${done}" aria-label="Orders entered"></progress>
          <span class="sep"></span><span class="seg">Enter buys as: <button type="button" data-r="buymode" data-v="dollars" aria-pressed="${dollars}">Dollars</button>|<button type="button" data-r="buymode" data-v="shares" aria-pressed="${!dollars}">Shares</button></span>
          <button class="btn small" type="button" data-r="copy">Copy whole list</button></div>
        ${done === total ? '<p class="status-on">All orders are marked as entered.</p>' : ""}
        <div class="scroll"><table><thead><tr><th>Entered</th><th class="n">#</th><th>Action</th><th>Security</th><th class="n">Enter in Robinhood</th><th>Estimate</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="small muted">Place sells first; buys need the sale proceeds to settle into buying power. Clicking a security opens its Robinhood page in a new tab,
          where you choose Buy or Sell and paste the amount. Dollar buys fill at the market price, so the share count may differ slightly from the estimate.
          Prices here are from when the rebalance ran.</p>`;
    }
    function messages() {
      return `<ul class="notes">${(D.messages || []).map((m) => `<li>${esc(m)}</li>`).join("") || "<li>None.</li>"}</ul>` +
        (D.skipped && D.skipped.length ? `<details><summary>Trades skipped as too small (${D.skipped.length})</summary><ul class="notes">${D.skipped.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></details>` : "");
    }
    function drawerHTML() {
      if (!ui.drawer) return "";
      const p = pf(), model = r.model_snapshot || Store.get("models", p.model_id);
      const body = ui.drawer === "model"
        ? `<section class="dsec" id="d-model"><h3>Model: ${esc((model || {}).name || "None")}</h3>${Views.modelSleeves(model, D.cash_target_percent)}
            <p class="hint">The model as it was when this rebalance ran.</p></section>`
        : (Store.get("portfolios", D.run.portfolio_id) ? Views.portfolioSections(p, { prefix: "d" }) : '<p class="hint">This portfolio was deleted.</p>');
      const nav = ui.drawer === "model" ? "" : `<nav>${[["accounts", "Accounts"], ["model", "Model"], ["reporting", "Reporting"], ["notes", "Notes"], ["equivalents", "Equivalencies"], ["restrictions", "Restrictions"], ["gains", "Capital gain limits"], ["settings", "Settings"]]
        .map(([k, l]) => `<button type="button" data-r="jump" data-to="d-${k}">${l}</button>`).join("")}</nav>`;
      return `<div class="dh"><h2>${ui.drawer === "model" ? "Model information" : `Portfolio information: ${esc(p.name)}`}</h2><button class="close" type="button" data-r="drawer-close" aria-label="Close">&times;</button></div>${nav}
        ${ui.drawer !== "model" ? '<p class="pending small">Changes here apply to the next rebalance of this portfolio.</p>' : ""}${body}`;
    }

    // The day (Eastern time) this result was submitted: Orders filters by it.
    const submitDay = () => new Date((r.paper && r.paper.submitted_at) || r.decided_at || r.created).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    // Demo blotter counts for this result's approved orders.
    const blot = () => { const b = r.blotter || []; return { open: b.filter((o) => o.status === "open").length, filled: b.filter((o) => o.status === "filled").length,
      closed: b.filter((o) => o.status === "canceled" || o.status === "rejected" || o.status === "recalled").length, total: b.length }; };
    function render() {
      r = Store.get("results", resultId) || r;
      const c = compute(), b = compute(true), p = pf(), edits = c.rows.filter((x) => x.edited).length;
      const [entDone, entTotal] = entryCount(c), bl = blot();
      const ordersLink = (tab, label) => `<button class="linkbtn" type="button" data-act="go-orders" data-tab="${tab}" data-day="${esc(submitDay())}" data-pf="${esc(D.run.portfolio_id)}">${label} &rarr;</button>`;
      const status = r.status === "approved" ? `<b>APPROVED</b><span>Approved ${esc(r.approved_label || r.decided_label || "")}</span>
          <span>${bl.open} of ${bl.total} order${bl.total === 1 ? "" : "s"} open on the Orders blotter${bl.filled ? `, ${bl.filled} filled` : ""}${bl.closed ? `, ${bl.closed} canceled or recalled` : ""}.</span>
          ${ordersLink("open", "Submit them on the Orders blotter")}`
        : r.status === "submitted" && r.blotter ? `<b>${bl.filled ? "FILLED (DEMO)" : "CLOSED"}</b><span>Approved ${esc(r.approved_label || "")}${r.paper ? ` &middot; last submitted ${esc(r.paper.submitted_label || r.decided_label || "")}` : ""}</span>
          <span>${bl.filled} order${bl.filled === 1 ? "" : "s"} filled${r.paper ? ` at the ${esc(Charts.fmtDate(r.paper.price_date))} close` : ""}${bl.closed ? `, ${bl.closed} canceled or recalled` : ""}.</span>
          ${bl.filled ? ordersLink("closed", "View these orders in Orders") : ""}`
        : r.status === "submitted" && r.paper ? `<b>FILLED (DEMO)</b><span>Submitted ${esc(r.decided_label || "")}</span>
          <span>${r.paper.fills.length} order${r.paper.fills.length === 1 ? "" : "s"} filled at the ${esc(Charts.fmtDate(r.paper.price_date))} close.</span>
          ${r.paper.fills.length ? ordersLink("closed", "View these orders in Orders") : ""}`
        : r.status === "submitted" ? `<b>SUBMITTED</b><span>${esc(r.decided_label || "")}</span><span>${entDone} of ${entTotal} orders entered in Robinhood.</span>
          ${entDone < entTotal ? '<button class="linkbtn" type="button" data-r="goto-entry">Go to order entry</button>' : ""}`
        : r.status === "refused" ? `<b>REFUSED</b><span>${esc(r.decided_label || "")}</span>`
        : `<b>${edits ? "EDITED" : "PROPOSED"}</b><span>${esc(r.created_label)}</span><span>${edits ? `${edits} user-edited order${edits > 1 ? "s" : ""}. ` : ""}Not approved.</span>`;
      const scroll = container.querySelector(".drawer")?.scrollTop || 0;
      const isDirty = dirty();
      const back = batch ? `Back to ${batch.name}` : "Back to Rebalance Results";
      const nav = batch && pos >= 0 ? `<span class="result-nav"><button class="btn light small" type="button" data-r="prev"${pos > 0 ? "" : " disabled"} aria-label="Previous portfolio">&lsaquo; Previous</button>
          <span class="pos">${pos + 1} of ${siblings.length}</span><button class="btn light small" type="button" data-r="next"${pos < siblings.length - 1 ? "" : " disabled"} aria-label="Next portfolio">Next &rsaquo;</button></span>` : "";
      container.innerHTML = `<div class="titlebar"><h1>Rebalance Result Detail</h1>
          <button class="btn light" type="button" data-r="back" title="${esc(back)}">&larr; Back</button>
          <button class="btn${isDirty ? " primary" : " light"}" type="button" data-r="save"${isDirty && !locked() ? "" : " disabled"}>Save</button>
          ${isDirty ? '<span class="unsaved">Unsaved changes</span>' : ""}${nav}
          <button class="btn light" type="button" data-r="copy">Copy order list</button><span class="spacer"></span>
          <div class="menu-wrap"><button class="btn primary" type="button" data-r="submit-menu" aria-haspopup="menu" aria-expanded="false">${locked() ? "Decision" : "Approve orders"} &#9662;</button>
            <div class="menu" role="menu" hidden>${r.status === "approved" && bl.open ? `<button role="menuitem" type="button" data-r="recall">Recall orders (${bl.open} open)</button>`
              : locked() && (r.paper || r.blotter) ? `<button role="menuitem" type="button" disabled>Closed in the demo: run a new rebalance to trade again</button>`
              : locked() ? `<button role="menuitem" type="button" data-r="reopen">Re-enable Result</button>`
              : `<button role="menuitem" type="button" data-r="submit">Approve orders</button><button role="menuitem" type="button" data-r="refuse">Refuse order</button>`}</div></div>
          <button class="linkbtn" type="button" data-r="expand">Expand all</button><span>/</span><button class="linkbtn" type="button" data-r="collapse">Collapse all</button></div>
        <div class="top${ui.drawer ? " drawer-open" : ""}">
          <section class="card"><dl class="info">
            <div><dt>Outcome</dt><dd class="plain outcome">${c.totals.trades ? "ORDERS" : "NO ORDERS"}</dd></div>
            <div><dt>Rebalance name</dt><dd class="plain">${esc(D.run.name)}</dd></div><div><dt>Rebalance type</dt><dd class="plain">${esc(D.run.type)}</dd></div>
            <div><dt>Rebal ID</dt><dd class="plain">${esc(r.id)}</dd></div>
            <div><dt>Portfolio name</dt><dd><button class="linkbtn big" type="button" data-r="drawer" data-section="accounts">${esc(p.name)}</button></dd></div></dl></section>
          <div class="banner ${r.status === "submitted" ? "ok" : r.status === "approved" ? "approved" : r.status === "refused" ? "bad" : edits ? "edited" : "proposed"}" role="status">${status}
            ${c.problems.length ? `<span class="mark-bad">${c.problems.length} sell order(s) exceed shares held.</span>` : ""}</div>
          ${panel("summary", "Summary", summary(c, b))}
          <aside class="drawer" aria-label="Information"${ui.drawer ? "" : " hidden"}>${drawerHTML()}</aside></div>
        ${(r.status === "submitted" || r.status === "approved") && r.paper ? panel("entry", "Submission", paperNotes())
          : r.status === "submitted" ? panel("entry", `Order Entry (${entDone} of ${entTotal} entered)`, entry(c)) : ""}
        ${panel("cash", "Cash Values", cashValues(c))}${panel("orders", "Orders", ordersTable(c))}${panel("alloc", "Allocations", allocations(c))}
        ${panel("chart", "Allocation Chart", chart(c))}${panel("messages", `Rebalance messages (${(D.messages || []).length})`, messages())}`;
      const dr = container.querySelector(".drawer");
      if (dr) dr.scrollTop = scroll;
    }
    function orderText() {
      return compute().rows.filter((x) => x.q > EPS && x.o.side !== "none").sort((a, b) => (a.o.side === "sell" ? 0 : 1) - (b.o.side === "sell" ? 0 : 1))
        .map((x, i) => `${i + 1}. ${accounts[x.account].name} ${U.maskText(x.account)}: ${x.o.side.toUpperCase()} ${qty(x.q)} ${x.symbol} (~${plainMoney(x.amt)})`).join("\n");
    }
    async function copy(text) {
      try { await navigator.clipboard.writeText(text); U.toast("Copied"); }
      catch { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); U.toast("Copied"); }
    }
    // In the public demo (RH.paper), submitting fills the orders in the simulated accounts at the latest real closing prices.
    const paper = () => root.RH && RH.paper;
    async function decide(status) {
      // Approving or refusing saves the orders as they stand.
      r.status = status; r.decided_at = new Date().toISOString(); r.decided_label = U.nowStamp(); r.edits = orders; ui.draft = null;
      if (status === "approved") {
        // Demo: approved orders go to the Orders blotter as open orders; they fill only when submitted there.
        // An unedited sell carries the lots the rebalance chose, so its fill sells exactly those.
        const list = compute().rows.filter((x) => x.q > EPS && x.o.side !== "none").map((x) => { const og = original[x.key];
          const lots = x.o.side === "sell" && og && og.side === "sell" && og.lots && Math.abs(og.shares - x.q) < 1e-7 ? og.lots : null;
          return { account: x.account, symbol: x.symbol, side: x.o.side, qty: x.q, lots, all: sellsAll(x) }; });
        r.approved_at = r.decided_at; r.approved_label = r.decided_label;
        r.blotter = list.map((o, i) => ({ id: `${r.id}-o${i + 1}`, ...o, est_price: D.prices[o.symbol] || 0, status: "open" }));
        if (!r.blotter.length) r.status = "submitted";
        U.toast(r.blotter.length ? `${r.blotter.length} order${r.blotter.length === 1 ? "" : "s"} sent to the Orders blotter` : "No orders to send");
      }
      Store.put("results", r.id, r); render();
      // Stay on this page: the message at the top links to the orders.
      if (status !== "refused") window.scrollTo({ top: 0 });
    }
    // After a demo submit: what happened besides the fills (they're listed under Orders).
    function paperNotes() {
      const p = r.paper;
      if (!p) return "";
      return `${p.skipped.length ? `<ul class="notes small">${p.skipped.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
        ${(p.dates || []).length ? `<div class="dates-set"><b>Report dates updated (trade date ${esc(Charts.fmtDate(p.price_date))}, as of the close):</b>
          <ul class="notes small">${p.dates.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
          <p class="small muted">You can change them on each account's details (performance start date) and the portfolio's Reporting tab.</p></div>` : ""}
        ${p.settles ? `<p class="small muted">Sale proceeds settle ${esc(Charts.fmtDate(p.settles))} (T+1); until then they show as unsettled in each account's Available cash.</p>` : ""}
        <p class="small muted">${p.fills.length} simulated fill${p.fills.length === 1 ? "" : "s"} at the ${esc(Charts.fmtDate(p.price_date))} closing prices, listed under
          <button class="linkbtn" type="button" data-act="go-orders" data-tab="closed" data-day="${esc(submitDay())}" data-pf="${esc(D.run.portfolio_id)}">Orders (Closed)</button>.
          Positions, cash, Activity summary, Transactions and Performance include them. Nothing real was traded.</p>`;
    }
    function submitFlow() {
      const p = pf(), text = orderText();
      const confirmSubmit = () => U.modal({ title: "Approve orders", wide: true, body: paper()
          ? `<p><b>Demo:</b> the orders below go to the <b>Orders</b> blotter as open orders. Submit them there (all or some) to fill them
            at the latest real closing prices; until then nothing trades. Nothing real is ever traded.</p>
          <pre class="orderlist">${esc(text || "No orders.")}</pre>`
          : `<p>This records the orders below as approved. <b>Nothing is sent to Robinhood.</b>
          Next, the Order Entry list walks you through placing each one in Robinhood: a link to each security, the exact amount to copy, and a box to tick when it's done.</p>
          <pre class="orderlist">${esc(text || "No orders.")}</pre>`,
        actions: [{ label: "Cancel" }, { label: "Copy order list", onClick: () => { copy(text); return false; }, closes: false },
                  { label: "Approve orders", primary: true, onClick: () => decide(paper() ? "approved" : "submitted") }] });
      if ((p.notes || []).length) {
        U.modal({ title: `Read the notes for ${p.name}`, wide: true, body: `<p>This portfolio has notes. Read them before approving.</p>
            <ul class="notes">${p.notes.map((n) => `<li><div class="small muted">${esc(n.created_label || "")}</div>${esc(n.text)}</li>`).join("")}</ul>
            <label class="toggle"><input type="checkbox" id="notes-read"> I've read these notes</label>`,
          actions: [{ label: "Cancel" }, { label: "Continue", primary: true, onClick: (close, host) => {
            if (!host.querySelector("#notes-read").checked) { U.toast("Tick \"I've read these notes\" first"); return false; }
            close(); setTimeout(confirmSubmit, 0); return false; } }] });
      } else confirmSubmit();
    }

    // ---- events (scoped to this container) ----
    container.addEventListener("change", (ev) => {
      const t = ev.target;
      if (t.id === "r-show-empty") { ui.showEmpty = t.checked; return render(); }
      if (t.id === "r-alloc-by") { ui.allocBy = t.value; ui.sort = { col: "var1", dir: 1 }; return render(); }
      if (t.id === "r-chart-by") { ui.chartBy = t.value; return render(); }
      if (t.dataset.entry) {
        r.entered = { ...(r.entered || {}), [t.dataset.entry]: t.checked };
        Store.put("results", r.id, r); render(); container.querySelector("#" + t.id)?.focus(); return;
      }
      const k = t.dataset.ok, f = t.dataset.f;
      if (!k || locked()) return;
      const price = D.prices[k.split("|")[1]] || 0, o = orders[k] || (orders[k] = { side: "none", shares: 0 });
      if (f === "side" && t.value === "sell_all") {
        const pos = D.positions.find((p) => key(p.account, p.symbol) === k);
        o.side = "sell"; o.shares = pos ? pos.shares : 0;
      } else if (f === "side") {
        // NONE clears the order, so switching back to BUY or SELL starts from zero for you to fill in.
        if (t.value === "none") o.shares = 0;
        o.side = t.value;
      }
      if (f === "amt") { o.shares = price ? roundShares((+t.value || 0) / price) : 0; if (o.side === "none" && o.shares) o.side = "buy"; }
      if (f === "shares") { o.shares = D.fractional ? Math.max(0, +t.value || 0) : Math.floor(Math.max(0, +t.value || 0)); if (o.side === "none" && o.shares) o.side = "buy"; }
      saveEdits(); render(); container.querySelector("#" + t.id)?.focus();
    });
    container.addEventListener("click", (ev) => {
      r = Store.get("results", resultId) || r;
      const t = ev.target.closest("[data-r]");
      const menu = container.querySelector(".menu");
      if (!t || t.dataset.r !== "submit-menu") { if (menu) menu.hidden = true; }
      if (!t) return;
      const a = t.dataset.r;
      if (a === "toggle") { ui.closed.has(t.dataset.id) ? ui.closed.delete(t.dataset.id) : ui.closed.add(t.dataset.id); return render(); }
      if (a === "expand" || a === "collapse") { ui.closed = a === "collapse" ? new Set(["summary", "entry", "cash", "orders", "alloc", "chart", "messages"]) : new Set(); return render(); }
      if (a === "submit-menu") { menu.hidden = !menu.hidden; t.setAttribute("aria-expanded", String(!menu.hidden)); if (!menu.hidden) menu.querySelector("button").focus(); return; }
      if (a === "submit") return submitFlow();
      if (a === "refuse") return U.modal({ title: "Refuse order", body: "<p>Mark this rebalance as refused? Its orders won't be used. You can re-enable it later (Decision &gt; Re-enable Result).</p>",
        actions: [{ label: "Cancel" }, { label: "Refuse order", danger: true, onClick: () => decide("refused") }] });
      // Recall orders: take this result's open orders back off the blotter. With nothing filled it returns to proposed
      // (editable, ready to approve again); otherwise the filled orders stand and the result closes.
      if (a === "recall" && r.status === "approved") {
        const b = blot(), back = !b.filled;
        return U.modal({ title: "Recall orders", body: `<p>Take this result's ${b.open} open order${b.open === 1 ? "" : "s"} off the Orders blotter?</p>
            <p>${back ? "Nothing has filled, so the result goes back to <b>proposed</b>: you can edit the orders and approve them again."
              : `${b.filled} order${b.filled === 1 ? " has" : "s have"} already filled and stay${b.filled === 1 ? "s" : ""} filled. The result closes once the open orders are recalled.`}</p>`,
          actions: [{ label: "Keep them" }, { label: "Recall orders", danger: true, onClick: () => {
            const now = new Date().toISOString(), label = U.nowStamp();
            if (back) { r.status = "proposed"; delete r.blotter; delete r.approved_at; delete r.approved_label; r.decided_label = ""; }
            else {
              for (const o of r.blotter) if (o.status === "open") { o.status = "recalled"; o.closed_at = now; }
              r.status = "submitted"; r.decided_at = now; r.decided_label = label;
            }
            App.state.ordSel = new Set();
            Store.put("results", r.id, r); render(); U.toast(back ? "Orders recalled: the result is editable again" : "Open orders recalled");
          } }] });
      }
      if (a === "reopen" && !r.paper) { r.status = "proposed"; r.decided_label = ""; Store.put("results", r.id, r); return render(); }
      if (a === "copy") return copy(orderText());
      if (a === "copy-val") return copy(t.dataset.v);
      if (a === "buymode") { ui.buyMode = t.dataset.v; return render(); }
      if (a === "goto-entry") { ui.closed.delete("entry"); render(); container.querySelector("#r-entry")?.scrollIntoView({ block: "start" }); return; }
      if (a === "sort") { ui.sort = ui.sort.col === t.dataset.col ? { col: t.dataset.col, dir: -ui.sort.dir } : { col: t.dataset.col, dir: 1 }; return render(); }
      if (a === "save") return saveNow();
      if (a === "back") return leave(batch ? "batch-" + batch.id : "results");
      if (a === "prev" && pos > 0) return leave("result-" + siblings[pos - 1]);
      if (a === "next" && pos < siblings.length - 1) return leave("result-" + siblings[pos + 1]);
      if (a === "order-sort") { const s = ui.orderSort || {}; ui.orderSort = s.col === t.dataset.col ? { col: s.col, dir: -s.dir } : { col: t.dataset.col, dir: 1 }; return render(); }
      if (a === "fill-sort") { const s = ui.fillSort; ui.fillSort = s.col === t.dataset.col ? { col: s.col, dir: -s.dir } : { col: t.dataset.col, dir: 1 }; return render(); }
      if (a === "lots-toggle") { ui.openLots.has(t.dataset.k) ? ui.openLots.delete(t.dataset.k) : ui.openLots.add(t.dataset.k); return render(); }
      if (a === "class-toggle") { ui.openClasses.has(t.dataset.cls) ? ui.openClasses.delete(t.dataset.cls) : ui.openClasses.add(t.dataset.cls); return render(); }
      if (a === "display") { ui.display = t.dataset.v; return render(); }
      if (a === "undo") { orders = cloneOriginal(); saveEdits(); return render(); }
      if (a === "clear") { for (const o of Object.values(orders)) { o.side = "none"; o.shares = 0; } saveEdits(); return render(); }
      if (a === "add-order") {
        const sym = container.querySelector("#r-add-sym").value.trim().toUpperCase(), acct = container.querySelector("#r-add-acct").value;
        if (!sym) return U.toast("Pick a security first");
        if (!(D.prices[sym] > 0)) {
          return RH.api.quotes([sym]).then((q) => { if (!(q[sym] > 0)) return U.toast(`No Robinhood price for ${sym}`);
            D.prices[sym] = q[sym]; D.group_of[sym] = D.group_of[sym] || sym; orders[key(acct, sym)] = { side: "buy", shares: 0 }; ui.showEmpty = true; saveEdits(); Store.put("results", r.id, r); render(); })
            .catch((e) => U.toast(e.message));
        }
        D.group_of[sym] = D.group_of[sym] || sym;
        if (!orders[key(acct, sym)] || orders[key(acct, sym)].side === "none") orders[key(acct, sym)] = { side: "buy", shares: 0 };
        ui.showEmpty = true; saveEdits(); return render();
      }
      if (a === "drawer") { ui.drawer = "portfolio"; if (t.dataset.acct) App.state.openAcct = t.dataset.acct; render(); App.loadBalances(pf().account_numbers);
        const el = container.querySelector("#d-" + (t.dataset.section || "accounts")), dr = container.querySelector(".drawer");
        if (el && dr) dr.scrollTop = el.offsetTop - 80; return; }
      if (a === "drawer-model") { ui.drawer = "model"; return render(); }
      if (a === "drawer-close") { ui.drawer = null; return render(); }
      if (a === "jump") { const el = container.querySelector("#" + t.dataset.to), dr = container.querySelector(".drawer"); if (el) dr.scrollTop = el.offsetTop - 80; }
    });
    container.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && ui.drawer) { ui.drawer = null; render(); } });
    container._rerender = render;
    render();
  }

  root.ResultView = { mount };
})(window);
