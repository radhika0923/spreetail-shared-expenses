import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserPlus, UserMinus, FileText, ArrowRightLeft, DollarSign } from 'lucide-react';

const GroupView = ({ user, groupId }) => {
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balancesData, setBalancesData] = useState({ balances: [], simplifiedDebts: [] });
  const [newMemberName, setNewMemberName] = useState('');
  
  // Modals state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [auditData, setAuditData] = useState({ ledger: [], finalBalance: 0 });
  const [selectedUserForAudit, setSelectedUserForAudit] = useState(null);

  // Forms state
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', paid_by: user.id, split_type: 'equal' });
  const [settleForm, setSettleForm] = useState({ paid_by: user.id, paid_to: '', amount: '' });

  const fetchData = async () => {
    try {
      const [memRes, expRes, balRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/groups/${groupId}/members`),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/expenses/${groupId}`),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/groups/${groupId}/balances`)
      ]);
      setMembers(await memRes.json());
      setExpenses(await expRes.json());
      setBalancesData(await balRes.json());
    } catch (err) {
      console.error("Failed to fetch group data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberName) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newMemberName })
      });
      setNewMemberName('');
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const amount = parseFloat(expenseForm.amount);
    if (!amount || !expenseForm.description) return;
    
    // Simplistic equal split for all current members
    const perPerson = amount / members.length;
    const splits = members.map(m => ({ user_id: m.id, owed_amount: perPerson }));
    
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/expenses/${groupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expenseForm,
          amount,
          date: new Date().toISOString().split('T')[0],
          splits
        })
      });
      setShowAddExpense(false);
      setExpenseForm({ ...expenseForm, description: '', amount: '' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    const amount = parseFloat(settleForm.amount);
    if (!amount || !settleForm.paid_to) return;

    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/expenses/${groupId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settleForm,
          amount,
          date: new Date().toISOString().split('T')[0],
          notes: 'Manual settlement'
        })
      });
      setShowSettle(false);
      setSettleForm({ ...settleForm, amount: '', paid_to: '' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleViewAudit = async (userId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/groups/${groupId}/balances/${userId}`);
      const data = await res.json();
      setAuditData(data);
      const m = members.find(u => u.id === userId);
      setSelectedUserForAudit(m ? m.username : 'User');
      setShowAudit(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="group-view">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem', gap: '1rem' }}>
        <button className="btn btn-success" onClick={() => setShowAddExpense(true)}>
          <DollarSign size={18} style={{ marginRight: '0.5rem' }} /> Add Expense
        </button>
        <button className="btn btn-primary" onClick={() => setShowSettle(true)}>
          <ArrowRightLeft size={18} style={{ marginRight: '0.5rem' }} /> Settle Debt
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* Left Column: Members & Balances */}
        <div>
          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <h3>Members</h3>
            <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input type="text" className="form-input" style={{ width: '150px' }} placeholder="Username" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} required />
              <input type="date" className="form-input" style={{ width: '130px' }} placeholder="Join Date" title="Join Date" />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem' }}><UserPlus size={20} /></button>
            </form>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {members.map(m => (
                <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--surface-border)' }}>
                  <div>
                    <span>{m.username} {m.id === user.id && '(You)'}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Joined: {m.joined_date || 'N/A'} {m.left_date ? `| Left: ${m.left_date}` : ''}
                    </div>
                  </div>
                  <button onClick={() => handleRemoveMember(m.id)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }} title="Set Left Date to Today">
                    <UserMinus size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card">
            <h3>Settlement Plan</h3>
            {balancesData.simplifiedDebts.length === 0 ? (
              <p>All settled up!</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {balancesData.simplifiedDebts.map((debt, idx) => (
                  <li key={idx} style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)' }}>
                    <strong>{debt.fromName}</strong> owes <strong>{debt.toName}</strong>
                    <div style={{ fontSize: '1.25rem', color: 'var(--warning-color)', fontWeight: 'bold', marginTop: '0.5rem' }}>
                      INR {debt.amount}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            
            <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Net Balances & Audit</h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Click on any balance to see the exact breakdown.</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {balancesData.balances.map(b => (
                   <li key={b.userId} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--surface-border)', cursor: 'pointer' }} onClick={() => handleViewAudit(b.userId)}>
                      <span>{b.username}</span>
                      <span style={{ color: b.balance > 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 'bold' }}>
                         {b.balance > 0 ? '+' : ''}{b.balance} INR
                      </span>
                   </li>
                ))}
            </ul>
          </div>
        </div>

        {/* Right Column: Expenses */}
        <div className="glass-card">
          <h3>Recent Activity</h3>
          {expenses.length === 0 ? (
            <p>No expenses yet.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(e => (
                    <tr key={e.id}>
                      <td>{e.date}</td>
                      <td>{e.description}</td>
                      <td style={{ fontWeight: '500' }}>{e.currency} {e.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Expense Modal (Simplified) */}
      {showAddExpense && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ width: '400px' }}>
            <h3>Add Expense</h3>
            <form onSubmit={handleAddExpense}>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input type="text" className="form-input" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (INR)</label>
                <input type="number" step="0.01" className="form-input" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-danger" onClick={() => setShowAddExpense(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-success" style={{ flex: 1 }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Debt Modal */}
      {showSettle && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ width: '400px' }}>
            <h3>Settle Debt</h3>
            <form onSubmit={handleSettle}>
              <div className="form-group">
                <label className="form-label">Who are you paying?</label>
                <select className="form-input" value={settleForm.paid_to} onChange={e => setSettleForm({...settleForm, paid_to: e.target.value})} required>
                  <option value="">Select member...</option>
                  {members.filter(m => m.id !== user.id).map(m => (
                    <option key={m.id} value={m.id}>{m.username}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount (INR)</label>
                <input type="number" step="0.01" className="form-input" value={settleForm.amount} onChange={e => setSettleForm({...settleForm, amount: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-danger" onClick={() => setShowSettle(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {showAudit && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '2rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Audit Trail for {selectedUserForAudit}</h3>
              <button onClick={() => setShowAudit(false)} className="btn btn-danger" style={{ padding: '0.25rem 0.75rem' }}>Close</button>
            </div>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Impact (INR)</th>
                    <th>Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {auditData.ledger.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.date}</td>
                      <td>{item.description}</td>
                      <td>
                        <span className={`badge ${item.impact > 0 ? 'badge-success' : 'badge-danger'}`}>
                           {item.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ color: item.impact > 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 'bold' }}>
                        {item.impact > 0 ? '+' : ''}{item.impact}
                      </td>
                      <td style={{ fontWeight: '500' }}>{item.runningBalance}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold' }}>Final Balance:</td>
                    <td style={{ fontWeight: 'bold', color: auditData.finalBalance > 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                       {auditData.finalBalance} INR
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupView;
