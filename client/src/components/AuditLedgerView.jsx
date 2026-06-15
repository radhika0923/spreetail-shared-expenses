import { useState, useEffect } from 'react';

const AuditLedgerView = ({ user, groupId }) => {
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState(user.id.toString());
  const [auditData, setAuditData] = useState({ ledger: [], finalBalance: 0 });

  useEffect(() => {
    if (!groupId) return;
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/groups/${groupId}/members`)
      .then(res => res.json())
      .then(data => {
        setMembers(data);
        if (!data.find(m => m.id.toString() === selectedMemberId)) {
          setSelectedMemberId(data[0]?.id.toString() || '');
        }
      });
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !selectedMemberId) return;
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/groups/${groupId}/audit/${selectedMemberId}`)
      .then(res => res.json())
      .then(data => setAuditData(data))
      .catch(err => console.error(err));
  }, [groupId, selectedMemberId]);

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0 }}>Individual Balance Ledger</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Select Member:</span>
          <select 
            value={selectedMemberId} 
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="form-control"
            style={{ backgroundColor: 'rgba(255,255,255,0.03)', width: '200px' }}
          >
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.username}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>DATE</th>
              <th>DESCRIPTION</th>
              <th>TYPE</th>
              <th>TOTAL AMOUNT</th>
              <th>PAID BY</th>
              <th>MY SHARE</th>
              <th>BALANCE CHANGE</th>
              <th>RUNNING BALANCE</th>
            </tr>
          </thead>
          <tbody>
            {auditData.ledger.map((item, idx) => (
              <tr key={idx}>
                <td>{item.date}</td>
                <td>
                  {item.description}
                  {item.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Note: {item.notes}</div>}
                </td>
                <td>
                  <span className={`badge ${item.type === 'expense' ? 'badge-primary' : 'badge-success'}`}>
                    {item.type}
                  </span>
                </td>
                <td>₹{Number(item.totalAmount).toLocaleString('en-IN')}</td>
                <td>{item.paidBy}</td>
                <td>{item.myShare > 0 ? `₹${Number(item.myShare).toLocaleString('en-IN')}` : '-'}</td>
                <td style={{ color: item.impact >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 'bold' }}>
                  {item.impact >= 0 ? '+' : '-'}₹{Math.abs(item.impact).toLocaleString('en-IN')}
                </td>
                <td style={{ color: 'var(--primary-color)' }}>₹{Number(item.runningBalance).toLocaleString('en-IN')}</td>
              </tr>
            ))}
            {auditData.ledger.length === 0 && (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLedgerView;
