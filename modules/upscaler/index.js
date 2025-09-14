// FrameGen (temporal smoothing) public manager for slot A.
// Previous upscaling & ML logic removed – this module now only injects a lightweight
// engine that hides the original video element and performs frame generation
// (blending synthetic frames between real ones) with a target FPS gate.
// Persistence keys trimmed to: videoUpscalerAFrameGen, videoUpscalerATargetFps.
// Legacy keys (Enabled/Scale/Mode/ModelUrl/DelayMs) are ignored but left in store untouched.
const fs = require('fs');
const path = require('path');

function createUpscalerManager({ store }) {
  const state = {
    frameGen: !!store.get('videoUpscalerAFrameGen'),
    targetFps: store.get('videoUpscalerATargetFps') || 60
  };

  function persist(){
    try {
      console.log('[framegen][manager] persist', JSON.stringify(state));
      store.set('videoUpscalerAFrameGen', !!state.frameGen);
      store.set('videoUpscalerATargetFps', state.targetFps);
    } catch(e){ console.warn('[framegen][manager] persist error', e); }
  }

  function getState(){ return { ...state }; }

  function setConfig(cfg={}){
    const before = { ...state };
    if(cfg.frameGen!== undefined) state.frameGen = !!cfg.frameGen;
  if(cfg.targetFps!== undefined){ const tf = parseInt(cfg.targetFps,10); if(!isNaN(tf)) state.targetFps = Math.min(160, Math.max(24, tf)); }
    console.log('[framegen][manager] setConfig', cfg, 'prev=', before, 'next=', state);
    persist();
  }

  function inject(view){
    if(!view){ console.log('[framegen][manager] inject skipped (no view)'); return; }
    if(!state.frameGen){ console.log('[framegen][manager] inject skipped (frameGen disabled)'); return; }
    const payload = { frameGen: state.frameGen, targetFps: state.targetFps };
    try {
      const enginePath = path.join(__dirname, 'engine.js');
      const engineCode = fs.readFileSync(enginePath, 'utf8');
      const bootstrap = `window.__UPS_DEBUG=true; window.__UPS_CFG=${JSON.stringify(payload)};`;
      console.log('[framegen][manager] executing injection', payload);
      view.webContents.executeJavaScript(bootstrap + '\n' + engineCode + `\n;(window.__UPS_UPDATE && window.__UPS_UPDATE(${JSON.stringify(payload)}));`).catch(err=> console.warn('[framegen][manager] executeJavaScript rejected', err));
    } catch(e){ console.warn('[framegen][manager] inject error', e); }
  }

  function maybeInject(view, slot){
    if(slot !== 'A') return; // only slot A
    if(!state.frameGen){ console.log('[framegen][manager] maybeInject skip (frameGen disabled)'); return; }
    console.log('[framegen][manager] maybeInject slot A (injecting FrameGen)');
    inject(view);
  }

  return { getState, setConfig, maybeInject, inject };
}

module.exports = { createUpscalerManager };
