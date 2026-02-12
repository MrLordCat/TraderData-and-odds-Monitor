// inject-live-log.js (ported from original extension)
(() => {
  // Guard against multiple injections
  if (window.__lolLiveLogInjected) {
    console.log('[inject-live-log] Already injected, skipping');
    return;
  }
  window.__lolLiveLogInjected = true;
  console.log('[inject-live-log] Initializing WebSocket interceptor...');

  const NativeWS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    const ws = protocols ? new NativeWS(url, protocols) : new NativeWS(url);
    const seen = new Map();
    const pending = [];
    const DEDUPE_MS = 2000;
    function processSeg(seg){
      try {
        const bin = atob(seg.data); const arr = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
        if(!(typeof pako !== 'undefined' && pako.inflate)) { pending.push(seg); return; }
        const raw = JSON.parse(pako.inflate(arr, { to: 'string' }));
        const chunks = raw.sentenceChunks || raw.body?.entryToAdd?.sentenceChunks || [];
        const text = chunks.map(c=>c.text).join(' ').trim(); if(!text) return;
        const ts = raw.body?.entryToAdd?.gameTime || raw.body?.gameTime || raw.gameTime || '';
        const key = text+'|'+(ts||'no-ts'); const now = Date.now(); const last = seen.get(key)||0; if(now-last < DEDUPE_MS) return; seen.set(key, now);
        for(const [k,t] of seen){ if(now - t > DEDUPE_MS) seen.delete(k); }
        window.dispatchEvent(new CustomEvent('lol-live-log-update', { detail: { text, ts, raw, receivedAt: now } }));
      } catch(_){}
    }
    ws.addEventListener('message', ev => {
      if (typeof ev.data !== 'string') return; let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.service !== 'live_log' && msg.channel !== 'live_log') return;
      for (const seg of msg.data || []) { if(!seg.data) continue; processSeg(seg); }
    });
    setInterval(()=>{
      if(!(typeof pako !== 'undefined' && pako.inflate)) return;
      if(!pending.length) return;
      const copy = pending.splice(0);
      copy.forEach(processSeg);
    }, 800);
    return ws;
  };
  window.WebSocket.prototype = NativeWS.prototype;
})();
