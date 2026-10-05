// App shell: menu, routing, edit handlers, rebalance runs, model upload and template download.
(function (root) {
  "use strict";
  const { esc } = U;

  const App = root.App = {
    state: { rhAccounts: null, balances: {}, analysis: {}, analysisAt: "", openAcct: null, openSleeves: new Set(), secSelected: null, fund: {}, resultUI: {},
             uaSel: new Set(), assignMode: "existing", assignPf: null, assignPfName: "", focusModel: false,
             addAcctFor: null, addAcctPick: null, renaming: null, renameDraft: "",
             rbSel: new Set(), rbKind: "invest_cash", rbFilter: "", resFilter: { status: "", pf: "" }, freshResults: new Set(),
             modelPick: {}, historyNote: "",
             home: { pfSel: null, period: "ytd", from: "", asOfMode: "lbd", asOf: "", allocMode: "acct_class", allocOpen: new Set(), targetModel: null, showDrift: false, perfSleeve: "", txTypes: null, txAcctType: "", data: {} } },
    _acctPromise: null,
    rhAccounts() {
      if (!this._acctPromise) this._acctPromise = RH.api.accounts().then((a) => { this.state.rhAccounts = a; rerender(); return a; })
        .catch((e) => { this._acctPromise = null; this.state.rhAccounts = []; U.toast(e.message); throw e; });
      return this._acctPromise;
    },
    async loadBalances(ids) {
      const need = (ids || []).filter((id) => !this.state.balances[id]);
      await Promise.all(need.map((id) => RH.api.balances(id).then((b) => { this.state.balances[id] = b; }).catch(() => {})));
      if (need.length) rerender();
    },
  };

  // The report period, as-of date and portfolio selection stay as the user last set them, across refreshes and reopening.
  const DATE_KEY = "rebal.homeDates", DATE_FIELDS = ["period", "from", "asOfMode", "asOf"];
  try {
    const saved = JSON.parse(localStorage.getItem(DATE_KEY) || "null");
    if (saved) {
      for (const f of DATE_FIELDS) if (typeof saved[f] === "string") App.state.home[f] = saved[f];
      if (Array.isArray(saved.pfSel)) App.state.home.pfSel = new Set(saved.pfSel);
    }
  } catch { /* storage unavailable */ }
  App.saveDates = () => {
    const h = App.state.home, out = Object.fromEntries(DATE_FIELDS.map((f) => [f, h[f]]));
    out.pfSel = h.pfSel ? [...h.pfSel] : null; // null = every portfolio, including ones added later
    try { localStorage.setItem(DATE_KEY, JSON.stringify(out)); } catch { /* storage unavailable */ }
  };

  // ---- routing ----
  const route = () => (location.hash || "#home").slice(1);
  let currentContainer = null;
  // Show the user's account names everywhere: a nickname set in the app replaces Robinhood's name.
  function applyNicknames() {
    for (const a of App.state.rhAccounts || []) {
      if (a.rh_name === undefined) a.rh_name = a.name;
      a.name = (Store.get("accounts", a.id) || {}).nickname || a.rh_name;
    }
  }
  function render() {
    applyNicknames();
    const r = route(), view = document.getElementById("view");
    document.querySelector(".appbar .gear")?.classList.toggle("on", r === "settings");
    document.querySelector(".appbar .support-link")?.classList.toggle("on", r.startsWith("help"));
    for (const a of document.querySelectorAll(".mainnav [data-nav]")) a.classList.toggle("on", r.startsWith(a.dataset.nav) || (a.dataset.nav === "me" && /^(accounts|portfolio|unassigned)/.test(r)) || (a.dataset.nav === "rebalance" && /^(result|rebalance|batch)/.test(r)));
    if (r.startsWith("result-")) {
      const box = document.createElement("div");
      view.replaceChildren(box); currentContainer = box; ResultView.mount(box, r.slice(7)); return;
    }
    currentContainer = null;
    const html = r === "home" ? Reports.shell("home", Views.home()) : r.startsWith("home-") ? Reports.render(r) : r === "accounts" ? Views.accounts() : r === "unassigned" ? Views.unassigned() : r === "portfolios" ? Views.portfolios()
      : r.startsWith("portfolio-") ? Views.portfolioPage(r.slice(10)) : r === "models" ? Views.models()
      : r.startsWith("model-") ? Views.modelPage(r.slice(6)) : r === "securities" ? Views.securities() : r === "results" ? Views.results()
      : r.startsWith("batch-") ? Views.batchPage(r.slice(6)) : r === "orders" ? Views.ordersPage()
      : r === "help" || r.startsWith("help-") ? Help.page(r)
      : r === "rebalance" ? Views.createRebalance() : r === "settings" ? Views.settingsPage() : Views.home();
    view.innerHTML = (Store.error ? `<div class="errorbox">${esc(Store.error)} <button class="linkbtn" type="button" data-act="dismiss-error">Dismiss</button></div>` : "") + html;
  }
  let pending = null;
  function rerender() {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      const a = document.activeElement, id = a && a.id, sel = a && "selectionStart" in a ? [a.selectionStart, a.selectionEnd] : null;
      const drawer = document.querySelector(".drawer"), dscroll = drawer ? drawer.scrollTop : 0;
      // Keep anything typed into search boxes or new-item fields that hasn't been added yet.
      const typed = [...document.querySelectorAll(".picker-in, .acct-picker-in, .model-picker-in, input[id*='-start-'], input[id*='-end-'], textarea[id^='note-new'], input[id^='sleeve-new'], input[id^='msec-w'], #assign-new-name")]
        .filter((n) => n.id && n.value).map((n) => [n.id, n.value]);
      if (currentContainer && currentContainer._rerender && route().startsWith("result-")) currentContainer._rerender(); else render();
      for (const [tid, v] of typed) { const n = document.getElementById(tid); if (n && !n.value) n.value = v; }
      const d2 = document.querySelector(".drawer"); if (d2) d2.scrollTop = dscroll;
      if (id) { const n = document.getElementById(id); if (n) { n.focus({ preventScroll: true }); if (sel && n.setSelectionRange) try { n.setSelectionRange(...sel); } catch { /* number inputs */ } } }
    }, 0);
  }
  App.rerender = rerender;
  function onRoute() {
    const r = route();
    if (r === "accounts") App.state.openAcct = null; // coming to Accounts shows the list, not the last opened account
    render();
    window.scrollTo(0, 0);
    if (r === "home") loadHome();
    if (r === "accounts" || r === "unassigned" || r.startsWith("portfolio-")) App.rhAccounts().then((a) => App.loadBalances(a.map((x) => x.id))).catch(() => {});
    if (r.startsWith("portfolio-") && App.state.focusModel) {
      App.state.focusModel = false;
      App.state.pfTab = { ...(App.state.pfTab || {}), [r.slice(10)]: "details" }; render();
      setTimeout(() => { const s = document.getElementById("p-model"); if (s) { s.scrollIntoView({ block: "start" }); s.querySelector("select")?.focus({ preventScroll: true }); s.classList.add("flash"); } }, 50);
    }
  }

  async function loadHome(force = false) {
    const pfs = Store.all("portfolios");
    if (force) { App.state.analysis = {}; rerender(); }
    for (const pf of pfs) {
      if (App.state.analysis[pf.id] && !force) continue;
      if (!pf.model_id || !pf.account_numbers.length) { App.state.analysis[pf.id] = { error: !pf.model_id ? "Choose a model for this portfolio." : "Add accounts to this portfolio." }; continue; }
      try {
        const data = await U.loadPortfolioData(pf, "invest_cash");
        App.state.analysis[pf.id] = { data: RebalEngine.analyze(U.buildInput(pf, data, "invest_cash")), accounts: data.accounts };
      } catch (e) { App.state.analysis[pf.id] = { error: e.message }; }
      rerender();
    }
    App.state.analysisAt = "updated " + U.nowStamp();
    rerender();
  }

  // ---- edits ----
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function setPath(obj, path, v) {
    const ks = path.split(".");
    let o = obj;
    for (const k of ks.slice(0, -1)) { const key = /^\d+$/.test(k) ? +k : k; if (o[key] == null) o[key] = {}; o = o[key]; }
    o[ks[ks.length - 1]] = v;
  }
  function coerce(t) {
    const ty = t.dataset.type, v = t.type === "checkbox" ? t.checked : t.value;
    if (ty === "num") return Math.max(0, +v || 0);
    if (ty === "numnull") return v === "" ? null : Math.max(0, +v || 0);
    if (ty === "pct") return Math.max(0, +v || 0) / 100;
    if (ty === "date") return v || null;
    if (ty === "pref") return Math.max(-2, Math.min(2, Math.round(+v || 0)));
    if (ty === "bool") return !!v;
    return v;
  }
  function docFor(scope, id) {
    if (scope === "pf") return ["portfolios", clone(Store.get("portfolios", id))];
    if (scope === "acct") return ["accounts", clone(U.acctDoc(id))];
    if (scope === "model") return ["models", clone(Store.get("models", id))];
    if (scope === "sec") return ["securities", clone(Store.get("securities", id) || { symbol: id, global_equivalents: [], tlh_pairs: [] })];
  }
  // ---- account drafts: edits on an opened account wait for Save changes ----
  const draftFor = (id) => {
    if (App.state.openAcct !== id) return null;
    const d = App.state.acctDraft;
    if (d && d.id === id) return d;
    if (d) return null; // another account has unsaved changes; that one is saved or cancelled first
    return (App.state.acctDraft = { id, doc: clone(Store.get("accounts", id) || { id, set_asides: [], min_cash: null }) });
  };
  function saveDraft() {
    const d = App.state.acctDraft;
    if (!d) return;
    const before = Store.get("accounts", d.id) || {};
    const doc = { ...d.doc, id: d.id, updated: new Date().toISOString() };
    App.state.acctDraft = null;
    Store.put("accounts", d.id, doc);
    if (JSON.stringify(before.transfers || []) !== JSON.stringify(doc.transfers || [])) App.queueRebuild(d.id);
    App.state.analysis = {}; App.state.home.data = {};
    U.toast("Changes saved"); rerender();
  }
  function cancelDraft() { App.state.acctDraft = null; App.state.acctRenaming = null; rerender(); }
  // Leaving an account with unsaved changes asks first.
  function guardDraft(go) {
    if (!App.state.acctDraft) return go();
    U.modal({ title: "Unsaved changes", body: "<p>You have unsaved changes to this account.</p>",
      actions: [{ label: "Keep editing" }, { label: "Discard", onClick: () => { App.state.acctDraft = null; go(); } }, { label: "Save changes", primary: true, onClick: () => { saveDraft(); go(); } }] });
  }
  // ---- portfolio drafts: the same for a portfolio's page ----
  const pfDraftFor = (id) => {
    if (route() !== "portfolio-" + id || !Store.get("portfolios", id)) return null;
    const d = App.state.pfDraft;
    if (d && d.id === id) return d;
    if (d) return null;
    return (App.state.pfDraft = { id, doc: clone(Store.get("portfolios", id)) });
  };
  function savePfDraft() {
    const d = App.state.pfDraft;
    if (!d) return;
    App.state.pfDraft = null;
    Store.put("portfolios", d.id, { ...d.doc, updated: new Date().toISOString() });
    App.state.analysis = {}; App.state.home.data = {};
    U.toast("Changes saved"); rerender();
  }
  function guardPfDraft(go) {
    if (!App.state.pfDraft) return go();
    U.modal({ title: "Unsaved changes", body: "<p>You have unsaved changes to this portfolio. A rebalance uses the saved settings.</p>",
      actions: [{ label: "Keep editing" }, { label: "Discard", onClick: () => { App.state.pfDraft = null; App.state.renaming = null; go(); } }, { label: "Save changes", primary: true, onClick: () => { savePfDraft(); go(); } }] });
  }

  // ---- Settings > Rebalance: held as a draft until Save changes ----
  function saveSetDraft() {
    const d = App.state.setDraft;
    if (!d) return;
    App.state.setDraft = null;
    Store.put("settings", "rebalance", { ...d, id: "rebalance", updated: new Date().toISOString() });
    App.state.analysis = {}; App.state.home.data = {};
    U.toast("Settings saved"); rerender();
  }

  function applyBind(t) {
    if (Store.readOnly) return;
    const [scope, id, path] = t.dataset.bind.split(":");
    if (scope === "set") {
      App.state.setDraft = App.state.setDraft || clone(U.rset());
      setPath(App.state.setDraft, path, coerce(t)); rerender(); return;
    }
    const draft = scope === "acct" ? draftFor(id) : scope === "pf" ? pfDraftFor(id) : null;
    const [coll, doc] = draft ? [null, draft.doc] : docFor(scope, id);
    if (!doc) return;
    const v = coerce(t);
    setPath(doc, path, v);
    if (scope === "pf" && /^restrictions\.\d+\.type$/.test(path)) { const r = doc.restrictions[+path.split(".")[1]]; r.action = v === "never_buy" ? r.action || "prorate" : null; r.alternative = null; }
    if (scope === "pf" && /^restrictions\.\d+\.action$/.test(path) && v !== "alternative") doc.restrictions[+path.split(".")[1]].alternative = null;
    if (draft) { rerender(); return; }
    doc.updated = new Date().toISOString();
    Store.put(coll, scope === "sec" ? id : doc.id || id, doc);
    if (scope === "acct" && path.startsWith("transfers.")) App.queueRebuild(id);
    if (scope === "pf" || scope === "acct") App.state.analysis = {};
    App.state.home.data = {};
    rerender();
  }
  const val = (id) => { const n = document.getElementById(id); return n ? n.value.trim() : ""; };
  function mutate(coll, id, fn, fallback) {
    if (Store.readOnly) return U.toast("You can view this page but not change it.");
    const draft = coll === "accounts" ? draftFor(id) : coll === "portfolios" ? pfDraftFor(id) : null;
    if (draft) { const copy = clone(draft.doc); if (fn(copy) !== false) draft.doc = copy; rerender(); return; }
    const doc = clone(Store.get(coll, id) || fallback);
    if (fn(doc) === false) return;
    doc.updated = new Date().toISOString();
    Store.put(coll, id, doc);
    if (coll === "portfolios" || coll === "accounts") App.state.analysis = {};
    App.state.home.data = {};
    rerender();
  }

  const handlers = {
    "dismiss-error": () => { Store.clearError(); rerender(); },
    "acct-open": (b) => guardDraft(() => { App.state.openAcct = App.state.openAcct === b.dataset.acct ? null : b.dataset.acct; App.loadBalances([b.dataset.acct]); rerender();
      if (route() === "accounts") window.scrollTo(0, 0); }),
    "acct-draft-save": () => saveDraft(),
    "acct-draft-cancel": () => cancelDraft(),
    "sa-add": (b) => mutate("accounts", b.dataset.acct, (d) => { d.id = b.dataset.acct; d.set_asides.push({ id: Store.newId("sa"), kind: "dollar", amount: 0, effective: null, note: "" }); }, U.acctDoc(b.dataset.acct)),
    "tr-add": (b) => {
      const date = val("tr-date-" + b.dataset.acct), kind = document.getElementById("tr-kind-" + b.dataset.acct).value, amt = +val("tr-amt-" + b.dataset.acct);
      if (!date) return U.toast("Enter the transfer date");
      if (!(amt > 0)) return U.toast("Enter the amount");
      if (date > History.etDate()) return U.toast("The date can't be in the future");
      mutate("accounts", b.dataset.acct, (d) => { d.id = b.dataset.acct; d.transfers = d.transfers || [];
        d.transfers.push({ id: Store.newId("tr"), date, kind, amount: kind === "withdrawal" || kind === "fee" ? -amt : amt, note: val("tr-note-" + b.dataset.acct) });
        d.transfers.sort((x, y) => (x.date < y.date ? -1 : 1)); }, U.acctDoc(b.dataset.acct));
      for (const f of ["tr-date-", "tr-amt-", "tr-note-"]) { const n = document.getElementById(f + b.dataset.acct); if (n) n.value = ""; }
      App.queueRebuild(b.dataset.acct);
    },
    "paper-add-cash": (b) => RH.paper && RH.paper.addCash(b.dataset.acct),
    "tr-remove": (b) => { mutate("accounts", b.dataset.acct, (d) => { d.transfers.splice(+b.dataset.i, 1); }, U.acctDoc(b.dataset.acct)); App.queueRebuild(b.dataset.acct); },
    "sa-remove": (b) => mutate("accounts", b.dataset.acct, (d) => { d.set_asides.splice(+b.dataset.i, 1); }, U.acctDoc(b.dataset.acct)),
    "pf-acct": (b) => mutate("portfolios", b.dataset.pf, (d) => {
      const on = b.checked, other = Store.all("portfolios").find((p) => p.id !== d.id && p.account_numbers.includes(b.dataset.acct));
      if (on && other) { U.toast(`That account is already in ${other.name}`); b.checked = false; return false; }
      d.account_numbers = on ? [...new Set([...d.account_numbers, b.dataset.acct])] : d.account_numbers.filter((x) => x !== b.dataset.acct);
    }),
    "note-add": (b) => { const text = val("note-new-" + b.dataset.pf); if (!text) return U.toast("Write the note first");
      mutate("portfolios", b.dataset.pf, (d) => { d.notes = d.notes || []; d.notes.push({ id: Store.newId("n"), text, created: new Date().toISOString(), created_label: U.nowStamp() }); }); },
    "note-remove": (b) => mutate("portfolios", b.dataset.pf, (d) => { d.notes.splice(+b.dataset.i, 1); }),
    "eq-add": (b) => {
      const id = b.dataset.pf, primary = val("eq-p-" + id).toUpperCase(), alt = val("eq-a-" + id).toUpperCase(), aih = document.getElementById("eq-h-" + id).checked;
      if (!primary || !alt) return U.toast("Pick both the model security and its equivalent");
      if (primary === alt) return U.toast("Pick two different securities");
      mutate("portfolios", id, (d) => {
        if (d.equivalents.some((e) => e.primary === primary && e.alt === alt)) { U.toast(`${alt} is already an equivalent of ${primary}`); return false; }
        if (d.equivalents.some((e) => e.alt === alt || e.primary === alt)) { U.toast(`${alt} is already in another equivalency`); return false; }
        d.equivalents.push({ primary, alt, alt_if_held: aih }); U.rememberSymbols([primary, alt]);
      });
    },
    "eq-remove": (b) => mutate("portfolios", b.dataset.pf, (d) => { d.equivalents.splice(+b.dataset.i, 1); }),
    "rs-add": (b) => {
      const id = b.dataset.pf, symbol = val("rs-s-" + id).toUpperCase(), type = document.getElementById("rs-t-" + id).value;
      if (!symbol) return U.toast("Pick the security to restrict");
      mutate("portfolios", id, (d) => {
        if (d.restrictions.some((r) => r.symbol === symbol && r.type === type)) { U.toast(`${symbol} already has that restriction`); return false; }
        d.restrictions.push({ symbol, type, action: type === "never_buy" ? "prorate" : null, alternative: null, note: "" }); U.rememberSymbols([symbol]);
      });
    },
    "rs-alt": (b) => { const alt = val(`rs-alt-${b.dataset.pf}-${b.dataset.i}`).toUpperCase(); if (!alt) return U.toast("Pick the alternative security");
      mutate("portfolios", b.dataset.pf, (d) => { const r = d.restrictions[+b.dataset.i]; if (alt === r.symbol) { U.toast("Pick a different security"); return false; } r.alternative = alt; U.rememberSymbols([alt]); }); },
    "rs-remove": (b) => mutate("portfolios", b.dataset.pf, (d) => { d.restrictions.splice(+b.dataset.i, 1); }),
    "gl-add": (b) => mutate("portfolios", b.dataset.pf, (d) => { d.gain_limits.push({ account: "*", max_short_term: null, max_long_term: null, max_total: null }); }),
    "gl-remove": (b) => mutate("portfolios", b.dataset.pf, (d) => { d.gain_limits.splice(+b.dataset.i, 1); }),
    "pf-new": () => U.modal({ title: "New portfolio", body: '<label class="fld"><span>Portfolio name</span><input type="text" id="pf-new-name" placeholder="e.g. Family growth"></label>',
      actions: [{ label: "Cancel" }, { label: "Create", primary: true, onClick: () => { const name = val("pf-new-name"); if (!name) { U.toast("Enter a name"); return false; }
        const pf = U.newPortfolio(name); Store.put("portfolios", pf.id, pf); location.hash = "portfolio-" + pf.id; } }] }),
    "pf-delete": (b) => U.modal({ title: "Delete portfolio", body: `<p>Delete ${esc(Store.get("portfolios", b.dataset.pf).name)}? Its notes and settings go with it. Accounts, models and past results stay.</p>`,
      actions: [{ label: "Cancel" }, { label: "Delete", danger: true, onClick: () => { App.state.pfDraft = null; Store.remove("portfolios", b.dataset.pf); location.hash = "portfolios"; } }] }),
    "refresh-home": () => loadHome(true),
    "run-menu": (b) => guardPfDraft(() => { const p = Store.get("portfolios", b.dataset.pf); if (p && !Views.readiness(p)) App.state.rbSel.add(p.id);
      else if (p) U.toast(`${p.name}: ${Views.readiness(p).toLowerCase()}. Finish it before rebalancing.`); location.hash = "rebalance"; }),
    // Remove a saved security (its class, labels, equivalencies, pairs and asset location). Not while a model holds it,
    // since it would be added straight back.
    "sec-remove": (b) => {
      const sym = b.dataset.sym, inModels = Store.all("models").filter((m) => sym in U.modelSecurities(m));
      if (inModels.length) return U.modal({ title: `Can't remove ${sym}`, body: `<p>${esc(sym)} is in ${inModels.map((m) => `<b>${esc(m.name)}</b>`).join(", ")}.
        Take it out of ${inModels.length > 1 ? "those models" : "that model"} first, then remove it here.</p>`, actions: [{ label: "OK", primary: true }] });
      const refs = [
        ...Store.all("securities").filter((s) => s.symbol !== sym && ((s.global_equivalents || []).some((g) => g.symbol === sym) || (s.tlh_pairs || []).includes(sym))).map((s) => `${s.symbol}'s equivalencies or tax-loss pairs`),
        ...Store.all("portfolios").filter((p) => (p.equivalents || []).some((e) => e.primary === sym || e.alt === sym) || (p.restrictions || []).some((r) => r.symbol === sym || r.alternative === sym)).map((p) => `${p.name}'s equivalencies or restrictions`),
      ];
      U.modal({ title: `Remove ${sym}?`, body: `<p>This removes ${esc(sym)} and its settings (asset class, geography, cap-style, asset location, equivalencies and tax-loss pairs) from Saved securities.</p>
        ${refs.length ? `<p class="warn-text">${esc(sym)} is still named in ${refs.map(esc).join("; ")}. Those stay as they are.</p>` : ""}
        <p class="hint">You can add it again any time by searching for it.</p>`,
        actions: [{ label: "Cancel" }, { label: "Remove", danger: true, onClick: () => {
          Store.remove("securities", sym);
          if (App.state.secSelected === sym) App.state.secSelected = null;
          U.toast(`Removed ${sym}`); rerender(); } }] });
    },
    "tbl-sort": (b) => { App.state.sorts = App.state.sorts || {}; App.state.sorts[b.dataset.table] = { key: b.dataset.key, dir: +b.dataset.dir || 1 }; rerender(); },
    "set-tab": (b) => { App.state.setTab = b.dataset.tab; rerender(); },
    "set-draft-save": () => saveSetDraft(),
    "set-draft-cancel": () => { App.state.setDraft = null; rerender(); },
    "pf-tab": (b) => { App.state.pfTab = App.state.pfTab || {}; App.state.pfTab[b.dataset.pf] = b.dataset.tab; rerender(); },
    "pf-draft-save": () => savePfDraft(),
    "pf-draft-cancel": () => { App.state.pfDraft = null; App.state.renaming = null; rerender(); },
    "pf-acct-open": (b) => { App.state.addAcctFor = b.dataset.pf; App.state.addAcctPick = null; App.rhAccounts().catch(() => {}); rerender(); setTimeout(() => document.getElementById("acct-add-" + b.dataset.pf)?.focus(), 20); },
    "pf-acct-cancel": () => { App.state.addAcctFor = null; App.state.addAcctPick = null; rerender(); },
    "pf-acct-add": (b) => {
      const id = b.dataset.pf, typed = val("acct-add-" + id).toLowerCase(), list = App.state.rhAccounts || [];
      const a = list.find((x) => x.id === App.state.addAcctPick) || list.find((x) => x.id.toLowerCase() === typed || x.name.toLowerCase() === typed);
      if (!a) return U.toast(typed ? "Pick an account from the suggestions" : "Search for an account first");
      const other = Store.all("portfolios").find((p) => p.account_numbers.includes(a.id));
      if (other) return U.toast(other.id === id ? "That account is already in this portfolio" : `That account is already in ${other.name}`);
      mutate("portfolios", id, (d) => { if (d.account_numbers.includes(a.id)) { U.toast("That account is already in this portfolio"); return false; } d.account_numbers = [...d.account_numbers, a.id]; });
      App.state.addAcctPick = null; const n = document.getElementById("acct-add-" + id); if (n) n.value = "";
      App.loadBalances([a.id]); U.toast(`Added ${a.name} ${U.maskText(a.id)}`);
    },
    "pf-acct-remove": (b) => mutate("portfolios", b.dataset.pf, (d) => { d.account_numbers = d.account_numbers.filter((x) => x !== b.dataset.acct); }),
    "pf-rename": (b) => { const d = App.state.pfDraft; App.state.renaming = b.dataset.pf;
      App.state.renameDraft = (d && d.id === b.dataset.pf ? d.doc : Store.get("portfolios", b.dataset.pf)).name; rerender();
      setTimeout(() => { const n = document.getElementById("pf-rename-in"); if (n) { n.focus(); n.select(); } }, 20); },
    "acct-tab": (b) => { App.state.acctTab = App.state.acctTab || {}; App.state.acctTab[b.dataset.acct] = b.dataset.tab; rerender(); },
    "pf-rename-cancel": () => { App.state.renaming = null; rerender(); },
    // Account nicknames live in the app (accounts/{id}.nickname); Robinhood's own name is kept as rh_name.
    "acct-rename": (b) => { const a = (App.state.rhAccounts || []).find((x) => x.id === b.dataset.acct);
      App.state.acctRenaming = b.dataset.acct; App.state.acctRenameDraft = a ? a.name : ""; rerender();
      setTimeout(() => { const n = document.getElementById("acct-rename-in"); if (n) { n.focus(); n.select(); } }, 20); },
    "acct-rename-cancel": () => { App.state.acctRenaming = null; rerender(); },
    "acct-rename-save": (b) => {
      const id = b.dataset.acct, a = (App.state.rhAccounts || []).find((x) => x.id === id), name = val("acct-rename-in");
      const nickname = name && a && name !== a.rh_name ? name : null;
      App.state.acctRenaming = null;
      mutate("accounts", id, (d) => { d.id = id; if (nickname) d.nickname = nickname; else delete d.nickname; }, U.acctDoc(id));
    },
    "pf-rename-save": (b) => {
      const name = val("pf-rename-in");
      if (!name) return U.toast("Enter a name");
      if (Store.all("portfolios").some((p) => p.id !== b.dataset.pf && p.name.toLowerCase() === name.toLowerCase())) return U.toast(`Another portfolio is already named "${name}"`);
      App.state.renaming = null;
      mutate("portfolios", b.dataset.pf, (d) => { d.name = name; });
    },
    "rb-kind": (b) => { App.state.rbKind = b.value; rerender(); },
    "ord-tab": (b) => { App.state.ordersTab = b.dataset.tab; rerender(); },
    "ord-check": (b) => { const s = App.state.ordSel = App.state.ordSel || new Set(); b.checked ? s.add(b.dataset.id) : s.delete(b.dataset.id); rerender(); },
    "ord-check-all": (b) => { const s = App.state.ordSel = new Set(); if (b.checked) for (const n of document.querySelectorAll("[data-act=ord-check]")) s.add(n.dataset.id); rerender(); },
    "ord-submit": () => {
      const ids = [...(App.state.ordSel || [])];
      if (!ids.length) return U.toast("Tick the orders to submit");
      U.modal({ title: "Submit orders", body: `<p>Submit ${ids.length} open order${ids.length === 1 ? "" : "s"}? ${RH.paper ? `Demo orders fill at the latest real closing prices (${esc(RH.paper.priceDate())}), sells first. Nothing real is traded.` : ""}</p>`,
        actions: [{ label: "Cancel" }, { label: "Submit orders", primary: true, onClick: () => {
          const { filled, notes } = App.submitOrders(ids);
          App.state.ordSel = new Set();
          U.toast(`Filled ${filled} order${filled === 1 ? "" : "s"}`);
          if (notes.length) U.modal({ title: "Some orders were rejected", body: `<ul class="notes">${notes.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`, actions: [{ label: "Close" }] });
          rerender();
        } }] });
    },
    "ord-cancel": () => {
      const ids = [...(App.state.ordSel || [])];
      if (!ids.length) return U.toast("Tick the orders to cancel");
      U.modal({ title: "Cancel orders", body: `<p>Cancel ${ids.length} open order${ids.length === 1 ? "" : "s"}? They're removed from the blotter and won't fill.</p>`,
        actions: [{ label: "Keep them" }, { label: "Cancel orders", danger: true, onClick: () => { const n = App.cancelOrders(ids); App.state.ordSel = new Set(); U.toast(`Canceled ${n} order${n === 1 ? "" : "s"}`); rerender(); } }] });
    },
    "ord-latest": () => { App.state.ordersFilter = { pf: (App.state.ordersFilter || {}).pf || "" }; rerender(); },
    "ord-allday": () => { App.state.ordersFilter = { ...(App.state.ordersFilter || {}), from: "", to: "" }; rerender(); },
    // From a submitted result: its portfolio's orders on the day it was submitted.
    "go-orders": (b) => { App.state.ordersTab = b.dataset.tab || "closed"; App.state.ordersFilter = { from: b.dataset.day, to: b.dataset.day, pf: b.dataset.pf || "" }; location.hash = "orders"; },
    "rb-remove": (b) => { App.state.rbSel.delete(b.dataset.pf); rerender(); },
    "rb-run": () => runBatch([...App.state.rbSel].map((id) => Store.get("portfolios", id)).filter(Boolean), App.state.rbKind, (App.state.rbName || "").trim()),
    "batch-rename": (b) => {
      const name = val("batch-name");
      if (!name) return U.toast("Enter a name");
      mutate("batches", b.dataset.id, (d) => { d.name = name; });
      U.toast("Renamed");
    },
    "batch-delete": (b) => {
      const bt = Store.get("batches", b.dataset.id), ids = (bt.result_ids || []).filter((id) => Store.get("results", id));
      U.modal({ title: "Delete multiple rebalance", body: `<p>Delete <b>${esc(bt.name)}</b> and its ${ids.length} result${ids.length === 1 ? "" : "s"}?</p>`,
        actions: [{ label: "Cancel" }, { label: "Delete", danger: true, onClick: () => { for (const id of ids) Store.remove("results", id); Store.remove("batches", bt.id);
          if (route().startsWith("batch-")) location.hash = "results"; } }] });
    },
    "model-new": () => U.modal({ title: "New model", body: '<label class="fld"><span>Model name</span><input type="text" id="m-new-name" placeholder="e.g. Model 10"></label>',
      actions: [{ label: "Cancel" }, { label: "Create", primary: true, onClick: () => { const name = val("m-new-name"); if (!name) { U.toast("Enter a name"); return false; }
        const m = { id: Store.newId("m"), name, sleeves: [{ id: Store.newId("sl"), name: "Core", weight: 100, securities: [] }], created: new Date().toISOString() };
        App.state.openSleeves.add(m.sleeves[0].id); Store.put("models", m.id, m); location.hash = "model-" + m.id; } }] }),
    "model-delete": (b) => { const used = Store.all("portfolios").filter((p) => p.model_id === b.dataset.model);
      U.modal({ title: "Delete model", body: `<p>Delete this model?${used.length ? ` ${used.length} portfolio(s) use it and will need a new model.` : ""}</p>`,
        actions: [{ label: "Cancel" }, { label: "Delete", danger: true, onClick: () => { Store.remove("models", b.dataset.model); location.hash = "models"; } }] }); },
    "model-template": () => downloadTemplate(),
    "sleeve-toggle": (b) => { const s = App.state.openSleeves; s.has(b.dataset.sleeve) ? s.delete(b.dataset.sleeve) : s.add(b.dataset.sleeve); rerender(); },
    "sleeve-add": (b) => { const name = val("sleeve-new-" + b.dataset.model); if (!name) return U.toast("Name the sleeve first");
      mutate("models", b.dataset.model, (m) => { const sl = { id: Store.newId("sl"), name, weight: 0, securities: [] }; m.sleeves.push(sl); App.state.openSleeves.add(sl.id); }); },
    "sleeve-remove": (b) => mutate("models", b.dataset.model, (m) => { m.sleeves.splice(+b.dataset.i, 1); }),
    "msec-add": (b) => { const inp = document.getElementById(`msec-${b.dataset.model}-${b.dataset.i}`);
      const typed = val(`msec-${b.dataset.model}-${b.dataset.i}`).toUpperCase();
      const sym = (inp && inp.dataset.pick === U.CASH) || U.isCash(typed) ? U.CASH : typed, w = +val(`msec-w-${b.dataset.model}-${b.dataset.i}`) || 0;
      if (!sym) return U.toast("Pick a security");
      if (!U.isCash(sym) && !/^[A-Z0-9][A-Z0-9.\-]{0,11}$/.test(sym)) return U.toast(`"${sym}" isn't a ticker. Pick a security from the suggestions.`);
      mutate("models", b.dataset.model, (m) => { const sl = m.sleeves[+b.dataset.i]; if (sl.securities.some((s) => s.symbol === sym)) { U.toast(`${U.symLabel(sym)} is already in this sleeve`); return false; }
        if (U.isCash(sym) && m.sleeves.some((x) => x.securities.some((s) => U.isCash(s.symbol)))) { U.toast("This model already has a cash line"); return false; }
        sl.securities.push({ symbol: sym, weight: w }); if (!U.isCash(sym)) U.rememberSymbols([sym]); }); },
    "msec-remove": (b) => mutate("models", b.dataset.model, (m) => { m.sleeves[+b.dataset.i].securities.splice(+b.dataset.j, 1); }),
    "sec-open": () => { const inp = document.getElementById("sec-search"); openSecurity(inp && inp.dataset.pick === U.CASH ? U.CASH : val("sec-search").toUpperCase()); },
    "sec-pick": (b) => openSecurity(b.dataset.sym),
    "sec-suggest": (b) => mutate("securities", b.dataset.sym, (d) => { d.symbol = b.dataset.sym; d.asset_class = b.dataset.cls; }, { symbol: b.dataset.sym, global_equivalents: [], tlh_pairs: [] }),
    "ge-add": (b) => { const alt = val("ge-new").toUpperCase(), s = b.dataset.sym; if (!alt || alt === s) return U.toast("Pick a different security");
      mutate("securities", s, (d) => { d.symbol = s; d.global_equivalents = d.global_equivalents || []; if (d.global_equivalents.some((g) => g.symbol === alt)) return false; d.global_equivalents.push({ symbol: alt, alt_if_held: false }); }, { symbol: s, global_equivalents: [], tlh_pairs: [] }); },
    "ge-remove": (b) => mutate("securities", b.dataset.sym, (d) => { d.global_equivalents.splice(+b.dataset.i, 1); }),
    "tlh-add": (b) => { const p = val("tlh-new").toUpperCase(), s = b.dataset.sym; if (!p || p === s) return U.toast("Pick a different security");
      mutate("securities", s, (d) => { d.symbol = s; d.tlh_pairs = d.tlh_pairs || []; if (d.tlh_pairs.includes(p)) return false; d.tlh_pairs.push(p); }, { symbol: s, global_equivalents: [], tlh_pairs: [] }); },
    "tlh-remove": (b) => mutate("securities", b.dataset.sym, (d) => { d.tlh_pairs.splice(+b.dataset.i, 1); }),
    "ua-check": (b) => { b.checked ? App.state.uaSel.add(b.dataset.acct) : App.state.uaSel.delete(b.dataset.acct); rerender(); },
    "ua-all": (b) => {
      const assigned = new Set(Store.all("portfolios").flatMap((p) => p.account_numbers));
      App.state.uaSel = new Set(b.checked ? (App.state.rhAccounts || []).filter((a) => !assigned.has(a.id)).map((a) => a.id) : []);
      rerender();
    },
    "ua-mode": (b) => { App.state.assignMode = b.value; rerender(); setTimeout(() => document.getElementById(b.value === "new" ? "assign-new-name" : "assign-pf")?.focus(), 20); },
    "ua-assign-existing": () => {
      const ids = [...App.state.uaSel], typed = val("assign-pf");
      const pf = Store.get("portfolios", App.state.assignPf) && Store.get("portfolios", App.state.assignPf).name === typed ? Store.get("portfolios", App.state.assignPf)
        : Store.all("portfolios").find((p) => p.name.toLowerCase() === typed.toLowerCase());
      if (!pf) return U.toast(typed ? `No portfolio named "${typed}". Pick one from the suggestions.` : "Search for a portfolio first");
      mutate("portfolios", pf.id, (d) => { d.account_numbers = [...new Set([...d.account_numbers, ...ids])]; });
      App.state.uaSel = new Set(); App.state.assignPf = null; App.state.assignPfName = "";
      U.modal({ title: "Accounts added", body: `<p>Added ${ids.length} account${ids.length > 1 ? "s" : ""} to <button class="linkbtn big" type="button" data-modal-act="1">${esc(pf.name)}</button>.</p>`,
        actions: [{ label: "Close" }, { label: "Open portfolio", primary: true, onClick: () => { location.hash = "portfolio-" + pf.id; } }] });
    },
    "ua-assign-new": () => {
      const ids = [...App.state.uaSel], name = val("assign-new-name");
      if (!name) return U.toast("Name the new portfolio first");
      if (Store.all("portfolios").some((p) => p.name.toLowerCase() === name.toLowerCase())) return U.toast(`A portfolio named "${name}" already exists. Use "Add to an existing portfolio".`);
      const pf = U.newPortfolio(name);
      pf.account_numbers = ids;
      Store.put("portfolios", pf.id, pf);
      App.state.uaSel = new Set();
      const n = document.getElementById("assign-new-name"); if (n) n.value = "";
      const go = () => { App.state.focusModel = true; location.hash = "portfolio-" + pf.id; };
      U.modal({ title: "Portfolio created", body: `<p>Created <button class="linkbtn big" type="button" data-modal-act="1">${esc(pf.name)}</button> with ${ids.length} account${ids.length > 1 ? "s" : ""}.</p>
          <p>To finish setting it up, click the portfolio name and assign its target model.</p>`,
        actions: [{ label: "Later" }, { label: "Assign target model", primary: true, onClick: go }] });
    },
    // Home reporting
    "home-pf": (b) => { const h = App.state.home; h.pfSel = h.pfSel || new Set(Store.all("portfolios").map((p) => p.id));
      b.checked ? h.pfSel.add(b.dataset.pf) : h.pfSel.delete(b.dataset.pf);
      if (Store.all("portfolios").every((p) => h.pfSel.has(p.id))) h.pfSel = null;
      h.data = {}; App.saveDates(); rerender(); },
    "home-pf-all": (b) => { const h = App.state.home; h.pfSel = b.checked ? null : new Set(); h.data = {}; App.saveDates(); rerender(); },
    "alloc-toggle": (b) => { const h = App.state.home, o = h.allocOpen, k = b.dataset.key;
      h.allocAll = false;
      if (o.has(k)) { for (const x of [...o]) if (x === k || x.startsWith(k + "|")) o.delete(x); } else o.add(k); rerender(); },
    // Expand all: the report opens every row as it draws (allocAll); collapse all closes them.
    "alloc-expand": (b) => { const h = App.state.home; h.allocOpen = new Set(); h.allocAll = !!b.dataset.all; rerender(); },
    "asof-set": (b) => { const h = App.state.home; h.asOfMode = "custom"; h.asOf = b.dataset.date; App.saveDates(); rerender(); },
    "toggle-drift": () => { App.state.home.showDrift = !App.state.home.showDrift; rerender(); },
    "perf-sleeve": (b) => { App.state.home.perfSleeve = b.dataset.id; rerender(); },
    // txTypes null = every type; ticking one off starts an explicit set.
    "tx-type": (b) => { const h = App.state.home; h.txTypes = h.txTypes || new Set(Object.keys(History.TX_TYPES));
      b.checked ? h.txTypes.add(b.dataset.type) : h.txTypes.delete(b.dataset.type);
      if (h.txTypes.size === Object.keys(History.TX_TYPES).length) h.txTypes = null; rerender(); },
    "tx-type-all": (b) => { App.state.home.txTypes = b.checked ? null : new Set(); rerender(); },
    "report-refresh": async () => { App.state.home.data = {}; await recordHistory(true); rerender(); },
    // Reporting targets and benchmarks on a portfolio
    "win-add": (b) => {
      const id = b.dataset.pf, field = b.dataset.field, inputId = `${field}-new-${id}`, typed = val(inputId).toLowerCase();
      const kind = field === "benchmarks" ? "bench" : "model";
      const pool = Store.all("models").filter((m) => kind === "model" || m.benchmark);
      const m = Store.get("models", App.state.modelPick[inputId]) || pool.find((x) => (kind === "bench" ? x.benchmark.name : x.name).toLowerCase() === typed);
      if (!m) return U.toast(kind === "bench" ? "Pick a model benchmark from the suggestions" : "Pick a saved model from the suggestions");
      const start = val(`${field}-start-${id}`) || null, end = val(`${field}-end-${id}`) || null;
      if (start && end && start > end) return U.toast("The start date is after the end date");
      if (b.dataset.scope === "acct") mutate("accounts", id, (d) => { d.id = id; d[field] = d[field] || []; d[field].push({ model_id: m.id, start, end }); }, U.acctDoc(id));
      else mutate("portfolios", id, (d) => { d[field] = d[field] || []; d[field].push({ model_id: m.id, start, end }); });
      delete App.state.modelPick[inputId];
    },
    "win-remove": (b) => b.dataset.scope === "acct"
      ? mutate("accounts", b.dataset.pf, (d) => { d[b.dataset.field].splice(+b.dataset.i, 1); }, U.acctDoc(b.dataset.pf))
      : mutate("portfolios", b.dataset.pf, (d) => { d[b.dataset.field].splice(+b.dataset.i, 1); }),
    // Benchmarks on a model
    "bm-create": (b) => mutate("models", b.dataset.model, (m) => { m.benchmark = { name: `${m.name} Benchmark`, components: [] }; }),
    "bm-add": async (b) => {
      const mid = b.dataset.model, sel = document.getElementById("bm-idx-" + mid).value, w = +val("bm-w-" + mid) || 0;
      let comp;
      if (sel === "__custom") {
        const t = val("bm-custom-" + mid).toUpperCase();
        if (!t) return U.toast("Pick the custom ticker in the search box");
        comp = { name: t, proxy: t, weight: w };
      } else { const ix = History.INDEXES.find((x) => x.proxy === sel); comp = { name: ix.name, proxy: ix.proxy, weight: w }; }
      if (!(w > 0)) return U.toast("Enter a weight above zero");
      mutate("models", mid, (m) => { if (m.benchmark.components.some((c) => c.proxy === comp.proxy)) { U.toast(`${comp.name} is already in the benchmark`); return false; } m.benchmark.components.push(comp); });
    },
    "bm-remove": (b) => mutate("models", b.dataset.model, (m) => { m.benchmark.components.splice(+b.dataset.i, 1); }),
    "sleeve-bench": (b) => mutate("models", b.dataset.model, (m) => {
      const sl = m.sleeves[+b.dataset.i], ix = History.INDEXES.find((x) => x.proxy === b.value);
      sl.benchmark = ix ? { name: ix.name, components: [{ name: ix.name, proxy: ix.proxy, weight: 100 }] } : null;
    }),
    "sleeve-bench-use": (b) => mutate("models", b.dataset.model, (m) => {
      const ix = History.INDEXES.find((x) => x.proxy === b.dataset.proxy);
      m.sleeves[+b.dataset.i].benchmark = { name: ix.name, components: [{ name: ix.name, proxy: ix.proxy, weight: 100 }] };
    }),
    "result-delete": (b) => U.modal({ title: "Delete result", body: "<p>Delete this rebalance result?</p>", actions: [{ label: "Cancel" }, { label: "Delete", danger: true, onClick: () => Store.remove("results", b.dataset.id) }] }),
  };

  async function openSecurity(sym) {
    if (!sym) return U.toast("Search for a security first");
    // Uninvested cash, however it was typed, is shown as cash and never looked up or saved as a security.
    if (U.isCash(sym) || /^(CASH \(UNINVESTED\)|UNINVESTED CASH)$/.test(sym)) { App.state.secSelected = U.CASH; return rerender(); }
    if (!/^[A-Z0-9][A-Z0-9.\-]{0,11}$/.test(sym)) return U.toast(`"${sym}" isn't a ticker. Pick a security from the suggestions.`);
    App.state.secSelected = sym; rerender();
    if (App.state.fund[sym] && !App.state.fund[sym].error) return;
    delete App.state.fund[sym];
    try {
      const f = (await RH.api.fundamentals([sym]))[sym];
      App.state.fund[sym] = f || { error: `No Robinhood data for ${sym}.` };
      if (f && !Store.get("securities", sym)) { /* not saved until the user sets something */ }
      const name = (await RH.api.search(sym)).find((x) => x.symbol === sym);
      if (name) App.state.fund[sym].name = name.name;
    } catch (e) { App.state.fund[sym] = { error: e.message }; }
    rerender();
  }

  // ---- rebalance ----
  async function runOne(pf, kind, status, batchId = null) {
    const probs = U.modelProblems(Store.get("models", pf.model_id));
    if (probs.length) throw new Error(`Fix the model first: ${probs.join(" ")}`);
    const data = await U.loadPortfolioData(pf, kind, status);
    status("Calculating...");
    const view = RebalEngine.plan(U.buildInput(pf, data, kind));
    if (data.recent && data.recent.unchecked) view.messages.push("Couldn't read recent orders for every account, so wash sales were only partly checked.");
    if (RH.mode === "demo") view.messages.unshift("Demo data: this page couldn't reach Robinhood, so it used sample positions.");
    const id = Store.newId("r");
    await Store.put("results", id, { id, portfolio_id: pf.id, portfolio_name: pf.name, kind, kind_label: RebalEngine.KIND_LABEL[kind],
      created: new Date().toISOString(), created_label: U.nowStamp(), status: "proposed", view, model_snapshot: data.model, edits: null, batch_id: batchId });
    return id;
  }
  // One portfolio: a single result. Several: a multiple rebalance (a named batch) holding one result per portfolio.
  async function runBatch(pfs, kind, name = "") {
    if (!pfs.length) return U.toast("Add at least one portfolio");
    pfs = pfs.slice().sort((a, b) => a.name.localeCompare(b.name));
    const label = RebalEngine.KIND_LABEL[kind], multi = pfs.length > 1;
    const batchId = multi ? Store.newId("b") : null;
    const m = U.modal({ title: `${label}`, body: '<div class="progress"><span class="spinner" aria-hidden="true"></span><span id="run-status">Starting...</span></div>', actions: [] });
    const done = [], failed = [];
    for (const [i, pf] of pfs.entries()) {
      const prefix = multi ? `${i + 1} of ${pfs.length}, ${pf.name}: ` : `${pf.name}: `;
      const status = (t) => { const n = document.getElementById("run-status"); if (n) n.textContent = prefix + t; };
      try { done.push(await runOne(pf, kind, status, batchId)); } catch (e) { failed.push([pf.name, e.message]); }
    }
    if (multi && done.length) await Store.put("batches", batchId, { id: batchId, name: name || Views.defaultBatchName(kind, pfs.length), kind, kind_label: label,
      created: new Date().toISOString(), created_label: U.nowStamp(), result_ids: done, portfolio_ids: pfs.map((p) => p.id), failed });
    const all = Store.all("results").sort((a, b) => (a.created > b.created ? 1 : -1));
    for (const x of all.slice(0, Math.max(0, all.length - 60))) Store.remove("results", x.id);
    for (const b of Store.all("batches")) if (!(b.result_ids || []).some((id) => Store.get("results", id))) Store.remove("batches", b.id);
    m.close();
    App.state.rbSel = new Set(); App.state.rbName = "";
    App.state.freshResults = new Set(done);
    if (!multi && done.length === 1) { location.hash = "result-" + done[0]; return; }
    App.state.resFilter = { status: "", pf: "" };
    location.hash = multi && done.length ? "batch-" + batchId : "results";
    if (failed.length) U.modal({ title: done.length ? `${label}: ${done.length} created, ${failed.length} didn't run` : `${label} didn't run`,
      body: `<ul class="notes">${failed.map(([n, msg]) => `<li><b>${esc(n)}</b>: ${esc(msg)}</li>`).join("")}</ul>`, actions: [{ label: "Close" }] });
    else U.toast(`Created ${done.length} rebalance results`);
  }

  // ---- model template & upload ----
  async function saveFile(filename, data, done = "Template saved") {
    let dl = null;
    try { dl = root.claude && root.claude.use ? await root.claude.use("downloads") : null; } catch { dl = null; }
    if (dl) { try { await dl.save({ filename, data }); U.toast(done); } catch (e) { if (e.code !== "declined") U.toast("Couldn't save the file" + (e.code ? ` (${e.code})` : "")); } return; }
    const url = URL.createObjectURL(new Blob([data])), a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // ---- Export: every table gets an "Export" button that saves it as an Excel file ----
  // Cell text becomes numbers where it reads as money, a percent or a plain number, so the sheet can be summed and sorted.
  function cellValue(td) {
    const field = td.querySelector("input:not([type=checkbox]):not([type=hidden]), select, textarea");
    if (field) return field.tagName === "SELECT" ? (field.selectedOptions[0] || {}).textContent || "" : field.value;
    const box = td.querySelector("input[type=checkbox]");
    const clone = td.cloneNode(true);
    for (const b of clone.querySelectorAll("button:not(.linkbtn):not(.tree-btn):not(.sort-btn), .pen, .export-bar, svg, .suggest, .sort-ic, .sr-only")) b.remove();
    const text = clone.textContent.replace(/[▸▾▲▼↕]/g, "").replace(/\s+/g, " ").trim();
    return box && !text ? (box.checked ? "Yes" : "No") : text;
  }
  function typed(text) {
    const s = String(text).trim(), m = s.match(/^(\()?(-|−)?\$?(-)?([\d,]*\.?\d+)(\))?\s*(%)?$/);
    if (!m || !/\d/.test(m[4])) return { v: s };
    let v = parseFloat(m[4].replace(/,/g, ""));
    if (m[1] || m[2] || m[3]) v = -v;
    if (m[6]) return { v: v / 100, z: "0.00%" };
    if (s.includes("$")) return { v, z: '"$"#,##0.00;("$"#,##0.00)' };
    return { v };
  }
  function tableRows(table) {
    const rows = [];
    for (const tr of table.rows) {
      if (tr.querySelector("table") || tr.closest("table") !== table) continue; // nested tables export on their own
      const row = [];
      for (const c of tr.cells) { row.push(cellValue(c)); for (let i = 1; i < (c.colSpan || 1); i++) row.push(""); }
      if (row.some((x) => x !== "")) rows.push(row);
    }
    const width = Math.max(0, ...rows.map((r) => r.length));
    const keep = [...Array(width).keys()].filter((i) => rows.some((r) => (r[i] ?? "") !== ""));
    return rows.map((r) => keep.map((i) => r[i] ?? ""));
  }
  function tableTitle(table) {
    const sec = table.closest("section, .editor, figure, .modal");
    let h = null;
    for (let el = table.closest(".scroll") || table; el && !h; el = el.previousElementSibling) if (/^H[1-4]$/.test(el.tagName)) h = el;
    if (!h && sec) h = sec.querySelector("h1, h2, h3, h4");
    const page = document.querySelector(".page-head h1, .page-head .title-in");
    return [page && (page.value || page.textContent), h && h.textContent].filter(Boolean).map((x) => x.replace(/\s+/g, " ").trim())
      .filter((x, i, a) => a.indexOf(x) === i).join(" - ") || "Table";
  }

  // Models export: one sheet, securities down the side grouped by asset class (dark bars) and region (gray bars), with
  // Ticker, Fund, Class, Geography and Cap-Style, then one column per model (lowest model number first) holding each
  // security's weight in that model. Group rows, the TOTAL row and the CHECK row are formulas, so edits recalculate.
  const TOP_GROUPS = [["Equity", "TOTAL EQUITY"], ["Fixed Income", "FIXED INCOME"], ["Real Estate", "REAL ESTATE"], ["Alternatives", "COMMODITY"],
    ["Cash", "CASH & EQUIVALENTS"], ["Other", "OTHER"]];
  const topOf = (cls) => (cls === "Cash Equivalent" || cls === "Cash" ? "Cash" : TOP_GROUPS.some(([k]) => k === cls) ? cls : "Other");
  const CLASS_SHORT = { Equity: "Equity", "Fixed Income": "Fixed Income", "Real Estate": "Real Estate", Alternatives: "Commodity", "Cash Equivalent": "Cash Eq.", Cash: "Cash", Other: "Other", Unclassified: "Unclassified" };
  const modelNo = (m) => { const x = String(m.name).match(/\d+(\.\d+)?/); return x ? +x[0] : Infinity; };
  async function fundNames(symbols) {
    const out = {};
    for (const s of symbols) {
      if (U.isCash(s)) { out[s] = "Uninvested cash"; continue; }
      const known = (App.state.fund[s] && App.state.fund[s].name) || (Store.get("securities", s) || {}).name || (RH.DEMO_NAMES || {})[s];
      if (known) { out[s] = known; continue; }
      try { const hit = (await RH.api.search(s)).find((x) => x.symbol === s); out[s] = hit ? hit.name : ""; } catch { out[s] = ""; }
    }
    return out;
  }
  async function exportModels(models, name) {
    models = [...models].sort((a, b) => modelNo(a) - modelNo(b) || a.name.localeCompare(b.name));
    const flats = models.map((m) => U.flatModel(m));
    const order = [];
    for (const f of flats) for (const s of Object.keys(f)) if (!order.includes(s)) order.push(s);
    U.toast("Preparing the export...");
    const names = await fundNames(order);
    // A security with no asset class set is placed by its fund name where that's clear (e.g. a bond fund), so it isn't left in OTHER.
    const guessClass = U.guessClass;
    const info = Object.fromEntries(order.map((s) => {
      const p = U.profileOf(s, names[s]);
      if (p.cls === "Unclassified") {
        p.cls = guessClass(names[s] || ""); p.guessed = p.cls !== "Unclassified";
        if (p.guessed && !(Store.get("securities", s) || {}).geography) p.geo = p.cls === "Alternatives" || p.cls === "Cash Equivalent" ? "-" : /international|intl|ex[- ]?u\.?s|emerging|developed/i.test(names[s]) ? "International" : "Domestic";
        if (p.guessed && p.cls !== "Equity" && !(Store.get("securities", s) || {}).cap_style) p.style = "-";
      }
      return [s, p];
    }));
    // Group: top asset class, then region inside Equity and Fixed Income.
    const groups = [];
    for (const [key, label] of TOP_GROUPS) {
      const syms = order.filter((s) => topOf(info[s].cls) === key);
      if (!syms.length) continue;
      const subs = key === "Equity" || key === "Fixed Income"
        ? ["Domestic", "International", "Global"].map((g) => ({ label: `${g} ${key}`, syms: syms.filter((s) => info[s].geo === g) })).filter((x) => x.syms.length)
        : [{ label: null, syms }];
      groups.push({ label, subs });
    }
    const M = models.length, firstCol = 7, col = (i) => XLSX.utils.encode_col(i); // model columns start at H
    const rows = [], styles = [], formulas = [];
    const blank = () => Array(firstCol + M).fill("");
    const head = blank();
    head[2] = "Ticker"; head[3] = "Fund"; head[4] = "Class"; head[5] = "Geography"; head[6] = "Cap-Style";
    models.forEach((m, i) => { head[firstCol + i] = m.name; });
    rows.push(head);
    const topRows = [];
    for (const g of groups) {
      const tr = rows.length + 1, gSec = [];
      topRows.push(tr);
      const t = blank(); t[0] = g.label; rows.push(t); styles.push([tr, "top"]);
      for (const sub of g.subs) {
        let sr = null;
        if (sub.label) { sr = rows.length + 1; const r = blank(); r[1] = sub.label; rows.push(r); styles.push([sr, "sub"]); }
        const secRows = [];
        for (const s of sub.syms) {
          const r = rows.length + 1, row = blank();
          row[2] = U.isCash(s) ? "CASH" : s; row[3] = names[s] || ""; row[4] = CLASS_SHORT[info[s].cls] || info[s].cls; row[5] = info[s].geo; row[6] = info[s].style;
          models.forEach((m, i) => { row[firstCol + i] = flats[i][s] || 0; });
          rows.push(row); styles.push([r, "sec"]); secRows.push(r); gSec.push(r);
        }
        if (sr) for (let i = 0; i < M; i++) formulas.push([sr, firstCol + i, `SUM(${secRows.map((r) => col(firstCol + i) + r).join(",")})`, secRows.reduce((t, r) => t + rows[r - 1][firstCol + i], 0)]);
      }
      for (let i = 0; i < M; i++) formulas.push([tr, firstCol + i, `SUM(${gSec.map((r) => col(firstCol + i) + r).join(",")})`, gSec.reduce((t, r) => t + rows[r - 1][firstCol + i], 0)]);
    }
    const totalRow = rows.length + 1, total = blank(); total[0] = "TOTAL"; rows.push(total); styles.push([totalRow, "total"]);
    const checkRow = rows.length + 1, check = blank(); check[0] = "CHECK (adds to 100%)"; rows.push(check); styles.push([checkRow, "check"]);
    for (let i = 0; i < M; i++) {
      const c = col(firstCol + i), sum = topRows.reduce((t, r) => t + (formulas.find((f) => f[0] === r && f[1] === firstCol + i) || [0, 0, 0, 0])[3], 0);
      formulas.push([totalRow, firstCol + i, `SUM(${topRows.map((r) => c + r).join(",") || 0})`, sum]);
      formulas.push([checkRow, firstCol + i, `IF(ROUND(${c}${totalRow},6)=1,"OK","Not 100%")`, Math.abs(sum - 1) < 5e-7 ? "OK" : "Not 100%"]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    for (const [r, c, f, v] of formulas) { const ref = col(c) + r; ws[ref] = { t: typeof v === "string" ? "s" : "n", v, f }; }
    // Formatting, after the sample: dark bars for asset classes, gray bars for regions, centered columns, % weights.
    const thin = { style: "thin", color: { rgb: "D9D9D9" } }, divider = { style: "medium", color: { rgb: "BFBFBF" } };
    const S = {
      head: { font: { bold: true, sz: 11 }, alignment: { horizontal: "center", vertical: "bottom" } },
      top: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "3F3F3F" } } },
      sub: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "999999" } } },
      sec: { border: { bottom: thin } },
      total: { font: { bold: true }, border: { top: { style: "medium", color: { rgb: "3F3F3F" } } } },
      check: { font: { italic: true, color: { rgb: "595959" } } },
    };
    const kindOf = Object.fromEntries(styles);
    const width = firstCol + M;
    for (let r = 1; r <= rows.length; r++) {
      const kind = r === 1 ? "head" : kindOf[r] || "sec";
      for (let c = 0; c < width; c++) {
        const ref = col(c) + r, cell = ws[ref] || (ws[ref] = { t: "s", v: "" });
        const s = JSON.parse(JSON.stringify(S[kind]));
        if (c >= 4) s.alignment = { ...(s.alignment || {}), horizontal: "center" };
        if (c === 2 && kind === "head") s.alignment = { horizontal: "left" };
        if (c === 2) s.border = { ...(s.border || {}), right: divider };
        if (c >= firstCol && kind !== "head" && kind !== "check" && typeof cell.v === "number") cell.z = '0.00%;-0.00%;"-"';
        if (c >= firstCol && kind === "check") s.font = { bold: true, color: { rgb: cell.v === "OK" ? "1E7B34" : "C00000" } };
        cell.s = s;
      }
    }
    // Group, region, TOTAL and CHECK labels sit in narrow columns A/B; merging them across to Cap-Style lets the
    // whole label show without widening anything (an empty neighbouring cell would otherwise cut the text off).
    ws["!merges"] = styles.filter(([, k]) => k !== "sec").map(([r, k]) => ({ s: { r: r - 1, c: k === "sub" ? 1 : 0 }, e: { r: r - 1, c: firstCol - 1 } }));
    ws["!cols"] = [{ wch: 2.5 }, { wch: 2.5 }, { wch: 18 }, { wch: 52 }, { wch: 13 }, { wch: 15 }, { wch: 15 }, ...models.map(() => ({ wch: 12 }))];
    ws["!rows"] = [{ hpt: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Models");
    saveFile(name, new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true })), "Exported " + name);
  }
  function exportTable(table) {
    if (!root.XLSX) return U.toast("The Excel library didn't load. Check your connection and reload.");
    const kind = table.dataset.exportKind;
    if (kind === "models") return exportModels(Store.all("models").sort((a, b) => a.name.localeCompare(b.name)), `Models ${History.etDate()}.xlsx`);
    if (kind === "model") { const m = Store.get("models", table.dataset.model); if (m) return exportModels([m], `${m.name.replace(/[\\/:*?"<>|]+/g, " ")} ${History.etDate()}.xlsx`); }
    const rows = tableRows(table);
    if (!rows.length) return U.toast("This table is empty");
    const cells = rows.map((r, i) => r.map((x) => (i === 0 && table.tHead ? { v: x } : typed(x))));
    const ws = XLSX.utils.aoa_to_sheet(cells.map((r) => r.map((c) => c.v)));
    cells.forEach((r, i) => r.forEach((c, j) => { if (c.z) ws[XLSX.utils.encode_cell({ r: i, c: j })].z = c.z; }));
    ws["!cols"] = rows[0].map((_, j) => ({ wch: Math.min(60, Math.max(8, ...rows.map((r) => String(r[j]).length + 2))) }));
    const title = tableTitle(table), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1");
    const name = `${title} ${History.etDate()}`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) + ".xlsx";
    saveFile(name, new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" })), "Exported " + name);
  }
  function addExportButtons() {
    for (const table of document.querySelectorAll("#view table, .modal table")) {
      if (table.dataset.noExport !== undefined || table.closest(".suggest")) continue;
      const anchor = table.parentElement && table.parentElement.classList.contains("scroll") ? table.parentElement : table;
      if (anchor.previousElementSibling && anchor.previousElementSibling.classList.contains("export-bar")) continue;
      const bar = document.createElement("div");
      bar.className = "export-bar";
      bar.innerHTML = '<button class="btn small" type="button" data-export>Export</button>';
      bar.firstChild.title = "Save this table as an Excel file";
      // In a flex or grid row the button goes in a wrapper with its table, so it doesn't become a layout item of its own.
      const parent = anchor.parentNode, disp = getComputedStyle(parent).display;
      if (/flex|grid/.test(disp)) { const wrap = document.createElement("div"); wrap.className = "export-wrap"; parent.insertBefore(wrap, anchor); wrap.append(bar, anchor); }
      else parent.insertBefore(bar, anchor);
    }
  }
  let exportTimer = null;
  new MutationObserver(() => { clearTimeout(exportTimer); exportTimer = setTimeout(addExportButtons, 30); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-export]");
    if (!b) return;
    let el = b.parentElement.nextElementSibling;
    const table = el && (el.tagName === "TABLE" ? el : el.querySelector("table"));
    if (table) exportTable(table);
  });

  // The template is the Models export itself (every saved model), so it can be edited and uploaded straight back.
  function downloadTemplate() {
    const ms = Store.all("models");
    const sample = [{ id: "sample", name: "Model 1", sleeves: [{ id: "a", name: "Domestic Equity", weight: 60, securities: [{ symbol: "VTI", weight: 100 }] },
      { id: "b", name: "International Equity", weight: 30, securities: [{ symbol: "VXUS", weight: 100 }] }, { id: "c", name: "Fixed Income", weight: 10, securities: [{ symbol: "BND", weight: 100 }] }] }];
    return exportModels(ms.length ? ms : sample, `Models template ${History.etDate()}.xlsx`);
  }

  // ---- Upload: the Models export format, holding every model ----
  // Securities down the side (Ticker, Fund, Class, Geography, Cap-Style), grouped by dark asset-class rows and gray region
  // rows; one column per model with each security's weight. Each group becomes a sleeve. Nothing changes until the preview
  // is confirmed.
  const CLASS_IN = [[/^equity/i, "Equity"], [/fixed|bond/i, "Fixed Income"], [/real\s*estate|reit/i, "Real Estate"], [/commodit|^alt/i, "Alternatives"],
    [/cash\s*eq/i, "Cash Equivalent"], [/^other/i, "Other"]];
  const titleCase = (s) => String(s).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "and");
  function parseModelsSheet(rows) {
    const h = rows.findIndex((r) => (r || []).some((c) => /^ticker$/i.test(String(c ?? "").trim())) && (r || []).some((c) => /^(class|cap-?style|geography)$/i.test(String(c ?? "").trim())));
    if (h < 0) return null;
    const head = rows[h].map((c) => String(c ?? "").trim());
    const at = (re) => head.findIndex((c) => re.test(c));
    const ti = at(/^ticker$/i), fi = at(/^fund$/i), ci = at(/^class$/i), gi = at(/^geography$/i), si = at(/^cap-?style$/i);
    const lastInfo = Math.max(ti, fi, ci, gi, si);
    const modelCols = head.map((c, i) => [c, i]).filter(([c, i]) => i > lastInfo && c);
    if (!modelCols.length) throw new Error("Couldn't find any model columns after Cap-Style. Put each model's name at the top of its column.");
    const models = modelCols.map(([name]) => ({ name, groups: [] })), secInfo = {}, problems = [];
    let top = "", sub = "";
    const group = (m, label) => { let g = m.groups.find((x) => x.label === label); if (!g) m.groups.push(g = { label, items: [] }); return g; };
    for (const r of rows.slice(h + 1)) {
      if (!r) continue;
      const ticker = String(r[ti] ?? "").trim();
      if (!ticker) {
        const k = r.findIndex((c, i) => i < ti && String(c ?? "").trim());
        if (k < 0) continue;
        const label = String(r[k]).trim();
        if (/^(total|check)\b/i.test(label)) { top = sub = ""; continue; }
        if (k === 0) { top = label; sub = ""; } else sub = label;
        continue;
      }
      const fund = String(r[fi] ?? ""), clsTxt = String(r[ci] ?? "").trim();
      let sym;
      if (/^cash \(uninvested\)$|^uninvested cash$/i.test(ticker) || (/^\$?cash$/i.test(ticker) && (/^cash$/i.test(clsTxt) || /uninvested/i.test(fund)))) sym = U.CASH;
      else sym = ticker.toUpperCase().replace(/^\$/, "");
      if (!U.isCash(sym) && !/^[A-Z0-9][A-Z0-9.\-]{0,11}$/.test(sym)) { problems.push(`"${ticker}" isn't a ticker, so its row was skipped.`); continue; }
      if (!U.isCash(sym)) {
        const cls = (CLASS_IN.find(([re]) => re.test(clsTxt)) || [])[1] || null;
        const geo = U.GEOS.find((g) => g.toLowerCase() === String(r[gi] ?? "").trim().toLowerCase()) || null;
        const style = U.CAP_STYLES.find((s) => s.toLowerCase() === String(r[si] ?? "").trim().toLowerCase()) || null;
        secInfo[sym] = { cls, geo, style };
      }
      const label = sub || (top ? titleCase(top.replace(/^total\s+/i, "")) : "Core");
      modelCols.forEach(([, col], i) => {
        const raw = r[col];
        const v = typeof raw === "number" ? raw : parseFloat(String(raw ?? "").replace(/[%,\s]/g, ""));
        if (v > 0) group(models[i], label).items.push({ symbol: sym, w: typeof raw === "string" && /%/.test(raw) ? v / 100 : v });
      });
    }
    // Weights may be fractions (0.595, as exported) or percents (59.5); a model adding to more than 1.5 is read as percents.
    for (const m of models) {
      let total = m.groups.reduce((t, g) => t + g.items.reduce((u, x) => u + x.w, 0), 0);
      if (total > 1.5) { for (const g of m.groups) for (const x of g.items) x.w /= 100; total /= 100; }
      m.total = total;
      m.flat = {};
      for (const g of m.groups) for (const x of g.items) m.flat[x.symbol] = (m.flat[x.symbol] || 0) + x.w;
      if (!Object.keys(m.flat).length) m.error = "has no weights";
      else if (Math.abs(total - 1) > 0.0001) m.error = `adds up to ${(total * 100).toFixed(2)}%, not 100%`;
    }
    return { models, secInfo, problems };
  }
  // Sleeves from the file's groups; a group that shares securities with an existing sleeve keeps that sleeve (its name,
  // id and sleeve benchmark), so updating weights doesn't lose settings.
  function sleevesFrom(fileModel, existing) {
    const free = [...((existing && existing.sleeves) || [])];
    return fileModel.groups.filter((g) => g.items.length).map((g) => {
      const syms = new Set(g.items.map((x) => x.symbol));
      let best = null, overlap = 0;
      for (const sl of free) { const o = (sl.securities || []).filter((s) => syms.has(U.isCash(s.symbol) ? U.CASH : s.symbol)).length; if (o > overlap) { best = sl; overlap = o; } }
      if (best) free.splice(free.indexOf(best), 1);
      const sw = g.items.reduce((t, x) => t + x.w, 0);
      return { ...(best ? { ...best } : { id: Store.newId("sl"), name: g.label }), weight: +(sw * 100).toFixed(4),
        securities: g.items.map((x) => ({ symbol: x.symbol, weight: +(x.w / sw * 100).toFixed(4) })) };
    });
  }
  const pctTxt = (v) => `${(v * 100).toFixed(2)}%`;
  function modelChanges(oldFlat, newFlat) {
    const out = [];
    for (const s of new Set([...Object.keys(oldFlat), ...Object.keys(newFlat)])) {
      const a = oldFlat[s] || 0, b = newFlat[s] || 0;
      if (Math.abs(a - b) < 1e-6) continue;
      out.push(!a ? `add ${U.symLabel(s)} ${pctTxt(b)}` : !b ? `remove ${U.symLabel(s)} (was ${pctTxt(a)})` : `${U.symLabel(s)} ${pctTxt(a)} → ${pctTxt(b)}`);
    }
    return out;
  }
  async function uploadModel(file) {
    try {
      let rows;
      if (/\.csv$/i.test(file.name) || !root.XLSX) rows = (await file.text()).split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
      else { const wb = XLSX.read(await file.arrayBuffer()); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true }); }
      const parsed = parseModelsSheet(rows);
      if (!parsed) return uploadSingleModel(rows, file.name);
      previewUpload(parsed, file.name);
    } catch (e) { U.modal({ title: "Couldn't read the file", body: `<p class="errorbox">${esc(e.message)}</p>`, actions: [{ label: "Close" }] }); }
  }
  function previewUpload({ models, secInfo, problems }, fileName) {
    const saved = Store.all("models"), byName = (n) => saved.find((m) => m.name.trim().toLowerCase() === n.trim().toLowerCase());
    const plan = models.map((m) => {
      const ex = byName(m.name);
      if (m.error) return { m, ex, status: "error" };
      if (!ex) return { m, status: "new" };
      const ch = modelChanges(U.flatModel(ex), m.flat);
      return { m, ex, status: ch.length ? "updated" : "same", changes: ch };
    });
    const inFile = new Set(models.map((m) => m.name.trim().toLowerCase()));
    const missing = saved.filter((m) => !inFile.has(m.name.trim().toLowerCase()));
    const usedBy = (m) => Store.all("portfolios").filter((p) => p.model_id === m.id || (p.reporting_targets || []).some((w) => w.model_id === m.id));
    const secChanges = [];
    for (const [s, v] of Object.entries(secInfo)) {
      // Only real differences: a geography or cap-style the app already shows (set, or its own guess) isn't a change.
      const cur = Store.get("securities", s) || {}, shown = U.profileOf(s), ch = [], v2 = {};
      if (v.cls && v.cls !== (cur.asset_class || null)) { ch.push(`class ${cur.asset_class || "Unclassified"} → ${v.cls === "Alternatives" ? "Commodity" : v.cls}`); v2.cls = v.cls; }
      if (v.geo && v.geo !== shown.geo) { ch.push(`geography ${shown.geo} → ${v.geo}`); v2.geo = v.geo; }
      if (v.style && v.style !== shown.style) { ch.push(`cap-style ${shown.style} → ${v.style}`); v2.style = v.style; }
      if (ch.length) secChanges.push({ s, v: v2, ch });
    }
    const label = { new: '<span class="pill ok">New</span>', updated: '<span class="pill na">Updated</span>', same: '<span class="muted">No change</span>', error: '<span class="pill oob">Not applied</span>' };
    const rowsHtml = plan.map((p) => `<tr><td><b>${esc(p.m.name)}</b></td><td>${label[p.status]}</td><td class="small">${
      p.status === "error" ? `This model ${esc(p.m.error)}. Fix it in the file and upload again.`
      : p.status === "new" ? `${Object.keys(p.m.flat).length} securities in ${p.m.groups.filter((g) => g.items.length).length} sleeve(s)`
      : p.status === "updated" ? p.changes.map(esc).join("<br>") : ""}</td></tr>`).join("");
    const toApply = plan.filter((p) => p.status === "new" || p.status === "updated");
    const body = `<p>From <b>${esc(fileName)}</b>:</p>
      <div class="scroll"><table><thead><tr><th>Model</th><th>Result</th><th>Changes</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
      ${secChanges.length ? `<h4>Security details (${secChanges.length})</h4><ul class="notes small">${secChanges.map((x) => `<li><b>${esc(x.s)}</b>: ${x.ch.map(esc).join(", ")}</li>`).join("")}</ul>` : ""}
      ${missing.length ? `<h4>Models not in this file (${missing.length})</h4>
        <ul class="notes small">${missing.map((m) => { const u = usedBy(m);
          return `<li><label class="toggle"><input type="checkbox" class="up-del" value="${esc(m.id)}"${u.length ? " disabled" : ""}> Delete <b>${esc(m.name)}</b></label>
            ${u.length ? `<span class="muted">(used by ${esc(u.map((p) => p.name).join(", "))}, so it's kept)</span>` : ""}</li>`; }).join("")}</ul>
        <p class="hint">Unticked models are kept as they are.</p>` : ""}
      ${problems.length ? `<ul class="notes small warn-text">${problems.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <p class="hint">Each asset-class or region group in the file becomes a sleeve. Sleeves that keep the same securities keep their names and sleeve benchmarks.</p>`;
    const nothing = !toApply.length && !secChanges.length && !missing.length;
    U.modal({ title: "Upload models", wide: true, body: nothing ? body + '<p class="status-on">Everything in the file already matches your saved models.</p>' : body,
      actions: [{ label: "Cancel" }, ...(nothing ? [] : [{ label: `Apply changes`, primary: true, onClick: () => {
        const del = [...document.querySelectorAll(".up-del:checked")].map((x) => x.value);
        applyUpload(toApply, secChanges, del);
      } }])] });
  }
  async function applyUpload(toApply, secChanges, del) {
    const now = new Date().toISOString();
    for (const p of toApply) {
      const doc = p.ex ? { ...p.ex, sleeves: sleevesFrom(p.m, p.ex), updated: now } : { id: Store.newId("m"), name: p.m.name.trim(), sleeves: sleevesFrom(p.m, null), created: now };
      await Store.put("models", doc.id, doc);
    }
    for (const { s, v } of secChanges) {
      const cur = Store.get("securities", s) || { symbol: s, global_equivalents: [], tlh_pairs: [] };
      await Store.put("securities", s, { ...cur, symbol: s, ...(v.cls ? { asset_class: v.cls } : {}), ...(v.geo ? { geography: v.geo } : {}), ...(v.style ? { cap_style: v.style } : {}) });
    }
    for (const id of del) await Store.remove("models", id);
    U.rememberSymbols(Object.keys(Object.assign({}, ...toApply.map((p) => p.m.flat))).filter((s) => !U.isCash(s)));
    App.state.analysis = {}; App.state.home.data = {};
    const n = toApply.filter((p) => !p.ex).length, u = toApply.length - n;
    U.toast([n && `${n} model${n > 1 ? "s" : ""} added`, u && `${u} updated`, secChanges.length && `${secChanges.length} securities relabeled`, del.length && `${del.length} deleted`].filter(Boolean).join(", ") || "Nothing to change");
    location.hash = "models"; rerender();
  }
  // The older one-model layout (Ticker, Weight, optional Sleeve) still works.
  async function uploadSingleModel(rows, fileName) {
    try {
      const h = rows.findIndex((r) => r.some((c) => /ticker|symbol/i.test(String(c))));
      if (h < 0) throw new Error("Couldn't find a Ticker column. Use the layout of the Models export (Download Excel template).");
      const head = rows[h].map((c) => String(c || "").toLowerCase());
      const ti = head.findIndex((c) => /ticker|symbol/.test(c)), wi = head.findIndex((c) => /weight|%/.test(c)), si = head.findIndex((c) => /sleeve/.test(c));
      if (wi < 0) throw new Error("Couldn't find model columns. Use the layout of the Models export (Download Excel template).");
      const tick = (v) => { const t = String(v || "").trim(); return /^(cash \(uninvested\)|uninvested cash)$/i.test(t) ? U.CASH : t.toUpperCase(); };
      const items = rows.slice(h + 1).map((r) => ({ symbol: tick(r[ti]), weight: parseFloat(String(r[wi] ?? "").replace("%", "")), sleeve: si >= 0 ? String(r[si] || "").trim() : "" }))
        .filter((x) => x.symbol && x.weight > 0);
      if (!items.length) throw new Error("No rows with a ticker and a weight above zero.");
      let total = items.reduce((s, x) => s + x.weight, 0);
      if (total <= 1.0001) { for (const x of items) x.weight *= 100; total *= 100; }
      const groups = new Map();
      for (const x of items) { const n = x.sleeve || "Core"; if (!groups.has(n)) groups.set(n, []); groups.get(n).push(x); }
      const sleeves = [...groups].map(([name, xs]) => { const sw = xs.reduce((s, x) => s + x.weight, 0);
        return { id: Store.newId("sl"), name, weight: +(sw / total * 100).toFixed(4), securities: xs.map((x) => ({ symbol: x.symbol, weight: +(x.weight / sw * 100).toFixed(4) })) }; });
      const m = { id: Store.newId("m"), name: fileName.replace(/\.[^.]+$/, ""), sleeves, created: new Date().toISOString() };
      for (const sl of sleeves) App.state.openSleeves.add(sl.id);
      U.rememberSymbols(items.map((x) => x.symbol).filter((s) => !U.isCash(s)));
      await Store.put("models", m.id, m);
      U.toast(Math.abs(total - 100) > 0.01 ? `Imported; weights added up to ${total.toFixed(2)}%, so they were scaled to 100%` : "Model imported");
      location.hash = "model-" + m.id;
    } catch (e) { U.modal({ title: "Couldn't import the model", body: `<p class="errorbox">${esc(e.message)}</p>`, actions: [{ label: "Close" }] }); }
  }

  // ---- events ----
  const CHANGE_ACTS = ["ord-check", "ord-check-all", "pf-acct", "ua-check", "ua-all", "ua-mode", "rb-check", "rb-all", "rb-kind", "home-pf", "home-pf-all", "sleeve-bench", "tx-type", "tx-type-all"];
  const HOME_FIELDS = { "h-period": "period", "h-from": "from", "h-asof-mode": "asOfMode", "h-asof": "asOf", "h-alloc-mode": "allocMode", "h-target-model": "targetModel", "h-tx-accttype": "txAcctType" };

  // Recompute an account's history after its transfers change (debounced per account).
  const rebuildTimers = {};
  App.queueRebuild = (acct) => {
    if (App.state.acctDraft && App.state.acctDraft.id === acct) return; // rebuilt when the draft is saved
    clearTimeout(rebuildTimers[acct]);
    rebuildTimers[acct] = setTimeout(async () => {
      if (!Object.keys(History.recordsFor(acct)).length) return;
      try { await History.rebuild(acct); U.toast("History updated"); } catch (e) { U.toast("Couldn't update history: " + e.message); }
      App.state.home.data = {}; rerender();
    }, 900);
  };

  // After orders fill on a trade date (the demo's paper broker), line up the dates reports run from. All are as of
  // that day's close, when the portfolio holds its new positions:
  //  - an account's first filled rebalance (in this portfolio or after joining it): its performance start date;
  //  - the portfolio's first filled rebalance: the reporting target and benchmark start then;
  //  - later, a change of model: the reporting target and benchmark switch to the new model then (performance stays continuous);
  //  - same model, or nothing filled: no change.
  // Returns a list of what changed, for the result page.
  App.applyTradeDates = (pfId, day) => {
    const pf = clone(Store.get("portfolios", pfId) || null), model = pf && Store.get("models", pf.model_id);
    if (!pf || !model) return [];
    const first = !pf.trade_start, prevDay = History.addDays(day, -1), fmt = Charts.fmtDate(day), changes = [];
    const fresh = pf.account_numbers.filter((a) => !U.acctDoc(a).trade_start);
    for (const a of fresh) {
      const doc = clone(U.acctDoc(a)); doc.id = a; doc.perf_start = day; doc.trade_start = day; doc.updated = new Date().toISOString();
      Store.put("accounts", a, doc);
      App.queueRebuild(a);
    }
    const acctChanges = fresh.length ? 1 : 0;
    if (fresh.length) changes.push(`Performance start date set to ${fmt} on ${fresh.length === pf.account_numbers.length
      ? (fresh.length === 1 ? "the account" : `all ${fresh.length} accounts`) : fresh.map((a) => `${(U.acctDoc(a).nickname || "account")} ${U.maskText(a)}`).join(", ")}`);
    const open = (list) => (list || []).find((w) => !w.end || w.end >= day);
    const roll = (list) => [...(list || []).filter((w) => !w.start || w.start < day).map((w) => (!w.end || w.end >= day ? { ...w, end: prevDay } : w)),
      { model_id: model.id, start: day, end: null }];
    const bench = model.benchmark && (model.benchmark.components || []).length ? model.benchmark.name : `${model.name} (no benchmark set)`;
    if (first) {
      pf.reporting_targets = [{ model_id: model.id, start: day, end: null }];
      pf.benchmarks = [{ model_id: model.id, start: day, end: null }];
      pf.trade_start = day;
      changes.push(`Reporting target: ${model.name} from ${fmt}`, `Benchmark: ${bench} from ${fmt}`);
    } else {
      const rt = open(pf.reporting_targets), bm = open(pf.benchmarks);
      const was = rt && ((Store.get("models", rt.model_id) || {}).name || "the previous model");
      if (!rt || rt.model_id !== model.id) { pf.reporting_targets = roll(pf.reporting_targets);
        changes.push(`Reporting target: ${model.name} from ${fmt}${!rt ? "" : rt.start && rt.start >= day ? ` (replaces ${was}, which started the same day)` : ` (${was} ends ${Charts.fmtDate(prevDay)})`}`); }
      if (!bm || bm.model_id !== model.id) { pf.benchmarks = roll(pf.benchmarks); changes.push(`Benchmark: ${bench} from ${fmt}`); }
    }
    if (changes.length > acctChanges) { pf.updated = new Date().toISOString(); Store.put("portfolios", pf.id, pf); }
    App.state.analysis = {}; App.state.home.data = {};
    return changes;
  };

  // ---- Orders blotter (demo) ----
  // Approved results put their orders on the blotter as open orders (result.blotter). Submitting some or all of them fills
  // them in the paper broker at the latest close; a result is closed once none of its orders are open.
  const blotterResults = (ids) => Store.all("results").filter((r) => (r.blotter || []).some((o) => ids.has(o.id) && o.status === "open"));
  function closeIfDone(r, now, label) {
    if ((r.blotter || []).some((o) => o.status === "open")) return;
    r.status = "submitted"; r.decided_at = now; r.decided_label = label;
  }
  App.submitOrders = (ids) => {
    if (!RH.paper) return { filled: 0, notes: [] };
    const want = new Set(ids), now = new Date().toISOString(), label = U.nowStamp(), notes = [];
    let filled = 0;
    for (const r0 of blotterResults(want)) {
      const r = clone(r0), mine = r.blotter.filter((o) => want.has(o.id) && o.status === "open");
      const res = RH.paper.fill(mine.map((o) => ({ account: o.account, symbol: o.symbol, side: o.side, qty: o.qty, lots: o.lots, all: o.all, ref: o.id })));
      const byRef = Object.fromEntries(res.fills.map((f) => [f.ref, f])), rejected = Object.fromEntries((res.rejected || []).map((x) => [x.ref, x.why]));
      for (const o of r.blotter) {
        if (byRef[o.id]) { Object.assign(o, { status: "filled", fill_qty: byRef[o.id].qty, fill_price: byRef[o.id].price, filled_at: now, filled_label: label, trade_date: res.price_date }); filled++; }
        else if (rejected[o.id]) Object.assign(o, { status: "rejected", note: rejected[o.id], closed_at: now });
      }
      const fills = res.fills.map((f) => ({ ...f, submitted_at: now, submitted_label: label, trade_date: res.price_date }));
      const p = r.paper || { fills: [], skipped: [], dates: [] };
      p.fills = [...(p.fills || []), ...fills]; p.skipped = [...(p.skipped || []), ...res.skipped];
      p.price_date = res.price_date; p.submitted_at = now; p.submitted_label = label;
      if (res.settles) p.settles = res.settles;
      // The fill date starts performance (first time) and switches the reporting target and benchmark (new model).
      if (fills.length && App.applyTradeDates) p.dates = [...(p.dates || []), ...App.applyTradeDates(r.portfolio_id, res.price_date)];
      r.paper = p;
      closeIfDone(r, now, label);
      Store.put("results", r.id, r);
      notes.push(...res.skipped);
    }
    App.state.balances = {}; App.state.analysis = {}; App.state.home.data = {};
    recordHistory(true);
    return { filled, notes };
  };
  App.cancelOrders = (ids) => {
    const want = new Set(ids), now = new Date().toISOString(), label = U.nowStamp();
    let n = 0;
    for (const r0 of blotterResults(want)) {
      const r = clone(r0);
      for (const o of r.blotter) if (want.has(o.id) && o.status === "open") { o.status = "canceled"; o.closed_at = now; n++; }
      closeIfDone(r, now, label);
      Store.put("results", r.id, r);
    }
    return n;
  };

  // Save today's snapshot of every portfolio account (live data only), so reports have history to work from.
  let recording = null;
  App.recordHistory = (force) => recordHistory(force);
  function recordHistory(force = false) {
    if (RH.mode !== "live" && !RH.paper) return Promise.resolve(); // the demo's paper broker is recorded like a live account
    if (recording && !force) return recording;
    recording = (async () => {
      try {
        const ids = [...new Set(Store.all("portfolios").flatMap((p) => p.account_numbers))];
        const accts = (await App.rhAccounts()).filter((a) => ids.includes(a.id));
        if (!accts.length) return;
        const data = [];
        for (const a of accts) {
          const [bal, positions] = await Promise.all([RH.api.balances(a.id), RH.api.positions(a.id)]);
          data.push({ id: a.id, name: a.name, cash: bal.cash, positions });
        }
        const quotes = await RH.api.quotes(data.flatMap((a) => a.positions.map((p) => p.symbol)));
        // Snapshots from the scheduled daily task first, then today's state; each account is recomputed from
        // its orders, observations and entered transfers.
        await History.ingest(ids);
        const notes = await History.record(data, quotes);
        App.state.historyNote = notes.join(" ");
        App.state.home.data = {};
        rerender();
      } catch (e) { App.state.historyNote = "Couldn't update history: " + e.message; }
    })();
    return recording;
  }
  function wire() {
    U.wirePickers(document);
    document.addEventListener("change", (ev) => {
      const t = ev.target;
      if (t.id === "model-upload" && t.files && t.files[0]) { uploadModel(t.files[0]); t.value = ""; return; }
      if (t.dataset && t.dataset.bind && !t.closest("[data-r-scope]")) applyBind(t);
      if (t.dataset && CHANGE_ACTS.includes(t.dataset.act)) handlers[t.dataset.act](t);
      if (t.id === "ord-from" || t.id === "ord-to" || t.id === "ord-pf") {
        const fl = App.state.ordersFilter = { ...(App.state.ordersFilter || {}) };
        if (t.id === "ord-pf") fl.pf = t.value; else { fl.from = document.getElementById("ord-from").value; fl.to = document.getElementById("ord-to").value; }
        rerender();
      }
      if (t.id === "res-pf" || t.id === "res-status") { App.state.resFilter[t.id === "res-pf" ? "pf" : "status"] = t.value; rerender(); }
      if (HOME_FIELDS[t.id]) {
        const h = App.state.home;
        h[HOME_FIELDS[t.id]] = t.value;
        if (t.id === "h-alloc-mode") { h.allocOpen = new Set(); h.allocAll = false; }
        if (t.id === "h-asof" && t.value > History.etDate()) h.asOf = History.etDate();
        App.saveDates();
        rerender();
      }
    });
    // Model / benchmark search on a portfolio's Reporting section.
    const modelSuggest = (input) => {
      const q = input.value.trim().toLowerCase(), bench = input.dataset.kind === "bench", list = input.parentElement.querySelector(".suggest");
      App.state.modelPick[input.id] = null;
      const items = Store.all("models").filter((m) => !bench || m.benchmark).map((m) => ({ id: m.id, label: bench ? m.benchmark.name : m.name, sub: bench ? `on ${m.name}` : `${(m.sleeves || []).length} sleeve(s)` }))
        .filter((x) => !q || x.label.toLowerCase().includes(q)).sort((a, b) => (a.label.toLowerCase().startsWith(q) ? 0 : 1) - (b.label.toLowerCase().startsWith(q) ? 0 : 1) || a.label.localeCompare(b.label));
      list.innerHTML = items.length ? items.map((x, i) => `<li role="option" data-model-id="${esc(x.id)}" data-label="${esc(x.label)}" class="${i === 0 ? "active" : ""}"><b>${esc(x.label)}</b> <span class="muted">${esc(x.sub)}</span></li>`).join("")
        : `<li class="muted">${bench ? "No model benchmarks yet. Create one on a model's page." : "No saved models match."}</li>`;
      list.hidden = false;
    };
    const modelChoose = (input, li) => { input.value = li.dataset.label; App.state.modelPick[input.id] = li.dataset.modelId; input.parentElement.querySelector(".suggest").hidden = true; };
    document.addEventListener("input", (ev) => { if (ev.target.classList.contains("model-picker-in")) modelSuggest(ev.target); });
    document.addEventListener("focusin", (ev) => { if (ev.target.classList.contains("model-picker-in") && ev.isTrusted && !App.state.modelPick[ev.target.id]) modelSuggest(ev.target); });
    document.addEventListener("keydown", (ev) => {
      if (!ev.target.classList.contains("model-picker-in")) return;
      const list = ev.target.parentElement.querySelector(".suggest"), opts = [...list.querySelectorAll("li[data-model-id]")];
      if (list.hidden || !opts.length) return;
      let i = opts.findIndex((o) => o.classList.contains("active"));
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); opts[i]?.classList.remove("active"); i = (i + (ev.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length; opts[i].classList.add("active"); }
      else if (ev.key === "Enter") { ev.preventDefault(); modelChoose(ev.target, opts[Math.max(0, i)]); }
      else if (ev.key === "Escape") list.hidden = true;
    });
    document.addEventListener("mousedown", (ev) => {
      const li = ev.target.closest(".suggest li[data-model-id]");
      if (li) { ev.preventDefault(); modelChoose(li.closest(".picker").querySelector(".model-picker-in"), li); }
    });
    Charts.wire(document);
    document.addEventListener("input", (ev) => {
      const t = ev.target;
      if (t.id === "rb-name") App.state.rbName = t.value;
      if (t.id === "help-q") { App.state.helpQ = t.value; rerender(); }
      if (t.id === "pf-rename-in") App.state.renameDraft = t.value;
      if (t.id === "acct-rename-in") App.state.acctRenameDraft = t.value;
      // Asset location slider: show the label while dragging (it saves on release).
      if (t.classList.contains("loc-range")) {
        const labels = { "-2": "Avoid", "-1": "Less preferred", 0: "Neutral", 1: "Preferred", 2: "Strongly preferred" }, v = +t.value, out = t.parentElement.querySelector(".loc-val");
        if (out) { out.textContent = labels[v]; out.className = `loc-val loc-${v < 0 ? "neg" : v > 0 ? "pos" : "zero"}`; }
        t.setAttribute("aria-valuetext", labels[v]);
      }
      if (t.classList.contains("acct-picker-in")) acctSuggest(t);
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.target.id === "acct-rename-in") {
        if (ev.key === "Enter") { ev.preventDefault(); document.querySelector('[data-act="acct-rename-save"]')?.click(); }
        if (ev.key === "Escape") handlers["acct-rename-cancel"]();
      }
      if (ev.target.id === "pf-rename-in") {
        if (ev.key === "Enter") { ev.preventDefault(); document.querySelector('[data-act="pf-rename-save"]')?.click(); }
        if (ev.key === "Escape") handlers["pf-rename-cancel"]();
      }
    });
    // Account search on a portfolio: match account name or number.
    const acctSuggest = (input) => {
      const q = input.value.trim().toLowerCase(), list = input.parentElement.querySelector(".suggest");
      App.state.addAcctPick = null;
      const owner = (id) => Store.all("portfolios").find((p) => p.account_numbers.includes(id));
      const items = (App.state.rhAccounts || []).filter((a) => !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.type_label.toLowerCase().includes(q));
      list.innerHTML = items.length ? items.map((a) => { const o = owner(a.id);
        return `<li role="option" ${o ? 'aria-disabled="true" class="taken"' : `data-acct-id="${esc(a.id)}"`}><b>${esc(a.name)}</b> ${U.mask(a.id)} <span class="muted">${esc(a.type_label)}${o ? ` &middot; in ${esc(o.name)}` : ""}</span></li>`; }).join("")
        : `<li class="muted">${App.state.rhAccounts ? "No account matches." : "Loading accounts..."}</li>`;
      list.querySelector("li[data-acct-id]")?.classList.add("active");
      list.hidden = false;
    };
    const acctChoose = (input, id) => {
      const a = (App.state.rhAccounts || []).find((x) => x.id === id);
      input.value = `${a.name} ${U.maskText(a.id)}`; App.state.addAcctPick = id;
      input.parentElement.querySelector(".suggest").hidden = true;
    };
    document.addEventListener("focusin", (ev) => { if (ev.target.classList.contains("acct-picker-in") && ev.isTrusted && !App.state.addAcctPick) acctSuggest(ev.target); });
    document.addEventListener("keydown", (ev) => {
      if (!ev.target.classList.contains("acct-picker-in")) return;
      const list = ev.target.parentElement.querySelector(".suggest"), opts = [...list.querySelectorAll("li[data-acct-id]")];
      if (ev.key === "Enter" && (list.hidden || !opts.length)) { ev.preventDefault(); document.querySelector(`[data-act="pf-acct-add"][data-pf="${ev.target.dataset.pf}"]`)?.click(); return; }
      if (list.hidden || !opts.length) return;
      let i = opts.findIndex((o) => o.classList.contains("active"));
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); opts[i]?.classList.remove("active"); i = (i + (ev.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length; opts[i].classList.add("active"); }
      else if (ev.key === "Enter") { ev.preventDefault(); acctChoose(ev.target, opts[Math.max(0, i)].dataset.acctId); }
      else if (ev.key === "Escape") list.hidden = true;
    });
    document.addEventListener("mousedown", (ev) => {
      const li = ev.target.closest(".suggest li[data-acct-id]");
      if (li) { ev.preventDefault(); acctChoose(li.closest(".picker").querySelector(".acct-picker-in"), li.dataset.acctId); }
    });
    // Portfolio search on Unassigned Accounts: type part of a name to see matching portfolios.
    const pfSuggest = (input, typing = true) => {
      const q = input.value.trim().toLowerCase(), list = input.parentElement.querySelector(".suggest");
      if (typing) { App.state.assignPfName = input.value; App.state.assignPf = null; }
      else if (App.state.assignPf) return;
      const pfs = Store.all("portfolios").filter((p) => !q || p.name.toLowerCase().includes(q))
        .sort((a, b) => (a.name.toLowerCase().startsWith(q) ? 0 : 1) - (b.name.toLowerCase().startsWith(q) ? 0 : 1) || a.name.localeCompare(b.name)).slice(0, 12);
      list.innerHTML = pfs.length ? pfs.map((p, i) => `<li role="option" data-pf-id="${esc(p.id)}" class="${i === 0 ? "active" : ""}"><b>${esc(p.name)}</b> <span class="muted">${p.account_numbers.length} account(s) &middot; ${esc((Store.get("models", p.model_id) || {}).name || "no model")}</span></li>`).join("")
        : '<li class="muted">No portfolio matches. Create a new one instead.</li>';
      list.hidden = false;
    };
    const pfChoose = (input, id) => {
      const p = Store.get("portfolios", id);
      input.value = p.name; App.state.assignPf = id; App.state.assignPfName = p.name;
      input.parentElement.querySelector(".suggest").hidden = true;
    };
    document.addEventListener("input", (ev) => { if (ev.target.classList.contains("pf-picker-in")) pfSuggest(ev.target); });
    document.addEventListener("focusin", (ev) => { if (ev.target.classList.contains("pf-picker-in") && ev.isTrusted) pfSuggest(ev.target, false); });
    document.addEventListener("keydown", (ev) => {
      if (!ev.target.classList.contains("pf-picker-in")) return;
      const list = ev.target.parentElement.querySelector(".suggest"), opts = [...list.querySelectorAll("li[data-pf-id]")];
      if (list.hidden || !opts.length) { if (ev.key === "Enter") handlers["ua-assign-existing"](); return; }
      let i = opts.findIndex((o) => o.classList.contains("active"));
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); opts[i]?.classList.remove("active"); i = (i + (ev.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length; opts[i].classList.add("active"); }
      else if (ev.key === "Enter") { ev.preventDefault(); pfChoose(ev.target, opts[Math.max(0, i)].dataset.pfId); }
      else if (ev.key === "Escape") list.hidden = true;
    });
    document.addEventListener("mousedown", (ev) => {
      const li = ev.target.closest(".suggest li[data-pf-id]");
      if (li) { ev.preventDefault(); pfChoose(li.closest(".picker").querySelector(".pf-picker-in"), li.dataset.pfId); }
    });
    // Portfolio search on Create Rebalance: picking one adds it to the list to rebalance.
    const rbSuggest = (input) => {
      const q = input.value.trim().toLowerCase(), list = input.parentElement.querySelector(".suggest");
      const pfs = Store.all("portfolios").filter((p) => !App.state.rbSel.has(p.id) && (!q || p.name.toLowerCase().includes(q)))
        .sort((a, b) => (a.name.toLowerCase().startsWith(q) ? 0 : 1) - (b.name.toLowerCase().startsWith(q) ? 0 : 1) || a.name.localeCompare(b.name)).slice(0, 12);
      list.innerHTML = pfs.length ? pfs.map((p, i) => { const why = Views.readiness(p);
        return `<li role="option" data-rbpf-id="${esc(p.id)}" class="${i === 0 ? "active" : ""}"><b>${esc(p.name)}</b> <span class="muted">${esc((Store.get("models", p.model_id) || {}).name || "no model")} &middot; ${p.account_numbers.length} account(s)${why ? ` &middot; ${esc(why)}` : ""}</span></li>`; }).join("")
        : `<li class="muted">${Store.all("portfolios").length === App.state.rbSel.size ? "Every portfolio is already added." : "No portfolio matches."}</li>`;
      list.hidden = false;
    };
    const rbChoose = (id) => { App.state.rbSel.add(id); const n = document.getElementById("rb-pf-search"); if (n) n.value = ""; rerender();
      setTimeout(() => document.getElementById("rb-pf-search")?.focus(), 30); };
    document.addEventListener("input", (ev) => { if (ev.target.classList.contains("rbpf-picker-in")) rbSuggest(ev.target); });
    document.addEventListener("focusin", (ev) => { if (ev.target.classList.contains("rbpf-picker-in")) rbSuggest(ev.target); });
    document.addEventListener("focusout", (ev) => { if (ev.target.classList.contains("rbpf-picker-in")) setTimeout(() => { const l = ev.target.parentElement && ev.target.parentElement.querySelector(".suggest"); if (l && document.activeElement !== ev.target) l.hidden = true; }, 150); });
    document.addEventListener("keydown", (ev) => {
      if (!ev.target.classList.contains("rbpf-picker-in")) return;
      const list = ev.target.parentElement.querySelector(".suggest"), opts = [...list.querySelectorAll("li[data-rbpf-id]")];
      if (list.hidden || !opts.length) return;
      let i = opts.findIndex((o) => o.classList.contains("active"));
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); opts[i]?.classList.remove("active"); i = (i + (ev.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length; opts[i].classList.add("active"); }
      else if (ev.key === "Enter") { ev.preventDefault(); rbChoose(opts[Math.max(0, i)].dataset.rbpfId); }
      else if (ev.key === "Escape") list.hidden = true;
    });
    document.addEventListener("mousedown", (ev) => {
      const li = ev.target.closest(".suggest li[data-rbpf-id]");
      if (li) { ev.preventDefault(); rbChoose(li.dataset.rbpfId); }
    });
    // Themed hover notes: any element with data-tip shows its text in a small panel (multi-line, follows the app's colors).
    let tipEl = null;
    const showTip = (el) => {
      if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tip-pop"; tipEl.setAttribute("role", "tooltip"); document.body.appendChild(tipEl); }
      tipEl.textContent = el.dataset.tip; tipEl.hidden = false;
      const r = el.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
      tipEl.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + "px";
      tipEl.style.top = (r.bottom + 6 + h > window.innerHeight ? r.top - h - 6 : r.bottom + 6) + "px";
    };
    const hideTip = () => { if (tipEl) tipEl.hidden = true; };
    document.addEventListener("mouseover", (ev) => { const el = ev.target.closest("[data-tip]"); if (el) showTip(el); });
    document.addEventListener("mouseout", (ev) => { const el = ev.target.closest("[data-tip]"); if (el && !el.contains(ev.relatedTarget)) hideTip(); });
    document.addEventListener("focusin", (ev) => { const el = ev.target.closest && ev.target.closest("[data-tip]"); if (el) showTip(el); });
    document.addEventListener("focusout", hideTip);
    window.addEventListener("scroll", hideTip, true);
    window.addEventListener("hashchange", hideTip);
    document.addEventListener("click", (ev) => {
      const menuBtn = ev.target.closest("[data-menu]");
      for (const m of document.querySelectorAll(".mainnav .menu")) if (!menuBtn || m !== menuBtn.nextElementSibling) m.hidden = true;
      if (menuBtn) { const m = menuBtn.nextElementSibling; m.hidden = !m.hidden; menuBtn.setAttribute("aria-expanded", String(!m.hidden)); return; }
      const link = ev.target.closest('a[href="#accounts"]');
      if (link && route() === "accounts" && App.state.openAcct) { App.state.openAcct = null; rerender(); }
      const jump = ev.target.closest("[data-jump]");
      if (jump && !jump.dataset.r) { ev.preventDefault(); document.getElementById(jump.dataset.jump)?.scrollIntoView({ block: "start" }); return; }
      const b = ev.target.closest("[data-act]");
      if (b && !CHANGE_ACTS.includes(b.dataset.act) && handlers[b.dataset.act]) handlers[b.dataset.act](b);
    });
    document.addEventListener("picked", (ev) => { if (ev.target.id === "sec-search") openSecurity(ev.detail); });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") for (const m of document.querySelectorAll(".mainnav .menu")) m.hidden = true; });
    window.addEventListener("hashchange", onRoute);
    Store.onChange(() => rerender());
  }

  // Every security in a model is kept in Securities: a new one is added with its fund name and, where the name makes it
  // clear, its asset class. Classes you set yourself are never changed.
  let syncingSecs = false, storeReady = false; // storeReady: every collection has loaded, so "missing" really means missing
  async function syncModelSecurities() {
    if (syncingSecs || !storeReady || Store.readOnly || /couldn't load/i.test(Store.error)) return;
    syncingSecs = true;
    try {
      const syms = [...new Set(Store.all("models").flatMap((m) => Object.keys(U.modelSecurities(m))))].filter((s) => s && !U.isCash(s));
      const missing = syms.filter((s) => !Store.get("securities", s));
      if (!missing.length) return;
      for (const s of missing) await Store.put("securities", s, { symbol: s, global_equivalents: [], tlh_pairs: [], added: new Date().toISOString(), added_from: "model" });
      for (const s of missing) {
        let name = (RH.DEMO_NAMES || {})[s] || "";
        if (!name) { try { const hit = (await RH.api.search(s)).find((x) => x.symbol === s); name = hit ? hit.name : ""; } catch { name = ""; } }
        const cur = Store.get("securities", s);
        if (!cur || !name) continue;
        const cls = cur.asset_class ? null : U.guessClass(name);
        await Store.put("securities", s, { ...cur, name, ...(cls && cls !== "Unclassified" ? { asset_class: cls } : {}) });
      }
      U.rememberSymbols(missing);
      U.toast(`Added ${missing.length} new securit${missing.length > 1 ? "ies" : "y"} from your models to Securities: ${missing.join(", ")}`);
    } finally { syncingSecs = false; }
  }
  let secSyncTimer = null;
  Store.onChange((coll) => { if (coll === "models" || coll === null) { clearTimeout(secSyncTimer); secSyncTimer = setTimeout(syncModelSecurities, 400); } });

  async function start() {
    wire();
    render();
    const [rh] = await Promise.all([RH.init(), Store.init()]);
    document.getElementById("modes").innerHTML = (rh === "live" ? '<span class="modepill">Robinhood: live, read-only</span>'
      : RH.paper ? `<span class="modepill demo" title="Simulated accounts; nothing real is traded">Demo: paper trading at real closing prices (${Charts.fmtDate(RH.paper.priceDate())})</span>`
      : '<span class="modepill demo">Demo data: no Robinhood access on this page</span>') +
      (Store.mode === "local" ? ' <span class="modepill demo">Saved in this browser only</span>' : "");
    U.rememberSymbols(Store.all("models").flatMap((m) => Object.keys(U.modelSecurities(m))));
    U.rememberSymbols(Store.all("securities").map((s) => s.symbol));
    U.migrateRset();
    storeReady = true;
    syncModelSecurities();
    App.rhAccounts().catch(() => {});
    if (RH.mode === "demo" && !RH.paper) History.seedDemo().then(() => { App.state.home.data = {}; rerender(); }); else recordHistory();
    onRoute();
  }
  start();
})(window);
