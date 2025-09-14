// Central LolStats module: loads original extension scripts from local copies and exposes
// init(portalView, emit) -> wires listeners, injects code; supports reset() & dispose().
const fs = require('fs');
const path = require('path');

function createLolStatsModule(persist={}){
  const loadHistory = typeof persist.loadHistory === 'function' ? persist.loadHistory : () => [];
  const saveHistory = typeof persist.saveHistory === 'function' ? persist.saveHistory : ()=>{};
  let injectedViews = new Set();
  let cache = null;
  let listenersBound = false;
  // multiStats now per game: { [gameId]: { quadra?, penta? } }
  let aggregate = { gameStats:{}, multiStats:{}, team1Name:null, team2Name:null };
  let sendFn = ()=>{};
  let recordedGames = new Set(); // games already pushed to history after winner detected
  let history = loadHistory() || [];

  function loadSources(){
    if(cache) return cache;
    function read(p){ try { return fs.readFileSync(p,'utf8'); } catch(e){ return ''; } }
    const base = path.join(__dirname,'inject');
    cache = {
      pako: read(path.join(base,'pako.min.js')),
      injectMap: read(path.join(base,'inject-map.js')),
      injectLive: read(path.join(base,'inject-live-log.js')),
      injectStats: read(path.join(base,'inject-stats.js')),
      // multikill merged into inject-stats.js – keep placeholder empty for backward safety
      injectSpaWatch: read(path.join(base,'inject-spa-watch.js'))
    };
    return cache;
  }

  function buildBundle(){
  const { pako, injectMap, injectLive, injectStats, injectSpaWatch } = loadSources();
  // CDN fallback loader ensures real pako present even if local file truncated
  const pakoLoader = `(()=>{try{if(!window.pako){const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js';s.onload=()=>console.log('[lol] pako loaded from CDN');document.head.appendChild(s);}else{console.log('[lol] pako local present');}}catch(e){console.warn('[lol] pako loader err',e);}})();`;
  // Order: (1) fallback loader, (2) local pako, (3) map+netWorth, (4) live log, (5) stats (includes multi), (6) spa url watcher
  return `${pakoLoader}\n(() => {\n${pako}\n})();\n(() => {\n${injectMap}\n})();\n(() => {\n${injectLive}\n})();\n(() => {\n${injectStats}\n})();\n(() => {\n${injectSpaWatch}\n})();`;
  }

  function init(view, slot, emit){
    if(!view || injectedViews.has(view)) return;
    sendFn = emit || sendFn;
    const bundle = buildBundle();
    view.webContents.executeJavaScript(bundle).catch(()=>{});
    injectedViews.add(view);
  }

  function reinject(view){
    if(!view) return;
    const bundle = buildBundle();
    try { view.webContents.executeJavaScript(bundle).catch(()=>{}); } catch(_){ }
  }

  function handleRaw(data){
    if(!data) return;
    const beforeKeys = new Set(Object.keys(aggregate.gameStats));
    if(data.source === 'lol-live-stats'){
      if(data.team1Name) aggregate.team1Name = data.team1Name;
      if(data.team2Name) aggregate.team2Name = data.team2Name;
      if(data.gameStats){
        // Merge per-game objects to preserve asynchronously merged fields (e.g., netWorth)
        Object.entries(data.gameStats).forEach(([g, incoming])=>{
          const existing = aggregate.gameStats[g] || {};
          // Shallow merge, but prefer existing netWorth if incoming omits it
          const merged = { ...existing, ...(incoming||{}) };
          if(incoming==null || incoming.netWorth===undefined){
            if(existing.netWorth!==undefined) merged.netWorth = existing.netWorth;
          }
          aggregate.gameStats[g] = merged;
        });
      }
    } else if(data.source === 'lol-debug') {
      // Forward debug info to renderer for visibility
      sendFn({ debug: data, ...aggregate, history: history.slice() });
      return;
    } else if(data.source === 'lol-netWorth') {
      // merge netWorth into latest game if exists
      const keys = Object.keys(aggregate.gameStats).map(Number).sort((a,b)=>a-b);
      const lastKey = keys[keys.length-1];
      if(lastKey){ const gs = aggregate.gameStats[String(lastKey)] ||= {}; gs.netWorth = { ...(gs.netWorth||{}), ...(data.netWorth||{}) }; }
    }
    // Reconcile any buffered '__pending' multi events once first real game appears
  // (No multikill reconciliation needed: logic moved into inject-stats.js)
    // Detect newly completed games (winner set) and store history entries
    try {
      Object.entries(aggregate.gameStats).forEach(([g, gs])=>{
        if(gs && gs.winner && !recordedGames.has(g)){
          history.push({ game: g, finishedAt: Date.now(), team1: aggregate.team1Name, team2: aggregate.team2Name, stats: JSON.parse(JSON.stringify(gs)) });
          recordedGames.add(g);
          // Trim history (optional max 200 games)
          if(history.length > 200) history.splice(0, history.length - 200);
          saveHistory(history);
        }
      });
    } catch(_){}
    sendFn({ ...aggregate, history: history.slice() });
  }

  function snapshot(){ return { ...aggregate, gameStats: { ...aggregate.gameStats }, multiStats: { ...aggregate.multiStats }, history: history.slice() }; }

  function reset(){
    aggregate = { gameStats:{}, multiStats:{}, team1Name:null, team2Name:null };
    recordedGames.clear();
    // Broadcast restart to all injected views unconditionally
    injectedViews.forEach(v=>{
      try { v.webContents.executeJavaScript(`window.postMessage({ type:'restart_data_collection' }, '*');`).catch(()=>{}); } catch(_){ }
    });
    sendFn(snapshot());
  }

  function dispose(){ injectedViews.clear(); cache=null; saveHistory(history); }

  return { init, reinject, handleRaw, snapshot, reset, dispose, getHistory: ()=> history.slice() };
}

module.exports = { createLolStatsModule };
