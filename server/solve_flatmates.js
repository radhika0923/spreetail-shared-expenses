const { parseCSV } = require('./services/csvParser');

async function run() {
  const { results } = await parseCSV('./uploads/09207c454fa69aa8da73ae56fa292d48');
  
  const payersToTry = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'];
  
  for (const payer of payersToTry) {
    const balances = { 'Aisha': 0, 'Rohan': 0, 'Priya': 0, 'Meera': 0, 'Sam': 0, 'Dev': 0 };
    
    for (const r of results) {
      if (r.targetGroupId !== 1) continue; // Flatmates only
      
      if (r.id === 4) continue; // Discard row 6 (dinner - marina bites duplicate)
      
      let amount = r.parsedAmount;
      if (r.anomalyFlags.foreignCurrency) amount = amount * 83;
      
      let paidBy = r.parsedPaidBy;
      if (r.anomalyFlags.missingPayer && r.id === 12) paidBy = payer; // Row 13 (id 12)
      
      if (r.isSettlement) {
         // settlements not computed manually here, but let's check
         if (r.id === 13) { // Rohan paid Aisha back 5000
           balances['Rohan'] += 5000;
           balances['Aisha'] -= 5000;
         }
         continue;
      }
      
      let splitType = r.parsedSplitType;
      let splitWith = r.split_with ? r.split_with.split(';') : [];
      if (splitWith.length === 0) splitWith = [paidBy];
      
      balances[paidBy] += amount;
      
      if (splitType === 'percentage' && r.anomalyFlags.percentageMismatch) {
        // Normalize
        const props = r.anomalyFlags.percentageMismatch.proportional;
        for (const [uname, pct] of Object.entries(props)) {
           if (balances[uname] !== undefined) balances[uname] -= amount * (pct / 100);
        }
      } else if (splitType === 'share' && r.split_details) {
        // e.g. Row 35: Aisha 2; Rohan 1; Priya 1
        const details = r.split_details.split(';');
        let totalShares = 0;
        const shares = {};
        details.forEach(d => {
           let match = d.trim().match(/([\w\s]+)\s+([\d.]+)/);
           if (match) {
             const uname = match[1];
             const val = parseFloat(match[2]);
             totalShares += val;
             shares[uname] = val;
           }
        });
        for (const [uname, s] of Object.entries(shares)) {
           if (balances[uname] !== undefined) balances[uname] -= amount * (s / totalShares);
        }
      } else {
        // Equal
        // Filter out out-of-bounds?
        let finalSplits = [...splitWith];
        if (r.anomalyFlags.outOfBounds) {
          // Assume user EXCLUDED them (keepMembers = false)
          finalSplits = finalSplits.filter(n => !r.anomalyFlags.outOfBounds.includes(n));
        }
        
        // External members
        if (r.anomalyFlags.externalMembers) {
          // Assume Reassign to Host
          r.anomalyFlags.externalMembers.forEach(ext => {
             finalSplits = finalSplits.filter(n => n !== ext);
             if (!finalSplits.includes(paidBy)) finalSplits.push(paidBy);
          });
        }

        const perPerson = amount / finalSplits.length;
        for (const uname of finalSplits) {
           if (balances[uname] !== undefined) balances[uname] -= perPerson;
        }
      }
    }
    
    // Check if Aisha matches 82118.94
    if (Math.abs(balances['Aisha'] - 82118.94) < 1) {
      console.log(`MATCH FOUND! Payer for Row 13 is: ${payer}`);
      console.log(balances);
    }
  }
}

run();
