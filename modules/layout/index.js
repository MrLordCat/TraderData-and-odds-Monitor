// Layout / preset management extracted from main.js
// Provides grid preset application, basic flow relayout, and helper bounds sanitation.

const { constants } = require('..');
function createLayoutManager({ store, mainWindowRef, views, BROKERS, stageBoundsRef, activeBrokerIdsRef, GAP = constants.VIEW_GAP }) {
  // New semantics: preset id like "1x2x3" means rows with 1,2,3 brokers respectively.
  const LAYOUT_PRESETS = {
    '1x1': { pattern: [1,1] },
    '1x2': { pattern: [1,2] },
    '1x1x1': { pattern: [1,1,1] },
    '1x2x2': { pattern: [1,2,2] },
    '2x2': { pattern: [2,2] },
    '2x3': { pattern: [2,3] },
    '2': { pattern: [2] },
    '1x1x2': { pattern: [1,1,2] },
    '2x2x2': { pattern: [2,2,2] }
  };

  let currentPresetId = null;

  function getCurrentPresetId() { return currentPresetId; }

  function clampViewToStage(id) {
    const stage = stageBoundsRef.value;
    const v = views[id]; if (!v) return;
    const b = v.getBounds();
    const nb = { ...b };
    nb.x = Math.max(stage.x, Math.min(stage.x + stage.width - nb.width, nb.x));
    nb.y = Math.max(stage.y, Math.min(stage.y + stage.height - nb.height, nb.y));
    if (nb.x !== b.x || nb.y !== b.y) v.setBounds(nb);
  }

  function sanitizeInitialBounds(existing, fallbackX) {
    const stage = stageBoundsRef.value;
    const dWidth = 420;
    const dHeight = 320;
    let b = existing ? { ...existing } : { x: fallbackX, y: stage.y, width: dWidth, height: dHeight };
    if (!b.width || b.width < 100) b.width = dWidth;
    if (!b.height || b.height < 80) b.height = dHeight;
    if (b.width > stage.width) b.width = Math.max(260, Math.min(stage.width, dWidth));
    if (b.height > stage.height) b.height = Math.max(160, Math.min(stage.height, dHeight));
    const outHoriz = b.x + b.width < stage.x || b.x > stage.x + stage.width;
    const outVert = b.y + b.height < stage.y || b.y > stage.y + stage.height;
    if (outHoriz || outVert) {
      b.x = fallbackX;
      b.y = stage.y;
    }
    if (b.x < stage.x) b.x = stage.x;
    if (b.y < stage.y) b.y = stage.y;
    return b;
  }

  // Optional dock offsets provided by board manager: { side:'left'|'right', width }
  let dockOffsets = null;
  function effectiveStage(){
    const base = { ...stageBoundsRef.value };
    if(dockOffsets && base && base.width){
      const w = Math.min(dockOffsets.width, Math.max(0, base.width - 100));
      if(dockOffsets.side === 'left'){
        base.x += w;
        base.width -= w;
      } else {
        base.width -= w;
      }
    }
    return base;
  }
  function setDockOffsets(o){ dockOffsets = o || null; try { relayoutAll(); } catch(_){} }

  function relayoutAll() {
    const stage = effectiveStage();
    let cursorX = stage.x;
    let cursorY = stage.y;
    const lineH = [];
    for (const b of BROKERS) {
      if (!views[b.id]) continue;
      const view = views[b.id];
      const vb = view.getBounds();
      if (cursorX + vb.width > stage.x + stage.width) {
        cursorX = stage.x;
        cursorY += (lineH.length ? Math.max(...lineH) : 0) + GAP;
        lineH.length = 0;
      }
      view.setBounds({ x: cursorX, y: cursorY, width: vb.width, height: vb.height });
      lineH.push(vb.height);
      cursorX += vb.width + GAP;
    }
  }

  function applyLayoutPreset(presetId) {
    const stage = effectiveStage();
    let preset = LAYOUT_PRESETS[presetId];
    if (!preset) {
      // Attempt dynamic parse (numbers separated by 'x')
      const parts = presetId.split('x').map(p=>parseInt(p,10)).filter(n=>!isNaN(n)&&n>0);
      if(parts.length){ preset = { pattern: parts }; }
    }
    if (!preset) { console.warn('Unknown layout preset', presetId); return; }
    currentPresetId = presetId;
    try { store.set('layoutPreset', presetId); } catch (e) {}
    if (!mainWindowRef.value) { // window not ready yet
      return; }
    const activeBrokerIds = activeBrokerIdsRef.value;
    // Support dynamic/pseudo brokers (e.g. dataservices) that are not present in static BROKERS list
    const activeBrokers = activeBrokerIds.map(id => {
      const def = BROKERS.find(b=>b.id===id);
      if(def) return def;
      // Create minimal stub so layout can size it
      if(views[id]){
        try {
          const vb = views[id].getBounds();
          return { id, url: 'about:blank', width: vb.width, height: vb.height };
        } catch(_) { return { id, url:'about:blank' }; }
      }
      return null;
    }).filter(Boolean);
    // Allow zero active brokers: still render slot placeholders so user can add
    const rowPattern = preset.pattern ? preset.pattern.slice() : [];
    const rows = rowPattern.length;
    const slotCount = rowPattern.reduce((a,b)=>a+b,0);
    // Heights: equal per row currently
    const heightBase = Math.floor((stage.height - GAP * (rows - 1)) / rows);
    const extraH = (stage.height - GAP * (rows - 1)) - heightBase * (rows - 1);
    const rowHeight = r => (r === rows - 1 ? extraH : heightBase);
    // Remove outdated slot views
    Object.keys(views).filter(id => id.startsWith('slot-')).forEach(id => {
      const idx = parseInt(id.split('-')[1], 10);
      if (isNaN(idx) || idx >= slotCount || idx < activeBrokers.length) {
        try { mainWindowRef.value.removeBrowserView(views[id]); } catch (e) {}
        delete views[id];
      }
    });
    // Map linear index to row/col per pattern
    for (let idx = 0, placed = 0; idx < slotCount; idx++) {
      // find row
      let r = 0, acc = 0;
      for (; r < rowPattern.length; r++) { const rowCols = rowPattern[r]; if (idx < acc + rowCols) break; acc += rowCols; }
      const rowCols = rowPattern[r];
      const c = idx - (rowPattern.slice(0,r).reduce((a,b)=>a+b,0));
      const rowY = stage.y + rowPattern.slice(0,r).reduce((sum,_,ri)=> sum + rowHeight(ri) + (ri>0?GAP:0), 0);
      const h = rowHeight(r);
      const widthBase = Math.floor((stage.width - GAP * (rowCols - 1)) / rowCols);
      const extraW = (stage.width - GAP * (rowCols - 1)) - widthBase * (rowCols - 1);
      const colWidth = cc => (cc === rowCols - 1 ? extraW : widthBase);
      const x = stage.x + c * (widthBase + GAP);
      const w = colWidth(c);
      const y = rowY;
      if (idx < activeBrokers.length) {
        const b = activeBrokers[idx];
        if (!views[b.id]) continue;
        try { views[b.id].setBounds({ x, y, width: w, height: h }); } catch (e) {}
      } else {
        const slotId = 'slot-' + idx;
        if (!views[slotId]) {
          const { BrowserView } = require('electron');
          const path = require('path');
          const slotView = new BrowserView({
            webPreferences: {
              preload: path.join(__dirname, '..','..','slotPreload.js'),
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: false,
              partition: 'persist:slot-' + idx
            }
          });
          try { slotView.setBackgroundColor('#00000000'); } catch(_) {}
          views[slotId] = slotView;
          mainWindowRef.value.addBrowserView(slotView);
          try { slotView.webContents.loadFile(path.join(__dirname,'..','..','renderer','slot.html'), { query: { slot: String(idx), preset: presetId } }); } catch (e) {}
        }
        try { views[slotId].setBounds({ x, y, width: w, height: h }); } catch (e) {}
      }
    }
    const layout = {};
    for (const [id, v] of Object.entries(views)) { if (!id.startsWith('slot-')) try { layout[id] = v.getBounds(); } catch (e) {} }
    store.set('layout', layout);
  }

  function setMainWindow(win){ mainWindowRef.value = win; }

  return {
    LAYOUT_PRESETS,
    getCurrentPresetId,
    applyLayoutPreset,
    sanitizeInitialBounds,
    clampViewToStage,
    relayoutAll,
  setMainWindow,
  setDockOffsets
  };
}

module.exports = { createLayoutManager };
