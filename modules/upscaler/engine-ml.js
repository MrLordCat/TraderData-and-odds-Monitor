// ML engine bootstrap (executed after base engine if mode==='ml').
(function(){
  if(!window.__UPS_CFG || window.__UPS_CFG.mode !== 'ml') return;
  if(window.__UPS_ML_VERSION) { return; }
  window.__UPS_ML_VERSION = 1;
  const cfg = window.__UPS_CFG;
  const QUEUE_MAX = 6; // tighter queue, we aggressively drop stale frames anyway
  const frameQueue = [];
  let processing = false;
  let worker = null;
  let lastDrawTs = 0;
  let lastDisplayedTs = 0;
  let displayCanvas; let displayCtx;
  let sourceVideo = null;
  let dropped = 0;
  let modelReady = false;
  let rageFallback = false;
  let delayMs = parseInt(cfg.delayMs||0,10) || 0;
  const delayedQueue = []; // store {tsReady, width,height,dataArrayBuffer}
  // Adaptive pacing
  let avgInferenceMs = 40; // rolling avg
  let lastInferenceLog = 0;
  let targetFps = parseInt(cfg.targetFps||60,10); if(!targetFps||targetFps<24) targetFps=60;
  const baseMin = 1000/Math.min(90, Math.max(30,targetFps+5));
  let captureIntervalMs = 1000/Math.min(targetFps,60);
  const pace = { grow:1.12, shrink:0.93 };
  function bounds(){ return { MIN_CAPTURE_MS: baseMin, MAX_CAPTURE_MS: 1000/20 }; }
  function ensureDisplayCanvas(){
    if(displayCanvas) return;
    displayCanvas = document.createElement('canvas');
    displayCanvas.style.position='absolute';
    displayCanvas.style.inset='0';
    displayCanvas.style.margin='auto';
    displayCanvas.style.width='100%';
    displayCanvas.style.height='100%';
    displayCanvas.style.objectFit='contain';
    displayCanvas.style.zIndex='10000';
    displayCanvas.style.pointerEvents='none';
    displayCanvas.style.background='transparent';
    const base = document.querySelector('canvas[style*="z-index:9999"]')?.parentElement || document.body;
    base.appendChild(displayCanvas);
    displayCtx = displayCanvas.getContext('2d');
  }

  function pickVideo(){
    const vids = Array.from(document.querySelectorAll('video'));
    if(!vids.length) return null;
    vids.sort((a,b)=> (b.videoWidth*b.videoHeight)-(a.videoWidth*a.videoHeight));
    return vids[0];
  }

  function initWorker(){
    if(worker) return;
    if(!window.__UPS_ML_WORKER_SOURCE){ warn('missing worker source'); return; }
    const blob = new Blob([window.__UPS_ML_WORKER_SOURCE], { type:'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (e)=>{
      const msg = e.data||{};
      if(msg.type==='ready'){ modelReady=true; log('model ready'); }
      else if(msg.type==='frame'){ onResultFrame(msg); }
      else if(msg.type==='error'){ warn('worker error', msg.error); rageFallback=true; }
      else if(msg.type==='perf'){
        if(msg.kind==='inference'){
          avgInferenceMs = avgInferenceMs*0.85 + msg.ms*0.15;
          if(window.__UPS_DEBUG && performance.now() - lastInferenceLog > 2000){
            log('avg inference ms', avgInferenceMs.toFixed(1), 'captureInt', captureIntervalMs.toFixed(1));
            lastInferenceLog = performance.now();
          }
        } else if(msg.kind==='frameTotal'){
          if(window.__UPS_DEBUG) log('frame total ms', msg.ms.toFixed(1), 'useOrt', msg.useOrt);
        }
      }
    };
    worker.postMessage({ type:'init', modelUrl: cfg.modelUrl, scale: parseFloat(cfg.scale)||2 });
    log('worker initialized, posted init');
  }

  function enqueueFrame(bitmap, ts){
    if(ts && ts < lastDisplayedTs){ return; }
    if(frameQueue.length >= QUEUE_MAX){ frameQueue.shift(); dropped++; }
    frameQueue.push({ bitmap, ts });
    if(window.__UPS_DEBUG && (frameQueue.length === QUEUE_MAX || dropped % 25 === 0)){
      log('queue size', frameQueue.length, 'dropped', dropped, 'capInt', captureIntervalMs.toFixed(1), 'avgInf', avgInferenceMs.toFixed(1));
    }
    pump();
  }

  function captureLoop(){
    if(rageFallback || !cfg.mode || cfg.mode!=='ml') return;
    if(!sourceVideo){ sourceVideo = pickVideo(); }
    let nextDelay = captureIntervalMs;
    if(sourceVideo && sourceVideo.videoWidth && modelReady){
      try {
        const off = new OffscreenCanvas(sourceVideo.videoWidth, sourceVideo.videoHeight);
        const octx = off.getContext('2d');
        octx.drawImage(sourceVideo,0,0);
        off.convertToBlob().then(blob=>{ if(!blob) return; createImageBitmap(blob).then(bmp=> enqueueFrame(bmp, performance.now())); }).catch(()=>{});
        if(frameQueue.length===0 && !processing){ captureIntervalMs = Math.max(MIN_CAPTURE_MS, captureIntervalMs*0.9); }
      } catch(e){
        try {
          const frame = document.createElement('canvas');
          frame.width = sourceVideo.videoWidth; frame.height = sourceVideo.videoHeight;
          const fctx = frame.getContext('2d'); fctx.drawImage(sourceVideo,0,0);
          frame.toBlob(blob=>{ if(!blob) return; createImageBitmap(blob).then(bmp=> enqueueFrame(bmp, performance.now())); });
        } catch(e2){ rageFallback=true; }
      }
    }
    setTimeout(captureLoop, nextDelay);
  }

  function pump(){
    if(processing || !worker || !modelReady) return;
    while(frameQueue.length > 1){ frameQueue.shift(); dropped++; }
    const item = frameQueue.shift();
    if(!item) return;
    processing = true;
    const { bitmap, ts } = item;
    try {
      const off = new OffscreenCanvas(bitmap.width, bitmap.height);
      const octx = off.getContext('2d');
      octx.drawImage(bitmap,0,0);
      const imgData = octx.getImageData(0,0,bitmap.width, bitmap.height);
      const t0 = performance.now();
      worker.postMessage({ type:'frame', data: imgData, ts, t0 }, [imgData.data.buffer]);
      if(window.__UPS_DEBUG) log('posted frame to worker', bitmap.width+'x'+bitmap.height, 'queueLeft', frameQueue.length);
    } catch(e){ processing=false; }
  }

  function onResultFrame(msg){
    processing = false;
    if(!displayCanvas){ ensureDisplayCanvas(); }
    if(msg.ts && msg.ts < lastDisplayedTs){ if(window.__UPS_DEBUG) log('discard out-of-order frame', msg.ts, '<', lastDisplayedTs); pump(); return; }
    try {
      const { width, height, data } = msg;
      if(displayCanvas.width !== width || displayCanvas.height !== height){ displayCanvas.width=width; displayCanvas.height=height; }
  const id = new ImageData(new Uint8ClampedArray(data), width, height);
  displayCtx.putImageData(id,0,0); // FPS increment removed
      lastDrawTs = msg.ts;
      lastDisplayedTs = msg.ts || performance.now();
      if(window.__UPS_DEBUG) log('frame drawn', width+'x'+height, 'ts', msg.ts);
    } catch(e){ console.warn('[upscaler-ml] draw fail', e); }
    const { MIN_CAPTURE_MS, MAX_CAPTURE_MS } = bounds();
    if(frameQueue.length > 0){
      captureIntervalMs = Math.min(MAX_CAPTURE_MS, captureIntervalMs * pace.grow + 0.5);
    } else if(!processing){
      captureIntervalMs = Math.max(MIN_CAPTURE_MS, captureIntervalMs * pace.shrink - 0.2);
    }
    pump();
  }

  const oldUpdate = window.__UPS_UPDATE;
  window.__UPS_UPDATE = function(newCfg){
    Object.assign(cfg,newCfg||{});
    if(cfg.mode !== 'ml'){ return; }
    if(newCfg && (newCfg.targetFps)){
      targetFps = parseInt(cfg.targetFps||60,10); if(!targetFps||targetFps<24) targetFps=60;
    }
    if(newCfg && newCfg.delayMs!==undefined){ const d=parseInt(newCfg.delayMs,10); if(!isNaN(d)){ delayMs=Math.min(10000, Math.max(0,d)); } }
    if(worker && newCfg && (newCfg.scale || newCfg.modelUrl)){
      worker.postMessage({ type:'config', scale: parseFloat(cfg.scale)||2 });
      log('posted config to worker', cfg);
    }
    oldUpdate && oldUpdate(newCfg);
  };

  ensureDisplayCanvas();
  initWorker();
  captureLoop();
  log('startup sequence complete');

  const baseDisable = window.__UPS_DISABLE;
  window.__UPS_DISABLE = function(){
    try { rageFallback = true; } catch(_){ }
    try { if(worker){ worker.terminate(); worker=null; } } catch(_){ }
    try { if(displayCanvas && displayCanvas.parentNode) displayCanvas.parentNode.removeChild(displayCanvas); } catch(_){ }
    try { delayedQueue.splice(0).forEach(f=> clearTimeout(f.handle)); } catch(_){ }
    try { delete window.__UPS_ML_VERSION; } catch(_){ }
    if(window.__UPS_DEBUG) log('ml disable cleanup complete');
    baseDisable && baseDisable();
  };
})();
