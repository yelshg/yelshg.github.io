// Rebalance engine (JavaScript port of rebal/engine.py). Pure: no DOM, no network.
// Proposes trades only. It never places orders.
(function (root) {
  "use strict";
  const CENT = 0.005, EPS = 1e-6;

  // ---- tax lots ------------------------------------------------------------
  function longTermDate(acquired) {
    const [y, m, d] = acquired.split("-").map(Number);
    let ann = new Date(Date.UTC(y + 1, m - 1, d));
    if (m === 2 && d === 29) ann = new Date(Date.UTC(y + 1, 2, 1));
    ann.setUTCDate(ann.getUTCDate() + 1);
    return ann.toISOString().slice(0, 10);
  }
  const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  const addDays = (iso, n) => { const t = new Date(Date.parse(iso)); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

  function classify(acct, symbol, idx, qty, price, cost, acquired, taxable, asOf, tax) {
    const u = { account: acct, symbol, idx, qty, price, cost, acquired, taxable, term: "deferred", daysToLong: null, blocked: null };
    if (!taxable) return u;
    if (!acquired) u.term = "unknown";
    else {
      const lt = longTermDate(acquired);
      u.term = asOf >= lt ? "long" : "short";
      if (u.term === "short") u.daysToLong = daysBetween(asOf, lt);
    }
    const gain = price - cost;
    if (gain > 0) {
      if (u.term === "short" && tax.avoid_near_lt && u.daysToLong !== null && u.daysToLong <= tax.near_lt_days)
        u.blocked = `short-term gain that turns long-term in ${u.daysToLong} days`;
      else if (u.term === "short" && tax.block_st) u.blocked = "short-term gain";
      else if (u.term === "unknown" && tax.block_st) u.blocked = "gain with unknown holding period (treated as short-term)";
    }
    return u;
  }
  const gainPerShare = (u) => (u.taxable ? u.price - u.cost : 0);
  function taxPerDollar(u, tax) {
    if (!u.taxable) return 0;
    const rate = u.term === "long" ? tax.lt_rate : tax.st_rate;
    return (gainPerShare(u) / u.price) * rate;
  }
  function sortUnits(units, tax) {
    const key = tax.lot_method === "hifo" ? (u) => [u.taxable ? 1 : 0, -u.cost]
      : tax.lot_method === "fifo" ? (u) => [u.taxable ? 1 : 0, u.acquired || "0000"]
      : (u) => [taxPerDollar(u, tax), u.taxable ? 1 : 0, -u.cost];
    return units.slice().sort((a, b) => {
      const ka = key(a), kb = key(b);
      for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
      return 0;
    });
  }

  // ---- planner -------------------------------------------------------------
  class Planner {
    constructor(I) {
      this.I = I;
      this.tax = Object.assign({ block_st: true, near_lt_days: 30, avoid_near_lt: true, lot_method: "min_tax", st_rate: 0.32, lt_rate: 0.15 }, I.tax || {});
      this.messages = [];
      this.skipped = [];
      this.trades = [];
      this.accounts = I.accounts.map((a) => a.id);
      this.acct = Object.fromEntries(I.accounts.map((a) => [a.id, a]));
      this.cash = {}; this.qty = {}; this.lots = {}; this.value = {};
      for (const a of I.accounts) {
        this.cash[a.id] = a.cash;
        this.qty[a.id] = {}; this.lots[a.id] = {};
        for (const p of a.positions) {
          if (!(p.shares > EPS)) continue;
          this.qty[a.id][p.symbol] = (this.qty[a.id][p.symbol] || 0) + p.shares;
          const lots = (p.lots || []).filter((l) => l.qty > EPS).map((l) => ({ qty: l.qty, cost: l.cost, acquired: l.acquired || null }));
          const gap = p.shares - lots.reduce((s, l) => s + l.qty, 0);
          if (gap > EPS) lots.push({ qty: gap, cost: p.avg_cost || 0, acquired: null });
          this.lots[a.id][p.symbol] = lots.map((l) => [l.qty, l]);
        }
        this.value[a.id] = a.cash + a.positions.reduce((s, p) => s + p.shares * this.price(p.symbol), 0);
      }
      this.setAside = Object.fromEntries(this.accounts.map((a) => [a, (I.set_asides || {})[a] || 0]));
      // Cash each account keeps: its set-aside plus its cash target (the model's cash % of the account's market value).
      this.cashTarget = Object.fromEntries(this.accounts.map((a) =>
        [a, Math.max(I.min_cash || 0, (I.cash_target_pct || 0) * this.value[a])]));
      this.reserve = Object.fromEntries(this.accounts.map((a) => [a, this.setAside[a] + this.cashTarget[a]]));
      this.realized = Object.fromEntries(this.accounts.map((a) => [a, { short: 0, long: 0 }]));
      this.noBuy = new Set(I.no_buy || []); this.noSell = new Set(I.no_sell || []); this.altBuy = new Set(I.alt_buy || []);
      this.weights = {};
      for (const [s, w] of Object.entries(I.weights || {})) { const g = this.groupOf(s); this.weights[g] = (this.weights[g] || 0) + w; }
      // Holdings outside the model get a zero target, so they count toward the base and a full rebalance sells them.
      if (I.sell_unmodeled) for (const g of this.heldGroups()) if (!(g in this.weights)) this.weights[g] = 0;
      this.base = Object.keys(this.weights).reduce((s, g) => s + this.groupValue(g), 0)
        + this.sum(this.cash) - this.sum(this.reserve);
      this.targets = this.computeTargets();
    }
    sum(o) { return Object.values(o).reduce((s, v) => s + v, 0); }
    price(s) {
      const p = this.I.prices[s];
      if (!(p > 0)) throw new Error(`No price for ${s}. Refresh quotes and try again.`);
      return p;
    }
    groupOf(s) {
      for (const [p, ms] of Object.entries(this.I.equivalents || {})) if (s === p || ms.includes(s)) return p;
      return s;
    }
    membersOf(g) { return [g, ...((this.I.equivalents || {})[g] || [])]; }
    heldGroups() {
      const out = new Set();
      for (const a of this.accounts) for (const [s, q] of Object.entries(this.qty[a])) if (q > EPS) out.add(this.groupOf(s));
      return out;
    }
    groupValue(g) {
      const m = new Set(this.membersOf(g));
      let v = 0;
      for (const a of this.accounts) for (const [s, q] of Object.entries(this.qty[a])) if (m.has(s)) v += q * this.price(s);
      return v;
    }
    totalValue() { return [...this.heldGroups()].reduce((s, g) => s + this.groupValue(g), 0) + this.sum(this.cash); }
    sellable(a, s) { return !this.noSell.has(s); }
    // The larger of the app-wide minimum trade and the security's own minimum buy or sell.
    minTrade(s, side) { return Math.max(this.I.min_trade || 0, ((this.I.trade_minimums || {})[s] || {})[side] || 0); }
    buySymbol(g) {
      if (!this.noBuy.has(g)) return g;
      for (const s of this.membersOf(g).slice(1)) if (this.altBuy.has(s) && !this.noBuy.has(s)) return s;
      return null;
    }
    leaveInCash(g) { return (this.I.no_buy_action || {})[g] === "cash" && this.buySymbol(g) === null; }
    bandFor(g, w) {
      const b = (this.I.band_overrides || {})[g] || this.I.band || { abs: 0.05, rel: 0.25 };
      return Math.min(b.abs, b.rel * w);
    }

    computeTargets() {
      const free = new Set(Object.keys(this.weights)), pinned = {};
      let t = {};
      for (;;) {
        const room = this.base - this.sum(pinned);
        const wsum = [...free].reduce((s, g) => s + this.weights[g], 0);
        t = Object.fromEntries([...free].map((g) => [g, wsum ? (room * this.weights[g]) / wsum : 0]));
        const stuck = [];
        for (const g of free) {
          const cur = this.groupValue(g);
          const cantSell = !this.accounts.some((a) => this.membersOf(g).some((s) => (this.qty[a][s] || 0) > EPS && this.sellable(a, s)));
          if (cur > t[g] + CENT && cantSell) stuck.push(g);
          else if (cur < t[g] - CENT && this.buySymbol(g) === null && !this.leaveInCash(g)) stuck.push(g);
        }
        if (!stuck.length) break;
        for (const g of stuck) {
          pinned[g] = this.groupValue(g); free.delete(g);
          this.messages.push(`${g} is restricted and was held at its current value ${fmt$(pinned[g])}; its target is pro-rated across the other model securities`);
        }
      }
      for (const g of free) if (this.leaveInCash(g) && t[g] - this.groupValue(g) > CENT)
        this.messages.push(`${g} is never-buy: ${fmt$(t[g] - this.groupValue(g))} of its target stays in cash`);
      return Object.assign(t, pinned);
    }

    rows() {
      const groups = [...new Set([...Object.keys(this.targets), ...this.heldGroups()])]
        .sort((a, b) => (this.targets[b] || 0) - (this.targets[a] || 0) || a.localeCompare(b));
      return groups.map((g) => {
        const w = this.weights[g] || 0, modeled = g in this.weights;
        return { group: g, members: this.membersOf(g), target_weight: w, target_value: this.targets[g] || 0,
                 current_value: this.groupValue(g), threshold: this.bandFor(g, w), modeled };
      });
    }
    drift(r) { return this.base ? (r.current_value - r.target_value) / this.base : 0; }
    outOfBand(r) { return Math.abs(this.drift(r)) > r.threshold + 1e-9; }
    available(a) { return Math.max(0, this.cash[a] - this.reserve[a]); }

    // ---- sells
    units(group, accts) {
      const ok = [], blocked = [];
      for (const a of accts) {
        const taxable = this.acct[a].type === "taxable";
        for (const s of this.membersOf(group)) {
          if ((this.qty[a][s] || 0) <= EPS || !this.sellable(a, s)) continue;
          const price = this.price(s);
          (this.lots[a][s] || []).forEach(([rem, lot], i) => {
            if (rem <= EPS) return;
            const u = classify(a, s, i, rem, price, lot.cost, lot.acquired, taxable, this.I.as_of, this.tax);
            (u.blocked ? blocked : ok).push(u);
          });
        }
      }
      return [sortUnits(ok, this.tax), blocked];
    }
    sellCap(a, s) {
      const held = this.qty[a][s] || 0;
      if (this.I.protect_covered_calls === false) return held;
      return Math.max(0, held - 100 * ((this.acct[a].short_calls || {})[s] || 0));
    }
    gainHeadroom(u, planned) {
      if (!u.taxable) return null;
      const lim = (this.I.gain_limits || {})[u.account] || (this.I.gain_limits || {})["*"];
      if (!lim) return null;
      const done = { short: this.realized[u.account].short + planned.short, long: this.realized[u.account].long + planned.long };
      const rooms = [];
      if (u.term === "long" && lim.long_term != null) rooms.push(lim.long_term - done.long);
      if (u.term !== "long" && lim.short_term != null) rooms.push(lim.short_term - done.short);
      if (lim.total != null) rooms.push(lim.total - done.short - done.long);
      return rooms.length ? Math.max(0, Math.min(...rooms)) : null;
    }
    sell(group, dollars, reason, accts, roundUp = false, unitsOverride = null) {
      if (dollars <= CENT) return 0;
      accts = accts || this.accounts;
      const [units, blocked] = unitsOverride ? [unitsOverride, []] : this.units(group, accts);
      const takes = new Map(), planned = Object.fromEntries(accts.map((a) => [a, { short: 0, long: 0 }])), cap = new Map();
      let left = dollars, gainCapped = false;
      for (const u of units) {
        if (left <= CENT) break;
        const key = u.account + "|" + u.symbol;
        if (!cap.has(key)) cap.set(key, this.sellCap(u.account, u.symbol));
        const used = (takes.get(key) || []).reduce((s, t) => s + t[1], 0);
        let take = Math.min(u.qty, cap.get(key) - used, left / u.price);
        const head = this.gainHeadroom(u, planned[u.account]);
        if (head !== null && gainPerShare(u) > 0) {
          if (head / gainPerShare(u) < take - EPS) gainCapped = true;
          take = Math.min(take, head / gainPerShare(u));
        }
        if (take <= EPS) continue;
        if (!takes.has(key)) takes.set(key, []);
        takes.get(key).push([u, take]);
        if (u.taxable) planned[u.account][u.term === "long" ? "long" : "short"] += take * gainPerShare(u);
        left -= take * u.price;
      }
      if (left > Math.max(CENT, this.I.min_trade || 0)) {
        const why = [];
        if (blocked.length) why.push(`${fmt$(blocked.reduce((s, u) => s + u.qty * u.price, 0))} is in lots held back for tax reasons (${[...new Set(blocked.map((u) => u.blocked))].join("; ")})`);
        if (gainCapped) why.push("the capital-gain limit was reached");
        if ([...cap].some(([k, c]) => { const [a, s] = k.split("|"); return c < (this.qty[a][s] || 0) - EPS; })) why.push("shares covering short calls are protected");
        this.messages.push(`Could only sell ${fmt$(dollars - left)} of the ${fmt$(dollars)} of ${group} wanted (${reason})${why.length ? ": " + why.join("; ") : ""}`);
      }
      let proceeds = 0;
      for (const [key, plan] of takes) {
        const [a, s] = key.split("|"), price = this.price(s);
        let q = plan.reduce((x, t) => x + t[1], 0);
        if (!this.I.fractional) {
          let whole = roundUp ? Math.ceil(q - 1e-9) : Math.round(q);
          whole = Math.min(whole, Math.floor(this.sellCap(a, s) + 1e-9));
          resize(plan, whole - q); q = whole;
        }
        q = Math.round(q * 1e6) / 1e6;
        if (q <= EPS) continue;
        if (q * price < this.minTrade(s, "sell")) { this.skipped.push(`Sell ${q} ${s} in ${this.acct[a].name} (${fmt$(q * price)}) is below the ${fmt$(this.minTrade(s, "sell"))} minimum`); continue; }
        proceeds += this.fillSell(a, s, plan, reason);
      }
      return proceeds;
    }
    fillSell(a, s, plan, reason) {
      const price = this.price(s), fills = [];
      let sold = 0;
      for (const [u, t0] of plan) {
        const slot = this.lots[a][s][u.idx];
        const take = Math.min(t0, slot[0]);
        if (take <= EPS) continue;
        slot[0] -= take; sold += take;
        const gain = u.taxable ? (price - u.cost) * take : 0;
        if (u.taxable) this.realized[a][u.term === "long" ? "long" : "short"] += gain;
        fills.push({ qty: take, cost: u.cost, acquired: u.acquired, term: u.term, gain });
        if (!u.blocked && u.term === "short" && u.daysToLong !== null && u.daysToLong <= this.tax.near_lt_days && gain > 0)
          this.messages.push(`${s} lot from ${u.acquired} sold for a short-term gain; it turns long-term in ${u.daysToLong} days`);
      }
      this.qty[a][s] -= sold;
      this.cash[a] += sold * price;
      this.record({ account: a, symbol: s, side: "sell", qty: sold, price, reasons: [reason], lots: fills });
      return sold * price;
    }
    // ---- buys
    buy(wants, reasons) {
      const avail = Object.fromEntries(this.accounts.map((a) => [a, this.available(a)]));
      const need = Object.values(wants).reduce((s, v) => s + v, 0), budget = this.sum(avail);
      if (need > budget + CENT) {
        const scale = need ? budget / need : 0;
        this.messages.push(`Buys wanted ${fmt$(need)} but only ${fmt$(budget)} of cash is available; scaled buys to ${Math.round(scale * 100)}%`);
        for (const g of Object.keys(wants)) wants[g] *= scale;
      }
      for (const [g, dollars] of Object.entries(wants).sort((x, y) => y[1] - x[1])) {
        const m = new Set(this.membersOf(g));
        // Accounts where this security is preferred (asset location) first, then ones already holding it, then most cash.
        const pref = (a) => ((this.I.location || {})[g] || {})[this.acct[a].type] || 0;
        const order = this.accounts.slice().sort((a, b) => {
          const ha = Object.entries(this.qty[a]).some(([s, q]) => m.has(s) && q > EPS) ? 0 : 1;
          const hb = Object.entries(this.qty[b]).some(([s, q]) => m.has(s) && q > EPS) ? 0 : 1;
          return pref(b) - pref(a) || ha - hb || avail[b] - avail[a];
        });
        let left = dollars;
        const sym = this.buySymbol(g), skippedBefore = this.skipped.length;
        for (const a of order) {
          if (left <= CENT) break;
          if (!sym || avail[a] <= CENT) continue;
          left -= this.buyIn(a, sym, Math.min(left, avail[a]), reasons[g], avail);
        }
        const rounding = this.I.fractional ? 0 : this.price(sym || g);
        // A buy under its minimum is already listed with the skipped trades; don't blame the accounts for it.
        if (left > Math.max(this.I.min_trade || 0, rounding) && this.skipped.length === skippedBefore)
          this.messages.push(`Could not place ${fmt$(left)} of ${g}: no account with spare cash allows it`);
      }
    }
    buyIn(a, sym, amount, reason, avail) {
      const price = this.price(sym);
      const q = this.I.fractional ? Math.floor((amount / price) * 1e6) / 1e6 : Math.floor(amount / price + 1e-9);
      if (q <= EPS) return 0;
      if (q * price < this.minTrade(sym, "buy")) { this.skipped.push(`Buy ${q} ${sym} in ${this.acct[a].name} (${fmt$(q * price)}) is below the ${fmt$(this.minTrade(sym, "buy"))} minimum`); return 0; }
      if (avail) avail[a] -= q * price;
      this.cash[a] -= q * price;
      this.qty[a][sym] = (this.qty[a][sym] || 0) + q;
      (this.lots[a][sym] = this.lots[a][sym] || []).push([q, { qty: q, cost: price, acquired: this.I.as_of }]);
      this.record({ account: a, symbol: sym, side: "buy", qty: q, price, reasons: [reason], lots: [] });
      return q * price;
    }
    record(t) {
      const ex = this.trades.find((x) => x.account === t.account && x.symbol === t.symbol && x.side === t.side);
      if (ex) { ex.qty += t.qty; ex.lots.push(...t.lots); for (const r of t.reasons) if (!ex.reasons.includes(r)) ex.reasons.push(r); }
      else this.trades.push(t);
    }

    // ---- steps
    overweight(g) { return this.groupValue(g) - (this.targets[g] || 0); }
    raiseCash() {
      for (const a of this.accounts) {
        let need = this.reserve[a] - this.cash[a];
        if (need <= CENT) continue;
        need = Math.max(need, this.I.min_trade || 0);
        const reason = `raise cash to the account's cash target plus set-aside (${fmt$(this.reserve[a])})`;
        const held = [...new Set(Object.entries(this.qty[a]).filter(([, q]) => q > EPS).map(([s]) => this.groupOf(s)))].filter((g) => g in this.weights);
        for (const g of held.slice().sort((x, y) => this.overweight(y) - this.overweight(x))) {
          if (need <= CENT || this.overweight(g) <= CENT) break;
          need -= this.sell(g, Math.min(need, this.overweight(g)), reason, [a], true);
        }
        for (const g of held.slice().sort((x, y) => this.groupValue(y) - this.groupValue(x))) {
          if (need <= CENT) break;
          need -= this.sell(g, need, reason, [a], true);
        }
        if (this.reserve[a] - this.cash[a] > CENT) this.messages.push(`${this.acct[a].name}: still ${fmt$(this.reserve[a] - this.cash[a])} short of its cash target plus set-aside`);
      }
    }
    sellOutOfBand() {
      for (const r of this.rows()) {
        if (r.group in this.targets && this.outOfBand(r) && r.current_value > r.target_value) {
          const label = !r.modeled || r.target_weight === 0 ? "unmodeled holding" : "overweight";
          this.sell(r.group, r.current_value - r.target_value, `${label}: ${pctS(this.drift(r))} vs target`);
        }
      }
    }
    outOfBandBuys() {
      const wants = {}, reasons = {};
      for (const r of this.rows()) {
        if (r.modeled && this.outOfBand(r) && r.current_value < r.target_value && this.buySymbol(r.group)) {
          wants[r.group] = r.target_value - r.current_value;
          reasons[r.group] = `underweight: ${pctS(this.drift(r))} vs target`;
        }
      }
      return [wants, reasons];
    }
    sweep(wants, reasons) {
      const budget = this.accounts.reduce((s, a) => s + this.available(a), 0) - Object.values(wants).reduce((s, v) => s + v, 0);
      if (budget < Math.max(this.I.min_trade || 0, CENT)) return;
      const gaps = {};
      for (const [g, t] of Object.entries(this.targets)) {
        if ((this.weights[g] || 0) > 0 && this.buySymbol(g)) {
          const gap = t - this.groupValue(g) - (wants[g] || 0);
          if (gap > CENT) gaps[g] = gap;
        }
      }
      const total = Object.values(gaps).reduce((s, v) => s + v, 0);
      if (total <= CENT) { this.messages.push(`${fmt$(budget)} of spare cash left uninvested: nothing is below target`); return; }
      const spend = Math.min(budget, total);
      for (const [g, gap] of Object.entries(gaps)) { wants[g] = (wants[g] || 0) + (spend * gap) / total; reasons[g] = reasons[g] || "invest cash above the cash target"; }
      if (budget - spend > (this.I.min_trade || 0)) this.messages.push(`${fmt$(budget - spend)} of spare cash left uninvested: holdings are at target`);
    }
    harvest() {
      const T = this.I.tlh || {}, pairs = T.pairs || {}, minD = T.min_loss_dollars ?? 500, minP = T.min_loss_pct ?? 0.05;
      const recentBuys = new Set(T.recent_buys || []), recentSells = new Set(T.recent_loss_sells || []);
      let harvested = 0;
      for (const a of this.accounts) {
        if (this.acct[a].type !== "taxable") continue;
        for (const s of Object.keys(this.qty[a])) {
          if ((this.qty[a][s] || 0) <= EPS || !this.sellable(a, s)) continue;
          const choices = (pairs[s] || []).filter((p) => !this.noBuy.has(p) && this.I.prices[p] > 0);
          const price = this.price(s);
          const lossUnits = [];
          (this.lots[a][s] || []).forEach(([rem, lot], i) => {
            if (rem > EPS && lot.cost > price) lossUnits.push(classify(a, s, i, rem, price, lot.cost, lot.acquired, true, this.I.as_of, this.tax));
          });
          if (!lossUnits.length) continue;
          const loss = lossUnits.reduce((x, u) => x + (u.cost - u.price) * u.qty, 0);
          const basis = lossUnits.reduce((x, u) => x + u.cost * u.qty, 0);
          if (loss < minD || loss / basis < minP) continue;
          if (!choices.length) { this.messages.push(`${s} has a ${fmt$(loss)} harvestable loss in ${this.acct[a].name} but no tax-loss harvesting pair is set up in Securities`); continue; }
          if (recentBuys.has(s)) { this.messages.push(`Skipped harvesting ${s}: it was bought in the last 30 days, so selling at a loss would be a wash sale`); continue; }
          const pair = choices.find((p) => !recentSells.has(p));
          if (!pair) { this.messages.push(`Skipped harvesting ${s}: every pair security was sold at a loss in the last 30 days`); continue; }
          const value = lossUnits.reduce((x, u) => x + u.qty * u.price, 0);
          const reason = `harvest ${fmt$(loss)} loss; replace with ${pair}`;
          const proceeds = this.sell(this.groupOf(s), value, reason, [a], false, sortUnits(lossUnits, this.tax));
          if (proceeds > CENT) {
            this.buyIn(a, pair, proceeds, `tax-loss harvest replacement for ${s}`, null);
            harvested += loss;
            this.messages.push(`Harvested about ${fmt$(loss)} of losses in ${s} (${this.acct[a].name}); bought ${pair}. Don't buy ${s} back in any account before ${addDays(this.I.as_of, 31)}.`);
          }
        }
      }
      if (!harvested) this.messages.push("No losses met the harvesting thresholds " +
        `(at least ${fmt$(minD)} and ${(minP * 100).toFixed(1)}% on a position's loss lots).`);
    }

    classRows() {
      const classOf = this.I.class_of || {}, total = this.totalValue();
      if (total <= 0) return [];
      const target = {}, current = {};
      for (const g of new Set([...Object.keys(this.targets), ...this.heldGroups()])) {
        const n = classOf[g] || "Unclassified";
        target[n] = (target[n] || 0) + (g in this.targets ? this.targets[g] : this.groupValue(g));
        current[n] = (current[n] || 0) + this.groupValue(g);
      }
      return { target, current, total };
    }

    run(kind) {
      const before = this.rows(), cashBefore = { ...this.cash };
      if (kind === "full" || kind === "generate_cash") this.raiseCash();
      let wants = {}, reasons = {};
      if (kind === "full") { this.sellOutOfBand(); [wants, reasons] = this.outOfBandBuys(); }
      if (kind === "full" || kind === "invest_cash") this.sweep(wants, reasons);
      if ((kind === "full" || kind === "invest_cash") && Object.keys(wants).length) this.buy(wants, reasons);
      if (kind === "tlh") this.harvest();
      if (kind === "generate_cash" && this.accounts.every((a) => this.cash[a] >= this.reserve[a] - CENT) && !this.trades.length)
        this.messages.push("No cash needed: every account already holds its cash target and set-aside.");
      return this.view(kind, before, cashBefore);
    }

    view(kind, before, cashBefore) {
      const I = this.I, classOf = I.class_of || {};
      const groups = before.map((r) => ({ group: r.group, members: r.members, cls: classOf[r.group] || "Unclassified",
        target_value: r.modeled ? r.target_value : r.current_value, band: r.threshold, modeled: r.modeled }));
      const groupOf = {};
      for (const g of groups) for (const m of g.members) groupOf[m] = g.group;
      for (const t of this.trades) if (!groupOf[t.symbol]) groupOf[t.symbol] = this.groupOf(t.symbol);
      const trades = this.trades.slice().sort((x, y) => (x.side === "sell" ? 0 : 1) - (y.side === "sell" ? 0 : 1)
        || this.acct[x.account].name.localeCompare(this.acct[y.account].name) || y.qty * y.price - x.qty * x.price);
      const gain = (t, terms) => t.lots.filter((l) => terms.includes(l.term)).reduce((s, l) => s + l.gain, 0);
      return {
        run: Object.assign({ type: KIND_LABEL[kind], kind, as_of: I.as_of }, I.run || {}),
        fractional: !!I.fractional,
        total_value: this.sum(cashBefore) + before.reduce((s, r) => s + r.current_value, 0),
        base: this.base,
        class_band: I.class_band ?? 0.05,
        cash_max_excess_percent: I.cash_band_pct ?? 0.0025,
        cash_target_percent: I.cash_target_pct || 0,
        accounts: I.accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, type_label: TYPE_LABEL[a.type] || a.type,
          taxable: a.type === "taxable", cash: cashBefore[a.id], reserve: this.reserve[a.id], set_aside: this.setAside[a.id],
          cash_target: this.cashTarget[a.id], value: this.value[a.id], cash_band: (I.cash_band_pct ?? 0.0025) * this.value[a.id] })),
        positions: I.accounts.flatMap((a) => a.positions.filter((p) => p.shares > EPS).map((p) => ({ account: a.id, symbol: p.symbol,
          shares: p.shares, price: this.price(p.symbol), avg_cost: p.avg_cost || 0,
          cost: (p.lots || []).reduce((s, l) => s + l.qty * l.cost, 0) || p.shares * (p.avg_cost || 0), group: this.groupOf(p.symbol),
          lots: (p.lots || []).filter((l) => l.qty > EPS).map((l) => ({ qty: l.qty, cost: l.cost ?? p.avg_cost ?? 0, acquired: l.acquired || null })) }))),
        prices: I.prices,
        group_of: groupOf,
        groups,
        orders: trades.map((t) => ({ account: t.account, symbol: t.symbol, side: t.side, shares: Math.round(t.qty * 1e6) / 1e6, price: t.price,
          st_gain: round2(gain(t, ["short", "unknown"])), lt_gain: round2(gain(t, ["long"])), reasons: t.reasons,
          lots: t.lots.map((l) => ({ qty: Math.round(l.qty * 1e6) / 1e6, cost: l.cost, acquired: l.acquired, term: l.term, gain: round2(l.gain) })) })),
        messages: [...new Set(this.messages)],
        skipped: this.skipped,
        models: I.models_display || null,
        root_model: (I.run || {}).model || "",
        symbols: Object.keys(I.prices).sort(),
      };
    }
  }

  function resize(plan, delta) {
    const items = delta < 0 ? plan.slice().reverse() : plan;
    for (const item of items) {
      const [u, take] = item;
      const change = delta < 0 ? Math.max(delta, -take) : Math.min(delta, u.qty - take);
      item[1] += change; delta -= change;
      if (Math.abs(delta) <= EPS) break;
    }
  }
  const round2 = (v) => Math.round(v * 100) / 100;
  function fmt$(v) { return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pctS(v) { return (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%"; }
  const KIND_LABEL = { invest_cash: "Invest Cash", generate_cash: "Generate Cash", full: "Full Rebalance", manual: "Manual Adjustment", tlh: "Tax-Loss Harvesting" };
  const TYPE_LABEL = { taxable: "Taxable", traditional_ira: "Traditional IRA", roth_ira: "Roth IRA" };

  function plan(input) { return new Planner(input).run(input.type); }
  function analyze(input) {
    const p = new Planner(input), rows = p.rows();
    return { base: p.base, total: p.totalValue(), rows: rows.map((r) => ({ ...r, drift: p.drift(r), out: r.modeled && p.outOfBand(r) })),
             reserve: p.reserve, cash: { ...p.cash }, setAside: p.setAside, cashTarget: p.cashTarget, value: p.value,
             classes: p.classRows(), messages: p.messages };
  }
  root.RebalEngine = { plan, analyze, longTermDate, KIND_LABEL, TYPE_LABEL };
})(typeof window !== "undefined" ? window : globalThis);
