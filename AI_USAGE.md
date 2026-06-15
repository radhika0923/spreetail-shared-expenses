# AI USAGE: Interaction & Troubleshooting Log

This application was built collaboratively using Google Deepmind's Antigravity AI coding assistant.

## AI Tools Used
- **Agent Environment**: Antigravity Local Workspace
- **Capabilities Leveraged**: `write_to_file` for rapid component scaffolding, `run_command` for executing node scripts and database queries, `grep_search` for code navigation.

## Key Prompts Used
1. *"Build a React frontend to match this exact dark-mode SaaS dashboard screenshot."* -> Used for scaffolding the CSS Modules and layout.
2. *"Refactor the backend audit ledger endpoint to output a flattened array so the React component can render exactly one row per transaction."* -> Used to sync the frontend UI structure with the backend SQL joins.
3. *"Create an implementation plan to completely overhaul the CSV Ingestion Wizard UI with isolated duplicate conflict cards and inline anomaly alerts."* -> Used to systematically execute a massive UI upgrade based on a reference image.

## Concrete Cases of AI Hallucination/Errors & Fixes

### 1. The Disappearing CSV Upload State
- **What happened**: The AI generated a standard React App using conditional rendering (`{activeTab === 'csv' && <CsvUploader />}`). 
- **The error**: When I uploaded a CSV, resolved 5 anomalies, and then clicked the "Dashboard" tab to check a balance, returning to the "CSV Ingestion Wizard" tab resulted in a completely blank screen because the component had unmounted and the local state was destroyed.
- **How it was caught**: I clicked the tab and noticed my data vanished.
- **The fix**: Instructed the AI to modify `Layout.jsx` to mount all components simultaneously and toggle their visibility using `display: none` instead of unmounting them, preserving the React state.

### 2. Syntax Error in String Interpolation
- **What happened**: The AI was tasked with updating the description logic in `groups.js`.
- **The error**: The AI escaped the template literals incorrectly using `replace_file_content`, writing `description: \`Paid settlement to \${userMap[s.paid_to]}\``. This resulted in a literal `SyntaxError: Invalid or unexpected token` that immediately crashed the Node server.
- **How it was caught**: The terminal output showed the crash stack trace when starting the server.
- **The fix**: Sent the stack trace back to the AI. It recognized the escaping error, generated a new `replace_file_content` call without the backslashes, and restarted the server.

### 3. The Double-Import Ledger Duplication
- **What happened**: The AI built a gorgeous new CSV Ingestion Wizard and instructed me to "upload the CSV and click import to see it in action."
- **The error**: Because my database was already fully populated with the correct data, clicking "Import" appended a duplicate set of expenses to the database. Aisha's balance skyrocketed from ~82k to ~171k.
- **How it was caught**: I reviewed the Dashboard balances and noticed they were double the expected values.
- **The fix**: The AI had to write a script (`restore_db.js`) to wipe the SQLite tables and cleanly re-import exactly one instance of the data. To prevent future issues, the AI was instructed to modify the `/api/expenses/global/import` endpoint to aggressively `DELETE FROM expenses` before importing any new data via the wizard.
