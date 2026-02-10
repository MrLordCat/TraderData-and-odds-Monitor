// Excel JSON watcher: monitors excel_dump.json produced externally (VBA macros) and emits odds-update
// Broker id: 'excel'
// Strategy: search common paths (Documents, cwd, configured path) & re-resolve dynamically.

const fs = require('fs');
const path = require('path');
const { broadcastGlobal } = require('./utils/broadcast');
const { app: electronApp } = require('electron');

function createExcelWatcher({ win, store, sendOdds, statsManager, boardManager, extensionBridgeRef, verbose=false }) {
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
  let lastTeamNames = { team1: null, team2: null }; // last sent team names to avoid spam

  function log(){
    if(!verbose) return;
    console.log('[excel][watcher]', ...arguments);
  }

  function candidatePaths(){
    // Only support new extractor file current_state.json (plus optional custom override path)
    const out = [];
    const custom = store.get('excelDumpPath'); if(custom && typeof custom === 'string'){ out.push(custom); if(verbose) log('stored excelDumpPath', custom); }
    const FILE = 'current_state.json';
    // Packaged app note: __dirname here is <appRoot>/src/main/modules. The Python script cwd is <appRoot>/Excel Extractor.
    // We resolve three levels up to get appRoot.
    const appRoot = path.resolve(__dirname, '..', '..', '..');
    out.push(path.join(appRoot, FILE));
    out.push(path.join(appRoot, 'Excel Extractor', FILE));
    try { const doc = electronApp.getPath('documents'); out.push(path.join(doc, FILE)); } catch(_){ }
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
    // Note: Excel odds are no longer sent to extension - extension doesn't need them
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
      
      // Team names from Excel K4/N4 (if empty - defaults to Team 1/Team 2)
      try {
        const t1 = typeof raw.team1Name === 'string' ? raw.team1Name.trim() : '';
        const t2 = typeof raw.team2Name === 'string' ? raw.team2Name.trim() : '';
        const team1 = t1 || 'Team 1';
        const team2 = t2 || 'Team 2';
        log('raw team names:', raw.team1Name, '/', raw.team2Name, '-> parsed:', team1, '/', team2);
        // Only send if changed
        if(team1 !== lastTeamNames.team1 || team2 !== lastTeamNames.team2){
          lastTeamNames.team1 = team1;
          lastTeamNames.team2 = team2;
          broadcastGlobal('excel-team-names', { team1, team2 });
          log('team names from Excel:', team1, '/', team2);
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
    pollTimer = setTimeout(poll, 200); // 200ms for responsive Excel sync
  }

  // Initial path resolution & start
  ensureWatcher(resolvePath());
  setTimeout(()=> readAndEmit('init'), 300);
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
    mapPollTimer = setTimeout(mapPoll, 100); // fast response to hotkey changes
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
      if(typeof sendOdds === 'function') sendOdds(payload);
      // Write sync file next to current_state.json so external AHK can read
      if(activePath){
        const dir = path.dirname(activePath);
        const out = path.join(dir, 'template_sync.json');
        try { fs.writeFileSync(out, JSON.stringify(payload)); } catch(_){ }
      }
    } catch(_){ }
  }

  if(verbose) log('candidates', lastResolvedPaths);

  // Expose method to re-broadcast team names (useful after stats panel loads)
  function rebroadcastTeamNames(){
    if(lastTeamNames.team1 || lastTeamNames.team2){
      const team1 = lastTeamNames.team1 || 'Team 1';
      const team2 = lastTeamNames.team2 || 'Team 2';
      log('rebroadcast team names:', team1, '/', team2);
      broadcastGlobal('excel-team-names', { team1, team2 });
    }
  }

  return {
    dispose(){
      disposed = true;
      try { if(watcher) watcher.close(); } catch(_){ }
      if(pollTimer) clearTimeout(pollTimer);
      if(mapPollTimer) clearTimeout(mapPollTimer);
      log('disposed');
    },
    rebroadcastTeamNames
  };
}

module.exports = { createExcelWatcher };
