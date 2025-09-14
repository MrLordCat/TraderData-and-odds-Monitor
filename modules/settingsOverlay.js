const { BrowserView } = require('electron');
const path = require('path');

function createSettingsOverlay(ctx){
  let settingsView = null;
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

  function open(){
    if(settingsView) return;
    settingsView = new BrowserView({ webPreferences:{ nodeIntegration:true, contextIsolation:false, backgroundThrottling:false } });
    try { ctx.mainWindow.addBrowserView(settingsView); } catch(e){ }
    const mb = ctx.mainWindow.getBounds();
    settingsView.setBounds({ x:0,y:0,width:mb.width,height:mb.height });
    settingsView.setAutoResize({ width:true, height:true });
    try { settingsView.webContents.loadFile(path.join(__dirname,'..','renderer','settings.html')); } catch(e){}
    settingsView.webContents.on('did-finish-load', ()=>{ try {
      const gsTheme = ctx.store ? ctx.store.get('gsTheme') : null;
      const gsHeatBar = ctx.store ? ctx.store.get('gsHeatBar') : null;
      try { console.log('[settingsOverlay] init theme+heatbar', gsHeatBar); } catch(_){ }
      settingsView.webContents.send('settings-init', { contrast:100, gsTheme, gsHeatBar });
    } catch(_){ } });
    applyBlurToBrokers();
    try { ctx.mainWindow.webContents.send('ui-blur-on'); } catch(_){ }
  }
  function close(){
    if(!settingsView) return;
    try { ctx.mainWindow.removeBrowserView(settingsView); } catch(_){ }
    try { settingsView.webContents.removeAllListeners(); } catch(_){ }
    try { settingsView.destroy(); } catch(_){ }
    settingsView=null;
    clearBlurFromBrokers();
    try { ctx.mainWindow.webContents.send('ui-blur-off'); } catch(_){ }
  }

  return { open, close };
}

module.exports = { createSettingsOverlay };
