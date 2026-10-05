// App data: models, portfolios, accounts (set-aside cash), securities, results.
// Saved in the published page's database so it persists and Claude can read it; else in this browser.
(function (root) {
  "use strict";
  const COLLECTIONS = ["models", "portfolios", "accounts", "securities", "results", "batches", "history", "snapshots", "settings"];
  const LOCAL_KEY = "rebal-app-v1";
  const cache = Object.fromEntries(COLLECTIONS.map((c) => [c, {}]));
  const listeners = new Set();
  const chains = new Map();
  let db = null, mode = "pending", readOnly = false, lastError = "";

  function emit(coll) { for (const fn of listeners) fn(coll); }
  function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(cache)); } catch { lastError = "Browser storage is unavailable, so changes won't be kept."; } }

  async function init() {
    try { db = root.claude && root.claude.use ? await root.claude.use("db") : null; } catch { db = null; }
    if (!db) {
      mode = "local";
      try { const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"); if (saved) for (const c of COLLECTIONS) cache[c] = saved[c] || {}; } catch { /* none */ }
      emit(null);
      return mode;
    }
    mode = "db";
    await Promise.all(COLLECTIONS.map((c) => new Promise((ready) => {
      let first = true;
      db.collection(c).onSnapshot((snap) => {
        const next = {};
        for (const d of snap.docs) if (d.exists) next[d.id] = d.data();
        cache[c] = next;
        if (first) { first = false; ready(); }
        emit(c);
      }, (e) => { lastError = "Couldn't load saved " + c + (e && e.code ? ` (${e.code})` : ""); if (first) { first = false; ready(); } emit(c); });
    })));
    return mode;
  }

  // One write at a time per document.
  function put(coll, id, data) {
    cache[coll] = { ...cache[coll], [id]: data };
    emit(coll);
    if (mode !== "db") { saveLocal(); return Promise.resolve(); }
    const key = coll + "/" + id;
    const next = (chains.get(key) || Promise.resolve()).then(() => db.collection(coll).doc(id).set(JSON.parse(JSON.stringify(data))))
      .catch((e) => {
        if (e && e.code === "invalid_argument") readOnly = true;
        lastError = e && e.code === "quota_exceeded" ? "Storage is full: delete old results to save more." : `Couldn't save (${(e && e.code) || "error"}).`;
        emit(coll);
      });
    chains.set(key, next);
    return next;
  }
  function remove(coll, id) {
    const copy = { ...cache[coll] }; delete copy[id]; cache[coll] = copy;
    emit(coll);
    if (mode !== "db") { saveLocal(); return Promise.resolve(); }
    const key = coll + "/" + id;
    const next = (chains.get(key) || Promise.resolve()).then(() => db.collection(coll).doc(id).delete()).catch(() => { lastError = "Couldn't delete."; emit(coll); });
    chains.set(key, next);
    return next;
  }
  const debounced = new Map();
  function putSoon(coll, id, data, ms = 500) {
    cache[coll] = { ...cache[coll], [id]: data };
    clearTimeout(debounced.get(coll + id));
    debounced.set(coll + id, setTimeout(() => put(coll, id, cache[coll][id]), ms));
  }

  const newId = (p) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  root.Store = {
    init, put, putSoon, remove, newId,
    get: (c, id) => cache[c][id],
    all: (c) => Object.values(cache[c]),
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    get mode() { return mode; }, get readOnly() { return readOnly; },
    get error() { return lastError; }, clearError() { lastError = ""; },
  };
})(window);
