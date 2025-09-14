// Video upscaler IPC extracted from main.js
// initUpscalerIpc({ ipcMain, upscalerManager, statsManager })

function initUpscalerIpc(ctx){
  const { ipcMain, upscalerManager, statsManager } = ctx;
  if(!ipcMain || !upscalerManager) return;
  ipcMain.handle('video-upscaler-state', ()=>{ 
    try { return upscalerManager.getState(); } catch(e){ return { enabled:false, scale:'1', frameGen:false }; }
  });
  ipcMain.on('video-upscaler-toggle', (e,{ enabled })=>{ 
    try { 
      const prev = upscalerManager.getState();
      const wasActive = prev.enabled || prev.frameGen;
      upscalerManager.setConfig({ enabled }); 
      const st=upscalerManager.getState(); 
      const nowActive = st.enabled || st.frameGen;
      if(statsManager && statsManager.views && statsManager.views.A){ 
        if(nowActive){ upscalerManager.maybeInject(statsManager.views.A, 'A'); } 
        else if(wasActive && !nowActive){ try { statsManager.views.A.webContents.executeJavaScript('window.__UPS_DISABLE && window.__UPS_DISABLE();').catch(()=>{}); } catch(_){ } }
      }
      e.sender.send('video-upscaler-updated', st); 
    } catch(err){ }
  });
  ipcMain.on('video-upscaler-config', (e,cfg)=>{ 
    try { 
      upscalerManager.setConfig(cfg||{}); 
      const st=upscalerManager.getState(); 
      if(statsManager && statsManager.views && statsManager.views.A){ upscalerManager.maybeInject(statsManager.views.A, 'A'); }
      e.sender.send('video-upscaler-updated', st); 
    } catch(err){ }
  });
}

module.exports = { initUpscalerIpc };