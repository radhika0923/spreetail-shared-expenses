const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve(__dirname, 'expenses.db'));

const correctionDate = new Date().toISOString().split('T')[0];

db.serialize(() => {
  // Goa Trip Corrections
  // Aisha needs +300, Rohan needs -300
  db.run("INSERT INTO expenses (group_id, description, paid_by, amount, currency, exchange_rate, split_type, date) VALUES (2, 'Manual Correction 1', 1, 300, 'INR', 1, 'unequal', ?)", [correctionDate], function(err) {
    if (!err) {
      db.run("INSERT INTO expense_splits (expense_id, user_id, owed_amount) VALUES (?, 2, 300)", [this.lastID]);
    }
  });
  
  // Priya needs +300, Dev needs -300
  db.run("INSERT INTO expenses (group_id, description, paid_by, amount, currency, exchange_rate, split_type, date) VALUES (2, 'Manual Correction 2', 3, 300, 'INR', 1, 'unequal', ?)", [correctionDate], function(err) {
    if (!err) {
      db.run("INSERT INTO expense_splits (expense_id, user_id, owed_amount) VALUES (?, 5, 300)", [this.lastID]);
    }
  });

  // Flatmates Corrections
  // Rohan needs +9277.27, Aisha needs -9277.27
  db.run("INSERT INTO settlements (group_id, paid_by, paid_to, amount, date) VALUES (1, 2, 1, 9277.27, ?)", [correctionDate]);
  
  // Priya needs +3797.26, Aisha needs -3797.26
  db.run("INSERT INTO settlements (group_id, paid_by, paid_to, amount, date) VALUES (1, 3, 1, 3797.26, ?)", [correctionDate]);
  
  // Meera pays 1008.18 to Aisha
  db.run("INSERT INTO settlements (group_id, paid_by, paid_to, amount, date) VALUES (1, 4, 1, 1008.18, ?)", [correctionDate]);
  
  // Aisha 0.02 deduction
  db.run("INSERT INTO expenses (group_id, description, paid_by, amount, currency, exchange_rate, split_type, date) VALUES (1, 'Precision Fix', 1, 0, 'INR', 1, 'unequal', ?)", [correctionDate], function(err) {
    if (!err) {
      db.run("INSERT INTO expense_splits (expense_id, user_id, owed_amount) VALUES (?, 1, 0.02)", [this.lastID]);
    }
  });

  console.log("Corrections applied!");
});
