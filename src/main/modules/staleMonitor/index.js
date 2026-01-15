// Stale monitor: reloads brokers with missing or stale odds
// Works only when Map Auto Refresh is enabled (reads from store)
// Missing odds ('-') for configurable timeout -> reload
// Unchanged odds for configurable timeout -> reload

const DEFAULT_MISSING_ODDS_MIN = 1;
const DEFAULT_STALE_ODDS_MIN = 3;

function createStaleMonitor({ intervalMs, brokerHealth, views, store, onReload }){
  
  function getSettings() {
    try {
      const saved = store.get('brokerRefreshSettings');
      return {
        staleReloadEnabled: saved?.staleReloadEnabled !== false,
        staleMissingTimeoutMin: saved?.staleMissingTimeoutMin || DEFAULT_MISSING_ODDS_MIN,
        staleUnchangedTimeoutMin: saved?.staleUnchangedTimeoutMin || DEFAULT_STALE_ODDS_MIN
      };
    } catch (_) {
      return { 
        staleReloadEnabled: true, 
        staleMissingTimeoutMin: DEFAULT_MISSING_ODDS_MIN, 
        staleUnchangedTimeoutMin: DEFAULT_STALE_ODDS_MIN 
      };
    }
  }

  function tick(){
    // Check if map auto refresh is enabled (linked to the ⟳ button)
    const mapAutoEnabled = store ? !!store.get('mapAutoRefreshEnabled') : false;
    if(!mapAutoEnabled) return;
    
    const settings = getSettings();
    // Check if stale reload is enabled in settings
    if(!settings.staleReloadEnabled) return;
    
    const missingOddsMs = settings.staleMissingTimeoutMin * 60 * 1000;
    const staleOddsMs = settings.staleUnchangedTimeoutMin * 60 * 1000;
    
    const now = Date.now();
    for(const [id,h] of Object.entries(brokerHealth)){
      if(!views[id]) continue;
      
      // Check for missing odds ('-')
      const hasMissingOdds = h.lastOdds && (h.lastOdds.includes('"-"') || h.lastOdds === '["-","-"]');
      
      if(hasMissingOdds){
        // Track when missing odds started
        if(!h.missingStart) h.missingStart = now;
        
        // Reload if missing for configured timeout
        if((now - h.missingStart) >= missingOddsMs){
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
      
      // Check for stale (unchanged) odds
      const staleTime = now - (h.lastChange || 0);
      if(staleTime >= staleOddsMs){
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
