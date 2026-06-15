# Spreetail Shared Expenses

A modern, high-fidelity shared expenses management application built to resolve complex, multi-currency, timeline-bound debts across different groups.

## Features
- **CSV Ingestion Wizard**: A robust data ingestion engine that automatically flags, groups, and resolves 12+ types of data anomalies from raw CSV exports.
- **Smart Debt Minimization**: Automatically calculates the minimum number of transactions required to settle complex group debts.
- **Audit Ledger**: A flattened, line-by-line financial history to trace exactly how the balances were computed for maximum transparency.
- **Timeline-Bound Memberships**: Excludes members from splitting expenses that occurred outside their active residency dates.
- **Dark Mode SaaS UI**: Features a sleek, responsive React frontend.

## Tech Stack
- **Frontend**: React (Vite), CSS Modules, Lucide React (Icons).
- **Backend**: Node.js, Express.js.
- **Database**: SQLite3 (for portability and easy setup).

## Setup Instructions

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### 1. Start the Backend Server
1. Open a terminal and navigate to the `server` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Express server:
   ```bash
   node index.js
   ```
   *The server will run on `http://localhost:5000`.*

### 2. Start the Frontend Client
1. Open a second terminal and navigate to the `client` directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The client will run on `http://localhost:5173`.*

## AI Integration
This project was developed with the assistance of advanced agentic AI coding tools (Antigravity by Google Deepmind) to rapidly build UI components, construct SQL queries, and implement complex parsing algorithms. See `AI_USAGE.md` for a detailed log of AI interactions and corrections.
