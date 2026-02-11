// Early minimal IPC handlers to satisfy renderer requests before full bootstrap
// initEarlyIpc({ ipcMain, store, boardManagerRef })
const https = require('https');
const { app } = require('electron');

function initEarlyIpc({ ipcMain, store, boardManagerRef }){
  try {
    ipcMain.handle('get-board-state', ()=>{
      try {
        const bm = boardManagerRef.value;
        if(bm && bm.getState) return bm.getState();
      } catch(_){ }
      // Fallback while bootstrapping
      try {
        return {
          side: store.get('boardSide') || 'right',
          width: store.get('boardWidth') || 320
        };
      } catch(_){
        return { side: 'right', width: 320 };
      }
    });
  } catch(_){ }
  try { ipcMain.handle('get-layout-preset', ()=>{ try { return store.get('layoutPreset'); } catch(_) { return null; } }); } catch(_){}

  // Changelog: fetch CHANGELOG.md from GitHub (always latest from main branch)
  try {
    ipcMain.handle('get-changelog', async () => {
      const url = 'https://raw.githubusercontent.com/MrLordCat/TraderData-and-odds-Monitor/main/CHANGELOG.md';
      try {
        const md = await new Promise((resolve, reject) => {
          const req = https.get(url, { headers: { 'User-Agent': 'OddsMoni/1.0' }, timeout: 10000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              https.get(res.headers.location, { headers: { 'User-Agent': 'OddsMoni/1.0' }, timeout: 10000 }, (r2) => {
                let d = ''; r2.on('data', c => d += c); r2.on('end', () => resolve(d));
              }).on('error', reject);
              return;
            }
            if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
            let data = ''; res.on('data', c => data += c); res.on('end', () => resolve(data));
          });
          req.on('error', reject);
          req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        });
        return md || null;
      } catch (e) {
        console.warn('[early] Changelog fetch failed:', e.message);
        return null;
      }
    });
  } catch(_){}
}

module.exports = { initEarlyIpc };