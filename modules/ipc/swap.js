// Per-broker swap (team side orientation) sync IPC
// initSwapIpc({ ipcMain, store, boardManager, mainWindow, statsManager })

function uniq(arr){
  const out=[]; const seen=new Set();
  (arr||[]).forEach(x=>{ const v=String(x||'').trim(); if(!v) return; if(seen.has(v)) return; seen.add(v); out.push(v); });
  return out;
}

function initSwapIpc(ctx){
  const { ipcMain, store, boardManager, mainWindow, statsManager } = ctx;
  if(!ipcMain || !store) return;

  const KEY = 'swappedBrokers';

  function getList(){
    try { return uniq(store.get(KEY, [])); } catch(_){ return []; }
  }

  function setList(list){
    try { store.set(KEY, uniq(list)); } catch(_){ }
  }

  function broadcast(list){
    const payload = uniq(list);
    try { if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('swapped-brokers-updated', payload); } catch(_){ }
    try { if(statsManager && statsManager.views && statsManager.views.panel && !statsManager.views.panel.isDestroyed()) statsManager.views.panel.webContents.send('swapped-brokers-updated', payload); } catch(_){ }
    try { if(boardManager && typeof boardManager.getWebContents==='function'){ const wc=boardManager.getWebContents(); if(wc && !wc.isDestroyed()) wc.send('swapped-brokers-updated', payload); } } catch(_){ }
  }

  ipcMain.handle('swapped-brokers-get', ()=> getList());

  ipcMain.on('swapped-broker-set', (_e, p)=>{
    try {
      const broker = p && p.broker ? String(p.broker).trim() : '';
      if(!broker || broker==='excel') return;
      const want = !!(p && p.swapped);
      const set = new Set(getList());
      if(want) set.add(broker); else set.delete(broker);
      const list = Array.from(set);
      setList(list);
      broadcast(list);
    } catch(_){ }
  });

  ipcMain.on('swapped-broker-toggle', (_e, p)=>{
    try {
      const broker = p && p.broker ? String(p.broker).trim() : '';
      if(!broker || broker==='excel') return;
      const set = new Set(getList());
      if(set.has(broker)) set.delete(broker); else set.add(broker);
      const list = Array.from(set);
      setList(list);
      broadcast(list);
    } catch(_){ }
  });
}

module.exports = { initSwapIpc };
