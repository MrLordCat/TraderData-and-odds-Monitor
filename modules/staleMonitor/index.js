// Stale monitor: reloads brokers with missing or stale odds
// Works only when Map Auto Refresh is enabled (reads from store)
// Missing odds ('-') for 1 minute -> reload
// Unchanged odds for 3 minutes -> reload

const MISSING_ODDS_MS = 60 * 1000;  // 1 minute for missing odds
const STALE_ODDS_MS = 3 * 60 * 1000; // 3 minutes for unchanged odds

function createStaleMonitor({ intervalMs, brokerHealth, views, store, onReload }){
  function tick(){
    // Check if map auto refresh is enabled (linked to the ⟳ button)
    const enabled = store ? !!store.get('mapAutoRefreshEnabled') : false;
    if(!enabled) return;
    
    const now = Date.now();
    for(const [id,h] of Object.entries(brokerHealth)){
      if(!views[id]) continue;
      
      // Check for missing odds ('-')
      const hasMissingOdds = h.lastOdds && (h.lastOdds.includes('"-"') || h.lastOdds === '["-","-"]');
      
      if(hasMissingOdds){
        // Track when missing odds started
        if(!h.missingStart) h.missingStart = now;
        
        // Reload if missing for 1+ minute
        if((now - h.missingStart) >= MISSING_ODDS_MS){
          if(!h.lastRefresh || (now - h.lastRefresh) > 30000){ // Min 30s between reloads
            h.lastRefresh = now;
            h.missingStart = null;
            onReload(id);
            continue;
          }
        }
      } else {
        h.missingStart = null; // Reset if odds are valid
      }
      
      // Check for stale (unchanged) odds - 3 minutes
      const staleTime = now - (h.lastChange || 0);
      if(staleTime >= STALE_ODDS_MS){
        if(!h.lastRefresh || (now - h.lastRefresh) > 60000){ // Min 60s between stale reloads
          h.lastRefresh = now;
          onReload(id);
        }
      }
    }
  }
  setInterval(tick, intervalMs);
  return { tick };
}
module.exports = { createStaleMonitor };
