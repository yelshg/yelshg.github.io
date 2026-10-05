// Public demo: a sample household traded through a paper broker at real end-of-day prices.
// Nothing here can reach a brokerage. Prices come from data/prices.json (published by the site's nightly GitHub job);
// accounts, lots and fills live only in this visitor's browser. "Submit order" fills against this broker.
(function () {
  "use strict";
  const VERSION = "3", VKEY = "rebalancer-demo-version", BKEY = "rebalancer-demo-broker", STORE_KEY = "rebal-app-v1";
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked: the demo still runs for this visit */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } } };

  // A new demo version (or "Reset demo") starts the visitor over with the original household.
  if (ls.get(VKEY) !== VERSION) { ls.del(STORE_KEY); ls.del(BKEY); ls.set(VKEY, VERSION); }

  // ---- accounts: load this user's saved demo before the app starts, and save changes back -----------------
  // Each signed-in user has one row in demo_state (row-level security: only they can read or write it).
  const Auth = window.RebalAuth || { enabled: false };
  const OWNER = "rebalancer-demo-owner";
  let user = null, loaded = !Auth.enabled, saveBlocked = false;
  const ready = (async () => {
    if (!Auth.enabled) return;
    const s = await Auth.session();
    if (!s) { location.replace("../#login"); await new Promise(() => {}); }
    user = s.user;
    try {
      const { data, error } = await Auth.client.from("demo_state").select("data").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      const d = data && data.data;
      if (d && d.version === VERSION && d.store) {
        ls.set(STORE_KEY, JSON.stringify(d.store));
        if (d.broker) ls.set(BKEY, JSON.stringify(d.broker)); else ls.del(BKEY);
        ls.set(VKEY, VERSION);
      } else if (ls.get(OWNER) !== user.id) { ls.del(STORE_KEY); ls.del(BKEY); ls.set(VKEY, VERSION); } // someone else's local copy
      ls.set(OWNER, user.id);
    } catch (e) {
      // Couldn't load the saved demo: run on what's in this browser but don't overwrite the saved copy.
      console.warn("Couldn't load your saved demo:", e); saveBlocked = true;
    }
    loaded = true;
  })();
  let saveTimer = null;
  function scheduleSave() {
    if (!Auth.enabled || !loaded || !user || saveBlocked) return;
    clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 1500);
  }
  async function saveNow() {
    clearTimeout(saveTimer);
    if (!Auth.enabled || !loaded || !user || saveBlocked) return;
    let store = null; try { store = JSON.parse(ls.get(STORE_KEY) || "null"); } catch { store = null; }
    if (!store) return;
    const now = new Date().toISOString();
    const { error } = await Auth.client.from("demo_state").upsert({ user_id: user.id, data: { version: VERSION, store, broker: B, saved_at: now }, updated_at: now });
    if (error) console.warn("Couldn't save your demo:", error);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow(); });

  // ---- prices -------------------------------------------------------------------------------------------
  let P = null; // { dates: [...], closes: { SYM: [..] }, names: { SYM: name }, last }
  // Securities outside the nightly file: fetched on demand (Supabase function "prices"), cached in this browser.
  // X: { SYM: { name, dates: [...], closes: [...] } }
  const XKEY = "rebalancer-demo-xprices", START = "2024-12-02";
  let X = {};
  const idxIn = (dates, day) => { let lo = 0, hi = dates.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (dates[m] <= day) { ans = m; lo = m + 1; } else hi = m - 1; } return ans; };
  const seriesOf = (sym) => (P.closes[sym] ? { dates: P.dates, closes: P.closes[sym] } : X[sym] || null);
  function closeOn(sym, day) {
    const s = seriesOf(sym);
    if (!s) return null;
    for (let i = idxIn(s.dates, day); i >= 0; i--) if (s.closes[i] != null) return s.closes[i];
    return null;
  }
  const lastClose = (sym) => (seriesOf(sym) ? closeOn(sym, P.last) : null) ?? (RH.DEMO_PRICES[sym] || null);
  const nameOf = (sym) => (P && P.names && P.names[sym]) || (X[sym] && X[sym].name) || RH.DEMO_NAMES[sym] || "";
  const fnOK = () => Auth.enabled && Auth.client && Auth.client.functions;
  async function callPrices(body) {
    const { data, error } = await Auth.client.functions.invoke("prices", { body });
    if (error) throw error;
    return data;
  }
  // Make sure every symbol has prices, fetching the ones the nightly file doesn't have. Unknown tickers stay missing.
  const asked = new Set();
  async function ensurePrices(symbols) {
    const need = [...new Set(symbols.map((s) => String(s).toUpperCase()))].filter((s) => s && !U.isCash(s) && !P.closes[s] && !X[s] && !asked.has(s));
    if (!need.length || !fnOK()) return;
    for (let i = 0; i < need.length; i += 25) {
      const batch = need.slice(i, i + 25);
      batch.forEach((s) => asked.add(s));
      try {
        const d = await callPrices({ action: "closes", symbols: batch, from: START });
        Object.assign(X, d.closes || {});
      } catch (e) { batch.forEach((s) => asked.delete(s)); console.warn("Couldn't fetch prices for", batch.join(", "), e); }
    }
    ls.set(XKEY, JSON.stringify({ last: P.last, X }));
  }
  const tradingDay = (day) => P.dates.find((d) => d >= day) || P.last;

  // ---- paper broker -------------------------------------------------------------------------------------
  // state: { accounts: { id: { cash, lots: { SYM: [{ qty, cost, acquired }] } } }, orders: [{ id, account, symbol, side, qty, price, at, agent }] }
  let B = null;
  const save = () => { ls.set(BKEY, JSON.stringify(B)); scheduleSave(); };
  const at = (day) => day + "T20:00:00.000Z"; // the close, US Eastern
  // The household's history: deposits on these dates, then buys at that day's real close.
  const HISTORY = [
    { day: "2025-01-02", account: "DEMO0001", deposit: 200000, note: "Opening deposit", buys: { SPYM: 90000, VGT: 45000, IWM: 40000, VWO: 9000 } },
    { day: "2025-08-04", account: "DEMO0001", deposit: 20000, note: "ACH deposit", buys: { SPYM: 20000 } },
    { day: "2026-01-02", account: "DEMO0002", deposit: 25000, note: "Roth IRA contribution", buys: {} },
    { day: "2026-06-22", account: "DEMO0001", deposit: 15000, note: "ACH deposit", buys: { SPYM: 15000 } },
    { day: "2025-03-03", account: "DEMO0003", deposit: 120000, note: "IRA rollover", buys: { BND: 54000, SPYM: 36000, VEA: 18000, GLDM: 6000 } },
    { day: "2026-04-01", account: "DEMO0003", deposit: 7000, note: "IRA contribution", buys: {} },
  ];
  // The demo's accounts: Demo Growth Portfolio holds the taxable account and the Roth IRA; Demo Income Portfolio, the Traditional IRA.
  const ACCOUNTS = [
    { id: "DEMO0001", name: "Family Brokerage", type: "taxable", type_label: "Individual" },
    { id: "DEMO0002", name: "Roth IRA", type: "roth_ira", type_label: "Roth IRA" },
    { id: "DEMO0003", name: "Traditional IRA", type: "traditional_ira", type_label: "Traditional IRA" },
  ];
  function buildHistory() {
    B = { accounts: Object.fromEntries(ACCOUNTS.map((a) => [a.id, { cash: 0, lots: {} }])), orders: [], transfers: [] };
    for (const h of HISTORY) {
      const day = tradingDay(h.day), a = B.accounts[h.account];
      a.cash += h.deposit;
      B.transfers.push({ id: `demo-dep-${day}-${h.account}`, account: h.account, date: day, kind: "deposit", amount: h.deposit, note: h.note });
      for (const [sym, dollars] of Object.entries(h.buys)) {
        const px = closeOn(sym, day); if (!px) continue;
        const qty = Math.floor((dollars / px) * 1e6) / 1e6;
        a.cash = +(a.cash - qty * px).toFixed(6);
        (a.lots[sym] = a.lots[sym] || []).push({ qty, cost: px, acquired: day });
        B.orders.push({ id: `demo-o-${B.orders.length + 1}`, account: h.account, symbol: sym, side: "buy", qty, price: px, at: at(day), agent: "user" });
      }
    }
    save();
  }
  const held = (a, sym) => (B.accounts[a].lots[sym] || []).reduce((s, l) => s + l.qty, 0);

  // Settlement: US stock and ETF trades settle one business day after the trade (T+1). Weekends and days the
  // settlement system is closed (NYSE holidays, plus Columbus Day and Veterans Day) are skipped.
  const NO_SETTLE = new Set(["2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07",
    "2026-10-12", "2026-11-11", "2026-11-26", "2026-12-25", "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
    "2027-06-18", "2027-07-05", "2027-09-06", "2027-10-11", "2027-11-11", "2027-11-25", "2027-12-24"]);
  function settleDate(day) {
    let d = History.addDays(day, 1);
    while ([0, 6].includes(new Date(d + "T12:00:00Z").getUTCDay()) || NO_SETTLE.has(d)) d = History.addDays(d, 1);
    return d;
  }
  // Sale proceeds still settling today (Eastern time). Buys made with them settle the same day, so only the net
  // (sales less purchases not yet settled) is cash the account has but can't use yet.
  function unsettled(acct) {
    const today = History.etDate();
    let net = 0, settles = null;
    for (const o of B.orders) {
      if (o.account !== acct) continue;
      const s = settleDate(o.at.slice(0, 10));
      if (today >= s) continue;
      net += (o.side === "sell" ? 1 : -1) * o.qty * o.price;
      if (o.side === "sell") settles = !settles || s > settles ? s : settles;
    }
    return { amount: net > 0.005 ? +net.toFixed(2) : 0, settles: net > 0.005 ? settles : null };
  }

  // Fill a list of {account, symbol, side, qty} at the latest close: sells first (raising cash), then buys.
  function fill(list) {
    // Orders fill at the latest close, so they're dated that trading day (reports run as of the last business day).
    // Each order may carry a ref (its blotter order id); refs of orders that couldn't fill at all come back in `rejected`.
    const fills = [], skipped = [], rejected = [], now = at(P.last), method = (U.rset().lot_method || "min_tax");
    const order = list.slice().sort((x, y) => (x.side === "sell" ? 0 : 1) - (y.side === "sell" ? 0 : 1));
    const reject = (o, why) => { skipped.push(why); if (o.ref) rejected.push({ ref: o.ref, why }); };
    for (const o of order) {
      const a = B.accounts[o.account], px = lastClose(o.symbol);
      if (!a || !px) { reject(o, `${o.side === "sell" ? "Sell" : "Buy"} ${o.symbol}: no price, not filled.`); continue; }
      let qty = Math.floor(o.qty * 1e6) / 1e6, heldBefore = 0;
      if (o.side === "sell") {
        heldBefore = held(o.account, o.symbol);
        qty = Math.min(qty, Math.floor(held(o.account, o.symbol) * 1e6) / 1e6);
        if (qty <= 0) { reject(o, `Sell ${o.symbol}: no shares held.`); continue; }
        // Lots sold: the ones the rebalance chose (shown under the order's tax lots), then oldest first (FIFO)
        // or highest cost first (HIFO / lowest tax) for anything left.
        const lots = (a.lots[o.symbol] || []).slice().sort((x, y) => (method === "fifo" ? x.acquired.localeCompare(y.acquired) : y.cost - x.cost));
        let left = qty;
        for (const pick of o.lots || []) {
          const l = lots.find((x) => x.acquired === pick.acquired && Math.abs(x.cost - pick.cost) < 1e-9 && x.qty > 1e-6);
          if (!l) continue;
          const take = Math.min(l.qty, pick.qty, left); l.qty = +(l.qty - take).toFixed(6); left = +(left - take).toFixed(6);
          if (left <= 0) break;
        }
        for (const l of lots) {
          if (left <= 0) break; const take = Math.min(l.qty, left); l.qty = +(l.qty - take).toFixed(6); left = +(left - take).toFixed(6); if (left <= 0) break; }
        a.lots[o.symbol] = lots.filter((l) => l.qty > 1e-6).sort((x, y) => x.acquired.localeCompare(y.acquired));
        if (!a.lots[o.symbol].length) delete a.lots[o.symbol];
        a.cash = +(a.cash + qty * px).toFixed(6);
      } else {
        if (qty * px > a.cash + 0.005) { const fit = Math.floor((a.cash / px) * 1e6) / 1e6;
          if (fit <= 0) { reject(o, `Buy ${o.symbol}: not enough cash.`); continue; }
          skipped.push(`Buy ${o.symbol}: reduced to ${fit} shares to fit the cash available.`); qty = fit; }
        a.cash = +(a.cash - qty * px).toFixed(6);
        (a.lots[o.symbol] = a.lots[o.symbol] || []).push({ qty, cost: px, acquired: now.slice(0, 10) });
      }
      const all = o.side === "sell" && (!!o.all || qty >= heldBefore - 1e-6); // "Sell all": the whole position
      B.orders.push({ id: `demo-o-${B.orders.length + 1}`, account: o.account, symbol: o.symbol, side: o.side, qty, price: px, at: now, agent: "user", ...(all ? { all } : {}) });
      fills.push({ account: o.account, symbol: o.symbol, side: o.side, qty, price: px, ...(all ? { all } : {}), ...(o.ref ? { ref: o.ref } : {}) });
    }
    save();
    return { fills, skipped, rejected, price_date: P.last, settles: fills.some((f) => f.side === "sell") ? settleDate(P.last) : null };
  }

  // Average daily trading volume (real, last 20 sessions) for the Orders blotter, from the "prices" function; cached for the day.
  const ADV_KEY = "rebalancer-demo-adv";
  let V = {};
  try { const c = JSON.parse(ls.get(ADV_KEY) || "null"); if (c && c.day === History.etDate()) V = c.V || {}; } catch { V = {}; }
  const vAsked = new Set();
  async function adv(symbols) {
    const need = [...new Set(symbols)].filter((s) => s && !(s in V) && !vAsked.has(s));
    if (need.length && fnOK()) {
      need.forEach((s) => vAsked.add(s));
      try {
        for (let i = 0; i < need.length; i += 25) {
          const d = await callPrices({ action: "volume", symbols: need.slice(i, i + 25) });
          Object.assign(V, d.volume || {});
          for (const s of d.missing || []) V[s] = null;
        }
        ls.set(ADV_KEY, JSON.stringify({ day: History.etDate(), V }));
      } catch (e) { need.forEach((s) => vAsked.delete(s)); console.warn("Couldn't load trading volume", e); throw e; }
    }
    return Object.fromEntries(symbols.map((s) => [s, V[s] === undefined ? undefined : V[s]]));
  }

  // Add cash: a deposit dated the latest close, recorded in the broker and as an entered transfer so reports match.
  const acctName = (id) => (Store.get("accounts", id) || {}).nickname || id;
  function deposit(acct, amount, note) {
    const day = P.last, id = `demo-dep-${Date.now()}`, a = B.accounts[acct];
    a.cash = +(a.cash + amount).toFixed(6);
    B.transfers.push({ id, account: acct, date: day, kind: "deposit", amount, note });
    save();
    const doc = JSON.parse(JSON.stringify(Store.get("accounts", acct) || U.acctDoc(acct)));
    doc.id = acct; doc.transfers = [...(doc.transfers || []), { id, date: day, kind: "deposit", amount, note }].sort((x, y) => (x.date < y.date ? -1 : 1));
    doc.updated = new Date().toISOString();
    Store.put("accounts", acct, doc);
    App.state.balances = {}; App.state.analysis = {}; App.state.home.data = {};
    App.recordHistory(true); App.queueRebuild(acct); App.rerender();
    U.toast(`Added ${U.plainMoney(amount)} to ${acctName(acct)}`);
  }
  function addCash(acct) {
    const ids = Object.keys(B.accounts);
    U.modal({ title: "Add cash", body: `<p>Deposit cash into a demo account. It's dated ${U.esc(P.last)} (the latest close), shows in Transactions and the
        Activity summary, and is ready to invest with an Invest Cash rebalance. No real money moves.</p>
      <div class="add-cash"><label class="fld"><span>Account</span><select id="ac-acct">${ids.map((id) => `<option value="${U.esc(id)}"${id === acct ? " selected" : ""}>${U.esc(acctName(id))} ${U.mask(id)}</option>`).join("")}</select></label>
        <label class="fld"><span>Amount ($)</span><input type="number" id="ac-amt" min="1" max="10000000" step="0.01" placeholder="10000"></label>
        <label class="fld"><span>Note</span><input type="text" id="ac-note" maxlength="80" value="ACH deposit"></label></div>`,
      actions: [{ label: "Cancel" }, { label: "Add cash", primary: true, onClick: (close, host) => {
        const amt = Math.round(+host.querySelector("#ac-amt").value * 100) / 100;
        if (!(amt > 0) || amt > 1e7) { U.toast("Enter an amount between $0.01 and $10,000,000"); return false; }
        deposit(host.querySelector("#ac-acct").value, amt, host.querySelector("#ac-note").value.trim() || "Deposit");
      } }] });
    setTimeout(() => document.getElementById("ac-amt")?.focus(), 0);
  }

  const api = {
    // Only accounts this visitor's saved demo has (a demo saved before the Traditional IRA was added keeps two until Reset demo).
    async accounts() { return ACCOUNTS.filter((a) => B.accounts[a.id]).map((a) => ({ ...a })); },
    async balances(acct) {
      const a = B.accounts[acct], eq = Object.keys(a.lots).reduce((s, sym) => s + held(acct, sym) * (lastClose(sym) || 0), 0);
      const u = unsettled(acct);
      return { cash: a.cash, total: a.cash + eq, equity: eq, buying_power: a.cash, unsettled: Math.min(u.amount, Math.max(0, a.cash)), settles: u.settles };
    },
    async positions(acct) {
      return Object.entries(B.accounts[acct].lots).map(([symbol, lots]) => {
        const shares = lots.reduce((s, l) => s + l.qty, 0), cost = lots.reduce((s, l) => s + l.qty * l.cost, 0);
        return { symbol, shares, avg_cost: shares ? cost / shares : 0 };
      }).filter((p) => p.shares > 1e-6);
    },
    async taxLots(acct, symbol) { return (B.accounts[acct].lots[symbol] || []).map((l) => ({ ...l })); },
    async quotes(symbols) {
      await ensurePrices(symbols);
      return Object.fromEntries(symbols.map((s) => [s, lastClose(s)]).filter(([, p]) => p > 0));
    },
    async historicals(symbols, from, to) {
      await ensurePrices(symbols);
      const out = {};
      for (const s of symbols) { const x = seriesOf(s); out[s] = x ? x.dates.map((d, i) => [d, x.closes[i]]).filter(([d, c]) => c != null && d >= from && d <= to) : []; }
      return out;
    },
    // Any US-listed stock, ETF or fund: the nightly file's securities plus a live ticker search.
    async search(q) {
      const local = Object.keys(P.closes).map((s) => ({ symbol: s, name: nameOf(s) }));
      if (!fnOK() || !String(q || "").trim()) return local;
      try { const d = await callPrices({ action: "search", q }); return [...(d.results || []).map((x) => ({ symbol: x.symbol, name: x.name })), ...local]; }
      catch (e) { console.warn("Ticker search unavailable:", e); return local; }
    },
    async fundamentals(symbols) {
      await ensurePrices(symbols);
      return Object.fromEntries(symbols.map((s) => [s, { symbol: s, name: nameOf(s), description: nameOf(s) ? `${nameOf(s)}. Prices are daily closes (demo).` : "", sector: null,
        industry: null, market_cap: null, pe_ratio: null, dividend_yield: null, high_52_weeks: null, low_52_weeks: null }]));
    },
    async filledOrders(acct) {
      return B.orders.filter((o) => o.account === acct).map((o) => ({ symbol: o.symbol, side: o.side, qty: o.qty, price: o.price, amount: +(o.qty * o.price).toFixed(2), fees: 0, at: o.at, agent: o.agent }));
    },
    async recentOrders(acct, since) {
      return B.orders.filter((o) => o.account === acct && o.at.slice(0, 10) >= since).map((o) => ({ symbol: o.symbol, side: o.side, created: o.at.slice(0, 10) }));
    },
  };

  // Load prices before the app starts; without them the demo falls back to its built-in made-up prices.
  const rhInit = RH.init;
  RH.init = async function () {
    await ready;
    const mode = await rhInit.apply(this, arguments);
    if (mode !== "demo") return mode;
    try {
      const r = await fetch("../data/prices.json", { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      P = { dates: d.dates, closes: d.closes, names: d.names || {}, last: d.dates[d.dates.length - 1] };
      // Prices fetched on demand earlier are reused until a newer close is published.
      try { const c = JSON.parse(ls.get(XKEY) || "null"); if (c && c.last === P.last) X = c.X || {}; } catch { X = {}; }
      try { B = JSON.parse(ls.get(BKEY) || "null"); } catch { B = null; }
      if (!B || !B.accounts) buildHistory();
      await ensurePrices(Object.values(B.accounts).flatMap((a) => Object.keys(a.lots)));
      RH.overrideDemo(api);
      RH.paper = { fill, addCash, adv, lastClose, priceDate: () => P.last, transfers: () => B.transfers };
    } catch (e) { console.warn("Demo prices unavailable; using built-in sample prices.", e); }
    return mode;
  };

  // ---- sample household settings (models, securities, portfolio) ---------------------------------------
  const storeInit = Store.init;
  Store.init = async function () {
    await ready;
    const mode = await storeInit.apply(this, arguments);
    if (Store.mode === "local" && !Store.all("models").length) seed();
    Store.onChange(scheduleSave);
    scheduleSave(); // a new account's starting demo is saved right away
    return mode;
  };

  function seed() {
    const now = new Date().toISOString();
    const put = (c, id, d) => Store.put(c, id, d);
    const sec = (symbol, asset_class, geography, cap_style, location, tlh) => put("securities", symbol,
      { symbol, name: RH.DEMO_NAMES[symbol] || "", asset_class, geography, cap_style, location, global_equivalents: [], tlh_pairs: tlh || [] });
    sec("SPYM", "Equity", "Domestic", "Large Blend", { taxable: 1 }, ["VOO"]);
    sec("VGT", "Equity", "Domestic", "Large Growth", { roth_ira: 1 });
    sec("IWM", "Equity", "Domestic", "Small Blend", { roth_ira: 1 });
    sec("VEA", "Equity", "International", "Large Blend", { taxable: 1 });
    sec("VWO", "Equity", "International", "Large Blend", { taxable: 1 });
    sec("BND", "Fixed Income", "Domestic", null, { roth_ira: 2, taxable: -1 });
    sec("GLDM", "Alternatives", null, null, {});

    const bench = (name, parts) => ({ name, components: parts.map(([n, p, w]) => ({ name: n, proxy: p, weight: w })) });
    const sleeve = (id, name, weight, securities, b) => ({ id, name, weight, securities: securities.map(([symbol, w]) => ({ symbol, weight: w })),
      ...(b ? { benchmark: bench(b[0], [[b[0], b[1], 100]]) } : {}) });
    const models = [
      { id: "demo-m6", name: "Model 6", benchmark: bench("Model 6 Benchmark", [["MSCI ACWI IMI", "VT", 60], ["Bloomberg Global Aggregate (USD hedged)", "BNDW", 40]]),
        sleeves: [sleeve("d6a", "Domestic Equity", 40, [["SPYM", 75], ["IWM", 25]], ["US Total Market (CRSP)", "VTI"]),
          sleeve("d6b", "International Equity", 20, [["VEA", 75], ["VWO", 25]], ["MSCI ACWI ex USA IMI", "IXUS"]),
          sleeve("d6c", "Fixed Income", 35, [["BND", 100]], ["Bloomberg US Aggregate", "AGG"]),
          sleeve("d6d", "Commodity", 4.5, [["GLDM", 100]], ["Gold", "GLDM"]), sleeve("d6e", "Cash", 0.5, [["_CASH", 100]])] },
      { id: "demo-m8", name: "Model 8", benchmark: bench("Model 8 Benchmark", [["MSCI ACWI IMI", "VT", 80], ["Bloomberg Global Aggregate (USD hedged)", "BNDW", 20]]),
        sleeves: [sleeve("d8a", "Domestic Equity", 55, [["SPYM", 60], ["VGT", 25], ["IWM", 15]], ["US Total Market (CRSP)", "VTI"]),
          sleeve("d8b", "International Equity", 25, [["VEA", 70], ["VWO", 30]], ["MSCI ACWI ex USA IMI", "IXUS"]),
          sleeve("d8c", "Fixed Income", 15, [["BND", 100]], ["Bloomberg US Aggregate", "AGG"]),
          sleeve("d8d", "Commodity", 4.5, [["GLDM", 100]], ["Gold", "GLDM"]), sleeve("d8e", "Cash", 0.5, [["_CASH", 100]])] },
      { id: "demo-m10", name: "Model 10", benchmark: bench("Model 10 Benchmark", [["MSCI ACWI IMI", "VT", 100]]),
        sleeves: [sleeve("d10a", "Domestic Equity", 65, [["SPYM", 55], ["VGT", 30], ["IWM", 15]], ["US Total Market (CRSP)", "VTI"]),
          sleeve("d10b", "International Equity", 30, [["VEA", 70], ["VWO", 30]], ["MSCI ACWI ex USA IMI", "IXUS"]),
          sleeve("d10c", "Commodity", 4.5, [["GLDM", 100]], ["Gold", "GLDM"]), sleeve("d10d", "Cash", 0.5, [["_CASH", 100]])] },
    ];
    for (const m of models) put("models", m.id, { ...m, created: now });

    // Two portfolios, so a multiple rebalance works from the start.
    const portfolio = (id, name, accts, model, note) => put("portfolios", id, { ...U.newPortfolio(name), id, account_numbers: accts, model_id: model,
      benchmarks: [{ model_id: model, start: null, end: null }], notes: [{ id: id + "-n1", text: note, created: now, created_label: "Demo" }] });
    portfolio("demo-pf", "Demo Growth Portfolio", ["DEMO0001", "DEMO0002"], "demo-m10",
      "Sample growth portfolio (taxable account and Roth IRA). Run a rebalance, then Submit order to fill it at real closing prices.");
    portfolio("demo-pf-income", "Demo Income Portfolio", ["DEMO0003"], "demo-m6",
      "Sample income portfolio (Traditional IRA). Rebalance it with Demo Growth Portfolio for a multiple rebalance.");
    // Deposits match the paper broker's history so reports reconcile (fixed dates; the broker uses the same ones).
    const deps = (acct) => HISTORY.filter((h) => h.account === acct).map((h) => ({ id: `demo-dep-${h.day}-${acct}`, date: h.day, kind: "deposit", amount: h.deposit, note: h.note }));
    put("accounts", "DEMO0001", { id: "DEMO0001", nickname: "Family Brokerage", set_asides: [{ id: "demo-sa", kind: "dollar", amount: 2000, effective: null, note: "Emergency buffer" }], transfers: deps("DEMO0001") });
    put("accounts", "DEMO0002", { id: "DEMO0002", nickname: "Roth IRA", set_asides: [], transfers: deps("DEMO0002") });
    put("accounts", "DEMO0003", { id: "DEMO0003", nickname: "Traditional IRA", set_asides: [], transfers: deps("DEMO0003") });
    put("settings", "rebalance", { id: "rebalance", ...U.RSET_DEFAULTS });
  }

  // ---- top bar: who's signed in, Log out, Reset demo -------------------------------------------------------
  async function resetDemo() {
    if (Auth.enabled && user) { const { error } = await Auth.client.from("demo_state").delete().eq("user_id", user.id); if (error) console.warn(error); }
    ls.set(VKEY, "reset"); location.reload();
  }
  async function logOut() {
    await saveNow();
    await Auth.client.auth.signOut();
    ls.del(STORE_KEY); ls.del(BKEY); ls.del(OWNER);
    location.href = "../";
  }
  function addControls() {
    const bar = document.querySelector(".appbar");
    if (!bar || bar.querySelector(".reset-demo")) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "reset-demo"; b.textContent = "Reset demo";
    b.title = "Start over with the original sample household";
    b.addEventListener("click", () => U.modal({ title: "Reset the demo?", body: `<p>This puts the sample household back to how it started: original accounts, models, settings and history.
        Your changes and simulated trades are removed${Auth.enabled ? " from your account" : " from this browser"}.</p>`,
      actions: [{ label: "Cancel" }, { label: "Reset demo", danger: true, onClick: () => { resetDemo(); } }] }));
    const add = document.createElement("button");
    add.type = "button"; add.className = "reset-demo add-cash-btn"; add.textContent = "Add cash";
    add.title = "Deposit cash into a demo account";
    add.addEventListener("click", () => (RH.paper ? RH.paper.addCash() : U.toast("The demo is still loading prices. Try again in a moment.")));
    bar.append(add, b);
    if (!Auth.enabled) return;
    ready.then(() => {
      if (!user || bar.querySelector(".user-chip")) return;
      const chip = document.createElement("button");
      chip.type = "button"; chip.className = "user-chip";
      chip.innerHTML = `<span class="user-ic" aria-hidden="true"></span><span class="user-name"></span>`;
      chip.title = `Signed in as ${user.email}. Open user settings.`;
      chip.setAttribute("aria-haspopup", "dialog");
      chip.addEventListener("click", () => openSettings("profile"));
      const out = document.createElement("button");
      out.type = "button"; out.className = "reset-demo log-out"; out.textContent = "Log out";
      out.addEventListener("click", () => { out.disabled = true; out.textContent = "Saving..."; logOut(); });
      bar.append(chip, out);
      paintChip();
      // The app labels local data "Saved in this browser only"; with an account it's saved to the account.
      const modes = document.getElementById("modes");
      const relabel = () => { for (const p of modes.querySelectorAll(".modepill")) if (/browser only/.test(p.textContent)) { p.textContent = "Saved to your account"; p.classList.remove("demo"); } };
      new MutationObserver(relabel).observe(modes, { childList: true, subtree: true }); relabel();
    });
  }

  // ---- user settings (click your name) ---------------------------------------------------------------------
  const meta = () => (user && user.user_metadata) || {};
  const avatarHTML = (size) => meta().avatar_url
    ? `<img class="avatar" src="${U.esc(meta().avatar_url)}" alt="" width="${size}" height="${size}">`
    : `<span class="avatar avatar-letter" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px" aria-hidden="true">${U.esc((Auth.displayName(user)[0] || "?").toUpperCase())}</span>`;
  function paintChip() {
    const chip = document.querySelector(".appbar .user-chip");
    if (!chip) return;
    chip.querySelector(".user-ic").innerHTML = meta().avatar_url ? `<img src="${U.esc(meta().avatar_url)}" alt="">` : U.esc((Auth.displayName(user)[0] || "?").toUpperCase());
    chip.querySelector(".user-name").textContent = Auth.displayName(user);
  }
  async function updateUser(attrs) {
    const { data, error } = await Auth.client.auth.updateUser(attrs);
    if (error) throw error;
    if (data && data.user) user = data.user;
    paintChip();
  }
  // Shrink a picture to 256 px (square, centered) so uploads are small and quick.
  function squareImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(img.width, img.height), c = document.createElement("canvas"); c.width = c.height = 256;
        c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that picture."))), "image/webp", 0.9);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a picture we can read.")); };
      img.src = url;
    });
  }
  async function removeAvatarFiles() {
    const bucket = Auth.client.storage.from("avatars");
    const { data } = await bucket.list(user.id);
    if (data && data.length) await bucket.remove(data.map((f) => `${user.id}/${f.name}`));
  }

  const SECTIONS = [["profile", "Profile"], ["account", "Account"], ["data", "Demo data"], ["delete", "Delete account"]];
  function sectionHTML(k) {
    if (k === "profile") return `<h3>Profile</h3>
      <div class="us-avatar-row">${avatarHTML(72)}
        <div class="us-avatar-actions">
          <label class="btn small">Upload picture<input type="file" id="us-file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label>
          ${meta().avatar_url ? '<button class="btn small" type="button" data-us="remove-pic">Remove picture</button>' : ""}
          <p class="hint">PNG, JPG, WebP or GIF. It's cropped to a square.</p></div></div>
      <label class="fld"><span>Display name</span><input type="text" id="us-name" maxlength="80" value="${U.esc(Auth.displayName(user))}"></label>
      <div class="addrow"><button class="btn primary small" type="button" data-us="save-name">Save name</button></div>`;
    if (k === "account") return `<h3>Account</h3>
      <dl class="us-facts"><div><dt>Email</dt><dd>${U.esc(user.email)}</dd></div>
        <div><dt>Member since</dt><dd>${U.esc(new Date(user.created_at || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }))}</dd></div></dl>
      <h4>Change password</h4>
      <label class="fld"><span>New password</span><input type="password" id="us-pw1" autocomplete="new-password" minlength="8"></label>
      <label class="fld"><span>Confirm new password</span><input type="password" id="us-pw2" autocomplete="new-password" minlength="8"></label>
      <div class="addrow"><button class="btn primary small" type="button" data-us="save-pw">Change password</button></div>
      <h4>Sign out</h4><div class="addrow"><button class="btn small" type="button" data-us="logout">Log out</button></div>`;
    if (k === "data") return `<h3>Demo data</h3>
      <p>Your demo (models, settings, rebalance results and simulated trades) is saved to your account and loads on any device you log in from.</p>
      <div class="addrow"><button class="btn small" type="button" data-us="download">Download my demo</button><span class="hint">A copy of everything, as a JSON file.</span></div>
      <div class="addrow"><button class="btn small danger" type="button" data-us="reset">Reset demo</button><span class="hint">Start over with the original sample household.</span></div>`;
    return `<h3>Delete account</h3>
      <p>This permanently deletes your account, your saved demo and your profile picture. It can't be undone.</p>
      <label class="fld"><span>Type <b>DELETE</b> to confirm</span><input type="text" id="us-confirm" autocomplete="off"></label>
      <div class="addrow"><button class="btn danger" type="button" data-us="delete" disabled>Delete my account</button></div>`;
  }
  function openSettings(start) {
    let tab = start;
    const m = U.modal({ title: "User settings", wide: true, body: `<div class="us"><nav class="us-menu" aria-label="User settings"></nav><div class="us-body"></div></div>
      <p class="us-status" role="status" aria-live="polite"></p>`, actions: [{ label: "Close" }] });
    const host = m.el, nav = host.querySelector(".us-menu"), body = host.querySelector(".us-body"), status = host.querySelector(".us-status");
    const say = (t, bad) => { status.textContent = t || ""; status.className = "us-status" + (bad ? " bad" : t ? " ok" : ""); };
    function show(k) {
      tab = k;
      nav.innerHTML = `<div class="us-who">${avatarHTML(40)}<div><b>${U.esc(Auth.displayName(user))}</b><span>${U.esc(user.email)}</span></div></div>`
        + SECTIONS.map(([key, label]) => `<button type="button" data-tab="${key}" class="${key === k ? "on" : ""}${key === "delete" ? " danger-tab" : ""}"${key === k ? ' aria-current="true"' : ""}>${label}</button>`).join("");
      body.innerHTML = sectionHTML(k);
    }
    show(tab);
    nav.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { say(""); show(b.dataset.tab); } });
    body.addEventListener("input", (e) => { if (e.target.id === "us-confirm") body.querySelector('[data-us="delete"]').disabled = e.target.value.trim() !== "DELETE"; });
    body.addEventListener("change", async (e) => {
      if (e.target.id !== "us-file" || !e.target.files[0]) return;
      const f = e.target.files[0];
      if (!/^image\//.test(f.type)) return say("Choose a picture file.", true);
      if (f.size > 10 * 1024 * 1024) return say("That picture is over 10 MB. Choose a smaller one.", true);
      say("Uploading...");
      try {
        const blob = await squareImage(f), path = `${user.id}/avatar-${Date.now()}.webp`;
        await removeAvatarFiles();
        const { error } = await Auth.client.storage.from("avatars").upload(path, blob, { contentType: "image/webp", upsert: true });
        if (error) throw error;
        const url = Auth.client.storage.from("avatars").getPublicUrl(path).data.publicUrl;
        await updateUser({ data: { avatar_url: url } });
        show("profile"); say("Profile picture updated.");
      } catch (err) { say("Couldn't upload the picture: " + Auth.explain(err), true); }
    });
    body.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-us]"); if (!b) return;
      const act = b.dataset.us;
      try {
        if (act === "save-name") {
          const name = body.querySelector("#us-name").value.trim();
          if (!name) return say("Enter a name.", true);
          b.disabled = true; await updateUser({ data: { name } }); show("profile"); say("Name saved.");
        } else if (act === "remove-pic") {
          b.disabled = true; await removeAvatarFiles(); await updateUser({ data: { avatar_url: null } }); show("profile"); say("Picture removed.");
        } else if (act === "save-pw") {
          const p1 = body.querySelector("#us-pw1").value, p2 = body.querySelector("#us-pw2").value;
          if (p1.length < 8) return say("Use at least 8 characters.", true);
          if (p1 !== p2) return say("The two passwords don't match.", true);
          b.disabled = true; await updateUser({ password: p1 }); show("account"); say("Password changed. Use it next time you log in.");
        } else if (act === "logout") { b.disabled = true; say("Saving..."); await logOut(); }
        else if (act === "download") {
          await saveNow();
          const data = { exported: new Date().toISOString(), account: user.email, version: VERSION, store: JSON.parse(ls.get(STORE_KEY) || "null"), broker: B };
          const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
          a.download = `rebalancer-demo-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove();
          say("Downloaded.");
        } else if (act === "reset") { m.close(); resetDemo(); }
        else if (act === "delete") {
          b.disabled = true; say("Deleting your account...");
          try { await removeAvatarFiles(); } catch { /* the account is deleted regardless */ }
          const { error } = await Auth.client.rpc("delete_my_account");
          if (error) throw error;
          await Auth.client.auth.signOut();
          ls.del(STORE_KEY); ls.del(BKEY); ls.del(OWNER);
          location.href = "../?deleted=1";
        }
      } catch (err) { b.disabled = false; say(Auth.explain(err), true); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addControls); else addControls();
})();
