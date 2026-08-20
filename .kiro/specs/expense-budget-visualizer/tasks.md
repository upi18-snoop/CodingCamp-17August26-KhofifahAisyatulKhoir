# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a fully client-side, single-page web application using plain HTML, CSS, and Vanilla JavaScript. All data persists in `localStorage`. The implementation is structured as a series of incremental steps — each step extends the previous — ending with all components wired together and covered by property-based tests.

The final file structure is:
```
index.html
css/styles.css
js/app.js
tests/property.html
```

---

## Tasks

- [x] 1. Project scaffolding — create the base file structure
  - Create `index.html` with the full semantic HTML shell: `<header>` (Balance_Display), `<main>` with five `<section>` elements (`#input-section`, `#category-section`, `#chart-section`, `#summary-section`, `#list-section`), and `<script>` tags for Chart.js CDN and `js/app.js`
  - Create `css/styles.css` as an empty file linked from `index.html`
  - Create `js/app.js` as an empty file
  - All asset paths must be relative so the page works under `file://` protocol
  - _Requirements: 1.1, 1.4, 10.1_

- [x] 2. StorageManager — localStorage CRUD with error handling
  - [x] 2.1 Implement `StorageManager` factory object in `js/app.js`
    - Implement `loadTransactions()`: read and JSON-parse `ebv_transactions` key; return `[]` on missing key; wrap in `try/catch` for parse errors and `SecurityError`
    - Implement `saveTransactions(transactions)`: JSON-stringify and write to `ebv_transactions`; wrap in `try/catch` and return a `{ ok, error }` result object
    - Implement `loadCategories()`: same pattern for `ebv_categories` key; return `[]` on missing key
    - Implement `saveCategories(categories)`: same pattern for `ebv_categories`
    - On any read failure, return empty array and set a module-level `lastReadError` flag
    - On any write failure, return `{ ok: false, error }` without mutating in-memory state
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_



- [x] 3. Validator — transaction and category validation
  - [x] 3.1 Implement `Validator` factory object in `js/app.js`
    - Implement `validateTransaction({ name, amount, category })`: reject empty/whitespace-only names, amounts ≤ 0 or > 999,999,999.99 or non-numeric, missing category; return `{ valid, errors: { name?, amount?, category? } }`
    - Implement `validateCategory(name, existingCategories)`: reject empty string, length > 50, and case-insensitive duplicates against `existingCategories`; return `{ valid, error? }`
    - _Requirements: 3.2, 3.3, 7.2, 7.3_

- [x] 4. CategoryManager — category list management
  - [x] 4.1 Implement `CategoryManager` factory object in `js/app.js`
    - Define `DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun']` and `MAX_CUSTOM = 50`
    - Implement `getAll(customCategories)`: return `[...DEFAULT_CATEGORIES, ...customCategories]`
    - Implement `canAddMore(customCategories)`: return `customCategories.length < MAX_CUSTOM`
    - _Requirements: 3.6, 7.1, 7.6_

- [x] 5. SortFilter — pure sort and filter functions
  - [x] 5.1 Implement `SortFilter` factory object in `js/app.js`
    - Implement `sort(transactions, sortKey)`: return a **new** array (never mutate input) sorted by the given key
      - `newest`: descending by `timestamp` (default)
      - `amount-asc` / `amount-desc`: by `amount`; tiebreaker = descending `timestamp`
      - `category-az` / `category-za`: alphabetical by `category`; tiebreaker = descending `timestamp`
    - Implement `filter(transactions, monthKey)`: if `monthKey` is null return all transactions; otherwise return only transactions whose `timestamp` starts with `monthKey` (`YYYY-MM` prefix match)
    - _Requirements: 8.2, 9.1, 9.2_


- [x] 6. Application state and helper utilities
  - [x] 6.1 Define the in-memory `AppState` object and helper utilities in `js/app.js`
    - Define `AppState`: `{ transactions: [], customCategories: [], activeSort: 'newest', activeFilter: null }`
    - Implement `generateId()`: use `crypto.randomUUID()` with a timestamp+random fallback for browsers that lack it
    - Implement `formatCurrency(amount)`: use `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` to produce `$1,234.56`-style strings
    - Implement `formatDate(isoString)`: extract the `YYYY-MM-DD` prefix from an ISO 8601 string
    - Implement `sumAmounts(transactions)`: return the arithmetic sum of all `amount` fields (used by Balance_Display and Monthly_Summary)
    - _Requirements: 5.1, 5.4, 4.4 (timestamp), 10.1_


- [x] 7. Input Form HTML and validation UI
  - [x] 7.1 Build the Input Form markup and inline validation in `index.html` and `js/app.js`
    - Add to `#input-section`: `<input type="text" id="item-name" maxlength="100">`, `<input type="number" id="item-amount" min="0.01" max="999999999.99" step="0.01">`, `<select id="item-category">`, `<button id="add-btn">Add Expense</button>`
    - Add an inline error `<span>` with `aria-describedby` linkage adjacent to each field (hidden by default via CSS class)
    - Implement `renderCategoryDropdown(customCategories)`: clear and re-populate `#item-category` with `CategoryManager.getAll(customCategories)`
    - Implement `showFormErrors(errors)` and `clearFormErrors()` helpers
    - _Requirements: 3.1, 3.3, 3.6_

  - [x] 7.2 Implement form submit handler in `js/app.js`
    - On `add-btn` click: read fields, call `Validator.validateTransaction`, display errors on failure
    - On success: create a `Transaction` object with `generateId()` and `new Date().toISOString()` timestamp, call `StorageManager.saveTransactions`, on save failure show error banner and preserve fields, on success update `AppState.transactions`, re-render Balance, Transaction List, and Chart, reset form and return focus to `#item-name`
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.7_

- [x] 8. Transaction List rendering
  - [x] 8.1 Implement `renderTransactionList(transactions)` in `js/app.js`
    - Apply `SortFilter.sort(AppState.transactions, AppState.activeSort)` and `SortFilter.filter` with `AppState.activeFilter` before rendering
    - Render each transaction as `<li>` containing: item name, `formatCurrency(amount)`, category badge `<span>`, `formatDate(timestamp)`, and `<button class="delete-btn" data-id="…" aria-label="Delete [name]">Delete</button>`
    - Render `<li class="empty-state">No transactions recorded yet.</li>` when the array is empty
    - _Requirements: 4.1, 4.2, 4.3, 4.6_

  - [x] 8.2 Implement delete handler in `js/app.js`
    - Attach a delegated `click` listener on `#transaction-list` for `.delete-btn`
    - On click: call `StorageManager.saveTransactions(updated)`, on failure show error banner and keep item in list, on success remove from `AppState.transactions`, re-render Transaction List, Balance, and Chart
    - _Requirements: 4.4, 4.5, 4.7_

- [x] 9. Balance Display rendering
  - [x] 9.1 Implement `renderBalance()` in `js/app.js`
    - Compute `sumAmounts(AppState.transactions)` and write `formatCurrency(total)` to `#balance-total`
    - Call `renderBalance()` during initialization before any user interaction is possible
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 10. Chart.js pie chart
  - [x] 10.1 Add Chart.js CDN `<script>` tag and canvas markup in `index.html`
    - Add `<canvas id="expense-chart" aria-label="Spending distribution by category"></canvas>` inside `#chart-section`
    - Add `<div id="chart-legend"></div>` for the custom HTML legend
    - Add `<p id="chart-empty" hidden>No data to display</p>`
    - _Requirements: 6.5, 6.6_

  - [x] 10.2 Implement `computeCategoryPercentages(transactions)` and `renderChart()` in `js/app.js`
    - `computeCategoryPercentages`: group transaction amounts by category, compute each category's percentage of the total rounded to one decimal place
    - `renderChart()`: if no transactions, hide `#expense-chart`, show `#chart-empty`, clear `#chart-legend`; otherwise show canvas, hide `#chart-empty`, create or update the Chart.js `Pie` instance (`chart.data = …; chart.update()`), and render an HTML legend in `#chart-legend` with category name, color swatch, and `formatCurrency(total)`
    - Detect Chart.js load failure via `window.Chart === undefined` and show a fallback message: *"Chart unavailable — could not load charting library."*
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_


- [x] 11. Checkpoint — core functionality complete
  - Ensure all tests in `tests/property.html` pass (Properties 1–10)
  - Manually verify: add a transaction → list, balance, chart all update; reload → data persists; delete → list, balance, chart update
  - Ask the user if any questions or adjustments are needed before continuing

- [~] 12. Category Manager UI
  - [-] 12.1 Build Category Manager markup and handlers in `index.html` and `js/app.js`
    - Add to `#category-section`: `<input type="text" id="custom-category-name" maxlength="50">`, `<button id="add-category-btn">Add Category</button>`, `<ul id="custom-category-list">`, `<span id="category-error">`
    - Implement `renderCustomCategoryList(customCategories)`: render each custom category as `<li>` with a delete button; if count ≥ 50 disable `#add-category-btn` and show the cap message
    - Implement add-category handler: call `Validator.validateCategory`, show inline error on failure; on success call `StorageManager.saveCategories`, update `AppState.customCategories`, re-render category list and dropdown
    - Implement delete-category handler: remove from `AppState.customCategories`, call `StorageManager.saveCategories`, re-render category list and dropdown
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [~] 13. Monthly Summary view
  - [ ] 13.1 Build Monthly Summary markup and handlers in `index.html` and `js/app.js`
    - Add to `#summary-section`: `<input type="month" id="month-filter">`, `<button id="clear-filter">Show All</button>`, `<span id="summary-total">`
    - On initialization set `#month-filter` value to current `YYYY-MM`
    - Implement `renderSummary()`: compute `sumAmounts(SortFilter.filter(AppState.transactions, AppState.activeFilter))` and write to `#summary-total`; if no transactions in period show "No transactions found for this period"
    - Attach change handler on `#month-filter`: update `AppState.activeFilter`, call `renderTransactionList`, `renderSummary`, `renderChart`
    - Attach click handler on `#clear-filter`: reset `AppState.activeFilter = null`, reset `#month-filter` value, re-render all three views
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [~] 14. Sort Control
  - [ ] 14.1 Build Sort Control markup and handler in `index.html` and `js/app.js`
    - Add to `#list-section`: `<select id="sort-control">` with options `newest`, `amount-asc`, `amount-desc`, `category-az`, `category-za`
    - Default selected value: `newest`
    - Implement `updateSortActiveState()`: set `data-active` attribute on the currently selected `<option>` and remove it from others (used by CSS for visual distinction)
    - Attach change handler: update `AppState.activeSort`, call `renderTransactionList`, call `updateSortActiveState`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [~] 15. App initialization and feature detection
  - [ ] 15.1 Implement `initApp()` in `js/app.js` and call it on `DOMContentLoaded`
    - Feature-detect `window.localStorage`, `window.Intl?.NumberFormat`, and `window.crypto?.randomUUID` (install fallback UUID generator if `randomUUID` absent)
    - If `localStorage` is absent: show unsupported-browser banner, halt initialization
    - Call `StorageManager.loadTransactions()` and `StorageManager.loadCategories()`; on read error show dismissible error banner: *"Could not load saved data. Your browser may have storage disabled."*
    - If individual transaction records fail structural validation (missing `id`, `name`, `amount`, `category`, `timestamp`) silently discard them and show: *"Some records were skipped due to data corruption."*
    - Populate `AppState`, then call `renderCategoryDropdown`, `renderTransactionList`, `renderBalance`, `renderChart`, `renderSummary`, `updateSortActiveState` — all before returning control to the user
    - _Requirements: 1.3, 1.5, 2.2, 2.7_

- [~] 16. Responsive CSS and accessibility
  - [ ] 16.1 Write responsive layout and base styles in `css/styles.css`
    - Apply a fluid single-column layout at 320px that expands to a two-column (form + chart side-by-side) layout at ≥ 768px and a three-column arrangement at ≥ 1200px using CSS Grid or Flexbox; no horizontal scrollbar from 320px to 1920px
    - Set font sizes for headings, labels, amounts, and body text such that each level differs by at least 2px from adjacent levels
    - Choose foreground/background color pairs meeting WCAG 2.1 AA: ≥ 4.5:1 for normal text, ≥ 3:1 for large text
    - Style all interactive elements with `min-width: 44px; min-height: 44px` at viewport ≤ 1024px
    - Style focus indicators: `outline: 2px solid <color>` with ≥ 3:1 contrast against adjacent background on all buttons, inputs, and selects
    - Style the active sort option using `[data-active]` selector to visually distinguish it from inactive options
    - Style `.empty-state`, error banners, inline error spans, category badge, and the chart legend
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [~] 17. Final checkpoint — integration and wiring complete
  - Ensure all tests in `tests/property.html` pass (all 10 properties, minimum 100 iterations each)
  - Verify end-to-end: add transaction → sort → filter by month → clear filter → add custom category → delete transaction → reload
  - Ask the user if any questions or adjustments are needed

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; they cover property-based tests only
- Each task references specific requirements for traceability
- All rendering functions operate on the in-memory `AppState`; they never read directly from `localStorage`
- `SortFilter` functions are pure and must never mutate their input arrays
- Property tests run in a browser (`tests/property.html`) using fast-check from CDN — no build step required
- Chart.js is loaded from CDN; a graceful fallback message is shown if it fails to load

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "5.1"] },
    { "id": 2, "tasks": ["6.1", "2.2", "3.2", "5.2"] },
    { "id": 3, "tasks": ["6.2", "7.1", "9.1", "10.1"] },
    { "id": 4, "tasks": ["7.2", "8.1", "10.2"] },
    { "id": 5, "tasks": ["8.2", "10.3", "12.1", "13.1", "14.1"] },
    { "id": 6, "tasks": ["15.1"] },
    { "id": 7, "tasks": ["16.1"] }
  ]
}
```
