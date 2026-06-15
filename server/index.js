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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
