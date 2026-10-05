// Shared helpers: formatting, modal, symbol search box, portfolio math and live-data loading.
(function (root) {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fix = (v, d) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v);
  const money = (v) => {
    v = fix(+v || 0, 2);
    const s = "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v < 0 ? `<span class="neg">(${s})</span>` : s;
  };
  const plainMoney = (v) => (fix(v, 2) < 0 ? "-" : "") + "$" + Math.abs(fix(+v || 0, 2)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (v, d = 1, signed = false) => {
    v = fix((+v || 0) * 100, d);
    const s = (signed && v > 0 ? "+" : "") + v.toFixed(d) + "%";
    return v < 0 ? `<span class="neg">${s}</span>` : s;
  };
  const qty = (v) => fix(+v || 0, 6).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  const mask = (id) => "&bull;&bull;" + esc(String(id).slice(-4));
  const maskText = (id) => "••" + String(id).slice(-4);
  const today = () => new Date().toISOString().slice(0, 10);
  const nowStamp = () => new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  // ---- modal ---------------------------------------------------------------
  function modal({ title, body, actions = [], wide = false, onClose }) {
    const host = document.getElementById("modal-root");
    const prev = document.activeElement;
    host.innerHTML = `<div class="scrim"><div class="modal${wide ? " wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header><h2 id="modal-title">${esc(title)}</h2><button class="close" type="button" data-modal-close aria-label="Close">&times;</button></header>
      <div class="modal-body">${body}</div>
      <footer>${actions.map((a, i) => `<button class="btn${a.primary ? " primary" : ""}${a.danger ? " danger" : ""}" type="button" data-modal-act="${i}"${a.disabled ? " disabled" : ""}>${esc(a.label)}</button>`).join("")}</footer>
    </div></div>`;
    host.hidden = false;
    const close = () => { host.hidden = true; host.innerHTML = ""; host.onclick = null; host.onkeydown = null; if (onClose) onClose(); if (prev && prev.focus) prev.focus(); };
    host.onclick = (ev) => {
      if (ev.target.closest("[data-modal-close]") || ev.target.classList.contains("scrim")) return close();
      const b = ev.target.closest("[data-modal-act]");
      if (b && !b.disabled) { const r = actions[+b.dataset.modalAct].onClick?.(close, host); if (r !== false && actions[+b.dataset.modalAct].closes !== false) close(); }
    };
    host.onkeydown = (ev) => { if (ev.key === "Escape") close(); };
    (host.querySelector("[data-modal-act].primary") || host.querySelector(".close")).focus();
    return { close, el: host };
  }
  function toast(text) {
    const t = document.getElementById("toast");
    t.textContent = text; t.hidden = false;
    clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 2600);
  }

  // ---- symbol search box: Robinhood suggestions, ticker prefixes first ------
  // A model line for uninvested cash. The underscore keeps it from ever matching a real ticker.
  const CASH = "_CASH";
  // The label typed as text (instead of picked from the suggestions) also means cash.
  const CASH_LABEL = /^(CASH \(UNINVESTED\)|UNINVESTED CASH)$/i;
  const normSym = (s) => (CASH_LABEL.test(String(s || "").trim()) ? CASH : s);
  const isCash = (s) => normSym(s) === CASH;
  const symLabel = (s) => (isCash(s) ? "Cash (uninvested)" : s);
  const known = new Set();
  function rememberSymbols(list) { for (const s of list) if (s) known.add(String(s).toUpperCase()); }
  const picker = (id, placeholder = "Search symbol", extra = "") =>
    `<span class="picker"><input type="text" id="${id}" class="picker-in" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" aria-autocomplete="list" ${extra}><ul class="suggest" role="listbox" hidden></ul></span>`;
  let searchSeq = 0;
  async function suggest(input) {
    const q = input.value.trim();
    const list = input.parentElement.querySelector(".suggest");
    if (!q) { list.hidden = true; return; }
    const seq = ++searchSeq;
    const local = [...known].map((s) => ({ symbol: s, name: (Store.get("securities", s) || {}).name || RH.DEMO_NAMES[s] || "" }));
    let remote = [];
    list.innerHTML = '<li class="muted">Searching...</li>'; list.hidden = false;
    try { remote = await RH.api.search(q); } catch (e) { remote = []; list.dataset.err = e.message; }
    if (seq !== searchSeq) return;
    const items = RH.rank(q, [...remote, ...local]).slice(0, 12);
    // Model sleeves can hold plain uninvested cash, which is not a ticker (the stock "CASH" is Pathward Financial).
    if (input.dataset.allowCash && /^(C|CA|CAS|CASH|\$CASH|USD|MONEY)/.test(q.toUpperCase())) items.unshift({ symbol: CASH, name: "Uninvested cash in the account (not a security)" });
    list.innerHTML = items.length ? items.map((it, i) => `<li role="option" data-sym="${esc(it.symbol)}" class="${i === 0 ? "active" : ""}"><b>${esc(symLabel(it.symbol))}</b> <span class="muted">${esc(it.name)}</span></li>`).join("")
      : `<li class="muted">${list.dataset.err ? esc(list.dataset.err) : "No matches on Robinhood."}</li>`;
    delete list.dataset.err;
  }
  function wirePickers(doc) {
    let timer;
    doc.addEventListener("input", (ev) => {
      if (!ev.target.classList.contains("picker-in")) return;
      ev.target.value = ev.target.value.toUpperCase();
      delete ev.target.dataset.pick;
      clearTimeout(timer); timer = setTimeout(() => suggest(ev.target), 220);
    });
    doc.addEventListener("keydown", (ev) => {
      if (!ev.target.classList.contains("picker-in")) return;
      const list = ev.target.parentElement.querySelector(".suggest");
      const opts = [...list.querySelectorAll("li[data-sym]")];
      if (list.hidden || !opts.length) return;
      let i = opts.findIndex((o) => o.classList.contains("active"));
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault(); opts[i]?.classList.remove("active");
        i = (i + (ev.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length; opts[i].classList.add("active");
      } else if (ev.key === "Enter") { ev.preventDefault(); choose(ev.target, opts[Math.max(0, i)].dataset.sym); }
      else if (ev.key === "Escape") list.hidden = true;
    });
    doc.addEventListener("mousedown", (ev) => {
      const li = ev.target.closest(".suggest li[data-sym]");
      if (li) { ev.preventDefault(); choose(li.closest(".picker").querySelector(".picker-in"), li.dataset.sym); return; }
      if (!ev.target.closest(".picker")) for (const l of doc.querySelectorAll(".suggest")) l.hidden = true;
    });
  }
  function choose(input, sym) {
    input.value = symLabel(sym);
    if (sym === CASH) input.dataset.pick = CASH; else delete input.dataset.pick;
    input.parentElement.querySelector(".suggest").hidden = true;
    input.dispatchEvent(new CustomEvent("picked", { bubbles: true, detail: sym }));
  }

  // ---- models & portfolios -------------------------------------------------
  function flatModel(model) {
    const out = {};
    if (!model) return out;
    for (const sl of model.sleeves || []) for (const s of sl.securities || []) {
      const sym = normSym(s.symbol);
      out[sym] = (out[sym] || 0) + ((+sl.weight || 0) / 100) * ((+s.weight || 0) / 100);
    }
    return out;
  }
  // Share of the model held as uninvested cash (0 when the model has no cash line).
  const modelCash = (model) => flatModel(model)[CASH] || 0;
  // The model's securities only (no cash line), as shares of the whole model.
  function modelSecurities(model) { const f = flatModel(model); delete f[CASH]; return f; }
  function modelProblems(model) {
    const p = [];
    if (!model) return ["No model selected."];
    const sw = (model.sleeves || []).reduce((s, x) => s + (+x.weight || 0), 0);
    if (!(model.sleeves || []).length) p.push("Add at least one sleeve.");
    else if (Math.abs(sw - 100) > 0.01) p.push(`Sleeve weights add up to ${sw.toFixed(2)}%, not 100%.`);
    for (const sl of model.sleeves || []) {
      const w = (sl.securities || []).reduce((s, x) => s + (+x.weight || 0), 0);
      if (!(sl.securities || []).length) p.push(`Sleeve "${sl.name}" has no securities.`);
      else if (Math.abs(w - 100) > 0.01) p.push(`Securities in sleeve "${sl.name}" add up to ${w.toFixed(2)}%, not 100%.`);
    }
    return p;
  }
  // Rebalance settings are app-wide (Settings > Rebalance), one document: settings/rebalance.
  const RSET_DEFAULTS = { cash_target_pct: 0.05, position_band: 0.02, class_band: 0.05, cash_band: 0.0025, min_trade: 25, tlh_min_loss: 500, tlh_min_pct: 0.05,
    st_rate: 0.32, lt_rate: 0.15, lot_method: "min_tax", fractional: true, block_st: true, near_lt_days: 30, sell_unmodeled: true };
  const RSET_KEYS = Object.keys(RSET_DEFAULTS);
  function rset() {
    const d = root.App && root.App.state.setDraft, saved = Store.get("settings", "rebalance");
    return { ...RSET_DEFAULTS, ...(d ? d : saved || {}) };
  }
  // Settings saved before they became app-wide lived on each portfolio; the first one found becomes the app-wide starting point.
  function migrateRset() {
    if (Store.get("settings", "rebalance") || Store.readOnly) return;
    const pf = Store.all("portfolios").sort((a, b) => (a.created || "").localeCompare(b.created || "")).find((p) => RSET_KEYS.some((k) => p[k] !== undefined));
    const doc = { id: "rebalance", ...RSET_DEFAULTS };
    if (pf) for (const k of RSET_KEYS) if (pf[k] !== undefined && pf[k] !== null) doc[k] = pf[k];
    Store.put("settings", "rebalance", doc);
  }
  function newPortfolio(name) {
    return { id: Store.newId("pf"), name, account_numbers: [], model_id: null, cash_target_pct: 0.05, position_band: 0.02,
      class_band: 0.05, cash_band: 0.0025, fractional: true, min_trade: 25, block_st: true, near_lt_days: 30, lot_method: "min_tax",
      st_rate: 0.32, lt_rate: 0.15, tlh_min_loss: 500, tlh_min_pct: 0.05, equivalents: [], restrictions: [], gain_limits: [],
      notes: [], created: new Date().toISOString() };
  }
  // An account being edited on its page reads from its unsaved draft until Save changes.
  const acctDoc = (id) => { const d = root.App && root.App.state.acctDraft;
    return d && d.id === id ? d.doc : Store.get("accounts", id) || { id, set_asides: [], min_cash: null }; };
  const inEffect = (r, asOf) => !r.effective || r.effective <= asOf;
  const setAsideDollars = (r, value) => (r.kind === "percent" ? (value * (+r.amount || 0)) / 100 : +r.amount || 0);
  function setAsideNow(id, value, asOf = today()) {
    return acctDoc(id).set_asides.filter((r) => inEffect(r, asOf)).reduce((s, r) => s + setAsideDollars(r, value), 0);
  }
  // An account's cash against its target: it should hold its set-aside plus the cash target, within the cash range.
  function cashRange(target, band, setAside) {
    return { lo: setAside + Math.max(0, target - band), hi: setAside + target + band };
  }
  function cashState(cash, target, band, setAside) {
    const { lo, hi } = cashRange(target, band, setAside);
    return cash < lo - 0.005 ? "under" : cash > hi + 0.005 ? "over" : "ok";
  }
  // Geography and Morningstar-style cap/style for a security: what's set on the Securities page, else a best guess
  // from well-known funds and the fund's name.
  const GEOS = ["Domestic", "International", "Global"];
  const CAP_STYLES = ["Large", "Mid", "Small"].flatMap((c) => ["Value", "Blend", "Growth"].map((s) => `${c} ${s}`));
  const KNOWN_STYLE = { VGT: "Large Growth", QQQ: "Large Growth", QQQM: "Large Growth", XLK: "Large Growth", VUG: "Large Growth", SCHG: "Large Growth", IWF: "Large Growth",
    MGK: "Large Growth", SPMO: "Large Growth", VTV: "Large Value", SCHD: "Large Value", IWD: "Large Value", VOT: "Mid Growth", IWP: "Mid Growth", VOE: "Mid Value",
    VO: "Mid Blend", IJH: "Mid Blend", XMHQ: "Mid Blend", IWM: "Small Blend", IJR: "Small Blend", VB: "Small Blend", VBK: "Small Growth", VBR: "Small Value", AVUV: "Small Value" };
  const INTL = /international|intl|ex[- ]?u\.?s|emerging|developed|eafe|europe|pacific|japan|china|india|foreign|world ex/i;
  function profileOf(sym, name = "", useSet = true) {
    const saved = Store.get("securities", sym) || {}, sec = useSet ? saved : { name: saved.name }, cls = classOf(sym), n = `${name} ${saved.name || ""}`;
    const priced = cls === "Equity" || cls === "Fixed Income" || cls === "Real Estate";
    const geo = sec.geography || (!priced ? "-" : INTL.test(n) || ["VXUS", "VEA", "VWO", "IXUS", "IEFA", "IEMG", "EFA", "BNDX"].includes(sym) ? "International"
      : /global|world|all[- ]world|acwi/i.test(n) || ["VT", "ACWI", "BNDW"].includes(sym) ? "Global" : "Domestic");
    let style = sec.cap_style || KNOWN_STYLE[sym];
    if (!style) style = cls !== "Equity" ? "-" : `${/small/i.test(n) ? "Small" : /mid/i.test(n) ? "Mid" : "Large"} ${/growth|momentum|tech/i.test(n) ? "Growth" : /value|dividend/i.test(n) ? "Value" : "Blend"}`;
    return { cls, geo, style };
  }
  // Asset class from a fund's name, where the name makes it clear (else Unclassified).
  const guessClass = (n) => (/money market|0-3 month|0-1 year|t-bill|treasury bill|ultra.?short/i.test(n) ? "Cash Equivalent"
    : /bond|treasury|aggregate|fixed income|municipal|corporate|tips/i.test(n) ? "Fixed Income"
    : /real estate|reit/i.test(n) ? "Real Estate" : /gold|silver|commodit|bitcoin|ether/i.test(n) ? "Alternatives"
    : /stock|equity|index|s&p|nasdaq|dow|growth|value|cap|dividend|momentum|technology|etf/i.test(n) ? "Equity" : "Unclassified");
  function classOf(sym) { return isCash(sym) ? "Cash" : (Store.get("securities", sym) || {}).asset_class || "Unclassified"; }

  // Equivalents from the portfolio plus global ones from Securities, grouped under the model security.
  function equivalentsFor(pf, weights) {
    const eq = {}, altBuy = new Set();
    const add = (primary, alt, buy) => {
      if (!primary || !alt || primary === alt) return;
      eq[primary] = eq[primary] || [];
      if (!eq[primary].includes(alt)) eq[primary].push(alt);
      if (buy) altBuy.add(alt);
    };
    for (const e of pf.equivalents || []) add(e.primary, e.alt, e.alt_if_held);
    for (const sec of Store.all("securities")) for (const g of sec.global_equivalents || []) {
      if (sec.symbol in weights) add(sec.symbol, g.symbol, g.alt_if_held);
      else if (g.symbol in weights) add(g.symbol, sec.symbol, g.alt_if_held);
    }
    return { eq, altBuy };
  }
  function tlhPairs() {
    const pairs = {};
    for (const sec of Store.all("securities")) for (const p of sec.tlh_pairs || []) {
      (pairs[sec.symbol] = pairs[sec.symbol] || []).includes(p) || pairs[sec.symbol].push(p);
      (pairs[p] = pairs[p] || []).includes(sec.symbol) || pairs[p].push(sec.symbol);
    }
    return pairs;
  }

  async function loadPortfolioData(pf, kind, progress = () => {}) {
    const rhAccounts = await App.rhAccounts();
    const accts = pf.account_numbers.map((id) => rhAccounts.find((a) => a.id === id)).filter(Boolean);
    if (!accts.length) throw new Error("This portfolio has no accounts. Add accounts on the portfolio page.");
    const model = Store.get("models", pf.model_id);
    const weights = modelSecurities(model);
    const out = [];
    for (const a of accts) {
      progress(`Reading ${a.name} ${maskText(a.id)}...`);
      const [bal, positions, calls] = await Promise.all([RH.api.balances(a.id), RH.api.positions(a.id),
        RH.api.shortCalls(a.id).catch(() => ({}))]);
      if (a.type === "taxable" && ["full", "generate_cash", "tlh"].includes(kind)) {
        for (const p of positions) {
          progress(`Reading tax lots for ${p.symbol}...`);
          p.lots = (await RH.api.taxLots(a.id, p.symbol)).map((l) => ({ ...l, cost: l.cost ?? p.avg_cost }));
        }
      }
      out.push({ id: a.id, name: a.name, type: a.type, cash: bal.cash, total: bal.total, positions, short_calls: calls });
    }
    const { eq } = equivalentsFor(pf, weights);
    const symbols = new Set([...Object.keys(weights), ...out.flatMap((a) => a.positions.map((p) => p.symbol)),
      ...Object.values(eq).flat(), ...(pf.restrictions || []).map((r) => r.alternative).filter(Boolean)]);
    if (kind === "tlh") for (const [s, ps] of Object.entries(tlhPairs())) if (symbols.has(s)) ps.forEach((p) => symbols.add(p));
    progress("Reading quotes...");
    const prices = await RH.api.quotes([...symbols]);
    let recent = { buys: [], sells: [] };
    if (kind === "tlh") {
      progress("Checking the last 30 days of orders for wash sales...");
      const since = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
      for (const a of await App.rhAccounts()) {
        try {
          const o = await RH.api.recentOrders(a.id, since);
          recent.buys.push(...o.filter((x) => x.side === "buy").map((x) => x.symbol));
          recent.sells.push(...o.filter((x) => x.side === "sell").map((x) => x.symbol));
        } catch { recent.unchecked = true; }
      }
    }
    rememberSymbols(symbols);
    return { accounts: out, prices, model, weights, recent };
  }

  function buildInput(pf, data, kind) {
    const asOf = today();
    const { eq, altBuy } = equivalentsFor(pf, data.weights);
    const noBuy = [], noSell = [], actions = {};
    for (const r of pf.restrictions || []) {
      if (r.type === "never_sell") { noSell.push(r.symbol); continue; }
      noBuy.push(r.symbol); actions[r.symbol] = r.action || "prorate";
      if (r.action === "alternative" && r.alternative) {
        const primary = Object.keys(eq).find((p) => p === r.symbol || eq[p].includes(r.symbol)) || r.symbol;
        eq[primary] = eq[primary] || [];
        if (r.alternative !== primary && !eq[primary].includes(r.alternative)) eq[primary].push(r.alternative);
        altBuy.add(r.alternative);
      }
    }
    const missing = Object.keys(data.weights).filter((s) => !(data.prices[s] > 0));
    if (missing.length) throw new Error(RH.paper
      ? `No price found for ${missing.join(", ")}. Check the model's tickers: the demo prices US-listed stocks, ETFs and mutual funds.`
      : `Robinhood returned no price for ${missing.join(", ")}. Check the model's tickers.`);
    const value = (a) => a.cash + a.positions.reduce((s, p) => s + p.shares * (data.prices[p.symbol] || 0), 0);
    const gl = {};
    for (const g of pf.gain_limits || []) gl[g.account || "*"] = { short_term: g.max_short_term, long_term: g.max_long_term, total: g.max_total };
    const symbols = new Set([...Object.keys(data.prices)]);
    const classMap = Object.fromEntries([...symbols].map((s) => [s, classOf(s)]));
    const rs = rset();
    // A cash line in the model is the cash to keep in each account; it replaces the cash target in Settings.
    // The engine invests what's left over, so the security weights are rescaled to add up to 100% of it.
    const hasCash = data.model && CASH in flatModel(data.model), cashPct = hasCash ? modelCash(data.model) : rs.cash_target_pct ?? 0.05;
    const invested = 1 - (hasCash ? cashPct : 0);
    const weights = Object.fromEntries(Object.entries(data.weights).map(([s, w]) => [s, invested > 0 ? w / invested : 0]));
    return {
      as_of: asOf, type: kind,
      run: { portfolio: pf.name, portfolio_id: pf.id, model: (data.model || {}).name || "", name: `${(data.model || {}).name || pf.name} - ${RebalEngine.KIND_LABEL[kind]}` },
      accounts: data.accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, cash: a.cash, short_calls: a.short_calls,
        positions: a.positions.map((p) => ({ symbol: p.symbol, shares: p.shares, price: data.prices[p.symbol], avg_cost: p.avg_cost, lots: p.lots || [] })) })),
      prices: data.prices, weights, equivalents: eq, alt_buy: [...altBuy],
      no_buy: noBuy, no_sell: noSell, no_buy_action: actions, gain_limits: gl,
      set_asides: Object.fromEntries(data.accounts.map((a) => [a.id, setAsideNow(a.id, value(a), asOf)])),
      cash_target_pct: cashPct, min_cash: 0, cash_band_pct: rs.cash_band ?? 0.0025,
      band: { abs: rs.position_band ?? 0.02, rel: 1 }, class_band: rs.class_band ?? 0.05, class_of: classMap,
      fractional: rs.fractional !== false, min_trade: rs.min_trade ?? 25, sell_unmodeled: rs.sell_unmodeled !== false,
      // Per-security minimum buy and sell, in dollars (Securities page).
      trade_minimums: Object.fromEntries(Store.all("securities").filter((s) => +s.min_buy > 0 || +s.min_sell > 0)
        .map((s) => [s.symbol, { ...(+s.min_buy > 0 ? { buy: +s.min_buy } : {}), ...(+s.min_sell > 0 ? { sell: +s.min_sell } : {}) }])),
      // Asset location (Securities page): where each security is preferred to be bought, by account type.
      location: Object.fromEntries(Store.all("securities").filter((s) => s.location && Object.values(s.location).some((v) => +v)).map((s) => [s.symbol, s.location])),
      tax: { block_st: rs.block_st !== false, near_lt_days: rs.near_lt_days ?? 30, avoid_near_lt: true, lot_method: rs.lot_method || "min_tax",
             st_rate: rs.st_rate ?? 0.32, lt_rate: rs.lt_rate ?? 0.15 },
      tlh: { min_loss_dollars: rs.tlh_min_loss ?? 500, min_loss_pct: rs.tlh_min_pct ?? 0.05, pairs: tlhPairs(),
             recent_buys: (data.recent || {}).buys || [], recent_loss_sells: (data.recent || {}).sells || [] },
    };
  }

  root.U = { esc, money, plainMoney, pct, qty, mask, maskText, today, nowStamp, modal, toast, picker, wirePickers, rememberSymbols,
    RSET_DEFAULTS, rset, migrateRset, GEOS, CAP_STYLES, profileOf, guessClass, CASH, isCash, symLabel, flatModel, modelCash, modelSecurities, modelProblems, newPortfolio, acctDoc, inEffect, setAsideDollars, setAsideNow, cashRange, cashState, classOf, equivalentsFor, tlhPairs,
    loadPortfolioData, buildInput };
})(window);
