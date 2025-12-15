const { BrowserView } = require('electron');
const path = require('path');

function createSettingsOverlay(ctx){
  let settingsView = null;
  let attached = false;
  let loadedOnce = false;
  // Guard against async insertCSS resolving after overlay closed.
  const overlayBlur = { active:false, cssKeys:{}, seq:0 };

  function applyBlurToBrokers(){
    if (overlayBlur.active) return;
    overlayBlur.active=true;
    overlayBlur.cssKeys={};
    overlayBlur.seq = (overlayBlur.seq||0) + 1;
    const seq = overlayBlur.seq;
    const css = 'html,body{filter:blur(18px) brightness(0.75) saturate(1.15)!important;transition:filter .18s ease;}';
    for (const [id,v] of Object.entries(ctx.views)){
      try {
        v.webContents.insertCSS(css).then(key=>{
          try {
            // If overlay already closed or another open/close cycle happened, remove immediately.
            if(!overlayBlur.active || overlayBlur.seq !== seq){
              try { v.webContents.removeInsertedCSS(key); } catch(_){ }
              return;
            }
            overlayBlur.cssKeys[id]=key;
          } catch(_){ }
        }).catch(()=>{});
      } catch(_){ }
    }
  }
  function clearBlurFromBrokers(){
    if(!overlayBlur.active) return;
    overlayBlur.active=false;
    overlayBlur.seq = (overlayBlur.seq||0) + 1;
    for (const [id,v] of Object.entries(ctx.views)){
      const key = overlayBlur.cssKeys[id];
      if(key) { try { v.webContents.removeInsertedCSS(key); } catch(_){ } }
    }
    overlayBlur.cssKeys={};
  }

  function sendInit(){
    try {
      if(!settingsView) return;
      const gsHeatBar = ctx.store ? ctx.store.get('gsHeatBar') : null;
      const statsConfig = ctx.store ? ctx.store.get('statsConfig') : null;
      const selectedGame = ctx.store ? (ctx.store.get('selectedGame') || 'lol') : 'lol';
      settingsView.webContents.send('settings-init', { gsHeatBar, statsConfig, selectedGame });
    } catch(_){ }
  }

  function ensureCreated(){
    if(settingsView) return;
    settingsView = new BrowserView({ webPreferences:{ nodeIntegration:true, contextIsolation:false, backgroundThrottling:false } });
    try { ctx.mainWindow.addBrowserView(settingsView); attached = true; } catch(_){ }
    try {
      const mb = ctx.mainWindow.getBounds();
      settingsView.setBounds({ x:0,y:0,width:mb.width,height:mb.height });
      settingsView.setAutoResize({ width:true, height:true });
    } catch(_){ }
    try { settingsView.webContents.loadFile(path.join(__dirname,'..','renderer','settings.html')); } catch(_){ }
    settingsView.webContents.on('did-finish-load', ()=>{ loadedOnce = true; sendInit(); });
  }

  function open(){
    ensureCreated();
    // Reattach if it was detached somehow.
    if(settingsView && !attached){ try { ctx.mainWindow.addBrowserView(settingsView); attached = true; } catch(_){ } }
    try {
      const mb = ctx.mainWindow.getBounds();
      settingsView.setBounds({ x:0,y:0,width:mb.width,height:mb.height });
    } catch(_){ }
    try { if(ctx.mainWindow && typeof ctx.mainWindow.setTopBrowserView==='function') ctx.mainWindow.setTopBrowserView(settingsView); } catch(_){ }
    // Push current settings on every open so UI always reflects latest store values.
    if(loadedOnce) sendInit();
    applyBlurToBrokers();
    try { ctx.mainWindow.webContents.send('ui-blur-on'); } catch(_){ }
  }

  function close(){
    if(!settingsView) return;
    // Do not destroy the view (avoids renderer/process churn and memory growth).
    try { settingsView.setBounds({ x:0,y:0,width:0,height:0 }); } catch(_){ }
    clearBlurFromBrokers();
    try { ctx.mainWindow.webContents.send('ui-blur-off'); } catch(_){ }
  }

  return { open, close };
}

module.exports = { createSettingsOverlay };
