# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses, manage budgets, and visualize spending distribution across categories. The application is built entirely with HTML, CSS, and Vanilla JavaScript, stores all data in the browser's LocalStorage, and requires no backend server or complex setup. It provides an intuitive interface for adding transactions, viewing totals, browsing a transaction history, analyzing a pie chart of category-based spending, creating custom categories, reviewing monthly summaries, and sorting transactions.

## Glossary

- **App**: The Expense & Budget Visualizer web application running in the browser.
- **Transaction**: A single expense entry containing an item name, amount, category, and timestamp.
- **Category**: A label grouping transactions (e.g., Food, Transport, Fun, or a user-defined custom category).
- **Custom_Category**: A user-defined category name added by the user beyond the default set.
- **Transaction_List**: The scrollable UI component displaying all saved transactions.
- **Balance_Display**: The UI component showing the computed total of all transaction amounts.
- **Chart**: The pie chart UI component visualizing spending distribution by category.
- **Monthly_Summary**: A filtered view showing transactions and totals for a selected calendar month.
- **LocalStorage**: The browser's Web Storage API used to persist all application data client-side.
- **Input_Form**: The UI form component where users enter transaction details.
- **Sort_Control**: The UI control that determines the ordering of the Transaction_List.
- **Validator**: The logic component that checks Input_Form fields before a transaction is saved.
- **Category_Manager**: The logic component that manages the set of available categories.
- **Storage_Manager**: The logic component responsible for reading and writing data to LocalStorage.

---

## Requirements

### Requirement 1: Technology Stack and Deployment

**User Story:** As a developer, I want the app to use only HTML, CSS, and Vanilla JavaScript with no server dependency, so that it can be opened directly in a browser or used as a browser extension without any build step.

#### Acceptance Criteria

1. THE App SHALL be implemented using only HTML, CSS, and Vanilla JavaScript without any frontend framework (React, Vue, Angular, or equivalent), build tools (Webpack, Vite, Rollup, or equivalent), or package managers (npm, yarn, or equivalent) required at runtime.
2. THE App SHALL operate entirely client-side, with no network requests to a backend server required for core functionality, and all data processing and state management SHALL occur within the browser.
3. THE App SHALL load and render its initial view within 3 seconds when opened in the current stable versions of Chrome, Firefox, Edge, and Safari on a device meeting minimum hardware requirements.
4. THE App SHALL be usable as a standalone web page opened via the file system (file:// protocol) or served from a local HTTP server, with all assets (scripts, styles, images) resolvable using relative paths.
5. IF the App is loaded in a browser that does not meet the supported versions listed in criterion 3, THEN the App SHALL display a message indicating that the browser is unsupported.

---

### Requirement 2: Data Persistence

**User Story:** As a user, I want my transactions and custom categories to be saved automatically, so that my data is available the next time I open the app.

#### Acceptance Criteria

1. WHEN a Transaction is successfully submitted, THE Storage_Manager SHALL persist the Transaction to LocalStorage before the UI is updated.
2. WHEN the App is loaded, THE Storage_Manager SHALL read all previously saved Transactions and Custom_Categories from LocalStorage and make them available in memory and rendered in the UI; IF the stored data is corrupted or malformed, THEN the App SHALL recover gracefully by initializing with an empty state and notifying the user.
3. WHEN a Transaction is deleted, THE Storage_Manager SHALL remove the Transaction from LocalStorage before the UI is updated.
4. WHEN a Custom_Category is added, THE Storage_Manager SHALL persist the updated category list to LocalStorage before the UI is updated.
5. IF LocalStorage is unavailable or throws an error during a write operation, THEN THE App SHALL display an error message to the user explaining that data could not be saved.
6. WHEN a Custom_Category is removed, THE Storage_Manager SHALL remove it from LocalStorage before the UI is updated.
7. IF LocalStorage throws an error during a read operation on App load, THEN THE App SHALL initialize with an empty state and display an error message explaining that saved data could not be retrieved.

---

### Requirement 3: Input Form and Transaction Submission

**User Story:** As a user, I want to fill in a form with an item name, amount, and category, so that I can record a new expense transaction.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for item name (maximum 100 characters), a numeric field for amount (accepting values from 0.01 to 999,999,999.99), and a dropdown selector for category.
2. WHEN a user submits the Input_Form, THE Validator SHALL verify that the item name field is non-empty, the amount field contains a positive number greater than zero and within the accepted range, and a category is selected.
3. IF the Validator detects that any required field is empty or invalid, THEN THE Input_Form SHALL display an inline validation message identifying which field is invalid without submitting the Transaction.
4. WHEN the Validator confirms all fields are valid, THE App SHALL create a Transaction with the provided item name, amount, category, and the current device local date and time as a timestamp.
5. WHEN a Transaction is successfully saved, THE Input_Form SHALL clear all fields and return focus to the item name field.
6. WHEN the Input_Form is rendered, THE category dropdown SHALL include all default categories (Food, Transport, Fun) and all active Custom_Categories.
7. IF saving the Transaction to LocalStorage fails, THEN THE App SHALL display an error message and NOT clear the Input_Form fields, preserving the user's entered data.

---

### Requirement 4: Transaction List

**User Story:** As a user, I want to see a scrollable list of all my transactions, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all persisted Transactions, each showing the item name, amount formatted as a two-decimal-place currency value with a currency symbol, category, and date formatted as YYYY-MM-DD.
2. THE Transaction_List SHALL be scrollable when the number of Transactions exceeds the visible area of its container.
3. WHEN a Transaction is added, THE Transaction_List SHALL update to include the new Transaction within 100 milliseconds without requiring a page reload.
4. WHEN a user activates the delete button on a Transaction entry, THE App SHALL remove that Transaction from the Transaction_List and from LocalStorage.
5. WHEN a Transaction is deleted, THE Transaction_List SHALL update to reflect the removal within 100 milliseconds without requiring a page reload.
6. WHEN there are no Transactions, THE Transaction_List SHALL display an empty state message indicating no transactions have been recorded.
7. IF LocalStorage throws an error during a delete operation, THEN THE App SHALL display an error message and retain the Transaction in the Transaction_List.

---

### Requirement 5: Total Balance Display

**User Story:** As a user, I want to see a total balance that reflects all my recorded expenses, so that I know my cumulative spending at a glance.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all Transaction amounts formatted as a two-decimal-place value with a currency symbol (e.g., $1,234.56).
2. WHEN a Transaction is added, THE Balance_Display SHALL update to reflect the new total within 100 milliseconds of the LocalStorage write completing.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the new total within 100 milliseconds of the LocalStorage write completing.
4. WHEN there are no Transactions, THE Balance_Display SHALL show a value of zero formatted as a two-decimal-place currency value (e.g., $0.00).
5. WHEN the App is loaded, THE Balance_Display SHALL compute and render the total from all persisted Transactions before the user can interact with the Input_Form.

---

### Requirement 6: Pie Chart Visualization

**User Story:** As a user, I want to see a pie chart showing how my spending is distributed across categories, so that I can understand where most of my money goes.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart where each segment represents a Category with a unique color and displays the category's percentage share of total spending rounded to one decimal place.
2. THE Chart SHALL display a legend mapping each unique color segment to its Category name and total amount formatted as a two-decimal-place currency value with a currency symbol.
3. WHEN a Transaction is added or deleted, THE Chart SHALL update within 100 milliseconds to reflect the new category distribution.
4. WHEN all Transactions belong to a single Category, THE Chart SHALL render a full circle for that Category.
5. WHEN there are no Transactions, THE Chart SHALL display an empty state message containing the text "No data to display" instead of an empty or broken chart.
6. THE App SHALL load Chart.js from a CDN or include it as a local bundled script to render the pie chart without requiring a separate install step.

---

### Requirement 7: Custom Categories

**User Story:** As a user, I want to add my own spending categories, so that I can organize expenses beyond the default set.

#### Acceptance Criteria

1. THE Category_Manager SHALL provide a text input (1-50 characters) and a submit control for users to enter and submit a new Custom_Category name.
2. WHEN a user submits a new Custom_Category, THE Validator SHALL verify that the name is between 1 and 50 characters and is not a duplicate of an existing category name (case-insensitive).
3. IF the Validator detects that the Custom_Category name is empty, exceeds 50 characters, or is a duplicate, THEN THE Category_Manager SHALL display an inline validation message identifying the specific reason and not save the category.
4. WHEN a valid Custom_Category is saved, THE Category_Manager SHALL add it to the category dropdown in the Input_Form and complete LocalStorage persistence within 1 second.
5. WHEN the App becomes interactive on load, THE Category_Manager SHALL restore all previously saved Custom_Categories from LocalStorage and include them in the category dropdown within 2 seconds.
6. WHEN the total number of active Custom_Categories reaches 50, THE Category_Manager SHALL disable the custom category submit control and display a message indicating the maximum number of categories has been reached.

---

### Requirement 8: Monthly Summary View

**User Story:** As a user, I want to filter my transactions by a specific month and year, so that I can review and understand my spending for that period.

#### Acceptance Criteria

1. THE Monthly_Summary SHALL provide a month and year selector defaulting to the current calendar month and year on App load, allowing users to choose any calendar month.
2. WHEN a month is selected, THE Monthly_Summary SHALL display only the Transactions whose timestamp falls within that calendar month and year.
3. WHEN a month is selected, THE Monthly_Summary SHALL display the sum of amounts of all Transactions within that period formatted as a two-decimal-place currency value with a currency symbol.
4. WHEN a month is selected, THE Chart SHALL update to reflect the total expense amount per category for only the Transactions within that period.
5. WHEN the user clears the monthly filter, THE App SHALL restore the Transaction_List and Chart to show all Transactions across all months.
6. WHEN there are no Transactions in the selected month, THE Monthly_Summary SHALL display a message indicating no transactions were found for that period, and the Chart SHALL display the empty state message defined in Requirement 6.

---

### Requirement 9: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by amount or by category, so that I can find and analyze transactions more easily.

#### Acceptance Criteria

1. THE Sort_Control SHALL provide options to sort Transactions by amount (ascending and descending) and by category name (A-Z and Z-A); when two Transactions share the same amount, they SHALL be ordered by most-recently-added first as a tiebreaker.
2. WHEN the user selects a sort option, THE Transaction_List SHALL re-render in the selected order within 100 milliseconds.
3. WHEN a Transaction is added, edited, or deleted, THE Transaction_List SHALL maintain the currently active sort order.
4. WHEN the App is loaded, THE Sort_Control SHALL default to showing Transactions in the order they were added (most recent first).
5. THE Sort_Control SHALL render the currently active sort option in a distinct visual state that differs from all inactive sort options.

---

### Requirement 10: Responsive Layout and Visual Design

**User Story:** As a user, I want the app to be readable and usable on both desktop and mobile screen sizes, so that I can track expenses from any device.

#### Acceptance Criteria

1. THE App SHALL use a single CSS file located at `css/styles.css` and a single JavaScript file located at `js/app.js`.
2. THE App SHALL apply a responsive layout at viewport widths from 320px to 1920px such that no horizontal scrollbar appears and no content is clipped or hidden outside the viewport.
3. THE App SHALL maintain visual hierarchy by rendering headings, labels, amounts, and body text at distinct font sizes, where each level differs by at least 2px from adjacent levels.
4. THE App SHALL provide color contrast for all text elements meeting WCAG 2.1 AA requirements: a minimum contrast ratio of 4.5:1 for normal text (below 18pt or 14pt bold) and a minimum contrast ratio of 3:1 for large text (18pt or above, or 14pt bold or above).
5. WHEN interactive elements (buttons, inputs, selects) receive keyboard focus, THE App SHALL display a focus indicator with a visible outline of at least 2px solid that has a contrast ratio of at least 3:1 against the adjacent background color.
6. WHEN the App is rendered at viewport widths of 320px to 1024px, THE App SHALL render all interactive elements (buttons, inputs, selects) with a minimum tap target size of 44x44 CSS pixels.
