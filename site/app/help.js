// Support Articles: how to use YRebal and its public demo. Plain HTML articles, grouped by topic, with search.
(function (root) {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const a = (slug, text) => `<a href="#help-${slug}">${text}</a>`;
  const tip = (html) => `<div class="help-tip">${html}</div>`;
  const note = (html) => `<div class="help-note">${html}</div>`;

  const ARTICLES = [
    // ---- Getting started ----
    { slug: "start", cat: "Getting started", title: "Getting started with the demo",
      summary: "Create an account, meet the sample household, and find your way around the top bar.",
      body: `
<p>YRebal compares a household's accounts to target models, flags drift outside tolerance bands, and proposes trades
across taxable, Traditional IRA and Roth IRA accounts. The demo lets you do all of that on a sample household and
paper-trade the results at real closing prices. Nothing in the demo is connected to a brokerage.</p>
<h2>1. Create your account</h2>
<ol>
  <li>On the demo's home page, click <b>Try the demo</b>.</li>
  <li>Enter your name, email and a password, then create your account.</li>
  <li>Open the confirmation email and click its link. It signs you in and opens the demo.
    If it doesn't arrive in a few minutes, check your spam folder, or click <b>Resend email</b> on the sign-up page.</li>
</ol>
<h2>2. Meet the sample household</h2>
<p>You start on <b>Home</b> with a household that already has history back to January 2025:</p>
<table class="help-table"><thead><tr><th>Portfolio</th><th>Accounts</th><th>Model</th></tr></thead><tbody>
  <tr><td>Demo Growth Portfolio</td><td>Family Brokerage (taxable) and Roth IRA</td><td>Model 10</td></tr>
  <tr><td>Demo Income Portfolio</td><td>Traditional IRA</td><td>Model 6</td></tr>
</tbody></table>
<p>Three starter models (Model 6, Model 8 and Model 10) are ready to use, and the Family Brokerage account keeps a
$2,000 emergency set-aside.</p>
<h2>3. The top bar</h2>
<ul>
  <li><b>Home, Me, Models, Securities, Rebalance, Orders</b>: the main menus (see ${a("navigate", "Finding your way around")}).</li>
  <li><b>Support Articles</b>: these articles.</li>
  <li><b>Gear</b>: Settings for rebalancing (see ${a("settings", "Settings reference")}).</li>
  <li><b>Demo: paper trading at real closing prices (date)</b>: the closing date the demo is priced at.</li>
  <li><b>Saved to your account</b>: everything you change is saved to your account, on any device.</li>
  <li><b>Add cash</b>: deposit cash into a demo account (see ${a("cash", "Cash, set-asides and settlement")}).</li>
  <li><b>Reset demo</b>: start over with the original household.</li>
  <li><b>Your name</b>: profile picture, password, data download and account deletion (see ${a("account", "Your account and data")}).</li>
</ul>
${tip(`New here? Follow ${a("first-rebalance", "Your first rebalance, step by step")} for a guided tour.`)}` },

    { slug: "first-rebalance", cat: "Getting started", title: "Your first rebalance, step by step",
      summary: "A 10-minute walkthrough: run a rebalance, review it, approve it, submit the orders and see the results.",
      body: `
<ol class="help-steps">
  <li><b>Create the rebalance.</b> Go to <b>Rebalance &gt; Create Rebalance</b>. Choose <b>Full Rebalance</b> as the type.
    In the search box, type <i>growth</i> and pick <b>Demo Growth Portfolio</b>. Click <b>Create Full Rebalance for 1 portfolio</b>.</li>
  <li><b>Read the result.</b> The <b>Rebalance Result Detail</b> page opens. Look at <b>Cash Values</b> (cash before and after),
    <b>Orders</b> (every proposed buy and sell) and <b>Allocations</b> (each position against its target, before and after).
    See ${a("result", "Reading a rebalance result")}.</li>
  <li><b>Look inside a sell.</b> In the Orders table, click <b>&#9656;</b> next to a sell to see which tax lots it takes.
    The <b>LT / ST / Mixed</b> tag next to the realized gain tells you if the gain is long-term, short-term or both.</li>
  <li><b>Try an edit (optional).</b> Change a buy's amount or set an order to <b>NONE</b>. The changed fields turn light blue and
    every panel recalculates. Click <b>Save</b> at the top to keep your edits (see ${a("editing", "Editing orders")}).</li>
  <li><b>Approve it.</b> Click <b>Approve orders &#9662; &gt; Approve orders</b>. Tick the portfolio's notes box if asked, then confirm.
    The orders go to the <b>Orders</b> blotter as open orders. Nothing has traded yet.</li>
  <li><b>Submit the orders.</b> Click <b>Submit them on the Orders blotter</b> in the message at the top (or open <b>Orders</b>).
    Tick the orders, then <b>Submit selected</b>. They fill at the latest real closing prices and move to <b>Closed</b>
    (see ${a("blotter", "Approving orders and the order blotter")}).</li>
  <li><b>See what changed.</b> Go to <b>Home</b>. Open <b>Allocation vs Target</b>, <b>Activity summary</b>, <b>Performance</b> and
    <b>Transactions</b>: they now include your trades (see ${a("reports", "Home reports")}).</li>
</ol>
${tip(`Next, try rebalancing both portfolios together: ${a("multiple", "Multiple rebalances")}.`)}` },

    { slug: "navigate", cat: "Getting started", title: "Finding your way around",
      summary: "What each menu does and where to find things.",
      body: `
<table class="help-table"><thead><tr><th>Menu</th><th>What it's for</th></tr></thead><tbody>
  <tr><td><b>Home</b></td><td>The dashboard: market value, cash, drift, open orders, and the reports in the left menu
    (Overview, Activity summary, Allocations, Allocation vs Target, Performance, Transactions). See ${a("reports", "Home reports")}.</td></tr>
  <tr><td><b>Me &gt; Accounts</b></td><td>Every account: market value, cash, set-aside and available cash. Open an account for its
    details, performance start date, set-aside cash, reporting and transactions. See ${a("accounts", "Accounts")}.</td></tr>
  <tr><td><b>Me &gt; Portfolios</b></td><td>Groups of accounts managed to one model, with their reporting targets, benchmarks,
    restrictions and notes. See ${a("portfolios", "Portfolios")}.</td></tr>
  <tr><td><b>Me &gt; Unassigned Accounts</b></td><td>Accounts that aren't in a portfolio yet, ready to add to one.</td></tr>
  <tr><td><b>Models</b></td><td>Target allocations: sleeves of securities with weights, a cash line and benchmarks. See ${a("models", "Models")}.</td></tr>
  <tr><td><b>Securities</b></td><td>Search any ticker to see its details and set its asset class, asset location, trade minimums,
    equivalencies and tax-loss pairs. See ${a("securities", "Securities")}.</td></tr>
  <tr><td><b>Rebalance</b></td><td><b>Create Rebalance</b> and <b>Rebalance Results</b>. See ${a("rebalance", "Running a rebalance")}.</td></tr>
  <tr><td><b>Orders</b></td><td>The order blotter: approved orders waiting to be submitted (Open) and filled orders (Closed).
    See ${a("blotter", "Approving orders and the order blotter")}.</td></tr>
  <tr><td><b>Gear</b></td><td>Settings that apply to every rebalance and report. See ${a("settings", "Settings reference")}.</td></tr>
</tbody></table>
<h2>Things that work everywhere</h2>
<ul>
  <li><b>Sort:</b> click a column heading to sort a table; click again to reverse.</li>
  <li><b>Export:</b> the <b>Export</b> button above a table downloads it to Excel.</li>
  <li><b>Search boxes:</b> start typing a ticker, fund name, portfolio or model, then pick from the list.</li>
  <li><b>Hover:</b> some items (like account numbers in a result's Cash Values) show more detail when you hover over them.</li>
</ul>` },

    // ---- Set up ----
    { slug: "models", cat: "Set up", title: "Models",
      summary: "Build target allocations with sleeves, a cash line and benchmarks, by hand or from Excel.",
      body: `
<p>A <b>model</b> is the target a portfolio is rebalanced to. It's made of <b>sleeves</b> (for example Domestic Equity,
International Equity, Fixed Income), each with a weight, and each sleeve holds securities with their own weights.</p>
<h2>Rules a model must follow</h2>
<ul>
  <li>Sleeve weights add up to <b>100%</b>.</li>
  <li>Within each sleeve, security weights add up to <b>100%</b>.</li>
  <li>A security's weight in the model is its sleeve's weight times its weight in the sleeve. For example, SPYM at 55% of a
    65% sleeve is 35.75% of the model.</li>
</ul>
<p>A model that breaks a rule shows <b>Needs attention</b> and can't be used to rebalance until it's fixed.</p>
<h2>The cash line</h2>
<p>Add <b>Cash (uninvested)</b> to a sleeve (search "cash" in the security box) to keep that share of each account in cash.
The starter models keep 0.5%. Without a cash line, the <b>Cash target</b> in Settings is used instead.
See ${a("cash", "Cash, set-asides and settlement")}.</p>
<h2>Benchmarks</h2>
<ul>
  <li><b>Model benchmark:</b> a blend of indexes, each tracked with an ETF (for example 80% MSCI ACWI IMI via VT,
    20% Bloomberg Global Aggregate via BNDW). Portfolios compare their performance to it.</li>
  <li><b>Sleeve benchmark:</b> one index per sleeve, used when you view a sleeve's performance on Home &gt; Performance.</li>
</ul>
<h2>Create and edit models</h2>
<ul>
  <li><b>New model</b> creates an empty model to fill in on its page.</li>
  <li><b>Download Excel template</b> gives you every saved model in one sheet. Edit it in Excel (change weights, add rows or whole
    models), then <b>Upload models</b>. You'll see a preview of every change before anything is saved.</li>
  <li>The model list shows each model's sleeves, securities, status and which portfolios use it.</li>
</ul>
${tip(`To point a portfolio at a model, open the portfolio under <b>Me &gt; Portfolios</b> and choose it under <b>Model</b>.`)}
${note(`Editing a model's weights changes it everywhere it's used, including past reports that use it as a reporting target.
To keep the old and new targets apart in reports, save the change as a new model.`)}` },

    { slug: "portfolios", cat: "Set up", title: "Portfolios",
      summary: "Group accounts, choose a model, and set equivalencies, restrictions, gain limits, reporting and notes.",
      body: `
<p>A <b>portfolio</b> is a group of accounts managed together to one model. An account can belong to only one portfolio.
Open a portfolio from <b>Me &gt; Portfolios</b>. Its menu has four sections.</p>
<h2>Portfolio Details</h2>
<ul>
  <li><b>Accounts:</b> add accounts by searching their name or number, or remove them.</li>
  <li><b>Model:</b> the model this portfolio is rebalanced to.</li>
</ul>
<h2>Trading</h2>
<ul>
  <li><b>Equivalencies:</b> securities that count toward another one's target, for this portfolio only (for example VOO counts toward
    SPYM). Global equivalencies for every portfolio are set on ${a("securities", "Securities")}.</li>
  <li><b>Restrictions:</b>
    <ul>
      <li><b>Never sell</b> a security: it's kept, and the rest of the model is spread across the other securities.</li>
      <li><b>Never buy</b> a security, with what to do instead: <b>Buy alternative security</b>, <b>Leave in cash</b>, or
        <b>Pro-rate across other model securities</b>.</li>
    </ul></li>
  <li><b>Capital gain limits:</b> a maximum short-term, long-term or total realized gain per account (or for all accounts).
    A rebalance stops selling once a limit is reached and says so in its messages.</li>
</ul>
<h2>Reporting</h2>
<p>The <b>reporting target</b> (the model reports compare to) and the <b>benchmark</b>, each with start and end dates. These are set for you
when demo orders fill. See ${a("report-dates", "Report dates")}.</p>
<h2>Notes</h2>
<p>Notes for anyone working on the portfolio. If a portfolio has notes, you're asked to read them before approving its orders.</p>` },

    { slug: "accounts", cat: "Set up", title: "Accounts",
      summary: "Account details, performance start dates, set-aside cash, reporting and transactions.",
      body: `
<p><b>Me &gt; Accounts</b> lists every account with its market value, cash, set-aside cash, available cash and cash as a % of value.
Click an account number to open it. Click the pencil to rename it.</p>
<h2>Account Details</h2>
<ul>
  <li><b>Performance start date:</b> reports measure the account from the close of this date. Set automatically at its first filled
    rebalance (see ${a("report-dates", "Report dates")}).</li>
  <li><b>Market value, Cash, Set-aside cash, Unsettled sale proceeds, Available cash</b>. In the demo, <b>Add cash</b> next to Cash makes a deposit.</li>
</ul>
<h2>Trading</h2>
<p><b>Set-aside cash</b>: cash the account always keeps and never invests, in dollars or as a % of market value. Add several with
different <b>Takes effect</b> dates to schedule them (for example a withdrawal next month). See ${a("cash", "Cash, set-asides and settlement")}.</p>
<h2>Reporting</h2>
<p>An account can have its own benchmark. Without one, it uses its portfolio's benchmark in Performance &gt; By account.</p>
<h2>Transactions</h2>
<p>Deposits, withdrawals, dividends, interest and fees, with their dates. Entered transactions make the Activity summary exact
for any date range.</p>` },

    { slug: "securities", cat: "Set up", title: "Securities",
      summary: "Look up any ticker and set its asset class, asset location, trade minimums, equivalencies and tax-loss pairs.",
      body: `
<p>On <b>Securities</b>, search any US-listed stock, ETF or mutual fund by ticker or name, then click <b>Open</b>.
You'll see its details and its settings, which apply in every portfolio.</p>
<table class="help-table"><thead><tr><th>Setting</th><th>What it does</th></tr></thead><tbody>
  <tr><td><b>Asset class</b></td><td>Equity, Fixed Income, Alternatives and so on. Used by class views in reports and results. A suggestion is offered from the fund's profile.</td></tr>
  <tr><td><b>Geography, Cap-Style</b></td><td>Labels for the Models export. Auto is a best guess from the name.</td></tr>
  <tr><td><b>Asset location</b></td><td>A slider per account type (Taxable, Traditional IRA, Roth IRA) from Avoid to Strongly prefer. When more than one account has cash,
    buys go first to the preferred account type (for example bonds in the Roth).</td></tr>
  <tr><td><b>Minimum buy / Minimum sell ($)</b></td><td>A rebalance skips any buy or sell of this security smaller than these, in any account. Blank uses the
    app-wide minimum trade; the larger applies. Skipped orders are listed in the result's messages.</td></tr>
  <tr><td><b>Global equivalencies</b></td><td>Securities that count toward this one's target in every portfolio. Tick <b>Alt if held</b> to allow buying the
    equivalent when this security can't be bought.</td></tr>
  <tr><td><b>Tax-loss harvesting pairs</b></td><td>What a Tax-Loss Harvesting rebalance buys after selling this security at a loss. Pick a pair that isn't substantially identical.</td></tr>
</tbody></table>
${tip(`Open <b>Cash (uninvested)</b> the same way (search "cash"). It's always the Cash asset class and has nothing to set.`)}` },

    // ---- Rebalancing ----
    { slug: "rebalance", cat: "Rebalancing", title: "Running a rebalance",
      summary: "The five rebalance types, adding portfolios, and where results go.",
      body: `
<h2>Rebalance types</h2>
<table class="help-table"><thead><tr><th>Type</th><th>What it does</th></tr></thead><tbody>
  <tr><td><b>Invest Cash</b></td><td>Buy orders only: invests cash above each account's set-aside plus cash target, into the positions furthest below target.</td></tr>
  <tr><td><b>Generate Cash</b></td><td>Sell orders only: raises cash where an account is below its set-aside plus cash target, selling overweight positions first.</td></tr>
  <tr><td><b>Full Rebalance</b></td><td>Buys and sells to bring every position back within its band. It also sells holdings that aren't in the model (a setting).</td></tr>
  <tr><td><b>Manual Adjustment</b></td><td>Proposes no trades. Opens a result where you enter buys and sells yourself and see their effect.</td></tr>
  <tr><td><b>Tax-Loss Harvesting</b></td><td>Sells positions at a loss and buys their tax-loss pair. See ${a("taxes", "Tax-aware trading")}.</td></tr>
</tbody></table>
<h2>Create a rebalance</h2>
<ol>
  <li>Go to <b>Rebalance &gt; Create Rebalance</b> and pick the type.</li>
  <li>Search for a portfolio and pick it to add it to the list. Add more for a ${a("multiple", "multiple rebalance")}.</li>
  <li>Each portfolio shows its model, accounts and status. A portfolio that isn't <b>Ready</b> (no accounts, no model, or a model that needs attention)
    must be fixed or removed first.</li>
  <li>Click <b>Create</b>. One portfolio opens its result; several open the multiple rebalance's page.</li>
</ol>
<h2>Rebalance Results</h2>
<p>Every result, newest first, with its portfolio, type, number of orders and status:
<b>proposed</b> (not yet approved), <b>approved</b> (orders on the blotter), <b>submitted</b> (all its orders closed) or <b>refused</b>.
A refused result can be brought back with <b>Decision &#9662; &gt; Re-enable Result</b>, which makes it proposed and editable again.
Filter by portfolio or status, and delete results you don't need. The 60 most recent results are kept.</p>
${note(`A rebalance uses the latest prices and your current settings when it's created. Results keep those; changing a setting later
doesn't change an existing result. Run a new rebalance to see the effect.`)}` },

    { slug: "multiple", cat: "Rebalancing", title: "Multiple rebalances",
      summary: "Rebalance several portfolios at once, name the group, and step through each result.",
      body: `
<ol>
  <li>On <b>Create Rebalance</b>, add two or more portfolios (for example Demo Growth Portfolio and Demo Income Portfolio).</li>
  <li><b>3. Name this multiple rebalance</b> appears. Type a name, or leave it blank to use the default (type, number of portfolios and time).</li>
  <li>Click <b>Create</b>. Each portfolio gets its own result, grouped under the name.</li>
</ol>
<ul>
  <li>In <b>Rebalance Results</b>, the group is one row with its portfolio count, total orders and how many results are proposed, approved, submitted or refused.</li>
  <li>Click it to see each portfolio's result. You can <b>Rename</b> it there.</li>
  <li>Inside a result, <b>&lsaquo; Previous</b> and <b>Next &rsaquo;</b> at the top step through the group's portfolios, and <b>Back</b> returns to the group.</li>
  <li><b>Delete</b> on the group's row deletes the group and all its results.</li>
</ul>` },

    { slug: "result", cat: "Rebalancing", title: "Reading a rebalance result",
      summary: "What each panel of the Rebalance Result Detail page shows.",
      body: `
<h2>The top of the page</h2>
<ul>
  <li><b>Back</b>, <b>Save</b>, <b>Copy order list</b>, and the <b>Approve orders</b> menu (Approve or Refuse).</li>
  <li>The info strip: outcome, rebalance name and type, <b>Rebal ID</b> and portfolio. Click the portfolio name to open its settings in a side panel.</li>
  <li>The status message: PROPOSED, EDITED, APPROVED, FILLED or REFUSED, with links to the Orders blotter once approved.</li>
</ul>
<h2>Summary</h2>
<p>Number and value of trades, buys and sells, and estimated short-term and long-term gains, <b>before</b> and <b>after</b> your edits.</p>
<h2>Cash Values</h2>
<p>Each account's cash before the trades, the cash adjustment, and cash after. <b>Unavailable</b> is set-aside cash; <b>Available</b> is the rest.
&#10003; means available cash is within range of the cash target; &#9650; / &#9660; means it's above / below. Hover an account number to see its cash target and
range in dollars. See ${a("cash", "Cash, set-asides and settlement")}.</p>
<h2>Orders</h2>
<p>Every position and order: current position, the order (type, amount, shares), the adjusted position, and the realized gain with an
<b>LT</b>, <b>ST</b> or <b>Mixed</b> tag. Click <b>&#9656;</b> to see a position's tax lots and which ones a sell takes.
See ${a("editing", "Editing orders")}.</p>
<h2>Allocations</h2>
<p>Each position (or asset class, with <b>Show by: Class</b>) against its target: target %, tolerance, target $, actual before, variance, the adjustment,
and the same after the trades. Red &#9650; / &#9660; marks out of band; &#10003; is in band. The header bands count how many are in range before and after.
It's sorted by variance after adjustments, most underweight first. <b>Display</b> switches variance between dollars, Rel % (variance / target)
and Abs % (actual &minus; target).</p>
<h2>Allocation Chart and Messages</h2>
<p>Donuts of the allocation before and after. <b>Rebalance messages</b> explain anything the engine couldn't do, like lots held back for tax reasons,
cash it couldn't place, or trades skipped as too small.</p>` },

    { slug: "editing", cat: "Rebalancing", title: "Editing orders",
      summary: "Change orders, sell whole positions, add securities, and save your edits.",
      body: `
<ul>
  <li><b>Change an order:</b> pick BUY, SELL, SELL ALL or NONE, or type a dollar amount or shares. The other fields and every panel recalculate.</li>
  <li><b>SELL ALL</b> sells the account's whole position. It shows for any position the account holds.</li>
  <li><b>NONE</b> clears the order. Switching back to BUY or SELL starts at zero for you to fill in.</li>
  <li><b>Changed fields</b> turn light blue, and edited rows get a grey edge, so you can tell your edits from the rebalance's own orders.</li>
  <li><b>Buy an unheld security:</b> search a ticker above the table, pick the account and click <b>Add</b>.</li>
  <li><b>Undo user edits</b> puts back the rebalance's orders; <b>Clear all orders</b> sets every order to none.</li>
  <li><b>Realized gain</b> for an edited sell is estimated from average cost (marked *), and its LT/ST tag comes from the lots the portfolio's lot rule would likely sell.</li>
</ul>
<h2>Saving</h2>
<p>Edits aren't saved until you click <b>Save</b> at the top; <i>Unsaved changes</i> shows until then. If you leave with unsaved edits, you're asked to
<b>Save</b>, <b>Discard changes</b> or <b>Stay here</b>. Approving or refusing saves the orders as they stand.</p>
${note(`Once a result is approved, its orders can't be edited. To change them, use <b>Decision &#9662; &gt; Recall orders</b>: if nothing has
filled yet, its open orders come off the blotter and the result goes back to proposed, ready to edit and approve again.`)}` },

    { slug: "blotter", cat: "Rebalancing", title: "Approving orders and the order blotter",
      summary: "Approve, submit and cancel orders; Open and Closed tabs; average daily volume.",
      body: `
<h2>1. Approve</h2>
<p>On a result, <b>Approve orders</b> sends its orders to the <b>Orders</b> blotter as <b>open orders</b>. Nothing trades yet. The result shows
<b>APPROVED</b> with how many orders are open, and <b>Home</b> shows an <b>Open orders</b> donut.</p>
<h2>2. The Open tab</h2>
<p>Open orders wait here until you submit or cancel them. Each shows the account, symbol, order, shares, estimated price and amount, and:</p>
<ul>
  <li><b>Avg daily volume:</b> the security's real average shares traded per day over the last 20 sessions.</li>
  <li><b>% of ADV:</b> the order's shares as a share of that volume. 1% or more is highlighted: a large order relative to normal trading can move the price.</li>
</ul>
<p>Tick orders (or the box in the header for all of them), then <b>Submit selected</b> or <b>Cancel selected</b>. You can submit part of a result and leave the rest open.</p>
<h2>3. Submitting</h2>
<ul>
  <li>Orders fill at the <b>latest real closing price</b> (the date in the top bar), sells first so their cash funds the buys.</li>
  <li>Sells take the tax lots the rebalance chose.</li>
  <li><b>No partial fills:</b> each order fills in full or not at all. A buy the account's cash can't cover, or a sell for more shares than
    the account holds, is rejected whole; you'll see the reason, and it's removed from Open.</li>
  <li>Nothing fills until you submit it: approving only puts orders on the blotter.</li>
  <li>Sale proceeds are unsettled until the next business day (see ${a("cash", "settlement")}).</li>
  <li>The first fills for a portfolio set its report dates (see ${a("report-dates", "Report dates")}).</li>
</ul>
<h2>4. The Closed tab</h2>
<p>Filled orders: account, symbol, order (Buy, Sell or Sell all), shares, fill price, amount, <b>Rebal ID</b> (click it to open the result) and when it was submitted.
It shows the latest submission day to start; use <b>From</b>, <b>To</b>, <b>Portfolio</b>, <b>Latest submission day</b> or <b>All dates</b> to see others.</p>
<p>A result is <b>submitted</b> once none of its orders are open.</p>
<h2>5. Recalling orders</h2>
<p>To take a result's open orders back off the blotter, open the result and choose <b>Decision &#9662; &gt; Recall orders</b>.</p>
<ul>
  <li><b>Nothing filled yet:</b> all its open orders come off the blotter and the result goes back to <b>proposed</b>, so you can edit the orders and approve them again.</li>
  <li><b>Some orders filled:</b> those stay filled; the open ones are recalled and the result closes.</li>
</ul>
<p>To remove just a few orders instead, tick them on the Open tab and use <b>Cancel selected</b>.</p>` },

    // ---- Cash, taxes and trading rules ----
    { slug: "cash", cat: "Cash, taxes and trading rules", title: "Cash, set-asides and settlement",
      summary: "How much cash each account keeps, the cash range, Add cash, and T+1 settlement.",
      body: `
<h2>How much cash an account keeps</h2>
<p>After a rebalance, each account holds:</p>
<p class="help-formula">set-aside cash + cash target</p>
<ul>
  <li><b>Cash target</b> = the model's cash % (or the Cash target in Settings if the model has no cash line) &times; the account's market value.</li>
  <li><b>Set-aside cash</b> is kept on top of that and never invested.</li>
</ul>
<p>Example: the Family Brokerage account ($311,959 market value, a model with 0.5% cash, $2,000 set-aside) keeps
$2,000 + 0.5% &times; $311,959 = <b>$3,559.80</b>.</p>
<h2>The cash range</h2>
<p>Available cash (cash less set-aside) is <b>in range</b> within &plusmn;<b>Cash range</b> of market value around the cash target. With the default
&plusmn;0.25% and a 0.5% target, that's 0.25% to 0.75% of market value. Hover an account number in a result's Cash Values to see the dollars.</p>
<h2>Set-asides</h2>
<p>Add them on an account's <b>Trading</b> section, in dollars or % of market value, with an optional <b>Takes effect</b> date.</p>
<h2>Add cash</h2>
<p><b>Add cash</b> (top bar, or next to Cash on an account's details) deposits cash into a demo account, dated the latest closing date.
It shows in Transactions and the Activity summary. Run an <b>Invest Cash</b> rebalance to put it to work.</p>
<h2>Settlement (T+1)</h2>
<p>US stock and ETF trades settle one business day after the trade. Until then, sale proceeds show as <b>Unsettled sale proceeds</b> and aren't
counted in Available cash. Buys made with them settle the same day, so only the net amount waits. Rebalances can still use unsettled proceeds, as you
would in a brokerage account.</p>` },

    { slug: "taxes", cat: "Cash, taxes and trading rules", title: "Tax-aware trading",
      summary: "Lot selection, short-term gain protection, gain limits, LT/ST tags and tax-loss harvesting.",
      body: `
<h2>Which lots are sold</h2>
<p>Set <b>Lot selection</b> in Settings:</p>
<ul>
  <li><b>Lowest tax</b> (default): sells the lots with the least tax per dollar first, using the short- and long-term tax rates.</li>
  <li><b>Highest cost first</b> (HIFO) and <b>Oldest first</b> (FIFO).</li>
</ul>
<p>IRA positions are sold before taxable gains, since selling in an IRA has no tax.</p>
<h2>Protecting short-term gains</h2>
<ul>
  <li><b>Never sell short-term gains</b> (on by default) holds back lots held a year or less that are at a gain. Lots with no buy date are treated as short-term.</li>
  <li>Lots that turn long-term within 30 days are held back too, so you can wait for the lower rate.</li>
  <li>The result's messages say how much was held back and why. That's why a Full Rebalance may not sell all of a position.</li>
</ul>
<h2>Seeing the tax effect</h2>
<p>Each sell's realized gain is tagged <b>LT</b> (long-term), <b>ST</b> (short-term) or <b>Mixed</b>; click <b>&#9656;</b> for the lots.
The Summary shows estimated short-term and long-term gains before and after your edits.
${a("portfolios", "Capital gain limits")} cap how much gain a rebalance may realize per account.</p>
<h2>Tax-loss harvesting</h2>
<ol>
  <li>Set a <b>tax-loss harvesting pair</b> for each security on ${a("securities", "Securities")}.</li>
  <li>Run a <b>Tax-Loss Harvesting</b> rebalance. It sells taxable positions whose loss lots meet the thresholds in Settings
    (default at least $500 and 5% of cost) and buys the pair.</li>
  <li>It skips a security bought in the last 30 days (wash sale) and tells you not to buy the sold security back for 31 days.</li>
</ol>` },

    // ---- Reports ----
    { slug: "reports", cat: "Reports", title: "Home reports",
      summary: "Overview, Activity summary, Allocations, Allocation vs Target, Performance and Transactions.",
      body: `
<p>On <b>Home</b>, tick the portfolios to report on in the left menu, then pick a report. Most reports use the date bar:
<b>Period</b> (Year to date, Quarter to date, Since inception or a custom start date) and <b>As of</b> (the last business day or a custom date).</p>
<table class="help-table"><thead><tr><th>Report</th><th>What it shows</th></tr></thead><tbody>
  <tr><td><b>Overview</b></td><td>Total market value, cash, portfolios in tolerance, positions out of band, accounts with cash out of range, rebalances awaiting a decision;
    donuts of asset class mix, value by account type and <b>open orders</b>; each portfolio's drift; recent rebalances.</td></tr>
  <tr><td><b>Activity summary</b></td><td>Beginning value, net additions, withdrawals, realized gain, unrealized gain (change), income, fees and ending value, for the
    period, in total and by account.</td></tr>
  <tr><td><b>Allocations</b></td><td>What you hold, grouped by account and class, account and asset, class, or asset, with drill-down.</td></tr>
  <tr><td><b>Allocation vs Target</b></td><td>Each asset class against the reporting target model. Differences beyond the asset class tolerance (default &plusmn;5%) are red.
    Pick another model to see how far you are from it, and <b>Portfolio drift</b> for position detail.</td></tr>
  <tr><td><b>Performance</b></td><td>Time-weighted return against the benchmark, a cumulative return chart, each sleeve, and each account on its own.</td></tr>
  <tr><td><b>Transactions</b></td><td>Every buy, sell, deposit, withdrawal, dividend, interest and fee, filterable by type and account type, sortable by any column.</td></tr>
</tbody></table>
${note(`Time-weighted return removes the effect of deposits and withdrawals, so it measures the investments, not the timing of cash moving in and out.`)}
${tip(`Reports start from each account's performance start date. If a report looks empty or short, check ${a("report-dates", "Report dates")}.`)}` },

    { slug: "report-dates", cat: "Reports", title: "Report dates: performance start, reporting target and benchmark",
      summary: "What these dates do, and how they're set automatically when demo orders fill.",
      body: `
<p>Three dates decide what your reports measure. All of them are <b>as of the close</b> of the day.</p>
<table class="help-table"><thead><tr><th>Date</th><th>Where</th><th>What it does</th></tr></thead><tbody>
  <tr><td><b>Performance start date</b></td><td>Account details</td><td>Reports measure the account from the close of this date; its value then is its starting value.</td></tr>
  <tr><td><b>Reporting target</b></td><td>Portfolio &gt; Reporting</td><td>The model Allocation vs Target and Performance's sleeves compare to, by date.</td></tr>
  <tr><td><b>Benchmark</b></td><td>Portfolio &gt; Reporting</td><td>The model benchmark Performance compares to, by date.</td></tr>
</tbody></table>
<h2>Set automatically when demo orders fill</h2>
<table class="help-table"><thead><tr><th>Situation</th><th>What's set (to the trade date)</th></tr></thead><tbody>
  <tr><td>A portfolio's first filled rebalance</td><td>Each account's performance start date, the reporting target and the benchmark.</td></tr>
  <tr><td>An account added to the portfolio later</td><td>That account's performance start date, at its first filled rebalance.</td></tr>
  <tr><td>A rebalance to a different model</td><td>The reporting target and benchmark switch to the new model; the old one ends the day before. Performance start dates don't change.</td></tr>
  <tr><td>Same model, or nothing filled</td><td>No change.</td></tr>
</tbody></table>
<p>The result's <b>Submission</b> panel lists what was set. You can change any date yourself.</p>
${note(`The trade date is the closing date the orders filled at. Orders submitted on a weekend fill at Friday's close, so Friday is the trade date.`)}` },

    // ---- Account and data ----
    { slug: "settings", cat: "Reference", title: "Settings reference",
      summary: "Every rebalance setting, what it does and its default.",
      body: `
<p>Click the <b>gear</b>, then <b>Rebalance</b>. Settings apply to every portfolio's rebalances and reports. Change them, then <b>Save changes</b>.</p>
<table class="help-table"><thead><tr><th>Setting</th><th>Default</th><th>What it does</th></tr></thead><tbody>
  <tr><td>Cash target (% of account)</td><td>5%</td><td>Cash to keep when the model has no Cash line. The starter models have a 0.5% cash line, so this isn't used for them.</td></tr>
  <tr><td>Cash range (&plusmn; % of MV)</td><td>0.25%</td><td>How far available cash may be from the cash target and still be in range.</td></tr>
  <tr><td>Position tolerance (&plusmn; pts)</td><td>2%</td><td>How far a position may drift from its target before it's out of band and a Full Rebalance trades it.</td></tr>
  <tr><td>Asset class tolerance (&plusmn; pts)</td><td>5%</td><td>The band for asset classes in results and Allocation vs Target.</td></tr>
  <tr><td>Minimum trade ($)</td><td>$25</td><td>Smaller trades are skipped. Securities can set a higher minimum buy or sell.</td></tr>
  <tr><td>Fractional shares</td><td>On</td><td>Trade fractions of a share; off rounds to whole shares.</td></tr>
  <tr><td>Full rebalance sells holdings not in the model</td><td>On</td><td>Off leaves them alone and applies the model to the rest.</td></tr>
  <tr><td>Short-term / Long-term tax rate</td><td>32% / 15%</td><td>Used to estimate tax and to choose the lowest-tax lots.</td></tr>
  <tr><td>Lot selection</td><td>Lowest tax</td><td>Which lots are sold first: Lowest tax, Highest cost first or Oldest first.</td></tr>
  <tr><td>Never sell short-term gains</td><td>On</td><td>Holds back lots held a year or less at a gain.</td></tr>
  <tr><td>Harvest losses of at least ($) / (% of cost)</td><td>$500 / 5%</td><td>Thresholds for Tax-Loss Harvesting.</td></tr>
</tbody></table>
${note(`Your settings are saved with your demo. When a default changes in a later version, your saved settings keep your value; use <b>Reset demo</b> to
pick up the new defaults (it also resets everything else).`)}` },

    { slug: "prices", cat: "Reference", title: "Prices and data in the demo",
      summary: "Where prices and volume come from, when they update, and what the demo can trade.",
      body: `
<ul>
  <li><b>Real prices.</b> Holdings are valued at real daily closing prices (Yahoo Finance, split-adjusted). The date in the top bar is the latest close.</li>
  <li><b>Updates.</b> Common funds refresh every weekday evening after the US market close. Any other US-listed stock, ETF or mutual fund is priced the first
    time you use it, then kept in your browser until the next close.</li>
  <li><b>Fills.</b> Submitted orders fill at the latest close. There are no intraday prices, so the time you submit doesn't change the price.</li>
  <li><b>Volume.</b> Average daily volume on the blotter is the real 20-session average, loaded once a day. Some mutual funds don't report volume and show n/a.</li>
  <li><b>History.</b> The sample household's history (deposits and purchases since January 2025) is built from real closes on those dates.</li>
  <li><b>No brokerage.</b> The demo has no brokerage connection. Accounts are made up and every trade is simulated.</li>
</ul>
${note(`"No price found" when creating a rebalance means a model ticker isn't a US-listed security (or is misspelled). Fix the ticker in the model.`)}` },

    { slug: "account", cat: "Reference", title: "Your account and data",
      summary: "Sign-in, passwords, profile picture, data download, Reset demo and deleting your account.",
      body: `
<ul>
  <li><b>Log in / Log out:</b> log in from the demo's home page; <b>Log out</b> is in the top bar. Your demo is saved before you log out.</li>
  <li><b>Forgot your password?</b> On the log-in form, click <b>Forgot password?</b> and follow the email link to set a new one.</li>
  <li><b>Your name</b> (top bar) opens your settings:
    <ul>
      <li><b>Profile:</b> upload or remove a profile picture, and change your name.</li>
      <li><b>Account:</b> your email, when you joined, change your password, log out.</li>
      <li><b>Demo data:</b> download your demo as a file, or reset it.</li>
      <li><b>Delete account:</b> type DELETE to permanently delete your account, demo and picture.</li>
    </ul></li>
  <li><b>Reset demo:</b> puts the household, models, settings and history back to how they started. Your account stays.</li>
  <li><b>Privacy:</b> your demo is saved to your account and only you can read it. It holds sample data only.</li>
</ul>` },

    { slug: "faq", cat: "Reference", title: "Troubleshooting and FAQ",
      summary: "Answers to common questions.",
      body: `
<dl class="help-faq">
  <dt>The demo looks out of date after an update.</dt>
  <dd>Press <b>Ctrl+Shift+R</b> (Windows) or <b>Cmd+Shift+R</b> (Mac) to reload without the browser's saved copy.</dd>
  <dt>My confirmation or password email didn't arrive.</dt>
  <dd>Check spam and other tabs. On the sign-up page, click <b>Resend email</b>. Emails come from YRebal's own address.</dd>
  <dt>A Full Rebalance didn't sell all of a position that isn't in the model.</dt>
  <dd>Lots at a short-term gain are held back by <b>Never sell short-term gains</b>. The result's messages say so. Turn the setting off, or use SELL ALL on the order.</dd>
  <dt>Cash shows &#10003; but there's more cash than I expected.</dt>
  <dd>Check <b>Cash range</b> in Settings: a wide range accepts more cash. Hover the account number in Cash Values to see the range in dollars.</dd>
  <dt>I changed a setting but my result didn't change.</dt>
  <dd>Results keep the settings they were created with. Run a new rebalance.</dd>
  <dt>A new default (or the new sample household) doesn't show in my demo.</dt>
  <dd>Your saved demo keeps your settings and household. <b>Reset demo</b> picks up the new ones, but also clears your changes.</dd>
  <dt>Allocation vs Target shows Cash above target.</dt>
  <dd>Set-aside cash is kept on top of the model's cash, so Cash sits above its target by the set-aside.</dd>
  <dt>I can't edit an approved result.</dt>
  <dd>Use <b>Decision &#9662; &gt; Recall orders</b>. If none of its orders have filled, the result goes back to proposed and you can edit it;
    if some have, the rest are recalled and the result closes, so run a new rebalance.</dd>
  <dt>"No price found for ..."</dt>
  <dd>A ticker in the model isn't a US-listed security or is misspelled. Fix it on the model's page.</dd>
  <dt>Reports are empty or start late.</dt>
  <dd>Reports start from each account's performance start date. Check it on the account's details, and the report's Period and As of.</dd>
</dl>` },

    { slug: "glossary", cat: "Reference", title: "Glossary",
      summary: "Terms used in YRebal.",
      body: `
<dl class="help-faq">
  <dt>ADV (average daily volume)</dt><dd>The average number of shares traded per day, here over the last 20 sessions.</dd>
  <dt>Asset location</dt><dd>Holding each asset in the account type where it's taxed best (for example bonds in an IRA).</dd>
  <dt>Band (tolerance)</dt><dd>How far a position or class may drift from target before it's out of band.</dd>
  <dt>Benchmark</dt><dd>A blend of indexes that performance is compared to.</dd>
  <dt>Drift / variance</dt><dd>The difference between what you hold and the target.</dd>
  <dt>Equivalency</dt><dd>A security whose holdings count toward another security's target.</dd>
  <dt>FIFO / HIFO</dt><dd>Selling the oldest lots first / the highest-cost lots first.</dd>
  <dt>Lot (tax lot)</dt><dd>Shares bought on one date at one price. Each lot has its own cost and holding period.</dd>
  <dt>Long-term / short-term gain</dt><dd>Gains on lots held more than a year / a year or less. Long-term gains are usually taxed at a lower rate.</dd>
  <dt>Model / sleeve</dt><dd>A target allocation / one part of it, such as Fixed Income.</dd>
  <dt>Open / closed order</dt><dd>An approved order waiting on the blotter / one that has been filled, canceled or rejected.</dd>
  <dt>Rebal ID</dt><dd>The ID of a rebalance result; orders link back to it.</dd>
  <dt>Set-aside cash</dt><dd>Cash an account always keeps and never invests.</dd>
  <dt>T+1</dt><dd>Settlement one business day after the trade date.</dd>
  <dt>Time-weighted return</dt><dd>Return that removes the effect of deposits and withdrawals.</dd>
  <dt>Wash sale</dt><dd>Buying back a security within 30 days of selling it at a loss, which disallows the loss for taxes.</dd>
</dl>` },
  ];

  const CATS = [...new Set(ARTICLES.map((x) => x.cat))];
  const bySlug = Object.fromEntries(ARTICLES.map((x) => [x.slug, x]));
  const textOf = (html) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

  function list() {
    const q = (root.App && App.state.helpQ || "").trim().toLowerCase();
    const hit = (x) => !q || (x.title + " " + x.summary + " " + textOf(x.body)).toLowerCase().includes(q);
    const groups = CATS.map((c) => [c, ARTICLES.filter((x) => x.cat === c && hit(x))]).filter(([, xs]) => xs.length);
    return `<div class="page-head"><h1>Support Articles</h1><span class="muted small">How to use YRebal and its demo</span></div>
      <section class="card"><div class="body">
        <div class="addrow"><input type="search" id="help-q" class="search-in" placeholder="Search articles" aria-label="Search articles" value="${esc(q)}"></div>
        ${groups.length ? groups.map(([c, xs]) => `<h2 class="help-cat">${esc(c)}</h2><div class="help-grid">
          ${xs.map((x) => `<a class="help-card" href="#help-${x.slug}"><b>${esc(x.title)}</b><span>${esc(x.summary)}</span></a>`).join("")}</div>`).join("")
          : `<p class="hint">No article matches "${esc(q)}".</p>`}
      </div></section>`;
  }
  function article(slug) {
    const x = bySlug[slug];
    if (!x) return `<p class="hint">That article doesn't exist. <a href="#help">All support articles</a></p>`;
    const i = ARTICLES.indexOf(x), prev = ARTICLES[i - 1], next = ARTICLES[i + 1];
    const related = ARTICLES.filter((y) => y.cat === x.cat && y !== x);
    return `<div class="page-head"><a class="linkbtn" href="#help">&larr; Support Articles</a><span class="muted small">${esc(x.cat)}</span></div>
      <div class="help-layout"><article class="card help-article"><div class="body"><h1>${esc(x.title)}</h1><p class="lede">${esc(x.summary)}</p>${x.body}
        <nav class="help-pager">${prev ? `<a href="#help-${prev.slug}">&larr; ${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a href="#help-${next.slug}">${esc(next.title)} &rarr;</a>` : ""}</nav></div></article>
        <aside class="card help-side"><div class="body"><h2>In ${esc(x.cat)}</h2><ul>${related.map((y) => `<li><a href="#help-${y.slug}">${esc(y.title)}</a></li>`).join("") || "<li class='muted'>No other articles.</li>"}</ul>
          <h2>All topics</h2><ul>${CATS.map((c) => `<li><a href="#help-${ARTICLES.find((y) => y.cat === c).slug}">${esc(c)}</a></li>`).join("")}</ul></div></aside></div>`;
  }
  root.Help = { ARTICLES, page: (route) => (route === "help" ? list() : article(route.slice(5))) };
})(window);
