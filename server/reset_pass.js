const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'expenses.db');
const db = new sqlite3.Database(dbPath);
const defaultHash = '$2b$10$Xme3dL7/W/e1BishqbpWieTshvYEHE164i4nWXcLtqwFtmch7ick6'; // password123

db.run("UPDATE users SET password = ? WHERE username = 'Anisha'", [defaultHash], function(err) {
  if (err) console.error(err);
  console.log("Password reset for Anisha to 'password123'");
});
