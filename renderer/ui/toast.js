// Shared mini-toast utility for renderer UI
// Eliminates duplicate showMiniToastNear implementations across board.js, auto_trader.js, etc.

let _activeToast = null;

/**
 * Show a small ephemeral toast near an anchor element.
 * @param {HTMLElement} anchor - Element to position toast near
 * @param {string[]} lines - Array of text lines to show
 * @param {string} [kind='ok'] - 'ok' or 'err' for styling
 * @param {object} [opts] - Optional overrides { ttl, gap }
 * @returns {HTMLElement|null} The toast element
 */
function showMiniToastNear(anchor, lines, kind, opts){
  // Remove previous toast if any
  try { if(_activeToast && _activeToast.parentNode) _activeToast.parentNode.removeChild(_activeToast); } catch(_){ }
  _activeToast = null;
  
  try {
    if(!anchor) return null;
    const r = anchor.getBoundingClientRect();
    const toast = document.createElement('div');
    toast.className = 'miniToast ' + (kind || 'ok');
    (lines || []).forEach(t => {
      const line = document.createElement('span');
      line.className = 'line';
      line.textContent = String(t);
      toast.appendChild(line);
    });
    document.body.appendChild(toast);
    
    const gap = (opts && opts.gap) || 8;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - 300);
    const top = Math.min(Math.max(8, r.bottom + gap), window.innerHeight - 80);
    toast.style.left = left + 'px';
    toast.style.top = top + 'px';
    
    requestAnimationFrame(() => toast.classList.add('show'));
    _activeToast = toast;
    
    const ttl = (opts && opts.ttl) || (kind === 'err' ? 3800 : 2200);
    setTimeout(() => { try { toast.classList.remove('show'); } catch(_){ } }, ttl);
    setTimeout(() => { try { if(toast && toast.parentNode) toast.parentNode.removeChild(toast); } catch(_){ } }, ttl + 260);
    
    return toast;
  } catch(_){ return null; }
}

/**
 * Clear any active toast immediately
 */
function clearToast(){
  try { if(_activeToast && _activeToast.parentNode) _activeToast.parentNode.removeChild(_activeToast); } catch(_){ }
  _activeToast = null;
}

/**
 * Get current active toast element (if any)
 */
function getActiveToast(){ return _activeToast; }

// Export for CommonJS (Electron renderer) and also attach to window for inline scripts
if(typeof module !== 'undefined' && module.exports){
  module.exports = { showMiniToastNear, clearToast, getActiveToast };
}
try { window.MiniToast = { showMiniToastNear, clearToast, getActiveToast }; } catch(_){ }
