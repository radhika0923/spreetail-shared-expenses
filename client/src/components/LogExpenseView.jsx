import { useState, useEffect } from 'react';

const LogExpenseView = ({ user, groupId }) => {
  const [members, setMembers] = useState([]);
  
  // Expense Form State
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [paidBy, setPaidBy] = useState(user.id.toString());
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitType, setSplitType] = useState('equal');
  const [splitWith, setSplitWith] = useState([]);

  // Settlement Form State
  const [sFrom, setSFrom] = useState('');
  const [sTo, setSTo] = useState('');
  const [sAmount, setSAmount] = useState('');
  const [sCurrency, setSCurrency] = useState('INR');
  const [sDate, setSDate] = useState(new Date().toISOString().split('T')[0]);
  const [sNotes, setSNotes] = useState('');

  useEffect(() => {
    if (!groupId) return;
    fetch(`http://localhost:5000/api/groups/${groupId}/members`)
      .then(res => res.json())
      .then(data => {
        setMembers(data);
        setSplitWith(data.map(m => m.id)); // Default select all
      });
  }, [groupId]);

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!desc || !amount || splitWith.length === 0) return alert("Fill all required fields");
    
    const perPerson = (parseFloat(amount) / splitWith.length).toFixed(2);
    const splits = splitWith.map(uid => ({ user_id: uid, owed_amount: perPerson }));

    try {
      const res = await fetch(`http://localhost:5000/api/expenses/${groupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid_by: paidBy, description: desc, amount, currency, date, split_type: splitType, splits })
      });
      if (res.ok) {
        alert('Expense Logged!');
        setDesc(''); setAmount('');
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSettlementSubmit = async (e) => {
    e.preventDefault();
    if (!sFrom || !sTo || !sAmount) return alert("Fill all required fields");
    
    try {
      const res = await fetch(`http://localhost:5000/api/expenses/${groupId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid_by: sFrom, paid_to: sTo, amount: sAmount, currency: sCurrency, date: sDate, notes: sNotes })
      });
      if (res.ok) {
        alert('Payment Recorded!');
        setSAmount(''); setSNotes('');
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSplitMember = (uid) => {
    setSplitWith(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      
      {/* Log Shared Expense */}
      <div className="glass-card">
        <h2 style={{ margin: '0 0 1.5rem 0' }}>Log Shared Expense</h2>
        <form onSubmit={handleExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div>
            <label>Description</label>
            <input type="text" className="form-control" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Internet Broadband" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label>Amount</label>
              <input type="number" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label>Currency</label>
              <select className="form-control" value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label>Paid By</label>
              <select className="form-control" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
                {members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
              </select>
            </div>
            <div>
              <label>Date</label>
              <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label>Split Type</label>
            <select className="form-control" value={splitType} onChange={e => setSplitType(e.target.value)}>
              <option value="equal">Split Equally</option>
            </select>
          </div>

          <div>
            <label style={{ marginBottom: '0.5rem', display: 'block' }}>Split With:</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {members.map(m => (
                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={splitWith.includes(m.id)}
                    onChange={() => toggleSplitMember(m.id)}
                    style={{ accentColor: 'var(--primary-color)', width: '16px', height: '16px' }}
                  />
                  {m.username}
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Log Expense</button>
        </form>
      </div>

      {/* Record Payment / Settlement */}
      <div className="glass-card">
        <h2 style={{ margin: '0 0 0.5rem 0' }}>Record Payment / Settlement</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Log peer-to-peer cash payments made to settle outstanding debts directly.</p>
        
        <form onSubmit={handleSettlementSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div>
            <label>From (Payer)</label>
            <select className="form-control" value={sFrom} onChange={e => setSFrom(e.target.value)}>
              <option value="">-- Select Debtor --</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
            </select>
          </div>

          <div>
            <label>To (Payee)</label>
            <select className="form-control" value={sTo} onChange={e => setSTo(e.target.value)}>
              <option value="">-- Select Creditor --</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label>Amount</label>
              <input type="number" className="form-control" value={sAmount} onChange={e => setSAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label>Currency</label>
              <select className="form-control" value={sCurrency} onChange={e => setSCurrency(e.target.value)}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          <div>
            <label>Settlement Date</label>
            <input type="date" className="form-control" value={sDate} onChange={e => setSDate(e.target.value)} />
          </div>

          <div>
            <label>Notes</label>
            <input type="text" className="form-control" value={sNotes} onChange={e => setSNotes(e.target.value)} placeholder="e.g. Sent via UPI" />
          </div>

          <button type="submit" className="btn btn-success" style={{ marginTop: '1rem' }}>Record Payment</button>
        </form>
      </div>

    </div>
  );
};

export default LogExpenseView;
