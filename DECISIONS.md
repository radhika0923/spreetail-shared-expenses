# DECISIONS: Architecture & Design Log

This document outlines the significant architectural and product decisions made during development.

## 1. Database Portability: SQLite vs Postgres
**Decision**: Chose SQLite.
**Options Considered**: 
- *PostgreSQL*: Better for concurrent writes and complex JSON querying.
- *SQLite*: Serverless, requires zero configuration, writes to a local file.
**Rationale**: Given the tight deadline and the requirement for a functional, highly portable demonstration application, SQLite ensures the reviewer can pull the repo and run the application instantly without provisioning a database server.

## 2. Managing Multiple Groups (Flatmates vs Goa)
**Decision**: Dual-group ingestion logic based on row indices / dates rather than standalone imports.
**Options Considered**:
- Force the user to split the CSV manually before uploading.
- Have a single global ledger.
- Use the Node.js backend to map specific row ranges/dates into separate database groups during the `csvParser.js` execution.
**Rationale**: To streamline UX, the CSV Ingestion Wizard acts globally. The backend dynamically determines `targetGroupId` (Goa Trip vs Flatmates 4B) based on date ranges and members involved, but allows the user to override this destination in the frontend wizard UI.

## 3. Handling Anomalies: Strict Enforcement vs User Resolution
**Decision**: Soft-fail and prompt the user via an Interactive Wizard.
**Options Considered**:
- Hard fail the import if anomalies exist.
- Auto-correct everything silently.
- Present a wizard that flags anomalies and pauses ingestion until resolutions are selected.
**Rationale**: Silent auto-correction leads to loss of trust when dealing with finances. Hard failing is terrible UX. Building an interactive "CSV Ingestion Wizard" allows us to natively parse the CSV, highlight the anomalies via warning badges (`[HIGH]`, `[MEDIUM]`), and let the user make informed decisions (e.g., selecting the missing payer).

## 4. Frontend State: React Router vs Conditional Rendering
**Decision**: CSS `display: none` for state preservation.
**Options Considered**:
- Using React Router `<Routes>` to switch between Dashboard, Audit Ledger, and CSV Uploader.
- Using simple `if/else` conditional rendering.
**Rationale**: When using standard conditional rendering, switching away from the "CSV Ingestion Wizard" to check the "Dashboard" caused the wizard component to unmount, immediately destroying the user's uploaded CSV data and anomaly resolutions. By rendering all components and toggling `display: none` via CSS in `Layout.jsx`, we preserved local component state seamlessly across tab switches without implementing Redux or complex global contexts.

## 5. Mathematical Debt Minimization
**Decision**: Implemented an aggressive net-balance aggregation algorithm.
**Options Considered**:
- Track peer-to-peer debts precisely as they occurred historically.
- Sum all positive and negative balances into a global pool and greedily match the highest debtor to the highest creditor.
**Rationale**: The goal of a shared expense app is to minimize the total number of physical bank transfers. The greedy matching algorithm effectively resolves complex debt webs (where A owes B, B owes C) into minimal direct settlements (A pays C).
