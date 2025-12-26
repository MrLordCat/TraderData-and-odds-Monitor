// Enhanced inject-map.js with broader extraction + debug
(() => {
  const playerToTeam = new Map();
  const pending = []; // queue of { service, seg }
  let flushing = false;
  const seenServices = new Set();
  const MAX_DEBUG_SERVICES = 50;

  function inflateBase64ToJSON(b64){
    try {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
      if (typeof pako !== 'undefined' && pako.inflate) {
        return JSON.parse(pako.inflate(arr, { to: 'string' }));
      }
      // Fallback using DecompressionStream if available (async converted to sync via deopt – best effort)
      if (typeof DecompressionStream !== 'undefined') {
        // We can't block synchronously; skip for now.
        return null;
      }
    } catch(_) { /* swallow */ }
    return null;
  }

  function tryFlush(){
    if(flushing) return;
    if(!(typeof pako !== 'undefined' && pako.inflate)) return; // not ready
    if(!pending.length) return;
    flushing = true;
    let changed=false;
    try {
      for(const item of pending.splice(0)){ // process all
        if(item.type==='networth'){
          const inner = inflateBase64ToJSON(item.seg.data); if(!inner) continue;
          const sg = (inner.stateGroups||[]).find(g=>g.name==='Game'); const state = sg?.states?.[0]; if(!state) continue;
          const teamGroup = (state.entityGroups||[]).find(g=>g.name==='Team'); if(!teamGroup) continue;
          const values = {}; (teamGroup.entitySubGroups?.[0]?.entities||[]).forEach(ent=>{ const teamName=ent.name; const np=ent.dataPoints||[]; const netWorth=np[0]?.value ?? null; if(teamName && netWorth!=null) values[teamName]=netWorth; });
          window.postMessage({ source:'lol-netWorth', netWorth: values }, '*');
        } else if(item.type==='score'){
          const inner = inflateBase64ToJSON(item.seg.data); if(!inner) continue; if(tryExtract(inner)) changed = true;
        }
      }
      if(changed) publishMapping();
    } finally { flushing=false; }
  }
  setInterval(tryFlush, 700);

  function publishMapping(){
    if(playerToTeam.size === 0) return;
    const teams = Array.from(new Set(playerToTeam.values()));
    if(teams.length < 2) return;
    window.__lolPlayerToTeam = playerToTeam;
    window.dispatchEvent(new CustomEvent('lol-mapping-ready', { detail: Object.fromEntries(playerToTeam) }));
    window.postMessage({ source:'lol-debug', stage:'mapping-ready', size: playerToTeam.size, teams }, '*');
  }

  function tryExtract(inner){
    if(!inner || typeof inner !== 'object') return false;
    let updated = false;
    // Common structures
    const candidates = [];
    if (Array.isArray(inner.teams)) candidates.push(inner.teams);
    if (Array.isArray(inner.data?.teams)) candidates.push(inner.data.teams);
    if (Array.isArray(inner.teamScoreboard)) candidates.push(inner.teamScoreboard);
    if (Array.isArray(inner.data?.teamScoreboard)) candidates.push(inner.data.teamScoreboard);
    // Recursive search for small arrays of objects that look like teams
    function scan(obj, depth=0){
      if(!obj || typeof obj!=='object' || depth>4) return;
      if(Array.isArray(obj) && obj.length>0 && obj.length<=10){
        const looksTeamArray = obj.every(o=> typeof o==='object' && (o.teamName||o.name||o.displayName) && (o.players||o.roster||Array.isArray(o.entities)||Array.isArray(o.entitySubGroups)));
        if(looksTeamArray) candidates.push(obj);
      }
      for(const k in obj){ if(Object.prototype.hasOwnProperty.call(obj,k)) scan(obj[k], depth+1); }
    }
    scan(inner);
    for(const arr of candidates){
      for(const t of arr){
        if(!t || typeof t!=='object') continue;
        const teamName = t.teamName || t.name || t.displayName;
        if(!teamName) continue;
        const players = t.players || t.roster || t.entities || [];
        for(const pl of players){
          let nick=null;
          if(typeof pl==='string') nick=pl;
          else if(pl && typeof pl==='object') nick = pl.summonerName || pl.nickname || pl.name || pl.playerName || null;
          if(nick){
            const key = nick.trim().toLowerCase();
            if(key && teamName){
              const prev = playerToTeam.get(key);
              if(prev !== teamName){ playerToTeam.set(key, teamName); updated = true; }
            }
          }
        }
      }
    }
    return updated;
  }

  const NativeWS = window.WebSocket;
  window.WebSocket = function(url, protocols){
    const ws = protocols ? new NativeWS(url, protocols) : new NativeWS(url);
    ws.addEventListener('message', ev => {
      if(typeof ev.data !== 'string') return;
      let env; try { env = JSON.parse(ev.data); } catch { return; }
      const service = env.service || env.channel || '';
      if(service && !seenServices.has(service) && seenServices.size < MAX_DEBUG_SERVICES){
        seenServices.add(service);
        window.postMessage({ source:'lol-debug', stage:'service', service }, '*');
      }
      // Net worth extraction
      if(/series_comparison/i.test(service)){
        for(const seg of env.data || []){
          if(!seg?.data) continue;
          if(!(typeof pako !== 'undefined' && pako.inflate)) { pending.push({ type:'networth', seg }); continue; }
          const inner = inflateBase64ToJSON(seg.data); if(!inner) continue;
          const sg = (inner.stateGroups||[]).find(g=>g.name==='Game'); const state = sg?.states?.[0]; if(!state) continue;
          const teamGroup = (state.entityGroups||[]).find(g=>g.name==='Team'); if(!teamGroup) continue;
          const values = {}; (teamGroup.entitySubGroups?.[0]?.entities||[]).forEach(ent=>{ const teamName=ent.name; const np=ent.dataPoints||[]; const netWorth=np[0]?.value ?? null; if(teamName && netWorth!=null) values[teamName]=netWorth; });
          window.postMessage({ source:'lol-netWorth', netWorth: values }, '*');
        }
        return; // don't attempt mapping in this branch
      }
      // Scoreboard / roster style services
    if(/scoreboard|team|roster|color/i.test(service)){
        let updated = false;
        for(const seg of env.data || []){
          if(!seg?.data) continue;
      if(!(typeof pako !== 'undefined' && pako.inflate)) { pending.push({ type:'score', seg }); continue; }
      const inner = inflateBase64ToJSON(seg.data); if(!inner) continue; if(tryExtract(inner)) updated = true;
        }
        if(updated) publishMapping();
      }
    });
    return ws;
  };
  window.WebSocket.prototype = NativeWS.prototype;

  window.addEventListener('message', (event)=>{
    if(event.source!==window || !event.data) return;
    if(event.data.type==='restart_data_collection'){
      if(playerToTeam.size>0) publishMapping(); else delete window.__lolPlayerToTeam;
    }
  });
})();
