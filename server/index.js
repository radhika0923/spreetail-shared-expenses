const express = require('express');
const cors = require('cors');
const { initDb } = require('./database');
const authRoutes = require('./routes/auth');
const groupsRoutes = require('./routes/groups');
const expensesRoutes = require('./routes/expenses');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Database
initDb();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/expenses', expensesRoutes);

// Admin route to reset ledger data
app.post('/api/admin/reset', (req, res) => {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const db = new sqlite3.Database(path.resolve(__dirname, 'expenses.db'));
  
  db.serialize(() => {
    db.run("DELETE FROM expenses");
    db.run("DELETE FROM expense_splits");
    db.run("DELETE FROM settlements");
    res.json({ message: 'Database ledger reset successfully' });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
