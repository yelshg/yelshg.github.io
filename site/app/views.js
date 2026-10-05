// Pages and shared editors. Each view returns HTML; edits flow through data-bind / data-act handlers in main.js.
(function (root) {
  "use strict";
  const { esc, money, pct, qty, mask, maskText, picker } = U;
  const CLASSES = ["Equity", "Fixed Income", "Cash Equivalent", "Real Estate", "Alternatives", "Other"];
  const PALETTE = ["#3d8b2f", "#7442c8", "#e4572e", "#e0a100", "#1b9aaa", "#8c5a2b", "#d6458f", "#6b7a8f"];
  const CASH_COLOR = "#2f6fd6";
  const ro = () => (Store.readOnly ? " disabled" : "");

  // ---- charts --------------------------------------------------------------
  // `center` is the dollar total shown in the middle; it defaults to the parts' sum, and false leaves the middle empty.
  // { text, label } shows other text instead (e.g. a count), and segments then show counts in their hover.
  function donut(parts, size = 180, label = "Allocation chart", center) {
    if (center && typeof center === "object") return countDonut(parts, size, label, center);
    // A thin ring around a large open center.
    const W = Math.max(6, size * 0.07), R = size / 2 - W / 2 - 1, C = 2 * Math.PI * R, c = size / 2;
    const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
    const shown = parts.filter((p) => p.value > 0), gap = shown.length > 1 ? 2 : 0;
    let off = 0;
    const segs = total > 0 ? shown.map((p) => {
      const len = (p.value / total) * C, draw = Math.max(0.5, len - gap);
      const seg = `<circle r="${R}" cx="${c}" cy="${c}" fill="none" stroke="${p.color}" stroke-width="${W}" stroke-dasharray="${draw.toFixed(2)} ${(C - draw).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"><title>${esc(p.label)}: ${(p.value / total * 100).toFixed(1)}%</title></circle>`;
      off += len; return seg;
    }).join("") : `<circle r="${R}" cx="${c}" cy="${c}" fill="none" stroke="var(--rule)" stroke-width="${W}"/>`;
    const amount = money(center === false ? total : center ?? total), fs = Math.min(size * 0.13, (2 * (R - W / 2) * 0.86) / (amount.length * 0.58));
    const mid = center === false ? "" : `<text x="${c}" y="${c - fs * 0.75}" text-anchor="middle" class="donut-total-label" font-size="${Math.max(10, size * 0.06).toFixed(1)}">Total</text>
      <text x="${c}" y="${c + fs * 0.45}" text-anchor="middle" class="donut-total" font-size="${fs.toFixed(1)}">${esc(amount)}</text>`;
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label)}${center === false ? "" : ", total " + esc(amount)}"><g transform="rotate(-90 ${c} ${c})">${segs}</g>${mid}</svg>`;
  }
  function countDonut(parts, size, label, center) {
    const W = Math.max(6, size * 0.07), R = size / 2 - W / 2 - 1, C = 2 * Math.PI * R, c = size / 2;
    const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0), shown = parts.filter((p) => p.value > 0), gap = shown.length > 1 ? 2 : 0;
    let off = 0;
    const segs = total > 0 ? shown.map((p) => { const len = (p.value / total) * C, draw = Math.max(0.5, len - gap);
      const seg = `<circle r="${R}" cx="${c}" cy="${c}" fill="none" stroke="${p.color}" stroke-width="${W}" stroke-dasharray="${draw.toFixed(2)} ${(C - draw).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"><title>${esc(p.label)}: ${p.value}</title></circle>`;
      off += len; return seg; }).join("") : `<circle r="${R}" cx="${c}" cy="${c}" fill="none" stroke="var(--rule)" stroke-width="${W}"/>`;
    const fs = size * 0.2;
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label)}: ${esc(center.text)} ${esc(center.label)}"><g transform="rotate(-90 ${c} ${c})">${segs}</g>
      <text x="${c}" y="${c + fs * 0.3}" text-anchor="middle" class="donut-total" font-size="${fs.toFixed(1)}">${esc(center.text)}</text>
      <text x="${c}" y="${c + fs * 0.3 + size * 0.1}" text-anchor="middle" class="donut-total-label" font-size="${Math.max(10, size * 0.065).toFixed(1)}">${esc(center.label)}</text></svg>`;
  }
  function colorize(items) { let i = 0; for (const it of items) it.color = it.isCash ? CASH_COLOR : PALETTE[i++ % PALETTE.length]; return items; }
  function legend(items, total) {
    return `<table class="legend-t"><tbody>${items.map((it) => `<tr><td><span class="legend-sq" style="background:${it.color}"></span>${esc(it.label)}</td><td class="n">${money(it.value)}</td><td class="n">${pct(total ? it.value / total : 0, 1)}</td></tr>`).join("")}</tbody></table>`;
  }

  // ---- shared editors ------------------------------------------------------
  function setAsideEditor(acctId, value) {
    const doc = U.acctDoc(acctId);
    const rows = doc.set_asides.map((r, i) => {
      const b = (f, t) => `data-bind="acct:${esc(acctId)}:set_asides.${i}.${f}" data-type="${t}" id="sa-${esc(acctId)}-${i}-${f}"${ro()}`;
      return `<tr><td><select ${b("kind", "str")} aria-label="Amount type"><option value="dollar"${r.kind !== "percent" ? " selected" : ""}>$</option><option value="percent"${r.kind === "percent" ? " selected" : ""}>% of MV</option></select></td>
        <td><input type="number" min="0" step="0.01" ${b("amount", "num")} value="${+r.amount || 0}" aria-label="Amount"></td>
        <td class="n">${money(U.setAsideDollars(r, value))}</td>
        <td><input type="date" ${b("effective", "date")} value="${esc(r.effective || "")}" aria-label="Takes effect"></td>
        <td>${U.inEffect(r, U.today()) ? '<span class="status-on">In effect</span>' : `<span class="muted">Starts ${esc(r.effective)}</span>`}</td>
        <td><input type="text" class="note-in" ${b("note", "str")} value="${esc(r.note || "")}" placeholder="Why is this cash set aside?" aria-label="Note"></td>
        <td><button class="btn small danger" type="button" data-act="sa-remove" data-acct="${esc(acctId)}" data-i="${i}"${ro()}>Remove</button></td></tr>`;
    }).join("");
    return `<h4>Set-aside cash</h4><div class="scroll"><table><thead><tr><th>Type</th><th>Amount</th><th class="n">Dollars</th><th>Takes effect</th><th>Status</th><th>Note</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" class="muted">No set-aside cash.</td></tr>'}</tbody></table></div>
      <div class="addrow"><button class="btn small" type="button" data-act="sa-add" data-acct="${esc(acctId)}"${ro()}>Add set-aside</button>
      <span class="hint">Blank date = held now. Add several with different dates to schedule them. Set-aside cash is never invested; the account keeps it on top of its cash target.</span></div>`;
  }
  // Cash free to use: cash less set-aside and less sale proceeds that haven't settled yet (T+1).
  const availableCash = (bal, setAside) => Math.max(0, bal.cash - setAside - (bal.unsettled || 0));
  function perfStartField(acctId) {
    const doc = U.acctDoc(acctId), first = Object.keys(History.recordsFor(acctId)).sort()[0];
    return `<input type="date" data-bind="acct:${esc(acctId)}:perf_start" data-type="date" id="ps-${esc(acctId)}" value="${esc(doc.perf_start || "")}" max="${History.etDate()}" aria-label="Performance start date"${ro()}>
      <div class="hint">${doc.perf_start ? `Reports measure this account from the close of ${Charts.fmtDate(doc.perf_start)}: its value at that close is its starting value, and gains before it aren't included (that day's trades still show in Transactions).`
        : `Blank = from the account's first recorded activity${first ? ` (${Charts.fmtDate(first)})` : ""}.`} Applies to Activity summary, Performance and Transactions.</div>`;
  }
  const PEN = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M13.6 2.6a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8L7.3 16.5 3 17.6l1.1-4.3L13.6 2.6Zm-1 2.6-7.1 7.1-.6 2.3 2.3-.6 7.1-7.1-1.7-1.7Z" fill="currentColor"/></svg>';
  // The account's name, with a pencil to rename it (or the rename box while editing).
  function acctNameEdit(a) {
    return App.state.acctRenaming === a.id
      ? `<span class="inline-edit"><input type="text" id="acct-rename-in" value="${esc(App.state.acctRenameDraft)}" maxlength="60" aria-label="Account name">
          <button class="btn small primary" type="button" data-act="acct-rename-save" data-acct="${esc(a.id)}">Save</button>
          <button class="btn small" type="button" data-act="acct-rename-cancel">Cancel</button></span>
          <div class="small muted">Robinhood name: ${esc(a.rh_name || a.name)}. Leave blank to use it.</div>`
      : `<span class="name-cell">${esc(U.acctDoc(a.id).nickname || a.rh_name || a.name)}<button class="pen" type="button" data-act="acct-rename" data-acct="${esc(a.id)}" aria-label="Edit name of account ${mask(a.id)}" title="Edit name"${ro()}>${PEN}</button></span>`;
  }
  // An opened account: a menu on the left (Account Details, Trading, Transactions) and the chosen section on the right.
  const ACCT_TABS = [["details", "Account Details"], ["trading", "Trading"], ["reporting", "Reporting"], ["transactions", "Transactions"]];
  const acctTabOf = (a) => (App.state.acctTab || {})[a.id] || "details";
  const acctMenu = (a) => ACCT_TABS.map(([k, l]) => `<button type="button" data-act="acct-tab" data-acct="${esc(a.id)}" data-tab="${k}" class="${acctTabOf(a) === k ? "on" : ""}"${acctTabOf(a) === k ? ' aria-current="true"' : ""}>${l}</button>`).join("");
  function accountPanel(a) {
    return `<div class="acct-panel"><nav class="acct-menu" aria-label="Account sections">
        <div class="acct-menu-title">${esc(a.name)} <span class="muted small">${mask(a.id)}</span></div>${acctMenu(a)}</nav>
      <div class="acct-body">${accountSection(a)}</div></div>`;
  }
  // One account on its own page: the menu sits to the left, outside the main box, and the other accounts are hidden.
  function accountPage(a) {
    return `<div class="page-head"><button class="linkbtn" type="button" data-act="acct-open" data-acct="${esc(a.id)}">&larr; All accounts</button>
        <h1>${esc(a.name)}</h1><span class="muted small">${mask(a.id)} &middot; ${esc(a.type_label)}</span></div>
      <div class="home-layout"><aside class="home-nav" aria-label="Account menu"><div class="hn-block"><div class="hn-title">Account</div></div>
          <nav class="hn-block acct-side">${acctMenu(a)}</nav></aside>
        <section class="home-main"><section class="card"><div class="body">${accountSection(a)}</div></section></section></div>`;
  }
  function accountSection(a) {
    const tab = acctTabOf(a), bal = App.state.balances[a.id];
    const sa = bal ? U.setAsideNow(a.id, bal.total) : null;
    const pfs = Store.all("portfolios").filter((p) => p.account_numbers.includes(a.id));
    const row = (label, value, cls = "") => `<tr><th scope="row">${label}</th><td class="${cls}">${value}</td></tr>`;
    const wait = '<span class="muted">Loading...</span>';
    const body = tab === "trading" ? setAsideEditor(a.id, bal ? bal.total : 0)
      : tab === "transactions" ? transfersEditor(a.id)
      : tab === "reporting" ? reportingEditor("acct", a.id, U.acctDoc(a.id), "None. Reports use the model of the account's portfolio.")
        + `<p class="hint">Blank dates mean open-ended. The benchmark is what this account's return is measured against in Performance &gt; By account
          (without one, the portfolio's benchmark is used). The reporting target is saved with the account for account-level reports. Benchmarks are defined on each model's page.</p>`
      : `<h4>Account Details</h4><table class="kv"><tbody>
          ${row("Account number", mask(a.id))}${row("Account name", acctNameEdit(a))}${row("Tax status", esc(a.type_label))}
          ${row("Performance start date", perfStartField(a.id))}
          ${row("Market value", bal ? money(bal.total) : wait, "n-left")}${row("Cash", bal ? money(bal.cash) + (RH.paper ? ` <button class="btn small" type="button" data-act="paper-add-cash" data-acct="${esc(a.id)}">Add cash</button>` : "") : wait, "n-left")}
          ${row("Set-aside cash", bal ? money(sa) : wait, "n-left")}
          ${bal && bal.unsettled > 0.005 ? row("Unsettled sale proceeds", `${money(bal.unsettled)} <span class="muted small">settles ${esc(Charts.fmtDate(bal.settles))} (T+1)</span>`, "n-left") : ""}
          ${row("Available cash", bal ? money(availableCash(bal, sa)) : wait, "n-left")}
          ${row("Cash % of MV", bal ? (bal.total ? pct(bal.cash / bal.total, 1) : pct(0, 1)) : wait, "n-left")}
          ${row("Portfolio", pfs.map((p) => `<a href="#portfolio-${esc(p.id)}">${esc(p.name)}</a>`).join(", ") || '<span class="muted">None</span>')}</tbody></table>`;
    // Edits in any of the account's sections are held until Save changes (or dropped with Cancel).
    const d = App.state.acctDraft, dirty = d && d.id === a.id;
    const bar = dirty ? `<div class="draft-bar" role="status"><span>You have unsaved changes to this account.</span>
        <span class="draft-actions"><button class="btn" type="button" data-act="acct-draft-cancel" data-acct="${esc(a.id)}">Cancel</button>
        <button class="btn primary" type="button" data-act="acct-draft-save" data-acct="${esc(a.id)}">Save changes</button></span></div>` : "";
    return bar + body;
  }
  // Deposits and withdrawals the user enters (Robinhood's connector doesn't report transfers), so reports date them exactly.
  function transfersEditor(acctId) {
    const a = esc(acctId), list = U.acctDoc(acctId).transfers || [];
    const rows = list.map((t, i) => `<tr><td>${esc(t.date)}</td><td>${History.KINDS[History.kindOf(t)]}</td><td class="sym">${esc(t.symbol || "")}</td><td class="n">${money(Math.abs(+t.amount))}</td>
      <td>${esc(t.note || "")}</td><td><button class="btn small danger" type="button" data-act="tr-remove" data-acct="${a}" data-i="${i}"${ro()}>Remove</button></td></tr>`).join("");
    return `<h4>Transactions <span class="muted small">deposits, withdrawals, dividends, interest, fees</span></h4><div class="scroll tr-scroll"><table><thead><tr><th>Date</th><th>Type</th><th>Symbol</th><th class="n">Amount</th><th>Note</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="muted">None entered. Reports infer deposits and withdrawals from your orders and daily snapshots.</td></tr>'}</tbody></table></div>
      <div class="addrow"><input type="date" id="tr-date-${a}" max="${History.etDate()}" aria-label="Date"${ro()}>
        <select id="tr-kind-${a}" aria-label="Type"${ro()}>${Object.entries(History.KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
        <input type="number" min="0" step="0.01" id="tr-amt-${a}" placeholder="Amount $" aria-label="Amount"${ro()}>
        <input type="text" id="tr-note-${a}" placeholder="Note (optional)" aria-label="Note"${ro()}>
        <button class="btn small" type="button" data-act="tr-add" data-acct="${a}"${ro()}>Add</button></div>
      <p class="hint">Enter dates from your Robinhood statements or transfer history. Entered transfers replace the app's guesses, so Activity summary
        is exact for any date range. Anything not entered is still detected from cash that orders don't explain.</p>`;
  }

  function modelSleeves(model, cashPct = 0) {
    if (!model) return '<p class="hint">No model selected.</p>';
    // A model with its own cash line already adds up to 100% of the account; otherwise the portfolio's cash target comes off the top.
    const ownCash = U.CASH in U.flatModel(model), scale = ownCash ? 1 : 1 - cashPct;
    const rows = (model.sleeves || []).map((sl) => `<tr class="sleeve"><td colspan="4">${esc(sl.name)} <span class="muted">(${pct((+sl.weight || 0) / 100, 2)} of model)</span></td></tr>` +
      (sl.securities || []).map((s) => {
        const w = ((+sl.weight || 0) / 100) * ((+s.weight || 0) / 100);
        return `<tr><td class="sym">${esc(U.symLabel(s.symbol))}</td><td class="n">${pct((+s.weight || 0) / 100, 2)}</td><td class="n">${pct(w, 2)}</td><td class="n">${pct(w * scale, 2)}</td></tr>`;
      }).join("")).join("");
    const cash = !ownCash && cashPct > 0 ? `<tr class="sleeve"><td colspan="4">Cash (portfolio cash target)</td></tr><tr><td class="sym">Cash</td><td class="n">&ndash;</td><td class="n">&ndash;</td><td class="n">${pct(cashPct, 2)}</td></tr>` : "";
    const probs = U.modelProblems(model);
    return `<div class="scroll"><table><thead><tr><th>Security</th><th class="n">Weight in sleeve</th><th class="n">Weight in model</th><th class="n">Target % of account</th></tr></thead><tbody>${rows}${cash}</tbody></table></div>
      ${probs.length ? `<p class="warn-text">${probs.map(esc).join(" ")}</p>` : ""}`;
  }

  // Reporting targets and benchmarks with date windows, for a portfolio ("pf") or an account ("acct").
  function reportingEditor(scope, rawId, doc, emptyTarget) {
    const id = esc(rawId), b = (path, t) => `data-bind="${scope}:${id}:${path}" data-type="${t}" id="${scope}-${id}-${path.replace(/\./g, "-")}"${ro()}`;
    const modelName = (mid) => (Store.get("models", mid) || {}).name || "Deleted model";
    const benchName = (mid) => { const m = Store.get("models", mid); return m ? (m.benchmark && m.benchmark.name) || `${m.name} (no benchmark set)` : "Deleted model"; };
    const windowRows = (list, field, nameOf) => (list || []).map((w, i) => `<tr><td>${esc(nameOf(w.model_id))}</td>
        <td><input type="date" ${b(`${field}.${i}.start`, "date")} value="${esc(w.start || "")}" aria-label="Start date"></td>
        <td><input type="date" ${b(`${field}.${i}.end`, "date")} value="${esc(w.end || "")}" aria-label="End date"></td>
        <td><button class="btn small danger" type="button" data-act="win-remove" data-scope="${scope}" data-pf="${id}" data-field="${field}" data-i="${i}"${ro()}>Remove</button></td></tr>`).join("");
    const modelPicker = (pid, kind, ph) => `<span class="picker"><input type="text" id="${pid}" class="model-picker-in" data-kind="${kind}" autocomplete="off" placeholder="${esc(ph)}" aria-label="${esc(ph)}"${ro()}><ul class="suggest" role="listbox" hidden></ul></span>`;
    const addWin = (field, kind, ph) => `<div class="addrow">${modelPicker(`${field}-new-${id}`, kind, ph)}
        <label>From <input type="date" id="${field}-start-${id}" aria-label="Start date"${ro()}></label><label>To <input type="date" id="${field}-end-${id}" aria-label="End date"${ro()}></label>
        <button class="btn small" type="button" data-act="win-add" data-scope="${scope}" data-pf="${id}" data-field="${field}"${ro()}>Add</button></div>`;
    return `<h4>Reporting target</h4>
      <div class="scroll"><table><thead><tr><th>Model</th><th>Start</th><th>End</th><th></th></tr></thead>
        <tbody>${windowRows(doc.reporting_targets, "reporting_targets", modelName) || `<tr><td colspan="4" class="muted">${esc(emptyTarget)}</td></tr>`}</tbody></table></div>
      ${addWin("reporting_targets", "model", "Search saved models")}
      <h4>Benchmark</h4>
      <div class="scroll"><table><thead><tr><th>Benchmark</th><th>Start</th><th>End</th><th></th></tr></thead>
        <tbody>${windowRows(doc.benchmarks, "benchmarks", benchName) || '<tr><td colspan="4" class="muted">None. Add a model benchmark to compare performance.</td></tr>'}</tbody></table></div>
      ${addWin("benchmarks", "bench", "Search model benchmarks")}
      <p class="hint">Dates are as of the close. A reporting target that starts on a trade date is compared from that day's close; a benchmark that
        starts then is measured from that close on, and the one it replaces still covers the trade date itself.</p>
      ${RH.paper ? `<p class="hint">Set automatically when demo orders fill, using the trade date: the first filled rebalance starts the reporting target and benchmark
        (and each account's performance start date); a later rebalance with a different model switches both to the new model. You can edit them here any time.</p>` : ""}`;
  }

  // Sections for a portfolio, shared by the portfolio page and the pop-out on a rebalance result.
  function portfolioSections(pf, opts = {}) {
    const id = esc(pf.id);
    const b = (path, t, extra = "") => `data-bind="pf:${id}:${path}" data-type="${t}" id="pf-${id}-${path.replace(/\./g, "-")}"${ro()} ${extra}`;
    const rhAccts = App.state.rhAccounts || [];
    const models = Store.all("models").sort((x, y) => x.name.localeCompare(y.name));
    const model = Store.get("models", pf.model_id);
    const sec = (key, title, body) => `<section class="dsec" id="${opts.prefix || "s"}-${key}"><h3>${title}</h3>${body}</section>`;

    const acctRows = rhAccts.filter((a) => pf.account_numbers.includes(a.id)).map((a) => {
      const bal = App.state.balances[a.id];
      const open = App.state.openAcct === a.id;
      return `<tr><td><button class="linkbtn count" type="button" data-act="acct-open" data-acct="${esc(a.id)}" aria-expanded="${open}">${mask(a.id)}</button></td>
        <td>${esc(a.name)}</td><td>${esc(a.type_label)}</td><td class="n">${bal ? money(bal.total) : '<span class="muted">...</span>'}</td>
        <td class="n">${bal ? money(U.setAsideNow(a.id, bal.total)) : ""}</td>
        <td><button class="btn small danger" type="button" data-act="pf-acct-remove" data-pf="${id}" data-acct="${esc(a.id)}"${ro()}>Remove</button></td></tr>` +
        (open ? `<tr class="editor"><td colspan="6">${accountPanel(a)}</td></tr>` : "");
    }).join("");
    const adding = App.state.addAcctFor === pf.id;
    const accounts = sec("accounts", "Accounts", `<div class="scroll"><table><thead><tr><th>Account #</th><th>Name</th><th>Tax status</th><th class="n">Market value</th><th class="n">Set-aside cash</th><th></th></tr></thead>
      <tbody>${acctRows || `<tr><td colspan="6" class="muted">${rhAccts.length || !App.state.rhAccounts ? (App.state.rhAccounts ? "No accounts in this portfolio yet." : "Loading accounts...") : "No Robinhood accounts found."}</td></tr>`}</tbody></table></div>
      ${adding ? `<div class="addrow"><span class="picker"><input type="text" id="acct-add-${id}" class="acct-picker-in" data-pf="${id}" autocomplete="off" placeholder="Search by account name or number" aria-label="Search accounts"${ro()}><ul class="suggest" role="listbox" hidden></ul></span>
          <button class="btn small primary" type="button" data-act="pf-acct-add" data-pf="${id}"${ro()}>Add</button><button class="btn small" type="button" data-act="pf-acct-cancel">Cancel</button></div>`
        : `<div class="addrow"><button class="btn small" type="button" data-act="pf-acct-open" data-pf="${id}"${ro()}>Add accounts</button></div>`}
      <p class="hint">Click an account number to open its details, trading, reporting and transactions. An account can belong to one portfolio.</p>`);

    const modelSec = sec("model", "Model", `<div class="addrow"><label>Model <select ${b("model_id", "str")} aria-label="Model">
        <option value="">Choose a model</option>${models.map((m) => `<option value="${esc(m.id)}"${m.id === pf.model_id ? " selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>
        ${model ? `<a class="linkbtn" href="#model-${esc(model.id)}">Edit model</a>` : `<a class="linkbtn" href="#models">Create a model</a>`}</div>
      ${model ? "" : '<p class="hint">Choose the target model this portfolio rebalances to.</p>'}`);

    const reporting = sec("reporting", "Reporting", reportingEditor("pf", pf.id, pf, "None. Reports use the portfolio's model.")
      + `<p class="hint">Blank dates mean open-ended. The reporting target sets the model used for Allocation vs Target and the sleeves in Performance.
        Benchmarks are defined on each model's page; when several cover different dates, Performance switches between them on those dates.</p>`);

    const notes = sec("notes", `Notes (${(pf.notes || []).length})`, `${(pf.notes || []).map((n, i) => `<div class="note"><div class="small muted">${esc(n.created_label || "")}</div>
        <textarea ${b(`notes.${i}.text`, "str")} rows="2" aria-label="Note">${esc(n.text)}</textarea>
        <button class="btn small danger" type="button" data-act="note-remove" data-pf="${id}" data-i="${i}"${ro()}>Remove</button></div>`).join("") || '<p class="hint">No notes yet.</p>'}
      <div class="addrow"><textarea id="note-new-${id}" rows="2" placeholder="Add a note about this portfolio" aria-label="New note"${ro()}></textarea>
        <button class="btn small" type="button" data-act="note-add" data-pf="${id}"${ro()}>Add note</button></div>
      <p class="hint">Notes appear before you submit orders for this portfolio.</p>`);

    const eqRows = (pf.equivalents || []).map((e, i) => `<tr><td class="sym">${esc(e.primary)}</td><td class="sym">${esc(e.alt)}</td>
      <td><label class="toggle"><input type="checkbox" ${b(`equivalents.${i}.alt_if_held`, "bool")}${e.alt_if_held ? " checked" : ""}> Alt if held</label></td>
      <td><button class="btn small danger" type="button" data-act="eq-remove" data-pf="${id}" data-i="${i}"${ro()}>Remove</button></td></tr>`).join("");
    const equivalents = sec("equivalents", "Equivalencies", `<div class="scroll"><table><thead><tr><th>Model security</th><th>Equivalent</th><th>Buy rule</th><th></th></tr></thead>
      <tbody>${eqRows || '<tr><td colspan="4" class="muted">No equivalencies yet.</td></tr>'}</tbody></table></div>
      <div class="addrow">${picker(`eq-p-${id}`, "Model security")}<span>&rarr;</span>${picker(`eq-a-${id}`, "Equivalent")}
        <label class="toggle"><input type="checkbox" id="eq-h-${id}"${ro()}> Alt if held</label>
        <button class="btn small" type="button" data-act="eq-add" data-pf="${id}"${ro()}>Add</button></div>
      <p class="hint">Type part of a ticker (V, VE...) and pick from Robinhood's suggestions. An equivalent counts toward the model security's target;
        with Alt if held ticked it's bought when the model security can't be.</p>`);

    const actions = [["alternative", "Buy alternative security"], ["cash", "Leave in cash"], ["prorate", "Pro-rate across other model securities"]];
    const rsRows = (pf.restrictions || []).map((r, i) => {
      const nb = r.type === "never_buy";
      return `<tr><td class="sym">${esc(r.symbol)}</td>
        <td><select ${b(`restrictions.${i}.type`, "str")} aria-label="Restriction"><option value="never_buy"${nb ? " selected" : ""}>Never buy</option><option value="never_sell"${nb ? "" : " selected"}>Never sell</option></select></td>
        <td>${nb ? `<select ${b(`restrictions.${i}.action`, "str")} aria-label="If never buy">${actions.map(([v, l]) => `<option value="${v}"${(r.action || "prorate") === v ? " selected" : ""}>${l}</option>`).join("")}</select>
          ${r.action === "alternative" ? `<div class="addrow">${picker(`rs-alt-${id}-${i}`, "Alternative", `data-alt-for="${id}:${i}" value="${esc(r.alternative || "")}"`)}
            <button class="btn small" type="button" data-act="rs-alt" data-pf="${id}" data-i="${i}"${ro()}>Set</button></div>
            ${r.alternative ? `<div class="small">Buys <b>${esc(r.alternative)}</b> instead</div>` : '<div class="warn-text">Choose the alternative security.</div>'}` : ""}` : '<span class="muted">&ndash;</span>'}</td>
        <td><input type="text" class="note-in" ${b(`restrictions.${i}.note`, "str")} value="${esc(r.note || "")}" placeholder="Note" aria-label="Note"></td>
        <td><button class="btn small danger" type="button" data-act="rs-remove" data-pf="${id}" data-i="${i}"${ro()}>Remove</button></td></tr>`;
    }).join("");
    const restrictions = sec("restrictions", `Restrictions (${(pf.restrictions || []).length})`, `<div class="scroll"><table><thead><tr><th>Security</th><th>Restriction</th><th>If never buy</th><th>Note</th><th></th></tr></thead>
      <tbody>${rsRows || '<tr><td colspan="5" class="muted">No restrictions yet.</td></tr>'}</tbody></table></div>
      <div class="addrow">${picker(`rs-s-${id}`, "Security")}<select id="rs-t-${id}" aria-label="Restriction type"${ro()}><option value="never_buy">Never buy</option><option value="never_sell">Never sell</option></select>
        <button class="btn small" type="button" data-act="rs-add" data-pf="${id}"${ro()}>Add</button></div>`);

    const acctOpts = (sel) => [["*", "All accounts"], ...rhAccts.filter((a) => pf.account_numbers.includes(a.id)).map((a) => [a.id, `${a.name} ${maskText(a.id)}`])]
      .map(([v, l]) => `<option value="${esc(v)}"${sel === v ? " selected" : ""}>${esc(l)}</option>`).join("");
    const glRows = (pf.gain_limits || []).map((g, i) => `<tr><td><select ${b(`gain_limits.${i}.account`, "str")} aria-label="Account">${acctOpts(g.account || "*")}</select></td>
      ${["max_short_term", "max_long_term", "max_total"].map((f) => `<td><input type="number" min="0" step="1" ${b(`gain_limits.${i}.${f}`, "numnull")} value="${g[f] ?? ""}" placeholder="No limit" aria-label="${f.replace(/_/g, " ")}"></td>`).join("")}
      <td><button class="btn small danger" type="button" data-act="gl-remove" data-pf="${id}" data-i="${i}"${ro()}>Remove</button></td></tr>`).join("");
    const gains = sec("gains", "Capital gain limits", `<div class="scroll"><table><thead><tr><th>Account</th><th>Max short-term $</th><th>Max long-term $</th><th>Max total $</th><th></th></tr></thead>
      <tbody>${glRows || '<tr><td colspan="5" class="muted">No limits.</td></tr>'}</tbody></table></div>
      <div class="addrow"><button class="btn small" type="button" data-act="gl-add" data-pf="${id}"${ro()}>Add limit</button>
      <span class="hint">Most net gain one rebalance may realize. Losses in the same rebalance offset gains. Taxable accounts only.</span></div>`);

    const settings = sec("settings", "Rebalance settings", `<p class="hint">Rebalance settings apply to every portfolio. Change them in <a href="#settings">Settings &gt; Rebalance</a> (the gear at the top right).</p>`);

    const all = { accounts, model: modelSec, reporting, notes, equivalents, restrictions, gains, settings };
    const order = opts.only || ["accounts", "model", "reporting", "notes", "equivalents", "restrictions", "gains"];
    return order.map((k) => all[k]).join("");
  }

  // ---- Home ----------------------------------------------------------------
  function home() {
    const pfs = Store.all("portfolios").sort((a, b) => a.name.localeCompare(b.name));
    const A = App.state.analysis;
    if (!pfs.length) return `<div class="page-head"><h1>Home</h1></div>
      <section class="card empty-state"><h2>Set up your first portfolio</h2><p>1. Create a model with its target weights. 2. Create a portfolio, pick its accounts and model. 3. Run a rebalance.</p>
      <div class="addrow"><a class="btn primary" href="#models">Create a model</a><a class="btn" href="#portfolios">Create a portfolio</a></div></section>`;
    let mv = 0, cash = 0, inTol = 0, ready = 0, oob = 0, cashOut = 0;
    const classMix = {}, typeMix = {};
    const rows = pfs.map((pf) => {
      const a = A[pf.id];
      const last = Store.all("results").filter((r) => r.portfolio_id === pf.id).sort((x, y) => (y.created > x.created ? 1 : -1))[0];
      let cells = `<td colspan="5" class="muted">${!a ? "Loading..." : a.error ? esc(a.error) : ""}</td>`;
      if (a && a.data) {
        const d = a.data;
        ready++; mv += d.total; const c = Object.values(d.cash).reduce((s, v) => s + v, 0); cash += c;
        const out = d.rows.filter((r) => r.out).length; oob += out;
        const maxDrift = Math.max(0, ...d.rows.filter((r) => r.modeled).map((r) => Math.abs(r.drift)));
        const acctOut = Object.keys(d.value).filter((id) => U.cashState(d.cash[id], d.cashTarget[id], U.rset().cash_band * d.value[id], d.setAside[id]) !== "ok").length;
        cashOut += acctOut;
        if (!out && !acctOut) inTol++;
        for (const [k, v] of Object.entries(d.classes.current || {})) classMix[k] = (classMix[k] || 0) + v;
        classMix.Cash = (classMix.Cash || 0) + c;
        for (const ac of a.accounts) typeMix[ac.type] = (typeMix[ac.type] || 0) + ac.total;
        cells = `<td class="n">${money(d.total)}</td><td class="n">${pct(d.total ? c / d.total : 0, 1)}</td><td class="n">${pct(maxDrift, 2)}</td>
          <td>${out ? `<span class="pill oob">${out} out of band</span>` : '<span class="pill ok">In band</span>'}</td>
          <td>${acctOut ? `<span class="pill oob">${acctOut} out of range</span>` : '<span class="pill ok">In range</span>'}</td>`;
      }
      return `<tr><td><a href="#portfolio-${esc(pf.id)}">${esc(pf.name)}</a></td><td>${esc((Store.get("models", pf.model_id) || {}).name || "No model")}</td>${cells}
        <td>${last ? `<a href="#result-${esc(last.id)}">${esc(last.kind_label)}</a> <span class="pill ${last.status === "submitted" ? "ok" : last.status === "refused" ? "oob" : "na"}">${esc(last.status)}</span>` : '<span class="muted">None</span>'}</td>
        <td><button class="btn small" type="button" data-act="run-menu" data-pf="${esc(pf.id)}">Rebalance</button></td></tr>`;
    }).join("");
    const classItems = colorize(Object.entries(classMix).map(([k, v]) => ({ label: k, value: v, isCash: k === "Cash" })).sort((x, y) => y.value - x.value));
    const typeItems = colorize(Object.entries(typeMix).map(([k, v]) => ({ label: RebalEngine.TYPE_LABEL[k] || k, value: v })));
    const recent = Store.all("results").sort((x, y) => (y.created > x.created ? 1 : -1)).slice(0, 8);
    return `<div class="page-head"><h1>Home</h1><button class="btn" type="button" data-act="refresh-home">Refresh</button>
        <span class="muted small">${ready} of ${pfs.length} portfolios loaded${App.state.analysisAt ? " &middot; " + esc(App.state.analysisAt) : ""}</span></div>
      <div class="kpis">
        <div><span>Total market value</span><b>${money(mv)}</b></div>
        <div><span>Cash</span><b>${money(cash)}</b><small>${pct(mv ? cash / mv : 0, 1)} of value</small></div>
        <div><span>Portfolios in tolerance</span><b>${inTol} of ${ready}</b></div>
        <div><span>Positions out of band</span><b>${oob}</b></div>
        <div><span>Accounts with cash out of range</span><b>${cashOut}</b></div>
        <div><span>Rebalances awaiting a decision</span><b>${Store.all("results").filter((r) => r.status === "proposed").length}</b></div>
      </div>
      <div class="three">
        <section class="card"><header><h2>Asset class mix</h2></header><div class="body chart-row">${donut(classItems, 180, "Asset class mix")}${legend(classItems, mv)}</div></section>
        <section class="card"><header><h2>Value by account type</h2></header><div class="body chart-row">${donut(typeItems, 180, "Value by account type")}${legend(typeItems, mv)}</div></section>
        ${openOrdersCard()}
      </div>
      <section class="card"><header><h2>Portfolios</h2></header><div class="body"><div class="scroll"><table>
        <thead><tr><th>Portfolio</th><th>Model</th><th class="n">Market value</th><th class="n">Cash %</th><th class="n">Largest drift</th><th>Positions</th><th>Cash</th><th>Last rebalance</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div></div></section>
      <section class="card"><header><h2>Recent rebalances</h2></header><div class="body">${recent.length ? `<div class="scroll"><table><thead><tr><th>When</th><th>Portfolio</th><th>Type</th><th class="n">Orders</th><th>Status</th></tr></thead><tbody>
        ${recent.map((r) => `<tr><td><a href="#result-${esc(r.id)}">${esc(r.created_label)}</a></td><td>${esc(r.portfolio_name)}</td><td>${esc(r.kind_label)}</td><td class="n">${(r.view.orders || []).length}</td><td>${statusPill(r.status)}</td></tr>`).join("")}
        </tbody></table></div>` : '<p class="hint">No rebalances yet. <a href="#rebalance">Create a rebalance</a>.</p>'}</div></section>`;
  }

  // ---- Accounts ------------------------------------------------------------
  function accounts() {
    const list = App.state.rhAccounts;
    if (!list) return `<div class="page-head"><h1>Accounts</h1></div><p class="hint">Loading accounts from Robinhood...</p>`;
    const opened = list.find((a) => a.id === App.state.openAcct);
    if (opened) return accountPage(opened);
    const pfOf = (id) => Store.all("portfolios").filter((p) => p.account_numbers.includes(id));
    const rows = list.map((a) => {
      const bal = App.state.balances[a.id], open = App.state.openAcct === a.id;
      const sa = bal ? U.setAsideNow(a.id, bal.total) : 0;
      const nameCell = acctNameEdit(a);
      return `<tr><td><button class="linkbtn count" type="button" data-act="acct-open" data-acct="${esc(a.id)}" aria-expanded="${open}">${mask(a.id)}</button></td>
        <td>${nameCell}</td><td>${esc(a.type_label)}</td>
        <td class="n">${bal ? money(bal.total) : "..."}</td><td class="n">${bal ? money(bal.cash) : ""}</td><td class="n">${bal ? money(sa) : ""}</td>
        <td class="n">${bal ? money(availableCash(bal, sa)) + (bal.unsettled > 0.005 ? `<div class="muted small">${money(bal.unsettled)} settles ${esc(Charts.fmtDate(bal.settles))}</div>` : "") : ""}</td><td class="n">${bal && bal.total ? pct(bal.cash / bal.total, 1) : ""}</td>
        <td>${pfOf(a.id).map((p) => `<a href="#portfolio-${esc(p.id)}">${esc(p.name)}</a>`).join(", ") || '<span class="muted">None</span>'}</td></tr>`;
    }).join("");
    return `<div class="page-head"><h1>Accounts</h1><span class="muted small">${list.length} Robinhood account(s)</span></div>
      <section class="card"><div class="body"><div class="scroll"><table>
        <thead><tr><th>Account #</th><th>Name</th><th>Tax status</th><th class="n">Market value</th><th class="n">Cash</th><th class="n">Set-aside cash</th><th class="n">Available cash</th><th class="n">Cash % of MV</th><th>Portfolio</th></tr></thead>
        <tbody>${rows}</tbody></table></div><p class="hint">Click an account number to open it: Account Details, Trading (set-aside cash) and Transactions. Click the pencil to rename an account; the new name shows everywhere in the app (Robinhood keeps its own name).</p></div></section>`;
  }

  // ---- Unassigned accounts -------------------------------------------------
  function unassigned() {
    const list = App.state.rhAccounts;
    const head = '<div class="page-head"><h1>Unassigned Accounts</h1></div>';
    if (!list) return head + '<p class="hint">Loading accounts from Robinhood...</p>';
    const assigned = new Set(Store.all("portfolios").flatMap((p) => p.account_numbers));
    const rows = list.filter((a) => !assigned.has(a.id));
    const sel = App.state.uaSel;
    for (const id of [...sel]) if (!rows.some((a) => a.id === id)) sel.delete(id);
    if (!rows.length) return head + `<section class="card empty-state"><h2>Every account is in a portfolio</h2>
      <p>Accounts you remove from a portfolio will show up here.</p><div class="addrow"><a class="btn" href="#portfolios">See portfolios</a></div></section>`;
    const pfCount = Store.all("portfolios").length;
    const all = rows.every((a) => sel.has(a.id)), none = !sel.size, mode = pfCount ? App.state.assignMode : "new";
    const table = rows.map((a) => {
      const bal = App.state.balances[a.id];
      return `<tr><td><input type="checkbox" data-act="ua-check" data-acct="${esc(a.id)}" aria-label="Select ${esc(a.name)} ${esc(maskText(a.id))}"${sel.has(a.id) ? " checked" : ""}></td>
        <td>${mask(a.id)}</td><td>${esc(a.name)}</td><td>${esc(a.type_label)}</td>
        <td class="n">${bal ? money(bal.total) : "..."}</td><td class="n">${bal ? money(bal.cash) : ""}</td></tr>`;
    }).join("");
    return head + `<section class="card"><div class="body">
        <div class="scroll"><table><thead><tr><th><input type="checkbox" data-act="ua-all" aria-label="Select all accounts"${all ? " checked" : ""}></th>
          <th>Account #</th><th>Name</th><th>Tax status</th><th class="n">Market value</th><th class="n">Cash</th></tr></thead><tbody>${table}</tbody></table></div>
        <p class="hint">${rows.length} account(s) aren't in a portfolio. Tick the ones to assign, then choose where they go.</p></div></section>
      <section class="card"><header><h2>Assign ${sel.size ? `${sel.size} selected account${sel.size > 1 ? "s" : ""}` : "selected accounts"}</h2></header><div class="body">
        <div class="assign-opts" role="radiogroup" aria-label="Where to assign">
          <div class="assign-opt${mode === "existing" ? " on" : ""}"><label><input type="radio" name="assign-mode" value="existing" data-act="ua-mode"${mode === "existing" ? " checked" : ""}${pfCount ? "" : " disabled"}>
            <b>Add to an existing portfolio</b></label>
            <span class="addrow"><span class="picker"><input type="text" id="assign-pf" class="pf-picker-in" autocomplete="off" placeholder="${pfCount ? "Search portfolios" : "No portfolios yet"}" aria-label="Search portfolios" value="${esc(App.state.assignPfName || "")}"${pfCount && mode === "existing" ? "" : " disabled"}><ul class="suggest" role="listbox" hidden></ul></span>
              <button class="btn primary small" type="button" data-act="ua-assign-existing"${none || mode !== "existing" || ro() ? " disabled" : ""}>Add accounts</button></span></div>
          <div class="assign-opt${mode === "new" ? " on" : ""}"><label><input type="radio" name="assign-mode" value="new" data-act="ua-mode"${mode === "new" ? " checked" : ""}>
            <b>Create a new portfolio</b></label>
            <span class="addrow"><input type="text" id="assign-new-name" placeholder="New portfolio name" aria-label="New portfolio name"${mode === "new" ? "" : " disabled"}>
              <button class="btn primary small" type="button" data-act="ua-assign-new"${none || mode !== "new" || ro() ? " disabled" : ""}>Create and add accounts</button></span></div>
        </div>${none ? '<p class="hint">Tick at least one account above.</p>' : ""}</div></section>`;
  }

  // ---- Portfolios ----------------------------------------------------------
  function portfolios() {
    const pfs = Store.all("portfolios").sort((a, b) => a.name.localeCompare(b.name));
    return `<div class="page-head"><h1>Portfolios</h1><button class="btn primary" type="button" data-act="pf-new"${ro()}>New portfolio</button></div>
      <section class="card"><div class="body">${pfs.length ? `<div class="scroll"><table><thead><tr><th>Portfolio</th><th>Model</th><th class="n">Accounts</th><th class="n">Notes</th><th class="n">Restrictions</th><th></th></tr></thead><tbody>
        ${pfs.map((p) => `<tr><td><a href="#portfolio-${esc(p.id)}">${esc(p.name)}</a></td><td>${esc((Store.get("models", p.model_id) || {}).name || "No model")}</td>
          <td class="n">${p.account_numbers.length}</td><td class="n">${(p.notes || []).length}</td><td class="n">${(p.restrictions || []).length}</td>
          <td><button class="btn small" type="button" data-act="run-menu" data-pf="${esc(p.id)}">Rebalance</button></td></tr>`).join("")}</tbody></table></div>`
        : '<p class="hint">No portfolios yet. A portfolio groups accounts under one model.</p>'}</div></section>`;
  }
  // ---- Settings (gear): app-wide options, with a left menu like accounts and portfolios ----
  const SET_TABS = [["rebalance", "Rebalance"]];
  function settingsPage() {
    const tab = App.state.setTab || "rebalance", rs = U.rset(), dirty = !!App.state.setDraft;
    const b = (path, t) => `data-bind="set:rebalance:${path}" data-type="${t}" id="set-${path}"${ro()}`;
    const field = (label, path, t, step, suffix = "", help = "") => `<label class="fld"><span>${label}</span><span class="fld-in"><input type="number" min="0" step="${step}" ${b(path, t)}
      value="${t === "pct" ? +((rs[path] ?? 0) * 100).toFixed(4) : rs[path] ?? ""}">${suffix}</span>${help ? `<small class="muted">${help}</small>` : ""}</label>`;
    const bar = dirty ? `<div class="draft-bar" role="status"><span>You have unsaved changes to the rebalance settings.</span>
        <span class="draft-actions"><button class="btn" type="button" data-act="set-draft-cancel">Cancel</button>
        <button class="btn primary" type="button" data-act="set-draft-save">Save changes</button></span></div>` : "";
    const body = `${bar}<h2 class="sec-title">Rebalance</h2>
      <p class="hint">These apply to every portfolio's rebalances and reports.</p>
      <h4>Cash</h4><div class="grid-fields">
        ${field("Cash target (% of account)", "cash_target_pct", "pct", "0.1", "%", "Used when the model has no Cash (uninvested) line")}
        ${field("Cash range (&plusmn; % of MV)", "cash_band", "pct", "0.01", "%", "Cash is in range within this much of market value either side of the cash target")}</div>
      <h4>Tolerance bands</h4><div class="grid-fields">
        ${field("Position tolerance (&plusmn; pts)", "position_band", "pct", "0.1", "%")}
        ${field("Asset class tolerance (&plusmn; pts)", "class_band", "pct", "0.1", "%", "Also colors Allocation vs Target")}</div>
      <h4>Trades</h4><div class="grid-fields">
        ${field("Minimum trade ($)", "min_trade", "num", "1")}
        <label class="toggle"><input type="checkbox" ${b("fractional", "bool")}${rs.fractional !== false ? " checked" : ""}> Fractional shares</label>
        <label class="toggle" title="Off: holdings that aren't in the model are left alone and the model's weights apply to the rest of the portfolio"><input type="checkbox" ${b("sell_unmodeled", "bool")}${rs.sell_unmodeled !== false ? " checked" : ""}> Full rebalance sells holdings not in the model</label></div>
      <p class="hint">Never-sell restrictions still apply: a restricted holding is kept, and the model is spread across the rest.</p>
      <h4>Taxes</h4><div class="grid-fields">
        ${field("Short-term tax rate", "st_rate", "pct", "1", "%")}
        ${field("Long-term tax rate", "lt_rate", "pct", "1", "%")}
        <label class="fld"><span>Lot selection</span><select ${b("lot_method", "str")}>${[["min_tax", "Lowest tax"], ["hifo", "Highest cost first"], ["fifo", "Oldest first"]].map(([v, l]) => `<option value="${v}"${rs.lot_method === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="toggle"><input type="checkbox" ${b("block_st", "bool")}${rs.block_st !== false ? " checked" : ""}> Never sell short-term gains</label></div>
      <h4>Tax-loss harvesting</h4><div class="grid-fields">
        ${field("Harvest losses of at least ($)", "tlh_min_loss", "num", "10")}
        ${field("...and at least (% of cost)", "tlh_min_pct", "pct", "0.5", "%")}</div>`;
    return `<div class="page-head"><h1>Settings</h1></div>
      <div class="home-layout"><aside class="home-nav" aria-label="Settings menu"><div class="hn-block"><div class="hn-title">General settings</div></div>
          <nav class="hn-block acct-side">${SET_TABS.map(([k, l]) => `<button type="button" data-act="set-tab" data-tab="${k}" class="${tab === k ? "on" : ""}"${tab === k ? ' aria-current="true"' : ""}>${l}</button>`).join("")}</nav></aside>
        <section class="home-main"><section class="card"><div class="body">${body}</div></section></section></div>`;
  }

  // A portfolio page: a menu on the left, outside the main box, like an account's page.
  const PF_TABS = [["details", "Portfolio Details", ["accounts", "model"]], ["trading", "Trading", ["equivalents", "restrictions", "gains"]],
    ["reporting", "Reporting", ["reporting"]], ["notes", "Notes", ["notes"]]];
  function portfolioPage(id) {
    const d = App.state.pfDraft, pf = d && d.id === id ? d.doc : Store.get("portfolios", id);
    if (!pf) return `<p class="hint">That portfolio no longer exists. <a href="#portfolios">Back to portfolios</a></p>`;
    const tab = (App.state.pfTab || {})[id] || "details", cur = PF_TABS.find((t) => t[0] === tab) || PF_TABS[0];
    const bar = d && d.id === id ? `<div class="draft-bar" role="status"><span>You have unsaved changes to this portfolio.</span>
        <span class="draft-actions"><button class="btn" type="button" data-act="pf-draft-cancel">Cancel</button>
        <button class="btn primary" type="button" data-act="pf-draft-save">Save changes</button></span></div>` : "";
    return `${portfolioHead(pf)}
      <div class="home-layout"><aside class="home-nav" aria-label="Portfolio menu"><div class="hn-block"><div class="hn-title">Portfolio</div></div>
          <nav class="hn-block acct-side">${PF_TABS.map(([k, l]) => `<button type="button" data-act="pf-tab" data-pf="${esc(pf.id)}" data-tab="${k}" class="${cur[0] === k ? "on" : ""}"${cur[0] === k ? ' aria-current="true"' : ""}>${l}</button>`).join("")}</nav></aside>
        <section class="home-main"><section class="card stack">${bar ? `<div class="body">${bar}</div>` : ""}${portfolioSections(pf, { page: true, prefix: "p", only: cur[2] })}</section></section></div>`;
  }
  function portfolioHead(pf) {
    return `<div class="page-head"><a class="linkbtn" href="#portfolios">&larr; Portfolios</a>
        ${App.state.renaming === pf.id
          ? `<input class="title-edit" type="text" id="pf-rename-in" value="${esc(App.state.renameDraft)}" aria-label="Portfolio name">
             <button class="btn small primary" type="button" data-act="pf-rename-save" data-pf="${esc(pf.id)}">Save</button>
             <button class="btn small" type="button" data-act="pf-rename-cancel">Cancel</button>`
          : `<h1>${esc(pf.name)}</h1><button class="pen" type="button" data-act="pf-rename" data-pf="${esc(pf.id)}" aria-label="Edit portfolio name" title="Edit name"${ro()}>
               <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M13.6 2.6a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8L7.3 16.5 3 17.6l1.1-4.3L13.6 2.6Zm-1 2.6-7.1 7.1-.6 2.3 2.3-.6 7.1-7.1-1.7-1.7Z" fill="currentColor"/></svg></button>`}
        <button class="btn" type="button" data-act="run-menu" data-pf="${esc(pf.id)}">Rebalance</button>
        <button class="btn danger" type="button" data-act="pf-delete" data-pf="${esc(pf.id)}"${ro()}>Delete portfolio</button></div>`;
  }

  // ---- Models --------------------------------------------------------------
  function models() {
    const usedBy = (m) => Store.all("portfolios").filter((x) => x.model_id === m.id).map((x) => x.name).sort().join(", ");
    const COLS = [["name", "Model", "", (m) => m.name], ["sleeves", "Sleeves", "n", (m) => (m.sleeves || []).length],
      ["securities", "Securities", "n", (m) => Object.keys(U.modelSecurities(m)).length], ["status", "Status", "", (m) => (U.modelProblems(m).length ? "Needs attention" : "Ready")],
      ["used", "Used by", "", (m) => usedBy(m) || "￿"]]; // unused models sort after used ones
    const ms = sortRows("models", COLS, Store.all("models"));
    return `<div class="page-head"><h1>Models</h1>
        <button class="btn primary" type="button" data-act="model-new"${ro()}>New model</button>
        <label class="btn"${Store.readOnly ? ' aria-disabled="true"' : ""}>Upload models<input type="file" id="model-upload" accept=".xlsx,.xls,.csv" hidden${ro()}></label>
        <button class="btn" type="button" data-act="model-template">Download Excel template</button></div>
      <p class="hint">To add or change models, download the template (it's the Models export with every saved model), edit it in Excel (change weights, add rows,
        or add a column for a new model), then upload it. You'll see every change before anything is saved.</p>
      <section class="card"><div class="body">${ms.length ? `<div class="scroll"><table data-export-kind="models"><thead><tr>${sortHead("models", COLS)}</tr></thead><tbody>
        ${ms.map((m) => { const p = U.modelProblems(m), used = usedBy(m);
          return `<tr><td><a href="#model-${esc(m.id)}">${esc(m.name)}</a></td><td class="n">${(m.sleeves || []).length}</td><td class="n">${Object.keys(U.modelSecurities(m)).length}</td>
            <td>${p.length ? `<span class="pill oob" title="${esc(p.join(" "))}">Needs attention</span>` : '<span class="pill ok">Ready</span>'}</td>
            <td>${used ? esc(used) : '<span class="muted">None</span>'}</td></tr>`; }).join("")}</tbody></table></div>`
        : '<p class="hint">No models yet. Create one, or upload a spreadsheet with Ticker and Weight columns (and an optional Sleeve column).</p>'}</div></section>`;
  }
  function modelPage(id) {
    const m = Store.get("models", id);
    if (!m) return `<p class="hint">That model no longer exists. <a href="#models">Back to models</a></p>`;
    const mid = esc(m.id), b = (path, t) => `data-bind="model:${mid}:${path}" data-type="${t}" id="m-${mid}-${path.replace(/\./g, "-")}"${ro()}`;
    const open = App.state.openSleeves;
    const sleeves = (m.sleeves || []).map((sl, i) => {
      const sum = (sl.securities || []).reduce((s, x) => s + (+x.weight || 0), 0), isOpen = open.has(sl.id);
      return `<tr class="sleeve"><td><button class="caret" type="button" data-act="sleeve-toggle" data-sleeve="${esc(sl.id)}" aria-expanded="${isOpen}">${isOpen ? "&#9662;" : "&#9656;"}</button>
          <input type="text" ${b(`sleeves.${i}.name`, "str")} value="${esc(sl.name)}" aria-label="Sleeve name"></td>
        <td class="n"><input type="number" min="0" max="100" step="0.01" ${b(`sleeves.${i}.weight`, "num")} value="${+sl.weight || 0}" aria-label="Sleeve weight">%</td>
        <td class="n ${Math.abs(sum - 100) > 0.01 ? "neg" : ""}">${sum.toFixed(2)}% of sleeve assigned</td><td>${sleeveBenchmark(m, sl, i)}</td>
        <td><button class="btn small danger" type="button" data-act="sleeve-remove" data-model="${mid}" data-i="${i}"${ro()}>Remove sleeve</button></td></tr>` +
        (isOpen ? (sl.securities || []).map((s, j) => `<tr><td class="indent sym">${esc(U.symLabel(s.symbol))}</td>
          <td class="n"><input type="number" min="0" max="100" step="0.01" ${b(`sleeves.${i}.securities.${j}.weight`, "num")} value="${+s.weight || 0}" aria-label="Weight of ${esc(s.symbol)}">%</td>
          <td class="n muted">${pct(((+sl.weight || 0) / 100) * ((+s.weight || 0) / 100), 2)} of model</td>
          <td>${U.isCash(s.symbol) ? '<span class="muted">Cash, kept uninvested in each account</span>'
            : `<select data-bind="sec:${esc(s.symbol)}:asset_class" data-type="str" id="cls-${mid}-${i}-${j}" aria-label="Asset class"${ro()}>${["Unclassified", ...CLASSES].map((c) => `<option${U.classOf(s.symbol) === c ? " selected" : ""}>${c}</option>`).join("")}</select>`}</td>
          <td><button class="btn small danger" type="button" data-act="msec-remove" data-model="${mid}" data-i="${i}" data-j="${j}"${ro()}>Remove</button></td></tr>`).join("") +
          `<tr><td colspan="5" class="indent"><div class="addrow">${picker(`msec-${mid}-${i}`, "Add security or cash", 'data-allow-cash="1"')}
            <input type="number" min="0" max="100" step="0.01" id="msec-w-${mid}-${i}" placeholder="Weight %" aria-label="Weight"${ro()}>
            <button class="btn small" type="button" data-act="msec-add" data-model="${mid}" data-i="${i}"${ro()}>Add</button></div></td></tr>` : "");
    }).join("");
    const total = (m.sleeves || []).reduce((s, x) => s + (+x.weight || 0), 0), probs = U.modelProblems(m);
    return `<div class="page-head"><a class="linkbtn" href="#models">&larr; Models</a>
        <input class="title-in" type="text" ${b("name", "str")} value="${esc(m.name)}" aria-label="Model name">
        <button class="btn danger" type="button" data-act="model-delete" data-model="${mid}"${ro()}>Delete model</button></div>
      <section class="card"><div class="body">
        <div class="scroll"><table data-export-kind="model" data-model="${mid}"><thead><tr><th>Sleeve / security</th><th class="n">Weight</th><th class="n">Check</th><th>Sleeve benchmark / asset class</th><th></th></tr></thead>
          <tbody>${sleeves || '<tr><td colspan="5" class="muted">No sleeves yet.</td></tr>'}</tbody>
          <tfoot><tr><td>Total</td><td class="n ${Math.abs(total - 100) > 0.01 ? "neg" : ""}">${total.toFixed(2)}%</td><td colspan="3"></td></tr></tfoot></table></div>
        <div class="addrow"><input type="text" id="sleeve-new-${mid}" placeholder="New sleeve name" aria-label="New sleeve name"${ro()}>
          <button class="btn small" type="button" data-act="sleeve-add" data-model="${mid}"${ro()}>Add sleeve</button></div>
        ${probs.length ? `<p class="warn-text">${probs.map(esc).join(" ")}</p>` : '<p class="status-on">Weights add up. This model is ready to use.</p>'}
        <p class="hint">Sleeve weights are shares of the model; security weights are shares of their sleeve. Click a sleeve's arrow to show its securities.
          To keep part of the model in cash, search "cash" in a sleeve and pick <b>Cash (uninvested)</b>, not the ticker CASH (Pathward Financial).
          A rebalance then leaves that share of each account in cash instead of the portfolio's cash target.
          Asset classes are shared with the Securities page.</p></div></section>
      ${modelBenchmark(m)}`;
  }

  // ---- Benchmarks (on models) ------------------------------------------------
  const INDEX_OPTS = (sel) => History.INDEXES.map((x) => `<option value="${esc(x.proxy)}"${sel === x.proxy ? " selected" : ""}>${esc(x.name)} (${esc(x.proxy)})</option>`).join("");
  // A starting point based on the sleeve's name and holdings; the user decides.
  function suggestSleeveIndex(sl) {
    const t = `${sl.name} ${(sl.securities || []).map((s) => s.symbol + " " + U.classOf(s.symbol)).join(" ")}`.toLowerCase();
    const pick = (proxy) => History.INDEXES.find((x) => x.proxy === proxy);
    if (/emerging/.test(t)) return pick("IEMG");
    if (/international|intl|ex.?us|foreign|developed/.test(t)) return pick("IXUS");
    if (/global bond|world bond|global agg/.test(t)) return pick("BNDW");
    if (/bond|fixed income|aggregate/.test(t)) return pick("AGG");
    if (/cash|t-?bill|money market|sgov|bil\b|cash equivalent/.test(t)) return pick("SGOV");
    if (/gold|commodit|alternatives/.test(t)) return pick("GLDM");
    if (/real estate|reit/.test(t)) return pick("VNQ");
    if (/tech/.test(t)) return pick("XLK");
    if (/small/.test(t)) return pick("IWM");
    if (/domestic|us |u\.s\.|total market|equity/.test(t)) return pick("VTI");
    return null;
  }
  function sleeveBenchmark(m, sl, i) {
    const cur = sl.benchmark && sl.benchmark.components && sl.benchmark.components[0] ? sl.benchmark.components[0].proxy : "";
    const sug = !cur ? suggestSleeveIndex(sl) : null;
    return `<select data-act="sleeve-bench" data-model="${esc(m.id)}" data-i="${i}" id="sb-${esc(m.id)}-${i}" aria-label="Benchmark for ${esc(sl.name)}"${ro()}>
        <option value="">No sleeve benchmark</option>${INDEX_OPTS(cur)}</select>
      ${sug ? `<div class="small muted">Suggested: ${esc(sug.name)} <button class="linkbtn" type="button" data-act="sleeve-bench-use" data-model="${esc(m.id)}" data-i="${i}" data-proxy="${esc(sug.proxy)}"${ro()}>Use</button></div>` : ""}`;
  }
  function modelBenchmark(m) {
    const mid = esc(m.id), bm = m.benchmark;
    const rows = bm ? (bm.components || []).map((c, i) => { const ix = History.INDEXES.find((x) => x.proxy === c.proxy);
      return `<tr><td>${esc(c.name)}</td><td class="sym">${esc(c.proxy)}</td><td class="muted small">${esc(ix ? ix.note : "Custom ticker")}</td>
        <td class="n"><input type="number" min="0" max="100" step="0.01" data-bind="model:${mid}:benchmark.components.${i}.weight" data-type="num" id="bmw-${mid}-${i}" value="${+c.weight || 0}" aria-label="Weight"${ro()}>%</td>
        <td><button class="btn small danger" type="button" data-act="bm-remove" data-model="${mid}" data-i="${i}"${ro()}>Remove</button></td></tr>`; }).join("") : "";
    const tot = bm ? (bm.components || []).reduce((s, c) => s + (+c.weight || 0), 0) : 0;
    return `<section class="card"><header><h2>Benchmark</h2></header><div class="body">
      ${bm ? `<label class="fld narrow"><span>Benchmark name</span><input type="text" data-bind="model:${mid}:benchmark.name" data-type="str" id="bmn-${mid}" value="${esc(bm.name)}"${ro()}></label>
        <div class="scroll"><table><thead><tr><th>Index</th><th>Tracked with</th><th>About the ETF</th><th class="n">Weight</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="muted">Add at least one index.</td></tr>'}</tbody>
          <tfoot><tr><td colspan="3">Total</td><td class="n ${Math.abs(tot - 100) > 0.01 ? "neg" : ""}">${tot.toFixed(2)}%</td><td></td></tr></tfoot></table></div>
        <div class="addrow"><select id="bm-idx-${mid}" aria-label="Index"${ro()}>${INDEX_OPTS("")}<option value="__custom">Custom ticker...</option></select>
          ${picker(`bm-custom-${mid}`, "Custom ticker")}
          <input type="number" min="0" max="100" step="0.01" id="bm-w-${mid}" placeholder="Weight %" aria-label="Weight"${ro()}>
          <button class="btn small" type="button" data-act="bm-add" data-model="${mid}"${ro()}>Add index</button></div>`
        : `<p class="hint">No benchmark yet.</p><div class="addrow"><button class="btn small primary" type="button" data-act="bm-create" data-model="${mid}"${ro()}>Create "${esc(m.name)} Benchmark"</button></div>`}
      <p class="hint">Portfolios using this model can add this benchmark under Portfolios &gt; Reporting. Robinhood doesn't carry MSCI or Bloomberg index data,
        so each index is tracked with a listed ETF that follows it (price returns). For a custom ticker, pick it in the search box.</p></div></section>`;
  }

  // ---- Securities ----------------------------------------------------------
  function securities() {
    const sel = App.state.secSelected, doc = sel ? Store.get("securities", sel) || { symbol: sel } : null, f = sel ? App.state.fund[sel] : null;
    const fmtNum = (v, d = 2) => (v === null || v === undefined || v === "" ? "Not applicable" : (+v).toLocaleString("en-US", { maximumFractionDigits: d }));
    const cashDetail = `<div class="sec-head"><h2>Cash (uninvested)</h2><span class="muted">Not a security</span></div>
      <div class="grid-fields"><label class="fld"><span>Asset class</span><select id="sec-cls" disabled><option selected>Cash</option></select></label></div>
      <p class="hint">Uninvested cash is always the <b>Cash</b> asset class, so there's nothing to set or save here. Add it to a model sleeve by searching
        "cash" there and picking Cash (uninvested); a rebalance keeps that share of each account in cash. Equivalencies and tax-loss pairs don't apply to cash.</p>`;
    const detail = !sel ? '<p class="hint">Search for any security, held or not, to see its details and set its asset class, asset location, trade minimums, equivalencies and tax-loss pairs.</p>' : U.isCash(sel) ? cashDetail : `
      <div class="sec-head"><h2>${esc(sel)}</h2><span class="muted">${esc(doc.name || (f && f.name) || "")}</span></div>
      ${f === undefined ? '<p class="hint">Loading details from Robinhood...</p>' : f && f.error ? `<p class="warn-text">${esc(f.error)}</p>` : f ? `<dl class="facts">
        <div><dt>Sector</dt><dd>${esc(f.sector || "Not applicable")}</dd></div><div><dt>Industry</dt><dd>${esc(f.industry || "Not applicable")}</dd></div>
        <div><dt>Market cap</dt><dd>${f.market_cap ? "$" + fmtNum(f.market_cap / 1e9, 1) + "B" : "Not applicable"}</dd></div>
        <div><dt>P/E</dt><dd>${fmtNum(f.pe_ratio)}</dd></div><div><dt>Dividend yield</dt><dd>${f.dividend_yield ? fmtNum(f.dividend_yield) + "%" : "Not applicable"}</dd></div>
        <div><dt>52-week range</dt><dd>${f.low_52_weeks ? `$${fmtNum(f.low_52_weeks)} &ndash; $${fmtNum(f.high_52_weeks)}` : "Not applicable"}</dd></div>
        <div><dt>Distribution</dt><dd>${esc(f.distribution_frequency || "Not applicable")}</dd></div></dl>
        ${f.description ? `<p class="desc">${esc(f.description)}</p>` : ""}` : ""}
      <div class="grid-fields"><label class="fld"><span>Asset class</span><select data-bind="sec:${esc(sel)}:asset_class" data-type="str" id="sec-cls"${ro()}>
        ${["Unclassified", ...CLASSES].map((c) => `<option${(doc.asset_class || "Unclassified") === c ? " selected" : ""}>${c}</option>`).join("")}</select></label>
        ${!doc.asset_class && f && !f.error ? `<span class="hint">Suggested: <b>${esc(suggestClass(f))}</b> <button class="linkbtn" type="button" data-act="sec-suggest" data-sym="${esc(sel)}" data-cls="${esc(suggestClass(f))}">Use it</button></span>` : ""}
        ${(() => { const auto = U.profileOf(sel, (f && f.name) || doc.name || "", false);
          return `<label class="fld"><span>Geography</span><select data-bind="sec:${esc(sel)}:geography" data-type="str" id="sec-geo"${ro()}>
              <option value="">Auto (${esc(auto.geo)})</option>${U.GEOS.map((g) => `<option${doc.geography === g ? " selected" : ""}>${g}</option>`).join("")}</select></label>
            <label class="fld"><span>Cap-Style</span><select data-bind="sec:${esc(sel)}:cap_style" data-type="str" id="sec-style"${ro()}>
              <option value="">Auto (${esc(auto.style)})</option>${U.CAP_STYLES.map((s) => `<option${doc.cap_style === s ? " selected" : ""}>${s}</option>`).join("")}</select></label>`; })()}</div>
      <p class="hint">Geography and Cap-Style label this security in the Models export. Auto is a best guess from the fund's name; pick one to set it.</p>
      ${locationEditor(sel, doc)}
      <h3>Trade minimums</h3>
      <div class="grid-fields">
        <label class="fld"><span>Minimum buy ($)</span><input type="number" min="0" step="1" data-bind="sec:${esc(sel)}:min_buy" data-type="num" id="sec-min-buy" value="${+doc.min_buy > 0 ? +doc.min_buy : ""}" placeholder="${esc(String(U.rset().min_trade ?? 25))}"${ro()}></label>
        <label class="fld"><span>Minimum sell ($)</span><input type="number" min="0" step="1" data-bind="sec:${esc(sel)}:min_sell" data-type="num" id="sec-min-sell" value="${+doc.min_sell > 0 ? +doc.min_sell : ""}" placeholder="${esc(String(U.rset().min_trade ?? 25))}"${ro()}></label></div>
      <p class="hint">A rebalance skips a buy or sell of ${esc(sel)} smaller than these, in any account (the skipped orders are listed in the result's messages).
        Blank uses the app-wide minimum trade in Settings &gt; Rebalance (${money(U.rset().min_trade ?? 25)}); the larger of the two applies.</p>
      <h3>Global equivalencies</h3>
      <div class="scroll"><table><thead><tr><th>Equivalent</th><th>Buy rule</th><th></th></tr></thead><tbody>
        ${(doc.global_equivalents || []).map((g, i) => `<tr><td class="sym">${esc(g.symbol)}</td><td><label class="toggle"><input type="checkbox" data-bind="sec:${esc(sel)}:global_equivalents.${i}.alt_if_held" data-type="bool" id="ge-${i}"${g.alt_if_held ? " checked" : ""}${ro()}> Alt if held</label></td>
          <td><button class="btn small danger" type="button" data-act="ge-remove" data-sym="${esc(sel)}" data-i="${i}"${ro()}>Remove</button></td></tr>`).join("") || '<tr><td colspan="3" class="muted">None.</td></tr>'}</tbody></table></div>
      <div class="addrow">${picker("ge-new", "Equivalent security")}<button class="btn small" type="button" data-act="ge-add" data-sym="${esc(sel)}"${ro()}>Add</button></div>
      <p class="hint">Global equivalencies apply in every portfolio: holdings of the equivalent count toward ${esc(sel)}'s target.</p>
      <h3>Tax-loss harvesting pairs</h3>
      <div class="scroll"><table><thead><tr><th>Harvest into</th><th></th></tr></thead><tbody>
        ${(doc.tlh_pairs || []).map((p, i) => `<tr><td class="sym">${esc(p)}</td><td><button class="btn small danger" type="button" data-act="tlh-remove" data-sym="${esc(sel)}" data-i="${i}"${ro()}>Remove</button></td></tr>`).join("") || '<tr><td colspan="2" class="muted">None.</td></tr>'}</tbody></table></div>
      <div class="addrow">${picker("tlh-new", "Pair security")}<button class="btn small" type="button" data-act="tlh-add" data-sym="${esc(sel)}"${ro()}>Add</button></div>
      <p class="hint">A tax-loss harvesting rebalance sells ${esc(sel)} at a loss and buys its pair (and the other way round). Pick a pair that isn't substantially identical.</p>`;
    return `<div class="page-head"><h1>Securities</h1></div>
      <section class="card"><div class="body"><div class="addrow">${picker("sec-search", "Search Robinhood: ticker or name", 'data-allow-cash="1"')}<button class="btn" type="button" data-act="sec-open">Open</button></div></div></section>
      <section class="card"><div class="body">${detail}</div></section>`;
  }
  // Sortable tables: click a heading to sort by it; click again to reverse. cols: [key, label, class, value(row)].
  // Text sorts naturally, so "Model 4" comes before "Model 10".
  // A table can start sorted another way with def = { key, dir }; ties keep the list's own order.
  const sortState = (table, cols, def) => (App.state.sorts || {})[table] || def || { key: cols[0][0], dir: 1 };
  function sortHead(table, cols, def) {
    const st = sortState(table, cols, def);
    return cols.map(([k, l, cls]) => { const on = st.key === k;
      return `<th class="${cls}" aria-sort="${on ? (st.dir > 0 ? "ascending" : "descending") : "none"}"><button class="sort-btn" type="button" data-act="tbl-sort" data-table="${table}" data-key="${k}" data-dir="${on ? -st.dir : 1}">${l}<span class="sort-ic" aria-hidden="true">${on ? (st.dir > 0 ? "&#9650;" : "&#9660;") : "&#8597;"}</span></button></th>`; }).join("");
  }
  function sortRows(table, cols, list, def) {
    const st = sortState(table, cols, def), get = (cols.find((c) => c[0] === st.key) || cols[0])[3], first = cols[0][3];
    const cmp = (x, y) => (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true }));
    const idx = new Map(list.map((x, i) => [x, i]));
    return list.slice().sort((a, b) => (cmp(get(a), get(b)) || cmp(first(a), first(b))) * st.dir || idx.get(a) - idx.get(b));
  }
  // Asset location: one slider per account type, from Avoid (-2) to Strongly prefer (+2), telling a rebalance where
  // to buy this security first when more than one account has cash.
  const LOC_TYPES = [["taxable", "Taxable"], ["traditional_ira", "Traditional IRA"], ["roth_ira", "Roth IRA"]];
  const LOC_LABELS = { "-2": "Avoid", "-1": "Less preferred", 0: "Neutral", 1: "Preferred", 2: "Strongly preferred" };
  function locationEditor(sym, doc) {
    const loc = doc.location || {};
    return `<h3>Asset location</h3>
      <div class="loc-grid">${LOC_TYPES.map(([k, l]) => { const v = +loc[k] || 0;
        return `<label class="loc-row"><span class="loc-type">${l}</span>
          <input type="range" class="loc-range" min="-2" max="2" step="1" value="${v}" data-bind="sec:${esc(sym)}:location.${k}" data-type="pref" id="loc-${k}"
            aria-valuetext="${LOC_LABELS[v]}" list="loc-ticks"${ro()}>
          <output class="loc-val loc-${v < 0 ? "neg" : v > 0 ? "pos" : "zero"}" for="loc-${k}">${LOC_LABELS[v]}</output></label>`; }).join("")}
        <datalist id="loc-ticks"><option value="-2"></option><option value="-1"></option><option value="0"></option><option value="1"></option><option value="2"></option></datalist>
        <div class="loc-scale" aria-hidden="true"><span></span><span>Avoid</span><span>Neutral</span><span>Prefer</span><span></span></div></div>
      <p class="hint">When a rebalance buys ${esc(sym)} and more than one account in the portfolio has cash, it buys in the most preferred account type first,
        then in accounts that already hold it, then where there's the most cash. "Avoid" only means last choice: it's still bought there if no other account has cash.</p>`;
  }
  function suggestClass(f) {
    const t = `${f.description || ""} ${f.industry || ""} ${f.sector || ""}`.toLowerCase();
    if (/bond|treasur|fixed income|municipal|credit|aggregate/.test(t)) return "Fixed Income";
    if (/money market|t-bill|ultra.?short/.test(t)) return "Cash Equivalent";
    if (/real estate|reit/.test(t)) return "Real Estate";
    if (/gold|silver|commodit|bitcoin|crypto|futures/.test(t)) return "Alternatives";
    return "Equity";
  }

  // ---- Create Rebalance ----------------------------------------------------
  const KINDS = [
    ["invest_cash", "Invest Cash", "Buy orders only: invests cash above each account's set-aside plus cash target."],
    ["generate_cash", "Generate Cash", "Sell orders only: raises cash where an account is below its set-aside plus cash target."],
    ["full", "Full Rebalance", "Buys and sells to bring positions back to target."],
    ["manual", "Manual Adjustment", "Proposes no trades. Opens a result where you enter buys and sells yourself."],
    ["tlh", "Tax-Loss Harvesting", "Sells positions at a loss and buys their tax-loss harvesting pair from Securities."],
  ];
  function readiness(p) {
    if (!p.account_numbers.length) return "No accounts";
    const m = Store.get("models", p.model_id);
    if (!m) return "No model";
    return U.modelProblems(m).length ? "Model needs attention" : "";
  }
  // The name a multiple rebalance gets unless the user types one.
  const defaultBatchName = (kind, n) => `${(KINDS.find((x) => x[0] === kind) || KINDS[0])[1]}: ${n} portfolios, ${U.nowStamp()}`;
  function createRebalance() {
    const pfCount = Store.all("portfolios").length;
    const sel = App.state.rbSel, kind = App.state.rbKind, label = (KINDS.find((x) => x[0] === kind) || KINDS[0])[1];
    for (const id of [...sel]) if (!Store.get("portfolios", id)) sel.delete(id);
    const chosen = [...sel].map((id) => Store.get("portfolios", id)).sort((a, b) => a.name.localeCompare(b.name));
    const blocked = chosen.filter((p) => readiness(p));
    const rows = chosen.map((p) => {
      const why = readiness(p), m = Store.get("models", p.model_id);
      return `<tr><td><a href="#portfolio-${esc(p.id)}">${esc(p.name)}</a></td><td>${esc(m ? m.name : "None")}</td><td class="n">${p.account_numbers.length}</td>
        <td>${why ? `<span class="pill oob">${esc(why)}</span>` : '<span class="pill ok">Ready</span>'}</td>
        <td><button class="btn small danger" type="button" data-act="rb-remove" data-pf="${esc(p.id)}">Remove</button></td></tr>`;
    }).join("");
    const multi = chosen.length > 1;
    return `<div class="page-head"><h1>Create Rebalance</h1><a class="linkbtn" href="#results">Rebalance Results</a></div>
      <section class="card"><header><h2>1. Rebalance type</h2></header><div class="body">
        <label class="fld narrow"><span>Type</span><select id="rb-kind" data-act="rb-kind" aria-describedby="rb-kind-desc">
          ${KINDS.map(([k, l]) => `<option value="${k}"${k === kind ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <p class="hint" id="rb-kind-desc">${esc((KINDS.find((x) => x[0] === kind) || KINDS[0])[2])}</p></div></section>
      <section class="card"><header><h2>2. Portfolios to rebalance</h2></header><div class="body">
        ${pfCount ? `<div class="addrow"><span class="picker"><input type="text" id="rb-pf-search" class="rbpf-picker-in" autocomplete="off" placeholder="Search portfolios to add" aria-label="Search portfolios to add"><ul class="suggest" role="listbox" hidden></ul></span>
            <span class="hint">Pick a portfolio to add it. Add more than one for a multiple rebalance.</span></div>
          ${chosen.length ? `<div class="scroll"><table><thead><tr><th>Portfolio</th><th>Model</th><th class="n">Accounts</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="hint">No portfolios added yet.</p>'}`
          : '<p class="hint">No portfolios yet. <a href="#portfolios">Create one</a> or assign accounts from <a href="#unassigned">Unassigned Accounts</a>.</p>'}</div></section>
      ${multi ? `<section class="card"><header><h2>3. Name this multiple rebalance</h2></header><div class="body">
        <label class="fld narrow"><span>Name</span><input type="text" id="rb-name" maxlength="80" value="${esc(App.state.rbName || "")}" placeholder="${esc(defaultBatchName(kind, chosen.length))}"></label>
        <p class="hint">It shows in Rebalance Results as one item; open it to see each portfolio's result. Leave blank to use the name shown.</p></div></section>` : ""}
      <div class="addrow"><button class="btn primary" type="button" data-act="rb-run"${chosen.length && !blocked.length ? "" : " disabled"}>Create ${esc(label)} for ${chosen.length} portfolio${chosen.length === 1 ? "" : "s"}</button>
        <span class="hint">${blocked.length ? `Fix or remove ${blocked.map((p) => esc(p.name)).join(", ")} first.` : "Proposed trades open in Rebalance Results for review. Nothing is sent to a brokerage."}</span></div>`;
  }

  // ---- Rebalance Results ---------------------------------------------------
  // A multiple rebalance's results, in the order they were run (missing ones were deleted).
  const batchResults = (b) => (b.result_ids || []).map((id) => Store.get("results", id)).filter(Boolean);
  const statusPill = (s) => `<span class="pill ${s === "submitted" ? "ok" : s === "approved" ? "appr" : s === "refused" ? "oob" : "na"}">${esc(s)}</span>`;
  const resultRow = (r, fresh, first) => `<tr class="${fresh.has(r.id) ? "fresh" : ""}"><td><a href="#result-${esc(r.id)}">${esc(first || r.created_label)}</a>${fresh.has(r.id) ? ' <span class="pill na">New</span>' : ""}</td><td>${esc(r.portfolio_name)}</td><td>${esc(r.kind_label)}</td>
    <td class="n">${(r.view.orders || []).length}</td><td>${statusPill(r.status)}</td>
    <td><button class="btn small danger" type="button" data-act="result-delete" data-id="${esc(r.id)}"${ro()}>Delete</button></td></tr>`;
  function results() {
    const f = App.state.resFilter, fresh = App.state.freshResults;
    const all = Store.all("results").sort((x, y) => (y.created > x.created ? 1 : -1));
    const match = (r) => (!f.status || r.status === f.status) && (!f.pf || r.portfolio_id === f.pf);
    // Single results, and multiple rebalances as one row each (shown when any of their results match the filters).
    const batches = Store.all("batches").map((b) => ({ b, rs: batchResults(b) })).filter((x) => x.rs.length);
    const inBatch = new Set(batches.flatMap((x) => x.rs.map((r) => r.id)));
    const items = [...all.filter((r) => !inBatch.has(r.id) && match(r)).map((r) => ({ at: r.created, html: resultRow(r, fresh) })),
      ...batches.filter((x) => x.rs.some(match)).map(({ b, rs }) => {
        const counts = ["proposed", "approved", "submitted", "refused"].map((s) => [s, rs.filter((r) => r.status === s).length]).filter(([, n]) => n);
        return { at: b.created, html: `<tr class="batch-row${rs.some((r) => fresh.has(r.id)) ? " fresh" : ""}"><td><a href="#batch-${esc(b.id)}">${esc(b.created_label)}</a></td>
          <td><a href="#batch-${esc(b.id)}"><b>${esc(b.name)}</b></a> <span class="muted small">${rs.length} portfolios</span></td><td>${esc(b.kind_label)}</td>
          <td class="n">${rs.reduce((s, r) => s + (r.view.orders || []).length, 0)}</td><td>${counts.map(([s, n]) => `${statusPill(s)} <span class="small">${n}</span>`).join(" ")}</td>
          <td><button class="btn small danger" type="button" data-act="batch-delete" data-id="${esc(b.id)}"${ro()}>Delete</button></td></tr>` };
      })].sort((x, y) => (y.at > x.at ? 1 : -1));
    const pfIds = [...new Set(all.map((r) => r.portfolio_id))];
    const opt = (v, l, cur) => `<option value="${esc(v)}"${cur === v ? " selected" : ""}>${esc(l)}</option>`;
    return `<div class="page-head"><h1>Rebalance Results</h1><a class="btn primary" href="#rebalance">Create rebalance</a></div>
      <section class="card"><div class="body">
        ${all.length ? `<div class="addrow"><label>Portfolio <select id="res-pf">${opt("", "All portfolios", f.pf)}${pfIds.map((id) => opt(id, (all.find((r) => r.portfolio_id === id) || {}).portfolio_name || id, f.pf)).join("")}</select></label>
          <label>Status <select id="res-status">${opt("", "All", f.status)}${opt("proposed", "Proposed", f.status)}${opt("approved", "Approved", f.status)}${opt("submitted", "Submitted", f.status)}${opt("refused", "Refused", f.status)}</select></label>
          <span class="muted small">${items.length} shown</span></div>` : ""}
        ${items.length ? `<div class="scroll"><table><thead><tr><th>When</th><th>Portfolio</th><th>Type</th><th class="n">Orders</th><th>Status</th><th></th></tr></thead><tbody>
        ${items.map((x) => x.html).join("")}</tbody></table></div>
        <p class="hint">A multiple rebalance shows as one row; open it to see each portfolio's result.</p>`
        : `<p class="hint">${all.length ? "No results match these filters." : 'No rebalances yet. <a href="#rebalance">Create one</a>.'}</p>`}</div></section>`;
  }
  // ---- Orders: every filled demo order, by the day it was submitted ----------
  const etDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  function filledOrders() {
    return Store.all("results").filter((r) => r.paper && (r.paper.fills || []).length).flatMap((r) => {
      const name = (id) => ((r.view.accounts || []).find((a) => a.id === id) || {}).name || "Account";
      // A sell of every share the account held (as of the rebalance) is a "Sell all", whether the rebalance proposed it or you chose it.
      const held = (f) => ((r.view.positions || []).find((p) => p.account === f.account && p.symbol === f.symbol) || {}).shares || 0;
      return r.paper.fills.map((f, i) => { const at = f.submitted_at || r.decided_at || r.created;
        return { ...f, all: f.side === "sell" && (f.all || (held(f) > 0 && Math.abs(f.qty - held(f)) < 1e-6)), i, result: r.id, portfolio_id: r.portfolio_id, portfolio: r.portfolio_name,
          submitted: at, submitted_label: f.submitted_label || r.decided_label || r.created_label, day: etDay(at), trade_date: f.trade_date || r.paper.price_date, acctName: name(f.account) }; });
    });
  }
  // Approved orders waiting on the blotter (not yet submitted).
  function openOrders() {
    return Store.all("results").filter((r) => (r.blotter || []).some((o) => o.status === "open")).flatMap((r) => {
      const name = (id) => ((r.view.accounts || []).find((a) => a.id === id) || {}).name || "Account";
      return r.blotter.filter((o) => o.status === "open").map((o) => ({ ...o, result: r.id, portfolio_id: r.portfolio_id, portfolio: r.portfolio_name,
        approved: r.approved_at || r.decided_at, approved_label: r.approved_label || r.decided_label, acctName: name(o.account), amount: o.qty * (o.est_price || 0) }));
    });
  }
  const orderSide = (f) => (f.side === "buy" ? "Buy" : f.all ? "Sell all" : "Sell");
  const ORDER_COLS = [["account", "Account", "", (f) => f.acctName + f.account], ["symbol", "Symbol", "", (f) => f.symbol], ["order", "Order", "", orderSide],
    ["shares", "Shares", "n", (f) => f.qty], ["price", "Fill price", "n", (f) => f.price], ["amount", "Amount", "n", (f) => f.qty * f.price],
    ["rebal", "Rebal ID", "", (f) => f.result], ["submitted", "Submitted", "", (f) => f.submitted]];
  // Home: approved orders still waiting on the blotter, by portfolio.
  function openOrdersCard() {
    const open = openOrders(), by = new Map();
    for (const o of open) by.set(o.portfolio, (by.get(o.portfolio) || 0) + 1);
    const items = colorize([...by.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })));
    return `<section class="card"><header><h2>Open orders</h2></header><div class="body chart-row">
      ${donut(items, 180, "Open orders by portfolio", { text: String(open.length), label: open.length === 1 ? "open order" : "open orders" })}
      ${items.length ? `<table class="legend-t"><tbody>${items.map((it) => `<tr><td><span class="legend-sq" style="background:${it.color}"></span>${esc(it.label)}</td><td class="n">${it.value}</td></tr>`).join("")}</tbody></table>`
        : '<p class="hint">None. Approved orders wait here until you submit them.</p>'}
      <p class="small"><a href="#orders" data-act="ord-tab" data-tab="open">Go to the Orders blotter &rarr;</a></p></div></section>`;
  }
  // Average daily volume for the open orders' securities: loaded once a day from the demo's price service.
  function advFor(symbols) {
    const cache = App.state.adv = App.state.adv || {};
    const need = symbols.filter((s) => !(s in cache));
    if (need.length && RH.paper && RH.paper.adv && !App.state.advLoading) {
      App.state.advLoading = true;
      RH.paper.adv(need).then((res) => { Object.assign(cache, res); for (const s of need) if (cache[s] === undefined) cache[s] = null; App.state.advError = ""; })
        .catch((e) => { App.state.advError = "Couldn't load trading volume" + (e && e.message ? `: ${e.message}` : "") + "."; for (const s of need) cache[s] = null; })
        .finally(() => { App.state.advLoading = false; App.rerender(); });
    }
    return cache;
  }
  const OPEN_COLS = [["account", "Account", "", (o) => o.acctName + o.account], ["symbol", "Symbol", "", (o) => o.symbol], ["order", "Order", "", orderSide],
    ["shares", "Shares", "n", (o) => o.qty], ["price", "Est. price", "n", (o) => o.est_price || 0], ["amount", "Est. amount", "n", (o) => o.amount],
    ["adv", "Avg daily volume", "n", (o) => o.adv ?? -1], ["advpct", "% of ADV", "n", (o) => o.advPct ?? -1],
    ["rebal", "Rebal ID", "", (o) => o.result], ["approved", "Approved", "", (o) => o.approved || ""]];
  const advPctText = (v) => (v == null ? "&ndash;" : v < 0.0001 ? "&lt;0.01%" : pct(v, 2));
  function openBlotter(pf) {
    const list = openOrders().filter((o) => !pf || o.portfolio_id === pf);
    const cache = advFor([...new Set(list.map((o) => o.symbol))]);
    for (const o of list) { const v = cache[o.symbol]; o.adv = v ? v.avg_shares : null; o.advPct = v && v.avg_shares ? o.qty / v.avg_shares : null; }
    const sel = App.state.ordSel = new Set([...(App.state.ordSel || [])].filter((id) => list.some((o) => o.id === id)));
    const rows = sortRows("open-orders", OPEN_COLS, list, { key: "approved", dir: -1 });
    const allOn = list.length && list.every((o) => sel.has(o.id)), selAmt = list.filter((o) => sel.has(o.id)).reduce((s, o) => s + o.amount, 0);
    const advCell = (o) => (o.adv == null ? (App.state.advLoading && cache[o.symbol] === undefined ? '<span class="muted">Loading...</span>' : '<span class="muted">n/a</span>') : o.adv.toLocaleString("en-US"));
    return `<div class="controls orders-filter">
        <button class="btn primary small" type="button" data-act="ord-submit"${sel.size ? "" : " disabled"}>Submit selected (${sel.size})</button>
        <button class="btn small danger" type="button" data-act="ord-cancel"${sel.size ? "" : " disabled"}>Cancel selected</button>
        <span class="muted small">${list.length} open order${list.length === 1 ? "" : "s"}${sel.size ? ` &middot; ${sel.size} selected, about ${money(selAmt)}` : ""}</span></div>
      ${list.length ? `<div class="scroll"><table class="blotter"><thead><tr><th><input type="checkbox" data-act="ord-check-all" aria-label="Select all open orders"${allOn ? " checked" : ""}></th>${sortHead("open-orders", OPEN_COLS, { key: "approved", dir: -1 })}</tr></thead><tbody>
        ${rows.map((o) => `<tr class="${sel.has(o.id) ? "sel" : ""}"><td><input type="checkbox" data-act="ord-check" data-id="${esc(o.id)}" aria-label="Select ${esc(o.symbol)} order"${sel.has(o.id) ? " checked" : ""}></td>
          <td>${esc(o.acctName)} ${mask(o.account)}</td><td class="sym">${esc(o.symbol)}</td><td class="side-${o.side}">${orderSide(o)}</td>
          <td class="n">${qty(o.qty)}</td><td class="n">${money(o.est_price || 0)}</td><td class="n">${money(o.amount)}</td>
          <td class="n">${advCell(o)}</td><td class="n${o.advPct != null && o.advPct >= 0.01 ? " neg" : ""}">${advPctText(o.advPct)}</td>
          <td><a href="#result-${esc(o.result)}" title="Open this rebalance result">${esc(o.result)}</a></td>
          <td class="nowrap">${esc(o.approved_label || "")} <span class="muted small">${esc(o.portfolio)}</span></td></tr>`).join("")}</tbody></table></div>`
        : '<p class="hint">No open orders. Approve a rebalance result (Approve orders) to send its orders here.</p>'}
      ${App.state.advError ? `<p class="warn-text small">${esc(App.state.advError)}</p>` : ""}
      <p class="hint">Open orders were approved but haven't been submitted; they stay here until you submit or cancel them. Submitted orders fill at the latest
        real closing price, sells first, and move to Closed. Est. price is the price when the rebalance ran. Avg daily volume is the security's real average
        shares traded per day over the last 20 sessions; % of ADV is the order's shares as a share of it (1% or more is highlighted).</p>`;
  }
  function ordersPage() {
    const all = filledOrders(), open = openOrders(), days = [...new Set(all.map((f) => f.day))].sort(), latest = days[days.length - 1] || "";
    const tab = App.state.ordersTab || (open.length ? "open" : "closed");
    const fl = App.state.ordersFilter = App.state.ordersFilter || {};
    const from = fl.from ?? latest, to = fl.to ?? latest, pf = fl.pf || "";
    const shown = all.filter((f) => (!from || f.day >= from) && (!to || f.day <= to) && (!pf || f.portfolio_id === pf));
    const rows = sortRows("orders", ORDER_COLS, shown, { key: "submitted", dir: -1 });
    const pfs = [...new Map([...all, ...open].map((f) => [f.portfolio_id, f.portfolio])).entries()];
    const sum = (side) => shown.filter((f) => f.side === side).reduce((s, f) => s + f.qty * f.price, 0);
    const pfSelect = `<label>Portfolio <select id="ord-pf"><option value="">All portfolios</option>${pfs.map(([id, n]) => `<option value="${esc(id)}"${id === pf ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>`;
    const tabBtn = (k, l, n) => `<button type="button" data-act="ord-tab" data-tab="${k}" aria-pressed="${tab === k}" class="${tab === k ? "on" : ""}">${l} <span class="count">${n}</span></button>`;
    return `<div class="page-head"><h1>Orders</h1><span class="muted small">Order blotter for approved demo rebalances</span></div>
      <section class="card"><div class="body">
        <div class="controls"><span class="seg-tabs" role="group" aria-label="Open or closed orders">${tabBtn("open", "Open", open.length)}${tabBtn("closed", "Closed", all.length)}</span>${pfSelect}</div>
        ${tab === "open" ? openBlotter(pf) : all.length ? `<div class="controls orders-filter">
            <label>From <input type="date" id="ord-from" value="${esc(from)}" aria-label="Submitted from"></label>
            <label>To <input type="date" id="ord-to" value="${esc(to)}" aria-label="Submitted to"></label>
            <button class="btn small" type="button" data-act="ord-latest">Latest submission day</button><button class="btn small" type="button" data-act="ord-allday">All dates</button>
            <span class="muted small">${shown.length} of ${all.length} fills &middot; bought ${money(sum("buy"))} &middot; sold ${money(sum("sell"))}</span></div>
          ${rows.length ? `<div class="scroll"><table><thead><tr>${sortHead("orders", ORDER_COLS, { key: "submitted", dir: -1 })}</tr></thead><tbody>
            ${rows.map((f) => `<tr><td>${esc(f.acctName)} ${mask(f.account)}</td><td class="sym">${esc(f.symbol)}</td><td class="side-${f.side}">${orderSide(f)}</td>
              <td class="n">${qty(f.qty)}</td><td class="n">${money(f.price)}</td><td class="n">${money(f.qty * f.price)}</td>
              <td><a href="#result-${esc(f.result)}" title="Open this rebalance result">${esc(f.result)}</a></td>
              <td class="nowrap">${esc(f.submitted_label)} <span class="muted small">${esc(f.portfolio)} &middot; filled at the ${esc(Charts.fmtDate(f.trade_date))} close</span></td></tr>`).join("")}</tbody></table></div>`
            : '<p class="hint">No fills in these dates. Try All dates.</p>'}
          <p class="hint">Shows the latest submission day to start. Dates are when the orders were submitted (Eastern time); each fill is at the closing price shown.
            Click a column heading to sort, and a Rebal ID to open its rebalance result.</p>`
          : '<p class="hint">No filled orders yet. Approve a rebalance, then submit its orders on the Open tab: their simulated fills show here.</p>'}</div></section>`;
  }

  // One multiple rebalance: its portfolios' results, with a rename box.
  function batchPage(id) {
    const b = Store.get("batches", id);
    if (!b) return '<p class="hint">That multiple rebalance no longer exists. <a href="#results">See all results</a></p>';
    const rs = batchResults(b), fresh = App.state.freshResults;
    return `<div class="page-head"><a class="linkbtn" href="#results">&larr; Rebalance Results</a><h1>${esc(b.name)}</h1>
        <span class="muted small">${esc(b.kind_label)} &middot; ${rs.length} portfolios &middot; ${esc(b.created_label)}</span></div>
      <section class="card"><div class="body">
        <div class="addrow"><label class="fld-in">Name <input type="text" id="batch-name" maxlength="80" value="${esc(b.name)}" aria-label="Name"${ro()}></label>
          <button class="btn small" type="button" data-act="batch-rename" data-id="${esc(b.id)}"${ro()}>Rename</button></div>
        ${rs.length ? `<div class="scroll"><table><thead><tr><th>When</th><th>Portfolio</th><th>Type</th><th class="n">Orders</th><th>Status</th><th></th></tr></thead><tbody>
          ${rs.map((r) => resultRow(r, fresh)).join("")}</tbody></table></div>` : '<p class="hint">Its results were deleted.</p>'}
        ${(b.failed || []).length ? `<p class="warn-text">Didn't run: ${b.failed.map(([n, m]) => `<b>${esc(n)}</b> (${esc(m)})`).join("; ")}</p>` : ""}
        <p class="hint">Open a result to review it. Each result has Previous and Next buttons to step through this rebalance's portfolios.</p></div></section>`;
  }

  root.Views = { home, accounts, unassigned, createRebalance, defaultBatchName, ordersPage, sortHead, sortRows, settingsPage, readiness, portfolios, portfolioPage, models, modelPage, securities, results, batchPage, portfolioSections, modelSleeves,
    setAsideEditor, donut, colorize, CLASSES, PALETTE, CASH_COLOR };
})(window);
