// Robinhood data through the viewer's connector (read-only tools only), with a labeled demo fallback.
// This module never calls an order-placing tool; none is declared in the page's manifest.
(function (root) {
  "use strict";
  const SERVER = "Robinhood";
  let mcp = null;
  let mode = "pending"; // live | demo

  const TYPE = { individual: "taxable", joint: "taxable", ira_traditional: "traditional_ira", ira_roth: "roth_ira" };
  const LABEL = { individual: "Individual", joint: "Joint", ira_traditional: "Traditional IRA", ira_roth: "Roth IRA" };

  async function init() {
    try { mcp = root.claude && root.claude.use ? await root.claude.use("mcp") : null; } catch { mcp = null; }
    mode = mcp ? "live" : "demo";
    return mode;
  }

  function explain(e) {
    const code = e && e.code;
    const msg = {
      needs_reauth: "Robinhood needs to be reconnected. Reconnect it in claude.ai Settings > Connectors.",
      server_not_connected: "The Robinhood connector isn't added. Add it in claude.ai Settings > Connectors.",
      selection_required: "Choose which Robinhood connector this page should use when Claude asks.",
      not_in_manifest: "Robinhood isn't allowed for this page. Allow it from the page's Permissions menu.",
      blocked_by_policy: "Your organization's policy blocks this Robinhood tool.",
      approval_required: "Your organization requires approval for this Robinhood tool, which pages can't request yet.",
      server_unavailable: "Robinhood didn't respond. Try again in a moment.",
      tool_error: "Robinhood reported an error: " + ((e && e.message) || "unknown"),
    }[code];
    return msg || `Couldn't reach Robinhood${code ? ` (${code})` : ""}. Try again.`;
  }
  class RHError extends Error { constructor(e) { super(explain(e)); this.code = e && e.code; } }

  async function call(tool, input, staleTime = 60000) {
    let attempt = 0;
    for (;;) {
      try {
        const r = await mcp.callTool(SERVER, tool, input, { cache: { staleTime } });
        const p = r.payload;
        return p && typeof p === "object" && "data" in p ? p.data : p;
      } catch (e) {
        if (e && e.retryable && attempt === 0) { attempt++; await new Promise((ok) => setTimeout(ok, Math.min(e.retryAfterMs || 800 + Math.random() * 800, 5000))); continue; }
        throw new RHError(e);
      }
    }
  }
  async function paged(tool, input, key, staleTime) {
    const out = [];
    let cursor = null, pages = 0;
    do {
      const d = (await call(tool, cursor ? { ...input, cursor } : input, staleTime)) || {};
      out.push(...(d[key] || []));
      cursor = d.next || d.next_cursor || null;
    } while (cursor && ++pages < 50);
    return out;
  }
  const num = (v) => (v === null || v === undefined || v === "" ? null : +v);
  const day = (v) => (v ? String(v).slice(0, 10) : null);

  // ---- live reads ----------------------------------------------------------
  const live = {
    async accounts() {
      const d = await call("get_accounts", {}, 300000);
      return (d.accounts || []).filter((a) => !a.deactivated).map((a) => ({
        id: a.account_number, name: a.nickname || LABEL[a.brokerage_account_type] || a.brokerage_account_type,
        type: TYPE[a.brokerage_account_type] || "taxable", type_label: LABEL[a.brokerage_account_type] || a.brokerage_account_type,
        brokerage: a.type, is_default: !!a.is_default }));
    },
    async balances(acct) {
      const d = await call("get_portfolio", { account_number: acct });
      return { cash: num(d.cash) || 0, total: num(d.total_value) || 0, equity: num(d.equity_value) || 0,
               buying_power: num(d.buying_power && d.buying_power.buying_power) };
    },
    async positions(acct) {
      const rows = await paged("get_equity_positions", { account_number: acct }, "positions");
      return rows.filter((p) => !p.type || p.type === "long").map((p) => ({ symbol: String(p.symbol).toUpperCase(),
        shares: num(p.quantity) || 0, avg_cost: num(p.average_buy_price) || 0 })).filter((p) => p.shares > 0);
    },
    async taxLots(acct, symbol) {
      const rows = await paged("get_equity_tax_lots", { account_number: acct, symbol }, "tax_lots");
      return rows.map((l) => ({ qty: num(l.quantity) || 0, cost: num(l.cost_per_share), acquired: day(l.open_date) }))
        .filter((l) => l.qty > 0);
    },
    async shortCalls(acct) {
      const rows = await paged("get_option_positions", { account_number: acct, nonzero: true, type: "short", option_type: "call" }, "positions");
      const out = {};
      for (const p of rows) {
        const sym = String(p.chain_symbol || p.underlying_symbol || p.symbol || "").toUpperCase();
        const q = Math.abs(num(p.quantity) || 0);
        if (sym && q) out[sym] = (out[sym] || 0) + q;
      }
      return out;
    },
    async quotes(symbols) {
      const out = {};
      const list = [...new Set(symbols)].filter(Boolean);
      for (let i = 0; i < list.length; i += 20) {
        const d = await call("get_equity_quotes", { symbols: list.slice(i, i + 20) }, 30000);
        for (const r of d.results || []) {
          const q = r.quote || {};
          const reg = num(q.last_trade_price), ext = num(q.last_non_reg_trade_price);
          const regT = Date.parse(q.venue_last_trade_time || 0), extT = Date.parse(q.venue_last_non_reg_trade_time || 0);
          out[String(q.symbol).toUpperCase()] = ext && extT > regT ? ext : reg || ext;
        }
      }
      return out;
    },
    async search(query) {
      const d = await call("search", { query, limit: 20 }, 300000);
      return (d.results || []).map((r) => ({ symbol: String(r.symbol).toUpperCase(), name: r.simple_name || r.name || "" }));
    },
    async fundamentals(symbols) {
      const out = {};
      for (let i = 0; i < symbols.length; i += 10) {
        const d = await call("get_equity_fundamentals", { symbols: symbols.slice(i, i + 10) }, 3600000);
        for (const r of d.results || []) out[r.symbol] = r;
      }
      return out;
    },
    // Daily closes: {SYM: [[YYYY-MM-DD, close], ...]} (split-adjusted price only; gap-fill bars dropped).
    // adjustment "none" = the prices actually traded that day (for valuing actual share counts); "split" = restated for splits.
    async historicals(symbols, from, to, adjustment = "split") {
      const out = {};
      const list = [...new Set(symbols)].filter(Boolean);
      for (let i = 0; i < list.length; i += 10) {
        const d = await call("get_equity_historicals", { symbols: list.slice(i, i + 10), start_time: from + "T00:00:00Z", end_time: to + "T23:59:59Z", interval: "day", adjustment_type: adjustment }, 3600000);
        for (const r of d.results || []) out[String(r.symbol).toUpperCase()] = (r.bars || []).filter((b) => !b.interpolated)
          .map((b) => [String(b.begins_at).slice(0, 10), +b.close_price]).filter((b) => b[1] > 0);
      }
      return out;
    },
    // Filled orders since a date, for rebuilding history between snapshots.
    // Filled orders (all of them when sinceDate is null), for rebuilding history.
    async filledOrders(acct, sinceDate) {
      const input = { account_number: acct, state: "filled" };
      if (sinceDate) input.created_at_gte = new Date(Date.parse(sinceDate + "T00:00:00Z") - 30 * 86400000).toISOString().slice(0, 10);
      const rows = await paged("get_equity_orders", input, "orders", 60000);
      // A fully filled dollar-based order moved exactly its dollar amount; shares x average price can be off by a fraction of a cent.
      const dollars = (o) => { const d = num(o.dollar_based_amount && o.dollar_based_amount.amount), q = num(o.quantity), c = num(o.cumulative_quantity);
        return d != null && (q == null || c == null || Math.abs(q - c) < 1e-9) ? d : null; };
      return rows.map((o) => ({ symbol: String(o.symbol || "").toUpperCase(), side: String(o.side || "").toLowerCase(),
        qty: num(o.cumulative_quantity) ?? num(o.quantity) ?? 0, price: num(o.average_price) ?? num(o.price) ?? 0,
        amount: dollars(o), fees: num(o.fees) || 0,
        at: o.last_transaction_at || o.updated_at || o.created_at, agent: o.placed_agent || "" }))
        .filter((o) => o.symbol && o.qty > 0 && o.price > 0 && o.at);
    },
    async recentOrders(acct, sinceISO) {
      const rows = await paged("get_equity_orders", { account_number: acct, created_at_gte: sinceISO, state: "filled" }, "orders");
      return rows.map((o) => ({ symbol: String(o.symbol || o.instrument_symbol || o.chain_symbol || "").toUpperCase(),
        side: String(o.side || "").toLowerCase(), created: day(o.created_at || o.last_transaction_at) })).filter((o) => o.symbol);
    },
  };

  // ---- demo data (shown only when the page has no Robinhood access) ---------
  const DEMO_PRICES = { SPYM: 90.58, VGT: 128.34, IWM: 281.51, VWO: 59.57, XLK: 199.85, IEMG: 82.37, VEA: 71.05, VTI: 300.12,
    VXUS: 65.4, BND: 72.9, AGG: 98.7, VOO: 552.3, QQQ: 489.1, SCHB: 25.1, ITOT: 130.2, VEEV: 214.6, VZ: 41.2, VNQ: 92.4, GLDM: 61.5,
    VT: 157.8, BNDW: 65.76, IXUS: 74.1, ACWI: 128.4, EFA: 88.2, IVV: 554.8, GOVT: 23.1, BIL: 91.6, SGOV: 100.5 };
  const DEMO_NAMES = { SPYM: "SPDR Portfolio S&P 500 ETF", VGT: "Vanguard Information Technology ETF", IWM: "iShares Russell 2000 ETF",
    VWO: "Vanguard FTSE Emerging Markets ETF", XLK: "Technology Select Sector SPDR", IEMG: "iShares Core MSCI Emerging Markets ETF",
    VEA: "Vanguard FTSE Developed Markets ETF", VTI: "Vanguard Total Stock Market ETF", VXUS: "Vanguard Total International Stock ETF",
    BND: "Vanguard Total Bond Market ETF", AGG: "iShares Core US Aggregate Bond ETF", VOO: "Vanguard S&P 500 ETF", QQQ: "Invesco QQQ Trust",
    SCHB: "Schwab US Broad Market ETF", ITOT: "iShares Core S&P Total US Stock Market ETF", VEEV: "Veeva Systems", VZ: "Verizon",
    VNQ: "Vanguard Real Estate ETF", GLDM: "SPDR Gold MiniShares" };
  const DEMO_ACCTS = [
    { id: "DEMO0001", name: "Demo Individual", type: "taxable", type_label: "Individual", cash: 8468.7, positions: [
      { symbol: "SPYM", shares: 1300, avg_cost: 74.31, lots: [{ qty: 800, cost: 68.4, acquired: "2023-11-14" }, { qty: 300, cost: 79.1, acquired: "2025-08-04" }, { qty: 200, cost: 91.95, acquired: "2026-06-22" }] },
      { symbol: "VGT", shares: 500, avg_cost: 101.2, lots: [{ qty: 500, cost: 101.2, acquired: "2024-02-09" }] },
      { symbol: "IWM", shares: 180, avg_cost: 262, lots: [{ qty: 180, cost: 262, acquired: "2025-05-19" }] },
      { symbol: "VWO", shares: 150, avg_cost: 63.8, lots: [{ qty: 150, cost: 63.8, acquired: "2025-12-01" }] }] },
    { id: "DEMO0002", name: "Demo Roth IRA", type: "roth_ira", type_label: "Roth IRA", cash: 25000, positions: [] },
  ];
  const demoPaths = {};
  function demoPath(s) {
    if (demoPaths[s]) return demoPaths[s];
    let seed = [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const ds = [];
    for (let d = new Date("2024-01-02T12:00:00Z"); d.toISOString().slice(0, 10) <= "2026-10-02"; d.setUTCDate(d.getUTCDate() + 1))
      if (d.getUTCDay() % 6) ds.push(d.toISOString().slice(0, 10));
    const vol = /BND|AGG|GOVT|BIL|SGOV/.test(s) ? 0.002 : 0.011, steps = ds.map(() => (rnd() - 0.47) * vol * 2);
    let p = DEMO_PRICES[s] || 50;
    const bars = [];
    for (let i = ds.length - 1; i >= 0; i--) { bars.unshift([ds[i], +p.toFixed(2)]); p /= 1 + steps[i]; }
    return (demoPaths[s] = bars);
  }
  const demo = {
    async accounts() { return DEMO_ACCTS.map(({ positions, cash, ...a }) => ({ ...a })); },
    async balances(acct) {
      const a = DEMO_ACCTS.find((x) => x.id === acct);
      const eq = a.positions.reduce((s, p) => s + p.shares * DEMO_PRICES[p.symbol], 0);
      return { cash: a.cash, total: a.cash + eq, equity: eq, buying_power: a.cash };
    },
    async positions(acct) { return DEMO_ACCTS.find((x) => x.id === acct).positions.map(({ lots, ...p }) => ({ ...p })); },
    async taxLots(acct, symbol) { const p = DEMO_ACCTS.find((x) => x.id === acct).positions.find((x) => x.symbol === symbol); return p ? p.lots : []; },
    async shortCalls() { return {}; },
    async quotes(symbols) { return Object.fromEntries(symbols.filter((s) => DEMO_PRICES[s]).map((s) => [s, DEMO_PRICES[s]])); },
    async search(q) { return Object.keys(DEMO_PRICES).map((s) => ({ symbol: s, name: DEMO_NAMES[s] || "" })); },
    async fundamentals(symbols) {
      return Object.fromEntries(symbols.map((s) => [s, { symbol: s, description: DEMO_NAMES[s] ? `${DEMO_NAMES[s]} (demo data).` : "", sector: "Miscellaneous",
        industry: "Investment Trusts Or Mutual Funds", market_cap: null, pe_ratio: null, dividend_yield: null, high_52_weeks: null, low_52_weeks: null }]));
    },
    async recentOrders() { return []; },
    async filledOrders() { return []; },
    // Deterministic made-up price paths that end at the demo prices.
    // One fixed path per symbol (2024-01-02 to 2026-10-02, ending at the demo price), sliced to the range asked for.
    async historicals(symbols, from, to) {
      const out = {};
      for (const s of symbols) out[s] = demoPath(s).filter((b) => b[0] >= from && b[0] <= to);
      return out;
    },
  };

  // Rank suggestions so ticker prefixes come first: typing "VE" lists VEA and VEEV before names that merely contain "ve".
  function rank(query, items) {
    const q = query.trim().toUpperCase();
    const seen = new Map();
    for (const it of items) if (it.symbol && !seen.has(it.symbol)) seen.set(it.symbol, it);
    const score = (it) => it.symbol === q ? 0 : it.symbol.startsWith(q) ? 1 : it.symbol.includes(q) ? 2
      : (it.name || "").toUpperCase().includes(q) ? 3 : 4;
    return [...seen.values()].filter((it) => score(it) < 4 || !q).sort((a, b) => score(a) - score(b) || a.symbol.localeCompare(b.symbol));
  }

  const api = new Proxy({}, { get: (_, k) => (mode === "live" ? live : demo)[k] });
  // The public demo can swap in its own sample-data source (a paper broker at real closing prices); RH.paper is that broker.
  root.RH = { init, api, rank, get mode() { return mode; }, RHError, DEMO_NAMES, DEMO_ACCTS, DEMO_PRICES,
    overrideDemo: (impl) => Object.assign(demo, impl), paper: null };
})(window);
