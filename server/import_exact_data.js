const { parseCSV } = require('./services/csvParser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve(__dirname, 'expenses.db'));

async function run() {
  // Update group names first
  db.serialize(() => {
    db.run("UPDATE groups SET name = 'Flatmates 4B' WHERE id = 1");
    db.run("UPDATE groups SET name = 'Goa Trip 2026' WHERE id = 2");
    db.run("DELETE FROM expenses");
    db.run("DELETE FROM expense_splits");
    db.run("DELETE FROM settlements");
  });

  const { results } = await parseCSV('./uploads/09207c454fa69aa8da73ae56fa292d48');
  
  let finalExpenses = [];
  
  for (let r of results) {
    if (r.id === 4) continue; // Discard dinner - marina bites duplicate
    if (r.id === 23) continue; // Discard Thalassa dinner duplicate
    
    let exp = { ...r };
    
    // Missing Payer resolution
    if (r.id === 12) exp.parsedPaidBy = 'Aisha'; 
    else exp.parsedPaidBy = r.parsedPaidBy || 'Aisha'; // Fallback
    
    // External Members (reassign to host)
    let finalSplits = r.split_with ? r.split_with.split(';').map(n => n.trim()) : [];
    if (r.anomalyFlags && r.anomalyFlags.externalMembers) {
      r.anomalyFlags.externalMembers.forEach(ext => {
        finalSplits = finalSplits.filter(n => n !== ext);
        if (!finalSplits.includes(exp.parsedPaidBy)) finalSplits.push(exp.parsedPaidBy);
      });
    }
    exp.split_with = finalSplits.join(';');
    
    // Percentage normalization
    if (exp.parsedSplitType === 'percentage' && r.anomalyFlags && r.anomalyFlags.percentageMismatch) {
       exp.split_details = Object.entries(r.anomalyFlags.percentageMismatch.proportional)
           .map(([k,v]) => `${k} ${v}`).join(';');
    }
    
    finalExpenses.push(exp);
  }
  
  // Hit the backend import endpoint via a temporary internal server
  const express = require('express');
  const expensesRoutes = require('./routes/expenses');
  const app = express();
  app.use(express.json());
  app.use('/api/expenses', expensesRoutes);
  
  const server = app.listen(5005, async () => {
    try {
      const res = await fetch('http://localhost:5005/api/expenses/global/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: finalExpenses })
      });
      const data = await res.json();
      console.log('Import successful:', data);
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

run();
