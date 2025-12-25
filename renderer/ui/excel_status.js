// Shared Excel Extractor status UI logic
// Eliminates duplication between board.js and stats_embedded.js

// Lazy getter for MiniToast - resolves at call time, not load time
function getMiniToast(){
  if(typeof window !== 'undefined' && window.MiniToast) return window.MiniToast;
  try { return require('./toast'); } catch(_){ }
  return null;
}

/**
 * Parse Excel extractor status into display lines
 * @param {object} s - Status object { running, starting, installing, error }
 * @returns {{ lines: string[], kind: string }}
 */
function parseStatus(s){
  const pyOn = !!(s && s.running);
  const pyErr = (s && s.error) ? String(s.error) : '';
  const lines = [
    'Python: ' + (pyOn ? 'ON' : 'OFF') + (pyErr ? ' ('+pyErr+')' : '')
  ];
  const kind = pyErr ? 'err' : 'ok';
  return { lines, kind };
}

/**
 * Get status text for display cell
 * @param {object} s - Status object
 * @returns {string}
 */
function getStatusText(s){
  if(!s) return 'idle';
  if(s.installing) return 'installing...';
  if(s.starting) return 'starting';
  if(s.running) return 'running';
  if(s.error) return 'error';
  return 'idle';
}

/**
 * Compute signature for change detection
 * @param {object} s - Status object
 * @returns {string}
 */
function computeStatusSig(s){
  if(!s) return '';
  const pyErr = s.error ? String(s.error) : '';
  return [
    s.installing ? 'I' : '',
    s.starting ? 'S' : '',
    s.running ? 'R' : '',
    pyErr ? ('E:'+pyErr) : ''
  ].join('|');
}

/**
 * Check if status change is important enough to show toast
 * @param {object} s - Status object
 * @returns {boolean}
 */
function isImportantChange(s){
  if(!s) return false;
  return !!(s.starting || s.running || s.error);
}

/**
 * Show toast near element
 */
function showToast(el, lines, kind){
  const MiniToast = getMiniToast();
  if(MiniToast && MiniToast.showMiniToastNear){
    MiniToast.showMiniToastNear(el, lines, kind);
  } else {
    // Minimal fallback
    try {
      const toast = document.createElement('div');
      toast.className = 'miniToast ' + (kind||'');
      (lines||[]).forEach(t=>{ const s=document.createElement('span'); s.className='line'; s.textContent=t; toast.appendChild(s); });
      document.body.appendChild(toast);
      const r = el.getBoundingClientRect();
      toast.style.left = Math.min(Math.max(8, r.left), window.innerWidth - 300) + 'px';
      toast.style.top = (r.bottom + 8) + 'px';
      requestAnimationFrame(()=> toast.classList.add('show'));
      const ttl = kind==='err' ? 3800 : 2200;
      setTimeout(()=>{ try { toast.remove(); } catch(_){} }, ttl + 260);
    } catch(_){ }
  }
}

/**
 * Clear any active toast
 */
function clearToast(){
  try {
    const MiniToast = getMiniToast();
    if(MiniToast && MiniToast.clearToast) MiniToast.clearToast();
    else document.querySelectorAll('.miniToast').forEach(t=>t.remove());
  } catch(_){ }
}

/**
 * Bind Excel status button with hover/click/status logic
 * @param {object} opts - { btn, statusEl, toggle, onStatus, scriptMapBadge, getBoardMap }
 * @returns {object} - { applyStatus }
 */
function bindExcelStatusButton(opts){
  const { btn, statusEl, toggle, onStatus, scriptMapBadge, getBoardMap } = opts;
  
  let excelTogglePendingTs = 0;
  let lastStatusSig = '';
  let lastAutoToastTs = 0;
  let lastHoverLines = null;
  let lastHoverKind = 'ok';
  let lastScriptMap = null;
  
  function updateScriptMapBadge(status){
    if(!scriptMapBadge) return;
    
    // Show dash if script is not running
    const isRunning = status && status.running;
    const scriptMap = (isRunning && status && typeof status.scriptMap === 'number') ? status.scriptMap : null;
    lastScriptMap = scriptMap;
    
    if(scriptMap === null){
      scriptMapBadge.textContent = '-';
      scriptMapBadge.className = 'scriptMapBadge';
      scriptMapBadge.title = isRunning 
        ? 'Script map unknown (Python hotkey controller not running?)' 
        : 'Script not running';
    } else {
      scriptMapBadge.textContent = String(scriptMap);
      // Compare with board map
      const boardMap = (typeof getBoardMap === 'function') ? getBoardMap() : null;
      const matches = (boardMap !== null && !isNaN(boardMap) && boardMap === scriptMap);
      scriptMapBadge.className = 'scriptMapBadge ' + (matches ? 'match' : 'mismatch');
      scriptMapBadge.title = matches 
        ? `Script map: ${scriptMap} (matches board)`
        : `Script map: ${scriptMap} (MISMATCH! Board: ${boardMap || '?'})`;
    }
    
    // Update AutoHub about script map for auto mode blocking
    if(typeof window !== 'undefined' && window.AutoHub && typeof window.AutoHub.setScriptMap === 'function'){
      window.AutoHub.setScriptMap(scriptMap);
    }
  }
  
  function applyStatus(s){
    try {
      if(!s) return;
      
      // Update button state
      if(btn) btn.classList.toggle('on', !!s.running);
      
      // Update status cell text
      if(statusEl){
        const text = getStatusText(s);
        statusEl.dataset.last = text;
        if(text === 'idle'){
          statusEl.style.display = 'none';
          statusEl.textContent = 'idle';
        } else {
          statusEl.style.display = 'inline';
          statusEl.textContent = text;
        }
      }
      
      // Update script map badge
      updateScriptMapBadge(s);
      
      // Parse for tooltip
      const parsed = parseStatus(s);
      lastHoverLines = parsed.lines;
      lastHoverKind = parsed.kind;
      
      // Show toast if user just clicked toggle
      if(btn && excelTogglePendingTs && (Date.now() - excelTogglePendingTs) < 1800){
        showToast(btn, parsed.lines, parsed.kind);
        excelTogglePendingTs = 0;
      }
      
      // Show toast on important status changes (e.g. hotkey toggle)
      if(btn && !excelTogglePendingTs){
        const sig = computeStatusSig(s);
        const changed = !!lastStatusSig && sig !== lastStatusSig;
        const important = isImportantChange(s);
        const now = Date.now();
        if(changed && important && (now - lastAutoToastTs) > 1200){
          showToast(btn, parsed.lines, parsed.kind);
          lastAutoToastTs = now;
        }
        lastStatusSig = sig;
      }
      
      // Callback
      if(onStatus) onStatus(s, parsed);
    } catch(_){ }
  }
  
  // Method to refresh badge when board map changes
  function refreshBadgeMatch(){
    if(!scriptMapBadge || lastScriptMap === null) return;
    const boardMap = (typeof getBoardMap === 'function') ? getBoardMap() : null;
    const matches = (boardMap !== null && !isNaN(boardMap) && boardMap === lastScriptMap);
    scriptMapBadge.className = 'scriptMapBadge ' + (matches ? 'match' : 'mismatch');
    scriptMapBadge.title = matches 
      ? `Script map: ${lastScriptMap} (matches board)`
      : `Script map: ${lastScriptMap} (MISMATCH! Board: ${boardMap || '?'})`;
    // Update AutoHub board map
    if(typeof window !== 'undefined' && window.AutoHub && typeof window.AutoHub.setBoardMap === 'function'){
      window.AutoHub.setBoardMap(boardMap);
    }
  }
  
  // Bind button events
  if(btn && !btn.dataset.excelStatusBound){
    btn.dataset.excelStatusBound = '1';
    
    btn.addEventListener('click', ()=>{
      excelTogglePendingTs = Date.now();
      try { toggle && toggle(); } catch(_){ }
    });
    
    btn.addEventListener('mouseenter', ()=>{
      try {
        if(lastHoverLines && lastHoverLines.length){
          showToast(btn, lastHoverLines, lastHoverKind);
        }
      } catch(_){ }
    });
    
    btn.addEventListener('mouseleave', ()=>{
      clearToast();
    });
  }
  
  return { applyStatus, refreshBadgeMatch };
}

// Export
if(typeof module !== 'undefined' && module.exports){
  module.exports = { parseStatus, getStatusText, computeStatusSig, isImportantChange, showToast, clearToast, bindExcelStatusButton };
}
try { window.ExcelStatusUI = { parseStatus, getStatusText, computeStatusSig, isImportantChange, showToast, clearToast, bindExcelStatusButton }; } catch(_){ }
