// inject-spa-watch.js - detect in-page (history.pushState) match changes on portal.grid.gg
(() => {
  // Guard against multiple injections
  if (window.__lolSpaWatchInjected) {
    console.log('[inject-spa-watch] Already injected, skipping');
    return;
  }
  window.__lolSpaWatchInjected = true;
  console.log('[inject-spa-watch] Initializing URL watcher...');

  if(!/portal\.grid\.gg/i.test(location.host)) return;
  let last = location.pathname + location.search + location.hash;
  function check(){
    const cur = location.pathname + location.search + location.hash;
    if(cur !== last){
      last = cur;
      console.log('[lol-spa-watch] URL changed -> restart data collection');
      // Notify injected collectors to reset internal state
      window.postMessage({ type:'restart_data_collection' }, '*');
      // Also emit a distinct marker for Electron main aggregator to reset its aggregate state
      window.postMessage({ source:'lol-reset-trigger', reason:'spa-url-change', href: location.href }, '*');
    }
  }
  setInterval(check, 1000);
})();
