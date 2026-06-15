import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, AlertCircle, CheckCircle2, FileText, Settings } from 'lucide-react';

const CsvUploader = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null); // { results, anomalies, dbMembers }
  const [error, setError] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(83.0);
  const [successLogs, setSuccessLogs] = useState(null);
  
  // resolutions object mapping row id to user decisions
  // shape: { [rowId]: { skip: bool, payer: str, dateMode: 'parsed'|'override', keepMembers: bool, reassignExternalTo: str, normalizePct: bool, duplicateDecision: 'keep'|'discard' } }
  const [resolutions, setResolutions] = useState({});

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
            dateMode: 'parsed', // or 'original' if ambiguous override
            keepMembers: false, // outOfBounds
            reassignExternalTo: 'host', // external members
            normalizePct: true, // percentage mismatch
            duplicateDecision: 'keep', // keep or discard
            useOriginalAmount: false
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

  // Check if all blocking issues are resolved
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
        if (res.duplicateDecision === 'discard') {
           logs.push(`Row ${row.id + 2} ("${row.description}"): Deleted as duplicate conflict.`);
           return;
        }
        
        let exp = { ...row };
        
        // Apply resolutions
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

        // Apply external members reassign/temp
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

        // Apply out of bounds members (Keep/Exclude)
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

  return (
    <div className="glass-card" style={{ maxWidth: '100%', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <FileText /> CSV Ingestion Wizard
        </h2>
      </div>

      {successLogs ? (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '3rem', borderRadius: 'var(--radius-lg)', textAlign: 'center', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.05)' }}>
             <CheckCircle2 size={64} color="var(--success-color)" style={{ marginBottom: '1rem' }} />
             <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--success-color)' }}>Import Succeeded!</h2>
             <p style={{ color: 'var(--text-secondary)' }}>Successfully parsed the raw data file, isolated the ledgers, and minimized all group debts.</p>
          </div>
          
          <h3 style={{ margin: '0 0 1rem 0' }}>Ingestion Report (Anomaly Resolution Log)</h3>
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
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <div style={{ border: '2px dashed var(--surface-border)', borderRadius: 'var(--radius-lg)', padding: '4rem 2rem', backgroundColor: 'rgba(0,0,0,0.2)', marginBottom: '1.5rem', cursor: 'pointer' }} onClick={() => document.getElementById('file-upload').click()}>
            <Upload size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ margin: 0 }}>Select CSV File</h3>
            <input id="file-upload" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>
          {file && <div style={{ marginBottom: '1.5rem', color: 'var(--success-color)' }}>{file.name}</div>}
          <button className="btn btn-primary" onClick={handleUpload} disabled={!file || loading}>{loading ? 'Analyzing...' : 'Run Validator Engine'}</button>
          {error && <div style={{ color: 'var(--danger-color)', marginTop: '1rem' }}>{error}</div>}
        </div>
      ) : (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
             <div>
                <h3 style={{ margin: 0 }}>Review Panel</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                   Found {data.results.length} valid rows in context. {data.anomalies.length} have potential anomalies.
                </p>
             </div>
             <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <Settings size={18} color="var(--primary-color)" />
                   <label style={{ fontSize: '0.875rem' }}>USD Rate (₹):</label>
                   <input type="number" step="0.1" value={exchangeRate} onChange={e => setExchangeRate(parseFloat(e.target.value))} className="form-input" style={{ width: '80px', padding: '0.25rem' }} />
                </div>
                <button className="btn btn-success" onClick={handleImport} disabled={!isReadyToImport()}>Confirm & Import</button>
             </div>
          </div>
          
          <table style={{ width: '100%', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <th style={{ width: '60px' }}>Import</th>
                <th>Date</th>
                <th>Description</th>
                <th>Payer</th>
                <th>Amount</th>
                <th>Resolutions & Flags</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map(row => {
                 const res = resolutions[row.id];
                 const af = row.anomalyFlags;
                 const isDuplicate = af.duplicateGroup;
                 const isError = af.missingPayer;
                 
                 return (
                  <tr key={row.id} style={{ opacity: res.skip ? 0.4 : 1, borderLeft: isError ? '4px solid var(--danger-color)' : (row.hasAnomalies ? '4px solid var(--warning-color)' : '4px solid transparent') }}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={!res.skip} onChange={(e) => updateRes(row.id, 'skip', !e.target.checked)} />
                    </td>
                    <td>
                       {row.parsedDate}
                       {af.ambiguousDate && (
                          <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--warning-color)' }}>
                             <label><input type="radio" checked={res.dateMode==='parsed'} onChange={()=>updateRes(row.id, 'dateMode', 'parsed')} /> DD-MM</label>
                             <br/>
                             <label><input type="radio" checked={res.dateMode==='override'} onChange={()=>updateRes(row.id, 'dateMode', 'override')} /> MM-DD</label>
                          </div>
                       )}
                    </td>
                    <td>
                       {row.description}
                       {af.settlementLoggedAsExpense && <div style={{ fontSize: '0.75rem', color: 'var(--warning-color)' }}>Reclassified as Settlement</div>}
                    </td>
                    <td>
                       {af.missingPayer ? (
                          <select value={res.payer} onChange={e => updateRes(row.id, 'payer', e.target.value)} style={{ borderColor: !res.payer ? 'var(--danger-color)' : '' }} className="form-input">
                             <option value="">Select Payer...</option>
                             {data.dbMembers.map(m => <option key={m.username} value={m.username}>{m.username}</option>)}
                          </select>
                       ) : row.parsedPaidBy}
                    </td>
                    <td>
                       {row.parsedCurrency} {res.useOriginalAmount ? row.amount : row.parsedAmount}
                       {af.foreignCurrency && <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)' }}>(₹{(row.parsedAmount * exchangeRate).toFixed(2)})</div>}
                       {af.precision && (
                          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                             <label><input type="checkbox" checked={res.useOriginalAmount} onChange={(e)=>updateRes(row.id, 'useOriginalAmount', e.target.checked)} /> Keep {row.amount}</label>
                          </div>
                       )}
                    </td>
                    <td>
                       {row.hasAnomalies ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                             {af.outOfBounds && (
                                <div style={{ color: 'var(--danger-color)' }}>Timeline Warning: {af.outOfBounds.join(', ')} <br/>
                                   <label><input type="radio" checked={!res.keepMembers} onChange={()=>updateRes(row.id, 'keepMembers', false)} /> Exclude</label>
                                   <label style={{marginLeft:'8px'}}><input type="radio" checked={res.keepMembers} onChange={()=>updateRes(row.id, 'keepMembers', true)} /> Keep</label>
                                </div>
                             )}
                             {af.externalMembers && (
                                <div style={{ color: 'var(--warning-color)' }}>External: {af.externalMembers.join(', ')} <br/>
                                   <label><input type="radio" checked={res.reassignExternalTo==='host'} onChange={()=>updateRes(row.id, 'reassignExternalTo', 'host')} /> Reassign to Host</label>
                                   <label style={{marginLeft:'8px'}}><input type="radio" checked={res.reassignExternalTo==='temp'} onChange={()=>updateRes(row.id, 'reassignExternalTo', 'temp')} /> Add Temp</label>
                                </div>
                             )}
                             {af.percentageMismatch && (
                                <div style={{ color: 'var(--danger-color)' }}>Pct Sums to {af.percentageMismatch.total}% <br/>
                                   <label><input type="checkbox" checked={res.normalizePct} onChange={e=>updateRes(row.id, 'normalizePct', e.target.checked)} /> Auto-Normalize to 100%</label>
                                </div>
                             )}
                             {isDuplicate && (
                                <div style={{ color: 'var(--warning-color)', border: '1px solid var(--warning-color)', padding: '4px', borderRadius: '4px' }}>
                                   Duplicate Detected ({af.duplicateGroup}) <br/>
                                   <label><input type="radio" checked={res.duplicateDecision==='keep'} onChange={()=>updateRes(row.id, 'duplicateDecision', 'keep')} /> Keep</label>
                                   <label style={{marginLeft:'8px'}}><input type="radio" checked={res.duplicateDecision==='discard'} onChange={()=>updateRes(row.id, 'duplicateDecision', 'discard')} /> Discard</label>
                                </div>
                             )}
                          </div>
                       ) : <span style={{ color: 'var(--success-color)' }}>Clean</span>}
                    </td>
                  </tr>
                 );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CsvUploader;
