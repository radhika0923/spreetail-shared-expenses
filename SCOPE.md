# Project Scope: Shared Expenses Application

## In-Scope
- **User Authentication**: Secure register and login system using JWT and bcrypt.
- **Group Management**: Ability to create groups, and add or remove members dynamically.
- **Expense Tracking**: Logging expenses with support for various split types (equal, percentage, shares, unequal).
- **Data Import Module**: A robust CSV parser designed to handle 12 specific anomalies (e.g., number formatting, case/spacing inconsistency, stale members, mixed currencies, missing values).
- **Settlement Tracking**: Detecting and recording payments between members instead of categorizing them as shared expenses.

## Out-of-Scope (MVP)
- Real-time notifications (WebSocket).
- Exporting data to external services (e.g., Google Sheets integration).
- Multi-language support.
- Mobile application (responsive web only).
