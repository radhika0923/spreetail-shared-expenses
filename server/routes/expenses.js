const express = require('express');
const multer = require('multer');
const { db } = require('../database');
const { parseCSV } = require('../services/csvParser');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Get all expenses for a group
router.get('/:groupId', (req, res) => {
  const { groupId } = req.params;
  db.all('SELECT * FROM expenses WHERE group_id = ? ORDER BY date DESC', [groupId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

// Global Upload CSV
router.post('/global/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const { results, anomalies, dbMembers } = await parseCSV(req.file.path);
    res.json({ message: 'File parsed globally', results, anomalies, dbMembers });
  } catch (error) {
    res.status(500).json({ error: 'Error parsing CSV' });
  }
});

// Global Confirm import
router.post('/global/import', (req, res) => {
  const { expenses } = req.body;

  if (!expenses || !Array.isArray(expenses)) return res.status(400).json({ error: 'Invalid payload' });

  // Pre-fetch users to map names to IDs
  db.all('SELECT id, username FROM users', [], async (err, users) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    const userMap = {};
    users.forEach(u => userMap[u.username.toLowerCase()] = u.id);

    const runQuery = (query, params) => new Promise((resolve, reject) => {
      db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    try {
      await runQuery('BEGIN TRANSACTION', []);

      for (let exp of expenses) {
        let amount = exp.parsedAmount || 0;
        let currency = exp.parsedCurrency || 'INR';
        const targetGroupId = exp.targetGroupId;
        if (!targetGroupId) continue;

        // Exchange Rate Override from UI
        if (exp.exchangeRateApplied && currency === 'USD') {
          amount = amount * exp.exchangeRateApplied;
          currency = 'INR'; // Normalize to INR in DB
        }

        const paidById = userMap[exp.parsedPaidBy?.toLowerCase()];
        if (!paidById) continue; // Skip if payer couldn't be resolved

        if (exp.isSettlement) {
          const desc = exp.description.toLowerCase();
          let paidToId = null;
          for (const [uname, uid] of Object.entries(userMap)) {
            if (desc.includes(uname) && uid !== paidById) {
              paidToId = uid;
              break;
            }
          }
          if (paidToId) {
            await runQuery('INSERT INTO settlements (group_id, paid_by, paid_to, amount, currency, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [targetGroupId, paidById, paidToId, amount, currency, exp.parsedDate || exp.date, exp.description]
            );
          }
        } else {
          const splitType = exp.parsedSplitType || 'equal';
          const expenseId = await runQuery('INSERT INTO expenses (group_id, paid_by, description, amount, currency, date, split_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [targetGroupId, paidById, exp.description, amount, currency, exp.parsedDate || exp.date, splitType]
          );

          // Determine split logic
          let splitUsers = exp.split_with ? exp.split_with.split(';').map(n => n.trim().toLowerCase()).filter(n => userMap[n]) : [];
          if (splitUsers.length === 0) splitUsers = [exp.parsedPaidBy.toLowerCase()];

          if (splitType === 'percentage' && exp.normalizedWeights) {
            for (const [uname, pct] of Object.entries(exp.normalizedWeights)) {
              const uid = userMap[uname.toLowerCase()];
              if (uid) {
                const owed = (amount * (pct / 100)).toFixed(2);
                await runQuery('INSERT INTO expense_splits (expense_id, user_id, owed_amount) VALUES (?, ?, ?)', [expenseId, uid, owed]);
              }
            }
          } else {
            // Equal or share split
            const perPerson = (amount / splitUsers.length).toFixed(2);
            for (const uname of splitUsers) {
              await runQuery('INSERT INTO expense_splits (expense_id, user_id, owed_amount) VALUES (?, ?, ?)', [expenseId, userMap[uname], perPerson]);
            }
          }
        }
      }

      await runQuery('COMMIT', []);
      res.json({ message: 'Expenses imported successfully' });
    } catch (err) {
      db.run('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Transaction failed' });
    }
  });
});

// Create a single expense manually
router.post('/:groupId', (req, res) => {
  const { groupId } = req.params;
  const { paid_by, description, amount, currency = 'INR', date, split_type, splits } = req.body;

  if (!paid_by || !amount || !date || !splits) return res.status(400).json({ error: 'Missing required fields' });

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run('INSERT INTO expenses (group_id, paid_by, description, amount, currency, date, split_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [groupId, paid_by, description, amount, currency, date, split_type], function (err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Failed to create expense' });
        }

        const expenseId = this.lastID;

        // Insert splits
        let hasError = false;
        splits.forEach(split => {
          db.run('INSERT INTO expense_splits (expense_id, user_id, owed_amount) VALUES (?, ?, ?)',
            [expenseId, split.user_id, split.owed_amount], (err) => {
              if (err) hasError = true;
            });
        });

        if (hasError) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Failed to create splits' });
        }

        db.run('COMMIT', (err) => {
          if (err) return res.status(500).json({ error: 'Transaction failed' });
          res.status(201).json({ message: 'Expense created successfully', id: expenseId });
        });
      });
  });
});

// Record a settlement (payment between members)
router.post('/:groupId/settle', (req, res) => {
  const { groupId } = req.params;
  const { paid_by, paid_to, amount, currency = 'INR', date, notes } = req.body;

  if (!paid_by || !paid_to || !amount || !date) return res.status(400).json({ error: 'Missing required fields' });

  db.run('INSERT INTO settlements (group_id, paid_by, paid_to, amount, currency, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [groupId, paid_by, paid_to, amount, currency, date, notes], function (err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.status(201).json({ message: 'Settlement recorded', id: this.lastID });
    });
});

module.exports = router;
