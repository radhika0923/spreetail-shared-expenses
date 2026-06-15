import { useState, useEffect } from 'react';
import GroupView from './GroupView';
import { LayoutDashboard, FileBarChart2 } from 'lucide-react';

const Dashboard = ({ user, setAuth }) => {
  const [groups, setGroups] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  
  const [showGlobalAudit, setShowGlobalAudit] = useState(false);
  const [globalAuditData, setGlobalAuditData] = useState({ groupedLedger: {}, globalFinalBalance: 0 });

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/groups/user/${user.id}`)
      .then(res => res.json())
      .then(data => {
        setGroups(data);
        if (data.length > 0) setActiveTab(data[0].id);
      })
      .catch(err => console.error(err));
  }, [user.id]);

  const handleGlobalAudit = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/groups/user/${user.id}/audit`);
      const data = await res.json();
      setGlobalAuditData(data);
      setShowGlobalAudit(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
          <LayoutDashboard size={28} color="var(--primary-color)" /> Welcome, {user.username}
        </h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-primary" onClick={handleGlobalAudit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--primary-color)' }}>
             <FileBarChart2 size={18} /> My Consolidated Audit
          </button>
          <button onClick={() => window.location.href = '/upload'} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'transparent', border: '1px solid var(--primary-color)' }}>
             Import CSV
          </button>
          <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); setAuth(null); }} className="btn btn-danger">
            Logout
          </button>
        </div>
      </div>

      {/* Group Switching Tabs */}
      {groups.length > 0 ? (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--surface-border)', gap: '1rem', overflowX: 'auto' }}>
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setActiveTab(g.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '1rem 2rem',
                  fontSize: '1.1rem',
                  fontWeight: activeTab === g.id ? 'bold' : 'normal',
                  color: activeTab === g.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === g.id ? '3px solid var(--primary-color)' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                [{g.name}]
              </button>
            ))}
          </div>
          
          <div style={{ marginTop: '2rem' }}>
             {activeTab && <GroupView user={user} groupId={activeTab} />}
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
           <h3>No tracking contexts found.</h3>
           <p>Contact an administrator or seed the database.</p>
        </div>
      )}

      {/* Global Audit View Modal */}
      {showGlobalAudit && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '2rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Consolidated Audit Trail</h2>
              <button onClick={() => setShowGlobalAudit(false)} className="btn btn-danger" style={{ padding: '0.25rem 0.75rem' }}>Close</button>
            </div>
            
            {Object.keys(globalAuditData.groupedLedger).length === 0 ? (
               <p>No transactions found.</p>
            ) : (
               Object.entries(globalAuditData.groupedLedger).map(([groupName, data]) => (
                  <div key={groupName} style={{ marginBottom: '2rem' }}>
                     <h3 style={{ color: 'var(--primary-color)' }}>{groupName} {groupName === 'Flatmates' ? '(Living Expenses)' : '(Vacation Transactions)'}</h3>
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
                           {data.ledger.length === 0 ? (
                              <tr><td colSpan="5" style={{ textAlign: 'center' }}>No transactions in this context.</td></tr>
                           ) : data.ledger.map((item, idx) => (
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
                             <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold' }}>Context Final Balance:</td>
                             <td style={{ fontWeight: 'bold', color: data.finalBalance > 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                                {data.finalBalance} INR
                             </td>
                           </tr>
                         </tbody>
                       </table>
                     </div>
                  </div>
               ))
            )}
            
            <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '2px dashed var(--surface-border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
               <h3 style={{ margin: 0 }}>Global Net Balance across all contexts:</h3>
               <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: globalAuditData.globalFinalBalance > 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                  {globalAuditData.globalFinalBalance > 0 ? '+' : ''}{globalAuditData.globalFinalBalance} INR
               </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
