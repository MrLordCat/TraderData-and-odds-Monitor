// Odds Board Shared - smart incremental updates with smooth animations
// Instead of rebuilding entire table, updates only changed cells

function toNum(v){
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

// ===== Movement tracking with smart animation restart =====
const MOVEMENT_DURATION_MS = 2000;
const previousOdds = new Map(); // broker -> { odds1, odds2 }
const animationTimers = new Map(); // broker -> { timer1, timer2 }

// Track odds change and trigger animation on the cell element directly
function applyOddsChange(cell, broker, side, newValue, oldValue){
  if(!cell) return;
  
  const n = toNum(newValue);
  const o = toNum(oldValue);
  
  // Update text content
  cell.textContent = newValue;
  
  // Check if value actually changed
  if(!Number.isFinite(n) || !Number.isFinite(o) || n === o) return;
  
  const direction = n > o ? 'odds-up' : 'odds-down';
  const timers = animationTimers.get(broker) || {};
  const timerKey = side === 1 ? 'timer1' : 'timer2';
  
  // Cancel previous animation timer
  if(timers[timerKey]) clearTimeout(timers[timerKey]);
  
  // Remove both classes first, then force reflow to restart animation
  cell.classList.remove('odds-up', 'odds-down');
  void cell.offsetWidth; // Force reflow - this restarts CSS animation
  
  // Add new direction class
  cell.classList.add(direction);
  
  // Schedule removal
  timers[timerKey] = setTimeout(()=>{
    cell.classList.remove('odds-up', 'odds-down');
  }, MOVEMENT_DURATION_MS);
  
  animationTimers.set(broker, timers);
}

function calcMidFromLiveNums(nums1, nums2){
  if(!nums1?.length || !nums2?.length) return null;
  const mid1 = (Math.min(...nums1) + Math.max(...nums1)) / 2;
  const mid2 = (Math.min(...nums2) + Math.max(...nums2)) / 2;
  return { mid1, mid2 };
}

// ===== Smart incremental update =====
// Updates existing rows in-place, only adds/removes rows when broker list changes
function updateOddsTable(tbody, records, opts){
  if(!tbody) return { best1: NaN, best2: NaN, liveNums1: [], liveNums2: [] };
  
  const variant = opts?.variant || 'board';
  const isSwapped = opts?.isSwapped || (()=>false);
  
  // Calculate best values
  const liveNums1 = [];
  const liveNums2 = [];
  (records||[]).forEach(r=>{
    try {
      if(!r || r.frozen) return;
      if(!Array.isArray(r.odds) || r.odds.length!==2) return;
      const swappedOn = !!isSwapped(r.broker);
      const v1 = swappedOn ? r.odds[1] : r.odds[0];
      const v2 = swappedOn ? r.odds[0] : r.odds[1];
      const n1 = toNum(v1);
      const n2 = toNum(v2);
      if(Number.isFinite(n1)) liveNums1.push(n1);
      if(Number.isFinite(n2)) liveNums2.push(n2);
    } catch(_){ }
  });
  const best1 = liveNums1.length ? Math.max(...liveNums1) : NaN;
  const best2 = liveNums2.length ? Math.max(...liveNums2) : NaN;
  
  // Build map of current rows
  const existingRows = new Map();
  tbody.querySelectorAll('tr[data-broker]').forEach(row => {
    existingRows.set(row.dataset.broker, row);
  });
  
  // Track which brokers we've seen
  const seenBrokers = new Set();
  
  // Update or create rows
  records.forEach(r => {
    const broker = r.broker;
    seenBrokers.add(broker);
    
    const swappedOn = !!isSwapped(broker);
    const d1 = swappedOn ? r.odds?.[1] : r.odds?.[0];
    const d2 = swappedOn ? r.odds?.[0] : r.odds?.[1];
    const o1 = toNum(d1);
    const o2 = toNum(d2);
    
    let row = existingRows.get(broker);
    
    if(!row){
      // Create new row
      row = document.createElement('tr');
      row.dataset.broker = broker;
      
      if(variant === 'embedded'){
        row.innerHTML = 
          `<td class="eo-broker"><span class="eo-broker-label" title="">${broker}</span></td>`+
          `<td class="odds-cell-1"></td>`+
          `<td class="eo-swap-cell"><button class="eo-swapBtn" data-broker="${broker}" title="Swap sides">⇄</button></td>`+
          `<td class="odds-cell-2"></td>`;
      } else {
        row.innerHTML = 
          `<td><div class="brokerCell"><span class="bName eo-broker-label" title="${broker}">${broker}</span><button class="swapBtn" data-broker="${broker}" title="Swap sides">⇄</button></div></td>`+
          `<td class="odds-cell-1"></td>`+
          `<td class="odds-cell-2"></td>`;
      }
      tbody.appendChild(row);
    }
    
    // Get cells
    const cell1 = row.querySelector('.odds-cell-1') || row.children[variant === 'embedded' ? 1 : 1];
    const cell2 = row.querySelector('.odds-cell-2') || row.children[variant === 'embedded' ? 3 : 2];
    const swapBtn = row.querySelector('.eo-swapBtn, .swapBtn');
    const label = row.querySelector('.eo-broker-label');
    
    // Get previous values
    const prev = previousOdds.get(broker) || { odds1: NaN, odds2: NaN };
    
    // Update odds with animation
    if(cell1){
      const prevText = cell1.textContent;
      if(prevText !== String(d1)){
        applyOddsChange(cell1, broker, 1, d1, prev.odds1);
      }
      // Update best class
      cell1.classList.toggle('best', !r.frozen && Number.isFinite(o1) && o1 === best1);
      cell1.classList.toggle('frozen', !!r.frozen);
    }
    
    if(cell2){
      const prevText = cell2.textContent;
      if(prevText !== String(d2)){
        applyOddsChange(cell2, broker, 2, d2, prev.odds2);
      }
      cell2.classList.toggle('best', !r.frozen && Number.isFinite(o2) && o2 === best2);
      cell2.classList.toggle('frozen', !!r.frozen);
    }
    
    // Update swap button state
    if(swapBtn) swapBtn.classList.toggle('on', swappedOn);
    
    // Update frozen state
    row.classList.toggle('frozen', !!r.frozen);
    if(label) label.title = r.frozen ? 'Suspended / stale' : '';
    
    // Store current values
    previousOdds.set(broker, { odds1: toNum(d1), odds2: toNum(d2) });
  });
  
  // Remove rows for brokers no longer in list
  existingRows.forEach((row, broker) => {
    if(!seenBrokers.has(broker)){
      row.remove();
      previousOdds.delete(broker);
      animationTimers.delete(broker);
    }
  });
  
  return { best1, best2, liveNums1, liveNums2 };
}

// Public API
const OddsBoardShared = {
  toNum,
  calcMidFromLiveNums,
  updateOddsTable,
  applyOddsChange,
};

// ES module exports
export {
  toNum,
  calcMidFromLiveNums,
  updateOddsTable,
  applyOddsChange,
};

export default OddsBoardShared;
