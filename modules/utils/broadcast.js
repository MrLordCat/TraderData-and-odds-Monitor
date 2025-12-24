// Broadcast utilities for main process
// Eliminates duplicate broadcast patterns across main.js

/**
 * Broadcast a message to all relevant webContents (board, main, stats views)
 * @param {object} ctx - Context object with references
 * @param {string} channel - IPC channel name
 * @param {*} [payload] - Optional payload
 */
function broadcastToAll(ctx, channel, payload){
  const { mainWindow, boardManager, statsManager, boardWindow } = ctx;
  
  // For auto-toggle-all, only send to board (which owns Auto logic)
  const isAutoToggle = channel === 'auto-toggle-all';
  
  if(isAutoToggle){
    console.log('[broadcast] auto-toggle-all -> board only');
  }
  
  // Board (docked or window) - always receives
  try {
    const bwc = boardManager?.getWebContents?.() || 
                (boardWindow && !boardWindow.isDestroyed() ? boardWindow.webContents : null);
    if(bwc && !bwc.isDestroyed()) bwc.send(channel, payload);
  } catch(e){ console.error('[broadcast] board error:', e); }
  
  // For auto-toggle-all, skip other views - board will broadcast auto-active-set
  if(isAutoToggle) return;
  
  // Main window
  try {
    if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
  } catch(_){ }
  
  // Stats views (panel, A, B) - skip for auto-toggle
  try {
    if(statsManager?.views){
      const vs = statsManager.views;
      ['panel','A','B'].forEach(k => {
        try {
          const v = vs[k];
          if(v?.webContents && !v.webContents.isDestroyed()){
            v.webContents.send(channel, payload);
          }
        } catch(_){ }
      });
    }
  } catch(_){ }
}

/**
 * Create a broadcast function bound to context
 * @param {object} ctx - Context object with references
 * @returns {Function} Broadcast function (channel, payload) => void
 */
function createBroadcaster(ctx){
  return (channel, payload) => broadcastToAll(ctx, channel, payload);
}

/**
 * Get board webContents (docked or window)
 * @param {object} ctx - Context with boardManager, boardWindow
 * @returns {WebContents|null}
 */
function getBoardWebContents(ctx){
  try {
    const { boardManager, boardWindow } = ctx;
    const bwc = boardManager?.getWebContents?.() ||
                (boardWindow && !boardWindow.isDestroyed() ? boardWindow.webContents : null);
    return (bwc && !bwc.isDestroyed()) ? bwc : null;
  } catch(_){ return null; }
}

/**
 * Get all stats webContents as array
 * @param {object} ctx - Context with statsManager
 * @returns {WebContents[]}
 */
function getStatsWebContentsList(ctx){
  const out = [];
  try {
    if(ctx.statsManager?.views){
      const vs = ctx.statsManager.views;
      ['panel','A','B'].forEach(k => {
        try {
          const v = vs[k];
          if(v?.webContents && !v.webContents.isDestroyed()) out.push(v.webContents);
        } catch(_){ }
      });
    }
  } catch(_){ }
  return out;
}

module.exports = {
  broadcastToAll,
  createBroadcaster,
  getBoardWebContents,
  getStatsWebContentsList
};
