// Expense & Budget Visualizer

// ─────────────────────────────────────────────
// Module-level error flag set by StorageManager
// on any read failure (parse error, SecurityError, etc.)
// ─────────────────────────────────────────────
let lastReadError = null;

// ─────────────────────────────────────────────
// StorageManager
// Responsible for all localStorage CRUD operations.
// Keys:
//   ebv_transactions — JSON array of Transaction objects
//   ebv_categories   — JSON array of category name strings
// ─────────────────────────────────────────────
const StorageManager = {
  /**
   * Load transactions from localStorage.
   * @returns {Transaction[]} Parsed array, or [] on any failure.
   */
  loadTransactions() {
    try {
      const raw = localStorage.getItem('ebv_transactions');
      if (raw === null) return [];
      return JSON.parse(raw);
    } catch (err) {
      lastReadError = err;
      return [];
    }
  },

  /**
   * Persist the transactions array to localStorage.
   * @param {Transaction[]} transactions
   * @returns {{ ok: boolean, error?: Error }}
   */
  saveTransactions(transactions) {
    try {
      localStorage.setItem('ebv_transactions', JSON.stringify(transactions));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err };
    }
  },

  /**
   * Load custom category names from localStorage.
   * @returns {string[]} Parsed array, or [] on any failure.
   */
  loadCategories() {
    try {
      const raw = localStorage.getItem('ebv_categories');
      if (raw === null) return [];
      return JSON.parse(raw);
    } catch (err) {
      lastReadError = err;
      return [];
    }
  },

  /**
   * Persist the custom categories array to localStorage.
   * @param {string[]} categories
   * @returns {{ ok: boolean, error?: Error }}
   */
  saveCategories(categories) {
    try {
      localStorage.setItem('ebv_categories', JSON.stringify(categories));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err };
    }
  },
};

// ─────────────────────────────────────────────
// Validator
// Validates Input_Form fields and Custom_Category names
// before any data is persisted.
// ─────────────────────────────────────────────
const Validator = {
  /**
   * Validate a transaction form submission.
   *
   * Rules:
   *   name     — must be non-empty after trimming whitespace
   *   amount   — must be numeric, > 0, and ≤ 999,999,999.99
   *   category — must be a non-empty string
   *
   * @param {{ name: string, amount: string, category: string }} fields
   * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
   */
  validateTransaction({ name, amount, category }) {
    const errors = {};

    // ── name ──────────────────────────────────
    if (typeof name !== 'string' || name.trim().length === 0) {
      errors.name = 'Item name is required.';
    }

    // ── amount ────────────────────────────────
    // Convert to number; reject empty string, non-numeric, NaN, ≤ 0, > max
    const MAX_AMOUNT = 999_999_999.99;
    const numericAmount = Number(amount);

    if (
      amount === '' ||
      amount === null ||
      amount === undefined ||
      typeof amount === 'boolean' ||
      isNaN(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > MAX_AMOUNT
    ) {
      errors.amount = `Amount must be a number between 0.01 and ${MAX_AMOUNT.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`;
    }

    // ── category ──────────────────────────────
    if (typeof category !== 'string' || category.trim().length === 0) {
      errors.category = 'Please select a category.';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  },

  /**
   * Validate a custom category name.
   *
   * Rules:
   *   - Must not be empty (length 0 after trimming is still empty for display,
   *     but the raw length check catches the zero-length case)
   *   - Must not exceed 50 characters
   *   - Must not be a case-insensitive duplicate of any existing category
   *
   * @param {string} name
   * @param {string[]} existingCategories  — full list (defaults + custom)
   * @returns {{ valid: boolean, error?: string }}
   */
  validateCategory(name, existingCategories) {
    if (typeof name !== 'string' || name.length === 0) {
      return { valid: false, error: 'Category name is required.' };
    }

    if (name.length > 50) {
      return { valid: false, error: 'Category name must be 50 characters or fewer.' };
    }

    const lowerName = name.toLowerCase();
    const isDuplicate = existingCategories.some(
      (cat) => cat.toLowerCase() === lowerName
    );

    if (isDuplicate) {
      return { valid: false, error: 'A category with that name already exists.' };
    }

    return { valid: true };
  },
};

// ─────────────────────────────────────────────
// CategoryManager
// Manages the full list of categories (defaults + custom).
// Default categories are always present and cannot be removed.
// Custom categories are limited to MAX_CUSTOM entries.
// ─────────────────────────────────────────────
const CategoryManager = {
  /** Built-in categories that are always available. */
  DEFAULT_CATEGORIES: ['Food', 'Transport', 'Fun'],

  /** Maximum number of user-defined custom categories allowed. */
  MAX_CUSTOM: 50,

  /**
   * Return the combined list of default and custom categories.
   * @param {string[]} customCategories
   * @returns {string[]}
   */
  getAll(customCategories) {
    return [...this.DEFAULT_CATEGORIES, ...customCategories];
  },

  /**
   * Return true if the user can still add more custom categories.
   * @param {string[]} customCategories
   * @returns {boolean}
   */
  canAddMore(customCategories) {
    return customCategories.length < this.MAX_CUSTOM;
  },
};

// ─────────────────────────────────────────────
// SortFilter
// Pure utility for sorting and month-filtering
// transaction arrays without mutating the input.
// ─────────────────────────────────────────────
const SortFilter = {
  /**
   * Return a new sorted array of transactions.
   * The input array is never mutated.
   *
   * Sort keys:
   *   'newest'       — descending by timestamp (default)
   *   'amount-asc'   — ascending  by amount; tiebreaker = descending timestamp
   *   'amount-desc'  — descending by amount; tiebreaker = descending timestamp
   *   'category-az'  — A → Z by category; tiebreaker = descending timestamp
   *   'category-za'  — Z → A by category; tiebreaker = descending timestamp
   *
   * @param {Transaction[]} transactions
   * @param {string} sortKey
   * @returns {Transaction[]}  new sorted array
   */
  sort(transactions, sortKey) {
    // Always work on a shallow copy so we never mutate the caller's array.
    const copy = [...transactions];

    /**
     * Tiebreaker: descending by timestamp (newer first).
     * @param {Transaction} a
     * @param {Transaction} b
     * @returns {number}
     */
    const byTimestampDesc = (a, b) =>
      a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0;

    switch (sortKey) {
      case 'amount-asc':
        copy.sort((a, b) => {
          if (a.amount !== b.amount) return a.amount - b.amount;
          return byTimestampDesc(a, b);
        });
        break;

      case 'amount-desc':
        copy.sort((a, b) => {
          if (a.amount !== b.amount) return b.amount - a.amount;
          return byTimestampDesc(a, b);
        });
        break;

      case 'category-az':
        copy.sort((a, b) => {
          const cmp = a.category.localeCompare(b.category);
          if (cmp !== 0) return cmp;
          return byTimestampDesc(a, b);
        });
        break;

      case 'category-za':
        copy.sort((a, b) => {
          const cmp = b.category.localeCompare(a.category);
          if (cmp !== 0) return cmp;
          return byTimestampDesc(a, b);
        });
        break;

      case 'newest':
      default:
        copy.sort(byTimestampDesc);
        break;
    }

    return copy;
  },

  /**
   * Return a new array containing only the transactions that belong to
   * the given month.  If monthKey is null (or falsy), all transactions
   * are returned unchanged.
   *
   * @param {Transaction[]} transactions
   * @param {string|null}   monthKey  'YYYY-MM' or null
   * @returns {Transaction[]}  new filtered array
   */
  filter(transactions, monthKey) {
    if (!monthKey) return [...transactions];
    return transactions.filter((t) => t.timestamp.startsWith(monthKey));
  },
};

// ─────────────────────────────────────────────
// AppState
// Single source of truth for all in-memory application data.
// All render functions read from this object; they never
// reach directly into localStorage.
// ─────────────────────────────────────────────
const AppState = {
  /** @type {Transaction[]} All loaded/active transactions. */
  transactions: [],

  /** @type {string[]} User-defined custom category names. */
  customCategories: [],

  /**
   * Currently active sort key.
   * One of: 'newest' | 'amount-asc' | 'amount-desc' | 'category-az' | 'category-za'
   * @type {string}
   */
  activeSort: 'newest',

  /**
   * Month filter in 'YYYY-MM' format, or null when no filter is active
   * (all transactions are shown).
   * @type {string|null}
   */
  activeFilter: null,
};

// ─────────────────────────────────────────────
// generateId
// Produces a UUID v4 string.
// Uses the native crypto.randomUUID() when available and falls back
// to a timestamp + Math.random() composite for older browsers.
// ─────────────────────────────────────────────
function generateId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  // Fallback: timestamp hex + random hex segments shaped like a UUID v4.
  const timePart = Date.now().toString(16).padStart(12, '0');
  const rand = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');

  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const p1 = timePart.slice(0, 8);
  const p2 = timePart.slice(8, 12);
  const p3 = '4' + rand().slice(1);          // version 4
  const p4 = ((parseInt(rand(), 16) & 0x3fff) | 0x8000)  // variant bits
    .toString(16)
    .padStart(4, '0');
  const p5 = rand() + rand() + rand().slice(0, 4);

  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

// ─────────────────────────────────────────────
// formatCurrency
// Formats a numeric amount as a USD currency string,
// e.g. 1234.5 → "$1,234.50".
// Uses Intl.NumberFormat for locale-appropriate separators.
// ─────────────────────────────────────────────
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─────────────────────────────────────────────
// formatDate
// Extracts the YYYY-MM-DD date portion from an ISO 8601 string,
// e.g. "2025-07-18T06:30:00.000Z" → "2025-07-18".
// ─────────────────────────────────────────────
function formatDate(isoString) {
  return isoString.slice(0, 10);
}

// ─────────────────────────────────────────────
// sumAmounts
// Returns the arithmetic sum of all `amount` fields in a
// transaction array.  Returns 0 for an empty array.
// Used by Balance_Display and Monthly_Summary.
// ─────────────────────────────────────────────
function sumAmounts(transactions) {
  return transactions.reduce((total, t) => total + t.amount, 0);
}

// ─────────────────────────────────────────────
// renderCategoryDropdown
// Clears #item-category and re-populates it with all available
// categories (defaults + custom).  A disabled placeholder option
// is prepended so no category is pre-selected on a fresh form.
// ─────────────────────────────────────────────
function renderCategoryDropdown(customCategories) {
  const select = document.getElementById('item-category');
  if (!select) return;

  // Clear all existing options.
  select.innerHTML = '';

  // Placeholder option — not a valid selection.
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a category';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  // Populate with all categories (defaults first, then custom).
  const allCategories = CategoryManager.getAll(customCategories);
  allCategories.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
}

// ─────────────────────────────────────────────
// showFormErrors
// Displays inline validation error messages for the transaction
// input form.  Accepts an errors object whose keys match field
// names ('name', 'amount', 'category') and whose values are the
// human-readable error strings.
// ─────────────────────────────────────────────
function showFormErrors(errors) {
  const fieldIds = ['name', 'amount', 'category'];

  fieldIds.forEach((field) => {
    const span = document.getElementById(`item-${field}-error`);
    if (!span) return;

    if (errors[field]) {
      span.textContent = errors[field];
      span.removeAttribute('hidden');
    }
  });
}

// ─────────────────────────────────────────────
// clearFormErrors
// Hides all inline validation error spans on the transaction
// input form and clears their text content.
// ─────────────────────────────────────────────
function clearFormErrors() {
  const fieldIds = ['name', 'amount', 'category'];

  fieldIds.forEach((field) => {
    const span = document.getElementById(`item-${field}-error`);
    if (!span) return;
    span.textContent = '';
    span.setAttribute('hidden', '');
  });
}


// ─────────────────────────────────────────────
// showErrorBanner
// Inserts (or replaces) a dismissible error banner at the top of
// <main>.  Uses role="alert" so screen readers announce it.
// The close button removes the banner from the DOM entirely.
// ─────────────────────────────────────────────
function showErrorBanner(message) {
  // Remove any existing banner so we never stack multiples.
  const existing = document.querySelector('.error-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.setAttribute('role', 'alert');
  banner.className = 'error-banner';

  const text = document.createElement('span');
  text.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'error-banner-close';
  closeBtn.setAttribute('aria-label', 'Dismiss error');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => banner.remove());

  banner.appendChild(text);
  banner.appendChild(closeBtn);

  // Prepend inside <main> if present, otherwise fall back to <body>.
  const container = document.querySelector('main') || document.body;
  container.insertBefore(banner, container.firstChild);
}

// ─────────────────────────────────────────────
// renderBalance
// Reads all transactions from AppState, sums their amounts,
// and writes the formatted currency string to #balance-total.
// Called on init and after every add/delete operation.
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
// ─────────────────────────────────────────────
function renderBalance() {
  const el = document.getElementById('balance-total');
  if (!el) return;
  const total = sumAmounts(AppState.transactions);
  el.textContent = formatCurrency(total);
}

// ─────────────────────────────────────────────
// renderSummary
// Filters AppState.transactions by AppState.activeFilter (YYYY-MM),
// sums their amounts, and writes the formatted currency string to
// #summary-total.  When no transactions exist in the selected period
// the span shows a "no transactions" message instead.
// Requirements: 8.2, 8.3, 8.6
// ─────────────────────────────────────────────
function renderSummary() {
  const el = document.getElementById('summary-total');
  if (!el) return;

  const filtered = SortFilter.filter(AppState.transactions, AppState.activeFilter);

  if (AppState.activeFilter !== null && filtered.length === 0) {
    el.textContent = 'No transactions found for this period';
  } else {
    el.textContent = formatCurrency(sumAmounts(filtered));
  }
}

// ─────────────────────────────────────────────
// Chart color palette
// A fixed array of hex colors that cycles when there are more categories
// than palette entries.
// ─────────────────────────────────────────────
const CHART_COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
  '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
  '#9c755f', '#bab0ac',
];

/**
 * Module-level Chart.js instance.
 * Created on first render; reused on subsequent renders via chart.update().
 * @type {Chart|null}
 */
let chartInstance = null;

// ─────────────────────────────────────────────
// computeCategoryPercentages
// Groups transaction amounts by category and returns an array of objects
// with the category name, total amount, and percentage share of the grand
// total (rounded to one decimal place).
//
// @param {Transaction[]} transactions
// @returns {{ category: string, total: number, percentage: number }[]}
// ─────────────────────────────────────────────
function computeCategoryPercentages(transactions) {
  if (transactions.length === 0) return [];

  // Group totals by category name.
  const totalsMap = {};
  transactions.forEach((t) => {
    totalsMap[t.category] = (totalsMap[t.category] || 0) + t.amount;
  });

  const grandTotal = Object.values(totalsMap).reduce((sum, v) => sum + v, 0);

  return Object.entries(totalsMap).map(([category, total]) => ({
    category,
    total,
    percentage: Math.round((total / grandTotal) * 1000) / 10, // one decimal
  }));
}

// ─────────────────────────────────────────────
// renderChart
// Renders (or updates) the Chart.js pie chart using the current AppState,
// filtered by the active month filter.
//
// States:
//   • Chart.js unavailable — shows a fallback message, hides the canvas.
//   • No transactions       — hides canvas, shows #chart-empty, clears legend.
//   • Has transactions      — shows canvas, hides #chart-empty,
//                             creates/updates the Chart.js Pie instance,
//                             renders an HTML legend in #chart-legend.
//
// Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
// ─────────────────────────────────────────────
function renderChart() {
  const canvas    = document.getElementById('expense-chart');
  const emptyMsg  = document.getElementById('chart-empty');
  const legendDiv = document.getElementById('chart-legend');

  if (!canvas || !emptyMsg || !legendDiv) return;

  // ── Chart.js load-failure detection ───────────────────────────────────
  if (typeof window.Chart === 'undefined') {
    canvas.setAttribute('hidden', '');
    emptyMsg.textContent = 'Chart unavailable — could not load charting library.';
    emptyMsg.removeAttribute('hidden');
    legendDiv.innerHTML = '';
    return;
  }

  // ── Apply active month filter ──────────────────────────────────────────
  const filtered = SortFilter.filter(AppState.transactions, AppState.activeFilter);

  // ── Empty state ────────────────────────────────────────────────────────
  if (filtered.length === 0) {
    canvas.setAttribute('hidden', '');
    emptyMsg.textContent = 'No data to display';
    emptyMsg.removeAttribute('hidden');
    legendDiv.innerHTML = '';
    return;
  }

  // ── Has data — show canvas, hide empty message ─────────────────────────
  canvas.removeAttribute('hidden');
  emptyMsg.setAttribute('hidden', '');

  const data = computeCategoryPercentages(filtered);

  const labels     = data.map((d) => d.category);
  const values     = data.map((d) => d.percentage);
  const colors     = data.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
  const borderColors = colors.map((c) => c);

  // ── Create or update Chart.js instance ────────────────────────────────
  if (chartInstance === null) {
    chartInstance = new window.Chart(canvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data:            values,
          backgroundColor: colors,
          borderColor:     borderColors,
          borderWidth:     1,
        }],
      },
      options: {
        plugins: {
          legend: { display: false }, // we render our own HTML legend
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const item = data[ctx.dataIndex];
                return ` ${item.category}: ${item.percentage}% (${formatCurrency(item.total)})`;
              },
            },
          },
        },
        responsive: true,
        maintainAspectRatio: true,
      },
    });
  } else {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data            = values;
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.data.datasets[0].borderColor     = borderColors;
    chartInstance.update();
  }

  // ── Render HTML legend ─────────────────────────────────────────────────
  legendDiv.innerHTML = '';
  data.forEach((item, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];

    const entry = document.createElement('div');
    entry.className = 'legend-item';

    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.backgroundColor = color;
    swatch.setAttribute('aria-hidden', 'true');

    const name = document.createElement('span');
    name.className = 'legend-name';
    name.textContent = item.category;

    const amount = document.createElement('span');
    amount.className = 'legend-amount';
    amount.textContent = formatCurrency(item.total);

    entry.appendChild(swatch);
    entry.appendChild(name);
    entry.appendChild(amount);
    legendDiv.appendChild(entry);
  });
}

// ─────────────────────────────────────────────
// renderTransactionList
// Reads AppState.transactions, applies the active sort and
// month filter, then re-renders the #transaction-list <ul>.
//
// Each item renders:
//   item name | formatted amount | category badge | date | delete button
//
// When the filtered list is empty an empty-state <li> is shown.
// Requirements: 4.1, 4.2, 4.3, 4.6
// ─────────────────────────────────────────────
function renderTransactionList() {
  const list = document.getElementById('transaction-list');
  if (!list) return;

  // Apply filter first, then sort (filter is cheaper and shrinks the array).
  const filtered = SortFilter.filter(AppState.transactions, AppState.activeFilter);
  const sorted   = SortFilter.sort(filtered, AppState.activeSort);

  // Clear current contents.
  list.innerHTML = '';

  if (sorted.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'No transactions recorded yet.';
    list.appendChild(empty);
    return;
  }

  sorted.forEach((transaction) => {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.dataset.id = transaction.id;

    // Item name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'transaction-name';
    nameSpan.textContent = transaction.name;

    // Formatted amount
    const amountSpan = document.createElement('span');
    amountSpan.className = 'transaction-amount';
    amountSpan.textContent = formatCurrency(transaction.amount);

    // Category badge
    const categorySpan = document.createElement('span');
    categorySpan.className = 'transaction-category';
    categorySpan.textContent = transaction.category;

    // Date (YYYY-MM-DD)
    const dateSpan = document.createElement('span');
    dateSpan.className = 'transaction-date';
    dateSpan.textContent = formatDate(transaction.timestamp);

    // Delete button — aria-label includes the item name for screen readers
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.dataset.id = transaction.id;
    deleteBtn.setAttribute('aria-label', `Delete ${transaction.name}`);
    deleteBtn.textContent = 'Delete';

    li.appendChild(nameSpan);
    li.appendChild(amountSpan);
    li.appendChild(categorySpan);
    li.appendChild(dateSpan);
    li.appendChild(deleteBtn);

    list.appendChild(li);
  });
}

// ─────────────────────────────────────────────
// Delete transaction — delegated listener
// A single click listener on #transaction-list handles all
// delete buttons via event delegation (avoids attaching/removing
// individual listeners on every render).
//
// Flow:
//   1. Identify clicked .delete-btn and extract data-id
//   2. Build the updated transactions array (excluding the deleted item)
//   3. Persist via StorageManager
//   4a. On failure → show error banner, keep item in list (no state change)
//   4b. On success → update AppState, re-render List + Balance + Chart
//
// Requirements: 4.4, 4.5, 4.7
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function wireDeleteBtn() {
  const list = document.getElementById('transaction-list');
  if (!list) return;

  list.addEventListener('click', function handleDeleteClick(event) {
    // Only act when a .delete-btn was clicked (delegation guard).
    const btn = event.target.closest('.delete-btn');
    if (!btn) return;

    const targetId = btn.dataset.id;
    if (!targetId) return;

    // Build the updated array without the deleted transaction.
    const updated = AppState.transactions.filter((t) => t.id !== targetId);

    // Attempt to persist first; never mutate state before a successful save.
    const saveResult = StorageManager.saveTransactions(updated);

    if (!saveResult.ok) {
      showErrorBanner("Data could not be saved. Check your browser's storage settings.");
      return; // Keep the item in the list — do not mutate state.
    }

    // Persist succeeded — update in-memory state and re-render.
    AppState.transactions = updated;
    renderTransactionList();
    renderBalance();
    renderSummary();
    renderChart();
  });
});

// ─────────────────────────────────────────────
// Add-expense submit handler
// Wired to the #add-btn click event.
// Reads form fields → validates → persists → updates state → re-renders.
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function wireAddBtn() {
  const addBtn = document.getElementById('add-btn');
  if (!addBtn) return;

  addBtn.addEventListener('click', function handleAddExpense() {
    // ── 1. Read field values ───────────────────
    const name     = document.getElementById('item-name').value;
    const amount   = document.getElementById('item-amount').value;
    const category = document.getElementById('item-category').value;

    // ── 2. Clear previous errors ───────────────
    clearFormErrors();

    // ── 3. Validate ────────────────────────────
    const result = Validator.validateTransaction({ name, amount, category });

    if (!result.valid) {
      showFormErrors(result.errors);
      return;
    }

    // ── 4. Build transaction object ─────────────
    const transaction = {
      id:        generateId(),
      name:      name.trim(),
      amount:    parseFloat(amount),
      category,
      timestamp: new Date().toISOString(),
    };

    // ── 5. Persist ─────────────────────────────
    const updated    = [...AppState.transactions, transaction];
    const saveResult = StorageManager.saveTransactions(updated);

    if (!saveResult.ok) {
      showErrorBanner("Data could not be saved. Check your browser's storage settings.");
      return; // Preserve form fields — do NOT reset.
    }

    // ── 6. Update in-memory state ──────────────
    AppState.transactions = updated;

    // ── 7. Re-render affected components ───────
    renderBalance();
    renderTransactionList();
    renderSummary();
    renderChart();

    // ── 8. Reset form ──────────────────────────
    document.getElementById('item-name').value    = '';
    document.getElementById('item-amount').value  = '';
    document.getElementById('item-category').selectedIndex = 0;
    clearFormErrors();

    // ── 9. Return focus to the first field ─────
    document.getElementById('item-name').focus();
  });
});

// ─────────────────────────────────────────────
// Month-filter change handler
// Updates AppState.activeFilter when the user picks a month,
// then re-renders the list, summary, and chart.
// Requirements: 8.2, 8.3, 8.4
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function wireMonthFilter() {
  const monthInput = document.getElementById('month-filter');
  if (!monthInput) return;

  monthInput.addEventListener('change', function handleMonthChange() {
    AppState.activeFilter = monthInput.value || null;
    renderTransactionList();
    renderSummary();
    renderChart();
  });
});

// ─────────────────────────────────────────────
// Clear-filter click handler
// Resets AppState.activeFilter to null, clears the month input,
// and restores the full transaction list, summary, and chart.
// Requirements: 8.5
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function wireClearFilter() {
  const clearBtn = document.getElementById('clear-filter');
  if (!clearBtn) return;

  clearBtn.addEventListener('click', function handleClearFilter() {
    AppState.activeFilter = null;

    const monthInput = document.getElementById('month-filter');
    if (monthInput) monthInput.value = '';

    renderTransactionList();
    renderSummary();
    renderChart();
  });
});

// ─────────────────────────────────────────────
// updateSortActiveState
// Sets the data-active attribute on the currently selected <option>
// in #sort-control and removes it from all other options.
// Used by CSS via the [data-active] selector to visually distinguish
// the active sort choice.
// Requirements: 9.5
// ─────────────────────────────────────────────
function updateSortActiveState() {
  const select = document.getElementById('sort-control');
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    if (option.value === AppState.activeSort) {
      option.setAttribute('data-active', '');
    } else {
      option.removeAttribute('data-active');
    }
  });
}

// ─────────────────────────────────────────────
// Sort Control change handler
// Updates AppState.activeSort when the user selects a new sort option,
// re-renders the Transaction List, and refreshes the active state.
// Requirements: 9.1, 9.2, 9.3, 9.4
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function wireSortControl() {
  const sortSelect = document.getElementById('sort-control');
  if (!sortSelect) return;

  sortSelect.addEventListener('change', function handleSortChange() {
    AppState.activeSort = sortSelect.value;
    renderTransactionList();
    updateSortActiveState();
  });
});

// ─────────────────────────────────────────────
// isStructurallyValid
// Returns true when a transaction object has all five required
// fields with appropriate types/values.
// Used by initApp to silently discard corrupted records.
// ─────────────────────────────────────────────
function isStructurallyValid(t) {
  return (
    t !== null &&
    typeof t === 'object' &&
    typeof t.id        === 'string' && t.id.length > 0 &&
    typeof t.name      === 'string' && t.name.length > 0 &&
    typeof t.amount    === 'number' && t.amount > 0 &&
    typeof t.category  === 'string' && t.category.length > 0 &&
    typeof t.timestamp === 'string' && t.timestamp.length > 0
  );
}

// ─────────────────────────────────────────────
// initApp
// Entry point — runs once on DOMContentLoaded.
//
// Steps:
//   1. Feature-detect localStorage; show unsupported-browser banner and halt
//      if it is missing.
//   2. Feature-detect Intl.NumberFormat and crypto.randomUUID; install a
//      module-level fallback UUID generator if randomUUID is absent.
//   3. Load transactions and categories from localStorage; surface any
//      read error via a dismissible banner.
//   4. Validate each loaded transaction for required fields; silently
//      discard corrupt records and show a warning banner if any were dropped.
//   5. Populate AppState.
//   6. Set the month-filter default to the current calendar month.
//   7. Render all UI components before returning control to the user.
//
// Requirements: 1.3, 1.5, 2.2, 2.7
// ─────────────────────────────────────────────
function initApp() {
  // ── 1. Feature-detect localStorage ────────────────────────────────────
  const hasLocalStorage = (function () {
    try {
      return typeof window !== 'undefined' &&
             typeof window.localStorage !== 'undefined' &&
             window.localStorage !== null;
    } catch (_) {
      // SecurityError in some restricted contexts.
      return false;
    }
  })();

  if (!hasLocalStorage) {
    const banner = document.getElementById('unsupported-banner');
    if (banner) banner.removeAttribute('hidden');
    // Halt — do not attempt any further initialization.
    return;
  }

  // ── 2. Feature-detect Intl.NumberFormat and crypto.randomUUID ─────────
  //
  // Intl.NumberFormat: formatCurrency() already calls it; if it is absent
  // the app would crash on first render.  We note the absence but do not
  // halt — formatCurrency will degrade to a plain number string in very old
  // browsers.  (Modern browsers always have this.)
  //
  // crypto.randomUUID: generateId() already has a Math.random() fallback,
  // so no additional polyfill is needed here.  We confirm the detection
  // for logging/diagnostics only.
  if (typeof window.Intl === 'undefined' || typeof window.Intl.NumberFormat !== 'function') {
    // Non-fatal — formatCurrency will fall back to plain number formatting.
    console.warn('Intl.NumberFormat is unavailable; currency formatting may be degraded.');
  }

  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    // generateId() already contains a Math.random() fallback UUID generator,
    // so no additional polyfill is necessary.
    console.warn('crypto.randomUUID is unavailable; using fallback UUID generator.');
  }

  // ── 3. Load transactions from localStorage ─────────────────────────────
  lastReadError = null;
  const rawTransactions = StorageManager.loadTransactions();
  const transactionReadFailed = lastReadError !== null;

  lastReadError = null;
  const rawCategories = StorageManager.loadCategories();
  const categoryReadFailed = lastReadError !== null;
  lastReadError = null;

  if (transactionReadFailed || categoryReadFailed) {
    showErrorBanner(
      'Could not load saved data. Your browser may have storage disabled.'
    );
  }

  // ── 4. Structural validation — discard corrupt transaction records ──────
  const validTransactions   = [];
  const invalidTransactions = [];

  rawTransactions.forEach((t) => {
    if (isStructurallyValid(t)) {
      validTransactions.push(t);
    } else {
      invalidTransactions.push(t);
    }
  });

  if (invalidTransactions.length > 0) {
    showErrorBanner('Some records were skipped due to data corruption.');
  }

  // ── 5. Populate AppState ───────────────────────────────────────────────
  AppState.transactions     = validTransactions;
  AppState.customCategories = rawCategories;

  // ── 6. Set month-filter default to current YYYY-MM ────────────────────
  // Requirement 8.1 — defaults to current calendar month on load.
  const monthInput = document.getElementById('month-filter');
  if (monthInput) {
    const now  = new Date();
    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    monthInput.value      = `${yyyy}-${mm}`;
    AppState.activeFilter = `${yyyy}-${mm}`;
  }

  // ── 7. Render all UI components ────────────────────────────────────────
  renderCategoryDropdown(AppState.customCategories); // Requirement 3.6, 7.5
  renderTransactionList();  // Requirement 4.3 — populated before interaction
  renderBalance();          // Requirement 5.5 — balance visible before interaction
  renderChart();            // Requirement 6.3 — chart reflects persisted data
  renderSummary();          // Requirement 8.3 — monthly total for current month
  updateSortActiveState();  // Requirement 9.5 — mark default sort option as active
}

// Wire initApp to DOMContentLoaded — the single top-level entry point.
document.addEventListener('DOMContentLoaded', initApp);
