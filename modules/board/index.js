// Virtual Board manager: no longer creates its own BrowserView.
// Manages side/width state, dock offsets, and forwards odds to unified stats panel.
// The stats panel's embedded odds section is now the primary odds display.
// Public API: createBoardManager({...}) -> { getState, init, setSide, setWidth, handleIpc, replayOdds, sendOdds, handleStageResized, applyDockLayout, getWebContents, getPanelWebContents, setStatsPanelRef }

const path = require('path');

function createBoardManager({ mainWindow, store, layoutManager, latestOddsRef, activeBrokerIdsRef, replayOddsFn, stageBoundsRef, hotkeys }){
  // State: side + width persisted for the unified side panel
  let state = { 
    mode: 'docked', 
    side: store.get('boardSide') || 'right', 
    width: store.get('boardWidth') || 360  // Default matches STATS_PANEL_WIDTH
  };
  const MIN_W = 280; 
  const MAX_W = 600;
  
  // Reference to stats panel BrowserView (set by statsManager after creation)
  let statsPanelRef = { value: null };

  function persist(){ 
    try { 
      store.set('boardSide', state.side); 
      store.set('boardWidth', state.width); 
    } catch(_){} 
  }
  
  function getState(){ return { side: state.side, width: state.width }; }

  // Allow statsManager to inject panel reference
  function setStatsPanelRef(ref){
    statsPanelRef = ref || { value: null };
  }

  // Get the stats panel webContents (unified panel replaces separate board view)
  function getPanelWebContents(){
    try {
      if(statsPanelRef && statsPanelRef.value && statsPanelRef.value.webContents && !statsPanelRef.value.webContents.isDestroyed()){
        return statsPanelRef.value.webContents;
      }
    } catch(_){}
    return null;
  }

  // For backward compatibility - returns panel webContents
  function getWebContents(){
    return getPanelWebContents();
  }

  function applyDockLayout(){
    if(!mainWindow || mainWindow.isDestroyed()) return;
    const w = Math.max(MIN_W, Math.min(MAX_W, state.width));
    // Notify layoutManager about dock offset (shrinks broker stage area)
    layoutManager && layoutManager.setDockOffsets && layoutManager.setDockOffsets({ side: state.side, width: w });
  }

  function replayOdds(){
    try {
      const targetWc = getPanelWebContents();
      if(!targetWc) return;
      const ids = activeBrokerIdsRef.value.slice();
      // Ensure virtual excel broker included for replay
      if(!ids.includes('excel')) ids.push('excel');
      targetWc.send('brokers-sync', { ids });
      ids.forEach(id=>{
        const p = latestOddsRef.value[id];
        if(p) targetWc.send('odds-update', p); 
        else replayOddsFn && replayOddsFn(id);
      });
    } catch(e){ }
  }

  function sendOdds(payload){
    try {
      const targetWc = getPanelWebContents();
      if(targetWc) targetWc.send('odds-update', payload);
    } catch(_){}
  }

  function setSide(side){
    if(side!=='left'&&side!=='right') return;
    state.side=side; 
    persist();
    applyDockLayout();
    broadcast();
  }

  function setWidth(w){
    const nw = Math.max(MIN_W, Math.min(MAX_W, Math.round(w)));
    if(nw===state.width) return;
    state.width=nw; 
    persist();
    applyDockLayout();
    broadcast();
  }

  function broadcast(){
    const payload = getState();
    try { 
      if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('board-updated', payload); 
    } catch(_){}
    try { 
      const panelWc = getPanelWebContents();
      if(panelWc) panelWc.send('board-updated', payload); 
    } catch(_){ }
  }

  function init(){ 
    // No BrowserView creation - just apply layout offsets
    // Stats panel will be created by statsManager and will handle odds display
    setImmediate(applyDockLayout);
    [90,280,650].forEach(ms=> setTimeout(()=>{ try { applyDockLayout(); } catch(_){ } }, ms));
  }

  function handleIpc(ch,p){
    switch(ch){
      case 'board-set-side': setSide(p && p.side); break;
      case 'board-set-width': setWidth(p && p.width); break;
      case 'board-replay': replayOdds(); break;
    }
  }

  function handleStageResized(){ applyDockLayout(); }

  return { getState, init, setSide, setWidth, handleIpc, replayOdds, sendOdds, handleStageResized, applyDockLayout, getWebContents, getPanelWebContents, setStatsPanelRef };
}

module.exports = { createBoardManager };
