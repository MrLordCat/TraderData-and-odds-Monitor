const { BrowserView } = require('electron');
const { hideView } = require('../utils/views');
const path = require('path');

function createSettingsOverlay(ctx){
  let settingsView = null;
  let attached = false; // track if attached to mainWindow
  const overlayBlur = { active:false, cssKeys:{} };

  function applyBlurToBrokers(){
    if (overlayBlur.active) return; overlayBlur.active=true; overlayBlur.cssKeys={};
    const css = 'html,body{filter:blur(18px) brightness(0.75) saturate(1.15)!important;transition:filter .18s ease;}';
    for (const [id,v] of Object.entries(ctx.views)){
      try { v.webContents.insertCSS(css).then(key=>{ overlayBlur.cssKeys[id]=key; }); } catch(_){ }
    }
  }
  function clearBlurFromBrokers(){
    if(!overlayBlur.active) return; overlayBlur.active=false;
    for (const [id,v] of Object.entries(ctx.views)){
      const key = overlayBlur.cssKeys[id];
      if(key) { try { v.webContents.removeInsertedCSS(key); } catch(_){ } }
    }
    overlayBlur.cssKeys={};
  }

  function ensureCreated(){
    if(settingsView) return;
    settingsView = new BrowserView({ webPreferences:{ nodeIntegration:true, contextIsolation:false, backgroundThrottling:false } });
    try { ctx.mainWindow.addBrowserView(settingsView); attached=true; } catch(_){ }
    try {
      const mb = ctx.mainWindow.getBounds();
      settingsView.setBounds({ x:0,y:0,width:mb.width,height:mb.height });
      settingsView.setAutoResize({ width:true, height:true });
    } catch(_){ }
    try { settingsView.webContents.loadFile(path.join(__dirname,'..','..','renderer','settings.html')); } catch(_){ }
    settingsView.webContents.on('did-finish-load', ()=>{ try {
      const gsHeatBar = ctx.store ? ctx.store.get('gsHeatBar') : null;
      const statsConfig = ctx.store ? ctx.store.get('statsConfig') : null;
      settingsView.webContents.send('settings-init', { gsHeatBar, statsConfig });
    } catch(_){ } });
  }
  function open(){
    ensureCreated();
    // Reattach if detached (should not normally happen)
    if(!attached){ try { ctx.mainWindow.addBrowserView(settingsView); attached=true; } catch(_){ } }
    try {
      const mb = ctx.mainWindow.getBounds();
      settingsView.setBounds({ x:0,y:0,width:mb.width,height:mb.height });
    } catch(_){ }
    applyBlurToBrokers();
    try { ctx.mainWindow.webContents.send('ui-blur-on'); } catch(_){ }
  }
  function close(){
    if(!settingsView) return;
    // Instead of destroying (вызывало повторные addBrowserView), просто схлопываем.
  hideView(settingsView);
    clearBlurFromBrokers();
    try { ctx.mainWindow.webContents.send('ui-blur-off'); } catch(_){ }
  }

  return { open, close };
}

module.exports = { createSettingsOverlay };
