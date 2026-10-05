// The demo opens for signed-in visitors. Without a sign-in in this browser, go to the log-in form.
// (With accounts on, demo.js also checks the session with the server before loading anything.)
(function () {
  var cfg = window.REBAL_CONFIG || {}, ok = false;
  var accounts = !!(cfg.supabaseUrl && cfg.supabaseKey);
  try { ok = !!localStorage.getItem(accounts ? "rebalancer-auth" : "rebalancer-demo-access"); } catch (e) { ok = false; }
  // Arriving from a confirmation email: the sign-in is in the link itself; demo.js finishes it.
  if (accounts && /access_token=|[?&]code=/.test(location.hash + location.search)) ok = true;
  // A bad or expired email link: show the reason on the log-in form.
  if (accounts && /error_description=/.test(location.hash)) { location.replace("../" + location.hash); return; }
  // Without accounts, arriving straight from the sign-up form also counts (covers browsers where storage is blocked).
  if (!accounts && /[?&]signedup=1\b/.test(location.search)) {
    ok = true;
    try { if (!localStorage.getItem("rebalancer-demo-access")) localStorage.setItem("rebalancer-demo-access", JSON.stringify({ at: new Date().toISOString() })); } catch (e) { /* ignore */ }
  }
  if (!ok) location.replace(accounts ? "../#login" : "../#signup");
})();
