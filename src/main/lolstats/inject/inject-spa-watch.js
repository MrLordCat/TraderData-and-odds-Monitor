// inject-spa-watch.js - detect in-page (history.pushState) match changes on portal.grid.gg
(() => {
  if(!/portal\.grid\.gg/i.test(location.host)) return;
  let last = location.pathname + location.search + location.hash;
  function check(){
    const cur = location.pathname + location.search + location.hash;
    if(cur !== last){
      last = cur;
      try { console.log('[lol-spa-watch] URL changed -> restart data collection'); } catch(_){ }
      // Notify injected collectors to reset internal state
      window.postMessage({ type:'restart_data_collection' }, '*');
      // Also emit a distinct marker for Electron main aggregator to reset its aggregate state
      window.postMessage({ source:'lol-reset-trigger', reason:'spa-url-change', href: location.href }, '*');
    }
  }
  setInterval(check, 1000);
})();
