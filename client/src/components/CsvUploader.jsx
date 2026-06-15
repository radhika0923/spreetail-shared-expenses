import { useState, useEffect } from 'react';
import { Upload, AlertTriangle, CheckCircle2, FileText, Settings, AlertCircle, ChevronDown } from 'lucide-react';

const CsvUploader = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null); // { results, anomalies, dbMembers }
  const [error, setError] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(83.0);
  const [successLogs, setSuccessLogs] = useState(null);
  const [groups, setGroups] = useState([]);
  
  const [resolutions, setResolutions] = useState({});

  useEffect(() => {
    fetch('http://localhost:5000/api/groups')
      .then(res => res.json())
      .then(data => setGroups(data))
      .catch(console.error);
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`http://localhost:5000/api/expenses/global/upload`, {
        method: 'POST', body: formData
      });
      if (!response.ok) throw new Error('Upload failed');
      
      const responseData = await response.json();
      setData(responseData);
      
      const initialResolutions = {};
      responseData.results.forEach(row => {
         initialResolutions[row.id] = {
            skip: false,
            payer: row.anomalyFlags.missingPayer ? '' : row.parsedPaidBy,
            dateMode: 'parsed', 
            keepMembers: false, 
            reassignExternalTo: 'host', 
            normalizePct: true, 
            duplicateDecision: 'keep', 
            useOriginalAmount: false,
            targetGroupId: row.targetGroupId || (groups.length > 0 ? groups[0].id : '')
         };
      });
      setResolutions(initialResolutions);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRes = (id, key, val) => setResolutions(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }));

  const isReadyToImport = () => {
    if (!data) return false;
    for (let r of data.results) {
       const res = resolutions[r.id];
       if (res.skip) continue;
       if (r.anomalyFlags.missingPayer && !res.payer) return false;
    }
    return true;
  };

  const handleImport = async () => {
    try {
      const finalExpenses = [];
      const logs = [];
      
      data.results.forEach(row => {
        const res = resolutions[row.id];
        if (res.skip) return;
        if (row.anomalyFlags.duplicateGroup && res.duplicateDecision === 'discard') {
           logs.push(`Row ${row.id + 2} ("${row.description}"): Deleted as duplicate conflict.`);
           return;
        }
        
        let exp = { ...row, targetGroupId: res.targetGroupId };
        
        if (row.anomalyFlags.ambiguousDate || row.anomalyFlags.inconsistentDate) {
           logs.push(`Row ${row.id + 2} ("${row.description}"): Ambiguous date resolved to default DD-MM-YYYY (${row.parsedDate}).`);
        }
        
        if (row.anomalyFlags.formatting || row.anomalyFlags.precision) {
           logs.push(`Row ${row.id + 2} ("${row.description}"): Cleaned currency formatting and numeric precision.`);
        }
        
        if (res.useOriginalAmount) exp.parsedAmount = parseFloat(row.amount.replace(/,/g, '').replace(/"/g, '')) || 0;
        if (row.anomalyFlags.ambiguousDate && res.dateMode === 'override') exp.parsedDate = row.date;
        
        if (row.anomalyFlags.missingPayer) {
           exp.parsedPaidBy = res.payer;
           logs.push(`Row ${row.id + 2} ("${row.description}"): Missing payer dynamically assigned to ${res.payer}.`);
        }
        
        if (row.anomalyFlags.percentageMismatch && res.normalizePct) {
           exp.normalizedWeights = row.anomalyFlags.percentageMismatch.proportional;
        }

        if (row.anomalyFlags.foreignCurrency) {
           exp.exchangeRateApplied = exchangeRate;
           logs.push(`Row ${row.id + 2} ("${row.description}"): Normalized USD transaction to INR using rate ₹${exchangeRate}.`);
        }

        let finalSplits = row.split_with ? row.split_with.split(';').map(n => n.trim()) : [];
        if (row.anomalyFlags.externalMembers) {
           row.anomalyFlags.externalMembers.forEach(ext => {
              if (res.reassignExternalTo === 'host') {
                 finalSplits = finalSplits.filter(n => n !== ext);
                 if (!finalSplits.includes(exp.parsedPaidBy)) finalSplits.push(exp.parsedPaidBy);
                 logs.push(`Row ${row.id + 2} ("${row.description}"): Reassigned external member (${ext}) liability to Host (${exp.parsedPaidBy}).`);
              }
           });
        }

        if (row.anomalyFlags.outOfBounds && !res.keepMembers) {
           row.anomalyFlags.outOfBounds.forEach(oob => {
              finalSplits = finalSplits.filter(n => n !== oob);
              logs.push(`Row ${row.id + 2} ("${row.description}"): Excluded ${oob} from calculation due to timeline bounds violation.`);
           });
        }
        
        if (row.anomalyFlags.settlementLoggedAsExpense) {
           logs.push(`Row ${row.id + 2} ("${row.description}"): Reclassified as direct cash settlement.`);
        }
        
        exp.split_with = finalSplits.join(';');
        finalExpenses.push(exp);
      });

      const response = await fetch(`http://localhost:5000/api/expenses/global/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: finalExpenses })
      });
      
      if (response.ok) {
        setSuccessLogs(logs);
      } else {
        setError('Import failed');
      }
    } catch (err) { setError(err.message); }
  };

  // Pre-process duplicate groups for UI
  const dupGroups = {};
  if (data) {
    data.results.forEach(r => {
      if (r.anomalyFlags.duplicateGroup) {
        if (!dupGroups[r.anomalyFlags.duplicateGroup]) dupGroups[r.anomalyFlags.duplicateGroup] = [];
        dupGroups[r.anomalyFlags.duplicateGroup].push(r);
      }
    });
  }

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <div className="glass-card" style={{ marginBottom: '2rem', padding: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
          CSV Ingestion Wizard
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem 0', fontSize: '0.9rem' }}>
          Import `expenses_export.csv` directly. Our validator detects and surfaces 12+ types of deliberate anomalies so you can review and resolve them before saving.
        </p>

        {successLogs ? (
          <div>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '2rem', borderRadius: 'var(--radius-lg)', textAlign: 'center', marginBottom: '2rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
               <CheckCircle2 size={48} color="var(--success-color)" style={{ marginBottom: '1rem' }} />
               <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--success-color)' }}>Import Succeeded!</h2>
               <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Successfully parsed the raw data file, isolated the ledgers, and minimized all group debts.</p>
            </div>
            <h3 style={{ margin: '0 0 1rem 0' }}>Ingestion Report</h3>
            <div style={{ backgroundColor: '#0a0a0f', padding: '1.5rem', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '400px', overflowY: 'auto' }}>
               {successLogs.length === 0 ? <span style={{ color: 'var(--success-color)' }}>No anomalies found. All rows clean.</span> : null}
               {successLogs.map((log, i) => (
                  <div key={i} style={{ marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.75rem' }}>{log}</div>
               ))}
            </div>
            <div style={{ textAlign: 'right', marginTop: '1.5rem' }}>
               <button className="btn btn-primary" onClick={() => { setSuccessLogs(null); setData(null); setFile(null); }}>Import Another File</button>
            </div>
          </div>
        ) : !data ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ border: '2px dashed var(--surface-border)', borderRadius: 'var(--radius-lg)', padding: '4rem 2rem', backgroundColor: 'rgba(0,0,0,0.2)', marginBottom: '1.5rem', cursor: 'pointer', transition: 'border-color 0.2s' }} onClick={() => document.getElementById('file-upload').click()}>
              <Upload size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Select CSV File</h3>
              <input id="file-upload" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>
            {file && <div style={{ marginBottom: '1.5rem', color: 'var(--success-color)', fontWeight: '500' }}>Selected: {file.name}</div>}
            <button className="btn btn-primary" onClick={handleUpload} disabled={!file || loading} style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
              {loading ? 'Analyzing...' : 'Run Validator Engine'}
            </button>
            {error && <div style={{ color: 'var(--danger-color)', marginTop: '1rem' }}>{error}</div>}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '2rem' }}>
              <span style={{ color: 'var(--primary-color)', fontWeight: '600' }}>Reviewing {data.results.length} CSV Rows</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                 <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>USD Conversion Rate (₹ per $):</span>
                 <input type="number" step="0.1" value={exchangeRate} onChange={e => setExchangeRate(parseFloat(e.target.value))} style={{ backgroundColor: '#111827', border: '1px solid var(--surface-border)', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px', width: '80px', outline: 'none' }} />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>Detected Data Anomalies ({data.anomalies.length} total)</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Please confirm policies and select resolutions where required.</p>
            </div>

            {/* DUPLICATES SECTION */}
            {Object.keys(dupGroups).length > 0 && (
              <div style={{ marginBottom: '3rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>Duplicate & Conflict Resolution</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>We detected overlapping events on the same day. Please select which records to retain.</p>
                
                {Object.values(dupGroups).map((group, idx) => (
                  <div key={idx} style={{ backgroundColor: '#0f172a', border: '1px solid var(--danger-color)', borderLeft: '4px solid var(--danger-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <span style={{ fontWeight: '500' }}>Duplicate / Conflict Entry Conflict</span>
                      <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>High Severity</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                      Conflicting records for the same event: {group.map(r => `"${r.description}" (paid by ${r.parsedPaidBy})`).join(' vs ')}
                    </div>
                    
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '6px' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.75rem', fontWeight: '500' }}>Resolution Action:</div>
                      
                      {group.map((r, i) => (
                        <label key={`keep-${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input type="radio" name={`dup-${idx}`} checked={resolutions[r.id]?.duplicateDecision === 'keep' && group.every((other, j) => i===j || resolutions[other.id]?.duplicateDecision === 'discard')} 
                            onChange={() => {
                              group.forEach((other, j) => updateRes(other.id, 'duplicateDecision', i===j ? 'keep' : 'discard'));
                            }} 
                            style={{ accentColor: 'var(--primary-color)' }}
                          />
                          Keep Row {r.id+2} ("{r.description}") and discard others
                        </label>
                      ))}
                      
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input type="radio" name={`dup-${idx}`} checked={group.every(r => resolutions[r.id]?.duplicateDecision === 'keep')} 
                          onChange={() => {
                            group.forEach(r => updateRes(r.id, 'duplicateDecision', 'keep'));
                          }} 
                          style={{ accentColor: 'var(--primary-color)' }}
                        />
                        Keep all records as separate, distinct transactions
                      </label>
                      
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--danger-color)' }}>
                        <input type="radio" name={`dup-${idx}`} checked={group.every(r => resolutions[r.id]?.duplicateDecision === 'discard')} 
                          onChange={() => {
                            group.forEach(r => updateRes(r.id, 'duplicateDecision', 'discard'));
                          }} 
                          style={{ accentColor: 'var(--danger-color)' }}
                        />
                        Discard/Delete all conflicting records
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ALL ROWS SECTION */}
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>CSV Rows & Target Group Destinations</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>Review each expense destination group (auto-classified based on date/members) and resolve anomalies.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {data.results.map(row => {
                  const res = resolutions[row.id];
                  if (!res) return null;
                  const af = row.anomalyFlags;
                  // Don't show duplicates here if they are purely duplicates without other anomalies, or show them anyway for context
                  // Actually, the screenshot shows rows sequentially (#39, #40, #41). We should show all rows.
                  const hasOtherAnomalies = row.hasAnomalies; 
                  const rowBorderColor = (af.missingPayer || af.percentageMismatch) ? 'var(--danger-color)' : (hasOtherAnomalies ? 'var(--warning-color)' : 'rgba(255,255,255,0.05)');
                  const rowAnomCount = Object.keys(af).length - (af.duplicateGroup ? 1 : 0); // Ignore dup here for the badge
                  
                  return (
                    <div key={row.id} style={{ backgroundColor: '#0f172a', border: `1px solid rgba(255,255,255,0.05)`, borderLeft: `3px solid ${rowBorderColor}`, borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '60px 100px 1fr 100px 120px 200px 80px', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', fontSize: '0.9rem' }}>#{row.id + 2}</span>
                        <span style={{ fontSize: '0.85rem' }}>{row.parsedDate}</span>
                        <span style={{ fontSize: '0.9rem' }}>{row.description}
                          {af.settlementLoggedAsExpense && <div style={{ fontSize: '0.75rem', color: 'var(--warning-color)' }}>Reclassified as Settlement</div>}
                        </span>
                        <span style={{ fontSize: '0.9rem', textAlign: 'right' }}>{row.parsedCurrency} {row.amount}</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          {af.missingPayer ? (
                            <select value={res.payer} onChange={e => updateRes(row.id, 'payer', e.target.value)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: '#fff', padding: '0.2rem', borderRadius: '4px', width: '100%', outline: 'none' }}>
                               <option value="">Missing...</option>
                               {data.dbMembers.map(m => <option key={m.username} value={m.username}>{m.username}</option>)}
                            </select>
                          ) : row.parsedPaidBy}
                        </span>
                        
                        <select value={res.targetGroupId} onChange={e => updateRes(row.id, 'targetGroupId', parseInt(e.target.value))} style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.4rem 0.5rem', borderRadius: '4px', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                          {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        
                        <div style={{ textAlign: 'right' }}>
                          {rowAnomCount > 0 ? (
                            <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning-color)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '500', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                              {rowAnomCount} Anom
                            </span>
                          ) : (
                            <span style={{ color: 'var(--success-color)', fontSize: '0.75rem', fontWeight: '500' }}>Clear</span>
                          )}
                        </div>
                      </div>

                      {/* INLINE ANOMALY ALERTS */}
                      {hasOtherAnomalies && (
                        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                           {af.ambiguousDate && (
                              <div style={{ fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--warning-color)', fontWeight: 'bold' }}><AlertTriangle size={12} style={{display:'inline', marginBottom:'-2px'}}/> [MEDIUM] DATE_AMBIGUOUS: </span>
                                <span style={{ color: 'var(--text-secondary)' }}>Date "{row.date}" is ambiguous. Assumed DD-MM-YYYY ({row.parsedDate}).</span>
                                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                     <input type="radio" checked={res.dateMode==='parsed'} onChange={()=>updateRes(row.id, 'dateMode', 'parsed')} style={{accentColor: 'var(--primary-color)'}}/> 
                                     {row.parsedDate} (DD-MM-YYYY)
                                   </label>
                                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                     <input type="radio" checked={res.dateMode==='override'} onChange={()=>updateRes(row.id, 'dateMode', 'override')} style={{accentColor: 'var(--primary-color)'}}/> 
                                     MM-DD-YYYY
                                   </label>
                                </div>
                              </div>
                           )}
                           
                           {af.redundantDetails && (
                              <div style={{ fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}><AlertCircle size={12} style={{display:'inline', marginBottom:'-2px'}}/> [LOW] EQUAL_SPLIT_WITH_DETAILS_INCONSISTENCY: </span>
                                <span style={{ color: 'var(--text-secondary)' }}>Equal split specifies custom details which are redundant.</span>
                              </div>
                           )}

                           {af.outOfBounds && (
                              <div style={{ fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--danger-color)', fontWeight: 'bold' }}><AlertTriangle size={12} style={{display:'inline', marginBottom:'-2px'}}/> [HIGH] TIMELINE_OUT_OF_BOUNDS: </span>
                                <span style={{ color: 'var(--text-secondary)' }}>Members out of active timeline bounds: {af.outOfBounds.join(', ')}</span>
                                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                     <input type="radio" checked={!res.keepMembers} onChange={()=>updateRes(row.id, 'keepMembers', false)} style={{accentColor: 'var(--primary-color)'}}/> Exclude from split
                                   </label>
                                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                     <input type="radio" checked={res.keepMembers} onChange={()=>updateRes(row.id, 'keepMembers', true)} style={{accentColor: 'var(--primary-color)'}}/> Keep anyway
                                   </label>
                                </div>
                              </div>
                           )}
                           
                           {af.percentageMismatch && (
                              <div style={{ fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--danger-color)', fontWeight: 'bold' }}><AlertTriangle size={12} style={{display:'inline', marginBottom:'-2px'}}/> [HIGH] PERCENTAGE_MISMATCH: </span>
                                <span style={{ color: 'var(--text-secondary)' }}>Percentages sum to {af.percentageMismatch.total}%, not 100%.</span>
                                <div style={{ marginTop: '0.5rem' }}>
                                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                     <input type="checkbox" checked={res.normalizePct} onChange={e=>updateRes(row.id, 'normalizePct', e.target.checked)} style={{accentColor: 'var(--primary-color)'}}/> Auto-Normalize to 100% proportionally
                                   </label>
                                </div>
                              </div>
                           )}
                           
                           {af.externalMembers && (
                              <div style={{ fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--warning-color)', fontWeight: 'bold' }}><AlertTriangle size={12} style={{display:'inline', marginBottom:'-2px'}}/> [MEDIUM] EXTERNAL_MEMBERS: </span>
                                <span style={{ color: 'var(--text-secondary)' }}>Unrecognized members in split: {af.externalMembers.join(', ')}</span>
                                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                     <input type="radio" checked={res.reassignExternalTo==='host'} onChange={()=>updateRes(row.id, 'reassignExternalTo', 'host')} style={{accentColor: 'var(--primary-color)'}}/> Reassign liability to Host
                                   </label>
                                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                     <input type="radio" checked={res.reassignExternalTo==='temp'} onChange={()=>updateRes(row.id, 'reassignExternalTo', 'temp')} style={{accentColor: 'var(--primary-color)'}}/> Add as Temporary Members
                                   </label>
                                </div>
                              </div>
                           )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ position: 'sticky', bottom: '0', backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: 'var(--radius-lg)', marginTop: '3rem', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 -10px 30px rgba(0,0,0,0.5)' }}>
              {error && <div style={{ color: 'var(--danger-color)', textAlign: 'right', fontWeight: 'bold' }}>Error: {error}</div>}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
                {!isReadyToImport() && <span style={{ color: 'var(--warning-color)', fontSize: '0.85rem' }}>Please resolve all 'Missing' fields before importing.</span>}
                <button className="btn" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }} onClick={() => { setData(null); setFile(null); setError(null); }}>Back / Cancel</button>
                <button className="btn btn-success" 
                  style={{ 
                    backgroundColor: 'var(--primary-color)', 
                    color: '#fff', 
                    fontWeight: 'bold', 
                    padding: '0.75rem 2rem', 
                    border: 'none',
                    opacity: isReadyToImport() ? 1 : 0.4,
                    cursor: isReadyToImport() ? 'pointer' : 'not-allowed'
                  }} 
                  onClick={handleImport} 
                  disabled={!isReadyToImport()}>
                  Apply Resolutions & Import
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CsvUploader;
