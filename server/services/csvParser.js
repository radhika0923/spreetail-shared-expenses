const fs = require('fs');
const csv = require('csv-parser');
const { db } = require('../database');

// Normalizes name
const normalizeName = (name) => {
  if (!name) return null;
  if (name.toLowerCase().includes('kabir')) return 'Kabir';
  return name.trim().split(' ')[0].charAt(0).toUpperCase() + name.trim().split(' ')[0].slice(1).toLowerCase();
};

// Word-token overlap checking
const getTokens = (str) => {
  if (!str) return [];
  const stopWords = new Set(['at', 'the', 'for', 'a', 'an', 'in', 'on', 'and', '-', '&']);
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 0 && !stopWords.has(w));
};

const tokenOverlap = (str1, str2) => {
  const t1 = getTokens(str1);
  const t2 = getTokens(str2);
  let overlap = 0;
  t1.forEach(t => { if (t2.includes(t)) overlap++; });
  return overlap >= Math.min(t1.length, t2.length, 2); // simplistic overlap threshold
};

const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    
    // Fetch all groups and members globally
    db.all('SELECT * FROM groups', [], (err, groups) => {
      if (err) return reject(err);
      
      const flatmatesGroup = groups.find(g => g.id === 1);
      const goaGroup = groups.find(g => g.id === 2);
      
      db.all(`
        SELECT u.id, u.username, gm.joined_date, gm.left_date, gm.group_id 
        FROM users u 
        JOIN group_members gm ON u.id = gm.user_id`, [], (err, dbMembersAll) => {
        if (err) return reject(err);

        // For the UI, we just need unique users to resolve missing payers
        const uniqueMembersMap = {};
        dbMembersAll.forEach(m => uniqueMembersMap[m.username] = m);
        const dbMembers = Object.values(uniqueMembersMap);

        const results = [];
        const anomalies = [];
        const duplicateGroups = {}; 
        let rowIndex = 0;
        
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => {
            let r = { ...row, originalRow: { ...row }, id: rowIndex };
            r.anomalyFlags = {}; 
            // --- Global Routing ---
            const excelRow = rowIndex + 2;
            const isGoaTripRow = (excelRow >= 19 && excelRow <= 27);
            r.targetGroupId = isGoaTripRow ? goaGroup.id : flatmatesGroup.id;
            // -------------------------------
            
            // 1. Ambiguous & Inconsistent Dates
            r.parsedDate = row.date;
            if (row.date) {
               // Inconsistent Date (Mar-14)
               let parts = row.date.split('-');
               const months = { 'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12' };
               if (parts.length === 2 && months[parts[0]]) {
                  r.parsedDate = `2026-${months[parts[0]]}-${parts[1].padStart(2, '0')}`;
                  r.anomalyFlags.inconsistentDate = { original: row.date, fixed: r.parsedDate };
               } else if (parts.length === 3) {
                 const p0 = parseInt(parts[0], 10);
                 const p1 = parseInt(parts[1], 10);
                 if (p0 <= 12 && p1 <= 12 && p0 !== p1) {
                    r.anomalyFlags.ambiguousDate = true;
                    // Default to DD-MM-YYYY
                    r.parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                 } else {
                    if (parts[0].length === 2) r.parsedDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
                 }
               }
            }

            // 2. Missing Payer & Case Inconsistency
            if (!r.paid_by || r.paid_by.trim() === '') {
                r.anomalyFlags.missingPayer = true;
                r.parsedPaidBy = '';
            } else {
                let nName = normalizeName(r.paid_by);
                if (nName !== r.paid_by) r.anomalyFlags.caseInconsistency = { original: r.paid_by, fixed: nName };
                r.parsedPaidBy = nName;
            }

            // 3. Currency & Numeric Anomalies
            let amountStr = r.amount ? r.amount.replace(/,/g, '').replace(/"/g, '') : '0';
            if (amountStr !== r.amount && r.amount.includes(',')) r.anomalyFlags.formatting = true;
            
            let amount = parseFloat(amountStr);
            if (isNaN(amount)) amount = 0;
            
            let roundedAmount = Math.round(amount * 100) / 100;
            if (roundedAmount !== amount) {
                r.anomalyFlags.precision = { original: r.amount, fixed: roundedAmount };
            }
            r.parsedAmount = roundedAmount;

            if (amount === 0 && r.amount) r.anomalyFlags.zeroAmount = true;
            if (amount < 0) r.anomalyFlags.negativeAmount = true;

            r.parsedCurrency = r.currency ? r.currency.trim().toUpperCase() : 'INR';
            if (!r.currency) r.anomalyFlags.missingCurrency = true;
            if (r.parsedCurrency === 'USD') r.anomalyFlags.foreignCurrency = true;

            // 4. Splitting & Transaction Integrity
            r.parsedSplitType = r.split_type || 'equal';
            r.isSettlement = false;
            
            if (r.description && (r.description.toLowerCase().includes('paid back') || r.description.toLowerCase().includes('deposit')) && !r.split_type) {
                r.isSettlement = true;
                r.anomalyFlags.settlementLoggedAsExpense = true;
            }

            if (r.split_details && r.parsedSplitType === 'equal' && !r.isSettlement) {
                 r.anomalyFlags.redundantDetails = true;
                 r.parsedSplitType = 'share'; // We use shares if they exist
            }

            // Percentage Split Mismatch
            if (r.parsedSplitType === 'percentage' && r.split_details) {
                let details = r.split_details.split(';');
                let totalPct = 0;
                const weights = {};
                details.forEach(d => {
                   let match = d.trim().match(/([\w\s]+)\s+([\d.]+)/);
                   if (match) {
                     const uname = normalizeName(match[1]);
                     const val = parseFloat(match[2]);
                     totalPct += val;
                     weights[uname] = val;
                   }
                });
                if (Math.abs(totalPct - 100) > 0.01) {
                   r.anomalyFlags.percentageMismatch = {
                     total: totalPct,
                     weights,
                     proportional: Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, (v/totalPct)*100]))
                   };
                }
            }

            // Membership Timeline & External Members
            let splitWith = r.split_with ? r.split_with.split(';').map(n => normalizeName(n)) : [];
            const outOfBounds = [];
            const external = [];
            
            splitWith.forEach(name => {
              // Only check members that exist IN THIS TARGET GROUP
              const mem = dbMembersAll.find(m => m.username === name && m.group_id === r.targetGroupId);
              if (!mem) {
                if (name !== 'Sam' && name !== 'Meera' && name !== 'Aisha' && name !== 'Rohan' && name !== 'Priya' && name !== 'Dev') {
                  external.push(name);
                }
              } else if (!r.isSettlement && r.parsedDate) {
                 const pDate = new Date(r.parsedDate);
                 const jDate = mem.joined_date ? new Date(mem.joined_date) : null;
                 const lDate = mem.left_date ? new Date(mem.left_date) : null;
                 if ((jDate && pDate < jDate) || (lDate && pDate > lDate)) {
                   outOfBounds.push(name);
                 }
              }
            });
            
            if (outOfBounds.length > 0) r.anomalyFlags.outOfBounds = outOfBounds;
            if (external.length > 0) r.anomalyFlags.externalMembers = external;
            
            r.split_with = splitWith.join(';');

            // Duplicate Grouping (token overlap on same day/amount/currency)
            let hash = `${r.parsedDate}_${r.parsedAmount}_${r.parsedCurrency}`;
            if (!duplicateGroups[hash]) duplicateGroups[hash] = [];
            
            const groupMatch = duplicateGroups[hash].find(existingRow => tokenOverlap(r.description, existingRow.description));
            
            if (groupMatch) {
               if (!r.anomalyFlags.duplicateGroup) {
                  r.anomalyFlags.duplicateGroup = `dup_${hash}`;
                  groupMatch.anomalyFlags.duplicateGroup = `dup_${hash}`;
               }
            } else {
               duplicateGroups[hash].push(r);
            }

            r.hasAnomalies = Object.keys(r.anomalyFlags).length > 0;
            results.push(r);
            rowIndex++;
          })
          .on('end', () => {
             results.forEach(r => { if (r.hasAnomalies) anomalies.push(r); });
             resolve({ results, anomalies, dbMembers });
          })
      });
    });
  });
};

module.exports = { parseCSV };
