// Live CSS watcher extracted from main.js
// initDevCssWatcher({ app, mainWindow, boardWindowRef, statsManager, baseDir })

function initDevCssWatcher(ctx){
  const { app, mainWindow, statsManager, baseDir } = ctx;
  try {
    if(app.isPackaged) return; // production skip
    const fs = require('fs');
    const path = require('path');
    const watchRoot = path.join(baseDir, 'renderer');
    const pending = new Set();
    let timer=null;
    function flush(){
      if(!pending.size) return;
      const list = Array.from(pending);
      pending.clear();
      try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('dev-css-changed', list); } catch(_){ }
  // boardWindow removed
      try {
        if (statsManager && statsManager.views) {
          Object.values(statsManager.views).forEach(v=>{ try { v.webContents && !v.webContents.isDestroyed() && v.webContents.send('dev-css-changed', list); } catch(_){ } });
        }
      } catch(_){ }
    }
    function debounce(){ clearTimeout(timer); timer=setTimeout(flush,120); }
    function watchDir(dir){
      let entries=[]; try { entries = fs.readdirSync(dir, { withFileTypes:true }); } catch(_){ return; }
      for(const ent of entries){
        const full = path.join(dir, ent.name);
        if(ent.isDirectory()) watchDir(full); // file presence not required beyond recursion
      }
      try {
        fs.watch(dir, { persistent:true }, (_evt, filename)=>{
          if(!filename) return; if(!filename.endsWith('.css')) return;
          pending.add(filename); debounce();
        });
      } catch(_){ }
    }
    watchDir(watchRoot);
    try { console.log('[dev] CSS watcher active'); } catch(_){ }
  } catch(e){ try { console.warn('initDevCssWatcher failed', e); } catch(_){ } }
}

module.exports = { initDevCssWatcher };