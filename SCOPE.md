# SCOPE: Anomaly Log & Database Schema

## Anomaly Detection Log
The core feature of this application is the robust CSV ingestion engine, which actively detects and prompts the user to resolve 12+ distinct data anomalies.

1. **Date Ambiguity (`DATE_AMBIGUOUS`)**
   - *Problem*: Dates formatted as `10-04-2026` could be `Oct 4` or `Apr 10`.
   - *Action*: Flags as MEDIUM severity. Prompts user to explicitly choose `DD-MM` vs `MM-DD`. Defaults to `DD-MM-YYYY`.
2. **Inconsistent Date Format (`INCONSISTENT_DATE`)**
   - *Problem*: Mixed formats like `Mar-14` instead of full numerical dates.
   - *Action*: Automatically mapped to a unified `YYYY-MM-DD` standard.
3. **Missing Payers (`MISSING_PAYER`)**
   - *Problem*: The `paid_by` field is blank.
   - *Action*: Blocks import until the user explicitly selects a valid payer from the database via a dropdown.
4. **Name Casing / Typos (`CASE_INCONSISTENCY`)**
   - *Problem*: `aisha` vs `Aisha` or names containing unexpected substrings.
   - *Action*: Automatically trims, tokenizes, and capitalizes names against the database record (`normalizeName`).
5. **Number Precision & Formatting (`PRECISION`, `FORMATTING`)**
   - *Problem*: Amounts include commas (`2,500`) or excessive decimals (`10.33333`).
   - *Action*: Strips commas, rounds to 2 decimal places natively, but gives the user a toggle to use the original raw string if desired.
6. **Foreign Currency (`FOREIGN_CURRENCY`)**
   - *Problem*: Expenses logged in `USD` instead of the base currency `INR`.
   - *Action*: Automatically converts to INR based on a global exchange rate input provided in the UI wizard.
7. **Negative/Zero Amounts (`ZERO_AMOUNT`, `NEGATIVE_AMOUNT`)**
   - *Problem*: Amounts are $\leq 0$.
   - *Action*: Flags for review.
8. **Settlements Logged as Expenses (`SETTLEMENT_LOGGED_AS_EXPENSE`)**
   - *Problem*: Direct transfers (e.g., "Paid back") logged as standard shared expenses.
   - *Action*: Automatically reclassifies the transaction and routes it to the `settlements` database table rather than `expenses`.
9. **Redundant Split Details (`REDUNDANT_DETAILS`)**
   - *Problem*: An `equal` split type provides custom detail arrays anyway.
   - *Action*: Flags as LOW severity. Forces the split to adhere to the explicit share details.
10. **Percentage Split Mismatch (`PERCENTAGE_MISMATCH`)**
    - *Problem*: Explicit percentage splits do not sum to 100%.
    - *Action*: Flags as HIGH severity. Offers an "Auto-Normalize" toggle that recalculates the splits proportionally to equal exactly 100%.
11. **Timeline Out Of Bounds (`OUT_OF_BOUNDS`)**
    - *Problem*: A member is included in a split for a date before they joined or after they left.
    - *Action*: Flags as HIGH severity. Allows the user to either forcibly keep them or auto-exclude them and redistribute the liability.
12. **External Members (`EXTERNAL_MEMBERS`)**
    - *Problem*: A name in `split_with` does not exist in the target group.
    - *Action*: Prompts user to either reassign liability to the Host (Payer) or add them as a temporary member.
13. **Duplicates (`DUPLICATE_GROUP`)**
    - *Problem*: Overlapping events on the same day with the exact same amount and currency, with high token overlap in the description.
    - *Action*: Groups the conflicts in a dedicated UI block. User must explicitly choose which record to keep via radio buttons.

## Database Schema (SQLite)

### `users`
- `id` (INTEGER PRIMARY KEY)
- `username` (TEXT UNIQUE)
- `email` (TEXT UNIQUE)
- `password_hash` (TEXT)

### `groups`
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT)
- `description` (TEXT)
- `created_by` (INTEGER, FK to users)

### `group_members`
- `id` (INTEGER PRIMARY KEY)
- `group_id` (INTEGER, FK to groups)
- `user_id` (INTEGER, FK to users)
- `joined_date` (TEXT)
- `left_date` (TEXT)

### `expenses`
- `id` (INTEGER PRIMARY KEY)
- `group_id` (INTEGER, FK to groups)
- `paid_by` (INTEGER, FK to users)
- `description` (TEXT)
- `amount` (REAL)
- `currency` (TEXT DEFAULT 'INR')
- `split_type` (TEXT)
- `date` (TEXT)

### `expense_splits`
- `id` (INTEGER PRIMARY KEY)
- `expense_id` (INTEGER, FK to expenses)
- `user_id` (INTEGER, FK to users)
- `owed_amount` (REAL)

### `settlements`
- `id` (INTEGER PRIMARY KEY)
- `group_id` (INTEGER, FK to groups)
- `paid_by` (INTEGER, FK to users)
- `paid_to` (INTEGER, FK to users)
- `amount` (REAL)
- `currency` (TEXT DEFAULT 'INR')
- `date` (TEXT)
