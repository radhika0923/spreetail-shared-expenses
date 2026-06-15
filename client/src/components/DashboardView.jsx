import { useState, useEffect } from 'react';

const DashboardView = ({ user, groupId }) => {
  const [balancesData, setBalancesData] = useState({ balances: [], simplifiedDebts: [] });
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (!groupId) return;
    
    // Fetch group details
    fetch(`http://localhost:5000/api/groups/user/${user.id}`)
      .then(res => res.json())
      .then(data => {
        const group = data.find(g => g.id.toString() === groupId.toString());
        if (group) setGroupName(group.name);
      });

    // Fetch balances
    fetch(`http://localhost:5000/api/groups/${groupId}/balances`)
      .then(res => res.json())
      .then(data => setBalancesData(data))
      .catch(err => console.error(err));
  }, [groupId, user.id]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
      
      {/* Group Balances */}
      <div className="glass-card">
        <h2 style={{ margin: '0 0 0.5rem 0' }}>Group Balances: {groupName}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {groupName === 'Goa Trip 2026' ? 'Vacation spending' : 'Our shared flat expenses'}
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {balancesData.balances.map((b, idx) => (
            <div key={idx} style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '8px',
              padding: '1.25rem',
              borderLeft: b.balance >= 0 ? '4px solid var(--success-color)' : '4px solid var(--danger-color)'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', textTransform: 'uppercase', fontSize: '0.9rem', color: 'var(--text-secondary)', letterSpacing: '1px' }}>{b.username}</h3>
              <div style={{ 
                fontSize: '1.75rem', 
                fontWeight: 'bold', 
                color: b.balance >= 0 ? 'var(--success-color)' : 'var(--danger-color)' 
              }}>
                {b.balance >= 0 ? '+' : '-'}₹{Math.abs(b.balance).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {b.balance >= 0 ? 'Owed to them' : 'Owes others'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Debt Settlement Minimization */}
      <div className="glass-card">
        <h2 style={{ margin: '0 0 1.5rem 0' }}>Debt Settlement Minimization</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {balancesData.simplifiedDebts.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>All settled up!</div>
          ) : (
            balancesData.simplifiedDebts.map((debt, idx) => (
              <div key={idx} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '1rem 1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: 'var(--danger-color)' }}>{debt.fromName}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>→</span>
                  <span style={{ color: 'var(--success-color)' }}>{debt.toName}</span>
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary-color)' }}>
                  ₹{Number(debt.amount).toLocaleString('en-IN')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default DashboardView;
