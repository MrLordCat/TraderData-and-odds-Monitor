// Board manager: handles docked/hidden/window modes for Odds Board.
// Modes: 'docked' (BrowserView in main window), 'hidden' (no view/window), 'window' (separate BrowserWindow)
// Persisted keys: boardMode, boardSide, boardWidth, boardBounds (for detached window)
// Public API: createBoardManager({ mainWindow, store, layoutManager, latestOddsRef, activeBrokerIdsRef, replayOddsFn })
// Returns { getState(), init(), toggle(), detach(), attach(), setSide(side), setWidth(w), handleIpc(channel,payload) }

const path = require('path');
const { BrowserView, BrowserWindow, screen } = require('electron');
const { ensureSingleClosedListener, hideView } = require('../utils/views');

function ensureVisibleBounds(b){
  if(!b) return null;
  const displays = screen.getAllDisplays();
  const intersects = (r,d)=>{
    const a=d.workArea;return !(r.x+r.width<a.x||r.x>a.x+a.width||r.y+r.height<a.y||r.y>a.y+a.height);
  };
  if(displays.some(d=>intersects(b,d))) return b;
  const primary = screen.getPrimaryDisplay().workArea;
  const width = Math.min(b.width||520, primary.width);
  const height = Math.min(b.height||820, primary.height);
  return { x:primary.x+Math.max(0,Math.floor((primary.width-width)/2)), y:primary.y+Math.max(0,Math.floor((primary.height-height)/2)), width, height };
}

function createBoardManager({ mainWindow, store, layoutManager, latestOddsRef, activeBrokerIdsRef, replayOddsFn, stageBoundsRef }){
  let state = {
    mode: store.get('boardMode') || 'docked',
    side: store.get('boardSide') || 'right',
  width: store.get('boardWidth') || 320
  };
  const MIN_W = 240; const MAX_W = 800;
  let dockView = null; // BrowserView when docked
  let win = null; // BrowserWindow when detached

  // ensureSingleClosedListener now imported from utils/views.js

  function persist(){ try { store.set('boardMode', state.mode); store.set('boardSide', state.side); store.set('boardWidth', state.width); } catch(_){} }
  function getState(){ return { ...state }; }

  function applyDockLayout(){
    if(!mainWindow || mainWindow.isDestroyed()) return;
    // shrink broker stage via layoutManager by adjusting stage bounds offset
    const bounds = mainWindow.getContentBounds();
    // Stage bounds (area brokers occupy) already exclude toolbar (renderer sends set-stage-bounds)
    const stageBounds = stageBoundsRef && stageBoundsRef.value ? stageBoundsRef.value : { x:0, y:0, width:bounds.width, height:bounds.height };
    const stage = { ...stageBounds };
    const w = Math.max(MIN_W, Math.min(MAX_W, state.width));
    if(state.side==='left') stage.x += w; // shift stage start
    stage.width -= w; // reduce width regardless of side
    // Notify renderer via existing set-stage-bounds channel? Instead reuse direct ref:
    // We adjust layoutManager internal stageBoundsRef
    layoutManager && layoutManager.setDockOffsets && layoutManager.setDockOffsets({ side: state.side, width: w });
    // Position dock view
    if(dockView){
      try {
        // Vertical positioning: align with stageBounds (below toolbar) instead of full window content
  const y = stageBounds.y; let h = stageBounds.height;
  // Extend by 1px to ensure no visible gap due to rounding
  h = h+1;
  if(state.side==='left') dockView.setBounds({ x: bounds.x, y, width: w, height: h });
  else dockView.setBounds({ x: bounds.x + bounds.width - w, y, width: w, height: h });
      } catch(e){}
    }
  }

  function createDockView(){
    if(dockView) return;
    dockView = new BrowserView({ webPreferences:{ preload: path.join(__dirname,'..','..','preload.js') } });
    try { dockView.setBackgroundColor('#10161f'); } catch(_){}
    mainWindow.addBrowserView(dockView);
    try { dockView.webContents.loadFile(path.join(__dirname,'..','..','renderer','board.html')); } catch(e){}
    dockView.webContents.on('did-finish-load', ()=> replayOdds());
    // Lightweight one-time diagnostic: log current 'closed' listener count on mainWindow (helps detect leak regressions)
    try {
      if(!createDockView.__diagLogged){
        createDockView.__diagLogged = true;
        const cnt = (typeof mainWindow.listenerCount === 'function') ? mainWindow.listenerCount('closed') : 'n/a';
        console.log('[board][diag] mainWindow closed listeners after createDockView =', cnt);
      }
    } catch(_){ }
  }
  function destroyDockView(){ if(!dockView) return; try { mainWindow.removeBrowserView(dockView); } catch(_){} try { dockView.webContents.destroy(); } catch(_){} dockView=null; }
  function hideDockView(){ if(!dockView) return; hideView(dockView); }
  function ensureDockViewAttached(){
    if(!dockView) return;
    try {
      const attached = mainWindow.getBrowserViews().includes(dockView);
      if(!attached) mainWindow.addBrowserView(dockView);
    } catch(_){}
  }

  function createWindow(){
    if(win && !win.isDestroyed()) return;
    const saved = ensureVisibleBounds(store.get('boardBounds'));
    win = new BrowserWindow({ width: saved? saved.width:520, height: saved? saved.height:820, x: saved? saved.x:undefined, y: saved? saved.y:undefined, title:'Odds Board', autoHideMenuBar:true, webPreferences:{ preload: path.join(__dirname,'..','..','preload.js') } });
    win.on('close', ()=>{ try { store.set('boardBounds', win.getBounds()); } catch(_){} });
    ensureSingleClosedListener(win, 'boardWindow-reset', ()=>{
      win=null; if(state.mode==='window'){ state.mode='hidden'; persist(); broadcast(); }
    });
    win.loadFile(path.join(__dirname,'..','..','renderer','board.html'));
    win.webContents.on('did-finish-load', ()=> replayOdds());
  }
  function replayOdds(){
    try {
      const targetWc = (state.mode==='window' && win && !win.isDestroyed()) ? win.webContents : (dockView? dockView.webContents: null);
      if(!targetWc) return;
      const ids = activeBrokerIdsRef.value.slice();
      targetWc.send('brokers-sync', { ids });
      ids.forEach(id=>{
        const p = latestOddsRef.value[id];
        if(p) targetWc.send('odds-update', p); else replayOddsFn && replayOddsFn(id);
      });
    } catch(e){ }
  }
  function sendOdds(payload){
    try {
      const targetWc = (state.mode==='window' && win && !win.isDestroyed()) ? win.webContents : (state.mode==='docked' && dockView ? dockView.webContents : null);
      if(targetWc) targetWc.send('odds-update', payload);
    } catch(_){}
  }

  function enterDocked(){
    // If window mode active, close separate window first.
    if(win){ try { win.close(); } catch(_){} }
    // Reuse existing dockView if present; otherwise create once. (Avoid destroying/creating repeatedly to prevent internal 'closed' listener accumulation on mainWindow.)
    if(!dockView) createDockView(); else ensureDockViewAttached();
    state.mode='docked'; persist(); broadcast(); setImmediate(applyDockLayout);
    try {
      if(!enterDocked.__diagLogged){
        enterDocked.__diagLogged = true;
        const cnt = (typeof mainWindow.listenerCount === 'function') ? mainWindow.listenerCount('closed') : 'n/a';
        console.log('[board][diag] mainWindow closed listeners after enterDocked =', cnt);
      }
    } catch(_){ }
  }
  function enterHidden(){
    // Do NOT destroy dockView to avoid repeated addBrowserView (leads to internal 'closed' listener accumulation).
    hideDockView();
    if(win){ try { win.close(); } catch(_){} }
    state.mode='hidden'; persist(); broadcast();
    if(layoutManager && layoutManager.setDockOffsets) layoutManager.setDockOffsets(null);
  }
  function enterWindow(){
    // Instead of destroying the dock BrowserView (which triggers removeBrowserView -> future re-add creates new internal 'closed' listener on mainWindow), just hide it.
    hideDockView();
    createWindow();
    state.mode='window';
    persist();
    broadcast();
    if(layoutManager && layoutManager.setDockOffsets) layoutManager.setDockOffsets(null);
    try {
      if(!enterWindow.__diagLogged){
        enterWindow.__diagLogged = true;
        const cnt = (typeof mainWindow.listenerCount === 'function') ? mainWindow.listenerCount('closed') : 'n/a';
        console.log('[board][diag] mainWindow closed listeners after enterWindow =', cnt);
      }
    } catch(_){ }
  }

  function toggle(){
    if(state.mode==='hidden') enterDocked();
    else if(state.mode==='docked') enterHidden();
    else if(state.mode==='window') enterHidden(); // window -> hidden
  }
  function detach(){ if(state.mode==='docked') enterWindow(); }
  function attach(){ if(state.mode==='window' || state.mode==='hidden') enterDocked(); }
  function setSide(side){ if(side!=='left'&&side!=='right') return; state.side=side; persist(); if(state.mode==='docked'){ applyDockLayout(); broadcast(); } }
  function setWidth(w){ const nw = Math.max(MIN_W, Math.min(MAX_W, Math.round(w))); if(nw===state.width) return; state.width=nw; persist(); if(state.mode==='docked'){ applyDockLayout(); broadcast(); } }

  function broadcast(){ const payload = getState(); try { if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('board-updated', payload); } catch(_){} if(win && !win.isDestroyed()) try { win.webContents.send('board-updated', payload); } catch(_){} }

  function init(){
    if(state.mode==='window') enterWindow(); else if(state.mode==='hidden') enterHidden(); else enterDocked();
  }

  function handleIpc(ch,p){
    switch(ch){
      case 'board-toggle': toggle(); break;
      case 'board-detach': detach(); break;
      case 'board-attach': attach(); break;
      case 'board-set-side': setSide(p && p.side); break;
      case 'board-set-width': setWidth(p && p.width); break;
      case 'board-replay': replayOdds(); break;
    }
  }

  function handleStageResized(){ if(state.mode==='docked') applyDockLayout(); }

  function getWebContents(){
    try {
      if(state.mode==='window' && win && !win.isDestroyed()) return win.webContents;
      if(state.mode==='docked' && dockView && dockView.webContents && !dockView.webContents.isDestroyed()) return dockView.webContents;
      return null;
    } catch(_){ return null; }
  }

  return { getState, init, toggle, detach, attach, setSide, setWidth, handleIpc, replayOdds, sendOdds, handleStageResized, applyDockLayout, getWebContents };
}

module.exports = { createBoardManager };
