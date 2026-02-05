const { BrowserView } = require('electron');
const { hideView } = require('../utils/views');
const path = require('path');

function createSettingsOverlay(ctx){
  let settingsView = null;
  let attached = false; // track if attached to mainWindow

  // Note: No blur on brokers needed - settings backdrop overlay covers everything

  function ensureCreated(){
    if(settingsView) return;
    settingsView = new BrowserView({ webPreferences:{ nodeIntegration:true, contextIsolation:false, backgroundThrottling:false } });
    try { ctx.mainWindow.addBrowserView(settingsView); attached=true; } catch(_){ }
    try {
      const mb = ctx.mainWindow.getBounds();
      settingsView.setBounds({ x:0,y:0,width:mb.width,height:mb.height });
      settingsView.setAutoResize({ width:true, height:true });
    } catch(_){ }
    try { settingsView.webContents.loadFile(path.join(__dirname,'..','..','..','renderer','pages','settings.html')); } catch(_){ }
    settingsView.webContents.on('did-finish-load', ()=>{ try {
      let gsHeatBar = ctx.store ? ctx.store.get('gsHeatBar') : null;
      // Migration: if decayPerSec > 1, user likely entered "seconds" in old UI
      if(gsHeatBar && typeof gsHeatBar.decayPerSec === 'number' && gsHeatBar.decayPerSec > 1) {
        gsHeatBar = { ...gsHeatBar, decayPerSec: 1 / gsHeatBar.decayPerSec };
        if(ctx.store) ctx.store.set('gsHeatBar', gsHeatBar);
      }
      const statsConfig = ctx.store ? ctx.store.get('statsConfig') : null;
      settingsView.webContents.send('settings-init', { gsHeatBar, statsConfig });
      // Send current theme to settings
      const theme = ctx.store ? ctx.store.get('appTheme') || 'dark' : 'dark';
      settingsView.webContents.send('theme-changed', theme);
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
    // Bring settings to top (above all other BrowserViews including sidebar and stats)
    try { ctx.mainWindow.setTopBrowserView(settingsView); } catch(_){ }
    // Send current theme every time settings is opened
    try {
      const theme = ctx.store ? ctx.store.get('appTheme') || 'dark' : 'dark';
      settingsView.webContents.send('theme-changed', theme);
    } catch(_){ }
    try { ctx.mainWindow.webContents.send('ui-blur-on'); } catch(_){ }
  }
  
  function close(){
    if(!settingsView) return;
    // Instead of destroying, just hide
    hideView(settingsView);
    try { ctx.mainWindow.webContents.send('ui-blur-off'); } catch(_){ }
  }

  return { open, close };
}

module.exports = { createSettingsOverlay };
