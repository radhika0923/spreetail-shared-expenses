const express = require('express');
const { db } = require('../database');
const router = express.Router();

// Get all groups
router.get('/', (req, res) => {
  db.all('SELECT * FROM groups', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

// Create a new group
router.post('/', (req, res) => {
  const { name, created_by } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name required' });

  db.run('INSERT INTO groups (name, created_by) VALUES (?, ?)', [name, created_by || null], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    const groupId = this.lastID;
    
    if (created_by) {
      db.run('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, created_by]);
    }
    
    res.status(201).json({ id: groupId, name, created_by });
  });
});

// Add member to group
router.post('/:groupId/members', (req, res) => {
  const { groupId } = req.params;
  const { username } = req.body; // or user_id

  db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    db.run('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, user.id], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
           return res.status(400).json({ error: 'User already in group' });
        }
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(201).json({ message: 'User added to group' });
    });
  });
});

// Get group members (optionally filtered by date)
router.get('/:groupId/members', (req, res) => {
  const { groupId } = req.params;
  const { date } = req.query;

  let query = `
    SELECT users.id, users.username, group_members.joined_date, group_members.left_date
    FROM users 
    JOIN group_members ON users.id = group_members.user_id 
    WHERE group_members.group_id = ?
  `;
  const params = [groupId];

  if (date) {
    query += ` AND (group_members.joined_date <= ? OR group_members.joined_date IS NULL)`;
    query += ` AND (group_members.left_date > ? OR group_members.left_date IS NULL)`;
    params.push(date, date);
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

// Remove member from group
router.delete('/:groupId/members/:userId', (req, res) => {
  const { groupId, userId } = req.params;
  
  db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Member not found in group' });
    res.json({ message: 'Member removed from group' });
  });
});

// Get group balances and simplified debts
router.get('/:groupId/balances', (req, res) => {
  const { groupId } = req.params;
  
  // We need all users who have ever participated (so we get their names)
  db.all('SELECT id, username FROM users', [], (err, allUsers) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const usersMap = {};
    allUsers.forEach(u => usersMap[u.id] = u.username);

    // 1. Get all expenses and their splits
    db.all('SELECT * FROM expenses WHERE group_id = ?', [groupId], (err, expenses) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      db.all('SELECT es.* FROM expense_splits es JOIN expenses e ON es.expense_id = e.id WHERE e.group_id = ?', [groupId], (err, splits) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        // 2. Get all settlements
        db.all('SELECT * FROM settlements WHERE group_id = ?', [groupId], (err, settlements) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          
          const balances = {}; // userId -> net balance (positive = gets money, negative = owes money)
          const EXCHANGE_RATE = 83.0; // 1 USD = 83 INR
          
          const convertToINR = (amount, currency) => {
            if (currency === 'USD') return amount * EXCHANGE_RATE;
            return amount;
          };

          // Add expenses paid
          expenses.forEach(exp => {
            const amountINR = convertToINR(exp.amount, exp.currency);
            balances[exp.paid_by] = (balances[exp.paid_by] || 0) + amountINR;
          });
          
          // Subtract splits owed
          splits.forEach(split => {
            // Wait, splits don't have currency. They represent the numeric amount in the expense's currency.
            // So we need to find the expense to know the currency.
            const exp = expenses.find(e => e.id === split.expense_id);
            const owedINR = convertToINR(split.owed_amount, exp ? exp.currency : 'INR');
            balances[split.user_id] = (balances[split.user_id] || 0) - owedINR;
          });
          
          // Add settlements paid, subtract settlements received
          settlements.forEach(settle => {
            const amountINR = convertToINR(settle.amount, settle.currency);
            balances[settle.paid_by] = (balances[settle.paid_by] || 0) + amountINR;
            balances[settle.paid_to] = (balances[settle.paid_to] || 0) - amountINR;
          });
          
          // Clean up floating point issues
          Object.keys(balances).forEach(id => {
            balances[id] = Math.round(balances[id] * 100) / 100;
          });

          // Compute simplified debts
          const debtors = [];
          const creditors = [];
          
          for (const [userId, balance] of Object.entries(balances)) {
            if (balance < -0.01) debtors.push({ userId: parseInt(userId), amount: -balance });
            else if (balance > 0.01) creditors.push({ userId: parseInt(userId), amount: balance });
          }
          
          // Sort by amount descending
          debtors.sort((a, b) => b.amount - a.amount);
          creditors.sort((a, b) => b.amount - a.amount);
          
          const simplifiedDebts = [];
          let d = 0, c = 0;
          
          while (d < debtors.length && c < creditors.length) {
            const debtor = debtors[d];
            const creditor = creditors[c];
            
            const amount = Math.min(debtor.amount, creditor.amount);
            
            simplifiedDebts.push({
              from: debtor.userId,
              fromName: usersMap[debtor.userId],
              to: creditor.userId,
              toName: usersMap[creditor.userId],
              amount: Math.round(amount * 100) / 100
            });
            
            debtor.amount -= amount;
            creditor.amount -= amount;
            
            if (debtor.amount < 0.01) d++;
            if (creditor.amount < 0.01) c++;
          }
          
          // Format balances for response
          const balancesResponse = Object.entries(balances)
            .filter(([_, bal]) => Math.abs(bal) > 0.01)
            .map(([userId, bal]) => ({
              userId: parseInt(userId),
              username: usersMap[userId],
              balance: bal
            }));

          res.json({
            balances: balancesResponse,
            simplifiedDebts
          });
        });
      });
    });
  });
});

// Get detailed audit trail for a user
router.get('/:groupId/balances/:userId', (req, res) => {
  const { groupId, userId } = req.params;
  const uid = parseInt(userId);
  const EXCHANGE_RATE = 83.0;
  
  const convertToINR = (amount, currency) => {
    if (currency === 'USD') return amount * EXCHANGE_RATE;
    return amount;
  };

  db.all('SELECT * FROM expenses WHERE group_id = ?', [groupId], (err, allExpenses) => {
    db.all('SELECT * FROM expense_splits WHERE expense_id IN (SELECT id FROM expenses WHERE group_id = ?)', [groupId], (err, allSplits) => {
      db.all('SELECT * FROM settlements WHERE group_id = ? AND (paid_by = ? OR paid_to = ?)', [groupId, uid, uid], (err, settlements) => {
        
        const ledger = [];
        let runningBalance = 0;
        
        // 1. Expenses paid by this user
        const expensesPaid = allExpenses.filter(e => e.paid_by === uid);
        expensesPaid.forEach(e => {
           const inr = convertToINR(e.amount, e.currency);
           ledger.push({ date: e.date, type: 'paid_expense', description: e.description, amount: e.amount, currency: e.currency, amountINR: inr, impact: inr });
        });
        
        // 2. Expenses where user owed a share
        const splitsOwed = allSplits.filter(s => s.user_id === uid);
        splitsOwed.forEach(s => {
           const e = allExpenses.find(ex => ex.id === s.expense_id);
           if (e) {
             const inr = convertToINR(s.owed_amount, e.currency);
             ledger.push({ date: e.date, type: 'owed_split', description: `Share of: ${e.description}`, amount: s.owed_amount, currency: e.currency, amountINR: inr, impact: -inr });
           }
        });
        
        // 3. Settlements
        settlements.forEach(s => {
           const inr = convertToINR(s.amount, s.currency);
           if (s.paid_by === uid) {
             ledger.push({ date: s.date, type: 'settlement_paid', description: `Paid settlement to user ${s.paid_to}`, amount: s.amount, currency: s.currency, amountINR: inr, impact: inr });
           } else {
             ledger.push({ date: s.date, type: 'settlement_received', description: `Received settlement from user ${s.paid_by}`, amount: s.amount, currency: s.currency, amountINR: inr, impact: -inr });
           }
        });
        
        ledger.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        ledger.forEach(item => {
           runningBalance += item.impact;
           item.runningBalance = Math.round(runningBalance * 100) / 100;
           item.impact = Math.round(item.impact * 100) / 100;
           item.amountINR = Math.round(item.amountINR * 100) / 100;
        });
        
        res.json({ ledger, finalBalance: Math.round(runningBalance * 100) / 100 });
      });
    });
  });
});

// Get groups a user belongs to
router.get('/user/:userId', (req, res) => {
  const uid = parseInt(req.params.userId);
  db.all('SELECT g.* FROM groups g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = ?', [uid], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

// Get consolidated audit trail for a user across ALL groups
router.get('/user/:userId/audit', (req, res) => {
  const uid = parseInt(req.params.userId);
  const EXCHANGE_RATE = 83.0;
  
  const convertToINR = (amount, currency) => {
    if (currency === 'USD') return amount * EXCHANGE_RATE;
    return amount;
  };

  db.all('SELECT g.id, g.name FROM groups g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = ?', [uid], (err, userGroups) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    const groupIds = userGroups.map(g => g.id);
    if (groupIds.length === 0) return res.json({ groupedLedger: {}, globalFinalBalance: 0 });

    const placeholders = groupIds.map(() => '?').join(',');

    db.all(`SELECT e.*, g.name as group_name FROM expenses e JOIN groups g ON e.group_id = g.id WHERE e.group_id IN (${placeholders})`, groupIds, (err, allExpenses) => {
      db.all(`SELECT s.*, e.group_id FROM expense_splits s JOIN expenses e ON s.expense_id = e.id WHERE e.group_id IN (${placeholders})`, groupIds, (err, allSplits) => {
        db.all(`SELECT s.*, g.name as group_name FROM settlements s JOIN groups g ON s.group_id = g.id WHERE s.group_id IN (${placeholders}) AND (s.paid_by = ? OR s.paid_to = ?)`, [...groupIds, uid, uid], (err, settlements) => {
          
          const groupedLedger = {};
          userGroups.forEach(g => groupedLedger[g.name] = { ledger: [], runningBalance: 0 });
          let globalFinalBalance = 0;
          
          // 1. Expenses paid
          const expensesPaid = allExpenses.filter(e => e.paid_by === uid);
          expensesPaid.forEach(e => {
             const inr = convertToINR(e.amount, e.currency);
             groupedLedger[e.group_name].ledger.push({ date: e.date, type: 'paid_expense', description: e.description, amount: e.amount, currency: e.currency, amountINR: inr, impact: inr });
          });
          
          // 2. Expenses owed
          const splitsOwed = allSplits.filter(s => s.user_id === uid);
          splitsOwed.forEach(s => {
             const e = allExpenses.find(ex => ex.id === s.expense_id);
             if (e) {
               const inr = convertToINR(s.owed_amount, e.currency);
               groupedLedger[e.group_name].ledger.push({ date: e.date, type: 'owed_split', description: `Share of: ${e.description}`, amount: s.owed_amount, currency: e.currency, amountINR: inr, impact: -inr });
             }
          });
          
          // 3. Settlements
          settlements.forEach(s => {
             const inr = convertToINR(s.amount, s.currency);
             if (s.paid_by === uid) {
               groupedLedger[s.group_name].ledger.push({ date: s.date, type: 'settlement_paid', description: `Paid settlement`, amount: s.amount, currency: s.currency, amountINR: inr, impact: inr });
             } else {
               groupedLedger[s.group_name].ledger.push({ date: s.date, type: 'settlement_received', description: `Received settlement`, amount: s.amount, currency: s.currency, amountINR: inr, impact: -inr });
             }
          });
          
          // Sort and calculate running balances per group
          for (const [gName, data] of Object.entries(groupedLedger)) {
             data.ledger.sort((a, b) => new Date(a.date) - new Date(b.date));
             let rb = 0;
             data.ledger.forEach(item => {
                rb += item.impact;
                item.runningBalance = Math.round(rb * 100) / 100;
                item.impact = Math.round(item.impact * 100) / 100;
                item.amountINR = Math.round(item.amountINR * 100) / 100;
             });
             data.finalBalance = Math.round(rb * 100) / 100;
             globalFinalBalance += data.finalBalance;
          }
          
          res.json({ groupedLedger, globalFinalBalance: Math.round(globalFinalBalance * 100) / 100 });
        });
      });
    });
  });
});

module.exports = router;
