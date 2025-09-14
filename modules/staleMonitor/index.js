function createStaleMonitor({ intervalMs, staleMs, brokerHealth, views, enabledRef, onReload }){
  function tick(){
    if(!enabledRef.value) return;
    const now = Date.now();
    for(const [id,h] of Object.entries(brokerHealth)){
      if(!views[id]) continue;
      const inactive = now - (h.lastChange||0);
      if(inactive >= staleMs){
        if(!h.lastRefresh || (now - h.lastRefresh) > (intervalMs*2 - 5000)){
          h.lastRefresh = now; onReload(id);
        }
      }
    }
  }
  setInterval(tick, intervalMs);
  return { tick };
}
module.exports = { createStaleMonitor };
