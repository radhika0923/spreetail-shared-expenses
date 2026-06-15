# Architecture Decision Record (ADR)

## Tech Stack
- **Database**: SQLite. Chosen for simplicity and lack of external dependencies, which is suitable for this MVP and technical evaluation.
- **Backend**: Node.js + Express.
- **Frontend**: React via Vite, Vanilla CSS for styling (provides maximum flexibility to create a dynamic, premium aesthetic without an external library).

## CSV Anomaly Handling Strategies
1. **Number Formatting**: Strip commas before float parsing.
2. **Precision Issues**: Round all calculated and parsed amounts to 2 decimal places.
3. **Inconsistent Identifiers**: Trim whitespace, title-case the string, and use string similarity or strict normalization to deduplicate "priya", "Priya S", etc.
4. **Missing Values**: Empty `paid_by` -> assigned to the person uploading or flagged for manual review. Missing currency -> fallback to INR.
5. **Settlements**: If description contains "paid" or "settle" and amount is specific, categorize as settlement (user-to-user) rather than shared expense.
6. **Invalid Math**: Flag percentages summing > 100% or adjust them proportionally.
7. **Mixed Currencies**: Track `currency` field. No auto-conversion for now; just label appropriately.
8. **Duplicates**: Fuzzy match description, date, and amount. Flag potential duplicates for review.
9. **Date Formats**: Use a robust date parser (e.g., `Date.parse` combined with manual string splitting) to normalize to ISO.
10. **Zero/Negative Amounts**: Skip 0 amount. Treat negative as a refund/reduction in total group expense.
11. **Stale Members**: Import the member into the group historically if they are referenced in an old split.
12. **Conflicting Types**: If `split_type` says equal but `split_details` has shares/percentages, the detailed shares take precedence.
