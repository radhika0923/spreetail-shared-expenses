const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'expenses.db');
const db = new sqlite3.Database(dbPath);

const seed = async () => {
  const hash = await bcrypt.hash('password123', 10);
  
  db.serialize(() => {
    // Drop existing tables to start fresh
    db.run('DROP TABLE IF EXISTS expense_splits');
    db.run('DROP TABLE IF EXISTS expenses');
    db.run('DROP TABLE IF EXISTS settlements');
    db.run('DROP TABLE IF EXISTS group_members');
    db.run('DROP TABLE IF EXISTS groups');
    db.run('DROP TABLE IF EXISTS users');

    // Recreate tables
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        user_id INTEGER,
        joined_date DATE,
        left_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    db.run(`
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        paid_by INTEGER,
        description TEXT,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'INR',
        date DATE NOT NULL,
        split_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE expense_splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER,
        user_id INTEGER,
        owed_amount REAL NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        paid_by INTEGER,
        paid_to INTEGER,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'INR',
        date DATE NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert Users
    const users = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Dev', 'Sam'];
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    users.forEach(u => stmt.run(u, hash));
    stmt.finalize();

    // Group 1: Flatmates
    db.run("INSERT INTO groups (name, created_by) VALUES ('Flatmates', 1)", function(err) {
      if (err) return console.error(err);
      const flatmatesId = this.lastID;

      const flatmates = [
        { user_id: 1, joined_date: '2026-02-01', left_date: null }, // Aisha
        { user_id: 2, joined_date: '2026-02-01', left_date: null }, // Rohan
        { user_id: 3, joined_date: '2026-02-01', left_date: null }, // Priya
        { user_id: 4, joined_date: '2026-02-01', left_date: '2026-03-31' }, // Meera
        { user_id: 6, joined_date: '2026-04-08', left_date: null }  // Sam
      ];

      const mStmt = db.prepare('INSERT INTO group_members (group_id, user_id, joined_date, left_date) VALUES (?, ?, ?, ?)');
      flatmates.forEach(m => mStmt.run(flatmatesId, m.user_id, m.joined_date, m.left_date));
      mStmt.finalize();
      console.log('Flatmates group created!');
    });

    // Group 2: Goa Trip
    db.run("INSERT INTO groups (name, created_by) VALUES ('Goa Trip', 1)", function(err) {
      if (err) return console.error(err);
      const goaId = this.lastID;

      const goaMembers = [
        { user_id: 1, joined_date: '2026-03-08', left_date: '2026-03-15' }, // Aisha
        { user_id: 2, joined_date: '2026-03-08', left_date: '2026-03-15' }, // Rohan
        { user_id: 3, joined_date: '2026-03-08', left_date: '2026-03-15' }, // Priya
        { user_id: 5, joined_date: '2026-03-08', left_date: '2026-03-15' }  // Dev
      ];

      const mStmt = db.prepare('INSERT INTO group_members (group_id, user_id, joined_date, left_date) VALUES (?, ?, ?, ?)');
      goaMembers.forEach(m => mStmt.run(goaId, m.user_id, m.joined_date, m.left_date));
      mStmt.finalize();
      console.log('Goa Trip group created!');
    });
  });
};

seed();
