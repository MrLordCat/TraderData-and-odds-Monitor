// Board manager (simplified): always docked BrowserView inside main window.
// Detached/window/hidden modes removed. Persist only side + width.
// Public API: createBoardManager({...}) -> { getState, init, setSide, setWidth, handleIpc, replayOdds, sendOdds, handleStageResized, applyDockLayout, getWebContents }

const path = require('path');
const { BrowserView } = require('electron');
const { ensureSingleClosedListener, hideView } = require('../utils/views');

// ensureVisibleBounds removed (window mode dropped)

function createBoardManager({ mainWindow, store, layoutManager, latestOddsRef, activeBrokerIdsRef, replayOddsFn, stageBoundsRef }){
  let state = { mode: 'docked', side: store.get('boardSide') || 'right', width: store.get('boardWidth') || 320 };
  const MIN_W = 240; const MAX_W = 800;
  let dockView = null; // Single BrowserView

  // ensureSingleClosedListener now imported from utils/views.js

  function persist(){ try { store.set('boardSide', state.side); store.set('boardWidth', state.width); } catch(_){} }
  function getState(){ return { side: state.side, width: state.width }; }

  function applyDockLayout(){
    if(!mainWindow || mainWindow.isDestroyed()) return;
    // shrink broker stage via layoutManager by adjusting stage bounds offset
    const size = mainWindow.getContentSize ? mainWindow.getContentSize() : [0,0];
    const contentW = Math.max(0, Number(size[0])||0);
    const contentH = Math.max(0, Number(size[1])||0);
    // Stage bounds (area brokers occupy) already exclude toolbar (renderer sends set-stage-bounds)
    const stageBounds = stageBoundsRef && stageBoundsRef.value ? stageBoundsRef.value : { x:0, y:0, width:contentW, height:contentH };
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
  if(state.side==='left') dockView.setBounds({ x: 0, y, width: w, height: h });
  else dockView.setBounds({ x: Math.max(0, contentW - w), y, width: w, height: h });
        // Ensure z-order (board should stay above brokers but below overlays added later).
        try {
          const all = mainWindow.getBrowserViews();
          if(all[all.length-1] !== dockView){
            // Re-append to top without destroying contents (cheap reorder)
            mainWindow.removeBrowserView(dockView);
            mainWindow.addBrowserView(dockView);
          }
        } catch(_){ }
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

  // createWindow removed (window mode deleted)
  function replayOdds(){
    try {
  const targetWc = dockView? dockView.webContents: null;
      if(!targetWc) return;
      const ids = activeBrokerIdsRef.value.slice();
      // Ensure virtual excel broker included for replay
      if(!ids.includes('excel')) ids.push('excel');
      targetWc.send('brokers-sync', { ids });
      ids.forEach(id=>{
        const p = latestOddsRef.value[id];
        if(p) targetWc.send('odds-update', p); else replayOddsFn && replayOddsFn(id);
      });
    } catch(e){ }
  }
  function sendOdds(payload){
    try {
  const targetWc = dockView && dockView.webContents && !dockView.webContents.isDestroyed() ? dockView.webContents : null;
      if(targetWc) targetWc.send('odds-update', payload);
    } catch(_){}
  }

  function ensureDocked(){
    state.mode = 'docked';
    if(!dockView) createDockView(); else ensureDockViewAttached();
    setImmediate(applyDockLayout);
    [90,280,650].forEach(ms=> setTimeout(()=>{ try { applyDockLayout(); } catch(_){ } }, ms));
  }
  function setSide(side){
    if(side!=='left'&&side!=='right') return;
    state.side=side; persist();
    if(dockView){ applyDockLayout(); broadcast(); }
  }
  function setWidth(w){
    const nw = Math.max(MIN_W, Math.min(MAX_W, Math.round(w)));
    if(nw===state.width) return;
    state.width=nw; persist();
    if(dockView){ applyDockLayout(); broadcast(); }
  }

  function broadcast(){
    const payload = getState();
    try { if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('board-updated', payload); } catch(_){}
    try { if(dockView && dockView.webContents && !dockView.webContents.isDestroyed()) dockView.webContents.send('board-updated', payload); } catch(_){ }
  }

  function init(){ ensureDocked(); }

  function handleIpc(ch,p){
    switch(ch){
  // toggle/detach/attach removed
      case 'board-set-side': setSide(p && p.side); break;
      case 'board-set-width': setWidth(p && p.width); break;
      case 'board-replay': replayOdds(); break;
    }
  }

  function handleStageResized(){ if(dockView) applyDockLayout(); }

  function getWebContents(){
    try {
      if(dockView && dockView.webContents && !dockView.webContents.isDestroyed()) return dockView.webContents;
      return null;
    } catch(_){ return null; }
  }

  return { getState, init, setSide, setWidth, handleIpc, replayOdds, sendOdds, handleStageResized, applyDockLayout, getWebContents };
}

module.exports = { createBoardManager };
