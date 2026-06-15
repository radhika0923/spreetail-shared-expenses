import { useState, useEffect } from 'react';
import { Database, LogOut } from 'lucide-react';
import DashboardView from './DashboardView';
import AuditLedgerView from './AuditLedgerView';
import GroupTimelinesView from './GroupTimelinesView';
import LogExpenseView from './LogExpenseView';
import CsvUploader from './CsvUploader';

const Layout = ({ user, setAuth }) => {
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState('');
  const [activeTab, setActiveTab] = useState('Dashboard');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/groups/user/${user.id}`)
      .then(res => res.json())
      .then(data => {
        setGroups(data);
        if (data.length > 0) setActiveGroupId(data[0].id.toString());
      })
      .catch(err => console.error(err));
  }, [user.id]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuth(null);
  };

  const handleResetDb = () => {
    if (window.confirm("Are you sure you want to reset the database? This is irreversible.")) {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/reset`, { method: 'POST' })
        .then(() => {
          alert('Database reset complete. Please restart server if needed.');
          window.location.reload();
        });
    }
  };

  const renderContent = () => {
    if (!activeGroupId && activeTab !== 'CSV Ingestion Wizard') {
      return <div className="glass-card" style={{ textAlign: 'center', marginTop: '2rem' }}>You are not in any groups yet. Please use the CSV Ingestion Wizard to import data or wait to be added.</div>;
    }

    return (
      <>
        <div style={{ display: activeTab === 'Dashboard' ? 'block' : 'none' }}>
          <DashboardView user={user} groupId={activeGroupId} />
        </div>
        <div style={{ display: activeTab === 'Audit Ledger' ? 'block' : 'none' }}>
          <AuditLedgerView user={user} groupId={activeGroupId} />
        </div>
        <div style={{ display: activeTab === 'CSV Ingestion Wizard' ? 'block' : 'none' }}>
          <CsvUploader />
        </div>
        <div style={{ display: activeTab === 'Group Timelines' ? 'block' : 'none' }}>
          <GroupTimelinesView user={user} groupId={activeGroupId} />
        </div>
        <div style={{ display: activeTab === 'Log Expense / Pay' ? 'block' : 'none' }}>
          <LogExpenseView user={user} groupId={activeGroupId} />
        </div>
      </>
    );
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--primary-color)', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.5rem', color: '#1a1a2e' }}>S</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>Spreetail Shared Expenses</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Splits tracker & Debt Minimization Wizard</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          {/* User Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', padding: '0.25rem 0.25rem 0.25rem 1rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Logged in as: <strong style={{ color: 'var(--text-primary)' }}>{user.username}</strong></span>
            <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-primary)', padding: '0.25rem 0.75rem', borderRadius: '15px', cursor: 'pointer', fontSize: '0.8rem' }}>Logout</button>
          </div>

          {/* Active Group Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Group:</span>
            <select 
              value={activeGroupId} 
              onChange={(e) => setActiveGroupId(e.target.value)}
              className="form-control"
              style={{ width: 'auto', padding: '0.25rem 2rem 0.25rem 0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px', fontSize: '0.9rem' }}
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Reset DB */}
          <button onClick={handleResetDb} style={{ background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
            Reset DB
          </button>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', width: 'fit-content' }}>
        {['Dashboard', 'Audit Ledger', 'CSV Ingestion Wizard', 'Group Timelines', 'Log Expense / Pay'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? 'var(--primary-color)' : 'transparent',
              color: activeTab === tab ? '#1a1a2e' : 'var(--text-secondary)',
              border: 'none',
              padding: '0.6rem 1.2rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? '600' : 'normal',
              transition: 'all 0.2s ease',
              fontSize: '0.9rem'
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Dynamic Content */}
      <main>
        {renderContent()}
      </main>
    </div>
  );
};

export default Layout;
