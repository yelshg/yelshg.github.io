// Account history the app records itself, and the reporting math built on it.
// Robinhood's connector has no deposit/withdrawal history or past account values, so the app saves a
// snapshot of each portfolio account whenever it opens with live data, rebuilds the days in between from
// filled orders, and detects deposits/withdrawals as cash that trades don't explain.
(function (root) {
  "use strict";
  const DAY = 86400000;

  // ---- dates (US Eastern, YYYY-MM-DD strings) ----
  const etDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
  const addDays = (iso, n) => { const t = new Date(iso + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const weekday = (iso) => new Date(iso + "T12:00:00Z").getUTCDay();
  function lastBusinessDay(today = etDate()) { let d = addDays(today, -1); while ([0, 6].includes(weekday(d))) d = addDays(d, -1); return d; }
  function periodStart(kind, asOf, custom, inception) {
    if (kind === "ytd") return asOf.slice(0, 4) + "-01-01";
    if (kind === "qtd") { const m = +asOf.slice(5, 7), q = Math.floor((m - 1) / 3) * 3 + 1; return `${asOf.slice(0, 4)}-${String(q).padStart(2, "0")}-01`; }
    if (kind === "custom" && custom) return custom;
    return inception || asOf;
  }
  function days(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }

  // ---- benchmark index catalog: index name -> ETF that tracks it (Robinhood has no MSCI/Bloomberg index data) ----
  const INDEXES = [
    ["MSCI ACWI IMI", "VT", "Vanguard Total World Stock (FTSE Global All Cap), closest listed proxy"],
    ["MSCI ACWI ex USA IMI", "IXUS", "iShares Core MSCI Total International Stock, tracks the index"],
    ["MSCI ACWI", "ACWI", "iShares MSCI ACWI, tracks the index"],
    ["MSCI EAFE", "EFA", "iShares MSCI EAFE, tracks the index"],
    ["MSCI Emerging Markets IMI", "IEMG", "iShares Core MSCI Emerging Markets, tracks the index"],
    ["US Total Market (CRSP)", "VTI", "Vanguard Total Stock Market, tracks the index"],
    ["S&P 500", "IVV", "iShares Core S&P 500, tracks the index"],
    ["Russell 2000", "IWM", "iShares Russell 2000, tracks the index"],
    ["Nasdaq-100", "QQQ", "Invesco QQQ, tracks the index"],
    ["S&P 500 Information Technology", "XLK", "Technology Select Sector SPDR, tracks the sector"],
    ["Bloomberg Global Aggregate (USD hedged)", "BNDW", "Vanguard Total World Bond, closest listed proxy"],
    ["Bloomberg US Aggregate", "AGG", "iShares Core US Aggregate Bond, tracks the index"],
    ["Bloomberg US Treasury", "GOVT", "iShares US Treasury Bond, tracks the index"],
    ["US Real Estate (MSCI US IMI RE 25/50)", "VNQ", "Vanguard Real Estate, tracks the index"],
    ["Gold", "GLDM", "SPDR Gold MiniShares, tracks gold"],
    ["ICE 0-3 Month US Treasury", "SGOV", "iShares 0-3 Month Treasury Bond, tracks the index"],
    ["Bloomberg US Treasury Bill 1-3 Month", "BIL", "SPDR Bloomberg 1-3 Month T-Bill, tracks the index"],
  ].map(([name, proxy, note]) => ({ name, proxy, note }));

  // ---- cash activity the user enters (or imported from statements) ----
  // Deposits and withdrawals are flows; dividends and interest are income; fees are fees. Older entries have no kind.
  const KINDS = { deposit: "Deposit", withdrawal: "Withdrawal", dividend: "Dividend", interest: "Interest", fee: "Fee" };
  const TX_TYPES = { buy: "Buy", sell: "Sell", ...KINDS };
  const kindOf = (t) => (KINDS[t.kind] ? t.kind : +t.amount >= 0 ? "deposit" : "withdrawal");
  const cents = (v) => Math.round(v * 100) / 100;

  // ---- recording ----
  const docId = (acct, year) => `${acct}-${year}`;
  function recordsFor(acct) {
    const out = {};
    for (const d of Store.all("history")) if (d.account === acct) Object.assign(out, d.days || {});
    return out;
  }
  // Replace an account's whole history with `dayMap` (one document per year; years no longer used are removed).
  async function writeAccount(acct, dayMap) {
    const byYear = {};
    for (const [d, rec] of Object.entries(dayMap)) (byYear[d.slice(0, 4)] = byYear[d.slice(0, 4)] || {})[d] = rec;
    for (const doc of Store.all("history").filter((x) => x.account === acct && !byYear[x.year])) await Store.remove("history", doc.id);
    for (const [year, recs] of Object.entries(byYear))
      await Store.put("history", docId(acct, year), { id: docId(acct, year), account: acct, year, days: recs, updated: new Date().toISOString() });
  }
  async function saveDays(acct, dayMap) {
    const byYear = {};
    for (const [d, rec] of Object.entries(dayMap)) (byYear[d.slice(0, 4)] = byYear[d.slice(0, 4)] || {})[d] = rec;
    for (const [year, recs] of Object.entries(byYear)) {
      const id = docId(acct, year), cur = Store.get("history", id) || { id, account: acct, year, days: {} };
      await Store.put("history", id, { ...cur, days: { ...cur.days, ...recs }, updated: new Date().toISOString() });
    }
  }
  const posMap = (positions) => Object.fromEntries(positions.map((p) => [p.symbol, [p.shares, p.shares * (p.avg_cost || 0)]]));

  // ---- prices ----
  // mode "none": prices as traded that day (values real share counts); "split": restated for splits (benchmarks).
  const priceCache = {};
  async function closes(symbols, from, to, mode = "none") {
    const ck = (s) => s + "|" + mode;
    const need = symbols.filter((s) => !(priceCache[ck(s)] && priceCache[ck(s)].from <= from && priceCache[ck(s)].to >= to));
    if (need.length) {
      const got = await RH.api.historicals(need, addDays(from, -10), to, mode);
      for (const s of need) priceCache[ck(s)] = { from: addDays(from, -10), to, bars: got[s] || [] };
    }
    const out = {};
    for (const s of symbols) out[s] = priceCache[ck(s)].bars;
    return out;
  }
  // Close on or before a date (carry the last close across weekends and holidays).
  function closeOn(bars, d) {
    let lo = 0, hi = bars.length - 1, ans = null;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (bars[mid][0] <= d) { ans = bars[mid][1]; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }

  // ---- observations: what Robinhood showed on a day (from the app, or the scheduled daily snapshot) ----
  function observe(acct, date, cash, positions, at) {
    const rec = { cash, pos: posMap(positions), src: "observed", at: at || new Date().toISOString() };
    const cur = (Store.get("history", docId(acct, date.slice(0, 4))) || {}).days || {};
    if (cur[date] && cur[date].src === "observed" && cur[date].at > rec.at) return Promise.resolve(); // keep the later one
    return saveDays(acct, { [date]: rec });
  }

  /**
   * Recompute an account's history from the ground truth: every filled order, every observation, and the
   * transfers the user entered. Walks forward from the first order/transfer/observation with no cash:
   *  - entered transfers move cash on their dates (flows);
   *  - a buy the cash can't cover is an inferred deposit that day (reinvested dividends count as income);
   *  - splits come from comparing actual and split-adjusted closes;
   *  - on each observed day, whatever still differs (cash, or shares moved in/out) is a deposit/withdrawal
   *    booked that day, and the state resets to what Robinhood showed.
   */
  async function rebuild(acct, progress = () => {}) {
    const recs = recordsFor(acct);
    const observedDays = Object.keys(recs).filter((d) => recs[d].src === "observed").sort();
    if (!observedDays.length) return { done: false };
    const transfers = ((Store.get("accounts", acct) || {}).transfers || []).filter((t) => t.date && +t.amount);
    progress("Reading order history...");
    const orders = (await RH.api.filledOrders(acct, null)).sort((a, b) => (a.at < b.at ? -1 : 1));
    const last = observedDays[observedDays.length - 1];
    const start = [observedDays[0], ...orders.map((o) => etDate(new Date(o.at))), ...transfers.map((t) => t.date)].sort()[0];
    // An observation keeps what Robinhood showed in `observed`; the day's cash/pos are end-of-day after replay.
    const obsOf = (rec) => ({ cash: (rec.observed || rec).cash, pos: (rec.observed || rec).pos || {}, at: rec.at || "" });
    const syms = [...new Set([...orders.map((o) => o.symbol), ...observedDays.flatMap((d) => Object.keys(obsOf(recs[d]).pos))])];
    progress("Reading price history...");
    const [raw, adj] = syms.length ? await Promise.all([closes(syms, start, last, "none"), closes(syms, start, last, "split")]) : [{}, {}];
    const factor = (s, d) => { const r = closeOn(raw[s] || [], d), a = closeOn(adj[s] || [], d); return r && a ? r / a : null; };
    const byDay = {}, tByDay = {};
    for (const o of orders) (byDay[etDate(new Date(o.at))] = byDay[etDate(new Date(o.at))] || []).push(o);
    for (const t of transfers) (tByDay[t.date] = tByDay[t.date] || []).push(t);
    const state = { cash: 0, pos: {} }, out = {};
    let prev = null, lastObs = "";
    const apply = (t, r) => {
      // Cash moved: the order's exact dollar amount when Robinhood gives one, else shares x average price.
      const amt = t.amount != null ? t.amount : t.qty * t.price, fee = +t.fees || 0, [sh, cost] = state.pos[t.symbol] || [0, 0];
      if (fee) { state.cash -= fee; r.fees -= fee; r.tx.push({ type: "fee", symbol: t.symbol, amount: cents(-fee), note: `Order fee on ${t.symbol} ${t.side}` }); }
      if (t.side === "buy") {
        // A buy the cash can't cover (by half a cent or more) was paid for by a deposit or a dividend.
        if (state.cash < amt - 0.005) {
          const short = amt - Math.max(0, state.cash);
          if (t.agent === "drip") { r.income += short; r.tx.push({ type: "dividend", symbol: t.symbol, amount: cents(short), inferred: true, note: "Dividend reinvested (from the reinvestment buy)" }); }
          else { r.flow += short; r.inferred += short; r.tx.push({ type: "deposit", amount: cents(short), inferred: true, note: `Cash needed for the ${t.symbol} buy` }); }
          state.cash += short;
        }
        state.cash -= amt; state.pos[t.symbol] = [sh + t.qty, cost + amt]; r.buys[t.symbol] = (r.buys[t.symbol] || 0) + amt;
        r.tx.push({ type: "buy", symbol: t.symbol, qty: t.qty, price: t.price, amount: cents(-amt), note: t.agent === "drip" ? "Dividend reinvestment" : "" });
      } else {
        const q = Math.min(t.qty, sh), avg = sh ? cost / sh : 0;
        state.cash += amt; r.realized += q * ((t.qty ? amt / t.qty : t.price) - avg); r.sells[t.symbol] = (r.sells[t.symbol] || 0) + amt;
        r.tx.push({ type: "sell", symbol: t.symbol, qty: t.qty, price: t.price, amount: cents(amt), note: "" });
        state.pos[t.symbol] = [sh - q, cost - avg * q];
        if (state.pos[t.symbol][0] <= 1e-6) delete state.pos[t.symbol];
      }
    };
    for (const d of days(start, last)) {
      let changed = false;
      for (const [s, [sh, cost]] of Object.entries(state.pos)) {
        const f0 = prev && factor(s, prev), f1 = factor(s, d);
        if (f0 && f1 && Math.abs(f0 / f1 - 1) > 0.02) { state.pos[s] = [sh * (f0 / f1), cost]; changed = true; }
      }
      prev = d;
      const r = { flow: 0, inferred: 0, income: 0, fees: 0, unrealIn: 0, buys: {}, sells: {}, realized: 0, tx: [] };
      for (const t of tByDay[d] || []) {
        const k = kindOf(t), amt = +t.amount;
        state.cash += amt; changed = true;
        if (k === "deposit" || k === "withdrawal") r.flow += amt; else if (k === "fee") r.fees += amt; else r.income += amt;
        r.tx.push({ type: k, symbol: t.symbol || "", amount: cents(amt), note: t.note || "" });
      }
      const obs = recs[d] && recs[d].src === "observed" ? obsOf(recs[d]) : null;
      const ts = byDay[d] || [];
      for (const t of ts.filter((t) => !obs || t.at <= obs.at)) { apply(t, r); changed = true; }
      if (obs) {
        let shareDiff = 0;
        const shareTx = [];
        for (const s of new Set([...Object.keys(obs.pos || {}), ...Object.keys(state.pos)])) {
          const o = (obs.pos || {})[s] || [0, 0], st = state.pos[s] || [0, 0], dq = o[0] - st[0];
          if (Math.abs(dq) <= 1e-4) continue;
          const px = closeOn(raw[s] || [], d) || 0, basis = dq > 0 ? (o[0] ? o[1] / o[0] : 0) : (st[0] ? st[1] / st[0] : 0);
          shareDiff += dq * px;
          r.unrealIn += dq * (px - basis); // gain already in shares moved in (or out) isn't this period's gain
          if (Math.abs(dq * px) >= 0.05) shareTx.push({ type: dq > 0 ? "deposit" : "withdrawal", symbol: s, qty: dq, price: px, amount: cents(dq * px), inferred: true,
            note: dq > 0 ? "Shares moved in (valued at that day's close)" : "Shares moved out (valued at that day's close)" });
        }
        let cashDiff = obs.cash - state.cash;
        if (cashDiff <= -1) {
          // Cash is gone but we don't know when. Date the withdrawal to the earliest day since the last observation
          // from which the account held at least that much cash the whole time; that's when it could first have left.
          const w = -cashDiff, keys = Object.keys(out).filter((k) => k > lastObs && k < d).sort().reverse();
          let k0 = null;
          for (const k of keys) { if (out[k].cash >= w - 0.05) k0 = k; else break; }
          if (k0) {
            out[k0].flow -= w; out[k0].inferred -= w; out[k0].inferredWithdrawal = (out[k0].inferredWithdrawal || 0) + w;
            (out[k0].tx = out[k0].tx || []).push({ type: "withdrawal", amount: cents(-w), inferred: true, note: "Cash missing at the next snapshot, dated to when it could first have left" });
            for (const k of keys) if (k >= k0) out[k].cash = +(out[k].cash - w).toFixed(6);
            cashDiff = 0;
          }
        }
        // Nothing is ignored, down to half a cent. A small unexplained cash change (under $1, no shares moved) is almost always a
        // dividend, interest or a fee not entered yet, so it's booked as income or a fee; anything bigger is a deposit or withdrawal.
        const small = Math.abs(cashDiff) < 1 && Math.abs(shareDiff) < 0.005;
        if (small && Math.abs(cashDiff) >= 0.005) {
          if (cashDiff > 0) { r.income += cashDiff; r.tx.push({ type: "dividend", amount: cents(cashDiff), inferred: true, note: "Small credit found at a snapshot: likely a dividend or interest not entered yet. Enter it with its date to replace this." }); }
          else { r.fees += cashDiff; r.tx.push({ type: "fee", amount: cents(cashDiff), inferred: true, note: "Small charge found at a snapshot: likely a fee not entered yet. Enter it with its date to replace this." }); }
        } else if (!small) {
          const diff = cashDiff + shareDiff;
          r.flow += diff; r.inferred += diff; r.tx.push(...shareTx);
          if (Math.abs(cashDiff) >= 0.005) r.tx.push({ type: cashDiff > 0 ? "deposit" : "withdrawal", amount: cents(cashDiff), inferred: true, note: "Cash difference found at a snapshot" });
        }
        state.cash = obs.cash; state.pos = JSON.parse(JSON.stringify(obs.pos || {}));
        lastObs = d;
      }
      for (const t of ts.filter((t) => obs && t.at > obs.at)) apply(t, r);
      if (!r.tx.length) delete r.tx;
      if (changed || obs) out[d] = { ...r, cash: +state.cash.toFixed(6), pos: JSON.parse(JSON.stringify(state.pos)), src: obs ? "observed" : "rebuilt", ...(obs ? { at: obs.at } : {}) };
    }
    // Keep each observation as Robinhood showed it, so the next recompute starts from the same facts.
    for (const d of observedDays) { const o = obsOf(recs[d]); out[d].observed = { cash: o.cash, pos: o.pos }; }
    await writeAccount(acct, out);
    return { done: true, from: start };
  }

  // Record today's state for each account and recompute its history.
  async function record(accounts, quotes, progress = () => {}) {
    const today = etDate(), now = new Date().toISOString(), notes = [];
    for (const a of accounts) {
      await observe(a.id, today, a.cash, a.positions, now);
      try { progress(`Updating history for ${a.name}...`); await rebuild(a.id, progress); }
      catch (e) { notes.push(`${a.name}: couldn't update history (${e.message}).`); }
    }
    return notes;
  }

  // Bring in snapshots taken by the scheduled daily task (collection "snapshots"), then recompute.
  async function ingest(accountIds) {
    const touched = new Set();
    for (const s of Store.all("snapshots")) {
      if (!accountIds.includes(s.account) || s.processed) continue;
      await observe(s.account, s.date, +s.cash || 0, (s.positions || []).map((p) => ({ symbol: String(p.symbol).toUpperCase(), shares: +p.shares || 0, avg_cost: +p.avg_cost || 0 })), s.at);
      await Store.put("snapshots", s.id, { ...s, processed: true });
      touched.add(s.account);
    }
    return [...touched];
  }

  // ---- series for a set of accounts ----
  // An account's performance start date (Me > Accounts) drops everything before it: the account joins the reports that
  // day, bringing its value as its starting amount (counted like money moved in, so it isn't a gain).
  const perfStart = (a) => (Store.get("accounts", a) || {}).perf_start || "";
  async function series(accountIds, from, to) {
    const recs = Object.fromEntries(accountIds.map((a) => [a, recordsFor(a)]));
    const startOf = Object.fromEntries(accountIds.map((a) => {
      const first = Object.keys(recs[a]).sort()[0], ps = perfStart(a);
      return [a, first && ps > first ? ps : first];
    }));
    const firsts = accountIds.map((a) => startOf[a]).filter(Boolean).sort();
    if (!firsts.length) return null;
    const inception = firsts[0];
    from = from < inception ? inception : from;
    if (from > to) return { inception, points: [], empty: true };
    const symbols = new Set();
    for (const a of accountIds) for (const r of Object.values(recs[a])) Object.keys(r.pos || {}).forEach((s) => symbols.add(s));
    const px = await closes([...symbols], addDays(from, -1), to);
    const sorted = Object.fromEntries(accountIds.map((a) => [a, Object.keys(recs[a]).sort()]));
    const stateAt = (a, d) => { const ks = sorted[a]; let k = null; for (const x of ks) { if (x <= d) k = x; else break; } return k ? recs[a][k] : null; };
    const points = [];
    for (const d of days(addDays(from, -1), to)) {
      let value = 0, unreal = 0, flow = 0, realized = 0, unrealIn = 0, income = 0, fees = 0;
      const holdings = {}, cash = {}, buys = {}, sells = {}, tx = [];
      for (const a of accountIds) {
        if (!startOf[a] || d < startOf[a]) continue;
        const s = stateAt(a, d);
        if (!s) continue;
        cash[a] = s.cash; value += s.cash;
        for (const [sym, [sh, cost]] of Object.entries(s.pos || {})) {
          const p = closeOn(px[sym] || [], d) ?? 0, v = sh * p;
          value += v; unreal += v - cost;
          (holdings[a] = holdings[a] || {})[sym] = { shares: sh, value: v, cost };
        }
        // On a performance start date, reports begin at that day's close: what the account held going into the day,
        // valued at the close, arrives as its starting amount. The day's trades are listed, but gains count only after the close.
        if (d === startOf[a] && perfStart(a) === d) {
          const prev = stateAt(a, addDays(d, -1));
          if (prev) {
            let pv = prev.cash, pu = 0;
            for (const [sym, [sh, cost]] of Object.entries(prev.pos || {})) { const v = sh * (closeOn(px[sym] || [], d) ?? 0); pv += v; pu += v - cost; }
            flow += pv; unrealIn += pu;
            if (Math.abs(pv) >= 0.005) tx.push({ type: "deposit", amount: cents(pv), inferred: true, account: a, date: d, note: "Starting value on the account's performance start date" });
          }
        }
        const r = recs[a][d];
        if (r) { flow += r.flow || 0; realized += r.realized || 0; unrealIn += r.unrealIn || 0; income += r.income || 0; fees += r.fees || 0;
          for (const t of r.tx || []) tx.push({ ...t, account: a, date: d });
          for (const [k, v] of Object.entries(r.buys || {})) buys[k] = (buys[k] || 0) + v;
          for (const [k, v] of Object.entries(r.sells || {})) sells[k] = (sells[k] || 0) + v; }
      }
      points.push({ date: d, value, unreal, flow, realized, unrealIn, income, fees, holdings, cash, buys, sells, tx });
    }
    return { inception, points: points.slice(1), prior: points[0] };
  }

  // Time-weighted return: each day's growth with that day's deposits/withdrawals taken out.
  function twr(points, prior, pick = (p) => p.value, flowOf = (p) => p.flow) {
    let growth = 1, prev = prior ? pick(prior) : 0;
    const out = prior ? [[prior.date, 0]] : [];
    for (const p of points) {
      const v = pick(p), f = flowOf(p);
      if (prev > 0.005) growth *= (v - f) / prev;
      out.push([p.date, growth - 1]);
      prev = v;
    }
    return out;
  }

  function activity(s) {
    const pts = s.points, last = pts[pts.length - 1], prior = s.prior && s.prior.value > 0 ? s.prior : null;
    const begin = prior ? prior.value : 0, beginUnreal = prior ? prior.unreal : 0;
    const adds = pts.reduce((x, p) => x + Math.max(0, p.flow), 0), wds = pts.reduce((x, p) => x + Math.min(0, p.flow), 0);
    // Unrealized gain earned in the period: the change, less gain that arrived with shares moved in.
    const realized = pts.reduce((x, p) => x + p.realized, 0), end = last ? last.value : 0;
    const unreal = (last ? last.unreal : 0) - beginUnreal - pts.reduce((x, p) => x + (p.unrealIn || 0), 0);
    const income = pts.reduce((x, p) => x + (p.income || 0), 0), fees = pts.reduce((x, p) => x + (p.fees || 0), 0);
    return { begin, adds, wds, realized, unreal, income, fees, other: end - begin - adds - wds - realized - unreal - income - fees, end };
  }

  // Benchmark: a weighted blend of index proxies, rebalanced daily, switching benchmarks on their dates.
  // Dates are as of the close, like performance start dates: a day's return (previous close to that close) belongs to
  // the benchmark in effect at the previous close. So a benchmark starting on a trade date counts from that day's close,
  // and the one it replaces covers the trade date itself.
  async function benchmark(windows, from, to) {
    const active = windows.filter((w) => w.components && w.components.length && (!w.end || w.end >= addDays(from, -1)) && (!w.start || w.start <= to));
    if (!active.length) return null;
    const syms = [...new Set(active.flatMap((w) => w.components.map((c) => c.proxy)))];
    const px = await closes(syms, addDays(from, -1), to, "split");
    let growth = 1, prev = addDays(from, -1);
    const out = [[prev, 0]];
    for (const d of days(from, to)) {
      const w = active.find((x) => (!x.start || x.start <= prev) && (!x.end || x.end >= prev));
      if (w) {
        const tot = w.components.reduce((s, c) => s + (+c.weight || 0), 0) || 1;
        let r = 0;
        for (const c of w.components) { const a = closeOn(px[c.proxy] || [], prev), b = closeOn(px[c.proxy] || [], d); if (a && b) r += ((+c.weight || 0) / tot) * (b / a - 1); }
        growth *= 1 + r;
      }
      out.push([d, growth - 1]);
      prev = d;
    }
    return out;
  }

  // ---- demo history (only when the page has no Robinhood access) ----
  async function seedDemo() {
    if (Store.all("history").some((d) => d.account && d.account.startsWith("DEMO"))) return;
    const pos1 = { SPYM: [1300, 96603], VGT: [500, 50600], IWM: [180, 47160], VWO: [150, 9570] };
    const obs = (cash, pos, date) => ({ cash, pos, src: "observed", at: date + "T21:00:00.000Z" });
    await saveDays("DEMO0001", { "2026-01-02": obs(6468.7, pos1, "2026-01-02"), "2026-06-01": obs(8468.7, pos1, "2026-06-01") });
    await saveDays("DEMO0002", { "2026-01-02": obs(15000, {}, "2026-01-02"), "2026-07-01": obs(25000, {}, "2026-07-01") });
    await Promise.all(["DEMO0001", "DEMO0002"].map((a) => rebuild(a)));
  }

  root.History = { KINDS, TX_TYPES, kindOf, etDate, lastBusinessDay, periodStart, addDays, days, INDEXES, record, rebuild, ingest, observe, series, twr, activity, benchmark, closes, closeOn, recordsFor, seedDemo };
})(window);
