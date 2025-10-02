// Excel JSON watcher: monitors excel_dump.json produced externally (VBA macros) and emits odds-update
// Broker id: 'excel' (distinct from 'dataservices')
// Strategy: search common paths (Documents, cwd, configured path) & re-resolve dynamically.

const fs = require('fs');
const path = require('path');
let electronApp = null;
try { ({ app: electronApp } = require('electron')); } catch(_){ }

function createExcelWatcher({ win, store, sendOdds }) {
  if(!win || win.isDestroyed()) return { dispose(){} };

  let lastSig = '';
  let disposed = false;
  let pollTimer = null;
  let watcher = null;
  let activePath = null; // currently watched file
  let lastResolvedPaths = [];
  let sanitizedPath = null; // path to generated fixed json
  let lastRepairHash = ''; // signature of last malformed original we repaired
  let lastSanitizedWriteTs = 0;
  let lastData = null; // cache last successfully parsed (and normalized) data
  let lastEmittedMap = null; // last map id we emitted for
  let mapPollTimer = null; // timer id for map change polling

  function log(){
    try { console.log('[excel][watcher]', ...arguments); } catch(_){ }
  }

  function candidatePaths(){
    const out = [];
    try {
      const custom = store.get('excelDumpPath');
      if(custom && typeof custom === 'string') out.push(custom);
    } catch(_){ }
    // Documents (electron) path
    try { if(electronApp) out.push(path.join(electronApp.getPath('documents'), 'excel_dump.json')); } catch(_){ }
    // Windows USERPROFILE/Documents fallback
    const up = process.env.USERPROFILE || process.env.HOME || '';
    if(up) out.push(path.join(up, 'Documents', 'excel_dump.json'));
    // Working dir (in case user put file next to app)
    out.push(path.join(process.cwd(), 'excel_dump.json'));
    // Deduplicate
    return [...new Set(out)];
  }

  function resolvePath(){
    const cand = candidatePaths();
    lastResolvedPaths = cand;
    for(const p of cand){
      try { if(fs.existsSync(p)) return p; } catch(_){ }
    }
    // Even if not exists, prefer first candidate for watch attempt (most likely location)
    return cand[0];
  }

  function ensureWatcher(target){
    if(target && target === activePath && watcher) return;
    // Close previous
    try { if(watcher) watcher.close(); } catch(_){ }
    watcher = null;
    activePath = target;
    if(!activePath) return;
    try {
      watcher = fs.watch(activePath, { persistent: true }, ()=> readAndEmit('fs-watch'));
      log('watching', activePath);
    } catch(e){ log('fs.watch failed (will rely on polling)', e.message); }
  }

  function pickDesiredMap(){
    let desired = 1;
    try {
      const lastMap = store.get('lastMap');
      if(lastMap && typeof lastMap === 'object'){
        const v = lastMap['excel'];
        if(typeof v === 'number' && v>=1 && v<=5) desired = v;
      } else if(typeof lastMap === 'number' && lastMap>=1 && lastMap<=5){
        desired = lastMap;
      }
    } catch(_){ }
    return desired;
  }

  function emitFromData(data){
    if(!data || !Array.isArray(data.markets)) return;
    lastData = data; // cache
    const sig = data.timestamp+ ':' + data.markets.map(m=> [m.id,m.odds1,m.odds2,m.status].join('|')).join('~');

    const desiredMap = pickDesiredMap();
    const wantedId = 'map'+desiredMap;
    let market = data.markets.find(m=> (m.id||'').toLowerCase() === wantedId);
    if(!market) market = data.markets[0];
    if(!market) return;

    const odds = [market.odds1, market.odds2].map(v=>{ const n=parseFloat(v); return isNaN(n)? '-' : String(n); });
    const frozen = /suspend|close/i.test(market.status||'');
  // Emit as dedicated broker id 'excel' (dataservices legacy no longer used for this feed).
  const payload = { broker:'excel', map:desiredMap, odds, frozen, ts:Date.now(), label: market.label || ('Map '+desiredMap+' Winner'), source:'excel' };
    // Only skip if both signature AND map are unchanged.
    if(sig === lastSig && desiredMap === lastEmittedMap) return;
    lastSig = sig;
    lastEmittedMap = desiredMap;
    try { win.webContents.send('odds-update', payload); } catch(e){ log('emit failed main win', e.message); }
    try { if(typeof sendOdds === 'function') sendOdds(payload); } catch(e){ log('emit forward failed', e.message); }
    log('emit', payload);
  }

  function readAndEmit(tag){
    if(disposed) return;
    if(!activePath){ ensureWatcher(resolvePath()); }
    if(!activePath) return;
    fs.readFile(activePath, 'utf8', (err, txt)=>{
      if(err){
        // If file absent now -> maybe moved; re-resolve next poll
        return;
      }
      let data;
      try {
        data = JSON.parse(txt);
      } catch(e){
        // Malformed original. If we already have a sanitized file and original hash unchanged, reuse sanitized silently.
        const curHash = txt.length+ ':' + txt.slice(0,120);
        if(curHash === lastRepairHash && sanitizedPath){
          try {
            const sTxt = fs.readFileSync(sanitizedPath, 'utf8');
            data = JSON.parse(sTxt);
            // silently continue
          } catch(_sanErr){
            // fall through to attempt a new repair
          }
        }
        if(!data){
          // Attempt lightweight repair strategies before giving up.
          let repaired = txt;
          try {
            repaired = repaired.replace(/("markets"\s*:\s*)\[\s*\[/, '$1[');
            // If we now have ending with ]] we collapse to ] if counts indicate off-by-one.
            const openCount = (repaired.match(/\[/g)||[]).length;
            const closeCount = (repaired.match(/\]/g)||[]).length;
            if(openCount + 1 === closeCount){
              repaired = repaired.replace(/\]\s*\]\s*}$/, ']}');
            }
            data = JSON.parse(repaired);
            if(curHash !== lastRepairHash){
              log('repair applied after parse error', e.message);
              lastRepairHash = curHash;
            }
            // Write / refresh sanitized file for other consumers (one per source directory)
            try {
              const dir = path.dirname(activePath);
              sanitizedPath = path.join(dir, 'excel_dump.fixed.json');
              const outTxt = JSON.stringify(data);
              // Avoid needless writes if unchanged
              let shouldWrite = true;
              try {
                const prev = fs.readFileSync(sanitizedPath, 'utf8');
                if(prev === outTxt) shouldWrite = false;
              } catch(_r){ }
              if(shouldWrite){
                fs.writeFileSync(sanitizedPath + '.part', outTxt, 'utf8');
                try { fs.renameSync(sanitizedPath + '.part', sanitizedPath); } catch(_rn){ }
                lastSanitizedWriteTs = Date.now();
              }
            } catch(_w){ }
          } catch(e2){
            if(curHash !== lastRepairHash){
              log('parse fail unrepaired', e.message, 'repairErr:', e2.message);
              lastRepairHash = curHash;
            }
            return; // give up; wait for next change
          }
        }
      }

      // Post-parse normalization: flatten nested markets arrays if shape [[...]]
      try {
        if(data && Array.isArray(data.markets) && data.markets.length === 1 && Array.isArray(data.markets[0])){
          data.markets = data.markets[0];
          log('flattened nested markets array');
        }
      } catch(_){ }
      emitFromData(data);
    });
  }

  function poll(){
    if(disposed) return;
    const resolved = resolvePath();
    if(resolved !== activePath){
      log('path change', activePath, '->', resolved);
      ensureWatcher(resolved);
    }
    readAndEmit('poll');
    pollTimer = setTimeout(poll, 2000);
  }

  // Initial path resolution & start
  ensureWatcher(resolvePath());
  setTimeout(()=> readAndEmit('init'), 1200);
  poll();

  // Map change polling: re-emit current cached data if user switches map without Excel file changing.
  function mapPoll(){
    if(disposed) return;
    try {
      const desiredMap = pickDesiredMap();
      if(lastData && desiredMap !== lastEmittedMap){
        // force emit using cached data (emitFromData handles signature+map logic)
        emitFromData(lastData);
      }
    } catch(_){ }
    mapPollTimer = setTimeout(mapPoll, 400); // lightweight
  }
  mapPoll();

  log('candidates', lastResolvedPaths);

  return {
    dispose(){
      disposed = true;
      try { if(watcher) watcher.close(); } catch(_){ }
      if(pollTimer) clearTimeout(pollTimer);
      if(mapPollTimer) clearTimeout(mapPollTimer);
      log('disposed');
    }
  };
}

module.exports = { createExcelWatcher };
