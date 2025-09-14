// FrameGen engine injected into stats slot A pages.
// Performs lightweight frame generation (temporal interpolation by blending
// previous + current captured frames) and draws at a capped target FPS.
// Original upscaling, ML inference, delay buffering removed.

(function(){
  const VERSION = 3; // increment after refactor (FrameGen-only)
  if(window.__UPSCALER_A_VERSION && window.__UPSCALER_A_VERSION >= VERSION){
    return; // already initialized
  }
  window.__UPSCALER_A_VERSION = VERSION;
  if(window.__UPS_DEBUG) console.log('[upscaler][engine] init VERSION', VERSION);
  window.__UPS_CFG = window.__UPS_CFG || { frameGen: false };
  const cfg = window.__UPS_CFG;
  let fallbackMode = false; // (kept for safety if video becomes tainted)
  let videoRef = null;
  let canvasRef = null, ctxRef = null, outCanvas = null, outCtx = null;
  let animHandle = null;
  let rVfcHandle = null; // requestVideoFrameCallback handle
  // FrameGen structures (canvas-based blending instead of per-pixel loop)
  let lastRealTime = 0;            // timestamp of last real frame capture
  let avgInterval = 1000/60;       // rolling average real frame interval
  let lastCaptureCanvas = null;    // canvas with last real frame
  let prevCaptureCanvas = null;    // previous real frame
  let blendTempCanvas = null;      // temp canvas reused for blending
  let origStyles = null; // snapshot of original video + parent styles
  const targetMs = 1000/60;
  let targetFps = parseInt(cfg.targetFps||60,10); if(!targetFps||targetFps<24) targetFps=60; let minFrameMs = 1000/targetFps;
  let lastOutDrawTs = 0;
  // FPS counters (real input frames vs output frames delivered)
  let realFrameCount = 0; // increment when we capture a fresh real frame from video
  let outFrameCount = 0;  // increment when we draw something to outCanvas (blend or direct)
  let lastFpsSampleTs = performance.now();
  let lastRealFps = 0, lastOutFps = 0;
  let fpsBadge = null; let lastOverlayUpdate = 0;
  function ensureBadge(){
    if(fpsBadge) return fpsBadge;
    fpsBadge = document.createElement('div');
    fpsBadge.id='__fg_fps_badge';
    fpsBadge.style.cssText='position:absolute;top:8px;right:8px;z-index:10000;background:rgba(18,18,22,0.65);color:#fff;font:11px system-ui;padding:3px 6px;border-radius:4px;line-height:1.2;pointer-events:none;backdrop-filter:blur(2px);transition:opacity .4s;opacity:0;';
    try { (videoRef?.parentElement||document.body).appendChild(fpsBadge); } catch(_){ document.body.appendChild(fpsBadge); }
    return fpsBadge;
  }
  function updateBadge(force){
    const now = performance.now();
    if(!force && now - lastOverlayUpdate < 500) return; // throttle text updates
    lastOverlayUpdate = now;
    const el = ensureBadge();
    function color(v){ if(v>=55) return '#39c553'; if(v>=30) return '#d4b14a'; return '#d4684a'; }
    el.innerHTML = `<span style="color:${color(lastRealFps)}">${Math.round(lastRealFps)}</span>/<span style="color:${color(lastOutFps)}">${Math.round(lastOutFps)}</span> fps`;
    el.style.opacity='1';
    clearTimeout(el.__fadeT);
    el.__fadeT = setTimeout(()=>{ try { el.style.opacity='0'; } catch(_){} }, 2200);
  }

  function pickVideo(){
    const vids = Array.from(document.querySelectorAll('video'));
    if(!vids.length) return null;
    vids.sort((a,b)=> (b.videoWidth*b.videoHeight)-(a.videoWidth*a.videoHeight));
    const v = vids[0];
    if(window.__UPS_DEBUG) console.log('[upscaler][engine] pickVideo ->', v && (v.videoWidth+'x'+v.videoHeight));
    return v;
  }
  function setupCanvases(){
    if(!videoRef) return;
    // Clean stale leftovers if re-enabled
    try {
      if(window.__UPS_DISABLED){ delete window.__UPS_DISABLED; }
      const parent = videoRef.parentElement || document.body;
      parent.querySelectorAll('canvas').forEach(c=>{
        if(c !== canvasRef && c !== outCanvas && c.style && /z-index:9999/.test(c.getAttribute('style')||'')){
          // stale overlay from old session
          try { c.remove(); } catch(_){ }
        }
      });
    } catch(_){ }
    canvasRef = document.createElement('canvas');
    outCanvas = document.createElement('canvas');
    canvasRef.style.display='none';
    outCanvas.style.position='absolute';
    outCanvas.style.inset='0';
    outCanvas.style.margin='auto';
    outCanvas.style.width='100%';
    outCanvas.style.height='100%';
    outCanvas.style.objectFit='contain';
    outCanvas.style.zIndex='9999';
    outCanvas.style.pointerEvents='none';
    outCanvas.style.imageRendering='auto';
    const parent = videoRef.parentElement || document.body;
    parent.style.position='relative';
    try { if(!parent.__upsOverflowSet){ parent.style.overflow='hidden'; parent.__upsOverflowSet=true; } } catch(_){ }
    // Snapshot original styles once
    if(!origStyles){
      origStyles = {
        videoVisibility: videoRef.style.visibility || '',
        videoTransform: videoRef.style.transform || '',
        videoTransformOrigin: videoRef.style.transformOrigin || '',
        parentOverflow: parent.__upsOverflowSet ? '' : (parent.style.overflow||''),
        parentPosition: parent.style.position || ''
      };
    }
    videoRef.style.visibility='hidden';
    try { parent.appendChild(outCanvas); } catch(_){}
    ctxRef = canvasRef.getContext('2d', { willReadFrequently:true });
    outCtx = outCanvas.getContext('2d');
    // (overlay removed)
  }
  function tryInit(){
    if(!videoRef){ videoRef = pickVideo(); if(videoRef){ setupCanvases(); } }
    if(!videoRef) return;
    if(videoRef.videoWidth && videoRef.videoHeight){
      canvasRef.width = videoRef.videoWidth; canvasRef.height = videoRef.videoHeight;
        outCanvas.width = videoRef.videoWidth;
        outCanvas.height = videoRef.videoHeight;
        if(window.__UPS_DEBUG) console.log('[framegen][engine] setupCanvases base', videoRef.videoWidth+'x'+videoRef.videoHeight);
    }
  }
  function renderFrame(now){
    // If using rVFC timing, we still keep RAF as fallback watchdog (rare)
    animHandle = requestAnimationFrame(renderFrame);
    if(!videoRef){ tryInit(); return; }
    const w = videoRef.videoWidth||0, h = videoRef.videoHeight||0;
    if(!w||!h){
      if(window.__UPS_FPS_TRACE){ console.log('[upscaler][trace] video has no dimensions yet w=',w,'h=',h); }
      return;
    }
    let drew=false;
    try {
      ctxRef.drawImage(videoRef,0,0,w,h);
      drew=true; realFrameCount++;
    } catch(e){
      if(!fallbackMode){ console.warn('[upscaler] fallback to CSS (tainted video)'); }
      fallbackMode=true;
    }
    if(window.__UPS_FPS_TRACE){
      console.log('[upscaler][trace] frame now=',now,'drew=',drew,'fgOnly=',fgOnly,'scale=',scale,'frameGen=',cfg.frameGen,'delayMs=',delayMs,'targetFps=',targetFps);
    }
    if(fallbackMode){
      if(videoRef && !videoRef.__cssUpscaleApplied){
        videoRef.__cssUpscaleApplied=true;
        videoRef.style.visibility='visible';
        videoRef.style.transformOrigin='center center';
        if(window.__UPS_DEBUG) console.log('[upscaler][engine] CSS fallback activated');
        try { (videoRef.parentElement||document.body).style.overflow='hidden'; } catch(_){ }
      }
      if(videoRef){
        if(scale===1){ videoRef.style.transform=''; }
        else { videoRef.style.transform='scale('+scale+')'; }
      }
      return;
    }
    if(outCanvas.width !== w || outCanvas.height !== h){ outCanvas.width = w; outCanvas.height = h; }
    // (FPS accounting removed)
    let performedBlend = false;
  if(cfg.frameGen){
      // Update rolling interval when we got a fresh draw
      const dt = now - lastRealTime;
      if(drew && w && h){
        if(!lastCaptureCanvas){
          lastCaptureCanvas = document.createElement('canvas'); lastCaptureCanvas.width=w; lastCaptureCanvas.height=h;
        }
        const lcCtx = lastCaptureCanvas.getContext('2d'); lcCtx.drawImage(canvasRef,0,0);
        if(dt > 0 && dt < 1000) { avgInterval = avgInterval*0.85 + dt*0.15; }
        if(dt > targetMs*1.5){ prevCaptureCanvas = null; }
        else if(dt > targetMs*0.15){
          // Promote last -> prev, keep new in last
          if(!prevCaptureCanvas){ prevCaptureCanvas = document.createElement('canvas'); prevCaptureCanvas.width=w; prevCaptureCanvas.height=h; }
          const pcCtx = prevCaptureCanvas.getContext('2d'); pcCtx.drawImage(lastCaptureCanvas,0,0);
        }
        lastRealTime = now;
      }
      if(prevCaptureCanvas && lastCaptureCanvas){
        const since = now - lastRealTime;
        const span = Math.min(1, since / Math.max(8, avgInterval));
        if(since > avgInterval*0.35 && since < avgInterval*1.4){
          if(!blendTempCanvas){ blendTempCanvas = document.createElement('canvas'); }
          if(blendTempCanvas.width!==w || blendTempCanvas.height!==h){ blendTempCanvas.width=w; blendTempCanvas.height=h; }
          const bctx = blendTempCanvas.getContext('2d');
          // Draw prev fully, then current with alpha span
            bctx.globalCompositeOperation='source-over';
            bctx.globalAlpha=1; bctx.drawImage(prevCaptureCanvas,0,0);
            bctx.globalAlpha=span; bctx.drawImage(lastCaptureCanvas,0,0);
            bctx.globalAlpha=1;
          outCtx.imageSmoothingEnabled = true; outCtx.imageSmoothingQuality='high';
          outCtx.drawImage(blendTempCanvas,0,0,w,h,0,0,outCanvas.width,outCanvas.height);
          outFrameCount++;
          performedBlend = true;
        }
      }
    }
    if(!performedBlend){
      // Respect target FPS cap
      if(now - lastOutDrawTs < minFrameMs - 1){ return; }
      outCtx.imageSmoothingEnabled = true; outCtx.imageSmoothingQuality='high';
      outCtx.drawImage(canvasRef,0,0,w,h,0,0,outCanvas.width,outCanvas.height);
      lastOutDrawTs = now;
      outFrameCount++;
    }
    // Sample FPS once per second
    const sampleNow = now;
    if(sampleNow - lastFpsSampleTs >= 1000){
      const dt = (sampleNow - lastFpsSampleTs)/1000;
      lastRealFps = realFrameCount / dt;
      lastOutFps = outFrameCount / dt;
      realFrameCount = 0; outFrameCount = 0; lastFpsSampleTs = sampleNow;
      updateBadge(true);
    }
  }
  function vfcLoop(now, meta){
    try { renderFrame(now || performance.now()); } catch(_){ }
    try { rVfcHandle = videoRef && videoRef.requestVideoFrameCallback ? videoRef.requestVideoFrameCallback(vfcLoop) : null; } catch(_){ rVfcHandle=null; }
  }
  function start(){
    if(videoRef && videoRef.requestVideoFrameCallback){
      if(!rVfcHandle){ rVfcHandle = videoRef.requestVideoFrameCallback(vfcLoop); }
    }
    if(!animHandle) animHandle = requestAnimationFrame(renderFrame);
  }
  function stop(){
    if(animHandle){ cancelAnimationFrame(animHandle); animHandle=null; }
    if(rVfcHandle && videoRef && videoRef.cancelVideoFrameCallback){
      try { videoRef.cancelVideoFrameCallback(rVfcHandle); } catch(_){ }
      rVfcHandle=null;
    }
    try { if(fpsBadge && fpsBadge.parentNode) fpsBadge.parentNode.removeChild(fpsBadge); } catch(_){ }
  }
  function disable(){
    try { stop(); } catch(_){ }
    try { if(outCanvas && outCanvas.parentNode) outCanvas.parentNode.removeChild(outCanvas); } catch(_){ }
  // Не удаляем overlayEl т.к. он теперь глобальный всегда-on
    try {
      if(videoRef && origStyles){
        videoRef.style.visibility = origStyles.videoVisibility;
        videoRef.style.transform = origStyles.videoTransform;
        videoRef.style.transformOrigin = origStyles.videoTransformOrigin;
      } else if(videoRef){
        videoRef.style.visibility=''; videoRef.style.transform=''; videoRef.style.transformOrigin='';
      }
      const parent = videoRef && videoRef.parentElement;
      if(parent && origStyles){
        if(parent.__upsOverflowSet){
          // We set overflow hidden; restore only if original had something else
          if(origStyles.parentOverflow){ parent.style.overflow = origStyles.parentOverflow; } else { parent.style.removeProperty('overflow'); }
          delete parent.__upsOverflowSet;
        }
        // Don't forcibly revert position if other layout logic depends on relative
      }
    } catch(_){ }
    window.__UPS_DISABLED = true;
    // Allow fresh re-injection later by clearing version + hooks
    try {
      delete window.__UPSCALER_A_VERSION;
      delete window.__UPS_UPDATE;
      delete window.__UPS_STOP;
      // Keep __UPS_CFG so user settings persist, but could also delete if clean slate desired
    } catch(_){ }
    if(window.__UPS_DEBUG) console.log('[upscaler][engine] disabled & cleaned');
  }
  window.__UPS_UPDATE = function(newCfg){
    const before = { frameGen: cfg.frameGen };
    Object.assign(cfg, newCfg);
  if(newCfg && newCfg.targetFps){ const tf=parseInt(newCfg.targetFps,10); if(!isNaN(tf)){ targetFps=Math.min(160, Math.max(24, tf)); minFrameMs=1000/targetFps; } }
    if(window.__UPS_DEBUG) console.log('[framegen][engine] update cfg', newCfg, 'prev', before, 'now', cfg);
  };
  window.__UPS_STOP = stop;
  window.__UPS_DISABLE = disable;
  const mo = new MutationObserver(()=>{ if(!videoRef){ pickVideo(); } });
  mo.observe(document.documentElement,{ childList:true, subtree:true });
  start();
})();
