const Chart = window.Chart;

const app = document.querySelector('#app');
const CATEGORIES = ['Food', 'Travel', 'Shopping', 'Education', 'Salary', 'Entertainment', 'Bills', 'Other'];
const CATEGORY_COLORS = {
  Food: '#e9a17c', Travel: '#91ad73', Shopping: '#a79bd5', Education: '#79a9bf',
  Salary: '#d0b453', Entertainment: '#e2c05e', Bills: '#df8c7c', Other: '#9ba9a0'
};
const CATEGORY_ICONS = {
  Food: 'F', Travel: 'T', Shopping: 'S', Education: 'E',
  Salary: 'S', Entertainment: 'E', Bills: 'B', Other: 'O'
};
const STORAGE_KEY = 'daybook.transactions.v1';
const BUDGET_KEY = 'daybook.monthlyBudget.v1';
const today = new Date();
let selectedMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
let currentView = 'dashboard';
let searchTerm = '';
let categoryFilter = 'all';
let editingId = null;
let toastTimer;
let spendingChart;
let analyticsChart;

function dateAt(dayOffset, monthOffset = 0) {
  const date = new Date(today.getFullYear(), today.getMonth() + monthOffset, Math.min(dayOffset, 26));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function seedData() {
  return [
    { id: crypto.randomUUID(), title: 'Monthly salary', category: 'Salary', type: 'income', amount: 72000, date: dateAt(1), note: 'Monthly pay' },
    { id: crypto.randomUUID(), title: 'Coffee & a catch-up', category: 'Food', type: 'expense', amount: 385, date: dateAt(2), note: 'Cafe Niloufer' },
    { id: crypto.randomUUID(), title: 'Metro card top-up', category: 'Travel', type: 'expense', amount: 500, date: dateAt(4), note: 'Commute' },
    { id: crypto.randomUUID(), title: 'Groceries for the week', category: 'Food', type: 'expense', amount: 1840, date: dateAt(5), note: 'Fresh produce' },
    { id: crypto.randomUUID(), title: 'Streaming subscription', category: 'Entertainment', type: 'expense', amount: 299, date: dateAt(7), note: '' },
    { id: crypto.randomUUID(), title: 'Course materials', category: 'Education', type: 'expense', amount: 1240, date: dateAt(9), note: 'Online course' },
    { id: crypto.randomUUID(), title: 'Electricity bill', category: 'Bills', type: 'expense', amount: 2160, date: dateAt(12), note: 'Monthly bill' },
    { id: crypto.randomUUID(), title: 'Weekend market', category: 'Shopping', type: 'expense', amount: 1290, date: dateAt(15), note: 'Home bits' },
    { id: crypto.randomUUID(), title: 'Lunch with Anya', category: 'Food', type: 'expense', amount: 720, date: dateAt(18), note: 'Sunday lunch' },
    { id: crypto.randomUUID(), title: 'Auto ride', category: 'Travel', type: 'expense', amount: 245, date: dateAt(20), note: '' }
  ];
}

function loadTransactions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new TypeError('Saved transactions must be a list.');
      return parsed.map(item => ({
        ...item,
        type: item.type === 'income' ? 'income' : 'expense',
        category: item.category === 'Food & dining' ? 'Food'
          : item.category === 'Health' ? 'Other'
            : CATEGORIES.includes(item.category) ? item.category : 'Other'
      }));
    }
  } catch (error) {
    console.warn('Could not read saved transactions.', error);
  }
  const examples = seedData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(examples));
  return examples;
}

let transactions = loadTransactions();
let monthlyBudget = Number(localStorage.getItem(BUDGET_KEY)) || 30000;

function saveTransactions(value = transactions) {
  transactions = value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function money(amount, compact = false) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
    notation: compact && amount >= 100000 ? 'compact' : 'standard'
  }).format(amount);
}

function monthDate(monthString) {
  const [year, month] = monthString.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function monthName(monthString = selectedMonth) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(monthDate(monthString));
}

function dateLabel(dateString) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${dateString}T12:00:00`));
}

function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isValidDateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function selectedTransactions() {
  return transactions.filter(item => item.date.startsWith(selectedMonth)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount), 0);
}

function incomeTotal(items) {
  return sum(items.filter(item => item.type === 'income'));
}

function expenseTotal(items) {
  return sum(items.filter(item => item.type !== 'income'));
}

function icon(name) {
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    transactions: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="7" cy="7" r="1"/><circle cx="7" cy="12" r="1"/><circle cx="7" cy="17" r="1"/>',
    analytics: '<path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/><path d="M16 7h3v3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.8Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    edit: '<path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
    trend: '<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function navButton(view, label) {
  return `<button class="nav-link ${currentView === view ? 'active' : ''}" data-view="${view}" aria-current="${currentView === view ? 'page' : 'false'}" data-testid="nav-${view}">
    <span class="nav-icon">${icon(view)}</span><span>${label}</span>
  </button>`;
}

function shell(content) {
  return `<div class="app-shell">
    <aside class="sidebar" aria-label="Main navigation">
      <div class="brand"><div class="brand-mark" aria-hidden="true">d</div><div><div class="brand-name">daybook</div><span class="brand-note">MONEY, MINDFULLY</span></div></div>
      <div class="nav-label">YOUR SPACE</div>
      <nav class="nav-list">${navButton('dashboard', 'Dashboard')}${navButton('transactions', 'Transactions')}${navButton('analytics', 'Analytics')}${navButton('settings', 'Settings')}</nav>
      <div class="side-spacer"></div>
      <div class="side-tip"><div class="side-tip-kicker">A gentle reminder</div><p>Small, steady check-ins make money feel a little simpler.</p></div>
      <div class="profile"><div class="avatar" aria-hidden="true">Y</div><div><strong>Your daybook</strong><small>Just for you</small></div></div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div class="mobile-brand"><div class="brand-mark" aria-hidden="true">d</div>daybook</div>
        <div class="crumb">Your space <span aria-hidden="true">/</span> <strong>${viewTitle()}</strong></div>
        <div class="top-actions">
          <label class="month-control"><span>Looking at</span><input type="month" id="month-picker" aria-label="Select month" value="${selectedMonth}" data-testid="input-month"></label>
          <button class="icon-button" type="button" id="top-add" aria-label="Add a transaction" title="Add a transaction" data-testid="button-add-expense">${icon('trend')}</button>
        </div>
      </header>
      <section class="content" id="view-content">${content}</section>
    </main>
    <nav class="mobile-nav" aria-label="Main navigation">${navButton('dashboard', 'Home')}${navButton('transactions', 'Activity')}${navButton('analytics', 'Insights')}${navButton('settings', 'Settings')}</nav>
    <div class="modal-backdrop" id="modal-backdrop" aria-hidden="true"></div>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  </div>`;
}

function viewTitle() {
  return { dashboard: 'Dashboard', transactions: 'Transactions', analytics: 'Analytics', settings: 'Settings' }[currentView];
}

function dashboardView() {
  const items = selectedTransactions();
  const income = incomeTotal(items);
  const expenses = expenseTotal(items);
  const balance = income - expenses;
  const priorMonth = new Date(monthDate(selectedMonth).getFullYear(), monthDate(selectedMonth).getMonth() - 1, 1);
  const priorKey = `${priorMonth.getFullYear()}-${String(priorMonth.getMonth() + 1).padStart(2, '0')}`;
  const priorTotal = expenseTotal(transactions.filter(item => item.date.startsWith(priorKey)));
  const difference = priorTotal ? Math.round(((expenses - priorTotal) / priorTotal) * 100) : null;
  const expenseCount = items.filter(item => item.type !== 'income').length;
  const avg = expenseCount ? expenses / expenseCount : 0;
  const left = monthlyBudget - expenses;
  const progress = monthlyBudget > 0 ? Math.min((expenses / monthlyBudget) * 100, 100) : 0;
  const recent = items.slice(0, 5);
  const categories = CATEGORIES.filter(category => category !== 'Salary')
    .map(category => ({ category, total: sum(items.filter(item => item.category === category && item.type !== 'income')) }))
    .filter(item => item.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

  return `<div class="view-heading"><div><div class="eyebrow">A clear look at your money</div><h1>Your month, in view.</h1><p class="subtitle">A little clarity goes a long way. Here's how ${monthName()} is shaping up.</p></div><button class="button button-primary" id="add-expense" data-testid="button-add-expense-main"><span class="button-icon">＋</span>Add transaction</button></div>
    <div class="dashboard-grid">
      <article class="balance-card" data-testid="card-total-balance">
        <div><div class="balance-top"><span class="balance-dot"></span> TOTAL BALANCE · ${monthName().toUpperCase()}</div><div class="balance-value">${money(balance)}</div><div class="balance-caption">Income minus expenses this month</div></div>
        <div class="balance-bottom"><div class="balance-change">${difference === null ? 'A fresh start' : `${difference > 0 ? '↑' : difference < 0 ? '↓' : '—'} ${Math.abs(difference)}%`} <span>${difference === null ? 'Spending vs. last month' : 'spending vs. last month'}</span></div>
          <svg class="balance-spark" viewBox="0 0 118 39" fill="none" aria-hidden="true"><path d="M2 29c12-9 13 4 24-1s13-18 24-11 11 12 23 4 12 9 23 2 12-14 20-18" stroke="#d9edb0" stroke-width="2" stroke-linecap="round"/><path d="M2 38h114" stroke="rgba(255,255,255,.18)"/></svg></div>
      </article>
      <article class="summary-metric income-metric" data-testid="card-total-income"><div class="summary-label"><span class="summary-mark">${icon('trend')}</span>Total income</div><div class="summary-value">${money(income)}</div><div class="summary-caption">${items.filter(item => item.type === 'income').length} income ${items.filter(item => item.type === 'income').length === 1 ? 'transaction' : 'transactions'} this month</div></article>
      <article class="summary-metric expense-metric" data-testid="card-total-expenses"><div class="summary-label"><span class="summary-mark">${icon('transactions')}</span>Total expenses</div><div class="summary-value">${money(expenses)}</div><div class="summary-caption">${expenseCount} ${expenseCount === 1 ? 'purchase' : 'purchases'} · avg. ${money(avg)}</div></article>
      <article class="budget-card" data-testid="card-budget">
        <div class="budget-topline"><div><div class="card-title-row"><h2 class="card-title">Monthly budget</h2><button class="small-link" data-view="settings">Adjust</button></div><div class="budget-period">${monthName()} · expense limit</div></div><div class="budget-numbers"><span class="budget-spent">${money(expenses)}</span><span class="budget-total">of ${money(monthlyBudget)}</span></div></div>
        <div class="progress-track" role="progressbar" aria-label="Monthly budget used" aria-valuenow="${Math.round(progress)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill ${expenses > monthlyBudget ? 'over' : ''}" style="width:${progress}%"></div></div>
        <div class="budget-foot"><span>${Math.round((expenses / Math.max(monthlyBudget, 1)) * 100)}% used</span><strong>${left >= 0 ? `${money(left)} left` : `${money(Math.abs(left))} over`}</strong></div>
        <div class="budget-alert" style="display:${expenses > monthlyBudget ? 'block' : 'none'}" role="status">You’re over budget by ${money(expenses - monthlyBudget)}. Take a breath and review what matters.</div>
      </article>
    </div>
    <div class="lower-grid">
      <article class="panel"><div class="panel-header"><div><h2>Spending rhythm</h2><div class="panel-sub">Daily spend · ${monthName()}</div></div><button class="small-link" data-view="analytics">More insights →</button></div><div class="chart-wrap"><canvas id="spending-chart" aria-label="Daily spending chart" role="img"></canvas></div></article>
      <article class="panel"><div class="panel-header"><div><h2>Where it goes</h2><div class="panel-sub">By category this month</div></div></div>${categories.length ? `<div class="category-list">${categories.map(item => `<div class="category-item"><span class="category-dot" style="background:${CATEGORY_COLORS[item.category]}"></span><span class="category-name">${item.category}</span><span class="category-amount">${money(item.total)}</span></div>`).join('')}</div>` : `<div class="empty-state"><strong>No categories yet</strong>Add an expense to see your mix.</div>`}</article>
    </div>
    <article class="panel transactions-panel"><div class="panel-header"><div><h2>Recent transactions</h2><div class="panel-sub">Your latest little money moments</div></div><button class="small-link" data-view="transactions">See all →</button></div>${renderRows(recent)}</article>`;
}

function renderRows(items) {
  if (!items.length) return `<div class="empty-state" data-testid="empty-transactions"><strong>A clean slate.</strong>Your transactions for this month will show up here.<br><button class="button button-light" style="margin-top:14px" data-action="add">Add your first transaction</button></div>`;
  return `<div class="transaction-list">${items.map(item => `<div class="transaction-row" data-testid="row-transaction-${item.id}">
    <div class="transaction-main"><span class="category-icon ${categoryClass(item.category)}" aria-hidden="true">${CATEGORY_ICONS[item.category] || 'O'}</span><div style="min-width:0"><div class="transaction-title">${escapeHtml(item.title)}</div><div class="transaction-category">${escapeHtml(item.category)} · ${item.type === 'income' ? 'Income' : 'Expense'}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</div></div></div>
    <div class="transaction-date">${dateLabel(item.date)}</div><div class="transaction-amount ${item.type === 'income' ? 'income-amount' : 'expense-amount'}">${item.type === 'income' ? '+' : '−'}${money(Number(item.amount))}</div>
    <div class="row-actions"><button class="row-action" data-action="edit" data-id="${item.id}" aria-label="Edit ${escapeHtml(item.title)}" title="Edit" data-testid="button-edit-${item.id}">${icon('edit')}</button><button class="row-action" data-action="delete" data-id="${item.id}" aria-label="Delete ${escapeHtml(item.title)}" title="Delete" data-testid="button-delete-${item.id}">${icon('trash')}</button></div>
  </div>`).join('')}</div>`;
}

function categoryClass(category) {
  return ({ Food: 'food', Travel: 'travel', Shopping: 'shopping', Education: 'education', Salary: 'salary', Bills: 'bills', Entertainment: 'entertainment' })[category] || 'other';
}

function transactionsView() {
  const filtered = selectedTransactions().filter(item => {
    const matchesText = `${item.title} ${item.note || ''} ${item.category}`.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesText && (categoryFilter === 'all' || item.category === categoryFilter);
  });
  return `<div class="view-heading"><div><div class="eyebrow">The little details</div><h1>Transactions</h1><p class="subtitle">Every purchase and payment, all in one place. ${monthName()} has ${selectedTransactions().length} entries.</p></div><button class="button button-primary" id="add-expense"><span class="button-icon">＋</span>Add transaction</button></div>
    <div class="filters"><label class="search-wrap">${icon('search')}<span class="visually-hidden">Search transactions</span><input type="search" id="transaction-search" placeholder="Search a purchase…" value="${escapeHtml(searchTerm)}" data-testid="input-search"></label><label class="visually-hidden" for="category-filter">Filter by category</label><select class="filter-select" id="category-filter" data-testid="filter-category"><option value="all">All categories</option>${CATEGORIES.map(category => `<option value="${category}" ${categoryFilter === category ? 'selected' : ''}>${category}</option>`).join('')}</select></div>
    <article class="panel"><div class="list-head"><span>Purchase</span><span>Date</span><span>Amount</span><span></span></div><div id="filtered-transactions">${renderRows(filtered)}</div><div class="panel-sub" style="margin-top:13px">${filtered.length} ${filtered.length === 1 ? 'transaction' : 'transactions'} · newest first</div></article>`;
}

function analyticsView() {
  const monthItems = selectedTransactions();
  const total = expenseTotal(monthItems);
  const data = CATEGORIES.filter(category => category !== 'Salary')
    .map(category => ({ category, total: sum(monthItems.filter(item => item.category === category && item.type !== 'income')) }))
    .filter(item => item.total);
  const selectedMonthDate = monthDate(selectedMonth);
  const daysInMonth = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0).getDate();
  const daysElapsed = selectedMonth === localDateValue().slice(0, 7) ? today.getDate() : daysInMonth;
  const chartColors = data.map(item => CATEGORY_COLORS[item.category]);
  const conic = data.length ? (() => {
    let start = 0;
    const slices = data.map((item, index) => {
      const end = start + (item.total / total) * 100;
      const part = `${chartColors[index]} ${start}% ${end}%`;
      start = end;
      return part;
    });
    return `conic-gradient(${slices.join(',')})`;
  })() : '#eef0ea';
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = monthDate(selectedMonth);
    date.setMonth(date.getMonth() - (5 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date), total: expenseTotal(transactions.filter(item => item.date.startsWith(key))) };
  });
  const highest = data.slice().sort((a, b) => b.total - a.total)[0];
  return `<div class="view-heading"><div><div class="eyebrow">Patterns, not pressure</div><h1>Your spending story.</h1><p class="subtitle">A few useful patterns from ${monthName()} and the months around it.</p></div></div>
    <div class="stat-grid"><article class="stat-card"><div class="stat-head"><span>Total this month</span><span class="stat-mark">${icon('trend')}</span></div><div class="stat-value">${money(total)}</div><div class="stat-meta">${monthItems.filter(item => item.type !== 'income').length} recorded expenses</div></article><article class="stat-card"><div class="stat-head"><span>Daily average</span><span class="stat-mark coral">${icon('calendar')}</span></div><div class="stat-value">${money(total / Math.max(daysElapsed, 1))}</div><div class="stat-meta">Based on ${daysElapsed} days</div></article><article class="stat-card"><div class="stat-head"><span>Most-spent category</span><span class="stat-mark lilac">${icon('analytics')}</span></div><div class="stat-value" style="font-size:18px">${highest?.category || '—'}</div><div class="stat-meta">${highest ? money(highest.total) : 'No entries yet'}</div></article></div>
    <div class="analytics-grid">
      <article class="panel"><div class="panel-header"><div><h2>Category mix</h2><div class="panel-sub">What made up this month's spending</div></div></div><div class="donut-row"><div class="donut" style="background:${conic}" role="img" aria-label="Category spending breakdown"><div class="donut-center"><small>TOTAL SPENT</small><strong>${money(total, true)}</strong></div></div><div class="analytics-legend">${data.length ? `<div class="category-list">${data.sort((a,b)=>b.total-a.total).map(item => `<div class="category-item"><span class="category-dot" style="background:${CATEGORY_COLORS[item.category]}"></span><span class="category-name">${item.category}</span><span class="category-amount">${Math.round(item.total / total * 100)}%</span></div>`).join('')}</div>` : '<div class="empty-state">Add expenses to see your category mix.</div>'}</div></div></article>
      <article class="panel"><div class="panel-header"><div><h2>Month to month</h2><div class="panel-sub">Six-month spending rhythm</div></div></div><div class="monthly-chart"><canvas id="analytics-chart" aria-label="Monthly spending chart" role="img"></canvas></div></article>
    </div>
    <article class="panel" style="margin-top:17px"><div class="panel-header"><div><h2>A note on your budget</h2><div class="panel-sub">A guide, not a grade</div></div></div><p style="font-size:13px;line-height:1.7;color:#768279;margin:0">${total <= monthlyBudget ? `You’ve used <strong style="color:var(--ink)">${Math.round(total / monthlyBudget * 100)}%</strong> of your ${money(monthlyBudget)} monthly budget. ${monthlyBudget - total > 0 ? `${money(monthlyBudget - total)} remains for the rest of the month.` : 'You’re right on the edge of your plan.'}` : `Spending is ${money(total - monthlyBudget)} above your ${money(monthlyBudget)} monthly guide. A quick look through your categories might help you decide what to adjust next month.`}</p></article>`;
}

function settingsView() {
  return `<div class="view-heading"><div><div class="eyebrow">Make it yours</div><h1>Settings</h1><p class="subtitle">A few simple choices to make Daybook feel right for you.</p></div></div>
    <div class="settings-layout"><section class="settings-card"><h2>Your monthly budget</h2><p>Set a gentle spending guide for the month. You can change this whenever life changes.</p><form id="budget-form"><label class="field-label" for="budget-input">Monthly spending guide (INR)</label><input class="field-input" type="number" id="budget-input" value="${monthlyBudget}" min="1" step="any" required data-testid="input-budget"><div class="field-help">Your progress resets visually each month; your transaction history stays here.</div><button class="button button-primary" type="submit" data-testid="button-save-budget">Save budget</button><div class="form-error" id="budget-error" role="alert"></div></form>
      <hr class="setting-divider"><h2>Your data</h2><p>Your transactions stay in this browser. Download a copy anytime, or clear the slate if you need to.</p><div class="setting-actions"><button class="button button-light" id="export-csv" data-testid="button-export-csv">Download CSV</button><button class="button button-danger" id="reset-data" data-testid="button-reset-data">Reset all data</button></div></section>
    <aside class="settings-note"><strong>Private by nature</strong><p>Your spending details are saved only in this browser using local storage. Nothing is sent to a server.</p><p>Export a CSV backup before resetting if you'd like to keep a copy.</p></aside></div>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function render() {
  const view = { dashboard: dashboardView, transactions: transactionsView, analytics: analyticsView, settings: settingsView }[currentView]();
  app.innerHTML = shell(view);
  attachEvents();
  renderCharts();
}

function chartDefaults() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f4439', padding: 10, displayColors: false, callbacks: { label: context => ` ${money(context.raw)}` } } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#9ba59d', font: { family: 'DM Sans', size: 10 } } },
      y: { beginAtZero: true, border: { display: false, dash: [3, 5] }, grid: { color: '#edf0e9' }, ticks: { color: '#a3aba4', font: { family: 'DM Sans', size: 9 }, callback: value => value >= 1000 ? `₹${value / 1000}k` : `₹${value}`, maxTicksLimit: 5 } }
    }
  };
}

function renderCharts() {
  if (typeof Chart !== 'function') {
    document.querySelectorAll('.chart-wrap, .monthly-chart').forEach(container => {
      container.innerHTML = '<div class="empty-state chart-unavailable" role="status">Charts need an internet connection to load.</div>';
    });
    return;
  }
  const chartCanvas = document.getElementById('spending-chart');
  if (chartCanvas) {
    spendingChart?.destroy();
    const days = new Date(monthDate(selectedMonth).getFullYear(), monthDate(selectedMonth).getMonth() + 1, 0).getDate();
    const dailyTotals = Array.from({ length: days }, (_, index) => expenseTotal(selectedTransactions().filter(item => Number(item.date.slice(-2)) === index + 1)));
    const labels = Array.from({ length: days }, (_, index) => (index + 1) % 5 === 0 || index === 0 ? String(index + 1) : '');
    spendingChart = new Chart(chartCanvas, {
      type: 'bar',
      data: { labels, datasets: [{ data: dailyTotals, backgroundColor: dailyTotals.map((_, index) => index + 1 === today.getDate() && selectedMonth === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}` ? '#1f5648' : '#d8e8d7'), borderRadius: 5, borderSkipped: false, maxBarThickness: 19 }] },
      options: { ...chartDefaults(), scales: { ...chartDefaults().scales, x: { ...chartDefaults().scales.x, ticks: { ...chartDefaults().scales.x.ticks, autoSkip: false, maxRotation: 0 } } } }
    });
  }
  const analyticsCanvas = document.getElementById('analytics-chart');
  if (analyticsCanvas) {
    analyticsChart?.destroy();
    const chartMonth = monthDate(selectedMonth);
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(chartMonth.getFullYear(), chartMonth.getMonth() - 5 + index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return { label: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date), total: expenseTotal(transactions.filter(item => item.date.startsWith(key))) };
    });
    analyticsChart = new Chart(analyticsCanvas, {
      type: 'bar',
      data: { labels: months.map(item => item.label), datasets: [{ data: months.map(item => item.total), backgroundColor: months.map((item, index) => index === months.length - 1 ? '#1f5648' : '#dce8d8'), borderRadius: 6, borderSkipped: false, maxBarThickness: 32 }] },
      options: { ...chartDefaults(), scales: { ...chartDefaults().scales, x: { ...chartDefaults().scales.x, grid: { display: false } } } }
    });
  }
}

function attachEvents() {
  app.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    currentView = button.dataset.view;
    searchTerm = '';
    categoryFilter = 'all';
    render();
  }));
  app.querySelectorAll('#add-expense, #top-add, [data-action="add"]').forEach(button => button.addEventListener('click', () => openExpenseModal()));
  app.querySelectorAll('[data-action="edit"]').forEach(button => button.addEventListener('click', () => openExpenseModal(button.dataset.id)));
  app.querySelectorAll('[data-action="delete"]').forEach(button => button.addEventListener('click', () => deleteTransaction(button.dataset.id)));
  const monthPicker = app.querySelector('#month-picker');
  monthPicker?.addEventListener('change', event => { selectedMonth = event.target.value || selectedMonth; render(); });
  const search = app.querySelector('#transaction-search');
  search?.addEventListener('input', event => {
    searchTerm = event.target.value;
    const filtered = app.querySelector('#filtered-transactions');
    const items = selectedTransactions().filter(item => `${item.title} ${item.note || ''} ${item.category}`.toLowerCase().includes(searchTerm.toLowerCase()) && (categoryFilter === 'all' || item.category === categoryFilter));
    filtered.innerHTML = renderRows(items);
    attachRowEvents();
    const count = app.querySelector('.panel-sub[style*="margin-top"]');
    if (count) count.textContent = `${items.length} ${items.length === 1 ? 'transaction' : 'transactions'} · newest first`;
  });
  app.querySelector('#category-filter')?.addEventListener('change', event => {
    categoryFilter = event.target.value;
    const filtered = app.querySelector('#filtered-transactions');
    const items = selectedTransactions().filter(item => `${item.title} ${item.note || ''} ${item.category}`.toLowerCase().includes(searchTerm.toLowerCase()) && (categoryFilter === 'all' || item.category === categoryFilter));
    filtered.innerHTML = renderRows(items);
    attachRowEvents();
  });
  app.querySelector('#budget-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const input = app.querySelector('#budget-input');
    const value = Number(input.value);
    const error = app.querySelector('#budget-error');
    if (!Number.isFinite(value) || value <= 0) { error.textContent = 'Enter a budget greater than zero.'; input.focus(); return; }
    monthlyBudget = value;
    localStorage.setItem(BUDGET_KEY, String(monthlyBudget));
    render();
    showToast('Your monthly guide is updated.');
  });
  app.querySelector('#export-csv')?.addEventListener('click', exportCsv);
  app.querySelector('#reset-data')?.addEventListener('click', resetData);
  const backdrop = app.querySelector('#modal-backdrop');
  backdrop?.addEventListener('click', event => { if (event.target === backdrop) closeModal(); });
}

function attachRowEvents() {
  app.querySelectorAll('[data-action="edit"]').forEach(button => button.addEventListener('click', () => openExpenseModal(button.dataset.id)));
  app.querySelectorAll('[data-action="delete"]').forEach(button => button.addEventListener('click', () => deleteTransaction(button.dataset.id)));
  app.querySelectorAll('[data-action="add"]').forEach(button => button.addEventListener('click', () => openExpenseModal()));
}

function openExpenseModal(id = null) {
  editingId = id;
  const item = id ? transactions.find(transaction => transaction.id === id) : null;
  const backdrop = app.querySelector('#modal-backdrop');
  backdrop.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-header"><div><h2 id="modal-title">${item ? 'Edit transaction' : 'Add a transaction'}</h2><p>Just the details you’ll want to remember.</p></div><button type="button" class="close-modal" aria-label="Close dialog" data-testid="button-close-modal">×</button></div>
    <form id="expense-form" novalidate><div class="form-grid">
      <div class="form-field full"><label for="expense-title">What was it for?</label><input id="expense-title" name="title" type="text" maxlength="70" placeholder="e.g. Lunch with friends" value="${escapeHtml(item?.title || '')}" required data-testid="input-expense-title"><div class="form-error" data-error="title"></div></div>
      <div class="form-field"><label for="expense-amount">Amount (₹)</label><input id="expense-amount" name="amount" type="number" min="0.01" step="any" placeholder="0.00" value="${item ? item.amount : ''}" required data-testid="input-expense-amount"><div class="form-error" data-error="amount"></div></div>
      <div class="form-field"><label for="expense-date">Date</label><input id="expense-date" name="date" type="date" value="${item?.date || localDateValue()}" required data-testid="input-expense-date"><div class="form-error" data-error="date"></div></div>
      <div class="form-field"><label for="expense-type">Transaction type</label><select id="expense-type" name="type" required data-testid="select-expense-type"><option value="expense" ${item?.type !== 'income' ? 'selected' : ''}>Expense</option><option value="income" ${item?.type === 'income' ? 'selected' : ''}>Income</option></select><div class="form-error" data-error="type"></div></div>
      <div class="form-field"><label for="expense-category">Category</label><select id="expense-category" name="category" required data-testid="select-expense-category">${CATEGORIES.map(category => `<option value="${category}" ${item?.category === category ? 'selected' : ''}>${category}</option>`).join('')}</select><div class="form-error" data-error="category"></div></div>
      <div class="form-field"><label for="expense-note">Note <span style="font-weight:400;color:#9aa39a">(optional)</span></label><input id="expense-note" name="note" type="text" maxlength="80" placeholder="A little extra context" value="${escapeHtml(item?.note || '')}" data-testid="input-expense-note"><div class="form-error" data-error="note"></div></div>
    </div><div class="modal-actions"><button type="button" class="button button-text" data-action="cancel-modal">Cancel</button><button type="submit" class="button button-primary" data-testid="button-save-expense">${item ? 'Save changes' : 'Save transaction'}</button></div></form></section>`;
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  backdrop.querySelector('.close-modal').addEventListener('click', closeModal);
  backdrop.querySelector('[data-action="cancel-modal"]').addEventListener('click', closeModal);
  backdrop.querySelector('#expense-form').addEventListener('submit', saveExpense);
  backdrop.querySelector('#expense-title').focus();
}

function closeModal() {
  const backdrop = app.querySelector('#modal-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.innerHTML = '';
}

function saveExpense(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const values = {
    title: String(data.get('title') || '').trim(),
    amount: Number(data.get('amount')),
    date: String(data.get('date') || ''),
    type: String(data.get('type') || ''),
    category: String(data.get('category') || ''),
    note: String(data.get('note') || '').trim()
  };
  const errors = {
    title: values.title ? '' : 'Add a short description.',
    amount: Number.isFinite(values.amount) && values.amount > 0 ? '' : 'Enter an amount greater than zero.',
    date: isValidDateValue(values.date) ? '' : 'Choose a valid date.',
    type: ['income', 'expense'].includes(values.type) ? '' : 'Choose income or expense.',
    category: CATEGORIES.includes(values.category) ? '' : 'Choose a category.'
  };
  Object.entries(errors).forEach(([field, message]) => {
    const error = form.querySelector(`[data-error="${field}"]`);
    if (error) error.textContent = message;
  });
  const firstInvalid = Object.keys(errors).find(field => errors[field]);
  if (firstInvalid) {
    form.querySelector(`[name="${firstInvalid}"]`)?.focus();
    return;
  }
  const toastMessage = editingId ? 'Transaction updated.' : 'Transaction added.';
  if (editingId) {
    saveTransactions(transactions.map(item => item.id === editingId ? { ...item, ...values } : item));
  } else {
    saveTransactions([{ id: crypto.randomUUID(), ...values }, ...transactions]);
  }
  closeModal();
  render();
  showToast(toastMessage);
}

function deleteTransaction(id) {
  const item = transactions.find(transaction => transaction.id === id);
  if (!item || !window.confirm(`Delete “${item.title}” from your transactions?`)) return;
  saveTransactions(transactions.filter(transaction => transaction.id !== id));
  render();
  showToast('Transaction removed.');
}

function exportCsv() {
  const allTransactions = transactions.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const rows = [['Date', 'Description', 'Type', 'Category', 'Amount (INR)', 'Note'], ...allTransactions.map(item => [item.date, item.title, item.type === 'income' ? 'Income' : 'Expense', item.category, item.amount, item.note || ''])];
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'daybook-transactions.csv';
  anchor.click();
  URL.revokeObjectURL(url);
  showToast('Transaction history downloaded as CSV.');
}

function resetData() {
  if (!window.confirm('Reset all transactions and your budget? This cannot be undone.')) return;
  transactions = [];
  monthlyBudget = 30000;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  localStorage.setItem(BUDGET_KEY, String(monthlyBudget));
  render();
  showToast('Your daybook is clear and ready.');
}

function showToast(message) {
  const toast = app.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

render();