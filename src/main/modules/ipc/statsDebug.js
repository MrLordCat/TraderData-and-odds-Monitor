// Stats debug & raw LoL event mirroring extracted from main.js
// initStatsDebugIpc({ ipcMain, statsManager, getStatsLogWindow })

function initStatsDebugIpc(ctx){
  const { ipcMain, statsManager, getStatsLogWindow } = ctx;
  if(!ipcMain) return;
  try {
    ipcMain.on('stats-debug', (_e, msg) => {
      let printable = msg;
      try { if(typeof msg === 'object' && msg) printable = JSON.stringify(msg); } catch(_){}
      try { console.log('[stats-debug]', printable); } catch(_){}
      let kind = 'dbg';
      try {
        if(msg && typeof msg === 'object'){
          if(msg.tap==='err' || msg.level===2 || /error/i.test(printable)) kind='err';
          else if(msg.tap==='warn' || msg.level===1 || /warn/i.test(printable)) kind='warn';
        }
      } catch(_){}
      try {
        const win = getStatsLogWindow && getStatsLogWindow();
        if(win && !win.isDestroyed()) {
          win.webContents.executeJavaScript(`window.__pushStatsLog(${JSON.stringify(kind)}, ${JSON.stringify(printable)})`).catch(()=>{});
        }
      } catch(_){}
    });
  } catch(_){}
  try {
    ipcMain.on('lol-stats-raw', (_e, { slot, data }) => {
      try {
        const win = getStatsLogWindow && getStatsLogWindow();
        if(!win || win.isDestroyed()) return;
        const summary = `[raw:${data && data.source || 'unknown'}][slot:${slot||'?'}]`;
        win.webContents.executeJavaScript(`window.__pushStatsLog('ipc', ${JSON.stringify(summary)})`).catch(()=>{});
        if(data && data.source==='lol-live-stats'){
          try {
            let games=0; let gameKeys=[]; let metricsSample=[];
            if(data.gameStats && typeof data.gameStats==='object'){
              gameKeys = Object.keys(data.gameStats); games = gameKeys.length;
              if(games){ const first = data.gameStats[gameKeys[0]]; if(first && typeof first==='object') metricsSample = Object.keys(first).slice(0,25); }
            }
            const detail = { slot, source:'lol-live-stats', games, gameKeys, sampleMetrics: metricsSample };
            win.webContents.executeJavaScript(`window.__pushStatsLog('dbg', ${JSON.stringify(detail)})`).catch(()=>{});
          } catch(_){}
        } else if(data && data.source==='lol-debug') {
          try {
            const base = { slot, source: data.source };
            win.webContents.executeJavaScript(`window.__pushStatsLog('dbg', ${JSON.stringify(base)})`).catch(()=>{});
          } catch(_){}
        }
      } catch(err){ try { console.warn('log mirror lol-stats-raw failed', err); } catch(_){} }
    });
  } catch(_){}
}

module.exports = { initStatsDebugIpc };