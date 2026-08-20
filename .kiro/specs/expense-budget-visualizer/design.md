# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a fully client-side, single-page web application implemented in plain HTML, CSS, and Vanilla JavaScript. It requires no build tools, no package manager, and no backend server. All data is persisted in the browser's `localStorage`. The app loads as a single `index.html` file that references one CSS file (`css/styles.css`) and one JS file (`js/app.js`), plus Chart.js loaded from a CDN.

The core user workflows are:

1. **Record an expense** — fill in name, amount, and category in the Input Form, then submit.
2. **Review history** — browse the scrollable Transaction List, sort by amount or category, and delete entries.
3. **Understand spending** — view the live-updating Balance Display and Category Pie Chart.
4. **Organize categories** — add or remove Custom Categories beyond the three defaults (Food, Transport, Fun).
5. **Analyze a month** — select a month/year to filter the Transaction List, summary total, and Chart to that period.

The design deliberately keeps all logic in a single JS file, avoiding modules or bundling. Responsibilities are separated through plain objects / factory functions acting as the Validator, Category_Manager, Storage_Manager, and UI renderer.

---

## Architecture

The app follows a **unidirectional data-flow** pattern without a framework:

```
User Interaction
       │
       ▼
  Event Handler  (js/app.js — DOM event listeners)
       │
       ▼
  Business Logic  (Validator, Category_Manager, sort/filter utils)
       │
       ▼
  Storage_Manager  (read/write localStorage)
       │
       ▼
  State Object  (in-memory array of transactions + categories)
       │
       ▼
  Render Functions  (re-draw Transaction_List, Balance, Chart, Monthly_Summary)
       │
       ▼
  DOM / Chart.js
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Single JS file (`js/app.js`) | Requirement 10.1 — no bundler; simplifies deployment. |
| In-memory state + full re-render | Keeps render logic stateless and predictable; 100 ms update targets are easily met for typical data volumes. |
| Chart.js via CDN | Requirement 6.6 — no install step. Chart instance is created once and updated via `chart.data = …; chart.update()`. |
| Factory functions instead of classes | Avoids `this`-binding issues in plain JS event handlers; functions close over their data naturally. |
| Currency formatting via `Intl.NumberFormat` | Handles locale-appropriate separators and symbols without a library. |
| Date handling via `Date` + ISO strings | Timestamps stored as ISO 8601 strings; month filtering compares `YYYY-MM` prefix. |

### Module Responsibilities

| Module (logical) | Location | Responsibility |
|---|---|---|
| `StorageManager` | `js/app.js` | CRUD on `localStorage` keys `ebv_transactions` and `ebv_categories` |
| `Validator` | `js/app.js` | Validate Input_Form and Custom_Category form fields |
| `CategoryManager` | `js/app.js` | Manage default + custom categories; enforce 50-item limit |
| `SortFilter` | `js/app.js` | Sort and month-filter transaction arrays (pure functions) |
| `Renderer` | `js/app.js` | Re-render Transaction_List, Balance_Display, Chart, Monthly_Summary |
| Event wiring | `js/app.js` (bottom) | Attach DOM event listeners; orchestrate calls to the above modules |

---

## Components and Interfaces

### HTML Structure (`index.html`)

```
<body>
  <header>          <!-- App title / Balance_Display -->
  <main>
    <section id="input-section">    <!-- Input_Form -->
    <section id="category-section"> <!-- Category_Manager UI -->
    <section id="chart-section">    <!-- Chart canvas + legend -->
    <section id="summary-section">  <!-- Monthly_Summary selector + totals -->
    <section id="list-section">     <!-- Sort_Control + Transaction_List -->
  </main>
</body>
```

### Input_Form

- `<input type="text" id="item-name" maxlength="100">`
- `<input type="number" id="item-amount" min="0.01" max="999999999.99" step="0.01">`
- `<select id="item-category">` — populated by `CategoryManager.getAll()`
- `<button type="submit" id="add-btn">Add Expense</button>`
- Inline error `<span>` elements adjacent to each field (hidden by default)

### Transaction_List

- `<ul id="transaction-list">` with one `<li>` per transaction
- Each `<li>` contains: item name, formatted amount, category badge, date string, and a `<button class="delete-btn" data-id="…">Delete</button>`
- Empty state: `<li class="empty-state">No transactions recorded yet.</li>` rendered when list is empty

### Balance_Display

- `<span id="balance-total">` inside the `<header>` — updated by `renderBalance()`

### Chart

- `<canvas id="expense-chart">` — Chart.js renders onto this element
- `<div id="chart-legend">` — custom HTML legend rendered alongside the canvas (Chart.js built-in legend can be used or replaced with a custom one for styling control)
- Empty state: a `<p id="chart-empty">No data to display</p>` shown when no transactions exist, with the canvas hidden

### Monthly_Summary

- `<input type="month" id="month-filter">` — defaults to current `YYYY-MM`
- `<button id="clear-filter">Show All</button>`
- `<span id="summary-total">` — displays filtered total

### Sort_Control

- `<select id="sort-control">` with options:
  - `newest` — default (most-recently-added first)
  - `amount-asc` — Amount: Low to High
  - `amount-desc` — Amount: High to Low
  - `category-az` — Category: A → Z
  - `category-za` — Category: Z → A
- Active option is visually distinguished via `:focus` and a custom `data-active` attribute used in CSS

### Category_Manager UI

- `<input type="text" id="custom-category-name" maxlength="50">`
- `<button id="add-category-btn">Add Category</button>`
- `<ul id="custom-category-list">` — lists existing custom categories each with a delete button
- Inline error `<span id="category-error">`
- Disabled state of `add-category-btn` when custom category count ≥ 50

---

## Data Models

### Transaction

Stored as a JSON array under the localStorage key `ebv_transactions`.

```js
/**
 * @typedef {Object} Transaction
 * @property {string} id        - UUID v4 (generated via crypto.randomUUID() or fallback)
 * @property {string} name      - Item name, 1–100 characters
 * @property {number} amount    - Positive number, 0.01–999999999.99
 * @property {string} category  - Category name string
 * @property {string} timestamp - ISO 8601 datetime string, e.g. "2025-07-18T14:35:00.000Z"
 */
```

Example:
```json
{
  "id": "a1b2c3d4-...",
  "name": "Lunch",
  "amount": 12.50,
  "category": "Food",
  "timestamp": "2025-07-18T06:30:00.000Z"
}
```

### Custom Category

Stored as a JSON array of strings under the localStorage key `ebv_categories`.

```json
["Gym", "Books", "Utilities"]
```

### Application State (in-memory)

```js
/**
 * @typedef {Object} AppState
 * @property {Transaction[]} transactions     - All loaded transactions
 * @property {string[]}      customCategories - Active custom category names
 * @property {string}        activeSort       - Current sort key ('newest' | 'amount-asc' | 'amount-desc' | 'category-az' | 'category-za')
 * @property {string|null}   activeFilter     - Current month filter 'YYYY-MM' or null (all months)
 */
```

### StorageManager Interface

```js
const StorageManager = {
  /** @returns {Transaction[]} */
  loadTransactions()  { … },

  /** @param {Transaction[]} transactions */
  saveTransactions(transactions) { … },

  /** @returns {string[]} */
  loadCategories() { … },

  /** @param {string[]} categories */
  saveCategories(categories) { … },
};
```

### Validator Interface

```js
const Validator = {
  /**
   * @param {{ name: string, amount: string, category: string }} fields
   * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
   */
  validateTransaction(fields) { … },

  /**
   * @param {string} name
   * @param {string[]} existingCategories
   * @returns {{ valid: boolean, error?: string }}
   */
  validateCategory(name, existingCategories) { … },
};
```

### SortFilter Interface

```js
const SortFilter = {
  /**
   * @param {Transaction[]} transactions
   * @param {string} sortKey
   * @returns {Transaction[]}  — new sorted array, does not mutate input
   */
  sort(transactions, sortKey) { … },

  /**
   * @param {Transaction[]} transactions
   * @param {string} monthKey  'YYYY-MM' or null
   * @returns {Transaction[]}  — new filtered array
   */
  filter(transactions, monthKey) { … },
};
```

### CategoryManager Interface

```js
const CategoryManager = {
  DEFAULT_CATEGORIES: ['Food', 'Transport', 'Fun'],
  MAX_CUSTOM: 50,

  /** @returns {string[]} all categories (defaults + custom) */
  getAll(customCategories) { … },

  /** @returns {boolean} */
  canAddMore(customCategories) { … },
};
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transaction amount sum equals Balance_Display value

*For any* list of transactions, the value rendered by the Balance_Display SHALL equal the arithmetic sum of all transaction amounts, formatted as a two-decimal-place currency string.

**Validates: Requirements 5.1, 5.4**

---

### Property 2: Empty-input rejection preserves state

*For any* transaction list state and any input whose name is composed entirely of whitespace (or is empty), or whose amount is zero, negative, or outside the valid range [0.01, 999,999,999.99], submitting that input SHALL not create a new transaction and the transaction list SHALL be unchanged.

**Validates: Requirements 3.2, 3.3**

---

### Property 3: Sort order stability

*For any* list of transactions and any sort key, the result of `SortFilter.sort` SHALL satisfy the comparator for that key, and for transactions that compare equal (e.g., same amount), their relative order SHALL be most-recently-added first (descending by timestamp).

**Validates: Requirements 9.1, 9.2**

---

### Property 4: Month filter restricts to selected period

*For any* transaction list and any month key `YYYY-MM`, every transaction returned by `SortFilter.filter(transactions, monthKey)` SHALL have a timestamp whose `YYYY-MM` prefix matches the filter key, and no transaction outside that month SHALL appear.

**Validates: Requirements 8.2, 8.3**

---

### Property 5: Category duplicate rejection (case-insensitive)

*For any* existing category list and any new name, if the new name matches any existing category name in a case-insensitive comparison, `Validator.validateCategory` SHALL return `valid: false` and the category SHALL NOT be added to the list.

**Validates: Requirements 7.2, 7.3**

---

### Property 6: Custom category persistence round-trip

*For any* list of custom category names, serializing to localStorage via `StorageManager.saveCategories` and then loading back via `StorageManager.loadCategories` SHALL produce an array equivalent to the original (same names, same count).

**Validates: Requirements 2.4, 7.4, 7.5**

---

### Property 7: Transaction persistence round-trip

*For any* transaction object with valid fields, saving it via `StorageManager.saveTransactions` and then loading back via `StorageManager.loadTransactions` SHALL produce a transaction list containing an object with identical `id`, `name`, `amount`, `category`, and `timestamp` fields.

**Validates: Requirements 2.1, 2.3**

---

### Property 8: Chart category percentages sum to 100

*For any* non-empty transaction list, the sum of all per-category percentage values computed for the pie chart SHALL equal 100 (within floating-point rounding tolerance of ±0.1).

**Validates: Requirements 6.1**

---

### Property 9: Sort does not mutate input array

*For any* transaction list, calling `SortFilter.sort` SHALL return a new array and the original input array SHALL be unchanged (same reference, same contents, same order).

**Validates: Requirements 9.1** *(structural invariant)*

---

### Property 10: Category length constraint enforcement

*For any* string with length 0 or length greater than 50, `Validator.validateCategory` SHALL return `valid: false`. *For any* string with length between 1 and 50 inclusive and no duplicate in the existing list, it SHALL return `valid: true`.

**Validates: Requirements 7.2, 7.3**

---

## Error Handling

### localStorage Unavailability

- On app load, `StorageManager.loadTransactions()` and `StorageManager.loadCategories()` are wrapped in `try/catch`.
- If a read throws (e.g., `SecurityError`, storage disabled), the app initializes with empty state and displays a dismissible error banner: *"Could not load saved data. Your browser may have storage disabled."*
- If a write throws during `saveTransactions` or `saveCategories`, the operation is aborted, the in-memory state is **not** mutated, the UI is **not** updated, and an error banner is shown: *"Data could not be saved. Check your browser's storage settings."*
- The Input_Form fields are **not** cleared on a failed save, preserving the user's data entry.

### Corrupted Data

- After a successful localStorage read, the raw JSON string is parsed inside a `try/catch`.
- If parsing fails, the app falls back to an empty array and shows the error banner described above.
- If parsing succeeds but individual transaction objects fail a structural check (missing required fields or out-of-range values), those records are silently discarded and the rest are loaded. A single warning banner notes: *"Some records were skipped due to data corruption."*

### Validation Errors

- Inline error messages appear adjacent to the offending field, tied via `aria-describedby` for screen reader accessibility.
- Errors clear on the next successful submission.
- The submit button is never disabled — feedback is delivered on attempt, not preemptively.

### Chart.js Load Failure

- If the CDN fails to load Chart.js (e.g., offline), the chart canvas is hidden and a static fallback message is shown: *"Chart unavailable — could not load charting library."*
- All other features continue to function normally.

### Unsupported Browser

- On load, a feature-detection check verifies `localStorage`, `Intl.NumberFormat`, and `crypto.randomUUID` (with a fallback UUID generator if absent). If `localStorage` is absent, an unsupported-browser banner is shown and the app does not attempt further initialization.

---

## Testing Strategy

### Overview

Because this feature combines pure logic (sorting, filtering, validation, aggregation) with UI rendering and localStorage I/O, the testing approach uses two complementary layers:

1. **Property-based tests** — for pure functions with universal correctness properties (SortFilter, Validator, CategoryManager math, StorageManager round-trips).
2. **Unit tests (example-based)** — for specific edge cases and UI rendering functions.
3. **Manual / smoke tests** — for end-to-end workflows, responsive layout, and Chart.js integration.

### Property-Based Testing

**Library:** [fast-check](https://fast-check.io/) (loaded via CDN in test HTML, or run in Node with a test runner such as [QUnit](https://qunitjs.com/) or a minimal harness). Since the project uses no build tools, property tests are written in plain JS and run in a browser test page (`tests/property.html`) that loads `fast-check` from CDN.

**Minimum iterations:** 100 per property test.

**Tag format:** Each test is tagged with a comment:
`// Feature: expense-budget-visualizer, Property N: <property_text>`

| Property | Function Under Test | Generator Strategy |
|---|---|---|
| P1: Amount sum = Balance | `sumAmounts(transactions)` | Arbitrary arrays of `{amount: float}` with values in [0.01, 999999999.99] |
| P2: Empty input rejection | `Validator.validateTransaction` | Generate invalid inputs: empty names, whitespace-only names, amounts ≤ 0 or > max |
| P3: Sort order stability | `SortFilter.sort` | Arbitrary transaction arrays, all four sort keys |
| P4: Month filter correctness | `SortFilter.filter` | Arbitrary transactions with random timestamps, arbitrary `YYYY-MM` keys |
| P5: Duplicate category rejection | `Validator.validateCategory` | Arbitrary category lists, duplicate/near-duplicate names with varied casing |
| P6: Category round-trip | `saveCategories` / `loadCategories` (with mocked localStorage) | Arbitrary string arrays of valid category names |
| P7: Transaction round-trip | `saveTransactions` / `loadTransactions` (with mocked localStorage) | Arbitrary transaction objects |
| P8: Chart percentages sum to 100 | `computeCategoryPercentages(transactions)` | Non-empty transaction arrays with various category distributions |
| P9: Sort non-mutation | `SortFilter.sort` | Arbitrary transaction arrays, all sort keys |
| P10: Category length enforcement | `Validator.validateCategory` | Strings of length 0, 51+, and 1–50; existing category lists |

### Unit Tests (Example-Based)

Written in a `tests/unit.html` test page using QUnit or a minimal `console.assert` harness. These cover:

- Formatting: `formatCurrency(12.5)` → `"$12.50"`, `formatCurrency(0)` → `"$0.00"`
- Date formatting: `formatDate("2025-07-18T06:30:00.000Z")` → `"2025-07-18"`
- Empty state rendering: Transaction_List shows "No transactions recorded yet." when array is empty
- Chart empty state: canvas hidden, "No data to display" shown when transactions = []
- Monthly_Summary default: `<input type="month">` value equals current `YYYY-MM` on load
- Balance on load: Balance_Display equals sum of all persisted transactions immediately on initialization
- Delete: deleting the only transaction leaves list empty and Balance = $0.00
- Custom category cap: add-category-btn disabled once 50 custom categories exist
- Sort tiebreaker: two transactions with equal amount are ordered newest first

### Manual / Smoke Tests

These are run manually in Chrome, Firefox, Edge, and Safari:

| Test | Expected Result |
|---|---|
| Open `index.html` via `file://` | App loads without errors; Balance shows $0.00 |
| Add a transaction | List updates, Balance updates, Chart updates — all visually within ~100ms |
| Reload page | All data reappears from localStorage |
| Set month filter | List, total, and chart show only that month's data |
| Clear filter | All transactions restored |
| Resize to 320px | No horizontal scrollbar; all elements readable |
| Resize to 1920px | Layout expands gracefully |
| Tab through all controls | Focus indicator visible on every interactive element |
| Load page offline (CDN blocked) | Chart fallback message shown; all other features work |
| Fill localStorage (simulate quota exceeded) | Error banner shown; form fields preserved |

### Accessibility Checks

- All form inputs have associated `<label>` elements.
- Error messages are linked via `aria-describedby`.
- Chart canvas has `aria-label` describing the current data summary.
- Delete buttons include `aria-label="Delete [item name]"` for screen reader users.
- WCAG 2.1 AA contrast verified via browser DevTools or [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/).
- Full keyboard navigation verified manually.
