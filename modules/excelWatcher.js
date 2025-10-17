// Excel JSON watcher: monitors excel_dump.json produced externally (VBA macros) and emits odds-update
// Broker id: 'excel' (distinct from 'dataservices')
// Strategy: search common paths (Documents, cwd, configured path) & re-resolve dynamically.

const fs = require('fs');
const path = require('path');
let electronApp = null;
try { ({ app: electronApp } = require('electron')); } catch(_){ }

function createExcelWatcher({ win, store, sendOdds, verbose=false }) {
  if(!win || win.isDestroyed()) return { dispose(){} };

  let lastSig = '';
  let disposed = false;
  let pollTimer = null;
  let watcher = null;
  let activePath = null; // currently watched file
  let lastResolvedPaths = [];
  let lastData = null; // cache last payload (our simplified shape)
  let lastEmittedMap = null; // last map id we emitted for
  let mapPollTimer = null; // timer id for map change polling
  let lastTemplate = null; // last seen template string from Excel (C1)

  function log(){
    if(!verbose) return;
    try { console.log('[excel][watcher]', ...arguments); } catch(_){ }
  }

  function candidatePaths(){
    // Only support new extractor file current_state.json (plus optional custom override path)
    const out = [];
    try {
  const custom = store.get('excelDumpPath'); if(custom && typeof custom === 'string'){ out.push(custom); if(verbose) log('stored excelDumpPath', custom); }
    } catch(_){ }
    const FILE = 'current_state.json';
    // Packaged app note: __dirname here is <appRoot>/modules. The Python script cwd is <appRoot>/Excel Extractor.
    // We previously used __dirname + 'Excel Extractor' which produced an incorrect nested path (<appRoot>/modules/Excel Extractor/...)
    // so we correct by resolving parent directory as appRoot.
    try {
      const appRoot = path.resolve(__dirname, '..');
      out.push(path.join(appRoot, FILE));
      out.push(path.join(appRoot, 'Excel Extractor', FILE));
    } catch(_){ }
    try { if(electronApp){ const doc = electronApp.getPath('documents'); out.push(path.join(doc, FILE)); } } catch(_){ }
    const up = process.env.USERPROFILE || process.env.HOME || '';
    if(up) out.push(path.join(up, 'Documents', FILE));
    out.push(path.join(process.cwd(), FILE));
    out.push(path.join(process.cwd(), 'Excel Extractor', FILE));
    const uniq = [...new Set(out)];
    if(verbose) log('candidatePaths', uniq);
    return uniq;
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
  if(verbose) log('watching', activePath);
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

  function emitCurrent({ odds1, odds2, frozen, rawTs, mapId }){
    const desiredMap = mapId || pickDesiredMap();
    const odds = [odds1, odds2].map(v=> (v==null||isNaN(v))? '-' : String(v));
    const sig = (rawTs||'')+ ':' + desiredMap + ':' + odds.join('/') + ':' + (frozen?'F':'T');
    if(sig === lastSig && desiredMap === lastEmittedMap) return;
    lastSig = sig;
    lastEmittedMap = desiredMap;
  const payload = { broker:'excel', map:desiredMap, odds, frozen, ts:Date.now(), label:'Map '+desiredMap+' Winner', source:'excel' };
  lastData = { odds1, odds2, frozen, rawTs, map: desiredMap };
    try { win.webContents.send('odds-update', payload); } catch(e){ log('emit failed main win', e.message); }
    try { if(typeof sendOdds === 'function') sendOdds(payload); } catch(e){ log('emit forward failed', e.message); }
    log('emit', payload);
    // Also broadcast latest template+map for AHK sync consumers
    broadcastTemplateSync();
  }

  // Parse new Excel Extractor current_state.json and emit odds
  function parseCurrentState(raw){
    if(!raw || typeof raw !== 'object') return false;
    const cells = raw.cells;
    const maps = raw.maps;
    if(!cells || typeof cells !== 'object') return false;
    try {
      // Pick up template if present (python exporter writes template: <string>)
      try {
        const tpl = typeof raw.template === 'string' ? raw.template.trim() : (typeof cells.C1 === 'string' ? cells.C1.trim() : null);
        if(tpl != null && tpl !== lastTemplate){
          lastTemplate = tpl;
          broadcastTemplateSync();
        }
      } catch(_){ }
      // Global status cell (default C6) for frozen detection
      const statusKey = (store.get('excelCurrentStateMapping')||{}).status || 'C6';
      const statusVal = String(cells[statusKey]||'').trim();
      const frozen = /suspend|closed|halt|pause/i.test(statusVal||'');
      const desiredMap = pickDesiredMap();
      let odds1=null, odds2=null;
      if(maps && typeof maps==='object'){
        const entry = maps[String(desiredMap)];
        if(entry){
          const n1 = parseFloat(entry.side1);
            const n2 = parseFloat(entry.side2);
            if(!isNaN(n1)) odds1=n1; if(!isNaN(n2)) odds2=n2;
        }
      }
      // Fallback to legacy single mapping if maps not present
      if(odds1==null && odds2==null){
          let mapping = Object.assign({ status:'C6', side1:'M336', side2:'N336' }, store.get('excelCurrentStateMapping')||{});
          let n1 = parseFloat(cells[mapping.side1]);
          let n2 = parseFloat(cells[mapping.side2]);
          const bothMissing = (isNaN(n1)||n1==null) && (isNaN(n2)||n2==null);
          if(bothMissing){
            // Auto-detect: find first M## and N## cells with numeric values (smallest row number)
              const keys = Object.keys(cells);
              const mKeys = keys.filter(k=>/^M\d+$/.test(k) && !isNaN(parseFloat(cells[k])));
              const nKeys = keys.filter(k=>/^N\d+$/.test(k) && !isNaN(parseFloat(cells[k])));
              const sortByRow = k=> parseInt(k.slice(1),10);
              mKeys.sort((a,b)=> sortByRow(a)-sortByRow(b));
              nKeys.sort((a,b)=> sortByRow(a)-sortByRow(b));
              if(mKeys.length && nKeys.length){
                mapping.side1 = mKeys[0];
                mapping.side2 = nKeys[0];
                try { store.set('excelCurrentStateMapping', { status:mapping.status, side1:mapping.side1, side2:mapping.side2 }); } catch(_){ }
                if(verbose) log('auto-detected mapping', mapping);
                n1 = parseFloat(cells[mapping.side1]);
                n2 = parseFloat(cells[mapping.side2]);
              } else {
                if(verbose) log('auto-detect failed: no numeric M#/N# pairs found');
              }
          } else {
            if(verbose) log('using stored/default mapping', mapping);
          }
          if(!isNaN(n1)) odds1=n1; if(!isNaN(n2)) odds2=n2;
      }
      if(odds1==null && odds2==null) return false;
      emitCurrent({ odds1, odds2, frozen, rawTs: raw.ts||raw.timestamp||'', mapId: desiredMap });
      return true;
    } catch(err){ log('current_state parse error', err.message); return false; }
  }

  function readAndEmit(tag){
    if(disposed) return;
    if(!activePath){ ensureWatcher(resolvePath()); }
    if(!activePath) return;
    fs.readFile(activePath, 'utf8', (err, txt)=>{
      if(err){
        // If file absent now -> maybe moved; re-resolve next poll
        if(tag==='init' || tag==='poll') log('read fail', err.code, 'path', activePath);
        return;
      }
      let data;
      try { data = JSON.parse(txt); } catch(parseErr){ log('JSON parse error', parseErr.message); return; }
      const ok = parseCurrentState(data);
  if(!ok && verbose) log('parseCurrentState returned false (shape mismatch?)');
    });
  }

  function poll(){
    if(disposed) return;
    const resolved = resolvePath();
    if(resolved !== activePath){
      if(verbose) log('path change', activePath, '->', resolved);
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
        // Re-emit cached odds for new map selection (same odds reused)
        // Force re-parse to pick different map's odds from stored raw file instead of reusing lastData blindly
        readAndEmit('map-change');
      }
    } catch(_){ }
    mapPollTimer = setTimeout(mapPoll, 400); // lightweight
  }
  mapPoll();

  // Broadcast template + map to consumers (renderer or AHK bridge). Also write a tiny sync file for AHK.
  function broadcastTemplateSync(){
    try {
      const effectiveMap = lastEmittedMap || pickDesiredMap();
      const template = lastTemplate || '';
      const payload = { template, map: effectiveMap, ts: Date.now() };
      if(win && !win.isDestroyed()){
        try { win.webContents.send('excel-template-sync', payload); } catch(_){ }
      }
      // Optional: also forward via sendOdds callback path if provided and expects generic channel
      try { if(typeof sendOdds === 'function' && sendOdds.__acceptsTemplateSync) sendOdds(payload); } catch(_){ }
      // Write sync file next to current_state.json so external AHK can read
      if(activePath){
        const dir = path.dirname(activePath);
        const out = path.join(dir, 'template_sync.json');
        try { fs.writeFileSync(out, JSON.stringify(payload)); } catch(_){ }
      }
    } catch(_){ }
  }

  if(verbose) log('candidates', lastResolvedPaths);

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
