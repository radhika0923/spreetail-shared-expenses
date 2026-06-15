import { useState, useEffect } from 'react';

const GroupTimelinesView = ({ user, groupId }) => {
  const [members, setMembers] = useState([]);
  const [groupName, setGroupName] = useState('');
  
  // Create group form state
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  useEffect(() => {
    if (!groupId) return;
    fetch(`http://localhost:5000/api/groups/user/${user.id}`)
      .then(res => res.json())
      .then(data => {
        const group = data.find(g => g.id.toString() === groupId.toString());
        if (group) setGroupName(group.name);
      });

    fetch(`http://localhost:5000/api/groups/${groupId}/members`)
      .then(res => res.json())
      .then(data => setMembers(data));
  }, [groupId, user.id]);

  const handleCreateGroup = (e) => {
    e.preventDefault();
    alert('Group creation backend endpoint not fully implemented in MVP. You can seed it directly in DB.');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      
      {/* Group Membership Timelines */}
      <div className="glass-card">
        <h2 style={{ margin: '0 0 0.5rem 0' }}>Group Membership Timelines</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Define active membership date ranges for flatmates to ensure expenses are split correctly over time.
        </p>
        
        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{groupName}</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            {groupName === 'Goa Trip 2026' ? 'Vacation tracking context' : 'Our shared flat expenses'}
          </p>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '1px' }}>MEMBERS & DATES:</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <span style={{ fontWeight: '500' }}>{m.username}</span>
                <span style={{ color: 'var(--primary-color)', fontSize: '0.9rem' }}>
                  {m.joined_date ? m.joined_date : '2026-02-01'} to {m.left_date ? m.left_date : 'Present'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create New Group */}
      <div className="glass-card">
        <h2 style={{ margin: '0 0 1.5rem 0' }}>Create New Group</h2>
        
        <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div>
            <label>Group Name</label>
            <input type="text" className="form-control" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. Flat 4B" />
          </div>

          <div>
            <label>Description</label>
            <input type="text" className="form-control" value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} placeholder="e.g. Monthly rent and household utilities" />
          </div>

          <div>
            <label style={{ marginBottom: '1rem', display: 'block' }}>Select Group Members & Dates:</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Dummy check boxes for UI visual match */}
              {['Aisha', 'Rohan', 'Priya', 'Meera', 'Dev'].map(name => (
                <label key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" style={{ accentColor: 'var(--primary-color)', width: '16px', height: '16px' }} />
                  {name}
                </label>
              ))}
            </div>
          </div>

        </form>
      </div>

    </div>
  );
};

export default GroupTimelinesView;
