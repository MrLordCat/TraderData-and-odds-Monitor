// Unified BrowserWindow/BrowserView lifecycle helpers.
// Goal: eliminate duplicate patterns (ensureSingleClosedListener, hide via zero bounds, safe attach, safe bounds updates)
// to reduce risk of internal Electron listener accumulation.

const { BrowserWindow, BrowserView } = require('electron');

/**
 * Ensure a one-time 'closed' listener is attached per logical key.
 * Avoids stacking duplicate handlers when code paths run repeatedly.
 */
function ensureSingleClosedListener(win, key, fn){
  if(!win || typeof win.on!== 'function') return;
  try {
    if(!win.__closedGuards) win.__closedGuards = new Map();
    if(win.__closedGuards.has(key)) return; // already attached
    win.__closedGuards.set(key, fn);
    win.once('closed', fn);
  } catch(_){ }
}

/** Hide a BrowserView by collapsing it to 0x0 (without removing). */
function hideView(view){ if(!view) return; try { view.setBounds({ x:0,y:0,width:0,height:0 }); } catch(_){ } }

/** Show (restore) a BrowserView with provided bounds (safe). */
function showView(view, bounds){ if(!view) return; try { view.setBounds(bounds); } catch(_){ } }

/** Safely set bounds if both window and view alive. */
function setViewBoundsSafe(view, bounds){ if(!view) return; try { view.setBounds(bounds); } catch(_){ } }

/** Attach view to window only if not already attached. */
function attachViewOnce(win, view){
  if(!win || !view) return;
  try {
    const attached = win.getBrowserViews().includes(view);
    if(!attached) win.addBrowserView(view);
  } catch(_){ }
}

module.exports = { ensureSingleClosedListener, hideView, showView, setViewBoundsSafe, attachViewOnce };
